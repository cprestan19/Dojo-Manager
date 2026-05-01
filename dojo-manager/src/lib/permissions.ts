// Keys de navegación — identificadores únicos por ítem del menú
export const NAV_KEYS = {
  DASHBOARD:       "dashboard",
  STUDENTS:        "students",
  ATTENDANCE:      "attendance",
  PAYMENTS:        "payments",
  BELTS:           "belts",
  REPORTS:         "reports",
  SCHEDULES:       "schedules",
  USERS:           "users",
  DOJOS:           "dojos",           // solo sysadmin
  SETTINGS_GENERAL:"settings.general",
  SETTINGS_KATAS:  "settings.katas",
  SETTINGS_VIDEOS: "settings.videos",
  SETTINGS_EMAIL:  "settings.email",
  SETTINGS_ROLES:  "settings.roles",
  KATAS_CATALOG:   "katas",
} as const;

export type NavKey = typeof NAV_KEYS[keyof typeof NAV_KEYS];

// Todos los keys disponibles para dojo (excluye "dojos" que es solo sysadmin)
export const ALL_DOJO_KEYS: NavKey[] = [
  NAV_KEYS.DASHBOARD,
  NAV_KEYS.STUDENTS,
  NAV_KEYS.ATTENDANCE,
  NAV_KEYS.PAYMENTS,
  NAV_KEYS.BELTS,
  NAV_KEYS.REPORTS,
  NAV_KEYS.SCHEDULES,
  NAV_KEYS.USERS,
  NAV_KEYS.SETTINGS_GENERAL,
  NAV_KEYS.SETTINGS_KATAS,
  NAV_KEYS.SETTINGS_VIDEOS,
  NAV_KEYS.SETTINGS_EMAIL,
  NAV_KEYS.SETTINGS_ROLES,
  NAV_KEYS.KATAS_CATALOG,
];

// Permisos del sysadmin SIN dojo activo — solo gestión global de la plataforma
export const SYSADMIN_NO_DOJO_PERMS: NavKey[] = [
  NAV_KEYS.DASHBOARD,
  NAV_KEYS.DOJOS,
  NAV_KEYS.USERS,
  NAV_KEYS.SETTINGS_EMAIL,
];

// Permisos del admin: puede gestionar su dojo pero NO configurar
// email SMTP, roles/accesos ni crear/editar katas (solo sysadmin)
export const ADMIN_KEYS: NavKey[] = ALL_DOJO_KEYS.filter(k =>
  k !== NAV_KEYS.SETTINGS_EMAIL &&
  k !== NAV_KEYS.SETTINGS_ROLES &&
  k !== NAV_KEYS.SETTINGS_KATAS,
);

// Permisos por defecto cuando no hay registro en DojoRolePermission
export const DEFAULT_PERMISSIONS: Record<string, NavKey[]> = {
  sysadmin: [...ALL_DOJO_KEYS, NAV_KEYS.DOJOS],
  admin:    ADMIN_KEYS,
  user: [
    NAV_KEYS.DASHBOARD,
    NAV_KEYS.STUDENTS,
    NAV_KEYS.ATTENDANCE,
    NAV_KEYS.BELTS,
    NAV_KEYS.SCHEDULES,
    NAV_KEYS.KATAS_CATALOG,
  ],
};

// Etiqueta amigable para cada key
export const NAV_KEY_LABELS: Record<NavKey, string> = {
  "dashboard":        "Inicio",
  "students":         "Alumnos",
  "attendance":       "Asistencia",
  "payments":         "Pagos",
  "belts":            "Rangos",
  "reports":          "Reportes",
  "schedules":        "Horarios",
  "users":            "Usuarios",
  "dojos":            "Gestión de Dojos",
  "settings.general": "Conf. General",
  "settings.katas":   "Katas",
  "settings.videos":  "Videos por Cinta",
  "settings.email":   "Correo SMTP",
  "settings.roles":   "Roles y Accesos",
  "katas":            "Catálogo Katas",
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

// Resolve permissions: DB record > default > empty
export function resolvePermissions(
  role: string,
  dbRecord?: { permissions: unknown } | null,
): Set<NavKey> {
  if (role === "sysadmin") return new Set([...ALL_DOJO_KEYS, NAV_KEYS.DOJOS]);
  if (dbRecord?.permissions) {
    const raw = dbRecord.permissions;
    if (Array.isArray(raw)) return new Set(raw as NavKey[]);
  }
  return new Set(DEFAULT_PERMISSIONS[role] ?? DEFAULT_PERMISSIONS.user);
}
