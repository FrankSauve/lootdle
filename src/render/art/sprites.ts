/**
 * All character art, drawn in code: hand-placed pixels (ASCII maps) for most sprites and small
 * procedural generators for slimes, shadows and glows. One art pixel = 2 simulation units.
 */
import { createImage, fillRect, fromAscii, getAlpha, getRgb, setPixel, shade } from './pixels.ts';
import type { PixelImage } from './pixels.ts';
import { buildEnemyArt } from './enemies.ts';

const OUTLINE = 0x1a1420;

// ---------------------------------------------------------------------------------------------
// Player: a small knight with a plumed helmet, gold cloak and a sword on the right side.

const KNIGHT_PALETTE = {
  K: OUTLINE,
  R: 0xd9412b, // plume
  H: 0xc8ccd8, // helmet
  h: 0x8a8fa3, // helmet shade
  V: 0x2a2433, // visor slit
  Y: 0xffc94a, // gold cloak / crossguard
  y: 0xc48a1e, // cloak shade
  B: 0x9aa0b5, // armor
  b: 0x6b4423, // boots / sword grip
  W: 0xdfe8ff, // blade
};

const KNIGHT = [
  '.....RR.......',
  '....KKKK......',
  '...KHHHHK.....',
  '..KHHHHHhK..W.',
  '..KHVVVVhK..W.',
  '..KHHHHHhK..W.',
  '...KKKKKK...W.',
  '..KYBBBBYK.YYY',
  '.KYYBBBBYyKKb.',
  '.KYyBBBBYyK.b.',
  '..KYBBBBYK....',
  '..KBBKKBBK....',
  '..KbbKKbbK....',
  '..KKK..KKK....',
];

// ---------------------------------------------------------------------------------------------
// Chaser: a horned red imp.

const IMP_PALETTE = {
  K: OUTLINE,
  R: 0xe5534b,
  r: 0x9e2b33,
  E: 0xffe14a,
  W: 0xf3ecff,
};

const IMP = [
  '.K........K.',
  '.KK......KK.',
  '.KRK....KRK.',
  '..KRKKKKRK..',
  '..KRRRRRRK..',
  '.KRERRRRERK.',
  '.KRRRRRRRRK.',
  '.KRrWrrWrRK.',
  '..KRrrrrRK..',
  '..KRRRRRRK..',
  '.KRrK..KrRK.',
  '.KKK....KKK.',
];

// ---------------------------------------------------------------------------------------------
// Flanker: a purple bat with two wing frames.

const BAT_PALETTE = {
  K: OUTLINE,
  P: 0xb15ee8,
  p: 0x6c2f9e,
  E: 0xff4d6d,
};

const BAT_UP = [
  '.KK........KK.',
  'KPPK......KPPK',
  'KPpPK.KK.KPpPK',
  '.KPpPKPPKPpPK.',
  '..KPPEPPEPPK..',
  '...KPPPPPPK...',
  '....KPPPPK....',
  '.....KKKK.....',
];

const BAT_DOWN = [
  '.....KKKK.....',
  '....KPPPPK....',
  '...KPEPPEPK...',
  '.KKKPPPPPPKKK.',
  'KPPPPPPPPPPPPK',
  'KPpPPKPPKPPpPK',
  'KPpK.KKKK.KpPK',
  '.KK........KK.',
];

// ---------------------------------------------------------------------------------------------
// Brute: an armored orc with tusks.

const ORC_PALETTE = {
  K: OUTLINE,
  O: 0xd9822b,
  o: 0x9c5418,
  M: 0x8a8fa3,
  m: 0x5c6070,
  E: 0xffe14a,
  W: 0xf3ecff,
};

const ORC = [
  '......KKKKKKKK......',
  '.....KMMMMMMMMK.....',
  '....KMMmMMMMmMMK....',
  '....KMMMMMMMMMMK....',
  '....KOOOOOOOOOOK....',
  '....KOEEOOOOEEOK....',
  '....KOOOOOOOOOOK....',
  '....KOWOooooOWOK....',
  '.....KOOOOOOOOK.....',
  '..KKKKMMMMMMMMKKKK..',
  '.KOOKMMmMMMMmMMKOOK.',
  'KOOoKMMMMMMMMMMKoOOK',
  'KOOoKMMmMMMMmMMKoOOK',
  'KOOKKMMMMMMMMMMKKOOK',
  '.KK.KooooooooooK.KK.',
  '....KooooKKooooK....',
  '....KMMMK..KMMMK....',
  '....KmmmK..KmmmK....',
  '....KKKKK..KKKKK....',
];

