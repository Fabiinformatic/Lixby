const functions = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Stripe = require("stripe");
const { Resend } = require("resend");

admin.initializeApp();

const stripe = new Stripe("TU_STRIPE_SECRET_KEY");
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

// ✅ Tu función de Stripe que ya tenías
exports.stripeWebhook = functions.https.onRequest((req, res) => {
  if (req.method !== "POST") {
    res.status(400).send("Método no permitido");
    return;
  }

  const event = req.body;

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const email = session.customer_details.email;
    const orderId = session.id;

    console.log("Pedido completado");
    console.log("Email:", email);
    console.log("Pedido:", orderId);
  }

  res.json({ received: true });
});

// ✅ Nueva función para resetear contraseña con Resend
exports.sendPasswordReset = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "https://lixby.es");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const { email } = req.body || {};
  if (!email) {
    res.status(400).json({ error: "Email requerido" });
    return;
  }

  try {
    const resetLink = await admin.auth().generatePasswordResetLink(email, {
      url: "https://lixby.com/reset-password",
      handleCodeInApp: false,
    });

    const resend = new Resend(RESEND_API_KEY.value());

    await resend.emails.send({
      from: "Lixby <no-reply@lixby.com>",
      to: email,
      subject: "Restablece tu contraseña",
      html: `
          <h2>Restablecer contraseña</h2>
          <p>Haz clic aquí:</p>
          <a href="${resetLink}">Cambiar contraseña</a>
          <p>Si no fuiste tú, ignora este mensaje.</p>
        `,
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Error interno" });
  }
});
