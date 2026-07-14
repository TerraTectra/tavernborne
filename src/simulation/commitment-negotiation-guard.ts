import { conversationConsequenceStateOf, type ConversationConsequence } from './conversation-consequences';
import type { WorldState } from './model';

type GuardedPromise = ConversationConsequence & {
  negotiationStatus?: 'pending' | 'accepted' | 'countered' | 'refused';
  lastNegotiationTick?: number;
  negotiationReevaluateAt?: number;
};

export const releaseCommitmentNegotiationCooldowns = (world: WorldState): void => {
  const promises = conversationConsequenceStateOf(world).entries as GuardedPromise[];
  promises
    .filter((promise) =>
      promise.kind === 'promise'
      && promise.status === 'contested'
      && promise.negotiationStatus !== 'pending'
      && Number.isFinite(promise.negotiationReevaluateAt)
      && world.tick >= Number(promise.negotiationReevaluateAt))
    .forEach((promise) => {
      promise.status = 'active';
      promise.negotiationReevaluateAt = undefined;
    });
};

export const holdResolvedCommitmentNegotiations = (world: WorldState): void => {
  const promises = conversationConsequenceStateOf(world).entries as GuardedPromise[];
  promises
    .filter((promise) =>
      promise.kind === 'promise'
      && promise.status === 'active'
      && promise.negotiationStatus !== undefined
      && promise.negotiationStatus !== 'pending'
      && promise.lastNegotiationTick === world.tick)
    .forEach((promise) => {
      promise.status = 'contested';
      promise.negotiationReevaluateAt = world.tick + (promise.negotiationStatus === 'refused' ? 1 : 3);
    });
};
