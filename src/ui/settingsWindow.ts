import { SETTING_DEFS } from '../settings.ts';
import type { SettingsStore } from '../settings.ts';

/** The settings window: a modal list of switches built from SETTING_DEFS. */
export class SettingsWindow {
  private readonly root: HTMLElement;
  private readonly store: SettingsStore;
  private readonly switches = new Map<string, HTMLButtonElement>();

  constructor(parent: HTMLElement, store: SettingsStore) {
    this.store = store;
    this.root = document.createElement('div');
    this.root.className = 'settings-overlay';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="settings-panel" role="dialog" aria-modal="true" aria-label="Settings">
        <h2 class="settings-title">Settings</h2>
        <div class="settings-list"></div>
        <button type="button" class="settings-close">Close <span>(Esc)</span></button>
      </div>
    `;
    parent.appendChild(this.root);

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
