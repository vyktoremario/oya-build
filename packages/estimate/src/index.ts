import type { Plan, PriceBook } from "@oya/schema";
import { price } from "./price";
import { takeoff } from "./takeoff";

export * from "./constants";
export * from "./takeoff";
export * from "./price";

/** Plan + price book → priced bill of quantities. */
export function estimate(plan: Plan, book: PriceBook) {
  return price(takeoff(plan, book.openingSpecs), book, plan.priceOverrides, plan.params.labourPercent);
}
export * from "./price-books";
