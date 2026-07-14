import { readFileSync, writeFileSync } from 'node:fs';

const replaceExact = (path, from, to) => {
  const source = readFileSync(path, 'utf8');
  if (source.includes(to)) return false;
  if (!source.includes(from)) throw new Error(`Expected source fragment not found in ${path}: ${from}`);
  writeFileSync(path, source.replace(from, to), 'utf8');
  return true;
};

const changed = [];

if (replaceExact(
  'src/rts/RTSGameV2.tsx',
  "import { useRealtimeActors } from './realtime';",
  "import { useRealtimeActors } from './realtime';\nimport { realtimeIntervalMs, realtimeRateLabel } from './time-scale';",
)) changed.push('RTS time-scale import');

if (replaceExact(
  'src/rts/RTSGameV2.tsx',
  '    }, 5200 / speedMultiplier);',
  '    }, realtimeIntervalMs(speedMultiplier));',
)) changed.push('RTS five-minute interval');

if (replaceExact(
  'src/rts/RTSGameV2.tsx',
  '              <span className="rounded bg-violet-300/10 px-2 py-1 font-mono text-[10px] text-violet-200" data-testid="world-seed">seed: {world.seed}</span>',
  '              <span className="rounded bg-violet-300/10 px-2 py-1 font-mono text-[10px] text-violet-200" data-testid="world-seed">seed: {world.seed}</span>\n              <span className="rounded bg-sky-300/10 px-2 py-1 font-mono text-[10px] text-sky-200" data-testid="time-scale" data-realtime-ms={realtimeIntervalMs(speedMultiplier)}>{realtimeRateLabel(speedMultiplier)}</span>',
)) changed.push('visible realtime scale');

if (replaceExact(
  'src/rts/RTSGameV2.tsx',
  '<button type="button" onClick={() => setSpeedMultiplier((value) => value === 1 ? 2 : value === 2 ? 4 : 1)} className="rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 py-2 font-mono text-xs text-amber-100">x{speedMultiplier}</button>',
  '<button type="button" title={realtimeRateLabel(speedMultiplier)} onClick={() => setSpeedMultiplier((value) => value === 1 ? 2 : value === 2 ? 4 : 1)} className="rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 py-2 font-mono text-xs text-amber-100">x{speedMultiplier}</button>',
)) changed.push('speed control label');

if (replaceExact(
  'src/rts/realtime.ts',
  "  talk: 'Надо поговорить',",
  "  talk: 'Как ты?',",
)) changed.push('casual fallback bubble');

if (replaceExact(
  'src/simulation/schedule.ts',
  "block(hero, day, 12, 13, hero.traits.kindness > 65 ? 'help' : 'talk', hero.traits.kindness > 65 ? 'Помочь по дому' : 'Поговорить у очага', 'group', { targetId, groupId: `midday-${day}` }),",
  "block(hero, day, 12, 13, hero.traits.kindness > 65 ? 'help' : 'talk', hero.traits.kindness > 65 ? 'Помочь по дому' : 'Посидеть у очага', 'group', { targetId, groupId: `midday-${day}` }),",
)) changed.push('casual plan label');

console.log(changed.length ? `Applied: ${changed.join(', ')}` : 'All source patches were already applied.');
