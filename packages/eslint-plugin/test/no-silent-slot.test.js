import rule from "../rules/no-silent-slot.js";
import { tsxTester } from "./helpers.js";

const tester = tsxTester();

const SKIN = "/repo/packages/shell-react/src/default/PublicShell.tsx";
const HEADLESS = "/repo/packages/shell-react/src/headless/resolveNav.tsx";

tester.run("no-silent-slot", rule, {
  valid: [
    // The sanctioned shape: the hole is loud where it can be fixed.
    {
      filename: SKIN,
      code: 'const A = () => <div>{props.searchSlot ?? <SlotPlaceholder name="searchSlot"/>}</div>;',
    },
    // The explicit opt-out — empty IS correct here, and it is written down.
    { filename: SKIN, code: "const A = () => <div>{props.searchSlot ?? null}</div>;" },
    // A ternary is the decision, spelled the other way.
    {
      filename: SKIN,
      code: "const A = () => <div>{props.searchSlot ? props.searchSlot : <Empty/>}</div>;",
    },
    // The real reviews-react line: a render prop with a translated fallback.
    {
      filename: SKIN,
      code: "const A = () => <div>{props.renderAuthor?.(review) ?? t(K.authorFallback)}</div>;",
    },
    // Ordinary children are not slots — including a LOCAL helper whose name
    // happens to start with `render` (categories-react/CategoryCarouselStrip
    // renders its label through one).
    { filename: SKIN, code: "const A = () => <span>{renderCategoryLabel(entry.label, t)}</span>;" },
    { filename: SKIN, code: "const A = () => <div>{props.children}</div>;" },
    { filename: SKIN, code: "const A = () => <div>{items.map(render)}</div>;" },
    // An ATTRIBUTE position is the consumer's business, not this rule's.
    { filename: SKIN, code: "const A = () => <Card title={props.titleSlot}/>;" },
    // A guard ABOVE the JSX is the decision, written earlier — the absent
    // case has a real fallback, it is just not handled inline
    // (attributes-react/FeatureFields.tsx:135).
    {
      filename: SKIN,
      code:
        "const A = (props) => {\n" +
        "  if (props.renderRow) return <div>{props.renderRow(row)}</div>;\n" +
        "  return <FeatureRow {...row}/>;\n" +
        "};",
    },
    // Out of scope: the headless layer renders no chrome.
    { filename: HEADLESS, code: "const A = () => <div>{props.searchSlot}</div>;" },
  ],
  invalid: [
    {
      // PublicShell.tsx:174 — a storefront that forgets this ships a header
      // with a gap where search goes, and everyone assumes there is no search.
      filename: SKIN,
      code: "const A = () => <div>{props.searchSlot}</div>;",
      errors: [{ messageId: "silentSlot" }],
    },
    {
      // Destructured, same hole.
      filename: SKIN,
      code: "const A = () => <div>{categorySlot}</div>;",
      errors: [{ messageId: "silentSlot" }],
    },
    {
      // categories-react/CategoryPage.tsx:112 — a category page with no
      // listings in it, rendered as a blank column.
      filename: SKIN,
      code: "const A = () => <div>{props.renderListings?.(category)}</div>;",
      errors: [{ messageId: "silentSlot" }],
    },
    {
      // A destructured render prop, called the way an optional prop is called.
      filename: SKIN,
      code: "const A = () => <div>{renderLoginPanel?.(args)}</div>;",
      errors: [{ messageId: "silentSlot" }],
    },
    {
      // Inside a fragment is still a child position.
      filename: SKIN,
      code: "const A = () => <>{props.gallerySlot}</>;",
      errors: [{ messageId: "silentSlot" }],
    },
    {
      filename: SKIN,
      code: "const A = () => <div>{props.searchSlot}{props.categorySlot}</div>;",
      errors: [{ messageId: "silentSlot" }, { messageId: "silentSlot" }],
    },
  ],
});
