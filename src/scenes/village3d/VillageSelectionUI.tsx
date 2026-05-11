import type { VillageBuilding } from './VillageLayout';

type VillageSelectionUIProps = {
  selected: VillageBuilding;
  hovered: VillageBuilding | null;
};

export function VillageSelectionUI({ selected, hovered }: VillageSelectionUIProps) {
  const active = hovered ?? selected;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 text-amber-50">
      <div className="absolute left-8 top-7 select-none">
        <div className="text-[11px] font-black uppercase tracking-[0.42em] text-amber-200/48">Tavernborne</div>
        <div className="mt-1 text-4xl font-black leading-none drop-shadow-[0_7px_8px_rgba(0,0,0,.85)]">Старая Застава</div>
      </div>

      <div className="absolute bottom-8 left-1/2 max-w-[520px] -translate-x-1/2 rounded-2xl border border-amber-200/20 bg-black/45 px-5 py-3 text-center shadow-2xl shadow-black/60 backdrop-blur-md">
        <div className="text-[11px] font-black uppercase tracking-[0.32em] text-amber-200/55">{active.label}</div>
        <div className="mt-1 text-lg font-black text-amber-50">{active.name}</div>
        <div className="mt-1 text-xs leading-5 text-amber-100/66">{active.description}</div>
      </div>
    </div>
  );
}
