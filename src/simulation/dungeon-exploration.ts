import type { DungeonEvent, Expedition, Hero, InventoryItem, WorldState } from './model';
import { changeRelationship, clamp, deterministicUnit, pushJournal } from './internal';

export type DungeonRoomKind =
  | 'entrance'
  | 'hall'
  | 'fork'
  | 'trap'
  | 'cache'
  | 'enemy'
  | 'refuge';

export type DungeonExplorationPhase =
  | 'entering'
  | 'scouting'
  | 'choosing'
  | 'crossing'
  | 'looting'
  | 'assessing'
  | 'returning'
  | 'completed';

export type DungeonRole = 'leader' | 'vanguard' | 'scout' | 'support';
export type DungeonActorStatus = 'moving' | 'scouting' | 'guarding' | 'searching' | 'warning' | 'helping' | 'returning';

export interface DungeonRoomState {
  id: string;
  label: string;
  kind: DungeonRoomKind;
  x: number;
  y: number;
  width: number;
  height: number;
  danger: number;
  discovered: boolean;
  visited: boolean;
  resolved: boolean;
}

export interface DungeonCorridorState {
  id: string;
  fromId: string;
  toId: string;
}

export interface DungeonPartyActorState {
  heroId: string;
  role: DungeonRole;
  x: number;
  y: number;
  roomId: string;
  status: DungeonActorStatus;
  bubble?: string;
  reaction?: string;
}

export interface DungeonDecisionRecord {
  id: string;
  tick: number;
  actorId: string;
  kind: 'route' | 'trap' | 'loot' | 'threat' | 'formation' | 'help';
  text: string;
}

export interface DungeonExplorationState {
  id: string;
  expeditionId: string;
  status: 'active' | 'returning' | 'completed';
  phase: DungeonExplorationPhase;
  step: number;
  lastAdvancedTick: number;
  currentRoomId: string;
  targetRoomId?: string;
  leaderId: string;
  scoutId: string;
  rooms: DungeonRoomState[];
  corridors: DungeonCorridorState[];
  actors: Record<string, DungeonPartyActorState>;
  routeHistory: string[];
  decisions: DungeonDecisionRecord[];
  discoveredRoomIds: string[];
  visitedRoomIds: string[];
  routeChoice?: 'short-risky' | 'safe-long';
  trapDetected?: boolean;
  chestOpened?: boolean;
  enemySpotted?: boolean;
  threatDecision?: 'avoid' | 'retreat';
  outcome?: string;
}

export type ExplorationExpedition = Expedition & {
  leaderId?: string;
  roles?: Record<string, DungeonRole>;
  exploration?: DungeonExplorationState;
};

const roomTemplates: Array<Omit<DungeonRoomState, 'discovered' | 'visited' | 'resolved'>> = [
  { id: 'entrance', label: 'Каменный вход', kind: 'entrance', x: 11, y: 80, width: 15, height: 13, danger: 4 },
  { id: 'hall', label: 'Затопленный проход', kind: 'hall', x: 28, y: 68, width: 17, height: 13, danger: 12 },
  { id: 'fork', label: 'Развилка старых шахт', kind: 'fork', x: 47, y: 57, width: 18, height: 15, danger: 18 },
  { id: 'trap', label: 'Галерея нажимных плит', kind: 'trap', x: 65, y: 42, width: 17, height: 14, danger: 42 },
  { id: 'refuge', label: 'Защищённая ниша', kind: 'refuge', x: 43, y: 24, width: 18, height: 14, danger: 8 },
  { id: 'cache', label: 'Заброшенная кладовая', kind: 'cache', x: 82, y: 25, width: 18, height: 16, danger: 22 },
  { id: 'enemy', label: 'Зал спящего стража', kind: 'enemy', x: 81, y: 66, width: 19, height: 17, danger: 68 },
];

