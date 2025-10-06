// Shared color utilities for consistent coloring across plot and image components

/**
 * Viridis colorscale approximation (similar to Plotly's default)
 * Maps normalized values (0-1) to colors
 */
const viridisColors: [number, string][] = [
  [0.0, '#440154'],
  [0.1, '#482777'],
  [0.2, '#3f4a8a'],
  [0.3, '#31678e'],
  [0.4, '#26838f'],
  [0.5, '#1f9d8a'],
  [0.6, '#6cce5a'],
  [0.7, '#b6de2b'],
  [0.8, '#fee825'],
  [1.0, '#f0f921']
];

/**
 * Interpolate between two colors
 */
function interpolateColor(color1: string, color2: string, factor: number): string {
  const hex2rgb = (hex: string) => ({
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  });
  
  const rgb2hex = (r: number, g: number, b: number) => 
    '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
  
  const c1 = hex2rgb(color1);
  const c2 = hex2rgb(color2);
  
  return rgb2hex(
    c1.r + factor * (c2.r - c1.r),
    c1.g + factor * (c2.g - c1.g),
    c1.b + factor * (c2.b - c1.b)
  );
}

/**
 * Get color from viridis colorscale for a normalized value (0-1)
 */
function getViridisColor(normalizedValue: number): string {
  // Clamp to [0, 1]
  const t = Math.max(0, Math.min(1, normalizedValue));
  
  // Find the two colors to interpolate between
  let lowerIndex = 0;
  for (let i = 0; i < viridisColors.length - 1; i++) {
    if (viridisColors[i + 1][0] >= t) {
      lowerIndex = i;
      break;
    }
  }
  
  const upperIndex = Math.min(lowerIndex + 1, viridisColors.length - 1);
  const lower = viridisColors[lowerIndex];
  const upper = viridisColors[upperIndex];
  
  if (lower[0] === upper[0]) {
    return lower[1] as string;
  }
  
  const factor = (t - lower[0]) / (upper[0] - lower[0]);
  return interpolateColor(lower[1], upper[1], factor);
}

/**
 * Convert z-value to color using the same colorscale as the plot
 * @param zValue The z-value to convert
 * @param zMin Minimum z-value in the dataset
 * @param zMax Maximum z-value in the dataset
 * @param fallbackColor Color to use if z-value is undefined/null
 * @returns Hex color string
 */
export function zValueToColor(
  zValue: number | undefined | null,
  zMin: number,
  zMax: number,
  fallbackColor = '#2563eb'
): string {
  if (zValue == null || zMin === zMax) {
    return fallbackColor;
  }
  
  const normalized = (zValue - zMin) / (zMax - zMin);
  return getViridisColor(normalized);
}

/**
 * Calculate min and max from an array of z-values
 */
export function getZRange(zValues: (number | undefined | null)[]): { min: number; max: number } {
  const validValues = zValues.filter((z): z is number => z != null);
  
  if (validValues.length === 0) {
    return { min: 0, max: 1 };
  }
  
  return {
    min: Math.min(...validValues),
    max: Math.max(...validValues)
  };
}

/**
 * Default colors for different box types when no z-value is available
 */
export const defaultBoxColors = {
  detection: '#22c55e',     // green
  annotation: '#a855f7',    // purple  
  manual: '#ef4444',        // red
  drawing: '#3b82f6',       // blue
  annotationPoint: '#f59e0b' // orange/amber
};