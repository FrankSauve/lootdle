/**
 * Item icons, drawn in code (no image files). Each is a small pixel image with an automatic
 * dark outline so everything matches. Trinkets are one of a few gem/orb/vial shapes tinted by
 * the effect they carry.
 */
import { createImage, fillRect, fromAscii, setPixel, shade } from './pixels.ts';
import type { PixelImage } from './pixels.ts';
import type { Slot } from '../../sim/items.ts';

const SIZE = 14;
const OUTLINE = 0x14101c;
const STEEL = 0xcfd6e4;
const STEEL_DARK = 0x8d97ab;
const WHITE = 0xffffff;
const GOLD = 0xffc94a;
const GOLD_DARK = 0xc48a1e;
const WOOD = 0x9a6a3a;
const WOOD_DARK = 0x6b4426;

/** Weapon, armor and trinket archetype ids → icon. */
export function itemIcon(slot: Slot, id: string): PixelImage {
  const key = `${slot}:${id}`;
  let img = cache.get(key);
  if (!img) {
    img = outline(draw(slot, id));
    cache.set(key, img);
  }
  return img;
}
const cache = new Map<string, PixelImage>();

function draw(slot: Slot, id: string): PixelImage {
  if (slot === 'weapon') {
    switch (id) {
      case 'dagger': return dagger();
      case 'bow': return bow();
      case 'staff': return staff();
      case 'sword': return sword();
      case 'hammer': return hammer();
      case 'gatling': return gatling();
      case 'scattergun': return scattergun();
      case 'scythe': return scythe();
      case 'gauntlet': return gauntlet();
      case 'cannon': return cannon();
      case 'discs': return discs();
    }
  } else if (slot === 'helmet') {
    switch (id) {
      case 'ironhelm': return helm(0x9aa6c0);
      case 'horned': return helm(0xb89968, 'horns');
      case 'crown': return helm(0xffc94a, 'crown');
      case 'hood': return hood(0x3a3f66);
      case 'circlet': return helm(0x6fa8ff, 'gem');
      case 'mask': return mask();
    }
  } else if (slot === 'boots') {
    switch (id) {
      case 'swiftboots': return boot(0x44a0e8, 'wing');
      case 'greaves': return boot(0x8d97ab);
      case 'spurs': return boot(0x7a4a2a, 'spikes');
      case 'stompers': return boot(0x5a5f73, 'heavy');
      case 'cinder': return boot(0xe0642b, 'flame');
      case 'wanderer': return boot(0x6aa05a);
    }
  } else if (slot === 'armor') {
    switch (id) {
      case 'plate': return chest(0x9aa6c0);
      case 'mail': return chest(0x7d8fa8, true);
      case 'leather': return chest(0xa8743c);
      case 'robe': return robe(0x7a4fc2);
      case 'thornmail': return chest(0x6f7a92, false, true);
      case 'aegis': return shield(0x4a78d0);
    }
  } else {
    switch (id) {
      case 'twinfang': return gem(0xe8e0c8);
      case 'ruby': return gem(0xe5334b);
      case 'hourglass': return hourglass(GOLD);
      case 'idol': return gem(0xd9822b);
      case 'lodestone': return orb(0x8a8fa3);
      case 'vial': return vial(0x5fd35f);
      case 'ember': return orb(0xff6a2b);
      case 'shard': return gem(0xffe14a);
      case 'knuckle': return orb(0xaab4c8);
      case 'tooth': return gem(0xb8283f);
      case 'bomb': return bomb();
      case 'quiver': return quiver();
      case 'core': return orb(0x44e0ff);
      case 'colossus': return gem(0xff9a3d);
    }
  }
  return createImage(SIZE, SIZE);
}

// --- primitives ---

