import { activeExpeditionForHero } from './dungeon';
import { changeRelationship, clamp, pushJournal } from './internal';
import { leadershipStateOf } from './leadership';
import type { ActionId, Expedition, Hero, SocialScene, WorldState } from './model';
import { dayOf, hourOf } from './schedule';

export type LifeSceneType =
  | 'meal'
  | 'conversation'
  | 'help'
  | 'apology'
  | 'conflict'
  | 'treatment'
  | 'debrief';

export type LifeScenePhase =
  | 'approach'
  | 'opening'
  | 'exchange'
  | 'action'
  | 'reaction'
  | 'resolution'
  | 'completed';

export type LifeSceneRole =
  | 'host'
  | 'member'
  | 'initiator'
  | 'target'
  | 'mediator'
  | 'healer'
  | 'patient'
  | 'leader'
  | 'witness';

export interface LifeDialogueLine {
  id: string;
  phase: LifeScenePhase;
  speakerId: string;
  text: string;
  tone: 'warm' | 'neutral' | 'firm' | 'hurt' | 'angry' | 'apologetic';
}

export interface LifeScene {
  id: string;
  type: LifeSceneType;
  title: string;
  status: 'active' | 'resolved';
  phase: LifeScenePhase;
  createdAt: number;
  updatedAt: number;
  participantIds: string[];
  roles: Record<string, LifeSceneRole>;
  dialogue: LifeDialogueLine[];
  currentLineIndex: number;
  initiatorId?: string;
  targetId?: string;
  mediatorId?: string;
  sourceSocialSceneId?: string;
  sourceExpeditionId?: string;
  sourceJournalId?: string;
  mealKind?: 'breakfast' | 'lunch' | 'dinner';
  outcome?: string;
  effectsApplied?: boolean;
}

export interface LifeSceneState {
  activeSceneId?: string;
  scenes: LifeScene[];
  nextId: number;
  handledSocialSceneIds: string[];
  handledExpeditionIds: string[];
  handledJournalIds: string[];
  handledMealKeys: string[];
  handledTreatmentKeys: string[];
  handledConflictDays: number[];
}

export interface LifeActorDirective {
  sceneId: string;
  position: { x: number; y: number };
  phase: 'interacting' | 'acting';
  actionId: ActionId;
  bubble?: string;
  targetId?: string;
  gesture: 'listen' | 'address' | 'agree' | 'question' | 'pack' | 'ready';
  roleLabel?: string;
  reaction?: string;
  prop?: 'map' | 'pack' | 'weapon';
}

type LifeWorld = WorldState & {
  lifeScenes?: LifeSceneState;
  visualScenes?: { activeSceneId?: string };
};

type CouncilExpedition = Expedition & { leaderId?: string };

const phaseLabels: Record<LifeScenePhase, string> = {
  approach: 'Персонажи подходят друг к другу',
  opening: 'Начало сцены',
  exchange: 'Обмен репликами',
  action: 'Совместное действие',
  reaction: 'Ответ и невербальная реакция',
  resolution: 'Последствия сцены',
  completed: 'Сцена завершена',
};

const typeLabels: Record<LifeSceneType, string> = {
  meal: 'Общая трапеза',
  conversation: 'Личный разговор',
  help: 'Совместная помощь',
  apology: 'Извинение и попытка примирения',
  conflict: 'Открытый конфликт',
  treatment: 'Помощь раненому',
  debrief: 'Разбор похода',
};

const roleLabels: Record<LifeSceneRole, string> = {
  host: 'собирает семью',
  member: 'участник',
  initiator: 'инициатор',
  target: 'собеседник',
  mediator: 'посредник',
  healer: 'оказывает помощь',
  patient: 'раненый',
  leader: 'ведёт обсуждение',
  witness: 'наблюдает',
};

const phaseOrder: Record<LifeSceneType, LifeScenePhase[]> = {
  meal: ['approach', 'action', 'reaction', 'resolution'],
  conversation: ['approach', 'opening', 'exchange', 'reaction', 'resolution'],
  help: ['approach', 'opening', 'action', 'reaction', 'resolution'],
  apology: ['approach', 'opening', 'exchange', 'reaction', 'resolution'],
  conflict: ['approach', 'opening', 'exchange', 'reaction', 'resolution'],
  treatment: ['approach', 'opening', 'action', 'reaction', 'resolution'],
  debrief: ['approach', 'opening', 'exchange', 'reaction', 'resolution'],
};

const cloneState = (state: LifeSceneState): LifeSceneState => ({
  ...state,
  scenes: state.scenes.map((scene) => ({
    ...scene,
    participantIds: [...scene.participantIds],
    roles: { ...scene.roles },
    dialogue: scene.dialogue.map((line) => ({ ...line })),
  })),
  handledSocialSceneIds: [...state.handledSocialSceneIds],
  handledExpeditionIds: [...state.handledExpeditionIds],
  handledJournalIds: [...state.handledJournalIds],
  handledMealKeys: [...state.handledMealKeys],
  handledTreatmentKeys: [...state.handledTreatmentKeys],
  handledConflictDays: [...state.handledConflictDays],
});

