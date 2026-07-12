import type {
  ActionId,
  ActionScore,
  Expedition,
  Hero,
  PlanBlock,
  PlanSource,
  WorldState,
} from './model';
import { actionLabels, evaluateActions } from './decisions';
import { clamp, deterministicUnit, pushJournal } from './internal';

export const dayOf = (tick: number) => Math.floor(tick / 24);
export const hourOf = (tick: number) => ((tick % 24) + 24) % 24;

export const defaultDurations: Record<ActionId, number> = {
  eat: 1,
  sleep: 7,
  train: 3,
  read: 2,
  talk: 1,
  help: 2,
  apologize: 1,
  seekSolitude: 2,
  work: 3,
  dungeon: 7,
  recover: 2,
};

const block = (
  hero: Hero,
  day: number,
  startHour: number,
  endHour: number,
  actionId: ActionId,
  label: string,
  source: PlanSource,
  extra: Partial<PlanBlock> = {},
): PlanBlock => ({
  id: `${hero.id}-${day}-${startHour}-${actionId}`,
  day,
  startHour,
  endHour,
  actionId,
  label,
  source,
  status: 'planned',
  ...extra,
});

const socialTarget = (hero: Hero, world: WorldState): string | undefined =>
  Object.values(world.heroes)
    .filter((candidate) => candidate.id !== hero.id)
    .sort((left, right) =>
      (hero.relationships[right.id]?.values.liking ?? 0)
      - (hero.relationships[left.id]?.values.liking ?? 0))[0]?.id;

const personalActions = (hero: Hero): [ActionId, ActionId, ActionId] => {
  const learning = hero.traits.curiosity + hero.stats.magic > hero.traits.ambition + hero.stats.strength;
  const caring = hero.traits.kindness + hero.traits.empathy > 145;
  const primary: ActionId = learning ? 'read' : hero.traits.ambition > 70 ? 'train' : 'work';
  const secondary: ActionId = caring ? 'help' : learning ? 'train' : 'work';
  const evening: ActionId = hero.traits.friendliness > 58 ? 'talk' : hero.traits.curiosity > 65 ? 'read' : 'seekSolitude';
  return [primary, secondary, evening];
};

const readiness = (hero: Hero) =>
  hero.traits.courage * 0.3
  + hero.stats.endurance * 0.45
  + hero.condition.health * 0.25
  - hero.condition.injury * 0.7
  - hero.needs.fatigue * 0.25;

const ensureExpeditionForDay = (world: WorldState, day: number): Expedition | undefined => {
  const existing = world.expeditions.find((expedition) => expedition.day === day);
  if (existing) return existing;
  if (day % 2 !== 0) return undefined;

  const partyIds = Object.values(world.heroes)
    .filter((hero) => hero.condition.health > 55 && hero.condition.injury < 45)
    .sort((left, right) => readiness(right) - readiness(left))
    .slice(0, Math.min(3, Math.max(2, Object.keys(world.heroes).length - 1)))
    .map((hero) => hero.id);

  if (partyIds.length < 2) return undefined;

  const expedition: Expedition = {
    id: `expedition-${world.nextExpeditionId}`,
    day,
    floor: 1 + Math.floor(day / 2),
    partyIds,
    departTick: day * 24 + 9,
    plannedReturnTick: day * 24 + 16,
    status: 'planned',
    progress: 0,
    risk: clamp(24 + day * 4),
    loot: [],
    events: [],
  };
  world.nextExpeditionId += 1;
  world.expeditions.push(expedition);
  pushJournal(
    world,
    `На день запланирован поход на ${expedition.floor}-й этаж: ${partyIds.map((id) => world.heroes[id]?.name).join(', ')}.`,
    partyIds,
    'system',
  );
  return expedition;
};

