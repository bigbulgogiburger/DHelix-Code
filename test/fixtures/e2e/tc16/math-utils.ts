/**
 * Calculate total price including tax
 * @param price - unit price
 * @param quantity - number of items
 * @param taxRate - tax rate as decimal (e.g., 0.1 for 10%)
 */
export function calculateTotal(price: number, quantity: number, taxRate: number): number {
  return price * quantity * (1 + taxRate);
}

export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
