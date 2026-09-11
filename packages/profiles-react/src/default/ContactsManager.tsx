/**
 * `<ContactsManager/>` — the seller's own phone numbers, the whole screen.
 *
 * The owner's half of the contacts feature: add a number, prove it by SMS,
 * say who may be handed it, switch it off without deleting it, delete it, and
 * see how often it was handed over. One card, one row per number.
 *
 * ── THE OWNER'S OWN NUMBER IS MASKED AT REST ───────────────────────────────
 *
 * A row shows the last two digits and nothing else until the owner asks. This
 * is not privacy theatre against the person who typed the number in: a
 * contacts screen is long-lived (you open it to change a policy, not to read
 * your own number), it is opened on a phone in public, and the last two digits
 * are enough to tell two of your own numbers apart. "Show the number" is one
 * tap away, per row, and it reveals nothing over the wire — the number was
 * already in the answer, because this shape is only ever sent to its owner.
 *
 * ── THE PICKER IS BUILT FROM THE SERVER'S VOCABULARY ───────────────────────
 *
 * `GET /contacts` sends `policies` — the values THIS deployment accepts, in
 * picker order. The options are built from that list and labelled by i18n keys
 * looked up BY POLICY ID; a deployment that registers a policy this pair has
 * no word for shows the raw id rather than an invented one. Three hardcoded
 * options would offer a narrowed deployment's users choices its own API
 * refuses.
 *
 * ── AN UNVERIFIED NUMBER SAYS SO ───────────────────────────────────────────
 *
 * A number that has not been confirmed by SMS is revealed to nobody. That is
 * invisible from the row itself — the number is there, the switch is on, the
 * policy says "anybody with an account" — so the row states it, and the
 * verify flow stands right there in it. A seller whose phone silently reached
 * nobody is the defect this line exists to prevent.
 *
 * ── THE WRITES RENDER ONLY OUT OF A READ THAT LANDED ───────────────────────
 *
 * Through `LoadBoundary` on `bag.state` (@stapel/core `loadState.ts`): a list
 * drawn from a failed read is a screen of controls acting on state nobody
 * could read.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Button, Card, Flex, Form, Input, Select, Switch, Typography } from "antd";
import {
  ErrorAlert,
  LoadBoundary,
  SkinConfirm,
  SkinTheme,
  StatusTag,
} from "@stapel/tokens-antd/skin";
import type { SkinSurface } from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";
import { useT, useTPlural } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { maskPhoneNumber } from "../api/extensions.js";
import type { Contact } from "../api/types.js";
import { useContacts } from "../headless/Contacts.js";
import type { ContactsBag } from "../headless/Contacts.js";
import { PROFILES_I18N_KEYS } from "../i18n/keys.js";
import { toFlowError } from "../flows/errors.js";
import { sectionCardChrome } from "./parts.js";

/** The narrowest a row's policy picker may get before the row stacks. */
export const CONTACT_POLICY_MIN_WIDTH = "14rem";

/**
 * The words this pair has for the shipped policy ids. A deployment that
 * registers its own policy is not in this table, and its raw id is what the
 * picker shows — the honest bottom of the ladder, not an invented label.
 */
const POLICY_KEY: Readonly<Record<string, string>> = {
  members: PROFILES_I18N_KEYS.contactsPolicyMembers,
  verified: PROFILES_I18N_KEYS.contactsPolicyVerified,
  nobody: PROFILES_I18N_KEYS.contactsPolicyNobody,
};

