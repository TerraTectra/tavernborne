import { conversationConsequenceStateOf, type ConversationConsequence } from './conversation-consequences';
import { activeExpeditionForHero } from './dungeon';
import { clamp, pushJournal } from './internal';
import type { ActionId, Hero, PlanBlock, WorldState } from './model';
import { crisisAction, dayOf, defaultDurations, hourOf } from './schedule';

export type CommitmentDecision =
  | 'monitor'
  | 'honor'
  | 'reschedule-request'
  | 'deliberate-break';

export interface CommitmentAssessment {
  id: string;
  tick: number;
  heroId: string;
  promiseId: string;
  targetId?: string;
  actionId?: ActionId;
  decision: CommitmentDecision;
  feasibility: number;
  urgency: number;
  socialCost: number;
  competingPriority: number;
  hoursRemaining: number;
  reason: string;
  proposedDueTick?: number;
}

export interface CommitmentReasoningState {
  assessments: CommitmentAssessment[];
  nextId: number;
  processedDecisionKeys: string[];
}

type ReasonedPromise = ConversationConsequence & {
  commitmentDecision?: CommitmentDecision;
  commitmentReason?: string;
  lastReasoningTick?: number;
  rescheduleCount?: number;
  originalDueTick?: number;
};

type CommitmentWorld = WorldState & {
  commitmentReasoning?: CommitmentReasoningState;
};

const emptyState = (): CommitmentReasoningState => ({
  assessments: [],
  nextId: 1,
  processedDecisionKeys: [],
});

const cloneState = (state: CommitmentReasoningState): CommitmentReasoningState => ({
  assessments: state.assessments.map((assessment) => ({ ...assessment })),
  nextId: state.nextId,
  processedDecisionKeys: [...state.processedDecisionKeys],
});

const mutableState = (world: WorldState): CommitmentReasoningState => {
  const extended = world as CommitmentWorld;
  const state = cloneState(extended.commitmentReasoning ?? emptyState());
  extended.commitmentReasoning = state;
  return state;
};

export const commitmentReasoningStateOf = (world: WorldState): CommitmentReasoningState =>
  (world as CommitmentWorld).commitmentReasoning ?? emptyState();

export const commitmentAssessmentsForHero = (
  world: WorldState,
  heroId: string,
): CommitmentAssessment[] => commitmentReasoningStateOf(world).assessments
  .filter((assessment) => assessment.heroId === heroId);

const activePromisesFor = (world: WorldState, heroId: string): ReasonedPromise[] =>
  (conversationConsequenceStateOf(world).entries as ReasonedPromise[])
    .filter((entry) => entry.kind === 'promise' && entry.status === 'active' && entry.speakerId === heroId)
    .sort((left, right) => Number(left.dueTick ?? Number.POSITIVE_INFINITY) - Number(right.dueTick ?? Number.POSITIVE_INFINITY));

const relationshipValue = (hero: Hero, targetId: string | undefined, key: 'trust' | 'respect' | 'closeness'): number =>
  targetId ? hero.relationships[targetId]?.values[key] ?? 0 : 0;

const crisisPriorityFor = (hero: Hero, actionId: ActionId | undefined): number => {
  if (actionId === 'recover') return 115 + Math.max(0, 55 - hero.condition.health) + hero.condition.injury * 0.35;
  if (actionId === 'sleep') return 105 + Math.max(0, hero.needs.fatigue - 88) * 1.8;
  if (actionId === 'eat') return 100 + Math.max(0, hero.needs.hunger - 84) * 1.7;
  return 0;
};

const socialCostFor = (hero: Hero, entry: ReasonedPromise): number => clamp(
  entry.strength * 0.42
  + hero.traits.loyalty * 0.2
  + hero.traits.honesty * 0.16
  + hero.traits.discipline * 0.12
  + relationshipValue(hero, entry.targetId, 'trust') * 0.18
  + relationshipValue(hero, entry.targetId, 'respect') * 0.08
  + relationshipValue(hero, entry.targetId, 'closeness') * 0.12,
  0,
  160,
);

const hoursRemainingFor = (world: WorldState, entry: ReasonedPromise): number =>
  Number.isFinite(entry.dueTick) ? Number(entry.dueTick) - world.tick : 24;

