# Seguridad y ciberseguridad de Lixby

**Revisión:** 29 de octubre de 2026  
**Alcance:** web, autenticación, datos, APIs, pagos, observabilidad y proceso de desarrollo de este repositorio.

Este documento describe los controles que existen en el código y los que siguen pendientes de configuración externa. No supone que un control esté activo en producción solo porque exista su código o documentación.

## 1. Arquitectura y límites de confianza

- La web se sirve como contenido estático mediante Firebase Hosting y el dominio público pasa por Cloudflare.
- El navegador se comunica directamente con Firebase Authentication, Cloud Firestore y Realtime Database. La comunidad y otras operaciones también usan Cloud Functions.
- El servidor Node/Express se despliega por separado en Railway y atiende operaciones del servidor, incluida la integración de Stripe.
- Sentry recibe informes de errores del servidor. Google Tag Manager carga la etiqueta de GA4 para analítica únicamente después de que el usuario acepte las cookies analíticas.
- Un proveedor, una consola remota y el código local son límites distintos: cambios en el repositorio no activan automáticamente reglas de Firebase, Cloudflare, Stripe, Railway o Google.

## 2. Datos y secretos

### Datos que requieren protección

Los datos de cuenta, pedidos, direcciones, pagos, contenido de comunidad, registros de soporte y tokens de autenticación deben tratarse como privados. No deben añadirse a eventos de analítica, mensajes de error, capturas públicas, incidencias abiertas ni commits.

### Valores públicos frente a secretos

Los identificadores web de Firebase, el ID de contenedor de GTM, el ID de medición de GA4 y la clave **pública** del proveedor de App Check pueden aparecer en el navegador. No son contraseñas. Se deben restringir cuando el proveedor lo permita y proteger los recursos con reglas, autenticación, App Check y controles del servidor.

Las claves privadas de cuentas de servicio, `STRIPE_SECRET_KEY`, secretos de firma de webhooks, credenciales de correo, tokens de despliegue y claves de acceso de proveedores son secretos. Deben residir en un gestor de secretos o variables de entorno protegidas, nunca en HTML, JavaScript público, `.env` versionado, incidencias o logs. Si un secreto se publica, hay que revocarlo y rotarlo; borrarlo del último commit no invalida su exposición en el historial.

El `.gitignore` evita que Git añada por accidente ciertos archivos nuevos, pero **no** elimina archivos que ya estén versionados ni sustituye Gitleaks, la revisión de cambios o la rotación de credenciales expuestas.

El `.gitignore` y la lista `hosting.ignore` de Firebase excluyen del repositorio y de la publicación web archivos `.env`, directorios de credenciales, cuentas de servicio, claves privadas, credenciales npm y estados Terraform. Comprueba ambas listas al añadir un nuevo proveedor; una regla de Git por sí sola no impide que Firebase publique un archivo estático.

## 3. Controles actuales

| Área | Control en el código/proceso | Estado y límite conocido |
|---|---|---|
| Firebase Authentication | Flujos de inicio de sesión y recuperación usan Firebase Auth. | Los intentos se envían directamente a `identitytoolkit.googleapis.com`; una regla de Cloudflare sobre la página HTML no limita esas llamadas. |
| Firestore | Reglas endurecidas, desplegadas por separado y cubiertas por pruebas de emulador y mutación. | Mantener las reglas junto con pruebas; revisar permisos por usuario y no confiar en filtros del cliente. |
| App Check | Inicialización preparada en los clientes que usan Firestore. | La clave del sitio sigue vacía y Firestore no exige tokens. Registrar reCAPTCHA Enterprise, desplegar y observar métricas antes de activar enforcement. Véase [`app-check.md`](app-check.md). |
| Hosting | Firebase Hosting configura CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` y `Permissions-Policy`. | La cabecera observada desde Cloudflare tenía una CSP más amplia que la de Hosting. No se han modificado reglas remotas de Cloudflare. |
| Cloudflare | El dominio público usa Cloudflare. | No se verificó el estado de Bot Fight Mode ni se aplicó rate limiting; no había acceso a la zona. Véase [`cloudflare.md`](cloudflare.md). |
| Stripe y Functions | Hay validaciones y endurecimiento preparados en el trabajo de seguridad. | No considerar completado el despliegue de producción hasta validar los webhooks y secretos en el entorno correspondiente. El despliegue de Functions está bloqueado mientras el proyecto no tenga facturación habilitada. |
| Sentry | `beforeSend` filtra claves sensibles en objetos anidados, cabeceras, contexto, migas y URLs; elimina cuerpo/cookies y datos de usuario/IP. | Las pruebas de `security/sentry-scrub.js` cubren los casos básicos. Añadir claves nuevas al filtro cuando se amplíen los datos registrados. |
| Secretos y código | GitHub Actions ejecuta Gitleaks, Semgrep, auditorías de dependencias y CodeQL; Dependabot revisa actualizaciones. Hay un hook local Gitleaks en `.githooks/pre-commit`. | El hook se configura localmente y cada desarrollador debe instalarlo. CI debe seguir siendo la comprobación compartida. En la última revisión GitHub señaló 1 alerta alta y 1 moderada en `main`; deben comprobarse en **Security → Dependabot alerts** antes de cerrar esa deuda. |
| Pruebas de perímetro | `scripts/scan-zap-local.ps1` permite ZAP pasivo solo en loopback. | La última pasada local recorrió 61 URLs sin escaneo activo: 0 alertas altas, 2 medias, 1 baja y 2 informativas. Las alertas de cabeceras correspondían al servidor local; ZAP también señaló recursos sin SRI. No ejecutar contra producción. |
| Analítica | Todas las páginas canónicas de `/es/` cargan `/gtm.js`. El contenedor publicado contiene la etiqueta GA4 de Lixby. El gestor usa Consent Mode v2 denegado por defecto y carga GTM solo tras aceptar. | La aceptación concede `analytics_storage`; publicidad y personalización permanecen denegadas. Rechazar no carga GTM. No añadir una segunda etiqueta `gtag.js`: duplicaría la medición. No enviar a GA nombres, emails, direcciones, IDs de cuenta ni texto libre. |

La respuesta pública observada ya incluía HSTS, CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` y `X-Frame-Options`; esto no confirma que todas las rutas ni todos los despliegues tengan siempre los mismos valores.

