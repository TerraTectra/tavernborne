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

const STORAGE_KEY = 'tavernborne.world.v2';
const mapPoint = (x: number, y: number): [number, number, number] => [
  (x - 50) * 0.18,
  0,
  (y - 50) * 0.125,
];

function FallbackRock({ scale = 1 }: { scale?: number }) {
  return (
    <mesh castShadow receiveShadow scale={[scale, scale * 0.68, scale * 0.9]} rotation={[0.08, 0.35, -0.06]}>
      <dodecahedronGeometry args={[0.45, 0]} />
      <meshStandardMaterial color="#555d5b" roughness={1} />
    </mesh>
  );
}

function FallbackTree({ scale = 1 }: { scale?: number }) {
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

function WagonCanopy() {
  return (
    <group position={[0, 0.08, -0.08]}>
      <mesh castShadow receiveShadow position={[0, 1.42, 0]}>
        <boxGeometry args={[3.45, 1.42, 2.05]} />
        <meshStandardMaterial color="#315f5a" roughness={0.76} />
      </mesh>
      <mesh castShadow position={[0, 2.16, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1.03, 1.03, 3.55, 18, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#264c48" roughness={0.82} side={2} />
      </mesh>
      <mesh castShadow position={[-1.04, 1.35, 1.05]}>
        <boxGeometry args={[0.82, 1.52, 0.12]} />
        <meshStandardMaterial color="#6d472b" roughness={0.88} />
      </mesh>
      {[-0.18, 0.88].map((x) => (
        <mesh key={x} position={[x, 1.52, 1.09]}>
          <boxGeometry args={[0.55, 0.58, 0.06]} />
          <meshStandardMaterial color="#f0b45d" emissive="#a45d24" emissiveIntensity={0.45} roughness={0.55} />
        </mesh>
      ))}
    </group>
  );
}

function WagonHome() {
  return (
    <group position={[0.5, 0, -4.7]} rotation={[0, -0.05, 0]}>
      <WagonCanopy />
      <EnvironmentAsset3D
        assetId="market"
        position={[0, 0, 0.18]}
        rotation={[0, Math.PI, 0]}
        size={4.25}
        castShadow
        testId="environment-home"
        fallback={<group />}
      />
      <EnvironmentAsset3D assetId="crate" position={[1.62, 0, 1.05]} size={0.62} fallback={<group />} />
      <EnvironmentAsset3D assetId="barrel" position={[-1.6, 0, 0.88]} size={0.68} fallback={<group />} />
    </group>
  );
}

function Campfire() {
  const flame = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!flame.current) return;
    const pulse = 0.9 + Math.sin(clock.elapsedTime * 8) * 0.1;
    flame.current.scale.set(pulse, 0.92 + Math.sin(clock.elapsedTime * 10) * 0.14, pulse);
    flame.current.rotation.y = clock.elapsedTime * 0.75;
  });

  return (
    <group position={[-0.2, 0, -2.75]}>
      {Array.from({ length: 10 }, (_, index) => {
        const angle = index / 10 * Math.PI * 2;
        return (
          <group key={index} position={[Math.cos(angle) * 0.58, 0.13, Math.sin(angle) * 0.58]}>
            <FallbackRock scale={0.24} />
          </group>
        );
      })}
      {[0, 1, 2].map((index) => (
        <mesh key={index} castShadow position={[0, 0.22, 0]} rotation={[0, index * Math.PI / 3, Math.PI / 2]}>
          <cylinderGeometry args={[0.08, 0.1, 0.95, 8]} />
          <meshStandardMaterial color="#4a2a18" roughness={0.95} />
        </mesh>
      ))}
      <group ref={flame} position={[0, 0.62, 0]}>
        <mesh><coneGeometry args={[0.3, 0.9, 10]} /><meshStandardMaterial color="#ff8b27" emissive="#ff5a12" emissiveIntensity={2.7} transparent opacity={0.92} /></mesh>
        <mesh position={[0, 0.06, 0]}><coneGeometry args={[0.15, 0.56, 10]} /><meshStandardMaterial color="#ffe26d" emissive="#ffcf35" emissiveIntensity={3.1} /></mesh>
      </group>
      <pointLight color="#ff9f45" intensity={6.2} distance={7} position={[0, 1.15, 0]} />
      <Sparkles count={16} scale={[1.5, 2, 1.5]} size={2} speed={0.4} color="#ffb65c" position={[0, 1.18, 0]} />
      <EnvironmentAsset3D assetId="lamp" position={[-1.25, 0, 0.45]} size={0.78} testId="environment-camp-light" fallback={<group />} />
    </group>
  );
}

