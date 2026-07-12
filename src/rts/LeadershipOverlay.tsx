import { useEffect, useMemo, useState } from 'react';
import {
  leadershipStateOf,
  loadWorld,
  type LeadershipBond,
  type LeadershipFeelings,
  type LeadershipPersonState,
  type WorldState,
} from '../simulation';

const feelingLabels: Record<keyof LeadershipFeelings, string> = {
  responsibility: 'Ответственность',
  pressure: 'Давление',
  pride: 'Гордость за роль',
  fearOfFailure: 'Страх провала',
  ambition: 'Лидерские амбиции',
  burden: 'Тяжесть власти',
};

const bondLabels: Record<keyof Omit<LeadershipBond, 'targetId'>, string> = {
  authority: 'Признание власти',
  obedience: 'Готовность подчиняться',
  politicalLoyalty: 'Лояльность лидеру',
  confidence: 'Вера в компетентность',
  grievance: 'Претензии и обиды',
  groupBond: 'Связь с группой',
};

const roleLabels: Record<LeadershipPersonState['role'], string> = {
  leader: 'лидер',
  deputy: 'заместитель',
  follower: 'член группы',
  challenger: 'претендент',
  independent: 'вне группы',
};

const bar = (value: number, danger = false) => (
  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
    <div
      className={`h-full rounded-full ${danger ? 'bg-rose-300/55' : 'bg-amber-200/55'}`}
      style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
    />
  </div>
);

export function LeadershipOverlay() {
  const [world, setWorld] = useState<WorldState | undefined>(() => loadWorld());
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const refresh = () => setWorld(loadWorld());
    refresh();
    const interval = window.setInterval(refresh, 650);
    return () => window.clearInterval(interval);
  }, []);

  const leadership = useMemo(() => world ? leadershipStateOf(world) : undefined, [world]);
  if (!world || !leadership) return null;

  const familyLeader = leadership.familyLeaderId ? world.heroes[leadership.familyLeaderId] : undefined;
  const primaryGroup = leadership.groups.find((group) => group.leaderId === leadership.familyLeaderId)
    ?? leadership.groups[0];
  const challengers = Object.values(leadership.people).filter((person) => person.role === 'challenger');

  return (
    <section
      className="fixed right-4 top-24 z-[90] w-[min(380px,calc(100vw-2rem))] rounded-2xl border border-amber-200/15 bg-slate-950/92 p-3 text-slate-100 shadow-2xl backdrop-blur"
      data-testid="leadership-panel"
    >
      <button type="button" onClick={() => setExpanded((value) => !value)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-amber-300/60">Структура семьи</p>
            <h2 className="mt-1 text-sm font-semibold text-white">
              {familyLeader ? `${familyLeader.name} — лидер семьи` : 'Лидер ещё не признан'}
            </h2>
            <p className="mt-1 text-[10px] text-slate-500">
              групп: {leadership.groups.length} · {challengers.length ? `претендентов: ${challengers.length}` : 'власть пока не оспаривается'}
            </p>
          </div>
          <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[9px] text-slate-400">
            {expanded ? 'свернуть' : 'подробнее'}
          </span>
        </div>
      </button>

      {primaryGroup && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-white/5 bg-black/25 p-2">
            <div className="flex justify-between text-[9px] text-slate-500"><span>Легитимность</span><span>{Math.round(primaryGroup.legitimacy)}</span></div>
            {bar(primaryGroup.legitimacy, primaryGroup.legitimacy < 35)}
          </div>
          <div className="rounded-lg border border-white/5 bg-black/25 p-2">
            <div className="flex justify-between text-[9px] text-slate-500"><span>Сплочённость</span><span>{Math.round(primaryGroup.cohesion)}</span></div>
            {bar(primaryGroup.cohesion, primaryGroup.cohesion < 35)}
          </div>
        </div>
      )}

      {expanded && (
        <div className="mt-3 max-h-[64vh] space-y-3 overflow-y-auto pr-1" data-testid="leadership-details">
          {leadership.groups.map((group) => {
            const leader = world.heroes[group.leaderId];
            const leaderState = leadership.people[group.leaderId];
            return (
              <article key={group.id} className="rounded-xl border border-white/8 bg-black/25 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-white">{group.name}</p>
                    <p className="text-[10px] text-slate-500">лидер: {leader?.name ?? group.leaderId} · членов: {group.memberIds.length}</p>
                  </div>
                  {group.formedBy === 'split' && <span className="rounded bg-rose-300/10 px-2 py-1 text-[9px] text-rose-200">раскол</span>}
                </div>

                {leaderState && (
                  <div className="mt-3">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">Состояние лидера</p>
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      {(Object.entries(leaderState.feelings) as Array<[keyof LeadershipFeelings, number]>).map(([id, value]) => (
                        <div key={id} className="rounded-lg border border-white/5 bg-white/[0.025] p-2">
                          <div className="flex justify-between text-[9px] text-slate-500"><span>{feelingLabels[id]}</span><span>{Math.round(value)}</span></div>
                          {bar(value, id === 'pressure' || id === 'fearOfFailure' || id === 'burden')}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 space-y-1.5">
                  {group.memberIds.map((memberId) => {
                    const member = world.heroes[memberId];
                    const person = leadership.people[memberId];
                    const bond = person?.bonds[group.leaderId];
                    return (
                      <div key={memberId} className="rounded-lg border border-white/5 bg-black/20 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-semibold text-slate-200">{member?.name ?? memberId}</p>
                          <span className={`text-[9px] ${person?.role === 'challenger' ? 'text-rose-200' : 'text-slate-500'}`}>{person ? roleLabels[person.role] : 'неизвестно'}</span>
                        </div>
                        {bond && memberId !== group.leaderId && (
                          <p className="mt-1 text-[9px] leading-4 text-slate-500">
                            {(Object.entries(bond) as Array<[keyof LeadershipBond, string | number]>)
                              .filter(([id]) => id !== 'targetId')
                              .map(([id, value]) => `${bondLabels[id as keyof Omit<LeadershipBond, 'targetId'>]} ${Math.round(Number(value))}`)
                              .join(' · ')}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}

          <div className="rounded-xl border border-white/8 bg-black/25 p-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">Последние события власти</p>
            <div className="mt-2 space-y-2">
              {leadership.history.slice(0, 6).map((entry) => (
                <p key={entry.id} className="text-[10px] leading-4 text-slate-300">{entry.text}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
