const express = require("express");
const Stripe = require("stripe");
const cors = require("cors");
const admin = require("firebase-admin");
const https = require("https");
const path = require("path");
const fs = require("fs");
const { Resend } = require("resend");
const rateLimit = require("express-rate-limit");
const Sentry = require("@sentry/node");
const { scrubSentryEvent } = require("./security/sentry-scrub");
require("dotenv").config();

if (process.env.WEBHOOK_TEST_MODE === "1") {
  const missingTestSafeguards = [];
  const firestoreEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST || "";
  if (!/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(firestoreEmulatorHost)) {
    missingTestSafeguards.push("a local FIRESTORE_EMULATOR_HOST");
  }
  if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
    missingTestSafeguards.push("a Stripe test key (STRIPE_SECRET_KEY=sk_test_…)");
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    missingTestSafeguards.push("STRIPE_WEBHOOK_SECRET");
  }
  if (process.env.EMAIL_DRY_RUN !== "1") {
    missingTestSafeguards.push("EMAIL_DRY_RUN=1");
  }
  if (missingTestSafeguards.length) {
    console.error(
      `WEBHOOK_TEST_MODE refused to start; missing safeguards: ${missingTestSafeguards.join(", ")}.`
    );
    process.exit(1);
  }
}

const emailDryRun =
  process.env.WEBHOOK_TEST_MODE === "1" && process.env.EMAIL_DRY_RUN === "1";
const app = express();

// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  sendDefaultPii: false,
  tracesSampleRate: 0,
  integrations: [Sentry.expressIntegration()],
  beforeSend: scrubSentryEvent,
});
const stripe = Stripe(process.env.STRIPE_SECRET_KEY || "TU_SECRET_KEY");
const resendApiKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const adminApiKey = process.env.ADMIN_API_KEY;
const emailjsServiceId = process.env.EMAILJS_SERVICE_ID;
const emailjsTemplateId = process.env.EMAILJS_TEMPLATE_ID;
const emailjsPublicKey = process.env.EMAILJS_PUBLIC_KEY;
const emailjsPrivateKey = process.env.EMAILJS_PRIVATE_KEY;
const emailjsApiUrl =
  process.env.EMAILJS_API_URL || "https://api.emailjs.com/api/v1.0/email/send";

function generateGiftCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `LIXBY-${part()}-${part()}`;
}

let serviceAccount;
try {
  const serviceAccountJson =
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    fs.readFileSync(path.join(__dirname, "firebase-service-account.json"), "utf8");
  serviceAccount = JSON.parse(serviceAccountJson);
} catch (e) {
  console.error("Error parsing FIREBASE_SERVICE_ACCOUNT:", e.message);
  process.exit(1);
}
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Rate limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 peticiones por IP en 15 minutos
  message: {
    error: "Demasiadas solicitudes. Inténtalo más tarde."
  },
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // máximo 20 peticiones por IP en 15 minutos
  message: {
    error: "Demasiados intentos de autenticación. Inténtalo más tarde."
  },
  standardHeaders: true,
  legacyHeaders: false
});

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 intentos de checkout por IP
  message: {
    error: "Demasiados intentos de compra. Inténtalo más tarde."
  },
  standardHeaders: true,
  legacyHeaders: false
});

const giftCardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 15, // máximo 15 operaciones de tarjeta regalo por IP
  message: {
    error: "Demasiadas solicitudes de tarjeta regalo. Inténtalo más tarde."
  },
  standardHeaders: true,
  legacyHeaders: false
});

const adminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 50, // máximo 50 peticiones por IP cada hora
  message: {
    error: "Demasiadas solicitudes administrativas. Inténtalo más tarde."
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware global
app.use(cors({
  origin: [
    "https://lixby.es",
    "https://www.lixby.es",
    "http://127.0.0.1:5500",
    "http://localhost:5500"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-api-key", "Authorization"]
}));

// Aplicar rate limiter general a toda la API ANTES de express.json()
app.use(generalLimiter);

// Servir archivos estáticos
app.use(express.static(path.join(__dirname)));

// Parser de JSON
app.use("/webhook", express.raw({ type: "application/json" }));

app.use(express.json());

function appendQueryParam(rawUrl, key, value) {
  try {
    const url = new URL(rawUrl);
    url.searchParams.set(key, value);
    return url.toString();
  } catch (error) {
    return rawUrl;
  }
}

function sendEmailJsEmail(order) {
  if (emailDryRun) {
    console.log("EMAIL_DRY_RUN=1: email omitido");
    return Promise.resolve(false);
  }

  if (!emailjsServiceId || !emailjsTemplateId || !emailjsPublicKey || !order.email) {
    return Promise.resolve(false);
  }

  const orders = (order.items || []).map((item) => ({
    name: item.productName,
    units: item.quantity || 1,
    price: item.unitAmount ? (item.unitAmount / 100).toFixed(2) : "0.00",
    engraving: item.engraving || "",
    image_url: "https://lixby.es/images/lixbuds-product.jpg"
  }));

  const payload = {
    service_id: emailjsServiceId,
    template_id: emailjsTemplateId,
    user_id: emailjsPublicKey,
    template_params: {
      order_id: order.orderNumber,
      email: order.email,
      orders,
      cost: {
        shipping: order.shippingAmount ? (order.shippingAmount / 100).toFixed(2) : "0.00",
        tax: "0.00",
        total: order.amountTotal ? order.amountTotal.toFixed(2) : "0.00"
      }
    }
  };

  if (emailjsPrivateKey) {
    payload.accessToken = emailjsPrivateKey;
  }

  return new Promise((resolve) => {
    try {
      const url = new URL(emailjsApiUrl);
      const body = JSON.stringify(payload);
      const req = https.request(
        {
          method: "POST",
          hostname: url.hostname,
          path: url.pathname + url.search,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body)
          }
        },
        (res) => {
          const ok = res.statusCode && res.statusCode >= 200 && res.statusCode < 300;
          res.on("data", () => {});
          res.on("end", () => {
            console.log(ok ? "✅ Email enviado" : "❌ Email fallido");
            resolve(ok);
          });
        }
      );

      req.on("error", (e) => {
        console.error("Email error:", e.message);
        resolve(false);
      });
      req.write(body);
      req.end();
    } catch (error) {
      resolve(false);
    }
  });
}

