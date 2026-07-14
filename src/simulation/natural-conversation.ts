import { changeRelationship, clamp } from './internal';
import type { LifeDialogueLine, LifeScene, LifeSceneState } from './life-scenes';
import type { Hero, PlanBlock, SocialLine, SocialScene, WorldState } from './model';

export type ConversationKind = 'casual' | 'personal' | 'important';

export interface NaturalConversationMetadata {
  version: 1;
  kind: ConversationKind;
  topic: string;
  initiatorImportance: number;
  targetImportance: number;
  sharedImportance: number;
  directInvitation: boolean;
  normalizedAt: number;
}

type NaturalSocialScene = SocialScene & {
  naturalConversation?: NaturalConversationMetadata;
  naturalSocialConsequencesAdjusted?: boolean;
};

type NaturalLifeScene = LifeScene & {
  naturalConversation?: NaturalConversationMetadata;
  naturalConversationNormalized?: boolean;
  naturalConsequencesAdjusted?: boolean;
};

type NaturalWorld = WorldState & {
  lifeScenes?: LifeSceneState;
};

type DialogueLike = {
  bubble?: string;
  dialogueOriginalText?: string;
  dialogueWordCount?: number;
  dialogueLength?: 'terse' | 'standard' | 'expanded';
  dialogueCadence?: 'clipped' | 'steady' | 'measured' | 'halting' | 'flowing';
  dialogueMemoryId?: string;
  dialogueMemoryReference?: string;
  dialogueReason?: string;
  reaction?: string;
};

const seriousTerms = [
  'обещан', 'срок', 'решени', 'конфликт', 'ссор', 'обид', 'потер', 'ранен', 'опасн',
  'поход', 'будущ', 'отношен', 'ответствен', 'ошибк', 'долг', 'страх', 'примир',
  'семь', 'довер', 'предатель', 'возвращен', 'нарушен',
];

const genericReasonParts = [
  'общий план', 'запланировано', 'план семьи', 'блок ', 'собеседник попросил',
  'отложенный разговор', 'вернуться к разговору',
];

const compact = (value: string): string => value.replace(/\s+/gu, ' ').trim();
const lowerFirst = (value: string): string => value
  ? `${value[0].toLocaleLowerCase('ru-RU')}${value.slice(1)}`
  : value;
const wordCount = (value: string): number => compact(value).split(' ').filter(Boolean).length;

const relationshipValue = (
  hero: Hero,
  targetId: string,
  key: 'liking' | 'trust' | 'respect' | 'closeness' | 'fear' | 'resentment' | 'debt' | 'rivalry',
): number => hero.relationships[targetId]?.values[key] ?? 0;

const strongestSharedMemory = (hero: Hero, otherId: string): number => hero.memories
  .filter((memory) => memory.participants.includes(otherId))
  .reduce((best, memory) => Math.max(best, memory.importance), 0);

const emotionalStake = (hero: Hero): number => Math.max(
  hero.emotions.anger,
  hero.emotions.sadness,
  hero.emotions.anxiety,
  hero.emotions.guilt,
  hero.emotions.fear,
  hero.psyche.stress,
);

const relationalStake = (hero: Hero, otherId: string): number => Math.max(
  Math.abs(relationshipValue(hero, otherId, 'resentment')),
  Math.abs(relationshipValue(hero, otherId, 'debt')),
  Math.abs(relationshipValue(hero, otherId, 'rivalry')),
  Math.max(0, relationshipValue(hero, otherId, 'closeness')) * 0.6,
  Math.max(0, relationshipValue(hero, otherId, 'trust')) * 0.45,
);

const meaningfulWords = (value: string): string[] => compact(value.toLocaleLowerCase('ru-RU'))
  .split(/[^а-яёa-z0-9]+/u)
  .filter((word) => word.length >= 5 && !['разговор', 'поговорить', 'обсудить', 'семьёй', 'вместе'].includes(word));

