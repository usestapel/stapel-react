import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import tsParser from "@typescript-eslint/parser";
import plugin, { recommended } from "../index.js";
import pkg from "../package.json" with { type: "json" };

// Preset-level tests. Every other suite in this directory drives a rule in
// isolation through RuleTester — which is precisely why the 0.7.0 hole was
// invisible: the RULES were correct and fully tested, and the defect lived in
// the `recommended` preset's file-scoped overrides, where nothing looked. A
// rule that is right and switched off guards nothing, so the preset's own
// wiring gets asserted here.
//
// Note what this file does NOT need: a disable for no-cyrillic-source. Its
// Cyrillic fixtures all live inside string literals, which that rule never
// scans by design — the same property that lets a real i18n catalog coexist
// with the canon. Only the homoglyph fixtures need a suppression, and they
// get a two-line scoped one at the single place they appear.

// The virtual files below are never written to disk — `lintText` only needs a
// path to resolve the preset's file-scoped overrides against. It does insist
// the path sit under the working directory, though (otherwise every result is
// a single "File ignored because outside of base path" warning and every
// assertion silently passes for the wrong reason), so paths are built under
// the package root.
const PKG_ROOT = fileURLToPath(new URL("..", import.meta.url));
const virtual = (relativePath) => `${PKG_ROOT}__virtual__/${relativePath}`;

/** Lint `code` as if it were the file at `relativePath`, under the real preset. */
async function lintAs(relativePath, code) {
  const eslint = new ESLint({
    cwd: PKG_ROOT,
    overrideConfigFile: true,
    overrideConfig: [
      { files: ["**/*.{ts,tsx,js,jsx}"], languageOptions: { parser: tsParser } },
      ...recommended,
    ],
  });
  const [result] = await eslint.lintText(code, { filePath: virtual(relativePath) });
  const ruleIds = result.messages.map((m) => m.ruleId);
  // Guard against the silent-pass mode described above: a lone null ruleId
  // means ESLint declined to lint the text at all.
  if (ruleIds.length === 1 && ruleIds[0] === null) {
    throw new Error(`ESLint did not lint ${relativePath}: ${result.messages[0].message}`);
  }
  return ruleIds;
}

// The regression this release exists for. A consumer's test file is where the
// canon leaks hardest (meettoday's sweep reported 5603 -> 0 and still had 15
// live hits in one `.test.ts`), and it is also where a blanket glob is most
// tempting. Every path shape the old TEST_FILES glob covered must now be
// covered BY the rules instead.
const TEST_FILE_PATHS = [
  "src/lib/workday.test.ts",
  "src/lib/workday.spec.ts",
  "test/helpers.ts",
  "tests/helpers.ts",
  "src/__tests__/thing.ts",
  "src/__mocks__/thing.ts",
  "src/fixtures/thing.ts",
  "src/thing.fixture.ts",
];

