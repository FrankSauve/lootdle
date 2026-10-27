import { itemIcon } from '../render/art/icons.ts';
import type { PixelImage } from '../render/art/pixels.ts';
import { ARMORS, RARITY_COLORS, RARITY_NAMES, SYNERGIES, TRINKETS, WEAPONS } from '../sim/items.ts';
import type { Item } from '../sim/items.ts';
import { describeItem, loadoutItems } from '../sim/loot.ts';
import type { Loadout } from '../sim/loot.ts';

/** Height of one reel cell in CSS pixels (keep in sync with .reel-cell in style.css). */
const CELL_H = 132;
const POOLS = { weapon: WEAPONS, armor: ARMORS, trinket: TRINKETS } as const;
/** Reel i spins for this long (ms) before it lands; they land one after another. */
const reelDuration = (i: number) => 1500 + i * 700;
const reelCells = (i: number) => 24 + i * 8;
const easeOutBack = (p: number) => {
  const c1 = 0.9;
  const c3 = c1 + 1;
  return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2;
};

const SLOT_LABELS = { weapon: 'Weapon', armor: 'Armor', trinket: 'Trinket' } as const;

export function cssColor(rgb: number): string {
  return `#${rgb.toString(16).padStart(6, '0')}`;
}

/** A pixel-art canvas of the item's icon, scaled up with crisp edges by CSS. */
export function itemIconCanvas(item: Item, scale: number): HTMLCanvasElement {
  return imageCanvas(itemIcon(item.slot, item.id), scale);
}

/** Draws a coded pixel image onto a canvas, scaled up with crisp edges by CSS. */
export function imageCanvas(img: PixelImage, scale: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.style.width = `${img.width * scale}px`;
  canvas.style.height = `${img.height * scale}px`;
  canvas.className = 'item-icon';
  canvas.getContext('2d')!.putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
  return canvas;
}

/**
 * The "Today's loot" reveal shown before each run: the three items are revealed one after
 * another, then the build name. Starting the run (moving) is handled by the caller.
 */
