import type { ActionId, Hero, WorldState } from './model';
import type {
  BodySide,
  BodyVector2,
  JointId,
  MotorPatternParameters,
  MotorPatternState,
  MovementFamily,
  PhysicalBodyState,
  SupportFoot,
} from './body-model';

export type ProceduralMotionPhase =
  | 'preparation'
  | 'loading'
  | 'execution'
  | 'contact'
  | 'recovery'
  | 'stabilization'
  | 'unstable'
  | 'falling';

export type MotionContactId = 'leftFoot' | 'rightFoot' | 'leftHand' | 'rightHand';

export interface ProceduralMotionContact {
  id: MotionContactId;
  active: boolean;
  point: BodyVector2;
  load: number;
  surface: 'ground' | 'target' | 'none';
}

export interface ProceduralMotionFrame {
  phase: ProceduralMotionPhase;
  progress: number;
  supportFoot: SupportFoot;
  centerOfMass: BodyVector2;
  supportCenter: BodyVector2;
  supportWidth: number;
  balanceMargin: number;
  stability: number;
  fallRisk: number;
  jointTargets: Record<JointId, number>;
  contacts: ProceduralMotionContact[];
}

export interface ProceduralMotionState {
  version: 1;
  motionId: string;
  actionId?: ActionId;
  patternId?: string;
  family: MovementFamily;
  dominantSide: BodySide;
  active: boolean;
  phase: ProceduralMotionPhase;
  frameIndex: number;
  cycleProgress: number;
  tempo: number;
  balanceMargin: number;
  fallRisk: number;
  unstable: boolean;
  fallen: boolean;
  supportFoot: SupportFoot;
  centerOfMass: BodyVector2;
  contacts: ProceduralMotionContact[];
  jointTargets: Record<JointId, number>;
  trajectory: ProceduralMotionFrame[];
  lastSynchronizedTick: number;
}

export type MotionCapableBody = PhysicalBodyState & {
  proceduralMotion?: ProceduralMotionState;
};

const jointIds: JointId[] = [
  'neck', 'spine',
  'leftShoulder', 'leftElbow', 'leftWrist',
  'rightShoulder', 'rightElbow', 'rightWrist',
  'leftHip', 'leftKnee', 'leftAnkle',
  'rightHip', 'rightKnee', 'rightAnkle',
];

const clamp = (value: number, min = 0, max = 100): number => Math.max(min, Math.min(max, value));
const round = (value: number, digits = 3): number => Number(value.toFixed(digits));
const mix = (left: number, right: number, amount: number): number => left + (right - left) * amount;
const average = (values: number[]): number => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : 0;

export const proceduralMotionPhaseLabels: Record<ProceduralMotionPhase, string> = {
  preparation: 'подготовка',
  loading: 'загрузка опоры',
  execution: 'исполнение',
  contact: 'контакт',
  recovery: 'возврат',
  stabilization: 'стабилизация',
  unstable: 'потеря равновесия',
  falling: 'падение',
};

const familyForAction: Record<ActionId, MovementFamily> = {
  eat: 'fineManipulation',
  sleep: 'rootedGuard',
  train: 'flowingTransition',
  read: 'fineManipulation',
  talk: 'fineManipulation',
  help: 'grapplingControl',
  apologize: 'fineManipulation',
  seekSolitude: 'enduranceFootwork',
  work: 'fineManipulation',
  dungeon: 'rootedGuard',
  recover: 'rootedGuard',
};

const neutralTargets = (body: PhysicalBodyState): Record<JointId, number> =>
  Object.fromEntries(jointIds.map((id) => [id, body.joints[id].restAngleDeg])) as Record<JointId, number>;

