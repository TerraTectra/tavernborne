import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';

export type AppearanceProfileId = 'mira-scout' | 'kael-vanguard' | 'liora-arcanist' | 'family-initiate';

type HairStyle = 'braid' | 'cropped' | 'bob' | 'ponytail';
type EquipmentStyle = 'dagger' | 'sword' | 'staff' | 'none';

export type HeroAppearanceProfile = {
  id: AppearanceProfileId;
  hairStyle: HairStyle;
  hair: string;
  skin: string;
  cloth: string;
  secondary: string;
  trim: string;
  metal: string;
  cape?: string;
  shoulderArmor: 'none' | 'light' | 'heavy';
  equipment: EquipmentStyle;
};

export type ModularAppearanceResult = {
  profileId: AppearanceProfileId;
  moduleCount: number;
  heldEquipment?: Object3D;
  stowedEquipment?: Object3D;
};

const profiles: Record<string, HeroAppearanceProfile> = {
  mira: {
    id: 'mira-scout',
    hairStyle: 'braid',
    hair: '#b9c1c9',
    skin: '#d6a47f',
    cloth: '#2f846a',
    secondary: '#244e43',
    trim: '#b8d8a7',
    metal: '#aeb8b8',
    cape: '#244c43',
    shoulderArmor: 'light',
    equipment: 'dagger',
  },
  kael: {
    id: 'kael-vanguard',
    hairStyle: 'cropped',
    hair: '#3b271f',
    skin: '#c88d68',
    cloth: '#8c3e35',
    secondary: '#4f2724',
    trim: '#d49a6a',
    metal: '#aeb5bb',
    cape: '#5f2926',
    shoulderArmor: 'heavy',
    equipment: 'sword',
  },
  liora: {
    id: 'liora-arcanist',
    hairStyle: 'bob',
    hair: '#d6d9e4',
    skin: '#e0b492',
    cloth: '#496ca9',
    secondary: '#313e70',
    trim: '#b4c9f1',
    metal: '#bac6d8',
    cape: '#303d72',
    shoulderArmor: 'light',
    equipment: 'staff',
  },
};

const fallbackProfile: HeroAppearanceProfile = {
  id: 'family-initiate',
  hairStyle: 'ponytail',
  hair: '#5f4635',
  skin: '#d2a07a',
  cloth: '#566b62',
  secondary: '#36433e',
  trim: '#b9aa7a',
  metal: '#a7adb0',
  shoulderArmor: 'none',
  equipment: 'none',
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');

function material(color: string, options: { metalness?: number; roughness?: number; emissive?: string; emissiveIntensity?: number; side?: 0 | 1 | 2 } = {}) {
  return new MeshStandardMaterial({
    color: new Color(color),
    metalness: options.metalness ?? 0.04,
    roughness: options.roughness ?? 0.72,
    emissive: options.emissive ? new Color(options.emissive) : undefined,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    side: options.side,
  });
}

function markModule<T extends Object3D>(object: T, kind: string): T {
  object.userData.tavernborneAppearanceModule = true;
  object.userData.tavernborneAppearanceKind = kind;
  object.traverse((child) => {
    if (child instanceof Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      child.frustumCulled = false;
    }
  });
  return object;
}

function findBone(root: Object3D, aliases: string[]): Object3D | undefined {
  const candidates: Object3D[] = [];
  root.traverse((object) => {
    if ((object as { isBone?: boolean }).isBone) candidates.push(object);
  });
  const normalizedAliases = aliases.map(normalize);
  for (const alias of normalizedAliases) {
    const exact = candidates.find((candidate) => normalize(candidate.name) === alias);
    if (exact) return exact;
  }
  for (const alias of normalizedAliases) {
    const partial = candidates.find((candidate) => normalize(candidate.name).includes(alias));
    if (partial) return partial;
  }
  return undefined;
}

function attach(root: Object3D, aliases: string[], object: Object3D, fallbackOffset: [number, number, number]) {
  const parent = findBone(root, aliases) ?? root;
  if (parent === root) object.position.set(...fallbackOffset);
  parent.add(object);
  return object;
}

function createHair(profile: HeroAppearanceProfile) {
  const group = new Group();
  const hairMaterial = material(profile.hair, { roughness: 0.86 });

  const cap = new Mesh(new SphereGeometry(0.165, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMaterial);
  cap.scale.set(1.06, 0.78, 1.02);
  cap.position.set(0, 0.055, -0.015);
  group.add(cap);

  if (profile.hairStyle === 'braid') {
    for (let index = 0; index < 5; index += 1) {
      const knot = new Mesh(new SphereGeometry(0.052 - index * 0.004, 10, 8), hairMaterial);
      knot.position.set(0.105, -0.03 - index * 0.075, -0.105 - index * 0.014);
      knot.rotation.z = -0.12;
      group.add(knot);
    }
  } else if (profile.hairStyle === 'bob') {
    for (const side of [-1, 1]) {
      const lock = new Mesh(new SphereGeometry(0.078, 10, 8), hairMaterial);
      lock.scale.set(0.6, 1.65, 0.72);
      lock.position.set(side * 0.135, -0.095, -0.005);
      lock.rotation.z = side * 0.16;
      group.add(lock);
    }
  } else if (profile.hairStyle === 'ponytail') {
    const tail = new Mesh(new ConeGeometry(0.075, 0.34, 10), hairMaterial);
    tail.position.set(0, -0.09, -0.19);
    tail.rotation.x = -0.38;
    group.add(tail);
  } else {
    const ridge = new Mesh(new BoxGeometry(0.1, 0.08, 0.22), hairMaterial);
    ridge.position.set(0, 0.15, -0.01);
    ridge.rotation.x = -0.1;
    group.add(ridge);
  }

  return markModule(group, 'hair');
}

function createFaceDetails(profile: HeroAppearanceProfile) {
  const group = new Group();
  const eyeMaterial = material('#20252b', { roughness: 0.35 });
  const browMaterial = material(profile.hair, { roughness: 0.78 });
  for (const side of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.012, 8, 6), eyeMaterial);
    eye.position.set(side * 0.052, 0.015, 0.155);
    eye.scale.set(1.15, 0.72, 0.5);
    group.add(eye);
    const brow = new Mesh(new BoxGeometry(0.05, 0.008, 0.008), browMaterial);
    brow.position.set(side * 0.052, 0.052, 0.158);
    brow.rotation.z = side * -0.08;
    group.add(brow);
  }
  return markModule(group, 'face');
}

