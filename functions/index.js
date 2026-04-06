const fs = require("fs");
const path = require("path");
const functions = require("firebase-functions");
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Stripe = require("stripe");
const { Resend } = require("resend");

admin.initializeApp();

const stripe = new Stripe("TU_STRIPE_SECRET_KEY");
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const sitemapPath = path.join(__dirname, "generated", "sitemap.xml");

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
exports.sendPasswordReset = onRequest(
  {
    cors: ["https://lixby.es", "http://127.0.0.1:5500"],
  },
  async (req, res) => {
    // Explicit headers to ensure preflight succeeds on Cloud Run.
    res.set("Access-Control-Allow-Origin", "https://lixby.es");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: "Email requerido" });
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
        template: "167fe7df-2a0f-42af-b27a-45ca54a0fcb0",
        variables: {
          resetLink,
        },
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error:", error);
      return res.status(500).json({ error: "Error interno" });
    }
  }
);

exports.sitemap = onRequest((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const sitemapXml = fs.readFileSync(sitemapPath, "utf8");
    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=300, s-maxage=3600");

    if (req.method === "HEAD") {
      return res.status(200).end();
    }

    return res.status(200).send(sitemapXml);
  } catch (error) {
    console.error("Error serving sitemap:", error.message);
    return res.status(500).send("Sitemap unavailable");
  }
});
