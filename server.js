const express = require("express");
const Stripe = require("stripe");
const cors = require("cors");
const admin = require("firebase-admin");
const https = require("https");
const path = require("path");
const { Resend } = require("resend");
require("dotenv").config();

const app = express();
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
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (e) {
  console.error("Error parsing FIREBASE_SERVICE_ACCOUNT:", e.message);
  process.exit(1);
}
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
app.use(cors());

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
  if (!emailjsServiceId || !emailjsTemplateId || !emailjsPublicKey || !order.email) {
    return Promise.resolve(false);
  }

  const orders = (order.items || []).map((item) => ({
    name: item.productName,
    units: item.quantity || 1,
    price: item.unitAmount ? (item.unitAmount / 100).toFixed(2) : "0.00",
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
            console.log(ok ? "✅ Email enviado a:" : "❌ Email fallido:", order.email);
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
      <p style="color:#9ca3af;font-size:0.78rem;margin:0">La tarjeta no tiene fecha de caducidad · <a href="mailto:lixbyinfo@gmail.com" style="color:#458500">Soporte</a></p>
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
    console.log("✅ Gift card email enviado a:", toEmail);
    return true;
  } catch (err) {
    console.error("❌ Gift card email error:", err.message);
    return false;
  }
}

function sendAdminEmail(order) {
  const adminTemplateId = process.env.EMAILJS_ADMIN_TEMPLATE_ID;
  if (!emailjsServiceId || !adminTemplateId || !emailjsPublicKey) {
    return Promise.resolve(false);
  }

  const orders = (order.items || []).map((item) => ({
    name: item.productName,
    units: item.quantity || 1,
    price: item.unitAmount ? (item.unitAmount / 100).toFixed(2) : "0.00",
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

function buildStripeLineItems(items) {
  if (!Array.isArray(items)) return [];
  const lineItems = [];
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
      lineItems.push({
        price_data: {
          currency: "eur",
          unit_amount: Math.round(basePrice * 100),
          product_data: {
            name: displayName,
            metadata: {
              item_id: item.lineId || item.id || "",
              color,
              plan
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
  return lineItems;
}

app.post("/create-gift-card-session", express.json(), async (req, res) => {
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

app.post("/redeem-gift-card", express.json(), async (req, res) => {
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

app.post("/use-gift-card", express.json(), async (req, res) => {
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

app.post("/create-checkout-session", express.json(), async (req, res) => {
  console.log("📦 BODY RECIBIDO:", JSON.stringify(req.body, null, 2));
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
  try {
    const priceIdLineItems = Array.isArray(items)
      ? items
          .map((item) => ({
            price: item && item.priceId ? item.priceId : null,
            quantity: Math.max(1, Number((item && (item.quantity || item.qty)) || 1))
          }))
          .filter((item) => Boolean(item.price))
      : [];

    const dynamicLineItems =
      priceIdLineItems.length > 0 ? priceIdLineItems : buildStripeLineItems(items);

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
        items: JSON.stringify(items || [])
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

app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;

  try {
    if (!endpointSecret) {
      throw new Error("Falta STRIPE_WEBHOOK_SECRET");
    }
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error("Webhook signature verification failed.", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
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
        sessionId: session.id,
        createdAt: new Date().toISOString()
      };

      await db.collection("giftCards").doc(code).set(giftCard);
      console.log("🎁 Tarjeta regalo creada:", code);

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
        limit: 10,
        expand: ["data.price.product"]
      });
      lineItems = items && items.data ? items.data : [];
    } catch (error) {
      console.warn("No se pudieron cargar los line items:", error.message);
    }

    const orderItems = lineItems.map((item) => {
      const productName =
        (item.price &&
          item.price.product &&
          typeof item.price.product === "object" &&
          item.price.product.name) ||
        item.description ||
        "Producto";
      return {
        productName,
        priceId: item.price ? item.price.id : null,
        quantity: item.quantity || 1,
        unitAmount: item.price ? item.price.unit_amount : null
      };
    });

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
      status: "Pedido recibido",
      paymentStatus: "paid",
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

    console.log(order);
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

    if (resend && resendFrom && order.email) {
      try {
        const trackUrl = `https://lixby.es/track.html?orderId=${order.id}`;
        const itemsHtml = order.items
          .map(
            (item) => `
      <div style="display:flex;justify-content:space-between;padding:10px 14px;background:#f9fafb;border-radius:10px;margin-bottom:6px;font-size:0.875rem">
        <div>
          <div style="font-weight:700">${item.productName}</div>
          <div style="color:#6b7280">x${item.quantity}</div>
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
      <p style="color:#9ca3af;font-size:0.78rem;margin:0">¿Alguna pregunta? <a href="mailto:lixbyinfo@gmail.com" style="color:#458500">lixbyinfo@gmail.com</a></p>
    </div>
  </div>
</body>
</html>`
        });
        console.log("✅ Email Resend enviado a:", order.email);
      } catch (error) {
        console.warn("No se pudo enviar el email Resend:", error.message);
      }
    }
  }

  res.sendStatus(200);
});

app.use(express.json());

app.get("/track", (req, res) => {
  res.sendFile(path.join(__dirname, "track.html"));
});

app.get("/track/:orderId", (req, res) => {
  res.sendFile(path.join(__dirname, "track.html"));
});

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

app.post("/admin/update-order", async (req, res) => {
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

  const update = { status };
  if (trackingCarrier) {
    update.trackingCarrier = trackingCarrier;
  }
  if (trackingNumber) {
    update.trackingNumber = trackingNumber;
  }

  await db.collection("orders").doc(orderId).update(update);
  return res.json({ ok: true });
});

app.get("/admin/orders", async (req, res) => {
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

app.get("/orders-by-email/:email", async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (!adminApiKey || apiKey !== adminApiKey) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const email = decodeURIComponent(req.params.email);
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

app.get("/gift-cards-by-email/:email", async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (!adminApiKey || apiKey !== adminApiKey) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const email = decodeURIComponent(req.params.email);
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

app.listen(3000, () => console.log("Servidor funcionando"));
