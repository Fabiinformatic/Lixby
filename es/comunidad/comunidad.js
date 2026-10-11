// Comunidad Lixby — cliente de Firestore + Auth + Cloud Functions.
// Lix Design v1.6. Las reglas y el modelo están en firestore.rules y
// docs/comunidad/modelo-de-datos.md.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getDoc,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyCPU-jsIupu3lsRrknmlv04A3YnBwXeePU",
  authDomain: "lixby0.firebaseapp.com",
  projectId: "lixby0",
  storageBucket: "lixby0.firebasestorage.app",
  messagingSenderId: "1058088945026",
  appId: "1:1058088945026:web:c56eaa9c71f1ca625fbb9b",
  measurementId: "G-689VDV93C2",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const fns = getFunctions(app, "europe-west1");

const createPost = httpsCallable(fns, "communityCreatePost");
const createComment = httpsCallable(fns, "communityCreateComment");
const reportContent = httpsCallable(fns, "communityReport");
const moderateContent = httpsCallable(fns, "communityModerate");
const resolveReport = httpsCallable(fns, "communityResolveReport");

const PAGE_SIZE = 10;
const MOD_ROLES = ["owner", "mod", "admin"];

const state = {
  user: null,
  role: null,
  spaces: [],
  spaceSlug: null,
  sort: "recent",
  posts: [],
  lastDoc: null,
  hasMore: false,
  loading: false,
  currentPost: null,
  comments: [],
  votes: new Map(),
  replyTo: null,
  reportTarget: null,
};

const el = {
  spaceList: document.getElementById("spaceList"),
  feedTitle: document.getElementById("feedTitle"),
  postList: document.getElementById("postList"),
  feedStatus: document.getElementById("feedStatus"),
  loadMoreBtn: document.getElementById("loadMoreBtn"),
  viewFeed: document.getElementById("viewFeed"),
  viewPost: document.getElementById("viewPost"),
  postDetail: document.getElementById("postDetail"),
  backToFeed: document.getElementById("backToFeed"),
  commentComposer: document.getElementById("commentComposer"),
  commentBody: document.getElementById("commentBody"),
  submitComment: document.getElementById("submitComment"),
  cancelReplyBtn: document.getElementById("cancelReplyBtn"),
  replyToHint: document.getElementById("replyToHint"),
  commentError: document.getElementById("commentError"),
  commentLoginPrompt: document.getElementById("commentLoginPrompt"),
  commentList: document.getElementById("commentList"),
  newPostBtn: document.getElementById("newPostBtn"),
  loginPromptLink: document.getElementById("loginPromptLink"),
  newPostDialog: document.getElementById("newPostDialog"),
  newPostForm: document.getElementById("newPostForm"),
  postSpace: document.getElementById("postSpace"),
  postTitle: document.getElementById("postTitle"),
  postBody: document.getElementById("postBody"),
  newPostError: document.getElementById("newPostError"),
  cancelPost: document.getElementById("cancelPost"),
  reportDialog: document.getElementById("reportDialog"),
  reportForm: document.getElementById("reportForm"),
  reportReason: document.getElementById("reportReason"),
  reportNote: document.getElementById("reportNote"),
  reportError: document.getElementById("reportError"),
  cancelReport: document.getElementById("cancelReport"),
  modPanel: document.getElementById("modPanel"),
  reportList: document.getElementById("reportList"),
  toast: document.getElementById("communityToast"),
};

/* ---------------------------- utilidades ---------------------------- */

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function toDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatRelative(ts) {
  const date = toDate(ts);
  if (!date) return "";
  const diff = Date.now() - date.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

let toastTimer = null;
function toast(message, variant = "info") {
  if (!el.toast) return;
  el.toast.textContent = message;
  el.toast.dataset.variant = variant;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.toast.hidden = true;
  }, variant === "error" ? 5000 : 3200);
}

function isMod() {
  return MOD_ROLES.includes(state.role);
}

function posterUrl(postId) {
  return `/es/comunidad/?hilo=${encodeURIComponent(postId)}`;
}

