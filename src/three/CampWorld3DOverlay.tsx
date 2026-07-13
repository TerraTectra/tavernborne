import { Float, Html, Sparkles } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Group } from 'three';
import { Color } from 'three';
import { createInitialWorld, ensureDailyPlans, loadWorld, type WorldState } from '../simulation';
import { useRealtimeActors, type RuntimeActor } from '../rts/realtime';
import { EnvironmentAsset3D } from './EnvironmentAsset3D';
import { HeroBody3D } from './HeroBody3D';
import './world3d.css';

const mapPoint = (x: number, y: number): [number, number, number] => [
  (x - 50) * 0.18,
  0,
  (y - 50) * 0.125,
];

function ProceduralRock({ scale = 1 }: { scale?: number }) {
  return (
    <mesh castShadow receiveShadow scale={[scale, scale * 0.68, scale * 0.9]} rotation={[0.08, 0.35, -0.06]}>
      <dodecahedronGeometry args={[0.45, 0]} />
      <meshStandardMaterial color="#555d5b" roughness={1} />
    </mesh>
  );
}

function ProceduralTree({ scale = 1 }: { scale?: number }) {
  return (
    <group scale={scale}>
      <mesh castShadow receiveShadow position={[0, 0.65, 0]}>
        <cylinderGeometry args={[0.17, 0.25, 1.3, 9]} />
        <meshStandardMaterial color="#4c2d1c" roughness={0.92} />
      </mesh>
      <mesh castShadow position={[0, 1.62, 0]}>
        <coneGeometry args={[0.95, 1.7, 9]} />
        <meshStandardMaterial color="#1f5837" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0.1, 2.25, -0.04]}>
        <coneGeometry args={[0.72, 1.35, 9]} />
        <meshStandardMaterial color="#2d7145" roughness={0.88} />
      </mesh>
    </group>
  );
}

function ProceduralWagonHome() {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 1.15, 0]}>
        <boxGeometry args={[4.15, 1.65, 2.35]} />
        <meshStandardMaterial color="#315f5a" roughness={0.72} metalness={0.08} />
      </mesh>
      <mesh castShadow position={[0, 2.02, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1.18, 1.18, 4.25, 20, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#254c49" roughness={0.76} side={2} />
      </mesh>
      {[-1.82, 1.82].map((x) => (
        <group key={x} position={[x, 0.58, 0]}>
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.72, 0.72, 0.24, 20]} /><meshStandardMaterial color="#36271e" roughness={0.9} /></mesh>
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.58, 0.06, 8, 24]} /><meshStandardMaterial color="#8a633a" roughness={0.82} /></mesh>
        </group>
      ))}
      <mesh castShadow position={[-1.2, 1.1, 1.19]}><boxGeometry args={[0.92, 1.48, 0.12]} /><meshStandardMaterial color="#6b4427" roughness={0.82} /></mesh>
      {[-0.2, 1.18].map((x) => (
        <group key={x} position={[x, 1.36, 1.21]}>
          <mesh castShadow><boxGeometry args={[0.64, 0.72, 0.12]} /><meshStandardMaterial color="#233333" roughness={0.7} /></mesh>
          <mesh position={[0, 0, 0.075]}><boxGeometry args={[0.44, 0.5, 0.025]} /><meshStandardMaterial color="#ffd178" emissive="#ffad42" emissiveIntensity={1.1} roughness={0.28} /></mesh>
        </group>
      ))}
    </group>
  );
}

function WagonHome() {
  return (
    <EnvironmentAsset3D
      assetId={['tavern', 'guild']}
      position={[0.4, 0, -4.65]}
      rotation={[0, -0.05, 0]}
      size={5.2}
      testId="environment-home"
      fallback={<ProceduralWagonHome />}
    />
  );
}