const targetSharesPlan = (target: Hero, plan: PlanBlock): boolean => {
  const words = meaningfulWords(`${plan.label} ${plan.reason ?? ''}`);
  return target.dailyPlan.some((candidate) => candidate.actionId === 'talk'
    && candidate.status !== 'skipped'
    && ((plan.groupId && candidate.groupId === plan.groupId)
      || meaningfulWords(`${candidate.label} ${candidate.reason ?? ''}`).some((word) => words.includes(word))));
};

const topicFromPlan = (plan: PlanBlock): string => {
  const reason = compact(plan.reason ?? '');
  const reasonIsUseful = reason.length >= 8
    && !genericReasonParts.some((part) => reason.toLocaleLowerCase('ru-RU').includes(part));
  const source = reasonIsUseful ? reason : compact(plan.label);
  const cleaned = source
    .replace(/^(обсудить|поговорить(?:\s+о)?|вернуться\s+к|важный\s+разговор\s+о|разговор\s+о)\s+/iu, '')
    .replace(/[.!?…]+$/u, '')
    .trim();
  return cleaned || 'то, что происходит между нами';
};

const fallbackPlan = (scene: SocialScene, initiator: Hero): PlanBlock => ({
  id: `${scene.id}-natural-fallback`,
  day: Math.floor(scene.createdAt / 24),
  startHour: scene.createdAt % 24,
  endHour: scene.createdAt % 24 + 1,
  actionId: 'talk',
  label: 'Обычное общение',
  source: 'group',
  status: scene.status === 'active' ? 'active' : 'done',
  targetId: scene.targetId,
  reason: scene.reason,
  socialSceneId: scene.id,
});

const planForScene = (scene: SocialScene, initiator: Hero): PlanBlock => initiator.dailyPlan.find((plan) =>
  scene.planBlockIds.includes(plan.id) || plan.socialSceneId === scene.id) ?? fallbackPlan(scene, initiator);

const importanceFor = (
  initiator: Hero,
  target: Hero,
  plan: PlanBlock,
): Omit<NaturalConversationMetadata, 'version' | 'topic' | 'directInvitation' | 'normalizedAt'> => {
  const subject = `${plan.label} ${plan.reason ?? ''}`.toLocaleLowerCase('ru-RU');
  const seriousHits = seriousTerms.filter((part) => subject.includes(part)).length;
  const subjectWeight = Math.min(42, seriousHits * 14);
  const sourceWeight = plan.source === 'crisis'
    ? 24
    : plan.source === 'replan'
      ? 16
      : plan.source === 'personal'
        ? 7
        : plan.source === 'routine'
          ? -4
          : 0;
  const sharedPlan = targetSharesPlan(target, plan) ? 24 : 0;
  const initiatorImportance = clamp(
    7
      + subjectWeight
      + sourceWeight
      + strongestSharedMemory(initiator, target.id) * 0.32
      + emotionalStake(initiator) * 0.18
      + relationalStake(initiator, target.id) * 0.14,
  );
  const targetImportance = clamp(
    4
      + subjectWeight * 0.62
      + sharedPlan
      + strongestSharedMemory(target, initiator.id) * 0.32
      + emotionalStake(target) * 0.16
      + relationalStake(target, initiator.id) * 0.14,
  );
  const sharedImportance = Math.min(initiatorImportance, targetImportance);
  const kind: ConversationKind = seriousHits > 0 && sharedImportance >= 56
    ? 'important'
    : seriousHits > 0 && initiatorImportance >= 50
      ? 'personal'
      : 'casual';
  return { kind, initiatorImportance, targetImportance, sharedImportance };
};

const directInvitationAllowed = (initiator: Hero, target: Hero): boolean => {
  const relationSafety = relationshipValue(initiator, target.id, 'trust') * 0.32
    + relationshipValue(initiator, target.id, 'closeness') * 0.28
    + relationshipValue(initiator, target.id, 'respect') * 0.15
    + relationshipValue(initiator, target.id, 'liking') * 0.1
    - Math.max(0, relationshipValue(initiator, target.id, 'resentment')) * 0.25
    - Math.max(0, relationshipValue(initiator, target.id, 'fear')) * 0.18;
  const directness = initiator.traits.honesty * 0.3
    + initiator.traits.courage * 0.22
    + initiator.traits.friendliness * 0.12
    + initiator.psyche.confidence * 0.1
    - initiator.traits.caution * 0.2
    - initiator.emotions.anxiety * 0.12;
  return relationSafety >= 18 && directness >= 34;
};

