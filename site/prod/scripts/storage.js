const KEY = "learning_canvas_state_v1";

function safeJsonParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

export const storage = {
  load() {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return safeJsonParse(raw);
  },
  save(state) {
    // минимальная защита от случайных circular
    const data = {
      canvas: state.canvas,
      nodes: state.nodes,
      links: state.links,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
  },
  clear() {
    localStorage.removeItem(KEY);
  },
};
