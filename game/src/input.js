// Keyboard and mouse input for LUMEN BAY. Held keys give movement and
// driving; one-shot presses (enter car, shoot, reload, radio, pause) are
// queued as bit flags and taken once by the loop, so a press between two
// frames is never lost and never counted twice. The mouse aims on foot
// and in drive-by; its screen position is converted to a world angle by
// the loop, which knows the camera.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_RELOAD = 8;
export const ACTION_RADIO = 16;
export const ACTION_INTERACT = 32;
export const ACTION_TAXI = 64;
export const ACTION_MUTE = 128;
export const ACTION_DIGIT = 4096;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const RELOAD = new Set(['KeyR']);
const RADIO = new Set(['KeyQ']);
const TAXI = new Set(['KeyT']);
const MUTE = new Set(['KeyM']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const NOS = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(target) {
  let up = false, down = false, left = false, right = false;
  let run = false, nos = false, firing = false;
  let mouseX = 0, mouseY = 0, mouseDown = false;
  let actions = 0;

  function press(code, event) {
    if (UP.has(code)) up = true;
    else if (DOWN.has(code)) down = true;
    else if (LEFT.has(code)) left = true;
    else if (RIGHT.has(code)) right = true;
    else if (RUN.has(code)) { run = true; nos = true; }
    else if (CONFIRM.has(code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (ENTER.has(code)) { if (!event.repeat) actions |= ACTION_ENTER | ACTION_INTERACT; }
    else if (RELOAD.has(code)) { if (!event.repeat) actions |= ACTION_RELOAD; }
    else if (RADIO.has(code)) { if (!event.repeat) actions |= ACTION_RADIO; }
    else if (TAXI.has(code)) { if (!event.repeat) actions |= ACTION_TAXI; }
    else if (MUTE.has(code)) { if (!event.repeat) actions |= ACTION_MUTE; }
    else if (code.startsWith('Digit') && !event.repeat) {
      lastDigit = Number(code.slice(5));
      actions |= ACTION_DIGIT;
    } else return;
    event.preventDefault();
  }
  let lastDigit = 0;

  function release(code) {
    if (UP.has(code)) up = false;
    else if (DOWN.has(code)) down = false;
    else if (LEFT.has(code)) left = false;
    else if (RIGHT.has(code)) right = false;
    else if (RUN.has(code)) { run = false; nos = false; }
  }

  window.addEventListener('keydown', (e) => press(e.code, e));
  window.addEventListener('keyup', (e) => release(e.code));
  window.addEventListener('blur', () => {
    up = down = left = right = run = nos = firing = mouseDown = false;
  });
  target.addEventListener('pointermove', (e) => {
    const r = target.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
  });
  target.addEventListener('pointerdown', (e) => {
    const r = target.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
    mouseDown = true;
    firing = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => { mouseDown = false; firing = false; });
  target.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    move() {
      return {
        x: (right ? 1 : 0) - (left ? 1 : 0),
        y: (down ? 1 : 0) - (up ? 1 : 0),
      };
    },
    get run() { return run; },
    get nos() { return nos; },
    get firing() { return firing; },
    get mouseDown() { return mouseDown; },
    mouse() { return { x: mouseX, y: mouseY }; },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeDigit() {
      const d = lastDigit;
      lastDigit = 0;
      return d;
    },
    // Scripted input for the self-test and screenshot staging: a plain
    // object with the same shape the loop reads.
    scripted(over) {
      return {
        move: () => over.move || { x: 0, y: 0 },
        run: !!over.run, nos: !!over.nos, firing: !!over.firing,
        mouseDown: !!over.firing, mouse: () => over.mouse || { x: 640, y: 360 },
        takeActions: () => over.actions || 0,
        takeDigit: () => 0,
      };
    },
  };
}
