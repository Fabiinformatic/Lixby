const functions = require("firebase-functions");
const Stripe = require("stripe");

const stripe = new Stripe("TU_STRIPE_SECRET_KEY");

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

    // Aquí luego enviaremos el email y guardaremos el pedido
  }

  res.json({ received: true });

});