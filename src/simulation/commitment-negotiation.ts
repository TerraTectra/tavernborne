import { conversationConsequenceStateOf, type ConversationConsequence } from './conversation-consequences';
import { activeExpeditionForHero } from './dungeon';
import { changeRelationship, clamp, deterministicUnit, pushJournal } from './internal';
import type { Hero, PlanBlock, SocialScene, WorldState } from './model';
import { dayOf, defaultDurations, hourOf } from './schedule';

export type CommitmentNegotiationOutcome = 'accepted' | 'countered' | 'refused';
export type CommitmentNegotiationStatus = 'pending' | 'resolved' | 'cancelled';

export interface CommitmentNegotiation {
  id: string;
  promiseId: string;
  requesterId: string;
  responderId: string;
  createdAt: number;
  resolveAt: number;
  originalDueTick: number;
  requestedDueTick: number;
  reason: string;
  status: CommitmentNegotiationStatus;
  outcome?: CommitmentNegotiationOutcome;
  responseScore?: number;
  finalDueTick?: number;
  requesterLine: string;
  responderLine?: string;
  socialSceneId?: string;
}

export interface CommitmentNegotiationState {
  entries: CommitmentNegotiation[];
  nextId: number;
  processedRequestKeys: string[];
}

type NegotiatedPromise = ConversationConsequence & {
  commitmentDecision?: 'monitor' | 'honor' | 'reschedule-request' | 'deliberate-break';
  commitmentReason?: string;
  lastReasoningTick?: number;
  rescheduleCount?: number;
  originalDueTick?: number;
  negotiationStatus?: 'pending' | CommitmentNegotiationOutcome;
  negotiationId?: string;
  requestedDueTick?: number;
  lastNegotiationTick?: number;
  lastNegotiatedDueTick?: number;
};

type NegotiationWorld = WorldState & {
  commitmentNegotiations?: CommitmentNegotiationState;
};

const emptyState = (): CommitmentNegotiationState => ({
  entries: [],
  nextId: 1,
  processedRequestKeys: [],
});

const cloneState = (state: CommitmentNegotiationState): CommitmentNegotiationState => ({
  entries: state.entries.map((entry) => ({ ...entry })),
  nextId: state.nextId,
  processedRequestKeys: [...state.processedRequestKeys],
});

const mutableState = (world: WorldState): CommitmentNegotiationState => {
  const extended = world as NegotiationWorld;
  const state = cloneState(extended.commitmentNegotiations ?? emptyState());
  extended.commitmentNegotiations = state;
  return state;
};

export const commitmentNegotiationStateOf = (world: WorldState): CommitmentNegotiationState =>
  (world as NegotiationWorld).commitmentNegotiations ?? emptyState();

export const commitmentNegotiationsForHero = (
  world: WorldState,
  heroId: string,
): CommitmentNegotiation[] => commitmentNegotiationStateOf(world).entries
  .filter((entry) => entry.requesterId === heroId || entry.responderId === heroId);

const relationshipValue = (
  hero: Hero,
  targetId: string,
  key: 'liking' | 'trust' | 'respect' | 'closeness' | 'resentment',
): number => hero.relationships[targetId]?.values[key] ?? 0;

const formatMoment = (tick: number): string => {
  const day = dayOf(tick) + 1;
  const hour = hourOf(tick).toString().padStart(2, '0');
  return `${day}-й день, ${hour}:00`;
};

const unavailableUntil = (world: WorldState, heroId: string): number => {
  const expedition = activeExpeditionForHero(world, heroId);
  if (expedition) return expedition.plannedReturnTick + 1;
  const activity = world.heroes[heroId]?.currentActivity;
  if (activity?.actionId === 'sleep') return world.tick + Math.max(1, activity.remainingHours);
  return world.tick + 1;
};

const negotiationResolveTick = (world: WorldState, requesterId: string, responderId: string): number =>
  Math.max(unavailableUntil(world, requesterId), unavailableUntil(world, responderId));

const requestPlanFor = (
  hero: Hero,
  promise: NegotiatedPromise,
): PlanBlock | undefined => {
  const count = promise.rescheduleCount ?? 0;
  return hero.dailyPlan.find((block) => block.id === `${promise.id}-reschedule-request-${count}`)
    ?? hero.dailyPlan.find((block) =>
      block.actionId === 'talk'
      && block.targetId === promise.targetId
      && block.label === 'Попросить перенести срок обещания'
      && block.status === 'planned');
};

