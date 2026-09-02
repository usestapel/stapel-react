/**
 * `<ShareSheetPanel/>` — the share axis, drawn as a bottom sheet.
 *
 * ── What it is ────────────────────────────────────────────────────────────
 *
 * The skin half of `@stapel/docs-react`'s headless `<ShareSheet>`, exactly as
 * `<UploadTrayPanel/>` is the skin half of `<UploadTray>`. Every read and
 * every write is that pair's; nothing here re-implements the axis. Two
 * sections, because stapel-docs has two independent grant sources and a
 * deployment may enable either, both, or neither:
 *
 *  - LINKS — mint a bearer URL, copy it, see when it stops working and
 *    whether anybody has opened it yet, revoke it.
 *  - PEOPLE — grant the document to a user id or to a resolver-backed group
 *    reference, at a level, and take it back.
 *
 * ── The three properties this drawing is responsible for ──────────────────
 *
 *  1. A SUSPENDED ROW IS SHOWN, with a banner saying why. The kill switch is
 *     a display state, not a filter: an admin who cannot see an inert grant
 *     believes it was revoked, and re-enabling the mode then restores access
 *     nobody expected. So the rows stay, greyed and labelled "Paused".
 *  2. A SECTION THE CALLER MAY NOT ADMINISTER IS ABSENT, not dead. Both
 *     listings are themselves the capability gates, so a 403 means "you may
 *     not do this" — and a form whose every submit is refused is worse than
 *     no form.
 *  3. A REFUSED MINT SAYS WHICH REFUSAL IT WAS. The level cap
 *     (`SHARING.LINK.MAX_LEVEL`) is not published by any endpoint in 0.6.1
 *     and the document envelope does not carry it, so the sheet CANNOT know
 *     the ceiling before it asks. It offers both levels, and when the backend
 *     refuses it renders `error.400.docs_share_level` — the sentence that
 *     names the remedy — instead of "something went wrong". Inventing a
 *     client-side cap would be a second answer to an authorization question.
 *
 * ── What it deliberately is not ───────────────────────────────────────────
 *
 * There is no shared-link ROUTE here. The bearer page's URL shape and chrome
 * are host composition; `@stapel/docs-react`'s `<SharedDocumentView>` is the
 * seam it is built on. What this sheet needs from the host is the one
 * function that turns a token into the URL people paste — {@link
 * ShareSheetPanelProps.linkUrl}. Without it the sheet copies the raw token,
 * which is honest rather than a guessed origin and path.
 *
 * Replaceable without a fork:
 * `registerDriveSkinComponent("shareSheet", …)`.
 */
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Alert, Button, Flex, Input, List, Select, Tag, Typography } from "antd";
import {
  EmptyState,
  ErrorAlert,
  GatedButton,
  LoadBoundary,
  SkinConfirm,
  SkinDialog,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";
import { fontSize, spacing } from "@stapel/tokens-antd";
import { actionAvailable, actionBlocked, useI18n, useT } from "@stapel/core";
import { ShareSheet, formatDate } from "@stapel/docs-react";
import type {
  DocShareLevel,
  DocShareSubjectKind,
  DocumentAccessGrant,
  DocumentShareLink,
  ShareSheetBag,
} from "@stapel/docs-react";
import { DRIVE_I18N_KEYS } from "../i18n/keys.js";

export interface ShareSheetPanelProps {
  /** The document being shared; `null` closes the sheet. */
  readonly documentId: string | null;
  /** The document's name, for the sheet's title. */
  readonly title?: string;
  onClose(): void;
  /**
   * Turn a minted token into the URL a person pastes. The bearer route is the
   * HOST's (see the module note above), so the sheet asks for it instead of
   * assembling an origin and a path it cannot know. Omitted, Copy copies the
   * bare token.
   */
  readonly linkUrl?: (token: string) => string;
  /** Pin a theme side. Omitted, the document's live mode wins — this is a
   * dialog, which portals out of the tree. */
  readonly mode?: ThemeMode;
}

export function ShareSheetPanel(props: ShareSheetPanelProps): ReactElement {
  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <ShareSheetPanelBody {...props} />
    </SkinTheme>
  );
}

const STATUS_KEY: Readonly<Record<string, string>> = {
  active: DRIVE_I18N_KEYS.shareStatusActive,
  expired: DRIVE_I18N_KEYS.shareStatusExpired,
  revoked: DRIVE_I18N_KEYS.shareStatusRevoked,
};

