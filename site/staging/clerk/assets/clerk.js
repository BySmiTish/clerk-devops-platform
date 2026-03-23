const $ = (id) => document.getElementById(id);

const API_BASE = location.pathname.startsWith("/staging/") ? "/staging/api" : "/api";
const GAME_ID = new URLSearchParams(location.search).get("game_id") || "cycle-12";
const COMMENTS_PAGE_SIZE = 5;

function getAuthorName() {
  return localStorage.getItem("clerk_author_name") || "";
}

function setAuthorName(name) {
  if (name && name.trim()) localStorage.setItem("clerk_author_name", name.trim());
}

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const sec = Math.floor((Date.now() - d) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} hours ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)} days ago`;
  return d.toLocaleDateString();
}

function isAdminMode() {
  return /\?.*admin=1/.test(window.location.search) || window.location.search === "?admin=1" ||
    localStorage.getItem("clerk_admin") === "1";
}

function getAdminToken() {
  return localStorage.getItem("clerk_admin_token") || "";
}

function showErr(el, msg) {
  el.style.display = "block";
  el.textContent = msg;
}
function hideErr(el) {
  el.style.display = "none";
  el.textContent = "";
}

function showToast(msg, duration = 4000) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("toast--show");
  clearTimeout(el._toastT);
  el._toastT = setTimeout(() => {
    el.classList.remove("toast--show");
  }, duration);
}

const FETCH_OPTS = { cache: "no-store", credentials: "include" };

async function fetchJson(url, opts = {}) {
  const r = await fetch(url, { ...FETCH_OPTS, ...opts });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** Fetch total comments count (root + replies) from backend */
async function loadCommentsCount() {
  try {
    const data = await fetchJson(`${API_BASE}/game/${GAME_ID}/comments/count`);
    const total = data.total ?? 0;
    const el = $("commentsCount");
    if (el) el.textContent = `(${total})`;
  } catch {
    const el = $("commentsCount");
    if (el) el.textContent = "(?)";
  }
}

/** Normalize comments API response to { items } — tolerate array, { items }, { comments } */
function normalizeCommentsResponse(response) {
  if (Array.isArray(response)) return { items: response };
  if (response && Array.isArray(response.items)) return { items: response.items };
  if (response && Array.isArray(response.comments)) return { items: response.comments };
  throw new Error("Unexpected response shape: expected array or { items } or { comments }");
}

// ---- Reactions ----
let reactionsData = { likes: 0, dislikes: 0, score: 0, my_reaction: null };

async function loadReactions() {
  try {
    const url = `${API_BASE}/game/${GAME_ID}/reactions`;
    const data = await fetchJson(url);
    reactionsData = {
      likes: data.likes ?? 0,
      dislikes: data.dislikes ?? 0,
      score: data.score ?? 0,
      my_reaction: data.my_reaction ?? null,
    };
    updateReactionsUI();
  } catch {
    $("likesCount").textContent = "?";
    $("dislikesCount").textContent = "?";
  }
}

function updateReactionsUI() {
  $("likesCount").textContent = reactionsData.likes;
  $("dislikesCount").textContent = reactionsData.dislikes;

  const likeBtn = $("btnLike");
  const dislikeBtn = $("btnDislike");
  likeBtn.classList.remove("is-liked", "is-disliked");
  dislikeBtn.classList.remove("is-liked", "is-disliked");
  if (reactionsData.my_reaction === 1) likeBtn.classList.add("is-liked");
  else if (reactionsData.my_reaction === -1) dislikeBtn.classList.add("is-disliked");
}

const COMMENTS_OPEN_KEY = "clerk_comments_open";
const REPLIES_OPEN_KEY_PREFIX = "clerk_replies_open";

function getRepliesOpenKey(rootId) {
  return `${REPLIES_OPEN_KEY_PREFIX}:${GAME_ID}:${rootId}`;
}
function getRepliesOpen(rootId) {
  try {
    return localStorage.getItem(getRepliesOpenKey(rootId));
  } catch (_) { return null; }
}
function setRepliesOpen(rootId, isOpen) {
  try {
    localStorage.setItem(getRepliesOpenKey(rootId), isOpen ? "1" : "0");
  } catch (_) {}
}

/** Handle 429: show toast + disable contextEl for retry_after seconds. Returns true if 429. onRestore called when re-enabled. */
function handleRateLimit(status, data, contextEl, onRestore) {
  if (status !== 429) return false;
  const sec = data?.retry_after ?? 60;
  showToast(`Too many requests. Try again in ${sec} seconds.`, Math.min(6000, sec * 1000));
  if (contextEl) disableForSeconds(contextEl, sec, onRestore);
  return true;
}

/** Disable element for n seconds, show "Try again in Ns" on buttons, then restore. Optional onRestore callback when re-enabled. */
function disableForSeconds(el, n, onRestore) {
  if (!el) return;
  const origDisabled = el.disabled;
  const origText = el.textContent;
  el.disabled = true;
  let remaining = n;
  el.textContent = remaining > 0 ? `Try again in ${remaining}s` : origText;
  const t = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(t);
      onRestore?.();
      el.disabled = origDisabled;
      el.textContent = origText;
      return;
    }
    if (el.textContent?.includes("Try again")) el.textContent = `Try again in ${remaining}s`;
  }, 1000);
}

function toggleCommentsPanel() {
  const panel = $("commentsPanel");
  const btn = $("commentsTitleBtn");
  const bodyWrap = $("commentsBodyWrap");
  if (!panel || !btn || !bodyWrap) return;
  const isOpen = panel.classList.toggle("is-open");
  btn.setAttribute("aria-expanded", String(isOpen));
  try {
    localStorage.setItem(COMMENTS_OPEN_KEY, isOpen ? "1" : "0");
  } catch (_) {}
}

function initCommentsPanelState() {
  const panel = $("commentsPanel");
  const btn = $("commentsTitleBtn");
  try {
    const saved = localStorage.getItem(COMMENTS_OPEN_KEY);
    const isOpen = saved !== "0";
    if (panel) panel.classList.toggle("is-open", isOpen);
    if (btn) btn.setAttribute("aria-expanded", String(isOpen));
  } catch (_) {}
}

const REACTION_DEBOUNCE_MS = 400;

async function setReaction(reaction) {
  const likeBtn = $("btnLike");
  const dislikeBtn = $("btnDislike");
  const targetBtn = reaction === 1 ? likeBtn : dislikeBtn;
  if (targetBtn.disabled) return;
  targetBtn.disabled = true;
  const reenable = () => {
    setTimeout(() => { targetBtn.disabled = false; }, REACTION_DEBOUNCE_MS);
  };

  const prev = { ...reactionsData };
  const isToggleOff = reactionsData.my_reaction === reaction;
  let rateLimited = false;

  if (isToggleOff) {
    reactionsData.my_reaction = null;
    reactionsData.likes -= reaction === 1 ? 1 : 0;
    reactionsData.dislikes -= reaction === -1 ? 1 : 0;
    reactionsData.score = reactionsData.likes - reactionsData.dislikes;
  } else {
    const prevLike = reactionsData.my_reaction === 1 ? 1 : 0;
    const prevDislike = reactionsData.my_reaction === -1 ? 1 : 0;
    reactionsData.my_reaction = reaction;
    reactionsData.likes = reactionsData.likes - prevLike + (reaction === 1 ? 1 : 0);
    reactionsData.dislikes = reactionsData.dislikes - prevDislike + (reaction === -1 ? 1 : 0);
    reactionsData.score = reactionsData.likes - reactionsData.dislikes;
  }
  updateReactionsUI();

  try {
    let r;
    if (isToggleOff) {
      r = await fetch(`${API_BASE}/game/${GAME_ID}/reaction`, { method: "DELETE", ...FETCH_OPTS });
    } else {
      r = await fetch(`${API_BASE}/game/${GAME_ID}/reaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction }),
        ...FETCH_OPTS,
      });
    }
    const data = await r.json().catch(() => ({}));
    if (handleRateLimit(r.status, data, targetBtn)) { rateLimited = true; throw new Error("rate limited"); }
    if (!r.ok) throw new Error(data.detail || `HTTP ${r.status}`);
  } catch (e) {
    reactionsData = prev;
    updateReactionsUI();
  } finally {
    if (!rateLimited) reenable();
  }
}

