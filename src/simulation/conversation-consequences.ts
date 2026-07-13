import { changeRelationship, clamp, pushJournal } from './internal';
import type { LifeDialogueLine, LifeScene } from './life-scenes';
import type { ActionId, Hero, JournalEntry, PlanBlock, WorldState } from './model';

export type ConversationConsequenceKind =
  | 'promise'
  | 'agreement'
  | 'boundary'
  | 'grievance'
  | 'concern'
  | 'apology'
  | 'decision';

export type ConversationConsequenceStatus =
  | 'active'
  | 'fulfilled'
  | 'broken'
  | 'resolved'
  | 'contested';

export interface ConversationConsequence {
  id: string;
  sourceSceneId: string;
  sourceLineId: string;
  speakerId: string;
  audienceIds: string[];
  targetId?: string;
  createdAt: number;
  kind: ConversationConsequenceKind;
  status: ConversationConsequenceStatus;
  statement: string;
  topic: string;
  strength: number;
  actionHint?: ActionId;
  dueTick?: number;
  planBlockId?: string;
  resolvedAt?: number;
  resolution?: string;
}

export interface ConversationConsequenceState {
  entries: ConversationConsequence[];
  nextId: number;
  processedSceneIds: string[];
  processedJournalIds: string[];
}

type ConsequenceWorld = WorldState & {
  conversationConsequences?: ConversationConsequenceState;
  lifeScenes?: { scenes?: LifeScene[] };
};

const topicLabels: Record<string, string> = {
  meal: 'общая трапеза',
  conversation: 'личный разговор',
  help: 'совместная помощь',
  apology: 'примирение',
  conflict: 'причина конфликта',
  treatment: 'восстановление',
  debrief: 'итоги похода',
  expeditionCouncil: 'план похода',
};

const actionLabels: Partial<Record<ActionId, string>> = {
  talk: 'вернуться к разговору',
  help: 'оказать обещанную помощь',
  apologize: 'исправить сказанное и извиниться',
  work: 'выполнить обещанное дело',
  recover: 'отдохнуть и восстановиться',
  dungeon: 'выполнить договорённость о походе',
};

const emptyState = (): ConversationConsequenceState => ({
  entries: [],
  nextId: 1,
  processedSceneIds: [],
  processedJournalIds: [],
});

const cloneState = (state: ConversationConsequenceState): ConversationConsequenceState => ({
  entries: state.entries.map((entry) => ({ ...entry, audienceIds: [...entry.audienceIds] })),
  nextId: state.nextId,
  processedSceneIds: [...state.processedSceneIds],
  processedJournalIds: [...state.processedJournalIds],
});

const mutableState = (world: WorldState): ConversationConsequenceState => {
  const extended = world as ConsequenceWorld;
  const state = cloneState(extended.conversationConsequences ?? emptyState());
  extended.conversationConsequences = state;
  return state;
};

export const conversationConsequenceStateOf = (world: WorldState): ConversationConsequenceState =>
  (world as ConsequenceWorld).conversationConsequences ?? emptyState();

export const conversationConsequencesForHero = (world: WorldState, heroId: string): ConversationConsequence[] =>
  conversationConsequenceStateOf(world).entries.filter((entry) =>
    entry.speakerId === heroId || entry.audienceIds.includes(heroId));

export const conversationConsequenceKindLabel = (kind: ConversationConsequenceKind): string => ({
  promise: 'обещание',
  agreement: 'договорённость',
  boundary: 'граница',
  grievance: 'претензия',
  concern: 'опасение',
  apology: 'признание вины',
  decision: 'решение',
}[kind]);

export const conversationConsequenceStatusLabel = (status: ConversationConsequenceStatus): string => ({
  active: 'ожидает выполнения',
  fulfilled: 'выполнено',
  broken: 'нарушено',
  resolved: 'зафиксировано',
  contested: 'остаётся спорным',
}[status]);

const compact = (value: string): string => value.replace(/\s+/gu, ' ').trim();
const lower = (value: string): string => compact(value).toLocaleLowerCase('ru-RU');
const includesAny = (value: string, patterns: RegExp[]): boolean => patterns.some((pattern) => pattern.test(value));

