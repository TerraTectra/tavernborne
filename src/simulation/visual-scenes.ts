import { advanceSimulation as advanceCoreSimulation } from './engine';
import { cloneWorld, pushJournal } from './internal';
import { leadershipStateOf } from './leadership';
import type { ActionId, Expedition, Hero, WorldState } from './model';
import { dayOf, hourOf } from './schedule';

export type VisualScenePhase =
  | 'gathering'
  | 'briefing'
  | 'assigning'
  | 'equipping'
  | 'departure'
  | 'completed';

export type ExpeditionRole = 'leader' | 'vanguard' | 'scout' | 'support';
export type CouncilResponse = 'accepted' | 'questioned' | 'refused';
export type VisualGesture = 'listen' | 'address' | 'agree' | 'question' | 'pack' | 'ready';
export type VisualProp = 'map' | 'pack' | 'weapon';

export interface VisualDialogueLine {
  id: string;
  phase: VisualScenePhase;
  speakerId: string;
  text: string;
  tone: 'calm' | 'firm' | 'warm' | 'doubtful' | 'tense';
}

export interface VisualScene {
  id: string;
  type: 'expeditionCouncil';
  title: string;
  status: 'active' | 'resolved';
  phase: VisualScenePhase;
  createdAt: number;
  updatedAt: number;
  expeditionId: string;
  leaderId: string;
  participantIds: string[];
  partyIds: string[];
  roles: Record<string, ExpeditionRole>;
  responses: Record<string, CouncilResponse>;
  dialogue: VisualDialogueLine[];
  currentLineIndex: number;
  outcome?: string;
}

export interface VisualSceneState {
  activeSceneId?: string;
  scenes: VisualScene[];
  nextId: number;
}

export interface VisualActorDirective {
  sceneId: string;
  position: { x: number; y: number };
  phase: 'interacting' | 'acting';
  actionId: ActionId;
  bubble?: string;
  targetId?: string;
  gesture: VisualGesture;
  roleLabel?: string;
  reaction?: string;
  prop?: VisualProp;
}

type VisualWorld = WorldState & { visualScenes?: VisualSceneState };
type CouncilExpedition = Expedition & {
  councilSceneId?: string;
  councilStatus?: 'planned' | 'active' | 'completed';
  roles?: Record<string, ExpeditionRole>;
  responses?: Record<string, CouncilResponse>;
  leaderId?: string;
};

const phaseOrder: VisualScenePhase[] = [
  'gathering',
  'briefing',
  'assigning',
  'equipping',
  'departure',
  'completed',
];

const phaseLabels: Record<VisualScenePhase, string> = {
  gathering: 'Сбор у общего стола',
  briefing: 'Объявление цели похода',
  assigning: 'Распределение ролей и ответы',
  equipping: 'Получение снаряжения',
  departure: 'Построение у выхода',
  completed: 'Совет завершён',
};

const roleLabels: Record<ExpeditionRole, string> = {
  leader: 'лидер отряда',
  vanguard: 'передний боец',
  scout: 'разведчик',
  support: 'поддержка',
};

const responseLabels: Record<CouncilResponse, string> = {
  accepted: 'согласился',
  questioned: 'высказал сомнение',
  refused: 'отказался',
};

const cloneSceneState = (state: VisualSceneState): VisualSceneState => ({
  ...state,
  scenes: state.scenes.map((scene) => ({
    ...scene,
    participantIds: [...scene.participantIds],
    partyIds: [...scene.partyIds],
    roles: { ...scene.roles },
    responses: { ...scene.responses },
    dialogue: scene.dialogue.map((line) => ({ ...line })),
  })),
});

export const visualSceneStateOf = (world: WorldState): VisualSceneState => {
  const extended = world as VisualWorld;
  if (!extended.visualScenes) {
    extended.visualScenes = { scenes: [], nextId: 1 };
  }
  return extended.visualScenes;
};

export const activeVisualSceneOf = (world: WorldState): VisualScene | undefined => {
  const state = (world as VisualWorld).visualScenes;
  if (!state?.activeSceneId) return undefined;
  return state.scenes.find((scene) => scene.id === state.activeSceneId && scene.status === 'active');
};

export const visualPhaseLabel = (phase: VisualScenePhase): string => phaseLabels[phase];
export const expeditionRoleLabel = (role: ExpeditionRole): string => roleLabels[role];
export const councilResponseLabel = (response: CouncilResponse): string => responseLabels[response];

const rolePower = (hero: Hero, role: Exclude<ExpeditionRole, 'leader'>): number => {
  if (role === 'vanguard') return hero.stats.strength * 0.55 + hero.stats.endurance * 0.45;
  if (role === 'scout') return hero.stats.perception * 0.65 + hero.stats.dexterity * 0.35;
  return hero.stats.magic * 0.5 + hero.traits.empathy * 0.3 + hero.traits.kindness * 0.2;
};