function ProceduralCampfire() {
  const flame = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!flame.current) return;
    const pulse = 0.88 + Math.sin(clock.elapsedTime * 8) * 0.12;
    flame.current.scale.set(pulse, 0.92 + Math.sin(clock.elapsedTime * 10) * 0.16, pulse);
    flame.current.rotation.y = clock.elapsedTime * 0.8;
  });
  return (
    <group>
      {Array.from({ length: 12 }, (_, index) => {
        const angle = index / 12 * Math.PI * 2;
        return <group key={index} position={[Math.cos(angle) * 0.62, 0.16, Math.sin(angle) * 0.62]}><ProceduralRock scale={0.28} /></group>;
      })}
      {[0, 1, 2].map((index) => (
        <mesh key={index} castShadow position={[0, 0.24 + index * 0.02, 0]} rotation={[0, index * Math.PI / 3, Math.PI / 2]}>
          <cylinderGeometry args={[0.09, 0.11, 1.05, 8]} /><meshStandardMaterial color="#4a2a18" roughness={0.95} />
        </mesh>
      ))}
      <group ref={flame} position={[0, 0.64, 0]}>
        <mesh><coneGeometry args={[0.32, 0.95, 10]} /><meshStandardMaterial color="#ff8b27" emissive="#ff5a12" emissiveIntensity={2.8} transparent opacity={0.9} /></mesh>
        <mesh position={[0, 0.08, 0]}><coneGeometry args={[0.17, 0.64, 10]} /><meshStandardMaterial color="#ffe26d" emissive="#ffcf35" emissiveIntensity={3.2} /></mesh>
      </group>
      <pointLight color="#ff9f45" intensity={7} distance={7.5} position={[0, 1.2, 0]} castShadow />
      <Sparkles count={18} scale={[1.6, 2.2, 1.6]} size={2.1} speed={0.45} color="#ffb65c" position={[0, 1.25, 0]} />
    </group>
  );
}

function Campfire() {
  return (
    <group position={[-0.2, 0, -3.25]}>
      <ProceduralCampfire />
      <EnvironmentAsset3D assetId="lamp" position={[-1.1, 0, 0.45]} size={0.9} testId="environment-camp-light" fallback={<group />} />
      <EnvironmentAsset3D assetId="barrel" position={[1.25, 0, -0.38]} size={0.72} fallback={<group />} />
    </group>
  );
}

function ProceduralDiningArea() {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.62, 0]}><cylinderGeometry args={[1.0, 1.0, 0.16, 16]} /><meshStandardMaterial color="#6c4629" roughness={0.86} /></mesh>
      <mesh castShadow position={[0, 0.3, 0]}><cylinderGeometry args={[0.16, 0.2, 0.62, 10]} /><meshStandardMaterial color="#49301f" roughness={0.9} /></mesh>
      {[0, 1, 2].map((index) => {
        const angle = index / 3 * Math.PI * 2;
        return <mesh key={index} castShadow receiveShadow position={[Math.cos(angle) * 1.45, 0.36, Math.sin(angle) * 1.45]} rotation={[0, -angle, 0]}><boxGeometry args={[0.68, 0.12, 0.42]} /><meshStandardMaterial color="#59402c" roughness={0.9} /></mesh>;
      })}
    </group>
  );
}

function DiningArea() {
  return (
    <group position={[-0.2, 0, -2.35]}>
      <EnvironmentAsset3D assetId="market" size={2.8} testId="environment-dining" fallback={<ProceduralDiningArea />} />
      <EnvironmentAsset3D assetId="crate" position={[-1.65, 0, 0.9]} size={0.62} fallback={<group />} />
      <EnvironmentAsset3D assetId="barrel" position={[1.65, 0, 0.65]} size={0.68} fallback={<group />} />
    </group>
  );
}

function ProceduralWorkshop() {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.66, 0]}><boxGeometry args={[2.25, 0.18, 0.88]} /><meshStandardMaterial color="#684326" roughness={0.9} /></mesh>
      {[-0.9, 0.9].map((x) => <mesh key={x} castShadow position={[x, 0.31, 0]}><boxGeometry args={[0.13, 0.7, 0.13]} /><meshStandardMaterial color="#3b2a1d" /></mesh>)}
      <mesh castShadow position={[-0.45, 0.84, 0]} rotation={[0, 0, -0.42]}><boxGeometry args={[0.12, 0.85, 0.12]} /><meshStandardMaterial color="#898f96" metalness={0.45} roughness={0.42} /></mesh>
      <mesh castShadow position={[0.35, 0.8, 0.05]}><boxGeometry args={[0.62, 0.22, 0.42]} /><meshStandardMaterial color="#39424a" metalness={0.35} roughness={0.55} /></mesh>
    </group>
  );
}

function Workshop() {
  return <EnvironmentAsset3D assetId={['blacksmith', 'armory']} position={[5.3, 0, -0.5]} rotation={[0, -0.15, 0]} size={3.8} testId="environment-workshop" fallback={<ProceduralWorkshop />} />;
}

