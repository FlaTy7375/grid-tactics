import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { BOARD_WORLD_SIZE, WATER_LIFT } from '@shared/config/boardConstants';
import {
  DEFAULT_SHIP_TRANSFORM,
  SHIP_MODEL_PATH,
  resolveShipTransform,
  rotationToRad,
} from '@shared/config/shipTransform';
import { enhanceObjectMaterials } from '@shared/lib/renderQuality';
import { getBakedBaseModel, getCachedShipAssembly } from '@shared/lib/shipModelCache';

export { BOARD_WORLD_SIZE, WATER_LIFT };

export function getShipModelPath() {
  return SHIP_MODEL_PATH;
}

export function getShipPreviewLayout(size, shipTransform = DEFAULT_SHIP_TRANSFORM, gridSize = 10) {
  const transform = resolveShipTransform(shipTransform);
  const cellSize = BOARD_WORLD_SIZE / gridSize;

  return {
    x: 0,
    z: 0,
    cellSize,
    targetLength: size * cellSize * transform.lengthFactor,
    targetWidth: cellSize * transform.widthFactor,
  };
}

export function getShipLayout(index, size, isVertical, gridSize, shipTransform = DEFAULT_SHIP_TRANSFORM, layoutStart) {
  const transform = resolveShipTransform(shipTransform);
  const cellSize = BOARD_WORLD_SIZE / gridSize;
  const half = BOARD_WORLD_SIZE / 2;
  const startRow = layoutStart?.startRow ?? Math.floor(index / gridSize);
  const startCol = layoutStart?.startCol ?? (index % gridSize);

  const centerCol = isVertical ? startCol : startCol + (size - 1) / 2;
  const centerRow = isVertical ? startRow + (size - 1) / 2 : startRow;

  return {
    x: -half + cellSize * centerCol + cellSize / 2,
    z: -half + cellSize * centerRow + cellSize / 2,
    cellSize,
    targetLength: size * cellSize * transform.lengthFactor,
    targetWidth: cellSize * transform.widthFactor,
  };
}

function cloneMeshMaterial(material) {
  return Array.isArray(material)
    ? material.map((entry) => entry.clone())
    : material.clone();
}

function bakeModelGeometry(sourceScene) {
  const root = sourceScene.clone(true);
  root.updateMatrixWorld(true);

  const meshes = [];
  root.traverse((child) => {
    if (!child.isMesh) return;

    const geometry = child.geometry.clone();
    geometry.applyMatrix4(child.matrixWorld);

    meshes.push({ geometry, material: cloneMeshMaterial(child.material) });
  });

  if (!meshes.length) {
    return null;
  }

  const measure = new THREE.Group();
  meshes.forEach(({ geometry, material }) => {
    measure.add(new THREE.Mesh(geometry, material));
  });

  const box = new THREE.Box3().setFromObject(measure);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  meshes.forEach(({ geometry }) => {
    geometry.translate(-center.x, -center.y, -center.z);
  });

  return {
    meshes,
    width: size.x,
    height: size.y,
    length: size.z,
  };
}

function createCenteredModel(sourceScene, preview, valid, anisotropy) {
  const baked = bakeModelGeometry(sourceScene);
  if (!baked) {
    return null;
  }

  const { meshes, width, height, length } = baked;
  const model = new THREE.Group();
  meshes.forEach(({ geometry, material }) => {
    const meshMaterial = preview ? tintPreviewMaterial(material, valid) : material;
    model.add(new THREE.Mesh(geometry, meshMaterial));
  });

  enhanceObjectMaterials(model, anisotropy);

  return { model, width, height, length };
}

function getPlacementYaw(isVertical) {
  return isVertical ? -Math.PI / 2 : 0;
}

function tintPreviewMaterial(material, valid) {
  const source = Array.isArray(material) ? material[0] : material;
  const tinted = source.clone();
  tinted.transparent = true;
  tinted.opacity = 0.78;
  tinted.depthWrite = false;
  tinted.emissive = new THREE.Color(valid ? '#166534' : '#b45309');
  tinted.emissiveIntensity = 0.22;
  return tinted;
}

function computeStockUniform(modelSize, layout, transform) {
  const maxDim = Math.max(modelSize.width, modelSize.length, modelSize.height);
  const target = layout.cellSize * transform.singleCellFit;
  return (target / Math.max(maxDim, 0.001)) * transform.singleCellScaleMul;
}

function computeHeightScale(stock, shipSize, transform) {
  const base = stock * transform.heightScaleMul;
  if (shipSize === 4) return base * transform.size4HeightMul;
  if (shipSize === 3) return base * transform.size3HeightMul;
  return base;
}

