import { Float, Html, Sparkles } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Group, Mesh } from 'three';
import { Color } from 'three';
import { createInitialWorld, ensureDailyPlans, loadWorld, type WorldState } from '../simulation';
import { useRealtimeActors, type RuntimeActor } from '../rts/realtime';
import { HeroBody3D } from './HeroBody3D';
import './world3d.css';

const mapPoint = (x: number, y: number): [number, number, number] => [
  (x - 50) * 0.18,
  0,
  (y - 50) * 0.125,
];

function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
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

function Rock({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <mesh castShadow receiveShadow position={position} scale={[scale, scale * 0.68, scale * 0.9]} rotation={[0.08, 0.35, -0.06]}>
      <dodecahedronGeometry args={[0.45, 0]} />
      <meshStandardMaterial color="#555d5b" roughness={1} />
    </mesh>
  );
}

function WagonHome() {
  return (
    <group position={[0.4, 0, -1.25]} rotation={[0, -0.05, 0]}>
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
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.72, 0.72, 0.24, 20]} />
            <meshStandardMaterial color="#36271e" roughness={0.9} />
          </mesh>
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.58, 0.06, 8, 24]} />
            <meshStandardMaterial color="#8a633a" roughness={0.82} />
          </mesh>
        </group>
      ))}
      <mesh castShadow position={[-1.2, 1.1, 1.19]}>
        <boxGeometry args={[0.92, 1.48, 0.12]} />
        <meshStandardMaterial color="#6b4427" roughness={0.82} />
      </mesh>
      <mesh castShadow position={[-1.2, 1.18, 1.28]}>
        <boxGeometry args={[0.52, 0.78, 0.04]} />
        <meshStandardMaterial color="#d39a52" emissive="#8a4f1f" emissiveIntensity={0.34} roughness={0.55} />
      </mesh>
      {[-0.2, 1.18].map((x) => (
        <group key={x} position={[x, 1.36, 1.21]}>
          <mesh castShadow>
            <boxGeometry args={[0.64, 0.72, 0.12]} />
            <meshStandardMaterial color="#233333" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0, 0.075]}>
            <boxGeometry args={[0.44, 0.5, 0.025]} />
            <meshStandardMaterial color="#ffd178" emissive="#ffad42" emissiveIntensity={1.1} roughness={0.28} />
          </mesh>
          <pointLight color="#ffb451" intensity={1.8} distance={3} position={[0, 0, 0.3]} />
        </group>
      ))}
      <group position={[-1.2, 0.12, 1.62]}>
        {[0, 1, 2].map((step) => (
          <mesh key={step} castShadow receiveShadow position={[0, step * 0.16, -step * 0.18]}>
            <boxGeometry args={[1.18 - step * 0.12, 0.15, 0.44]} />
            <meshStandardMaterial color="#69452a" roughness={0.92} />
          </mesh>
        ))}
      </group>
      <group position={[0.95, 2.9, -0.2]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.14, 0.18, 0.92, 10]} />
          <meshStandardMaterial color="#2e2925" roughness={0.82} />
        </mesh>
        <mesh castShadow position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.22, 0.16, 0.18, 10]} />
          <meshStandardMaterial color="#3e3932" roughness={0.82} />
        </mesh>
      </group>
      <group position={[2.1, 1.45, -1.23]} rotation={[0, 0, 0]}>
        <mesh castShadow position={[0, 0.45, 0]}>
          <boxGeometry args={[0.08, 1.85, 0.08]} />
          <meshStandardMaterial color="#71482b" roughness={0.86} />
        </mesh>
        <mesh castShadow position={[0, 0.28, 0.04]}>
          <boxGeometry args={[1.08, 1.4, 0.08]} />
          <meshStandardMaterial color="#244b5b" roughness={0.72} />
        </mesh>
        <mesh position={[0, 0.28, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.28, 0.035, 8, 16]} />
          <meshStandardMaterial color="#e6c66c" emissive="#a37d22" emissiveIntensity={0.2} />
        </mesh>
      </group>
      <group position={[1.72, 0.2, 1.4]}>
        <mesh castShadow><cylinderGeometry args={[0.27, 0.31, 0.55, 14]} /><meshStandardMaterial color="#704326" roughness={0.9} /></mesh>
        <mesh castShadow position={[0.52, 0.04, 0.14]}><boxGeometry args={[0.52, 0.45, 0.48]} /><meshStandardMaterial color="#6b4427" roughness={0.94} /></mesh>
      </group>
    </group>
  );
}

