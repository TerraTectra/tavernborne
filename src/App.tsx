import { useState } from 'react';
import { SimulationLab } from './lab/SimulationLab';
import { RTSGameV2 } from './rts/RTSGameV2';
import './rts/rts-additions.css';
import { VillageHub3D } from './scenes/village3d/VillageHub3D';

type ViewMode = 'camp' | 'simulation' | 'village';

export default function TavernbornePreview() {
  const [viewMode, setViewMode] = useState<ViewMode>('camp');

  return (
    <div className="relative min-h-screen bg-[#07080d]">
      <nav className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 rounded-xl border border-white/10 bg-slate-950/90 p-1 shadow-2xl backdrop-blur">
        <button
          type="button"
          onClick={() => setViewMode('camp')}
          className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
            viewMode === 'camp' ? 'bg-amber-300/15 text-amber-100' : 'text-slate-400 hover:text-white'
          }`}
        >
          Кибитка RTS
        </button>
        <button
          type="button"
          onClick={() => setViewMode('simulation')}
          className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
            viewMode === 'simulation' ? 'bg-amber-300/15 text-amber-100' : 'text-slate-400 hover:text-white'
          }`}
        >
          Лаборатория
        </button>
        <button
          type="button"
          onClick={() => setViewMode('village')}
          className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
            viewMode === 'village' ? 'bg-amber-300/15 text-amber-100' : 'text-slate-400 hover:text-white'
          }`}
        >
          Старый 3D-мир
        </button>
      </nav>

      {viewMode === 'camp' && <RTSGameV2 />}
      {viewMode === 'simulation' && <SimulationLab />}
      {viewMode === 'village' && <VillageHub3D />}
    </div>
  );
}
