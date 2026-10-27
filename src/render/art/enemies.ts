/**
 * Pixel art for the newer enemies and bosses, hand-placed as ASCII maps.
 * Bosses are drawn as a left half and mirrored (see mirror()).
 */
import { fromAscii, scaleNearest } from './pixels.ts';
import type { PixelImage } from './pixels.ts';

const OUTLINE = 0x1a1420;

/** Mirrors the left half of a sprite to make the full, symmetric image. */
function mirror(half: string[]): string[] {
  return half.map((row) => row + [...row].reverse().join(''));
}

// ---------------------------------------------------------------------------------------------
// Rat: small, grey, fast.

const RAT_PALETTE = { K: OUTLINE, G: 0x9a8f9e, g: 0x6b6270, P: 0xf0a0b0, E: 0xff4d6d, N: 0xf0a0b0 };
const RAT = [
  '.KK......KK.',
  'KPPK....KPPK',
  'KPGKKKKKKGPK',
  '.KGGGGGGGGK.',
  '.KGEGGGGEGK.',
  '.KGGGGGGGGK.',
  '..KGGGNNGGK.',
  '..KgGGGGGgK.',
  '...KKKKKKK..',
];

// ---------------------------------------------------------------------------------------------
// Boar: a tusked brown charger.

const BOAR_PALETTE = { K: OUTLINE, B: 0x8a5a2b, b: 0x5e3a1a, E: 0xff4d6d, P: 0xe39a86, W: 0xf3ecff };
const BOAR = [
  '....KKKKKKKK....',
  '..KKBBBBBBBBKK..',
  '.KBBBBBBBBBBBBK.',
  'KBBbBBBBBBBBbBBK',
  'KBBEEBBBBBBEEBBK',
  'KBBBBBBBBBBBBBBK',
  '.KBBBPPPPPPBBBK.',
  '.KBWBPKPPKPBWBK.',
  '.KBWBPPPPPPBWBK.',
  '..KKBBBBBBBBKK..',
  '..KBBKKBBKKBBK..',
  '..KKK.KKKK.KKK..',
];

// ---------------------------------------------------------------------------------------------
// Spitter: a bulging-eyed green toad with an open mouth.

const SPITTER_PALETTE = { K: OUTLINE, G: 0x5fbf4a, g: 0x3a8a34, Y: 0xffe14a, R: 0xb13a5a, L: 0xb6f5b0 };
const SPITTER = [
  '.KKK......KKK.',
  'KYYYK....KYYYK',
  'KYKYKKKKKKYKYK',
  'KGGGGGGGGGGGGK',
  'KGGGGGGGGGGGGK',
  'KGKKKKKKKKKKGK',
  'KGKRRLRRLRRKGK',
  'KGgKKKKKKKKgGK',
  '.KGGGGGGGGGGK.',
  '.KGGKKGGKKGGK.',
  '.KKK......KKK.',
];

// ---------------------------------------------------------------------------------------------
// Bomber: a lit round bomb with angry eyes.

const BOMBER_PALETTE = { K: OUTLINE, D: 0x4a4660, d: 0x2e2a40, W: 0xdfe8ff, R: 0xff4d6d, Y: 0xffe14a, O: 0xff8a2b, b: 0x8a5a2b };
const BOMBER = [
  '.......YO...',
  '......Y.O...',
  '.....Kb.....',
  '...KKKKKK...',
  '..KDDDDDDK..',
  '.KDWWDDDDDK.',
  '.KDWDDDDDDK.',
  '.KDRRDDRRDK.',
  '.KDDDDDDDDK.',
  '.KDDDDDDDdK.',
  '..KDDDDddK..',
  '...KKKKKK...',
];

// ---------------------------------------------------------------------------------------------
// Knight: heavy plate armor with a shield.

const KNIGHT_PALETTE = {
  K: OUTLINE,
  M: 0x6a5a82, // dark violet steel, so it can't be mistaken for the hero
  m: 0x453a5c,
  E: 0xff4d6d,
  S: 0xb13a3a,
  s: 0x7a2020,
  Y: 0xffc94a,
  b: 0x6b4423,
};
const KNIGHT = [
  '.....KKKKKKK.....',
  '....KMMMMMMMK....',
  '...KMMMMMMMMmK...',
  '...KMKKKKKKKmK...',
  '...KMKEKKKEKmK...',
  '...KMMKKKKKMmK...',
  '.KKKKMMMMMMmKKKK.',
  'KSSSSKMMMMmKMMMMK',
  'KSYYSKMMMMmKmMMmK',
  'KSYYSKmMMmmKKbKKK',
  'KSSSSKMMMMmK.b...',
  '.KSsKKMMMMmK.b...',
  '..KKKKmmmmmK.K...',
  '....KMMKKMMK.....',
  '....KmmK.KmmK....',
  '....KKKK.KKKK....',
];

