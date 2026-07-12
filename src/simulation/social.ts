import type {
  ActionScore,
  Hero,
  PlanBlock,
  SocialActionId,
  SocialLine,
  SocialResponse,
  SocialScene,
  WorldState,
} from './model';
import { changeRelationship, clamp, pushJournal, worldRoll } from './internal';
import { hourOf } from './schedule';

const socialActions = new Set<SocialActionId>(['talk', 'help', 'apologize']);

export const isSocialAction = (actionId: string): actionId is SocialActionId =>
  socialActions.has(actionId as SocialActionId);

const line = (
  sceneId: string,
  tick: number,
  speakerId: string,
  text: string,
  tone: SocialLine['tone'],
  index: number,
): SocialLine => ({ id: `${sceneId}-line-${index}`, tick, speakerId, text, tone });

const proposalText = (actionId: SocialActionId, initiator: Hero, target: Hero): string => {
  if (actionId === 'help') return `${target.name}, давай помогу тебе с делом.`;
  if (actionId === 'apologize') return `${target.name}, нам нужно поговорить. Я хочу всё исправить.`;
  return `${target.name}, найдётся время поговорить у очага?`;
};

const acceptanceScore = (
  world: WorldState,
  initiator: Hero,
  target: Hero,
  actionId: SocialActionId,
): { score: number; busy: boolean; reason: string } => {
  const relation = target.relationships[initiator.id]?.values;
  const busyActivity = target.currentActivity;
  const protectedActivity = busyActivity
    && (busyActivity.actionId === 'dungeon'
      || busyActivity.source === 'crisis'
      || busyActivity.source === 'routine'
      || busyActivity.source === 'group');
  const busy = Boolean(protectedActivity);
  const relationScore = (relation?.liking ?? 0) * 0.28
    + (relation?.trust ?? 0) * 0.3
    + (relation?.closeness ?? 0) * 0.24
    - (relation?.resentment ?? 0) * 0.42
    - (relation?.fear ?? 0) * 0.18;
  const temperament = target.traits.friendliness * 0.24
    + target.traits.patience * 0.15
    + target.traits.empathy * (actionId === 'help' ? 0.2 : 0.08)
    - target.traits.independence * 0.08;
  const state = target.needs.social * 0.24
    - target.needs.solitude * 0.28
    - target.needs.fatigue * 0.2
    - target.psyche.stress * 0.16
    - target.emotions.irritation * 0.18;
  const apology = actionId === 'apologize'
    ? initiator.traits.honesty * 0.16 + initiator.traits.empathy * 0.12 - initiator.traits.pride * 0.08
    : 0;
  const noise = (worldRoll(world, `social:${world.tick}:${initiator.id}:${target.id}:${actionId}`) - 0.5) * 18;
  const score = relationScore + temperament + state + apology + noise - (busy ? 90 : busyActivity ? 18 : 0);
  const reason = busy
    ? 'сейчас нельзя бросить обязательное дело'
    : target.needs.fatigue > 75
      ? 'слишком устал'
      : target.needs.solitude > 65
        ? 'сейчас хочется побыть одному'
        : relationScore < -15
          ? 'между ними накопилось напряжение'
          : relationScore > 18
            ? 'доверяет инициатору'
            : 'взвешивает предложение и собственный план';
  return { score, busy, reason };
};

const chooseResponse = (score: number, busy: boolean): SocialResponse => {
  if (busy) return 'deferred';
  if (score >= 30) return 'accepted';
  if (score >= 8) return 'deferred';
  return 'refused';
};

const responseText = (response: SocialResponse, actionId: SocialActionId, target: Hero): string => {
  if (response === 'accepted') {
    if (actionId === 'apologize') return 'Хорошо. Я выслушаю, но говори честно.';
    if (actionId === 'help') return 'Хорошо. Вместе справимся быстрее.';
    return 'Давай. У меня как раз есть время.';
  }
  if (response === 'deferred') return 'Не сейчас. Вернёмся к этому, когда закончу дело.';
  return target.traits.honesty > 65 ? 'Нет. Сейчас я не хочу этого.' : 'Извини, у меня другие планы.';
};