const casualOpening = (initiator: Hero, target: Hero): string => {
  const closeness = relationshipValue(initiator, target.id, 'closeness');
  if (target.needs.fatigue >= 68) return `${target.name}, тяжёлый день?`;
  if (initiator.traits.curiosity >= 72) return `${target.name}, что сегодня было самым интересным?`;
  if (initiator.traits.friendliness >= 66 && closeness >= 12) return `${target.name}, как ты? Мы сегодня почти не пересекались.`;
  if (initiator.traits.honesty + initiator.traits.independence >= 145) return `${target.name}, как день?`;
  return `${target.name}, как у тебя дела?`;
};

const personalOpening = (initiator: Hero, target: Hero, topic: string): string => {
  if (initiator.traits.caution + initiator.emotions.anxiety >= 125) {
    return `${target.name}, у меня кое-что не выходит из головы. Не знаю, насколько это важно для тебя: ${lowerFirst(topic)}.`;
  }
  if (initiator.traits.honesty + initiator.traits.independence >= 140) {
    return `${target.name}, скажу прямо: ${lowerFirst(topic)}.`;
  }
  return `${target.name}, я всё думаю об этом: ${lowerFirst(topic)}.`;
};

const importantOpening = (
  initiator: Hero,
  target: Hero,
  topic: string,
  directInvitation: boolean,
): string => {
  if (directInvitation) return `${target.name}, давай поговорим. Это важно для нас обоих: ${lowerFirst(topic)}.`;
  if (initiator.traits.honesty + initiator.traits.independence >= 135) {
    return `${target.name}, нужно обсудить ${lowerFirst(topic)}.`;
  }
  return `${target.name}, когда сможешь, хочу обсудить ${lowerFirst(topic)}.`;
};

const responseText = (
  scene: SocialScene,
  metadata: NaturalConversationMetadata,
  initiator: Hero,
  target: Hero,
): string => {
  if (scene.response === 'deferred') {
    return metadata.kind === 'casual'
      ? 'Сейчас занят. Подойду позже.'
      : 'Сейчас не могу. Но к этой теме мы вернёмся.';
  }
  if (scene.response === 'refused') {
    if (metadata.kind === 'casual') {
      return target.needs.solitude >= 58 ? 'Не сейчас. Хочу немного побыть один.' : 'Сегодня не получится.';
    }
    return target.traits.honesty >= 62
      ? 'Нет. Я пока не готов это обсуждать.'
      : 'Сейчас я не хочу к этому возвращаться.';
  }
  if (metadata.kind === 'important') {
    if (relationshipValue(target, initiator.id, 'resentment') >= 30) return 'Хорошо. Но говори прямо и не уходи от сути.';
    if (relationshipValue(target, initiator.id, 'trust') + relationshipValue(target, initiator.id, 'closeness') >= 35) {
      return 'Хорошо. Я тоже хотел это обсудить.';
    }
    if (target.traits.patience <= 35) return 'Хорошо. Только коротко и по делу.';
    return 'Хорошо. Я слушаю.';
  }
  if (metadata.kind === 'personal') {
    return target.traits.empathy >= 60 ? 'Ладно. Рассказывай.' : 'Хорошо. Что случилось?';
  }
  if (target.needs.fatigue >= 68) return 'Немного устал, но посижу.';
  if (relationshipValue(target, initiator.id, 'closeness') >= 18) return 'Нормально. А у тебя?';
  if (target.traits.friendliness >= 62) return 'Есть что рассказать.';
  return 'Нормально. Что у тебя?';
};

const openingTone = (kind: ConversationKind, initiator: Hero, target: Hero): SocialLine['tone'] => {
  if (kind === 'casual') return relationshipValue(initiator, target.id, 'closeness') >= 10 ? 'warm' : 'neutral';
  if (kind === 'personal') return initiator.emotions.anxiety >= 48 ? 'awkward' : 'neutral';
  return relationshipValue(initiator, target.id, 'resentment') >= 25 ? 'tense' : 'warm';
};

