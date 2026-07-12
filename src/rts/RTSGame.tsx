import { useEffect, useMemo, useState } from 'react';
import {
  advanceSimulation,
  applyEvent,
  createInitialWorld,
  type EmotionId,
  type EventType,
  type Hero,
  type SimulationEvent,
  type TraitId,
} from '../simulation';
import { CampZone, zones } from './CampZone';
import { RTSActor } from './RTSActor';
import { useRealtimeActors } from './realtime';

const emotionLabels: Record<EmotionId, string> = {
  joy: 'радость', sadness: 'грусть', anxiety: 'тревога', anger: 'гнев', irritation: 'раздражение',
  guilt: 'вина', shame: 'стыд', fear: 'страх', hope: 'надежда', interest: 'интерес',
  loneliness: 'одиночество', inspiration: 'вдохновение', affection: 'привязанность', envy: 'зависть',
};

const traitLabels: Record<TraitId, string> = {
  kindness: 'Доброта', cruelty: 'Жестокость', pride: 'Гордость', friendliness: 'Дружелюбие',
  honesty: 'Честность', patience: 'Терпение', curiosity: 'Любопытство', discipline: 'Дисциплина',
  courage: 'Смелость', caution: 'Осторожность', impulsiveness: 'Импульсивность', empathy: 'Эмпатия',
  independence: 'Самостоятельность', approvalSeeking: 'Потребность в признании', trustfulness: 'Доверчивость',
  vengefulness: 'Мстительность', ambition: 'Амбициозность', loyalty: 'Преданность',
};

const eventLabels: Partial<Record<EventType, string>> = {
  praise: 'Похвалить', helped: 'Помощь товарища', gift: 'Подарить вещь', sharedTask: 'Общее дело',
  argument: 'Спровоцировать ссору', insult: 'Публично отчитать', failure: 'Неудача',
  injury: 'Вернуть с травмой', loss: 'Тяжёлая потеря', rejected: 'Получил отказ',
};

const dominantEmotion = (hero: Hero) => {
  const [id, value] = (Object.entries(hero.emotions) as Array<[EmotionId, number]>).reduce(
    (best, current) => current[1] > best[1] ? current : best,
  );
  return { id, value, label: emotionLabels[id] };
};

const strongestTraits = (hero: Hero) =>
  (Object.entries(hero.traits) as Array<[TraitId, number]>)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5);

const eventIntensity: Record<EventType, number> = {
  praise: 68, insult: 62, helped: 52, rejected: 54, sharedTask: 45,
  argument: 61, gift: 48, failure: 56, injury: 58, loss: 94,
};

