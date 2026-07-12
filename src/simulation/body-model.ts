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

export interface PhysicalBodyState {
  version: 1;
  anthropometry: AnthropometryState;
  tissues: BodyTissueState;
  nervous: NervousBodyState;
  pose: BodyPoseState;
  limits: PhysicalLimitState;
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
}