const corridorTemplates: DungeonCorridorState[] = [
  { id: 'entrance-hall', fromId: 'entrance', toId: 'hall' },
  { id: 'hall-fork', fromId: 'hall', toId: 'fork' },
  { id: 'fork-trap', fromId: 'fork', toId: 'trap' },
  { id: 'fork-refuge', fromId: 'fork', toId: 'refuge' },
  { id: 'trap-cache', fromId: 'trap', toId: 'cache' },
  { id: 'refuge-cache', fromId: 'refuge', toId: 'cache' },
  { id: 'cache-enemy', fromId: 'cache', toId: 'enemy' },
  { id: 'enemy-fork', fromId: 'enemy', toId: 'fork' },
];

const cloneExploration = (state: DungeonExplorationState): DungeonExplorationState => ({
  ...state,
  rooms: state.rooms.map((room) => ({ ...room })),
  corridors: state.corridors.map((corridor) => ({ ...corridor })),
  actors: Object.fromEntries(Object.entries(state.actors).map(([id, actor]) => [id, { ...actor }])),
  routeHistory: [...state.routeHistory],
  decisions: state.decisions.map((decision) => ({ ...decision })),
  discoveredRoomIds: [...state.discoveredRoomIds],
  visitedRoomIds: [...state.visitedRoomIds],
});

const heroParty = (world: WorldState, expedition: Expedition): Hero[] =>
  expedition.partyIds.map((id) => world.heroes[id]).filter(Boolean);

const strongestBy = (heroes: Hero[], score: (hero: Hero) => number): Hero =>
  [...heroes].sort((left, right) => score(right) - score(left))[0];

const roleOf = (expedition: ExplorationExpedition, hero: Hero, leaderId: string, scoutId: string): DungeonRole => {
  const assigned = expedition.roles?.[hero.id];
  if (assigned) return assigned;
  if (hero.id === leaderId) return 'leader';
  if (hero.id === scoutId) return 'scout';
  return hero.stats.strength + hero.stats.endurance > hero.stats.magic + hero.traits.empathy
    ? 'vanguard'
    : 'support';
};

const roomById = (exploration: DungeonExplorationState, roomId: string): DungeonRoomState => {
  const room = exploration.rooms.find((candidate) => candidate.id === roomId);
  if (!room) throw new Error(`Unknown dungeon room: ${roomId}`);
  return room;
};

const addUnique = (items: string[], value: string): void => {
  if (!items.includes(value)) items.push(value);
};

const addLoot = (expedition: Expedition, item: InventoryItem): void => {
  const existing = expedition.loot.find((candidate) => candidate.id === item.id);
  if (existing) existing.quantity += item.quantity;
  else expedition.loot.push({ ...item });
};

const recordEvent = (
  world: WorldState,
  expedition: Expedition,
  type: DungeonEvent['type'],
  text: string,
  heroIds = expedition.partyIds,
): void => {
  const event: DungeonEvent = {
    id: `${expedition.id}-${world.tick}-${expedition.events.length}`,
    tick: world.tick,
    type,
    text,
    heroIds,
  };
  expedition.events.unshift(event);
  expedition.events = expedition.events.slice(0, 60);
  pushJournal(world, text, heroIds, 'dungeon');
};

const recordDecision = (
  exploration: DungeonExplorationState,
  world: WorldState,
  actorId: string,
  kind: DungeonDecisionRecord['kind'],
  text: string,
): void => {
  exploration.decisions.unshift({
    id: `${exploration.id}-${world.tick}-${kind}-${exploration.decisions.length}`,
    tick: world.tick,
    actorId,
    kind,
    text,
  });
  exploration.decisions = exploration.decisions.slice(0, 24);
};

const revealRoom = (exploration: DungeonExplorationState, roomId: string, visited = true): void => {
  const room = roomById(exploration, roomId);
  room.discovered = true;
  room.visited = room.visited || visited;
  addUnique(exploration.discoveredRoomIds, roomId);
  if (visited) addUnique(exploration.visitedRoomIds, roomId);
};

