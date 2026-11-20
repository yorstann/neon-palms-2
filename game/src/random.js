// A seeded random generator of my own (splitmix-style finaliser over an
// incrementing counter): the same seed always deals the same city, which is
// what makes the screenshot scenes and the layout repeatable.

export function makeRng(seed) {
  let state = (seed | 0) || 0x2545f491;
  function next() {
    state = (state + 0x9e3779b9) | 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    z = z ^ (z >>> 15);
    return (z >>> 0) / 4294967296;
  }
  return {
    next,
    /** Float in [a, b). */
    range(a, b) { return a + next() * (b - a); },
    /** Integer in [a, b] inclusive. */
    int(a, b) { return a + Math.floor(next() * (b - a + 1)); },
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    chance(p) { return next() < p; },
    sign() { return next() < 0.5 ? -1 : 1; },
  };
}
