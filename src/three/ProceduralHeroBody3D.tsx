import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group, MeshStandardMaterial } from 'three';
import type { Hero } from '../simulation';
import type { RuntimeActor } from '../rts/realtime';

interface HeroBody3DProps {
  hero: Hero;
  actor: RuntimeActor | {
    heroId: string;
    phase: RuntimeActor['phase'];
    facing?: RuntimeActor['facing'];
    bubble?: string;
    roleLabel?: string;
    reaction?: string;
    actionId?: RuntimeActor['actionId'];
  };
  position: [number, number, number];
  selected?: boolean;
  compact?: boolean;
  testIdPrefix?: string;
  onSelect?: () => void;
}

const palette: Record<string, { cloth: string; trim: string; hair: string; skin: string }> = {
  mira: { cloth: '#2f846a', trim: '#b8d8a7', hair: '#aeb5bc', skin: '#d6a47f' },
  kael: { cloth: '#8c3e35', trim: '#d49a6a', hair: '#3b271f', skin: '#c88d68' },
  liora: { cloth: '#496ca9', trim: '#b4c9f1', hair: '#d6d9e4', skin: '#e0b492' },
};

const facingAngle: Record<NonNullable<RuntimeActor['facing']>, number> = {
  down: 0,
  right: Math.PI / 2,
  up: Math.PI,
  left: -Math.PI / 2,
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function Limb({
  length,
  radius,
  color,
  materialRef,
}: {
  length: number;
  radius: number;
  color: string;
  materialRef?: React.RefObject<MeshStandardMaterial>;
}) {
  return (
    <mesh castShadow position={[0, -length / 2, 0]}>
      <capsuleGeometry args={[radius, Math.max(0.04, length - radius * 2), 5, 10]} />
      <meshStandardMaterial ref={materialRef} color={color} roughness={0.72} />
    </mesh>
  );
}

export function HeroBody3D({
  hero,
  actor,
  position,
  selected = false,
  compact = false,
  testIdPrefix = 'hero-3d',
  onSelect,
}: HeroBody3DProps) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const leftForearm = useRef<Group>(null);
  const rightForearm = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const leftShin = useRef<Group>(null);
  const rightShin = useRef<Group>(null);

  const colors = palette[hero.id] ?? palette.mira;
  const anthropometry = hero.body.anthropometry;
  const heightScale = clamp(anthropometry.heightCm / 170, 0.86, 1.18) * (compact ? 0.82 : 1);
  const shoulderScale = clamp(anthropometry.shoulderWidthCm / 41, 0.82, 1.25);
  const hipScale = clamp(anthropometry.hipWidthCm / 30, 0.82, 1.2);
  const bulk = clamp((anthropometry.massKg / 66) * (anthropometry.muscleMassKg / 28), 0.78, 1.36);
  const injury = clamp(hero.condition.injury / 100, 0, 1);
  const fatigue = clamp(hero.body.tissues.muscleFatigue / 100, 0, 1);

  const dimensions = useMemo(() => {
    const legLength = clamp(anthropometry.legLengthCm / anthropometry.heightCm, 0.44, 0.58);
    const armSpan = clamp(anthropometry.armSpanCm / anthropometry.heightCm, 0.9, 1.12);
    return {
      upperLeg: 0.53 * legLength / 0.515,
      shin: 0.47 * legLength / 0.515,
      upperArm: 0.39 * armSpan,
      forearm: 0.33 * armSpan,
      hand: 0.15 * armSpan,
      shoulderWidth: 0.5 * shoulderScale,
      hipWidth: 0.28 * hipScale,
      torsoWidth: 0.7 * shoulderScale,
      torsoDepth: 0.34 * clamp(anthropometry.massKg / 66, 0.82, 1.25),
    };
  }, [anthropometry, hipScale, shoulderScale]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const moving = actor.phase === 'moving';
    const active = actor.phase === 'acting' || actor.phase === 'interacting';
    const sleeping = actor.phase === 'sleeping';
    const pace = moving ? 8.5 : active ? 3.2 : 1.25;
    const swing = Math.sin(t * pace);
    const effort = 1 - fatigue * 0.42;

    if (root.current) {
      root.current.rotation.y = facingAngle[actor.facing ?? 'down'];
    }
    if (body.current) {
      body.current.position.y = moving ? Math.abs(Math.sin(t * pace * 2)) * 0.045 * effort : Math.sin(t * 1.7) * 0.012;
      body.current.rotation.z = sleeping ? Math.PI / 2 : injury * 0.08 * Math.sin(t * 1.2);
    }

    const walkAmplitude = moving ? 0.72 * effort : 0.04;
    if (leftArm.current) leftArm.current.rotation.x = swing * walkAmplitude;
    if (rightArm.current) rightArm.current.rotation.x = -swing * walkAmplitude;
    if (leftLeg.current) leftLeg.current.rotation.x = -swing * walkAmplitude * 0.82;
    if (rightLeg.current) rightLeg.current.rotation.x = swing * walkAmplitude * 0.82;
    if (leftShin.current) leftShin.current.rotation.x = moving ? Math.max(0, swing) * 0.64 : 0.08;
    if (rightShin.current) rightShin.current.rotation.x = moving ? Math.max(0, -swing) * 0.64 : 0.08;

    const training = actor.actionId === 'train';
    const working = actor.actionId === 'work' || actor.actionId === 'help';
    const eating = actor.actionId === 'eat';
    if (rightArm.current && training) {
      rightArm.current.rotation.x = -1.15 + Math.sin(t * 5.3) * 1.0;
      rightArm.current.rotation.z = -0.35;
    } else if (rightArm.current && working) {
      rightArm.current.rotation.x = -0.65 + Math.sin(t * 6.2) * 0.62;
      rightArm.current.rotation.z = -0.18;
    } else if (rightArm.current && eating) {
      rightArm.current.rotation.x = -0.85 + Math.sin(t * 3.5) * 0.22;
    } else if (rightArm.current) {
      rightArm.current.rotation.z = 0;
    }

    if (leftForearm.current) leftForearm.current.rotation.x = active ? 0.18 + Math.sin(t * 2.7) * 0.12 : 0.08;
    if (rightForearm.current) rightForearm.current.rotation.x = training || working ? 0.62 : eating ? 1.1 : 0.08;
  });

  const legRadius = 0.105 * bulk;
  const armRadius = 0.082 * bulk;
  const painful = Object.values(hero.body.segments).some((segment) => segment.pain >= 12);

  return (
    <group ref={root} position={position} scale={heightScale} onClick={(event) => { event.stopPropagation(); onSelect?.(); }}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]}>
        <circleGeometry args={[selected ? 0.48 : 0.34, 32]} />
        <meshBasicMaterial color={selected ? '#f7d77b' : '#111827'} transparent opacity={selected ? 0.48 : 0.24} />
      </mesh>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.028, 0]}>
          <torusGeometry args={[0.48, 0.025, 8, 40]} />
          <meshBasicMaterial color="#fde68a" />
        </mesh>
      )}

      <group ref={body} position={[0, 0.02, 0]}>
        <group position={[-dimensions.hipWidth / 2, 1.02, 0]} ref={leftLeg} rotation={[0.02, 0, 0]}>
          <Limb length={dimensions.upperLeg} radius={legRadius * 1.08} color={colors.cloth} />
          <mesh castShadow position={[0, -dimensions.upperLeg, 0]}><sphereGeometry args={[legRadius * 1.12, 12, 10]} /><meshStandardMaterial color={colors.trim} roughness={0.75} /></mesh>
          <group position={[0, -dimensions.upperLeg, 0]} ref={leftShin}>
            <Limb length={dimensions.shin} radius={legRadius * 0.86} color="#263247" />
            <mesh castShadow position={[0, -dimensions.shin, 0.055]} scale={[1, 0.45, 1.65]}><sphereGeometry args={[legRadius, 12, 10]} /><meshStandardMaterial color="#171d29" roughness={0.86} /></mesh>
          </group>
        </group>
        <group position={[dimensions.hipWidth / 2, 1.02, 0]} ref={rightLeg} rotation={[0.02, 0, 0]}>
          <Limb length={dimensions.upperLeg} radius={legRadius * 1.08} color={colors.cloth} />
          <mesh castShadow position={[0, -dimensions.upperLeg, 0]}><sphereGeometry args={[legRadius * 1.12, 12, 10]} /><meshStandardMaterial color={colors.trim} roughness={0.75} /></mesh>
          <group position={[0, -dimensions.upperLeg, 0]} ref={rightShin}>
            <Limb length={dimensions.shin} radius={legRadius * 0.86} color="#263247" />
            <mesh castShadow position={[0, -dimensions.shin, 0.055]} scale={[1, 0.45, 1.65]}><sphereGeometry args={[legRadius, 12, 10]} /><meshStandardMaterial color="#171d29" roughness={0.86} /></mesh>
          </group>
        </group>

        <mesh castShadow position={[0, 1.04, 0]} scale={[hipScale, 1, 1]}>
          <capsuleGeometry args={[0.24 * bulk, 0.28, 5, 12]} />
          <meshStandardMaterial color="#2d3444" roughness={0.76} />
        </mesh>
        <mesh castShadow position={[0, 1.48, 0]} scale={[dimensions.torsoWidth, 0.82, dimensions.torsoDepth]}>
          <capsuleGeometry args={[0.48, 0.55, 6, 14]} />
          <meshStandardMaterial color={colors.cloth} roughness={0.68} emissive={painful ? '#3b1010' : '#000000'} emissiveIntensity={painful ? 0.18 : 0} />
        </mesh>
        <mesh castShadow position={[0, 1.18, 0]} scale={[0.92 * hipScale, 0.58, 0.78]}>
          <capsuleGeometry args={[0.31, 0.32, 5, 12]} />
          <meshStandardMaterial color={colors.trim} roughness={0.74} />
        </mesh>
        <mesh castShadow position={[0, 1.93, 0]}>
          <cylinderGeometry args={[0.105, 0.125, 0.18, 12]} />
          <meshStandardMaterial color={colors.skin} roughness={0.72} />
        </mesh>
        <mesh castShadow position={[0, 2.19, 0]} scale={[0.92, 1.04, 0.94]}>
          <sphereGeometry args={[0.24, 18, 14]} />
          <meshStandardMaterial color={colors.skin} roughness={0.68} />
        </mesh>
        <mesh castShadow position={[0, 2.31, -0.035]} scale={[0.98, 0.52, 1.02]}>
          <sphereGeometry args={[0.245, 16, 12]} />
          <meshStandardMaterial color={colors.hair} roughness={0.82} />
        </mesh>

        <group position={[-dimensions.shoulderWidth, 1.78, 0]} ref={leftArm} rotation={[0.02, 0, 0.16]}>
          <mesh castShadow><sphereGeometry args={[armRadius * 1.35, 12, 10]} /><meshStandardMaterial color={colors.trim} roughness={0.72} /></mesh>
          <Limb length={dimensions.upperArm} radius={armRadius} color={colors.cloth} />
          <group position={[0, -dimensions.upperArm, 0]} ref={leftForearm}>
            <mesh castShadow><sphereGeometry args={[armRadius * 1.02, 12, 10]} /><meshStandardMaterial color={colors.skin} roughness={0.72} /></mesh>
            <Limb length={dimensions.forearm} radius={armRadius * 0.78} color={colors.skin} />
            <mesh castShadow position={[0, -dimensions.forearm - dimensions.hand * 0.45, 0]} scale={[0.75, 1.2, 0.65]}><sphereGeometry args={[armRadius * 0.92, 12, 10]} /><meshStandardMaterial color={colors.skin} roughness={0.7} /></mesh>
          </group>
        </group>
        <group position={[dimensions.shoulderWidth, 1.78, 0]} ref={rightArm} rotation={[0.02, 0, -0.16]}>
          <mesh castShadow><sphereGeometry args={[armRadius * 1.35, 12, 10]} /><meshStandardMaterial color={colors.trim} roughness={0.72} /></mesh>
          <Limb length={dimensions.upperArm} radius={armRadius} color={colors.cloth} />
          <group position={[0, -dimensions.upperArm, 0]} ref={rightForearm}>
            <mesh castShadow><sphereGeometry args={[armRadius * 1.02, 12, 10]} /><meshStandardMaterial color={colors.skin} roughness={0.72} /></mesh>
            <Limb length={dimensions.forearm} radius={armRadius * 0.78} color={colors.skin} />
            <mesh castShadow position={[0, -dimensions.forearm - dimensions.hand * 0.45, 0]} scale={[0.75, 1.2, 0.65]}><sphereGeometry args={[armRadius * 0.92, 12, 10]} /><meshStandardMaterial color={colors.skin} roughness={0.7} /></mesh>
          </group>
        </group>
      </group>

      <Html center position={[0, 2.82, 0]} zIndexRange={[30, 10]}>
        <button type="button" className={`world3d-hero-label ${selected ? 'world3d-hero-label-selected' : ''}`} data-testid={`${testIdPrefix}-${hero.id}`} onClick={(event) => { event.stopPropagation(); onSelect?.(); }}>
          <strong>{hero.name}</strong>
          {actor.roleLabel && <span>{actor.roleLabel}</span>}
        </button>
      </Html>
      {actor.bubble && actor.phase !== 'moving' && (
        <Html center position={[0, 3.34, 0]} zIndexRange={[35, 12]}>
          <span className="world3d-bubble">{actor.bubble}</span>
        </Html>
      )}
      {actor.reaction && (
        <Html center position={[0.48, 2.5, 0]} zIndexRange={[34, 12]}>
          <span className="world3d-reaction">{actor.reaction}</span>
        </Html>
      )}
    </group>
  );
}
