import extract from 'extract-zip';
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cacheRoot = path.join(projectRoot, '.asset-cache', 'quaternius');
const outputRoot = path.join(projectRoot, 'public', 'assets', 'quaternius');
const modelsRoot = path.join(outputRoot, 'models');
const charactersRoot = path.join(outputRoot, 'characters');

const packs = [
  {
    id: 'medieval-village-megakit',
    name: 'Medieval Village MegaKit',
    source: 'https://store.godotengine.org/asset/quaternius/medieval-village-megakit/',
    downloadUrl: 'https://store.godotengine.org/asset/quaternius/medieval-village-megakit/download/142/',
    license: 'CC0-1.0',
  },
  {
    id: 'fantasy-props-megakit',
    name: 'Fantasy Props MegaKit',
    source: 'https://store.godotengine.org/asset/quaternius/fantasy-props-megakit/',
    downloadUrl: 'https://store.godotengine.org/asset/quaternius/fantasy-props-megakit/download/141/',
    license: 'CC0-1.0',
  },
  {
    id: 'stylized-nature-megakit',
    name: 'Stylized Nature MegaKit',
    source: 'https://store.godotengine.org/asset/quaternius/stylized-nature-megakit/',
    downloadUrl: 'https://store.godotengine.org/asset/quaternius/stylized-nature-megakit/download/31/',
    license: 'CC0-1.0',
  },
  {
    id: 'universal-animation-library',
    name: 'Universal Animation Library',
    source: 'https://store.godotengine.org/asset/quaternius/universal-animation-library/',
    downloadUrl: 'https://store.godotengine.org/asset/quaternius/universal-animation-library/download/44/',
    license: 'CC0-1.0',
  },
];

const targets = [
  { id: 'tavern', pack: 'medieval-village-megakit', keywords: ['inn', 'tavern', 'house', 'building', 'wood'], negative: ['wall', 'floor', 'roof', 'window', 'door', 'stairs', 'stair', 'fence'], size: 2.7 },
  { id: 'guild', pack: 'medieval-village-megakit', keywords: ['tower', 'guild', 'house', 'building', 'wizard'], negative: ['wall', 'floor', 'roof', 'window', 'door', 'stairs', 'stair', 'fence'], size: 2.1 },
  { id: 'armory', pack: 'medieval-village-megakit', keywords: ['armory', 'weapon', 'shop', 'house', 'building'], negative: ['wall', 'floor', 'roof', 'window', 'door', 'stairs', 'stair', 'fence'], size: 2.0 },
  { id: 'blacksmith', pack: 'medieval-village-megakit', keywords: ['blacksmith', 'forge', 'smith', 'shop', 'building'], negative: ['wall', 'floor', 'roof', 'window', 'door', 'stairs', 'stair', 'fence'], size: 2.0 },
  { id: 'dungeonGate', pack: 'medieval-village-megakit', keywords: ['dungeon', 'gate', 'door', 'arch', 'stone'], negative: ['window', 'roof', 'floor'], size: 2.0 },
  { id: 'shrine', pack: 'fantasy-props-megakit', keywords: ['crystal', 'altar', 'magic', 'wizard', 'obelisk', 'book'], negative: ['food', 'vegetable', 'table'], size: 1.25 },
  { id: 'market', pack: 'fantasy-props-megakit', keywords: ['market', 'stall', 'table', 'cart', 'crate'], negative: ['weapon', 'sword'], size: 1.8 },
  { id: 'barrel', pack: 'fantasy-props-megakit', keywords: ['barrel'], negative: [], size: 0.75 },
  { id: 'crate', pack: 'fantasy-props-megakit', keywords: ['crate', 'box'], negative: [], size: 0.7 },
  { id: 'lamp', pack: 'fantasy-props-megakit', keywords: ['lamp', 'lantern', 'torch'], negative: [], size: 0.8 },
  { id: 'tree', pack: 'stylized-nature-megakit', keywords: ['tree', 'pine', 'oak'], negative: ['stump'], size: 1.5 },
  { id: 'rock', pack: 'stylized-nature-megakit', keywords: ['rock', 'stone'], negative: [], size: 0.9 },
  { id: 'bush', pack: 'stylized-nature-megakit', keywords: ['bush', 'plant', 'grass'], negative: [], size: 0.75 },
];

