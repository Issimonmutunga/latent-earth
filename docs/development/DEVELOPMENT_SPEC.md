Yes. I would split this into **two documents**: first, a prompt for another AI to design the UI/UX specification; then the **development specification** that an implementation agent can follow.

### 1. Prompt for the UI/UX AI

Give the other AI this:

Design the UI/UX specification for a lightweight web platform called **Latent Earth**.

## What Latent Earth is

Latent Earth is an interactive research/prototyping tool for exploring **Earth-observation embeddings**.

Modern satellite foundation models can transform enormous quantities of satellite imagery and temporal observations into compact numerical vectors called embeddings. Instead of working directly with massive satellite datasets, Latent Earth lets researchers visually explore these representations and investigate whether they contain useful signals about phenomena on Earth.

The platform should support **multiple embedding sources**, rather than being tied to one provider. Examples may include AlphaEarth, TESSERA, Clay, and other Earth-observation embedding datasets as they become available.

The central question of the platform is:

> **"Does this embedding contain a useful signal about what I'm studying?"**

## Primary workflow

A researcher should be able to:

1. Choose an embedding source.
2. Navigate to or select an area anywhere on Earth.
3. Select or define a phenomenon/target of interest.
4. Retrieve a manageable sample of embeddings.
5. Explore the embeddings visually.
6. Compare geographic space with embedding space.
7. Run lightweight local analyses such as PCA, clustering, similarity search, correlation, or simple classification.
8. Decide whether the embedding appears promising enough for deeper research.

## UX philosophy

The application should feel like a **scientific instrument**, not a conventional SaaS dashboard.

Priorities:

* Extremely lightweight.
* Minimal interface chrome.
* Map-first.
* Fast interactions.
* Clear visual hierarchy.
* Scientific but approachable.
* Explanations should be short and contextual.
* Avoid unnecessary dashboards, forms, menus and configuration screens.
* Progressive disclosure: expose complexity only when the researcher needs it.
* Make the visualizations the primary interface.

## Core visual concepts

The UI should make these relationships intuitive:

**Geographic space**
→ Where something is on Earth.

**Embedding space**
→ Where that location exists in the learned mathematical representation.

**Similarity**
→ Which locations have similar representations.

**Signal**
→ Whether embeddings appear to distinguish or correlate with a chosen phenomenon.

## Suggested primary screen

A full-screen interactive map with a small floating control surface.

Potential flow:

`Embedding source → Area → Target → Explore`

The researcher should be able to move naturally between:

* Map view
* Embedding-space view
* Similarity view
* Analysis view

The UI should avoid forcing the user through a long wizard.

## Important design requirement

Do not design the platform as a generic "AI dashboard".

The distinctive identity should be:

> **A lightweight laboratory for discovering signals hidden inside Earth-observation embeddings.**

Produce a complete UI/UX specification covering:

* Information architecture
* Navigation
* Primary screen
* Secondary screens/views
* User flows
* Components
* Map interactions
* Embedding visualization
* Analysis interactions
* Loading/error/empty states
* Responsive/mobile behaviour
* Accessibility
* Typography
* Spacing
* Visual language
* Interaction principles
* Microcopy
* Example user journeys

Favor a clean, modern scientific aesthetic with restrained visual design and very little UI overhead.

The resulting specification will be handed to a separate software-development agent, so make it sufficiently concrete to implement.

### 2. Starting development document

Once the UI/UX document exists, this is the **agent-facing development specification**. It establishes the technical direction without prematurely locking us into a particular embedding provider.

# Latent Earth

## 1. Project purpose

Latent Earth is a lightweight, global, browser-first platform for exploring Earth-observation embeddings and rapidly testing whether those embeddings contain useful signals for research questions.

The platform is not intended to train large models or host satellite-processing pipelines.

Its purpose is **research discovery**:

> Select an embedding → select a geographic area → explore the representation → test a hypothesis.

Examples of research questions:

* Do embeddings distinguish different crop types?
* Do drought-affected areas form distinguishable groups?
* Can land degradation be detected in embedding space?
* Do urban and rural settlements occupy different regions?
* Which locations on Earth are most similar to a selected location?
* Which embedding source appears most useful for a particular phenomenon?

---

# 2. Core principles

### Lightweight

The frontend should remain as small as reasonably possible.

Avoid:

* Backend application servers
* Databases
* Large bundled datasets
* Server-side ML pipelines
* Unnecessary dependencies
* User accounts unless later required

### Browser-first

Whenever practical, processing should happen locally in the browser.

