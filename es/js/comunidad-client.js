// comunidad-client.js
// Sesión, perfil, compositor de hilo y comentarios de la Comunidad Lixby (solo cliente).
// El SSR sirve HTML público y cacheado; el estado de sesión se pinta aquí, en
// el hueco <div id="lx-session"> del layout, el compositor en
// <div id="lx-composer"> de la vista de espacio y los comentarios en
// <section id="lx-comments"> de la vista de hilo. La caché nunca ve datos de usuario.
// - DOM seguro: textContent, nunca innerHTML.
// - El cliente jamás envía el uid: communitySaveProfile, communityCreatePost y
//   communityCreateComment lo sacan del token.
// - avatarUrl: el callable lo acepta, pero aquí NO se pinta (una URL externa
//   permitiría rastrear a quien ve el hilo; img-src ya lo bloquearía).

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, connectAuthEmulator, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, serverTimestamp, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js";

// Config pública (igual que es/cuenta/index.html).
const firebaseConfig = {
  apiKey: "AIzaSyCPU-jsIupu3lsRrknmlv04A3YnBwXeePU",
  authDomain: "lixby0.firebaseapp.com",
  projectId: "lixby0",
  storageBucket: "lixby0.firebasestorage.app",
  messagingSenderId: "1058088945026",
  appId: "1:1058088945026:web:c56eaa9c71f1ca625fbb9b",
  measurementId: "G-689VDV93C2"
};

// ¿Estamos en local (emuladores)? Inerte en producción: lixby.es no es ni
// 127.0.0.1 ni localhost.
const IS_EMU = location.hostname === "127.0.0.1" || location.hostname === "localhost";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, "europe-west1"); // los callables de comunidad

// Solo en local: apunta Auth/Firestore/Functions a 127.0.0.1.
if (IS_EMU) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

const saveProfile = httpsCallable(functions, "communitySaveProfile");
const createPost = httpsCallable(functions, "communityCreatePost");
const createComment = httpsCallable(functions, "communityCreateComment");
const trackView = httpsCallable(functions, "communityTrackView");

const nfmt = new Intl.NumberFormat("es-ES", { notation: "compact" });

const TAGS = [
  ["pregunta", "Pregunta"],
  ["idea", "Idea"],
  ["bug", "Bug"],
  ["showcase", "Showcase"],
];
const ID_RE = /^[A-Za-z0-9]{1,40}$/;
const SLUG_RE = /^[a-z0-9-]{1,40}$/;

let signedIn = false; // hay sesión, correo verificado y perfil listo
let hasSession = false; // hay usuario autenticado (con o sin perfil)
let currentUser = null; // usuario de Firebase de la sesión actual
let profileName = ""; // displayName del perfil, para pintar el comentario nuevo

const root = document.getElementById("lx-session");

// Mensajes de error por código de los callables (el servidor responde en
// español; aquí solo traducimos los códigos que el SDK prefija con "functions/").
const ERR_TEXT = {
  "functions/resource-exhausted": "Has hecho demasiadas acciones seguidas. Inténtalo más tarde.",
  "functions/unauthenticated": "Inicia sesión para continuar.",
  "functions/permission-denied": "No tienes permisos para esta acción.",
  "functions/not-found": "El contenido ya no está disponible.",
  "functions/failed-precondition": "Esta acción no está disponible ahora mismo.",
  "functions/invalid-argument": "Revisa los datos e inténtalo de nuevo.",
  "functions/unavailable": "El servicio no está disponible. Inténtalo más tarde.",
};

function errText(error, fallback) {
  // El servidor ya responde en español. Para invalid-argument preferimos su
  // mensaje concreto (p. ej. el aviso del filtro de moderación) al genérico.
  const serverMessage =
    typeof error?.message === "string"
      ? error.message.replace(/^FirebaseError:\s*/, "").trim()
      : "";
  // invalid-argument (filtro de moderación) y failed-precondition (correo sin
  // verificar, hilo cerrado…) traen mensajes concretos y ya en español: se
  // prefieren al genérico de ERR_TEXT para que el aviso sea claro.
  if (error?.code === "functions/invalid-argument" && serverMessage) return serverMessage;
  if (error?.code === "functions/failed-precondition" && serverMessage) return serverMessage;
  if (error?.code && ERR_TEXT[error.code]) return ERR_TEXT[error.code];
  return serverMessage || fallback;
}

function el(tag, props = {}, ...children) {
  const n = document.createElement(tag);
  Object.assign(n, props);
  n.append(...children);
  return n;
}

