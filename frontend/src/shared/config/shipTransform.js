export const DEFAULT_SHIP_TRANSFORM = {
  lengthFactor: 0.94,
  widthFactor: 0.58,
  heightFactor: 0.36,
  singleCellFit: 0.88,
  singleCellScaleMul: 1,
  yLift: 0.03,
  orientRotation: [-90, 90, 0],
  tuneRotation: [0, 0, 90],
  lengthScaleMul: 1,
  widthScaleMul: 1,
  heightScaleMul: 1,
  size3HeightMul: 1.12,
  size4HeightMul: 1.2,
  modelOffset: [0, 0, 0],
};

export const SHIP_MODEL_PATH = '/pirate_ship.glb';

export function degToRad(value) {
  return (value * Math.PI) / 180;
}

export function radToDeg(value) {
  return (value * 180) / Math.PI;
}

export function resolveShipTransform(override) {
  return { ...DEFAULT_SHIP_TRANSFORM, ...override };
}

export function rotationToRad(rotation) {
  return rotation.map((deg) => degToRad(deg));
}