function DiningArea() {
  return (
    <group position={[-0.55, 0, -0.9]}>
      <mesh castShadow receiveShadow position={[0, 0.58, 0]}>
        <cylinderGeometry args={[0.92, 0.92, 0.16, 16]} />
        <meshStandardMaterial color="#6c4629" roughness={0.86} />
      </mesh>
      <mesh castShadow position={[0, 0.28, 0]}><cylinderGeometry args={[0.15, 0.2, 0.58, 10]} /><meshStandardMaterial color="#49301f" roughness={0.9} /></mesh>
      {[0, 1, 2].map((index) => {
        const angle = index / 3 * Math.PI * 2;
        return <mesh key={index} castShadow receiveShadow position={[Math.cos(angle) * 1.28, 0.34, Math.sin(angle) * 1.28]} rotation={[0, -angle, 0]}><boxGeometry args={[0.66, 0.12, 0.4]} /><meshStandardMaterial color="#59402c" roughness={0.9} /></mesh>;
      })}
      <EnvironmentAsset3D assetId="barrel" position={[1.55, 0, 0.78]} size={0.62} testId="environment-dining" fallback={<group />} />
    </group>
  );
}

function Workshop() {
  return (
    <group position={[5.05, 0, -0.55]} rotation={[0, -0.15, 0]}>
      <mesh castShadow receiveShadow position={[0, 0.64, 0]}><boxGeometry args={[2.25, 0.18, 0.9]} /><meshStandardMaterial color="#684326" roughness={0.9} /></mesh>
      {[-0.9, 0.9].map((x) => <mesh key={x} castShadow position={[x, 0.3, 0]}><boxGeometry args={[0.13, 0.68, 0.13]} /><meshStandardMaterial color="#3b2a1d" /></mesh>)}
      <mesh castShadow position={[-0.42, 0.83, 0]} rotation={[0, 0, -0.42]}><boxGeometry args={[0.12, 0.82, 0.12]} /><meshStandardMaterial color="#89939a" metalness={0.48} roughness={0.42} /></mesh>
      <mesh castShadow position={[0.38, 0.78, 0.04]}><boxGeometry args={[0.6, 0.2, 0.4]} /><meshStandardMaterial color="#39424a" metalness={0.35} roughness={0.55} /></mesh>
      <EnvironmentAsset3D assetId="crate" position={[1.35, 0, -0.38]} size={0.72} testId="environment-workshop" fallback={<group />} />
      <EnvironmentAsset3D assetId="lamp" position={[-1.3, 0, -0.28]} size={0.68} fallback={<group />} />
    </group>
  );
}

function TrainingArea() {
  return (
    <group position={[-5.25, 0, -0.45]}>
      <mesh receiveShadow position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.65, 28]} /><meshStandardMaterial color="#6a5433" roughness={1} /></mesh>
      <group position={[-0.68, 0, 0]}>
        <mesh castShadow position={[0, 1.1, 0]}><cylinderGeometry args={[0.09, 0.12, 2.2, 10]} /><meshStandardMaterial color="#6b472b" roughness={0.9} /></mesh>
        <mesh castShadow position={[0, 1.62, 0]}><cylinderGeometry args={[0.28, 0.32, 0.68, 10]} /><meshStandardMaterial color="#8c5c2f" roughness={0.92} /></mesh>
        <mesh castShadow position={[0, 2.04, 0]}><sphereGeometry args={[0.22, 12, 10]} /><meshStandardMaterial color="#9a7447" roughness={0.9} /></mesh>
      </group>
      <EnvironmentAsset3D assetId="rock" position={[0.92, 0, -0.18]} size={0.88} testId="environment-training" fallback={<FallbackRock scale={0.8} />} />
    </group>
  );
}