const bestPattern = (hero: Hero, actionId: ActionId | undefined): MotorPatternState | undefined => {
  const explicitFamily = actionId ? familyForAction[actionId] : undefined;
  const candidates = hero.body.motorMemory.patterns.filter((pattern) => !explicitFamily || pattern.family === explicitFamily);
  const source = candidates.length ? candidates : hero.body.motorMemory.patterns;
  return [...source].sort((left, right) =>
    (right.mastery * 0.36 + right.reliability * 0.27 + right.efficiency * 0.2 + right.bestQuality * 0.17)
    - (left.mastery * 0.36 + left.reliability * 0.27 + left.efficiency * 0.2 + left.bestQuality * 0.17))[0];
};

const fallbackParameters = (body: PhysicalBodyState, family: MovementFamily): MotorPatternParameters => {
  const affinity = body.affinity.movement[family];
  return {
    stanceWidthRatio: round(clamp(0.92 + body.affinity.stability / 160, 0.82, 1.62), 3),
    weightTransfer: round(clamp(0.34 + affinity.aptitude / 260, 0.28, 0.82), 3),
    hipRotationDeg: round(clamp(12 + body.affinity.power * 0.42, 8, 68), 2),
    reachExtension: round(clamp(0.46 + body.affinity.precision / 210, 0.42, 0.92), 3),
    tempo: round(clamp(0.34 + body.affinity.acceleration / 190, 0.3, 0.9), 3),
    forceCommitment: round(clamp(0.3 + body.affinity.power / 175, 0.28, 0.9), 3),
    recoveryPriority: round(clamp(0.42 + body.affinity.recovery / 190, 0.38, 0.94), 3),
  };
};

const dominantSide = (hero: Hero, pattern?: MotorPatternState): BodySide => {
  if (pattern) return pattern.dominantSide;
  const leftPain = hero.body.segments.leftHand.pain + hero.body.segments.leftFoot.pain;
  const rightPain = hero.body.segments.rightHand.pain + hero.body.segments.rightFoot.pain;
  return leftPain <= rightPain ? 'left' : 'right';
};

const phaseProgress = [0, 0.16, 0.42, 0.64, 0.82, 1];
const phaseNames: ProceduralMotionPhase[] = [
  'preparation', 'loading', 'execution', 'contact', 'recovery', 'stabilization',
];

const sideValue = (side: BodySide, left: number, right: number): number => side === 'left' ? left : right;