const characterTargets = [
  {
    id: 'universalHumanoid',
    pack: 'universal-animation-library',
    keywords: ['universal', 'animation', 'library', 'character', 'humanoid', 'standard'],
    negative: ['preview', 'sample', 'godot', 'unity', 'unreal'],
    targetHeight: 2.25,
    compatibleRig: 'Quaternius Universal Humanoid',
  },
];

function normalize(value) {
  return value.toLowerCase().replaceAll('\\', '/');
}

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
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
      continue;
    }

    if (entry.isFile()) files.push(fullPath);
  }

  return files;
}

async function downloadPack(pack) {
  await mkdir(cacheRoot, { recursive: true });
  const zipPath = path.join(cacheRoot, `${pack.id}.zip`);
  const extractDir = path.join(cacheRoot, pack.id);

  if (!(await exists(zipPath))) {
    console.log(`[quaternius] Downloading ${pack.name}...`);
    const response = await fetch(pack.downloadUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'TavernborneAssetInstaller/1.1 (+https://github.com/TerraTectra/tavernborne)',
      },
    });

    if (!response.ok) throw new Error(`[quaternius] ${pack.name} download failed: ${response.status} ${response.statusText}`);
    await writeFile(zipPath, Buffer.from(await response.arrayBuffer()));
  }

  if (!(await exists(path.join(extractDir, '.extracted')))) {
    console.log(`[quaternius] Extracting ${pack.name}...`);
    await rm(extractDir, { recursive: true, force: true });
    await mkdir(extractDir, { recursive: true });
    await extract(zipPath, { dir: extractDir });
    await writeFile(path.join(extractDir, '.extracted'), new Date().toISOString(), 'utf-8');
  }

  return extractDir;
}

function scoreCandidate(filePath, target) {
  const text = normalize(filePath);
  const basename = normalize(path.basename(filePath, path.extname(filePath)));
  let score = 0;

  if (filePath.toLowerCase().endsWith('.glb')) score += 12;
  if (text.includes('/gltf/') || text.includes('/glb/')) score += 4;
  if (text.includes('/models/')) score += 2;

  for (const keyword of target.keywords) {
    if (basename.includes(keyword)) score += 12;
    else if (text.includes(keyword)) score += 5;
  }

  for (const negative of target.negative) {
    if (basename.includes(negative)) score -= 8;
    else if (text.includes(negative)) score -= 3;
  }

  if (basename.includes('lod')) score -= 4;
  if (basename.includes('preview')) score -= 20;
  if (basename.includes('sample')) score -= 20;

  return score;
}

function selectCandidate(files, target, options = {}) {
  const allowed = options.glbOnly ? ['.glb'] : ['.gltf', '.glb'];
  const modelFiles = files.filter((file) => allowed.includes(path.extname(file).toLowerCase()));
  if (modelFiles.length === 0) return null;

  const ranked = modelFiles
    .map((file) => ({ file, score: scoreCandidate(file, target) }))
    .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file));

  if (options.acceptAny && ranked[0]) return ranked[0];
  return ranked[0]?.score > 0 ? ranked[0] : null;
}

async function copyDependency(fromDir, toDir, uri) {
  if (!uri || uri.startsWith('data:') || uri.startsWith('http://') || uri.startsWith('https://')) return;
  const source = path.resolve(fromDir, uri);
  const target = path.resolve(toDir, uri);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target);
}

async function copyModel(sourceFile, targetDir) {
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });

  const ext = path.extname(sourceFile).toLowerCase();
  if (ext === '.glb') {
    await copyFile(sourceFile, path.join(targetDir, 'model.glb'));
    return 'model.glb';
  }

  const sourceDir = path.dirname(sourceFile);
  const targetModel = path.join(targetDir, 'model.gltf');
  const json = JSON.parse(await readFile(sourceFile, 'utf-8'));
  await writeFile(targetModel, JSON.stringify(json, null, 2), 'utf-8');

  for (const buffer of json.buffers ?? []) await copyDependency(sourceDir, targetDir, buffer.uri);
  for (const image of json.images ?? []) await copyDependency(sourceDir, targetDir, image.uri);
  return 'model.gltf';
}

