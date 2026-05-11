import { ContactShadows, Sparkles } from '@react-three/drei';

export function VillageLighting() {
  return (
    <>
      <ambientLight intensity={0.7} color="#b7c7ff" />
      <directionalLight
        castShadow
        color="#fff1d0"
        intensity={2.4}
        position={[4.8, 7.5, 4.5]}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
      />
      <pointLight color="#ffbf57" intensity={18} distance={7} position={[0, 1.35, 1.1]} />
      <pointLight color="#ff7a24" intensity={9} distance={4.4} position={[1.85, 1.0, 2.1]} />
      <pointLight color="#a267ff" intensity={11} distance={5.2} position={[2.75, 1.3, -1.45]} />
      <pointLight color="#8bd8ff" intensity={6} distance={3.6} position={[-1.75, 1.1, 2.1]} />
      <Sparkles count={34} scale={[6.2, 1.5, 4.2]} size={1.4} speed={0.25} color="#ffd37a" position={[0, 1.2, 0.3]} />
      <ContactShadows position={[0, -0.03, 0]} opacity={0.48} scale={9} blur={2.8} far={4.2} />
    </>
  );
}