const responseTone = (scene: SocialScene, metadata: NaturalConversationMetadata): SocialLine['tone'] => {
  if (scene.response === 'refused') return 'tense';
  if (scene.response === 'deferred') return 'neutral';
  return metadata.kind === 'casual' ? 'warm' : 'neutral';
};

export const naturalConversationMetadataOf = (scene: SocialScene): NaturalConversationMetadata | undefined =>
  (scene as NaturalSocialScene).naturalConversation;

export const normalizeNaturalSocialConversations = (world: WorldState): void => {
  world.socialScenes.forEach((baseScene) => {
    const scene = baseScene as NaturalSocialScene;
    if (scene.actionId !== 'talk' || !scene.id.startsWith('social-') || scene.naturalConversation) return;
    const initiator = world.heroes[scene.initiatorId];
    const target = world.heroes[scene.targetId];
    if (!initiator || !target) return;
    const plan = planForScene(scene, initiator);
    const topic = topicFromPlan(plan);
    const importance = importanceFor(initiator, target, plan);
    const directInvitation = importance.kind === 'important' && directInvitationAllowed(initiator, target);
    const metadata: NaturalConversationMetadata = {
      version: 1,
      ...importance,
      topic,
      directInvitation,
      normalizedAt: world.tick,
    };
    const opening = metadata.kind === 'casual'
      ? casualOpening(initiator, target)
      : metadata.kind === 'personal'
        ? personalOpening(initiator, target, topic)
        : importantOpening(initiator, target, topic, directInvitation);
    if (scene.lines[0]) {
      scene.lines[0] = { ...scene.lines[0], text: opening, tone: openingTone(metadata.kind, initiator, target) };
    }
    if (scene.lines[1]) {
      scene.lines[1] = {
        ...scene.lines[1],
        text: responseText(scene, metadata, initiator, target),
        tone: responseTone(scene, metadata),
      };
    }
    scene.naturalConversation = metadata;
  });
};

const lifeLine = (
  sceneId: string,
  index: number,
  phase: LifeDialogueLine['phase'],
  speakerId: string,
  text: string,
  tone: LifeDialogueLine['tone'],
): LifeDialogueLine => ({ id: `${sceneId}-natural-line-${index}`, phase, speakerId, text, tone });

const casualFollowUp = (initiator: Hero): string => {
  if (initiator.traits.curiosity >= 68) return 'У меня сегодня тоже было кое-что любопытное.';
  if (initiator.traits.friendliness >= 65) return 'Хорошо, что хоть немного пересеклись.';
  return 'У меня день прошёл спокойно.';
};

const casualClosing = (target: Hero, initiator: Hero): string => relationshipValue(target, initiator.id, 'closeness') >= 16
  ? 'Да, хорошо посидели.'
  : 'Ладно, увидимся позже.';

