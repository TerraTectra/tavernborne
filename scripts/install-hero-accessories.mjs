import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packRoot = path.join(projectRoot, '.asset-cache', 'quaternius', 'fantasy-props-megakit');
const outputRoot = path.join(projectRoot, 'public', 'assets', 'quaternius');
const modelsRoot = path.join(outputRoot, 'models');
const manifestPath = path.join(outputRoot, 'manifest.json');

const targets = [
  { id: 'heroSword', keywords: ['sword'], negative: ['rack', 'sign', 'icon', 'shield'], targetSize: 0.82 },
  { id: 'heroSpear', keywords: ['spear', 'lance'], negative: ['rack', 'sign', 'icon'], targetSize: 1.25 },
  { id: 'heroStaff', keywords: ['staff', 'wand', 'rod'], negative: ['table', 'chair', 'sign', 'icon'], targetSize: 1.25 },
  { id: 'spellbook', keywords: ['book', 'tome', 'grimoire'], negative: ['shelf', 'bookcase', 'table', 'sign'], targetSize: 0.22 },
];

const normalize = (value) => value.toLowerCase().replaceAll('\\', '/');

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

function scoreCandidate(filePath, target) {
  const extension = path.extname(filePath).toLowerCase();
  if (!['.gltf', '.glb'].includes(extension)) return Number.NEGATIVE_INFINITY;
  const text = normalize(filePath);
  const basename = normalize(path.basename(filePath, extension));
  let score = extension === '.glb' ? 16 : 10;
  if (text.includes('/gltf/') || text.includes('/glb/')) score += 5;
  if (text.includes('/models/')) score += 3;
  for (const keyword of target.keywords) {
    if (basename === keyword) score += 40;
    else if (basename.includes(keyword)) score += 22;
    else if (text.includes(keyword)) score += 7;
  }
  for (const negative of target.negative) {
    if (basename.includes(negative)) score -= 35;
    else if (text.includes(negative)) score -= 10;
  }
  if (/lod|preview|sample/.test(basename)) score -= 18;
  return score;
}

function selectCandidate(files, target) {
  const ranked = files
    .map((file) => ({ file, score: scoreCandidate(file, target) }))
    .filter((candidate) => Number.isFinite(candidate.score))
    .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file));
  return ranked[0]?.score > 15 ? ranked[0] : null;
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
  const extension = path.extname(sourceFile).toLowerCase();
  if (extension === '.glb') {
    await copyFile(sourceFile, path.join(targetDir, 'model.glb'));
    return 'model.glb';
  }
  const sourceDir = path.dirname(sourceFile);
  const targetModel = path.join(targetDir, 'model.gltf');
  const json = JSON.parse(await readFile(sourceFile, 'utf-8'));
  await writeFile(targetModel, `${JSON.stringify(json, null, 2)}\n`, 'utf-8');
  for (const buffer of json.buffers ?? []) await copyDependency(sourceDir, targetDir, buffer.uri);
  for (const image of json.images ?? []) await copyDependency(sourceDir, targetDir, image.uri);
  return 'model.gltf';
}

async function main() {
  if (!(await exists(manifestPath))) throw new Error('[hero-accessories] Quaternius manifest is missing; run assets:install:quaternius first.');
  if (!(await exists(packRoot))) throw new Error('[hero-accessories] Fantasy Props MegaKit cache is missing.');

  const files = await walk(packRoot);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
  manifest.models ??= {};
  manifest.heroAccessories = { version: 1, sourcePack: 'Fantasy Props MegaKit', license: 'CC0-1.0', entries: [] };

  const missing = [];
  for (const target of targets) {
    const candidate = selectCandidate(files, target);
    if (!candidate) {
      missing.push(target.id);
      continue;
    }
    const targetDir = path.join(modelsRoot, target.id);
    const modelFile = await copyModel(candidate.file, targetDir);
    const entry = {
      file: `assets/quaternius/models/${target.id}/${modelFile}`,
      targetSize: target.targetSize,
      sourcePack: 'Fantasy Props MegaKit',
      sourceFile: path.relative(packRoot, candidate.file).replaceAll('\\', '/'),
      score: candidate.score,
      purpose: 'hero-accessory',
    };
    manifest.models[target.id] = entry;
    manifest.heroAccessories.entries.push({ id: target.id, ...entry });
    console.log(`[hero-accessories] ${target.id}: ${entry.sourceFile} (score ${entry.score})`);
  }

  manifest.heroAccessories.missing = missing;
  manifest.heroAccessories.ready = manifest.heroAccessories.entries.length;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
  if (missing.length > 0) console.warn(`[hero-accessories] Missing ${missing.join(', ')}; procedural equipment fallbacks remain available.`);
  console.log(`[hero-accessories] Prepared ${manifest.heroAccessories.entries.length}/${targets.length} modular accessory asset(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
