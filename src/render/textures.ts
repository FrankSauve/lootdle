import { CanvasSource, Texture } from 'pixi.js';
import type { PixelImage } from './art/pixels.ts';

/** Turns a coded pixel image into a texture with nearest-neighbour filtering (crisp pixels). */
export function pixelTexture(img: PixelImage): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext('2d')!.putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
  return new Texture({ source: new CanvasSource({ resource: canvas, scaleMode: 'nearest' }) });
}

/** A soft radial glow (white center fading out), for torch light. Smoothly filtered on purpose. */
export function glowTexture(size: number): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new Texture({ source: new CanvasSource({ resource: canvas, scaleMode: 'linear' }) });
}

/** Darkened corners over the whole view, for a torch-lit dungeon mood. */
export function vignetteTexture(width: number, height: number): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const r = Math.hypot(width, height) / 2;
  const g = ctx.createRadialGradient(width / 2, height / 2, r * 0.45, width / 2, height / 2, r);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  return new Texture({ source: new CanvasSource({ resource: canvas, scaleMode: 'linear' }) });
}
