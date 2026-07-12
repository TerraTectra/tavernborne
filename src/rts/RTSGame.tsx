import { useEffect, useMemo, useState } from 'react';
import {
  advanceSimulation,
  applyEvent,
  createInitialWorld,
  ensureDailyPlans,
  type EmotionId,
  type EventType,
  type Hero,
  type NeedId,
  type PsycheId,
  type RelationshipId,
  type SimulationEvent,
  type StatId,
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

const statLabels: Record<StatId, string> = {
  strength: 'Сила', endurance: 'Выносливость', dexterity: 'Ловкость', magic: 'Магия', perception: 'Восприятие',
};

const needLabels: Record<NeedId, string> = {
  hunger: 'Голод', fatigue: 'Усталость', safety: 'Безопасность', social: 'Общение', solitude: 'Одиночество',
  recognition: 'Признание', growth: 'Развитие', belonging: 'Принадлежность',
};

const psycheLabels: Record<PsycheId, string> = {
  stress: 'Стресс', confidence: 'Уверенность', security: 'Чувство безопасности', grief: 'Горе',
  burnout: 'Истощение', resilience: 'Устойчивость',
};

const relationshipLabels: Record<RelationshipId, string> = {
  liking: 'Симпатия', trust: 'Доверие', respect: 'Уважение', closeness: 'Близость', fear: 'Страх',
  resentment: 'Обида', envy: 'Зависть', attraction: 'Влечение', debt: 'Чувство долга', rivalry: 'Соперничество',
};

const eventLabels: Partial<Record<EventType, string>> = {
  praise: 'Похвалить', helped: 'Помощь товарища', gift: 'Подарить вещь', sharedTask: 'Общее дело',
  argument: 'Спровоцировать ссору', insult: 'Публично отчитать', failure: 'Неудача',
  injury: 'Вернуть с травмой', loss: 'Тяжёлая потеря', rejected: 'Получил отказ',
};

const eventIntensity: Record<EventType, number> = {
  praise: 68, insult: 62, helped: 52, rejected: 54, sharedTask: 45,
  argument: 61, gift: 48, failure: 56, injury: 58, loss: 94,
};

const dominantEmotion = (hero: Hero) => {
  const [id, value] = (Object.entries(hero.emotions) as Array<[EmotionId, number]>).reduce(
    (best, current) => current[1] > best[1] ? current : best,
  );
  return { id, value, label: emotionLabels[id] };
};

const formatHour = (hour: number) => `${hour.toString().padStart(2, '0')}:00`;
const dayNumber = (tick: number) => Math.floor(tick / 24) + 1;
const hourNumber = (tick: number) => tick % 24;

const statusLabel = (status: string) => ({
  planned: 'запланировано', active: 'сейчас', done: 'выполнено', skipped: 'пропущено', interrupted: 'прервано',
}[status] ?? status);

const expeditionStatus = (status: string) => ({
  planned: 'Готовится', active: 'В подземелье', returning: 'Возвращается', completed: 'Завершён', retreated: 'Отступление',
}[status] ?? status);

function MetricRows({ values, labels }: { values: Record<string, number>; labels: Record<string, string> }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {Object.entries(values).sort((left, right) => right[1] - left[1]).map(([id, value]) => (
        <div key={id} className="rounded-lg border border-white/5 bg-black/20 px-2.5 py-2">
          <div className="flex items-center justify-between text-[10px]"><span className="text-slate-400">{labels[id] ?? id}</span><span className="font-mono text-slate-300">{Math.round(value)}</span></div>
          <div className="mt-1 h-1 overflow-hidden rounded bg-white/5"><div className="h-full rounded bg-amber-200/40" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export function RTSGame() {
  const initialWorld = useMemo(() => {
    const created = createInitialWorld();
    ensureDailyPlans(created);
    return created;
  }, []);
  const [world, setWorld] = useState(initialWorld);
  const [selectedHeroId, setSelectedHeroId] = useState('mira');
  const [running, setRunning] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [showInnerModel, setShowInnerModel] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const actors = useRealtimeActors(world, speedMultiplier);

  const heroes = Object.values(world.heroes);
  const selectedHero = world.heroes[selectedHeroId] ?? heroes[0];
  const mood = dominantEmotion(selectedHero);
  const companions = heroes.filter((hero) => hero.id !== selectedHero.id);
  const primaryOther = companions[0];
  const currentDay = Math.floor(world.tick / 24);
  const currentExpedition = [...world.expeditions]
    .filter((expedition) => expedition.day === currentDay || expedition.status === 'active')
    .sort((left, right) => right.departTick - left.departTick)[0];

  useEffect(() => {
    if (!running) return undefined;
    const interval = window.setInterval(() => {
      setWorld((current) => advanceSimulation(current, 1));
    }, 5200 / speedMultiplier);
    return () => window.clearInterval(interval);
  }, [running, speedMultiplier]);

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
      type, actorId, targetId, intensity: eventIntensity[type], description: descriptions[type], tags: ['camp', type],
    };
    setWorld((current) => applyEvent(current, event));
  };

  const reset = () => {
    const created = createInitialWorld();
    ensureDailyPlans(created);
    setRunning(false);
    setSpeedMultiplier(1);
    setSelectedHeroId('mira');
    setShowInnerModel(false);
    setShowJournal(false);
    setWorld(created);
  };

  return (
    <main className="h-screen overflow-y-auto bg-[#07090d] text-slate-100">
      <div className="mx-auto max-w-[1880px] px-3 pb-24 pt-3 lg:px-5">
        <header className="mb-3 flex flex-col gap-3 rounded-2xl border border-amber-200/10 bg-[#111318]/95 px-4 py-3 shadow-2xl lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-300/70">Семья Астера · распорядок и автономная жизнь</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <h1 className="text-xl font-semibold text-white">Живая кибитка</h1>
              <span className="font-mono text-xs text-slate-500">день {dayNumber(world.tick)} · {formatHour(hourNumber(world.tick))}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setWorld((current) => advanceSimulation(current, 1))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10">+1 час</button>
            <button type="button" onClick={() => setWorld((current) => advanceSimulation(current, 24))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10">Прожить сутки</button>
            <button type="button" onClick={() => setRunning((value) => !value)} className={`rounded-lg border px-4 py-2 text-xs font-semibold ${running ? 'border-rose-300/30 bg-rose-300/10 text-rose-100' : 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100'}`}>{running ? 'Пауза' : 'Запустить'}</button>
            <button type="button" onClick={() => setSpeedMultiplier((value) => value === 1 ? 2 : value === 2 ? 4 : 1)} className="rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 py-2 font-mono text-xs text-amber-100">x{speedMultiplier}</button>
            <button type="button" onClick={reset} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 hover:text-white">Сброс</button>
          </div>
        </header>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-3">
            <section className="relative min-h-[720px] overflow-hidden rounded-3xl border border-amber-100/10 bg-[#17140f] shadow-2xl" data-testid="rts-map">
              <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
              <div className="absolute inset-[2.5%] rounded-[32px] border-[12px] border-[#342719] bg-[radial-gradient(circle_at_50%_40%,#2d271d_0%,#17140f_68%)] shadow-[inset_0_0_80px_rgba(0,0,0,.75)]" />
              {zones.map((zone) => <CampZone key={zone.id} zone={zone} />)}

              <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {Object.values(actors).map((actor) => {
                  if (actor.phase !== 'interacting' || !actor.targetId) return null;
                  const target = actors[actor.targetId];
                  if (!target || target.phase === 'away') return null;
                  return <line key={`${actor.heroId}-${actor.targetId}`} x1={actor.position.x} y1={actor.position.y} x2={target.position.x} y2={target.position.y} className="rts-interaction-line" vectorEffect="non-scaling-stroke" />;
                })}
              </svg>

              <div className="absolute left-[15%] top-[16%] z-30 -translate-x-1/2 -translate-y-1/2">
                <div className="rts-god-unit"><span className="rts-god-halo" /><span className="rts-god-head" /><span className="rts-god-body" /></div>
                <span className="mx-auto mt-1 block w-max rounded-md border border-amber-200/20 bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-amber-100">Астер</span>
              </div>

              {heroes.map((hero) => {
                const actor = actors[hero.id];
                if (!actor) return null;
                return <RTSActor key={hero.id} hero={hero} actor={actor} world={world} selected={selectedHero.id === hero.id} onSelect={() => setSelectedHeroId(hero.id)} />;
              })}

              {currentExpedition && ['active', 'planned'].includes(currentExpedition.status) && (
                <div className="absolute bottom-5 left-5 z-40 rounded-xl border border-sky-300/20 bg-slate-950/85 px-3 py-2 text-xs shadow-xl backdrop-blur">
                  <p className="font-semibold text-sky-100">{expeditionStatus(currentExpedition.status)} · этаж {currentExpedition.floor}</p>
                  <p className="mt-1 text-[10px] text-slate-400">{currentExpedition.partyIds.map((id) => world.heroes[id]?.name).join(', ')}</p>
                </div>
              )}
            </section>

            {currentExpedition && (
              <section className="rounded-2xl border border-sky-300/10 bg-[#10151c] p-4 shadow-xl" data-testid="dungeon-panel">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-sky-300/60">Симуляция подземелья</p>
                    <h2 className="mt-1 text-lg font-semibold text-white">Экспедиция на {currentExpedition.floor}-й этаж</h2>
                    <p className="mt-1 text-xs text-slate-400">{expeditionStatus(currentExpedition.status)} · риск {Math.round(currentExpedition.risk)} · группа: {currentExpedition.partyIds.map((id) => world.heroes[id]?.name).join(', ')}</p>
                  </div>
                  <span className="font-mono text-sm text-sky-100">{Math.round(currentExpedition.progress)}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-sky-300/50 transition-all" style={{ width: `${currentExpedition.progress}%` }} /></div>
                <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_260px]">
                  <div className="space-y-2">
                    {(currentExpedition.events.length ? currentExpedition.events.slice(0, 5) : [{ id: 'waiting', text: 'Группа сверяет снаряжение и ждёт времени выхода.', tick: world.tick }]).map((event) => (
                      <div key={event.id} className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs text-slate-300"><span className="mr-2 font-mono text-[9px] text-slate-600">{formatHour(event.tick % 24)}</span>{event.text}</div>
                    ))}
                  </div>
                  <div className="rounded-lg border border-white/5 bg-black/20 p-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Собранная добыча</p>
                    <div className="mt-2 space-y-1 text-xs text-slate-300">
                      {currentExpedition.loot.length ? currentExpedition.loot.map((item) => <p key={item.id}>{item.name} ×{item.quantity}</p>) : <p className="text-slate-600">Пока ничего</p>}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-3">
            <section className="rounded-2xl border border-white/10 bg-[#111318] p-4 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-amber-300/60">Выбранный ребёнок</p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">{selectedHero.name}</h2>
                  <p className="text-xs text-slate-500">{selectedHero.age} лет · {selectedHero.goals[0]?.label}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-right">
                  <p className="text-[10px] text-slate-500">Настроение</p>
                  <p className="text-sm font-medium text-amber-100">{mood.label}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-black/25 p-2.5"><p className="text-[10px] text-slate-500">Здоровье</p><p className="mt-1 font-mono text-lg text-emerald-200">{Math.round(selectedHero.condition.health)}%</p></div>
                <div className="rounded-lg bg-black/25 p-2.5"><p className="text-[10px] text-slate-500">Энергия</p><p className="mt-1 font-mono text-lg text-sky-200">{Math.round(100 - selectedHero.needs.fatigue)}%</p></div>
              </div>

              <div className="mt-3 rounded-xl border border-white/5 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Текущее дело</p><span className="rounded bg-white/5 px-2 py-1 text-[9px] uppercase text-slate-400">{actors[selectedHero.id]?.phase ?? 'idle'}</span></div>
                <p className="mt-1 text-sm text-white">{selectedHero.currentActivity?.label ?? 'Свободное время'}</p>
                {selectedHero.currentActivity && <p className="mt-1 text-[10px] text-slate-500">Осталось примерно {selectedHero.currentActivity.remainingHours} ч.</p>}
              </div>

              <div className="mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Характеристики</p>
                <div className="mt-2 grid grid-cols-5 gap-1.5">
                  {(Object.entries(selectedHero.stats) as Array<[StatId, number]>).map(([id, value]) => (
                    <div key={id} className="rounded-lg border border-white/5 bg-black/20 p-2 text-center"><p className="text-[9px] text-slate-500">{statLabels[id]}</p><p className="mt-1 font-mono text-sm text-white">{Math.round(value)}</p></div>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Инвентарь</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedHero.inventory.map((item) => <span key={item.id} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300">{item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ''}</span>)}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#111318] p-4 shadow-xl" data-testid="day-plan">
              <div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[0.2em] text-amber-300/60">План дня</p><h3 className="mt-1 text-sm font-semibold text-white">Не приказ, а намерение</h3></div><span className="font-mono text-[10px] text-slate-600">24 часа</span></div>
              <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-1">
                {selectedHero.dailyPlan.filter((item) => item.day === currentDay).map((item) => (
                  <div key={item.id} className={`rounded-lg border px-2.5 py-2 ${item.status === 'active' ? 'border-amber-300/30 bg-amber-300/10' : item.status === 'interrupted' || item.status === 'skipped' ? 'border-rose-300/10 bg-rose-300/5' : 'border-white/5 bg-black/20'}`}>
                    <div className="flex items-center justify-between gap-2"><p className="text-[11px] text-slate-200">{item.label}</p><span className="font-mono text-[9px] text-slate-500">{formatHour(item.startHour)}–{formatHour(item.endHour)}</span></div>
                    <p className="mt-1 text-[9px] text-slate-600">{statusLabel(item.status)}{item.reason ? ` · ${item.reason}` : ''}</p>
                  </div>
                ))}
              </div>
            </section>

            <button type="button" onClick={() => setShowInnerModel((value) => !value)} className="w-full rounded-xl border border-violet-300/20 bg-violet-300/5 px-4 py-3 text-left text-sm font-semibold text-violet-100 hover:bg-violet-300/10">
              {showInnerModel ? 'Скрыть внутреннюю модель' : 'Открыть внутреннюю модель и события'}
            </button>

            {showInnerModel && (
              <section className="space-y-4 rounded-2xl border border-violet-300/15 bg-[#111318] p-4 shadow-xl" data-testid="inner-model">
                <div><h3 className="text-sm font-semibold text-white">Все эмоции</h3><div className="mt-2"><MetricRows values={selectedHero.emotions} labels={emotionLabels} /></div></div>
                <div><h3 className="text-sm font-semibold text-white">Черты личности</h3><div className="mt-2"><MetricRows values={selectedHero.traits} labels={traitLabels} /></div></div>
                <div><h3 className="text-sm font-semibold text-white">Потребности</h3><div className="mt-2"><MetricRows values={selectedHero.needs} labels={needLabels} /></div></div>
                <div><h3 className="text-sm font-semibold text-white">Психика</h3><div className="mt-2"><MetricRows values={selectedHero.psyche} labels={psycheLabels} /></div></div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Отношения</h3>
                  <div className="mt-2 space-y-2">{Object.entries(selectedHero.relationships).map(([targetId, relation]) => <div key={targetId} className="rounded-lg border border-white/5 bg-black/20 p-2.5"><p className="text-xs font-semibold text-slate-300">{targetId === 'god' ? world.god.name : world.heroes[targetId]?.name ?? targetId}</p><p className="mt-1 text-[10px] leading-4 text-slate-500">{(Object.entries(relation.values) as Array<[RelationshipId, number]>).filter(([, value]) => Math.abs(value) >= 8).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 5).map(([id, value]) => `${relationshipLabels[id]} ${Math.round(value)}`).join(' · ') || 'Связь пока не сформировалась'}</p></div>)}</div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Воспоминания</h3>
                  <div className="mt-2 space-y-2">{selectedHero.memories.length ? selectedHero.memories.slice(0, 8).map((memory) => <div key={memory.id} className="rounded-lg border border-white/5 bg-black/20 p-2.5 text-[11px] text-slate-300">{memory.summary}<p className="mt-1 font-mono text-[9px] text-slate-600">важность {Math.round(memory.importance)} · окраска {Math.round(memory.valence)}</p></div>) : <p className="text-xs text-slate-600">Сильных воспоминаний пока нет.</p>}</div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Испытательные события</h3>
                  <div className="mt-2 grid grid-cols-2 gap-2">{(['praise', 'helped', 'gift', 'sharedTask', 'argument', 'insult', 'injury', 'loss'] as EventType[]).map((type) => <button key={type} type="button" onClick={() => triggerEvent(type)} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-left text-[11px] text-slate-300 hover:bg-white/10">{eventLabels[type]}</button>)}</div>
                </div>
              </section>
            )}

            <button type="button" onClick={() => setShowJournal((value) => !value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-semibold text-slate-200 hover:bg-white/10">{showJournal ? 'Скрыть журнал событий' : 'Показать журнал событий'}</button>
            {showJournal && (
              <section className="rounded-2xl border border-white/10 bg-[#111318] p-4 shadow-xl" data-testid="journal-panel">
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">{world.journal.slice(0, 28).map((entry) => <article key={entry.id} className="rounded-lg border border-white/5 bg-black/20 p-2.5"><div className="flex gap-2"><span className="font-mono text-[9px] text-slate-600">{formatHour(entry.tick % 24)}</span><p className="text-[11px] leading-4 text-slate-300">{entry.text}</p></div></article>)}</div>
              </section>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
