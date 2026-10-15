# Comunidad Lixby — modelo de datos y reglas (borrador v1)

Documento base para la comunidad en `https://lixby.es/es/comunidad/`.
Estado: **borrador local**, nada desplegado. Las reglas viven en `firestore.rules`
y los índices en `firestore.indexes.json`.

## Decisiones ya cerradas

- **Ubicación**: subdirectorio `lixby.es/es/comunidad/` (consolida autoridad SEO).
- **MVP**: hilos + comentarios anidados, votos up/down, perfil público básico,
  reportes + panel de moderación mínimo.
- **Lectura pública** sin cuenta (SEO); publicar/comentar/votar requiere cuenta.
- **Roles**: custom claims (`owner` / `mod` / `admin`).

## Principios de seguridad

- El `uid` **siempre** procede del token verificado, nunca del cliente.
- Las **lecturas** van directas del cliente a Firestore.
- La **escritura de contenido sensible** (crear/editar/borrar hilos y comentarios,
  moderar) pasa por **Cloud Functions** con el Admin SDK, que ignora las reglas.
  Por eso las reglas ponen `allow create/update/delete: if false` en esas rutas.
- Los **votos** sí se escriben desde el cliente (alta frecuencia), pero las reglas
  exigen `request.auth.uid == id del documento` y `value ∈ {1,-1}`.
- Los **contadores** (`score`, `upvotes`, `downvotes`, `commentCount`, `postCount`,
  `karma`) son **server-only** y los mantienen triggers.
- Regla por defecto: `deny` para todo lo no listado.

## Colecciones

### `spaces/{spaceId}` — espacios / subforos
Catálogo (lectura pública, escritura sólo moderación/seed).
Campos: `name`, `slug`, `description`, `icon`, `image` (icono del espacio; el
SSR la usa en vez del emoji), `order`, `postCount` (server), `createdAt`.
Semilla: LixBuds, Lixney, Lixfly, General, Ideas y sugerencias, Soporte entre usuarios.

### `posts/{postId}` — hilos
| Campo | Tipo | Notas |
|---|---|---|
| `spaceId` | string | FK a `spaces` |
| `authorUid` | string | del token |
| `authorName` | string | copia desnormalizada (evita leer el perfil) |
| `title` | string | 3–140 |
| `body` | string | 1–10000, saneado |
| `tags` | array<string> | `pregunta` \| `idea` \| `bug` \| `showcase` |
| `status` | string | `published` \| `removed` \| `locked` |
| `score` | int | **server**; con solo "me gusta", equivale al nº de likes |
| `upvotes` / `downvotes` | int | **server** (`downvotes` sin uso: no hay voto negativo) |
| `commentCount` | int | **server** |
| `createdAt` / `updatedAt` / `lastActivityAt` | timestamp | `lastActivityAt` ordena el feed |
| `editedAt` | timestamp? | sólo si se editó |

### `posts/{postId}/comments/{commentId}` — comentarios anidados
`parentCommentId` (null = nivel raíz), `depth` (0…N, tope p. ej. 5),
`path` (array de ids, para ordenar el árbol), `authorUid`, `authorName`, `body`,
`status` (`published`/`removed`), `score`/`upvotes`/`downvotes` (**server**),
`createdAt`, `updatedAt`, `editedAt`.

Estrategia: subcolección plana por hilo con `parentCommentId`; el árbol se
compone en el cliente. `path` queda preparado por si más adelante se quiere
un orden tipo Reddit sin recomputar.

### Me gusta (subcolección, id de documento = uid)
- `posts/{postId}/votes/{uid}` → `{ value: 1, createdAt }`
- `posts/{postId}/comments/{commentId}/votes/{uid}` → `{ value: 1, createdAt }`

El id = uid garantiza **un me gusta por usuario y objetivo** sin transacción
extra. Dar me gusta = create con `value: 1`; quitarlo = delete. Las reglas solo
aceptan `value == 1` (los triggers siguen tolerando `-1` por si se reactivan
downvotes). El hilo recuerda el tuyo con un `getDoc`; cada comentario, con un
`getDoc` por comentario visible (solo con sesión).