const formationOffsets: Record<DungeonRole, { forward: number; side: number }> = {
  scout: { forward: 7.5, side: 0 },
  vanguard: { forward: 3.5, side: 3.4 },
  leader: { forward: 0, side: 0 },
  support: { forward: -4.5, side: -2.8 },
};

const moveFormation = (
  exploration: DungeonExplorationState,
  expedition: ExplorationExpedition,
  world: WorldState,
  roomId: string,
  targetRoomId: string | undefined,
  statusByRole: Partial<Record<DungeonRole, DungeonActorStatus>> = {},
  bubbles: Partial<Record<string, string>> = {},
  reactions: Partial<Record<string, string>> = {},
): void => {
  const room = roomById(exploration, roomId);
  const target = targetRoomId ? roomById(exploration, targetRoomId) : room;
  const dx = target.x - room.x;
  const dy = target.y - room.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const fx = dx / length;
  const fy = dy / length;
  const px = -fy;
  const py = fx;

  expedition.partyIds.forEach((heroId, index) => {
    const hero = world.heroes[heroId];
    if (!hero) return;
    const role = roleOf(expedition, hero, exploration.leaderId, exploration.scoutId);
    const offset = formationOffsets[role] ?? { forward: -2 - index * 2, side: index * 2 };
    const spread = expedition.partyIds.length > 3 ? index * 0.8 : 0;
    exploration.actors[heroId] = {
      heroId,
      role,
      roomId,
      x: clamp(room.x + fx * offset.forward + px * (offset.side + spread), 4, 96),
      y: clamp(room.y + fy * offset.forward + py * (offset.side + spread), 5, 95),
      status: statusByRole[role] ?? (role === 'scout' ? 'scouting' : role === 'vanguard' ? 'guarding' : 'moving'),
      bubble: bubbles[heroId],
      reaction: reactions[heroId],
    };
  });
  exploration.currentRoomId = roomId;
  exploration.targetRoomId = targetRoomId;
  addUnique(exploration.routeHistory, roomId);
};

const partyPower = (heroes: Hero[]): number =>
  heroes.reduce((total, hero) => total
    + hero.stats.strength * 0.36
    + hero.stats.endurance * 0.3
    + hero.stats.dexterity * 0.18
    + hero.stats.magic * 0.16,
  0) / Math.max(1, heroes.length);

export const dungeonExplorationOf = (expedition: Expedition | undefined): DungeonExplorationState | undefined =>
  (expedition as ExplorationExpedition | undefined)?.exploration;

export const ensureDungeonExploration = (
  world: WorldState,
  expedition: Expedition,
): DungeonExplorationState => {
  const extended = expedition as ExplorationExpedition;
  if (extended.exploration) return extended.exploration;
  const heroes = heroParty(world, expedition);
  const leader = extended.leaderId && world.heroes[extended.leaderId]
    ? world.heroes[extended.leaderId]
    : strongestBy(heroes, (hero) => hero.traits.discipline + hero.traits.courage + hero.psyche.confidence);
  const assignedScoutId = Object.entries(extended.roles ?? {}).find(([, role]) => role === 'scout')?.[0];
  const scout = assignedScoutId && world.heroes[assignedScoutId]
    ? world.heroes[assignedScoutId]
    : strongestBy(heroes, (hero) => hero.stats.perception * 0.7 + hero.stats.dexterity * 0.3);

  const exploration: DungeonExplorationState = {
    id: `exploration-${expedition.id}`,
    expeditionId: expedition.id,
    status: 'active',
    phase: 'entering',
    step: 0,
    lastAdvancedTick: world.tick,
    currentRoomId: 'entrance',
    targetRoomId: 'hall',
    leaderId: leader.id,
    scoutId: scout.id,
    rooms: roomTemplates.map((room) => ({ ...room, discovered: room.id === 'entrance', visited: room.id === 'entrance', resolved: false })),
    corridors: corridorTemplates.map((corridor) => ({ ...corridor })),
    actors: {},
    routeHistory: ['entrance'],
    decisions: [],
    discoveredRoomIds: ['entrance'],
    visitedRoomIds: ['entrance'],
  };
  extended.exploration = exploration;
  moveFormation(exploration, extended, world, 'entrance', 'hall', { scout: 'scouting' }, {
    [leader.id]: 'Проверяем строй. Разведчик — вперёд.',
    [scout.id]: 'Вижу первый проход. Иду тихо.',
  });
  recordDecision(exploration, world, leader.id, 'formation', `${leader.name} выстроил группу и отправил ${scout.name} впереди основного строя.`);
  recordEvent(world, expedition, 'travel', `${heroes.map((hero) => hero.name).join(', ')} вошли на этаж. ${scout.name} занял позицию разведчика, ${leader.name} удерживает общий строй.`);
  return exploration;
};