/** How many tries the backend says are left after a wrong code. */
function attemptsRemaining(error: unknown): number | undefined {
  const value = toFlowError(error).params["attempts_remaining"];
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** The verify flow of ONE row: request → code → confirm. */
function VerifyFlow(props: {
  bag: ContactsBag;
  contact: Contact;
}): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  const [asking, setAsking] = useState(false);
  const [code, setCode] = useState("");
  const { bag, contact } = props;
  const requested =
    bag.requestCode.isSuccess && bag.requestCode.variables === contact.id;
  const expiresIn = requested ? bag.requestCode.data.expires_in : null;
  const left =
    bag.confirmCode.isError &&
    bag.confirmCode.variables?.contactId === contact.id
      ? attemptsRemaining(bag.confirmCode.error)
      : undefined;

  if (!asking) {
    return (
      <Button
        data-testid={`contact-verify-${contact.id}`}
        data-analytics="none"
        data-analytics-reason="business action (a plain POST, no flow machine) — pairs carry no @stapel/analytics runtime dependency; the host instruments at its own call site"
        onClick={() => {
          setAsking(true);
          bag.requestCode.mutate(contact.id);
        }}
        loading={bag.requestCode.isPending}
      >
        {t(PROFILES_I18N_KEYS.contactsVerify)}
      </Button>
    );
  }

  return (
    <Flex vertical gap={spacing[2]} data-testid={`contact-verify-flow-${contact.id}`}>
      {bag.requestCode.isPending ? (
        <Typography.Text type="secondary">
          {t(PROFILES_I18N_KEYS.contactsVerifySending)}
        </Typography.Text>
      ) : null}
      {requested ? (
        <Typography.Text type="secondary" data-testid="contact-code-sent">
          {t(PROFILES_I18N_KEYS.contactsVerifySent)}
        </Typography.Text>
      ) : null}
      {expiresIn !== null && expiresIn !== undefined ? (
        <Typography.Text type="secondary" data-testid="contact-code-expires">
          {t(PROFILES_I18N_KEYS.contactsVerifyExpires, { seconds: expiresIn })}
        </Typography.Text>
      ) : null}
      <ErrorAlert
        thrown={bag.requestCode.error ?? undefined}
        variant="inline"
        testId={`contact-code-request-error-${contact.id}`}
      />
      <Flex gap={spacing[2]} wrap align="center">
        <Input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder={t(PROFILES_I18N_KEYS.contactsCodePlaceholder)}
          aria-label={t(PROFILES_I18N_KEYS.contactsCodeField)}
          data-testid={`contact-code-input-${contact.id}`}
          inputMode="numeric"
        />
        <Button
          type="primary"
          loading={bag.confirmCode.isPending}
          data-testid={`contact-code-confirm-${contact.id}`}
          data-analytics="none"
          data-analytics-reason="business action (a plain POST, no flow machine) — pairs carry no @stapel/analytics runtime dependency; the host instruments at its own call site"
          onClick={() => {
            bag.confirmCode.mutate({ contactId: contact.id, code });
          }}
        >
          {t(
            bag.confirmCode.isPending
              ? PROFILES_I18N_KEYS.contactsCodeConfirming
              : PROFILES_I18N_KEYS.contactsCodeConfirm
          )}
        </Button>
        <Button
          data-testid={`contact-code-resend-${contact.id}`}
          data-analytics="none"
          data-analytics-reason="business action (a plain POST, no flow machine) — pairs carry no @stapel/analytics runtime dependency; the host instruments at its own call site"
          onClick={() => {
            bag.requestCode.mutate(contact.id);
          }}
        >
          {t(PROFILES_I18N_KEYS.contactsCodeResend)}
        </Button>
        <Button
          type="text"
          data-testid={`contact-code-cancel-${contact.id}`}
          data-analytics="none"
          data-analytics-reason="local ui state only — nothing leaves this component"
          onClick={() => {
            setAsking(false);
            setCode("");
          }}
        >
          {t(PROFILES_I18N_KEYS.contactsCodeCancel)}
        </Button>
      </Flex>
      {/* The code's own failures: a wrong code says how many tries are left,
          an expired one says to ask for another, a rate-limited resend says
          to wait. All three are the backend's sentences — the only thing this
          screen adds is the attempts line, because a person who is not told
          finds out by running out. */}
      <ErrorAlert
        thrown={bag.confirmCode.error ?? undefined}
        variant="inline"
        testId={`contact-code-error-${contact.id}`}
      />
      {left !== undefined ? (
        <Typography.Text type="warning" data-testid="contact-code-attempts">
          {tPlural(PROFILES_I18N_KEYS.contactsAttemptsLeft, { count: left })}
        </Typography.Text>
      ) : null}
    </Flex>
  );
}

