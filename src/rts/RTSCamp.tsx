import { useEffect, useMemo, useState } from 'react';
import {
  advanceSimulation,
  applyEvent,
  createInitialWorld,
  type ActionId,
  type EmotionId,
  type EventType,
  type Hero,
  type SimulationEvent,
  type TraitId,
  type WorldState,
} from '../simulation';

type ZoneId = 'altar' | 'hearth' | 'beds' | 'training' | 'library' | 'workshop' | 'quiet' | 'gate';

type Zone = {
  id: ZoneId;
  label: string;
  subtitle: string;
  x: number;
  y: number;
  width: number;
  height: number;
  mark: string;
};

const zones: Zone[] = [
  { id: 'altar', label: 'Место Астера', subtitle: 'совет и благословение', x: 5, y: 7, width: 22, height: 22, mark: 'A' },
  { id: 'hearth', label: 'Общий очаг', subtitle: 'еда и разговоры', x: 34, y: 8, width: 30, height: 24, mark: 'О' },
  { id: 'beds', label: 'Спальные места', subtitle: 'три тесные койки', x: 70, y: 7, width: 24, height: 27, mark: 'Z' },
  { id: 'training', label: 'Тренировочный угол', subtitle: 'соломенная мишень', x: 5, y: 41, width: 27, height: 27, mark: 'X' },
  { id: 'library', label: 'Книжная полка', subtitle: 'старые записи и учебники', x: 38, y: 42, width: 23, height: 22, mark: 'II' },
  { id: 'workshop', label: 'Мастерская', subtitle: 'верстак и инструменты', x: 68, y: 42, width: 27, height: 27, mark: 'W' },
  { id: 'quiet', label: 'Тихий угол', subtitle: 'место побыть одному', x: 8, y: 76, width: 25, height: 17, mark: '·' },
  { id: 'gate', label: 'Выход из кибитки', subtitle: 'работа и внешний мир', x: 66, y: 76, width: 29, height: 17, mark: '→' },
];

const actionZone: Record<ActionId, ZoneId> = {
  eat: 'hearth',
  sleep: 'beds',
  train: 'training',
  read: 'library',
  talk: 'hearth',
  help: 'workshop',
  apologize: 'hearth',
  seekSolitude: 'quiet',
  work: 'workshop',
};

const emotionLabels: Record<EmotionId, string> = {
  joy: 'радость',
  sadness: 'грусть',
  anxiety: 'тревога',
  anger: 'гнев',
  irritation: 'раздражение',
  guilt: 'вина',
  shame: 'стыд',
  fear: 'страх',
  hope: 'надежда',
  interest: 'интерес',
  loneliness: 'одиночество',
  inspiration: 'вдохновение',
  affection: 'привязанность',
  envy: 'зависть',
};

const traitLabels: Record<TraitId, string> = {
  kindness: 'Доброта',
  cruelty: 'Жестокость',
  pride: 'Гордость',
  friendliness: 'Дружелюбие',
  honesty: 'Честность',
  patience: 'Терпение',
  curiosity: 'Любопытство',
  discipline: 'Дисциплина',
  courage: 'Смелость',
  caution: 'Осторожность',
  impulsiveness: 'Импульсивность',
  empathy: 'Эмпатия',
  independence: 'Самостоятельность',
  approvalSeeking: 'Потребность в признании',
  trustfulness: 'Доверчивость',
  vengefulness: 'Мстительность',
  ambition: 'Амбициозность',
  loyalty: 'Преданность',
};

const heroStyles: Record<string, { ring: string; fill: string; shadow: string }> = {
  mira: { ring: 'border-emerald-200/80', fill: 'from-emerald-300 to-teal-600', shadow: 'shadow-emerald-500/30' },
  kael: { ring: 'border-rose-200/80', fill: 'from-rose-300 to-red-700', shadow: 'shadow-rose-500/30' },
  liora: { ring: 'border-sky-200/80', fill: 'from-sky-300 to-indigo-700', shadow: 'shadow-sky-500/30' },
};

const initialPositions: Record<string, { x: number; y: number }> = {
  mira: { x: 43, y: 34 },
  kael: { x: 53, y: 35 },
  liora: { x: 48, y: 39 },
};

const zoneCentres = Object.fromEntries(
  zones.map((zone) => [zone.id, { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 }]),
) as Record<ZoneId, { x: number; y: number }>;

const eventLabels: Record<EventType, string> = {
  praise: 'Похвалить',
  insult: 'Публично отчитать',
  helped: 'Получил помощь',
  rejected: 'Получил отказ',
  sharedTask: 'Общее дело',
  argument: 'Спровоцировать ссору',
  gift: 'Подарить вещь',
  failure: 'Неудача',
  injury: 'Вернуть с травмой',
  loss: 'Тяжёлая потеря',
};

