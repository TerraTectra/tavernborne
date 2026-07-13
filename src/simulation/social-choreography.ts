import { activeLifeSceneOf, type LifeActorDirective, type LifeScene } from './life-scenes';
import type { WorldState } from './model';
import { activeVisualSceneOf, type VisualActorDirective, type VisualScene } from './visual-scenes';

export type ChoreographyFormation = 'pair' | 'table' | 'care' | 'conflict' | 'line' | 'workbench';
export type ChoreographyDistance = 'intimate' | 'personal' | 'social' | 'public';
export type ChoreographyGesture =
  | 'none'
  | 'share'
  | 'offer'
  | 'receive'
  | 'heal'
  | 'appeal'
  | 'argue'
  | 'recoil'
  | 'mediate'
  | 'observe'
  | 'present';

export interface ChoreographyMetadata {
  focusPoint?: { x: number; y: number };
  formation?: ChoreographyFormation;
  choreographySlot?: number;
  bubbleLane?: number;
  socialDistance?: ChoreographyDistance;
  pairGesture?: ChoreographyGesture;
  partnerId?: string;
}

export type ChoreographedDirective = (VisualActorDirective | LifeActorDirective) & ChoreographyMetadata;

type Slot = {
  position: { x: number; y: number };
  focusPoint: { x: number; y: number };
  bubbleLane: number;
};

const tableCenter = { x: 49.5, y: 30.5 };
const tableSlots: Slot[] = [
  { position: { x: 49.5, y: 36.5 }, focusPoint: tableCenter, bubbleLane: 0 },
  { position: { x: 42.5, y: 31.5 }, focusPoint: tableCenter, bubbleLane: -1 },
  { position: { x: 56.5, y: 31.5 }, focusPoint: tableCenter, bubbleLane: 1 },
  { position: { x: 44.5, y: 24.5 }, focusPoint: tableCenter, bubbleLane: -2 },
  { position: { x: 54.5, y: 24.5 }, focusPoint: tableCenter, bubbleLane: 2 },
];

const equipmentSlots: Slot[] = [
  { position: { x: 77.5, y: 59 }, focusPoint: { x: 82.5, y: 54.5 }, bubbleLane: -1 },
  { position: { x: 83, y: 60 }, focusPoint: { x: 82.5, y: 54.5 }, bubbleLane: 0 },
  { position: { x: 88.5, y: 58 }, focusPoint: { x: 82.5, y: 54.5 }, bubbleLane: 1 },
  { position: { x: 74, y: 55 }, focusPoint: { x: 82.5, y: 54.5 }, bubbleLane: -2 },
];

const exitSlots: Slot[] = [
  { position: { x: 79, y: 85 }, focusPoint: { x: 85, y: 76 }, bubbleLane: -1 },
  { position: { x: 85, y: 86 }, focusPoint: { x: 85, y: 76 }, bubbleLane: 0 },
  { position: { x: 91, y: 85 }, focusPoint: { x: 85, y: 76 }, bubbleLane: 1 },
  { position: { x: 75, y: 82 }, focusPoint: { x: 85, y: 76 }, bubbleLane: -2 },
];

const slotIndex = (ids: string[], heroId: string): number => Math.max(0, ids.indexOf(heroId));
const relationValue = (world: WorldState, sourceId: string | undefined, targetId: string | undefined, key: 'resentment' | 'closeness'): number => {
  if (!sourceId || !targetId) return 0;
  return world.heroes[sourceId]?.relationships[targetId]?.values[key] ?? 0;
};

const partnerFor = (scene: LifeScene, heroId: string): string | undefined => {
  if (heroId === scene.initiatorId) return scene.targetId;
  if (heroId === scene.targetId) return scene.initiatorId;
  if (heroId === scene.mediatorId) return scene.initiatorId;
  return scene.initiatorId ?? scene.targetId;
};

const pairSlot = (
  heroId: string,
  leftId: string | undefined,
  rightId: string | undefined,
  spacing: number,
  center = { x: 50, y: 43.5 },
): Slot => {
  const isLeft = heroId === leftId || (!rightId && heroId !== leftId);
  const half = spacing / 2;
  return {
    position: { x: center.x + (isLeft ? -half : half), y: center.y },
    focusPoint: { x: center.x + (isLeft ? half : -half), y: center.y },
    bubbleLane: isLeft ? -1 : 1,
  };
};

const speakerFocusForTable = (scene: LifeScene | VisualScene, heroId: string, ids: string[]): { x: number; y: number } => {
  const speakerId = scene.dialogue[scene.currentLineIndex]?.speakerId;
  if (!speakerId || speakerId === heroId) return tableCenter;
  return tableSlots[slotIndex(ids, speakerId) % tableSlots.length].position;
};

