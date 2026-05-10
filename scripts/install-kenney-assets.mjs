import { createRequire } from 'node:module';
import { mkdir, readdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(projectRoot, 'public', 'assets', 'kenney-hex', 'scene');

const aliases = [
  'ground_01.png',
  'ground_02.png',
  'ground_03.png',
  'road_01.png',
  'road_02.png',
  'tavern.png',
  'blacksmith.png',
  'armory.png',
  'guild.png',
  'market.png',
  'shrine.png',
  'dungeon_gate.png',
  'tree_01.png',
  'tree_02.png',
  'rock_01.png',
  'lamp_01.png'
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.png') && !entry.name.toLowerCase().includes('preview') && !entry.name.toLowerCase().includes('sample')) {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  let packageRoot;
  try {
    packageRoot = path.dirname(require.resolve('kenney-hexagon-pack/package.json'));
  } catch {
    console.warn('[assets] kenney-hexagon-pack is not installed yet. Run npm install.');
    return;
  }

  const assetRoot = path.join(packageRoot, 'assets');
  const sourceFiles = (await walk(assetRoot)).sort((a, b) => a.localeCompare(b));

  if (sourceFiles.length === 0) {
    throw new Error(`[assets] No PNG assets found in ${assetRoot}`);
  }

  await mkdir(outputDir, { recursive: true });

  const manifest = [];
  for (let index = 0; index < aliases.length; index += 1) {
    const source = sourceFiles[index % sourceFiles.length];
    const targetName = aliases[index];
    const target = path.join(outputDir, targetName);
    await copyFile(source, target);
    manifest.push({ name: targetName, source: path.relative(projectRoot, source).replaceAll('\\\\', '/') });
  }

  await writeFile(
    path.join(outputDir, 'manifest.json'),
    `${JSON.stringify({ sourcePackage: 'kenney-hexagon-pack', license: 'CC0-1.0', generatedAt: new Date().toISOString(), files: manifest }, null, 2)}\n`,
    'utf-8',
  );

  console.log(`[assets] Copied ${aliases.length} Kenney CC0 scene assets to ${path.relative(projectRoot, outputDir)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