function Campfire() {
  const flame = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!flame.current) return;
    const pulse = 0.88 + Math.sin(clock.elapsedTime * 8) * 0.12;
    flame.current.scale.set(pulse, 0.92 + Math.sin(clock.elapsedTime * 10) * 0.16, pulse);
    flame.current.rotation.y = clock.elapsedTime * 0.8;
  });
  return (
    <group position={[-3.1, 0, 1.1]}>
      {Array.from({ length: 12 }, (_, index) => {
        const angle = index / 12 * Math.PI * 2;
        return <Rock key={index} position={[Math.cos(angle) * 0.62, 0.16, Math.sin(angle) * 0.62]} scale={0.28} />;
      })}
      {[0, 1, 2].map((index) => (
        <mesh key={index} castShadow position={[0, 0.24 + index * 0.02, 0]} rotation={[0, index * Math.PI / 3, Math.PI / 2]}>
          <cylinderGeometry args={[0.09, 0.11, 1.05, 8]} />
          <meshStandardMaterial color="#4a2a18" roughness={0.95} />
        </mesh>
      ))}
      <group ref={flame} position={[0, 0.64, 0]}>
        <mesh><coneGeometry args={[0.32, 0.95, 10]} /><meshStandardMaterial color="#ff8b27" emissive="#ff5a12" emissiveIntensity={2.8} transparent opacity={0.9} /></mesh>
        <mesh position={[0, 0.08, 0]}><coneGeometry args={[0.17, 0.64, 10]} /><meshStandardMaterial color="#ffe26d" emissive="#ffcf35" emissiveIntensity={3.2} /></mesh>
      </group>
      <pointLight color="#ff9f45" intensity={7} distance={7.5} position={[0, 1.2, 0]} castShadow />
      <Sparkles count={22} scale={[1.6, 2.2, 1.6]} size={2.1} speed={0.45} color="#ffb65c" position={[0, 1.25, 0]} />
    </group>
  );
}

function DiningArea() {
  return (
    <group position={[-0.2, 0, -3.45]}>
      <mesh castShadow receiveShadow position={[0, 0.62, 0]}>
        <cylinderGeometry args={[1.0, 1.0, 0.16, 16]} />
        <meshStandardMaterial color="#6c4629" roughness={0.86} />
      </mesh>
      <mesh castShadow position={[0, 0.3, 0]}><cylinderGeometry args={[0.16, 0.2, 0.62, 10]} /><meshStandardMaterial color="#49301f" roughness={0.9} /></mesh>
      {[0, 1, 2].map((index) => {
        const angle = index / 3 * Math.PI * 2;
        return (
          <group key={index} position={[Math.cos(angle) * 1.45, 0, Math.sin(angle) * 1.45]} rotation={[0, -angle, 0]}>
            <mesh castShadow receiveShadow position={[0, 0.36, 0]}><boxGeometry args={[0.68, 0.12, 0.42]} /><meshStandardMaterial color="#59402c" roughness={0.9} /></mesh>
            <mesh castShadow position={[0, 0.16, 0]}><boxGeometry args={[0.08, 0.36, 0.08]} /><meshStandardMaterial color="#32271f" /></mesh>
          </group>
        );
      })}
    </group>
  );
}