const assignRoles = (world: WorldState, expedition: Expedition, leaderId: string): Record<string, ExpeditionRole> => {
  const roles: Record<string, ExpeditionRole> = { [leaderId]: 'leader' };
  const remaining = expedition.partyIds.filter((id) => id !== leaderId);
  const availableRoles: Array<Exclude<ExpeditionRole, 'leader'>> = ['vanguard', 'scout', 'support'];

  remaining.forEach((heroId) => {
    const hero = world.heroes[heroId];
    if (!hero) return;
    const role = [...availableRoles].sort((left, right) => rolePower(hero, right) - rolePower(hero, left))[0]
      ?? 'support';
    roles[heroId] = role;
    const roleIndex = availableRoles.indexOf(role);
    if (roleIndex >= 0) availableRoles.splice(roleIndex, 1);
  });

  return roles;
};

const responseFor = (world: WorldState, hero: Hero, leaderId: string, role: ExpeditionRole): CouncilResponse => {
  if (hero.id === leaderId) return 'accepted';
  const leadership = leadershipStateOf(world);
  const bond = leadership.people[hero.id]?.bonds[leaderId];
  const relation = hero.relationships[leaderId]?.values;
  const suitability = role === 'vanguard'
    ? hero.stats.strength + hero.stats.endurance
    : role === 'scout'
      ? hero.stats.perception + hero.stats.dexterity
      : hero.stats.magic + hero.traits.empathy;
  const score = (bond?.obedience ?? 40) * 0.25
    + (bond?.confidence ?? 40) * 0.24
    + (bond?.politicalLoyalty ?? 35) * 0.18
    - (bond?.grievance ?? 0) * 0.3
    + (relation?.trust ?? 0) * 0.15
    + suitability * 0.18
    - hero.needs.fatigue * 0.12
    - hero.condition.injury * 0.25;
  if (score >= 35) return 'accepted';
  if (score >= 12 || world.expeditions.length === 1) return 'questioned';
  return 'refused';
};

const line = (
  sceneId: string,
  index: number,
  phase: VisualScenePhase,
  speakerId: string,
  text: string,
  tone: VisualDialogueLine['tone'],
): VisualDialogueLine => ({ id: `${sceneId}-line-${index}`, phase, speakerId, text, tone });

const adjustExpeditionSchedule = (world: WorldState, expedition: CouncilExpedition): void => {
  const base = expedition.day * 24;
  expedition.departTick = base + 13;
  expedition.plannedReturnTick = base + 20;
  expedition.councilStatus = 'active';

  expedition.partyIds.forEach((heroId) => {
    const hero = world.heroes[heroId];
    if (!hero) return;
    const preparation = hero.dailyPlan.find((block) => block.expeditionId === expedition.id && block.actionId === 'work');
    if (preparation) {
      preparation.startHour = 8;
      preparation.endHour = 13;
      preparation.label = 'Совет, роли и сбор снаряжения';
      preparation.reason = 'группа должна договориться и подготовиться визуально';
    }
    const dungeon = hero.dailyPlan.find((block) => block.expeditionId === expedition.id && block.actionId === 'dungeon');
    if (dungeon) {
      dungeon.startHour = 13;
      dungeon.endHour = 20;
    }
    const recovery = hero.dailyPlan.find((block) => block.actionId === 'recover' && block.startHour === 16);
    if (recovery) {
      recovery.startHour = 20;
      recovery.endHour = 21;
    }
    const debrief = hero.dailyPlan.find((block) => block.groupId === `debrief-${expedition.day}`);
    if (debrief) {
      debrief.startHour = 21;
      debrief.endHour = 22;
    }
  });
};

