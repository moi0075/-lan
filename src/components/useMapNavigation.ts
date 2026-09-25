import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  INITIAL_MAP_VIEW,
  pinchView,
  zoomAt,
  type MapPoint,
} from "./mapNavigation";

interface PointerPosition extends MapPoint {
  startX: number;
  startY: number;
}
interface TrackpadGesture extends Event {
  scale: number;
  clientX: number;
  clientY: number;
}

/** Mouse, trackpad and touch navigation shared by the game and the atlas. */
export function useMapNavigation() {
  const svg = useRef<SVGSVGElement>(null);
  const [view, setView] = useState(INITIAL_MAP_VIEW);
  const [dragging, setDragging] = useState(false);
  const moved = useRef(false);
  const pointers = useRef(new Map<number, PointerPosition>());
  const gestureScale = useRef<number | null>(null);

  const finishPointer = useCallback((pointerId: number) => {
    if (!pointers.current.delete(pointerId)) return;
    const element = svg.current;
    if (element?.hasPointerCapture(pointerId))
      element.releasePointerCapture(pointerId);
    if (pointers.current.size === 0) setDragging(false);
  }, []);

  const cancelInteraction = useCallback(() => {
    gestureScale.current = null;
    if (!pointers.current.size) return;
    // Preserve click suppression until the next press, but release ownership
    // immediately so an interrupted drag cannot steal the toolbar's clicks.
    moved.current = true;
    for (const pointerId of [...pointers.current.keys()])
      finishPointer(pointerId);
  }, [finishPointer]);

  // Screen CTM accounts for the empty margins of a letterboxed SVG viewBox.
  const toMapPoint = (point: MapPoint) => {
    const inverse = svg.current?.getScreenCTM()?.inverse();
    return inverse
      ? new DOMPoint(point.x, point.y).matrixTransform(inverse)
      : point;
  };

  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (gestureScale.current !== null) return;
      const unit =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? element.clientHeight
            : 1;
      if (event.ctrlKey || event.metaKey) {
        const anchor = toMapPoint({ x: event.clientX, y: event.clientY });
        const factor = Math.exp(
          -Math.max(-200, Math.min(200, event.deltaY * unit)) * 0.01,
        );
        setView((current) => zoomAt(current, factor, anchor));
      } else {
        const origin = toMapPoint({ x: 0, y: 0 });
        const delta = toMapPoint({
          x: event.deltaX * unit,
          y: event.deltaY * unit,
        });
        setView((current) => ({
          ...current,
          x: current.x - (delta.x - origin.x),
          y: current.y - (delta.y - origin.y),
        }));
      }
    };
    // Safari exposes trackpad pinch as gesture events instead of Ctrl+wheel.
    const gestureStart = (event: Event) => {
      event.preventDefault();
      // Touch devices may also emit gesture events; their pointers already
      // handle the same pinch, so never apply its scale twice.
      gestureScale.current =
        pointers.current.size >= 2
          ? null
          : (event as TrackpadGesture).scale || 1;
    };
    const gestureChange = (event: Event) => {
      event.preventDefault();
      const gesture = event as TrackpadGesture;
      if (gestureScale.current === null || gesture.scale <= 0) return;
      const factor = gesture.scale / gestureScale.current;
      gestureScale.current = gesture.scale;
      const anchor = toMapPoint({ x: gesture.clientX, y: gesture.clientY });
      setView((current) => zoomAt(current, factor, anchor));
    };
    const gestureEnd = (event: Event) => {
      event.preventDefault();
      gestureScale.current = null;
    };
    const pointerEnd = (event: PointerEvent) => finishPointer(event.pointerId);
    const recoverReleasedMouse = (event: PointerEvent) => {
      if (
        event.pointerType !== "touch" &&
        (event.buttons & 1) === 0 &&
        pointers.current.has(event.pointerId)
      ) {
        cancelInteraction();
      }
    };
    const visibilityChange = () => {
      if (document.hidden) cancelInteraction();
    };
    // Listen outside the SVG as well: a release or cancellation may occur over
    // an overlay, outside the window, or during a native fullscreen transition.
    window.addEventListener("pointerup", pointerEnd, true);
    window.addEventListener("pointercancel", pointerEnd, true);
    window.addEventListener("pointermove", recoverReleasedMouse, true);
    window.addEventListener("blur", cancelInteraction);
    window.addEventListener("resize", cancelInteraction);
    document.addEventListener("fullscreenchange", cancelInteraction);
    document.addEventListener("visibilitychange", visibilityChange);
    // React wheel listeners are passive: attach here to stop page scroll/zoom.
    element.addEventListener("wheel", wheel, { passive: false });
    element.addEventListener("gesturestart", gestureStart, { passive: false });
    element.addEventListener("gesturechange", gestureChange, {
      passive: false,
    });
    element.addEventListener("gestureend", gestureEnd, { passive: false });
    return () => {
      window.removeEventListener("pointerup", pointerEnd, true);
      window.removeEventListener("pointercancel", pointerEnd, true);
      window.removeEventListener("pointermove", recoverReleasedMouse, true);
      window.removeEventListener("blur", cancelInteraction);
      window.removeEventListener("resize", cancelInteraction);
      document.removeEventListener("fullscreenchange", cancelInteraction);
      document.removeEventListener("visibilitychange", visibilityChange);
      cancelInteraction();
      element.removeEventListener("wheel", wheel);
      element.removeEventListener("gesturestart", gestureStart);
      element.removeEventListener("gesturechange", gestureChange);
      element.removeEventListener("gestureend", gestureEnd);
    };
  }, [cancelInteraction, finishPointer]);

  const pointerHandlers = {
    onPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
      if (event.button !== 0) return;
      if (event.pointerType !== "touch") cancelInteraction();
      if (!pointers.current.size) moved.current = false;
      pointers.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
      });
      if (pointers.current.size > 1) {
        moved.current = true;
        setDragging(true);
        for (const id of pointers.current.keys())
          event.currentTarget.setPointerCapture(id);
      }
    },
    onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
      const pointer = pointers.current.get(event.pointerId);
      if (!pointer) return;
      if (event.pointerType !== "touch" && (event.buttons & 1) === 0) {
        cancelInteraction();
        return;
      }
      const before = [...pointers.current.values()].map(toMapPoint);
      const previous = toMapPoint(pointer);
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      const next = toMapPoint(pointer);
      if (pointers.current.size >= 2) {
        const after = [...pointers.current.values()].map(toMapPoint);
        setView((current) =>
          pinchView(current, [before[0], before[1]], [after[0], after[1]]),
        );
      } else if (
        moved.current ||
        Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) > 5
      ) {
        moved.current = true;
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
        setView((current) => ({
          ...current,
          x: current.x + next.x - previous.x,
          y: current.y + next.y - previous.y,
        }));
      }
    },
    onPointerUp(event: ReactPointerEvent<SVGSVGElement>) {
      finishPointer(event.pointerId);
    },
    onPointerCancel(event: ReactPointerEvent<SVGSVGElement>) {
      moved.current = true;
      finishPointer(event.pointerId);
    },
    onLostPointerCapture(event: ReactPointerEvent<SVGSVGElement>) {
      if (event.target === event.currentTarget) finishPointer(event.pointerId);
    },
    onPointerLeave(event: ReactPointerEvent<SVGSVGElement>) {
      if (!event.currentTarget.hasPointerCapture(event.pointerId))
        finishPointer(event.pointerId);
    },
  };
  return {
    svg,
    view,
    setView,
    moved,
    dragging,
    pointerHandlers,
    zoom: (factor: number) =>
      setView((current) => zoomAt(current, factor, { x: 500, y: 255 })),
    reset: () => {
      cancelInteraction();
      setView(INITIAL_MAP_VIEW);
    },
  };
}
