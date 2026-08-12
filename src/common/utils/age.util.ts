/**
 * Cálculo de edad a partir de "DateOfBirth" — funciones puras, sin
 * inyección de dependencias, para que cualquier módulo las use sin
 * import de otro módulo de Nest (ver
 * PUENTE18_FRONTEND_INTEGRATION.md, sección 2, sobre por qué
 * PatientTransitionService las necesitaba sin depender de
 * PatientsModule). "TitleTransferService" (en PatientsModule) delega
 * en estas mismas funciones — una sola fuente de verdad para la edad,
 * en dos lugares que la consumen sin acoplarse entre sí.
 *
 * "DateOfBirth" se parsea a mano (año/mes/día, sin pasar por
 * `new Date(iso)`) a propósito: ese constructor interpreta un string
 * "YYYY-MM-DD" como medianoche UTC, y los getters (`getDate()`,
 * `getMonth()`...) lo leen en la hora LOCAL del servidor — en cualquier
 * huso horario detrás de UTC, eso corre la fecha un día para atrás
 * (verificado: rompía "meses para los 18" en el borde exacto del mes).
 * "now" sí usa getters locales directamente porque ahí no hay strings
 * de por medio, así que no hay desajuste que evitar.
 */

interface DateParts {
  year: number;
  /** 0-indexado, igual que Date#getMonth() — para poder comparar directo. */
  month: number;
  day: number;
}

function parseDateOfBirth(dateOfBirth: string): DateParts {
  const [year, month, day] = dateOfBirth.slice(0, 10).split('-').map(Number);
  return { year, month: month - 1, day };
}

function today(): DateParts {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
}

function hasHadAnniversaryThisYear(dob: DateParts, now: DateParts): boolean {
  return (
    now.month > dob.month || (now.month === dob.month && now.day >= dob.day)
  );
}

export function isAdult(dateOfBirth: string): boolean {
  const dob = parseDateOfBirth(dateOfBirth);
  const now = today();
  let age = now.year - dob.year;
  if (!hasHadAnniversaryThisYear(dob, now)) {
    age -= 1;
  }
  return age >= 18;
}

/** "17a 11m" — la edad actual ya formateada. */
export function formatAge(dateOfBirth: string): string {
  const dob = parseDateOfBirth(dateOfBirth);
  const now = today();
  let years = now.year - dob.year;
  let months = now.month - dob.month;
  if (now.day < dob.day) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return `${years}a ${months}m`;
}

/** Positivo = faltan N meses para los 18; 0 o negativo = ya cumplió hace |N| meses. */
export function monthsToEighteen(dateOfBirth: string): number {
  const dob = parseDateOfBirth(dateOfBirth);
  const now = today();
  // El 18º cumpleaños, en las mismas partes año/mes/día — sumar 18 al
  // año alcanza (no hay 29 de febrero que built-in Date deba resolver
  // corriendo el mes, ver el caso límite más abajo).
  const eighteenthYear = dob.year + 18;
  let months = (eighteenthYear - now.year) * 12 + (dob.month - now.month);
  if (dob.day < now.day) {
    months -= 1;
  }
  return months;
}

/** null si todavía no cumplió 18. */
export function turnedEighteenAt(dateOfBirth: string): string | null {
  if (!isAdult(dateOfBirth)) {
    return null;
  }
  const dob = parseDateOfBirth(dateOfBirth);
  const eighteenthYear = dob.year + 18;
  const mm = String(dob.month + 1).padStart(2, '0');
  const dd = String(dob.day).padStart(2, '0');
  return `${eighteenthYear}-${mm}-${dd}`;
}