export class LootPanel {
  private readonly root: HTMLElement;
  private readonly cards: HTMLElement;
  private readonly build: HTMLElement;
  private readonly synergies: HTMLElement;
  private readonly go: HTMLElement;
  private readonly date: HTMLElement;
  /** Bumped whenever the panel is shown or hidden, to cancel a spin in progress. */
  private token = 0;
  private spinKey: ((e: KeyboardEvent) => void) | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'loot-overlay';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="loot-panel">
        <div class="loot-head"><span>Today's loot</span> <span class="loot-date"></span></div>
        <div class="loot-cards"></div>
        <div class="loot-synergies"></div>
        <div class="loot-build"></div>
        <div class="loot-go">Move with <b>WASD</b> or <b>arrow keys</b> to begin</div>
      </div>
    `;
    parent.appendChild(this.root);
    this.cards = this.root.querySelector<HTMLElement>('.loot-cards')!;
    this.build = this.root.querySelector<HTMLElement>('.loot-build')!;
    this.synergies = this.root.querySelector<HTMLElement>('.loot-synergies')!;
    this.go = this.root.querySelector<HTMLElement>('.loot-go')!;
    this.date = this.root.querySelector<HTMLElement>('.loot-date')!;
  }

  /**
   * Shows today's loot. Without `spin` the three cards are revealed one after another and the
   * return value is how many milliseconds that takes. With `spin` the player first gets a slot
   * machine: they press Spin, the reels land one at a time, and then the cards are revealed;
   * the return value is Infinity and `onReady` is called once the reveal has finished.
   */
  show(loadout: Loadout, dateLabel: string, spin = false, onReady?: () => void): number {
    this.token++;
    this.clearSpinKey();
    this.root.querySelector('.loot-spin')?.remove();
    this.go.hidden = false;
    this.date.textContent = dateLabel;
    if (spin) {
      this.startSlotMachine(loadout, onReady);
      return Infinity;
    }
    return this.revealCards(loadout);
  }

  /** The cards, synergies, build name and prompt, revealed on a timeline. Returns its length in ms. */
  private revealCards(loadout: Loadout): number {
    this.root.classList.remove('spinning');
    this.cards.replaceChildren(
      ...loadoutItems(loadout).map((item, i) => this.card(item, 0.25 + i * 0.6)),
    );

    // Synergies pop in one by one after the three cards, then the build name, then the prompt.
    let t = 2.0;
    this.synergies.replaceChildren(
      ...loadout.synergies.map((id) => {
        const def = SYNERGIES[id];
        const row = document.createElement('div');
        row.className = 'loot-synergy';
        row.style.setProperty('--delay', `${t}s`);
        t += 0.45;
        const title = document.createElement('b');
        title.textContent = `Synergy: ${def.title}`;
        row.append(title, document.createTextNode(` ${def.text}`));
        return row;
      }),
    );
    this.build.style.setProperty('--delay', `${t}s`);
    this.go.style.setProperty('--delay', `${t + 0.4}s`);
    this.build.textContent = loadout.buildName;
    this.build.style.setProperty('--rarity', cssColor(RARITY_COLORS[loadout.bestRarity]));
    this.root.dataset['flash'] = String(loadout.bestRarity);

    // Re-trigger the CSS reveal animation.
    this.root.hidden = true;
    void this.root.offsetWidth;
    this.root.hidden = false;
    return Math.min(3200, (t + 0.5) * 1000);
  }

  // ---- Slot machine -------------------------------------------------------------------------

  private startSlotMachine(loadout: Loadout, onReady?: () => void): void {
    const token = this.token;
    this.root.classList.add('spinning');
    this.root.dataset['flash'] = '';
    this.synergies.replaceChildren();
    this.build.textContent = '';

    const items = loadoutItems(loadout);
    const strips: HTMLElement[] = [];
    const reels: HTMLElement[] = [];
    const cols = items.map((item, i) => {
      const col = document.createElement('div');
      col.className = 'slot-col';
      const label = document.createElement('div');
      label.className = 'loot-slot';
      label.textContent = SLOT_LABELS[item.slot];
      const reel = document.createElement('div');
      reel.className = 'reel';
      const strip = document.createElement('div');
      strip.className = 'reel-strip';

      // Cell 0 is a question mark, the last cell is the real item, the rest are random decoys.
      const cells: HTMLElement[] = [];
      const q = document.createElement('div');
      q.className = 'reel-cell reel-unknown';
      q.textContent = '?';
      cells.push(q);
      const pool = POOLS[item.slot];
      for (let k = 1; k < reelCells(i) - 1; k++) {
        const decoy = pool[Math.floor(Math.random() * pool.length)]!;
        cells.push(this.reelCell(item.slot, decoy.id, null));
      }
      cells.push(this.reelCell(item.slot, item.id, item.rarity));
      strip.append(...cells);
      reel.appendChild(strip);
      col.append(label, reel);
      strips.push(strip);
      reels.push(reel);
      return col;
    });
    this.cards.replaceChildren(...cols);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'loot-spin';
    button.textContent = 'SPIN';
    this.go.hidden = true;
    this.cards.after(button);

    const start = () => {
      if (token !== this.token || button.disabled) return;
      button.disabled = true;
      button.remove();
      this.clearSpinKey();
      this.spin(token, items, strips, reels, () => {
        if (token !== this.token) return;
        const ms = this.revealCards(loadout);
        this.go.hidden = false;
        window.setTimeout(() => token === this.token && onReady?.(), Math.min(ms, 3200) - 800);
      });
    };
    button.addEventListener('click', start);
    this.spinKey = (e) => {
      const t = e.target;
      if (t instanceof HTMLInputElement && t.type !== 'checkbox') return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        start();
      }
    };
    window.addEventListener('keydown', this.spinKey);

    this.root.hidden = true;
    void this.root.offsetWidth;
    this.root.hidden = false;
  }

  private reelCell(slot: 'weapon' | 'armor' | 'trinket', id: string, rarity: number | null): HTMLElement {
    const cell = document.createElement('div');
    cell.className = 'reel-cell';
    const icon = document.createElement('div');
    icon.className = 'reel-icon';
    if (rarity !== null) icon.style.setProperty('--rarity', cssColor(RARITY_COLORS[rarity as 0 | 1 | 2 | 3 | 4]));
    icon.appendChild(imageCanvas(itemIcon(slot, id), 4));
    cell.appendChild(icon);
    return cell;
  }

  /** Scrolls every reel to its last cell; reels stop one after another. Calls `done` after the last. */
  private spin(
    token: number,
    items: Item[],
    strips: HTMLElement[],
    reels: HTMLElement[],
    done: () => void,
  ): void {
    const t0 = performance.now();
    const landed = [false, false, false];
    const frame = (now: number) => {
      if (token !== this.token) return;
      const elapsed = now - t0;
      for (let i = 0; i < strips.length; i++) {
        if (landed[i]) continue;
        const d = reelDuration(i);
        const p = Math.min(1, elapsed / d);
        const distance = (reelCells(i) - 1) * CELL_H;
        strips[i]!.style.transform = `translateY(${-distance * easeOutBack(p)}px)`;
        reels[i]!.classList.toggle('fast', p < 0.75);
        if (p >= 1) {
          landed[i] = true;
          strips[i]!.style.transform = `translateY(${-distance}px)`;
          reels[i]!.classList.remove('fast');
          reels[i]!.classList.add('landed');
          reels[i]!.style.setProperty('--rarity', cssColor(RARITY_COLORS[items[i]!.rarity]));
        }
      }
      if (landed.every(Boolean)) {
        window.setTimeout(() => token === this.token && done(), 700);
      } else {
        requestAnimationFrame(frame);
      }
    };
    requestAnimationFrame(frame);
  }

  private clearSpinKey(): void {
    if (this.spinKey) window.removeEventListener('keydown', this.spinKey);
    this.spinKey = null;
  }

  hide(): void {
    this.token++;
    this.clearSpinKey();
    this.root.hidden = true;
  }

  private card(item: Item, delay: number): HTMLElement {
    const d = describeItem(item);
    const card = document.createElement('article');
    card.className = `loot-card rarity-${item.rarity}`;
    card.style.setProperty('--rarity', cssColor(RARITY_COLORS[item.rarity]));
    card.style.setProperty('--delay', `${delay}s`);

    const icon = document.createElement('div');
    icon.className = 'loot-icon';
    icon.appendChild(itemIconCanvas(item, 5));

    const slot = document.createElement('div');
    slot.className = 'loot-slot';
    slot.textContent = SLOT_LABELS[item.slot];

    const name = document.createElement('h3');
    name.className = 'loot-name';
    name.textContent = item.name;

    const rarity = document.createElement('div');
    rarity.className = 'loot-rarity';
    rarity.textContent = RARITY_NAMES[item.rarity];

    const lines = document.createElement('ul');
    lines.className = 'loot-lines';
    if (d.signature) {
      card.classList.add('has-signature');
      const sig = li('', 'signature');
      const title = document.createElement('b');
      title.textContent = `\u2605 ${d.signature.title}`;
      sig.append(title, document.createElement('br'), document.createTextNode(d.signature.text));
      lines.appendChild(sig);
    }
    for (const text of d.stats) lines.appendChild(li(text, 'stat'));
    for (const text of d.effects) lines.appendChild(li(text, 'effect'));
    if (d.drawback) lines.appendChild(li(d.drawback, 'drawback'));

    card.append(icon, slot, name, rarity, lines);
    return card;
  }
}

function li(text: string, kind: 'stat' | 'effect' | 'drawback' | 'signature'): HTMLElement {
  const e = document.createElement('li');
  e.className = `loot-line loot-${kind}`;
  e.textContent = text;
  return e;
}
