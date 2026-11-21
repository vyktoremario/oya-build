import { describe, expect, it } from "vitest";
import { PRICE_ITEM_IDS } from "@oya/schema";
import { PRICE_BOOKS } from "../src";

describe("price books", () => {
  for (const book of PRICE_BOOKS) {
    it(`${book.id} prices every material the engine uses, with a source and date`, () => {
      const ids = new Set(book.items.map((i) => i.id));
      for (const id of PRICE_ITEM_IDS) expect(ids.has(id), id).toBe(true);
      for (const s of book.openingSpecs) expect(ids.has(s.priceItemId), s.id).toBe(true);
      for (const i of book.items) {
        expect(i.source.length, i.id).toBeGreaterThan(5);
        expect(i.observedAt, i.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(i.rate, i.id).toBeGreaterThan(0);
      }
    });
  }
});
