import type { Handler } from "@netlify/functions";
import Stripe from "stripe";
import admin from "firebase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2022-11-15",
});

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    } as any),
  });
}
const db = admin.firestore();

export const handler: Handler = async (event) => {
  const sig = event.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return { statusCode: 400, body: "Missing Stripe signature/secret" };
  }

  let stripeEvent: Stripe.Event;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body as string, sig, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  try {
    switch (stripeEvent.type) {
      case "checkout.session.completed": {
        const session = stripeEvent.data.object as Stripe.Checkout.Session;
        const userId = (session.metadata?.userId as string) || "";
        const planKey = (session.metadata?.planKey as string) || "";
        const subscriptionId = session.subscription as string;

        if (userId) {
          await db.collection("users").doc(userId).set(
            {
              planKey,
              planStatus: "active",
              stripeSubscriptionId: subscriptionId,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = stripeEvent.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        // Find user by stripeCustomerId (indexed lookup recommended)
        const snap = await db
          .collection("users")
          .where("stripeCustomerId", "==", customerId)
          .limit(1)
          .get();

        if (!snap.empty) {
          const doc = snap.docs[0];
          const status = sub.status; // active, past_due, canceled, unpaid, etc.

          let planStatus: "active" | "past_due" | "canceled" = "active";
          if (status === "past_due" || status === "unpaid") planStatus = "past_due";
          if (status === "canceled") planStatus = "canceled";

          await doc.ref.set(
            {
              planStatus,
              stripeSubscriptionId: sub.id,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
        break;
      }

      default:
        // ignore unhandled events
        break;
    }

    return { statusCode: 200, body: "ok" };
  } catch (err: any) {
    console.error("stripeWebhook handler error:", err);
    return { statusCode: 500, body: "Webhook handler failed" };
  }
};