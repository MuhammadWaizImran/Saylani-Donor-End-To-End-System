"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";

const BRAND_DEEP = "#155d99";
const BRAND_MID = "#48a3d6";
const BRAND_GREEN = "#8dc63f";

/** Classic heart outline built from bezier curves, extruded into a 3D solid. */
function useHeartGeometry() {
  return useMemo(() => {
    const shape = new THREE.Shape();
    const x = 0;
    const y = 0;
    shape.moveTo(x + 0.5, y + 0.5);
    shape.bezierCurveTo(x + 0.5, y + 0.5, x + 0.4, y, x, y);
    shape.bezierCurveTo(x - 0.6, y, x - 0.6, y + 0.7, x - 0.6, y + 0.7);
    shape.bezierCurveTo(x - 0.6, y + 1.1, x - 0.3, y + 1.54, x + 0.5, y + 1.9);
    shape.bezierCurveTo(x + 1.2, y + 1.54, x + 1.6, y + 1.1, x + 1.6, y + 0.7);
    shape.bezierCurveTo(x + 1.6, y + 0.7, x + 1.6, y, x + 1, y);
    shape.bezierCurveTo(x + 0.7, y, x + 0.5, y + 0.5, x + 0.5, y + 0.5);

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.45,
      bevelEnabled: true,
      bevelThickness: 0.12,
      bevelSize: 0.12,
      bevelSegments: 3,
      curveSegments: 12,
    });
    geometry.center();
    // The bezier heart is drawn upside down; flip it upright.
    geometry.rotateZ(Math.PI);
    geometry.computeVertexNormals();
    return geometry;
  }, []);
}

function Heart() {
  const geometry = useHeartGeometry();
  const mesh = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    // Gentle heartbeat pulse.
    const t = clock.getElapsedTime();
    const beat = 1 + 0.045 * Math.pow(Math.max(0, Math.sin(t * 2.2)), 6);
    mesh.current.scale.setScalar(beat);
  });

  return (
    <Float speed={1.4} rotationIntensity={0.4} floatIntensity={0.7}>
      <mesh ref={mesh} geometry={geometry} castShadow>
        <meshStandardMaterial
          color={BRAND_GREEN}
          roughness={0.25}
          metalness={0.15}
          emissive={BRAND_GREEN}
          emissiveIntensity={0.18}
        />
      </mesh>
    </Float>
  );
}

function Globe() {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.12;
  });
  return (
    <group ref={group}>
      <mesh>
        <icosahedronGeometry args={[2.35, 2]} />
        <meshBasicMaterial color={BRAND_DEEP} wireframe transparent opacity={0.3} />
      </mesh>
      <mesh rotation={[Math.PI / 2.6, 0, 0.4]}>
        <torusGeometry args={[3.1, 0.012, 8, 96]} />
        <meshBasicMaterial color={BRAND_MID} transparent opacity={0.55} />
      </mesh>
      <mesh rotation={[Math.PI / 1.8, 0.5, -0.3]}>
        <torusGeometry args={[3.45, 0.008, 8, 96]} />
        <meshBasicMaterial color={BRAND_GREEN} transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

/** Deterministic pseudo-random in [0, 1); keeps render pure. */
const prand = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function Particles({ count, color, radius }: { count: number; color: string; radius: number }) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const array = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Scattered points in a spherical shell so the center stays clear.
      const r = radius * (0.72 + 0.28 * prand(i, 1));
      const theta = prand(i, 2) * Math.PI * 2;
      const phi = Math.acos(2 * prand(i, 3) - 1);
      array[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      array[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      array[i * 3 + 2] = r * Math.cos(phi);
    }
    return array;
  }, [count, radius]);

  useFrame((_, delta) => {
    if (points.current) points.current.rotation.y -= delta * 0.02;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={0.035}
        sizeAttenuation
        transparent
        opacity={0.8}
        depthWrite={false}
      />
    </points>
  );
}

function PointerParallax({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ pointer }) => {
    if (!group.current) return;
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, pointer.y * 0.12, 0.05);
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, pointer.x * 0.2, 0.05);
  });
  return <group ref={group}>{children}</group>;
}

export default function HeroScene({ quality = "high" }: { quality?: "low" | "high" }) {
  const particleCount = quality === "high" ? 700 : 250;
  return (
    <Canvas
      dpr={[1, quality === "high" ? 1.75 : 1.25]}
      camera={{ position: [0, 0, 7], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      aria-hidden
      className="!pointer-events-none lg:!pointer-events-auto"
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 5, 6]} intensity={1.4} color="#ffffff" />
      <pointLight position={[-5, -2, -4]} intensity={14} color={BRAND_MID} />
      <pointLight position={[3, -3, 2]} intensity={8} color={BRAND_GREEN} />
      <PointerParallax>
        <Heart />
        <Globe />
        <Particles count={particleCount} color={BRAND_MID} radius={4.4} />
        <Particles count={Math.round(particleCount * 0.5)} color={BRAND_GREEN} radius={3.8} />
      </PointerParallax>
    </Canvas>
  );
}