const choreographyForLifeScene = (
  world: WorldState,
  scene: LifeScene,
  heroId: string,
  base: LifeActorDirective,
): ChoreographedDirective => {
  const participantIndex = slotIndex(scene.participantIds, heroId);
  const currentLine = scene.dialogue[scene.currentLineIndex];
  const isSpeaker = currentLine?.speakerId === heroId;
  const partnerId = partnerFor(scene, heroId);

  if (scene.type === 'meal' || scene.type === 'debrief') {
    const orderedIds = scene.type === 'meal'
      ? [scene.initiatorId, ...scene.participantIds.filter((id) => id !== scene.initiatorId)].filter(Boolean) as string[]
      : scene.participantIds;
    const index = slotIndex(orderedIds, heroId);
    const slot = tableSlots[index % tableSlots.length];
    const role = scene.roles[heroId];
    return {
      ...base,
      position: slot.position,
      focusPoint: speakerFocusForTable(scene, heroId, orderedIds),
      formation: 'table',
      choreographySlot: index,
      bubbleLane: slot.bubbleLane,
      socialDistance: 'social',
      pairGesture: scene.type === 'meal'
        ? scene.phase === 'action' ? 'share' : isSpeaker ? 'offer' : 'receive'
        : role === 'leader' && isSpeaker ? 'present' : 'observe',
      partnerId: currentLine?.speakerId === heroId ? undefined : currentLine?.speakerId,
    };
  }

  if (scene.type === 'help') {
    const actionPhase = scene.phase === 'action' || scene.phase === 'reaction' || scene.phase === 'resolution';
    const isInitiator = heroId === scene.initiatorId;
    const slot = actionPhase
      ? {
          position: isInitiator ? { x: 79.2, y: 58.5 } : { x: 84.2, y: 58.5 },
          focusPoint: { x: 81.7, y: 54.3 },
          bubbleLane: isInitiator ? -1 : 1,
        }
      : pairSlot(heroId, scene.initiatorId, scene.targetId, 7, { x: 81.7, y: 57 });
    return {
      ...base,
      position: slot.position,
      focusPoint: slot.focusPoint,
      formation: actionPhase ? 'workbench' : 'pair',
      choreographySlot: isInitiator ? 0 : 1,
      bubbleLane: slot.bubbleLane,
      socialDistance: 'personal',
      pairGesture: actionPhase ? isInitiator ? 'offer' : 'receive' : isSpeaker ? 'offer' : 'receive',
      partnerId,
    };
  }

  if (scene.type === 'treatment') {
    const isPatient = heroId === scene.targetId;
    const slot: Slot = isPatient
      ? { position: { x: 84, y: 20.5 }, focusPoint: { x: 80.7, y: 22.2 }, bubbleLane: 1 }
      : { position: { x: 80.7, y: 22.2 }, focusPoint: { x: 84, y: 20.5 }, bubbleLane: -1 };
    return {
      ...base,
      position: slot.position,
      focusPoint: slot.focusPoint,
      formation: 'care',
      choreographySlot: isPatient ? 1 : 0,
      bubbleLane: slot.bubbleLane,
      socialDistance: 'intimate',
      pairGesture: isPatient ? 'receive' : 'heal',
      partnerId,
    };
  }

  if (scene.type === 'conflict') {
    const isInitiator = heroId === scene.initiatorId;
    const isTarget = heroId === scene.targetId;
    const isMediator = heroId === scene.mediatorId;
    const witnessIndex = scene.participantIds.filter((id) => ![scene.initiatorId, scene.targetId, scene.mediatorId].includes(id)).indexOf(heroId);
    const slot: Slot = isInitiator
      ? { position: { x: 43.5, y: 43.5 }, focusPoint: { x: 56.5, y: 43.5 }, bubbleLane: -1 }
      : isTarget
        ? { position: { x: 56.5, y: 43.5 }, focusPoint: { x: 43.5, y: 43.5 }, bubbleLane: 1 }
        : isMediator
          ? { position: { x: 50, y: 51 }, focusPoint: { x: 50, y: 43.5 }, bubbleLane: 0 }
          : { position: { x: 45 + witnessIndex * 10, y: 55 }, focusPoint: { x: 50, y: 43.5 }, bubbleLane: witnessIndex % 2 === 0 ? -2 : 2 };
    return {
      ...base,
      position: slot.position,
      focusPoint: slot.focusPoint,
      formation: 'conflict',
      choreographySlot: participantIndex,
      bubbleLane: slot.bubbleLane,
      socialDistance: 'public',
      pairGesture: isMediator ? 'mediate' : isInitiator || isTarget ? isSpeaker ? 'argue' : 'recoil' : 'observe',
      partnerId: isInitiator ? scene.targetId : isTarget ? scene.initiatorId : scene.initiatorId,
    };
  }

  const sourceSocial = scene.sourceSocialSceneId
    ? world.socialScenes.find((candidate) => candidate.id === scene.sourceSocialSceneId)
    : undefined;
  const refused = sourceSocial?.response === 'refused'
    || relationValue(world, scene.targetId, scene.initiatorId, 'resentment') > 20;
  const closeness = relationValue(world, scene.initiatorId, scene.targetId, 'closeness')
    + relationValue(world, scene.targetId, scene.initiatorId, 'closeness');
  const spacing = refused ? 14 : closeness > 45 ? 6.4 : 8;
  const slot = pairSlot(heroId, scene.initiatorId, scene.targetId, spacing);
  const isInitiator = heroId === scene.initiatorId;
  const pairGesture: ChoreographyGesture = scene.type === 'apology'
    ? isInitiator ? 'appeal' : refused ? 'recoil' : 'receive'
    : refused ? isSpeaker ? 'argue' : 'recoil' : isSpeaker ? 'offer' : 'receive';

  return {
    ...base,
    position: slot.position,
    focusPoint: slot.focusPoint,
    formation: 'pair',
    choreographySlot: isInitiator ? 0 : 1,
    bubbleLane: slot.bubbleLane,
    socialDistance: refused ? 'public' : closeness > 45 ? 'personal' : 'social',
    pairGesture,
    partnerId,
  };
};

