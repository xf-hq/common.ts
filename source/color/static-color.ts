import { isDefined, isNumber, isString, isUndefined } from '../general/type-checking';
import { clamp, wrap } from '../primitive';
import { hexToHSLA, hexToRGBA, type HSLA, hslaToHex, hslaToRGBA, normalizeHexColorString, type RGBA, rgbaToHex, rgbaToHSLA } from './color-functions';

export const isStaticColor = (a: any): a is StaticColor => a instanceof StaticColor;

export namespace StaticColor {
  export type Spec = string | RGBA | HSLA | StaticColor;
}
/**
 * - Hue: A number >= 0 and < 1. For most functions/methods, inputs outside this range will wrap around.
 * - Saturation: A number between 0 (grey) and 1 (maximum colour).
 * - Lightness: A number between 0 (black) and 1 (white).
 */
export class StaticColor {
  private constructor () {}

  /**
   * @param color A hex `string`, `RGBA` object, `HSLA` object, or another `StaticColor` instance.
   */
  static from (color: StaticColor.Spec): StaticColor {
    if (isStaticColor(color)) return color;
    if (isString(color)) return this.fromHex(color);
    if ('r' in color) return this.fromRGBA(color);
    if ('h' in color) return this.fromHSLA(color);
    throw new Error(`Invalid color input`);
  }
  static fromHex (hex: string): StaticColor {
    const color = new this();
    color._hexString = normalizeHexColorString(hex);
    return color as StaticColor;
  }
  static fromRGBA (rgba: RGBA): StaticColor;
  static fromRGBA (r: number, g: number, b: number, a?: number): StaticColor;
  static fromRGBA (arg: RGBA | number, g?: number, b?: number, a?: number): StaticColor {
    const rgba: RGBA = isNumber(arg) ? { r: arg, g: g!, b: b!, a: a ?? 1 } : arg;
    const color = new this();
    color._rgba = rgba;
    return color as StaticColor;
  }
  static fromHSLA (hue: number, saturation: number, lightness: number, alpha?: number): StaticColor;
  static fromHSLA (hsla: HSLA): StaticColor;
  static fromHSLA (arg: HSLA | number, saturation?: number, lightness?: number, alpha?: number): StaticColor {
    const hsla: HSLA = isNumber(arg) ? { h: arg, s: saturation!, l: lightness!, a: alpha ?? 1 } : arg;
    const color = new this();
    color._hsla = hsla;
    return color as StaticColor;
  }
  /**
   * @param lightness A number between 0 and 1.
   */
  static fromLightness (lightness: number): StaticColor {
    return this.fromHSLA({ h: 0, s: 0, l: lightness, a: 1 });
  }

  static Black = StaticColor.fromHex('#000000');
  static White = StaticColor.fromHex('#ffffff');
  static Red = StaticColor.fromHex('#ff0000');
  static Green = StaticColor.fromHex('#00ff00');
  static Blue = StaticColor.fromHex('#0000ff');
  static Cyan = StaticColor.fromHex('#00ffff');
  static Magenta = StaticColor.fromHex('#ff00ff');
  static Yellow = StaticColor.fromHex('#ffff00');
  static TransparentBlack = StaticColor.fromHex('#00000000');
  static TransparentWhite = StaticColor.fromHex('#ffffff00');

  protected _rgba?: Readonly<RGBA>;
  protected _hsla?: Readonly<HSLA>;
  protected _hexString?: string;
  protected _rgbaString?: string;

  protected fromHex (hex: string): this { return (this.constructor as typeof StaticColor).fromHex(hex) as this; }
  protected fromRGBA (rgba: RGBA): this { return (this.constructor as typeof StaticColor).fromRGBA(rgba) as this; }
  protected fromHSLA (hsla: HSLA): this { return (this.constructor as typeof StaticColor).fromHSLA(hsla) as this; }

