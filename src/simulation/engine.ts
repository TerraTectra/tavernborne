import type { ActionScore, ActivityState, Hero, PlanBlock, WorldState } from './model';
import { actionLabels, evaluateActions } from './decisions';
import { activeExpeditionForHero, advanceExpeditions } from './dungeon';
import { changeRelationship, clamp, cloneWorld, decayMap, pushJournal } from './internal';
import {
  crisisAction,
  defaultDurations,
  ensureDailyPlans,
  hourOf,
  insertReplan,
  planBlockAt,
  scoreFromPlan,
  shouldPermitReplan,
} from './schedule';

const evolveHero = (hero: Hero): void => {
  const sleeping = hero.currentActivity?.actionId === 'sleep';
  const away = hero.currentActivity?.actionId === 'dungeon';
  hero.needs.hunger = clamp(hero.needs.hunger + (sleeping ? 2 : away ? 5 : 3.8));
  hero.needs.fatigue = clamp(hero.needs.fatigue + (sleeping ? -9 : away ? 4 : 2.2));
  hero.needs.social = clamp(hero.needs.social + (away ? 0.3 : 1.2));
  hero.needs.solitude = clamp(hero.needs.solitude + (hero.traits.friendliness < 45 ? 1.2 : 0.45));
  hero.needs.recognition = clamp(hero.needs.recognition + hero.traits.approvalSeeking * 0.012);
  hero.needs.growth = clamp(hero.needs.growth + hero.traits.ambition * 0.01);
  hero.needs.belonging = clamp(hero.needs.belonging + 0.45);

  decayMap(hero.emotions, {
    sadness: 0.35, anxiety: 0.5, anger: 0.9, irritation: 0.75, guilt: 0.25,
    shame: 0.4, fear: 0.45, joy: 0.55, hope: 0.18, interest: 0.5,
    loneliness: 0.15, inspiration: 0.45, affection: 0.1, envy: 0.3,
  });

  hero.psyche.stress = clamp(hero.psyche.stress - hero.psyche.resilience * 0.017);
  hero.psyche.grief = clamp(hero.psyche.grief - hero.psyche.resilience * 0.006);
  hero.psyche.burnout = clamp(
    hero.psyche.burnout + Math.max(0, hero.needs.fatigue - 72) * 0.025 - 0.25,
  );

  hero.memories = hero.memories
    .map((memory) => ({
      ...memory,
      importance: clamp(memory.importance - (memory.importance > 80 ? 0.015 : 0.08)),
    }))
    .filter((memory) => memory.importance >= 4);
};

const actionFromActivity = (activity: ActivityState): ActionScore => ({
  actionId: activity.actionId,
  label: activity.label,
  targetId: activity.targetId,
  score: 100,
  reasons: [{ label: activity.source === 'crisis' ? 'неотложная потребность' : 'выполняет план', value: 70 }],
});