const markCurrentPlanInterrupted = (hero: Hero, reason: string): void => {
  const activity = hero.currentActivity;
  if (!activity?.planBlockId) return;
  const plan = hero.dailyPlan.find((candidate) => candidate.id === activity.planBlockId);
  if (plan && plan.status === 'active') {
    plan.status = 'interrupted';
    plan.reason = reason;
  }
};

const activityForScene = (
  scene: SocialScene,
  hero: Hero,
  planBlockId: string | undefined,
  source: PlanBlock['source'],
) => ({
  actionId: scene.actionId,
  label: scene.actionId === 'talk' ? 'Совместный разговор' : scene.actionId === 'help' ? 'Совместная помощь' : 'Разговор о примирении',
  startedAt: scene.createdAt,
  durationHours: scene.remainingHours,
  remainingHours: scene.remainingHours,
  source,
  targetId: hero.id === scene.initiatorId ? scene.targetId : scene.initiatorId,
  planBlockId,
  socialSceneId: scene.id,
});

const addDeferredBlock = (hero: Hero, targetId: string, actionId: SocialActionId, world: WorldState): void => {
  const hour = hourOf(world.tick);
  if (hour >= 20) return;
  const startHour = Math.min(21, hour + 2);
  const exists = hero.dailyPlan.some((candidate) =>
    candidate.actionId === actionId && candidate.targetId === targetId && candidate.startHour === startHour);
  if (exists) return;
  hero.dailyPlan.push({
    id: `${hero.id}-${hero.planDay}-${startHour}-${actionId}-deferred`,
    day: hero.planDay,
    startHour,
    endHour: Math.min(22, startHour + 1),
    actionId,
    label: actionId === 'apologize' ? 'Вернуться к попытке примирения' : 'Вернуться к отложенному разговору',
    source: 'replan',
    status: 'planned',
    targetId,
    reason: 'собеседник попросил перенести разговор',
  });
  hero.dailyPlan.sort((left, right) => left.startHour - right.startHour);
};

const rememberSocialResult = (
  hero: Hero,
  other: Hero,
  scene: SocialScene,
  summary: string,
  valence: number,
  importance: number,
): void => {
  hero.memories.unshift({
    id: `${scene.id}-${hero.id}-memory`,
    summary,
    createdAt: scene.createdAt,
    importance,
    valence,
    participants: [other.id],
    tags: ['social', scene.actionId, scene.response],
    sourceEventType: 'social',
  });
  hero.memories = hero.memories.slice(0, 80);
};

export type SocialStartResult = 'not-social' | 'started' | 'declined';

