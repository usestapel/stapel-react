import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { workspacesI18nBundleEn } from "./keys.js";
import { workspacesErrorBundleEs } from "./generated/errors.es.gen.js";

export { workspacesErrorBundleEs } from "./generated/errors.es.gen.js";

/**
 * Spanish bundle for workspaces-react — the pair's `es` locale, shipped as the
 * `@stapel/workspaces-react/i18n/es` subpath (i18n-shipping.md §2) so the locale is
 * opt-in: hosts that don't register it never carry these strings (the main
 * entry does not import this module — gated by size-limit + the tree-shake
 * purity test).
 *
 * COVERAGE IS DECLARED, NOT DISCOVERED. This bundle carries the GENERATED
 * backend error texts (from stapel-workspaces's `translations/errors.es.json`
 * catalog — `pnpm gen:errors`), complete over the error registry by
 * construction, AND hand-written Spanish for every pair-owned UI key. It used
 * to carry exactly one UI string and fall back to English for the other 72,
 * which meant a Spanish reader got Spanish error messages inside an English
 * screen; the 2026-08-24 wave closed that. `registerWorkspacesI18nEs` still
 * registers the en floor underneath, so a key added tomorrow degrades to
 * English rather than to a raw key.
 *
 * PLURALS. Spanish takes the same two CLDR categories as English
 * (`one`/`other`), so a `*.count` family ships both plus the flat fallback.
 */
