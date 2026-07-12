import { useEffect, useMemo, useState } from 'react';
import { dungeonExplorationOf, loadWorld, type Expedition, type WorldState } from '../simulation';
import { DungeonExplorationMap } from './DungeonExplorationMap';
import './dungeon-exploration.css';

const activeDungeon = (world: WorldState | undefined): Expedition | undefined => {
  if (!world) return undefined;
  return [...world.expeditions]
    .filter((expedition) => expedition.status === 'active' && Boolean(dungeonExplorationOf(expedition)))
    .sort((left, right) => right.departTick - left.departTick)[0];
};

export function DungeonExplorationOverlay() {
  const [world, setWorld] = useState<WorldState | undefined>(() => loadWorld());

  useEffect(() => {
    const refresh = () => setWorld(loadWorld());
    refresh();
    const interval = window.setInterval(refresh, 150);
    return () => window.clearInterval(interval);
  }, []);

  const expedition = useMemo(() => activeDungeon(world), [world]);
  if (!world || !expedition) return null;

  return (
    <div
      className="fixed left-3 right-3 top-[92px] z-[82] h-[720px] max-h-[calc(100vh-112px)] xl:left-5 xl:right-[446px]"
      data-testid="dungeon-visual-overlay"
    >
      <DungeonExplorationMap world={world} expedition={expedition} />
    </div>
  );
}
