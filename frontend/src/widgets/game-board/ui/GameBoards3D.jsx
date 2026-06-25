import React, { Suspense, useImperativeHandle, useMemo, useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { BoardShips } from '@entities/ship/ui/BoardPiece';
import BoardVolume from '@widgets/game-board/ui/BoardVolume';
import BoardFog from '@widgets/game-board/ui/BoardFog';
import { BOARD_WORLD_SIZE, WATER_LIFT } from '@shared/config/boardConstants';
import { createGridTexture, createWaterTexture } from '@shared/lib/boardTextures';
import {
  configureRenderer,
  getRenderDpr,
} from '@shared/lib/renderQuality';

const BOARD_GAP = 2.2;
const LEFT_BOARD_X = -(BOARD_WORLD_SIZE + BOARD_GAP) / 2;
const RIGHT_BOARD_X = (BOARD_WORLD_SIZE + BOARD_GAP) / 2;

function cellPosition(index, gridSize) {
  const row = Math.floor(index / gridSize);
  const col = index % gridSize;
  const cellSize = BOARD_WORLD_SIZE / gridSize;
  const half = BOARD_WORLD_SIZE / 2;
  return {
    x: -half + cellSize * col + cellSize / 2,
    z: -half + cellSize * row + cellSize / 2,
    tile: cellSize * 0.96,
  };
}

function worldToCell(worldX, worldZ, gridSize, offsetX, clamp = false) {
  const localX = worldX - offsetX;
  const localZ = worldZ;
  const half = BOARD_WORLD_SIZE / 2;
  const cellSize = BOARD_WORLD_SIZE / gridSize;
  let col = Math.floor((localX + half) / cellSize);
  let row = Math.floor((localZ + half) / cellSize);

  if (clamp) {
    col = Math.max(0, Math.min(gridSize - 1, col));
    row = Math.max(0, Math.min(gridSize - 1, row));
    return row * gridSize + col;
  }

  if (col < 0 || col >= gridSize || row < 0 || row >= gridSize) return null;
  return row * gridSize + col;
}

const SELF_BOARD_PICK_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER_LIFT);
const SELF_BOARD_PICK_POINT = new THREE.Vector3();
const HIGHLIGHT_PLANE = new THREE.PlaneGeometry(1, 1);

function variantColor(variant) {
  switch (variant) {
    case 'placed':
    case 'ship':
      return '#52525b';
    case 'hit':
      return '#ef4444';
    case 'miss':
      return '#e0f2fe';
    case 'hover-valid':
      return '#4ade80';
    case 'hover-invalid':
      return '#f59e0b';
    case 'hover':
      return '#ffffff';
    default:
      return '#ffffff';
  }
}

function variantOpacity(variant) {
  switch (variant) {
    case 'placed':
      return 0.94;
    case 'hover-invalid':
      return 0.9;
    case 'hover-valid':
      return 0.86;
    default:
      return 0.78;
  }
}

function resolveHighlightVariant(cellStates, index, hoveredIndex, interactive, hideShipHighlights, suppressPointerHover) {
  let variant = cellStates[index] || 'default';
  const isHovered = hoveredIndex === index;

  if (hideShipHighlights && (variant === 'placed' || variant === 'ship')) return null;

  if (
    interactive
    && isHovered
    && !suppressPointerHover
    && !['placed', 'ship', 'hit', 'miss', 'hover-valid', 'hover-invalid'].includes(variant)
  ) {
    variant = 'hover';
  }

  if (!shouldShowHighlight(variant, isHovered, interactive, suppressPointerHover)) return null;
  return variant;
}

function shouldShowHighlight(variant, isHovered, interactive, suppressPointerHover) {
  if (['placed', 'ship', 'hit', 'miss', 'hover-valid', 'hover-invalid'].includes(variant)) return true;
  if (interactive && isHovered && !suppressPointerHover) return true;
  return false;
}