const targetUnavailable = (world: WorldState, entry: ReasonedPromise): boolean =>
  Boolean(entry.targetId && (!world.heroes[entry.targetId] || activeExpeditionForHero(world, entry.targetId)));

const feasibilityFor = (hero: Hero, world: WorldState, entry: ReasonedPromise): number => {
  if (!entry.actionHint) return 10;
  let value = 92;
  if (targetUnavailable(world, entry)) value -= 72;
  value -= Math.max(0, hero.condition.injury - 20) * 0.55;
  value -= Math.max(0, 58 - hero.condition.health) * 0.75;
  value -= Math.max(0, hero.needs.fatigue - 70) * 0.5;
  value -= Math.max(0, hero.needs.hunger - 75) * 0.35;
  const duration = defaultDurations[entry.actionHint];
  const hoursRemaining = hoursRemainingFor(world, entry);
  if (hoursRemaining < duration) value -= (duration - hoursRemaining) * 28;
  if (entry.actionHint === 'dungeon') {
    const expedition = world.expeditions.find((candidate) =>
      candidate.partyIds.includes(hero.id) && candidate.status !== 'completed' && candidate.status !== 'retreated');
    if (!expedition) value -= 45;
  }
  return clamp(value, 0, 100);
};

const urgencyFor = (entry: ReasonedPromise, hoursRemaining: number): number => clamp(
  105 - Math.max(-2, hoursRemaining) * 10 + entry.strength * 0.22,
  0,
  140,
);

const planForPromise = (hero: Hero, entry: ReasonedPromise): PlanBlock | undefined =>
  entry.planBlockId ? hero.dailyPlan.find((block) => block.id === entry.planBlockId) : undefined;

const planScheduledNow = (hero: Hero, world: WorldState, entry: ReasonedPromise): boolean => {
  const plan = planForPromise(hero, entry);
  if (!plan) return false;
  const day = dayOf(world.tick);
  const hour = hourOf(world.tick);
  return plan.day === day && plan.startHour <= hour && plan.endHour > hour && plan.status === 'planned';
};

const decisionFor = (
  hero: Hero,
  world: WorldState,
  entry: ReasonedPromise,
  crisisId: ActionId | undefined,
): Omit<CommitmentAssessment, 'id' | 'tick' | 'heroId' | 'promiseId' | 'targetId' | 'actionId'> => {
  const feasibility = feasibilityFor(hero, world, entry);
  const hoursRemaining = hoursRemainingFor(world, entry);
  const urgency = urgencyFor(entry, hoursRemaining);
  const socialCost = socialCostFor(hero, entry);
  const competingPriority = crisisPriorityFor(hero, crisisId);
  const rescheduleCount = entry.rescheduleCount ?? 0;

  if (!entry.actionHint) {
    return {
      decision: 'monitor', feasibility, urgency, socialCost, competingPriority, hoursRemaining,
      reason: 'обещание пока не связано с исполнимым действием',
    };
  }

  if (crisisId && competingPriority >= socialCost + 18) {
    if (hoursRemaining > 1 && rescheduleCount < 2) {
      return {
        decision: 'reschedule-request', feasibility, urgency, socialCost, competingPriority, hoursRemaining,
        reason: `неотложное действие «${crisisId}» важнее текущего срока`,
        proposedDueTick: Math.max(Number(entry.dueTick ?? world.tick) + 8, world.tick + 8),
      };
    }
    return {
      decision: 'deliberate-break', feasibility, urgency, socialCost, competingPriority, hoursRemaining,
      reason: `безопасность требует «${crisisId}», а перенести срок уже нельзя`,
    };
  }

  if (targetUnavailable(world, entry)) {
    if (rescheduleCount < 2) {
      return {
        decision: 'reschedule-request', feasibility, urgency, socialCost, competingPriority, hoursRemaining,
        reason: 'адресат обещания сейчас недоступен',
        proposedDueTick: Math.max(Number(entry.dueTick ?? world.tick) + 8, world.tick + 8),
      };
    }
    return {
      decision: 'deliberate-break', feasibility, urgency, socialCost, competingPriority, hoursRemaining,
      reason: 'адресат недоступен, а допустимые переносы исчерпаны',
    };
  }

  if (feasibility >= 48 && (urgency >= 58 || planScheduledNow(hero, world, entry))) {
    return {
      decision: 'honor', feasibility, urgency, socialCost, competingPriority, hoursRemaining,
      reason: 'обещание выполнимо и наступило время действовать',
    };
  }

  if (feasibility < 38 && hoursRemaining > 1 && rescheduleCount < 2) {
    return {
      decision: 'reschedule-request', feasibility, urgency, socialCost, competingPriority, hoursRemaining,
      reason: 'текущего времени или состояния недостаточно для надёжного выполнения',
      proposedDueTick: Math.max(Number(entry.dueTick ?? world.tick) + 8, world.tick + 8),
    };
  }

  if (hoursRemaining <= 0 && feasibility < 48) {
    return {
      decision: 'deliberate-break', feasibility, urgency, socialCost, competingPriority, hoursRemaining,
      reason: 'срок истёк, а выполнить обещание безопасно невозможно',
    };
  }

  return {
    decision: 'monitor', feasibility, urgency, socialCost, competingPriority, hoursRemaining,
    reason: 'обещание учтено, но вмешиваться в план пока не требуется',
  };
};