const targetsFor = (
  body: PhysicalBodyState,
  family: MovementFamily,
  side: BodySide,
  parameters: MotorPatternParameters,
  progress: number,
): Record<JointId, number> => {
  const targets = neutralTargets(body);
  const dominantShoulder = side === 'left' ? 'leftShoulder' : 'rightShoulder';
  const dominantElbow = side === 'left' ? 'leftElbow' : 'rightElbow';
  const dominantWrist = side === 'left' ? 'leftWrist' : 'rightWrist';
  const supportShoulder = side === 'left' ? 'rightShoulder' : 'leftShoulder';
  const supportElbow = side === 'left' ? 'rightElbow' : 'leftElbow';
  const dominantHip = side === 'left' ? 'leftHip' : 'rightHip';
  const dominantKnee = side === 'left' ? 'leftKnee' : 'rightKnee';
  const supportHip = side === 'left' ? 'rightHip' : 'leftHip';
  const supportKnee = side === 'left' ? 'rightKnee' : 'leftKnee';
  const pulse = Math.sin(progress * Math.PI);
  const contactPulse = Math.sin(clamp((progress - 0.22) / 0.55, 0, 1) * Math.PI);
  const recovery = clamp((progress - 0.64) / 0.36, 0, 1);
  const rotation = parameters.hipRotationDeg * contactPulse * sideValue(side, 1, -1);
  const force = parameters.forceCommitment;
  const reach = parameters.reachExtension;

  targets.spine = rotation * 0.18;
  targets.neck = -rotation * 0.08;
  targets[dominantHip] = -12 - parameters.weightTransfer * 18 * pulse;
  targets[supportHip] = 10 + parameters.weightTransfer * 12 * pulse;
  targets[dominantKnee] = 12 + parameters.weightTransfer * 18 * pulse;
  targets[supportKnee] = 18 + parameters.weightTransfer * 24 * pulse;

  if (family === 'drivingStrike') {
    targets[dominantShoulder] = mix(18, -118 * force, contactPulse);
    targets[dominantElbow] = mix(58, 14, contactPulse);
    targets[dominantWrist] = -12 * contactPulse;
    targets[supportShoulder] = 28 + 18 * pulse;
    targets[supportElbow] = 62;
  } else if (family === 'reachThrust') {
    targets[dominantShoulder] = mix(-18, -102 * reach, contactPulse);
    targets[dominantElbow] = mix(74, 8, contactPulse);
    targets[dominantWrist] = 8 * contactPulse;
    targets[supportShoulder] = -34;
    targets[supportElbow] = 78;
    targets.spine = rotation * 0.13 + 7 * contactPulse;
  } else if (family === 'grapplingControl') {
    targets[dominantShoulder] = -48 - 38 * contactPulse;
    targets[dominantElbow] = 76 + 42 * contactPulse;
    targets[supportShoulder] = -38 - 28 * contactPulse;
    targets[supportElbow] = 72 + 35 * contactPulse;
    targets.spine = rotation * 0.12 + 16 * contactPulse;
    targets[dominantKnee] += 18 * contactPulse;
    targets[supportKnee] += 12 * contactPulse;
  } else if (family === 'mobileEvasion') {
    targets.spine = sideValue(side, -22, 22) * pulse;
    targets[dominantShoulder] = 22;
    targets[supportShoulder] = -28;
    targets[dominantHip] = -34 * pulse;
    targets[supportHip] = 22 * pulse;
    targets[dominantKnee] = 36 * pulse;
    targets[supportKnee] = 28 * pulse;
  } else if (family === 'flowingTransition') {
    targets[dominantShoulder] = -64 * pulse;
    targets[supportShoulder] = 58 * pulse;
    targets[dominantElbow] = 36 + 28 * pulse;
    targets[supportElbow] = 42 + 24 * pulse;
    targets.spine = rotation * 0.22;
    targets[dominantHip] = -22 * pulse;
    targets[supportHip] = 18 * pulse;
  } else if (family === 'rootedGuard') {
    targets.leftShoulder = -42;
    targets.rightShoulder = -42;
    targets.leftElbow = 72;
    targets.rightElbow = 72;
    targets.leftHip = -10 - 8 * pulse;
    targets.rightHip = 10 + 8 * pulse;
    targets.leftKnee = 24 + 10 * pulse;
    targets.rightKnee = 24 + 10 * pulse;
    targets.spine = 4;
  } else if (family === 'enduranceFootwork') {
    const stride = Math.sin(progress * Math.PI * 2);
    targets.leftHip = -24 * stride;
    targets.rightHip = 24 * stride;
    targets.leftKnee = 20 + Math.max(0, stride) * 28;
    targets.rightKnee = 20 + Math.max(0, -stride) * 28;
    targets.leftShoulder = 24 * stride;
    targets.rightShoulder = -24 * stride;
    targets.spine = 6;
  } else {
    targets[dominantShoulder] = -28 - 18 * pulse;
    targets[dominantElbow] = 72 - 26 * pulse;
    targets[dominantWrist] = sideValue(side, -34, 34) * pulse;
    targets[supportShoulder] = -18;
    targets[supportElbow] = 58;
  }

  if (recovery > 0) {
    jointIds.forEach((id) => {
      targets[id] = mix(targets[id], body.joints[id].restAngleDeg, recovery * parameters.recoveryPriority * 0.82);
    });
  }

  return Object.fromEntries(jointIds.map((id) => [
    id,
    round(clamp(targets[id], body.joints[id].minAngleDeg, body.joints[id].maxAngleDeg), 2),
  ])) as Record<JointId, number>;
};

const painLoad = (hero: Hero): number => average(Object.values(hero.body.segments).map((segment) => segment.pain));

