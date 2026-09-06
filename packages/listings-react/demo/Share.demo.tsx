/**
 * Sending a listing to somebody — the verb the storefront did not have.
 *
 * The owner's finding on the live product (2026-09-06) was not a badly placed
 * control but the absence of one: a person who wanted to send an offer to
 * whoever they were buying it with had the address bar, on a phone, where the
 * address bar is the hardest thing on the screen to reach.
 *
 * The two variants are the two ARMS, and which one a person meets is the
 * device's answer rather than a prop: `navigator.share` exists on essentially
 * every phone and almost no desktop. `default` photographs the trigger as it
 * stands in the corner of a photograph; `menu` photographs what the desktop
 * arm actually hands a host — the three ready-made links off the headless
 * bag, which is also what a container drawing its own menu imports instead of
 * antd.
 *
 * `native` settles in an EFFECT (`useShare` argues why: a server render has no
 * `navigator`, and a first client render that disagreed with it is a hydration
 * mismatch on every listing page), so a demo renders the menu arm — the arm a
 * showcase can photograph at all.
 */
import type { CSSProperties, ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar, radii, spacing } from "@stapel/tokens";
import { ShareAction } from "../src/default/index.js";
import { Share } from "../src/index.js";
import { ListingsDemoHarness } from "./_harness.js";

/** A path, not an absolute URL — what every route seam in this fleet speaks,
 * and what `resolveShareUrl` turns into a link somebody can receive. */
const LISTING_URL = "/l/7-bosch-gsb-13-re";
const LISTING_TITLE = "Bosch GSB 13 RE";

/** The trailing-top corner of a media well: the one corner of a card gallery
 * that is free, and where the cluster pins the glyph. */
const wellStyle: CSSProperties = {
  position: "relative",
  width: 320,
  height: 180,
  borderRadius: radii.lg,
  background: cssVar("surface-sunken"),
};

const cornerStyle: CSSProperties = {
  position: "absolute",
  insetInlineEnd: spacing["2"],
  insetBlockStart: spacing["2"],
};

const linksStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacing["2"],
  margin: 0,
  padding: spacing["4"],
  listStyle: "none",
  borderRadius: radii.lg,
  background: cssVar("surface-raised"),
  color: cssVar("text"),
  border: `1px solid ${cssVar("border")}`,
};

function Corner(): ReactElement {
  return (
    <ListingsDemoHarness>
      <div style={wellStyle}>
        <div style={cornerStyle}>
          <ShareAction
            url={LISTING_URL}
            title={LISTING_TITLE}
            shape="circle"
            testId="demo-share-circle"
          />
        </div>
      </div>
    </ListingsDemoHarness>
  );
}

function Links(): ReactElement {
  return (
    <ListingsDemoHarness>
      {/* The renderless arm: the channel identifiers and the absolute hrefs
          the skin draws its menu from. Only DATA is rendered here — the copy
          belongs to the skin, which is the whole point of the split. */}
      <Share url={LISTING_URL} title={LISTING_TITLE}>
        {(bag) => (
          <ul style={linksStyle} data-testid="demo-share-links">
            <li>
              <code data-testid="demo-share-url">{bag.url}</code>
            </li>
            {bag.links.map((link) => (
              <li key={link.channel}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`demo-share-${link.channel}`}
                >
                  {link.channel}
                </a>
              </li>
            ))}
          </ul>
        )}
      </Share>
    </ListingsDemoHarness>
  );
}

export default defineDemo({
  id: "listings.share",
  title: "Share a listing",
  description:
    "One control, two arms, and the device decides: the platform's own sheet where `navigator.share` exists, and a small menu (copy the link, Telegram, WhatsApp, VK) where it does not. The address shared is the route the CONTAINER built — handed in as `url` and used verbatim — never `window.location`, because the address bar on a SERP carries the query, the page and whatever tracking parameters the visitor arrived with, and none of that belongs in a link somebody sends to a friend.",
  component: ShareAction,
  covers: ["Share"],
  tokens: ["surface-sunken", "surface-raised"],
  variants: {
    default: {
      viewport: "phone",
      step: "trigger_on_photo",
      description:
        "The glyph pinned to the trailing-top corner of a photograph: `shape=\"circle\"` because there is no room for a word there and the heart beside it is a circle. It publishes `data-share-mode`, so a walker on a live phone can tell a native sheet — which opens outside the page and leaves no DOM behind — from a menu that failed to open.",
      render: () => <Corner />,
    },
    menu: {
      viewport: "desktop",
      step: "menu_channels",
      description:
        "What the desktop arm is made of, taken straight off the headless bag: the resolved absolute address and the three networks' ready-made hrefs. Every field is `encodeURIComponent`-ed — a seller's title contains `&` in the wild, and a title pasted raw into a query string silently truncates the URL the recipient receives.",
      render: () => <Links />,
    },
  },
});
