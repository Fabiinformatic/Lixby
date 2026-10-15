const fs = require("fs");
const path = require("path");
const functions = require("firebase-functions");
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const crypto = require("crypto");
const Stripe = require("stripe");
const sgMail = require("@sendgrid/mail");
const { Resend } = require("resend");
const sanitizeHtml = require("sanitize-html");
const { checkText, isReservedName } = require("./moderation-filter");

if (!admin.apps || admin.apps.length === 0) {
  admin.initializeApp();
}

// FieldValue vía subpath modular: el emulador de Firebase stubea el namespace
// legacy de firebase-admin y eso hace que admin.firestore.FieldValue sea
// undefined en los workers; el subpath "firebase-admin/firestore" no se
// stubea y funciona igual en producción (v13+) y en v14.
const { FieldValue } = require("firebase-admin/firestore");

const stripe = new Stripe("TU_STRIPE_SECRET_KEY");
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");
// Secreto para hashear la IP de communityTrackView (HMAC-SHA256) antes de
// guardarla en rateLimits: no se guarda la IP en claro y un volcado de la
// colección no expone direcciones. Crearlo ANTES de desplegar:
//   firebase functions:secrets:set IP_HASH_SECRET
const IP_HASH_SECRET = defineSecret("IP_HASH_SECRET");
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
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(userRef, {
        accountNumber,
        accountNumberCreatedAt: FieldValue.serverTimestamp(),
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
      sentAt: FieldValue.serverTimestamp(),
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
      sentAt: FieldValue.serverTimestamp()
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
      sentAt: FieldValue.serverTimestamp(),
      variables,
      source: "manual"
    });

    return { success: true };
  }
);

