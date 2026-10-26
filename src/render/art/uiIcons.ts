/** Small pixel-art icons for the interface, drawn in code. */
import { fromAscii, shade } from './pixels.ts';
import type { PixelImage } from './pixels.ts';

const GEAR = [
  '.....ggg.....',
  '..g..ggg..g..',
  '.ggggggggggg.',
  '..ggggggggg..',
  '.gggg...gggg.',
  'gggg.....gggg',
  'ggg.......ggg',
  'gggg.....gggg',
  '.dddd...dddd.',
  '..ddddddddd..',
  '.ddddddddddd.',
  '..d..ddd..d..',
  '.....ddd.....',
];

/** A cog, 13x13, in the given color (the lower half is a shade darker). */
export function gearIcon(rgb: number): PixelImage {
  return fromAscii('gear', GEAR, { g: rgb, d: shade(rgb, 0.72) });
}
