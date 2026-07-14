import type { ActionId, Hero, WorldState } from './model';
import {
  advanceMotorLearning,
  bestMotorPatterns,
  cloneBodyAffinity,
  cloneMotorMemory,
  createBodyAffinity,
  createMotorMemory,
  hydrateBodyAffinity,
  hydrateMotorMemory,
  topMovementAffinities,
} from './motor-learning';
import type {
  AnthropometryState,
  BodyPoseState,
  BodySegmentId,
  BodySegmentState,
  JointId,
  JointState,
  PhysicalBodyProfile,
  PhysicalBodyState,
} from './body-model';

const clamp = (value: number, min = 0, max = 100): number => Math.max(min, Math.min(max, value));
const round = (value: number, digits = 3): number => Number(value.toFixed(digits));

const segmentIds: BodySegmentId[] = [
  'head', 'neck', 'chest', 'abdomen', 'pelvis',
  'leftUpperArm', 'leftForearm', 'leftHand',
  'rightUpperArm', 'rightForearm', 'rightHand',
  'leftThigh', 'leftShin', 'leftFoot',
  'rightThigh', 'rightShin', 'rightFoot',
];

const lengthFractions: Record<BodySegmentId, number> = {
  head: 0.13, neck: 0.035, chest: 0.18, abdomen: 0.12, pelvis: 0.08,
  leftUpperArm: 0.19, leftForearm: 0.155, leftHand: 0.105,
  rightUpperArm: 0.19, rightForearm: 0.155, rightHand: 0.105,
  leftThigh: 0.245, leftShin: 0.235, leftFoot: 0.15,
  rightThigh: 0.245, rightShin: 0.235, rightFoot: 0.15,
};

const massFractions: Record<BodySegmentId, number> = {
  head: 0.081, neck: 0.014, chest: 0.19, abdomen: 0.12, pelvis: 0.105,
  leftUpperArm: 0.03, leftForearm: 0.019, leftHand: 0.007,
  rightUpperArm: 0.03, rightForearm: 0.019, rightHand: 0.007,
  leftThigh: 0.102, leftShin: 0.047, leftFoot: 0.014,
  rightThigh: 0.102, rightShin: 0.047, rightFoot: 0.014,
};

const parentSegments: Partial<Record<BodySegmentId, BodySegmentId>> = {
  neck: 'chest', head: 'neck', chest: 'abdomen', abdomen: 'pelvis',
  leftUpperArm: 'chest', leftForearm: 'leftUpperArm', leftHand: 'leftForearm',
  rightUpperArm: 'chest', rightForearm: 'rightUpperArm', rightHand: 'rightForearm',
  leftThigh: 'pelvis', leftShin: 'leftThigh', leftFoot: 'leftShin',
  rightThigh: 'pelvis', rightShin: 'rightThigh', rightFoot: 'rightShin',
};

const normalizedMassFraction = (id: BodySegmentId): number => {
  const total = Object.values(massFractions).reduce((sum, value) => sum + value, 0);
  return massFractions[id] / total;
};

const buildAnthropometry = (profile: PhysicalBodyProfile): AnthropometryState => {
  const leanMass = profile.massKg * (1 - profile.bodyFatPercent / 100);
  const muscleBias = profile.muscleBias ?? 1;
  const boneBias = profile.boneDensityBias ?? 1;
  return {
    heightCm: profile.heightCm,
    massKg: profile.massKg,
    bodyFatPercent: profile.bodyFatPercent,
    muscleMassKg: round(leanMass * clamp(0.46 * muscleBias, 0.35, 0.62)),
    boneMassKg: round(profile.massKg * clamp(0.14 * boneBias, 0.1, 0.19)),
    shoulderWidthCm: round(profile.heightCm * (profile.shoulderRatio ?? 0.245)),
    hipWidthCm: round(profile.heightCm * (profile.hipRatio ?? 0.175)),
    armSpanCm: round(profile.heightCm * (profile.armSpanRatio ?? 1)),
    legLengthCm: round(profile.heightCm * (profile.legRatio ?? 0.515)),
    torsoLengthCm: round(profile.heightCm * (1 - (profile.legRatio ?? 0.515) - 0.13)),
  };
};

