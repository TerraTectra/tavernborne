import { useGLTF } from '@react-three/drei';
import { createPortal } from '@react-three/fiber';
import { Suspense, useMemo, type ReactNode } from 'react';
import {
  Bone,
  Box3,
  Color,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SkinnedMesh,
  Vector3,
} from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Hero } from '../simulation';

export type HeroVisualIntent = 'idle' | 'walk' | 'sleep' | 'train' | 'work' | 'eat' | 'talk' | 'read' | 'dungeon';

export interface ManifestModelEntry {
  file: string;
  targetSize?: number;
  sourceFile?: string;
  sourcePack?: string;
}

export interface AttachmentNodes {
  head?: Object3D;
  chest?: Object3D;
  hips?: Object3D;
  rightHand?: Object3D;
  leftHand?: Object3D;
  found: string[];
  boneNames: string[];
}

export interface HeroCustomizationMeta {
  hairStyle: 'braided-bob' | 'warrior-crest' | 'long-scholar';
  faceStyle: 'warm-angular' | 'stern-square' | 'curious-soft';
  outfitStyle: 'healer-ranger' | 'leather-vanguard' | 'arcane-scholar';
  weaponId: string;
  weaponAssetId: 'heroSpear' | 'heroSword' | 'heroStaff';
  weaponState: 'ready' | 'carried' | 'holstered';
  armorId: string;
  bookState: 'reading' | 'packed' | 'none';
}

const colors = {
  mira: { cloth: '#2f846a', clothDark: '#1f5d4d', trim: '#b8d8a7', hair: '#aeb5bc', eye: '#4b8b78', leather: '#6c4328', metal: '#c7d0d6' },
  kael: { cloth: '#8c3e35', clothDark: '#542620', trim: '#d49a6a', hair: '#312018', eye: '#7e4d37', leather: '#5b3422', metal: '#c6cbd0' },
  liora: { cloth: '#496ca9', clothDark: '#293f70', trim: '#b4c9f1', hair: '#d6d9e4', eye: '#7898d8', leather: '#59432f', metal: '#a9c7df' },
} as const;

const normalize = (value: string) => value.toLowerCase().replace(/[_:\-.]+/g, ' ').replace(/\s+/g, ' ').trim();

const hasInventory = (hero: Hero, id: string) => hero.inventory.some((item) => item.id === id && item.quantity > 0);

export function customizationMetaFor(hero: Hero, intent: HeroVisualIntent): HeroCustomizationMeta {
  const ready = intent === 'train' || intent === 'dungeon';
  const carried = intent === 'walk';
  const weaponState: HeroCustomizationMeta['weaponState'] = ready ? 'ready' : carried ? 'carried' : 'holstered';

  if (hero.id === 'kael') {
    return {
      hairStyle: 'warrior-crest', faceStyle: 'stern-square', outfitStyle: 'leather-vanguard',
      weaponId: hasInventory(hero, 'iron-sword') ? 'iron-sword' : 'unarmed', weaponAssetId: 'heroSword', weaponState,
      armorId: hasInventory(hero, 'leather-vest') ? 'leather-vest' : 'travel-clothes', bookState: 'none',
    };
  }
  if (hero.id === 'liora') {
    return {
      hairStyle: 'long-scholar', faceStyle: 'curious-soft', outfitStyle: 'arcane-scholar',
      weaponId: hasInventory(hero, 'oak-staff') ? 'oak-staff' : 'unarmed', weaponAssetId: 'heroStaff', weaponState,
      armorId: 'scholar-mantle', bookState: intent === 'read' && hasInventory(hero, 'primer') ? 'reading' : hasInventory(hero, 'primer') ? 'packed' : 'none',
    };
  }
  return {
    hairStyle: 'braided-bob', faceStyle: 'warm-angular', outfitStyle: 'healer-ranger',
    weaponId: hasInventory(hero, 'short-spear') ? 'short-spear' : 'unarmed', weaponAssetId: 'heroSpear', weaponState,
    armorId: 'field-shawl', bookState: 'none',
  };
}