/** One number: what it is, who may have it, and how often they did. */
function ContactRow(props: {
  bag: ContactsBag;
  contact: Contact;
  onDelete: (contact: Contact) => void;
}): ReactElement {
  const t = useT();
  const [shown, setShown] = useState(false);
  const { bag, contact } = props;
  const summary = bag.summaryFor(contact.id);
  const policyOptions = bag.policies.map((policy) => ({
    value: policy,
    label: policy in POLICY_KEY ? t(POLICY_KEY[policy] as string) : policy,
  }));

  return (
    <Flex vertical gap={spacing[2]} data-testid={`contact-row-${contact.id}`}>
      <Flex align="center" gap={spacing[2]} wrap>
        <Typography.Text strong data-testid={`contact-value-${contact.id}`}>
          {shown ? contact.value : maskPhoneNumber(contact.value)}
        </Typography.Text>
        <Button
          size="small"
          type="link"
          data-testid={`contact-show-${contact.id}`}
          data-analytics="none"
          data-analytics-reason="local ui state only — the number is already in this answer, nothing is asked for"
          onClick={() => setShown((was) => !was)}
        >
          {t(
            shown
              ? PROFILES_I18N_KEYS.contactsHideNumber
              : PROFILES_I18N_KEYS.contactsShowNumber
          )}
        </Button>
        {contact.label.length > 0 ? (
          <Typography.Text type="secondary">{contact.label}</Typography.Text>
        ) : null}
        <StatusTag
          status={contact.verified ? "success" : "warning"}
          testId={`contact-verified-${contact.id}`}
        >
          {t(
            contact.verified
              ? PROFILES_I18N_KEYS.contactsVerified
              : PROFILES_I18N_KEYS.contactsUnverified
          )}
        </StatusTag>
      </Flex>

      {contact.verified ? null : (
        <Flex vertical gap={spacing[2]}>
          <Typography.Text type="secondary">
            {t(PROFILES_I18N_KEYS.contactsUnverifiedHint)}
          </Typography.Text>
          <VerifyFlow bag={bag} contact={contact} />
        </Flex>
      )}

      <Flex gap={spacing[3]} wrap align="center">
        <div style={{ minWidth: CONTACT_POLICY_MIN_WIDTH }}>
          <Select
            value={contact.policy}
            options={policyOptions}
            aria-label={t(PROFILES_I18N_KEYS.contactsPolicyLabel)}
            data-testid={`contact-policy-${contact.id}`}
            style={{ width: "100%" }}
            onChange={(policy: string) => {
              bag.updateContact.mutate({
                contactId: contact.id,
                patch: { policy },
              });
            }}
          />
        </div>
        <Flex align="center" gap={spacing[2]}>
          <Switch
            checked={contact.enabled}
            aria-label={t(PROFILES_I18N_KEYS.contactsEnabledLabel)}
            data-testid={`contact-enabled-${contact.id}`}
            onChange={(enabled) => {
              bag.updateContact.mutate({
                contactId: contact.id,
                patch: { enabled },
              });
            }}
          />
          <Typography.Text type="secondary">
            {t(PROFILES_I18N_KEYS.contactsEnabledLabel)}
          </Typography.Text>
        </Flex>
        <Button
          danger
          data-testid={`contact-delete-${contact.id}`}
          data-analytics="none"
          data-analytics-reason="opens a confirmation; the write is tracked at the confirm"
          onClick={() => props.onDelete(contact)}
        >
          {t(PROFILES_I18N_KEYS.contactsDelete)}
        </Button>
      </Flex>

      {/* Counts, not people: the owner is entitled to know how often their
          number was handed out; who asked is the viewers' data. `undefined`
          renders nothing rather than a zero nobody measured. */}
      {summary === undefined ? null : (
        <Typography.Text type="secondary" data-testid={`contact-reveals-${contact.id}`}>
          {`${t(PROFILES_I18N_KEYS.contactsRevealsTotal, {
            count: summary.total,
          })} · ${t(PROFILES_I18N_KEYS.contactsReveals24h, {
            count: summary.last_24h,
          })} · ${t(PROFILES_I18N_KEYS.contactsReveals7d, {
            count: summary.last_7d,
          })}`}
        </Typography.Text>
      )}
    </Flex>
  );
}