export const lifeSceneStateOf = (world: WorldState): LifeSceneState => {
  const extended = world as LifeWorld;
  if (!extended.lifeScenes) {
    extended.lifeScenes = {
      scenes: [],
      nextId: 1,
      handledSocialSceneIds: [],
      handledExpeditionIds: [],
      handledJournalIds: [],
      handledMealKeys: [],
      handledTreatmentKeys: [],
      handledConflictDays: [],
    };
  }
  return extended.lifeScenes;
};

export const activeLifeSceneOf = (world: WorldState): LifeScene | undefined => {
  const state = (world as LifeWorld).lifeScenes;
  if (!state?.activeSceneId) return undefined;
  return state.scenes.find((scene) => scene.id === state.activeSceneId && scene.status === 'active');
};

export const lifeScenePhaseLabel = (phase: LifeScenePhase): string => phaseLabels[phase];
export const lifeSceneTypeLabel = (type: LifeSceneType): string => typeLabels[type];
export const lifeSceneRoleLabel = (role: LifeSceneRole): string => roleLabels[role];

const line = (
  sceneId: string,
  index: number,
  phase: LifeScenePhase,
  speakerId: string,
  text: string,
  tone: LifeDialogueLine['tone'],
): LifeDialogueLine => ({ id: `${sceneId}-line-${index}`, phase, speakerId, text, tone });

const availableHeroes = (world: WorldState): Hero[] =>
  Object.values(world.heroes).filter((hero) => !activeExpeditionForHero(world, hero.id));

const relationshipValue = (hero: Hero, targetId: string, key: 'liking' | 'trust' | 'respect' | 'closeness' | 'resentment' | 'rivalry'): number =>
  hero.relationships[targetId]?.values[key] ?? 0;

const tensionBetween = (left: Hero, right: Hero): number =>
  Math.max(0, relationshipValue(left, right.id, 'resentment'))
  + Math.max(0, relationshipValue(right, left.id, 'resentment'))
  + Math.max(0, relationshipValue(left, right.id, 'rivalry')) * 0.7
  + Math.max(0, relationshipValue(right, left.id, 'rivalry')) * 0.7
  + left.emotions.anger * 0.25
  + right.emotions.anger * 0.25
  + left.emotions.irritation * 0.18
  + right.emotions.irritation * 0.18;

const closestPair = (heroes: Hero[]): [Hero, Hero] | undefined => {
  let result: [Hero, Hero] | undefined;
  let score = Number.NEGATIVE_INFINITY;
  heroes.forEach((left, leftIndex) => {
    heroes.slice(leftIndex + 1).forEach((right) => {
      const current = relationshipValue(left, right.id, 'closeness')
        + relationshipValue(right, left.id, 'closeness')
        + relationshipValue(left, right.id, 'liking') * 0.4
        + relationshipValue(right, left.id, 'liking') * 0.4;
      if (current > score) {
        score = current;
        result = [left, right];
      }
    });
  });
  return result;
};

const mostTensePair = (heroes: Hero[]): [Hero, Hero] | undefined => {
  let result: [Hero, Hero] | undefined;
  let score = Number.NEGATIVE_INFINITY;
  heroes.forEach((left, leftIndex) => {
    heroes.slice(leftIndex + 1).forEach((right) => {
      const current = tensionBetween(left, right);
      if (current > score) {
        score = current;
        result = [left, right];
      }
    });
  });
  return score >= 18 ? result : undefined;
};

const mediatorFor = (world: WorldState, excluded: string[]): Hero | undefined =>
  availableHeroes(world)
    .filter((hero) => !excluded.includes(hero.id))
    .sort((left, right) =>
      (right.traits.empathy + right.traits.patience + right.traits.loyalty * 0.4)
      - (left.traits.empathy + left.traits.patience + left.traits.loyalty * 0.4))[0];

const createId = (state: LifeSceneState): string => {
  const id = `life-${state.nextId}`;
  state.nextId += 1;
  return id;
};

const activate = (state: LifeSceneState, scene: LifeScene): void => {
  state.scenes.unshift(scene);
  state.scenes = state.scenes.slice(0, 60);
  state.activeSceneId = scene.id;
};

const mealName = (kind: LifeScene['mealKind']): string => ({
  breakfast: 'завтрак',
  lunch: 'обед',
  dinner: 'ужин',
}[kind ?? 'breakfast']);