function SleepArea() {
  return (
    <group position={[5.1, 0, -3.65]}>
      {[-1, 0, 1].map((offset, index) => (
        <group key={offset} position={[offset * 1.02, 0, index % 2 ? 0.12 : -0.08]} rotation={[0, -0.08, 0]}>
          <mesh castShadow receiveShadow position={[0, 0.18, 0]}><boxGeometry args={[0.88, 0.22, 1.68]} /><meshStandardMaterial color="#4d3528" roughness={0.9} /></mesh>
          <mesh castShadow position={[0, 0.34, -0.12]}><boxGeometry args={[0.76, 0.12, 1.32]} /><meshStandardMaterial color={index === 0 ? '#355c65' : index === 1 ? '#514b7a' : '#6d473e'} roughness={0.88} /></mesh>
          <mesh castShadow position={[0, 0.42, -0.64]}><boxGeometry args={[0.62, 0.14, 0.32]} /><meshStandardMaterial color="#b6aa8b" roughness={0.92} /></mesh>
        </group>
      ))}
      <EnvironmentAsset3D assetId="crate" position={[1.75, 0, 0.52]} size={0.58} fallback={<group />} />
    </group>
  );
}

function ReadingNook() {
  return (
    <group position={[0.05, 0, 1.05]}>
      <mesh castShadow receiveShadow position={[0, 0.46, 0]}><boxGeometry args={[1.45, 0.14, 0.82]} /><meshStandardMaterial color="#624027" roughness={0.9} /></mesh>
      <EnvironmentAsset3D assetId="shrine" position={[0, 0.55, 0]} size={0.62} testId="environment-reading" fallback={<group />} />
      <EnvironmentAsset3D assetId="lamp" position={[1.02, 0, -0.18]} size={0.62} fallback={<group />} />
    </group>
  );
}

function QuietCorner() {
  return (
    <group position={[-5.05, 0, 4.15]}>
      <EnvironmentAsset3D assetId="shrine" size={1.1} testId="environment-shrine" fallback={<FallbackRock scale={1.2} />} />
      <Sparkles count={18} scale={[2, 1.3, 2]} size={1.5} speed={0.08} color="#9f8ccf" position={[0.45, 0.58, -0.18]} />
    </group>
  );
}

function DungeonGate() {
  return (
    <group position={[5.45, 0, 4.35]} rotation={[0, Math.PI, 0]}>
      <mesh receiveShadow position={[0, 0.05, -0.2]}><boxGeometry args={[3.8, 0.12, 2.5]} /><meshStandardMaterial color="#383c42" roughness={0.96} /></mesh>
      {[-1.3, 1.3].map((x) => <mesh key={x} castShadow receiveShadow position={[x, 1.1, 0]}><boxGeometry args={[0.64, 2.2, 0.82]} /><meshStandardMaterial color="#4e545a" roughness={0.95} /></mesh>)}
      <mesh castShadow receiveShadow position={[0, 2.35, 0]}><boxGeometry args={[3.2, 0.62, 0.92]} /><meshStandardMaterial color="#4b5054" roughness={0.96} /></mesh>
      <mesh position={[0, 1.2, 0.42]}><planeGeometry args={[2.05, 2]} /><meshStandardMaterial color="#101520" emissive="#131d31" emissiveIntensity={0.55} /></mesh>
      <EnvironmentAsset3D assetId="lamp" position={[-1.72, 0, 0.28]} size={0.78} testId="environment-dungeon-gate" fallback={<group />} />
      <EnvironmentAsset3D assetId="lamp" position={[1.72, 0, 0.28]} size={0.78} fallback={<group />} />
      <Sparkles count={22} scale={[2.1, 2.4, 1]} size={2.1} speed={0.2} color="#697cff" position={[0, 1.2, 0.2]} />
    </group>
  );
}