/* ------------------------------ espacios ---------------------------- */

async function loadSpaces() {
  try {
    const snap = await getDocs(query(collection(db, "spaces"), orderBy("order", "asc")));
    state.spaces = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderSpaces();
    fillSpaceSelect();
  } catch (error) {
    console.error("Error cargando espacios:", error);
    el.spaceList.innerHTML =
      '<p class="community-status">No se pudieron cargar los espacios.</p>';
  }
}

function renderSpaces() {
  const total = state.spaces.reduce((sum, s) => sum + (s.postCount || 0), 0);
  const items = [
    `<a class="space-link${state.spaceSlug ? "" : " is-active"}" href="/es/comunidad/" data-space="">
      <span class="space-emoji" aria-hidden="true">🏠</span> Todos
      <span class="space-count">${total}</span>
    </a>`,
    ...state.spaces.map((s) => `
      <a class="space-link${state.spaceSlug === s.slug ? " is-active" : ""}"
         href="/es/comunidad/?espacio=${encodeURIComponent(s.slug)}" data-space="${esc(s.slug)}">
        <span class="space-emoji" aria-hidden="true">${esc(s.icon || "💬")}</span>
        ${esc(s.name)}
        <span class="space-count">${Number(s.postCount || 0)}</span>
      </a>`),
  ];
  el.spaceList.innerHTML = items.join("");
}

function fillSpaceSelect() {
  el.postSpace.innerHTML = state.spaces
    .map((s) => `<option value="${esc(s.slug)}">${esc(s.name)}</option>`)
    .join("");
  if (state.spaceSlug) el.postSpace.value = state.spaceSlug;
}

/* -------------------------------- feed ------------------------------ */

function currentSpace() {
  return state.spaces.find((s) => s.slug === state.spaceSlug) || null;
}

async function loadFeed({ append = false } = {}) {
  if (state.loading) return;
  state.loading = true;
  el.loadMoreBtn.disabled = true;
  if (!append) {
    el.feedStatus.textContent = "Cargando hilos…";
    el.postList.innerHTML = "";
  }

  const constraints = [where("status", "==", "published")];
  if (state.spaceSlug) constraints.push(where("spaceId", "==", state.spaceSlug));
  constraints.push(orderBy(state.sort === "top" ? "score" : "lastActivityAt", "desc"));
  if (append && state.lastDoc) constraints.push(startAfter(state.lastDoc));
  constraints.push(limit(PAGE_SIZE));

  try {
    const snap = await getDocs(query(collection(db, "posts"), ...constraints));
    const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    state.lastDoc = snap.docs[snap.docs.length - 1] || state.lastDoc;
    state.hasMore = snap.size === PAGE_SIZE;
    state.posts = append ? state.posts.concat(fetched) : fetched;
    renderFeed();
  } catch (error) {
    console.error("Error cargando hilos:", error);
    el.feedStatus.textContent = "No se pudieron cargar los hilos. Inténtalo de nuevo.";
  } finally {
    state.loading = false;
    el.loadMoreBtn.disabled = false;
    el.loadMoreBtn.hidden = !state.hasMore;
  }
}

function renderFeed() {
  const space = currentSpace();
  el.feedTitle.textContent = space ? space.name : "Todos los hilos";
  if (!state.posts.length) {
    el.feedStatus.innerHTML = `
      <div class="community-empty">
        <span class="empty-emoji" aria-hidden="true">🌱</span>
        Todavía no hay hilos aquí. ${
          state.user ? "Sé el primero en publicar." : "Inicia sesión y publica el primero."
        }
      </div>`;
    el.postList.innerHTML = "";
    return;
  }
  el.feedStatus.textContent = "";
  el.postList.innerHTML = state.posts.map(postCardHtml).join("");
}

