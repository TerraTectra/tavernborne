import { Html, Line, Sparkles } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import { Color, DoubleSide } from 'three';
import {
  dungeonExplorationOf,
  type DungeonActorStatus,
  type DungeonExplorationPhase,
  type DungeonRole,
  type DungeonRoom,
  type Expedition,
  type WorldState,
} from '../simulation';
import type { RuntimeActor } from '../rts/realtime';
import { HeroBody3D } from './HeroBody3D';
import './world3d.css';

interface DungeonWorld3DProps {
  world: WorldState;
  expedition: Expedition;
}

const phaseLabels: Record<DungeonExplorationPhase, string> = {
  entering: 'Вход на этаж',
  scouting: 'Разведка впереди строя',
  choosing: 'Выбор маршрута',
  crossing: 'Преодоление прохода',
  looting: 'Осмотр находки',
  assessing: 'Оценка угрозы',
  returning: 'Возвращение к выходу',
  completed: 'Исследование завершено',
};

const roleLabels: Record<DungeonRole, string> = {
  leader: 'лидер',
  vanguard: 'авангард',
  scout: 'разведчик',
  support: 'поддержка',
};

const statusLabels: Record<DungeonActorStatus, string> = {
  moving: 'идёт в строю',
  scouting: 'разведывает',
  guarding: 'держит позицию',
  searching: 'осматривает',
  warning: 'предупреждает',
  helping: 'помогает',
  returning: 'возвращается',
};

const roleColor: Record<DungeonRole, string> = {
  leader: '#f2c66d',
  vanguard: '#ee795d',
  scout: '#62b8ef',
  support: '#a88ce8',
};

const roomColor: Record<DungeonRoom['kind'], string> = {
  entrance: '#44525d',
  hall: '#3d464d',
  fork: '#46525a',
  trap: '#604d35',
  cache: '#4d503c',
  enemy: '#50383b',
  refuge: '#3c514c',
};

const mapPoint = (x: number, y: number): [number, number, number] => [
  (x - 50) * 0.19,
  0,
  (y - 50) * 0.118,
];

function Corridor({ from, to, revealed, route }: { from: DungeonRoom; to: DungeonRoom; revealed: boolean; route: boolean }) {
  const [fx, , fz] = mapPoint(from.x, from.y);
  const [tx, , tz] = mapPoint(to.x, to.y);
  const dx = tx - fx;
  const dz = tz - fz;
  const length = Math.hypot(dx, dz);
  const center: [number, number, number] = [(fx + tx) / 2, revealed ? 0.01 : -0.02, (fz + tz) / 2];
  const angle = Math.atan2(dx, dz);
  return (
    <group>
      <mesh receiveShadow position={center} rotation={[0, angle, 0]}>
        <boxGeometry args={[revealed ? 0.86 : 0.52, 0.12, length]} />
        <meshStandardMaterial color={revealed ? '#3d4650' : '#151a20'} roughness={1} />
      </mesh>
      {route && revealed && (
        <Line points={[[fx, 0.12, fz], [tx, 0.12, tz]]} color="#e3b45c" lineWidth={2.4} transparent opacity={0.72} />
      )}
    </group>
  );
}

function Chest({ opened }: { opened: boolean }) {
  return (
    <group position={[0, 0.18, 0]} rotation={[0, -0.25, 0]}>
      <mesh castShadow receiveShadow><boxGeometry args={[0.72, 0.42, 0.5]} /><meshStandardMaterial color="#6f4424" roughness={0.82} /></mesh>
      <mesh castShadow position={[0, opened ? 0.55 : 0.28, opened ? -0.18 : 0]} rotation={[opened ? -0.9 : 0, 0, 0]}>
        <boxGeometry args={[0.76, 0.16, 0.54]} />
        <meshStandardMaterial color="#8b5b2c" roughness={0.78} />
      </mesh>
      <mesh position={[0, 0.2, 0.265]}><boxGeometry args={[0.16, 0.18, 0.04]} /><meshStandardMaterial color="#d0a54c" metalness={0.65} roughness={0.35} /></mesh>
      {opened && <pointLight color="#ffd166" intensity={2.2} distance={3} position={[0, 0.65, 0]} />}
    </group>
  );
}

