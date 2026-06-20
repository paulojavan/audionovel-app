import Stripe from "stripe";

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export const premiumPriceId = process.env.STRIPE_PREMIUM_PRICE_ID;
