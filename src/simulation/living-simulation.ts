import { prepareCommitmentReasoning } from './commitment-reasoning';
import { advanceConversationConsequences } from './conversation-consequences';
import { continueConversation } from './conversation-continuity';
import { performDialogue } from './dialogue-performance';
import { performEmotion } from './emotional-performance';
import { cloneWorld } from './internal';
import { advanceLifeScenes, lifeDirectiveForHero, prepareLifeScenes } from './life-scenes';
import type { ActionId, JournalEntry, WorldState } from './model';
import { advancePhysicalBodies, type BodyActionMap } from './physical-body';
import { refineChoreographyDirective } from './refine-social-choreography';
import { performRelationship } from './relationship-performance';
import { choreographDirective } from './social-choreography';
import {
  advanceLivingSimulation as advanceExpeditionVisualSimulation,
  visualDirectiveForHero as expeditionVisualDirectiveForHero,
} from './visual-scenes';

const advanceDueConversationConsequences = (world: WorldState): void => {
  const future: JournalEntry[] = [];
  const current: JournalEntry[] = [];
  world.journal.forEach((entry) => (entry.tick > world.tick ? future : current).push(entry));
  if (!future.length) {
    advanceConversationConsequences(world);
    return;
  }
  world.journal = current;
  advanceConversationConsequences(world);
  world.journal = [...future, ...world.journal];
};

export const advanceLivingSimulation = (state: WorldState, steps = 1): WorldState => {
  let world = state;
  for (let step = 0; step < steps; step += 1) {
    const prepared = cloneWorld(world, world.tick);
    const previousActions: BodyActionMap = Object.fromEntries(
      Object.values(prepared.heroes).map((hero) => [
        hero.id,
        hero.currentActivity?.actionId as ActionId | undefined,
      ]),
    );
    prepareLifeScenes(prepared, prepared.tick + 1);
    advanceDueConversationConsequences(prepared);
    prepareCommitmentReasoning(prepared);
    world = advanceExpeditionVisualSimulation(prepared, 1);
    advancePhysicalBodies(world, 1, previousActions);
    advanceLifeScenes(world);
    advanceDueConversationConsequences(world);
  }
  return world;
};

export const visualDirectiveForHero = (world: WorldState, heroId: string) => {
  const base = expeditionVisualDirectiveForHero(world, heroId) ?? lifeDirectiveForHero(world, heroId);
  const choreographed = choreographDirective(world, heroId, base);
  const refined = refineChoreographyDirective(world, heroId, choreographed);
  const emotional = performEmotion(world, heroId, refined);
  const relational = performRelationship(world, heroId, emotional);
  const dialogued = performDialogue(world, heroId, relational);
  return continueConversation(world, heroId, dialogued);
};