async function main() {
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(modelsRoot, { recursive: true });
  await mkdir(charactersRoot, { recursive: true });

  const extractedPacks = new Map();
  const sourceStatus = [];

  for (const pack of packs) {
    try {
      const extractedDir = await downloadPack(pack);
      const files = await walk(extractedDir);
      extractedPacks.set(pack.id, { pack, extractedDir, files });
      sourceStatus.push({ id: pack.id, name: pack.name, source: pack.source, license: pack.license, status: 'ready', files: files.length });
    } catch (error) {
      console.warn(String(error));
      sourceStatus.push({ id: pack.id, name: pack.name, source: pack.source, license: pack.license, status: 'failed', error: String(error) });
    }
  }

  const models = {};
  const characters = {};
  const missing = [];

  for (const target of targets) {
    const packData = extractedPacks.get(target.pack);
    if (!packData) {
      missing.push({ id: target.id, reason: `pack ${target.pack} unavailable` });
      continue;
    }

    const candidate = selectCandidate(packData.files, target);
    if (!candidate) {
      missing.push({ id: target.id, reason: 'no matching glTF/glb candidate found' });
      continue;
    }

    const targetDir = path.join(modelsRoot, target.id);
    const modelFile = await copyModel(candidate.file, targetDir);
    models[target.id] = {
      file: `assets/quaternius/models/${target.id}/${modelFile}`,
      targetSize: target.size,
      sourcePack: packData.pack.name,
      sourceFile: path.relative(packData.extractedDir, candidate.file).replaceAll('\\', '/'),
      score: candidate.score,
    };
  }

  for (const target of characterTargets) {
    const packData = extractedPacks.get(target.pack);
    if (!packData) {
      missing.push({ id: target.id, reason: `character pack ${target.pack} unavailable` });
      continue;
    }

    const candidate = selectCandidate(packData.files, target, { glbOnly: true, acceptAny: true });
    if (!candidate) {
      missing.push({ id: target.id, reason: 'no animated GLB candidate found' });
      continue;
    }

    const targetDir = path.join(charactersRoot, target.id);
    const modelFile = await copyModel(candidate.file, targetDir);
    characters[target.id] = {
      file: `assets/quaternius/characters/${target.id}/${modelFile}`,
      targetHeight: target.targetHeight,
      compatibleRig: target.compatibleRig,
      sourcePack: packData.pack.name,
      sourceFile: path.relative(packData.extractedDir, candidate.file).replaceAll('\\', '/'),
      score: candidate.score,
      animationPolicy: 'runtime-discovery',
    };
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    license: 'CC0-1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    usage: 'Free for personal, educational and commercial use.',
    sources: sourceStatus,
    models,
    characters,
    missing,
  };

  await writeFile(path.join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
  await writeFile(path.join(outputRoot, 'LICENSES.md'), `# Quaternius assets\n\nAll generated assets in this directory originate from Quaternius packs marked **CC0 1.0 Universal**.\n\n- Universal Animation Library: https://store.godotengine.org/asset/quaternius/universal-animation-library/\n- Medieval Village MegaKit: https://store.godotengine.org/asset/quaternius/medieval-village-megakit/\n- Fantasy Props MegaKit: https://store.godotengine.org/asset/quaternius/fantasy-props-megakit/\n- Stylized Nature MegaKit: https://store.godotengine.org/asset/quaternius/stylized-nature-megakit/\n- License: https://creativecommons.org/publicdomain/zero/1.0/\n\nThe generated files are build artifacts and are recreated by scripts/install-quaternius-assets.mjs.\n`, 'utf-8');

  console.log(`[quaternius] Generated ${Object.keys(models).length} environment models and ${Object.keys(characters).length} animated humanoid asset(s) in ${path.relative(projectRoot, outputRoot)}`);
  if (missing.length > 0) console.warn(`[quaternius] Missing ${missing.length} target asset(s). Procedural fallback will be used for those entries.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
