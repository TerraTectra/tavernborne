import { QuaterniusModel } from './QuaterniusModel';
import type { AssetRenderReport, QuaterniusAssetId, QuaterniusManifest } from './quaterniusAssets';
import { resolvePublicAssetPath } from './quaterniusAssets';
import { villagePalette } from './VillageMaterials';

type PropVec3 = [number, number, number];

type VillagePropsProps = {
  manifest: QuaterniusManifest | null;
  onAssetReport: (report: AssetRenderReport) => void;
};

type PropModelId = Extract<QuaterniusAssetId, 'barrel' | 'crate' | 'lamp' | 'tree' | 'rock' | 'bush'>;

type PropBaseProps = {
  position: PropVec3;
  scale?: number;
  manifest: QuaterniusManifest | null;
  onAssetReport: (report: AssetRenderReport) => void;
};

function modelEntry(manifest: QuaterniusManifest | null, id: PropModelId) {
  return manifest?.models[id];
}

function modelUrl(manifest: QuaterniusManifest | null, id: PropModelId) {
  return resolvePublicAssetPath(modelEntry(manifest, id)?.file);
}

function BarrelFallback() {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.16, 0.18, 0.36, 14]} />
        <meshStandardMaterial color="#8b4a24" roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 0.37, 0]}>
        <torusGeometry args={[0.15, 0.012, 8, 16]} />
        <meshStandardMaterial color="#2f2019" roughness={0.8} />
      </mesh>
    </group>
  );
}

function PropModel({ id, targetSize, fallback, manifest, onAssetReport }: { id: PropModelId; targetSize: number; fallback: React.ReactNode; manifest: QuaterniusManifest | null; onAssetReport: (report: AssetRenderReport) => void }) {
  const entry = modelEntry(manifest, id);
  return (
    <QuaterniusModel
      id={id}
      url={modelUrl(manifest, id)}
      targetSize={entry?.targetSize ?? targetSize}
      sourcePack={entry?.sourcePack}
      sourceFile={entry?.sourceFile}
      fallback={fallback}
      onReport={onAssetReport}
    />
  );
}

function Barrel({ position, scale = 1, manifest, onAssetReport }: PropBaseProps) {
  return (
    <group position={position} scale={scale}>
      <PropModel id="barrel" targetSize={0.75} manifest={manifest} fallback={<BarrelFallback />} onAssetReport={onAssetReport} />
    </group>
  );
}

function CrateFallback() {
  return (
    <group rotation={[0, 0.25, 0]}>
      <mesh castShadow receiveShadow position={[0, 0.17, 0]}>
        <boxGeometry args={[0.34, 0.34, 0.34]} />
        <meshStandardMaterial color="#6a3c21" roughness={0.92} />
      </mesh>
      <mesh castShadow position={[0, 0.36, 0]}>
        <boxGeometry args={[0.38, 0.035, 0.38]} />
        <meshStandardMaterial color="#2f1c13" />
      </mesh>
    </group>
  );
}

function Crate({ position, scale = 1, manifest, onAssetReport }: PropBaseProps) {
  return (
    <group position={position} scale={scale}>
      <PropModel id="crate" targetSize={0.7} manifest={manifest} fallback={<CrateFallback />} onAssetReport={onAssetReport} />
    </group>
  );
}

function LampFallback() {
  return (
    <group>
      <mesh castShadow position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.035, 0.045, 0.84, 8]} />
        <meshStandardMaterial color="#22160f" roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0, 0.91, 0]}>
        <boxGeometry args={[0.22, 0.22, 0.22]} />
        <meshStandardMaterial color="#ffd37a" emissive="#ffbf57" emissiveIntensity={1.6} roughness={0.35} />
      </mesh>
      <pointLight color="#ffbf57" intensity={3.5} distance={2.4} position={[0, 0.9, 0]} />
    </group>
  );
}

function Lamp({ position, scale = 1, manifest, onAssetReport }: PropBaseProps) {
  return (
    <group position={position} scale={scale}>
      <PropModel id="lamp" targetSize={0.8} manifest={manifest} fallback={<LampFallback />} onAssetReport={onAssetReport} />
      <pointLight color="#ffbf57" intensity={3.5} distance={2.4} position={[0, 0.9, 0]} />
    </group>
  );
}

function TreeFallback() {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.34, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.68, 8]} />
        <meshStandardMaterial color="#4a2a17" roughness={0.85} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.86, 0]}>
        <coneGeometry args={[0.42, 0.82, 8]} />
        <meshStandardMaterial color="#205a38" roughness={0.78} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 1.22, 0]}>
        <coneGeometry args={[0.32, 0.64, 8]} />
        <meshStandardMaterial color="#2b7a48" roughness={0.78} />
      </mesh>
    </group>
  );
}

