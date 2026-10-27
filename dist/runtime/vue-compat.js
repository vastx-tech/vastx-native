export * from "nativescript-vue";
function toNumber(value) {
  const n = value === "" ? NaN : Number(value);
  return Number.isNaN(n) ? value : n;
}
function getModelAssigner(vnode) {
  const fn = vnode.props?.["onUpdate:modelValue"];
  return Array.isArray(fn) ? (value) => fn.forEach((f) => f(value)) : fn;
}
export const vModelText = {
  created(el, { value, modifiers: { trim, number } = {} }, vnode) {
    el._assign = getModelAssigner(vnode);
    el.text = value == null ? "" : String(value);
    const handler = () => {
      let next = el.text ?? "";
      if (trim) next = next.trim();
      if (number) next = toNumber(next);
      el._assign(next);
    };
    el.addEventListener("textChange", handler);
    el._vModelHandler = handler;
  },
  beforeUpdate(el, { value, oldValue }, vnode) {
    el._assign = getModelAssigner(vnode);
    const next = value == null ? "" : String(value);
    if (value !== oldValue && el.text !== next) {
      el.text = next;
    }
  },
  beforeUnmount(el) {
    if (el._vModelHandler) el.removeEventListener("textChange", el._vModelHandler);
  }
};
export const vModelCheckbox = {
  created(el, { value }, vnode) {
    el._assign = getModelAssigner(vnode);
    el.setAttribute("checked", !!value);
    const handler = () => el._assign(!!el.getAttribute("checked"));
    el.addEventListener("checkedChange", handler);
    el._vModelHandler = handler;
  },
  beforeUpdate(el, { value, oldValue }, vnode) {
    el._assign = getModelAssigner(vnode);
    if (value !== oldValue && !!el.getAttribute("checked") !== !!value) {
      el.setAttribute("checked", !!value);
    }
  },
  beforeUnmount(el) {
    if (el._vModelHandler) el.removeEventListener("checkedChange", el._vModelHandler);
  }
};
export const vModelDynamic = {
  created(el, binding, vnode, previousVnode) {
    pickDynamic(el).created?.(el, binding, vnode, previousVnode);
  },
  beforeUpdate(el, binding, vnode, previousVnode) {
    pickDynamic(el).beforeUpdate?.(el, binding, vnode, previousVnode);
  },
  beforeUnmount(el, binding, vnode, previousVnode) {
    pickDynamic(el).beforeUnmount?.(el, binding, vnode, previousVnode);
  }
};
function pickDynamic(el) {
  if (el.tagName === "Switch") return vModelCheckbox;
  if (el.tagName === "TextField" || el.tagName === "TextView") return vModelText;
  throw new Error(
    `[vastx-native] v-model has no native binding for <${el.tagName}>. Use one of this project's N* form components (e.g. NInput, NSwitch) instead, or bind the element's own property/event pair directly.`
  );
}
export const vModelRadio = {
  created(el) {
    throw new Error(
      `[vastx-native] v-model="..." radio" has no native equivalent for <${el.tagName}>. Build a radio group from NSwitch/button components with explicit state instead.`
    );
  }
};
export const vModelSelect = {
  created(el) {
    throw new Error(
      `[vastx-native] v-model.select has no native equivalent for <${el.tagName}>. Use a native ListPicker-backed component with explicit selectedIndex/change handling instead.`
    );
  }
};
