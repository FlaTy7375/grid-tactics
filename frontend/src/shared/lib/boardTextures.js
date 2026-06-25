import * as THREE from 'three';
import { configureCanvasTexture } from './renderQuality';
import { BOARD_SHADOW_BLUR_PX } from '@shared/config/boardConstants';

const textureCache = new Map();

function getCachedTexture(key, factory) {
  if (!textureCache.has(key)) {
    textureCache.set(key, factory());
  }
  return textureCache.get(key);
}

let volumeTextureSingleton = null;
let shadowTextureSingleton = null;

export function getSharedWaterVolumeTexture() {
  if (!volumeTextureSingleton) {
    volumeTextureSingleton = createWaterVolumeTexture();
  }
  return volumeTextureSingleton;
}

export function getSharedBoardShadowTexture() {
  if (!shadowTextureSingleton) {
    shadowTextureSingleton = createBoardShadowTexture();
  }
  return shadowTextureSingleton;
}

export const BOARD_BG_GRADIENT = {
  from: '#0c4a6e',
  to: '#0284c7',
  angleDeg: 160,
};

export const WATER_PALETTE = {
  deep: '#082f49',
  darker: '#04121f',
};

function paintOriginalWater(ctx, width, height) {
  const base = ctx.createRadialGradient(
    width * 0.45,
    height * 0.4,
    height * 0.08,
    width * 0.5,
    height * 0.5,
    height * 0.72,
  );
  base.addColorStop(0, '#4fc3f7');
  base.addColorStop(0.55, '#0284c7');
  base.addColorStop(1, '#0c4a6e');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const depth = ctx.createLinearGradient(0, height * 0.45, 0, height);
  depth.addColorStop(0, 'rgba(8, 47, 73, 0)');
  depth.addColorStop(1, 'rgba(8, 47, 73, 0.35)');
  ctx.fillStyle = depth;
  ctx.fillRect(0, 0, width, height);
}

function paintBoardVolumeSides(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, height, 0, 0);
  gradient.addColorStop(0, '#03152B');
  gradient.addColorStop(1, '#052347');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

export function createWaterVolumeTexture() {
  const width = 4;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  paintBoardVolumeSides(ctx, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function createWaterTexture(anisotropy = 8) {
  return getCachedTexture(`water:${anisotropy}`, () => {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  paintOriginalWater(ctx, size, size);

  ctx.strokeStyle = 'rgba(224, 242, 254, 0.16)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 5; i += 1) {
    const y = size * (0.22 + i * 0.14);
    ctx.beginPath();
    for (let x = 0; x <= size; x += 8) {
      const wave = Math.sin(x * 0.018 + i * 1.7) * 10 + Math.cos(x * 0.007) * 6;
      if (x === 0) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
  for (let i = 0; i < 18; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 28 + 8;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.55, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(1, 1);
  return configureCanvasTexture(texture, anisotropy);
  });
}

export function createBoardShadowTexture(blurPx = BOARD_SHADOW_BLUR_PX) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const inset = blurPx * 2;
  const shadowColor = 'rgba(20, 25, 36, 0.88)';

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = shadowColor;
  ctx.filter = `blur(${blurPx}px)`;
  ctx.fillRect(inset, inset, size - inset * 2, size - inset * 2);
  ctx.filter = 'none';

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function createCloudPuffTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, 'rgba(176, 188, 204, 0.96)');
  gradient.addColorStop(0.62, 'rgba(176, 188, 204, 0.9)');
  gradient.addColorStop(0.84, 'rgba(176, 188, 204, 0.45)');
  gradient.addColorStop(1, 'rgba(176, 188, 204, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function createGridTexture(gridSize, anisotropy = 8) {
  return getCachedTexture(`grid:${gridSize}:${anisotropy}`, () => {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const step = size / gridSize;
  const lineWidth = Math.max(3, step * 0.11);
  const inset = lineWidth / 2;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'square';

  for (let i = 1; i < gridSize; i += 1) {
    const pos = Math.round(i * step) + 0.5;
    ctx.beginPath();
    ctx.moveTo(pos, inset);
    ctx.lineTo(pos, size - inset);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(inset, pos);
    ctx.lineTo(size - inset, pos);
    ctx.stroke();
  }

  ctx.strokeRect(inset, inset, size - lineWidth, size - lineWidth);

  const texture = new THREE.CanvasTexture(canvas);
  return configureCanvasTexture(texture, anisotropy);
  });
}