function computeShipScaleSpec(modelSize, layout, shipSize, transform) {
  const stock = computeStockUniform(modelSize, layout, transform);
  const scaleY = computeHeightScale(stock, shipSize, transform);

  if (shipSize === 1) {
    return {
      scaleX: stock,
      scaleY,
      scaleZ: stock,
      anchorStern: false,
    };
  }

  if (shipSize === 2) {
    const lengthZ = (layout.targetLength / Math.max(modelSize.length, 0.001)) * transform.lengthScaleMul;
    return {
      scaleX: stock,
      scaleY,
      scaleZ: lengthZ,
      anchorStern: true,
    };
  }

  if (shipSize === 3) {
    return {
      scaleX: (layout.targetWidth / Math.max(modelSize.width, 0.001)) * transform.widthScaleMul,
      scaleY,
      scaleZ: (layout.targetLength / Math.max(modelSize.length, 0.001)) * transform.lengthScaleMul,
      anchorStern: false,
    };
  }

  return {
    scaleX: (layout.targetWidth / Math.max(modelSize.width, 0.001)) * transform.widthScaleMul,
    scaleY,
    scaleZ: (layout.targetLength / Math.max(modelSize.length, 0.001)) * transform.lengthScaleMul,
    anchorStern: false,
  };
}

function extractSourceMeshes(modelSize) {
  const meshes = [];
  modelSize.model.traverse((child) => {
    if (!child.isMesh) return;
    meshes.push({
      geometry: child.geometry,
      material: child.material,
    });
  });
  return meshes;
}

function applyGeometryScale(meshes, modelSize, scaleSpec) {
  const halfLength = modelSize.length / 2;
  const { scaleX, scaleY, scaleZ, anchorStern } = scaleSpec;

  return meshes.map(({ geometry, material }) => {
    const scaledGeometry = geometry.clone();
    const position = scaledGeometry.attributes.position;

    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i) * scaleX;
      const y = position.getY(i) * scaleY;
      const zRaw = position.getZ(i);
      const z = anchorStern
        ? -halfLength + (zRaw + halfLength) * scaleZ
        : zRaw * scaleZ;
      position.setXYZ(i, x, y, z);
    }

    return { geometry: scaledGeometry, material: cloneMeshMaterial(material) };
  });
}

function getOrientTuneMatrix(orientRotation, tuneRotation) {
  const qOrient = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(orientRotation[0], orientRotation[1], orientRotation[2], 'XYZ'),
  );
  const qTune = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(tuneRotation[0], tuneRotation[1], tuneRotation[2], 'XYZ'),
  );
  return new THREE.Matrix4().makeRotationFromQuaternion(qOrient.multiply(qTune));
}

function measureMeshes(meshes) {
  const group = new THREE.Group();
  meshes.forEach(({ geometry, material }) => {
    group.add(new THREE.Mesh(geometry, material));
  });
  return new THREE.Box3().setFromObject(group);
}

function centerMeshesOnOrigin(meshes) {
  const box = measureMeshes(meshes);
  const center = box.getCenter(new THREE.Vector3());
  meshes.forEach(({ geometry }) => {
    geometry.translate(-center.x, -center.y, -center.z);
  });
}

function groundMeshes(meshes) {
  const box = measureMeshes(meshes);
  const lift = -box.min.y;
  if (Math.abs(lift) < 1e-6) return;
  meshes.forEach(({ geometry }) => {
    geometry.translate(0, lift, 0);
  });
}

function buildShipMeshes(modelSize, scaleSpec, orientRotation, tuneRotation) {
  const scaledMeshes = applyGeometryScale(extractSourceMeshes(modelSize), modelSize, scaleSpec);
  const rotation = getOrientTuneMatrix(orientRotation, tuneRotation);

  const meshes = scaledMeshes.map(({ geometry, material }) => {
    const rotatedGeometry = geometry;
    rotatedGeometry.applyMatrix4(rotation);
    rotatedGeometry.computeVertexNormals();
    return { geometry: rotatedGeometry, material };
  });

  centerMeshesOnOrigin(meshes);
  groundMeshes(meshes);
  return meshes;
}

function computeYawPlacement(meshes, isVertical, modelOffset, shipTransform) {
  const transform = resolveShipTransform(shipTransform);
  const yaw = getPlacementYaw(isVertical);

  const meshGroup = new THREE.Group();
  meshes.forEach(({ geometry, material }) => {
    meshGroup.add(new THREE.Mesh(geometry, material));
  });

  const offsetGroup = new THREE.Group();
  offsetGroup.position.set(modelOffset[0], modelOffset[1], modelOffset[2]);
  offsetGroup.add(meshGroup);

  const yawGroup = new THREE.Group();
  yawGroup.rotation.y = yaw;
  yawGroup.add(offsetGroup);

  const root = new THREE.Group();
  root.add(yawGroup);
  root.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());

  return {
    yaw,
    yOffset: WATER_LIFT - box.min.y + transform.yLift,
    alignOffset: [-center.x, 0, -center.z],
    modelOffset,
  };
}

