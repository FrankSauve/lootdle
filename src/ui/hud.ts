import { RARITY_COLORS, RARITY_NAMES, SIGNATURES } from '../sim/items.ts';
import type { SimState } from '../sim/sim.ts';
import { elapsedSeconds } from '../sim/sim.ts';
import type { Loadout } from '../sim/sim.ts';
import { cssColor, itemIconCanvas } from './lootPanel.ts';

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

/**
 * DOM HUD. The top bar (HP, timer, counters) is a layout row above the game canvas so it never
 * covers the arena; banners, the start prompt and the results screen float over the canvas.
 */
export class Hud {
  private readonly topBar: HTMLElement;
  private readonly root: HTMLElement;
  private readonly timer: HTMLElement;
  private readonly hpFill: HTMLElement;
  private readonly hpText: HTMLElement;
  private readonly kills: HTMLElement;
  private readonly bosses: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly results: HTMLElement;
  private bannerTimeout = 0;
  private last = { time: '', hp: -1, kills: -1, bosses: -1 };

  constructor(parent: HTMLElement, onRestart: () => void) {
    this.topBar = el('div', 'hud-top');
    this.topBar.innerHTML = `
      <div class="hud-hp">
        <div class="hud-hp-bar"><div class="hud-hp-fill"></div></div>
        <span class="hud-hp-text"></span>
      </div>
      <div class="hud-timer">00:00.00</div>
      <div class="hud-counters">
        <span class="hud-gear"></span>
        <span><span class="hud-label">Kills</span> <b class="hud-kills">0</b></span>
        <span><span class="hud-label">Bosses</span> <b class="hud-bosses">0</b></span>
      </div>
    `;
    parent.prepend(this.topBar);

    this.root = el('div', 'hud');
    this.root.innerHTML = `
      <div class="hud-banner"></div>
      <div class="hud-results" hidden>
        <h2>You died</h2>
        <div class="hud-results-time"></div>
        <div class="hud-results-build"></div>
        <div class="hud-results-gear"></div>
        <dl class="hud-results-stats"></dl>
        <button type="button" class="hud-restart">Play again <span>(R)</span></button>
      </div>
    `;
    parent.appendChild(this.root);

    this.timer = q(this.topBar, '.hud-timer');
    this.hpFill = q(this.topBar, '.hud-hp-fill');
    this.hpText = q(this.topBar, '.hud-hp-text');
    this.kills = q(this.topBar, '.hud-kills');
    this.bosses = q(this.topBar, '.hud-bosses');
    this.banner = q(this.root, '.hud-banner');
    this.results = q(this.root, '.hud-results');
    q(this.root, '.hud-restart').addEventListener('click', onRestart);
  }

  /** Updates the live HUD; only touches the DOM when a value actually changed. */
  update(state: SimState): void {
    const time = formatTime(elapsedSeconds(state));
    if (time !== this.last.time) this.timer.textContent = this.last.time = time;

    const hp = Math.ceil(state.player.hp);
    if (hp !== this.last.hp) {
      this.last.hp = hp;
      this.hpFill.style.width = `${(100 * state.player.hp) / state.player.maxHp}%`;
      this.hpText.textContent = `${hp} / ${state.player.maxHp}`;
    }
    if (state.stats.kills !== this.last.kills) {
      this.last.kills = state.stats.kills;
      this.kills.textContent = state.stats.kills.toLocaleString();
    }
    if (state.stats.bossesDefeated !== this.last.bosses) {
      this.last.bosses = state.stats.bossesDefeated;
      this.bosses.textContent = String(state.stats.bossesDefeated);
    }
  }

  showBanner(text: string, variant: 'boss' | 'doom' | 'info' = 'info', ms = 1800): void {
    this.banner.textContent = text;
    this.banner.className = `hud-banner hud-banner-${variant} show`;
    window.clearTimeout(this.bannerTimeout);
    this.bannerTimeout = window.setTimeout(() => this.banner.classList.remove('show'), ms);
  }

  /** Shows today's three items as small icons in the top bar. */
  setLoadout(loadout: Loadout): void {
    const gear = q(this.topBar, '.hud-gear');
    gear.replaceChildren(
      ...[loadout.weapon, loadout.armor, loadout.trinket].map((item) => {
        const slot = document.createElement('span');
        slot.className = 'hud-gear-slot';
        slot.style.setProperty('--rarity', cssColor(RARITY_COLORS[item.rarity]));
        slot.title = `${item.name} (${RARITY_NAMES[item.rarity]})${item.signature ? ` \u2605 ${SIGNATURES[item.signature].title}` : ''}`;
        slot.appendChild(itemIconCanvas(item, 2));
        return slot;
      }),
    );
  }

  showResults(state: SimState): void {
    const s = state.stats;
    q(this.results, '.hud-results-time').textContent = `Survived ${formatTime(elapsedSeconds(state))}`;
    const rows: [string, string][] = [
      ['Kills', s.kills.toLocaleString()],
      ['Bosses defeated', String(s.bossesDefeated)],
      ['Damage dealt', Math.round(s.damageDealt).toLocaleString()],
      ['Damage taken', Math.round(s.damageTaken).toLocaleString()],
    ];
    const loadout = state.loadout;
    q(this.results, '.hud-results-build').textContent = loadout.buildName;
    q(this.results, '.hud-results-gear').replaceChildren(
      ...[loadout.weapon, loadout.armor, loadout.trinket].map((item) => {
        const row = document.createElement('div');
        row.className = 'hud-results-item';
        row.style.setProperty('--rarity', cssColor(RARITY_COLORS[item.rarity]));
        row.append(itemIconCanvas(item, 2), document.createTextNode(item.name));
        return row;
      }),
    );
    q(this.results, '.hud-results-stats').innerHTML = rows
      .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
      .join('');
    this.results.hidden = false;
  }

  reset(): void {
    this.results.hidden = true;
    this.banner.classList.remove('show');
    this.last = { time: '', hp: -1, kills: -1, bosses: -1 };
  }
}

function el(tag: string, className: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = className;
  return e;
}

function q(root: ParentNode, selector: string): HTMLElement {
  const found = root.querySelector<HTMLElement>(selector);
  if (!found) throw new Error(`HUD element missing: ${selector}`);
  return found;
}
