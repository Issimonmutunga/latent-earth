# Latent Earth

A lightweight browser laboratory for discovering signals hidden inside
Earth-observation embeddings.

Select an embedding source, draw an area anywhere on Earth, retrieve a modest
sample, and explore whether the representation contains a useful signal about
what you are studying — across geographic space and embedding space.

## Development

```sh
npm install
npm run dev        # start Vite dev server
npm run build      # typecheck + production build
npm run test       # run unit tests (vitest)
npm run typecheck  # TypeScript only
```

## Architecture

- React + TypeScript + Vite
- MapLibre GL full-screen basemap
- Provider-independent embedding sources behind a common interface
- All analysis (PCA, k-means, cosine similarity) runs in the browser

Embedding sources are listed in `src/embeddings/registry/sources.ts`. Real
providers (AlphaEarth, TESSERA, Clay) are integration-pending: they have no
network implementation until their APIs are verified. A mock source exists for
UI development only and is never present in production builds.

See `docs/development/DEVELOPMENT_SPEC.md` (development roadmap) and
`docs/uiux/UI_UX_SPEC.md` (UI/UX specification).