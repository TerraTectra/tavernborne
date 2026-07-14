import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LeadershipOverlay } from './LeadershipOverlay';
import { LifeSceneOverlay } from './LifeSceneOverlay';
import { PhysicalBodyOverlay } from './PhysicalBodyOverlay';
import { VisualSceneOverlay } from './VisualSceneOverlay';
import './camp-overlay-dock.css';

export function CampOverlayDock() {
  const [mount, setMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let observer: MutationObserver | null = null;
    const locate = () => {
      const next = document.querySelector<HTMLElement>('[data-testid="rts-map"]');
      if (!next) return false;
      setMount(next);
      observer?.disconnect();
      return true;
    };

    if (!locate()) {
      observer = new MutationObserver(locate);
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => observer?.disconnect();
  }, []);

  if (!mount) return null;

  return createPortal(
    <div className="camp-overlay-dock" data-testid="camp-overlay-dock">
      <div className="camp-overlay-dock__left" data-testid="camp-overlay-left-column">
        <div className="camp-overlay-dock__left-top">
          <LifeSceneOverlay />
          <VisualSceneOverlay />
        </div>
        <div className="camp-overlay-dock__left-bottom">
          <PhysicalBodyOverlay />
        </div>
      </div>
      <div className="camp-overlay-dock__right" data-testid="camp-overlay-right-column">
        <LeadershipOverlay />
      </div>
    </div>,
    mount,
  );
}