### `postStats/{postId}` — estadísticas del hilo (solo servidor)
Hoy: `views` (int, **server**), `comments` (mapa `{commentId: int}`, **server**,
visitas por comentario) y `updatedAt`. Lo escribe el callable
`communityTrackView` con el Admin SDK; lectura pública, escritura denegada en
reglas. Se separa de `posts/{postId}` para que contar una visita **no** dispare
`onPostWritten` ni toque `updatedAt`/`lastActivityAt`. Las vistas por comentario
van en el mismo documento (`comments`), así el SSR las lee sin lecturas extra.
Ambas cifras son aproximadas: cuentan navegadores con JS, una vez por sesión y
objetivo (el comentario, al entrar en pantalla), y el `sessionStorage` no es
fiable. Un solo documento admite ~1 escritura/segundo sostenida; con mucho
tráfico habría que repartir el contador.

### `profiles/{uid}` — perfil público
Separado de `users/{uid}` (que es privado y guarda `accountNumber`).
Campos: `displayName`, `avatarUrl`, `bio` (corta), `postCount`, `commentCount`,
`karma` (**server**), `createdAt`. Lectura pública; escritura sólo servidor.

### `reports/{reportId}` — reportes
`targetType` (`post`/`comment`), `targetPath`, `targetId`, `targetAuthorUid`,
`reporterUid` (= uid del token), `reason` (`spam`/`abuse`/`illegal`/`off-topic`/`other`),
`note` (opcional), `status` (`open`/`resolved`/`dismissed`), `createdAt`,
`resolvedAt`, `resolvedBy`. Crear: cualquier usuario autenticado. Leer/gestionar: mods.

## Cloud Functions (región `europe-west1`)

Callables (validan + sanea + rate-limit + escriben con Admin SDK):
- `communityCreatePost`, `communityEditPost`, `communityRemovePost`
- `communityCreateComment`, `communityEditComment`, `communityRemoveComment`
- `communityModerate` (sólo mod: cambia `status`, resuelve reportes, escribe log)
- `communityReport` (alternativa al create directo, si se quiere rate limiting server-side)
- `communityTrackView` (**sin login**): suma 1 a `postStats/{postId}.views` o, si
  llega `commentId`, a `postStats/{postId}.comments[commentId]`; valida que el
  hilo (y el comentario, si lo hay) exista y esté `published`; límite por IP
  (60/hora hilo, 300/hora comentarios). No escribe en `posts/{postId}`.

Triggers (contadores server-only):
- `onPostVoteWritten` → `post.upvotes/downvotes/score` + delta de `karma`
- `onCommentVoteWritten` → `comment.upvotes/downvotes/score` + delta de `karma`
- `onCommentWritten` → `post.commentCount`, `post.lastActivityAt`, `profile.commentCount`
- `onPostWritten` → `space.postCount`, `profile.postCount`
- `onReportCreated` → notifica a mods (SendGrid ya está configurado en `functions/index.js`)

Los triggers de voto (`onPostVoteWritten`, `onCommentVoteWritten`) siguen ahí y
calculan el delta a partir del `before`/`after`; con solo "me gusta" el
`downvotes`/`-1` queda sin uso. Para recuentos exactos, recomputar por consulta.

## Índices

Definidos en `firestore.indexes.json` y conectados desde `firebase.json`:
- `posts`: `spaceId + status + lastActivityAt` (feed del espacio)
- `posts`: `spaceId + status + createdAt`
- `posts`: `spaceId + status + score` (top del espacio)
- `posts`: `status + lastActivityAt` (feed global)
- `posts`: `status + score` (top global)
- `posts`: `authorUid + status + createdAt` (perfil)
- `comments`: `parentCommentId + createdAt` (hijos de un comentario)
- `comments`: `status + createdAt` (comentarios publicados de un hilo)
- `reports`: `status + createdAt` (panel de moderación)

## SEO: aviso importante

Una comunidad SPA renderizada en cliente **no rankea bien**. Dado que el SEO
orgánico es la prioridad, hay que planificar desde el principio:
- Renderizado en servidor (o prerender) de las páginas de hilo y espacio
  (`/es/comunidad/hilo/{id}`), p. ej. vía Cloud Function/rewrite de Hosting.
- Generar un `sitemap` de hilos publicados y enlazarlos internamente.
- `title`/`description`/JSON-LD (`DiscussionForumPosting` / `QAPage`) por hilo.
- hreflang/canonical: decidir si el resto de idiomas canonicalizan a `/es/`.

## RGPD / DSA (a actualizar antes de abrir)

