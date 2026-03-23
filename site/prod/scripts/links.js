export function initLinks({ svgEl, canvas, state, onChange }) {
  // MVP этап Links будет следующим
  // Сейчас просто подготовим SVG слой к будущим линиям
  svgEl.setAttribute("width", "100%");
  svgEl.setAttribute("height", "100%");

  return {
    // позже: enterLinkMode(), renderLinks(), addLink(from,to)
  };
}
