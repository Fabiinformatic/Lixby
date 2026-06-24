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
const sanitizeHtml = require("sanitize-html");

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
    if (!email || !name) throw new HttpsError("invalid-argument", "Faltan name o email.");

    const db = admin.firestore();
    const doc = await db.collection("emailTemplates").doc("welcome").get();

    let html, subject;

    if (doc.exists) {
      const template = doc.data();
      html = (template.html || "").replace(/{{name}}/g, name);
      subject = (template.subject || "Bienvenido a Lixby").replace(/{{name}}/g, name);
    } else {
      subject = `Bienvenido a Lixby, ${name} 🎉`;
      html = `

¡Bienvenido a Lixby!
Hola ${name},

Gracias por crear una cuenta en **Lixby**. Tu cuenta ya está lista y puedes empezar a utilizar nuestros servicios.

Estamos encantados de tenerte con nosotros.

[Ir a Lixby](https://lixby.es)

---

Este correo ha sido enviado automáticamente por Lixby. Si no has creado esta cuenta, puedes ignorar este mensaje.

© 2026 Lixby. Todos los derechos reservados.

`;
    }

    sgMail.setApiKey(SENDGRID_API_KEY.value());
    await sgMail.send({
      to: email,
      from: { email: "info@lixby.es", name: "Lixby" },
      replyTo: "soporte@lixby.es",
      subject,
      html,
      text: sanitizeHtml(html, { allowedTags: [], allowedAttributes: {}, decodeEntities: true }).trim()
    });

    return { success: true };
  }
);

exports.sendLixbyEmail = onCall(
  { secrets: [SENDGRID_API_KEY], region: "europe-west1" },
  async (request) => {
    const { templateId, to, variables = {} } = request.data;
    if (!templateId || !to) throw new HttpsError("invalid-argument", "Faltan templateId o to.");

    const db = admin.firestore();
    const doc = await db.collection("emailTemplates").doc(templateId).get();
    if (!doc.exists) throw new HttpsError("not-found", `Plantilla '${templateId}' no encontrada.`);

    const template = doc.data();
    let html = template.html || "";
    let subject = template.subject || "";

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      html = html.replace(regex, value);
      subject = subject.replace(regex, value);
    });

    sgMail.setApiKey(SENDGRID_API_KEY.value());
    await sgMail.send({
      to,
      from: { email: template.fromEmail || "info@lixby.es", name: template.fromName || "Lixby" },
      replyTo: "soporte@lixby.es",
      subject,
      html,
      text: sanitizeHtml(html, { allowedTags: [], allowedAttributes: {}, decodeEntities: true }).trim()
    });

    await db.collection("emailLogs").add({
      templateId,
      to,
      subject,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      variables
    });

    return { success: true };
  }
);