function ProceduralTrainingArea() {
  return (
    <group>
      <mesh receiveShadow position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.65, 28]} /><meshStandardMaterial color="#6a5433" roughness={1} /></mesh>
      <group position={[-0.75, 0, 0]}>
        <mesh castShadow position={[0, 1.12, 0]}><cylinderGeometry args={[0.09, 0.12, 2.24, 10]} /><meshStandardMaterial color="#6b472b" roughness={0.9} /></mesh>
        <mesh castShadow position={[0, 1.65, 0]}><cylinderGeometry args={[0.28, 0.32, 0.7, 10]} /><meshStandardMaterial color="#8c5c2f" roughness={0.92} /></mesh>
        <mesh castShadow position={[0, 2.08, 0]}><sphereGeometry args={[0.22, 12, 10]} /><meshStandardMaterial color="#9a7447" roughness={0.9} /></mesh>
      </group>
    </group>
  );
}

function TrainingArea() {
  return <EnvironmentAsset3D assetId="armory" position={[-5.35, 0, -0.45]} size={3.1} testId="environment-training" fallback={<ProceduralTrainingArea />} />;
}

function ReadingNook() {
  return (
    <group position={[0, 0, 0.5]}>
      <EnvironmentAsset3D assetId="shrine" size={1.55} testId="environment-reading" fallback={<mesh castShadow receiveShadow position={[0, 0.52, 0]}><boxGeometry args={[1.65, 0.16, 0.9]} /><meshStandardMaterial color="#624027" roughness={0.9} /></mesh>} />
      <EnvironmentAsset3D assetId="lamp" position={[1.05, 0, -0.2]} size={0.7} fallback={<group />} />
    </group>
  );
}

function SleepArea() {
  return (
    <group position={[5.25, 0, -3.8]}>
      {[-1, 0, 1].map((offset, index) => (
        <group key={offset} position={[offset * 1.05, 0, index % 2 ? 0.12 : -0.08]} rotation={[0, -0.08, 0]}>
          <mesh castShadow receiveShadow position={[0, 0.18, 0]}><boxGeometry args={[0.9, 0.22, 1.75]} /><meshStandardMaterial color="#4d3528" roughness={0.9} /></mesh>
          <mesh castShadow position={[0, 0.34, -0.12]}><boxGeometry args={[0.78, 0.12, 1.38]} /><meshStandardMaterial color={index === 0 ? '#355c65' : index === 1 ? '#514b7a' : '#6d473e'} roughness={0.88} /></mesh>
          <mesh castShadow position={[0, 0.42, -0.68]}><boxGeometry args={[0.64, 0.14, 0.34]} /><meshStandardMaterial color="#b6aa8b" roughness={0.92} /></mesh>
        </group>
      ))}
      <EnvironmentAsset3D assetId="crate" position={[1.85, 0, 0.55]} size={0.62} testId="environment-sleep-storage" fallback={<group />} />
    </group>
  );
}

function QuietCorner() {
  return (
    <group position={[-5.2, 0, 4.35]}>
      <EnvironmentAsset3D assetId="shrine" size={1.45} testId="environment-shrine" fallback={<ProceduralRock scale={1.3} />} />
      <Sparkles count={20} scale={[2.2, 1.4, 2.2]} size={1.6} speed={0.08} color="#9f8ccf" position={[0.5, 0.6, -0.2]} />
    </group>
  );
}

function ProceduralDungeonGate() {
  return (
    <group>
      <mesh receiveShadow position={[0, 0.06, -0.2]}><boxGeometry args={[4.1, 0.12, 2.8]} /><meshStandardMaterial color="#383c42" roughness={0.96} /></mesh>
      {[-1.45, 1.45].map((x) => <mesh key={x} castShadow receiveShadow position={[x, 1.15, 0]}><boxGeometry args={[0.72, 2.3, 0.9]} /><meshStandardMaterial color="#4e545a" roughness={0.95} /></mesh>)}
      <mesh castShadow receiveShadow position={[0, 2.55, 0]}><boxGeometry args={[3.58, 0.66, 1.02]} /><meshStandardMaterial color="#4b5054" roughness={0.96} /></mesh>
    </group>
  );
}