## 4. Reglas para desarrollo y despliegue

1. Trabajar en una rama y revisar el diff antes de preparar archivos. No incluir cambios de páginas, secretos o informes locales ajenos al cambio de seguridad.
2. Ejecutar Gitleaks en el hook y revisar los resultados de Gitleaks, Semgrep, CodeQL y auditoría de dependencias en CI. No silenciar hallazgos con exclusiones amplias; justificar cada excepción en el código de configuración.
3. Aplicar mínimo privilegio a cuentas de servicio, tokens de GitHub y accesos a Firebase, Cloudflare, Railway, Stripe y Sentry. Activar MFA para accesos administrativos y usar credenciales de producción solo en sus gestores de secretos.
4. Probar reglas de Firestore, funciones, pagos y cambios de autenticación en emuladores o entornos de prueba. No probar tarjetas reales ni secretos de producción en local.
5. Desplegar las reglas de base de datos por separado cuando sea posible. Después comprobar login, registro, recuperación, permisos de cuenta, comunidad y compra con cuentas de prueba.
6. Para cambios de Cloudflare, revisar CSP en modo efectivo y eventos de seguridad tras probar login, reCAPTCHA, pagos, fuentes y APIs. No activar protección de bots global sin observar falsos positivos.
7. Para App Check, verificar tráfico legítimo en métricas antes de hacer enforcement. No usar tokens de depuración en producción.
8. ZAP se limita al entorno local o a un entorno de pruebas expresamente aislado. El script incluido rechaza hosts públicos y HTTPS. Los reportes locales permanecen en `artifacts/security/`, ignorado por Git.
9. No fusionar una release con checks de seguridad fallidos sin una evaluación escrita, responsable y fecha para resolver el hallazgo.

## 5. Respuesta a incidentes

Si se sospecha exposición de credenciales, acceso indebido o filtración de datos:

1. **Contener:** revocar o rotar la credencial afectada, cerrar sesiones/tokens comprometidos y limitar el endpoint o permiso afectado.
2. **Preservar evidencia:** guardar hora, alcance, logs pertinentes y revisiones de código sin copiar datos personales innecesarios a canales públicos.
3. **Evaluar impacto:** identificar sistemas, cuentas, datos y usuarios afectados; distinguir actividad confirmada de indicios.
4. **Recuperar:** corregir la causa, desplegar con verificación y comprobar que la credencial anterior ya no funciona.
5. **Comunicar y aprender:** informar a las personas y autoridades cuando corresponda, documentar decisiones y crear acciones con responsable y seguimiento.

No borrar logs ni reescribir el historial como única respuesta a un secreto filtrado. La medida principal es invalidar el secreto y revisar sus usos.

## 6. Revisión periódica

- Revisar alertas de GitHub, dependencias y credenciales al menos semanalmente y antes de una release.
- Confirmar periódicamente que reglas de Firestore, cabeceras de Hosting y configuraciones de Cloudflare coinciden con el comportamiento desplegado.
- Repetir pruebas de emulador después de cambios de reglas; repetir un escaneo ZAP pasivo en el entorno de pruebas cuando cambien rutas, cabeceras o dependencias web.
- Revisar acceso administrativo, MFA, usuarios de servicio y secretos con una persona responsable; retirar accesos que ya no sean necesarios.
- No tomar la ausencia de alertas de escáner como prueba de que un sistema es seguro; combinar revisión de código, configuración, pruebas y operación.

## 7. Notificación responsable

Envía vulnerabilidades de forma privada a **[info@lixby.es](mailto:info@lixby.es)** con descripción, pasos de reproducción, impacto y una prueba de concepto sin datos reales. No publiques detalles explotables ni accedas a cuentas o datos de terceros. La política de divulgación está en [`SECURITY.md`](../../SECURITY.md).
