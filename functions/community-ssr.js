// community-ssr.js
// SSR de la Comunidad Lixby (2ª generación, europe-west1).
// Firebase Hosting envía /<idioma>/comunidad/** aquí vía rewrite (firebase.json).
//
// Notas:
// - El Admin SDK ignora las reglas de Firestore, así que cualquier render de
//   contenidos de usuarios DEBE filtrar `status === "published"` (los hilos y
//   comentarios retirados siguen estando en la BBDD).
// - Todo lo que venga de Firestore pasa por esc() para evitar XSS.
// - Caché corta (5 min en CDN) a propósito: permite retirar contenido rápido
//   en producción mientras no haya moderación.
// - Multilenguaje: el nav y el pie salen de functions/community-layouts.json
//   (extraídos de cada <idioma>/index.html) y los textos de functions/i18n/.
//   El segmento propio de la comunidad es siempre "comunidad" (y "buscar" /
//   "normas" dentro), igual en todos los idiomas.
// - Los assets compartidos (comunidad.css y el cliente) se sirven desde la ruta
//   canónica /es/… en todos los idiomas: son idénticos y así se cachean una sola
//   vez; /<idioma>/style.css y /<idioma>/main.js sí son de cada idioma.

const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { t, layoutFor, sitePath, TAGS, tagLabel, LANGS } = require("./community-i18n");

if (!getApps().length) initializeApp();
const db = getFirestore();

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

// JSON-LD seguro: < siempre se escapa para que el contenido de usuario no
// pueda cerrar la etiqueta <script> del bloque de datos estructurados.
const safeJson = (o) => JSON.stringify(o).replace(/</g, "\\u003c");

// CSP de las paginas SSR. Se emite desde la funcion porque Firebase Hosting NO
// aplica los headers de firebase.json a las respuestas de rewrites hacia Cloud
// Functions (verificado en el emulador). Cubre el HTML servido + el cliente de
// sesion (/es/js/comunidad-client.js) + el SDK de Firebase desde gstatic y la
// tipografia Inter (que el index carga desde Google Fonts).
const COMMUNITY_CSP = [
  "default-src 'self'",
  "script-src 'self' https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self' https://firestore.googleapis.com wss://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://europe-west1-lixby0.cloudfunctions.net",
  "object-src 'none'",
  "base-uri 'self'",
  // Clickjacking: nadie puede incrustar la comunidad en un iframe.
  "frame-ancestors 'none'",
  // Los formularios solo pueden enviarse al propio sitio.
  "form-action 'self'",
].join("; ");

// Cabeceras de seguridad de las respuestas del SSR. Firebase Hosting NO aplica
// los headers de firebase.json a los rewrites hacia Cloud Functions (por eso la
// CSP también se emite desde aquí). X-Frame-Options refuerza frame-ancestors en
// navegadores antiguos y HSTS asegura HTTPS también en estas rutas.
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

// ── Chrome del sitio (nav + footer) por idioma ─────────────────────────────
// El nav y el pie salen de cada <idioma>/index.html (community-layouts.json):
// así llegan ya traducidos y con las rutas propias de cada idioma. Aquí solo se
// inyectan dos cosas: el enlace a la comunidad en el menú y el hueco de sesión
// (#lx-session), que rellena comunidad-client.js.

function renderNav(lang) {
  let nav = layoutFor(lang).nav || "";
  const link = `<a href="/${lang}/comunidad/" class="nav-link">${esc(t(lang, "community"))}</a>`;
  if (/<nav class="nav-links"[^>]*>/.test(nav) && !nav.includes("/comunidad/")) {
    nav = nav.replace(
      /(<nav class="nav-links"[^>]*>[\s\S]*?)(<\/nav>)/,
      (_m, open, close) => `${open}${link}${close}`
    );
  }
  if (/<div class="nav-actions">/.test(nav) && !nav.includes('id="lx-session"')) {
    nav = nav.replace(/(<div class="nav-actions">)/, `$1<div id="lx-session"></div>`);
  }
  return nav;
}

function renderFooter(lang) {
  return layoutFor(lang).footer || "";
}

// ── Formato por idioma ─────────────────────────────────────────────────────
const LOCALE = (lang) => (lang === "pt" ? "pt-PT" : lang === "sv" ? "sv-SE" : lang);
const DT_CACHE = new Map();
const NF_CACHE = new Map();
function fmtDate(lang, ts) {
  if (!ts || !ts.toDate) return "";
  const key = LOCALE(lang);
  if (!DT_CACHE.has(key)) {
    DT_CACHE.set(key, new Intl.DateTimeFormat(key, { dateStyle: "medium", timeZone: "Atlantic/Canary" }));
  }
  return DT_CACHE.get(key).format(ts.toDate());
}
const iso = (ts) => (ts && ts.toDate ? ts.toDate().toISOString() : undefined);
function fmtN(lang, n) {
  const key = LOCALE(lang);
  if (!NF_CACHE.has(key)) {
    NF_CACHE.set(key, new Intl.NumberFormat(key, { notation: "compact" }));
  }
  return NF_CACHE.get(key).format(Number(n) || 0);
}

const paragraphs = (txt) =>
  String(txt ?? "")
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

const tagList = (lang, tags) =>
  (tags || []).map((tag) => `<span class="post-tag">${esc(tagLabel(lang, tag))}</span>`).join("");

const excerpt = (txt) => {
  const s = String(txt ?? "").replace(/\s+/g, " ").trim();
  return s.length > 180 ? `${s.slice(0, 180)}…` : s;
};

