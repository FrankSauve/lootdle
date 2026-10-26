/**
 * Player settings, saved in this browser. To add a setting: add it to `Settings` and
 * `DEFAULT_SETTINGS`, describe it in `SETTING_DEFS` (the settings window builds itself from that
 * list), and read it wherever it matters.
 */
export interface Settings {
  screenShake: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  screenShake: true,
};

export interface SettingDef {
  key: keyof Settings;
  label: string;
  description: string;
}

/** Everything shown in the settings window, in order. All are on/off switches for now. */
export const SETTING_DEFS: readonly SettingDef[] = [
  {
    key: 'screenShake',
    label: 'Screen shake',
    description: 'Shake the screen on explosions, hits and bosses',
  },
];

const STORAGE_KEY = 'lootdle.settings';

export class SettingsStore {
  private values: Settings = { ...DEFAULT_SETTINGS };
  private readonly listeners: ((settings: Readonly<Settings>) => void)[] = [];

  constructor() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Settings>;
        // Only accept known keys with the right type, so old or edited data can't break anything.
        for (const def of SETTING_DEFS) {
          const v = saved[def.key];
          if (typeof v === typeof DEFAULT_SETTINGS[def.key]) this.values[def.key] = v as never;
        }
      }
    } catch {
      // Storage unavailable or corrupted: just use the defaults.
    }
  }

  get(): Readonly<Settings> {
    return this.values;
  }

  set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.values = { ...this.values, [key]: value };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.values));
    } catch {
      // Not saved, but still applies for this session.
    }
    for (const fn of this.listeners) fn(this.values);
  }

  onChange(fn: (settings: Readonly<Settings>) => void): void {
    this.listeners.push(fn);
  }
}
