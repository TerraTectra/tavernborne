import { useEffect, useState } from 'react';
import {
  loadWorld,
  movementAvailabilityLabels,
  movementFamilyLabels,
  physicalBodySummary,
  type WorldState,
} from '../simulation';

const metric = (label: string, value: string | number) => (
  <div className="rounded-lg border border-white/5 bg-black/25 px-2 py-1.5">
    <p className="text-[8px] uppercase tracking-wide text-slate-600">{label}</p>
    <p className="mt-0.5 font-mono text-[10px] text-slate-200">{value}</p>
  </div>
);

const aptitudeClass = (availability: string) => {
  if (availability === 'natural') return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100';
  if (availability === 'difficult') return 'border-amber-300/20 bg-amber-300/10 text-amber-100';
  return 'border-rose-300/20 bg-rose-300/10 text-rose-100';
};

export function PhysicalBodyOverlay() {
  const [world, setWorld] = useState<WorldState | undefined>(() => loadWorld());
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const refresh = () => setWorld(loadWorld());
    refresh();
    const interval = window.setInterval(refresh, 650);
    return () => window.clearInterval(interval);
  }, []);

  if (!world) return null;
  const heroes = Object.values(world.heroes);

  return (
    <section
      className="fixed bottom-20 left-4 z-[92] w-[min(390px,calc(100vw-2rem))] rounded-2xl border border-emerald-200/15 bg-slate-950/92 p-3 text-slate-100 shadow-2xl backdrop-blur"
      data-testid="physical-body-panel"
    >
      <button type="button" onClick={() => setExpanded((value) => !value)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-emerald-300/65">Телесная симуляция</p>
            <h2 className="mt-1 text-sm font-semibold text-white">Тело формирует собственное мастерство</h2>
            <p className="mt-1 text-[10px] text-slate-500">{heroes.length} тела · природная совместимость · память движений</p>
          </div>
          <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[9px] text-slate-400">
            {expanded ? 'свернуть' : 'тела'}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 max-h-[58vh] space-y-2 overflow-y-auto pr-1" data-testid="physical-body-details">
          {heroes.map((hero) => {
            const summary = physicalBodySummary(hero);
            const successRate = summary.motorAttempts
              ? Math.round(summary.motorSuccesses / summary.motorAttempts * 100)
              : 0;
            return (
              <article key={hero.id} className="rounded-xl border border-white/8 bg-black/25 p-3" data-testid={`body-card-${hero.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-white">{hero.name}</p>
                    <p className="mt-0.5 text-[9px] text-slate-500">{Object.keys(hero.body.segments).length} сегментов · {Object.keys(hero.body.joints).length} суставов</p>
                  </div>
                  <span className="rounded bg-emerald-300/10 px-2 py-1 text-[9px] text-emerald-100">{summary.pose}</span>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {metric('Рост', `${summary.heightCm} см`)}
                  {metric('Масса', `${summary.massKg.toFixed(1)} кг`)}
                  {metric('Мышцы', `${summary.muscleMassKg.toFixed(1)} кг`)}
                  {metric('Опора', summary.supportFoot)}
                  {metric('Тонус', Math.round(summary.muscleTone))}
                  {metric('Усталость', Math.round(summary.fatigue))}
                  {metric('Баланс', Math.round(summary.balance))}
                  {metric('Реакция', `${Math.round(summary.reactionTimeMs)} мс`)}
                </div>
                <p className="mt-2 text-[9px] leading-4 text-slate-500">
                  устойчивость {Math.round(summary.stability)} · координация {Math.round(summary.coordination)}
                  {summary.painfulSegments.length ? ` · боль: ${summary.painfulSegments.join(', ')}` : ' · болезненных зон нет'}
                </p>

                <div className="mt-3" data-testid={`body-affinities-${hero.id}`}>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-600">Природная совместимость</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {summary.affinities.map((affinity) => (
                      <span
                        key={affinity.family}
                        className={`rounded-md border px-2 py-1 text-[8px] ${aptitudeClass(affinity.availability)}`}
                        data-testid={`body-affinity-${hero.id}-${affinity.family}`}
                        data-aptitude={affinity.aptitude.toFixed(2)}
                        data-learning-rate={affinity.learningRate.toFixed(3)}
                        data-mastery-ceiling={affinity.masteryCeiling.toFixed(2)}
                        data-availability={affinity.availability}
                      >
                        {movementFamilyLabels[affinity.family]} {Math.round(affinity.aptitude)} · {movementAvailabilityLabels[affinity.availability]}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-sky-300/10 bg-sky-300/5 p-2" data-testid={`motor-memory-${hero.id}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-sky-200/70">Память движений</p>
                    <span className="font-mono text-[8px] text-sky-100/70">{summary.motorSuccesses}/{summary.motorAttempts} · {successRate}%</span>
                  </div>
                  {summary.motorPatterns.length ? (
                    <div className="mt-1.5 space-y-1">
                      {summary.motorPatterns.map((pattern) => (
                        <div key={pattern.id} className="rounded border border-white/5 bg-black/20 px-2 py-1.5" data-testid={`motor-pattern-${hero.id}-${pattern.id}`}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[9px] text-slate-200">{pattern.name}</p>
                            <span className="font-mono text-[8px] text-sky-200">мастерство {pattern.mastery.toFixed(1)}</span>
                          </div>
                          <p className="mt-0.5 text-[8px] text-slate-600">повторы {pattern.repetitions} · успех {Math.round(pattern.reliability)}% · эффективность {Math.round(pattern.efficiency)}%</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1.5 text-[8px] text-slate-600">Устойчивые двигательные схемы ещё не сформировались.</p>
                  )}
                  {summary.motorSchools.length > 0 && (
                    <div className="mt-2 border-t border-white/5 pt-2" data-testid={`motor-schools-${hero.id}`}>
                      {summary.motorSchools.map((school) => (
                        <p key={school.id} className="text-[8px] leading-4 text-emerald-100">{school.name} · зрелость {Math.round(school.maturity)}</p>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