const stepIntoHall = (world: WorldState, expedition: ExplorationExpedition, exploration: DungeonExplorationState): void => {
  revealRoom(exploration, 'hall');
  exploration.phase = 'scouting';
  moveFormation(exploration, expedition, world, 'hall', 'fork', { scout: 'scouting' }, {
    [exploration.scoutId]: 'Следы свежие. Дальше развилка.',
    [exploration.leaderId]: 'Не растягиваться. Держим дистанцию.',
  });
  recordEvent(world, expedition, 'travel', `${world.heroes[exploration.scoutId]?.name} первым прошёл затопленный коридор и дал группе сигнал двигаться дальше.`);
};

const stepIntoFork = (world: WorldState, expedition: ExplorationExpedition, exploration: DungeonExplorationState): void => {
  revealRoom(exploration, 'fork');
  exploration.phase = 'choosing';
  const leader = world.heroes[exploration.leaderId];
  const boldness = leader.traits.courage + leader.traits.ambition + leader.traits.impulsiveness * 0.45;
  const caution = leader.traits.caution + leader.emotions.fear + leader.condition.injury * 0.8;
  exploration.routeChoice = boldness >= caution * 1.05 ? 'short-risky' : 'safe-long';
  const targetRoomId = exploration.routeChoice === 'short-risky' ? 'trap' : 'refuge';
  const suggestion = exploration.routeChoice === 'short-risky'
    ? 'Короткий путь быстрее, но камни впереди выглядят слишком ровными.'
    : 'Слева есть более длинный проход с укрытием.';
  moveFormation(exploration, expedition, world, 'fork', targetRoomId, { scout: 'warning', leader: 'guarding' }, {
    [exploration.scoutId]: suggestion,
    [exploration.leaderId]: exploration.routeChoice === 'short-risky'
      ? 'Идём коротким путём. Наступать только по следам разведчика.'
      : 'Риск не оправдан. Берём длинный безопасный маршрут.',
  }, { [exploration.scoutId]: '!', [exploration.leaderId]: '→' });
  const decisionText = exploration.routeChoice === 'short-risky'
    ? `${leader.name} выбрал короткую галерею, потребовав идти строго по следам разведчика.`
    : `${leader.name} отказался от короткой галереи и повёл группу через защищённую нишу.`;
  recordDecision(exploration, world, leader.id, 'route', decisionText);
  recordEvent(world, expedition, 'travel', decisionText);
};