export function buildShipAssembly(modelSize, layout, isVertical, shipTransform = DEFAULT_SHIP_TRANSFORM, shipSize = 2) {
  const transform = resolveShipTransform(shipTransform);
  const orientRotation = rotationToRad(transform.orientRotation);
  const tuneRotation = rotationToRad(transform.tuneRotation);
  const scaleSpec = computeShipScaleSpec(modelSize, layout, shipSize, transform);
  const meshes = buildShipMeshes(modelSize, scaleSpec, orientRotation, tuneRotation);

  return computeYawPlacement(meshes, isVertical, transform.modelOffset, shipTransform);
}

function ShipMeshes({ meshes }) {
  return meshes.map((entry, index) => (
    <mesh
      key={`${entry.geometry.uuid}-${index}`}
      geometry={entry.geometry}
      material={entry.material}
      castShadow={false}
      receiveShadow={false}
      renderOrder={6}
    />
  ));
}

function BoardShipModel({ sourceScene, ship, gridSize, shipTransform }) {
  const layout = useMemo(
    () => getShipLayout(
      ship.index,
      ship.size,
      ship.isVertical,
      gridSize,
      shipTransform,
      ship.startRow !== undefined && ship.startCol !== undefined
        ? { startRow: ship.startRow, startCol: ship.startCol }
        : undefined,
    ),
    [ship.index, ship.startRow, ship.startCol, ship.size, ship.isVertical, gridSize, shipTransform],
  );

  const assembly = useMemo(
    () => getCachedShipAssembly({
      sourceScene,
      layout,
      shipSize: ship.size,
      isVertical: ship.isVertical,
      shipTransform,
      preview: Boolean(ship.preview),
      valid: ship.valid !== false,
    }),
    [sourceScene, layout, ship.size, ship.isVertical, shipTransform, ship.preview, ship.valid],
  );

  if (!assembly) return null;

  const { meshes, placement } = assembly;

  return (
    <group position={[layout.x, placement.yOffset, layout.z]}>
      <group position={placement.alignOffset}>
        <group rotation={[0, placement.yaw, 0]}>
          <group position={placement.modelOffset}>
            <ShipMeshes meshes={meshes} />
          </group>
        </group>
      </group>
    </group>
  );
}

export function BoardShips({ ships, gridSize, shipTransform = DEFAULT_SHIP_TRANSFORM }) {
  const { scene } = useGLTF(SHIP_MODEL_PATH);
  const invalidate = useThree((state) => state.invalidate);
  const transform = resolveShipTransform(shipTransform);

  useEffect(() => {
    getBakedBaseModel(scene);
    invalidate();
  }, [scene, invalidate]);

  if (!ships.length) return null;

  return (
    <>
      {ships.map((ship) => (
        <BoardShipModel
          key={ship.id || `${ship.index}-${ship.size}`}
          sourceScene={scene}
          ship={ship}
          gridSize={gridSize}
          shipTransform={transform}
        />
      ))}
    </>
  );
}

export function buildShipPreviewGroup(
  sourceScene,
  size,
  isVertical,
  shipTransform = DEFAULT_SHIP_TRANSFORM,
  anisotropy = 8,
) {
  const layout = getShipPreviewLayout(size, shipTransform);
  const transform = resolveShipTransform(shipTransform);
  const modelSize = createCenteredModel(sourceScene, false, true, anisotropy);
  if (!modelSize) return null;

  const orientRotation = rotationToRad(transform.orientRotation);
  const tuneRotation = rotationToRad(transform.tuneRotation);
  const scaleSpec = computeShipScaleSpec(modelSize, layout, size, transform);
  const shipMeshes = buildShipMeshes(modelSize, scaleSpec, orientRotation, tuneRotation);
  const placement = computeYawPlacement(shipMeshes, isVertical, transform.modelOffset, shipTransform);

  const root = new THREE.Group();
  root.position.y = placement.yOffset;

  const alignGroup = new THREE.Group();
  alignGroup.position.set(placement.alignOffset[0], placement.alignOffset[1], placement.alignOffset[2]);

  const yawGroup = new THREE.Group();
  yawGroup.rotation.y = placement.yaw;

  const offsetGroup = new THREE.Group();
  offsetGroup.position.set(placement.modelOffset[0], placement.modelOffset[1], placement.modelOffset[2]);

  shipMeshes.forEach(({ geometry, material }) => {
    offsetGroup.add(new THREE.Mesh(geometry, material));
  });

  yawGroup.add(offsetGroup);
  alignGroup.add(yawGroup);
  root.add(alignGroup);

  enhanceObjectMaterials(root, anisotropy);
  return root;
}

useGLTF.preload(SHIP_MODEL_PATH);
