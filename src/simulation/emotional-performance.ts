import { activeLifeSceneOf } from './life-scenes';
import type { Hero, WorldState } from './model';
import type { ChoreographedDirective } from './social-choreography';
import { activeVisualSceneOf } from './visual-scenes';

export type EmotionalPerformanceId =
  | 'neutral'
  | 'uplifted'
  | 'affectionate'
  | 'focused'
  | 'anxious'
  | 'fearful'
  | 'angry'
  | 'guilty'
  | 'withdrawn'
  | 'exhausted';

export interface EmotionalPerformanceMetadata {
  emotionalPerformance: EmotionalPerformanceId;
  emotionalIntensity: number;
  movementRate: number;
  animationRate: number;
  bodyLean: number;
  bodyTension: number;
  expressionSymbol: string;
  expressionColor: string;
}

export type EmotionallyPerformedDirective = ChoreographedDirective & EmotionalPerformanceMetadata;

type PerformanceProfile = Omit<EmotionalPerformanceMetadata, 'emotionalIntensity'>;

const clamp = (value: number, min = 0, max = 100): number => Math.max(min, Math.min(max, value));

const profiles: Record<EmotionalPerformanceId, PerformanceProfile> = {
  neutral: {
    emotionalPerformance: 'neutral', movementRate: 1, animationRate: 1, bodyLean: 0, bodyTension: 0.18,
    expressionSymbol: '', expressionColor: '#cbd5e1',
  },
  uplifted: {
    emotionalPerformance: 'uplifted', movementRate: 1.12, animationRate: 1.08, bodyLean: -0.025, bodyTension: 0.2,
    expressionSymbol: '✦', expressionColor: '#f6d365',
  },
  affectionate: {
    emotionalPerformance: 'affectionate', movementRate: 0.94, animationRate: 0.92, bodyLean: -0.035, bodyTension: 0.12,
    expressionSymbol: '♡', expressionColor: '#f4a7b9',
  },
  focused: {
    emotionalPerformance: 'focused', movementRate: 1.02, animationRate: 1.01, bodyLean: -0.02, bodyTension: 0.56,
    expressionSymbol: '◆', expressionColor: '#8ecae6',
  },
  anxious: {
    emotionalPerformance: 'anxious', movementRate: 1.08, animationRate: 1.12, bodyLean: 0.035, bodyTension: 0.7,
    expressionSymbol: '⋯', expressionColor: '#d6bcfa',
  },
  fearful: {
    emotionalPerformance: 'fearful', movementRate: 1.14, animationRate: 1.16, bodyLean: 0.07, bodyTension: 0.86,
    expressionSymbol: '!', expressionColor: '#c4b5fd',
  },
  angry: {
    emotionalPerformance: 'angry', movementRate: 1.18, animationRate: 1.16, bodyLean: -0.075, bodyTension: 0.94,
    expressionSymbol: '!', expressionColor: '#fb7185',
  },
  guilty: {
    emotionalPerformance: 'guilty', movementRate: 0.82, animationRate: 0.82, bodyLean: 0.09, bodyTension: 0.48,
    expressionSymbol: '…', expressionColor: '#94a3b8',
  },
  withdrawn: {
    emotionalPerformance: 'withdrawn', movementRate: 0.76, animationRate: 0.76, bodyLean: 0.12, bodyTension: 0.24,
    expressionSymbol: '·', expressionColor: '#7dd3fc',
  },
  exhausted: {
    emotionalPerformance: 'exhausted', movementRate: 0.62, animationRate: 0.64, bodyLean: 0.16, bodyTension: 0.1,
    expressionSymbol: 'z', expressionColor: '#a8a29e',
  },
};

const relationshipWarmth = (hero: Hero, partnerId: string | undefined): number => {
  if (!partnerId) return 0;
  const values = hero.relationships[partnerId]?.values;
  if (!values) return 0;
  return Math.max(0, values.closeness) * 0.35 + Math.max(0, values.liking) * 0.2 + Math.max(0, values.trust) * 0.15;
};

const partnerForScene = (world: WorldState, heroId: string): string | undefined => {
  const life = activeLifeSceneOf(world);
  if (life?.participantIds.includes(heroId)) {
    if (heroId === life.initiatorId) return life.targetId;
    if (heroId === life.targetId) return life.initiatorId;
    return life.dialogue[life.currentLineIndex]?.speakerId;
  }
  const visual = activeVisualSceneOf(world);
  if (visual?.participantIds.includes(heroId)) return visual.dialogue[visual.currentLineIndex]?.speakerId;
  return undefined;
};

