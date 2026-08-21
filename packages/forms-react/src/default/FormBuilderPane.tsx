/**
 * `<FormBuilderPane>` — the workspace admin's authoring surface.
 *
 * The §8 verdict in one component: form authoring is a REACT surface over
 * capability-gated REST, because in this fleet "admin" means a workspace
 * role and only REST reaches a workspace role — Django admin is a staff-only
 * peephole that the actual form authors cannot open.
 *
 * The §8 scope discipline is visible in the code: there is no per-kind form
 * anywhere here. A field's options come from `widgets/configForms.ts` and are
 * drawn by `<ConfigField>`, chosen by config-widget kind. "Rich per-kind
 * config editors and drag-reorder polish are explicitly allowed to be ugly in
 * v1" — so reordering is two buttons, not a drag surface.
 */
import type { ReactElement } from "react";
import {
  Alert,
  Button,
  Card,
  Collapse,
  Empty,
  Flex,
  Form,
  Input,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
} from "antd";
import {
  matchList,
  matchLoad,
  toFlowError,
  useActionGate,
  useDescribeFlowError,
  useT,
} from "@stapel/core";
import type { ConfigFieldSpec, FormRow, FormState } from "../api/types.js";
import { FormBuilder } from "../headless/FormBuilder.js";
import type { BuilderField, FormBuilderBag } from "../headless/FormBuilder.js";
import { ConfigField } from "./ConfigField.js";
import { FormsSkinTheme } from "./theme.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { resolveFormsSkinComponent } from "./slots.js";
import type { ThemeModeProp } from "./types.js";
import { FORMS_I18N_KEYS } from "../i18n/keys.js";

/** Props of the `"builder.toolbar"` slot. */
export interface BuilderToolbarSlotProps {
  readonly bag: FormBuilderBag;
  readonly row: FormRow;
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
  if (Slot) return <Slot {...props} />;

  const { entry, index, total, bag } = props;
  const { field } = entry;
  const config = field.config ?? {};

  return (
    <Card
      size="small"
      data-testid={`forms-builder-field-${field.slug}`}
      title={
        <Flex align="center" gap={8}>
          <Tag>{field.kind}</Tag>
          <Typography.Text strong>{field.name || field.slug}</Typography.Text>
        </Flex>
      }
      extra={
        <Space>
          <Button
            size="small"
            disabled={index === 0}
            data-analytics="none"
            data-analytics-reason="local draft reorder; the save mutation is the tracked step"
            onClick={() => bag.moveField(field.slug, index - 1)}
          >
            {t(FORMS_I18N_KEYS.builderMoveUp)}
          </Button>
          <Button
            size="small"
            disabled={index === total - 1}
            data-analytics="none"
            data-analytics-reason="local draft reorder; the save mutation is the tracked step"
            onClick={() => bag.moveField(field.slug, index + 1)}
          >
            {t(FORMS_I18N_KEYS.builderMoveDown)}
          </Button>
          <Button
            size="small"
            danger
            data-analytics="none"
            data-analytics-reason="local draft edit; the save mutation is the tracked step"
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
  const saveGate = useActionGate(props.bag.save);
  const publishGate = useActionGate(props.bag.publish);
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
    <Flex vertical gap={8}>
      <Flex gap={8} wrap align="center">
        <Button
          type="default"
          loading={bag.isSaving}
          disabled={saveGate.disabled}
          data-analytics="flow"
          data-testid="forms-builder-save"
          onClick={bag.doSave}
        >
          {t(FORMS_I18N_KEYS.builderSave)}
        </Button>
        <Button
          type="primary"
          loading={bag.isPublishing}
          disabled={publishGate.disabled}
          data-analytics="flow"
          data-testid="forms-builder-publish"
          onClick={bag.doPublish}
        >
          {t(FORMS_I18N_KEYS.builderPublish)}
        </Button>
        <Select<FormState>
          style={{ width: 140 }}
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
      </Flex>
      {/* Reasons as text beside the controls, never as tooltips on disabled
          buttons — those receive no pointer events. */}
      {saveGate.reason !== undefined && (
        <Typography.Text type="secondary">{saveGate.reason}</Typography.Text>
      )}
      {publishGate.reason !== undefined && (
        <Typography.Text type="secondary" data-testid="forms-publish-blocked">
          {publishGate.reason}
        </Typography.Text>
      )}
      <Typography.Text type="secondary" copyable={{ text: row.public_id }}>
        {t(FORMS_I18N_KEYS.builderPublicLink)}: {row.public_id}
      </Typography.Text>
    </Flex>
  );
}

export interface FormBuilderPaneProps extends ThemeModeProp {
  readonly workspaceId: string;
  readonly formId: string;
}

export function FormBuilderPane(props: FormBuilderPaneProps): ReactElement {
  const t = useT();
  const describe = useDescribeFlowError();

  return (
    <FormsSkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <FormBuilder workspaceId={props.workspaceId} formId={props.formId}>
        {(bag) =>
          matchLoad(bag.state, {
            loading: () => (
              <Flex justify="center" style={{ padding: 24 }}>
                <Spin data-testid="forms-builder-loading" />
              </Flex>
            ),
            // Never "this form does not exist" — a failed read is a failed
            // read, and it offers a retry.
            failed: (error) => (
              <ErrorAlert
                testId="forms-builder-failed"
                error={describe(toFlowError(error))}
                action={
                  <Button
                    size="small"
                    onClick={bag.refetch}
                    data-analytics="none"
                    data-analytics-reason="retry of a failed read; no flow to step"
                  >
                    {t(FORMS_I18N_KEYS.fillRetry)}
                  </Button>
                }
              />
            ),
            ready: (row) => (
              <Flex vertical gap={16}>
                <Typography.Title level={4}>
                  {t(FORMS_I18N_KEYS.builderTitle)}
                </Typography.Title>

                <Toolbar bag={bag} row={row} />

                {bag.error !== null && (
                  <ErrorAlert
                    testId="forms-builder-error"
                    error={describe(toFlowError(bag.error))}
                  />
                )}

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
                  <Empty description={t(FORMS_I18N_KEYS.builderEmpty)} />
                ) : (
                  <Flex vertical gap={12}>
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
                {matchList(bag.availableKinds, {
                  loading: () => <Spin size="small" data-testid="forms-kinds-loading" />,
                  failed: (error) => (
                    <ErrorAlert
                      testId="forms-kinds-failed"
                      error={{
                        ...describe(toFlowError(error)),
                        message: t(FORMS_I18N_KEYS.builderKindsFailed),
                      }}
                    />
                  ),
                  empty: () => (
                    <Typography.Text type="secondary" data-testid="forms-kinds-empty">
                      {t(FORMS_I18N_KEYS.builderNoKinds)}
                    </Typography.Text>
                  ),
                  ready: (kinds) => (
                    <Flex gap={8} wrap>
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
                  ),
                })}
              </Flex>
            ),
          })
        }
      </FormBuilder>
    </FormsSkinTheme>
  );
}
