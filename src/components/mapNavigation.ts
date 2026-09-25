export interface MapView {
  x: number;
  y: number;
  k: number;
}
export interface MapPoint {
  x: number;
  y: number;
}
export const INITIAL_MAP_VIEW: MapView = { x: 0, y: 0, k: 1 };

/** Keep the geographic point under the gesture stationary, even at a zoom limit. */
export function zoomAt(
  view: MapView,
  factor: number,
  anchor: MapPoint,
): MapView {
  const k = Math.min(12, Math.max(1, view.k * factor));
  const ratio = k / view.k;
  return {
    k,
    x: anchor.x - (anchor.x - view.x) * ratio,
    y: anchor.y - (anchor.y - view.y) * ratio,
  };
}

export function pinchView(
  view: MapView,
  before: [MapPoint, MapPoint],
  after: [MapPoint, MapPoint],
): MapView {
  const center = (points: [MapPoint, MapPoint]) => ({
    x: (points[0].x + points[1].x) / 2,
    y: (points[0].y + points[1].y) / 2,
  });
  const distance = (points: [MapPoint, MapPoint]) =>
    Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
  const previous = center(before);
  const next = center(after);
  const zoomed = zoomAt(
    view,
    distance(after) / Math.max(1, distance(before)),
    previous,
  );
  return {
    ...zoomed,
    x: zoomed.x + next.x - previous.x,
    y: zoomed.y + next.y - previous.y,
  };
}