// ── Config del cliente (lang + rutas + textos) ─────────────────────────────
// Viaja en el atributo data-lx-config de <main>. El cliente lo lee y lo usa
// para los textos y para construir sus enlaces (login, verificado, comunidad).
const CLIENT_KEYS = [
  "err_resource_exhausted", "err_unauthenticated", "err_permission_denied",
  "err_not_found", "err_failed_precondition", "err_invalid_argument",
  "err_unavailable", "verify_text", "verify_nav", "resend", "resend_sent",
  "resend_error", "logout", "choose_name", "profile_title", "profile_label",
  "name_ph", "save", "name_short", "save_error", "new_thread", "title_ph",
  "body_ph", "publish", "title_short", "body_empty", "publishing",
  "publish_error", "open_thread", "login_link", "comment_ph", "reply_ph",
  "comment_aria", "reply_aria", "comment_btn", "comment_empty", "sending",
  "comment_error", "user", "now", "link_copied", "like_error",
  "tag_pregunta", "tag_idea", "tag_bug", "tag_showcase",
];

function clientConfig(lang) {
  const tr = {};
  for (const key of CLIENT_KEYS) tr[key] = t(lang, key);
  return {
    lang,
    base: `/${lang}/comunidad/`,
    login: `/${lang}/${sitePath(lang, "login")}/`,
    verified: `/${lang}/${sitePath(lang, "verified")}/`,
    t: tr,
  };
}

