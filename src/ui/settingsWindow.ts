import { SETTING_DEFS } from '../settings.ts';
import type { SettingsStore } from '../settings.ts';
import { RARITY_COLORS, RARITY_NAMES } from '../sim/items.ts';
import { describeItem } from '../sim/loot.ts';
import type { SimState } from '../sim/sim.ts';
import { elapsedSeconds } from '../sim/sim.ts';
import { BASE_CRIT_DAMAGE, MAX_ARMOR, MAX_CRIT_CHANCE, MAX_LIFESTEAL, UPGRADES, UPGRADE_STATS } from '../sim/upgrades.ts';
import { cssColor, itemIconCanvas } from './lootPanel.ts';

/**
 * The pause menu (Esc): your loot, current stats and upgrades for the run in progress, plus the
 * settings switches built from SETTING_DEFS.
 */
export class SettingsWindow {
  private readonly root: HTMLElement;
  private readonly store: SettingsStore;
  private readonly getState: () => SimState;
  private readonly runInfo: HTMLElement;
  private readonly switches = new Map<string, HTMLButtonElement>();

  constructor(parent: HTMLElement, store: SettingsStore, getState: () => SimState) {
    this.store = store;
    this.getState = getState;
    this.root = document.createElement('div');
    this.root.className = 'settings-overlay';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="settings-panel" role="dialog" aria-modal="true" aria-label="Paused">
        <h2 class="settings-title">Paused</h2>
        <div class="pause-run"></div>
        <h3 class="pause-heading">Settings</h3>
        <div class="settings-list"></div>
        <button type="button" class="settings-close">Resume <span>(Esc)</span></button>
      </div>
    `;
    parent.appendChild(this.root);

    this.runInfo = this.root.querySelector<HTMLElement>('.pause-run')!;
    const list = this.root.querySelector<HTMLElement>('.settings-list')!;
    for (const def of SETTING_DEFS) {
      const row = document.createElement('div');
      row.className = 'settings-row';

      const text = document.createElement('div');
      text.className = 'settings-text';
      const label = document.createElement('div');
      label.className = 'settings-label';
      label.textContent = def.label;
      const desc = document.createElement('div');
      desc.className = 'settings-desc';
      desc.textContent = def.description;
      text.append(label, desc);

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'settings-switch';
      toggle.setAttribute('role', 'switch');
      toggle.setAttribute('aria-label', def.label);
      toggle.addEventListener('click', () => this.store.set(def.key, !this.store.get()[def.key]));
      this.switches.set(def.key, toggle);

      row.append(text, toggle);
      list.appendChild(row);
    }

    this.root.querySelector('.settings-close')!.addEventListener('click', () => this.close());
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.close();
    });
    this.store.onChange(() => this.refresh());
    this.refresh();
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(): void {
    this.refresh();
    this.renderRun(this.getState());
    this.root.hidden = false;
    this.root.querySelector<HTMLElement>('.settings-switch')?.focus();
  }

  close(): void {
    this.root.hidden = true;
    // Hand the keyboard back to the game.
    (document.activeElement as HTMLElement | null)?.blur();
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  /** Fills in the loot, stats and upgrade sections for the run as it is right now. */
  private renderRun(state: SimState): void {
    const { loadout, weapon: w, player: p, build: b, upgrades: u, stats } = state;
    const el = (tag: string, className: string, text?: string) => {
      const e = document.createElement(tag);
      e.className = className;
      if (text !== undefined) e.textContent = text;
      return e;
    };

    // Loot.
    const lootCol = el('section', 'pause-col');
    lootCol.append(el('h3', 'pause-heading', loadout.buildName));
    for (const item of [loadout.weapon, loadout.armor, loadout.trinket]) {
      const d = describeItem(item);
      const row = el('div', 'pause-item');
      row.style.setProperty('--rarity', cssColor(RARITY_COLORS[item.rarity]));
      const icon = el('div', 'pause-item-icon');
      icon.appendChild(itemIconCanvas(item, 3));
      const body = el('div', 'pause-item-body');
      body.append(el('div', 'pause-item-name', item.name), el('div', 'pause-item-rarity', RARITY_NAMES[item.rarity]));
      const lines = el('ul', 'pause-item-lines');
      if (d.signature) lines.append(el('li', 'pause-sig', `\u2605 ${d.signature.title}: ${d.signature.text}`));
      for (const t of [...d.stats, ...d.effects]) lines.append(el('li', '', t));
      if (d.drawback) lines.append(el('li', 'pause-drawback', d.drawback));
      body.append(lines);
      row.append(icon, body);
      lootCol.append(row);
    }

    // Stats.
    const statCol = el('section', 'pause-col');
    statCol.append(el('h3', 'pause-heading', 'Stats'));
    const attacks = w.projectilesPerVolley;
    const taken = b.damageTakenMul * (1 - Math.min(MAX_ARMOR, u.armor));
    const rows: [string, string][] = [
      ['Health', `${Math.ceil(p.hp)} / ${p.maxHp}`],
      ['Damage', String(Math.round(w.damage * 10) / 10)],
      ['Attack speed', `${(1 / w.cooldown).toFixed(2)}/s`],
      [w.melee ? 'Swings' : 'Projectiles', `${attacks} per attack`],
      ['Range', String(Math.round(w.range))],
      ...(w.melee ? [] : ([['Pierce', String(w.pierce)]] as [string, string][])),
      ['Move speed', String(Math.round(p.speed))],
      ['Regeneration', `${(b.regen + u.regen).toFixed(1)} HP/s`],
      ['Crit chance', `${Math.round(Math.min(MAX_CRIT_CHANCE, u.critChance) * 100)}%`],
      ['Crit damage', `${Math.round((BASE_CRIT_DAMAGE + u.critDamage) * 100)}%`],
      ['Lifesteal', `${+(Math.min(MAX_LIFESTEAL, u.lifesteal) * 100).toFixed(1)}%`],
      ['Damage taken', `${Math.round(taken * 100)}%`],
      ['Survived', formatTime(elapsedSeconds(state))],
      ['Kills', stats.kills.toLocaleString()],
    ];
    const dl = el('dl', 'pause-stats');
    for (const [k, v] of rows) dl.append(el('dt', '', k), el('dd', '', v));
    statCol.append(dl);

    // Upgrades picked so far, totalled per stat.
    const chosen = UPGRADE_STATS.filter((s) => u[s] > 0);
    statCol.append(el('h3', 'pause-heading', `Upgrades (${state.picked.length})`));
    if (chosen.length === 0) {
      statCol.append(el('div', 'pause-none', 'None yet. The first choice comes at 0:30.'));
    } else {
      const ul = el('ul', 'pause-upgrades');
      for (const s of chosen) ul.append(el('li', '', `${UPGRADES[s].name} ${UPGRADES[s].format(u[s])}`));
      statCol.append(ul);
      const dots = el('div', 'pause-dots');
      for (const o of state.picked) {
        const dot = el('span', 'pause-dot');
        dot.style.background = cssColor(RARITY_COLORS[o.rarity]);
        dot.title = `${RARITY_NAMES[o.rarity]} ${UPGRADES[o.stat].name}`;
        dots.append(dot);
      }
      statCol.append(dots);
    }

    this.runInfo.replaceChildren(lootCol, statCol);
  }

  private refresh(): void {
    const values = this.store.get();
    for (const [key, button] of this.switches) {
      const on = values[key as keyof typeof values] === true;
      button.setAttribute('aria-checked', String(on));
      button.textContent = on ? 'ON' : 'OFF';
      button.classList.toggle('on', on);
    }
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
