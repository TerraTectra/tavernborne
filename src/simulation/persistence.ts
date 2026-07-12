import type { Hero, WorldState } from './model';
import { createInitialWorld } from './seed';

export const SAVE_KEY = 'tavernborne.world.v2';

const storageAvailable = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const hydrateHero = (saved: Partial<Hero> | undefined, fallback: Hero): Hero => ({
  ...fallback,
  ...saved,
  traits: { ...fallback.traits, ...(saved?.traits ?? {}) },
  emotions: { ...fallback.emotions, ...(saved?.emotions ?? {}) },
  needs: { ...fallback.needs, ...(saved?.needs ?? {}) },
  psyche: { ...fallback.psyche, ...(saved?.psyche ?? {}) },
  stats: { ...fallback.stats, ...(saved?.stats ?? {}) },
  condition: { ...fallback.condition, ...(saved?.condition ?? {}) },
  inventory: Array.isArray(saved?.inventory) ? saved.inventory : fallback.inventory,
  goals: Array.isArray(saved?.goals) ? saved.goals : fallback.goals,
  memories: Array.isArray(saved?.memories) ? saved.memories : [],
  relationships: saved?.relationships ?? fallback.relationships,
  dailyPlan: Array.isArray(saved?.dailyPlan) ? saved.dailyPlan : [],
  planDay: Number.isFinite(saved?.planDay) ? Number(saved?.planDay) : -1,
  lastReplanTick: Number.isFinite(saved?.lastReplanTick) ? Number(saved?.lastReplanTick) : -99,
  lastSocialTick: Number.isFinite(saved?.lastSocialTick) ? Number(saved?.lastSocialTick) : -99,
  currentActivity: saved?.currentActivity,
  currentAction: saved?.currentAction,
});

export const hydrateWorld = (input: unknown): WorldState | undefined => {
  if (!input || typeof input !== 'object') return undefined;
  const saved = input as Partial<WorldState>;
  if (!Number.isFinite(saved.tick)) return undefined;
  const seed = typeof saved.seed === 'string' && saved.seed.trim() ? saved.seed : 'aster-family-001';
  const fallback = createInitialWorld(seed);
  const savedHeroes = saved.heroes && typeof saved.heroes === 'object' ? saved.heroes : {};
  const heroes = Object.fromEntries(
    Object.entries(fallback.heroes).map(([id, hero]) => [
      id,
      hydrateHero((savedHeroes as Record<string, Partial<Hero>>)[id], hero),
    ]),
  );

  return {
    ...fallback,
    ...saved,
    version: 2,
    seed,
    tick: Number(saved.tick),
    heroes,
    journal: Array.isArray(saved.journal) ? saved.journal : fallback.journal,
    socialScenes: Array.isArray(saved.socialScenes) ? saved.socialScenes : [],
    expeditions: Array.isArray(saved.expeditions) ? saved.expeditions : [],
    routine: { ...fallback.routine, ...(saved.routine ?? {}) },
    nextSocialSceneId: Number.isFinite(saved.nextSocialSceneId) ? Number(saved.nextSocialSceneId) : 1,
    nextExpeditionId: Number.isFinite(saved.nextExpeditionId) ? Number(saved.nextExpeditionId) : 1,
  };
};

export const saveWorld = (world: WorldState): boolean => {
  if (!storageAvailable()) return false;
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(world));
    return true;
  } catch {
    return false;
  }
};

export const loadWorld = (): WorldState | undefined => {
  if (!storageAvailable()) return undefined;
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return undefined;
    return hydrateWorld(JSON.parse(raw));
  } catch {
    return undefined;
  }
};

export const clearSavedWorld = (): void => {
  if (!storageAvailable()) return;
  window.localStorage.removeItem(SAVE_KEY);
};

export const diagnosticPayload = (world: WorldState) => ({
  exportedAt: new Date().toISOString(),
  version: world.version,
  seed: world.seed,
  tick: world.tick,
  world,
  summary: {
    heroes: Object.values(world.heroes).map((hero) => ({
      id: hero.id,
      name: hero.name,
      currentActivity: hero.currentActivity,
      condition: hero.condition,
      dominantNeeds: Object.entries(hero.needs).sort((left, right) => right[1] - left[1]).slice(0, 3),
      memories: hero.memories.slice(0, 12),
    })),
    recentSocialScenes: world.socialScenes.slice(0, 20),
    recentJournal: world.journal.slice(0, 80),
  },
});

export const downloadDiagnostics = (world: WorldState): boolean => {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return false;
  try {
    const blob = new Blob([JSON.stringify(diagnosticPayload(world), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `tavernborne-${world.seed}-tick-${world.tick}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
};
