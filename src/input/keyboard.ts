import type { MoveInput } from '../sim/sim.ts';

const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
const UP = ['KeyW', 'ArrowUp'];
const DOWN = ['KeyS', 'ArrowDown'];
const MOVE_KEYS = new Set([...LEFT, ...RIGHT, ...UP, ...DOWN]);

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target;
  return t instanceof HTMLInputElement && t.type !== 'checkbox'
    ? true
    : t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;
}

/** WASD / arrow-key movement. The mobile virtual joystick will produce the same MoveInput. */
export function createKeyboardInput(target: Window = window) {
  const down = new Set<string>();

  target.addEventListener('keydown', (e) => {
    if (isTyping(e)) return; // don't walk around while typing in a text box (debug menu)
    if (MOVE_KEYS.has(e.code)) e.preventDefault(); // stop arrow keys from scrolling the page
    down.add(e.code);
  });
  target.addEventListener('keyup', (e) => down.delete(e.code));
  target.addEventListener('blur', () => down.clear());

  const any = (codes: string[]) => codes.some((c) => down.has(c));

  return {
    read(): MoveInput {
      return {
        x: (any(RIGHT) ? 1 : 0) - (any(LEFT) ? 1 : 0),
        y: (any(DOWN) ? 1 : 0) - (any(UP) ? 1 : 0),
      };
    },
  };
}
