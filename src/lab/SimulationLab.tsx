import { useMemo, useState } from 'react';
import {
  advanceSimulation,
  applyEvent,
  createInitialWorld,
  evaluateActions,
  type EventType,
  type SimulationEvent,
} from '../simulation';
import { PersonalityGraph } from './PersonalityGraph';

const eventTitles: Record<EventType, string> = {
  praise: 'Похвала бога',
  insult: 'Оскорбление',
  helped: 'Помощь товарища',
  rejected: 'Отказ',
  sharedTask: 'Совместная работа',
  argument: 'Ссора',
  gift: 'Подарок',
  failure: 'Неудача',
  injury: 'Травма',
  loss: 'Тяжёлая потеря',
};

const eventStyles: Partial<Record<EventType, string>> = {
  praise: 'border-emerald-300/30 bg-emerald-300/10 hover:bg-emerald-300/20',
  helped: 'border-sky-300/30 bg-sky-300/10 hover:bg-sky-300/20',
  sharedTask: 'border-violet-300/30 bg-violet-300/10 hover:bg-violet-300/20',
  argument: 'border-orange-300/30 bg-orange-300/10 hover:bg-orange-300/20',
  insult: 'border-rose-300/30 bg-rose-300/10 hover:bg-rose-300/20',
  loss: 'border-red-500/30 bg-red-500/10 hover:bg-red-500/20',
};

