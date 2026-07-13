import { Canvas } from '@react-three/fiber';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ACESFilmicToneMapping, Color, SRGBColorSpace } from 'three';
import { dungeonExplorationOf, loadWorld, type WorldState } from '../simulation';
import './visual-polish.css';

const STORAGE_KEY = 'tavernborne.world.v2';

type DungeonExploration = NonNullable<ReturnType<typeof dungeonExplorationOf>>;
type DungeonRoom = DungeonExploration['rooms'][number];

const roomAccent: Record<DungeonRoom['kind'], string> = {
  entrance: '#708493',
  hall: '#697780',
  fork: '#71818a',
  trap: '#ad8144',
  cache: '#a99a5a',
  enemy: '#a55e5e',
  refuge: '#5fa696',
};

const mapPoint = (x: number, y: number): [number, number, number] => [
  (x - 50) * 0.19,
  0,
  (y - 50) * 0.118,
];

function usePortalTarget(selector: string) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let observer: MutationObserver | null = null;
    const locate = () => {
      const next = document.querySelector<HTMLElement>(selector);
      setTarget((current) => current === next ? current : next);
      return Boolean(next);
    };

    locate();
    observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer?.disconnect();
  }, [selector]);

  return target;
}

function useWorldSnapshot() {
  const [world, setWorld] = useState<WorldState | null>(() => loadWorld() ?? null);
  const previousPayload = useRef<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      const payload = window.localStorage.getItem(STORAGE_KEY);
      if (!payload || payload === previousPayload.current) return;
      previousPayload.current = payload;
      const loaded = loadWorld();
      if (loaded) setWorld(loaded);
    };

    refresh();
    const interval = window.setInterval(refresh, 420);
    return () => window.clearInterval(interval);
  }, []);

  return world;
}

function StoneBlock({
  position,
  scale,
  tone = 0,
}: {
  position: [number, number, number];
  scale: [number, number, number];
  tone?: number;
}) {
  const colors = ['#48515a', '#515b64', '#424a52'];
  return (
    <mesh castShadow receiveShadow position={position} scale={scale}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={colors[Math.abs(tone) % colors.length]} roughness={0.93} metalness={0.03} />
    </mesh>
  );
}

function HorizontalWall({ length, z, side = 1 }: { length: number; z: number; side?: number }) {
  const count = Math.max(2, Math.ceil(length / 0.72));
  const block = length / count;
  return (
    <group position={[0, 0, z]}>
      {Array.from({ length: count }, (_, index) => {
        const x = -length / 2 + block / 2 + index * block;
        const height = 0.54 + ((index + side) % 3) * 0.08;
        return <StoneBlock key={index} position={[x, height / 2, 0]} scale={[block * 0.94, height, 0.2]} tone={index + side} />;
      })}
      <StoneBlock position={[0, 0.72, 0]} scale={[length + 0.12, 0.12, 0.25]} tone={2} />
    </group>
  );
}

function VerticalWall({ depth, x, side = 1 }: { depth: number; x: number; side?: number }) {
  const count = Math.max(2, Math.ceil(depth / 0.7));
  const block = depth / count;
  return (
    <group position={[x, 0, 0]}>
      {Array.from({ length: count }, (_, index) => {
        const z = -depth / 2 + block / 2 + index * block;
        const height = 0.52 + ((index + side) % 3) * 0.08;
        return <StoneBlock key={index} position={[0, height / 2, z]} scale={[0.2, height, block * 0.94]} tone={index + side} />;
      })}
      <StoneBlock position={[0, 0.71, 0]} scale={[0.25, 0.12, depth + 0.12]} tone={1} />
    </group>
  );
}

function CornerPillar({ position, tone }: { position: [number, number, number]; tone: number }) {
  return (
    <group position={position}>
      <StoneBlock position={[0, 0.22, 0]} scale={[0.36, 0.44, 0.36]} tone={tone} />
      <StoneBlock position={[0, 0.62, 0]} scale={[0.31, 0.36, 0.31]} tone={tone + 1} />
      <StoneBlock position={[0, 0.87, 0]} scale={[0.42, 0.12, 0.42]} tone={tone + 2} />
    </group>
  );
}

