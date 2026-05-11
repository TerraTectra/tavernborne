import { Canvas } from '@react-three/fiber';
import { useCallback, useMemo, useState } from 'react';
import { Color } from 'three';
import { VillageBuildings } from './VillageBuildings';
import { VillageCamera } from './VillageCamera';
import { defaultSelectedBuildingId, villageBuildings, type VillageBuildingId } from './VillageLayout';
import { VillageLighting } from './VillageLighting';
import { type AssetRenderDiagnostics, type AssetRenderReport, useQuaterniusAssets } from './quaterniusAssets';
import { VillageGround, VillageProps } from './VillageProps';
import { VillageSelectionUI } from './VillageSelectionUI';

export function VillageHub3D() {
  const [selectedId, setSelectedId] = useState<VillageBuildingId>(defaultSelectedBuildingId);
  const [hoveredId, setHoveredId] = useState<VillageBuildingId | null>(null);
  const [assetDiagnostics, setAssetDiagnostics] = useState<AssetRenderDiagnostics>({} as AssetRenderDiagnostics);
  const assetState = useQuaterniusAssets();

  const selected = useMemo(
    () => villageBuildings.find((building) => building.id === selectedId) ?? villageBuildings[0],
    [selectedId],
  );

  const hovered = useMemo(
    () => villageBuildings.find((building) => building.id === hoveredId) ?? null,
    [hoveredId],
  );

  const handleAssetReport = useCallback((report: AssetRenderReport) => {
    setAssetDiagnostics((previous) => {
      const current = previous[report.id];
      if (
        current?.status === report.status &&
        current?.url === report.url &&
        current?.sourcePack === report.sourcePack &&
        current?.sourceFile === report.sourceFile &&
        current?.error === report.error
      ) {
        return previous;
      }

      return {
        ...previous,
        [report.id]: report,
      };
    });
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#050509]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(56,189,248,.16),transparent_22%),radial-gradient(circle_at_50%_56%,rgba(251,146,60,.17),transparent_33%),linear-gradient(#111827,#07070b_62%,#030303)]" />
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [5.7, 5.1, 7.2], fov: 42, near: 0.1, far: 80 }}
        onCreated={({ scene, gl }) => {
          scene.background = new Color('#090d18');
          scene.fog = null;
          gl.setClearColor('#090d18');
        }}
      >
        <VillageCamera />
        <VillageLighting />
        <VillageGround />
        <VillageProps manifest={assetState.manifest} onAssetReport={handleAssetReport} />
        <VillageBuildings
          buildings={villageBuildings}
          selectedId={selectedId}
          hoveredId={hoveredId}
          manifest={assetState.manifest}
          onAssetReport={handleAssetReport}
          onSelect={setSelectedId}
          onHover={setHoveredId}
        />
      </Canvas>
      <VillageSelectionUI selected={selected} hovered={hovered} assetState={assetState} assetDiagnostics={assetDiagnostics} />
    </div>
  );
}
