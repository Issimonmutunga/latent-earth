import { useEffect, useRef } from "react";
import { useWorkspace, type GuideSection } from "../app/workspace.tsx";

const SECTIONS: Array<{ id: GuideSection; label: string }> = [
  { id: "welcome", label: "Welcome" },
  { id: "quickstart", label: "Quick start" },
  { id: "setup", label: "Set up Earth Engine" },
  { id: "using", label: "Using the app" },
  { id: "results", label: "Reading the results" },
  { id: "troubleshooting", label: "Troubleshooting" },
];

const SHORTCUTS: Array<[string, string]> = [
  ["D", "Draw an area"],
  ["R", "Retrieve sample"],
  ["1 – 4", "Map · Embedding · Similarity · Analysis"],
  ["B", "Cycle basemap"],
  ["Esc", "Cancel / back to map / close"],
  ["?", "Open this guide"],
];

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children} ↗
    </a>
  );
}

/** The in-app documentation: a modal with one page per section. */
export default function Guide() {
  const { state, openGuide } = useWorkspace();
  const section = state.guide;
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [section]);

  useEffect(() => {
    if (!section) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        openGuide(null);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [section, openGuide]);

  if (!section) return null;
  const index = SECTIONS.findIndex((s) => s.id === section);
  const next = SECTIONS[index + 1];
  const go = (id: GuideSection) => openGuide(id);

  return (
    <div className="guide-backdrop" onMouseDown={(e) => e.target === e.currentTarget && openGuide(null)}>
      <div className="guide" role="dialog" aria-modal="true" aria-label="Latent Earth guide">
        <nav className="guide__nav" aria-label="Guide sections">
          <div className="guide__brand">Latent Earth guide</div>
          {SECTIONS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`guide__nav-item${s.id === section ? " is-active" : ""}`}
              onClick={() => go(s.id)}
            >
              <span className="guide__nav-num">{i + 1}</span>
              {s.label}
            </button>
          ))}
        </nav>

        <div className="guide__body" ref={bodyRef}>
          <button type="button" className="guide__close btn btn--ghost btn--icon" aria-label="Close guide" onClick={() => openGuide(null)}>
            ✕
          </button>

          {section === "welcome" && (
            <article>
              <h2>Welcome to Latent Earth</h2>
              <p className="guide__lead">
                A browser lab for one question: <em>does a satellite embedding contain a useful signal
                about what I'm studying?</em>
              </p>
              <p>
                Satellite foundation models such as Google DeepMind's <strong>AlphaEarth</strong>{" "}
                summarise each 10 m patch of land, for a whole year, as a list of 64 numbers — an{" "}
                <em>embedding</em>. Places that look and behave alike get similar numbers. Latent Earth
                lets you pull a sample of those embeddings for any area and see what they capture:
              </p>
              <ul>
                <li>
                  <strong>Map</strong> — where the sampled points are, colored by what you're
                  exploring.
                </li>
                <li>
                  <strong>Clusters</strong> — natural groupings the embedding finds on its own.
                </li>
                <li>
                  <strong>Similarity</strong> — click a place, see everywhere that looks like it.
                </li>
                <li>
                  <strong>Targets</strong> — upload or hand-label ground truth (crop type, forest
                  loss, biomass…) and measure how well the embedding predicts it.
                </li>
              </ul>
              <div className="guide__callout">
                <strong>Before you start:</strong> AlphaEarth data is served by Google Earth Engine,
                which is free for noncommercial research. You use your <em>own</em> Earth Engine
                project — setting one up takes about 5 minutes, once.{" "}
                <button type="button" className="link-btn link-btn--inline" onClick={() => go("setup")}>
                  Set up Earth Engine →
                </button>
              </div>
              <p className="guide__muted">
                Everything runs in your browser: uploads and results never leave it. Data requests go
                straight from your browser to Google, and place searches to OpenStreetMap.
              </p>
            </article>
          )}

          {section === "quickstart" && (
            <article>
              <h2>Quick start</h2>
              <p>The bar at the top walks you through it, and the line beneath it always says what to do next.</p>
              <ol className="guide__steps">
                <li>
                  <strong>Choose source → AlphaEarth.</strong> The first time, paste your Earth Engine
                  project ID (see <button type="button" className="link-btn link-btn--inline" onClick={() => go("setup")}>Set up Earth Engine</button>).
                </li>
                <li>
                  <strong>Pick an area.</strong> Drag a box on the map (<kbd>D</kbd>), search a place,
                  use what's on screen, or paste <code>west, south, east, north</code>. Start small —
                  a town or a valley, not a country.
                </li>
                <li>
                  <strong>Retrieve</strong> (<kbd>R</kbd>). The first time, a Google window asks you
                  to sign in and allow read-only Earth Engine access. 500 points load in a few
                  seconds. Use the <em>500 pts</em> menu to change the number of points or the year
                  (2017 onwards).
                </li>
                <li>
                  <strong>Explore.</strong> Hover points for details, click one to inspect it, press{" "}
                  <em>Find clusters</em>, or <em>Find similar places</em>. Switch views with{" "}
                  <kbd>1</kbd>–<kbd>4</kbd>.
                </li>
                <li>
                  <strong>Test a hypothesis</strong> (optional). <em>+ Target</em> → upload ground
                  truth or label a few points by hand, then open <em>Analysis</em>.
                </li>
                <li>
                  <strong>Export</strong> your sample and results as CSV or GeoJSON.
                </li>
              </ol>
              <h3>Keyboard shortcuts</h3>
              <dl className="shortcut-list">
                {SHORTCUTS.map(([k, label]) => (
                  <div key={k} className="shortcut">
                    <dt>
                      <kbd>{k}</kbd>
                    </dt>
                    <dd>{label}</dd>
                  </div>
                ))}
              </dl>
            </article>
          )}

          {section === "setup" && (
            <article>
              <h2>Set up Earth Engine (one time, ~5 minutes)</h2>
              <p>
                Latent Earth reads AlphaEarth through <em>your</em> Google Earth Engine project. It's
                free for noncommercial use — research, teaching, nonprofits and personal projects —
                and keeps your usage on your own quota.
              </p>
              <ol className="guide__steps">
                <li>
                  <strong>Register a project for Earth Engine.</strong> Open{" "}
                  <Ext href="https://code.earthengine.google.com/register">
                    code.earthengine.google.com/register
                  </Ext>{" "}
                  and sign in with your Google account. Choose <em>unpaid / noncommercial</em> use,
                  answer the short questions about your work, then <em>create a new Google Cloud
                  project</em> (or pick an existing one). Give it an ID you'll recognise, e.g.{" "}
                  <code>ee-yourname</code>.
                </li>
                <li>
                  <strong>Check the Earth Engine API is on.</strong> Registration usually enables it.
                  If Latent Earth later says the API is disabled, open the{" "}
                  <Ext href="https://console.cloud.google.com/apis/library/earthengine.googleapis.com">
                    Earth Engine API page
                  </Ext>
                  , select your project and press <em>Enable</em>.
                </li>
                <li>
                  <strong>Copy the project ID.</strong> It's the lowercase ID (like{" "}
                  <code>ee-yourname</code>), not the display name or the long project number. Find
                  it in the project picker of the{" "}
                  <Ext href="https://console.cloud.google.com/">Google Cloud console</Ext>.
                </li>
                <li>
                  <strong>Paste it into Latent Earth.</strong> <em>Choose source → AlphaEarth</em>,
                  paste the ID and press <em>Save</em>. It's remembered in this browser.
                </li>
                <li>
                  <strong>Sign in.</strong> Press <em>Sign in with Google</em> (or just Retrieve) and
                  use the <em>same Google account</em> that owns the project. Allow the read-only
                  Earth Engine permission.
                </li>
              </ol>
              <div className="guide__callout">
                <strong>“Google hasn't verified this app”?</strong> Google shows this until a site's
                sign-in has passed its review. If you trust this site, choose <em>Advanced → Go to
                Latent Earth</em>. The app only ever asks for read-only Earth Engine access.
              </div>
              <h3>Privacy &amp; cost</h3>
              <ul>
                <li>The sign-in grants <strong>read-only</strong> Earth Engine access and lasts only while this tab is open.</li>
                <li>Your project ID is stored only in this browser. Remove it any time via <em>change</em> → clear → Save.</li>
                <li>Requests count against <strong>your</strong> project's noncommercial Earth Engine quota. A 500-point sample is a small request.</li>
                <li>
                  Commercial use of Earth Engine needs a paid plan — see{" "}
                  <Ext href="https://earthengine.google.com/commercial/">Earth Engine for business</Ext>.
                </li>
              </ul>
            </article>
          )}

          {section === "using" && (
            <article>
              <h2>Using the app</h2>
              <h3>The four views</h3>
              <ul>
                <li><strong>Map</strong> <kbd>1</kbd> — sampled points in geographic space.</li>
                <li>
                  <strong>Embedding</strong> <kbd>2</kbd> — the same points arranged by how similar
                  their embeddings are (a PCA projection). Close together here = alike according to the
                  model, even if far apart on the map.
                </li>
                <li>
                  <strong>Similarity</strong> <kbd>3</kbd> — everything ranked by similarity to one
                  query point, with the most and least similar places listed.
                </li>
                <li><strong>Analysis</strong> <kbd>4</kbd> — PCA, clustering, and target tests.</li>
              </ul>
              <p>All views share the same points and colors, and hovering in one highlights the point in the others.</p>

              <h3>Color points by</h3>
              <p>
                The panel bottom-left switches the coloring: <em>Plain</em>, <em>Clusters</em>{" "}
                (k-means — pick k from 3 to 6), <em>Similarity</em> to your query point, or{" "}
                <em>Target</em> predictions.
              </p>

              <h3>Inspecting a point</h3>
              <p>
                Click any point to open the inspector: coordinates, cluster, similarity, and its 64
                embedding values. From there you can <em>Find similar places</em>, <em>Zoom to</em>{" "}
                it, <em>Pin</em> up to 5 points to compare them, or give it a label.
              </p>

              <h3>Attaching a target</h3>
              <p>A target is real ground truth you want to test the embedding against. Two ways:</p>
              <ul>
                <li>
                  <strong>Upload</strong> a CSV with <code>lat</code>, <code>lon</code> and one value
                  column, or a GeoJSON of points. Text or small whole-number codes are treated as
                  classes; decimals as measurements. Each row is matched to the nearest sampled point.
                </li>
                <li>
                  <strong>Label by hand</strong> — click a point, type a label (e.g. <em>forest</em>,{" "}
                  <em>cropland</em>) and Save. Label at least 3–5 points per class.
                </li>
              </ul>
              <pre className="guide__code">{`lat,lon,landcover
-1.2921,36.8219,urban
-1.3500,36.7000,forest
-1.2000,36.9000,cropland`}</pre>

              <h3>Exporting</h3>
              <p>
                <em>Export</em> (top right) downloads the sample as CSV (with all 64 values) or GeoJSON
                (opens in QGIS), including clusters, similarity and target columns. <em>Copy session
                summary</em> gives a citable text record of the source, area, year and methods.
              </p>
            </article>
          )}

          {section === "results" && (
            <article>
              <h2>Reading the results</h2>
              <p>Everything is computed in your browser from the points you loaded.</p>
              <dl className="guide__terms">
                <dt>PC1 %</dt>
                <dd>
                  How much of the variation one main pattern explains. High (50%+) means the area is
                  dominated by one contrast, e.g. forest vs. farmland.
                </dd>
                <dt>Clusters</dt>
                <dd>
                  Groups of points with alike embeddings. The real check is the map: do clusters follow
                  features you recognise (fields, rivers, towns)? Clusters have no names — that's your job.
                </dd>
                <dt>Similarity</dt>
                <dd>
                  Cosine similarity from −1 to +1 between a point's embedding and the query's. Use it
                  to find places that resemble a known site.
                </dd>
                <dt>Accuracy vs. baseline</dt>
                <dd>
                  For class targets, each labeled point is hidden and predicted from its 5 most similar
                  labeled neighbours. Compare to the baseline (always guessing the commonest class):
                  only accuracy well above it means a real signal.
                </dd>
                <dt>R²</dt>
                <dd>
                  For numeric targets: 1 is perfect, 0 is no better than guessing the average,
                  below 0 is worse. Above ~0.5 is a strong signal.
                </dd>
                <dt>Correlation |r|</dt>
                <dd>
                  How strongly a single embedding dimension tracks your target. Below 0.2 weak,
                  0.2–0.5 moderate, above 0.5 strong. Signals are often spread over many dimensions,
                  so R² is the better summary.
                </dd>
              </dl>
              <div className="guide__callout">
                <strong>Small samples mislead.</strong> With fewer than ~30 labeled points, results
                swing a lot. Label more points or load a larger sample before drawing conclusions.
              </div>
            </article>
          )}

          {section === "troubleshooting" && (
            <article>
              <h2>Troubleshooting</h2>
              <dl className="guide__terms">
                <dt>The sign-in window doesn't appear</dt>
                <dd>Your browser blocked the popup. Allow popups for this site (icon in the address bar), then press Retrieve again.</dd>
                <dt>“Error 400: origin_mismatch”</dt>
                <dd>
                  The site's address isn't on its Google sign-in allow-list. Only whoever runs the site
                  can fix this (see the README) — it isn't something you did wrong.
                </dd>
                <dt>“Access blocked” or “app not verified”</dt>
                <dd>
                  The site's Google sign-in is still in testing or awaiting review. If you see an{" "}
                  <em>Advanced</em> link you can continue; otherwise ask the site owner to add your
                  account as a tester.
                </dd>
                <dt>“isn't registered for Earth Engine”</dt>
                <dd>
                  Register your project at{" "}
                  <Ext href="https://code.earthengine.google.com/register">code.earthengine.google.com/register</Ext>.
                </dd>
                <dt>“The Earth Engine API is turned off”</dt>
                <dd>
                  Enable it on the{" "}
                  <Ext href="https://console.cloud.google.com/apis/library/earthengine.googleapis.com">Earth Engine API page</Ext>{" "}
                  for your project, wait a minute, and retry.
                </dd>
                <dt>“can't find project” / permission denied</dt>
                <dd>
                  Check you pasted the project <em>ID</em> (not its name or number), and that you signed
                  in with the Google account that owns it.
                </dd>
                <dt>Fewer points than requested</dt>
                <dd>Grid points over open water or outside coverage have no embedding, so they're skipped.</dd>
                <dt>“This area is tiny”</dt>
                <dd>Your points would be closer together than the 10 m pixels, so many would repeat. Zoom out and draw a bigger area.</dd>
                <dt>Earth Engine “computation timed out” or “too many requests”</dt>
                <dd>Use a smaller area or fewer points, wait a moment, and retry.</dd>
              </dl>
            </article>
          )}

          <footer className="guide__footer">
            {next ? (
              <button type="button" className="btn btn--primary" onClick={() => go(next.id)}>
                Next: {next.label} →
              </button>
            ) : (
              <button type="button" className="btn btn--primary" onClick={() => openGuide(null)}>
                Start exploring
              </button>
            )}
            {section === "welcome" && (
              <button type="button" className="btn btn--ghost" onClick={() => openGuide(null)}>
                Skip — I know my way around
              </button>
            )}
          </footer>
        </div>
      </div>
    </div>
  );
}
