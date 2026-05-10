import { ReactNode, useEffect, useMemo, useState } from 'react';

const SAVE_KEY = 'tavernborne-realtime-autobattle-v1';
const TICK_MS = 280;

type HeroRole = 'Фронтлайн' | 'Урон' | 'Контроль';
type Rarity = 'обычное' | 'редкое';

type HeroTemplate = {
  id: string;
  name: string;
  role: HeroRole;
  maxHp: number;
  atk: number;
  def: number;
  speed: number;
  trait: string;
  icon: string;
  lane: number;
  x: number;
  y: number;
};

type HeroState = HeroTemplate & {
  level: number;
  xp: number;
  slot: number;
};

type BattleHero = HeroState & {
  battleId: string;
  hp: number;
  maxBattleHp: number;
  meter: number;
  castCount: number;
  attackFlash: number;
};

type EnemyTemplate = {
  name: string;
  maxHp: number;
  atk: number;
  def: number;
  speed: number;
  gold: number;
  icon: string;
  boss?: boolean;
};

type BattleEnemy = EnemyTemplate & {
  floor: number;
  hp: number;
  meter: number;
  x: number;
  y: number;
  attackFlash: number;
};

type LootTemplate = { name: string; type: string; atk: number; def: number; rarity: Rarity };
type LootItem = LootTemplate & { id: string; floor: number };
type Floater = { id: string; x: number; y: number; text: string; tone: string; life: number };
type BattleState = { id: number; floor: number; time: number; enemy: BattleEnemy; heroes: BattleHero[] };

type GameState = {
  gold: number;
  floor: number;
  tavernLevel: number;
  prestige: number;
  autoRun: boolean;
  heroes: HeroState[];
  loot: LootItem[];
  battle: BattleState | null;
  floaters: Floater[];
  log: string[];
};

const heroTemplates: HeroTemplate[] = [
  { id: 'guard', name: 'Страж', role: 'Фронтлайн', maxHp: 58, atk: 7, def: 6, speed: 62, trait: 'держит линию и принимает основной урон', icon: '🛡️', lane: 0, x: 18, y: 58 },
  { id: 'cutthroat', name: 'Головорез', role: 'Урон', maxHp: 38, atk: 13, def: 2, speed: 90, trait: 'быстро бьёт и добивает раненых', icon: '🗡️', lane: 1, x: 25, y: 43 },
  { id: 'apprentice', name: 'Ученица мага', role: 'Контроль', maxHp: 32, atk: 10, def: 2, speed: 72, trait: 'копит заряд и периодически бьёт вспышкой', icon: '✨', lane: 2, x: 16, y: 31 },
];

const enemyTemplates: EnemyTemplate[] = [
  { name: 'Пещерная крыса', maxHp: 30, atk: 5, def: 0, speed: 76, gold: 8, icon: '🐀' },
  { name: 'Скелет-страж', maxHp: 50, atk: 7, def: 2, speed: 58, gold: 14, icon: '💀' },
  { name: 'Грибной громила', maxHp: 72, atk: 10, def: 3, speed: 42, gold: 20, icon: '🍄' },
  { name: 'Ночной мародёр', maxHp: 88, atk: 13, def: 4, speed: 82, gold: 28, icon: '🗡️' },
  { name: 'Подвальный босс', maxHp: 170, atk: 18, def: 7, speed: 62, gold: 75, icon: '👹', boss: true },
];

const lootTable: LootTemplate[] = [
  { name: 'Ржавая сабля', type: 'оружие', atk: 1, def: 0, rarity: 'обычное' },
  { name: 'Кольцо подвала', type: 'артефакт', atk: 1, def: 1, rarity: 'редкое' },
  { name: 'Кожаный жилет', type: 'броня', atk: 0, def: 2, rarity: 'обычное' },
  { name: 'Пыльный амулет', type: 'артефакт', atk: 2, def: 0, rarity: 'редкое' },
  { name: 'Малый эликсир', type: 'расходник', atk: 0, def: 1, rarity: 'обычное' },
];

function createInitialHeroes(): HeroState[] {
  return heroTemplates.map((hero, index) => ({ ...hero, level: 1, xp: 0, slot: index + 1 }));
}

function createInitialState(): GameState {
  return {
    gold: 95,
    floor: 1,
    tavernLevel: 1,
    prestige: 0,
    autoRun: false,
    heroes: createInitialHeroes(),
    loot: [],
    battle: null,
    floaters: [],
    log: ['Курс исправлен: никаких ручных пошаговых боёв.', 'Теперь цель — real-time автоэкспедиция: игрок строит систему, бой идёт сам.'],
  };
}

