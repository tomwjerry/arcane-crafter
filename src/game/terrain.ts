import type { RegionId } from "./types";

export const WORLD_SIZE = 260;
export const HALF = WORLD_SIZE / 2;
export const SPAWN_X = -15;
export const SPAWN_Z = -15;

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function fade(t: number): number {
  return t * t * (3 - 2 * t);
}

export function noise2(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = fade(xf);
  const v = fade(yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

export function fbm(x: number, y: number, octaves = 4): number {
  let amp = 1;
  let f = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * f, y * f);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Bilinear blend weights for the four quadrants (smooth across the centre). */
export function regionWeights(x: number, z: number) {
  const wx = smoothstep(-11, 11, x);
  const wz = smoothstep(-11, 11, z);
  return {
    greenhollow: (1 - wx) * (1 - wz),
    ironscar: wx * (1 - wz),
    emberfall: wx * wz,
    aethermoor: (1 - wx) * wz,
  };
}

export function regionAt(x: number, z: number): RegionId {
  if (x >= 0) return z >= 0 ? "emberfall" : "ironscar";
  return z >= 0 ? "aethermoor" : "greenhollow";
}

/** Analytic, non-voxel heightfield shared by rendering, physics and AI. */
export function terrainHeight(x: number, z: number): number {
  const w = regionWeights(x, z);

  let h = (fbm(x * 0.012 + 3.7, z * 0.012 + 9.1) - 0.5) * 15;
  h += (fbm(x * 0.05 + 1.3, z * 0.05 + 5.5, 3) - 0.5) * 3.6;

  // Greenhollow: gentle rolling meadow
  h += w.greenhollow * (fbm(x * 0.02 + 5, z * 0.02 + 5, 2) - 0.5) * 4;
  // Ironscar Basin: exposed rocky shelves
  h += w.ironscar * (fbm(x * 0.03 + 40, z * 0.03 + 40, 3) - 0.35) * 16;
  // Emberfall: ridged volcanic spines
  h += w.emberfall * (Math.abs(fbm(x * 0.04 + 77, z * 0.04 + 77, 3) - 0.5) * 20 - 4);
  // Aethermoor: smooth floating plateaus
  h += w.aethermoor * (fbm(x * 0.018 + 13, z * 0.018 + 13, 2) - 0.5) * 11;

  // Flatten the landing meadow so the player always spawns on level ground
  const d = Math.hypot(x - SPAWN_X, z - SPAWN_Z);
  const flat = smoothstep(6, 34, d);
  h *= 0.12 + 0.88 * flat;

  // Rim wall keeps the expedition inside the world without an invisible wall
  const edge = Math.max(Math.abs(x), Math.abs(z));
  const e = Math.max(0, (edge - (HALF - 16)) / 16);
  h += e * e * 55;

  return h;
}

export function terrainSlope(x: number, z: number): number {
  const e = 1.1;
  const dx = (terrainHeight(x + e, z) - terrainHeight(x - e, z)) / (2 * e);
  const dz = (terrainHeight(x, z + e) - terrainHeight(x, z - e)) / (2 * e);
  return Math.hypot(dx, dz);
}

export function terrainNormal(x: number, z: number): [number, number, number] {
  const e = 0.8;
  const dx = terrainHeight(x + e, z) - terrainHeight(x - e, z);
  const dz = terrainHeight(x, z + e) - terrainHeight(x, z - e);
  const nx = -dx;
  const ny = 2 * e;
  const nz = -dz;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

const PALETTE = {
  greenhollow: [0.23, 0.36, 0.19],
  ironscar: [0.35, 0.31, 0.26],
  emberfall: [0.4, 0.2, 0.15],
  aethermoor: [0.3, 0.28, 0.44],
};

/** Vertex colour of the ground: blends the four regions and ages with altitude. */
export function groundTint(x: number, z: number, h: number): [number, number, number] {
  const w = regionWeights(x, z);
  const m = PALETTE;
  let r =
    m.greenhollow[0] * w.greenhollow +
    m.ironscar[0] * w.ironscar +
    m.emberfall[0] * w.emberfall +
    m.aethermoor[0] * w.aethermoor;
  let g =
    m.greenhollow[1] * w.greenhollow +
    m.ironscar[1] * w.ironscar +
    m.emberfall[1] * w.emberfall +
    m.aethermoor[1] * w.aethermoor;
  let b =
    m.greenhollow[2] * w.greenhollow +
    m.ironscar[2] * w.ironscar +
    m.emberfall[2] * w.emberfall +
    m.aethermoor[2] * w.aethermoor;

  // Patchy breakup so large planes never read as flat paint
  const n = fbm(x * 0.09 + 21, z * 0.09 + 44, 3);
  const v = 0.78 + n * 0.44;
  r *= v;
  g *= v;
  b *= v;

  // Bare rock takes over on steep/high ground
  const rock = Math.max(smoothstep(11, 24, h), smoothstep(0.75, 1.35, terrainSlope(x, z)) * 0.75);
  r += (0.42 - r) * rock;
  g += (0.39 - g) * rock;
  b += (0.35 - b) * rock;

  return [Math.min(1, r), Math.min(1, g), Math.min(1, b)];
}
