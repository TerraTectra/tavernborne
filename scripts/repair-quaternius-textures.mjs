import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cacheRoot = path.join(projectRoot, '.asset-cache', 'quaternius');
const outputRoot = path.join(projectRoot, 'public', 'assets', 'quaternius');

const packIdByName = new Map([
  ['Medieval Village MegaKit', 'medieval-village-megakit'],
  ['Fantasy Props MegaKit', 'fantasy-props-megakit'],
  ['Stylized Nature MegaKit', 'stylized-nature-megakit'],
  ['Universal Animation Library', 'universal-animation-library'],
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

async function exactSourceForModel(manifest, modelId) {
  const metadata = manifest.models?.[modelId];
  const packId = metadata?.sourcePack ? packIdByName.get(metadata.sourcePack) : undefined;
  if (!metadata?.sourceFile || !packId) return undefined;
  const sourceModel = path.join(cacheRoot, packId, ...metadata.sourceFile.split('/'));
  if (!(await exists(sourceModel)) || path.extname(sourceModel).toLowerCase() !== '.gltf') return undefined;
  const sourceJson = JSON.parse(await readFile(sourceModel, 'utf-8'));
  return { sourceModel, sourceJson };
}

async function main() {
  const manifestPath = path.join(outputRoot, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
  const cacheFiles = await walk(cacheRoot);
  const textureByBasename = new Map();
  for (const file of cacheFiles) {
    const ext = path.extname(file).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) continue;
    const key = path.basename(file).toLowerCase();
    const candidates = textureByBasename.get(key) ?? [];
    candidates.push(file);
    textureByBasename.set(key, candidates);
  }

  const generatedFiles = await walk(outputRoot);
  const gltfFiles = generatedFiles.filter((file) => path.extname(file).toLowerCase() === '.gltf');
  let repaired = 0;
  let exactMatches = 0;
  let fallbackMatches = 0;

  for (const gltfFile of gltfFiles) {
    const json = JSON.parse(await readFile(gltfFile, 'utf-8'));
    const modelDir = path.dirname(gltfFile);
    const modelId = path.basename(modelDir);
    const exactModel = await exactSourceForModel(manifest, modelId);
    let changed = false;

    for (let index = 0; index < (json.images ?? []).length; index += 1) {
      const image = json.images[index];
      if (!image.uri || image.uri.startsWith('data:') || /^https?:\/\//i.test(image.uri)) continue;

      const sourceImage = exactModel?.sourceJson.images?.[index];
      const originalUri = sourceImage?.uri ?? image.uri;
      const uri = normalizedUri(originalUri);
      const basename = path.basename(uri);
      const aliasPath = path.join(modelDir, basename);
      const exactPath = exactModel ? path.resolve(path.dirname(exactModel.sourceModel), uri) : undefined;
      const generatedPath = path.resolve(modelDir, normalizedUri(image.uri));
      const fallbackCandidates = textureByBasename.get(basename.toLowerCase()) ?? [];

      let source;
      if (exactPath && await exists(exactPath)) {
        source = exactPath;
        exactMatches += 1;
      } else if (generatedPath.startsWith(outputRoot) && await exists(generatedPath)) {
        source = generatedPath;
        exactMatches += 1;
      } else if (fallbackCandidates.length === 1) {
        source = fallbackCandidates[0];
        fallbackMatches += 1;
      } else if (fallbackCandidates.length > 1) {
        const packId = exactModel ? path.relative(cacheRoot, exactModel.sourceModel).split(path.sep)[0] : undefined;
        source = fallbackCandidates.find((candidate) => path.relative(cacheRoot, candidate).split(path.sep)[0] === packId)
          ?? fallbackCandidates[0];
        fallbackMatches += 1;
      }

      if (!source) {
        console.warn(`[quaternius] Texture source not found for ${originalUri} in ${path.relative(projectRoot, gltfFile)}`);
        continue;
      }

      await mkdir(path.dirname(aliasPath), { recursive: true });
      if (path.resolve(source) !== path.resolve(aliasPath)) await copyFile(source, aliasPath);
      repaired += 1;

      if (image.uri !== basename) {
        image.uri = basename;
        changed = true;
      }
    }

    if (changed) await writeFile(gltfFile, `${JSON.stringify(json, null, 2)}\n`, 'utf-8');
  }

  console.log(`[quaternius] Repaired ${repaired} external texture alias(es) across ${gltfFiles.length} generated glTF model(s): ${exactMatches} exact, ${fallbackMatches} fallback.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
