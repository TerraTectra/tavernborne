export type VillageObjectKind = 'building' | 'prop' | 'terrain' | 'road';

export type VillageObject = {
  id: string;
  name: string;
  kind: VillageObjectKind;
  sprite: string;
  x: number;
  y: number;
  width: number;
  depthOffset?: number;
  scale?: number;
  interactive?: boolean;
  label?: string;
  description?: string;
};