function Workshop() {
  return (
    <group position={[6.05, 0, 0.8]} rotation={[0, -0.15, 0]}>
      <mesh castShadow receiveShadow position={[0, 0.66, 0]}><boxGeometry args={[2.25, 0.18, 0.88]} /><meshStandardMaterial color="#684326" roughness={0.9} /></mesh>
      {[-0.9, 0.9].map((x) => <mesh key={x} castShadow position={[x, 0.31, 0]}><boxGeometry args={[0.13, 0.7, 0.13]} /><meshStandardMaterial color="#3b2a1d" /></mesh>)}
      <mesh castShadow position={[-0.45, 0.84, 0]} rotation={[0, 0, -0.42]}><boxGeometry args={[0.12, 0.85, 0.12]} /><meshStandardMaterial color="#898f96" metalness={0.45} roughness={0.42} /></mesh>
      <mesh castShadow position={[0.35, 0.8, 0.05]}><boxGeometry args={[0.62, 0.22, 0.42]} /><meshStandardMaterial color="#39424a" metalness={0.35} roughness={0.55} /></mesh>
      <group position={[1.35, 0, -0.25]}>
        <mesh castShadow position={[0, 0.54, 0]}><cylinderGeometry args={[0.28, 0.32, 1.08, 14]} /><meshStandardMaterial color="#744627" roughness={0.9} /></mesh>
        <mesh castShadow position={[0, 1.09, 0]}><torusGeometry args={[0.26, 0.035, 8, 18]} /><meshStandardMaterial color="#292722" metalness={0.5} /></mesh>
      </group>
    </group>
  );
}

