import { useEffect, useLayoutEffect, useState } from "react";
import { Compass, Expand, LocateFixed, Minus, Plus, X } from "lucide-react";
import shapes from "../data/map.json";
import { countries, countryById, countryByMapId } from "../data/catalog";
import { isMastered, type LearningState } from "../engine/learning";
import type { Answer } from "../engine/storage";
import { useMapNavigation } from "./useMapNavigation";
interface Props {
  learning: LearningState;
  allowExpand?: boolean;
  feedback?: Answer | null;
  hintIds?: readonly string[];
  onSelect: (id: string) => void;
  explore?: boolean;
  selectedId?: string | null;
  questionId?: string;
  namingTargetId?: string;
}
export default function WorldMap({
  learning,
  allowExpand = true,
  feedback,
  hintIds = [],
  onSelect,
  explore = false,
  selectedId,
  questionId,
  namingTargetId,
}: Props) {
  const { svg, view, setView, moved, dragging, pointerHandlers, zoom, reset } =
    useMapNavigation();
  const [expanded, setExpanded] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [hoverReady, setHoverReady] = useState(false);
  const unlocked = new Set(
    countries.slice(0, learning.unlocked).map((c) => c.id),
  );
  useLayoutEffect(() => {
    setHover(null);
    setHoverReady(false);
    // A clicked SVG country can retain keyboard focus after Space advances.
    // Clear that focus before the next question paints its hover/focus styling.
    const active = document.activeElement;
    if (active && svg.current?.contains(active)) (active as HTMLElement).blur();
  }, [questionId, namingTargetId]);
  const centerNamedCountry = () => {
    const c = namingTargetId ? countryById.get(namingTargetId) : undefined;
    if (!c) return reset();
    const k = c.small ? 4 : 1;
    setView({ x: 500 - c.point[0] * k, y: 310 - c.point[1] * k, k });
  };
  useEffect(() => {
    if (namingTargetId) centerNamedCountry();
    else reset();
  }, [namingTargetId]);
  useEffect(() => {
    if (!expanded) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [expanded]);
  useEffect(() => {
    const c = explore && selectedId ? countryById.get(selectedId) : undefined;
    if (c?.small) {
      const k = 6;
      setView({ x: 500 - c.point[0] * k, y: 255 - c.point[1] * k, k });
    }
  }, [selectedId, explore]);
  // During play every country has the same fill, regardless of learning status or answer.
  const color = (id?: string) => {
    if (namingTargetId && id === namingTargetId) return "#9279df";
    if (!explore) return "#d5dfdd";
    if (id === selectedId) return "#7962d5";
    if (id && isMastered(learning.memory[id])) return "#a1cbb7";
    if (id && unlocked.has(id)) return "#bca9e7";
    return "#d5dfdd";
  };
  const marked = (id?: string) =>
    !!id &&
    !explore &&
    (namingTargetId
      ? id === namingTargetId
      : feedback
        ? id === feedback.targetId
        : hintIds.includes(id));
  const choose = (id: string) => {
    if (!namingTargetId && !moved.current && (!feedback || explore))
      onSelect(id);
  };
  return (
    <div
      className={`map-wrap ${expanded ? "map-expanded" : ""} ${explore ? "" : "quiz-map"} ${namingTargetId ? "naming-map" : ""} ${!explore && !feedback && !namingTargetId && !hoverReady ? "map-stale-hover" : ""}`}
    >
      <div className="map-tag">
        <span className="live-dot" />
        {explore ? "EXPLORER LE MONDE" : "CARTE DU MONDE"}
        <span className="map-tag-secondary">PROJECTION NATURAL EARTH</span>
      </div>
      {allowExpand && (
        <div className="map-tools">
          <button
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? "Réduire la carte" : "Agrandir la carte"}
            title={expanded ? "Réduire" : "Agrandir"}
          >
            {expanded ? <X size={17} /> : <Expand size={17} />}
          </button>
        </div>
      )}
      <svg
        ref={svg}
        className={`world-map ${dragging ? "dragging" : ""}`}
        viewBox="0 0 1000 510"
        role="group"
        aria-label={
          namingTargetId
            ? "Carte du monde interactive. Nommez le pays surligné en violet. Glissez pour déplacer la carte, pincez pour zoomer."
            : "Carte du monde interactive. Cliquez sur un pays. Glissez avec deux doigts pour déplacer la carte, pincez pour zoomer. À la souris, faites glisser ou utilisez Ctrl + molette et les boutons de zoom."
        }
        {...pointerHandlers}
        onPointerMove={(event) => {
          pointerHandlers.onPointerMove(event);
          if (!hoverReady) setHoverReady(true);
        }}
        onPointerLeave={(event) => {
          pointerHandlers.onPointerLeave(event);
          setHover(null);
          setHoverReady(true);
        }}
      >
        <defs>
          <pattern
            id="map-grid"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="0.7" fill="#cbd7d8" opacity=".45" />
          </pattern>
        </defs>
        <rect width="1000" height="510" fill="url(#map-grid)" />
        <g
          className="map-content"
          transform={`translate(${view.x} ${view.y}) scale(${view.k})`}
        >
          <g className="ocean-labels" aria-hidden="true">
            <text x="150" y="280">
              OCÉAN PACIFIQUE
            </text>
            <text x="408" y="290">
              OCÉAN ATLANTIQUE
            </text>
            <text x="722" y="390">
              OCÉAN INDIEN
            </text>
            <text x="885" y="272">
              OCÉAN PACIFIQUE
            </text>
          </g>
          {shapes.map((s, i) => {
            const c = countryByMapId.get(s.id),
              id = c?.id || `territory:${s.id}`,
              active = explore && !!c && unlocked.has(c.id);
            return (
              <path
                key={`${s.id}-${i}`}
                d={s.d || ""}
                className={`country-path ${active ? "is-unlocked" : ""}`}
                fill={color(c?.id)}
                stroke="#f6f8f8"
                strokeWidth={0.8 / view.k ** 0.35}
                role={namingTargetId ? "img" : "button"}
                tabIndex={
                  !namingTargetId && c && (!feedback || explore) ? 0 : -1
                }
                aria-label={
                  explore ? c?.name || s.name : `Zone géographique ${i + 1}`
                }
                data-country={c?.id}
                data-naming-target={
                  namingTargetId === c?.id ? "true" : undefined
                }
                onClick={() => choose(id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    moved.current = false;
                    choose(id);
                  }
                }}
                onPointerEnter={() =>
                  setHover(explore || feedback ? c?.name || s.name : null)
                }
                onPointerLeave={() => setHover(null)}
                style={{
                  cursor: namingTargetId
                    ? "grab"
                    : feedback && !explore
                      ? "default"
                      : "pointer",
                }}
              />
            );
          })}
          {countries
            .filter((c) => c.small)
            .map((c) => (
              <circle
                key={c.id}
                cx={c.point[0]}
                cy={c.point[1]}
                r={3.4 / Math.sqrt(view.k)}
                className="country-marker"
                fill={color(c.id)}
                stroke={marked(c.id) ? "#58696d" : "#fff"}
                strokeWidth={(marked(c.id) ? 2 : 1) / view.k}
                data-marker={c.id}
                role={namingTargetId ? "img" : "button"}
                data-naming-target={
                  namingTargetId === c.id ? "true" : undefined
                }
                tabIndex={!namingTargetId && (!feedback || explore) ? 0 : -1}
                aria-label={
                  explore
                    ? c.name
                    : `Repère géographique ${countries.indexOf(c) + 1}`
                }
                onClick={() => choose(c.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    moved.current = false;
                    choose(c.id);
                  }
                }}
                onPointerEnter={() =>
                  setHover(explore || feedback ? c.name : null)
                }
                onPointerLeave={() => setHover(null)}
              />
            ))}
          {/* Draw every complete outline after the base fills so neighbouring
              countries cannot cover shared frontiers. Never intercept clicks. */}
          <g
            className="country-outlines"
            pointerEvents="none"
            aria-hidden="true"
          >
            {shapes.map((shape, index) => {
              const country = countryByMapId.get(shape.id);
              return marked(country?.id) ? (
                <path
                  key={`${shape.id}-${index}`}
                  data-outline-country={country?.id}
                  d={shape.d || ""}
                  fill="none"
                  stroke={namingTargetId ? "#6246b5" : "#58696d"}
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null;
            })}
          </g>
          {namingTargetId &&
            !feedback &&
            (() => {
              const c = countryById.get(namingTargetId)!;
              return (
                <g
                  className="naming-pin"
                  transform={`translate(${c.point.join(" ")}) scale(${1 / view.k})`}
                  pointerEvents="none"
                  aria-hidden="true"
                >
                  <circle r="11" fill="#fff" stroke="#6246b5" strokeWidth="2" />
                  <text
                    textAnchor="middle"
                    dy="4"
                    fill="#6246b5"
                    fontSize="13"
                    fontWeight="700"
                  >
                    ?
                  </text>
                </g>
              );
            })()}
          {!explore &&
            !feedback &&
            hintIds.map((id, index) => {
              const c = countryById.get(id);
              return c ? (
                <g
                  key={id}
                  data-hint-country={id}
                  className="hint-map-marker"
                  transform={`translate(${c.point.join(" ")}) scale(${1 / view.k})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Zone proposée ${index + 1}`}
                  onClick={() => choose(id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      moved.current = false;
                      choose(id);
                    }
                  }}
                >
                  <circle
                    r="9"
                    fill="#fff"
                    stroke="#59696e"
                    strokeWidth="1.2"
                  />
                  <text
                    textAnchor="middle"
                    dy="3.5"
                    fill="#394b51"
                    fontSize="10"
                    fontWeight="600"
                  >
                    {index + 1}
                  </text>
                </g>
              ) : null;
            })}
          {(feedback || (explore && selectedId)) &&
            (() => {
              const c = countryById.get(feedback?.targetId || selectedId || "");
              return c ? (
                <g
                  className="map-pin"
                  transform={`translate(${c.point.join(" ")}) scale(${1 / view.k})`}
                  pointerEvents="none"
                >
                  <circle
                    r="11"
                    fill="none"
                    stroke={feedback ? "#43555b" : "#7962d5"}
                    strokeWidth="2"
                  />
                  <circle r="4" fill={feedback ? "#43555b" : "#7962d5"} />
                  <rect
                    x={-Math.min(140, Math.max(44, c.name.length * 4 + 10))}
                    y="-42"
                    width={Math.min(280, Math.max(88, c.name.length * 8 + 20))}
                    height="25"
                    rx="6"
                    fill="#fff"
                  />
                  <text y="-25" textAnchor="middle">
                    {c.name}
                  </text>
                </g>
              ) : null;
            })()}
        </g>
      </svg>
      {hover && <div className="map-hover">{hover}</div>}
      <div className="map-compass" aria-hidden="true">
        <span>N</span>
        <Compass size={29} strokeWidth={1} />
      </div>
      <div className="map-bottom">
        {explore ? (
          <div className="map-legend">
            <span>
              <i className="legend-dot unlocked" />À apprendre
            </span>
            <span>
              <i className="legend-dot mastered" />
              Acquis
            </span>
            <span className="legend-locked">
              <i className="legend-dot locked" />À découvrir
            </span>
          </div>
        ) : (
          <div className="map-legend quiz-legend">
            <span>
              {feedback
                ? "Bonne position indiquée par le repère"
                : namingTargetId
                  ? "Pays à nommer · surligné en violet"
                  : hintIds.length
                    ? "5 zones proposées · une seule bonne réponse"
                    : "Carte sans indices"}
            </span>
          </div>
        )}
        <div className="zoom-controls">
          <button
            onClick={() => zoom(1 / 1.65)}
            aria-label="Dézoomer"
            disabled={view.k <= 1}
          >
            <Minus size={17} />
          </button>
          <span>{Math.round(view.k * 100)}%</span>
          <button
            onClick={() => zoom(1.65)}
            aria-label="Zoomer"
            disabled={view.k >= 12}
          >
            <Plus size={17} />
          </button>
          <button
            onClick={namingTargetId ? centerNamedCountry : reset}
            aria-label="Recentrer la carte"
            title="Recentrer"
          >
            <LocateFixed size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
