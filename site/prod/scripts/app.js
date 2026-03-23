import { createCanvasController } from "./canvas.js";
import { initNodes } from "./nodes.js";
import { initLinks } from "./links.js";
import { storage } from "./storage.js";

const els = {
  viewport: document.getElementById("canvasViewport"),
  world: document.getElementById("canvasWorld"),
  nodesLayer: document.getElementById("nodesLayer"),
  linksLayer: document.getElementById("linksLayer"),

  btnAddNode: document.getElementById("btnAddNode"),
  btnLinkMode: document.getElementById("btnLinkMode"),
  btnResetView: document.getElementById("btnResetView"),
};

const state = storage.load() ?? {
  canvas: { x: 0, y: 0, zoom: 1 },
  nodes: [],
  links: [],
};

const canvas = createCanvasController({
  viewportEl: els.viewport,
  worldEl: els.world,
  initial: state.canvas,
  onChange: (nextCanvas) => {
    state.canvas = nextCanvas;
    storage.save(state);
  },
});

const nodes = initNodes({
  layerEl: els.nodesLayer,
  canvas,
  state,
  onChange: () => storage.save(state),
});

const links = initLinks({
  svgEl: els.linksLayer,
  canvas,
  state,
  onChange: () => storage.save(state),
});

els.btnAddNode.addEventListener("click", () => {
  // создадим ноду по центру текущего вида
  const p = canvas.getViewportCenterWorld();
  nodes.create({ x: p.x, y: p.y, type: "Linux", color: "accent", text: "Новая заметка\n- команда\n- пояснение" });
});

els.btnLinkMode.addEventListener("click", () => {
  const pressed = els.btnLinkMode.getAttribute("aria-pressed") === "true";
  els.btnLinkMode.setAttribute("aria-pressed", String(!pressed));
  // пока просто переключатель — логика будет на этапе Links
});

els.btnResetView.addEventListener("click", () => {
  canvas.setPosition(0, 0);
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    els.btnLinkMode.setAttribute("aria-pressed", "false");
  }
});

// старт: применяем сохранённую позицию
canvas.setPosition(state.canvas.x, state.canvas.y);
nodes.renderAll();

// на старте — если пусто, покажем одну ноду
if (state.nodes.length === 0) {
  const p = canvas.getViewportCenterWorld();
  nodes.create({
    x: p.x - 120,
    y: p.y - 60,
    type: "Linux",
    color: "accent",
    text: "Добро пожаловать 👋\n\n• Space + Drag — двигать поле\n• Middle Drag — тоже\n• Кнопка Node — добавить блок",
  });
}