function postCardHtml(post) {
  const tags = (post.tags || [])
    .map((t) => `<span class="post-tag">${esc(t)}</span>`)
    .join("");
  return `
    <article class="post-card" data-post-id="${esc(post.id)}">
      <div class="vote-control" data-vote-control data-for-post="${esc(post.id)}">
        <button class="vote-btn" type="button" data-vote="up" data-target-type="post" data-post-id="${esc(post.id)}" aria-label="Voto positivo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>
        </button>
        <span class="vote-score" data-score>${Number(post.score || 0)}</span>
        <button class="vote-btn" type="button" data-vote="down" data-target-type="post" data-post-id="${esc(post.id)}" aria-label="Voto negativo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        </button>
      </div>
      <div class="post-main">
        <h3 class="post-title">
          <a href="${posterUrl(post.id)}" data-open-post data-post-id="${esc(post.id)}">${esc(post.title)}</a>
        </h3>
        <p class="post-excerpt">${esc(post.body || "")}</p>
        <div class="post-meta">
          <span>${esc(post.authorName || "Usuario")}</span>
          <span class="dot" aria-hidden="true"></span>
          <span>${formatRelative(post.lastActivityAt || post.createdAt)}</span>
          <span class="dot" aria-hidden="true"></span>
          <span>${Number(post.commentCount || 0)} comentarios</span>
          ${tags ? `<span class="dot" aria-hidden="true"></span>${tags}` : ""}
        </div>
      </div>
    </article>`;
}

function updateVoteControl(targetType, postId, commentId, value) {
  const selector = targetType === "post"
    ? `[data-vote-control][data-for-post="${postId}"]`
    : `[data-vote-control][data-for-comment="${commentId}"]`;
  document.querySelectorAll(selector).forEach((control) => {
    control.querySelectorAll(".vote-btn").forEach((btn) => {
      const dir = btn.dataset.vote === "up" ? 1 : -1;
      btn.classList.toggle("is-active", value === dir);
    });
  });
}

/* -------------------------------- votos ----------------------------- */

function voteKey(targetType, postId, commentId) {
  return `${targetType}:${postId}:${commentId || ""}`;
}

async function handleVote(targetType, postId, commentId, direction) {
  if (!state.user) {
    toast("Inicia sesión para votar.", "error");
    return;
  }
  const uid = state.user.uid;
  const value = direction === "up" ? 1 : -1;
  const key = voteKey(targetType, postId, commentId);
  const ref = targetType === "post"
    ? doc(db, "posts", postId, "votes", uid)
    : doc(db, "posts", postId, "comments", commentId, "votes", uid);

  let current;
  if (state.votes.has(key)) {
    current = state.votes.get(key);
  } else {
    try {
      const snap = await getDoc(ref);
      current = snap.exists() ? Number(snap.data().value) || 0 : 0;
    } catch (error) {
      console.error(error);
      current = 0;
    }
  }

  try {
    if (current === value) {
      await deleteDoc(ref);
      applyVote(targetType, postId, commentId, 0, -current);
    } else {
      await setDoc(ref, { value, createdAt: serverTimestamp() });
      applyVote(targetType, postId, commentId, value, value - current);
    }
  } catch (error) {
    console.error("Error al votar:", error);
    toast("No se pudo registrar tu voto.", "error");
  }
}

function applyVote(targetType, postId, commentId, value, scoreDelta) {
  state.votes.set(voteKey(targetType, postId, commentId), value);
  updateVoteControl(targetType, postId, commentId, value);

  if (targetType === "post" && state.currentPost && state.currentPost.id === postId) {
    state.currentPost.score = Number(state.currentPost.score || 0) + scoreDelta;
  }
  const selector = targetType === "post"
    ? `[data-vote-control][data-for-post="${postId}"] [data-score]`
    : `[data-vote-control][data-for-comment="${commentId}"] [data-score]`;
  document.querySelectorAll(selector).forEach((scoreEl) => {
    scoreEl.textContent = Number(scoreEl.textContent) + scoreDelta;
  });
}

/* ------------------------------ detalle ----------------------------- */

