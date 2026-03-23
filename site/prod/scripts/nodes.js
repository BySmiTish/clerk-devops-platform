function uid(prefix = "n") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

const DEFAULT_W = 280;
const DEFAULT_H = 180;
const MIN_W = 220;
const MIN_H = 120;

const RESIZE_HIT = 8;

const Z_BASE = 10;
const Z_ACTIVE = 50;
const Z_EXPANDED = 99999;

export function initNodes({ layerEl, canvas, state, onChange }) {
  let drag = null;
  let resize = null;
  let zCounter = 0;

  // --- overlay (outside transform world) ---
  const viewportEl = layerEl.closest("#canvasViewport");
  const overlayEl = ensureOverlayLayer(viewportEl);

  // Track expanded node (only one expanded at a time)
  let expanded = null; // { node, el, parent, nextSibling, contentEl, titleEl, toolbarEl, toggleEl }

  // Context menu (single)
  const menu = ensureContextMenu();

  // Global click outside expanded => close popup only (do NOT auto-exit edit)
  window.addEventListener("mousedown", (e) => {
    if (!expanded) return;
    if (!expanded.el.isConnected) { expanded = null; return; }
    if (expanded.el.contains(e.target)) return;

    closeLinkPopup(expanded);
  });

  function create({ x, y, type, color, text, title, width, height }) {
    const nodeType = type || "Linux";
    const node = {
      id: uid("node"),
      x, y,
      type: nodeType,
      color: color || "accent",
      title: title || `${nodeType} Note`,
      text: text || "",
      html: "",          // formatted content (for expanded editor)
      width: width ?? DEFAULT_W,
      height: height ?? DEFAULT_H,
      expanded: false,
      prevSize: null,
      prevPos: null,
      z: Z_BASE,
      links: {},         // linkId -> { note }
    };
    state.nodes.push(node);
    renderNode(node);
    onChange?.();
    return node;
  }

  function renderAll() {
    layerEl.innerHTML = "";
    for (const n of state.nodes) {
      if (typeof n.width !== "number") n.width = DEFAULT_W;
      if (typeof n.height !== "number") n.height = DEFAULT_H;
      if (!n.title) n.title = `${n.type || "Linux"} Note`;
      if (typeof n.expanded !== "boolean") n.expanded = false;
      if (!("prevSize" in n)) n.prevSize = null;
      if (!("prevPos" in n)) n.prevPos = null;
      if (typeof n.z !== "number") n.z = Z_BASE;
      if (typeof n.links !== "object" || !n.links) n.links = {};
      if (typeof n.html !== "string") n.html = "";
      renderNode(n);
    }
  }

  function removeNode(nodeId) {
    if (expanded?.node?.id === nodeId) {
      collapseExpanded(expanded);
    }

    const idx = state.nodes.findIndex(n => n.id === nodeId);
    if (idx === -1) return;
    state.nodes.splice(idx, 1);

    const el = document.querySelector(`[data-node-id="${nodeId}"]`);
    if (el) el.remove();

    onChange?.();
  }

  function duplicateNode(nodeId) {
    const src = state.nodes.find(n => n.id === nodeId);
    if (!src) return;

    const copy = structuredCloneSafe(src);
    copy.id = uid("node");
    copy.x = src.x + 24;
    copy.y = src.y + 24;
    copy.expanded = false;
    copy.prevSize = null;
    copy.prevPos = null;
    copy.z = Z_ACTIVE + (++zCounter);

    state.nodes.push(copy);
    renderNode(copy);
    onChange?.();
  }

  function bringToFront(node, el) {
    node.z = node.expanded ? Z_EXPANDED : (Z_ACTIVE + (++zCounter));
    el.style.zIndex = String(node.z);
  }

  function renderNode(node) {
    const el = document.createElement("div");
    el.className = "node";
    el.dataset.nodeId = node.id;

    applyNodeBox(el, node);
    el.style.zIndex = String(node.expanded ? Z_EXPANDED : (node.z || Z_BASE));
    el.classList.toggle("is-expanded", !!node.expanded);

    el.innerHTML = `
      <div class="node__header">
        <div class="node__titleWrap">
          <span class="node__dot"></span>
          <div class="node__title" contenteditable="false" spellcheck="false"></div>
        </div>

        <div class="node__toolbar" style="display:none;">
          <div class="tbtn" data-cmd="edit" title="Edit">✏️</div>
          <div class="tbtn" data-cmd="bold" title="Bold">B</div>
          <div class="tbtn" data-cmd="italic" title="Italic"><i>I</i></div>
          <div class="tbtn" data-cmd="underline" title="Underline"><u>U</u></div>
          <div class="tbtn" data-cmd="box" title="Red box">🟥</div>
          <div class="tbtn" data-cmd="link" title="Link note">🔗</div>
        </div>

        <span class="node__badge"></span>
      </div>

      <div class="node__content" contenteditable="false" spellcheck="false"></div>

      <div class="node__toggle" title="Expand/Collapse"></div>
    `;

    const titleEl = el.querySelector(".node__title");
    const contentEl = el.querySelector(".node__content");
    const toggleEl = el.querySelector(".node__toggle");
    const toolbarEl = el.querySelector(".node__toolbar");
    const badgeEl = el.querySelector(".node__badge");
    const dotEl = el.querySelector(".node__dot");

    dotEl.style.background = "var(--accent)";

    titleEl.textContent = node.title || `${node.type} Note`;
    badgeEl.textContent = node.type || "Linux";
    setToggleIcon(toggleEl, node.expanded);
    setToolbarVisible(toolbarEl, node.expanded);

    renderViewContent(contentEl, node);

    // Context menu
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      bringToFront(node, el);
      openMenuAt(e.clientX, e.clientY, [
        { label: "Delete note", action: () => removeNode(node.id) },
        { sep: true },
        { label: "Duplicate note", action: () => duplicateNode(node.id) },
      ]);
    });

    // Resize cursor (only not expanded)
    el.addEventListener("mousemove", (e) => {
      if (node.expanded) return;
      if (resize || drag) return;
      const dir = hitTestResizeDir(el, e.clientX, e.clientY);
      setResizeCursorClasses(el, dir);
    });
    el.addEventListener("mouseleave", () => {
      if (resize || drag) return;
      clearResizeCursorClasses(el);
    });

    // Drag/resize (only not expanded)
    el.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;

      closeMenu();
      bringToFront(node, el);

      if (e.target.closest(".node__toggle")) return;
      if (e.target.closest(".node__toolbar")) return;
      if (e.target.closest(".link-popup")) return;
      if (e.target.closest('[contenteditable="true"]')) return;

      if (!node.expanded) {
        const dir = hitTestResizeDir(el, e.clientX, e.clientY);
        if (dir) {
          resize = {
            node, el,
            dir,
            startMousePx: { x: e.clientX, y: e.clientY },
            startBox: { x: node.x, y: node.y, w: node.width, h: node.height },
          };
          e.stopPropagation();
          e.preventDefault();
          return;
        }

        const mouseWorld = canvas.screenToWorld(e.clientX, e.clientY);
        drag = {
          node, el,
          startMouseWorld: mouseWorld,
          startNode: { x: node.x, y: node.y },
        };
        e.stopPropagation();
      }
    });

    // Toggle expand/collapse
    toggleEl.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      if (!node.expanded) {
        expandNode(node, el, titleEl, contentEl, toolbarEl, toggleEl);
      } else {
        if (expanded?.node?.id === node.id) collapseExpanded(expanded);
      }
    });

    // Title edit only in expanded + editMode
    titleEl.addEventListener("dblclick", (e) => {
      if (!node.expanded) return;
      if (expanded?.node?.id !== node.id) return;
      if (!expanded.editMode) return;
      e.stopPropagation();
      titleEl.setAttribute("contenteditable", "true");
      titleEl.focus();
      placeCaretAtEnd(titleEl);
    });

    titleEl.addEventListener("blur", () => {
      if (titleEl.getAttribute("contenteditable") !== "true") return;
      titleEl.setAttribute("contenteditable", "false");
      node.title = (titleEl.textContent || "").trim() || `${node.type} Note`;
      titleEl.textContent = node.title;
      onChange?.();
    });

    // Content mousedown in expanded: do nothing (view mode)
    contentEl.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (!node.expanded) return;
      e.stopPropagation();
    });

    // Links click (view mode)
    contentEl.addEventListener("click", (e) => {
      if (!node.expanded) return;
      const link = e.target.closest(".note-link");
      if (!link) return;
      const linkId = link.dataset.linkId;
      if (!linkId) return;

      if (expanded?.node?.id !== node.id) return;
      openLinkPopup(expanded, linkId, link.textContent || "Link");
    });

    // Toolbar buttons
    toolbarEl.addEventListener("mousedown", (e) => {
      const btn = e.target.closest(".tbtn");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();

      if (!node.expanded) return;
      if (expanded?.node?.id !== node.id) return;

      const cmd = btn.dataset.cmd;

      // EDIT toggle only by ✏️
      if (cmd === "edit") {
        const editBtn = toolbarEl.querySelector('.tbtn[data-cmd="edit"]');

        if (!expanded.editMode) {
          enterEditMode(expanded);
          editBtn?.classList.add("is-active");
        } else {
          exitEditMode(expanded);
          closeLinkPopup(expanded);
          editBtn?.classList.remove("is-active");
        }
        return;
      }

      // other actions only in editMode
      if (!expanded.editMode) return;

      if (cmd === "bold" || cmd === "italic" || cmd === "underline") {
        document.execCommand(cmd);
        saveHtmlFromEditor(expanded);
        return;
      }

      if (cmd === "box") {
        insertHtmlAtSelection(`<span class="inner-box" contenteditable="true">Type here...</span><br>`);
        saveHtmlFromEditor(expanded);
        return;
      }

      if (cmd === "link") {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.toString().trim() === "") return;
        const label = sel.toString();
        const linkId = uid("lnk");
        openLinkPopup(expanded, linkId, label);
      }
    });

    layerEl.appendChild(el);

    // restore expanded state after reload
    if (node.expanded) {
      expandNode(node, el, titleEl, contentEl, toolbarEl, toggleEl, true);
    }
  }

  // Expand uses overlay
  function expandNode(node, el, titleEl, contentEl, toolbarEl, toggleEl, silent = false) {
    if (expanded && expanded.node.id !== node.id) {
      collapseExpanded(expanded);
    }

    node.prevSize = { w: node.width, h: node.height };
    node.prevPos = { x: node.x, y: node.y };

    node.expanded = true;
    el.classList.add("is-expanded");
    setToggleIcon(toggleEl, true);
    setToolbarVisible(toolbarEl, true);

    const parent = el.parentNode;
    const nextSibling = el.nextSibling;
    overlayEl.appendChild(el);

    el.style.left = ""; el.style.top = ""; el.style.width = ""; el.style.height = "";

    bringToFront(node, el);

    expanded = {
      node, el, parent, nextSibling,
      titleEl, contentEl, toolbarEl, toggleEl,
      popupEl: null,
      editMode: false,
      savedRange: null,
    };

    // edit always OFF when opening
    contentEl.setAttribute("contenteditable", "false");
    const editBtn = toolbarEl.querySelector('.tbtn[data-cmd="edit"]');
    editBtn?.classList.remove("is-active");

    renderViewContent(contentEl, node);

    if (!silent) onChange?.();
  }

  function collapseExpanded(ctx) {
    if (!ctx) return;

    if (ctx.editMode) exitEditMode(ctx);
    closeLinkPopup(ctx);

    const editBtn = ctx.toolbarEl?.querySelector('.tbtn[data-cmd="edit"]');
    editBtn?.classList.remove("is-active");

    const { node, el, parent, nextSibling, toggleEl, toolbarEl, contentEl } = ctx;

    node.expanded = false;
    el.classList.remove("is-expanded");
    setToggleIcon(toggleEl, false);
    setToolbarVisible(toolbarEl, false);

    if (nextSibling) parent.insertBefore(el, nextSibling);
    else parent.appendChild(el);

    const prevS = node.prevSize || { w: DEFAULT_W, h: DEFAULT_H };
    const prevP = node.prevPos || { x: node.x, y: node.y };
    node.width = prevS.w;
    node.height = prevS.h;
    node.x = prevP.x;
    node.y = prevP.y;
    node.prevSize = null;
    node.prevPos = null;

    applyNodeBox(el, node);
    el.style.zIndex = String(node.z || Z_BASE);

    renderViewContent(contentEl, node);

    expanded = null;
    onChange?.();
  }

  // Editor helpers
  function enterEditMode(ctx) {
    if (ctx.editMode) return;
    ctx.editMode = true;

    const { contentEl, node } = ctx;

    contentEl.setAttribute("contenteditable", "true");
    contentEl.innerHTML = storedHtmlToEditorHtml(node.html || "");
    if (!contentEl.innerHTML.trim()) contentEl.innerHTML = "<br>";

    focusEnd(contentEl);
  }

  function exitEditMode(ctx) {
    if (!ctx.editMode) return;
    ctx.editMode = false;

    const { contentEl, node } = ctx;
    saveHtmlFromEditor(ctx);

    contentEl.setAttribute("contenteditable", "false");
    renderViewContent(contentEl, node);
  }

  function saveHtmlFromEditor(ctx) {
    const { contentEl, node } = ctx;
    node.html = editorHtmlToStoredHtml(contentEl);
    node.text = (contentEl.innerText || "").replace(/\u00A0/g, " ");
    onChange?.();
  }

  // Link popup (per expanded node)
  function openLinkPopup(ctx, linkId, label) {
    // save current selection range BEFORE textarea steals focus
    const sel = window.getSelection();
    ctx.savedRange = (sel && sel.rangeCount) ? sel.getRangeAt(0).cloneRange() : null;

    closeLinkPopup(ctx);

    const popupEl = document.createElement("div");
    popupEl.className = "link-popup";
    popupEl.innerHTML = `
      <div class="link-popup__head">
        <div>Link note</div>
        <div class="link-popup__ok" title="Save">✓</div>
      </div>
      <textarea class="link-popup__input" placeholder="Write a note for this link..."></textarea>
    `;
    ctx.el.appendChild(popupEl);
    ctx.popupEl = popupEl;

    const input = popupEl.querySelector(".link-popup__input");
    const ok = popupEl.querySelector(".link-popup__ok");

    input.value = ctx.node.links?.[linkId]?.note || "";
    input.focus();

    ok.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();

      ctx.node.links[linkId] = { note: input.value || "" };

      // restore selection and insert link marker
      restoreSavedRange(ctx);
      insertLinkMarkerAtSelection(ctx.contentEl, linkId, label);
      ctx.savedRange = null;

      closeLinkPopup(ctx);
      saveHtmlFromEditor(ctx);
    });
  }

  function closeLinkPopup(ctx) {
    if (!ctx?.popupEl) return;
    ctx.popupEl.remove();
    ctx.popupEl = null;
  }

  // Global mouse move (drag/resize)
  window.addEventListener("mousemove", (e) => {
    if (resize) {
      const dxPx = e.clientX - resize.startMousePx.x;
      const dyPx = e.clientY - resize.startMousePx.y;
      const z = canvas.getState().zoom;

      let x = resize.startBox.x;
      let y = resize.startBox.y;
      let w = resize.startBox.w;
      let h = resize.startBox.h;

      const dxW = dxPx / z;
      const dyW = dyPx / z;

      if (resize.dir.includes("e")) w = Math.max(MIN_W, Math.round(resize.startBox.w + dxW));
      if (resize.dir.includes("s")) h = Math.max(MIN_H, Math.round(resize.startBox.h + dyW));
      if (resize.dir.includes("w")) {
        const newW = Math.max(MIN_W, Math.round(resize.startBox.w - dxW));
        x = Math.round(resize.startBox.x + (resize.startBox.w - newW));
        w = newW;
      }
      if (resize.dir.includes("n")) {
        const newH = Math.max(MIN_H, Math.round(resize.startBox.h - dyW));
        y = Math.round(resize.startBox.y + (resize.startBox.h - newH));
        h = newH;
      }

      resize.node.x = x;
      resize.node.y = y;
      resize.node.width = w;
      resize.node.height = h;

      applyNodeBox(resize.el, resize.node);
      onChange?.();
      return;
    }

    if (!drag) return;

    const mw = canvas.screenToWorld(e.clientX, e.clientY);
    const dx = mw.x - drag.startMouseWorld.x;
    const dy = mw.y - drag.startMouseWorld.y;

    drag.node.x = Math.round(drag.startNode.x + dx);
    drag.node.y = Math.round(drag.startNode.y + dy);

    drag.el.style.left = `${drag.node.x}px`;
    drag.el.style.top = `${drag.node.y}px`;

    onChange?.();
  });

  window.addEventListener("mouseup", () => {
    if (resize) {
      clearResizeCursorClasses(resize.el);
      resize = null;
      onChange?.();
      return;
    }
    if (drag) {
      drag = null;
      onChange?.();
    }
  });

  // Close context menu outside
  window.addEventListener("mousedown", (e) => {
    if (!menu.el) return;
    if (menu.el.style.display !== "block") return;
    if (e.target.closest(".context-menu")) return;
    closeMenu();
  });

  function openMenuAt(x, y, items) {
    menu.el.innerHTML = "";
    for (const it of items) {
      if (it.sep) {
        const sep = document.createElement("div");
        sep.className = "context-menu__sep";
        menu.el.appendChild(sep);
        continue;
      }
      const row = document.createElement("div");
      row.className = "context-menu__item";
      row.textContent = it.label;
      row.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
        it.action?.();
      });
      menu.el.appendChild(row);
    }

    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    menu.el.style.display = "block";
    menu.el.style.left = "0px";
    menu.el.style.top = "0px";

    const rect = menu.el.getBoundingClientRect();
    const nx = clamp(x, pad, vw - rect.width - pad);
    const ny = clamp(y, pad, vh - rect.height - pad);

    menu.el.style.left = `${nx}px`;
    menu.el.style.top = `${ny}px`;
  }

  function closeMenu() {
    if (menu.el) menu.el.style.display = "none";
  }

  return { create, renderAll };
}

