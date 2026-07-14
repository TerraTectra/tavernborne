import { commitmentNegotiationStateOf } from './commitment-negotiation';
import type { WorldState } from './model';

const safeRequestText = (text: string): string => text.replace(
  /я не успеваю выполнить обещание в прежний срок:/iu,
  'я не успеваю закончить дело в прежний срок:',
);

export const sanitizeCommitmentNegotiationDialogue = (world: WorldState): void => {
  const negotiations = commitmentNegotiationStateOf(world).entries;
  negotiations
    .filter((entry) => entry.status === 'resolved' && entry.socialSceneId)
    .forEach((entry) => {
      const sanitized = safeRequestText(entry.requesterLine);
      if (sanitized === entry.requesterLine) return;
      entry.requesterLine = sanitized;
      const scene = world.socialScenes.find((candidate) => candidate.id === entry.socialSceneId);
      const requestLine = scene?.lines.find((line) => line.speakerId === entry.requesterId);
      if (requestLine) requestLine.text = sanitized;
    });
};