const applyActivityHour = (hero: Hero, world: WorldState): void => {
  const activity = hero.currentActivity;
  if (!activity || activity.actionId === 'dungeon') return;
  switch (activity.actionId) {
    case 'eat':
      hero.needs.hunger = clamp(hero.needs.hunger - 42);
      hero.emotions.joy = clamp(hero.emotions.joy + 2);
      break;
    case 'sleep':
      hero.needs.fatigue = clamp(hero.needs.fatigue - 8);
      hero.psyche.stress = clamp(hero.psyche.stress - 2.5);
      break;
    case 'train':
      hero.needs.fatigue = clamp(hero.needs.fatigue + 5);
      hero.needs.growth = clamp(hero.needs.growth - 5);
      hero.stats.strength = clamp(hero.stats.strength + 0.22);
      hero.stats.endurance = clamp(hero.stats.endurance + 0.16);
      hero.stats.dexterity = clamp(hero.stats.dexterity + 0.1);
      break;
    case 'read':
      hero.needs.fatigue = clamp(hero.needs.fatigue + 1.2);
      hero.needs.growth = clamp(hero.needs.growth - 4);
      hero.emotions.interest = clamp(hero.emotions.interest + 2.5);
      hero.stats.magic = clamp(hero.stats.magic + 0.18);
      hero.stats.perception = clamp(hero.stats.perception + 0.12);
      break;
    case 'talk':
      hero.needs.social = clamp(hero.needs.social - 13);
      hero.emotions.loneliness = clamp(hero.emotions.loneliness - 7);
      if (activity.targetId) {
        changeRelationship(hero, activity.targetId, 'closeness', 0.9);
        const target = world.heroes[activity.targetId];
        if (target) changeRelationship(target, hero.id, 'closeness', 0.6);
      }
      break;
    case 'help':
      hero.needs.fatigue = clamp(hero.needs.fatigue + 2.5);
      hero.needs.recognition = clamp(hero.needs.recognition - 3);
      if (activity.targetId) {
        const target = world.heroes[activity.targetId];
        if (target) {
          changeRelationship(target, hero.id, 'trust', 1.2);
          changeRelationship(target, hero.id, 'liking', 0.8);
        }
      }
      break;
    case 'apologize':
      hero.emotions.guilt = clamp(hero.emotions.guilt - 8);
      if (activity.targetId) {
        changeRelationship(hero, activity.targetId, 'resentment', -2.5);
        const target = world.heroes[activity.targetId];
        if (target) changeRelationship(target, hero.id, 'resentment', -1.8);
      }
      break;
    case 'seekSolitude':
      hero.needs.solitude = clamp(hero.needs.solitude - 12);
      hero.psyche.stress = clamp(hero.psyche.stress - 4);
      hero.emotions.irritation = clamp(hero.emotions.irritation - 4);
      break;
    case 'work':
      hero.needs.fatigue = clamp(hero.needs.fatigue + 3.5);
      hero.needs.recognition = clamp(hero.needs.recognition - 3);
      hero.needs.growth = clamp(hero.needs.growth - 1.5);
      break;
    case 'recover':
      hero.condition.health = clamp(hero.condition.health + 5);
      hero.condition.injury = clamp(hero.condition.injury - 6);
      hero.needs.fatigue = clamp(hero.needs.fatigue - 5);
      hero.psyche.stress = clamp(hero.psyche.stress - 3);
      break;
    case 'dungeon':
      break;
  }
};

const planForActivity = (hero: Hero): PlanBlock | undefined =>
  hero.currentActivity?.planBlockId
    ? hero.dailyPlan.find((block) => block.id === hero.currentActivity?.planBlockId)
    : undefined;

const finishActivity = (hero: Hero, world: WorldState): void => {
  const activity = hero.currentActivity;
  if (!activity) return;
  const planned = planForActivity(hero);
  if (planned) planned.status = 'done';
  pushJournal(
    world,
    `${hero.name} завершил: ${activity.label.toLowerCase()}.`,
    [hero.id, ...(activity.targetId ? [activity.targetId] : [])],
    'decision',
  );
  hero.currentActivity = undefined;
  hero.currentAction = undefined;
};

const interruptActivity = (hero: Hero, world: WorldState, reason: string): void => {
  if (!hero.currentActivity) return;
  const planned = planForActivity(hero);
  if (planned) {
    planned.status = 'interrupted';
    planned.reason = reason;
  }
  pushJournal(world, `${hero.name} прервал занятие: ${reason}.`, [hero.id], 'decision');
  hero.currentActivity = undefined;
  hero.currentAction = undefined;
};

