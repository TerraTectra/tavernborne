import { useGLTF } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import React, { Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box3, Group, Mesh, Object3D, Vector3 } from 'three';

type QuaterniusModelProps = {
  url: string | null;
  targetSize: number;
  fallback: React.ReactNode;
};

type ModelErrorBoundaryProps = {
  fallback: React.ReactNode;
  children: React.ReactNode;
};

type ModelErrorBoundaryState = {
  failed: boolean;
};

class ModelErrorBoundary extends React.Component<ModelErrorBoundaryProps, ModelErrorBoundaryState> {
  state: ModelErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ModelErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('[quaternius] Model failed, using fallback:', error);
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
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

function NormalizedGltfModel({ url, targetSize }: { url: string; targetSize: number }) {
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
    if (maxDimension <= 0) return;

    model.position.set(-center.x, -box.min.y, -center.z);
    setScale(targetSize / maxDimension);
  }, [clonedScene, targetSize]);

  return (
    <group ref={wrapperRef} scale={scale}>
      <group ref={modelRef}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}

export function QuaterniusModel({ url, targetSize, fallback }: QuaterniusModelProps) {
  if (!url) return <>{fallback}</>;

  return (
    <ModelErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <NormalizedGltfModel url={url} targetSize={targetSize} />
      </Suspense>
    </ModelErrorBoundary>
  );
}
