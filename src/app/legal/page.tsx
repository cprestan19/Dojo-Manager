import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Términos y Condiciones · Política de Devoluciones — Dojo Master",
  description: "Términos y Condiciones de uso y Política de Devoluciones y Reembolsos de DojoMaster Online.",
};

/* ── Tokens (mismos que la landing page) ─────────────────────── */
const BG      = "#080C14";
const CARD    = "#111827";
const BORDER  = "#1E293B";
const PRIMARY = "#C0392B";
const GOLD    = "#F59E0B";

const SUPPORT_EMAIL = "soporte@dojomasteronline.com";
const LAST_UPDATED  = "18 de julio de 2026";

/* ── Bloques tipográficos reutilizables ──────────────────────── */
function H2({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} style={{
      fontSize: 22, fontWeight: 800, color: "#fff", marginTop: 40, marginBottom: 14,
      paddingBottom: 10, borderBottom: `1px solid ${BORDER}`, scrollMarginTop: 90,
    }}>
      {children}
    </h2>
  );
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,.92)", marginTop: 22, marginBottom: 8 }}>{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 14.5, lineHeight: 1.75, color: "rgba(255,255,255,.68)", marginBottom: 14 }}>{children}</p>;
}
function Ul({ children }: { children: React.ReactNode }) {
  return <ul style={{ fontSize: 14.5, lineHeight: 1.75, color: "rgba(255,255,255,.68)", marginBottom: 14, paddingLeft: 22, listStyle: "disc" }}>{children}</ul>;
}
function Ol({ children }: { children: React.ReactNode }) {
  return <ol style={{ fontSize: 14.5, lineHeight: 1.75, color: "rgba(255,255,255,.68)", marginBottom: 14, paddingLeft: 22, listStyle: "decimal" }}>{children}</ol>;
}
function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: "auto", marginBottom: 18 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 420 }}>
        <thead>
          <tr>
            {head.map(h => (
              <th key={h} style={{
                textAlign: "left", padding: "10px 14px", background: CARD,
                border: `1px solid ${BORDER}`, color: "#fff", fontWeight: 700,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} style={{
                  padding: "10px 14px", border: `1px solid ${BORDER}`,
                  color: "rgba(255,255,255,.72)",
                }}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LegalPage() {
  return (
    <div style={{ background: BG, minHeight: "100dvh", color: "#fff" }}>
      {/* ── Header ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 30, background: "rgba(8,12,20,.85)",
        backdropFilter: "blur(10px)", borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{
          maxWidth: 900, margin: "0 auto", padding: "16px 24px",
          display: "flex", alignItems: "center", gap: 14,
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Dojo Master" width={28} height={28} style={{ borderRadius: 7, objectFit: "contain" }} />
          <span style={{ fontWeight: 900, fontSize: 15 }}>Dojo Master</span>
          <Link href="/" style={{
            marginLeft: "auto", display: "flex", alignItems: "center", gap: 6,
            fontSize: 13.5, color: "rgba(255,255,255,.55)",
          }}>
            <ArrowLeft size={14} /> Volver al inicio
          </Link>
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 80px" }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, marginBottom: 6 }}>Legal</h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,.5)", marginBottom: 28 }}>
          Términos y Condiciones de uso y Política de Devoluciones y Reembolsos de DojoMaster Online.
        </p>

        {/* Mini-nav interna */}
        <nav style={{
          display: "flex", gap: 10, marginBottom: 12, padding: 14,
          background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12,
        }}>
          <a href="#terminos" style={{ fontSize: 13.5, fontWeight: 700, color: PRIMARY }}>
            → Términos y Condiciones
          </a>
          <span style={{ color: "rgba(255,255,255,.25)" }}>·</span>
          <a href="#devoluciones" style={{ fontSize: 13.5, fontWeight: 700, color: GOLD }}>
            → Política de Devoluciones y Reembolsos
          </a>
        </nav>

        {/* ══════════════════════ TÉRMINOS Y CONDICIONES ══════════════════════ */}
        <section id="terminos" style={{ scrollMarginTop: 70 }}>
          <h2 style={{ fontSize: 26, fontWeight: 900, marginTop: 36, marginBottom: 4 }}>
            Términos y Condiciones de Uso — DojoMaster Online
          </h2>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,.45)", marginBottom: 18 }}>
            Última actualización: {LAST_UPDATED}
          </p>

          <P>
            Bienvenido a DojoMaster Online (&quot;DojoMaster&quot;, &quot;la Plataforma&quot;, &quot;nosotros&quot;). Estos Términos y
            Condiciones (&quot;Términos&quot;) regulan el acceso y uso de la plataforma disponible en dojomasteronline.com,
            incluyendo sus aplicaciones web, módulos de gestión de estudiantes, asistencia, torneos, facturación y
            cualquier otro servicio ofrecido bajo esta marca, sin importar el país desde el cual se acceda al servicio.
          </P>
          <P>
            DojoMaster es un servicio internacional, disponible para academias de artes marciales (&quot;Dojos&quot;) en
            cualquier país. Cada Dojo es responsable de cumplir con las leyes locales aplicables a su operación
            (impuestos, protección de datos, protección de menores, etc.), además de estos Términos.
          </P>
          <P>
            Al crear una cuenta, registrar un Dojo o usar la Plataforma en cualquier forma, usted acepta estos Términos.
            Si no está de acuerdo, no debe usar el servicio.
          </P>

          <H2>1. Descripción del Servicio</H2>
          <P>DojoMaster es una plataforma SaaS (Software as a Service) multi-tenant que permite a academias de artes marciales gestionar:</P>
          <Ul>
            <li>Registro y control de estudiantes y familias.</li>
            <li>Asistencia mediante código QR.</li>
            <li>Facturación y planes de membresía.</li>
            <li>Torneos, categorías, brackets y transmisión de resultados.</li>
            <li>Comunicaciones, notificaciones push y credenciales digitales (carnets, Google Wallet).</li>
            <li>Reportes administrativos para instructores (&quot;Sensei&quot;) y personal autorizado.</li>
          </Ul>
          <P>
            Cada Dojo opera dentro de su propio espacio de datos aislado (&quot;tenant&quot;). DojoMaster no es responsable del
            contenido, políticas internas, precios o conducta de cada Dojo individual hacia sus estudiantes.
          </P>

          <H2>2. Cuentas y Roles</H2>
          <H3>2.1 Tipos de cuenta.</H3>
          <P>La Plataforma contempla distintos roles: Superadmin (DojoMaster), Administrador de Dojo, Sensei/Instructor, y Estudiante/Padre de familia.</P>
          <H3>2.2 Registro de Dojo.</H3>
          <P>El Administrador que registra un Dojo declara tener la autoridad para representar y contratar en nombre de dicha academia.</P>
          <H3>2.3 Registro de estudiantes y menores de edad.</H3>
          <P>
            Cuando el estudiante sea menor de edad, el registro, la aceptación de estos Términos y el otorgamiento de
            cualquier consentimiento (incluido el uso de fotografías para credenciales) debe ser realizado por su padre,
            madre o tutor legal. El Dojo es responsable de verificar dicho consentimiento antes de aprobar solicitudes de
            registro a través del flujo de autorregistro, conforme a la legislación de protección de menores de su país.
          </P>
          <H3>2.4 Cuentas familiares.</H3>
          <P>
            DojoMaster permite agrupar hermanos bajo un solo inicio de sesión de padre/tutor (&quot;family grouping&quot;). El
            titular de dicha cuenta es responsable del uso que se haga de ella.
          </P>
          <H3>2.5 Seguridad de la cuenta.</H3>
          <P>Usted es responsable de mantener la confidencialidad de sus credenciales y de toda actividad realizada bajo su cuenta.</P>

          <H2>3. Planes, Precios y Facturación</H2>
          <H3>3.1 Planes disponibles.</H3>
          <P>DojoMaster ofrece los siguientes planes:</P>
          <Table
            head={["Plan", "Alumnos", "Precio", "Funciones"]}
            rows={[
              ["Academia", "Hasta 60 alumnos", "$14.99/mes", "Gestión de alumnos, asistencia, pagos, cintas, carnet digital y página web del Dojo"],
              ["Academia y padres", "Hasta 100 alumnos", "$24.99/mes", "Todo lo de Academia, más portal de padres, eventos, reportes y notificaciones push"],
              ["Academia, padres y Torneo", "Alumnos ilimitados", "$44.99/mes", "Todo lo anterior, más el módulo de Torneos Pro (streaming, brackets, jueces, postulaciones)"],
            ]}
          />
          <P>
            Los planes y precios vigentes en todo momento son los que se muestran en el panel de facturación de la
            Plataforma y en la página pública de precios (dojomasteronline.com/#planes), los cuales prevalecen sobre
            esta tabla en caso de discrepancia.
          </P>
          <H3>3.2 Primer mes gratuito.</H3>
          <P>
            Todo Dojo nuevo recibe automáticamente un (1) mes de acceso gratuito al plan contratado, contado desde la
            fecha de creación de la cuenta, sin necesidad de ingresar información de pago para comenzar. Al finalizar
            ese mes, la Plataforma genera y envía automáticamente al correo del Administrador del Dojo un enlace de
            pago para activar el cobro recurrente del plan. No existe una modalidad de uso gratuito indefinido: si el
            Dojo no completa el pago, aplica lo previsto en la Sección 3.7.
          </P>
          <H3>3.3 Métodos de pago.</H3>
          <P>
            Los pagos se procesan a través de proveedores externos (PayPal y/o PagueloFacil, según disponibilidad en el
            país del Dojo). Al proporcionar información de pago, usted autoriza el cobro recurrente del plan contratado
            según la periodicidad elegida (mensual/anual).
          </P>
          <H3>3.4 Cambios de plan.</H3>
          <P>Los cambios de plan (upgrade/downgrade) se reflejan según la política de prorrateo vigente en el panel de facturación al momento del cambio.</P>
          <H3>3.5 Impuestos.</H3>
          <P>Los precios podrán no incluir impuestos aplicables (IVA, ventas u otros) según el país del Dojo; estos se añadirán conforme a la normativa fiscal local que corresponda.</P>
          <H3>3.6 Modificación de precios o límites de plan.</H3>
          <P>
            Nos reservamos el derecho de modificar los precios, límites de alumnos o duración del mes gratuito de
            introducción, notificando con al menos 30 días de anticipación a los Dojos activos. Los cambios no aplican
            retroactivamente a períodos ya facturados.
          </P>
          <H3>3.7 Cuentas impagas.</H3>
          <P>
            Si el Dojo no completa el pago del enlace enviado al finalizar el mes gratuito, o si una renovación
            posterior queda impaga, la cuenta pasa a modo de solo lectura (el Dojo conserva acceso de consulta a su
            información, pero no puede crear ni editar registros) hasta que se regularice el pago. El impago
            prolongado puede resultar en la suspensión total de la cuenta conforme a la Sección 9.
          </P>

          <H2>4. Uso Aceptable</H2>
          <P>Usted se compromete a no:</P>
          <Ul>
            <li>Usar la Plataforma para fines ilegales o no autorizados.</li>
            <li>Intentar vulnerar la seguridad, aislamiento de datos (&quot;tenant isolation&quot;) o infraestructura de DojoMaster.</li>
            <li>Extraer, revender o distribuir datos de otros Dojos o estudiantes sin autorización.</li>
            <li>Subir contenido difamatorio, ofensivo o que infrinja derechos de terceros (incluyendo fotografías de estudiantes sin el consentimiento correspondiente).</li>
            <li>Usar bots, scraping automatizado o ingeniería inversa sobre la Plataforma.</li>
            <li>Copiar, reproducir, descompilar, o crear obras derivadas del software, diseño, base de datos o funcionalidades de DojoMaster con fines de crear un producto competidor (ver Sección 5.3).</li>
          </Ul>

          <H2>5. Propiedad Intelectual</H2>
          <P>
            <strong>5.1</strong> DojoMaster —incluyendo su código fuente, arquitectura, base de datos, diseño de
            interfaz, flujos de trabajo, documentación y marca— es un desarrollo de software propio y original, propiedad
            exclusiva de sus desarrolladores/titulares, y está protegido por las leyes de propiedad intelectual y
            derechos de autor aplicables a nivel internacional (incluyendo tratados como el Convenio de Berna).
          </P>
          <P>
            <strong>5.2</strong> Los Dojos conservan la titularidad de sus propios datos (información de estudiantes,
            fotografías, resultados de torneos, contenido cargado). Al usar la Plataforma, otorgan a DojoMaster una
            licencia limitada para almacenar, procesar y mostrar dicha información únicamente con el fin de prestar el
            servicio contratado.
          </P>
          <H3>5.3 Prohibición de plagio y copia no autorizada.</H3>
          <P>Queda estrictamente prohibido:</P>
          <Ul>
            <li>Copiar, imitar o reproducir el software, código fuente, diseño de base de datos, flujos de trabajo, interfaz o cualquier componente funcional de DojoMaster para desarrollar un producto propio o de un tercero.</li>
            <li>Realizar ingeniería inversa sobre la Plataforma con el fin de replicar su funcionamiento.</li>
            <li>Usar información obtenida como cliente, empleado, contratista o socio de DojoMaster para desarrollar una plataforma competidora sustancialmente similar.</li>
          </Ul>
          <P>
            El incumplimiento de esta cláusula habilita a DojoMaster a iniciar las acciones legales correspondientes por
            infracción de propiedad intelectual y competencia desleal, además de la terminación inmediata de la cuenta
            del infractor, sin perjuicio de la reclamación de daños y perjuicios.
          </P>

          <H2 id="datos-personales">6. Datos Personales y Privacidad</H2>
          <P>
            <strong>6.1</strong> El tratamiento de datos personales (incluyendo datos de menores de edad, fotografías e
            información de contacto) se rige por lo dispuesto en esta sección y por la normativa de protección de datos
            aplicable en el país donde opere cada Dojo. DojoMaster aún no cuenta con una Política de Privacidad
            publicada como documento separado; mientras tanto, esta sección constituye el compromiso vigente de
            tratamiento de datos.
          </P>
          <P>
            <strong>6.2</strong> Los Dojos actúan como responsables del tratamiento respecto de los datos de sus propios
            estudiantes; DojoMaster actúa como encargado del tratamiento (proveedor tecnológico) salvo que se indique lo
            contrario.
          </P>
          <P>
            <strong>6.3</strong> Se implementan medidas de seguridad razonables (aislamiento por tenant, cifrado, control
            de acceso por roles) para proteger la información almacenada.
          </P>

          <H2>7. Disponibilidad del Servicio</H2>
          <P>
            DojoMaster procura mantener la Plataforma disponible de forma continua, pero no garantiza un tiempo de
            actividad del 100%. Podremos realizar mantenimientos programados o de emergencia, notificando cuando sea
            razonablemente posible.
          </P>

          <H2>8. Limitación de Responsabilidad</H2>
          <P>
            En la máxima medida permitida por la ley aplicable, DojoMaster no será responsable por daños indirectos,
            incidentales, especiales o consecuentes derivados del uso o la imposibilidad de uso de la Plataforma,
            incluyendo pérdida de datos, pérdida de ingresos o interrupción del negocio del Dojo. La responsabilidad
            total de DojoMaster frente a un Dojo no excederá el monto pagado por dicho Dojo durante los últimos 3 meses
            de servicio.
          </P>

          <H2>9. Suspensión, Bloqueo y Terminación</H2>
          <H3>9.1 Cancelación por el Dojo.</H3>
          <P>El Dojo puede cancelar su suscripción en cualquier momento desde el panel de administración.</P>
          <H3>9.2 Suspensión, bloqueo o eliminación por DojoMaster.</H3>
          <P>
            DojoMaster se reserva el derecho de suspender, bloquear el acceso, o eliminar permanentemente la cuenta de
            cualquier Dojo que incumpla estos Términos, incluyendo, entre otros casos:
          </P>
          <Ul>
            <li>Uso indebido o no autorizado de datos de estudiantes o menores de edad.</li>
            <li>Impago prolongado de la suscripción.</li>
            <li>Actividad fraudulenta, abusiva o que comprometa la seguridad de la Plataforma o de otros Dojos.</li>
            <li>Intento de copia, plagio o creación de un producto competidor conforme a la Sección 5.3.</li>
            <li>Conducta que dañe la reputación de DojoMaster o ponga en riesgo a otros usuarios.</li>
          </Ul>
          <P>
            Siempre que sea razonablemente posible, se notificará al Dojo antes de la suspensión o bloqueo, otorgando un
            plazo para subsanar el incumplimiento, salvo en casos graves (fraude, riesgo a menores, vulneración de
            seguridad, o plagio) en los que DojoMaster podrá actuar de forma inmediata.
          </P>
          <H3>9.3 Efectos de la eliminación.</H3>
          <P>
            Tras la terminación o eliminación de una cuenta, los datos podrán conservarse por un período razonable (ej.
            30 días) para permitir exportación por parte del Dojo, salvo en casos de eliminación por incumplimiento
            grave, donde DojoMaster podrá eliminar los datos de forma inmediata conforme a su política de retención.
          </P>

          <H2>10. Modificaciones a los Términos</H2>
          <P>
            Podemos actualizar estos Términos periódicamente. Los cambios materiales se notificarán con antelación
            razonable a través de la Plataforma o por correo electrónico. El uso continuado tras la entrada en vigencia
            de los cambios constituye aceptación de los mismos.
          </P>

          <H2>11. Ley Aplicable y Jurisdicción</H2>
          <P>
            Estos Términos se rigen por las leyes de la República de Panamá, país de origen de DojoMaster, sin perjuicio
            de las normas de protección al consumidor y protección de datos que resulten imperativamente aplicables en
            el país donde opere cada Dojo. Cualquier controversia se someterá a los tribunales competentes de Panamá,
            salvo disposición legal imperativa en contrario en la jurisdicción del Dojo.
          </P>

          <H2>12. Contacto</H2>
          <P>
            Para consultas sobre estos Términos, escríbanos a:{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: PRIMARY }}>{SUPPORT_EMAIL}</a>
          </P>
        </section>

        {/* ══════════════════════ POLÍTICA DE DEVOLUCIONES ══════════════════════ */}
        <section id="devoluciones" style={{ scrollMarginTop: 70, marginTop: 56, paddingTop: 40, borderTop: `1px solid ${BORDER}` }}>
          <h2 style={{ fontSize: 26, fontWeight: 900, marginBottom: 4 }}>
            Política de Devoluciones y Reembolsos — DojoMaster Online
          </h2>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,.45)", marginBottom: 18 }}>
            Última actualización: {LAST_UPDATED}
          </p>

          <P>
            Esta política aplica a las suscripciones pagadas de DojoMaster Online, disponible internacionalmente,
            procesadas a través de PayPal y/o PagueloFacil, y complementa nuestros{" "}
            <a href="#terminos" style={{ color: GOLD }}>Términos y Condiciones</a>.
          </P>

          <H2>1. Planes Disponibles</H2>
          <Table
            head={["Plan", "Alumnos", "Precio"]}
            rows={[
              ["Academia", "Hasta 60 alumnos", "$14.99/mes"],
              ["Academia y padres", "Hasta 100 alumnos", "$24.99/mes"],
              ["Academia, padres y Torneo", "Alumnos ilimitados", "$44.99/mes"],
            ]}
          />
          <P>
            Todo Dojo nuevo recibe un (1) mes de acceso gratuito al plan que elija, contado desde la fecha de creación
            de la cuenta, sin necesidad de ingresar información de pago para comenzar. Esto le permite evaluar la
            Plataforma antes de que se genere el primer cobro. Al finalizar ese mes, la Plataforma envía
            automáticamente el enlace de pago correspondiente; no existe una modalidad de uso gratuito indefinido.
          </P>

          <H2>2. Política General</H2>
          <P>
            Dado que DojoMaster es un servicio de suscripción (SaaS) con acceso inmediato a funciones digitales al
            momento del pago, las suscripciones ya activadas y facturadas no son reembolsables, salvo en los casos
            específicos descritos en la sección 4.
          </P>
          <P>Esto significa que:</P>
          <Ul>
            <li>No se reembolsan períodos ya transcurridos de un ciclo de facturación (mensual o anual).</li>
            <li>El hecho de no usar la Plataforma durante un período pagado no genera derecho a reembolso.</li>
            <li>El mes gratuito de introducción no genera cobro alguno, por lo que no aplica reembolso sobre este.</li>
          </Ul>

          <H2>3. Cancelación o Impago de Suscripción</H2>
          <Ul>
            <li>Puede cancelar su suscripción en cualquier momento desde el panel de administración del Dojo.</li>
            <li>
              La cancelación detiene la renovación futura, pero no genera un reembolso parcial del ciclo en curso: el
              Dojo mantiene acceso a las funciones de su plan hasta el final del período ya pagado (o del mes
              gratuito, si aún no se ha facturado).
            </li>
            <li>
              Al finalizar dicho período sin un pago vigente, la cuenta pasa a modo de solo lectura: el Dojo conserva
              acceso de consulta a su información, pero no puede crear ni editar registros, hasta que reactive un
              plan pago.
            </li>
          </Ul>

          <H2>4. Casos en los que Sí Aplica Reembolso</H2>
          <P>Consideraremos reembolsos, totales o parciales, únicamente en estos casos:</P>
          <Ol>
            <li><strong>Error de cobro o cobro duplicado:</strong> si se procesó más de un cargo por el mismo período o plan debido a un error técnico de facturación.</li>
            <li><strong>Cobro posterior a cancelación efectiva:</strong> si se generó un cargo después de que la cancelación ya hubiese sido confirmada por el sistema.</li>
            <li><strong>Falla comprobada y prolongada del servicio:</strong> interrupciones significativas del servicio atribuibles a DojoMaster (no a fallas de internet, dispositivo o terceros del Dojo) que impidan el uso razonable de la Plataforma durante un período sustancial del ciclo facturado.</li>
            <li><strong>Cargo no autorizado:</strong> transacciones realizadas sin autorización del titular de la cuenta de pago, sujeto a verificación.</li>
          </Ol>
          <P>En estos casos, el reembolso se calculará de forma proporcional al tiempo afectado o al monto indebidamente cobrado.</P>

          <H2>5. Cambios de Plan (Upgrade / Downgrade)</H2>
          <Ul>
            <li><strong>Upgrade</strong> (por ejemplo, Academia → Academia y padres, o Academia y padres → Academia, padres y Torneo): el cambio se aplica de inmediato; el monto se ajusta de forma prorrateada en el ciclo de facturación vigente, según lo muestre el panel de facturación al confirmar el cambio.</li>
            <li><strong>Downgrade</strong> (por ejemplo, Academia, padres y Torneo → Academia y padres): el nuevo plan y su tarifa entran en vigencia a partir del siguiente ciclo de facturación; no se reembolsa la diferencia del ciclo en curso.</li>
          </Ul>

          <H2>6. Suspensión o Eliminación de Cuentas por Incumplimiento</H2>
          <P>
            Si una cuenta es suspendida, bloqueada o eliminada por incumplimiento de los Términos y Condiciones (uso
            indebido de datos, fraude, impago, plagio del software, o cualquier otra causa señalada en dichos Términos),
            no aplicará reembolso por el tiempo restante del plan contratado, sin perjuicio de las acciones adicionales
            que DojoMaster pueda tomar.
          </P>

          <H2>7. Procesamiento de Pagos por Terceros</H2>
          <P>
            Los pagos se procesan a través de PayPal y/o PagueloFacil. Cualquier reembolso aprobado se procesará
            utilizando el mismo método de pago original y estará sujeto también a los tiempos y condiciones de dichas
            plataformas de pago, que pueden tomar entre 5 y 15 días hábiles en reflejarse, dependiendo del proveedor y
            del banco emisor del Dojo.
          </P>

          <H2>8. Cómo Solicitar un Reembolso</H2>
          <P>Para solicitar un reembolso bajo alguno de los supuestos de la sección 4:</P>
          <Ol>
            <li>
              Escriba a{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: GOLD }}>{SUPPORT_EMAIL}</a>{" "}
              indicando el nombre del Dojo, correo de la cuenta y motivo de la solicitud.
            </li>
            <li>Adjunte el comprobante de pago o número de transacción (PayPal/PagueloFacil).</li>
            <li>Nuestro equipo evaluará la solicitud en un plazo máximo de 10 días hábiles y le notificará la resolución.</li>
          </Ol>

          <H2>9. Contacto</H2>
          <P>
            Para dudas sobre esta política, escríbanos a:{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: GOLD }}>{SUPPORT_EMAIL}</a>
          </P>
        </section>
      </div>
    </div>
  );
}
