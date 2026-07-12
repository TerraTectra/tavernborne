import type { EventType, Hero, Memory, SimulationEvent, WorldState } from './model';
import {
  changeEmotion,
  changeRelationship,
  clamp,
  cloneWorld,
  personalityMultiplier,
  pushJournal,
} from './internal';

const memoryLabels: Record<EventType, string> = {
  praise: 'Получил похвалу', insult: 'Был оскорблён', helped: 'Получил помощь',
  rejected: 'Столкнулся с отказом', sharedTask: 'Работал вместе с товарищем',
  argument: 'Пережил ссору', gift: 'Получил подарок', failure: 'Потерпел неудачу',
  injury: 'Получил травму', loss: 'Пережил тяжёлую потерю',
};

const valence: Record<EventType, number> = {
  praise: 45, insult: -55, helped: 55, rejected: -40, sharedTask: 25,
  argument: -45, gift: 50, failure: -35, injury: -60, loss: -100,
};

const addMemory = (hero: Hero, event: SimulationEvent): void => {
  const emotionalLoad = hero.emotions.anger + hero.emotions.sadness + hero.emotions.joy
    + hero.emotions.fear + hero.emotions.guilt;
  const memory: Memory = {
    id: `${event.id}-${hero.id}`,
    summary: event.description || memoryLabels[event.type],
    createdAt: event.id.length + hero.memories.length,
    importance: clamp(event.intensity * 0.65 + emotionalLoad * 0.08, 5, 100),
    valence: valence[event.type],
    participants: [event.actorId, event.targetId].filter((id): id is string => Boolean(id)),
    tags: [...event.tags, event.type],
    sourceEventType: event.type,
  };
  hero.memories.unshift(memory);
  hero.memories = hero.memories.slice(0, 80);
};

