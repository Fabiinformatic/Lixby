# Cloudflare: cabeceras, login y bots

## Observación de solo lectura

La página pública responde a través de Cloudflare (`Server: cloudflare`, `CF-RAY`), y `lixby.es` usa nameservers de Cloudflare. La respuesta observada ya incluye HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` y `X-Frame-Options`. La CSP servida actualmente permite cualquier esquema HTTPS y `unsafe-eval`; la CSP definida en `firebase.json` es más limitada y no permite `unsafe-eval`.

No hay una credencial/API token de Cloudflare configurada en este entorno, así que no se han cambiado reglas remotas ni se ha podido ver el estado actual de Bot Fight Mode.

## Cabeceras recomendadas

En **Rules → Transform Rules → Modify Response Header**, crea una regla para `http.host in {"lixby.es" "www.lixby.es"}`. Usa operaciones **Set static** para evitar duplicados. Conserva los valores que ya están desplegados en `firebase.json` para:

- `Content-Security-Policy` — copia la política completa del encabezado de Hosting en `firebase.json`; elimina la política Cloudflare actual con `https:` general y `unsafe-eval`.
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

Después comprueba en **Cloudflare Trace** y con respuestas normales de cada flujo que no se duplica CSP ni quedan bloqueados Firebase Auth, reCAPTCHA, Stripe, las fuentes o el panel de cuenta.

## Rate limit de inicio de sesión

No despliegues una regla de rate limiting para `POST /es/iniciar-sesion/`: esa ruta sirve la página y el formulario inicia sesión con Firebase Auth desde el navegador; las peticiones de autenticación van a `identitytoolkit.googleapis.com`, fuera de la zona de Cloudflare. La regla no limitaría los intentos reales. Usa los controles y cuotas de Firebase Authentication. Para que Cloudflare pueda limitar intentos de login, habría que cambiar el flujo para que pase por un endpoint propio detrás de Cloudflare y asegurar que el cliente no pueda saltarse esa ruta.

## Revisión de bots

Bot Fight Mode está disponible en el plan gratuito, pero se aplica a todo el dominio y Cloudflare advierte que puede presentar desafíos a tráfico legítimo de API o móvil. Comprueba su estado en **Security → Settings → Bot traffic**. Si ya está activo, revisa **Security → Events** mientras pruebas registro, login, recuperación de contraseña, pagos y comunidad; no lo actives a ciegas sin acceso al panel.
