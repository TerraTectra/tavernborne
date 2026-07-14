import { commitmentNegotiationStateOf, type CommitmentNegotiationState } from './commitment-negotiation';
import {
  conversationConsequenceStateOf,
  type ConversationConsequenceState,
} from './conversation-consequences';
import type { WorldState } from './model';

type CommitmentExtendedWorld = WorldState & {
  conversationConsequences?: ConversationConsequenceState;
  commitmentNegotiations?: CommitmentNegotiationState;
};

export const detachCommitmentState = (world: WorldState): void => {
  const extended = world as CommitmentExtendedWorld;
  const consequences = conversationConsequenceStateOf(world);
  extended.conversationConsequences = {
    entries: consequences.entries.map((entry) => ({
      ...entry,
      audienceIds: [...entry.audienceIds],
    })),
    nextId: consequences.nextId,
    processedSceneIds: [...consequences.processedSceneIds],
    processedJournalIds: [...consequences.processedJournalIds],
  };

  const negotiations = commitmentNegotiationStateOf(world);
  extended.commitmentNegotiations = {
    entries: negotiations.entries.map((entry) => ({ ...entry })),
    nextId: negotiations.nextId,
    processedRequestKeys: [...negotiations.processedRequestKeys],
  };
};
