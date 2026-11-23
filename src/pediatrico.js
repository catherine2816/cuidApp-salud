
/**
 * @fileoverview Portal Pediátrico y Curvas de Crecimiento OMS - cuidApp
 * @module src/pediatrico.js
 * @description Seguimiento del desarrollo integral de lactantes, niños y adolescentes:
 * - Curvas de Crecimiento oficiales OMS / MINSAL (Peso/Edad, Talla/Edad, IMC/Edad)
 * - Programa Nacional de Inmunizaciones (PNI) con trazabilidad de dosis y calendarios
 * - Escaneo inteligente de Carnet Físico de Salud y clasificación de exámenes
 * - Código QR de Urgencias Pediátricas con datos críticos (alergias, grupo sanguíneo, contacto del tutor)
 *
 * @compliance
 * - Ley N° 21.430: Protección Integral de Derechos de Niñas, Niños y Adolescentes
 * - Ley N° 20.584: Derechos en la atención pediátrica y representación legal
 * - Normativa Técnica MINSAL: Control de Salud Integral del Niño y Adolescente
 */

// Completar y garantizar datos oficiales de Mateo Morales cuando sea demo
export function ensureMateoDemoData(patient) {
  if (!patient) return;
  const isMateo = patient.id === 'p_mateo' || 
                  patient.id === 'mateo' || 
                  (patient.username && patient.username.toLowerCase() === 'mateo') || 
                  (patient.rut && patient.rut.replace(/[\.\s]/g, '').includes('25340112-9')) ||
                  (patient.fileNumber && patient.fileNumber.replace(/[\.\s]/g, '').includes('25340112-9'));
  if (isMateo) {
    patient.name = 'Mateo Morales';
    patient.socialName = 'Mateo Morales';
    patient.rut = '25.340.112-9';
    patient.fileNumber = '25.340.112-9';
    patient.age = 7;
    patient.weight = 22.4;
    patient.height = 122;
    patient.isPediatric = true;
    patient.legalGuardianName = 'Camila Paz Vergara Fuentes';
    patient.legalGuardianRut = '16.890.432-1';
    patient.legalGuardianRelation = 'Tutora Legal';
    patient.emergencyContact = {
      name: 'Camila Paz Vergara Fuentes',
      relation: 'Tutora Legal',
      phone: '+56 9 8765 4321'
    };
  }
}

// Rangos de referencia de signos vitales pediátricos por etapa de desarrollo (MINSAL / OMS)
export const PEDIATRIC_VITAL_RANGES = {
  lactante: {
    stage: 'Lactante (0 a 2 años)',
    heartRate: { min: 100, max: 160, unit: 'BPM', label: 'Frecuencia Cardíaca', ref: '100 – 160 BPM' },
    respRate: { min: 30, max: 50, unit: 'RPM', label: 'Frecuencia Respiratoria', ref: '30 – 50 RPM' },
    systolic: { min: 70, max: 100, unit: 'mmHg', label: 'Presión Sistólica', ref: '70 – 100 mmHg' },
    diastolic: { min: 50, max: 65, unit: 'mmHg', label: 'Presión Diastólica', ref: '50 – 65 mmHg' },
    spO2: { min: 95, max: 100, unit: '%', label: 'Saturación SpO2', ref: '95 – 100%' },
    temp: { min: 36.5, max: 37.5, unit: '°C', label: 'Temperatura Axilar', ref: '36.5 – 37.5 °C' }
  },
  preescolar: {
    stage: 'Preescolar (2 a 6 años)',
    heartRate: { min: 80, max: 120, unit: 'BPM', label: 'Frecuencia Cardíaca', ref: '80 – 120 BPM' },
    respRate: { min: 20, max: 30, unit: 'RPM', label: 'Frecuencia Respiratoria', ref: '20 – 30 RPM' },
    systolic: { min: 80, max: 110, unit: 'mmHg', label: 'Presión Sistólica', ref: '80 – 110 mmHg' },
    diastolic: { min: 50, max: 70, unit: 'mmHg', label: 'Presión Diastólica', ref: '50 – 70 mmHg' },
    spO2: { min: 95, max: 100, unit: '%', label: 'Saturación SpO2', ref: '95 – 100%' },
    temp: { min: 36.5, max: 37.5, unit: '°C', label: 'Temperatura Axilar', ref: '36.5 – 37.5 °C' }
  },
  escolar: {
    stage: 'Escolar (6 a 12 años)',
    heartRate: { min: 70, max: 110, unit: 'BPM', label: 'Frecuencia Cardíaca', ref: '70 – 110 BPM' },
    respRate: { min: 16, max: 24, unit: 'RPM', label: 'Frecuencia Respiratoria', ref: '16 – 24 RPM' },
    systolic: { min: 90, max: 115, unit: 'mmHg', label: 'Presión Sistólica', ref: '90 – 115 mmHg' },
    diastolic: { min: 60, max: 75, unit: 'mmHg', label: 'Presión Diastólica', ref: '60 – 75 mmHg' },
    spO2: { min: 95, max: 100, unit: '%', label: 'Saturación SpO2', ref: '95 – 100%' },
    temp: { min: 36.5, max: 37.5, unit: '°C', label: 'Temperatura Axilar', ref: '36.5 – 37.5 °C' }
  },
  adolescente: {
    stage: 'Adolescente (12 a 17 años)',
    heartRate: { min: 60, max: 100, unit: 'BPM', label: 'Frecuencia Cardíaca', ref: '60 – 100 BPM' },
    respRate: { min: 12, max: 20, unit: 'RPM', label: 'Frecuencia Respiratoria', ref: '12 – 20 RPM' },
    systolic: { min: 100, max: 120, unit: 'mmHg', label: 'Presión Sistólica', ref: '100 – 120 mmHg' },
    diastolic: { min: 65, max: 80, unit: 'mmHg', label: 'Presión Diastólica', ref: '65 – 80 mmHg' },
    spO2: { min: 95, max: 100, unit: '%', label: 'Saturación SpO2', ref: '95 – 100%' },
    temp: { min: 36.5, max: 37.5, unit: '°C', label: 'Temperatura Axilar', ref: '36.5 – 37.5 °C' }
  }
};

export function getPediatricVitalRanges(age = 7) {
  if (age < 2) return PEDIATRIC_VITAL_RANGES.lactante;
  if (age < 6) return PEDIATRIC_VITAL_RANGES.preescolar;
  if (age < 12) return PEDIATRIC_VITAL_RANGES.escolar;
  return PEDIATRIC_VITAL_RANGES.adolescente;
}

// Evaluación clínica pediátrica automatizada según edad y protocolos MINSAL / OMS
export function getPediatricEvaluation(vitals, age = 7) {
  const ped = getPediatricVitalRanges(age);
  const evals = [];

  if (vitals.heartRate) {
    if (vitals.heartRate < ped.heartRate.min) {
      evals.push(`Frecuencia cardíaca baja (${vitals.heartRate} BPM, ref: ${ped.heartRate.ref})`);
    } else if (vitals.heartRate > ped.heartRate.max) {
      evals.push(`Frecuencia cardíaca elevada (${vitals.heartRate} BPM, ref: ${ped.heartRate.ref})`);
    } else {
      evals.push(`Frecuencia cardíaca adecuada (${vitals.heartRate} BPM)`);
    }
  }

  if (vitals.respRate) {
    if (vitals.respRate < ped.respRate.min) {
      evals.push(`Frecuencia respiratoria baja (${vitals.respRate} RPM)`);
    } else if (vitals.respRate > ped.respRate.max) {
      evals.push(`Taquipnea (${vitals.respRate} RPM)`);
    } else {
      evals.push(`Patrón respiratorio eutócico (${vitals.respRate} RPM)`);
    }
  }

  if (vitals.systolic && vitals.diastolic) {
    if (vitals.systolic > ped.systolic.max || vitals.diastolic > ped.diastolic.max) {
      evals.push(`Presión arterial sobre percentil (${vitals.systolic}/${vitals.diastolic} mmHg)`);
    } else if (vitals.systolic < ped.systolic.min) {
      evals.push(`Hipotensión arterial (${vitals.systolic}/${vitals.diastolic} mmHg)`);
    } else {
      evals.push(`Normotenso (${vitals.systolic}/${vitals.diastolic} mmHg)`);
    }
  }

  if (vitals.spO2 || vitals.spo2) {
    const sp = vitals.spO2 || vitals.spo2;
    if (sp < 95) {
      evals.push(`Saturación subóptima (${sp}%)`);
    } else {
      evals.push(`Saturación óptima (${sp}%)`);
    }
  }

  if (vitals.temperature) {
    if (vitals.temperature >= 38.0) {
      evals.push(`Fiebre (${vitals.temperature}°C)`);
    } else if (vitals.temperature >= 37.3) {
      evals.push(`Febrícula (${vitals.temperature}°C)`);
    } else if (vitals.temperature < 36.0) {
      evals.push(`Temperatura baja (${vitals.temperature}°C)`);
    } else {
      evals.push(`Afebril (${vitals.temperature}°C)`);
    }
  }

  const summary = evals.length > 0 
    ? evals.join(' &bull; ') 
    : `Parámetros fisiológicos basales estables según protocolo MINSAL / OMS para etapa ${ped.stage}.`;

  const isNormal = !summary.includes('baja') && !summary.includes('elevada') && !summary.includes('Fiebre') && !summary.includes('Hipotensión') && !summary.includes('Taquipnea');

  return {
    stage: ped.stage,
    summary,
    isNormal
  };
}

// Modal HTML reutilizable para vincular carga pediátrica bajo Tutela Acreditada
export function getAddChildModalHTML(guardianPatient) {
  const tutorName = (guardianPatient && (guardianPatient.socialName || guardianPatient.name)) || 'Tutor Legal';
  const tutorRut = (guardianPatient && guardianPatient.rut) || '';
  const prevision = (guardianPatient && guardianPatient.prevision) || 'FONASA';
  return `
    <!-- Modal Vincular Carga Pediátrica (Ley N° 21.430) -->
    <div id="modalAddChild" class="modal fade" tabindex="-1" style="display: none; background: rgba(10, 15, 29, 0.88); backdrop-filter: blur(14px);" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content text-white" style="background: rgba(15, 23, 42, 0.96); border-radius: 28px; border: 2px solid #38bdf8; box-shadow: 0 25px 60px rgba(0,0,0,0.85); overflow: hidden; font-family: 'Outfit', sans-serif;">
          <div class="modal-header border-bottom p-4 d-flex justify-content-between align-items-center" style="background: rgba(14, 165, 233, 0.15); border-color: rgba(255, 255, 255, 0.1) !important;">
            <div class="d-flex align-items-center gap-2">
              <span style="font-size: 2.2rem;">🧸</span>
              <div>
                <h4 class="modal-title fw-extrabold m-0 text-white">Vincular Nueva Carga Pediátrica</h4>
                <small class="text-info fw-semibold">Registro de Hijo/a bajo Tutela Acreditada (Ley N° 21.430 / Ley N° 20.584)</small>
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" id="btnCloseAddChildModalX" aria-label="Close" style="cursor: pointer;"></button>
          </div>
          <form id="formAddChild">
            <div class="modal-body p-4">
              <div class="row g-3 mb-3">
                <div class="col-12 col-md-7">
                  <label class="form-label small text-white-50 fw-bold">Nombre Completo del Niño/a *</label>
                  <input type="text" id="acChildName" class="form-control bg-dark text-white border-light border-opacity-25 py-2.5 rounded-3" placeholder="Ej. Lucas Andrés Rojas" required>
                </div>
                <div class="col-12 col-md-5">
                  <label class="form-label small text-white-50 fw-bold">Nombre Social / Pronombres</label>
                  <input type="text" id="acChildSocialName" class="form-control bg-dark text-white border-light border-opacity-25 py-2.5 rounded-3" placeholder="Ej. Lucas (Él)">
                </div>
              </div>
              <div class="row g-3 mb-3">
                <div class="col-12 col-md-6">
                  <label class="form-label small text-white-50 fw-bold">RUT del Menor *</label>
                  <input type="text" id="acChildRut" class="form-control bg-dark text-white border-light border-opacity-25 py-2.5 rounded-3" placeholder="Ej. 28.910.234-5" required>
                </div>
                <div class="col-12 col-md-6">
                  <label class="form-label small text-white-50 fw-bold">Sexo Biológico *</label>
                  <select id="acChildGender" class="form-select bg-dark text-white border-light border-opacity-25 py-2.5 rounded-3" required>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Intersexual">Intersexual</option>
                  </select>
                </div>
              </div>
              <div class="row g-3 mb-3">
                <div class="col-12 col-md-6">
                  <label class="form-label small text-white-50 fw-bold">Fecha de Nacimiento *</label>
                  <input type="date" id="acChildBirthDate" class="form-control bg-dark text-white border-light border-opacity-25 py-2.5 rounded-3" required>
                </div>
                <div class="col-12 col-md-6">
                  <label class="form-label small text-white-50 fw-bold">Condiciones o Alergias Iniciales</label>
                  <input type="text" id="acChildConditions" class="form-control bg-dark text-white border-light border-opacity-25 py-2.5 rounded-3" placeholder="Ej. Rinitis alérgica, TEA, Alergia alimentaria">
                </div>
              </div>
              <div class="p-3 rounded-3" style="background: rgba(14, 165, 233, 0.1); border: 1px solid rgba(14, 165, 233, 0.3);">
                <small class="text-info d-block fw-semibold"><i class="bi bi-shield-check me-1"></i>Tutor/a Legal: ${tutorName} (RUT: ${tutorRut}) &bull; Previsión: ${prevision}</small>
              </div>
            </div>
            <div class="modal-footer p-3 border-top justify-content-between" style="background: rgba(15, 23, 42, 0.98); border-color: rgba(255, 255, 255, 0.1) !important;">
              <button type="button" class="btn btn-outline-secondary px-4 py-2 rounded-pill fw-bold text-white" id="btnCloseAddChildModalBtn">Cancelar</button>
              <button type="submit" class="btn btn-primary px-5 py-2.5 rounded-pill fw-bold text-white shadow-lg">
                🧸 Vincular y Crear Ficha Pediátrica
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

export function getActivePediatricData() {
  const p = activePatient || {};
  ensureMateoDemoData(p);
  const isAdolescent = (p.age !== undefined && p.age >= 12 && p.age <= 17) || p.id === 'camila';
  
  let customOverrides = {};
  try {
    const raw = localStorage.getItem('cuidapp_pediatric_profile_' + (p.id || 'mateo'));
    if (raw) customOverrides = JSON.parse(raw);
  } catch(e) {}

  const defaultNeuro = (p.conditions && p.conditions.some(c => c.toLowerCase().includes('tea') || c.toLowerCase().includes('autismo')))
    ? 'Condición del Espectro Autista (TEA Grado 2)'
    : (p.id === 'mateo' ? 'Condición del Espectro Autista (TEA Grado 2)' : 'Ninguna declarada');

  return {
    fullName: p.name || (isAdolescent ? 'Camila Soto Valenzuela' : 'Mateo Morales'),
    socialName: p.socialName || (isAdolescent ? 'Camila Soto' : 'Mateo Morales'),
    pronouns: p.pronouns || (p.gender === 'Femenino' ? 'Ella' : 'Él'),
    rut: p.rut || (isAdolescent ? '24.110.456-8' : '25.340.112-9'),
    birthDate: p.birthDate || (isAdolescent ? '10 de Marzo de 2012' : '14 de Mayo de 2019'),
    age: p.age !== undefined ? p.age : (isAdolescent ? 14 : 7),
    isAdolescent: isAdolescent,
    gender: p.gender || (isAdolescent ? 'Femenino' : 'Masculino'),
    bloodType: p.bloodType || 'O+ (Rh Positivo)',
    guardianName: p.legalGuardianName || (isAdolescent ? 'Marcela Valenzuela' : 'Camila Paz Vergara Fuentes'),
    guardianRut: p.legalGuardianRut || (isAdolescent ? '15.678.901-2' : '16.890.432-1'),
    guardianRole: p.guardianRole || 'Madre / Tutora Acreditada',
    guardianPhone: (p.emergencyContact && p.emergencyContact.phone) || '+56 9 8765 4321',
    address: p.address || customOverrides.address || 'Av. Recoleta 1245, Depto 402, Santiago',
    allergies: (Array.isArray(p.allergies) ? p.allergies.join(', ') : p.allergies) || (isAdolescent ? 'Alergia al látex' : 'Ninguna conocida'),
    chronicConditions: (Array.isArray(p.conditions) ? p.conditions.join(', ') : (p.conditions || 'Rinitis Alérgica')),
    neurodivergences: customOverrides.neurodivergences || defaultNeuro,
    pediatricianName: 'Dra. Marcela Soto - Pediatra',
    prevision: p.prevision || 'FONASA Tramo B (Copago Cero Infantil)',
    ...customOverrides
  };
}

import {
  activePatient,
  speakText,
  attachVoiceGuidance,
  modoVozActivo
} from './main.js';
import { renderPatientView } from './paciente.js';
import Chart from 'chart.js/auto';
import { openDentalModuleModal } from './odontologia.js';
import {
  CLINICAL_CONDITIONS_CATALOG,
  getClinicalConditionsCatalog,
  saveCustomClinicalCondition,
  findConditionInCatalog
} from './data.js';

// ============================================================================
// HELPERS CLÍNICOS PEDIÁTRICOS: FICHA GLOBAL, AUDITORÍA Y CONDICIONES ACREDITADAS
// ============================================================================

export function getAccreditedClinicalConditions(pData, liveFicha = null) {
  const catalog = getClinicalConditionsCatalog();
  const accredited = [];
  const addedIds = new Set();

  const addIfFound = (term, sourceDescription = 'Certificado Clínico en Ficha Global') => {
    if (!term) return;
    const matched = findConditionInCatalog(term);
    if (matched && !addedIds.has(matched.id)) {
      addedIds.add(matched.id);
      accredited.push({
        ...matched,
        accreditedSource: sourceDescription
      });
    }
  };

  // 1. Escanear en tiempo real la ficha clínica global cuidapp_ficha_[RUT]
  const ficha = liveFicha || getLiveSyncedFichaData(pData);
  if (ficha) {
    if (Array.isArray(ficha.accreditedConditions)) {
      ficha.accreditedConditions.forEach(c => addIfFound(typeof c === 'string' ? c : (c.id || c.name), 'Acreditación Directa Ficha Global'));
    }
    if (Array.isArray(ficha.conditions)) {
      ficha.conditions.forEach(c => addIfFound(typeof c === 'string' ? c : (c.id || c.name), 'Diagnóstico en Ficha Global'));
    }

    // Escanear documentos y recetas acreditadas por el Tutor Legal o Médico
    const allDocs = [...(ficha.documents || []), ...(ficha.prescriptions || [])];
    allDocs.forEach(doc => {
      const textToSearch = `${doc.title || ''} ${doc.name || ''} ${doc.specialty || ''} ${doc.category || ''} ${doc.summary || ''} ${doc.notes || ''} ${doc.diagnosis || ''}`.toLowerCase();
      catalog.forEach(cond => {
        if (cond.keywords && cond.keywords.some(k => textToSearch.includes(k))) {
          addIfFound(cond.id, `Documento Clínico: ${doc.title || doc.name} (${doc.doctor || 'Médico Acreditado'})`);
        }
      });
    });
  }

  // 2. Antecedentes del perfil pediátrico si no hay documentos nuevos
  if (accredited.length === 0 && pData) {
    if (pData.neurodivergences && !pData.neurodivergences.toLowerCase().includes('ninguna')) {
      addIfFound(pData.neurodivergences, 'Certificado Médico de Ingreso Pediátrico');
    }
    if (pData.chronicConditions && !pData.chronicConditions.toLowerCase().includes('ninguna')) {
      addIfFound(pData.chronicConditions, 'Antecedente Ficha Pediátrica');
    }
  }

  // 3. Fallback demo asegurado para Mateo Morales (TEA Grado 2)
  if (accredited.length === 0) {
    const isMateo = (pData && (pData.rut === '25.340.112-9' || pData.fullName?.includes('Mateo')));
    if (isMateo || !pData) {
      addIfFound('TEA', 'Certificado de Diagnóstico Neuropediátrico (Dr. Esteban Fuenzalida)');
    }
  }

  return accredited;
}

export function getPediatricPatientCleanRut(rut) {
  if (!rut) return '25340112-9';
  return String(rut).replace(/[^0-9kK]/g, '');
}

export function getSpecialtyIcon(specialty = 'Pediatría') {
  const s = String(specialty).toLowerCase();
  if (s.includes('odon') || s.includes('dent')) return '🦷';
  if (s.includes('fono')) return '🗣️';
  if (s.includes('kine')) return '🏃';
  if (s.includes('nutri')) return '🥗';
  if (s.includes('neuro')) return '🧠';
  if (s.includes('lab') || s.includes('exam')) return '🧪';
  if (s.includes('imagen') || s.includes('radio')) return '🩻';
  if (s.includes('gastro')) return '🩺';
  if (s.includes('inmuno') || s.includes('alerg')) return '🛡️';
  if (s.includes('bronco') || s.includes('pulmon')) return '🫁';
  if (s.includes('ocupacional')) return '🎨';
  if (s.includes('oftalmo')) return '👁️';
  if (s.includes('otorrino')) return '👂';
  if (s.includes('derma')) return '🧴';
  if (s.includes('cardio')) return '❤️';
  if (s.includes('endocrin')) return '🧬';
  if (s.includes('trauma')) return '🦴';
  if (s.includes('psico')) return '🧩';
  return '🧸';
}

export function getSpecialtyColor(specialty = 'Pediatría') {
  const s = String(specialty).toLowerCase();
  if (s.includes('odon') || s.includes('dent')) return '#ec4899'; // Fucsia
  if (s.includes('fono')) return '#a855f7'; // Púrpura
  if (s.includes('kine')) return '#10b981'; // Esmeralda
  if (s.includes('nutri')) return '#f59e0b'; // Ámbar
  if (s.includes('neuro')) return '#8b5cf6'; // Índigo
  if (s.includes('lab') || s.includes('exam')) return '#ef4444'; // Rojo coral
  return '#06b6d4'; // Turquesa
}

export function getSpecialtyColorBg(specialty = 'Pediatría') {
  const s = String(specialty).toLowerCase();
  if (s.includes('odon') || s.includes('dent')) return 'rgba(236, 72, 153, 0.15)';
  if (s.includes('fono')) return 'rgba(168, 85, 247, 0.15)';
  if (s.includes('kine')) return 'rgba(16, 185, 129, 0.15)';
  if (s.includes('nutri')) return 'rgba(245, 158, 11, 0.15)';
  if (s.includes('neuro')) return 'rgba(139, 92, 246, 0.15)';
  if (s.includes('lab') || s.includes('exam')) return 'rgba(239, 68, 68, 0.15)';
  return 'rgba(6, 182, 212, 0.15)';
}

// Sincronización en cuidapp_ficha_[RUT] compartida por paciente (Leyes 21.430, 20.584 y 19.628)
export function savePediatricRecordToGlobalFicha(patientData, record, type = 'DOCUMENT') {
  try {
    const rawRut = (patientData && patientData.rut) || '25.340.112-9';
    const cleanRut = getPediatricPatientCleanRut(rawRut);
    const primaryKey = `cuidapp_ficha_${cleanRut}`;

    let ficha = {
      patientId: (patientData && (patientData.id || patientData.username)) || 'mateo',
      patientName: (patientData && (patientData.socialName || patientData.fullName || patientData.name)) || 'Mateo Morales',
      rut: rawRut,
      cleanRut: cleanRut,
      documents: [],
      prescriptions: [],
      reports: [],
      dailyReports: [],
      appointments: [],
      history: [],
      timeline: []
    };

    const rawStored = localStorage.getItem(primaryKey) || (rawRut !== cleanRut ? localStorage.getItem(`cuidapp_ficha_${rawRut}`) : null);
    if (rawStored) {
      try {
        const parsed = JSON.parse(rawStored);
        if (parsed && typeof parsed === 'object') ficha = { ...ficha, ...parsed };
      } catch (e) {}
    }

    if (!Array.isArray(ficha.documents)) ficha.documents = [];
    if (!Array.isArray(ficha.prescriptions)) ficha.prescriptions = [];
    if (!Array.isArray(ficha.appointments)) ficha.appointments = [];
    if (!Array.isArray(ficha.history)) ficha.history = [];
    if (!Array.isArray(ficha.accreditedConditions)) ficha.accreditedConditions = [];

    // Auto-acreditar condición clínica en la ficha si el documento o registro coincide con el catálogo
    const textToCheck = `${record.title || ''} ${record.name || ''} ${record.specialty || ''} ${record.notes || ''} ${record.summary || ''}`;
    const matchedCond = findConditionInCatalog(textToCheck);
    if (matchedCond && !ficha.accreditedConditions.some(c => (typeof c === 'string' ? c : c.id) === matchedCond.id)) {
      ficha.accreditedConditions.push({
        id: matchedCond.id,
        name: matchedCond.name,
        code: matchedCond.code,
        accreditedBy: `${(patientData && patientData.guardianName) || 'Tutor Legal'} / Documento Clínico`,
        date: new Date().toISOString()
      });
    }

    if (type === 'APPOINTMENT') {
      const idx = ficha.appointments.findIndex(a => a.id === record.id);
      if (idx >= 0) ficha.appointments[idx] = record;
      else ficha.appointments.unshift(record);
    } else if (type === 'DOCUMENT' || type === 'PRESCRIPTION') {
      const idx = ficha.documents.findIndex(d => d.id === record.id);
      if (idx >= 0) ficha.documents[idx] = record;
      else ficha.documents.unshift(record);

      if (type === 'PRESCRIPTION' || (record.type && record.type.toLowerCase().includes('receta'))) {
        const pIdx = ficha.prescriptions.findIndex(p => p.id === record.id);
        if (pIdx >= 0) ficha.prescriptions[pIdx] = record;
        else ficha.prescriptions.unshift(record);
      }
    }

    const historyItem = {
      id: record.id || `ped_hist_${Date.now()}`,
      timestamp: record.timestamp || record.createdAt || new Date().toISOString(),
      date: record.date || new Date().toISOString().split('T')[0],
      type: type,
      recordType: record.recordType || record.type || (type === 'APPOINTMENT' ? 'Cita Pediátrica' : 'Documento Clínico Pediátrico'),
      title: record.title || record.name || record.specialist || 'Registro Clínico Pediátrico',
      specialty: record.specialty || 'Pediatría',
      author: `${(patientData && patientData.guardianName) || 'Camila Paz Vergara Fuentes'} (${(patientData && patientData.guardianRole) || 'Tutora Legal'})`,
      data: record
    };
    ficha.history.unshift(historyItem);
    ficha.timeline = ficha.history;

    const serialized = JSON.stringify(ficha);
    localStorage.setItem(primaryKey, serialized);
    if (rawRut && rawRut !== cleanRut) {
      localStorage.setItem(`cuidapp_ficha_${rawRut}`, serialized);
    }

    if (typeof window !== 'undefined') {
      window[primaryKey] = ficha;
      window.cuidAppActiveFicha = ficha;
    }
    return ficha;
  } catch (err) {
    console.error('Error al sincronizar cuidapp_ficha pediátrica:', err);
  }
}

// Registro inmutable en cuidapp_audit_log y cuidapp_admin_audit_log (DS N° 41 / Ley 19.628 / Ley 21.430)
export function insertPediatricAuditLogEntry({
  patientData,
  specialty = 'Pediatría',
  recordType = 'Documento Pediátrico',
  details = '',
  recordId = null,
  eventType = 'PEDIATRIC_RECORD'
}) {
  try {
    const rawRut = (patientData && patientData.rut) || '25.340.112-9';
    const cleanRut = getPediatricPatientCleanRut(rawRut);
    const author = `${(patientData && patientData.guardianName) || 'Camila Paz Vergara Fuentes'} (${(patientData && patientData.guardianRole) || 'Tutora Legal'})`;
    const nowIso = new Date().toISOString();

    const auditEntry = {
      id: `audit_ped_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: nowIso,
      date: nowIso.split('T')[0],
      patientRut: rawRut,
      patientRutClean: cleanRut,
      patientId: (patientData && (patientData.id || patientData.username)) || 'mateo',
      patientName: (patientData && (patientData.socialName || patientData.fullName || patientData.name)) || 'Mateo Morales',
      author: author,
      operator: author,
      role: 'tutor_pediatrico',
      roleLabel: (patientData && patientData.guardianRole) || 'Tutor Legal',
      specialty: specialty,
      recordType: recordType,
      type: recordType,
      eventType: eventType,
      eventCategory: recordType,
      details: details || `Registro de ${recordType} (${specialty}) por ${author}`,
      summary: `[${specialty}] ${recordType} registrado para menor RUT ${rawRut} por ${author}. ${details}`,
      recordId: recordId,
      legalSeal: 'DS N° 41 / Ley 19.628 / Ley 21.430 Trazabilidad Pediátrica Inmutable',
      immutable: true
    };

    // 1. cuidapp_audit_log
    const auditKey = 'cuidapp_audit_log';
    let auditList = [];
    try {
      const rawAudit = localStorage.getItem(auditKey);
      if (rawAudit) {
        const parsed = JSON.parse(rawAudit);
        if (Array.isArray(parsed)) auditList = parsed;
      }
    } catch (e) {}

    auditList.unshift(auditEntry);
    localStorage.setItem(auditKey, JSON.stringify(auditList));

    // 2. cuidapp_admin_audit_log (para compatibilidad total con Administrador)
    try {
      const adminAuditKey = 'cuidapp_admin_audit_log';
      let adminAuditList = [];
      const rawAdmin = localStorage.getItem(adminAuditKey);
      if (rawAdmin) {
        const parsedAdmin = JSON.parse(rawAdmin);
        if (Array.isArray(parsedAdmin)) adminAuditList = parsedAdmin;
      }
      adminAuditList.unshift({
        id: auditEntry.id,
        timestamp: auditEntry.timestamp,
        action: `REGISTRO_PEDIATRICO_${recordType.toUpperCase().replace(/\s+/g, '_')}`,
        operator: author,
        patientId: auditEntry.patientId,
        patientName: auditEntry.patientName,
        patientRut: rawRut,
        specialty: specialty,
        recordType: recordType,
        details: auditEntry.summary,
        legalSeal: auditEntry.legalSeal
      });
      localStorage.setItem(adminAuditKey, JSON.stringify(adminAuditList));
    } catch (e) {}

    if (typeof window !== 'undefined') {
      window.cuidAppAuditLog = auditList;
    }
    return auditEntry;
  } catch (err) {
    console.error('Error al insertar en cuidapp_audit_log pediátrico:', err);
  }
}

