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

const serviceAccount = require("./firebase-service-account.json");
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

  const payload = {
    service_id: emailjsServiceId,
    template_id: emailjsTemplateId,
    user_id: emailjsPublicKey,
    template_params: {
      order_id: order.id,
      email: order.email,
      status: order.paymentStatus || order.status,
      amount: order.amountTotal,
      currency: order.currency || "EUR"
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
          res.on("end", () => resolve(ok));
        }
      );

      req.on("error", () => resolve(false));
      req.write(body);
      req.end();
    } catch (error) {
      resolve(false);
    }
  });
}

app.post("/create-checkout-session", express.json(), async (req, res) => {
  const { orderId: rawOrderId, successUrl, cancelUrl } = req.body || {};
  const orderId = rawOrderId || `LXB-${Math.floor(Math.random() * 100000)}`;
  const successWithOrder = appendQueryParam(
    successUrl || process.env.STRIPE_SUCCESS_URL || "https://tusitio.com/success",
    "orderId",
    orderId
  );
  const cancelWithOrder =
    cancelUrl || process.env.STRIPE_CANCEL_URL || "https://tusitio.com/cancel";
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [
      {
        price: process.env.STRIPE_PRICE_ID || "TU_PRICE_ID",
        quantity: 1
      }
    ],
    metadata: {
      orderId
    },
    client_reference_id: orderId,
    success_url: successWithOrder,
    cancel_url: cancelWithOrder
  });

  res.json({ id: session.id, url: session.url, orderId });
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

    const order = {
      id: orderId || `LXB-${Math.floor(Math.random() * 100000)}`,
      email: session.customer_details && session.customer_details.email,
      product: "Cascos Lixby",
      status: "Pedido recibido",
      paymentStatus: "paid",
      sessionId: session.id,
      amountTotal: session.amount_total ? session.amount_total / 100 : null,
      currency: session.currency ? session.currency.toUpperCase() : "EUR",
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
          text: `Tu pedido en Lixby\n\nCódigo: ${order.id}\n\nRastrea aquí:\n${trackUrl}`
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
  if (!doc.exists) {
    return res.status(404).json({ error: "Pedido no encontrado." });
  }

  return res.json(doc.data());
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

