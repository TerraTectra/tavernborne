import { createPortal } from '@react-three/fiber';
import { useMemo } from 'react';
import { Bone, Group, Object3D } from 'three';
import type { Hero } from '../simulation';

type AnchorName = 'head' | 'chest' | 'back' | 'rightHand' | 'leftHand' | 'hips';

type Anchors = Partial<Record<AnchorName, Object3D>>;

const normalize = (value: string) => value.toLowerCase().replace(/[_\-.\s]+/g, '');

const anchorMatchers: Record<AnchorName, string[]> = {
  head: ['head', 'mixamorighead', 'headtop'],
  chest: ['chest', 'upperchest', 'spine2', 'spine3'],
  back: ['upperchest', 'chest', 'spine2', 'spine3'],
  rightHand: ['righthand', 'handr', 'mixamorigrighthand', 'rhand'],
  leftHand: ['lefthand', 'handl', 'mixamoriglefthand', 'lhand'],
  hips: ['hips', 'pelvis', 'mixamorighips'],
};

function resolveAnchors(root: Object3D): Anchors {
  const objects: Object3D[] = [];
  root.traverse((object) => objects.push(object));
  const anchors: Anchors = {};

  (Object.keys(anchorMatchers) as AnchorName[]).forEach((anchor) => {
    const matchers = anchorMatchers[anchor];
    anchors[anchor] = objects.find((object) => {
      const name = normalize(object.name);
      return object instanceof Bone && matchers.some((matcher) => name === matcher || name.endsWith(matcher));
    }) ?? objects.find((object) => {
      const name = normalize(object.name);
      return matchers.some((matcher) => name.includes(matcher));
    });
  });

  return anchors;
}

function MiraHead() {
  return (
    <group position={[0, 0.03, 0]} rotation={[0, Math.PI, 0]} data-testid="identity-mira-hair">
      <mesh castShadow position={[0, 0.11, -0.015]} scale={[0.95, 0.58, 0.92]}><sphereGeometry args={[0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.55]} /><meshStandardMaterial color="#b8c1c7" roughness={0.88} /></mesh>
      <mesh castShadow position={[0, -0.01, -0.095]} rotation={[0.08, 0, 0]}><coneGeometry args={[0.085, 0.3, 10]} /><meshStandardMaterial color="#9ba6ad" roughness={0.9} /></mesh>
      <mesh castShadow position={[-0.095, 0.02, 0]} rotation={[0, 0, 0.2]}><coneGeometry args={[0.035, 0.19, 8]} /><meshStandardMaterial color="#a9b2b8" roughness={0.9} /></mesh>
    </group>
  );
}

function KaelHead() {
  return (
    <group position={[0, 0.045, 0]} rotation={[0, Math.PI, 0]} data-testid="identity-kael-hair">
      <mesh castShadow position={[0, 0.1, -0.015]} scale={[1.02, 0.45, 0.96]}><sphereGeometry args={[0.12, 10, 7, 0, Math.PI * 2, 0, Math.PI / 1.7]} /><meshStandardMaterial color="#2d1b16" roughness={0.95} /></mesh>
      {[-0.07, 0, 0.07].map((x, index) => <mesh key={x} castShadow position={[x, 0.16 + index * 0.004, -0.01]} rotation={[0.08, 0, x * 2]}><coneGeometry args={[0.032, 0.13, 7]} /><meshStandardMaterial color="#3a2119" roughness={0.93} /></mesh>)}
    </group>
  );
}

function LioraHead() {
  return (
    <group position={[0, 0.01, 0]} rotation={[0, Math.PI, 0]} data-testid="identity-liora-hood">
      <mesh castShadow position={[0, 0.055, -0.015]} scale={[1.28, 1.1, 1.24]}><sphereGeometry args={[0.145, 14, 10, 0, Math.PI * 2, 0, Math.PI / 1.35]} /><meshStandardMaterial color="#375889" roughness={0.84} side={2} /></mesh>
      <mesh castShadow position={[0, -0.1, -0.095]} rotation={[-0.1, 0, 0]}><coneGeometry args={[0.12, 0.3, 12]} /><meshStandardMaterial color="#2e4d79" roughness={0.88} /></mesh>
      <mesh position={[0, 0.02, 0.13]}><torusGeometry args={[0.115, 0.018, 8, 18, Math.PI * 1.25]} /><meshStandardMaterial color="#b7c9ec" roughness={0.58} /></mesh>
    </group>
  );
}

function MiraChest() {
  return (
    <group position={[0, 0.02, -0.04]} data-testid="identity-mira-cloak">
      <mesh castShadow position={[0, -0.22, -0.13]} rotation={[0.08, 0, 0]}><coneGeometry args={[0.27, 0.72, 12, 1, true]} /><meshStandardMaterial color="#245f51" roughness={0.9} side={2} /></mesh>
      <mesh castShadow position={[0, 0.04, -0.12]} scale={[1.45, 0.48, 0.6]}><sphereGeometry args={[0.16, 12, 8]} /><meshStandardMaterial color="#3e9278" roughness={0.86} /></mesh>
      <mesh position={[0, 0.02, 0.145]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.07, 0.012, 8, 20]} /><meshStandardMaterial color="#d5be73" metalness={0.5} roughness={0.38} /></mesh>
    </group>
  );
}