const createMealScene = (
  world: WorldState,
  state: LifeSceneState,
  kind: NonNullable<LifeScene['mealKind']>,
  startedAt: number,
): LifeScene | undefined => {
  const participants = availableHeroes(world);
  if (participants.length < 2) return undefined;
  const leadership = leadershipStateOf(world);
  const host = participants.find((hero) => hero.id === leadership.familyLeaderId)
    ?? [...participants].sort((left, right) => right.traits.friendliness - left.traits.friendliness)[0];
  const pair = closestPair(participants.filter((hero) => hero.id !== host.id));
  const sceneId = createId(state);
  const kindName = mealName(kind);
  const roles = Object.fromEntries(participants.map((hero) => [hero.id, hero.id === host.id ? 'host' : 'member'])) as Record<string, LifeSceneRole>;
  const dialogue = [
    line(sceneId, 0, 'approach', host.id, `Все к столу. ${kindName[0].toUpperCase()}${kindName.slice(1)} не должен пройти в одиночестве.`, 'warm'),
    line(sceneId, 1, 'action', pair?.[0]?.id ?? host.id, pair
      ? `${pair[1].name}, садись рядом. Расскажешь, как у тебя дела.`
      : 'Давайте хотя бы немного побудем вместе.', 'warm'),
    line(sceneId, 2, 'reaction', pair?.[1]?.id ?? participants.find((hero) => hero.id !== host.id)?.id ?? host.id, pair
      ? 'Хорошо. Мне как раз хотелось поговорить.'
      : 'Я слушаю.', 'neutral'),
    line(sceneId, 3, 'resolution', host.id, 'Доедайте спокойно. После стола каждый вернётся к своему плану.', 'firm'),
  ];
  return {
    id: sceneId,
    type: 'meal',
    title: `Семейный ${kindName}`,
    status: 'active',
    phase: 'approach',
    createdAt: startedAt,
    updatedAt: startedAt,
    participantIds: participants.map((hero) => hero.id),
    roles,
    dialogue,
    currentLineIndex: 0,
    initiatorId: host.id,
    mealKind: kind,
  };
};

const socialType = (scene: SocialScene): Extract<LifeSceneType, 'conversation' | 'help' | 'apology'> => {
  if (scene.actionId === 'help') return 'help';
  if (scene.actionId === 'apologize') return 'apology';
  return 'conversation';
};

const createSocialLifeScene = (
  world: WorldState,
  state: LifeSceneState,
  source: SocialScene,
  startedAt: number,
): LifeScene | undefined => {
  const initiator = world.heroes[source.initiatorId];
  const target = world.heroes[source.targetId];
  if (!initiator || !target || activeExpeditionForHero(world, initiator.id) || activeExpeditionForHero(world, target.id)) return undefined;
  const type = socialType(source);
  const sceneId = createId(state);
  const opening = source.lines[0]?.text
    ?? (type === 'help' ? 'Я заметил, что тебе тяжело. Давай помогу.' : type === 'apology' ? 'Мне нужно извиниться.' : 'Можно с тобой поговорить?');
  const answer = source.lines[1]?.text
    ?? (source.response === 'accepted' ? 'Да. Останься, я тебя выслушаю.' : source.response === 'deferred' ? 'Не сейчас, но позже я подойду.' : 'Нет. Сейчас я не хочу быть рядом.');
  const closing = source.response === 'accepted'
    ? type === 'help' ? 'Вместе дело пошло быстрее.' : type === 'apology' ? 'Я не забуду, но готов попробовать оставить это позади.' : 'Спасибо, что подошёл.'
    : source.response === 'deferred'
      ? 'Договорились вернуться к этому позже.'
      : 'Разговор закончился раньше, чем успел начаться.';
  return {
    id: sceneId,
    type,
    title: typeLabels[type],
    status: 'active',
    phase: 'approach',
    createdAt: startedAt,
    updatedAt: startedAt,
    participantIds: [initiator.id, target.id],
    roles: { [initiator.id]: 'initiator', [target.id]: 'target' },
    dialogue: [
      line(sceneId, 0, 'approach', initiator.id, type === 'help' ? 'Подожди, я подойду и помогу.' : 'Подожди. Мне нужно сказать тебе несколько слов.', type === 'apology' ? 'apologetic' : 'neutral'),
      line(sceneId, 1, 'opening', initiator.id, opening, type === 'apology' ? 'apologetic' : 'warm'),
      line(sceneId, 2, 'exchange', target.id, answer, source.response === 'refused' ? 'hurt' : 'neutral'),
      line(sceneId, 3, 'action', initiator.id, type === 'help' ? 'Держи с этой стороны. Сделаем вместе.' : type === 'apology' ? 'Я понимаю, почему ты злишься.' : 'Я не требую ответа сразу. Просто хотел быть честным.', type === 'apology' ? 'apologetic' : 'warm'),
      line(sceneId, 4, 'reaction', target.id, closing, source.response === 'refused' ? 'hurt' : 'warm'),
      line(sceneId, 5, 'resolution', initiator.id, source.outcome ?? closing, 'neutral'),
    ],
    currentLineIndex: 0,
    initiatorId: initiator.id,
    targetId: target.id,
    sourceSocialSceneId: source.id,
  };
};

