import * as THREE from 'three';
import {
  DEFAULT_SHIP_TRANSFORM,
  resolveShipTransform,
  rotationToRad,
} from '@shared/config/shipTransform';
import { WATER_LIFT } from '@shared/config/boardConstants';

const baseModelCache = new WeakMap();
const assemblyCache = new Map();

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

  if (!meshes.length) return null;

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

function createCenteredModel(sourceScene, preview, valid) {
  const baked = bakeModelGeometry(sourceScene);
  if (!baked) return null;

  const { meshes, width, height, length } = baked;
  const model = new THREE.Group();
  meshes.forEach(({ geometry, material }) => {
    const meshMaterial = preview ? tintPreviewMaterial(material, valid) : material;
    model.add(new THREE.Mesh(geometry, meshMaterial));
  });

  return { model, width, height, length };
}

export function getBakedBaseModel(sourceScene) {
  let cached = baseModelCache.get(sourceScene);
  if (!cached) {
    cached = createCenteredModel(sourceScene, false, true);
    if (cached) baseModelCache.set(sourceScene, cached);
  }
  return cached;
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
    return { scaleX: stock, scaleY, scaleZ: stock, anchorStern: false };
  }
  if (shipSize === 2) {
    const lengthZ = (layout.targetLength / Math.max(modelSize.length, 0.001)) * transform.lengthScaleMul;
    return { scaleX: stock, scaleY, scaleZ: lengthZ, anchorStern: true };
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
    meshes.push({ geometry: child.geometry, material: child.material });
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
    geometry.applyMatrix4(rotation);
    geometry.computeVertexNormals();
    return { geometry, material };
  });

  centerMeshesOnOrigin(meshes);
  groundMeshes(meshes);
  return meshes;
}

function getPlacementYaw(isVertical) {
  return isVertical ? -Math.PI / 2 : 0;
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

export function getCachedShipAssembly({
  sourceScene,
  layout,
  shipSize,
  isVertical,
  shipTransform = DEFAULT_SHIP_TRANSFORM,
  preview = false,
  valid = true,
}) {
  const cacheKey = [
    shipSize,
    isVertical ? 1 : 0,
    layout.cellSize.toFixed(4),
    preview ? (valid ? 'pv' : 'pi') : 'board',
  ].join(':');

  const cached = assemblyCache.get(cacheKey);
  if (cached) return cached;

  const modelSize = preview
    ? createCenteredModel(sourceScene, true, valid)
    : getBakedBaseModel(sourceScene);
  if (!modelSize) return null;

  const transform = resolveShipTransform(shipTransform);
  const orientRotation = rotationToRad(transform.orientRotation);
  const tuneRotation = rotationToRad(transform.tuneRotation);
  const scaleSpec = computeShipScaleSpec(modelSize, layout, shipSize, transform);
  const meshes = buildShipMeshes(modelSize, scaleSpec, orientRotation, tuneRotation);
  const placement = computeYawPlacement(meshes, isVertical, transform.modelOffset, shipTransform);

  const assembly = { meshes, placement };
  assemblyCache.set(cacheKey, assembly);
  return assembly;
}