const buildSegments = (anthropometry: AnthropometryState): Record<BodySegmentId, BodySegmentState> =>
  Object.fromEntries(segmentIds.map((id) => {
    const central = ['head', 'neck', 'chest', 'abdomen', 'pelvis'].includes(id);
    const leg = id.includes('Thigh') || id.includes('Shin') || id.includes('Foot');
    const thicknessBase = central
      ? anthropometry.shoulderWidthCm * (id === 'chest' ? 0.5 : id === 'pelvis' ? 0.42 : 0.34)
      : leg ? anthropometry.massKg * 0.11 : anthropometry.massKg * 0.075;
    return [id, {
      id,
      parentId: parentSegments[id],
      lengthCm: round(anthropometry.heightCm * lengthFractions[id]),
      thicknessCm: round(clamp(thicknessBase, 3.2, 24)),
      massKg: round(anthropometry.massKg * normalizedMassFraction(id)),
      health: 100,
      pain: 0,
      fatigue: 0,
    } satisfies BodySegmentState];
  })) as Record<BodySegmentId, BodySegmentState>;

const joint = (
  id: JointId,
  parentSegmentId: BodySegmentId,
  childSegmentId: BodySegmentId,
  minAngleDeg: number,
  maxAngleDeg: number,
  restAngleDeg = 0,
): JointState => ({
  id, parentSegmentId, childSegmentId,
  angleDeg: restAngleDeg,
  restAngleDeg,
  minAngleDeg,
  maxAngleDeg,
  angularVelocityDegS: 0,
  stability: 76,
  mobility: 68,
  pain: 0,
});

const buildJoints = (): Record<JointId, JointState> => ({
  neck: joint('neck', 'chest', 'neck', -55, 65),
  spine: joint('spine', 'pelvis', 'abdomen', -35, 50),
  leftShoulder: joint('leftShoulder', 'chest', 'leftUpperArm', -175, 175, 8),
  leftElbow: joint('leftElbow', 'leftUpperArm', 'leftForearm', 0, 152, 8),
  leftWrist: joint('leftWrist', 'leftForearm', 'leftHand', -75, 75),
  rightShoulder: joint('rightShoulder', 'chest', 'rightUpperArm', -175, 175, -8),
  rightElbow: joint('rightElbow', 'rightUpperArm', 'rightForearm', 0, 152, 8),
  rightWrist: joint('rightWrist', 'rightForearm', 'rightHand', -75, 75),
  leftHip: joint('leftHip', 'pelvis', 'leftThigh', -125, 55),
  leftKnee: joint('leftKnee', 'leftThigh', 'leftShin', 0, 155, 4),
  leftAnkle: joint('leftAnkle', 'leftShin', 'leftFoot', -48, 62),
  rightHip: joint('rightHip', 'pelvis', 'rightThigh', -125, 55),
  rightKnee: joint('rightKnee', 'rightThigh', 'rightShin', 0, 155, 4),
  rightAnkle: joint('rightAnkle', 'rightShin', 'rightFoot', -48, 62),
});

export const createPhysicalBody = (profile: PhysicalBodyProfile, tick = 0): PhysicalBodyState => {
  const anthropometry = buildAnthropometry(profile);
  const coordination = clamp(48 * (profile.coordinationBias ?? 1), 20, 90);
  const flexibility = clamp(52 * (profile.flexibilityBias ?? 1), 20, 90);
  const boneDensity = clamp(62 * (profile.boneDensityBias ?? 1), 35, 95);
  const tissues = {
    muscleTone: 52,
    muscleFatigue: 8,
    muscleCondition: 68,
    tendonCondition: 72,
    boneDensity,
    flexibility,
    hydration: 76,
  };
  const nervous = {
    coordination,
    balance: clamp(coordination + 4),
    proprioception: clamp(coordination + 2),
    motorLearning: clamp(45 + coordination * 0.28),
    reflexQuality: clamp(42 + coordination * 0.32),
    reactionTimeMs: round(285 - coordination * 0.9, 1),
  };
  return {
    version: 1,
    anthropometry,
    tissues,
    nervous,
    pose: {
      name: 'neutral', supportFoot: 'both', centerOfMass: { x: 0, y: 0.54 },
      stability: 76, stanceWidthCm: round(anthropometry.hipWidthCm * 1.08), facing: 'right',
    },
    limits: {
      maxJointSpeedDegS: round(390 + coordination * 2.6),
      maxLimbSpeedMS: round(5.6 + coordination * 0.035),
      safeAccelerationG: round(2.1 + boneDensity * 0.025),
      physicalSpeedCeiling: round(62 + coordination * 0.3),
      forceTransferEfficiency: round(44 + coordination * 0.38),
    },
    affinity: createBodyAffinity(profile, anthropometry, tissues, nervous),
    motorMemory: createMotorMemory(),
    segments: buildSegments(anthropometry),
    joints: buildJoints(),
    lastUpdatedTick: tick,
  };
};

