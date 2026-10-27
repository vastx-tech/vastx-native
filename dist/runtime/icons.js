import { getIconData, iconToSVG } from "@iconify/utils";
export function resolveIconSvg(iconSet, name, options = {}) {
  let cached = cache.get(iconSet);
  if (!cached) cache.set(iconSet, cached = /* @__PURE__ */ new Map());
  const key = `${name}|${options.color ?? ""}|${options.width ?? ""}|${options.height ?? ""}`;
  const hit = cached.get(key);
  if (hit) return hit;
  const svg = buildIconSvg(iconSet, name, options);
  cached.set(key, svg);
  return svg;
}
const cache = /* @__PURE__ */ new WeakMap();
function buildIconSvg(iconSet, name, options) {
  const iconData = getIconData(iconSet, name);
  if (!iconData) {
    throw new Error(`[vastx-native] Icon "${name}" was not found in the given icon set.`);
  }
  const size = {};
  if (options.width !== void 0) size.width = options.width;
  if (options.height !== void 0) size.height = options.height;
  if (options.width === void 0 && options.height === void 0) size.width = size.height = "auto";
  const { attributes, body } = iconToSVG(iconData, size);
  const resolvedBody = options.color ? body.replace(/currentColor/g, options.color) : body;
  const attrString = Object.entries(attributes).filter(([, value]) => value !== void 0).map(([key, value]) => `${key}="${value}"`).join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" ${attrString}>${resolvedBody}</svg>`;
}