const collectBones = (root: Object3D): Bone[] => {
  const unique = new Map<string, Bone>();
  root.traverse((object) => {
    if (object instanceof Bone) unique.set(object.uuid, object);
    if (object instanceof SkinnedMesh) {
      for (const bone of object.skeleton.bones) unique.set(bone.uuid, bone);
    }
  });
  return [...unique.values()];
};

const findBone = (bones: Bone[], patterns: RegExp[]) => {
  const candidates = bones.map((bone) => ({ bone, name: normalize(bone.name) }));
  for (const pattern of patterns) {
    const exact = candidates.find(({ name }) => pattern.test(name));
    if (exact) return exact.bone;
  }
  return undefined;
};

export function detectAttachmentNodes(root: Object3D): AttachmentNodes {
  const bones = collectBones(root);
  const head = findBone(bones, [/^head$/, /(^| )head( |$)/, /head/]);
  const chest = findBone(bones, [/upper chest/, /chest/, /spine 2$/, /spine 1$/, /spine/]);
  const hips = findBone(bones, [/^hips$/, /hips/, /pelvis/, /^root$/]);
  const rightHand = findBone(bones, [/right hand/, /hand right/, /hand r$/, /r hand/, /hand.*r$/]);
  const leftHand = findBone(bones, [/left hand/, /hand left/, /hand l$/, /l hand/, /hand.*l$/]);
  const found = [head && 'head', chest && 'chest', hips && 'hips', rightHand && 'rightHand', leftHand && 'leftHand'].filter(Boolean) as string[];
  return { head, chest, hips, rightHand, leftHand, found, boneNames: bones.map((bone) => bone.name) };
}

function HairAndFace({ hero }: { hero: Hero }) {
  const palette = colors[hero.id as keyof typeof colors] ?? colors.mira;
  const profile = customizationMetaFor(hero, 'idle');
  const eyeX = profile.faceStyle === 'stern-square' ? 0.043 : 0.038;
  return (
    <group position={[0, 0.105, 0]}>
      <mesh castShadow position={[0, 0.052, -0.012]} scale={profile.hairStyle === 'warrior-crest' ? [0.115, 0.105, 0.105] : [0.125, 0.118, 0.112]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color={palette.hair} roughness={0.88} />
      </mesh>
      {profile.hairStyle === 'braided-bob' && (
        <>
          {[-0.09, 0.09].map((x) => <mesh key={x} castShadow position={[x, -0.005, -0.01]} scale={[0.035, 0.085, 0.035]}><capsuleGeometry args={[1, 1.15, 4, 8]} /><meshStandardMaterial color={palette.hair} roughness={0.9} /></mesh>)}
          {[0, 1, 2].map((index) => <mesh key={index} castShadow position={[0.095, -0.075 - index * 0.055, -0.055]} scale={[0.026 - index * 0.003, 0.032, 0.026 - index * 0.003]}><dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color={palette.hair} roughness={0.9} /></mesh>)}
        </>
      )}
      {profile.hairStyle === 'warrior-crest' && (
        <>
          {[-0.055, 0, 0.055].map((x, index) => <mesh key={x} castShadow position={[x, 0.15 + Math.abs(index - 1) * 0.012, -0.02]} rotation={[0, 0, (index - 1) * -0.18]}><coneGeometry args={[0.035, 0.11, 6]} /><meshStandardMaterial color={palette.hair} roughness={0.86} /></mesh>)}
          <mesh castShadow position={[-0.105, 0.025, 0]} scale={[0.032, 0.065, 0.035]}><dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color={palette.hair} roughness={0.9} /></mesh>
        </>
      )}
      {profile.hairStyle === 'long-scholar' && (
        <>
          {[-0.095, 0.095].flatMap((x) => [0, 1, 2, 3].map((index) => <mesh key={`${x}-${index}`} castShadow position={[x * (1 - index * 0.08), -0.04 - index * 0.065, -0.045]} scale={[0.032, 0.045, 0.032]}><dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color={palette.hair} roughness={0.88} /></mesh>))}
          <mesh castShadow position={[0, -0.12, -0.105]} scale={[0.085, 0.16, 0.032]}><capsuleGeometry args={[1, 1.2, 4, 8]} /><meshStandardMaterial color={palette.hair} roughness={0.9} /></mesh>
        </>
      )}
      {[-eyeX, eyeX].map((x) => <mesh key={x} position={[x, 0.04, 0.103]} scale={[1, 0.78, 0.55]}><sphereGeometry args={[0.014, 8, 6]} /><meshStandardMaterial color={palette.eye} emissive={palette.eye} emissiveIntensity={0.18} roughness={0.45} /></mesh>)}
      <mesh position={[0, 0.006, 0.111]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.026, 0.004, 5, 10, Math.PI]} /><meshStandardMaterial color={palette.clothDark} roughness={0.8} /></mesh>
    </group>
  );
}