// Iconos (mismo trazo que el SSR) para los botones que inserta el cliente en los
// comentarios nuevos. Se construyen con createElementNS: nunca innerHTML.
const ICON_D = {
  heart:
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z",
  comment:
    "M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z",
  views: "M12 20V10M18 20V4M6 20v-4",
  share: "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13",
};

function svgIcon(d) {
  const NS = "http://www.w3.org/2000/svg";
  const s = document.createElementNS(NS, "svg");
  for (const [k, v] of Object.entries({
    viewBox: "0 0 24 24", width: "20", height: "20", fill: "none",
    stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round",
    "stroke-linejoin": "round", "aria-hidden": "true",
  })) s.setAttribute(k, v);
  const p = document.createElementNS(NS, "path");
  p.setAttribute("d", d);
  s.append(p);
  return s;
}

function loginUrl() {
  const next = location.pathname + location.search;
  return `/es/iniciar-sesion/?next=${encodeURIComponent(next)}`;
}

// ---- Correo verificado ----------------------------------------------------
// Las callables que escriben (perfil, hilo, comentario, reporte) exigen correo
// verificado. Sin él la sesión "está" pero no puede participar: el nav y el
// compositor muestran un aviso con un botón para reenviar el enlace.
const VERIFY_TEXT =
  "Verifica tu correo para participar. Te enviamos un enlace al registrarte.";
const emailActionSettings = {
  url: `${location.origin}/es/verificado/`,
  handleCodeInApp: false,
};

function isVerified(user) {
  return !!user && user.emailVerified === true;
}

function buildVerifyResend(user) {
  const btn = el("button", { type: "button", className: "btn btn-primary", textContent: "Reenviar correo" });
  const msg = el("small", { className: "lx-verify-msg", role: "status" });
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    msg.textContent = "";
    try {
      await sendEmailVerification(user, emailActionSettings);
      msg.textContent = "Correo enviado. Revisa tu bandeja (y la carpeta de spam).";
    } catch (e) {
      msg.textContent = e?.code || "No se pudo enviar el correo.";
    }
    btn.disabled = false;
  });
  return el("div", { className: "lx-verify-actions" }, btn, msg);
}

function buildVerifyNotice(user, text) {
  return el("div", { className: "lx-verify-prompt" },
    el("p", { className: "lx-verify-text", textContent: text || VERIFY_TEXT }),
    buildVerifyResend(user)
  );
}

// Lleva el foco al aviso de verificación. Si la página no tiene compositor ni
// formulario de comentario (inicio, normas, buscar), lo inserta al principio
// del contenido para que el botón "Verifica tu correo" del nav siempre haga algo.
function focusVerifyNotice(user) {
  let host =
    document.getElementById("lx-composer") ||
    document.getElementById("lx-comment-form");
  if (host) {
    host.replaceChildren(buildVerifyNotice(user));
  } else {
    host = document.createElement("div");
    host.className = "lx-verify-banner";
    host.replaceChildren(buildVerifyNotice(user));
    const main = document.querySelector(".community-main");
    if (main) main.prepend(host);
    else return;
  }
  host.scrollIntoView({ block: "center", behavior: "smooth" });
}

async function loadProfile(uid) {
  const snap = await getDoc(doc(db, "profiles", uid));
  return snap.exists() ? snap.data() : null;
}

function syncComposer() {
  const host = document.getElementById("lx-composer");
  if (!host) return; // solo existe en la vista de espacio
  const slug = host.dataset.space;
  if (!SLUG_RE.test(slug || "")) {
    host.replaceChildren();
    host.dataset.mode = "";
    return;
  }
  // login: sin sesión; unverified: sesión sin correo verificado; none: sesión
  // sin perfil (el formulario va en el nav).
  const mode = !hasSession
    ? "login"
    : signedIn
      ? "form"
      : currentUser && !isVerified(currentUser)
        ? "unverified"
        : "none";
  if (host.dataset.mode === mode) return; // ya montado
  host.dataset.mode = mode;
  if (mode === "form") host.replaceChildren(buildComposer(slug));
  else if (mode === "login") host.replaceChildren(buildLoginPrompt());
  else if (mode === "unverified") host.replaceChildren(buildVerifyNotice(currentUser));
  else host.replaceChildren();
}

// Sin sesión: el compositor invita a iniciar sesión (la lectura es pública).
function buildLoginPrompt() {
  return el("p", { className: "composer-login" },
    "¿Quieres abrir un hilo? ",
    el("a", { href: loginUrl(), textContent: "Inicia sesión" })
  );
}

