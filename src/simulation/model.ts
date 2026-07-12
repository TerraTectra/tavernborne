import type { PhysicalBodyState } from './body-model';

export type TraitId =
  | 'kindness'
  | 'cruelty'
  | 'pride'
  | 'friendliness'
  | 'honesty'
  | 'patience'
  | 'curiosity'
  | 'discipline'
  | 'courage'
  | 'caution'
  | 'impulsiveness'
  | 'empathy'
  | 'independence'
  | 'approvalSeeking'
  | 'trustfulness'
  | 'vengefulness'
  | 'ambition'
  | 'loyalty';

export type EmotionId =
  | 'joy'
  | 'sadness'
  | 'anxiety'
  | 'anger'
  | 'irritation'
  | 'guilt'
  | 'shame'
  | 'fear'
  | 'hope'
  | 'interest'
  | 'loneliness'
  | 'inspiration'
  | 'affection'
  | 'envy';

export type NeedId =
  | 'hunger'
  | 'fatigue'
  | 'safety'
  | 'social'
  | 'solitude'
  | 'recognition'
  | 'growth'
  | 'belonging';

export type PsycheId =
  | 'stress'
  | 'confidence'
  | 'security'
  | 'grief'
  | 'burnout'
  | 'resilience';

export type RelationshipId =
  | 'liking'
  | 'trust'
  | 'respect'
  | 'closeness'
  | 'fear'
  | 'resentment'
  | 'envy'
  | 'attraction'
  | 'debt'
  | 'rivalry';

export type StatId = 'strength' | 'endurance' | 'dexterity' | 'magic' | 'perception';

export type ActionId =
  | 'eat'
  | 'sleep'
  | 'train'
  | 'read'
  | 'talk'
  | 'help'
  | 'apologize'
  | 'seekSolitude'
  | 'work'
  | 'dungeon'
  | 'recover';

export type SocialActionId = Extract<ActionId, 'talk' | 'help' | 'apologize'>;

export type EventType =
  | 'praise'
  | 'insult'
  | 'helped'
  | 'rejected'
  | 'sharedTask'
  | 'argument'
  | 'gift'
  | 'failure'
  | 'injury'
  | 'loss';

export type NumberMap<K extends string> = Record<K, number>;

export interface Goal {
  id: string;
  label: string;
  priority: number;
  tags: string[];
}

export interface Memory {
  id: string;
  summary: string;
  createdAt: number;
  importance: number;
  valence: number;
  participants: string[];
  tags: string[];
  sourceEventType: EventType | 'action' | 'dungeon' | 'social';
}

export interface Relationship {
  targetId: string;
  values: NumberMap<RelationshipId>;
}

export interface DecisionReason {
  label: string;
  value: number;
}

export interface ActionScore {
  actionId: ActionId;
  label: string;
  score: number;
  targetId?: string;
  reasons: DecisionReason[];
}

export type PlanSource = 'routine' | 'personal' | 'group' | 'replan' | 'crisis';
export type PlanStatus = 'planned' | 'active' | 'done' | 'skipped' | 'interrupted';

export interface PlanBlock {
  id: string;
  day: number;
  startHour: number;
  endHour: number;
  actionId: ActionId;
  label: string;
  source: PlanSource;
  status: PlanStatus;
  targetId?: string;
  groupId?: string;
  expeditionId?: string;
  socialSceneId?: string;
  reason?: string;
}

export interface ActivityState {
  actionId: ActionId;
  label: string;
  startedAt: number;
  durationHours: number;
  remainingHours: number;
  source: PlanSource;
  targetId?: string;
  planBlockId?: string;
  expeditionId?: string;
  socialSceneId?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  category: 'weapon' | 'armor' | 'consumable' | 'material' | 'loot' | 'book';
}

export interface HeroCondition {
  health: number;
  injury: number;
}

export interface Hero {
  id: string;
  name: string;
  age: number;
  traits: NumberMap<TraitId>;
  emotions: NumberMap<EmotionId>;
  needs: NumberMap<NeedId>;
  psyche: NumberMap<PsycheId>;
  stats: NumberMap<StatId>;
  body: PhysicalBodyState;
  condition: HeroCondition;
  inventory: InventoryItem[];
  goals: Goal[];
  memories: Memory[];
  relationships: Record<string, Relationship>;
  dailyPlan: PlanBlock[];
  planDay: number;
  lastReplanTick: number;
  lastSocialTick: number;
  currentActivity?: ActivityState;
  currentAction?: ActionScore;
}

export interface SimulationEvent {
  id: string;
  type: EventType;
  actorId: string;
  targetId?: string;
  intensity: number;
  description: string;
  tags: string[];
}

export interface JournalEntry {
  id: string;
  tick: number;
  text: string;
  heroIds: string[];
  kind: 'event' | 'decision' | 'system' | 'dungeon' | 'social';
}

export interface SocialLine {
  id: string;
  tick: number;
  speakerId: string;
  text: string;
  tone: 'warm' | 'neutral' | 'awkward' | 'tense' | 'apologetic';
}

export type SocialResponse = 'accepted' | 'deferred' | 'refused';
export type SocialSceneStatus = 'active' | 'resolved';

export interface SocialScene {
  id: string;
  actionId: SocialActionId;
  initiatorId: string;
  targetId: string;
  createdAt: number;
  status: SocialSceneStatus;
  response: SocialResponse;
  remainingHours: number;
  planBlockIds: string[];
  lines: SocialLine[];
  reason: string;
  outcome?: string;
}

export interface DungeonEvent {
  id: string;
  tick: number;
  type: 'travel' | 'battle' | 'discovery' | 'danger' | 'rest' | 'bond' | 'return';
  text: string;
  heroIds: string[];
}

export interface Expedition {
  id: string;
  day: number;
  floor: number;
  partyIds: string[];
  departTick: number;
  plannedReturnTick: number;
  status: 'planned' | 'active' | 'returning' | 'completed' | 'retreated';
  progress: number;
  risk: number;
  loot: InventoryItem[];
  events: DungeonEvent[];
  outcome?: string;
}

export interface FamilyRoutine {
  wakeHour: number;
  breakfastHour: number;
  lunchHour: number;
  dinnerHour: number;
  sleepHour: number;
}

export interface God {
  id: 'god';
  name: string;
  title: string;
}

export interface WorldState {
  version: number;
  seed: string;
  tick: number;
  god: God;
  heroes: Record<string, Hero>;
  journal: JournalEntry[];
  socialScenes: SocialScene[];
  expeditions: Expedition[];
  routine: FamilyRoutine;
  nextSocialSceneId: number;
  nextExpeditionId: number;
}