const ensurePromisePlan = (hero: Hero, world: WorldState, entry: ReasonedPromise): PlanBlock | undefined => {
  if (!entry.actionHint || entry.actionHint === 'dungeon') return planForPromise(hero, entry);
  const currentDay = dayOf(world.tick);
  const currentHour = hourOf(world.tick);
  let plan = planForPromise(hero, entry);
  if (!plan) {
    const id = `${entry.id}-reasoned-plan`;
    plan = {
      id,
      day: currentDay,
      startHour: currentHour,
      endHour: Math.min(24, currentHour + defaultDurations[entry.actionHint]),
      actionId: entry.actionHint,
      label: `Выполнить обещание: ${entry.statement}`,
      source: 'personal',
      status: 'planned',
      targetId: entry.targetId,
      reason: `обязательство: «${entry.statement}»`,
    };
    hero.dailyPlan.push(plan);
    entry.planBlockId = id;
  }
  return plan;
};

const promotePromise = (hero: Hero, world: WorldState, entry: ReasonedPromise): void => {
  const plan = ensurePromisePlan(hero, world, entry);
  if (!plan || plan.status === 'done' || plan.status === 'active') return;
  const day = dayOf(world.tick);
  const hour = hourOf(world.tick);
  const duration = defaultDurations[plan.actionId];
  plan.day = day;
  plan.startHour = hour;
  plan.endHour = Math.min(24, hour + duration);
  plan.status = 'planned';
  plan.source = 'personal';
  plan.reason = `приоритет активного обещания: «${entry.statement}»`;

  hero.dailyPlan.forEach((candidate) => {
    if (
      candidate.id !== plan!.id
      && candidate.day === day
      && candidate.status === 'planned'
      && candidate.startHour <= hour
      && candidate.endHour > hour
    ) {
      candidate.status = 'skipped';
      candidate.reason = `уступил место обязательству: «${entry.statement}»`;
    }
  });
  hero.dailyPlan.sort((left, right) => left.day - right.day || left.startHour - right.startHour || (left.id === plan!.id ? -1 : 1));
};

const requestReschedule = (
  hero: Hero,
  world: WorldState,
  entry: ReasonedPromise,
  proposedDueTick: number,
  reason: string,
): void => {
  const count = (entry.rescheduleCount ?? 0) + 1;
  entry.originalDueTick ??= entry.dueTick;
  entry.rescheduleCount = count;
  entry.dueTick = proposedDueTick;

  const promisePlan = ensurePromisePlan(hero, world, entry);
  if (promisePlan) {
    const duration = defaultDurations[promisePlan.actionId];
    const startTick = Math.max(world.tick + 2, proposedDueTick - duration);
    promisePlan.day = dayOf(startTick);
    promisePlan.startHour = hourOf(startTick);
    promisePlan.endHour = Math.min(24, promisePlan.startHour + duration);
    promisePlan.status = 'planned';
    promisePlan.reason = `срок перенесён после оценки выполнимости: ${reason}`;
  }

  if (entry.targetId) {
    const requestTick = world.tick + (crisisAction(hero) ? 2 : 1);
    const requestId = `${entry.id}-reschedule-request-${count}`;
    if (!hero.dailyPlan.some((block) => block.id === requestId)) {
      hero.dailyPlan.push({
        id: requestId,
        day: dayOf(requestTick),
        startHour: hourOf(requestTick),
        endHour: Math.min(24, hourOf(requestTick) + 1),
        actionId: 'talk',
        label: 'Попросить перенести срок обещания',
        source: 'replan',
        status: 'planned',
        targetId: entry.targetId,
        reason: `объяснить: ${reason}`,
      });
    }
  }

  hero.dailyPlan.sort((left, right) => left.day - right.day || left.startHour - right.startHour);
};