/** The sheet body — a component so the hooks run at a component's top level. */
function ShareSheetPanelBody(props: ShareSheetPanelProps): ReactElement {
  const t = useT();
  const open = props.documentId !== null;
  return (
    <SkinDialog
      open={open}
      onClose={props.onClose}
      title={props.title ?? t(DRIVE_I18N_KEYS.shareTitle)}
      dismissLabel={t(DRIVE_I18N_KEYS.shareTitle)}
      data-testid="drive-share-sheet"
    >
      {/* The reads are mounted only while the sheet is open: one of the two
          listings carries live bearer tokens, and a closed sheet has no
          business holding them. */}
      <ShareSheet documentId={props.documentId ?? ""} enabled={open}>
        {(bag) => (
          <Flex vertical gap={spacing[4]} style={{ paddingBlock: spacing[2] }}>
            <LinksSection
              bag={bag}
              {...(props.linkUrl !== undefined ? { linkUrl: props.linkUrl } : {})}
            />
            <PeopleSection bag={bag} />
          </Flex>
        )}
      </ShareSheet>
    </SkinDialog>
  );
}

/** A section heading — one shape for both halves. */
function SectionTitle(props: { children: ReactNode }): ReactElement {
  return <Typography.Text strong>{props.children}</Typography.Text>;
}

/**
 * The banner a switched-off mode gets. It sits ABOVE the rows it explains and
 * the rows stay visible below it — see property (1) in the module note.
 */
function SuspendedBanner(props: { testId: string }): ReactElement {
  const t = useT();
  return (
    <Alert
      type="warning"
      showIcon
      title={t(DRIVE_I18N_KEYS.shareSuspendedBanner)}
      data-testid={props.testId}
    />
  );
}

/**
 * A refused share write, rendered by its OWN sentence.
 *
 * `ErrorAlert` folds the thrown value through core's error dialect, so
 * `error.400.docs_share_level` renders "That access level may not be granted
 * here" — the generated en floor covers all 84 codes of the registry — rather
 * than the generic failure sentence. That distinction is the whole point: the
 * four share 400s each name a different remedy.
 */
function RefusalNotice(props: {
  readonly thrown: unknown;
  readonly testId: string;
}): ReactElement | null {
  return <ErrorAlert thrown={props.thrown} variant="inline" testId={props.testId} />;
}

const LEVELS: readonly DocShareLevel[] = ["view", "edit"];

/** The level picker, shared by both halves. */
function LevelSelect(props: {
  readonly value: DocShareLevel;
  onChange(level: DocShareLevel): void;
  readonly testId: string;
}): ReactElement {
  const t = useT();
  return (
    <Select<DocShareLevel>
      value={props.value}
      onChange={props.onChange}
      aria-label={t(DRIVE_I18N_KEYS.shareLevel)}
      data-testid={props.testId}
      options={LEVELS.map((level) => ({
        value: level,
        label: t(
          level === "edit"
            ? DRIVE_I18N_KEYS.shareLevelEdit
            : DRIVE_I18N_KEYS.shareLevelView
        ),
      }))}
    />
  );
}