/** Add a number. The value is echoed back by the backend's own validator. */
function AddContactForm(props: { bag: ContactsBag }): ReactElement {
  const t = useT();
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const { bag } = props;

  return (
    <Flex vertical gap={spacing[2]} data-testid="contact-add">
      <Flex gap={spacing[2]} wrap align="flex-start">
        <Form.Item
          label={t(PROFILES_I18N_KEYS.contactsNumberField)}
          style={{ marginBottom: 0 }}
        >
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={t(PROFILES_I18N_KEYS.contactsNumberPlaceholder)}
            aria-label={t(PROFILES_I18N_KEYS.contactsNumberField)}
            data-testid="contact-add-value"
            inputMode="tel"
          />
        </Form.Item>
        <Form.Item
          label={t(PROFILES_I18N_KEYS.contactsLabelField)}
          style={{ marginBottom: 0 }}
        >
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={t(PROFILES_I18N_KEYS.contactsLabelPlaceholder)}
            aria-label={t(PROFILES_I18N_KEYS.contactsLabelField)}
            data-testid="contact-add-label"
          />
        </Form.Item>
        <Button
          type="primary"
          loading={bag.addContact.isPending}
          data-testid="contact-add-submit"
          data-analytics="none"
          data-analytics-reason="business action (a plain POST, no flow machine) — pairs carry no @stapel/analytics runtime dependency; the host instruments at its own call site"
          onClick={() => {
            bag.addContact.mutate(
              { value, ...(label.length > 0 ? { label } : {}) },
              {
                onSuccess: () => {
                  setValue("");
                  setLabel("");
                },
              }
            );
          }}
        >
          {t(
            bag.addContact.isPending
              ? PROFILES_I18N_KEYS.contactsAdding
              : PROFILES_I18N_KEYS.contactsAdd
          )}
        </Button>
      </Flex>
      {/* The validator that matters is the backend's (`phonenumbers`), so its
          sentence is what the form echoes — "starting with +" for a number in
          national form, "you have already added this number" for a duplicate.
          A regex here would be a second, weaker opinion about the same value. */}
      <ErrorAlert
        thrown={bag.addContact.error ?? undefined}
        variant="inline"
        testId="contact-add-error"
      />
    </Flex>
  );
}

export interface ContactsManagerProps {
  /** Light or dark. Omitted, the skin follows the host's live theme. */
  readonly mode?: ThemeMode;
  /** What the theme root paints. Default `"bare"` — this section draws its
   * own `Card`; `"base"` when it is mounted as a whole page of its own. */
  readonly surface?: SkinSurface;
  /** Who owns the edge — see `sectionCardChrome`. */
  readonly gutter?: "own" | "shell";
}

export function ContactsManager(props: ContactsManagerProps = {}): ReactElement {
  const t = useT();
  const bag = useContacts();
  const [pendingDelete, setPendingDelete] = useState<Contact | null>(null);

  return (
    <SkinTheme
      surface={props.surface ?? "bare"}
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <Card data-testid="contacts-manager" {...sectionCardChrome(props.gutter)}>
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          {t(PROFILES_I18N_KEYS.contactsTitle)}
        </Typography.Title>
        <Typography.Text type="secondary">
          {t(PROFILES_I18N_KEYS.contactsSubtitle)}
        </Typography.Text>

        <div style={{ marginTop: spacing[4] }}>
          <LoadBoundary
            state={bag.state}
            onRetry={bag.refetch}
            skeletonRows={2}
            testId="contacts"
          >
            {(list) => (
              <Flex vertical gap={spacing[5]}>
                <ErrorAlert
                  thrown={bag.updateContact.error ?? bag.removeContact.error ?? undefined}
                  testId="contacts-write-error"
                />
                {list.contacts.length === 0 ? (
                  <Flex vertical gap={spacing[1]} data-testid="contacts-empty">
                    <Typography.Text strong>
                      {t(PROFILES_I18N_KEYS.contactsEmpty)}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      {t(PROFILES_I18N_KEYS.contactsEmptyHint)}
                    </Typography.Text>
                  </Flex>
                ) : (
                  list.contacts.map((contact) => (
                    <ContactRow
                      key={contact.id}
                      bag={bag}
                      contact={contact}
                      onDelete={setPendingDelete}
                    />
                  ))
                )}
                <AddContactForm bag={bag} />
              </Flex>
            )}
          </LoadBoundary>
        </div>

        <SkinConfirm
          open={pendingDelete !== null}
          danger
          confirming={bag.removeContact.isPending}
          title={t(PROFILES_I18N_KEYS.contactsDeleteConfirmTitle)}
          body={t(PROFILES_I18N_KEYS.contactsDeleteConfirmBody)}
          confirmLabel={t(PROFILES_I18N_KEYS.contactsDelete)}
          dismissLabel={t(PROFILES_I18N_KEYS.actionClose)}
          data-testid="contact-delete-confirm"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            const contact = pendingDelete;
            if (contact === null) return;
            bag.removeContact.mutate(contact.id, {
              onSettled: () => setPendingDelete(null),
            });
          }}
        />
      </Card>
    </SkinTheme>
  );
}