const deliberateBreak = (hero: Hero, world: WorldState, entry: ReasonedPromise, reason: string): void => {
  entry.dueTick = world.tick - 1;
  entry.resolution = `Обязательство сознательно оставлено ради более важной цели: ${reason}`;
  const plan = planForPromise(hero, entry);
  if (plan && plan.status !== 'done') {
    plan.status = 'skipped';
    plan.reason = `осознанное нарушение: ${reason}`;
  }
};

const recordAssessment = (
  state: CommitmentReasoningState,
  world: WorldState,
  hero: Hero,
  entry: ReasonedPromise,
  assessment: Omit<CommitmentAssessment, 'id' | 'tick' | 'heroId' | 'promiseId' | 'targetId' | 'actionId'>,
): CommitmentAssessment => {
  const stored: CommitmentAssessment = {
    id: `commitment-assessment-${state.nextId}`,
    tick: world.tick,
    heroId: hero.id,
    promiseId: entry.id,
    targetId: entry.targetId,
    actionId: entry.actionHint,
    ...assessment,
  };
  state.nextId += 1;
  state.assessments.unshift(stored);
  return stored;
};

const announceDecision = (
  state: CommitmentReasoningState,
  world: WorldState,
  hero: Hero,
  entry: ReasonedPromise,
  assessment: CommitmentAssessment,
): void => {
  const key = `${world.tick}:${entry.id}:${assessment.decision}`;
  if (state.processedDecisionKeys.includes(key)) return;
  state.processedDecisionKeys.push(key);
  const targetName = entry.targetId ? world.heroes[entry.targetId]?.name ?? 'адресата' : 'семью';
  if (assessment.decision === 'honor') {
    pushJournal(world, `${hero.name} ставит обещание перед ${targetName} в приоритет: «${entry.statement}»`, [hero.id, ...(entry.targetId ? [entry.targetId] : [])], 'decision');
  } else if (assessment.decision === 'reschedule-request') {
    pushJournal(world, `${hero.name} понимает, что не успевает выполнить обещание, и планирует попросить ${targetName} перенести срок.`, [hero.id, ...(entry.targetId ? [entry.targetId] : [])], 'decision');
  } else if (assessment.decision === 'deliberate-break') {
    pushJournal(world, `${hero.name} сознательно нарушает обещание ради более важной цели: ${assessment.reason}.`, [hero.id, ...(entry.targetId ? [entry.targetId] : [])], 'decision');
  }
};

export const prepareCommitmentReasoning = (world: WorldState): void => {
  const state = mutableState(world);
  Object.values(world.heroes).forEach((hero) => {
    const promises = activePromisesFor(world, hero.id);
    if (!promises.length) return;
    const crisisId = crisisAction(hero);
    const ranked = promises
      .map((entry) => ({ entry, assessment: decisionFor(hero, world, entry, crisisId) }))
      .sort((left, right) =>
        right.assessment.urgency + right.assessment.socialCost * 0.35
        - (left.assessment.urgency + left.assessment.socialCost * 0.35));

    ranked.forEach(({ entry, assessment }, index) => {
      const stored = recordAssessment(state, world, hero, entry, assessment);
      entry.commitmentDecision = assessment.decision;
      entry.commitmentReason = assessment.reason;
      entry.lastReasoningTick = world.tick;

      if (index === 0 && assessment.decision === 'honor') {
        promotePromise(hero, world, entry);
      } else if (assessment.decision === 'reschedule-request' && assessment.proposedDueTick) {
        requestReschedule(hero, world, entry, assessment.proposedDueTick, assessment.reason);
      } else if (assessment.decision === 'deliberate-break') {
        deliberateBreak(hero, world, entry, assessment.reason);
      }
      announceDecision(state, world, hero, entry, stored);
    });
  });

  state.assessments = state.assessments.slice(0, 180);
  state.processedDecisionKeys = state.processedDecisionKeys.slice(-320);
};