/* ---------- View mode rendering ---------- */
function renderViewContent(el, node) {
  const hasHtml = (node.html || "").trim().length > 0;

  if (!hasHtml) {
    const t = (node.text ?? "").toString();
    if (!t.trim()) { el.innerHTML = "<br>"; return; }
    let html = escapeHtml(t);
    html = html.replace(/\[(.+?)\]/g, (m) => `<span class="bracket-code">${m}</span>`);
    el.innerHTML = html.replace(/\n/g, "<br>");
    return;
  }

  let html = node.html;

  html = html.replace(/\[\[link:([^\|\]]+)\|([^\]]+)\]\]/g, (_, id, label) => {
    return `<span class="note-link" data-link-id="${escapeHtml(id)}">${escapeHtml(label)}</span>`;
  });

  html = html.replace(/\[(.+?)\]/g, (m) => `<span class="bracket-code">${m}</span>`);

  el.innerHTML = html || "<br>";
}

/* ---------- Editor HTML storage ---------- */
function editorHtmlToStoredHtml(contentEl) {
  const clone = contentEl.cloneNode(true);

  // convert link spans to markers
  clone.querySelectorAll("span[data-link-id]").forEach((sp) => {
    const id = sp.getAttribute("data-link-id");
    const label = sp.textContent || "Link";
    sp.replaceWith(document.createTextNode(`[[link:${id}|${label}]]`));
  });

  sanitizeNode(clone);

  // normalize blocks to <br> so lines don't collapse into one
  clone.querySelectorAll("div, p").forEach((blk) => {
    // ensure end-of-block break
    blk.insertAdjacentHTML("beforeend", "<br>");
    blk.replaceWith(...blk.childNodes);
  });

  return clone.innerHTML;
}

