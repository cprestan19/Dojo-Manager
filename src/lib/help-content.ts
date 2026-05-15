export interface HelpContent {
  title:       string;
  emoji:       string;
  description: string;
  steps:       string[];
  tips?:       string[];
}

export const HELP_CONTENT: Record<string, HelpContent> = {

  "/dashboard": {
    title:       "Panel de Control",
    emoji:       "🏠",
    description: "Vista general del dojo con métricas clave y alertas.",
    steps: [
      "Las tarjetas superiores muestran alumnos activos, pagos cobrados y pendientes.",
      "El gráfico de asistencia muestra el porcentaje diario de la semana seleccionada. Usa las flechas para navegar semanas.",
      "La lista 'Alumnos Recientes' muestra los últimos registrados.",
      "Si ves una alerta de pagos o ausencias, haz clic para ver el detalle.",
    ],
    tips: [
      "Las alertas de pago y ausencia también aparecen en la campana 🔔 del header.",
      "El gráfico se actualiza en tiempo real al registrar asistencia.",
    ],
  },

  "/dashboard/students": {
    title:       "Alumnos",
    emoji:       "👥",
    description: "Gestión completa del padrón de alumnos del dojo.",
    steps: [
      "Usa el buscador para filtrar por nombre en tiempo real.",
      "Los botones Activos / Todos / Inactivos cambian qué alumnos se muestran.",
      "Filtra por color de cinta haciendo clic en las pastillas de colores.",
      "El filtro 'Portal' muestra quién tiene o no acceso al portal del alumno.",
      "Haz clic en el ícono 👁 para ver el perfil completo, o ✏ para editar.",
      "Ordena cualquier columna haciendo clic en su encabezado.",
    ],
    tips: [
      "Los alumnos inactivos aparecen con menor opacidad y no se muestran por defecto.",
      "Desde el perfil del alumno puedes crear su acceso al portal, ver pagos y asistencia.",
      "El código QR del alumno se genera automáticamente para el scanner de asistencia.",
    ],
  },

  "/dashboard/attendance": {
    title:       "Control de Asistencia",
    emoji:       "📋",
    description: "Registro y consulta de entradas y salidas del dojo.",
    steps: [
      "Las marcaciones se registran automáticamente al escanear el QR del alumno.",
      "Usa el rango de fechas para consultar cualquier período.",
      "Filtra por tipo (Entrada/Salida) o por horario específico.",
      "Para corregir una marcación errónea, haz clic en el ícono ✏ de esa fila.",
      "Exporta el listado filtrado a CSV con el botón 'Exportar CSV'.",
    ],
    tips: [
      "El Scanner QR está disponible desde el botón del header o el sidebar.",
      "Las marcaciones corregidas quedan marcadas como 'Corregida' con tu usuario para auditoría.",
      "Puedes abrir el scanner en otra pantalla/tablet mientras consultas aquí.",
    ],
  },

  "/dashboard/payments": {
    title:       "Pagos",
    emoji:       "💳",
    description: "Gestión de pagos mensuales, mensualidades y cobros del dojo.",
    steps: [
      "Los pagos 'Atrasados' aparecen resaltados en rojo.",
      "Haz clic en un alumno para ver su historial de pagos completo.",
      "Usa 'Registrar pago' para marcar una mensualidad como cobrada.",
      "El filtro de estado (Pendiente/Atrasado/Pagado) facilita la gestión diaria.",
      "Los correos de recordatorio se envían automáticamente si está habilitado en Configuración.",
    ],
    tips: [
      "Configura la tolerancia de días y el interés por mora en Configuración → General.",
      "Activa los recordatorios automáticos en Configuración → Correo para ahorrar tiempo.",
    ],
  },

  "/dashboard/belts": {
    title:       "Cintas o Grados",
    emoji:       "🥋",
    description: "Registro de ascensos de grado y visualización por nivel.",
    steps: [
      "Filtra alumnos por cinta usando las pastillas de colores en la parte superior.",
      "Para registrar un ascenso, entra al perfil del alumno y usa 'Registrar Grado'.",
      "El historial de grados de cada alumno queda registrado con fecha.",
      "La columna 'Katas requeridas' muestra los requisitos del siguiente grado.",
    ],
    tips: [
      "Los requisitos de kata por grado se configuran en Configuración → Katas.",
      "Puedes subir videos de kata de referencia en Configuración → Videos por Cinta.",
    ],
  },

  "/dashboard/tournaments": {
    title:       "Torneos",
    emoji:       "🏆",
    description: "Creación y gestión de torneos de Kumite y Kata.",
    steps: [
      "Crea un torneo con el botón 'Nuevo Torneo' y completa la información básica.",
      "En la pestaña Kumite, inscribe alumnos y genera el bracket con el botón 'Generar Bracket'.",
      "En la pestaña Kata, inscribe participantes para el orden de presentación.",
      "Registra los scores de cada match haciendo clic en el bracket.",
      "Una vez terminado, usa 'Archivar' para mover el torneo al historial.",
    ],
    tips: [
      "Un alumno puede participar en Kumite Y Kata simultáneamente.",
      "El bracket se puede reimprimir desde el ícono 🖨 en la vista de bracket.",
      "Los torneos archivados se ven en la pestaña 'Historial'.",
    ],
  },

  "/dashboard/events": {
    title:       "Eventos",
    emoji:       "📅",
    description: "Publicación de eventos visibles para los alumnos en su portal.",
    steps: [
      "Crea un evento con 'Nuevo Evento' y completa nombre, fechas, lugar e imagen.",
      "La imagen se sube directamente a la nube (Cloudinary) — acepta JPG, PNG, WEBP.",
      "Usa 'Vista previa' (ícono 👁) para ver cómo lo verán los alumnos antes de guardar.",
      "Los eventos activos se muestran automáticamente en el portal del alumno.",
      "Cuando la fecha de fin pasa, el evento se mueve solo a la pestaña 'Historial'.",
    ],
    tips: [
      "Puedes editar un evento en cualquier momento, incluso después de publicado.",
      "Los alumnos ven los eventos en su portal bajo la pestaña 'Eventos'.",
      "No hay límite de eventos activos simultáneos.",
    ],
  },

  "/dashboard/reports": {
    title:       "Reportes",
    emoji:       "📊",
    description: "Estadísticas y métricas de actividad del dojo.",
    steps: [
      "Selecciona el tipo de reporte en las pestañas superiores.",
      "Usa los filtros de fecha para acotar el período analizado.",
      "El reporte de Ranking muestra los alumnos con más asistencia.",
      "Exporta cualquier reporte a CSV para análisis externo.",
    ],
    tips: [
      "Los reportes se calculan en tiempo real sobre los datos actuales.",
      "El ranking de asistencia es útil para premiar constancia y motivar alumnos.",
    ],
  },

  "/dashboard/users": {
    title:       "Usuarios",
    emoji:       "🛡",
    description: "Gestión de usuarios con acceso al panel de administración.",
    steps: [
      "Crea usuarios con 'Nuevo Usuario' y asígnales un rol (Admin o Usuario).",
      "El rol determina qué módulos puede ver y usar cada usuario.",
      "Los permisos detallados se configuran en Configuración → Roles y Accesos.",
      "Un usuario puede ser vinculado a un alumno del dojo.",
      "Activa o desactiva usuarios desde su perfil sin eliminarlos.",
    ],
    tips: [
      "El primer acceso obliga al usuario a cambiar su contraseña.",
      "Para acceso al portal, el alumno necesita un usuario con rol 'student'.",
    ],
  },

  "/dashboard/settings": {
    title:       "Configuración General",
    emoji:       "⚙️",
    description: "Parámetros generales del dojo como nombre, logo y pagos.",
    steps: [
      "Actualiza el nombre, logo y slogan del dojo aquí.",
      "Configura los montos de mensualidad e inscripción por alumno.",
      "Define los días de tolerancia antes de marcar un pago como 'atrasado'.",
      "Activa o desactiva los recordatorios automáticos de pago.",
      "Cambia el tema visual del panel en el selector de apariencia del header.",
    ],
    tips: [
      "El logo se sube a Cloudinary y aparece en el sidebar y la pantalla de login.",
      "Los cambios de tema se aplican inmediatamente sin recargar la página.",
    ],
  },

  "/dashboard/settings/katas": {
    title:       "Katas",
    emoji:       "📖",
    description: "Catálogo de katas y sus requisitos por grado.",
    steps: [
      "Crea katas con nombre, descripción y el grado al que pertenecen.",
      "Puedes asignar hasta 5 katas a un mismo grado.",
      "Las katas aparecen como requisitos en el módulo de Cintas.",
      "Los alumnos pueden ver los videos de kata desde su portal.",
    ],
    tips: [
      "Sube videos de referencia en Configuración → Videos por Cinta.",
    ],
  },

  "/dashboard/settings/videos": {
    title:       "Videos por Cinta",
    emoji:       "🎥",
    description: "Videos de kata de referencia visibles para los alumnos.",
    steps: [
      "Sube un video por grado para que los alumnos practiquen.",
      "Los videos se almacenan en Cloudinary (máx. 200 MB por video).",
      "El alumno accede a su video de grado desde el portal → Videos.",
    ],
    tips: [
      "Formatos aceptados: MP4, WebM, MOV.",
      "Solo se muestra el video del grado actual del alumno.",
    ],
  },

  "/dashboard/settings/email": {
    title:       "Correo y Notificaciones",
    emoji:       "✉️",
    description: "Configuración del servidor SMTP para envío de correos.",
    steps: [
      "Ingresa los datos de tu servidor SMTP (host, puerto, usuario, contraseña).",
      "Usa 'Enviar correo de prueba' para verificar que la configuración es correcta.",
      "Activa los recordatorios automáticos de pago desde Configuración → General.",
    ],
    tips: [
      "Puedes usar Gmail con una contraseña de aplicación, o servicios como SendGrid.",
      "Sin configuración SMTP los correos automáticos no se envían.",
    ],
  },

  "/dashboard/settings/roles": {
    title:       "Roles y Accesos",
    emoji:       "🔐",
    description: "Permisos granulares por rol para cada módulo del sistema.",
    steps: [
      "Selecciona un rol (Admin o Usuario) para ver o editar sus permisos.",
      "Activa o desactiva cada módulo individualmente por rol.",
      "Los cambios se aplican la próxima vez que el usuario inicia sesión.",
    ],
    tips: [
      "El rol 'Sysadmin' siempre tiene acceso total y no se puede restringir.",
      "Un usuario sin permiso a un módulo no verá ese ítem en el menú.",
    ],
  },

  "/dashboard/dojos": {
    title:       "Gestión de Dojos",
    emoji:       "🏢",
    description: "Administración global de todos los dojos de la plataforma.",
    steps: [
      "Crea un nuevo dojo con 'Nuevo Dojo' e ingresa nombre y datos del propietario.",
      "Activa o desactiva dojos desde la tabla.",
      "Haz clic en el nombre de un dojo para entrar en su contexto y administrarlo.",
      "Desde 'Entrar como' puedes gestionar cualquier dojo como si fueras su admin.",
    ],
    tips: [
      "Solo los Sysadmin pueden ver y gestionar esta sección.",
      "Al entrar en un dojo aparece una barra naranja indicando el contexto activo.",
    ],
  },

  "/dashboard/audit-log": {
    title:       "Log de Auditoría",
    emoji:       "📜",
    description: "Registro cronológico de acciones importantes realizadas en el sistema.",
    steps: [
      "Cada fila muestra quién hizo qué acción y cuándo.",
      "Filtra por usuario, tipo de acción o rango de fechas.",
      "Las acciones destructivas (eliminar, corregir) siempre quedan registradas.",
    ],
    tips: [
      "El log no se puede modificar ni eliminar — sirve como registro de auditoría.",
      "Solo visible para Sysadmin.",
    ],
  },

  "/dashboard/leads": {
    title:       "Prospectos",
    emoji:       "🎯",
    description: "CRM de solicitudes de clase de prueba que llegan desde tu página pública.",
    steps: [
      "Cuando alguien llena el formulario en tu página pública, aparece aquí automáticamente en estado 'Pendiente'.",
      "Haz clic en el estado (Pendiente, Contactado, etc.) para cambiar el progreso del prospecto.",
      "Usa el ícono de WhatsApp para escribirle directamente al padre/madre con un mensaje pre-cargado.",
      "Agrega notas internas con el ícono 📝 — solo las ve el admin, el prospecto no las ve.",
      "Cuando el niño se inscribe, haz clic en 'Inscribir' para crear su ficha de alumno con los datos pre-cargados.",
      "Una vez inscrito, cambia el estado a 'Inscrito' para llevar el seguimiento.",
    ],
    tips: [
      "Las tarjetas superiores muestran cuántos prospectos hay en cada etapa — clic en una para filtrar.",
      "El módulo marca automáticamente como 'leídos' los prospectos cuando abres la página.",
      "Puedes eliminar un prospecto si fue un error o ya no aplica.",
    ],
  },

  "/dashboard/settings/public-page": {
    title:       "Página Pública",
    emoji:       "🌐",
    description: "Editor completo de la página web de marketing de tu dojo. Configura todo el contenido que verán tus visitantes en internet.",
    steps: [
      "PUBLICAR: Activa el toggle 'Publicar' para que la página sea visible. Con 'Ver vista previa' puedes verla antes de publicar sin que nadie más la vea.",
      "HERO: Escribe un título llamativo y subtítulo. Sube una foto de fondo impactante del dojo (recomendado: horizontal, mínimo 1200px).",
      "SOBRE NOSOTROS: Historia del dojo, valores y filosofía. Agrega una foto del espacio o del equipo entrenando.",
      "PERFIL DEL SENSEI: Haz clic en 'Agregar Sensei', sube su foto circular, nombre completo, grado (ej. Cinturón Negro 5° Dan) y una biografía. Aparece entre 'Sobre nosotros' y 'Horarios'.",
      "ESTADÍSTICAS: Agrega hasta 4 números clave (ej. '150+ Alumnos', '10 Años de experiencia'). Aparecen debajo del hero como barra de confianza.",
      "TESTIMONIOS: Agrega hasta 6 testimonios de alumnos con nombre, rol/cinta y su frase. La foto es opcional.",
      "GALERÍA DE ATLETAS: Sube hasta 12 fotos de entrenamientos o competencias. Se muestran en mosaico con efecto zoom al hacer clic.",
      "UBICACIÓN: Escribe la dirección del dojo. Aparece con un botón 'Ver en Google Maps' y otro de WhatsApp.",
      "TIENDA: Activa el toggle 'Mostrar tienda' si quieres que los productos aparezcan. Los productos se gestionan desde el menú Tienda.",
      "SECCIONES VISIBLES: Activa o desactiva: Horarios, Formulario de clase gratuita, Contacto, Tienda.",
      "COLOR DE ACENTO: Elige el color principal de tu marca. Aplica a botones, títulos y detalles de toda la página.",
      "Haz clic en 'Guardar cambios' y usa 'Ver vista previa' para revisar antes de compartir.",
    ],
    tips: [
      "El botón 'Entrar' en el nav de la página pública permite a tus alumnos y usuarios acceder a su portal exclusivo.",
      "El WhatsApp, email, teléfono e Instagram se configuran en Configuración → General.",
      "Los horarios de la página pública son los creados en el módulo Horarios del dashboard.",
      "Las solicitudes de clase gratuita llegan a Prospectos en el dashboard — con nombre, teléfono y horario sugerido.",
      "La galería tiene lightbox: los visitantes hacen clic en una foto y se abre en pantalla completa.",
      "El botón sticky 'Clase Gratuita' aparece en la parte inferior del celular para los visitantes móviles.",
      "Los testimonios muestran 5 estrellas y la foto del alumno o su inicial si no tiene foto.",
      "Puedes despublicar la página en cualquier momento sin perder el contenido configurado.",
      "Comparte el enlace en Instagram, WhatsApp y cualquier red social para atraer nuevos alumnos.",
    ],
  },

};

export function getHelpContent(pathname: string): HelpContent | null {
  if (HELP_CONTENT[pathname]) return HELP_CONTENT[pathname];
  // Coincidencia por prefijo (rutas dinámicas como /dashboard/students/[id])
  const keys = Object.keys(HELP_CONTENT).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (pathname.startsWith(key + "/") || pathname === key) return HELP_CONTENT[key];
  }
  return null;
}
