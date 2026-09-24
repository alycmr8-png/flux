/**
 * The facts the Privacy Policy and Terms both state about who operates Ucorns.
 *
 * One place, because the two documents have to agree: a policy naming one operator
 * and terms naming another is worse than either alone, and these are the details a
 * payment provider or app store checks first.
 *
 * OPERATOR must also match the name on the Stripe account. Stripe pays out only to
 * a bank account in the account holder's name, so a mismatch between these
 * documents and Stripe is a real problem, not a cosmetic one.
 */

/** Legal operator. Not a registered company — see LEGAL_STATUS below. */
export const OPERATOR = "Aly Camara, trading as Ucorns";

/**
 * There is no incorporated entity yet, so the operator is a natural person using a
 * trade name. Stating a company that does not exist would misdescribe who the
 * contract is with, and would undermine the liability limit it is meant to support.
 * When an LLC is formed, change OPERATOR to the company's registered name and add
 * its registered address.
 */
export const LEGAL_STATUS = "sole trader";

/** Where the operator is based — sets governing law and the courts. */
export const LOCATION = "New York, United States";
export const GOVERNING_LAW = "the State of New York, United States";
export const COURTS = "the state and federal courts located in the State of New York";

/** Public contact for privacy requests and support. */
export const CONTACT_EMAIL = "alycmr8@gmail.com";

/**
 * 16 rather than 13: Ucorns is for university students, and staying above 13 keeps
 * it clear of COPPA's parental-consent regime entirely, while 16 is at or above the
 * GDPR age of consent in every member state.
 */
export const MIN_AGE = 16;

/** Where data is stored: Neon Postgres and the audio volume are both US East. */
export const DATA_REGION = "the United States (US East)";

/** Infrastructure providers named in the processor table. */
export const HOSTING = "Railway (application servers and stored audio) and Netlify (website)";

/** Billing records, kept for tax and accounting. */
export const BILLING_RETENTION = "seven years";

/** How long a deleted account can persist in rotating backups. */
export const BACKUP_RETENTION = "30 days";

/** Notice given before a price change takes effect. */
export const PRICE_NOTICE = "30 days";

/** Floor on the liability cap, in USD. */
export const LIABILITY_FLOOR = "USD 100";

/** Refunds: statutory rights only, per the operator's decision. */
export const REFUND_POLICY =
  "We do not give refunds for periods already paid for, except where the law requires one.";
