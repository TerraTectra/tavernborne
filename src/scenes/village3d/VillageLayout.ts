export type VillageBuildingId = 'tavern' | 'blacksmith' | 'armory' | 'market' | 'guild' | 'shrine' | 'dungeonGate';

export type VillageBuildingType = 'tavern' | 'forge' | 'armory' | 'market' | 'guild' | 'shrine' | 'gate';

export type Vec3 = [number, number, number];

export type VillageBuilding = {
  id: VillageBuildingId;
  type: VillageBuildingType;
  name: string;
  label: string;
  description: string;
  position: Vec3;
  rotationY: number;
  scale: number;
  wallColor: string;
  roofColor: string;
  trimColor: string;
  lightColor: string;
};

export const villageBuildings: VillageBuilding[] = [
  {
    id: 'guild',
    type: 'guild',
    name: 'Гильдия',
    label: 'Герои',
    description: 'Найм, классы, черты и будущие настройки отряда.',
    position: [-2.6, 0, -1.3],
    rotationY: 0.38,
    scale: 0.92,
    wallColor: '#6f5a42',
    roofColor: '#334f8a',
    trimColor: '#f1c76f',
    lightColor: '#ffd98a',
  },
  {
    id: 'dungeonGate',
    type: 'gate',
    name: 'Врата подземелья',
    label: 'Поход',
    description: 'Дальний вход в автоэкспедиции и будущие боевые сцены.',
    position: [2.8, 0, -1.55],
    rotationY: -0.58,
    scale: 1,
    wallColor: '#343044',
    roofColor: '#4e326e',
    trimColor: '#b99cff',
    lightColor: '#ad6cff',
  },
  {
    id: 'armory',
    type: 'armory',
    name: 'Оружейная',
    label: 'Оружие',
    description: 'Оружие, броня и будущая автоэкипировка героев.',
    position: [2.35, 0, 0.18],
    rotationY: -0.4,
    scale: 0.86,
    wallColor: '#67625b',
    roofColor: '#3b5879',
    trimColor: '#dfe7e8',
    lightColor: '#ffe0a3',
  },
  {
    id: 'market',
    type: 'market',
    name: 'Рынок',
    label: 'Торговля',
    description: 'Продажа добычи, расходники и будущие торговые события.',
    position: [-2.45, 0, 0.65],
    rotationY: 0.28,
    scale: 0.82,
    wallColor: '#7b4b2e',
    roofColor: '#d49b45',
    trimColor: '#f9d37a',
    lightColor: '#ffd078',
  },
  {
    id: 'tavern',
    type: 'tavern',
    name: 'Таверна',
    label: 'Главный хаб',
    description: 'Центр поселения: отдых, управление героями и старт экспедиций.',
    position: [0, 0, 0.35],
    rotationY: 0,
    scale: 1.24,
    wallColor: '#8a512d',
    roofColor: '#274463',
    trimColor: '#f3c46c',
    lightColor: '#ffbf57',
  },
  {
    id: 'shrine',
    type: 'shrine',
    name: 'Алтарь пути',
    label: 'Престиж',
    description: 'Постоянные бонусы, новые регионы и перезапуск прогресса.',
    position: [-1.75, 0, 2.15],
    rotationY: 0.25,
    scale: 0.74,
    wallColor: '#6e6a73',
    roofColor: '#4d5a8e',
    trimColor: '#8bd8ff',
    lightColor: '#8bd8ff',
  },
  {
    id: 'blacksmith',
    type: 'forge',
    name: 'Кузница',
    label: 'Улучшение',
    description: 'Перековка, улучшение снаряжения и редкие материалы.',
    position: [1.75, 0, 2.05],
    rotationY: -0.24,
    scale: 0.9,
    wallColor: '#6e3f25',
    roofColor: '#394e66',
    trimColor: '#ff9a4d',
    lightColor: '#ff7a24',
  },
];

export const defaultSelectedBuildingId: VillageBuildingId = 'tavern';
