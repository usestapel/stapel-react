import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { authI18nBundleEn } from "./keys.js";
import { authErrorBundleEs } from "./generated/errors.es.gen.js";

export { authErrorBundleEs } from "./generated/errors.es.gen.js";

/**
 * Spanish bundle for auth-react — the pair's `es` locale, shipped as the
 * `@stapel/auth-react/i18n/es` subpath (i18n-shipping.md §2) so the locale is
 * opt-in: hosts that don't register it never carry these strings (the main
 * entry does not import this module — gated by size-limit + the tree-shake
 * purity test).
 *
 * Composition mirrors {@link authI18nBundleEn}: the GENERATED backend error
 * texts (from stapel-auth's `translations/errors.es.json` catalog — `pnpm
 * gen:errors`) are spread first for coverage by construction; the hand-written
 * es UI copy for the pair-owned {@link AUTH_I18N_KEYS} follows. Override any
 * key by registering a host bundle AFTER this one (merge-priority convention —
 * see keys.ts).
 */
export const authI18nBundleEs: I18nDictionary = {
  // Backend error codes — generated es texts (coverage by construction).
  ...authErrorBundleEs,

  // auth-react UI (hand-written es mirror of the en copy in keys.ts)
  "auth.otp.enter_code": "Introduce el código que te enviamos",
  "auth.otp.mock_delivery":
    "Modo de prueba: no se envió ningún código. Usa el código con el que está configurado este entorno.",
  "auth.otp.resend": "Reenviar código",
  "auth.otp.sent_to": "Código enviado a {target}",
  "auth.password.label": "Contraseña",
  "auth.totp.enter_code": "Introduce tu código de 6 dígitos",
  "auth.totp.use_backup": "Usar un código de respaldo",
  "auth.verification.choose_factor": "Verifica que eres tú",
  "auth.verification.success": "Verificado",
  "auth.session.this_device": "Este dispositivo",
  "auth.session.suspicious": "Inicio de sesión no reconocido",
  "auth.passkey.no_credentials":
    "No se pudo iniciar sesión con una passkey en este dispositivo. Añade una en los ajustes de seguridad después de entrar de otra forma, o elige otro método más abajo.",
  "auth.passkey.unsupported":
    "Este navegador no puede usar passkeys. Prueba con otro navegador o dispositivo, o elige otro método.",
  "auth.passkey.declined":
    "No se usó ninguna passkey. O se cerró la solicitud, o este dispositivo todavía no tiene una passkey nuestra: entra de otra forma y luego añade una en los ajustes de seguridad.",
  "auth.passkey.timeout":
    "La solicitud de passkey caducó antes de recibir respuesta. Inténtalo de nuevo.",
  "auth.passkey.insecure":
    "Las passkeys necesitan una conexión segura con este sitio. Ábrelo mediante https e inténtalo de nuevo.",
  "auth.passkey.already_on_device":
    "Este dispositivo ya tiene una passkey de tu cuenta. Úsala para entrar en lugar de añadir otra.",
  "auth.passkey.failed":
    "Tu dispositivo no pudo completar la comprobación de la passkey. Inténtalo de nuevo o elige otro método.",
  "auth.error.unknown": "Algo salió mal. Inténtalo de nuevo.",

  // Default-skin UI (§54 AuthPanel)
  "auth.ui.login_title": "Iniciar sesión",
  "auth.ui.or": "o",
  "auth.ui.more_methods": "Más formas de iniciar sesión",
  "auth.ui.continue_as_guest": "Continuar como invitado",
  "auth.ui.continue_as_guest_pending": "Continuando…",
  "auth.ui.continue_as_guest_hint":
    "Puedes iniciar sesión más tarde: tus datos se conservarán.",
  "auth.ui.resend_in": "Reenviar en {s} s",
  "auth.ui.email_label": "Correo electrónico",
  "auth.ui.email_placeholder": "tu@ejemplo.com",
  "auth.ui.phone_label": "Teléfono",
  "auth.ui.phone_placeholder": "+34 600 000 000",
  "auth.ui.send_code": "Enviar código",
  "auth.ui.continue": "Continuar",
  "auth.ui.submit": "Iniciar sesión",
  "auth.ui.password_placeholder": "Tu contraseña",
  "auth.ui.qr_hint": "Escanea este código con tu teléfono para iniciar sesión.",
  "auth.ui.passkey_cta": "Usar una passkey",
  "auth.ui.magic_link_cta": "Enviarme un enlace de acceso por correo",
  "auth.ui.magic_link_sent_title": "Revisa tu correo",
  "auth.ui.magic_link_sent_body":
    "Te enviamos un enlace de acceso. Ábrelo en este dispositivo.",
  "auth.ui.sso_domain_label": "Dominio de correo corporativo",
  "auth.ui.sso_domain_placeholder": "acme.com",
  "auth.ui.sso_continue": "Continuar con SSO",
  "auth.ui.channel_email": "Correo electrónico",
  "auth.ui.channel_phone": "Teléfono",
  "auth.ui.channel_email_inline": "correo electrónico",
  "auth.ui.channel_phone_inline": "teléfono",
  "auth.ui.channel_password": "Contraseña",
  "auth.ui.channel_passkey": "Passkey",
  "auth.ui.channel_oauth": "Redes sociales",
  "auth.ui.channel_sso": "SSO",
  "auth.ui.channel_qr": "Código QR",
  "auth.ui.channel_magic_link": "Enlace por correo",
  "auth.ui.retry": "Reintentar",
  "auth.ui.close": "Cerrar",
  "auth.ui.passkey_failed_title": "No se pudo iniciar sesión con una passkey",
  "auth.ui.passkey_pick_another": "Usar otro método",

  // Registration surface
  "auth.ui.register_title": "Crear cuenta",
  "auth.ui.register_confirm_label": "Confirma la contraseña",
  "auth.ui.register_mismatch": "Las contraseñas no coinciden.",
  "auth.ui.register_submit": "Crear cuenta",

  // Method-capability labels
  "auth.sec.method_cap.login": "Para iniciar sesión",
  "auth.sec.method_cap.register": "Para registrarse",
  "auth.sec.method_cap.both": "Inicio de sesión y registro",
  "auth.sec.method_cap.portable_anon":
    "Entra en tu cuenta de invitado desde otro dispositivo",

  // Security-profile components (owner directive, item 5)
  "auth.sec.sessions.title": "Sesiones activas",
  "auth.sec.sessions.subtitle":
    "Dónde tienes la sesión iniciada ahora mismo. Cerrar una sesión revoca ese dispositivo de inmediato.",
  "auth.sec.sessions.sign_out": "Cerrar sesión",
  "auth.sec.sessions.sign_out_all": "Cerrar sesión en los demás dispositivos",
  "auth.sec.sessions.confirm_me": "Fui yo",
  "auth.sec.sessions.sign_out_confirm_title":
    "¿Cerrar la sesión de este dispositivo?",
  "auth.sec.sessions.sign_out_all_confirm_title":
    "¿Cerrar la sesión en todos los demás dispositivos?",
  "auth.sec.sessions.empty": "No hay sesiones activas.",
  "auth.sec.sessions.last_used": "Último uso {when}",

  "auth.sec.totp.title": "Autenticación en dos pasos",
  "auth.sec.totp.enabled": "Activada",
  "auth.sec.totp.disabled": "Sin configurar",
  "auth.sec.totp.backup_remaining": "Quedan {n} códigos de respaldo",
  "auth.sec.totp.set_up": "Configurar",
  "auth.sec.totp.disable": "Desactivar",
  "auth.sec.totp.setup_title": "Configurar la autenticación en dos pasos",
  "auth.sec.totp.scan_hint":
    "Escanéalo con tu aplicación de autenticación o introduce el código a mano.",
  "auth.sec.totp.secret_label": "Código para introducir a mano",
  "auth.sec.totp.confirm_label": "Introduce el código de 6 dígitos",
  "auth.sec.totp.confirm_cta": "Confirmar",
  "auth.sec.totp.backup_codes_title": "Guarda tus códigos de respaldo",
  "auth.sec.totp.backup_codes_hint":
    "Cada código sirve una sola vez, por si alguna vez pierdes el acceso a tu aplicación de autenticación. Es la única vez que se muestran.",
  "auth.sec.totp.backup_codes_ack": "Ya he guardado estos códigos",
  "auth.sec.totp.disable_title": "Desactivar la autenticación en dos pasos",
  "auth.sec.totp.disable_code_label": "Código de la aplicación de autenticación",
  "auth.sec.totp.disable_backup_label": "Código de respaldo",
  "auth.sec.totp.use_backup_toggle": "Usar un código de respaldo",

  "auth.sec.totp.replace": "Sustituir",
  "auth.sec.totp.replace_title": "Sustituir la aplicación de autenticación",
  "auth.sec.totp.replace_hint":
    "Confirma tu código actual de la aplicación de autenticación o un código de respaldo y luego configura el nuevo dispositivo.",
  "auth.sec.totp.replace_continue_cta": "Continuar",
  "auth.sec.totp.lost_cta": "¿Has perdido tu aplicación de autenticación?",
  "auth.sec.totp.delayed_hint":
    "Quitaremos la autenticación en dos pasos tras una espera de 14 días y avisaremos a tu correo o teléfono verificado. Puedes cancelarlo en cualquier momento antes de esa fecha.",
  "auth.sec.totp.delayed_cta": "Solicitar la retirada",
  "auth.sec.totp.pending_message":
    "Tu aplicación de autenticación se quitará el {date} (dentro de {days} días).",
  "auth.sec.totp.pending_note":
    "Hemos avisado de esta solicitud a tu correo o teléfono verificado.",
  "auth.sec.totp.no_contact_title": "No hay contacto de recuperación",
  "auth.sec.totp.no_contact_hint":
    "No podemos programarlo sin un correo o un teléfono verificado en tu cuenta. Ponte en contacto con el soporte.",

  "auth.sec.passkeys.title": "Passkeys",
  "auth.sec.passkeys.add": "Añadir una passkey",
  "auth.sec.passkeys.remove": "Quitar",
  "auth.sec.passkeys.empty": "Todavía no hay passkeys.",
  "auth.sec.passkeys.awaiting_ceremony":
    "Sigue las indicaciones de tu navegador o dispositivo para terminar de añadir esta passkey.",
  "auth.sec.passkeys.remove_confirm_title": "¿Quitar esta passkey?",
  "auth.sec.passkeys.added_success": "Passkey añadida.",
  "auth.sec.passkeys.done": "Listo",
  "auth.sec.passkeys.added_on": "Añadida el {date}",
  "auth.sec.passkeys.last_used": "Último uso {date}",
  "auth.sec.passkeys.never_used": "Sin usar todavía",
  "auth.sec.passkeys.add_another": "Añadir otra",
  "auth.sec.passkeys.kind_device": "Integrada en un dispositivo",
  "auth.sec.passkeys.kind_security_key": "Llave de seguridad",
  "auth.sec.passkeys.kind_phone": "Un teléfono o una tableta cercanos",
  "auth.sec.passkeys.kind_unknown": "Passkey",
  "auth.sec.passkeys.add_unsupported":
    "Este navegador no puede crear passkeys. Abre esta página en otro navegador para añadir una.",

  "auth.sec.password.title": "Cambiar la contraseña",
  "auth.sec.password.old_label": "Contraseña actual",
  "auth.sec.password.new_label": "Nueva contraseña",
  "auth.sec.password.confirm_label": "Confirma la nueva contraseña",
  "auth.sec.password.mismatch": "Las contraseñas no coinciden.",
  "auth.sec.password.change_cta": "Cambiar la contraseña",
  "auth.sec.password.via_otp_hint": "Enviaremos un código a {target}",
  "auth.sec.password.success": "Contraseña cambiada.",
  "auth.sec.password.no_methods":
    "Esta cuenta no tiene ninguna forma de cambiar su contraseña aquí.",

  "auth.sec.oauth.title": "Cuentas conectadas",
  "auth.sec.oauth.linked": "Conectada",
  "auth.sec.oauth.link": "Conectar",
  "auth.sec.oauth.unlink": "Desconectar",
  "auth.sec.oauth.unlink_confirm_title": "¿Desconectar esta cuenta?",
  "auth.sec.oauth.empty": "No hay proveedores configurados.",
  "auth.sec.oauth.unlink_unavailable":
    "Ahora mismo no se puede desconectar.",
  "auth.sec.oauth.link_unavailable":
    "Ahora mismo no se puede conectar una cuenta nueva.",

  "auth.sec.change.current_value": "{channel} actual: {value}",
  "auth.sec.change.cta": "Cambiar {channel}",
  "auth.sec.change.instant_hint":
    "Enviaremos un código a tu {channel} actual para verificar que eres tú y luego otro al nuevo.",
  "auth.sec.change.no_access_cta": "¿No tienes acceso a tu {channel} anterior?",
  "auth.sec.change.old_code_hint": "Introduce el código enviado a {target}",
  "auth.sec.change.new_value_label": "Nuevo {channel}",
  "auth.sec.change.request_new_cta": "Enviar código al nuevo {channel}",
  "auth.sec.change.new_code_hint": "Introduce el código enviado a {target}",
  "auth.sec.change.confirm_cta": "Confirmar",
  "auth.sec.change.success": "Tu {channel} se ha cambiado.",
  "auth.sec.change.retry": "Inténtalo de nuevo",
  "auth.sec.change.delayed_form_hint":
    "Avisaremos a tu {channel} ANTERIOR y esperaremos 14 días antes de aplicar el cambio: no hace falta ningún código del {channel} anterior. Introduce tu nuevo {channel} más abajo.",
  "auth.sec.change.delayed_submit_cta": "Iniciar el cambio de 14 días",
  "auth.sec.change.delayed_started":
    "Cambio solicitado. Consulta el cambio pendiente más abajo.",
  "auth.sec.change.pending_message":
    "Cambio a {value} el {date} (dentro de {days} días).",
  "auth.sec.change.pending_note":
    "Se ha avisado de este cambio a tu {channel} anterior.",
  "auth.sec.change.pending_cancel": "Cancelar",
  "auth.sec.change.cancel_confirm_title": "¿Cancelar este cambio pendiente?",

  "auth.sec.audit.title": "Registro de seguridad",
  "auth.sec.audit.empty": "No hay actividad reciente.",
  "auth.sec.audit.ip": "IP {ip}",
  "auth.sec.audit.load_more": "Cargar más",

  "auth.sec.page.title": "Seguridad",
  "auth.sec.page.subtitle":
    "Gestiona tus métodos de inicio de sesión, los dispositivos conectados y la actividad de tu cuenta.",
  "auth.sec.group.contact": "Datos de contacto",
  "auth.sec.group.password": "Contraseña",
  "auth.sec.group.two_factor": "Autenticación en dos pasos",
  "auth.sec.group.devices": "Dispositivos y sesiones",
  "auth.sec.group.connected": "Cuentas conectadas",
  "auth.sec.group.audit": "Registro de seguridad",

  "auth.sec.qr.title": "Iniciar sesión en otro dispositivo",
  "auth.sec.qr.subtitle":
    "Escanea este código con la cámara de un dispositivo que no tenga la sesión iniciada: entrará con esta misma cuenta.",
  "auth.sec.qr.show_cta": "Mostrar el código QR",
  "auth.sec.qr.cancel": "Cancelar",
  "auth.sec.qr.expires_in": "Caduca en {time}",
  "auth.sec.qr.expiring": "Caducando…",
  "auth.sec.qr.fulfilled": "Ese dispositivo ya tiene la sesión iniciada.",
  "auth.sec.qr.rejected":
    "El inicio de sesión se rechazó en el otro dispositivo.",
  "auth.sec.qr.retry": "Inténtalo de nuevo",
  "auth.sec.qr.regenerating": "Ese código caducó: te damos uno nuevo…",

  // QR login_request confirmation
  "auth.qr.confirm.title": "¿Iniciar sesión en el otro dispositivo?",
  "auth.qr.confirm.subtitle":
    "Has escaneado un código de acceso. Si lo apruebas, ese dispositivo entrará con tu cuenta. Si no acabas de escanearlo, recházalo.",
  "auth.qr.confirm.approve": "Sí, iniciar sesión allí",
  "auth.qr.confirm.decline": "No, no he sido yo",
  "auth.qr.confirm.approved":
    "Ese dispositivo ya tiene la sesión iniciada. Puedes dejar este.",
  "auth.qr.confirm.declined": "Inicio de sesión rechazado. No se compartió nada.",
  "auth.qr.confirm.no_key":
    "Este enlace no lleva ningún código de acceso. Vuelve a escanear el código QR.",
  "auth.qr.error.session_not_adopted":
    "El otro dispositivo aprobó el inicio de sesión, pero este no pudo adoptar la sesión. Prueba otra vez con el código.",

  // First-login enforcement (org-program §C2)
  "auth.forcedChange.title": "Establece tu propia contraseña",
  "auth.forcedChange.hint":
    "Tu organización te dio una contraseña temporal. Elige la tuya para continuar: la usarás a partir de ahora.",
  "auth.forcedChange.new_label": "Nueva contraseña",
  "auth.forcedChange.confirm_label": "Repite la nueva contraseña",
  "auth.forcedChange.mismatch": "Las contraseñas no coinciden",
  "auth.forcedChange.submit": "Establecer la contraseña y continuar",
  "auth.forcedChange.success": "Contraseña establecida: ya has entrado.",

  "auth.mfaEnroll.title": "Configura la autenticación en dos pasos",
  "auth.mfaEnroll.hint":
    "Tu organización exige un segundo factor. Añádelo ahora para terminar de iniciar sesión.",
  "auth.mfaEnroll.preparing": "Preparando la configuración…",
  "auth.mfaEnroll.method_totp": "Aplicación de autenticación",
  "auth.mfaEnroll.method_passkey": "Passkey",
  "auth.mfaEnroll.backup_codes_ack":
    "He guardado mis códigos de respaldo: terminar",
  "auth.mfaEnroll.success": "Segundo factor activado: ya has entrado.",
  "auth.mfaEnroll.restart_hint":
    "Este paso ha caducado. Inicia sesión otra vez para reintentarlo.",
  "auth.mfaEnroll.error.no_tokens":
    "La configuración terminó, pero no se pudo completar la sesión. Inicia sesión otra vez.",

  // Nav-manifest labels
  "auth.nav.login": "Iniciar sesión",
  "auth.nav.security": "Seguridad",
  "auth.nav.qr_confirm": "Confirmar el inicio de sesión",
  "auth.ui.switch_to_register": "¿Es tu primera vez? Crea una cuenta",
  "auth.ui.switch_to_login": "¿Ya tienes una cuenta? Inicia sesión",
  "auth.sec.password.no_methods_hint":
    "Añade un correo o un teléfono verificado y esta instalación podrá ofrecerte una forma de cambiarla.",
  "auth.sec.passkeys.empty_hint":
    "Una passkey te identifica con tu cara, tu huella o el PIN del dispositivo: no hay contraseña que recordar ni que se pueda filtrar.",
  "auth.sec.passkeys.rename": "Cambiar el nombre",
  "auth.sec.passkeys.rename_label": "Cambiar el nombre de {name}",
  "auth.sec.passkeys.rename_field": "¿Cómo quieres llamar a esta passkey?",
  "auth.sec.passkeys.rename_save": "Guardar el nombre",
  "auth.sec.passkeys.remove_label": "Quitar {name}",
  "auth.sec.sessions.empty_hint":
    "Las sesiones aparecerán aquí a medida que entres en otros navegadores y dispositivos.",
  "auth.sec.passkeys.gone":
    "Esa passkey ya no está en tu cuenta. La lista se ha actualizado.",
  "auth.sec.oauth.unlink_label": "Desconectar {name}",
  "auth.sec.oauth.empty_hint":
    "Conecta una cuenta para entrar con un solo toque la próxima vez.",
  "auth.sec.audit.empty_hint":
    "Aquí aparecerán los inicios de sesión, los cambios de contraseña y la actividad de los dispositivos.",
  "auth.sec.audit.suspicious_label": "Actividad no reconocida",

  // Backend error codes — the es MIRROR of the polished en copy in keys.ts.
  // The generated es bundle above already covers every registry code, but a
  // key the en bundle re-words has to be re-worded here too: otherwise the
  // Spanish dialog quietly shows the registry's plainer sentence while the
  // English one shows the polished one, and the two locales drift apart on
  // exactly the strings a person reads when something has gone wrong.
  "error.401.invalid_credentials": "Correo o contraseña incorrectos.",
  "error.401.account_disabled": "Esta cuenta se ha desactivado.",
  "error.401.refresh_revoked": "Tu sesión ha terminado. Inicia sesión de nuevo.",
  "error.400.code_expired": "Ese código ha caducado. Solicita uno nuevo.",
  "error.400.invalid_code": "Ese código no es correcto.",
  "error.400.invalid_code_attempts":
    "Ese código no es correcto. Te quedan {attempts_remaining} intentos.",
  "error.422.blocked":
    "Demasiados intentos. Inténtalo de nuevo en {retry_after_minutes} min.",
  "error.429.rate_limit": "Espera un momento antes de pedir otro código.",
  "error.400.no_verified_contact":
    "No hay ningún contacto verificado para este método.",
  "error.400.wrong_password": "Tu contraseña actual no es correcta.",
  "error.400.no_password": "Esta cuenta no tiene contraseña.",
  "error.404.user_for_reset":
    "No se encontró ninguna cuenta con ese correo o teléfono.",
  "error.403.mock_otp_admin":
    "Las cuentas de administración no pueden usar códigos en este entorno.",
  "error.400.code_required": "Hace falta un código.",
  "error.400.totp_not_pending":
    "Empieza primero la configuración del segundo factor.",
  "error.423.account_locked":
    "Cuenta bloqueada. Inténtalo de nuevo en {retry_after_minutes} min.",
  "error.429.magic_link_rate":
    "Demasiadas solicitudes de enlace de acceso. Inténtalo más tarde.",
  "error.400.passkey_invalid": "No se pudo verificar la passkey.",
  "error.400.passkey_challenge_expired":
    "La solicitud de passkey ha caducado. Inténtalo de nuevo.",
  "error.409.passkey_already_registered": "Esta passkey ya está registrada.",
  "error.400.last_auth_method":
    "No puedes quitar tu último método de inicio de sesión.",
  "error.400.invalid_redirect_url": "Redirección no válida.",
  "error.400.magic_link_invalid":
    "Este enlace de acceso no es válido o ha caducado.",
  "error.400.captcha_required": "Completa el captcha.",
  "error.400.captcha_invalid": "No se pudo verificar el captcha.",
  "error.403.verification_required": "Hace falta una verificación adicional.",
  "error.404.verification_challenge_not_found":
    "Esta verificación ha caducado. Vuelve a intentar la acción.",
  "error.400.verification_invalid_factor":
    "Esa opción de verificación no está disponible.",
  "error.400.verification_failed":
    "La verificación no se completó. Inténtalo de nuevo.",
  "error.423.verification_locked":
    "Demasiados intentos. Vuelve a intentar la acción más tarde.",
  "error.404.sso_org_not_found": "No se encontró la organización.",
  "error.400.sso_not_configured":
    "El SSO no está configurado para esta organización.",
  "error.403.sso_required": "Esta cuenta debe iniciar sesión con SSO.",

  // Step-up verification preferences
  "auth.sec.group.verification": "Verificación adicional",
  "auth.sec.verify.title": "Cuándo pedir una verificación adicional",
  "auth.sec.verify.subtitle":
    "Algunas acciones pueden pedirte que demuestres que eres tú una segunda vez, incluso con la sesión ya iniciada. Elige cuáles.",
  "auth.sec.verify.scope.settings": "Cambiar los ajustes de seguridad",
  "auth.sec.verify.scope.settings_hint":
    "Contraseñas, passkeys, el segundo factor y esta misma página.",
  "auth.sec.verify.scope.other": "{scope}",
  "auth.sec.verify.toggle_label": "Verificación adicional para: {scope}",
  "auth.sec.verify.on": "Preguntarme",
  "auth.sec.verify.off": "No preguntar",
  "auth.sec.verify.disable_note":
    "Para desactivarlo, primero tendrás que confirmar que eres tú.",
  "auth.sec.verify.empty": "Aquí no hay nada que elegir",
  "auth.sec.verify.empty_hint":
    "Esta aplicación no ha publicado ninguna acción sobre la que puedas decidir. Todo sigue sus reglas predeterminadas.",
  "auth.sec.verify.default": "Sigue el valor predeterminado de la aplicación",

  // ── Operator console ─────────────────────────────────────────────────────
  "auth.admin.sso.title": "SSO corporativo",
  "auth.admin.sso.subtitle":
    "Organizaciones cuyo personal inicia sesión a través de su propio proveedor de identidad.",
  "auth.admin.sso.empty": "Todavía no hay organizaciones",
  "auth.admin.sso.empty_hint":
    "Añade una para dirigir el dominio de correo de una empresa a su propio proveedor de identidad.",
  "auth.admin.sso.add": "Añadir una organización",
  "auth.admin.sso.name_label": "Nombre de la organización",
  "auth.admin.sso.slug_label": "Identificador corto",
  "auth.admin.sso.slug_hint":
    "Aparece en la URL de inicio de sesión. Letras, cifras y guiones.",
  "auth.admin.sso.domain_label": "Dominio de correo",
  "auth.admin.sso.domain_hint":
    "Todas las direcciones de este dominio se dirigen aquí.",
  "auth.admin.sso.enforced_label": "Exigir SSO para este dominio",
  "auth.admin.sso.enforced_on": "SSO obligatorio",
  "auth.admin.sso.enforced_off": "SSO opcional",
  "auth.admin.sso.created_on": "Añadida el {date}",
  "auth.admin.sso.save": "Guardar",
  "auth.admin.sso.cancel": "Cancelar",
  "auth.admin.sso.edit": "Editar",
  "auth.admin.sso.edit_label": "Editar {name}",
  "auth.admin.sso.delete": "Quitar",
  "auth.admin.sso.delete_label": "Quitar {name}",
  "auth.admin.sso.delete_confirm_title": "¿Quitar {name}?",
  "auth.admin.sso.delete_confirm_body":
    "Todo el que use este dominio pierde su ruta de SSO y tendrá que iniciar sesión de otra forma.",
  "auth.admin.sso.config_title": "Proveedor de identidad",
  "auth.admin.sso.configure": "Proveedor de identidad",
  "auth.admin.sso.protocol_label": "Protocolo",
  "auth.admin.sso.protocol_saml": "SAML 2.0",
  "auth.admin.sso.protocol_oidc": "OpenID Connect",
  "auth.admin.sso.active_label": "Conexión activa",
  "auth.admin.sso.saml_entity_id": "Entity ID (emisor)",
  "auth.admin.sso.saml_sso_url": "URL de inicio de sesión",
  "auth.admin.sso.saml_slo_url": "URL de cierre de sesión",
  "auth.admin.sso.saml_cert": "Certificado de firma",
  "auth.admin.sso.saml_name_id": "Formato del Name ID",
  "auth.admin.sso.attr_email": "Atributo de correo",
  "auth.admin.sso.attr_first_name": "Atributo de nombre",
  "auth.admin.sso.attr_last_name": "Atributo de apellidos",
  "auth.admin.sso.oidc_client_id": "Client ID",
  "auth.admin.sso.oidc_client_secret": "Client secret",
  "auth.admin.sso.oidc_discovery": "URL de discovery",
  "auth.admin.sso.oidc_scopes": "Ámbitos",
  "auth.admin.sso.config_new":
    "Al guardar se reemplaza toda la conexión de esta organización con su proveedor de identidad. Los valores actuales no se pueden mostrar: la API no permite leerlos.",
  "auth.admin.keys.title": "Claves de servicio",
  "auth.admin.keys.subtitle":
    "Credenciales para máquinas: scripts, integraciones y otros servicios que llaman a esta API.",
  "auth.admin.keys.empty": "Todavía no hay claves de servicio",
  "auth.admin.keys.empty_hint":
    "Emite una para que un script pueda llamar a la API sin la sesión de una persona.",
  "auth.admin.keys.issue": "Emitir una clave",
  "auth.admin.keys.name_label": "Nombre",
  "auth.admin.keys.description_label": "¿Para qué sirve?",
  "auth.admin.keys.endpoints_label": "Endpoints permitidos",
  "auth.admin.keys.endpoints_hint":
    "Una ruta por línea. Déjalo vacío para permitir todos los endpoints a los que lleguen los permisos de esta clave.",
  "auth.admin.keys.endpoints_all": "Todos los endpoints",
  "auth.admin.keys.endpoints_count": "{count} endpoints permitidos",
  "auth.admin.keys.created_on": "Emitida el {date}",
  "auth.admin.keys.last_used": "Último uso {date}",
  "auth.admin.keys.never_used": "Nunca usada",
  "auth.admin.keys.active": "Activa",
  "auth.admin.keys.inactive": "Desactivada",
  "auth.admin.keys.disable": "Desactivar",
  "auth.admin.keys.enable": "Activar",
  "auth.admin.keys.delete": "Eliminar",
  "auth.admin.keys.delete_label": "Eliminar {name}",
  "auth.admin.keys.delete_confirm_title": "¿Eliminar {name}?",
  "auth.admin.keys.delete_confirm_body":
    "Todo lo que siga usando esta clave dejará de funcionar de inmediato. Desactívala en su lugar si prefieres comprobarlo antes.",
  "auth.admin.keys.secret_title": "Copia esta clave ahora",
  "auth.admin.keys.secret_hint":
    "Es la única vez que se muestra. Guárdala donde vaya a leerla quien la use.",
  "auth.admin.keys.secret_copy": "Copiar",
  "auth.admin.keys.secret_copied": "Copiada",
  "auth.admin.keys.secret_done": "Ya la he guardado",
  "auth.admin.keys.cancel": "Cancelar",
  "auth.admin.roles.title": "Roles de personal",
  "auth.admin.roles.subtitle":
    "Quién tiene acceso elevado y quién se lo concedió.",
  "auth.admin.roles.empty": "Nadie tiene un rol de personal",
  "auth.admin.roles.empty_hint":
    "Asigna uno para que un compañero llegue a las pantallas de operador.",
  "auth.admin.roles.assign": "Asignar un rol",
  "auth.admin.roles.user_label": "Identificador de usuario",
  "auth.admin.roles.user_hint": "El UUID de la cuenta, copiado de su perfil.",
  "auth.admin.roles.role_label": "Rol",
  "auth.admin.roles.role_hint":
    "El nombre del rol tal y como lo escribe esta instalación.",
  "auth.admin.roles.filter_label": "Mostrar solo una cuenta",
  "auth.admin.roles.filter_clear": "Mostrar todas",
  "auth.admin.roles.assigned_by": "Asignado por {who}",
  "auth.admin.roles.assigned_by_system": "Asignado por el sistema",
  "auth.admin.roles.assigned_on": "el {date}",
  "auth.admin.roles.user_row": "Cuenta {id}",
  "auth.admin.roles.remove": "Quitar",
  "auth.admin.roles.remove_label": "Quitar el rol {role} de la cuenta {id}",
  "auth.admin.roles.remove_confirm_title": "¿Quitar el rol {role}?",
  "auth.admin.roles.remove_confirm_body":
    "Esta cuenta perderá las pantallas de operador que abre ese rol en su próxima petición.",
  "auth.admin.roles.cancel": "Cancelar",
  "auth.admin.users.title": "Crear una cuenta",
  "auth.admin.users.subtitle":
    "Dar de alta una cuenta directamente: sin registro y sin código que introducir.",
  "auth.admin.users.email_label": "Correo electrónico",
  "auth.admin.users.phone_label": "Teléfono",
  "auth.admin.users.username_label": "Nombre de usuario",
  "auth.admin.users.display_name_label": "Nombre visible",
  "auth.admin.users.password_label": "Contraseña temporal",
  "auth.admin.users.password_hint":
    "Déjalo vacío para crear la cuenta sin contraseña: entrará con un código.",
  "auth.admin.users.send_welcome": "Enviar un mensaje de bienvenida",
  "auth.admin.users.send_welcome_hint":
    "Envía un correo o un SMS avisando de que la cuenta existe.",
  "auth.admin.users.mark_verified":
    "Considerar verificados los datos de contacto",
  "auth.admin.users.mark_verified_hint":
    "Desactívalo para que confirme la dirección por su cuenta.",
  "auth.admin.users.submit": "Crear la cuenta",
  "auth.admin.users.needs_contact":
    "Indica al menos un correo o un teléfono.",
  "auth.admin.users.created": "Cuenta creada.",
  "auth.admin.users.created_id": "Identificador de usuario {id}",
  "auth.admin.users.another": "Crear otra",
  "auth.admin.audit.title": "Registro de auditoría",
  "auth.admin.audit.subtitle":
    "La actividad de seguridad de todas las cuentas, de la más reciente a la más antigua.",
  "auth.admin.audit.empty": "No hay coincidencias",
  "auth.admin.audit.empty_hint": "Amplía las fechas o borra los filtros.",
  "auth.admin.audit.filter_event": "Tipo de evento",
  "auth.admin.audit.filter_user": "Identificador de usuario",
  "auth.admin.audit.filter_from": "Desde",
  "auth.admin.audit.filter_to": "Hasta",
  "auth.admin.audit.apply": "Aplicar",
  "auth.admin.audit.clear": "Borrar los filtros",
  "auth.admin.audit.actor": "Cuenta {id}",
  "auth.admin.audit.count": "{count} eventos",
  "auth.admin.forbidden.title": "Esta consola no está abierta para tu cuenta",
  "auth.admin.forbidden.hint":
    "Tu rol no incluye esta área, así que aquí no se puede leer ni cambiar nada. Un administrador puede concederla — reintentar no cambiará la respuesta.",
  "auth.admin.forbidden.reason": "Tu rol no incluye esta área.",
  "auth.nav.admin_sso": "SSO corporativo",
  "auth.nav.admin_service_keys": "Claves de servicio",
  "auth.nav.admin_staff_roles": "Roles de personal",
  "auth.nav.admin_users": "Crear cuenta",
  "auth.nav.admin_audit": "Registro de auditoría",
};

/**
 * Register the pair's `es` locale into a core i18n engine (call once at
 * startup, after {@link registerAuthI18n}). Layers per the merge-priority
 * convention (i18n-shipping.md §3): the en floor is registered UNDER the es
 * texts inside the `es` locale, so a key the es bundle ever misses degrades to
 * its English text — never to a raw key. A host bundle registered after this
 * call overrides both.
 */
export function registerAuthI18nEs(engine: I18nEngine): void {
  engine.registerBundle("es", authI18nBundleEn);
  engine.registerBundle("es", authI18nBundleEs);
}
