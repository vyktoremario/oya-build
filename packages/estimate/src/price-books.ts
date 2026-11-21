import { type PriceBook, PriceBookSchema } from "@oya/schema";
import abuja202611 from "../price-books/abuja-2026-11.json";

/** All price books, newest first per region. Adding a city or a month is a data-only change. */
export const PRICE_BOOKS: PriceBook[] = [PriceBookSchema.parse(abuja202611)];
export const DEFAULT_PRICE_BOOK: PriceBook = PRICE_BOOKS[0]!;