const promisePlanFor = (hero: Hero, promise: NegotiatedPromise): PlanBlock | undefined =>
  promise.planBlockId ? hero.dailyPlan.find((block) => block.id === promise.planBlockId) : undefined;

const positionPlan = (plan: PlanBlock, tick: number, duration: number): void => {
  let day = dayOf(tick);
  let startHour = hourOf(tick);
  if (startHour >= 23) {
    day += 1;
    startHour = 8;
  }
  plan.day = day;
  plan.startHour = startHour;
  plan.endHour = Math.min(24, startHour + Math.max(1, duration));
};

const holdPromisePlan = (world: WorldState, promise: NegotiatedPromise): void => {
  const hero = world.heroes[promise.speakerId];
  if (!hero) return;
  const plan = promisePlanFor(hero, promise);
  if (!plan || plan.status === 'done') return;
  plan.status = 'skipped';
  plan.reason = 'срок обсуждается с адресатом обещания';
};

const scheduleNegotiationPlan = (
  world: WorldState,
  promise: NegotiatedPromise,
  resolveAt: number,
): void => {
  const requester = world.heroes[promise.speakerId];
  if (!requester) return;
  const plan = requestPlanFor(requester, promise);
  if (!plan) return;
  positionPlan(plan, resolveAt, 1);
  plan.status = 'planned';
  plan.source = 'replan';
  plan.reason = `обсудить перенос обещания: «${promise.statement}»`;
};

const schedulePromisePlan = (
  world: WorldState,
  promise: NegotiatedPromise,
  dueTick: number,
  reason: string,
): void => {
  const requester = world.heroes[promise.speakerId];
  if (!requester || !promise.actionHint || promise.actionHint === 'dungeon') return;
  let plan = promisePlanFor(requester, promise);
  if (!plan) {
    const id = `${promise.id}-negotiated-plan`;
    plan = {
      id,
      day: dayOf(world.tick),
      startHour: hourOf(world.tick),
      endHour: Math.min(24, hourOf(world.tick) + defaultDurations[promise.actionHint]),
      actionId: promise.actionHint,
      label: `Выполнить обещание: ${promise.statement}`,
      source: 'personal',
      status: 'planned',
      targetId: promise.targetId,
      reason,
    };
    requester.dailyPlan.push(plan);
    promise.planBlockId = id;
  }
  const duration = defaultDurations[plan.actionId];
  const startTick = Math.max(world.tick, dueTick - duration);
  positionPlan(plan, startTick, duration);
  plan.status = 'planned';
  plan.reason = reason;
  requester.dailyPlan.sort((left, right) => left.day - right.day || left.startHour - right.startHour);
};

const scoreResponse = (
  world: WorldState,
  negotiation: CommitmentNegotiation,
  promise: NegotiatedPromise,
  requester: Hero,
  responder: Hero,
): number => {
  const goodwill = responder.traits.empathy * 0.18
    + responder.traits.patience * 0.18
    + responder.traits.kindness * 0.12
    + responder.traits.loyalty * 0.08
    + relationshipValue(responder, requester.id, 'trust') * 0.22
    + relationshipValue(responder, requester.id, 'respect') * 0.1
    + relationshipValue(responder, requester.id, 'closeness') * 0.08
    + relationshipValue(responder, requester.id, 'liking') * 0.06
    + requester.traits.honesty * 0.06
    + requester.traits.discipline * 0.05;
  const delay = Math.max(0, negotiation.requestedDueTick - negotiation.originalDueTick);
  const resistance = Math.max(0, relationshipValue(responder, requester.id, 'resentment')) * 0.28
    + responder.emotions.anger * 0.12
    + responder.emotions.irritation * 0.1
    + responder.psyche.stress * 0.08
    + delay * 0.75
    + promise.strength * 0.08
    + Math.max(0, (promise.rescheduleCount ?? 1) - 1) * 5;
  const jitter = (deterministicUnit(`${world.seed}:${negotiation.id}:response`) - 0.5) * 10;
  return clamp(28 + goodwill - resistance + jitter, -60, 140);
};

