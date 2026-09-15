import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { StyleSpecification } from "maplibre-gl";
import type { BoundingBox, EmbeddingPoint } from "../types/embedding.ts";
import type { GeoFeature, GeoFeatureCollection } from "../types/geojson.ts";
import { activeBasemaps, type BasemapKey } from "./basemap.ts";

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
  onDrawArea: (bounds: BoundingBox) => void;
  onSelectPoint: (id: string | null) => void;
  onHoverPoint: (id: string | null) => void;
  onMapReady?: (map: maplibregl.Map) => void;
}

const EMPTY_COLLECTION: GeoFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

function buildPointFeatures(
  points: EmbeddingPoint[],
  colors: Map<string, string> | null,
  neutral: string,
  selectedId: string | null,
  hoveredId: string | null,
): GeoFeature[] {
  const selected = new Set(selectedId ? [selectedId] : []);
  const hovered = new Set(hoveredId ? [hoveredId] : []);
  return points.map((p) => ({
    type: "Feature",
    id: p.id,
    geometry: { type: "Point", coordinates: [p.lon, p.lat] },
    properties: {
      id: p.id,
      color: colors?.get(p.id) ?? neutral,
      sel: selected.has(p.id) ? 1 : 0,
      hov: hovered.has(p.id) ? 1 : 0,
      lat: p.lat,
      lon: p.lon,
    },
  }));
}

export default function MapCanvas(props: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const dragRef = useRef<{ start: maplibregl.LngLat } | null>(null);
  const dragActiveRef = useRef(false);
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
    mapRef.current = map;
    propsRef.current.onMapReady?.(map);

    map.on("load", () => setReady(true));
    if (map.isStyleLoaded()) setReady(true);

    map.on("mousedown", (e) => {
      if (propsRef.current.drawing) {
        dragActiveRef.current = true;
        dragRef.current = { start: e.lngLat };
        e.preventDefault();
      }
    });
    map.on("mouseup", (e) => {
      const drag = dragRef.current;
      if (!propsRef.current.drawing || !drag) return;
      dragActiveRef.current = false;
      dragRef.current = null;
      const start = drag.start;
      const end = e.lngLat;
      const degree = 0.01;
      if (Math.abs(start.lng - end.lng) < degree && Math.abs(start.lat - end.lat) < degree) {
        return;
      }
      propsRef.current.onDrawArea({
        west: Math.min(start.lng, end.lng),
        south: Math.min(start.lat, end.lat),
        east: Math.max(start.lng, end.lng),
        north: Math.max(start.lat, end.lat),
      });
    });
    map.on("click", (e) => {
      if (propsRef.current.drawing || dragActiveRef.current) return;
      if (!map.getLayer("embeddings-circles")) return;
      const features = map.queryRenderedFeatures(e.point, { layers: ["embeddings-circles"] });
      const id = features.length ? (features[0].properties?.id as string | undefined) ?? null : null;
      propsRef.current.onSelectPoint(id);
    });
    map.on("mousemove", (e) => {
      const { hoveredPointId } = propsRef.current;
      if (!map.getLayer("embeddings-circles")) return;
      const features = map.queryRenderedFeatures(e.point, { layers: ["embeddings-circles"] });
      const id = features.length ? (features[0].properties?.id as string | undefined) ?? null : null;
      if (id !== hoveredPointId) propsRef.current.onHoverPoint(id);
    });
    map.on("mouseout", () => {
      if (propsRef.current.hoveredPointId) propsRef.current.onHoverPoint(null);
    });

    return () => {
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
      map.setStyle(style);
    }
  }, [ready, style]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const container = containerRef.current;
    if (container) {
      container.style.cursor = props.drawing ? "crosshair" : "";
    }

    if (!ready) return;

    let source = map.getSource("embeddings") as maplibregl.GeoJSONSource | undefined;
    if (!source) {
      map.addSource("embeddings", {
        type: "geojson",
        data: EMPTY_COLLECTION,
      });
      source = map.getSource("embeddings") as maplibregl.GeoJSONSource;
    }
    if (!map.getLayer("embeddings-circles")) {
      map.addLayer({
        id: "embeddings-circles",
        type: "circle",
        source: "embeddings",
        paint: {
          "circle-radius": [
            "case",
            ["==", ["get", "sel"], 1],
            7,
            ["==", ["get", "hov"], 1],
            5.5,
            3.5,
          ],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.85,
          "circle-stroke-width": ["case", ["==", ["get", "sel"], 1], 1.5, 0],
          "circle-stroke-color": ["get", "color"],
        },
      });
    }
    const features = buildPointFeatures(
      props.points,
      props.pointColors,
      props.neutralColor,
      props.selectedPointId,
      props.hoveredPointId,
    );
    source.setData({ type: "FeatureCollection", features });
  }, [
    props.points,
    props.pointColors,
    props.neutralColor,
    props.selectedPointId,
    props.hoveredPointId,
    props.drawing,
    ready,
  ]);

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
      map.addSource("area", {
        type: "geojson",
        data: areaFeature(area),
      });
    } else {
      (map.getSource("area") as maplibregl.GeoJSONSource).setData(areaFeature(area));
    }
    if (!map.getLayer("area-outline")) {
      map.addLayer({
        id: "area-outline",
        type: "line",
        source: "area",
        paint: {
          "line-color": "#7fd6e0",
          "line-width": 1.5,
          "line-dasharray": [2, 2],
          "line-opacity": 0.9,
        },
      });
      map.addLayer({
        id: "area-fill",
        type: "fill",
        source: "area",
        paint: { "fill-color": "#7fd6e0", "fill-opacity": 0.06 },
      });
    }
  }, [props.area, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const prev = propsRef.current.area;
    const next = props.area;
    propsRef.current = props;
    if (next && (!prev || Math.abs(prev.west - next.west) > 0.001)) {
      map.fitBounds(
        [
          [next.west, next.south],
          [next.east, next.north],
        ],
        { padding: 60, duration: 700, maxZoom: 11 },
      );
    }
  }, [props.area, props]);

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