function StoneGuard() {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.rotation.y = Math.sin(clock.elapsedTime * 0.5) * 0.08;
    group.current.position.y = 0.02 + Math.sin(clock.elapsedTime * 1.1) * 0.015;
  });
  return (
    <group ref={group} position={[0, 0.02, 0]}>
      <mesh castShadow position={[0, 0.72, 0]} scale={[1.15, 1.25, 0.8]}><dodecahedronGeometry args={[0.62, 0]} /><meshStandardMaterial color="#595e62" roughness={0.94} /></mesh>
      <mesh castShadow position={[0, 1.48, 0]}><dodecahedronGeometry args={[0.38, 0]} /><meshStandardMaterial color="#676c70" roughness={0.92} /></mesh>
      {[-0.66, 0.66].map((x) => <mesh key={x} castShadow position={[x, 0.82, 0]} rotation={[0, 0, x < 0 ? 0.12 : -0.12]}><capsuleGeometry args={[0.16, 0.82, 4, 8]} /><meshStandardMaterial color="#555a5e" roughness={0.94} /></mesh>)}
      {[-0.28, 0.28].map((x) => <mesh key={x} position={[x, 1.53, 0.34]}><sphereGeometry args={[0.055, 10, 8]} /><meshStandardMaterial color="#ef5e4e" emissive="#ff352e" emissiveIntensity={2.2} /></mesh>)}
      <pointLight color="#ff4d40" intensity={1.5} distance={2.4} position={[0, 1.52, 0.4]} />
    </group>
  );
}

function TrapPlates({ detected }: { detected: boolean | undefined }) {
  return (
    <group>
      {[-0.5, 0, 0.5].flatMap((x) => [-0.42, 0.1, 0.62].map((z) => (
        <mesh key={`${x}-${z}`} receiveShadow position={[x, 0.08, z]}>
          <boxGeometry args={[0.72, 0.1, 0.62]} />
          <meshStandardMaterial color={detected ? '#9b7837' : '#4b4d49'} emissive={detected ? '#7a4b11' : '#000000'} emissiveIntensity={detected ? 0.28 : 0} roughness={0.92} />
        </mesh>
      )))}
      {detected && <Sparkles count={18} scale={[2.1, 0.6, 2]} size={2.2} color="#ffc75e" position={[0, 0.34, 0.1]} />}
    </group>
  );
}

function Refuge() {
  return (
    <group>
      <mesh receiveShadow position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.15, 28]} /><meshStandardMaterial color="#385148" roughness={1} /></mesh>
      <mesh castShadow position={[0, 0.28, 0]}><cylinderGeometry args={[0.76, 0.92, 0.48, 12]} /><meshStandardMaterial color="#434b46" roughness={0.94} /></mesh>
      <mesh position={[0, 0.56, 0]}><sphereGeometry args={[0.18, 14, 10]} /><meshStandardMaterial color="#73d6c3" emissive="#42bfa8" emissiveIntensity={1.7} /></mesh>
      <pointLight color="#65d9c4" intensity={2.4} distance={3.8} position={[0, 0.78, 0]} />
    </group>
  );
}

function RoomFeature({ room, exploration }: { room: DungeonRoom; exploration: NonNullable<ReturnType<typeof dungeonExplorationOf>> }) {
  if (!room.discovered) return null;
  if (room.kind === 'trap') return <TrapPlates detected={exploration.trapDetected} />;
  if (room.kind === 'cache') return <Chest opened={exploration.chestOpened} />;
  if (room.kind === 'enemy' && exploration.enemySpotted) return <StoneGuard />;
  if (room.kind === 'refuge') return <Refuge />;
  if (room.kind === 'entrance') {
    return (
      <group position={[0, 0, 0.5]}>
        {[-0.8, 0.8].map((x) => <mesh key={x} castShadow position={[x, 0.72, 0]}><boxGeometry args={[0.38, 1.44, 0.42]} /><meshStandardMaterial color="#59626b" roughness={0.96} /></mesh>)}
        <mesh castShadow position={[0, 1.42, 0]}><boxGeometry args={[1.95, 0.38, 0.46]} /><meshStandardMaterial color="#5d646a" roughness={0.96} /></mesh>
      </group>
    );
  }
  return null;
}

