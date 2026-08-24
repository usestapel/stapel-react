/**
 * `<FormSettingsPane>` — where a form is told WHO to tell.
 *
 * This is the screen the audit called the pair's defining gap: `PATCH
 * /forms/<id>` is the only writer of `Form.settings`, `Form.settings` is where
 * `notify_emails` / `notify_telegram_chat_ids` / `retention_days` live, and
 * until this surface existed a form authored entirely through the shipped skin
 * collected responses that reached nobody. The backend implements the whole
 * `form.submission.received` → notification loop; this is the control that
 * turns it on.
 *
 * Three things it refuses to do:
 *
 *  1. **Refuse an address the server would have accepted.** The backend
 *     validates `retention_days` and passes the destination lists through, so
 *     a malformed-looking address is a NOTICE beside the field, never a gate.
 *  2. **Hide the consequence of an empty configuration.** With no destination
 *     at all, the pane says in one sentence what will happen — responses
 *     stored, nobody told — instead of leaving two empty inputs that look
 *     finished.
 *  3. **Guess the retention ceiling.** `STAPEL_FORMS["RETENTION_DAYS"]` is a
 *     deployment setting no client can read, so a too-long override arrives as
 *     the server's own `error.400.forms_invalid_retention` (with its
 *     `params.limit`) rendered by `<ErrorAlert>`.
 */
