import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { StyleSpecification } from "maplibre-gl";
import type { BoundingBox, EmbeddingPoint } from "../types/embedding.ts";
import type { GeoFeature, GeoFeatureCollection } from "../types/geojson.ts";
import type { MapRequest } from "../app/workspace.tsx";
import { activeBasemaps, type BasemapKey } from "./basemap.ts";
import { publishMapStatus } from "./mapHandle.ts";

export interface PointDescription {
  title: string;
  lines: string[];
}

interface MapCanvasProps {
  basemapKey: BasemapKey;
  area: BoundingBox | null;
  drawing: boolean;
  points: EmbeddingPoint[];
  /** id -> hex color. Omit/empty to use the neutral color for all points. */
  pointColors: Map<string, string> | null;
  neutralColor: string;
  /** Theme accent for the area outline and highlight rings. */
  accentColor: string;
  selectedPointId: string | null;
  hoveredPointId: string | null;
  queryPointId: string | null;
  pinnedIds: string[];
  /** Layer visibility from the Layers panel. */
  showPoints: boolean;
  showArea: boolean;
  mapRequest: MapRequest | null;
  describePoint: (id: string) => PointDescription | null;
  onDrawArea: (bounds: BoundingBox) => void;
  onSelectPoint: (id: string | null) => void;
  onHoverPoint: (id: string | null) => void;
  onMapReady?: (map: maplibregl.Map) => void;
}

const EMPTY_COLLECTION: GeoFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

const POINT_LAYER = "embeddings-circles";
/** Minimum drag, in screen pixels, for a drawn box to count. */
const MIN_DRAG_PX = 6;

function buildPointFeatures(
  points: EmbeddingPoint[],
  colors: Map<string, string> | null,
  neutral: string,
  selectedId: string | null,
  hoveredId: string | null,
  queryId: string | null,
  pinned: Set<string>,
): GeoFeature[] {
  return points.map((p) => ({
    type: "Feature",
    id: p.id,
    geometry: { type: "Point", coordinates: [p.lon, p.lat] },
    properties: {
      id: p.id,
      color: colors?.get(p.id) ?? neutral,
      sel: p.id === selectedId ? 1 : 0,
      hov: p.id === hoveredId ? 1 : 0,
      q: p.id === queryId ? 1 : 0,
      pin: pinned.has(p.id) ? 1 : 0,
    },
  }));
}

function boxFrom(a: maplibregl.LngLat, b: maplibregl.LngLat): BoundingBox {
  return {
    west: Math.max(-180, Math.min(a.lng, b.lng)),
    south: Math.max(-85, Math.min(a.lat, b.lat)),
    east: Math.min(180, Math.max(a.lng, b.lng)),
    north: Math.min(85, Math.max(a.lat, b.lat)),
  };
}

function pointStrokeColor(accent: string): maplibregl.ExpressionSpecification {
  return [
    "case",
    ["==", ["get", "q"], 1],
    "#ffffff",
    ["any", ["==", ["get", "sel"], 1], ["==", ["get", "hov"], 1], ["==", ["get", "pin"], 1]],
    accent,
    "rgba(0,0,0,0.55)",
  ];
}

function ensureDraftLayer(map: maplibregl.Map, accent: string): maplibregl.GeoJSONSource {
  if (!map.getSource("draft-area")) {
    map.addSource("draft-area", { type: "geojson", data: EMPTY_COLLECTION });
    map.addLayer({
      id: "draft-area-fill",
      type: "fill",
      source: "draft-area",
      paint: { "fill-color": accent, "fill-opacity": 0.12 },
    });
    map.addLayer({
      id: "draft-area-outline",
      type: "line",
      source: "draft-area",
      paint: { "line-color": accent, "line-width": 2 },
    });
  }
  return map.getSource("draft-area") as maplibregl.GeoJSONSource;
}