function buildComposer(slug) {
  const title = el("input", {
    type: "text", id: "lx-title", minLength: 3, maxLength: 140, required: true,
    placeholder: "Título del hilo",
  });
  const body = el("textarea", {
    id: "lx-body", rows: 8, maxLength: 10000, required: true,
    placeholder: "Escribe tu mensaje (texto plano)",
  });
  const count = el("small", { textContent: "0 / 10000" });
  body.addEventListener("input", () => {
    count.textContent = `${body.value.length} / 10000`;
  });

  const tagBoxes = TAGS.map(([value, label]) => {
    const box = el("input", { type: "checkbox", value });
    return { box, node: el("label", {}, box, ` ${label} `) };
  });

  const btn = el("button", { type: "button", textContent: "Publicar hilo" });
  const status = el("p", { role: "alert" });

  btn.addEventListener("click", async () => {
    const t = title.value.trim();
    const b = body.value.trim();
    if (t.length < 3) { status.textContent = "El título es demasiado corto."; return; }
    if (!b) { status.textContent = "El contenido no puede estar vacío."; return; }

    const tags = tagBoxes.filter((x) => x.box.checked).map((x) => x.box.value);

    btn.disabled = true;
    // Progreso estimado: el callable no informa de avance, así que sube rápido
    // al principio y se frena en el 90% hasta que la respuesta llega (entonces
    // salta a 100% y se navega al hilo nuevo).
    status.dataset.state = "busy";
    let pct = 0;
    status.textContent = "Publicando… 0%";
    const tick = setInterval(() => {
      pct = Math.min(90, pct + Math.max(1, Math.round((90 - pct) / 8)));
      status.textContent = `Publicando… ${pct}%`;
    }, 250);

    try {
      const { data } = await createPost({ spaceId: slug, title: t, body: b, tags });
      if (!data || !ID_RE.test(data.id || "")) throw new Error("Respuesta inesperada.");
      clearInterval(tick);
      status.textContent = "Publicando… 100%";
      location.assign(`/es/comunidad/${slug}/${data.id}/`);
    } catch (e) {
      clearInterval(tick);
      delete status.dataset.state;
      status.textContent = errText(e, "No se pudo publicar el hilo.");
      btn.disabled = false;
    }
  });

  return el("section", {},
    el("h2", { textContent: "Nuevo hilo" }),
    title, body, count,
    el("div", {}, ...tagBoxes.map((x) => x.node)),
    btn, status
  );
}

// ── Comentarios (5c-1) ─────────────────────────────────────────────────────
// El SSR sirve la lista de comentarios ya renderizada (cacheada). El cliente
// solo añade el formulario raíz, muestra/oculta los botones "Responder" y, al
// enviar, inserta el comentario nuevo en el DOM sin recargar. Nada de datos de
// usuario viaja en el HTML del servidor.
function syncComments() {
  const section = document.getElementById("lx-comments");
  if (!section) return; // solo existe en la vista de hilo

  const locked = section.dataset.locked === "1";
  const canPost = signedIn && !locked;
  const needsVerify =
    hasSession && !signedIn && currentUser && !isVerified(currentUser);

  // Los botones "Responder" vienen ocultos del servidor: se revelan salvo en
  // hilos cerrados. Sin sesión, al pulsarlos se pide login (como en el hilo).
  section.querySelectorAll(".lx-reply").forEach((b) => {
    b.hidden = locked;
  });

  const host = document.getElementById("lx-comment-form");
  if (!host) return; // hilo cerrado: sin formulario raíz

  const mode = canPost ? "form" : needsVerify ? "unverified" : "none";
  if (host.dataset.mode === mode) return; // ya montado
  host.dataset.mode = mode;
  if (canPost) {
    host.replaceChildren(
      buildCommentForm(section.dataset.post, null, (c) => {
        insertComment(c);
      })
    );
  } else if (needsVerify) {
    host.replaceChildren(buildVerifyNotice(currentUser));
  } else {
    host.replaceChildren();
  }
}

