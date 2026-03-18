import { processOrder } from "./order-service.js";

const order = {
  itemPrice: 29.99,
  itemCount: 3,
  tax: 0.08,
};

// Expected: $29.99 * 3 * 1.08 = $97.17
// Actual (buggy): $0.08 * 29.99 * (1 + 3) = $9.60
const result = processOrder(order);
console.log(`Order total: ${result}`);
console.log(`Expected: $97.17`);
