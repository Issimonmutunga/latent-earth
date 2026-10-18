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

## Using the app

The bar at the top walks you through three steps, and the line under it always
says what to do next:

1. **Choose source** — the embedding model to read.
2. **Pick area** — drag a box on the map, search a place, use the current view,
   or paste `west, south, east, north`.
3. **Retrieve** — loads a grid of real embeddings (pick the size and year in the
   `500 pts` menu).

The first time you use AlphaEarth you'll be asked for your own Earth Engine
project ID — press `?` in the app for the full guide, including how to get one.

Then explore: hover points for a tooltip, click one to inspect it, **Find
similar places**, pin up to 5 points to compare, or **Find clusters**. Use
*Color points by* (bottom-left) to switch between clusters, similarity and
target. **+ Target** attaches real ground truth — a CSV (`lat`, `lon`, value
column) or GeoJSON of points, or labels you type in the inspector — and the
Analysis view reports how well the embedding predicts it (k-NN, leave-one-out).
**Export** downloads CSV/GeoJSON or copies a session summary. Press `?` for
keyboard shortcuts (`D` draw, `R` retrieve, `1`–`4` views, `B` basemap, `Esc`).

## Architecture

- React + TypeScript + Vite
- MapLibre GL full-screen basemap
- Provider-independent embedding sources behind a common interface
- All analysis (PCA, k-means, cosine similarity) runs in the browser

Embedding sources are listed in `src/embeddings/registry/sources.ts`. Real
providers (AlphaEarth, TESSERA, Clay) surface explicit errors until their
network integration is verified. A mock source exists for UI development only
and is never present in production builds.

### AlphaEarth (Google Earth Engine) — bring your own project

The AlphaEarth source reads `GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL` through the
client-side Earth Engine API. **Each researcher uses their own Earth Engine
project**: they sign in with Google and paste their project ID once (saved in
their browser), so all compute runs on their own free noncommercial quota and
none on the site owner's. The in-app **Guide** (`?`) walks users through
registering a project at code.earthengine.google.com/register.

The deployment only provides the Google sign-in client:

```sh
VITE_GEE_CLIENT_ID=your-oauth-client-id.apps.googleusercontent.com
# Optional, private deployments only: a project everyone shares by default.
# Leave unset on a public site so nobody falls back to your project.
# VITE_GEE_PROJECT_ID=your-ee-project-id
```

Without `VITE_GEE_CLIENT_ID` the AlphaEarth source stays disabled
(`integration-pending`).

#### One-time setup for whoever runs the site

In the [Google Cloud Console](https://console.cloud.google.com/), in any project
you own (it doesn't need Earth Engine itself):

1. **OAuth consent screen** (Google Auth Platform → Branding/Audience): app name,
   support email, and the scope
   `https://www.googleapis.com/auth/earthengine.readonly`.
   - While the app is in **Testing**, only accounts listed as **test users** can
     sign in (up to 100).
   - To let anyone sign in, **publish** it to *In production*. Until Google
     verifies the app, users see a "Google hasn't verified this app" screen they
     can click through (*Advanced → Go to …*), and Google limits how many new
     users an unverified app can have. Submit it for verification (needs a
     homepage and privacy policy) to remove both.
2. **Credentials → Create OAuth client ID → Web application.** Under
   **Authorized JavaScript origins** add every address the app is served from,
   with no trailing slash, e.g. `https://latent-earth.vercel.app` and
   `http://localhost:5173`. Redirect URIs are not needed. A popup error
   `Error 400: origin_mismatch` means an origin is missing; changes can take a few
   minutes to apply.
3. Put the client ID in `.env.local` for local development and in Vercel →
   Project → Settings → **Environment Variables** for deployment, then redeploy
   (Vite inlines `VITE_*` at build time).

Sign-in uses Google Identity Services: Retrieve opens Google's popup on that
click, and the token is kept in memory for the tab only.

### Deploying

The app is a static Vite build (`dist/`); it can be hosted anywhere (Vercel,
Netlify, etc.) once the variables above are set and the deployed origin is listed
on the OAuth client.

Data license (CC-BY 4.0) attribution: *"The AlphaEarth Foundations Satellite
Embedding dataset is produced by Google and Google DeepMind."*

See `docs/development/DEVELOPMENT_SPEC.md` (development roadmap) and
`docs/uiux/UI_UX_SPEC.md` (UI/UX specification).