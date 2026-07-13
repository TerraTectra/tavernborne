import type { EmotionallyPerformedDirective } from './emotional-performance';
import type { Hero, RelationshipId, WorldState } from './model';

export type RelationshipPerformanceId =
  | 'neutral' | 'bonded' | 'trusting' | 'respectful' | 'protective'
  | 'deferential' | 'guarded' | 'intimidated' | 'resentful' | 'rivalrous';
export type RelationshipGaze = 'direct' | 'soft' | 'attentive' | 'watchful' | 'lowered' | 'sidelong' | 'avoidant' | 'hard' | 'challenging';
export type RelationshipGesture = 'neutral' | 'mirror' | 'open' | 'nod' | 'shield' | 'yield' | 'closed' | 'flinch' | 'dismiss' | 'challenge';
export type RelationshipSpeechStyle = 'neutral' | 'warm' | 'open' | 'formal' | 'protective' | 'subdued' | 'careful' | 'hesitant' | 'cold' | 'competitive';
export type LeadershipStance = 'none' | 'leader' | 'loyal' | 'deferential' | 'skeptical' | 'challenger';

export interface RelationshipPerformanceMetadata {
  relationshipPerformance: RelationshipPerformanceId;
  relationshipIntensity: number;
  relationshipApproachRate: number;
  relationshipAnimationRate: number;
  relationshipLean: number;
  relationshipTurn: number;
  relationshipDistanceOffset: number;
  relationshipGaze: RelationshipGaze;
  relationshipGesture: RelationshipGesture;
  relationshipSpeechStyle: RelationshipSpeechStyle;
  relationshipSymbol: string;
  relationshipColor: string;
  relationshipPartnerId?: string;
  leadershipStance: LeadershipStance;
}

export type RelationallyPerformedDirective = EmotionallyPerformedDirective & RelationshipPerformanceMetadata;
type Profile = Omit<RelationshipPerformanceMetadata, 'relationshipIntensity' | 'relationshipPartnerId' | 'leadershipStance'>;
type LeadershipWorld = WorldState & {
  leadership?: {
    familyLeaderId?: string;
    people?: Record<string, {
      role?: string;
      bonds?: Record<string, {
        authority?: number; obedience?: number; politicalLoyalty?: number;
        confidence?: number; grievance?: number; groupBond?: number;
      }>;
    }>;
  };
};

const clamp = (value: number, min = 0, max = 100): number => Math.max(min, Math.min(max, value));
const profiles: Record<RelationshipPerformanceId, Profile> = {
  neutral: { relationshipPerformance: 'neutral', relationshipApproachRate: 1, relationshipAnimationRate: 1, relationshipLean: 0, relationshipTurn: 0, relationshipDistanceOffset: 0, relationshipGaze: 'direct', relationshipGesture: 'neutral', relationshipSpeechStyle: 'neutral', relationshipSymbol: '', relationshipColor: '#cbd5e1' },
  bonded: { relationshipPerformance: 'bonded', relationshipApproachRate: 1.04, relationshipAnimationRate: 0.92, relationshipLean: -0.025, relationshipTurn: -0.035, relationshipDistanceOffset: -1.15, relationshipGaze: 'soft', relationshipGesture: 'mirror', relationshipSpeechStyle: 'warm', relationshipSymbol: '∞', relationshipColor: '#f9a8d4' },
  trusting: { relationshipPerformance: 'trusting', relationshipApproachRate: 1.02, relationshipAnimationRate: 0.96, relationshipLean: -0.015, relationshipTurn: -0.02, relationshipDistanceOffset: -0.55, relationshipGaze: 'direct', relationshipGesture: 'open', relationshipSpeechStyle: 'open', relationshipSymbol: '○', relationshipColor: '#86efac' },
  respectful: { relationshipPerformance: 'respectful', relationshipApproachRate: 0.98, relationshipAnimationRate: 0.94, relationshipLean: 0.015, relationshipTurn: 0.02, relationshipDistanceOffset: 0.18, relationshipGaze: 'attentive', relationshipGesture: 'nod', relationshipSpeechStyle: 'formal', relationshipSymbol: '◇', relationshipColor: '#fde68a' },
  protective: { relationshipPerformance: 'protective', relationshipApproachRate: 1.08, relationshipAnimationRate: 1.03, relationshipLean: -0.055, relationshipTurn: -0.045, relationshipDistanceOffset: -0.7, relationshipGaze: 'watchful', relationshipGesture: 'shield', relationshipSpeechStyle: 'protective', relationshipSymbol: '⛨', relationshipColor: '#67e8f9' },
  deferential: { relationshipPerformance: 'deferential', relationshipApproachRate: 0.92, relationshipAnimationRate: 0.9, relationshipLean: 0.055, relationshipTurn: 0.075, relationshipDistanceOffset: 0.45, relationshipGaze: 'lowered', relationshipGesture: 'yield', relationshipSpeechStyle: 'subdued', relationshipSymbol: '↓', relationshipColor: '#c4b5fd' },
  guarded: { relationshipPerformance: 'guarded', relationshipApproachRate: 0.9, relationshipAnimationRate: 0.94, relationshipLean: 0.05, relationshipTurn: 0.1, relationshipDistanceOffset: 1.15, relationshipGaze: 'sidelong', relationshipGesture: 'closed', relationshipSpeechStyle: 'careful', relationshipSymbol: '|', relationshipColor: '#93c5fd' },
  intimidated: { relationshipPerformance: 'intimidated', relationshipApproachRate: 1.08, relationshipAnimationRate: 1.08, relationshipLean: 0.085, relationshipTurn: 0.14, relationshipDistanceOffset: 1.55, relationshipGaze: 'avoidant', relationshipGesture: 'flinch', relationshipSpeechStyle: 'hesitant', relationshipSymbol: '!', relationshipColor: '#a78bfa' },
  resentful: { relationshipPerformance: 'resentful', relationshipApproachRate: 1.04, relationshipAnimationRate: 1.08, relationshipLean: -0.055, relationshipTurn: 0.08, relationshipDistanceOffset: 0.85, relationshipGaze: 'hard', relationshipGesture: 'dismiss', relationshipSpeechStyle: 'cold', relationshipSymbol: '×', relationshipColor: '#fb7185' },
  rivalrous: { relationshipPerformance: 'rivalrous', relationshipApproachRate: 1.12, relationshipAnimationRate: 1.1, relationshipLean: -0.075, relationshipTurn: -0.08, relationshipDistanceOffset: -0.15, relationshipGaze: 'challenging', relationshipGesture: 'challenge', relationshipSpeechStyle: 'competitive', relationshipSymbol: '⇄', relationshipColor: '#f59e0b' },
};
const labels: Record<RelationshipPerformanceId, string> = {
  neutral: '', bonded: 'держится по-семейному близко', trusting: 'говорит открыто', respectful: 'проявляет уважение',
  protective: 'прикрывает собеседника', deferential: 'уступает авторитету', guarded: 'держит защитную дистанцию',
  intimidated: 'избегает прямого давления', resentful: 'говорит холодно', rivalrous: 'бросает вызов',
};