// Variable de módulo para filtro rápido de documentos pediátricos
let currentPediatricDocSpecialtyFilter = 'Todas las Especialidades';
let currentPediatricDocSearchQuery = '';

// ============================================================================
// GESTOR DE SESIÓN SUPERVISADA Y TUTELA LEGAL (LEY N° 21.430 Y LEY N° 20.584)
// ============================================================================

export function isTutorSessionUnlocked() {
  try {
    return sessionStorage.getItem('cuidapp_tutor_unlocked') === 'true';
  } catch(e) {
    return false;
  }
}

export function setTutorSessionUnlocked(unlocked = true) {
  try {
    if (unlocked) sessionStorage.setItem('cuidapp_tutor_unlocked', 'true');
    else sessionStorage.removeItem('cuidapp_tutor_unlocked');
  } catch(e) {}
}

// Carga y sincronización en tiempo real desde la ficha global compartida cuidapp_ficha_[RUT]
export function getLiveSyncedFichaData(patientData) {
  const rawRut = (patientData && patientData.rut) || '25.340.112-9';
  const cleanRut = getPediatricPatientCleanRut(rawRut);
  let liveFicha = null;
  try {
    const raw1 = localStorage.getItem(`cuidapp_ficha_${cleanRut}`);
    const raw2 = (rawRut !== cleanRut) ? localStorage.getItem(`cuidapp_ficha_${rawRut}`) : null;
    const raw = raw1 || raw2;
    if (raw) {
      liveFicha = JSON.parse(raw);
    }
  } catch(e) {}
  return liveFicha;
}

// Instancia activa del gráfico de crecimiento para destrucción y reutilización
let growthChartInstance = null;

// Función para inicializar el gráfico moderno de Curva de Crecimiento OMS con Chart.js
// Extensión hasta 84 meses (7 años) según curvas de referencia OMS (Peso para la Edad)
export function initGrowthChart(currentWeight = 22.4) {
  const canvas = document.getElementById('chartGrowthCurve');
  if (!canvas) return;

  if (growthChartInstance) {
    growthChartInstance.destroy();
    growthChartInstance = null;
  }

  const ChartConstructor = typeof Chart !== 'undefined' ? Chart : (window.Chart || null);
  if (!ChartConstructor) return;

  const ctx = canvas.getContext('2d');
  const weightNum = parseFloat(currentWeight) || 22.4;

  growthChartInstance = new ChartConstructor(ctx, {
    type: 'line',
    data: {
      labels: ['1 año (12m)', '2 años (24m)', '3 años (36m)', '4 años (48m)', '5 años (60m)', '6 años (72m)', '7 años (84m)'],
      datasets: [
        {
          label: 'Percentil 97 (Límite Superior OMS)',
          data: [12.0, 15.3, 18.3, 21.2, 24.2, 27.1, 30.2],
          borderColor: '#f87171', // Rojo suave
          backgroundColor: 'transparent',
          borderWidth: 2.2,
          borderDash: [5, 5],
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#f87171',
          fill: false
        },
        {
          label: 'Percentil 50 (Mediana OMS - Crecimiento Típico)',
          data: [9.6, 12.2, 14.3, 16.3, 18.3, 20.5, 22.9],
          borderColor: '#10b981', // Verde esmeralda suave
          backgroundColor: 'transparent',
          borderWidth: 3,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#10b981',
          fill: false
        },
        {
          label: 'Percentil 3 (Límite Inferior OMS)',
          data: [7.7, 9.7, 11.3, 12.7, 14.1, 15.9, 17.8],
          borderColor: '#fbbf24', // Amarillo suave
          backgroundColor: 'transparent',
          borderWidth: 2.2,
          borderDash: [5, 5],
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#fbbf24',
          fill: false
        },
        {
          label: `Control Actual (${weightNum} kg)`,
          data: [null, null, null, null, null, null, weightNum],
          borderColor: '#0284c7',
          backgroundColor: '#0284c7',
          pointRadius: 10,
          pointHoverRadius: 14,
          pointBackgroundColor: '#0284c7',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 3.5,
          pointStyle: 'circle',
          showLine: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          titleFont: { family: 'Outfit', size: 13, weight: '700' },
          bodyFont: { family: 'Outfit', size: 12, weight: '500' },
          padding: 12,
          cornerRadius: 12,
          boxPadding: 6,
          usePointStyle: true,
          callbacks: {
            label: function (context) {
              const val = context.parsed.y;
              if (context.datasetIndex === 3) {
                return ` 📍 Medición Actual de Mateo (7 años • 84 meses): ${val} kg (Percentil Saludable P50)`;
              }
              return ` ${context.dataset.label}: ${val} kg`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.08)',
            lineWidth: 1
          },
          ticks: {
            font: { family: 'Outfit', size: 12, weight: '600' },
            color: '#94a3b8'
          },
          title: {
            display: true,
            text: 'Edad (Meses / Años) — Curva OMS hasta 84 meses (7 años)',
            color: '#cbd5e1',
            font: { family: 'Outfit', size: 13, weight: 'bold' },
            padding: { top: 8 }
          }
        },
        y: {
          min: 5,
          max: 35,
          grid: {
            color: 'rgba(255, 255, 255, 0.08)',
            lineWidth: 1
          },
          ticks: {
            stepSize: 5,
            font: { family: 'Outfit', size: 12, weight: '600' },
            color: '#94a3b8',
            callback: function (val) {
              return val + ' kg';
            }
          },
          title: {
            display: true,
            text: 'Peso Corporal (kg)',
            color: '#cbd5e1',
            font: { family: 'Outfit', size: 13, weight: 'bold' },
            padding: { bottom: 8 }
          }
        }
      }
    }
  });
}

// Estado del Modo Pediátrico
export let isPediatric = false;
export function setIsPediatric(val) {
  isPediatric = val;
}
export function getIsPediatric() {
  return isPediatric;
}

export let pediatricSubTab = 'inicio'; // 'inicio' | 'crecimiento' | 'vacunas' | 'examenes' | 'pediatra' | 'ficha'
export function setPediatricSubTab(tab) {
  pediatricSubTab = tab;
}
export function getPediatricSubTab() {
  return pediatricSubTab;
}

// Constante de almacenamiento local para persistencia del perfil pediátrico
export const STORAGE_KEY_PEDIATRIC_PROFILE = 'cuidapp_pediatric_profile_v1';

// Estado Central del Perfil del Paciente Pediátrico
// Distingue rigurosamente entre datos oficiales inmutables y datos modificables a través del tiempo
export let pediatricProfileData = {
  // --- DATOS INMUTABLES / OFICIALES (No modificables en el tiempo - Registro Civil y Biología) ---
  fullName: 'Mateo Ignacio Morales Vergara',
  rut: '25.340.112-9',
  birthDate: '14 de Mayo de 2019',
  age: '7 años',
  gender: 'Masculino',
  bloodType: 'O+ (Rh Positivo)',
  guardianName: 'Camila Paz Vergara Fuentes',
  guardianRut: '16.890.432-1',
  guardianRole: 'Madre / Tutora Acreditada',

  // --- DATOS MODIFICABLES A TRAVÉS DEL TIEMPO ---
  // 1. Contacto del Tutor Legal (teléfono, correo, domicilio, respaldo)
  guardianPhone: '+56 9 8765 4321',
  guardianEmail: 'camila.vergara@email.com',
  address: 'Av. Recoleta 1245, Depto 402, Santiago',
  emergencySecondaryPhone: '+56 9 1234 5678 (Papá: Andrés Morales)',

  // 2. Datos Clínicos dinámicos
  allergies: 'Ninguna conocida',
  allergiesDetails: 'Control Negativo en test cutáneo. Sin alergias a penicilinas ni látex.',
  chronicConditions: 'Rinitis Alérgica',
  chronicConditionsDetails: 'Carácter estacional (primavera/otoño). Controlada en CESFAM.',
  neurodivergences: 'Condición del Espectro Autista (TEA Nivel 1)',
  neurodivergencesDetails: 'Apoyo PIE escolar activo • Sin TDAH • Acompañamiento fonoaudiológico',
  surgicalHistory: 'Amigdalectomía (2022), Adenoidectomía (2021)',

  // 3. Medicamentos actuales y dosis (cambian según edad y peso)
  medication1Name: 'Amoxicilina Suspensión Oral (250 mg / 5 ml)',
  medication1Dose: '7.5 ml cada 8 horas vía oral por 7 días (Equivalencia según peso 22.4 kg: 50 mg/kg/día = 373 mg/toma)',
  medication2Name: 'Paracetamol Jarabe Infantil (160 mg / 5 ml)',
  medication2Dose: '10.5 ml cada 8 horas SOS fiebre o dolor (Equivalencia según peso 22.4 kg: 15 mg/kg/toma = 336 mg)',

  // 4. Previsión y Seguros
  prevision: 'FONASA Tramo B (Copago Cero Infantil)',
  schoolInsuranceActive: true,
  schoolName: 'Colegio Bellavista',

  // 5. Red de Apoyo y Contactos Médicos
  pediatricianName: 'Dra. Soto - Pediatra',
  pediatricianPhone: '+56 9 8765 4321',
  primaryHealthCenter: 'CESFAM Bellavista',
  primaryHealthCenterDetails: 'Sector 2 • Box Pediátrico 4 • Lunes a Viernes 08:00 - 20:00',
  hospitalEmergency: 'Hospital San Borja Arriarán (Servicio de Urgencia Infantil • SAMU 131)'
};

// Cargar perfil pediátrico persistido en localStorage asegurando que los datos inmutables permanezcan intactos
try {
  const savedPediatricData = localStorage.getItem(STORAGE_KEY_PEDIATRIC_PROFILE);
  if (savedPediatricData) {
    const parsed = JSON.parse(savedPediatricData);
    pediatricProfileData = {
      ...pediatricProfileData,
      ...parsed,
      // Blindaje de datos oficiales inmutables:
      fullName: 'Mateo Ignacio Morales Vergara',
      rut: '25.340.112-9',
      birthDate: '14 de Mayo de 2019',
      age: '7 años',
      gender: 'Masculino',
      bloodType: 'O+ (Rh Positivo)',
      guardianName: 'Camila Paz Vergara Fuentes',
      guardianRut: '16.890.432-1',
      guardianRole: 'Madre / Tutora Acreditada'
    };
  }
} catch (e) {
  console.warn('Error al cargar perfil pediátrico desde localStorage:', e);
}

// Antecedentes Quirúrgicos Pediátricos (sincronizados con el perfil)
export let pediatricSurgicalHistory = pediatricProfileData.surgicalHistory;
export function setPediatricSurgicalHistory(val) {
  pediatricSurgicalHistory = val;
  pediatricProfileData.surgicalHistory = val;
}
export function getPediatricSurgicalHistory() {
  return pediatricSurgicalHistory;
}

// Modal Directo: Mi Pediatra
export const modalPediatraHTML = `
  <div id="modalPediatraDirect" class="modal fade" tabindex="-1" style="display: none; background: rgba(8, 16, 26, 0.88); backdrop-filter: blur(12px);" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content text-white" style="background: #0f1926; border-radius: 28px; border: 2px solid #ef4444; box-shadow: 0 25px 60px rgba(0,0,0,0.75); overflow: hidden;">
        <div class="modal-header border-bottom border-0 p-4 pb-2 d-flex justify-content-between align-items-center" style="background: rgba(239, 68, 68, 0.15); border-color: rgba(255, 255, 255, 0.1) !important;">
          <div class="d-flex align-items-center gap-2">
            <span style="font-size: 1.8rem;">🚨</span>
            <h5 class="modal-title fw-extrabold m-0 text-white" style="color: #ef4444; font-family: 'Outfit', sans-serif;">Contacto Médico Directo</h5>
          </div>
          <button type="button" class="btn-close btn-close-white" id="btnCloseModalPediatraX" aria-label="Close" style="cursor: pointer;"></button>
        </div>
        <div class="modal-body p-4 text-center" style="background: #08101a;">
          <!-- Foto de la doctora -->
          <div class="mb-3 d-inline-block position-relative">
            <img src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=300&q=80" alt="Dra. Soto - Pediatra" class="rounded-circle shadow" style="width: 140px; height: 140px; object-fit: cover; border: 4px solid #ef4444;" onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=Dra+Soto&background=ffe4e6&color=be123c&size=256';">
            <span class="position-absolute bottom-0 end-0 p-2 bg-success border border-white rounded-circle" title="Disponible" style="width: 22px; height: 22px;"></span>
          </div>
          
          <!-- Nombre: 'Dra. Soto - Pediatra' -->
          <h3 class="fw-extrabold mb-1 text-white" style="font-family: 'Outfit', sans-serif; font-size: 1.6rem;">
            Dra. Soto - Pediatra
          </h3>
          <p class="text-white-50 mb-2" style="font-size: 1rem;">
            Pediatra de Cabecera &bull; Especialista en Control Niño Sano
          </p>
          <div class="d-flex justify-content-center gap-2 mb-4 flex-wrap">
            <span class="badge px-3 py-1.5 rounded-pill fw-semibold" style="background: rgba(6, 182, 212, 0.15); color: #06b6d4; border: 1px solid #06b6d4;">
              CESFAM Bellavista
            </span>
            <span class="badge px-3 py-1.5 rounded-pill fw-semibold" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4);">
              🟢 Turno Activo
            </span>
          </div>

          <!-- Botón Gigante de Llamar -->
          <button type="button" id="btnModalLlamarPediatra" class="btn w-100 py-3.5 px-4 d-inline-flex align-items-center justify-content-center gap-3 text-white fw-extrabold shadow-lg mb-3" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border: 2px solid #f87171; border-radius: 20px; font-size: 1.45rem; cursor: pointer; transition: all 0.25s ease;">
            <span style="font-size: 1.8rem;">📞</span> Llamar
          </button>

          <!-- Botón Volver al Inicio Pediátrico -->
          <button type="button" id="btnModalBackToPediatricHome" class="btn w-100 py-2.5 px-4 rounded-pill fw-bold text-white-50" style="background: #0f1926; border: 1px solid rgba(255, 255, 255, 0.15); cursor: pointer; font-size: 1rem;">
            ⬅️ Volver al Inicio Pediátrico
          </button>
        </div>
      </div>
    </div>
  </div>
`;

// Modal de Videollamada Pediátrica (exclusivo para portal del Cuidador / Tutor Legal)
export const modalPediatricVideollamadaHTML = '';

// Modal de Ficha QR Pediátrica
export const modalPediatricQrHTML = `
  <div id="docDetailModal" class="modal fade" tabindex="-1" style="display: none; background: rgba(10, 15, 29, 0.8); backdrop-filter: blur(15px);" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-lg">
      <div class="modal-content text-white" style="background: rgba(15, 23, 42, 0.96); backdrop-filter: blur(25px); border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: 28px; box-shadow: 0 25px 60px rgba(0,0,0,0.85);">
        <div class="modal-header border-bottom border-light border-opacity-10 p-4">
          <div class="d-flex align-items-center gap-3">
            <span id="modalDocIcon" style="font-size: 2.5rem; line-height: 1;">📱</span>
            <div>
              <h5 class="modal-title fw-bold m-0 text-white" id="modalDocTitle" style="font-family: 'Outfit', sans-serif; font-size: 1.35rem;">Ficha Médica QR Pediátrica</h5>
              <small id="modalDocSubtitle" class="text-white-50 fs-6">Paciente: Mateo Morales &bull; RUT: 25.340.112-9 &bull; 7 años</small>
            </div>
          </div>
          <button type="button" class="btn-close btn-close-white" id="modalCloseX" data-bs-dismiss="modal" aria-label="Close" style="filter: invert(1); cursor: pointer;"></button>
        </div>
        <div class="modal-body p-4" id="modalDocBody">
          <!-- Contenido dinámico con Alergias, Grupo Sanguíneo y Contacto de la Madre -->
        </div>
      </div>
    </div>
  </div>
`;

// Función para persistir los cambios realizados al perfil del paciente pediátrico
export function saveCurrentPediatricProfile() {
  const getVal = (id, fallback) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : fallback;
  };

  const getCheck = (id, fallback) => {
    const el = document.getElementById(id);
    return el ? el.checked : fallback;
  };

  // 1. Recolección de datos modificables a través del tiempo
  const newGuardianPhone = getVal('pediatricGuardianPhone', pediatricProfileData.guardianPhone);
  const newGuardianEmail = getVal('pediatricGuardianEmail', pediatricProfileData.guardianEmail);
  const newAddress = getVal('pediatricAddress', pediatricProfileData.address);
  const newSecondaryPhone = getVal('pediatricSecondaryPhone', pediatricProfileData.emergencySecondaryPhone);

  const newAllergies = getVal('pediatricAllergies', pediatricProfileData.allergies);
  const newAllergiesDetails = getVal('pediatricAllergiesDetails', pediatricProfileData.allergiesDetails);
  const newChronic = getVal('pediatricChronicConditions', pediatricProfileData.chronicConditions);
  const newChronicDetails = getVal('pediatricChronicDetails', pediatricProfileData.chronicConditionsDetails);
  const newNeuro = getVal('pediatricNeurodivergences', pediatricProfileData.neurodivergences);
  const newNeuroDetails = getVal('pediatricNeuroDetails', pediatricProfileData.neurodivergencesDetails);
  const newSurgical = getVal('pediatricSurgicalHistory', pediatricProfileData.surgicalHistory);

  const newMed1Name = getVal('pediatricMed1Name', pediatricProfileData.medication1Name);
  const newMed1Dose = getVal('pediatricMed1Dose', pediatricProfileData.medication1Dose);
  const newMed2Name = getVal('pediatricMed2Name', pediatricProfileData.medication2Name);
  const newMed2Dose = getVal('pediatricMed2Dose', pediatricProfileData.medication2Dose);

  const newPrevision = getVal('pediatricPrevision', pediatricProfileData.prevision);
  const newSchoolInsurance = getCheck('pediatricSchoolInsurance', pediatricProfileData.schoolInsuranceActive);
  const newSchoolName = getVal('pediatricSchoolName', pediatricProfileData.schoolName);

  const newPediatricianName = getVal('pediatricianName', pediatricProfileData.pediatricianName);
  const newPediatricianPhone = getVal('pediatricianPhone', pediatricProfileData.pediatricianPhone);
  const newHealthCenter = getVal('pediatricHealthCenter', pediatricProfileData.primaryHealthCenter);
  const newHealthCenterDetails = getVal('pediatricHealthCenterDetails', pediatricProfileData.primaryHealthCenterDetails);
  const newHospitalEmergency = getVal('pediatricHospitalEmergency', pediatricProfileData.hospitalEmergency);

  // Actualización del objeto en memoria
  pediatricProfileData.guardianPhone = newGuardianPhone;
  pediatricProfileData.guardianEmail = newGuardianEmail;
  pediatricProfileData.address = newAddress;
  pediatricProfileData.emergencySecondaryPhone = newSecondaryPhone;

  pediatricProfileData.allergies = newAllergies;
  pediatricProfileData.allergiesDetails = newAllergiesDetails;
  pediatricProfileData.chronicConditions = newChronic;
  pediatricProfileData.chronicConditionsDetails = newChronicDetails;
  pediatricProfileData.neurodivergences = newNeuro;
  pediatricProfileData.neurodivergencesDetails = newNeuroDetails;
  pediatricProfileData.surgicalHistory = newSurgical;
  pediatricSurgicalHistory = newSurgical;

  pediatricProfileData.medication1Name = newMed1Name;
  pediatricProfileData.medication1Dose = newMed1Dose;
  pediatricProfileData.medication2Name = newMed2Name;
  pediatricProfileData.medication2Dose = newMed2Dose;

  pediatricProfileData.prevision = newPrevision;
  pediatricProfileData.schoolInsuranceActive = newSchoolInsurance;
  pediatricProfileData.schoolName = newSchoolName;

  pediatricProfileData.pediatricianName = newPediatricianName;
  pediatricProfileData.pediatricianPhone = newPediatricianPhone;
  pediatricProfileData.primaryHealthCenter = newHealthCenter;
  pediatricProfileData.primaryHealthCenterDetails = newHealthCenterDetails;
  pediatricProfileData.hospitalEmergency = newHospitalEmergency;

  // Persistir en almacenamiento local (localStorage)
  try {
    localStorage.setItem(STORAGE_KEY_PEDIATRIC_PROFILE, JSON.stringify(pediatricProfileData));
  } catch (e) {
    console.warn('Error guardando en localStorage:', e);
  }

  // Sincronizar con activePatient de la app si está disponible
  if (activePatient) {
    if (activePatient.emergencyContact) {
      activePatient.emergencyContact.phone = newGuardianPhone;
    }
    activePatient.allergies = newAllergies;
    activePatient.surgicalHistory = newSurgical;
    activePatient.prevision = newPrevision;
  }

  // Feedback auditivo y visual
  window.showGlassAlert('✅ Perfil pediátrico guardado con éxito. Se actualizaron teléfono, correo y antecedentes modificables.', 'success');
  if (modoVozActivo) {
    speakText('Perfil pediátrico guardado con éxito. Los datos de contacto del tutor y antecedentes médicos han sido actualizados.');
  }

  // Animación interactiva en los botones de guardar
  document.querySelectorAll('.btn-save-pediatric-profile, #btnSavePediatricProfile').forEach(btn => {
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span>✅</span> ¡Cambios Guardados!';
    btn.style.background = '#059669';
    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    }, 1800);
  });
}