function AsterPresence() {
  return (
    <Float speed={1.4} rotationIntensity={0.22} floatIntensity={0.32}>
      <group position={mapPoint(16, 17)}>
        <mesh castShadow position={[0, 1.35, 0]}><sphereGeometry args={[0.3, 18, 14]} /><meshStandardMaterial color="#e4b35f" emissive="#c98328" emissiveIntensity={0.7} /></mesh>
        <mesh castShadow position={[0, 0.65, 0]} scale={[0.72, 1.2, 0.52]}><capsuleGeometry args={[0.36, 0.7, 5, 12]} /><meshStandardMaterial color="#735128" metalness={0.24} roughness={0.58} /></mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 1.76, 0]}><torusGeometry args={[0.46, 0.035, 8, 28]} /><meshStandardMaterial color="#ffe69a" emissive="#ffbf42" emissiveIntensity={2} /></mesh>
        <pointLight color="#ffd477" intensity={3} distance={4.2} position={[0, 1.4, 0]} />
        <Html center position={[0, 2.2, 0]}><span className="world3d-god-label">Астер</span></Html>
      </group>
    </Float>
  );
}

function GroundAndForest() {
  const trees: Array<[[number, number, number], number]> = [
    [[-8.9, 0, -5.3], 1.25], [[-6.7, 0, -5.8], 1.05], [[5.8, 0, -5.75], 1.08],
    [[8.7, 0, -3.7], 1.2], [[-8.8, 0, 2.8], 1.12], [[-6.4, 0, 5.55], 1.0],
    [[2.7, 0, 5.9], 0.92], [[8.7, 0, 3.2], 1.05],
  ];
  const rocks: [number, number, number][] = [[-7.1, 0.1, -3.7], [7.75, 0.1, -1.55], [4.2, 0.1, 5.25]];
  const bushes: [number, number, number][] = [[-6.5, 0, -4.55], [7.0, 0, 3.45], [-5.85, 0, 5.15]];

  return (
    <group>
      <mesh receiveShadow position={[0, -0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[20, 14]} /><meshStandardMaterial color="#263b2b" roughness={1} /></mesh>
      <mesh receiveShadow position={[0, -0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[8.1, 64]} /><meshStandardMaterial color="#465333" roughness={1} /></mesh>
      <mesh receiveShadow position={[0.7, -0.055, 0.2]} rotation={[-Math.PI / 2, 0, -0.08]}><planeGeometry args={[13.6, 2.4]} /><meshStandardMaterial color="#6a5a3d" roughness={1} /></mesh>
      <mesh receiveShadow position={[1.1, -0.05, 1.25]} rotation={[-Math.PI / 2, 0, Math.PI / 2.65]}><planeGeometry args={[9.5, 1.5]} /><meshStandardMaterial color="#625239" roughness={1} /></mesh>
      {trees.map(([position, scale], index) => (
        <EnvironmentAsset3D key={`tree-${index}`} assetId="tree" position={position} size={2.45 * scale} rotation={[0, index * 0.71, 0]} testId={index === 0 ? 'environment-tree' : undefined} fallback={<FallbackTree scale={scale} />} />
      ))}
      {rocks.map((position, index) => <EnvironmentAsset3D key={`rock-${index}`} assetId="rock" position={position} size={0.72 + index * 0.08} rotation={[0, index * 0.63, 0]} testId={index === 0 ? 'environment-rock' : undefined} fallback={<FallbackRock scale={0.68 + index * 0.08} />} />)}
      {bushes.map((position, index) => <EnvironmentAsset3D key={`bush-${index}`} assetId="bush" position={position} size={0.78 + index * 0.05} rotation={[0, index * 0.8, 0]} testId={index === 0 ? 'environment-bush' : undefined} fallback={<group />} />)}
      <Sparkles count={46} scale={[18, 2.2, 12]} size={1.15} speed={0.07} color="#9ab876" position={[0, 0.32, 0]} />
    </group>
  );
}

function CampScene({ world, actors, selectedHeroId, onSelectHero }: { world: WorldState; actors: Record<string, RuntimeActor>; selectedHeroId: string; onSelectHero: (id: string) => void }) {
  return (
    <>
      <color attach="background" args={['#0d1712']} /><fog attach="fog" args={['#0d1712', 18, 34]} />
      <hemisphereLight args={['#a9c9d6', '#1e2116', 1.15]} /><ambientLight intensity={0.64} />
      <directionalLight castShadow position={[-8, 14, 7]} intensity={2.35} color="#ffe2b5" shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-13} shadow-camera-right={13} shadow-camera-top={10} shadow-camera-bottom={-10} />
      <directionalLight position={[9, 8, -7]} intensity={0.78} color="#789ac4" />
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
  const lastWorldPayload = useRef<string | null>(null);
  const actors = useRealtimeActors(world, speedMultiplier);

  useEffect(() => {
    let observer: MutationObserver | null = null;
    const locate = () => {
      const next = document.querySelector<HTMLElement>('[data-testid="rts-map"]');
      if (!next) return false;
      setMount(next);
      observer?.disconnect();
      return true;
    };
    if (!locate()) {
      observer = new MutationObserver(locate);
      observer.observe(document.body, { childList: true, subtree: true });
    }
    return () => observer?.disconnect();
  }, []);

  useEffect(() => {
    const refresh = () => {
      const payload = window.localStorage.getItem(STORAGE_KEY);
      if (payload && payload !== lastWorldPayload.current) {
        lastWorldPayload.current = payload;
        const loaded = loadWorld();
        if (loaded) setWorld(loaded);
      }
      const speedButton = [...document.querySelectorAll<HTMLButtonElement>('button')].find((button) => /^x[124]$/.test(button.textContent?.trim() ?? ''));
      const speed = Number(speedButton?.textContent?.trim().slice(1));
      if (speed === 1 || speed === 2 || speed === 4) setSpeedMultiplier((current) => current === speed ? current : speed);
    };
    refresh();
    const interval = window.setInterval(refresh, 420);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const syncSelection = (event: MouseEvent) => {
      const element = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-testid^="actor-"]');
      const id = element?.getAttribute('data-testid')?.replace('actor-', '');
      if (id) setSelectedHeroId(id);
    };
    document.addEventListener('click', syncSelection);
    return () => document.removeEventListener('click', syncSelection);
  }, []);

  const onSelectHero = (id: string) => {
    setSelectedHeroId(id);
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-testid="actor-${id}"]`)?.click());
  };
  const cameraPosition = useMemo<[number, number, number]>(() => [11.8, 15.8, 13.4], []);
  if (!mount) return null;

  return createPortal(
    <div className="world3d-layer pointer-events-none absolute inset-0 z-[35] overflow-hidden rounded-3xl" data-testid="camp-3d-layer">
      <Canvas orthographic shadows dpr={[1, 1.25]} camera={{ position: cameraPosition, zoom: 58, near: 0.1, far: 80 }} style={{ pointerEvents: 'none' }} onCreated={({ camera, gl, scene }) => { camera.lookAt(0, 0.45, 0); gl.setClearColor(new Color('#0d1712')); gl.shadowMap.enabled = true; scene.background = new Color('#0d1712'); }}>
        <CampScene world={world} actors={actors} selectedHeroId={selectedHeroId} onSelectHero={onSelectHero} />
      </Canvas>
      <div className="world3d-corner-badge" data-testid="camp-3d-status"><span>Живой 3D-лагерь</span><small>CC0-пропсы · модульные герои · гибридная кибитка</small></div>
    </div>,
    mount,
  );
}
