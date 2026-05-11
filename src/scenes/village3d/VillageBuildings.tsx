import type { ThreeEvent } from '@react-three/fiber';
import { QuaterniusModel } from './QuaterniusModel';
import type { QuaterniusManifest } from './quaterniusAssets';
import { resolvePublicAssetPath } from './quaterniusAssets';
import type { VillageBuilding, VillageBuildingId } from './VillageLayout';
import { villagePalette } from './VillageMaterials';

type VillageBuildingsProps = {
  buildings: VillageBuilding[];
  selectedId: VillageBuildingId;
  hoveredId: VillageBuildingId | null;
  manifest: QuaterniusManifest | null;
  onSelect: (id: VillageBuildingId) => void;
  onHover: (id: VillageBuildingId | null) => void;
};

type BuildingModelProps = {
  building: VillageBuilding;
  selected: boolean;
  hovered: boolean;
  manifest: QuaterniusManifest | null;
  onSelect: (id: VillageBuildingId) => void;
  onHover: (id: VillageBuildingId | null) => void;
};

function WindowLight({ x, y, z, color }: { x: number; y: number; z: number; color: string }) {
  return (
    <mesh castShadow position={[x, y, z]}>
      <boxGeometry args={[0.18, 0.24, 0.035]} />
      <meshStandardMaterial color="#ffe5a8" emissive={color} emissiveIntensity={1.35} roughness={0.3} />
    </mesh>
  );
}

function Door({ width = 0.34, height = 0.58, z = 0.51 }: { width?: number; height?: number; z?: number }) {
  return (
    <mesh castShadow position={[0, height / 2, z]}>
      <boxGeometry args={[width, height, 0.05]} />
      <meshStandardMaterial color={villagePalette.darkWood} roughness={0.9} />
    </mesh>
  );
}

function Roof({ color, width = 1.35, height = 0.58, depth = 1.22, y = 1.14 }: { color: string; width?: number; height?: number; depth?: number; y?: number }) {
  return (
    <mesh castShadow receiveShadow position={[0, y, 0]} rotation={[0, Math.PI / 4, 0]} scale={[width, height, depth]}>
      <coneGeometry args={[0.74, 1, 4]} />
      <meshStandardMaterial color={color} roughness={0.76} />
    </mesh>
  );
}

function Chimney({ x, z, glow }: { x: number; z: number; glow: string }) {
  return (
    <group position={[x, 1.52, z]}>
      <mesh castShadow>
        <boxGeometry args={[0.18, 0.5, 0.18]} />
        <meshStandardMaterial color="#2e2e31" roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.34, 0]}>
        <sphereGeometry args={[0.1, 12, 8]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={1.1} transparent opacity={0.42} />
      </mesh>
    </group>
  );
}

function CoreHouse({ building, selected, hovered }: { building: VillageBuilding; selected: boolean; hovered: boolean }) {
  const glow = selected || hovered;

  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.53, 0]}>
        <boxGeometry args={[1.28, 1.05, 1.08]} />
        <meshStandardMaterial color={building.wallColor} roughness={0.84} />
      </mesh>
      <Roof color={building.roofColor} width={1.22} height={0.56} depth={1.08} y={1.34} />
      <Door width={building.type === 'tavern' || building.type === 'guild' ? 0.42 : 0.32} />
      <WindowLight x={-0.39} y={0.66} z={0.56} color={building.lightColor} />
      <WindowLight x={0.39} y={0.66} z={0.56} color={building.lightColor} />
      <mesh castShadow position={[0, 1.05, 0.61]}>
        <boxGeometry args={[0.74, 0.13, 0.06]} />
        <meshStandardMaterial color={building.trimColor} emissive={glow ? building.lightColor : '#000000'} emissiveIntensity={glow ? 0.5 : 0} />
      </mesh>
    </group>
  );
}

