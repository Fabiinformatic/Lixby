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

// CSP de las paginas SSR. Se emite desde la funcion porque Firebase Hosting NO
// aplica los headers de firebase.json a las respuestas de rewrites hacia Cloud
// Functions (verificado en el emulador). Cubre el HTML servido + el cliente de
// sesion (/es/js/comunidad-client.js) y el SDK de Firebase desde gstatic.
// Sin 'unsafe-inline': los navegadores no aplican la CSP a un bloque
// <script type="application/ld+json"> (son datos, no JS); comprobado en Edge
// con la consola limpia y el JSON-LD intacto en el DOM.
const COMMUNITY_CSP = [
  "default-src 'self'",
  "script-src 'self' https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self' https://firestore.googleapis.com wss://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://europe-west1-lixby0.cloudfunctions.net",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

function layout({ title, description, canonical, robots, jsonLd, body }) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  ${robots ? `<meta name="robots" content="${esc(robots)}">` : ""}
  ${jsonLd ? `<script type="application/ld+json">${safeJson(jsonLd)}</script>` : ""}
  <link rel="canonical" href="https://lixby.es${esc(canonical)}">
  <link rel="stylesheet" href="/globalheader.css">
  <link rel="stylesheet" href="/globalfooter.css">
  <link rel="stylesheet" href="/localnav.css">
  <link rel="stylesheet" href="/es/style.css">
</head>
<body>
  <header class="container"><div id="lx-session"></div></header>
  <main class="container">${body}</main>
  <script type="module" src="/es/js/comunidad-client.js" defer></script>
</body>
</html>`;
}

async function renderHome() {
  const snap = await db.collection("spaces").get();
  const items = snap.docs
    .map((d) => ({ slug: d.id, ...d.data() }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(
      (s) =>
        `<li><a href="/es/comunidad/${esc(s.slug)}/"><strong>${esc(s.icon ?? "")} ${esc(s.name)}</strong></a><p>${esc(s.description)}</p></li>`
    )
    .join("");
  return layout({
    title: "Comunidad Lixby",
    description:
      "Comparte ideas, resuelve dudas y habla con otros usuarios de LixBuds, Lixney y Lixfly.",
    canonical: "/es/comunidad/",
    body: `<h1>Comunidad Lixby</h1><ul>${items || "<li>No hay espacios todavía.</li>"}</ul>`,
  });
}

// Tamaño de página del feed. Sobrescribible con SSR_PAGE_SIZE (útil en el
// emulador para probar la paginación sin tocar código).
const PAGE_SIZE = Number(process.env.SSR_PAGE_SIZE || 20) || 20;

const validId = (v) =>
  typeof v === "string" && /^[A-Za-z0-9]{1,40}$/.test(v) ? v : null;

const fmtDate = (ts) =>
  ts && ts.toDate
    ? new Intl.DateTimeFormat("es-ES", {
        dateStyle: "medium",
        timeZone: "Atlantic/Canary",
      }).format(ts.toDate())
    : "";

async function renderSpace(slug, order, afterId) {
  const spaceSnap = await db.collection("spaces").doc(slug).get();
  if (!spaceSnap.exists) return null;
  const space = spaceSnap.data();

  let q = db
    .collection("posts")
    .where("spaceId", "==", slug)
    .where("status", "==", "published")
    .orderBy(order === "top" ? "score" : "lastActivityAt", "desc")
    .limit(PAGE_SIZE + 1);

  if (afterId) {
    const cursor = await db.collection("posts").doc(afterId).get();
    if (cursor.exists) q = q.startAfter(cursor);
  }

  const snap = await q.get();
  const hasMore = snap.docs.length > PAGE_SIZE;
  const docs = snap.docs.slice(0, PAGE_SIZE);

  const items = docs
    .map((d) => {
      const p = d.data();
      const tags = (p.tags || [])
        .map((t) => `<span class="tag">${esc(t)}</span>`)
        .join(" ");
      return `<li>
        <a href="/es/comunidad/${esc(slug)}/${esc(d.id)}/"><strong>${esc(p.title)}</strong></a>
        <div>${esc(p.authorName)} · ${esc(fmtDate(p.lastActivityAt))} · ${esc(p.score ?? 0)} puntos · ${esc(p.commentCount ?? 0)} comentarios</div>
        ${tags}
      </li>`;
    })
    .join("");

  const orderQs = order === "top" ? "&orden=top" : "";
  const next = hasMore
    ? `<a rel="next" href="/es/comunidad/${esc(slug)}/?despues=${esc(docs[docs.length - 1].id)}${orderQs}">Más hilos</a>`
    : "";

  const base = `/es/comunidad/${slug}/`;
  const canonical =
    afterId && order !== "top" ? `${base}?despues=${afterId}` : base;

  return layout({
    title: `${space.name} · Comunidad Lixby`,
    description: space.description,
    canonical,
    robots: order === "top" ? "noindex,follow" : undefined,
    body: `
      <p><a href="/es/comunidad/">Comunidad</a></p>
      <h1>${esc(space.icon)} ${esc(space.name)}</h1>
      <p>${esc(space.description)}</p>
      <nav>
        <a href="${esc(base)}">Recientes</a> · <a href="${esc(base)}?orden=top">Mejor valorados</a>
      </nav>
      ${items ? `<ul>${items}</ul>` : "<p>Todavía no hay hilos en este espacio.</p>"}
      ${next}`,
  });
}

const MAX_COMMENTS = 300;

// JSON-LD seguro: < siempre se escapa para que el contenido de usuario no
// pueda cerrar la etiqueta <script> del bloque de datos estructurados.
const safeJson = (o) => JSON.stringify(o).replace(/</g, "\\u003c");

const paragraphs = (t) =>
  String(t ?? "")
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

const iso = (ts) => (ts && ts.toDate ? ts.toDate().toISOString() : undefined);

function renderComments(byParent, parentId) {
  const list = byParent.get(parentId) || [];
  const items = list
    .map((c) => {
      const removed = c.status !== "published";
      const children = renderComments(byParent, c.id);
      if (removed && !children) return ""; // retirado y sin respuestas visibles
      const head = removed
        ? "<em>[comentario eliminado]</em>"
        : `<strong>${esc(c.authorName)}</strong> · ${esc(fmtDate(c.createdAt))} · ${esc(c.score ?? 0)} puntos`;
      return `<li id="c-${esc(c.id)}">
        <div>${head}</div>
        ${removed ? "" : paragraphs(c.body)}
        ${children}
      </li>`;
    })
    .join("");
  return items ? `<ul>${items}</ul>` : "";
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

  const cSnap = await db
    .collection("posts")
    .doc(postId)
    .collection("comments")
    .orderBy("createdAt", "asc")
    .limit(MAX_COMMENTS)
    .get();

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

  const tags = (post.tags || [])
    .map((t) => `<span class="tag">${esc(t)}</span>`)
    .join(" ");
  const locked =
    post.status === "locked"
      ? "<p><em>Hilo cerrado: ya no admite comentarios nuevos.</em></p>"
      : "";
  const tooMany =
    cSnap.size >= MAX_COMMENTS
      ? "<p><em>Se muestran los primeros comentarios del hilo.</em></p>"
      : "";

  return layout({
    title: `${post.title} · ${space.name} · Comunidad Lixby`,
    description: plain.slice(0, 160),
    canonical: `/es/comunidad/${slug}/${postId}/`,
    jsonLd,
    body: `
      <p><a href="/es/comunidad/">Comunidad</a> / <a href="/es/comunidad/${esc(slug)}/">${esc(space.name)}</a></p>
      <article>
        <h1>${esc(post.title)}</h1>
        <div>${esc(post.authorName)} · ${esc(fmtDate(post.createdAt))} · ${esc(post.score ?? 0)} puntos</div>
        ${tags}
        ${paragraphs(post.body)}
      </article>
      ${locked}
      <section>
        <h2>${esc(post.commentCount ?? 0)} comentarios</h2>
        ${renderComments(byParent, null) || "<p>Todavía no hay comentarios.</p>"}
        ${tooMany}
      </section>`,
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
  { region: "europe-west1", memory: "256MiB", timeoutSeconds: 15 },
  async (req, res) => {
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
      } else {
        const m = path.match(/^\/es\/comunidad\/([a-z0-9-]{1,40})$/);
        if (m) {
          html = await renderSpace(
            m[1],
            req.query.orden === "top" ? "top" : "recientes",
            validId(req.query.despues)
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