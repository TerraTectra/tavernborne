import { useEffect, useRef, useState } from 'react';
import {
  visualDirectiveForHero,
  type ActionId,
  type Hero,
  type VisualGesture,
  type VisualProp,
  type WorldState,
} from '../simulation';

export type Point = { x: number; y: number };
export type Facing = 'left' | 'right' | 'up' | 'down';
export type ActorPhase = 'idle' | 'moving' | 'acting' | 'interacting' | 'sleeping' | 'away';

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
}

const initialPositions: Record<string, Point> = {
  mira: { x: 44, y: 35 },
  kael: { x: 54, y: 35 },
  liora: { x: 49, y: 41 },
};

const fixedDestinations: Record<Exclude<ActionId, 'talk' | 'help' | 'apologize'>, Point[]> = {
  eat: [{ x: 45, y: 24 }, { x: 49, y: 23 }, { x: 53, y: 25 }],
  sleep: [{ x: 77, y: 19 }, { x: 84, y: 19 }, { x: 89, y: 19 }],
  train: [{ x: 17, y: 54 }, { x: 22, y: 58 }, { x: 14, y: 61 }],
  read: [{ x: 46, y: 55 }, { x: 51, y: 53 }, { x: 55, y: 57 }],
  seekSolitude: [{ x: 17, y: 84 }, { x: 23, y: 85 }, { x: 28, y: 82 }],
  work: [{ x: 77, y: 55 }, { x: 84, y: 58 }, { x: 89, y: 53 }],
  recover: [{ x: 77, y: 22 }, { x: 84, y: 22 }, { x: 89, y: 22 }],
  dungeon: [{ x: 78, y: 85 }, { x: 84, y: 85 }, { x: 90, y: 85 }],
};

const bubbleLabels: Record<ActionId, string> = {
  eat: 'Пора собраться за столом',
  sleep: 'Отбой',
  train: 'Ещё один подход',
  read: 'Нужно разобраться',
  talk: 'Надо поговорить',
  help: 'Я помогу',
  apologize: 'Нужно всё исправить',
  seekSolitude: 'Хочу немного тишины',
  work: 'Пора заняться делом',
  dungeon: 'Выдвигаемся',
  recover: 'Нужно прийти в себя',
};

const socialActions = new Set<ActionId>(['talk', 'help', 'apologize']);
const distance = (left: Point, right: Point) => Math.hypot(right.x - left.x, right.y - left.y);

const routeFor = (from: Point, destination: Point): Point[] => {
  const route: Point[] = [];
  const fromLower = from.y > 70;
  const destinationLower = destination.y > 70;
  const crossesLowerBoundary = fromLower !== destinationLower;
  const crossesSides = (from.x < 35 && destination.x > 65) || (from.x > 65 && destination.x < 35);

  if (crossesSides || (!fromLower && !destinationLower && Math.abs(from.x - destination.x) > 30)) {
    route.push({ x: 50, y: 37 });
  }
  if (crossesLowerBoundary) {
    route.push({ x: 50, y: 72 });
  } else if (fromLower && destinationLower && Math.abs(from.x - destination.x) > 24) {
    route.push({ x: 50, y: 78 });
  }
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

const actionDestination = (
  hero: Hero,
  actorIndex: number,
  actors: Record<string, RuntimeActor>,
): Point => {
  const fallback = initialPositions[hero.id] ?? { x: 48 + actorIndex * 3, y: 39 };
  const action = hero.currentAction;
  if (!action) return fallback;

  if (socialActions.has(action.actionId) && action.targetId) {
    const target = actors[action.targetId];
    if (target && target.phase !== 'away') {
      const offset = actorIndex % 2 === 0 ? -3.3 : 3.3;
      return { x: target.position.x + offset, y: target.position.y + 0.8 };
    }
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

const clearScenePresentation = (actor: RuntimeActor): void => {
  actor.sceneId = undefined;
  actor.gesture = undefined;
  actor.roleLabel = undefined;
  actor.reaction = undefined;
  actor.sceneProp = undefined;
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
          }]),
        ) as Record<string, RuntimeActor>;
        const currentWorld = worldRef.current;
        const heroes = Object.values(currentWorld.heroes);

        heroes.forEach((hero, index) => {
          const actor = next[hero.id] ?? createRuntime(currentWorld)[hero.id];
          next[hero.id] = actor;
          const directive = visualDirectiveForHero(currentWorld, hero.id);

          if (directive) {
            const key = `scene:${directive.sceneId}:${currentWorld.tick}:${directive.gesture}:${hero.id}`;
            actor.sceneId = directive.sceneId;
            actor.gesture = directive.gesture;
            actor.roleLabel = directive.roleLabel;
            actor.reaction = directive.reaction;
            actor.sceneProp = directive.prop;
            actor.actionId = directive.actionId;
            actor.targetId = directive.targetId;
            actor.bubble = directive.bubble;

            if (actor.actionKey !== key) {
              actor.actionKey = key;
              actor.route = routeFor(actor.position, directive.position);
              actor.phase = 'moving';
            }

            const waypoint = actor.route[0];
            if (!waypoint) {
              actor.phase = directive.phase;
              if (directive.targetId) {
                const target = next[directive.targetId];
                if (target) actor.facing = facingFor(actor.position, target.position);
              }
              return;
            }

            const remaining = distance(actor.position, waypoint);
            if (remaining < 0.7) {
              actor.position = { ...waypoint };
              actor.route.shift();
              actor.phase = actor.route.length ? 'moving' : directive.phase;
              return;
            }

            actor.phase = 'moving';
            actor.facing = facingFor(actor.position, waypoint);
            const unitsPerSecond = 8.5 * Math.max(0.7, speedRef.current);
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

          if (actor.actionKey !== key) {
            actor.actionKey = key;
            actor.actionId = action.actionId;
            actor.targetId = action.targetId;
            actor.bubble = bubbleLabels[action.actionId];
            actor.route = routeFor(actor.position, destination);
            actor.phase = 'moving';
          } else if (dynamicSocialTarget && actor.phase === 'moving') {
            actor.route = [destination];
          }

          const waypoint = actor.route[0];
          if (!waypoint) {
            actor.phase = actionPhase(action.actionId);
            return;
          }

          const remaining = distance(actor.position, waypoint);
          if (remaining < 0.7) {
            actor.position = { ...waypoint };
            actor.route.shift();
            actor.phase = actor.route.length ? 'moving' : actionPhase(action.actionId);
            return;
          }

          actor.phase = 'moving';
          actor.facing = facingFor(actor.position, waypoint);
          const unitsPerSecond = 8.5 * Math.max(0.7, speedRef.current);
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