// Formulario de comentario/ respuesta. parentId = null → comentario raíz.
function buildCommentForm(postId, parentId, onSent) {
  const body = el("textarea", {
    rows: 3, maxLength: 5000, required: true,
    placeholder: parentId ? "Escribe tu respuesta (texto plano)" : "Escribe un comentario (texto plano)",
  });
  body.setAttribute("aria-label", parentId ? "Escribir una respuesta" : "Escribir un comentario");
  const btn = el("button", { type: "button", className: "btn btn-primary", textContent: "Comentar" });
  const status = el("p", { role: "alert", className: "comment-composer-status" });

  btn.addEventListener("click", async () => {
    const text = body.value.trim();
    if (!text) { status.textContent = "El comentario no puede estar vacío."; return; }
    btn.disabled = true;
    // Progreso estimado (el callable no informa de avance): sube rápido y se
    // frena en el 90% hasta que llega la respuesta. En azul, no en rojo.
    status.dataset.state = "busy";
    let pct = 0;
    status.textContent = "Enviando… 0%";
    const tick = setInterval(() => {
      pct = Math.min(90, pct + Math.max(1, Math.round((90 - pct) / 8)));
      status.textContent = `Enviando… ${pct}%`;
    }, 250);
    try {
      const payload = { postId, body: text };
      if (parentId) payload.parentCommentId = parentId;
      const { data } = await createComment(payload);
      if (!data || !ID_RE.test(data.id || "")) throw new Error("Respuesta inesperada.");
      clearInterval(tick);
      status.textContent = "Enviando… 100%";
      onSent({ id: data.id, body: text, parentId: parentId || null });
      body.value = "";
      delete status.dataset.state;
      status.textContent = "";
      btn.disabled = false;
    } catch (e) {
      clearInterval(tick);
      delete status.dataset.state;
      status.textContent = errText(e, "No se pudo enviar el comentario.");
      btn.disabled = false;
    }
  });

  return el("div", { className: "comment-composer" },
    body,
    el("div", { className: "comment-composer-actions" }, btn),
    status
  );
}

// Inserta en el DOM el comentario recién creado (mismo marcado que el SSR).
function insertComment({ id, body, parentId }) {
  const section = document.getElementById("lx-comments");
  if (!section) return;

  const dot = () => {
    const s = el("span", { className: "dot" });
    s.setAttribute("aria-hidden", "true");
    return s;
  };

  const header = el("div", { className: "comment-header" },
    el("strong", { textContent: profileName || "Usuario" }),
    dot(),
    el("span", { textContent: "ahora" })
  );

  const bodyEl = el("div", { className: "comment-body" });
  String(body).split(/\n{2,}/).forEach((para) => {
    const p = el("p");
    para.split("\n").forEach((line, i) => {
      if (i) p.append(el("br"));
      p.append(document.createTextNode(line));
    });
    bodyEl.append(p);
  });

  // Barra del comentario (mismo marcado que el SSR): me gusta · respuestas ·
  // visitas · compartir. El cliente delega los clics.
  const like = el("button", { type: "button", className: "lx-act lx-like lx-comment-like" });
  like.dataset.comment = id;
  like.setAttribute("aria-pressed", "false");
  like.setAttribute("aria-label", "Me gusta");
  const score = el("span", { className: "lx-comment-score", textContent: "0" });
  score.dataset.n = "0";
  like.append(svgIcon(ICON_D.heart), score);

  const reply = el("button", { type: "button", className: "lx-act lx-reply" });
  reply.dataset.comment = id;
  reply.setAttribute("aria-label", "Responder");
  const replyCount = el("span", { className: "lx-reply-count", textContent: "0" });
  replyCount.dataset.n = "0";
  reply.append(svgIcon(ICON_D.comment), replyCount);
  reply.hidden = !signedIn || section.dataset.locked === "1";

  const views = el("span", { className: "lx-act lx-comment-views" });
  views.dataset.comment = id;
  views.setAttribute("aria-label", "Visitas");
  views.append(
    svgIcon(ICON_D.views),
    el("span", { className: "lx-comment-views-n", textContent: "0" })
  );

  const share = el("button", { type: "button", className: "lx-act lx-comment-share" });
  share.dataset.comment = id;
  share.setAttribute("aria-label", "Compartir");
  share.append(svgIcon(ICON_D.share));

  const actions = el("div", { className: "comment-actions" }, like, reply, views, share);

  const article = el("article", { className: "comment", id: `c-${id}` },
    header, bodyEl, actions
  );

  if (parentId) {
    const parent = document.getElementById(`c-${parentId}`);
    if (!parent) return;
    let children = parent.querySelector(".comment-children");
    if (!children) {
      children = el("div", { className: "comment-children" });
      parent.append(children);
    }
    children.append(article);
    // El contador del SSR cuenta todo el subárbol: suma 1 a todos los ancestros.
    let anc = parent;
    while (anc) {
      const rc = anc.querySelector(":scope > .comment-actions .lx-reply-count");
      if (rc) {
        const n = (Number(rc.dataset.n) || 0) + 1;
        rc.dataset.n = String(n);
        rc.textContent = nfmt.format(n);
      }
      anc = anc.parentElement?.closest(".comment") || null;
    }
  } else {
    const list = document.getElementById("lx-comment-list");
    if (!list) return;
    document.getElementById("lx-no-comments")?.remove();
    list.append(article);
  }
}