function TavernModel({ building, selected, hovered }: { building: VillageBuilding; selected: boolean; hovered: boolean }) {
  return (
    <group>
      <CoreHouse building={building} selected={selected} hovered={hovered} />
      <mesh castShadow receiveShadow position={[0, 0.35, 0.78]}>
        <boxGeometry args={[1.55, 0.42, 0.38]} />
        <meshStandardMaterial color="#5b321e" roughness={0.86} />
      </mesh>
      <mesh castShadow position={[0, 0.64, 1.0]}>
        <boxGeometry args={[1.64, 0.1, 0.22]} />
        <meshStandardMaterial color={building.roofColor} roughness={0.75} />
      </mesh>
      <Chimney x={0.48} z={-0.28} glow={building.lightColor} />
      <Chimney x={-0.48} z={-0.14} glow={building.lightColor} />
      <pointLight color={building.lightColor} intensity={5} distance={2.6} position={[0, 0.8, 0.92]} />
    </group>
  );
}

function ForgeModel({ building, selected, hovered }: { building: VillageBuilding; selected: boolean; hovered: boolean }) {
  return (
    <group>
      <CoreHouse building={building} selected={selected} hovered={hovered} />
      <Chimney x={0.46} z={-0.2} glow={building.lightColor} />
      <mesh castShadow receiveShadow position={[0.48, 0.36, 0.68]}>
        <boxGeometry args={[0.42, 0.5, 0.32]} />
        <meshStandardMaterial color="#2a2420" emissive={building.lightColor} emissiveIntensity={1.15} roughness={0.72} />
      </mesh>
      <pointLight color={building.lightColor} intensity={8} distance={2.8} position={[0.5, 0.55, 0.76]} />
    </group>
  );
}

function MarketModel({ building }: { building: VillageBuilding }) {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.3, 0]}>
        <boxGeometry args={[1.35, 0.18, 0.88]} />
        <meshStandardMaterial color="#6e4324" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 0.78, 0]}>
        <boxGeometry args={[1.58, 0.18, 1.0]} />
        <meshStandardMaterial color={building.roofColor} roughness={0.78} />
      </mesh>
      {[-0.58, 0.58].map((x) => (
        <mesh key={x} castShadow position={[x, 0.47, 0.35]}>
          <cylinderGeometry args={[0.035, 0.045, 0.74, 8]} />
          <meshStandardMaterial color={villagePalette.darkWood} />
        </mesh>
      ))}
      <mesh castShadow position={[-0.32, 0.52, 0.48]}>
        <boxGeometry args={[0.26, 0.26, 0.26]} />
        <meshStandardMaterial color="#95562e" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0.18, 0.52, 0.48]}>
        <cylinderGeometry args={[0.13, 0.14, 0.28, 12]} />
        <meshStandardMaterial color="#845128" roughness={0.9} />
      </mesh>
    </group>
  );
}

function ShrineModel({ building }: { building: VillageBuilding }) {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.72, 0.88, 0.28, 8]} />
        <meshStandardMaterial color={building.wallColor} roughness={0.82} />
      </mesh>
      <mesh castShadow position={[0, 0.78, 0]} rotation={[0, Math.PI / 4, 0]}>
        <octahedronGeometry args={[0.38]} />
        <meshStandardMaterial color={building.trimColor} emissive={building.lightColor} emissiveIntensity={1.6} roughness={0.35} />
      </mesh>
      <pointLight color={building.lightColor} intensity={8} distance={3} position={[0, 0.95, 0]} />
    </group>
  );
}

function GateModel({ building }: { building: VillageBuilding }) {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.62, 0]}>
        <boxGeometry args={[1.38, 1.24, 0.36]} />
        <meshStandardMaterial color={building.wallColor} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.62, 0.21]}>
        <cylinderGeometry args={[0.36, 0.46, 0.1, 28]} />
        <meshStandardMaterial color="#1b1225" emissive={building.lightColor} emissiveIntensity={1.35} roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0, 1.32, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.9, 0.52, 4]} />
        <meshStandardMaterial color={building.roofColor} roughness={0.76} />
      </mesh>
      <pointLight color={building.lightColor} intensity={12} distance={3.4} position={[0, 0.78, 0.28]} />
    </group>
  );
}

