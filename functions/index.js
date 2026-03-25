const functions = require("firebase-functions");
const { onCall } = require("firebase-functions/v2/https");
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
exports.sendPasswordReset = onCall(
  { secrets: [RESEND_API_KEY] },
  async (request) => {
    const { email } = request.data;

    if (!email) {
      throw new Error("Email requerido");
    }

    try {
      const resetLink = await admin.auth().generatePasswordResetLink(email);

      const resend = new Resend(RESEND_API_KEY.value());

      await resend.emails.send({
        from: "noreply@lixby.es",
        to: email,
        subject: "Restablece tu contraseña - Lixby",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto;">
            <h2>Restablecer contraseña</h2>
            <p>Hola, recibimos una solicitud para restablecer tu contraseña.</p>
            <a href="${resetLink}" 
               style="background:#4F46E5; color:white; padding:12px 24px; 
                      border-radius:6px; text-decoration:none; display:inline-block;">
              Restablecer contraseña
            </a>
            <p style="color:#888; margin-top:20px; font-size:13px;">
              Si no lo solicitaste, ignora este correo.
            </p>
          </div>
        `,
      });

      return { success: true };

    } catch (error) {
      console.error("Error:", error);
      throw new Error("No se pudo enviar el correo");
    }
  }
);