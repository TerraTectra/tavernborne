import type { CSSProperties } from 'react';
import {
  dungeonExplorationOf,
  type DungeonActorStatus,
  type DungeonExplorationPhase,
  type DungeonRole,
  type DungeonRoomKind,
  type Expedition,
  type WorldState,
} from '../simulation';

interface Props {
  world: WorldState;
  expedition: Expedition;
}

const phaseLabels: Record<DungeonExplorationPhase, string> = {
  entering: 'Вход на этаж',
  scouting: 'Разведка впереди строя',
  choosing: 'Выбор маршрута',
  crossing: 'Преодоление прохода',
  looting: 'Осмотр находки',
  assessing: 'Оценка угрозы',
  returning: 'Возвращение к выходу',
  completed: 'Исследование завершено',
};

const roleLabels: Record<DungeonRole, string> = {
  leader: 'лидер',
  vanguard: 'авангард',
  scout: 'разведчик',
  support: 'поддержка',
};

const statusLabels: Record<DungeonActorStatus, string> = {
  moving: 'идёт в строю',
  scouting: 'разведывает',
  guarding: 'держит позицию',
  searching: 'осматривает',
  warning: 'предупреждает',
  helping: 'помогает',
  returning: 'возвращается',
};

const roomSymbols: Record<DungeonRoomKind, string> = {
  entrance: '⇧',
  hall: '≈',
  fork: '↗',
  trap: '⚠',
  cache: '▣',
  enemy: '◆',
  refuge: '⌂',
};

const roomClass: Record<DungeonRoomKind, string> = {
  entrance: 'dungeon-room-entrance',
  hall: 'dungeon-room-hall',
  fork: 'dungeon-room-fork',
  trap: 'dungeon-room-trap',
  cache: 'dungeon-room-cache',
  enemy: 'dungeon-room-enemy',
  refuge: 'dungeon-room-refuge',
};

const actorClass: Record<DungeonRole, string> = {
  leader: 'dungeon-unit-leader',
  vanguard: 'dungeon-unit-vanguard',
  scout: 'dungeon-unit-scout',
  support: 'dungeon-unit-support',
};