async function sendGiftCardEmail(giftCard, role) {
  if (emailDryRun) {
    console.log("EMAIL_DRY_RUN=1: email omitido");
    return false;
  }

  if (!resend || !resendFrom) return false;

  const isRecipient = role === "recipient";
  const toEmail = isRecipient ? giftCard.recipientEmail : giftCard.senderEmail;
  const toName = isRecipient
    ? giftCard.recipientName || "Cliente"
    : giftCard.senderName || "Cliente";

  if (!toEmail) return false;

  const subject = isRecipient
    ? `🎁 ${giftCard.senderName || "Alguien"} te ha enviado una tarjeta regalo Lixby`
    : `✅ Tu tarjeta regalo Lixby de ${giftCard.amount
        .toFixed(2)
        .replace(".", ",")} €`;

  const messageHtml = giftCard.message
    ? `<div style="background:#f0f7e6;border-left:4px solid #458500;padding:14px 18px;border-radius:8px;margin:20px 0;font-style:italic;color:#374151">"${giftCard.message}"</div>`
    : "";

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1a3a00,#458500);padding:40px 40px 32px;text-align:center">
      <div style="font-size:2rem;font-weight:800;color:#fff;letter-spacing:-0.02em">Lixby</div>
      <div style="color:rgba(255,255,255,0.8);font-size:0.9rem;margin-top:4px">Tarjeta Regalo Digital</div>
    </div>

    <!-- Body -->
    <div style="padding:36px 40px">
      <p style="font-size:1.05rem;color:#111827;margin:0 0 8px">Hola, <strong>${toName}</strong> 👋</p>
      <p style="color:#6b7280;line-height:1.6;margin:0 0 24px">
        ${
          isRecipient
            ? `<strong>${giftCard.senderName || "Alguien especial"}</strong> te ha enviado una tarjeta regalo Lixby.`
            : "Tu tarjeta regalo Lixby está lista. Aquí tienes tu código."
        }
      </p>

      ${messageHtml}

      <!-- Gift Card -->
      <div style="background:linear-gradient(135deg,#f0f7e6,#fff);border:1.5px solid #d4edba;border-radius:16px;padding:28px;text-align:center;margin-bottom:24px">
        <div style="font-size:0.75rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;margin-bottom:8px">Importe</div>
        <div style="font-size:2.4rem;font-weight:800;color:#111827;letter-spacing:-0.03em;margin-bottom:16px">${giftCard.amount
          .toFixed(2)
          .replace(".", ",")} €</div>
        <div style="font-size:0.75rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;margin-bottom:8px">Tu código</div>
        <div style="font-size:1.4rem;font-weight:800;font-family:monospace;color:#458500;background:#fff;border:2px dashed #c3e6a0;border-radius:10px;padding:12px 20px;letter-spacing:0.08em">${giftCard.code}</div>
      </div>

      <!-- How to use -->
      <div style="background:#f9fafb;border-radius:12px;padding:20px 24px;margin-bottom:24px">
        <div style="font-weight:700;color:#111827;margin-bottom:12px;font-size:0.9rem">¿Cómo usar tu tarjeta regalo?</div>
        <ol style="margin:0;padding-left:18px;color:#6b7280;font-size:0.875rem;line-height:2">
          <li>Añade los LixBuds al carrito en <a href="https://lixby.es" style="color:#458500">lixby.es</a></li>
          <li>En el carrito, introduce tu código en el campo de descuento</li>
          <li>¡El descuento se aplica automáticamente!</li>
        </ol>
      </div>

      <a href="https://lixby.es/es/tienda.html" style="display:block;background:#458500;color:#fff;text-decoration:none;text-align:center;padding:16px;border-radius:12px;font-weight:700;font-size:1rem">
        Ir a la tienda →
      </a>
    </div>

    <!-- Footer -->
    <div style="padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center">
      <p style="color:#9ca3af;font-size:0.78rem;margin:0">La tarjeta no tiene fecha de caducidad · <a href="mailto:info@lixby.es" style="color:#458500">Soporte</a></p>
    </div>
  </div>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: resendFrom,
      to: toEmail,
      subject,
      html
    });
    console.log("✅ Email de tarjeta regalo enviado");
    return true;
  } catch (err) {
    console.error("❌ Gift card email error:", err.message);
    return false;
  }
}

