import { useEffect, useRef, useState } from 'react';
import {
  emotionalPerformanceForHero,
  visualDirectiveForHero,
  type ActionId,
  type ChoreographyDistance,
  type ChoreographyFormation,
  type ChoreographyGesture,
  type DialogueCadence,
  type DialogueLength,
  type DialoguePerformanceId,
  type DialogueTone,
  type EmotionalPerformanceId,
  type EmotionalPerformanceMetadata,
  type Hero,
  type VisualGesture,
  type VisualProp,
  type WorldState,
} from '../simulation';

export type Point = { x: number; y: number };
export type Facing = 'left' | 'right' | 'up' | 'down';
export type ActorPhase = 'idle' | 'moving' | 'acting' | 'interacting' | 'sleeping' | 'away';

type RuntimeDirective = NonNullable<ReturnType<typeof visualDirectiveForHero>>;

export interface RuntimeActor {
  heroId: string;
  position: Point;
  facing: Facing;
  phase: ActorPhase;
  actionId?: ActionId;
  targetId?: string;
  actionKey: string;
  route: Point[];
  bubble?: string;
  sceneId?: string;
  gesture?: VisualGesture;
  roleLabel?: string;
  reaction?: string;
  sceneProp?: VisualProp;
  focusPoint?: Point;
  formation?: ChoreographyFormation;
  choreographySlot?: number;
  bubbleLane?: number;
  socialDistance?: ChoreographyDistance;
  pairGesture?: ChoreographyGesture;
  partnerId?: string;
  emotionalPerformance?: EmotionalPerformanceId;
  emotionalIntensity?: number;
  movementRate?: number;
  animationRate?: number;
  bodyLean?: number;
  bodyTension?: number;
  expressionSymbol?: string;
  expressionColor?: string;
  dialoguePerformance?: DialoguePerformanceId;
  dialogueLength?: DialogueLength;
  dialogueCadence?: DialogueCadence;
  dialogueTone?: DialogueTone;
  dialogueWordCount?: number;
  dialogueIsSpeaker?: boolean;
  dialogueOriginalText?: string;
  dialogueMemoryId?: string;
  dialogueMemoryReference?: string;
  dialoguePartnerId?: string;
  dialogueReason?: string;
  dialogueColor?: string;
}

const initialPositions: Record<string, Point> = {
  mira: { x: 44, y: 35 },
  kael: { x: 54, y: 35 },
  liora: { x: 49, y: 41 },
};

const fixedDestinations: Record<Exclude<ActionId, 'talk' | 'help' | 'apologize'>, Point[]> = {
  eat: [{ x: 45, y: 24 }, { x: 49, y: 23 }, { x: 53, y: 25 }],
  sleep: [{ x: 72.7, y: 20.2 }, { x: 78.3, y: 21.8 }, { x: 84, y: 20.2 }],
  train: [{ x: 17, y: 54 }, { x: 22, y: 58 }, { x: 14, y: 61 }],
  read: [{ x: 46, y: 55 }, { x: 51, y: 53 }, { x: 55, y: 57 }],
  seekSolitude: [{ x: 17, y: 84 }, { x: 23, y: 85 }, { x: 28, y: 82 }],
  work: [{ x: 77, y: 55 }, { x: 84, y: 58 }, { x: 89, y: 53 }],
  recover: [{ x: 72.7, y: 20.2 }, { x: 78.3, y: 21.8 }, { x: 84, y: 20.2 }],
  dungeon: [{ x: 78, y: 85 }, { x: 84, y: 85 }, { x: 90, y: 85 }],
};

const bubbleLabels: Record<ActionId, string> = {
  eat: 'Пора собраться за столом',
  sleep: 'Отбой',
  train: 'Ещё один подход',
  read: 'Нужно разобраться',
  talk: 'Как ты?',
  help: 'Я помогу',
  apologize: 'Нужно всё исправить',
  seekSolitude: 'Хочу немного тишины',
  work: 'Пора заняться делом',
  dungeon: 'Выдвигаемся',
  recover: 'Нужно прийти в себя',
};

const socialActions = new Set<ActionId>(['talk', 'help', 'apologize']);
const actionMovementRate = (actionId: ActionId | undefined): number => {
  if (actionId === 'recover' || actionId === 'sleep') return 0.62;
  if (actionId === 'seekSolitude' || actionId === 'read') return 0.78;
  if (actionId === 'dungeon') return 0.84;
  if (actionId === 'work' || actionId === 'help') return 0.9;
  if (actionId === 'train') return 1.06;
  return 1;
};
const distance = (left: Point, right: Point) => Math.hypot(right.x - left.x, right.y - left.y);