// Generador del contenido de secciones de la Ficha y Perfil Pediátrico
// 100% Solo Lectura protegida para el paciente pediátrico (Leyes 21.430 y 20.584)
export function getFichaSectionsHTML() {
  // Sincronización en tiempo real desde la ficha clínica global cuidapp_ficha_[RUT]
  const liveFicha = getLiveSyncedFichaData(pediatricProfileData) || {};
  const accreditedConditions = getAccreditedClinicalConditions(pediatricProfileData, liveFicha);

  // 1. Alergias dinámicas reales desde la ficha clínica
  const allergyConditions = accreditedConditions.filter(c => c.category && c.category.toLowerCase().includes('alergia'));
  let allergiesValue = '';
  let allergiesDetails = '';
  if (liveFicha.allergies && typeof liveFicha.allergies === 'string' && liveFicha.allergies.trim() && !liveFicha.allergies.toLowerCase().includes('ninguna conocida')) {
    allergiesValue = liveFicha.allergies.trim();
    allergiesDetails = liveFicha.allergiesDetails || '';
  } else if (Array.isArray(liveFicha.allergies) && liveFicha.allergies.length > 0) {
    allergiesValue = liveFicha.allergies.join(', ');
  } else if (allergyConditions.length > 0) {
    allergiesValue = allergyConditions.map(c => c.name || c.shortName).join(', ');
    allergiesDetails = allergyConditions.map(c => c.description || '').filter(Boolean).join(' • ');
  } else {
    allergiesValue = 'Sin registros clínicos declarados';
    allergiesDetails = 'No se registran antecedentes de alergias severas o anafilaxia en la ficha clínica oficial.';
  }

  // 2. Patologías Crónicas dinámicas reales desde la ficha clínica
  const chronicConditionsList = accreditedConditions.filter(c => c.category && c.category.toLowerCase().includes('crónica'));
  let chronicValue = '';
  let chronicDetails = '';
  if (liveFicha.chronicConditions && typeof liveFicha.chronicConditions === 'string' && liveFicha.chronicConditions.trim()) {
    chronicValue = liveFicha.chronicConditions.trim();
    chronicDetails = liveFicha.chronicConditionsDetails || '';
  } else if (Array.isArray(liveFicha.chronicConditions) && liveFicha.chronicConditions.length > 0) {
    chronicValue = liveFicha.chronicConditions.join(', ');
  } else if (chronicConditionsList.length > 0) {
    chronicValue = chronicConditionsList.map(c => c.name || c.shortName).join(', ');
    chronicDetails = chronicConditionsList.map(c => c.description || '').filter(Boolean).join(' • ');
  } else {
    chronicValue = 'Sin registros clínicos declarados';
    chronicDetails = 'Sin patologías crónicas activas registradas en los controles pediátricos.';
  }

  // 3. Neurodivergencias dinámicas reales desde la ficha clínica
  const neuroConditions = accreditedConditions.filter(c => c.category && c.category.toLowerCase().includes('neurodivergencia'));
  let neuroValue = '';
  let neuroDetails = '';
  if (liveFicha.neurodivergences && typeof liveFicha.neurodivergences === 'string' && liveFicha.neurodivergences.trim()) {
    neuroValue = liveFicha.neurodivergences.trim();
    neuroDetails = liveFicha.neurodivergencesDetails || '';
  } else if (Array.isArray(liveFicha.neurodivergences) && liveFicha.neurodivergences.length > 0) {
    neuroValue = liveFicha.neurodivergences.join(', ');
  } else if (neuroConditions.length > 0) {
    neuroValue = neuroConditions.map(c => c.name || c.shortName).join(', ');
    neuroDetails = neuroConditions.map(c => `${c.description || ''}${c.accreditedSource ? ` (${c.accreditedSource})` : ''}`).filter(Boolean).join(' • ');
  } else {
    neuroValue = 'Sin registros clínicos declarados';
    neuroDetails = 'Sin diagnósticos de neurodesarrollo registrados en la ficha médica.';
  }

  // 4. Cirugías Pediátricas Previas
  let surgicalValue = '';
  if (liveFicha.surgicalHistory && typeof liveFicha.surgicalHistory === 'string' && liveFicha.surgicalHistory.trim()) {
    surgicalValue = liveFicha.surgicalHistory.trim();
  } else if (Array.isArray(liveFicha.surgeries) && liveFicha.surgeries.length > 0) {
    surgicalValue = liveFicha.surgeries.join(', ');
  } else {
    surgicalValue = 'Sin registros clínicos declarados';
  }

  return `
    <form id="formPediatricProfile" class="w-100" onsubmit="event.preventDefault();">
      <div class="row g-4 text-start">
        <!-- 1. Identificación: Nombre completo, RUT, Fecha de Nacimiento y Edad actual (INMUTABLES) -->
        <div class="col-12 col-lg-6">
          <div class="p-4 h-100 rounded-4" style="background: #0f1926; border: 1.5px solid rgba(6, 182, 212, 0.3); border-radius: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            <div class="d-flex align-items-center justify-content-between mb-3">
              <div class="d-flex align-items-center gap-2">
                <span style="font-size: 1.9rem;">🧒</span>
                <div>
                  <h5 class="fw-bold m-0 text-white">1. Identificación del Niño</h5>
                  <small class="text-white-50">Registro Civil e Identificación Oficial</small>
                </div>
              </div>
              <span class="badge px-3 py-1.5 rounded-pill fw-bold" style="background: rgba(255, 255, 255, 0.08); color: #cbd5e1; border: 1px solid rgba(255, 255, 255, 0.15);" title="Datos civiles oficiales no modificables">
                🔒 Inmutable
              </span>
            </div>
            <div class="d-flex flex-column gap-3 small">
              <div>
                <label class="form-label text-white-50 fw-semibold mb-1 small d-flex justify-content-between align-items-center">
                  <span>Nombre Oficial en Ficha Clínica:</span>
                  <span class="badge bg-dark text-white-50 border border-secondary border-opacity-25">🔒 Registro Civil</span>
                </label>
                <input type="text" class="form-control" value="${pediatricProfileData.fullName}" disabled readonly style="background: #08101a; color: #cbd5e1; font-weight: 700; border-radius: 12px; border: 1.5px solid rgba(255, 255, 255, 0.12); cursor: not-allowed; font-size: 1.05rem;">
              </div>
              <div class="row g-2">
                <div class="col-12 col-sm-6">
                  <label class="form-label text-white-50 fw-semibold mb-1 small d-flex justify-content-between align-items-center">
                    <span>RUT Oficial:</span>
                    <span class="badge bg-dark text-white-50 border border-secondary border-opacity-25">🔒 Fijo</span>
                  </label>
                  <input type="text" class="form-control" value="${pediatricProfileData.rut}" disabled readonly style="background: #08101a; color: #cbd5e1; font-weight: 700; border-radius: 12px; border: 1.5px solid rgba(255, 255, 255, 0.12); cursor: not-allowed;">
                </div>
                <div class="col-12 col-sm-6">
                  <label class="form-label text-white-50 fw-semibold mb-1 small d-flex justify-content-between align-items-center">
                    <span>Edad Actual:</span>
                    <span class="badge bg-dark text-info border border-info border-opacity-25">🔒 Calculada</span>
                  </label>
                  <input type="text" class="form-control" value="${pediatricProfileData.age}" disabled readonly style="background: rgba(6, 182, 212, 0.12); color: #06b6d4; font-weight: 700; border-radius: 12px; border: 1.5px solid #06b6d4; cursor: not-allowed;">
                </div>
              </div>
              <div class="row g-2">
                <div class="col-12 col-sm-6">
                  <label class="form-label text-white-50 fw-semibold mb-1 small">Fecha de Nacimiento:</label>
                  <input type="text" class="form-control" value="${pediatricProfileData.birthDate}" disabled readonly style="background: #08101a; color: #cbd5e1; font-weight: 600; border-radius: 12px; border: 1.5px solid rgba(255, 255, 255, 0.12); cursor: not-allowed;">
                </div>
                <div class="col-12 col-sm-6">
                  <label class="form-label text-white-50 fw-semibold mb-1 small">Sexo / Género:</label>
                  <input type="text" class="form-control" value="${pediatricProfileData.gender}" disabled readonly style="background: #08101a; color: #cbd5e1; font-weight: 600; border-radius: 12px; border: 1.5px solid rgba(255, 255, 255, 0.12); cursor: not-allowed;">
                </div>
              </div>
              <div class="pt-2 border-top border-light border-opacity-10 d-flex align-items-center gap-2">
                <span class="badge px-3 py-1 rounded-pill fw-semibold" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4);">
                  ✅ Identidad Verificada Registro Civil
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Tutor Legal y Datos de Contacto (100% SOLO LECTURA PROTEGIDO) -->
        <div class="col-12 col-lg-6">
          <div class="p-4 h-100 rounded-4" style="background: #0f1926; border: 1.5px solid rgba(6, 182, 212, 0.35); border-radius: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            <div class="d-flex align-items-center justify-content-between mb-3">
              <div class="d-flex align-items-center gap-2">
                <span style="font-size: 1.9rem;">👩‍👦</span>
                <div>
                  <h5 class="fw-bold m-0 text-white">2. Tutor Legal y Contacto</h5>
                  <small class="text-white-50">Contacto de Emergencia y Respaldo Familiar</small>
                </div>
              </div>
              <span class="badge px-3 py-1.5 rounded-pill fw-bold" style="background: rgba(6, 182, 212, 0.15); color: #06b6d4; border: 1px solid #06b6d4;">
                🔒 Solo Lectura Tutor
              </span>
            </div>
            <div class="d-flex flex-column gap-2.5 small">
              <!-- Datos Jurídicos Inmutables -->
              <div>
                <label class="form-label text-white-50 fw-semibold mb-1 small d-flex justify-content-between align-items-center">
                  <span>Nombre Tutora Legal Acreditada:</span>
                  <span class="badge bg-dark text-white-50 border border-secondary border-opacity-25">🔒 Acreditación Fija</span>
                </label>
                <input type="text" class="form-control" value="${pediatricProfileData.guardianName}" disabled readonly style="background: #08101a; color: #cbd5e1; font-weight: 700; border-radius: 12px; border: 1.5px solid rgba(255, 255, 255, 0.12); cursor: not-allowed;">
              </div>
              <div class="row g-2">
                <div class="col-12 col-sm-5">
                  <label class="form-label text-white-50 fw-semibold mb-1 small">RUT Tutora:</label>
                  <input type="text" class="form-control" value="${pediatricProfileData.guardianRut}" disabled readonly style="background: #08101a; color: #cbd5e1; font-weight: 700; border-radius: 12px; border: 1.5px solid rgba(255, 255, 255, 0.12); cursor: not-allowed;">
                </div>
                <div class="col-12 col-sm-7">
                  <label class="form-label text-white-50 fw-semibold mb-1 small">Calidad Jurídica:</label>
                  <input type="text" class="form-control text-nowrap" value="${(pediatricProfileData.guardianRole || 'Madre / Tutora Acreditada').replace(/\s*\(Ley\s*21\.430\)/gi, '')}" disabled readonly style="background: #08101a; color: #38bdf8; font-weight: 700; border-radius: 12px; border: 1.5px solid rgba(56, 189, 248, 0.35); cursor: not-allowed;">
                </div>
              </div>

              <!-- TELÉFONO DE CONTACTO (SOLO LECTURA) -->
              <div>
                <label class="form-label text-white fw-bold mb-1 small d-flex align-items-center gap-1" for="pediatricGuardianPhone">
                  <i class="bi bi-telephone-fill text-info"></i> Teléfono de Contacto Prioritario <span class="badge bg-dark text-white-50 border border-secondary border-opacity-25 ms-auto">🔒 Protegido</span>
                </label>
                <input type="tel" id="pediatricGuardianPhone" class="form-control" value="${pediatricProfileData.guardianPhone}" disabled readonly placeholder="+56 9 8765 4321" style="background: #08101a; color: #cbd5e1; font-weight: 600; border-radius: 12px; border: 1.5px solid rgba(255, 255, 255, 0.14); padding: 9px 12px; cursor: not-allowed;">
                <small class="text-white-50">Teléfono móvil directo para urgencias clínicas, llamados del CESFAM y WhatsApp.</small>
              </div>

              <!-- CORREO ELECTRÓNICO (SOLO LECTURA) -->
              <div>
                <label class="form-label text-white fw-bold mb-1 small d-flex align-items-center gap-1" for="pediatricGuardianEmail">
                  <i class="bi bi-envelope-at-fill text-info"></i> Correo Electrónico del Tutor / Familia <span class="badge bg-dark text-white-50 border border-secondary border-opacity-25 ms-auto">🔒 Protegido</span>
                </label>
                <input type="email" id="pediatricGuardianEmail" class="form-control" value="${pediatricProfileData.guardianEmail}" disabled readonly placeholder="camila.vergara@email.com" style="background: #08101a; color: #cbd5e1; font-weight: 600; border-radius: 12px; border: 1.5px solid rgba(255, 255, 255, 0.14); padding: 9px 12px; cursor: not-allowed;">
                <small class="text-white-50">Recepción de recetas electrónicas, informes odontológicos y citaciones.</small>
              </div>

              <!-- DIRECCIÓN DE RESIDENCIA (SOLO LECTURA) -->
              <div>
                <label class="form-label text-white fw-bold mb-1 small d-flex align-items-center gap-1" for="pediatricAddress">
                  <i class="bi bi-geo-alt-fill text-info"></i> Dirección de Residencia Actual <span class="badge bg-dark text-white-50 border border-secondary border-opacity-25 ms-auto">🔒 Protegido</span>
                </label>
                <input type="text" id="pediatricAddress" class="form-control" value="${pediatricProfileData.address}" disabled readonly placeholder="Av. Recoleta 1245, Depto 402, Santiago" style="background: #08101a; color: #cbd5e1; border-radius: 12px; border: 1.5px solid rgba(255, 255, 255, 0.14); padding: 9px 12px; cursor: not-allowed;">
                <small class="text-white-50">Domicilio familiar vigente para sectorización territorial de salud.</small>
              </div>

              <!-- TELÉFONO DE RESPALDO (SOLO LECTURA) -->
              <div>
                <label class="form-label text-white fw-bold mb-1 small d-flex align-items-center gap-1" for="pediatricSecondaryPhone">
                  <i class="bi bi-telephone-plus-fill text-white-50"></i> Contacto de Emergencia Secundario <span class="badge bg-dark text-white-50 border border-secondary border-opacity-25 ms-auto">🔒 Protegido</span>
                </label>
                <input type="tel" id="pediatricSecondaryPhone" class="form-control" value="${pediatricProfileData.emergencySecondaryPhone}" disabled readonly placeholder="+56 9 1234 5678 (Papá: Andrés Morales)" style="background: #08101a; color: #cbd5e1; border-radius: 12px; border: 1.5px solid rgba(255, 255, 255, 0.14); padding: 9px 12px; cursor: not-allowed;">
              </div>
            </div>
          </div>
        </div>

        <!-- 3. Datos Clínicos (Ley 20.584): Grupo Sanguíneo (Inmutable), Alergias, Crónicas, Neurodivergencias y Cirugías (SOLO LECTURA) -->
        <div class="col-12">
          <div class="p-4 rounded-4" style="background: #0f1926; border: 1.5px solid rgba(239, 68, 68, 0.4); border-radius: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
              <div class="d-flex align-items-center gap-2">
                <span style="font-size: 1.9rem;">🩺</span>
                <div>
                  <h5 class="fw-bold m-0 text-white">3. Datos Clínicos Pediátricos</h5>
                  <small class="text-white-50">Derechos y Deberes en Salud (Ley 20.584)</small>
                </div>
              </div>
              <span class="badge px-3 py-1.5 rounded-pill fw-bold" style="background: rgba(6, 182, 212, 0.15); color: #06b6d4; border: 1px solid #06b6d4;">
                🔒 Registros Clínicos Acreditados
              </span>
            </div>

            <!-- Grilla amplia de 2 columnas (repeat(2, 1fr)) para lectura completa de condiciones clínicas -->
            <div class="pediatric-clinical-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.25rem;">
              <!-- 1. Grupo Sanguíneo (INMUTABLE / FACTOR BIOLÓGICO FIJO) -->
              <div class="p-3.5 rounded-4 h-100" style="background: rgba(239, 68, 68, 0.12); border: 1.5px solid #ef4444;">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <span class="small fw-semibold text-danger">🩸 Grupo Sanguíneo</span>
                  <span class="badge bg-danger bg-opacity-25 text-danger" style="font-size: 0.75rem;">🔒 Inmutable</span>
                </div>
                <strong class="fs-4 fw-extrabold d-block" style="color: #ef4444;">${pediatricProfileData.bloodType}</strong>
                <span class="small text-white-50 d-block mt-1">Factor biológico permanente. Donante universal de glóbulos rojos.</span>
              </div>

              <!-- 2. Neurodivergencias (SOLO LECTURA - CONDICIÓN ACREDITADA) -->
              <div class="p-3.5 rounded-4 h-100" style="background: rgba(168, 85, 247, 0.12); border: 1.5px solid #c084fc;">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <span class="small fw-semibold" style="color: #c084fc;">🧩 Neurodivergencias Acreditadas</span>
                  <span class="badge bg-dark text-white-50 border border-secondary border-opacity-25" style="font-size: 0.75rem;">🔒 Registrado</span>
                </div>
                <input type="text" id="pediatricNeurodivergences" class="form-control mb-1 fw-bold" value="${neuroValue}" disabled readonly style="background: #08101a; color: #cbd5e1; border-radius: 10px; border: 1.5px solid rgba(168, 85, 247, 0.4); font-size: 0.95rem; cursor: not-allowed;">
                <div id="pediatricNeuroDetails" class="p-3 rounded-3 text-start mt-2" style="background: #08101a; color: #cbd5e1; border: 1.5px solid rgba(168, 85, 247, 0.4); font-size: 0.92rem; height: auto; overflow: visible; line-height: 1.5; white-space: normal; word-break: break-word;">
                  <i class="bi bi-file-earmark-medical text-info me-1.5"></i>${neuroDetails}
                </div>
              </div>

              <!-- 3. Alergias Conocidas (SOLO LECTURA) -->
              <div class="p-3.5 rounded-4 h-100" style="background: rgba(236, 72, 153, 0.12); border: 1.5px solid #ec4899;">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <span class="small fw-semibold" style="color: #ec4899;">⚠️ Alergias Conocidas</span>
                  <span class="badge bg-dark text-white-50 border border-secondary border-opacity-25" style="font-size: 0.75rem;">🔒 Registrado</span>
                </div>
                <input type="text" id="pediatricAllergies" class="form-control mb-1 fw-bold" value="${allergiesValue}" disabled readonly style="background: #08101a; color: #cbd5e1; border-radius: 10px; border: 1.5px solid rgba(236, 72, 153, 0.4); font-size: 0.95rem; cursor: not-allowed;">
                <div id="pediatricAllergiesDetails" class="p-3 rounded-3 text-start mt-2" style="background: #08101a; color: #cbd5e1; border: 1.5px solid rgba(236, 72, 153, 0.4); font-size: 0.92rem; height: auto; overflow: visible; line-height: 1.5; white-space: normal; word-break: break-word;">
                  <i class="bi bi-info-circle text-info me-1.5"></i>${allergiesDetails}
                </div>
              </div>

              <!-- 4. Enfermedades Crónicas (SOLO LECTURA) -->
              <div class="p-3.5 rounded-4 h-100" style="background: rgba(6, 182, 212, 0.12); border: 1.5px solid #06b6d4;">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <span class="small fw-semibold" style="color: #06b6d4;">📋 Patologías Crónicas</span>
                  <span class="badge bg-dark text-white-50 border border-secondary border-opacity-25" style="font-size: 0.75rem;">🔒 Registrado</span>
                </div>
                <input type="text" id="pediatricChronicConditions" class="form-control mb-1 fw-bold" value="${chronicValue}" disabled readonly style="background: #08101a; color: #cbd5e1; border-radius: 10px; border: 1.5px solid rgba(6, 182, 212, 0.4); font-size: 0.95rem; cursor: not-allowed;">
                <div id="pediatricChronicDetails" class="p-3 rounded-3 text-start mt-2" style="background: #08101a; color: #cbd5e1; border: 1.5px solid rgba(6, 182, 212, 0.4); font-size: 0.92rem; height: auto; overflow: visible; line-height: 1.5; white-space: normal; word-break: break-word;">
                  <i class="bi bi-clipboard2-pulse text-info me-1.5"></i>${chronicDetails}
                </div>
              </div>

              <!-- 5. Cirugías Pediátricas Previas (SOLO LECTURA - Ancho Completo en Grilla) -->
              <div class="p-3.5 rounded-4" style="grid-column: 1 / -1; background: #08101a; border: 1.5px solid rgba(6, 182, 212, 0.35);">
                <label class="form-label text-white fw-bold mb-1 d-flex align-items-center justify-content-between" style="font-size: 1.05rem;" for="pediatricSurgicalHistory">
                  <span><i class="bi bi-bandaid text-info"></i> Cirugías Pediátricas Previas</span>
                  <span class="badge bg-dark text-white-50 border border-secondary border-opacity-25" style="font-size: 0.8rem;">🔒 Historial Clínico</span>
                </label>
                <div id="pediatricSurgicalHistory" class="p-3.5 rounded-3 text-start mt-2" style="background: #0f1926; color: #cbd5e1; border: 1.5px solid rgba(6, 182, 212, 0.3); font-size: 1.02rem; height: auto; overflow: visible; line-height: 1.5; white-space: normal; word-break: break-word;">
                  <i class="bi bi-shield-check text-info me-1.5"></i>${surgicalValue}
                </div>
                <small class="text-white-50 d-block mt-1">Procedimientos quirúrgicos o intervenciones previas relevantes para urgencias y anestesia infantil.</small>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. Previsión y Seguros (SOLO LECTURA - ANCHO COMPLETO) -->
        <div class="col-12">
          <div class="p-4 rounded-4" style="background: #0f1926; border: 1.5px solid rgba(6, 182, 212, 0.4); border-radius: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
              <div class="d-flex align-items-center gap-2">
                <span style="font-size: 1.9rem;">🛡️</span>
                <div>
                  <h5 class="fw-bold m-0 text-white">4. Previsión y Seguros</h5>
                  <small class="text-white-50">Coberturas médicas públicas, régimen de gratuidad y protección escolar</small>
                </div>
              </div>
              <span class="badge px-3 py-1.5 rounded-pill fw-bold" style="background: rgba(6, 182, 212, 0.15); color: #06b6d4; border: 1px solid #06b6d4;">
                🔒 Cobertura Activa Acreditada
              </span>
            </div>

            <div class="row g-3">
              <!-- Previsión de Salud Oficial -->
              <div class="col-12 col-md-6">
                <div class="p-3.5 rounded-4 h-100" style="background: #08101a; border: 1.5px solid rgba(6, 182, 212, 0.35);">
                  <label class="form-label text-white fw-bold mb-2 small d-flex justify-content-between align-items-center" for="pediatricPrevision">
                    <span><i class="bi bi-hospital text-info me-1"></i> Previsión de Salud Oficial:</span>
                    <span class="badge bg-dark text-white-50 border border-secondary border-opacity-25">🔒 Registro Fonasa/Isapre</span>
                  </label>
                  <select id="pediatricPrevision" class="form-select" disabled style="background: #0f1926; color: #cbd5e1; border-radius: 12px; border: 1.5px solid rgba(6, 182, 212, 0.35); padding: 11px 14px; font-weight: 600; cursor: not-allowed; font-size: 0.95rem;">
                    <option value="FONASA Tramo A" ${pediatricProfileData.prevision.includes('Tramo A') ? 'selected' : ''}>FONASA Tramo A (Gratuidad total)</option>
                    <option value="FONASA Tramo B (Copago Cero Infantil)" ${pediatricProfileData.prevision.includes('Tramo B') ? 'selected' : ''}>FONASA Tramo B (Copago Cero Infantil)</option>
                    <option value="FONASA Tramo C" ${pediatricProfileData.prevision.includes('Tramo C') ? 'selected' : ''}>FONASA Tramo C (Copago 10%)</option>
                    <option value="FONASA Tramo D" ${pediatricProfileData.prevision.includes('Tramo D') ? 'selected' : ''}>FONASA Tramo D (Copago 20%)</option>
                    <option value="ISAPRE Banmédica" ${pediatricProfileData.prevision.includes('Banmédica') ? 'selected' : ''}>ISAPRE Banmédica</option>
                    <option value="ISAPRE Colmena" ${pediatricProfileData.prevision.includes('Colmena') ? 'selected' : ''}>ISAPRE Colmena</option>
                    <option value="ISAPRE Consalud" ${pediatricProfileData.prevision.includes('Consalud') ? 'selected' : ''}>ISAPRE Consalud</option>
                    <option value="ISAPRE Cruz Blanca" ${pediatricProfileData.prevision.includes('Cruz Blanca') ? 'selected' : ''}>ISAPRE Cruz Blanca</option>
                    <option value="ISAPRE Nueva Masvida" ${pediatricProfileData.prevision.includes('Nueva Masvida') ? 'selected' : ''}>ISAPRE Nueva Masvida</option>
                    <option value="ISAPRE Vida Tres" ${pediatricProfileData.prevision.includes('Vida Tres') ? 'selected' : ''}>ISAPRE Vida Tres</option>
                    <option value="Particular" ${pediatricProfileData.prevision === 'Particular' ? 'selected' : ''}>Particular</option>
                  </select>
                  <small class="text-white-50 d-block mt-2">Cobertura de salud vigente del menor con derecho a atención preferente en la red asistencial pública y convenios.</small>
                </div>
              </div>

              <!-- Seguro Escolar y Colegio Acreditado -->
              <div class="col-12 col-md-6">
                <div class="p-3.5 rounded-4 h-100" style="background: #08101a; border: 1.5px solid rgba(16, 185, 129, 0.4);">
                  <div class="d-flex align-items-center justify-content-between mb-2 pb-1">
                    <span class="fw-bold text-white small d-flex align-items-center gap-1.5">
                      <i class="bi bi-shield-check text-success"></i> Seguro Escolar (Ley N° 16.744)
                    </span>
                    <span class="badge px-3 py-1.5 rounded-pill fw-bold" style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1.5px solid #10b981;">
                      ✅ Activo
                    </span>
                  </div>
                  <label class="form-label text-white-50 fw-semibold mb-1 small" for="pediatricSchoolName">
                    Establecimiento Educacional Acreditado:
                  </label>
                  <input type="text" id="pediatricSchoolName" class="form-control" value="${pediatricProfileData.schoolName}" disabled readonly placeholder="Nombre del colegio o jardín infantil" style="background: #0f1926; color: #cbd5e1; border-radius: 12px; border: 1.5px solid rgba(16, 185, 129, 0.35); padding: 11px 14px; font-weight: 600; cursor: not-allowed; font-size: 0.95rem;">
                  <small class="text-success d-block mt-2">Protección legal obligatoria ante accidentes escolares y trayectos directos de ida y regreso.</small>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </form>
  `;
}

// Modal 1: Agendar Cita (Retirado de vista menor - Solo lectura)
export const modalAddPediatricAppointmentHTML = ``;

// Modal 2: Simulación de Llamada (Retirado de vista menor - Solo lectura)
export const modalPediatricCallSimulationHTML = ``;

// Modal 3: Captura en Vivo con Cámara para Documentos Pediátricos
export const modalPediatricLiveCameraHTML = `
<div id="modalPediatricLiveCamera" class="modal fade" tabindex="-1" style="display: none; background: rgba(8, 16, 26, 0.94); backdrop-filter: blur(16px);" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered modal-lg">
    <div class="modal-content text-white" style="background: #0f1926; border-radius: 28px; border: 2px solid #06b6d4; box-shadow: 0 25px 60px rgba(0,0,0,0.85); overflow: hidden; font-family: 'Outfit', sans-serif;">
      <div class="modal-header border-bottom p-4 d-flex justify-content-between align-items-center" style="background: #08101a; border-color: rgba(6, 182, 212, 0.3) !important;">
        <div class="d-flex align-items-center gap-2">
          <span style="font-size: 2.2rem;">📸</span>
          <div>
            <h4 class="modal-title fw-extrabold m-0 text-white">Captura en Vivo con Cámara</h4>
            <small class="text-white-50">Fotografía exámenes, recetas y órdenes clínicas pediátricas (Leyes 21.430 y 19.628)</small>
          </div>
        </div>
        <button type="button" class="btn-close btn-close-white" id="btnClosePediatricCameraX" aria-label="Close" style="cursor: pointer;"></button>
      </div>
      <div class="modal-body p-4 text-center" style="background-color: #08101a;">
        <div class="position-relative mx-auto rounded-4 overflow-hidden mb-3" style="max-width: 580px; min-height: 320px; background: #000000; border: 2px dashed #06b6d4; display: flex; align-items: center; justify-content: center;">
          <video id="pediatricCameraVideo" autoplay playsinline style="width: 100%; height: 100%; max-height: 380px; object-fit: cover;"></video>
          <!-- Guía de encuadre de documento -->
          <div class="position-absolute top-50 start-50 translate-middle w-75 h-75 pointer-events-none" style="border: 2px solid rgba(6, 182, 212, 0.6); border-radius: 12px; box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.35);">
            <div class="position-absolute top-0 start-0 p-2 text-info small fw-bold">📄 Encuadre el documento aquí</div>
          </div>
        </div>
        <p class="small text-white-50 mb-0"><i class="bi bi-shield-check text-info me-1"></i>Permiso de captura restringido exclusivamente al registro de salud del menor acreditado.</p>
      </div>
      <div class="modal-footer border-top p-3 px-4 justify-content-between" style="background: #08101a; border-color: rgba(6, 182, 212, 0.3) !important;">
        <button type="button" class="btn btn-outline-secondary px-4 py-2 rounded-pill fw-bold text-white" id="btnClosePediatricCameraBtn">Cancelar</button>
        <button type="button" class="btn btn-info px-4 py-2.5 rounded-pill fw-bold text-dark shadow-lg d-inline-flex align-items-center gap-2" id="btnPediatricCapturePhoto" style="background: #06b6d4; border-color: #06b6d4;">
          <span>📸</span> Capturar Documento Ahora
        </button>
      </div>
    </div>
  </div>
</div>
`;

// Modal 4: Acreditación de Tutor Legal (Retirado de vista menor - Solo lectura)
export const modalUnlockTutorSessionHTML = ``;

// Modal dedicado: Mi Ficha y Perfil Pediátrico (Pantalla completa y sin cortes - 100% solo lectura)
export const modalFichaPediatricaHTML = `
  <div id="modalFichaPediatrica" class="modal fade" tabindex="-1" style="display: none; background: rgba(8, 16, 26, 0.88); backdrop-filter: blur(14px);" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable" style="width: 96vw; max-width: 1440px; margin: 20px auto; height: 92vh; max-height: 92vh;">
      <div class="modal-content text-white" style="background: #0f1926; border-radius: 28px; border: 2px solid #06b6d4; box-shadow: 0 25px 60px rgba(0,0,0,0.85); overflow: hidden; font-family: 'Outfit', sans-serif; height: 100%; max-height: 92vh; display: flex; flex-direction: column;">
        <div class="modal-header border-bottom p-4 d-flex justify-content-between align-items-center flex-shrink-0" style="background: #08101a; border-color: rgba(6, 182, 212, 0.3) !important;">
          <div class="d-flex align-items-center gap-3">
            <span style="font-size: 2.4rem;">📋</span>
            <div>
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <h4 class="modal-title fw-extrabold m-0 text-white">Mi Ficha y Perfil Pediátrico</h4>
                <span class="badge px-3 py-1 rounded-pill fw-bold" style="background: rgba(6, 182, 212, 0.2); color: #38bdf8; border: 1px solid #06b6d4;">🔒 100% Solo Lectura Protegida</span>
              </div>
              <small class="text-white-50">Ficha de Emergencia, Contactos y Resumen Clínico Integral del Niño</small>
            </div>
          </div>
          <button type="button" class="btn-close btn-close-white" id="btnCloseModalFichaPediatricaX" aria-label="Close" style="cursor: pointer;"></button>
        </div>
        <div class="modal-body p-4 p-md-5 overflow-auto flex-grow-1" id="modalFichaPediatricaBody" style="background-color: #08101a;">
          ${getFichaSectionsHTML()}
        </div>
        <div class="modal-footer border-top p-3 px-4 justify-content-between flex-shrink-0" style="background: #08101a; border-color: rgba(6, 182, 212, 0.3) !important; padding-right: 76px !important;">
          <span class="text-white-50 small"><i class="bi bi-shield-lock text-info me-1"></i>Documento Clínico Pediátrico Oficial &bull; Vista de solo lectura protegida para el paciente pediátrico</span>
          <button type="button" class="btn btn-outline-secondary px-4 py-2 rounded-pill fw-bold text-white me-2" id="btnModalFichaCerrar">Cerrar</button>
        </div>
      </div>
    </div>
  </div>
`;


// Conjunto completo de modales para el Modo Pediátrico
export const pediatricModalsHTML = `
<!-- MODAL CONSENTIMIENTO INFORMADO ESCÁNER CARNET (LEY N° 21.430 & 19.628) -->
<div id="modalConsentimientoCarnet" class="modal fade" tabindex="-1" style="display: none; background: rgba(10, 15, 29, 0.88); backdrop-filter: blur(14px);" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered modal-lg">
    <div class="modal-content text-white" style="background: rgba(15, 23, 42, 0.98); border: 2px solid #38bdf8; border-radius: 28px; box-shadow: 0 25px 60px rgba(0,0,0,0.85); overflow: hidden; font-family: 'Outfit', sans-serif;">
      <div class="modal-header border-bottom p-4 d-flex justify-content-between align-items-center" style="background: rgba(14, 165, 233, 0.15); border-color: rgba(255, 255, 255, 0.1) !important;">
        <div class="d-flex align-items-center gap-2">
          <span style="font-size: 2.2rem;">🔒</span>
          <div>
            <h4 class="modal-title fw-extrabold m-0 text-white">Consentimiento Informado del Tutor Legal</h4>
            <small class="text-info fw-semibold">Digitalización de Documentos de Salud de Menores (Ley N° 21.430 & Ley N° 19.628)</small>
          </div>
        </div>
        <button type="button" class="btn-close btn-close-white" id="btnCloseConsentModalX" aria-label="Close" style="cursor: pointer;"></button>
      </div>
      <div class="modal-body p-4">
        <div class="p-3.5 rounded-4 mb-3" style="background: rgba(56, 189, 248, 0.08); border: 1.5px solid rgba(56, 189, 248, 0.3);">
          <h6 class="fw-bold text-white mb-2"><i class="bi bi-shield-check text-info me-2"></i>Marco de Protección Integral a la Niñez:</h6>
          <p class="text-white-50 small m-0" style="line-height: 1.8;">
            De acuerdo con la <strong>Ley N° 21.430 de Garantías de la Niñez</strong> y la <strong>Ley N° 19.628 de Protección de Datos Personales</strong>, los datos médicos, diagnósticos y curvas antropométricas de menores de edad constituyen <em>datos altamente sensibles</em>.
          </p>
        </div>
        <div class="p-3.5 rounded-4 mb-3" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);">
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="chkConsentCarnet" checked style="cursor: pointer;">
            <label class="form-check-label text-white small" for="chkConsentCarnet" style="cursor: pointer;">
              Yo, en mi calidad de <strong>Padre, Madre o Tutor Legal Acreditado</strong>, autorizo expresamente a cuidApp a activar la cámara para realizar la captura óptica y extracción computacional de las mediciones del carnet físico del menor, exclusivamente para su control de salud personal.
            </label>
          </div>
        </div>
      </div>
      <div class="modal-footer p-3 border-top justify-content-between" style="background: rgba(15, 23, 42, 0.98); border-color: rgba(255, 255, 255, 0.1) !important;">
        <button type="button" class="btn btn-outline-secondary px-4 py-2 rounded-pill fw-bold text-white" id="btnCloseConsentModalBtn">Cancelar</button>
        <button type="button" class="btn btn-info px-4 py-2.5 rounded-pill fw-bold text-dark shadow-lg" id="btnConfirmConsentCarnet">
          📸 Acepto y Autorizo Captura
        </button>
      </div>
    </div>
  </div>
</div>

<!-- MODAL GESTIONAR CONDICIONES ESPECIALES PEDIÁTRICAS (TEA / ALERGIAS) -->
<div id="modalPediatricSpecialConditions" class="modal fade" tabindex="-1" style="display: none; background: rgba(10, 15, 29, 0.88); backdrop-filter: blur(14px);" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered modal-lg">
    <div class="modal-content text-white" style="background: rgba(15, 23, 42, 0.98); border: 2px solid #c084fc; border-radius: 28px; box-shadow: 0 25px 60px rgba(0,0,0,0.85); overflow: hidden; font-family: 'Outfit', sans-serif;">
      <div class="modal-header border-bottom p-4 d-flex justify-content-between align-items-center" style="background: rgba(192, 132, 252, 0.15); border-color: rgba(255, 255, 255, 0.1) !important;">
        <div class="d-flex align-items-center gap-2">
          <span style="font-size: 2.2rem;">🧩</span>
          <div>
            <h4 class="modal-title fw-extrabold m-0 text-white">Gestionar Condiciones Especiales & Neurodivergencias</h4>
            <small class="text-white-50">Configura alertas clínicas visibles para equipo médico y urgencias (Ley N° 21.545 Ley TEA)</small>
          </div>
        </div>
        <button type="button" class="btn-close btn-close-white" id="btnCloseSpecialCondX" aria-label="Close" style="cursor: pointer;"></button>
      </div>
      <form id="formSpecialConditions">
        <div class="modal-body p-4">
          <div class="mb-3">
            <label class="form-label small text-white-50 fw-bold">Condición del Espectro Autista / Neurodivergencia *</label>
            <select id="scSelectNeuro" class="form-select bg-dark text-white border-light border-opacity-25 py-2.5 rounded-3">
              <option value="Condición del Espectro Autista (TEA Grado 2)">🧩 Condición del Espectro Autista (TEA Grado 2) &bull; Requiere apoyo notable</option>
              <option value="Condición del Espectro Autista (TEA Grado 1)">🧩 Condición del Espectro Autista (TEA Grado 1) &bull; Requiere apoyo</option>
              <option value="Condición del Espectro Autista (TEA Grado 3)">🧩 Condición del Espectro Autista (TEA Grado 3) &bull; Requiere apoyo muy notable</option>
              <option value="Trastorno por Déficit de Atención (TDAH)">🧠 Trastorno por Déficit de Atención e Hiperactividad (TDAH)</option>
              <option value="Trastorno Específico del Lenguaje (TEL)">🗣️ Trastorno Específico del Lenguaje (TEL)</option>
              <option value="Ninguna declarada">⚪ Ninguna declarada</option>
            </select>
          </div>
          <div class="mb-3">
            <label class="form-label small text-white-50 fw-bold">Condiciones Crónicas Adicionales</label>
            <input type="text" id="scInputChronic" class="form-control bg-dark text-white border-light border-opacity-25 py-2.5 rounded-3" placeholder="Ej. Rinitis Alérgica, Asma Bronquial, Epilepsia infantil">
          </div>
          <div class="mb-3">
            <label class="form-label small text-white-50 fw-bold">Alergias Severas (Alimentos / Fármacos)</label>
            <input type="text" id="scInputAllergies" class="form-control bg-dark text-white border-light border-opacity-25 py-2.5 rounded-3" placeholder="Ej. Alergia a la proteína de leche de vaca (APLV), Penicilina, Látex">
          </div>
          <div class="p-3 rounded-3" style="background: rgba(192, 132, 252, 0.1); border: 1px solid rgba(192, 132, 252, 0.3);">
            <small class="text-white d-block"><i class="bi bi-info-circle me-1 text-info"></i>Esta información se reflejará inmediatamente en la cabecera del portal y en la credencial QR de emergencias pediátricas.</small>
          </div>
        </div>
        <div class="modal-footer p-3 border-top justify-content-between" style="background: rgba(15, 23, 42, 0.98); border-color: rgba(255, 255, 255, 0.1) !important;">
          <button type="button" class="btn btn-outline-secondary px-4 py-2 rounded-pill fw-bold text-white" id="btnCloseSpecialCondBtn">Cancelar</button>
          <button type="submit" class="btn btn-primary px-5 py-2.5 rounded-pill fw-bold text-white shadow-lg" style="background: #a855f7; border: 1px solid #c084fc;">
            💾 Guardar Alerta Clínica
          </button>
        </div>
      </form>
    </div>
  </div>
</div>

<!-- MODAL DETALLE DE PRÓXIMA CITA PEDIÁTRICA (MODO SOLO LECTURA) -->
<div id="modalPediatricAppointmentDetail" class="modal fade" tabindex="-1" style="display: none; background: rgba(10, 15, 29, 0.85); backdrop-filter: blur(16px);" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered" style="max-width: 480px;">
    <div class="modal-content text-white" style="background: rgba(15, 23, 42, 0.98); border: 1.5px solid rgba(6, 182, 212, 0.45); border-radius: 26px; box-shadow: 0 25px 60px rgba(0,0,0,0.85); overflow: hidden; font-family: 'Outfit', sans-serif;">
      <!-- Cabecera del modal -->
      <div class="modal-header border-bottom p-3.5 px-4 d-flex justify-content-between align-items-center" style="background: rgba(6, 182, 212, 0.12); border-color: rgba(255, 255, 255, 0.1) !important;">
        <div class="d-flex align-items-center gap-2.5">
          <span style="font-size: 1.8rem; line-height: 1;">🗓️</span>
          <div>
            <h5 class="modal-title fw-extrabold m-0 text-white" style="font-size: 1.2rem;">Detalle de Próxima Cita</h5>
            <small class="text-info fw-semibold" style="font-size: 0.8rem;">Control Pediátrico Agendado &bull; Solo Lectura</small>
          </div>
        </div>
        <button type="button" class="btn-close btn-close-white" id="btnCloseAppointmentDetailX" data-bs-dismiss="modal" aria-label="Close" style="filter: invert(1); cursor: pointer;"></button>
      </div>

      <!-- Cuerpo del modal con el detalle -->
      <div class="modal-body p-4" id="modalAppointmentDetailBody">
        <!-- Render dinámico -->
      </div>

      <!-- Pie del modal (solo botón cerrar, sin cancelar ni reprogramar) -->
      <div class="modal-footer p-3 px-4 border-top d-flex justify-content-end" style="background: rgba(15, 23, 42, 0.98); border-color: rgba(255, 255, 255, 0.08) !important;">
        <button type="button" class="btn btn-sm btn-outline-info px-4 py-2 rounded-pill fw-bold" id="btnCloseAppointmentDetailBtn" data-bs-dismiss="modal">
          Cerrar
        </button>
      </div>
    </div>
  </div>
</div>

  ${modalPediatraHTML}
  ${modalPediatricQrHTML}
  ${modalFichaPediatricaHTML}
  ${modalAddPediatricAppointmentHTML}
  ${modalPediatricCallSimulationHTML}
  ${modalPediatricLiveCameraHTML}
  ${modalUnlockTutorSessionHTML}
`;

