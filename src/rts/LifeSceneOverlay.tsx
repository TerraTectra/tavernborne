import { useEffect, useMemo, useState } from 'react';
import {
  activeLifeSceneOf,
  lifeScenePhaseLabel,
  lifeSceneRoleLabel,
  lifeSceneTypeLabel,
  loadWorld,
  type LifeScene,
  type WorldState,
} from '../simulation';

const sceneOf = (world: WorldState | undefined): LifeScene | undefined =>
  world ? activeLifeSceneOf(world) : undefined;

export function LifeSceneOverlay() {
  const [world, setWorld] = useState<WorldState | undefined>(() => loadWorld());

  useEffect(() => {
    const refresh = () => setWorld(loadWorld());
    refresh();
    const interval = window.setInterval(refresh, 240);
    return () => window.clearInterval(interval);
  }, []);

  const scene = useMemo(() => sceneOf(world), [world]);
  if (!world || !scene) return null;

  const visibleDialogue = scene.dialogue.slice(0, scene.currentLineIndex + 1).slice(-5);

  return (
    <section
      className="fixed left-4 top-24 z-[94] w-[min(440px,calc(100vw-2rem))] rounded-2xl border border-violet-200/20 bg-slate-950/94 p-3 text-slate-100 shadow-2xl backdrop-blur"
      data-testid="life-scene-panel"
      data-scene-type={scene.type}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-violet-300/70">Жизнь происходит на карте</p>
          <h2 className="mt-1 text-sm font-semibold text-white">{scene.title}</h2>
          <p className="mt-1 text-[10px] text-slate-400" data-testid="life-scene-phase">
            {lifeScenePhaseLabel(scene.phase)}
          </p>
        </div>
        <span className="rounded-md border border-violet-200/15 bg-violet-300/5 px-2 py-1 text-[9px] text-violet-100">
          {lifeSceneTypeLabel(scene.type)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5" data-testid="life-scene-participants">
        {scene.participantIds.map((heroId) => (
          <span key={heroId} className="rounded-full border border-white/8 bg-black/25 px-2.5 py-1 text-[9px] text-slate-300">
            <span className="font-semibold text-white">{world.heroes[heroId]?.name ?? heroId}</span>
            {' · '}{lifeSceneRoleLabel(scene.roles[heroId] ?? 'member')}
          </span>
        ))}
      </div>

      <div className="mt-3 space-y-1.5" data-testid="life-scene-dialogue">
        {visibleDialogue.map((item, index) => (
          <div key={item.id} className={`rounded-lg border px-2.5 py-2 text-[10px] leading-4 ${index === visibleDialogue.length - 1 ? 'border-violet-200/20 bg-violet-300/8 text-white' : 'border-white/5 bg-black/20 text-slate-400'}`}>
            <span className="mr-1.5 font-semibold text-slate-300">{world.heroes[item.speakerId]?.name ?? item.speakerId}:</span>
            {item.text}
          </div>
        ))}
      </div>
    </section>
  );
}