export default function MapCanvas(props: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const dragRef = useRef<{ start: maplibregl.LngLat; startPx: maplibregl.Point; last: maplibregl.LngLat } | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [ready, setReady] = useState(false);
  // False from the moment a new basemap style is requested until it loads, so
  // layer effects in the same render don't touch a style that is being replaced.
  const styleReadyRef = useRef(false);
  // Bumped on every style load. A fast basemap switch can batch "not ready"
  // and "ready" into one render, so layer effects key off this counter.
  const [styleGen, setStyleGen] = useState(0);

  const style = activeBasemaps[props.basemapKey] as StyleSpecification;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [20, 20],
      zoom: 1.6,
      // Basemap tiles stop at z19; deeper zoom is just blurry pixels.
      maxZoom: 18,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 100 }), "bottom-right");
    mapRef.current = map;
    popupRef.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 10,
      className: "point-tooltip",
      maxWidth: "260px",
    });
    propsRef.current.onMapReady?.(map);
    publishMapStatus({ zoom: map.getZoom() });
    map.on("zoom", () => publishMapStatus({ zoom: map.getZoom() }));
    // Side panels open and close around the map; keep the canvas sized to fit.
    const resizer = new ResizeObserver(() => map.resize());
    resizer.observe(containerRef.current);

    // Fires on the first load and again after every basemap switch.
    map.on("style.load", () => {
      styleReadyRef.current = true;
      setReady(true);
      setStyleGen((g) => g + 1);
    });
    if (map.isStyleLoaded()) {
      styleReadyRef.current = true;
      setReady(true);
    }

    const beginDraft = (lngLat: maplibregl.LngLat, point: maplibregl.Point) => {
      dragRef.current = { start: lngLat, startPx: point, last: lngLat };
      ensureDraftLayer(map, propsRef.current.accentColor).setData(EMPTY_COLLECTION);
    };
    const moveDraft = (lngLat: maplibregl.LngLat) => {
      const drag = dragRef.current;
      if (!drag) return;
      drag.last = lngLat;
      ensureDraftLayer(map, propsRef.current.accentColor).setData(areaFeature(boxFrom(drag.start, lngLat)));
    };
    const endDraft = (point: maplibregl.Point | null) => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag) return;
      if (map.getSource("draft-area")) ensureDraftLayer(map, propsRef.current.accentColor).setData(EMPTY_COLLECTION);
      const end = point ?? map.project(drag.last);
      if (Math.abs(end.x - drag.startPx.x) < MIN_DRAG_PX && Math.abs(end.y - drag.startPx.y) < MIN_DRAG_PX) {
        return;
      }
      propsRef.current.onDrawArea(boxFrom(drag.start, drag.last));
    };

    map.on("mousedown", (e) => {
      if (!propsRef.current.drawing) return;
      e.preventDefault();
      beginDraft(e.lngLat, e.point);
    });
    map.on("touchstart", (e) => {
      if (!propsRef.current.drawing || e.points.length !== 1) return;
      e.preventDefault();
      beginDraft(e.lngLat, e.point);
    });
    map.on("touchmove", (e) => {
      if (dragRef.current) {
        e.preventDefault();
        moveDraft(e.lngLat);
      }
    });
    map.on("touchend", () => endDraft(null));
    map.on("mouseup", (e) => {
      if (dragRef.current) {
        dragRef.current.last = e.lngLat;
        endDraft(e.point);
      }
    });
    // A small hit box makes 3px points easy to hover and click.
    const pointIdAt = (p: maplibregl.Point): string | null => {
      if (!map.getLayer(POINT_LAYER)) return null;
      const pad = 5;
      const features = map.queryRenderedFeatures(
        [
          [p.x - pad, p.y - pad],
          [p.x + pad, p.y + pad],
        ],
        { layers: [POINT_LAYER] },
      );
      return features.length ? (features[0].properties?.id as string | undefined) ?? null : null;
    };

    map.on("click", (e) => {
      if (propsRef.current.drawing || !map.getLayer(POINT_LAYER)) return;
      propsRef.current.onSelectPoint(pointIdAt(e.point));
    });
    map.on("mousemove", (e) => {
      publishMapStatus({ cursor: { lng: e.lngLat.lng, lat: e.lngLat.lat } });
      if (dragRef.current) {
        moveDraft(e.lngLat);
        return;
      }
      if (propsRef.current.drawing || !map.getLayer(POINT_LAYER)) return;
      const id = pointIdAt(e.point);
      map.getCanvas().style.cursor = id ? "pointer" : "";
      if (id !== propsRef.current.hoveredPointId) propsRef.current.onHoverPoint(id);
    });
    map.on("mouseout", () => {
      publishMapStatus({ cursor: null });
      if (propsRef.current.hoveredPointId) propsRef.current.onHoverPoint(null);
    });

    return () => {
      resizer.disconnect();
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const current = map.getStyle() as StyleSpecification | undefined;
    if (current && current.name !== style.name) {
      styleReadyRef.current = false;
      setReady(false);
      map.setStyle(style, { diff: false });
    }
  }, [ready, style]);

  // Drawing mode: crosshair, and dragging draws instead of panning.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = props.drawing ? "crosshair" : "";
    if (props.drawing) {
      map.dragPan.disable();
      map.touchZoomRotate.disable();
    } else {
      map.dragPan.enable();
      map.touchZoomRotate.enable();
      dragRef.current = null;
      if (map.getSource("draft-area")) ensureDraftLayer(map, propsRef.current.accentColor).setData(EMPTY_COLLECTION);
    }
  }, [props.drawing]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !styleReadyRef.current) return;

    let source = map.getSource("embeddings") as maplibregl.GeoJSONSource | undefined;
    if (!source) {
      map.addSource("embeddings", { type: "geojson", data: EMPTY_COLLECTION });
      source = map.getSource("embeddings") as maplibregl.GeoJSONSource;
    }
    if (!map.getLayer(POINT_LAYER)) {
      map.addLayer({
        id: POINT_LAYER,
        type: "circle",
        source: "embeddings",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            2,
            ["case", ["==", ["get", "sel"], 1], 6, ["==", ["get", "q"], 1], 6, ["==", ["get", "hov"], 1], 5, 2.5],
            10,
            ["case", ["==", ["get", "sel"], 1], 9, ["==", ["get", "q"], 1], 9, ["==", ["get", "hov"], 1], 7.5, 4.5],
          ],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.9,
          "circle-stroke-width": [
            "case",
            ["any", ["==", ["get", "sel"], 1], ["==", ["get", "q"], 1]],
            2.5,
            ["any", ["==", ["get", "hov"], 1], ["==", ["get", "pin"], 1]],
            2,
            0.6,
          ],
          "circle-stroke-color": pointStrokeColor(props.accentColor),
        },
      });
    }
    const features = buildPointFeatures(
      props.points,
      props.pointColors,
      props.neutralColor,
      props.selectedPointId,
      props.hoveredPointId,
      props.queryPointId,
      new Set(props.pinnedIds),
    );
    source.setData({ type: "FeatureCollection", features });
    map.setLayoutProperty(POINT_LAYER, "visibility", props.showPoints ? "visible" : "none");
  }, [
    props.showPoints,
    props.points,
    props.pointColors,
    props.neutralColor,
    props.selectedPointId,
    props.hoveredPointId,
    props.queryPointId,
    props.pinnedIds,
    ready,
    styleGen,
  ]);

  // Hover tooltip, shared with the other views through the hovered point id.
  useEffect(() => {
    const map = mapRef.current;
    const popup = popupRef.current;
    if (!map || !popup) return;
    const id = props.hoveredPointId;
    const point = id ? props.points.find((p) => p.id === id) : null;
    const info = point ? propsRef.current.describePoint(point.id) : null;
    if (!point || !info || props.drawing) {
      popup.remove();
      return;
    }
    const root = document.createElement("div");
    const title = document.createElement("div");
    title.className = "point-tooltip__title";
    title.textContent = info.title;
    root.appendChild(title);
    for (const line of info.lines) {
      const el = document.createElement("div");
      el.className = "point-tooltip__line";
      el.textContent = line;
      root.appendChild(el);
    }
    popup.setLngLat([point.lon, point.lat]).setDOMContent(root);
    if (!popup.isOpen()) popup.addTo(map);
  }, [props.hoveredPointId, props.points, props.pointColors, props.drawing]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !styleReadyRef.current) return;
    const area = props.area;
    if (!area) {
      if (map.getLayer("area-fill")) map.removeLayer("area-fill");
      if (map.getLayer("area-outline")) map.removeLayer("area-outline");
      if (map.getSource("area")) map.removeSource("area");
      return;
    }
    if (!map.getSource("area")) {
      map.addSource("area", { type: "geojson", data: areaFeature(area) });
    } else {
      (map.getSource("area") as maplibregl.GeoJSONSource).setData(areaFeature(area));
    }
    const beforeId = map.getLayer(POINT_LAYER) ? POINT_LAYER : undefined;
    if (!map.getLayer("area-fill")) {
      map.addLayer(
        {
          id: "area-fill",
          type: "fill",
          source: "area",
          paint: { "fill-color": props.accentColor, "fill-opacity": 0.1 },
        },
        beforeId,
      );
    }
    if (!map.getLayer("area-outline")) {
      map.addLayer(
        {
          id: "area-outline",
          type: "line",
          source: "area",
          paint: {
            "line-color": props.accentColor,
            "line-width": 2.6,
            "line-dasharray": [2, 2],
            "line-opacity": 0.95,
          },
        },
        beforeId,
      );
    }
    for (const id of ["area-fill", "area-outline"]) {
      map.setLayoutProperty(id, "visibility", props.showArea ? "visible" : "none");
    }
  }, [props.area, props.showArea, ready, styleGen]);

  // Theme switch: recolor layers that already exist.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !styleReadyRef.current) return;
    const accent = props.accentColor;
    if (map.getLayer(POINT_LAYER)) map.setPaintProperty(POINT_LAYER, "circle-stroke-color", pointStrokeColor(accent));
    if (map.getLayer("area-fill")) map.setPaintProperty("area-fill", "fill-color", accent);
    if (map.getLayer("area-outline")) map.setPaintProperty("area-outline", "line-color", accent);
    if (map.getLayer("draft-area-fill")) map.setPaintProperty("draft-area-fill", "fill-color", accent);
    if (map.getLayer("draft-area-outline")) map.setPaintProperty("draft-area-outline", "line-color", accent);
  }, [props.accentColor, ready, styleGen]);

  // Camera requests: fit to a searched/pasted area, or fly to a point.
  useEffect(() => {
    const map = mapRef.current;
    const req = props.mapRequest;
    if (!map || !req) return;
    if (req.kind === "fit") {
      map.fitBounds(
        [
          [req.bounds.west, req.bounds.south],
          [req.bounds.east, req.bounds.north],
        ],
        { padding: 80, duration: 800, maxZoom: 13 },
      );
    } else {
      map.flyTo({ center: [req.lon, req.lat], zoom: Math.max(map.getZoom(), 11), duration: 800 });
    }
  }, [props.mapRequest]);

  return <div ref={containerRef} className="map-canvas" aria-label="Map workspace" />;
}

function areaFeature(area: BoundingBox): GeoFeature {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [area.west, area.south],
          [area.west, area.north],
          [area.east, area.north],
          [area.east, area.south],
          [area.west, area.south],
        ],
      ],
    },
  };
}