export function DungeonExplorationMap({ world, expedition }: Props) {
  const exploration = dungeonExplorationOf(expedition);
  if (!exploration) {
    return (
      <section className="relative min-h-[720px] overflow-hidden rounded-3xl border border-sky-200/10 bg-[#090d12] shadow-2xl" data-testid="dungeon-rts-map">
        <div className="grid min-h-[720px] place-items-center text-sm text-slate-500">Группа проходит через входной шлюз подземелья…</div>
      </section>
    );
  }

  const roomsById = Object.fromEntries(exploration.rooms.map((room) => [room.id, room]));
  const undiscovered = exploration.rooms.filter((room) => !room.discovered).length;
  const latestDecision = exploration.decisions[0];

  return (
    <section className="dungeon-map-shell relative min-h-[720px] overflow-hidden rounded-3xl border border-sky-200/15 bg-[#070b10] shadow-2xl" data-testid="dungeon-rts-map">
      <div className="dungeon-stone-grid absolute inset-0" />
      <div className="dungeon-vignette absolute inset-0" />

      <header className="absolute left-4 right-4 top-4 z-50 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-sky-200/15 bg-slate-950/88 px-4 py-3 shadow-xl backdrop-blur">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-sky-300/65">Визуальная экспедиция · этаж {expedition.floor}</p>
          <h2 className="mt-1 text-lg font-semibold text-white" data-testid="dungeon-phase">{phaseLabels[exploration.phase]}</h2>
          <p className="mt-1 text-[10px] text-slate-400">
            открыто комнат: {exploration.discoveredRoomIds.length}/{exploration.rooms.length} · строй: {expedition.partyIds.length} человека
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right">
          <div className="rounded-lg border border-white/5 bg-black/25 px-3 py-2">
            <p className="text-[9px] text-slate-500">Туман</p>
            <p className="font-mono text-sm text-sky-100" data-testid="dungeon-fog-count">{undiscovered}</p>
          </div>
          <div className="rounded-lg border border-white/5 bg-black/25 px-3 py-2">
            <p className="text-[9px] text-slate-500">Прогресс</p>
            <p className="font-mono text-sm text-sky-100">{Math.round(expedition.progress)}%</p>
          </div>
        </div>
      </header>

      <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {exploration.corridors.map((corridor) => {
          const from = roomsById[corridor.fromId];
          const to = roomsById[corridor.toId];
          if (!from || !to) return null;
          const revealed = from.discovered && to.discovered;
          return (
            <line
              key={corridor.id}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className={revealed ? 'dungeon-corridor dungeon-corridor-visible' : 'dungeon-corridor dungeon-corridor-hidden'}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        {exploration.routeHistory.slice(0, -1).map((roomId, index) => {
          const from = roomsById[roomId];
          const to = roomsById[exploration.routeHistory[index + 1]];
          if (!from || !to) return null;
          return <line key={`route-${roomId}-${index}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="dungeon-route-line" vectorEffect="non-scaling-stroke" />;
        })}
      </svg>

      <div className="absolute inset-x-0 bottom-0 top-[92px] z-20">
        {exploration.rooms.map((room) => {
          const roomStyle = {
            left: `${room.x}%`,
            top: `${room.y}%`,
            width: `${room.width}%`,
            minHeight: `${Math.max(76, room.height * 6)}px`,
          } as CSSProperties;
          return (
            <div
              key={room.id}
              className={`dungeon-room absolute -translate-x-1/2 -translate-y-1/2 ${roomClass[room.kind]} ${room.discovered ? 'dungeon-room-discovered' : 'dungeon-room-fogged'} ${room.visited ? 'dungeon-room-visited' : ''}`}
              style={roomStyle}
              data-testid={`dungeon-room-${room.id}`}
              data-discovered={room.discovered ? 'true' : 'false'}
              data-visited={room.visited ? 'true' : 'false'}
            >
              {room.discovered ? (
                <>
                  <span className="dungeon-room-symbol" aria-hidden="true">{roomSymbols[room.kind]}</span>
                  <p className="dungeon-room-label">{room.label}</p>
                  <p className="dungeon-room-danger">опасность {room.danger}</p>
                  {room.kind === 'trap' && <span className="dungeon-trap" title="Нажимные плиты"><i /><i /><i /></span>}
                  {room.kind === 'cache' && <span className={`dungeon-chest ${exploration.chestOpened ? 'dungeon-chest-open' : ''}`} title="Старый сундук" />}
                  {room.kind === 'enemy' && exploration.enemySpotted && <span className="dungeon-enemy" title="Спящий страж"><i /></span>}
                </>
              ) : (
                <>
                  <span className="dungeon-fog-swirls" />
                  <span className="dungeon-room-question">?</span>
                </>
              )}
            </div>
          );
        })}

        {Object.values(exploration.actors).map((actor) => {
          const hero = world.heroes[actor.heroId];
          if (!hero) return null;
          return (
            <div
              key={actor.heroId}
              className={`dungeon-party-actor absolute z-40 -translate-x-1/2 -translate-y-1/2 ${actorClass[actor.role]}`}
              style={{ left: `${actor.x}%`, top: `${actor.y}%` }}
              data-testid={`dungeon-party-${actor.heroId}`}
              data-x={actor.x.toFixed(2)}
              data-y={actor.y.toFixed(2)}
              data-role={actor.role}
              data-status={actor.status}
            >
              {actor.bubble && <span className="dungeon-actor-bubble">{actor.bubble}</span>}
              {actor.reaction && <span className="dungeon-actor-reaction">{actor.reaction}</span>}
              <span className="dungeon-unit-shadow" />
              <span className="dungeon-unit-body">
                <span className="dungeon-unit-head" />
                <span className="dungeon-unit-torso" />
                <span className="dungeon-unit-arm dungeon-unit-arm-left" />
                <span className="dungeon-unit-arm dungeon-unit-arm-right" />
                <span className="dungeon-unit-leg dungeon-unit-leg-left" />
                <span className="dungeon-unit-leg dungeon-unit-leg-right" />
                {actor.role === 'scout' && <span className="dungeon-unit-torch" />}
                {actor.role === 'vanguard' && <span className="dungeon-unit-blade" />}
                {actor.role === 'support' && <span className="dungeon-unit-pack" />}
                {actor.role === 'leader' && <span className="dungeon-unit-signal" />}
              </span>
              <span className="dungeon-unit-name">{hero.name}</span>
              <span className="dungeon-unit-role">{roleLabels[actor.role]} · {statusLabels[actor.status]}</span>
            </div>
          );
        })}
      </div>

      <aside className="absolute bottom-4 left-4 z-50 w-[min(440px,calc(100%-2rem))] rounded-2xl border border-amber-200/15 bg-slate-950/90 p-3 shadow-xl backdrop-blur" data-testid="dungeon-route-decision">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-amber-300/65">Решение группы</p>
            <p className="mt-1 text-xs leading-5 text-slate-200">{latestDecision?.text ?? 'Группа только вошла на этаж и проверяет построение.'}</p>
          </div>
          <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[9px] text-slate-400">шаг {exploration.step}/7</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[9px]">
          {exploration.routeChoice && <span className="rounded bg-sky-300/8 px-2 py-1 text-sky-100">маршрут: {exploration.routeChoice === 'short-risky' ? 'короткий рискованный' : 'длинный безопасный'}</span>}
          {exploration.trapDetected !== undefined && <span className="rounded bg-amber-300/8 px-2 py-1 text-amber-100">ловушка: {exploration.trapDetected ? 'обнаружена' : 'задета'}</span>}
          {exploration.chestOpened && <span className="rounded bg-emerald-300/8 px-2 py-1 text-emerald-100">сундук открыт</span>}
          {exploration.enemySpotted && <span className="rounded bg-rose-300/8 px-2 py-1 text-rose-100">враг замечен</span>}
          {exploration.threatDecision && <span className="rounded bg-violet-300/8 px-2 py-1 text-violet-100">решение: {exploration.threatDecision === 'avoid' ? 'обойти' : 'отступить'}</span>}
        </div>
      </aside>
    </section>
  );
}