  get rgba () {
    if (isDefined(this._rgba)) return this._rgba;
    if (isDefined(this._hsla)) return this._rgba = hslaToRGBA(this._hsla);
    if (isDefined(this._hexString)) return this._rgba = hexToRGBA(this._hexString);
    return this._rgba = { r: 0, g: 0, b: 0, a: 1 };
  }
  get hsla () {
    if (isDefined(this._hsla)) return this._hsla;
    if (isDefined(this._rgba)) return this._hsla = rgbaToHSLA(this._rgba);
    if (isDefined(this._hexString)) return this._hsla = hexToHSLA(this._hexString);
    return this._hsla = { h: 0, s: 0, l: 0, a: 1 };
  }
  get hex () {
    if (isDefined(this._hexString)) return this._hexString;
    if (isDefined(this._rgba)) return this._hexString = rgbaToHex(this._rgba);
    if (isDefined(this._hsla)) return this._hexString = hslaToHex(this._hsla);
    return this._hexString = '#000000';
  }
  get rgbaString () {
    return this._rgbaString ??= this.alpha === 1
      ? `rgb(${this.red}, ${this.green}, ${this.blue})`
      : `rgba(${this.red}, ${this.green}, ${this.blue}, ${this.rgba.a})`;
  }

  /** A value in the range 0 to 255. 0 is black, 255 is primary red. */
  get red () { return this.rgba.r; }
  /** A value in the range 0 to 255. 0 is black, 255 is primary green. */
  get green () { return this.rgba.g; }
  /** A value in the range 0 to 255. 0 is black, 255 is primary blue. */
  get blue () { return this.rgba.b; }
  /** A value in the range 0 to <1. 0 is red. */
  get hue () { return this.hsla.h; }
  /** A value in the range 0 to 1. 0 is grey, 1 is fully saturated. */
  get saturation () { return this.hsla.s; }
  /** A value in the range 0 to 1. 0 is black, 1 is white. */
  get lightness () { return this.hsla.l; }
  /** A value in the range 0 to 1. 0 is fully transparent, 1 is fully opaque. */
  get alpha () { return isDefined(this.rgba) ? this.rgba.a : this.hsla.a; }

  get css_hsl () { return `hsl(${this.hsla.h * 360}deg, ${this.hsla.s * 100}%, ${this.hsla.l * 100}%)`; }

  toString () { return this.hex; }
  valueOf () { return this.hex; }
  [Symbol.toPrimitive] () { return this.hex; }

  /**
   * @param hue A number between 0 and 1. Values outside this range will wrap around.
   * @param saturation A number between 0 and 1.
   * @param lightness A number between 0 and 1.
   * @param alpha A number between 0 and 1.
   */
  setHSL (hue: number, saturation: number, lightness: number, alpha: number = 1) {
    return this.fromHSLA({
      h: wrap(0, 1, hue),
      s: clamp(0, 1, saturation),
      l: clamp(0, 1, lightness),
      a: clamp(0, 1, alpha),
    });
  }
  /**
   * @param saturation A number between 0 and 1.
   * @param lightness A number between 0 and 1.
   */
  setSL (saturation: number, lightness: number) {
    return this.setHSL(this.hue, saturation, lightness, this.alpha);
  }

  /**
   * @param red A number between 0 and 255.
   * @param green A number between 0 and 255.
   * @param blue A number between 0 and 255.
   * @param alpha A number between 0 and 1.
   */
  setRGB (red: number, green: number, blue: number, alpha: number = 1) {
    return this.fromRGBA({
      r: clamp(0, 255, red),
      g: clamp(0, 255, green),
      b: clamp(0, 255, blue),
      a: clamp(0, 1, alpha),
    });
  }

  /**
   * @param alpha A number between 0 and 1.
   */
  setAlpha (alpha: number) {
    if (isDefined(this._rgba)) return this.fromRGBA({ r: this._rgba.r, g: this._rgba.g, b: this._rgba.b, a: alpha });
    if (isDefined(this._hsla)) return this.fromHSLA({ h: this._hsla.h, s: this._hsla.s, l: this._hsla.l, a: alpha });
    if (isDefined(this._hexString)) return this.fromRGBA({ ...hexToRGBA(this._hexString), a: alpha });
    return this.fromRGBA({ r: 0, g: 0, b: 0, a: alpha });
  }

