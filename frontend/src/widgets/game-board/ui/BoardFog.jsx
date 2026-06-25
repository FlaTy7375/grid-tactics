import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BOARD_WORLD_SIZE, WATER_LIFT } from '@shared/config/boardConstants';
import { createCloudPuffTexture } from '@shared/lib/boardTextures';

const BOARD_HALF = BOARD_WORLD_SIZE / 2;
const CENTER_PULL = 1;

function pullToCenter(x, z) {
  return [x * CENTER_PULL, z * CENTER_PULL];
}

function puffHash(seed) {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function buildCloudPuffs() {
  const puffs = [];
  let seed = 1;

  const gridStep = 1.95;
  for (let row = -2; row <= 2; row += 1) {
    for (let col = -2; col <= 2; col += 1) {
      const rawX = col * gridStep + (puffHash(seed) - 0.5) * 0.95;
      const rawZ = row * gridStep + (puffHash(seed + 1) - 0.5) * 0.95;
      const [x, z] = pullToCenter(rawX, rawZ);
      seed += 2;

      if (Math.abs(x) > BOARD_HALF - 0.35 || Math.abs(z) > BOARD_HALF - 0.35) continue;

      const isCircle = puffHash(seed) > 0.42;
      const base = 1.15 + puffHash(seed + 1) * 1.05;
      puffs.push({
        id: `${row}-${col}-a`,
        x,
        z,
        rx: isCircle ? base : base * (1.15 + puffHash(seed + 2) * 0.55),
        rz: isCircle ? base : base * (0.72 + puffHash(seed + 3) * 0.35),
        y: 0.58 + puffHash(seed + 4) * 0.62,
        rot: puffHash(seed + 5) * Math.PI,
        opacity: 0.68 + puffHash(seed + 6) * 0.22,
        drift: (puffHash(seed + 7) - 0.5) * 0.08,
      });
      seed += 8;

      if (puffHash(seed) > 0.35) {
        const overlap = 0.75 + puffHash(seed + 1) * 0.45;
        const [ox, oz] = pullToCenter(
          rawX + (puffHash(seed + 2) - 0.5) * 1.35,
          rawZ + (puffHash(seed + 3) - 0.5) * 1.35,
        );
        puffs.push({
          id: `${row}-${col}-b`,
          x: ox,
          z: oz,
          rx: overlap * (0.9 + puffHash(seed + 4) * 0.5),
          rz: overlap * (0.9 + puffHash(seed + 5) * 0.5),
          y: 0.62 + puffHash(seed + 6) * 0.58,
          rot: puffHash(seed + 7) * Math.PI,
          opacity: 0.62 + puffHash(seed + 8) * 0.22,
          drift: (puffHash(seed + 9) - 0.5) * 0.06,
        });
        seed += 10;
      }
    }
  }

  const fillers = [
    [-3.6, -3.4], [-1.2, -4.1], [1.4, -3.7], [3.5, -3.2],
    [-4.0, -0.8], [-3.8, 1.6], [3.9, 0.9], [4.1, 2.8],
    [-3.3, 3.6], [-0.6, 4.0], [2.8, 3.8], [4.2, -1.4],
  ];

  fillers.forEach(([rawX, rawZ], index) => {
    const [x, z] = pullToCenter(rawX, rawZ);
    const fillerSeed = 500 + index * 11;
    const size = 1.05 + puffHash(fillerSeed) * 0.35;
    puffs.push({
      id: `edge-${index}`,
      x: -2.8,
      z,
      rx: size,
      rz: size * (0.82 + puffHash(fillerSeed + 1) * 0.35),
      y: 0.1 + puffHash(fillerSeed + 2) * 0.5,
      rot: puffHash(fillerSeed + 3) * Math.PI,
      opacity: 0.34 + puffHash(fillerSeed + 6) * 1,
      drift: (puffHash(fillerSeed + 5) - 0.5) * 0.05,
    });
  });

  return puffs;
}

const CLOUD_PUFFS = buildCloudPuffs();

function CloudPuff({ puff, texture }) {
  const meshRef = useRef(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    meshRef.current.position.y = WATER_LIFT + puff.y + Math.sin(t * 0.4 + puff.rot) * 0.14;
    meshRef.current.position.x = puff.x + Math.sin(t * 0.18 + puff.rot * 2) * puff.drift;
    meshRef.current.position.z = puff.z + Math.cos(t * 0.16 + puff.rot) * puff.drift;
  });

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, puff.rot]}
      position={[puff.x, WATER_LIFT + puff.y, puff.z]}
      scale={[puff.rx, puff.rz, 1]}
      renderOrder={6}
    >
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={puff.opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

export default function BoardFog() {
  const puffTexture = useMemo(() => createCloudPuffTexture(), []);

  return (
    <group>
      {CLOUD_PUFFS.map((puff) => (
        <CloudPuff
          key={puff.id}
          puff={puff}
          texture={puffTexture}
        />
      ))}
    </group>
  );
}
