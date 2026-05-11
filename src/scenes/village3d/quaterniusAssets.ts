import { useEffect, useState } from 'react';
import type { VillageBuildingId } from './VillageLayout';

export type QuaterniusAssetId = VillageBuildingId | 'barrel' | 'crate' | 'lamp' | 'tree' | 'rock' | 'bush';

export type QuaterniusModelEntry = {
  file: string;
  targetSize: number;
  sourcePack: string;
  sourceFile: string;
  score: number;
};

export type QuaterniusManifest = {
  generatedAt: string;
  license: string;
  sources: Array<{
    id: string;
    name: string;
    source: string;
    license: string;
    status: string;
    files?: number;
    error?: string;
  }>;
  models: Partial<Record<QuaterniusAssetId, QuaterniusModelEntry>>;
  missing: Array<{ id: string; reason: string }>;
};

export type QuaterniusAssetsState = {
  loading: boolean;
  manifest: QuaterniusManifest | null;
  error: string | null;
};

const emptyState: QuaterniusAssetsState = {
  loading: true,
  manifest: null,
  error: null,
};

export function resolvePublicAssetPath(file: string | undefined): string | null {
  if (!file) return null;
  return `${import.meta.env.BASE_URL}${file.replace(/^\//, '')}`;
}

export function useQuaterniusAssets(): QuaterniusAssetsState {
  const [state, setState] = useState<QuaterniusAssetsState>(emptyState);

  useEffect(() => {
    let cancelled = false;
    const manifestUrl = `${import.meta.env.BASE_URL}assets/quaternius/manifest.json`;

    fetch(manifestUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Quaternius manifest not found: ${response.status}`);
        }
        return response.json() as Promise<QuaterniusManifest>;
      })
      .then((manifest) => {
        if (!cancelled) setState({ loading: false, manifest, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ loading: false, manifest: null, error: String(error) });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