- Normas de la comunidad y canal de denuncia de contenido ilegal (DSA).
- Política de Privacidad y RAT: nuevos datos personales (UGC, perfil público, votos).
- Moderación: filtros básicos y definición de normas antes de abrir.
- Costes: vigilar lecturas de Firestore (paginación y caché desde el primer día).

## Frontend `/es/comunidad/` (SSR + mejora progresiva)

- `functions/community-ssr.js`: renderiza en servidor (Cloud Function
  `communitySSR`, `europe-west1`, vía rewrite `/es/comunidad/**`) la portada, el
  feed de cada espacio, el hilo con sus comentarios anidados, el buscador
  (`/es/comunidad/buscar/`), la página de normas (`/es/comunidad/normas/`) y
  `sitemap.xml`.
  Filtra siempre `status === "published"` (el Admin SDK ignora las reglas) y
  escapa todo lo que viene de Firestore. El layout reutiliza el nav, el footer y
  el fondo del index (`/es/style.css`), más la hoja propia de la comunidad.
- `es/comunidad/comunidad.css`: componentes de la comunidad sobre los tokens de
  Lix Design (hero, rejilla de espacios, tarjetas de hilo, comentarios,
  compositor). Se sirve como estático: un archivo real tiene prioridad sobre el
  rewrite a la función.
- `es/js/comunidad-client.js`: módulo ES (Firebase v12.18.0) que, tras el SSR,
  rellena `#lx-session` (sesión/perfil/logout, `?next` en lista blanca) y el
  compositor `#lx-composer` de la vista de espacio (crear hilo). La lectura es
  pública; solo se necesita sesión para publicar.
- `es/comunidad/comunidad.js`: cliente SPA de la primera iteración; ya no se
  carga en las páginas SSR (queda como referencia mientras se completa la
  migración de comentar/votar).
- SEO: `title`/`description`/canonical por vista, JSON-LD
  `DiscussionForumPosting` por hilo, `noindex,follow` en `?orden=top` y
  `sitemap.xml` solo con hilos publicados (tope 5000, `lastmod` =
  `lastActivityAt`).
- CSP: la emite la propia función (`COMMUNITY_CSP`) porque Firebase Hosting no
  aplica los headers de `firebase.json` a los rewrites hacia Cloud Functions.
  Incluye `https://www.gstatic.com` (SDK), `fonts.googleapis.com` /
  `fonts.gstatic.com` (tipografía Inter) y los `connect-src` de Firestore / Auth
  / Functions (`europe-west1-lixby0.cloudfunctions.net`).

## Estado de implementación (borrador)

- `functions/index.js`: implementadas las callables
  (`communityCreatePost`, `communityEditPost`, `communityRemovePost`,
  `communityCreateComment`, `communityEditComment`, `communityRemoveComment`,
  `communityReport`, `communityModerate`, `communityResolveReport`,
  `communitySaveProfile`) y los triggers (`onPostWritten`, `onCommentWritten`,
  `onPostVoteWritten`, `onCommentVoteWritten`), todo en `europe-west1`.
- `firestore.rules` + `firestore.indexes.json`: listos.
- `scripts/seed-community-spaces.js` (`pnpm seed:spaces`): semilla de `spaces`.
- Frontend `/es/comunidad/`: SSR de portada, feed y hilo con comentarios +
  `sitemap.xml`; cliente de sesión/perfil y compositor de hilos (fase 5b) sobre
  el diseño del index.
- Comentar y responder en el hilo (fase 5c-1): botones de respuesta servidos
  ocultos en el SSR (se revelan salvo en hilos cerrados), formulario raíz y
  formularios de respuesta, e inserción del comentario nuevo en el DOM sin
  recargar.
- Acciones del hilo (fase 5c-2): barra con comentarios, "me gusta" (un `getDoc`
  para recordar el tuyo), visitas y compartir (Web Share API o copiar enlace).
  Contadores compactos con `Intl.NumberFormat` ("68 mil"). El SSR lee
  `postStats/{postId}.views`. Sustituye al plan anterior de ↑/↓.
- La misma barra se repite en cada tarjeta del feed del espacio (me gusta ·
  comentarios · visitas · compartir), con las visitas leídas por lote
  (`getAll`) de `postStats` y el "me gusta" recordado con un `getDoc` por
  tarjeta (solo con sesión). Las visitas del feed **no** se cuentan (solo se
  muestran): el recuento ocurre al abrir el hilo.
