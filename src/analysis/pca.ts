/** Lightweight covariance-based PCA over typed arrays. Deterministic. */

export interface PcaResult {
  /** Projected coordinates, `n × k`. */
  scores: Float64Array[];
  /** Per-component variance explained. */
  varianceExplained: number[];
  /** Top-k eigenvectors (principal axes), `k × d`. */
  loadings: number[][];
}

function centerColumns(rows: Float64Array[]): Float64Array[] {
  const n = rows.length;
  const d = rows[0].length;
  const mean = new Float64Array(d);
  for (const row of rows) {
    for (let j = 0; j < d; j += 1) mean[j] += row[j];
  }
  for (let j = 0; j < d; j += 1) mean[j] /= n;
  return rows.map((row) => {
    const out = new Float64Array(d);
    for (let j = 0; j < d; j += 1) out[j] = row[j] - mean[j];
    return out;
  });
}

function covariance(centered: Float64Array[]): number[][] {
  const n = centered.length;
  const d = centered[0].length;
  const cov: number[][] = Array.from({ length: d }, () => new Array(d).fill(0));
  for (let i = 0; i < d; i += 1) {
    for (let j = i; j < d; j += 1) {
      let s = 0;
      for (const row of centered) s += row[i] * row[j];
      cov[i][j] = s / n;
      cov[j][i] = s / n;
    }
  }
  return cov;
}

/** Jacobi eigenvalue decomposition for symmetric matrices. */
function jacobi(a: number[][], maxIter = 64): { eigenValues: number[]; eigenVectors: number[][] } {
  const n = a.length;
  const V = Array.from({ length: n }, (_, i) => {
    const row = new Array(n).fill(0);
    row[i] = 1;
    return row;
  });
  const A = a.map((row) => row.slice());

  for (let iter = 0; iter < maxIter; iter += 1) {
    let p = 0;
    let q = 1;
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        if (Math.abs(A[i][j]) > Math.abs(A[p][q])) {
          p = i;
          q = j;
        }
      }
    }
    const apq = A[p][q];
    const tolerance = 1e-12;
    if (Math.abs(apq) < tolerance) break;

    const app = A[p][p];
    const aqq = A[q][q];
    const phi = (aqq - app) / (2 * apq);
    const t = Math.sign(phi || 1) / (Math.abs(phi) + Math.sqrt(phi * phi + 1));
    const c = 1 / Math.sqrt(t * t + 1);
    const s = t * c;

    for (let k = 0; k < n; k += 1) {
      const akp = A[k][p];
      const akq = A[k][q];
      A[k][p] = c * akp - s * akq;
      A[k][q] = s * akp + c * akq;
    }
    for (let k = 0; k < n; k += 1) {
      const apk = A[p][k];
      const aqk = A[q][k];
      A[p][k] = c * apk - s * aqk;
      A[q][k] = s * apk + c * aqk;
    }
    A[p][q] = 0;
    A[q][p] = 0;

    for (let k = 0; k < n; k += 1) {
      const vkp = V[k][p];
      const vkq = V[k][q];
      V[k][p] = c * vkp - s * vkq;
      V[k][q] = s * vkp + c * vkq;
    }
  }

  const indices = Array.from({ length: n }, (_, i) => i);
  indices.sort((i, j) => A[j][j] - A[i][i]);
  const eigenValues = indices.map((i) => A[i][i]);
  const eigenVectors = indices.map((i) => V.map((row) => row[i]));
  return { eigenValues, eigenVectors };
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * Project `rows` onto its top-k principal components.
 * Throws when the input is degenerate (fewer than 1 point, or less variation).
 */
export function pca(rows: (Float32Array | Float64Array)[], k = 2): PcaResult {
  if (rows.length < 2) {
    throw new Error("PCA needs at least 2 points.");
  }
  const d = rows[0].length;
  for (const row of rows) {
    if (row.length !== d) {
      throw new Error("All vectors must have the same dimensionality.");
    }
  }
  const asFloat = rows.map((r) => Float64Array.from(r));
  const centered = centerColumns(asFloat);
  const cov = covariance(centered);
  const { eigenValues, eigenVectors } = jacobi(cov);

  const total = eigenValues.reduce((a, b) => a + b, 0) || 1;
  const components = Math.min(k, d);
  const scores: Float64Array[] = centered.map((row) => {
    const out = new Float64Array(components);
    for (let c = 0; c < components; c += 1) {
      let s = 0;
      for (let j = 0; j < d; j += 1) s += eigenVectors[c][j] * row[j];
      out[c] = s;
    }
    return out;
  });

  const varianceExplained = eigenValues.slice(0, components).map((v) => clamp(v / total, 0, 1));
  return {
    scores,
    varianceExplained,
    loadings: eigenVectors.slice(0, components),
  };
}