const routeFor = (from: Point, destination: Point): Point[] => {
  const route: Point[] = [];
  const fromLower = from.y > 70;
  const destinationLower = destination.y > 70;
  const crossesLowerBoundary = fromLower !== destinationLower;
  const crossesSides = (from.x < 35 && destination.x > 65) || (from.x > 65 && destination.x < 35);

  if (crossesSides || (!fromLower && !destinationLower && Math.abs(from.x - destination.x) > 30)) route.push({ x: 50, y: 37 });
  if (crossesLowerBoundary) route.push({ x: 50, y: 72 });
  else if (fromLower && destinationLower && Math.abs(from.x - destination.x) > 24) route.push({ x: 50, y: 78 });
  route.push(destination);

  return route.filter((point, index) => index === 0 || distance(point, route[index - 1]) > 1);
};

const facingFor = (from: Point, to: Point): Facing => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
};

const actionPhase = (actionId: ActionId): ActorPhase => {
  if (actionId === 'sleep') return 'sleeping';
  if (actionId === 'dungeon') return 'away';
  if (socialActions.has(actionId)) return 'interacting';
  return 'acting';
};

const reciprocalSocialDestination = (hero: Hero, actor: RuntimeActor, target: RuntimeActor): Point | undefined => {
  if (!target.actionId || !socialActions.has(target.actionId) || target.targetId !== hero.id) return undefined;
  const ids = [hero.id, target.heroId].sort();
  const sign = ids[0] === hero.id ? -1 : 1;
  const anchor = { x: (actor.position.x + target.position.x) / 2, y: (actor.position.y + target.position.y) / 2 };
  const dx = target.position.x - actor.position.x;
  const dy = target.position.y - actor.position.y;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const halfSpacing = 3.7;
  return horizontal
    ? { x: anchor.x + sign * halfSpacing, y: anchor.y }
    : { x: anchor.x, y: anchor.y + sign * halfSpacing };
};

const oneSidedSocialDestination = (hero: Hero, actor: RuntimeActor, target: RuntimeActor): Point => {
  const dx = actor.position.x - target.position.x;
  const dy = actor.position.y - target.position.y;
  const length = Math.hypot(dx, dy);
  const fallbackSign = hero.id.localeCompare(target.heroId) <= 0 ? -1 : 1;
  const nx = length > 0.01 ? dx / length : fallbackSign;
  const ny = length > 0.01 ? dy / length : 0;
  const side = hero.id.localeCompare(target.heroId) <= 0 ? -0.55 : 0.55;
  return { x: target.position.x + nx * 4.1 - ny * side, y: target.position.y + ny * 4.1 + nx * side };
};

const actionDestination = (hero: Hero, actorIndex: number, actors: Record<string, RuntimeActor>): Point => {
  const fallback = initialPositions[hero.id] ?? { x: 48 + actorIndex * 3, y: 39 };
  const action = hero.currentAction;
  if (!action) return fallback;

  if (socialActions.has(action.actionId) && action.targetId) {
    const actor = actors[hero.id];
    const target = actors[action.targetId];
    if (actor && target && target.phase !== 'away') return reciprocalSocialDestination(hero, actor, target) ?? oneSidedSocialDestination(hero, actor, target);
  }

  const destinations = fixedDestinations[action.actionId as keyof typeof fixedDestinations];
  return destinations?.[actorIndex % destinations.length] ?? fallback;
};

const createRuntime = (world: WorldState): Record<string, RuntimeActor> =>
  Object.values(world.heroes).reduce<Record<string, RuntimeActor>>((result, hero, index) => {
    result[hero.id] = {
      heroId: hero.id,
      position: initialPositions[hero.id] ?? { x: 45 + index * 4, y: 38 },
      facing: 'down',
      phase: 'idle',
      actionKey: 'idle',
      route: [],
    };
    return result;
  }, {});

const applyEmotionalPerformance = (actor: RuntimeActor, performance: EmotionalPerformanceMetadata): void => {
  actor.emotionalPerformance = performance.emotionalPerformance;
  actor.emotionalIntensity = performance.emotionalIntensity;
  actor.movementRate = performance.movementRate;
  actor.animationRate = performance.animationRate;
  actor.bodyLean = performance.bodyLean;
  actor.bodyTension = performance.bodyTension;
  actor.expressionSymbol = performance.expressionSymbol;
  actor.expressionColor = performance.expressionColor;
};

