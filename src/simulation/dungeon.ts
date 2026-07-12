import type { DungeonEvent, Expedition, Hero, WorldState } from './model';
import {
  advanceDungeonExploration,
  dungeonExplorationOf,
  ensureDungeonExploration,
  markDungeonExplorationCompleted,
} from './dungeon-exploration';
import { clamp, mergeInventory, pushJournal } from './internal';

const addEvent = (
  world: WorldState,
  expedition: Expedition,
  type: DungeonEvent['type'],
  text: string,
  heroIds = expedition.partyIds,
): void => {
  const event: DungeonEvent = {
    id: `${expedition.id}-${world.tick}-${expedition.events.length}`,
    tick: world.tick,
    type,
    text,
    heroIds,
  };
  expedition.events.unshift(event);
  expedition.events = expedition.events.slice(0, 60);
  pushJournal(world, text, heroIds, 'dungeon');
};

const party = (world: WorldState, expedition: Expedition): Hero[] =>
  expedition.partyIds.map((id) => world.heroes[id]).filter(Boolean);

const completeExpedition = (world: WorldState, expedition: Expedition, retreated: boolean): void => {
  const heroes = party(world, expedition);
  expedition.status = retreated ? 'retreated' : 'completed';
  expedition.progress = 100;
  markDungeonExplorationCompleted(expedition, retreated);
  const exploration = dungeonExplorationOf(expedition);
  expedition.outcome = exploration?.outcome ?? (retreated
    ? 'Группа отступила, сохранив жизни.'
    : 'Группа завершила разведку и вернулась по плану.');

  expedition.loot.forEach((item, index) => {
    const receiver = heroes[index % Math.max(1, heroes.length)];
    if (receiver) mergeInventory(receiver, item);
  });

  heroes.forEach((hero) => {
    const expeditionBlock = hero.dailyPlan.find((block) =>
      block.expeditionId === expedition.id && block.actionId === 'dungeon');
    if (expeditionBlock) expeditionBlock.status = 'done';

    hero.currentActivity = undefined;
    hero.currentAction = undefined;
    hero.memories.unshift({
      id: `${expedition.id}-${hero.id}-memory`,
      summary: retreated
        ? `Осознанное отступление после разведки ${expedition.floor}-го этажа.`
        : `Визуальная разведка ${expedition.floor}-го этажа без ненужного боя.`,
      createdAt: world.tick,
      importance: retreated ? 64 : 54,
      valence: retreated ? -20 : 38,
      participants: expedition.partyIds.filter((id) => id !== hero.id),
      tags: ['dungeon', 'visual-exploration', retreated ? 'retreat' : 'success'],
      sourceEventType: 'dungeon',
    });
  });

  const lootText = expedition.loot.length
    ? expedition.loot.map((item) => `${item.name} ×${item.quantity}`).join(', ')
    : 'без тяжёлой добычи';
  addEvent(
    world,
    expedition,
    'return',
    `${heroes.map((hero) => hero.name).join(', ')} вернулись в кибитку. ${expedition.outcome} Добыча: ${lootText}.`,
  );
};

export const advanceExpeditions = (world: WorldState): void => {
  world.expeditions.forEach((expedition) => {
    const heroes = party(world, expedition);
    if (expedition.status === 'planned' && world.tick >= expedition.departTick) {
      expedition.status = 'active';
      ensureDungeonExploration(world, expedition);
    }
    if (expedition.status !== 'active') return;

    const averageHealth = heroes.reduce(
      (totalHealth, hero) => totalHealth + hero.condition.health,
      0,
    ) / Math.max(1, heroes.length);
    const averageFatigue = heroes.reduce(
      (totalFatigue, hero) => totalFatigue + hero.needs.fatigue,
      0,
    ) / Math.max(1, heroes.length);
    if (averageHealth < 35 || averageFatigue > 96) {
      const exploration = dungeonExplorationOf(expedition);
      if (exploration) {
        exploration.threatDecision = 'retreat';
        exploration.outcome = 'Состояние группы стало критическим, поэтому лидер прекратил исследование.';
      }
      completeExpedition(world, expedition, true);
      return;
    }

    const result = advanceDungeonExploration(world, expedition);
    const exploration = dungeonExplorationOf(expedition);
    const latestDecision = exploration?.decisions[0];
    if (exploration && latestDecision?.kind === 'help') {
      const helperActor = exploration.actors[latestDecision.actorId];
      if (helperActor) helperActor.status = 'helping';
    }

    if (result === 'complete' || result === 'retreat' || (exploration?.step ?? 0) >= 7) {
      completeExpedition(
        world,
        expedition,
        result === 'retreat' || exploration?.threatDecision === 'retreat',
      );
      return;
    }

    expedition.progress = exploration
      ? clamp((exploration.step / 7) * 100, 0, 96)
      : expedition.progress;

    if (world.tick > expedition.plannedReturnTick + 2) {
      completeExpedition(world, expedition, exploration?.threatDecision === 'retreat');
    }
  });
};

export const activeExpeditionForHero = (
  world: WorldState,
  heroId: string,
): Expedition | undefined =>
  world.expeditions.find((expedition) =>
    expedition.partyIds.includes(heroId)
    && (expedition.status === 'active' || expedition.status === 'returning'));
