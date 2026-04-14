// netlify/functions/create-checkout-session.ts

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
//const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const handler = async (event: any) => {
  // ✅ Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  console.log("Stripe key:", process.env.STRIPE_SECRET_KEY);

  try {
    // ✅ Safe parsing
    const body = JSON.parse(event.body || "{}");

    const { priceId, userId, product, email } = body;

    if (!priceId || !userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing parameters" }),
      };
    }

    // ✅ Base URL fallback (important)
    const baseUrl =
      process.env.URL ||
      process.env.DEPLOY_PRIME_URL ||
      "http://localhost:8888";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",

      payment_method_types: ["card"],

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      // ✅ Better UX + future features
      allow_promotion_codes: true,
      billing_address_collection: "auto",

      // ✅ Attach email if available
      customer_email: email || undefined,

      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing`,

      metadata: {
        userId,
        product, // contilisto | dscribo
      },

      subscription_data: {
        metadata: {
          userId,
          product,
        },
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (error: any) {
    console.error("Stripe error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Internal Server Error",
        message: error.message,
      }),
    };
  }
};