import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(projectRoot, 'public', 'assets', 'quaternius');
const glbMagic = 0x46546c67;
const glbJsonChunk = 0x4e4f534a;

const normal = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNoaPj/HwAGggL/s75RMwAAAABJRU5ErkJggg==';
const orm = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4f4fhPwAHlALbY53LjQAAAABJRU5ErkJggg==';
const props = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGPYsqDpPwAGuALWUk6tNgAAAABJRU5ErkJggg==';
const wood = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGOoizD5DwAEbAIKxV26LQAAAABJRU5ErkJggg==';
const metal = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNISMn5DwAEiAIw+zYmfgAAAABJRU5ErkJggg==';
const cloth = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGOI8Sr4DwAEMgIW1qKJFAAAAABJRU5ErkJggg==';
const rocks = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGPIKyj5DwAE9AJSyfAmoQAAAABJRU5ErkJggg==';
const leaves = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGPwqLD6DwAEAAH6YWzOKwAAAABJRU5ErkJggg==';
const bark = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMo8NH9DwAEAgHpuvzp4wAAAABJRU5ErkJggg==';
const roughness = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGPYtGnTfwAHRgMWwm+yngAAAABJRU5ErkJggg==';

const fallbacks = new Map([
  ['t_trim_props_basecolor.png', props],
  ['t_trim_props_normal.png', normal],
  ['t_trim_props_orm.png', orm],
  ['t_trim_metal_basecolor.png', metal],
  ['t_trim_metal_normal.png', normal],
  ['t_trim_metal_orm.png', orm],
  ['t_trim_furniture_basecolor.png', wood],
  ['t_trim_furniture_normal.png', normal],
  ['t_trim_furniture_orm.png', orm],
  ['t_trim_cloth_basecolor.png', cloth],
  ['t_trim_cloth_normal.png', normal],
  ['t_trim_cloth_orm.png', orm],
  ['t_woodtrim_basecolor.png', wood],
  ['t_woodtrim_normal.png', normal],
  ['t_woodtrim_roughness.png', roughness],
  ['rocks_diffuse.png', rocks],
  ['leaves_normaltree_c.png', leaves],
  ['bark_normaltree_normal.png', normal],
  ['bark_normaltree.png', bark],
]);

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  if (!(await exists(dir))) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function cleanUri(uri) {
  const withoutQuery = uri.split(/[?#]/u, 1)[0];
  try {
    return decodeURIComponent(withoutQuery).replaceAll('\\', '/');
  } catch {
    return withoutQuery.replaceAll('\\', '/');
  }
}

function externalUri(uri) {
  return Boolean(uri)
    && !uri.startsWith('data:')
    && !uri.startsWith('http://')
    && !uri.startsWith('https://');
}

function ensureInsideOutput(targetPath, uri) {
  const relative = path.relative(outputRoot, targetPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`[quaternius] Texture path escapes output directory: ${uri}`);
  }
}

function readGlbJson(buffer, sourceFile) {
  if (buffer.length < 20 || buffer.readUInt32LE(0) !== glbMagic) {
    throw new Error(`[quaternius] Invalid GLB header: ${sourceFile}`);
  }
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    if (chunkEnd > buffer.length) throw new Error(`[quaternius] Invalid GLB chunk length: ${sourceFile}`);
    if (chunkType === glbJsonChunk) {
      const text = buffer.subarray(chunkStart, chunkEnd).toString('utf-8').replace(/\u0000+$/u, '').trim();
      return JSON.parse(text);
    }
    offset = chunkEnd;
  }
  throw new Error(`[quaternius] GLB JSON chunk not found: ${sourceFile}`);
}

async function writeFallback(targetPath, encoded) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, Buffer.from(encoded, 'base64'));
}

async function sanitizeReferencedTextures(modelFile, json) {
  const modelDir = path.dirname(modelFile);
  let count = 0;
  for (const image of json.images ?? []) {
    if (!externalUri(image.uri)) continue;
    const uri = cleanUri(image.uri);
    const encoded = fallbacks.get(path.basename(uri).toLowerCase());
    if (!encoded) continue;
    const targetPath = path.resolve(modelDir, uri);
    ensureInsideOutput(targetPath, image.uri);
    await writeFallback(targetPath, encoded);
    count += 1;
  }
  return count;
}

async function main() {
  const files = await walk(outputRoot);
  let overwritten = 0;
  let referenced = 0;

  for (const file of files) {
    const encoded = fallbacks.get(path.basename(file).toLowerCase());
    if (!encoded) continue;
    await writeFallback(file, encoded);
    overwritten += 1;
  }

  for (const file of files) {
    const extension = path.extname(file).toLowerCase();
    if (extension === '.gltf') {
      const json = JSON.parse(await readFile(file, 'utf-8'));
      referenced += await sanitizeReferencedTextures(file, json);
    } else if (extension === '.glb') {
      const bytes = await readFile(file);
      referenced += await sanitizeReferencedTextures(file, readGlbJson(bytes, file));
    }
  }

  console.log(`[quaternius] Sanitized ${overwritten} copied texture file(s) and ${referenced} glTF/GLB texture reference(s) for Chromium.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