const stepAcrossRoute = (world: WorldState, expedition: ExplorationExpedition, exploration: DungeonExplorationState): void => {
  const leader = world.heroes[exploration.leaderId];
  const scout = world.heroes[exploration.scoutId];
  if (exploration.routeChoice === 'safe-long') {
    revealRoom(exploration, 'refuge');
    roomById(exploration, 'refuge').resolved = true;
    exploration.phase = 'crossing';
    moveFormation(exploration, expedition, world, 'refuge', 'cache', { scout: 'scouting', support: 'helping' }, {
      [leader.id]: 'Короткая проверка снаряжения. Потом к кладовой.',
      [scout.id]: 'Проход чист. Слышу пустоту впереди.',
    });
    expedition.partyIds.forEach((heroId) => {
      const hero = world.heroes[heroId];
      if (!hero) return;
      hero.needs.fatigue = clamp(hero.needs.fatigue - 3);
      hero.psyche.stress = clamp(hero.psyche.stress - 2);
    });
    recordEvent(world, expedition, 'rest', 'Группа прошла через защищённую нишу, перевела дыхание и сохранила строй.');
    return;
  }

  revealRoom(exploration, 'trap');
  const trap = roomById(exploration, 'trap');
  const detectionScore = scout.stats.perception * 0.72 + scout.stats.dexterity * 0.28
    + deterministicUnit(`${world.seed}:${expedition.id}:trap`) * 24;
  exploration.trapDetected = detectionScore >= 52;
  trap.resolved = true;
  exploration.phase = 'crossing';
  if (exploration.trapDetected) {
    scout.stats.perception = clamp(scout.stats.perception + 0.4);
    changeRelationship(leader, scout.id, 'respect', 1.8);
    changeRelationship(leader, scout.id, 'trust', 1.2);
    moveFormation(exploration, expedition, world, 'trap', 'cache', { scout: 'warning', leader: 'guarding' }, {
      [scout.id]: 'Стоп. Нажимные плиты. Наступайте только сюда.',
      [leader.id]: 'Все видели метки. По одному, без спешки.',
    }, { [scout.id]: '!', [leader.id]: '✓' });
    const text = `${scout.name} заметил нажимные плиты до того, как группа вошла в опасную часть галереи. ${leader.name} организовал переход по безопасным камням.`;
    recordDecision(exploration, world, scout.id, 'trap', text);
    recordEvent(world, expedition, 'danger', text, [scout.id, ...expedition.partyIds.filter((id) => id !== scout.id)]);
  } else {
    const victim = strongestBy(heroParty(world, expedition), (hero) => hero.needs.fatigue + hero.traits.impulsiveness);
    victim.condition.health = clamp(victim.condition.health - 7);
    victim.condition.injury = clamp(victim.condition.injury + 9);
    victim.emotions.fear = clamp(victim.emotions.fear + 8);
    moveFormation(exploration, expedition, world, 'trap', 'cache', { scout: 'warning', support: 'helping' }, {
      [victim.id]: 'Плита ушла вниз! Я ранен.',
      [exploration.scoutId]: 'Назад на отмеченные камни!',
    }, { [victim.id]: '!', [exploration.scoutId]: '!' });
    const text = `${victim.name} задел скрытую плиту и получил лёгкую травму. Группа остановилась, после чего разведчик нашёл безопасный край прохода.`;
    recordDecision(exploration, world, scout.id, 'trap', text);
    recordEvent(world, expedition, 'danger', text);
  }
};

const stepIntoCache = (world: WorldState, expedition: ExplorationExpedition, exploration: DungeonExplorationState): void => {
  revealRoom(exploration, 'cache');
  const cache = roomById(exploration, 'cache');
  cache.resolved = true;
  exploration.chestOpened = true;
  exploration.phase = 'looting';
  const supportId = expedition.partyIds.find((heroId) => exploration.actors[heroId]?.role === 'support')
    ?? expedition.partyIds.find((id) => id !== exploration.leaderId)
    ?? exploration.leaderId;
  const support = world.heroes[supportId];
  const amount = 1 + Math.floor(deterministicUnit(`${world.seed}:${expedition.id}:cache`) * 3);
  const item: InventoryItem = {
    id: 'ancient-supply-cache',
    name: 'Старинные припасы',
    quantity: amount,
    category: 'loot',
  };
  addLoot(expedition, item);
  expedition.partyIds.forEach((heroId) => {
    const hero = world.heroes[heroId];
    if (!hero) return;
    hero.emotions.interest = clamp(hero.emotions.interest + 3);
    hero.emotions.joy = clamp(hero.emotions.joy + 2);
  });
  moveFormation(exploration, expedition, world, 'cache', 'enemy', { scout: 'scouting', support: 'searching', leader: 'guarding' }, {
    [supportId]: 'Сундук не заперт. Внутри ещё пригодные припасы.',
    [exploration.leaderId]: 'Берём только то, что не замедлит возвращение.',
  }, { [supportId]: '✦' });
  const text = `${support.name} осмотрел старый сундук, а лидер распределил вес. Группа забрала: ${item.name.toLowerCase()} ×${item.quantity}.`;
  recordDecision(exploration, world, supportId, 'loot', text);
  recordEvent(world, expedition, 'discovery', text);
};

