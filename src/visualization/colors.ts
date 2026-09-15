const VIRIDIS: Array<[number, number, number]> = [
  [68, 1, 84],
  [72, 25, 130],
  [68, 49, 163],
  [56, 74, 182],
  [40, 99, 184],
  [29, 122, 167],
  [40, 142, 139],
  [66, 158, 110],
  [104, 170, 82],
  [145, 179, 60],
  [193, 187, 45],
  [247, 193, 24],
  [253, 231, 37],
];

function hex(r: number, g: number, b: number): string {
  const c = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Perceptually uniform, colorblind-safe ramp (Viridis family) for continuous data. */
export function viridis(t: number): string {
  const x = Math.min(1, Math.max(0, t));
  const pos = x * (VIRIDIS.length - 1);
  const i = Math.min(VIRIDIS.length - 2, Math.floor(pos));
  const f = pos - i;
  const a = VIRIDIS[i];
  const b = VIRIDIS[i + 1];
  return hex(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f);
}

/** Small, distinct qualitative palette for categorical cluster coloring. */
export const CATEGORICAL = [
  "#4c9be8",
  "#e18f46",
  "#7fd6e0",
  "#c97fd6",
  "#8fd67f",
  "#e0d27f",
  "#d67f8f",
  "#9aa3b8",
];

export function categorical(i: number): string {
  return CATEGORICAL[((i % CATEGORICAL.length) + CATEGORICAL.length) % CATEGORICAL.length];
}

export const NEUTRAL_POINT = "#c9d2d9";
export const ACCENT = "#7fd6e0";
export const ERROR = "#d67979";
export const WARN = "#d6b27f";