export const clonePhysicalBody = (body: PhysicalBodyState): PhysicalBodyState => ({
  ...body,
  anthropometry: { ...body.anthropometry },
  tissues: { ...body.tissues },
  nervous: { ...body.nervous },
  pose: { ...body.pose, centerOfMass: { ...body.pose.centerOfMass } },
  limits: { ...body.limits },
  affinity: cloneBodyAffinity(body.affinity),
  motorMemory: cloneMotorMemory(body.motorMemory),
  segments: Object.fromEntries(Object.entries(body.segments).map(([id, segment]) => [id, { ...segment }])) as PhysicalBodyState['segments'],
  joints: Object.fromEntries(Object.entries(body.joints).map(([id, value]) => [id, { ...value }])) as PhysicalBodyState['joints'],
});

export const hydratePhysicalBody = (
  saved: Partial<PhysicalBodyState> | undefined,
  fallback: PhysicalBodyState,
): PhysicalBodyState => {
  if (!saved || saved.version !== 1) return clonePhysicalBody(fallback);
  return {
    ...fallback,
    ...saved,
    anthropometry: { ...fallback.anthropometry, ...(saved.anthropometry ?? {}) },
    tissues: { ...fallback.tissues, ...(saved.tissues ?? {}) },
    nervous: { ...fallback.nervous, ...(saved.nervous ?? {}) },
    pose: {
      ...fallback.pose,
      ...(saved.pose ?? {}),
      centerOfMass: { ...fallback.pose.centerOfMass, ...(saved.pose?.centerOfMass ?? {}) },
    },
    limits: { ...fallback.limits, ...(saved.limits ?? {}) },
    affinity: hydrateBodyAffinity(saved.affinity, fallback.affinity),
    motorMemory: hydrateMotorMemory(saved.motorMemory, fallback.motorMemory),
    segments: Object.fromEntries(segmentIds.map((id) => [id, {
      ...fallback.segments[id],
      ...(saved.segments?.[id] ?? {}),
    }])) as PhysicalBodyState['segments'],
    joints: Object.fromEntries((Object.keys(fallback.joints) as JointId[]).map((id) => [id, {
      ...fallback.joints[id],
      ...(saved.joints?.[id] ?? {}),
    }])) as PhysicalBodyState['joints'],
  };
};

const poseForAction = (actionId: ActionId | undefined, injury: number): BodyPoseState['name'] => {
  if (injury > 48) return 'injured';
  if (actionId === 'train') return 'training';
  if (actionId === 'work' || actionId === 'help') return 'working';
  if (actionId === 'dungeon') return 'guarding';
  if (actionId === 'recover' || actionId === 'sleep') return 'resting';
  return 'neutral';
};

const applyPose = (body: PhysicalBodyState, poseName: BodyPoseState['name'], balance: number): void => {
  const pose = body.pose;
  pose.name = poseName;
  pose.supportFoot = poseName === 'walking' ? 'left' : poseName === 'injured' ? 'right' : 'both';
  pose.centerOfMass.x = poseName === 'working' ? 0.08 : poseName === 'training' ? 0.04 : poseName === 'injured' ? 0.12 : 0;
  pose.centerOfMass.y = poseName === 'resting' ? 0.68 : poseName === 'training' ? 0.5 : 0.54;
  pose.stability = clamp(balance - body.tissues.muscleFatigue * 0.32 - (poseName === 'injured' ? 24 : 0));
  pose.stanceWidthCm = round(body.anthropometry.hipWidthCm * (poseName === 'training' || poseName === 'guarding' ? 1.42 : 1.08));

  const angles: Partial<Record<JointId, number>> = poseName === 'training'
    ? { spine: 8, leftShoulder: 34, rightShoulder: -72, leftElbow: 28, rightElbow: 48, leftHip: -12, rightHip: 14, leftKnee: 18, rightKnee: 22 }
    : poseName === 'working'
      ? { spine: 18, leftShoulder: -38, rightShoulder: -58, leftElbow: 42, rightElbow: 65, leftKnee: 14, rightKnee: 12 }
      : poseName === 'guarding'
        ? { spine: 4, leftShoulder: -35, rightShoulder: -48, leftElbow: 68, rightElbow: 58, leftHip: -10, rightHip: 12, leftKnee: 18, rightKnee: 18 }
        : poseName === 'resting'
          ? { spine: 10, leftShoulder: 18, rightShoulder: -18, leftElbow: 12, rightElbow: 12, leftKnee: 8, rightKnee: 8 }
          : poseName === 'injured'
            ? { spine: 13, leftShoulder: 22, rightShoulder: -8, leftHip: -4, rightHip: 18, leftKnee: 12, rightKnee: 28 }
            : {};

  (Object.keys(body.joints) as JointId[]).forEach((id) => {
    const value = angles[id] ?? body.joints[id].restAngleDeg;
    body.joints[id].angularVelocityDegS = Math.abs(value - body.joints[id].angleDeg) * 2;
    body.joints[id].angleDeg = clamp(value, body.joints[id].minAngleDeg, body.joints[id].maxAngleDeg);
  });
};

