import { useState } from 'react';
import { SimulationLab } from './lab/SimulationLab';
import { VillageHub3D } from './scenes/village3d/VillageHub3D';

type ViewMode = 'simulation' | 'village';

export default function TavernbornePreview() {
  const [viewMode, setViewMode] = useState<ViewMode>('simulation');

  return (
    <div className="relative min-h-screen bg-[#07080d]">
      <nav className="fixed right-4 top-4 z-[100] flex rounded-xl border border-white/10 bg-slate-950/85 p-1 shadow-xl backdrop-blur">
        <button
          type="button"
          onClick={() => setViewMode('simulation')}
          className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
            viewMode === 'simulation' ? 'bg-amber-300/15 text-amber-100' : 'text-slate-400 hover:text-white'
          }`}
        >
          Личность
        </button>
        <button
          type="button"
          onClick={() => setViewMode('village')}
          className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
            viewMode === 'village' ? 'bg-amber-300/15 text-amber-100' : 'text-slate-400 hover:text-white'
          }`}
        >
          3D-мир
        </button>
      </nav>

      {viewMode === 'simulation' ? <SimulationLab /> : <VillageHub3D />}
    </div>
  );
}
