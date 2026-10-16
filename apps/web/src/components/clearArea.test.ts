import { describe, expect, it } from 'vitest';
import { findClearArea } from './clearArea';

describe('camera clearance', () => {
  const bounds = { left: 0, top: 0, width: 1000, height: 700 };
  it('keeps the original area without panels and ignores offscreen or hidden boxes', () => {
    expect(findClearArea(bounds, [])).toEqual(bounds);
    expect(findClearArea(bounds, [{ left: 1200, top: 0, width: 300, height: 700 }, { left: 0, top: 0, width: 0, height: 0 }])).toEqual(bounds);
  });
  it('frames the stage between the top/right gameplay and bottom panels', () => {
    const panels = [{ left: 700, top: 0, width: 300, height: 700 }, { left: 0, top: 500, width: 700, height: 200 }];
    expect(findClearArea(bounds, panels)).toEqual({ left: 0, top: 0, width: 700, height: 500 });
  });
  it('clips a panel crossing the viewport and handles a fully covered screen', () => {
    expect(findClearArea(bounds, [{ left: -50, top: -20, width: 150, height: 800 }])).toEqual({ left: 100, top: 0, width: 900, height: 700 });
    expect(findClearArea(bounds, [bounds]).width).toBe(0);
  });
});