function LinksSection(props: {
  readonly bag: ShareSheetBag;
  readonly linkUrl?: (token: string) => string;
}): ReactElement | null {
  const t = useT();
  const { locale } = useI18n();
  const { bag } = props;
  const [level, setLevel] = useState<DocShareLevel>("view");
  const [copied, setCopied] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<DocumentShareLink | null>(null);

  // Property (2): absent, not dead.
  if (!bag.canMintLinks) {
    return (
      <Flex vertical gap={spacing[2]} data-testid="drive-share-links-unavailable">
        <SectionTitle>{t(DRIVE_I18N_KEYS.shareLinksSection)}</SectionTitle>
        <Typography.Text type="secondary">
          {t(DRIVE_I18N_KEYS.shareUnavailable)}
        </Typography.Text>
      </Flex>
    );
  }

  const copy = (link: DocumentShareLink): void => {
    const text = props.linkUrl?.(link.token) ?? link.token;
    // `navigator.clipboard` is absent on an insecure origin and in jsdom;
    // the row still shows the token, so a failed copy loses nothing.
    void globalThis.navigator?.clipboard?.writeText(text).catch(() => undefined);
    setCopied(link.id);
  };

  return (
    <Flex vertical gap={spacing[2]} data-testid="drive-share-links">
      <SectionTitle>{t(DRIVE_I18N_KEYS.shareLinksSection)}</SectionTitle>
      {bag.linksSuspended && <SuspendedBanner testId="drive-share-links-suspended" />}
      <Flex gap={spacing[2]} align="center">
        <LevelSelect
          value={level}
          onChange={setLevel}
          testId="drive-share-link-level"
        />
        <Button
          type="primary"
          loading={bag.isMinting}
          data-testid="drive-share-mint"
          data-analytics="none"
          data-analytics-reason="the host app wraps the drive surfaces with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
          onClick={() => {
            bag.mintLink(level);
          }}
        >
          {t(DRIVE_I18N_KEYS.shareMint)}
        </Button>
      </Flex>
      {/* Property (3): the refusal names itself. */}
      <RefusalNotice thrown={bag.mintError} testId="drive-share-mint-error" />
      <LoadBoundary state={bag.links} onRetry={bag.refetch} testId="drive-share-links">
        {(links) =>
          links.length === 0 ? (
            <EmptyState
              compact
              title={t(DRIVE_I18N_KEYS.shareLinksEmpty)}
              testId="drive-share-links-empty"
            />
          ) : (
            <List
              dataSource={[...links]}
              rowKey={(link: DocumentShareLink) => link.id}
              renderItem={(link: DocumentShareLink) => (
                <List.Item
                  key={link.id}
                  data-testid={`drive-share-link-${link.id}`}
                  data-drive-share-suspended={String(link.suspended === true)}
                >
                  <Flex vertical gap={spacing[1]} style={{ width: "100%" }}>
                    <Flex justify="space-between" align="center" gap={spacing[2]}>
                      <Typography.Text code ellipsis style={{ flex: 1 }}>
                        {props.linkUrl?.(link.token) ?? link.token}
                      </Typography.Text>
                      <Tag>{t(STATUS_KEY[link.status] ?? DRIVE_I18N_KEYS.shareStatusActive)}</Tag>
                      {link.suspended === true && (
                        <Tag data-testid={`drive-share-link-paused-${link.id}`}>
                          {t(DRIVE_I18N_KEYS.shareSuspended)}
                        </Tag>
                      )}
                    </Flex>
                    <Typography.Text
                      type="secondary"
                      style={{ fontSize: fontSize.xs.fontSize }}
                    >
                      {`${t(DRIVE_I18N_KEYS.shareExpires, {
                        date: formatDate(link.expires_at, locale),
                      })} · ${
                        link.first_redeemed_at === null ||
                        link.first_redeemed_at === undefined
                          ? t(DRIVE_I18N_KEYS.shareNeverOpened)
                          : t(DRIVE_I18N_KEYS.shareOpened, {
                              date: formatDate(link.first_redeemed_at, locale),
                            })
                      } · ${t(
                        link.level === "edit"
                          ? DRIVE_I18N_KEYS.shareLevelEdit
                          : DRIVE_I18N_KEYS.shareLevelView
                      )}`}
                    </Typography.Text>
                    <Flex gap={spacing[2]}>
                      <Button
                        size="small"
                        data-testid={`drive-share-copy-${link.id}`}
                        data-analytics="none"
                        data-analytics-reason="the host app wraps the drive surfaces with its own tracked()"
                        onClick={() => {
                          copy(link);
                        }}
                      >
                        {t(
                          copied === link.id
                            ? DRIVE_I18N_KEYS.shareCopied
                            : DRIVE_I18N_KEYS.shareCopy
                        )}
                      </Button>
                      <Button
                        size="small"
                        danger
                        data-testid={`drive-share-revoke-${link.id}`}
                        data-analytics="none"
                        data-analytics-reason="opens the destructive confirmation — the confirmed revoke carries the tracked action"
                        onClick={() => {
                          setRevoking(link);
                        }}
                      >
                        {t(DRIVE_I18N_KEYS.shareRevokeLink)}
                      </Button>
                    </Flex>
                  </Flex>
                </List.Item>
              )}
            />
          )
        }
      </LoadBoundary>
      <SkinConfirm
        open={revoking !== null}
        danger
        title={t(DRIVE_I18N_KEYS.shareRevokeLinkConfirm)}
        confirmLabel={t(DRIVE_I18N_KEYS.shareRevokeLink)}
        confirming={bag.isRevokingLink}
        onConfirm={() => {
          if (revoking !== null) bag.revokeLink(revoking.id);
          setRevoking(null);
        }}
        onCancel={() => {
          setRevoking(null);
        }}
        data-testid="drive-share-revoke-confirm"
      />
    </Flex>
  );
}

