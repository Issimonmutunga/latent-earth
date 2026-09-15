# Latent Earth — UI/UX Specification

**Version:** 1.0
**Status:** For implementation
**Audience:** Software development agent building the front end

---

## 0. Design Premise

Latent Earth is a scientific instrument for one question:

> **"Does this embedding contain a useful signal about what I'm studying?"**

It is not a dashboard, not a GIS product, not an "AI platform." Every screen, component, and interaction should be justified against the primary workflow:

```
Embedding source → Area → Explore (Target optional, layered in for hypothesis testing)
```

No step should require more than a few seconds of decision-making. The map is the interface. Everything else is a thin, floating, dismissible layer on top of it.

**Non-goals:** account management screens, elaborate settings panels, onboarding wizards, marketing surfaces, notification centers, multi-page navigation. If a feature can't be reached in ≤2 interactions from the map, reconsider it.

**Data integrity principle:** the *shipped product* never fabricates or displays synthetic/mock embeddings, placeholder statistics, or fake sample points to fill the UI at runtime. Every visualization a researcher sees renders only real data returned by a real embedding source and a real user-defined area/target. When no real data is available yet (no area selected, no source chosen, a query returned nothing), the UI shows an explicit empty or prompt state — never a dummy chart, fabricated scatter, or simulated "example" dataset. If real data cannot be fetched, the interface asks the researcher for the missing input (an area, a different date range) rather than substituting invented values.

This principle governs runtime/user-facing behavior only. It does not restrict engineering practice: developers should freely use synthetic fixtures, mocked API responses, and generated test data for unit tests, component development, and CI — none of which is ever visible to a real researcher in the shipped app. Keep test fixtures clearly namespaced/isolated from any code path a production user can reach.

---

## 1. Information Architecture

Latent Earth has **one primary surface** (the Map Workspace) and **four coordinated views** that share the same underlying data context (source, area, target, sample). Views are not separate pages — they are panels/modes within the same workspace, so state never resets when switching between them.

```
Latent Earth
│
├── Map Workspace (root, always mounted)
│   ├── Map View            — geographic space, base layer
│   ├── Embedding View       — projected embedding space (UMAP/PCA scatter)
│   ├── Similarity View      — query-point similarity field
│   └── Analysis View        — PCA / clustering / correlation / classification
│
├── Floating Control Surface (persistent, collapsible)
│   ├── Source selector
│   ├── Area tool
│   ├── Target selector
│   └── Sample controls
│
├── Inspector (contextual side panel, opens on selection)
│   ├── Point/region detail
│   ├── Embedding vector summary
│   └── Comparison tray
│
└── Session Drawer (secondary, hidden by default)
    ├── Current session summary (source, area, target, sample size, timestamp)
    ├── Export (CSV/GeoJSON/PNG)
    └── Method notes (what algorithm ran, with what parameters)
```

There is no traditional navbar, no sidebar-as-default, no settings page. "Navigation" is really **mode-switching** between four synchronized views of the same data.

---

## 2. Navigation Model

### 2.1 View switcher
A small segmented control, floating bottom-center or top-right (see §12), with four modes:

```
[ Map ]  [ Embedding ]  [ Similarity ]  [ Analysis ]
```

- Switching modes is instantaneous (<150ms) since all views share one in-memory dataset — no reload, no re-fetch.
- The currently active mode's icon is filled; others are outlined.
- Keyboard shortcuts: `1` `2` `3` `4` (or `M` `E` `S` `A`).
- The switcher is disabled (greyed, not hidden) until a sample of embeddings has been retrieved. Hovering a disabled mode shows a one-line tooltip: *"Retrieve a sample first."*

