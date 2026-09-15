/** Lloyd's k-means over typed-array vectors. Deterministic, seeded init. */

export interface ClusterResult {
  assignments: Uint8Array;
  centroids: number[][];
  inertia: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function kmeans(rows: (Float32Array | Float64Array)[], k: number, seed = 7): ClusterResult {
  const n = rows.length;
  if (n < k) throw new Error("k-means needs at least as many points as clusters.");
  const d = rows[0].length;
  const rand = mulberry32(seed);

  const centroids: number[][] = [];
  const used = new Set<number>();
  for (let c = 0; c < k; c += 1) {
    let idx = Math.floor(rand() * n);
    while (used.has(idx)) idx = Math.floor(rand() * n);
    used.add(idx);
    centroids.push(Array.from(rows[idx]));
  }

  const assignments = new Uint8Array(n);
  for (let iter = 0; iter < 40; iter += 1) {
    let changed = false;
    for (let i = 0; i < n; i += 1) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c += 1) {
        const centroid = centroids[c];
        let s = 0;
        for (let j = 0; j < d; j += 1) {
          const diff = rows[i][j] - centroid[j];
          s += diff * diff;
        }
        if (s < bestD) {
          bestD = s;
          best = c;
        }
      }
      if (assignments[i] !== best) {
        assignments[i] = best;
        changed = true;
      }
    }
    if (!changed) break;

    const sums = Array.from({ length: k }, () => new Float64Array(d));
    const counts = new Float64Array(k);
    for (let i = 0; i < n; i += 1) {
      const c = assignments[i];
      counts[c] += 1;
      const row = rows[i];
      for (let j = 0; j < d; j += 1) sums[c][j] += row[j];
    }
    for (let c = 0; c < k; c += 1) {
      if (counts[c] === 0) continue;
      for (let j = 0; j < d; j += 1) centroids[c][j] = sums[c][j] / counts[c];
    }
  }

  let inertia = 0;
  for (let i = 0; i < n; i += 1) {
    const c = assignments[i];
    const centroid = centroids[c];
    let s = 0;
    for (let j = 0; j < d; j += 1) {
      const diff = rows[i][j] - centroid[j];
      s += diff * diff;
    }
    inertia += s;
  }

  return { assignments, centroids, inertia };
}