export function SimulationLab() {
  const initialWorld = useMemo(() => createInitialWorld(), []);
  const [world, setWorld] = useState(initialWorld);
  const [selectedHeroId, setSelectedHeroId] = useState('mira');

  const selectedHero = world.heroes[selectedHeroId] ?? Object.values(world.heroes)[0];
  const otherHeroes = Object.values(world.heroes).filter((hero) => hero.id !== selectedHero.id);
  const primaryOther = otherHeroes[0];
  const secondaryOther = otherHeroes[1] ?? primaryOther;
  const actionPreview = evaluateActions(selectedHero, world).slice(0, 4);

  const triggerEvent = (
    type: EventType,
    actorId: string,
    targetId: string | undefined,
    intensity: number,
    description: string,
    tags: string[] = [],
  ) => {
    const event: SimulationEvent = {
      id: `${world.tick}-${type}-${world.journal.length}`,
      type,
      actorId,
      targetId,
      intensity,
      description,
      tags,
    };
    setWorld((current) => applyEvent(current, event));
  };

  const eventButtons: Array<{ type: EventType; run: () => void }> = [
    {
      type: 'praise',
      run: () => triggerEvent(
        'praise',
        world.god.id,
        selectedHero.id,
        70,
        `${world.god.name} публично похвалил ${selectedHero.name}.`,
        ['god', 'recognition'],
      ),
    },
    {
      type: 'helped',
      run: () => triggerEvent(
        'helped',
        primaryOther.id,
        selectedHero.id,
        55,
        `${primaryOther.name} помог ${selectedHero.name} закончить тяжёлую работу.`,
        ['family', 'support'],
      ),
    },
    {
      type: 'sharedTask',
      run: () => triggerEvent(
        'sharedTask',
        selectedHero.id,
        primaryOther.id,
        45,
        `${selectedHero.name} и ${primaryOther.name} вместе приводили кибитку в порядок.`,
        ['home', 'cooperation'],
      ),
    },
    {
      type: 'argument',
      run: () => triggerEvent(
        'argument',
        primaryOther.id,
        selectedHero.id,
        60,
        `${primaryOther.name} и ${selectedHero.name} поссорились из-за распределения обязанностей.`,
        ['home', 'conflict'],
      ),
    },
    {
      type: 'insult',
      run: () => triggerEvent(
        'insult',
        primaryOther.id,
        selectedHero.id,
        65,
        `${primaryOther.name} унизил ${selectedHero.name} при остальных детях.`,
        ['public', 'conflict'],
      ),
    },
    {
      type: 'failure',
      run: () => triggerEvent(
        'failure',
        selectedHero.id,
        undefined,
        55,
        `${selectedHero.name} провалил важную самостоятельную тренировку.`,
        ['training', 'self'],
      ),
    },
    {
      type: 'injury',
      run: () => triggerEvent(
        'injury',
        selectedHero.id,
        undefined,
        50,
        `${selectedHero.name} получил болезненную травму во время работы.`,
        ['pain', 'work'],
      ),
    },
    {
      type: 'loss',
      run: () => triggerEvent(
        'loss',
        selectedHero.id,
        undefined,
        95,
        `${selectedHero.name} пережил потерю дорогого человека.`,
        ['grief', 'trauma', secondaryOther.id],
      ),
    },
  ];

  return (
    <main className="h-screen overflow-y-auto bg-[#07080d] text-slate-100">
      <div className="mx-auto max-w-[1700px] space-y-6 px-4 pb-16 pt-5 lg:px-8">
        <header className="flex flex-col gap-5 rounded-3xl border border-white/10 bg-white/[0.035] p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-amber-300">
              <span>Кибитка семьи</span>
              <span className="text-slate-600">•</span>
              <span>Час {world.tick}</span>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Лаборатория личности</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              События меняют память, эмоции, психику и отношения. Эти состояния пересчитывают решения,
              а решения создают новые последствия. Все коэффициенты пока открыты для наблюдения и настройки.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setWorld((current) => advanceSimulation(current, 1))}
              className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-2.5 text-sm font-medium text-amber-100 transition hover:bg-amber-300/20"
            >
              Следующий час
            </button>
            <button
              type="button"
              onClick={() => setWorld((current) => advanceSimulation(current, 8))}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10"
            >
              Прожить день
            </button>
            <button
              type="button"
              onClick={() => setWorld(createInitialWorld())}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"
            >
              Сбросить
            </button>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          {Object.values(world.heroes).map((hero) => {
            const active = hero.id === selectedHero.id;
            return (
              <button
                key={hero.id}
                type="button"
                onClick={() => setSelectedHeroId(hero.id)}
                className={`rounded-2xl border p-4 text-left transition ${
                  active
                    ? 'border-amber-300/40 bg-amber-300/10 shadow-lg shadow-amber-950/20'
                    : 'border-white/10 bg-white/[0.035] hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-white">{hero.name}</p>
                    <p className="text-xs text-slate-500">{hero.age} лет</p>
                  </div>
                  <span className="rounded-full bg-black/25 px-2.5 py-1 text-xs text-slate-300">
                    {hero.currentAction?.label ?? 'Осматривается'}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-black/20 p-2">
                    <p className="text-slate-500">Стресс</p>
                    <p className="mt-1 font-mono text-slate-200">{Math.round(hero.psyche.stress)}</p>
                  </div>
                  <div className="rounded-lg bg-black/20 p-2">
                    <p className="text-slate-500">Радость</p>
                    <p className="mt-1 font-mono text-slate-200">{Math.round(hero.emotions.joy)}</p>
                  </div>
                  <div className="rounded-lg bg-black/20 p-2">
                    <p className="text-slate-500">Память</p>
                    <p className="mt-1 font-mono text-slate-200">{hero.memories.length}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </section>

        <PersonalityGraph hero={selectedHero} world={world} />

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-white">Испытательные события</h2>
              <p className="mt-1 text-sm text-slate-500">
                Событие применяется к выбранному ребёнку. Реакция зависит от его текущего состояния и сочетания черт.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {eventButtons.map(({ type, run }) => (
                <button
                  key={type}
                  type="button"
                  onClick={run}
                  className={`rounded-xl border px-3 py-3 text-left text-sm text-slate-200 transition ${
                    eventStyles[type] ?? 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  {eventTitles[type]}
                </button>
              ))}
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                Что ребёнок рассматривает сейчас
              </h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {actionPreview.map((action, index) => (
                  <div key={action.actionId} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-200">{index + 1}. {action.label}</span>
                      <span className="font-mono text-xs text-amber-200">{action.score.toFixed(1)}</span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {action.reasons.map((reason) => reason.label).join(' · ') || 'Нет сильного мотива'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Журнал семьи</h2>
                <p className="mt-1 text-sm text-slate-500">Последствия и самостоятельные решения.</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>{world.god.name}</p>
                <p>{world.god.title}</p>
              </div>
            </div>
            <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {world.journal.map((entry) => (
                <article key={entry.id} className="rounded-xl border border-white/5 bg-black/20 p-3">
                  <div className="flex gap-3">
                    <span className="mt-0.5 font-mono text-[11px] text-slate-600">{entry.tick.toString().padStart(3, '0')}</span>
                    <p className="text-sm leading-5 text-slate-300">{entry.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