function sendAdminEmail(order) {
  if (emailDryRun) {
    console.log("EMAIL_DRY_RUN=1: email omitido");
    return Promise.resolve(false);
  }

  const adminTemplateId = process.env.EMAILJS_ADMIN_TEMPLATE_ID;
  if (!emailjsServiceId || !adminTemplateId || !emailjsPublicKey) {
    return Promise.resolve(false);
  }

  const orders = (order.items || []).map((item) => ({
    name: item.productName,
    units: item.quantity || 1,
    price: item.unitAmount ? (item.unitAmount / 100).toFixed(2) : "0.00",
    engraving: item.engraving || "",
    image_url: "https://lixby.es/images/lixbuds-product.jpg"
  }));

  const payload = {
    service_id: emailjsServiceId,
    template_id: adminTemplateId,
    user_id: emailjsPublicKey,
    template_params: {
      order_number: order.orderNumber,
      customer_name: order.customerName || "No disponible",
      customer_email: order.email,
      customer_phone: order.customerPhone || "No disponible",
      customer_nif: order.customerNif || "No disponible",
      customer_dob: order.customerDob || "No disponible",
      customer_address: order.address || "No disponible",
      orders,
      cost: {
        shipping: order.shippingAmount ? (order.shippingAmount / 100).toFixed(2) : "0.00",
        total: order.amountTotal ? order.amountTotal.toFixed(2) : "0.00"
      }
    }
  };

  if (emailjsPrivateKey) {
    payload.accessToken = emailjsPrivateKey;
  }

  return new Promise((resolve) => {
    try {
      const url = new URL(emailjsApiUrl);
      const body = JSON.stringify(payload);
      const req = https.request(
        {
          method: "POST",
          hostname: url.hostname,
          path: url.pathname + url.search,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body)
          }
        },
        (res) => {
          const ok = res.statusCode && res.statusCode >= 200 && res.statusCode < 300;
          res.on("data", () => {});
          res.on("end", () => {
            console.log(ok ? "✅ Email admin enviado" : "❌ Email admin fallido");
            resolve(ok);
          });
        }
      );
      req.on("error", (e) => {
        console.error("Admin email error:", e.message);
        resolve(false);
      });
      req.write(body);
      req.end();
    } catch (error) {
      resolve(false);
    }
  });
}

function formatOrderNumber(sessionId) {
  const seed = sessionId ? sessionId.replace(/[^a-zA-Z0-9]/g, "") : "";
  const tail = seed.slice(-8).toUpperCase().padStart(8, "0");
  return `LXB-${tail}`;
}

function formatAmount(amountTotal, currency) {
  if (typeof amountTotal !== "number") return null;
  const normalized = amountTotal.toFixed(2);
  return `${normalized} ${currency || "EUR"}`;
}

