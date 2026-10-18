import type { StyleSpecification } from "maplibre-gl";

/**
 * Inline minimal dark scientific basemap (no external tileserver needed for
 * structure; the land/ocean/coastline fills come from a raster source URL).
 * Kept as a single definition so the map renders consistently in all modes.
 */
export const darkBasemap: StyleSpecification = {
  version: 8,
  name: "Latent Earth dark",
  sources: {
    basemap: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "basemap",
      type: "raster",
      source: "basemap",
      // Inverting brightness and rotating hue turns standard OSM tiles into
      // a true dark map (dark land, light roads) rather than a grey wash.
      paint: {
        "raster-opacity": 1,
        "raster-hue-rotate": 180,
        "raster-brightness-min": 0.9,
        "raster-brightness-max": 0.08,
        "raster-saturation": -0.7,
        "raster-contrast": 0.1,
      },
    },
  ],
};

export const lightBasemap: StyleSpecification = {
  version: 8,
  name: "Latent Earth light",
  sources: {
    basemap: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "basemap",
      type: "raster",
      source: "basemap",
      paint: { "raster-opacity": 1, "raster-saturation": -0.35, "raster-contrast": -0.05 },
    },
  ],
};

/** Keyless Esri World Imagery — real satellite context for Earth observation. */
export const satelliteBasemap: StyleSpecification = {
  version: 8,
  name: "Latent Earth satellite",
  sources: {
    basemap: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
      maxzoom: 19,
    },
  },
  layers: [{ id: "basemap", type: "raster", source: "basemap" }],
};

export const activeBasemaps = {
  dark: darkBasemap,
  light: lightBasemap,
  satellite: satelliteBasemap,
} as const;

export const BASEMAP_LABELS: Record<BasemapKey, string> = {
  dark: "Dark",
  light: "Map",
  satellite: "Satellite",
};

export type BasemapKey = keyof typeof activeBasemaps;