function DungeonGate() {
  return (
    <group position={[5.65, 0, 4.55]} rotation={[0, Math.PI, 0]}>
      <EnvironmentAsset3D assetId="dungeonGate" size={4.4} testId="environment-dungeon-gate" fallback={<ProceduralDungeonGate />} />
      <Sparkles count={24} scale={[2.2, 2.5, 1]} size={2.2} speed={0.22} color="#697cff" position={[0, 1.25, 0.2]} />
    </group>
  );
}

function AsterPresence() {
  return (
    <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.35}>
      <group position={mapPoint(16, 17)}>
        <mesh castShadow position={[0, 1.35, 0]}><sphereGeometry args={[0.3, 18, 14]} /><meshStandardMaterial color="#e4b35f" emissive="#c98328" emissiveIntensity={0.7} /></mesh>
        <mesh castShadow position={[0, 0.65, 0]} scale={[0.72, 1.2, 0.52]}><capsuleGeometry args={[0.36, 0.7, 5, 12]} /><meshStandardMaterial color="#735128" metalness={0.24} roughness={0.58} /></mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 1.76, 0]}><torusGeometry args={[0.46, 0.035, 8, 28]} /><meshStandardMaterial color="#ffe69a" emissive="#ffbf42" emissiveIntensity={2} /></mesh>
        <pointLight color="#ffd477" intensity={3.2} distance={4.5} position={[0, 1.4, 0]} />
        <Html center position={[0, 2.2, 0]}><span className="world3d-god-label">Астер</span></Html>
      </group>
    </Float>
  );
}

