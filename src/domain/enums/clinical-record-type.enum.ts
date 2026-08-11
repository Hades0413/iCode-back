/**
 * Qué tipo de hecho clínico describe un "ClinicalRecord". El detalle
 * específico de cada tipo (dosis/frecuencia de una medicación, severidad
 * de una alergia, resultado de un examen...) vive en la columna
 * "Details" (jsonb) del mismo registro, no en columnas propias por tipo —
 * evita 5 tablas casi idénticas para un prototipo de hackatón, a costa de
 * no tener esas columnas tipadas a nivel de base de datos.
 */
export enum ClinicalRecordType {
  DIAGNOSTICO = 'DIAGNOSTICO',
  MEDICACION = 'MEDICACION',
  ALERGIA = 'ALERGIA',
  CIRUGIA = 'CIRUGIA',
  EXAMEN = 'EXAMEN',
}
