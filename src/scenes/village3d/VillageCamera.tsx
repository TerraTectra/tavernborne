import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

export function VillageCamera() {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(5.7, 5.1, 7.2);
    camera.lookAt(0, 0.45, 0.25);
  }, [camera]);

  return null;
}