Potential operations:

* Sampling
* PCA
* Clustering
* Similarity calculations
* Basic statistics
* Lightweight classification/regression
* Visualization

### Provider-independent

Embedding sources must be abstracted behind a common interface.

The application must not be architecturally dependent on one embedding provider.

### Global

The application should support geographic exploration anywhere covered by a selected embedding source.

Do not attempt to load global embeddings into browser memory.

Retrieve only the data required for the current interaction.

---

# 3. Initial architecture

```text
                    ┌─────────────────────┐
                    │   Embedding Source  │
                    │ AlphaEarth / etc.   │
                    └──────────┬──────────┘
                               │
                         small query
                               │
                               ▼
┌──────────────────────────────────────────────────┐
│                  Latent Earth                    │
│                                                  │
│  Map → Sampling → Embedding Data → Analysis      │
│                    │                             │
│          ┌─────────┼─────────┐                   │
│          ▼         ▼         ▼                   │
│         PCA     Similarity  Clustering            │
│          │         │         │                   │
│          └─────────┼─────────┘                   │
│                    ▼                             │
│              Visualization                      │
└──────────────────────────────────────────────────┘
```

The browser should be the primary computational environment.

---

# 4. Technology baseline

Use:

* React
* TypeScript
* Vite
* Modern CSS
* WebGL/WebGPU where useful
* Typed arrays for numerical data
* A lightweight map library
* Lightweight numerical libraries only where necessary

Do not introduce a heavy framework merely for convenience.

Prefer functional React components and simple modules.

Avoid unnecessary OOP abstractions.

---

# 5. Embedding abstraction

All providers must expose a common conceptual interface.

```ts
interface EmbeddingSource {
    id: string;
    name: string;
    dimensions: number;
    description: string;

    query(request: EmbeddingQuery): Promise<EmbeddingResult>;
}
```

Conceptually:

```ts
interface EmbeddingQuery {
    bounds: BoundingBox;
    resolution?: number;
    date?: string;
    sampleSize?: number;
}
```

The exact implementation should remain flexible because different providers will expose data differently.

The application should not assume that every embedding source has identical:

* Dimensions
* Resolution
* Temporal coverage
* Spatial coverage
* Authentication
* API interface

---

# 6. Initial embedding sources

Create the architecture for multiple sources.

Initial registry may contain:

```text
AlphaEarth
TESSERA
Clay
```

However, **do not fabricate API implementations**.

If a provider's API/access mechanism has not been verified, create an adapter interface and mark the provider as unavailable/integration-pending.

Provider documentation must be consulted before implementing network calls.

---

# 7. Authentication philosophy

The preferred model is:

```text
User
 ↓
Connect provider / Google project
 ↓
Browser
 ↓
Provider API
```

The application should not depend on a single developer-owned API credential.

Do not store user credentials on a Latent Earth server.

If a provider requires a server-side credential exchange, isolate that requirement behind the smallest possible integration layer.

---

# 8. Primary user experience

The main interface should revolve around four actions:

```text
SOURCE
   ↓
AREA
   ↓
TARGET
   ↓
EXPLORE
```

Example:

```text
Embedding
AlphaEarth

Area
Kenya / selected AOI

Target
Drought

Explore
```

After retrieval:

```text
                MAP
                 │
        geographic locations
                 │
                 ▼
        EMBEDDING SPACE
                 │
       PCA / similarity /
          clustering
                 │
                 ▼
             SIGNAL
```

---

# 9. Core visualizations

## Geographic map

Show:

* Selected AOI
* Sampled locations
* Optional target labels
* Similarity results
* Selected point

## Embedding space

Initially use PCA because it is lightweight and deterministic.

Later support:

* UMAP
* t-SNE if justified
* User-selected dimensions
* Clustering

The visualization must support:

* Zoom
* Pan
* Hover
* Selection
* Brushing
* Highlighting corresponding geographic locations

Selecting a point in embedding space should highlight the corresponding location on the map.

Selecting a location on the map should highlight its embedding.

This **map ↔ embedding-space linkage** is a core product interaction.

---

# 10. Similarity exploration

Given a selected location:

```text
Selected location
       ↓
Embedding vector
       ↓
Nearest neighbours
       ↓
Map + embedding visualization
```

Allow the user to ask:

> "What places look similar to this location according to the embedding?"

Similarity can initially use cosine similarity.

For vectors `a` and `b`:

```text
similarity(a,b) = (a · b) / (||a|| ||b||)
```

Keep computation client-side for manageable samples.

---

