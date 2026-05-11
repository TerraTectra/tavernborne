import { villageAssets } from '../../assets/assetPaths';
import type { VillageObject } from './villageTypes';

export const villageObjects: VillageObject[] = [
  { id: 'ground-01', name: 'Западная поляна', kind: 'terrain', sprite: villageAssets.ground01, x: 360, y: 290, width: 190, depthOffset: -80 },
  { id: 'ground-02', name: 'Центральная площадь', kind: 'terrain', sprite: villageAssets.ground02, x: 590, y: 360, width: 230, depthOffset: -80 },
  { id: 'ground-03', name: 'Восточный склон', kind: 'terrain', sprite: villageAssets.ground03, x: 820, y: 300, width: 190, depthOffset: -80 },
  { id: 'road-01', name: 'Старая дорога', kind: 'road', sprite: villageAssets.road01, x: 470, y: 430, width: 180, depthOffset: -60 },
  { id: 'road-02', name: 'Тропа к вратам', kind: 'road', sprite: villageAssets.road02, x: 760, y: 390, width: 190, depthOffset: -60 },

  { id: 'guild', name: 'Гильдия', kind: 'building', sprite: villageAssets.guild, x: 380, y: 235, width: 172, scale: 1.14, interactive: true, label: 'Гильдия', description: 'Найм, классы и управление героями.' },
  { id: 'market', name: 'Рынок', kind: 'building', sprite: villageAssets.market, x: 280, y: 365, width: 160, scale: 1.06, interactive: true, label: 'Рынок', description: 'Торговля, расходники и продажа лишней добычи.' },
  { id: 'tavern', name: 'Таверна', kind: 'building', sprite: villageAssets.tavern, x: 590, y: 410, width: 230, scale: 1.18, interactive: true, label: 'Таверна', description: 'Главный хаб поселения и центр экспедиций.' },
  { id: 'armory', name: 'Оружейная', kind: 'building', sprite: villageAssets.armory, x: 835, y: 350, width: 170, scale: 1.1, interactive: true, label: 'Оружейная', description: 'Оружие, броня и будущая автоэкипировка.' },
  { id: 'dungeon-gate', name: 'Врата подземелья', kind: 'building', sprite: villageAssets.dungeonGate, x: 955, y: 240, width: 190, scale: 1.18, interactive: true, label: 'Врата', description: 'Переход в автоматические походы.' },
  { id: 'shrine', name: 'Алтарь пути', kind: 'building', sprite: villageAssets.shrine, x: 415, y: 570, width: 140, scale: 1.05, interactive: true, label: 'Алтарь', description: 'Престиж, постоянные бонусы и новые регионы.' },
  { id: 'blacksmith', name: 'Кузница', kind: 'building', sprite: villageAssets.blacksmith, x: 770, y: 595, width: 178, scale: 1.12, interactive: true, label: 'Кузница', description: 'Улучшение, перековка и материалы.' },

  { id: 'tree-01', name: 'Сосна', kind: 'prop', sprite: villageAssets.tree01, x: 160, y: 220, width: 82, scale: 1 },
  { id: 'tree-02', name: 'Сосна', kind: 'prop', sprite: villageAssets.tree02, x: 185, y: 610, width: 90, scale: 1.05 },
  { id: 'tree-03', name: 'Сосна', kind: 'prop', sprite: villageAssets.tree01, x: 1050, y: 540, width: 96, scale: 1.08 },
  { id: 'rock-01', name: 'Камень', kind: 'prop', sprite: villageAssets.rock01, x: 185, y: 455, width: 58 },
  { id: 'rock-02', name: 'Камень', kind: 'prop', sprite: villageAssets.rock01, x: 980, y: 480, width: 62 },
  { id: 'lamp-01', name: 'Фонарь', kind: 'prop', sprite: villageAssets.lamp01, x: 500, y: 365, width: 54 },
  { id: 'lamp-02', name: 'Фонарь', kind: 'prop', sprite: villageAssets.lamp01, x: 690, y: 430, width: 54 },
];
