/**
 * Small, honest supervised analyses against a real target: Pearson
 * correlation per dimension, and k-NN (cosine) evaluated by leave-one-out so
 * no point is ever scored by a model that saw it.
 */

type Vec = Float32Array | Float64Array;

export function pearson(x: ArrayLike<number>, y: ArrayLike<number>): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i += 1) {
    mx += x[i];
    my += y[i];
  }
  mx /= n;
  my /= n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  const denom = Math.sqrt(sxx * syy);
  return denom === 0 ? 0 : sxy / denom;
}

/** Pearson r between every embedding dimension and the target value. */
export function correlateDimensions(vectors: Vec[], values: number[]): number[] {
  if (vectors.length === 0) return [];
  const d = vectors[0].length;
  const col = new Float64Array(vectors.length);
  const out: number[] = [];
  for (let j = 0; j < d; j += 1) {
    for (let i = 0; i < vectors.length; i += 1) col[i] = vectors[i][j];
    out.push(pearson(col, values));
  }
  return out;
}

function norms(vectors: Vec[]): Float64Array {
  const out = new Float64Array(vectors.length);
  vectors.forEach((v, i) => {
    let s = 0;
    for (let j = 0; j < v.length; j += 1) s += v[j] * v[j];
    out[i] = Math.sqrt(s) || 1;
  });
  return out;
}

/** Indices of the k most cosine-similar training rows to `query`. */
function nearest(
  query: Vec,
  queryNorm: number,
  train: Vec[],
  trainNorms: Float64Array,
  k: number,
  exclude: number,
): number[] {
  const best: Array<{ i: number; s: number }> = [];
  for (let i = 0; i < train.length; i += 1) {
    if (i === exclude) continue;
    const t = train[i];
    let dot = 0;
    for (let j = 0; j < t.length; j += 1) dot += query[j] * t[j];
    const s = dot / (queryNorm * trainNorms[i]);
    if (best.length < k) {
      best.push({ i, s });
      best.sort((a, b) => b.s - a.s);
    } else if (s > best[k - 1].s) {
      best[k - 1] = { i, s };
      best.sort((a, b) => b.s - a.s);
    }
  }
  return best.map((b) => b.i);
}

function vote(labels: string[], idx: number[]): string {
  const counts = new Map<string, number>();
  let top = labels[idx[0]];
  let topN = 0;
  for (const i of idx) {
    const n = (counts.get(labels[i]) ?? 0) + 1;
    counts.set(labels[i], n);
    if (n > topN) {
      topN = n;
      top = labels[i];
    }
  }
  return top;
}

function mean(values: number[], idx: number[]): number {
  let s = 0;
  for (const i of idx) s += values[i];
  return s / idx.length;
}

export interface ClassificationReport {
  classes: string[];
  /** confusion[actual][predicted] */
  confusion: number[][];
  accuracy: number;
  /** Accuracy of always guessing the most common class. */
  baseline: number;
  macroF1: number;
  n: number;
  k: number;
}

export function classifyLeaveOneOut(vectors: Vec[], labels: string[], k = 5): ClassificationReport {
  const n = vectors.length;
  const classes = [...new Set(labels)].sort();
  const index = new Map(classes.map((c, i) => [c, i]));
  const confusion = classes.map(() => classes.map(() => 0));
  const kk = Math.max(1, Math.min(k, n - 1));
  const ns = norms(vectors);
  let correct = 0;
  for (let i = 0; i < n; i += 1) {
    const predicted = vote(labels, nearest(vectors[i], ns[i], vectors, ns, kk, i));
    confusion[index.get(labels[i])!][index.get(predicted)!] += 1;
    if (predicted === labels[i]) correct += 1;
  }
  const f1s = classes.map((_, c) => {
    const tp = confusion[c][c];
    const fp = confusion.reduce((s, row, r) => s + (r === c ? 0 : row[c]), 0);
    const fn = confusion[c].reduce((s, v, p) => s + (p === c ? 0 : v), 0);
    return tp === 0 ? 0 : (2 * tp) / (2 * tp + fp + fn);
  });
  const majority = Math.max(...classes.map((c) => labels.filter((l) => l === c).length));
  return {
    classes,
    confusion,
    accuracy: n ? correct / n : 0,
    baseline: n ? majority / n : 0,
    macroF1: f1s.reduce((a, b) => a + b, 0) / Math.max(1, classes.length),
    n,
    k: kk,
  };
}

export interface RegressionReport {
  r2: number;
  rmse: number;
  n: number;
  k: number;
}

export function regressLeaveOneOut(vectors: Vec[], values: number[], k = 5): RegressionReport {
  const n = vectors.length;
  const kk = Math.max(1, Math.min(k, n - 1));
  const ns = norms(vectors);
  const avg = values.reduce((a, b) => a + b, 0) / Math.max(1, n);
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i += 1) {
    const predicted = mean(values, nearest(vectors[i], ns[i], vectors, ns, kk, i));
    ssRes += (values[i] - predicted) ** 2;
    ssTot += (values[i] - avg) ** 2;
  }
  return { r2: ssTot === 0 ? 0 : 1 - ssRes / ssTot, rmse: Math.sqrt(ssRes / Math.max(1, n)), n, k: kk };
}

/** Predict a label for every query vector from the labeled training set. */
export function predictLabels(train: Vec[], labels: string[], queries: Vec[], k = 5): string[] {
  const ns = norms(train);
  const qn = norms(queries);
  const kk = Math.max(1, Math.min(k, train.length));
  return queries.map((q, i) => vote(labels, nearest(q, qn[i], train, ns, kk, -1)));
}

export function predictValues(train: Vec[], values: number[], queries: Vec[], k = 5): number[] {
  const ns = norms(train);
  const qn = norms(queries);
  const kk = Math.max(1, Math.min(k, train.length));
  return queries.map((q, i) => mean(values, nearest(q, qn[i], train, ns, kk, -1)));
}