const sceneBoosts = (world: WorldState, heroId: string): Partial<Record<EmotionalPerformanceId, number>> => {
  const boosts: Partial<Record<EmotionalPerformanceId, number>> = {};
  const add = (id: EmotionalPerformanceId, value: number) => { boosts[id] = (boosts[id] ?? 0) + value; };
  const life = activeLifeSceneOf(world);
  const visual = activeVisualSceneOf(world);
  const scene = life ?? visual;
  if (!scene?.participantIds.includes(heroId)) return boosts;

  const line = scene.dialogue[scene.currentLineIndex];
  const tone = line?.tone ?? 'neutral';
  const isSpeaker = line?.speakerId === heroId;
  if (tone === 'angry') add('angry', isSpeaker ? 36 : 18);
  if (tone === 'hurt') add(isSpeaker ? 'withdrawn' : 'guilty', 25);
  if (tone === 'apologetic') add(isSpeaker ? 'guilty' : 'affectionate', 28);
  if (tone === 'warm') { add('affectionate', 22); add('uplifted', 10); }
  if (tone === 'firm') add('focused', isSpeaker ? 18 : 8);

  if (life) {
    const role = life.roles[heroId];
    if (life.type === 'conflict') {
      if (role === 'initiator') add('angry', 24);
      if (role === 'target') { add('anxious', 16); add('fearful', 10); }
      if (role === 'mediator') add('focused', 22);
    }
    if (life.type === 'treatment') {
      if (role === 'healer') { add('focused', 22); add('affectionate', 10); }
      if (role === 'patient') { add('exhausted', 20); add('anxious', 10); }
    }
    if (life.type === 'apology') {
      if (role === 'initiator') add('guilty', 30);
      if (role === 'target') add('anxious', 10);
    }
    if (life.type === 'meal') { add('uplifted', 10); add('affectionate', 8); }
    if (life.type === 'debrief' && role === 'leader') add('focused', 18);
  } else if (visual) {
    if (visual.phase === 'departure' || visual.phase === 'equipping') add('focused', 22);
    if (heroId === visual.leaderId) add('focused', 12);
  }

  return boosts;
};

export const emotionalPerformanceForHero = (world: WorldState, heroId: string): EmotionalPerformanceMetadata => {
  const hero = world.heroes[heroId];
  if (!hero) return { ...profiles.neutral, emotionalIntensity: 0 };
  const e = hero.emotions;
  const p = hero.psyche;
  const partnerId = partnerForScene(world, heroId);
  const warmth = relationshipWarmth(hero, partnerId);
  const boosts = sceneBoosts(world, heroId);
  const scores: Record<Exclude<EmotionalPerformanceId, 'neutral'>, number> = {
    uplifted: e.joy * 0.8 + e.hope * 0.55 + e.inspiration * 0.5 + (boosts.uplifted ?? 0),
    affectionate: e.affection * 0.85 + e.joy * 0.22 + hero.traits.empathy * 0.14 + warmth + (boosts.affectionate ?? 0),
    focused: e.interest * 0.62 + e.inspiration * 0.32 + p.confidence * 0.22 + hero.traits.discipline * 0.18 + (boosts.focused ?? 0),
    anxious: e.anxiety * 0.9 + p.stress * 0.36 + e.fear * 0.22 + (boosts.anxious ?? 0),
    fearful: e.fear * 0.95 + e.anxiety * 0.34 + (100 - p.security) * 0.25 + (boosts.fearful ?? 0),
    angry: e.anger * 0.92 + e.irritation * 0.72 + p.stress * 0.24 + (boosts.angry ?? 0),
    guilty: e.guilt * 0.94 + e.shame * 0.82 + hero.traits.approvalSeeking * 0.14 + (boosts.guilty ?? 0),
    withdrawn: e.sadness * 0.72 + e.loneliness * 0.76 + hero.needs.solitude * 0.3 + p.burnout * 0.2 + (boosts.withdrawn ?? 0),
    exhausted: hero.needs.fatigue * 0.76 + p.burnout * 0.72 + hero.body.tissues.muscleFatigue * 0.3 + hero.condition.injury * 0.24 + (boosts.exhausted ?? 0),
  };

  const [winner, rawScore] = (Object.entries(scores) as [Exclude<EmotionalPerformanceId, 'neutral'>, number][])
    .sort((left, right) => right[1] - left[1])[0];
  const id: EmotionalPerformanceId = rawScore >= 38 ? winner : 'neutral';
  const intensity = id === 'neutral' ? clamp(rawScore * 0.45) : clamp(rawScore);
  return { ...profiles[id], emotionalIntensity: intensity };
};

const distanceAdjustment = (performance: EmotionalPerformanceId): number => {
  if (performance === 'affectionate') return -0.55;
  if (performance === 'uplifted') return -0.22;
  if (performance === 'angry') return -0.18;
  if (performance === 'anxious') return 0.35;
  if (performance === 'fearful') return 0.72;
  if (performance === 'guilty') return 0.42;
  if (performance === 'withdrawn') return 0.62;
  if (performance === 'exhausted') return 0.22;
  return 0;
};

const emotionallyOffsetPosition = (
  directive: ChoreographedDirective,
  performance: EmotionalPerformanceMetadata,
): { x: number; y: number } => {
  if (!directive.focusPoint || !directive.formation || !['pair', 'care', 'conflict'].includes(directive.formation)) return directive.position;
  let amount = distanceAdjustment(performance.emotionalPerformance) * clamp(performance.emotionalIntensity / 100, 0.35, 1);
  if (directive.formation === 'conflict') amount *= 0.45;
  if (directive.formation === 'care') amount *= 0.35;
  const dx = directive.position.x - directive.focusPoint.x;
  const dy = directive.position.y - directive.focusPoint.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.01 || Math.abs(amount) < 0.01) return directive.position;
  return { x: directive.position.x + (dx / length) * amount, y: directive.position.y + (dy / length) * amount };
};

export const performEmotion = (
  world: WorldState,
  heroId: string,
  directive: ChoreographedDirective | undefined,
): EmotionallyPerformedDirective | undefined => {
  if (!directive) return undefined;
  const performance = emotionalPerformanceForHero(world, heroId);
  return { ...directive, ...performance, position: emotionallyOffsetPosition(directive, performance) };
};
