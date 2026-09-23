/**
 * The one place a Stripe client is built, so the API version can't drift between
 * checkout, the webhook handler and account deletion — three files that all have
 * to agree about the shape of a Subscription.
 */

/**
 * Pinned deliberately, not inherited from the SDK.
 *
 * The installed SDK defaults to 2025-02-24.acacia, and Managed Payments — enabled
 * by default on the account — refuses to run on it: every checkout session comes
 * back with "Managed Payments is not supported on API version 2025-02-24.acacia".
 *
 * Basil is not a free upgrade: it removed current_period_start/end from the
 * Subscription object and moved them onto each subscription item. Read that field
 * through subscriptionPeriodEnd() below and nowhere else.
 */
export const STRIPE_API_VERSION = "2025-03-31.basil";

let client: any;

/**
 * Built on first use rather than at import, so a deploy without STRIPE_SECRET_KEY
 * still boots and serves everything that isn't billing.
 */
export function stripe(): any {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Stripe = require("stripe");
  client = new Stripe(key, { apiVersion: STRIPE_API_VERSION });
  return client;
}

/**
 * When the subscription's current billing period ends — during a trial, when the
 * trial does.
 *
 * Reads the subscription item first (basil) and falls back to the old top-level
 * field, so it survives the version change in either direction. Throws rather than
 * returning an Invalid Date: this timestamp is what planFor() compares against to
 * decide whether someone counts as paid, and an Invalid Date loses every
 * comparison silently, turning a paying student into a free one.
 */
export function subscriptionPeriodEnd(subscription: any): Date {
  const seconds =
    subscription?.items?.data?.[0]?.current_period_end ?? subscription?.current_period_end;
  if (typeof seconds !== "number") {
    throw new Error(
      `Stripe subscription ${subscription?.id ?? "?"} carries no current_period_end`,
    );
  }
  return new Date(seconds * 1000);
}
