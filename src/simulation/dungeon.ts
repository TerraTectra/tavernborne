import type { DungeonEvent, Expedition, Hero, InventoryItem, WorldState } from './model';
import { changeRelationship, clamp, deterministicUnit, mergeInventory, pushJournal } from './internal';
import { hourOf } from './schedule';

const addLoot = (expedition: Expedition, item: InventoryItem): void => {
  const existing = expedition.loot.find((candidate) => candidate.id === item.id);
  if (existing) existing.quantity += item.quantity;
  else expedition.loot.push({ ...item });
};

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
  expedition.events = expedition.events.slice(0, 40);
  pushJournal(world, text, heroIds, 'dungeon');
};

const party = (world: WorldState, expedition: Expedition): Hero[] =>
  expedition.partyIds.map((id) => world.heroes[id]).filter(Boolean);

const strongest = (heroes: Hero[], stat: keyof Hero['stats']): Hero =>
  [...heroes].sort((left, right) => right.stats[stat] - left.stats[stat])[0];

const resolveBattle = (world: WorldState, expedition: Expedition, heroes: Hero[], roll: number): void => {
  const defender = strongest(heroes, 'endurance');
  const attacker = strongest(heroes, 'strength');
  const scout = strongest(heroes, 'perception');
  const partyPower = heroes.reduce((total, hero) =>
    total + hero.stats.strength + hero.stats.dexterity + hero.stats.magic * 0.7 + hero.stats.endurance, 0) / heroes.length;
  const danger = expedition.risk + expedition.floor * 7 + roll * 28;
  const margin = partyPower - danger;

  heroes.forEach((hero) => {
    hero.needs.fatigue = clamp(hero.needs.fatigue + 8 + expedition.floor * 0.7);
    hero.stats.endurance = clamp(hero.stats.endurance + 0.18);
    hero.stats.dexterity = clamp(hero.stats.dexterity + 0.12);
  });
  attacker.stats.strength = clamp(attacker.stats.strength + 0.35);
  scout.stats.perception = clamp(scout.stats.perception + 0.2);

  if (margin < 4) {
    const victim = heroes[Math.floor(roll * heroes.length) % heroes.length];
    const damage = clamp(7 + danger * 0.12 - victim.stats.endurance * 0.08, 4, 24);
    victim.condition.health = clamp(victim.condition.health - damage);
    victim.condition.injury = clamp(victim.condition.injury + damage * 0.8);
    victim.emotions.fear = clamp(victim.emotions.fear + 7);
    defender.emotions.guilt = defender.id === victim.id
      ? defender.emotions.guilt
      : clamp(defender.emotions.guilt + 3);
    addEvent(
      world,
      expedition,
      'danger',
      `${victim.name} получил ранение в тяжёлом бою. ${defender.name} удержал строй, пока остальные отбивались.`,
    );
  } else {
    heroes.forEach((hero) => {
      hero.emotions.inspiration = clamp(hero.emotions.inspiration + 5);
      hero.psyche.confidence = clamp(hero.psyche.confidence + 1.5);
    });
    addLoot(expedition, {
      id: 'magic-stone',
      name: 'Магический камень',
      quantity: 2 + expedition.floor,
      category: 'loot',
    });
    addEvent(
      world,
      expedition,
      'battle',
      `${attacker.name} повёл атаку, а ${scout.name} вовремя заметил обходящего монстра. Группа победила и собрала магические камни.`,
    );
  }
};

const resolveDiscovery = (world: WorldState, expedition: Expedition, heroes: Hero[], roll: number): void => {
  const scout = strongest(heroes, 'perception');
  const mage = strongest(heroes, 'magic');
  const item = roll > 0.55
    ? { id: 'dungeon-herb', name: 'Подземная трава', quantity: 2, category: 'material' as const }
    : { id: 'ore-fragment', name: 'Осколок руды', quantity: 1, category: 'material' as const };
  addLoot(expedition, item);
  scout.stats.perception = clamp(scout.stats.perception + 0.35);
  mage.stats.magic = clamp(mage.stats.magic + 0.2);
  heroes.forEach((hero) => {
    hero.emotions.interest = clamp(hero.emotions.interest + 4);
    hero.emotions.joy = clamp(hero.emotions.joy + 2);
  });
  addEvent(
    world,
    expedition,
    'discovery',
    `${scout.name} заметил скрытый проход. ${mage.name} помог безопасно извлечь находку: ${item.name.toLowerCase()}.`,
  );
};

