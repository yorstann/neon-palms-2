// Keyboard and mouse state for the game. `down` is level-triggered (held),
// `pressed` is edge-triggered (true only on the step the key went down);
// main.js calls endFrame() once per simulation step to clear the edges.

export const Input = {
  keys: new Set(),
  edges: new Set(),
  mouse: { x: 0, y: 0, down: false, clicked: false },

  init(canvas) {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.edges.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * 1280;
      this.mouse.y = ((e.clientY - r.top) / r.height) * 720;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.down = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  down(code) { return this.keys.has(code); },
  pressed(code) { return this.edges.has(code); },

  /** Movement axes from WASD or the arrow keys: each component is -1, 0 or 1. */
  axes() {
    const x = (this.down('KeyD') || this.down('ArrowRight') ? 1 : 0) - (this.down('KeyA') || this.down('ArrowLeft') ? 1 : 0);
    const y = (this.down('KeyS') || this.down('ArrowDown') ? 1 : 0) - (this.down('KeyW') || this.down('ArrowUp') ? 1 : 0);
    return { x, y };
  },

  endFrame() {
    this.edges.clear();
    this.mouse.clicked = false;
  },
};
