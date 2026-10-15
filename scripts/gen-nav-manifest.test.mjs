// node --test scripts/gen-nav-manifest.test.mjs
//
// The `embeds[]` gate of gen:nav (docs/composition-and-slots.md §3): a valid
// embed passes, a slot outside core's vocabulary fails naming both
// (inversion check 1), ids are unique, `opens` must reach a declared entry,
// and a pair with no embeds serializes no `embeds` key.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertUniqueEmbedIds,
  auditEmbedOpens,
  buildPackageNavManifest,
  validateEmbeds,
} from "./nav-lib.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// The vocabulary comes from core's source, exactly as gen:nav reads it; a
// child process because `node --test` here runs without strip-types.
const SHELL_SLOT_IDS = JSON.parse(
  execFileSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--no-warnings",
      "--input-type=module",
      "-e",
      `const m = await import(${JSON.stringify(resolve(ROOT, "packages/core/src/nav.ts"))});` +
        "process.stdout.write(JSON.stringify(m.SHELL_SLOT_IDS));",
    ],
    { encoding: "utf8" }
  )
);

const PKG = "@stapel/notifications-react";
const bell = {
  id: "notifications.bell",
  slot: "topbar.end",
  component: { export: "NotificationBell", subpath: "default" },
  order: 20,
  surface: "member",
  opens: "notifications.feed",
};
const feedEntry = { id: "notifications.feed" };

test("the vocabulary is core's ten slots", () => {
  assert.equal(SHELL_SLOT_IDS.length, 10);
  assert.equal(SHELL_SLOT_IDS[0], "topbar.start");
});

test("a valid embed passes", () => {
  assert.doesNotThrow(() =>
    validateEmbeds(
      PKG,
      [{ ...bell, breakpoints: ["phone", "desktop"], props: { compact: true, size: 2, tone: "x" } }],
      SHELL_SLOT_IDS
    )
  );
  assert.doesNotThrow(() => validateEmbeds(PKG, undefined, SHELL_SLOT_IDS));
});

test("an unknown slot fails naming the pair, the index, the slot and the vocabulary", () => {
  assert.throws(
    () => validateEmbeds(PKG, [{ ...bell, slot: "header.right" }], SHELL_SLOT_IDS),
    (err) => {
      assert.match(err.message, /@stapel\/notifications-react/);
      assert.match(err.message, /embeds\[0\] slot "header\.right" is not a shell slot/);
      assert.match(err.message, new RegExp(SHELL_SLOT_IDS.join(", ").replaceAll(".", "\\.")));
      return true;
    }
  );
});

test("enum, shape and scalar violations fail", () => {
  const bad = [
    { ...bell, surface: "staff" },
    { ...bell, breakpoints: ["watch"] },
    { ...bell, breakpoints: [] },
    { ...bell, props: { nested: { a: 1 } } },
    { ...bell, order: Number.NaN },
    { ...bell, component: { export: "", subpath: "default" } },
    { ...bell, id: "Bell" },
    { ...bell, extra: 1 },
  ];
  for (const embed of bad) {
    assert.throws(() => validateEmbeds(PKG, [embed], SHELL_SLOT_IDS), /gen:nav: .*embeds\[0\]/);
  }
});

test("a duplicate id fails within a pair and across the aggregate", () => {
  assert.throws(
    () => validateEmbeds(PKG, [bell, { ...bell, order: 30 }], SHELL_SLOT_IDS),
    /embeds\[1\] id "notifications\.bell" is a duplicate/
  );
  assert.throws(
    () =>
      assertUniqueEmbedIds([
        { package: "@stapel/a-react", entries: [], embeds: [bell] },
        { package: "@stapel/b-react", entries: [], embeds: [bell] },
      ]),
    /"notifications\.bell" is declared by @stapel\/a-react and @stapel\/b-react/
  );
});

test("opens to an undeclared entry is an audit problem; a declared or container id is not", () => {
  const containers = new Set(["account.root"]);
  assert.deepEqual(
    auditEmbedOpens([{ package: PKG, entries: [feedEntry], embeds: [bell] }], containers),
    []
  );
  assert.deepEqual(
    auditEmbedOpens(
      [{ package: PKG, entries: [], embeds: [{ ...bell, opens: "account.root" }] }],
      containers
    ),
    []
  );
  const problems = auditEmbedOpens([{ package: PKG, entries: [], embeds: [bell] }], containers);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /embeds\[0\] "notifications\.bell": opens "notifications\.feed"/);
});

test("a pair without embeds emits no embeds key", () => {
  const pkg = { name: PKG, version: "1.0.0" };
  for (const embeds of [undefined, []]) {
    const manifest = buildPackageNavManifest(pkg, [feedEntry], embeds);
    assert.equal(Object.hasOwn(manifest, "embeds"), false);
    assert.deepEqual(Object.keys(manifest), ["package", "version", "entries"]);
  }
  assert.deepEqual(buildPackageNavManifest(pkg, [feedEntry], [bell]).embeds, [bell]);
});
