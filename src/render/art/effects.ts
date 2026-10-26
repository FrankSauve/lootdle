/** Small coded pixel images for combat effects (magic orbs, melee slashes). */
import { createImage, setPixel } from './pixels.ts';
import type { PixelImage } from './pixels.ts';

/** A glowing arcane orb, `diameter` art pixels across. */
export function orbImage(diameter: number): PixelImage {
  const img = createImage(diameter, diameter);
  const c = (diameter - 1) / 2;
  const r = diameter / 2;
  for (let y = 0; y < diameter; y++) {
    for (let x = 0; x < diameter; x++) {
      const d = Math.hypot(x - c, y - c) / r;
      if (d > 1) continue;
      const color = d > 0.85 ? 0x2a8fb0 : d > 0.6 ? 0x4dd0e8 : d > 0.3 ? 0x9cf0ff : 0xffffff;
      setPixel(img, x, y, color);
    }
  }
  return img;
}

/**
 * A crescent for a melee swing: the leading arc (about +/-70 degrees around +x) of a circle of
 * radius `radius` art pixels. Rotate the sprite to the swing direction.
 */
export function arcImage(radius: number): PixelImage {
  const size = radius * 2 + 2;
  const img = createImage(size, size);
  const c = (size - 1) / 2;
  const thick = Math.max(3, Math.round(radius * 0.22));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - c;
      const dy = y - c;
      const d = Math.hypot(dx, dy);
      if (d > radius || d < radius - thick) continue;
      const a = Math.abs(Math.atan2(dy, dx));
      if (a > 1.2) continue;
      // Brightest on the outer edge and at the middle of the swing.
      const edge = d > radius - 1.5;
      const mid = a < 0.5;
      setPixel(img, x, y, edge ? 0xffffff : mid ? 0xdfe8ff : 0x9aa6c0);
    }
  }
  return img;
}
