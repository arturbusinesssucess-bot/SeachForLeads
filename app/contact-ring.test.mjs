import test from "node:test";
import assert from "node:assert/strict";
import { contactRingPath } from "./contact-ring.mjs";

test("empty and invalid percentages do not paint a contact arc", () => {
  for (const rate of [0, -1, NaN, Infinity, undefined]) assert.equal(contactRingPath(rate), "");
});

test("partial contact coverage follows a circular centerline without wavy curves", () => {
  for (const rate of [50, 99]) {
    const path = contactRingPath(rate);
    assert.ok(!/[CQZ]/.test(path));
    const coordinates = path.match(/^M ([\d.-]+) ([\d.-]+) A 44 44 0 ([01]) 1 ([\d.-]+) ([\d.-]+)$/);
    assert.ok(coordinates);
    const cap = Math.asin(4.5 / 44);
    const angle = rate / 100 * 2 * Math.PI;
    assert.equal(Number(coordinates[3]), angle - cap * 2 > Math.PI ? 1 : 0);
    assert.ok(Math.abs(Number(coordinates[1]) - (55 + 44 * Math.cos(cap))) <= 0.0005);
    assert.ok(Math.abs(Number(coordinates[2]) - (55 + 44 * Math.sin(cap))) <= 0.0005);
    assert.ok(Math.abs(Number(coordinates[4]) - (55 + 44 * Math.cos(angle - cap))) <= 0.0005);
    assert.ok(Math.abs(Number(coordinates[5]) - (55 + 44 * Math.sin(angle - cap))) <= 0.0005);
  }
});

test("tiny nonzero coverage paints a round dot without overlapping arc caps", () => {
  const path = contactRingPath(1);
  const points = path.match(/^M ([\d.-]+ [\d.-]+) L ([\d.-]+ [\d.-]+)$/);
  assert.ok(points);
  assert.equal(points[1], points[2]);
});

test("complete contact coverage is a continuous full circle", () => {
  const complete = "M 99 55 A 44 44 0 1 1 11 55 A 44 44 0 1 1 99 55";
  assert.equal(contactRingPath(100), complete);
  assert.equal(contactRingPath(120), complete);
});
