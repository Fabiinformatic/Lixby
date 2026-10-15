// community-ssr.js
// SSR de la Comunidad Lixby (2ª generación, europe-west1).
// Firestore Hosting envía /es/comunidad/** aquí vía rewrite (firebase.json).
//
// Notas:
// - El Admin SDK ignora las reglas de Firestore, así que cualquier render de
//   contenidos de usuarios DEBE filtrar `status === "published"` (los hilos y
//   comentarios retirados siguen estando en la BBDD).
// - Todo lo que venga de Firestore pasa por esc() para evitar XSS.
// - Caché corta (5 min en CDN) a propósito: permite retirar contenido rápido
//   en producción mientras no haya moderación.
// - Diseño: el layout reutiliza el nav, el footer y el fondo del index
//   (/es/style.css) y la hoja propia de la comunidad
//   (/es/comunidad/comunidad.css, servida estática porque un archivo real
//   tiene prioridad sobre el rewrite a esta función).

const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

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
// Sin 'unsafe-inline' para scripts: los navegadores no aplican la CSP a un
// bloque <script type="application/ld+json"> (son datos, no JS).
// El emulador de Functions define FUNCTIONS_EMULATOR=true por sí solo; en
// producción esa variable no existe, así que esta CSP ampliada es inerte.
// Al probar en 127.0.0.1/localhost el cliente habla con los emuladores locales
// (Auth 9099, Firestore 8080 y Functions 5001), que hay que permitir.
const EMU = process.env.FUNCTIONS_EMULATOR === "true";
const EMU_CONNECT = EMU
  ? " http://127.0.0.1:9099 http://127.0.0.1:8080 ws://127.0.0.1:8080 http://127.0.0.1:5001"
  : "";

