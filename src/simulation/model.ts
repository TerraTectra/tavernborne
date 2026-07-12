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

export type ActionId =
  | 'eat'
  | 'sleep'
  | 'train'
  | 'read'
  | 'talk'
  | 'help'
  | 'apologize'
  | 'seekSolitude'
  | 'work';

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
  sourceEventType: EventType | 'action';
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

export interface Hero {
  id: string;
  name: string;
  age: number;
  traits: NumberMap<TraitId>;
  emotions: NumberMap<EmotionId>;
  needs: NumberMap<NeedId>;
  psyche: NumberMap<PsycheId>;
  goals: Goal[];
  memories: Memory[];
  relationships: Record<string, Relationship>;
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
  kind: 'event' | 'decision' | 'system';
}

export interface God {
  id: 'god';
  name: string;
  title: string;
}

export interface WorldState {
  tick: number;
  god: God;
  heroes: Record<string, Hero>;
  journal: JournalEntry[];
}