function line(img: PixelImage, x0: number, y0: number, x1: number, y1: number, rgb: number, thick = 1): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  for (;;) {
    fillRect(img, x, y, thick, thick, rgb);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

function disc(img: PixelImage, cx: number, cy: number, r: number, rgb: number): void {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r + r * 0.6) setPixel(img, cx + x, cy + y, rgb);
    }
  }
}

/** Adds a 1-pixel dark outline around every opaque pixel; the result is 2 pixels larger each way. */
function outline(img: PixelImage): PixelImage {
  const out = createImage(img.width + 2, img.height + 2);
  const opaque = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < img.width && y < img.height && img.data[(y * img.width + x) * 4 + 3]! > 0;
  for (let y = -1; y <= img.height; y++) {
    for (let x = -1; x <= img.width; x++) {
      if (opaque(x, y)) {
        const i = (y * img.width + x) * 4;
        setPixel(out, x + 1, y + 1, (img.data[i]! << 16) | (img.data[i + 1]! << 8) | img.data[i + 2]!);
      } else if (opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1)) {
        setPixel(out, x + 1, y + 1, OUTLINE);
      }
    }
  }
  return out;
}

// --- weapons ---

function sword(): PixelImage {
  const i = createImage(SIZE, SIZE);
  line(i, 6, 7, 12, 1, STEEL, 2);
  line(i, 7, 7, 12, 2, WHITE);
  line(i, 3, 6, 7, 10, GOLD, 1);
  line(i, 4, 6, 8, 10, GOLD_DARK, 1);
  line(i, 4, 9, 2, 11, WOOD, 2);
  disc(i, 1, 12, 1, GOLD);
  return i;
}

function dagger(): PixelImage {
  const i = createImage(SIZE, SIZE);
  line(i, 6, 8, 11, 3, STEEL, 2);
  line(i, 7, 8, 11, 4, WHITE);
  line(i, 4, 7, 8, 11, GOLD, 1);
  line(i, 5, 9, 2, 12, WOOD_DARK, 2);
  return i;
}

function bow(): PixelImage {
  const i = createImage(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    const t = (y - 6.5) / 6.5;
    const x = 10 - Math.round(7 * (1 - t * t));
    fillRect(i, x, y, 2, 1, WOOD);
    setPixel(i, x, y, 0xc79053);
  }
  line(i, 10, 0, 10, 13, 0xe8e0d0);
  line(i, 3, 7, 12, 7, STEEL_DARK);
  setPixel(i, 13, 7, STEEL);
  setPixel(i, 12, 6, STEEL);
  setPixel(i, 12, 8, STEEL);
  return i;
}

function staff(): PixelImage {
  const i = createImage(SIZE, SIZE);
  line(i, 2, 12, 8, 6, WOOD, 2);
  line(i, 3, 12, 9, 6, 0xc79053);
  disc(i, 10, 3, 3, 0x4dd0e8);
  disc(i, 10, 3, 2, 0x9cf0ff);
  setPixel(i, 9, 2, WHITE);
  return i;
}

function hammer(): PixelImage {
  const i = createImage(SIZE, SIZE);
  line(i, 2, 12, 8, 6, WOOD, 2);
  line(i, 3, 12, 9, 6, 0xc79053);
  fillRect(i, 6, 1, 7, 5, STEEL_DARK);
  fillRect(i, 6, 1, 7, 2, STEEL);
  fillRect(i, 6, 1, 2, 5, WHITE);
  fillRect(i, 11, 1, 2, 5, 0x6b7388);
  return i;
}

function gatling(): PixelImage {
  const i = createImage(SIZE, SIZE);
  for (const y of [4, 6, 8]) fillRect(i, 1, y, 10, 1, STEEL);
  for (const y of [4, 6, 8]) setPixel(i, 11, y, WHITE);
  fillRect(i, 1, 3, 10, 1, STEEL_DARK);
  fillRect(i, 1, 9, 10, 1, STEEL_DARK);
  fillRect(i, 10, 3, 2, 7, GOLD_DARK);
  fillRect(i, 2, 10, 4, 3, WOOD);
  setPixel(i, 12, 6, 0xffe14a);
  setPixel(i, 13, 5, 0xffe14a);
  return i;
}

