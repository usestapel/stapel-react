// stapel/no-bare-dialog — the default skins' dialog surface is a fleet rule.
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
// what stops the twelfth dialog from being written the old way: inside a
// package's `src/default` tree, `Modal` and `Drawer` are not importable from
// antd.
//
// SCOPE, and why it is narrow. This fires only on the DEFAULT SKINS. A host
// app's own dialogs are the host's business; a pair's headless layer renders
// no chrome at all; and a `Drawer` used as NAVIGATION (the shell's hamburger
// menu) is not a dialog and is exempted by name via `allowNavigationDrawer`.
// A rule that fired everywhere would be switched off everywhere, and then it
// would guard nothing.
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
const DIALOG_COMPONENTS = new Set(["Modal", "Drawer"]);
const CONFIRM_COMPONENTS = ["Popconfirm"];

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow bare antd Modal/Drawer in default skins; render dialogs through @stapel/tokens-antd/skin's SkinDialog, which is a bottom sheet on phones.",
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
        },
        additionalProperties: false,
      },
    ],
    messages: {
      bareDialog:
        'Bare antd `{{name}}` in a default skin. A dialog is a bottom sheet on a phone and a modal on tablet/desktop — one rule, one implementation: import { SkinDialog } from "@stapel/tokens-antd/skin" and render <SkinDialog open onClose title dismissLabel>. Hand-rolling `isPhone ? <Drawer> : <Modal>` is how the fleet ended up with three different sheets and eight desktop modals on phones. A Drawer that is NAVIGATION (a shell menu), not a dialog, belongs in this rule\'s `allowNavigationDrawer` option.',
      bareConfirm:
        'Bare antd `{{name}}` in a default skin. A confirmation is a DIALOG, not an anchored popover: on a 390px phone the popover renders half off-screen or on top of the row being confirmed, and two of these already sit inside a bottom sheet (a desktop popover floating over a sheet). Import { SkinConfirm } from "@stapel/tokens-antd/skin" and render <SkinConfirm open title body confirmLabel cancelLabel danger onConfirm onCancel> — same surface as SkinDialog, so it is a sheet on a phone for free. The destructive verb needs its own i18n key; do not reuse the trigger button\'s label.',
    },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();
    // Only the default skins. Normalized so the check reads the same on Windows.
    const path = filename.replace(/\\/g, "/");
    if (!/\/src\/default\//.test(path)) return {};

    const options = context.options[0] ?? {};
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