// ---- Comments ----
let commentsOffset = 0;
let commentsData = [];
/** Map rootId -> { items } for replies */
let repliesCache = {};
/** IDs of comments deleted in this session — never re-render */
const deletedIds = new Set();

const REPLIES_PAGE_SIZE = 5;

async function loadComments(opts = {}) {
  const reset = opts.reset !== false && (opts.reset === true || commentsOffset === 0);
  if (reset) {
    commentsOffset = 0;
    commentsData = [];
    repliesCache = {};
  }

  const listEl = $("commentsList");
  const loadingEl = $("commentsLoading");
  const errEl = $("commentsErr");
  const loadMoreBtn = $("btnLoadMore");

  hideErr(errEl);
  if (reset) listEl.innerHTML = "";
  loadingEl.style.display = "block";
  loadMoreBtn.style.display = "none";

  try {
    const url = `${API_BASE}/game/${GAME_ID}/comments?limit=${COMMENTS_PAGE_SIZE}&offset=${commentsOffset}`;
    const data = await fetchJson(url);
    const { items: rawItems } = normalizeCommentsResponse(data);
    const items = rawItems || [];
    commentsData = commentsData.concat(items);

    if (reset) listEl.innerHTML = "";

    const roots = commentsData.filter((c) => !c.parent_id && !deletedIds.has(c.id) && !c.is_deleted);
    roots.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    roots.forEach((root) => {
      listEl.appendChild(renderRootCommentCard(root));
    });

    for (const root of roots) {
      const rootId = String(root.id);
      const repliesCount = root.replies_count ?? 0;
      if (repliesCount > 0 && getRepliesOpen(rootId) === "1") {
        toggleReplies(rootId, { userInitiated: false, forceOpen: true });
      }
    }

    await loadCommentsCount();

    if (items.length >= COMMENTS_PAGE_SIZE) {
      commentsOffset += COMMENTS_PAGE_SIZE;
      loadMoreBtn.style.display = "inline-flex";
    } else {
      loadMoreBtn.style.display = "none";
    }
  } catch (e) {
    showErr(errEl, `Failed to load comments: ${e.message}`);
    if (reset) listEl.innerHTML = '<p class="muted">Could not load comments.</p>';
  } finally {
    loadingEl.style.display = "none";
  }
}

