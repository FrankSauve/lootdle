import { itemIcon } from '../render/art/icons.ts';
import type { PixelImage } from '../render/art/pixels.ts';
import { RARITY_COLORS, RARITY_NAMES, SYNERGIES } from '../sim/items.ts';
import type { Item } from '../sim/items.ts';
import { describeItem } from '../sim/loot.ts';
import type { Loadout } from '../sim/loot.ts';

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

  /** Shows the reveal and returns how many milliseconds until it has finished playing. */
  show(loadout: Loadout, dateLabel: string): number {
    this.date.textContent = dateLabel;
    this.cards.replaceChildren(
      ...[loadout.weapon, loadout.armor, loadout.trinket].map((item, i) => this.card(item, 0.25 + i * 0.6)),
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

  hide(): void {
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