// Un único listener delegado para los botones "Responder" y "me gusta" del hilo.
const commentsSection = document.getElementById("lx-comments");
if (commentsSection) {
  commentsSection.addEventListener("click", (ev) => {
    const like = ev.target.closest(".lx-comment-like");
    if (like && commentsSection.contains(like)) { onCommentLike(like); return; }

    const share = ev.target.closest(".lx-comment-share");
    if (share && commentsSection.contains(share)) { onCommentShare(share); return; }

    const btn = ev.target.closest(".lx-reply");
    if (!btn || !commentsSection.contains(btn)) return;
    if (commentsSection.dataset.locked === "1") return;
    if (!signedIn) {
      // Con sesión pero sin correo verificado no se redirige a login: el aviso
      // (y el botón de reenviar) está en #lx-comment-form.
      if (hasSession && currentUser && !isVerified(currentUser)) {
        focusVerifyNotice(currentUser);
        return;
      }
      location.assign(loginUrl());
      return;
    }

    const item = btn.closest(".comment");
    if (!item) return;
    const commentId = btn.dataset.comment;
    if (!ID_RE.test(commentId || "")) return;

    // Segundo clic en "Responder": cierra el formulario abierto.
    const open = item.querySelector(".lx-reply-form");
    if (open) { open.remove(); return; }

    const form = buildCommentForm(commentsSection.dataset.post, commentId, (c) => {
      insertComment(c);
      form.remove();
    });
    form.classList.add("lx-reply-form");
    const children = item.querySelector(".comment-children");
    if (children) item.insertBefore(form, children);
    else item.append(form);
  });

  // Cuenta una visita por comentario visto (una por sesión del navegador).
  trackCommentViews(commentsSection.dataset.post);
}

// ---------- Barra de acciones (hilo y tarjetas del feed) ----------
// Una misma barra sirve para el hilo y para cada tarjeta: compartir, me gusta y
// (solo en el hilo) conteo de visita. Cada barra lleva data-post/data-slug.
function flash(msg, scope) {
  const f =
    (scope && scope.querySelector && scope.querySelector(".lx-flash")) ||
    document.querySelector(".lx-flash");
  if (!f) return;
  f.textContent = msg;
  clearTimeout(f._flashTimer);
  f._flashTimer = setTimeout(() => { f.textContent = ""; }, 2500);
}

function setLikeUI(bar, on) {
  const b = bar.querySelector(".lx-like");
  if (b) b.setAttribute("aria-pressed", String(on));
}

// El número que se ve al pulsar es una estimación local; se corrige al recargar.
function bumpScore(bar, on) {
  const s = bar.querySelector(".lx-post-score");
  if (!s) return;
  const current = Number(s.dataset.n ?? s.textContent.replace(/\D/g, "")) || 0;
  const updated = Math.max(0, current + (on ? 1 : -1));
  s.dataset.n = String(updated);
  s.textContent = nfmt.format(updated);
}

function shareUrl(bar) {
  const postId = bar.dataset.post;
  const slug = bar.dataset.slug;
  if (!ID_RE.test(postId || "") || !SLUG_RE.test(slug || "")) return null;
  return `${location.origin}/es/comunidad/${slug}/${postId}/`;
}

function initActionBar(bar) {
  const postId = bar.dataset.post;
  if (!ID_RE.test(postId || "")) return;

  const share = bar.querySelector(".lx-share");
  if (share) share.addEventListener("click", async () => {
    const url = shareUrl(bar);
    if (!url) return;
    try {
      if (navigator.share) { await navigator.share({ title: document.title, url }); return; }
      await navigator.clipboard.writeText(url);
      flash("Enlace copiado", bar);
    } catch (e) {
      if (e?.name !== "AbortError") flash(url, bar);
    }
  });

  const like = bar.querySelector(".lx-like");
  if (like) like.addEventListener("click", async () => {
    const u = auth.currentUser;
    if (!signedIn || !u) { location.assign(loginUrl()); return; }
    like.disabled = true;
    const next = like.getAttribute("aria-pressed") !== "true";
    const ref = doc(db, "posts", postId, "votes", u.uid);
    try {
      if (next) await setDoc(ref, { value: 1, createdAt: serverTimestamp() });
      else await deleteDoc(ref);
      setLikeUI(bar, next);
      bumpScore(bar, next);
    } catch (e) {
      flash(errText(e, "No se pudo registrar tu me gusta."), bar);
    }
    like.disabled = false;
  });

  // Visita: una por sesión del navegador y hilo, solo en la barra del hilo
  // (data-view="1"). En el feed no se cuentan impresiones.
  if (bar.dataset.view === "1") {
    try {
      const k = `lx-view:${postId}`;
      if (!sessionStorage.getItem(k)) {
        sessionStorage.setItem(k, "1");
        setTimeout(() => { trackView({ postId }).catch(() => {}); }, 2000);
      }
    } catch {}
  }
}