const actionHintFor = (text: string): ActionId | undefined => {
  const value = lower(text);
  if (includesAny(value, [/помог/u, /поддерж/u, /сделаем вместе/u, /держи с этой стороны/u])) return 'help';
  if (includesAny(value, [/извин/u, /исправл/u, /винов/u])) return 'apologize';
  if (includesAny(value, [/поговор/u, /обсуд/u, /верн[её]мся к этому/u, /скажу/u])) return 'talk';
  if (includesAny(value, [/отдохн/u, /восстанов/u, /не геройств/u])) return 'recover';
  if (includesAny(value, [/поход/u, /маршрут/u, /северн.*ворот/u, /пойд[её]м/u, /мост/u])) return 'dungeon';
  if (includesAny(value, [/почин/u, /законч/u, /проверим припасы/u, /распределим рол/u, /сделаю/u, /выполню/u])) return 'work';
  return undefined;
};

const consequenceKindFor = (line: LifeDialogueLine): ConversationConsequenceKind | undefined => {
  const value = lower(line.text);
  const promise = includesAny(value, [
    /обещ/u,
    /\bя (?:буду|помогу|сделаю|вернусь|останусь|проверю|исправлю|отдохну)\b/u,
    /\bмы (?:будем|пойд[её]м|проверим|распределим|начн[её]м)\b/u,
  ]);
  if (promise) return 'promise';
  if (line.tone === 'apologetic' || includesAny(value, [/извин/u, /я ошиб/u, /моя вина/u, /винов/u])) return 'apology';
  if (includesAny(value, [/не хочу/u, /не буду/u, /не могу/u, /не соглас/u, /не уступ/u])) return 'boundary';
  if (line.tone === 'hurt' || line.tone === 'angry') return 'grievance';
  if (includesAny(value, [/боюсь/u, /опас/u, /риск/u, /потер/u, /ранен/u])) return 'concern';
  if (includesAny(value, [/хорошо/u, /договорил/u, /соглас/u, /решили/u])) return 'agreement';
  if (line.phase === 'resolution' || line.tone === 'firm') return 'decision';
  return undefined;
};

const strengthFor = (scene: LifeScene, line: LifeDialogueLine, kind: ConversationConsequenceKind): number => {
  let strength = line.phase === 'resolution' ? 62 : line.phase === 'exchange' ? 52 : 44;
  if (line.tone === 'angry' || line.tone === 'hurt') strength += 16;
  if (line.tone === 'firm' || line.tone === 'apologetic') strength += 10;
  if (scene.type === 'conflict' || scene.type === 'debrief') strength += 8;
  if (kind === 'promise') strength += 12;
  return clamp(strength, 20, 100);
};

const targetFor = (scene: LifeScene, speakerId: string, audienceIds: string[]): string | undefined => {
  if (scene.initiatorId === speakerId) return scene.targetId ?? audienceIds[0];
  if (scene.targetId === speakerId) return scene.initiatorId ?? audienceIds[0];
  return audienceIds[0];
};

const dueHoursFor = (action: ActionId | undefined): number => {
  if (action === 'talk' || action === 'apologize') return 8;
  if (action === 'dungeon') return 30;
  return 12;
};

const remember = (
  hero: Hero | undefined,
  id: string,
  summary: string,
  createdAt: number,
  importance: number,
  valence: number,
  participants: string[],
  tags: string[],
): void => {
  if (!hero || hero.memories.some((memory) => memory.id === id)) return;
  hero.memories.unshift({
    id,
    summary,
    createdAt,
    importance,
    valence,
    participants,
    tags,
    sourceEventType: 'social',
  });
  hero.memories = hero.memories.slice(0, 80);
};