function sanitizeNode(root) {
  // Allow DIV/P because browsers often create them on Enter
  const allowed = new Set(["B","I","U","BR","#text","SPAN","DIV","P"]);

  const all = Array.from(root.querySelectorAll("*"));
  for (const el of all) {
    if (!allowed.has(el.tagName)) {
      const parent = el.parentNode;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    }
  }
}

function storedHtmlToEditorHtml(storedHtml) {
  let html = storedHtml || "";
  html = html.replace(/\[\[link:([^\|\]]+)\|([^\]]+)\]\]/g, (_, id, label) => {
    return `<span data-link-id="${escapeHtml(id)}" style="color:#60a5fa;text-decoration:underline;cursor:pointer;">${escapeHtml(label)}</span>`;
  });
  return html;
}

function restoreSavedRange(ctx) {
  if (!ctx.savedRange) return;
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(ctx.savedRange);
}

function insertLinkMarkerAtSelection(contentEl, linkId, label) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();

  const span = document.createElement("span");
  span.setAttribute("data-link-id", linkId);
  span.textContent = label;
  span.style.color = "#60a5fa";
  span.style.textDecoration = "underline";
  span.style.cursor = "pointer";

  range.insertNode(span);
  range.setStartAfter(span);
  range.collapse(true);

  sel.removeAllRanges();
  sel.addRange(range);
}

