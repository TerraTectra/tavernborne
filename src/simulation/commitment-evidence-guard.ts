import { conversationConsequenceStateOf, type ConversationConsequence } from './conversation-consequences';
import type { ActionId, JournalEntry, WorldState } from './model';

type EvidenceGuardedPromise = ConversationConsequence & {
  negotiationStatus?: 'pending' | 'accepted' | 'countered' | 'refused';
  evidenceGuardTick?: number;
};

const normalized = (value: string): string => value.toLocaleLowerCase('ru-RU');
const includesAny = (value: string, patterns: RegExp[]): boolean => patterns.some((pattern) => pattern.test(value));

const journalMatchesAction = (entry: JournalEntry, action: ActionId): boolean => {
  const text = normalized(entry.text);
  if (action === 'help') return includesAny(text, [/помо(?:г|ч)/u, /совместн.*помощ/u]);
  if (action === 'talk') return includesAny(text, [/разговор/u, /поговор/u, /обменялись мыслями/u]);
  if (action === 'apologize') return includesAny(text, [/примир/u, /извин/u]);
  if (action === 'work') return includesAny(text, [/завершил.*работ/u, /закончил.*дел/u, /общ.*дел/u]);
  if (action === 'recover') return includesAny(text, [/восстанов/u, /отдых/u, /оказали помощь/u]);
  if (action === 'dungeon') return includesAny(text, [/поход/u, /экспедиц/u, /подземель/u]);
  return false;
};

const imminentEvidence = (
  world: WorldState,
  promise: EvidenceGuardedPromise,
): JournalEntry | undefined => world.journal.find((entry) => {
  if (!promise.actionHint || entry.tick <= world.tick || entry.tick > world.tick + 1) return false;
  const involvesSpeaker = entry.heroIds.includes(promise.speakerId);
  const involvesTarget = !promise.targetId || entry.heroIds.includes(promise.targetId);
  return involvesSpeaker && involvesTarget && journalMatchesAction(entry, promise.actionHint);
});

export const suspendPromisesWithImminentEvidence = (world: WorldState): void => {
  const promises = conversationConsequenceStateOf(world).entries as EvidenceGuardedPromise[];
  promises
    .filter((promise) =>
      promise.kind === 'promise'
      && promise.status === 'active'
      && promise.negotiationStatus !== 'pending'
      && Boolean(imminentEvidence(world, promise)))
    .forEach((promise) => {
      promise.status = 'contested';
      promise.evidenceGuardTick = world.tick;
    });
};

export const restorePromisesWithImminentEvidence = (world: WorldState): void => {
  const promises = conversationConsequenceStateOf(world).entries as EvidenceGuardedPromise[];
  promises
    .filter((promise) =>
      promise.kind === 'promise'
      && promise.status === 'contested'
      && promise.evidenceGuardTick === world.tick
      && promise.negotiationStatus !== 'pending')
    .forEach((promise) => {
      promise.status = 'active';
      promise.evidenceGuardTick = undefined;
    });
};
