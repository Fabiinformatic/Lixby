const fs = require("fs");
const path = require("path");
const functions = require("firebase-functions");
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const crypto = require("crypto");
const Stripe = require("stripe");
const sgMail = require("@sendgrid/mail");
const { Resend } = require("resend");

if (!admin.apps.length) {
  admin.initializeApp();
}

const stripe = new Stripe("TU_STRIPE_SECRET_KEY");
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");
const sitemapPath = path.join(__dirname, "generated", "sitemap.xml");

function generateAccountNumber() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.randomBytes(15);
  const random = Array.from(bytes, (byte) => chars[byte % chars.length]).join("");
  return `NLX-${random}`;
}

exports.ensureAccountNumber = onCall({
  region: "us-central1",
  cors: ["https://lixby.es", "https://www.lixby.es"],
  invoker: "public",
}, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "No autenticado");
  }

  const db = admin.firestore();
  const userRef = db.collection("users").doc(uid);

  try {
    return await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      const existingAccountNumber = userDoc.data()?.accountNumber;
      if (existingAccountNumber) {
        return { accountNumber: existingAccountNumber };
      }

      let accountNumber = "";
      let accountNumberRef = null;

      for (let attempt = 0; attempt < 10; attempt += 1) {
        accountNumber = generateAccountNumber();
        const candidateRef = db.collection("accountNumbers").doc(accountNumber);
        const candidateDoc = await transaction.get(candidateRef);
        if (!candidateDoc.exists) {
          accountNumberRef = candidateRef;
          break;
        }
      }

      if (!accountNumberRef) {
        throw new HttpsError("resource-exhausted", "No se pudo generar un numero de cuenta unico.");
      }

      transaction.set(accountNumberRef, {
        uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.set(userRef, {
        accountNumber,
        accountNumberCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      return { accountNumber };
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error("Error ensuring account number:", error);
    throw new HttpsError("internal", "No se pudo preparar el numero de cuenta.");
  }
});

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

exports.sendWelcomeEmail = onCall(
  { secrets: [SENDGRID_API_KEY], region: "europe-west1" },
  async (request) => {
    const { name, email } = request.data;

    if (!email || !name) {
      throw new HttpsError("invalid-argument", "Faltan name o email.");
    }

    sgMail.setApiKey(SENDGRID_API_KEY.value());

    await sgMail.send({
      to: email,
      from: { email: "info@lixby.es", name: "Lixby" },
      replyTo: "soporte@lixby.es",
      subject: `Bienvenido a Lixby, ${name} 🎉`,
      html: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
    <div style="max-width: 600px; margin: auto; background: white; padding: 30px; border-radius: 12px;">
        <h1 style="color: #2563eb; text-align: center;">¡Bienvenido a Lixby!</h1>
        <p>Hola ${name},</p>
        <p>Gracias por crear una cuenta en <strong>Lixby</strong>. Tu cuenta ya está lista y puedes empezar a utilizar nuestros servicios.</p>
        <p>Estamos encantados de tenerte con nosotros.</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="https://lixby.es" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Ir a Lixby</a>
        </div>
        <hr>
        <p style="font-size: 12px; color: #666;">Este correo ha sido enviado automáticamente por Lixby. Si no has creado esta cuenta, puedes ignorar este mensaje.</p>
        <p style="font-size: 12px; color: #666;">© 2026 Lixby. Todos los derechos reservados.</p>
    </div>
</body>
</html>`,
      text: `Hola ${name},\n\nGracias por crear una cuenta en Lixby. Tu cuenta ya está lista.\n\nIr a Lixby: https://lixby.es\n\n— Lixby`
    });

    return { success: true };
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