function formatPaymentMethodLabel(method) {
  const value = String(method || "").toLowerCase();
  if (!value) return "No disponible";
  if (value === "card") return "Tarjeta";
  if (value === "bizum") return "Bizum";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

async function sendOrderStatusEmail(order) {
  if (!resend || !resendFrom || !order || !order.email) {
    return { ok: false, reason: "email_unavailable" };
  }

  const trackUrl = `https://lixby.es/track?orderId=${order.id}`;
  const subject = `📦 Actualización de tu pedido ${order.orderNumber} — ${order.status}`;
  const trackingBlock =
    order.trackingCarrier || order.trackingNumber
      ? `
      <div style="background:#f9fafb;border-radius:12px;padding:16px 20px;margin-bottom:24px;font-size:0.875rem">
        <div style="font-weight:700;margin-bottom:6px;color:#111827">Seguimiento</div>
        <div style="color:#6b7280;line-height:1.7">
          ${order.trackingCarrier ? `<div>Transportista: <strong style="color:#111827">${order.trackingCarrier}</strong></div>` : ""}
          ${order.trackingNumber ? `<div>Número: <strong style="color:#111827">${order.trackingNumber}</strong></div>` : ""}
        </div>
      </div>
    `
      : "";

  try {
    await resend.emails.send({
      from: resendFrom,
      to: order.email,
      subject,
      html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#1a3a00,#458500);padding:36px 40px;text-align:center">
      <div style="font-size:2rem;font-weight:800;color:#fff;letter-spacing:-0.02em">Lixby</div>
      <div style="color:rgba(255,255,255,0.8);font-size:0.9rem;margin-top:4px">Actualización de pedido</div>
    </div>
    <div style="padding:36px 40px">
      <p style="font-size:1.05rem;color:#111827;margin:0 0 8px">Hola, <strong>${order.customerName || "Cliente"}</strong> 👋</p>
      <p style="color:#6b7280;line-height:1.6;margin:0 0 24px">Tu pedido <strong>${order.orderNumber}</strong> ha sido actualizado.</p>

      <div style="background:#f0f7e6;border:1px solid #d4edba;border-radius:12px;padding:16px 20px;margin-bottom:24px">
        <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:4px">Estado actual</div>
        <div style="font-size:1.2rem;font-weight:800;color:#458500">${order.status || "Pedido recibido"}</div>
      </div>

      ${trackingBlock}

      <a href="${trackUrl}" style="display:block;background:#458500;color:#fff;text-decoration:none;text-align:center;padding:16px;border-radius:12px;font-weight:700;font-size:1rem;margin-bottom:16px">
        Seguir mi pedido →
      </a>
    </div>
    <div style="padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center">
      <p style="color:#9ca3af;font-size:0.78rem;margin:0">Si necesitas ayuda, responde a este email o escríbenos a <a href="mailto:info@lixby.es" style="color:#458500">info@lixby.es</a></p>
    </div>
  </div>
</body>
</html>`
    });
    return { ok: true };
  } catch (error) {
    console.warn("No se pudo enviar email de actualización:", error.message);
    return { ok: false, reason: error.message };
  }
}

function formatAddress(address) {
  if (!address) return null;
  const parts = [
    address.line1,
    address.line2,
    address.postal_code,
    address.city,
    address.state,
    address.country
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

const ENGRAVING_MAX_GRAPHEMES = 12;
const ENGRAVING_ALLOWED_CHARS =
  /^[\p{L}\p{N}\p{M}\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u200D\uFE0F\u20E3\u{E0020}-\u{E007F} ]+$/u;
const engravingSegmenter =
  typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter("es", { granularity: "grapheme" })
    : null;

function engravingGraphemes(value) {
  if (engravingSegmenter) {
    return Array.from(engravingSegmenter.segment(value), (part) => part.segment);
  }
  return Array.from(value);
}

// Valida y normaliza el grabado. Devuelve { ok, value } o { ok:false, error }.
function normalizeEngraving(raw) {
  if (raw == null || raw === "") return { ok: true, value: "" };
  if (typeof raw !== "string") {
    return { ok: false, error: "El grabado no es válido." };
  }

  let cleaned = raw
    .normalize("NFC")
    .replace(/[\s\u00A0]+/gu, " ")
    .trim();
  if (!cleaned) return { ok: true, value: "" };

  cleaned = cleaned.toUpperCase();
  if (engravingGraphemes(cleaned).length > ENGRAVING_MAX_GRAPHEMES) {
    return {
      ok: false,
      error: `El grabado no puede superar los ${ENGRAVING_MAX_GRAPHEMES} caracteres.`
    };
  }
  if (!ENGRAVING_ALLOWED_CHARS.test(cleaned)) {
    return {
      ok: false,
      error: "El grabado solo admite letras, números, espacios y emojis."
    };
  }

  return { ok: true, value: cleaned };
}

function isLixbudsOneItem(item) {
  if (!item || typeof item !== "object") return false;
  const candidates = [item.id, item.productId, item.name, item.productName]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  return candidates.some((value) => value.includes("lixbuds one") || value.includes("lixbuds-one"));
}

// Serializa el mapa de grabados en un valor de metadata de Stripe (máx. 500).
function buildEngravingMetadata(engravingMap) {
  if (!Array.isArray(engravingMap) || !engravingMap.length) return "";
  const compact = engravingMap.map(({ i, e, c }) => [i, e, c || ""]);
  let json = JSON.stringify(compact);
  while (json.length > 500 && compact.length > 1) {
    compact.pop();
    json = JSON.stringify(compact);
  }
  return json.length <= 500 ? json : "";
}

function parseEngravingMetadata(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        if (Array.isArray(entry)) {
          return { i: Number(entry[0]), e: entry[1], c: entry[2] || "" };
        }
        if (entry && typeof entry === "object") {
          return { i: Number(entry.i), e: entry.e, c: entry.c || "" };
        }
        return null;
      })
      .filter((entry) => entry && Number.isFinite(entry.i) && entry.e);
  } catch (error) {
    return [];
  }
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[ch] || ch);
}

// Devuelve las líneas de Stripe y en qué índice va cada grabado.
function buildStripeLineItems(items) {
  if (!Array.isArray(items)) return { lineItems: [], engravings: [] };
  const lineItems = [];
  const engravings = [];
  items.forEach((item) => {
    const qty = Math.max(1, Number(item.qty) || 1);
    const basePrice = Number(item.price) || 0;
    const insurancePrice = Number(item.insurancePrice) || 0;
    const color = item.color || "—";
    const plan = item.insurancePlan || "Sin LixSafe";
    const baseName = item.name || "Producto";
    const displayName =
      color !== "—" && !baseName.includes(color) ? `${baseName} (${color})` : baseName;
    if (basePrice > 0) {
      if (item.engraving) {
        engravings.push({ i: lineItems.length, e: item.engraving, c: color });
      }
      lineItems.push({
        price_data: {
          currency: "eur",
          unit_amount: Math.round(basePrice * 100),
          product_data: {
            name: displayName,
            metadata: {
              item_id: item.lineId || item.id || "",
              color,
              plan,
              engraving: item.engraving || ""
            }
          }
        },
        quantity: qty
      });
    }
    if (insurancePrice > 0 && plan !== "Sin LixSafe") {
      lineItems.push({
        price_data: {
          currency: "eur",
          unit_amount: Math.round(insurancePrice * 100),
          product_data: {
            name: `LixSafe ${plan} (${displayName})`,
            metadata: {
              item_id: item.lineId || item.id || "",
              type: "insurance",
              plan,
              color
            }
          }
        },
        quantity: qty
      });
    }
  });
  return { lineItems, engravings };
}

app.post("/create-gift-card-session", express.json(), giftCardLimiter, async (req, res) => {
  const {
    amount,
    senderName,
    senderEmail,
    recipientName,
    recipientEmail,
    message,
    successUrl,
    cancelUrl
  } = req.body || {};

  if (!amount || amount < 5 || amount > 200) {
    return res.status(400).json({ error: "Importe no válido" });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: `Tarjeta Regalo Lixby — ${Number(amount).toFixed(2)} €`,
              description: recipientName
                ? `Para: ${recipientName}`
                : "Tarjeta regalo digital"
            }
          },
          quantity: 1
        }
      ],
      customer_email: senderEmail,
      metadata: {
        type: "gift_card",
        amount: String(amount),
        senderName: senderName || "",
        senderEmail: senderEmail || "",
        recipientName: recipientName || "",
        recipientEmail: recipientEmail || "",
        message: message || ""
      },
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error("Gift card session error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.post("/redeem-gift-card", express.json(), giftCardLimiter, async (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: "Falta el código" });

  const normalized = code.trim().toUpperCase();

  try {
    const doc = await db.collection("giftCards").doc(normalized).get();
    if (!doc.exists) return res.status(404).json({ error: "Código no válido" });

    const card = doc.data();
    if (card.used || card.balance <= 0) {
      return res.status(400).json({ error: "Esta tarjeta ya ha sido usada" });
    }

    return res.json({
      valid: true,
      code: card.code,
      balance: card.balance,
      amount: card.amount
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/use-gift-card", express.json(), giftCardLimiter, async (req, res) => {
  const { code, amountUsed } = req.body || {};
  if (!code || !amountUsed) return res.status(400).json({ error: "Faltan datos" });

  const normalized = code.trim().toUpperCase();

  try {
    const ref = db.collection("giftCards").doc(normalized);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Código no encontrado" });

    const card = doc.data();
    const newBalance = Math.max(0, card.balance - amountUsed);

    await ref.update({
      balance: newBalance,
      used: newBalance === 0,
      lastUsedAt: new Date().toISOString()
    });

    return res.json({ ok: true, remainingBalance: newBalance });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/create-checkout-session", express.json(), checkoutLimiter, async (req, res) => {
  const {
    orderId: rawOrderId,
    successUrl,
    cancelUrl,
    items,
    customerEmail,
    customerName,
    customerPhone
  } = req.body || {};
  const orderId = rawOrderId || `LXB-${Math.floor(Math.random() * 100000)}`;
  const successWithOrder = appendQueryParam(
    successUrl || process.env.STRIPE_SUCCESS_URL || "https://tusitio.com/success",
    "orderId",
    orderId
  );
  const cancelWithOrder =
    cancelUrl || process.env.STRIPE_CANCEL_URL || "https://tusitio.com/cancel";

  // Validación y normalización server-side del grabado (nunca se confía en el cliente).
  const validatedItems = [];
  const rawItems = Array.isArray(items) ? items : [];
  for (const rawItem of rawItems) {
    const item = rawItem && typeof rawItem === "object" ? rawItem : {};
    const normalized = normalizeEngraving(item.engraving);
    if (!normalized.ok) {
      return res.status(400).json({ error: normalized.error });
    }
    if (normalized.value) {
      if (item.type === "insurance" || !isLixbudsOneItem(item)) {
        return res.status(400).json({
          error: "El grabado solo está disponible para LixBuds One."
        });
      }
    }
    validatedItems.push({ ...item, engraving: normalized.value });
  }

  try {
    const priceIdEntries = validatedItems
      .map((item) => {
        if (!item.priceId) return null;
        return {
          line: {
            price: item.priceId,
            quantity: Math.max(1, Number(item.quantity || item.qty) || 1)
          },
          source: item
        };
      })
      .filter(Boolean);

    let dynamicLineItems = [];
    let engravingMap = [];
    if (priceIdEntries.length > 0) {
      dynamicLineItems = priceIdEntries.map((entry) => entry.line);
      engravingMap = priceIdEntries
        .map((entry, index) =>
          entry.source.engraving
            ? { i: index, e: entry.source.engraving, c: entry.source.color || "" }
            : null
        )
        .filter(Boolean);
    } else {
      const built = buildStripeLineItems(validatedItems);
      dynamicLineItems = built.lineItems;
      engravingMap = built.engravings;
    }
    const engravingMetadata = buildEngravingMetadata(engravingMap);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      shipping_address_collection: {
        allowed_countries: [
          "ES",
          "PT",
          "FR",
          "DE",
          "IT",
          "NL",
          "BE",
          "AT",
          "PL",
          "SE",
          "DK",
          "FI",
          "IE",
          "GR",
          "CZ",
          "SK",
          "HU",
          "RO",
          "BG",
          "HR",
          "SI",
          "EE",
          "LV",
          "LT",
          "LU",
          "MT",
          "CY",
          "GB",
          "CH",
          "NO"
        ]
      },
      phone_number_collection: {
        enabled: true
      },
      custom_fields: [
        {
          key: "full_name",
          label: { type: "custom", custom: "Nombre completo" },
          type: "text"
        },
        {
          key: "nif_dni",
          label: { type: "custom", custom: "NIF / DNI" },
          type: "text"
        },
        {
          key: "fecha_nacimiento",
          label: { type: "custom", custom: "Fecha de nacimiento (DD/MM/AAAA)" },
          type: "text"
        }
      ],
      customer_email: customerEmail || undefined,
      line_items:
        dynamicLineItems.length > 0
          ? dynamicLineItems
          : [
              {
                price: process.env.STRIPE_PRICE_ID || "TU_PRICE_ID",
                quantity: 1
              }
            ],
      metadata: {
        orderId,
        items: JSON.stringify(items || []),
        ...(engravingMetadata ? { engravings: engravingMetadata } : {})
      },
      client_reference_id: orderId,
      locale: "auto",
      success_url: successWithOrder,
      cancel_url: cancelWithOrder
    });

    res.json({ id: session.id, url: session.url, orderId });
  } catch (error) {
    console.error("Stripe error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/webhook", generalLimiter, async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;

  try {
    if (!endpointSecret) {
      throw new Error("Falta STRIPE_WEBHOOK_SECRET");
    }
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error("Webhook signature verification failed.", err);
    return res.status(400).send("Webhook Error");
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    if (session.metadata && session.metadata.type === "gift_card") {
      const code = generateGiftCode();
      const amount = Number(session.metadata.amount);

      const giftCard = {
        code,
        amount,
        balance: amount,
        used: false,
        senderName: session.metadata.senderName || null,
        senderEmail: session.metadata.senderEmail || null,
        recipientName: session.metadata.recipientName || null,
        recipientEmail: session.metadata.recipientEmail || null,
        message: session.metadata.message || null,
        paymentMethod:
          (Array.isArray(session.payment_method_types) && session.payment_method_types[0]) ||
          "card",
        paymentMethodLabel: formatPaymentMethodLabel(
          (Array.isArray(session.payment_method_types) && session.payment_method_types[0]) ||
            "card"
        ),
        sessionId: session.id,
        createdAt: new Date().toISOString()
      };

      await db.collection("giftCards").doc(code).set(giftCard);
      console.log("🎁 Tarjeta regalo creada");

      await sendGiftCardEmail(giftCard, "sender");
      if (giftCard.recipientEmail) {
        await sendGiftCardEmail(giftCard, "recipient");
      }

      return res.sendStatus(200);
    }

    const orderId =
      (session.metadata && session.metadata.orderId) || session.client_reference_id;

    let lineItems = [];
    try {
      const items = await stripe.checkout.sessions.listLineItems(session.id, {
        limit: 100,
        expand: ["data.price.product"]
      });
      lineItems = items && items.data ? items.data : [];
    } catch (error) {
      console.warn("No se pudieron cargar los line items:", error.message);
    }

    const engravingEntries = parseEngravingMetadata(
      session.metadata && session.metadata.engravings
    );
    const orderItems = lineItems.map((item, index) => {
      const productName =
        (item.price &&
          item.price.product &&
          typeof item.price.product === "object" &&
          item.price.product.name) ||
        item.description ||
        "Producto";
      const engravingEntry = engravingEntries.find((entry) => entry.i === index);
      const normalizedEngraving = engravingEntry
        ? normalizeEngraving(engravingEntry.e)
        : { ok: true, value: "" };
      return {
        productName,
        priceId: item.price ? item.price.id : null,
        quantity: item.quantity || 1,
        unitAmount: item.price ? item.price.unit_amount : null,
        engraving: normalizedEngraving.ok ? normalizedEngraving.value : "",
        ...(engravingEntry && engravingEntry.c ? { color: engravingEntry.c } : {})
      };
    });

    const hasEngraving = orderItems.some((item) => Boolean(item.engraving));
    const engravingCount = orderItems.reduce(
      (total, item) =>
        total + (item.engraving ? Math.max(1, Number(item.quantity) || 1) : 0),
      0
    );

    const product =
      orderItems.length > 0
        ? orderItems
            .map((item) => {
              const qty = item.quantity ? `x${item.quantity}` : "";
              return `${item.productName} ${qty}`.trim();
            })
            .join(", ")
        : "Cascos Lixby";

    const address = formatAddress(
      (session.shipping_details && session.shipping_details.address) ||
        (session.customer_details && session.customer_details.address)
    );

    const order = {
      id: orderId || `LXB-${Math.floor(Math.random() * 100000)}`,
      orderNumber: formatOrderNumber(session.id),
      email: (session.customer_details && session.customer_details.email) || null,
      customerName:
        (session.custom_fields &&
          session.custom_fields.find((f) => f.key === "full_name") &&
          session.custom_fields.find((f) => f.key === "full_name").text &&
          session.custom_fields.find((f) => f.key === "full_name").text.value) ||
        (session.customer_details && session.customer_details.name) ||
        null,
      customerPhone:
        (session.customer_details && session.customer_details.phone) || null,
      customerNif:
        (session.custom_fields &&
          session.custom_fields.find((f) => f.key === "nif_dni") &&
          session.custom_fields.find((f) => f.key === "nif_dni").text &&
          session.custom_fields.find((f) => f.key === "nif_dni").text.value) ||
        null,
      customerDob:
        (session.custom_fields &&
          session.custom_fields.find((f) => f.key === "fecha_nacimiento") &&
          session.custom_fields.find((f) => f.key === "fecha_nacimiento").text &&
          session.custom_fields.find((f) => f.key === "fecha_nacimiento").text.value) ||
        null,
      product,
      items: orderItems,
      hasEngraving,
      engravingCount,
      status: "Pedido recibido",
      statusHistory: [
        {
          status: "Pedido recibido",
          changedAt: new Date().toISOString(),
          actor: "system",
          note: "Pedido creado tras checkout confirmado"
        }
      ],
      paymentStatus: "paid",
      paymentMethod:
        (Array.isArray(session.payment_method_types) && session.payment_method_types[0]) ||
        (session.payment_method_collection || null) ||
        "card",
      paymentMethodLabel: formatPaymentMethodLabel(
        (Array.isArray(session.payment_method_types) && session.payment_method_types[0]) ||
          (session.payment_method_collection || null) ||
          "card"
      ),
      sessionId: session.id,
      amountTotal: session.amount_total ? session.amount_total / 100 : null,
      currency: session.currency ? session.currency.toUpperCase() : "EUR",
      amountLabel: formatAmount(
        session.amount_total ? session.amount_total / 100 : null,
        session.currency ? session.currency.toUpperCase() : "EUR"
      ),
      address,
      paidAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    console.log("Pedido recibido desde Stripe", { sessionId: order.sessionId });
    const existing = await db
      .collection("orders")
      .where("sessionId", "==", order.sessionId)
      .get();

    if (!existing.empty) {
      console.log("Pedido ya existe, ignorando...");
      return res.sendStatus(200);
    }

    await db.collection("orders").doc(order.id).set(order, { merge: true });
    const emailSent = await sendEmailJsEmail(order);
    await sendAdminEmail(order);

    if (emailDryRun) {
      console.log("EMAIL_DRY_RUN=1: email omitido");
    } else if (resend && resendFrom && order.email) {
      try {
        const trackUrl = `https://lixby.es/track?orderId=${order.id}`;
        const itemsHtml = order.items
          .map(
            (item) => `
      <div style="display:flex;justify-content:space-between;padding:10px 14px;background:#f9fafb;border-radius:10px;margin-bottom:6px;font-size:0.875rem">
        <div>
          <div style="font-weight:700">${item.productName}</div>
          <div style="color:#6b7280">x${item.quantity}</div>
          ${
            item.engraving
              ? `<div style="color:#458500;font-weight:700;margin-top:4px">Grabado: ${escapeHtml(item.engraving)}</div>`
              : ""
          }
        </div>
        <div style="font-weight:800">${item.unitAmount ? (item.unitAmount / 100).toFixed(2).replace(".", ",") + " €" : "—"}</div>
      </div>
    `
          )
          .join("");

        await resend.emails.send({
          from: resendFrom,
          to: order.email,
          subject: `✅ Pedido ${order.orderNumber} confirmado — Lixby`,
          html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#1a3a00,#458500);padding:36px 40px;text-align:center">
      <div style="font-size:2rem;font-weight:800;color:#fff;letter-spacing:-0.02em">Lixby</div>
      <div style="color:rgba(255,255,255,0.8);font-size:0.9rem;margin-top:4px">Confirmación de pedido</div>
    </div>
    <div style="padding:36px 40px">
      <p style="font-size:1.05rem;color:#111827;margin:0 0 8px">Hola, <strong>${order.customerName || "Cliente"}</strong> 👋</p>
      <p style="color:#6b7280;line-height:1.6;margin:0 0 24px">Tu pedido ha sido confirmado y lo estamos preparando.</p>

      <div style="background:#f0f7e6;border:1px solid #d4edba;border-radius:12px;padding:16px 20px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:4px">Número de pedido</div>
          <div style="font-size:1.1rem;font-weight:800;color:#458500;font-family:monospace">${order.orderNumber}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:4px">Total</div>
          <div style="font-size:1.1rem;font-weight:800;color:#111827">${order.amountLabel || order.amountTotal + " €"}</div>
        </div>
      </div>

      <div style="margin-bottom:24px">
        <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:10px">Productos</div>
        ${itemsHtml}
      </div>

      <div style="background:#f9fafb;border-radius:12px;padding:16px 20px;margin-bottom:24px;font-size:0.875rem">
        <div style="font-weight:700;margin-bottom:6px;color:#111827">Dirección de entrega</div>
        <div style="color:#6b7280;line-height:1.6">${order.address || "No disponible"}</div>
      </div>

      <a href="${trackUrl}" style="display:block;background:#458500;color:#fff;text-decoration:none;text-align:center;padding:16px;border-radius:12px;font-weight:700;font-size:1rem;margin-bottom:16px">
        Seguir mi pedido →
      </a>
    </div>
    <div style="padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center">
      <p style="color:#9ca3af;font-size:0.78rem;margin:0">¿Alguna pregunta? <a href="mailto:info@lixby.es" style="color:#458500">info@lixby.es</a></p>
    </div>
  </div>
</body>
</html>`
        });
        console.log("✅ Email de confirmación enviado");
      } catch (error) {
        console.warn("No se pudo enviar el email Resend:", error.message);
      }
    }
  }

  res.sendStatus(200);
});

app.get("/track", (req, res) => {
  res.sendFile(path.join(__dirname, "track.html"));
});

app.get("/track/:orderId", (req, res) => {
  res.sendFile(path.join(__dirname, "track.html"));
});

// Route to verify Sentry integration


app.get("/track-order/:orderId", async (req, res) => {
  const orderId = req.params.orderId;
  if (!orderId) {
    return res.status(400).json({ error: "Falta el código del pedido." });
  }

  const doc = await db.collection("orders").doc(orderId).get();
  if (doc.exists) {
    return res.json(doc.data());
  }

  const snapshot = await db
    .collection("orders")
    .where("orderNumber", "==", orderId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return res.status(404).json({ error: "Pedido no encontrado." });
  }

  return res.json(snapshot.docs[0].data());
});

app.post("/admin/update-order", adminLimiter, async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (!adminApiKey || apiKey !== adminApiKey) {
    return res.status(401).send("No autorizado");
  }

  const { orderId, status, trackingCarrier, trackingNumber } = req.body;
  if (!orderId || !status) {
    return res.status(400).json({ error: "Faltan datos." });
  }

  const allowedStatuses = [
    "Pedido recibido",
    "Preparando pedido",
    "Enviado",
    "En reparto",
    "Entregado"
  ];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: "Estado no válido." });
  }

  const ref = db.collection("orders").doc(orderId);
  const existingDoc = await ref.get();
  if (!existingDoc.exists) {
    return res.status(404).json({ error: "Pedido no encontrado." });
  }

  const existing = existingDoc.data() || {};
  const update = { status };
  if (typeof trackingCarrier === "string") {
    update.trackingCarrier = trackingCarrier;
  }
  if (typeof trackingNumber === "string") {
    update.trackingNumber = trackingNumber;
  }

  const nextHistory = Array.isArray(existing.statusHistory) ? [...existing.statusHistory] : [];
  const lastEntry = nextHistory[nextHistory.length - 1];
  const hasStatusChanged = existing.status !== status;
  const hasTrackingChanged =
    (existing.trackingCarrier || "") !== (typeof trackingCarrier === "string" ? trackingCarrier : (existing.trackingCarrier || "")) ||
    (existing.trackingNumber || "") !== (typeof trackingNumber === "string" ? trackingNumber : (existing.trackingNumber || ""));

  if (hasStatusChanged || hasTrackingChanged || !lastEntry) {
    nextHistory.push({
      status,
      changedAt: new Date().toISOString(),
      actor: "admin",
      note: hasStatusChanged
        ? "Estado actualizado desde el panel admin"
        : "Datos de seguimiento actualizados desde el panel admin"
    });
  }

  update.statusHistory = nextHistory;

  await ref.update(update);
  return res.json({ ok: true, statusHistory: nextHistory });
});

app.post("/admin/notify-order", adminLimiter, async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (!adminApiKey || apiKey !== adminApiKey) {
    return res.status(401).send("No autorizado");
  }

  const { orderId } = req.body || {};
  if (!orderId) {
    return res.status(400).json({ error: "Falta orderId." });
  }

  const doc = await db.collection("orders").doc(orderId).get();
  if (!doc.exists) {
    return res.status(404).json({ error: "Pedido no encontrado." });
  }

  const order = { id: doc.id, ...doc.data() };
  const result = await sendOrderStatusEmail(order);
  if (!result.ok) {
    return res.status(500).json({ error: "No se pudo enviar el email.", detail: result.reason || null });
  }

  return res.json({ ok: true });
});

app.get("/admin/orders", adminLimiter, async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (!adminApiKey || apiKey !== adminApiKey) {
    return res.status(401).send("No autorizado");
  }

  const snapshot = await db.collection("orders").get();
  const orders = [];
  snapshot.forEach((doc) => {
    orders.push({ id: doc.id, ...doc.data() });
  });

  return res.json(orders);
});

app.get("/admin/gift-cards", adminLimiter, async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (!adminApiKey || apiKey !== adminApiKey) {
    return res.status(401).send("No autorizado");
  }

  const snapshot = await db.collection("giftCards").get();
  const giftCards = [];
  snapshot.forEach((doc) => {
    giftCards.push({ id: doc.id, ...doc.data() });
  });

  return res.json(giftCards);
});

// Datos del área de cliente: el email se obtiene del token de Firebase
// (nunca de la URL) para que nadie pueda leer pedidos de otra cuenta.
app.get("/orders-by-email", adminLimiter, async (req, res) => {
  let email;
  try {
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.replace("Bearer ", "").trim();
    if (!idToken) {
      return res.status(401).json({ error: "No autorizado" });
    }
    const decoded = await admin.auth().verifyIdToken(idToken);
    email = decoded.email;
  } catch (err) {
    return res.status(401).json({ error: "Token inválido" });
  }

  if (!email) {
    return res.status(400).json({ error: "El usuario no tiene email" });
  }

  try {
    const snapshot = await db
      .collection("orders")
      .where("email", "==", email)
      .where("paymentStatus", "==", "paid")
      .orderBy("createdAt", "desc")
      .get();

    const orders = [];
    snapshot.forEach((doc) => orders.push({ id: doc.id, ...doc.data() }));
    return res.json(orders);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/gift-cards-by-email", adminLimiter, async (req, res) => {
  let email;
  try {
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.replace("Bearer ", "").trim();
    if (!idToken) {
      return res.status(401).json({ error: "No autorizado" });
    }
    const decoded = await admin.auth().verifyIdToken(idToken);
    email = decoded.email;
  } catch (err) {
    return res.status(401).json({ error: "Token inválido" });
  }

  if (!email) {
    return res.status(400).json({ error: "El usuario no tiene email" });
  }

  try {
    const snapshot = await db
      .collection("giftCards")
      .where("senderEmail", "==", email)
      .get();

    const cards = [];
    snapshot.forEach((doc) => cards.push({ id: doc.id, ...doc.data() }));
    return res.json(cards);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Genera un custom token para transferir sesión a la app nativa
app.post("/auth/custom-token", authLimiter, async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.replace("Bearer ", "");

    if (!idToken) {
      return res.status(401).json({ error: "Token requerido" });
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    const customToken = await admin.auth().createCustomToken(decoded.uid);

    return res.json({ customToken });
  } catch (err) {
    console.error("Error generando custom token:", err.message);
    return res.status(401).json({ error: "Token inválido" });
  }
});

// Cierra la sesión en el resto de dispositivos revocando sus refresh tokens.
app.post("/auth/revoke-sessions", authLimiter, async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.replace("Bearer ", "");

    if (!idToken) {
      return res.status(401).json({ error: "Token requerido" });
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    await admin.auth().revokeRefreshTokens(decoded.uid);

    return res.json({ ok: true });
  } catch (err) {
    console.error("Error revocando sesiones:", err.message);
    return res.status(401).json({ error: "Token inválido" });
  }
});

function getLocalized404Page(requestPath) {
  const match = requestPath.match(/^\/([a-z]{2})(?:\/|$)/i);
  const lang = match ? match[1].toLowerCase() : "es";
  const candidates = [
    path.join(__dirname, lang, "error404", "index.html"),
    path.join(__dirname, lang, "error404.html"),
    path.join(__dirname, "es", "error404", "index.html"),
    path.join(__dirname, "es", "error404.html")
  ];

  return candidates.find((filePath) => fs.existsSync(filePath));
}

// Sentry error handler must be before other error handlers and after routes
Sentry.setupExpressErrorHandler(app);

app.use((req, res) => {
  const page404 = getLocalized404Page(req.path);

  if (page404 && (req.method === "GET" || req.method === "HEAD") && req.accepts("html")) {
    return res.status(404).sendFile(page404);
  }

  return res.status(404).json({ error: "Ruta no encontrada" });
});

app.listen(3000, () => console.log("Servidor funcionando"));