const frameFor = (
  hero: Hero,
  family: MovementFamily,
  side: BodySide,
  parameters: MotorPatternParameters,
  phase: ProceduralMotionPhase,
  progress: number,
): ProceduralMotionFrame => {
  const body = hero.body;
  const active = progress > 0.12 && progress < 0.86;
  const dominantSupport: SupportFoot = side === 'left' ? 'right' : 'left';
  const supportFoot: SupportFoot = phase === 'execution' || phase === 'contact'
    ? dominantSupport
    : 'both';
  const stanceMeters = clamp(body.anthropometry.hipWidthCm * parameters.stanceWidthRatio / 100, 0.2, 0.62);
  const leftX = -stanceMeters / 2;
  const rightX = stanceMeters / 2;
  const transferSign = side === 'left' ? -1 : 1;
  const executionPulse = Math.sin(clamp((progress - 0.14) / 0.68, 0, 1) * Math.PI);
  const recovery = clamp((progress - 0.64) / 0.36, 0, 1);
  const transfer = parameters.weightTransfer * executionPulse * (1 - recovery * parameters.recoveryPriority * 0.7);
  const centerX = transferSign * transfer * stanceMeters * 0.7;
  const centerY = 0.52 - parameters.forceCommitment * executionPulse * 0.075 + recovery * 0.035;
  const supportCenterX = supportFoot === 'left' ? leftX : supportFoot === 'right' ? rightX : 0;
  const supportWidth = supportFoot === 'both' ? stanceMeters : 0.14;
  const momentumPenalty = active
    ? parameters.tempo * parameters.forceCommitment * (phase === 'contact' ? 0.12 : 0.075)
    : 0;
  const fatiguePenalty = body.tissues.muscleFatigue / 100 * 0.07;
  const painPenalty = painLoad(hero) / 100 * 0.08;
  const rawMargin = supportWidth / 2 - Math.abs(centerX - supportCenterX) - momentumPenalty - fatiguePenalty - painPenalty;
  const balanceReserve = body.nervous.balance * 0.0018 + body.affinity.stability * 0.0016;
  const recoveryBonus = recovery * parameters.recoveryPriority * body.affinity.recovery * 0.0014;
  const balanceMargin = rawMargin + balanceReserve + recoveryBonus;
  const stability = clamp(
    body.nervous.balance * 0.34
    + body.affinity.stability * 0.32
    + body.pose.stability * 0.2
    + parameters.recoveryPriority * 14
    - Math.max(0, -balanceMargin) * 240
    - body.tissues.muscleFatigue * 0.18
    - painLoad(hero) * 0.16,
  );
  const fallRisk = clamp(
    42
    - balanceMargin * 180
    + momentumPenalty * 180
    + body.tissues.muscleFatigue * 0.28
    + painLoad(hero) * 0.36
    - body.affinity.stability * 0.22
    - parameters.recoveryPriority * 16,
  );
  const dominantHand: MotionContactId = side === 'left' ? 'leftHand' : 'rightHand';
  const supportHand: MotionContactId = side === 'left' ? 'rightHand' : 'leftHand';
  const handContact = phase === 'contact' && ['drivingStrike', 'reachThrust', 'grapplingControl', 'fineManipulation'].includes(family);
  const footLoad = supportFoot === 'both' ? 0.5 : 0.88;
  const contacts: ProceduralMotionContact[] = [
    { id: 'leftFoot', active: supportFoot === 'both' || supportFoot === 'left', point: { x: leftX, y: 0 }, load: supportFoot === 'left' ? footLoad : 0.5, surface: 'ground' },
    { id: 'rightFoot', active: supportFoot === 'both' || supportFoot === 'right', point: { x: rightX, y: 0 }, load: supportFoot === 'right' ? footLoad : 0.5, surface: 'ground' },
    { id: dominantHand, active: handContact, point: { x: transferSign * (0.44 + parameters.reachExtension * 0.38), y: 0.72 }, load: handContact ? parameters.forceCommitment : 0, surface: handContact ? 'target' : 'none' },
    { id: supportHand, active: family === 'grapplingControl' && phase === 'contact', point: { x: transferSign * 0.32, y: 0.66 }, load: family === 'grapplingControl' && phase === 'contact' ? parameters.forceCommitment * 0.72 : 0, surface: family === 'grapplingControl' && phase === 'contact' ? 'target' : 'none' },
  ];

  return {
    phase,
    progress,
    supportFoot,
    centerOfMass: { x: round(centerX), y: round(centerY) },
    supportCenter: { x: round(supportCenterX), y: 0 },
    supportWidth: round(supportWidth),
    balanceMargin: round(balanceMargin),
    stability: round(stability, 2),
    fallRisk: round(fallRisk, 2),
    jointTargets: targetsFor(body, family, side, parameters, progress),
    contacts,
  };
};