// ── Layout ─────────────────────────────────────────────────────────────────
function layout({ lang, title, description, canonical, robots, jsonLd, body }) {
  const alt = LANGS.map((l) => {
    const p = canonical.replace(/^\/[a-z]{2}\//, `/${l}/`);
    return `<link rel="alternate" hreflang="${l}" href="https://lixby.es${esc(p)}">`;
  }).join("\n  ");
  const xdefault = canonical.replace(/^\/[a-z]{2}\//, "/en/");
  return `<!doctype html>
<html lang="${esc(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  ${robots ? `<meta name="robots" content="${esc(robots)}">` : ""}
  ${jsonLd ? `<script type="application/ld+json">${safeJson(jsonLd)}</script>` : ""}
  <link rel="canonical" href="https://lixby.es${esc(canonical)}">
  ${alt}
  <link rel="alternate" hreflang="x-default" href="https://lixby.es${esc(xdefault)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
  <link rel="icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/icon.png">
  <link rel="stylesheet" href="/${esc(lang)}/style.css">
  <link rel="stylesheet" href="/es/comunidad/comunidad.css">
</head>
<body>
  <div id="scroll-progress"></div>
  <div class="background-orb orb-1" aria-hidden="true"></div>
  <div class="background-orb orb-2" aria-hidden="true"></div>
  <div class="background-orb orb-3" aria-hidden="true"></div>
  <div class="background-orb orb-4" aria-hidden="true"></div>
  <div class="background-orb orb-5" aria-hidden="true"></div>${renderNav(lang)}
  <main class="community-main" data-lx-config="${esc(JSON.stringify(clientConfig(lang)))}">${body}</main>${renderFooter(lang)}
  <script src="/${esc(lang)}/main.js" defer></script>
  <script type="module" src="/es/js/comunidad-client.js" defer></script>
</body>
</html>`;
}

const ICON = {
  comment:
    "M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z",
  heart:
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z",
  views: "M12 20V10M18 20V4M6 20v-4",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.35-4.35",
  share:
    "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13",
  chevron: "m9 6 6 6-6 6",
};
const svg = (d) =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

// Barra de acciones reutilizable (hilo y tarjetas del feed). Sin datos de
// usuario: el estado "me gusta" y las visitas los pinta/enlaza el cliente.
// - thread: solo en el hilo se cuenta la visita al cargar (data-view="1").
function actionBar(lang, { postId, slug, score, comments, views, commentsHref, thread = false }) {
  return `<div class="lx-actions" data-post="${esc(postId)}" data-slug="${esc(slug)}"${thread ? ' data-view="1"' : ""}>
    <a class="lx-act" href="${esc(commentsHref)}" aria-label="${esc(t(lang, "comments_aria"))}">${svg(ICON.comment)}<span>${fmtN(lang, comments)}</span></a>
    <button type="button" class="lx-act lx-like" aria-pressed="false" aria-label="${esc(t(lang, "like"))}">${svg(ICON.heart)}<span class="lx-post-score" data-n="${Number(score) || 0}">${fmtN(lang, score)}</span></button>
    <span class="lx-act" aria-label="${esc(t(lang, "views"))}">${svg(ICON.views)}<span class="lx-post-views">${fmtN(lang, views)}</span></span>
    <button type="button" class="lx-act lx-share" aria-label="${esc(t(lang, "share"))}">${svg(ICON.share)}</button>
    <span class="lx-flash" role="status"></span>
  </div>`;
}

// Tarjeta de hilo (feed de espacio y resultados del buscador). Con showSpace
// añade un enlace al espacio (útil cuando los resultados mezclan espacios).
function postCard(lang, { id, slug, post, views, showSpace = false, spaceName = "" }) {
  const href = `/${lang}/comunidad/${esc(slug)}/${esc(id)}/`;
  const space =
    showSpace && spaceName
      ? `<a class="post-space" href="/${lang}/comunidad/${esc(slug)}/">${esc(spaceName)}</a>
            <span class="dot" aria-hidden="true"></span>`
      : "";
  return `<article class="post-card">
        <div class="post-main">
          <h3 class="post-title"><a href="${href}">${esc(post.title)}</a></h3>
          <p class="post-excerpt">${esc(excerpt(post.body))}</p>
          ${actionBar(lang, {
            postId: id,
            slug,
            score: post.score,
            comments: post.commentCount,
            views,
            commentsHref: `${href}#lx-comments`,
          })}
          <div class="post-meta">
            ${space}<span>${esc(post.authorName)}</span>
            <span class="dot" aria-hidden="true"></span>
            <span>${esc(fmtDate(lang, post.lastActivityAt))}</span>
            ${tagList(lang, post.tags)}
          </div>
        </div>
      </article>`;
}

// ── Render de vistas ───────────────────────────────────────────────────────
async function listSpaces() {
  const snap = await db.collection("spaces").get();
  return snap.docs
    .map((d) => ({ slug: d.id, ...d.data() }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

// Caja de búsqueda (se envía por GET a la página de resultados).
function searchBox(lang, { q = "", compact = true } = {}) {
  return `<form class="community-search${compact ? " is-compact" : ""}" action="/${lang}/comunidad/buscar/" method="get" role="search">
    <input type="search" name="q" value="${esc(q)}" placeholder="${esc(t(lang, "search_ph"))}" aria-label="${esc(t(lang, "search_aria"))}" autocomplete="off">
    <button type="submit" aria-label="${esc(t(lang, "search"))}">${svg(ICON.search)}</button>
  </form>`;
}

// Icono de un espacio. Cada espacio usa imagen en vez de emoji; la imagen puede
// venir del documento (`image`) o de este mapa por slug (mismo criterio que el
// resto del sitio). El emoji queda sólo como último recurso. Las imágenes se
// sirven del propio idioma (cada /<idioma>/images tiene las mismas).
const SPACE_IMAGE_FILES = {
  general: "Chat.png",
  lixbuds: "lixbuds-one-white.png",
  lixney: "lixneyicon2.webp",
  lixfly: "lixflyicon2.webp",
  ideas: "Bombilla.png",
  soporte: "Mano.png",
};
function spaceIcon(lang, space, cls = "space-emoji") {
  // Las imágenes guardadas en el documento vienen con el prefijo de idioma que
  // se usó al sembrarlas (/es/images/…): se reescribe al idioma de la página
  // para servir /<lang>/images/… (cada idioma tiene sus propias imágenes).
  let src = space.image || "";
  const prefixed = src.match(/^\/[a-z]{2}\/(.+)$/);
  if (prefixed) src = `/${lang}/${prefixed[1]}`;
  if (!src) {
    const file = SPACE_IMAGE_FILES[space.slug];
    if (file) src = `/${lang}/images/${file}`;
  }
  if (src) {
    return `<img class="${cls}" src="${esc(src)}" alt="" aria-hidden="true" loading="lazy" decoding="async">`;
  }
  return `<span class="${cls}" aria-hidden="true">${esc(space.icon ?? "")}</span>`;
}

// Menú lateral de espacios (reutilizado por portada y vista de espacio).
function spaceSidebar(lang, spaces, activeSlug, q = "") {
  const items = spaces
    .map(
      (s) => `<a class="space-link${s.slug === activeSlug ? " is-active" : ""}" href="/${lang}/comunidad/${esc(s.slug)}/">
        ${spaceIcon(lang, s)}
        <span class="space-name">${esc(s.name)}</span>
      </a>`
    )
    .join("");
  return `<aside class="community-sidebar" aria-label="${esc(t(lang, "sidebar_spaces"))}">
    ${searchBox(lang, { q })}
    <p class="community-sidebar-title">${esc(t(lang, "sidebar_spaces"))}</p>
    <nav class="space-list">${items}</nav>
  </aside>`;
}

// Portada: rejilla de espacios + actividad global (últimos y mejor valorados),
// cómo participar y bloque legal. El feed global usa los mismos índices que el
// buscador (status+lastActivityAt y status+score).
const HOME_FEED = 6;
const HOME_TOP = 5;

// Enlaces legales/ayuda propios del idioma (es cambia de slug; el resto no).
const legalPrivacy = (lang) => `/${lang}/pages/legal/privacy/`;
const helpContact = (lang) => `/${lang}/${sitePath(lang, "contact")}/`;

async function renderHome(lang) {
  const spaces = await listSpaces();
  const spaceName = new Map(spaces.map((s) => [s.slug, s.name]));
  const cards = spaces
    .map(
      (s) => `<a class="space-card" href="/${lang}/comunidad/${esc(s.slug)}/">
        ${spaceIcon(lang, s, "space-card-emoji")}
        <span class="space-card-body">
          <strong>${esc(s.name)}</strong>
          <span>${esc(s.description ?? "")}</span>
        </span>
        <span class="space-card-arrow" aria-hidden="true">${svg(ICON.chevron)}</span>
      </a>`
    )
    .join("");

  const published = db.collection("posts").where("status", "==", "published");
  const [recentSnap, topSnap] = await Promise.all([
    published.orderBy("lastActivityAt", "desc").limit(HOME_FEED).get(),
    published.orderBy("score", "desc").limit(HOME_TOP).get(),
  ]);

  // Vistas de los hilos mostrados (una lectura por lote de postStats).
  const ids = [...new Set([...recentSnap.docs, ...topSnap.docs].map((d) => d.id))];
  const statsSnaps = ids.length
    ? await db.getAll(...ids.map((id) => db.collection("postStats").doc(id)))
    : [];
  const viewsById = new Map(
    statsSnaps.map((s) => [s.id, s.exists ? s.data().views || 0 : 0])
  );

  const card = (d) => {
    const p = d.data();
    return postCard(lang, {
      id: d.id,
      slug: p.spaceId,
      post: p,
      views: viewsById.get(d.id) || 0,
      showSpace: true,
      spaceName: spaceName.get(p.spaceId) || p.spaceId,
    });
  };
  const recentCards = recentSnap.docs.map(card).join("");
  const topCards = topSnap.docs.map(card).join("");

  const feedBlock = recentSnap.size
    ? `<div class="home-columns">
        <section class="home-block">
          <div class="home-block-head">
            <h2>${esc(t(lang, "recent"))}</h2>
            <a class="home-block-more" href="/${lang}/comunidad/buscar/">${esc(t(lang, "see_all"))}${svg(ICON.chevron)}</a>
          </div>
          <div class="post-list">${recentCards}</div>
        </section>
        <section class="home-block home-block-aside">
          <div class="home-block-head"><h2>${esc(t(lang, "top"))}</h2></div>
          <div class="post-list">${topCards}</div>
        </section>
      </div>`
    : "";

  const dsaP = t(lang, "dsa_p", {
    email: `<a href="mailto:info@lixby.es">info@lixby.es</a>`,
    contact: `<a href="${esc(helpContact(lang))}">${esc(t(lang, "contact_form"))}</a>`,
  });
  const privacyP = t(lang, "privacy_p", {
    policy: `<a href="${esc(legalPrivacy(lang))}">${esc(t(lang, "privacy_policy"))}</a>`,
  });

  return layout({
    lang,
    title: t(lang, "home_title"),
    description: t(lang, "home_desc"),
    canonical: `/${lang}/comunidad/`,
    body: `
      <section class="community-hero">
        <div class="community-hero-inner">
          <span class="badge">${esc(t(lang, "community"))}</span>
          <h1>${esc(t(lang, "community"))} <span class="grad">Lixby</span></h1>
          <p class="lead">${esc(t(lang, "home_desc"))}</p>
          ${searchBox(lang, { compact: false })}
        </div>
      </section>
      <div class="home-band">
        <section class="home-section">
          <div class="container">
            <section class="home-block">
              <div class="home-block-head">
                <h2>${esc(t(lang, "spaces"))}</h2>
                <a class="home-block-more" href="/${lang}/comunidad/buscar/">${esc(t(lang, "see_all"))}${svg(ICON.chevron)}</a>
              </div>
              <div class="space-grid">
                ${cards || `<p class="community-empty"><span class="empty-emoji">🫥</span>${esc(t(lang, "no_spaces"))}</p>`}
              </div>
            </section>
            ${feedBlock}
          </div>
        </section>
        <section class="home-section home-participate">
          <div class="home-participate-inner">
            <h2>${esc(t(lang, "participate"))}</h2>
            <ol class="home-steps">
              <li><strong>${esc(t(lang, "step1_t"))}</strong>${esc(t(lang, "step1_b"))}<a href="/${lang}/${esc(sitePath(lang, "login"))}/">${esc(t(lang, "login_or_create"))}</a>.</li>
              <li><strong>${esc(t(lang, "step2_t"))}</strong>${esc(t(lang, "step2_b"))}</li>
              <li><strong>${esc(t(lang, "step3_t"))}</strong>${esc(t(lang, "step3_b"))}</li>
            </ol>
            <a class="btn btn-primary" href="/${lang}/${esc(sitePath(lang, "login"))}/">${esc(t(lang, "create_account"))}</a>
          </div>
        </section>
        <section class="home-section home-legal">
          <div class="home-legal-inner">
            <div class="home-legal-col">
              <h2>${esc(t(lang, "rules_h"))}</h2>
              <p>${esc(t(lang, "rules_p"))}</p>
              <a href="/${lang}/comunidad/normas/">${esc(t(lang, "read_rules"))}</a>
            </div>
            <div class="home-legal-col">
              <h2>${esc(t(lang, "dsa_h"))}</h2>
              <p>${dsaP}</p>
            </div>
            <div class="home-legal-col">
              <h2>${esc(t(lang, "privacy_h"))}</h2>
              <p>${privacyP}</p>
            </div>
          </div>
        </section>
      </div>`,
  });
}

// Página de normas (contenido estático). Debe existir antes de abrir la
// comunidad: enlaza el bloque legal de la portada y cumple el aviso DSA.
function renderNormas(lang) {
  const claim = t(lang, "n_claim_p", {
    email: `<a href="mailto:info@lixby.es">info@lixby.es</a>`,
    contact: `<a href="${esc(helpContact(lang))}">${esc(t(lang, "contact_form"))}</a>`,
  });
  const privacy = t(lang, "n_privacy_p", {
    policy: `<a href="${esc(legalPrivacy(lang))}">${esc(t(lang, "privacy_policy"))}</a>`,
  });
  const li = (key) => `<li>${esc(t(lang, key))}</li>`;
  return layout({
    lang,
    title: t(lang, "rules_page_title"),
    description: t(lang, "rules_page_desc"),
    canonical: `/${lang}/comunidad/normas/`,
    body: `
      <section class="community-hero community-hero-compact">
        <div class="community-hero-inner">
          <p class="breadcrumb"><a href="/${lang}/comunidad/">${esc(t(lang, "community"))}</a></p>
          <h1>${esc(t(lang, "rules_h1"))}</h1>
          <p class="lead">${esc(t(lang, "rules_lead"))}</p>
        </div>
      </section>
      <div class="container">
        <article class="community-page">
          <h2>${esc(t(lang, "n_allowed_h"))}</h2>
          <ul>${li("n_allowed_1")}${li("n_allowed_2")}${li("n_allowed_3")}${li("n_allowed_4")}${li("n_allowed_5")}</ul>
          <h2>${esc(t(lang, "n_notallowed_h"))}</h2>
          <ul>${li("n_notallowed_1")}${li("n_notallowed_2")}${li("n_notallowed_3")}${li("n_notallowed_4")}${li("n_notallowed_5")}${li("n_notallowed_6")}</ul>
          <h2>${esc(t(lang, "n_auto_h"))}</h2>
          <p>${esc(t(lang, "n_auto_p"))}</p>
          <h2>${esc(t(lang, "n_cons_h"))}</h2>
          <ul>${li("n_cons_1")}${li("n_cons_2")}${li("n_cons_3")}</ul>
          <h2>${esc(t(lang, "n_claim_h"))}</h2>
          <p>${claim}</p>
          <h2>${esc(t(lang, "n_privacy_h"))}</h2>
          <p>${privacy}</p>
        </article>
      </div>`,
  });
}

// Tamaño de página del feed y del buscador.
const PAGE_SIZE = 20;
// Tope de documentos que el buscador trae para filtrar por texto en memoria
// (Firestore no hace búsqueda por subcadena).
const SEARCH_SCAN = 300;

// Paginador numérico con el mismo aspecto que el buscador principal
// (/<idioma>/buscar/): «Anterior  1  2  …  N  Siguiente».
function pager(lang, current, total, hrefFor) {
  if (!(total > 1)) return "";
  const page = Math.min(Math.max(1, current), total);
  const btn = (label, n, opts = {}) => {
    const cls = `community-page-btn${opts.current ? " is-current" : ""}${opts.disabled ? " is-disabled" : ""}`;
    if (opts.disabled) {
      return `<span class="${cls}" aria-disabled="true">${esc(label)}</span>`;
    }
    if (opts.current) {
      return `<span class="${cls}" aria-current="page">${esc(label)}</span>`;
    }
    return `<a class="${cls}" href="${esc(hrefFor(n))}">${esc(label)}</a>`;
  };
  const parts = [btn(t(lang, "prev"), page - 1, { disabled: page <= 1 })];
  const nums = [];
  for (let n = 1; n <= total; n += 1) {
    if (n === 1 || n === total || Math.abs(n - page) <= 1) nums.push(n);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  for (const entry of nums) {
    parts.push(
      entry === "…"
        ? `<span class="community-page-dots" aria-hidden="true">…</span>`
        : btn(String(entry), entry, { current: entry === page })
    );
  }
  parts.push(btn(t(lang, "next"), page + 1, { disabled: page >= total }));
  return `<nav class="community-pagination" aria-label="${esc(t(lang, "pagination"))}">${parts.join("")}</nav>`;
}

async function renderSpace(lang, slug, order, page) {
  const [spaceSnap, spaces] = await Promise.all([
    db.collection("spaces").doc(slug).get(),
    listSpaces(),
  ]);
  if (!spaceSnap.exists) return null;
  const space = spaceSnap.data();

  const baseQuery = db
    .collection("posts")
    .where("spaceId", "==", slug)
    .where("status", "==", "published");

  // Total de hilos del espacio para el paginador de números (agregación count;
  // se factura 1 lectura por cada 1000 documentos contados).
  const countSnap = await baseQuery.count().get();
  const total = countSnap.data().count;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pg = Math.min(Math.max(1, Number(page) || 1), totalPages);

  const snap = await baseQuery
    .orderBy(order === "top" ? "score" : "lastActivityAt", "desc")
    .offset((pg - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .get();
  const docs = snap.docs;

  // Vistas de cada hilo desde postStats (una sola lectura por lote).
  const statsRefs = docs.map((d) => db.collection("postStats").doc(d.id));
  const statsSnaps = statsRefs.length ? await db.getAll(...statsRefs) : [];
  const viewsById = new Map(
    statsSnaps.map((s) => [s.id, s.exists ? s.data().views || 0 : 0])
  );

  const items = docs
    .map((d) =>
      postCard(lang, {
        id: d.id,
        slug,
        post: d.data(),
        views: viewsById.get(d.id) || 0,
      })
    )
    .join("");

  const base = `/${lang}/comunidad/${esc(slug)}/`;
  const startHref = order === "top" ? `${base}?orden=top` : base;
  const pageHref = (n) => {
    if (n <= 1) return startHref;
    const qs = order === "top" ? `orden=top&pagina=${n}` : `pagina=${n}`;
    return `${base}?${qs}`;
  };
  const next = pager(lang, pg, totalPages, pageHref);
  const canonical = pg > 1 ? pageHref(pg) : base;
  const recientesActive = order === "top" ? "" : " is-active";
  const topActive = order === "top" ? " is-active" : "";

  return layout({
    lang,
    title: t(lang, "space_title", { space: space.name }),
    description: space.description,
    canonical,
    robots: order === "top" ? "noindex,follow" : undefined,
    body: `
      <section class="community-hero community-hero-compact">
        <div class="community-hero-inner">
          <p class="breadcrumb"><a href="/${lang}/comunidad/">${esc(t(lang, "community"))}</a></p>
          <h1>${spaceIcon(lang, space)} ${esc(space.name)}</h1>
          <p class="lead">${esc(space.description)}</p>
        </div>
      </section>
      <div class="community-layout">
        ${spaceSidebar(lang, spaces, slug)}
        <div class="community-content">
          <div class="feed-toolbar">
            <h2>${esc(order === "top" ? t(lang, "f_top") : t(lang, "f_recent"))}</h2>
            <div class="feed-sort" role="tablist" aria-label="${esc(t(lang, "sort_threads"))}">
              <a class="feed-sort-btn${recientesActive}" href="${esc(base)}">${esc(t(lang, "f_recent"))}</a>
              <a class="feed-sort-btn${topActive}" href="${esc(base)}?orden=top">${esc(t(lang, "f_top"))}</a>
            </div>
          </div>
          <div id="lx-composer" data-space="${esc(slug)}"></div>
          <div class="post-list">
            ${items || `<p class="community-empty"><span class="empty-emoji">🍃</span>${esc(t(lang, "no_threads_space"))}</p>`}
          </div>
          ${next}
        </div>
      </div>`,
  });
}

// Buscador: filtra por texto (título/cuerpo), espacio, etiqueta y orden.
// Firestore no hace búsqueda por subcadena, así que traemos una ventana de
// posts que cumplen espacio+etiqueta (SEARCH_SCAN) y filtramos el texto en
// memoria. Paginación por número de página (param `pagina`).
async function renderSearch(lang, params) {
  const q = String(params.q || "").trim().slice(0, 100);
  const order = params.orden === "top" ? "top" : "recientes";
  const page = Math.max(1, Math.min(100, Number(params.pagina) || 1));

  const spaces = await listSpaces();
  const slugs = new Set(spaces.map((s) => s.slug));
  const espacio = slugs.has(params.espacio) ? params.espacio : "";
  const etiqueta = TAGS.includes(params.etiqueta) ? params.etiqueta : "";
  const spaceName = new Map(spaces.map((s) => [s.slug, s.name]));

  let base = db.collection("posts").where("status", "==", "published");
  if (espacio) base = base.where("spaceId", "==", espacio);
  if (etiqueta) {
    // `array-contains` + igualdad se resuelve por fusión de índices (sin
    // índice compuesto), pero NO admite `orderBy` sin índice compuesto. Como
    // ya filtramos/paginamos en memoria, ordenamos también en memoria.
    base = base.where("tags", "array-contains", etiqueta);
  } else {
    base = base.orderBy(order === "top" ? "score" : "lastActivityAt", "desc");
  }
  base = base.limit(SEARCH_SCAN);

  const snap = await base.get();
  let all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (q) {
    const needle = q.toLowerCase();
    all = all.filter(
      (p) =>
        String(p.title || "").toLowerCase().includes(needle) ||
        String(p.body || "").toLowerCase().includes(needle)
    );
  }
  // Con `orderBy` de Firestore ya viene ordenado; con etiqueta (sin orderBy)
  // ordenamos aquí. Se reordena siempre para que el orden sea uniforme.
  const tsMs = (ts) => (ts && ts.toMillis ? ts.toMillis() : 0);
  all.sort((a, b) =>
    order === "top"
      ? (Number(b.score) || 0) - (Number(a.score) || 0)
      : tsMs(b.lastActivityAt) - tsMs(a.lastActivityAt)
  );

  const total = all.length;
  const capped = snap.size >= SEARCH_SCAN;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages);
  const start = (current - 1) * PAGE_SIZE;
  const pageDocs = all.slice(start, start + PAGE_SIZE);

  // Vistas de cada hilo (una sola lectura por lote).
  const statsRefs = pageDocs.map((p) => db.collection("postStats").doc(p.id));
  const statsSnaps = statsRefs.length ? await db.getAll(...statsRefs) : [];
  const viewsById = new Map(
    statsSnaps.map((s) => [s.id, s.exists ? s.data().views || 0 : 0])
  );

  const items = pageDocs
    .map((p) =>
      postCard(lang, {
        id: p.id,
        slug: p.spaceId,
        post: p,
        views: viewsById.get(p.id) || 0,
        showSpace: true,
        spaceName: spaceName.get(p.spaceId) || p.spaceId,
      })
    )
    .join("");

  const link = (over = {}) => {
    const u = new URLSearchParams();
    const merged = {
      q,
      espacio,
      etiqueta,
      orden: order === "top" ? "top" : "",
      pagina: "",
      ...over,
    };
    for (const [k, v] of Object.entries(merged)) if (v) u.set(k, String(v));
    const s = u.toString();
    return `/${lang}/comunidad/buscar/${s ? `?${s}` : ""}`;
  };

  const pagerHtml = pager(lang, current, pages, (n) => link(n > 1 ? { pagina: n } : {}));

  const spaceOpts = spaces
    .map(
      (s) =>
        `<option value="${esc(s.slug)}"${s.slug === espacio ? " selected" : ""}>${esc(s.name)}</option>`
    )
    .join("");
  const tagOpts = TAGS.map(
    (tag) =>
      `<option value="${tag}"${tag === etiqueta ? " selected" : ""}>${esc(tagLabel(lang, tag))}</option>`
  ).join("");

  const filterForm = `<form class="community-filters" action="/${lang}/comunidad/buscar/" method="get" role="search">
    <label class="filter-field filter-grow">
      <span>${esc(t(lang, "f_search"))}</span>
      <input type="search" name="q" value="${esc(q)}" placeholder="${esc(t(lang, "f_title_or_content"))}" autocomplete="off">
    </label>
    <label class="filter-field">
      <span>${esc(t(lang, "f_space"))}</span>
      <select name="espacio">
        <option value="">${esc(t(lang, "f_all"))}</option>
        ${spaceOpts}
      </select>
    </label>
    <label class="filter-field">
      <span>${esc(t(lang, "f_tag"))}</span>
      <select name="etiqueta">
        <option value="">${esc(t(lang, "f_all_f"))}</option>
        ${tagOpts}
      </select>
    </label>
    <label class="filter-field">
      <span>${esc(t(lang, "f_order"))}</span>
      <select name="orden">
        <option value=""${order === "recientes" ? " selected" : ""}>${esc(t(lang, "f_recent"))}</option>
        <option value="top"${order === "top" ? " selected" : ""}>${esc(t(lang, "f_top"))}</option>
      </select>
    </label>
    <button type="submit" class="btn btn-primary">${esc(t(lang, "search"))}</button>
  </form>`;

  const filters = [
    q ? `“${esc(q)}”` : "",
    espacio ? `${esc(t(lang, "in_space"))} ${esc(spaceName.get(espacio) || espacio)}` : "",
    etiqueta ? `${esc(t(lang, "with_tag"))} ${esc(tagLabel(lang, etiqueta))}` : "",
  ].filter(Boolean);
  const heading = filters.length
    ? `${esc(t(lang, "results"))} ${filters.join(" ")}`
    : esc(t(lang, "all_threads"));
  const capNote = capped
    ? `<p class="community-note">${esc(t(lang, "search_cap", { n: SEARCH_SCAN }))}</p>`
    : "";

  return layout({
    lang,
    title: q ? t(lang, "search_title_q", { q }) : t(lang, "search_title"),
    description: t(lang, "search_desc"),
    canonical: `/${lang}/comunidad/buscar/`,
    robots: "noindex,follow",
    body: `
      <section class="community-hero community-hero-compact">
        <div class="community-hero-inner">
          <p class="breadcrumb"><a href="/${lang}/comunidad/">${esc(t(lang, "community"))}</a></p>
          <h1>${esc(t(lang, "search"))}</h1>
          <p class="lead">${esc(t(lang, "search_lead"))}</p>
        </div>
      </section>
      <div class="community-layout">
        ${spaceSidebar(lang, spaces, espacio, q)}
        <div class="community-content">
          ${filterForm}
          ${capNote}
          <div class="feed-toolbar">
            <h2>${heading}</h2>
            <p class="feed-count">${total} ${esc(total === 1 ? t(lang, "thread_one") : t(lang, "thread_many"))}</p>
          </div>
          <div class="post-list">
            ${items || `<p class="community-empty"><span class="empty-emoji">🔍</span>${esc(t(lang, "no_threads"))}</p>`}
          </div>
          ${pagerHtml}
        </div>
      </div>`,
  });
}

const MAX_COMMENTS = 300;

// Devuelve solo los <article> del nivel pedido: el contenedor con gap lo pone
// el llamante (#lx-comment-list en la raíz, .comment-children en las respuestas).
// Total de respuestas publicadas de cada comentario (todo su subárbol).
function replyCounter(byParent) {
  const memo = new Map();
  const count = (id) => {
    if (memo.has(id)) return memo.get(id);
    let n = 0;
    for (const c of byParent.get(id) || []) {
      n += (c.status === "published" ? 1 : 0) + count(c.id);
    }
    memo.set(id, n);
    return n;
  };
  return count;
}

// ctx: { canReply, replies(id), views(id) }.
function renderComments(lang, byParent, parentId, ctx) {
  const { canReply } = ctx;
  return (byParent.get(parentId) || [])
    .map((c) => {
      const removed = c.status !== "published";
      const children = renderComments(lang, byParent, c.id, ctx);
      if (removed && !children) return ""; // retirado y sin respuestas visibles
      const head = removed
        ? `<span class="comment-removed">${esc(t(lang, "comment_removed"))}</span>`
        : `<strong>${esc(c.authorName)}</strong><span class="dot" aria-hidden="true"></span>${esc(fmtDate(lang, c.createdAt))}`;
      let actions = "";
      if (!removed) {
        const like = `<button type="button" class="lx-act lx-like lx-comment-like" data-comment="${esc(c.id)}" aria-pressed="false" aria-label="${esc(t(lang, "like"))}">${svg(ICON.heart)}<span class="lx-comment-score" data-n="${Number(c.score) || 0}">${fmtN(lang, c.score)}</span></button>`;
        const reply = canReply
          ? `<button type="button" class="lx-act lx-reply" data-comment="${esc(c.id)}" aria-label="${esc(t(lang, "reply"))}" hidden>${svg(ICON.comment)}<span class="lx-reply-count" data-n="${ctx.replies(c.id)}">${fmtN(lang, ctx.replies(c.id))}</span></button>`
          : "";
        const views = `<span class="lx-act lx-comment-views" data-comment="${esc(c.id)}" aria-label="${esc(t(lang, "views"))}">${svg(ICON.views)}<span class="lx-comment-views-n">${fmtN(lang, ctx.views(c.id))}</span></span>`;
        const share = `<button type="button" class="lx-act lx-comment-share" data-comment="${esc(c.id)}" aria-label="${esc(t(lang, "share"))}">${svg(ICON.share)}</button>`;
        actions = `<div class="comment-actions">${like}${reply}${views}${share}</div>`;
      }
      return `<article class="comment" id="c-${esc(c.id)}">
        <div class="comment-header">${head}</div>
        ${removed ? "" : `<div class="comment-body">${paragraphs(c.body)}</div>`}
        ${actions}
        ${children ? `<div class="comment-children">${children}</div>` : ""}
      </article>`;
    })
    .join("");
}

async function renderThread(lang, slug, postId) {
  const [spaceSnap, postSnap] = await Promise.all([
    db.collection("spaces").doc(slug).get(),
    db.collection("posts").doc(postId).get(),
  ]);
  if (!spaceSnap.exists || !postSnap.exists) return null;

  const space = spaceSnap.data();
  const post = postSnap.data();
  if (post.spaceId !== slug || !["published", "locked"].includes(post.status)) return null;

  const [cSnap, statsSnap] = await Promise.all([
    db
      .collection("posts")
      .doc(postId)
      .collection("comments")
      .orderBy("createdAt", "asc")
      .limit(MAX_COMMENTS)
      .get(),
    db.collection("postStats").doc(postId).get(),
  ]);
  const stats = statsSnap.exists ? statsSnap.data() : {};
  const views = stats.views || 0;
  const commentViews = stats.comments || {};

  const byParent = new Map();
  for (const d of cSnap.docs) {
    const c = { id: d.id, ...d.data() };
    const key = c.parentCommentId || null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(c);
  }

  const url = `https://lixby.es/${lang}/comunidad/${slug}/${postId}/`;
  const plain = String(post.body || "").replace(/\s+/g, " ").trim();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    "@id": url,
    url,
    headline: String(post.title).slice(0, 110),
    text: String(post.body || "").slice(0, 5000),
    inLanguage: lang,
    author: { "@type": "Person", name: post.authorName },
    datePublished: iso(post.createdAt),
    dateModified: iso(post.editedAt) || iso(post.lastActivityAt),
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/CommentAction",
        userInteractionCount: post.commentCount ?? 0,
      },
    ],
  };

  const locked =
    post.status === "locked"
      ? `<p class="thread-notice"><em>${esc(t(lang, "thread_locked"))}</em></p>`
      : "";
  const tooMany =
    cSnap.size >= MAX_COMMENTS
      ? `<p class="thread-notice"><em>${esc(t(lang, "thread_many_comments"))}</em></p>`
      : "";
  const comments = renderComments(lang, byParent, null, {
    canReply: post.status !== "locked",
    replies: replyCounter(byParent),
    views: (id) => Number(commentViews[id]) || 0,
  });

  return layout({
    lang,
    title: t(lang, "thread_title", { post: post.title, space: space.name }),
    description: plain.slice(0, 160),
    canonical: `/${lang}/comunidad/${slug}/${postId}/`,
    jsonLd,
    body: `
      <div class="community-thread">
        <p class="breadcrumb">
          <a href="/${lang}/comunidad/">${esc(t(lang, "community"))}</a>
          <span aria-hidden="true">/</span>
          <a href="/${lang}/comunidad/${esc(slug)}/">${esc(space.name)}</a>
        </p>
        <article class="post-detail">
          <div class="post-detail-main">
            <h1>${esc(post.title)}</h1>
            <div class="post-body">${paragraphs(post.body)}</div>
            ${actionBar(lang, {
              postId,
              slug,
              score: post.score,
              comments: post.commentCount,
              views,
              commentsHref: "#lx-comments",
              thread: true,
            })}
            <div class="post-meta">
              <span>${esc(post.authorName)}</span>
              <span class="dot" aria-hidden="true"></span>
              <span>${esc(fmtDate(lang, post.createdAt))}</span>
              ${tagList(lang, post.tags)}
            </div>
          </div>
        </article>
        ${locked}
        <section id="lx-comments" class="comments-section" data-post="${esc(postId)}"${post.status === "locked" ? ' data-locked="1"' : ""}>
          <h2>${esc(t(lang, "comments_count", { n: post.commentCount ?? 0 }))}</h2>
          ${post.status === "locked" ? "" : `<div id="lx-comment-form"></div>`}
          <div id="lx-comment-list" class="comment-list">
            ${comments || `<p id="lx-no-comments" class="community-empty"><span class="empty-emoji" aria-hidden="true">💬</span>${esc(t(lang, "no_comments"))}</p>`}
          </div>
          ${tooMany}
        </section>
      </div>`,
  });
}