function scattergun(): PixelImage {
  const i = createImage(SIZE, SIZE);
  line(i, 1, 11, 9, 5, WOOD, 3);
  line(i, 5, 7, 12, 2, STEEL, 2);
  line(i, 6, 9, 12, 5, STEEL_DARK, 2);
  setPixel(i, 13, 1, 0xffe14a);
  setPixel(i, 13, 4, 0xffe14a);
  setPixel(i, 13, 7, 0xffe14a);
  return i;
}

function scythe(): PixelImage {
  const i = createImage(SIZE, SIZE);
  line(i, 2, 12, 10, 3, WOOD, 2);
  line(i, 6, 2, 12, 4, STEEL, 2);
  line(i, 4, 1, 7, 2, STEEL, 2);
  line(i, 12, 4, 12, 9, STEEL_DARK, 1);
  setPixel(i, 6, 2, WHITE);
  setPixel(i, 8, 2, WHITE);
  return i;
}

function gauntlet(): PixelImage {
  const i = createImage(SIZE, SIZE);
  fillRect(i, 3, 5, 8, 7, 0xb8c0d4);
  fillRect(i, 3, 5, 8, 2, WHITE);
  for (const x of [3, 5, 7, 9]) fillRect(i, x, 2, 2, 4, STEEL_DARK);
  fillRect(i, 2, 11, 10, 2, 0x6b7388);
  fillRect(i, 11, 6, 2, 4, GOLD);
  return i;
}

function cannon(): PixelImage {
  const i = createImage(SIZE, SIZE);
  line(i, 2, 10, 9, 4, 0x555e75, 4);
  line(i, 3, 10, 9, 5, 0x8590aa, 1);
  disc(i, 3, 11, 3, WOOD_DARK);
  disc(i, 11, 3, 2, 0xff7a2b);
  setPixel(i, 11, 3, 0xffe14a);
  return i;
}

function discs(): PixelImage {
  const i = createImage(SIZE, SIZE);
  for (const [cx, cy] of [[4, 4], [9, 9]] as const) {
    disc(i, cx, cy, 3, STEEL);
    disc(i, cx, cy, 1, 0x4a5168);
    setPixel(i, cx - 2, cy - 2, WHITE);
  }
  return i;
}

function quiver(): PixelImage {
  const i = createImage(SIZE, SIZE);
  fillRect(i, 4, 6, 6, 7, WOOD);
  fillRect(i, 4, 6, 2, 7, 0xc79053);
  for (const x of [4, 6, 8]) {
    line(i, x + 1, 1, x + 1, 6, STEEL, 1);
    setPixel(i, x + 1, 0, WHITE);
    setPixel(i, x, 2, 0xe5334b);
  }
  return i;
}

// --- helmets and boots ---

function helm(main: number, extra: 'horns' | 'crown' | 'gem' | null = null): PixelImage {
  const light = shade(main, 1.35);
  const dark = shade(main, 0.6);
  const img = fromAscii('helm', [
    '..............',
    '....aaaaaa....',
    '...alaaaaaa...',
    '..alaaaaaaaa..',
    '..aaaaaaaaaa..',
    '..aaaaaaaaaa..',
    '..adddddddda..',
    '..add.dd.dda..',
    '..aa......aa..',
    '..aa......aa..',
    '..............',
    '..............',
    '..............',
    '..............',
  ], { a: main, l: light, d: dark });
  if (extra === 'horns') {
    for (const [x, y] of [[1, 3], [0, 2], [0, 1], [12, 3], [13, 2], [13, 1]] as const) setPixel(img, x, y, 0xf2ead2);
  } else if (extra === 'crown') {
    for (const x of [3, 6, 9]) fillRect(img, x, 0, 2, 2, 0xffe27a);
  } else if (extra === 'gem') {
    fillRect(img, 6, 3, 2, 2, 0xffe14a);
    setPixel(img, 6, 3, WHITE);
  }
  return img;
}