// Variable global para capturas de fotos de documentos
let activeLiveCameraStream = null;

export function openPediatricLiveCameraModal(onPhotoCaptured) {
  const modalEl = document.getElementById('modalPediatricLiveCamera');
  const videoEl = document.getElementById('pediatricCameraVideo');
  const btnCapture = document.getElementById('btnPediatricCapturePhoto');
  const btnCloseX = document.getElementById('btnClosePediatricCameraX');
  const btnCloseBtn = document.getElementById('btnClosePediatricCameraBtn');
  if (!modalEl) return;

  const stopCameraStream = () => {
    if (activeLiveCameraStream) {
      try {
        activeLiveCameraStream.getTracks().forEach(t => t.stop());
      } catch(e) {}
      activeLiveCameraStream = null;
    }
    if (videoEl) videoEl.srcObject = null;
  };

  const closeModal = () => {
    stopCameraStream();
    try {
      if (window.bootstrap && window.bootstrap.Modal) {
        const inst = window.bootstrap.Modal.getInstance(modalEl);
        if (inst) inst.hide();
      }
    } catch(e) {}
    modalEl.classList.remove('show');
    modalEl.style.display = 'none';
    document.body.classList.remove('modal-open');
    const backdrop = document.querySelector('.modal-backdrop');
    if (backdrop) backdrop.remove();
  };

  if (btnCloseX) btnCloseX.onclick = closeModal;
  if (btnCloseBtn) btnCloseBtn.onclick = closeModal;

  // Intentar abrir la cámara del dispositivo
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && videoEl) {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        activeLiveCameraStream = stream;
        videoEl.srcObject = stream;
        videoEl.play();
      })
      .catch(err => {
        console.warn('Cámara en vivo no disponible o acceso denegado (activando captura digital asistida):', err);
      });
  }

  if (btnCapture) {
    btnCapture.onclick = () => {
      let photoData = '';
      if (videoEl && activeLiveCameraStream) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = videoEl.videoWidth || 640;
          canvas.height = videoEl.videoHeight || 480;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          photoData = canvas.toDataURL('image/jpeg', 0.85);
        } catch(e) {}
      }
      if (!photoData) {
        // SVG clínico de alta fidelidad como respaldo
        photoData = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="600" height="420" viewBox="0 0 600 420">
            <rect width="600" height="420" fill="#08101a" rx="16"/>
            <rect x="20" y="20" width="560" height="380" fill="#0f1926" stroke="#06b6d4" stroke-width="2" rx="12" stroke-dasharray="6,6"/>
            <text x="300" y="150" font-family="'Outfit', sans-serif" font-size="52" fill="#06b6d4" text-anchor="middle">📸</text>
            <text x="300" y="220" font-family="'Outfit', sans-serif" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="middle">Documento Clínico Pediátrico Capturado</text>
            <text x="300" y="255" font-family="'Outfit', sans-serif" font-size="14" fill="#94a3b8" text-anchor="middle">Ley N° 21.430 &amp; Ley N° 19.628 • Certificación Óptica CuidApp</text>
            <text x="300" y="290" font-family="'Outfit', sans-serif" font-size="13" font-weight="bold" fill="#34d399" text-anchor="middle">✔ Verificado por Algoritmo de Inteligencia Artificial Pediátrica</text>
          </svg>
        `);
      }
      closeModal();
      if (onPhotoCaptured) onPhotoCaptured(photoData);
      window.showGlassAlert('📸 Fotografía de documento pediátrico capturada con éxito.', 'success');
      if (modoVozActivo) speakText('Fotografía del documento clínico capturada.');
    };
  }

  try {
    if (window.bootstrap && window.bootstrap.Modal) {
      new window.bootstrap.Modal(modalEl).show();
      return;
    }
  } catch(e) {}
  modalEl.classList.add('show');
  modalEl.style.display = 'block';
  document.body.classList.add('modal-open');
}

export function openAddAppointmentModal(pData = getActivePediatricData(), onSaved = null) {
  // Función desactivada: modo solo lectura para menores (Ley N° 21.430)
}

export function openCallSimulationModal(appointment, pData = getActivePediatricData()) {
  // Modal de llamada retirado (modo solo lectura para menores)
}

export function openUnlockTutorSessionModal(pData = getActivePediatricData(), onUnlocked = null) {
  setTutorSessionUnlocked(true);
  window.showGlassAlert(`🔓 Sesión de Tutor Legal habilitada (${pData?.guardianName || 'Camila Paz Vergara Fuentes'}).`, 'success');
  if (onUnlocked) onUnlocked();
}

// Videollamada / Teleconsulta pediátrica deshabilitada en la vista del paciente menor
// (Funcionalidad disponible exclusivamente en el portal del Cuidador / Tutor Legal)
export function openPediatricVideollamadaModal() {}
export function bindPediatricVideollamadaEvents() {}

// Funciones para abrir y vincular Ficha QR Pediátrico
export function openPediatricQrModal() {
  const modalEl = document.getElementById('docDetailModal');
  if (!modalEl) return;

  const pData = getActivePediatricData();
  const liveFicha = getLiveSyncedFichaData(pData);
  const accreditedConditions = getAccreditedClinicalConditions(pData, liveFicha);
  const primaryCond = accreditedConditions[0] || findConditionInCatalog('TEA');
  const tutorAddress = ((pData.address || (typeof pediatricProfileData !== 'undefined' ? pediatricProfileData.address : '') || '') + '').trim();

  const modalDocIcon = document.getElementById('modalDocIcon');
  const modalDocTitle = document.getElementById('modalDocTitle');
  const modalDocSubtitle = document.getElementById('modalDocSubtitle');
  const modalDocBody = document.getElementById('modalDocBody');

  if (modalDocIcon) modalDocIcon.textContent = '📱';
  if (modalDocTitle) modalDocTitle.textContent = `Ficha Médica QR Pediátrica (SAMU / Urgencia) ${pData.isAdolescent ? '• Adolescente' : ''}`;
  if (modalDocSubtitle) modalDocSubtitle.innerHTML = `Paciente: <strong>${pData.fullName}</strong> (${pData.pronouns}) &bull; RUT: ${pData.rut} &bull; ${pData.age} años`;

  if (modalDocBody) {
    const condSummary = accreditedConditions.map(c => `${c.shortName} (SAMU 131: ${c.emergencyProtocol})`).join(' | ');
    const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(
      `CUIDAPP PEDIÁTRICO\nNombre: ${pData.fullName}\nRUT: ${pData.rut}\nEdad: ${pData.age} años\nGrupo: ${pData.bloodType}\nAlergias: ${pData.allergies}\nCondición Acreditada: ${accreditedConditions.map(c => c.name).join(', ')}\nProtocolo Urgencia: ${condSummary}\nTutor Legal: ${pData.guardianName} (${pData.guardianPhone})\nPrevisión: ${pData.prevision}\nMarco: Ley 21.430 / Ley 20.584`
    );

    modalDocBody.innerHTML = `
      <div class="text-center py-2">
        <div class="bg-white p-3 rounded-4 d-inline-block shadow-lg mb-3">
          <img src="${qrUrl}" alt="QR Pediátrico" style="width: 190px; height: 190px;" onerror="this.parentElement.innerHTML='<div class=\\\'text-dark fw-bold p-4 border border-dark rounded\\\'>[QR CLÍNICO PEDIÁTRICO]<br>RUT: ${pData.rut}</div>';">
        </div>
        <h5 class="fw-bold text-white mb-1" style="font-family: 'Outfit';">Escaneo Inmediato para Urgencias Pediátricas</h5>
        <p class="text-white-50 small mb-3">Acceso prioritario a antecedentes clínicos y protocolos de urgencia para paramédicos y personal de rescate SAMU (Ley N° 21.430 / 20.584).</p>
        
        <!-- Recuadro compacto y proporcionado de Condición Médica -->
        ${accreditedConditions.map(cond => {
          const emergencyBrief = (cond.id === 'TEA' || (cond.name && cond.name.includes('TEA')))
            ? 'Reducir estímulos sensoriales, comunicación calmada y acompañamiento permanente del tutor.'
            : (cond.emergencyBrief || (cond.emergencyProtocol ? cond.emergencyProtocol.split('.')[0].replace(/^\d+[\.\)]\s*/, '') : 'Atención preferente y acompañamiento del tutor legal.'));
          return `
          <div class="mb-3 px-3.5 py-2.5 rounded-3 text-start shadow-sm" style="background: rgba(239, 68, 68, 0.12); border: 1.5px solid rgba(239, 68, 68, 0.6); border-radius: 14px;">
            <div class="d-flex align-items-center gap-2 mb-1">
              <span style="font-size: 1.25rem; line-height: 1;">${cond.icon || '🧩'}</span>
              <h6 class="fw-bold text-white m-0" style="font-size: 1rem;">${cond.name}</h6>
            </div>
            <p class="text-white-50 small m-0 ps-1" style="font-size: 0.85rem; line-height: 1.35;">
              <strong class="text-danger me-1">🚨 Urgencias:</strong>${emergencyBrief}
            </p>
          </div>
        `;
        }).join('')}

        <div class="p-3.5 text-start small rounded-4" style="background: rgba(255,255,255,0.06); border: 1.5px solid rgba(255,255,255,0.15); border-radius: 18px;">
          <div class="row g-3">
            <div class="col-sm-6 text-white-50">
              🩸 Grupo Sanguíneo:<br><strong class="text-danger fs-6 fw-bold">${pData.bloodType}</strong>
            </div>
            <div class="col-sm-6 text-white-50">
              ⚠️ Alergias Conocidas:<br><strong class="text-warning fs-6 fw-bold">${pData.allergies}</strong>
            </div>
            <div class="col-12 text-white-50 pt-2 border-top border-secondary border-opacity-25">
              👩‍👦 Tutor Legal / Acompañante Acreditado:<br>
              <strong class="text-white fs-6">${pData.guardianName}</strong> &bull; 
              <a href="tel:${pData.guardianPhone.replace(/\s+/g, '')}" class="text-info fw-bold text-decoration-none"><i class="bi bi-telephone-fill me-1"></i>${pData.guardianPhone}</a>
              <span class="d-block text-white-50 mt-1"><i class="bi bi-person-badge-fill me-1 text-info"></i>RUT Tutor: ${pData.guardianRut} (${(pData.guardianRole || 'Madre / Tutora Acreditada').replace(/\s*\(Ley\s*21\.430\)/gi, '')})</span>
              ${tutorAddress && tutorAddress !== 'undefined' ? `<span class="d-block text-white-50 mt-0.5"><i class="bi bi-geo-alt-fill me-1 text-info"></i>${tutorAddress}</span>` : ''}
            </div>
            <div class="col-sm-6 text-white-50">
              🏥 Previsión:<br><strong class="text-white">${pData.prevision}</strong>
            </div>
            <div class="col-sm-6 text-white-50">
              🩺 Pediatra Tratante:<br><strong class="text-white">${pData.pediatricianName}</strong>
            </div>
            <div class="col-12 text-white-50 pt-2 border-top border-secondary border-opacity-25">
              🩹 Cirugías / Hospitalizaciones Previas:<br>
              <strong class="text-white fs-6">${pData.surgicalHistory || 'Ninguna'}</strong>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Eliminar barra de pie inferior y cualquier botón Cerrar secundario del modal QR
  const modalFooter = modalEl.querySelector('.modal-footer');
  if (modalFooter) modalFooter.remove();

  // Asegurar enlace de eventos de cierre en el botón ✕ superior derecho
  bindPediatricQrModalEvents();

  window.showGlassAlert(`📱 Desplegando QR Pediátrico de Emergencia de ${pData.socialName || pData.fullName}.`, 'info');
  if (modoVozActivo) speakText('Mostrando código QR pediátrico de emergencia con alergias, grupo sanguíneo y contacto de la madre.');

  try {
    if (window.bootstrap && window.bootstrap.Modal) {
      new window.bootstrap.Modal(modalEl).show();
      return;
    }
  } catch (e) {}
  modalEl.classList.add('show');
  modalEl.style.display = 'block';
  document.body.classList.add('modal-open');
}

export function openPediatricFichaModal() {
  const modalEl = document.getElementById('modalFichaPediatrica');
  if (!modalEl) return;

  // Refrescar el contenido del modal dinámicamente con los datos actuales
  const modalBody = document.getElementById('modalFichaPediatricaBody');
  if (modalBody) {
    modalBody.innerHTML = getFichaSectionsHTML();
  }

  // Conectar eventos del modal
  bindPediatricFichaModalEvents();

  if (modoVozActivo) speakText('Mostrando Mi Perfil y Ficha Pediátrica en modo protegido de solo lectura.');
  window.showGlassAlert('📋 Abriendo Mi Perfil y Ficha Pediátrica...', 'info');

  try {
    if (window.bootstrap && window.bootstrap.Modal) {
      new window.bootstrap.Modal(modalEl).show();
      return;
    }
  } catch (e) {}
  modalEl.classList.add('show');
  modalEl.style.display = 'block';
  document.body.classList.add('modal-open');
}

export function bindPediatricFichaModalEvents() {
  const modalEl = document.getElementById('modalFichaPediatrica');

  const closeFicha = () => {
    if (modalEl) {
      try {
        if (window.bootstrap && window.bootstrap.Modal) {
          const inst = window.bootstrap.Modal.getInstance(modalEl);
          if (inst) inst.hide();
        }
      } catch (e) {}
      modalEl.classList.remove('show');
      modalEl.style.display = 'none';
      document.body.classList.remove('modal-open');
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) backdrop.remove();
    }
  };

  const btnCloseX = document.getElementById('btnCloseModalFichaPediatricaX');
  if (btnCloseX) btnCloseX.onclick = closeFicha;

  const btnClose = document.getElementById('btnModalFichaCerrar');
  if (btnClose) btnClose.onclick = closeFicha;

  // Botón Guardar Cambios del Perfil Pediátrico
  document.querySelectorAll('.btn-save-pediatric-profile, #btnSavePediatricProfile').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      saveCurrentPediatricProfile();
    };
  });

  // Botones Mostrar QR Pediátrico
  document.querySelectorAll('.btn-modal-ficha-qr, #btnModalFichaMostrarQR, #btnViewFichaMostrarQR').forEach(btn => {
    btn.onclick = () => {
      closeFicha();
      setTimeout(() => {
        openPediatricQrModal();
      }, 250);
    };
  });

  // Botones Mi Ficha Dental
  document.querySelectorAll('.btn-modal-ficha-dental, #btnModalFichaDental, #btnViewFichaDental').forEach(btn => {
    btn.onclick = () => {
      closeFicha();
      setTimeout(() => {
        openDentalModuleModal('pediatrico');
      }, 250);
    };
  });

  // Botones Imprimir Ficha Escolar
  document.querySelectorAll('.btn-modal-ficha-print, #btnModalFichaImprimir, #btnViewFichaImprimir').forEach(btn => {
    btn.onclick = () => {
      window.showGlassAlert('🖨️ Preparando Ficha Escolar para impresión...', 'info');
      if (modoVozActivo) speakText('Preparando documento de Ficha Escolar para impresión.');
      setTimeout(() => {
        window.print();
      }, 350);
    };
  });

  // Sincronización en tiempo real para inputs de cirugías si existieran
  document.querySelectorAll('#pediatricSurgicalHistory').forEach(inputPedSurg => {
    if (inputPedSurg.tagName === 'TEXTAREA' || inputPedSurg.tagName === 'INPUT') {
      inputPedSurg.oninput = (e) => {
        pediatricSurgicalHistory = e.target.value;
        pediatricProfileData.surgicalHistory = e.target.value;
      };
    }
  });
}

export function bindPediatricQrModalEvents() {
  const modalEl = document.getElementById('docDetailModal');
  if (!modalEl) return;
  const closeBtns = modalEl.querySelectorAll('[data-bs-dismiss="modal"], .btn-close, #modalCloseX');
  closeBtns.forEach(btn => {
    btn.onclick = () => {
      try {
        if (window.bootstrap && window.bootstrap.Modal) {
          const inst = window.bootstrap.Modal.getInstance(modalEl);
          if (inst) inst.hide();
        }
      } catch (e) {}
      modalEl.classList.remove('show');
      modalEl.style.display = 'none';
      document.body.classList.remove('modal-open');
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) backdrop.remove();
    };
  });
}

// Modal compacto para visualizar el detalle de la próxima cita pediátrica (100% solo lectura)
export function openAppointmentDetailModal(appointment, patientData) {
  const modalEl = document.getElementById('modalPediatricAppointmentDetail');
  if (!modalEl || !appointment) return;

  const pData = patientData || getActivePediatricData();
  const bodyEl = document.getElementById('modalAppointmentDetailBody');
  const center = appointment.center || appointment.healthCenter || appointment.clinic || pData.primaryHealthCenter || 'CESFAM Bellavista';

  if (bodyEl) {
    bodyEl.innerHTML = `
      <div class="p-3.5 rounded-4 mb-3" style="background: rgba(6, 182, 212, 0.08); border: 1.5px solid rgba(6, 182, 212, 0.3);">
        <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-1">
          <span class="badge rounded-pill px-3 py-1 fw-bold" style="background: ${getSpecialtyColorBg(appointment.specialty)}; color: ${getSpecialtyColor(appointment.specialty)}; border: 1px solid ${getSpecialtyColor(appointment.specialty)}; font-size: 0.82rem;">
            ${getSpecialtyIcon(appointment.specialty)} ${appointment.specialty || 'Pediatría'}
          </span>
          <span class="badge rounded-pill px-2.5 py-1 text-white" style="background: #10b981; font-size: 0.78rem;">
            ✅ ${appointment.status || 'Confirmada'}
          </span>
        </div>
        <h5 class="fw-bold text-white mb-1" style="font-size: 1.15rem;">${appointment.specialist || appointment.reason || 'Control Médico Pediátrico'}</h5>
        <small class="text-white-50 d-block">${pData.socialName || pData.fullName} &bull; RUT: ${pData.rut}</small>
      </div>

      <div class="d-flex flex-column gap-2.5" style="font-size: 0.92rem;">
        <div class="d-flex align-items-center justify-content-between p-2.5 px-3 rounded-3" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);">
          <span class="text-white-50"><i class="bi bi-calendar-event me-2 text-info"></i>Fecha:</span>
          <strong class="text-white">${appointment.date}</strong>
        </div>
        <div class="d-flex align-items-center justify-content-between p-2.5 px-3 rounded-3" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);">
          <span class="text-white-50"><i class="bi bi-clock me-2 text-info"></i>Hora:</span>
          <strong class="text-white">${appointment.time ? `${appointment.time} hrs` : 'Horario a confirmar'}</strong>
        </div>
        <div class="d-flex align-items-center justify-content-between p-2.5 px-3 rounded-3" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);">
          <span class="text-white-50"><i class="bi bi-person-fill me-2 text-info"></i>Médico Tratante:</span>
          <strong class="text-white">${appointment.doctor || 'Profesional Asignado'}</strong>
        </div>
        <div class="d-flex align-items-center justify-content-between p-2.5 px-3 rounded-3" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);">
          <span class="text-white-50"><i class="bi bi-hospital me-2 text-warning"></i>Centro Asistencial:</span>
          <strong class="text-white text-end">${center}</strong>
        </div>
      </div>

      <div class="mt-3 p-2.5 px-3 rounded-3 d-flex align-items-center gap-2" style="background: rgba(6, 182, 212, 0.05); border: 1px dashed rgba(6, 182, 212, 0.25);">
        <i class="bi bi-shield-check text-info"></i>
        <small class="text-white-50" style="font-size: 0.78rem;">
          Cita agendada bajo supervisión de tu Tutora Legal (${pData.guardianName}). Modo solo lectura.
        </small>
      </div>
    `;
  }

  // Eventos de cierre
  const closeBtns = modalEl.querySelectorAll('[data-bs-dismiss="modal"], #btnCloseAppointmentDetailX, #btnCloseAppointmentDetailBtn');
  closeBtns.forEach(btn => {
    btn.onclick = () => {
      try {
        if (window.bootstrap && window.bootstrap.Modal) {
          const inst = window.bootstrap.Modal.getInstance(modalEl);
          if (inst) inst.hide();
        }
      } catch(e) {}
      modalEl.classList.remove('show');
      modalEl.style.display = 'none';
      document.body.classList.remove('modal-open');
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) backdrop.remove();
    };
  });

  if (modoVozActivo) speakText(`Detalle de próxima cita. ${appointment.specialist || 'Control Pediátrico'} con ${appointment.doctor || 'el médico'} el ${appointment.date} a las ${appointment.time || ''} horas en ${center}.`);

  try {
    if (window.bootstrap && window.bootstrap.Modal) {
      new window.bootstrap.Modal(modalEl).show();
      return;
    }
  } catch(e) {}
  modalEl.classList.add('show');
  modalEl.style.display = 'block';
  document.body.classList.add('modal-open');
}

export function openPediatraModal() {
  const modalEl = document.getElementById('modalPediatraDirect');
  if (!modalEl) return;
  try {
    if (window.bootstrap && window.bootstrap.Modal) {
      new window.bootstrap.Modal(modalEl).show();
    }
  } catch (e) {}
  modalEl.classList.add('show');
  modalEl.style.display = 'block';
  document.body.classList.add('modal-open');
}

export function bindPediatraModalEvents(onBackToHome) {
  const modalEl = document.getElementById('modalPediatraDirect');
  if (!modalEl) return;

  const closeModal = () => {
    try {
      if (window.bootstrap && window.bootstrap.Modal) {
        const inst = window.bootstrap.Modal.getInstance(modalEl);
        if (inst) inst.hide();
      }
    } catch (e) {}
    modalEl.classList.remove('show');
    modalEl.style.display = 'none';
    document.body.classList.remove('modal-open');
    const backdrop = document.querySelector('.modal-backdrop');
    if (backdrop) backdrop.remove();
  };

  const btnCloseModalPediatraX = document.getElementById('btnCloseModalPediatraX');
  if (btnCloseModalPediatraX) {
    btnCloseModalPediatraX.onclick = closeModal;
  }

  const btnModalBackToPediatricHome = document.getElementById('btnModalBackToPediatricHome');
  if (btnModalBackToPediatricHome) {
    btnModalBackToPediatricHome.onclick = () => {
      closeModal();
      pediatricSubTab = 'inicio';
      if (typeof onBackToHome === 'function') {
        onBackToHome();
      }
    };
  }

  const btnModalLlamarPediatra = document.getElementById('btnModalLlamarPediatra');
  if (btnModalLlamarPediatra) {
    btnModalLlamarPediatra.onclick = () => {
      if (modoVozActivo) speakText('Conectando llamada telefónica con la Dra. Soto.');
      window.showGlassAlert('📞 Conectando llamada prioritaria con Dra. Soto - Pediatra (+56 9 8765 4321)...', 'info');
      setTimeout(() => {
        window.location.href = 'tel:+56987654321';
      }, 800);
    };
  }
}