export const tryStartSocialScene = (
  initiator: Hero,
  world: WorldState,
  plan: PlanBlock,
  score: ActionScore,
): SocialStartResult => {
  if (!isSocialAction(plan.actionId) || !score.targetId) return 'not-social';
  if (world.tick - initiator.lastSocialTick < 2) {
    plan.status = 'skipped';
    plan.reason = 'недавно уже пытался начать социальную сцену';
    return 'declined';
  }

  const target = world.heroes[score.targetId];
  if (!target || target.id === initiator.id) {
    plan.status = 'skipped';
    plan.reason = 'подходящий собеседник недоступен';
    return 'declined';
  }

  const sceneId = `social-${world.nextSocialSceneId}`;
  world.nextSocialSceneId += 1;
  const evaluation = acceptanceScore(world, initiator, target, plan.actionId);
  const response = chooseResponse(evaluation.score, evaluation.busy);
  const scene: SocialScene = {
    id: sceneId,
    actionId: plan.actionId,
    initiatorId: initiator.id,
    targetId: target.id,
    createdAt: world.tick,
    status: response === 'accepted' ? 'active' : 'resolved',
    response,
    remainingHours: plan.actionId === 'help' ? 2 : 1,
    planBlockIds: [plan.id],
    lines: [
      line(sceneId, world.tick, initiator.id, proposalText(plan.actionId, initiator, target), plan.actionId === 'apologize' ? 'apologetic' : 'warm', 0),
      line(sceneId, world.tick, target.id, responseText(response, plan.actionId, target), response === 'accepted' ? 'warm' : response === 'deferred' ? 'neutral' : 'tense', 1),
    ],
    reason: evaluation.reason,
  };

  initiator.lastSocialTick = world.tick;
  target.lastSocialTick = world.tick;
  plan.socialSceneId = scene.id;

  if (response === 'accepted') {
    plan.status = 'active';
    if (target.currentActivity && !target.currentActivity.socialSceneId) {
      markCurrentPlanInterrupted(target, `согласился на предложение ${initiator.name}`);
    }
    target.currentActivity = undefined;
    target.currentAction = undefined;

    const targetPlan = target.dailyPlan.find((candidate) =>
      candidate.day === target.planDay
      && candidate.startHour <= hourOf(world.tick)
      && candidate.endHour > hourOf(world.tick)
      && candidate.actionId === plan.actionId);
    if (targetPlan) {
      targetPlan.status = 'active';
      targetPlan.socialSceneId = scene.id;
      scene.planBlockIds.push(targetPlan.id);
    }

    initiator.currentActivity = activityForScene(scene, initiator, plan.id, plan.source);
    initiator.currentAction = { ...score, targetId: target.id };
    target.currentActivity = activityForScene(scene, target, targetPlan?.id, targetPlan?.source ?? 'group');
    target.currentAction = {
      actionId: plan.actionId,
      label: initiator.currentActivity.label,
      score: 100,
      targetId: initiator.id,
      reasons: [{ label: `принял предложение ${initiator.name}`, value: 75 }],
    };
    pushJournal(
      world,
      `${initiator.name} предложил ${target.name}: «${scene.lines[0].text}» ${target.name} согласился.`,
      [initiator.id, target.id],
      'social',
    );
  } else {
    plan.status = response === 'deferred' ? 'interrupted' : 'skipped';
    plan.reason = response === 'deferred' ? `перенесено: ${evaluation.reason}` : `отказ: ${evaluation.reason}`;
    scene.outcome = response === 'deferred' ? 'Разговор перенесён.' : 'Предложение отвергнуто.';
    if (response === 'deferred') {
      addDeferredBlock(initiator, target.id, plan.actionId, world);
      initiator.emotions.anxiety = clamp(initiator.emotions.anxiety + 2);
    } else {
      initiator.emotions.sadness = clamp(initiator.emotions.sadness + 5);
      initiator.emotions.irritation = clamp(initiator.emotions.irritation + 3);
      changeRelationship(initiator, target.id, 'resentment', initiator.traits.pride > 65 ? 2.5 : 0.8);
      rememberSocialResult(
        initiator,
        target,
        scene,
        `${target.name} отказался от предложения: ${scene.lines[0].text}`,
        -28,
        28 + initiator.traits.pride * 0.2,
      );
    }
    pushJournal(
      world,
      `${initiator.name} обратился к ${target.name}, но получил ${response === 'deferred' ? 'просьбу перенести разговор' : 'отказ'}: ${evaluation.reason}.`,
      [initiator.id, target.id],
      'social',
    );
  }

  world.socialScenes.unshift(scene);
  world.socialScenes = world.socialScenes.slice(0, 40);
  return response === 'accepted' ? 'started' : 'declined';
};

const clearSceneActivity = (hero: Hero, sceneId: string): void => {
  if (hero.currentActivity?.socialSceneId !== sceneId) return;
  hero.currentActivity = undefined;
  hero.currentAction = undefined;
};