function PeopleSection(props: { readonly bag: ShareSheetBag }): ReactElement {
  const t = useT();
  const { bag } = props;
  const [kind, setKind] = useState<DocShareSubjectKind>("user");
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState<DocShareLevel>("view");

  if (!bag.canGrantAccess) {
    return (
      <Flex vertical gap={spacing[2]} data-testid="drive-share-people-unavailable">
        <SectionTitle>{t(DRIVE_I18N_KEYS.sharePeopleSection)}</SectionTitle>
        <Typography.Text type="secondary">
          {t(DRIVE_I18N_KEYS.shareUnavailable)}
        </Typography.Text>
      </Flex>
    );
  }

  const trimmed = subject.trim();
  const add = (): void => {
    if (trimmed.length === 0) return;
    bag.grant({
      subjectKind: kind,
      level,
      // The wire takes ONE of the two fields; which one is named by
      // `subject_kind`, never inferred — an ACL write that guesses its own
      // meaning is one typo away from granting to somebody nobody named.
      ...(kind === "user" ? { userId: trimmed } : { ref: trimmed }),
    });
    setSubject("");
  };

  return (
    <Flex vertical gap={spacing[2]} data-testid="drive-share-people">
      <SectionTitle>{t(DRIVE_I18N_KEYS.sharePeopleSection)}</SectionTitle>
      {bag.whitelistSuspended && (
        <SuspendedBanner testId="drive-share-people-suspended" />
      )}
      <Flex gap={spacing[2]} wrap="wrap" align="center">
        <Select<DocShareSubjectKind>
          value={kind}
          onChange={setKind}
          aria-label={t(DRIVE_I18N_KEYS.shareSubjectKind)}
          data-testid="drive-share-subject-kind"
          options={[
            { value: "user", label: t(DRIVE_I18N_KEYS.shareSubjectUser) },
            { value: "ref", label: t(DRIVE_I18N_KEYS.shareSubjectRef) },
          ]}
        />
        <Input
          value={subject}
          onChange={(event) => {
            setSubject(event.target.value);
          }}
          aria-label={t(DRIVE_I18N_KEYS.shareSubjectField)}
          placeholder={t(
            kind === "user"
              ? DRIVE_I18N_KEYS.shareSubjectPlaceholderUser
              : DRIVE_I18N_KEYS.shareSubjectPlaceholderRef
          )}
          data-testid="drive-share-subject"
          style={{ flex: 1 }}
        />
        <LevelSelect
          value={level}
          onChange={setLevel}
          testId="drive-share-grant-level"
        />
        {/* A GatedButton, not a boolean `disabled`: an empty field says WHY
            the button is off, in a sentence aria-describedby points at. */}
        <GatedButton
          type="primary"
          gate={
            trimmed.length > 0
              ? actionAvailable()
              : actionBlocked(DRIVE_I18N_KEYS.shareSubjectEmpty)
          }
          loading={bag.isGranting}
          data-testid="drive-share-add"
          data-analytics="none"
          data-analytics-reason="the host app wraps the drive surfaces with its own tracked()"
          onClick={add}
        >
          {t(DRIVE_I18N_KEYS.shareAdd)}
        </GatedButton>
      </Flex>
      <RefusalNotice thrown={bag.grantError} testId="drive-share-grant-error" />
      <LoadBoundary state={bag.grants} onRetry={bag.refetch} testId="drive-share-people">
        {(grants) =>
          grants.length === 0 ? (
            <EmptyState
              compact
              title={t(DRIVE_I18N_KEYS.sharePeopleEmpty)}
              testId="drive-share-people-empty"
            />
          ) : (
            <List
              dataSource={[...grants]}
              rowKey={(grant: DocumentAccessGrant) => grant.id}
              renderItem={(grant: DocumentAccessGrant) => (
                <List.Item
                  key={grant.id}
                  data-testid={`drive-share-grant-${grant.id}`}
                  data-drive-share-suspended={String(grant.suspended === true)}
                >
                  <Flex justify="space-between" align="center" gap={spacing[2]} style={{ width: "100%" }}>
                    <Flex vertical style={{ flex: 1, minWidth: 0 }}>
                      <Typography.Text ellipsis>{grant.subject}</Typography.Text>
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: fontSize.xs.fontSize }}
                      >
                        {t(
                          grant.level === "edit"
                            ? DRIVE_I18N_KEYS.shareLevelEdit
                            : DRIVE_I18N_KEYS.shareLevelView
                        )}
                      </Typography.Text>
                    </Flex>
                    {grant.suspended === true && (
                      <Tag data-testid={`drive-share-grant-paused-${grant.id}`}>
                        {t(DRIVE_I18N_KEYS.shareSuspended)}
                      </Tag>
                    )}
                    <Button
                      size="small"
                      danger
                      data-testid={`drive-share-remove-${grant.id}`}
                      data-analytics="none"
                      data-analytics-reason="the host app wraps the drive surfaces with its own tracked()"
                      onClick={() => {
                        bag.revokeGrant(grant.id);
                      }}
                    >
                      {t(DRIVE_I18N_KEYS.shareRemove)}
                    </Button>
                  </Flex>
                </List.Item>
              )}
            />
          )
        }
      </LoadBoundary>
    </Flex>
  );
}
