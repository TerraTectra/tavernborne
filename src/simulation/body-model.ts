export type BodySide = 'left' | 'right';
export type SupportFoot = BodySide | 'both' | 'none';

export type BodySegmentId =
  | 'head'
  | 'neck'
  | 'chest'
  | 'abdomen'
  | 'pelvis'
  | 'leftUpperArm'
  | 'leftForearm'
  | 'leftHand'
  | 'rightUpperArm'
  | 'rightForearm'
  | 'rightHand'
  | 'leftThigh'
  | 'leftShin'
  | 'leftFoot'
  | 'rightThigh'
  | 'rightShin'
  | 'rightFoot';

export type JointId =
  | 'neck'
  | 'spine'
  | 'leftShoulder'
  | 'leftElbow'
  | 'leftWrist'
  | 'rightShoulder'
  | 'rightElbow'
  | 'rightWrist'
  | 'leftHip'
  | 'leftKnee'
  | 'leftAnkle'
  | 'rightHip'
  | 'rightKnee'
  | 'rightAnkle';

export type MovementFamily =
  | 'drivingStrike'
  | 'reachThrust'
  | 'mobileEvasion'
  | 'grapplingControl'
  | 'flowingTransition'
  | 'rootedGuard'
  | 'enduranceFootwork'
  | 'fineManipulation';

export type MovementAvailability = 'natural' | 'difficult' | 'restricted';
export type MotorPatternPurpose = 'attack' | 'defense' | 'mobility' | 'control' | 'precision';
export type MotorSchoolArchetype = 'force' | 'mobility' | 'precision';

export interface BodyVector2 {
  x: number;
  y: number;
}

export interface AnthropometryState {
  heightCm: number;
  massKg: number;
  bodyFatPercent: number;
  muscleMassKg: number;
  boneMassKg: number;
  shoulderWidthCm: number;
  hipWidthCm: number;
  armSpanCm: number;
  legLengthCm: number;
  torsoLengthCm: number;
}

export interface BodyTissueState {
  muscleTone: number;
  muscleFatigue: number;
  muscleCondition: number;
  tendonCondition: number;
  boneDensity: number;
  flexibility: number;
  hydration: number;
}

export interface NervousBodyState {
  coordination: number;
  balance: number;
  proprioception: number;
  motorLearning: number;
  reflexQuality: number;
  reactionTimeMs: number;
}

export interface BodySegmentState {
  id: BodySegmentId;
  parentId?: BodySegmentId;
  lengthCm: number;
  thicknessCm: number;
  massKg: number;
  health: number;
  pain: number;
  fatigue: number;
}

export interface JointState {
  id: JointId;
  parentSegmentId: BodySegmentId;
  childSegmentId: BodySegmentId;
  angleDeg: number;
  restAngleDeg: number;
  minAngleDeg: number;
  maxAngleDeg: number;
  angularVelocityDegS: number;
  stability: number;
  mobility: number;
  pain: number;
}

export interface BodyPoseState {
  name: 'neutral' | 'walking' | 'working' | 'training' | 'guarding' | 'resting' | 'injured';
  supportFoot: SupportFoot;
  centerOfMass: BodyVector2;
  stability: number;
  stanceWidthCm: number;
  facing: BodySide;
}

export interface PhysicalLimitState {
  maxJointSpeedDegS: number;
  maxLimbSpeedMS: number;
  safeAccelerationG: number;
  physicalSpeedCeiling: number;
  forceTransferEfficiency: number;
}

export interface MovementAffinityState {
  family: MovementFamily;
  aptitude: number;
  learningRate: number;
  masteryCeiling: number;
  strainRisk: number;
  availability: MovementAvailability;
}

export interface BodyAffinityState {
  power: number;
  acceleration: number;
  mobility: number;
  stability: number;
  endurance: number;
  recovery: number;
  precision: number;
  adaptability: number;
  movement: Record<MovementFamily, MovementAffinityState>;
}

export interface MotorPatternParameters {
  stanceWidthRatio: number;
  weightTransfer: number;
  hipRotationDeg: number;
  reachExtension: number;
  tempo: number;
  forceCommitment: number;
  recoveryPriority: number;
}

export interface MotorPatternState {
  id: string;
  family: MovementFamily;
  purpose: MotorPatternPurpose;
  name: string;
  discoveredAt: number;
  lastPracticedTick: number;
  dominantSide: BodySide;
  parameters: MotorPatternParameters;
  repetitions: number;
  successes: number;
  failures: number;
  bestQuality: number;
  averageQuality: number;
  mastery: number;
  reliability: number;
  efficiency: number;
  strain: number;
  schoolId?: string;
}

export interface MotorSchoolState {
  id: string;
  name: string;
  archetype: MotorSchoolArchetype;
  foundedAt: number;
  updatedAt: number;
  familyIds: MovementFamily[];
  patternIds: string[];
  maturity: number;
  cohesion: number;
  signature: MotorPatternParameters;
}

export interface MotorMemoryState {
  nextPatternId: number;
  nextSchoolId: number;
  patterns: MotorPatternState[];
  schools: MotorSchoolState[];
  totalAttempts: number;
  successfulAttempts: number;
  lastAttemptTick?: number;
}

export interface PhysicalBodyState {
  version: 1;
  anthropometry: AnthropometryState;
  tissues: BodyTissueState;
  nervous: NervousBodyState;
  pose: BodyPoseState;
  limits: PhysicalLimitState;
  affinity: BodyAffinityState;
  motorMemory: MotorMemoryState;
  segments: Record<BodySegmentId, BodySegmentState>;
  joints: Record<JointId, JointState>;
  lastUpdatedTick: number;
}

export interface PhysicalBodyProfile {
  heightCm: number;
  massKg: number;
  bodyFatPercent: number;
  shoulderRatio?: number;
  hipRatio?: number;
  legRatio?: number;
  armSpanRatio?: number;
  muscleBias?: number;
  flexibilityBias?: number;
  coordinationBias?: number;
  boneDensityBias?: number;
  powerBias?: number;
  accelerationBias?: number;
  mobilityBias?: number;
  stabilityBias?: number;
  enduranceBias?: number;
  recoveryBias?: number;
  precisionBias?: number;
  adaptabilityBias?: number;
}