function TorsoIdentity({ hero }: { hero: Hero }) {
  const palette = colors[hero.id as keyof typeof colors] ?? colors.mira;
  if (hero.id === 'kael') {
    return (
      <group position={[0, -0.03, 0.018]}>
        <mesh castShadow scale={[0.155, 0.18, 0.085]}><dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color={palette.leather} roughness={0.78} /></mesh>
        <mesh castShadow position={[0, 0.025, 0.078]} scale={[0.12, 0.125, 0.025]}><octahedronGeometry args={[1, 0]} /><meshStandardMaterial color={palette.clothDark} roughness={0.72} /></mesh>
        {[-0.19, 0.19].map((x) => <mesh key={x} castShadow position={[x, 0.075, 0]} scale={[0.07, 0.04, 0.085]}><dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color={palette.metal} metalness={0.45} roughness={0.48} /></mesh>)}
      </group>
    );
  }
  if (hero.id === 'liora') {
    return (
      <group position={[0, 0.015, 0]}>
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.145, 0.045, 7, 18]} /><meshStandardMaterial color={palette.trim} roughness={0.82} /></mesh>
        <mesh castShadow position={[0, -0.11, -0.08]} rotation={[0.18, 0, 0]}><coneGeometry args={[0.18, 0.29, 0.34, 8, 1, true]} /><meshStandardMaterial color={palette.clothDark} side={2} roughness={0.9} /></mesh>
        <mesh position={[0, -0.065, 0.11]}><octahedronGeometry args={[0.035, 0]} /><meshStandardMaterial color="#8de7ff" emissive="#4eaecf" emissiveIntensity={1.25} roughness={0.35} /></mesh>
      </group>
    );
  }
  return (
    <group position={[0, 0.015, 0]}>
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.15, 0.05, 7, 18]} /><meshStandardMaterial color={palette.trim} roughness={0.9} /></mesh>
      <mesh castShadow position={[0, -0.08, -0.075]} rotation={[0.12, 0, 0]}><coneGeometry args={[0.17, 0.25, 0.29, 8, 1, true]} /><meshStandardMaterial color={palette.clothDark} side={2} roughness={0.92} /></mesh>
      <mesh position={[0, -0.04, 0.1]}><circleGeometry args={[0.038, 10]} /><meshStandardMaterial color={palette.metal} metalness={0.4} roughness={0.45} /></mesh>
    </group>
  );
}