// ---------------------------------------------------------------------------------------------
// Shaman: a hooded healer with a glowing staff.

const SHAMAN_PALETTE = { K: OUTLINE, P: 0x7a3fc2, p: 0x52288f, E: 0x9ff59a, F: 0xe0b48a, b: 0x6b4423, G: 0x5fd35f, W: 0xf3ecff };
const SHAMAN = [
  '.....KKKK..GG',
  '....KPPPPK.GW',
  '...KPPPPPPKbG',
  '...KPKKKKPKb.',
  '...KPKEEKPKb.',
  '...KPPKKPPKb.',
  '..KPPPPPPPKb.',
  '.KPPpPPPPpPKb',
  '.KPPpPPPPpPKb',
  '.KFPPPPPPPPKb',
  '..KPPPPPPPPK.',
  '..KpPPPPPPpK.',
  '..KKKKKKKKKK.',
];

// ---------------------------------------------------------------------------------------------
// Juggernaut: a horned iron colossus (left half, mirrored).

const JUGG_PALETTE = {
  K: OUTLINE,
  I: 0x8a8fa3,
  i: 0x5c6070,
  L: 0xc8ccd8,
  R: 0xff4d6d,
  H: 0xf3ecff,
  h: 0xb8b0a8,
  O: 0xd9822b,
  o: 0x9c5418,
};
const JUGG_HALF = [
  '.HH.......KKKKKKKKKK',
  '.HHK.....KIIIIIIIIII',
  '..HhK...KIIIIILLIIII',
  '...KhKKKKIIIILLIIIII',
  '....KIIIIIIIIIIIIIII',
  '....KIIIIiiIIIIIiiII',
  '....KIIIKKKKKKKKKKKK',
  '....KIIIKRRRRRRRRRRR',
  '.....KIIKKKKKKKKKKKK',
  '..KKKKKIIIIIIIIIIIII',
  '.KOOOOKKIIIIiiiiIIII',
  'KOOooOOKIIIIIIIIIIII',
  'KOooOKIIKIIIIiiIIIII',
  '.KOOKIIIIKIIIIIIIIII',
  '..KKIIIIIIKIIIIiiIII',
  '..KIIIIiiIIKIIIIIIII',
  '.KIIIIIiiIIIKKKKIIII',
  '.KIIIIIIIIIKIIIIIIII',
  '.KIIiiIIIIKiiIIIIIII',
  '..KKIIIIIKIIIIIIIIII',
  '....KIIIIKIIIIiiiIII',
  '....KiiiiKKIIIIIIIII',
  '...KIIIIIIKIIIIIIIII',
  '...KIIIIIIKKKIIIIIII',
  '...KKKKKKKKIIIKKKKKK',
  '..........KKKK......',
];
const JUGGERNAUT = mirror(JUGG_HALF);

// ---------------------------------------------------------------------------------------------
// Hive Queen: a striped insect matriarch with wings and a crown.

const QUEEN_PALETTE = {
  K: OUTLINE,
  Y: 0xffc94a,
  y: 0xc48a1e,
  D: 0x3a2a1a,
  W: 0xcfe8ff,
  w: 0x8fb4e0,
  R: 0xff4d6d,
  C: 0xffe14a,
  G: 0x5fd35f,
};
const QUEEN_HALF = [
  '..............C.CCCC',
  '..............CCCCCC',
  '.......KKKK...KCCRCC',
  '.....KKYYYYKKKKYYYYY',
  '.WWWKYYYYYYYYYYYYYYY',
  'KWwWWKYYYYYYYYYYYYYY',
  'KWWwWWKYYYKKYYYYYYYY',
  'KWwWWWWKYYKGKYYYYYYY',
  'KWWwWWWKYYKKKYYYYYYY',
  '.KWWwWWKYYYYYYYYKKKK',
  '..KKWWWKYYyyYYYyyYYY',
  '....KKKKKYYYYKKKKYYY',
  '.......KYYYYKDDDDKYY',
  '.......KDDDDDDDDDDDK',
  '......KYYYYYYYYYYYYY',
  '......KYYyyyyyyyyyyy',
  '.....KDDDDDDDDDDDDDD',
  '.....KYYYYYYYYYYYYYY',
  '.....KYYyyyyyyyyyyyy',
  '......KDDDDDDDDDDDDD',
  '......KYYYYYYYYYYYYY',
  '.......KYYyyyyyyyyyy',
  '........KKYYYYYYYYYY',
  '..........KKKKKKYYYY',
  '...............KKKKK',
];
const HIVE_QUEEN = mirror(QUEEN_HALF);