function insertHtmlAtSelection(html) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();

  const temp = document.createElement("div");
  temp.innerHTML = html;

  const frag = document.createDocumentFragment();
  while (temp.firstChild) frag.appendChild(temp.firstChild);

  range.insertNode(frag);
  range.collapse(false);
}

/* ---------- Resize hit-test ---------- */
function hitTestResizeDir(el, clientX, clientY) {
  const r = el.getBoundingClientRect();
  const nearL = Math.abs(clientX - r.left) <= RESIZE_HIT;
  const nearR = Math.abs(r.right - clientX) <= RESIZE_HIT;
  const nearT = Math.abs(clientY - r.top) <= RESIZE_HIT;
  const nearB = Math.abs(r.bottom - clientY) <= RESIZE_HIT;

  const isOnEdge = nearL || nearR || nearT || nearB;
  if (!isOnEdge) return "";

  if (nearT && nearL) return "nw";
  if (nearT && nearR) return "ne";
  if (nearB && nearL) return "sw";
  if (nearB && nearR) return "se";
  if (nearT) return "n";
  if (nearB) return "s";
  if (nearL) return "w";
  if (nearR) return "e";
  return "";
}

function setResizeCursorClasses(el, dir) {
  clearResizeCursorClasses(el);
  if (!dir) return;
  el.classList.add(`is-resize-${dir}`);
}