# 11. Signal discovery

The first analytical goal is not to produce a sophisticated predictive model.

It is to answer:

> **Is there evidence of a useful signal?**

Possible lightweight analyses:

* PCA
* Correlation
* Cluster separation
* Nearest-neighbour agreement
* Simple logistic classification
* Simple regression
* Confusion matrix
* Cross-validation where appropriate

Results should be communicated cautiously.

Example:

```text
Signal strength
Moderate

The selected classes show visible separation
in embedding space.

Next step:
Test with a larger independent sample.
```

Never describe exploratory results as scientific proof.

---

# 12. Data strategy

Never download massive global embedding datasets into the application.

Use:

```text
Global provider
      ↓
geographic query
      ↓
small sample
      ↓
browser memory
      ↓
analysis
```

The browser should only hold the current working dataset.

Implement sensible limits for:

* Maximum pixels
* Maximum vectors
* Maximum dimensionality
* Maximum memory usage

---

# 13. Performance requirements

The application should remain responsive during normal exploration.

Requirements:

* Lazy-load expensive functionality.
* Avoid loading analysis libraries until analysis is requested.
* Use typed arrays.
* Avoid unnecessary copies of embedding matrices.
* Use Web Workers for CPU-heavy operations when necessary.
* Use GPU rendering for large point clouds where useful.
* Never block the main UI thread with expensive calculations.
* Clear temporary datasets when changing AOIs.

---

# 14. Initial project structure

```text
src/
├── app/
│   └── App.tsx
│
├── components/
│
├── ui/
│
├── map/
│
├── visualization/
│
├── analysis/
│
├── embeddings/
│   ├── adapters/
│   ├── registry/
│   └── sources/
│
├── utils/
│
└── styles/
```

Responsibilities:

### embeddings/

Provider integrations and embedding-specific logic.

### map/

Geographic interaction and rendering.

### visualization/

Embedding-space and analytical visualizations.

### analysis/

PCA, similarity, clustering and lightweight modelling.

### components/

Reusable application components.

### ui/

Generic UI primitives.

### app/

Application state and composition.

---

# 15. Development phases

## Phase 1 — UI skeleton

Build:

* Global map
* Floating controls
* Source selector
* AOI selection
* Empty state
* Embedding-space panel
* Basic responsive layout

Use mock embedding data.

Do not integrate real APIs yet.

## Phase 2 — Embedding engine

Implement:

* Common embedding interface
* Registry
* Provider adapters
* Typed-array representation
* Sampling
* Cosine similarity

## Phase 3 — Visualization

Implement:

* PCA
* Interactive scatter plot
* Map ↔ embedding selection
* Nearest-neighbour visualization

## Phase 4 — Research exploration

Implement:

* Target/label input
* Clustering
* Basic classification
* Signal summary
* Export of small analytical results

## Phase 5 — Real providers

Integrate verified providers one at a time.

Do not build speculative integrations.

## Phase 6 — Optimization

Measure:

* Bundle size
* Initial load time
* Memory usage
* Query latency
* Rendering performance

Remove unnecessary dependencies.

---

# 16. MVP definition

The MVP is successful if a user can:

1. Open Latent Earth.
2. Select an embedding source.
3. Select an area anywhere supported.
4. Retrieve a small embedding sample.
5. See those points on a map.
6. See the same points in embedding space.
7. Select a point in either view and see it highlighted in the other.
8. Run PCA.
9. Find similar locations.
10. Understand, in simple language, whether the embedding appears to contain a useful signal.

Everything else is secondary.

---

# 17. Important constraints

Do not:

* Build a backend unless technically required.
* Build user accounts for the MVP.
* Store massive datasets.
* Train foundation models.
* Pretend unsupported providers have working APIs.
* Add complex dashboards.
* Over-engineer the embedding abstraction.
* Optimize for features instead of the core research workflow.

The central product should remain:

> **A lightweight browser laboratory for discovering useful signals hidden inside Earth-observation embeddings.**

---

# 18. Agent working rules

Before implementing a feature:

1. Check whether it is necessary for the MVP.
2. Prefer browser-native functionality.
3. Prefer the smallest dependency that solves the problem.
4. Keep provider-specific logic isolated.
5. Do not invent external APIs or undocumented capabilities.
6. Test with mock data before integrating external services.
7. Keep the UI visually minimal.
8. Document architectural decisions.
9. Preserve the ability to add embedding sources later.
10. Optimize for a fast first load.

The implementation should evolve from a **working visual prototype** rather than attempting to build the complete platform upfront.