function createTorsoOutfit(profile: HeroAppearanceProfile) {
  const group = new Group();
  const clothMaterial = material(profile.cloth, { roughness: 0.83 });
  const secondaryMaterial = material(profile.secondary, { roughness: 0.8 });
  const trimMaterial = material(profile.trim, { roughness: 0.64 });
  const metalMaterial = material(profile.metal, { metalness: 0.55, roughness: 0.38 });

  const vest = new Mesh(new BoxGeometry(0.37, 0.47, 0.16), clothMaterial);
  vest.position.set(0, 0.02, 0.02);
  vest.scale.set(1, 1, 0.72);
  group.add(vest);

  const collar = new Mesh(new TorusGeometry(0.145, 0.026, 8, 18, Math.PI * 1.45), trimMaterial);
  collar.position.set(0, 0.245, 0.035);
  collar.rotation.set(Math.PI / 2, 0, Math.PI * 0.78);
  group.add(collar);

  const sash = new Mesh(new BoxGeometry(0.43, 0.075, 0.18), secondaryMaterial);
  sash.position.set(0, -0.205, 0.01);
  sash.rotation.z = -0.08;
  group.add(sash);

  if (profile.shoulderArmor !== 'none') {
    for (const side of [-1, 1]) {
      const pauldron = new Mesh(
        new SphereGeometry(profile.shoulderArmor === 'heavy' ? 0.135 : 0.105, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58),
        profile.shoulderArmor === 'heavy' ? metalMaterial : trimMaterial,
      );
      pauldron.scale.set(1.25, 0.62, 0.95);
      pauldron.position.set(side * 0.25, 0.17, 0);
      pauldron.rotation.z = side * -0.2;
      group.add(pauldron);
    }
  }

  if (profile.cape) {
    const cape = new Mesh(new PlaneGeometry(0.48, 0.7, 1, 3), material(profile.cape, { roughness: 0.92, side: DoubleSide }));
    cape.position.set(0, -0.08, -0.13);
    cape.rotation.x = 0.14;
    group.add(cape);
  }

  return markModule(group, 'outfit');
}

function createBelt(profile: HeroAppearanceProfile) {
  const group = new Group();
  const leather = material('#4b2f21', { roughness: 0.92 });
  const trim = material(profile.trim, { metalness: 0.18, roughness: 0.48 });
  const belt = new Mesh(new TorusGeometry(0.205, 0.025, 7, 18), leather);
  belt.rotation.x = Math.PI / 2;
  group.add(belt);
  const buckle = new Mesh(new BoxGeometry(0.07, 0.055, 0.025), trim);
  buckle.position.set(0, 0, 0.205);
  group.add(buckle);
  for (const side of [-1, 1]) {
    const pouch = new Mesh(new BoxGeometry(0.075, 0.09, 0.055), leather);
    pouch.position.set(side * 0.16, -0.045, 0.12);
    group.add(pouch);
  }
  return markModule(group, 'belt');
}