async function openPost(postId) {
  el.viewFeed.hidden = true;
  el.viewPost.hidden = false;
  el.postDetail.innerHTML = '<p class="community-status">Cargando hilo…</p>';
  el.commentList.innerHTML = "";
  state.replyTo = null;
  updateReplyHint();

  try {
    const snap = await getDoc(doc(db, "posts", postId));
    if (!snap.exists() || (snap.data().status !== "published" && !isMod())) {
      el.postDetail.innerHTML = '<p class="community-status">Este hilo no está disponible.</p>';
      return;
    }
    state.currentPost = { id: snap.id, ...snap.data() };
    renderPostDetail();

    if (state.user) {
      const voteSnap = await getDoc(doc(db, "posts", postId, "votes", state.user.uid));
      const value = voteSnap.exists() ? Number(voteSnap.data().value) || 0 : 0;
      state.votes.set(voteKey("post", postId, null), value);
      updateVoteControl("post", postId, null, value);
    }

    await loadComments(postId);
  } catch (error) {
    console.error("Error cargando hilo:", error);
    el.postDetail.innerHTML = '<p class="community-status">No se pudo cargar el hilo.</p>';
  }
}

function renderPostDetail() {
  const post = state.currentPost;
  if (!post) return;
  const tags = (post.tags || []).map((t) => `<span class="post-tag">${esc(t)}</span>`).join("");
  el.postDetail.innerHTML = `
    <div class="post-detail-grid">
      <div class="vote-control" data-vote-control data-for-post="${esc(post.id)}">
        <button class="vote-btn" type="button" data-vote="up" data-target-type="post" data-post-id="${esc(post.id)}" aria-label="Voto positivo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>
        </button>
        <span class="vote-score" data-score>${Number(post.score || 0)}</span>
        <button class="vote-btn" type="button" data-vote="down" data-target-type="post" data-post-id="${esc(post.id)}" aria-label="Voto negativo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        </button>
      </div>
      <div>
        <h1>${esc(post.title)}</h1>
        <div class="post-meta">
          <span>${esc(post.authorName || "Usuario")}</span>
          <span class="dot" aria-hidden="true"></span>
          <span>${formatRelative(post.createdAt)}</span>
          ${post.editedAt ? '<span class="dot" aria-hidden="true"></span><span>editado</span>' : ""}
          ${tags ? `<span class="dot" aria-hidden="true"></span>${tags}` : ""}
        </div>
        <div class="post-body" style="margin-top:16px">${esc(post.body || "")}</div>
        <div class="post-detail-actions">
          <button class="comment-action-link" type="button" data-report data-target-type="post" data-post-id="${esc(post.id)}">Reportar</button>
        </div>
      </div>
    </div>`;
}

/* ---------------------------- comentarios --------------------------- */

async function loadComments(postId) {
  try {
    const snap = await getDocs(query(
      collection(db, "posts", postId, "comments"),
      where("status", "==", "published"),
      orderBy("createdAt", "asc")
    ));
    state.comments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderComments();
  } catch (error) {
    console.error("Error cargando comentarios:", error);
    el.commentList.innerHTML = '<p class="community-status">No se pudieron cargar los comentarios.</p>';
  }
}