exports.sitemap = onRequest({ maxInstances: 10 }, (req, res) => {
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
  { region: "europe-west1", invoker: "public" },
  async (request) => {
    const { email, nlx } = request.data;
    const db = admin.firestore();

    const searchUserDoc = async (field, value) => {
      const snap = await db.collection("users")
        .where(field, "==", value)
        .limit(1)
        .get();
      if (!snap.empty) {
        const doc = snap.docs[0];
        return { userData: doc.data(), uid: doc.id };
      }
      return null;
    };

    try {
      if (nlx) {
        const result = await searchUserDoc("accountNumber", nlx);
        if (result) return result;
      }

      if (email) {
        const normalized = email.toLowerCase().trim();
        const result = await searchUserDoc("email", normalized);
        if (result) return result;

        const result2 = await searchUserDoc("email", email);
        if (result2) return result2;
      }

      return { userData: null, uid: null };
    } catch (error) {
      console.error("adminSearchUser error:", error);
      throw new HttpsError("internal", "Error al buscar usuario: " + error.message);
    }
  }
);

// =====================================================================
// Comunidad Lixby (/es/comunidad)
// Callables + triggers del foro. Región europe-west1.
// El uid siempre procede de request.auth (token verificado), nunca del cliente.
// Ver docs/comunidad/modelo-de-datos.md y firestore.rules.
// =====================================================================

const COMMUNITY_REGION = "europe-west1";
// El emulador de Functions define FUNCTIONS_EMULATOR=true por sí solo; en
// producción esa variable no existe, así que los orígenes locales extra son
// inertes fuera del emulador (pero imprescindibles para probar desde
// 127.0.0.1/localhost:5000, donde el SDK envía el Origin del navegador).
const COMMUNITY_EMU = process.env.FUNCTIONS_EMULATOR === "true";
const COMMUNITY_CORS = [
  "https://lixby.es",
  "https://www.lixby.es",
  ...(COMMUNITY_EMU ? ["http://127.0.0.1:5000", "http://localhost:5000"] : []),
];
const COMMUNITY_CALL_OPTIONS = {
  region: COMMUNITY_REGION,
  cors: COMMUNITY_CORS,
  invoker: "public",
  // denial-of-wallet: las callables públicas escalan solas; un ataque no debe
  // poder disparar la factura. Junto con la alerta de presupuesto de Google
  // Cloud es la red que evita que un loop de llamadas nos arruine.
  maxInstances: 10,
  // TODO(lanzamiento): poner a true SOLO cuando el sitio esté registrado en
  // App Check (console → App Check) y el cliente inicialice initializeAppCheck
  // con un reCAPTCHA v3 válido. Con true y sin tokens, TODAS las callables de
  // la comunidad dejan de responder en producción.
  enforceAppCheck: false,
};
// communityTrackView es la callable más expuesta (pública y escribe en
// Firestore) y la única que necesita el secreto para hashear la IP.
const COMMUNITY_TRACK_OPTIONS = {
  ...COMMUNITY_CALL_OPTIONS,
  secrets: [IP_HASH_SECRET],
};
const COMMUNITY_TAGS = ["pregunta", "idea", "bug", "showcase"];
const COMMUNITY_REASONS = ["spam", "abuse", "illegal", "off-topic", "other"];
const COMMUNITY_ROLES = ["owner", "mod", "admin"];
const POST_TITLE_MIN = 3;
const POST_TITLE_MAX = 140;
const POST_BODY_MAX = 10000;
const COMMENT_BODY_MAX = 4000;
const COMMENT_MAX_DEPTH = 5;
const COMMUNITY_RATE_LIMITS = {
  post: { max: 5, windowMs: 15 * 60 * 1000 },
  comment: { max: 20, windowMs: 15 * 60 * 1000 },
  report: { max: 10, windowMs: 60 * 60 * 1000 },
  profile: { max: 10, windowMs: 60 * 60 * 1000 },
  view: { max: 60, windowMs: 60 * 60 * 1000 }, // por IP (visitantes sin sesión)
  commentView: { max: 300, windowMs: 60 * 60 * 1000 }, // por IP (una por comentario visto)
};
const POST_ID_RE = /^[A-Za-z0-9]{1,40}$/;

function requireCommunityAuth(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Inicia sesión para continuar.");
  return uid;
}

// Exige correo verificado en las callables que escriben contenido o perfil.
// El límite por uid no frena a quien crea cuentas en masa: con correo
// verificado cada cuenta necesita una bandeja real. El registro de la web ya
// envía el correo de verificación (es/iniciar-sesion) y la cuenta puede
// reenviarlo desde /es/cuenta/.
function requireVerifiedCommunityEmail(request) {
  if (request.auth?.token?.email_verified !== true) {
    throw new HttpsError(
      "failed-precondition",
      "Verifica tu correo electrónico para participar. Revisa tu bandeja de entrada (y spam) o reenvía el correo desde tu cuenta."
    );
  }
}

function requireCommunityRole(request, roles = COMMUNITY_ROLES) {
  const uid = requireCommunityAuth(request);
  if (!roles.includes(request.auth?.token?.role)) {
    throw new HttpsError("permission-denied", "No tienes permisos para esta acción.");
  }
  return uid;
}

function cleanCommunityText(value, maxLen) {
  if (typeof value !== "string") return "";
  const clean = sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {},
    decodeEntities: true,
  })
    // Caracteres de control bidireccional (U+202E y similares): permiten
    // invertir lo que se ve y falsear títulos o nombres ("noitamrofni lasnep"
    // se lee al revés). Fuera también los marcas de dirección LRM/RLM y los
    // isolados U+2066-U+2069.
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "")
    .trim();
  return clean.length > maxLen ? clean.slice(0, maxLen) : clean;
}

const MODERATION_MSG =
  "Tu mensaje incumple las normas de la comunidad. Reformúlalo sin insultos ni lenguaje ofensivo.";

// Contador de bloqueos por mes y categoría. Nunca guarda uid ni texto. Un fallo
// aquí no debe dejar pasar el contenido: si falla, se registra y se sigue.
async function countBlocked(category) {
  try {
    const db = admin.firestore();
    const month = new Date().toISOString().slice(0, 7);
    await db.doc(`moderationStats/${month}`).set(
      { [category]: FieldValue.increment(1) },
      { merge: true }
    );
  } catch (e) {
    console.error("moderationStats", e);
  }
}

// Se llama con el texto ya limpiado y antes de escribir nada. El filtro vive
// solo en el servidor: un filtro en el navegador se saltaría llamando al
// callable a mano. Es async: hay que awaitarla en TODOS los callables (si falta
// un await, el filtro no bloquea y no da error).
async function assertCleanText(...parts) {
  const result = checkText(parts.filter(Boolean).join("\n"));
  if (!result.ok) {
    await countBlocked(result.category);
    throw new HttpsError("invalid-argument", MODERATION_MSG);
  }
}