describe("recommended preset — English-only source canon", () => {
  it.each(TEST_FILE_PATHS)("no-cyrillic-source fires on a comment in %s", async (path) => {
    const ruleIds = await lintAs(path, "// Русский комментарий\nexport const x = 1;\n");
    expect(ruleIds).toContain("stapel/no-cyrillic-source");
  });

  it.each(TEST_FILE_PATHS)("no-cyrillic-source fires on an identifier in %s", async (path) => {
    const ruleIds = await lintAs(path, "export const имяПоля = 1;\n");
    expect(ruleIds).toContain("stapel/no-cyrillic-source");
  });

  /* eslint-disable stapel/no-mixed-script-word -- the homoglyph literal below IS the fixture under test; scoped to these lines only, the rest of this file stays covered. */
  it.each(TEST_FILE_PATHS)("no-mixed-script-word fires on a literal in %s", async (path) => {
    const ruleIds = await lintAs(path, 'export const s = "miттudei";\n');
    expect(ruleIds).toContain("stapel/no-mixed-script-word");
  });

  it("both rules are on in ordinary product source too", async () => {
    const ruleIds = await lintAs("src/model/session.ts", 'export const имяПоля = "miттudei";\n');
    expect(ruleIds).toContain("stapel/no-cyrillic-source");
    expect(ruleIds).toContain("stapel/no-mixed-script-word");
  });
  /* eslint-enable stapel/no-mixed-script-word */

  it("neither rule is switched off anywhere in the preset", () => {
    // A structural guard against the exact regression: any future override
    // block that sets one of these to "off" fails here, whatever glob it
    // hides behind. Legitimate exceptions belong in the one file that needs
    // them, as a scoped `eslint-disable ... -- reason`.
    const offenders = [];
    for (const block of recommended) {
      if (!block.rules) continue;
      for (const [ruleId, level] of Object.entries(block.rules)) {
        const isScriptCanon =
          ruleId === "stapel/no-cyrillic-source" || ruleId === "stapel/no-mixed-script-word";
        if (isScriptCanon && (level === "off" || level === 0)) {
          offenders.push({ files: block.files, ruleId });
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("pure-Cyrillic i18n copy in a string literal still passes (the legitimate case)", async () => {
    // The other direction: the canon bans Cyrillic in comments and
    // identifiers, NOT Russian UI copy in a catalog value. Removing the
    // test-file carve-out must not have turned this into a violation —
    // otherwise consumers would be pushed straight back to silencing it.
    const ruleIds = await lintAs(
      "src/i18n/ru.test.ts",
      'export const s = t("auth.otp.enter_code", "Введите код");\n'
    );
    expect(ruleIds).not.toContain("stapel/no-cyrillic-source");
    expect(ruleIds).not.toContain("stapel/no-mixed-script-word");
  });
});

describe("plugin metadata", () => {
  it("meta.version matches package.json", () => {
    // It had silently drifted two releases (`meta.version` said 0.6.0 while
    // the package was 0.7.0). ESLint reports this value, so a stale one
    // misidentifies which build of a rule is running — exactly the question
    // being asked when someone bothers to look.
    expect(plugin.meta.version).toBe(pkg.version);
  });
});

describe("recommended preset — the fixture-shaped carve-outs are still intact", () => {
  // Guard the other half of the ruling: removing the script-canon exemption
  // must not disturb the carve-outs that ARE legitimate — the ones where
  // producing the forbidden shape is the test's actual job.
  // A raw colour only counts inside a styled surface (a `css`/`styled` tagged
  // template, a className, a style prop) — a bare string constant is not one,
  // so the fixture has to be a real styled surface for the pair to mean
  // anything.
  const STYLED_RAW_COLOR = "const s = css`color: #ff0000;`;\n";

  it("no-raw-colors stays off in a test file", async () => {
    const ruleIds = await lintAs("src/theme.test.ts", STYLED_RAW_COLOR);
    expect(ruleIds).not.toContain("stapel/no-raw-colors");
  });

  it("no-raw-colors stays on in product source", async () => {
    const ruleIds = await lintAs("src/Button.ts", STYLED_RAW_COLOR);
    expect(ruleIds).toContain("stapel/no-raw-colors");
  });

  it("require-disable-description stays on in test files", async () => {
    const ruleIds = await lintAs(
      "src/thing.test.ts",
      "// eslint-disable-next-line no-console\nconsole.log(1);\n"
    );
    expect(ruleIds).toContain("stapel/require-disable-description");
  });
});

// ── The doctrine tier (0.11.0): two presets, two different sentences ─────────
//
// The rules themselves are covered by their own suites. What is covered HERE
// is the wiring, because the wiring is where the 0.7.0 hole lived: a rule that
// is right and switched off guards nothing, and a rule that is right and set
// to `error` on a fleet that has not migrated yet gets the whole preset pinned
// to the previous version.
import { strict } from "../index.js";

/** Lint `code` at `relativePath` under an arbitrary preset. */
async function lintUnder(preset, relativePath, code) {
  const eslint = new ESLint({
    cwd: PKG_ROOT,
    overrideConfigFile: true,
    overrideConfig: [
      { files: ["**/*.{ts,tsx,js,jsx}"], languageOptions: { parser: tsParser } },
      ...preset,
    ],
  });
  const [result] = await eslint.lintText(code, { filePath: virtual(relativePath) });
  return result.messages;
}

const DOCTRINE_TIER = [
  "stapel/no-tooltip-in-skin",
  "stapel/icon-button-needs-label",
  "stapel/no-hardcoded-theme-mode",
  "stapel/no-local-skin-theme",
  "stapel/no-raw-dimensions",
  "stapel/i18n-locale-parity",
  "stapel/no-adhoc-socket",
  "stapel/no-silent-slot",
  "stapel/no-boolean-disabled",
];

// One violating sample per rule, at a path where that rule is in scope.
const SAMPLES = [
  ["stapel/no-tooltip-in-skin", "src/default/Card.tsx", 'import { Tooltip } from "antd";\n'],
  [
    "stapel/icon-button-needs-label",
    "src/default/Card.tsx",
    "export const A = () => <Button icon={<DeleteOutlined/>}/>;\n",
  ],
  [
    "stapel/no-hardcoded-theme-mode",
    "src/default/Panel.tsx",
    'export const f = (props) => { const { mode = "light" } = props; return mode; };\n',
  ],
  [
    "stapel/no-local-skin-theme",
    "src/default/theme.tsx",
    'import { ConfigProvider } from "antd";\nexport const x = ConfigProvider;\n',
  ],
  [
    "stapel/no-raw-dimensions",
    "src/default/Panel.tsx",
    "export const A = () => <div style={{ padding: 15 }}/>;\n",
  ],
  ["stapel/no-adhoc-socket", "src/model/live.ts", "export const s = new WebSocket(u);\n"],
  [
    "stapel/no-silent-slot",
    "src/default/Shell.tsx",
    "export const A = (props) => <div>{props.searchSlot}</div>;\n",
  ],
  [
    "stapel/no-boolean-disabled",
    "src/default/Panel.tsx",
    "export const A = () => <Button disabled={!x}/>;\n",
  ],
];

describe("recommended preset — the doctrine tier is a WORKLIST, not a wall", () => {
  it.each(SAMPLES)("%s warns (never errors) in recommended", async (ruleId, path, code) => {
    const messages = await lintUnder(recommended, path, code);
    const mine = messages.filter((m) => m.ruleId === ruleId);
    expect(mine.length).toBeGreaterThan(0);
    // severity 1 = warn. `eslint .` stays green, `pnpm turbo run lint` prints
    // the migration list — which is the whole point of shipping them this way.
    expect(mine.every((m) => m.severity === 1)).toBe(true);
  });

  it("no-bare-dialog stays at ERROR for Modal/Drawer", async () => {
    const messages = await lintUnder(
      recommended,
      "src/default/Panel.tsx",
      'import { Modal } from "antd";\nexport const x = Modal;\n'
    );
    const mine = messages.filter((m) => m.ruleId === "stapel/no-bare-dialog");
    expect(mine).toHaveLength(1);
    expect(mine[0].severity).toBe(2);
  });

  it("…and the confirm surface is NOT on in recommended this release", async () => {
    // The wave-B switch. When the nine Popconfirm sites are on SkinConfirm,
    // `confirmComponents: []` comes out of the preset and this expectation
    // flips to the one in the `strict` block below.
    const messages = await lintUnder(
      recommended,
      "src/default/Panel.tsx",
      'import { Popconfirm } from "antd";\nexport const x = Popconfirm;\n'
    );
    expect(messages.filter((m) => m.ruleId === "stapel/no-bare-dialog")).toHaveLength(0);
  });
});

describe("strict preset — the same rules, at error", () => {
  it.each(SAMPLES)("%s errors in strict", async (ruleId, path, code) => {
    const messages = await lintUnder(strict, path, code);
    const mine = messages.filter((m) => m.ruleId === ruleId);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((m) => m.severity === 2)).toBe(true);
  });

  it("covers the confirm surface", async () => {
    const messages = await lintUnder(
      strict,
      "src/default/Panel.tsx",
      'import { Popconfirm } from "antd";\nexport const x = Popconfirm;\n'
    );
    const mine = messages.filter((m) => m.ruleId === "stapel/no-bare-dialog");
    expect(mine).toHaveLength(1);
    expect(mine[0].severity).toBe(2);
  });

  it("keeps every carve-out `recommended` has", () => {
    // Built by APPENDING to recommended, so the two presets cannot disagree
    // about where a rule is off. Structural, not sampled.
    expect(strict.slice(0, recommended.length)).toEqual(recommended);
  });

  it("still exempts fixtures — a socket test constructs a socket", async () => {
    for (const preset of [recommended, strict]) {
      const messages = await lintUnder(
        preset,
        "src/realtime/socket.test.ts",
        "export const s = new WebSocket(u);\n"
      );
      expect(messages.filter((m) => m.ruleId === "stapel/no-adhoc-socket")).toHaveLength(0);
    }
  });
});

describe("plugin registry", () => {
  it("every doctrine rule is registered and documented", () => {
    for (const ruleId of DOCTRINE_TIER) {
      const name = ruleId.slice("stapel/".length);
      expect(plugin.rules[name], `${name} is not registered`).toBeDefined();
      expect(plugin.rules[name].meta.docs.description).toBeTruthy();
    }
  });

  it("no-raw-dimensions is the fixable one", () => {
    expect(plugin.rules["no-raw-dimensions"].meta.fixable).toBe("code");
  });
});
