/**
 * Generates the dungeon backdrop in code: flagstone floor with cracks, moss and the odd bone,
 * surrounded by brick walls. Seeded, so it looks the same every time for a given seed.
 */
import { createRng } from '../../sim/rng.ts';
import type { Rng } from '../../sim/rng.ts';
import { createImage, getRgb, setPixel, shade } from './pixels.ts';
import type { PixelImage } from './pixels.ts';

const TILE = 16;
const FLOOR_SHADES = [0x2a2433, 0x2e2738, 0x272130, 0x2c2535];
const MORTAR = 0x16121c;
const MOSS = [0x2f4a2c, 0x3a5a33];
const BONE = 0xbdb3a3;

const BRICK_W = 12;
const BRICK_H = 6;
const BRICK_SHADES = [0x3b3147, 0x433856, 0x3f344e];
const WALL_MORTAR = 0x1d1826;
const WALL_EDGE = 0x0b0810;

export interface Dungeon {
  image: PixelImage;
  /** Torch positions in image pixels (top-left of where each torch sprite is centered). */
  torches: { x: number; y: number }[];
}

/**
 * @param floorWidth  floor size in art pixels
 * @param floorHeight floor size in art pixels
 * @param wall        wall thickness in art pixels on every side
 */
export function generateDungeon(floorWidth: number, floorHeight: number, wall: number, seed: number): Dungeon {
  const rng = createRng(seed);
  const width = floorWidth + wall * 2;
  const height = floorHeight + wall * 2;
  const img = createImage(width, height);

  drawWalls(img, rng);
  drawFloor(img, rng, wall, floorWidth, floorHeight);
  drawWallShadows(img, wall, floorWidth, floorHeight);

  const torches: { x: number; y: number }[] = [];
  for (let x = 96; x < width - 64; x += 160) torches.push({ x, y: wall / 2 });
  for (let y = 120; y < height - 60; y += 150) {
    torches.push({ x: wall / 2, y });
    torches.push({ x: width - wall / 2, y });
  }
  return { image: img, torches };
}

function drawWalls(img: PixelImage, rng: Rng): void {
  const rows = Math.ceil(img.height / BRICK_H);
  const cols = Math.ceil(img.width / BRICK_W) + 1;
  for (let row = 0; row < rows; row++) {
    const offset = row % 2 ? BRICK_W / 2 : 0;
    for (let col = 0; col < cols; col++) {
      const color = BRICK_SHADES[Math.floor(rng() * BRICK_SHADES.length)]!;
      const x0 = col * BRICK_W - offset;
      const y0 = row * BRICK_H;
      for (let y = y0; y < y0 + BRICK_H; y++) {
        for (let x = x0; x < x0 + BRICK_W; x++) {
          const lx = x - x0;
          const ly = y - y0;
          let c = color;
          if (lx === 0 || ly === 0) c = WALL_MORTAR;
          else if (ly === 1) c = shade(color, 1.18);
          else if (ly === BRICK_H - 1) c = shade(color, 0.8);
          setPixel(img, x, y, c);
        }
      }
    }
  }
}

function drawFloor(img: PixelImage, rng: Rng, wall: number, fw: number, fh: number): void {
  const rows = Math.ceil(fh / TILE);
  const cols = Math.ceil(fw / TILE) + 1;
  for (let row = 0; row < rows; row++) {
    const offset = row % 2 ? TILE / 2 : 0;
    for (let col = 0; col < cols; col++) {
      const base = FLOOR_SHADES[Math.floor(rng() * FLOOR_SHADES.length)]!;
      const tx = col * TILE - offset;
      const ty = row * TILE;
      const mossy = rng() < 0.1;
      const cracked = rng() < 0.18;
      const bones = rng() < 0.008;

      for (let ly = 0; ly < TILE; ly++) {
        for (let lx = 0; lx < TILE; lx++) {
          const x = tx + lx;
          const y = ty + ly;
          if (x < 0 || y < 0 || x >= fw || y >= fh) continue;
          let c = base;
          if (lx === 0 || ly === 0) c = MORTAR;
          else if (lx === 1 || ly === 1) c = shade(base, 1.15);
          else if (lx === TILE - 1 || ly === TILE - 1) c = shade(base, 0.82);
          else {
            const n = rng();
            if (n < 0.06) c = shade(base, 0.85);
            else if (n > 0.96) c = shade(base, 1.12);
          }
          if (mossy && (lx <= 2 || ly <= 2) && rng() < 0.35) c = MOSS[Math.floor(rng() * MOSS.length)]!;
          setPixel(img, wall + x, wall + y, c);
        }
      }

      if (cracked) drawCrack(img, rng, wall, tx, ty, fw, fh);
      if (bones) drawBones(img, rng, wall, tx, ty, fw, fh);
    }
  }
}

function drawCrack(img: PixelImage, rng: Rng, wall: number, tx: number, ty: number, fw: number, fh: number): void {
  let x = tx + 3 + Math.floor(rng() * 10);
  let y = ty + 3 + Math.floor(rng() * 10);
  const len = 4 + Math.floor(rng() * 5);
  for (let i = 0; i < len; i++) {
    if (x >= 0 && y >= 0 && x < fw && y < fh) setPixel(img, wall + x, wall + y, MORTAR);
    x += rng() < 0.5 ? 1 : 0;
    y += rng() < 0.6 ? 1 : 0;
  }
}

function drawBones(img: PixelImage, rng: Rng, wall: number, tx: number, ty: number, fw: number, fh: number): void {
  const x = tx + 4 + Math.floor(rng() * 6);
  const y = ty + 5 + Math.floor(rng() * 6);
  const pts = [[0, 0], [1, 0], [2, 0], [3, 0], [0, -1], [0, 1], [3, -1], [3, 1]];
  for (const [dx, dy] of pts) {
    const px = x + dx!;
    const py = y + dy!;
    if (px >= 0 && py >= 0 && px < fw && py < fh) setPixel(img, wall + px, wall + py, BONE);
  }
}

/** Dark edge line where floor meets wall, plus a soft cast shadow from the top wall. */
function drawWallShadows(img: PixelImage, wall: number, fw: number, fh: number): void {
  const darken = (x: number, y: number, f: number) => setPixel(img, x, y, shade(getRgb(img, x, y), f));

  for (let x = wall - 1; x <= wall + fw; x++) {
    setPixel(img, x, wall - 1, WALL_EDGE);
    setPixel(img, x, wall + fh, WALL_EDGE);
  }
  for (let y = wall - 1; y <= wall + fh; y++) {
    setPixel(img, wall - 1, y, WALL_EDGE);
    setPixel(img, wall + fw, y, WALL_EDGE);
  }

  const topShadow = [0.55, 0.65, 0.75, 0.85, 0.92];
  topShadow.forEach((f, i) => {
    for (let x = wall; x < wall + fw; x++) darken(x, wall + i, f);
  });
  const sideShadow = [0.7, 0.85];
  sideShadow.forEach((f, i) => {
    for (let y = wall; y < wall + fh; y++) {
      darken(wall + i, y, f);
      darken(wall + fw - 1 - i, y, f);
    }
  });
}