const createCouncil = (world: WorldState, expedition: CouncilExpedition, startedAt: number): VisualScene => {
  const leadership = leadershipStateOf(world);
  const familyLeaderId = leadership.familyLeaderId;
  const leaderId = familyLeaderId && expedition.partyIds.includes(familyLeaderId)
    ? familyLeaderId
    : expedition.partyIds[0];
  const roles = assignRoles(world, expedition, leaderId);
  const responses = Object.fromEntries(expedition.partyIds.map((heroId) => {
    const hero = world.heroes[heroId];
    return [heroId, hero ? responseFor(world, hero, leaderId, roles[heroId]) : 'accepted'];
  })) as Record<string, CouncilResponse>;
  const state = visualSceneStateOf(world);
  const sceneId = `visual-${state.nextId}`;
  state.nextId += 1;
  const leader = world.heroes[leaderId];
  const dialogue: VisualDialogueLine[] = [
    line(sceneId, 0, 'gathering', leaderId, 'Соберитесь у стола. До выхода мы должны договориться о плане.', 'firm'),
    line(sceneId, 1, 'briefing', leaderId, `Цель — ${expedition.floor}-й этаж. Идём до вечера, но не ценой чьей-либо жизни.`, 'calm'),
  ];

  expedition.partyIds.forEach((heroId) => {
    const hero = world.heroes[heroId];
    if (!hero) return;
    const role = roles[heroId];
    if (heroId !== leaderId) {
      dialogue.push(line(
        sceneId,
        dialogue.length,
        'assigning',
        leaderId,
        `${hero.name}, твоя роль — ${roleLabels[role]}.`,
        'firm',
      ));
      const response = responses[heroId];
      dialogue.push(line(
        sceneId,
        dialogue.length,
        'assigning',
        heroId,
        response === 'accepted'
          ? 'Понял. Буду держать свою позицию.'
          : response === 'questioned'
            ? 'Я выполню роль, но хочу понять, почему решение именно такое.'
            : 'Нет. В таком составе и с такой ролью я не пойду.',
        response === 'accepted' ? 'warm' : response === 'questioned' ? 'doubtful' : 'tense',
      ));
    }
  });
  dialogue.push(line(sceneId, dialogue.length, 'equipping', leaderId, 'Проверьте оружие, припасы и перевязочные наборы. После этого — к выходу.', 'firm'));
  dialogue.push(line(sceneId, dialogue.length, 'departure', leaderId, 'Строй держим вместе. Выдвигаемся.', 'firm'));

  const scene: VisualScene = {
    id: sceneId,
    type: 'expeditionCouncil',
    title: `Совет перед походом на ${expedition.floor}-й этаж`,
    status: 'active',
    phase: 'gathering',
    createdAt: startedAt,
    updatedAt: startedAt,
    expeditionId: expedition.id,
    leaderId,
    participantIds: Object.keys(world.heroes),
    partyIds: [...expedition.partyIds],
    roles,
    responses,
    dialogue,
    currentLineIndex: 0,
  };

  expedition.councilSceneId = scene.id;
  expedition.councilStatus = 'active';
  expedition.roles = { ...roles };
  expedition.responses = { ...responses };
  expedition.leaderId = leaderId;
  adjustExpeditionSchedule(world, expedition);

  leader.emotions.anxiety = Math.min(100, leader.emotions.anxiety + 3);
  leader.emotions.inspiration = Math.min(100, leader.emotions.inspiration + 4);
  expedition.partyIds.forEach((heroId) => {
    const hero = world.heroes[heroId];
    if (!hero || heroId === leaderId) return;
    if (responses[heroId] === 'accepted') hero.emotions.inspiration = Math.min(100, hero.emotions.inspiration + 2);
    if (responses[heroId] === 'questioned') hero.emotions.irritation = Math.min(100, hero.emotions.irritation + 2);
  });

  pushJournal(
    world,
    `${leader.name} созвал семью на видимый совет перед экспедицией. Роли будут обсуждены до выхода.`,
    scene.participantIds,
    'system',
  );
  return scene;
};

const lineIndexForPhase = (scene: VisualScene, phase: VisualScenePhase): number => {
  const indexes = scene.dialogue
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => candidate.phase === phase)
    .map(({ index }) => index);
  if (!indexes.length) return scene.currentLineIndex;
  if (phase !== 'assigning') return indexes.at(-1) ?? scene.currentLineIndex;
  const elapsed = Math.max(0, scene.updatedAt - scene.createdAt);
  return indexes[elapsed % indexes.length] ?? indexes[0];
};

const prepareVisualScenes = (world: WorldState, upcomingTick: number): void => {
  const previous = visualSceneStateOf(world);
  const state = cloneSceneState(previous);
  (world as VisualWorld).visualScenes = state;
  const active = state.activeSceneId
    ? state.scenes.find((scene) => scene.id === state.activeSceneId && scene.status === 'active')
    : undefined;

  if (active) {
    const expedition = world.expeditions.find((candidate) => candidate.id === active.expeditionId) as CouncilExpedition | undefined;
    if (expedition && upcomingTick >= expedition.departTick) {
      active.status = 'resolved';
      active.phase = 'completed';
      active.updatedAt = upcomingTick;
      active.outcome = 'Совет завершён. Роли приняты, снаряжение собрано, группа вышла единым строем.';
      expedition.councilStatus = 'completed';
      state.activeSceneId = undefined;
      pushJournal(world, active.outcome, active.partyIds, 'system');
    }
    return;
  }

  const day = dayOf(upcomingTick);
  const hour = hourOf(upcomingTick);
  if (hour !== 8) return;
  const expedition = world.expeditions.find((candidate) => candidate.day === day && candidate.status === 'planned') as CouncilExpedition | undefined;
  if (!expedition || expedition.councilSceneId) return;
  const scene = createCouncil(world, expedition, upcomingTick);
  state.scenes.unshift(scene);
  state.scenes = state.scenes.slice(0, 30);
  state.activeSceneId = scene.id;
};