function SceneInvalidator({ selfStates, opponentStates, selfShips, opponentShips }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    invalidate();
  }, [selfStates, opponentStates, selfShips, opponentShips, invalidate]);
  return null;
}

function SceneQuality() {
  const { gl, invalidate } = useThree();
  useEffect(() => {
    configureRenderer(gl);
    invalidate();
  }, [gl, invalidate]);
  return null;
}

function CellHighlightMesh({ x, z, tile, color, opacity }) {
  return (
    <mesh
      position={[x, WATER_LIFT + 0.028, z]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[tile, tile, 1]}
      geometry={HIGHLIGHT_PLANE}
      renderOrder={2}
    >
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function StaticCellHighlights({
  gridSize,
  cellStates,
  interactive,
  hideShipHighlights,
  suppressPointerHover,
}) {
  const count = gridSize * gridSize;

  const highlights = useMemo(() => {
    const items = [];
    for (let index = 0; index < count; index += 1) {
      const variant = resolveHighlightVariant(
        cellStates,
        index,
        null,
        interactive,
        hideShipHighlights,
        suppressPointerHover,
      );
      if (!variant) continue;
      const { x, z, tile } = cellPosition(index, gridSize);
      items.push({ index, x, z, tile, color: variantColor(variant), opacity: variantOpacity(variant) });
    }
    return items;
  }, [cellStates, count, interactive, hideShipHighlights, suppressPointerHover, gridSize]);

  return (
    <>
      {highlights.map(({ index, x, z, tile, color, opacity }) => (
        <CellHighlightMesh
          key={index}
          x={x}
          z={z}
          tile={tile}
          color={color}
          opacity={opacity}
        />
      ))}
    </>
  );
}

function HoverCellHighlight({
  gridSize,
  cellStates,
  hoveredIndex,
  interactive,
  suppressPointerHover,
}) {
  if (hoveredIndex === null || !interactive || suppressPointerHover) return null;

  const variant = resolveHighlightVariant(
    cellStates,
    hoveredIndex,
    hoveredIndex,
    interactive,
    false,
    false,
  );

  if (!variant || !['hover', 'hover-valid', 'hover-invalid'].includes(variant)) {
    return null;
  }

  const { x, z, tile } = cellPosition(hoveredIndex, gridSize);

  return (
    <CellHighlightMesh
      x={x}
      z={z}
      tile={tile}
      color={variantColor(variant)}
      opacity={variantOpacity(variant)}
    />
  );
}

function CellHighlights({
  gridSize,
  cellStates,
  hoveredIndex,
  interactive,
  hideShipHighlights = false,
  suppressPointerHover = false,
}) {
  return (
    <>
      <StaticCellHighlights
        gridSize={gridSize}
        cellStates={cellStates}
        interactive={interactive}
        hideShipHighlights={hideShipHighlights}
        suppressPointerHover={suppressPointerHover}
      />
      <HoverCellHighlight
        gridSize={gridSize}
        cellStates={cellStates}
        hoveredIndex={hoveredIndex}
        interactive={interactive}
        suppressPointerHover={suppressPointerHover}
      />
    </>
  );
}

function WaterBoard({
  offsetX,
  gridSize,
  waterTexture,
  gridTexture,
  cellStates,
  ships,
  showShipModels,
  interactive,
  onCellClick,
  hitPlaneRef,
  hideShipHighlights,
  suppressPointerHover,
  concealed = false,
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const invalidate = useThree((state) => state.invalidate);
  const hoverFrameRef = useRef(null);
  const pendingHoverRef = useRef(undefined);

  const resolveCell = (point) => worldToCell(point.x, point.z, gridSize, offsetX);

  const scheduleHover = (nextIndex) => {
    pendingHoverRef.current = nextIndex;
    if (hoverFrameRef.current !== null) return;

    hoverFrameRef.current = requestAnimationFrame(() => {
      hoverFrameRef.current = null;
      const value = pendingHoverRef.current;
      pendingHoverRef.current = undefined;
      setHoveredIndex((prev) => (prev === value ? prev : value));
      invalidate();
    });
  };

  useEffect(() => () => {
    if (hoverFrameRef.current !== null) {
      cancelAnimationFrame(hoverFrameRef.current);
    }
  }, []);

  useEffect(() => {
    invalidate();
  }, [cellStates, ships, concealed, invalidate]);

  return (
    <group position={[offsetX, 0, 0]}>
      <BoardVolume />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER_LIFT, 0]}>
        <planeGeometry args={[BOARD_WORLD_SIZE, BOARD_WORLD_SIZE]} />
        <meshBasicMaterial
          map={waterTexture}
          toneMapped={false}
          depthWrite={false}
          opacity={concealed ? 0.72 : 1}
          transparent={concealed}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER_LIFT + 0.012, 0]} renderOrder={1}>
        <planeGeometry args={[BOARD_WORLD_SIZE, BOARD_WORLD_SIZE]} />
        <meshBasicMaterial
          map={gridTexture}
          {...(concealed
            ? {
              transparent: true,
              opacity: 0.14,
              depthWrite: false,
              depthTest: false,
            }
            : {
              alphaTest: 0.12,
              depthWrite: false,
              depthTest: true,
            })}
          toneMapped={false}
        />
      </mesh>

      {!concealed && (
        <CellHighlights
          gridSize={gridSize}
          cellStates={cellStates}
          hoveredIndex={hoveredIndex}
          interactive={interactive}
          hideShipHighlights={hideShipHighlights}
          suppressPointerHover={suppressPointerHover}
        />
      )}

      {!concealed && showShipModels && ships?.length > 0 && (
        <BoardShips ships={ships} gridSize={gridSize} />
      )}

      {concealed && <BoardFog />}

      {!concealed && (
        <mesh
          ref={hitPlaneRef}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, WATER_LIFT + 0.06, 0]}
          onPointerMove={(event) => {
            if (!interactive) return;
            event.stopPropagation();
            const index = resolveCell(event.point);
            scheduleHover(index);
          }}
          onPointerOut={() => scheduleHover(null)}
          onPointerUp={(event) => {
            if (!interactive) return;
            event.stopPropagation();
            const index = resolveCell(event.point);
            if (index !== null) onCellClick(index);
          }}
        >
          <planeGeometry args={[BOARD_WORLD_SIZE, BOARD_WORLD_SIZE]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      )}
    </group>
  );
}