function bindActions() {
  document.querySelectorAll(".lx-actions").forEach(initActionBar);
}
bindActions();

// Recuerda si ya diste me gusta a cada barra visible (un getDoc por barra y solo
// con sesión). En el feed son como mucho PAGE_SIZE lecturas por carga.
async function syncVotes() {
  const bars = [...document.querySelectorAll(".lx-actions")];
  if (!bars.length) return;
  const u = auth.currentUser;
  if (!signedIn || !u) {
    bars.forEach((bar) => setLikeUI(bar, false));
    return;
  }
  await Promise.allSettled(
    bars.map(async (bar) => {
      const postId = bar.dataset.post;
      if (!ID_RE.test(postId || "")) return;
      const snap = await getDoc(doc(db, "posts", postId, "votes", u.uid));
      setLikeUI(bar, snap.exists() && snap.data().value === 1);
    })
  );
}

// ---------- Me gusta en los comentarios ----------
// Mismo patrón que el hilo: votos en posts/{postId}/comments/{commentId}/votes/{uid}
// con value:1. El contador se ajusta en local al pulsar y se corrige al recargar.
async function onCommentLike(btn) {
  const u = auth.currentUser;
  if (!signedIn || !u) { location.assign(loginUrl()); return; }
  const postId = commentsSection?.dataset.post;
  const commentId = btn.dataset.comment;
  if (!ID_RE.test(postId || "") || !ID_RE.test(commentId || "")) return;

  const liked = btn.getAttribute("aria-pressed") === "true";
  btn.disabled = true;
  const ref = doc(db, "posts", postId, "comments", commentId, "votes", u.uid);
  try {
    if (liked) await deleteDoc(ref);
    else await setDoc(ref, { value: 1, createdAt: serverTimestamp() });
    setCommentLikeUI(btn, !liked);
  } catch (e) {
    flash(errText(e, "No se pudo registrar tu me gusta."));
  }
  btn.disabled = false;
}

function setCommentLikeUI(btn, on) {
  btn.setAttribute("aria-pressed", String(on));
  const s = btn.querySelector(".lx-comment-score");
  if (!s) return;
  const current = Number(s.dataset.n ?? s.textContent.replace(/\D/g, "")) || 0;
  const updated = Math.max(0, current + (on ? 1 : -1));
  s.dataset.n = String(updated);
  s.textContent = nfmt.format(updated);
}

// Recuerda si ya diste me gusta a cada comentario visible. Hace un getDoc por
// comentario y solo con sesión (sin sesión no hay lecturas: se dejan a "false").
async function syncCommentLikes() {
  const btns = document.querySelectorAll(".lx-comment-like");
  if (!btns.length) return;
  const u = auth.currentUser;
  const postId = commentsSection?.dataset.post;
  if (!signedIn || !u || !ID_RE.test(postId || "")) {
    btns.forEach((b) => b.setAttribute("aria-pressed", "false"));
    return;
  }
  await Promise.allSettled(
    [...btns].map(async (b) => {
      const commentId = b.dataset.comment;
      if (!ID_RE.test(commentId || "")) return;
      const snap = await getDoc(doc(db, "posts", postId, "comments", commentId, "votes", u.uid));
      b.setAttribute("aria-pressed", String(snap.exists() && snap.data().value === 1));
    })
  );
}

// Compartir un comentario: enlace directo a su ancla (#c-id).
async function onCommentShare(btn) {
  const commentId = btn.dataset.comment;
  if (!ID_RE.test(commentId || "")) return;
  const url = `${location.origin}${location.pathname}#c-${commentId}`;
  try {
    if (navigator.share) { await navigator.share({ title: document.title, url }); return; }
    await navigator.clipboard.writeText(url);
    flash("Enlace copiado");
  } catch (e) {
    if (e?.name !== "AbortError") flash(url);
  }
}