- Cada comentario repite la barra (me gusta · respuestas · visitas · compartir):
  "me gusta" con `getDoc` por comentario visible, compartir por ancla `#c-id` y
  visitas contadas al entrar el comentario en pantalla (IntersectionObserver,
  una por sesión). El SSR lee `postStats/{postId}.comments`.
- Paginación y buscador: el feed del espacio pagina por número de página
  (`?pagina=`) con `PAGE_SIZE = 20` y un paginador de números estilo buscador
  («Anterior 1 2 … N Siguiente»); el total sale de una agregación `count()` y la
  página se resuelve con `offset()` + `orderBy`. El buscador
  (`/es/comunidad/buscar/`) añade filtros por texto (título/cuerpo,
  case-insensitive), espacio, etiqueta y orden (recientes / mejor valorados),
  con el mismo paginador (`?pagina=`). Como Firestore no hace
  búsqueda por subcadena, el SSR trae una ventana de posts que cumplen
  espacio+etiqueta (`SEARCH_SCAN = 300`) y filtra el texto en memoria; es
  `noindex,follow`. Hay una caja de búsqueda en la portada y en el lateral.
- Portada (`renderHome`): además de la rejilla de espacios, un feed global
  ("Actividad reciente" con el índice `status+lastActivityAt` y "Mejor
  valorados" con `status+score`, `postCard` reutilizado), un bloque "Cómo
  participar" con CTA y un bloque legal (normas, denuncia DSA y privacidad).
- Página de normas (`renderNormas`): contenido estático en
  `/es/comunidad/normas/`, enlazada desde la portada y el `sitemap.xml`.
- Pendiente: App Check, moderación/reportes y privacidad/RAT (incluye
  el uso transitorio de la IP para el límite de visitas y la marca en
  `sessionStorage`).

### Comandos

```bash
pnpm seed:spaces                                   # crea/actualiza los espacios
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only functions
```

Antes de desplegar: probar las reglas y las funciones con
`firebase emulators:start --only firestore,functions`.

Asignación de rol (una vez, para ti y futuros mods), desde una consola con
Admin SDK o `gcloud`:

```js
await admin.auth().setCustomUserClaims(uid, { role: "owner" });
```
El usuario debe renovar el ID token (volver a iniciar sesión o `getIdToken(true)`)
para que el claim llegue a las reglas y a las funciones.

## Pendiente de decidir

- (DSA) Avisar al autor cuando un moderador retira contenido publicado
  (`communityModerate` solo cambia el `status`): hay que motivar la decisión.
  Ver `docs/comunidad/normas.md`.
- ¿Los hilos editados por el autor quedan marcados (`editedAt`) sin límite de tiempo?
- ¿Soft-delete siempre (`status = removed`) en vez de borrado físico? (recomendado)
- ¿Comentarios de hilos retirados: cascada de `status` o comprobación en cliente?
- ¿Notificaciones: sólo respuesta directa o también menciones y respuestas al hilo?
- ¿Cloudflare delante de Firebase Hosting (cuidado con SSL/DNS en modo proxy)?

## Notas de compatibilidad (emulador y versiones)

- `firebase-admin` está pineado a `^13.3.0` en el root y en `functions` (resuelve
  a 13.x). El código usa el API legacy namespace (`admin.firestore()`,
  `admin.auth()`) y v13 lo mantiene; v14 (14.x) lo eliminó por completo
  (`admin.firestore` = undefined) y la migración al API modular quedaría como
  deuda técnica.
- `admin.getApps()` NO existe en v13 → se usa `admin.apps` (array, `[]` si no
  hay apps).
- El Functions Emulator **stubea** `firebase-admin`: envuelve el namespace con un
  proxy y, como `admin.firestore` no se detecta como constructor, devuelve una
  copia ligada (`bind`) que **pierde las estáticas** (`FieldValue`). Por eso
  `admin.firestore.FieldValue` es `undefined` dentro de los workers y las
  callables fallaban con 500. Solución: `const { FieldValue } =
  require("firebase-admin/firestore")` — el subpath no se stubea y existe igual
  en v13 y v14.
- El emulador sólo recarga los workers cuando detecta cambios; si los errores
  apuntan a líneas antiguas tras editar, reinicia `firebase emulators:start`.
- Para ejecutar el emulador se necesita Java 21+ (firebase-tools 15.x). En este
  equipo se usó un JRE portátil: `$env:JAVA_HOME = "$env:TEMP\opencode\jre21\jdk-21.0.12.1+1-jre"`.
