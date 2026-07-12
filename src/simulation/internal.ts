import type {
  EmotionId,
  Hero,
  JournalEntry,
  NumberMap,
  Relationship,
  RelationshipId,
  TraitId,
  WorldState,
} from './model';

export const clamp = (value: number, min = 0, max = 100): number =>
  Math.max(min, Math.min(max, value));

export const signedClamp = (value: number): number => clamp(value, -100, 100);

export const traitLabels: Record<TraitId, string> = {
  kindness: 'доброта', cruelty: 'жестокость', pride: 'гордость', friendliness: 'дружелюбие',
  honesty: 'честность', patience: 'терпение', curiosity: 'любопытство', discipline: 'дисциплина',
  courage: 'смелость', caution: 'осторожность', impulsiveness: 'импульсивность', empathy: 'эмпатия',
  independence: 'самостоятельность', approvalSeeking: 'потребность в одобрении', trustfulness: 'доверчивость',
  vengefulness: 'мстительность', ambition: 'амбициозность', loyalty: 'преданность',
};

const emptyRelationship = (targetId: string): Relationship => ({
  targetId,
  values: {
    liking: 0, trust: 0, respect: 0, closeness: 0, fear: 0,
    resentment: 0, envy: 0, attraction: 0, debt: 0, rivalry: 0,
  },
});

export const cloneHero = (hero: Hero): Hero => ({
  ...hero,
  traits: { ...hero.traits },
  emotions: { ...hero.emotions },
  needs: { ...hero.needs },
  psyche: { ...hero.psyche },
  stats: { ...hero.stats },
  condition: { ...hero.condition },
  inventory: hero.inventory.map((item) => ({ ...item })),
  goals: hero.goals.map((goal) => ({ ...goal, tags: [...goal.tags] })),
  memories: hero.memories.map((memory) => ({
    ...memory,
    participants: [...memory.participants],
    tags: [...memory.tags],
  })),
  relationships: Object.fromEntries(
    Object.entries(hero.relationships).map(([id, relationship]) => [
      id,
      { ...relationship, values: { ...relationship.values } },
    ]),
  ),
  dailyPlan: hero.dailyPlan.map((block) => ({ ...block })),
  currentActivity: hero.currentActivity ? { ...hero.currentActivity } : undefined,
  currentAction: hero.currentAction
    ? { ...hero.currentAction, reasons: hero.currentAction.reasons.map((reason) => ({ ...reason })) }
    : undefined,
});

export const cloneWorld = (state: WorldState, tick = state.tick): WorldState => ({
  ...state,
  tick,
  routine: { ...state.routine },
  heroes: Object.fromEntries(
    Object.entries(state.heroes).map(([id, hero]) => [id, cloneHero(hero)]),
  ),
  journal: [...state.journal],
  expeditions: state.expeditions.map((expedition) => ({
    ...expedition,
    partyIds: [...expedition.partyIds],
    loot: expedition.loot.map((item) => ({ ...item })),
    events: expedition.events.map((event) => ({ ...event, heroIds: [...event.heroIds] })),
  })),
});

export const pushJournal = (
  world: WorldState,
  text: string,
  heroIds: string[],
  kind: JournalEntry['kind'],
): void => {
  world.journal.unshift({
    id: `${world.tick}-${world.journal.length}-${kind}`,
    tick: world.tick,
    text,
    heroIds,
    kind,
  });
  world.journal = world.journal.slice(0, 180);
};

export const changeEmotion = (hero: Hero, emotion: EmotionId, amount: number): void => {
  hero.emotions[emotion] = clamp(hero.emotions[emotion] + amount);
};

export const changeRelationship = (
  hero: Hero,
  targetId: string,
  dimension: RelationshipId,
  amount: number,
): void => {
  const relationship = hero.relationships[targetId] ?? emptyRelationship(targetId);
  relationship.values[dimension] = signedClamp(relationship.values[dimension] + amount);
  hero.relationships[targetId] = relationship;
};

export const personalityMultiplier = (
  hero: Hero,
  positive: TraitId[],
  negative: TraitId[] = [],
): number => {
  const positiveAverage = positive.length
    ? positive.reduce((total, trait) => total + hero.traits[trait], 0) / positive.length
    : 50;
  const negativeAverage = negative.length
    ? negative.reduce((total, trait) => total + hero.traits[trait], 0) / negative.length
    : 0;
  return clamp(0.55 + positiveAverage / 130 - negativeAverage / 260, 0.35, 1.65);
};

export const decayMap = <K extends string>(
  map: NumberMap<K>,
  decay: Partial<Record<K, number>>,
): void => {
  (Object.keys(map) as K[]).forEach((key) => {
    map[key] = clamp(map[key] - (decay[key] ?? 1));
  });
};

export const mergeInventory = (hero: Hero, item: Hero['inventory'][number]): void => {
  const existing = hero.inventory.find((candidate) => candidate.id === item.id);
  if (existing) existing.quantity += item.quantity;
  else hero.inventory.push({ ...item });
};

export const deterministicUnit = (seed: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
};