// `key` es el uid (acciones con sesión) o un identificador de IP (visitantes).
async function enforceCommunityRateLimitFor(key, action) {
  const config = COMMUNITY_RATE_LIMITS[action];
  if (!config) return;
  const db = admin.firestore();
  const ref = db.collection("rateLimits").doc(`${key}_${action}`);
  const now = Date.now();
  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref);
    const data = doc.exists ? doc.data() : null;
    if (!data || now - (data.windowStart || 0) > config.windowMs) {
      transaction.set(ref, {
        key,
        action,
        count: 1,
        windowStart: now,
        // TTL: la colección rateLimits no debe crecer sin fin. Hay que activar
        // en Firestore la política TTL sobre el campo `expiresAt` (consola →
        // Firestore → Time-to-live). Un margen extra sobre la ventana evita
        // borrar un documento que aún está en uso.
        expiresAt: new Date(now + config.windowMs + 60 * 60 * 1000),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }
    if ((data.count || 0) >= config.max) {
      throw new HttpsError("resource-exhausted", "Has hecho demasiadas acciones seguidas. Inténtalo más tarde.");
    }
    transaction.update(ref, {
      count: (data.count || 0) + 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

// La cabecera x-forwarded-for la controla quien llama: puede mandar lo que
// quiera al PRINCIPIO de la lista. La infraestructura de Google (GFE / Cloud
// Run functions) añade su entrada al FINAL, así que la última IP es la única
// que el cliente no puede falsear. Además saltamos las entradas privadas o
// reservadas (saltos internos de la plataforma) para quedarnos con la primera
// IP pública empezando por la derecha. Nunca se usa la primera entrada.
const PRIVATE_IP_RE = /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|0\.0\.0\.0$|::1$|f[cd][0-9a-f]{2}:|fe80:)/i;
const IP_RE = /^(?:\d{1,3}(?:\.\d{1,3}){3}|[0-9a-f:]+)$/i;

function resolveTrustedClientIp(request) {
  const fwd = request.rawRequest?.headers?.["x-forwarded-for"];
  const raw = Array.isArray(fwd) ? fwd.join(",") : String(fwd || "");
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => IP_RE.test(part));
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (!PRIVATE_IP_RE.test(parts[i])) return parts[i];
  }
  return parts[parts.length - 1] || String(request.rawRequest?.ip || "unknown");
}

async function enforceCommunityRateLimit(uid, action) {
  return enforceCommunityRateLimitFor(uid, action);
}

async function resolveCommunityDisplayName(uid) {
  const db = admin.firestore();
  const profile = await db.collection("profiles").doc(uid).get();
  if (profile.exists && profile.data().displayName) return profile.data().displayName;

  const user = await db.collection("users").doc(uid).get();
  const data = user.exists ? user.data() : {};
  const nested = data.profile || {};
  return data.displayName || nested.displayName || data.firstName || nested.firstName || "Usuario";
}

function communityProfileCounterPayload(uid, field, delta, displayName) {
  const payload = {
    uid,
    [field]: FieldValue.increment(delta),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (displayName) payload.displayName = displayName;
  return payload;
}

// Retirada de contenido. El cuerpo se vacía siempre en el documento público.
// Si la retirada la hace moderación, además se conserva en `removedBody` (solo
// legible por moderadores, porque un documento retirado ya no es legible por
// el cliente) para atender reclamaciones. Si la retirada la pide el propio
// autor, no se conserva copia: quiere su contenido fuera.
function removalUpdate({ body, moderatorUid, reason, archive }) {
  const update = {
    status: "removed",
    body: "",
    removedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (archive) {
    update.removedBody = typeof body === "string" ? body : "";
    update.removedByUid = moderatorUid;
    if (reason) update.removedReason = reason;
  }
  return update;
}

exports.communityCreatePost = onCall(COMMUNITY_CALL_OPTIONS, async (request) => {
  const uid = requireCommunityAuth(request);
  requireVerifiedCommunityEmail(request);
  const db = admin.firestore();

  const spaceId = typeof request.data?.spaceId === "string" ? request.data.spaceId : "";
  const title = cleanCommunityText(request.data?.title, POST_TITLE_MAX);
  const body = cleanCommunityText(request.data?.body, POST_BODY_MAX);
  const tags = Array.isArray(request.data?.tags)
    ? request.data.tags.filter((tag) => COMMUNITY_TAGS.includes(tag)).slice(0, COMMUNITY_TAGS.length)
    : [];

  if (!spaceId) throw new HttpsError("invalid-argument", "Falta el espacio.");
  if (title.length < POST_TITLE_MIN) throw new HttpsError("invalid-argument", "El título es demasiado corto.");
  if (!body) throw new HttpsError("invalid-argument", "El contenido no puede estar vacío.");
  await assertCleanText(title, body);

  const space = await db.collection("spaces").doc(spaceId).get();
  if (!space.exists) throw new HttpsError("not-found", "El espacio indicado no existe.");

  await enforceCommunityRateLimit(uid, "post");

  const displayName = await resolveCommunityDisplayName(uid);
  const postRef = db.collection("posts").doc();
  await postRef.set({
    spaceId,
    authorUid: uid,
    authorName: displayName,
    title,
    body,
    tags,
    status: "published",
    score: 0,
    upvotes: 0,
    downvotes: 0,
    commentCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastActivityAt: FieldValue.serverTimestamp(),
    editedAt: null,
  });

  return { id: postRef.id };
});

exports.communityEditPost = onCall(COMMUNITY_CALL_OPTIONS, async (request) => {
  const uid = requireCommunityAuth(request);
  requireVerifiedCommunityEmail(request);
  const db = admin.firestore();

  const postId = request.data?.postId;
  if (!postId) throw new HttpsError("invalid-argument", "Falta el identificador del hilo.");

  const postRef = db.collection("posts").doc(postId);
  const snap = await postRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "El hilo no existe.");
  if (snap.data().authorUid !== uid) throw new HttpsError("permission-denied", "No eres el autor de este hilo.");
  if (snap.data().status !== "published") throw new HttpsError("failed-precondition", "Este hilo ya no se puede editar.");

  const title = cleanCommunityText(request.data?.title, POST_TITLE_MAX);
  const body = cleanCommunityText(request.data?.body, POST_BODY_MAX);
  if (title.length < POST_TITLE_MIN) throw new HttpsError("invalid-argument", "El título es demasiado corto.");
  if (!body) throw new HttpsError("invalid-argument", "El contenido no puede estar vacío.");
  await assertCleanText(title, body);

  await postRef.update({
    title,
    body,
    editedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { success: true };
});

exports.communityRemovePost = onCall(COMMUNITY_CALL_OPTIONS, async (request) => {
  const uid = requireCommunityAuth(request);
  const db = admin.firestore();

  const postId = request.data?.postId;
  if (!postId) throw new HttpsError("invalid-argument", "Falta el identificador del hilo.");

  const postRef = db.collection("posts").doc(postId);
  const snap = await postRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "El hilo no existe.");

  const isAuthor = snap.data().authorUid === uid;
  const isModerator = COMMUNITY_ROLES.includes(request.auth?.token?.role);
  if (!isAuthor && !isModerator) throw new HttpsError("permission-denied", "No puedes borrar este hilo.");

  await postRef.update(removalUpdate({ body: snap.data().body, moderatorUid: uid, archive: isModerator }));
  return { success: true };
});

exports.communityCreateComment = onCall(COMMUNITY_CALL_OPTIONS, async (request) => {
  const uid = requireCommunityAuth(request);
  requireVerifiedCommunityEmail(request);
  const db = admin.firestore();

  const postId = request.data?.postId;
  const body = cleanCommunityText(request.data?.body, COMMENT_BODY_MAX);
  const rawParentId = request.data?.parentCommentId;
  if (!postId) throw new HttpsError("invalid-argument", "Falta el identificador del hilo.");
  if (!body) throw new HttpsError("invalid-argument", "El comentario no puede estar vacío.");
  await assertCleanText(body);

  const postRef = db.collection("posts").doc(postId);
  const postSnap = await postRef.get();
  if (!postSnap.exists || postSnap.data().status === "removed") {
    throw new HttpsError("not-found", "El hilo no existe.");
  }
  if (postSnap.data().status === "locked") {
    throw new HttpsError("failed-precondition", "Este hilo está cerrado.");
  }

  let parentCommentId = null;
  let depth = 0;
  let path = [];
  if (rawParentId) {
    const parentSnap = await postRef.collection("comments").doc(rawParentId).get();
    if (!parentSnap.exists || parentSnap.data().status !== "published") {
      throw new HttpsError("not-found", "El comentario al que respondes no existe.");
    }
    parentCommentId = rawParentId;
    depth = Math.min((parentSnap.data().depth || 0) + 1, COMMENT_MAX_DEPTH);
    path = [...(parentSnap.data().path || []), rawParentId];
  }

  await enforceCommunityRateLimit(uid, "comment");

  const displayName = await resolveCommunityDisplayName(uid);
  const commentRef = postRef.collection("comments").doc();
  await commentRef.set({
    postId,
    parentCommentId,
    depth,
    path,
    authorUid: uid,
    authorName: displayName,
    body,
    status: "published",
    score: 0,
    upvotes: 0,
    downvotes: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    editedAt: null,
  });

  return { id: commentRef.id };
});

// Visitas del hilo y de cada comentario. Sin login (la lectura es pública).
// Escribe en un documento aparte (postStats/{postId}) para NO tocar el del hilo:
// un set en posts/{postId} dispararía onPostWritten en cada visita y modificaría
// updatedAt/lastActivityAt. Las vistas de comentario van en el mapa
// postStats.comments[cid] (el SSR ya lee ese documento: cero lecturas extra).
// Límite por IP porque aquí no hay uid. La IP no se guarda en claro: se guarda
// un HMAC con secreto (IP_HASH_SECRET) en rateLimits, con caducidad (TTL).
exports.communityTrackView = onCall(COMMUNITY_TRACK_OPTIONS, async (request) => {
  const postId = typeof request.data?.postId === "string" ? request.data.postId : "";
  const commentId = typeof request.data?.commentId === "string" ? request.data.commentId : "";
  if (!POST_ID_RE.test(postId) || (commentId && !POST_ID_RE.test(commentId))) {
    throw new HttpsError("invalid-argument", "Hilo no válido.");
  }

  const db = admin.firestore();
  const postSnap = await db.collection("posts").doc(postId).get();
  if (!postSnap.exists || postSnap.data().status !== "published") {
    throw new HttpsError("not-found", "El hilo no existe.");
  }

  if (commentId) {
    const cSnap = await db
      .collection("posts")
      .doc(postId)
      .collection("comments")
      .doc(commentId)
      .get();
    if (!cSnap.exists || cSnap.data().status !== "published") {
      throw new HttpsError("not-found", "El comentario no existe.");
    }
  }

  const clientIp = resolveTrustedClientIp(request);
  const ipHash = crypto
    .createHmac("sha256", IP_HASH_SECRET.value())
    .update(clientIp)
    .digest("hex")
    .slice(0, 32);
  await enforceCommunityRateLimitFor("ip-" + ipHash, commentId ? "commentView" : "view");

  const payload = { updatedAt: FieldValue.serverTimestamp() };
  if (commentId) payload.comments = { [commentId]: FieldValue.increment(1) };
  else payload.views = FieldValue.increment(1);

  await db.collection("postStats").doc(postId).set(payload, { merge: true });

  return { ok: true };
});

exports.communityEditComment = onCall(COMMUNITY_CALL_OPTIONS, async (request) => {
  const uid = requireCommunityAuth(request);
  requireVerifiedCommunityEmail(request);
  const db = admin.firestore();

  const postId = request.data?.postId;
  const commentId = request.data?.commentId;
  const body = cleanCommunityText(request.data?.body, COMMENT_BODY_MAX);
  if (!postId || !commentId) throw new HttpsError("invalid-argument", "Faltan identificadores.");
  if (!body) throw new HttpsError("invalid-argument", "El comentario no puede estar vacío.");
  await assertCleanText(body);

  const ref = db.collection("posts").doc(postId).collection("comments").doc(commentId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "El comentario no existe.");
  if (snap.data().authorUid !== uid) throw new HttpsError("permission-denied", "No eres el autor de este comentario.");
  if (snap.data().status !== "published") throw new HttpsError("failed-precondition", "Este comentario ya no se puede editar.");

  await ref.update({
    body,
    editedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { success: true };
});

exports.communityRemoveComment = onCall(COMMUNITY_CALL_OPTIONS, async (request) => {
  const uid = requireCommunityAuth(request);
  const db = admin.firestore();

  const postId = request.data?.postId;
  const commentId = request.data?.commentId;
  if (!postId || !commentId) throw new HttpsError("invalid-argument", "Faltan identificadores.");

  const ref = db.collection("posts").doc(postId).collection("comments").doc(commentId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "El comentario no existe.");

  const isAuthor = snap.data().authorUid === uid;
  const isModerator = COMMUNITY_ROLES.includes(request.auth?.token?.role);
  if (!isAuthor && !isModerator) throw new HttpsError("permission-denied", "No puedes borrar este comentario.");

  await ref.update(removalUpdate({ body: snap.data().body, moderatorUid: uid, archive: isModerator }));
  return { success: true };
});

exports.communityReport = onCall(COMMUNITY_CALL_OPTIONS, async (request) => {
  const uid = requireCommunityAuth(request);
  requireVerifiedCommunityEmail(request);
  const db = admin.firestore();

  const targetType = request.data?.targetType;
  const targetId = request.data?.targetId;
  const postId = request.data?.postId;
  const reason = request.data?.reason;
  const note = cleanCommunityText(request.data?.note, 500);

  if (!["post", "comment"].includes(targetType)) throw new HttpsError("invalid-argument", "Tipo de contenido no válido.");
  if (!targetId) throw new HttpsError("invalid-argument", "Falta el contenido a reportar.");
  if (!COMMUNITY_REASONS.includes(reason)) throw new HttpsError("invalid-argument", "Motivo no válido.");

  let targetRef;
  if (targetType === "post") {
    targetRef = db.collection("posts").doc(targetId);
  } else {
    if (!postId) throw new HttpsError("invalid-argument", "Falta el hilo del comentario.");
    targetRef = db.collection("posts").doc(postId).collection("comments").doc(targetId);
  }

  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) throw new HttpsError("not-found", "El contenido reportado no existe.");

  // Un reporte abierto por usuario y contenido: sin esto, el mismo usuario (o
  // cuentas creadas en masa) puede inflar la cola de moderación. NO se oculta
  // contenido por número de reportes: los reportes solo alimentan la cola que
  // revisa una persona.
  const alreadyOpen = await db
    .collection("reports")
    .where("reporterUid", "==", uid)
    .where("targetId", "==", targetId)
    .limit(10)
    .get();
  if (alreadyOpen.docs.some((d) => d.data().status === "open")) {
    throw new HttpsError("already-exists", "Ya has reportado este contenido. El equipo lo revisará.");
  }

  await enforceCommunityRateLimit(uid, "report");

  const reportRef = db.collection("reports").doc();
  await reportRef.set({
    targetType,
    targetPath: targetRef.path,
    targetId,
    targetAuthorUid: targetSnap.data().authorUid || null,
    reporterUid: uid,
    reason,
    note,
    status: "open",
    createdAt: FieldValue.serverTimestamp(),
    resolvedAt: null,
    resolvedBy: null,
  });

  return { id: reportRef.id };
});

exports.communityModerate = onCall(COMMUNITY_CALL_OPTIONS, async (request) => {
  const uid = requireCommunityRole(request);
  const db = admin.firestore();

  const targetType = request.data?.targetType;
  const targetId = request.data?.targetId;
  const postId = request.data?.postId;
  const action = request.data?.action;
  const reason = typeof request.data?.reason === "string" ? cleanCommunityText(request.data.reason, 300) : null;

  const allowed = { post: ["remove", "restore", "lock", "unlock"], comment: ["remove", "restore"] };
  if (!allowed[targetType] || !allowed[targetType].includes(action)) {
    throw new HttpsError("invalid-argument", "Acción de moderación no válida.");
  }

  let ref;
  if (targetType === "post") {
    ref = db.collection("posts").doc(targetId);
  } else {
    if (!postId) throw new HttpsError("invalid-argument", "Falta el hilo del comentario.");
    ref = db.collection("posts").doc(postId).collection("comments").doc(targetId);
  }

  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "El contenido no existe.");

  const status = action === "remove" ? "removed" : action === "lock" ? "locked" : "published";

  const batch = db.batch();
  if (action === "remove") {
    // Moderación: el cuerpo sale del documento (ya no lo lee nadie salvo
    // moderadores) y se guarda en `removedBody` para posibles reclamaciones.
    batch.update(ref, removalUpdate({ body: snap.data().body, moderatorUid: uid, reason, archive: true }));
  } else if (action === "restore") {
    const restore = { status, updatedAt: FieldValue.serverTimestamp() };
    if (typeof snap.data().removedBody === "string" && snap.data().removedBody) {
      restore.body = snap.data().removedBody;
    }
    restore.removedBody = FieldValue.delete();
    restore.removedAt = FieldValue.delete();
    restore.removedByUid = FieldValue.delete();
    restore.removedReason = FieldValue.delete();
    batch.update(ref, restore);
  } else {
    batch.update(ref, { status, updatedAt: FieldValue.serverTimestamp() });
  }
  batch.set(db.collection("moderationLog").doc(), {
    modUid: uid,
    action,
    targetType,
    targetId,
    targetPath: ref.path,
    reason,
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  return { success: true, status };
});

exports.communityResolveReport = onCall(COMMUNITY_CALL_OPTIONS, async (request) => {
  const uid = requireCommunityRole(request);
  const db = admin.firestore();

  const reportId = request.data?.reportId;
  const status = request.data?.status;
  if (!reportId) throw new HttpsError("invalid-argument", "Falta el identificador del reporte.");
  if (!["resolved", "dismissed"].includes(status)) throw new HttpsError("invalid-argument", "Estado no válido.");

  const ref = db.collection("reports").doc(reportId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "El reporte no existe.");

  await ref.update({
    status,
    resolvedAt: FieldValue.serverTimestamp(),
    resolvedBy: uid,
  });
  return { success: true };
});

exports.communitySaveProfile = onCall(COMMUNITY_CALL_OPTIONS, async (request) => {
  const uid = requireCommunityAuth(request);
  requireVerifiedCommunityEmail(request);
  const db = admin.firestore();

  const displayName = cleanCommunityText(request.data?.displayName, 40);
  const bio = cleanCommunityText(request.data?.bio, 280);
  const avatarUrl = typeof request.data?.avatarUrl === "string" ? request.data.avatarUrl.trim().slice(0, 500) : "";

  if (displayName && displayName.length < 2) throw new HttpsError("invalid-argument", "El nombre es demasiado corto.");

  await assertCleanText(displayName, bio);
  const isStaff = COMMUNITY_ROLES.includes(request.auth?.token?.role);
  if (displayName && isReservedName(displayName) && !isStaff) {
    throw new HttpsError("invalid-argument", "Ese nombre no está disponible.");
  }

  await enforceCommunityRateLimit(uid, "profile");

  const ref = db.collection("profiles").doc(uid);
  const snap = await ref.get();
  const payload = { uid, updatedAt: FieldValue.serverTimestamp() };
  if (displayName) payload.displayName = displayName;
  payload.bio = bio;
  payload.avatarUrl = avatarUrl;
  if (!snap.exists) payload.createdAt = FieldValue.serverTimestamp();

  await ref.set(payload, { merge: true });
  return { success: true };
});

// --- Triggers: contadores server-only ---

exports.onPostWritten = onDocumentWritten(
  { document: "posts/{postId}", region: COMMUNITY_REGION },
  async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;

    const delta = (after?.status === "published" ? 1 : 0) - (before?.status === "published" ? 1 : 0);
    if (delta === 0) return;

    const spaceId = after?.spaceId || before?.spaceId;
    const authorUid = after?.authorUid || before?.authorUid;
    const authorName = after?.authorName || before?.authorName;
    if (!spaceId && !authorUid) return;

    const db = admin.firestore();
    const batch = db.batch();
    if (spaceId) {
      batch.set(db.collection("spaces").doc(spaceId), { postCount: FieldValue.increment(delta) }, { merge: true });
    }
    if (authorUid) {
      const profileRef = db.collection("profiles").doc(authorUid);
      const profileSnap = await profileRef.get();
      const payload = communityProfileCounterPayload(authorUid, "postCount", delta, authorName);
      if (delta > 0 && !profileSnap.exists) payload.createdAt = FieldValue.serverTimestamp();
      batch.set(profileRef, payload, { merge: true });
    }
    await batch.commit();
  }
);

exports.onCommentWritten = onDocumentWritten(
  { document: "posts/{postId}/comments/{commentId}", region: COMMUNITY_REGION },
  async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;

    const delta = (after?.status === "published" ? 1 : 0) - (before?.status === "published" ? 1 : 0);
    if (delta === 0) return;

    const postId = event.params.postId;
    const authorUid = after?.authorUid || before?.authorUid;
    const authorName = after?.authorName || before?.authorName;

    const db = admin.firestore();
    const batch = db.batch();
    const postRef = db.collection("posts").doc(postId);
    const postUpdate = { commentCount: FieldValue.increment(delta) };
    if (delta > 0) postUpdate.lastActivityAt = FieldValue.serverTimestamp();
    batch.set(postRef, postUpdate, { merge: true });

    if (authorUid) {
      const profileRef = db.collection("profiles").doc(authorUid);
      const profileSnap = await profileRef.get();
      const payload = communityProfileCounterPayload(authorUid, "commentCount", delta, authorName);
      if (delta > 0 && !profileSnap.exists) payload.createdAt = FieldValue.serverTimestamp();
      batch.set(profileRef, payload, { merge: true });
    }
    await batch.commit();
  }
);

exports.onPostVoteWritten = onDocumentWritten(
  { document: "posts/{postId}/votes/{voteUid}", region: COMMUNITY_REGION },
  async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    const beforeValue = before?.value || 0;
    const afterValue = after?.value || 0;
    const delta = afterValue - beforeValue;
    if (delta === 0) return;

    const db = admin.firestore();
    const postRef = db.collection("posts").doc(event.params.postId);
    const postSnap = await postRef.get();
    if (!postSnap.exists) return;

    const upDelta = (afterValue === 1 ? 1 : 0) - (beforeValue === 1 ? 1 : 0);
    const downDelta = (afterValue === -1 ? 1 : 0) - (beforeValue === -1 ? 1 : 0);
    const authorUid = postSnap.data().authorUid;

    const batch = db.batch();
    batch.set(postRef, {
      upvotes: FieldValue.increment(upDelta),
      downvotes: FieldValue.increment(downDelta),
      score: FieldValue.increment(delta),
    }, { merge: true });
    if (authorUid) {
      batch.set(db.collection("profiles").doc(authorUid), { karma: FieldValue.increment(delta) }, { merge: true });
    }
    await batch.commit();
  }
);

exports.onCommentVoteWritten = onDocumentWritten(
  { document: "posts/{postId}/comments/{commentId}/votes/{voteUid}", region: COMMUNITY_REGION },
  async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    const beforeValue = before?.value || 0;
    const afterValue = after?.value || 0;
    const delta = afterValue - beforeValue;
    if (delta === 0) return;

    const db = admin.firestore();
    const commentRef = db
      .collection("posts").doc(event.params.postId)
      .collection("comments").doc(event.params.commentId);
    const commentSnap = await commentRef.get();
    if (!commentSnap.exists) return;

    const upDelta = (afterValue === 1 ? 1 : 0) - (beforeValue === 1 ? 1 : 0);
    const downDelta = (afterValue === -1 ? 1 : 0) - (beforeValue === -1 ? 1 : 0);
    const authorUid = commentSnap.data().authorUid;

    const batch = db.batch();
    batch.set(commentRef, {
      upvotes: FieldValue.increment(upDelta),
      downvotes: FieldValue.increment(downDelta),
      score: FieldValue.increment(delta),
    }, { merge: true });
    if (authorUid) {
      batch.set(db.collection("profiles").doc(authorUid), { karma: FieldValue.increment(delta) }, { merge: true });
    }
    await batch.commit();
  }
);

exports.communitySSR = require("./community-ssr").communitySSR;