const resolveAcceptedScene = (world: WorldState, scene: SocialScene, initiator: Hero, target: Hero): void => {
  scene.status = 'resolved';
  if (scene.actionId === 'talk') {
    scene.outcome = 'Они обменялись мыслями и стали немного ближе.';
    rememberSocialResult(initiator, target, scene, `Спокойный разговор с ${target.name}.`, 24, 30);
    rememberSocialResult(target, initiator, scene, `Спокойный разговор с ${initiator.name}.`, 24, 28);
  } else if (scene.actionId === 'help') {
    scene.outcome = `${initiator.name} помог ${target.name} закончить дело.`;
    rememberSocialResult(target, initiator, scene, `${initiator.name} добровольно помог мне.`, 38, 42);
  } else {
    const remainingResentment = target.relationships[initiator.id]?.values.resentment ?? 0;
    scene.outcome = remainingResentment > 35
      ? `${target.name} выслушал извинение, но обида ещё сильна.`
      : `${target.name} принял искреннюю попытку примирения.`;
    rememberSocialResult(initiator, target, scene, `Попытался примириться с ${target.name}.`, 18, 40);
    rememberSocialResult(target, initiator, scene, `${initiator.name} извинился передо мной.`, remainingResentment > 35 ? 5 : 28, 42);
  }

  scene.planBlockIds.forEach((id) => {
    Object.values(world.heroes).forEach((hero) => {
      const block = hero.dailyPlan.find((candidate) => candidate.id === id);
      if (block) block.status = 'done';
    });
  });
  clearSceneActivity(initiator, scene.id);
  clearSceneActivity(target, scene.id);
  pushJournal(world, scene.outcome, [initiator.id, target.id], 'social');
};

export const advanceSocialScenes = (world: WorldState): void => {
  world.socialScenes.forEach((scene) => {
    if (scene.status !== 'active') return;
    const initiator = world.heroes[scene.initiatorId];
    const target = world.heroes[scene.targetId];
    if (!initiator || !target) {
      scene.status = 'resolved';
      scene.outcome = 'Сцена прервалась: один из участников недоступен.';
      return;
    }

    if (scene.actionId === 'talk') {
      initiator.needs.social = clamp(initiator.needs.social - 10);
      target.needs.social = clamp(target.needs.social - 10);
      initiator.emotions.loneliness = clamp(initiator.emotions.loneliness - 6);
      target.emotions.loneliness = clamp(target.emotions.loneliness - 6);
      changeRelationship(initiator, target.id, 'closeness', 1.2);
      changeRelationship(target, initiator.id, 'closeness', 1.2);
      changeRelationship(initiator, target.id, 'liking', 0.6);
      changeRelationship(target, initiator.id, 'liking', 0.6);
    } else if (scene.actionId === 'help') {
      initiator.needs.fatigue = clamp(initiator.needs.fatigue + 3);
      target.needs.fatigue = clamp(target.needs.fatigue - 2);
      changeRelationship(target, initiator.id, 'trust', 2);
      changeRelationship(target, initiator.id, 'debt', 1.2);
      changeRelationship(target, initiator.id, 'liking', 1);
    } else {
      initiator.emotions.guilt = clamp(initiator.emotions.guilt - 10);
      changeRelationship(target, initiator.id, 'resentment', -5);
      changeRelationship(initiator, target.id, 'resentment', -3);
      changeRelationship(target, initiator.id, 'trust', initiator.traits.honesty > 60 ? 1.2 : 0.3);
    }

    scene.remainingHours -= 1;
    if (scene.remainingHours <= 0) resolveAcceptedScene(world, scene, initiator, target);
  });
};

export const activeSocialSceneForHero = (world: WorldState, heroId: string): SocialScene | undefined =>
  world.socialScenes.find((scene) =>
    scene.status === 'active' && (scene.initiatorId === heroId || scene.targetId === heroId));
