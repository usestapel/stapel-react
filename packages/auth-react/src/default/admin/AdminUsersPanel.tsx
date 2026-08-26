/**
 * `<AdminUsersPanel/>` — provision an account directly, with no sign-up and
 * no code for the person to enter.
 *
 * ## Two switches that change what happens to somebody else
 *
 * `send_welcome` sends a real message to a real address, and `mark_verified`
 * decides whether the contact details are trusted without the person ever
 * proving them. Neither is a preference; both are consequences, so each
 * carries its consequence as a hint beside it rather than a bare label.
 * `mark_verified` defaults to the contract's own default (`true`) and says
 * what switching it off means.
 *
 * ## The screen ends on the created account, not on a toast
 *
 * `POST /admin/users/` answers with the new account's id and contacts, and
 * that is the whole result — this pair has no user LIST to return to. The
 * form is replaced by that summary, with the id selectable (it is what an
 * operator pastes into the staff-roles screen next) and one way onward:
 * create another.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Button, Card, Flex, Form, Input, Switch, Typography } from "antd";
import { useT } from "@stapel/core";
import { ErrorAlert } from "@stapel/tokens-antd/skin";
import type { AdminUserCreateResponse } from "../../api/types.js";
import { useCreateAdminUser } from "../../model/mutations.js";
import { AUTH_I18N_KEYS } from "../../i18n/keys.js";
import { AdminScreen } from "./AdminScreen.js";

interface UserFormValues {
  readonly email?: string;
  readonly phone?: string;
  readonly username?: string;
  readonly display_name?: string;
  readonly password?: string;
  readonly send_welcome?: boolean;
  readonly mark_verified?: boolean;
}

/** `""` from an untouched antd input is "not given", not an empty address. */
function orNull(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/** The result: what was created, and the id an operator needs next. */
function CreatedSummary(props: {
  created: AdminUserCreateResponse;
  onAnother: () => void;
}): ReactElement {
  const t = useT();
  const c = props.created;
  const contacts = [c.email, c.phone, c.username].filter(
    (v): v is string => typeof v === "string" && v !== ""
  );
  return (
    <Flex vertical gap="middle" data-testid="admin-user-created">
      <Typography.Text strong>{t(AUTH_I18N_KEYS.adminUsersCreated)}</Typography.Text>
      <Typography.Text copyable={{ text: c.user_id }}>
        {t(AUTH_I18N_KEYS.adminUsersCreatedId, { id: c.user_id })}
      </Typography.Text>
      {contacts.length > 0 && (
        <Typography.Text type="secondary">{contacts.join(" · ")}</Typography.Text>
      )}
      <Flex>
        <Button type="primary" onClick={props.onAnother} data-analytics="flow">
          {t(AUTH_I18N_KEYS.adminUsersAnother)}
        </Button>
      </Flex>
    </Flex>
  );
}

/** The account-provisioning screen. */
export function AdminUsersPanel(): ReactElement {
  const t = useT();
  const create = useCreateAdminUser();
  const [created, setCreated] = useState<AdminUserCreateResponse | null>(null);
  // A local rule, not a server one: the contract accepts a body with neither
  // contact, and the account it creates has no way to be signed into. Said
  // beside the fields, before the request, rather than as a 400 afterwards.
  const [needsContact, setNeedsContact] = useState(false);

  function submit(values: UserFormValues): void {
    const email = orNull(values.email);
    const phone = orNull(values.phone);
    if (email === null && phone === null) {
      setNeedsContact(true);
      return;
    }
    setNeedsContact(false);
    create.mutate(
      {
        email,
        phone,
        username: orNull(values.username),
        display_name: orNull(values.display_name),
        password: orNull(values.password),
        send_welcome: values.send_welcome ?? false,
        mark_verified: values.mark_verified ?? true,
      },
      { onSuccess: (result) => setCreated(result) }
    );
  }

  return (
    <AdminScreen
      testId="admin-users"
      title={t(AUTH_I18N_KEYS.adminUsersTitle)}
      subtitle={t(AUTH_I18N_KEYS.adminUsersSubtitle)}
    >
      <Card style={{ width: "100%" }}>
        {created !== null ? (
          <CreatedSummary
            created={created}
            onAnother={() => {
              setCreated(null);
              create.reset();
            }}
          />
        ) : (
          <Form
            layout="vertical"
            initialValues={{ send_welcome: false, mark_verified: true }}
            onFinish={submit}
            data-testid="admin-user-form"
          >
            <Form.Item name="email" label={t(AUTH_I18N_KEYS.adminUsersEmailLabel)}>
              <Input autoFocus type="email" />
            </Form.Item>
            <Form.Item name="phone" label={t(AUTH_I18N_KEYS.adminUsersPhoneLabel)}>
              <Input type="tel" />
            </Form.Item>
            {needsContact && (
              <ErrorAlert
                variant="inline"
                message={t(AUTH_I18N_KEYS.adminUsersNeedsContact)}
                testId="admin-user-needs-contact"
              />
            )}
            <Form.Item name="username" label={t(AUTH_I18N_KEYS.adminUsersUsernameLabel)}>
              <Input />
            </Form.Item>
            <Form.Item
              name="display_name"
              label={t(AUTH_I18N_KEYS.adminUsersDisplayNameLabel)}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="password"
              label={t(AUTH_I18N_KEYS.adminUsersPasswordLabel)}
              extra={t(AUTH_I18N_KEYS.adminUsersPasswordHint)}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item
              name="send_welcome"
              label={t(AUTH_I18N_KEYS.adminUsersSendWelcome)}
              extra={t(AUTH_I18N_KEYS.adminUsersSendWelcomeHint)}
              valuePropName="checked"
            >
              <Switch aria-label={t(AUTH_I18N_KEYS.adminUsersSendWelcome)} />
            </Form.Item>
            <Form.Item
              name="mark_verified"
              label={t(AUTH_I18N_KEYS.adminUsersMarkVerified)}
              extra={t(AUTH_I18N_KEYS.adminUsersMarkVerifiedHint)}
              valuePropName="checked"
            >
              <Switch aria-label={t(AUTH_I18N_KEYS.adminUsersMarkVerified)} />
            </Form.Item>

            <ErrorAlert thrown={create.error} />

            <Button
              type="primary"
              htmlType="submit"
              block
              loading={create.isPending}
              data-analytics="flow"
            >
              {t(AUTH_I18N_KEYS.adminUsersSubmit)}
            </Button>
          </Form>
        )}
      </Card>
    </AdminScreen>
  );
}