function GroundAndForest() {
  const trees: Array<[[number, number, number], number]> = [
    [[-9.3, 0, -5.8], 1.3], [[-7.8, 0, -5.9], 1.15], [[-5.8, 0, -6.1], 0.92], [[-2.7, 0, -6.15], 0.82],
    [[2.8, 0, -6.1], 0.9], [[5.1, 0, -6.05], 1.08], [[8.2, 0, -5.65], 1.3], [[9.2, 0, -3.5], 1.1],
    [[-9.2, 0, -2.8], 1.12], [[-9.35, 0, 0.3], 0.9], [[-9.1, 0, 3.4], 1.2], [[-8.2, 0, 5.5], 1.25],
    [[-5.5, 0, 6.0], 0.95], [[-2.2, 0, 6.15], 0.82], [[1.4, 0, 6.15], 0.75], [[9.1, 0, 2.4], 0.92],
  ];
  const rocks: [number, number, number][] = [[-7.2, 0.1, -3.9], [-7.6, 0.1, 2.8], [8.0, 0.1, -1.8], [4.4, 0.1, 5.5], [-3.8, 0.1, 5.4]];
  const bushes: [number, number, number][] = [[-6.7, 0, -4.7], [7.35, 0, 3.5], [-6.2, 0, 5.45], [3.5, 0, -5.65]];
  return (
    <group>
      <mesh receiveShadow position={[0, -0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[20, 14]} /><meshStandardMaterial color="#263b2b" roughness={1} /></mesh>
      <mesh receiveShadow position={[0, -0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[8.1, 64]} /><meshStandardMaterial color="#465333" roughness={1} /></mesh>
      <mesh receiveShadow position={[0.7, -0.055, 0.2]} rotation={[-Math.PI / 2, 0, -0.08]}><planeGeometry args={[13.6, 2.4]} /><meshStandardMaterial color="#6a5a3d" roughness={1} /></mesh>
      <mesh receiveShadow position={[1.1, -0.05, 1.25]} rotation={[-Math.PI / 2, 0, Math.PI / 2.65]}><planeGeometry args={[9.5, 1.5]} /><meshStandardMaterial color="#625239" roughness={1} /></mesh>
      {trees.map(([position, scale], index) => (
        <EnvironmentAsset3D key={`tree-${index}`} assetId="tree" position={position} size={2.6 * scale} rotation={[0, index * 0.71, 0]} testId={index === 0 ? 'environment-tree' : undefined} fallback={<ProceduralTree scale={scale} />} />
      ))}
      {rocks.map((position, index) => <EnvironmentAsset3D key={`rock-${index}`} assetId="rock" position={position} size={0.78 + index * 0.08} rotation={[0, index * 0.63, 0]} testId={index === 0 ? 'environment-rock' : undefined} fallback={<ProceduralRock scale={0.7 + index * 0.08} />} />)}
      {bushes.map((position, index) => <EnvironmentAsset3D key={`bush-${index}`} assetId="bush" position={position} size={0.85 + index * 0.05} rotation={[0, index * 0.8, 0]} testId={index === 0 ? 'environment-bush' : undefined} fallback={<group />} />)}
      <Sparkles count={55} scale={[18, 2.5, 12]} size={1.25} speed={0.08} color="#9ab876" position={[0, 0.35, 0]} />
    </group>
  );
}

function CampScene({ world, actors, selectedHeroId, onSelectHero }: { world: WorldState; actors: Record<string, RuntimeActor>; selectedHeroId: string; onSelectHero: (id: string) => void }) {
  return (
    <>
      <color attach="background" args={['#0d1712']} /><fog attach="fog" args={['#0d1712', 18, 34]} />
      <hemisphereLight args={['#a9c9d6', '#1e2116', 1.2]} /><ambientLight intensity={0.68} />
      <directionalLight castShadow position={[-8, 14, 7]} intensity={2.45} color="#ffe2b5" shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-13} shadow-camera-right={13} shadow-camera-top={10} shadow-camera-bottom={-10} />
      <directionalLight position={[9, 8, -7]} intensity={0.82} color="#789ac4" />
      <GroundAndForest /><WagonHome /><Campfire /><DiningArea /><Workshop /><TrainingArea /><SleepArea /><ReadingNook /><QuietCorner /><DungeonGate /><AsterPresence />
      {Object.values(world.heroes).map((hero) => {
        const actor = actors[hero.id];
        if (!actor || actor.phase === 'away') return null;
        return <HeroBody3D key={hero.id} hero={hero} actor={actor} position={mapPoint(actor.position.x, actor.position.y)} selected={selectedHeroId === hero.id} onSelect={() => onSelectHero(hero.id)} />;
      })}
    </>
  );
}

const fallbackWorld = (): WorldState => {
  const world = createInitialWorld('aster-family-001');
  ensureDailyPlans(world);
  return world;
};

export function CampWorld3DOverlay() {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [world, setWorld] = useState<WorldState>(() => loadWorld() ?? fallbackWorld());
  const [selectedHeroId, setSelectedHeroId] = useState('mira');
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const actors = useRealtimeActors(world, speedMultiplier);

  useEffect(() => {
    const locate = () => setMount(document.querySelector<HTMLElement>('[data-testid="rts-map"]'));
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const refresh = () => {
      const loaded = loadWorld();
      if (loaded) setWorld(loaded);
      const speedButton = [...document.querySelectorAll<HTMLButtonElement>('button')].find((button) => /^x[124]$/.test(button.textContent?.trim() ?? ''));
      const speed = Number(speedButton?.textContent?.trim().slice(1));
      if (speed === 1 || speed === 2 || speed === 4) setSpeedMultiplier(speed);
    };
    refresh();
    const interval = window.setInterval(refresh, 160);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const syncSelection = (event: MouseEvent) => {
      const element = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-testid^="actor-"]');
      const id = element?.getAttribute('data-testid')?.replace('actor-', '');
      if (id && world.heroes[id]) setSelectedHeroId(id);
    };
    document.addEventListener('click', syncSelection);
    return () => document.removeEventListener('click', syncSelection);
  }, [world.heroes]);

  const onSelectHero = (id: string) => {
    setSelectedHeroId(id);
    document.querySelector<HTMLElement>(`[data-testid="actor-${id}"]`)?.click();
  };
  const cameraPosition = useMemo<[number, number, number]>(() => [11.8, 15.8, 13.4], []);
  if (!mount) return null;

  return createPortal(
    <div className="world3d-layer pointer-events-none absolute inset-0 z-[35] overflow-hidden rounded-3xl" data-testid="camp-3d-layer">
      <Canvas orthographic shadows dpr={[1, 1.5]} camera={{ position: cameraPosition, zoom: 58, near: 0.1, far: 80 }} style={{ pointerEvents: 'none' }} onCreated={({ camera, gl, scene }) => { camera.lookAt(0, 0.45, 0); gl.setClearColor(new Color('#0d1712')); gl.shadowMap.enabled = true; scene.background = new Color('#0d1712'); }}>
        <CampScene world={world} actors={actors} selectedHeroId={selectedHeroId} onSelectHero={onSelectHero} />
      </Canvas>
      <div className="world3d-corner-badge" data-testid="camp-3d-status"><span>Живой 3D-лагерь</span><small>CC0-окружение · модульные герои · безопасные fallback-модели</small></div>
    </div>,
    mount,
  );
}
