import { readFileSync, rmSync, writeFileSync } from 'node:fs';

const path = 'src/simulation/procedural-motion.ts';
let source = readFileSync(path, 'utf8');
const replacements = [
  [
    "const frameIndex = isActive ? Math.abs(world.tick + hero.id.length) % trajectory.length : 0;",
    "const frameIndex = isActive ? Math.abs(world.tick) % trajectory.length : 0;",
  ],
  [
    "const severe = current.balanceMargin < -0.1 || current.fallRisk >= 82;",
    "const severe = current.balanceMargin < -0.18 && current.fallRisk >= 90;",
  ],
  [
    "const unstable = isActive && (current.balanceMargin < 0 || current.stability < 24 || current.fallRisk >= 66);",
    "const unstable = isActive && (current.balanceMargin < -0.02 || current.stability < 22 || current.fallRisk >= 72);",
  ],
];

for (const [from, to] of replacements) {
  if (!source.includes(from)) throw new Error(`Expected calibration fragment not found: ${from}`);
  source = source.replace(from, to);
}

writeFileSync(path, source, 'utf8');
rmSync('scripts/calibrate-procedural-motion.mjs');
rmSync('.github/workflows/calibrate-procedural-motion.yml');
