/** A tiny 3x5 pixel font for floating damage numbers, with a dark outline. */
import { createImage, setPixel } from './pixels.ts';
import type { PixelImage } from './pixels.ts';

const GLYPHS = [
  ['###', '#.#', '#.#', '#.#', '###'],
  ['.#.', '##.', '.#.', '.#.', '###'],
  ['###', '..#', '###', '#..', '###'],
  ['###', '..#', '###', '..#', '###'],
  ['#.#', '#.#', '###', '..#', '..#'],
  ['###', '#..', '###', '..#', '###'],
  ['###', '#..', '###', '#.#', '###'],
  ['###', '..#', '..#', '..#', '..#'],
  ['###', '#.#', '###', '#.#', '###'],
  ['###', '#.#', '###', '..#', '###'],
] as const;

const INK = 0x14101c;

/** Digits 0-9, white (tint them at draw time), each 5x7 including the outline. */
export function digitImages(): PixelImage[] {
  return GLYPHS.map((rows) => {
    const img = createImage(5, 7);
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 3; x++) {
        if (rows[y]![x] === '#') {
          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) setPixel(img, x + 1 + ox, y + 1 + oy, INK);
          }
        }
      }
    }
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 3; x++) if (rows[y]![x] === '#') setPixel(img, x + 1, y + 1, 0xffffff);
    }
    return img;
  });
}
