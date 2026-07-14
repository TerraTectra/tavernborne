import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/three/AssetHeroBody3D.tsx';
const source = readFileSync(path, 'utf8');
const from = "    position?: { x: number; y: number };\n    bubble?: string;";
const to = "    position?: { x: number; y: number };\n    bubble?: string;\n    sceneId?: string;";
if (!source.includes(from)) throw new Error('Expected 3D actor type fragment not found');
writeFileSync(path, source.replace(from, to), 'utf8');