function hood(main: number): PixelImage {
  const light = shade(main, 1.5);
  const dark = shade(main, 0.6);
  return fromAscii('hood', [
    '.....aaaa.....',
    '....aaaaaa....',
    '...aaaaaaaa...',
    '..aaaddddaaa..',
    '..aaddddddaa..',
    '..aadd..ddaa..',
    '..aadd..ddaa..',
    '..aaadddddaa..',
    '...aaaaaaaa...',
    '....llaaaa....',
    '..............',
    '..............',
    '..............',
    '..............',
  ], { a: main, l: light, d: dark === main ? 0x000000 : 0x14101c });
}

function mask(): PixelImage {
  return fromAscii('mask', [
    '..............',
    '...wwwwwwww...',
    '..wwwwwwwwww..',
    '..wwwwwwwwww..',
    '..wkkwwwwkkw..',
    '..wkkwwwwkkw..',
    '..wwwwddwwww..',
    '...wwwddwww...',
    '...wkwkwkww...',
    '....wwwwww....',
    '..............',
    '..............',
    '..............',
    '..............',
  ], { w: 0xe8e0c8, k: 0x14101c, d: 0xa89f86 });
}

function boot(main: number, extra: 'wing' | 'spikes' | 'heavy' | 'flame' | null = null): PixelImage {
  const light = shade(main, 1.4);
  const dark = shade(main, 0.6);
  const img = fromAscii('boot', [
    '..............',
    '....aaaa......',
    '....alaa......',
    '....aaaa......',
    '....aaaa......',
    '....aaaa......',
    '....aaaaaa....',
    '....aaaaaaaa..',
    '...aaaaaaaaaa.',
    '..aaaaaaaaaaa.',
    '..dddddddddd..',
    '..dddddddddd..',
    '..............',
    '..............',
  ], { a: main, l: light, d: dark });
  if (extra === 'wing') {
    for (const [x, y] of [[2, 3], [1, 2], [2, 2], [1, 4], [2, 4]] as const) setPixel(img, x, y, WHITE);
  } else if (extra === 'spikes') {
    for (const x of [3, 6, 9]) setPixel(img, x, 12, 0xe8e0d0);
    setPixel(img, 8, 5, 0xe8e0d0);
  } else if (extra === 'heavy') {
    fillRect(img, 4, 5, 4, 1, 0x9aa0b5);
  } else if (extra === 'flame') {
    for (const [x, y] of [[9, 5], [10, 4], [9, 3]] as const) setPixel(img, x, y, 0xffc94a);
    setPixel(img, 10, 5, 0xff6a2b);
  }
  return img;
}

// --- armor ---

function chest(main: number, rivets = false, spikes = false): PixelImage {
  const light = shade(main, 1.3);
  const dark = shade(main, 0.65);
  const img = fromAscii('chest', [
    '..lll....lll..',
    '.laaal..laaal.',
    '.laaaallaaaal.',
    '.aaaaaaaaaaaa.',
    '..aaaaaaaaaa..',
    '..aalaaaalaa..',
    '..aaaaaaaaaa..',
    '..dddddddddd..',
    '..aaaaaaaaaa..',
    '..aaaaaaaaaa..',
    '..aaadddaaaa..',
    '...aaaaaaaa...',
    '...aaa..aaa...',
    '..............',
  ], { a: main, l: light, d: dark });
  if (rivets) for (const [x, y] of [[4, 4], [9, 4], [4, 8], [9, 8]] as const) setPixel(img, x, y, light);
  if (spikes) {
    for (const y of [3, 5, 7]) {
      setPixel(img, 0, y, 0xd9dde8);
      setPixel(img, 1, y, 0xd9dde8);
      setPixel(img, 13, y, 0xd9dde8);
      setPixel(img, 12, y, 0xd9dde8);
    }
  }
  return img;
}

