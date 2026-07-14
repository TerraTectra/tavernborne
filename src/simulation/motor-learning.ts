import type { ActionId, Hero, WorldState } from './model';
import type {
  AnthropometryState,
  BodyAffinityState,
  BodySide,
  BodyTissueState,
  MotorMemoryState,
  MotorPatternParameters,
  MotorPatternPurpose,
  MotorPatternState,
  MotorSchoolArchetype,
  MotorSchoolState,
  MovementAffinityState,
  MovementAvailability,
  MovementFamily,
  NervousBodyState,
  PhysicalBodyProfile,
  PhysicalBodyState,
} from './body-model';

const clamp = (value: number, min = 0, max = 100): number => Math.max(min, Math.min(max, value));
const round = (value: number, digits = 3): number => Number(value.toFixed(digits));
const average = (values: number[]): number => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export const movementFamilies: MovementFamily[] = [
  'drivingStrike',
  'reachThrust',
  'mobileEvasion',
  'grapplingControl',
  'flowingTransition',
  'rootedGuard',
  'enduranceFootwork',
  'fineManipulation',
];

export const movementFamilyLabels: Record<MovementFamily, string> = {
  drivingStrike: 'силовой импульс',
  reachThrust: 'точная дальняя линия',
  mobileEvasion: 'подвижное уклонение',
  grapplingControl: 'захват и контроль',
  flowingTransition: 'текучий переход',
  rootedGuard: 'устойчивая защита',
  enduranceFootwork: 'выносливая работа ног',
  fineManipulation: 'тонкая моторика',
};

export const movementAvailabilityLabels: Record<MovementAvailability, string> = {
  natural: 'природная',
  difficult: 'трудная',
  restricted: 'ограниченная',
};

const purposeForFamily: Record<MovementFamily, MotorPatternPurpose> = {
  drivingStrike: 'attack',
  reachThrust: 'precision',
  mobileEvasion: 'mobility',
  grapplingControl: 'control',
  flowingTransition: 'mobility',
  rootedGuard: 'defense',
  enduranceFootwork: 'mobility',
  fineManipulation: 'precision',
};

const familyArchetype: Record<MovementFamily, MotorSchoolArchetype> = {
  drivingStrike: 'force',
  reachThrust: 'precision',
  mobileEvasion: 'mobility',
  grapplingControl: 'force',
  flowingTransition: 'mobility',
  rootedGuard: 'force',
  enduranceFootwork: 'mobility',
  fineManipulation: 'precision',
};

const archetypeFamilies: Record<MotorSchoolArchetype, MovementFamily[]> = {
  force: ['drivingStrike', 'grapplingControl', 'rootedGuard'],
  mobility: ['mobileEvasion', 'flowingTransition', 'enduranceFootwork'],
  precision: ['reachThrust', 'fineManipulation', 'flowingTransition'],
};

const deterministicUnit = (seed: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
};

const biased = (base: number, bias = 1): number => clamp(base * bias);

const availabilityFor = (aptitude: number): MovementAvailability => {
  if (aptitude >= 62) return 'natural';
  if (aptitude >= 35) return 'difficult';
  return 'restricted';
};

const movementAffinity = (
  family: MovementFamily,
  aptitude: number,
  adaptability: number,
  recovery: number,
  stability: number,
): MovementAffinityState => {
  const normalized = clamp(aptitude);
  return {
    family,
    aptitude: round(normalized, 2),
    learningRate: round(clamp(0.35 + normalized / 115 + adaptability / 240, 0.35, 1.65), 3),
    masteryCeiling: round(clamp(30 + normalized * 0.72 + adaptability * 0.08, 28, 99), 2),
    strainRisk: round(clamp(72 - normalized * 0.56 + (100 - recovery) * 0.17 + (100 - stability) * 0.12), 2),
    availability: availabilityFor(normalized),
  };
};

