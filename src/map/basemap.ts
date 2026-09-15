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
      tiles: ["https://tiles.stadiamaps.com/tiles/alidade_tile/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© Stadia Maps © OpenMapTiles © OpenStreetMap contributors",
      maxzoom: 20,
    },
  },
  layers: [
    {
      id: "basemap",
      type: "raster",
      source: "basemap",
      paint: {
        "raster-opacity": 0.85,
        "raster-saturation": -0.7,
        "raster-contrast": 0.08,
        "raster-brightness-min": 0.12,
        "raster-brightness-max": 0.55,
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
      tiles: ["https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© Stadia Maps © OpenMapTiles © OpenStreetMap contributors",
      maxzoom: 20,
    },
  },
  layers: [
    {
      id: "basemap",
      type: "raster",
      source: "basemap",
      paint: { "raster-opacity": 0.9, "raster-saturation": -0.25 },
    },
  ],
};

export const activeBasemaps = {
  dark: darkBasemap,
  light: lightBasemap,
} as const;

export type BasemapKey = keyof typeof activeBasemaps;