export const applyEvent = (state: WorldState, event: SimulationEvent): WorldState => {
  const world = cloneWorld(state);
  const actor = world.heroes[event.actorId];
  const target = event.targetId ? world.heroes[event.targetId] : undefined;
  if (!actor && !target) return world;

  const subject = target ?? actor!;
  const power = clamp(event.intensity, 1, 100) / 10;

  switch (event.type) {
    case 'praise': {
      const sensitivity = personalityMultiplier(subject, ['approvalSeeking', 'pride']);
      changeEmotion(subject, 'joy', power * 3.2 * sensitivity);
      changeEmotion(subject, 'inspiration', power * 2.2 * sensitivity);
      subject.psyche.confidence = clamp(subject.psyche.confidence + power * 2.5);
      subject.needs.recognition = clamp(subject.needs.recognition - power * 4);
      if (target) {
        changeRelationship(target, event.actorId, 'liking', power * 2);
        changeRelationship(target, event.actorId, 'respect', power * 1.5);
      }
      break;
    }
    case 'insult': {
      const reactivity = personalityMultiplier(subject, ['pride', 'vengefulness'], ['patience']);
      changeEmotion(subject, 'anger', power * 3.4 * reactivity);
      changeEmotion(subject, 'shame', power * 2.1);
      subject.psyche.stress = clamp(subject.psyche.stress + power * 2.5);
      if (target) {
        changeRelationship(target, event.actorId, 'resentment', power * 3 * reactivity);
        changeRelationship(target, event.actorId, 'liking', -power * 2.2);
        changeRelationship(target, event.actorId, 'trust', -power * 1.4);
      }
      break;
    }
    case 'helped': {
      const sensitivity = personalityMultiplier(subject, ['empathy', 'kindness', 'loyalty']);
      changeEmotion(subject, 'joy', power * 2.4 * sensitivity);
      changeEmotion(subject, 'affection', power * 2.2 * sensitivity);
      if (target) {
        changeRelationship(target, event.actorId, 'trust', power * 2.5);
        changeRelationship(target, event.actorId, 'liking', power * 2.2);
        changeRelationship(target, event.actorId, 'debt', power * 1.8);
      }
      break;
    }
    case 'rejected': {
      const sensitivity = personalityMultiplier(subject, ['approvalSeeking'], ['independence']);
      changeEmotion(subject, 'sadness', power * 2.7 * sensitivity);
      changeEmotion(subject, 'shame', power * 1.6 * sensitivity);
      changeEmotion(subject, 'anger', power * 1.2 * personalityMultiplier(subject, ['pride']));
      subject.psyche.confidence = clamp(subject.psyche.confidence - power * 1.8 * sensitivity);
      if (target) changeRelationship(target, event.actorId, 'resentment', power * 1.2);
      break;
    }
    case 'sharedTask': {
      changeEmotion(subject, 'interest', power * 1.4);
      subject.needs.belonging = clamp(subject.needs.belonging - power * 2);
      if (target) {
        changeRelationship(target, event.actorId, 'closeness', power * 1.6);
        changeRelationship(target, event.actorId, 'trust', power * 1.1);
        if (actor) changeRelationship(actor, target.id, 'closeness', power * 1.2);
      }
      break;
    }
    case 'argument': {
      const reactivity = personalityMultiplier(subject, ['pride', 'impulsiveness'], ['patience']);
      changeEmotion(subject, 'anger', power * 2.8 * reactivity);
      changeEmotion(subject, 'irritation', power * 3.1 * reactivity);
      subject.psyche.stress = clamp(subject.psyche.stress + power * 1.8);
      if (target) {
        changeRelationship(target, event.actorId, 'resentment', power * 2.1 * reactivity);
        changeRelationship(target, event.actorId, 'trust', -power * 1.2);
        if (actor) changeRelationship(actor, target.id, 'resentment', power * 1.6);
      }
      break;
    }
    case 'gift': {
      changeEmotion(subject, 'joy', power * 2.5);
      changeEmotion(subject, 'affection', power * 1.8);
      if (target) {
        changeRelationship(target, event.actorId, 'liking', power * 2.5);
        changeRelationship(target, event.actorId, 'debt', power * 1.2);
      }
      break;
    }
    case 'failure': {
      const ambition = personalityMultiplier(subject, ['ambition', 'pride']);
      changeEmotion(subject, 'sadness', power * 2.1);
      changeEmotion(subject, 'shame', power * 1.9 * ambition);
      changeEmotion(subject, 'inspiration', power * 1.3 * personalityMultiplier(subject, ['discipline', 'ambition']));
      subject.psyche.confidence = clamp(subject.psyche.confidence - power * 1.5);
      subject.needs.growth = clamp(subject.needs.growth + power * 2.4);
      break;
    }
    case 'injury':
      changeEmotion(subject, 'fear', power * 2.3);
      changeEmotion(subject, 'anxiety', power * 2.4);
      subject.psyche.stress = clamp(subject.psyche.stress + power * 2.8);
      subject.needs.safety = clamp(subject.needs.safety + power * 3.2);
      break;
    case 'loss': {
      const attachment = personalityMultiplier(subject, ['empathy', 'loyalty', 'friendliness']);
      changeEmotion(subject, 'sadness', power * 5 * attachment);
      changeEmotion(subject, 'anger', power * 2 * personalityMultiplier(subject, ['vengefulness', 'cruelty']));
      changeEmotion(subject, 'guilt', power * 2.6 * personalityMultiplier(subject, ['empathy', 'loyalty']));
      subject.psyche.grief = clamp(subject.psyche.grief + power * 5);
      subject.psyche.stress = clamp(subject.psyche.stress + power * 3.5);
      subject.psyche.security = clamp(subject.psyche.security - power * 2.5);
      break;
    }
  }

  addMemory(subject, event);
  pushJournal(
    world,
    event.description,
    [actor?.id, target?.id].filter((id): id is string => Boolean(id)),
    'event',
  );
  return world;
};