const dialogueForLifeScene = (
  scene: NaturalLifeScene,
  source: SocialScene,
  metadata: NaturalConversationMetadata,
  initiator: Hero,
  target: Hero,
): LifeDialogueLine[] => {
  const opening = source.lines[0]?.text ?? casualOpening(initiator, target);
  const answer = source.lines[1]?.text ?? 'Я слушаю.';
  if (metadata.kind === 'casual') {
    return [
      lifeLine(scene.id, 0, 'approach', initiator.id, relationshipValue(initiator, target.id, 'closeness') >= 12 ? 'Подсаживайся.' : 'Привет.', 'warm'),
      lifeLine(scene.id, 1, 'opening', initiator.id, opening, openingTone(metadata.kind, initiator, target) === 'warm' ? 'warm' : 'neutral'),
      lifeLine(scene.id, 2, 'exchange', target.id, answer, source.response === 'refused' ? 'hurt' : 'neutral'),
      lifeLine(scene.id, 3, 'reaction', initiator.id, casualFollowUp(initiator), 'neutral'),
      lifeLine(scene.id, 4, 'resolution', target.id, casualClosing(target, initiator), source.response === 'refused' ? 'hurt' : 'warm'),
    ];
  }
  if (metadata.kind === 'personal') {
    return [
      lifeLine(scene.id, 0, 'approach', initiator.id, 'Есть минутка?', 'neutral'),
      lifeLine(scene.id, 1, 'opening', initiator.id, opening, 'neutral'),
      lifeLine(scene.id, 2, 'exchange', target.id, answer, source.response === 'refused' ? 'hurt' : 'neutral'),
      lifeLine(scene.id, 3, 'reaction', initiator.id, 'Я просто хотел, чтобы ты это знал.', 'neutral'),
      lifeLine(scene.id, 4, 'resolution', target.id, source.response === 'accepted' ? 'Понял. Я подумаю.' : 'Сейчас мне нечего добавить.', source.response === 'refused' ? 'hurt' : 'neutral'),
    ];
  }
  return [
    lifeLine(scene.id, 0, 'approach', initiator.id, 'Не уходи пока. Есть важная тема.', relationshipValue(initiator, target.id, 'resentment') >= 25 ? 'firm' : 'neutral'),
    lifeLine(scene.id, 1, 'opening', initiator.id, opening, relationshipValue(initiator, target.id, 'resentment') >= 25 ? 'firm' : 'warm'),
    lifeLine(scene.id, 2, 'exchange', target.id, answer, source.response === 'refused' ? 'hurt' : 'neutral'),
    lifeLine(scene.id, 3, 'reaction', initiator.id, 'Мне важно понять, как ты это видишь.', 'neutral'),
    lifeLine(scene.id, 4, 'resolution', target.id, source.response === 'accepted' ? 'Хорошо. Давай разберёмся без спешки.' : 'Сейчас этот разговор не продолжится.', source.response === 'refused' ? 'hurt' : 'neutral'),
  ];
};

export const normalizeNaturalLifeConversations = (world: WorldState): void => {
  const state = (world as NaturalWorld).lifeScenes;
  if (!state) return;
  state.scenes.forEach((baseScene) => {
    const scene = baseScene as NaturalLifeScene;
    if (scene.type !== 'conversation' || !scene.sourceSocialSceneId || scene.naturalConversationNormalized) return;
    const source = world.socialScenes.find((candidate) => candidate.id === scene.sourceSocialSceneId);
    const metadata = source ? naturalConversationMetadataOf(source) : undefined;
    const initiator = scene.initiatorId ? world.heroes[scene.initiatorId] : undefined;
    const target = scene.targetId ? world.heroes[scene.targetId] : undefined;
    if (!source || !metadata || !initiator || !target) return;
    scene.dialogue = dialogueForLifeScene(scene, source, metadata, initiator, target);
    scene.currentLineIndex = Math.min(scene.currentLineIndex, scene.dialogue.length - 1);
    scene.naturalConversation = { ...metadata };
    scene.naturalConversationNormalized = true;
    scene.title = metadata.kind === 'casual'
      ? 'Повседневная беседа'
      : metadata.kind === 'personal'
        ? 'Личный разговор'
        : 'Важный разговор';
  });
};

const adjustNaturalSocialConsequences = (world: WorldState): void => {
  world.socialScenes.forEach((baseScene) => {
    const scene = baseScene as NaturalSocialScene;
    if (scene.actionId !== 'talk'
      || scene.status !== 'resolved'
      || scene.naturalSocialConsequencesAdjusted
      || scene.naturalConversation?.kind !== 'casual') return;
    scene.naturalSocialConsequencesAdjusted = true;
    const initiator = world.heroes[scene.initiatorId];
    const target = world.heroes[scene.targetId];
    if (!initiator || !target) return;
    if (scene.response === 'accepted') {
      changeRelationship(initiator, target.id, 'closeness', -0.7);
      changeRelationship(target, initiator.id, 'closeness', -0.7);
      changeRelationship(initiator, target.id, 'liking', -0.3);
      changeRelationship(target, initiator.id, 'liking', -0.3);
    } else if (scene.response === 'refused') {
      const originalResentment = initiator.traits.pride > 65 ? 2.5 : 0.8;
      changeRelationship(initiator, target.id, 'resentment', -(originalResentment - 0.3));
      initiator.emotions.sadness = clamp(initiator.emotions.sadness - 3);
      initiator.emotions.irritation = clamp(initiator.emotions.irritation - 2);
    }
    [initiator, target].forEach((hero) => {
      const memory = hero.memories.find((candidate) => candidate.id === `${scene.id}-${hero.id}-memory`);
      if (memory) {
        memory.importance = Math.min(memory.importance, 16);
        memory.valence = Math.sign(memory.valence || 1) * Math.min(Math.abs(memory.valence), 10);
      }
    });
  });
};

