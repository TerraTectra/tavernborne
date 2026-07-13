import { useGLTF } from '@react-three/drei';
import { Component, Suspense, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from 'react';
import { Box3, Mesh, Object3D, Vector3 } from 'three';

export type EnvironmentAsset3DProps = {
  assetId: string | string[];
  position?: [number, number, number];
  rotation?: [number, number, number];
  size?: number;
  scale?: number | [number, number, number];
  verticalOffset?: number;
  fallback: ReactNode;
  testId?: string;
  castShadow?: boolean;
};

type EnvironmentAssetEntry = {
  file: string;
  targetSize?: number;
  sourcePack?: string;
  sourceFile?: string;
};

type EnvironmentManifest = {
  models?: Record<string, EnvironmentAssetEntry>;
};

type ResolvedEnvironmentAsset = EnvironmentAssetEntry & {
  id: string;
  url: string;
};

type EnvironmentProbeState = {
  mode: 'curated-asset' | 'procedural-fallback';
  asset: string;
  source: string;
};

declare global {
  interface Window {
    __tavernborneEnvironment?: Record<string, EnvironmentProbeState>;
  }
}

const manifestRequests = new Map<string, Promise<EnvironmentManifest>>();

function requestManifest(base: string) {
  const cached = manifestRequests.get(base);
  if (cached) return cached;

  const request = fetch(`${base}assets/quaternius/manifest.json`, { cache: 'force-cache' })
    .then((response) => {
      if (!response.ok) throw new Error(`environment manifest ${response.status}`);
      return response.json() as Promise<EnvironmentManifest>;
    });
  manifestRequests.set(base, request);
  return request;
}

function findAsset(manifest: EnvironmentManifest, candidates: string[], base: string): ResolvedEnvironmentAsset | null {
  for (const id of candidates) {
    const entry = manifest.models?.[id];
    if (entry?.file) return { ...entry, id, url: `${base}${entry.file}` };
  }
  return null;
}

function cloneEnvironmentScene(source: Object3D, castShadow: boolean) {
  const clone = source.clone(true);
  clone.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.castShadow = castShadow;
    object.receiveShadow = true;
    object.frustumCulled = true;
  });
  clone.updateMatrixWorld(true);
  return clone;
}

function EnvironmentProbe({ testId, state }: { testId?: string; state: EnvironmentProbeState }) {
  useEffect(() => {
    if (!testId || typeof window === 'undefined') return undefined;
    const registry = window.__tavernborneEnvironment ?? {};
    registry[testId] = state;
    window.__tavernborneEnvironment = registry;
    return () => {
      if (window.__tavernborneEnvironment?.[testId] === state) delete window.__tavernborneEnvironment[testId];
    };
  }, [state, testId]);
  return null;
}

class EnvironmentAssetBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[tavernborne] Environment asset failed; procedural fallback retained.', error, info.componentStack);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function LoadedEnvironmentAsset({
  asset,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  size,
  scale = 1,
  verticalOffset = 0,
  testId,
  castShadow = false,
}: Omit<EnvironmentAsset3DProps, 'assetId' | 'fallback'> & { asset: ResolvedEnvironmentAsset }) {
  const gltf = useGLTF(asset.url);
  const prepared = useMemo(() => {
    const model = cloneEnvironmentScene(gltf.scene, castShadow);
    const bounds = new Box3().setFromObject(model);
    const dimensions = bounds.getSize(new Vector3());
    const longestSide = Math.max(dimensions.x, dimensions.y, dimensions.z, 0.001);
    const target = size ?? asset.targetSize ?? longestSide;
    return {
      model,
      fitScale: target / longestSide,
      floorOffset: -bounds.min.y,
    };
  }, [asset.targetSize, castShadow, gltf.scene, size]);

  const requestedScale = Array.isArray(scale) ? scale : [scale, scale, scale];
  const fittedScale: [number, number, number] = [
    prepared.fitScale * requestedScale[0],
    prepared.fitScale * requestedScale[1],
    prepared.fitScale * requestedScale[2],
  ];
  const probeState = useMemo<EnvironmentProbeState>(() => ({
    mode: 'curated-asset',
    asset: asset.id,
    source: asset.sourcePack ?? 'unknown',
  }), [asset.id, asset.sourcePack]);

  return (
    <group position={position} rotation={rotation}>
      <group scale={fittedScale} position={[0, prepared.floorOffset * fittedScale[1] + verticalOffset, 0]}>
        <primitive object={prepared.model} />
      </group>
      <EnvironmentProbe testId={testId} state={probeState} />
    </group>
  );
}

export function EnvironmentAsset3D(props: EnvironmentAsset3DProps) {
  const [asset, setAsset] = useState<ResolvedEnvironmentAsset | null>();
  const candidateKey = Array.isArray(props.assetId) ? props.assetId.join('|') : props.assetId;

  useEffect(() => {
    let cancelled = false;
    const base = import.meta.env.BASE_URL;
    const candidates = candidateKey.split('|');
    requestManifest(base)
      .then((manifest) => {
        if (!cancelled) setAsset(findAsset(manifest, candidates, base));
      })
      .catch((error) => {
        console.warn('[tavernborne] Environment manifest unavailable; procedural fallback retained.', error);
        if (!cancelled) setAsset(null);
      });
    return () => { cancelled = true; };
  }, [candidateKey]);

  const fallbackState = useMemo<EnvironmentProbeState>(() => ({
    mode: 'procedural-fallback',
    asset: 'none',
    source: 'procedural',
  }), []);
  const fallback = (
    <group position={props.position ?? [0, 0, 0]} rotation={props.rotation ?? [0, 0, 0]}>
      {props.fallback}
      <EnvironmentProbe testId={props.testId} state={fallbackState} />
    </group>
  );

  if (!asset) return fallback;

  return (
    <EnvironmentAssetBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <LoadedEnvironmentAsset {...props} asset={asset} />
      </Suspense>
    </EnvironmentAssetBoundary>
  );
}
