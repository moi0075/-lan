import { describe, expect, it } from "vitest";
import { pinchView, zoomAt } from "./mapNavigation";

describe("map navigation geometry", () => {
  it("keeps the geographic point under an off-center cursor fixed", () => {
    const view = { x: -210, y: 84, k: 2.3 };
    const anchor = { x: 765, y: 130 };
    const next = zoomAt(view, 1.7, anchor);
    expect((anchor.x - next.x) / next.k).toBeCloseTo(
      (anchor.x - view.x) / view.k,
    );
    expect((anchor.y - next.y) / next.k).toBeCloseTo(
      (anchor.y - view.y) / view.k,
    );
  });

  it("clamps zoom without snapping a panned map back to its initial position", () => {
    const view = { x: 100, y: -50, k: 1 };
    expect(zoomAt(view, 0.1, { x: 20, y: 40 })).toEqual(view);
    const maximum = { x: -2000, y: -900, k: 12 };
    expect(zoomAt(maximum, 100, { x: 700, y: 180 })).toEqual(maximum);
  });

  it("follows the midpoint and scale of a two-finger gesture together", () => {
    const before: [{ x: number; y: number }, { x: number; y: number }] = [
      { x: 100, y: 200 },
      { x: 300, y: 200 },
    ];
    const after: typeof before = [
      { x: 50, y: 250 },
      { x: 450, y: 250 },
    ];
    expect(pinchView({ x: 0, y: 0, k: 1 }, before, after)).toEqual({
      x: -150,
      y: -150,
      k: 2,
    });
  });

  it("still lets fingers pan when the zoom limit has been reached", () => {
    const before: [{ x: number; y: number }, { x: number; y: number }] = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ];
    const after: typeof before = [
      { x: 90, y: 110 },
      { x: 250, y: 110 },
    ];
    expect(pinchView({ x: -1000, y: -500, k: 12 }, before, after)).toEqual({
      x: -980,
      y: -490,
      k: 12,
    });
  });
});
