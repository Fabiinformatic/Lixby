const express = require("express");
const Stripe = require("stripe");
const cors = require("cors");
const admin = require("firebase-admin");
const path = require("path");
const { Resend } = require("resend");
require("dotenv").config();

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY || "TU_SECRET_KEY");
const resendApiKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const adminApiKey = process.env.ADMIN_API_KEY;

let db = null;
function initFirebase() {
  if (db) {
    return db;
  }

  try {
    if (admin.apps.length === 0) {
      if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        const serviceAccount = JSON.parse(
          process.env.FIREBASE_SERVICE_ACCOUNT_JSON
        );
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
        const serviceAccountPath = path.resolve(
          process.env.FIREBASE_SERVICE_ACCOUNT_PATH
        );
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      } else {
        console.warn(
          "Firebase no está configurado. Define FIREBASE_SERVICE_ACCOUNT_JSON o FIREBASE_SERVICE_ACCOUNT_PATH."
        );
        return null;
      }
    }

    db = admin.firestore();
    return db;
  } catch (error) {
    console.warn("Error inicializando Firebase:", error.message);
    return null;
  }
}

app.use(cors());

app.post("/create-checkout-session", async (req, res) => {
  const orderId = "LXB-" + Math.floor(Math.random() * 100000);
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
    success_url: process.env.STRIPE_SUCCESS_URL || "https://tusitio.com/success",
    cancel_url: process.env.STRIPE_CANCEL_URL || "https://tusitio.com/cancel"
  });

  res.json({ id: session.id, orderId });
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
    const orderId = session.metadata && session.metadata.orderId;

    const order = {
      id: orderId || "LXB-" + Math.floor(Math.random() * 100000),
      email: session.customer_details && session.customer_details.email,
      product: "Cascos Lixby",
      status: "Pedido recibido",
      sessionId: session.id,
      createdAt: new Date().toISOString()
    };

    console.log(order);
    const firestore = initFirebase();
    if (firestore) {
      await firestore.collection("orders").doc(order.id).set(order);
    }

    if (resend && resendFrom && order.email) {
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

  const firestore = initFirebase();
  if (!firestore) {
    return res.status(500).json({ error: "Firebase no está configurado." });
  }

  const doc = await firestore.collection("orders").doc(orderId).get();
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

  const firestore = initFirebase();
  if (!firestore) {
    return res.status(500).json({ error: "Firebase no está configurado." });
  }

  const update = { status };
  if (trackingCarrier) {
    update.trackingCarrier = trackingCarrier;
  }
  if (trackingNumber) {
    update.trackingNumber = trackingNumber;
  }

  await firestore.collection("orders").doc(orderId).update(update);
  return res.json({ ok: true });
});

app.get("/admin/orders", async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (!adminApiKey || apiKey !== adminApiKey) {
    return res.status(401).send("No autorizado");
  }

  const firestore = initFirebase();
  if (!firestore) {
    return res.status(500).json({ error: "Firebase no está configurado." });
  }

  const snapshot = await firestore.collection("orders").get();
  const orders = [];
  snapshot.forEach((doc) => {
    orders.push({ id: doc.id, ...doc.data() });
  });

  return res.json(orders);
});

app.listen(3000, () => console.log("Servidor funcionando"));