const schedulePromise = (world: WorldState, entry: ConversationConsequence): void => {
  if (!entry.actionHint || entry.actionHint === 'dungeon') return;
  const hero = world.heroes[entry.speakerId];
  if (!hero) return;
  const targetTick = Math.max(world.tick + 1, Math.min(entry.dueTick ?? world.tick + 12, world.tick + 4));
  let day = Math.floor(targetTick / 24);
  let startHour = ((targetTick % 24) + 24) % 24;
  if (startHour >= 22) {
    day += 1;
    startHour = 8;
  }
  const id = `${entry.id}-plan`;
  if (hero.dailyPlan.some((block) => block.id === id)) {
    entry.planBlockId = id;
    return;
  }
  const block: PlanBlock = {
    id,
    day,
    startHour,
    endHour: Math.min(23, startHour + (entry.actionHint === 'help' ? 2 : 1)),
    actionId: entry.actionHint,
    label: `Выполнить обещание: ${actionLabels[entry.actionHint] ?? entry.statement}`,
    source: 'personal',
    status: 'planned',
    targetId: entry.targetId,
    reason: `данное обещание: «${entry.statement}»`,
  };
  hero.dailyPlan.push(block);
  hero.dailyPlan.sort((left, right) => left.day - right.day || left.startHour - right.startHour);
  entry.planBlockId = id;
};

const applyImmediateEffect = (world: WorldState, entry: ConversationConsequence): void => {
  const speaker = world.heroes[entry.speakerId];
  entry.audienceIds.forEach((audienceId) => {
    const audience = world.heroes[audienceId];
    if (!speaker || !audience) return;
    if (entry.kind === 'promise') {
      changeRelationship(audience, speaker.id, 'trust', 0.5);
      speaker.emotions.guilt = clamp(speaker.emotions.guilt + 0.5);
    } else if (entry.kind === 'agreement') {
      changeRelationship(audience, speaker.id, 'trust', 0.6);
      changeRelationship(speaker, audience.id, 'trust', 0.3);
    } else if (entry.kind === 'apology') {
      changeRelationship(audience, speaker.id, 'resentment', -0.8);
      changeRelationship(audience, speaker.id, 'trust', 0.25);
    } else if (entry.kind === 'grievance') {
      changeRelationship(speaker, audience.id, 'resentment', 0.8);
      changeRelationship(audience, speaker.id, 'trust', -0.2);
    } else if (entry.kind === 'concern') {
      changeRelationship(audience, speaker.id, 'closeness', 0.3);
    } else if (entry.kind === 'decision') {
      changeRelationship(audience, speaker.id, 'respect', 0.25);
    }
  });
};

const recordScene = (world: WorldState, state: ConversationConsequenceState, scene: LifeScene): void => {
  state.processedSceneIds.push(scene.id);
  const topic = topicLabels[scene.type] ?? scene.title;
  scene.dialogue.forEach((line) => {
    const kind = consequenceKindFor(line);
    if (!kind) return;
    const statement = compact(line.text);
    const audienceIds = scene.participantIds.filter((id) => id !== line.speakerId);
    if (!audienceIds.length) return;
    const actionHint = kind === 'promise' ? actionHintFor(statement) : undefined;
    const id = `consequence-${state.nextId}`;
    state.nextId += 1;
    const entry: ConversationConsequence = {
      id,
      sourceSceneId: scene.id,
      sourceLineId: line.id,
      speakerId: line.speakerId,
      audienceIds,
      targetId: targetFor(scene, line.speakerId, audienceIds),
      createdAt: scene.updatedAt || world.tick,
      kind,
      status: kind === 'promise' ? 'active' : kind === 'grievance' || kind === 'boundary' ? 'contested' : 'resolved',
      statement,
      topic,
      strength: strengthFor(scene, line, kind),
      actionHint,
      dueTick: kind === 'promise' ? world.tick + dueHoursFor(actionHint) : undefined,
    };
    state.entries.unshift(entry);
    applyImmediateEffect(world, entry);
    if (kind === 'promise') schedulePromise(world, entry);

    const speaker = world.heroes[entry.speakerId];
    const audienceNames = audienceIds.map((audienceId) => world.heroes[audienceId]?.name ?? audienceId).join(', ');
    const valence = kind === 'grievance' || kind === 'boundary' ? -34 : kind === 'promise' || kind === 'agreement' ? 32 : 12;
    remember(
      speaker,
      `${entry.id}-${entry.speakerId}-memory`,
      `${speaker?.name ?? entry.speakerId} сказал ${audienceNames}: «${statement}».`,
      world.tick,
      entry.strength,
      valence,
      audienceIds,
      ['conversation-consequence', kind, entry.status],
    );
    audienceIds.forEach((audienceId) => remember(
      world.heroes[audienceId],
      `${entry.id}-${audienceId}-memory`,
      `${speaker?.name ?? entry.speakerId} сказал мне: «${statement}».`,
      world.tick,
      entry.strength,
      valence,
      [entry.speakerId],
      ['conversation-consequence', kind, entry.status],
    ));

    pushJournal(
      world,
      kind === 'promise'
        ? `Обещание зафиксировано: ${speaker?.name ?? entry.speakerId} — «${statement}».`
        : `Последствие разговора: ${speaker?.name ?? entry.speakerId} выразил ${conversationConsequenceKindLabel(kind)} — «${statement}».`,
      [entry.speakerId, ...audienceIds],
      'social',
    );
  });
};

