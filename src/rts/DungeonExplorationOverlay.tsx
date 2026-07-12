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
    <div className="dungeon-overlay-frame" data-testid="dungeon-visual-overlay">
      <DungeonExplorationMap world={world} expedition={expedition} />
    </div>
  );
}