const outcomeForScore = (score: number): CommitmentNegotiationOutcome => {
  if (score >= 66) return 'accepted';
  if (score >= 38) return 'countered';
  return 'refused';
};

const counterDueTick = (world: WorldState, negotiation: CommitmentNegotiation): number => {
  const span = Math.max(2, negotiation.requestedDueTick - negotiation.originalDueTick);
  const candidate = negotiation.originalDueTick + Math.max(2, Math.ceil(span * 0.55));
  const latestCounter = Math.max(world.tick + 2, negotiation.requestedDueTick - 1);
  return Math.min(latestCounter, Math.max(world.tick + 2, candidate));
};

const responseText = (
  world: WorldState,
  outcome: CommitmentNegotiationOutcome,
  negotiation: CommitmentNegotiation,
  finalDueTick: number,
): string => {
  if (outcome === 'accepted') {
    return `Хорошо. Я согласен перенести срок до ${formatMoment(finalDueTick)}. Но в следующий раз скажи раньше.`;
  }
  if (outcome === 'countered') {
    return `До ${formatMoment(negotiation.requestedDueTick)} слишком поздно. Договоримся на ${formatMoment(finalDueTick)}.`;
  }
  return 'Нет. Для меня этот срок важен, и я не согласен его менять.';
};

const negotiationSocialScene = (
  world: WorldState,
  negotiation: CommitmentNegotiation,
  outcome: CommitmentNegotiationOutcome,
  responderLine: string,
): SocialScene => {
  const sceneId = `commitment-negotiation-scene-${negotiation.id}`;
  const requesterPlan = world.heroes[negotiation.requesterId]?.dailyPlan.find((plan) =>
    plan.actionId === 'talk'
    && plan.targetId === negotiation.responderId
    && plan.reason?.includes('обсудить перенос'));
  return {
    id: sceneId,
    actionId: 'talk',
    initiatorId: negotiation.requesterId,
    targetId: negotiation.responderId,
    createdAt: world.tick,
    status: 'resolved',
    response: outcome === 'accepted' ? 'accepted' : outcome === 'countered' ? 'deferred' : 'refused',
    remainingHours: 0,
    planBlockIds: requesterPlan ? [requesterPlan.id] : [],
    lines: [
      {
        id: `${sceneId}-request`,
        tick: world.tick,
        speakerId: negotiation.requesterId,
        text: negotiation.requesterLine,
        tone: 'apologetic',
      },
      {
        id: `${sceneId}-response`,
        tick: world.tick,
        speakerId: negotiation.responderId,
        text: responderLine,
        tone: outcome === 'accepted' ? 'warm' : outcome === 'countered' ? 'neutral' : 'tense',
      },
    ],
    reason: negotiation.reason,
    outcome: outcome === 'accepted'
      ? 'Адресат согласился перенести срок обещания.'
      : outcome === 'countered'
        ? 'Стороны согласовали встречный срок.'
        : 'Адресат отказался переносить срок обещания.',
  };
};

const rememberNegotiation = (
  world: WorldState,
  negotiation: CommitmentNegotiation,
  outcome: CommitmentNegotiationOutcome,
  finalDueTick: number,
): void => {
  const requester = world.heroes[negotiation.requesterId];
  const responder = world.heroes[negotiation.responderId];
  const summary = outcome === 'accepted'
    ? `${responder?.name ?? negotiation.responderId} согласился перенести срок до ${formatMoment(finalDueTick)}.`
    : outcome === 'countered'
      ? `${responder?.name ?? negotiation.responderId} предложил встречный срок: ${formatMoment(finalDueTick)}.`
      : `${responder?.name ?? negotiation.responderId} отказался переносить срок обещания.`;
  const valence = outcome === 'accepted' ? 28 : outcome === 'countered' ? 12 : -34;
  [requester, responder].forEach((hero) => {
    if (!hero || hero.memories.some((memory) => memory.id === `${negotiation.id}-${hero.id}-memory`)) return;
    hero.memories.unshift({
      id: `${negotiation.id}-${hero.id}-memory`,
      summary,
      createdAt: world.tick,
      importance: 48,
      valence,
      participants: [hero.id === negotiation.requesterId ? negotiation.responderId : negotiation.requesterId],
      tags: ['commitment-negotiation', outcome],
      sourceEventType: 'social',
    });
    hero.memories = hero.memories.slice(0, 80);
  });
};