const createConflictScene = (
  world: WorldState,
  state: LifeSceneState,
  left: Hero,
  right: Hero,
  startedAt: number,
  sourceJournalId?: string,
): LifeScene => {
  const mediator = mediatorFor(world, [left.id, right.id]);
  const sceneId = createId(state);
  const participants = [left.id, right.id, ...(mediator ? [mediator.id] : [])];
  const roles: Record<string, LifeSceneRole> = { [left.id]: 'initiator', [right.id]: 'target' };
  if (mediator) roles[mediator.id] = 'mediator';
  const dialogue = [
    line(sceneId, 0, 'approach', left.id, `${right.name}, не уходи. Мы должны разобраться сейчас.`, 'angry'),
    line(sceneId, 1, 'opening', left.id, 'Я устал делать вид, что меня всё устраивает.', 'angry'),
    line(sceneId, 2, 'exchange', right.id, 'А я устал, что ты решаешь за меня и потом обвиняешь.', 'hurt'),
    ...(mediator ? [line(sceneId, 3, 'reaction', mediator.id, 'Остановитесь. Сначала каждый скажет, чего он на самом деле боится потерять.', 'firm')] : []),
    line(sceneId, 4, 'resolution', right.id, mediator
      ? 'Хорошо. Но этот разговор ещё не закончен.'
      : 'Сейчас я лучше отойду, пока мы не сказали лишнего.', 'hurt'),
  ];
  return {
    id: sceneId,
    type: 'conflict',
    title: `Конфликт: ${left.name} и ${right.name}`,
    status: 'active',
    phase: 'approach',
    createdAt: startedAt,
    updatedAt: startedAt,
    participantIds: participants,
    roles,
    dialogue,
    currentLineIndex: 0,
    initiatorId: left.id,
    targetId: right.id,
    mediatorId: mediator?.id,
    sourceJournalId,
  };
};

const createTreatmentScene = (
  world: WorldState,
  state: LifeSceneState,
  patient: Hero,
  healer: Hero,
  startedAt: number,
): LifeScene => {
  const sceneId = createId(state);
  return {
    id: sceneId,
    type: 'treatment',
    title: `${healer.name} помогает ${patient.name}`,
    status: 'active',
    phase: 'approach',
    createdAt: startedAt,
    updatedAt: startedAt,
    participantIds: [patient.id, healer.id],
    roles: { [patient.id]: 'patient', [healer.id]: 'healer' },
    dialogue: [
      line(sceneId, 0, 'approach', healer.id, 'Не двигайся. Я принесу воду и перевязочный набор.', 'firm'),
      line(sceneId, 1, 'opening', patient.id, 'Это не так страшно. Я справлюсь сам.', 'neutral'),
      line(sceneId, 2, 'action', healer.id, 'Справишься. Но не обязан делать это один.', 'warm'),
      line(sceneId, 3, 'reaction', patient.id, 'Хорошо. Только не затягивай слишком туго.', 'warm'),
      line(sceneId, 4, 'resolution', healer.id, 'Готово. Сегодня тебе нужен отдых, а не геройство.', 'firm'),
    ],
    currentLineIndex: 0,
    initiatorId: healer.id,
    targetId: patient.id,
  };
};

const createDebriefScene = (
  world: WorldState,
  state: LifeSceneState,
  expedition: CouncilExpedition,
  startedAt: number,
): LifeScene | undefined => {
  const participants = expedition.partyIds.map((id) => world.heroes[id]).filter(Boolean);
  if (participants.length < 2) return undefined;
  const leadership = leadershipStateOf(world);
  const leaderId = expedition.leaderId && world.heroes[expedition.leaderId]
    ? expedition.leaderId
    : leadership.familyLeaderId && expedition.partyIds.includes(leadership.familyLeaderId)
      ? leadership.familyLeaderId
      : expedition.partyIds[0];
  const leader = world.heroes[leaderId];
  if (!leader) return undefined;
  const danger = expedition.events.find((event) => event.type === 'danger');
  const success = expedition.status === 'completed';
  const sceneId = createId(state);
  const respondent = participants.find((hero) => hero.id !== leaderId) ?? participants[0];
  return {
    id: sceneId,
    type: 'debrief',
    title: `Разбор похода на ${expedition.floor}-й этаж`,
    status: 'active',
    phase: 'approach',
    createdAt: startedAt,
    updatedAt: startedAt,
    participantIds: participants.map((hero) => hero.id),
    roles: Object.fromEntries(participants.map((hero) => [hero.id, hero.id === leaderId ? 'leader' : 'member'])) as Record<string, LifeSceneRole>,
    dialogue: [
      line(sceneId, 0, 'approach', leaderId, 'Соберитесь у стола. Поход закончился, но нам нужно понять, что произошло.', 'firm'),
      line(sceneId, 1, 'opening', leaderId, success
        ? 'Мы вернулись по плану. Теперь каждый скажет, что помогло группе выстоять.'
        : 'Мы отступили. Это не позор, но ошибки нельзя прятать за усталостью.', success ? 'warm' : 'firm'),
      line(sceneId, 2, 'exchange', respondent.id, danger?.text ?? (success
        ? 'Лучше всего сработало то, что никто не бросил свою роль.'
        : 'Мы слишком поздно признали, что группа выдохлась.'), success ? 'warm' : 'hurt'),
      line(sceneId, 3, 'reaction', leaderId, danger
        ? 'Ранение не останется просто строкой в журнале. Следующий план должен учитывать его.'
        : 'Я услышал. Это повлияет на следующий состав и маршрут.', 'firm'),
      line(sceneId, 4, 'resolution', leaderId, success
        ? 'Сегодня отдыхайте. Завтра мы решим, как использовать добычу.'
        : 'Сегодня никто никого не обвиняет. Завтра вернёмся к решениям спокойно.', 'warm'),
    ],
    currentLineIndex: 0,
    initiatorId: leaderId,
    sourceExpeditionId: expedition.id,
  };
};

