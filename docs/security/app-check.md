# App Check para Firestore

La web usa una sola Firebase Web App en todos los idiomas. Los clientes que usan Firestore inicializan App Check desde `/js/firebase-app-check.js`; la clave pública se lee de `/js/firebase-app-check-config.json`, que tiene una caché de cinco minutos.

## Activación pendiente

`siteKey` está vacío hasta registrar una clave de reCAPTCHA Enterprise. El cliente no envía tokens de App Check mientras esté vacío y Firestore sigue sin enforcement. No actives enforcement todavía.

1. En Google Cloud crea una clave web de reCAPTCHA Enterprise y permite `lixby.es`, `www.lixby.es` y el dominio de pruebas que uses.
2. En Firebase Console abre **Security → App Check**, registra la app web `1:1058088945026:web:c56eaa9c71f1ca625fbb9b` con el proveedor reCAPTCHA Enterprise y guarda allí la clave secreta.
3. Pon la clave pública en `js/firebase-app-check-config.json` (campo `siteKey`). No guardes la clave secreta en el repositorio ni en el navegador.
4. Despliega el sitio y confirma que los clientes de todos los idiomas aparecen como verificados en **Security → App Check → APIs → Cloud Firestore**.
5. Deja la integración en monitorización hasta confirmar tráfico legítimo verificado y después activa enforcement solo para Cloud Firestore.

Firebase App Check no tiene coste dentro de las cuotas gratuitas del proveedor; el uso que supere la cuota puede tener coste según el proveedor. Firebase recomienda primero monitorizar y revisar solicitudes no verificadas antes de exigir tokens.

La app está preparada, pero la configuración remota no se ha registrado y no se ha activado enforcement porque requiere la clave del proveedor y acceso a Firebase Console. No uses un token de depuración en producción.