  /**
   * @param hueDelta A positive or negative fixed offset affecting a value in the range 0 to <1. Values out of this range will wrap around.
   * @param saturationDelta A positive or negative fixed offset affecting a value in the range 0 to 1. Values out of this range will be clamped.
   * @param lightnessDelta A positive or negative fixed offset affecting a value in the range 0 to 1. Values out of this range will be clamped.
   */
  shiftHSL (hueDelta: number, saturationDelta: number, lightnessDelta: number): this {
    const hsla = this.hsla;
    return this.fromHSLA({
      h: wrap(0, 1, hsla.h + hueDelta),
      s: clamp(0, 1, hsla.s + saturationDelta),
      l: clamp(0, 1, hsla.l + lightnessDelta),
      a: hsla.a,
    });
  }

  /**
   * @param hueDelta A number between 0 and 1 to add to the current hue value. If the final value falls outside the
   *   range 0-1, it will wrap around.
   */
  shiftHue (hueDelta: number) {
    return this.shiftHSL(hueDelta, 0, 0);
  }

  /**
   * @param saturationDelta A number between 0 and 1 to add to the current saturation value.
   */
  saturate (saturationDelta?: number) {
    return isUndefined(saturationDelta) ? this.setSaturation(1) : this.shiftHSL(0, saturationDelta, 0);
  }

  /**
   * Desaturates the colour relative to its current saturation.
   * @param percent A percentage string between 0% and 100% to subtract relative to the current saturation value. For
   * example, if the current saturation is 80% of the maximum possible saturation a colour can have, calling
   * `desaturate('20%')` would mean calculating 20% of the current saturation (20% x 80% = 16%) and desaturating the
   * colour by that amount (80% - 16% = final overall saturation of 64%).
   */
  desaturate (percent: `${string}%`): this;
  /**
   * @param saturationDelta A number between 0 and 1 to subtract from the current saturation value.
   */
  desaturate (saturationDelta?: number): this;
  desaturate (saturationDelta?: number | `${string}%`) {
    if (isUndefined(saturationDelta)) return this.setSaturation(0);
    if (isNumber(saturationDelta)) return this.saturate(-saturationDelta);
    const saturationMultiplier = parseFloat(saturationDelta) / 100;
    return this.multiplySaturation(1 - saturationMultiplier);
  }

  /**
   * Lightens the colour relative to its current lightness.
   * @param percent A percentage string between 0% and 100% to be added relative to the current lightness value. For
   * example, if the current lightness is 80% of the maximum possible lightness a colour can have, calling
   * `lighten('20%')` would mean calculating 20% of the current lightness (20% x 80% = 16%) and lightening the colour by
   * that amount (80% + 16% = final overall lightness of 96%).
   */
  lighten (percent: `${string}%`): this;
  /**
   * Lightens the colour by a fixed lightness value in the overall range 0 to 1.
   * @param lightnessDelta A number between 0 and 1 to add to the current lightness value.
   */
  lighten (lightnessDelta: number): this;
  lighten (value: number | `${string}%`): this {
    if (isNumber(value)) return this.shiftHSL(0, 0, value);
    const lightnessMultiplier = parseFloat(value) / 100;
    return this.multiplyLightness(1 + lightnessMultiplier);
  }

  /**
   * Darkens the colour relative to its current lightness.
   * @param percent A percentage string between 0% and 100% to be subtracted relative to the current lightness value.
   *   For example, if the current lightness is 80% of the maximum possible lightness a colour can have, calling
   *   `darken('20%')` would mean calculating 20% of the current lightness (20% x 80% = 16%) and darkening the colour by
   *   that amount (80% - 16% = final overall lightness of 64%).
   */
  darken (percent: `${string}%`): this;
  /**
   * Darkens the colour by a fixed lightness value in the overall range 0 to 1
   * @param lightnessDelta A number between 0 and 1 to subtract from the current lightness value.
   */
  darken (lightnessDelta: number): this;
  darken (value: number | `${string}%`) {
    if (isNumber(value)) return this.lighten(-value);
    const lightnessMultiplier = parseFloat(value) / 100;
    return this.multiplyLightness(1 - lightnessMultiplier);
  }