function HipIdentity({ hero, bookState }: { hero: Hero; bookState: HeroCustomizationMeta['bookState'] }) {
  const palette = colors[hero.id as keyof typeof colors] ?? colors.mira;
  return (
    <group position={[0, -0.03, 0]}>
      <mesh castShadow scale={[0.19, 0.026, 0.12]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color={palette.leather} roughness={0.88} /></mesh>
      {hero.id === 'mira' && (
        <group position={[0.19, -0.1, 0.03]}>
          <mesh castShadow scale={[0.095, 0.105, 0.055]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color={palette.leather} roughness={0.9} /></mesh>
          <mesh position={[0, 0.03, 0.057]}><circleGeometry args={[0.024, 10]} /><meshStandardMaterial color="#d8ddd4" roughness={0.7} /></mesh>
        </group>
      )}
      {hero.id === 'liora' && bookState === 'packed' && (
        <mesh castShadow position={[-0.17, -0.075, 0.02]} rotation={[0, 0, -0.12]} scale={[0.065, 0.09, 0.025]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#69522d" roughness={0.88} /></mesh>
      )}
    </group>
  );
}

function tintProp(root: Object3D, tint: string) {
  const clone = cloneSkeleton(root);
  const color = new Color(tint);
  clone.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const next = materials.map((material) => {
      const cloned = material.clone();
      if (cloned instanceof MeshStandardMaterial) {
        cloned.color.lerp(color, 0.1);
        cloned.roughness = Math.max(0.42, cloned.roughness);
      }
      return cloned;
    });
    object.material = Array.isArray(object.material) ? next : next[0];
  });
  return clone;
}

function LoadedProp({ url, targetSize, tint }: { url: string; targetSize: number; tint: string }) {
  const gltf = useGLTF(url);
  const prepared = useMemo(() => {
    const object = tintProp(gltf.scene, tint);
    const box = new Box3().setFromObject(object);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    object.position.set(-center.x, -box.min.y, -center.z);
    return { object, scale: targetSize / Math.max(0.001, size.x, size.y, size.z) };
  }, [gltf.scene, targetSize, tint]);
  return <primitive object={prepared.object} scale={prepared.scale} />;
}

function ProceduralWeapon({ id, palette }: { id: string; palette: (typeof colors)[keyof typeof colors] }) {
  if (id === 'iron-sword') {
    return <group><mesh castShadow position={[0, 0.3, 0]}><boxGeometry args={[0.045, 0.62, 0.022]} /><meshStandardMaterial color={palette.metal} metalness={0.72} roughness={0.32} /></mesh><mesh castShadow position={[0, -0.025, 0]}><boxGeometry args={[0.22, 0.035, 0.05]} /><meshStandardMaterial color="#b78d4a" metalness={0.45} roughness={0.42} /></mesh><mesh castShadow position={[0, -0.13, 0]}><cylinderGeometry args={[0.035, 0.04, 0.22, 8]} /><meshStandardMaterial color={palette.leather} roughness={0.85} /></mesh></group>;
  }
  if (id === 'oak-staff') {
    return <group><mesh castShadow position={[0, 0.48, 0]}><cylinderGeometry args={[0.022, 0.03, 1.05, 8]} /><meshStandardMaterial color="#6b4628" roughness={0.9} /></mesh><mesh position={[0, 1.02, 0]}><octahedronGeometry args={[0.1, 0]} /><meshStandardMaterial color="#78cfff" emissive="#408cb5" emissiveIntensity={1.2} roughness={0.3} /></mesh></group>;
  }
  return <group><mesh castShadow position={[0, 0.55, 0]}><cylinderGeometry args={[0.018, 0.023, 1.2, 8]} /><meshStandardMaterial color="#6b4628" roughness={0.9} /></mesh><mesh castShadow position={[0, 1.2, 0]}><coneGeometry args={[0.075, 0.22, 6]} /><meshStandardMaterial color={palette.metal} metalness={0.65} roughness={0.36} /></mesh></group>;
}

function WeaponModel({ hero, meta, entry, baseUrl }: { hero: Hero; meta: HeroCustomizationMeta; entry?: ManifestModelEntry; baseUrl: string }) {
  const palette = colors[hero.id as keyof typeof colors] ?? colors.mira;
  const targetSize = meta.weaponId === 'iron-sword' ? 0.82 : 1.25;
  const fallback = <ProceduralWeapon id={meta.weaponId} palette={palette} />;
  if (!entry?.file) return fallback;
  return <Suspense fallback={fallback}><LoadedProp url={`${baseUrl}${entry.file}`} targetSize={entry.targetSize ?? targetSize} tint={palette.metal} /></Suspense>;
}

function BookModel({ entry, baseUrl }: { entry?: ManifestModelEntry; baseUrl: string }) {
  const fallback = <mesh castShadow scale={[0.085, 0.12, 0.028]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#72572f" roughness={0.88} /></mesh>;
  if (!entry?.file) return fallback;
  return <Suspense fallback={fallback}><LoadedProp url={`${baseUrl}${entry.file}`} targetSize={entry.targetSize ?? 0.22} tint="#7c6236" /></Suspense>;
}

const attach = (target: Object3D | undefined, fallbackPosition: [number, number, number], child: ReactNode, key: string) => (
  target ? createPortal(<group key={key}>{child}</group>, target) : <group key={key} position={fallbackPosition}>{child}</group>
);

export function HeroCustomization3D({
  hero,
  intent,
  model,
  attachments,
  models,
  baseUrl,
}: {
  hero: Hero;
  intent: HeroVisualIntent;
  model: Object3D;
  attachments: AttachmentNodes;
  models: Record<string, ManifestModelEntry>;
  baseUrl: string;
}) {
  const meta = customizationMetaFor(hero, intent);
  const palette = colors[hero.id as keyof typeof colors] ?? colors.mira;
  const weapon = <WeaponModel hero={hero} meta={meta} entry={models[meta.weaponAssetId]} baseUrl={baseUrl} />;
  const weaponPlacement = meta.weaponState === 'ready'
    ? attach(attachments.rightHand, [0.32, 1.0, 0.03], <group position={[0, -0.02, 0]} rotation={[0, 0, meta.weaponId === 'iron-sword' ? -0.12 : 0.04]}>{weapon}</group>, 'weapon-ready')
    : meta.weaponId === 'iron-sword'
      ? attach(attachments.hips, [0.2, 0.78, -0.03], <group position={[0.17, -0.27, -0.04]} rotation={[0, 0, -0.42]}>{weapon}</group>, 'weapon-hip')
      : attach(attachments.chest, [0.22, 1.18, -0.14], <group position={[0.18, -0.62, -0.15]} rotation={[0.05, 0, 0.12]}>{weapon}</group>, 'weapon-back');

  const book = meta.bookState === 'reading'
    ? attach(attachments.leftHand, [-0.3, 1.0, 0.08], <group position={[0, -0.035, 0.06]} rotation={[0.22, 0.15, 0.1]}><BookModel entry={models.spellbook} baseUrl={baseUrl} /></group>, 'book-reading')
    : null;

  return (
    <group name={`hero-customization-${hero.id}`} userData={{ customization: 'modular-v1', heroId: hero.id, intent, attachmentPoints: attachments.found.join(',') }}>
      {attach(attachments.head, [0, 1.55, 0], <HairAndFace hero={hero} />, 'head-identity')}
      {attach(attachments.chest, [0, 1.18, 0], <TorsoIdentity hero={hero} />, 'torso-identity')}
      {attach(attachments.hips, [0, 0.82, 0], <HipIdentity hero={hero} bookState={meta.bookState} />, 'hip-identity')}
      {weaponPlacement}
      {book}
      {hero.id === 'liora' && intent === 'dungeon' && <pointLight color="#75d7ff" intensity={0.7} distance={1.8} position={[0, 1.15, 0.2]} />}
      {hero.id === 'mira' && meta.weaponState === 'ready' && <pointLight color={palette.trim} intensity={0.25} distance={1.2} position={[0.2, 1.1, 0.1]} />}
      <primitive object={model} visible={false} />
    </group>
  );
}
