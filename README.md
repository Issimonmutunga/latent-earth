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
providers (AlphaEarth, TESSERA, Clay) surface explicit errors until their
network integration is verified. A mock source exists for UI development only
and is never present in production builds.

### AlphaEarth (Google Earth Engine)

The AlphaEarth source reads `GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL` through the
client-side Earth Engine API. Users connect with their own Earth Engine
account, so no secret is embedded in the app:

```sh
VITE_GEE_PROJECT_ID=your-ee-project-id
VITE_GEE_CLIENT_ID=your-oauth-client-id.apps.googleusercontent.com
```

Set the variables in a local `.env.local` file (or environment) before
`npm run dev`. The OAuth client ID is a *Web* OAuth 2.0 Client created in the
same Cloud project, with the app's URL (e.g. `http://localhost:5199`) listed
under **Authorized JavaScript origins**. Without both variables the source stays
disabled (`integration-pending`). In the app, choose AlphaEarth, hit **Connect**
in the Source step, sign in with Google, then draw an area and retrieve a sample.

### Deploying

The app is a static Vite build (`dist/`); it can be hosted anywhere (Vercel,
Netlify, etc.). For the Earth Engine sign-in to work on a deployed origin,
provide the same two variables as Vercel/Netlify **environment variables**
(Vite inlines `VITE_*` at build time), and add the deployed origin (e.g.
`https://your-domain.com`) to the OAuth client's **Authorized JavaScript
origins** in the Google Cloud Console.

Data license (CC-BY 4.0) attribution: *"The AlphaEarth Foundations Satellite
Embedding dataset is produced by Google and Google DeepMind."*

See `docs/development/DEVELOPMENT_SPEC.md` (development roadmap) and
`docs/uiux/UI_UX_SPEC.md` (UI/UX specification).