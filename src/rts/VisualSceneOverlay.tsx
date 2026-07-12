import { useEffect, useMemo, useState } from 'react';
import {
  activeVisualSceneOf,
  councilResponseLabel,
  expeditionRoleLabel,
  loadWorld,
  visualPhaseLabel,
  type VisualScene,
  type WorldState,
} from '../simulation';

const sceneOf = (world: WorldState | undefined): VisualScene | undefined =>
  world ? activeVisualSceneOf(world) : undefined;

export function VisualSceneOverlay() {
  const [world, setWorld] = useState<WorldState | undefined>(() => loadWorld());

  useEffect(() => {
    const refresh = () => setWorld(loadWorld());
    refresh();
    const interval = window.setInterval(refresh, 260);
    return () => window.clearInterval(interval);
  }, []);

  const scene = useMemo(() => sceneOf(world), [world]);
  if (!world || !scene) return null;

  const leader = world.heroes[scene.leaderId];
  const visibleDialogue = scene.dialogue.slice(0, scene.currentLineIndex + 1).slice(-5);

  return (
    <section
      className="fixed left-4 top-24 z-[95] w-[min(430px,calc(100vw-2rem))] rounded-2xl border border-sky-200/20 bg-slate-950/94 p-3 text-slate-100 shadow-2xl backdrop-blur"
      data-testid="visual-scene-panel"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-sky-300/70">Событие происходит на карте</p>
          <h2 className="mt-1 text-sm font-semibold text-white">{scene.title}</h2>
          <p className="mt-1 text-[10px] text-slate-400" data-testid="visual-scene-phase">
            {visualPhaseLabel(scene.phase)} · ведёт {leader?.name ?? scene.leaderId}
          </p>
        </div>
        <span className="rounded-md border border-sky-200/15 bg-sky-300/5 px-2 py-1 font-mono text-[9px] text-sky-100">
          {scene.partyIds.length} в походе
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5" data-testid="visual-scene-roles">
        {scene.partyIds.map((heroId) => {
          const hero = world.heroes[heroId];
          const role = scene.roles[heroId];
          const response = scene.responses[heroId];
          return (
            <div key={heroId} className="rounded-lg border border-white/5 bg-black/25 px-2.5 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold text-white">{hero?.name ?? heroId}</p>
                <span className={`text-[9px] ${response === 'questioned' ? 'text-amber-200' : response === 'refused' ? 'text-rose-200' : 'text-emerald-200'}`}>
                  {councilResponseLabel(response)}
                </span>
              </div>
              <p className="mt-1 text-[9px] text-sky-200/75">{expeditionRoleLabel(role)}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-3 space-y-1.5" data-testid="visual-scene-dialogue">
        {visibleDialogue.map((item, index) => (
          <div key={item.id} className={`rounded-lg border px-2.5 py-2 text-[10px] leading-4 ${index === visibleDialogue.length - 1 ? 'border-sky-200/20 bg-sky-300/8 text-white' : 'border-white/5 bg-black/20 text-slate-400'}`}>
            <span className="mr-1.5 font-semibold text-slate-300">{world.heroes[item.speakerId]?.name ?? item.speakerId}:</span>
            {item.text}
          </div>
        ))}
      </div>
    </section>
  );
}