  /**
   * @param hueMultiplier A number to multiply the hue by.
   * @param saturationMultiplier A number to multiply the saturation by.
   * @param lightnessMultiplier A number to multiply the lightness by.
   */
  multiplyHSL (hueMultiplier: number, saturationMultiplier: number, lightnessMultiplier: number): this {
    const hsla = this.hsla;
    return this.fromHSLA({
      h: wrap(0, 1, hsla.h * hueMultiplier),
      s: clamp(0, 1, hsla.s * saturationMultiplier),
      l: clamp(0, 1, hsla.l * lightnessMultiplier),
      a: hsla.a,
    });
  }

  /**
   * @param hueMultiplier A number to multiply the hue by.
   */
  multiplyHue (hueMultiplier: number): this {
    return this.multiplyHSL(hueMultiplier, 1, 1);
  }

  /**
   * @param saturationMultiplier A number to multiply the saturation by.
   */
  multiplySaturation (saturationMultiplier: number): this {
    return this.multiplyHSL(1, saturationMultiplier, 1);
  }

  /**
   * @param lightnessMultiplier A number to multiply the lightness by.
   */
  multiplyLightness (lightnessMultiplier: number): this {
    return this.multiplyHSL(1, 1, lightnessMultiplier);
  }

  /**
   * @param hue A number between 0 and 1. Values outside this range will wrap around.
   */
  setHue (hue: number) {
    hue = wrap(0, 1, hue);
    const hsla = this.hsla;
    if (hsla.h === hue) return this;
    return this.fromHSLA({
      h: hue,
      s: hsla.s,
      l: hsla.l,
      a: hsla.a,
    });
  }

  /**
   * @param saturation A number between 0 and 1.
   */
  setSaturation (saturation: number) {
    const hsla = this.hsla;
    saturation = clamp(0, 1, saturation);
    if (hsla.s === saturation) return this;
    return this.fromHSLA({
      h: hsla.h,
      s: saturation,
      l: hsla.l,
      a: hsla.a,
    });
  }

  /**
   * @param lightness A number between 0 and 1.
   */
  setLightness (lightness: number) {
    const hsla = this.hsla;
    lightness = clamp(0, 1, lightness);
    if (hsla.l === lightness) return this;
    return this.fromHSLA({
      h: hsla.h,
      s: hsla.s,
      l: lightness,
      a: hsla.a,
    });
  }

  /**
   * @param towards A color to interpolate to move the current color in the direction of.
   * @param amount A number between 0 and 1 to determine how far to move the current color towards the target color.
   */
  interpolate (towards: this | string, amount: number): this {
    const rgba0 = this.rgba;
    const rgba1 = isStaticColor(towards) ? towards.rgba : hexToRGBA(towards);
    return this.fromRGBA({
      r: rgba0.r + (rgba1.r - rgba0.r) * amount,
      g: rgba0.g + (rgba1.g - rgba0.g) * amount,
      b: rgba0.b + (rgba1.b - rgba0.b) * amount,
      a: rgba0.a + (rgba1.a - rgba0.a) * amount,
    });
  }

  /**
   * @param target A color or hue value (in the range 0-1) to interpolate the current color towards.
   * @param amount A number between 0 and 1 to determine how far to move the current color towards the target color.
   */
  interpolateHue (target: this | string | number, amount: number): this {
    const hsla0 = this.hsla;
    const h1 = isStaticColor(target) ? target.hue : isNumber(target) ? target : hexToHSLA(target).h;
    return this.setHue(wrap(0, 1, hsla0.h + (h1 - hsla0.h) * amount));
  }