// ---------------------------------------------------------------------------------------------
// Thrown knife (points right; rotated in the renderer).

const KNIFE = ['...Y.....', 'bbbYWWWWw', '...Y.....'];
const KNIFE_PALETTE = { W: 0xdfe8ff, w: 0x9aa6c0, b: 0x8a5a2b, Y: 0xffc94a };

// ---------------------------------------------------------------------------------------------
// Wall torch with two flame frames.

const TORCH_PALETTE = {
  O: 0xff8a2b,
  Y: 0xffe14a,
  W: 0xfff6c0,
  M: 0x8a8fa3,
  b: 0x6b4423,
};

const TORCH_A = ['..O..', '.OYO.', '.YWY.', '..Y..', '.MMM.', '..b..', '..b..', '..b..'];
const TORCH_B = ['...O.', '.OYO.', '.YWY.', '..Y..', '.MMM.', '..b..', '..b..', '..b..'];

// ---------------------------------------------------------------------------------------------
// Slimes are generated: a shaded dome with an outline, eyes, and optionally a crown.

interface SlimeOptions {
  body: number;
  /** Width and height of the dome in art pixels (before the 1-pixel outline margin). */
  width: number;
  height: number;
  eyeWidth: number;
  eyeHeight: number;
  crown?: boolean;
  /** Second animation frame: wider and flatter. */
  squash?: boolean;
}

const CROWN = ['Y.....Y.....Y', 'YY...YYY...YY', 'YYYYYYYYYYYYY', 'YRYYYRYRYYYRY'];
const CROWN_PALETTE = { Y: 0xffc94a, R: 0xd9412b };

function slime(o: SlimeOptions): PixelImage {
  const crownRows = o.crown ? CROWN.length - 1 : 0;
  const W = o.width + 4;
  const H = o.height + 1 + crownRows;
  const img = createImage(W, H);

  const bw = o.squash ? o.width + 2 : o.width;
  const bh = o.squash ? o.height - 2 : o.height;
  const cx = W / 2;
  const baseY = H - 1;
  const light = shade(o.body, 1.35);
  const dark = shade(o.body, 0.7);

  const inside = (x: number, y: number) => {
    const dx = (x + 0.5 - cx) / (bw / 2);
    const dy = (y + 0.5 - baseY) / bh;
    return y <= baseY && dy <= 0 && dx * dx + dy * dy <= 1;
  };

  // Body with simple top-left lighting.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!inside(x, y)) continue;
      const dx = (x + 0.5 - cx) / (bw / 2);
      const dy = (y + 0.5 - baseY) / bh;
      const r = dx * dx + dy * dy;
      let c = o.body;
      if ((r > 0.55 && dx > 0.2) || dy > -0.12) c = dark;
      else if (dx < -0.25 && dy < -0.45 && r < 0.75) c = light;
      setPixel(img, x, y, c);
    }
  }

  // Outline: transparent pixels that touch the body.
  const body = createImage(W, H);
  body.data.set(img.data);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (getAlpha(body, x, y)) continue;
      if (getAlpha(body, x - 1, y) || getAlpha(body, x + 1, y) || getAlpha(body, x, y - 1) || getAlpha(body, x, y + 1)) {
        setPixel(img, x, y, OUTLINE);
      }
    }
  }

  // Shine spot.
  const sx = Math.round(cx - bw * 0.28);
  const sy = Math.round(baseY - bh * 0.72);
  setPixel(img, sx, sy, 0xffffff);
  setPixel(img, sx + 1, sy, 0xffffff);
  setPixel(img, sx, sy + 1, 0xffffff);

  // Eyes with a glint.
  const eyeY = Math.round(baseY - bh * 0.5);
  for (const side of [-1, 1]) {
    const ex = Math.round(cx + side * bw * 0.18 - o.eyeWidth / 2);
    fillRect(img, ex, eyeY, o.eyeWidth, o.eyeHeight, OUTLINE);
    setPixel(img, ex, eyeY, 0xffffff);
  }

  if (o.crown) {
    // A grumpy mouth for the boss.
    const mouthY = eyeY + o.eyeHeight + 2;
    const mouthW = Math.round(bw * 0.22);
    const mx = Math.round(cx - mouthW / 2);
    fillRect(img, mx + 1, mouthY, mouthW - 2, 1, OUTLINE);
    setPixel(img, mx, mouthY + 1, OUTLINE);
    setPixel(img, mx + mouthW - 1, mouthY + 1, OUTLINE);

    const crown = fromAscii('crown', CROWN, CROWN_PALETTE);
    const top = baseY - bh; // first row of the dome
    const crownX = Math.round(cx - crown.width / 2);
    const crownY = top - crownRows + 1;
    for (let y = 0; y < crown.height; y++) {
      for (let x = 0; x < crown.width; x++) {
        if (getAlpha(crown, x, y)) setPixel(img, crownX + x, crownY + y, getRgb(crown, x, y));
      }
    }
  }
  return img;
}