const choreographyForVisualScene = (
  scene: VisualScene,
  heroId: string,
  base: VisualActorDirective,
): ChoreographedDirective => {
  const participantIndex = slotIndex(scene.participantIds, heroId);
  const partyIndex = slotIndex(scene.partyIds, heroId);
  const isParty = scene.partyIds.includes(heroId);
  const isLeader = heroId === scene.leaderId;

  if (scene.phase === 'equipping') {
    const slot = isParty ? equipmentSlots[partyIndex % equipmentSlots.length] : tableSlots[participantIndex % tableSlots.length];
    return {
      ...base,
      position: slot.position,
      focusPoint: slot.focusPoint,
      formation: isParty ? 'workbench' : 'table',
      choreographySlot: isParty ? partyIndex : participantIndex,
      bubbleLane: slot.bubbleLane,
      socialDistance: 'social',
      pairGesture: isParty ? 'present' : 'observe',
      partnerId: isLeader ? undefined : scene.leaderId,
    };
  }

  if (scene.phase === 'departure') {
    const slot = isParty ? exitSlots[partyIndex % exitSlots.length] : tableSlots[participantIndex % tableSlots.length];
    return {
      ...base,
      position: slot.position,
      focusPoint: slot.focusPoint,
      formation: isParty ? 'line' : 'table',
      choreographySlot: isParty ? partyIndex : participantIndex,
      bubbleLane: slot.bubbleLane,
      socialDistance: 'social',
      pairGesture: isParty ? 'present' : 'observe',
      partnerId: isLeader ? undefined : scene.leaderId,
    };
  }

  const slot = tableSlots[participantIndex % tableSlots.length];
  const currentSpeaker = scene.dialogue[scene.currentLineIndex]?.speakerId;
  return {
    ...base,
    position: slot.position,
    focusPoint: speakerFocusForTable(scene, heroId, scene.participantIds),
    formation: 'table',
    choreographySlot: participantIndex,
    bubbleLane: slot.bubbleLane,
    socialDistance: 'social',
    pairGesture: currentSpeaker === heroId ? isLeader ? 'present' : 'offer' : 'observe',
    partnerId: currentSpeaker === heroId ? undefined : currentSpeaker,
  };
};

export const choreographDirective = (
  world: WorldState,
  heroId: string,
  base: VisualActorDirective | LifeActorDirective | undefined,
): ChoreographedDirective | undefined => {
  if (!base) return undefined;
  const visualScene = activeVisualSceneOf(world);
  if (visualScene?.participantIds.includes(heroId)) return choreographyForVisualScene(visualScene, heroId, base as VisualActorDirective);
  const lifeScene = activeLifeSceneOf(world);
  if (lifeScene?.participantIds.includes(heroId)) return choreographyForLifeScene(world, lifeScene, heroId, base as LifeActorDirective);
  return base;
};
