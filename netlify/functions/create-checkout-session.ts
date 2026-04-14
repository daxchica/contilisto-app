// netlify/functions/create-checkout-session.ts

import Stripe from "stripe";

// ============================================================
// INIT STRIPE (SAFE FOR NETLIFY ENV)
// ============================================================

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is not set in Netlify environment variables");
}

const stripe = new Stripe(stripeSecretKey);

// ============================================================
// HANDLER
// ============================================================

export const handler = async (event: any) => {
  // ==========================================================
  // METHOD CHECK
  // ==========================================================
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    // =======================================================
    // SAFE BODY PARSE
    // =======================================================
    let body: any = {};

    try {
        // ✅ Safe parsing
        body = JSON.parse(event.body || "{}");
    } catch {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Invalid JSON body"}),
        };
    }

    const { priceId, userId, product, email } = body;

    // ============================================================
    // VALIDATION
    // ============================================================
    if (!priceId || typeof priceId !== "string") {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid priceId" }),
      };
    }

    if (!userId || typeof userId !== "string") {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid userId" }),
      };
    }

    if (email && typeof email !== "string") {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid email" }),
      };
    }

    // ============================================================
    // BASE URL (NETLIFY SAFE)
    // ============================================================
    const baseUrl =
      process.env.URL ||                 // production domain
      process.env.DEPLOY_PRIME_URL ||   // preview deploy
      "http://localhost:8888";          // local fallback

    // ============================================================
    // CREATE CHECKOUT SESSION
    // ============================================================

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