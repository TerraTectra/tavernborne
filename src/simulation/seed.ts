import type {
  EmotionId,
  Hero,
  NeedId,
  NumberMap,
  PsycheId,
  RelationshipId,
  TraitId,
  WorldState,
} from './model';

const traits = (values: Partial<NumberMap<TraitId>>): NumberMap<TraitId> => ({
  kindness: 50,
  cruelty: 20,
  pride: 50,
  friendliness: 50,
  honesty: 50,
  patience: 50,
  curiosity: 50,
  discipline: 50,
  courage: 50,
  caution: 50,
  impulsiveness: 50,
  empathy: 50,
  independence: 50,
  approvalSeeking: 50,
  trustfulness: 50,
  vengefulness: 30,
  ambition: 50,
  loyalty: 50,
  ...values,
});

const emotions = (values: Partial<NumberMap<EmotionId>> = {}): NumberMap<EmotionId> => ({
  joy: 30,
  sadness: 5,
  anxiety: 10,
  anger: 0,
  irritation: 5,
  guilt: 0,
  shame: 0,
  fear: 5,
  hope: 45,
  interest: 40,
  loneliness: 15,
  inspiration: 25,
  affection: 20,
  envy: 0,
  ...values,
});

const needs = (values: Partial<NumberMap<NeedId>> = {}): NumberMap<NeedId> => ({
  hunger: 25,
  fatigue: 20,
  safety: 10,
  social: 25,
  solitude: 15,
  recognition: 30,
  growth: 45,
  belonging: 25,
  ...values,
});

const psyche = (values: Partial<NumberMap<PsycheId>> = {}): NumberMap<PsycheId> => ({
  stress: 15,
  confidence: 50,
  security: 55,
  grief: 0,
  burnout: 5,
  resilience: 55,
  ...values,
});

const relationValues = (
  values: Partial<NumberMap<RelationshipId>> = {},
): NumberMap<RelationshipId> => ({
  liking: 0,
  trust: 0,
  respect: 0,
  closeness: 0,
  fear: 0,
  resentment: 0,
  envy: 0,
  attraction: 0,
  debt: 0,
  rivalry: 0,
  ...values,
});

const createHero = (hero: Omit<Hero, 'memories' | 'currentAction'>): Hero => ({
  ...hero,
  memories: [],
});

export const createInitialWorld = (): WorldState => {
  const mira = createHero({
    id: 'mira',
    name: 'Мира',
    age: 18,
    traits: traits({
      kindness: 82,
      friendliness: 76,
      empathy: 88,
      pride: 64,
      courage: 58,
      curiosity: 72,
      approvalSeeking: 61,
      loyalty: 84,
      cruelty: 12,
    }),
    emotions: emotions({ joy: 42, interest: 58, affection: 35 }),
    needs: needs({ social: 35, growth: 52 }),
    psyche: psyche({ confidence: 48, resilience: 62 }),
    goals: [
      { id: 'mira-healer', label: 'Стать человеком, на которого можно положиться', priority: 82, tags: ['care', 'family'] },
    ],
    relationships: {
      god: { targetId: 'god', values: relationValues({ liking: 28, trust: 22, respect: 38, closeness: 12 }) },
      kael: { targetId: 'kael', values: relationValues({ liking: 24, trust: 12, respect: 30, attraction: 8 }) },
      liora: { targetId: 'liora', values: relationValues({ liking: 40, trust: 35, closeness: 28 }) },
    },
  });

  const kael = createHero({
    id: 'kael',
    name: 'Каэль',
    age: 20,
    traits: traits({
      pride: 87,
      ambition: 91,
      discipline: 79,
      independence: 84,
      courage: 80,
      friendliness: 34,
      patience: 29,
      empathy: 41,
      approvalSeeking: 27,
      vengefulness: 62,
      cruelty: 38,
    }),
    emotions: emotions({ joy: 20, inspiration: 54, irritation: 18 }),
    needs: needs({ recognition: 58, growth: 70, solitude: 32 }),
    psyche: psyche({ confidence: 72, stress: 22, resilience: 68 }),
    goals: [
      { id: 'kael-strongest', label: 'Стать сильнейшим ребёнком семьи', priority: 95, tags: ['power', 'status'] },
    ],
    relationships: {
      god: { targetId: 'god', values: relationValues({ liking: 10, trust: 8, respect: 42, rivalry: 4 }) },
      mira: { targetId: 'mira', values: relationValues({ liking: 18, trust: 8, respect: 34, attraction: 12 }) },
      liora: { targetId: 'liora', values: relationValues({ liking: -8, trust: -6, respect: 10, rivalry: 38 }) },
    },
  });

  const liora = createHero({
    id: 'liora',
    name: 'Лиора',
    age: 17,
    traits: traits({
      curiosity: 94,
      friendliness: 69,
      honesty: 77,
      kindness: 62,
      impulsiveness: 71,
      courage: 44,
      caution: 37,
      empathy: 68,
      trustfulness: 73,
      approvalSeeking: 74,
      discipline: 32,
      pride: 43,
    }),
    emotions: emotions({ joy: 48, interest: 78, anxiety: 18 }),
    needs: needs({ social: 44, growth: 76, recognition: 48 }),
    psyche: psyche({ confidence: 38, security: 50, resilience: 46 }),
    goals: [
      { id: 'liora-magic', label: 'Открыть собственную магию', priority: 90, tags: ['knowledge', 'magic'] },
    ],
    relationships: {
      god: { targetId: 'god', values: relationValues({ liking: 36, trust: 31, respect: 32, closeness: 18 }) },
      mira: { targetId: 'mira', values: relationValues({ liking: 46, trust: 40, closeness: 35 }) },
      kael: { targetId: 'kael', values: relationValues({ liking: 4, trust: -2, respect: 30, envy: 24, rivalry: 20 }) },
    },
  });

  return {
    tick: 0,
    god: { id: 'god', name: 'Астер', title: 'Бог путников и ремесла' },
    heroes: { mira, kael, liora },
    journal: [
      {
        id: 'start',
        tick: 0,
        text: 'Трое детей впервые поселились в тесной кибитке новой семьи.',
        heroIds: ['mira', 'kael', 'liora'],
        kind: 'system',
      },
    ],
  };
};
