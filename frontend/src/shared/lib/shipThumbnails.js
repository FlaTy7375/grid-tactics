import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildShipPreviewGroup } from '@entities/ship/ui/BoardPiece';
import { BOARD_WORLD_SIZE } from '@shared/config/boardConstants';
import { DEFAULT_SHIP_TRANSFORM, SHIP_MODEL_PATH } from '@shared/config/shipTransform';
import { configureRenderer } from './renderQuality';

const DEFAULT_SHIP_SIZES = [1, 2, 3, 4];
export const THUMB_CELL_PX = 62;
const THUMB_PAD_PX = 10;
const RENDER_SCALE = 2;
const BOARD_VIEW = new THREE.Vector3(0, 12, 13.5);
const CELL_WORLD = BOARD_WORLD_SIZE / 10;
const VIEW_PAD_WORLD = CELL_WORLD * 0.06;
const FRUSTUM_FILL = 0.8;
const FIXED_VIEW_DISTANCE = 11;

const cache = new Map();
let gltfScene = null;
let modelLoading = null;
let renderer = null;
let renderQueue = Promise.resolve();
let warmupPromise = null;

function thumbnailKey(size, isVertical) {
  return `${size}-${isVertical ? 'v' : 'h'}-prop21`;
}

function getHorizontalLongPx(size) {
  const base = size * THUMB_CELL_PX * DEFAULT_SHIP_TRANSFORM.lengthFactor;
  return base;
}

function getHorizontalShortPx(size) {
  if (size === 3) return THUMB_CELL_PX * 1.4;
  if (size === 4) return THUMB_CELL_PX * 1.5;
  return THUMB_CELL_PX;
}

export function getShipPreviewDimensions(ship) {
  if (ship.isVertical) {
    return { width: THUMB_CELL_PX, height: ship.size * THUMB_CELL_PX };
  }

  return {
    width: getHorizontalLongPx(ship.size),
    height: ship.size >= 3 ? getHorizontalShortPx(ship.size) : THUMB_CELL_PX,
  };
}

export const PALETTE_THUMB_SCALE = 0.52;
const PALETTE_DOCK_PADDING_PX = 10;
const PALETTE_COLUMN_GAP_PX = 6;
const PALETTE_COLUMN_PAD_PX = 2;

export function getShipPaletteDisplayDimensions(ship) {
  const dims = getShipPreviewDimensions(ship);
  return {
    width: Math.round(dims.width * PALETTE_THUMB_SCALE),
    height: Math.round(dims.height * PALETTE_THUMB_SCALE),
  };
}

export function getShipPaletteLift(size) {
  if (size === 1) return 8;
  if (size === 2) return 5;
  return 0;
}

export function getShipPaletteLabelOffset(size) {
  if (size === 1) return 4;
  return 0;
}

export function getShipPaletteSlotSize(size) {
  const horizontal = getShipPaletteDisplayDimensions({ size, isVertical: false });
  const vertical = getShipPaletteDisplayDimensions({ size, isVertical: true });
  return {
    width: Math.max(horizontal.width, vertical.width),
    height: Math.max(horizontal.height, vertical.height),
  };
}

export function layoutShipPalette(entries) {
  const items = entries.map(({ ship, idx }) => ({
    idx,
    size: ship.size,
    slot: getShipPaletteSlotSize(ship.size),
  }));

  const columnWidth = Math.max(...items.map((item) => item.slot.width), 0) + PALETTE_COLUMN_PAD_PX * 2;
  const positions = new Map();
  let cursorY = PALETTE_DOCK_PADDING_PX;

  items.forEach((item) => {
    const { slot } = item;
    const rowHeight = slot.height + PALETTE_COLUMN_PAD_PX * 2;
    positions.set(item.idx, {
      left: PALETTE_DOCK_PADDING_PX,
      top: cursorY,
      width: columnWidth,
      height: rowHeight,
    });
    cursorY += rowHeight + PALETTE_COLUMN_GAP_PX;
  });

  const dockHeight = items.length > 0
    ? cursorY - PALETTE_COLUMN_GAP_PX + PALETTE_DOCK_PADDING_PX
    : PALETTE_DOCK_PADDING_PX * 2;

  return {
    width: columnWidth + PALETTE_DOCK_PADDING_PX * 2,
    height: dockHeight,
    rowTop: 0,
    rowHeight: items[0] ? items[0].slot.height + PALETTE_COLUMN_PAD_PX * 2 : 0,
    positions,
  };
}