const applyRelationshipOutcome = (
  requester: Hero,
  responder: Hero,
  outcome: CommitmentNegotiationOutcome,
): void => {
  if (outcome === 'accepted') {
    changeRelationship(responder, requester.id, 'trust', 0.9);
    changeRelationship(responder, requester.id, 'closeness', 0.4);
    changeRelationship(requester, responder.id, 'respect', 0.5);
    requester.emotions.guilt = clamp(requester.emotions.guilt - 2);
    requester.emotions.hope = clamp(requester.emotions.hope + 2);
    return;
  }
  if (outcome === 'countered') {
    changeRelationship(responder, requester.id, 'trust', 0.35);
    changeRelationship(responder, requester.id, 'respect', 0.7);
    changeRelationship(requester, responder.id, 'respect', 0.8);
    requester.emotions.hope = clamp(requester.emotions.hope + 1);
    return;
  }
  changeRelationship(requester, responder.id, 'resentment', 0.5);
  changeRelationship(responder, requester.id, 'respect', 0.15);
  requester.emotions.sadness = clamp(requester.emotions.sadness + 2.5);
  requester.psyche.stress = clamp(requester.psyche.stress + 2);
};

const resolveNegotiation = (
  world: WorldState,
  negotiation: CommitmentNegotiation,
  promise: NegotiatedPromise,
): void => {
  const requester = world.heroes[negotiation.requesterId];
  const responder = world.heroes[negotiation.responderId];
  if (!requester || !responder) {
    negotiation.status = 'cancelled';
    promise.status = 'active';
    promise.negotiationStatus = 'refused';
    promise.lastNegotiationTick = world.tick;
    promise.dueTick = negotiation.originalDueTick;
    return;
  }

  const score = scoreResponse(world, negotiation, promise, requester, responder);
  const outcome = outcomeForScore(score);
  const finalDueTick = outcome === 'accepted'
    ? negotiation.requestedDueTick
    : outcome === 'countered'
      ? counterDueTick(world, negotiation)
      : negotiation.originalDueTick;
  const responderLine = responseText(world, outcome, negotiation, finalDueTick);

  negotiation.status = 'resolved';
  negotiation.outcome = outcome;
  negotiation.responseScore = score;
  negotiation.finalDueTick = finalDueTick;
  negotiation.responderLine = responderLine;

  promise.status = 'active';
  promise.negotiationStatus = outcome;
  promise.negotiationId = negotiation.id;
  promise.requestedDueTick = negotiation.requestedDueTick;
  promise.lastNegotiationTick = world.tick;
  promise.lastNegotiatedDueTick = finalDueTick;
  promise.dueTick = finalDueTick;

  schedulePromisePlan(
    world,
    promise,
    finalDueTick,
    outcome === 'accepted'
      ? 'новый срок согласован с адресатом'
      : outcome === 'countered'
        ? 'встречный срок согласован с адресатом'
        : 'адресат отказался переносить срок',
  );

  const requestPlan = requestPlanFor(requester, promise);
  if (requestPlan) {
    requestPlan.status = 'done';
    requestPlan.reason = `переговоры завершены: ${outcome}`;
  }

  applyRelationshipOutcome(requester, responder, outcome);
  rememberNegotiation(world, negotiation, outcome, finalDueTick);

  const scene = negotiationSocialScene(world, negotiation, outcome, responderLine);
  negotiation.socialSceneId = scene.id;
  world.socialScenes.unshift(scene);
  world.socialScenes = world.socialScenes.slice(0, 80);

  const requesterName = requester.name;
  const responderName = responder.name;
  if (outcome === 'accepted') {
    pushJournal(
      world,
      `${responderName} согласился перенести срок обещания ${requesterName} до ${formatMoment(finalDueTick)}.`,
      [requester.id, responder.id],
      'social',
    );
  } else if (outcome === 'countered') {
    pushJournal(
      world,
      `${responderName} предложил ${requesterName} встречный срок обещания: ${formatMoment(finalDueTick)}.`,
      [requester.id, responder.id],
      'social',
    );
  } else {
    pushJournal(
      world,
      `${responderName} отказался переносить срок обещания ${requesterName}.`,
      [requester.id, responder.id],
      'social',
    );
  }
};