function DungeonRoom3D({ room, exploration }: { room: DungeonRoom; exploration: NonNullable<ReturnType<typeof dungeonExplorationOf>> }) {
  const [x, , z] = mapPoint(room.x, room.y);
  const width = Math.max(1.5, room.width * 0.17);
  const depth = Math.max(1.35, room.height * 0.13);
  const discovered = room.discovered;
  return (
    <group position={[x, 0, z]}>
      <mesh receiveShadow position={[0, -0.02, 0]}>
        <boxGeometry args={[width, 0.18, depth]} />
        <meshStandardMaterial color={discovered ? roomColor[room.kind] : '#11151a'} roughness={1} />
      </mesh>
      {discovered && (
        <>
          <mesh castShadow receiveShadow position={[0, 0.38, -depth / 2]}><boxGeometry args={[width, 0.78, 0.18]} /><meshStandardMaterial color="#30363c" roughness={0.98} /></mesh>
          <mesh castShadow receiveShadow position={[-width / 2, 0.38, 0]}><boxGeometry args={[0.18, 0.78, depth]} /><meshStandardMaterial color="#343a40" roughness={0.98} /></mesh>
          <mesh castShadow receiveShadow position={[width / 2, 0.38, 0]}><boxGeometry args={[0.18, 0.78, depth]} /><meshStandardMaterial color="#343a40" roughness={0.98} /></mesh>
          <RoomFeature room={room} exploration={exploration} />
          <Html center position={[0, 1.72, 0]} zIndexRange={[30, 10]}>
            <div className="dungeon3d-room-label" data-testid={`dungeon-room-${room.id}`} data-discovered="true" data-visited={room.visited ? 'true' : 'false'}>
              <strong>{room.label}</strong><span>опасность {room.danger}</span>
            </div>
          </Html>
        </>
      )}
      {!discovered && (
        <>
          <mesh position={[0, 0.56, 0]}>
            <boxGeometry args={[width * 0.94, 1.25, depth * 0.94]} />
            <meshStandardMaterial color="#080b10" transparent opacity={0.86} side={DoubleSide} />
          </mesh>
          <Sparkles count={28} scale={[width, 1.1, depth]} size={3} speed={0.09} color="#263342" position={[0, 0.65, 0]} />
          <Html center position={[0, 0.9, 0]} zIndexRange={[15, 5]}>
            <div className="dungeon3d-fog-label" data-testid={`dungeon-room-${room.id}`} data-discovered="false" data-visited="false">?</div>
          </Html>
        </>
      )}
    </group>
  );
}

function DungeonScene({ world, expedition }: DungeonWorld3DProps) {
  const exploration = dungeonExplorationOf(expedition);
  if (!exploration) return null;
  const roomsById = Object.fromEntries(exploration.rooms.map((room) => [room.id, room]));
  const routePairs = new Set(exploration.routeHistory.slice(0, -1).map((id, index) => `${id}:${exploration.routeHistory[index + 1]}`));
  return (
    <>
      <color attach="background" args={['#080b10']} />
      <fog attach="fog" args={['#080b10', 17, 30]} />
      <ambientLight intensity={0.48} />
      <hemisphereLight args={['#6f8ca7', '#16120e', 0.82]} />
      <directionalLight castShadow position={[-8, 13, 9]} intensity={1.45} color="#a8c5de" shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-13} shadow-camera-right={13} shadow-camera-top={9} shadow-camera-bottom={-9} />
      <pointLight color="#668dff" intensity={3.2} distance={14} position={[0, 5, 0]} />
      <mesh receiveShadow position={[0, -0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[22, 14]} /><meshStandardMaterial color="#14191e" roughness={1} /></mesh>
      {exploration.corridors.map((corridor) => {
        const from = roomsById[corridor.fromId];
        const to = roomsById[corridor.toId];
        if (!from || !to) return null;
        const route = routePairs.has(`${corridor.fromId}:${corridor.toId}`) || routePairs.has(`${corridor.toId}:${corridor.fromId}`);
        return <Corridor key={corridor.id} from={from} to={to} revealed={from.discovered && to.discovered} route={route} />;
      })}
      {exploration.rooms.map((room) => <DungeonRoom3D key={room.id} room={room} exploration={exploration} />)}
      {Object.values(exploration.actors).map((dungeonActor) => {
        const hero = world.heroes[dungeonActor.heroId];
        if (!hero) return null;
        const phase: RuntimeActor['phase'] = dungeonActor.status === 'moving' || dungeonActor.status === 'returning' ? 'moving' : 'acting';
        const actor = {
          heroId: dungeonActor.heroId,
          phase,
          facing: 'down' as const,
          bubble: dungeonActor.bubble,
          reaction: dungeonActor.reaction,
          roleLabel: roleLabels[dungeonActor.role],
          actionId: 'dungeon' as const,
        };
        return (
          <group key={hero.id}>
            <HeroBody3D hero={hero} actor={actor} position={mapPoint(dungeonActor.x, dungeonActor.y)} compact testIdPrefix="dungeon-hero-3d" />
            <Html center position={[mapPoint(dungeonActor.x, dungeonActor.y)[0], 0.12, mapPoint(dungeonActor.x, dungeonActor.y)[2]]} zIndexRange={[2, 1]}>
              <span className="dungeon3d-actor-probe" data-testid={`dungeon-party-${hero.id}`} data-x={dungeonActor.x.toFixed(2)} data-y={dungeonActor.y.toFixed(2)} data-role={dungeonActor.role} data-status={dungeonActor.status} style={{ borderColor: roleColor[dungeonActor.role] }}>
                {statusLabels[dungeonActor.status]}
              </span>
            </Html>
          </group>
        );
      })}
      <Sparkles count={85} scale={[20, 4, 12]} size={1.4} speed={0.06} color="#6e8298" position={[0, 0.8, 0]} />
    </>
  );
}