function FogAnimationLoop({ active }) {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (!active) return undefined;
    let frameId = 0;
    const tick = () => {
      invalidate();
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [active, invalidate]);

  return null;
}

function BoardsScene({
  gridSize,
  selfStates,
  opponentStates,
  selfShips,
  opponentShips,
  selfInteractive,
  opponentInteractive,
  onSelfCellClick,
  onOpponentCellClick,
  pickRef,
  selfHitPlaneRef,
  isPlacing,
  suppressPlacementHover,
}) {
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const waterTexture = useMemo(
    () => createWaterTexture(maxAnisotropy),
    [maxAnisotropy]
  );
  const gridTexture = useMemo(
    () => createGridTexture(gridSize, maxAnisotropy),
    [gridSize, maxAnisotropy]
  );
  const opponentConcealed = isPlacing && !opponentInteractive;
  const { camera, gl, raycaster, pointer, invalidate } = useThree();

  useEffect(() => {
    invalidate();
  }, [waterTexture, invalidate]);

  useImperativeHandle(pickRef, () => ({
    pick(clientX, clientY) {
      const rect = gl.domElement.getBoundingClientRect();
      if (
        clientX < rect.left
        || clientX > rect.left + rect.width / 2
        || clientY < rect.top
        || clientY > rect.bottom
      ) {
        return null;
      }

      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      if (!raycaster.ray.intersectPlane(SELF_BOARD_PICK_PLANE, SELF_BOARD_PICK_POINT)) {
        return null;
      }

      const half = BOARD_WORLD_SIZE / 2;
      const localX = SELF_BOARD_PICK_POINT.x - LEFT_BOARD_X;
      const localZ = SELF_BOARD_PICK_POINT.z;

      if (Math.abs(localX) > half || Math.abs(localZ) > half) {
        return null;
      }

      return worldToCell(
        SELF_BOARD_PICK_POINT.x,
        SELF_BOARD_PICK_POINT.z,
        gridSize,
        LEFT_BOARD_X,
        true,
      );
    },
  }));

  const opponentHitPlaneRef = useRef(null);

  return (
    <>
      <SceneQuality />
      <ambientLight intensity={0.72} />
      <hemisphereLight args={['#e0f2fe', '#38bdf8', 0.55]} />
      <directionalLight position={[6, 14, 8]} intensity={0.38} />
      <directionalLight position={[-4, 8, -6]} intensity={0.14} />
      <SceneInvalidator
        selfStates={selfStates}
        opponentStates={opponentStates}
        selfShips={selfShips}
        opponentShips={opponentShips}
      />
      <FogAnimationLoop active={opponentConcealed} />

      <WaterBoard
        offsetX={LEFT_BOARD_X}
        gridSize={gridSize}
        waterTexture={waterTexture}
        gridTexture={gridTexture}
        cellStates={selfStates}
        ships={selfShips}
        showShipModels
        interactive={selfInteractive}
        onCellClick={onSelfCellClick}
        hitPlaneRef={selfHitPlaneRef}
        hideShipHighlights={false}
        suppressPointerHover={suppressPlacementHover}
      />
      <WaterBoard
        offsetX={RIGHT_BOARD_X}
        gridSize={gridSize}
        waterTexture={waterTexture}
        gridTexture={gridTexture}
        cellStates={opponentStates}
        ships={opponentShips}
        showShipModels
        interactive={opponentInteractive}
        onCellClick={onOpponentCellClick}
        hitPlaneRef={opponentHitPlaneRef}
        hideShipHighlights={false}
        suppressPointerHover={false}
        concealed={opponentConcealed}
      />
    </>
  );
}