export const createBodyAffinity = (
  profile: PhysicalBodyProfile,
  anthropometry: AnthropometryState,
  tissues: BodyTissueState,
  nervous: NervousBodyState,
): BodyAffinityState => {
  const frameMass = clamp(50 + (anthropometry.massKg - anthropometry.heightCm * 0.38) * 2.4);
  const muscleRatio = clamp(35 + anthropometry.muscleMassKg / anthropometry.massKg * 85);
  const reach = clamp(50 + (anthropometry.armSpanCm / anthropometry.heightCm - 1) * 500);
  const leg = clamp(50 + (anthropometry.legLengthCm / anthropometry.heightCm - 0.515) * 800);
  const shoulder = clamp(50 + (anthropometry.shoulderWidthCm / anthropometry.heightCm - 0.245) * 800);
  const hip = clamp(50 + (anthropometry.hipWidthCm / anthropometry.heightCm - 0.175) * 900);
  const lightness = clamp(100 - frameMass * 0.75);

  const power = biased(frameMass * 0.32 + muscleRatio * 0.34 + tissues.boneDensity * 0.18 + shoulder * 0.16, profile.powerBias);
  const acceleration = biased(lightness * 0.22 + nervous.coordination * 0.33 + tissues.tendonCondition * 0.2 + leg * 0.15 + nervous.reflexQuality * 0.1, profile.accelerationBias);
  const mobility = biased(tissues.flexibility * 0.34 + nervous.coordination * 0.24 + leg * 0.18 + lightness * 0.14 + nervous.proprioception * 0.1, profile.mobilityBias);
  const stability = biased(frameMass * 0.22 + hip * 0.2 + nervous.balance * 0.28 + tissues.boneDensity * 0.18 + shoulder * 0.12, profile.stabilityBias);
  const endurance = biased(tissues.muscleCondition * 0.28 + tissues.tendonCondition * 0.22 + nervous.proprioception * 0.12 + leg * 0.18 + (100 - anthropometry.bodyFatPercent) * 0.2, profile.enduranceBias);
  const recovery = biased(tissues.hydration * 0.22 + tissues.muscleCondition * 0.24 + tissues.tendonCondition * 0.2 + nervous.motorLearning * 0.16 + (100 - anthropometry.bodyFatPercent) * 0.18, profile.recoveryBias);
  const precision = biased(nervous.coordination * 0.34 + nervous.proprioception * 0.25 + nervous.reflexQuality * 0.18 + reach * 0.1 + tissues.flexibility * 0.13, profile.precisionBias);
  const adaptability = biased(nervous.motorLearning * 0.34 + nervous.coordination * 0.24 + tissues.flexibility * 0.2 + nervous.proprioception * 0.12 + recovery * 0.1, profile.adaptabilityBias);

  const scores: Record<MovementFamily, number> = {
    drivingStrike: power * 0.4 + stability * 0.2 + acceleration * 0.15 + precision * 0.1 + endurance * 0.15,
    reachThrust: reach * 0.3 + precision * 0.3 + stability * 0.15 + acceleration * 0.13 + adaptability * 0.12,
    mobileEvasion: mobility * 0.35 + acceleration * 0.25 + precision * 0.18 + adaptability * 0.12 + endurance * 0.1,
    grapplingControl: power * 0.28 + stability * 0.3 + precision * 0.14 + endurance * 0.18 + adaptability * 0.1,
    flowingTransition: mobility * 0.3 + adaptability * 0.3 + precision * 0.24 + recovery * 0.16,
    rootedGuard: stability * 0.42 + power * 0.2 + endurance * 0.2 + precision * 0.1 + recovery * 0.08,
    enduranceFootwork: endurance * 0.3 + mobility * 0.22 + recovery * 0.22 + acceleration * 0.16 + precision * 0.1,
    fineManipulation: precision * 0.42 + adaptability * 0.3 + mobility * 0.12 + recovery * 0.08 + acceleration * 0.08,
  };

  return {
    power: round(power, 2),
    acceleration: round(acceleration, 2),
    mobility: round(mobility, 2),
    stability: round(stability, 2),
    endurance: round(endurance, 2),
    recovery: round(recovery, 2),
    precision: round(precision, 2),
    adaptability: round(adaptability, 2),
    movement: Object.fromEntries(movementFamilies.map((family) => [
      family,
      movementAffinity(family, scores[family], adaptability, recovery, stability),
    ])) as Record<MovementFamily, MovementAffinityState>,
  };
};

