import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';

export default function BackgroundScene() {
  return (
    <Canvas camera={{ position: [0, 0, 5] }}>
      <ambientLight intensity={0.2} />
      <directionalLight position={[10, 10, 5]} intensity={1} color="#ffffff" />
      <directionalLight position={[-10, -10, -5]} intensity={2} color="#4f46e5" />
      <directionalLight position={[0, -10, 0]} intensity={1.5} color="#ec4899" />
      
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={0} />
      <OrbitControls enableZoom={false} enablePan={false} enableRotate={false} />
    </Canvas>
  );
}