export default React.memo(function GameBoards3D({
  gridSize,
  selfStates,
  opponentStates,
  selfShips = [],
  opponentShips = [],
  selfInteractive,
  opponentInteractive,
  onSelfCellClick,
  onOpponentCellClick,
  pickRef,
  wrapRef,
  isPlacing = false,
  suppressPlacementHover = false,
}) {
  const selfHitPlaneRef = useRef(null);

  return (
    <div
      ref={wrapRef}
      className={`game-boards-3d-wrap${selfInteractive || opponentInteractive ? ' game-boards-3d-wrap--interactive' : ''}`}
    >
      <Canvas
        frameloop="demand"
        dpr={getRenderDpr()}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 10.6, 11.8], fov: 46, near: 0.1, far: 100 }}
        onCreated={({ camera, gl, invalidate }) => {
          configureRenderer(gl);
          camera.lookAt(0, -1.15, 0);
          invalidate();
        }}
      >
        <Suspense fallback={null}>
          <BoardsScene
            gridSize={gridSize}
            selfStates={selfStates}
            opponentStates={opponentStates}
            selfShips={selfShips}
            opponentShips={opponentShips}
            selfInteractive={selfInteractive}
            opponentInteractive={opponentInteractive}
            onSelfCellClick={onSelfCellClick}
            onOpponentCellClick={onOpponentCellClick}
            pickRef={pickRef}
            selfHitPlaneRef={selfHitPlaneRef}
            isPlacing={isPlacing}
            suppressPlacementHover={suppressPlacementHover}
          />
        </Suspense>
      </Canvas>
    </div>
  );
});
