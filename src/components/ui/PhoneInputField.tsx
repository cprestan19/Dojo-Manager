"use client";
import PhoneInput from "react-phone-number-input";
import type { Country } from "react-phone-number-input";
// Banderas locales (bundleadas), no las remotas por defecto de la librería
// (https://purecatamphetamine.github.io/...) — esas se veían rotas cuando el
// navegador no podía llegar a ese CDN externo.
import flags from "react-phone-number-input/flags";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";

interface PhoneInputFieldProps {
  value:           string;
  onChange:        (value: string) => void;
  defaultCountry:  string; // ISO 3166-1 alpha-2, ej. "PA" — ver timezoneToCountry()
  placeholder?:    string;
  id?:             string;
  className?:      string;
}

// react-phone-number-input exige que su prop `value` sea E.164 válido o
// undefined — si le pasas cualquier otra cosa (ej. datos legados guardados
// antes de este selector, como "645121") revienta al montar. La spec E.164
// es "+" seguido de 2 a 15 dígitos, sin ceros a la izquierda.
const E164_REGEX = /^\+[1-9]\d{1,14}$/;

/**
 * Input de teléfono con selector de país (bandera + prefijo) — guarda el valor
 * en formato E.164 completo (ej. "+50761234567"), así normalizePhoneE164() en
 * src/lib/whatsapp/sendTemplate.ts ya no tiene que adivinar el país a partir
 * de la cantidad de dígitos.
 */
export default function PhoneInputField({
  value, onChange, defaultCountry, placeholder, id, className,
}: PhoneInputFieldProps) {
  const isLegacyFormat = !!value && !E164_REGEX.test(value);

  return (
    <div>
      <PhoneInput
        id={id}
        international
        flags={flags}
        defaultCountry={defaultCountry as Country}
        // Nunca se le pasa un valor no-E.164 a la librería (crashea) — un
        // valor legado arranca el campo vacío en vez de perder el dato:
        // el string original sigue en el form state hasta que el usuario
        // lo reemplace tecleando o seleccionando algo nuevo.
        value={isLegacyFormat ? undefined : (value || undefined)}
        onChange={v => onChange(v ?? "")}
        placeholder={placeholder ?? "Número de teléfono"}
        className={cn("dojo-phone-input", className)}
      />
      {isLegacyFormat && (
        <p className="text-xs text-amber-400 mt-1">
          Valor guardado con formato antiguo: &quot;{value}&quot; — vuelve a ingresarlo aquí para habilitar WhatsApp.
        </p>
      )}
    </div>
  );
}
