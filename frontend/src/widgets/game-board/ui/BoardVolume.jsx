import React, { useMemo } from 'react';
import * as THREE from 'three';
import {
  BOARD_WORLD_SIZE,
  WATER_LIFT,
  BOARD_BLOCK_DEPTH,
  BOARD_SURFACE_GAP,
} from '@shared/config/boardConstants';
import { getSharedWaterVolumeTexture, getSharedBoardShadowTexture } from '@shared/lib/boardTextures';

const WALL_THICKNESS = 0.12;
const SHADOW_SCALE = 1.14;

const volumeTexture = getSharedWaterVolumeTexture();
const shadowTexture = getSharedBoardShadowTexture();

const volumeMaterial = new THREE.MeshBasicMaterial({
  map: volumeTexture,
  toneMapped: false,
});

export default function BoardVolume() {
  const topY = WATER_LIFT - BOARD_SURFACE_GAP;
  const bodyCenterY = topY - BOARD_BLOCK_DEPTH / 2;
  const half = BOARD_WORLD_SIZE / 2;
  const innerSize = BOARD_WORLD_SIZE - WALL_THICKNESS * 2;
  const bottomY = topY - BOARD_BLOCK_DEPTH;
  const shadowY = bottomY + 0.012;

  const walls = useMemo(() => ([
    [0, half - WALL_THICKNESS / 2, BOARD_WORLD_SIZE, WALL_THICKNESS],
    [0, -half + WALL_THICKNESS / 2, BOARD_WORLD_SIZE, WALL_THICKNESS],
    [half - WALL_THICKNESS / 2, 0, WALL_THICKNESS, BOARD_WORLD_SIZE],
    [-half + WALL_THICKNESS / 2, 0, WALL_THICKNESS, BOARD_WORLD_SIZE],
  ]), [half]);

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, shadowY, 0]}
        renderOrder={-2}
      >
        <planeGeometry args={[
          BOARD_WORLD_SIZE * SHADOW_SCALE,
          BOARD_WORLD_SIZE * SHADOW_SCALE,
        ]}
        />
        <meshBasicMaterial
          map={shadowTexture}
          transparent
          opacity={0.94}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh position={[0, bodyCenterY, 0]} material={volumeMaterial}>
        <boxGeometry args={[innerSize, BOARD_BLOCK_DEPTH, innerSize]} />
      </mesh>

      {walls.map(([x, z, width, depth], index) => (
        <mesh
          key={index}
          position={[x, bodyCenterY, z]}
          material={volumeMaterial}
        >
          <boxGeometry args={[width, BOARD_BLOCK_DEPTH, depth]} />
        </mesh>
      ))}
    </group>
  );
}