export const createMotorMemory = (): MotorMemoryState => ({
  nextPatternId: 1,
  nextSchoolId: 1,
  patterns: [],
  schools: [],
  totalAttempts: 0,
  successfulAttempts: 0,
});

export const cloneBodyAffinity = (affinity: BodyAffinityState): BodyAffinityState => ({
  ...affinity,
  movement: Object.fromEntries(movementFamilies.map((family) => [family, { ...affinity.movement[family] }])) as BodyAffinityState['movement'],
});

export const cloneMotorMemory = (memory: MotorMemoryState): MotorMemoryState => ({
  ...memory,
  patterns: memory.patterns.map((pattern) => ({ ...pattern, parameters: { ...pattern.parameters } })),
  schools: memory.schools.map((school) => ({
    ...school,
    familyIds: [...school.familyIds],
    patternIds: [...school.patternIds],
    signature: { ...school.signature },
  })),
});

export const hydrateBodyAffinity = (
  saved: Partial<BodyAffinityState> | undefined,
  fallback: BodyAffinityState,
): BodyAffinityState => ({
  ...fallback,
  ...(saved ?? {}),
  movement: Object.fromEntries(movementFamilies.map((family) => [family, {
    ...fallback.movement[family],
    ...(saved?.movement?.[family] ?? {}),
    family,
  }])) as BodyAffinityState['movement'],
});

export const hydrateMotorMemory = (
  saved: Partial<MotorMemoryState> | undefined,
  fallback: MotorMemoryState,
): MotorMemoryState => ({
  ...fallback,
  ...(saved ?? {}),
  nextPatternId: Number.isFinite(saved?.nextPatternId) ? Number(saved?.nextPatternId) : fallback.nextPatternId,
  nextSchoolId: Number.isFinite(saved?.nextSchoolId) ? Number(saved?.nextSchoolId) : fallback.nextSchoolId,
  patterns: Array.isArray(saved?.patterns)
    ? saved.patterns.map((pattern) => ({ ...pattern, parameters: { ...pattern.parameters } })) as MotorPatternState[]
    : [],
  schools: Array.isArray(saved?.schools)
    ? saved.schools.map((school) => ({
      ...school,
      familyIds: [...school.familyIds],
      patternIds: [...school.patternIds],
      signature: { ...school.signature },
    })) as MotorSchoolState[]
    : [],
});

const familyFromLabel = (label: string): MovementFamily | undefined => {
  const value = label.toLocaleLowerCase('ru-RU');
  if (/(сил|тяж|удар|мощ)/u.test(value)) return 'drivingStrike';
  if (/(копь|укол|дистанц|дальн|линия)/u.test(value)) return 'reachThrust';
  if (/(уклон|скорост|подвиж|рывок)/u.test(value)) return 'mobileEvasion';
  if (/(захват|борьб|бросок|контрол)/u.test(value)) return 'grapplingControl';
  if (/(плавн|текуч|переход|посох|координац)/u.test(value)) return 'flowingTransition';
  if (/(стойк|защит|блок|баланс|опор)/u.test(value)) return 'rootedGuard';
  if (/(вынослив|бег|ног|марш)/u.test(value)) return 'enduranceFootwork';
  if (/(точн|кисть|жест|тонк|манипуляц)/u.test(value)) return 'fineManipulation';
  return undefined;
};

const preferredInventoryFamilies = (hero: Hero): MovementFamily[] => {
  const ids = hero.inventory.map((item) => `${item.id} ${item.name}`.toLocaleLowerCase('ru-RU')).join(' ');
  const result: MovementFamily[] = [];
  if (/(spear|копь)/u.test(ids)) result.push('reachThrust', 'rootedGuard');
  if (/(sword|меч)/u.test(ids)) result.push('drivingStrike', 'rootedGuard');
  if (/(staff|посох)/u.test(ids)) result.push('flowingTransition', 'reachThrust', 'fineManipulation');
  return result;
};