const valueOf = (hero: Hero, partnerId: string, key: RelationshipId): number => hero.relationships[partnerId]?.values[key] ?? 0;
const leadershipContext = (world: WorldState, heroId: string, partnerId: string) => {
  const leadership = (world as LeadershipWorld).leadership;
  const person = leadership?.people?.[heroId];
  const bond = person?.bonds?.[partnerId];
  const partnerIsLeader = leadership?.familyLeaderId === partnerId;
  const heroIsLeader = leadership?.familyLeaderId === heroId;
  const authority = bond?.authority ?? 0;
  const obedience = bond?.obedience ?? 0;
  const politicalLoyalty = bond?.politicalLoyalty ?? 0;
  const confidence = bond?.confidence ?? 0;
  const grievance = bond?.grievance ?? 0;
  let stance: LeadershipStance = 'none';
  if (heroIsLeader) stance = 'leader';
  else if (partnerIsLeader && (person?.role === 'challenger' || grievance >= 58)) stance = 'challenger';
  else if (partnerIsLeader && politicalLoyalty >= 62 && confidence >= 52) stance = 'loyal';
  else if (partnerIsLeader && (authority >= 58 || obedience >= 58)) stance = 'deferential';
  else if (partnerIsLeader && (grievance >= 34 || confidence <= 34)) stance = 'skeptical';
  return { authority, obedience, politicalLoyalty, confidence, grievance, stance };
};

const partnerFor = (world: WorldState, heroId: string, directive?: EmotionallyPerformedDirective): string | undefined => {
  if (directive?.partnerId && directive.partnerId !== heroId) return directive.partnerId;
  if (directive?.targetId && directive.targetId !== heroId) return directive.targetId;
  const leaderId = (world as LeadershipWorld).leadership?.familyLeaderId;
  if ((directive?.formation === 'line' || directive?.formation === 'table') && leaderId !== heroId) return leaderId;
  return world.heroes[heroId]?.currentAction?.targetId;
};

