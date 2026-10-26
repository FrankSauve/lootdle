/**
 * Developer debug menu. Only loaded in the Vite dev server (import.meta.env.DEV), never in a
 * production build. Toggle it with the DEBUG button (bottom-left) or F2.
 */
import type { SimState } from '../sim/sim.ts';

export const SPEEDS = [0, 0.1, 0.25, 0.5, 1, 2, 4, 8] as const;

/** What the menu can read and do; implemented by main.ts, which owns the running game. */
export interface DebugHost {
  sim(): SimState;
  godMode(): boolean;
  setGodMode(on: boolean): void;
  speed(): number;
  setSpeed(multiplier: number): void;
  setHp(hp: number): void;
  rerollLoot(): void;
  loadPlayerLoot(name: string): void;
  resetLoot(): void;
  killAll(): void;
}

export class DebugMenu {
  private readonly panel: HTMLElement;
  private readonly info: HTMLElement;
  private readonly host: DebugHost;
  private readonly immunity: HTMLInputElement;
  private readonly speed: HTMLSelectElement;
  private lastInfo = 0;

  constructor(parent: HTMLElement, host: DebugHost) {
    this.host = host;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'debug-toggle';
    toggle.textContent = 'DEBUG';
    toggle.title = 'Debug menu (F2)';
    toggle.addEventListener('click', () => this.toggle());
    parent.appendChild(toggle);

    this.panel = document.createElement('div');
    this.panel.className = 'debug-panel';
    this.panel.hidden = true;
    this.panel.innerHTML = `
      <div class="debug-head">Debug <span>(dev only)</span></div>
      <label class="debug-row"><input type="checkbox" class="debug-immunity" /> Player immunity</label>
      <div class="debug-row">
        <span>HP</span>
        <input type="number" class="debug-hp" min="1" step="1" value="100" />
        <button type="button" class="debug-set-hp">Set</button>
        <button type="button" class="debug-full-hp">Full</button>
      </div>
      <div class="debug-row">
        <span>Game speed</span>
        <select class="debug-speed"></select>
      </div>
      <div class="debug-row">
        <button type="button" class="debug-reroll">Reroll loot</button>
        <button type="button" class="debug-reset-loot">Today's loot</button>
      </div>
      <div class="debug-row">
        <input type="text" class="debug-player" placeholder="player name" />
        <button type="button" class="debug-load-player">Load loot</button>
      </div>
      <div class="debug-row">
        <button type="button" class="debug-kill">Kill all enemies</button>
      </div>
      <pre class="debug-info"></pre>
    `;
    parent.appendChild(this.panel);

    const q = <T extends HTMLElement>(sel: string) => this.panel.querySelector<T>(sel)!;
    this.immunity = q<HTMLInputElement>('.debug-immunity');
    this.speed = q<HTMLSelectElement>('.debug-speed');
    this.info = q('.debug-info');
    const hp = q<HTMLInputElement>('.debug-hp');
    const player = q<HTMLInputElement>('.debug-player');

    for (const s of SPEEDS) {
      const o = document.createElement('option');
      o.value = String(s);
      o.textContent = s === 0 ? 'Paused' : `${s}x`;
      this.speed.appendChild(o);
    }
    this.speed.value = String(host.speed());

    this.immunity.addEventListener('change', () => host.setGodMode(this.immunity.checked));
    this.speed.addEventListener('change', () => {
      host.setSpeed(Number(this.speed.value));
      this.speed.blur();
    });
    q('.debug-set-hp').addEventListener('click', () => host.setHp(Number(hp.value)));
    q('.debug-full-hp').addEventListener('click', () => {
      host.setHp(host.sim().player.maxHp);
      hp.value = String(host.sim().player.maxHp);
    });
    q('.debug-reroll').addEventListener('click', () => host.rerollLoot());
    q('.debug-reset-loot').addEventListener('click', () => host.resetLoot());
    q('.debug-load-player').addEventListener('click', () => {
      if (player.value.trim()) host.loadPlayerLoot(player.value.trim());
    });
    q('.debug-kill').addEventListener('click', () => host.killAll());

    window.addEventListener('keydown', (e) => {
      if (e.code === 'F2') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  toggle(): void {
    this.panel.hidden = !this.panel.hidden;
    if (!this.panel.hidden) {
      this.immunity.checked = this.host.godMode();
      this.speed.value = String(this.host.speed());
    }
  }

  /** Call every frame; refreshes the live readout a few times a second. */
  update(now: number): void {
    if (this.panel.hidden || now - this.lastInfo < 250) return;
    this.lastInfo = now;
    const s = this.host.sim();
    const b = s.build;
    this.info.textContent = [
      `tick ${s.tick}  enemies ${s.enemies.count}  shots ${s.projectiles.count}`,
      `HP ${Math.ceil(s.player.hp)}/${s.player.maxHp}  speed ${Math.round(s.player.speed)}`,
      `${s.loadout.buildName}`,
      `dmg ${Math.round(b.damage)}  every ${b.cooldown.toFixed(2)}s  x${b.count}`,
      s.loadout.synergies.length ? `synergies: ${s.loadout.synergies.join(', ')}` : 'no synergies',
    ].join('\n');
  }
}
