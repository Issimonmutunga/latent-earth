import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { StyleSpecification } from "maplibre-gl";
import type { BoundingBox, EmbeddingPoint } from "../types/embedding.ts";
import type { GeoFeature, GeoFeatureCollection } from "../types/geojson.ts";
import type { MapRequest } from "../app/workspace.tsx";
import { activeBasemaps, type BasemapKey } from "./basemap.ts";

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
  selectedPointId: string | null;
  hoveredPointId: string | null;
  queryPointId: string | null;
  pinnedIds: string[];
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

const ACCENT = "#7fd6e0";
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

function ensureDraftLayer(map: maplibregl.Map): maplibregl.GeoJSONSource {
  if (!map.getSource("draft-area")) {
    map.addSource("draft-area", { type: "geojson", data: EMPTY_COLLECTION });
    map.addLayer({
      id: "draft-area-fill",
      type: "fill",
      source: "draft-area",
      paint: { "fill-color": ACCENT, "fill-opacity": 0.12 },
    });
    map.addLayer({
      id: "draft-area-outline",
      type: "line",
      source: "draft-area",
      paint: { "line-color": ACCENT, "line-width": 2 },
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

  const style = activeBasemaps[props.basemapKey] as StyleSpecification;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [20, 20],
      zoom: 1.6,
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

    // Fires on the first load and again after every basemap switch.
    map.on("style.load", () => setReady(true));
    if (map.isStyleLoaded()) setReady(true);

    const beginDraft = (lngLat: maplibregl.LngLat, point: maplibregl.Point) => {
      dragRef.current = { start: lngLat, startPx: point, last: lngLat };
      ensureDraftLayer(map).setData(EMPTY_COLLECTION);
    };
    const moveDraft = (lngLat: maplibregl.LngLat) => {
      const drag = dragRef.current;
      if (!drag) return;
      drag.last = lngLat;
      ensureDraftLayer(map).setData(areaFeature(boxFrom(drag.start, lngLat)));
    };
    const endDraft = (point: maplibregl.Point | null) => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag) return;
      if (map.getSource("draft-area")) ensureDraftLayer(map).setData(EMPTY_COLLECTION);
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
      if (propsRef.current.hoveredPointId) propsRef.current.onHoverPoint(null);
    });

    return () => {
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
      if (map.getSource("draft-area")) ensureDraftLayer(map).setData(EMPTY_COLLECTION);
    }
  }, [props.drawing]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

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
          "circle-stroke-color": [
            "case",
            ["==", ["get", "q"], 1],
            "#ffffff",
            ["any", ["==", ["get", "sel"], 1], ["==", ["get", "hov"], 1], ["==", ["get", "pin"], 1]],
            ACCENT,
            "rgba(0,0,0,0.55)",
          ],
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
  }, [
    props.points,
    props.pointColors,
    props.neutralColor,
    props.selectedPointId,
    props.hoveredPointId,
    props.queryPointId,
    props.pinnedIds,
    ready,
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
    if (!map || !ready) return;
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
          paint: { "fill-color": ACCENT, "fill-opacity": 0.07 },
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
            "line-color": ACCENT,
            "line-width": 1.8,
            "line-dasharray": [2, 2],
            "line-opacity": 0.95,
          },
        },
        beforeId,
      );
    }
  }, [props.area, ready]);

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
