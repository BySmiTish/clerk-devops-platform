export function createCanvasController({ viewportEl, worldEl, initial, onChange }) {
  let x = initial?.x ?? 0;
  let y = initial?.y ?? 0;
  let zoom = initial?.zoom ?? 1;

  let isPanning = false;
  let panStart = { sx: 0, sy: 0, x: 0, y: 0 };
  let spaceDown = false;

  const ZOOM_MIN = 0.35;
  const ZOOM_MAX = 2.6;

  function isEditableActive() {
    const el = document.activeElement;
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName?.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select";
  }

  function applyTransform() {
    worldEl.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${zoom})`;
  }

  function setTransform(nx, ny, nz) {
    x = nx; y = ny; zoom = nz;
    applyTransform();
    onChange?.({ x, y, zoom });
  }

  function setPosition(nx, ny) {
    setTransform(nx, ny, zoom);
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function screenToWorld(clientX, clientY) {
    const rect = viewportEl.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      x: (sx - x) / zoom,
      y: (sy - y) / zoom,
      sx, sy,
    };
  }

  function getViewportRect() {
    // размеры viewport в пикселях
    const r = viewportEl.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }

  function getViewportTopLeftWorld() {
    // world координаты левого верхнего угла viewport
    const r = viewportEl.getBoundingClientRect();
    const p = screenToWorld(r.left, r.top);
    return { x: p.x, y: p.y };
  }

  function getViewportCenterWorld() {
    const r = viewportEl.getBoundingClientRect();
    const p = screenToWorld(r.left + r.width / 2, r.top + r.height / 2);
    return { x: p.x, y: p.y };
  }

  function zoomAt(clientX, clientY, deltaY) {
    if (isEditableActive()) return;
    const p = screenToWorld(clientX, clientY);
    const factor = Math.exp(-deltaY * 0.0012);
    const newZoom = clamp(zoom * factor, ZOOM_MIN, ZOOM_MAX);

    const newX = p.sx - p.x * newZoom;
    const newY = p.sy - p.y * newZoom;

    setTransform(Math.round(newX), Math.round(newY), newZoom);
  }

  function canStartPan(e) {
    if (isEditableActive()) return false;

    const isMiddle = e.button === 1;
    const isSpaceLeft = (e.button === 0 && spaceDown);

    // ЛКМ по пустому полю (не по нодам) — тоже пан
    const isLeftOnEmpty =
      e.button === 0 &&
      !spaceDown &&
      !e.target.closest(".node") &&
      e.target.closest("#canvasViewport");

    return isMiddle || isSpaceLeft || isLeftOnEmpty;
  }

  viewportEl.addEventListener("mousedown", (e) => {
    if (!canStartPan(e)) return;

    isPanning = true;
    panStart = { sx: e.clientX, sy: e.clientY, x, y };
    viewportEl.classList.add("is-panning");
    e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if (!isPanning) return;
    const dx = e.clientX - panStart.sx;
    const dy = e.clientY - panStart.sy;
    setPosition(panStart.x + dx, panStart.y + dy);
  });

  window.addEventListener("mouseup", () => {
    if (!isPanning) return;
    isPanning = false;
    viewportEl.classList.remove("is-panning");
  });

  window.addEventListener("keydown", (e) => {
    if (e.code !== "Space") return;
    if (isEditableActive()) return;
    spaceDown = true;
    e.preventDefault();
  }, { passive: false });

  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") spaceDown = false;
  });

  viewportEl.addEventListener("wheel", (e) => {
    if (isEditableActive()) return;
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, e.deltaY);
  }, { passive: false });

  viewportEl.addEventListener("auxclick", (e) => {
    if (e.button === 1) e.preventDefault();
  });

  applyTransform();

  return {
    getState: () => ({ x, y, zoom }),
    setPosition,
    setZoom: (z) => setTransform(x, y, clamp(z, ZOOM_MIN, ZOOM_MAX)),
    screenToWorld: (cx, cy) => {
      const p = screenToWorld(cx, cy);
      return { x: p.x, y: p.y };
    },
    getViewportCenterWorld,
    getViewportRect,
    getViewportTopLeftWorld,
  };
}