const COMMUNITY_CSP = [
  "default-src 'self'",
  "script-src 'self' https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  `connect-src 'self' https://firestore.googleapis.com wss://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://europe-west1-lixby0.cloudfunctions.net${EMU_CONNECT}`,
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

// ── Chrome del sitio (nav + footer) ────────────────────────────────────────
// Copiado del index (/es/index.html) con rutas absolutas para que funcione en
// cualquier profundidad (/es/comunidad/<espacio>/<hilo>/). El hueco
// #lx-session vive dentro de .nav-actions y lo rellena comunidad-client.js
// (sin sesión queda vacío; el acceso a login vive en el compositor).
const SITE_NAV = `
  <header class="nav" id="nav">
    <div class="container nav-container">
      <a href="/es/" class="nav-brand"><span class="nav-brand-full">Lixby</span><span class="nav-brand-short">LX</span></a>
      <nav class="nav-links" aria-label="Principal">
        <a href="/es/tienda/" class="nav-link">Tienda</a>
        <a href="/es/productos/" class="nav-link">Productos</a>
        <a href="/es/apps/" class="nav-link">Apps</a>
        <a href="/es/support/" class="nav-link">Soporte</a>
      </nav>
      <div class="nav-actions">
        <div id="lx-session"></div>
        <button type="button" class="nav-icon-button nav-search-toggle" aria-label="Buscar" aria-controls="navMobilePanel" aria-expanded="false">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7"></circle>
            <line x1="16.65" y1="16.65" x2="21" y2="21"></line>
          </svg>
        </button>
        <form id="navSearchForm" action="/es/buscar/" method="get">
          <input type="search" id="navSearch" name="q" class="nav-search" placeholder="Buscar en Lixby..." aria-label="Buscar en Lixby">
        </form>
        <a href="/es/cesta/" class="nav-icon-link" aria-label="Cesta">
          <img src="/es/images/Bolsa.png" alt="Cesta">
        </a>
        <a href="/es/cuenta/" class="nav-icon-link nav-icon-account" aria-label="Cuenta">
          <img src="/es/images/cuenta.png" alt="Cuenta">
        </a>
        <button type="button" class="nav-icon-button nav-menu-toggle" aria-label="Menú" aria-controls="navMobilePanel" aria-expanded="false">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <line x1="3" y1="8" x2="21" y2="8"></line>
            <line x1="3" y1="16" x2="21" y2="16"></line>
          </svg>
        </button>
      </div>
    </div>
  </header>
  <div class="nav-mobile-panel" id="navMobilePanel" aria-hidden="true">
    <nav class="nav-mobile-links" aria-label="Principal móvil">
      <div class="nav-mobile-item">
        <button type="button" class="nav-mobile-question" aria-expanded="false" aria-controls="sub-tienda" aria-labelledby="sub-tienda-label">
          <span id="sub-tienda-label">Tienda</span>
          <svg class="nav-mobile-chevron" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div class="nav-mobile-answer" id="sub-tienda">
          <p class="nav-mobile-answer-text"><a href="/es/tienda/">Entrar a tienda</a></p>
          <p class="nav-mobile-answer-text"><a href="/es/pages/products/lixbuds-one/">Auriculares LixBuds One</a></p>
          <p class="nav-mobile-answer-text"><a href="/es/comprar-cascos/lixbuds-one/">Comprar ahora</a></p>
          <p class="nav-mobile-answer-text"><a href="/es/novedades/">Novedades</a></p>
        </div>
      </div>
      <div class="nav-mobile-item">
        <button type="button" class="nav-mobile-question" aria-expanded="false" aria-controls="sub-productos" aria-labelledby="sub-productos-label">
          <span id="sub-productos-label">Productos</span>
          <svg class="nav-mobile-chevron" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div class="nav-mobile-answer" id="sub-productos">
          <p class="nav-mobile-answer-text"><a href="/es/productos/">Ver productos</a></p>
          <p class="nav-mobile-answer-text"><a href="/es/pages/products/lixbuds-one/">LixBuds One</a></p>
          <p class="nav-mobile-answer-text"><a href="/es/pages/apps/lixney/">Lixney</a></p>
          <p class="nav-mobile-answer-text"><a href="/es/pages/apps/lixfly/">Lixfly</a></p>
        </div>
      </div>
      <div class="nav-mobile-item">
        <button type="button" class="nav-mobile-question" aria-expanded="false" aria-controls="sub-apps" aria-labelledby="sub-apps-label">
          <span id="sub-apps-label">Apps</span>
          <svg class="nav-mobile-chevron" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div class="nav-mobile-answer" id="sub-apps">
          <p class="nav-mobile-answer-text"><a href="/es/apps/">Ver apps</a></p>
          <p class="nav-mobile-answer-text"><a href="/es/centro-ayuda/lixney/">Soporte de Lixney</a></p>
          <p class="nav-mobile-answer-text"><a href="/es/centro-ayuda/lixfly/">Soporte de Lixfly</a></p>
        </div>
      </div>
      <div class="nav-mobile-item">
        <button type="button" class="nav-mobile-question" aria-expanded="false" aria-controls="sub-soporte" aria-labelledby="sub-soporte-label">
          <span id="sub-soporte-label">Soporte</span>
          <svg class="nav-mobile-chevron" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div class="nav-mobile-answer" id="sub-soporte">
          <p class="nav-mobile-answer-text"><a href="/es/support/">Ir a soporte</a></p>
          <p class="nav-mobile-answer-text"><a href="/es/centro-ayuda/faq/">Preguntas frecuentes</a></p>
          <p class="nav-mobile-answer-text"><a href="/es/centro-ayuda/contacto/">Contacto</a></p>
          <p class="nav-mobile-answer-text"><a href="/es/centro-ayuda/devoluciones/">Devoluciones</a></p>
        </div>
      </div>
    </nav>
    <div class="nav-mobile-actions">
      <div class="nav-mobile-item">
        <button type="button" class="nav-mobile-question" aria-expanded="false" aria-controls="sub-cesta" aria-labelledby="sub-cesta-label">
          <span id="sub-cesta-label">Cesta</span>
          <svg class="nav-mobile-chevron" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div class="nav-mobile-answer" id="sub-cesta">
          <p class="nav-mobile-answer-text"><a href="/es/cesta/">Ver cesta</a></p>
          <p class="nav-mobile-answer-text"><a href="/es/cesta/">Finalizar compra</a></p>
        </div>
      </div>
      <div class="nav-mobile-item">
        <button type="button" class="nav-mobile-question" aria-expanded="false" aria-controls="sub-cuenta" aria-labelledby="sub-cuenta-label">
          <span id="sub-cuenta-label">Cuenta</span>
          <svg class="nav-mobile-chevron" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div class="nav-mobile-answer" id="sub-cuenta">
          <p class="nav-mobile-answer-text"><a href="/es/cuenta/">Entrar a mi cuenta</a></p>
          <p class="nav-mobile-answer-text"><a href="/es/cuenta/">Mis pedidos</a></p>
          <p class="nav-mobile-answer-text"><a href="/es/cuenta/">Mi perfil</a></p>
          <p class="nav-mobile-answer-text"><a href="/es/iniciar-sesion/">Iniciar sesión</a></p>
        </div>
      </div>
    </div>
  </div>`;

const SITE_FOOTER = `
  <footer class="footer footer-mega">
    <div class="container footer-mega-grid">
      <section class="footer-section">
        <h3>Ver y comprar</h3>
        <ul>
          <li><a href="/es/tienda/">Tienda</a></li>
          <li><a href="/es/pages/products/lixbuds-one/">LixBuds</a></li>
          <li><a href="/es/apps/">Apps</a></li>
          <li><a href="/es/support/">Soporte</a></li>
        </ul>
      </section>

      <section class="footer-section">
        <h3>Soporte</h3>
        <ul>
          <li><a href="/es/support/">Página inicial soporte</a></li>
          <li><a href="/es/support/#faq">FAQs Tienda online</a></li>
          <li><a href="/es/support/">Información de Garantía</a></li>
          <li><a href="mailto:info@lixby.es">Email al CEO</a></li>
        </ul>
      </section>

      <section class="footer-section">
        <h3>Cuenta</h3>
        <ul>
          <li><a href="/es/track/">Pedidos</a></li>
          <li><a href="/es/cuenta/">Mi cuenta</a></li>
          <li><a href="/es/cuenta/">Cupones</a></li>
          <li><a href="/es/comunidad/">Comunidad</a></li>
        </ul>
      </section>

      <section class="footer-section">
        <h3>Acerca de Lixby</h3>
        <ul>
          <li><a href="/es/about/">Nosotros</a></li>
          <li><a href="/es/support/">Garantía</a></li>
          <li><a href="/es/novedades/">Novedades</a></li>
          <li><a href="/es/support/">Contacto</a></li>
        </ul>
      </section>
    </div>

    <div class="container footer-meta">
      <p class="footer-bottom">Copyright © 2026 Lixby. Todos los derechos reservados.</p>
      <div class="footer-legal-links">
        <a href="/es/pages/legal/privacy/">Política de privacidad</a>
        <a href="/es/pages/legal/cookies/">Política de Cookies</a>
        <a href="/es/pages/legal/terms/">Términos y Condiciones</a>
        <a href="/es/pages/legal/ventas-reembolsos/">Ventas y reembolsos</a>
        <a href="/es/pages/legal/legal-notice/">Avisos legales</a>
      </div>
    </div>
  </footer>`;

function layout({ title, description, canonical, robots, jsonLd, body }) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  ${robots ? `<meta name="robots" content="${esc(robots)}">` : ""}
  ${jsonLd ? `<script type="application/ld+json">${safeJson(jsonLd)}</script>` : ""}
  <link rel="canonical" href="https://lixby.es${esc(canonical)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
  <link rel="icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/icon.png">
  <link rel="stylesheet" href="/es/style.css">
  <link rel="stylesheet" href="/es/comunidad/comunidad.css">
</head>
<body>
  <div id="scroll-progress"></div>
  <div class="background-orb orb-1" aria-hidden="true"></div>
  <div class="background-orb orb-2" aria-hidden="true"></div>
  <div class="background-orb orb-3" aria-hidden="true"></div>
  <div class="background-orb orb-4" aria-hidden="true"></div>
  <div class="background-orb orb-5" aria-hidden="true"></div>${SITE_NAV}
  <main class="community-main">${body}</main>${SITE_FOOTER}
  <script src="/es/main.js" defer></script>
  <script type="module" src="/es/js/comunidad-client.js" defer></script>
</body>
</html>`;
}

// ── Helpers de formato ─────────────────────────────────────────────────────
const fmtDate = (ts) =>
  ts && ts.toDate
    ? new Intl.DateTimeFormat("es-ES", {
        dateStyle: "medium",
        timeZone: "Atlantic/Canary",
      }).format(ts.toDate())
    : "";

const iso = (ts) => (ts && ts.toDate ? ts.toDate().toISOString() : undefined);

const paragraphs = (t) =>
  String(t ?? "")
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

const tagList = (tags) =>
  (tags || []).map((t) => `<span class="post-tag">${esc(t)}</span>`).join("");

const excerpt = (t) => {
  const s = String(t ?? "").replace(/\s+/g, " ").trim();
  return s.length > 180 ? `${s.slice(0, 180)}…` : s;
};

// Contadores compactos ("68 mil") + iconos de la barra de acciones del hilo.
const nf = new Intl.NumberFormat("es-ES", { notation: "compact" });
const fmtN = (n) => nf.format(Number(n) || 0);

const ICON = {
  comment:
    "M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z",
  heart:
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z",
  views: "M12 20V10M18 20V4M6 20v-4",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.35-4.35",
  share:
    "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13",
};
const svg = (d) =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

// Barra de acciones reutilizable (hilo y tarjetas del feed). Sin datos de
// usuario: el estado "me gusta" y las visitas los pinta/enlaza el cliente.
// - thread: solo en el hilo se cuenta la visita al cargar (data-view="1").
function actionBar({ postId, slug, score, comments, views, commentsHref, thread = false }) {
  return `<div class="lx-actions" data-post="${esc(postId)}" data-slug="${esc(slug)}"${thread ? ' data-view="1"' : ""}>
    <a class="lx-act" href="${esc(commentsHref)}" aria-label="Comentarios">${svg(ICON.comment)}<span>${fmtN(comments)}</span></a>
    <button type="button" class="lx-act lx-like" aria-pressed="false" aria-label="Me gusta">${svg(ICON.heart)}<span class="lx-post-score" data-n="${Number(score) || 0}">${fmtN(score)}</span></button>
    <span class="lx-act" aria-label="Visitas">${svg(ICON.views)}<span class="lx-post-views">${fmtN(views)}</span></span>
    <button type="button" class="lx-act lx-share" aria-label="Compartir">${svg(ICON.share)}</button>
    <span class="lx-flash" role="status"></span>
  </div>`;
}

// Tarjeta de hilo (feed de espacio y resultados del buscador). Con showSpace
// añade un enlace al espacio (útil cuando los resultados mezclan espacios).
function postCard({ id, slug, post, views, showSpace = false, spaceName = "" }) {
  const href = `/es/comunidad/${esc(slug)}/${esc(id)}/`;
  const space =
    showSpace && spaceName
      ? `<a class="post-space" href="/es/comunidad/${esc(slug)}/">${esc(spaceName)}</a>
            <span class="dot" aria-hidden="true"></span>`
      : "";
  return `<article class="post-card">
        <div class="post-main">
          <h3 class="post-title"><a href="${href}">${esc(post.title)}</a></h3>
          <p class="post-excerpt">${esc(excerpt(post.body))}</p>
          ${actionBar({
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
            <span>${esc(fmtDate(post.lastActivityAt))}</span>
            ${tagList(post.tags)}
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
function searchBox({ q = "", compact = true } = {}) {
  return `<form class="community-search${compact ? " is-compact" : ""}" action="/es/comunidad/buscar/" method="get" role="search">
    <input type="search" name="q" value="${esc(q)}" placeholder="Buscar en la comunidad…" aria-label="Buscar en la comunidad" autocomplete="off">
    <button type="submit" aria-label="Buscar">${svg(ICON.search)}</button>
  </form>`;
}

// Icono de un espacio. Cada espacio usa imagen en vez de emoji; la imagen puede
// venir del documento (`image`) o de este mapa por slug (mismo criterio que el
// resto del sitio). El emoji queda sólo como último recurso.
const SPACE_IMAGES = {
  general: "/es/images/Chat.png",
  lixbuds: "/es/images/lixbuds-one-white.png",
  lixney: "/es/images/lixneyicon2.webp",
  lixfly: "/es/images/lixflyicon2.webp",
  ideas: "/es/images/Bombilla.png",
  soporte: "/es/images/Mano.png",
};
function spaceIcon(space, cls = "space-emoji") {
  const src = space.image || SPACE_IMAGES[space.slug];
  if (src) {
    return `<img class="${cls}" src="${esc(src)}" alt="" aria-hidden="true" loading="lazy" decoding="async">`;
  }
  return `<span class="${cls}" aria-hidden="true">${esc(space.icon ?? "")}</span>`;
}

// Menú lateral de espacios (reutilizado por portada y vista de espacio).
function spaceSidebar(spaces, activeSlug, q = "") {
  const items = spaces
    .map(
      (s) => `<a class="space-link${s.slug === activeSlug ? " is-active" : ""}" href="/es/comunidad/${esc(s.slug)}/">
        ${spaceIcon(s)}
        <span class="space-name">${esc(s.name)}</span>
      </a>`
    )
    .join("");
  return `<aside class="community-sidebar" aria-label="Espacios">
    ${searchBox({ q })}
    <p class="community-sidebar-title">Espacios</p>
    <nav class="space-list">${items}</nav>
  </aside>`;
}

// Portada: rejilla de espacios + actividad global (últimos y mejor valorados),
// cómo participar y bloque legal. El feed global usa los mismos índices que el
// buscador (status+lastActivityAt y status+score).
const HOME_FEED = 6;
const HOME_TOP = 5;

async function renderHome() {
  const spaces = await listSpaces();
  const spaceName = new Map(spaces.map((s) => [s.slug, s.name]));
  const cards = spaces
    .map(
      (s) => `<a class="space-card" href="/es/comunidad/${esc(s.slug)}/">
        ${spaceIcon(s, "space-card-emoji")}
        <span class="space-card-body">
          <strong>${esc(s.name)}</strong>
          <span>${esc(s.description ?? "")}</span>
        </span>
        <span class="space-card-arrow" aria-hidden="true">→</span>
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
    return postCard({
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
            <h2>Actividad reciente</h2>
            <a class="home-block-more" href="/es/comunidad/buscar/">Ver todos los hilos →</a>
          </div>
          <div class="post-list">${recentCards}</div>
        </section>
        <section class="home-block home-block-aside">
          <div class="home-block-head"><h2>Mejor valorados</h2></div>
          <div class="post-list">${topCards}</div>
        </section>
      </div>`
    : "";

  return layout({
    title: "Comunidad Lixby",
    description:
      "Comparte ideas, resuelve dudas y habla con otros usuarios de LixBuds, Lixney y Lixfly.",
    canonical: "/es/comunidad/",
    body: `
      <section class="community-hero">
        <div class="community-hero-inner">
          <span class="badge">Comunidad</span>
          <h1>Comunidad <span class="grad">Lixby</span></h1>
          <p class="lead">Comparte ideas, resuelve dudas y habla con otros usuarios de LixBuds, Lixney y Lixfly.</p>
          ${searchBox({ compact: false })}
        </div>
      </section>
      <div class="container">
        <section class="home-block">
          <div class="home-block-head">
            <h2>Espacios</h2>
            <a class="home-block-more" href="/es/comunidad/buscar/">Ver todos los hilos →</a>
          </div>
          <div class="space-grid">
            ${cards || `<p class="community-empty"><span class="empty-emoji">🫥</span>Todavía no hay espacios.</p>`}
          </div>
        </section>
        ${feedBlock}
      </div>
      <section class="home-participate">
        <div class="home-participate-inner">
          <h2>Cómo participar</h2>
          <ol class="home-steps">
            <li><strong>Crea tu cuenta.</strong> Solo necesitas un email para publicar, comentar y dar me gusta. <a href="/es/iniciar-sesion/">Entrar o crear cuenta</a>.</li>
            <li><strong>Elige un espacio y publica.</strong> Cuéntanos tu duda, idea o muestra en el espacio que mejor encaje.</li>
            <li><strong>Comenta y comparte.</strong> Responde a otros usuarios, da me gusta y comparte los hilos que te sirvan.</li>
          </ol>
          <a class="btn btn-primary" href="/es/iniciar-sesion/">Crear cuenta</a>
        </div>
      </section>
      <section class="home-legal">
        <div class="home-legal-inner">
          <div class="home-legal-col">
            <h2>Normas y moderación</h2>
            <p>Un filtro automático impide publicar insultos, lenguaje ofensivo, amenazas o incitación a la autolesión. El equipo revisa los reportes y puede retirar contenido que incumpla las normas.</p>
            <a href="/es/comunidad/normas/">Leer las normas de la comunidad</a>
          </div>
          <div class="home-legal-col">
            <h2>Denuncia de contenido ilegal</h2>
            <p>Si detectas contenido ilícito (DSA), escríbenos a <a href="mailto:info@lixby.es">info@lixby.es</a> con el enlace y el motivo, o usa el <a href="/es/centro-ayuda/contacto/">formulario de contacto</a>.</p>
          </div>
          <div class="home-legal-col">
            <h2>Privacidad</h2>
            <p>Tu perfil público y lo que publicas son visibles para todo el mundo. Consulta qué datos tratamos y tus derechos en la <a href="/es/pages/legal/privacy/">Política de Privacidad</a>.</p>
          </div>
        </div>
      </section>`,
  });
}

// Página de normas (contenido estático). Debe existir antes de abrir la
// comunidad: enlaza el bloque legal de la portada y cumple el aviso DSA.
function renderNormas() {
  return layout({
    title: "Normas de la comunidad · Comunidad Lixby",
    description:
      "Normas de participación, moderación automática, consecuencias y canal de denuncia de la comunidad Lixby.",
    canonical: "/es/comunidad/normas/",
    body: `
      <section class="community-hero community-hero-compact">
        <div class="community-hero-inner">
          <p class="breadcrumb"><a href="/es/comunidad/">Comunidad</a></p>
          <h1>Normas de la comunidad</h1>
          <p class="lead">Reglas de participación, moderación y denuncia.</p>
        </div>
      </section>
      <div class="container">
        <article class="community-page">
          <h2>Qué se puede publicar</h2>
          <ul>
            <li>Preguntas y dudas sobre LixBuds, Lixney, Lixfly y el resto de productos y servicios de Lixby.</li>
            <li>Ideas y sugerencias para mejorar.</li>
            <li>Avisos de errores (bug) con los pasos para reproducirlos.</li>
            <li>Muestras de tus proyectos y creaciones (showcase).</li>
            <li>Ayuda a otros usuarios con información útil y respeto.</li>
          </ul>
          <h2>Qué no se permite</h2>
          <ul>
            <li>Insultos, descalificaciones, acoso o discurso de odio.</li>
            <li>Amenazas a cualquier persona.</li>
            <li>Incitación a la autolesión o al suicidio.</li>
            <li>Spam, publicidad no solicitada y enlaces engañosos.</li>
            <li>Contenido ilegal o que vulnere derechos de terceros.</li>
            <li>Suplantación de identidad de Lixby o de otras personas.</li>
          </ul>
          <h2>Moderación automática</h2>
          <p>Para mantener un entorno respetuoso, Lixby usa un filtro automático que impide publicar mensajes con insultos, lenguaje ofensivo, amenazas o incitación a la autolesión. Si tu mensaje no se publica por este motivo, verás un aviso inmediato y podrás reformularlo. El texto bloqueado no se guarda.</p>
          <h2>Consecuencias</h2>
          <ul>
            <li>El filtro automático impide publicar el mensaje en el momento.</li>
            <li>El equipo puede retirar contenido que incumpla estas normas.</li>
            <li>Los casos graves o reincidentes pueden conllevar la suspensión de la cuenta.</li>
          </ul>
          <h2>Cómo reclamar o denunciar</h2>
          <p>Si crees que una decisión de moderación es errónea, o quieres denunciar contenido (incluido contenido ilícito, conforme al DSA), escríbenos a <a href="mailto:info@lixby.es">info@lixby.es</a> indicando el enlace al contenido y el motivo. También puedes usar el <a href="/es/centro-ayuda/contacto/">formulario de contacto</a>.</p>
          <h2>Privacidad</h2>
          <p>Tu perfil público y lo que publicas son visibles para todo el mundo. Consulta qué datos tratamos y tus derechos en la <a href="/es/pages/legal/privacy/">Política de Privacidad</a>.</p>
        </article>
      </div>`,
  });
}

// Tamaño de página del feed y del buscador.
const PAGE_SIZE = 20;
// Tope de documentos que el buscador trae para filtrar por texto en memoria
// (Firestore no hace búsqueda por subcadena).
const SEARCH_SCAN = 300;
// Etiquetas de un hilo (coinciden con las del compositor del cliente).
const COMMUNITY_TAGS = ["pregunta", "idea", "bug", "showcase"];

// Paginador numérico con el mismo aspecto que el buscador principal
// (/es/buscar/): «Anterior  1  2  …  N  Siguiente». `hrefFor(n)` debe devolver
// la URL de la página n.
function pager(current, total, hrefFor) {
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
  const parts = [btn("Anterior", page - 1, { disabled: page <= 1 })];
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
  parts.push(btn("Siguiente", page + 1, { disabled: page >= total }));
  return `<nav class="community-pagination" aria-label="Paginación">${parts.join("")}</nav>`;
}

async function renderSpace(slug, order, page) {
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
      postCard({
        id: d.id,
        slug,
        post: d.data(),
        views: viewsById.get(d.id) || 0,
      })
    )
    .join("");

  const base = `/es/comunidad/${esc(slug)}/`;
  const startHref = order === "top" ? `${base}?orden=top` : base;
  const pageHref = (n) => {
    if (n <= 1) return startHref;
    const qs = order === "top" ? `orden=top&pagina=${n}` : `pagina=${n}`;
    return `${base}?${qs}`;
  };
  const next = pager(pg, totalPages, pageHref);
  const canonical = pg > 1 ? pageHref(pg) : base;
  const recientesActive = order === "top" ? "" : " is-active";
  const topActive = order === "top" ? " is-active" : "";

  return layout({
    title: `${space.name} · Comunidad Lixby`,
    description: space.description,
    canonical,
    robots: order === "top" ? "noindex,follow" : undefined,
    body: `
      <section class="community-hero community-hero-compact">
        <div class="community-hero-inner">
          <p class="breadcrumb"><a href="/es/comunidad/">Comunidad</a></p>
          <h1>${spaceIcon(space)} ${esc(space.name)}</h1>
          <p class="lead">${esc(space.description)}</p>
        </div>
      </section>
      <div class="community-layout">
        ${spaceSidebar(spaces, slug)}
        <div class="community-content">
          <div class="feed-toolbar">
            <h2>${order === "top" ? "Mejor valorados" : "Recientes"}</h2>
            <div class="feed-sort" role="tablist" aria-label="Ordenar hilos">
              <a class="feed-sort-btn${recientesActive}" href="${esc(base)}">Recientes</a>
              <a class="feed-sort-btn${topActive}" href="${esc(base)}?orden=top">Mejor valorados</a>
            </div>
          </div>
          <div id="lx-composer" data-space="${esc(slug)}"></div>
          <div class="post-list">
            ${items || `<p class="community-empty"><span class="empty-emoji">🍃</span>Todavía no hay hilos en este espacio. ¡Sé el primero!</p>`}
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
async function renderSearch(params) {
  const q = String(params.q || "").trim().slice(0, 100);
  const order = params.orden === "top" ? "top" : "recientes";
  const page = Math.max(1, Math.min(100, Number(params.pagina) || 1));

  const spaces = await listSpaces();
  const slugs = new Set(spaces.map((s) => s.slug));
  const espacio = slugs.has(params.espacio) ? params.espacio : "";
  const etiqueta = COMMUNITY_TAGS.includes(params.etiqueta)
    ? params.etiqueta
    : "";
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
        String(p.title || "")
          .toLowerCase()
          .includes(needle) ||
        String(p.body || "")
          .toLowerCase()
          .includes(needle)
    );
  }
  // Con `orderBy` de Firestore ya viene ordenado; con etiqueta (sin orderBy)
  // ordenamos aquí. Se reordena siempre para que el orden sea uniforme.
  const tsMs = (t) => (t && t.toMillis ? t.toMillis() : 0);
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
      postCard({
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
    return `/es/comunidad/buscar/${s ? `?${s}` : ""}`;
  };

  const pagerHtml = pager(current, pages, (n) =>
    link(n > 1 ? { pagina: n } : {})
  );

  const spaceOpts = spaces
    .map(
      (s) =>
        `<option value="${esc(s.slug)}"${s.slug === espacio ? " selected" : ""}>${esc(s.name)}</option>`
    )
    .join("");
  const tagOpts = COMMUNITY_TAGS.map(
    (t) =>
      `<option value="${t}"${t === etiqueta ? " selected" : ""}>${esc(t)}</option>`
  ).join("");

  const filterForm = `<form class="community-filters" action="/es/comunidad/buscar/" method="get" role="search">
    <label class="filter-field filter-grow">
      <span>Buscar</span>
      <input type="search" name="q" value="${esc(q)}" placeholder="Título o contenido…" autocomplete="off">
    </label>
    <label class="filter-field">
      <span>Espacio</span>
      <select name="espacio">
        <option value="">Todos</option>
        ${spaceOpts}
      </select>
    </label>
    <label class="filter-field">
      <span>Etiqueta</span>
      <select name="etiqueta">
        <option value="">Todas</option>
        ${tagOpts}
      </select>
    </label>
    <label class="filter-field">
      <span>Orden</span>
      <select name="orden">
        <option value=""${order === "recientes" ? " selected" : ""}>Recientes</option>
        <option value="top"${order === "top" ? " selected" : ""}>Mejor valorados</option>
      </select>
    </label>
    <button type="submit" class="btn btn-primary">Buscar</button>
  </form>`;

  const filters = [
    q ? `“${esc(q)}”` : "",
    espacio ? `en ${esc(spaceName.get(espacio) || espacio)}` : "",
    etiqueta ? `con etiqueta ${esc(etiqueta)}` : "",
  ].filter(Boolean);
  const heading = filters.length
    ? `Resultados ${filters.join(" ")}`
    : "Todos los hilos";
  const capNote = capped
    ? `<p class="community-note">Se buscó en una ventana de ${SEARCH_SCAN} hilos; afina los filtros si no encuentras algo.</p>`
    : "";

  return layout({
    title: q ? `${q} · Buscar en Comunidad Lixby` : "Buscar · Comunidad Lixby",
    description:
      "Busca hilos de la comunidad Lixby por texto, espacio o etiqueta.",
    canonical: "/es/comunidad/buscar/",
    robots: "noindex,follow",
    body: `
      <section class="community-hero community-hero-compact">
        <div class="community-hero-inner">
          <p class="breadcrumb"><a href="/es/comunidad/">Comunidad</a></p>
          <h1>Buscar</h1>
          <p class="lead">Encuentra hilos por título, contenido, espacio o etiqueta.</p>
        </div>
      </section>
      <div class="community-layout">
        ${spaceSidebar(spaces, espacio, q)}
        <div class="community-content">
          ${filterForm}
          ${capNote}
          <div class="feed-toolbar">
            <h2>${heading}</h2>
            <p class="feed-count">${total} ${total === 1 ? "hilo" : "hilos"}</p>
          </div>
          <div class="post-list">
            ${items || `<p class="community-empty"><span class="empty-emoji">🔍</span>No se encontraron hilos.</p>`}
          </div>
          ${pagerHtml}
        </div>
      </div>`,
  });
}

const MAX_COMMENTS = 300;

// Devuelve solo los <article> del nivel pedido: el contenedor con gap lo pone
// el llamante (#lx-comment-list en la raíz, .comment-children en las respuestas).
// Así el cliente puede insertar un comentario nuevo directamente en
// #lx-comment-list sin pelearse con un wrapper extra.
// Total de respuestas publicadas de cada comentario (todo su subárbol), para el
// contador de la barra. Los retirados no suman, pero sus respuestas sí.
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
function renderComments(byParent, parentId, ctx) {
  const { canReply } = ctx;
  return (byParent.get(parentId) || [])
    .map((c) => {
      const removed = c.status !== "published";
      const children = renderComments(byParent, c.id, ctx);
      if (removed && !children) return ""; // retirado y sin respuestas visibles
      const head = removed
        ? `<span class="comment-removed">Comentario eliminado</span>`
        : `<strong>${esc(c.authorName)}</strong><span class="dot" aria-hidden="true"></span>${esc(fmtDate(c.createdAt))}`;
      // Barra del comentario, igual que la del hilo: me gusta · respuestas ·
      // visitas · compartir. "Responder" viaja oculto (sin JS no hay acción): el
      // cliente lo revela salvo en hilos cerrados y pide login si no hay sesión.
      let actions = "";
      if (!removed) {
        const like = `<button type="button" class="lx-act lx-like lx-comment-like" data-comment="${esc(c.id)}" aria-pressed="false" aria-label="Me gusta">${svg(ICON.heart)}<span class="lx-comment-score" data-n="${Number(c.score) || 0}">${fmtN(c.score)}</span></button>`;
        const reply = canReply
          ? `<button type="button" class="lx-act lx-reply" data-comment="${esc(c.id)}" aria-label="Responder" hidden>${svg(ICON.comment)}<span class="lx-reply-count" data-n="${ctx.replies(c.id)}">${fmtN(ctx.replies(c.id))}</span></button>`
          : "";
        const views = `<span class="lx-act lx-comment-views" data-comment="${esc(c.id)}" aria-label="Visitas">${svg(ICON.views)}<span class="lx-comment-views-n">${fmtN(ctx.views(c.id))}</span></span>`;
        const share = `<button type="button" class="lx-act lx-comment-share" data-comment="${esc(c.id)}" aria-label="Compartir">${svg(ICON.share)}</button>`;
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

async function renderThread(slug, postId) {
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

  const url = `https://lixby.es/es/comunidad/${slug}/${postId}/`;
  const plain = String(post.body || "").replace(/\s+/g, " ").trim();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    "@id": url,
    url,
    headline: String(post.title).slice(0, 110),
    text: String(post.body || "").slice(0, 5000),
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
      ? `<p class="thread-notice"><em>Hilo cerrado: ya no admite comentarios nuevos.</em></p>`
      : "";
  const tooMany =
    cSnap.size >= MAX_COMMENTS
      ? `<p class="thread-notice"><em>Se muestran los primeros comentarios del hilo.</em></p>`
      : "";
  const comments = renderComments(byParent, null, {
    canReply: post.status !== "locked",
    replies: replyCounter(byParent),
    views: (id) => Number(commentViews[id]) || 0,
  });

  return layout({
    title: `${post.title} · ${space.name} · Comunidad Lixby`,
    description: plain.slice(0, 160),
    canonical: `/es/comunidad/${slug}/${postId}/`,
    jsonLd,
    body: `
      <div class="community-thread">
        <p class="breadcrumb">
          <a href="/es/comunidad/">Comunidad</a>
          <span aria-hidden="true">/</span>
          <a href="/es/comunidad/${esc(slug)}/">${esc(space.name)}</a>
        </p>
        <article class="post-detail">
          <div class="post-detail-main">
            <h1>${esc(post.title)}</h1>
            <div class="post-body">${paragraphs(post.body)}</div>
            ${actionBar({
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
              <span>${esc(fmtDate(post.createdAt))}</span>
              ${tagList(post.tags)}
            </div>
          </div>
        </article>
        ${locked}
        <section id="lx-comments" class="comments-section" data-post="${esc(postId)}"${post.status === "locked" ? ' data-locked="1"' : ""}>
          <h2>${esc(post.commentCount ?? 0)} comentarios</h2>
          ${post.status === "locked" ? "" : `<div id="lx-comment-form"></div>`}
          <div id="lx-comment-list" class="comment-list">
            ${comments || `<p id="lx-no-comments" class="community-empty"><span class="empty-emoji" aria-hidden="true">💬</span>Todavía no hay comentarios.</p>`}
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

  const entries = [
    url("/es/comunidad/"),
    url("/es/comunidad/normas/"),
    ...spaces.docs.map((d) => url(`/es/comunidad/${d.id}/`)),
    ...posts.docs.map((d) => {
      const p = d.data();
      return url(`/es/comunidad/${p.spaceId}/${d.id}/`, iso(p.lastActivityAt));
    }),
  ].join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`;
}

exports.communitySSR = onRequest(
  { region: "europe-west1", memory: "256MiB", timeoutSeconds: 15, maxInstances: 10 },
  async (req, res) => {
    // denial-of-wallet: un pico de tráfico no debe multiplicar instancias sin
    // tope (maxInstances: 10 arriba) ni la factura (alerta de presupuesto).
    res.set(SECURITY_HEADERS);
    try {
      const path = req.path.replace(/\/+$/, "") || "/";
      let html;

      if (path === "/es/comunidad/sitemap.xml") {
        const xml = await renderSitemap();
        res
          .status(200)
          .set("Content-Type", "application/xml; charset=utf-8")
          .set("Cache-Control", "public, max-age=600, s-maxage=3600")
          .send(xml);
        return;
      }

      if (path === "/es/comunidad") {
        html = await renderHome();
      } else if (path === "/es/comunidad/buscar") {
        html = await renderSearch(req.query);
      } else if (path === "/es/comunidad/normas") {
        html = renderNormas();
      } else {
        const m = path.match(/^\/es\/comunidad\/([a-z0-9-]{1,40})$/);
        if (m) {
          html = await renderSpace(
            m[1],
            req.query.orden === "top" ? "top" : "recientes",
            req.query.pagina
          );
        } else {
          const t = path.match(/^\/es\/comunidad\/([a-z0-9-]{1,40})\/([A-Za-z0-9]{1,40})$/);
          if (t) {
            html = await renderThread(t[1], t[2]);
          }
        }
      }

      if (!html) {
        res
          .status(404)
          .set("Cache-Control", "public, max-age=60")
          .send("No encontrado");
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
