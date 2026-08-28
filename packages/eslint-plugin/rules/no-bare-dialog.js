// stapel/no-bare-dialog — the dialog surface is a fleet rule.
//
// Owner ruling (2026-08-24): on a phone a modal is a bottom sheet; modals are
// tablet/desktop only. That is a design-system decision, and a design-system
// decision that is re-taken in every component is not a decision — it is a
// coin flip that eight of eleven `Modal` sites lost. Three of the sites that
// won had each hand-written the same `isPhone ? <Drawer> : <Modal>` branch, so
// the fleet also had three subtly different sheets.
//
// The rule is stated once, in `@stapel/tokens-antd/skin`'s `<SkinDialog>` —
// the only package every antd default skin already depends on. This rule is
// what stops the twelfth dialog from being written the old way: `Modal` and
// `Drawer` are not importable from antd.
//
// ── SCOPE (`scope`, widened in 0.12.0) ──────────────────────────────────────
//
// Until 0.12.0 this rule returned an empty visitor for any file outside a
// package's `src/default/**` tree. The reasoning of the day is worth keeping,
// because it is half right: a `Drawer` used as NAVIGATION (the shell's
// hamburger menu) is not a dialog, a pair's headless layer renders no chrome
// at all, and "a rule that fires everywhere gets switched off everywhere, and
// then it guards nothing". What it got wrong was the conclusion — "a host
// app's own dialogs are the host's business" — because a phone gets a desktop
// modal from a product repo's dialog exactly as it does from a skin's, and
// THAT is where a team's own dialogs are actually written. The path check made
// the doctrine enforceable only where it was already satisfied: a bare
// `<Modal>` in an application's `src/` linted clean, and a clean lint reads as
// coverage.
//
// So the scope is an OPTION with a default that fires:
//
//   `scope: "all"` (default) — every file, minus the exemptions below. What a
//     product repo needs, and what makes `eslint .` in one mean something.
//   `scope: "default-skin"` — the pre-0.12.0 behaviour, `src/default/**` only.
//     For a consumer that wants the wall on the skins and nothing outside it.
//
// The severity, not the scope, is what keeps this adoptable: `recommended`
// arms it fleet-wide at WARN and keeps `src/default/**` at ERROR; `strict`
// makes the whole surface an error. A worklist is not a wall, and neither is
// silence.
//
// EXEMPTIONS, which are now stated rather than implied by a directory shape:
//   - `allowNavigationDrawer` — basenames whose `Drawer` is navigation.
//   - test / fixture paths — a dialog fixture's job is to BE the forbidden
//     shape. Carved out in the rule itself, not only in the preset, so a
//     consumer who never spreads the preset still gets the right answer.
//   - the SUBSTRATE that implements `SkinDialog`/`SkinConfirm` — somebody has
//     to import antd's `Modal` and `Drawer`, and that somebody is
//     `@stapel/tokens-antd/skin`. Carved out by path in the preset, the same
//     way `no-raw-fetch` is carved out in the api layer.
//
// ── THE CONFIRM SURFACE (added 0.11.0) ──────────────────────────────────────
//
// `Popconfirm` is the same defect wearing a smaller hat. It is an ANCHORED
// POPOVER: it positions itself next to the trigger, sizes itself to desktop
// prose, and puts two buttons in a box that a 390px phone renders half
// off-screen or on top of the very row being confirmed. Nine sites across five
// pairs shipped it (auth-react security ×4, forms-react, workspaces-react ×2,
// docs-react ×2) — and two of those sit INSIDE a bottom sheet, so the phone
// gets a desktop popover floating over a sheet.
//
// Same fix, same shape: `<SkinConfirm>` in `@stapel/tokens-antd/skin` — a
// `SkinDialog` with a title, a body, and two buttons, which is a sheet on a
// phone for free. It is reported under its own messageId (`bareConfirm`)
// because the migration is not the same migration: a Popconfirm carries
// `okText`/`cancelText`/`onConfirm` and needs i18n keys for the destructive
// verb, whereas a Modal is already a dialog and only changes component.
// Callers that need the confirm surface OFF during a migration wave pass
// `confirmComponents: []` (that is what `recommended` does this release; the
// `strict` config runs the full set).
// ── WHY THERE IS NO `stapel/dialog-needs-theme` ─────────────────────────────
//
// The next defect in this family was a dialog painted on antd's default LIGHT
// algorithm over a dark app (calendar, docs, chat). A dialog PORTALS to
// `<body>`, so it is themed by the `ConfigProvider` above the element — which
// stands next to the trigger — and not by the `SkinTheme` wrapping the screen.
// The wave's first reading was to ask for a rule here: fail a `SkinDialog`
// with no `SkinTheme` ancestor in the file.
//
// It was fixed in the SUBSTRATE instead (tokens-antd 0.7.0): `SkinDialog` now
// renders its own `SkinTheme surface="bare"` around the antd component and
// inside the portal, resolving the mode from the nearest enclosing skin and
// falling back to the document's live one. A lint rule would have been the
// weaker half of that fix twice over — it can only ask every future pair to
// write the wrapper by hand, and the case that actually shipped is a
// `SkinTheme` that IS in the file but does not ENCLOSE the dialog element,
// which no ancestor-in-file heuristic can see. A rule earns its place when the
// substrate cannot state the rule for itself; this one now can.
import { isDefaultSkin, isTestPath, normalizedFilename } from "../lib/jsx.js";

