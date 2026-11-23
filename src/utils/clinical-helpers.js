/**
 * cuidApp - Utilidades Clínicas Reutilizables y Estandarización de Storage
 * Marco Normativo: Ley N° 20.584 / DS N° 41
 */

/**
 * Constantes centralizadas para prefijos de almacenamiento en localStorage
 */
export const STORAGE_KEYS = Object.freeze({
  MEDICAL_EVOLUTIONS: 'cuidapp_medical_evolutions_',
  PRESCRIPTIONS: 'cuidapp_prescriptions_',
  LATEST_VITALS: 'cuidapp_latest_vitals_',
  CLINICAL_LOGS: 'cuidapp_clinical_logs_',
  CUSTOM_PATIENTS: 'cuidapp_custom_patients',
  PREGNANCY: 'cuidapp_pregnancy_',
  OBSTETRIC_HISTORY: 'cuidapp_obstetric_history_',
  PREVENTIVE_ORDERS: 'cuidapp_preventive_orders_',
  CUSTOM_USERS: 'cuidapp_custom_users',
  PASSWORD_OVERRIDES: 'cuidapp_password_overrides',
  ECG_RECORDS: 'cuidapp_ecg_records_'
});

/**
 * Calcula la edad exacta de un paciente en base a su fecha de nacimiento
 * @param {string|Date} birthDate - Fecha de nacimiento (ej: '1950-05-12' o Date)
 * @returns {number} Edad en años cumplidos
 */
export function calculatePatientAge(birthDate) {
  if (!birthDate) return 0;
  const bDate = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  if (isNaN(bDate.getTime())) return 0;

  const today = new Date();
  let age = today.getFullYear() - bDate.getFullYear();
  const m = today.getMonth() - bDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < bDate.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

/**
 * Retorna la fecha actual en formato estándar ISO YYYY-MM-DD
 * @returns {string} Fecha de hoy (ej: '2026-11-23')
 */
export function getTodayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Formatea una fecha ISO a estándar chileno (es-CL)
 * @param {string|Date} isoDate - Fecha ISO o Date
 * @param {object} [options] - Opciones de formato Intl
 * @returns {string} Fecha formateada en español de Chile
 */
export function formatChileanDate(isoDate, options = {}) {
  if (!isoDate) return '';
  const d = typeof isoDate === 'string' ? new Date(isoDate) : isoDate;
  if (isNaN(d.getTime())) return String(isoDate);

  const defaultOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  };

  return d.toLocaleDateString('es-CL', { ...defaultOptions, ...options }).replace('.', '');
}
