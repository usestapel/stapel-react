import { describe } from "vitest";
import rule from "../rules/query-keys-from-factory.js";
import { tsxTester } from "./helpers.js";

describe("query-keys-from-factory", () => {
  tsxTester().run("stapel/query-keys-from-factory", rule, {
    valid: [
      // The one right way: key from the factory (call or member reference).
      `useQuery({ queryKey: authQueryKeys.sessions(), queryFn: fn });`,
      `useQuery({ queryKey: authQueryKeys.audit(page), queryFn: fn });`,
      `queryClient.removeQueries({ queryKey: authQueryKeys.all });`,
      `queryClient.invalidateQueries({ queryKey: authQueryKeys.sessions() });`,
      `queryClient.setQueryData(authQueryKeys.me(), user);`,
      // A `useMutation` without a key is fine.
      `useMutation({ mutationFn: fn });`,
      // An inline array that is NOT a query key (a plain call) is untouched.
      `doThing({ items: ["a", "b"] });`,
      `const xs = ["auth", "sessions"];`,
    ],
    invalid: [
      // Inline queryKey array in a hook.
      {
        code: `useQuery({ queryKey: ["auth", "sessions"], queryFn: fn });`,
        errors: [{ messageId: "inlineKey" }],
      },
      // Inline mutationKey array.
      {
        code: `useMutation({ mutationKey: ["auth", "logout"], mutationFn: fn });`,
        errors: [{ messageId: "inlineKey" }],
      },
      // Inline array on a queryClient filters object.
      {
        code: `queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] });`,
        errors: [{ messageId: "inlineKey" }],
      },
      // Positional inline array on setQueryData.
      {
        code: `queryClient.setQueryData(["auth", "me"], user);`,
        errors: [{ messageId: "inlineKey" }],
      },
    ],
  });
});