const addMemory = (world: WorldState, scene: LifeScene, heroId: string, summary: string, valence: number): void => {
  const hero = world.heroes[heroId];
  if (!hero) return;
  hero.memories.unshift({
    id: `${scene.id}-${heroId}-memory`,
    summary,
    createdAt: world.tick,
    importance: scene.type === 'conflict' || scene.type === 'debrief' ? 52 : 34,
    valence,
    participants: scene.participantIds.filter((id) => id !== heroId),
    tags: ['visual-scene', scene.type],
    sourceEventType: scene.type === 'debrief' ? 'dungeon' : 'social',
  });
  hero.memories = hero.memories.slice(0, 80);
};

const applySceneEffects = (world: WorldState, scene: LifeScene): void => {
  if (scene.effectsApplied) return;
  scene.effectsApplied = true;
  const participants = scene.participantIds.map((id) => world.heroes[id]).filter(Boolean);

  if (scene.type === 'meal') {
    participants.forEach((hero) => {
      hero.needs.social = clamp(hero.needs.social - 6);
      hero.needs.belonging = clamp(hero.needs.belonging - 4);
      hero.emotions.loneliness = clamp(hero.emotions.loneliness - 4);
    });
    participants.forEach((left, index) => participants.slice(index + 1).forEach((right) => {
      changeRelationship(left, right.id, 'closeness', 0.45);
      changeRelationship(right, left.id, 'closeness', 0.45);
    }));
  }

  if (scene.type === 'conversation' || scene.type === 'help' || scene.type === 'apology') {
    const initiator = scene.initiatorId ? world.heroes[scene.initiatorId] : undefined;
    const target = scene.targetId ? world.heroes[scene.targetId] : undefined;
    const source = scene.sourceSocialSceneId
      ? world.socialScenes.find((candidate) => candidate.id === scene.sourceSocialSceneId)
      : undefined;
    if (initiator && target) {
      if (source?.response === 'refused') {
        changeRelationship(initiator, target.id, 'resentment', 1.6);
        initiator.emotions.sadness = clamp(initiator.emotions.sadness + 4);
      } else {
        changeRelationship(initiator, target.id, 'closeness', scene.type === 'help' ? 1.5 : 1.1);
        changeRelationship(target, initiator.id, 'trust', scene.type === 'help' ? 2 : 1);
        if (scene.type === 'apology') {
          changeRelationship(target, initiator.id, 'resentment', -2.2);
          initiator.emotions.guilt = clamp(initiator.emotions.guilt - 7);
        }
      }
    }
  }

  if (scene.type === 'conflict' && scene.initiatorId && scene.targetId) {
    const left = world.heroes[scene.initiatorId];
    const right = world.heroes[scene.targetId];
    if (left && right) {
      changeRelationship(left, right.id, 'resentment', scene.mediatorId ? 1.1 : 2.2);
      changeRelationship(right, left.id, 'resentment', scene.mediatorId ? 1.1 : 2.2);
      changeRelationship(left, right.id, 'rivalry', 0.8);
      changeRelationship(right, left.id, 'rivalry', 0.8);
      left.emotions.anger = clamp(left.emotions.anger + (scene.mediatorId ? 2 : 6));
      right.emotions.anger = clamp(right.emotions.anger + (scene.mediatorId ? 2 : 6));
      if (scene.mediatorId) {
        const mediator = world.heroes[scene.mediatorId];
        if (mediator) {
          changeRelationship(left, mediator.id, 'respect', 0.7);
          changeRelationship(right, mediator.id, 'respect', 0.7);
          mediator.psyche.stress = clamp(mediator.psyche.stress + 2);
        }
      }
    }
  }

  if (scene.type === 'treatment' && scene.initiatorId && scene.targetId) {
    const healer = world.heroes[scene.initiatorId];
    const patient = world.heroes[scene.targetId];
    if (healer && patient) {
      patient.condition.health = clamp(patient.condition.health + 5);
      patient.condition.injury = clamp(patient.condition.injury - 7);
      patient.psyche.stress = clamp(patient.psyche.stress - 4);
      changeRelationship(patient, healer.id, 'trust', 2.2);
      changeRelationship(patient, healer.id, 'debt', 1.2);
      healer.needs.fatigue = clamp(healer.needs.fatigue + 2);
    }
  }

  if (scene.type === 'debrief' && scene.sourceExpeditionId) {
    const expedition = world.expeditions.find((candidate) => candidate.id === scene.sourceExpeditionId) as CouncilExpedition | undefined;
    const leadership = leadershipStateOf(world);
    const leaderId = scene.initiatorId;
    const leaderPerson = leaderId ? leadership.people[leaderId] : undefined;
    if (expedition && leaderId) {
      scene.participantIds.filter((id) => id !== leaderId).forEach((id) => {
        const member = world.heroes[id];
        if (!member) return;
        changeRelationship(member, leaderId, 'respect', expedition.status === 'completed' ? 1.5 : -0.5);
        const bond = leadership.people[id]?.bonds[leaderId];
        if (bond) {
          bond.confidence = clamp(bond.confidence + (expedition.status === 'completed' ? 2 : -2));
          bond.grievance = clamp(bond.grievance + (expedition.status === 'retreated' ? 1.5 : -0.5));
        }
      });
      if (leaderPerson) {
        leaderPerson.feelings.pressure = clamp(leaderPerson.feelings.pressure - 3);
        leaderPerson.feelings.responsibility = clamp(leaderPerson.feelings.responsibility + 1);
      }
    }
  }

  participants.forEach((hero) => addMemory(
    world,
    scene,
    hero.id,
    `${typeLabels[scene.type]}: ${scene.outcome ?? scene.title}.`,
    scene.type === 'conflict' ? -28 : scene.type === 'treatment' || scene.type === 'meal' ? 24 : 12,
  ));
};

