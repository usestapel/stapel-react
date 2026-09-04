/**
 * `<MyListingsPane>` — the seller's dashboard.
 *
 * Three counts and the rows behind them, both real since stapel-listings
 * 0.7.0 gave the owner's own listings a route (`GET my/listings/`). Until
 * then this pane showed the counts and NAMED the missing endpoint where the
 * rows should be; `model/mineSource.ts` keeps that history and the seam it
 * left behind.
 *
 * Three things this pane refuses to smooth over:
 *
 * 1. **Both axes on every row.** "Published" and "changes under review" appear
 *    beside each other, which is the entire reason `model/status.ts` exists: a
 *    dashboard that derived one from the other would tell a seller their live
 *    listing is offline, or never tell them their edit is being screened.
 *    `moderation_status` is on the owner card, so the row reads the real
 *    value rather than the `"approved"` stand-in it used before 0.7.0.
 * 2. **Takedowns are not in a tab.** The three tabs are the SERVER's status
 *    groupings and `blocked` is in none of them, because `my/counters` counts
 *    it in none of them. Folding it into one would make a tab's rows and its
 *    badge describe different sets; leaving it out entirely would hide the
 *    one listing whose owner most needs to know. So it sits above the tabs,
 *    where it cannot be missed.
 * 3. **An empty tab says which emptiness it is.** "No drafts" and "nothing
 *    sold yet" are different sentences and one generic "nothing here" is
 *    neither.
 *
 * ── The row, rebuilt for a 390px screen ────────────────────────────────────
 *
 * The visual pass measured the old one and it failed on a phone in four ways
 * at once: `Edit ¦ Mark sold ¦ Archive ¦ Delete` in antd's `List.Item`
 * `actions` slot overflowed the viewport and clipped "Delete"; the title and
 * the status shared one line with no `min-width: 0`, so the word "Draft" split
 * into "Draf/t"; the status itself was drawn three different ways down one
 * list; and every "why is this off" sentence lived in a `Tooltip`, which a
 * touch device cannot open and a disabled antd button never fires anyway.
 *
 * So: the row is a two-column flex (thumbnail, then a `min-width: 0` column
 * that owns the title, the status and the actions), the actions WRAP instead
 * of overflowing, each one is a shared `<GatedButton>` with its reason as
 * ordinary text beside it, and the status is one `<ListingStatusBlock>`.
 * Delete asks first, through the shared `<SkinConfirm>` — a bottom sheet on a
 * phone. It used to fire the mutation on the first click.
 */
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Flex, List, Tabs, Typography } from "antd";
import {
  ErrorAlert,
  EmptyState,
  GatedButton,
  PaneGate,
  SkinConfirm,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { actionAvailable, matchList, matchLoad, useT, useTPlural } from "@stapel/core";
import type { LinkComponent, SignInCtaProp } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import type { MyListingCard } from "../api/types.js";
import { useMyListings } from "../headless/MyListings.js";
import type { MyListingsSource } from "../model/mineSource.js";
import { useListingActions } from "../headless/ListingActions.js";
import { myListingTitle, neverSubmitted } from "../model/mine.js";
import { listingStatusView } from "../model/status.js";
import type { MyListingsTab } from "../model/status.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import { ListingPhoto } from "./ListingPhoto.js";
import { SignInLink } from "./SignInLink.js";
import { ListingStatusBlock } from "./StatusTags.js";
import type { ThemeModeProp } from "./types.js";

const TAB_LABEL: Readonly<Record<MyListingsTab, string>> = {
  active: LISTINGS_I18N_KEYS.mineTabActive,
  drafts: LISTINGS_I18N_KEYS.mineTabDrafts,
  archived: LISTINGS_I18N_KEYS.mineTabArchived,
};

/** One empty sentence per tab — see the header, point 3. */
const TAB_EMPTY: Readonly<Record<MyListingsTab, string>> = {
  active: LISTINGS_I18N_KEYS.mineEmptyActive,
  drafts: LISTINGS_I18N_KEYS.mineEmptyDrafts,
  archived: LISTINGS_I18N_KEYS.mineEmptyArchived,
};

/** The thumbnail column. A photo marketplace whose seller dashboard is a
 * column of text is missing the one thing that identifies a row at a glance;
 * a fixed measure because the column must not reflow per row. */
const THUMB_WIDTH = "4.5rem";

/** How wide a dashboard row may get. A 1280px window gave the four wrapped
 * action buttons ~560px of empty space to split across, stranding the reason
 * text between them. */
const MINE_MEASURE = "60rem";

/** The class a row's link to its own listing carries. */
const MINE_LINK_CLASS = "stapel-listings-mine-link";

/** The `href` the hoisted dashboard stylesheet is deduplicated by. */
const MINE_STYLE_HREF = "stapel-listings-mine";

/**
 * The two rules an inline style cannot state: the focus ring
 * (`:focus-visible`) and the fact that a row link is a HIT AREA rather than a
 * link's look.
 *
 * `color: inherit` / `text-decoration: none`: the title is already a title and
 * the thumbnail is already a picture — painting either link-blue would make a
 * dashboard read as a list of hyperlinks instead of a list of listings. The
 * ring is what keeps that honest for a keyboard: a target with no chrome must
 * still say when it has focus.
 */
function myListingsCss(): string {
  const link = `.${MINE_LINK_CLASS}`;
  return [
    `${link}{display:block;color:inherit;text-decoration:none;min-inline-size:0}`,
    `${link}:hover{text-decoration:underline}`,
    `${link}:focus-visible{outline:2px solid var(--stapel-focus-ring);` +
      `outline-offset:2px;border-radius:4px}`,
  ].join("");
}

/**
 * The row `listingHref` is called with as its second argument — the same
 * object the row renders from, with `title` guaranteed present.
 *
 * `MyListingCard.title` is the PUBLISHED field and is `""`/absent on a
 * listing nobody has ever submitted (`model/mine.ts`'s header) — but
 * {@link RowLink} never calls `href` for such a row (`neverSubmitted` bails
 * out first), so every row that reaches a `listingHref` call has a real
 * title. The cast below is that guarantee made structural rather than
 * re-checked at each call site.
 */
export type MyListingHrefRow = MyListingCard & { title: string };

/**
 * The row's title and thumbnail, as a link to the listing's own page when the
 * host has one.
 *
 * The gap this closes (D183): a live cabinet held ZERO `a[href^="/l/"]`. The
 * title was bold text and the thumbnail was an image, so a seller could see
 * their listing in the list and had no way at all to open it — the one
 * natural move after publishing ("did that come out right?") had to be made
 * by typing a URL. `<ListingCard>` has had this seam since it existed; the
 * dashboard simply never took it.
 *
 * A row NOBODY HAS EVER PUBLISHED gets no link, and that is not a
 * limitation. `title`/`price`/`images` are the PUBLISHED fields, so such a
 * row's page is a blank one — a link to nothing is worse than the absence of
 * a link, and Edit is the move that row actually wants. The predicate is the
 * server's own (`neverSubmitted`: DRAFT and NOT_SUBMITTED), not "is this row
 * showing its draft twin": the second answers `false` for a draft with no
 * title at all, and a row reading "#623 · Draft" was handed a link to a
 * page that does not exist.
 */
function RowLink(props: {
  listing: MyListingCard;
  href: ((id: number, row: MyListingHrefRow) => string) | undefined;
  linkComponent: LinkComponent | undefined;
  children: ReactNode;
  testId: string;
  label?: string | undefined;
}): ReactElement {
  const { href, listing } = props;
  if (href === undefined || neverSubmitted(listing)) return <>{props.children}</>;
  const target = href(listing.id, listing as MyListingHrefRow);
  const Link = props.linkComponent;
  const shared = {
    href: target,
    className: MINE_LINK_CLASS,
    "data-testid": props.testId,
    "data-analytics": "none",
    "data-analytics-reason":
      "navigation to the listing's own page — the host app wraps this with its own tracked()",
    ...(props.label !== undefined ? { "aria-label": props.label } : {}),
  };
  return Link !== undefined ? (
    <Link {...shared}>{props.children}</Link>
  ) : (
    <a {...shared}>{props.children}</a>
  );
}

function MyListingRow(props: {
  listing: MyListingCard;
  onEdit?: ((id: number) => void) | undefined;
  onAskRemove: (id: number) => void;
  listingHref?: ((id: number, row: MyListingHrefRow) => string) | undefined;
  linkComponent?: LinkComponent | undefined;
}): ReactElement {
  const t = useT();
  const actions = useListingActions(props.listing.id, props.listing.status, {
    // THE answer to "what can I do with this row", from the module that owns
    // the state machine. Absent (a row read before stapel-listings 0.20.0),
    // `ownerMoves` falls back to the mirror rather than to nothing.
    available: props.listing.available_transitions,
  });
  // Both axes, both real: `MyListingCardSerializer` puts `moderation_status`
  // on the owner's card, so the row no longer has to pass "approved" as a
  // stand-in and lose the one combination that matters — a LIVE listing whose
  // edit is under review.
  const status =
    props.listing.status === undefined
      ? undefined
      : listingStatusView(
          props.listing.status,
          props.listing.moderation_status ?? "approved"
        );
  const heading = myListingTitle(props.listing);
  const onEdit = props.onEdit;
  // A control that offers something meaningless in the current state is the
  // one shape §83 forbids: with no `onEdit` — which is exactly how the
  // scripted scaffold mounts this pane — the button used to be enabled,
  // clickable and inert. It is now switched off WITH the reason.
  //
  // "This app has no editing screen" is a fact about the BUILD, not about the
  // row, so with six rows it printed six identical refusals down one column.
  // A build-wide refusal is stated once, by the pane, and the button it
  // refuses is not drawn at all.
  const editGate = actions.editGate(true);
  const hasEditor = onEdit !== undefined;
  const cover = props.listing.images?.[0] ?? props.listing.images_draft?.[0];

  return (
    <List.Item
      data-testid="listings-mine-row"
      data-listing-id={props.listing.id}
      style={{ alignItems: "flex-start" }}
    >
      <style href={MINE_STYLE_HREF} precedence="default">
        {myListingsCss()}
      </style>
      <Flex gap={spacing[3]} style={{ width: "100%", minWidth: 0 }}>
        <div style={{ flex: `0 0 ${THUMB_WIDTH}`, width: THUMB_WIDTH }}>
          <RowLink
            listing={props.listing}
            href={props.listingHref}
            linkComponent={props.linkComponent}
            testId="listings-mine-thumb-link"
            label={heading ?? `#${String(props.listing.id)}`}
          >
            <ListingPhoto
              imageRef={cover}
              alt={heading ?? `#${String(props.listing.id)}`}
            />
          </RowLink>
        </div>

        {/* `min-width: 0` is what stops a long title from pushing the status
            out of the row and splitting a word across two lines. */}
        <Flex vertical gap={spacing[2]} style={{ flex: "1 1 auto", minWidth: 0 }}>
          <RowLink
            listing={props.listing}
            href={props.listingHref}
            linkComponent={props.linkComponent}
            testId="listings-mine-open"
          >
            <Typography.Text strong ellipsis data-testid="listings-mine-title">
              {heading ?? `#${String(props.listing.id)}`}
            </Typography.Text>
          </RowLink>

          {/* ONE status treatment. The word "Draft" beside the title was a
              second, redundant rendering of what this tag already says. */}
          {status !== undefined ? <ListingStatusBlock status={status} /> : null}

          {actions.error !== undefined && actions.error !== null ? (
            <ErrorAlert
              testId="listings-mine-action-error"
              thrown={actions.error}
              variant="inline"
            />
          ) : null}

          {/* Wrap, never overflow: the actions do not fit across 390px and a
              clipped "Delete" is a control that is not there.

              `layout="inline"` on every one of them, and it is worth a line
              (D168). A `<GatedControl>` defaults to `display: flex` — a
              BLOCK — so each button became a full-width row of its own and a
              published listing's action set stacked into a column: one
              cabinet row measured 331px of an 844px phone, five listings to a
              screen and a half. Inline makes them what they look like, a row
              of small buttons that wraps, and puts each refusal beside its
              control rather than under it. */}
          <Flex wrap gap={spacing[2]} align="flex-start">
            {hasEditor ? (
              <GatedButton
                gate={editGate}
                size="small"
                layout="inline"
                testId="listings-mine-edit"
                data-analytics="none"
                data-analytics-reason="business action — host app wraps with its own tracked()"
                onClick={() => {
                  onEdit?.(props.listing.id);
                }}
              >
                {t(LISTINGS_I18N_KEYS.mineEdit)}
              </GatedButton>
            ) : null}
            {/* The moves the SERVER says this row has, and only those.
                `available_transitions` is on the owner's card since
                stapel-listings 0.20.0, so the set drawn here and the set
                `POST {id}/transition/` accepts are one object.

                It used to be a fixed pair — "Mark sold" and "Archive" — on
                every row in every status, gated against a local copy of the
                table that answers "yes" to a same-status move. So an ARCHIVED
                row offered "Archive" and a SOLD row offered "Mark sold": two
                of its four controls enabled, clickable and inert. And the
                edges that would have UNDONE either of those — SOLD back to
                PUBLISHED, ARCHIVED back to DRAFT — were in the state machine
                the whole time with no button and no route, which is what made
                a misclick on "Mark sold" cost a seller the listing. */}
            {actions.moves.map((move) => (
              <GatedButton
                key={move.to}
                gate={move.gate}
                size="small"
                layout="inline"
                testId={move.testId}
                data-listing-move={move.to}
                data-analytics="none"
                data-analytics-reason="business action — host app wraps with its own tracked()"
                onClick={move.run}
              >
                {t(move.labelKey)}
              </GatedButton>
            ))}
            <GatedButton
              gate={actions.remove}
              size="small"
              // STACK, alone among the row's actions, and measured: this is
              // the one control that carries a STANDING sentence ("archive it
              // first — a listing on sale cannot be deleted"), and inline a
              // button plus sixty characters is one flex item too wide for a
              // 390px row, so it wrapped inside itself and took four lines.
              // Under the button the same sentence takes two.
              layout="stack"
              danger
              testId="listings-mine-delete"
              data-analytics="none"
              data-analytics-reason="opens the delete confirmation"
              onClick={() => {
                props.onAskRemove(props.listing.id);
              }}
            >
              {t(LISTINGS_I18N_KEYS.mineDelete)}
            </GatedButton>
          </Flex>
        </Flex>
      </Flex>
    </List.Item>
  );
}

export interface MyListingsPaneProps extends ThemeModeProp, SignInCtaProp {
  /** How the host gets the caller's own rows. Absent: the contract's own
   * `GET my/listings/`, which is what a storefront wants. */
  readonly source?: MyListingsSource;
  /**
   * Open the composer on one of these listings. ABSENT IS A REAL ANSWER: the
   * Edit button then states that this app has no editing screen instead of
   * offering a click that does nothing.
   */
  readonly onEdit?: (id: number) => void;
  /**
   * Where a listing's own page lives, given its id — `(id) => \`/l/${id}\``
   * for a storefront that only needs the id, or
   * `(id, row) => \`/l/${id}-${slugify(row.title)}\`` for one whose routes
   * carry a slug. The second argument is the same {@link MyListingCard} the
   * row renders from, narrowed to {@link MyListingHrefRow} (`title`
   * guaranteed present) — a host that ignores it keeps the id-only form
   * working exactly as before.
   *
   * Absent, the row's title and thumbnail are plain text and a picture, which
   * is what this pane shipped: a live cabinet held zero links to a listing,
   * so "publish it, then look at it" was a move a seller could only make by
   * typing a URL. Absent is still a real answer — a deployment whose listings
   * have no public page has nothing to link TO — but it is now a decision the
   * host makes rather than one this file made for everyone.
   */
  readonly listingHref?: (id: number, row: MyListingHrefRow) => string;
  /**
   * The router's link, so those two targets are client-side navigations. A
   * plain `<a href>` otherwise — right-clickable and correct, just a full page
   * load.
   */
  readonly linkComponent?: LinkComponent;
}

export function MyListingsPane(props: MyListingsPaneProps): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  const bag = useMyListings(
    props.source !== undefined ? { source: props.source } : {}
  );
  // ONE confirmation for the whole list, keyed by the row that asked — not one
  // mounted dialog per row.
  const [removingId, setRemovingId] = useState<number | null>(null);
  const removal = useListingActions(
    removingId ?? 0,
    bag.rows.status === "ready"
      ? bag.rows.data.find((row) => row.id === removingId)?.status
      : undefined
  );

  const paged = bag.prevPage.available || bag.nextPage.available;

  const renderRow = (row: MyListingCard): ReactElement => (
    <MyListingRow
      listing={row}
      onEdit={props.onEdit}
      onAskRemove={setRemovingId}
      listingHref={props.listingHref}
      linkComponent={props.linkComponent}
    />
  );

  return (
    <SkinTheme
      surface="base"
      style={{ padding: spacing[4], maxWidth: MINE_MEASURE }}
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <Flex vertical gap={spacing[4]} data-testid="listings-mine">
        <Typography.Title level={3}>
          {t(LISTINGS_I18N_KEYS.mineTitle)}
        </Typography.Title>


        {!bag.gate.available ? (
          // A refused pane is ONE state, not a banner above a live-looking
          // dashboard: the tabs still advertised "Active 2 · Drafts 3" to a
          // visitor who could not read a single row.
          <EmptyState
            testId="listings-mine-blocked"
            title={t(bag.gate.block.code, bag.gate.block.params)}
            action={
              <SignInLink cta={props.signIn} testId="listings-mine-sign-in" />
            }
          />
        ) : (
          <>
        {/* The rows no tab folds in — see the header, point 2. Rendered
            only when there are some: an empty takedown section is a scare,
            and a failure to CHECK is not the same as "none", so it says so. */}
        {matchList(bag.blockedRows, {
          loading: () => null,
          failed: () => (
            <Typography.Text
              type="secondary"
              data-testid="listings-mine-takedowns-failed"
            >
              {t(LISTINGS_I18N_KEYS.mineBlockedLoadFailed)}
            </Typography.Text>
          ),
          empty: () => null,
          ready: (rows) => (
            <Flex vertical gap={spacing[2]} data-testid="listings-mine-takedowns">
              <Typography.Text type="warning" strong>
                {tPlural(LISTINGS_I18N_KEYS.mineBlockedTitle, {
                  count: rows.length,
                })}
              </Typography.Text>
              <List
                dataSource={[...rows]}
                rowKey={(row) => row.id}
                renderItem={renderRow}
              />
            </Flex>
          ),
        })}

        <Tabs
          activeKey={bag.tab}
          data-testid="listings-mine-tabs"
          onChange={(key) => {
            bag.setTab(key as MyListingsTab);
          }}
          items={bag.tabs.map((tab) => ({
            key: tab,
            label: (
              <>
                {t(TAB_LABEL[tab])}
                {matchLoad(bag.counters, {
                  loading: () => null,
                  // A count we could not fetch is not zero. The number is
                  // simply absent and the failure is stated once, below.
                  failed: () => null,
                  // A plain secondary number, not a red antd Badge: red is the
                  // danger token and "Active 2" is not a warning. It also
                  // keeps the tab short enough that three of them fit on a
                  // phone instead of collapsing into an overflow menu.
                  ready: (counters) => (
                    <Typography.Text
                      type="secondary"
                      data-testid={`listings-mine-count-${tab}`}
                    >
                      {` ${String(counters[tab])}`}
                    </Typography.Text>
                  ),
                })}
              </>
            ),
          }))}
        />

        {matchLoad(bag.counters, {
          loading: () => null,
          // One failure, one treatment: the rows' failure is an ErrorAlert, so
          // the counters' is one too — inline, because it costs a number, not
          // the screen.
          failed: () => (
            <ErrorAlert
              variant="inline"
              testId="listings-mine-counters-failed"
              message={t(LISTINGS_I18N_KEYS.mineCountersFailed)}
            />
          ),
          ready: () => null,
        })}

        {/* A build-wide refusal, said once. It used to be printed beside a
            switched-off Edit button on every row. */}
        {props.onEdit === undefined ? (
          <Typography.Text type="secondary" data-testid="listings-mine-no-editor">
            {t(LISTINGS_I18N_KEYS.blockedNoEditor)}
          </Typography.Text>
        ) : null}

        {matchList(bag.rows, {
          loading: () => (
            <div
              role="status"
              aria-busy="true"
              aria-label={t(LISTINGS_I18N_KEYS.mineLoading)}
              data-testid="listings-mine-loading"
              data-stapel-load-state="loading"
            />
          ),
          failed: (error) => (
            <ErrorAlert
              testId="listings-mine-error"
              thrown={error}
              message={t(LISTINGS_I18N_KEYS.mineLoadFailed)}
              onRetry={bag.refetch}
              retryLabel={t(LISTINGS_I18N_KEYS.mineRetry)}
            />
          ),
          empty: () => (
            // The tab is stamped on the wrapper, not only spoken in the copy:
            // "no drafts" and "nothing sold yet" are different emptinesses and
            // a test has to be able to tell which one is on screen.
            <div data-testid="listings-mine-empty" data-empty-tab={bag.tab}>
              <EmptyState title={t(TAB_EMPTY[bag.tab])} />
            </div>
          ),
          ready: (rows) => (
            // ONE COPY OF EACH REFUSAL FOR THE WHOLE LIST.
            //
            // `<PaneGate>` pools what `<GatedControl>` would otherwise print
            // per control: a seller with six published listings read
            // "archive it first — a listing on sale cannot be deleted" six
            // times down one column, and on a 390px phone that paragraph is
            // 63px of every row. Each control keeps its
            // `aria-describedby` pointing at the pooled sentence, so a
            // screen reader still reads the reason WITH the control it
            // belongs to — the sentence moves, it does not disappear, which
            // is the difference between pooling and hiding.
            //
            // The gate itself is open: this pane's own refusal is `bag.gate`
            // and it is answered far above, as one state.
            <PaneGate
              gate={actionAvailable()}
              testId="listings-mine-reasons"
            >
              <List
                dataSource={[...rows]}
                rowKey={(row) => row.id}
                renderItem={renderRow}
              />
            </PaneGate>
          ),
        })}

        {/* A pager over a list with one page is two controls that mean
            nothing. It renders when there is somewhere to go, and not
            before. */}
        {paged ? (
          <Flex gap={spacing[2]} wrap>
            <GatedButton
              gate={bag.prevPage}
              size="small"
              layout="inline"
              testId="listings-mine-prev"
              data-analytics="none"
              data-analytics-reason="paging a list the person is already reading; not a business action"
              onClick={bag.goPrev}
            >
              {t(LISTINGS_I18N_KEYS.pagePrev)}
            </GatedButton>
            <GatedButton
              gate={bag.nextPage}
              size="small"
              layout="inline"
              testId="listings-mine-next"
              data-analytics="none"
              data-analytics-reason="paging a list the person is already reading; not a business action"
              onClick={bag.goNext}
            >
              {t(LISTINGS_I18N_KEYS.pageNext)}
            </GatedButton>
          </Flex>
        ) : null}

          </>
        )}

        <SkinConfirm
          open={removingId !== null}
          danger
          title={t(LISTINGS_I18N_KEYS.mineDeleteConfirmTitle)}
          body={t(LISTINGS_I18N_KEYS.mineDeleteConfirmBody)}
          confirmLabel={t(LISTINGS_I18N_KEYS.mineDelete)}
          confirming={removal.inFlight}
          data-testid="listings-mine-delete-confirm"
          onConfirm={() => {
            removal.doRemove();
            setRemovingId(null);
          }}
          onCancel={() => {
            setRemovingId(null);
          }}
        />
      </Flex>
    </SkinTheme>
  );
}