const stepIntoThreat = (world: WorldState, expedition: ExplorationExpedition, exploration: DungeonExplorationState): void => {
  revealRoom(exploration, 'enemy', false);
  const enemy = roomById(exploration, 'enemy');
  exploration.enemySpotted = true;
  exploration.phase = 'assessing';
  const heroes = heroParty(world, expedition);
  const leader = world.heroes[exploration.leaderId];
  const scout = world.heroes[exploration.scoutId];
  const enemyPower = enemy.danger + expedition.floor * 8
    + deterministicUnit(`${world.seed}:${expedition.id}:enemy`) * 18;
  const currentPower = partyPower(heroes);
  const healthPressure = heroes.reduce((total, hero) => total + (100 - hero.condition.health) + hero.condition.injury, 0)
    / Math.max(1, heroes.length);
  const retreatPressure = leader.traits.caution * 0.32 + leader.emotions.fear * 0.28 + healthPressure * 0.45;
  const confidence = currentPower * 0.7 + leader.traits.courage * 0.25 + leader.psyche.confidence * 0.2;
  exploration.threatDecision = enemyPower + retreatPressure > confidence + 18 ? 'retreat' : 'avoid';
  exploration.status = 'returning';
  enemy.resolved = true;
  const leaderLine = exploration.threatDecision === 'retreat'
    ? 'Страж проснулся. Разворачиваемся сейчас — добыча не стоит раненых.'
    : 'Не вступаем в бой. Гасим свет и обходим зал по стене.';
  moveFormation(exploration, expedition, world, 'cache', 'fork', { scout: 'warning', leader: 'guarding', support: 'helping' }, {
    [scout.id]: 'В зале впереди крупный страж. Он ещё не заметил нас.',
    [leader.id]: leaderLine,
  }, { [scout.id]: '!', [leader.id]: exploration.threatDecision === 'retreat' ? '↩' : '↷' });
  const text = exploration.threatDecision === 'retreat'
    ? `${scout.name} заметил спящего стража. ${leader.name} оценил состояние группы и приказал немедленно отступить без боя.`
    : `${scout.name} заметил спящего стража. ${leader.name} запретил бой и выбрал тихий обход по уже разведанному краю.`;
  recordDecision(exploration, world, leader.id, 'threat', text);
  recordEvent(world, expedition, 'danger', text);
  heroes.forEach((hero) => {
    hero.emotions.fear = clamp(hero.emotions.fear + 3);
    hero.psyche.stress = clamp(hero.psyche.stress + 2);
    if (hero.id !== leader.id) changeRelationship(hero, leader.id, 'respect', exploration.threatDecision === 'retreat' ? 0.8 : 1.2);
  });
};

