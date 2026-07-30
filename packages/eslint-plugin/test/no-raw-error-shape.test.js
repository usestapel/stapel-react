import { describe } from "vitest";
import rule from "../rules/no-raw-error-shape.js";
import { tsxTester } from "./helpers.js";

const IMPORT = `import { StapelApiError, isStapelApiError, hasErrorCode, toStapelApiError } from "@stapel/core";\n`;

describe("no-raw-error-shape", () => {
  tsxTester().run("stapel/no-raw-error-shape", rule, {
    valid: [
      // instanceof — the guard the product got right (ironmemo auth-context).
      `${IMPORT}try { await load(); } catch (e) { if (e instanceof StapelApiError && e.status === 404) setEmpty(); }`,
      // The imported typeguard.
      `${IMPORT}try { await load(); } catch (e) { if (isStapelApiError(e)) { report(e.code); } }`,
      // Early-exit narrowing.
      `${IMPORT}function h(): void { try { go(); } catch (e) { if (!isStapelApiError(e)) throw e; console.log(e.status); } }`,
      // Ternary + &&.
      `${IMPORT}try { go(); } catch (e) { const s = isStapelApiError(e) ? e.status : 0; }`,
      `${IMPORT}try { go(); } catch (e) { if (isStapelApiError(e) && e.status === 404) empty(); }`,
      // An imported, named state predicate — the product shape, now legal.
      `import { isMeetingIntelligenceAbsent } from "@/api/recordings-ext";\ntry { go(); } catch (e) { if (isMeetingIntelligenceAbsent(e)) setEmpty(); }`,
      // Folding at the call site is fine — no shape is read.
      `${IMPORT}try { go(); } catch (e) { setError(toStapelApiError(e)); }`,
      // `.catch()` handler, narrowed.
      `${IMPORT}load().catch((e) => { if (isStapelApiError(e)) toast(e.code); });`,
      // Non-error `.status` reads are none of this rule's business.
      `const r = await fetch(url); if (r.status === 204) return;`,
      `if (state.status === "authenticated") render();`,
      // A cast to a real type on a value that is not catch-bound.
      `const options = raw as { limit?: number };`,
      // A caught value used without touching its shape.
      `try { go(); } catch (e) { console.error(e); throw e; }`,
    ],
    invalid: [
      // ── The original defect, verbatim (the product component). ──────────
      {
        code: `try { await load(); } catch (e) { if ((e as { status?: number })?.status === 404) { setEmpty(); } }`,
        errors: [{ messageId: "castCaught" }],
      },
      // ── Infected site #1: @stapel/core query.ts:70 (not catch-bound). ───
      {
        code: `const retry = (failureCount: number, error: unknown) => { const status = (error as { status?: number }).status; return status === undefined; };`,
        errors: [{ messageId: "castErrorShape" }],
      },
      // ── Infected site #2: profiles-react AvatarUpload.ts:80. ────────────
      {
        code: `${IMPORT}try { await api.uploadAvatar(file); } catch (e) { setError(e as StapelApiError); }`,
        errors: [{ messageId: "castCaught" }],
      },
      // Bare envelope-field reads on an un-narrowed caught value.
      {
        code: `try { go(); } catch (e) { if (e.status === 404) empty(); }`,
        errors: [{ messageId: "rawErrorProp" }],
      },
      {
        code: `try { go(); } catch (e) { report(e.localizable_error); }`,
        errors: [{ messageId: "rawErrorProp" }],
      },
      {
        code: `load().catch((e) => { if (e.status >= 500) retry(); });`,
        errors: [{ messageId: "rawErrorProp" }],
      },
      // A LOCAL predicate is not the layer — it is the same invented shape
      // one call away.
      {
        code: `function looks404(x: unknown) { return true; }\ntry { go(); } catch (e) { if (looks404(e)) { drop(e.status); } }`,
        errors: [{ messageId: "rawErrorProp" }],
      },
      // Negated guard must not read as narrowing.
      {
        code: `${IMPORT}try { go(); } catch (e) { if (!isStapelApiError(e)) { log(e.code); } }`,
        errors: [{ messageId: "rawErrorProp" }],
      },
      // The envelope shape, cast anywhere.
      {
        code: `const key = (payload as { localizable_error?: string }).localizable_error;`,
        errors: [{ messageId: "castErrorShape" }],
      },
      // (The angle-bracket form `<{status?: number}>err` is handled too —
      // `TSTypeAssertion` — but it cannot be exercised here: this tester
      // enables JSX, where that syntax is illegal.)
    ],
  });
});