import type { ReactElement } from "react";
import { Flex, Form, Input, InputNumber, Select, Typography } from "antd";
import {
  ErrorAlert,
  GatedButton,
  LoadBoundary,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { useT } from "@stapel/core";
import { fontSize, spacing } from "@stapel/tokens";
import { RETENTION_INPUT_WIDTH } from "./geometry.js";
import { FormSettingsEditor } from "../headless/FormSettingsEditor.js";
import type { FormRow } from "../api/types.js";
import { MissingWorkspaceNotice, useFormsWorkspaceId } from "./workspace.js";
import { skinThemeProps } from "./types.js";
import type { ThemeModeProp } from "./types.js";
import { FORMS_I18N_KEYS } from "../i18n/keys.js";

/** A destination list is element-width: it holds as many chips as the column
 * it sits in can show, on a phone and on a desktop alike. */
const DESTINATION_WIDTH = "100%";

export interface FormSettingsPaneProps extends ThemeModeProp {
  /** Omit to use the runtime's `workspaceId`. */
  readonly workspaceId?: string;
  readonly formId: string;
  readonly onSaved?: (form: FormRow) => void;
}

export function FormSettingsPane(props: FormSettingsPaneProps): ReactElement {
  const t = useT();
  const workspaceId = useFormsWorkspaceId(props.workspaceId);

  if (workspaceId === null) {
    return (
      <SkinTheme {...skinThemeProps(props)}>
        <MissingWorkspaceNotice testId="forms-settings-no-workspace" />
      </SkinTheme>
    );
  }

  return (
    <SkinTheme {...skinThemeProps(props)}>
      <FormSettingsEditor
        workspaceId={workspaceId}
        formId={props.formId}
        {...(props.onSaved ? { onSaved: props.onSaved } : {})}
      >
        {(bag) => (
          <LoadBoundary
            state={bag.state}
            onRetry={bag.refetch}
            testId="forms-settings"
            failed={(thrown) => (
              <ErrorAlert
                testId="forms-settings-failed"
                message={t(FORMS_I18N_KEYS.settingsLoadFailed)}
                thrown={thrown}
                onRetry={bag.refetch}
              />
            )}
          >
            {() => (
              <Flex vertical gap={spacing[4]} data-testid="forms-settings-form">
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {t(FORMS_I18N_KEYS.settingsTitle)}
                </Typography.Title>

                <Form layout="vertical">
                  <Form.Item
                    label={t(FORMS_I18N_KEYS.settingsFormTitle)}
                    htmlFor="forms-settings-title"
                  >
                    <Input
                      id="forms-settings-title"
                      value={bag.title}
                      onChange={(event) => bag.setTitle(event.target.value)}
                      data-testid="forms-settings-title"
                    />
                  </Form.Item>

                  <Form.Item
                    label={t(FORMS_I18N_KEYS.settingsNotifyEmails)}
                    htmlFor="forms-settings-emails"
                    extra={t(FORMS_I18N_KEYS.settingsNotifyEmailsHint)}
                  >
                    <Select<string[]>
                      id="forms-settings-emails"
                      mode="tags"
                      style={{ width: DESTINATION_WIDTH }}
                      value={[...bag.notifyEmails]}
                      onChange={(next) => bag.setNotifyEmails(next)}
                      placeholder={t(FORMS_I18N_KEYS.settingsAddDestination)}
                      // A tag input over free text: there is nothing to
                      // suggest, and an empty dropdown reads as "no options
                      // available" rather than "type your own".
                      open={false}
                      suffixIcon={null}
                      data-testid="forms-settings-emails"
                    />
                  </Form.Item>

                  <Form.Item
                    label={t(FORMS_I18N_KEYS.settingsNotifyTelegram)}
                    htmlFor="forms-settings-telegram"
                    extra={t(FORMS_I18N_KEYS.settingsNotifyTelegramHint)}
                  >
                    <Select<string[]>
                      id="forms-settings-telegram"
                      mode="tags"
                      style={{ width: DESTINATION_WIDTH }}
                      value={[...bag.notifyTelegramChatIds]}
                      onChange={(next) =>
                        bag.setNotifyTelegramChatIds(next)
                      }
                      placeholder={t(FORMS_I18N_KEYS.settingsAddDestination)}
                      open={false}
                      suffixIcon={null}
                      data-testid="forms-settings-telegram"
                    />
                  </Form.Item>

                  <Form.Item
                    label={t(FORMS_I18N_KEYS.settingsRetention)}
                    htmlFor="forms-settings-retention"
                    extra={t(FORMS_I18N_KEYS.settingsRetentionHint)}
                  >
                    <InputNumber
                      id="forms-settings-retention"
                      min={1}
                      step={1}
                      style={{ width: RETENTION_INPUT_WIDTH }}
                      value={bag.retentionDays}
                      onChange={(next) =>
                        bag.setRetentionDays(
                          typeof next === "number" ? next : null
                        )
                      }
                      placeholder={t(FORMS_I18N_KEYS.settingsRetentionDefault)}
                      data-testid="forms-settings-retention"
                    />
                  </Form.Item>
                </Form>

                {/* The consequence of an empty configuration, stated once and
                    in the place the decision is made. */}
                {!bag.hasDestination && (
                  <ErrorAlert
                    variant="inline"
                    testId="forms-settings-no-destination"
                    message={t(FORMS_I18N_KEYS.settingsNoDestination)}
                  />
                )}
                {bag.suspectEmails.length > 0 && (
                  <Typography.Text
                    type="warning"
                    style={{ fontSize: fontSize.xs.fontSize }}
                    data-testid="forms-settings-suspect"
                  >
                    {t(FORMS_I18N_KEYS.settingsSuspectEmails, {
                      list: bag.suspectEmails.join(", "),
                    })}
                  </Typography.Text>
                )}

                <ErrorAlert
                  testId="forms-settings-error"
                  {...(bag.error !== null ? { thrown: bag.error } : {})}
                />

                <Flex gap={spacing[2]} align="center" wrap>
                  <GatedButton
                    gate={bag.save}
                    type="primary"
                    loading={bag.isSaving}
                    onClick={bag.doSave}
                    data-analytics="flow"
                    testId="forms-settings-save"
                  >
                    {t(FORMS_I18N_KEYS.settingsSave)}
                  </GatedButton>
                  {bag.saved && (
                    <Typography.Text
                      type="success"
                      data-testid="forms-settings-saved"
                    >
                      {t(FORMS_I18N_KEYS.settingsSaved)}
                    </Typography.Text>
                  )}
                </Flex>
              </Flex>
            )}
          </LoadBoundary>
        )}
      </FormSettingsEditor>
    </SkinTheme>
  );
}