export const buildProceduralMotion = (world: WorldState, hero: Hero): ProceduralMotionState => {
  const actionId = hero.currentActivity?.actionId ?? hero.currentAction?.actionId;
  const pattern = bestPattern(hero, actionId);
  const family = pattern?.family ?? (actionId ? familyForAction[actionId] : 'rootedGuard');
  const parameters = pattern?.parameters ?? fallbackParameters(hero.body, family);
  const side = dominantSide(hero, pattern);
  const trajectory = phaseProgress.map((progress, index) => frameFor(
    hero,
    family,
    side,
    parameters,
    phaseNames[index],
    progress,
  ));
  const isActive = actionId === 'train' || actionId === 'dungeon' || actionId === 'work' || actionId === 'help';
  const frameIndex = isActive ? Math.abs(world.tick + hero.id.length) % trajectory.length : 0;
  let current = trajectory[frameIndex];
  const severe = current.balanceMargin < -0.1 || current.fallRisk >= 82;
  const unstable = isActive && (current.balanceMargin < 0 || current.stability < 24 || current.fallRisk >= 66);
  if (unstable) {
    current = {
      ...current,
      phase: severe ? 'falling' : 'unstable',
      supportFoot: severe ? 'none' : current.supportFoot,
      contacts: severe
        ? current.contacts.map((contact) => ({ ...contact, active: contact.id.includes('Hand'), surface: contact.id.includes('Hand') ? 'ground' : 'none' }))
        : current.contacts,
    };
  }

  return {
    version: 1,
    motionId: `${world.tick}:${hero.id}:${pattern?.id ?? family}`,
    actionId,
    patternId: pattern?.id,
    family,
    dominantSide: side,
    active: isActive,
    phase: current.phase,
    frameIndex,
    cycleProgress: current.progress,
    tempo: parameters.tempo,
    balanceMargin: current.balanceMargin,
    fallRisk: current.fallRisk,
    unstable,
    fallen: severe && isActive,
    supportFoot: current.supportFoot,
    centerOfMass: { ...current.centerOfMass },
    contacts: current.contacts.map((contact) => ({ ...contact, point: { ...contact.point } })),
    jointTargets: { ...current.jointTargets },
    trajectory: trajectory.map((frame) => ({
      ...frame,
      centerOfMass: { ...frame.centerOfMass },
      supportCenter: { ...frame.supportCenter },
      jointTargets: { ...frame.jointTargets },
      contacts: frame.contacts.map((contact) => ({ ...contact, point: { ...contact.point } })),
    })),
    lastSynchronizedTick: world.tick,
  };
};

