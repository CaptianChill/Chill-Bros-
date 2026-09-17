// Public, owner-provided hosted checkout. This is not an API credential.
export const SQUARE_PAYMENT_URL = "https://square.link/u/TezbYuSG";

export function squarePaymentAvailable(amount: number) {
  // Buyer-entered amount limits published by this Square checkout.
  return Number.isFinite(amount) && amount >= 1 && amount <= 50_000;
}
