import assert from "node:assert/strict";
import test from "node:test";
import { serialNumber } from "./serialNumber.js";

test("serial numbers start at one for unpaginated tables", () => {
  assert.equal(serialNumber(0), 1);
  assert.equal(serialNumber(4), 5);
});

test("serial numbers continue from the page offset when paginated", () => {
  assert.equal(serialNumber(0, { page: 1, limit: 10 }), 1);
  assert.equal(serialNumber(9, { page: 1, limit: 10 }), 10);
  assert.equal(serialNumber(0, { page: 2, limit: 10 }), 11);
  assert.equal(serialNumber(4, { page: 3, limit: 25 }), 55);
});

test("invalid pagination values fall back to simple sequential numbering", () => {
  assert.equal(serialNumber(2, { page: 0, limit: 0 }), 3);
  assert.equal(serialNumber(2, { page: "x", limit: "y" }), 3);
});
