/**
 * Tiny pixel-image toolkit used to build all of the game's art in code.
 * No DOM here, so the art can be generated (and previewed or tested) in plain Node too.
 */

export interface PixelImage {
  width: number;
  height: number;
  /** RGBA bytes, row by row (same layout as canvas ImageData). */
  data: Uint8ClampedArray<ArrayBuffer>;
}

export function createImage(width: number, height: number): PixelImage {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function setPixel(img: PixelImage, x: number, y: number, rgb: number, alpha = 255): void {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  img.data[i] = (rgb >> 16) & 0xff;
  img.data[i + 1] = (rgb >> 8) & 0xff;
  img.data[i + 2] = rgb & 0xff;
  img.data[i + 3] = alpha;
}

export function getRgb(img: PixelImage, x: number, y: number): number {
  const i = (y * img.width + x) * 4;
  return (img.data[i]! << 16) | (img.data[i + 1]! << 8) | img.data[i + 2]!;
}

export function getAlpha(img: PixelImage, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return 0;
  return img.data[(y * img.width + x) * 4 + 3]!;
}

export function fillRect(
  img: PixelImage,
  x: number,
  y: number,
  w: number,
  h: number,
  rgb: number,
  alpha = 255,
): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setPixel(img, xx, yy, rgb, alpha);
}

/**
 * Builds an image from rows of characters. '.' (or ' ') is transparent; every other character
 * must be in the palette. Throws on ragged rows or unknown characters so typos fail loudly.
 */
export function fromAscii(name: string, rows: string[], palette: Record<string, number>): PixelImage {
  const width = rows[0]?.length ?? 0;
  const img = createImage(width, rows.length);
  rows.forEach((row, y) => {
    if (row.length !== width) {
      throw new Error(`Sprite "${name}" row ${y} is ${row.length} wide, expected ${width}`);
    }
    for (let x = 0; x < width; x++) {
      const ch = row[x]!;
      if (ch === '.' || ch === ' ') continue;
      const rgb = palette[ch];
      if (rgb === undefined) throw new Error(`Sprite "${name}" uses unknown palette key "${ch}"`);
      setPixel(img, x, y, rgb);
    }
  });
  return img;
}

/** Same shape, every opaque pixel replaced by one color (used for hit flashes). */
export function silhouette(img: PixelImage, rgb = 0xffffff): PixelImage {
  const out = createImage(img.width, img.height);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const a = getAlpha(img, x, y);
      if (a > 0) setPixel(out, x, y, rgb, a);
    }
  }
  return out;
}

/** Copies `src` onto `dst` at (dx, dy), skipping transparent pixels. */
export function blit(dst: PixelImage, src: PixelImage, dx: number, dy: number): void {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const a = getAlpha(src, x, y);
      if (a > 0) setPixel(dst, dx + x, dy + y, getRgb(src, x, y), a);
    }
  }
}

/** Multiplies an RGB color's channels by `f` (f < 1 darkens, f > 1 lightens). */
export function shade(rgb: number, f: number): number {
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return (ch((rgb >> 16) & 0xff) << 16) | (ch((rgb >> 8) & 0xff) << 8) | ch(rgb & 0xff);
}