const resolveScene = (world: WorldState, state: LifeSceneState, scene: LifeScene, interrupted = false): void => {
  if (scene.status === 'resolved') return;
  scene.status = 'resolved';
  scene.phase = 'completed';
  scene.updatedAt = world.tick;
  scene.outcome = interrupted
    ? 'Сцену завершило более срочное общее событие, но её участники сохранили последствия разговора.'
    : scene.type === 'meal'
      ? 'Семья поела вместе, обменялась несколькими словами и разошлась по своим делам.'
      : scene.type === 'conflict'
        ? scene.mediatorId ? 'Посредник остановил ссору, но противоречие осталось.' : 'Участники разошлись, не решив противоречие.'
        : scene.type === 'treatment'
          ? 'Раненому оказали помощь и настояли на отдыхе.'
          : scene.type === 'debrief'
            ? 'Группа проговорила ошибки и успехи похода.'
            : 'Разговор получил видимое завершение и повлиял на отношения.';
  applySceneEffects(world, scene);
  state.activeSceneId = undefined;
  pushJournal(world, scene.outcome, scene.participantIds, scene.type === 'debrief' ? 'dungeon' : 'social');
};

const currentLineForPhase = (scene: LifeScene): number => {
  const indexes = scene.dialogue
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => candidate.phase === scene.phase)
    .map(({ index }) => index);
  if (indexes.length) return indexes.at(-1) ?? scene.currentLineIndex;
  const previous = scene.dialogue
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ index }) => index <= scene.currentLineIndex)
    .map(({ index }) => index);
  return previous.at(-1) ?? 0;
};

const mealAt = (world: WorldState, tick: number): NonNullable<LifeScene['mealKind']> | undefined => {
  const hour = hourOf(tick);
  if (hour === world.routine.breakfastHour) return 'breakfast';
  if (hour === world.routine.lunchHour) return 'lunch';
  if (hour === world.routine.dinnerHour) return 'dinner';
  return undefined;
};

const conflictJournal = (world: WorldState, state: LifeSceneState) =>
  world.journal.find((entry) =>
    !state.handledJournalIds.includes(entry.id)
    && entry.kind === 'event'
    && entry.heroIds.length >= 2
    && ['поссор', 'унизил', 'отказался поддержать'].some((part) => entry.text.toLowerCase().includes(part)));

const recentCompletedExpedition = (world: WorldState, state: LifeSceneState, upcomingTick: number) =>
  [...world.expeditions]
    .filter((expedition) =>
      !state.handledExpeditionIds.includes(expedition.id)
      && (expedition.status === 'completed' || expedition.status === 'retreated')
      && expedition.plannedReturnTick <= upcomingTick)
    .sort((left, right) => right.plannedReturnTick - left.plannedReturnTick)[0] as CouncilExpedition | undefined;

