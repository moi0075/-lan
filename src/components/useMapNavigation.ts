import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import {
  INITIAL_MAP_VIEW,
  MAX_MAP_ZOOM,
  MAX_MOBILE_MAP_ZOOM,
  pinchView,
  stepMapInertia,
  zoomAt,
  type MapPoint,
  type MapView,
} from "./mapNavigation";

const MOBILE_MAP_MEDIA =
  "(max-width: 700px), (pointer: coarse), (any-pointer: coarse)";

interface PointerPosition extends MapPoint {
  startX: number;
  startY: number;
}
interface PanMotion {
  velocity: MapPoint;
  lastMove: number;
  pinched: boolean;
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
  // A phone can request a wide desktop viewport or report a fine primary pointer.
  // Touch hardware (and actual touch input) must still receive the mobile limit.
  const touchInput = useRef(navigator.maxTouchPoints > 0);
  const [mobile, setMobile] = useState(
    () => window.matchMedia(MOBILE_MAP_MEDIA).matches || touchInput.current,
  );
  const maxZoom = mobile ? MAX_MOBILE_MAP_ZOOM : MAX_MAP_ZOOM;

  useEffect(() => {
    const query = window.matchMedia(MOBILE_MAP_MEDIA);
    const update = () => {
      const isMobile = query.matches || touchInput.current;
      setMobile(isMobile);
      const limit = isMobile ? MAX_MOBILE_MAP_ZOOM : MAX_MAP_ZOOM;
      setView((current) => zoomAt(current, 1, { x: 500, y: 255 }, limit));
    };
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const [dragging, setDragging] = useState(false);
  const moved = useRef(false);
  const pointers = useRef(new Map<number, PointerPosition>());
  const gestureScale = useRef<number | null>(null);

  const inertiaFrame = useRef<number | null>(null);
  const panMotion = useRef<PanMotion | null>(null);
  const stopInertia = useCallback(() => {
    if (inertiaFrame.current !== null)
      cancelAnimationFrame(inertiaFrame.current);
    inertiaFrame.current = null;
  }, []);
  const startInertia = useCallback((initialVelocity: MapPoint) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (Math.hypot(initialVelocity.x, initialVelocity.y) < 0.08) return;
    const inverse = svg.current?.getScreenCTM()?.inverse();
    if (!inverse) return;
    let velocity = initialVelocity;
    let previous = performance.now();
    const started = previous;
    const frame = (now: number) => {
      const step = stepMapInertia(velocity, Math.min(64, now - previous));
      previous = now;
      velocity = step.velocity;
      // Convert only the vector: translation in the SVG's screen CTM must not
      // influence how far a fling travels on a letterboxed or zoomed map.
      const dx =
        inverse.a * step.displacement.x + inverse.c * step.displacement.y;
      const dy =
        inverse.b * step.displacement.x + inverse.d * step.displacement.y;
      setView((current) => ({
        ...current,
        x: current.x + dx,
        y: current.y + dy,
      }));
      if (now - started < 900 && Math.hypot(velocity.x, velocity.y) >= 0.02)
        inertiaFrame.current = requestAnimationFrame(frame);
      else inertiaFrame.current = null;
    };
    inertiaFrame.current = requestAnimationFrame(frame);
  }, []);
  const finishPointer = useCallback(
    (pointerId: number, allowInertia = false) => {
      if (!pointers.current.delete(pointerId)) return;
      const element = svg.current;
      if (element?.hasPointerCapture(pointerId))
        element.releasePointerCapture(pointerId);
      if (pointers.current.size === 0) {
        setDragging(false);
        const motion = panMotion.current;
        panMotion.current = null;
        if (
          allowInertia &&
          moved.current &&
          motion &&
          !motion.pinched &&
          performance.now() - motion.lastMove < 80
        )
          startInertia(motion.velocity);
      }
    },
    [startInertia],
  );

  const cancelInteraction = useCallback(() => {
    stopInertia();
    panMotion.current = null;
    gestureScale.current = null;
    if (!pointers.current.size) return;
    // Preserve click suppression until the next press, but release ownership
    // immediately so an interrupted drag cannot steal the toolbar's clicks.
    moved.current = true;
    for (const pointerId of [...pointers.current.keys()])
      finishPointer(pointerId);
  }, [finishPointer, stopInertia]);
  const placeView = useCallback(
    (next: SetStateAction<MapView>) => {
      cancelInteraction();
      setView(next);
    },
    [cancelInteraction],
  );

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
      stopInertia();
      if (gestureScale.current !== null) return;
      cancelInteraction();
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
        setView((current) => zoomAt(current, factor, anchor, maxZoom));
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
      stopInertia();
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
      setView((current) => zoomAt(current, factor, anchor, maxZoom));
    };
    const gestureEnd = (event: Event) => {
      event.preventDefault();
      gestureScale.current = null;
    };
    const pointerEnd = (event: PointerEvent) =>
      finishPointer(event.pointerId, true);
    const pointerCancel = (event: PointerEvent) => {
      moved.current = true;
      stopInertia();
      finishPointer(event.pointerId);
    };
    const outsidePress = (event: PointerEvent) => {
      if (event.target instanceof Node && !element.contains(event.target))
        cancelInteraction();
    };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motionPreferenceChange = () => {
      if (reducedMotion.matches) cancelInteraction();
    };
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
    window.addEventListener("pointercancel", pointerCancel, true);
    window.addEventListener("pointerdown", outsidePress, true);
    reducedMotion.addEventListener("change", motionPreferenceChange);
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
      window.removeEventListener("pointercancel", pointerCancel, true);
      window.removeEventListener("pointerdown", outsidePress, true);
      reducedMotion.removeEventListener("change", motionPreferenceChange);
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
  }, [cancelInteraction, finishPointer, stopInertia, maxZoom]);

  const pointerHandlers = {
    onPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
      if (event.button !== 0) return;
      if (event.pointerType === "touch") {
        touchInput.current = true;
        setMobile(true);
      }
      const wasCoasting = inertiaFrame.current !== null;
      stopInertia();
      if (event.pointerType !== "touch") cancelInteraction();
      if (!pointers.current.size) {
        // The first tap during a fling stops the map; it must not submit a country.
        moved.current = wasCoasting;
        panMotion.current = {
          velocity: { x: 0, y: 0 },
          lastMove: performance.now(),
          pinched: false,
        };
      }
      pointers.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
      });
      if (pointers.current.size > 1) {
        if (panMotion.current) panMotion.current.pinched = true;
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
      const screenDelta = {
        x: event.clientX - pointer.x,
        y: event.clientY - pointer.y,
      };
      const now = performance.now();
      const motion = panMotion.current;
      if (motion) {
        const elapsed = Math.max(8, now - motion.lastMove);
        const velocity = {
          x: screenDelta.x / elapsed,
          y: screenDelta.y / elapsed,
        };
        const speed = Math.hypot(velocity.x, velocity.y);
        const cap = Math.min(1, 2.4 / Math.max(speed, 0.001));
        const weight = Math.min(1, elapsed / 40);
        motion.velocity = {
          x: motion.velocity.x * (1 - weight) + velocity.x * cap * weight,
          y: motion.velocity.y * (1 - weight) + velocity.y * cap * weight,
        };
        motion.lastMove = now;
      }
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      const next = toMapPoint(pointer);
      if (pointers.current.size >= 2) {
        const after = [...pointers.current.values()].map(toMapPoint);
        setView((current) =>
          pinchView(
            current,
            [before[0], before[1]],
            [after[0], after[1]],
            maxZoom,
          ),
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
      finishPointer(event.pointerId, true);
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
    setView: placeView,
    stop: cancelInteraction,
    mobile,
    maxZoom,
    moved,
    dragging,
    pointerHandlers,
    zoom: (factor: number) => {
      cancelInteraction();
      setView((current) =>
        zoomAt(current, factor, { x: 500, y: 255 }, maxZoom),
      );
    },
    reset: () => {
      cancelInteraction();
      setView(INITIAL_MAP_VIEW);
    },
  };
}