function buildCommentTree(comments) {
  const byId = new Map();
  comments.forEach((c) => byId.set(c.id, { ...c, children: [] }));
  const roots = [];
  byId.forEach((node) => {
    if (node.parentCommentId && byId.has(node.parentCommentId)) {
      byId.get(node.parentCommentId).children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function renderComments() {
  const roots = buildCommentTree(state.comments);
  if (!roots.length) {
    el.commentList.innerHTML = '<p class="community-status">Todavía no hay comentarios.</p>';
    return;
  }
  el.commentList.innerHTML = roots.map(commentHtml).join("");
}

function commentHtml(node) {
  const children = node.children.length
    ? `<div class="comment-children">${node.children.map(commentHtml).join("")}</div>`
    : "";
  return `
    <article class="comment" data-comment-id="${esc(node.id)}">
      <div class="comment-header">
        <strong>${esc(node.authorName || "Usuario")}</strong>
        <span>·</span>
        <span>${formatRelative(node.createdAt)}</span>
        ${node.editedAt ? "<span>· editado</span>" : ""}
      </div>
      <div class="comment-body">${esc(node.body)}</div>
      <div class="comment-actions">
        <div class="vote-control" data-vote-control data-for-comment="${esc(node.id)}">
          <button class="vote-btn" type="button" data-vote="up" data-target-type="comment" data-post-id="${esc(node.postId)}" data-comment-id="${esc(node.id)}" aria-label="Voto positivo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>
          </button>
          <span class="vote-score" data-score>${Number(node.score || 0)}</span>
          <button class="vote-btn" type="button" data-vote="down" data-target-type="comment" data-post-id="${esc(node.postId)}" data-comment-id="${esc(node.id)}" aria-label="Voto negativo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
          </button>
        </div>
        <button class="comment-action-link" type="button" data-reply data-comment-id="${esc(node.id)}" data-author="${esc(node.authorName || "")}">Responder</button>
        <button class="comment-action-link" type="button" data-report data-target-type="comment" data-post-id="${esc(node.postId)}" data-comment-id="${esc(node.id)}">Reportar</button>
      </div>
      ${children}
    </article>`;
}

function updateReplyHint() {
  if (state.replyTo) {
    el.replyToHint.hidden = false;
    el.cancelReplyBtn.hidden = false;
    el.replyToHint.textContent = `Respondiendo a ${state.replyTo.author || "un comentario"}`;
  } else {
    el.replyToHint.hidden = true;
    el.cancelReplyBtn.hidden = true;
  }
}

async function submitComment() {
  const body = el.commentBody.value.trim();
  el.commentError.hidden = true;
  if (!body) {
    el.commentError.textContent = "Escribe algo antes de comentar.";
    el.commentError.hidden = false;
    return;
  }
  el.submitComment.disabled = true;
  try {
    await createComment({
      postId: state.currentPost.id,
      parentCommentId: state.replyTo ? state.replyTo.id : null,
      body,
    });
    el.commentBody.value = "";
    state.replyTo = null;
    updateReplyHint();
    await loadComments(state.currentPost.id);
    toast("Comentario publicado.", "success");
  } catch (error) {
    console.error("Error al comentar:", error);
    el.commentError.textContent = error?.message || "No se pudo publicar el comentario.";
    el.commentError.hidden = false;
  } finally {
    el.submitComment.disabled = false;
  }
}

/* ------------------------------- reportes --------------------------- */

function openReportDialog(target) {
  state.reportTarget = target;
  el.reportError.hidden = true;
  el.reportNote.value = "";
  el.reportDialog.showModal();
}

async function submitReport(event) {
  event.preventDefault();
  if (!state.reportTarget) return;
  el.reportError.hidden = true;
  try {
    await reportContent({
      targetType: state.reportTarget.targetType,
      targetId: state.reportTarget.targetId,
      postId: state.reportTarget.postId,
      reason: el.reportReason.value,
      note: el.reportNote.value.trim(),
    });
    el.reportDialog.close();
    toast("Gracias, hemos recibido tu reporte.", "success");
  } catch (error) {
    console.error("Error al reportar:", error);
    el.reportError.textContent = error?.message || "No se pudo enviar el reporte.";
    el.reportError.hidden = false;
  }
}

/* ------------------------------ moderación -------------------------- */

async function loadReports() {
  if (!isMod()) return;
  el.modPanel.hidden = false;
  try {
    const snap = await getDocs(query(
      collection(db, "reports"),
      where("status", "==", "open"),
      orderBy("createdAt", "desc"),
      limit(20)
    ));
    if (snap.empty) {
      el.reportList.innerHTML = '<p class="community-status">Sin reportes abiertos.</p>';
      return;
    }
    el.reportList.innerHTML = snap.docs.map((d) => {
      const r = d.data();
      const parts = String(r.targetPath || "").split("/");
      const parentPostId = parts[0] === "posts" ? parts[1] || "" : "";
      return `
        <div class="report-item" data-report-id="${esc(d.id)}">
          <div class="report-reason">${esc(r.reason)}</div>
          <div>${esc(r.targetType)} · ${formatRelative(r.createdAt)}</div>
          ${r.note ? `<div class="community-status">${esc(r.note)}</div>` : ""}
          <div class="report-actions">
            <button type="button" data-moderate="remove"
              data-target-type="${esc(r.targetType)}"
              data-target-id="${esc(r.targetId)}"
              data-post-id="${esc(r.targetType === "comment" ? parentPostId : "")}">Ocultar</button>
            <button type="button" data-resolve="resolved">Resolver</button>
            <button type="button" data-resolve="dismissed">Descartar</button>
          </div>
        </div>`;
    }).join("");
  } catch (error) {
    console.error("Error cargando reportes:", error);
    el.reportList.innerHTML = '<p class="community-status">No se pudieron cargar los reportes.</p>';
  }
}

async function handleResolve(reportId, status) {
  try {
    await resolveReport({ reportId, status });
    toast("Reporte actualizado.", "success");
    await loadReports();
  } catch (error) {
    console.error(error);
    toast("No se pudo actualizar el reporte.", "error");
  }
}

async function handleModerate(targetType, targetId, postId, action) {
  try {
    await moderateContent({ targetType, targetId, postId: postId || null, action });
    toast("Contenido ocultado.", "success");
    await loadReports();
  } catch (error) {
    console.error(error);
    toast("No se pudo moderar el contenido.", "error");
  }
}

/* -------------------------------- auth ------------------------------ */

function updateAuthUi() {
  const signedIn = !!state.user;
  el.newPostBtn.hidden = !signedIn;
  el.loginPromptLink.hidden = signedIn;
  el.commentComposer.hidden = !signedIn;
  el.commentLoginPrompt.hidden = signedIn;
  if (!signedIn) el.commentComposer.hidden = true;
  el.modPanel.hidden = !isMod();
}

onAuthStateChanged(auth, async (user) => {
  state.user = user || null;
  state.role = null;
  if (user) {
    try {
      const token = await user.getIdTokenResult();
      state.role = token.claims.role || null;
    } catch (error) {
      console.error("No se pudieron leer los claims:", error);
    }
  }
  updateAuthUi();
  if (isMod()) loadReports();
});

/* ------------------------------ nuevo hilo -------------------------- */

async function submitNewPost(event) {
  event.preventDefault();
  el.newPostError.hidden = true;
  const title = el.postTitle.value.trim();
  const body = el.postBody.value.trim();
  const spaceId = el.postSpace.value;
  const tags = Array.from(el.newPostForm.querySelectorAll('input[name="tags"]:checked')).map((i) => i.value);

  if (title.length < 3) {
    el.newPostError.textContent = "El título es demasiado corto.";
    el.newPostError.hidden = false;
    return;
  }
  if (!body) {
    el.newPostError.textContent = "El contenido no puede estar vacío.";
    el.newPostError.hidden = false;
    return;
  }

  const submitBtn = el.newPostForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const res = await createPost({ spaceId, title, body, tags });
    el.newPostDialog.close();
    el.newPostForm.reset();
    await loadSpaces();
    navigate({ postId: res.data.id });
    toast("Hilo publicado.", "success");
  } catch (error) {
    console.error("Error al publicar:", error);
    el.newPostError.textContent = error?.message || "No se pudo publicar el hilo.";
    el.newPostError.hidden = false;
  } finally {
    submitBtn.disabled = false;
  }
}

/* ------------------------------- router ----------------------------- */

function navigate({ space, postId, replace = false } = {}) {
  const params = new URLSearchParams();
  if (space !== undefined) state.spaceSlug = space || null;
  if (state.spaceSlug) params.set("espacio", state.spaceSlug);
  if (postId) params.set("hilo", postId);
  const url = `/es/comunidad/${params.toString() ? `?${params}` : ""}`;
  if (replace) history.replaceState({ space: state.spaceSlug, postId }, "", url);
  else history.pushState({ space: state.spaceSlug, postId }, "", url);

  if (postId) {
    openPost(postId);
  } else {
    el.viewPost.hidden = true;
    el.viewFeed.hidden = false;
    state.currentPost = null;
    state.lastDoc = null;
    renderSpaces();
    loadFeed();
  }
}

function applyRoute() {
  const params = new URLSearchParams(location.search);
  state.spaceSlug = params.get("espacio") || null;
  const postId = params.get("hilo");
  if (postId) openPost(postId);
  else {
    el.viewPost.hidden = true;
    el.viewFeed.hidden = false;
    renderSpaces();
    loadFeed();
  }
}

/* ---------------------------- event wiring -------------------------- */

document.addEventListener("click", (event) => {
  const voteBtn = event.target.closest("[data-vote]");
  if (voteBtn) {
    event.preventDefault();
    handleVote(
      voteBtn.dataset.targetType,
      voteBtn.dataset.postId,
      voteBtn.dataset.commentId,
      voteBtn.dataset.vote
    );
    return;
  }

  const openLink = event.target.closest("[data-open-post]");
  if (openLink) {
    event.preventDefault();
    navigate({ postId: openLink.dataset.postId });
    return;
  }

  const replyBtn = event.target.closest("[data-reply]");
  if (replyBtn) {
    state.replyTo = { id: replyBtn.dataset.commentId, author: replyBtn.dataset.author };
    updateReplyHint();
    el.commentBody.focus();
    return;
  }

  const reportBtn = event.target.closest("[data-report]");
  if (reportBtn) {
    if (!state.user) {
      toast("Inicia sesión para reportar.", "error");
      return;
    }
    openReportDialog({
      targetType: reportBtn.dataset.targetType,
      targetId: reportBtn.dataset.targetType === "post" ? reportBtn.dataset.postId : reportBtn.dataset.commentId,
      postId: reportBtn.dataset.postId,
    });
    return;
  }

  const resolveBtn = event.target.closest("[data-resolve]");
  if (resolveBtn) {
    const item = resolveBtn.closest("[data-report-id]");
    handleResolve(item.dataset.reportId, resolveBtn.dataset.resolve);
    return;
  }

  const moderateBtn = event.target.closest("[data-moderate]");
  if (moderateBtn) {
    handleModerate(
      moderateBtn.dataset.targetType,
      moderateBtn.dataset.targetId,
      moderateBtn.dataset.postId,
      moderateBtn.dataset.moderate
    );
    return;
  }

  const spaceLink = event.target.closest(".space-link");
  if (spaceLink) {
    event.preventDefault();
    navigate({ space: spaceLink.dataset.space || null });
  }
});

el.loadMoreBtn.addEventListener("click", () => loadFeed({ append: true }));
el.backToFeed.addEventListener("click", () => navigate({ postId: null, space: state.spaceSlug }));
el.submitComment.addEventListener("click", submitComment);
el.cancelReplyBtn.addEventListener("click", () => {
  state.replyTo = null;
  updateReplyHint();
});
el.newPostBtn.addEventListener("click", () => {
  el.newPostError.hidden = true;
  el.newPostForm.reset();
  fillSpaceSelect();
  el.newPostDialog.showModal();
});
el.cancelPost.addEventListener("click", () => el.newPostDialog.close());
el.newPostForm.addEventListener("submit", submitNewPost);
el.reportForm.addEventListener("submit", submitReport);
el.cancelReport.addEventListener("click", () => el.reportDialog.close());

document.querySelectorAll(".feed-sort-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.sort = btn.dataset.sort;
    document.querySelectorAll(".feed-sort-btn").forEach((b) => {
      const active = b === btn;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", String(active));
    });
    state.lastDoc = null;
    loadFeed();
  });
});

window.addEventListener("popstate", applyRoute);

/* -------------------------------- init ------------------------------ */

loadSpaces();
applyRoute();
