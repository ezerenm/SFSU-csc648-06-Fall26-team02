import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAttemptQuery, EMPTY_FORM, PAGE_SIZE } from "../lib/spatial/attemptQuery";

const map = "20000000-0000-4000-8000-000000000001";
const point = "60000000-0000-4000-8000-000000000002";

test("no filters sends only the map and the first page", () => {
  const p = new URLSearchParams(buildAttemptQuery(map, EMPTY_FORM));
  assert.equal(p.get("map_version_id"), map);
  assert.equal(p.get("limit"), String(PAGE_SIZE));
  assert.equal(p.get("offset"), "0");
  assert.deepEqual([...p.keys()].sort(), ["limit", "map_version_id", "offset"]);
});

test("filters and page become query parameters", () => {
  const p = new URLSearchParams(buildAttemptQuery(map, { test_point_id: point, outcome: "timeout", q: "  TP2 ", page: 2 }));
  assert.equal(p.get("test_point_id"), point);
  assert.equal(p.get("outcome"), "timeout");
  assert.equal(p.get("q"), "TP2");
  assert.equal(p.get("offset"), String(2 * PAGE_SIZE));
});

test("unknown outcomes, wildcards and over-long text cannot cause a 400", () => {
  const p = new URLSearchParams(buildAttemptQuery(map, { ...EMPTY_FORM, outcome: "bogus", q: "*" }));
  assert.equal(p.has("outcome"), false);
  assert.equal(p.has("q"), false);
  const long = new URLSearchParams(buildAttemptQuery(map, { ...EMPTY_FORM, q: "a".repeat(300) }));
  assert.equal(long.get("q")?.length, 120);
  assert.equal(new URLSearchParams(buildAttemptQuery(map, { ...EMPTY_FORM, page: -3 })).get("offset"), "0");
});