const injuryIndex = (heroId: string): number => {
  let hash = 0;
  for (const char of heroId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % segmentIds.length;
};

const synchronizeInjury = (hero: Hero): void => {
  const body = hero.body;
  const focusIndex = injuryIndex(hero.id);
  segmentIds.forEach((id, index) => {
    const focused = index === focusIndex || index === (focusIndex + 7) % segmentIds.length;
    const targetPain = hero.condition.injury * (focused ? 0.7 : 0.09);
    const segment = body.segments[id];
    segment.pain = clamp(segment.pain * 0.74 + targetPain * 0.26);
    segment.health = clamp(100 - segment.pain * 0.72);
  });
  (Object.keys(body.joints) as JointId[]).forEach((id) => {
    const jointState = body.joints[id];
    const childPain = body.segments[jointState.childSegmentId].pain;
    jointState.pain = clamp(childPain * 0.76);
    jointState.stability = clamp(82 - jointState.pain * 0.55 - body.tissues.muscleFatigue * 0.14);
    jointState.mobility = clamp(body.tissues.flexibility - jointState.pain * 0.45);
  });
};

export type BodyActionMap = Partial<Record<string, ActionId | undefined>>;

export const advancePhysicalBodies = (
  world: WorldState,
  hours = 1,
  previousActions: BodyActionMap = {},
): void => {
  Object.values(world.heroes).forEach((hero) => {
    const body = hero.body;
    const actionId = previousActions[hero.id] ?? hero.currentActivity?.actionId;
    const activeLoad = actionId === 'train' ? 8 : actionId === 'dungeon' ? 5.5 : actionId === 'work' || actionId === 'help' ? 3.5 : 0;
    const recovery = actionId === 'sleep' || actionId === 'recover' ? 6.5 : 1.2;
    body.tissues.muscleFatigue = clamp(body.tissues.muscleFatigue + (activeLoad - recovery) * hours);
    const toneTarget = clamp(46 + hero.psyche.stress * 0.18 + (actionId === 'train' || actionId === 'dungeon' ? 12 : 0));
    body.tissues.muscleTone = clamp(body.tissues.muscleTone + (toneTarget - body.tissues.muscleTone) * 0.18 * hours);
    body.tissues.hydration = clamp(body.tissues.hydration - activeLoad * 0.16 * hours + (actionId === 'eat' || actionId === 'recover' ? 4 : 0));

    if (actionId === 'train') {
      const stimulus = clamp((hero.stats.strength + hero.stats.endurance + hero.stats.dexterity) / 90, 0.45, 2.2);
      body.anthropometry.muscleMassKg = round(body.anthropometry.muscleMassKg + 0.0035 * stimulus * hours);
      body.anthropometry.massKg = round(body.anthropometry.massKg + 0.0022 * stimulus * hours);
      body.tissues.muscleCondition = clamp(body.tissues.muscleCondition + 0.045 * stimulus * hours);
      body.tissues.tendonCondition = clamp(body.tissues.tendonCondition + 0.025 * stimulus * hours);
      body.nervous.coordination = clamp(body.nervous.coordination + 0.022 * hero.stats.dexterity / 30 * hours);
      body.nervous.balance = clamp(body.nervous.balance + 0.018 * hero.stats.dexterity / 30 * hours);
      body.nervous.proprioception = clamp(body.nervous.proprioception + 0.02 * hours);
      body.nervous.motorLearning = clamp(body.nervous.motorLearning + 0.012 * (hero.traits.curiosity + hero.traits.discipline) / 100 * hours);
    }

    advanceMotorLearning(world, hero, actionId, hours);

    body.nervous.reactionTimeMs = round(clamp(
      318 - hero.stats.dexterity * 2.25 - hero.stats.perception * 0.82
        + body.tissues.muscleFatigue * 0.72 + hero.psyche.stress * 0.2,
      82,
      420,
    ), 1);
    body.nervous.reflexQuality = clamp(
      30 + hero.stats.dexterity * 0.55 + hero.stats.perception * 0.3
        + body.nervous.proprioception * 0.18 - body.tissues.muscleFatigue * 0.28,
    );
    body.limits.maxJointSpeedDegS = round(370 + Math.min(hero.stats.dexterity, 100) * 3.3 + body.nervous.coordination * 1.25);
    body.limits.maxLimbSpeedMS = round(5.2 + Math.min(hero.stats.dexterity, 100) * 0.047 + body.nervous.coordination * 0.018);
    body.limits.forceTransferEfficiency = clamp(
      28 + hero.stats.strength * 0.28 + body.nervous.coordination * 0.34 + body.pose.stability * 0.2,
    );
    body.limits.physicalSpeedCeiling = clamp(48 + body.nervous.coordination * 0.36 + body.tissues.tendonCondition * 0.22);

    synchronizeInjury(hero);
    applyPose(body, poseForAction(hero.currentActivity?.actionId, hero.condition.injury), body.nervous.balance);
    segmentIds.forEach((id) => {
      const segment = body.segments[id];
      const loadShare = id.includes('Thigh') || id.includes('Shin') ? activeLoad * 0.75 : activeLoad * 0.42;
      segment.fatigue = clamp(segment.fatigue + (loadShare - recovery * 0.45) * hours);
    });
    body.lastUpdatedTick = world.tick;
  });
};

export interface PhysicalBodyVisualProfile {
  heightScale: number;
  shoulderScale: number;
  hipScale: number;
  limbThickness: number;
  headScale: number;
  stanceScale: number;
  tone: number;
  stability: number;
}

export const physicalBodyVisualProfile = (body: PhysicalBodyState): PhysicalBodyVisualProfile => ({
  heightScale: clamp(body.anthropometry.heightCm / 170, 0.86, 1.16),
  shoulderScale: clamp(body.anthropometry.shoulderWidthCm / 41, 0.82, 1.25),
  hipScale: clamp(body.anthropometry.hipWidthCm / 30, 0.82, 1.2),
  limbThickness: clamp((body.anthropometry.muscleMassKg / body.anthropometry.heightCm) * 4.8, 0.78, 1.32),
  headScale: clamp(1.02 - (body.anthropometry.heightCm - 165) * 0.002, 0.92, 1.08),
  stanceScale: clamp(body.pose.stanceWidthCm / body.anthropometry.hipWidthCm, 0.9, 1.55),
  tone: body.tissues.muscleTone,
  stability: body.pose.stability,
});

export const physicalBodySummary = (hero: Hero) => ({
  heightCm: hero.body.anthropometry.heightCm,
  massKg: hero.body.anthropometry.massKg,
  muscleMassKg: hero.body.anthropometry.muscleMassKg,
  muscleTone: hero.body.tissues.muscleTone,
  fatigue: hero.body.tissues.muscleFatigue,
  balance: hero.body.nervous.balance,
  coordination: hero.body.nervous.coordination,
  reactionTimeMs: hero.body.nervous.reactionTimeMs,
  stability: hero.body.pose.stability,
  supportFoot: hero.body.pose.supportFoot,
  pose: hero.body.pose.name,
  painfulSegments: segmentIds.filter((id) => hero.body.segments[id].pain >= 12),
  affinities: topMovementAffinities(hero.body, 3),
  motorPatterns: bestMotorPatterns(hero.body, 3),
  motorAttempts: hero.body.motorMemory.totalAttempts,
  motorSuccesses: hero.body.motorMemory.successfulAttempts,
  motorSchools: hero.body.motorMemory.schools,
});
