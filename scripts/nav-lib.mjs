// Validators for the `embeds[]` half of the nav contract (`@stapel/core`'s
// `NavEmbed`, docs/composition-and-slots.md §3). Pure functions, no I/O, so
// `gen-nav-manifest.mjs` runs them and `gen-nav-manifest.test.mjs` proves
// them. The slot vocabulary is passed in by the caller, read from
// `packages/core/src/nav.ts`'s `SHELL_SLOT_IDS` — never a second list here.

export const EMBED_ID_PATTERN = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;
export const EMBED_SURFACES = ["public", "member", "any"];
export const EMBED_BREAKPOINTS = ["phone", "tablet", "desktop"];
const EMBED_KEYS = new Set([
  "id",
  "slot",
  "component",
  "order",
  "surface",
  "breakpoints",
  "props",
  "opens",
  "scope",
  "routeProps",
]);
/** The one slot a PAGE renders, not a chrome: it needs a `scope`, and only
 * it may have one. */
export const PAGE_SLOT_IDS = ["page.actions"];
const PROP_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const COMPONENT_KEYS = new Set(["export", "subpath"]);

const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const nonEmpty = (v) => typeof v === "string" && v.length > 0;

/** Throw unless `embed` matches the `NavEmbed` schema. */
export function validateEmbed(pkgName, embed, index, slotIds) {
  const where = `${pkgName}'s src/nav/manifest.ts embeds[${index}]`;
  const need = (cond, msg) => {
    if (!cond) throw new Error(`gen:nav: ${where} ${msg}`);
  };
  need(isObject(embed), "must be an object");
  for (const key of Object.keys(embed)) {
    need(EMBED_KEYS.has(key), `has unknown field "${key}"; allowed: ${[...EMBED_KEYS].join(", ")}`);
  }
  need(
    typeof embed.id === "string" && EMBED_ID_PATTERN.test(embed.id),
    `id ${JSON.stringify(embed.id)} must match ${EMBED_ID_PATTERN.source} ("<module>.<thing>")`
  );
  need(
    slotIds.includes(embed.slot),
    `slot ${JSON.stringify(embed.slot)} is not a shell slot; one of ${slotIds.join(", ")}`
  );
  need(
    isObject(embed.component) &&
      Object.keys(embed.component).every((k) => COMPONENT_KEYS.has(k)) &&
      nonEmpty(embed.component.export) &&
      nonEmpty(embed.component.subpath),
    "component needs exactly export and subpath (non-empty strings)"
  );
  need(
    typeof embed.order === "number" && Number.isFinite(embed.order),
    "order must be a finite number"
  );
  need(
    embed.surface === undefined || EMBED_SURFACES.includes(embed.surface),
    `surface ${JSON.stringify(embed.surface)} must be one of ${EMBED_SURFACES.join(", ")} when present`
  );
  if (embed.breakpoints !== undefined) {
    need(
      Array.isArray(embed.breakpoints) && embed.breakpoints.length > 0,
      `breakpoints must be a non-empty array of ${EMBED_BREAKPOINTS.join(", ")} when present (omit it for every width)`
    );
    embed.breakpoints.forEach((b, j) => {
      need(
        EMBED_BREAKPOINTS.includes(b),
        `breakpoints[${j}] ${JSON.stringify(b)} must be one of ${EMBED_BREAKPOINTS.join(", ")}`
      );
    });
    need(
      new Set(embed.breakpoints).size === embed.breakpoints.length,
      "breakpoints must not repeat a rung"
    );
  }
  if (embed.props !== undefined) {
    need(isObject(embed.props), "props must be an object of scalar values when present");
    for (const [key, value] of Object.entries(embed.props)) {
      need(
        typeof value === "string" ||
          typeof value === "boolean" ||
          (typeof value === "number" && Number.isFinite(value)),
        `props.${key} must be a string, a finite number or a boolean`
      );
    }
  }
  need(
    embed.opens === undefined || nonEmpty(embed.opens),
    "opens must be a non-empty NavEntry id when present"
  );
  const pageSlot = PAGE_SLOT_IDS.includes(embed.slot);
  if (embed.scope === undefined) {
    need(
      !pageSlot,
      `slot "${embed.slot}" is rendered by a page, not a chrome — add scope: { navEntry: "<entry id>" } naming that page`
    );
  } else {
    need(
      pageSlot,
      `scope is only meaningful on a page slot (${PAGE_SLOT_IDS.join(", ")}); "${embed.slot}" renders on every page`
    );
    need(
      isObject(embed.scope) &&
        Object.keys(embed.scope).every((k) => k === "navEntry") &&
        nonEmpty(embed.scope.navEntry),
      'scope must be exactly { navEntry: "<entry id>" }'
    );
  }
  if (embed.routeProps !== undefined) {
    need(embed.scope !== undefined, "routeProps needs a scope: route params come from the scoped page");
    need(
      isObject(embed.routeProps) && Object.keys(embed.routeProps).length > 0,
      "routeProps must be a non-empty object of { <prop>: <route param> } when present"
    );
    for (const [prop, param] of Object.entries(embed.routeProps)) {
      need(PROP_NAME_PATTERN.test(prop), `routeProps key ${JSON.stringify(prop)} must be a prop name`);
      need(nonEmpty(param), `routeProps.${prop} must name a route param`);
      need(
        embed.props === undefined || !Object.hasOwn(embed.props, prop),
        `routeProps.${prop} collides with props.${prop} — one source per prop`
      );
    }
  }
}

