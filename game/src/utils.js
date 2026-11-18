export const WORLD = 480;
export const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
// Straight-line distance on the ground plane (x/z).
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const randomFrom = seed => {
  let value = seed | 0;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
