export function createInput() {
  const keys = new Set();
  const pressed = new Set();
  // Arrow keys steer the same as WASD: the page preventDefaults them, so they must drive.
  const ARROWS = { w: 'arrowup', s: 'arrowdown', a: 'arrowleft', d: 'arrowright' };
  const keydown = event => {
    const key = event.key.toLowerCase();
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
    if (!keys.has(key)) pressed.add(key);
    keys.add(key);
  };
  const keyup = event => keys.delete(event.key.toLowerCase());
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', () => { keys.clear(); pressed.clear(); });
  return {
    down: key => keys.has(key),
    axis: (positive, negative) => Number(keys.has(positive) || keys.has(ARROWS[positive] ?? '')) - Number(keys.has(negative) || keys.has(ARROWS[negative] ?? '')),
    take: key => { const found = pressed.has(key); pressed.delete(key); return found; },
    // Reuse the set instead of allocating a fresh one every frame.
    endFrame: () => { pressed.clear(); },
  };
}