const dominantEmotion = (hero: Hero) => {
  const [emotion, value] = (Object.entries(hero.emotions) as Array<[EmotionId, number]>).reduce(
    (best, current) => (current[1] > best[1] ? current : best),
  );
  return { id: emotion, label: emotionLabels[emotion], value };
};

const topTraits = (hero: Hero) =>
  (Object.entries(hero.traits) as Array<[TraitId, number]>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

const positionForHero = (hero: Hero, index: number) => {
  const fallback = initialPositions[hero.id] ?? { x: 45 + index * 4, y: 37 };
  if (!hero.currentAction) return fallback;
  const centre = zoneCentres[actionZone[hero.currentAction.actionId]];
  const offset = [
    { x: -3.2, y: -1.8 },
    { x: 3.3, y: 1.4 },
    { x: 0.4, y: 3.2 },
    { x: -1.4, y: 2.1 },
    { x: 2.2, y: -2.4 },
  ][index % 5];
  return { x: centre.x + offset.x, y: centre.y + offset.y };
};

const actionThought = (hero: Hero, world: WorldState) => {
  const action = hero.currentAction;
  if (!action) return 'Осматривается и привыкает к новому дому';
  const target = action.targetId ? world.heroes[action.targetId]?.name : undefined;
  const targetText = target ? ` — рядом ${target}` : '';
  return `${action.label}${targetText}`;
};

export function RTSCamp() {
  const initialWorld = useMemo(() => createInitialWorld(), []);
  const [world, setWorld] = useState(initialWorld);
  const [selectedHeroId, setSelectedHeroId] = useState('mira');
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1300);

  useEffect(() => {
    if (!running) return undefined;
    const interval = window.setInterval(() => {
      setWorld((current) => advanceSimulation(current, 1));
    }, speed);
    return () => window.clearInterval(interval);
  }, [running, speed]);

  const heroes = Object.values(world.heroes);
  const selectedHero = world.heroes[selectedHeroId] ?? heroes[0];
  const selectedMood = dominantEmotion(selectedHero);
  const companions = heroes.filter((hero) => hero.id !== selectedHero.id);
  const primaryOther = companions[0];

  const triggerEvent = (type: EventType) => {
    const actorId = type === 'praise' || type === 'gift' ? world.god.id : type === 'argument' || type === 'insult' || type === 'helped' || type === 'rejected' ? primaryOther.id : selectedHero.id;
    const targetId = type === 'failure' || type === 'injury' || type === 'loss' ? undefined : selectedHero.id;
    const intensity: Record<EventType, number> = {
      praise: 68,
      insult: 62,
      helped: 52,
      rejected: 54,
      sharedTask: 45,
      argument: 61,
      gift: 48,
      failure: 56,
      injury: 58,
      loss: 94,
    };
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
      intensity: intensity[type],
      description: descriptions[type],
      tags: ['camp', type],
    };
    setWorld((current) => applyEvent(current, event));
  };

  const reset = () => {
    setRunning(false);
    setWorld(createInitialWorld());
    setSelectedHeroId('mira');
  };

  return (
    <main className="min-h-screen overflow-y-auto bg-[#07090d] text-slate-100">
      <div className="mx-auto max-w-[1800px] px-3 pb-10 pt-3 lg:px-5">
        <header className="mb-3 flex flex-col gap-3 rounded-2xl border border-amber-200/10 bg-[#111318]/95 px-4 py-3 shadow-2xl lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-300/70">Семья Астера · кибитка</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <h1 className="text-xl font-semibold text-white">Наблюдение за семьёй</h1>
              <span className="font-mono text-xs text-slate-500">день {Math.floor(world.tick / 8) + 1}, час {(world.tick % 8) + 1}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setWorld((current) => advanceSimulation(current, 1))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10">+1 час</button>
            <button type="button" onClick={() => setWorld((current) => advanceSimulation(current, 8))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10">Прожить день</button>
            <button type="button" onClick={() => setRunning((value) => !value)} className={`rounded-lg border px-4 py-2 text-xs font-semibold ${running ? 'border-rose-300/30 bg-rose-300/10 text-rose-100' : 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100'}`}>{running ? 'Пауза' : 'Запустить'}</button>
            <button type="button" onClick={() => setSpeed((value) => value === 1300 ? 650 : value === 650 ? 280 : 1300)} className="rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 py-2 font-mono text-xs text-amber-100">x{speed === 1300 ? 1 : speed === 650 ? 2 : 4}</button>
            <button type="button" onClick={reset} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 hover:text-white">Сброс</button>
          </div>
        </header>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_370px]">
          <section className="relative min-h-[690px] overflow-hidden rounded-3xl border border-amber-100/10 bg-[#17140f] shadow-2xl">
            <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
            <div className="absolute inset-[2.5%] rounded-[32px] border-[12px] border-[#342719] bg-[radial-gradient(circle_at_50%_40%,#2d271d_0%,#17140f_68%)] shadow-[inset_0_0_80px_rgba(0,0,0,.75)]" />
            <div className="absolute left-1/2 top-[2.7%] h-4 w-40 -translate-x-1/2 rounded-b-full bg-amber-900/30 blur-sm" />

            {zones.map((zone) => (
              <div
                key={zone.id}
                className="absolute rounded-2xl border border-amber-100/10 bg-black/20 p-3 shadow-[inset_0_0_30px_rgba(0,0,0,.25)]"
                style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-amber-50/85">{zone.label}</p>
                    <p className="mt-1 text-[10px] leading-4 text-stone-500">{zone.subtitle}</p>
                  </div>
                  <span className="grid h-7 min-w-7 place-items-center rounded-lg border border-white/10 bg-white/5 px-1 font-mono text-xs text-amber-200/50">{zone.mark}</span>
                </div>
              </div>
            ))}

            <div className="absolute left-[15%] top-[16%] z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
              <div className="rounded-full border border-amber-200/50 bg-gradient-to-b from-amber-200 to-amber-700 p-[3px] shadow-lg shadow-amber-500/20">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-[#2b2117] text-sm font-bold text-amber-100">А</div>
              </div>
              <span className="mt-1 rounded bg-black/60 px-2 py-0.5 text-[10px] text-amber-100">Астер</span>
            </div>

            {heroes.map((hero, index) => {
              const position = positionForHero(hero, index);
              const style = heroStyles[hero.id] ?? heroStyles.mira;
              const selected = selectedHero.id === hero.id;
              const mood = dominantEmotion(hero);
              return (
                <button
                  key={hero.id}
                  type="button"
                  onClick={() => setSelectedHeroId(hero.id)}
                  className="absolute z-30 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-[left,top] duration-700 ease-in-out"
                  style={{ left: `${position.x}%`, top: `${position.y}%` }}
                >
                  <span className={`max-w-36 truncate rounded-lg border border-white/10 bg-black/75 px-2 py-1 text-[10px] text-slate-200 shadow-lg ${hero.currentAction ? 'opacity-100' : 'opacity-70'}`}>
                    {actionThought(hero, world)}
                  </span>
                  <span className={`mt-1 rounded-full border-2 bg-gradient-to-b p-[3px] shadow-xl ${style.ring} ${style.fill} ${style.shadow} ${selected ? 'scale-110 ring-4 ring-amber-200/25' : ''}`}>
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-[#111318]/80 text-base font-bold text-white">{hero.name.slice(0, 1)}</span>
                  </span>
                  <span className="mt-1 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">{hero.name}</span>
                  <span className="mt-0.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] text-slate-400">{mood.label} {Math.round(mood.value)}</span>
                </button>
              );
            })}

            <div className="absolute bottom-4 left-4 z-40 flex max-w-[70%] flex-wrap gap-2 rounded-xl border border-white/10 bg-black/60 p-2 backdrop-blur">
              {heroes.map((hero) => (
                <button key={hero.id} type="button" onClick={() => setSelectedHeroId(hero.id)} className={`rounded-lg px-3 py-2 text-left text-xs ${selectedHero.id === hero.id ? 'bg-amber-300/15 text-amber-100' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>
                  <span className="font-semibold">{hero.name}</span>
                  <span className="ml-2 text-[10px] text-slate-500">{hero.currentAction?.label ?? 'без дела'}</span>
                </button>
              ))}
            </div>
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
                  <p className="text-sm font-medium text-amber-100">{selectedMood.label}</p>
                  <p className="font-mono text-xs text-slate-500">{Math.round(selectedMood.value)}</p>
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

              <div className="mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Сейчас делает</p>
                <p className="mt-1 text-sm text-white">{selectedHero.currentAction?.label ?? 'Пока осматривается'}</p>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {selectedHero.currentAction?.reasons.map((reason) => reason.label).join(' · ') || 'Первое решение ещё не принято'}
                </p>
              </div>

              <div className="mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Сильные черты</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {topTraits(selectedHero).map(([trait, value]) => (
                    <span key={trait} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300">{traitLabels[trait]} {Math.round(value)}</span>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#111318] p-4 shadow-xl">
              <h3 className="text-sm font-semibold text-white">Воздействия бога и мира</h3>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">Событие применяется к выбранному ребёнку. После него запустите время и наблюдайте за поведением.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(['praise', 'helped', 'gift', 'argument', 'insult', 'failure', 'injury', 'loss'] as EventType[]).map((type) => (
                  <button key={type} type="button" onClick={() => triggerEvent(type)} className={`rounded-lg border px-2.5 py-2 text-left text-[11px] transition ${type === 'loss' || type === 'insult' ? 'border-rose-300/20 bg-rose-300/5 text-rose-100 hover:bg-rose-300/10' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}>
                    {eventLabels[type]}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#111318] p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Последние события</h3>
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