const adjustNaturalLifeConsequences = (world: WorldState): void => {
  const state = (world as NaturalWorld).lifeScenes;
  if (!state) return;
  state.scenes.forEach((baseScene) => {
    const scene = baseScene as NaturalLifeScene;
    if (scene.type !== 'conversation'
      || scene.status !== 'resolved'
      || !scene.effectsApplied
      || scene.naturalConsequencesAdjusted
      || scene.naturalConversation?.kind !== 'casual') return;
    scene.naturalConsequencesAdjusted = true;
    const initiator = scene.initiatorId ? world.heroes[scene.initiatorId] : undefined;
    const target = scene.targetId ? world.heroes[scene.targetId] : undefined;
    const source = scene.sourceSocialSceneId
      ? world.socialScenes.find((candidate) => candidate.id === scene.sourceSocialSceneId)
      : undefined;
    if (initiator && target) {
      if (source?.response === 'refused') {
        changeRelationship(initiator, target.id, 'resentment', -1);
        initiator.emotions.sadness = clamp(initiator.emotions.sadness - 2);
      } else {
        changeRelationship(initiator, target.id, 'closeness', -0.75);
        changeRelationship(target, initiator.id, 'trust', -0.8);
      }
    }
    scene.participantIds.forEach((heroId) => {
      const hero = world.heroes[heroId];
      const memory = hero?.memories.find((candidate) => candidate.id === `${scene.id}-${heroId}-memory`);
      if (memory) {
        memory.importance = Math.min(memory.importance, 16);
        memory.valence = Math.sign(memory.valence || 1) * Math.min(Math.abs(memory.valence), 8);
      }
    });
  });
};

export const normalizeNaturalConversationWorld = (world: WorldState): void => {
  normalizeNaturalSocialConversations(world);
  normalizeNaturalLifeConversations(world);
  adjustNaturalSocialConsequences(world);
  adjustNaturalLifeConsequences(world);
};

export const simplifyCasualDialogueDirective = <T extends DialogueLike>(
  world: WorldState,
  heroId: string,
  directive: T | undefined,
): T | undefined => {
  if (!directive) return undefined;
  const state = (world as NaturalWorld).lifeScenes;
  const scene = state?.activeSceneId
    ? state.scenes.find((candidate) => candidate.id === state.activeSceneId && candidate.status === 'active') as NaturalLifeScene | undefined
    : undefined;
  if (scene?.type !== 'conversation' || scene.naturalConversation?.kind !== 'casual') return directive;
  const currentLine = scene.dialogue[scene.currentLineIndex];
  if (!currentLine || currentLine.speakerId !== heroId || !directive.bubble) return directive;
  const hero = world.heroes[heroId];
  const terse = Boolean(hero && hero.traits.honesty + hero.traits.independence >= 145);
  const base = compact(currentLine.text);
  const text = terse && wordCount(base) > 12 ? `${base.split(' ').slice(0, 12).join(' ')}…` : base;
  return {
    ...directive,
    bubble: text,
    dialogueOriginalText: base,
    dialogueWordCount: wordCount(text),
    dialogueLength: terse ? 'terse' : 'standard',
    dialogueCadence: terse ? 'clipped' : hero?.traits.friendliness && hero.traits.friendliness >= 65 ? 'flowing' : 'steady',
    dialogueMemoryId: undefined,
    dialogueMemoryReference: undefined,
    dialogueReason: 'повседневная беседа остаётся простой и не превращается в важное объяснение',
    reaction: undefined,
  } as T;
};
