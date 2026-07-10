import Stripe from "stripe";

let client: Stripe | null = null;

/** Lazily constructed so builds don't require STRIPE_SECRET_KEY. */
export function getStripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    client = new Stripe(key, { typescript: true });
  }
  return client;
}
