// Keys de navegación — identificadores únicos por ítem del menú
export const NAV_KEYS = {
  DASHBOARD:       "dashboard",
  STUDENTS:        "students",
  ATTENDANCE:      "attendance",
  PAYMENTS:        "payments",
  BELTS:           "belts",
  TOURNAMENTS:     "tournaments",
  REPORTS:         "reports",
  SCHEDULES:       "schedules",
  USERS:           "users",
  DOJOS:           "dojos",           // solo sysadmin
  AUDIT_LOG:       "audit-log",       // solo sysadmin
  SETTINGS_GENERAL:"settings.general",
  SETTINGS_KATAS:  "settings.katas",
  SETTINGS_VIDEOS: "settings.videos",
  SETTINGS_EMAIL:  "settings.email",
  SETTINGS_ROLES:  "settings.roles",
  SETTINGS_IMPORT: "settings.import",
  SETTINGS_CARD:   "settings.card",
  KATAS_CATALOG:   "katas",
  TOURNAMENT_EVENTS: "tournament-events",  // Asistencia a Torneos (independiente de Torneo Pro)
  EVENTS:          "events",
  LEADS:           "leads",
  PUBLIC_PAGE:     "public-page",
  STORE:           "store",
  REGISTROS:       "registros",
  POSTULACIONES:   "postulaciones",
  CERTIFICADOS:    "certificados",
  SETTINGS_TERMS:  "settings.terms",
  SETTINGS_PUSH:   "settings.push",
  // No es un ítem de navegación del dashboard — se usa como feature-key de
  // Plan para decidir si los alumnos de un dojo pueden entrar a /portal.
  PORTAL_ACCESS:   "portal-access",
} as const;

export type NavKey = typeof NAV_KEYS[keyof typeof NAV_KEYS];

// Todos los keys disponibles para dojo (excluye "dojos" que es solo sysadmin)
export const ALL_DOJO_KEYS: NavKey[] = [
  NAV_KEYS.DASHBOARD,
  NAV_KEYS.STUDENTS,
  NAV_KEYS.ATTENDANCE,
  NAV_KEYS.PAYMENTS,
  NAV_KEYS.BELTS,
  // TOURNAMENTS eliminado: la gestión de torneos está en Torneo Pro (feature-gated)
  NAV_KEYS.REPORTS,
  NAV_KEYS.SCHEDULES,
  NAV_KEYS.USERS,
  NAV_KEYS.SETTINGS_GENERAL,
  NAV_KEYS.SETTINGS_KATAS,
  NAV_KEYS.SETTINGS_VIDEOS,
  NAV_KEYS.SETTINGS_EMAIL,
  NAV_KEYS.SETTINGS_ROLES,
  NAV_KEYS.SETTINGS_IMPORT,
  NAV_KEYS.SETTINGS_CARD,
  NAV_KEYS.TOURNAMENT_EVENTS,
  NAV_KEYS.EVENTS,
  NAV_KEYS.LEADS,
  NAV_KEYS.PUBLIC_PAGE,
  NAV_KEYS.STORE,
  NAV_KEYS.REGISTROS,
  NAV_KEYS.POSTULACIONES,
  NAV_KEYS.CERTIFICADOS,
  NAV_KEYS.SETTINGS_TERMS,
  NAV_KEYS.SETTINGS_PUSH,
];

// Permisos del sysadmin SIN dojo activo — solo gestión global de la plataforma
export const SYSADMIN_NO_DOJO_PERMS: NavKey[] = [
  NAV_KEYS.DASHBOARD,
  NAV_KEYS.DOJOS,
  NAV_KEYS.USERS,
  NAV_KEYS.AUDIT_LOG,
  NAV_KEYS.SETTINGS_EMAIL,
];

// Permisos del admin: puede gestionar su dojo pero NO configurar
// email SMTP, roles/accesos ni crear/editar katas (solo sysadmin)
export const ADMIN_KEYS: NavKey[] = ALL_DOJO_KEYS.filter(k =>
  k !== NAV_KEYS.SETTINGS_EMAIL &&
  k !== NAV_KEYS.SETTINGS_ROLES,
);

