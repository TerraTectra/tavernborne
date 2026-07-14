import { readFileSync, writeFileSync } from 'node:fs';

const replaceExact = (path, from, to) => {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(from)) throw new Error(`Expected fragment not found in ${path}: ${from.slice(0, 120)}`);
  writeFileSync(path, source.replace(from, to), 'utf8');
};

replaceExact(
  'src/simulation/physical-body.ts',
  "import type { ActionId, Hero, WorldState } from './model';\n",
  "import type { ActionId, Hero, WorldState } from './model';\nimport {\n  advanceMotorLearning,\n  bestMotorPatterns,\n  cloneBodyAffinity,\n  cloneMotorMemory,\n  createBodyAffinity,\n  createMotorMemory,\n  hydrateBodyAffinity,\n  hydrateMotorMemory,\n  topMovementAffinities,\n} from './motor-learning';\n",
);

replaceExact(
  'src/simulation/physical-body.ts',
  `  const boneDensity = clamp(62 * (profile.boneDensityBias ?? 1), 35, 95);\n  return {\n    version: 1,\n    anthropometry,\n    tissues: {\n      muscleTone: 52,\n      muscleFatigue: 8,\n      muscleCondition: 68,\n      tendonCondition: 72,\n      boneDensity,\n      flexibility,\n      hydration: 76,\n    },\n    nervous: {\n      coordination,\n      balance: clamp(coordination + 4),\n      proprioception: clamp(coordination + 2),\n      motorLearning: clamp(45 + coordination * 0.28),\n      reflexQuality: clamp(42 + coordination * 0.32),\n      reactionTimeMs: round(285 - coordination * 0.9, 1),\n    },`,
  `  const boneDensity = clamp(62 * (profile.boneDensityBias ?? 1), 35, 95);\n  const tissues = {\n    muscleTone: 52,\n    muscleFatigue: 8,\n    muscleCondition: 68,\n    tendonCondition: 72,\n    boneDensity,\n    flexibility,\n    hydration: 76,\n  };\n  const nervous = {\n    coordination,\n    balance: clamp(coordination + 4),\n    proprioception: clamp(coordination + 2),\n    motorLearning: clamp(45 + coordination * 0.28),\n    reflexQuality: clamp(42 + coordination * 0.32),\n    reactionTimeMs: round(285 - coordination * 0.9, 1),\n  };\n  return {\n    version: 1,\n    anthropometry,\n    tissues,\n    nervous,`,
);

replaceExact(
  'src/simulation/physical-body.ts',
  `    limits: {\n      maxJointSpeedDegS: round(390 + coordination * 2.6),\n      maxLimbSpeedMS: round(5.6 + coordination * 0.035),\n      safeAccelerationG: round(2.1 + boneDensity * 0.025),\n      physicalSpeedCeiling: round(62 + coordination * 0.3),\n      forceTransferEfficiency: round(44 + coordination * 0.38),\n    },\n    segments: buildSegments(anthropometry),`,
  `    limits: {\n      maxJointSpeedDegS: round(390 + coordination * 2.6),\n      maxLimbSpeedMS: round(5.6 + coordination * 0.035),\n      safeAccelerationG: round(2.1 + boneDensity * 0.025),\n      physicalSpeedCeiling: round(62 + coordination * 0.3),\n      forceTransferEfficiency: round(44 + coordination * 0.38),\n    },\n    affinity: createBodyAffinity(profile, anthropometry, tissues, nervous),\n    motorMemory: createMotorMemory(),\n    segments: buildSegments(anthropometry),`,
);

replaceExact(
  'src/simulation/physical-body.ts',
  `  limits: { ...body.limits },\n  segments:`,
  `  limits: { ...body.limits },\n  affinity: cloneBodyAffinity(body.affinity),\n  motorMemory: cloneMotorMemory(body.motorMemory),\n  segments:`,
);

replaceExact(
  'src/simulation/physical-body.ts',
  `    limits: { ...fallback.limits, ...(saved.limits ?? {}) },\n    segments:`,
  `    limits: { ...fallback.limits, ...(saved.limits ?? {}) },\n    affinity: hydrateBodyAffinity(saved.affinity, fallback.affinity),\n    motorMemory: hydrateMotorMemory(saved.motorMemory, fallback.motorMemory),\n    segments:`,
);

replaceExact(
  'src/simulation/physical-body.ts',
  `    if (actionId === 'train') {\n      const stimulus = clamp((hero.stats.strength + hero.stats.endurance + hero.stats.dexterity) / 90, 0.45, 2.2);`,
  `    if (actionId === 'train') {\n      const stimulus = clamp((hero.stats.strength + hero.stats.endurance + hero.stats.dexterity) / 90, 0.45, 2.2);`,
);

replaceExact(
  'src/simulation/physical-body.ts',
  `    body.nervous.reactionTimeMs = round(clamp(`,
  `    advanceMotorLearning(world, hero, actionId, hours);\n\n    body.nervous.reactionTimeMs = round(clamp(`,
);

replaceExact(
  'src/simulation/physical-body.ts',
  `  painfulSegments: segmentIds.filter((id) => hero.body.segments[id].pain >= 12),\n});`,
  `  painfulSegments: segmentIds.filter((id) => hero.body.segments[id].pain >= 12),\n  affinities: topMovementAffinities(hero.body, 3),\n  motorPatterns: bestMotorPatterns(hero.body, 3),\n  motorAttempts: hero.body.motorMemory.totalAttempts,\n  motorSuccesses: hero.body.motorMemory.successfulAttempts,\n  motorSchools: hero.body.motorMemory.schools,\n});`,
);

replaceExact(
  'src/simulation/index.ts',
  "export * from './physical-body';\n",
  "export * from './physical-body';\nexport * from './motor-learning';\n",
);

replaceExact(
  'src/simulation/seed.ts',
  `      coordinationBias: 1.06, boneDensityBias: 1.02,`,
  `      coordinationBias: 1.06, boneDensityBias: 1.02, enduranceBias: 1.08, recoveryBias: 1.12,\n      precisionBias: 1.08, adaptabilityBias: 1.08, stabilityBias: 1.02,`,
);
replaceExact(
  'src/simulation/seed.ts',
  `      coordinationBias: 1.02, boneDensityBias: 1.12,`,
  `      coordinationBias: 1.02, boneDensityBias: 1.12, powerBias: 1.18, stabilityBias: 1.15,\n      enduranceBias: 1.06, mobilityBias: 0.88, precisionBias: 0.93, adaptabilityBias: 0.92, accelerationBias: 1.03,`,
);
replaceExact(
  'src/simulation/seed.ts',
  `      coordinationBias: 1.1, boneDensityBias: 0.96,`,
  `      coordinationBias: 1.1, boneDensityBias: 0.96, mobilityBias: 1.16, precisionBias: 1.16,\n      adaptabilityBias: 1.22, recoveryBias: 1.08, accelerationBias: 1.1, powerBias: 0.78, stabilityBias: 0.88, enduranceBias: 0.94,`,
);

replaceExact(
  'src/simulation/motor-learning.ts',
  "        sourceEventType: 'training',",
  "        sourceEventType: 'action',",
);