const buildPlan = (hero: Hero, world: WorldState, day: number, expedition?: Expedition): PlanBlock[] => {
  const [primary, secondary, evening] = personalActions(hero);
  const targetId = socialTarget(hero, world);
  const inParty = expedition?.partyIds.includes(hero.id) ?? false;
  const plan: PlanBlock[] = [
    block(hero, day, 0, 6, 'sleep', 'Ночной сон', 'routine', { groupId: `sleep-${day}` }),
    block(hero, day, 6, 7, hero.condition.injury > 20 ? 'recover' : 'seekSolitude', hero.condition.injury > 20 ? 'Перевязка и восстановление' : 'Спокойное начало дня', 'personal'),
    block(hero, day, world.routine.breakfastHour, world.routine.breakfastHour + 1, 'eat', 'Общий завтрак', 'group', { groupId: `breakfast-${day}` }),
  ];

  if (inParty && expedition) {
    plan.push(
      block(hero, day, 8, 9, 'work', 'Собрать снаряжение', 'group', { groupId: `prepare-${expedition.id}`, expeditionId: expedition.id }),
      block(hero, day, 9, 16, 'dungeon', `Поход на ${expedition.floor}-й этаж`, 'group', { groupId: expedition.id, expeditionId: expedition.id }),
      block(hero, day, 16, 18, 'recover', 'Отдых после похода', 'routine'),
      block(hero, day, 18, 19, 'talk', 'Обсудить поход с семьёй', 'group', { targetId, groupId: `debrief-${day}` }),
    );
  } else {
    plan.push(
      block(hero, day, 8, 12, primary, actionLabels[primary], 'personal', { targetId: primary === 'help' || primary === 'talk' ? targetId : undefined }),
      block(hero, day, 12, 13, hero.traits.kindness > 65 ? 'help' : 'talk', hero.traits.kindness > 65 ? 'Помочь по дому' : 'Поговорить у очага', 'group', { targetId, groupId: `midday-${day}` }),
      block(hero, day, world.routine.lunchHour, world.routine.lunchHour + 1, 'eat', 'Общий обед', 'group', { groupId: `lunch-${day}` }),
      block(hero, day, 14, 18, secondary, actionLabels[secondary], 'personal', { targetId: secondary === 'help' || secondary === 'talk' ? targetId : undefined }),
      block(hero, day, 18, 19, 'talk', 'Время с семьёй', 'group', { targetId, groupId: `family-${day}` }),
    );
  }

  plan.push(
    block(hero, day, world.routine.dinnerHour, world.routine.dinnerHour + 1, 'eat', 'Общий ужин', 'group', { groupId: `dinner-${day}` }),
    block(hero, day, 20, 22, evening, evening === 'talk' ? 'Вечернее общение' : actionLabels[evening], evening === 'talk' ? 'group' : 'personal', { targetId: evening === 'talk' ? targetId : undefined, groupId: evening === 'talk' ? `evening-${day}` : undefined }),
    block(hero, day, 22, 23, hero.psyche.stress > 45 ? 'seekSolitude' : 'read', hero.psyche.stress > 45 ? 'Успокоиться перед сном' : 'Тихий час', 'routine'),
    block(hero, day, world.routine.sleepHour, 24, 'sleep', 'Отбой', 'routine', { groupId: `sleep-${day + 1}` }),
  );

  return plan.sort((left, right) => left.startHour - right.startHour);
};

export const ensureDailyPlans = (world: WorldState): void => {
  const day = dayOf(world.tick);
  const expedition = ensureExpeditionForDay(world, day);
  Object.values(world.heroes).forEach((hero) => {
    if (hero.planDay === day && hero.dailyPlan.length > 0) return;
    hero.dailyPlan = buildPlan(hero, world, day, expedition);
    hero.planDay = day;
    hero.lastReplanTick = world.tick - 3;
  });
};

export const planBlockAt = (hero: Hero, tick: number): PlanBlock | undefined => {
  const day = dayOf(tick);
  const hour = hourOf(tick);
  return hero.dailyPlan.find((candidate) =>
    candidate.day === day
    && candidate.startHour <= hour
    && candidate.endHour > hour
    && candidate.status !== 'skipped');
};

export const crisisAction = (hero: Hero): ActionId | undefined => {
  if (hero.condition.health < 48 || hero.condition.injury > 58) return 'recover';
  if (hero.needs.fatigue > 91) return 'sleep';
  if (hero.needs.hunger > 88) return 'eat';
  return undefined;
};

export const scoreFromPlan = (hero: Hero, plan: PlanBlock): ActionScore => ({
  actionId: plan.actionId,
  label: plan.label,
  score: 100 + hero.traits.discipline * 0.2,
  targetId: plan.targetId,
  reasons: [
    { label: plan.source === 'group' ? 'общий план семьи' : 'запланировано утром', value: 65 },
    { label: `блок ${plan.startHour.toString().padStart(2, '0')}:00–${plan.endHour.toString().padStart(2, '0')}:00`, value: 45 },
  ],
});

export const chooseUnplannedAction = (hero: Hero, world: WorldState): ActionScore =>
  evaluateActions(hero, world)[0];

export const insertReplan = (
  hero: Hero,
  world: WorldState,
  action: ActionScore,
  source: 'replan' | 'crisis',
  reason: string,
): PlanBlock => {
  const hour = hourOf(world.tick);
  const duration = Math.min(defaultDurations[action.actionId], Math.max(1, 24 - hour));
  hero.dailyPlan.forEach((candidate) => {
    if (candidate.startHour <= hour && candidate.endHour > hour && candidate.status === 'planned') {
      candidate.status = source === 'crisis' ? 'interrupted' : 'skipped';
      candidate.reason = reason;
    }
  });
  const replacement = block(
    hero,
    dayOf(world.tick),
    hour,
    hour + duration,
    action.actionId,
    action.label,
    source,
    { targetId: action.targetId, reason },
  );
  replacement.status = 'active';
  hero.dailyPlan.push(replacement);
  hero.dailyPlan.sort((left, right) => left.startHour - right.startHour);
  hero.lastReplanTick = world.tick;
  return replacement;
};

export const shouldPermitReplan = (hero: Hero, world: WorldState, crisis: boolean): boolean =>
  crisis || world.tick - hero.lastReplanTick >= 3 || deterministicUnit(`${hero.id}:${world.tick}:replan`) > 0.92;
