import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export default async (req: Request): Promise<Response> => {
  const sig = req.headers.get("stripe-signature") ?? "";
  const rawBody = await req.text();

  let stripeEvent: Stripe.Event;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("❌ Webhook signature failed", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object as Stripe.Checkout.Session;
    console.log("✅ Payment success:", session);
    const userId = session.metadata?.userId;
    const subscriptionId = session.subscription;
    console.log("User:", userId);
    console.log("Subscription:", subscriptionId);
  }

  return new Response("Success", { status: 200 });
};
