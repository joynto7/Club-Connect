import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSlug, buildCsvRows, sanitizeFilename } from "../textHelpers.ts";

test("generateSlug — lowercases and hyphenates", () => {
  assert.equal(generateSlug("Chess Club"), "chess-club");
});

test("generateSlug — strips leading/trailing separators", () => {
  assert.equal(generateSlug("  --Robotics!!--  "), "robotics");
});

test("generateSlug — collapses runs of non-alphanumerics", () => {
  assert.equal(generateSlug("A///B   C"), "a-b-c");
});

test("generateSlug — empty input yields empty string", () => {
  assert.equal(generateSlug(""), "");
});

test("generateSlug — unicode letters are dropped (ASCII-only slug)", () => {
  assert.equal(generateSlug("Café Société"), "caf-soci-t");
});

test("buildCsvRows — plain values need no quoting", () => {
  assert.equal(buildCsvRows(["a", "b"], [["1", "2"]]), "a,b\n1,2");
});

test("buildCsvRows — quotes values containing commas", () => {
  assert.equal(buildCsvRows(["name"], [["Doe, John"]]), 'name\n"Doe, John"');
});

test("buildCsvRows — escapes embedded quotes by doubling them", () => {
  assert.equal(buildCsvRows(["note"], [['Say "hi"']]), 'note\n"Say ""hi"""');
});

test("buildCsvRows — quotes values containing newlines", () => {
  assert.equal(buildCsvRows(["note"], [["line1\nline2"]]), 'note\n"line1\nline2"');
});

test("sanitizeFilename — strips characters unsafe for Content-Disposition", () => {
  assert.equal(sanitizeFilename('../../etc/passwd; rm -rf "x"'), "etcpasswd_rm_-rf_x");
});

test("sanitizeFilename — collapses spaces to underscores", () => {
  assert.equal(sanitizeFilename("Members Report 2026"), "Members_Report_2026");
});