const advanceVisualScenes = (world: WorldState): void => {
  const previous = visualSceneStateOf(world);
  const state = cloneSceneState(previous);
  (world as VisualWorld).visualScenes = state;
  const scene = state.activeSceneId
    ? state.scenes.find((candidate) => candidate.id === state.activeSceneId && candidate.status === 'active')
    : undefined;
  if (!scene) return;
  const elapsed = Math.max(0, world.tick - scene.createdAt);
  scene.phase = phaseOrder[Math.min(phaseOrder.length - 2, elapsed)];
  scene.updatedAt = world.tick;
  scene.currentLineIndex = lineIndexForPhase(scene, scene.phase);
};

export const advanceLivingSimulation = (state: WorldState, steps = 1): WorldState => {
  let world = state;
  for (let step = 0; step < steps; step += 1) {
    const prepared = cloneWorld(world, world.tick);
    prepareVisualScenes(prepared, prepared.tick + 1);
    world = advanceCoreSimulation(prepared, 1);
    advanceVisualScenes(world);
  }
  return world;
};

const tablePositions = [
  { x: 49, y: 32 },
  { x: 42, y: 25 },
  { x: 56, y: 25 },
  { x: 41, y: 34 },
  { x: 57, y: 34 },
];
const equipmentPositions = [
  { x: 76, y: 54 },
  { x: 82, y: 58 },
  { x: 89, y: 53 },
  { x: 73, y: 61 },
];
const exitPositions = [
  { x: 78, y: 84 },
  { x: 85, y: 85 },
  { x: 91, y: 83 },
];

export const visualDirectiveForHero = (world: WorldState, heroId: string): VisualActorDirective | undefined => {
  const scene = activeVisualSceneOf(world);
  if (!scene || !scene.participantIds.includes(heroId)) return undefined;
  const participantIndex = scene.participantIds.indexOf(heroId);
  const partyIndex = scene.partyIds.indexOf(heroId);
  const isParty = partyIndex >= 0;
  const isLeader = heroId === scene.leaderId;
  const currentLine = scene.dialogue[scene.currentLineIndex];
  const isSpeaker = currentLine?.speakerId === heroId;
  const response = scene.responses[heroId];
  const role = scene.roles[heroId];

  if (scene.phase === 'equipping') {
    return {
      sceneId: scene.id,
      position: isParty ? equipmentPositions[partyIndex % equipmentPositions.length] : tablePositions[participantIndex % tablePositions.length],
      phase: 'acting',
      actionId: isParty ? 'work' : 'talk',
      bubble: isSpeaker ? currentLine?.text : isParty ? 'Проверяю снаряжение' : 'Провожаю группу',
      targetId: isLeader ? undefined : scene.leaderId,
      gesture: isParty ? 'pack' : 'listen',
      roleLabel: role ? roleLabels[role] : 'остаётся в кибитке',
      reaction: response === 'questioned' ? '?' : response === 'refused' ? '!' : undefined,
      prop: isParty ? 'pack' : undefined,
    };
  }

  if (scene.phase === 'departure') {
    return {
      sceneId: scene.id,
      position: isParty ? exitPositions[partyIndex % exitPositions.length] : { x: 49, y: 40 },
      phase: isParty ? 'acting' : 'interacting',
      actionId: isParty ? 'work' : 'talk',
      bubble: isSpeaker ? currentLine?.text : isParty ? 'Готов к выходу' : 'Возвращайтесь живыми',
      targetId: isLeader ? undefined : scene.leaderId,
      gesture: isParty ? 'ready' : 'listen',
      roleLabel: role ? roleLabels[role] : 'остаётся дома',
      reaction: isParty ? '✓' : undefined,
      prop: isParty ? 'weapon' : undefined,
    };
  }

  const gesture: VisualGesture = isSpeaker
    ? isLeader ? 'address' : response === 'questioned' ? 'question' : 'agree'
    : 'listen';
  return {
    sceneId: scene.id,
    position: tablePositions[participantIndex % tablePositions.length],
    phase: 'interacting',
    actionId: 'talk',
    bubble: isSpeaker ? currentLine?.text : undefined,
    targetId: isLeader ? undefined : scene.leaderId,
    gesture,
    roleLabel: role ? roleLabels[role] : 'участник совета',
    reaction: response === 'questioned' ? '?' : response === 'refused' ? '!' : response === 'accepted' && scene.phase === 'assigning' ? '✓' : undefined,
    prop: isLeader && scene.phase === 'briefing' ? 'map' : undefined,
  };
};
