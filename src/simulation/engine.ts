import type { Hero, WorldState } from './model';
import { applyAction, evaluateActions } from './decisions';
import { clamp, cloneWorld, decayMap, pushJournal } from './internal';

const evolveHero = (hero: Hero): void => {
  hero.needs.hunger = clamp(hero.needs.hunger + 3.5);
  hero.needs.fatigue = clamp(hero.needs.fatigue + 2.5);
  hero.needs.social = clamp(hero.needs.social + 1.8);
  hero.needs.solitude = clamp(hero.needs.solitude + (hero.traits.friendliness < 45 ? 1.5 : 0.6));
  hero.needs.recognition = clamp(hero.needs.recognition + hero.traits.approvalSeeking * 0.02);
  hero.needs.growth = clamp(hero.needs.growth + hero.traits.ambition * 0.018);
  hero.needs.belonging = clamp(hero.needs.belonging + 0.8);

  decayMap(hero.emotions, {
    sadness: 0.45, anxiety: 0.65, anger: 1.2, irritation: 1, guilt: 0.35,
    shame: 0.5, fear: 0.6, joy: 0.8, hope: 0.25, interest: 0.8,
    loneliness: 0.2, inspiration: 0.7, affection: 0.15, envy: 0.4,
  });

  hero.psyche.stress = clamp(hero.psyche.stress - hero.psyche.resilience * 0.025);
  hero.psyche.grief = clamp(hero.psyche.grief - hero.psyche.resilience * 0.008);
  hero.psyche.burnout = clamp(
    hero.psyche.burnout + Math.max(0, hero.needs.fatigue - 70) * 0.03 - 0.4,
  );

  hero.memories = hero.memories
    .map((memory) => ({
      ...memory,
      importance: clamp(memory.importance - (memory.importance > 80 ? 0.02 : 0.12)),
    }))
    .filter((memory) => memory.importance >= 4);
};

export const advanceSimulation = (state: WorldState, steps = 1): WorldState => {
  let world = state;
  for (let step = 0; step < steps; step += 1) {
    world = cloneWorld(world, world.tick + 1);
    Object.values(world.heroes).forEach(evolveHero);
    Object.values(world.heroes).forEach((hero) => {
      const action = evaluateActions(hero, world)[0];
      hero.currentAction = action;
      applyAction(hero, action, world);
      const targetName = action.targetId ? world.heroes[action.targetId]?.name : undefined;
      pushJournal(
        world,
        `${hero.name}: ${action.label.toLowerCase()}${targetName ? ` вместе с ${targetName}` : ''}.`,
        [hero.id, ...(action.targetId ? [action.targetId] : [])],
        'decision',
      );
    });
  }
  return world;
};

export { evaluateActions } from './decisions';
export { applyEvent } from './events';