const clearDialoguePresentation = (actor: RuntimeActor): void => {
  actor.dialoguePerformance = undefined;
  actor.dialogueLength = undefined;
  actor.dialogueCadence = undefined;
  actor.dialogueTone = undefined;
  actor.dialogueWordCount = undefined;
  actor.dialogueIsSpeaker = undefined;
  actor.dialogueOriginalText = undefined;
  actor.dialogueMemoryId = undefined;
  actor.dialogueMemoryReference = undefined;
  actor.dialoguePartnerId = undefined;
  actor.dialogueReason = undefined;
  actor.dialogueColor = undefined;
};

const clearScenePresentation = (actor: RuntimeActor): void => {
  actor.sceneId = undefined;
  actor.gesture = undefined;
  actor.roleLabel = undefined;
  actor.reaction = undefined;
  actor.sceneProp = undefined;
  actor.focusPoint = undefined;
  actor.formation = undefined;
  actor.choreographySlot = undefined;
  actor.bubbleLane = undefined;
  actor.socialDistance = undefined;
  actor.pairGesture = undefined;
  actor.partnerId = undefined;
  clearDialoguePresentation(actor);
};

const applyDirectivePresentation = (actor: RuntimeActor, directive: RuntimeDirective): void => {
  actor.sceneId = directive.sceneId;
  actor.gesture = directive.gesture;
  actor.roleLabel = directive.roleLabel;
  actor.reaction = directive.reaction;
  actor.sceneProp = directive.prop;
  actor.actionId = directive.actionId;
  actor.targetId = directive.targetId;
  actor.bubble = directive.bubble;
  actor.focusPoint = directive.focusPoint ? { ...directive.focusPoint } : undefined;
  actor.formation = directive.formation;
  actor.choreographySlot = directive.choreographySlot;
  actor.bubbleLane = directive.bubbleLane;
  actor.socialDistance = directive.socialDistance;
  actor.pairGesture = directive.pairGesture;
  actor.partnerId = directive.partnerId;
  actor.dialoguePerformance = directive.dialoguePerformance;
  actor.dialogueLength = directive.dialogueLength;
  actor.dialogueCadence = directive.dialogueCadence;
  actor.dialogueTone = directive.dialogueTone;
  actor.dialogueWordCount = directive.dialogueWordCount;
  actor.dialogueIsSpeaker = directive.dialogueIsSpeaker;
  actor.dialogueOriginalText = directive.dialogueOriginalText;
  actor.dialogueMemoryId = directive.dialogueMemoryId;
  actor.dialogueMemoryReference = directive.dialogueMemoryReference;
  actor.dialoguePartnerId = directive.dialoguePartnerId;
  actor.dialogueReason = directive.dialogueReason;
  actor.dialogueColor = directive.dialogueColor;
  applyEmotionalPerformance(actor, directive);
};

const faceDirectiveFocus = (actor: RuntimeActor, directive: RuntimeDirective, actors: Record<string, RuntimeActor>): void => {
  if (directive.focusPoint && distance(actor.position, directive.focusPoint) > 0.05) {
    actor.facing = facingFor(actor.position, directive.focusPoint);
    return;
  }
  const targetId = directive.partnerId ?? directive.targetId;
  if (!targetId) return;
  const target = actors[targetId];
  if (target && target.phase !== 'away' && distance(actor.position, target.position) > 0.05) actor.facing = facingFor(actor.position, target.position);
};

const directiveKey = (directive: RuntimeDirective, heroId: string): string => [
  'scene', directive.sceneId, heroId, directive.position.x.toFixed(2), directive.position.y.toFixed(2),
  directive.formation ?? 'none', directive.choreographySlot ?? -1, directive.gesture,
  directive.pairGesture ?? 'none', directive.emotionalPerformance, directive.dialoguePerformance,
].join(':');

const genericPairGesture = (actionId: ActionId): ChoreographyGesture => {
  if (actionId === 'help') return 'offer';
  if (actionId === 'apologize') return 'appeal';
  return 'offer';
};