  /**
   * @param target A color or saturation value (in the range 0-1) to interpolate the current color towards.
   * @param amount A number between 0 and 1 to determine how far to move the current color towards the target color.
   */
  interpolateSaturation (target: this | string | number, amount: number) {
    const targetSaturation = isStaticColor(target) ? target.saturation : isNumber(target) ? target : hexToHSLA(target).s;
    const newSaturation = clamp(0, 1, this.saturation + (targetSaturation - this.saturation) * amount);
    return this.setSaturation(newSaturation);
  }

  /**
   * @param target A color or lightness value (in the range 0-1) to interpolate the current color towards.
   * @param amount A number between 0 and 1 to determine how far to move the current color towards the target color.
   */
  interpolateLightness (target: this | string | number, amount: number) {
    const targetLightness = isStaticColor(target) ? target.lightness : isNumber(target) ? target : hexToHSLA(target).l;
    const newLightness = this.lightness + (targetLightness - this.lightness) * amount;
    return this.setLightness(newLightness);
  }

  /**
   * Interpolates the saturation and lightness of the color towards the target color.
   * @param target A color or HSLA value to interpolate towards.
   * @param amount A number between 0 and 1 to determine how far to move the current color towards the target color.
   */
  interpolateSL (target: this | string | number, amount: number): this {
    let targetHSLA: HSLA;
    if (isStaticColor(target)) {
      targetHSLA = { h: this.hue, s: target.saturation, l: target.lightness, a: this.alpha };
    }
    else if (isString(target)) {
      targetHSLA = hexToHSLA(target);
      targetHSLA.h = this.hue;
      targetHSLA.a = this.alpha;
    }
    else {
      targetHSLA = { h: this.hue, s: target, l: target, a: this.alpha };
    }
    const newSaturation = clamp(0, 1, this.saturation + (targetHSLA.s - this.saturation) * amount);
    const newLightness = this.lightness + (targetHSLA.l - this.lightness) * amount;
    return this.fromHSLA({
      h: this.hue,
      s: newSaturation,
      l: newLightness,
      a: this.alpha,
    });
  }

  /**
   * Adjusts the vibrance of the color. Unlike saturation, vibrance has less effect on already-vibrant colors
   * and a stronger effect on less saturated ones.
   * @param vibranceDelta A number between -1 and 1 to add to the current vibrance.
   */
  adjustVibrance (vibranceDelta: number): this {
    const hsla = this.hsla;
    // Calculate vibrance adjustment based on current saturation
    const adjustment = vibranceDelta * (1 - hsla.s);
    return this.fromHSLA({
      h: hsla.h,
      s: clamp(0, 1, hsla.s + adjustment),
      l: hsla.l,
      a: hsla.a,
    });
  }

  /**
   * Increases the vibrance of the color.
   * @param percent A percentage string between 0% and 100% to increase the vibrance by.
   */
  increaseVibrance (percent: `${string}%`): this;
  /**
   * @param amount A number between 0 and 1 to increase the vibrance by.
   */
  increaseVibrance (amount?: number): this;
  increaseVibrance (value?: number | `${string}%`): this {
    if (isUndefined(value)) return this.adjustVibrance(1);
    if (isNumber(value)) return this.adjustVibrance(value);
    const vibranceMultiplier = parseFloat(value) / 100;
    return this.adjustVibrance(vibranceMultiplier);
  }

  /**
   * Decreases the vibrance of the color.
   * @param percent A percentage string between 0% and 100% to decrease the vibrance by.
   */
  reduceVibrance (percent: `${string}%`): this;
  /**
   * @param amount A number between 0 and 1 to decrease the vibrance by.
   */
  reduceVibrance (amount?: number): this;
  reduceVibrance (value?: number | `${string}%`): this {
    if (isUndefined(value)) return this.adjustVibrance(-1);
    if (isNumber(value)) return this.adjustVibrance(-value);
    const vibranceMultiplier = parseFloat(value) / 100;
    return this.adjustVibrance(-vibranceMultiplier);
  }
}
