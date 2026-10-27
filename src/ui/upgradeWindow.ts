import { statIcon } from '../render/art/uiIcons.ts';
import { RARITY_COLORS, RARITY_NAMES } from '../sim/items.ts';
import { UPGRADES } from '../sim/upgrades.ts';
import type { UpgradeOption, UpgradeTotals } from '../sim/upgrades.ts';
import { cssColor, imageCanvas } from './lootPanel.ts';

/** Ignore input this long after the window appears, so a stray keypress can't pick for you. */
const INPUT_LOCKOUT_MS = 350;

/**
 * The pop-up that pauses the game every 30 seconds: three stat upgrades, pick one
 * (click a card, or press 1, 2 or 3).
 */
export class UpgradeWindow {
  private readonly root: HTMLElement;
  private readonly cards: HTMLElement;
  private readonly title: HTMLElement;
  private shownAt = 0;
  private options: UpgradeOption[] = [];

  private readonly onPick: (index: number) => void;

  constructor(parent: HTMLElement, onPick: (index: number) => void) {
    this.onPick = onPick;
    this.root = document.createElement('div');
    this.root.className = 'upgrade-overlay';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="upgrade-panel">
        <div class="upgrade-title">Upgrade!</div>
        <div class="upgrade-sub">Choose one</div>
        <div class="upgrade-cards"></div>
        <div class="upgrade-hint">Click a card or press <b>1</b> <b>2</b> <b>3</b></div>
      </div>
    `;
    parent.appendChild(this.root);
    this.cards = this.root.querySelector<HTMLElement>('.upgrade-cards')!;
    this.title = this.root.querySelector<HTMLElement>('.upgrade-title')!;
    window.addEventListener('keydown', (e) => {
      if (this.root.hidden) return;
      const index = ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].indexOf(e.code) % 3;
      if (['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].includes(e.code)) this.pick(index);
    });
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  show(options: UpgradeOption[], totals: UpgradeTotals, offerNumber: number): void {
    this.options = options;
    this.shownAt = performance.now();
    const best = Math.max(...options.map((o) => o.rarity));
    this.root.dataset['best'] = String(best);
    this.title.textContent = `Upgrade ${offerNumber}`;
    this.cards.replaceChildren(
      ...options.map((option, i) => {
        const def = UPGRADES[option.stat];
        const value = def.values[option.rarity]!;
        const card = document.createElement('button');
        card.type = 'button';
        card.className = `upgrade-card rarity-${option.rarity}`;
        card.style.setProperty('--rarity', cssColor(RARITY_COLORS[option.rarity]));
        card.style.setProperty('--delay', `${i * 0.12}s`);

        const key = document.createElement('div');
        key.className = 'upgrade-key';
        key.textContent = String(i + 1);

        const icon = document.createElement('div');
        icon.className = 'upgrade-icon';
        icon.appendChild(imageCanvas(statIcon(option.stat), 6));

        const rarity = document.createElement('div');
        rarity.className = 'upgrade-rarity';
        rarity.textContent = RARITY_NAMES[option.rarity];

        const name = document.createElement('div');
        name.className = 'upgrade-name';
        name.textContent = def.name;

        const amount = document.createElement('div');
        amount.className = 'upgrade-amount';
        amount.textContent = def.format(value);

        const total = document.createElement('div');
        total.className = 'upgrade-total';
        const have = totals[option.stat];
        total.textContent = have > 0 ? `So far ${def.format(have)}` : 'New';

        card.append(key, icon, rarity, name, amount, total);
        card.addEventListener('click', () => this.pick(i));
        return card;
      }),
    );
    this.root.hidden = true;
    void this.root.offsetWidth; // restart the CSS reveal
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  private pick(index: number): void {
    if (this.root.hidden || performance.now() - this.shownAt < INPUT_LOCKOUT_MS) return;
    if (!this.options[index]) return;
    this.hide();
    this.onPick(index);
  }
}