const PALETTE_FRAME_LABEL_HEIGHT_PX = 24;

export function getShipPaletteFrameHeight(size) {
  return getShipPaletteSlotSize(size).height + PALETTE_FRAME_LABEL_HEIGHT_PX;
}

export function getMaxShipPaletteFrameHeight(sizes = [1, 2, 3, 4]) {
  return Math.max(...sizes.map((size) => getShipPaletteFrameHeight(size)));
}

export function getMaxShipPaletteSlotWidth(sizes = [1, 2, 3, 4]) {
  return Math.max(...sizes.map((size) => getShipPaletteSlotSize(size).width));
}

function getThumbnailCanvasSize(size, isVertical) {
  const shipDims = getShipPreviewDimensions({ size, isVertical });
  return {
    width: Math.round(shipDims.width * RENDER_SCALE + THUMB_PAD_PX * 2),
    height: Math.round(shipDims.height * RENDER_SCALE + THUMB_PAD_PX * 2),
  };
}

function getBoxCorners(box) {
  return [
    new THREE.Vector3(box.min.x, box.min.y, box.min.z),
    new THREE.Vector3(box.min.x, box.min.y, box.max.z),
    new THREE.Vector3(box.min.x, box.max.y, box.min.z),
    new THREE.Vector3(box.min.x, box.max.y, box.max.z),
    new THREE.Vector3(box.max.x, box.min.y, box.min.z),
    new THREE.Vector3(box.max.x, box.min.y, box.max.z),
    new THREE.Vector3(box.max.x, box.max.y, box.min.z),
    new THREE.Vector3(box.max.x, box.max.y, box.max.z),
  ];
}

function getDeckPoints(shipGroup, size) {
  const tf = DEFAULT_SHIP_TRANSFORM;
  const length = size * CELL_WORLD * tf.lengthFactor;
  const width = CELL_WORLD * tf.widthFactor;

  shipGroup.updateMatrixWorld(true);
  const meshBox = new THREE.Box3().setFromObject(shipGroup);
  const center = meshBox.getCenter(new THREE.Vector3());
  const yDeck = meshBox.min.y;
  const dx = width / 2;
  const dz = length / 2;

  return [
    new THREE.Vector3(center.x - dx, yDeck, center.z - dz),
    new THREE.Vector3(center.x + dx, yDeck, center.z - dz),
    new THREE.Vector3(center.x - dx, yDeck, center.z + dz),
    new THREE.Vector3(center.x + dx, yDeck, center.z + dz),
  ];
}

function getBoundsPoints(shipGroup, size) {
  shipGroup.updateMatrixWorld(true);
  const meshBox = new THREE.Box3().setFromObject(shipGroup);
  const yTop = meshBox.max.y;
  const deck = getDeckPoints(shipGroup, size);

  const top = [
    new THREE.Vector3(meshBox.min.x, yTop, meshBox.min.z),
    new THREE.Vector3(meshBox.max.x, yTop, meshBox.min.z),
    new THREE.Vector3(meshBox.min.x, yTop, meshBox.max.z),
    new THREE.Vector3(meshBox.max.x, yTop, meshBox.max.z),
  ];

  return [...deck, ...top, ...getBoxCorners(meshBox)];
}

