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
import type {
  ChoreographyDistance,
  ChoreographyFormation,
  ChoreographyGesture,
  Hero,
  VisualGesture,
  VisualProp,
} from '../simulation';
import type { RuntimeActor } from '../rts/realtime';
import {
  HeroInteraction3D,
  interactionKindForActor,
  interactionLabelForActor,
  interactionPostureForActor,
  type InteractionPosture,
} from './HeroInteraction3D';
import { applyModularHeroAppearance } from './ModularHeroAppearance3D';
import { HeroBody3D as ProceduralHeroBody3D } from './ProceduralHeroBody3D';

export interface AssetHeroBody3DProps {
  hero: Hero;
  actor: RuntimeActor | {
    heroId: string;
    phase: RuntimeActor['phase'];
    facing?: RuntimeActor['facing'];
    position?: { x: number; y: number };
    bubble?: string;
    roleLabel?: string;
    reaction?: string;
    actionId?: RuntimeActor['actionId'];
    gesture?: VisualGesture;
    sceneProp?: VisualProp;
    focusPoint?: { x: number; y: number };
    formation?: ChoreographyFormation;
    choreographySlot?: number;
    bubbleLane?: number;
    socialDistance?: ChoreographyDistance;
    pairGesture?: ChoreographyGesture;
    partnerId?: string;
    emotionalPerformance?: RuntimeActor['emotionalPerformance'];
    emotionalIntensity?: number;
    movementRate?: number;
    animationRate?: number;
    bodyLean?: number;
    bodyTension?: number;
    expressionSymbol?: string;
    expressionColor?: string;
    dialoguePerformance?: RuntimeActor['dialoguePerformance'];
    dialogueLength?: RuntimeActor['dialogueLength'];
    dialogueCadence?: RuntimeActor['dialogueCadence'];
    dialogueTone?: RuntimeActor['dialogueTone'];
    dialogueWordCount?: number;
    dialogueIsSpeaker?: boolean;
    dialogueOriginalText?: string;
    dialogueMemoryId?: string;
    dialogueMemoryReference?: string;
    dialoguePartnerId?: string;
    dialogueReason?: string;
    dialogueColor?: string;
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

type AnimationIntent =
  | 'idle'
  | 'walk'
  | 'sleep'
  | 'train'
  | 'work'
  | 'help'
  | 'eat'
  | 'read'
  | 'talk'
  | 'apologize'
  | 'solitude'
  | 'recover'
  | 'dungeon'
  | 'pack'
  | 'ready';

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
  help: ['fixing kneeling', 'interact', 'pickup table', 'push loop'],
  eat: ['sitting idle loop', 'sitting talking loop', 'interact'],
  read: ['sitting idle loop', 'interact', 'idle loop'],
  talk: ['idle talking loop', 'sitting talking loop', 'interact'],
  apologize: ['idle talking loop', 'interact', 'sitting talking loop'],
  solitude: ['idle torch loop', 'idle loop'],
  recover: ['fixing kneeling', 'sitting idle loop', 'idle loop'],
  dungeon: ['sword idle', 'idle torch loop', 'pistol idle loop', 'idle loop'],
  pack: ['pickup table', 'interact', 'fixing kneeling'],
  ready: ['sword idle', 'pistol idle loop', 'idle torch loop'],
};

const normalize = (value: string) => value.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function animationIntent(actor: AssetHeroBody3DProps['actor']): AnimationIntent {
  if (actor.phase === 'moving') return 'walk';
  if (actor.sceneProp === 'pack' || actor.gesture === 'pack') return 'pack';
  if (actor.sceneProp === 'weapon' || actor.gesture === 'ready' || actor.formation === 'line') return 'ready';
  if (actor.phase === 'sleeping' || actor.actionId === 'sleep') return 'sleep';
  if (actor.pairGesture === 'heal' || actor.pairGesture === 'offer') return actor.actionId === 'eat' ? 'eat' : 'help';
  if (actor.pairGesture === 'appeal') return 'apologize';
  if (actor.pairGesture === 'share') return 'eat';
  if (actor.pairGesture === 'argue' || actor.pairGesture === 'recoil' || actor.pairGesture === 'mediate') return 'talk';
  switch (actor.actionId) {
    case 'train': return 'train';
    case 'work': return 'work';
    case 'help': return 'help';
    case 'eat': return 'eat';
    case 'read': return 'read';
    case 'talk': return 'talk';
    case 'apologize': return 'apologize';
    case 'seekSolitude': return 'solitude';
    case 'recover': return 'recover';
    case 'dungeon': return 'dungeon';
    default: return actor.phase === 'interacting' ? 'talk' : 'idle';
  }
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

function modelPoseFor(posture: InteractionPosture): { position: [number, number, number]; rotation: [number, number, number] } {
  if (posture === 'seated') return { position: [0, -0.13, -0.04], rotation: [0.04, 0, 0] };
  if (posture === 'kneeling') return { position: [0, -0.1, 0.02], rotation: [0.1, 0, 0] };
  if (posture === 'resting') return { position: [0, -0.16, -0.08], rotation: [0.08, 0, 0.03] };
  if (posture === 'leaning') return { position: [0, -0.04, 0.03], rotation: [0.12, 0, 0] };
  if (posture === 'ready') return { position: [0, 0, -0.02], rotation: [-0.03, 0, 0] };
  return { position: [0, 0, 0], rotation: [0, 0, 0] };
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
  const performanceRoot = useRef<Group>(null);
  const modelRoot = useRef<Group>(null);
  const currentAction = useRef<AnimationAction | null>(null);
  const gltf = useGLTF(assetUrl);
  const appearance = useMemo(() => {
    const model = tintScene(gltf.scene, hero.id);
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());
    const appearanceResult = applyModularHeroAppearance(model, hero.id);
    return {
      model,
      scale: targetHeight / Math.max(0.001, size.y),
      floorOffset: -box.min.y,
      ...appearanceResult,
    };
  }, [gltf.scene, hero.id, targetHeight]);
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
  const interactionKind = interactionKindForActor(actor);
  const posture = interactionPostureForActor(actor);
  const interactionLabel = interactionLabelForActor(actor);
  const modelPose = modelPoseFor(posture);
  const emotionalIntensity = clamp((actor.emotionalIntensity ?? 0) / 100, 0, 1);
  const emotionalRate = clamp(actor.animationRate ?? 1, 0.45, 1.35);
  const emotionalLean = (actor.bodyLean ?? 0) * emotionalIntensity;
  const emotionalTension = clamp(actor.bodyTension ?? 0, 0, 1) * emotionalIntensity;
  const emotionalSlouch = ['guilty', 'withdrawn', 'exhausted'].includes(actor.emotionalPerformance ?? '') ? emotionalIntensity * 0.055 : 0;
  const bubbleLane = clamp(actor.bubbleLane ?? 0, -2, 2);
  const bubbleX = bubbleLane * 0.4;
  const bubbleY = (compact ? 3.03 : 3.42) + Math.abs(bubbleLane) * 0.1;
  const labelX = bubbleLane * 0.08;
  const dialogueColor = actor.dialogueColor ?? actor.expressionColor ?? '#cbd5e1';
  const dialogueMaxWidth = actor.dialogueLength === 'expanded' ? 340 : actor.dialogueLength === 'terse' ? 220 : 280;
  const dialogueLineHeight = actor.dialogueCadence === 'halting' ? 1.5 : actor.dialogueCadence === 'clipped' ? 1.28 : 1.38;
  const equipmentDrawn = actor.actionId === 'train'
    || actor.actionId === 'dungeon'
    || actor.sceneProp === 'weapon'
    || actor.gesture === 'ready'
    || actor.formation === 'line';

  useEffect(() => {
    if (!clipName) return;
    const next = actions[clipName];
    if (!next) return;
    currentAction.current?.fadeOut(0.22);
    next.reset().setLoop(LoopRepeat, Infinity).fadeIn(0.24).play();
    const effort = intent === 'walk' ? 1.05 : intent === 'train' ? 1.08 : intent === 'sleep' ? 0.58 : 0.92;
    next.timeScale = clamp(effort * emotionalRate * (1 - fatigue * 0.34) * (1 - injury * 0.18), 0.3, 1.45);
    currentAction.current = next;
    return () => {
      next.fadeOut(0.16);
    };
  }, [actions, clipName, emotionalRate, fatigue, injury, intent]);

  useEffect(() => {
    if (appearance.heldEquipment) appearance.heldEquipment.visible = equipmentDrawn;
    if (appearance.stowedEquipment) appearance.stowedEquipment.visible = !equipmentDrawn;
  }, [appearance, equipmentDrawn]);

  useFrame(({ clock }) => {
    if (!root.current) return;
    const movementRate = clamp(actor.movementRate ?? 1, 0.55, 1.3);
    root.current.rotation.y = facingAngle[actor.facing ?? 'down'];
    root.current.rotation.z = injury * 0.09 * Math.sin(clock.elapsedTime * 1.15);
    root.current.position.y = position[1] + (actor.phase === 'moving' ? Math.abs(Math.sin(clock.elapsedTime * 7.8 * movementRate)) * 0.018 : 0);
    if (!performanceRoot.current) return;
    performanceRoot.current.position.y = modelPose.position[1] - emotionalSlouch;
    performanceRoot.current.rotation.x = modelPose.rotation[0] + emotionalLean;
    performanceRoot.current.rotation.y = modelPose.rotation[1];
    performanceRoot.current.rotation.z = modelPose.rotation[2] + Math.sin(clock.elapsedTime * (5.5 + emotionalTension * 5)) * emotionalTension * 0.012;
  });

  const displayScale = appearance.scale * heightScale;
  const worldPosition = actor.position;
  const showExpression = Boolean(actor.expressionSymbol) && emotionalIntensity >= 0.35;
  const expressionColor = actor.expressionColor ?? '#cbd5e1';
  return (
    <group ref={root} position={position} onClick={(event) => { event.stopPropagation(); onSelect?.(); }}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]}>
        <circleGeometry args={[selected ? 0.5 : 0.36, 32]} />
        <meshBasicMaterial color={selected ? '#f7d77b' : '#111827'} transparent opacity={selected ? 0.48 : 0.24} />
      </mesh>
      {actor.emotionalPerformance && actor.emotionalPerformance !== 'neutral' && emotionalIntensity >= 0.28 && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.024, 0]}>
          <ringGeometry args={[0.4, 0.54 + emotionalIntensity * 0.08, 36]} />
          <meshBasicMaterial color={expressionColor} transparent opacity={0.1 + emotionalIntensity * 0.24} depthWrite={false} />
        </mesh>
      )}
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.028, 0]}>
          <torusGeometry args={[0.5, 0.026, 8, 40]} />
          <meshBasicMaterial color="#fde68a" />
        </mesh>
      )}

      <HeroInteraction3D heroId={hero.id} actor={actor} compact={compact} />
      <group ref={performanceRoot} position={modelPose.position} rotation={modelPose.rotation}>
        <group ref={modelRoot} scale={[displayScale * widthScale, displayScale, displayScale * depthScale]} position={[0, appearance.floorOffset * displayScale, 0]}>
          <primitive object={appearance.model} />
        </group>
      </group>

      <Html center position={[labelX, compact ? 2.52 : 2.9, 0]} zIndexRange={[30, 10]}>
        <button
          type="button"
          className={`world3d-hero-label ${selected ? 'world3d-hero-label-selected' : ''}`}
          data-testid={`${testIdPrefix}-${hero.id}`}
          data-visual-mode="rigged-asset"
          data-animation-intent={intent}
          data-animation={clipName ?? 'none'}
          data-animation-count={names.length}
          data-asset-source="quaternius-universal-animation-library"
          data-appearance-profile={appearance.profileId}
          data-appearance-modules={appearance.moduleCount}
          data-equipment-state={equipmentDrawn ? 'drawn' : 'stowed'}
          data-interaction-kind={interactionKind}
          data-interaction-posture={posture}
          data-interaction-label={interactionLabel}
          data-gesture={actor.gesture ?? 'none'}
          data-scene-prop={actor.sceneProp ?? 'none'}
          data-choreography-formation={actor.formation ?? 'none'}
          data-choreography-distance={actor.socialDistance ?? 'none'}
          data-choreography-gesture={actor.pairGesture ?? 'none'}
          data-choreography-slot={actor.choreographySlot ?? -1}
          data-bubble-lane={actor.bubbleLane ?? 0}
          data-partner-id={actor.partnerId ?? 'none'}
          data-focus-point={actor.focusPoint ? `${actor.focusPoint.x.toFixed(2)},${actor.focusPoint.y.toFixed(2)}` : 'none'}
          data-emotional-performance={actor.emotionalPerformance ?? 'neutral'}
          data-emotional-intensity={(actor.emotionalIntensity ?? 0).toFixed(1)}
          data-movement-rate={(actor.movementRate ?? 1).toFixed(2)}
          data-animation-rate={(actor.animationRate ?? 1).toFixed(2)}
          data-body-lean={(actor.bodyLean ?? 0).toFixed(3)}
          data-body-tension={(actor.bodyTension ?? 0).toFixed(2)}
          data-expression-symbol={actor.expressionSymbol ?? ''}
          data-dialogue-performance={actor.dialoguePerformance ?? 'none'}
          data-dialogue-length={actor.dialogueLength ?? 'none'}
          data-dialogue-cadence={actor.dialogueCadence ?? 'none'}
          data-dialogue-tone={actor.dialogueTone ?? 'none'}
          data-dialogue-word-count={actor.dialogueWordCount ?? 0}
          data-dialogue-is-speaker={actor.dialogueIsSpeaker ? 'true' : 'false'}
          data-dialogue-memory-id={actor.dialogueMemoryId ?? 'none'}
          data-dialogue-partner-id={actor.dialoguePartnerId ?? 'none'}
          data-dialogue-reason={actor.dialogueReason ?? ''}
          data-facing={actor.facing ?? 'down'}
          data-world-x={worldPosition ? worldPosition.x.toFixed(2) : 'na'}
          data-world-y={worldPosition ? worldPosition.y.toFixed(2) : 'na'}
          onClick={(event) => { event.stopPropagation(); onSelect?.(); }}
        >
          <strong>{hero.name}</strong>
          {actor.roleLabel && <span>{actor.roleLabel}</span>}
        </button>
      </Html>
      {showExpression && (
        <Html center position={[0.48 + bubbleX * 0.2, compact ? 2.88 : 3.25, 0]} zIndexRange={[36, 13]}>
          <span
            data-testid={`emotion-expression-${hero.id}`}
            data-emotional-performance={actor.emotionalPerformance}
            style={{
              display: 'grid', placeItems: 'center', minWidth: 22, height: 22, padding: '0 5px', borderRadius: 999,
              color: expressionColor, border: `1px solid ${expressionColor}99`, background: 'rgba(8, 10, 16, 0.82)',
              boxShadow: `0 0 ${8 + emotionalIntensity * 12}px ${expressionColor}55`, fontSize: 13, fontWeight: 800,
            }}
          >
            {actor.expressionSymbol}
          </span>
        </Html>
      )}
      {actor.bubble && actor.phase !== 'moving' && (
        <Html center position={[bubbleX, bubbleY, 0]} zIndexRange={[35, 12]}>
          <span
            className="world3d-bubble"
            data-testid={`dialogue-bubble-${hero.id}`}
            data-bubble-lane={bubbleLane}
            data-emotional-performance={actor.emotionalPerformance ?? 'neutral'}
            data-dialogue-performance={actor.dialoguePerformance ?? 'none'}
            data-dialogue-length={actor.dialogueLength ?? 'none'}
            data-dialogue-cadence={actor.dialogueCadence ?? 'none'}
            data-dialogue-tone={actor.dialogueTone ?? 'none'}
            data-dialogue-word-count={actor.dialogueWordCount ?? 0}
            data-dialogue-memory-id={actor.dialogueMemoryId ?? 'none'}
            title={actor.dialogueReason}
            style={{
              borderColor: actor.dialogueIsSpeaker ? `${dialogueColor}aa` : showExpression ? `${expressionColor}88` : undefined,
              maxWidth: dialogueMaxWidth,
              lineHeight: dialogueLineHeight,
              letterSpacing: actor.dialogueCadence === 'clipped' ? '0.01em' : undefined,
            }}
          >
            {actor.bubble}
          </span>
        </Html>
      )}
      {actor.reaction && (
        <Html center position={[0.5 + bubbleX * 0.35, compact ? 2.25 : 2.58, 0]} zIndexRange={[34, 12]}>
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
