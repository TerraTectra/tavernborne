import { useGLTF } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import React, { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box3, Group, Mesh, Object3D, Vector3 } from 'three';
import type { AssetRenderReport, AssetRenderStatus, QuaterniusAssetId } from './quaterniusAssets';

type ReportModelStatus = (report: AssetRenderReport) => void;

type QuaterniusModelProps = {
  id: QuaterniusAssetId;
  url: string | null;
  targetSize: number;
  sourcePack?: string;
  sourceFile?: string;
  fallback: React.ReactNode;
  onReport: ReportModelStatus;
};

type NormalizedGltfModelProps = {
  id: QuaterniusAssetId;
  url: string;
  targetSize: number;
  sourcePack?: string;
  sourceFile?: string;
  onReport: ReportModelStatus;
};

type ModelErrorBoundaryProps = {
  id: QuaterniusAssetId;
  url: string | null;
  sourcePack?: string;
  sourceFile?: string;
  fallback: React.ReactNode;
  onReport: ReportModelStatus;
  children: React.ReactNode;
};

type ModelErrorBoundaryState = {
  failed: boolean;
};

function reportStatus(
  onReport: ReportModelStatus,
  id: QuaterniusAssetId,
  status: AssetRenderStatus,
  url: string | null,
  sourcePack?: string,
  sourceFile?: string,
  error?: string,
) {
  onReport({ id, status, url, sourcePack, sourceFile, error });
}

class ModelErrorBoundary extends React.Component<ModelErrorBoundaryProps, ModelErrorBoundaryState> {
  state: ModelErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ModelErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[quaternius] Model failed, using fallback:', this.props.id, message);
    reportStatus(this.props.onReport, this.props.id, 'failed', this.props.url, this.props.sourcePack, this.props.sourceFile, message);
  }

  componentDidUpdate(previousProps: ModelErrorBoundaryProps) {
    if (previousProps.url !== this.props.url && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

function ModelFallbackReporter({
  id,
  status,
  url,
  sourcePack,
  sourceFile,
  error,
  onReport,
  fallback,
}: {
  id: QuaterniusAssetId;
  status: AssetRenderStatus;
  url: string | null;
  sourcePack?: string;
  sourceFile?: string;
  error?: string;
  onReport: ReportModelStatus;
  fallback: React.ReactNode;
}) {
  useEffect(() => {
    reportStatus(onReport, id, status, url, sourcePack, sourceFile, error);
  }, [error, id, onReport, sourceFile, sourcePack, status, url]);

  return <>{fallback}</>;
}

function prepareModel(root: Object3D) {
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (mesh.material && !Array.isArray(mesh.material)) {
        mesh.material.needsUpdate = true;
      }
    }
  });
}

function NormalizedGltfModel({ id, url, targetSize, sourcePack, sourceFile, onReport }: NormalizedGltfModelProps) {
  const gltf = useGLTF(url);
  const wrapperRef = useRef<Group>(null);
  const modelRef = useRef<Group>(null);
  const [scale, setScale] = useState(1);

  const clonedScene = useMemo(() => {
    const cloned = SkeletonUtils.clone(gltf.scene) as Object3D;
    prepareModel(cloned);
    return cloned;
  }, [gltf.scene]);

  useLayoutEffect(() => {
    const model = modelRef.current;
    if (!model) return;

    model.position.set(0, 0, 0);
    const box = new Box3().setFromObject(model);
    const size = new Vector3();
    const center = new Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDimension = Math.max(size.x, size.y, size.z);
    if (maxDimension <= 0) {
      reportStatus(onReport, id, 'failed', url, sourcePack, sourceFile, 'Loaded model has zero visible bounds');
      return;
    }

    model.position.set(-center.x, -box.min.y, -center.z);
    setScale(targetSize / maxDimension);
    reportStatus(onReport, id, 'rendered', url, sourcePack, sourceFile);
  }, [clonedScene, id, onReport, sourceFile, sourcePack, targetSize, url]);

  return (
    <group ref={wrapperRef} scale={scale}>
      <group ref={modelRef}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}

export function QuaterniusModel({ id, url, targetSize, sourcePack, sourceFile, fallback, onReport }: QuaterniusModelProps) {
  if (!url) {
    return (
      <ModelFallbackReporter
        id={id}
        status="fallback"
        url={null}
        sourcePack={sourcePack}
        sourceFile={sourceFile}
        error="No approved model URL in manifest"
        onReport={onReport}
        fallback={fallback}
      />
    );
  }

  return (
    <ModelErrorBoundary id={id} url={url} sourcePack={sourcePack} sourceFile={sourceFile} fallback={fallback} onReport={onReport}>
      <Suspense
        fallback={
          <ModelFallbackReporter
            id={id}
            status="loading"
            url={url}
            sourcePack={sourcePack}
            sourceFile={sourceFile}
            onReport={onReport}
            fallback={fallback}
          />
        }
      >
        <NormalizedGltfModel id={id} url={url} targetSize={targetSize} sourcePack={sourcePack} sourceFile={sourceFile} onReport={onReport} />
      </Suspense>
    </ModelErrorBoundary>
  );
}