const chooseFamily = (world: WorldState, hero: Hero, attemptIndex: number): MovementFamily => {
  const explicit = familyFromLabel(hero.currentActivity?.label ?? hero.currentAction?.label ?? '');
  if (explicit) return explicit;
  const ranked = [...movementFamilies].sort((left, right) =>
    hero.body.affinity.movement[right].aptitude - hero.body.affinity.movement[left].aptitude);
  const inventory = preferredInventoryFamilies(hero);
  const candidates = [...new Set([...inventory, ...ranked.slice(0, 4)])];
  const exploration = deterministicUnit(`${world.seed}:${world.tick}:${hero.id}:${attemptIndex}:family`);
  if (exploration > 0.88) return ranked[ranked.length - 1 - Math.floor(exploration * 3) % 2];
  return candidates[Math.floor(exploration * candidates.length) % candidates.length] ?? ranked[0];
};

const baseParameters = (body: PhysicalBodyState, family: MovementFamily, seed: string): MotorPatternParameters => {
  const r1 = deterministicUnit(`${seed}:stance`);
  const r2 = deterministicUnit(`${seed}:weight`);
  const r3 = deterministicUnit(`${seed}:hip`);
  const r4 = deterministicUnit(`${seed}:reach`);
  const r5 = deterministicUnit(`${seed}:tempo`);
  const r6 = deterministicUnit(`${seed}:force`);
  const r7 = deterministicUnit(`${seed}:recovery`);
  const stable = body.affinity.stability / 100;
  const mobile = body.affinity.mobility / 100;
  const precise = body.affinity.precision / 100;
  return {
    stanceWidthRatio: round(clamp(0.85 + stable * 0.55 + (r1 - 0.5) * 0.3, 0.7, 1.75), 3),
    weightTransfer: round(clamp(0.3 + stable * 0.22 + mobile * 0.16 + r2 * 0.28, 0.2, 0.95), 3),
    hipRotationDeg: round(clamp(8 + body.affinity.power * 0.44 + r3 * 32, 5, 92), 2),
    reachExtension: round(clamp(0.42 + precise * 0.28 + r4 * 0.28, 0.35, 1), 3),
    tempo: round(clamp(0.28 + body.affinity.acceleration / 180 + r5 * 0.32, 0.2, 1), 3),
    forceCommitment: round(clamp(0.22 + body.affinity.power / 155 + r6 * 0.25, 0.2, 1), 3),
    recoveryPriority: round(clamp(0.34 + body.affinity.recovery / 190 + r7 * 0.25, 0.25, 1), 3),
  };
};

const mutateParameters = (
  source: MotorPatternParameters,
  seed: string,
  scale: number,
): MotorPatternParameters => {
  const mutation = (id: string) => (deterministicUnit(`${seed}:${id}`) - 0.5) * scale;
  return {
    stanceWidthRatio: round(clamp(source.stanceWidthRatio + mutation('stance'), 0.7, 1.75), 3),
    weightTransfer: round(clamp(source.weightTransfer + mutation('weight'), 0.2, 0.95), 3),
    hipRotationDeg: round(clamp(source.hipRotationDeg + mutation('hip') * 60, 5, 92), 2),
    reachExtension: round(clamp(source.reachExtension + mutation('reach'), 0.35, 1), 3),
    tempo: round(clamp(source.tempo + mutation('tempo'), 0.2, 1), 3),
    forceCommitment: round(clamp(source.forceCommitment + mutation('force'), 0.2, 1), 3),
    recoveryPriority: round(clamp(source.recoveryPriority + mutation('recovery'), 0.25, 1), 3),
  };
};

