/** Builds the text people paste into chats after a run, Wordle-style. */
import { RARITY_NAMES, SIGNATURES } from './sim/items.ts';
import type { Item } from './sim/items.ts';
import type { SimState } from './sim/sim.ts';

/** One colored square per rarity: common to legendary. */
const RARITY_SQUARES = ['⬜', '🟩', '🟦', '🟪', '🟧'] as const;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function itemLine(item: Item): string {
  const star = item.signature ? ` ★ ${SIGNATURES[item.signature].title}` : '';
  return `${RARITY_SQUARES[item.rarity]} ${item.name} (${RARITY_NAMES[item.rarity]})${star}`;
}

export function buildShareText(state: SimState, dateLabel: string, seconds: number): string {
  const { loadout, stats } = state;
  const items = [loadout.weapon, loadout.armor, loadout.trinket];
  const lines = [
    `LOOTDLE ${dateLabel}`,
    `${items.map((i) => RARITY_SQUARES[i.rarity]).join('')}  ${loadout.buildName}`,
    '',
    `⏱️ Survived ${formatTime(seconds)}`,
    `💀 ${stats.kills.toLocaleString()} kills · 👑 ${stats.bossesDefeated} bosses`,
    `⚔️ ${Math.round(stats.damageDealt).toLocaleString()} damage dealt`,
    '',
    ...items.map(itemLine),
  ];
  if (loadout.synergies.length > 0) lines.push(`⚡ ${loadout.synergies.length} synerg${loadout.synergies.length === 1 ? 'y' : 'ies'}`);
  return lines.join('\n');
}

/** Copies text to the clipboard; returns false if the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for insecure contexts or denied permissions.
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