exports.sendNewsletter = onCall(
  { secrets: [SENDGRID_API_KEY], region: "europe-west1" },
  async (request) => {
    const { templateId, segment = "all", testMode = false, testEmail = "" } = request.data;

    if (!templateId) throw new HttpsError("invalid-argument", "Falta templateId.");

    // Leer plantilla
    const db = admin.firestore();
    const tplDoc = await db.collection("emailTemplates").doc(templateId).get();
    if (!tplDoc.exists) throw new HttpsError("not-found", `Plantilla '${templateId}' no encontrada.`);
    const template = tplDoc.data();

    // Modo test: enviar solo a un email
    if (testMode) {
      if (!testEmail) throw new HttpsError("invalid-argument", "Falta testEmail en modo test.");
      sgMail.setApiKey(SENDGRID_API_KEY.value());
      await sgMail.send({
        to: testEmail,
        from: { email: template.fromEmail || "info@lixby.es", name: "Lixby" },
        replyTo: "soporte@lixby.es",
        subject: template.subject || "Newsletter Lixby",
        html: (template.html || "").replace(/{{name}}/g, "Usuario Test"),
        text: sanitizeHtml(template.html || "", { allowedTags: [], allowedAttributes: {}, decodeEntities: true }).trim()
      });
      return { success: true, sent: 1, mode: "test" };
    }

    // Leer usuarios de Firestore
    const usersSnap = await db.collection("users").get();
    const recipients = [];

    for (const userDoc of usersSnap.docs) {
      const profileSnap = await db.collection("users").doc(userDoc.id).collection("profile").limit(1).get();
      let profile = null;

      // Intentar como subcolección
      if (!profileSnap.empty) {
        profile = profileSnap.docs[0].data();
      } else {
        // Intentar como campo directo
        const directDoc = await db.collection("users").doc(userDoc.id).get();
        const data = directDoc.data();
        if (data && data.profile) {
          profile = data.profile;
        } else if (data && data.email) {
          profile = data;
        }
      }

      if (!profile || !profile.email) continue;

      if (segment === "adsOptIn" && !profile.adsOptIn) continue;
      if (segment === "mediaOptIn" && !profile.mediaOptIn) continue;

      recipients.push({
        email: profile.email,
        name: profile.firstName || "usuario"
      });
    }

    if (!recipients.length) {
      return { success: true, sent: 0, mode: "live" };
    }

    // Enviar en lotes de 10 para no saturar SendGrid
    sgMail.setApiKey(SENDGRID_API_KEY.value());
    let sent = 0;
    const batchSize = 10;

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      await Promise.all(batch.map(async (recipient) => {
        try {
          const html = (template.html || "").replace(/{{name}}/g, recipient.name);
          const subject = (template.subject || "").replace(/{{name}}/g, recipient.name);
          await sgMail.send({
            to: recipient.email,
            from: { email: template.fromEmail || "info@lixby.es", name: "Lixby" },
            replyTo: "soporte@lixby.es",
            subject,
            html,
            text: sanitizeHtml(html, { allowedTags: [], allowedAttributes: {}, decodeEntities: true }).trim()
          });
          sent++;
        } catch (e) {
          console.error(`Error enviando a ${recipient.email}:`, e.message);
        }
      }));
    }

    // Registrar en logs
    await db.collection("newsletterLogs").add({
      templateId,
      segment,
      sent,
      total: recipients.length,
      sentAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, sent, total: recipients.length, mode: "live" };
  }
);

exports.sendEmailToUser = onCall(
  { secrets: [SENDGRID_API_KEY], region: "europe-west1" },
  async (request) => {
    const { templateId, to, variables = {} } = request.data;
    if (!templateId || !to) throw new HttpsError("invalid-argument", "Faltan templateId o to.");

    const db = admin.firestore();
    const tplDoc = await db.collection("emailTemplates").doc(templateId).get();
    if (!tplDoc.exists) throw new HttpsError("not-found", `Plantilla '${templateId}' no encontrada.`);

    const template = tplDoc.data();
    let html = template.html || "";
    let subject = template.subject || "";

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      html = html.replace(regex, value);
      subject = subject.replace(regex, value);
    });

    sgMail.setApiKey(SENDGRID_API_KEY.value());
    
    // Sanitizar HTML para generar texto plano seguro
    const plainText = sanitizeHtml(html, {
      allowedTags: [],
      allowedAttributes: {},
      decodeEntities: true
    }).trim();
    
    await sgMail.send({
      to,
      from: { email: template.fromEmail || "info@lixby.es", name: "Lixby" },
      replyTo: "soporte@lixby.es",
      subject,
      html,
      text: plainText
    });

    await db.collection("emailLogs").add({
      templateId,
      to,
      subject,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      variables,
      source: "manual"
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

exports.adminSearchUser = onCall(
  { region: "europe-west1" },
  async (request) => {
    const { email, nlx } = request.data;

    const db = admin.firestore();

    if (nlx) {
      const snap = await db.collectionGroup("profiles")
        .where("accountNumber", "==", nlx)
        .limit(1)
        .get();

      if (!snap.empty) {
        const doc = snap.docs[0];
        return { userData: doc.data(), uid: doc.ref.parent.parent?.id || null };
      }

      const snap2 = await db.collection("users")
        .where("accountNumber", "==", nlx)
        .limit(1)
        .get();
      if (!snap2.empty) {
        const doc2 = snap2.docs[0];
        return { userData: doc2.data(), uid: doc2.id };
      }
    }

    if (email) {
      const snap = await db.collection("users")
        .where("email", "==", email)
        .limit(1)
        .get();

      if (!snap.empty) {
        const doc = snap.docs[0];
        return { userData: doc.data(), uid: doc.id };
      }

      const snap2 = await db.collectionGroup("profiles")
        .where("email", "==", email)
        .limit(1)
        .get();
      if (!snap2.empty) {
        const doc2 = snap2.docs[0];
        return { userData: doc2.data(), uid: doc2.ref.parent.parent?.id || null };
      }
    }

    return { userData: null, uid: null };
  }
);