async function renderSitemap() {
  const [spaces, posts] = await Promise.all([
    db.collection("spaces").get(),
    db
      .collection("posts")
      .where("status", "==", "published")
      .orderBy("lastActivityAt", "desc")
      .limit(5000)
      .get(),
  ]);

  const url = (loc, lastmod) =>
    `<url><loc>https://lixby.es${esc(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`;

  // Las páginas fijas (portada y normas) y los espacios se listan en todos los
  // idiomas; los hilos solo una vez (en inglés, el x-default) para no multiplicar
  // por 24 un listado que ya es grande.
  const entries = [];
  for (const lang of LANGS) {
    entries.push(url(`/${lang}/comunidad/`));
    entries.push(url(`/${lang}/comunidad/normas/`));
    for (const d of spaces.docs) entries.push(url(`/${lang}/comunidad/${d.id}/`));
  }
  for (const d of posts.docs) {
    const p = d.data();
    entries.push(url(`/en/comunidad/${p.spaceId}/${d.id}/`, iso(p.lastActivityAt)));
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join("")}</urlset>`;
}

const SPACE_RE = /^[a-z0-9-]{1,40}$/;
const POST_RE = /^[A-Za-z0-9]{1,40}$/;

exports.communitySSR = onRequest(
  { region: "europe-west1", memory: "256MiB", timeoutSeconds: 15, maxInstances: 10 },
  async (req, res) => {
    // denial-of-wallet: un pico de tráfico no debe multiplicar instancias sin
    // tope (maxInstances: 10 arriba) ni la factura (alerta de presupuesto).
    res.set(SECURITY_HEADERS);
    try {
      const path = req.path.replace(/\/+$/, "") || "/";

      // Sitemap (mismo contenido en cualquier idioma).
      const sm = path.match(/^\/([a-z]{2})\/comunidad\/sitemap\.xml$/);
      if (sm && LANGS.includes(sm[1])) {
        const xml = await renderSitemap();
        res
          .status(200)
          .set("Content-Type", "application/xml; charset=utf-8")
          .set("Cache-Control", "public, max-age=600, s-maxage=3600")
          .send(xml);
        return;
      }

      const root = path.match(/^\/([a-z]{2})\/comunidad(?:\/(.*))?$/);
      if (!root || !LANGS.includes(root[1])) {
        res.status(404).set("Cache-Control", "public, max-age=60").send("No encontrado");
        return;
      }
      const lang = root[1];
      const rest = (root[2] || "").replace(/\/+$/, "");

      let html;
      if (rest === "") {
        html = await renderHome(lang);
      } else if (rest === "buscar") {
        html = await renderSearch(lang, req.query);
      } else if (rest === "normas") {
        html = renderNormas(lang);
      } else {
        const parts = rest.split("/");
        if (parts.length === 1 && SPACE_RE.test(parts[0])) {
          html = await renderSpace(
            lang,
            parts[0],
            req.query.orden === "top" ? "top" : "recientes",
            req.query.pagina
          );
        } else if (parts.length === 2 && SPACE_RE.test(parts[0]) && POST_RE.test(parts[1])) {
          html = await renderThread(lang, parts[0], parts[1]);
        }
      }

      if (!html) {
        res.status(404).set("Cache-Control", "public, max-age=60").send("No encontrado");
        return;
      }

      res
        .status(200)
        .set("Content-Type", "text/html; charset=utf-8")
        .set("Cache-Control", "public, max-age=60, s-maxage=300")
        .set("Content-Security-Policy", COMMUNITY_CSP)
        .send(html);
    } catch (err) {
      console.error("communitySSR error", err);
      res.status(500).set("Cache-Control", "no-store").send("Error interno");
    }
  }
);