function Tree({ position, scale = 1, manifest, onAssetReport }: PropBaseProps) {
  return (
    <group position={position} scale={scale}>
      <PropModel id="tree" targetSize={1.5} manifest={manifest} fallback={<TreeFallback />} onAssetReport={onAssetReport} />
    </group>
  );
}

function RockFallback() {
  return (
    <mesh castShadow receiveShadow position={[0, 0.07, 0]} rotation={[0, 0.22, 0]}>
      <sphereGeometry args={[0.2, 12, 8]} />
      <meshStandardMaterial color="#56595a" roughness={0.95} />
    </mesh>
  );
}

function Rock({ position, scale = 1, manifest, onAssetReport }: PropBaseProps) {
  return (
    <group position={position} scale={scale}>
      <PropModel id="rock" targetSize={0.9} manifest={manifest} fallback={<RockFallback />} onAssetReport={onAssetReport} />
    </group>
  );
}

function RoadSegment({ position, rotationY, scale }: { position: PropVec3; rotationY: number; scale: PropVec3 }) {
  return (
    <mesh receiveShadow position={position} rotation={[-Math.PI / 2, 0, rotationY]} scale={scale}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial color={villagePalette.road} roughness={1} />
    </mesh>
  );
}

export function VillageGround() {
  return (
    <group>
      <mesh receiveShadow position={[0, -0.12, 0]} scale={[4.4, 0.12, 3.05]}>
        <cylinderGeometry args={[1, 1, 1, 72]} />
        <meshStandardMaterial color={villagePalette.ground} roughness={1} />
      </mesh>
      <mesh receiveShadow position={[0, -0.105, 0]} scale={[4.08, 0.08, 2.76]}>
        <cylinderGeometry args={[1, 1, 1, 72]} />
        <meshStandardMaterial color={villagePalette.groundDark} roughness={1} />
      </mesh>
      <RoadSegment position={[0, 0.01, 0.75]} rotationY={0.03} scale={[5.1, 1, 0.34]} />
      <RoadSegment position={[0.2, 0.015, 0.55]} rotationY={Math.PI / 2.7} scale={[3.9, 1, 0.27]} />
      <RoadSegment position={[1.75, 0.02, -0.52]} rotationY={-0.58} scale={[2.6, 1, 0.25]} />
      <mesh receiveShadow position={[0, 0.025, 0.55]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.78, 42]} />
        <meshStandardMaterial color={villagePalette.roadDark} roughness={1} />
      </mesh>
    </group>
  );
}

export function VillageProps({ manifest, onAssetReport }: VillagePropsProps) {
  return (
    <group>
      <Tree position={[-3.9, 0, -1.65]} scale={0.86} manifest={manifest} onAssetReport={onAssetReport} />
      <Tree position={[-3.65, 0, 2.15]} scale={0.96} manifest={manifest} onAssetReport={onAssetReport} />
      <Tree position={[3.8, 0, 1.62]} scale={1.02} manifest={manifest} onAssetReport={onAssetReport} />
      <Tree position={[3.55, 0, -2.18]} scale={0.78} manifest={manifest} onAssetReport={onAssetReport} />
      <Tree position={[0.65, 0, -2.55]} scale={0.62} manifest={manifest} onAssetReport={onAssetReport} />
      <Crate position={[-1.25, 0, 1.22]} scale={0.82} manifest={manifest} onAssetReport={onAssetReport} />
      <Crate position={[2.55, 0, 1.02]} scale={0.7} manifest={manifest} onAssetReport={onAssetReport} />
      <Barrel position={[0.78, 0, 1.28]} scale={0.92} manifest={manifest} onAssetReport={onAssetReport} />
      <Barrel position={[1.02, 0, 1.38]} scale={0.82} manifest={manifest} onAssetReport={onAssetReport} />
      <Barrel position={[1.82, 0, 2.62]} scale={0.9} manifest={manifest} onAssetReport={onAssetReport} />
      <Lamp position={[-1.05, 0, 0.92]} scale={0.88} manifest={manifest} onAssetReport={onAssetReport} />
      <Lamp position={[1.18, 0, 0.78]} scale={0.88} manifest={manifest} onAssetReport={onAssetReport} />
      <Lamp position={[-2.1, 0, -0.15]} scale={0.76} manifest={manifest} onAssetReport={onAssetReport} />
      <Lamp position={[2.0, 0, -0.25]} scale={0.76} manifest={manifest} onAssetReport={onAssetReport} />
      <Rock position={[-3.05, 0, 0.95]} scale={1} manifest={manifest} onAssetReport={onAssetReport} />
      <Rock position={[3.22, 0, 0.55]} scale={1} manifest={manifest} onAssetReport={onAssetReport} />
    </group>
  );
}
