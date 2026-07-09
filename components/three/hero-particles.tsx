"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";

/** Deterministic pseudo-random in [0, 1) — keeps render pure. */
const prand = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function DriftingParticles({
  count,
  color,
  size,
  speed,
}: {
  count: number;
  color: string;
  size: number;
  speed: number;
}) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const array = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      array[i * 3] = (prand(i, 1) - 0.5) * 22;
      array[i * 3 + 1] = (prand(i, 2) - 0.5) * 12;
      array[i * 3 + 2] = (prand(i, 3) - 0.5) * 6;
    }
    return array;
  }, [count]);

  useFrame(({ clock }) => {
    if (!points.current) return;
    const t = clock.getElapsedTime();
    points.current.rotation.y = t * 0.02 * speed;
    points.current.position.y = Math.sin(t * 0.25 * speed) * 0.4;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={size}
        sizeAttenuation
        transparent
        opacity={0.55}
        depthWrite={false}
      />
    </points>
  );
}

function GlowOrb({ position, scale, color }: { position: [number, number, number]; scale: number; color: string }) {
  return (
    <Float speed={1.2} rotationIntensity={0.6} floatIntensity={1.4}>
      <mesh position={position} scale={scale}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          color={color}
          roughness={0.3}
          metalness={0.1}
          emissive={color}
          emissiveIntensity={0.35}
          transparent
          opacity={0.85}
        />
      </mesh>
    </Float>
  );
}

/**
 * Transparent, pointer-transparent 3D layer floated over the hero video —
 * drifting green particles and a few soft floating orbs in brand greens.
 */
export default function HeroParticles({ quality = "high" }: { quality?: "low" | "high" }) {
  const count = quality === "high" ? 260 : 90;
  return (
    <Canvas
      dpr={[1, quality === "high" ? 1.75 : 1.25]}
      camera={{ position: [0, 0, 9], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      aria-hidden
      className="!pointer-events-none"
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[4, 6, 5]} intensity={1.2} />
      <DriftingParticles count={count} color="#48a3d6" size={0.055} speed={1} />
      <DriftingParticles count={Math.round(count * 0.6)} color="#8dc63f" size={0.085} speed={1.6} />
      <GlowOrb position={[-7.5, 2.4, -2]} scale={0.5} color="#8dc63f" />
      <GlowOrb position={[7.8, -2.2, -1.5]} scale={0.7} color="#1b75bb" />
      <GlowOrb position={[6.4, 3, -3]} scale={0.35} color="#82c2e6" />
    </Canvas>
  );
}
