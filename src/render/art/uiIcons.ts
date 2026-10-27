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

// ---------------------------------------------------------------------------------------------
// Stat icons for the upgrade choices (one per UpgradeStat), each 11 pixels wide.

const STAT_ICONS: Record<string, { rows: string[]; palette: Record<string, number> }> = {
  damage: {
    palette: { K: 0x1a1420, W: 0xdfe8ff, w: 0x9aa6c0, Y: 0xffc94a, b: 0x8a5a2b },
    rows: [
      '........KKK',
      '.......KWWK',
      '......KWWK.',
      '.....KWWK..',
      '....KWWK...',
      '.K.KWWK....',
      '.KYKWK.....',
      '..KYK......',
      '.KbKYK.....',
      'KbK.KK.....',
      'KK.........',
    ],
  },
  attackSpeed: {
    palette: { K: 0x1a1420, Y: 0xffe14a, O: 0xff8a2b },
    rows: [
      '....KKKK...',
      '...KYYYK...',
      '..KYYYK....',
      '.KYYYYYK...',
      'KYYYYYYYK..',
      '.KKKYYOK...',
      '...KYYOK...',
      '..KYYOK....',
      '..KYOK.....',
      '..KOK......',
      '..KK.......',
    ],
  },
  maxHp: {
    palette: { K: 0x1a1420, R: 0xe5334b, W: 0xffc0c8 },
    rows: [
      '..KK...KK..',
      '.KRRK.KRRK.',
      'KRWRRKRRRRK',
      'KRRRRRRRRRK',
      'KRRRRRRRRRK',
      '.KRRRRRRRK.',
      '..KRRRRRK..',
      '...KRRRK...',
      '....KRK....',
      '.....K.....',
    ],
  },
  regen: {
    palette: { K: 0x1a1420, G: 0x4cc45a, W: 0xc8ffd0 },
    rows: [
      '...KKKKK...',
      '...KGGGK...',
      '...KGWGK...',
      'KKKKGWGKKKK',
      'KGGGGWGGGGK',
      'KGWWWWWWWGK',
      'KGGGGWGGGGK',
      'KKKKGWGKKKK',
      '...KGWGK...',
      '...KGGGK...',
      '...KKKKK...',
    ],
  },
  range: {
    palette: { K: 0x1a1420, O: 0xff9a3a },
    rows: [
      '...KKKKK...',
      '..KOOOOOK..',
      '.KOKKKKKOK.',
      'KOKOOOOOKOK',
      'KOKOKKKOKOK',
      'KOKOKOKOKOK',
      'KOKOKKKOKOK',
      'KOKOOOOOKOK',
      '.KOKKKKKOK.',
      '..KOOOOOK..',
      '...KKKKK...',
    ],
  },
  moveSpeed: {
    palette: { K: 0x1a1420, C: 0x4dd8ff },
    rows: [
      'KK...KK....',
      'KCK..KCK...',
      '.KCK..KCK..',
      '..KCK..KCK.',
      '...KCK..KCK',
      '..KCK..KCK.',
      '.KCK..KCK..',
      'KCK..KCK...',
      'KK...KK....',
    ],
  },
  armor: {
    palette: { K: 0x1a1420, B: 0x6fa8ff, b: 0x3a6fd9, W: 0xdfe8ff },
    rows: [
      'KKKKKKKKKKK',
      'KBBBBKbbbbK',
      'KBWWBKbbbbK',
      'KBWBBKbbbbK',
      'KBBBBKbbbbK',
      'KKKKKKKKKKK',
      '.KbbbKbbbK.',
      '..KbbKbbK..',
      '...KbKbK...',
      '....KbK....',
      '.....K.....',
    ],
  },
  pierce: {
    palette: { K: 0x1a1420, W: 0xdfe8ff, w: 0x9aa6c0 },
    rows: [
      '.......K...',
      '.......KK..',
      'KKKKKKKKWK.',
      'KWWWWWWWWWK',
      'KKKKKKKKWK.',
      '.......KK..',
      '.......K...',
    ],
  },
  multishot: {
    palette: { K: 0x1a1420, P: 0xc77bff },
    rows: [
      '......K....',
      'KPPPPPPK...',
      '......K....',
      '......K....',
      'KPPPPPPPK..',
      '......K....',
      '......K....',
      'KPPPPPPK...',
      '......K....',
    ],
  },
};

/** The icon for an upgrade stat id (see UpgradeStat). */
export function statIcon(stat: string): PixelImage {
  const def = STAT_ICONS[stat]!;
  return fromAscii(`stat-${stat}`, def.rows, def.palette);
}
