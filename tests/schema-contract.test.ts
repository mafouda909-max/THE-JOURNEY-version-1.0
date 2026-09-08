import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "../src/db/schema";

test("read-only database checker covers every actual Drizzle table and column", () => {
  const source = ts.createSourceFile(
    "check.ts",
    readFileSync("scripts/check-production-schema.ts", "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const declared: Record<string, string[]> = {};
  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(source) === "requiredSchema" &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const entry of node.initializer.properties) {
        assert.ok(
          ts.isPropertyAssignment(entry) &&
            ts.isArrayLiteralExpression(entry.initializer),
        );
        declared[entry.name.getText(source).replaceAll('"', "")] =
          entry.initializer.elements.map((e) => {
            assert.ok(ts.isStringLiteral(e));
            return e.text;
          });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  const actual: Record<string, string[]> = {};
  for (const table of Object.values(schema))
    if (is(table, PgTable)) {
      const c = getTableConfig(table);
      actual[c.name] = c.columns.map((column) => column.name);
    }
  assert.deepEqual(Object.keys(declared).sort(), Object.keys(actual).sort());
  for (const name of Object.keys(actual))
    assert.deepEqual(declared[name].sort(), actual[name].sort(), name);
});
