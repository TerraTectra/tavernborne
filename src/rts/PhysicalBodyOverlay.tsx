import { useEffect, useMemo, useState } from 'react';
import {
  buildProceduralMotion,
  getProceduralMotion,
  loadWorld,
  movementAvailabilityLabels,
  movementFamilyLabels,
  physicalBodySummary,
  proceduralMotionPhaseLabels,
  sampleProceduralMotion,
  saveWorld,
  synchronizeProceduralMotionWorld,
  type Hero,
  type JointId,
  type ProceduralMotionFrame,
  type ProceduralMotionState,
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

interface Point {
  x: number;
  y: number;
}

const endpoint = (origin: Point, length: number, angleDeg: number): Point => {
  const angle = angleDeg * Math.PI / 180;
  return {
    x: origin.x + Math.sin(angle) * length,
    y: origin.y + Math.cos(angle) * length,
  };
};

const jointAngle = (frame: ProceduralMotionFrame, id: JointId): number => frame.jointTargets[id] ?? 0;

const skeletonPoints = (frame: ProceduralMotionFrame) => {
  const hip: Point = { x: 90 + frame.centerOfMass.x * 90, y: 82 - (frame.centerOfMass.y - 0.5) * 42 };
  const shoulder: Point = endpoint(hip, 34, 180 + jointAngle(frame, 'spine') * 0.55);
  const neck = endpoint(shoulder, 8, 180 + jointAngle(frame, 'neck') * 0.35);
  const head = endpoint(neck, 10, 180);
  const leftShoulder: Point = { x: shoulder.x - 10, y: shoulder.y + 2 };
  const rightShoulder: Point = { x: shoulder.x + 10, y: shoulder.y + 2 };
  const leftElbow = endpoint(leftShoulder, 24, 180 + jointAngle(frame, 'leftShoulder') * 0.72);
  const rightElbow = endpoint(rightShoulder, 24, 180 + jointAngle(frame, 'rightShoulder') * 0.72);
  const leftHand = endpoint(leftElbow, 21, 180 + (jointAngle(frame, 'leftShoulder') - jointAngle(frame, 'leftElbow')) * 0.62);
  const rightHand = endpoint(rightElbow, 21, 180 + (jointAngle(frame, 'rightShoulder') - jointAngle(frame, 'rightElbow')) * 0.62);
  const leftHip: Point = { x: hip.x - 7, y: hip.y };
  const rightHip: Point = { x: hip.x + 7, y: hip.y };
  const leftKnee = endpoint(leftHip, 29, jointAngle(frame, 'leftHip') * 0.7);
  const rightKnee = endpoint(rightHip, 29, jointAngle(frame, 'rightHip') * 0.7);
  const leftFoot = endpoint(leftKnee, 27, (jointAngle(frame, 'leftHip') - jointAngle(frame, 'leftKnee')) * 0.55);
  const rightFoot = endpoint(rightKnee, 27, (jointAngle(frame, 'rightHip') - jointAngle(frame, 'rightKnee')) * 0.55);
  return {
    hip, shoulder, neck, head,
    leftShoulder, rightShoulder, leftElbow, rightElbow, leftHand, rightHand,
    leftHip, rightHip, leftKnee, rightKnee, leftFoot, rightFoot,
  };
};

const line = (key: string, from: Point, to: Point, width = 4) => (
  <line key={key} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="currentColor" strokeWidth={width} strokeLinecap="round" />
);

function MotionSkeleton({ motion, frame }: { motion: ProceduralMotionState; frame: ProceduralMotionFrame }) {
  const points = skeletonPoints(frame);
  const comPath = motion.trajectory.map((item, index) => `${index ? 'L' : 'M'} ${90 + item.centerOfMass.x * 90} ${82 - (item.centerOfMass.y - 0.5) * 42}`).join(' ');
  const activeContacts = frame.contacts.filter((contact) => contact.active);
  const unstable = motion.unstable || frame.fallRisk >= 66;

  return (
    <svg
      viewBox="0 0 180 140"
      className={`mt-2 h-36 w-full rounded-lg border bg-black/25 ${unstable ? 'border-rose-300/20 text-rose-100' : 'border-cyan-300/15 text-cyan-100'}`}
      aria-label="Полупроцедурная схема движения"
    >
      <line x1="18" y1="124" x2="162" y2="124" stroke="rgba(148,163,184,0.35)" strokeWidth="2" />
      <path d={comPath} fill="none" stroke="rgba(56,189,248,0.35)" strokeWidth="2" strokeDasharray="4 4" />
      <rect
        x={90 + frame.supportCenter.x * 90 - frame.supportWidth * 45}
        y="119"
        width={Math.max(8, frame.supportWidth * 90)}
        height="7"
        rx="3"
        fill={frame.balanceMargin < 0 ? 'rgba(251,113,133,0.45)' : 'rgba(52,211,153,0.36)'}
      />
      <g>
        {line('spine', points.hip, points.shoulder, 6)}
        {line('neck', points.shoulder, points.neck, 4)}
        {line('left-upper-arm', points.leftShoulder, points.leftElbow)}
        {line('left-forearm', points.leftElbow, points.leftHand, 3)}
        {line('right-upper-arm', points.rightShoulder, points.rightElbow)}
        {line('right-forearm', points.rightElbow, points.rightHand, 3)}
        {line('left-thigh', points.leftHip, points.leftKnee, 5)}
        {line('left-shin', points.leftKnee, points.leftFoot, 4)}
        {line('right-thigh', points.rightHip, points.rightKnee, 5)}
        {line('right-shin', points.rightKnee, points.rightFoot, 4)}
        <circle cx={points.head.x} cy={points.head.y} r="8" fill="rgba(15,23,42,0.92)" stroke="currentColor" strokeWidth="3" />
        <circle cx={points.hip.x} cy={points.hip.y} r="4" fill="rgba(34,211,238,0.8)" />
      </g>
      {activeContacts.map((contact) => {
        const x = contact.id === 'leftFoot'
          ? points.leftFoot.x
          : contact.id === 'rightFoot'
            ? points.rightFoot.x
            : contact.id === 'leftHand'
              ? points.leftHand.x
              : points.rightHand.x;
        const y = contact.id === 'leftFoot'
          ? Math.min(124, points.leftFoot.y)
          : contact.id === 'rightFoot'
            ? Math.min(124, points.rightFoot.y)
            : contact.id === 'leftHand'
              ? points.leftHand.y
              : points.rightHand.y;
        return <circle key={contact.id} cx={x} cy={y} r={3 + contact.load * 3} fill={contact.surface === 'target' ? '#fbbf24' : '#34d399'} opacity="0.88" />;
      })}
      <circle cx={90 + frame.centerOfMass.x * 90} cy={82 - (frame.centerOfMass.y - 0.5) * 42} r="5" fill={frame.balanceMargin < 0 ? '#fb7185' : '#38bdf8'} stroke="white" strokeWidth="1" />
      <text x="8" y="14" fill="currentColor" fontSize="8">{proceduralMotionPhaseLabels[frame.phase]}</text>
      <text x="8" y="135" fill="rgba(226,232,240,0.72)" fontSize="7">опора: {frame.supportFoot} · запас {frame.balanceMargin.toFixed(3)}</text>
    </svg>
  );
}

function ProceduralMotionPreview({ world, hero }: { world: WorldState; hero: Hero }) {
  const [clock, setClock] = useState(0);
  const motion = getProceduralMotion(hero.body) ?? buildProceduralMotion(world, hero);

  useEffect(() => {
    const started = performance.now();
    const interval = window.setInterval(() => setClock(performance.now() - started), 70);
    return () => window.clearInterval(interval);
  }, [motion.motionId]);

  const frame = useMemo(
    () => sampleProceduralMotion(motion, clock / 1000 * Math.max(0.22, motion.tempo) * 0.48),
    [clock, motion],
  );
  const contactNames = frame.contacts.filter((contact) => contact.active).map((contact) => contact.id).join(',') || 'none';

  return (
    <div
      className={`mt-3 rounded-lg border p-2 ${motion.unstable ? 'border-rose-300/15 bg-rose-300/5' : 'border-cyan-300/10 bg-cyan-300/5'}`}
      data-testid={`procedural-motion-${hero.id}`}
      data-motion-id={motion.motionId}
      data-motion-family={motion.family}
      data-motion-phase={frame.phase}
      data-motion-pattern={motion.patternId ?? 'generated'}
      data-motion-support={frame.supportFoot}
      data-motion-contacts={contactNames}
      data-motion-balance-margin={frame.balanceMargin.toFixed(4)}
      data-motion-fall-risk={frame.fallRisk.toFixed(2)}
      data-motion-unstable={motion.unstable ? 'true' : 'false'}
      data-motion-fallen={motion.fallen ? 'true' : 'false'}
      data-motion-frame-count={motion.trajectory.length}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-cyan-200/70">Процедурная кинематика</p>
          <p className="mt-0.5 text-[9px] text-slate-300">{movementFamilyLabels[motion.family]} · {proceduralMotionPhaseLabels[frame.phase]}</p>
        </div>
        <span className={`rounded px-1.5 py-1 font-mono text-[8px] ${motion.unstable ? 'bg-rose-300/10 text-rose-100' : 'bg-emerald-300/10 text-emerald-100'}`}>
          риск {Math.round(frame.fallRisk)}%
        </span>
      </div>
      <MotionSkeleton motion={motion} frame={frame} />
      <p className="mt-1.5 text-[8px] leading-4 text-slate-500">
        центр тяжести {frame.centerOfMass.x.toFixed(2)}/{frame.centerOfMass.y.toFixed(2)} · контакты {contactNames}
        {motion.fallen ? ' · тело сорвалось в падение' : motion.unstable ? ' · включён восстановительный шаг' : ' · опора удерживается'}
      </p>
    </div>
  );
}

export function PhysicalBodyOverlay() {
  const [world, setWorld] = useState<WorldState | undefined>(() => loadWorld());
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const refresh = () => {
      const next = loadWorld();
      if (next && synchronizeProceduralMotionWorld(next)) saveWorld(next);
      setWorld(next);
    };
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
            <h2 className="mt-1 text-sm font-semibold text-white">Тело строит движение через опору</h2>
            <p className="mt-1 text-[10px] text-slate-500">{heroes.length} тела · суставные траектории · центр тяжести · контакты</p>
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

                <ProceduralMotionPreview world={world} hero={hero} />
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