const parameterDistance = (left: MotorPatternParameters, right: MotorPatternParameters): number => average([
  Math.abs(left.stanceWidthRatio - right.stanceWidthRatio) / 1.05,
  Math.abs(left.weightTransfer - right.weightTransfer) / 0.75,
  Math.abs(left.hipRotationDeg - right.hipRotationDeg) / 87,
  Math.abs(left.reachExtension - right.reachExtension) / 0.65,
  Math.abs(left.tempo - right.tempo) / 0.8,
  Math.abs(left.forceCommitment - right.forceCommitment) / 0.8,
  Math.abs(left.recoveryPriority - right.recoveryPriority) / 0.75,
]);

const patternName = (family: MovementFamily, parameters: MotorPatternParameters): string => {
  const qualifier = parameters.recoveryPriority >= 0.72
    ? 'возвратный'
    : parameters.forceCommitment >= 0.72
      ? 'решительный'
      : parameters.tempo >= 0.68
        ? 'быстрый'
        : parameters.stanceWidthRatio >= 1.35
          ? 'широкий'
          : 'собранный';
  return `${qualifier} ${movementFamilyLabels[family]}`;
};

const dominantSideFor = (hero: Hero, seed: string): BodySide => {
  const leftPain = hero.body.segments.leftHand.pain + hero.body.segments.leftFoot.pain;
  const rightPain = hero.body.segments.rightHand.pain + hero.body.segments.rightFoot.pain;
  if (leftPain + 4 < rightPain) return 'left';
  if (rightPain + 4 < leftPain) return 'right';
  return deterministicUnit(`${seed}:side`) >= 0.5 ? 'right' : 'left';
};

const matchingPattern = (
  memory: MotorMemoryState,
  family: MovementFamily,
  parameters: MotorPatternParameters,
): MotorPatternState | undefined => memory.patterns
  .filter((pattern) => pattern.family === family)
  .map((pattern) => ({ pattern, distance: parameterDistance(pattern.parameters, parameters) }))
  .sort((left, right) => left.distance - right.distance)[0]
  ?.pattern;

const selectRememberedPattern = (
  world: WorldState,
  hero: Hero,
  family: MovementFamily,
  attemptIndex: number,
): MotorPatternState | undefined => {
  const patterns = hero.body.motorMemory.patterns.filter((pattern) => pattern.family === family);
  if (!patterns.length) return undefined;
  const ranked = [...patterns].sort((left, right) =>
    (right.mastery * 0.4 + right.reliability * 0.28 + right.bestQuality * 0.22 + right.efficiency * 0.1)
    - (left.mastery * 0.4 + left.reliability * 0.28 + left.bestQuality * 0.22 + left.efficiency * 0.1));
  const roll = deterministicUnit(`${world.seed}:${world.tick}:${hero.id}:${attemptIndex}:recall`);
  if (roll < 0.72) return ranked[0];
  return ranked[Math.floor(roll * ranked.length) % ranked.length];
};

const painLoad = (hero: Hero): number => average(Object.values(hero.body.segments).map((segment) => segment.pain));

const qualityForAttempt = (
  world: WorldState,
  hero: Hero,
  family: MovementFamily,
  parameters: MotorPatternParameters,
  remembered: MotorPatternState | undefined,
  attemptIndex: number,
): number => {
  const affinity = hero.body.affinity.movement[family];
  const statScore = clamp((hero.stats.strength + hero.stats.endurance + hero.stats.dexterity + hero.stats.perception) * 0.58);
  const readiness = clamp(
    (100 - hero.body.tissues.muscleFatigue) * 0.34
    + hero.body.pose.stability * 0.28
    + hero.body.nervous.coordination * 0.22
    + (100 - painLoad(hero)) * 0.16,
  );
  const temperament = clamp(
    hero.traits.discipline * 0.32
    + hero.traits.curiosity * 0.27
    + hero.traits.patience * 0.16
    + hero.traits.courage * 0.13
    + (100 - hero.traits.impulsiveness) * 0.12,
  );
  const experience = remembered ? remembered.mastery * 0.32 + remembered.reliability * 0.18 : 0;
  const extremeCost = clamp(
    Math.max(0, parameters.forceCommitment - 0.78) * 48
    + Math.max(0, parameters.tempo - 0.82) * 42
    + Math.max(0, 0.34 - parameters.recoveryPriority) * 48,
    0,
    25,
  );
  const mismatch = affinity.availability === 'restricted' ? 11 : affinity.availability === 'difficult' ? 4 : 0;
  const jitter = (deterministicUnit(`${world.seed}:${world.tick}:${hero.id}:${attemptIndex}:quality`) - 0.5) * 15;
  return round(clamp(
    affinity.aptitude * 0.42
    + statScore * 0.17
    + readiness * 0.19
    + temperament * 0.1
    + experience * 0.12
    + jitter
    - extremeCost
    - mismatch,
  ), 2);
};