const journalMatchesAction = (entry: JournalEntry, action: ActionId): boolean => {
  const text = lower(entry.text);
  if (text.includes('обещание зафиксировано') || text.includes('выполнил обещание') || text.includes('нарушил обещание')) return false;
  if (action === 'help') return includesAny(text, [/помог/u, /совместн.*помощ/u]);
  if (action === 'talk') return includesAny(text, [/разговор/u, /поговор/u, /обменялись мыслями/u]);
  if (action === 'apologize') return includesAny(text, [/примир/u, /извин/u]);
  if (action === 'work') return includesAny(text, [/завершил.*работ/u, /закончил.*дел/u, /общ.*дел/u]);
  if (action === 'recover') return includesAny(text, [/восстанов/u, /отдых/u, /оказали помощь/u]);
  if (action === 'dungeon') return includesAny(text, [/поход/u, /экспедиц/u, /подземель/u]);
  return false;
};

const resolvePlan = (world: WorldState, entry: ConversationConsequence, status: PlanBlock['status'], reason: string): void => {
  if (!entry.planBlockId) return;
  const block = world.heroes[entry.speakerId]?.dailyPlan.find((candidate) => candidate.id === entry.planBlockId);
  if (!block) return;
  block.status = status;
  block.reason = reason;
};

const fulfillPromise = (world: WorldState, entry: ConversationConsequence, evidence: JournalEntry): void => {
  entry.status = 'fulfilled';
  entry.resolvedAt = world.tick;
  entry.resolution = evidence.text;
  resolvePlan(world, entry, 'done', 'обещание подтверждено поступком');
  const speaker = world.heroes[entry.speakerId];
  entry.audienceIds.forEach((audienceId) => {
    const audience = world.heroes[audienceId];
    if (!speaker || !audience) return;
    changeRelationship(audience, speaker.id, 'trust', 4);
    changeRelationship(audience, speaker.id, 'respect', 1);
    changeRelationship(audience, speaker.id, 'resentment', -1.5);
    changeRelationship(speaker, audience.id, 'closeness', 0.5);
    remember(
      audience,
      `${entry.id}-${audienceId}-fulfilled`,
      `${speaker.name} выполнил обещание: «${entry.statement}».`,
      world.tick,
      Math.min(100, entry.strength + 12),
      54,
      [speaker.id],
      ['conversation-consequence', 'promise', 'fulfilled'],
    );
  });
  if (speaker) {
    speaker.emotions.guilt = clamp(speaker.emotions.guilt - 4);
    speaker.emotions.joy = clamp(speaker.emotions.joy + 3);
  }
  pushJournal(world, `${speaker?.name ?? entry.speakerId} выполнил обещание: «${entry.statement}».`, [entry.speakerId, ...entry.audienceIds], 'social');
};

