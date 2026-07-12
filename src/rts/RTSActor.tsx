import type { CSSProperties } from 'react';
import type { Hero, WorldState } from '../simulation';
import type { RuntimeActor } from './realtime';

type Props = {
  hero: Hero;
  actor: RuntimeActor;
  world: WorldState;
  selected: boolean;
  onSelect: () => void;
};

const palettes: Record<string, { cloth: string; trim: string; hair: string; skin: string }> = {
  mira: { cloth: '#2f8f72', trim: '#9be3c9', hair: '#5a3425', skin: '#e9b98f' },
  kael: { cloth: '#9f3f46', trim: '#f0a0a7', hair: '#251b19', skin: '#d9a17d' },
  liora: { cloth: '#4e68b8', trim: '#b8c8ff', hair: '#d7c6a0', skin: '#edc39d' },
};

const actionProp = (actor: RuntimeActor) => {
  if (actor.sceneProp === 'map') return <span className="rts-prop rts-map-scroll" aria-hidden="true" />;
  if (actor.sceneProp === 'pack') return <span className="rts-prop rts-backpack" aria-hidden="true" />;
  if (actor.sceneProp === 'weapon') return <span className="rts-prop rts-sword" aria-hidden="true" />;

  switch (actor.actionId) {
    case 'read':
      return <span className="rts-prop rts-book" aria-hidden="true" />;
    case 'train':
      return <span className="rts-prop rts-sword" aria-hidden="true" />;
    case 'work':
    case 'help':
      return <span className="rts-prop rts-hammer" aria-hidden="true" />;
    case 'eat':
      return <span className="rts-prop rts-bowl" aria-hidden="true" />;
    case 'recover':
      return <span className="rts-prop rts-bandage" aria-hidden="true" />;
    default:
      return null;
  }
};

export function RTSActor({ hero, actor, world, selected, onSelect }: Props) {
  const palette = palettes[hero.id] ?? palettes.mira;
  const targetName = actor.targetId ? world.heroes[actor.targetId]?.name : undefined;
  const facingScale = actor.facing === 'left' ? -1 : 1;
  const style = {
    '--cloth': palette.cloth,
    '--trim': palette.trim,
    '--hair': palette.hair,
    '--skin': palette.skin,
    '--facing-scale': facingScale,
  } as CSSProperties;

  if (actor.phase === 'away') {
    return (
      <button
        type="button"
        data-testid={`actor-${hero.id}`}
        data-x={actor.position.x.toFixed(2)}
        data-y={actor.position.y.toFixed(2)}
        data-phase="away"
        data-action={actor.actionId ?? 'dungeon'}
        data-scene={actor.sceneId ?? ''}
        onClick={onSelect}
        className="hidden"
        aria-label={`${hero.name}: в подземелье`}
      />
    );
  }

  return (
    <button
      type="button"
      data-testid={`actor-${hero.id}`}
      data-x={actor.position.x.toFixed(2)}
      data-y={actor.position.y.toFixed(2)}
      data-phase={actor.phase}
      data-action={actor.actionId ?? 'idle'}
      data-scene={actor.sceneId ?? ''}
      data-gesture={actor.gesture ?? ''}
      onClick={onSelect}
      className="absolute z-30 -translate-x-1/2 -translate-y-1/2 text-left outline-none"
      style={{ left: `${actor.position.x}%`, top: `${actor.position.y}%` }}
      aria-label={`${hero.name}: ${actor.bubble ?? hero.currentAction?.label ?? 'бездействует'}`}
    >
      {actor.bubble && actor.phase !== 'moving' && (
        <span className="absolute bottom-[78px] left-1/2 w-max max-w-56 -translate-x-1/2 rounded-lg border border-white/10 bg-black/90 px-2.5 py-1.5 text-[10px] leading-4 text-slate-100 shadow-xl" data-testid={`actor-bubble-${hero.id}`}>
          {actor.bubble}{targetName && !actor.sceneId ? ` — ${targetName}` : ''}
        </span>
      )}

      {actor.roleLabel && (
        <span className="absolute -right-7 -top-3 z-20 rounded-full border border-sky-200/25 bg-slate-950/90 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-sky-100 shadow-lg" data-testid={`actor-role-${hero.id}`}>
          {actor.roleLabel}
        </span>
      )}

      {actor.reaction && (
        <span className="rts-scene-reaction" data-testid={`actor-reaction-${hero.id}`}>{actor.reaction}</span>
      )}

      <span
        className={`rts-unit block ${selected ? 'rts-unit-selected' : ''}`}
        data-phase={actor.phase}
        data-action={actor.actionId ?? 'idle'}
        data-gesture={actor.gesture ?? ''}
        style={style}
      >
        <span className="rts-shadow" />
        <span className="rts-body-wrap">
          <span className="rts-head"><span className="rts-hair" /></span>
          <span className="rts-torso" />
          <span className="rts-arm rts-arm-left" />
          <span className="rts-arm rts-arm-right">{actionProp(actor)}</span>
          <span className="rts-leg rts-leg-left" />
          <span className="rts-leg rts-leg-right" />
          {actor.phase === 'sleeping' && <span className="rts-zzz">Z</span>}
          {actor.phase === 'interacting' && !actor.sceneId && <span className="rts-talk-dots">•••</span>}
        </span>
      </span>

      <span className={`mx-auto mt-1 block w-max rounded-md border px-2 py-0.5 text-[10px] font-semibold shadow-lg ${selected ? 'border-amber-200/40 bg-amber-950/85 text-amber-100' : 'border-white/10 bg-black/70 text-white'}`}>
        {hero.name}
      </span>
    </button>
  );
}