const stepReturnAndHelp = (world: WorldState, expedition: ExplorationExpedition, exploration: DungeonExplorationState): void => {
  exploration.phase = 'returning';
  exploration.status = 'returning';
  revealRoom(exploration, 'hall');
  const heroes = heroParty(world, expedition);
  const lagger = strongestBy(heroes, (hero) => hero.needs.fatigue + hero.condition.injury * 1.4);
  const helper = heroes
    .filter((hero) => hero.id !== lagger.id)
    .sort((left, right) =>
      (exploration.actors[right.id]?.role === 'support' ? 40 : 0) + right.traits.empathy + right.traits.kindness
      - ((exploration.actors[left.id]?.role === 'support' ? 40 : 0) + left.traits.empathy + left.traits.kindness))[0];
  const bubbles: Record<string, string> = {
    [exploration.leaderId]: 'Темп снижаем. Никого не оставляем позади.',
    [lagger.id]: 'Я отстаю. Дайте секунду.',
  };
  const reactions: Record<string, string> = { [lagger.id]: '…' };
  if (helper) {
    bubbles[helper.id] = `Я рядом, ${lagger.name}. Держись за плечо.`;
    reactions[helper.id] = '♥';
    changeRelationship(lagger, helper.id, 'trust', 2.2);
    changeRelationship(lagger, helper.id, 'closeness', 1.4);
    changeRelationship(helper, lagger.id, 'closeness', 0.8);
    helper.needs.fatigue = clamp(helper.needs.fatigue + 3);
    const text = `${lagger.name} начал отставать на обратном пути. ${helper.name} поддержал его, а лидер снизил темп всей группы.`;
    recordDecision(exploration, world, helper.id, 'help', text);
    recordEvent(world, expedition, 'bond', text, [lagger.id, helper.id, exploration.leaderId]);
  }
  moveFormation(exploration, expedition, world, 'hall', 'entrance', { support: 'helping', scout: 'scouting', leader: 'guarding' }, bubbles, reactions);
};

const stepReachEntrance = (world: WorldState, expedition: ExplorationExpedition, exploration: DungeonExplorationState): void => {
  exploration.phase = 'returning';
  exploration.status = 'returning';
  moveFormation(exploration, expedition, world, 'entrance', undefined, { scout: 'returning', vanguard: 'returning', leader: 'returning', support: 'returning' }, {
    [exploration.leaderId]: 'Все на месте. Выходим наружу.',
  }, { [exploration.leaderId]: '✓' });
  exploration.outcome = exploration.threatDecision === 'retreat'
    ? 'Группа вернулась после осознанного отступления, не вступая в бой со стражем.'
    : 'Группа исследовала маршрут, забрала находку и вернулась, избежав ненужного боя.';
};

export const advanceDungeonExploration = (
  world: WorldState,
  expedition: Expedition,
): 'active' | 'complete' | 'retreat' => {
  const extended = expedition as ExplorationExpedition;
  const existing = ensureDungeonExploration(world, expedition);
  if (existing.lastAdvancedTick === world.tick) return 'active';
  const exploration = cloneExploration(existing);
  extended.exploration = exploration;
  exploration.lastAdvancedTick = world.tick;
  exploration.step += 1;

  if (exploration.step === 1) stepIntoHall(world, extended, exploration);
  else if (exploration.step === 2) stepIntoFork(world, extended, exploration);
  else if (exploration.step === 3) stepAcrossRoute(world, extended, exploration);
  else if (exploration.step === 4) stepIntoCache(world, extended, exploration);
  else if (exploration.step === 5) stepIntoThreat(world, extended, exploration);
  else if (exploration.step === 6) stepReturnAndHelp(world, extended, exploration);
  else if (exploration.step === 7) stepReachEntrance(world, extended, exploration);
  else {
    exploration.phase = 'completed';
    exploration.status = 'completed';
    return exploration.threatDecision === 'retreat' ? 'retreat' : 'complete';
  }

  expedition.progress = clamp((exploration.step / 8) * 100, 0, 96);
  return 'active';
};

export const markDungeonExplorationCompleted = (expedition: Expedition, retreated: boolean): void => {
  const exploration = dungeonExplorationOf(expedition);
  if (!exploration) return;
  exploration.status = 'completed';
  exploration.phase = 'completed';
  exploration.outcome = exploration.outcome ?? (retreated
    ? 'Группа завершила исследование осознанным отступлением.'
    : 'Группа завершила разведку этажа и вернулась к выходу.');
};
