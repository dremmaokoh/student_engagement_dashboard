import assert from "node:assert/strict";
import test from "node:test";
import { displayImportValue, importCount, unwrapImportBatch } from "./importResponse.js";

const batch = { id: "batch-1", status: "previewed", validCount: 2, rejectedCount: 1 };

test("unwraps a useApiAction result containing an API envelope", () => {
  assert.deepEqual(unwrapImportBatch({ ok: true, data: { data: batch } }), batch);
});

test("unwraps a raw API envelope as well", () => {
  assert.deepEqual(unwrapImportBatch({ data: batch }), batch);
});

test("rejects incomplete or malformed import responses", () => {
  assert.equal(unwrapImportBatch(null), null);
  assert.equal(unwrapImportBatch({ ok: false, data: { message: "failed" } }), null);
  assert.equal(unwrapImportBatch([]), null);
});

test("counter helpers never produce blank or undefined values", () => {
  assert.equal(importCount(undefined), 0);
  assert.equal(importCount(null), 0);
  assert.equal(importCount("3"), 3);
  assert.equal(displayImportValue(null), "Missing");
  assert.equal(displayImportValue(0), "0");
  assert.equal(displayImportValue(""), "Missing");
});