const treatmentCandidate = (world: WorldState, state: LifeSceneState, day: number): [Hero, Hero] | undefined => {
  const heroes = availableHeroes(world);
  const patient = [...heroes]
    .filter((hero) => hero.condition.injury >= 18)
    .sort((left, right) => right.condition.injury - left.condition.injury)[0];
  if (!patient || state.handledTreatmentKeys.includes(`${day}:${patient.id}`)) return undefined;
  const healer = [...heroes]
    .filter((hero) => hero.id !== patient.id)
    .sort((left, right) =>
      (right.traits.empathy + right.traits.kindness + right.stats.magic * 0.45)
      - (left.traits.empathy + left.traits.kindness + left.stats.magic * 0.45))[0];
  return healer ? [patient, healer] : undefined;
};

export const prepareLifeScenes = (world: WorldState, upcomingTick: number): void => {
  const previous = lifeSceneStateOf(world);
  const state = cloneState(previous);
  (world as LifeWorld).lifeScenes = state;
  const active = state.activeSceneId
    ? state.scenes.find((scene) => scene.id === state.activeSceneId && scene.status === 'active')
    : undefined;
  const visualActive = Boolean((world as LifeWorld).visualScenes?.activeSceneId);
  const day = dayOf(upcomingTick);
  const hour = hourOf(upcomingTick);
  const councilWillStart = hour === 8 && world.expeditions.some((expedition) => expedition.day === day && expedition.status === 'planned');

  if (active) {
    if (visualActive || councilWillStart) resolveScene(world, state, active, true);
    else return;
  }
  if (visualActive || councilWillStart) return;

  const conflictSource = conflictJournal(world, state);
  if (conflictSource) {
    state.handledJournalIds.push(conflictSource.id);
    const [leftId, rightId] = conflictSource.heroIds;
    const left = world.heroes[leftId];
    const right = world.heroes[rightId];
    if (left && right && !activeExpeditionForHero(world, left.id) && !activeExpeditionForHero(world, right.id)) {
      activate(state, createConflictScene(world, state, left, right, upcomingTick, conflictSource.id));
      return;
    }
  }

  const mealKind = mealAt(world, upcomingTick);
  const mealKey = mealKind ? `${day}:${mealKind}` : undefined;
  if (mealKind && mealKey && !state.handledMealKeys.includes(mealKey)) {
    state.handledMealKeys.push(mealKey);
    const scene = createMealScene(world, state, mealKind, upcomingTick);
    if (scene) {
      activate(state, scene);
      return;
    }
  }

  const expedition = recentCompletedExpedition(world, state, upcomingTick);
  if (expedition && hour >= 20) {
    state.handledExpeditionIds.push(expedition.id);
    const scene = createDebriefScene(world, state, expedition, upcomingTick);
    if (scene) {
      activate(state, scene);
      return;
    }
  }

  const treatment = treatmentCandidate(world, state, day);
  if (treatment && (hour === 6 || hour >= 20)) {
    const [patient, healer] = treatment;
    state.handledTreatmentKeys.push(`${day}:${patient.id}`);
    activate(state, createTreatmentScene(world, state, patient, healer, upcomingTick));
    return;
  }

  const social = world.socialScenes.find((scene) => !state.handledSocialSceneIds.includes(scene.id));
  if (social) {
    state.handledSocialSceneIds.push(social.id);
    const scene = createSocialLifeScene(world, state, social, upcomingTick);
    if (scene) {
      activate(state, scene);
      return;
    }
  }

  if (hour === 18 && !state.handledConflictDays.includes(day)) {
    state.handledConflictDays.push(day);
    const pair = mostTensePair(availableHeroes(world));
    if (pair) activate(state, createConflictScene(world, state, pair[0], pair[1], upcomingTick));
  }
};

export const advanceLifeScenes = (world: WorldState): void => {
  const previous = lifeSceneStateOf(world);
  const state = cloneState(previous);
  (world as LifeWorld).lifeScenes = state;
  const scene = state.activeSceneId
    ? state.scenes.find((candidate) => candidate.id === state.activeSceneId && candidate.status === 'active')
    : undefined;
  if (!scene) return;

  if ((world as LifeWorld).visualScenes?.activeSceneId) {
    resolveScene(world, state, scene, true);
    return;
  }

  const phases = phaseOrder[scene.type];
  const elapsed = Math.max(0, world.tick - scene.createdAt);
  if (elapsed >= phases.length) {
    resolveScene(world, state, scene);
    return;
  }
  scene.phase = phases[elapsed];
  scene.updatedAt = world.tick;
  scene.currentLineIndex = currentLineForPhase(scene);
};

const tablePositions = [
  { x: 49, y: 31 },
  { x: 43, y: 25 },
  { x: 55, y: 25 },
  { x: 42, y: 35 },
  { x: 57, y: 35 },
];

