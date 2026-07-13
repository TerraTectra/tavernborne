import { Html, useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import {
  AnimationAction,
  Box3,
  Color,
  Group,
  LoopRepeat,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Hero } from '../simulation';
import type { RuntimeActor } from '../rts/realtime';
import { HeroBody3D as ProceduralHeroBody3D } from './ProceduralHeroBody3D';

export interface AssetHeroBody3DProps {
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

type CharacterManifest = {
  characters?: {
    universalHumanoid?: {
      file: string;
      targetHeight?: number;
      sourcePack?: string;
      compatibleRig?: string;
    };
  };
};

type AnimationIntent = 'idle' | 'walk' | 'sleep' | 'train' | 'work' | 'eat' | 'talk' | 'dungeon';

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

const clipHints: Record<AnimationIntent, string[]> = {
  idle: ['idle loop', 'idle torch loop', 'sword idle', 'pistol idle loop'],
  walk: ['walk loop', 'walk formal loop', 'jog fwd loop', 'sprint loop', 'crouch fwd loop'],
  sleep: ['sitting idle loop', 'driving loop', 'idle loop'],
  train: ['punch jab', 'punch cross', 'sword attack', 'sword attack rm', 'spell simple shoot', 'push loop'],
  work: ['fixing kneeling', 'pickup table', 'interact', 'push loop'],
  eat: ['sitting idle loop', 'sitting talking loop', 'interact'],
  talk: ['idle talking loop', 'sitting talking loop', 'interact'],
  dungeon: ['sword idle', 'idle torch loop', 'pistol idle loop', 'idle loop'],
};

const normalize = (value: string) => value.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function animationIntent(actor: AssetHeroBody3DProps['actor']): AnimationIntent {
  if (actor.phase === 'sleeping') return 'sleep';
  if (actor.phase === 'moving') return 'walk';
  if (actor.actionId === 'train') return 'train';
  if (actor.actionId === 'work' || actor.actionId === 'help') return 'work';
  if (actor.actionId === 'eat') return 'eat';
  if (actor.actionId === 'talk' || actor.phase === 'interacting') return 'talk';
  if (actor.actionId === 'dungeon') return 'dungeon';
  return 'idle';
}

function chooseClip(names: string[], intent: AnimationIntent): string | undefined {
  const normalized = names.map((name) => ({ name, normalized: normalize(name) }));
  for (const hint of clipHints[intent]) {
    const exact = normalized.find((candidate) => candidate.normalized === hint);
    if (exact) return exact.name;
  }
  for (const hint of clipHints[intent]) {
    const partial = normalized.find((candidate) => candidate.normalized.includes(hint));
    if (partial) return partial.name;
  }
  if (intent !== 'idle') return chooseClip(names, 'idle');
  return names[0];
}

function tintScene(source: Object3D, heroId: string): Object3D {
  const clone = cloneSkeleton(source);
  const colors = palette[heroId] ?? palette.mira;
  const cloth = new Color(colors.cloth);
  const skin = new Color(colors.skin);
  const hair = new Color(colors.hair);
  const trim = new Color(colors.trim);

  clone.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
    object.frustumCulled = false;

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const tinted = materials.map((material) => {
      const next = material.clone();
      if (!(next instanceof MeshStandardMaterial)) return next;
      const materialName = normalize(`${next.name} ${object.name}`);
      if (materialName.includes('skin') || materialName.includes('body') || materialName.includes('face')) next.color.lerp(skin, 0.24);
      else if (materialName.includes('hair') || materialName.includes('brow')) next.color.lerp(hair, 0.45);
      else if (materialName.includes('metal') || materialName.includes('armor')) next.color.lerp(trim, 0.12);
      else next.color.lerp(cloth, 0.2);
      next.roughness = Math.max(0.48, next.roughness);
      return next;
    });
    object.material = Array.isArray(object.material) ? tinted : tinted[0];
  });

  return clone;
}

class AssetErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[tavernborne] Animated character asset failed; procedural body retained.', error, info.componentStack);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function RiggedHeroBody3D({
  hero,
  actor,
  position,
  assetUrl,
  targetHeight,
  selected = false,
  compact = false,
  testIdPrefix = 'hero-3d',
  onSelect,
}: AssetHeroBody3DProps & { assetUrl: string; targetHeight: number }) {
  const root = useRef<Group>(null);
  const modelRoot = useRef<Group>(null);
  const currentAction = useRef<AnimationAction | null>(null);
  const gltf = useGLTF(assetUrl);
  const model = useMemo(() => tintScene(gltf.scene, hero.id), [gltf.scene, hero.id]);
  const bounds = useMemo(() => {
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());
    return {
      scale: targetHeight / Math.max(0.001, size.y),
      floorOffset: -box.min.y,
    };
  }, [model, targetHeight]);
  const { actions, names } = useAnimations(gltf.animations, modelRoot);
  const intent = animationIntent(actor);
  const clipName = useMemo(() => chooseClip(names, intent), [intent, names]);
  const body = hero.body.anthropometry;
  const heightScale = clamp(body.heightCm / 170, 0.84, 1.2) * (compact ? 0.84 : 1);
  const bulk = clamp((body.massKg / 66) * (body.muscleMassKg / 28), 0.76, 1.34);
  const widthScale = clamp(0.9 + (body.shoulderWidthCm - 39) / 55 + (bulk - 1) * 0.16, 0.82, 1.2);
  const depthScale = clamp(0.92 + (body.massKg - 64) / 180, 0.84, 1.18);
  const injury = clamp(hero.condition.injury / 100, 0, 1);
  const fatigue = clamp(hero.body.tissues.muscleFatigue / 100, 0, 1);

  useEffect(() => {
    if (!clipName) return;
    const next = actions[clipName];
    if (!next) return;
    currentAction.current?.fadeOut(0.22);
    next.reset().setLoop(LoopRepeat, Infinity).fadeIn(0.24).play();
    next.timeScale = clamp((intent === 'walk' ? 1.05 : 0.92) * (1 - fatigue * 0.34) * (1 - injury * 0.18), 0.42, 1.25);
    currentAction.current = next;
    return () => {
      next.fadeOut(0.16);
    };
  }, [actions, clipName, fatigue, injury, intent]);

  useFrame(({ clock }) => {
    if (!root.current) return;
    root.current.rotation.y = facingAngle[actor.facing ?? 'down'];
    root.current.rotation.z = injury * 0.09 * Math.sin(clock.elapsedTime * 1.15);
    root.current.position.y = position[1] + (actor.phase === 'moving' ? Math.abs(Math.sin(clock.elapsedTime * 7.8)) * 0.018 : 0);
  });

  const displayScale = bounds.scale * heightScale;
  return (
    <group ref={root} position={position} onClick={(event) => { event.stopPropagation(); onSelect?.(); }}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]}>
        <circleGeometry args={[selected ? 0.5 : 0.36, 32]} />
        <meshBasicMaterial color={selected ? '#f7d77b' : '#111827'} transparent opacity={selected ? 0.48 : 0.24} />
      </mesh>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.028, 0]}>
          <torusGeometry args={[0.5, 0.026, 8, 40]} />
          <meshBasicMaterial color="#fde68a" />
        </mesh>
      )}

      <group ref={modelRoot} scale={[displayScale * widthScale, displayScale, displayScale * depthScale]} position={[0, bounds.floorOffset * displayScale, 0]}>
        <primitive object={model} />
      </group>

      <Html center position={[0, compact ? 2.52 : 2.9, 0]} zIndexRange={[30, 10]}>
        <button
          type="button"
          className={`world3d-hero-label ${selected ? 'world3d-hero-label-selected' : ''}`}
          data-testid={`${testIdPrefix}-${hero.id}`}
          data-visual-mode="rigged-asset"
          data-animation-intent={intent}
          data-animation={clipName ?? 'none'}
          data-animation-count={names.length}
          data-asset-source="quaternius-universal-animation-library"
          onClick={(event) => { event.stopPropagation(); onSelect?.(); }}
        >
          <strong>{hero.name}</strong>
          {actor.roleLabel && <span>{actor.roleLabel}</span>}
        </button>
      </Html>
      {actor.bubble && actor.phase !== 'moving' && (
        <Html center position={[0, compact ? 3.03 : 3.42, 0]} zIndexRange={[35, 12]}>
          <span className="world3d-bubble">{actor.bubble}</span>
        </Html>
      )}
      {actor.reaction && (
        <Html center position={[0.5, compact ? 2.25 : 2.58, 0]} zIndexRange={[34, 12]}>
          <span className="world3d-reaction">{actor.reaction}</span>
        </Html>
      )}
    </group>
  );
}

export function AssetHeroBody3D(props: AssetHeroBody3DProps) {
  const [asset, setAsset] = useState<{ url: string; targetHeight: number } | null>();

  useEffect(() => {
    let cancelled = false;
    const base = import.meta.env.BASE_URL;
    fetch(`${base}assets/quaternius/manifest.json`, { cache: 'no-cache' })
      .then((response) => response.ok ? response.json() as Promise<CharacterManifest> : Promise.reject(new Error(`manifest ${response.status}`)))
      .then((manifest) => {
        if (cancelled) return;
        const character = manifest.characters?.universalHumanoid;
        if (!character?.file) {
          setAsset(null);
          return;
        }
        setAsset({ url: `${base}${character.file}`, targetHeight: character.targetHeight ?? 2.25 });
      })
      .catch((error) => {
        console.warn('[tavernborne] Character manifest unavailable; procedural body retained.', error);
        if (!cancelled) setAsset(null);
      });
    return () => { cancelled = true; };
  }, []);

  const fallback = <ProceduralHeroBody3D {...props} />;
  if (!asset) return fallback;

  return (
    <AssetErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <RiggedHeroBody3D {...props} assetUrl={asset.url} targetHeight={asset.targetHeight} />
      </Suspense>
    </AssetErrorBoundary>
  );
}
