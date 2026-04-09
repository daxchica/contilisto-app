import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const handler = async (event: any) => {
  const sig = event.headers["stripe-signature"];

  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("❌ Webhook signature failed", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // ✅ HANDLE EVENTS
  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object as Stripe.Checkout.Session;

    console.log("✅ Payment success:", session);

    const userId = session.metadata?.userId;
    const subscriptionId = session.subscription;

    // 👉 HERE we will save to Firestore (next step)
    console.log("User:", userId);
    console.log("Subscription:", subscriptionId);
  }

  return { statusCode: 200, body: "Success" };
};