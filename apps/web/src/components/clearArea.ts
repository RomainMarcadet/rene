import type { ClearArea } from './useRoomViewport';
/** Largest unobstructed rectangle, using only the edges of visible HUD panels. */
export function findClearArea(bounds: ClearArea, panels: ClearArea[]): ClearArea {
  const right = bounds.left + bounds.width; const bottom = bounds.top + bounds.height;
  panels = panels.filter(p => p.width > 0 && p.height > 0 && p.left < right && p.top < bottom && p.left + p.width > bounds.left && p.top + p.height > bounds.top).map(p => {
    const left = Math.max(bounds.left, p.left); const top = Math.max(bounds.top, p.top);
    return { left, top, width: Math.min(right, p.left + p.width) - left, height: Math.min(bottom, p.top + p.height) - top };
  });
  const xs = [...new Set([bounds.left, right, ...panels.flatMap(p => [Math.max(bounds.left, p.left), Math.min(right, p.left + p.width)])])].sort((a, b) => a - b);
  const ys = [...new Set([bounds.top, bottom, ...panels.flatMap(p => [Math.max(bounds.top, p.top), Math.min(bottom, p.top + p.height)])])].sort((a, b) => a - b);
  let best: ClearArea = { ...bounds, width: 0, height: 0 };
  for (const left of xs) for (const x of xs) for (const top of ys) for (const y of ys) {
    if (x <= left || y <= top) continue;
    if (panels.some(p => left < p.left + p.width && x > p.left && top < p.top + p.height && y > p.top)) continue;
    if ((x - left) * (y - top) > best.width * best.height) best = { left, top, width: x - left, height: y - top };
  }
  return best;
}