// ---------------------------------------------------------------------------------------------
// Lich: a crowned skull in tattered robes with glowing eyes.

const LICH_PALETTE = {
  K: OUTLINE,
  B: 0xe9e4d4,
  b: 0xb3ab94,
  E: 0x7dffb0,
  C: 0xffc94a,
  c: 0xc48a1e,
  P: 0x4b2a7a,
  p: 0x2e1a52,
  V: 0x9a5fe0,
  G: 0x7dffb0,
};
const LICH_HALF = [
  '..........C.C.CCCCCC',
  '..........CCCCCCCCCC',
  '..........KcCcCcCcCc',
  '.......KKKKBBBBBBBBB',
  '......KBBBBBBBBBBBBB',
  '.....KBBBBBBBBBBBBBB',
  '.....KBBKKKKBBBBBBBB',
  '.....KBBKEEKBBBBBBBB',
  '.....KBBKEEKBBBBBBBB',
  '.....KbBBBBBBBBBBKKK',
  '......KbBBBBBBBBBBBB',
  '.......KBBKKBBKKBBKK',
  '.......KKBBBBBBBBBBB',
  '.....KKKKKKKKKKKKKKK',
  '...KKPPPPPPPPPPPPPPP',
  '..KPPPPPPVVPPPPPPPPP',
  '.KPPPPPPPPVVPPPPPPPP',
  '.KPPpPPPPPPPPPPPPPPP',
  'KPPPpPPPPPPPPpPPPPPP',
  'KPPPPPPPPPPPPpPPPPPP',
  'KPPpPPPPpPPPPPPPPPPP',
  'KPPPPPPPpPPPPPPPpPPP',
  'KPpPPPpPPPPPPPPPpPPP',
  'KPPPPPPPPPpPPPPPPPPP',
  'KKPPKPPPPPPKPPPPKPPP',
  '.KK.KKPPKK.KKPPKK.KK',
];
const LICH = mirror(LICH_HALF);

// ---------------------------------------------------------------------------------------------
// Dragon: a huge winged red dragon seen from above, drawn procedurally as a left half and mirrored.
// Two frames flap its wings.

const DRAGON_PALETTE = {
  K: OUTLINE,
  R: 0xc23a2b,
  r: 0x7a1f1a,
  O: 0xf2a03a,
  o: 0xc4701e,
  H: 0xf3ecff,
  E: 0xffe14a,
  W: 0x8a2a3a,
  w: 0x5a1a28,
  T: 0xffffff,
  F: 0xff7a2b,
};