export function DungeonWorld3D({ world, expedition }: DungeonWorld3DProps) {
  const exploration = dungeonExplorationOf(expedition);
  const cameraPosition = useMemo<[number, number, number]>(() => [10.8, 15.5, 13.8], []);
  if (!exploration) {
    return <section className="grid min-h-[720px] place-items-center rounded-3xl border border-sky-200/10 bg-[#090d12] text-sm text-slate-500" data-testid="dungeon-rts-map">Группа проходит через входной шлюз подземелья…</section>;
  }
  const undiscovered = exploration.rooms.filter((room) => !room.discovered).length;
  const latestDecision = exploration.decisions[0];
  return (
    <section className="world3d-dungeon-shell relative min-h-[720px] overflow-hidden rounded-3xl border border-sky-200/15 bg-[#070b10] shadow-2xl" data-testid="dungeon-rts-map">
      <Canvas
        orthographic
        shadows
        dpr={[1, 1.65]}
        camera={{ position: cameraPosition, zoom: 55, near: 0.1, far: 80 }}
        onCreated={({ camera, gl, scene }) => {
          camera.lookAt(0, 0.4, 0);
          gl.setClearColor(new Color('#080b10'));
          scene.background = new Color('#080b10');
        }}
      >
        <DungeonScene world={world} expedition={expedition} />
      </Canvas>
      <header className="world3d-dungeon-header">
        <div>
          <p>Визуальная 3D-экспедиция · этаж {expedition.floor}</p>
          <h2 data-testid="dungeon-phase">{phaseLabels[exploration.phase]}</h2>
          <span>открыто комнат: {exploration.discoveredRoomIds.length}/{exploration.rooms.length} · строй: {expedition.partyIds.length} человека</span>
        </div>
        <div className="world3d-dungeon-counters">
          <span>Туман <strong data-testid="dungeon-fog-count">{undiscovered}</strong></span>
          <span>Прогресс <strong>{Math.round(expedition.progress)}%</strong></span>
        </div>
      </header>
      <aside className="world3d-dungeon-decision" data-testid="dungeon-route-decision">
        <div>
          <p>Решение группы</p>
          <strong>{latestDecision?.text ?? 'Группа только вошла на этаж и проверяет построение.'}</strong>
        </div>
        <span>шаг {exploration.step}/7</span>
        <footer>
          {exploration.routeChoice && <i>маршрут: {exploration.routeChoice === 'short-risky' ? 'короткий рискованный' : 'длинный безопасный'}</i>}
          {exploration.trapDetected !== undefined && <i>ловушка: {exploration.trapDetected ? 'обнаружена' : 'задета'}</i>}
          {exploration.chestOpened && <i>сундук открыт</i>}
          {exploration.enemySpotted && <i>враг замечен</i>}
          {exploration.threatDecision && <i>решение: {exploration.threatDecision === 'avoid' ? 'обойти' : 'отступить'}</i>}
        </footer>
      </aside>
    </section>
  );
}