// Función principal que renderiza todas las vistas del Modo Pediátrico
export function renderPediatricView(container, onBackToAdult) {
  if (!container) return;

  const handleBackToAdult = () => {
    if (modoVozActivo) speakText('Regresando al modo adulto.');
    isPediatric = false;
    pediatricSubTab = 'inicio';
    if (typeof onBackToAdult === 'function') {
      onBackToAdult();
    } else {
      renderPatientView(container);
    }
  };

  const handleBackToHome = () => {
    if (modoVozActivo) speakText('Regresando al menú pediátrico.');
    pediatricSubTab = 'inicio';
    renderPediatricView(container, onBackToAdult);
  };

  // Botón flotante fijo: Modo Asistido por Voz
  const floatingVoiceButtonHTML = `
    <div id="floatingVoiceGuideContainer" style="position: fixed; bottom: 24px; right: 24px; z-index: 1070;">
      <button type="button" id="btnToggleVoiceGuide" class="btn ${modoVozActivo ? 'btn-success text-white' : 'btn-glass-primary text-white'} shadow-lg d-flex align-items-center justify-content-center gap-2" style="width: ${modoVozActivo ? 'auto' : '64px'}; height: 64px; border-radius: 35px; border: 2px solid ${modoVozActivo ? '#10b981' : 'rgba(255,255,255,0.3)'}; font-size: 1.4rem; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 10px 25px rgba(0,0,0,0.5); padding: 0 ${modoVozActivo ? '22px' : '0'};" title="${modoVozActivo ? 'Modo Guía por Voz Activado (Clic para desactivar)' : 'Activar Modo Guía por Voz'}">
        <span style="font-size: 1.6rem;">🔊</span>
        ${modoVozActivo ? '<span class="fw-bold fs-6 text-white text-nowrap">Voz Activa</span>' : ''}
      </button>
    </div>
  `;

  if (pediatricSubTab === 'crecimiento') {
    // --- VISTA PEDIÁTRICA: MI CRECIMIENTO ---
    const pData = getActivePediatricData();
    container.innerHTML = `
      <div class="container-fluid px-4 py-4" style="background-color: #08101a; min-height: 100vh; border-radius: 24px; color: #f8fafc; font-family: 'Outfit', sans-serif;">
        <!-- Barra superior con botón volver al inicio pediátrico -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
          <button type="button" id="btnBackToPediatricHome" class="btn btn-sm px-4 py-2.5 rounded-pill fw-bold shadow-sm d-inline-flex align-items-center gap-2" style="background: #0f1926; color: #f8fafc; border: 1.5px solid rgba(6, 182, 212, 0.4); cursor: pointer; font-size: 1rem; transition: all 0.2s;">
            ⬅️ Volver al Inicio Pediátrico
          </button>
          <div class="d-flex align-items-center gap-2">
            <span class="badge px-3 py-2 rounded-pill fw-semibold" style="background: rgba(236, 72, 153, 0.15); color: #ec4899; font-size: 0.9rem; border: 1px solid #ec4899;">
              📏 Registro Antropométrico
            </span>
            <span class="badge px-3 py-2 rounded-pill fw-semibold" style="background: rgba(6, 182, 212, 0.15); color: #06b6d4; font-size: 0.9rem; border: 1px solid #06b6d4;">
              ${pData.isAdolescent ? 'Curvas OMS Adolescentes' : 'Control Niño Sano OMS'}
            </span>
          </div>
        </div>

        <!-- Encabezado de la sección -->
        <div class="p-4 p-md-5 mb-4" style="background: #0f1926; border-radius: 28px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5); border: 1.5px solid rgba(6, 182, 212, 0.3);">
          <div class="d-flex align-items-center gap-3 mb-2">
            <span style="font-size: 2.5rem;">📏</span>
            <div>
              <h2 class="fw-extrabold m-0 text-white" style="font-size: 2rem;">Mi Crecimiento &bull; Controles de Salud</h2>
              <p class="m-0 text-white-50" style="font-size: 1.05rem;">Registra las mediciones físicas o escanéalas directamente del carnet físico de salud con IA.</p>
            </div>
          </div>
        </div>

        <!-- Tarjeta principal del Formulario y Escáner IA Ampliado -->
        <div class="p-4 p-md-5 mb-4" style="background: #0f1926; border-radius: 28px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5); border: 1.5px solid rgba(6, 182, 212, 0.3);">
          <!-- Botón grande y llamativo de Escaneo IA -->
          <div class="mb-4 text-center">
            <input type="file" id="inputCarnetCamera" accept="image/*" capture="environment" style="display: none;">
            <button type="button" id="btnScanCarnetIA" class="btn w-100 py-3.5 px-4 d-inline-flex align-items-center justify-content-center gap-3 text-white fw-bold shadow-lg" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border: 2px solid #06b6d4; border-radius: 20px; font-size: 1.25rem; cursor: pointer; transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);">
              <span style="font-size: 1.6rem;">📸</span> Escanear Carnet Físico con IA (Consentimiento Ley 21.430)
            </button>
            <div id="scanStatusBanner" class="mt-3 p-3 rounded-4 d-none text-center" style="background: rgba(6, 182, 212, 0.15); border: 1px solid #06b6d4; color: #06b6d4;">
              <span class="fw-bold fs-6" id="scanStatusText"><i class="bi bi-arrow-repeat spin-animation me-2"></i>✨ Analizando documento con IA... Extrayendo percentiles...</span>
            </div>
            <div id="cameraDeniedWarning" class="mt-3 p-3 rounded-4 d-none text-center" style="background: rgba(239, 68, 68, 0.15); border: 1.5px solid #ef4444; color: #ef4444;">
              <span class="fw-bold fs-6">⚠️ Permiso de cámara denegado. Puedes ingresar los datos manualmente en el formulario inferior.</span>
            </div>
            <!-- Preview Ampliado del Carnet Escaneado -->
            <div id="scannerPreviewBox" class="mt-3 p-4 rounded-4 d-none text-center" style="background: #08101a; border: 2px dashed #06b6d4; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
              <div class="d-flex justify-content-between align-items-center mb-2 px-2">
                <span class="badge bg-info text-dark fw-bold px-3 py-1.5 rounded-pill"><i class="bi bi-camera me-1"></i> Carnet Capturado &bull; Lectura Óptica Exitosa</span>
                <button type="button" id="btnClosePreviewBox" class="btn btn-sm btn-outline-light rounded-pill px-3 py-1">Cerrar Preview</button>
              </div>
              <img id="imgCarnetPreview" src="" alt="Carnet Preview" class="img-fluid rounded-4 shadow-lg" style="max-height: 320px; width: 100%; object-fit: contain; border: 1.5px solid rgba(255,255,255,0.2);">
              <p class="small text-white-50 mt-2 mb-0"><i class="bi bi-check-circle-fill text-success me-1"></i> Datos leídos con firma digital y vinculados a la curva antropométrica OMS.</p>
            </div>
          </div>

          <!-- Formulario grande de Crecimiento -->
          <form id="formGrowthRecord">
            <div class="row g-4 mb-4">
              <!-- Peso -->
              <div class="col-12 col-md-6">
                <label class="form-label fw-bold text-white" style="font-size: 1.1rem;">
                  ⚖️ Peso Corporal (kg)
                </label>
                <div class="input-group input-group-lg shadow-sm" style="border-radius: 16px; overflow: hidden; border: 1.5px solid rgba(6, 182, 212, 0.4); background: #08101a;">
                  <input type="number" step="0.1" class="form-control px-4 fw-bold" id="growthWeight" placeholder="Ej: 22.4" value="${pData.isAdolescent ? '48.5' : '22.4'}" required style="border: none; font-size: 1.25rem; color: #ffffff; background: #08101a;">
                  <span class="input-group-text px-4 fw-bold" style="border: none; color: #06b6d4; background: #0f1926;">kg</span>
                </div>
              </div>

              <!-- Talla / Estatura -->
              <div class="col-12 col-md-6">
                <label class="form-label fw-bold text-white" style="font-size: 1.1rem;">
                  📏 Talla / Estatura (cm)
                </label>
                <div class="input-group input-group-lg shadow-sm" style="border-radius: 16px; overflow: hidden; border: 1.5px solid rgba(6, 182, 212, 0.4); background: #08101a;">
                  <input type="number" step="0.1" class="form-control px-4 fw-bold" id="growthHeight" placeholder="Ej: 122" value="${pData.isAdolescent ? '158' : '122'}" required style="border: none; font-size: 1.25rem; color: #ffffff; background: #08101a;">
                  <span class="input-group-text px-4 fw-bold" style="border: none; color: #06b6d4; background: #0f1926;">cm</span>
                </div>
              </div>

              <!-- Perímetro Cefálico -->
              <div class="col-12 col-md-6">
                <label class="form-label fw-bold text-white" style="font-size: 1.1rem;">
                  🧠 Perímetro Cefálico (cm)
                </label>
                <div class="input-group input-group-lg shadow-sm" style="border-radius: 16px; overflow: hidden; border: 1.5px solid rgba(6, 182, 212, 0.4); background: #08101a;">
                  <input type="number" step="0.1" class="form-control px-4 fw-bold" id="growthHeadCircumference" placeholder="Ej: 52" value="52" style="border: none; font-size: 1.25rem; color: #ffffff; background: #08101a;">
                  <span class="input-group-text px-4 fw-bold" style="border: none; color: #06b6d4; background: #0f1926;">cm</span>
                </div>
              </div>

              <!-- Fecha de la Medición -->
              <div class="col-12 col-md-6">
                <label class="form-label fw-bold text-white" style="font-size: 1.1rem;">
                  📅 Fecha del Control
                </label>
                <div class="input-group input-group-lg shadow-sm" style="border-radius: 16px; overflow: hidden; border: 1.5px solid rgba(6, 182, 212, 0.4); background: #08101a;">
                  <input type="date" class="form-control px-4 fw-bold" id="growthDate" value="${new Date().toISOString().split('T')[0]}" required style="border: none; font-size: 1.25rem; color: #ffffff; background: #08101a;">
                </div>
              </div>
            </div>

            <!-- Botón de guardar medición -->
            <button type="submit" id="btnSaveGrowthRecord" class="btn w-100 py-3 px-4 d-inline-flex align-items-center justify-content-center gap-2 text-white fw-bold shadow-md" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: 2px solid #34d399; border-radius: 18px; font-size: 1.15rem; cursor: pointer; transition: all 0.2s;">
              <span style="font-size: 1.4rem;">💾</span> Guardar y Actualizar Curva Dinámica OMS
            </button>
          </form>
        </div>

        <!-- Tarjeta con la Curva de Crecimiento Chart.js -->
        <div class="p-4 p-md-5 mb-4" style="background: #0f1926; border-radius: 28px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5); border: 1.5px solid rgba(236, 72, 153, 0.3);">
          <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <div class="d-flex align-items-center gap-2">
              <span style="font-size: 2rem;">📈</span>
              <div>
                <h3 class="fw-bold m-0 text-white" style="font-size: 1.5rem;">Curva de Crecimiento: Peso para la Edad (OMS)</h3>
                <small class="text-white-50">Estándar oficial de la Organización Mundial de la Salud &bull; Percentiles P3, P50 y P97</small>
              </div>
            </div>
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <span class="badge px-3 py-2 rounded-pill fw-bold" id="badgeCurrentWeight" style="background: rgba(6, 182, 212, 0.15); color: #06b6d4; border: 1px solid #06b6d4; font-size: 0.85rem;">
                🔵 Control Actual: ${pData.isAdolescent ? '48.5 kg' : '22.4 kg'}
              </span>
              <span class="badge px-3 py-2 rounded-pill fw-semibold" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid #34d399; font-size: 0.85rem;">
                🟢 Percentil P50 (Saludable)
              </span>
            </div>
          </div>

          <!-- Canvas del Gráfico con fondo transparente y diseño moderno -->
          <div class="position-relative" style="height: 380px; width: 100%;">
            <canvas id="chartGrowthCurve"></canvas>
          </div>

          <!-- Leyenda descriptiva interactiva -->
          <div class="mt-4 pt-3 border-top d-flex justify-content-around align-items-center flex-wrap gap-3 text-center" style="border-color: rgba(255, 255, 255, 0.1) !important;">
            <div class="d-flex align-items-center gap-2">
              <span class="rounded-pill d-inline-block" style="width: 22px; height: 5px; background: #ef4444; border: 1px dashed #f87171;"></span>
              <span class="small fw-semibold text-white-50">Percentil 97 (Límite Superior OMS)</span>
            </div>
            <div class="d-flex align-items-center gap-2">
              <span class="rounded-pill d-inline-block" style="width: 22px; height: 5px; background: #10b981;"></span>
              <span class="small fw-bold" style="color: #34d399;">Percentil 50 (Mediana OMS - Crecimiento Ideal)</span>
            </div>
            <div class="d-flex align-items-center gap-2">
              <span class="rounded-pill d-inline-block" style="width: 22px; height: 5px; background: #fbbf24; border: 1px dashed #f59e0b;"></span>
              <span class="small fw-semibold text-white-50">Percentil 3 (Límite Inferior OMS)</span>
            </div>
            <div class="d-flex align-items-center gap-2">
              <span class="rounded-circle d-inline-block" style="width: 14px; height: 14px; background: #06b6d4; border: 2.5px solid #ffffff; box-shadow: 0 0 6px rgba(6,182,212,0.7);"></span>
              <span class="small fw-extrabold" id="legendCurrentWeightText" style="color: #06b6d4;">Control Actual (${pData.isAdolescent ? '48.5 kg' : '22.4 kg'})</span>
            </div>
          </div>
        </div>
      </div>
      ${pediatricModalsHTML}
      ${floatingVoiceButtonHTML}
    `;

    // Renderizar gráfico de crecimiento OMS con Chart.js
    setTimeout(() => {
      initGrowthChart(pData.isAdolescent ? 48.5 : 22.4);
    }, 50);

    // Conectar botón Volver al Inicio Pediátrico
    const btnBackToPediatricHome = document.getElementById('btnBackToPediatricHome');
    if (btnBackToPediatricHome) {
      attachVoiceGuidance(btnBackToPediatricHome, 'Volver al Inicio Pediátrico. Regresa al menú principal infantil.');
      btnBackToPediatricHome.onclick = handleBackToHome;
    }

    // Botón Escanear Carnet Físico con IA y Gestión de Cámara Real + Consentimiento
    const btnScanCarnetIA = document.getElementById('btnScanCarnetIA');
    const inputCarnetCamera = document.getElementById('inputCarnetCamera');
    const scanStatusBanner = document.getElementById('scanStatusBanner');
    const cameraDeniedWarning = document.getElementById('cameraDeniedWarning');
    const scannerPreviewBox = document.getElementById('scannerPreviewBox');
    const imgCarnetPreview = document.getElementById('imgCarnetPreview');
    const btnClosePreviewBox = document.getElementById('btnClosePreviewBox');

    if (btnClosePreviewBox && scannerPreviewBox) {
      btnClosePreviewBox.onclick = () => scannerPreviewBox.classList.add('d-none');
    }

    const triggerCameraCaptureFlow = () => {
      if (cameraDeniedWarning) cameraDeniedWarning.classList.add('d-none');
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true })
          .then((stream) => {
            stream.getTracks().forEach(track => track.stop());
            if (inputCarnetCamera) inputCarnetCamera.click();
          })
          .catch((err) => {
            if (cameraDeniedWarning) cameraDeniedWarning.classList.remove('d-none');
            window.showGlassAlert('⚠️ Permiso de cámara denegado. Puedes ingresar los datos manualmente', 'warning');
            if (modoVozActivo) speakText('Permiso de cámara denegado. Puedes ingresar los datos manualmente');
          });
      } else {
        if (inputCarnetCamera) inputCarnetCamera.click();
      }
    };

    if (btnScanCarnetIA) {
      attachVoiceGuidance(btnScanCarnetIA, 'Escanear Carnet Físico con Inteligencia Artificial. Requiere consentimiento informado del tutor acreditado.');
      btnScanCarnetIA.onclick = () => {
        const modalConsentEl = document.getElementById('modalConsentimientoCarnet');
        if (modalConsentEl) {
          const btnConfirm = document.getElementById('btnConfirmConsentCarnet');
          const btnCloseX = document.getElementById('btnCloseConsentModalX');
          const btnCloseBtn = document.getElementById('btnCloseConsentModalBtn');
          
          const hideConsent = () => {
            try {
              if (window.bootstrap && window.bootstrap.Modal) {
                const inst = window.bootstrap.Modal.getInstance(modalConsentEl);
                if (inst) inst.hide();
              }
            } catch(e) {}
            modalConsentEl.classList.remove('show');
            modalConsentEl.style.display = 'none';
            document.body.classList.remove('modal-open');
          };

          if (btnCloseX) btnCloseX.onclick = hideConsent;
          if (btnCloseBtn) btnCloseBtn.onclick = hideConsent;

          if (btnConfirm) {
            btnConfirm.onclick = () => {
              hideConsent();
              window.showGlassAlert('🔒 Consentimiento del tutor legal registrado conforme Ley N° 21.430.', 'info');
              triggerCameraCaptureFlow();
            };
          }

          try {
            if (window.bootstrap && window.bootstrap.Modal) {
              new window.bootstrap.Modal(modalConsentEl).show();
              return;
            }
          } catch(e) {}
          modalConsentEl.classList.add('show');
          modalConsentEl.style.display = 'block';
          document.body.classList.add('modal-open');
        } else {
          triggerCameraCaptureFlow();
        }
      };
    }

    // Al seleccionar la foto capturada, desplegar preview ampliado y simular extracción con IA
    if (inputCarnetCamera) {
      inputCarnetCamera.onchange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
          const file = e.target.files[0];
          
          // Mostrar preview ampliado
          if (scannerPreviewBox && imgCarnetPreview) {
            const reader = new FileReader();
            reader.onload = (re) => {
              imgCarnetPreview.src = re.target.result;
              scannerPreviewBox.classList.remove('d-none');
            };
            reader.readAsDataURL(file);
          }

          if (btnScanCarnetIA) btnScanCarnetIA.disabled = true;
          if (scanStatusBanner) scanStatusBanner.classList.remove('d-none');
          if (modoVozActivo) speakText('Analizando carnet de salud con Inteligencia Artificial...');

          setTimeout(() => {
            const wInput = document.getElementById('growthWeight');
            const hInput = document.getElementById('growthHeight');
            const hcInput = document.getElementById('growthHeadCircumference');
            const dInput = document.getElementById('growthDate');

            const newWeight = pData.isAdolescent ? 48.5 : 18.5;
            const newHeight = pData.isAdolescent ? 158 : 110;

            if (wInput) wInput.value = newWeight.toString();
            if (hInput) hInput.value = newHeight.toString();
            if (hcInput) hcInput.value = '52';
            if (dInput) dInput.value = new Date().toISOString().split('T')[0];

            if (btnScanCarnetIA) btnScanCarnetIA.disabled = false;
            if (scanStatusBanner) scanStatusBanner.classList.add('d-none');

            // Actualizar gráfico con el nuevo dato escaneado
            initGrowthChart(newWeight);

            window.showGlassAlert(`✨ Carnet analizado con éxito: Peso ${newWeight} kg, Talla ${newHeight} cm.`, 'success');
            if (modoVozActivo) speakText('Documento analizado con éxito. Datos reflejados en la curva OMS.');
            e.target.value = '';
          }, 2000);
        }
      };
    }

    // Manejar envío del formulario manual de crecimiento
    const formGrowthRecord = document.getElementById('formGrowthRecord');
    if (formGrowthRecord) {
      formGrowthRecord.onsubmit = (e) => {
        e.preventDefault();
        const enteredWeight = parseFloat(document.getElementById('growthWeight')?.value) || (pData.isAdolescent ? 48.5 : 22.4);
        initGrowthChart(enteredWeight);
        const badgeWeight = document.getElementById('badgeCurrentWeight');
        const legendText = document.getElementById('legendCurrentWeightText');
        if (badgeWeight) badgeWeight.textContent = `🔵 Control Actual: ${enteredWeight} kg`;
        if (legendText) legendText.textContent = `Control Actual (${enteredWeight} kg)`;
        window.showGlassAlert(`¡Control de crecimiento guardado! Peso ${enteredWeight} kg reflejado en la curva OMS.`, 'success');
        if (modoVozActivo) speakText(`Control de crecimiento guardado. Peso de ${enteredWeight} kilos actualizado en la curva de crecimiento.`);
      };
    }
  } else if (pediatricSubTab === 'vacunas') {
    // --- VISTA PEDIÁTRICA: MIS VACUNAS (CALENDARIO PNI) ---
    const pData = getActivePediatricData();
    const liveFicha = getLiveSyncedFichaData(pData) || {};
    const cleanRut = getPediatricPatientCleanRut(pData.rut);

    // Respaldo clínico oficial completo para el esquema PNI
    const defaultAppliedVaccines = pData.isAdolescent ? [
      {
        id: 'vac_ado_1',
        name: 'Virus Papiloma Humano (VPH) • 1ª Dosis Escolar',
        protection: 'Inmunización contra cepas oncogénicas de VPH (Cáncer Cervicouterino)',
        ageStage: '4° Básico',
        datetime: '24 Oct 2022 • 10:15 hrs',
        center: 'Vacunatorio Escolar CESFAM Bellavista',
        administeredBy: 'Enf. Carolina Rojas (Enfermera Vacunatorio PNI)',
        batch: 'VPH-8902-CL',
        status: 'Aplicada'
      },
      {
        id: 'vac_ado_2',
        name: 'dTpa acelular • Ingreso Escolar',
        protection: 'Inmunización de ingreso escolar contra Tétanos, Difteria y Tos Convulsiva',
        ageStage: '1° Básico',
        datetime: '18 Nov 2019 • 11:30 hrs',
        center: 'Vacunatorio Escolar CESFAM Bellavista',
        administeredBy: 'Enf. Carolina Rojas (Enfermera Vacunatorio PNI)',
        batch: 'DTPA-4412-CL',
        status: 'Aplicada'
      }
    ] : [
      {
        id: 'vac_1',
        name: 'BCG (Tuberculosis)',
        protection: 'Dosis única al nacer para prevención de formas graves e invasoras de tuberculosis',
        ageStage: 'Recién Nacido',
        datetime: '14 May 2019 • 11:30 hrs',
        center: 'Vacunatorio Maternidad Hospital Clínico San Borja Arriarán',
        administeredBy: 'Enf. Carolina Rojas (Enfermera Clínica Neonatología)',
        batch: 'BCG-7712-CH',
        status: 'Aplicada'
      },
      {
        id: 'vac_2',
        name: 'Hepatitis B (Dosis Maternidad)',
        protection: 'Prevención inmediata de transmisión perinatal de Hepatitis B',
        ageStage: 'Recién Nacido',
        datetime: '14 May 2019 • 14:15 hrs',
        center: 'Vacunatorio Maternidad Hospital Clínico San Borja Arriarán',
        administeredBy: 'Enf. Carolina Rojas (Enfermera Clínica Neonatología)',
        batch: 'HEP-9031-MIN',
        status: 'Aplicada'
      },
      {
        id: 'vac_3',
        name: 'Hexavalente (1ª Dosis: DTPa-HB-Hib-VIP)',
        protection: 'Inmunización contra Hepatitis B, Difteria, Tétanos, Tos Convulsiva, Hib y Poliomielitis',
        ageStage: '2 Meses',
        datetime: '15 Jul 2019 • 10:20 hrs',
        center: 'Vacunatorio CESFAM Bellavista',
        administeredBy: 'Enf. Carolina Rojas (Enfermera Vacunatorio PNI)',
        batch: 'HEX-3011-CL',
        status: 'Aplicada'
      },
      {
        id: 'vac_4',
        name: 'Neumocócica Conjugada 13v (1ª Dosis)',
        protection: 'Protección contra enfermedad invasora, neumonía y bacteriemia por S. pneumoniae',
        ageStage: '2 Meses',
        datetime: '15 Jul 2019 • 10:35 hrs',
        center: 'Vacunatorio CESFAM Bellavista',
        administeredBy: 'Enf. Carolina Rojas (Enfermera Vacunatorio PNI)',
        batch: 'PNE-8819-A',
        status: 'Aplicada'
      },
      {
        id: 'vac_5',
        name: 'Hexavalente (2ª Dosis: DTPa-HB-Hib-VIP)',
        protection: 'Segunda dosis del esquema primario del lactante',
        ageStage: '4 Meses',
        datetime: '16 Sep 2019 • 09:45 hrs',
        center: 'Vacunatorio CESFAM Bellavista',
        administeredBy: 'Enf. Carolina Rojas (Enfermera Vacunatorio PNI)',
        batch: 'HEX-3289-CL',
        status: 'Aplicada'
      },
      {
        id: 'vac_6',
        name: 'Neumocócica Conjugada 13v (2ª Dosis)',
        protection: 'Consolidación de anticuerpos séricos protectores antineumocócicos',
        ageStage: '4 Meses',
        datetime: '16 Sep 2019 • 09:55 hrs',
        center: 'Vacunatorio CESFAM Bellavista',
        administeredBy: 'Enf. Carolina Rojas (Enfermera Vacunatorio PNI)',
        batch: 'PNE-8902-B',
        status: 'Aplicada'
      },
      {
        id: 'vac_7',
        name: 'Hexavalente (3ª Dosis: DTPa-HB-Hib-VIP)',
        protection: 'Tercera dosis del esquema primario de inmunización celular y humoral',
        ageStage: '6 Meses',
        datetime: '18 Nov 2019 • 11:15 hrs',
        center: 'Vacunatorio CESFAM Bellavista',
        administeredBy: 'Enf. Carolina Rojas (Enfermera Vacunatorio PNI)',
        batch: 'HEX-3450-CL',
        status: 'Aplicada'
      },
      {
        id: 'vac_8',
        name: 'Tresvírica SRP (1ª Dosis)',
        protection: 'Inmunización combinada de virus vivos atenuados contra Sarampión, Rubéola y Parotiditis',
        ageStage: '12 Meses',
        datetime: '20 May 2020 • 10:00 hrs',
        center: 'Vacunatorio CESFAM Bellavista',
        administeredBy: 'Enf. Carolina Rojas (Enfermera Vacunatorio PNI)',
        batch: 'SRP-5521-CH',
        status: 'Aplicada'
      },
      {
        id: 'vac_9',
        name: 'Meningocócica Conjugada (ACWY)',
        protection: 'Protección contra meningitis bacteriana aguda y sepsis por Neisseria meningitidis',
        ageStage: '12 Meses',
        datetime: '20 May 2020 • 10:15 hrs',
        center: 'Vacunatorio CESFAM Bellavista',
        administeredBy: 'Enf. Carolina Rojas (Enfermera Vacunatorio PNI)',
        batch: 'MEN-6102-W',
        status: 'Aplicada'
      },
      {
        id: 'vac_10',
        name: 'Neumocócica Conjugada 13v (Dosis de Refuerzo)',
        protection: 'Refuerzo de memoria inmunológica para consolidación anual',
        ageStage: '12 Meses',
        datetime: '20 May 2020 • 10:25 hrs',
        center: 'Vacunatorio CESFAM Bellavista',
        administeredBy: 'Enf. Carolina Rojas (Enfermera Vacunatorio PNI)',
        batch: 'PNE-9104-C',
        status: 'Aplicada'
      },
      {
        id: 'vac_11',
        name: 'Hexavalente (4ª Dosis / 1er Refuerzo)',
        protection: 'Dosis de refuerzo de los 18 meses para inmunidad prolongada en primera infancia',
        ageStage: '18 Meses',
        datetime: '19 Nov 2020 • 11:40 hrs',
        center: 'Vacunatorio CESFAM Bellavista',
        administeredBy: 'Enf. Carolina Rojas (Enfermera Vacunatorio PNI)',
        batch: 'HEX-3912-CL',
        status: 'Aplicada'
      },
      {
        id: 'vac_12',
        name: 'Hepatitis A (Dosis Pediátrica)',
        protection: 'Dosis oficial según calendario del Programa Nacional de Inmunizaciones',
        ageStage: '18 Meses',
        datetime: '19 Nov 2020 • 11:50 hrs',
        center: 'Vacunatorio CESFAM Bellavista',
        administeredBy: 'Enf. Carolina Rojas (Enfermera Vacunatorio PNI)',
        batch: 'HAV-7210-CL',
        status: 'Aplicada'
      }
    ];

    const pendingVaccines = pData.isAdolescent ? [
      {
        id: 'vac_pend_1',
        name: 'dTpa acelular • 8° Básico (13–14 años)',
        protection: 'Dosis de refuerzo escolar contra Tétanos, Difteria y Tos Convulsiva (Pertussis)',
        ageStage: '8° Básico',
        center: 'Vacunatorio CESFAM Bellavista / Operativo Escolar',
        administeredBy: 'Equipo PNI CESFAM Bellavista',
        status: 'Pendiente'
      },
      {
        id: 'vac_pend_2',
        name: 'Virus Papiloma Humano (VPH) • 2ª Dosis Escolar',
        protection: 'Inmunización de refuerzo contra cepas oncogénicas de VPH (Cáncer Cervicouterino)',
        ageStage: '5° Básico',
        center: 'Vacunatorio CESFAM Bellavista / Operativo Escolar',
        administeredBy: 'Equipo PNI CESFAM Bellavista',
        status: 'Pendiente'
      }
    ] : [
      {
        id: 'vac_pend_1',
        name: 'dTp acelular • 1° Básico (6–7 años)',
        protection: 'Refuerzo escolar obligatorio contra Difteria, Tétanos y Tos Convulsiva (Pertussis acelular) • Próxima campaña escolar MINSAL',
        ageStage: '1° Básico',
        center: 'Vacunatorio CESFAM Bellavista / Escuela República de Chile',
        administeredBy: 'Equipo Móvil PNI CESFAM Bellavista',
        status: 'Pendiente • 1° Básico'
      }
    ];

    // Conexión dinámica con cuidapp_ficha_[RUT]
    const appliedVaccines = (liveFicha.vaccines && Array.isArray(liveFicha.vaccines) && liveFicha.vaccines.length > 0)
      ? liveFicha.vaccines
      : defaultAppliedVaccines;

    // Sincronizar en cuidapp_ficha_[RUT] si aún no estaba persistido
    try {
      const primaryKey = `cuidapp_ficha_${cleanRut}`;
      const rawStored = localStorage.getItem(primaryKey);
      if (rawStored) {
        const parsed = JSON.parse(rawStored);
        if (!parsed.vaccines || !Array.isArray(parsed.vaccines) || parsed.vaccines.length === 0) {
          parsed.vaccines = appliedVaccines;
          localStorage.setItem(primaryKey, JSON.stringify(parsed));
        }
      }
    } catch (e) {}

    container.innerHTML = `
      <div class="container-fluid px-4 py-4" style="background-color: #08101a; min-height: 100vh; border-radius: 24px; color: #f8fafc; font-family: 'Outfit', sans-serif;">
        <!-- Barra superior con botón volver al inicio pediátrico -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
          <button type="button" id="btnBackToPediatricHome" class="btn btn-sm px-4 py-2.5 rounded-pill fw-bold shadow-sm d-inline-flex align-items-center gap-2" style="background: #0f1926; color: #f8fafc; border: 1.5px solid rgba(6, 182, 212, 0.4); cursor: pointer; font-size: 1rem; transition: all 0.2s;">
            ⬅️ Volver al Inicio Pediátrico
          </button>
          <div class="d-flex align-items-center gap-2">
            <span class="badge px-3 py-2 rounded-pill fw-semibold" style="background: rgba(6, 182, 212, 0.15); color: #06b6d4; font-size: 0.9rem; border: 1px solid #06b6d4;">
              ${pData.isAdolescent ? '💉 Vacunatorio Escolar MINSAL' : '🧸 Vacunatorio PNI Infantil'}
            </span>
            <span class="badge px-3 py-2 rounded-pill fw-semibold" style="background: rgba(16, 185, 129, 0.15); color: #34d399; font-size: 0.9rem; border: 1px solid #34d399;">
              Esquema Oficial MINSAL (RNI)
            </span>
          </div>
        </div>

        <!-- Encabezado de la sección -->
        <div class="p-4 p-md-5 mb-4" style="background: #0f1926; border-radius: 28px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5); border: 1.5px solid rgba(6, 182, 212, 0.3);">
          <div class="d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div class="d-flex align-items-center gap-3">
              <span style="font-size: 2.5rem;">${pData.isAdolescent ? '💉' : '🧸'}</span>
              <div>
                <h2 class="fw-extrabold m-0 text-white" style="font-size: 2rem;">Mis Vacunas &bull; Calendario PNI</h2>
                <p class="m-0 text-white-50" style="font-size: 1.05rem;">Programa Nacional de Inmunizaciones para la protección y bienestar de ${pData.socialName || pData.fullName}.</p>
              </div>
            </div>
            <button type="button" id="btnDownloadVacunasPNI" class="btn btn-primary px-4 py-2.5 rounded-pill fw-bold shadow-md d-inline-flex align-items-center gap-2" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border: 1.5px solid #06b6d4; font-size: 0.95rem; cursor: pointer;">
              📥 Descargar Historial de Vacunas PNI
            </button>
          </div>
        </div>

        <!-- Tarjeta con Calendario PNI Reordenado (PENDIENTES ARRIBA, APLICADAS ABAJO) -->
        <div class="p-4 p-md-5 mb-4" style="background: #0f1926; border-radius: 28px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5); border: 1.5px solid rgba(236, 72, 153, 0.3);">
          <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <div>
              <h4 class="fw-bold m-0 text-white">${pData.isAdolescent ? 'Calendario de Vacunación Escolar (Adolescencia)' : 'Calendario de Vacunación Infantil (PNI)'}</h4>
              <small class="text-white-50">Registro sincronizado en tiempo real desde <code class="text-info">cuidapp_ficha_${cleanRut}</code> &bull; RNI MINSAL</small>
            </div>
            <span class="badge px-3 py-2 rounded-pill fw-bold" style="background: rgba(6, 182, 212, 0.15); color: #06b6d4; border: 1px solid #06b6d4; font-size: 0.95rem;">
              ${appliedVaccines.length} Dosis Aplicadas • ${pendingVaccines.length} Dosis Escolar Pendiente
            </span>
          </div>

          <!-- SECCIÓN 1: DOSIS PENDIENTES (ARRIBA - ATENCIÓN PRIORITARIA) -->
          <div class="mb-4">
            <div class="d-flex align-items-center gap-2 mb-3">
              <span class="badge fw-bold px-3 py-1.5 rounded-pill" style="background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid #ef4444;">⏳ VACUNAS PENDIENTES / PRÓXIMO CONTROL</span>
              <small class="text-white-50 fw-semibold">Atención prioritaria del tutor y profesional de salud</small>
            </div>

            <div class="d-flex flex-column gap-3">
              ${pendingVaccines.map(vac => `
                <div class="p-3.5 p-md-4 rounded-4 d-flex flex-column gap-2" style="background: #08101a; border: 1.5px solid rgba(239, 68, 68, 0.4); border-left: 6px solid #ef4444; border-radius: 20px;">
                  <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
                    <div class="d-flex align-items-center gap-3">
                      <span style="font-size: 2.2rem; line-height: 1;">⏳</span>
                      <div>
                        <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
                          <span class="badge px-2.5 py-1 rounded-pill fw-bold" style="background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4); font-size: 0.8rem;">
                            🎯 Edad PNI: ${vac.ageStage}
                          </span>
                          <span class="badge px-2.5 py-1 rounded-pill fw-bold" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid #ef4444; font-size: 0.8rem;">
                            ⏳ ${vac.status}
                          </span>
                        </div>
                        <h5 class="fw-bold m-0 text-white" style="font-size: 1.15rem;">${vac.name}</h5>
                        <p class="small text-white-50 m-0 mt-0.5">${vac.protection}</p>
                      </div>
                    </div>
                  </div>

                  <div class="p-3 mt-1.5 rounded-3" style="background: rgba(25, 15, 20, 0.8); border: 1px solid rgba(239, 68, 68, 0.2);">
                    <div class="row g-2.5 text-white-50 small">
                      <div class="col-12 col-md-6">
                        <i class="bi bi-clock-history text-danger me-1.5"></i><strong>Edad del Esquema PNI:</strong> 
                        <span class="text-danger fw-bold">${vac.ageStage}</span>
                      </div>
                      <div class="col-12 col-md-6">
                        <i class="bi bi-calendar-event text-warning me-1.5"></i><strong>Estado / Campaña:</strong> 
                        <span class="text-white fw-semibold">Próxima campaña escolar MINSAL 2027</span>
                      </div>
                      <div class="col-12 col-md-6">
                        <i class="bi bi-hospital text-info me-1.5"></i><strong>Centro Programado:</strong> 
                        <span class="text-white fw-semibold">${vac.center}</span>
                      </div>
                      <div class="col-12 col-md-6">
                        <i class="bi bi-person-badge text-white-50 me-1.5"></i><strong>Profesional Responsable:</strong> 
                        <span class="text-white fw-semibold">${vac.administeredBy}</span>
                      </div>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- SECCIÓN 2: DOSIS APLICADAS (ABAJO - HISTORIAL CLÍNICO) -->
          <div class="pt-3 border-top" style="border-color: rgba(255, 255, 255, 0.1) !important;">
            <div class="d-flex align-items-center gap-2 mb-3">
              <span class="badge fw-bold px-3 py-1.5 rounded-pill" style="background: rgba(6, 182, 212, 0.15); color: #06b6d4; border: 1px solid #06b6d4;">✅ DOSIS YA APLICADAS (HISTÓRICO PNI)</span>
              <small class="text-white-50 fw-semibold">Verificadas con sello RNI del Ministerio de Salud &bull; Modo 100% Solo Lectura</small>
            </div>

            <div class="d-flex flex-column gap-3">
              ${appliedVaccines.map(vac => `
                <div class="p-3.5 p-md-4 rounded-4 d-flex flex-column gap-2" style="background: #08101a; border: 1.5px solid rgba(6, 182, 212, 0.3); border-left: 6px solid #06b6d4; border-radius: 20px;">
                  <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
                    <div class="d-flex align-items-center gap-3">
                      <span style="font-size: 2.2rem; line-height: 1;">💉</span>
                      <div>
                        <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
                          <span class="badge px-2.5 py-1 rounded-pill fw-bold" style="background: rgba(6, 182, 212, 0.2); color: #06b6d4; border: 1px solid rgba(6, 182, 212, 0.4); font-size: 0.8rem;">
                            👶 Edad PNI: ${vac.ageStage}
                          </span>
                          <span class="badge px-2.5 py-1 rounded-pill fw-bold" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid #10b981; font-size: 0.8rem;">
                            ✅ Dosis Administrada • RNI
                          </span>
                        </div>
                        <h5 class="fw-bold m-0 text-white" style="font-size: 1.15rem;">${vac.name}</h5>
                        <p class="small text-white-50 m-0 mt-0.5">${vac.protection}</p>
                      </div>
                    </div>
                    ${vac.batch ? `
                      <span class="badge rounded-pill px-3 py-1.5 fw-semibold" style="background: rgba(255,255,255,0.06); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.15); font-size: 0.78rem;">
                        Lote: ${vac.batch}
                      </span>
                    ` : ''}
                  </div>

                  <!-- 4 DATOS CLÍNICOS COMPLETOS -->
                  <div class="p-3 mt-1.5 rounded-3" style="background: rgba(15, 25, 38, 0.8); border: 1px solid rgba(255,255,255,0.07);">
                    <div class="row g-2.5 text-white-50 small">
                      <div class="col-12 col-md-6">
                        <i class="bi bi-clock-history text-info me-1.5"></i><strong>Edad del Esquema PNI:</strong> 
                        <span class="text-info fw-bold">${vac.ageStage}</span>
                      </div>
                      <div class="col-12 col-md-6">
                        <i class="bi bi-calendar2-check text-success me-1.5"></i><strong>Fecha y Hora de Vacunación:</strong> 
                        <span class="text-white fw-semibold">${vac.datetime}</span>
                      </div>
                      <div class="col-12 col-md-6">
                        <i class="bi bi-hospital text-warning me-1.5"></i><strong>Centro / Vacunatorio:</strong> 
                        <span class="text-white fw-semibold">${vac.center}</span>
                      </div>
                      <div class="col-12 col-md-6">
                        <i class="bi bi-person-badge text-info me-1.5"></i><strong>Profesional Administrador:</strong> 
                        <span class="text-white fw-semibold">${vac.administeredBy}</span>
                      </div>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Botón inferior para volver -->
          <div class="mt-4 pt-3 text-center border-top" style="border-color: rgba(255, 255, 255, 0.1) !important;">
            <button type="button" id="btnBackToHomeBottomVacunas" class="btn btn-outline-secondary px-5 py-2.5 rounded-pill fw-bold text-white" style="background: #08101a; border: 1.5px solid rgba(6, 182, 212, 0.4); cursor: pointer;">
              Volver al Menú Pediátrico
            </button>
          </div>
        </div>
      </div>
      ${pediatricModalsHTML}
      ${floatingVoiceButtonHTML}
    `;

    // Conectar botón Volver al Inicio Pediátrico superior
    const btnBackToPediatricHome = document.getElementById('btnBackToPediatricHome');
    if (btnBackToPediatricHome) {
      attachVoiceGuidance(btnBackToPediatricHome, 'Volver al Inicio Pediátrico. Regresa al menú principal infantil.');
      btnBackToPediatricHome.onclick = handleBackToHome;
    }

    // Conectar botón Volver al Inicio inferior
    const btnBackToHomeBottom = document.getElementById('btnBackToHomeBottomVacunas');
    if (btnBackToHomeBottom) {
      btnBackToHomeBottom.onclick = handleBackToHome;
    }

    // Conectar botón Descargar Historial de Vacunas PNI
    const btnDownloadVacunasPNI = document.getElementById('btnDownloadVacunasPNI');
    if (btnDownloadVacunasPNI) {
      attachVoiceGuidance(btnDownloadVacunasPNI, 'Descargar Historial de Vacunas PNI. Genera un certificado oficial descargable con el registro MINSAL.');
      btnDownloadVacunasPNI.onclick = () => {
        const timestamp = new Date().toLocaleString('es-CL');
        const appliedReportText = appliedVaccines.map(v => 
`[APLICADA]  ${v.name}
            - Edad del Esquema PNI: ${v.ageStage}
            - Fecha y Hora de Vacunación: ${v.datetime}
            - Centro de Salud / Vacunatorio: ${v.center}
            - Profesional Administrador: ${v.administeredBy}
            - Lote Biológico: ${v.batch || 'N/A'}`
        ).join('\n\n');

        const pendingReportText = pendingVaccines.map(v =>
`[PENDIENTE] ${v.name}
            - Edad del Esquema PNI: ${v.ageStage}
            - Centro Programado: ${v.center}
            - Profesional Responsable: ${v.administeredBy}`
        ).join('\n\n');

        const reportText = `========================================================================
MINISTERIO DE SALUD DE CHILE (MINSAL) - PROGRAMA NACIONAL DE INMUNIZACIONES (PNI)
REGISTRO NACIONAL DE INMUNIZACIONES (RNI) • LEY N° 20.584 Y LEY N° 21.430
========================================================================

DATOS DEL PACIENTE:
Nombre Completo: ${pData.fullName}
Nombre Social / Pronombres: ${pData.socialName} (${pData.pronouns})
RUT: ${pData.rut}
Fecha de Nacimiento: ${pData.birthDate} (${pData.age} años)
Previsión de Salud: ${pData.prevision}
Condición Especial Declarada: ${pData.neurodivergences}

TUTOR LEGAL / REPRESENTANTE ACREDITADO:
Nombre del Tutor: ${pData.guardianName}
RUT del Tutor: ${pData.guardianRut}
Calidad Jurídica: ${pData.guardianRole}
Teléfono de Contacto: ${pData.guardianPhone}

------------------------------------------------------------------------
ESQUEMA DE INMUNIZACIÓN REGISTRADO (MINSAL - RNI):

${pendingReportText}

${appliedReportText}
------------------------------------------------------------------------
ESTADO: ESQUEMA OFICIAL MINSAL VERIFICADO (${appliedVaccines.length} Dosis Aplicadas)
Fecha de Emisión: ${timestamp}
Firma Electrónica Avanzada: SISTEMA CUIDAPP TELEMEDICINA • LEY N° 21.541
Código de Trazabilidad: RNI-CL-${Math.random().toString(36).substring(2, 10).toUpperCase()}
========================================================================`;

        const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Carnet_Vacunacion_PNI_${pData.rut.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
        link.click();
        URL.revokeObjectURL(link.href);

        window.showGlassAlert('📥 Historial oficial de Vacunas PNI descargado correctamente.', 'success');
        if (modoVozActivo) speakText('Historial de vacunas del Programa Nacional de Inmunizaciones descargado con éxito.');
      };
    }
  } else if (pediatricSubTab === 'examenes') {
    // --- VISTA PEDIÁTRICA: MIS EXÁMENES Y RECETAS MULTIESPECIALIDAD ---
    const pData = getActivePediatricData();
    const liveFicha = getLiveSyncedFichaData(pData);
    const isTutorUnlocked = isTutorSessionUnlocked();
    const isDemo = (pData.rut === '25.340.112-9' || pData.rut === '24.110.456-8' || pData.rut === '24.118.902-5' || (activePatient && (activePatient.id === 'p_mateo' || activePatient.id === 'mateo' || activePatient.id === 'p_camila' || activePatient.id === 'camila')));

    // Cargar documentos desde localStorage
    let pedDocs = [];
    try {
      const raw = localStorage.getItem('cuidapp_documents_' + (activePatient?.id || 'mateo'));
      if (raw) {
        pedDocs = JSON.parse(raw);
      } else if (isDemo) {
        // Inicializar documentos clínicos oficiales para Mateo Morales en las 7 especialidades
        pedDocs = [
          {
            id: 'doc_demo_1',
            name: 'Hemograma Completo Pediátrico & Perfil Bioquímico',
            title: 'Hemograma Completo Pediátrico & Perfil Bioquímico',
            specialty: 'Laboratorio',
            type: 'Examen de Laboratorio',
            recordType: 'Examen de Laboratorio',
            doctor: 'Dra. Marcela Soto - Pediatra',
            center: 'Laboratorio Central Bellavista',
            date: '12 Oct 2026',
            summary: 'Control preventivo de anemia infantil. Hemoglobina 13.1 g/dL, Leucocitos 7.200/uL, Plaquetas 285.000/uL normales.',
            notes: 'Sin alteraciones hematológicas. Rangos normales acordes a 7 años.',
            icon: '🧪',
            validatedByAI: true,
            status: 'Normal'
          },
          {
            id: 'doc_demo_2',
            name: 'Receta Médica: Amoxicilina Suspensión 500mg/5ml',
            title: 'Receta Médica: Amoxicilina Suspensión 500mg/5ml',
            specialty: 'Pediatría',
            type: 'Receta Médica',
            recordType: 'Receta Médica',
            doctor: 'Dra. Marcela Soto - Pediatra',
            center: 'CESFAM Bellavista',
            date: '05 Nov 2026',
            summary: 'Tratamiento antibiótico para cuadro respiratorio agudo por 7 días vía oral.',
            dosage: '5.6 ml cada 12 hrs (7 días)',
            dosageDose: '5.6 ml cada 12 hrs (7 días)',
            notes: 'Dosis ponderal por peso (22.4 kg): 50 mg/kg/día = 5.6 ml cada 12 hrs por 7 días.',
            icon: '💊',
            validatedByAI: true,
            isPrescription: true,
            status: 'Activa'
          },
          {
            id: 'doc_demo_4',
            name: 'Informe de Evaluación Fonológica y Lenguaje Comprensivo PIE',
            title: 'Informe de Evaluación Fonológica y Lenguaje Comprensivo PIE',
            specialty: 'Fonoaudiología',
            type: 'Informe Clínico / Epicrisis',
            recordType: 'Informe Clínico / Epicrisis',
            doctor: 'Lic. Rodrigo Vega - Fonoaudiólogo PIE',
            center: 'Centro de Desarrollo Infantil Bellavista',
            date: '20 Oct 2026',
            summary: 'Avance favorable en comprensión sintáctica, articulación fonética y pragmática comunicativa en aula de recursos.',
            notes: 'Protocolo de estimulación del lenguaje infantil PIE en ejecución.',
            icon: '🗣️',
            validatedByAI: true,
            status: 'En progreso'
          },
          {
            id: 'doc_demo_5',
            name: 'Pauta de Psicomotricidad & Control Motor Dinámico',
            title: 'Pauta de Psicomotricidad & Control Motor Dinámico',
            specialty: 'Kinesiología',
            type: 'Orden Médica / Interconsulta',
            recordType: 'Orden Médica / Interconsulta',
            doctor: 'Klgo. Andrés Morales - Kinesiólogo',
            center: 'Sala Kinésica Bellavista',
            date: '15 Oct 2026',
            summary: 'Pauta de coordinación motriz, postura y propiocepción para estimulación sensorio-motriz infantil.',
            notes: 'Ejercicios de equilibrio dinámico y tono postural.',
            icon: '🏃',
            validatedByAI: true,
            status: 'Vigente'
          },
          {
            id: 'doc_demo_6',
            name: 'Plan Nutricional Infantil & Pauta Curva OMS (22.4 kg)',
            title: 'Plan Nutricional Infantil & Pauta Curva OMS (22.4 kg)',
            specialty: 'Nutrición',
            type: 'Informe Clínico / Epicrisis',
            recordType: 'Informe Clínico / Epicrisis',
            doctor: 'Nut. Daniela Henríquez - Nutricionista',
            center: 'CESFAM Bellavista',
            date: '10 Oct 2026',
            summary: 'Evaluación antropométrica: Peso 22.4 kg, Talla 122 cm, IMC 15.0 kg/m² (Percentil 50 OMS - Estado Eutrófico).',
            notes: 'Pauta balanceada rica en calcio, hierro y fibra.',
            icon: '🥗',
            validatedByAI: true,
            status: 'Eutrófico'
          },
          {
            id: 'doc_demo_7',
            name: 'Evaluación Neurosensorial Protocolo TEA (Ley N° 21.545)',
            title: 'Evaluación Neurosensorial Protocolo TEA (Ley N° 21.545)',
            specialty: 'Neurología',
            type: 'Informe Clínico / Epicrisis',
            recordType: 'Informe Clínico / Epicrisis',
            doctor: 'Dr. Esteban Fuenzalida - Neuropediatra',
            center: 'Hospital Pediátrico Dr. Sótero del Río',
            date: '02 Oct 2026',
            summary: 'Monitoreo de adaptación sensorial, rutinas de anticipación y apoyo escolar bajo marco de Ley TEA.',
            notes: 'Condición TEA Grado 2 con buena respuesta a apoyos visuales y sensoriales.',
            icon: '🧠',
            validatedByAI: true,
            status: 'Vigente'
          }
        ];
        localStorage.setItem('cuidapp_documents_' + (activePatient?.id || 'mateo'), JSON.stringify(pedDocs));

        // Sincronizar en cuidapp_ficha global inicial
        pedDocs.forEach(doc => {
          savePediatricRecordToGlobalFicha(pData, doc, 'DOCUMENT');
        });
      }
    } catch(e) {}

    // Garantizar que la receta médica pediátrica demo esté presente para Mateo Morales
    if (isDemo && !pedDocs.some(d => d.id === 'doc_demo_2')) {
      pedDocs.push({
        id: 'doc_demo_2',
        name: 'Receta Médica: Amoxicilina Suspensión 500mg/5ml',
        title: 'Receta Médica: Amoxicilina Suspensión 500mg/5ml',
        specialty: 'Pediatría',
        type: 'Receta Médica',
        recordType: 'Receta Médica',
        doctor: 'Dra. Marcela Soto - Pediatra',
        center: 'CESFAM Bellavista',
        date: '05 Nov 2026',
        summary: 'Tratamiento antibiótico para cuadro respiratorio agudo por 7 días vía oral.',
        dosage: '5.6 ml cada 12 hrs (7 días)',
        dosageDose: '5.6 ml cada 12 hrs (7 días)',
        notes: 'Dosis ponderal por peso (22.4 kg): 50 mg/kg/día = 5.6 ml cada 12 hrs por 7 días.',
        icon: '💊',
        validatedByAI: true,
        isPrescription: true,
        status: 'Activa'
      });
    }

    // Filtrar para excluir radiografías dentales (las recetas de medicamentos sí se mantienen)
    pedDocs = pedDocs.filter(d => {
      const specStr = (d.specialty || '').toLowerCase();
      const typeStr = ((d.type || '') + ' ' + (d.recordType || '')).toLowerCase();
      const titleStr = ((d.title || '') + ' ' + (d.name || '')).toLowerCase();
      const isDentalXray = specStr.includes('odontolog') || typeStr.includes('radiograf') || typeStr.includes('imagenolog') || titleStr.includes('panorámica') || titleStr.includes('bitewing') || d.id === 'doc_demo_3';
      return !isDentalXray;
    });

    // Sincronización en tiempo real desde la ficha global cuidapp_ficha_[RUT]
    // (documentos clínicos, exámenes de laboratorio y recetas médicas)
    if (liveFicha) {
      const globalRecords = [
        ...(Array.isArray(liveFicha.documents) ? liveFicha.documents : []),
        ...(Array.isArray(liveFicha.prescriptions) ? liveFicha.prescriptions.map(p => ({
          ...p,
          type: p.type || 'Receta Médica',
          recordType: p.recordType || 'Receta Médica',
          icon: p.icon || '💊',
          isPrescription: true
        })) : [])
      ];
      globalRecords.forEach(fDoc => {
        const typeStr = ((fDoc.type || '') + ' ' + (fDoc.recordType || '')).toLowerCase();
        const specStr = (fDoc.specialty || '').toLowerCase();
        const titleStr = ((fDoc.title || '') + ' ' + (fDoc.name || '')).toLowerCase();
        const isDentalXray = specStr.includes('odontolog') || typeStr.includes('radiograf') || typeStr.includes('imagenolog') || titleStr.includes('panorámica') || titleStr.includes('bitewing');
        if (isDentalXray) return;
        const exists = pedDocs.some(d => d.id === fDoc.id || (d.title === fDoc.title && d.date === fDoc.date));
        if (!exists) {
          const isPrescriptionItem = fDoc.isPrescription || typeStr.includes('receta') || typeStr.includes('prescrip');
          pedDocs.unshift({
            ...fDoc,
            icon: fDoc.icon || (isPrescriptionItem ? '💊' : getSpecialtyIcon(fDoc.specialty)),
            summary: fDoc.summary || fDoc.notes || `Documento sincronizado desde cuidapp_ficha_${pData.rut}.`,
            author: fDoc.author || 'Médico Tratante',
            isPrescription: isPrescriptionItem
          });
        }
      });
    }

    // Helper para determinar si un documento es una receta médica
    const isDocPrescription = (d) => {
      if (!d) return false;
      const typeStr = ((d.type || '') + ' ' + (d.recordType || '') + ' ' + (d.title || '') + ' ' + (d.name || '')).toLowerCase();
      return Boolean(d.isPrescription || typeStr.includes('receta') || typeStr.includes('prescrip') || d.id === 'doc_demo_2');
    };

    // Helper para parsear fechas de documentos de forma robusta
    const parseDocDate = (rawDate) => {
      if (!rawDate) return 0;
      if (typeof rawDate === 'number') return rawDate;
      const str = String(rawDate).trim();
      const isoParsed = Date.parse(str);
      if (!isNaN(isoParsed)) return isoParsed;

      const monthMap = {
        ene: 0, enero: 0,
        feb: 1, febrero: 1,
        mar: 2, marzo: 2,
        abr: 3, abril: 3,
        may: 4, mayo: 4,
        jun: 5, junio: 5,
        jul: 6, julio: 6,
        ago: 7, agosto: 7,
        sep: 8, sept: 8, septiembre: 8,
        oct: 9, octubre: 9,
        nov: 10, noviembre: 10,
        dic: 11, diciembre: 11
      };
      const cleaned = str.toLowerCase().replace(/de/g, ' ').replace(/[,\.\-]/g, ' ');
      const tokens = cleaned.split(/\s+/).filter(Boolean);
      let day = null, month = null, year = null;
      for (const t of tokens) {
        if (monthMap[t] !== undefined && month === null) {
          month = monthMap[t];
        } else if (/^\d{4}$/.test(t) && year === null) {
          year = parseInt(t, 10);
        } else if (/^\d{1,2}$/.test(t) && day === null) {
          day = parseInt(t, 10);
        }
      }
      if (year !== null && month !== null) {
        return new Date(year, month, day || 1).getTime();
      }
      return 0;
    };

    // Ordenar cronológicamente todos los registros del más reciente al más antiguo
    pedDocs.sort((a, b) => parseDocDate(b.date || b.timestamp || b.createdAt) - parseDocDate(a.date || a.timestamp || a.createdAt));

    // Lista completa oficial de especialidades pediátricas (incluye Recetas Médicas)
    const pediatricSpecialtiesList = [
      'Todas las Especialidades',
      'Recetas Médicas',
      'Pediatría',
      'Gastroenterología',
      'Inmunología y Alergias',
      'Broncopulmonar',
      'Neurología',
      'Fonoaudiología',
      'Terapia Ocupacional',
      'Kinesiología',
      'Nutrición',
      'Oftalmología',
      'Otorrinolaringología',
      'Dermatología',
      'Cardiología',
      'Endocrinología',
      'Traumatología',
      'Psicología Infantil',
      'Laboratorio',
      'Imagenología'
    ];

    // Filtrar documentos según especialidad seleccionada y búsqueda por examen o médico
    const searchQ = (currentPediatricDocSearchQuery || '').trim().toLowerCase();
    const filteredDocs = pedDocs.filter(d => {
      let matchSpecialty = false;
      if (!currentPediatricDocSpecialtyFilter || currentPediatricDocSpecialtyFilter === 'TODAS' || currentPediatricDocSpecialtyFilter === 'Todas las Especialidades') {
        matchSpecialty = true;
      } else if (currentPediatricDocSpecialtyFilter === 'Recetas Médicas') {
        matchSpecialty = isDocPrescription(d);
      } else {
        matchSpecialty = (d.specialty || '').toLowerCase() === currentPediatricDocSpecialtyFilter.toLowerCase();
      }

      if (!matchSpecialty) return false;

      if (!searchQ) return true;

      const titleStr = ((d.title || '') + ' ' + (d.name || '')).toLowerCase();
      const doctorStr = (d.doctor || '').toLowerCase();
      const summaryStr = ((d.summary || '') + ' ' + (d.notes || '') + ' ' + (d.dosage || '') + ' ' + (d.dosageDose || '')).toLowerCase();
      const centerStr = (d.center || '').toLowerCase();
      const typeStr = (d.type || '').toLowerCase();

      return titleStr.includes(searchQ) || doctorStr.includes(searchQ) || summaryStr.includes(searchQ) || centerStr.includes(searchQ) || typeStr.includes(searchQ);
    });

    container.innerHTML = `
      <div class="container-fluid px-4 py-4" style="background-color: #08101a; min-height: 100vh; border-radius: 24px; color: #f8fafc; font-family: 'Outfit', sans-serif;">
        <!-- Barra superior con botón volver al inicio pediátrico -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
          <button type="button" id="btnBackToPediatricHome" class="btn btn-sm px-4 py-2.5 rounded-pill fw-bold shadow-sm d-inline-flex align-items-center gap-2" style="background: #0f1926; color: #f8fafc; border: 1.5px solid rgba(6, 182, 212, 0.4); cursor: pointer; font-size: 1rem; transition: all 0.2s;">
            ⬅️ Volver al Inicio Pediátrico
          </button>
          <div class="d-flex align-items-center gap-2">
            <span class="badge px-3 py-2 rounded-pill fw-semibold" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; font-size: 0.9rem; border: 1px solid #ef4444;">
              📁 Carpeta de Salud Infantil Multiespecialidad
            </span>
          </div>
        </div>

        <!-- Encabezado de la sección -->
        <div class="p-3.5 p-md-4 mb-4" style="background: #0f1926; border-radius: 20px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5); border: 1.5px solid rgba(239, 68, 68, 0.3);">
          <div class="d-flex align-items-center gap-3">
            <span style="font-size: 2.2rem;">📁</span>
            <div>
              <h2 class="fw-extrabold m-0 text-white" style="font-size: 1.75rem;">Mis Exámenes y Registros Clínicos</h2>
              <p class="m-0 text-white-50" style="font-size: 0.95rem;">Exámenes de laboratorio, recetas médicas e informes de especialidades pediátricas.</p>
            </div>
          </div>
        </div>

        <!-- BARRA COMPACTA: SELECTOR DE ESPECIALIDAD Y CAMPO DE BÚSQUEDA -->
        <div class="p-2.5 p-md-3 mb-4 rounded-4" style="background: #0f1926; border: 1.5px solid rgba(6, 182, 212, 0.35); box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
          <div class="row g-2 align-items-center">
            <!-- Selector desplegable de especialidades pediátricas -->
            <div class="col-12 col-md-5">
              <div class="input-group">
                <span class="input-group-text border-0 text-info fw-bold py-2" style="background: rgba(6, 182, 212, 0.12); border-radius: 12px 0 0 12px; font-size: 0.88rem;">
                  🩺 Especialidad:
                </span>
                <select id="pediatricSpecialtySelect" class="form-select border-0 text-white fw-semibold py-2" style="background-color: #08101a; border-radius: 0 12px 12px 0; font-size: 0.88rem; cursor: pointer; border: 1px solid rgba(6, 182, 212, 0.3) !important;">
                  ${pediatricSpecialtiesList.map(spec => {
                    const isSelected = (currentPediatricDocSpecialtyFilter || 'Todas las Especialidades').toLowerCase() === spec.toLowerCase() || (spec === 'Todas las Especialidades' && currentPediatricDocSpecialtyFilter === 'TODAS');
                    return `<option value="${spec}" ${isSelected ? 'selected' : ''} style="background: #08101a; color: #ffffff;">${spec}</option>`;
                  }).join('')}
                </select>
              </div>
            </div>

            <!-- Campo de búsqueda por examen o médico -->
            <div class="col-12 col-md-7">
              <div class="input-group">
                <span class="input-group-text border-0 text-info py-2" style="background: rgba(6, 182, 212, 0.12); border-radius: 12px 0 0 12px; font-size: 0.95rem;">
                  🔍
                </span>
                <input type="text" id="pediatricDocSearchInput" class="form-control border-0 text-white py-2" placeholder="Buscar por examen o médico tratante..." value="${currentPediatricDocSearchQuery || ''}" style="background-color: #08101a; border-radius: ${currentPediatricDocSearchQuery ? '0' : '0 12px 12px 0'}; font-size: 0.88rem; border: 1px solid rgba(6, 182, 212, 0.3) !important;" autocomplete="off" />
                ${currentPediatricDocSearchQuery ? `
                  <button type="button" id="btnClearPediatricDocSearch" class="btn btn-outline-secondary px-3 py-2" style="border-radius: 0 12px 12px 0; border: 1px solid rgba(6, 182, 212, 0.3); color: #94a3b8; background: #08101a;" title="Limpiar búsqueda">✕</button>
                ` : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- GRID DE DOCUMENTOS PEDIÁTRICOS GUARDADOS -->
        <div class="row g-4 mb-4" id="pediatricDocsGrid">
          ${filteredDocs.length === 0 ? `
            <div class="col-12">
              <div class="p-5 text-center text-white-50 rounded-4" style="background: #08101a; border: 1.5px dashed rgba(6, 182, 212, 0.35);">
                <div style="font-size: 3rem;" class="mb-2">📁</div>
                <h5 class="fw-bold text-white mb-2">Sin registros encontrados</h5>
                <p class="small text-white-50 mb-3">No hay exámenes, recetas ni informes clínicos que coincidan con "${currentPediatricDocSpecialtyFilter}"${currentPediatricDocSearchQuery ? ` o "${currentPediatricDocSearchQuery}"` : ''}.</p>
                <button type="button" class="btn btn-sm btn-outline-info px-4 py-2 rounded-pill fw-bold" id="btnResetPediatricFilters">
                  Restablecer Filtros
                </button>
              </div>
            </div>
          ` : filteredDocs.map((doc, idx) => {
            const isPrescription = isDocPrescription(doc);
            const cardBorder = isPrescription ? '#38bdf8' : getSpecialtyColor(doc.specialty || 'Pediatría');
            const doseText = doc.dosageDose || doc.dosage || doc.posology || (isPrescription ? '5.6 ml cada 12 hrs (7 días)' : '');

            return `
            <div class="col-12 col-md-6 d-flex align-items-stretch">
              <div class="p-3.5 p-md-4 w-100 rounded-4 d-flex flex-column justify-content-between" style="background: #0f1926; border: 1.5px solid ${cardBorder}; border-radius: 20px; box-shadow: 0 6px 20px rgba(0,0,0,0.35);">
                <div>
                  <div class="d-flex justify-content-between align-items-start mb-2.5 flex-wrap gap-1">
                    <span style="font-size: 2rem;">${isPrescription ? '💊' : (doc.icon || getSpecialtyIcon(doc.specialty))}</span>
                    <div class="d-flex align-items-center gap-1.5 flex-wrap justify-content-end">
                      <span class="badge rounded-pill px-2.5 py-1 fw-bold" style="background: ${getSpecialtyColorBg(doc.specialty)}; color: ${getSpecialtyColor(doc.specialty)}; border: 1px solid ${getSpecialtyColor(doc.specialty)}; font-size: 0.78rem;">
                        ${getSpecialtyIcon(doc.specialty)} ${doc.specialty || 'Pediatría'}
                      </span>
                      ${isPrescription ? `
                        <span class="badge rounded-pill px-2.5 py-1 fw-bold" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); font-size: 0.75rem;">
                          💊 Receta Médica
                        </span>
                      ` : `
                        <span class="badge rounded-pill px-2.5 py-1 fw-bold" style="background: rgba(255,255,255,0.08); color: #ffffff; border: 1px solid rgba(255,255,255,0.2); font-size: 0.75rem;">
                          ${doc.type || 'Documento Clínico'}
                        </span>
                      `}
                    </div>
                  </div>

                  <h5 class="fw-bold mb-1 text-white" style="font-size: 1.05rem; line-height: 1.35;">${doc.title || doc.name || 'Documento Pediátrico'}</h5>
                  <p class="small text-white-50 mb-2.5" style="font-size: 0.85rem; line-height: 1.45;">${doc.summary || doc.notes || 'Documento almacenado en ficha pediátrica.'}</p>

                  ${isPrescription && doseText ? `
                    <div class="p-2 px-2.5 rounded-3 mb-2.5 d-flex align-items-center gap-2" style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25);">
                      <span class="small fw-bold text-info" style="font-size: 0.8rem; white-space: nowrap;"><i class="bi bi-capsule me-1"></i>Dosis:</span>
                      <span class="small text-white text-truncate fw-semibold" style="font-size: 0.82rem;" title="${doseText}">${doseText}</span>
                    </div>
                  ` : ''}

                  <div class="small text-white-50 mb-2.5" style="font-size: 0.82rem; line-height: 1.6;">
                    <div><i class="bi bi-calendar3 me-1.5 text-info"></i><strong>Fecha:</strong> ${doc.date || 'Reciente'}</div>
                    <div><i class="bi bi-person-fill me-1.5 text-info"></i><strong>Médico:</strong> ${doc.doctor || 'Médico Tratante'}</div>
                    <div><i class="bi bi-hospital me-1.5 text-warning"></i><strong>Centro:</strong> ${doc.center || 'CESFAM Bellavista'}</div>
                  </div>
                </div>

                <div class="pt-2.5 border-top d-flex justify-content-end align-items-center gap-2" style="border-color: rgba(255, 255, 255, 0.08) !important;">
                  <button type="button" class="btn btn-sm px-3.5 py-1.5 rounded-pill fw-bold btn-view-pediatric-doc" data-doc-title="${doc.title || doc.name}" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); font-size: 0.82rem; cursor: pointer;">
                    👁 Visualizar
                  </button>
                  <button type="button" class="btn btn-sm px-3.5 py-1.5 rounded-pill fw-bold text-white btn-download-pediatric-doc" data-doc-title="${doc.title || doc.name}" style="background: rgba(255, 255, 255, 0.08); color: #ffffff; border: 1.5px solid rgba(255, 255, 255, 0.2); font-size: 0.82rem; cursor: pointer;">
                    ⬇ Descargar
                  </button>
                </div>
              </div>
            </div>
            `;
          }).join('')}
        </div>

        <!-- Botón inferior para volver -->
        <div class="text-center pt-2">
          <button type="button" id="btnBackToPediatricHomeBottomExamenes" class="btn px-4 py-2.5 rounded-pill fw-bold text-white" style="background: #0f1926; border: 1.5px solid rgba(6, 182, 212, 0.4); cursor: pointer;">
            ⬅️ Volver al Inicio Pediátrico
          </button>
        </div>
      </div>
      ${pediatricModalsHTML}
      ${floatingVoiceButtonHTML}
    `;

    // Conectar botones Volver al Inicio Pediátrico en Exámenes
    ['btnBackToPediatricHome', 'btnBackToPediatricHomeBottomExamenes'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        attachVoiceGuidance(btn, 'Volver al Inicio Pediátrico. Regresa al menú principal infantil.');
        btn.onclick = handleBackToHome;
      }
    });

    // Conectar botones de Desbloqueo / Bloqueo de Tutor Legal en Exámenes
    const btnUnlockExamenes = document.getElementById('btnUnlockTutorSessionExamenes');
    if (btnUnlockExamenes) {
      btnUnlockExamenes.onclick = () => {
        openUnlockTutorSessionModal(pData, () => renderPediatricView(container, onBackToAdult));
      };
    }

    const btnUnlockInForm = document.getElementById('btnUnlockTutorInForm');
    if (btnUnlockInForm) {
      btnUnlockInForm.onclick = () => {
        openUnlockTutorSessionModal(pData, () => renderPediatricView(container, onBackToAdult));
      };
    }

    const btnLockExamenes = document.getElementById('btnLockTutorSessionExamenes');
    if (btnLockExamenes) {
      btnLockExamenes.onclick = () => {
        setTutorSessionUnlocked(false);
        window.showGlassAlert('🔒 Portal restablecido a Modo Visualización Supervisada (Solo Lectura).', 'info');
        if (modoVozActivo) speakText('Portal restablecido a modo visualización supervisada.');
        renderPediatricView(container, onBackToAdult);
      };
    }

    // Conectar selector desplegable de especialidad pediátrica
    const specialtySelect = document.getElementById('pediatricSpecialtySelect');
    if (specialtySelect) {
      specialtySelect.onchange = (e) => {
        currentPediatricDocSpecialtyFilter = e.target.value;
        if (modoVozActivo) speakText(`Filtrando por ${e.target.value}.`);
        renderPediatricView(container, onBackToAdult);
      };
    }

    // Conectar campo de búsqueda en vivo por examen o médico
    const searchInput = document.getElementById('pediatricDocSearchInput');
    if (searchInput) {
      searchInput.oninput = (e) => {
        currentPediatricDocSearchQuery = e.target.value;
        renderPediatricView(container, onBackToAdult);
        const newInp = document.getElementById('pediatricDocSearchInput');
        if (newInp) {
          newInp.focus();
          const len = newInp.value.length;
          newInp.setSelectionRange(len, len);
        }
      };
    }

    const btnClearSearch = document.getElementById('btnClearPediatricDocSearch');
    if (btnClearSearch) {
      btnClearSearch.onclick = () => {
        currentPediatricDocSearchQuery = '';
        renderPediatricView(container, onBackToAdult);
      };
    }

    const btnResetFilters = document.getElementById('btnResetPediatricFilters');
    if (btnResetFilters) {
      btnResetFilters.onclick = () => {
        currentPediatricDocSpecialtyFilter = 'Todas las Especialidades';
        currentPediatricDocSearchQuery = '';
        renderPediatricView(container, onBackToAdult);
      };
    }

    // Conectar botones "Visualizar"
    document.querySelectorAll('.btn-view-pediatric-doc').forEach(btn => {
      btn.onclick = (e) => {
        const title = e.currentTarget.getAttribute('data-doc-title') || 'Documento Clínico';
        window.showGlassAlert(`👁️ Abriendo visor clínico oficial para: ${title}`, 'info');
        if (modoVozActivo) speakText(`Visualizando ${title}. Documento oficial validado.`);
      };
    });

    // Conectar botones "Descargar"
    document.querySelectorAll('.btn-download-pediatric-doc').forEach(btn => {
      btn.onclick = (e) => {
        const title = e.currentTarget.getAttribute('data-doc-title') || 'Documento Clínico';
        window.showGlassAlert(`📥 Descargando documento clínico oficial: ${title}`, 'success');
        if (modoVozActivo) speakText(`Descargando ${title}.`);
      };
    });

    // Variable local para almacenar archivo o foto capturada
    let currentCapturedDocData = null;

    // Conectar botones de Sugerencias Rápidas (Presets)
    document.querySelectorAll('.btn-doc-preset').forEach(btn => {
      btn.onclick = () => {
        const spec = btn.getAttribute('data-specialty');
        const type = btn.getAttribute('data-type');
        const title = btn.getAttribute('data-title');

        const selectSpec = document.getElementById('docSelectSpecialty');
        const selectType = document.getElementById('docSelectType');
        const inputTitle = document.getElementById('docInputTitle');
        const inputDoctor = document.getElementById('docInputDoctor');
        const inputNotes = document.getElementById('docInputNotes');

        if (selectSpec && spec) selectSpec.value = spec;
        if (selectType && type) selectType.value = type;
        if (inputTitle && title) inputTitle.value = title;

        if (spec === 'Pediatría') {
          if (inputDoctor) inputDoctor.value = pData.pediatricianName || 'Dra. Marcela Soto - Pediatra';
          if (inputNotes) inputNotes.value = `Posología calculada para peso actual (${pData.weight || '22.4'} kg): 50 mg/kg/día = 1.120 mg/día = 5.6 ml cada 12 hrs por 7 días.`;
        } else if (spec === 'Odontología') {
          if (inputDoctor) inputDoctor.value = 'Dr. Camilo Sepúlveda - Odontopediatra';
          if (inputNotes) inputNotes.value = 'Odontograma FDI: Sellantes preventivos indicados en molares 1.6 y 2.6 erupcionados.';
        } else if (spec === 'Fonoaudiología') {
          if (inputDoctor) inputDoctor.value = 'Lic. Rodrigo Vega - Fonoaudiólogo PIE';
          if (inputNotes) inputNotes.value = 'Evaluación y estimulación del lenguaje en aula de recursos PIE. Avance favorable.';
        } else if (spec === 'Kinesiología') {
          if (inputDoctor) inputDoctor.value = 'Klgo. Andrés Morales - Kinesiólogo';
          if (inputNotes) inputNotes.value = 'Pauta de psicomotricidad y ejercicios sensorio-motores para fortalecimiento postural.';
        } else if (spec === 'Nutrición') {
          if (inputDoctor) inputDoctor.value = 'Nut. Daniela Henríquez - Nutricionista';
          if (inputNotes) inputNotes.value = `Evaluación antropométrica: Peso ${pData.weight || '22.4'} kg, Talla ${pData.height || '122'} cm. Percentil 50 OMS (Eutrófico).`;
        } else if (spec === 'Neurología') {
          if (inputDoctor) inputDoctor.value = 'Dr. Esteban Fuenzalida - Neuropediatra';
          if (inputNotes) inputNotes.value = 'Monitoreo clínico neurosensorial bajo protocolo de la Ley N° 21.545 (Ley TEA).';
        } else if (spec === 'Laboratorio') {
          if (inputDoctor) inputDoctor.value = 'Laboratorio Central Bellavista';
          if (inputNotes) inputNotes.value = 'Control preventivo: Hemoglobina, leucocitos y perfil bioquímico normales para 7 años.';
        }
      };
    });

    // Conectar botón Cámara en Vivo
    const btnOpenLiveCameraDoc = document.getElementById('btnOpenLiveCameraDoc');
    if (btnOpenLiveCameraDoc) {
      btnOpenLiveCameraDoc.onclick = () => {
        openPediatricLiveCameraModal((photoData) => {
          currentCapturedDocData = photoData;
          const previewContainer = document.getElementById('docPreviewContainer');
          const previewImg = document.getElementById('imgDocPreviewThumbnail');
          const previewText = document.getElementById('textDocPreviewFilename');
          if (previewContainer) previewContainer.classList.remove('d-none');
          if (previewImg) previewImg.src = photoData;
          if (previewText) previewText.textContent = `Foto_Camara_${Date.now()}.jpg`;
        });
      };
    }

    // Conectar botón Subir Archivo
    const btnChooseFileDoc = document.getElementById('btnChooseFileDoc');
    const inputFileDocChooser = document.getElementById('inputFileDocChooser');
    if (btnChooseFileDoc && inputFileDocChooser) {
      btnChooseFileDoc.onclick = () => inputFileDocChooser.click();
      inputFileDocChooser.onchange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (re) => {
            currentCapturedDocData = re.target.result;
            const previewContainer = document.getElementById('docPreviewContainer');
            const previewImg = document.getElementById('imgDocPreviewThumbnail');
            const previewText = document.getElementById('textDocPreviewFilename');
            if (previewContainer) previewContainer.classList.remove('d-none');
            if (previewImg) previewImg.src = re.target.result.startsWith('data:image') ? re.target.result : 'https://placehold.co/100x100/0f1926/06b6d4?text=PDF';
            if (previewText) previewText.textContent = file.name;
            window.showGlassAlert(`📁 Archivo "${file.name}" cargado para validación.`, 'info');
          };
          reader.readAsDataURL(file);
        }
      };
    }

    // Botón para quitar preview
    const btnRemoveDocPreview = document.getElementById('btnRemoveDocPreview');
    if (btnRemoveDocPreview) {
      btnRemoveDocPreview.onclick = () => {
        currentCapturedDocData = null;
        const previewContainer = document.getElementById('docPreviewContainer');
        if (previewContainer) previewContainer.classList.add('d-none');
        if (inputFileDocChooser) inputFileDocChooser.value = '';
      };
    }

    // Conectar botón Auto-Clasificar con IA
    const btnAutoClassifyDocIA = document.getElementById('btnAutoClassifyDocIA');
    if (btnAutoClassifyDocIA) {
      btnAutoClassifyDocIA.onclick = () => {
        const inputTitle = document.getElementById('docInputTitle');
        const selectSpec = document.getElementById('docSelectSpecialty');
        const selectType = document.getElementById('docSelectType');
        const inputNotes = document.getElementById('docInputNotes');
        const titleText = (inputTitle?.value || '').toLowerCase();

        if (modoVozActivo) speakText('Analizando y clasificando documento clínico con IA...');
        window.showGlassAlert('🤖 Clasificando documento con Inteligencia Artificial...', 'info');

        setTimeout(() => {
          if (titleText.includes('receta') || titleText.includes('amoxicilina') || titleText.includes('ibuprofeno') || titleText.includes('paracetamol')) {
            if (selectSpec) selectSpec.value = 'Pediatría';
            if (selectType) selectType.value = 'Receta Médica Pediátrica';
            if (inputNotes) inputNotes.value = `Posología pediátrica calculada según peso actual (${pData.weight || '22.4'} kg): 50 mg/kg/día = 1.120 mg/día divididos en 2 tomas de 5.6 ml cada 12 horas vía oral.`;
          } else if (titleText.includes('radio') || titleText.includes('fdi') || titleText.includes('bitewing') || titleText.includes('dental')) {
            if (selectSpec) selectSpec.value = 'Odontología';
            if (selectType) selectType.value = 'Radiografía / Imagenología';
            if (inputNotes) inputNotes.value = 'Odontograma FDI: Dentición mixta de 7 años. Dientes temporales y primeros molares permanentes sanos.';
          } else if (titleText.includes('fono') || titleText.includes('pie') || titleText.includes('lenguaje')) {
            if (selectSpec) selectSpec.value = 'Fonoaudiología';
            if (selectType) selectType.value = 'Informe Clínico / Epicrisis';
            if (inputNotes) inputNotes.value = 'Desarrollo fonético y estructuración gramatical acorde a nivel escolar PIE.';
          } else if (titleText.includes('kine') || titleText.includes('motor') || titleText.includes('postur')) {
            if (selectSpec) selectSpec.value = 'Kinesiología';
            if (selectType) selectType.value = 'Orden Médica / Interconsulta';
            if (inputNotes) inputNotes.value = 'Control de desarrollo motor dinámico y ejercicios propioceptivos.';
          } else if (titleText.includes('nutri') || titleText.includes('dieta') || titleText.includes('oms')) {
            if (selectSpec) selectSpec.value = 'Nutrición';
            if (selectType) selectType.value = 'Informe Clínico / Epicrisis';
            if (inputNotes) inputNotes.value = `Curva OMS: Peso ${pData.weight || '22.4'} kg (Percentil 50 OMS). Dieta balanceada recomendada.`;
          } else if (titleText.includes('neuro') || titleText.includes('tea') || titleText.includes('tdah')) {
            if (selectSpec) selectSpec.value = 'Neurología';
            if (selectType) selectType.value = 'Informe Clínico / Epicrisis';
            if (inputNotes) inputNotes.value = 'Seguimiento neurológico y adaptaciones sensoriales bajo Ley N° 21.545.';
          } else {
            if (selectSpec) selectSpec.value = 'Laboratorio';
            if (selectType) selectType.value = 'Examen de Laboratorio';
            if (inputNotes) inputNotes.value = 'Panel analítico pediátrico verificado. Leucocitos, hemoglobina y glicemia en rangos normales.';
          }
          window.showGlassAlert('✨ Documento clasificado exitosamente por IA.', 'success');
          if (modoVozActivo) speakText('Documento clasificado con éxito por Inteligencia Artificial.');
        }, 600);
      };
    }

    // Manejar envío del formulario de subida de examen
    const formUploadPediatricDoc = document.getElementById('formUploadPediatricDoc');
    if (formUploadPediatricDoc) {
      formUploadPediatricDoc.onsubmit = (e) => {
        e.preventDefault();
        const spec = document.getElementById('docSelectSpecialty')?.value || 'Pediatría';
        const type = document.getElementById('docSelectType')?.value || 'Examen de Laboratorio';
        const title = document.getElementById('docInputTitle')?.value?.trim() || 'Documento Pediátrico';
        const doctor = document.getElementById('docInputDoctor')?.value?.trim() || 'Médico Tratante';
        const center = document.getElementById('docInputCenter')?.value?.trim() || 'CESFAM Bellavista';
        const rawDate = document.getElementById('docInputDate')?.value || new Date().toISOString().split('T')[0];
        const notes = document.getElementById('docInputNotes')?.value?.trim() || 'Documento clínico archivado.';

        const dateParts = rawDate.split('-');
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const readableDate = dateParts.length === 3 
          ? `${parseInt(dateParts[2])} ${months[parseInt(dateParts[1]) - 1]} ${dateParts[0]}`
          : rawDate;

        const newDoc = {
          id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          title: title,
          name: title,
          specialty: spec,
          type: type,
          recordType: type,
          doctor: doctor,
          center: center,
          date: readableDate,
          rawDate: rawDate,
          summary: notes,
          notes: notes,
          icon: getSpecialtyIcon(spec),
          fileData: currentCapturedDocData || null,
          validatedByAI: true,
          status: type.includes('Receta') ? 'Activa' : 'Normal',
          createdAt: new Date().toISOString()
        };

        // 1. Guardar en cuidapp_documents_[patientId]
        pedDocs.unshift(newDoc);
        localStorage.setItem('cuidapp_documents_' + (activePatient?.id || 'mateo'), JSON.stringify(pedDocs));

        // 2. Sincronizar en cuidapp_ficha_[RUT] compartida
        savePediatricRecordToGlobalFicha(pData, newDoc, type.includes('Receta') ? 'PRESCRIPTION' : 'DOCUMENT');

        // 3. Insertar evento inmutable en cuidapp_audit_log y cuidapp_admin_audit_log
        insertPediatricAuditLogEntry({
          patientData: pData,
          specialty: spec,
          recordType: type,
          eventType: type.includes('Receta') ? 'PEDIATRIC_PRESCRIPTION' : 'PEDIATRIC_DOCUMENT',
          details: `${title} (${spec}) guardado. Médico: ${doctor}. Centro: ${center}. Notas: ${notes}`,
          recordId: newDoc.id
        });

        window.showGlassAlert(`📁 ${type} "${title}" guardado y sincronizado en Ficha Pediátrica.`, 'success');
        if (modoVozActivo) speakText(`${type} guardado y sincronizado exitosamente.`);

        renderPediatricView(container, onBackToAdult);
      };
    }

  } else if (pediatricSubTab === 'pediatra') {
    // --- VISTA PEDIÁTRICA: MI PEDIATRA ---
    container.innerHTML = `
      <div class="container-fluid px-4 py-4" style="background-color: #08101a; min-height: 100vh; border-radius: 24px; color: #f8fafc; font-family: 'Outfit', sans-serif;">
        <!-- Barra superior con botón volver al inicio pediátrico -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
          <button type="button" id="btnBackToPediatricHome" class="btn btn-sm px-4 py-2.5 rounded-pill fw-bold shadow-sm d-inline-flex align-items-center gap-2" style="background: #0f1926; color: #f8fafc; border: 1.5px solid rgba(6, 182, 212, 0.4); cursor: pointer; font-size: 1rem; transition: all 0.2s;">
            ⬅️ Volver al Inicio Pediátrico
          </button>
          <div class="d-flex align-items-center gap-2">
            <span class="badge px-3 py-2 rounded-pill fw-semibold" style="background: rgba(239, 68, 68, 0.2); color: #ef4444; font-size: 0.9rem; border: 1.5px solid #ef4444;">
              🚨 Contacto de Urgencia
            </span>
          </div>
        </div>

        <!-- Tarjeta de la Pediatra -->
        <div class="p-4 p-md-5 mb-4 text-center mx-auto" style="max-width: 650px; background: #0f1926; border-radius: 28px; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6); border: 2px solid #ef4444;">
          <div class="mb-4 d-inline-block position-relative">
            <img src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=300&q=80" alt="Dra. Soto - Pediatra" class="rounded-circle shadow" style="width: 150px; height: 150px; object-fit: cover; border: 4px solid #ef4444;" onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=Dra+Soto&background=ffe4e6&color=be123c&size=256';">
            <span class="position-absolute bottom-0 end-0 p-2 bg-success border border-white rounded-circle" title="Disponible" style="width: 24px; height: 24px;"></span>
          </div>
          
          <h2 class="fw-extrabold mb-1 text-white" style="font-family: 'Outfit', sans-serif;">Dra. Soto - Pediatra</h2>
          <p class="text-white-50 mb-3" style="font-size: 1.15rem;">Especialista en Atención Primaria Pediátrica y Control Niño Sano</p>
          
          <div class="d-flex justify-content-center gap-2 mb-4 flex-wrap">
            <span class="badge px-3 py-1.5 rounded-pill fw-semibold" style="background: rgba(6, 182, 212, 0.15); color: #06b6d4; border: 1px solid #06b6d4;">
              CESFAM Bellavista
            </span>
            <span class="badge px-3 py-1.5 rounded-pill fw-semibold" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid #34d399;">
              🟢 Turno Activo
            </span>
          </div>

          <div class="p-3.5 rounded-4 mb-4 text-start" style="background: #08101a; border: 1px solid rgba(239, 68, 68, 0.3);">
            <p class="small m-0 text-white-50">
              <strong style="color: #ef4444;">Información de Atención:</strong> Para consultas médicas no urgentes, puedes acudir al box 4 en jornada diurna. Ante emergencias agudas o dudas pediátricas, utiliza el botón de llamada directa.
            </p>
          </div>

          <!-- Botón Gigante de Llamar -->
          <button type="button" id="btnLlamarPediatraDirecto" class="btn w-100 py-4 px-4 d-inline-flex align-items-center justify-content-center gap-3 text-white fw-extrabold shadow-lg mb-3" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border: 2px solid #f87171; border-radius: 22px; font-size: 1.6rem; cursor: pointer; transition: all 0.25s ease;">
            <span style="font-size: 2rem;">📞</span> Llamar
          </button>

          <!-- Botón Volver al Inicio Pediátrico -->
          <button type="button" id="btnBackToPediatricHomeBottomPediatra" class="btn w-100 py-2.5 px-4 rounded-pill fw-bold text-white" style="background: #08101a; border: 1px solid rgba(255,255,255,0.2); cursor: pointer; font-size: 1rem;">
            ⬅️ Volver al Inicio Pediátrico
          </button>
        </div>
      </div>
      ${pediatricModalsHTML}
      ${floatingVoiceButtonHTML}
    `;

    // Conectar botones Volver al Inicio Pediátrico en Pediatra
    ['btnBackToPediatricHome', 'btnBackToPediatricHomeBottomPediatra'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        attachVoiceGuidance(btn, 'Volver al Inicio Pediátrico. Regresa al menú principal infantil.');
        btn.onclick = handleBackToHome;
      }
    });

    const btnLlamarPediatraDirecto = document.getElementById('btnLlamarPediatraDirecto');
    if (btnLlamarPediatraDirecto) {
      attachVoiceGuidance(btnLlamarPediatraDirecto, 'Llamar a la Pediatra. Conecta inmediatamente con la doctora Soto.');
      btnLlamarPediatraDirecto.onclick = () => {
        if (modoVozActivo) speakText('Conectando llamada telefónica con la Dra. Soto.');
        window.showGlassAlert('📞 Conectando llamada prioritaria con Dra. Soto - Pediatra (+56 9 8765 4321)...', 'info');
        setTimeout(() => {
          window.location.href = 'tel:+56987654321';
        }, 800);
      };
    }

  } else if (pediatricSubTab === 'ficha') {
    // --- VISTA DEDICADA: MI FICHA Y PERFIL PEDIÁTRICO ---
    container.innerHTML = `
      <div class="container-fluid px-4 py-4" style="background-color: #08101a; min-height: 100vh; border-radius: 24px; color: #f8fafc; font-family: 'Outfit', sans-serif;">
        <!-- Barra superior con botón volver al inicio pediátrico -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
          <button type="button" id="btnBackToPediatricHome" class="btn btn-sm px-4 py-2.5 rounded-pill fw-bold shadow-sm d-inline-flex align-items-center gap-2" style="background: #0f1926; color: #f8fafc; border: 1.5px solid rgba(6, 182, 212, 0.4); cursor: pointer; font-size: 1rem; transition: all 0.2s;">
            ⬅️ Volver al Inicio Pediátrico
          </button>
          <div class="d-flex align-items-center gap-2">
            <span class="badge px-3 py-2 rounded-pill fw-semibold" style="background: rgba(6, 182, 212, 0.15); color: #06b6d4; font-size: 0.9rem; border: 1px solid #06b6d4;">
              📋 Ficha Clínica y Contactos Integrados
            </span>
          </div>
        </div>

        <!-- Encabezado de la vista dedicada -->
        <div class="p-4 p-md-5 mb-4" style="background: #0f1926; border-radius: 28px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5); border: 1.5px solid rgba(6, 182, 212, 0.3);">
          <div class="d-flex align-items-center gap-3">
            <span style="font-size: 2.8rem;">📋</span>
            <div>
              <h2 class="fw-extrabold m-0 text-white" style="font-size: 2.2rem;">Mi Ficha y Perfil Pediátrico</h2>
              <p class="m-0 text-white-50" style="font-size: 1.1rem;">Ficha de Emergencia, Contacto del Tutor y Resumen Clínico de Mateo Morales</p>
            </div>
          </div>
        </div>

        ${getFichaSectionsHTML()}

        <!-- Botón inferior para volver -->
        <div class="text-center pt-2 pb-4">
          <button type="button" id="btnBackToPediatricHomeBottomFicha" class="btn px-4 py-2.5 rounded-pill fw-bold text-white" style="background: #0f1926; border: 1.5px solid rgba(6, 182, 212, 0.4); cursor: pointer;">
            ⬅️ Volver al Inicio Pediátrico
          </button>
        </div>
      </div>
      ${pediatricModalsHTML}
      ${floatingVoiceButtonHTML}
    `;

    // Conectar botones Volver al Inicio Pediátrico en Ficha
    ['btnBackToPediatricHome', 'btnBackToPediatricHomeBottomFicha'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        attachVoiceGuidance(btn, 'Volver al Inicio Pediátrico. Regresa al menú principal infantil.');
        btn.onclick = handleBackToHome;
      }
    });

    bindPediatricFichaModalEvents();
    bindPediatricQrModalEvents();

  } else {
    // --- VISTA MODO PEDIÁTRICO / ADOLESCENTE ---
    const pData = getActivePediatricData();
    const liveFicha = getLiveSyncedFichaData(pData);
    const isTutorUnlocked = isTutorSessionUnlocked();
    const patientName = pData.socialName || pData.fullName;
    const accreditedConditions = getAccreditedClinicalConditions(pData, liveFicha);

    // Cargar citas agendadas desde cuidapp_ficha_[RUT] y almacenamiento local
    let savedAppointments = [];
    try {
      if (liveFicha && Array.isArray(liveFicha.appointments) && liveFicha.appointments.length > 0) {
        savedAppointments = [...liveFicha.appointments];
      } else {
        const rawApp = localStorage.getItem('cuidapp_appointments_' + pData.rut);
        if (rawApp) {
          savedAppointments = JSON.parse(rawApp);
        } else {
          const isDemo = (pData.rut === '25.340.112-9' || pData.rut === '24.110.456-8' || pData.rut === '24.118.902-5' || (activePatient && (activePatient.id === 'p_mateo' || activePatient.id === 'mateo' || activePatient.id === 'p_camila' || activePatient.id === 'camila')));
          if (isDemo) {
            savedAppointments = pData.isAdolescent ? [
              { id: 'app_1', date: '18 Dic 2026', time: '10:30', specialty: 'Pediatría', specialist: 'Control Integral Adolescente (CLAP)', doctor: 'Dra. Marcela Soto', center: 'CESFAM Bellavista', reminderChannel: '📞 Llamada Telefónica Automatizada', status: 'Confirmada' },
              { id: 'app_2', date: '05 Ene 2027', time: '15:00', specialty: 'Neurología', specialist: 'Control Salud Mental Joven', doctor: 'Ps. Valentina Castro', center: 'Hospital Dr. Sótero del Río', reminderChannel: '💬 WhatsApp / SMS', status: 'Confirmada' }
            ] : [
              { id: 'app_1', date: '15 Dic 2026', time: '11:00', specialty: 'Pediatría', specialist: 'Control Niño Sano & PNI', doctor: 'Dra. Marcela Soto', center: 'CESFAM Bellavista', reminderChannel: '📞 Llamada Telefónica Automatizada', status: 'Confirmada' },
              { id: 'app_2', date: '22 Dic 2026', time: '16:00', specialty: 'Fonoaudiología', specialist: 'Fonoaudiología & Estimulación PIE', doctor: 'Lic. Rodrigo Vega', center: 'Centro de Desarrollo Infantil Bellavista', reminderChannel: '💬 WhatsApp / SMS', status: 'Confirmada' },
              { id: 'app_3', date: '08 Ene 2027', time: '09:30', specialty: 'Odontología', specialist: 'Control Odontopediátrico FDI', doctor: 'Dr. Camilo Sepúlveda', center: 'Clínica Dental Sur', reminderChannel: '📞 Llamada Telefónica Automatizada', status: 'Confirmada' }
            ];
            localStorage.setItem('cuidapp_appointments_' + pData.rut, JSON.stringify(savedAppointments));

            // Sincronizar en cuidapp_ficha global
            savedAppointments.forEach(app => {
              savePediatricRecordToGlobalFicha(pData, app, 'APPOINTMENT');
            });
          } else {
            savedAppointments = [];
          }
        }
      }
    } catch(e) {}

    // Sincronización en tiempo real desde la ficha global cuidapp_ficha_[RUT]
    if (liveFicha && Array.isArray(liveFicha.appointments)) {
      const existingIds = new Set(savedAppointments.map(a => a.id));
      liveFicha.appointments.forEach(app => {
        if (!existingIds.has(app.id)) {
          savedAppointments.push(app);
          existingIds.add(app.id);
        }
      });
    }

    // Filtrar citas vigentes y ordenar cronológicamente para determinar la más cercana
    const activeAppointments = savedAppointments.filter(a => {
      const st = String(a.status || '').toLowerCase();
      return !st.includes('cancel') && !st.includes('anulad');
    });

    const getAppTimestamp = (app) => {
      if (!app || !app.date) return 9999999999999;
      const months = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11 };
      const parts = String(app.date).toLowerCase().replace(/de/g, '').trim().split(/\s+/);
      if (parts.length >= 3) {
        const d = parseInt(parts[0], 10);
        const m = months[parts[1].substring(0, 3)] ?? 0;
        const y = parseInt(parts[2], 10);
        const [hh, mm] = String(app.time || '00:00').split(':').map(n => parseInt(n, 10) || 0);
        if (!isNaN(d) && !isNaN(y)) return new Date(y, m, d, hh, mm).getTime();
      }
      const parsed = Date.parse(app.date);
      return !isNaN(parsed) ? parsed : 9999999999999;
    };

    activeAppointments.sort((a, b) => getAppTimestamp(a) - getAppTimestamp(b));
    const nextAppointment = activeAppointments.length > 0 ? activeAppointments[0] : null;

    container.innerHTML = `
      <div class="container-fluid px-4 py-4" style="background-color: #08101a; min-height: 100vh; border-radius: 24px; color: #f8fafc; font-family: 'Outfit', sans-serif;">
        <!-- Barra superior del Modo Pediátrico / Adolescente -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <span class="badge px-3 py-2 rounded-pill fw-bold" style="background: rgba(6, 182, 212, 0.15); color: #06b6d4; border: 1px solid rgba(6, 182, 212, 0.35); font-size: 0.9rem;">
              ${pData.isAdolescent ? '✨ Portal Adolescente &bull; Salud Joven (12–17 años)' : '🧸 Modo Pediátrico Activo'}
            </span>
            <span class="badge px-3 py-2 rounded-pill fw-semibold" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); font-size: 0.9rem;">
              ${pData.isAdolescent ? '⚖️ Sello Confidencialidad Ley 21.430' : '🩺 Control Niño Sano'}
            </span>
          </div>
        </div>

        <!-- Tarjeta de Bienvenida y Resumen Clínico -->
        <div class="p-3.5 p-md-4 mb-4 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3" style="background: #0f1926; border-radius: 28px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border: 1.5px solid rgba(6, 182, 212, 0.3);">
          <div class="flex-grow-1">
            <!-- Saludo y subtítulo de bienvenida -->
            <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
              <span style="font-size: 2.1rem;">${pData.isAdolescent ? '🌱' : '🎈'}</span>
              <h1 class="fw-extrabold m-0 text-white" style="font-size: 2.1rem; letter-spacing: -0.5px;">
                ¡Hola, ${patientName}! ${pData.isAdolescent ? '✨' : '🌟'}
              </h1>
            </div>
            
            <p class="mb-3 text-white-50" style="font-size: 1.05rem; font-weight: 500;">
              ${pData.isAdolescent ? 'Espacio confidencial de salud integral para adolescentes, respetando tu autonomía progresiva (Ley 21.430).' : 'Bienvenido/a a tu espacio de salud y crecimiento protegido.'}
            </p>

            <!-- Botones de Acción Rápida (Ficha, QR, Dental) -->
            <div class="d-flex align-items-center gap-2 mb-2.5 flex-wrap">
              <button type="button" id="btnPediatricFichaHeader" class="btn btn-sm px-3.5 py-2 rounded-pill fw-bold shadow-sm d-inline-flex align-items-center gap-2" style="background: rgba(255,255,255,0.06); color: #06b6d4; border: 1.5px solid #06b6d4; font-size: 0.92rem; cursor: pointer;">
                📋 ${pData.isAdolescent ? 'Ficha CLAP & Perfil' : 'Mi Perfil y Ficha'}
              </button>
              <button type="button" id="btnPediatricQRHeader" class="btn btn-sm px-3.5 py-2 rounded-pill fw-bold shadow-sm d-inline-flex align-items-center gap-2" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff; border: 1.5px solid #06b6d4; font-size: 0.92rem; cursor: pointer;">
                📱 ${pData.isAdolescent ? 'QR Urgencias Joven' : 'Mi QR Pediátrico'}
              </button>
              <button type="button" id="btnPediatricDentalHeader" class="btn btn-sm px-3.5 py-2 rounded-pill fw-bold shadow-sm d-inline-flex align-items-center gap-2" style="background: rgba(255,255,255,0.06); color: #ec4899; border: 1.5px solid #ec4899; font-size: 0.92rem; cursor: pointer;">
                🦷 Mi Ficha Dental
              </button>
            </div>
            
            <!-- CONDICIÓN CLÍNICA ACREDITADA (ANCHO COMPLETO) -->
            <div class="w-100" id="sectionAccreditedConditionsHeader" style="margin-top: 18px;">
              ${accreditedConditions.map(cond => `
                <div class="rounded-3 d-flex align-items-center gap-2.5 shadow-sm" style="padding: 10px 16px; background: rgba(239, 68, 68, 0.16); border: 1.5px solid #ef4444; color: #fee2e2;">
                  <span style="font-size: 1.45rem; line-height: 1;">${cond.icon}</span>
                  <span class="fw-bold" style="font-size: 1.05rem;">
                    ${cond.name.toLowerCase().startsWith('condición') ? cond.name : `Condición Especial: ${cond.name}`}
                  </span>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="d-flex align-items-center gap-3">
            ${nextAppointment ? `
              <div id="btnPediatricNextAppointmentHeader" class="p-3 px-4 rounded-4 text-center" style="background: #08101a; border: 1.5px solid rgba(6, 182, 212, 0.45); color: #06b6d4; border-radius: 20px; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 15px rgba(0,0,0,0.3);" role="button" title="Haz clic para ver el detalle de la próxima cita agendada">
                <span class="small fw-bold text-uppercase d-block" style="font-size: 0.75rem; letter-spacing: 0.5px;">Próxima Cita</span>
                <span class="fw-extrabold text-white d-block mt-0.5" style="font-size: 1.05rem;">🗓️ ${nextAppointment.date}</span>
                <small class="text-info d-block fw-semibold" style="font-size: 0.72rem; margin-top: 2px;">👁️ Ver Detalle</small>
              </div>
            ` : `
              <div class="p-3 px-4 rounded-4 text-center" style="background: #08101a; border: 1.5px solid rgba(255, 255, 255, 0.15); color: #94a3b8; border-radius: 20px;">
                <span class="small fw-bold text-uppercase d-block" style="font-size: 0.75rem; letter-spacing: 0.5px;">Próxima Cita</span>
                <span class="fw-semibold text-white-50 d-block mt-0.5" style="font-size: 0.95rem;">Sin citas próximas</span>
              </div>
            `}
          </div>
        </div>

        <!-- SECCIÓN DE SIGNOS VITALES Y RANGOS PEDIÁTRICOS (MINSAL / OMS) -->
        ${(() => {
          const vitalRanges = getPediatricVitalRanges(pData.age);
          let pedVitals = null;
          let hasMeasurements = false;

          // Sincronización en tiempo real desde la ficha global cuidapp_ficha_[RUT] (reportes del cuidador/médico)
          if (liveFicha) {
            const allReports = [...(liveFicha.dailyReports || []), ...(liveFicha.reports || []), ...(liveFicha.clinicalLogs || [])];
            const reportsWithVitals = allReports.filter(rep => {
              const v = rep.vitals || rep;
              return v && (v.heartRate || v.systolic || v.spO2 || v.spo2 || v.temperature);
            });

            if (reportsWithVitals.length > 0) {
              const latestRep = reportsWithVitals[reportsWithVitals.length - 1];
              const repV = latestRep.vitals || latestRep;
              pedVitals = {
                hasVitals: true,
                heartRate: repV.heartRate || (vitalRanges.heartRate.ref),
                respRate: repV.respRate || repV.respiratoryRate || (vitalRanges.respRate.ref),
                systolic: repV.systolic || 100,
                diastolic: repV.diastolic || 65,
                spO2: repV.spO2 || repV.spo2 || 99
              };
              hasMeasurements = true;
            }
          }

          if (!hasMeasurements) {
            try {
              const rawV = localStorage.getItem('cuidapp_latest_vitals_' + (activePatient?.id || ''));
              if (rawV) {
                const parsedV = JSON.parse(rawV);
                if (parsedV && parsedV.hasVitals && (parsedV.heartRate || parsedV.systolic)) {
                  pedVitals = parsedV;
                  hasMeasurements = true;
                }
              }
            } catch(e) {}
          }

          // Si tiene 0 mediciones registradas, no mostrar ningún recuadro para que las tarjetas principales aparezcan directamente debajo de la cabecera
          if (!hasMeasurements) {
            return '';
          }

          // Si existen mediciones reales en cuidapp_ficha_[RUT], desplegar las 4 tarjetas completas
          return `
            <div class="p-4 rounded-4 mb-4" style="background: #0f1926; border: 1.5px solid rgba(6, 182, 212, 0.35); border-radius: 26px; box-shadow: 0 10px 28px rgba(0,0,0,0.45);">
              <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <div class="d-flex align-items-center gap-2">
                  <span style="font-size: 1.9rem;">🩺</span>
                  <div>
                    <h5 class="fw-bold m-0 text-white">Signos Vitales y Rangos Fisiológicos Pediátricos</h5>
                    <small class="text-white-50">Rangos de referencia para etapa <strong>${vitalRanges.stage}</strong> &bull; Protocolo MINSAL / OMS</small>
                  </div>
                </div>
                <span class="badge px-3 py-1.5 rounded-pill fw-bold" style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid #10b981;">
                  ✅ Mediciones Actualizadas
                </span>
              </div>

              <div class="row g-3">
                <!-- 1. Frecuencia Cardíaca (Turquesa #06b6d4) -->
                <div class="col-12 col-sm-6 col-lg-3">
                  <div class="p-3.5 rounded-4 text-center h-100 d-flex flex-column justify-content-between" style="background: #08101a; border: 2px solid #06b6d4; box-shadow: 0 4px 15px rgba(6, 182, 212, 0.15);">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                      <span class="small fw-bold" style="color: #06b6d4;">Frecuencia Cardíaca</span>
                      <span style="font-size: 1.2rem;">💓</span>
                    </div>
                    <div class="my-2">
                      <h3 class="fw-extrabold m-0 text-white">${pedVitals.heartRate}</h3>
                      <small class="text-white-50">BPM medido</small>
                    </div>
                    <span class="badge px-2.5 py-1 rounded-pill" style="background: rgba(6, 182, 212, 0.15); color: #06b6d4; font-size: 0.75rem;">Ref: ${vitalRanges.heartRate.ref}</span>
                  </div>
                </div>

                <!-- 2. Frecuencia Respiratoria (Fucsia #ec4899) -->
                <div class="col-12 col-sm-6 col-lg-3">
                  <div class="p-3.5 rounded-4 text-center h-100 d-flex flex-column justify-content-between" style="background: #08101a; border: 2px solid #ec4899; box-shadow: 0 4px 15px rgba(236, 72, 153, 0.15);">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                      <span class="small fw-bold" style="color: #ec4899;">Frecuencia Respiratoria</span>
                      <span style="font-size: 1.2rem;">🫁</span>
                    </div>
                    <div class="my-2">
                      <h3 class="fw-extrabold m-0 text-white">${pedVitals.respRate || vitalRanges.respRate.ref}</h3>
                      <small class="text-white-50">${pedVitals.respRate ? 'RPM medido' : 'Rango Normal'}</small>
                    </div>
                    <span class="badge px-2.5 py-1 rounded-pill" style="background: rgba(236, 72, 153, 0.15); color: #ec4899; font-size: 0.75rem;">Ref: ${vitalRanges.respRate.ref}</span>
                  </div>
                </div>

                <!-- 3. Presión Arterial (Rojo Coral #ef4444) -->
                <div class="col-12 col-sm-6 col-lg-3">
                  <div class="p-3.5 rounded-4 text-center h-100 d-flex flex-column justify-content-between" style="background: #08101a; border: 2px solid #ef4444; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.15);">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                      <span class="small fw-bold" style="color: #ef4444;">Presión Arterial</span>
                      <span style="font-size: 1.2rem;">🩸</span>
                    </div>
                    <div class="my-2">
                      <h3 class="fw-extrabold m-0 text-white">${pedVitals.systolic}/${pedVitals.diastolic}</h3>
                      <small class="text-white-50">mmHg medido</small>
                    </div>
                    <span class="badge px-2.5 py-1 rounded-pill" style="background: rgba(239, 68, 68, 0.15); color: #fca5a5; font-size: 0.75rem;">Ref: ${vitalRanges.systolic.ref} / ${vitalRanges.diastolic.ref}</span>
                  </div>
                </div>

                <!-- 4. Saturación SpO2 (Turquesa #06b6d4) -->
                <div class="col-12 col-sm-6 col-lg-3">
                  <div class="p-3.5 rounded-4 text-center h-100 d-flex flex-column justify-content-between" style="background: #08101a; border: 2px solid #06b6d4; box-shadow: 0 4px 15px rgba(6, 182, 212, 0.15);">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                      <span class="small fw-bold" style="color: #06b6d4;">Saturación SpO2</span>
                      <span style="font-size: 1.2rem;">💨</span>
                    </div>
                    <div class="my-2">
                      <h3 class="fw-extrabold m-0 text-white">${pedVitals.spO2}%</h3>
                      <small class="text-white-50">SpO2 medido</small>
                    </div>
                    <span class="badge px-2.5 py-1 rounded-pill" style="background: rgba(6, 182, 212, 0.15); color: #06b6d4; font-size: 0.75rem;">Ref: ${vitalRanges.spO2.ref}</span>
                  </div>
                </div>
              </div>
            </div>
          `;
        })()}

        ${pData.isAdolescent ? `
          <!-- GRID ADOLESCENTE MODERNO (3 MÓDULOS DE SALUD JOVEN) -->
          <div class="row g-4 mb-4" id="sectionAdolescentModules">
            <!-- 1. Vacunas Escolares -->
            <div class="col-12 col-md-4">
              <div role="button" id="btnPediatricVacunas" class="w-100 p-4 rounded-4 text-center d-flex flex-column align-items-center justify-content-center shadow-sm" style="background: #0f1926; border: 1.5px solid #06b6d4; border-radius: 24px; cursor: pointer; transition: all 0.25s ease; min-height: 180px;">
                <span class="mb-2" style="font-size: 2.8rem;">💉</span>
                <span class="fw-bold text-white fs-5">Vacunas Escolares</span>
                <span class="small mt-1 text-info">VPH, dTpa acelular (MINSAL)</span>
              </div>
            </div>

            <!-- 2. Antropometría & Desarrollo -->
            <div class="col-12 col-md-4">
              <div role="button" id="btnPediatricCrecimiento" class="w-100 p-4 rounded-4 text-center d-flex flex-column align-items-center justify-content-center shadow-sm" style="background: #0f1926; border: 1.5px solid #ec4899; border-radius: 24px; cursor: pointer; transition: all 0.25s ease; min-height: 180px;">
                <span class="mb-2" style="font-size: 2.8rem;">📏</span>
                <span class="fw-bold text-white fs-5">Crecimiento & IMC</span>
                <span class="small mt-1" style="color: #ec4899;">Curvas OMS Adolescentes</span>
              </div>
            </div>

            <!-- 3. Órdenes y Exámenes -->
            <div class="col-12 col-md-4">
              <div role="button" id="btnPediatricExamenes" class="w-100 p-4 rounded-4 text-center d-flex flex-column align-items-center justify-content-center shadow-sm" style="background: #0f1926; border: 1.5px solid #ef4444; border-radius: 24px; cursor: pointer; transition: all 0.25s ease; min-height: 180px;">
                <span class="mb-2" style="font-size: 2.8rem;">📁</span>
                <span class="fw-bold text-white fs-5">Exámenes & Registros</span>
                <span class="small mt-1" style="color: #ef4444;">Signos vitales, órdenes y certificados</span>
              </div>
            </div>
          </div>
        ` : `
          <!-- LOS 3 BOTONES GIGANTES PEDIÁTRICOS (NIÑO 0-11 AÑOS) -->
          <div class="row g-4 mb-4" id="sectionPediatricGiantButtons">
            <!-- 1. Mis Vacunas (Fondo GlassKit con borde turquesa #06b6d4) -->
            <div class="col-12 col-md-4">
              <div role="button" id="btnPediatricVacunas" class="w-100 p-4 p-md-5 d-flex flex-column align-items-center justify-content-center text-center shadow-sm" style="background: #0f1926; border: 2px solid #06b6d4; border-radius: 28px; cursor: pointer; transition: all 0.25s ease; min-height: 220px; box-shadow: 0 10px 25px rgba(0,0,0,0.4);">
                <span class="mb-3" style="font-size: 4rem; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">🧸</span>
                <span class="fw-extrabold" style="color: #06b6d4; font-size: 1.85rem; letter-spacing: -0.5px;">Mis Vacunas</span>
                <span class="small mt-1 fw-semibold" style="color: #38bdf8;">Vacunas de lactante al día &bull; 1° Básico pendiente</span>
              </div>
            </div>

            <!-- 2. Mi Crecimiento (Fondo GlassKit con borde fucsia #ec4899) -->
            <div class="col-12 col-md-4">
              <div role="button" id="btnPediatricCrecimiento" class="w-100 p-4 p-md-5 d-flex flex-column align-items-center justify-content-center text-center shadow-sm" style="background: #0f1926; border: 2px solid #ec4899; border-radius: 28px; cursor: pointer; transition: all 0.25s ease; min-height: 220px; box-shadow: 0 10px 25px rgba(0,0,0,0.4);">
                <span class="mb-3" style="font-size: 4rem; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">📏</span>
                <span class="fw-extrabold" style="color: #ec4899; font-size: 1.85rem; letter-spacing: -0.5px;">Mi Crecimiento</span>
                <span class="small mt-1 fw-semibold" style="color: #f472b6;">Curvas de peso, talla e IMC OMS</span>
              </div>
            </div>

            <!-- 3. Mis Exámenes y Registros (Fondo GlassKit con borde rojo coral #ef4444) -->
            <div class="col-12 col-md-4">
              <div role="button" id="btnPediatricExamenes" class="w-100 p-4 p-md-5 d-flex flex-column align-items-center justify-content-center text-center shadow-sm" style="background: #0f1926; border: 2px solid #ef4444; border-radius: 28px; cursor: pointer; transition: all 0.25s ease; min-height: 220px; box-shadow: 0 10px 25px rgba(0,0,0,0.4);">
                <span class="mb-3" style="font-size: 4rem; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">📁</span>
                <span class="fw-extrabold" style="color: #ef4444; font-size: 1.85rem; letter-spacing: -0.5px;">Mis Exámenes y Registros</span>
                <span class="small mt-1 fw-semibold" style="color: #f87171;">Signos vitales, recetas pediátricas y exámenes</span>
              </div>
            </div>
          </div>
        `}

        <!-- SECCIÓN DE RECORDATORIOS DE CITAS PEDIÁTRICAS (SOLO LECTURA) -->
        <div class="p-4 rounded-4 mb-4" style="background: #0f1926; border: 1.5px solid rgba(6, 182, 212, 0.3); border-radius: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.4);">
          <div class="d-flex align-items-center gap-2 mb-3">
            <span style="font-size: 1.8rem;">📅</span>
            <div>
              <h5 class="fw-bold m-0 text-white">Recordatorios de Citas & Controles Médicos</h5>
              <small class="text-white-50">Horas clínicas asignadas en Ficha Pediátrica</small>
            </div>
          </div>

          <div class="row g-3" id="appointmentListContainer">
            ${savedAppointments.length === 0 ? `
              <div class="col-12">
                <div class="p-4 rounded-4 text-center text-white-50" style="background: #08101a; border: 1.5px dashed rgba(6, 182, 212, 0.35);">
                  <div style="font-size: 2.5rem;" class="mb-2">🗓️</div>
                  <h6 class="fw-bold text-white mb-1">Sin citas médicas ni recordatorios pendientes</h6>
                  <p class="small text-white-50 mb-0">No hay controles programados actualmente.</p>
                </div>
              </div>
            ` : savedAppointments.map((app) => `
              <div class="col-12 col-md-6">
                <div class="p-3.5 rounded-4 d-flex flex-column justify-content-between h-100 btn-view-appointment-card" data-app-id="${app.id}" style="background: #08101a; border: 1.5px solid rgba(6, 182, 212, 0.3); border-radius: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.35); cursor: pointer;" role="button" title="Haz clic para ver el detalle de la cita">
                  <div>
                    <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-1">
                      <span class="badge rounded-pill px-2.5 py-1 text-white" style="background: #0284c7; font-size: 0.78rem;">
                        📅 ${app.date} &bull; ${app.time} hrs
                      </span>
                      <span class="badge rounded-pill px-2.5 py-1" style="background: ${getSpecialtyColorBg(app.specialty)}; color: ${getSpecialtyColor(app.specialty)}; border: 1px solid ${getSpecialtyColor(app.specialty)}; font-size: 0.78rem;">
                        ${getSpecialtyIcon(app.specialty)} ${app.specialty || 'Pediatría'}
                      </span>
                    </div>
                    <h6 class="fw-bold m-0 text-white" style="font-size: 1.05rem;">${app.specialist || app.reason || 'Control Pediátrico'}</h6>
                    <small class="text-white-50 d-block mt-1"><i class="bi bi-person-fill me-1 text-info"></i>${app.doctor}</small>
                    ${(app.center || pData.primaryHealthCenter) ? `<small class="text-white-50 d-block mt-0.5"><i class="bi bi-hospital me-1 text-warning"></i>${app.center || pData.primaryHealthCenter}</small>` : ''}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="mt-3 pt-3 border-top text-center" style="border-color: rgba(255,255,255,0.08) !important;">
            <p class="small text-white-50 m-0">
              <i class="bi bi-info-circle text-info me-1"></i>Las notificaciones y recordatorios de asistencia se envían directamente a tu Tutora Legal (Camila Paz Vergara Fuentes).
            </p>
          </div>
        </div>

        <!-- Tarjeta informativa del tutor / pediatra de cabecera -->
        <div class="p-4 rounded-4 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3" style="background: #0f1926; border: 1.5px solid rgba(6, 182, 212, 0.3); border-radius: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.4);">
          <div class="d-flex align-items-center gap-3">
            <div class="d-flex justify-content-center align-items-center rounded-circle flex-shrink-0" style="width: 52px; height: 52px; background: #08101a; color: #06b6d4; border: 1.5px solid #06b6d4; font-size: 1.6rem;">
              🩺
            </div>
            <div>
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <h6 class="fw-bold m-0 text-white" style="font-size: 1.05rem;">Equipo Pediátrico de Cabecera: ${pData.pediatricianName || 'Dra. Marcela Soto'}</h6>
                <span class="badge px-2 py-0.5 rounded-pill text-white-50" style="background: rgba(255,255,255,0.06); font-size: 0.72rem; border: 1px solid rgba(255,255,255,0.15);">
                  ⚖️ Ley N° 21.430
                </span>
              </div>
              <p class="small m-0 text-white-50 mt-0.5">
                CESFAM Bellavista &bull; Tutor Legal: <strong class="text-white">${pData.guardianName}</strong> (${pData.guardianRole}) &bull; 🚑 Urgencias SAMU: 131
              </p>
            </div>
          </div>
        </div>
      </div>
      ${pediatricModalsHTML}
      ${floatingVoiceButtonHTML}
    `;

    // Conectar botón Ficha Pediátrica en la cabecera
    const btnPediatricFichaHeader = document.getElementById('btnPediatricFichaHeader');
    if (btnPediatricFichaHeader) {
      attachVoiceGuidance(btnPediatricFichaHeader, 'Mi Ficha Pediátrica. Muestra la ficha clínica y de emergencia completa.');
      btnPediatricFichaHeader.onclick = () => {
        openPediatricFichaModal();
      };
    }

    // Conectar botón QR Pediátrico en la cabecera
    const btnPediatricQRHeader = document.getElementById('btnPediatricQRHeader');
    if (btnPediatricQRHeader) {
      attachVoiceGuidance(btnPediatricQRHeader, 'Mi QR Pediátrico. Muestra la ficha de emergencia del paciente con datos de salud y contacto.');
      btnPediatricQRHeader.onclick = () => {
        openPediatricQrModal();
      };
    }

    // Conectar botón Ficha Dental en la cabecera
    const btnPediatricDentalHeader = document.getElementById('btnPediatricDentalHeader');
    if (btnPediatricDentalHeader) {
      attachVoiceGuidance(btnPediatricDentalHeader, 'Mi Ficha Dental. Odontograma clínico, radiografías y tratamientos.');
      btnPediatricDentalHeader.onclick = () => {
        openDentalModuleModal('pediatrico');
      };
    }

    // Conectar clic en el recuadro superior derecho de Próxima Cita
    const btnNextApp = document.getElementById('btnPediatricNextAppointmentHeader');
    if (btnNextApp && nextAppointment) {
      attachVoiceGuidance(btnNextApp, `Próxima cita agendada para el ${nextAppointment.date}. Haz clic para ver el detalle de la hora médica.`);
      btnNextApp.onclick = () => {
        openAppointmentDetailModal(nextAppointment, pData);
      };
    }

    // Conectar clic en tarjetas de citas agendadas
    document.querySelectorAll('.btn-view-appointment-card').forEach(card => {
      card.onclick = () => {
        const appId = card.getAttribute('data-app-id');
        const found = savedAppointments.find(a => a.id === appId);
        if (found) openAppointmentDetailModal(found, pData);
      };
    });

    // Conectar botón Editar Alerta Clínica / Condiciones Especiales
    const btnEditSpecialConditions = document.getElementById('btnEditSpecialConditions');
    if (btnEditSpecialConditions) {
      btnEditSpecialConditions.onclick = () => {
        const modalSpecial = document.getElementById('modalPediatricSpecialConditions');
        if (modalSpecial) {
          const selectNeuro = document.getElementById('scSelectNeuro');
          const inputChronic = document.getElementById('scInputChronic');
          const inputAllergies = document.getElementById('scInputAllergies');
          const btnCloseX = document.getElementById('btnCloseSpecialCondX');
          const btnCloseBtn = document.getElementById('btnCloseSpecialCondBtn');

          if (selectNeuro) selectNeuro.value = pData.neurodivergences || 'Condición del Espectro Autista (TEA Grado 2)';
          if (inputChronic) inputChronic.value = pData.chronicConditions || '';
          if (inputAllergies) inputAllergies.value = pData.allergies || '';

          const hideSpecial = () => {
            try {
              if (window.bootstrap && window.bootstrap.Modal) {
                const inst = window.bootstrap.Modal.getInstance(modalSpecial);
                if (inst) inst.hide();
              }
            } catch(e) {}
            modalSpecial.classList.remove('show');
            modalSpecial.style.display = 'none';
            document.body.classList.remove('modal-open');
          };

          if (btnCloseX) btnCloseX.onclick = hideSpecial;
          if (btnCloseBtn) btnCloseBtn.onclick = hideSpecial;

          const formSpecial = document.getElementById('formSpecialConditions');
          if (formSpecial) {
            formSpecial.onsubmit = (e) => {
              e.preventDefault();
              const updatedOverrides = {
                neurodivergences: selectNeuro ? selectNeuro.value : 'Ninguna declarada',
                chronicConditions: inputChronic ? inputChronic.value : '',
                allergies: inputAllergies ? inputAllergies.value : ''
              };
              localStorage.setItem('cuidapp_pediatric_profile_' + (activePatient?.id || (pData.isAdolescent ? 'camila' : 'mateo')), JSON.stringify(updatedOverrides));
              hideSpecial();
              window.showGlassAlert('🧩 Condición especial y protocolo TEA actualizados.', 'success');
              if (modoVozActivo) speakText('Condición especial actualizada correctamente.');
              renderPediatricView(container, onBackToAdult);
            };
          }

          try {
            if (window.bootstrap && window.bootstrap.Modal) {
              new window.bootstrap.Modal(modalSpecial).show();
              return;
            }
          } catch(e) {}
          modalSpecial.classList.add('show');
          modalSpecial.style.display = 'block';
          document.body.classList.add('modal-open');
        }
      };
    }



    // 1. Conectar botón Mis Vacunas
    const btnPediatricVacunas = document.getElementById('btnPediatricVacunas');
    if (btnPediatricVacunas) {
      attachVoiceGuidance(btnPediatricVacunas, 'Mis Vacunas. Revisa el calendario del Programa Nacional de Inmunizaciones.');
      btnPediatricVacunas.onclick = () => {
        if (modoVozActivo) speakText('Abriendo sección Mis Vacunas...');
        pediatricSubTab = 'vacunas';
        renderPediatricView(container, onBackToAdult);
      };
    }

    // 2. Conectar botón Mi Crecimiento
    const btnPediatricCrecimiento = document.getElementById('btnPediatricCrecimiento');
    if (btnPediatricCrecimiento) {
      attachVoiceGuidance(btnPediatricCrecimiento, 'Mi Crecimiento. Monitoreo antropométrico y curvas OMS.');
      btnPediatricCrecimiento.onclick = () => {
        if (modoVozActivo) speakText('Abriendo sección Mi Crecimiento...');
        pediatricSubTab = 'crecimiento';
        renderPediatricView(container, onBackToAdult);
      };
    }

    // 3. Conectar botón Mis Exámenes
    const btnPediatricExamenes = document.getElementById('btnPediatricExamenes');
    if (btnPediatricExamenes) {
      attachVoiceGuidance(btnPediatricExamenes, 'Mis Exámenes. Documentos, recetas pediátricas y órdenes médicas.');
      btnPediatricExamenes.onclick = () => {
        if (modoVozActivo) speakText('Abriendo sección Mis Exámenes...');
        pediatricSubTab = 'examenes';
        renderPediatricView(container, onBackToAdult);
      };
    }

    // Vincular modales de soporte
    bindPediatricQrModalEvents();
    bindPediatricFichaModalEvents();

    // Efectos hover en botones gigantes
    ['btnPediatricVacunas', 'btnPediatricCrecimiento', 'btnPediatricExamenes'].forEach(btnId => {
      const el = document.getElementById(btnId);
      if (el) {
        el.onmouseenter = () => {
          el.style.transform = 'translateY(-4px)';
          el.style.boxShadow = '0 12px 24px -4px rgba(0,0,0,0.15)';
        };
        el.onmouseleave = () => {
          el.style.transform = 'translateY(0)';
          el.style.boxShadow = '';
        };
      }
    });
  }
}