export const useRealtimeActors = (world: WorldState, speedMultiplier: number) => {
  const worldRef = useRef(world);
  const speedRef = useRef(speedMultiplier);
  const [actors, setActors] = useState<Record<string, RuntimeActor>>(() => createRuntime(world));

  useEffect(() => { worldRef.current = world; }, [world]);
  useEffect(() => { speedRef.current = speedMultiplier; }, [speedMultiplier]);

  useEffect(() => {
    let previous = performance.now();
    let frame = 0;

    const update = (now: number) => {
      const dt = Math.min(0.5, Math.max(0, (now - previous) / 1000));
      previous = now;

      setActors((current) => {
        const next = Object.fromEntries(
          Object.entries(current).map(([id, actor]) => [id, {
            ...actor,
            position: { ...actor.position },
            route: actor.route.map((point) => ({ ...point })),
            focusPoint: actor.focusPoint ? { ...actor.focusPoint } : undefined,
          }]),
        ) as Record<string, RuntimeActor>;
        const currentWorld = worldRef.current;
        const heroes = Object.values(currentWorld.heroes);

        heroes.forEach((hero, index) => {
          const actor = next[hero.id] ?? createRuntime(currentWorld)[hero.id];
          next[hero.id] = actor;
          applyEmotionalPerformance(actor, emotionalPerformanceForHero(currentWorld, hero.id));
          const directive = visualDirectiveForHero(currentWorld, hero.id);

          if (directive) {
            const key = directiveKey(directive, hero.id);
            applyDirectivePresentation(actor, directive);

            if (actor.actionKey !== key) {
              actor.actionKey = key;
              actor.route = routeFor(actor.position, directive.position);
              actor.phase = 'moving';
            }

            const waypoint = actor.route[0];
            if (!waypoint) {
              actor.phase = directive.phase;
              faceDirectiveFocus(actor, directive, next);
              return;
            }

            const remaining = distance(actor.position, waypoint);
            if (remaining < 0.7) {
              actor.position = { ...waypoint };
              actor.route.shift();
              actor.phase = actor.route.length ? 'moving' : directive.phase;
              if (!actor.route.length) faceDirectiveFocus(actor, directive, next);
              return;
            }

            actor.phase = 'moving';
            actor.facing = facingFor(actor.position, waypoint);
            const unitsPerSecond = 8.5 * Math.max(0.7, speedRef.current) * (actor.movementRate ?? 1) * actionMovementRate(directive.actionId);
            const step = Math.min(remaining, unitsPerSecond * dt);
            actor.position.x += ((waypoint.x - actor.position.x) / remaining) * step;
            actor.position.y += ((waypoint.y - actor.position.y) / remaining) * step;
            return;
          }

          clearScenePresentation(actor);
          const action = hero.currentAction;
          if (!action) {
            actor.phase = 'idle';
            actor.actionId = undefined;
            actor.targetId = undefined;
            actor.bubble = undefined;
            actor.route = [];
            actor.actionKey = 'idle';
            return;
          }

          const activityStartedAt = hero.currentActivity?.startedAt ?? currentWorld.tick;
          const key = `${activityStartedAt}:${action.actionId}:${action.targetId ?? ''}`;
          const destination = actionDestination(hero, index, next);
          const dynamicSocialTarget = socialActions.has(action.actionId) && Boolean(action.targetId);

          if (dynamicSocialTarget) {
            actor.formation = 'pair';
            actor.socialDistance = 'personal';
            actor.pairGesture = genericPairGesture(action.actionId);
            actor.partnerId = action.targetId;
            actor.bubbleLane = index % 2 === 0 ? -1 : 1;
          }

          if (actor.actionKey !== key) {
            actor.actionKey = key;
            actor.actionId = action.actionId;
            actor.targetId = action.targetId;
            actor.bubble = bubbleLabels[action.actionId];
            actor.route = routeFor(actor.position, destination);
            actor.phase = 'moving';
          } else if (dynamicSocialTarget && actor.phase === 'moving') {
            const routeEnd = actor.route.at(-1);
            if (!routeEnd || distance(routeEnd, destination) > 0.8) actor.route = routeFor(actor.position, destination);
          }

          const waypoint = actor.route[0];
          if (!waypoint) {
            actor.phase = actionPhase(action.actionId);
            const target = action.targetId ? next[action.targetId] : undefined;
            if (target && target.phase !== 'away') actor.facing = facingFor(actor.position, target.position);
            return;
          }

          const remaining = distance(actor.position, waypoint);
          if (remaining < 0.7) {
            actor.position = { ...waypoint };
            actor.route.shift();
            actor.phase = actor.route.length ? 'moving' : actionPhase(action.actionId);
            if (!actor.route.length && action.targetId) {
              const target = next[action.targetId];
              if (target && target.phase !== 'away') actor.facing = facingFor(actor.position, target.position);
            }
            return;
          }

          actor.phase = 'moving';
          actor.facing = facingFor(actor.position, waypoint);
          const unitsPerSecond = 8.5 * Math.max(0.7, speedRef.current) * (actor.movementRate ?? 1) * actionMovementRate(action.actionId);
          const step = Math.min(remaining, unitsPerSecond * dt);
          actor.position.x += ((waypoint.x - actor.position.x) / remaining) * step;
          actor.position.y += ((waypoint.y - actor.position.y) / remaining) * step;
        });

        return next;
      });

      frame = requestAnimationFrame(update);
    };

    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, []);

  return actors;
};
