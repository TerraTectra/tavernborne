import type { AssetRenderDiagnostics, QuaterniusAssetsState } from './quaterniusAssets';
import { summarizeAssetDiagnostics } from './quaterniusAssets';
import type { VillageBuilding } from './VillageLayout';

type VillageSelectionUIProps = {
  selected: VillageBuilding;
  hovered: VillageBuilding | null;
  assetState: QuaterniusAssetsState;
  assetDiagnostics: AssetRenderDiagnostics;
};

export function VillageSelectionUI({ selected, hovered, assetState, assetDiagnostics }: VillageSelectionUIProps) {
  const active = hovered ?? selected;
  const manifestCount = Object.keys(assetState.manifest?.models ?? {}).length;
  const summary = summarizeAssetDiagnostics(assetDiagnostics);
  const fallbackCount = summary.fallback + summary.failed;

  const statusText = assetState.loading
    ? 'loading approved manifest'
    : assetState.error
      ? 'manifest unavailable · fallback mode'
      : `${summary.rendered}/${manifestCount} rendered · ${fallbackCount} fallback · ${summary.loading} loading`;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 text-amber-50">
      <div className="absolute left-8 top-7 select-none">
        <div className="text-[11px] font-black uppercase tracking-[0.42em] text-amber-200/48">Tavernborne</div>
        <div className="mt-1 text-4xl font-black leading-none drop-shadow-[0_7px_8px_rgba(0,0,0,.85)]">Старая Застава</div>
        <div className="mt-2 rounded-full border border-amber-200/15 bg-black/35 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-100/52 backdrop-blur">
          {statusText}
        </div>
      </div>

      <div className="absolute right-6 top-24 max-w-[330px] rounded-2xl border border-amber-200/10 bg-black/35 p-3 text-[10px] text-amber-100/55 shadow-2xl backdrop-blur-md">
        <div className="mb-2 font-black uppercase tracking-[0.22em] text-amber-200/55">asset render status</div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div><b className="block text-amber-50">{summary.rendered}</b>rendered</div>
          <div><b className="block text-amber-50">{summary.loading}</b>loading</div>
          <div><b className="block text-amber-50">{summary.fallback}</b>fallback</div>
          <div><b className="block text-amber-50">{summary.failed}</b>failed</div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 max-w-[520px] -translate-x-1/2 rounded-2xl border border-amber-200/20 bg-black/45 px-5 py-3 text-center shadow-2xl shadow-black/60 backdrop-blur-md">
        <div className="text-[11px] font-black uppercase tracking-[0.32em] text-amber-200/55">{active.label}</div>
        <div className="mt-1 text-lg font-black text-amber-50">{active.name}</div>
        <div className="mt-1 text-xs leading-5 text-amber-100/66">{active.description}</div>
      </div>
    </div>
  );
}
