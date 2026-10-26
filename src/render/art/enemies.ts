/**
 * Pixel art for the newer enemies and bosses, hand-placed as ASCII maps.
 * Bosses are drawn as a left half and mirrored (see mirror()).
 */
import { fromAscii } from './pixels.ts';
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
  M: 0xb8bdd0,
  m: 0x7d8299,
  E: 0xff4d6d,
  S: 0x3a6fd9,
  s: 0x24488f,
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
  };
}