export function RTSGame() {
  const initialWorld = useMemo(() => createInitialWorld(), []);
  const [world, setWorld] = useState(initialWorld);
  const [selectedHeroId, setSelectedHeroId] = useState('mira');
  const [running, setRunning] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const actors = useRealtimeActors(world, speedMultiplier);

  const heroes = Object.values(world.heroes);
  const selectedHero = world.heroes[selectedHeroId] ?? heroes[0];
  const mood = dominantEmotion(selectedHero);
  const companions = heroes.filter((hero) => hero.id !== selectedHero.id);
  const primaryOther = companions[0];

  useEffect(() => {
    if (!running) return undefined;
    if (Object.values(world.heroes).every((hero) => !hero.currentAction)) {
      setWorld((current) => advanceSimulation(current, 1));
    }
    const interval = window.setInterval(() => {
      setWorld((current) => advanceSimulation(current, 1));
    }, 6200 / speedMultiplier);
    return () => window.clearInterval(interval);
  }, [running, speedMultiplier]);

  const advanceOneHour = () => setWorld((current) => advanceSimulation(current, 1));

  const triggerEvent = (type: EventType) => {
    const socialSource = ['argument', 'insult', 'helped', 'rejected', 'sharedTask'].includes(type);
    const godSource = type === 'praise' || type === 'gift';
    const actorId = godSource ? world.god.id : socialSource ? primaryOther.id : selectedHero.id;
    const targetId = ['failure', 'injury', 'loss'].includes(type) ? undefined : selectedHero.id;
    const descriptions: Record<EventType, string> = {
      praise: `${world.god.name} похвалил ${selectedHero.name} при всей семье.`,
      insult: `${primaryOther.name} резко унизил ${selectedHero.name} у общего очага.`,
      helped: `${primaryOther.name} заметил трудности и помог ${selectedHero.name}.`,
      rejected: `${primaryOther.name} отказался поддержать просьбу ${selectedHero.name}.`,
      sharedTask: `${selectedHero.name} и ${primaryOther.name} вместе занялись кибиткой.`,
      argument: `${primaryOther.name} и ${selectedHero.name} поссорились из-за обязанностей.`,
      gift: `${world.god.name} подарил ${selectedHero.name} полезную вещь.`,
      failure: `${selectedHero.name} провалил важную самостоятельную попытку.`,
      injury: `${selectedHero.name} вернулся в кибитку с болезненной травмой.`,
      loss: `${selectedHero.name} пережил тяжёлую потерю близкого человека.`,
    };
    const event: SimulationEvent = {
      id: `${world.tick}-${type}-${world.journal.length}`,
      type,
      actorId,
      targetId,
      intensity: eventIntensity[type],
      description: descriptions[type],
      tags: ['camp', type],
    };
    setWorld((current) => applyEvent(current, event));
  };

  const reset = () => {
    setRunning(false);
    setSpeedMultiplier(1);
    setSelectedHeroId('mira');
    setWorld(createInitialWorld());
  };

  return (
    <main className="h-screen overflow-y-auto bg-[#07090d] text-slate-100">
      <div className="mx-auto max-w-[1840px] px-3 pb-24 pt-3 lg:px-5">
        <header className="mb-3 flex flex-col gap-3 rounded-2xl border border-amber-200/10 bg-[#111318]/95 px-4 py-3 shadow-2xl lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-300/70">Семья Астера · живая кибитка</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <h1 className="text-xl font-semibold text-white">RTS-наблюдение в реальном времени</h1>
              <span className="font-mono text-xs text-slate-500">день {Math.floor(world.tick / 8) + 1}, час {(world.tick % 8) + 1}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={advanceOneHour} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10">+1 час</button>
            <button type="button" onClick={() => setWorld((current) => advanceSimulation(current, 8))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10">Прожить день</button>
            <button type="button" onClick={() => setRunning((value) => !value)} className={`rounded-lg border px-4 py-2 text-xs font-semibold ${running ? 'border-rose-300/30 bg-rose-300/10 text-rose-100' : 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100'}`}>{running ? 'Пауза' : 'Запустить'}</button>
            <button type="button" onClick={() => setSpeedMultiplier((value) => value === 1 ? 2 : value === 2 ? 4 : 1)} className="rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 py-2 font-mono text-xs text-amber-100">x{speedMultiplier}</button>
            <button type="button" onClick={reset} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 hover:text-white">Сброс</button>
          </div>
        </header>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="relative min-h-[720px] overflow-hidden rounded-3xl border border-amber-100/10 bg-[#17140f] shadow-2xl" data-testid="rts-map">
            <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
            <div className="absolute inset-[2.5%] rounded-[32px] border-[12px] border-[#342719] bg-[radial-gradient(circle_at_50%_40%,#2d271d_0%,#17140f_68%)] shadow-[inset_0_0_80px_rgba(0,0,0,.75)]" />
            {zones.map((zone) => <CampZone key={zone.id} zone={zone} />)}

            <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {Object.values(actors).map((actor) => {
                if (actor.phase !== 'interacting' || !actor.targetId) return null;
                const target = actors[actor.targetId];
                if (!target) return null;
                return (
                  <line
                    key={`${actor.heroId}-${actor.targetId}`}
                    x1={actor.position.x}
                    y1={actor.position.y}
                    x2={target.position.x}
                    y2={target.position.y}
                    className="rts-interaction-line"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>

            <div className="absolute left-[15%] top-[16%] z-30 -translate-x-1/2 -translate-y-1/2">
              <div className="rts-god-unit">
                <span className="rts-god-halo" />
                <span className="rts-god-head" />
                <span className="rts-god-body" />
              </div>
              <span className="mx-auto mt-1 block w-max rounded-md border border-amber-200/20 bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-amber-100">Астер</span>
            </div>

            {heroes.map((hero) => {
              const actor = actors[hero.id];
              if (!actor) return null;
              return (
                <RTSActor
                  key={hero.id}
                  hero={hero}
                  actor={actor}
                  world={world}
                  selected={selectedHero.id === hero.id}
                  onSelect={() => setSelectedHeroId(hero.id)}
                />
              );
            })}

            {!running && Object.values(world.heroes).every((hero) => !hero.currentAction) && (
              <div className="absolute bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-xl border border-amber-200/20 bg-black/75 px-4 py-3 text-center shadow-xl backdrop-blur">
                <p className="text-xs text-amber-100">Дети ждут начала дня</p>
                <p className="mt-1 text-[10px] text-slate-500">Нажмите «Запустить» или «+1 час» — они сами выберут занятие и пойдут к нему.</p>
              </div>
            )}
          </section>

          <aside className="space-y-3">
            <section className="rounded-2xl border border-white/10 bg-[#111318] p-4 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-amber-300/60">Выбранный ребёнок</p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">{selectedHero.name}</h2>
                  <p className="text-xs text-slate-500">{selectedHero.age} лет · {selectedHero.goals[0]?.label}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-right">
                  <p className="text-[10px] text-slate-500">Доминирует</p>
                  <p className="text-sm font-medium text-amber-100">{mood.label}</p>
                  <p className="font-mono text-xs text-slate-500">{Math.round(mood.value)}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  ['Стресс', selectedHero.psyche.stress],
                  ['Усталость', selectedHero.needs.fatigue],
                  ['Общение', selectedHero.needs.social],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg bg-black/25 p-2">
                    <p className="text-[10px] text-slate-500">{label}</p>
                    <p className="mt-1 font-mono text-sm text-slate-200">{Math.round(Number(value))}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-white/5 bg-black/20 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Действие на карте</p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <p className="text-sm text-white">{selectedHero.currentAction?.label ?? 'Пока осматривается'}</p>
                  <span className="rounded bg-white/5 px-2 py-1 text-[9px] uppercase text-slate-400">{actors[selectedHero.id]?.phase ?? 'idle'}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {selectedHero.currentAction?.reasons.map((reason) => reason.label).join(' · ') || 'Первое решение ещё не принято'}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {strongestTraits(selectedHero).map(([trait, value]) => (
                  <span key={trait} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300">{traitLabels[trait]} {Math.round(value)}</span>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#111318] p-4 shadow-xl">
              <h3 className="text-sm font-semibold text-white">Воздействия на выбранного ребёнка</h3>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">После события характер и состояние пересчитают следующее решение. Персонаж физически отправится выполнять его.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(['praise', 'helped', 'gift', 'sharedTask', 'argument', 'insult', 'injury', 'loss'] as EventType[]).map((type) => (
                  <button key={type} type="button" onClick={() => triggerEvent(type)} className={`rounded-lg border px-2.5 py-2 text-left text-[11px] transition ${type === 'loss' || type === 'insult' ? 'border-rose-300/20 bg-rose-300/5 text-rose-100 hover:bg-rose-300/10' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}>
                    {eventLabels[type]}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#111318] p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Журнал семьи</h3>
                <span className="font-mono text-[10px] text-slate-600">{world.journal.length}</span>
              </div>
              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                {world.journal.slice(0, 18).map((entry) => (
                  <article key={entry.id} className="rounded-lg border border-white/5 bg-black/20 p-2.5">
                    <div className="flex gap-2">
                      <span className="font-mono text-[9px] text-slate-600">{entry.tick.toString().padStart(3, '0')}</span>
                      <p className="text-[11px] leading-4 text-slate-300">{entry.text}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
