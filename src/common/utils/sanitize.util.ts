// Saca cualquier cosa con forma de tag HTML ("<...>"), incluido su
// contenido si es un tag que no debería tener texto visible (script/style).
// No es un parser HTML completo: es a propósito simple, para no arrastrar
// una dependencia pesada por un chequeo de "sacá cualquier tag".
const DANGEROUS_TAG_CONTENT = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
const ANY_TAG = /<[^>]*>/g;

function stripHtml(input: string): string {
  return input.replace(DANGEROUS_TAG_CONTENT, '').replace(ANY_TAG, '');
}

/**
 * Recorre strings/arrays/objetos recursivamente: recorta espacios y saca
 * cualquier tag HTML. No es protección contra SQL injection — eso ya lo
 * cubre TypeORM con parámetros preparados en todo lado — esto es contra
 * XSS almacenado: que un campo de texto guarde `<script>` y lo termine
 * ejecutando un frontend que renderice ese dato sin escaparlo de nuevo.
 */
export function sanitizeValue<T>(value: T): T {
  if (typeof value === 'string') {
    return stripHtml(value.trim()) as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item: unknown) => sanitizeValue(item)) as unknown as T;
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = sanitizeValue(entry);
    }
    return result as unknown as T;
  }

  return value;
}
