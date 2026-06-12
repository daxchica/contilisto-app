// netlify/functions/create-checkout-session.ts
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method Not Allowed" }, { status: 405 });
  }

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { priceId, userId, product, email } = body;

    if (!priceId || typeof priceId !== "string") {
      return Response.json({ error: "Invalid priceId" }, { status: 400 });
    }
    if (!userId || typeof userId !== "string") {
      return Response.json({ error: "Invalid userId" }, { status: 400 });
    }
    if (email && typeof email !== "string") {
      return Response.json({ error: "Invalid email" }, { status: 400 });
    }

    const baseUrl =
      process.env.URL ||
      process.env.DEPLOY_PRIME_URL ||
      "http://localhost:8888";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      customer_email: email || undefined,
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing`,
      metadata: { userId, product },
      subscription_data: { metadata: { userId, product } },
    });

    return Response.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe error:", error);
    return Response.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
  }
};