const applyMotionToBody = (hero: Hero, motion: ProceduralMotionState): void => {
  const body = hero.body;
  jointIds.forEach((id) => {
    const joint = body.joints[id];
    const target = clamp(motion.jointTargets[id], joint.minAngleDeg, joint.maxAngleDeg);
    const delta = target - joint.angleDeg;
    joint.angularVelocityDegS = round(clamp(Math.abs(delta) * (2.4 + motion.tempo * 3.2), 0, body.limits.maxJointSpeedDegS), 2);
    joint.angleDeg = round(target, 2);
  });
  body.pose.supportFoot = motion.supportFoot;
  body.pose.centerOfMass = { ...motion.centerOfMass };
  body.pose.stability = clamp(100 - motion.fallRisk * 0.72 + Math.max(0, motion.balanceMargin) * 110);
  if (motion.active && motion.phase !== 'falling') body.pose.name = 'training';
  if (motion.unstable) {
    body.tissues.muscleFatigue = clamp(body.tissues.muscleFatigue + 0.4 + motion.fallRisk * 0.008);
    const supportKnee = motion.supportFoot === 'left' ? body.joints.leftKnee : body.joints.rightKnee;
    supportKnee.pain = clamp(supportKnee.pain + 0.08 + motion.fallRisk * 0.003);
  }
  if (motion.fallen) {
    body.pose.name = 'injured';
    hero.condition.injury = clamp(hero.condition.injury + 0.35 + motion.fallRisk * 0.012);
    body.segments.pelvis.pain = clamp(body.segments.pelvis.pain + 0.4 + motion.fallRisk * 0.01);
    body.segments.leftHand.pain = clamp(body.segments.leftHand.pain + 0.18);
    body.segments.rightHand.pain = clamp(body.segments.rightHand.pain + 0.18);
  }
};

export const getProceduralMotion = (body: PhysicalBodyState): ProceduralMotionState | undefined =>
  (body as MotionCapableBody).proceduralMotion;

export const synchronizeProceduralMotionWorld = (world: WorldState): boolean => {
  let changed = false;
  Object.values(world.heroes).forEach((hero) => {
    const body = hero.body as MotionCapableBody;
    const actionId = hero.currentActivity?.actionId ?? hero.currentAction?.actionId;
    if (body.proceduralMotion?.lastSynchronizedTick === world.tick
      && body.proceduralMotion.actionId === actionId) return;
    const motion = buildProceduralMotion(world, hero);
    applyMotionToBody(hero, motion);
    body.proceduralMotion = motion;
    changed = true;
  });
  return changed;
};

export const sampleProceduralMotion = (
  motion: ProceduralMotionState,
  progress: number,
): ProceduralMotionFrame => {
  const frames = motion.trajectory;
  if (!frames.length) throw new Error('Procedural motion trajectory is empty');
  const normalized = ((progress % 1) + 1) % 1;
  const scaled = normalized * (frames.length - 1);
  const leftIndex = Math.floor(scaled);
  const rightIndex = Math.min(frames.length - 1, leftIndex + 1);
  const amount = scaled - leftIndex;
  const left = frames[leftIndex];
  const right = frames[rightIndex];
  const jointTargets = Object.fromEntries(jointIds.map((id) => [id, round(mix(left.jointTargets[id], right.jointTargets[id], amount), 2)])) as Record<JointId, number>;
  return {
    ...left,
    progress: normalized,
    centerOfMass: {
      x: round(mix(left.centerOfMass.x, right.centerOfMass.x, amount)),
      y: round(mix(left.centerOfMass.y, right.centerOfMass.y, amount)),
    },
    supportCenter: {
      x: round(mix(left.supportCenter.x, right.supportCenter.x, amount)),
      y: round(mix(left.supportCenter.y, right.supportCenter.y, amount)),
    },
    supportWidth: round(mix(left.supportWidth, right.supportWidth, amount)),
    balanceMargin: round(mix(left.balanceMargin, right.balanceMargin, amount)),
    stability: round(mix(left.stability, right.stability, amount), 2),
    fallRisk: round(mix(left.fallRisk, right.fallRisk, amount), 2),
    jointTargets,
    contacts: amount < 0.5
      ? left.contacts.map((contact) => ({ ...contact, point: { ...contact.point } }))
      : right.contacts.map((contact) => ({ ...contact, point: { ...contact.point } })),
  };
};