function ArmoryModel({ building, selected, hovered }: { building: VillageBuilding; selected: boolean; hovered: boolean }) {
  return (
    <group>
      <CoreHouse building={building} selected={selected} hovered={hovered} />
      <mesh castShadow position={[-0.43, 0.78, 0.66]} rotation={[0, 0, -0.45]}>
        <boxGeometry args={[0.08, 0.7, 0.05]} />
        <meshStandardMaterial color="#c9d1d3" metalness={0.35} roughness={0.35} />
      </mesh>
      <mesh castShadow position={[-0.26, 0.78, 0.66]} rotation={[0, 0, 0.45]}>
        <boxGeometry args={[0.08, 0.7, 0.05]} />
        <meshStandardMaterial color="#c9d1d3" metalness={0.35} roughness={0.35} />
      </mesh>
      <mesh castShadow position={[0.42, 0.68, 0.66]}>
        <cylinderGeometry args={[0.2, 0.2, 0.05, 24]} />
        <meshStandardMaterial color="#2f425c" metalness={0.2} roughness={0.45} />
      </mesh>
    </group>
  );
}

function FallbackShape({ building, selected, hovered }: { building: VillageBuilding; selected: boolean; hovered: boolean }) {
  if (building.type === 'tavern') return <TavernModel building={building} selected={selected} hovered={hovered} />;
  if (building.type === 'forge') return <ForgeModel building={building} selected={selected} hovered={hovered} />;
  if (building.type === 'market') return <MarketModel building={building} />;
  if (building.type === 'shrine') return <ShrineModel building={building} />;
  if (building.type === 'gate') return <GateModel building={building} />;
  if (building.type === 'armory') return <ArmoryModel building={building} selected={selected} hovered={hovered} />;
  return <CoreHouse building={building} selected={selected} hovered={hovered} />;
}

function BuildingShape({ building, selected, hovered, manifest }: { building: VillageBuilding; selected: boolean; hovered: boolean; manifest: QuaterniusManifest | null }) {
  const modelEntry = manifest?.models[building.id];
  const modelUrl = resolvePublicAssetPath(modelEntry?.file);
  const fallback = <FallbackShape building={building} selected={selected} hovered={hovered} />;

  return (
    <QuaterniusModel
      url={modelUrl}
      targetSize={modelEntry?.targetSize ?? building.modelTargetSize}
      fallback={fallback}
    />
  );
}

function BuildingModel({ building, selected, hovered, manifest, onSelect, onHover }: BuildingModelProps) {
  const lift = selected ? 0.12 : hovered ? 0.06 : 0;
  const scale = building.scale * (selected ? 1.05 : hovered ? 1.025 : 1);

  function handlePointerOver(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    onHover(building.id);
  }

  function handlePointerOut(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    onHover(null);
  }

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    onSelect(building.id);
  }

  return (
    <group
      position={[building.position[0], building.position[1] + lift, building.position[2]]}
      rotation={[0, building.rotationY, 0]}
      scale={scale}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      <mesh receiveShadow position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.94, 32]} />
        <meshStandardMaterial color={selected ? '#f6c56b' : hovered ? '#b88946' : '#2a2118'} transparent opacity={selected || hovered ? 0.42 : 0.22} />
      </mesh>
      <BuildingShape building={building} selected={selected} hovered={hovered} manifest={manifest} />
    </group>
  );
}

export function VillageBuildings({ buildings, selectedId, hoveredId, manifest, onSelect, onHover }: VillageBuildingsProps) {
  return (
    <group>
      {buildings.map((building) => (
        <BuildingModel
          key={building.id}
          building={building}
          selected={selectedId === building.id}
          hovered={hoveredId === building.id}
          manifest={manifest}
          onSelect={onSelect}
          onHover={onHover}
        />
      ))}
    </group>
  );
}