const createPattern = (
  hero: Hero,
  family: MovementFamily,
  parameters: MotorPatternParameters,
  quality: number,
  tick: number,
  side: BodySide,
): MotorPatternState => {
  const memory = hero.body.motorMemory;
  const affinity = hero.body.affinity.movement[family];
  const id = `motor-${hero.id}-${memory.nextPatternId}`;
  memory.nextPatternId += 1;
  return {
    id,
    family,
    purpose: purposeForFamily[family],
    name: patternName(family, parameters),
    discoveredAt: tick,
    lastPracticedTick: tick,
    dominantSide: side,
    parameters,
    repetitions: 1,
    successes: 1,
    failures: 0,
    bestQuality: quality,
    averageQuality: quality,
    mastery: round(Math.min(affinity.masteryCeiling, affinity.learningRate * quality / 42), 3),
    reliability: round(clamp(42 + quality * 0.42), 2),
    efficiency: round(clamp(35 + quality * 0.48 + parameters.recoveryPriority * 12), 2),
    strain: round(clamp(affinity.strainRisk * parameters.forceCommitment * (1 - parameters.recoveryPriority * 0.35)), 2),
  };
};

const reinforcePattern = (
  hero: Hero,
  pattern: MotorPatternState,
  quality: number,
  success: boolean,
  parameters: MotorPatternParameters,
  tick: number,
): void => {
  const affinity = hero.body.affinity.movement[pattern.family];
  const previousAttempts = pattern.repetitions;
  pattern.repetitions += 1;
  pattern.lastPracticedTick = tick;
  if (success) pattern.successes += 1;
  else pattern.failures += 1;
  pattern.averageQuality = round((pattern.averageQuality * previousAttempts + quality) / pattern.repetitions, 2);
  pattern.bestQuality = Math.max(pattern.bestQuality, quality);
  pattern.reliability = round(clamp((pattern.successes / pattern.repetitions) * 72 + pattern.averageQuality * 0.28), 2);
  if (success) {
    const remaining = Math.max(0, affinity.masteryCeiling - pattern.mastery);
    const gain = affinity.learningRate * (quality / 100) * (0.38 + remaining / Math.max(1, affinity.masteryCeiling));
    pattern.mastery = round(Math.min(affinity.masteryCeiling, pattern.mastery + gain), 3);
    pattern.efficiency = round(clamp(pattern.efficiency + Math.max(0, quality - pattern.efficiency) * 0.055 + parameters.recoveryPriority * 0.25), 2);
    pattern.parameters = {
      stanceWidthRatio: round(pattern.parameters.stanceWidthRatio * 0.88 + parameters.stanceWidthRatio * 0.12, 3),
      weightTransfer: round(pattern.parameters.weightTransfer * 0.88 + parameters.weightTransfer * 0.12, 3),
      hipRotationDeg: round(pattern.parameters.hipRotationDeg * 0.88 + parameters.hipRotationDeg * 0.12, 2),
      reachExtension: round(pattern.parameters.reachExtension * 0.88 + parameters.reachExtension * 0.12, 3),
      tempo: round(pattern.parameters.tempo * 0.88 + parameters.tempo * 0.12, 3),
      forceCommitment: round(pattern.parameters.forceCommitment * 0.88 + parameters.forceCommitment * 0.12, 3),
      recoveryPriority: round(pattern.parameters.recoveryPriority * 0.88 + parameters.recoveryPriority * 0.12, 3),
    };
  }
  pattern.strain = round(clamp(
    pattern.strain * 0.86
    + affinity.strainRisk * parameters.forceCommitment * (1 - parameters.recoveryPriority * 0.45) * 0.14
    + (success ? 0 : 4),
  ), 2);
};

