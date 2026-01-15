import type { Handler } from "@netlify/functions";
import Stripe from "stripe";
import admin from "firebase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-11-17.clover",
});

// Init Firebase Admin (Netlify Functions)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Important: replace escaped newlines
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    } as any),
  });
}

const db = admin.firestore();

const PRICE_MAP: Record<string, string | undefined> = {
  pro: process.env.STRIPE_PRICE_PRO,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
  // starter no paga
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { planKey, userId, email, successUrl, cancelUrl } = JSON.parse(event.body || "{}");

    const priceId = PRICE_MAP[planKey];
    if (!userId || !email || !planKey) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields" }) };
    }
    if (!priceId) {
      return { statusCode: 400, body: JSON.stringify({ error: "Plan is not payable or not configured" }) };
    }

    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return { statusCode: 404, body: JSON.stringify({ error: "User not found" }) };
    }

    const userData = userSnap.data() || {};
    let customerId = userData.stripeCustomerId as string | undefined;

    // Create or reuse Stripe customer
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { userId },
      });
      customerId = customer.id;
      await userRef.set({ stripeCustomerId: customerId }, { merge: true });
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      // optional: allow promo codes
      allow_promotion_codes: true,
      metadata: { userId, planKey },
      success_url: successUrl || `${frontendUrl}/dashboard?checkout=success`,
      cancel_url: cancelUrl || `${frontendUrl}/planes?checkout=canceled`,
    });

    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (err: any) {
    console.error("createCheckoutSession error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal error" }) };
  }
};