/** Throw unless `embeds` is undefined or an array of valid, pair-unique
 * embeds. */
export function validateEmbeds(pkgName, embeds, slotIds) {
  if (embeds === undefined) return;
  if (!Array.isArray(embeds)) {
    throw new Error(`gen:nav: ${pkgName}'s src/nav/manifest.ts must export navEmbeds as an array`);
  }
  const seen = new Set();
  embeds.forEach((embed, i) => {
    validateEmbed(pkgName, embed, i, slotIds);
    if (seen.has(embed.id)) {
      throw new Error(
        `gen:nav: ${pkgName}'s src/nav/manifest.ts embeds[${i}] id "${embed.id}" is a duplicate within the pair`
      );
    }
    seen.add(embed.id);
  });
}

/** The `PackageNavManifest` a pair serializes. `embeds` is present only when
 * the pair declares at least one, so a pair without any stays byte-identical
 * to a manifest written before the field existed. */
export function buildPackageNavManifest(pkg, entries, embeds) {
  return {
    package: pkg.name,
    version: pkg.version,
    entries,
    ...(Array.isArray(embeds) && embeds.length > 0 ? { embeds } : {}),
  };
}

/** Throw when two installed packages declare the same embed id. */
export function assertUniqueEmbedIds(manifests) {
  const owner = new Map();
  for (const m of manifests) {
    for (const embed of m.embeds ?? []) {
      const prior = owner.get(embed.id);
      if (prior !== undefined) {
        throw new Error(
          `gen:nav: embed id "${embed.id}" is declared by ${prior} and ${m.package} — ids must be globally unique`
        );
      }
      owner.set(embed.id, m.package);
    }
  }
}

/** Problem lines for every `opens` that names an entry no installed package
 * declares and the container does not synthesise — the `parentId` rule. */
export function auditEmbedOpens(manifests, containerParentIds) {
  const declared = new Set();
  for (const m of manifests) for (const e of m.entries) declared.add(e.id);
  const problems = [];
  for (const m of manifests) {
    (m.embeds ?? []).forEach((embed, i) => {
      if (embed.opens === undefined) return;
      if (declared.has(embed.opens) || containerParentIds.has(embed.opens)) return;
      problems.push(
        `    - ${m.package} embeds[${i}] "${embed.id}": opens "${embed.opens}" is declared by no ` +
          `installed package and is not a container-synthesised id — onOpen would have nowhere to go`
      );
    });
  }
  return problems;
}

/** The `:param` names of a route path (`/l/:id` → `["id"]`). */
export function routeParams(path) {
  return [...String(path).matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]);
}

/** Problem lines for every page-slot embed whose `scope.navEntry` no
 * installed package declares, or whose `routeProps` read a param that
 * entry's path does not have. */
export function auditEmbedScopes(manifests) {
  const entries = new Map();
  for (const m of manifests) for (const e of m.entries) entries.set(e.id, e);
  const problems = [];
  for (const m of manifests) {
    (m.embeds ?? []).forEach((embed, i) => {
      if (embed.scope === undefined) return;
      const where = `    - ${m.package} embeds[${i}] "${embed.id}"`;
      const entry = entries.get(embed.scope.navEntry);
      if (entry === undefined) {
        problems.push(
          `${where}: scope.navEntry "${embed.scope.navEntry}" is declared by no installed package — ` +
            `no page would render it`
        );
        return;
      }
      const params = routeParams(entry.route?.path ?? "");
      for (const [prop, param] of Object.entries(embed.routeProps ?? {})) {
        if (params.includes(param)) continue;
        problems.push(
          `${where}: routeProps.${prop} reads ":${param}", which ${embed.scope.navEntry} ` +
            `("${entry.route?.path}") does not have — params: ${params.join(", ") || "none"}`
        );
      }
    });
  }
  return problems;
}

/**
 * A pair that writes `nav-manifest.json` must SHIP it: listed in `files` (or
 * npm leaves it out of the tarball) and exported as `./nav-manifest.json` (or
 * a consumer's resolver refuses the subpath). The scaffold and an intake read
 * a pair's entries and embeds from there; a manifest that exists only in this
 * repo is a contract nobody installing the pair can read.
 */
export function assertShipsNavManifest(pkg) {
  const problems = [];
  if (!(pkg.files ?? []).includes("nav-manifest.json")) {
    problems.push('"files" does not list "nav-manifest.json"');
  }
  if (!Object.hasOwn(pkg.exports ?? {}, "./nav-manifest.json")) {
    problems.push('"exports" has no "./nav-manifest.json"');
  }
  if (problems.length > 0) {
    throw new Error(
      `gen:nav: ${pkg.name} writes nav-manifest.json but does not publish it: ` +
        `${problems.join("; ")} — add both to its package.json`
    );
  }
}
