import { useMemo, useState } from 'react';
import { sortBySceneDepth } from '../../rendering/depthSort';
import { villageObjects } from './villageData';
import type { VillageObject } from './villageTypes';

function SpriteObject({ item, selected, onSelect }: { item: VillageObject; selected: boolean; onSelect: (id: string) => void }) {
  const width = item.width * (item.scale ?? 1);
  const clickable = item.interactive === true;

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => clickable && onSelect(item.id)}
      className={`absolute -translate-x-1/2 -translate-y-full bg-transparent p-0 transition duration-200 focus:outline-none ${clickable ? 'cursor-pointer hover:-translate-y-[104%] hover:scale-[1.035]' : 'pointer-events-none'} ${selected ? '-translate-y-[106%] scale-[1.055]' : ''}`}
      style={{ left: item.x, top: item.y, zIndex: Math.round(item.y + (item.depthOffset ?? 0)) }}
      aria-label={item.name}
    >
      <img
        src={item.sprite}
        alt=""
        draggable={false}
        className={`block h-auto drop-shadow-[0_20px_24px_rgba(0,0,0,.48)] transition duration-200 ${selected ? 'brightness-125 saturate-125 drop-shadow-[0_0_28px_rgba(251,191,36,.42)]' : 'brightness-100'}`}
        style={{ width }}
      />
      {selected && (
        <div className="absolute left-1/2 top-[82%] -translate-x-1/2 whitespace-nowrap rounded-lg border border-amber-200/30 bg-amber-950/80 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-amber-100 shadow-2xl backdrop-blur">
          {item.label ?? item.name}
        </div>
      )}
    </button>
  );
}

function MissingAssetsHint() {
  return (
    <div className="pointer-events-none absolute bottom-7 left-1/2 z-[900] -translate-x-1/2 rounded-xl border border-amber-200/20 bg-black/45 px-4 py-3 text-center text-xs text-amber-100/70 shadow-2xl backdrop-blur">
      Если спрайты не появились, выполни <b>npm run assets:install</b> после <b>npm install</b>.
    </div>
  );
}

export function VillageScene() {
  const [selectedId, setSelectedId] = useState('tavern');
  const sortedObjects = useMemo(() => sortBySceneDepth(villageObjects), []);
  const selected = villageObjects.find((item) => item.id === selectedId) ?? villageObjects.find((item) => item.interactive);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#050509] text-amber-50">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(80,170,255,.16),transparent_24%),radial-gradient(circle_at_50%_56%,rgba(251,146,60,.17),transparent_34%),linear-gradient(#111827,#07070b_60%,#030303)]" />
      <div className="absolute left-1/2 top-[12%] h-72 w-[86vw] -translate-x-1/2 rounded-[50%] bg-slate-900/70 blur-sm" />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/75 to-transparent" />

      <div className="absolute left-1/2 top-1/2 h-[760px] w-[1180px] -translate-x-1/2 -translate-y-[47%]">
        <div className="absolute left-1/2 top-1/2 h-[620px] w-[1060px] -translate-x-1/2 -translate-y-1/2 rotate-[-7deg] skew-x-[-10deg] rounded-[72px] border border-amber-100/10 bg-[linear-gradient(135deg,rgba(58,95,32,.9),rgba(112,70,35,.92)_48%,rgba(38,36,42,.95))] shadow-[0_55px_150px_rgba(0,0,0,.78)]" />
        <div className="absolute left-1/2 top-[51%] h-[500px] w-[920px] -translate-x-1/2 -translate-y-1/2 rotate-[-7deg] skew-x-[-10deg] rounded-[56px] border border-white/5 bg-[linear-gradient(90deg,rgba(255,255,255,.045)_1px,transparent_1px),linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px)] bg-[size:58px_58px] opacity-60" />

        {sortedObjects.map((item) => (
          <SpriteObject key={item.id} item={item} selected={selectedId === item.id} onSelect={setSelectedId} />
        ))}
      </div>

      <div className="pointer-events-none absolute left-10 top-8 z-[999] select-none">
        <div className="text-[11px] font-black uppercase tracking-[0.42em] text-amber-200/48">Tavernborne</div>
        <div className="mt-1 text-4xl font-black leading-none drop-shadow-[0_7px_8px_rgba(0,0,0,.85)]">Старая Застава</div>
      </div>

      {selected && (
        <div className="pointer-events-none absolute bottom-8 left-1/2 z-[999] max-w-[560px] -translate-x-1/2 rounded-2xl border border-amber-200/20 bg-black/45 px-5 py-3 text-center shadow-2xl backdrop-blur">
          <div className="text-sm font-black text-amber-100">{selected.name}</div>
          <div className="mt-1 text-xs text-amber-100/62">{selected.description}</div>
        </div>
      )}

      <MissingAssetsHint />
    </div>
  );
}