async function loadReplies(rootId, offset = 0, append = false, limitOverride) {
  const limit = limitOverride ?? REPLIES_PAGE_SIZE;
  const gameId = GAME_ID || "cycle-12";
  const url = `${API_BASE}/game/${gameId}/comments?parent_id=${rootId}&limit=${limit}&offset=${offset}`;
  const r = await fetch(url, FETCH_OPTS);
  const text = await r.text();
  const textSnippet = (text || "").slice(0, 200);
  let data = null;
  if (r.ok) {
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = null;
    }
  }
  if (!r.ok || !data) {
    const err = new Error(`loadReplies failed: HTTP ${r.status}`);
    err.rootId = rootId;
    err.url = url;
    err.status = r.status;
    err.textSnippet = textSnippet;
    throw err;
  }
  const { items: rawItems } = normalizeCommentsResponse(data);
  const items = (rawItems || []).filter((c) => !deletedIds.has(c.id) && !c.is_deleted);
  if (!repliesCache[rootId]) repliesCache[rootId] = { items: [] };
  const cache = repliesCache[rootId];
  if (append) {
    cache.items = cache.items.concat(items).filter((c) => !deletedIds.has(c.id) && !c.is_deleted);
  } else {
    cache.items = items;
  }
  return { items, hasMore: (rawItems || []).length >= limit, nextOffset: offset + (rawItems || []).length };
}

/** Deterministic color index from name (0–7) for avatar */
function avatarColorIndex(name) {
  if (!name || typeof name !== "string") return 0;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h) + name.charCodeAt(i) | 0;
  return Math.abs(h) % 8;
}

const THUMB_UP_SVG = '<svg class="icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 11v10"/><path d="M8 21H6.6c-.9 0-1.6-.7-1.6-1.6v-6.8C5 11.7 5.7 11 6.6 11H8"/><path d="M8 21h9.5c1.3 0 2.4-.9 2.7-2.2l1.2-6.2c.3-1.6-.9-3-2.5-3H14.5c.2-1.4.4-3.4.4-4.4 0-1.4-1.1-2.6-2.6-2.6h-.3l-2.6 5.3c-.4.8-.6 1.6-.6 2.5V11"/></svg>';
const THUMB_DOWN_SVG = '<svg class="icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 13V3"/><path d="M8 3H6.6C5.7 3 5 3.7 5 4.6v6.8C5 12.3 5.7 13 6.6 13H8"/><path d="M8 3h9.5c1.3 0 2.4.9 2.7 2.2l1.2 6.2c.3 1.6-.9 3-2.5 3H14.5c.2 1.4.4 3.4.4 4.4 0 1.4-1.1 2.6-2.6 2.6h-.3l-2.6-5.3c-.4-.8-.6-1.6-.6-2.5V13"/></svg>';

function renderReactionsBlock(c) {
  const likes = c.likes ?? 0;
  const dislikes = c.dislikes ?? 0;
  const myReaction = c.my_reaction ?? null;
  const wrap = document.createElement("div");
  wrap.className = "commentReactions";
  wrap.dataset.likes = String(likes);
  wrap.dataset.dislikes = String(dislikes);
  wrap.dataset.myReaction = myReaction == null ? "" : String(myReaction);

  const likeBtn = document.createElement("button");
  likeBtn.type = "button";
  likeBtn.className = "commentReactionBtn" + (myReaction === 1 ? " is-liked" : "");
  likeBtn.innerHTML = THUMB_UP_SVG + (likes > 0 ? `<span class="commentReactionCount">${likes}</span>` : "");
  likeBtn.title = "Like";
  likeBtn.dataset.action = "comment-like";
  likeBtn.dataset.commentId = String(c.id);

  const dislikeBtn = document.createElement("button");
  dislikeBtn.type = "button";
  dislikeBtn.className = "commentReactionBtn" + (myReaction === -1 ? " is-disliked" : "");
  dislikeBtn.innerHTML = THUMB_DOWN_SVG + (dislikes > 0 ? `<span class="commentReactionCount">${dislikes}</span>` : "");
  dislikeBtn.title = "Dislike";
  dislikeBtn.dataset.action = "comment-dislike";
  dislikeBtn.dataset.commentId = String(c.id);

  wrap.append(likeBtn, dislikeBtn);
  return wrap;
}

function renderCommentCard(c, isReply = false) {
  if (deletedIds.has(c.id)) return null;
  const rootCommentId = c.parent_id ?? c.id;
  const div = document.createElement("div");
  div.className = "commentCard" + (isReply ? " commentReply" : "");
  div.id = `c-${c.id}`;
  div.dataset.commentId = c.id;

  const authorName = c.author_name || "";
  const initial = authorName ? authorName.charAt(0).toUpperCase() : "?";
  const colorIdx = avatarColorIndex(authorName);

  const header = document.createElement("div");
  header.className = "commentCard__header";
  const avatarEl = document.createElement("div");
  avatarEl.className = `commentAvatar commentAvatar--${colorIdx}`;
  avatarEl.textContent = initial;
  const metaWrap = document.createElement("div");
  metaWrap.className = "commentCard__meta";
  const authorSpan = document.createElement("span");
  authorSpan.className = "commentAuthor";
  authorSpan.textContent = authorName || "[deleted]";
  const timeSpan = document.createElement("span");
  timeSpan.className = "commentTime";
  timeSpan.textContent = " • " + (c.created_at ? timeAgo(c.created_at) : "");
  metaWrap.append(authorSpan, timeSpan);
  header.append(avatarEl, metaWrap);

  const bodyEl = document.createElement("div");
  bodyEl.className = "commentCard__body";
  bodyEl.textContent = c.body || "";

  const actions = document.createElement("div");
  actions.className = "commentCard__actions";
  const replyBtn = document.createElement("button");
  replyBtn.type = "button";
  replyBtn.className = "commentReplyBtn";
  replyBtn.textContent = "Reply";
  replyBtn.dataset.action = "reply";
  replyBtn.dataset.rootId = String(rootCommentId);
  replyBtn.dataset.formId = `replyForm-${rootCommentId}`;
  actions.appendChild(replyBtn);

  actions.appendChild(renderReactionsBlock(c));

  if (c.can_edit) {
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "commentReplyBtn commentEditBtn";
    editBtn.innerHTML = '✎ Edit';
    editBtn.dataset.action = "edit";
    editBtn.dataset.commentId = String(c.id);
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "commentReplyBtn commentDelBtn";
    delBtn.innerHTML = '🗑 Delete';
    delBtn.dataset.action = "delete";
    delBtn.dataset.commentId = String(c.id);
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
  }

  if (isAdminMode() && getAdminToken()) {
    const adminDelBtn = document.createElement("button");
    adminDelBtn.type = "button";
    adminDelBtn.className = "commentReplyBtn commentDelBtn commentAdminDelBtn";
    adminDelBtn.innerHTML = 'Delete (admin)';
    adminDelBtn.title = "Admin moderation";
    adminDelBtn.dataset.action = "delete-admin";
    adminDelBtn.dataset.commentId = String(c.id);
    actions.appendChild(adminDelBtn);
  }

  div.append(header, bodyEl, actions);
  return div;
}

