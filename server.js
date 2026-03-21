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

app.post("/create-checkout-session", express.json(), async (req, res) => {
  console.log("📦 BODY RECIBIDO:", JSON.stringify(req.body, null, 2));
  const { orderId: rawOrderId, successUrl, cancelUrl, items } = req.body || {};
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
      if (emailSent) {
        return res.sendStatus(200);
      }
      try {
        const baseUrl = process.env.PUBLIC_BASE_URL || "http://localhost:3000";
        const trackUrl = `${baseUrl}/track/${order.id}`;
        await resend.emails.send({
          from: resendFrom,
          to: order.email,
          subject: "Tu pedido en Lixby",
          text: `Tu pedido en Lixby\n\nNumero de pedido: ${order.orderNumber}\nID interno: ${order.id}\nProducto: ${order.product}\nTotal: ${order.amountLabel || order.amountTotal || ""}\nDireccion: ${order.address || "No aplica"}\n\nRastrea aqui:\n${trackUrl}`
        });
      } catch (error) {
        console.warn("No se pudo enviar el email:", error.message);
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

app.listen(3000, () => console.log("Servidor funcionando"));
