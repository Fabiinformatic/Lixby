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
Campos: `name`, `slug`, `description`, `icon`, `order`, `postCount` (server), `createdAt`.
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
| `score` | int | **server** = up − down |
| `upvotes` / `downvotes` | int | **server** |
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

### Votos (subcolección, id de documento = uid)
- `posts/{postId}/votes/{uid}` → `{ value: 1 | -1, createdAt }`
- `posts/{postId}/comments/{commentId}/votes/{uid}` → igual

El id = uid garantiza **un voto por usuario y objetivo** sin transacción extra.
Cambiar el voto = update; quitarlo = delete.

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

Triggers (contadores server-only):
- `onPostVoteWritten` → `post.upvotes/downvotes/score` + delta de `karma`
- `onCommentVoteWritten` → `comment.upvotes/downvotes/score` + delta de `karma`
- `onCommentWritten` → `post.commentCount`, `post.lastActivityAt`, `profile.commentCount`
- `onPostWritten` → `space.postCount`, `profile.postCount`
- `onReportCreated` → notifica a mods (SendGrid ya está configurado en `functions/index.js`)

Idempotencia de votos: calcular el delta a partir del `before`/`after` del trigger
y aplicar `FieldValue.increment`; para recuentos exactos, recomputar por consulta.

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

## Frontend `/es/comunidad/` (HTML + CSS + JS vanilla)

- `es/comunidad/index.html`: shell con el navbar/footer globales, hero, sidebar de
  espacios, feed, detalle de hilo, composer, diálogos de nuevo hilo y de reporte.
- `es/comunidad/comunidad.css`: componentes sobre los tokens de Lix Design v1.6.
- `es/comunidad/comunidad.js`: módulo ES con Firebase v12.18.0 (auth, Firestore y
  callables en `europe-west1`). Enrutado por query string
  (`/es/comunidad/?espacio=…&hilo=…`) con `history.pushState`, escapes de XSS,
  votos optimistas, comentarios anidados y panel de moderación mínimo para mods.
- Solo requiere sesión para publicar, comentar, votar y reportar; la lectura es
  pública (SEO/visitantes). Si no hay sesión, se enlaza a `/es/iniciar-sesion/`.
- El enlace que faltaba en `/es/centro-ayuda/comunidad/` ("Foro oficial") ya
  apunta al foro real.
- CSP (`firebase.json`, regla global `**`): se añadieron a `connect-src`
  `https://firestore.googleapis.com`, `wss://firestore.googleapis.com` y
  `https://europe-west1-lixby0.cloudfunctions.net`, y a `frame-src`
  `https://lixby0.firebaseapp.com` (auth). Se hizo en la regla global porque
  Firebase Hosting no permite excluir un subárbol de un `source: "**"`, y dos
  cabeceras CSP distintas se aplicarían como intersección (rompería la página).
  Orígenes adicionales = superficie de `connect-src`; riesgo bajo.

## Estado de implementación (borrador)

- `functions/index.js`: implementadas las callables
  (`communityCreatePost`, `communityEditPost`, `communityRemovePost`,
  `communityCreateComment`, `communityEditComment`, `communityRemoveComment`,
  `communityReport`, `communityModerate`, `communityResolveReport`,
  `communitySaveProfile`) y los triggers (`onPostWritten`, `onCommentWritten`,
  `onPostVoteWritten`, `onCommentVoteWritten`), todo en `europe-west1`.
- `firestore.rules` + `firestore.indexes.json`: listos.
- `scripts/seed-community-spaces.js` (`pnpm seed:spaces`): semilla de `spaces`.
- Frontend `/es/comunidad/`: hecho (ver arriba).
- Pendiente: render SEO/SSR de hilos y espacios públicos (el MVP es una SPA;
  los buscadores no indexan bien el contenido dinámico) y el prerender de
  `sitemap` de hilos.

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