const apologyPlan = (world: WorldState, entry: ConversationConsequence): void => {
  const hero = world.heroes[entry.speakerId];
  if (!hero || !entry.targetId) return;
  const day = Math.floor(world.tick / 24);
  const hour = ((world.tick % 24) + 24) % 24;
  const startHour = hour >= 21 ? 8 : Math.min(21, hour + 1);
  const targetDay = hour >= 21 ? day + 1 : day;
  const id = `${entry.id}-repair-plan`;
  if (hero.dailyPlan.some((block) => block.id === id)) return;
  hero.dailyPlan.push({
    id,
    day: targetDay,
    startHour,
    endHour: startHour + 1,
    actionId: 'apologize',
    label: 'Объяснить нарушенное обещание',
    source: 'replan',
    status: 'planned',
    targetId: entry.targetId,
    reason: `нарушено обещание: «${entry.statement}»`,
  });
  hero.dailyPlan.sort((left, right) => left.day - right.day || left.startHour - right.startHour);
};

const breakPromise = (world: WorldState, entry: ConversationConsequence): void => {
  entry.status = 'broken';
  entry.resolvedAt = world.tick;
  entry.resolution = 'Срок прошёл, но подтверждающего поступка не произошло.';
  resolvePlan(world, entry, 'skipped', 'срок обещания прошёл');
  const speaker = world.heroes[entry.speakerId];
  entry.audienceIds.forEach((audienceId) => {
    const audience = world.heroes[audienceId];
    if (!speaker || !audience) return;
    changeRelationship(audience, speaker.id, 'trust', -6);
    changeRelationship(audience, speaker.id, 'resentment', 5);
    audience.emotions.sadness = clamp(audience.emotions.sadness + 4);
    audience.emotions.anger = clamp(audience.emotions.anger + 2);
    remember(
      audience,
      `${entry.id}-${audienceId}-broken`,
      `${speaker.name} нарушил обещание: «${entry.statement}».`,
      world.tick,
      Math.min(100, entry.strength + 20),
      -72,
      [speaker.id],
      ['conversation-consequence', 'promise', 'broken'],
    );
  });
  if (speaker) {
    speaker.emotions.guilt = clamp(speaker.emotions.guilt + 8);
    speaker.emotions.shame = clamp(speaker.emotions.shame + 4);
  }
  apologyPlan(world, entry);
  pushJournal(world, `${speaker?.name ?? entry.speakerId} нарушил обещание: «${entry.statement}».`, [entry.speakerId, ...entry.audienceIds], 'social');
};

export const advanceConversationConsequences = (world: WorldState): void => {
  const state = mutableState(world);

  const unprocessedJournal = [...world.journal]
    .filter((entry) => !state.processedJournalIds.includes(entry.id))
    .sort((left, right) => left.tick - right.tick);
  unprocessedJournal.forEach((journalEntry) => {
    state.processedJournalIds.push(journalEntry.id);
    state.entries
      .filter((entry) => entry.status === 'active' && entry.actionHint && journalEntry.tick >= entry.createdAt)
      .forEach((entry) => {
        const involvesSpeaker = journalEntry.heroIds.includes(entry.speakerId);
        const involvesTarget = !entry.targetId || journalEntry.heroIds.includes(entry.targetId);
        if (involvesSpeaker && involvesTarget && journalMatchesAction(journalEntry, entry.actionHint!)) {
          fulfillPromise(world, entry, journalEntry);
        }
      });
  });

  state.entries
    .filter((entry) => entry.status === 'active' && Number.isFinite(entry.dueTick) && world.tick > Number(entry.dueTick))
    .forEach((entry) => breakPromise(world, entry));

  const scenes = (world as ConsequenceWorld).lifeScenes?.scenes ?? [];
  scenes
    .filter((scene) => scene.status === 'resolved' && !state.processedSceneIds.includes(scene.id))
    .sort((left, right) => left.updatedAt - right.updatedAt)
    .forEach((scene) => recordScene(world, state, scene));

  state.entries = state.entries.slice(0, 140);
  state.processedSceneIds = state.processedSceneIds.slice(-240);
  state.processedJournalIds = state.processedJournalIds.slice(-320);
};
