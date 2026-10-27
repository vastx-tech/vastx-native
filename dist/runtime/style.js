import { colors, fontSizes, radii, spacing } from "./theme.js";
const REM_TO_DIP = 16;
export function resolveLength(value) {
  if (typeof value === "number") return value;
  if (value in spacing) return spacing[value];
  const remMatch = /^(-?\d+(?:\.\d+)?)rem$/.exec(value);
  if (remMatch) return Number(remMatch[1]) * REM_TO_DIP;
  const pxMatch = /^(-?\d+(?:\.\d+)?)px$/.exec(value);
  if (pxMatch) return Number(pxMatch[1]);
  throw new Error(`[vastx-native] Invalid length: "${value}" \u2014 expected a spacing token, a number, or a "Npx"/"Nrem" string.`);
}
export function resolveColor(input) {
  return input in colors ? colors[input] : input;
}
function hexToRgb(color) {
  const hex = color.replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  const num = Number.parseInt(full, 16);
  return [num >> 16 & 255, num >> 8 & 255, num & 255];
}
function clamp255(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}
function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((v) => clamp255(v).toString(16).padStart(2, "0")).join("")}`;
}
export function opacity(color, amount) {
  const [r, g, b] = hexToRgb(resolveColor(color));
  return `rgba(${r}, ${g}, ${b}, ${amount})`;
}
export function shade(color, amount) {
  const [r, g, b] = hexToRgb(resolveColor(color));
  const factor = 1 - amount;
  return rgbToHex(r * factor, g * factor, b * factor);
}
export function tint(color, amount) {
  const [r, g, b] = hexToRgb(resolveColor(color));
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}
function resolveSides(input, prefix) {
  const sides = typeof input === "object" ? input : { all: input };
  const top = sides.top ?? sides.vertical ?? sides.all;
  const bottom = sides.bottom ?? sides.vertical ?? sides.all;
  const left = sides.left ?? sides.horizontal ?? sides.all;
  const right = sides.right ?? sides.horizontal ?? sides.all;
  const style = {};
  if (top !== void 0) style[`${prefix}Top`] = resolveLength(top);
  if (right !== void 0) style[`${prefix}Right`] = resolveLength(right);
  if (bottom !== void 0) style[`${prefix}Bottom`] = resolveLength(bottom);
  if (left !== void 0) style[`${prefix}Left`] = resolveLength(left);
  return style;
}
export function padding(input) {
  return resolveSides(input, "padding");
}
export function margin(input) {
  return resolveSides(input, "margin");
}
function resolveDimension(value) {
  return value === "100%" || value === "auto" ? value : resolveLength(value);
}
export function size(input) {
  const style = {};
  if (input.width !== void 0) style.width = resolveDimension(input.width);
  if (input.height !== void 0) style.height = resolveDimension(input.height);
  if (input.minWidth !== void 0) style.minWidth = resolveLength(input.minWidth);
  if (input.minHeight !== void 0) style.minHeight = resolveLength(input.minHeight);
  if (input.maxWidth !== void 0) style.maxWidth = resolveLength(input.maxWidth);
  if (input.maxHeight !== void 0) style.maxHeight = resolveLength(input.maxHeight);
  return style;
}
export function bg(input) {
  if (typeof input === "string") return { backgroundColor: resolveColor(input) };
  const style = {};
  if (input.color !== void 0) style.backgroundColor = resolveColor(input.color);
  if (input.image !== void 0) style.backgroundImage = input.image;
  if (input.repeat !== void 0) style.backgroundRepeat = input.repeat;
  if (input.position !== void 0) style.backgroundPosition = input.position;
  if (input.size !== void 0) style.backgroundSize = input.size;
  return style;
}
export function box(input = {}) {
  const style = {};
  if (input.radius !== void 0) {
    style.borderRadius = typeof input.radius === "string" && input.radius in radii ? radii[input.radius] : resolveLength(input.radius);
  }
  if (input.background !== void 0) style.backgroundColor = resolveColor(input.background);
  if (input.elevated) style.boxShadow = "0 1 3 rgba(15, 23, 42, 0.12)";
  if (input.borderWidth !== void 0) style.borderWidth = resolveLength(input.borderWidth);
  if (input.borderColor !== void 0) style.borderColor = resolveColor(input.borderColor);
  if (input.opacity !== void 0) style.opacity = input.opacity;
  if (input.clipPath !== void 0) style.clipPath = input.clipPath;
  return style;
}
function resolveRadiusValue(value) {
  return typeof value === "string" && value in radii ? radii[value] : resolveLength(value);
}
export function border(input) {
  const style = {};
  if (input.width !== void 0) {
    if (typeof input.width === "object") {
      const w = input.width;
      if (w.top !== void 0) style.borderTopWidth = resolveLength(w.top);
      if (w.right !== void 0) style.borderRightWidth = resolveLength(w.right);
      if (w.bottom !== void 0) style.borderBottomWidth = resolveLength(w.bottom);
      if (w.left !== void 0) style.borderLeftWidth = resolveLength(w.left);
      if (w.all !== void 0) style.borderWidth = resolveLength(w.all);
    } else {
      style.borderWidth = resolveLength(input.width);
    }
  }
  if (input.color !== void 0) {
    if (typeof input.color === "object") {
      const c = input.color;
      if (c.top !== void 0) style.borderTopColor = resolveColor(c.top);
      if (c.right !== void 0) style.borderRightColor = resolveColor(c.right);
      if (c.bottom !== void 0) style.borderBottomColor = resolveColor(c.bottom);
      if (c.left !== void 0) style.borderLeftColor = resolveColor(c.left);
      if (c.all !== void 0) style.borderColor = resolveColor(c.all);
    } else {
      style.borderColor = resolveColor(input.color);
    }
  }
  if (input.radius !== void 0) {
    if (typeof input.radius === "object") {
      const r = input.radius;
      if (r.topLeft !== void 0) style.borderTopLeftRadius = resolveRadiusValue(r.topLeft);
      if (r.topRight !== void 0) style.borderTopRightRadius = resolveRadiusValue(r.topRight);
      if (r.bottomLeft !== void 0) style.borderBottomLeftRadius = resolveRadiusValue(r.bottomLeft);
      if (r.bottomRight !== void 0) style.borderBottomRightRadius = resolveRadiusValue(r.bottomRight);
      if (r.all !== void 0) style.borderRadius = resolveRadiusValue(r.all);
    } else {
      style.borderRadius = resolveRadiusValue(input.radius);
    }
  }
  if (input.cornerShape !== void 0) style.cornerShape = input.cornerShape;
  return style;
}
const fontWeights = { normal: "400", medium: "500", semibold: "600", bold: "700" };
export function textStyle(input) {
  const style = {};
  if (input.size !== void 0) {
    style.fontSize = typeof input.size === "string" && input.size in fontSizes ? fontSizes[input.size] : resolveLength(input.size);
  }
  if (input.weight !== void 0) style.fontWeight = fontWeights[input.weight];
  if (input.color !== void 0) style.color = resolveColor(input.color);
  if (input.align !== void 0) style.textAlignment = input.align;
  if (input.family !== void 0) style.fontFamily = input.family;
  if (input.style !== void 0) style.fontStyle = input.style;
  if (input.decoration !== void 0) style.textDecoration = input.decoration;
  if (input.transform !== void 0) style.textTransform = input.transform;
  if (input.letterSpacing !== void 0) style.letterSpacing = input.letterSpacing;
  if (input.lineHeight !== void 0) style.lineHeight = resolveLength(input.lineHeight);
  if (input.whiteSpace !== void 0) style.whiteSpace = input.whiteSpace;
  if (input.overflow !== void 0) style.textOverflow = input.overflow;
  if (input.maxLines !== void 0) style.maxLines = input.maxLines;
  if (input.shadow !== void 0) style.textShadow = input.shadow;
  if (input.stroke !== void 0) style.textStroke = `${resolveLength(input.stroke.width)} ${resolveColor(input.stroke.color)}`;
  if (input.variationSettings !== void 0) style.fontVariationSettings = input.variationSettings;
  return style;
}
export function flex(input) {
  const style = {};
  if (input.direction !== void 0) style.flexDirection = input.direction;
  if (input.wrap !== void 0) style.flexWrap = input.wrap;
  if (input.justify !== void 0) style.justifyContent = input.justify;
  if (input.align !== void 0) style.alignItems = input.align;
  if (input.alignContent !== void 0) style.alignContent = input.alignContent;
  if (input.gap !== void 0) style.gap = resolveLength(input.gap);
  if (input.rowGap !== void 0) style.rowGap = resolveLength(input.rowGap);
  if (input.columnGap !== void 0) style.columnGap = resolveLength(input.columnGap);
  if (input.grow !== void 0) style.flexGrow = input.grow;
  if (input.shrink !== void 0) style.flexShrink = input.shrink;
  if (input.alignSelf !== void 0) style.alignSelf = input.alignSelf;
  if (input.order !== void 0) style.order = input.order;
  if (input.wrapBefore !== void 0) style.flexWrapBefore = input.wrapBefore;
  return style;
}
export function transform(input) {
  const style = {};
  if (input.rotate !== void 0) style.rotate = input.rotate;
  if (input.rotateX !== void 0) style.rotateX = input.rotateX;
  if (input.rotateY !== void 0) style.rotateY = input.rotateY;
  if (input.scaleX !== void 0) style.scaleX = input.scaleX;
  if (input.scaleY !== void 0) style.scaleY = input.scaleY;
  if (input.translateX !== void 0) style.translateX = resolveLength(input.translateX);
  if (input.translateY !== void 0) style.translateY = resolveLength(input.translateY);
  if (input.perspective !== void 0) style.perspective = input.perspective;
  return style;
}
export function align(input) {
  const style = {};
  if (input.horizontal !== void 0) style.horizontalAlignment = input.horizontal;
  if (input.vertical !== void 0) style.verticalAlignment = input.vertical;
  return style;
}
export function visible(value) {
  return { visibility: value };
}
export function zIndex(value) {
  return { zIndex: value };
}
export function elevation(value, dynamicOffset) {
  const style = { androidElevation: value };
  if (dynamicOffset !== void 0) style.androidDynamicElevationOffset = dynamicOffset;
  return style;
}
export function direction(value) {
  return { direction: value };
}
export function tintColor(color) {
  return { tintColor: resolveColor(color) };
}
export function placeholder(color) {
  return { placeholderColor: resolveColor(color) };
}
