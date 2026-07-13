import { cloneWorld } from './internal';
import { advanceLifeScenes, lifeDirectiveForHero, prepareLifeScenes } from './life-scenes';
import type { ActionId, WorldState } from './model';
import { advancePhysicalBodies, type BodyActionMap } from './physical-body';
import { choreographDirective } from './social-choreography';
import {
  advanceLivingSimulation as advanceExpeditionVisualSimulation,
  visualDirectiveForHero as expeditionVisualDirectiveForHero,
} from './visual-scenes';

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
    world = advanceExpeditionVisualSimulation(prepared, 1);
    advancePhysicalBodies(world, 1, previousActions);
    advanceLifeScenes(world);
  }
  return world;
};

export const visualDirectiveForHero = (world: WorldState, heroId: string) => {
  const base = expeditionVisualDirectiveForHero(world, heroId) ?? lifeDirectiveForHero(world, heroId);
  return choreographDirective(world, heroId, base);
};