/** A flat pixel ellipse, used as a drop shadow (opacity is set by the sprite). */
function ellipse(width: number, height: number): PixelImage {
  const img = createImage(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (x + 0.5 - width / 2) / (width / 2);
      const dy = (y + 0.5 - height / 2) / (height / 2);
      if (dx * dx + dy * dy <= 1) setPixel(img, x, y, 0x000000);
    }
  }
  return img;
}

// ---------------------------------------------------------------------------------------------

export interface SpriteArt {
  /** Animation frames. */
  frames: PixelImage[];
  /** Drop-shadow width in art pixels. */
  shadowWidth: number;
}

export interface ArtCatalog {
  player: SpriteArt;
  chaser: SpriteArt;
  flanker: SpriteArt;
  brute: SpriteArt;
  slimelet: SpriteArt;
  giantSlime: SpriteArt;
  rat: SpriteArt;
  boar: SpriteArt;
  spitter: SpriteArt;
  bomber: SpriteArt;
  knight: SpriteArt;
  shaman: SpriteArt;
  juggernaut: SpriteArt;
  hiveQueen: SpriteArt;
  lich: SpriteArt;
  knife: PixelImage;
  torch: PixelImage[];
  /** 1x1 white pixel for particles. */
  pixel: PixelImage;
  shadows: Map<number, PixelImage>;
}

export function buildArtCatalog(): ArtCatalog {
  const slimeletBase = { body: 0x6fd36a, width: 12, height: 10, eyeWidth: 1, eyeHeight: 2 };
  const giantBase = { body: 0x3fbf5a, width: 44, height: 32, eyeWidth: 3, eyeHeight: 4, crown: true };

  const more = buildEnemyArt();
  const art: Omit<ArtCatalog, 'shadows'> = {
    player: { frames: [fromAscii('knight', KNIGHT, KNIGHT_PALETTE)], shadowWidth: 10 },
    chaser: { frames: [fromAscii('imp', IMP, IMP_PALETTE)], shadowWidth: 9 },
    flanker: {
      frames: [fromAscii('bat-up', BAT_UP, BAT_PALETTE), fromAscii('bat-down', BAT_DOWN, BAT_PALETTE)],
      shadowWidth: 8,
    },
    brute: { frames: [fromAscii('orc', ORC, ORC_PALETTE)], shadowWidth: 16 },
    slimelet: {
      frames: [slime(slimeletBase), slime({ ...slimeletBase, squash: true })],
      shadowWidth: 14,
    },
    giantSlime: {
      frames: [slime(giantBase), slime({ ...giantBase, squash: true })],
      shadowWidth: 46,
    },
    rat: { frames: [more.rat], shadowWidth: 8 },
    boar: { frames: [more.boar], shadowWidth: 16 },
    spitter: { frames: [more.spitter], shadowWidth: 13 },
    bomber: { frames: [more.bomber], shadowWidth: 11 },
    knight: { frames: [more.knight], shadowWidth: 15 },
    shaman: { frames: [more.shaman], shadowWidth: 11 },
    juggernaut: { frames: [more.juggernaut], shadowWidth: 40 },
    hiveQueen: { frames: [more.hiveQueen], shadowWidth: 36 },
    lich: { frames: [more.lich], shadowWidth: 38 },
    knife: fromAscii('knife', KNIFE, KNIFE_PALETTE),
    torch: [fromAscii('torch-a', TORCH_A, TORCH_PALETTE), fromAscii('torch-b', TORCH_B, TORCH_PALETTE)],
    pixel: (() => {
      const p = createImage(1, 1);
      setPixel(p, 0, 0, 0xffffff);
      return p;
    })(),
  };

  const shadows = new Map<number, PixelImage>();
  for (const s of [
    art.player, art.chaser, art.flanker, art.brute, art.slimelet, art.giantSlime,
    art.rat, art.boar, art.spitter, art.bomber, art.knight, art.shaman, art.juggernaut, art.hiveQueen, art.lich,
  ]) {
    if (!shadows.has(s.shadowWidth)) {
      shadows.set(s.shadowWidth, ellipse(s.shadowWidth, Math.max(3, Math.round(s.shadowWidth * 0.35))));
    }
  }
  return { ...art, shadows };
}