// Permisos por defecto cuando no hay registro en DojoRolePermission
export const DEFAULT_PERMISSIONS: Record<string, NavKey[]> = {
  sysadmin: [...ALL_DOJO_KEYS, NAV_KEYS.DOJOS],
  admin:    ADMIN_KEYS,
  user: [
    // DASHBOARD excluido: el rol user no ve el inicio/métricas
    // STUDENTS: solo admin/sysadmin — el rol user no ve alumnos
    NAV_KEYS.ATTENDANCE,
    NAV_KEYS.TOURNAMENT_EVENTS,
    NAV_KEYS.BELTS,
    NAV_KEYS.SCHEDULES,
  ],
};

// Etiqueta amigable para cada key
export const NAV_KEY_LABELS: Record<NavKey, string> = {
  "dashboard":        "Inicio",
  "students":         "Alumnos",
  "attendance":       "Asistencia",
  "payments":         "Pagos",
  "belts":            "Rangos",
  "tournaments":      "Torneos",
  "reports":          "Reportes",
  "schedules":        "Horarios",
  "users":            "Usuarios",
  "dojos":            "Gestión de Dojos",
  "audit-log":        "Log de Auditoría",
  "settings.general": "Conf. General",
  "settings.katas":   "Katas",
  "settings.videos":  "Videos por Cinta",
  "settings.email":   "Correo SMTP",
  "settings.roles":   "Roles y Accesos",
  "settings.import":  "Importar Alumnos",
  "settings.card":    "Diseño de Carnet",
  "katas":            "Catálogo Katas",
  "tournament-events": "Asistencia de Eventos",
  "events":           "Eventos",
  "leads":            "Prospectos",
  "public-page":      "Página Pública",
  "store":            "Tienda",
  "registros":        "Auto-registro",
  "postulaciones":    "Postulaciones",
  "certificados":     "Certificados",
  "settings.terms":   "Políticas y Términos",
  "settings.push":    "Notificaciones Push",
  "portal-access":    "Portal de Alumnos",
};

export const ROLE_COLORS = [
  { value: "blue",   label: "Azul"    },
  { value: "green",  label: "Verde"   },
  { value: "yellow", label: "Amarillo"},
  { value: "purple", label: "Morado"  },
  { value: "red",    label: "Rojo"    },
  { value: "orange", label: "Naranja" },
];

export const BADGE_BY_COLOR: Record<string, string> = {
  blue:   "badge-blue",
  green:  "badge-green",
  yellow: "badge-yellow",
  purple: "badge-gold",
  red:    "badge-red",
  orange: "badge-yellow",
};

// Keys añadidas a ADMIN_KEYS después del despliegue inicial.
// Se auto-incluyen en registros DB existentes para que nuevas funciones
// aparezcan sin que el admin deba re-guardar sus permisos.
const NEWLY_ADDED_FOR_ADMIN: NavKey[] = [
  NAV_KEYS.SETTINGS_CARD,
  NAV_KEYS.REGISTROS,
  NAV_KEYS.POSTULACIONES,
  NAV_KEYS.CERTIFICADOS,
  NAV_KEYS.SETTINGS_PUSH,
];

// Resolve permissions: DB record > default > empty
export function resolvePermissions(
  role: string,
  dbRecord?: { permissions: unknown } | null,
): Set<NavKey> {
  if (role === "sysadmin") return new Set([...ALL_DOJO_KEYS, NAV_KEYS.DOJOS, NAV_KEYS.AUDIT_LOG]);

  let perms: Set<NavKey>;
  if (dbRecord?.permissions && Array.isArray(dbRecord.permissions)) {
    perms = new Set(dbRecord.permissions as NavKey[]);
    // Auto-incluir claves nuevas que no existían cuando se guardó el registro
    if (role === "admin") {
      for (const key of NEWLY_ADDED_FOR_ADMIN) perms.add(key);
    }
  } else {
    perms = new Set(DEFAULT_PERMISSIONS[role] ?? DEFAULT_PERMISSIONS.user);
  }

  // El rol "user" nunca puede ver Dashboard — se elimina incluso si está
  // guardado explícitamente en DojoRolePermission (sin modificar la BD)
  if (role === "user") perms.delete(NAV_KEYS.DASHBOARD);

  return perms;
}