const startActivity = (hero: Hero, world: WorldState, plan: PlanBlock, score: ActionScore): void => {
  const remainingInBlock = Math.max(1, plan.endHour - hourOf(world.tick));
  const duration = Math.max(1, Math.min(remainingInBlock, defaultDurations[plan.actionId]));
  plan.status = 'active';
  hero.currentActivity = {
    actionId: plan.actionId,
    label: plan.label,
    startedAt: world.tick,
    durationHours: duration,
    remainingHours: duration,
    source: plan.source,
    targetId: score.targetId ?? plan.targetId,
    planBlockId: plan.id,
    expeditionId: plan.expeditionId,
  };
  hero.currentAction = { ...score, targetId: score.targetId ?? plan.targetId };
  pushJournal(
    world,
    `${hero.name} начал: ${plan.label.toLowerCase()}${hero.currentActivity.targetId ? ` вместе с ${world.heroes[hero.currentActivity.targetId]?.name ?? 'товарищем'}` : ''}.`,
    [hero.id, ...(hero.currentActivity.targetId ? [hero.currentActivity.targetId] : [])],
    'decision',
  );
};

const syncDungeonActivity = (hero: Hero, world: WorldState): boolean => {
  const expedition = activeExpeditionForHero(world, hero.id);
  if (!expedition) return false;
  const plan = hero.dailyPlan.find((block) => block.expeditionId === expedition.id);
  if (plan) plan.status = 'active';
  hero.currentActivity = {
    actionId: 'dungeon',
    label: `Поход на ${expedition.floor}-й этаж`,
    startedAt: expedition.departTick,
    durationHours: expedition.plannedReturnTick - expedition.departTick,
    remainingHours: Math.max(1, expedition.plannedReturnTick - world.tick),
    source: 'group',
    planBlockId: plan?.id,
    expeditionId: expedition.id,
  };
  hero.currentAction = actionFromActivity(hero.currentActivity);
  return true;
};

const progressHero = (hero: Hero, world: WorldState): void => {
  if (syncDungeonActivity(hero, world)) return;

  const crisisId = crisisAction(hero);
  const hasCrisis = Boolean(crisisId);
  if (
    crisisId
    && hero.currentActivity
    && hero.currentActivity.actionId !== crisisId
    && shouldPermitReplan(hero, world, true)
  ) {
    interruptActivity(hero, world, `состояние требует действия «${actionLabels[crisisId]}»`);
  }

  if (hero.currentActivity) {
    applyActivityHour(hero, world);
    hero.currentActivity.remainingHours -= 1;
    hero.currentAction = actionFromActivity(hero.currentActivity);
    if (hero.currentActivity.remainingHours <= 0) finishActivity(hero, world);
  }

  if (hero.currentActivity) return;

  if (crisisId && shouldPermitReplan(hero, world, true)) {
    const crisisScore: ActionScore = {
      actionId: crisisId,
      label: actionLabels[crisisId],
      score: 150,
      reasons: [{ label: 'критическое состояние', value: 100 }],
    };
    const replacement = insertReplan(hero, world, crisisScore, 'crisis', 'неотложная потребность');
    startActivity(hero, world, replacement, crisisScore);
    return;
  }

  const planned = planBlockAt(hero, world.tick);
  if (planned) {
    const targetAway = planned.targetId && activeExpeditionForHero(world, planned.targetId);
    if (!targetAway) {
      startActivity(hero, world, planned, scoreFromPlan(hero, planned));
      return;
    }
    planned.status = 'skipped';
    planned.reason = 'нужный человек находится в подземелье';
  }

  if (!shouldPermitReplan(hero, world, hasCrisis)) return;
  const fallback = evaluateActions(hero, world)[0];
  const replacement = insertReplan(hero, world, fallback, 'replan', 'плановый блок стал недоступен');
  startActivity(hero, world, replacement, fallback);
};

export const advanceSimulation = (state: WorldState, steps = 1): WorldState => {
  let world = state;
  for (let step = 0; step < steps; step += 1) {
    world = cloneWorld(world, world.tick + 1);
    ensureDailyPlans(world);
    Object.values(world.heroes).forEach(evolveHero);
    advanceExpeditions(world);
    Object.values(world.heroes).forEach((hero) => progressHero(hero, world));
  }
  return world;
};

export { evaluateActions } from './decisions';
export { applyEvent } from './events';
export { ensureDailyPlans } from './schedule';