const schoolName = (hero: Hero, archetype: MotorSchoolArchetype): string => {
  if (archetype === 'force') return `${hero.name}: школа устойчивого усилия`;
  if (archetype === 'mobility') return `${hero.name}: школа текучего шага`;
  return `${hero.name}: школа точной линии`;
};

const signatureOf = (patterns: MotorPatternState[]): MotorPatternParameters => ({
  stanceWidthRatio: round(average(patterns.map((pattern) => pattern.parameters.stanceWidthRatio)), 3),
  weightTransfer: round(average(patterns.map((pattern) => pattern.parameters.weightTransfer)), 3),
  hipRotationDeg: round(average(patterns.map((pattern) => pattern.parameters.hipRotationDeg)), 2),
  reachExtension: round(average(patterns.map((pattern) => pattern.parameters.reachExtension)), 3),
  tempo: round(average(patterns.map((pattern) => pattern.parameters.tempo)), 3),
  forceCommitment: round(average(patterns.map((pattern) => pattern.parameters.forceCommitment)), 3),
  recoveryPriority: round(average(patterns.map((pattern) => pattern.parameters.recoveryPriority)), 3),
});

const updateSchools = (world: WorldState, hero: Hero): void => {
  const memory = hero.body.motorMemory;
  (Object.keys(archetypeFamilies) as MotorSchoolArchetype[]).forEach((archetype) => {
    const families = archetypeFamilies[archetype];
    const patterns = memory.patterns.filter((pattern) => families.includes(pattern.family) && pattern.successes >= 1);
    const totalSuccesses = patterns.reduce((sum, pattern) => sum + pattern.successes, 0);
    if (patterns.length < 2 || totalSuccesses < 8) return;

    let school = memory.schools.find((candidate) => candidate.archetype === archetype);
    const patternIds = patterns.map((pattern) => pattern.id);
    const familyIds = [...new Set(patterns.map((pattern) => pattern.family))];
    const maturity = round(clamp(average(patterns.map((pattern) => pattern.mastery)) * 0.72 + Math.min(30, totalSuccesses * 0.8)), 2);
    const cohesion = round(clamp(average(patterns.map((pattern) => pattern.reliability)) * 0.72 + average(patterns.map((pattern) => pattern.efficiency)) * 0.28), 2);

    if (!school) {
      school = {
        id: `motor-school-${hero.id}-${memory.nextSchoolId}`,
        name: schoolName(hero, archetype),
        archetype,
        foundedAt: world.tick,
        updatedAt: world.tick,
        familyIds,
        patternIds,
        maturity,
        cohesion,
        signature: signatureOf(patterns),
      };
      memory.nextSchoolId += 1;
      memory.schools.push(school);
      world.journal.unshift({
        id: `${world.tick}-${hero.id}-${school.id}`,
        tick: world.tick,
        text: `${hero.name} связал удачные движения в собственную систему: «${school.name}».`,
        heroIds: [hero.id],
        kind: 'event',
      });
      hero.memories.unshift({
        id: `${school.id}-memory`,
        summary: `Я начал складывать повторяемые движения в школу «${school.name}».`,
        createdAt: world.tick,
        importance: 58,
        valence: 34,
        participants: [],
        tags: ['body', 'training', 'motor-school'],
        sourceEventType: 'action',
      });
    } else {
      school.updatedAt = world.tick;
      school.familyIds = familyIds;
      school.patternIds = patternIds;
      school.maturity = maturity;
      school.cohesion = cohesion;
      school.signature = signatureOf(patterns);
    }

    patterns.forEach((pattern) => { pattern.schoolId = school?.id; });
  });
  memory.schools = memory.schools.slice(0, 6);
  hero.memories = hero.memories.slice(0, 80);
  world.journal = world.journal.slice(0, 240);
};