### 2.2 No breadcrumb, no back button
Because there's only one workspace, there's no page-to-page navigation to track. Browser back/forward retain their normal, conventional semantics (browser history) and are not repurposed for in-app actions — avoid surprising researchers with non-standard back-button behavior. Instead, session state (source, bbox, target id, sample id) is encoded in the URL as query params purely for **shareability/bookmarking**: pasting a Latent Earth URL to a colleague reproduces the same source/area/target/sample. Undo of an area or target change, if needed, is a separate explicit in-app affordance (e.g., a small "revert" action on the relevant control-bar step), not tied to browser history.

### 2.3 Session Drawer
A thin tab on the right edge of the screen, collapsed by default (~4px visible edge). Drag or click to reveal. Contains only what's needed to reproduce or export the current session — never a general "history" or "projects" feature in v1.

---

## 3. Primary Screen — Map Workspace

### 3.1 Layout
Full-viewport map (Mapbox GL / MapLibre style, dark scientific basemap by default — see §14). No header bar. No page title. Branding is a single small wordmark, bottom-left, 40% opacity, non-interactive except as a link to a minimal about state.

```
┌──────────────────────────────────────────────────────────┐
│                                                            │
│                                                            │
│                     FULL-SCREEN MAP                       │
│                                                            │
│   ┌─────────────────────────┐                             │
│   │  Floating Control Bar    │              ┌───────────┐ │
│   └─────────────────────────┘              │ Inspector │ │
│                                              │ (on-demand)│ │
│                                              └───────────┘ │
│                                                            │
│                                    [Map][Embed][Sim][An.] │
│  Latent Earth                                             │
└──────────────────────────────────────────────────────────┘
```

### 3.2 Floating Control Bar
Positioned top-left or top-center, floating over the map with a subtle blurred/translucent background (see §14 for materials). Height stays under 56px collapsed. It is a **single horizontal strip of steps**, each a compact button that expands into a small popover when clicked — never a full-screen modal, never a wizard.

The bar has three core steps (**Source → Area → Retrieve**) plus one optional analytical step (**Target**) that is visually de-emphasized until attached. Target is not a gate to exploration — a researcher can retrieve and explore a sample with zero targets attached, matching the product's actual discover-first, test-second usage pattern (see Journey C, §17).

```
[ ⛭ AlphaEarth v2  ▾ ]  [ ▭ Draw area ]  [ ● Sample: 500 · Retrieve ]  [ ◎ + Add target (optional) ]
```

- **Step 1 — Source:** dropdown/popover listing available embedding sources (AlphaEarth, TESSERA, Clay, etc.), each with a one-line description, spatial resolution, temporal coverage, and vector dimensionality. Selecting a source is instant; no confirmation dialog.
- **Step 2 — Area:** a tool button that activates drawing mode on the map (bbox drag, polygon, or point+radius). While active, the button pulses subtly and the cursor changes. Also supports a lightweight search box (place name → fly-to) inside the same popover, and pasting bbox coordinates.
- **Step 3 — Sample & Retrieve:** a slider/stepper for sample size (bounded by a sensible max, e.g. 2,000 points, to keep everything client-side and fast) plus the "Retrieve" action that triggers the actual data fetch. Once Source + Area are set, this is the only remaining step needed to start exploring.
- **Optional step — Target:** styled as a distinctly secondary, "add-on" control (lighter weight, `+` affordance, tucked to the right of the core three) rather than a numbered step in the main sequence. Opens a popover listing predefined phenomena relevant to the chosen source/area (e.g., land cover class, vegetation index correlate, burn scar, urban change) plus a "Custom target" option (upload/draw labeled points, or define by correlating against an uploaded real-world raster/CSV of ground-truth values). No synthetic targets are ever offered — only real, user-supplied or catalog-backed reference data. Attaching a target doesn't require re-retrieving the sample; it simply activates the correlation/classification tools in Analysis View (§10) against the already-loaded real points.

Each step's popover closes automatically when a choice is made, returning focus to the map. The bar never blocks the center of the map.