// Visitas por comentario: una por sesión y solo cuando el comentario entra en
// pantalla (IntersectionObserver). Cifra aproximada. Sin la API no se cuenta.
function trackCommentViews(postId) {
  if (typeof IntersectionObserver !== "function" || !ID_RE.test(postId || "")) return;
  const seen = (id) => { try { return !!sessionStorage.getItem(`lx-cview:${id}`); } catch { return false; } };
  const mark = (id) => { try { sessionStorage.setItem(`lx-cview:${id}`, "1"); } catch {} };

  const io = new IntersectionObserver((entries, obs) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      obs.unobserve(e.target);
      const id = e.target.dataset.comment;
      if (!ID_RE.test(id || "") || seen(id)) continue;
      mark(id);
      setTimeout(() => { trackView({ postId, commentId: id }).catch(() => {}); }, 2000);
    }
  }, { rootMargin: "0px 0px 120px 0px" });

  document.querySelectorAll(".lx-comment-views").forEach((node) => {
    const id = node.dataset.comment;
    if (ID_RE.test(id || "") && !seen(id)) io.observe(node);
  });
}

// ==========================================================================
// SOLO PARA PRUEBAS EN LOCAL (emulador). No forma parte del sitio: fuera de
// 127.0.0.1/localhost nunca se monta. NO incluir en el commit.
// Login en un popup flotante abajo, con el estilo de Lixby. El nav queda limpio.
// ==========================================================================
let devLoginEl = null;

function setDevLoginOpen(open) {
  if (devLoginEl) devLoginEl.dataset.open = open ? "1" : "0";
}

// El emulador de Auth crea los usuarios con emailVerified=false; como las
// callables exigen correo verificado, los usuarios de prueba quedarían
// bloqueados. Se marcan como verificados con la API REST del emulador (solo en
// local: fuera de 127.0.0.1/localhost IS_EMU es false y no se ejecuta).
async function markEmulatorVerified(user) {
  if (!IS_EMU || !user) return;
  const base =
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=" +
    encodeURIComponent(firebaseConfig.apiKey);
  const body = { localId: user.uid, emailVerified: true };
  try {
    // El emulador acepta el endpoint de administración con "Bearer owner".
    let res = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      // Reintento con el token del propio usuario (por si la build del emulador
      // no acepta el modo administrador).
      const idToken = await user.getIdToken();
      res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, emailVerified: true }),
      });
    }
    await user.reload();
    await user.getIdToken(true); // refresca el token para que lleve email_verified
  } catch (e) {
    console.error("emulador: no se pudo marcar el correo como verificado", e);
  }
}

function renderDevLogin() {
  root.replaceChildren(); // el nav no muestra nada
  if (devLoginEl) return setDevLoginOpen(true);

  const email = el("input", { type: "email", placeholder: "email de prueba", autocomplete: "username" });
  const pass = el("input", { type: "password", placeholder: "contraseña", autocomplete: "current-password" });
  const msg = el("small", { className: "lx-devlog-msg", role: "status" });
  const go = (fn) => async () => {
    msg.textContent = "";
    try {
      const cred = await fn(auth, email.value.trim(), pass.value);
      await markEmulatorVerified(cred.user);
      renderSignedIn(cred.user, await loadProfile(cred.user.uid));
    } catch (e) {
      msg.textContent = e?.code || "Error";
    }
  };
  const enter = el("button", { type: "button", className: "btn-primary lx-devlog-enter", textContent: "Entrar (emulador)" });
  const create = el("button", { type: "button", className: "btn-secondary", textContent: "Crear cuenta" });
  enter.addEventListener("click", go(signInWithEmailAndPassword));
  create.addEventListener("click", go(createUserWithEmailAndPassword));

  const close = el("button", { type: "button", className: "lx-devlog-close", textContent: "×" });
  close.setAttribute("aria-label", "Cerrar");
  close.addEventListener("click", () => setDevLoginOpen(false));

  const trigger = el("button", { type: "button", className: "lx-devlog-trigger", textContent: "Acceso emulador" });
  trigger.addEventListener("click", () => setDevLoginOpen(true));

  const panel = el("div", { className: "lx-devlog-panel" },
    el("div", { className: "lx-devlog-head" },
      el("span", { className: "lx-devlog-badge", textContent: "Emulador" }),
      el("strong", { textContent: "Acceso de pruebas" }),
      close
    ),
    el("div", { className: "lx-devlog-row" }, email, pass),
    el("div", { className: "lx-devlog-actions" }, enter, create),
    msg
  );
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Acceso de pruebas (emulador)");

  devLoginEl = el("div", { className: "lx-devlog", id: "lx-devlog" }, trigger, panel);
  document.body.append(devLoginEl);
  setDevLoginOpen(true);
}

