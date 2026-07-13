import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cacheRoot = path.join(projectRoot, '.asset-cache', 'quaternius');
const outputRoot = path.join(projectRoot, 'public', 'assets', 'quaternius');

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

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizedUri(uri) {
  return safeDecode(uri).replaceAll('\\', '/');
}

async function main() {
  const cacheFiles = await walk(cacheRoot);
  const textureByBasename = new Map();
  for (const file of cacheFiles) {
    const ext = path.extname(file).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) continue;
    const key = path.basename(file).toLowerCase();
    if (!textureByBasename.has(key)) textureByBasename.set(key, file);
  }

  const generatedFiles = await walk(outputRoot);
  const gltfFiles = generatedFiles.filter((file) => path.extname(file).toLowerCase() === '.gltf');
  let repaired = 0;

  for (const gltfFile of gltfFiles) {
    const json = JSON.parse(await readFile(gltfFile, 'utf-8'));
    const modelDir = path.dirname(gltfFile);
    let changed = false;

    for (const image of json.images ?? []) {
      if (!image.uri || image.uri.startsWith('data:') || /^https?:\/\//i.test(image.uri)) continue;
      const uri = normalizedUri(image.uri);
      const basename = path.basename(uri);
      const aliasPath = path.join(modelDir, basename);
      const resolvedPath = path.resolve(modelDir, uri);
      const resolvedInsideOutput = resolvedPath.startsWith(outputRoot);
      const source = resolvedInsideOutput && await exists(resolvedPath)
        ? resolvedPath
        : textureByBasename.get(basename.toLowerCase());

      if (!source) {
        console.warn(`[quaternius] Texture source not found for ${image.uri} in ${path.relative(projectRoot, gltfFile)}`);
        continue;
      }

      if (!(await exists(aliasPath))) {
        await mkdir(path.dirname(aliasPath), { recursive: true });
        await copyFile(source, aliasPath);
        repaired += 1;
      }

      if (image.uri !== basename) {
        image.uri = basename;
        changed = true;
      }
    }

    if (changed) await writeFile(gltfFile, `${JSON.stringify(json, null, 2)}\n`, 'utf-8');
  }

  console.log(`[quaternius] Repaired ${repaired} external texture alias(es) across ${gltfFiles.length} generated glTF model(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