### 3.3 Retrieve action
- Button label changes contextually: `Retrieve sample` → `Retrieving…` (with a thin progress bar, not a spinner overlay) → `1,000 pts loaded`.
- On success, points render on the map as a lightweight point layer (GPU-accelerated, e.g. deck.gl ScatterplotLayer) and the view switcher becomes enabled.
- On failure or zero results, see §11 (empty/error states) — never substitute placeholder points.

---

## 4. Secondary Views

### 4.1 Map View (default)
- Points colored by a selectable channel: raw cluster id, similarity to a selected query point, target correlation strength, or a neutral single color (default: neutral, so the map doesn't imply a conclusion before analysis).
- Clicking a point opens the Inspector (§6) with its coordinates, source metadata, and (if available) thumbnail of real satellite imagery for that location/date, fetched from the source provider — never a placeholder tile.
- A minimal legend appears only when a coloring mode implies one; it auto-hides otherwise.

### 4.2 Embedding View
- A 2D projection (PCA by default; UMAP as an optional, entirely client-side computation) of the retrieved embedding vectors, rendered as a scatter plot using the same point styling/coloring logic as the Map View, so visual language stays consistent across modes. No server-side/backend job is required for either method — this keeps the platform lightweight and serverless-friendly, consistent with the product's core constraints.
- **Linked hovering/selection**: hovering a point in Embedding View highlights the same point in Map View and vice versa (and in Similarity/Analysis views). This linked-brushing is the single most important interaction in the product — it's how "geographic space vs. embedding space" becomes tangible.
- Axis labels are generic ("Component 1 / Component 2" or "UMAP-1 / UMAP-2") with a small info affordance explaining what the projection method did, in one sentence.
- A toggle lets the researcher switch projection method (PCA ↔ UMAP) without re-fetching data — recomputed from the same real sample.

### 4.3 Similarity View
- Researcher clicks any point (map or embedding) to set it as a **query point**. The view then renders a similarity field: all sampled points colored/sized by cosine (or Euclidean) distance to the query, both in the Embedding View scatter and back-projected onto the Map View.
- A small histogram of similarity scores appears in a corner, showing the real distribution for the current sample (again: never a synthetic/example histogram — it only renders once a query point and real sample exist).
- "Find most similar" and "Find most dissimilar" quick actions list the top-N real points with distance values, clickable to fly to them.

### 4.4 Analysis View
Lightweight, local, fast — this view runs small statistical/ML routines against the retrieved sample (never against a hidden or synthetic dataset):

- **PCA**: variance explained per component, scree plot, loadings.
- **Clustering**: k-means or HDBSCAN with a simple k/parameter control; cluster assignments propagate back to Map and Embedding views as colors.
- **Correlation**: if a real target variable (ground truth) is attached, show per-dimension or per-component correlation strength (e.g., a small bar chart of |r| by embedding dimension, or a scatter of embedding component vs. target value).
- **Simple classification**: logistic regression / k-NN trained on the real labeled subset, reporting honest metrics (accuracy, F1, confusion matrix) computed via cross-validation on the actual sample — with a visible sample-size caveat when N is small, rather than an inflated confidence claim.
- Each analysis is presented as a **result card**: method name, key stat, a small plot, and a one-sentence plain-language interpretation ("Component 1 explains 42% of variance and separates urban from vegetated areas.").
- All analysis results carry a visible parameter/method footer (e.g., "k-means, k=5, cosine distance, n=812") for reproducibility, echoed into the Session Drawer's method notes.

---

## 5. User Flows

### 5.1 Primary flow (happy path) — discover first, test second
The core sequence is **Source → Area → Explore**. Target is an optional analytical layer added later, when (and if) the researcher has a hypothesis or ground truth to test.

1. Land on Map Workspace → world view, control bar shows Source/Area/Retrieve as empty/default, Target visible but clearly secondary.
2. Pick embedding source → popover closes, map style may adjust to reflect coverage (e.g., dim areas with no coverage).
3. Draw/search an area → map flies/zooms; bbox outline persists as a subtle dashed overlay.
4. Set sample size, click Retrieve → progress bar, then points appear on map; view switcher enables. **No target required to reach this point.**
5. Explore Map View, switch to Embedding View → notice clustering; hover to link-brush.
6. Click a point of interest → set as Similarity query → inspect similar locations.
7. Switch to Analysis View → run PCA/clustering (both work without a target) → read result cards.
8. If a hypothesis emerges (e.g., "this cluster looks like it tracks urban density"), attach a real target at this point → correlation/classification cards activate against the already-loaded sample, no re-retrieval needed.
9. Decide: promising → open Session Drawer, export sample + results + method notes. Not promising → adjust source/area and re-retrieve, or attach a different target (state persists throughout).

### 5.2 Refinement flow (no full reset)
Changing **source, area, or sample size** after an initial retrieval does **not** clear other steps, but does invalidate the loaded sample — shown via a subtle "Sample is stale — Retrieve to update" banner rather than auto-clearing the screen. Attaching, changing, or removing a **target**, by contrast, never invalidates the sample — it only affects which Analysis View cards are active, since target is a layer on top of the real retrieved points, not an input to retrieval itself.

### 5.3 Custom target flow (real data only)
1. Researcher selects "Custom target" in the optional Target popover.
2. Two real-data options: **(a)** draw/label points directly on the map (assign class labels or numeric values by clicking), or **(b)** upload a real file (CSV of lat/lon + value, or GeoJSON) — validated on upload (must contain coordinates; invalid rows are reported, not silently dropped or replaced with defaults).
3. If validation fails (no valid rows, wrong coordinate range, etc.), the UI reports precisely what failed and asks the researcher to fix and re-upload — it never proceeds with placeholder/simulated values.
4. Once a valid target is attached, correlation/classification tools in Analysis View activate.

### 5.4 Empty/first-run flow
On first load with nothing selected, the map shows a real global basemap (no fabricated "example" overlay) and the control bar's first step is visually emphasized (e.g., a soft glow or outline) with microcopy: *"Start by choosing an embedding source."* No demo data, no tour modal, no sample project preloaded — if the researcher wants an example, they must explicitly pick a real source and a real area.

---

## 6. Inspector Panel

A slide-in panel from the right edge (width ~320px desktop, full-width sheet on mobile), opened by clicking any point in any view.

Contents:
- Coordinates (lat/lon), source, acquisition date/window.
- Real thumbnail imagery for that location if the source API provides it (skip the thumbnail block entirely if unavailable — never a grey placeholder box implying missing data is normal/expected without saying so).
- Embedding vector summary: dimensionality, a small sparkline or heatmap strip of the raw vector values (not a full table by default — expandable via "Show full vector").
- Quick actions: "Set as similarity query," "Add to comparison tray," "Copy coordinates."

### 6.1 Comparison tray
A small persistent strip (bottom of Inspector or its own collapsible drawer) where researchers can pin 2–5 points to compare side-by-side: vector heatmaps, distances between each pair, and a mini map showing their real relative locations.

---

## 7. Components (for the dev agent)

Reusable primitives — build these once, compose everywhere:

| Component | Purpose | Notes |
|---|---|---|
| `ControlStepButton` | One step in the control bar | Icon + label + chevron; opens `StepPopover` |
| `StepPopover` | Lightweight floating panel | Auto-position, closes on selection or outside click |
| `ViewSwitcher` | Segmented control for 4 modes | Disabled state until sample exists |
| `MapCanvas` | Wraps MapLibre/Mapbox + deck.gl point layer | Exposes hover/click events for linked brushing |
| `EmbeddingScatter` | 2D projection scatter (WebGL, e.g. deck.gl or regl) | Shares point-styling logic with `MapCanvas` |
| `SimilarityField` | Colors/sizes points by distance to query | Reused across Map and Embedding renders |
| `ResultCard` | Analysis output unit | Title, stat, small plot, one-line interpretation, method footer |
| `Inspector` | Slide-in detail panel | Lazy-loads imagery/vector data |
| `ComparisonTray` | Pinned point comparison | Max 5 items, horizontally scrollable |
| `SessionDrawer` | Export + method notes | Tab-triggered slide panel |
| `ProgressBar` (thin, inline) | Retrieval/computation feedback | Never a full-screen spinner |
| `EmptyState` | No-data messaging | Always names the missing real input and the action to fix it |
| `ErrorState` | Failure messaging | States what failed, offers retry; never a fabricated fallback dataset |
| `Legend` | Auto-shown/hidden color-scale key | Appears only when a coloring mode requires it |
| `Toast` | Transient confirmation (export done, etc.) | Bottom-center, auto-dismiss ~3s |

---

## 8. Map Interactions

- **Pan/zoom**: standard, inertial, GPU-accelerated.
- **Area drawing**: bbox by click-drag by default; polygon mode toggle for irregular AOIs; point+radius mode for quick small-area exploration. Drawn area shown as a thin dashed line with a translucent fill (5–8% opacity), color drawn from the accent palette (§14).
- **Point layer**: hover shows a lightweight tooltip (coordinates + one summary stat); click opens Inspector. Points scale slightly on hover (subtle, <120ms transition).
- **Linked brushing**: hovering a point in any view highlights it (ring/halo) in all other views simultaneously, even if those views aren't currently visible (state persists so switching modes shows the highlight already applied).
- **Basemap style**: minimal, low-chroma, dark-mode-first (scientific/instrument feel), with a light-mode toggle. Avoid busy default basemaps (no dense labels, no traffic-style clutter). Country/coastline lines only, place labels appear progressively on zoom.
- **Coverage hinting**: when a source has known spatial/temporal coverage limits, dim or hatch unavailable regions subtly rather than blocking interaction — researcher can still look, but is informed before wasting a retrieval.

---

## 9. Embedding Visualization Details

- Default projection: PCA (fast, deterministic, defensible) with UMAP as an opt-in for structure-seeking exploration. UMAP runs **client-side** (e.g., in a Web Worker to avoid blocking the UI thread), which is slower than PCA at larger sample sizes — shown with a progress indicator — but requires no backend compute, keeping the whole projection pipeline in the browser.
- Point size and opacity scale down automatically as N grows, to keep dense samples legible (avoid overplotting) — no manual tuning required for typical sample sizes.
- Coloring is a **shared palette system** across Map, Embedding, and Similarity views: whichever channel is chosen (cluster, similarity, target correlation, neutral) uses the same scale everywhere, so a color means the same thing regardless of which view you're looking at.
- A small "what am I looking at" info affordance (ⓘ) on each view opens a 2–3 sentence plain-language explanation of the current projection/method — written once per method, static copy, no dynamic generation needed.

---

## 10. Analysis Interactions

- All analysis runs are **local/lightweight** by design — the UI should never suggest a long-running job without showing real-time or near-real-time progress (thin progress bar with a short, honest status line: "Running k-means on 812 points…").
- Parameters (k for clustering, number of PCA components, k for k-NN) are exposed via small inline steppers/sliders directly on the `ResultCard`, not a separate settings form — changing a parameter re-runs the analysis immediately against the same real sample.
- Results are always traceable: every `ResultCard` shows the exact sample it ran against (size, source, area, timestamp) so nothing is ambiguous about provenance.
- If an analysis requires a target/label that isn't attached (e.g., correlation, classification), the card shows a disabled state with a direct call-to-action: "Attach a real target to enable correlation" — linking straight to the optional Target control.

---

## 11. Loading, Error, and Empty States

**Principle:** never fabricate data to fill a state. Every non-happy-path state names what's missing or wrong and gives one clear action.

| State | Behavior |
|---|---|
| **Initial load** | Real basemap only, no data layers, control bar step 1 emphasized. Microcopy: "Choose an embedding source to begin." |
| **Retrieving sample** | Thin progress bar under control bar; button text updates ("Retrieving 500 points…"); map stays interactive (pan/zoom allowed) during fetch. |
| **Zero results** | Explicit message in place of the point layer: "No embeddings returned for this area/source/date range." Offers direct actions: widen area, change source, adjust date range. No placeholder points shown. |
| **Partial results** | If fewer points returned than requested (e.g., coverage gaps), show the real count and a one-line reason if known ("312 of 500 requested — remaining area has no coverage for this source"). |
| **Network/API error** | Clear, non-technical message + retry button + (if relevant) a link/expand for technical detail. Never silently falls back to cached/fake data. |
| **Analysis error** (e.g., degenerate input, all-identical vectors) | Explains why the method failed in plain language ("PCA needs at least 2 points with variation; try a larger or more diverse sample.") |
| **Empty Inspector fields** | If imagery or a metadata field isn't available from the source, the field is omitted entirely rather than shown empty or with a dash-as-placeholder that could be misread as a real "no data" value from the source itself. |
| **Custom target upload errors** | Row-level validation feedback (which rows failed and why); valid rows are usable even if some fail, but the researcher is told the real count that succeeded. |

---

## 12. Responsive / Mobile Behavior

Latent Earth is primarily a desktop research tool (large-screen, precise interactions), but should degrade gracefully:

- **Desktop (≥1024px)**: full layout as described — floating control bar top-center/left, view switcher bottom-center or top-right, Inspector as a right-side slide-in panel, Session Drawer as a right-edge tab.
- **Tablet (768–1023px)**: control bar becomes a single collapsible pill (tap to expand the core Source/Area/Retrieve steps plus the optional Target control as a vertical stack); Inspector becomes a bottom sheet instead of a side panel.
- **Mobile (<768px)**: map remains primary; control bar collapses to a single floating action button ("Configure") that opens a full-height bottom sheet with Source, Area, and Retrieve stacked vertically, and the optional Target control visually separated below them; view switcher becomes a bottom tab bar (standard mobile pattern, still only 4 items); Embedding/Similarity/Analysis views render as full-screen takeovers with a clear back-to-map affordance (not nested navigation). Linked brushing still works but tooltips simplify to tap-to-select rather than hover.
- Complex client-side analyses (UMAP, classification) still run but the UI is honest about mobile compute constraints, e.g. showing slightly longer expected times rather than hiding the feature.

---

## 13. Accessibility

- **Color is never the sole encoder of meaning.** Every color-coded channel (cluster, similarity, target correlation) has a redundant cue available on demand: point size, a legend with pattern/shape hints, or a text readout in the Inspector/tooltip.
- **Contrast:** all text and essential UI elements meet WCAG AA against both light and dark basemap backgrounds; floating panels use a solid-enough background (not pure low-opacity glass) to guarantee contrast, especially over busy map imagery.
- **Keyboard:** every control-bar step, view-switcher mode, and Inspector action is reachable and operable via keyboard (tab order follows visual left-to-right/top-to-bottom flow); map pan/zoom has keyboard equivalents (arrow keys + `+`/`-`).
- **Screen readers:** map/scatter canvases are supplemented with an accessible data table view (toggleable, not default) listing the current sample's key fields, so WebGL-rendered points aren't a dead end for assistive tech.
- **Motion:** all transitions (hover scale, panel slide, linked-brush highlight) respect `prefers-reduced-motion` — fall back to instant state changes.
- **Text scaling:** UI must remain usable at 200% browser zoom without breaking the floating control bar into overlapping elements (use responsive stacking, not fixed pixel widths).
- **Focus indicators:** visible focus rings on all interactive elements, styled to match the scientific-instrument aesthetic (thin, precise, not a garish default browser outline, but never removed).

---

## 14. Visual Language

### 14.1 Overall aesthetic
Clean, modern, restrained. Think: an oscilloscope or a well-designed scientific instrument panel, not a marketing dashboard. Dark-mode-first, with a light mode that maintains the same restraint (not a simple color inversion — re-tune contrast and accent intensity).

### 14.2 Color
- **Base palette:** near-black/charcoal background (dark mode) or near-white/warm-grey (light mode) — avoid pure #000/#FFF, which reads harsh against satellite imagery.
- **Accent:** a single precise accent hue (e.g., a calibrated cyan or amber — pick one, use consistently) for interactive elements, active states, and the drawn-area outline. Avoid multi-color "brand palettes."
- **Data color scales:** perceptually uniform, colorblind-safe scales (e.g., Viridis/Cividis family) for continuous data (similarity, correlation strength); a small, distinct qualitative palette (max ~8 hues) for categorical cluster coloring.
- **Semantic colors used sparingly:** a muted red/amber only for real error/warning states, muted green only for real success confirmations — never decorative.

### 14.3 Typography
- **Typeface:** a single clean, technical/geometric sans-serif (e.g., Inter, IBM Plex Sans, or similar) for UI text; an optional monospace (e.g., IBM Plex Mono, JetBrains Mono) for coordinates, vector values, and method/parameter strings — reinforcing the "instrument readout" feel.
- **Scale:** compact, restrained type scale — most UI text at 13–14px, panel titles at 15–16px, no large marketing-style headlines anywhere in the product.
- **Weight:** mostly regular/medium; bold reserved for the single most important number on a `ResultCard` (e.g., variance explained, accuracy).

### 14.4 Spacing & layout
- Generous negative space around the floating control bar and panels so they read as instruments floating over the map, not a dense toolbar.
- 8px base spacing unit; panels use consistent 16–24px internal padding.
- No drop-shadows beyond a very subtle elevation cue (soft, low-opacity) to lift floating panels off the map — avoid heavy skeuomorphic shadows.
- Corner radii small and consistent (4–6px) — precise, not playful/rounded.

### 14.5 Iconography
- Minimal, thin-stroke line icons (1.5px stroke), consistent grid, no filled/glyph-style icons except for active-state indicators.
- Icons always paired with a text label on first encounter (control bar steps); icon-only is acceptable for the view switcher and repeated micro-actions once the researcher is oriented.

### 14.6 Materials (panels/overlays)
- Floating panels use a semi-opaque solid fill (not heavy blur-glassmorphism) with a thin 1px border at low opacity — legible over any map content, calm rather than flashy.

---

## 15. Interaction Principles

1. **Every interaction has a real data consequence.** No purely decorative animation; motion always communicates state change (loading, linking, selection).
2. **Two-way binding across views.** Anything selectable in one view (point, cluster, region) is reflected identically in all others — this is the product's core "aha."
3. **No modal interruptions.** Popovers and slide-in panels only; never a blocking dialog except for destructive/irreversible actions (there should be almost none in v1).
4. **Progressive disclosure.** Default views are clean; detail (full vector, raw stats, method parameters) is always one click away, never hidden behind multiple layers of navigation.
5. **Speed as a design constraint.** Any interaction under a real data operation (hover, brush, mode switch) must feel instant; only actual retrieval/computation gets a progress indicator.
6. **Honesty over polish.** Small samples, coverage gaps, and low-confidence results are stated plainly, not smoothed over with confident-looking but misleading visuals.
7. **Real data only, always.** No mock/sample/synthetic data anywhere in the shipped product — including onboarding, empty states, and documentation screenshots referenced from within the app. If real data isn't available, the UI asks.

---

## 16. Microcopy Guidelines

Tone: precise, calm, slightly technical but never jargon-heavy; written like lab documentation, not marketing copy.

Examples:
- Step 1 prompt: *"Choose an embedding source to begin."*
- Area tool: *"Draw an area, or search a place."*
- Target prompt: *"What are you looking for signal of?"*
- Retrieve button (idle): *"Retrieve sample"*
- Retrieve button (loading): *"Retrieving 500 points…"*
- Success toast: *"1,000 embeddings loaded from AlphaEarth (2023)."*
- Stale-sample banner: *"Sample is out of date — retrieve again to reflect your changes."*
- Zero-result state: *"No embeddings found in this area for AlphaEarth. Try widening the area or choosing a different source."*
- Analysis disabled state: *"Attach a real target to run correlation."*
- Info affordance (PCA): *"PCA finds the directions of greatest variation in the embedding vectors and projects them into two dimensions for viewing."*
- Export confirmation: *"Exported 1,000 points, PCA results, and method notes."*

Avoid: exclamation points, superlatives ("amazing," "powerful"), vague encouragement ("Great job!"), and any copy that implies certainty about a "signal" the analysis hasn't actually demonstrated.

---

## 17. Example User Journeys

### Journey A — Quick signal check
A researcher wants to know if AlphaEarth embeddings separate urban from non-urban land near a specific city.
1. Opens Latent Earth → picks **AlphaEarth** as source.
2. Searches the city name → map flies there → draws a 20km bbox.
3. Picks the predefined target **"Urban vs. non-urban (land cover reference)"**.
4. Sets sample size to 800, clicks Retrieve → points appear in ~2s.
5. Switches to Embedding View → sees two loose clusters, hovers each → confirms via Map View linked highlight that they correspond to urban core vs. surrounding farmland.
6. Switches to Analysis View → runs k-means (k=2) → cluster boundary roughly matches the target labels → runs correlation → sees strong separation on components 1 and 3.
7. Opens Session Drawer → exports sample + results as evidence the embedding is promising → moves to deeper research outside the tool.

### Journey B — Comparing two embedding sources
A researcher wants to compare TESSERA vs. Clay for detecting burn scars in a real wildfire-affected region, using a real post-fire burn-severity raster they have as ground truth.
1. Picks **TESSERA**, draws the fire-affected area (polygon mode, irregular boundary), uploads the real burn-severity raster as a **custom target** (validated on upload).
2. Retrieves 1,200 points → runs correlation in Analysis View → notes moderate correlation (|r| ≈ 0.4 on top component).
3. Switches source to **Clay** without losing area/target (Step 1 change only) → banner: "Sample is out of date."
4. Retrieves again → runs the same correlation → compares the two `ResultCard`s side by side (scrolled in the same Analysis View) → Clay shows stronger correlation (|r| ≈ 0.6).
5. Pins a handful of high-severity and low-severity points to the **Comparison Tray** to sanity-check the vectors visually.
6. Exports both result sets with method notes for a written comparison.

### Journey C — Exploratory, no fixed target yet
A researcher has no specific phenomenon in mind and wants to see what an embedding source reveals about a remote area.
1. Picks a source, draws a large area, and retrieves a sample without ever touching the optional Target control — this is the default, fully supported path, not a workaround.
2. Retrieves a sample → explores Embedding View directly → notices distinct, well-separated clusters.
3. Clicks around each cluster in Map View to see where they correspond geographically (e.g., coastline vs. inland vs. mountainous terrain) — builds an informal hypothesis about what the embedding is encoding.
4. Later attaches a real elevation or land-cover dataset as a custom target to test that hypothesis quantitatively via correlation.

---

## 18. Summary for Implementation Priority

Build in this order to reach a usable v1 fastest:

1. Map Workspace shell (full-screen map, floating control bar, no view switching yet).
2. Source → Area → Retrieve flow against one real embedding source, rendering real points on the map.
3. Embedding View with PCA projection + linked brushing with Map View.
4. Inspector panel (point detail, real vector summary).
5. Similarity View (query point + distance coloring).
6. Analysis View: PCA card first, then clustering, then correlation (requires custom target flow), then classification.
7. Session Drawer (export + method notes).
8. Responsive collapse behavior, accessibility pass, second/third embedding sources.

End of specification.