function renderRootCommentCard(root) {
  if (deletedIds.has(root.id)) return document.createDocumentFragment();
  const rootId = root.id;
  const wrapper = document.createElement("div");
  wrapper.className = "commentRootWrap";
  wrapper.dataset.rootId = String(rootId);

  const card = renderCommentCard(root, false);
  wrapper.appendChild(card);

  const replyFormWrap = document.createElement("div");
  replyFormWrap.className = "commentReplyFormWrap";
  replyFormWrap.id = `replyForm-${rootId}`;
  replyFormWrap.style.display = "none";
  replyFormWrap.dataset.rootId = String(rootId);
  replyFormWrap.innerHTML = `
    <textarea class="commentTextarea small" rows="2" placeholder="Write a reply…" maxlength="1000"></textarea>
    <button type="button" class="btn small replySubmitBtn" data-action="submit-reply">Post</button>
    <button type="button" class="btn small secondary replyCancelBtn" data-action="cancel-reply">Cancel</button>
    <div class="formErr replyErr" style="display:none"></div>
  `;
  card.appendChild(replyFormWrap);

  const repliesCount = root.replies_count ?? 0;
  if (repliesCount > 0) {
    const repliesToggle = document.createElement("button");
    repliesToggle.type = "button";
    repliesToggle.className = "repliesToggleBtn";
    repliesToggle.dataset.action = "toggle-replies";
    repliesToggle.dataset.rootId = String(rootId);
    repliesToggle.dataset.repliesCount = String(repliesCount);
    repliesToggle.textContent = `View replies (${repliesCount})`;

    const repliesContainer = document.createElement("div");
    repliesContainer.className = "replies";
    repliesContainer.style.display = "none";
    repliesContainer.dataset.rootId = String(rootId);
    const repliesList = document.createElement("div");
    repliesList.className = "repliesList";
    repliesContainer.appendChild(repliesList);

    wrapper.appendChild(repliesToggle);
    wrapper.appendChild(repliesContainer);
  }

  return wrapper;
}

async function postReply(parentCommentId, author, body, submitBtn = null, onRateLimitRestore = null) {
  const r = await fetch(`${API_BASE}/game/${GAME_ID}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ author_name: author, body, parent_id: parentCommentId }),
    ...FETCH_OPTS,
  });
  const data = await r.json().catch(() => ({}));
  if (handleRateLimit(r.status, data, submitBtn, onRateLimitRestore)) throw new Error("rate limited");
  if (!r.ok) throw new Error(data.detail || `HTTP ${r.status}`);
  return data;
}

function scrollToComment(commentId) {
  if (commentId == null) return;
  const el = document.querySelector(`[data-comment-id="${commentId}"]`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
}

let isSubmittingComment = false;

async function postComment() {
  if (isSubmittingComment) return;
  const author = ($("commentAuthor")?.value || "").trim();
  const body = ($("commentBody")?.value || "").trim();
  if (!author || author.length < 2) {
    showToast("Please enter your name first.");
    $("commentAuthor")?.focus();
    return;
  }
  if (author.length > 32) {
    alert("Name must be 2–32 characters.");
    return;
  }
  if (!body || body.length > 1000) {
    alert("Comment must be 1–1000 characters.");
    return;
  }
  isSubmittingComment = true;
  const btn = $("btnPostComment");
  const errEl = $("formPostErr");
  btn.disabled = true;
  btn.textContent = "Sending…";
  hideErr(errEl);
  try {
    const r = await fetch(`${API_BASE}/game/${GAME_ID}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author_name: author, body, parent_id: null }),
      ...FETCH_OPTS,
    });
    const data = await r.json().catch(() => ({}));
    if (handleRateLimit(r.status, data, btn, () => { isSubmittingComment = false; })) throw new Error("rate limited");
    if (!r.ok) throw new Error(data.detail || `HTTP ${r.status}`);
    setAuthorName(author);
    $("commentBody").value = "";
    await loadComments({ reset: true });
    scrollToComment(data.id);
    isSubmittingComment = false;
    btn.disabled = false;
    btn.textContent = "Post";
  } catch (e) {
    showErr(errEl, e.message || "Failed to post comment");
    if (e.message !== "rate limited") {
      isSubmittingComment = false;
      btn.disabled = false;
      btn.textContent = "Post";
    }
  }
}

