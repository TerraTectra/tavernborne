import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(projectRoot, 'public', 'assets', 'quaternius');
const glbMagic = 0x46546c67;
const glbJsonChunk = 0x4e4f534a;

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function readGlbJson(buffer, sourceFile) {
  assert.ok(buffer.length >= 20, `GLB is too small: ${sourceFile}`);
  assert.equal(buffer.readUInt32LE(0), glbMagic, `Invalid GLB header: ${sourceFile}`);
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + length;
    assert.ok(end <= buffer.length, `Invalid GLB chunk length: ${sourceFile}`);
    if (type === glbJsonChunk) {
      return JSON.parse(buffer.subarray(start, end).toString('utf-8').replace(/\u0000+$/u, '').trim());
    }
    offset = end;
  }
  throw new Error(`GLB JSON chunk not found: ${sourceFile}`);
}

function externalUri(uri) {
  return Boolean(uri)
    && !uri.startsWith('data:')
    && !uri.startsWith('http://')
    && !uri.startsWith('https://');
}

function cleanUri(uri) {
  const withoutQuery = uri.split(/[?#]/u, 1)[0];
  try {
    return decodeURIComponent(withoutQuery).replaceAll('\\', '/');
  } catch {
    return withoutQuery.replaceAll('\\', '/');
  }
}

function assertInsideOutput(filePath, uri) {
  const relative = path.relative(outputRoot, filePath);
  assert.ok(!relative.startsWith('..') && !path.isAbsolute(relative), `Dependency escapes output: ${uri}`);
}

async function validateImage(filePath) {
  const bytes = await readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') {
    assert.ok(bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), `Invalid PNG: ${filePath}`);
  } else if (ext === '.jpg' || ext === '.jpeg') {
    assert.ok(bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff, `Invalid JPEG: ${filePath}`);
  } else if (ext === '.webp') {
    assert.ok(bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP', `Invalid WebP: ${filePath}`);
  }
}

const files = await walk(outputRoot);
const modelFiles = files.filter((file) => ['.gltf', '.glb'].includes(path.extname(file).toLowerCase()));
const dependencies = [];

for (const modelFile of modelFiles) {
  const ext = path.extname(modelFile).toLowerCase();
  const json = ext === '.glb'
    ? readGlbJson(await readFile(modelFile), modelFile)
    : JSON.parse(await readFile(modelFile, 'utf-8'));
  const uris = new Set([
    ...(json.buffers ?? []).map((buffer) => buffer.uri),
    ...(json.images ?? []).map((image) => image.uri),
  ].filter(externalUri));
  for (const uri of uris) {
    const resolved = path.resolve(path.dirname(modelFile), cleanUri(uri));
    assertInsideOutput(resolved, uri);
    assert.ok(await exists(resolved), `Missing dependency ${uri} referenced by ${path.relative(outputRoot, modelFile)}`);
    await validateImage(resolved);
    dependencies.push({
      model: path.relative(outputRoot, modelFile).replaceAll('\\', '/'),
      uri,
      file: path.relative(outputRoot, resolved).replaceAll('\\', '/'),
    });
  }
}

const manifest = JSON.parse(await readFile(path.join(outputRoot, 'manifest.json'), 'utf-8'));
const declared = [
  ...Object.entries(manifest.models ?? {}),
  ...Object.entries(manifest.characters ?? {}),
].reduce((total, [, entry]) => total + Number(entry.externalDependencies ?? 0), 0);

assert.equal(declared, dependencies.length, `Manifest declares ${declared} external dependencies, but ${dependencies.length} were validated`);
console.log(JSON.stringify({ models: modelFiles.length, externalDependencies: dependencies }, null, 2));