function EntranceArch({ width }: { width: number }) {
  const span = Math.min(1.6, width * 0.62);
  return (
    <group position={[0, 0, width * 0.03]}>
      <CornerPillar position={[-span / 2, 0, 0]} tone={0} />
      <CornerPillar position={[span / 2, 0, 0]} tone={1} />
      <StoneBlock position={[0, 1.02, 0]} scale={[span + 0.36, 0.26, 0.42]} tone={2} />
      <mesh position={[0, 0.68, 0.03]}>
        <planeGeometry args={[span * 0.74, 0.78]} />
        <meshStandardMaterial color="#0b1017" emissive="#192338" emissiveIntensity={0.42} transparent opacity={0.84} />
      </mesh>
    </group>
  );
}

function ModularRoom({ room }: { room: DungeonRoom }) {
  if (!room.discovered) return null;
  const [x, , z] = mapPoint(room.x, room.y);
  const width = Math.max(1.5, room.width * 0.17);
  const depth = Math.max(1.35, room.height * 0.13);
  const accent = roomAccent[room.kind];

  return (
    <group position={[x, 0.04, z]}>
      <mesh receiveShadow position={[0, 0.005, 0]}>
        <boxGeometry args={[width * 0.94, 0.08, depth * 0.92]} />
        <meshStandardMaterial color="#303841" roughness={0.96} />
      </mesh>
      <mesh receiveShadow position={[0, 0.052, 0]}>
        <boxGeometry args={[width * 0.78, 0.025, depth * 0.74]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.045} roughness={0.9} />
      </mesh>
      <HorizontalWall length={width} z={-depth / 2} side={1} />
      <VerticalWall depth={depth} x={-width / 2} side={2} />
      <VerticalWall depth={depth} x={width / 2} side={3} />
      <CornerPillar position={[-width / 2, 0, -depth / 2]} tone={0} />
      <CornerPillar position={[width / 2, 0, -depth / 2]} tone={2} />
      {room.kind === 'entrance' && <EntranceArch width={width} />}
      {room.kind === 'refuge' && <pointLight color="#71e0ca" intensity={1.7} distance={3.2} position={[0, 1.25, 0]} />}
      {room.kind === 'cache' && <pointLight color="#f2c76e" intensity={1.25} distance={2.7} position={[0, 0.85, 0]} />}
      {room.kind === 'enemy' && <pointLight color="#e45f59" intensity={1.1} distance={2.6} position={[0, 0.9, 0]} />}
    </group>
  );
}

function ModularCorridor({
  from,
  to,
  revealed,
  route,
}: {
  from: DungeonRoom;
  to: DungeonRoom;
  revealed: boolean;
  route: boolean;
}) {
  if (!revealed) return null;
  const [fx, , fz] = mapPoint(from.x, from.y);
  const [tx, , tz] = mapPoint(to.x, to.y);
  const dx = tx - fx;
  const dz = tz - fz;
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);
  const count = Math.max(2, Math.ceil(length / 0.78));
  const segment = length / count;

  return (
    <group position={[(fx + tx) / 2, 0.08, (fz + tz) / 2]} rotation={[0, angle, 0]}>
      <mesh receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[0.8, 0.08, length]} />
        <meshStandardMaterial color="#343d46" roughness={0.97} />
      </mesh>
      <mesh receiveShadow position={[0, 0.052, 0]}>
        <boxGeometry args={[route ? 0.16 : 0.08, 0.02, length * 0.96]} />
        <meshStandardMaterial color={route ? '#d2a751' : '#5d6974'} emissive={route ? '#9d6c1f' : '#000000'} emissiveIntensity={route ? 0.22 : 0} roughness={0.74} />
      </mesh>
      {[-0.48, 0.48].map((x, side) => (
        <group key={x} position={[x, 0, 0]}>
          {Array.from({ length: count }, (_, index) => {
            const z = -length / 2 + segment / 2 + index * segment;
            const height = 0.3 + ((index + side) % 2) * 0.08;
            return <StoneBlock key={index} position={[0, height / 2, z]} scale={[0.18, height, segment * 0.9]} tone={index + side} />;
          })}
        </group>
      ))}
    </group>
  );
}

