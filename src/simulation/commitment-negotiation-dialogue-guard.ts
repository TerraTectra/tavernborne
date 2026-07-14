import { commitmentNegotiationStateOf } from './commitment-negotiation';
import type { WorldState } from './model';

const safeNegotiationText = (text: string): string => text
  .replace(
    /я не успеваю выполнить обещание в прежний срок:/giu,
    'я не успеваю закончить дело в прежний срок:',
  )
  .replace(/срок обещания/giu, 'срок дела');

export const sanitizeCommitmentNegotiationDialogue = (world: WorldState): void => {
  const negotiations = commitmentNegotiationStateOf(world).entries;
  negotiations
    .filter((entry) => entry.status === 'resolved' && entry.socialSceneId)
    .forEach((entry) => {
      entry.requesterLine = safeNegotiationText(entry.requesterLine);
      const scene = world.socialScenes.find((candidate) => candidate.id === entry.socialSceneId);
      if (!scene) return;
      scene.lines.forEach((line) => {
        line.text = safeNegotiationText(line.text);
      });
      if (scene.outcome) scene.outcome = safeNegotiationText(scene.outcome);
      if (scene.reason) scene.reason = safeNegotiationText(scene.reason);
    });
};