function renderSignedOut() {
  signedIn = false;
  hasSession = false;
  currentUser = null;
  profileName = "";
  const profileDialog = document.getElementById("lx-profile-dialog");
  if (profileDialog?.open) profileDialog.close();
  syncComposer();
  syncComments();
  syncVotes();
  syncCommentLikes();
  if (IS_EMU) return renderDevLogin();
  // Sin enlace de login en el nav: el acceso vive en el compositor.
  root.replaceChildren();
}

// El nav solo lleva botones (como el resto del sitio): el nombre se elige en
// un <dialog> centrado, nunca como formulario dentro de #lx-session.
function renderNoProfileNav(user) {
  const pick = el("button", { type: "button", textContent: "Elige tu nombre" });
  pick.addEventListener("click", () => openProfileDialog(user));
  const out = el("button", { type: "button", textContent: "Cerrar sesión" });
  out.addEventListener("click", () => signOut(auth));
  root.replaceChildren(pick, out);
}

function openProfileDialog(user) {
  // Sin correo verificado el callable communitySaveProfile rechaza guardar: no
  // tiene sentido abrir el diálogo. Se muestra el aviso con el reenvío.
  if (!isVerified(user)) {
    focusVerifyNotice(user);
    return;
  }
  const existing = document.getElementById("lx-profile-dialog");
  if (existing) {
    if (!existing.open) existing.showModal();
    return;
  }

  const input = el("input", {
    type: "text", id: "lx-name", maxLength: 40, minLength: 2,
    required: true, placeholder: "Nombre de usuario", autocomplete: "nickname",
  });
  const btn = el("button", { type: "button", className: "lx-dialog-save", textContent: "Guardar" });
  const status = el("p", { className: "lx-dialog-msg", role: "alert" });

  btn.addEventListener("click", async () => {
    const displayName = input.value.trim();
    if (displayName.length < 2) {
      status.textContent = "El nombre es demasiado corto.";
      return;
    }
    btn.disabled = true;
    status.textContent = "";
    try {
      await saveProfile({ displayName });
      const profile = await loadProfile(user.uid);
      dialog.close(); // el evento "close" retira el diálogo del DOM
      renderSignedIn(user, profile);
    } catch (e) {
      status.textContent = errText(e, "No se pudo guardar el perfil.");
      btn.disabled = false;
    }
  });

  const dialog = el("dialog", { className: "lx-dialog", id: "lx-profile-dialog" },
    el("h2", { textContent: "Elige tu nombre en la comunidad" }),
    el("label", { htmlFor: "lx-name", textContent: "Se verá en tus hilos y comentarios" }),
    input, btn, status
  );
  dialog.addEventListener("close", () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}

function renderSignedIn(user, profile) {
  hasSession = true;
  currentUser = user;
  if (IS_EMU && devLoginEl) setDevLoginOpen(false); // cierra el popup de pruebas
  if (!isVerified(user)) {
    // Sesión sin correo verificado: no se puede publicar ni guardar el perfil
    // (las callables lo rechazan). El nav muestra el aviso y el compositor y el
    // formulario de comentario explican cómo verificarlo.
    signedIn = false;
    profileName = "";
    syncComposer();
    syncComments();
    syncVotes();
    syncCommentLikes();
    const resend = el("button", { type: "button", textContent: "Verifica tu correo" });
    resend.addEventListener("click", () => focusVerifyNotice(user));
    const out = el("button", { type: "button", textContent: "Cerrar sesión" });
    out.addEventListener("click", () => signOut(auth));
    root.replaceChildren(resend, out);
    return;
  }
  if (!profile?.displayName) {
    signedIn = false;
    profileName = "";
    syncComposer();
    syncComments();
    syncVotes();
    syncCommentLikes();
    renderNoProfileNav(user);
    openProfileDialog(user);
    return;
  }
  signedIn = true;
  profileName = profile.displayName;
  syncComposer();
  syncComments();
  syncVotes();
  syncCommentLikes();

  const out = el("button", { type: "button", textContent: "Cerrar sesión" });
  out.addEventListener("click", () => signOut(auth));
  root.replaceChildren(
    el("span", { className: "lx-name", textContent: profile.displayName }),
    out
  );

  document.dispatchEvent(
    new CustomEvent("lx:session", { detail: { uid: user.uid, displayName: profile.displayName } })
  );
}

if (root) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) return renderSignedOut();
    try {
      renderSignedIn(user, await loadProfile(user.uid));
    } catch (e) {
      console.error("perfil", e);
      renderSignedOut();
    }
  });
}