function KaelChest() {
  return (
    <group data-testid="identity-kael-armor">
      <mesh castShadow position={[-0.2, 0.08, 0]} rotation={[0, 0, -0.16]}><sphereGeometry args={[0.14, 10, 7]} /><meshStandardMaterial color="#7e8589" metalness={0.42} roughness={0.54} /></mesh>
      <mesh castShadow position={[0, -0.02, 0.13]} scale={[1.45, 1.5, 0.45]}><boxGeometry args={[0.22, 0.3, 0.08]} /><meshStandardMaterial color="#71342e" roughness={0.72} /></mesh>
      <mesh position={[0, 0.05, 0.18]}><boxGeometry args={[0.24, 0.035, 0.025]} /><meshStandardMaterial color="#d19b63" metalness={0.35} roughness={0.46} /></mesh>
    </group>
  );
}

function LioraChest() {
  return (
    <group data-testid="identity-liora-mantle">
      <mesh castShadow position={[0, 0.08, 0]} scale={[1.65, 0.55, 1.05]}><sphereGeometry args={[0.17, 12, 8]} /><meshStandardMaterial color="#476ba6" roughness={0.82} /></mesh>
      <mesh position={[0, 0.01, 0.17]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.065, 0.012, 8, 20]} /><meshStandardMaterial color="#9bc9ed" emissive="#4b8bb6" emissiveIntensity={0.7} roughness={0.34} /></mesh>
    </group>
  );
}

function Staff() {
  return (
    <group position={[0, -0.31, 0.04]} rotation={[0.12, 0, -0.06]} data-testid="equipment-mira-staff">
      <mesh castShadow position={[0, -0.28, 0]}><cylinderGeometry args={[0.018, 0.025, 0.78, 9]} /><meshStandardMaterial color="#5f4027" roughness={0.92} /></mesh>
      <mesh castShadow position={[0, 0.13, 0]}><dodecahedronGeometry args={[0.075, 0]} /><meshStandardMaterial color="#7ee0c8" emissive="#39a68f" emissiveIntensity={1.2} roughness={0.32} /></mesh>
      <pointLight color="#73dbc2" intensity={0.45} distance={1.2} position={[0, 0.13, 0]} />
    </group>
  );
}

function Sword() {
  return (
    <group position={[0, -0.18, 0.03]} rotation={[0.02, 0, -0.05]} data-testid="equipment-kael-sword">
      <mesh castShadow position={[0, -0.26, 0]}><boxGeometry args={[0.035, 0.52, 0.018]} /><meshStandardMaterial color="#bbc2c8" metalness={0.78} roughness={0.26} /></mesh>
      <mesh castShadow position={[0, 0.03, 0]}><boxGeometry args={[0.19, 0.03, 0.04]} /><meshStandardMaterial color="#c18b52" metalness={0.4} roughness={0.42} /></mesh>
      <mesh castShadow position={[0, 0.1, 0]}><cylinderGeometry args={[0.025, 0.025, 0.15, 8]} /><meshStandardMaterial color="#3c241b" roughness={0.9} /></mesh>
    </group>
  );
}

function Focus() {
  return (
    <group position={[0, -0.02, 0.04]} data-testid="equipment-liora-focus">
      <mesh castShadow><octahedronGeometry args={[0.075, 0]} /><meshStandardMaterial color="#b8d8ff" emissive="#6ba6eb" emissiveIntensity={1.5} roughness={0.25} /></mesh>
      <pointLight color="#8dc4ff" intensity={0.4} distance={1.1} />
    </group>
  );
}

function Satchel() {
  return (
    <group position={[0.16, -0.22, -0.13]} rotation={[0.05, 0.2, -0.05]} data-testid="equipment-liora-satchel">
      <mesh castShadow><boxGeometry args={[0.2, 0.23, 0.11]} /><meshStandardMaterial color="#6d4e36" roughness={0.9} /></mesh>
      <mesh position={[0, 0.11, 0]}><torusGeometry args={[0.16, 0.012, 6, 18, Math.PI]} /><meshStandardMaterial color="#8b6949" roughness={0.86} /></mesh>
    </group>
  );
}

export function HeroIdentity3D({ hero, rigRoot, showWeapon }: { hero: Hero; rigRoot: Object3D; showWeapon: boolean }) {
  const anchors = useMemo(() => resolveAnchors(rigRoot), [rigRoot]);
  const portals: React.ReactNode[] = [];

  const add = (anchor: Object3D | undefined, node: React.ReactNode, key: string) => {
    if (anchor) portals.push(createPortal(<group key={key}>{node}</group>, anchor));
  };

  if (hero.id === 'mira') {
    add(anchors.head, <MiraHead />, 'mira-head');
    add(anchors.chest, <MiraChest />, 'mira-chest');
    if (showWeapon) add(anchors.rightHand, <Staff />, 'mira-staff');
  } else if (hero.id === 'kael') {
    add(anchors.head, <KaelHead />, 'kael-head');
    add(anchors.chest, <KaelChest />, 'kael-chest');
    if (showWeapon) add(anchors.rightHand, <Sword />, 'kael-sword');
  } else if (hero.id === 'liora') {
    add(anchors.head, <LioraHead />, 'liora-head');
    add(anchors.chest, <LioraChest />, 'liora-chest');
    add(anchors.hips, <Satchel />, 'liora-satchel');
    if (showWeapon) add(anchors.leftHand, <Focus />, 'liora-focus');
  }

  return <>{portals}</>;
}
