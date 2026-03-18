import { calculateTotal, formatCurrency } from "./math-utils.js";

export interface Order {
  itemPrice: number;
  itemCount: number;
  tax: number;
}

export function processOrder(order: Order): string {
  // BUG: arguments are in wrong order!
  // Should be: calculateTotal(order.itemPrice, order.itemCount, order.tax)
  // But calling: calculateTotal(order.tax, order.itemPrice, order.itemCount)
  const total = calculateTotal(order.tax, order.itemPrice, order.itemCount);
  return formatCurrency(total);
}