const DIALOG_COMPONENTS = new Set(["Modal", "Drawer"]);
const CONFIRM_COMPONENTS = ["Popconfirm"];

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow bare antd Modal/Drawer/Popconfirm; render dialogs through @stapel/tokens-antd/skin's SkinDialog, which is a bottom sheet on phones. Scoped with the `scope` option (default: every file).",
    },
    schema: [
      {
        type: "object",
        properties: {
          /** Extra component names that are dialogs in this codebase. */
          components: { type: "array", items: { type: "string" } },
          /**
           * Component names that are the CONFIRM surface (default
           * `["Popconfirm"]`). Set to `[]` to run the dialog half only —
           * what `recommended` does while the pairs migrate to SkinConfirm.
           */
          confirmComponents: { type: "array", items: { type: "string" } },
          /** File basenames whose Drawer is navigation, not a dialog. */
          allowNavigationDrawer: { type: "array", items: { type: "string" } },
          /**
           * Which files the rule reads. `"all"` (default) is every file —
           * a product repo's dialogs included, which is where a team's own
           * dialogs are written. `"default-skin"` restricts it to
           * `src/default/**`, the pre-0.12.0 behaviour.
           */
          scope: { enum: ["all", "default-skin"] },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      bareDialog:
        'Bare antd `{{name}}`. A dialog is a bottom sheet on a phone and a modal on tablet/desktop — one rule, one implementation: import { SkinDialog } from "@stapel/tokens-antd/skin" and render <SkinDialog open onClose title dismissLabel>. Hand-rolling `isPhone ? <Drawer> : <Modal>` is how the fleet ended up with three different sheets and eight desktop modals on phones. A Drawer that is NAVIGATION (a shell menu), not a dialog, belongs in this rule\'s `allowNavigationDrawer` option.',
      bareConfirm:
        'Bare antd `{{name}}`. A confirmation is a DIALOG, not an anchored popover: on a 390px phone the popover renders half off-screen or on top of the row being confirmed, and two of these already sit inside a bottom sheet (a desktop popover floating over a sheet). Import { SkinConfirm } from "@stapel/tokens-antd/skin" and render <SkinConfirm open title body confirmLabel cancelLabel danger onConfirm onCancel> — same surface as SkinDialog, so it is a sheet on a phone for free. The destructive verb needs its own i18n key; do not reuse the trigger button\'s label.',
    },
  },
  create(context) {
    const path = normalizedFilename(context);
    const options = context.options[0] ?? {};
    // The dialog surface is a doctrine, not a directory: a phone gets a
    // desktop modal from a product repo exactly as it does from a skin.
    if ((options.scope ?? "all") === "default-skin" && !isDefaultSkin(path)) return {};
    // A dialog fixture's job is to BE the forbidden shape.
    if (isTestPath(path)) return {};

    const allowed = new Set(options.allowNavigationDrawer ?? []);
    const base = path.slice(path.lastIndexOf("/") + 1);
    if (allowed.has(base)) return {};

    const names = new Set([...DIALOG_COMPONENTS, ...(options.components ?? [])]);
    const confirmNames = new Set(options.confirmComponents ?? CONFIRM_COMPONENTS);

    return {
      ImportDeclaration(node) {
        if (node.source.value !== "antd") return;
        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier") continue;
          const imported = specifier.imported;
          const name = imported.type === "Identifier" ? imported.name : imported.value;
          const messageId = names.has(name)
            ? "bareDialog"
            : confirmNames.has(name)
              ? "bareConfirm"
              : null;
          if (messageId) {
            context.report({ node: specifier, messageId, data: { name } });
          }
        }
      },
    };
  },
};