const COMMENT_REACTION_DEBOUNCE_MS = 400;

async function setCommentReaction(commentId, reaction, reactionsWrap) {
  const likeBtn = reactionsWrap.querySelector('[data-action="comment-like"]');
  const dislikeBtn = reactionsWrap.querySelector('[data-action="comment-dislike"]');
  const targetBtn = reaction === 1 ? likeBtn : dislikeBtn;
  if (targetBtn.disabled) return;
  targetBtn.disabled = true;
  const reenable = () => setTimeout(() => { targetBtn.disabled = false; }, COMMENT_REACTION_DEBOUNCE_MS);

  let likes = parseInt(reactionsWrap.dataset.likes || "0", 10);
  let dislikes = parseInt(reactionsWrap.dataset.dislikes || "0", 10);
  let myReaction = reactionsWrap.dataset.myReaction === "1" ? 1 : reactionsWrap.dataset.myReaction === "-1" ? -1 : null;
  const prev = { likes, dislikes, myReaction };

  const isToggleOff = myReaction === reaction;
  if (isToggleOff) {
    myReaction = null;
    if (reaction === 1) likes = Math.max(0, likes - 1); else dislikes = Math.max(0, dislikes - 1);
  } else {
    const prevLike = myReaction === 1 ? 1 : 0;
    const prevDislike = myReaction === -1 ? 1 : 0;
    myReaction = reaction;
    likes = likes - prevLike + (reaction === 1 ? 1 : 0);
    dislikes = dislikes - prevDislike + (reaction === -1 ? 1 : 0);
  }
  reactionsWrap.dataset.likes = String(likes);
  reactionsWrap.dataset.dislikes = String(dislikes);
  reactionsWrap.dataset.myReaction = myReaction == null ? "" : String(myReaction);
  updateCommentReactionsUI(reactionsWrap);

  let rateLimited = false;
  try {
    let r;
    if (isToggleOff) {
      r = await fetch(`${API_BASE}/comments/${commentId}/reaction`, { method: "DELETE", ...FETCH_OPTS });
    } else {
      r = await fetch(`${API_BASE}/comments/${commentId}/reaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction }),
        ...FETCH_OPTS,
      });
    }
    const data = await r.json().catch(() => ({}));
    if (handleRateLimit(r.status, data, targetBtn)) { rateLimited = true; throw new Error("rate limited"); }
    if (!r.ok) throw new Error(data.detail || `HTTP ${r.status}`);
  } catch {
    reactionsWrap.dataset.likes = String(prev.likes);
    reactionsWrap.dataset.dislikes = String(prev.dislikes);
    reactionsWrap.dataset.myReaction = prev.myReaction == null ? "" : String(prev.myReaction);
    updateCommentReactionsUI(reactionsWrap);
  } finally {
    if (!rateLimited) reenable();
  }
}

function updateCommentReactionsUI(reactionsWrap) {
  const likes = parseInt(reactionsWrap.dataset.likes || "0", 10);
  const dislikes = parseInt(reactionsWrap.dataset.dislikes || "0", 10);
  const myReaction = reactionsWrap.dataset.myReaction === "1" ? 1 : reactionsWrap.dataset.myReaction === "-1" ? -1 : null;
  const likeBtn = reactionsWrap.querySelector('[data-action="comment-like"]');
  const dislikeBtn = reactionsWrap.querySelector('[data-action="comment-dislike"]');
  if (likeBtn) {
    likeBtn.className = "commentReactionBtn" + (myReaction === 1 ? " is-liked" : "");
    const countEl = likeBtn.querySelector(".commentReactionCount");
    if (likes > 0) {
      if (countEl) countEl.textContent = likes;
      else likeBtn.insertAdjacentHTML("beforeend", `<span class="commentReactionCount">${likes}</span>`);
    } else if (countEl) countEl.remove();
  }
  if (dislikeBtn) {
    dislikeBtn.className = "commentReactionBtn" + (myReaction === -1 ? " is-disliked" : "");
    const countEl = dislikeBtn.querySelector(".commentReactionCount");
    if (dislikes > 0) {
      if (countEl) countEl.textContent = dislikes;
      else dislikeBtn.insertAdjacentHTML("beforeend", `<span class="commentReactionCount">${dislikes}</span>`);
    } else if (countEl) countEl.remove();
  }
}

async function toggleReplies(rootId, opts = {}) {
  const { userInitiated = false, forceOpen = null, limitOverride } = opts;
  const wrapper = document.querySelector(`.commentRootWrap[data-root-id="${rootId}"]`);
  if (!wrapper) return;
  const toggleBtn = wrapper.querySelector('[data-action="toggle-replies"]');
  const repliesContainer = wrapper.querySelector(".replies");
  if (!toggleBtn || !repliesContainer) return;

  const isExpanded = repliesContainer.style.display !== "none";
  const willExpand = forceOpen ?? !isExpanded;

  if (willExpand && !isExpanded) {
    const repliesCount = parseInt(toggleBtn.dataset.repliesCount || "0", 10);
    const cache = repliesCache[rootId];
    if (!cache || cache.items.length === 0) {
      toggleBtn.disabled = true;
      toggleBtn.textContent = "Loading…";
      try {
        const { items, hasMore, nextOffset } = await loadReplies(rootId, 0, false, limitOverride);
        const listEl = repliesContainer.querySelector(".repliesList");
        if (listEl) listEl.innerHTML = "";
        items.forEach((r) => { const card = renderCommentCard(r, true); if (card) listEl?.appendChild(card); });
        if (hasMore && cache.items.length < repliesCount) {
          const viewMoreBtn = document.createElement("button");
          viewMoreBtn.type = "button";
          viewMoreBtn.className = "repliesToggleBtn";
          viewMoreBtn.textContent = "View more replies";
          viewMoreBtn.dataset.action = "view-more-replies";
          viewMoreBtn.dataset.rootId = String(rootId);
          viewMoreBtn.dataset.offset = String(nextOffset);
          repliesContainer.appendChild(viewMoreBtn);
        }
      } catch (e) {
        console.error("loadReplies failed", { rootId, url: e.url, status: e.status, textSnippet: e.textSnippet });
        if (userInitiated) showToast("Failed to load replies.");
      } finally {
        toggleBtn.disabled = false;
      }
    } else {
      const listEl = repliesContainer.querySelector(".repliesList");
      if (listEl) listEl.innerHTML = "";
      cache.items.filter((r) => !deletedIds.has(r.id)).forEach((r) => { const card = renderCommentCard(r, true); if (card) listEl?.appendChild(card); });
      if (repliesCount > cache.items.length) {
        const viewMoreBtn = document.createElement("button");
        viewMoreBtn.type = "button";
        viewMoreBtn.className = "repliesToggleBtn";
        viewMoreBtn.textContent = "View more replies";
        viewMoreBtn.dataset.action = "view-more-replies";
        viewMoreBtn.dataset.rootId = String(rootId);
        viewMoreBtn.dataset.offset = String(cache.items.length);
        repliesContainer.appendChild(viewMoreBtn);
      }
    }
    repliesContainer.style.display = "block";
    toggleBtn.textContent = "Hide replies";
    setRepliesOpen(rootId, true);
  } else if (!willExpand) {
    repliesContainer.style.display = "none";
    toggleBtn.textContent = `View replies (${toggleBtn.dataset.repliesCount || "?"})`;
    setRepliesOpen(rootId, false);
  }
}

function showDeleteConfirmBar(card, commentId, onConfirm, onCancel) {
  const actions = card.querySelector(".commentCard__actions");
  if (!actions) return;
  let bar = actions.querySelector(".deleteConfirmBar");
  if (bar) return;
  const editBtn = actions.querySelector('[data-action="edit"]');
  const delBtn = actions.querySelector('[data-action="delete"]');
  if (editBtn) editBtn.style.display = "none";
  if (delBtn) delBtn.style.display = "none";
  bar = document.createElement("div");
  bar.className = "deleteConfirmBar";
  bar.innerHTML = `
    <span class="deleteConfirmBar__text">Delete this comment?</span>
    <button type="button" class="btn small secondary btnCancelDelete">Cancel</button>
    <button type="button" class="btn small btnConfirmDelete">Delete</button>
  `;
  const cancelBtn = bar.querySelector(".btnCancelDelete");
  const confirmBtn = bar.querySelector(".btnConfirmDelete");
  const close = () => {
    bar.remove();
    if (editBtn) editBtn.style.display = "";
    if (delBtn) delBtn.style.display = "";
  };
  cancelBtn.addEventListener("click", () => { close(); onCancel?.(); });
  confirmBtn.addEventListener("click", () => { close(); onConfirm?.(confirmBtn); });
  actions.appendChild(bar);
}

async function adminDeleteComment(commentId) {
  const token = getAdminToken();
  if (!token) {
    showToast("Admin token required. Set clerk_admin_token in localStorage.");
    return;
  }
  try {
    const r = await fetch(`${API_BASE}/admin/comments/${commentId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      ...FETCH_OPTS,
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) {
      showToast("Missing admin token.");
      return;
    }
    if (r.status === 403) {
      showToast("Invalid admin token.");
      return;
    }
    if (!r.ok) throw new Error(data.detail || `HTTP ${r.status}`);

    showToast("Comment removed by admin");
    deletedIds.add(commentId);
    const card = document.querySelector(`.commentCard[data-comment-id="${commentId}"]`);
    if (!card) return;
    const rootWrap = card.closest(".commentRootWrap");
    const isReply = card.classList.contains("commentReply");
    const repliesContainer = rootWrap?.querySelector(".replies");
    const repliesToggle = rootWrap?.querySelector('[data-action="toggle-replies"]');

    if (isReply) {
      const rootId = rootWrap?.dataset.rootId;
      if (rootId) delete repliesCache[rootId];
      card.remove();
      if (repliesToggle) {
        const count = Math.max(0, parseInt(repliesToggle.dataset.repliesCount || "0", 10) - 1);
        repliesToggle.dataset.repliesCount = String(count);
        if (count <= 0) {
          repliesToggle.remove();
          repliesContainer?.remove();
        } else {
          repliesToggle.textContent = repliesContainer?.style.display !== "none" ? "Hide replies" : `View replies (${count})`;
        }
      }
    } else {
      const rootId = rootWrap?.dataset.rootId;
      if (rootId) delete repliesCache[rootId];
      rootWrap?.remove();
    }
    await loadCommentsCount();
  } catch (e) {
    showToast(`Failed: ${e.message}`);
  }
}

async function deleteComment(commentId, skipConfirm = false, submitBtn = null) {
  if (!skipConfirm) {
    const card = document.querySelector(`.commentCard[data-comment-id="${commentId}"]`);
    if (card) {
      showDeleteConfirmBar(card, commentId, (btn) => deleteComment(commentId, true, btn), () => {});
      return;
    }
  }
  try {
    const r = await fetch(`${API_BASE}/comments/${commentId}`, {
      method: "DELETE",
      ...FETCH_OPTS,
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 403) {
      showToast("You can only delete your own comments.");
      return;
    }
    if (handleRateLimit(r.status, data, submitBtn)) return;
    if (!r.ok) throw new Error(data.detail || `HTTP ${r.status}`);

    showToast("Comment deleted");
    deletedIds.add(commentId);
    const card = document.querySelector(`.commentCard[data-comment-id="${commentId}"]`);
    if (!card) return;
    const rootWrap = card.closest(".commentRootWrap");
    const isReply = card.classList.contains("commentReply");
    const repliesContainer = rootWrap?.querySelector(".replies");
    const repliesToggle = rootWrap?.querySelector('[data-action="toggle-replies"]');

    if (isReply) {
      const rootId = rootWrap?.dataset.rootId;
      if (rootId) delete repliesCache[rootId];
      card.remove();
      if (repliesToggle) {
        const count = Math.max(0, parseInt(repliesToggle.dataset.repliesCount || "0", 10) - 1);
        repliesToggle.dataset.repliesCount = String(count);
        if (count <= 0) {
          repliesToggle.remove();
          repliesContainer?.remove();
        } else {
          repliesToggle.textContent = repliesContainer?.style.display !== "none" ? "Hide replies" : `View replies (${count})`;
        }
      }
    } else {
      const rootId = rootWrap?.dataset.rootId;
      if (rootId) delete repliesCache[rootId];
      rootWrap?.remove();
      const listEl = $("commentsList");
      const countEl = $("commentsCount");
      if (countEl && listEl) {
        const roots = listEl.querySelectorAll(".commentRootWrap");
        countEl.textContent = `(${roots.length})`;
      }
    }
    await loadCommentsCount();
  } catch (e) {
    showToast(`Failed to delete: ${e.message}`);
  }
}

async function patchComment(commentId, newBody) {
  const r = await fetch(`${API_BASE}/comments/${commentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: newBody }),
    ...FETCH_OPTS,
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 403) {
    showToast("You can only edit your own comments.");
    throw new Error("forbidden");
  }
  if (!r.ok) throw new Error(data.detail || `HTTP ${r.status}`);
  return data;
}

// ---- Init ----
$("commentAuthor").value = getAuthorName();

$("btnLike").addEventListener("click", () => setReaction(1));
$("btnDislike").addEventListener("click", () => setReaction(-1));

const shareBtn = $("btnShare");
if (shareBtn) shareBtn.addEventListener("click", async () => {
  const url = location.href;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
      showToast("Link copied");
    } else {
      prompt("Copy link:", url);
    }
  } catch (_) {
    prompt("Copy this link:", url);
  }
});

$("commentForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (isSubmittingComment) return;
  postComment();
});

$("btnLoadMore").addEventListener("click", () => loadComments({ reset: false }));

const commentsListEl = $("commentsList");
if (commentsListEl) commentsListEl.addEventListener("click", async (e) => {
  const target = e.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;

  if (action === "comment-like" || action === "comment-dislike") {
    const commentId = parseInt(target.dataset.commentId, 10);
    const reactionsWrap = target.closest(".commentReactions");
    if (commentId && reactionsWrap) setCommentReaction(commentId, action === "comment-like" ? 1 : -1, reactionsWrap);
    return;
  }
  if (action === "toggle-replies") {
    const toggleEl = e.target.closest('[data-action="toggle-replies"]');
    if (!toggleEl) return;
    const rootId = target.dataset.rootId;
    if (rootId) toggleReplies(rootId, { userInitiated: true });
    return;
  }
  if (action === "view-more-replies") {
    const rootId = target.dataset.rootId;
    const offset = parseInt(target.dataset.offset || "0", 10);
    if (!rootId) return;
    try {
      target.disabled = true;
      target.textContent = "Loading…";
      const { items, hasMore, nextOffset } = await loadReplies(rootId, offset, true);
      target.remove();
      const repliesContainer = document.querySelector(`.commentRootWrap[data-root-id="${rootId}"] .replies`);
      const listEl = repliesContainer?.querySelector(".repliesList");
      if (listEl) {
        items.forEach((r) => { const card = renderCommentCard(r, true); if (card) listEl.appendChild(card); });
        if (hasMore) {
          const viewMoreBtn = document.createElement("button");
          viewMoreBtn.type = "button";
          viewMoreBtn.className = "repliesToggleBtn";
          viewMoreBtn.textContent = "View more replies";
          viewMoreBtn.dataset.action = "view-more-replies";
          viewMoreBtn.dataset.rootId = String(rootId);
          viewMoreBtn.dataset.offset = String(nextOffset);
          repliesContainer?.appendChild(viewMoreBtn);
        }
      }
    } catch (err) {
      console.error("loadReplies failed", { rootId, url: err.url, status: err.status, textSnippet: err.textSnippet });
      showToast("Failed to load replies.");
      target.disabled = false;
      target.textContent = "View more replies";
    }
    return;
  }
  if (action === "reply") {
    const formId = target.dataset.formId;
    const wrap = document.getElementById(formId);
    if (wrap) {
      wrap.style.display = wrap.style.display === "none" ? "block" : "none";
      if (wrap.style.display === "block") wrap.querySelector("textarea").focus();
    }
  } else if (action === "submit-reply") {
    const formWrap = target.closest(".commentReplyFormWrap");
    const rootId = formWrap ? parseInt(formWrap.dataset.rootId, 10) : 0;
    if (!formWrap) return;
    if (formWrap.dataset.submitting === "1") return;
    const textarea = formWrap.querySelector("textarea");
    const body = (textarea?.value || "").trim();
    if (!body) return;
    const authorVal = ($("commentAuthor")?.value || getAuthorName() || "").trim();
    if (!authorVal || authorVal.length < 2) {
      showToast("Please enter your name first.");
      $("commentAuthor")?.focus();
      return;
    }
    if (authorVal.length > 32) {
      alert("Name must be 2–32 characters.");
      return;
    }
    formWrap.dataset.submitting = "1";
    target.disabled = true;
    target.textContent = "Sending…";
    const errEl = formWrap.querySelector(".replyErr");
    errEl.style.display = "none";
    try {
      const data = await postReply(rootId, authorVal, body, target, () => { formWrap.dataset.submitting = "0"; });
      setAuthorName(authorVal);
      textarea.value = "";
      formWrap.style.display = "none";
      formWrap.dataset.submitting = "0";
      target.disabled = false;
      target.textContent = "Post";
      await loadComments({ reset: true });
      const rootEl = document.querySelector(`.commentRootWrap[data-root-id="${rootId}"]`);
      const toggleBtn = rootEl?.querySelector('[data-action="toggle-replies"]');
      const repliesCount = toggleBtn ? parseInt(toggleBtn.dataset.repliesCount || "0", 10) : 0;
      const loadLimit = repliesCount > 0 && repliesCount <= 50 ? repliesCount : undefined;
      await toggleReplies(String(rootId), { forceOpen: true, limitOverride: loadLimit });
      scrollToComment(data.id);
    } catch (err) {
      errEl.textContent = err.message || "Failed to post reply";
      errEl.style.display = "block";
      if (err.message !== "rate limited") {
        formWrap.dataset.submitting = "0";
        target.disabled = false;
        target.textContent = "Post";
      }
    }
  } else if (action === "cancel-reply") {
    const formWrap = target.closest(".commentReplyFormWrap");
    if (formWrap) {
      formWrap.style.display = "none";
      const ta = formWrap.querySelector("textarea");
      if (ta) ta.value = "";
    }
  } else if (action === "edit") {
    const commentId = parseInt(target.dataset.commentId, 10);
    const card = target.closest(".commentCard");
    if (!commentId || !card) return;
    const bodyEl = card.querySelector(".commentCard__body");
    if (!bodyEl || bodyEl.dataset.editing === "1") return;
    const originalBody = bodyEl.textContent;
    bodyEl.dataset.originalBody = originalBody;
    bodyEl.dataset.editing = "1";
    const textarea = document.createElement("textarea");
    textarea.className = "commentTextarea small commentEditTextarea";
    textarea.rows = 3;
    textarea.maxLength = 1000;
    textarea.value = originalBody;
    const btnWrap = document.createElement("div");
    btnWrap.className = "commentEditBtns";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn small";
    saveBtn.textContent = "Save";
    saveBtn.dataset.action = "edit-save";
    saveBtn.dataset.commentId = String(commentId);
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn small secondary";
    cancelBtn.textContent = "Cancel";
    cancelBtn.dataset.action = "edit-cancel";
    cancelBtn.dataset.commentId = String(commentId);
    btnWrap.append(saveBtn, cancelBtn);
    bodyEl.textContent = "";
    bodyEl.appendChild(textarea);
    bodyEl.appendChild(btnWrap);
    target.style.display = "none";
    textarea.focus();
  } else if (action === "edit-save") {
    const commentId = parseInt(target.dataset.commentId, 10);
    const card = target.closest(".commentCard");
    if (!commentId || !card) return;
    const bodyEl = card.querySelector(".commentCard__body");
    const textarea = bodyEl?.querySelector(".commentEditTextarea");
    const newBody = (textarea?.value || "").trim();
    if (!newBody || newBody.length > 1000) {
      alert("Comment must be 1–1000 characters.");
      return;
    }
    target.disabled = true;
    target.textContent = "Saving…";
    try {
      await patchComment(commentId, newBody);
      bodyEl.dataset.editing = "0";
      bodyEl.textContent = newBody;
      bodyEl.querySelector(".commentEditBtns")?.remove();
      const editBtn = card.querySelector('[data-action="edit"]');
      if (editBtn) editBtn.style.display = "";
    } catch (e) {
      showToast(e.message || "Failed to save");
    } finally {
      target.disabled = false;
      target.textContent = "Save";
    }
  } else if (action === "edit-cancel") {
    const card = target.closest(".commentCard");
    if (!card) return;
    const bodyEl = card.querySelector(".commentCard__body");
    const originalBody = bodyEl?.dataset.originalBody ?? "";
    bodyEl.dataset.editing = "0";
    bodyEl.textContent = originalBody;
    bodyEl.querySelector(".commentEditBtns")?.remove();
    const editBtn = card.querySelector('[data-action="edit"]');
    if (editBtn) editBtn.style.display = "";
  } else if (action === "delete") {
    const commentId = parseInt(target.dataset.commentId, 10);
    if (commentId) deleteComment(commentId);
  } else if (action === "delete-admin") {
    const commentId = parseInt(target.dataset.commentId, 10);
    if (commentId) adminDeleteComment(commentId);
  }
});

initCommentsPanelState();

$("commentsTitleBtn")?.addEventListener("click", toggleCommentsPanel);

loadReactions();
loadComments({ reset: true });
