# Probar el webhook de Stripe sin tocar producción

El modo local solo arranca si están activos todos estos resguardos:

- `WEBHOOK_TEST_MODE=1`
- `STRIPE_SECRET_KEY` empieza por `sk_test_`
- `STRIPE_WEBHOOK_SECRET` contiene el secreto temporal que entrega `stripe listen`
- `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`
- `EMAIL_DRY_RUN=1`

Guarda los valores únicamente en el `.env` local, que está excluido de Git. No uses claves `sk_live_` ni el secreto de un endpoint real.

Con una sesión autenticada de Stripe CLI y los valores locales configurados:

1. Inicia el emulador: `firebase emulators:start --only firestore --project demo-lixby`.
2. En otra terminal inicia `stripe listen --forward-to localhost:3000/webhook` y copia el secreto temporal que muestra a `STRIPE_WEBHOOK_SECRET` en el `.env`.
3. En una tercera terminal inicia `node server.js`.
4. Ejecuta `stripe trigger checkout.session.completed`.

El webhook solo puede escribir en Firestore Emulator y las funciones de correo no envían mensajes cuando `EMAIL_DRY_RUN=1`. Repite la prueba después de reiniciar el servidor con el secreto temporal de escucha vigente.
