/**
 * `<FormBuilderPane>` — the workspace admin's authoring surface.
 *
 * The §8 verdict in one component: form authoring is a REACT surface over
 * capability-gated REST, because in this fleet "admin" means a workspace
 * role and only REST reaches a workspace role — Django admin is a staff-only
 * peephole that the actual form authors cannot open.
 *
 * The §8 scope discipline is visible in the code: there is no per-kind form
 * anywhere here. A field's options come from `GET /field-kinds` and are drawn
 * by `<ConfigField>`, chosen by config-widget kind. "Rich per-kind config
 * editors and drag-reorder polish are explicitly allowed to be ugly in v1" —
 * so reordering is two buttons, not a drag surface.
 *
 * What the builder does NOT own: who gets told about a response. That is
 * `<FormSettingsPane>`, opened from the toolbar as a dialog (a bottom sheet on
 * a phone) — a form's schema and a form's recipients are edited on different
 * days by different people, and mixing them makes both harder to find.
 */
import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import {
  Alert,
  Button,
  Card,
  Collapse,
  Flex,
  Form,
  Input,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from "antd";
import {
  EmptyState,
  ErrorAlert,
  GatedButton,
  LoadBoundary,
  LoadList,
  SkinDialog,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import {
  actionAvailable,
  actionBlocked,
  useT,
} from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import type { ConfigFieldSpec, FormRow, FormState } from "../api/types.js";
import { FormBuilder } from "../headless/FormBuilder.js";
import type { BuilderField, FormBuilderBag } from "../headless/FormBuilder.js";
import { ConfigField } from "./ConfigField.js";
import { FormSettingsPane } from "./FormSettingsPane.js";
import {
  FORM_STATE_SELECT_WIDTH,
  SETTINGS_DIALOG_WIDTH,
} from "./geometry.js";
import { resolveFormsSkinComponent } from "./slots.js";
import { MissingWorkspaceNotice, useFormsWorkspaceId } from "./workspace.js";
import { skinThemeProps } from "./types.js";
import type { ThemeModeProp } from "./types.js";
import { FORMS_I18N_KEYS } from "../i18n/keys.js";

/** Props of the `"builder.toolbar"` slot. */
export interface BuilderToolbarSlotProps {
  readonly bag: FormBuilderBag;
  readonly row: FormRow;
  /** Open the form-settings dialog. */
  onOpenSettings(): void;
}

/** Props of the `"builder.fieldRow"` slot. */
export interface BuilderFieldRowSlotProps {
  readonly entry: BuilderField;
  readonly index: number;
  readonly total: number;
  readonly bag: FormBuilderBag;
}

function FieldEditor(props: BuilderFieldRowSlotProps): ReactElement {
  const t = useT();
  const Slot = resolveFormsSkinComponent<BuilderFieldRowSlotProps>(
    "builder.fieldRow"
  );
  const { entry, index, total, bag } = props;
  const { field } = entry;
  // A reorder button that cannot move is not "greyed out for unknown
  // reasons": the two ends of a list are the whole reason, and the gate is
  // what carries that sentence to the person and to a screen reader.
  const moveUp: ActionAvailability = useMemo(
    () =>
      index === 0
        ? actionBlocked(FORMS_I18N_KEYS.builderReorderBlockedFirst)
        : actionAvailable(),
    [index]
  );
  const moveDown: ActionAvailability = useMemo(
    () =>
      index === total - 1
        ? actionBlocked(FORMS_I18N_KEYS.builderReorderBlockedLast)
        : actionAvailable(),
    [index, total]
  );
  if (Slot) return <Slot {...props} />;

  const config = field.config ?? {};

  return (
    <Card
      size="small"
      data-testid={`forms-builder-field-${field.slug}`}
      title={
        <Flex align="center" gap={spacing[2]} wrap>
          <Tag>{field.kind}</Tag>
          <Typography.Text strong>{field.name || field.slug}</Typography.Text>
        </Flex>
      }
      extra={
        <Space wrap>
          <GatedButton
            gate={moveUp}
            layout="inline"
            size="small"
            data-analytics="none"
            data-analytics-reason="local draft reorder; the save mutation is the tracked step"
            testId={`forms-builder-up-${field.slug}`}
            onClick={() => bag.moveField(field.slug, index - 1)}
          >
            {t(FORMS_I18N_KEYS.builderMoveUp)}
          </GatedButton>
          <GatedButton
            gate={moveDown}
            layout="inline"
            size="small"
            data-analytics="none"
            data-analytics-reason="local draft reorder; the save mutation is the tracked step"
            testId={`forms-builder-down-${field.slug}`}
            onClick={() => bag.moveField(field.slug, index + 1)}
          >
            {t(FORMS_I18N_KEYS.builderMoveDown)}
          </GatedButton>
          <Button
            size="small"
            danger
            data-analytics="none"
            data-analytics-reason="local draft edit; the save mutation is the tracked step"
            data-testid={`forms-builder-remove-${field.slug}`}
            onClick={() => bag.removeField(field.slug)}
          >
            {t(FORMS_I18N_KEYS.builderRemoveField)}
          </Button>
        </Space>
      }
    >
      <Form layout="vertical" size="small">
        <Form.Item label={t(FORMS_I18N_KEYS.builderFieldSlug)}>
          <Input
            value={field.slug}
            onChange={(event) =>
              bag.updateField(field.slug, { slug: event.target.value })
            }
          />
        </Form.Item>
        <Form.Item label={t(FORMS_I18N_KEYS.builderFieldLabel)}>
          <Input
            value={field.name ?? ""}
            onChange={(event) =>
              bag.updateField(field.slug, { name: event.target.value })
            }
          />
        </Form.Item>
        {/* A header is a caption, so "required" would be meaningless on it. */}
        {field.kind !== "header" && (
          <Form.Item label={t(FORMS_I18N_KEYS.builderFieldRequired)}>
            <Switch
              checked={field.mandatory === true}
              onChange={(checked) =>
                bag.updateField(field.slug, { mandatory: checked })
              }
            />
          </Form.Item>
        )}

        {entry.builderLess ? (
          <Alert
            type="info"
            showIcon
            data-testid="forms-builder-less"
            // Two different facts, worded differently: the registry does not
            // carry this kind at all, versus it carries it and it simply has
            // no options. Collapsing them would tell an admin their schema is
            // fine when the deployment cannot render the field.
            message={t(
              entry.kindInfo === undefined || entry.kindInfo.registered === false
                ? FORMS_I18N_KEYS.builderKindUnregistered
                : FORMS_I18N_KEYS.builderBuilderLess
            )}
          />
        ) : (
          <Collapse
            size="small"
            ghost
            items={[
              {
                key: "config",
                label: t(FORMS_I18N_KEYS.builderFieldKind),
                children: (
                  <>
                    {entry.configFields.map((spec: ConfigFieldSpec) => (
                      <Form.Item key={spec.name} label={spec.name}>
                        <ConfigField
                          spec={spec}
                          value={config[spec.name]}
                          disabled={false}
                          onChange={(next) =>
                            bag.setFieldConfig(field.slug, spec.name, next)
                          }
                        />
                      </Form.Item>
                    ))}
                  </>
                ),
              },
            ]}
          />
        )}
      </Form>
    </Card>
  );
}

function Toolbar(props: BuilderToolbarSlotProps): ReactElement {
  const t = useT();
  const Slot = resolveFormsSkinComponent<BuilderToolbarSlotProps>(
    "builder.toolbar"
  );
  if (Slot) return <Slot {...props} />;

  const { bag, row } = props;
  const stateLabel: Readonly<Record<FormState, string>> = {
    draft: t(FORMS_I18N_KEYS.builderStateDraft),
    open: t(FORMS_I18N_KEYS.builderStateOpen),
    closed: t(FORMS_I18N_KEYS.builderStateClosed),
  };

  return (
    <Flex vertical gap={spacing[2]}>
      <Flex gap={spacing[2]} wrap align="flex-start">
        <GatedButton
          gate={bag.save}
          type="default"
          loading={bag.isSaving}
          data-analytics="flow"
          testId="forms-builder-save"
          onClick={bag.doSave}
        >
          {t(FORMS_I18N_KEYS.builderSave)}
        </GatedButton>
        <GatedButton
          gate={bag.publish}
          type="primary"
          loading={bag.isPublishing}
          data-analytics="flow"
          testId="forms-builder-publish"
          onClick={bag.doPublish}
        >
          {t(FORMS_I18N_KEYS.builderPublish)}
        </GatedButton>
        <Select<FormState>
          aria-label={t(FORMS_I18N_KEYS.listStateFilter)}
          style={{ width: FORM_STATE_SELECT_WIDTH }}
          value={row.state as FormState}
          onChange={(next) => bag.setState(next)}
          options={(["draft", "open", "closed"] as const).map((s) => ({
            value: s,
            label: stateLabel[s],
          }))}
        />
        <Button
          data-analytics="flow"
          data-testid="forms-builder-rotate"
          onClick={bag.rotateLink}
        >
          {t(FORMS_I18N_KEYS.builderRotateLink)}
        </Button>
        <Button
          data-analytics="none"
          data-analytics-reason="opens the settings dialog; the PATCH inside it is the tracked step"
          data-testid="forms-builder-settings"
          onClick={props.onOpenSettings}
        >
          {t(FORMS_I18N_KEYS.settingsOpen)}
        </Button>
      </Flex>
      <Typography.Text type="secondary" copyable={{ text: row.public_id }}>
        {t(FORMS_I18N_KEYS.builderPublicLink)}: {row.public_id}
      </Typography.Text>
    </Flex>
  );
}

export interface FormBuilderPaneProps extends ThemeModeProp {
  /** Omit to use the runtime's `workspaceId` (the routable case). */
  readonly workspaceId?: string;
  readonly formId: string;
}

export function FormBuilderPane(props: FormBuilderPaneProps): ReactElement {
  const t = useT();
  const workspaceId = useFormsWorkspaceId(props.workspaceId);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (workspaceId === null) {
    return (
      <SkinTheme {...skinThemeProps(props)}>
        <MissingWorkspaceNotice testId="forms-builder-no-workspace" />
      </SkinTheme>
    );
  }

  return (
    <SkinTheme {...skinThemeProps(props)}>
      <FormBuilder workspaceId={workspaceId} formId={props.formId}>
        {(bag) => (
          <LoadBoundary
            state={bag.state}
            onRetry={bag.refetch}
            testId="forms-builder"
            // Never "this form does not exist" — a failed read is a failed
            // read, and it offers a retry.
            failed={(thrown) => (
              <ErrorAlert
                testId="forms-builder-failed"
                thrown={thrown}
                onRetry={bag.refetch}
              />
            )}
          >
            {(row) => (
              <Flex vertical gap={spacing[4]}>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {t(FORMS_I18N_KEYS.builderTitle)}
                </Typography.Title>

                <Toolbar
                  bag={bag}
                  row={row}
                  onOpenSettings={() => setSettingsOpen(true)}
                />

                <ErrorAlert
                  testId="forms-builder-error"
                  {...(bag.error !== null ? { thrown: bag.error } : {})}
                />

                <Form layout="vertical">
                  <Form.Item label={t(FORMS_I18N_KEYS.builderMetaTitle)}>
                    <Input
                      value={bag.meta.title ?? ""}
                      onChange={(event) =>
                        bag.setMeta({ title: event.target.value })
                      }
                    />
                  </Form.Item>
                  <Form.Item label={t(FORMS_I18N_KEYS.builderMetaDescription)}>
                    <Input.TextArea
                      autoSize={{ minRows: 2, maxRows: 5 }}
                      value={bag.meta.description ?? ""}
                      onChange={(event) =>
                        bag.setMeta({ description: event.target.value })
                      }
                    />
                  </Form.Item>
                  <Form.Item label={t(FORMS_I18N_KEYS.builderMetaSubmitLabel)}>
                    <Input
                      value={bag.meta.submit_label ?? ""}
                      onChange={(event) =>
                        bag.setMeta({ submit_label: event.target.value })
                      }
                    />
                  </Form.Item>
                  <Form.Item label={t(FORMS_I18N_KEYS.builderMetaConfirmation)}>
                    <Input
                      value={bag.meta.confirmation_text ?? ""}
                      onChange={(event) =>
                        bag.setMeta({ confirmation_text: event.target.value })
                      }
                    />
                  </Form.Item>
                </Form>

                {bag.fields.length === 0 ? (
                  <EmptyState
                    testId="forms-builder-empty"
                    title={t(FORMS_I18N_KEYS.builderEmpty)}
                  />
                ) : (
                  <Flex vertical gap={spacing[3]}>
                    {bag.fields.map((entry, index) => (
                      <FieldEditor
                        key={entry.field.slug}
                        entry={entry}
                        index={index}
                        total={bag.fields.length}
                        bag={bag}
                      />
                    ))}
                  </Flex>
                )}

                {/* The catalogue is a LoadState of its own: a builder whose
                    dictionary failed to load must say so, not render zero
                    buttons and imply this deployment has no field kinds. */}
                <LoadList
                  state={bag.availableKinds}
                  testId="forms-kinds"
                  failed={(thrown) => (
                    <ErrorAlert
                      testId="forms-kinds-failed"
                      message={t(FORMS_I18N_KEYS.builderKindsFailed)}
                      thrown={thrown}
                    />
                  )}
                  empty={
                    <EmptyState
                      testId="forms-kinds-empty"
                      compact
                      title={t(FORMS_I18N_KEYS.builderNoKinds)}
                    />
                  }
                >
                  {(kinds) => (
                    <Flex gap={spacing[2]} wrap>
                      {kinds.map((kind) => (
                        <Button
                          key={kind.kind}
                          size="small"
                          data-analytics="none"
                          data-analytics-reason="local draft edit; the save mutation is the tracked step"
                          data-testid={`forms-builder-add-${kind.kind}`}
                          onClick={() => bag.addField(kind.kind)}
                        >
                          {t(FORMS_I18N_KEYS.builderAddField)}: {kind.kind}
                        </Button>
                      ))}
                    </Flex>
                  )}
                </LoadList>

                <SkinDialog
                  open={settingsOpen}
                  onClose={() => setSettingsOpen(false)}
                  title={t(FORMS_I18N_KEYS.settingsTitle)}
                  dismissLabel={t(FORMS_I18N_KEYS.settingsClose)}
                  width={SETTINGS_DIALOG_WIDTH}
                  data-testid="forms-builder-settings-dialog"
                >
                  {settingsOpen && (
                    <FormSettingsPane
                      workspaceId={workspaceId}
                      formId={props.formId}
                      surface="bare"
                    />
                  )}
                </SkinDialog>
              </Flex>
            )}
          </LoadBoundary>
        )}
      </FormBuilder>
    </SkinTheme>
  );
}