function dragonHalf(flapUp: boolean): string[] {
  const W = 34;
  const H = 40;
  const g: string[][] = Array.from({ length: H }, () => Array<string>(W).fill('.'));
  const put = (x: number, y: number, c: string) => {
    if (x >= 0 && x < W && y >= 0 && y < H) g[y]![x] = c;
  };
  const ellipse = (cx: number, cy: number, rx: number, ry: number, c: string) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) put(x, y, c);
      }
    }
  };
  const line = (x0: number, y0: number, x1: number, y1: number, c: string) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let s = 0; s <= steps; s++) put(Math.round(x0 + ((x1 - x0) * s) / steps), Math.round(y0 + ((y1 - y0) * s) / steps), c);
  };
  const tri = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: string) => {
    const sign = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) =>
      (px - rx) * (qy - ry) - (qx - rx) * (py - ry);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d1 = sign(x, y, ax, ay, bx, by);
        const d2 = sign(x, y, bx, by, cx, cy);
        const d3 = sign(x, y, cx, cy, ax, ay);
        const neg = d1 < 0 || d2 < 0 || d3 < 0;
        const pos = d1 > 0 || d2 > 0 || d3 > 0;
        if (!(neg && pos)) put(x, y, c);
      }
    }
  };

  // Wing: a membrane between three finger bones fanned out from the shoulder.
  const sx = 25;
  const sy = 17;
  const tipY = flapUp ? 2 : 10;
  const midY = flapUp ? 10 : 18;
  const lowY = flapUp ? 24 : 30;
  tri(sx, sy, 0, tipY, 3, midY, 'W');
  tri(sx, sy, 3, midY, 5, lowY, 'W');
  tri(sx, sy, 5, lowY, 17, lowY + 4, 'W');
  // Darker lower membrane for depth.
  tri(sx, sy + 1, 3, midY + 1, 5, lowY, 'w');
  line(sx, sy, 0, tipY, 'r');
  line(sx, sy, 3, midY, 'r');
  line(sx, sy, 5, lowY, 'r');
  line(sx, sy, 17, lowY + 4, 'r');
  tri(0, tipY, 3, tipY - 3, 3, tipY + 1, 'H');

  // Tail: tapering to the bottom.
  for (let y = 28; y < H; y++) {
    const half = Math.max(1, Math.round(5 - (y - 28) * 0.45));
    for (let x = 33 - half; x < W; x++) put(x, y, y % 4 === 0 ? 'r' : 'R');
  }
  tri(33, 39, 31, 35, 33, 35, 'H');

  // Body, belly plates and back ridge.
  ellipse(31, 21, 8, 11, 'R');
  for (let y = 13; y < 32; y++) {
    const band = (y - 13) % 3 === 0;
    for (let x = 29; x < W; x++) put(x, y, band ? 'o' : 'O');
  }
  for (let y = 12; y < 32; y += 4) {
    put(23, y, 'r');
    put(24, y + 1, 'r');
  }

  // Legs with claws.
  ellipse(23, 26, 3, 3, 'R');
  line(21, 29, 20, 32, 'T');
  line(23, 29, 23, 33, 'T');
  line(25, 29, 26, 32, 'T');
  ellipse(24, 15, 3, 3, 'R');

  // Neck and head with horns, eyes and a toothy snout.
  ellipse(31, 11, 5, 4, 'R');
  ellipse(31, 6, 7, 5, 'R');
  ellipse(31, 2, 4, 3, 'R');
  tri(27, 4, 20, 0, 25, 6, 'H');
  tri(27, 3, 24, 0, 28, 1, 'H');
  put(27, 5, 'E');
  put(28, 5, 'E');
  put(27, 6, 'K');
  put(29, 1, 'K');
  for (const x of [27, 29, 31, 33]) put(x, 0, 'T');
  put(33, 3, 'F');
  put(32, 2, 'F');

  // Dark outline around everything.
  const out = g.map((row) => row.slice());
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (g[y]![x] !== '.') continue;
      const near = [g[y - 1]?.[x], g[y + 1]?.[x], g[y]![x - 1], g[y]![x + 1]];
      if (near.some((c) => c !== undefined && c !== '.')) out[y]![x] = 'K';
    }
  }
  return out.map((row) => row.join(''));
}

export interface EnemyArt {
  rat: PixelImage;
  boar: PixelImage;
  spitter: PixelImage;
  bomber: PixelImage;
  knight: PixelImage;
  shaman: PixelImage;
  juggernaut: PixelImage;
  hiveQueen: PixelImage;
  lich: PixelImage;
  dragon: PixelImage[];
}

export function buildEnemyArt(): EnemyArt {
  return {
    rat: fromAscii('rat', RAT, RAT_PALETTE),
    boar: fromAscii('boar', BOAR, BOAR_PALETTE),
    spitter: fromAscii('spitter', SPITTER, SPITTER_PALETTE),
    bomber: fromAscii('bomber', BOMBER, BOMBER_PALETTE),
    knight: fromAscii('knight-armor', KNIGHT, KNIGHT_PALETTE),
    shaman: fromAscii('shaman', SHAMAN, SHAMAN_PALETTE),
    juggernaut: fromAscii('juggernaut', JUGGERNAUT, JUGG_PALETTE),
    hiveQueen: fromAscii('hive-queen', HIVE_QUEEN, QUEEN_PALETTE),
    lich: fromAscii('lich', LICH, LICH_PALETTE),
    dragon: [true, false].map((up) =>
      scaleNearest(fromAscii('dragon', mirror(dragonHalf(up)), DRAGON_PALETTE), 2),
    ),
  };
}