export const workspacesI18nBundleEs: I18nDictionary = {
  // Backend error codes — generated es texts (coverage by construction).
  ...workspacesErrorBundleEs,

  // workspaces-react UI (hand-written es mirror of the en copy in keys.ts)
  "workspaces.error.unknown": "Algo ha fallado. Inténtelo de nuevo.",
  "workspaces.retry": "Reintentar",
  "workspaces.dialog.close": "Cerrar",
  "workspaces.cancel": "Cancelar",
  "workspaces.pager.prev": "Anterior",
  "workspaces.pager.next": "Siguiente",
  "workspaces.pager.position": "Página {page}",
  "workspaces.list.loading": "Cargando espacios de trabajo…",
  "workspaces.list.empty": "Todavía no hay espacios de trabajo.",
  "workspaces.list.load_failed":
    "No hemos podido cargar sus espacios de trabajo. Es un fallo nuestro, no una señal de que no tenga ninguno.",
  "workspaces.list.create": "Crear espacio de trabajo",
  "workspaces.list.creating": "Creando…",
  "workspaces.members.loading": "Cargando miembros…",
  "workspaces.members.empty": "Todavía no hay miembros.",
  "workspaces.members.load_failed": "No hemos podido cargar la lista de miembros.",
  "workspaces.roles.load_failed":
    "No hemos podido cargar la lista de roles, así que ahora no se pueden cambiar. No es un espacio de trabajo sin roles.",
  "workspaces.members.invite": "Invitar",
  "workspaces.members.inviting": "Enviando invitaciones…",
  "workspaces.members.update_role": "Cambiar el rol",
  "workspaces.members.remove": "Quitar",
  "workspaces.accept.accept": "Aceptar la invitación",
  "workspaces.accept.accepting": "Aceptando…",
  "workspaces.accept.accepted": "Se ha unido al espacio de trabajo.",
  "workspaces.settings.title": "Espacio de trabajo",
  "workspaces.settings.subtitle": "Nombre y ajustes generales.",
  "workspaces.settings.field.name": "Nombre del espacio de trabajo",
  "workspaces.settings.field.slug": "Identificador en la URL",
  "workspaces.settings.field.type": "Tipo",
  "workspaces.settings.type.personal": "Personal",
  "workspaces.settings.type.work": "De trabajo",
  "workspaces.settings.save": "Guardar los cambios",
  "workspaces.settings.blocked.cannot_manage":
    "Su rol no puede cambiar los ajustes de este espacio de trabajo.",
  "workspaces.settings.blocked.name_required": "Escriba un nombre para el espacio de trabajo.",
  "workspaces.settings.blocked.unchanged": "Todavía no ha cambiado nada.",
  "workspaces.settings.saving": "Guardando…",
  "workspaces.settings.danger_zone.title": "Zona de riesgo",
  "workspaces.settings.danger_zone.delete": "Eliminar el espacio de trabajo",
  "workspaces.settings.danger_zone.delete_confirm":
    "¿Eliminar este espacio de trabajo? No se puede deshacer.",
  "workspaces.settings.danger_zone.delete_confirm_body":
    "Todos pierden el acceso de inmediato. Lo que otros servicios guarden de este espacio sigue sus propias reglas de retención.",
  "workspaces.settings.danger_zone.blocked": "Este espacio de trabajo no se puede eliminar.",
  "workspaces.settings.security.title": "Seguridad",
  "workspaces.settings.security.subtitle":
    "Reglas que debe cumplir todo el mundo en este espacio de trabajo.",
  "workspaces.settings.security.require_mfa": "Exigir autenticación en dos pasos",
  "workspaces.settings.security.require_mfa_hint":
    "Los miembros sin un segundo factor confirmado no entran hasta que añadan uno.",
  "workspaces.settings.security.policies_label":
    "Pasos del primer inicio de sesión para las cuentas que cree este espacio",
  "workspaces.settings.security.policies_hint":
    "Son exigencias independientes, no alternativas: una organización puede pedir las dos.",
  "workspaces.settings.security.policy.password_change": "Cambiar la contraseña",
  "workspaces.settings.security.policy.mfa_enroll": "Configurar la autenticación en dos pasos",
  "workspaces.settings.security.save": "Guardar los ajustes de seguridad",
  "workspaces.settings.security.saving": "Guardando…",
  "workspaces.settings.security.blocked.capability":
    "Su rol no puede cambiar los ajustes de seguridad.",
  "workspaces.settings.security.step_up_notice":
    "Le pediremos que confirme su identidad antes de guardar.",
  "workspaces.settings.security.mfa.status_title": "Cumplimiento",
  "workspaces.settings.security.mfa.state_label": "Estado",
  "workspaces.settings.security.mfa.state.pending": "Esperando la primera comprobación",
  "workspaces.settings.security.mfa.state.enforcing": "Comprobando a los miembros",
  "workspaces.settings.security.mfa.state.enforced": "En vigor",
  "workspaces.settings.security.mfa.state.failed": "La última comprobación falló",
  "workspaces.settings.security.mfa.state.other": "Estado desconocido ({state})",
  "workspaces.settings.security.mfa.checked_count": "Miembros comprobados: {count}",
  "workspaces.settings.security.mfa.checked_count.one": "{count} miembro comprobado",
  "workspaces.settings.security.mfa.checked_count.other": "{count} miembros comprobados",
  "workspaces.settings.security.mfa.noncompliant_count":
    "Suspendidos por no tener segundo factor: {count}",
  "workspaces.settings.security.mfa.noncompliant_count.one":
    "{count} miembro suspendido por no tener segundo factor",
  "workspaces.settings.security.mfa.noncompliant_count.other":
    "{count} miembros suspendidos por no tener segundo factor",
  "workspaces.settings.security.mfa.unverified_count": "Sin verificar todavía: {count}",
  "workspaces.settings.security.mfa.unverified_count.one": "{count} miembro sin verificar todavía",
  "workspaces.settings.security.mfa.unverified_count.other":
    "{count} miembros sin verificar todavía",
  "workspaces.settings.security.mfa.attempts_count": "Comprobaciones hechas: {count}",
  "workspaces.settings.security.mfa.attempts_count.one": "{count} comprobación hecha",
  "workspaces.settings.security.mfa.attempts_count.other": "{count} comprobaciones hechas",
  "workspaces.settings.security.mfa.last_attempt": "Última comprobación {date}",
  "workspaces.settings.security.mfa.completed_at": "Cobertura completa desde {date}",
  "workspaces.settings.security.mfa.last_error": "Último error: {error}",
  "workspaces.settings.security.mfa.unverified_hint":
    "Mientras la política esté activa, los miembros sin verificar no entran. Pídales que añadan un segundo factor: la cifra de arriba tiene que llegar a cero.",
  "workspaces.settings.security.mfa.off":
    "En este espacio de trabajo no se exige la autenticación en dos pasos.",
  "workspaces.members.title": "Miembros",
  "workspaces.members.subtitle": "Gestione quién tiene acceso a este espacio de trabajo.",
  "workspaces.members.count": "Miembros: {count}",
  "workspaces.members.count.one": "{count} miembro",
  "workspaces.members.count.other": "{count} miembros",
  "workspaces.members.joined": "Se unió el {date}",
  "workspaces.members.last_seen": "Visto {date}",
  "workspaces.members.last_seen_never": "Aún no ha abierto este espacio de trabajo",
  "workspaces.members.search_placeholder": "Buscar por nombre o correo",
  "workspaces.members.role_picker_label": "Rol de {member}",
  "workspaces.members.blocked.read_only":
    "Puede ver quién está aquí, pero no cambiarlo.",
  "workspaces.members.mfa_label": "Dos pasos",
  "workspaces.members.mfa.compliant": "confirmado",
  "workspaces.members.mfa.noncompliant": "sin configurar",
  "workspaces.members.mfa.unknown": "sin comprobar",
  "workspaces.members.suspended": "Suspendido",
  "workspaces.members.suspended.no_mfa":
    "Suspendido hasta que se confirme un segundo factor.",
  "workspaces.members.provisioned": "Creado por un administrador",
  "workspaces.members.invite_dialog.title": "Invitar a miembros",
  "workspaces.members.invite_dialog.emails_label": "Correos",
  "workspaces.members.invite_dialog.emails_placeholder": "Escriba un correo y pulse Intro",
  "workspaces.members.invite_dialog.role_label": "Rol",
  "workspaces.members.invite_dialog.name_label": "Nombre (opcional)",
  "workspaces.members.invite_dialog.name_placeholder": "Se muestra hasta que elijan el suyo",
  "workspaces.members.invite_dialog.submit": "Enviar las invitaciones",
  "workspaces.members.invite_dialog.blocked.no_emails":
    "Escriba al menos una dirección de correo.",
  "workspaces.members.invite_dialog.blocked.bad_email":
    "{email} no es una dirección de correo.",
  "workspaces.members.remove_confirm": "¿Quitar a este miembro?",
  "workspaces.members.remove_confirm_body":
    "{member} pierde el acceso al espacio de trabajo de inmediato. Podrá volver a invitarle más adelante.",
  "workspaces.members.remove.blocked.last_owner":
    "Es el único propietario del espacio de trabajo. Dé antes el rol de propietario a otra persona.",
  "workspaces.members.remove.blocked.self":
    "Este es usted. Pida a otro propietario o administrador que le quite del espacio de trabajo.",
  "workspaces.members.reset_password": "Restablecer la contraseña",
  "workspaces.members.reset_password.blocked.self":
    "Este es usted. Cambie su propia contraseña en los ajustes de su cuenta — esto actúa sobre la cuenta de otra persona.",
  "workspaces.members.reset_password_dialog.title":
    "¿Restablecer la contraseña de {member}?",
  "workspaces.members.reset_password_dialog.body":
    "Su contraseña actual deja de funcionar de inmediato y se le avisa de que ha sido usted. La carta nunca lleva la nueva contraseña.",
  "workspaces.members.reset_password_dialog.step_up":
    "Le pediremos que confirme su identidad antes de continuar.",
  "workspaces.members.reset_password_dialog.submit": "Restablecer la contraseña",
  "workspaces.members.reset_password_dialog.done":
    "{member} ya tiene una contraseña nueva.",
  "workspaces.members.reset_password_dialog.generated": "Contraseña de un solo uso",
  "workspaces.members.reset_password_dialog.generated_hint":
    "Se muestra una vez y nunca más. Entréguela por un canal de confianza; la persona elegirá la suya al iniciar sesión por primera vez.",
  "workspaces.members.reset_password_dialog.not_notified":
    "No había ningún canal para avisarle, así que dígaselo usted.",
  "workspaces.members.rename": "Cambiar el nombre",
  "workspaces.members.rename_dialog.title": "Corregir el nombre",
  "workspaces.members.rename_dialog.label": "Nombre visible",
  "workspaces.members.rename_dialog.placeholder": "Déjelo vacío para quitar el nombre",
  "workspaces.members.rename_dialog.hint":
    "Es el nombre de esa persona en todo el producto, no una nota guardada en este espacio.",
  "workspaces.members.rename_dialog.submit": "Guardar el nombre",
  "workspaces.members.rename_dialog.blocked.unchanged": "Cambie antes el nombre.",
  "workspaces.members.role.owner": "Propietario",
  "workspaces.members.role.admin": "Administrador",
  "workspaces.members.role.member": "Miembro",
  "workspaces.members.role.viewer": "Observador",

  // Role registry labels (builtin four; clients merge their own roles)
  "workspaces.role.owner": "Propietario",
  "workspaces.role.admin": "Administrador",
  "workspaces.role.member": "Miembro",
  "workspaces.role.viewer": "Observador",
  "workspaces.role.rank_caption": "Rango {rank}",

  // Workspaces page
  "workspaces.page.title": "Espacios de trabajo",
  "workspaces.page.subtitle": "Todos los espacios de trabajo a los que pertenece.",
  "workspaces.list.count": "Espacios de trabajo: {count}",
  "workspaces.list.count.one": "{count} espacio de trabajo",
  "workspaces.list.count.other": "{count} espacios de trabajo",
  "workspaces.list.member_count": "Miembros: {count}",
  "workspaces.list.member_count.one": "{count} miembro",
  "workspaces.list.member_count.other": "{count} miembros",
  "workspaces.list.owner_line": "Propiedad de {owner}",
  "workspaces.list.your_role": "Su rol",
  "workspaces.list.open": "Abrir",
  "workspaces.list.preferred": "Principal",
  "workspaces.list.set_preferred": "Hacer principal",
  "workspaces.list.clear_preferred": "Quitar como principal",
  "workspaces.list.empty_hint":
    "Cree uno para invitar a otras personas y tener el trabajo en un sitio.",
  "workspaces.list.guest_notice":
    "Está aquí como invitado. Un invitado abre lo que le han enviado, pero no pertenece a ningún espacio de trabajo.",
  "workspaces.list.instance_closed":
    "Esta instalación no reparte espacios de trabajo. Pida una invitación a quien la administra.",
  "workspaces.list.create_dialog.title": "Nuevo espacio de trabajo",
  "workspaces.list.create_dialog.name_label": "Nombre",
  "workspaces.list.create_dialog.name_placeholder": "por ejemplo, Acme Ingeniería",
  "workspaces.list.create_dialog.submit": "Crear espacio de trabajo",
  "workspaces.list.create_dialog.blocked.no_name": "Escriba un nombre.",
  "workspaces.list.blocked.create_policy":
    "En esta instalación solo su propietario puede crear espacios de trabajo.",

  // Invitation administration
  "workspaces.invitations.title": "Invitaciones",
  "workspaces.invitations.subtitle": "A quién se ha invitado y quién no se ha unido todavía.",
  "workspaces.invitations.count": "Invitaciones: {count}",
  "workspaces.invitations.count.one": "{count} invitación",
  "workspaces.invitations.count.other": "{count} invitaciones",
  "workspaces.invitations.empty": "Nadie está esperando una invitación.",
  "workspaces.invitations.expires_label": "Caduca",
  "workspaces.invitations.sent_label": "Último envío",
  "workspaces.invitations.sent_never": "Todavía no se ha enviado ninguna carta",
  "workspaces.invitations.search_placeholder": "Buscar por correo",
  "workspaces.invitations.filter_label": "Mostrar",
  "workspaces.invitations.filter.pending": "En espera",
  "workspaces.invitations.filter.never_accepted": "Nunca aceptadas",
  "workspaces.invitations.filter.all": "Todas",
  "workspaces.invitations.status.pending": "En espera",
  "workspaces.invitations.status.accepted": "Aceptada",
  "workspaces.invitations.status.declined": "Rechazada",
  "workspaces.invitations.status.revoked": "Retirada",
  "workspaces.invitations.status.expired": "Caducada",
  "workspaces.invitations.resend": "Reenviar",
  "workspaces.invitations.resend_confirm": "¿Enviar la invitación otra vez?",
  "workspaces.invitations.resend_confirm_body":
    "Sale un enlace nuevo hacia {email} y el anterior deja de funcionar.",
  "workspaces.invitations.revoke": "Retirar",
  "workspaces.invitations.revoke_confirm": "¿Retirar esta invitación?",
  "workspaces.invitations.revoke_confirm_body":
    "El enlace hacia {email} deja de funcionar. No se avisa a nadie; podrá invitarle de nuevo más adelante.",
  "workspaces.invitations.rename": "Cambiar el nombre",
  "workspaces.invitations.rename_dialog.title": "Corregir el nombre de la persona invitada",
  "workspaces.invitations.blocked.terminal":
    "Esta invitación ya se aceptó, se rechazó, se retiró o caducó.",
  "workspaces.invitations.blocked.resend_terminal":
    "Solo se puede reenviar una invitación en espera o caducada.",

  // Membership history
  "workspaces.audit.title": "Historial de miembros",
  "workspaces.audit.subtitle":
    "Quién dejó entrar a cada persona, quién la sacó y cuándo.",
  "workspaces.audit.empty": "Aquí todavía no ha pasado nada.",
  "workspaces.audit.filter_label": "Evento",
  "workspaces.audit.filter.all": "Todos los eventos",
  "workspaces.audit.actor_unknown": "El sistema",
  "workspaces.audit.by": "por {actor}",
  "workspaces.audit.role_line": "Rol: {role}",
  "workspaces.audit.action.invitation_created": "Invitación enviada",
  "workspaces.audit.action.invitation_accepted": "Invitación aceptada",
  "workspaces.audit.action.invitation_revoked": "Invitación retirada",
  "workspaces.audit.action.invitation_declined": "Invitación rechazada",
  "workspaces.audit.action.account_created_by_invitation":
    "Cuenta creada a partir de una invitación",
  "workspaces.audit.action.member_joined": "Se unió al espacio de trabajo",
  "workspaces.audit.action.member_provisioned": "Añadido por un administrador",
  "workspaces.audit.action.member_removed": "Retirado del espacio de trabajo",
  "workspaces.audit.action.member_role_changed": "Rol cambiado",
  "workspaces.audit.action.member_suspended": "Acceso suspendido",
  "workspaces.audit.action.member_unsuspended": "Acceso restablecido",
  "workspaces.audit.action.deleted": "Espacio de trabajo eliminado",

  // Invite accept flow (org-program §B4)
  "workspaces.invite.loading": "Cargando la invitación…",
  "workspaces.invite.acceptTitle": "Unirse a {workspace}",
  "workspaces.invite.roleLine": "Le han invitado como {role}.",
  "workspaces.invite.emailLine": "Invitación para {email}",
  "workspaces.invite.joinCta": "Unirse al espacio de trabajo",
  "workspaces.invite.declineCta": "Rechazar",
  "workspaces.invite.declineConfirm": "¿Rechazar esta invitación?",
  "workspaces.invite.declineConfirmBody":
    "Se avisa al espacio de trabajo de su negativa y el enlace deja de funcionar. Si cambia de idea, pida otra invitación.",
  "workspaces.invite.accepted": "Se ha unido a {workspace}.",
  "workspaces.invite.declined": "Invitación rechazada.",
  "workspaces.invite.unavailable.expired": "Esta invitación ha caducado. Pida una nueva.",
  "workspaces.invite.unavailable.revoked": "Esta invitación fue retirada.",
  "workspaces.invite.unavailable.accepted": "Esta invitación ya se ha usado.",
  "workspaces.invite.unavailable.declined": "Esta invitación fue rechazada.",
  "workspaces.invite.wrongAccount": "Esta invitación es para otra cuenta",
  "workspaces.invite.wrongAccountHint":
    "Ha entrado como {email}, pero la invitación se envió a {invited}. Cambie de cuenta para continuar.",
  "workspaces.invite.switchAccountCta": "Cambiar de cuenta",
  "workspaces.invite.loginTitle": "Inicie sesión para aceptar la invitación",
  "workspaces.invite.newUserHint":
    "Crearemos una cuenta verificada para {email}: sin contraseña ni confirmación por correo.",
  "workspaces.invite.createAccountCta": "Crear la cuenta y continuar",
  "workspaces.invite.claiming": "Creando su cuenta…",
  "workspaces.invite.exchanging": "Iniciando su sesión…",
  "workspaces.invite.exchangeFailed": "No hemos podido terminar el inicio de sesión.",
  "workspaces.invite.retryCta": "Inténtelo de nuevo",
  "workspaces.invite.basicDataTitle": "Configure su perfil",
  "workspaces.invite.basicDataContinueCta": "Continuar",
  "workspaces.invite.blocked.busy": "Terminando el paso que ya está en marcha…",

  // A workspace-scoped screen with no active workspace
  "workspaces.active.choose.title": "Elija un espacio de trabajo",
  "workspaces.active.choose.hint":
    "Esta pantalla gestiona un espacio de trabajo cada vez. Elija uno en la página Espacios de trabajo y vuelva.",
  "workspaces.active.none.title": "Todavía no pertenece a ningún espacio de trabajo",
  "workspaces.active.none.hint":
    "Cree uno o pida a un propietario que le invite — entonces habrá algo que gestionar aquí.",

  // Nav manifest labels
  "workspaces.nav.workspaces": "Espacios de trabajo",
  "workspaces.nav.settings": "Espacio de trabajo",
  "workspaces.nav.members": "Miembros",
  "workspaces.nav.invitations": "Invitaciones",
  "workspaces.nav.audit": "Historial",
  "workspaces.nav.invite": "Invitación",
};

/**
 * Register the pair's `es` locale into a core i18n engine (call once at
 * startup, after {@link registerWorkspacesI18n}). Layers per the merge-priority
 * convention (i18n-shipping.md §3): the en floor is registered UNDER the es
 * texts inside the `es` locale, so any key the es bundle does not carry
 * degrades to its English text rather than to a raw key. A host bundle
 * registered after this call overrides both.
 */
export function registerWorkspacesI18nEs(engine: I18nEngine): void {
  engine.registerBundle("es", workspacesI18nBundleEn);
  engine.registerBundle("es", workspacesI18nBundleEs);
}
