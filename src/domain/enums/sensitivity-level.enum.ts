/**
 * Clasificación exigida por la Ley 29733 y la NTS 139-MINSA sobre qué tan
 * protegida está una pieza de información clínica puntual — no la tabla
 * entera: un mismo paciente puede tener diagnósticos BASICA (ej. asma) y
 * SENSIBLE (ej. VIH) al mismo tiempo, así que la marca va en cada
 * "ClinicalRecord", no en el tipo de registro.
 *
 * BASICA: alergias, diagnósticos, medicación, cirugías, grupo sanguíneo —
 * accesible por personal de salud EN EMERGENCIA sin autorización previa.
 * SENSIBLE: VIH, salud sexual, genética, salud mental, etc. — SIEMPRE
 * requiere autorización expresa, sin excepción de emergencia.
 */
export enum SensitivityLevel {
  BASICA = 'BASICA',
  SENSIBLE = 'SENSIBLE',
}
