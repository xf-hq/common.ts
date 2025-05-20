import { clamp, ifNaN, round, wrap } from '../primitive/number';
import { truncateStringWithEllipsis } from '../primitive/string';

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}
export interface HSLA {
  h: number;
  s: number;
  l: number;
  a: number;
}

/**
 * @param hueDelta An positive or negative fixed offset affecting a value in the range 0 to <1. Values out of this range will wrap around.
 * @param saturationDelta A positive or negative fixed offset affecting a value in the range 0 to 1. Values out of this range will be clamped.
 * @param lightnessDelta A positive or negative fixed offset affecting a value in the range 0 to 1. Values out of this range will be clamped.
 */
export function incrementHSL (hueDelta: number, saturationDelta: number, lightnessDelta: number, baseColor: string): string {
  const hsla = hexToHSLA(baseColor);
  hsla.h = wrap(0, 1, hsla.h + hueDelta);
  hsla.s = clamp(0, 1, hsla.s + saturationDelta);
  hsla.l = clamp(0, 1, hsla.l + lightnessDelta);
  return hslaToHex(hsla);
}

/**
 * @param hueMultiplier A number to multiply the hue by.
 * @param saturationMultiplier A number to multiply the saturation by.
 * @param lightnessMultiplier A number to multiply the lightness by.
 */
export function multiplyHSL (hueMultiplier: number, saturationMultiplier: number, lightnessMultiplier: number, baseColor: string): string {
  const hsla = hexToHSLA(baseColor);
  hsla.h = wrap(0, 1, hsla.h * hueMultiplier);
  hsla.s = clamp(0, 1, hsla.s * saturationMultiplier);
  hsla.l = clamp(0, 1, hsla.l * lightnessMultiplier);
  return hslaToHex(hsla);
}

/**
 * @param saturation A number between 0 and 1.
 * @param lightness A number between 0 and 1.
 */
export function setSL (saturation: number, lightness: number, baseColor: string): string {
  const hsla = hexToHSLA(baseColor);
  hsla.s = saturation;
  hsla.l = lightness;
  return hslaToHex(hsla);
}

/**
 * @param hue A number between 0 and 1. Values outside this range will wrap around.
 * @param baseColor A hex colour string.
 */
export function setHue (hue: number, baseColor: string): string {
  const hsla = hexToHSLA(baseColor);
  hsla.h = hue;
  return hslaToHex(hsla);
}

/**
 * @param saturation A number between 0 and 1.
 * @param baseColor A hex colour string.
 */
export function setSaturation (saturation: number, baseColor: string): string {
  const hsla = hexToHSLA(baseColor);
  hsla.s = saturation;
  return hslaToHex(hsla);
}

/**
 * @param lightness A number between 0 and 1.
 * @param baseColor A hex colour string.
 */
export function setLightness (lightness: number, baseColor: string): string {
  const hsla = hexToHSLA(baseColor);
  hsla.l = lightness;
  return hslaToHex(hsla);
}

/**
 * @param hex A hex colour string in any of the following formats (case insensitive):
 * - #RGB
 * - #RGBA
 * - #RRGGBB
 * - #RRGGBBAA
 * - RGB
 * - RGBA
 * - RRGGBB
 * - RRGGBBAA
 * @returns A hex colour string in the format #RRGGBB or #RRGGBBAA (depending on whether or not the input string includes an alpha component).
 */
export function normalizeHexColorString (hex: string) {
  const match = /^#?([0-9a-f]{3,4}|[0-9a-f]{6,8})$/i.exec(hex.toLowerCase());
  if (!match) {
    console.warn(`normalizeHexColorString() -> \`hex\` argument value "${truncateStringWithEllipsis(String(hex), 20)}" is invalid and will be treated as black.`);
    return '#000000';
  }
  const value = match[1];
  let r: string, g: string, b: string, a: string | null = null;
  switch (value.length) {
    case 3: [r, g, b] = value; break;
    case 4: [r, g, b, a] = value; break;
    case 6:
    case 8: return hex[0] === '#' ? match[0] : `#${match[0]}`;
    default: throw new Error(`This should be unreachable. Value: ${value}`);
  }
  return `#${r}${r}${g}${g}${b}${b}${a ?? ''}`;
}

const parseHexCharToPercentFloat = (c: string): number => ifNaN(0, parseInt(c, 16) / 15);
const parseHexPairToPercentFloat = (c: string): number => ifNaN(0, parseInt(c, 16) / 255);

// The following functions were adapted from https://css-tricks.com/converting-color-spaces-in-javascript/

export function hexToRGBA (hex: string): RGBA {
  const i0 = hex.startsWith('#') ? 1 : 0;
  let r: number, g: number, b: number, a: number = 1;
  switch (hex.length - i0) {
    case 4: a = parseHexCharToPercentFloat(hex[i0 + 3]);
    case 3: {
      r = parseHexCharToPercentFloat(hex[i0 + 0]);
      g = parseHexCharToPercentFloat(hex[i0 + 1]);
      b = parseHexCharToPercentFloat(hex[i0 + 2]);
      break;
    }
    case 8: a = parseHexPairToPercentFloat(hex.slice(i0 + 6, i0 + 8));
    case 6: {
      r = parseHexPairToPercentFloat(hex.slice(i0 + 0, i0 + 2));
      g = parseHexPairToPercentFloat(hex.slice(i0 + 2, i0 + 4));
      b = parseHexPairToPercentFloat(hex.slice(i0 + 4, i0 + 6));
      break;
    }
    default: {
      r = g = b = 0;
      a = 1;
    }
  }
  return { r, g, b, a };
}

export function hexToHSLA (hex: string): HSLA {
  return rgbaToHSLA(hexToRGBA(hex));
}

export function rgbaToHSLA ({ r, g, b, a }: RGBA): HSLA {
  // Find greatest and smallest channel values
  const cmin = Math.min(r, g, b),
        cmax = Math.max(r, g, b),
        delta = cmax - cmin;
  let h = 0,
      s = 0,
      l = 0;

  if (delta === 0) h = 0; // No difference
  else if (cmax === r) h = ((g - b) / delta) % 6; // Red is max
  else if (cmax === g) h = (b - r) / delta + 2; // Green is max
  else h = (r - g) / delta + 4; // Blue is max

  h = round(h * 60);

  // Make negative hues positive behind 360°
  if (h < 0) h += 360;

  h /= 360; // Normalize to 1
  l = (cmax + cmin) / 2;
  s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return { h, s, l, a };
}

export function hslaToRGBA (hsla: HSLA): RGBA {
  const h = wrap(0, 360, hsla.h * 360);
  const { s, l, a } = hsla;
  const c = (1 - Math.abs(2 * l - 1)) * s,
        x = c * (1 - Math.abs((h / 60) % 2 - 1)),
        m = l - c / 2;
  let r = 0,
      g = 0,
      b = 0;
  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else if (300 <= h && h < 360) { r = c; g = 0; b = x; }
  r += m;
  g += m;
  b += m;
  return { r, g, b, a };
}

export function rgbaToHex (rgba: RGBA): string {
  const r = round(rgba.r * 255).toString(16).padStart(2, '0');
  const g = round(rgba.g * 255).toString(16).padStart(2, '0');
  const b = round(rgba.b * 255).toString(16).padStart(2, '0');
  if (rgba.a === 1) return `#${r}${g}${b}`;
  const a = round(rgba.a * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}${a}`;
}

export function hslaToHex (hsla: HSLA): string {
  return rgbaToHex(hslaToRGBA(hsla));
}
