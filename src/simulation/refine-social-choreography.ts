import { activeLifeSceneOf } from './life-scenes';
import type { WorldState } from './model';
import type { ChoreographedDirective } from './social-choreography';
import { activeVisualSceneOf } from './visual-scenes';

type Slot = {
  position: { x: number; y: number };
  focusPoint: { x: number; y: number };
  bubbleLane: number;
};

const tableCenter = { x: 49.5, y: 29.5 };
const tableSlots: Slot[] = [
  { position: { x: 49.5, y: 39.5 }, focusPoint: tableCenter, bubbleLane: 0 },
  { position: { x: 35.5, y: 30.5 }, focusPoint: tableCenter, bubbleLane: -1 },
  { position: { x: 63.5, y: 30.5 }, focusPoint: tableCenter, bubbleLane: 1 },
  { position: { x: 39, y: 19.5 }, focusPoint: tableCenter, bubbleLane: -2 },
  { position: { x: 60, y: 19.5 }, focusPoint: tableCenter, bubbleLane: 2 },
];

const equipmentSlots: Slot[] = [
  { position: { x: 72, y: 60 }, focusPoint: { x: 83, y: 53.5 }, bubbleLane: -1 },
  { position: { x: 83, y: 61 }, focusPoint: { x: 83, y: 53.5 }, bubbleLane: 0 },
  { position: { x: 94, y: 59 }, focusPoint: { x: 83, y: 53.5 }, bubbleLane: 1 },
  { position: { x: 72, y: 50 }, focusPoint: { x: 83, y: 53.5 }, bubbleLane: -2 },
];

const exitSlots: Slot[] = [
  { position: { x: 72, y: 85 }, focusPoint: { x: 84, y: 73 }, bubbleLane: -1 },
  { position: { x: 84, y: 87 }, focusPoint: { x: 84, y: 73 }, bubbleLane: 0 },
  { position: { x: 96, y: 85 }, focusPoint: { x: 84, y: 73 }, bubbleLane: 1 },
  { position: { x: 66, y: 80 }, focusPoint: { x: 84, y: 73 }, bubbleLane: -2 },
];

const slotFor = (slots: Slot[], slot: number | undefined): Slot => slots[Math.max(0, slot ?? 0) % slots.length];

const pairPosition = (slot: number, spacing: number, center = { x: 50, y: 43.5 }) => ({
  position: { x: center.x + (slot === 0 ? -spacing / 2 : spacing / 2), y: center.y },
  focusPoint: { x: center.x + (slot === 0 ? spacing / 2 : -spacing / 2), y: center.y },
});

export const refineChoreographyDirective = (
  world: WorldState,
  heroId: string,
  directive: ChoreographedDirective | undefined,
): ChoreographedDirective | undefined => {
  if (!directive?.formation) return directive;

  const lifeScene = activeLifeSceneOf(world);
  const visualScene = activeVisualSceneOf(world);
  const slot = Math.max(0, directive.choreographySlot ?? 0);

  if (directive.formation === 'table') {
    const selected = slotFor(tableSlots, slot);
    const scene = visualScene ?? lifeScene;
    const speakerId = scene?.dialogue[scene.currentLineIndex]?.speakerId;
    const speakerSlot = scene ? Math.max(0, scene.participantIds.indexOf(speakerId ?? '')) : -1;
    const focusPoint = speakerId && speakerId !== heroId && speakerSlot >= 0
      ? slotFor(tableSlots, speakerSlot).position
      : tableCenter;
    return {
      ...directive,
      position: selected.position,
      focusPoint,
      bubbleLane: selected.bubbleLane,
      pairGesture: directive.pairGesture === 'offer' ? 'present' : directive.pairGesture,
    };
  }

  if (directive.formation === 'line') {
    const selected = slotFor(exitSlots, slot);
    return { ...directive, position: selected.position, focusPoint: selected.focusPoint, bubbleLane: selected.bubbleLane };
  }

  if (directive.formation === 'workbench') {
    if (visualScene?.phase === 'equipping') {
      const selected = slotFor(equipmentSlots, slot);
      return { ...directive, position: selected.position, focusPoint: selected.focusPoint, bubbleLane: selected.bubbleLane };
    }
    const helper = heroId === lifeScene?.initiatorId;
    return {
      ...directive,
      position: helper ? { x: 75, y: 59 } : { x: 87, y: 59 },
      focusPoint: { x: 81, y: 53.5 },
      bubbleLane: helper ? -1 : 1,
    };
  }

  if (directive.formation === 'care') {
    const patient = heroId === lifeScene?.targetId;
    return {
      ...directive,
      actionId: patient ? 'sleep' : directive.actionId,
      position: patient ? { x: 85, y: 20.5 } : { x: 78.5, y: 21.5 },
      focusPoint: patient ? { x: 78.5, y: 21.5 } : { x: 85, y: 20.5 },
      bubbleLane: patient ? 1 : -1,
    };
  }

  if (directive.formation === 'conflict') {
    const isInitiator = heroId === lifeScene?.initiatorId;
    const isTarget = heroId === lifeScene?.targetId;
    const isMediator = heroId === lifeScene?.mediatorId;
    if (isInitiator) return { ...directive, position: { x: 42, y: 43.5 }, focusPoint: { x: 58, y: 43.5 }, bubbleLane: -1 };
    if (isTarget) return { ...directive, position: { x: 58, y: 43.5 }, focusPoint: { x: 42, y: 43.5 }, bubbleLane: 1 };
    if (isMediator) return { ...directive, position: { x: 50, y: 54 }, focusPoint: { x: 50, y: 43.5 }, bubbleLane: 0 };
    return directive;
  }

  if (directive.formation === 'pair') {
    const spacing = directive.socialDistance === 'public'
      ? 18
      : directive.socialDistance === 'personal'
        ? 10
        : 12;
    const pair = pairPosition(slot, spacing);
    return {
      ...directive,
      position: pair.position,
      focusPoint: pair.focusPoint,
      pairGesture: directive.pairGesture === 'offer' && directive.actionId !== 'help'
        ? 'present'
        : directive.pairGesture,
    };
  }

  return directive;
};