function TrainingArea() {
  return (
    <group position={[-5.85, 0, 0.8]}>
      <mesh receiveShadow position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.65, 28]} /><meshStandardMaterial color="#6a5433" roughness={1} /></mesh>
      <group position={[-0.75, 0, 0]}>
        <mesh castShadow position={[0, 1.12, 0]}><cylinderGeometry args={[0.09, 0.12, 2.24, 10]} /><meshStandardMaterial color="#6b472b" roughness={0.9} /></mesh>
        <mesh castShadow position={[0, 1.65, 0]}><cylinderGeometry args={[0.28, 0.32, 0.7, 10]} /><meshStandardMaterial color="#8c5c2f" roughness={0.92} /></mesh>
        <mesh castShadow position={[0, 2.08, 0]}><sphereGeometry args={[0.22, 12, 10]} /><meshStandardMaterial color="#9a7447" roughness={0.9} /></mesh>
      </group>
      <group position={[0.72, 0, -0.25]}>
        {[-0.34, 0, 0.34].map((x, index) => (
          <mesh key={x} castShadow position={[x, 0.82 + index * 0.08, 0]} rotation={[0, 0, index === 1 ? 0.08 : -0.08]}>
            <boxGeometry args={[0.07, 1.65, 0.07]} />
            <meshStandardMaterial color={index === 1 ? '#a9b5bc' : '#795032'} metalness={index === 1 ? 0.35 : 0} roughness={0.72} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function SleepArea() {
  return (
    <group position={[6.3, 0, -3.75]}>
      {[-1, 0, 1].map((offset, index) => (
        <group key={offset} position={[offset * 1.05, 0, index % 2 ? 0.12 : -0.08]} rotation={[0, -0.08, 0]}>
          <mesh castShadow receiveShadow position={[0, 0.18, 0]}><boxGeometry args={[0.9, 0.22, 1.75]} /><meshStandardMaterial color="#4d3528" roughness={0.9} /></mesh>
          <mesh castShadow position={[0, 0.34, -0.12]}><boxGeometry args={[0.78, 0.12, 1.38]} /><meshStandardMaterial color={index === 0 ? '#355c65' : index === 1 ? '#514b7a' : '#6d473e'} roughness={0.88} /></mesh>
          <mesh castShadow position={[0, 0.42, -0.68]}><boxGeometry args={[0.64, 0.14, 0.34]} /><meshStandardMaterial color="#b6aa8b" roughness={0.92} /></mesh>
        </group>
      ))}
    </group>
  );
}

function ReadingNook() {
  return (
    <group position={[0.3, 0, 0.55]}>
      <mesh castShadow receiveShadow position={[0, 0.52, 0]}><boxGeometry args={[1.65, 0.16, 0.9]} /><meshStandardMaterial color="#624027" roughness={0.9} /></mesh>
      <mesh castShadow position={[0, 0.66, 0]} rotation={[-0.15, 0.2, 0]}><boxGeometry args={[0.64, 0.06, 0.48]} /><meshStandardMaterial color="#713c3d" roughness={0.75} /></mesh>
      <mesh position={[0, 0.7, 0.03]} rotation={[-0.15, 0.2, 0]}><boxGeometry args={[0.05, 0.08, 0.5]} /><meshStandardMaterial color="#d1bf91" /></mesh>
      {[-0.62, 0.62].map((x) => <mesh key={x} castShadow position={[x, 0.24, 0]}><boxGeometry args={[0.09, 0.56, 0.09]} /><meshStandardMaterial color="#35271e" /></mesh>)}
    </group>
  );
}

function DungeonGate() {
  return (
    <group position={[6.65, 0, 4.45]} rotation={[0, Math.PI, 0]}>
      <mesh receiveShadow position={[0, 0.06, -0.2]}><boxGeometry args={[4.1, 0.12, 2.8]} /><meshStandardMaterial color="#383c42" roughness={0.96} /></mesh>
      {[-1.45, 1.45].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh castShadow receiveShadow position={[0, 1.15, 0]}><boxGeometry args={[0.72, 2.3, 0.9]} /><meshStandardMaterial color="#4e545a" roughness={0.95} /></mesh>
          <mesh castShadow position={[0, 2.45, 0]}><boxGeometry args={[0.9, 0.42, 1.02]} /><meshStandardMaterial color="#5e6265" roughness={0.95} /></mesh>
        </group>
      ))}
      <mesh castShadow receiveShadow position={[0, 2.55, 0]}>
        <boxGeometry args={[3.58, 0.66, 1.02]} />
        <meshStandardMaterial color="#4b5054" roughness={0.96} />
      </mesh>
      <mesh position={[0, 1.25, 0.46]}><planeGeometry args={[2.2, 2.15]} /><meshStandardMaterial color="#101520" emissive="#131d31" emissiveIntensity={0.55} /></mesh>
      {[-1.92, 1.92].map((x) => (
        <group key={x} position={[x, 0, 0.35]}>
          <mesh castShadow position={[0, 1.05, 0]}><cylinderGeometry args={[0.055, 0.075, 2.1, 8]} /><meshStandardMaterial color="#3a261a" /></mesh>
          <mesh position={[0, 2.16, 0]}><coneGeometry args={[0.18, 0.56, 9]} /><meshStandardMaterial color="#ff8b2d" emissive="#ff6a19" emissiveIntensity={2.6} /></mesh>
          <pointLight color="#ff9a45" intensity={3.5} distance={4.5} position={[0, 1.95, 0]} />
        </group>
      ))}
      <Sparkles count={28} scale={[2.2, 2.5, 1]} size={2.2} speed={0.22} color="#697cff" position={[0, 1.25, 0.2]} />
    </group>
  );
}

function AsterPresence() {
  return (
    <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.35}>
      <group position={mapPoint(15, 16)}>
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
  return (
    <group>
      <mesh receiveShadow position={[0, -0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[20, 14, 1, 1]} />
        <meshStandardMaterial color="#263b2b" roughness={1} />
      </mesh>
      <mesh receiveShadow position={[0, -0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[8.1, 64]} />
        <meshStandardMaterial color="#465333" roughness={1} />
      </mesh>
      <mesh receiveShadow position={[0.7, -0.055, 0.2]} rotation={[-Math.PI / 2, 0, -0.08]} scale={[1, 1, 1]}>
        <planeGeometry args={[13.6, 2.4]} />
        <meshStandardMaterial color="#6a5a3d" roughness={1} />
      </mesh>
      <mesh receiveShadow position={[1.1, -0.05, 1.25]} rotation={[-Math.PI / 2, 0, Math.PI / 2.65]}>
        <planeGeometry args={[9.5, 1.5]} />
        <meshStandardMaterial color="#625239" roughness={1} />
      </mesh>
      {trees.map(([position, scale], index) => <Tree key={index} position={position} scale={scale} />)}
      {[[-7.2, 0.1, -3.9], [-7.6, 0.1, 2.8], [8.0, 0.1, -1.8], [4.4, 0.1, 5.5], [-3.8, 0.1, 5.4]].map((position, index) => <Rock key={index} position={position as [number, number, number]} scale={0.7 + index * 0.08} />)}
      <Sparkles count={75} scale={[18, 2.5, 12]} size={1.25} speed={0.08} color="#9ab876" position={[0, 0.35, 0]} />
    </group>
  );
}

function CampScene({ world, actors, selectedHeroId, onSelectHero }: { world: WorldState; actors: Record<string, RuntimeActor>; selectedHeroId: string; onSelectHero: (id: string) => void }) {
  return (
    <>
      <color attach="background" args={['#101914']} />
      <fog attach="fog" args={['#101914', 18, 34]} />
      <hemisphereLight args={['#9ac8dd', '#202215', 1.3]} />
      <ambientLight intensity={0.78} />
      <directionalLight castShadow position={[-8, 14, 7]} intensity={2.6} color="#ffe3b0" shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-13} shadow-camera-right={13} shadow-camera-top={10} shadow-camera-bottom={-10} />
      <directionalLight position={[9, 8, -7]} intensity={0.7} color="#7ea9d8" />
      <GroundAndForest />
      <WagonHome />
      <Campfire />
      <DiningArea />
      <Workshop />
      <TrainingArea />
      <SleepArea />
      <ReadingNook />
      <DungeonGate />
      <AsterPresence />
      {Object.values(world.heroes).map((hero) => {
        const actor = actors[hero.id];
        if (!actor || actor.phase === 'away') return null;
        return (
          <HeroBody3D
            key={hero.id}
            hero={hero}
            actor={actor}
            position={mapPoint(actor.position.x, actor.position.y)}
            selected={selectedHeroId === hero.id}
            onSelect={() => onSelectHero(hero.id)}
          />
        );
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
  const actors = useRealtimeActors(world, 1);

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
    };
    refresh();
    const interval = window.setInterval(refresh, 160);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const syncSelection = (event: MouseEvent) => {
      const element = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-testid^="actor-"]');
      const id = element?.dataset.testid?.replace('actor-', '') ?? element?.getAttribute('data-testid')?.replace('actor-', '');
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
      <Canvas
        orthographic
        shadows
        dpr={[1, 1.65]}
        camera={{ position: cameraPosition, zoom: 58, near: 0.1, far: 80 }}
        style={{ pointerEvents: 'none' }}
        onCreated={({ camera, gl, scene }) => {
          camera.lookAt(0, 0.45, 0);
          gl.setClearColor(new Color('#101914'));
          gl.shadowMap.enabled = true;
          scene.background = new Color('#101914');
        }}
      >
        <CampScene world={world} actors={actors} selectedHeroId={selectedHeroId} onSelectHero={onSelectHero} />
      </Canvas>
      <div className="world3d-corner-badge" data-testid="camp-3d-status">
        <span>Живой 3D-лагерь</span>
        <small>ортографическая камера · тела из симуляции</small>
      </div>
    </div>,
    mount,
  );
}