function projectPointsToView(points, camera) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  points.forEach((point) => {
    const viewPoint = point.clone().applyMatrix4(camera.matrixWorldInverse);
    minX = Math.min(minX, viewPoint.x);
    maxX = Math.max(maxX, viewPoint.x);
    minY = Math.min(minY, viewPoint.y);
    maxY = Math.max(maxY, viewPoint.y);
  });

  return { minX, maxX, minY, maxY };
}

function fitFrustumToCanvas(deckBounds, meshBounds, canvasWidth, canvasHeight, isVertical, size) {
  const canvasAspect = canvasWidth / canvasHeight;

  if (isVertical) {
    const centerX = (meshBounds.minX + meshBounds.maxX) * 0.5;
    const centerY = (meshBounds.minY + meshBounds.maxY) * 0.5;
    const contentHalfW = (meshBounds.maxX - meshBounds.minX) * 0.5;
    const contentHalfH = (meshBounds.maxY - meshBounds.minY) * 0.5;

    let halfH = contentHalfH + VIEW_PAD_WORLD;
    let halfW = halfH * canvasAspect;
    if (halfW < contentHalfW + VIEW_PAD_WORLD) {
      halfW = contentHalfW + VIEW_PAD_WORLD;
      halfH = halfW / canvasAspect;
    }

    halfW *= FRUSTUM_FILL;
    halfH *= FRUSTUM_FILL;
    return { centerX, centerY, halfW, halfH };
  }

  if (size >= 3) {
    const centerX = (meshBounds.minX + meshBounds.maxX) * 0.5;
    const centerY = (meshBounds.minY + meshBounds.maxY) * 0.5;
    const contentHalfW = (meshBounds.maxX - meshBounds.minX) * 0.5;
    const contentHalfH = (meshBounds.maxY - meshBounds.minY) * 0.5;
    const pad = VIEW_PAD_WORLD * 0.95;
    const zoom = size === 4 ? 0.76 : 0.89;

    let halfW = (contentHalfW + pad) * zoom;
    let halfH = Math.max(halfW / canvasAspect, (contentHalfH + pad) * zoom);
    halfW = halfH * canvasAspect;

    return { centerX, centerY, halfW, halfH };
  }

  const centerX = (meshBounds.minX + meshBounds.maxX) * 0.5;
  const centerY = (meshBounds.minY + meshBounds.maxY) * 0.5;
  const contentHalfW = (meshBounds.maxX - meshBounds.minX) * 0.5;
  const contentHalfH = (meshBounds.maxY - meshBounds.minY) * 0.5;

  let halfW = contentHalfW + VIEW_PAD_WORLD;
  let halfH = halfW / canvasAspect;
  if (halfH < contentHalfH + VIEW_PAD_WORLD) {
    halfH = contentHalfH + VIEW_PAD_WORLD;
    halfW = halfH * canvasAspect;
  }

  halfW *= FRUSTUM_FILL;
  halfH *= FRUSTUM_FILL;

  return { centerX, centerY, halfW, halfH };
}

function createThumbnailCamera(shipGroup, size, isVertical, canvasWidth, canvasHeight) {
  shipGroup.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(shipGroup);
  const lookTarget = box.getCenter(new THREE.Vector3());

  if (isVertical) {
    lookTarget.x -= CELL_WORLD * 0.05;
    lookTarget.y -= CELL_WORLD * 0.035;
    if (size === 4) {
      lookTarget.y -= CELL_WORLD * 0.09;
    }
  }

  const viewOffset = BOARD_VIEW.clone();
  if (isVertical) {
    viewOffset.x = 1.25;
  }
  const eye = lookTarget.clone().add(viewOffset.clone().normalize().multiplyScalar(FIXED_VIEW_DISTANCE));

  if (isVertical && size === 4) {
    eye.y -= CELL_WORLD * 1.24;
  }

  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -80, 80);
  camera.position.copy(eye);
  camera.up.set(0, 1, 0);
  camera.lookAt(lookTarget);

  if (isVertical) {
    camera.rotateZ(THREE.MathUtils.degToRad(7));
  }

  camera.updateMatrixWorld(true);

  const boundsPoints = getBoundsPoints(shipGroup, size);
  const deckPoints = getDeckPoints(shipGroup, size);
  const meshBounds = projectPointsToView(boundsPoints, camera);
  const deckBounds = projectPointsToView(deckPoints, camera);
  const { centerX, centerY, halfW, halfH } = fitFrustumToCanvas(
    deckBounds,
    meshBounds,
    canvasWidth,
    canvasHeight,
    isVertical,
    size,
  );

  camera.left = centerX - halfW;
  camera.right = centerX + halfW;
  camera.top = centerY + halfH;
  camera.bottom = centerY - halfH;
  camera.updateProjectionMatrix();
  return camera;
}

function getRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    configureRenderer(renderer);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }
  return renderer;
}

function ensureModel() {
  if (gltfScene) return Promise.resolve(gltfScene);
  if (!modelLoading) {
    const loader = new GLTFLoader();
    modelLoading = loader.loadAsync(SHIP_MODEL_PATH).then((gltf) => {
      gltfScene = gltf.scene;
      return gltfScene;
    });
  }
  return modelLoading;
}

function renderThumbnail(size, isVertical) {
  const activeRenderer = getRenderer();
  const scene = new THREE.Scene();
  const shipGroup = buildShipPreviewGroup(gltfScene, size, isVertical);
  if (!shipGroup) return null;

  scene.add(shipGroup);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  scene.add(new THREE.HemisphereLight('#eff6ff', '#0c4a6e', 0.65));

  const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
  keyLight.position.set(6, 14, 8);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.28);
  fillLight.position.set(-4, 8, -6);
  scene.add(fillLight);

  const { width, height } = getThumbnailCanvasSize(size, isVertical);
  const camera = createThumbnailCamera(shipGroup, size, isVertical, width, height);

  activeRenderer.setSize(width, height, false);
  activeRenderer.render(scene, camera);

  const url = activeRenderer.domElement.toDataURL('image/png');

  shipGroup.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry?.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material?.dispose());
  });

  return url;
}

function queueThumbnailRender(size, isVertical) {
  const key = thumbnailKey(size, isVertical);
  if (cache.has(key)) {
    return Promise.resolve(cache.get(key));
  }

  const task = renderQueue.then(() => {
    if (cache.has(key)) {
      return cache.get(key);
    }
    const url = renderThumbnail(size, isVertical);
    if (url) {
      cache.set(key, url);
    }
    return url;
  });

  renderQueue = task.catch(() => {});
  return task;
}

export function peekShipThumbnail(size, isVertical) {
  return cache.get(thumbnailKey(size, isVertical)) ?? null;
}

export async function getShipThumbnail(size, isVertical) {
  const cached = peekShipThumbnail(size, isVertical);
  if (cached) {
    return cached;
  }

  await ensureModel();
  return queueThumbnailRender(size, isVertical);
}

export function warmupShipThumbnails(sizes = DEFAULT_SHIP_SIZES) {
  if (!warmupPromise) {
    warmupPromise = ensureModel().then(() => {
      const jobs = sizes.flatMap((size) => [
        queueThumbnailRender(size, true),
        queueThumbnailRender(size, false),
      ]);
      return Promise.all(jobs);
    });
  }
  return warmupPromise;
}

warmupShipThumbnails();

export function preloadShipThumbnails(ships = []) {
  const sizes = [...new Set(ships.map((ship) => ship.size))];
  if (sizes.length === 0) {
    return warmupShipThumbnails();
  }

  return warmupShipThumbnails().then(() => {
    const jobs = sizes.flatMap((size) => [
      queueThumbnailRender(size, true),
      queueThumbnailRender(size, false),
    ]);
    return Promise.all(jobs);
  });
}