function clearResizeCursorClasses(el) {
  el.classList.remove(
    "is-resize-n","is-resize-s","is-resize-e","is-resize-w",
    "is-resize-ne","is-resize-nw","is-resize-se","is-resize-sw"
  );
}

function applyNodeBox(el, node) {
  el.style.left = `${node.x}px`;
  el.style.top = `${node.y}px`;
  el.style.width = `${node.width}px`;
  el.style.height = `${node.height}px`;
}

function ensureOverlayLayer(viewportEl) {
  let el = viewportEl.querySelector("#overlayLayer");
  if (!el) {
    el = document.createElement("div");
    el.id = "overlayLayer";
    el.className = "overlay-layer";
    viewportEl.appendChild(el);
  }
  return el;
}

function ensureContextMenu() {
  let el = document.getElementById("contextMenu");
  if (!el) {
    el = document.createElement("div");
    el.id = "contextMenu";
    el.className = "context-menu";
    el.style.display = "none";
    document.body.appendChild(el);
  }
  return { el };
}

function setToggleIcon(el, expanded) {
  el.textContent = expanded ? "−" : "+";
}

function setToolbarVisible(toolbarEl, on) {
  toolbarEl.style.display = on ? "flex" : "none";
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function structuredCloneSafe(obj) {
  if (typeof structuredClone === "function") return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function placeCaretAtEnd(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function focusEnd(el) {
  el.focus();
  requestAnimationFrame(() => placeCaretAtEnd(el));
}