function robe(main: number): PixelImage {
  return fromAscii('robe', [
    '....llllll....',
    '...laaaaaal...',
    '..laaaaaaaal..',
    '..aaaallaaaa..',
    '..aaaaaaaaaa..',
    '..aadaaaadaa..',
    '...aaaaaaaa...',
    '...aaaaaaaa...',
    '..aaaaaaaaaa..',
    '..aaaaddaaaa..',
    '.aaaaaddaaaaa.',
    '.aaaaaaaaaaaa.',
    '.dddddddddddd.',
    '..............',
  ], { a: main, l: shade(main, 1.3), d: shade(main, 0.65) });
}

function shield(main: number): PixelImage {
  return fromAscii('shield', [
    '..llllllllll..',
    '.laaaaaaaaaal.',
    '.laaaageeaaal.',
    '.laaagggeaaal.',
    '.laaaageeaaal.',
    '.laaaaageaaal.',
    '.laaaaaaaaaal.',
    '..aaaaaaaaaa..',
    '..aaaaaaaaaa..',
    '...aaaaaaaa...',
    '....aaaaaa....',
    '.....aaaa.....',
    '......aa......',
    '..............',
  ], { a: main, l: shade(main, 1.35), g: GOLD, e: GOLD_DARK });
}

// --- trinkets ---

function gem(tint: number): PixelImage {
  const i = createImage(SIZE, SIZE);
  const light = shade(tint, 1.35);
  const dark = shade(tint, 0.62);
  for (let y = 0; y < SIZE; y++) {
    const half = y < 7 ? 1 + y : 13 - y;
    const row = Math.min(6, half);
    for (let x = 0; x < row * 2; x++) {
      const px = 7 - row + x;
      const c = x < row - 1 && y < 7 ? light : x >= row + 1 ? dark : tint;
      setPixel(i, px, y, c);
    }
  }
  setPixel(i, 5, 3, WHITE);
  return i;
}

function orb(tint: number): PixelImage {
  const i = createImage(SIZE, SIZE);
  disc(i, 7, 7, 6, shade(tint, 0.62));
  disc(i, 6, 6, 5, tint);
  disc(i, 5, 5, 3, shade(tint, 1.3));
  setPixel(i, 4, 4, WHITE);
  setPixel(i, 5, 4, WHITE);
  return i;
}

function vial(tint: number): PixelImage {
  const i = createImage(SIZE, SIZE);
  fillRect(i, 5, 0, 4, 2, WOOD);
  fillRect(i, 6, 2, 2, 3, 0xd8f4ff);
  disc(i, 7, 9, 4, 0xd8f4ff);
  disc(i, 7, 9, 3, shade(tint, 0.7));
  fillRect(i, 4, 8, 7, 4, tint);
  setPixel(i, 5, 7, WHITE);
  setPixel(i, 5, 8, WHITE);
  return i;
}

function hourglass(tint: number): PixelImage {
  const i = createImage(SIZE, SIZE);
  fillRect(i, 2, 0, 10, 2, WOOD);
  fillRect(i, 2, 12, 10, 2, WOOD);
  for (let y = 0; y < 5; y++) {
    fillRect(i, 3 + y, 2 + y, 8 - 2 * y, 1, 0xd8f4ff);
    fillRect(i, 3 + y, 11 - y, 8 - 2 * y, 1, 0xd8f4ff);
  }
  fillRect(i, 6, 5, 2, 2, tint);
  fillRect(i, 5, 10, 4, 2, tint);
  fillRect(i, 6, 8, 2, 2, tint);
  return i;
}

function bomb(): PixelImage {
  const i = orb(0x3a3646);
  line(i, 9, 2, 11, 0, 0xc79053);
  setPixel(i, 12, 0, GOLD);
  setPixel(i, 11, 1, 0xff6a2b);
  return i;
}
