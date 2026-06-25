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
      "Pasa el cursor sobre un punto del gráfico para ver el detalle: entradas, salidas y desglose por horario de clase.",
      "La lista 'Alumnos Recientes' muestra los últimos registrados.",
      "Si ves una alerta de pagos o ausencias, haz clic para ver el detalle.",
    ],
    tips: [
      "Las alertas de pago y ausencia también aparecen en la campana 🔔 del header.",
      "El gráfico se actualiza en tiempo real al registrar asistencia.",
      "El tooltip del gráfico muestra cuántos alumnos únicos marcaron entrada (verde) y salida (rojo) cada día, más el desglose por turno.",
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
      "Las marcaciones se registran automáticamente al escanear el QR del alumno desde el Scanner.",
      "Las tarjetas superiores muestran el total de marcaciones, entradas y salidas del período.",
      "Usa el rango de fechas para consultar cualquier período. Por defecto muestra el día de hoy.",
      "Filtra por tipo (Entrada/Salida) o por horario específico para ver solo las marcaciones de una clase.",
      "Para corregir una marcación errónea, haz clic en el ícono ✏ — puedes cambiar el tipo, la fecha/hora y el horario asociado.",
      "Exporta el listado filtrado a Excel (.xlsx) con el botón 'Exportar Excel'. El archivo incluye código, alumno, cinta, tipo, fecha, hora, horario, nota y estado.",
    ],
    tips: [
      "El Scanner QR está disponible desde el botón 'Scanner' del header o el sidebar.",
      "Las marcaciones corregidas quedan marcadas como 'Corregida' con tu usuario para auditoría.",
      "La fecha y hora de cada marcación se registra automáticamente al escanear — no se puede adelantar ni cambiar desde el scanner.",
      "El archivo Excel tiene headers con formato, autofiltro y está listo para imprimir o analizar.",
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

  "/dashboard/schedules": {
    title:       "Horarios de Clases",
    emoji:       "🕐",
    description: "Gestión de los horarios de clase del dojo y asignación de alumnos a cada turno.",
    steps: [
      "Cada horario aparece como una fila colapsable. Haz clic en la fila para expandirla y ver los alumnos asignados.",
      "La fila muestra: nombre del horario, días de clase, hora, cantidad de alumnos y estado (Activo/Inactivo).",
      "Al expandir un horario, ves la lista de alumnos con su cinta, última entrada y última salida registrada.",
      "Usa 'Agregar alumnos' para asignar nuevos alumnos al horario. Los asignados aparecen primero en la lista.",
      "El toggle 'Todos / Asignados / Sin asignar' filtra la lista para encontrar alumnos rápidamente.",
      "Para quitar un alumno del horario, haz clic en el ícono ✕ junto a su nombre en la vista expandida.",
      "Activa el check 'Disponible para clase de prueba' si quieres que ese horario aparezca como opción en el formulario de clase gratuita de tu página pública.",
      "Edita o elimina un horario con los botones ✏ y 🗑 de la fila.",
    ],
    tips: [
      "Eliminar un horario NO borra las marcaciones de asistencia de los alumnos — sus registros se conservan siempre.",
      "Los horarios marcados como 'Prueba' (badge dorado) son los únicos que aparecen como opción en el formulario de clase gratuita de tu página web.",
      "Si no marcas ningún horario como 'disponible para prueba', el formulario de clase gratuita no mostrará selector de horario.",
      "La columna 'Horario actual' en el picker indica si el alumno ya está asignado a este horario, a otro, o a ninguno.",
      "Puedes filtrar por cinta en el picker para asignar alumnos de un nivel específico a un horario.",
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

  "/dashboard/tournament-events": {
    title:       "Asistencia de Torneos",
    emoji:       "🥋",
    description: "Control de asistencia y resultados para el día del torneo. Soporta múltiples escáneres simultáneos sin conflictos.",
    steps: [
      "Crea un evento con '+ Nuevo Torneo' — define nombre, fecha, sede e inscribe los alumnos que participarán.",
      "El día del torneo, abre el evento y usa el botón 'Escanear QR' para registrar llegadas con la cámara.",
      "El botón 'Agregar' (ícono de persona+) permite inscribir alumnos que se registraron a último momento sin perder los datos existentes.",
      "Haz clic en la tarjeta de cualquier alumno para abrir su panel de resultados: categoría, kata ejecutado, resultado de kata y kumite.",
      "Los resultados se sincronizan automáticamente al historial de competencias del alumno.",
      "La pantalla se actualiza automáticamente cada 6 segundos — varias personas pueden usar el sistema al mismo tiempo.",
      "Imprime la lista de participantes con el botón 'Lista' (ícono 🖨), o las estadísticas de medallas con 'Estadísticas'.",
      "Las tarjetas de estadísticas (Inscritos / Llegaron / Resultados) son clicables — úsalas como filtros rápidos.",
    ],
    tips: [
      "El escáner QR acepta el código del alumno aunque ya esté marcado — muestra 'Ya registrado' sin crear duplicados.",
      "Puedes buscar un alumno por nombre en el buscador superior para encontrarlo rápido entre muchos inscritos.",
      "Los filtros de la barra inferior (Todos / Llegaron / Con resultado / Pendiente) ayudan a ver quién falta por registrar.",
      "Los resultados de medalla (Oro, Plata, Bronce) quedan en el historial de competencias del alumno y aparecen en los reportes globales.",
      "El PDF de estadísticas solo incluye los resultados de ese torneo específico — no mezcla datos con otros eventos.",
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
      "HORARIOS DE PRUEBA: Para que el formulario de clase gratuita muestre un selector de horario, ve a Horarios de Clases y activa el check 'Disponible para clase de prueba' en los horarios que ofreces para pruebas.",
      "COLOR DE ACENTO: Elige el color principal de tu marca. Aplica a botones, títulos y detalles de toda la página.",
      "Haz clic en 'Guardar cambios' y usa 'Ver vista previa' para revisar antes de compartir.",
    ],
    tips: [
      "El botón 'Entrar' en el nav de la página pública permite a tus alumnos y usuarios acceder a su portal exclusivo.",
      "El WhatsApp, email, teléfono e Instagram se configuran en Configuración → General.",
      "Los horarios de la página pública son los creados en el módulo Horarios del dashboard.",
      "Las solicitudes de clase gratuita llegan a Prospectos en el dashboard — con nombre, teléfono y horario seleccionado.",
      "El formulario de clase gratuita solo muestra los horarios marcados como 'Disponible para prueba' en el módulo Horarios de Clases.",
      "La galería tiene lightbox: los visitantes hacen clic en una foto y se abre en pantalla completa.",
      "El botón sticky 'Clase Gratuita' aparece en la parte inferior del celular para los visitantes móviles.",
      "Los testimonios muestran 5 estrellas y la foto del alumno o su inicial si no tiene foto.",
      "Puedes despublicar la página en cualquier momento sin perder el contenido configurado.",
      "Comparte el enlace en Instagram, WhatsApp y cualquier red social para atraer nuevos alumnos.",
    ],
  },

  "/dashboard/tournaments-pro": {
    title:       "Torneo Pro",
    emoji:       "🏆",
    description: "Gestiona torneos completos de karate: brackets, tatamis, jueces, transmisión en vivo e inscripciones de clubs externos.",
    steps: [
      "Crea el torneo con '+ Nuevo Torneo' — define nombre, fecha, lugar y organización.",
      "Tab INFORMACIÓN: cambia el estado de 'Borrador' → 'Listo' con el selector junto al nombre. Elige el tipo: Interno (solo tus alumnos) o Abierto (clubs externos).",
      "Tab ATLETAS: crea las categorías (brackets) con el formulario WKF encadenado — Tipo → Género → Grupo de edad → Peso. El nombre se genera automáticamente.",
      "Tab ATLETAS: agrega participantes a cada bracket. Genera el cuadro con el botón 'Generar Bracket' (kumite) o 'Generar Orden' (kata).",
      "Tab TATAMIS & JUECES: crea los tatamis del evento, asigna jueces a cada tatami y configura el stream de YouTube por tatami.",
      "Tab EN VIVO: selecciona el 'Combate Activo' en el dropdown ★ de cada tatami — esto activa la pantalla TV, el overlay OBS y la app del juez.",
      "App del Juez: los jueces abren /tournament/[id]/judge en su celular y seleccionan su nombre para puntuar.",
      "Overlay OBS: copia la URL desde el tab EN VIVO o desde /tournament/[id]/overlay. En OBS: fuente Navegador, 1920×1080, fondo transparente.",
      "Tab INSCRIPCIONES (torneos abiertos): aprueba clubs, valida pagos y envía credenciales QR cuando todo esté confirmado.",
    ],
    tips: [
      "El estado 'Listo' o 'Activo' es necesario para que el overlay OBS muestre datos de combate.",
      "Para torneos abiertos: configura el Slug Público en el tab Información, activa la página pública y copia el link de inscripción para enviarlo a coaches externos.",
      "El PIN de acreditación (tab Información) protege la pantalla de entrada /tournament/[id]/tatami/[id]/accredit donde los voluntarios escanean QRs.",
      "El overlay OBS usa fondo transparente — en OBS activa 'Enable Background Transparency' en la fuente de navegador.",
      "Si el stream sale como 'Finalizado', usa el botón '↺ Reiniciar Stream' en el tab En Vivo.",
    ],
  },

  "/dashboard/tournaments-pro/new": {
    title:       "Crear Torneo",
    emoji:       "➕",
    description: "Configura los parámetros iniciales del torneo antes de comenzar.",
    steps: [
      "Ingresa el nombre del torneo, fecha, lugar y organización (p.ej. FEPAKA, WKF, Ryo-Bukai).",
      "El Líder 1 es el director técnico principal del evento — es obligatorio.",
      "Al guardar, el torneo queda en estado 'Borrador'. Puedes editarlo antes de publicarlo.",
    ],
    tips: [
      "El tipo de torneo (Interno/Abierto) se configura en el tab Información después de crearlo.",
      "Puedes cambiar el nombre y todos los datos antes de que el torneo esté 'Activo'.",
    ],
  },

  "/dashboard/tournaments-pro/": {
    title:       "Gestión del Torneo",
    emoji:       "🏅",
    description: "Panel central del torneo con todos los tabs de gestión.",
    steps: [
      "INFORMACIÓN: datos básicos + tipo de torneo + configuración para clubs externos.",
      "ATLETAS: crea brackets WKF y agrega participantes. El nombre de categoría se genera solo.",
      "KUMITE / KATA: visualiza y gestiona los brackets generados. Registra resultados de matches.",
      "TATAMIS & JUECES: configura los tatamis, asigna jueces y gestiona el stream por tatami.",
      "EN VIVO: controla el combate activo, el stream de YouTube y el overlay OBS.",
      "INSCRIPCIONES: gestiona clubs externos — aprueba, rechaza, valida pagos, envía credenciales QR.",
      "RESULTADOS: visualiza el bracket final con el campeón de cada categoría.",
    ],
    tips: [
      "El selector de estado (Borrador/Listo/Activo) está en el header del torneo, junto al nombre.",
      "Para que el overlay OBS funcione: estado debe ser 'Listo' o superior, y debe haber un combate activo seleccionado en el tatami.",
    ],
  },

  "/dashboard/settings/import": {
    title:       "Importar Alumnos",
    emoji:       "📥",
    description: "Carga masiva de alumnos desde un archivo Excel.",
    steps: [
      "Descarga la plantilla — tiene todos los campos con instrucciones en la segunda hoja",
      "Llena la hoja 'Alumnos' desde la fila 3 (la fila 2 es solo un ejemplo — puedes borrarla)",
      "Los campos en rojo son OBLIGATORIOS: Nombre Completo y Cédula",
      "Guarda el archivo como .xlsx y súbelo en esta página",
      "El sistema procesa y muestra un resumen: creados, omitidos (duplicados) y errores",
    ],
    tips: [
      "La cédula es la llave única — si ya existe en tu dojo, el alumno NO se duplica ni se actualiza",
      "Si la misma cédula existe en otro dojo, se crea igualmente (cada dojo está aislado)",
      "Los campos opcionales vacíos quedan en blanco — no causan error",
      "Después de importar, edita cada alumno individualmente para agregar su foto",
      "Descarga el Reporte CSV al final para guardar un registro de la importación",
      "Puedes importar hasta 500 alumnos por archivo Excel",
    ],
  },

  "/coach": {
    title:       "Portal del Coach",
    emoji:       "🥋",
    description: "Gestiona la inscripción de tu club en el torneo desde este portal privado.",
    steps: [
      "Tab 'Mis Atletas': agrega cada atleta con sus datos básicos. El sistema calcula automáticamente su grupo de edad (Cadete, Junior, Senior, etc.) según la fecha del torneo.",
      "Al agregar un atleta, selecciona las categorías en las que competirá. El sistema filtra solo las categorías compatibles con su edad, peso y género.",
      "Marca '★ Es atleta de Ranking' si el atleta tiene un título reciente — el organizador validará y asignará el seed en el bracket.",
      "Tab 'Pago': ingresa la referencia de transferencia y sube el comprobante de pago (imagen). El organizador debe confirmar el pago.",
      "Tab 'Estado': visualiza el progreso de tu inscripción — Pendiente → Aprobado → Pagado → Credenciales enviadas.",
      "Cuando el organizador apruebe y confirme el pago, recibirás un email con el código QR de acreditación de cada atleta.",
      "El día del torneo, presenta los QRs de tus atletas en la entrada para acreditarlos.",
    ],
    tips: [
      "Este enlace es válido por 30 días — guárdalo o revisa tu correo para acceder de nuevo. No lo compartas: es de acceso privado.",
      "Puedes agregar, editar o retirar atletas mientras las inscripciones estén abiertas (antes de la fecha de cierre).",
      "Si un atleta es rechazado, recibirás el motivo por email y podrás inscribirlo en otra categoría disponible.",
      "El peso que ingresas afecta qué categorías aparecen disponibles — si el atleta cambia de peso, edítalo antes del cierre.",
      "Los atletas con ranking validado aparecen con ★ en el bracket y se ubican en posiciones especiales para no enfrentarse hasta semifinal.",
    ],
  },

  "/portal/live": {
    title:       "En Vivo",
    emoji:       "📺",
    description: "Mira las transmisiones en vivo de los torneos de tu dojo.",
    steps: [
      "Verás una tarjeta por cada tatami que esté transmitiendo en este momento.",
      "Toca cualquier tarjeta para abrir la transmisión en vivo de YouTube.",
      "La calidad del video se ajusta automáticamente a tu conexión de internet.",
    ],
    tips: [
      "Esta sección solo muestra transmisiones de tu dojo — actualiza cada 30 segundos.",
      "Si no ves ninguna transmisión, el torneo puede que aún no haya comenzado o el stream no esté activo.",
      "La imagen de la tarjeta muestra el thumbnail del canal de YouTube — si el stream está activo, verás el video en vivo al entrar.",
    ],
  },

  "/tournament/review": {
    title:       "Video Review",
    emoji:       "📹",
    description: "Revisión de video para decisiones disputadas en torneos.",
    steps: [
      "El árbitro pulsa 'Solicitar Video Review' en la app del juez — el timer se pausa automáticamente.",
      "La pantalla TV muestra el banner '📹 VIDEO REVIEW EN PROCESO' para que el público espere.",
      "El árbitro abre la pantalla de review en su tablet: /tournament/[id]/tatami/[id]/review",
      "Ingresa el PIN de acreditación del torneo para acceder.",
      "El sistema muestra el segundo exacto donde buscar en el archivo OBS local o en el stream de YouTube.",
      "El árbitro decide: ✅ Confirmar Punto / ↩️ Revertir / ⚖️ Sin Definición.",
      "El combate se reanuda automáticamente después de la decisión.",
    ],
    tips: [
      "Activa 'Grabar localmente' en OBS además de transmitir — da revisión sin latencia (0 segundos vs 35s de YouTube Live).",
      "El PIN de acreditación se configura en el tab Información del torneo.",
      "Si YouTube está caído, el sistema siempre muestra el segundo exacto para buscar en el archivo MP4 local.",
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
