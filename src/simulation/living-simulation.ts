import { cloneWorld } from './internal';
import { advanceLifeScenes, lifeDirectiveForHero, prepareLifeScenes } from './life-scenes';
import type { WorldState } from './model';
import {
  advanceLivingSimulation as advanceExpeditionVisualSimulation,
  visualDirectiveForHero as expeditionVisualDirectiveForHero,
} from './visual-scenes';

export const advanceLivingSimulation = (state: WorldState, steps = 1): WorldState => {
  let world = state;
  for (let step = 0; step < steps; step += 1) {
    const prepared = cloneWorld(world, world.tick);
    prepareLifeScenes(prepared, prepared.tick + 1);
    world = advanceExpeditionVisualSimulation(prepared, 1);
    advanceLifeScenes(world);
  }
  return world;
};

export const visualDirectiveForHero = (world: WorldState, heroId: string) =>
  expeditionVisualDirectiveForHero(world, heroId) ?? lifeDirectiveForHero(world, heroId);