function createEquipment(profile: HeroAppearanceProfile) {
  const group = new Group();
  const metal = material(profile.metal, { metalness: 0.72, roughness: 0.3 });
  const leather = material('#4b2e20', { roughness: 0.92 });
  const accent = material(profile.trim, { metalness: 0.18, roughness: 0.52 });

  if (profile.equipment === 'sword') {
    const blade = new Mesh(new BoxGeometry(0.045, 0.72, 0.018), metal);
    blade.position.y = -0.36;
    const tip = new Mesh(new ConeGeometry(0.032, 0.12, 4), metal);
    tip.position.y = -0.78;
    tip.rotation.z = Math.PI;
    const guard = new Mesh(new BoxGeometry(0.28, 0.035, 0.04), accent);
    guard.position.y = 0.015;
    const grip = new Mesh(new CylinderGeometry(0.025, 0.025, 0.22, 8), leather);
    grip.position.y = 0.14;
    group.add(blade, tip, guard, grip);
  } else if (profile.equipment === 'dagger') {
    const blade = new Mesh(new BoxGeometry(0.035, 0.36, 0.014), metal);
    blade.position.y = -0.18;
    const guard = new Mesh(new BoxGeometry(0.16, 0.026, 0.032), accent);
    const grip = new Mesh(new CylinderGeometry(0.022, 0.022, 0.16, 8), leather);
    grip.position.y = 0.095;
    group.add(blade, guard, grip);
  } else if (profile.equipment === 'staff') {
    const shaft = new Mesh(new CylinderGeometry(0.025, 0.032, 1.35, 9), leather);
    shaft.position.y = -0.52;
    const focus = new Mesh(new SphereGeometry(0.095, 12, 9), material('#84b8ff', { emissive: '#446fff', emissiveIntensity: 1.8, roughness: 0.25 }));
    focus.position.y = 0.19;
    const ring = new Mesh(new TorusGeometry(0.13, 0.016, 8, 20), accent);
    ring.position.y = 0.19;
    ring.rotation.x = Math.PI / 2;
    group.add(shaft, focus, ring);
  }

  return markModule(group, 'equipment');
}

function createStowedEquipment(profile: HeroAppearanceProfile) {
  const equipment = createEquipment(profile);
  equipment.rotation.set(0.08, 0, profile.equipment === 'staff' ? -0.18 : -0.62);
  equipment.position.set(profile.equipment === 'staff' ? -0.16 : 0.22, 0.04, -0.13);
  equipment.scale.setScalar(profile.equipment === 'staff' ? 0.82 : 0.88);
  equipment.userData.tavernborneAppearanceKind = 'stowed-equipment';
  return equipment;
}

export function getHeroAppearanceProfile(heroId: string): HeroAppearanceProfile {
  return profiles[heroId] ?? fallbackProfile;
}

export function applyModularHeroAppearance(root: Object3D, heroId: string): ModularAppearanceResult {
  const profile = getHeroAppearanceProfile(heroId);
  let moduleCount = 0;

  const hair = attach(root, ['head', 'mixamorighead', 'defhead'], createHair(profile), [0, 1.72, 0]);
  hair.position.y += 0.08;
  moduleCount += 1;

  attach(root, ['head', 'mixamorighead', 'defhead'], createFaceDetails(profile), [0, 1.72, 0]);
  moduleCount += 1;

  attach(root, ['spine2', 'chest', 'upperchest', 'spine1', 'spine'], createTorsoOutfit(profile), [0, 1.12, 0]);
  moduleCount += 1;

  attach(root, ['hips', 'pelvis', 'root'], createBelt(profile), [0, 0.9, 0]);
  moduleCount += 1;

  let heldEquipment: Object3D | undefined;
  let stowedEquipment: Object3D | undefined;
  if (profile.equipment !== 'none') {
    heldEquipment = attach(root, ['righthand', 'handr', 'rhand', 'rightwrist'], createEquipment(profile), [0.36, 1.05, 0]);
    heldEquipment.rotation.set(0, 0, profile.equipment === 'staff' ? 0 : Math.PI);
    heldEquipment.position.y += profile.equipment === 'staff' ? 0.15 : -0.05;
    heldEquipment.visible = false;
    moduleCount += 1;

    stowedEquipment = attach(root, ['spine2', 'chest', 'upperchest', 'spine1', 'spine'], createStowedEquipment(profile), [0, 1.15, -0.16]);
    stowedEquipment.visible = true;
    moduleCount += 1;
  }

  root.userData.tavernborneAppearanceProfile = profile.id;
  root.userData.tavernborneAppearanceModules = moduleCount;

  return { profileId: profile.id, moduleCount, heldEquipment, stowedEquipment };
}