function safeLoad(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as Partial<GameState>;
    return {
      ...createInitialState(),
      ...parsed,
      autoRun: false,
      battle: null,
      floaters: [],
      heroes: Array.isArray(parsed.heroes) && parsed.heroes.length > 0 ? parsed.heroes : createInitialHeroes(),
      loot: Array.isArray(parsed.loot) ? parsed.loot : [],
      log: Array.isArray(parsed.log) ? parsed.log : [],
    };
  } catch {
    return createInitialState();
  }
}

function StatPill({ icon, label, value }: { icon: string; label: string; value: ReactNode }) {
  return <div className="flex items-center gap-2 rounded-full border border-amber-200/20 bg-black/25 px-3 py-1.5 text-sm text-amber-50"><span>{icon}</span><span className="text-amber-200/80">{label}</span><b>{value}</b></div>;
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-amber-200/15 bg-zinc-950/70 p-4 shadow-2xl shadow-black/30 backdrop-blur ${className}`}>{children}</div>;
}

function ProgressBar({ value, max, className = 'bg-amber-400' }: { value: number; max: number; className?: string }) {
  const width = Math.max(0, Math.min(100, max <= 0 ? 0 : (value / max) * 100));
  return <div className="h-2 overflow-hidden rounded-full bg-zinc-800"><div className={`h-full rounded-full ${className}`} style={{ width: `${width}%` }} /></div>;
}

function scaleEnemy(floor: number): EnemyTemplate & { floor: number } {
  const isBossFloor = floor % 10 === 0;
  const base = isBossFloor ? enemyTemplates[4] : enemyTemplates[Math.min(3, Math.floor((floor - 1) / 4))];
  const multiplier = 1 + floor * 0.14;
  return { ...base, floor, maxHp: Math.floor(base.maxHp * multiplier + floor * 4), atk: Math.floor(base.atk * (1 + floor * 0.055)), def: Math.floor(base.def + floor / 7), speed: Math.floor(base.speed + floor * 0.8), gold: Math.floor(base.gold * (1 + floor * 0.12)) };
}

function rollLoot(floor: number): LootItem | null {
  if (Math.random() < 0.48) return null;
  const base = lootTable[Math.floor(Math.random() * lootTable.length)];
  const bonus = Math.max(1, Math.floor(floor / 6));
  return { ...base, id: `${base.name}-${Date.now()}-${Math.random()}`, atk: base.atk ? base.atk + bonus : 0, def: base.def ? base.def + bonus : 0, floor };
}

function createBattle(state: GameState): BattleState {
  const enemy = scaleEnemy(state.floor);
  const battleHeroes = state.heroes.map((hero) => ({ ...hero, battleId: hero.id, hp: hero.maxHp + state.tavernLevel * 4 + state.prestige * 5, maxBattleHp: hero.maxHp + state.tavernLevel * 4 + state.prestige * 5, meter: Math.floor(Math.random() * 35), castCount: 0, attackFlash: 0 }));
  return { id: Date.now(), floor: state.floor, time: 0, enemy: { ...enemy, hp: enemy.maxHp, meter: Math.floor(Math.random() * 25), x: 76, y: enemy.boss ? 39 : 42, attackFlash: 0 }, heroes: battleHeroes };
}

function pickTank(heroes: BattleHero[]): BattleHero | undefined {
  return heroes.find((hero) => hero.role === 'Фронтлайн' && hero.hp > 0) || heroes.find((hero) => hero.hp > 0);
}

function tickBattle(prev: GameState): GameState {
  if (!prev.autoRun) return prev;
  const battle = prev.battle || createBattle(prev);
  let enemy: BattleEnemy = { ...battle.enemy, attackFlash: Math.max(0, battle.enemy.attackFlash - 1) };
  let heroes: BattleHero[] = battle.heroes.map((hero) => ({ ...hero, attackFlash: Math.max(0, hero.attackFlash - 1) }));
  const logLines: string[] = [];
  let floaters = prev.floaters.map((floater) => ({ ...floater, life: floater.life - 1, y: floater.y - 1.2 })).filter((floater) => floater.life > 0).slice(0, 12);
  const aliveHeroes = () => heroes.filter((hero) => hero.hp > 0);

  heroes = heroes.map((hero) => {
    if (hero.hp <= 0 || enemy.hp <= 0) return hero;
    const nextHero = { ...hero, meter: hero.meter + hero.speed / 8 };
    while (nextHero.meter >= 100 && enemy.hp > 0) {
      nextHero.meter -= 100;
      nextHero.castCount += 1;
      const execute = nextHero.role === 'Урон' && enemy.hp < enemy.maxHp * 0.35;
      const burst = nextHero.role === 'Контроль' && nextHero.castCount % 3 === 0;
      const raw = nextHero.atk + nextHero.level * 2 + prev.tavernLevel + prev.prestige * 3 + Math.floor(Math.random() * 4);
      const damage = Math.max(1, raw + (execute ? 7 : 0) + (burst ? 9 : 0) - enemy.def);
      enemy = { ...enemy, hp: Math.max(0, enemy.hp - damage) };
      nextHero.attackFlash = 2;
      floaters.push({ id: `${Date.now()}-${Math.random()}`, x: enemy.x, y: enemy.y - 7, text: `-${damage}`, tone: burst ? 'text-sky-200' : execute ? 'text-red-300' : 'text-amber-200', life: 6 });
      logLines.push(`${nextHero.name}: ${damage} урона${execute ? ' добиванием' : burst ? ' вспышкой' : ''}.`);
    }
    return nextHero;
  });

  if (enemy.hp > 0 && aliveHeroes().length > 0) {
    enemy = { ...enemy, meter: enemy.meter + enemy.speed / 8 };
    while (enemy.meter >= 100 && enemy.hp > 0 && aliveHeroes().length > 0) {
      enemy.meter -= 100;
      const target = pickTank(heroes);
      if (!target) break;
      const damage = Math.max(1, enemy.atk + Math.floor(Math.random() * 5) - target.def - Math.floor(prev.tavernLevel / 2));
      heroes = heroes.map((hero) => (hero.battleId === target.battleId ? { ...hero, hp: Math.max(0, hero.hp - damage) } : hero));
      enemy.attackFlash = 2;
      floaters.push({ id: `${Date.now()}-${Math.random()}`, x: target.x, y: target.y - 7, text: `-${damage}`, tone: 'text-red-300', life: 6 });
      logLines.push(`${enemy.name} бьёт ${target.name}: -${damage} HP.`);
    }
  }

  if (enemy.hp <= 0) {
    const foundGold = enemy.gold + Math.floor(Math.random() * 12) + prev.prestige * 6;
    const foundLoot = rollLoot(prev.floor);
    const nextFloor = prev.floor + 1;
    return { ...prev, gold: prev.gold + foundGold, floor: nextFloor, heroes: prev.heroes.map((hero) => ({ ...hero, xp: hero.xp + 7 + Math.floor(prev.floor / 2) })), loot: foundLoot ? [foundLoot, ...prev.loot].slice(0, 8) : prev.loot, battle: createBattle({ ...prev, floor: nextFloor }), floaters, log: [`Этаж ${prev.floor}: ${enemy.name} повержен. +${foundGold} золота${foundLoot ? `, найдено: ${foundLoot.name}` : ''}.`, ...logLines.slice(-3), ...prev.log].slice(0, 12) };
  }

  if (aliveHeroes().length === 0) {
    const penalty = Math.min(prev.gold, Math.max(5, Math.floor(enemy.gold / 2)));
    return { ...prev, autoRun: false, gold: Math.max(0, prev.gold - penalty), battle: { ...battle, enemy, heroes, time: battle.time + 1 }, floaters, log: [`Автоэкспедиция остановлена: отряд пал на этаже ${prev.floor}. Потери: ${penalty} золота.`, ...logLines.slice(-4), ...prev.log].slice(0, 12) };
  }

  return { ...prev, battle: { ...battle, enemy, heroes, time: battle.time + 1 }, floaters, log: logLines.length ? [...logLines.slice(-2), ...prev.log].slice(0, 12) : prev.log };
}

export default function TavernbornePreview() {
  const [state, setState] = useState<GameState>(() => safeLoad());
  const { gold, floor, tavernLevel, prestige, autoRun, heroes, loot, battle, floaters, log } = state;

  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, autoRun: false, battle: null, floaters: [] }));
  }, [state]);

  useEffect(() => {
    if (!autoRun) return undefined;
    const id = setInterval(() => setState((prev) => tickBattle(prev)), TICK_MS);
    return () => clearInterval(id);
  }, [autoRun]);

  const partyPower = useMemo(() => heroes.reduce((sum, hero) => sum + hero.atk + hero.def + hero.level * 2 + Math.floor(hero.speed / 12), 0) + tavernLevel * 4 + prestige * 7, [heroes, tavernLevel, prestige]);
  const hireCost = 120 + heroes.length * 55 + prestige * 30;
  const upgradeCost = 90 * tavernLevel + prestige * 50;

  function toggleAutoRun() {
    setState((prev) => ({ ...prev, autoRun: !prev.autoRun, battle: prev.battle || createBattle(prev), log: [!prev.autoRun ? 'Автоэкспедиция запущена. Бой идёт сам.' : 'Автоэкспедиция поставлена на паузу.', ...prev.log].slice(0, 12) }));
  }

  function upgradeHero(id: string) {
    const hero = heroes.find((candidate) => candidate.id === id);
    if (!hero) return;
    const cost = 45 + hero.level * 35 + prestige * 20;
    if (gold < cost) return;
    setState((prev) => ({ ...prev, gold: prev.gold - cost, heroes: prev.heroes.map((candidate) => candidate.id === id ? { ...candidate, level: candidate.level + 1, maxHp: candidate.maxHp + 6, atk: candidate.atk + 2, speed: candidate.speed + 2, def: candidate.def + (candidate.role === 'Фронтлайн' ? 1 : 0) } : candidate), log: [`${hero.name} натренирован. Новые параметры вступят в силу со следующего боя.`, ...prev.log].slice(0, 12) }));
  }

  function upgradeTavern() {
    if (gold < upgradeCost) return;
    setState((prev) => ({ ...prev, gold: prev.gold - upgradeCost, tavernLevel: prev.tavernLevel + 1, log: ['Таверна улучшена: снабжение отряда стало сильнее.', ...prev.log].slice(0, 12) }));
  }

  function hireHero() {
    if (gold < hireCost || heroes.length >= 5) return;
    const base = heroTemplates[heroes.length % heroTemplates.length];
    setState((prev) => ({ ...prev, gold: prev.gold - hireCost, heroes: [...prev.heroes, { ...base, id: `${base.id}-${Date.now()}`, name: `${base.name} ${prev.heroes.length + 1}`, level: 1, xp: 0, slot: prev.heroes.length + 1, x: base.x + prev.heroes.length * 3, y: base.y + (prev.heroes.length % 2) * 6 }], log: ['В таверну вступил новый наёмник. Он выйдет в следующий бой.', ...prev.log].slice(0, 12) }));
  }

  function prestigeRun() {
    if (floor < 50) return;
    setState((prev) => ({ ...createInitialState(), prestige: prev.prestige + 1, gold: 130 + prev.prestige * 45, log: [`Престиж ${prev.prestige + 1}: открыт новый регион. Постоянная сила выросла.`, ...createInitialState().log] }));
  }

  function resetPrototype() {
    localStorage.removeItem(SAVE_KEY);
    setState(createInitialState());
  }

  const visibleBattle = battle || createBattle(state);

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#5b3414_0,#1b120d_34%,#09090b_76%)] p-6 text-amber-50">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-500/10 px-3 py-1 text-sm text-amber-200"><span>⚙️</span>real-time auto battle · 2.5D top arena</div>
            <h1 className="text-4xl font-black tracking-tight md:text-6xl">Tavernborne</h1>
            <p className="mt-2 max-w-2xl text-base text-amber-100/70">Игрок строит таверну и систему прогресса. Отряд дерётся сам: кулдауны, автоатаки, лут, этажи и остановка только при поражении.</p>
          </div>
          <div className="flex flex-wrap gap-2"><StatPill icon="🪙" label="золото" value={gold} /><StatPill icon="💀" label="этаж" value={floor} /><StatPill icon="🍺" label="таверна" value={`ур. ${tavernLevel}`} /><StatPill icon="🔥" label="престиж" value={prestige} /></div>
        </header>

        <main className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <section className="grid gap-4">
            <Card className="relative overflow-hidden">
              <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div><h2 className="text-2xl font-bold">Автоэкспедиция</h2><p className="mt-1 text-amber-100/65">Сила системы: <b>{partyPower}</b>. Ручных ходов больше нет.</p></div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={toggleAutoRun} className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 font-bold shadow-lg transition hover:scale-[1.02] active:scale-95 ${autoRun ? 'bg-red-400 text-zinc-950 shadow-red-900/30' : 'bg-amber-400 text-zinc-950 shadow-amber-900/30'}`}>{autoRun ? '⏸ Пауза' : '▶ Запустить авто-бой'}</button>
                  <button onClick={prestigeRun} disabled={floor < 50} className="inline-flex items-center gap-2 rounded-xl border border-purple-300/30 bg-purple-500/15 px-4 py-3 font-semibold text-purple-100 transition hover:bg-purple-500/25 disabled:cursor-not-allowed disabled:opacity-40">🔥 Престиж</button>
                  <button onClick={resetPrototype} className="inline-flex items-center gap-2 rounded-xl border border-amber-200/15 bg-black/25 px-4 py-3 font-semibold text-amber-100 transition hover:bg-white/10">↻ Сброс</button>
                </div>
              </div>
            </Card>

            <div className="relative min-h-[500px] overflow-hidden rounded-3xl border border-amber-200/15 bg-zinc-950/80 shadow-2xl shadow-black/40">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_35%,rgba(245,158,11,.16),transparent_28%),radial-gradient(circle_at_25%_65%,rgba(14,165,233,.1),transparent_24%)]" />
              <div className="absolute left-5 top-5 z-10 rounded-full border border-amber-200/20 bg-black/35 px-4 py-2 text-sm text-amber-100">{autoRun ? '🟢 автоэкспедиция идёт' : '🟡 автоэкспедиция на паузе'}</div>
              <div className="absolute right-5 top-5 z-10 rounded-full border border-red-200/20 bg-black/35 px-4 py-2 text-sm text-red-100">{visibleBattle.enemy.icon} {visibleBattle.enemy.name} · этаж {floor}</div>
              <div className="absolute left-1/2 top-[54%] h-[330px] w-[86%] -translate-x-1/2 -translate-y-1/2 rotate-[-7deg] skew-x-[-10deg] rounded-[42px] border border-amber-200/15 bg-[linear-gradient(135deg,rgba(120,53,15,.62),rgba(39,39,42,.9)_45%,rgba(15,23,42,.95))] shadow-2xl shadow-black/60"><div className="absolute inset-6 rounded-[34px] border border-amber-100/10 bg-[linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px)] bg-[size:44px_44px]" /><div className="absolute bottom-10 left-10 rounded-full bg-emerald-400/10 px-4 py-2 text-xs text-emerald-100">линия отряда</div><div className="absolute right-10 top-10 rounded-full bg-red-400/10 px-4 py-2 text-xs text-red-100">зона врага</div></div>

              {visibleBattle.heroes.map((hero) => <div key={hero.battleId} className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${hero.attackFlash ? 'scale-110' : 'scale-100'} ${hero.hp <= 0 ? 'opacity-35 grayscale' : ''}`} style={{ left: `${hero.x}%`, top: `${hero.y}%` }}><div className="relative"><div className="absolute left-1/2 top-[58px] h-6 w-16 -translate-x-1/2 rounded-full bg-black/40 blur-md" /><div className={`relative flex h-16 w-16 items-center justify-center rounded-2xl border text-3xl shadow-xl ${hero.attackFlash ? 'border-amber-200 bg-amber-400/30' : 'border-sky-200/20 bg-sky-400/10'}`}>{hero.icon}</div><div className="mt-2 w-28 -translate-x-6 rounded-xl border border-sky-200/10 bg-black/60 p-2 text-xs"><div className="mb-1 flex justify-between gap-2"><b>{hero.name}</b><span>ур.{hero.level}</span></div><ProgressBar value={hero.hp} max={hero.maxBattleHp} className="bg-emerald-400" /><div className="mt-1"><ProgressBar value={hero.meter} max={100} className="bg-sky-400" /></div></div></div></div>)}
              <div className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${visibleBattle.enemy.attackFlash ? 'scale-110' : 'scale-100'}`} style={{ left: `${visibleBattle.enemy.x}%`, top: `${visibleBattle.enemy.y}%` }}><div className="relative"><div className="absolute left-1/2 top-[70px] h-7 w-20 -translate-x-1/2 rounded-full bg-black/50 blur-md" /><div className={`relative flex h-20 w-20 items-center justify-center rounded-3xl border text-4xl shadow-xl ${visibleBattle.enemy.attackFlash ? 'border-red-200 bg-red-400/30' : 'border-red-200/20 bg-red-500/10'}`}>{visibleBattle.enemy.icon}</div><div className="mt-2 w-40 -translate-x-10 rounded-xl border border-red-200/10 bg-black/65 p-2 text-xs"><div className="mb-1 flex justify-between gap-2"><b>{visibleBattle.enemy.name}</b><span>{visibleBattle.enemy.boss ? 'БОСС' : 'враг'}</span></div><ProgressBar value={visibleBattle.enemy.hp} max={visibleBattle.enemy.maxHp} className="bg-red-400" /><div className="mt-1"><ProgressBar value={visibleBattle.enemy.meter} max={100} className="bg-orange-400" /></div></div></div></div>
              {floaters.map((floater) => <div key={floater.id} className={`pointer-events-none absolute z-30 -translate-x-1/2 text-lg font-black drop-shadow ${floater.tone}`} style={{ left: `${floater.x}%`, top: `${floater.y}%` }}>{floater.text}</div>)}
            </div>

            <div className="grid gap-3 md:grid-cols-2"><button onClick={upgradeTavern} disabled={gold < upgradeCost} className="rounded-2xl border border-amber-200/15 bg-zinc-900/70 p-4 text-left transition hover:bg-zinc-800/80 disabled:cursor-not-allowed disabled:opacity-45"><div className="mb-2 flex items-center gap-2 font-bold">🔨 Улучшить таверну</div><p className="text-sm text-amber-100/60">Усиливает снабжение и снижает урон в автоэкспедициях.</p><p className="mt-3 text-sm font-bold text-amber-300">Цена: {upgradeCost} золота</p></button><button onClick={hireHero} disabled={gold < hireCost || heroes.length >= 5} className="rounded-2xl border border-amber-200/15 bg-zinc-900/70 p-4 text-left transition hover:bg-zinc-800/80 disabled:cursor-not-allowed disabled:opacity-45"><div className="mb-2 flex items-center gap-2 font-bold">👥 Нанять героя</div><p className="text-sm text-amber-100/60">Новые герои включаются в следующий бой. Максимум 5 в прототипе.</p><p className="mt-3 text-sm font-bold text-amber-300">Цена: {hireCost} золота</p></button></div>
          </section>

          <aside className="grid gap-4">
            <Card><h2 className="mb-3 text-2xl font-bold">Отряд</h2><div className="space-y-3">{heroes.map((hero) => { const cost = 45 + hero.level * 35 + prestige * 20; const xpToLevel = 40 + hero.level * 15; return <div key={hero.id} className="rounded-2xl border border-amber-200/10 bg-black/25 p-3"><div className="mb-2 flex items-start justify-between gap-2"><div><div className="font-bold">{hero.icon} {hero.name}</div><div className="text-xs text-amber-100/55">{hero.role} · ур. {hero.level} · SPD {hero.speed}</div></div><button onClick={() => upgradeHero(hero.id)} disabled={gold < cost} className="rounded-lg bg-amber-500/15 px-2 py-1 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-40">+{cost}</button></div><div className="grid grid-cols-3 gap-2 text-xs"><div className="rounded-lg bg-black/25 p-2">HP <b>{hero.maxHp}</b></div><div className="rounded-lg bg-black/25 p-2">ATK <b>{hero.atk}</b></div><div className="rounded-lg bg-black/25 p-2">DEF <b>{hero.def}</b></div></div><div className="mt-2"><ProgressBar value={hero.xp % xpToLevel} max={xpToLevel} className="bg-sky-400" /></div><p className="mt-2 text-xs text-amber-100/50">{hero.trait}</p></div>; })}</div></Card>
            <Card><h2 className="mb-3 flex items-center gap-2 text-2xl font-bold">🎒 Добыча</h2>{loot.length === 0 ? <p className="rounded-xl bg-black/20 p-3 text-sm text-amber-100/55">Пока пусто. Запусти авто-бой.</p> : <div className="space-y-2">{loot.map((item) => <div key={item.id} className="rounded-xl bg-black/25 px-3 py-2 text-sm"><div className="flex items-center justify-between"><span className="font-semibold">{item.name}</span><span className="text-amber-200/55">этаж {item.floor}</span></div><div className="mt-1 text-xs text-amber-100/50">{item.type} · {item.rarity} · ATK +{item.atk} · DEF +{item.def}</div></div>)}</div>}</Card>
            <Card><h2 className="mb-3 text-2xl font-bold">Журнал</h2><div className="space-y-2">{log.map((line, index) => <div key={`${line}-${index}`} className="rounded-xl border border-amber-200/10 bg-black/20 px-3 py-2 text-sm text-amber-50/75">{line}</div>)}</div></Card>
          </aside>
        </main>
      </div>
    </div>
  );
}
