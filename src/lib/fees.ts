/**
 * DuesDesk platform revenue: a flat convenience fee added to each online
 * payment, collected via Stripe Connect application fees. The org still
 * receives their full dues amount; the member sees the fee as its own line
 * at checkout. Change the number here to change it everywhere.
 */
export const PLATFORM_FEE_CENTS = 195; // $1.95 per online payment
export const PLATFORM_FEE_LABEL = "Convenience fee";