export const captureCommitmentNegotiationRequests = (world: WorldState): void => {
  const state = mutableState(world);
  const consequences = conversationConsequenceStateOf(world).entries as NegotiatedPromise[];

  consequences
    .filter((promise) =>
      promise.kind === 'promise'
      && promise.status === 'active'
      && promise.commitmentDecision === 'reschedule-request'
      && promise.lastReasoningTick === world.tick
      && promise.targetId)
    .forEach((promise) => {
      const requestKey = `${world.tick}:${promise.id}:${promise.rescheduleCount ?? 0}`;
      if (state.processedRequestKeys.includes(requestKey)) return;
      if (state.entries.some((entry) => entry.promiseId === promise.id && entry.status === 'pending')) return;

      const requestedDueTick = Number(promise.dueTick ?? world.tick + 8);
      const originalDueTick = Number(
        promise.lastNegotiatedDueTick
        ?? promise.originalDueTick
        ?? Math.max(world.tick + 1, requestedDueTick - 8),
      );
      const requester = world.heroes[promise.speakerId];
      const responder = promise.targetId ? world.heroes[promise.targetId] : undefined;
      if (!requester || !responder) return;

      const id = `commitment-negotiation-${state.nextId}`;
      state.nextId += 1;
      const resolveAt = negotiationResolveTick(world, requester.id, responder.id);
      const reason = promise.commitmentReason ?? 'текущий срок стал невыполнимым';
      const requesterLine = `${responder.name}, я не успеваю выполнить обещание в прежний срок: ${reason}. Прошу перенести его до ${formatMoment(requestedDueTick)}.`;
      const negotiation: CommitmentNegotiation = {
        id,
        promiseId: promise.id,
        requesterId: requester.id,
        responderId: responder.id,
        createdAt: world.tick,
        resolveAt,
        originalDueTick,
        requestedDueTick,
        reason,
        status: 'pending',
        requesterLine,
      };

      promise.status = 'contested';
      promise.negotiationStatus = 'pending';
      promise.negotiationId = id;
      promise.requestedDueTick = requestedDueTick;
      promise.lastNegotiationTick = world.tick;
      promise.dueTick = originalDueTick;

      holdPromisePlan(world, promise);
      scheduleNegotiationPlan(world, promise, resolveAt);
      state.entries.unshift(negotiation);
      state.processedRequestKeys.push(requestKey);
      pushJournal(
        world,
        `${requester.name} попросил ${responder.name} перенести срок обещания до ${formatMoment(requestedDueTick)}. Ответ ещё не получен.`,
        [requester.id, responder.id],
        'social',
      );
    });

  state.entries = state.entries.slice(0, 120);
  state.processedRequestKeys = state.processedRequestKeys.slice(-240);
};

export const advanceCommitmentNegotiations = (world: WorldState): void => {
  const state = mutableState(world);
  const promises = conversationConsequenceStateOf(world).entries as NegotiatedPromise[];

  state.entries
    .filter((entry) => entry.status === 'pending' && entry.resolveAt <= world.tick)
    .forEach((negotiation) => {
      const promise = promises.find((entry) => entry.id === negotiation.promiseId);
      if (!promise || promise.status === 'fulfilled' || promise.status === 'broken') {
        negotiation.status = 'cancelled';
        return;
      }
      const requester = world.heroes[negotiation.requesterId];
      const responder = world.heroes[negotiation.responderId];
      if (!requester || !responder) {
        resolveNegotiation(world, negotiation, promise);
        return;
      }
      const requesterAvailableAt = unavailableUntil(world, requester.id);
      const responderAvailableAt = unavailableUntil(world, responder.id);
      if (requesterAvailableAt > world.tick + 1 || responderAvailableAt > world.tick + 1) {
        negotiation.resolveAt = Math.max(requesterAvailableAt, responderAvailableAt);
        scheduleNegotiationPlan(world, promise, negotiation.resolveAt);
        return;
      }
      resolveNegotiation(world, negotiation, promise);
    });

  state.entries = state.entries.slice(0, 120);
  state.processedRequestKeys = state.processedRequestKeys.slice(-240);
};