export const relationshipPerformanceForHero = (world: WorldState, heroId: string, partnerId?: string): RelationshipPerformanceMetadata => {
  const hero = world.heroes[heroId];
  const partner = partnerId ? world.heroes[partnerId] : undefined;
  if (!hero || !partner || partner.id === hero.id) return { ...profiles.neutral, relationshipIntensity: 0, relationshipPartnerId: partnerId, leadershipStance: 'none' };

  const liking = valueOf(hero, partner.id, 'liking');
  const trust = valueOf(hero, partner.id, 'trust');
  const respect = valueOf(hero, partner.id, 'respect');
  const closeness = valueOf(hero, partner.id, 'closeness');
  const fear = valueOf(hero, partner.id, 'fear');
  const resentment = valueOf(hero, partner.id, 'resentment');
  const envy = valueOf(hero, partner.id, 'envy');
  const attraction = valueOf(hero, partner.id, 'attraction');
  const rivalry = valueOf(hero, partner.id, 'rivalry');
  const lead = leadershipContext(world, hero.id, partner.id);

  const scores: Record<Exclude<RelationshipPerformanceId, 'neutral'>, number> = {
    bonded: Math.max(0, closeness) * 0.82 + Math.max(0, liking) * 0.38 + Math.max(0, trust) * 0.24 + Math.max(0, attraction) * 0.2,
    trusting: Math.max(0, trust) * 0.82 + Math.max(0, respect) * 0.28 + Math.max(0, closeness) * 0.18,
    respectful: Math.max(0, respect) * 0.86 + Math.max(0, trust) * 0.18 + lead.authority * 0.22,
    protective: Math.max(0, closeness) * 0.4 + Math.max(0, liking) * 0.32 + Math.max(0, trust) * 0.25 + hero.traits.empathy * 0.22 + partner.condition.injury * 0.42,
    deferential: lead.authority * 0.52 + lead.obedience * 0.32 + lead.politicalLoyalty * 0.24 + hero.traits.loyalty * 0.14 - hero.traits.independence * 0.16,
    guarded: Math.max(0, 35 - trust) * 1.08 + hero.traits.caution * 0.28 + Math.max(0, resentment) * 0.34 + Math.max(0, fear) * 0.18,
    intimidated: Math.max(0, fear) * 0.9 + lead.authority * 0.24 + Math.max(0, 100 - hero.psyche.security) * 0.24 + hero.emotions.fear * 0.22,
    resentful: Math.max(0, resentment) * 0.94 + hero.emotions.anger * 0.24 + lead.grievance * 0.4,
    rivalrous: Math.max(0, rivalry) * 0.9 + Math.max(0, envy) * 0.42 + hero.traits.ambition * 0.2 + hero.traits.pride * 0.14,
  };
  if (lead.stance === 'challenger') scores.rivalrous += 34;
  if (lead.stance === 'skeptical') { scores.guarded += 18; scores.resentful += 12; }
  if (lead.stance === 'loyal') { scores.respectful += 18; scores.deferential += 12; }
  if (lead.stance === 'deferential') scores.deferential += 24;
  if (partner.condition.injury >= 28 && liking + trust + closeness > 45) scores.protective += 28;

  const [winner, rawScore] = (Object.entries(scores) as [Exclude<RelationshipPerformanceId, 'neutral'>, number][]).sort((a, b) => b[1] - a[1])[0];
  const id: RelationshipPerformanceId = rawScore >= 42 ? winner : 'neutral';
  return { ...profiles[id], relationshipIntensity: id === 'neutral' ? clamp(rawScore * 0.42) : clamp(rawScore), relationshipPartnerId: partner.id, leadershipStance: lead.stance };
};

const offsetPosition = (directive: EmotionallyPerformedDirective, performance: RelationshipPerformanceMetadata) => {
  if (!directive.focusPoint || !directive.formation || !['pair', 'care', 'conflict'].includes(directive.formation)) return directive.position;
  let amount = performance.relationshipDistanceOffset * clamp(performance.relationshipIntensity / 100, 0.32, 1);
  if (directive.formation === 'conflict') amount *= 0.42;
  if (directive.formation === 'care') amount *= 0.28;
  const dx = directive.position.x - directive.focusPoint.x;
  const dy = directive.position.y - directive.focusPoint.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.01 || Math.abs(amount) < 0.01) return directive.position;
  return { x: directive.position.x + (dx / length) * amount, y: directive.position.y + (dy / length) * amount };
};

export const performRelationship = (world: WorldState, heroId: string, directive: EmotionallyPerformedDirective | undefined): RelationallyPerformedDirective | undefined => {
  if (!directive) return undefined;
  const performance = relationshipPerformanceForHero(world, heroId, partnerFor(world, heroId, directive));
  const strength = clamp(performance.relationshipIntensity / 100, 0, 1);
  const dominates = performance.relationshipPerformance !== 'neutral' && performance.relationshipIntensity >= directive.emotionalIntensity * 0.82;
  const leadershipReaction = performance.leadershipStance === 'challenger' ? 'оспаривает право вести'
    : performance.leadershipStance === 'loyal' ? 'поддерживает лидера'
      : performance.leadershipStance === 'deferential' ? 'признаёт старшинство'
        : performance.leadershipStance === 'skeptical' ? 'сомневается в авторитете' : undefined;
  const reaction = directive.reaction ?? leadershipReaction ?? labels[performance.relationshipPerformance];

  return {
    ...directive,
    ...performance,
    position: offsetPosition(directive, performance),
    movementRate: clamp(directive.movementRate * performance.relationshipApproachRate, 0.48, 1.42),
    animationRate: clamp(directive.animationRate * performance.relationshipAnimationRate, 0.36, 1.48),
    bodyLean: directive.bodyLean + performance.relationshipLean * strength,
    bodyTension: clamp(directive.bodyTension + strength * (performance.relationshipGesture === 'mirror' ? -0.08 : 0.16), 0, 1),
    expressionSymbol: dominates ? performance.relationshipSymbol : directive.expressionSymbol,
    expressionColor: dominates ? performance.relationshipColor : directive.expressionColor,
    reaction: reaction || undefined,
  };
};