export interface MotorLearningResult {
  attempted: boolean;
  family?: MovementFamily;
  quality?: number;
  success?: boolean;
  patternId?: string;
  createdPattern?: boolean;
}

export const advanceMotorLearning = (
  world: WorldState,
  hero: Hero,
  actionId: ActionId | undefined,
  hours = 1,
): MotorLearningResult[] => {
  if (actionId !== 'train') return [];
  const memory = hero.body.motorMemory;
  const attempts = Math.max(1, Math.floor(hours));
  const results: MotorLearningResult[] = [];

  for (let index = 0; index < attempts; index += 1) {
    const attemptIndex = memory.totalAttempts + 1;
    const family = chooseFamily(world, hero, attemptIndex);
    const affinity = hero.body.affinity.movement[family];
    const remembered = selectRememberedPattern(world, hero, family, attemptIndex);
    const seed = `${world.seed}:${world.tick}:${hero.id}:${attemptIndex}:${family}`;
    const shouldBranch = Boolean(remembered)
      && memory.patterns.filter((pattern) => pattern.family === family).length < 3
      && attemptIndex % 5 === 0;
    const parameters = remembered
      ? mutateParameters(remembered.parameters, seed, shouldBranch ? 0.28 : Math.max(0.035, 0.15 - remembered.mastery / 900))
      : baseParameters(hero.body, family, seed);
    const quality = qualityForAttempt(world, hero, family, parameters, remembered, attemptIndex);
    const successThreshold = affinity.availability === 'restricted' ? 54 : affinity.availability === 'difficult' ? 49 : 45;
    const success = quality >= successThreshold;
    memory.totalAttempts += 1;
    memory.lastAttemptTick = world.tick;
    if (success) memory.successfulAttempts += 1;

    let pattern = shouldBranch ? undefined : matchingPattern(memory, family, parameters);
    let createdPattern = false;
    if (success && (!pattern || parameterDistance(pattern.parameters, parameters) > 0.19)) {
      pattern = createPattern(hero, family, parameters, quality, world.tick, dominantSideFor(hero, seed));
      memory.patterns.unshift(pattern);
      memory.patterns = memory.patterns.slice(0, 24);
      createdPattern = true;
    } else if (pattern) {
      reinforcePattern(hero, pattern, quality, success, parameters, world.tick);
    }

    const strainLoad = affinity.strainRisk * parameters.forceCommitment * (success ? 0.006 : 0.014);
    hero.body.tissues.muscleFatigue = clamp(hero.body.tissues.muscleFatigue + strainLoad);
    if (!success && affinity.availability === 'restricted') {
      hero.body.joints.spine.pain = clamp(hero.body.joints.spine.pain + affinity.strainRisk * 0.012);
      hero.body.joints[hero.body.pose.facing === 'left' ? 'leftKnee' : 'rightKnee'].pain = clamp(
        hero.body.joints[hero.body.pose.facing === 'left' ? 'leftKnee' : 'rightKnee'].pain + affinity.strainRisk * 0.01,
      );
    }

    results.push({ attempted: true, family, quality, success, patternId: pattern?.id, createdPattern });
  }

  updateSchools(world, hero);
  return results;
};

export const topMovementAffinities = (body: PhysicalBodyState, count = 3): MovementAffinityState[] =>
  movementFamilies
    .map((family) => body.affinity.movement[family])
    .sort((left, right) => right.aptitude - left.aptitude)
    .slice(0, count);

export const bestMotorPatterns = (body: PhysicalBodyState, count = 3): MotorPatternState[] =>
  [...body.motorMemory.patterns]
    .sort((left, right) =>
      (right.mastery * 0.42 + right.reliability * 0.28 + right.bestQuality * 0.2 + right.efficiency * 0.1)
      - (left.mastery * 0.42 + left.reliability * 0.28 + left.bestQuality * 0.2 + left.efficiency * 0.1))
    .slice(0, count);
