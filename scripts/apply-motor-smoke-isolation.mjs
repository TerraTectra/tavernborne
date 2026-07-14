import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/body-affinity-motor-memory-smoke.mjs';
const source = readFileSync(path, 'utf8');
const from = `const trainBlock = async (hours) => {\n  await configureTraining();\n  for (let index = 0; index < hours; index += 1) await advanceHour();\n};`;
const to = `const trainBlock = async (hours) => {\n  for (let index = 0; index < hours; index += 1) {\n    await configureTraining();\n    await advanceHour();\n  }\n};`;
if (!source.includes(from)) throw new Error('Expected trainBlock fragment not found');
writeFileSync(path, source.replace(from, to), 'utf8');
