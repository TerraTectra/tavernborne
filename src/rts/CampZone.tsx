export type ZoneId = 'altar' | 'hearth' | 'beds' | 'training' | 'library' | 'workshop' | 'quiet' | 'gate';

export type Zone = {
  id: ZoneId;
  label: string;
  subtitle: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export const zones: Zone[] = [
  { id: 'altar', label: 'Место Астера', subtitle: 'совет и благословение', x: 5, y: 7, width: 22, height: 22 },
  { id: 'hearth', label: 'Общий очаг', subtitle: 'еда и разговоры', x: 34, y: 8, width: 30, height: 24 },
  { id: 'beds', label: 'Спальные места', subtitle: 'три тесные койки', x: 70, y: 7, width: 24, height: 27 },
  { id: 'training', label: 'Тренировочный угол', subtitle: 'соломенная мишень', x: 5, y: 41, width: 27, height: 27 },
  { id: 'library', label: 'Книжная полка', subtitle: 'старые записи и учебники', x: 38, y: 42, width: 23, height: 22 },
  { id: 'workshop', label: 'Мастерская', subtitle: 'верстак и инструменты', x: 68, y: 42, width: 27, height: 27 },
  { id: 'quiet', label: 'Тихий угол', subtitle: 'место побыть одному', x: 8, y: 76, width: 25, height: 17 },
  { id: 'gate', label: 'Выход из кибитки', subtitle: 'работа и внешний мир', x: 66, y: 76, width: 29, height: 17 },
];

const visual = (id: ZoneId) => {
  switch (id) {
    case 'altar':
      return (
        <div className="relative h-full w-full">
          <div className="absolute bottom-[18%] left-1/2 h-[42%] w-[62%] -translate-x-1/2 rounded-[50%] border border-amber-300/15 bg-amber-800/10" />
          <div className="absolute bottom-[30%] left-1/2 h-10 w-10 -translate-x-1/2 rotate-45 rounded-md border border-amber-200/30 bg-amber-500/10 shadow-[0_0_24px_rgba(251,191,36,.18)]" />
          <div className="absolute bottom-[38%] left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-amber-200/70 shadow-[0_0_18px_rgba(253,230,138,.8)]" />
        </div>
      );
    case 'hearth':
      return (
        <div className="relative h-full w-full">
          <div className="absolute left-1/2 top-[46%] h-16 w-28 -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-4 border-[#5b3b22] bg-[#25180f] shadow-xl" />
          <div className="absolute left-1/2 top-[45%] h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/70 shadow-[0_0_25px_rgba(249,115,22,.65)]" />
          <div className="absolute left-[13%] top-[38%] h-10 w-10 rounded-md border border-white/10 bg-[#49301f]" />
          <div className="absolute right-[13%] top-[38%] h-10 w-10 rounded-md border border-white/10 bg-[#49301f]" />
          <div className="absolute bottom-[10%] left-1/2 h-7 w-16 -translate-x-1/2 rounded-md border border-white/10 bg-[#5a3a24]" />
        </div>
      );
    case 'beds':
      return (
        <div className="grid h-full grid-cols-3 gap-2 p-2">
          {[0, 1, 2].map((bed) => (
            <div key={bed} className="relative rounded-lg border border-white/10 bg-[#36261c] shadow-inner">
              <div className="absolute inset-x-1 top-1 h-5 rounded bg-stone-300/20" />
              <div className="absolute inset-x-1 bottom-1 top-7 rounded bg-indigo-300/15" />
            </div>
          ))}
        </div>
      );
    case 'training':
      return (
        <div className="relative h-full w-full">
          <div className="absolute bottom-[12%] left-[20%] h-[50%] w-[55%] rounded-full border border-white/5 bg-stone-500/5" />
          <div className="absolute bottom-[18%] right-[18%] h-[56%] w-2 rounded bg-[#68452a]" />
          <div className="absolute right-[12%] top-[18%] h-12 w-12 rounded-full border-4 border-amber-800/50 bg-amber-300/10" />
          <div className="absolute right-[28%] top-[32%] h-2 w-16 rotate-[18deg] rounded bg-[#86613b]" />
        </div>
      );
    case 'library':
      return (
        <div className="relative h-full w-full p-3">
          <div className="absolute inset-x-3 top-3 h-[58%] rounded-md border-4 border-[#4d321f] bg-[#261a12]">
            {[18, 36, 54, 72].map((left, index) => (
              <span key={left} className="absolute bottom-2 top-2 w-[10%] rounded-sm" style={{ left: `${left}%`, background: ['#8d4f45', '#526f88', '#8b7a45', '#5d7753'][index] }} />
            ))}
          </div>
          <div className="absolute bottom-3 left-1/2 h-8 w-16 -translate-x-1/2 rounded-md border border-white/10 bg-[#593b25]" />
        </div>
      );
    case 'workshop':
      return (
        <div className="relative h-full w-full">
          <div className="absolute left-[10%] right-[10%] top-[35%] h-[34%] rounded-md border border-white/10 bg-[#5b3b24] shadow-lg" />
          <div className="absolute left-[18%] top-[22%] h-3 w-16 rotate-12 rounded bg-slate-400/40" />
          <div className="absolute right-[18%] top-[22%] h-8 w-3 -rotate-[28deg] rounded bg-amber-700/70" />
          <div className="absolute bottom-[10%] left-[18%] h-8 w-3 bg-[#3b2618]" />
          <div className="absolute bottom-[10%] right-[18%] h-8 w-3 bg-[#3b2618]" />
        </div>
      );
    case 'quiet':
      return (
        <div className="relative h-full w-full">
          <div className="absolute bottom-[18%] left-[18%] h-12 w-20 rounded-[50%] border border-white/10 bg-violet-300/10" />
          <div className="absolute right-[16%] top-[20%] h-16 w-10 rounded-t-full bg-emerald-700/20" />
        </div>
      );
    case 'gate':
      return (
        <div className="relative h-full w-full">
          <div className="absolute bottom-0 left-1/2 h-[85%] w-[45%] -translate-x-1/2 rounded-t-full border-4 border-[#4b3322] bg-gradient-to-b from-slate-700/20 to-black/60" />
          <div className="absolute bottom-[15%] left-1/2 h-2 w-[60%] -translate-x-1/2 bg-amber-200/10 blur-sm" />
        </div>
      );
  }
};

export function CampZone({ zone }: { zone: Zone }) {
  return (
    <div
      className="group absolute rounded-2xl border border-amber-100/5 bg-black/10 shadow-[inset_0_0_24px_rgba(0,0,0,.22)]"
      style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%` }}
      data-zone={zone.id}
    >
      {visual(zone.id)}
      <div className="pointer-events-none absolute left-2 top-2 rounded-md border border-white/5 bg-black/55 px-2 py-1 opacity-70 transition group-hover:opacity-100">
        <p className="text-[10px] font-semibold text-amber-50/85">{zone.label}</p>
        <p className="text-[8px] text-stone-500">{zone.subtitle}</p>
      </div>
    </div>
  );
}