const orderedMealParticipants = (world: WorldState, scene: LifeScene): string[] => {
  const hostId = scene.initiatorId ?? scene.participantIds[0];
  const host = world.heroes[hostId];
  if (!host) return scene.participantIds;
  return [hostId, ...scene.participantIds
    .filter((id) => id !== hostId)
    .sort((left, right) =>
      (relationshipValue(host, right, 'closeness') + relationshipValue(host, right, 'liking') * 0.4)
      - (relationshipValue(host, left, 'closeness') + relationshipValue(host, left, 'liking') * 0.4))];
};

const positionFor = (world: WorldState, scene: LifeScene, heroId: string): { x: number; y: number } => {
  if (scene.type === 'meal' || scene.type === 'debrief') {
    const ordered = scene.type === 'meal' ? orderedMealParticipants(world, scene) : scene.participantIds;
    return tablePositions[Math.max(0, ordered.indexOf(heroId)) % tablePositions.length];
  }
  if (scene.type === 'help') {
    return heroId === scene.initiatorId ? { x: 77, y: 55 } : { x: 84, y: 58 };
  }
  if (scene.type === 'treatment') {
    return heroId === scene.targetId ? { x: 84, y: 20 } : { x: 75, y: 23 };
  }
  if (scene.type === 'conflict') {
    if (heroId === scene.initiatorId) return { x: 40, y: 43 };
    if (heroId === scene.targetId) return { x: 60, y: 43 };
    return { x: 50, y: 51 };
  }
  const initiator = scene.initiatorId ? world.heroes[scene.initiatorId] : undefined;
  const target = scene.targetId ? world.heroes[scene.targetId] : undefined;
  const distant = Boolean(initiator && target && (
    relationshipValue(target, initiator.id, 'resentment') > 20
    || world.socialScenes.find((candidate) => candidate.id === scene.sourceSocialSceneId)?.response === 'refused'));
  if (heroId === scene.initiatorId) return { x: distant ? 42 : 46, y: 43 };
  return { x: distant ? 59 : 53, y: 43 };
};

const sceneAction = (scene: LifeScene, heroId: string): ActionId => {
  if (scene.type === 'meal') return 'eat';
  if (scene.type === 'help') return heroId === scene.initiatorId ? 'help' : 'work';
  if (scene.type === 'treatment') return heroId === scene.targetId ? 'recover' : 'help';
  return 'talk';
};

export const lifeDirectiveForHero = (world: WorldState, heroId: string): LifeActorDirective | undefined => {
  const scene = activeLifeSceneOf(world);
  if (!scene || !scene.participantIds.includes(heroId)) return undefined;
  const currentLine = scene.dialogue[scene.currentLineIndex];
  const isSpeaker = currentLine?.speakerId === heroId;
  const role = scene.roles[heroId] ?? 'member';
  const sourceSocial = scene.sourceSocialSceneId
    ? world.socialScenes.find((candidate) => candidate.id === scene.sourceSocialSceneId)
    : undefined;
  const targetId = heroId === scene.initiatorId
    ? scene.targetId
    : heroId === scene.targetId
      ? scene.initiatorId
      : scene.initiatorId;

  let gesture: LifeActorDirective['gesture'] = isSpeaker ? 'address' : 'listen';
  if (scene.type === 'conflict' && (heroId === scene.initiatorId || heroId === scene.targetId)) {
    gesture = isSpeaker ? 'question' : 'listen';
  } else if (scene.type === 'help' || scene.type === 'treatment') {
    gesture = scene.phase === 'action' ? 'pack' : isSpeaker ? 'address' : 'listen';
  } else if (scene.phase === 'reaction') {
    gesture = sourceSocial?.response === 'refused' ? 'question' : 'agree';
  }

  const reaction = scene.type === 'conflict'
    ? heroId === scene.mediatorId ? '✦' : '!'
    : sourceSocial?.response === 'refused' && heroId === scene.targetId
      ? '↩'
      : sourceSocial?.response === 'accepted' && scene.phase === 'reaction'
        ? '✓'
        : scene.type === 'treatment' && scene.phase === 'reaction'
          ? '♥'
          : undefined;

  const passiveBubble = scene.type === 'meal' && scene.phase === 'action'
    ? 'Ем и слушаю остальных'
    : scene.type === 'help' && scene.phase === 'action'
      ? 'Делаем вместе'
      : scene.type === 'treatment' && scene.phase === 'action'
        ? heroId === scene.targetId ? 'Стараюсь не двигаться' : 'Накладываю повязку'
        : undefined;

  return {
    sceneId: scene.id,
    position: positionFor(world, scene, heroId),
    phase: scene.type === 'meal' || scene.type === 'help' || scene.type === 'treatment' ? 'acting' : 'interacting',
    actionId: sceneAction(scene, heroId),
    bubble: isSpeaker ? currentLine?.text : passiveBubble,
    targetId,
    gesture,
    roleLabel: roleLabels[role],
    reaction,
    prop: scene.type === 'debrief' && role === 'leader' && scene.phase === 'opening' ? 'map' : undefined,
  };
};