const resolveBond = (world: WorldState, expedition: Expedition, heroes: Hero[]): void => {
  const first = heroes[0];
  const second = heroes[1];
  if (!first || !second) return;
  changeRelationship(first, second.id, 'trust', 2.5);
  changeRelationship(second, first.id, 'trust', 2.5);
  changeRelationship(first, second.id, 'closeness', 1.5);
  changeRelationship(second, first.id, 'closeness', 1.5);
  first.needs.social = clamp(first.needs.social - 8);
  second.needs.social = clamp(second.needs.social - 8);
  addEvent(
    world,
    expedition,
    'bond',
    `${first.name} и ${second.name} прикрыли друг друга в узком проходе. Взаимное доверие укрепилось.`,
    [first.id, second.id],
  );
};

const resolveRest = (world: WorldState, expedition: Expedition, heroes: Hero[]): void => {
  heroes.forEach((hero) => {
    hero.needs.hunger = clamp(hero.needs.hunger - 24);
    hero.needs.fatigue = clamp(hero.needs.fatigue - 8);
    hero.psyche.stress = clamp(hero.psyche.stress - 4);
  });
  addEvent(
    world,
    expedition,
    'rest',
    'Группа нашла защищённую нишу, разделила паёк и сверила дальнейший маршрут.',
  );
};

const completeExpedition = (world: WorldState, expedition: Expedition, retreated: boolean): void => {
  const heroes = party(world, expedition);
  expedition.status = retreated ? 'retreated' : 'completed';
  expedition.progress = 100;
  expedition.outcome = retreated
    ? 'Группа отступила, сохранив жизни.'
    : 'Группа вернулась по плану.';

  expedition.loot.forEach((item, index) => {
    const receiver = heroes[index % heroes.length];
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
        ? `Тяжёлое отступление с ${expedition.floor}-го этажа.`
        : `Успешный поход на ${expedition.floor}-й этаж.`,
      createdAt: world.tick,
      importance: retreated ? 62 : 48,
      valence: retreated ? -45 : 42,
      participants: expedition.partyIds.filter((id) => id !== hero.id),
      tags: ['dungeon', retreated ? 'retreat' : 'success'],
      sourceEventType: 'dungeon',
    });
  });

  const lootText = expedition.loot.length
    ? expedition.loot.map((item) => `${item.name} ×${item.quantity}`).join(', ')
    : 'почти без добычи';
  addEvent(
    world,
    expedition,
    'return',
    `${heroes.map((hero) => hero.name).join(', ')} вернулись: ${expedition.outcome} Добыча: ${lootText}.`,
  );
};

export const advanceExpeditions = (world: WorldState): void => {
  world.expeditions.forEach((expedition) => {
    const heroes = party(world, expedition);
    if (expedition.status === 'planned' && world.tick >= expedition.departTick) {
      expedition.status = 'active';
      addEvent(
        world,
        expedition,
        'travel',
        `${heroes.map((hero) => hero.name).join(', ')} покинули кибитку и вошли в подземелье.`,
      );
    }
    if (expedition.status !== 'active') return;

    const total = Math.max(1, expedition.plannedReturnTick - expedition.departTick);
    expedition.progress = clamp(((world.tick - expedition.departTick) / total) * 100);

    if (world.tick >= expedition.plannedReturnTick) {
      completeExpedition(world, expedition, false);
      return;
    }

    const averageHealth = heroes.reduce(
      (totalHealth, hero) => totalHealth + hero.condition.health,
      0,
    ) / Math.max(1, heroes.length);
    const averageFatigue = heroes.reduce(
      (totalFatigue, hero) => totalFatigue + hero.needs.fatigue,
      0,
    ) / Math.max(1, heroes.length);
    if (averageHealth < 42 || averageFatigue > 92) {
      completeExpedition(world, expedition, true);
      return;
    }

    const roll = deterministicUnit(`${expedition.id}:${world.tick}:${expedition.floor}`);
    if (hourOf(world.tick) === 13) resolveRest(world, expedition, heroes);
    else if (roll < 0.3) resolveBattle(world, expedition, heroes, roll);
    else if (roll < 0.52) resolveDiscovery(world, expedition, heroes, roll);
    else if (roll < 0.7) resolveBond(world, expedition, heroes);
    else if (roll < 0.84) resolveRest(world, expedition, heroes);
    else {
      addEvent(
        world,
        expedition,
        'travel',
        `Группа осторожно продвинулась глубже по ${expedition.floor}-му этажу, не встретив серьёзной угрозы.`,
      );
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
