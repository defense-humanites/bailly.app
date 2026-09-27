/**
 * What PayPal's Donate SDK passes once a donation is done.
 * @see https://developer.paypal.com/sdk/donate
 */
export type DonationResult = {
  /** The transaction ID. */
  tx?: string;
  /** The transaction status (e.g. `Completed`). */
  st?: string;
  /** The amount (e.g. `10.00`). */
  amt?: string;
  /** The currency code (e.g. `EUR`). */
  cc?: string;
};

/**
 * The thanks for a donation, with its amount when PayPal gives it.
 * @remarks The result comes from PayPal's script, not from the URL (which
 * anyone could forge): the amount can be shown.
 */
export function donationThanks({ st, amt, cc }: DonationResult): string {
  if (st && st.toLowerCase() !== "completed") {
    return "Merci ! Votre don est en cours de traitement par PayPal.";
  }
  const amount = Number(amt);
  if (!amt || !Number.isFinite(amount) || !cc || !/^[A-Z]{3}$/.test(cc)) return "Merci pour votre don !";
  const formatted = new Intl.NumberFormat("fr-FR", { style: "currency", currency: cc }).format(amount);
  return `Merci pour votre don de ${formatted} !`;
}