function ModularDungeonArchitecture({ exploration }: { exploration: DungeonExploration }) {
  const roomsById = useMemo(
    () => Object.fromEntries(exploration.rooms.map((room) => [room.id, room])) as Record<string, DungeonRoom>,
    [exploration.rooms],
  );
  const routePairs = useMemo(
    () => new Set(exploration.routeHistory.slice(0, -1).map((id, index) => `${id}:${exploration.routeHistory[index + 1]}`)),
    [exploration.routeHistory],
  );

  return (
    <>
      <ambientLight intensity={0.42} />
      <hemisphereLight args={['#7d9ab2', '#13110e', 0.58]} />
      <directionalLight castShadow position={[-7, 12, 8]} intensity={1.2} color="#c5d8e8" shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      {exploration.corridors.map((corridor) => {
        const from = roomsById[corridor.fromId];
        const to = roomsById[corridor.toId];
        if (!from || !to) return null;
        const route = routePairs.has(`${corridor.fromId}:${corridor.toId}`) || routePairs.has(`${corridor.toId}:${corridor.fromId}`);
        return <ModularCorridor key={corridor.id} from={from} to={to} revealed={Boolean(from.discovered && to.discovered)} route={route} />;
      })}
      {exploration.rooms.map((room) => <ModularRoom key={room.id} room={room} />)}
    </>
  );
}

function CampPolishPortal({ target }: { target: HTMLElement }) {
  return createPortal(
    <div
      className="visual-polish-camp-layer"
      data-testid="visual-polish-camp-layer"
      data-visual-polish="v1"
      data-lighting-rig="warm-cinematic"
      data-camera-framing="focused-1.025"
      aria-hidden="true"
    >
      <span className="visual-polish-camp-sun" />
      <span className="visual-polish-camp-firelight" />
      <span className="visual-polish-camp-vignette" />
      <span className="visual-polish-grain" />
    </div>,
    target,
  );
}

function DungeonPolishPortal({ target, exploration }: { target: HTMLElement; exploration: DungeonExploration }) {
  const cameraPosition = useMemo<[number, number, number]>(() => [10.8, 15.5, 13.8], []);
  return createPortal(
    <div
      className="visual-polish-dungeon-layer"
      data-testid="visual-polish-dungeon-layer"
      data-visual-polish="v1"
      data-dungeon-kit="modular-stone-v1"
      data-room-count={exploration.rooms.filter((room) => room.discovered).length}
      aria-hidden="true"
    >
      <Canvas
        orthographic
        shadows
        dpr={[1, 1.25]}
        camera={{ position: cameraPosition, zoom: 55, near: 0.1, far: 80 }}
        onCreated={({ camera, gl, scene }) => {
          camera.lookAt(0, 0.4, 0);
          gl.setClearColor(new Color('#000000'), 0);
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.08;
          gl.outputColorSpace = SRGBColorSpace;
          scene.background = null;
        }}
      >
        <ModularDungeonArchitecture exploration={exploration} />
      </Canvas>
      <span className="visual-polish-dungeon-vignette" />
      <span className="visual-polish-grain" />
    </div>,
    target,
  );
}

export function VisualPolishManager() {
  const campTarget = usePortalTarget('[data-testid="rts-map"]');
  const dungeonTarget = usePortalTarget('[data-testid="dungeon-rts-map"]');
  const world = useWorldSnapshot();
  const expedition = world?.expeditions.find((candidate) => candidate.status === 'active' || candidate.status === 'planned');
  const exploration = expedition ? dungeonExplorationOf(expedition) : null;

  return (
    <>
      {campTarget && <CampPolishPortal target={campTarget} />}
      {dungeonTarget && exploration && <DungeonPolishPortal target={dungeonTarget} exploration={exploration} />}
    </>
  );
}
