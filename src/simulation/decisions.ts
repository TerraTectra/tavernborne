import type { ActionId, ActionScore, Hero, RelationshipId, WorldState } from './model';
import { changeRelationship, clamp, traitLabels } from './internal';

export const actionLabels: Record<ActionId, string> = {
  eat: 'Поесть', sleep: 'Спать', train: 'Тренироваться', read: 'Читать',
  talk: 'Поговорить', help: 'Помочь', apologize: 'Извиниться',
  seekSolitude: 'Побыть одному', work: 'Поработать', dungeon: 'Исследовать подземелье',
  recover: 'Восстанавливаться',
};

const noise = (heroId: string, tick: number, actionId: ActionId): number => {
  const input = `${heroId}:${tick}:${actionId}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000 - 0.5;
};

const reason = (reasons: ActionScore['reasons'], label: string, value: number): number => {
  if (Math.abs(value) >= 0.5) reasons.push({ label, value });
  return value;
};

const relationshipTarget = (
  hero: Hero,
  world: WorldState,
  metric: RelationshipId,
): string | undefined =>
  Object.values(world.heroes)
    .filter((candidate) => candidate.id !== hero.id)
    .sort((left, right) =>
      Math.abs(hero.relationships[right.id]?.values[metric] ?? 0)
      - Math.abs(hero.relationships[left.id]?.values[metric] ?? 0))[0]?.id;

const scoreAction = (hero: Hero, world: WorldState, actionId: ActionId): ActionScore => {
  const reasons: ActionScore['reasons'] = [];
  let score = 10;
  let targetId: string | undefined;

  switch (actionId) {
    case 'eat':
      score += reason(reasons, 'голод', hero.needs.hunger * 0.9);
      score -= reason(reasons, 'дисциплина удерживает от перерыва', hero.traits.discipline * 0.12);
      break;
    case 'sleep':
      score += reason(reasons, 'усталость', hero.needs.fatigue * 0.95);
      score += reason(reasons, 'истощение', hero.psyche.burnout * 0.35);
      score -= reason(reasons, 'амбициозность мешает остановиться', hero.traits.ambition * 0.12);
      break;
    case 'train':
      score += reason(reasons, 'потребность в развитии', hero.needs.growth * 0.55);
      score += reason(reasons, traitLabels.ambition, hero.traits.ambition * 0.35);
      score += reason(reasons, traitLabels.discipline, hero.traits.discipline * 0.25);
      score += reason(reasons, 'воодушевление', hero.emotions.inspiration * 0.25);
      score -= reason(reasons, 'усталость', hero.needs.fatigue * 0.4);
      break;
    case 'read':
      score += reason(reasons, traitLabels.curiosity, hero.traits.curiosity * 0.55);
      score += reason(reasons, 'интерес', hero.emotions.interest * 0.35);
      score += reason(reasons, 'потребность в развитии', hero.needs.growth * 0.35);
      score -= reason(reasons, 'раздражение мешает сосредоточиться', hero.emotions.irritation * 0.25);
      break;
    case 'talk':
      targetId = relationshipTarget(hero, world, 'liking');
      score += reason(reasons, 'потребность в общении', hero.needs.social * 0.6);
      score += reason(reasons, traitLabels.friendliness, hero.traits.friendliness * 0.35);
      score += reason(reasons, 'одиночество', hero.emotions.loneliness * 0.4);
      score -= reason(reasons, 'желание побыть одному', hero.needs.solitude * 0.35);
      break;
    case 'help':
      targetId = relationshipTarget(hero, world, 'closeness');
      score += reason(reasons, traitLabels.kindness, hero.traits.kindness * 0.38);
      score += reason(reasons, traitLabels.empathy, hero.traits.empathy * 0.42);
      score += reason(reasons, traitLabels.loyalty, hero.traits.loyalty * 0.25);
      score -= reason(reasons, 'усталость', hero.needs.fatigue * 0.25);
      break;
    case 'apologize': {
      targetId = relationshipTarget(hero, world, 'resentment');
      const tension = targetId ? Math.abs(hero.relationships[targetId]?.values.resentment ?? 0) : 0;
      score += reason(reasons, 'чувство вины', hero.emotions.guilt * 0.65);
      score += reason(reasons, traitLabels.empathy, hero.traits.empathy * 0.22);
      score += reason(reasons, 'напряжённые отношения', tension * 0.3);
      score -= reason(reasons, 'гордость мешает извиниться', hero.traits.pride * 0.5);
      break;
    }
    case 'seekSolitude':
      score += reason(reasons, 'потребность в одиночестве', hero.needs.solitude * 0.65);
      score += reason(reasons, 'стресс', hero.psyche.stress * 0.35);
      score += reason(reasons, 'грусть', hero.emotions.sadness * 0.3);
      score -= reason(reasons, traitLabels.friendliness, hero.traits.friendliness * 0.25);
      break;
    case 'work':
      score += reason(reasons, traitLabels.discipline, hero.traits.discipline * 0.38);
      score += reason(reasons, 'потребность в признании', hero.needs.recognition * 0.32);
      score += reason(reasons, traitLabels.ambition, hero.traits.ambition * 0.3);
      score -= reason(reasons, 'усталость', hero.needs.fatigue * 0.35);
      break;
    case 'recover':
      score += reason(reasons, 'травма', hero.condition.injury * 1.1);
      score += reason(reasons, 'низкое здоровье', (100 - hero.condition.health) * 0.8);
      score += reason(reasons, 'усталость', hero.needs.fatigue * 0.35);
      break;
    case 'dungeon':
      score = -100;
      reason(reasons, 'поход требует группового плана', -100);
      break;
  }

  score += noise(hero.id, world.tick, actionId) * (8 + hero.traits.impulsiveness * 0.08);
  return {
    actionId,
    label: actionLabels[actionId],
    score,
    targetId,
    reasons: reasons.sort((left, right) => Math.abs(right.value) - Math.abs(left.value)).slice(0, 5),
  };
};

export const evaluateActions = (hero: Hero, world: WorldState): ActionScore[] => {
  const actions: ActionId[] = [
    'eat', 'sleep', 'train', 'read', 'talk', 'help', 'apologize', 'seekSolitude', 'work', 'recover',
  ];
  return actions.map((actionId) => scoreAction(hero, world, actionId))
    .sort((left, right) => right.score - left.score);
};

export const applyAction = (hero: Hero, action: ActionScore, world: WorldState): void => {
  switch (action.actionId) {
    case 'eat':
      hero.needs.hunger = clamp(hero.needs.hunger - 45);
      hero.emotions.joy = clamp(hero.emotions.joy + 4);
      break;
    case 'sleep':
      hero.needs.fatigue = clamp(hero.needs.fatigue - 55);
      hero.psyche.stress = clamp(hero.psyche.stress - 12);
      break;
    case 'train':
      hero.needs.growth = clamp(hero.needs.growth - 25);
      hero.needs.fatigue = clamp(hero.needs.fatigue + 18);
      hero.psyche.confidence = clamp(hero.psyche.confidence + 2);
      hero.stats.strength = clamp(hero.stats.strength + 0.8);
      hero.stats.endurance = clamp(hero.stats.endurance + 0.5);
      break;
    case 'read':
      hero.needs.growth = clamp(hero.needs.growth - 20);
      hero.emotions.interest = clamp(hero.emotions.interest + 8);
      hero.needs.fatigue = clamp(hero.needs.fatigue + 5);
      hero.stats.magic = clamp(hero.stats.magic + 0.6);
      hero.stats.perception = clamp(hero.stats.perception + 0.4);
      break;
    case 'talk':
      hero.needs.social = clamp(hero.needs.social - 30);
      hero.emotions.loneliness = clamp(hero.emotions.loneliness - 20);
      if (action.targetId) {
        changeRelationship(hero, action.targetId, 'closeness', 2.5);
        changeRelationship(hero, action.targetId, 'liking', 1.5);
        const target = world.heroes[action.targetId];
        if (target) changeRelationship(target, hero.id, 'closeness', 1.5);
      }
      break;
    case 'help':
      hero.needs.recognition = clamp(hero.needs.recognition - 8);
      hero.needs.fatigue = clamp(hero.needs.fatigue + 8);
      if (action.targetId) {
        const target = world.heroes[action.targetId];
        if (target) {
          changeRelationship(target, hero.id, 'trust', 4);
          changeRelationship(target, hero.id, 'liking', 3);
        }
      }
      break;
    case 'apologize':
      hero.emotions.guilt = clamp(hero.emotions.guilt - 18);
      if (action.targetId) {
        changeRelationship(hero, action.targetId, 'resentment', -8);
        const target = world.heroes[action.targetId];
        if (target) changeRelationship(target, hero.id, 'resentment', -5);
      }
      break;
    case 'seekSolitude':
      hero.needs.solitude = clamp(hero.needs.solitude - 35);
      hero.psyche.stress = clamp(hero.psyche.stress - 8);
      hero.emotions.irritation = clamp(hero.emotions.irritation - 10);
      break;
    case 'work':
      hero.needs.recognition = clamp(hero.needs.recognition - 10);
      hero.needs.fatigue = clamp(hero.needs.fatigue + 15);
      hero.needs.growth = clamp(hero.needs.growth - 5);
      break;
    case 'recover':
      hero.condition.health = clamp(hero.condition.health + 14);
      hero.condition.injury = clamp(hero.condition.injury - 18);
      hero.needs.fatigue = clamp(hero.needs.fatigue - 18);
      hero.psyche.stress = clamp(hero.psyche.stress - 7);
      break;
    case 'dungeon':
      break;
  }
};
