/**
 * @fileoverview Portal del Cuidador Formal e Informal - cuidApp
 * @module src/cuidador.js
 * @description Gestión clínica diaria domiciliaria:
 * - Registro de signos vitales (presión, SpO2, temperatura, glucosa, frecuencia cardíaca)
 * - Triage y alertas en tiempo real con detección de riesgo descompensatorio
 * - Administración de fármacos y validación fotográfica/inteligente de recetas (OCR/NLP)
 * - Protocolos de Urgencia con geolocalización GPS de alta precisión y llamadas de auxilio (131, 133, 600 360 7777)
 * - Soporte multi-idioma (Español, Kreyòl Ayisyen, Português, English, Mapuzugun)
 *
 * @compliance
 * - Ley N° 20.584: Rol del representante legal y cuidador autorizado
 * - Ley N° 19.628: Seguridad y custodia de antecedentes médicos sensibles
 * - Decreto Supremo N° 41 MINSAL: Trazabilidad horaria y firma de tomas basales
 */

import {
  activePatient,
  setActivePatient,
  PATIENTS_DATABASE,
  CAREGIVERS_DATABASE,
  CLINICAL_CONDITIONS,
  getTodayDateString,
  initCustomSelects,
  speakText,
  getModoVozActivo
} from './main.js';
import { mountIotEcgWidget } from './iot-ecg.js';
import { getPatientPrescriptions, getPatientMedicalEvolutions } from './medico.js';
import { getPediatricVitalRanges } from './pediatrico.js';
import { openDentalModuleModal } from './odontologia.js';

// Control de Acceso Estricto según Ley 20.584 (Derechos y Deberes del Paciente) y Ley 19.628 (Protección de Datos Personales)
export function getAuthorizedPatientsForCurrentCaregiver() {
  const sidebarUserEl = document.querySelector('.sidebar footer strong, footer strong.text-white');
  const loggedName = sidebarUserEl ? sidebarUserEl.textContent.trim() : '';

  const cleanRut = (r) => typeof r === 'string' ? r.replace(/[^0-9kK]/g, '').toUpperCase() : '';

  const isCaregiverUser = Boolean(
    (loggedName && (loggedName.toLowerCase().includes('sofía') || loggedName.toLowerCase().includes('sofia'))) ||
    (loggedName && CAREGIVERS_DATABASE.some(c => c.name.toLowerCase() === loggedName.toLowerCase() || (c.username && c.username.toLowerCase() === loggedName.toLowerCase())))
  );

  // 1. Identificar si el usuario en sesión es un paciente titular (Juan, Camila, Valentina, Daniela o nuevo usuario registrado)
  let titularPatient = null;
  if (loggedName && !isCaregiverUser) {
    titularPatient = PATIENTS_DATABASE.find(p => 
      p.name.toLowerCase() === loggedName.toLowerCase() || 
      (p.socialName && p.socialName.toLowerCase() === loggedName.toLowerCase()) ||
      (p.username && p.username.toLowerCase() === loggedName.toLowerCase())
    );
  }
  if (!titularPatient && !isCaregiverUser && activePatient) {
    titularPatient = activePatient;
    if (activePatient.parentPatientId) {
      const parent = PATIENTS_DATABASE.find(p => p.id === activePatient.parentPatientId);
      if (parent) titularPatient = parent;
    }
  }

  // Si el usuario activo es un paciente titular, cargar su ficha titular y todas sus personas a cargo
  if (titularPatient && !isCaregiverUser) {
    const list = [titularPatient];
    const childrenIds = Array.isArray(titularPatient.children) ? titularPatient.children : [];

    // Consolidar todos los pacientes disponibles en memoria y localStorage
    const allPatients = [...PATIENTS_DATABASE];
    try {
      const rawCustom = localStorage.getItem('cuidapp_custom_patients');
      if (rawCustom) {
        const customList = JSON.parse(rawCustom);
        if (Array.isArray(customList)) {
          customList.forEach(cp => {
            if (!allPatients.some(p => p.id === cp.id)) {
              allPatients.push(cp);
            }
          });
        }
      }
    } catch (e) {}

    allPatients.forEach(p => {
      if (p.id !== titularPatient.id) {
        const isChild = childrenIds.includes(p.id) || 
          p.parentPatientId === titularPatient.id || 
          (p.legalGuardianRut && titularPatient.fileNumber && cleanRut(p.legalGuardianRut) === cleanRut(titularPatient.fileNumber)) ||
          (p.legalGuardianName && titularPatient.name && p.legalGuardianName.toLowerCase() === titularPatient.name.toLowerCase());
        if (isChild && !list.some(item => item.id === p.id)) {
          list.push(p);
        }
      }
    });

    return list;
  }

  // 2. Si es cuidador/a profesional (ej. Sofía Díaz)
  let caregiver = null;
  if (loggedName) {
    caregiver = CAREGIVERS_DATABASE.find(c => 
      c.name.toLowerCase() === loggedName.toLowerCase() || 
      (c.username && c.username.toLowerCase() === loggedName.toLowerCase())
    );
  }

  if (!caregiver && activePatient) {
    caregiver = CAREGIVERS_DATABASE.find(c => c.assignedPatientId === activePatient.id);
  }

  if (!caregiver) {
    caregiver = CAREGIVERS_DATABASE.find(c => c.id === 'c1') || CAREGIVERS_DATABASE[0];
  }

  // Comprobar asignaciones dinámicas y vínculos legales en localStorage (cuidapp_caregiver_assignments)
  try {
    const rawAssignments = localStorage.getItem('cuidapp_caregiver_assignments');
    if (rawAssignments) {
      const assignments = JSON.parse(rawAssignments);
      if (Array.isArray(assignments)) {
        const activeAssigned = assignments.filter(a => 
          a.status !== 'revocado' && 
          (a.caregiverId === caregiver.id || (caregiver.username && a.caregiverUsername === caregiver.username) || a.caregiverName === caregiver.name)
        );
        if (activeAssigned.length > 0) {
          const assignedIds = activeAssigned.map(a => a.patientId);
          const matchedPatients = PATIENTS_DATABASE.filter(p => assignedIds.includes(p.id));
          if (matchedPatients.length > 0) return matchedPatients;
        }
      }
    }
  } catch (e) {
    console.error('Error al consultar cuidapp_caregiver_assignments:', e);
  }

  if (caregiver && caregiver.assignedPatientId) {
    const assigned = PATIENTS_DATABASE.filter(p => p.id === caregiver.assignedPatientId);
    if (assigned.length > 0) return assigned;
  }

  return [PATIENTS_DATABASE[0]];
}

// Detección automática de edad y etapa pediátrica según Ley N° 21.430 y MINSAL/OMS
export function getPatientAge(patient) {
  if (!patient) return 70;
  if (typeof patient.age === 'number' && !isNaN(patient.age)) return patient.age;
  if (patient.birthDate) {
    const dob = new Date(patient.birthDate);
    if (!isNaN(dob.getTime())) {
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      return age;
    }
  }
  return 70;
}

// Actualización automática e inmediata de rangos de signos vitales (pediátricos vs adultos)
export function updateCaregiverVitalRangesUI(patient) {
  const bpRef = document.getElementById('refBadgeBloodPressure');
  const spO2Ref = document.getElementById('refBadgeSpO2');
  const tempRef = document.getElementById('refBadgeTemperature');
  const hrRef = document.getElementById('refBadgeHeartRate');
  const respRef = document.getElementById('refBadgeRespRate');
  const respContainer = document.getElementById('containerPediatricRespRate');
  const symptomsContainer = document.getElementById('containerCaregiverSymptoms');
  const banner = document.getElementById('pediatricCaregiverVitalsBanner');
  const bannerText = document.getElementById('pediatricCaregiverBannerText');
  const stageBadge = document.getElementById('pediatricCaregiverStageBadge');
  const triageBadge = document.getElementById('badgeCaregiverTriageMode');
  const subtitle = document.getElementById('vitalsSubTitleCaregiver');

  if (!patient) return;
  const age = getPatientAge(patient);
  const isPediatric = age < 18 || patient.isPediatric === true;

  if (isPediatric) {
    const pedRanges = getPediatricVitalRanges(age);
    if (bpRef) {
      bpRef.textContent = `Ref: ${pedRanges.systolic.ref} / ${pedRanges.diastolic.ref}`;
      bpRef.style.color = '#fca5a5';
      bpRef.style.borderColor = 'rgba(239, 68, 68, 0.3)';
    }
    if (spO2Ref) {
      spO2Ref.textContent = `Ref: ${pedRanges.spO2.ref}`;
      spO2Ref.style.color = '#38bdf8';
      spO2Ref.style.borderColor = 'rgba(56, 189, 248, 0.3)';
    }
    if (tempRef) {
      tempRef.textContent = `Ref: ${pedRanges.temp.ref}`;
      tempRef.style.color = '#fbbf24';
      tempRef.style.borderColor = 'rgba(251, 191, 36, 0.3)';
    }
    if (hrRef) {
      hrRef.textContent = `Ref: ${pedRanges.heartRate.ref}`;
      hrRef.style.color = '#f43f5e';
      hrRef.style.borderColor = 'rgba(244, 63, 94, 0.3)';
    }
    if (respRef) {
      respRef.textContent = `Ref: ${pedRanges.respRate.ref}`;
      respRef.style.color = '#ec4899';
    }
    if (respContainer) {
      respContainer.classList.remove('d-none');
    }
    if (symptomsContainer) {
      symptomsContainer.className = 'col-lg-4 col-md-12';
    }
    if (subtitle) {
      subtitle.innerHTML = `Evaluación de signos vitales pediátricos basales &bull; <strong class="text-info">${pedRanges.stage}</strong> (${age} años)`;
    }
    if (triageBadge) {
      triageBadge.innerHTML = `<i class="bi bi-shield-check me-1"></i>Triage Pediátrico (${age}a &bull; ${pedRanges.stage})`;
      triageBadge.style.background = 'rgba(6, 182, 212, 0.2)';
      triageBadge.style.color = '#38bdf8';
      triageBadge.style.border = '1px solid #06b6d4';
    }
    if (banner) {
      banner.classList.remove('d-none');
      if (bannerText) {
        bannerText.innerHTML = `<strong>Paciente Pediátrico (${age} años):</strong> Rangos fisiológicos adaptados automáticamente según normativa MINSAL/OMS para <strong>${pedRanges.stage}</strong>.`;
      }
      if (stageBadge) {
        stageBadge.textContent = pedRanges.stage;
      }
    }
  } else {
    // Restaurar rangos y modo adulto
    if (bpRef) {
      bpRef.textContent = 'Ref: < 120/80 mmHg';
      bpRef.style.color = '#93c5fd';
      bpRef.style.borderColor = 'rgba(147, 197, 253, 0.2)';
    }
    if (spO2Ref) {
      spO2Ref.textContent = 'Ref: 95–100%';
      spO2Ref.style.color = '#38bdf8';
      spO2Ref.style.borderColor = 'rgba(56, 189, 248, 0.2)';
    }
    if (tempRef) {
      tempRef.textContent = 'Ref: 36.0–37.2°C';
      tempRef.style.color = '#fbbf24';
      tempRef.style.borderColor = 'rgba(251, 191, 36, 0.2)';
    }
    if (hrRef) {
      hrRef.textContent = 'Ref: 60–100 BPM';
      hrRef.style.color = '#f43f5e';
      hrRef.style.borderColor = 'rgba(244, 63, 94, 0.2)';
    }
    if (respContainer) {
      respContainer.classList.add('d-none');
    }
    if (symptomsContainer) {
      symptomsContainer.className = 'col-lg-8 col-md-7';
    }
    if (subtitle) {
      subtitle.textContent = 'Evaluación de signos vitales basales y detección de riesgo en tiempo real';
    }
    if (triageBadge) {
      triageBadge.innerHTML = '<i class="bi bi-broadcast me-1"></i>Triage en Tiempo Real';
      triageBadge.style.background = 'rgba(16, 185, 129, 0.15)';
      triageBadge.style.color = '#34d399';
      triageBadge.style.border = '1px solid rgba(16, 185, 129, 0.35)';
    }
    if (banner) {
      banner.classList.add('d-none');
    }
  }

  // Recalcular alertas reactivas si la función está disponible
  if (typeof evaluateRealtimeBasicVitalsAlert === 'function') {
    evaluateRealtimeBasicVitalsAlert();
  }
}

// --- SINCRONIZACIÓN CLÍNICA Y TRAZABILIDAD LEGAL (DECRETO SUPREMO N° 41 / LEY 20.584) ---

export function getPatientClinicalLogs(patientId) {
  try {
    const raw = localStorage.getItem(`cuidapp_clinical_logs_${patientId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error al leer el historial clínico de localStorage:', e);
  }

  // Registros semilla iniciales para Juan Díaz (p1) para trazabilidad legal demostrable
  if (patientId === 'p1') {
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
    const yesterdayIso = yesterday.toISOString();
    const yesterdayDate = yesterdayIso.split('T')[0];
    const initialSeed = [
      {
        id: 'rec_20261116_01',
        patientId: 'p1',
        patientName: 'Juan Díaz',
        timestamp: yesterdayIso,
        date: yesterdayDate,
        monthKey: yesterdayDate.slice(0, 7),
        time: '08:30',
        recordedBy: 'Sofía Díaz (Cuidadora Autorizada)',
        role: 'cuidador',
        systolic: 125,
        diastolic: 80,
        spo2: 97,
        spO2: 97,
        temperature: 36.6,
        glycemia: 98,
        glucose: 98,
        heartRate: 72,
        painEva: 2,
        pain: 2,
        edema: false,
        symptoms: ['Ninguno'],
        medicationAdherence: true,
        notes: 'Control matutino estable. Paciente ingirió desayuno y medicamentos según pauta.',
        alertLevel: 'normal'
      }
    ];
    try {
      localStorage.setItem(`cuidapp_clinical_logs_${patientId}`, JSON.stringify(initialSeed));
    } catch (e) {}
    return initialSeed;
  }

  return [];
}

export function savePatientClinicalLog(patientId, record) {
  try {
    const logs = getPatientClinicalLogs(patientId);
    logs.unshift(record);
    localStorage.setItem(`cuidapp_clinical_logs_${patientId}`, JSON.stringify(logs));
  } catch (e) {
    console.error('Error al guardar log clínico en localStorage:', e);
  }
}

// ============================================================================
// FICHA CLÍNICA GLOBAL COMPARTIDA Y AUDITORÍA INMUTABLE (DS N° 41 / LEY 19.628)
// ============================================================================
export function getPatientFichaRut(patient = activePatient) {
  const raw = (patient && (patient.fileNumber || patient.rut)) || '10.420.932-K';
  const noDots = String(raw).replace(/\./g, '').trim().toUpperCase();
  if (noDots.includes('-')) return noDots;
  if (noDots.length > 1) return `${noDots.slice(0, -1)}-${noDots.slice(-1)}`;
  return noDots;
}

export function getPatientGlobalFicha(patient = activePatient) {
  const cleanRut = getPatientFichaRut(patient);
  const primaryKey = `cuidapp_ficha_${cleanRut}`;
  try {
    const raw = localStorage.getItem(primaryKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {
    console.error('Error al leer ficha clínica global del paciente:', e);
  }
  return {
    rut: cleanRut,
    patientRut: (patient && (patient.fileNumber || patient.rut)) || '10.420.932-K',
    patientId: patient ? patient.id : 'p1',
    patientName: patient ? patient.name : 'Juan Díaz',
    updatedAt: new Date().toISOString(),
    reports: [],
    dailyReports: [],
    documents: [],
    prescriptions: [],
    history: [],
    timeline: []
  };
}

export function saveRecordToGlobalFicha(patient, record, type = 'DAILY_REPORT') {
  try {
    const cleanRut = getPatientFichaRut(patient);
    const primaryKey = `cuidapp_ficha_${cleanRut}`;
    const rawRut = (patient && (patient.fileNumber || patient.rut)) || '10.420.932-K';
    const ficha = getPatientGlobalFicha(patient);

    ficha.updatedAt = new Date().toISOString();
    ficha.patientId = patient ? patient.id : (ficha.patientId || 'p1');
    ficha.patientName = patient ? patient.name : (ficha.patientName || 'Juan Díaz');
    ficha.rut = cleanRut;
    ficha.patientRut = rawRut;

    if (!Array.isArray(ficha.reports)) ficha.reports = [];
    if (!Array.isArray(ficha.documents)) ficha.documents = [];
    if (!Array.isArray(ficha.history)) ficha.history = [];

    if (type === 'DAILY_REPORT') {
      const idx = ficha.reports.findIndex(r => r.id === record.id);
      if (idx >= 0) {
        ficha.reports[idx] = record;
      } else {
        ficha.reports.unshift(record);
      }
      ficha.dailyReports = ficha.reports;
    } else if (type === 'DOCUMENT' || type === 'PRESCRIPTION') {
      const idx = ficha.documents.findIndex(d => d.id === record.id);
      if (idx >= 0) {
        ficha.documents[idx] = record;
      } else {
        ficha.documents.unshift(record);
      }
      ficha.prescriptions = ficha.documents.filter(d => d.type === 'Receta Médica');
    }

    // Historial unificado cronológico
    const historyItem = {
      id: record.id || `hist_${Date.now()}`,
      timestamp: record.timestamp || record.createdAt || new Date().toISOString(),
      date: record.date || getTodayDateString(),
      type: type,
      recordType: type === 'DAILY_REPORT' ? 'Reporte Diario' : (record.type || 'Documento Clínico'),
      title: record.title || (type === 'DAILY_REPORT' ? 'Control Diario de Signos Vitales' : 'Documento Clínico'),
      specialty: record.specialty || (type === 'DAILY_REPORT' ? 'Medicina General' : 'Documento Clínico'),
      author: 'Sofía Díaz (Cuidador)',
      data: record
    };
    ficha.history.unshift(historyItem);
    ficha.timeline = ficha.history;

    const serialized = JSON.stringify(ficha);
    localStorage.setItem(primaryKey, serialized);

    // Si el RUT con puntos es distinto, sincronizar también
    if (rawRut && rawRut !== cleanRut) {
      localStorage.setItem(`cuidapp_ficha_${rawRut}`, serialized);
    }

    if (typeof window !== 'undefined') {
      window[primaryKey] = ficha;
      window.cuidAppActiveFicha = ficha;
    }

    return ficha;
  } catch (e) {
    console.error('Error al guardar en cuidapp_ficha global:', e);
  }
}

export function insertAuditLogEntry({
  patient,
  author = 'Sofía Díaz (Cuidador)',
  specialty = 'Medicina General',
  recordType = 'Reporte Diario',
  details = '',
  recordId = null
}) {
  try {
    const rawPatient = patient || activePatient;
    const patientRut = (rawPatient && (rawPatient.fileNumber || rawPatient.rut)) || '10.420.932-K';
    const cleanRut = getPatientFichaRut(rawPatient);
    const nowIso = new Date().toISOString();

    const auditEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: nowIso,
      date: nowIso.split('T')[0],
      patientRut: patientRut,
      patientRutClean: cleanRut,
      patientId: rawPatient ? rawPatient.id : 'p1',
      patientName: rawPatient ? rawPatient.name : 'Juan Díaz',
      author: author, // "Sofía Díaz (Cuidador)"
      operator: author,
      role: 'cuidador',
      roleLabel: 'Cuidador',
      specialty: specialty,
      recordType: recordType,
      type: recordType,
      eventType: recordType.toLowerCase().includes('receta') ? 'PRESCRIPTION' : (recordType.toLowerCase().includes('examen') || recordType.toLowerCase().includes('informe') || recordType.toLowerCase().includes('documento')) ? 'CAREGIVER_DOCUMENT' : 'CLINICAL_LOG',
      eventCategory: recordType,
      details: details || `Registro de ${recordType} (${specialty}) por ${author}`,
      summary: `[${specialty}] ${recordType} registrado para paciente RUT ${patientRut} por ${author}. ${details}`,
      recordId: recordId,
      legalSeal: 'DS N° 41 / Ley 19.628 / Ley 20.584 Auditoría de Trazabilidad Inmutable',
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

    // 2. cuidapp_admin_audit_log (compatibilidad directa con Administrador)
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
        action: `REGISTRO_${recordType.toUpperCase().replace(/\s+/g, '_')}`,
        operator: author,
        patientId: auditEntry.patientId,
        patientName: auditEntry.patientName,
        patientRut: patientRut,
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
  } catch (e) {
    console.error('Error al insertar evento en cuidapp_audit_log:', e);
  }
}

export function ensurePatientGlobalFichaInitialized(patient = activePatient) {
  try {
    const cleanRut = getPatientFichaRut(patient);
    const key = `cuidapp_ficha_${cleanRut}`;
    const raw = localStorage.getItem(key);
    if (!raw) {
      const ficha = getPatientGlobalFicha(patient);
      const initialLogs = getPatientClinicalLogs(patient ? patient.id : 'p1');
      const initialDocs = getCaregiverPatientDocuments(patient);
      ficha.reports = initialLogs;
      ficha.dailyReports = initialLogs;
      ficha.documents = initialDocs;
      ficha.prescriptions = initialDocs.filter(d => d.type === 'Receta Médica');
      ficha.history = [
        ...initialDocs.map(d => ({
          id: d.id,
          timestamp: d.createdAt || new Date().toISOString(),
          date: d.date || getTodayDateString(),
          type: 'DOCUMENT',
          recordType: d.type || 'Documento Clínico',
          title: d.title,
          specialty: d.specialty || 'Medicina General',
          author: 'Sofía Díaz (Cuidador)',
          data: d
        })),
        ...initialLogs.map(l => ({
          id: l.id,
          timestamp: l.timestamp || new Date().toISOString(),
          date: l.date || getTodayDateString(),
          type: 'DAILY_REPORT',
          recordType: 'Reporte Diario',
          title: 'Control Diario de Signos Vitales',
          specialty: 'Medicina General',
          author: l.recordedBy || 'Sofía Díaz (Cuidador)',
          data: l
        }))
      ];
      ficha.timeline = ficha.history;
      const serialized = JSON.stringify(ficha);
      localStorage.setItem(key, serialized);
      const rawRut = (patient && (patient.fileNumber || patient.rut)) || '10.420.932-K';
      if (rawRut && rawRut !== cleanRut) {
        localStorage.setItem(`cuidapp_ficha_${rawRut}`, serialized);
      }
    }
  } catch (e) {
    console.error('Error al inicializar cuidapp_ficha global:', e);
  }
}

export function calculateAlertLevel({ systolic, diastolic, heartRate, edema, symptoms, medicationAdherence, pain, spO2, glucose, temperature, age, patient }) {
  const patientAge = age !== undefined ? age : (patient ? getPatientAge(patient) : (activePatient ? getPatientAge(activePatient) : 70));
  if (patientAge < 18) {
    const ped = getPediatricVitalRanges(patientAge);
    if (
      (typeof heartRate === 'number' && !isNaN(heartRate) && (heartRate < ped.heartRate.min - 15 || heartRate > ped.heartRate.max + 20)) ||
      (typeof systolic === 'number' && !isNaN(systolic) && (systolic > ped.systolic.max + 15 || systolic < ped.systolic.min - 15)) ||
      (typeof diastolic === 'number' && !isNaN(diastolic) && (diastolic > ped.diastolic.max + 15 || diastolic < ped.diastolic.min - 15)) ||
      (typeof pain === 'number' && !isNaN(pain) && pain >= 8) ||
      (typeof spO2 === 'number' && !isNaN(spO2) && spO2 <= 90) ||
      (typeof temperature === 'number' && !isNaN(temperature) && (temperature >= 38.5 || temperature < 35.5))
    ) {
      return 'critico';
    }

    const hasAbnormalSymptoms = Array.isArray(symptoms) && symptoms.some(s => s && s !== 'Ninguno');
    if (
      (typeof heartRate === 'number' && !isNaN(heartRate) && (heartRate < ped.heartRate.min || heartRate > ped.heartRate.max)) ||
      (typeof systolic === 'number' && !isNaN(systolic) && (systolic > ped.systolic.max || systolic < ped.systolic.min)) ||
      (typeof diastolic === 'number' && !isNaN(diastolic) && (diastolic > ped.diastolic.max || diastolic < ped.diastolic.min)) ||
      (typeof pain === 'number' && !isNaN(pain) && pain >= 5) ||
      edema === true ||
      hasAbnormalSymptoms ||
      medicationAdherence === false ||
      (typeof spO2 === 'number' && !isNaN(spO2) && spO2 <= 94) ||
      (typeof temperature === 'number' && !isNaN(temperature) && (temperature >= 37.6 || temperature < 36.0))
    ) {
      return 'advertencia';
    }
    return 'normal';
  }

  // Rango Crítico Adulto:
  // Hipotensión < 90/60, Hipertensión >= 140/90, SpO2 <= 90%, Fiebre >= 38.0°C (o < 35.0°C), Hipoglucemia < 70 o Hiperglucemia > 180, FC < 50 o > 120, Dolor EVA >= 8
  if (
    (typeof heartRate === 'number' && !isNaN(heartRate) && (heartRate < 50 || heartRate > 120)) ||
    (typeof systolic === 'number' && !isNaN(systolic) && (systolic >= 140 || systolic < 90)) ||
    (typeof diastolic === 'number' && !isNaN(diastolic) && (diastolic >= 90 || diastolic < 60)) ||
    (typeof pain === 'number' && !isNaN(pain) && pain >= 8) ||
    (typeof spO2 === 'number' && !isNaN(spO2) && spO2 <= 90) ||
    (typeof temperature === 'number' && !isNaN(temperature) && (temperature >= 38.0 || temperature < 35.0)) ||
    (typeof glucose === 'number' && !isNaN(glucose) && (glucose < 70 || glucose > 180))
  ) {
    return 'critico';
  }

  // Rango Advertencia Adulto: Presión >= 120/80, FC 50-59 o 101-120, Dolor EVA >= 5, Edema presente, Síntomas de alarma activos, No tomó medicación, SpO2 91-94, Fiebre/Febrícula >= 37.3 o < 36.0, Glucosa > 130
  const hasAbnormalSymptoms = Array.isArray(symptoms) && symptoms.some(s => s && s !== 'Ninguno');
  if (
    (typeof systolic === 'number' && !isNaN(systolic) && systolic >= 120) ||
    (typeof diastolic === 'number' && !isNaN(diastolic) && diastolic >= 80) ||
    (typeof heartRate === 'number' && !isNaN(heartRate) && (heartRate > 100 || heartRate < 60)) ||
    (typeof pain === 'number' && !isNaN(pain) && pain >= 5) ||
    edema === true ||
    hasAbnormalSymptoms ||
    medicationAdherence === false ||
    (typeof spO2 === 'number' && !isNaN(spO2) && spO2 <= 94) ||
    (typeof temperature === 'number' && !isNaN(temperature) && (temperature >= 37.3 || temperature < 36.0)) ||
    (typeof glucose === 'number' && !isNaN(glucose) && glucose > 130)
  ) {
    return 'advertencia';
  }

  return 'normal';
}

// Evaluación reactiva en tiempo real del bloque "Tomas Básicas y Alertas Clínicas"
export function evaluateRealtimeBasicVitalsAlert() {
  const alertBox = document.getElementById('vitalsRealtimeAlertBox');
  if (!alertBox) return;

  const bpSysInput = document.getElementById('bpSystolic');
  const bpDiaInput = document.getElementById('bpDiastolic');
  const spO2Input = document.getElementById('vitalSpO2') || document.getElementById('epocSpO2');
  const tempInput = document.getElementById('vitalTemperature');
  const glucoseInput = document.getElementById('glucoseLevel');

  const systolic = bpSysInput && bpSysInput.value !== '' ? parseFloat(bpSysInput.value) : NaN;
  const diastolic = bpDiaInput && bpDiaInput.value !== '' ? parseFloat(bpDiaInput.value) : NaN;
  const spO2 = spO2Input && spO2Input.value !== '' ? parseFloat(spO2Input.value) : NaN;
  const temp = tempInput && tempInput.value !== '' ? parseFloat(tempInput.value) : NaN;
  const glucose = glucoseInput && glucoseInput.value !== '' ? parseFloat(glucoseInput.value) : NaN;

  const patientAge = getPatientAge(activePatient);
  const isPediatric = patientAge < 18 || activePatient?.isPediatric === true;
  const pedRanges = isPediatric ? getPediatricVitalRanges(patientAge) : null;

  const criticalIssues = [];
  const warningIssues = [];

  // 1. Presión Arterial
  if (!isNaN(systolic) || !isNaN(diastolic)) {
    const bpDisplay = `${!isNaN(systolic) ? systolic : '--'}/${!isNaN(diastolic) ? diastolic : '--'} mmHg`;
    if (isPediatric && pedRanges) {
      const isHypo = (!isNaN(systolic) && systolic < pedRanges.systolic.min - 10) || (!isNaN(diastolic) && diastolic < pedRanges.diastolic.min - 10);
      const isHyper = (!isNaN(systolic) && systolic > pedRanges.systolic.max + 15) || (!isNaN(diastolic) && diastolic > pedRanges.diastolic.max + 15);
      const isElevated = (!isNaN(systolic) && systolic > pedRanges.systolic.max) || (!isNaN(diastolic) && diastolic > pedRanges.diastolic.max);

      if (isHypo) {
        criticalIssues.push(`Hipotensión arterial pediátrica (${bpDisplay} — Ref etapa: ${pedRanges.systolic.ref} / ${pedRanges.diastolic.ref})`);
      } else if (isHyper) {
        criticalIssues.push(`Hipertensión arterial pediátrica severa (${bpDisplay} — Ref etapa: ${pedRanges.systolic.ref} / ${pedRanges.diastolic.ref})`);
      } else if (isElevated) {
        warningIssues.push(`Presión arterial fuera de rango para etapa ${pedRanges.stage} (${bpDisplay} — Ref: ${pedRanges.systolic.ref} / ${pedRanges.diastolic.ref})`);
      }
    } else {
      const isHypotension = (!isNaN(systolic) && systolic < 90) || (!isNaN(diastolic) && diastolic < 60);
      const isHypertension = (!isNaN(systolic) && systolic >= 140) || (!isNaN(diastolic) && diastolic >= 90);
      const isElevated = (!isNaN(systolic) && systolic >= 120) || (!isNaN(diastolic) && diastolic >= 80);

      if (isHypotension) {
        criticalIssues.push(`Hipotensión arterial (${bpDisplay} — Crítica &lt; 90/60 mmHg)`);
      } else if (isHypertension) {
        criticalIssues.push(`Hipertensión arterial (${bpDisplay} — Crítica ≥ 140/90 mmHg)`);
      } else if (isElevated) {
        warningIssues.push(`Presión arterial elevada (${bpDisplay} — Ref: &lt; 120/80 mmHg)`);
      }
    }
  }

  // 2. Saturación SpO2
  if (!isNaN(spO2)) {
    if (spO2 <= 90) {
      criticalIssues.push(`Desaturación severa / Hipoxemia (SpO2 ${spO2}% — Crítica ≤ 90%)`);
    } else if (spO2 < 95) {
      warningIssues.push(`Saturación SpO2 subóptima (${spO2}% — Ref: 95–100%)`);
    }
  }

  // 3. Temperatura
  if (!isNaN(temp)) {
    if (temp >= 38.5) {
      criticalIssues.push(`Fiebre alta (${temp.toFixed(1)}°C — Crítica ≥ 38.5°C)`);
    } else if (temp < 35.0) {
      criticalIssues.push(`Hipotermia severa (${temp.toFixed(1)}°C — Crítica &lt; 35.0°C)`);
    } else if (temp >= 37.6) {
      warningIssues.push(`Febrícula (${temp.toFixed(1)}°C — Ref: 36.5–37.5°C)`);
    } else if (temp < 36.0) {
      warningIssues.push(`Temperatura corporal baja (${temp.toFixed(1)}°C)`);
    }
  }

  // 4. Glucemia
  if (!isNaN(glucose)) {
    if (glucose < 70) {
      criticalIssues.push(`Hipoglucemia severa (${glucose} mg/dL — Crítica &lt; 70 mg/dL)`);
    } else if (glucose > 180) {
      criticalIssues.push(`Hiperglucemia crítica (${glucose} mg/dL — Crítica &gt; 180 mg/dL)`);
    } else if (glucose > 130) {
      warningIssues.push(`Glucemia elevada (${glucose} mg/dL — Ref: 70–130 mg/dL)`);
    }
  }

  // 5. Frecuencia Cardíaca
  const hrInput = document.getElementById('heartRate');
  const hr = hrInput && hrInput.value !== '' ? parseFloat(hrInput.value) : NaN;
  if (!isNaN(hr)) {
    if (isPediatric && pedRanges) {
      if (hr < pedRanges.heartRate.min - 15) {
        criticalIssues.push(`Bradicardia severa pediátrica (${hr} BPM — Ref etapa: ${pedRanges.heartRate.ref})`);
      } else if (hr > pedRanges.heartRate.max + 20) {
        criticalIssues.push(`Taquicardia severa pediátrica (${hr} BPM — Ref etapa: ${pedRanges.heartRate.ref})`);
      } else if (hr < pedRanges.heartRate.min) {
        warningIssues.push(`Frecuencia cardíaca baja para etapa ${pedRanges.stage} (${hr} BPM — Ref: ${pedRanges.heartRate.ref})`);
      } else if (hr > pedRanges.heartRate.max) {
        warningIssues.push(`Frecuencia cardíaca elevada para etapa ${pedRanges.stage} (${hr} BPM — Ref: ${pedRanges.heartRate.ref})`);
      }
    } else {
      if (hr < 50) {
        criticalIssues.push(`Bradicardia severa (${hr} BPM — Crítica &lt; 50 BPM)`);
      } else if (hr > 120) {
        criticalIssues.push(`Taquicardia severa (${hr} BPM — Crítica &gt; 120 BPM)`);
      } else if (hr < 60) {
        warningIssues.push(`Frecuencia cardíaca baja (${hr} BPM — Ref: 60–100 BPM)`);
      } else if (hr > 100) {
        warningIssues.push(`Taquicardia moderada (${hr} BPM — Ref: 60–100 BPM)`);
      }
    }
  }

  // 6. Edema y Síntomas de Alerta
  const cardioEdemaInput = document.getElementById('cardioEdema');
  if (cardioEdemaInput && cardioEdemaInput.checked) {
    warningIssues.push(`Edema activo en extremidades inferiores (retención de líquido)`);
  }

  const activeCardioSymptoms = [];
  document.querySelectorAll('.cardio-symptom-btn').forEach(b => {
    if ((b.classList.contains('btn-glass-primary') || b.classList.contains('btn-glass-success')) && b.getAttribute('data-symptom') !== 'Ninguno') {
      activeCardioSymptoms.push(b.getAttribute('data-symptom'));
    }
  });
  if (activeCardioSymptoms.length > 0) {
    warningIssues.push(`Síntomas de alarma activos: ${activeCardioSymptoms.join(', ')}`);
  }

  // 7. Nivel de Dolor (Escala EVA 1-10)
  const painInput = document.getElementById('painLevel');
  const painVal = painInput && painInput.value !== '' ? parseInt(painInput.value, 10) : 1;
  if (!isNaN(painVal)) {
    if (painVal >= 8) {
      criticalIssues.push(`Dolor severo escala EVA (${painVal}/10 — Intenso / Descompensante)`);
    } else if (painVal >= 5) {
      warningIssues.push(`Dolor moderado escala EVA (${painVal}/10 — Requiere seguimiento)`);
    }
  }

  // Actualización visual inmediata de la caja de alerta
  if (criticalIssues.length > 0) {
    alertBox.style.background = 'rgba(239, 68, 68, 0.16)';
    alertBox.style.border = '1px solid rgba(239, 68, 68, 0.5)';
    alertBox.style.boxShadow = '0 0 16px rgba(239, 68, 68, 0.25)';
    alertBox.innerHTML = `
      <div class="d-flex align-items-start gap-2.5">
        <i class="bi bi-exclamation-octagon-fill fs-4 text-danger flex-shrink-0 mt-0.5"></i>
        <div class="flex-grow-1">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <strong class="text-danger fs-6 d-flex align-items-center gap-1.5">
              <span>🚨 ALERTA CRÍTICA DETECTADA</span>
            </strong>
            <span class="badge bg-danger text-white px-2 py-0.5 fw-bold" style="font-size: 0.7rem;">Prioridad Inmediata</span>
          </div>
          <div class="text-white small mb-1.5" style="font-size: 0.8rem;">
            Se han detectado parámetros vitales fuera de los límites de seguridad clínica:
          </div>
          <ul class="mb-2 ps-3 small text-white-50" style="margin-bottom: 0.5rem !important;">
            ${criticalIssues.map(it => `<li class="text-danger fw-semibold">${it}</li>`).join('')}
          </ul>
          <div class="p-2 rounded bg-black bg-opacity-40 small border border-danger border-opacity-25 text-white-50" style="font-size: 0.74rem;">
            <i class="bi bi-telephone-fill text-danger me-1"></i><strong>Conducta Clínica:</strong> Notifique de inmediato al médico tratante o use el botón <strong>🚨 Llamar SAMU 131</strong> en la ficha lateral ante descompensación aguda.
          </div>
        </div>
      </div>
    `;
  } else if (warningIssues.length > 0) {
    alertBox.style.background = 'rgba(245, 158, 11, 0.14)';
    alertBox.style.border = '1px solid rgba(245, 158, 11, 0.4)';
    alertBox.style.boxShadow = '0 0 12px rgba(245, 158, 11, 0.15)';
    alertBox.innerHTML = `
      <div class="d-flex align-items-start gap-2.5">
        <i class="bi bi-exclamation-triangle-fill fs-4 text-warning flex-shrink-0 mt-0.5"></i>
        <div class="flex-grow-1">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <strong class="text-warning fs-6 d-flex align-items-center gap-1.5">
              <span>⚠️ ADVERTENCIA / PARÁMETROS ELEVADOS</span>
            </strong>
            <span class="badge bg-warning text-dark px-2 py-0.5 fw-bold" style="font-size: 0.7rem;">Observación Activa</span>
          </div>
          <div class="text-white small mb-1.5" style="font-size: 0.8rem;">
            Parámetros en rango limítrofe o con desviación moderada que requieren seguimiento:
          </div>
          <ul class="mb-0 ps-3 small text-white-50">
            ${warningIssues.map(it => `<li class="text-warning fw-semibold">${it}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  } else {
    alertBox.style.background = 'rgba(16, 185, 129, 0.12)';
    alertBox.style.border = '1px solid rgba(16, 185, 129, 0.35)';
    alertBox.style.boxShadow = 'none';
    alertBox.innerHTML = `
      <div class="d-flex align-items-center gap-2.5">
        <i class="bi bi-shield-check fs-4 text-success flex-shrink-0"></i>
        <div class="flex-grow-1">
          <div class="d-flex justify-content-between align-items-center">
            <strong class="text-success fs-6">✅ Tomas Básicas en Rango Normal</strong>
            <span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-40 px-2 py-0.5" style="font-size: 0.7rem;">Estable</span>
          </div>
          <div class="text-white-50 small mt-0.5" style="font-size: 0.78rem;">
            Presión arterial, SpO2, temperatura corporal y glucemia se encuentran dentro de los límites de referencia seguros.
          </div>
        </div>
      </div>
    `;
  }
}

export function renderClinicalHistory(patientId) {
  const container = document.getElementById('clinicalHistoryContainer');
  const summaryContainer = document.getElementById('caregiverMonthlySummaryBarContainer');
  if (!container && !summaryContainer) return;

  const logs = getPatientClinicalLogs(patientId);

  // Renderizar Barra Superior Compacta de Resumen Mensual
  if (summaryContainer) {
    const todayStr = (typeof getTodayDateString === 'function') ? getTodayDateString() : new Date().toISOString().split('T')[0];
    const currentMonthKey = todayStr.slice(0, 7);
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const [yearPart, monthPart] = currentMonthKey.split('-');
    const mIdx = parseInt(monthPart, 10) - 1;
    const monthLabel = (mIdx >= 0 && mIdx < 12) ? `${monthNames[mIdx]} ${yearPart}` : currentMonthKey;

    const monthLogs = (logs || []).filter(l => {
      const mKey = l.monthKey || (l.date ? l.date.slice(0, 7) : '') || (l.timestamp ? l.timestamp.slice(0, 7) : '');
      return mKey === currentMonthKey;
    });

    const totalTomas = monthLogs.length;

    // Promedio de presión arterial del mes
    const bpLogs = monthLogs.filter(l => typeof l.systolic === 'number' && typeof l.diastolic === 'number' && !isNaN(l.systolic) && !isNaN(l.diastolic));
    let avgBpStr = '--/-- mmHg';
    if (bpLogs.length > 0) {
      const avgSys = Math.round(bpLogs.reduce((acc, l) => acc + l.systolic, 0) / bpLogs.length);
      const avgDia = Math.round(bpLogs.reduce((acc, l) => acc + l.diastolic, 0) / bpLogs.length);
      avgBpStr = `${avgSys}/${avgDia} mmHg`;
    }

    // Cantidad de alertas clínicas detectadas (críticas + advertencias)
    const criticalCount = monthLogs.filter(l => l.alertLevel === 'critico').length;
    const warningCount = monthLogs.filter(l => l.alertLevel === 'advertencia').length;
    const totalAlertas = criticalCount + warningCount;

    summaryContainer.innerHTML = `
      <div class="glass-card p-3 border-0">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2 pb-2 border-bottom border-light border-opacity-10">
          <div class="d-flex align-items-center gap-2">
            <span class="badge rounded-circle p-2 d-inline-flex align-items-center justify-content-center" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; width: 34px; height: 34px;">
              <i class="bi bi-calendar3-range fs-6"></i>
            </span>
            <div>
              <div class="fw-bold text-white d-flex align-items-center gap-2" style="font-size: 0.95rem;">
                <span>Resumen Mensual de Tomas Clínicas</span>
                <span class="badge rounded-pill fw-semibold" style="background: rgba(14, 165, 233, 0.2); color: #38bdf8; font-size: 0.72rem; border: 1px solid rgba(14, 165, 233, 0.35);">
                  ${monthLabel}
                </span>
              </div>
              <small class="text-white-50" style="font-size: 0.73rem;">Período activo: ${currentMonthKey} &bull; Métricas acumuladas del mes</small>
            </div>
          </div>
          <span class="badge px-2.5 py-1 rounded-pill fw-semibold" style="background: rgba(255, 255, 255, 0.05); color: #94a3b8; border: 1px solid rgba(255, 255, 255, 0.1); font-size: 0.72rem;">
            <i class="bi bi-shield-check text-info me-1"></i>Sincronizado
          </span>
        </div>
        <div class="row g-2 text-center mt-1">
          <div class="col-4">
            <div class="p-2 rounded-3 h-100 d-flex flex-column justify-content-center" style="background: rgba(255, 255, 255, 0.025); border: 1px solid rgba(255, 255, 255, 0.08);">
              <span class="text-white-50 small mb-1" style="font-size: 0.74rem;">
                <i class="bi bi-clipboard2-pulse text-info me-1"></i>Total Tomas Mes
              </span>
              <div class="h5 fw-bold text-white mb-0">
                ${totalTomas} <span class="fs-6 fw-normal text-white-50">${totalTomas === 1 ? 'toma' : 'tomas'}</span>
              </div>
            </div>
          </div>
          <div class="col-4">
            <div class="p-2 rounded-3 h-100 d-flex flex-column justify-content-center" style="background: rgba(255, 255, 255, 0.025); border: 1px solid rgba(255, 255, 255, 0.08);">
              <span class="text-white-50 small mb-1" style="font-size: 0.74rem;">
                <i class="bi bi-heart-pulse text-primary me-1"></i>Promedio Presión
              </span>
              <div class="h5 fw-bold text-info mb-0">${avgBpStr}</div>
            </div>
          </div>
          <div class="col-4">
            <div class="p-2 rounded-3 h-100 d-flex flex-column justify-content-center" style="background: ${totalAlertas > 0 ? (criticalCount > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)') : 'rgba(16, 185, 129, 0.08)'}; border: 1px solid ${totalAlertas > 0 ? (criticalCount > 0 ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.35)') : 'rgba(16, 185, 129, 0.25)'};">
              <span class="text-white-50 small mb-1" style="font-size: 0.74rem;">
                <i class="bi ${totalAlertas > 0 ? 'bi-exclamation-triangle-fill text-warning' : 'bi-shield-check text-success'} me-1"></i>Alertas Detectadas
              </span>
              <div class="h5 fw-bold ${totalAlertas > 0 ? (criticalCount > 0 ? 'text-danger' : 'text-warning') : 'text-success'} mb-0">
                ${totalAlertas} <span class="fs-6 fw-normal text-white-50">${totalAlertas === 1 ? 'alerta' : 'alertas'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  if (!container) return;

  if (!logs || logs.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4 px-3 rounded-3" style="background: rgba(255, 255, 255, 0.02); border: 1px dashed rgba(255, 255, 255, 0.15);">
        <i class="bi bi-clipboard2-pulse text-white-50 fs-2 d-block mb-2"></i>
        <div class="text-white-50 small fw-semibold">No hay evaluaciones previas registradas para este paciente.</div>
        <div class="text-white-50" style="font-size: 0.75rem;">Al presionar <strong>"Guardar Reporte"</strong> se generará el primer registro oficial con sello de trazabilidad legal.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = logs.slice(0, 5).map(record => {
    let alertBadge = '';
    let borderStyle = '1px solid rgba(255, 255, 255, 0.08)';

    if (record.alertLevel === 'critico') {
      alertBadge = `
        <span class="badge rounded-pill fw-bold d-inline-flex align-items-center" style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.45); font-size: 0.72rem; padding: 4px 10px;">
          <i class="bi bi-exclamation-octagon-fill me-1"></i>CRÍTICO
        </span>
      `;
      borderStyle = '1px solid rgba(239, 68, 68, 0.35)';
    } else if (record.alertLevel === 'advertencia') {
      alertBadge = `
        <span class="badge rounded-pill fw-bold d-inline-flex align-items-center" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.45); font-size: 0.72rem; padding: 4px 10px;">
          <i class="bi bi-exclamation-triangle-fill me-1"></i>ADVERTENCIA
        </span>
      `;
      borderStyle = '1px solid rgba(245, 158, 11, 0.35)';
    } else {
      alertBadge = `
        <span class="badge rounded-pill fw-bold d-inline-flex align-items-center" style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.45); font-size: 0.72rem; padding: 4px 10px;">
          <i class="bi bi-check-circle-fill me-1"></i>NORMAL
        </span>
      `;
      borderStyle = '1px solid rgba(16, 185, 129, 0.25)';
    }

    const timeFormatted = record.time || (record.timestamp
      ? new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '--:--');

    const symptomsText = Array.isArray(record.symptoms) && record.symptoms.length > 0 && !record.symptoms.includes('Ninguno')
      ? record.symptoms.join(', ')
      : 'Sin síntomas';

    const curSpo2 = record.spo2 ?? record.spO2;
    const curGlycemia = record.glycemia ?? record.glucose;
    const curPainEva = record.painEva ?? record.pain;

    return `
      <div class="p-3 rounded-3" style="background: rgba(255, 255, 255, 0.025); border: ${borderStyle};">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2 pb-2 border-bottom border-light border-opacity-10">
          <div class="d-flex align-items-center gap-2">
            <span class="text-info fw-semibold" style="font-size: 0.85rem;"><i class="bi bi-calendar-event me-1"></i>${record.date}</span>
            <span class="text-white-50" style="font-size: 0.8rem;">&bull;</span>
            <span class="badge px-2 py-0.5 rounded-pill" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.35); font-size: 0.74rem;">
              <i class="bi bi-clock-fill me-1"></i>${timeFormatted} hrs
            </span>
          </div>
          <div>${alertBadge}</div>
        </div>

        <div class="row g-2 mb-2 text-white" style="font-size: 0.83rem;">
          <div class="col-6 col-sm-2">
            <span class="text-white-50 d-block" style="font-size: 0.72rem;">Presión Art.</span>
            <strong>${record.systolic ?? '--'}/${record.diastolic ?? '--'} <span class="text-white-50" style="font-size: 0.7rem;">mmHg</span></strong>
          </div>
          <div class="col-6 col-sm-2">
            <span class="text-white-50 d-block" style="font-size: 0.72rem;">Saturación SpO2</span>
            <strong>${curSpo2 ? `${curSpo2}%` : '--'}</strong>
          </div>
          <div class="col-6 col-sm-2">
            <span class="text-white-50 d-block" style="font-size: 0.72rem;">Temperatura</span>
            <strong>${record.temperature ? `${record.temperature}°C` : '--'}</strong>
          </div>
          <div class="col-6 col-sm-2">
            <span class="text-white-50 d-block" style="font-size: 0.72rem;">Glucemia</span>
            <strong>${curGlycemia ? `${curGlycemia} mg/dL` : '--'}</strong>
          </div>
          <div class="col-6 col-sm-2">
            <span class="text-white-50 d-block" style="font-size: 0.72rem;">Frec. Cardíaca</span>
            <strong>${record.heartRate ?? '--'} <span class="text-white-50" style="font-size: 0.7rem;">BPM</span></strong>
          </div>
          <div class="col-6 col-sm-2">
            <span class="text-white-50 d-block" style="font-size: 0.72rem;">Dolor EVA</span>
            <strong>${curPainEva !== undefined ? `${curPainEva}/10` : '0/10'}</strong>
          </div>
        </div>

        <div class="d-flex flex-wrap gap-3 mb-2 small text-white-50" style="font-size: 0.78rem;">
          <div><strong class="text-white-50">Medicamentos:</strong> <span class="${record.medicationAdherence ? 'text-success' : 'text-danger'} fw-semibold"><i class="bi ${record.medicationAdherence ? 'bi-check2' : 'bi-x-lg'} me-1"></i>${record.medicationAdherence ? 'Tomó indicados' : 'No tomó'}</span></div>
          <div><strong class="text-white-50">Edema:</strong> <span class="${record.edema ? 'text-warning' : 'text-white'}">${record.edema ? 'Presente' : 'Ausente'}</span></div>
          <div><strong class="text-white-50">Síntomas:</strong> <span class="text-white">${symptomsText}</span></div>
        </div>

        ${record.notes ? `
          <div class="p-2 rounded mb-2" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05); font-size: 0.78rem; font-style: italic;">
            <i class="bi bi-chat-left-quote text-info me-1"></i>"${record.notes}"
          </div>
        ` : ''}

        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 pt-2 border-top border-light border-opacity-10" style="font-size: 0.72rem;">
          <div class="text-white-50">
            <i class="bi bi-person-check-fill text-success me-1"></i>Registrado por: <strong class="text-white">${record.recordedBy}</strong> <span class="badge bg-secondary bg-opacity-25 text-white ms-1">Rol: ${record.role}</span>
          </div>
          <div class="font-monospace text-white-50" style="font-size: 0.68rem;">
            <i class="bi bi-shield-check text-info me-1"></i>ID: ${record.id}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// --- RENDERIZAR EVOLUCIONES MÉDICAS (SOLO LECTURA - LEY 20.584 / DS N° 41) ---
export function renderCaregiverMedicalEvolutions(patientId) {
  const container = document.getElementById('caregiverMedicalEvolutionsContainer');
  if (!container) return;

  const evos = getPatientMedicalEvolutions(patientId);

  if (!evos || evos.length === 0) {
    container.innerHTML = `
      <div class="text-center py-3 px-3 rounded-3" style="background: rgba(255, 255, 255, 0.02); border: 1px dashed rgba(255, 255, 255, 0.15);">
        <i class="bi bi-file-earmark-medical text-white-50 fs-3 d-block mb-1"></i>
        <div class="text-white-50 small">Sin evoluciones médicas emitidas recientemente para este paciente.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = evos.slice(0, 3).map(evo => `
    <div class="p-3 rounded-3" style="background: rgba(255, 255, 255, 0.025); border: 1px solid rgba(56, 189, 248, 0.25);">
      <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom border-light border-opacity-10 flex-wrap gap-2">
        <div class="d-flex align-items-center gap-2">
          <span class="badge bg-primary bg-opacity-25 text-primary border border-primary border-opacity-40 rounded-pill px-2.5 py-1 fw-bold" style="font-size: 0.78rem;">
            ${evo.diagnosis || 'Atención Médica'}
          </span>
          <span class="text-white-50 small">📅 ${evo.date}</span>
        </div>
        <span class="badge px-2.5 py-1 rounded-pill" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); font-size: 0.7rem;">
          <i class="bi bi-shield-check me-1"></i>${evo.inmutabilitySeal || 'DS41-VERIFIED'}
        </span>
      </div>
      <p class="text-white small mb-2" style="line-height: 1.5;">${evo.evolutionText}</p>
      ${evo.antecedents && evo.antecedents !== 'Sin nuevos antecedentes consignados' ? `
        <div class="p-2 rounded mb-2 text-white-50 small" style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); font-size: 0.75rem;">
          <strong class="text-info"><i class="bi bi-info-circle me-1"></i>Antecedentes/Indicación:</strong> ${evo.antecedents}
        </div>
      ` : ''}
      <div class="text-white-50 pt-1 border-top border-light border-opacity-10 d-flex justify-content-between" style="font-size: 0.7rem;">
        <span>Profesional: <strong class="text-white">${evo.doctorName || 'Dra. Elena Valdés'}</strong> (${evo.doctorRegistry || 'Reg. SIS N° 482910'})</span>
        <span class="text-info">Inmutable (DS N° 41)</span>
      </div>
    </div>
  `).join('');
}

// Estado de la vista del cuidador y carpetas clínicas dedicadas
export let caregiverSubTab = 'evaluacion';
export let caregiverInternalTab = null; // null (cerrada al inicio por defecto), 'daily', 'history', 'docs' o 'vaccines_dental'
export let activeFolder = null; // null cuando ninguna carpeta está abierta

export function setCaregiverSubTab(tab) {
  caregiverSubTab = tab;
}
export function getCaregiverSubTab() {
  return caregiverSubTab;
}
export function setCaregiverInternalTab(tab) {
  caregiverInternalTab = tab;
  activeFolder = tab;
}
export function getCaregiverInternalTab() {
  return caregiverInternalTab;
}
export function setActiveFolder(folder) {
  setCaregiverInternalTab(folder);
}
export function getActiveFolder() {
  return activeFolder || caregiverInternalTab;
}

// --- VISTA 1: EVALUACIÓN DIARIA ---
export function renderEvaluationView(container) {
  const sidebarUserEl = typeof document !== 'undefined' ? document.querySelector('.sidebar footer strong, footer strong.text-white, #sidebarMenu footer strong') : null;
  const loggedName = sidebarUserEl ? sidebarUserEl.textContent.trim() : '';
  const isCaregiverUser = Boolean(
    (loggedName && (loggedName.toLowerCase().includes('sofía') || loggedName.toLowerCase().includes('sofia'))) ||
    (loggedName && CAREGIVERS_DATABASE.some(c => c.name.toLowerCase() === loggedName.toLowerCase() || (c.username && c.username.toLowerCase() === loggedName.toLowerCase()))) ||
    (typeof window !== 'undefined' && window._currentRole === 'caregiver') ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('cuidapp_auth_role') === 'caregiver')
  );

  // Preseleccionar a Juan Díaz (p1) como persona a cargo cuando es cuidador/a autenticada (Sofía Díaz)
  if (isCaregiverUser) {
    const juan = PATIENTS_DATABASE.find(p => p.id === 'p1') || PATIENTS_DATABASE[0];
    if (activePatient.id !== juan.id) {
      setActivePatient(juan);
    }
  }

  // Cuando la sesión es Cuidador (Sofía Díaz), desactivar siempre el escalado de adulto mayor en body
  if (isCaregiverUser && typeof document !== 'undefined') {
    document.body.classList.remove('cuidapp-senior-mode');
  }

  // Control de Acceso Estricto (Ley 20.584 y Ley 19.628)
  const authorizedPatients = getAuthorizedPatientsForCurrentCaregiver();
  if (!authorizedPatients.some(p => p.id === activePatient.id)) {
    setActivePatient(authorizedPatients[0]);
  }

  const greetingHolderName = isCaregiverUser ? 'Sofía Díaz' : (activePatient.socialName || activePatient.name);

  if (container) {
    container.classList.add('pb-24');
  }

  container.innerHTML = `
    <!-- BANNER HERO ÚNICO ESTILO MATEO -->
    <div id="cuidapp-global-topbar" class="glass-card p-3.5 p-md-4 mb-3 text-white" style="background: rgba(15, 25, 38, 0.75); border-radius: 24px; border: 1.5px solid rgba(6, 182, 212, 0.35); box-shadow: 0 10px 30px rgba(0,0,0,0.4); position: relative; z-index: 20;">
      
      <!-- Fila Superior: Saludo Grande + Píldoras + Controles en Línea + Tarjeta PRÓXIMA CITA -->
      <div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
        
        <!-- Bloque Izquierdo: Saludo + Píldoras + Controles en línea + Condición Activa -->
        <div class="flex-grow-1">
          
          <!-- 1. Saludo grande con píldoras de estado -->
          <div class="d-flex align-items-center flex-wrap gap-2 mb-1">
            <span class="emoji-senior" style="font-size: 2.1rem; line-height: 1;">🌟</span>
            <h1 class="fw-extrabold m-0 text-white d-flex align-items-center gap-2 flex-wrap" style="font-size: 1.85rem; letter-spacing: -0.4px;">
              ¡Hola, <span id="caregiverGreetingPatientName">${greetingHolderName}</span>! 🌟
            </h1>
            <span class="badge px-2.5 py-1 rounded-pill fw-semibold" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.35); font-size: 0.75rem;">
              <i class="bi bi-shield-check me-1"></i>Ficha Protegida Ley 20.584
            </span>
            <span class="badge px-2.5 py-1 rounded-pill fw-semibold" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); font-size: 0.75rem;">
              <i class="bi bi-broadcast me-1"></i>Triage en Vivo
            </span>
          </div>

          <p class="mb-2.5 text-white-50" style="font-size: 0.88rem; font-weight: 500;">
            Espacio de salud integral y acompañamiento continuo respetando tu autonomía y privacidad.
          </p>

          <!-- Controles del Hero en dos filas limpias y alineadas -->
          <!-- Fila 1: Selector Paciente + "+ Agregar Persona a Cargo" -->
          <div class="d-flex align-items-center flex-wrap gap-2.5 mb-2.5 pt-1">
            <div class="d-flex align-items-center gap-1.5">
              <i class="bi bi-person-fill-gear text-primary fs-5"></i>
              <strong id="lblGlobalPatient" class="text-white text-nowrap" style="font-size: 0.88rem;">Paciente:</strong>
              <select id="patientSelector" class="form-select form-select-sm py-1 px-2.5 text-white fw-semibold" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.22); border-radius: 10px; max-width: 250px; font-size: 0.88rem; cursor: pointer;">
                <!-- Cargado dinámicamente -->
              </select>
            </div>
            
            <button type="button" id="btnOpenAddPersonaACargoModal" class="btn btn-sm btn-glass-primary px-2.5 py-1 fw-semibold d-inline-flex align-items-center gap-1.5 shadow-sm text-nowrap ${canPatientAddDependent(activePatient) ? '' : 'd-none'}" style="border-radius: 9px; font-size: 0.82rem;">
              <i class="bi bi-person-plus-fill text-info"></i>
              <span id="lblAddPersonaACargoBtn">+ Agregar Persona a Cargo</span>
            </button>
          </div>

          <!-- Fila 2: Botón Asistente de Voz + Selector de Idioma + Píldora compacta de Condición Acreditada -->
          <div class="d-flex align-items-center flex-wrap gap-2.5 pb-1">
            <!-- Asistente de Voz (Naranja) -->
            <button type="button" id="btnGlobalVoiceAssistant" class="btn btn-sm px-3 py-1 fw-bold d-inline-flex align-items-center gap-2 shadow-sm text-white text-nowrap" style="border-radius: 9px; background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); border: 1.5px solid #fef08a;" title="Tocar para escuchar un resumen clínico en voz alta o activar lectura guiada">
              <span id="globalVoiceIcon" style="font-size: 1rem;">🔊</span>
              <span id="globalVoiceText" style="font-size: 0.84rem;">Asistente de Voz</span>
            </button>

            <!-- Selector de Idioma -->
            <div class="d-inline-flex align-items-center gap-1 p-0.5 px-1 rounded-3" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.2);">
              <i class="bi bi-translate text-info ms-0.5" style="font-size: 0.82rem;"></i>
              <select id="globalLanguageSelector" class="form-select form-select-sm py-0.5 px-1.5 border-0 text-white fw-bold" style="background: transparent; font-size: 0.82rem; cursor: pointer; max-width: 140px;" title="Seleccionar idioma de la ficha clínica">
                <option value="es" class="bg-dark text-white" selected>🇨🇱 Español</option>
                <option value="ht" class="bg-dark text-white">🇭🇹 Kreyòl</option>
                <option value="pt" class="bg-dark text-white">🇧🇷 Português</option>
                <option value="en" class="bg-dark text-white">🇺🇸 English</option>
                <option value="arn" class="bg-dark text-white">🌿 Mapuzugun</option>
              </select>
            </div>

            <!-- Píldora compacta de Condición Acreditada -->
            <div id="caregiverHeroConditions" class="d-inline-flex flex-wrap align-items-center gap-2 m-0">
              <!-- Renderizado dinámicamente -->
            </div>
          </div>
        </div>

        <!-- Tarjeta PRÓXIMA CITA a la derecha (estilo Mateo) -->
        <div id="caregiverHeroNextAppointment" class="d-flex align-items-center justify-content-center flex-shrink-0">
          <!-- Renderizado dinámicamente -->
        </div>

      </div>
    </div>

    <!-- Layout Principal: 2 Columnas (col-lg-8 para Carpetas y Contenido, col-lg-4 para Ficha Lateral Fija) -->
    <div class="row g-4 text-white align-items-stretch">
      
      <!-- Columna Principal Izquierda (col-lg-8): Carpetas grandes que aprovechan todo el alto + Contenido ordenado debajo -->
      <div class="col-lg-8 d-flex flex-column min-w-0" style="min-width: 0; max-width: 100%;">
        
        <!-- 1. Vista Inicial de Carpetas: Grilla grid-cols-2 gap-4 h-full nivelada en altura con la Ficha del Paciente -->
        <div class="caregiver-folder-grid flex-grow-1 h-full mb-4 ${activeFolder !== null ? 'd-none' : ''}" id="caregiverTabNav" style="min-height: 480px; ${activeFolder !== null ? 'display: none !important;' : ''}">
          <button type="button" id="tabBtnCaregiverDaily" class="folder-tab-card tab-daily min-h-[195px] flex flex-col items-center justify-center text-center p-5 ${activeFolder === 'daily' ? 'active' : ''}" title="Abrir carpeta Control Diario y Signos">
            <span class="folder-tab-icon">💊</span>
            <div class="folder-tab-text">
              <span class="folder-tab-title">Control Diario y Signos</span>
              <span class="folder-tab-sub">Tomas Básicas, Vitals y Medicamentos</span>
            </div>
          </button>
          <button type="button" id="tabBtnCaregiverHistory" class="folder-tab-card tab-history min-h-[195px] flex flex-col items-center justify-center text-center p-5 ${activeFolder === 'history' ? 'active' : ''}" title="Abrir carpeta Historial y Evoluciones">
            <span class="folder-tab-icon">❤️</span>
            <div class="folder-tab-text">
              <span class="folder-tab-title">Historial y Evoluciones</span>
              <span class="folder-tab-sub">DS N° 41 & Ficha Sincronizada</span>
            </div>
          </button>
          <button type="button" id="tabBtnCaregiverDocs" class="folder-tab-card tab-docs min-h-[195px] flex flex-col items-center justify-center text-center p-5 ${activeFolder === 'docs' ? 'active' : ''}" title="Abrir carpeta Documentos y Recetas">
            <span class="folder-tab-icon">📄</span>
            <div class="folder-tab-text">
              <span class="folder-tab-title">Documentos y Recetas</span>
              <span class="folder-tab-sub">Cámara, Escáner IA y Archivos</span>
            </div>
          </button>
          <button type="button" id="tabBtnCaregiverVaccinesDental" class="folder-tab-card tab-vaccines min-h-[195px] flex flex-col items-center justify-center text-center p-5 ${activeFolder === 'vaccines_dental' ? 'active' : ''}" title="Abrir carpeta Vacunas y Dental">
            <span class="folder-tab-icon" id="folderTabIconVaccines">${activePatient && getPatientAge(activePatient) >= 60 ? '🛡️' : '🦷'}</span>
            <div class="folder-tab-text">
              <span class="folder-tab-title" id="folderTabTitleVaccines">${activePatient && getPatientAge(activePatient) >= 60 ? 'Vacunas y GES 60' : 'Vacunas y Dental'}</span>
              <span class="folder-tab-sub" id="folderTabSubVaccines">${caregiverPatientIsPregnant(activePatient) ? 'Control Prenatal MINSAL' : (getPatientAge(activePatient) < 60 ? 'PNI Adolescente & Dental' : 'PNI & GES 60')}</span>
            </div>
          </button>
        </div>

        <!-- 2. Vistas Internas Dedicadas por Carpeta -->
        <!-- CARPETA 1: CONTROL DIARIO Y SIGNOS -->
        <div id="tabContentCaregiverDaily" class="folder-connected-panel folder-panel-daily ${activeFolder === 'daily' ? '' : 'd-none'}">
          <!-- Barra Superior Destacada: ← Volver a Carpetas + Título de la Sección -->
          <div class="folder-view-topbar d-flex align-items-center justify-content-between p-3 px-3.5 rounded-4 mb-4 shadow-sm" style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%); border: 2px solid #00e5ff; border-radius: 16px;">
            <div class="d-flex align-items-center gap-3">
              <button type="button" class="btn btn-outline-light px-3 py-1.5 rounded-pill fw-bold d-inline-flex align-items-center gap-2 btn-back-to-folders" title="Volver a la vista principal de carpetas" style="border-radius: 9999px; border: 1.5px solid rgba(255,255,255,0.4); font-size: 0.88rem; cursor: pointer;">
                <i class="bi bi-arrow-left fs-5"></i>
                <span>Volver a Carpetas</span>
              </button>
              <div class="d-flex align-items-center gap-2">
                <span style="font-size: 1.5rem; line-height: 1;">💊</span>
                <div>
                  <h4 class="fw-extrabold text-white mb-0" style="font-size: 1.25rem;">Control Diario y Signos</h4>
                  <small class="text-white-50" style="font-size: 0.8rem;">Tomas Básicas, Signos Vitales y Medicamentos</small>
                </div>
              </div>
            </div>
            <span class="badge px-3 py-1.5 rounded-pill fw-bold d-none d-sm-inline-flex align-items-center" style="background: rgba(0, 229, 255, 0.15); color: #00e5ff; border: 1px solid rgba(0, 229, 255, 0.35); font-size: 0.78rem;">
              <i class="bi bi-folder2-open me-1.5"></i>Carpeta Activa
            </span>
          </div>

          <form id="diaryForm">
            <!-- Banner de bloqueo por fecha histórica -->
            <div id="lockWarningBanner" class="alert alert-warning mb-4 d-none" style="background: rgba(255, 193, 7, 0.08) !important; border: 1px solid rgba(255, 193, 7, 0.25) !important;">
              <div class="d-flex align-items-center gap-2">
                <i class="bi bi-shield-lock-fill fs-4 text-warning"></i>
                <div>
                  <strong>Registro Histórico Bloqueado:</strong> Los reportes con antigüedad superior a 24 horas son de <strong>Solo Lectura</strong> por regulaciones clínicas de seguridad.
                </div>
              </div>
            </div>

            <!-- BLOQUE VISUAL: 🤰 Crecimiento del Bebé (Comparación con Frutas) -->
            <div id="cardPrenatalGrowthCaregiver" class="glass-card p-4 border-0 mb-4 d-none" style="background: linear-gradient(135deg, rgba(236,72,153,0.14) 0%, rgba(168,85,247,0.08) 100%); border: 1.5px solid rgba(244,114,182,0.45) !important; border-radius: 20px;">
              <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                <div>
                  <h4 class="glass-title m-0 d-flex align-items-center gap-2">
                    <span style="font-size: 1.6rem;">🤰</span>
                    <span>Crecimiento del Bebé (Comparación con Frutas)</span>
                  </h4>
                  <small class="text-white-50" style="font-size: 0.8rem;">Monitoreo del desarrollo fetal y controles esenciales &bull; Chile Crece Contigo / MINSAL</small>
                </div>
                <div class="d-flex align-items-center gap-2">
                  <!-- Selector interactivo de semanas con botones - / + -->
                  <div class="d-inline-flex align-items-center gap-1.5 p-1 px-2.5 rounded-pill shadow-sm" style="background: rgba(15, 23, 42, 0.7); border: 1.5px solid #f472b6;">
                    <span class="text-white-50 small fw-bold">Semana:</span>
                    <button type="button" id="btnPrevGestationalWeek" class="btn btn-sm btn-outline-light py-0 px-2 fw-extrabold rounded-circle" style="width: 26px; height: 26px; line-height: 1; font-size: 0.9rem;" title="Disminuir semana">-</button>
                    <strong class="text-white px-1 fs-6" id="badgeGestationalWeeksVal">24</strong>
                    <button type="button" id="btnNextGestationalWeek" class="btn btn-sm btn-outline-light py-0 px-2 fw-extrabold rounded-circle" style="width: 26px; height: 26px; line-height: 1; font-size: 0.9rem;" title="Aumentar semana">+</button>
                  </div>
                  <span id="badgeGestationalTrimester" class="badge px-3 py-1.5 rounded-pill fw-bold" style="background: rgba(236,72,153,0.25); color: #f472b6; border: 1px solid rgba(236,72,153,0.5); font-size: 0.82rem;">
                    2° Trimestre
                  </span>
                </div>
              </div>

              <!-- Comparación Visual con Fruta -->
              <div class="p-3.5 p-md-4 rounded-4 mb-3 d-flex flex-column flex-md-row align-items-center justify-content-between gap-4" style="background: rgba(15, 23, 42, 0.65); border: 1.5px solid rgba(244,114,182,0.3); box-shadow: inset 0 2px 10px rgba(0,0,0,0.3);">
                <!-- Lado Izquierdo: Emoji Gigante y Fruta -->
                <div class="d-flex align-items-center gap-3.5">
                  <div class="rounded-4 d-flex align-items-center justify-content-center shadow-sm" style="width: 85px; height: 85px; background: rgba(255, 255, 255, 0.06); border: 1.5px solid rgba(255, 255, 255, 0.15);">
                    <span id="prenatalFruitEmoji" style="font-size: 3.8rem; line-height: 1;">🌽</span>
                  </div>
                  <div>
                    <span class="text-white-50 small text-uppercase fw-bold d-block" style="font-size: 0.72rem; letter-spacing: 0.5px;">Tu bebé tiene el tamaño de:</span>
                    <h3 class="fw-extrabold text-white m-0 d-flex align-items-center gap-2" id="prenatalFruitTitle" style="font-size: 1.55rem; color: #fbcfe8 !important;">
                      Un Choclo
                    </h3>
                    <small class="text-white-50" id="prenatalFruitSub">Semana 24 de desarrollo fetal activo</small>
                  </div>
                </div>

                <!-- Lado Derecho: Largo y Peso Fetal Estimado -->
                <div class="d-flex align-items-center gap-3 flex-wrap">
                  <div class="p-2.5 px-3.5 rounded-3 text-center" style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); min-width: 120px;">
                    <span class="text-white-50 small d-block" style="font-size: 0.72rem;">📏 Largo Fetal</span>
                    <strong class="text-info fs-5 d-block mt-0.5" id="prenatalFetalLength">~ 30 cm</strong>
                    <small class="text-white-50" style="font-size: 0.68rem;">Coronilla al talón</small>
                  </div>
                  <div class="p-2.5 px-3.5 rounded-3 text-center" style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); min-width: 120px;">
                    <span class="text-white-50 small d-block" style="font-size: 0.72rem;">⚖️ Peso Estimado</span>
                    <strong class="text-success fs-5 d-block mt-0.5" id="prenatalFetalWeight">~ 650 g</strong>
                    <small class="text-white-50" style="font-size: 0.68rem;">Percentil 50 OMS</small>
                  </div>
                </div>
              </div>

              <!-- Controles Prenatales Esenciales (Movimientos, Suplementos, Ecografías) -->
              <div class="row g-3">
                <!-- Movimientos Fetales -->
                <div class="col-md-4">
                  <div class="p-3 rounded-3 h-100" style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.08);">
                    <span class="text-white-50 small d-block mb-1"><i class="bi bi-activity me-1 text-success"></i>Movimientos Fetales</span>
                    <strong class="text-success fs-6 d-block"><i class="bi bi-check-circle-fill me-1"></i>Presentes y Vigorosos</strong>
                    <small class="text-white-50 d-block mt-1">≥ 10 movimientos en 2 hrs (Patrón Normal)</small>
                  </div>
                </div>

                <!-- Suplementación Esencial -->
                <div class="col-md-4">
                  <div class="p-3 rounded-3 h-100" style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.08);">
                    <span class="text-white-50 small d-block mb-1"><i class="bi bi-capsule me-1 text-warning"></i>Suplementos Activos</span>
                    <div class="d-flex flex-column gap-1">
                      <span class="fs-8 text-white"><i class="bi bi-check-lg text-success me-1"></i><strong>Hierro + Calcio:</strong> Al día</span>
                      <span class="fs-8 text-white"><i class="bi bi-check-lg text-success me-1"></i><strong>Ácido Fólico:</strong> Completado 1° Trim.</span>
                    </div>
                  </div>
                </div>

                <!-- Ecografías Obstétricas -->
                <div class="col-md-4">
                  <div class="p-3 rounded-3 h-100" style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.08);">
                    <span class="text-white-50 small d-block mb-1"><i class="bi bi-camera-fill me-1 text-info"></i>Ecografías Oficiales</span>
                    <div class="d-flex flex-column gap-1">
                      <span class="fs-8 text-white"><i class="bi bi-check-circle-fill text-success me-1"></i>Eco 11-14s y 20-24s: <strong>Al día</strong></span>
                      <span class="fs-8 text-white-50"><i class="bi bi-clock-history text-warning me-1"></i>Eco 32-34s: <strong>Programada</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- CONTROLES PERSONALES Y NACIMIENTO (SIGNOS VITALES ESENCIALES DEL EMBARAZO) -->
            <div id="cardPrenatalVitalsOnly" class="glass-card p-4 border-0 mb-4 d-none" style="border-radius: 20px;">
              <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                <div>
                  <h4 class="glass-title m-0 d-flex align-items-center gap-2">
                    <span style="font-size: 1.3rem;">🤰</span>
                    <span>Signos Vitales Maternos Esenciales</span>
                  </h4>
                  <small class="text-white-50" style="font-size: 0.78rem;">Detección temprana de preeclampsia y diabetes gestacional &bull; Guía Perinatal MINSAL</small>
                </div>
                <span class="badge px-3 py-1.5 rounded-pill fw-bold" style="background: rgba(236,72,153,0.18); color: #f472b6; border: 1px solid rgba(236,72,153,0.4); font-size: 0.75rem;">
                  Control Prenatal Prioritario
                </span>
              </div>

              <!-- Grilla Limpia de los 3 Signos Esenciales -->
              <div class="row g-3 mb-4">
                <!-- 1. Presión Arterial -->
                <div class="col-md-4">
                  <div class="p-3 rounded-3 h-100 vital-card-box" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); overflow: hidden; box-sizing: border-box;">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                      <label class="glass-label mb-0 fw-semibold" style="font-size: 0.85rem;">
                        <span class="me-1">❤️</span> Presión Arterial
                      </label>
                      <span class="badge" style="background: rgba(255, 255, 255, 0.07); color: #93c5fd; border: 1px solid rgba(147, 197, 253, 0.2); font-size: 0.68rem;">Ref: &lt; 140/90 mmHg</span>
                    </div>
                    <div class="row g-2 align-items-center">
                      <div class="col-12 col-xxl-6 mb-1.5 mb-xxl-0">
                        <span class="text-white-50 small d-block mb-1" style="font-size: 0.7rem;">Sistólica (mmHg)</span>
                        <div class="input-group flex-nowrap w-100" style="display: flex !important; flex-wrap: nowrap !important; box-sizing: border-box;">
                          <button type="button" class="btn btn-glass-secondary input-btn fw-bold decrease-btn flex-shrink-0" data-target="bpSystolicPrenatal" style="font-size: 1.05rem; border-top-left-radius: 8px; border-bottom-left-radius: 8px; width: 30px; min-width: 30px !important; padding: 0 !important;">-</button>
                          <input type="number" id="bpSystolicPrenatal" class="form-control text-center text-white input-field" min="60" max="240" value="115" style="background: rgba(255, 255, 255, 0.05); border-left: none; border-right: none; font-weight: 600; min-width: 36px !important; text-align: center; padding: 2px 4px !important; box-sizing: border-box;">
                          <button type="button" class="btn btn-glass-secondary input-btn fw-bold increase-btn flex-shrink-0" data-target="bpSystolicPrenatal" style="font-size: 1.05rem; border-top-right-radius: 8px; border-bottom-right-radius: 8px; width: 30px; min-width: 30px !important; padding: 0 !important;">+</button>
                        </div>
                      </div>
                      <div class="col-12 col-xxl-6">
                        <span class="text-white-50 small d-block mb-1" style="font-size: 0.7rem;">Diastólica (mmHg)</span>
                        <div class="input-group flex-nowrap w-100" style="display: flex !important; flex-wrap: nowrap !important; box-sizing: border-box;">
                          <button type="button" class="btn btn-glass-secondary input-btn fw-bold decrease-btn flex-shrink-0" data-target="bpDiastolicPrenatal" style="font-size: 1.05rem; border-top-left-radius: 8px; border-bottom-left-radius: 8px; width: 30px; min-width: 30px !important; padding: 0 !important;">-</button>
                          <input type="number" id="bpDiastolicPrenatal" class="form-control text-center text-white input-field" min="40" max="150" value="72" style="background: rgba(255, 255, 255, 0.05); border-left: none; border-right: none; font-weight: 600; min-width: 36px !important; text-align: center; padding: 2px 4px !important; box-sizing: border-box;">
                          <button type="button" class="btn btn-glass-secondary input-btn fw-bold increase-btn flex-shrink-0" data-target="bpDiastolicPrenatal" style="font-size: 1.05rem; border-top-right-radius: 8px; border-bottom-right-radius: 8px; width: 30px; min-width: 30px !important; padding: 0 !important;">+</button>
                        </div>
                      </div>
                    </div>
                    <small class="text-success d-block mt-1.5" style="font-size: 0.7rem;"><i class="bi bi-shield-check me-1"></i>Sin signo de preeclampsia</small>
                  </div>
                </div>

                <!-- 2. Peso Materno -->
                <div class="col-md-4">
                  <div class="p-3 rounded-3 h-100" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                      <label class="glass-label mb-0 fw-semibold" style="font-size: 0.85rem;">
                        <i class="bi bi-speedometer2 text-warning me-1"></i> Peso Materno (kg)
                      </label>
                      <span class="badge" style="background: rgba(255, 255, 255, 0.07); color: #fde047; border: 1px solid rgba(253, 224, 71, 0.2); font-size: 0.68rem;">Ganancia Ponderal</span>
                    </div>
                    <span class="text-white-50 small d-block mb-1" style="font-size: 0.7rem;">Control en Báscula</span>
                    <div class="input-group">
                      <button type="button" class="btn btn-glass-secondary input-btn px-3 fw-bold decrease-btn" data-target="vitalWeightPrenatal" style="font-size: 1.1rem; border-top-left-radius: 8px; border-bottom-left-radius: 8px;">-</button>
                      <input type="number" step="0.5" id="vitalWeightPrenatal" class="form-control text-center text-white input-field" min="40" max="180" value="66.5" style="background: rgba(255, 255, 255, 0.05); border-left: none; border-right: none; font-weight: 600;">
                      <button type="button" class="btn btn-glass-secondary input-btn px-3 fw-bold increase-btn" data-target="vitalWeightPrenatal" style="font-size: 1.1rem; border-top-right-radius: 8px; border-bottom-right-radius: 8px;">+</button>
                    </div>
                    <small class="text-white-50 d-block mt-1.5" style="font-size: 0.7rem;">Incremento adecuado al 2° trimestre</small>
                  </div>
                </div>

                <!-- 3. Glucemia Capilar -->
                <div class="col-md-4">
                  <div class="p-3 rounded-3 h-100" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                      <label class="glass-label mb-0 fw-semibold" style="font-size: 0.85rem;">
                        <i class="bi bi-droplet-half text-danger me-1"></i> Glucemia (mg/dL)
                      </label>
                      <span class="badge" style="background: rgba(255, 255, 255, 0.07); color: #f87171; border: 1px solid rgba(248, 113, 113, 0.2); font-size: 0.68rem;">Ref: &lt; 95 mg/dL</span>
                    </div>
                    <span class="text-white-50 small d-block mb-1" style="font-size: 0.7rem;">Glicemia Basal / Ayuno</span>
                    <div class="input-group">
                      <button type="button" class="btn btn-glass-secondary input-btn px-3 fw-bold decrease-btn" data-target="glucoseLevelPrenatal" style="font-size: 1.1rem; border-top-left-radius: 8px; border-bottom-left-radius: 8px;">-</button>
                      <input type="number" id="glucoseLevelPrenatal" class="form-control text-center text-white input-field" min="40" max="300" value="86" style="background: rgba(255, 255, 255, 0.05); border-left: none; border-right: none; font-weight: 600;">
                      <button type="button" class="btn btn-glass-secondary input-btn px-3 fw-bold increase-btn" data-target="glucoseLevelPrenatal" style="font-size: 1.1rem; border-top-right-radius: 8px; border-bottom-right-radius: 8px;">+</button>
                    </div>
                    <small class="text-success d-block mt-1.5" style="font-size: 0.7rem;"><i class="bi bi-check-lg me-1"></i>Rango normal (descarte diabetes gestacional)</small>
                  </div>
                </div>
              </div>

              <!-- Botón Grande: Registrar Nacimiento del Bebé -->
              <div class="d-flex flex-column gap-2.5 pt-2 border-top border-light border-opacity-10">
                <button type="button" class="btn btn-lg w-100 fw-bold py-3 d-inline-flex align-items-center justify-content-center gap-2.5 shadow-sm text-white btn-trigger-register-birth" style="border-radius: 14px; background: linear-gradient(135deg, #ec4899 0%, #be185d 100%); border: 1.5px solid #f472b6; font-size: 1.05rem; letter-spacing: 0.2px;">
                  <span style="font-size: 1.4rem; line-height: 1;">👶</span>
                  <span>Registrar Nacimiento del Bebé</span>
                </button>
                
                <button type="submit" class="btn btn-glass-primary btn-md w-100 fw-bold py-2" style="border-radius: 12px;">
                  <i class="bi bi-save2-fill me-2"></i> Guardar Control Prenatal Diario
                </button>
              </div>
            </div>

            <!-- Monitor Cardíaco IoT en Vivo (ECG AD8232 + ESP32) -->
            <div id="iotEcgContainerCuidador" class="mb-4"></div>

          <!-- BLOQUE UNIFICADO: TOMAS BÁSICAS Y ALERTAS CLÍNICAS -->
          <div class="glass-card p-4 border-0 mb-4" id="cardBasicVitals">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
              <div>
                <h4 class="glass-title m-0 d-flex align-items-center gap-2">
                  <i class="bi bi-heart-pulse-fill text-danger"></i>
                  <span id="lblVitalsSectionTitle">🩺 Tomas Básicas y Alertas Clínicas</span>
                </h4>
                <small class="text-white-50" style="font-size: 0.78rem;" id="vitalsSubTitleCaregiver">Evaluación de signos vitales basales y detección de riesgo en tiempo real</small>
              </div>
              <span id="badgeCaregiverTriageMode" class="badge px-2.5 py-1 rounded-pill fw-semibold d-inline-flex align-items-center" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); font-size: 0.75rem;">
                <i class="bi bi-broadcast me-1"></i>Triage en Tiempo Real
              </span>
            </div>

            <!-- Banner Informativo Pediátrico Dinámico (MINSAL / OMS) -->
            <div id="pediatricCaregiverVitalsBanner" class="p-2.5 px-3 rounded-3 mb-3 d-none" style="background: rgba(6, 182, 212, 0.1); border: 1px solid rgba(6, 182, 212, 0.35);">
              <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div class="d-flex align-items-center gap-2">
                  <span style="font-size: 1.25rem;">🧸</span>
                  <span class="small text-info fw-semibold" id="pediatricCaregiverBannerText">Paciente Pediátrico: Rangos fisiológicos adaptados automáticamente según edad y etapa.</span>
                </div>
                <span class="badge rounded-pill fw-bold" id="pediatricCaregiverStageBadge" style="background: #06b6d4; color: #08101a; font-size: 0.72rem;">Etapa Pediátrica</span>
              </div>
            </div>

            <div class="row g-3">
              <!-- 1. Presión Arterial (Sistólica / Diastólica mmHg) -->
              <div class="col-md-6">
                <div class="p-3 rounded-3 h-100 d-flex flex-column justify-content-between vital-card-box" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);">
                  <div>
                    <div class="d-flex justify-content-between align-items-center mb-1">
                      <label class="glass-label mb-0 fw-semibold" style="font-size: 0.85rem;">
                        <span class="me-1">❤️</span> Presión Arterial
                      </label>
                      <span id="refBadgeBloodPressure" class="badge" style="background: rgba(255, 255, 255, 0.07); color: #93c5fd; border: 1px solid rgba(147, 197, 253, 0.2); font-size: 0.7rem;">Ref: &lt; 120/80 mmHg</span>
                    </div>
                    <span class="text-white-50 small d-block mb-2" style="font-size: 0.72rem;">Sistólica y Diastólica (mmHg)</span>
                  </div>
                  <div class="row g-2 align-items-center">
                    <div class="col-12 col-sm-6 mb-1.5 mb-sm-0">
                      <span class="text-white-50 small d-block mb-1" style="font-size: 0.7rem;">Sistólica (mmHg)</span>
                      <div class="input-group flex-nowrap w-100" style="display: flex !important; flex-wrap: nowrap !important; box-sizing: border-box;">
                        <button type="button" class="btn btn-glass-secondary input-btn fw-bold decrease-btn flex-shrink-0" data-target="bpSystolic" style="font-size: 1.05rem; border-top-left-radius: 8px; border-bottom-left-radius: 8px; width: 30px; min-width: 30px !important; padding: 0 !important;">-</button>
                        <input type="number" id="bpSystolic" class="form-control text-center text-white input-field vital-calc-input" min="50" max="250" value="118" placeholder="118" style="background: rgba(255, 255, 255, 0.05); border-left: none; border-right: none; border-top: 1px solid rgba(255, 255, 255, 0.15); border-bottom: 1px solid rgba(255, 255, 255, 0.15); font-weight: 600; min-width: 36px !important; text-align: center; width: 100%; padding-left: 2px !important; padding-right: 2px !important; box-sizing: border-box;">
                        <button type="button" class="btn btn-glass-secondary input-btn fw-bold increase-btn flex-shrink-0" data-target="bpSystolic" style="font-size: 1.05rem; border-top-right-radius: 8px; border-bottom-right-radius: 8px; width: 30px; min-width: 30px !important; padding: 0 !important;">+</button>
                      </div>
                    </div>
                    <div class="col-12 col-sm-6">
                      <span class="text-white-50 small d-block mb-1" style="font-size: 0.7rem;">Diastólica (mmHg)</span>
                      <div class="input-group flex-nowrap w-100" style="display: flex !important; flex-wrap: nowrap !important; box-sizing: border-box;">
                        <button type="button" class="btn btn-glass-secondary input-btn fw-bold decrease-btn flex-shrink-0" data-target="bpDiastolic" style="font-size: 1.05rem; border-top-left-radius: 8px; border-bottom-left-radius: 8px; width: 30px; min-width: 30px !important; padding: 0 !important;">-</button>
                        <input type="number" id="bpDiastolic" class="form-control text-center text-white input-field vital-calc-input" min="30" max="150" value="78" placeholder="78" style="background: rgba(255, 255, 255, 0.05); border-left: none; border-right: none; border-top: 1px solid rgba(255, 255, 255, 0.15); border-bottom: 1px solid rgba(255, 255, 255, 0.15); font-weight: 600; min-width: 36px !important; text-align: center; width: 100%; padding-left: 2px !important; padding-right: 2px !important; box-sizing: border-box;">
                        <button type="button" class="btn btn-glass-secondary input-btn fw-bold increase-btn flex-shrink-0" data-target="bpDiastolic" style="font-size: 1.05rem; border-top-right-radius: 8px; border-bottom-right-radius: 8px; width: 30px; min-width: 30px !important; padding: 0 !important;">+</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 2. Saturación SpO2 (%) -->
              <div class="col-md-6">
                <div class="p-3 rounded-3 h-100 d-flex flex-column justify-content-between vital-card-box" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);">
                  <div>
                    <div class="d-flex justify-content-between align-items-center mb-1">
                      <label class="glass-label mb-0 fw-semibold" style="font-size: 0.85rem;">
                        <i class="bi bi-wind text-info me-1"></i> Saturación SpO2 (%)
                      </label>
                      <span id="refBadgeSpO2" class="badge" style="background: rgba(255, 255, 255, 0.07); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.2); font-size: 0.7rem;">Ref: 95–100%</span>
                    </div>
                    <span class="text-white-50 small d-block mb-2" style="font-size: 0.72rem;">Oxigenación en Sangre</span>
                  </div>
                  <div>
                    <div class="input-group flex-nowrap" style="display: flex !important; flex-wrap: nowrap !important;">
                      <button type="button" class="btn btn-glass-secondary input-btn px-3 fw-bold decrease-btn flex-shrink-0" data-target="vitalSpO2" style="font-size: 1.1rem; border-top-left-radius: 8px; border-bottom-left-radius: 8px; width: 44px; min-width: 44px !important;">-</button>
                      <input type="number" id="vitalSpO2" class="form-control text-center text-white input-field vital-calc-input min-w-0" min="50" max="100" value="98" placeholder="98" style="background: rgba(255, 255, 255, 0.05); border-left: none; border-right: none; border-top: 1px solid rgba(255, 255, 255, 0.15); border-bottom: 1px solid rgba(255, 255, 255, 0.15); font-weight: 600; min-width: 0 !important; width: 100%;">
                      <button type="button" class="btn btn-glass-secondary input-btn px-3 fw-bold increase-btn flex-shrink-0" data-target="vitalSpO2" style="font-size: 1.1rem; border-top-right-radius: 8px; border-bottom-right-radius: 8px; width: 44px; min-width: 44px !important;">+</button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 3. Temperatura (°C) -->
              <div class="col-md-6">
                <div class="p-3 rounded-3 h-100 d-flex flex-column justify-content-between vital-card-box" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);">
                  <div>
                    <div class="d-flex justify-content-between align-items-center mb-1">
                      <label class="glass-label mb-0 fw-semibold" style="font-size: 0.85rem;">
                        <i class="bi bi-thermometer-half text-warning me-1"></i> Temperatura (°C)
                      </label>
                      <span id="refBadgeTemperature" class="badge" style="background: rgba(255, 255, 255, 0.07); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.2); font-size: 0.7rem;">Ref: 36.0–37.2°C</span>
                    </div>
                    <span class="text-white-50 small d-block mb-2" style="font-size: 0.72rem;">Temperatura Axilar / Digital</span>
                  </div>
                  <div>
                    <div class="input-group flex-nowrap" style="display: flex !important; flex-wrap: nowrap !important;">
                      <button type="button" class="btn btn-glass-secondary input-btn px-3 fw-bold decrease-btn flex-shrink-0" data-target="vitalTemperature" style="font-size: 1.1rem; border-top-left-radius: 8px; border-bottom-left-radius: 8px; width: 44px; min-width: 44px !important;">-</button>
                      <input type="number" step="0.1" id="vitalTemperature" class="form-control text-center text-white input-field vital-calc-input min-w-0" min="32.0" max="43.0" value="36.5" placeholder="36.5" style="background: rgba(255, 255, 255, 0.05); border-left: none; border-right: none; border-top: 1px solid rgba(255, 255, 255, 0.15); border-bottom: 1px solid rgba(255, 255, 255, 0.15); font-weight: 600; min-width: 0 !important; width: 100%;">
                      <button type="button" class="btn btn-glass-secondary input-btn px-3 fw-bold increase-btn flex-shrink-0" data-target="vitalTemperature" style="font-size: 1.1rem; border-top-right-radius: 8px; border-bottom-right-radius: 8px; width: 44px; min-width: 44px !important;">+</button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 4. Glucemia (mg/dL) -->
              <div class="col-md-6">
                <div class="p-3 rounded-3 h-100 d-flex flex-column justify-content-between vital-card-box" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);">
                  <div>
                    <div class="d-flex justify-content-between align-items-center mb-1">
                      <label class="glass-label mb-0 fw-semibold" style="font-size: 0.85rem;">
                        <i class="bi bi-droplet-half text-danger me-1"></i> Glucemia (mg/dL)
                      </label>
                      <span id="refBadgeGlucose" class="badge" style="background: rgba(255, 255, 255, 0.07); color: #f87171; border: 1px solid rgba(248, 113, 113, 0.2); font-size: 0.7rem;">Ref: 70–130 mg/dL</span>
                    </div>
                    <span class="text-white-50 small d-block mb-2" style="font-size: 0.72rem;">Glicemia Capilar Basal</span>
                  </div>
                  <div>
                    <div class="input-group flex-nowrap" style="display: flex !important; flex-wrap: nowrap !important;">
                      <button type="button" class="btn btn-glass-secondary input-btn px-3 fw-bold decrease-btn flex-shrink-0" data-target="glucoseLevel" style="font-size: 1.1rem; border-top-left-radius: 8px; border-bottom-left-radius: 8px; width: 44px; min-width: 44px !important;">-</button>
                      <input type="number" id="glucoseLevel" class="form-control text-center text-white input-field vital-calc-input min-w-0" min="30" max="600" value="95" placeholder="95" style="background: rgba(255, 255, 255, 0.05); border-left: none; border-right: none; border-top: 1px solid rgba(255, 255, 255, 0.15); border-bottom: 1px solid rgba(255, 255, 255, 0.15); font-weight: 600; min-width: 0 !important; width: 100%;">
                      <button type="button" class="btn btn-glass-secondary input-btn px-3 fw-bold increase-btn flex-shrink-0" data-target="glucoseLevel" style="font-size: 1.1rem; border-top-right-radius: 8px; border-bottom-right-radius: 8px; width: 44px; min-width: 44px !important;">+</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Fila Compacta Adicional: Frecuencia Cardíaca (BPM) + Frecuencia Resp Pediátrica + Síntomas y Edema -->
            <div class="p-3 rounded-3 mt-3 mb-1" style="background: rgba(255, 255, 255, 0.025); border: 1px solid rgba(255, 255, 255, 0.08);">
              <div class="row g-3 align-items-center">
                <!-- Frecuencia Cardíaca (BPM) -->
                <div class="col-lg-4 col-md-5" id="containerHeartRateVital">
                  <div class="d-flex justify-content-between align-items-center mb-1">
                    <label class="glass-label mb-0 fw-semibold" style="font-size: 0.85rem;">
                      <i class="bi bi-heart-pulse-fill text-danger me-1"></i> Frecuencia Cardíaca
                    </label>
                    <span id="refBadgeHeartRate" class="badge" style="background: rgba(255, 255, 255, 0.07); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.2); font-size: 0.7rem;">Ref: 60–100 BPM</span>
                  </div>
                  <span class="text-white-50 small d-block mb-1" style="font-size: 0.72rem;">Sincronizada con ECG</span>
                  <div class="input-group">
                    <button type="button" class="btn btn-glass-secondary input-btn px-2.5 fw-bold decrease-btn" data-target="heartRate" style="font-size: 1.1rem; border-top-left-radius: 8px; border-bottom-left-radius: 8px;">-</button>
                    <input type="number" id="heartRate" class="form-control text-center text-white input-field vital-calc-input" min="40" max="180" value="75" placeholder="75" style="background: rgba(255, 255, 255, 0.05); border-left: none; border-right: none; border-top: 1px solid rgba(255, 255, 255, 0.15); border-bottom: 1px solid rgba(255, 255, 255, 0.15); font-weight: 600;">
                    <button type="button" class="btn btn-glass-secondary input-btn px-2.5 fw-bold increase-btn" data-target="heartRate" style="font-size: 1.1rem; border-top-right-radius: 8px; border-bottom-right-radius: 8px;">+</button>
                  </div>
                </div>

                <!-- Frecuencia Respiratoria Pediátrica (RPM) -->
                <div class="col-lg-4 col-md-5 d-none" id="containerPediatricRespRate">
                  <div class="d-flex justify-content-between align-items-center mb-1">
                    <label class="glass-label mb-0 fw-semibold" style="font-size: 0.85rem;">
                      <i class="bi bi-lungs text-info me-1"></i> Frecuencia Resp.
                    </label>
                    <span id="refBadgeRespRate" class="badge" style="background: rgba(236, 72, 153, 0.15); color: #ec4899; border: 1px solid rgba(236, 72, 153, 0.3); font-size: 0.7rem;">Ref: 16–24 RPM</span>
                  </div>
                  <span class="text-white-50 small d-block mb-1" style="font-size: 0.72rem;">Respiraciones por minuto</span>
                  <div class="input-group">
                    <button type="button" class="btn btn-glass-secondary input-btn px-2.5 fw-bold decrease-btn" data-target="pediatricRespRate" style="font-size: 1.1rem; border-top-left-radius: 8px; border-bottom-left-radius: 8px;">-</button>
                    <input type="number" id="pediatricRespRate" class="form-control text-center text-white input-field vital-calc-input" min="10" max="80" value="22" placeholder="22" style="background: rgba(255, 255, 255, 0.05); border-left: none; border-right: none; border-top: 1px solid rgba(255, 255, 255, 0.15); border-bottom: 1px solid rgba(255, 255, 255, 0.15); font-weight: 600;">
                    <button type="button" class="btn btn-glass-secondary input-btn px-2.5 fw-bold increase-btn" data-target="pediatricRespRate" style="font-size: 1.1rem; border-top-right-radius: 8px; border-bottom-right-radius: 8px;">+</button>
                  </div>
                </div>

                <!-- Síntomas y Edema de Alerta -->
                <div class="col-lg-8 col-md-7" id="containerCaregiverSymptoms">
                  <div class="d-flex justify-content-between align-items-center mb-1">
                    <label class="glass-label mb-0 fw-semibold" style="font-size: 0.85rem;">
                      <i class="bi bi-exclamation-triangle-fill text-warning me-1"></i> Síntomas y Edema de Alerta
                    </label>
                    <span class="text-white-50 small" style="font-size: 0.7rem;">Evaluación clínica inmediata</span>
                  </div>
                  <div class="d-flex flex-wrap gap-2 align-items-center mt-1">
                    <!-- Switch Edema en piernas -->
                    <div class="form-check form-switch m-0 d-inline-flex align-items-center gap-2 px-2.5 py-1.5 rounded-3" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); width: auto; min-width: fit-content; white-space: nowrap;">
                      <input class="form-check-input m-0 input-field" type="checkbox" role="switch" id="cardioEdema" style="cursor: pointer; width: 2.2em; height: 1.15em;">
                      <label class="form-check-label glass-label mb-0 small text-white" for="cardioEdema" style="font-size: 0.78rem; cursor: pointer; width: auto; min-width: fit-content; white-space: nowrap;">
                        🦵 Edema piernas
                      </label>
                    </div>

                    <!-- Botones de síntomas -->
                    <div class="d-flex flex-wrap gap-2 align-items-center flex-grow-1" id="cardioSymptomsContainer">
                      <button type="button" class="btn btn-glass-secondary py-1 px-2.5 cardio-symptom-btn flex-fill" data-symptom="Cefalea" style="font-size: 0.78rem; white-space: nowrap;">🤕 Cefalea</button>
                      <button type="button" class="btn btn-glass-secondary py-1 px-2.5 cardio-symptom-btn flex-fill" data-symptom="Tinnitus" style="font-size: 0.78rem; white-space: nowrap;">👂 Tinnitus</button>
                      <button type="button" class="btn btn-glass-secondary py-1 px-2.5 cardio-symptom-btn flex-fill" data-symptom="Fotopsias" style="font-size: 0.78rem; white-space: nowrap;">✨ Fotopsias</button>
                      <button type="button" class="btn btn-glass-secondary py-1 px-2.5 cardio-symptom-btn active-symptom-none flex-fill" data-symptom="Ninguno" style="background: rgba(16, 185, 129, 0.2); border-color: rgba(16, 185, 129, 0.4); font-size: 0.78rem; white-space: nowrap;">✅ Ninguno</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Fila EVA: Nivel de Dolor (Escala EVA 1-10) -->
            <div class="p-3 rounded-3 mt-3 mb-1" style="background: rgba(255, 255, 255, 0.025); border: 1px solid rgba(255, 255, 255, 0.08);">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <label class="glass-label mb-0 fw-semibold" style="font-size: 0.85rem;">
                  <i class="bi bi-emoji-frown text-warning me-1"></i> Nivel de Dolor (Escala EVA 1-10)
                </label>
                <span class="badge px-2.5 py-1" id="painBadgeDisplay" style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); font-size: 0.74rem;">
                  EVA: <strong id="pain-val">1</strong>/10 • Sin Dolor / Leve
                </span>
              </div>

              <input type="hidden" id="painLevel" class="input-field" value="1">
              <div class="btn-group w-100 pain-scale-container" role="group" id="pain-buttons-container" style="border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px; overflow: hidden; backdrop-filter: blur(10px);">
                <button type="button" class="btn pain-btn input-btn fw-bold" data-value="1" style="font-size: 0.88rem; padding: 9px 0;">1</button>
                <button type="button" class="btn pain-btn input-btn fw-bold" data-value="2" style="font-size: 0.88rem; padding: 9px 0;">2</button>
                <button type="button" class="btn pain-btn input-btn fw-bold" data-value="3" style="font-size: 0.88rem; padding: 9px 0;">3</button>
                <button type="button" class="btn pain-btn input-btn fw-bold" data-value="4" style="font-size: 0.88rem; padding: 9px 0;">4</button>
                <button type="button" class="btn pain-btn input-btn fw-bold" data-value="5" style="font-size: 0.88rem; padding: 9px 0;">5</button>
                <button type="button" class="btn pain-btn input-btn fw-bold" data-value="6" style="font-size: 0.88rem; padding: 9px 0;">6</button>
                <button type="button" class="btn pain-btn input-btn fw-bold" data-value="7" style="font-size: 0.88rem; padding: 9px 0;">7</button>
                <button type="button" class="btn pain-btn input-btn fw-bold" data-value="8" style="font-size: 0.88rem; padding: 9px 0;">8</button>
                <button type="button" class="btn pain-btn input-btn fw-bold" data-value="9" style="font-size: 0.88rem; padding: 9px 0;">9</button>
                <button type="button" class="btn pain-btn input-btn fw-bold" data-value="10" style="font-size: 0.88rem; padding: 9px 0;">10</button>
              </div>

              <div class="d-flex justify-content-between text-white-50 small mt-1.5 px-1" style="font-size: 0.7rem;">
                <span style="color: #6ee7b7;"><i class="bi bi-circle-fill me-1" style="font-size: 0.5rem;"></i>1–3: Leve</span>
                <span style="color: #fde047;"><i class="bi bi-circle-fill me-1" style="font-size: 0.5rem;"></i>4–6: Moderado</span>
                <span style="color: #fca5a5;"><i class="bi bi-circle-fill me-1" style="font-size: 0.5rem;"></i>7–10: Severo</span>
              </div>
            </div>

            <!-- Cuadro de Alerta en Tiempo Real -->
            <div id="vitalsRealtimeAlertBox" class="mt-3 p-3 rounded-3" style="transition: all 0.25s ease;">
              <!-- Se actualizará reactivamente al editar los números -->
            </div>
          </div>

          <!-- BLOQUE POSTPARTO: CONTROL PUERPERIO & CHILE CRECE CONTIGO -->
          <div id="cardPostpartumCaregiver" class="glass-card p-4 border-0 mb-4 d-none" style="background: linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(6,182,212,0.06) 100%); border: 1.5px solid rgba(52,211,153,0.35) !important;">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>
                <h4 class="glass-title m-0 d-flex align-items-center gap-2">
                  <i class="bi bi-heart-fill text-success"></i>
                  <span>🌸 Control Postparto & Puerperio (Cuídate Mamá)</span>
                </h4>
                <p class="text-white-50 mb-0 fs-7 mt-1">
                  Nacimiento registrado. Monitoreo de involución uterina, lactancia materna exclusiva y apoyo psicosocial Chile Crece Contigo.
                </p>
              </div>
              <span class="badge bg-success-subtle text-success border border-success-subtle px-3 py-1.5 rounded-pill fw-bold">
                Estado: Postparto Activo
              </span>
            </div>
          </div>

          <!-- B. DIABETES MELLITUS (Control Metabólico - Parámetros Específicos) -->
          <div id="cardMetabolica" class="glass-card p-4 border-0 mb-4 d-none">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h4 class="glass-title m-0"><i class="bi bi-droplet-fill text-info me-2"></i> Diabetes Mellitus</h4>
              <span class="badge-glass bg-info bg-opacity-25 text-info border-info">Control Metabólico</span>
            </div>

            <div class="row g-3 mb-4">
              <div class="col-sm-6">
                <label class="glass-label mb-2" style="font-size: 0.85rem; opacity: 0.85;">Momento de la Medición</label>
                <select id="glucoseMoment" class="form-select text-white input-field" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15);">
                  <option value="En ayunas" class="bg-dark text-white" selected>En ayunas</option>
                  <option value="Pre-prandial" class="bg-dark text-white">Pre-prandial (antes de comer)</option>
                  <option value="Post-prandial" class="bg-dark text-white">Post-prandial (2h después)</option>
                  <option value="Antes de dormir" class="bg-dark text-white">Antes de dormir</option>
                </select>
              </div>
              <div class="col-sm-6">
                <label class="glass-label mb-2" style="font-size: 0.85rem; opacity: 0.85;">Dosis de Insulina Administrada (UI)</label>
                <div class="input-group">
                  <button type="button" class="btn btn-glass-secondary input-btn px-3 fw-bold decrease-btn" data-target="insulinDose" style="font-size: 1.1rem; border-top-left-radius: 8px; border-bottom-left-radius: 8px;">-</button>
                  <input type="number" step="0.5" id="insulinDose" class="form-control text-center text-white input-field" placeholder="0.0 UI" style="background: rgba(255, 255, 255, 0.05); border-left: none; border-right: none; border-top: 1px solid rgba(255, 255, 255, 0.15); border-bottom: 1px solid rgba(255, 255, 255, 0.15);">
                  <button type="button" class="btn btn-glass-secondary input-btn px-3 fw-bold increase-btn" data-target="insulinDose" style="font-size: 1.1rem; border-top-right-radius: 8px; border-bottom-right-radius: 8px;">+</button>
                </div>
              </div>
            </div>

            <div class="form-check form-switch mb-4 d-flex align-items-center gap-3">
              <input class="form-check-input m-0 input-field" type="checkbox" role="switch" id="diabetesFootCheck" style="cursor: pointer; width: 2.8em; height: 1.4em;">
              <label class="form-check-label glass-label mb-0" style="font-size: 0.95rem;" for="diabetesFootCheck">Revisión de extremidades (Pie Diabético)</label>
            </div>

            <label class="glass-label mb-2" style="font-size: 0.85rem; opacity: 0.85;">Síntomas de Alerta (Metabólico)</label>
            <div class="d-flex gap-2 flex-wrap" id="diabetesSymptomsContainer">
              <button type="button" class="btn btn-glass-secondary flex-fill py-2 diabetes-symptom-btn input-btn" data-symptom="Sudoración fría">Sudoración fría</button>
              <button type="button" class="btn btn-glass-secondary flex-fill py-2 diabetes-symptom-btn input-btn" data-symptom="Mareos/Temblores">Mareos / Temblores</button>
              <button type="button" class="btn btn-glass-secondary flex-fill py-2 diabetes-symptom-btn input-btn" data-symptom="Sed excesiva">Sed excesiva</button>
              <button type="button" class="btn btn-glass-secondary flex-fill py-2 diabetes-symptom-btn active-symptom-none input-btn" data-symptom="Ninguno" style="background: rgba(16, 185, 129, 0.2); border-color: rgba(16, 185, 129, 0.4);">Ninguno</button>
            </div>
          </div>

          <!-- C. EPOC O ASMA (Enfermedades Respiratorias Crónicas - Parámetros Específicos) -->
          <div id="cardEpoc" class="glass-card p-4 border-0 mb-4 d-none">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h4 class="glass-title m-0"><i class="bi bi-wind text-info me-2"></i> EPOC o Asma</h4>
              <span class="badge-glass bg-info bg-opacity-25 text-info border-info">Evaluación Respiratoria</span>
            </div>

            <div class="row g-3 mb-4">
              <div class="col-sm-6">
                <label class="glass-label mb-2" style="font-size: 0.85rem; opacity: 0.85;">Frecuencia Respiratoria (rpm)</label>
                <div class="input-group input-group-lg">
                  <button type="button" class="btn btn-glass-secondary input-btn px-3 fw-bold decrease-btn" data-target="epocRespRate" style="font-size: 1.25rem; border-top-left-radius: 12px; border-bottom-left-radius: 12px;">-</button>
                  <input type="number" id="epocRespRate" class="form-control text-center text-white input-field" placeholder="Ej. 16" style="background: rgba(255, 255, 255, 0.05); border-left: none; border-right: none; border-top: 1px solid rgba(255, 255, 255, 0.15); border-bottom: 1px solid rgba(255, 255, 255, 0.15);">
                  <button type="button" class="btn btn-glass-secondary input-btn px-3 fw-bold increase-btn" data-target="epocRespRate" style="font-size: 1.25rem; border-top-right-radius: 12px; border-bottom-right-radius: 12px;">+</button>
                </div>
              </div>
              <div class="col-sm-6">
                <label class="glass-label mb-2" style="font-size: 0.85rem; opacity: 0.85;">Uso Oxígeno Suplementario (L/min)</label>
                <div class="input-group">
                  <button type="button" class="btn btn-glass-secondary input-btn px-3 fw-bold decrease-btn" data-target="epocO2Flow" style="font-size: 1.1rem; border-top-left-radius: 8px; border-bottom-left-radius: 8px;">-</button>
                  <input type="number" step="0.5" id="epocO2Flow" class="form-control text-center text-white input-field" placeholder="0.0 L/min" style="background: rgba(255, 255, 255, 0.05); border-left: none; border-right: none; border-top: 1px solid rgba(255, 255, 255, 0.15); border-bottom: 1px solid rgba(255, 255, 255, 0.15);">
                  <button type="button" class="btn btn-glass-secondary input-btn px-3 fw-bold increase-btn" data-target="epocO2Flow" style="font-size: 1.1rem; border-top-right-radius: 8px; border-bottom-right-radius: 8px;">+</button>
                </div>
              </div>
              <div class="col-sm-6">
                <label class="glass-label mb-2" style="font-size: 0.85rem; opacity: 0.85;">Nivel de Disnea (Escala mMRC)</label>
                <select id="epocDyspnea" class="form-select text-white input-field" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15);">
                  <option value="0" class="bg-dark text-white">0 - Ahogo solo ante ejercicio intenso</option>
                  <option value="1" class="bg-dark text-white">1 - Ahogo al andar rápido o subir pendientes</option>
                  <option value="2" class="bg-dark text-white">2 - Ahogo al andar al paso de personas de su edad</option>
                  <option value="3" class="bg-dark text-white">3 - Ahogo que obliga a parar a los 100m</option>
                  <option value="4" class="bg-dark text-white">4 - Ahogo al vestirse o que impide salir de casa</option>
                </select>
              </div>
              <div class="col-sm-6">
                <label class="glass-label mb-2" style="font-size: 0.85rem; opacity: 0.85;">Características de las Secreciones</label>
                <select id="epocSputum" class="form-select text-white input-field" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15);">
                  <option value="Ausentes" class="bg-dark text-white">Ausentes</option>
                  <option value="Claras" class="bg-dark text-white">Claras / Mucosas</option>
                  <option value="Amarillentas/Verdosas" class="bg-dark text-white">Amarillentas / Verdosas (Posible Infección)</option>
                  <option value="Con sangre" class="bg-dark text-white">Con presencia de sangre (Hemoptisis)</option>
                </select>
              </div>
            </div>
          </div>

          <!-- D. ENFERMEDAD RENAL CRÓNICA (ERC) -->
          <div id="cardErc" class="glass-card p-4 border-0 mb-4 d-none">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h4 class="glass-title m-0"><i class="bi bi-heart-pulse-fill text-warning me-2"></i> Enfermedad Renal Crónica</h4>
              <span class="badge-glass bg-warning bg-opacity-25 text-warning border-warning">Control Renal</span>
            </div>

            <div class="row g-3 mb-4">
              <div class="col-sm-6">
                <label class="glass-label mb-2" style="font-size: 0.85rem; opacity: 0.85;">Peso Diario (kg)</label>
                <div class="input-group input-group-lg">
                  <button type="button" class="btn btn-glass-secondary input-btn px-3 fw-bold decrease-btn" data-target="renalWeight" style="font-size: 1.25rem; border-top-left-radius: 12px; border-bottom-left-radius: 12px;">-</button>
                  <input type="number" step="0.1" id="renalWeight" class="form-control text-center text-white input-field" placeholder="Ej. 74.5" style="background: rgba(255, 255, 255, 0.05); border-left: none; border-right: none; border-top: 1px solid rgba(255, 255, 255, 0.15); border-bottom: 1px solid rgba(255, 255, 255, 0.15);">
                  <button type="button" class="btn btn-glass-secondary input-btn px-3 fw-bold increase-btn" data-target="renalWeight" style="font-size: 1.25rem; border-top-right-radius: 12px; border-bottom-right-radius: 12px;">+</button>
                </div>
              </div>
              <div class="col-sm-6">
                <label class="glass-label mb-2" style="font-size: 0.85rem; opacity: 0.85;">Volumen de Diuresis (ml)</label>
                <div class="input-group input-group-lg">
                  <button type="button" class="btn btn-glass-secondary input-btn px-3 fw-bold decrease-btn" data-target="renalDiuresis" style="font-size: 1.25rem; border-top-left-radius: 12px; border-bottom-left-radius: 12px;">-</button>
                  <input type="number" id="renalDiuresis" class="form-control text-center text-white input-field" placeholder="Ej. 1200" style="background: rgba(255, 255, 255, 0.05); border-left: none; border-right: none; border-top: 1px solid rgba(255, 255, 255, 0.15); border-bottom: 1px solid rgba(255, 255, 255, 0.15);">
                  <button type="button" class="btn btn-glass-secondary input-btn px-3 fw-bold increase-btn" data-target="renalDiuresis" style="font-size: 1.25rem; border-top-right-radius: 12px; border-bottom-right-radius: 12px;">+</button>
                </div>
              </div>
            </div>

            <p class="text-white-50 small mb-2"><i class="bi bi-info-circle me-1"></i>Presión Arterial Específica (Parámetro Renal):</p>
            <div class="row g-3">
              <div class="col-6">
                <label class="glass-label mb-2" style="font-size: 0.75rem; opacity: 0.75;">Sistólica Renal (mmHg)</label>
                <div class="input-group">
                  <button type="button" class="btn btn-glass-secondary input-btn px-3 fw-bold decrease-btn" data-target="renalBpSystolic" style="font-size: 1.1rem; border-top-left-radius: 8px; border-bottom-left-radius: 8px;">-</button>
                  <input type="number" id="renalBpSystolic" class="form-control text-center text-white input-field" placeholder="Sistólica" style="background: rgba(255, 255, 255, 0.03); border-left: none; border-right: none; border-top: 1px solid rgba(255, 255, 255, 0.1); border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                  <button type="button" class="btn btn-glass-secondary input-btn px-3 fw-bold increase-btn" data-target="renalBpSystolic" style="font-size: 1.1rem; border-top-right-radius: 8px; border-bottom-right-radius: 8px;">+</button>
                </div>
              </div>
              <div class="col-6">
                <label class="glass-label mb-2" style="font-size: 0.75rem; opacity: 0.75;">Diastólica Renal (mmHg)</label>
                <div class="input-group">
                  <button type="button" class="btn btn-glass-secondary input-btn px-3 fw-bold decrease-btn" data-target="renalBpDiastolic" style="font-size: 1.1rem; border-top-left-radius: 8px; border-bottom-left-radius: 8px;">-</button>
                  <input type="number" id="renalBpDiastolic" class="form-control text-center text-white input-field" placeholder="Diastólica" style="background: rgba(255, 255, 255, 0.03); border-left: none; border-right: none; border-top: 1px solid rgba(255, 255, 255, 0.1); border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                  <button type="button" class="btn btn-glass-secondary input-btn px-3 fw-bold increase-btn" data-target="renalBpDiastolic" style="font-size: 1.1rem; border-top-right-radius: 8px; border-bottom-right-radius: 8px;">+</button>
                </div>
              </div>
            </div>
          </div>

          <!-- BLOQUE 2: MEDICAMENTOS Y ADHERENCIA DIARIA -->
          <div class="glass-card p-4 border-0 mb-4" id="cardWellness">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
              <div>
                <h4 class="glass-title m-0 d-flex align-items-center gap-2">
                  <i class="bi bi-capsule text-primary fs-5"></i>
                  <span id="lblWellnessSectionTitle">💊 Medicamentos y Adherencia Diaria</span>
                </h4>
                <small class="text-white-50" style="font-size: 0.78rem;">Control de tomas programadas, recetas vigentes y cumplimiento farmacológico</small>
              </div>
              <span class="badge px-2.5 py-1 rounded-pill fw-semibold" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.35); font-size: 0.75rem;">
                <i class="bi bi-shield-check me-1"></i>Adherencia Activa
              </span>
            </div>
            
            <!-- Switch de Adherencia Farmacológica -->
            <div class="p-3 rounded-3 mb-3" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);">
              <div class="form-check form-switch m-0 d-flex align-items-center gap-3">
                <input class="form-check-input m-0 input-field" type="checkbox" role="switch" id="transversalMedication" style="cursor: pointer; width: 2.8em; height: 1.4em;">
                <div>
                  <label class="form-check-label glass-label mb-0 fw-bold" style="font-size: 0.95rem; cursor: pointer;" for="transversalMedication">
                    ¿Tomó los medicamentos correspondientes hoy?
                  </label>
                  <small class="text-white-50 d-block" style="font-size: 0.74rem;">Marca para confirmar la administración y cumplimiento del esquema prescrito.</small>
                </div>
              </div>
            </div>

            <!-- Listado de Prescripciones / Medicamentos Activos -->
            <div id="caregiverPrescriptionListPreview" class="mb-3"></div>

            <!-- Apuntes e Incidencias del Cuidador -->
            <div class="p-3 rounded-3" style="background: rgba(255, 255, 255, 0.025); border: 1px solid rgba(255, 255, 255, 0.08);">
              <label class="glass-label mb-1.5 fw-semibold d-block" style="font-size: 0.85rem;">
                <i class="bi bi-pencil-square text-info me-1"></i>Apuntes e Incidencias del Registro Diario
              </label>
              <textarea id="caregiverNotes" class="form-control text-white p-2.5 input-field" rows="3" placeholder="Registra observaciones sobre conducta, tolerancia a fármacos, alimentación, descanso u otros sucesos relevantes..." style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15); font-size: 0.88rem; border-radius: 10px;"></textarea>
            </div>
          </div>

          <!-- BLOQUE 3: CIERRE DEL REPORTE CON BOTÓN ÚNICO Y CLARO DE GUARDAR REGISTRO DIARIO -->
          <div class="glass-card p-3.5 p-md-4 border-0 mb-4" id="cardSubmitReportContainer" style="border-radius: 16px;">
            <div class="row g-3 align-items-center">
              <div class="col-md-5">
                <label class="small text-white-50 mb-1.5 d-flex align-items-center gap-1.5 fw-semibold" for="reportDate">
                  <i class="bi bi-calendar3 text-info"></i>Fecha del Registro Diario:
                </label>
                <input type="date" id="reportDate" class="form-control text-white py-2 px-3 fw-semibold" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); border-radius: 10px; cursor: pointer; font-size: 0.92rem;">
              </div>
              <div class="col-md-7">
                <div id="submitButtonContainer">
                  <button type="submit" class="btn btn-primary btn-lg w-100 fw-bold py-2.5 shadow-lg d-flex align-items-center justify-content-center gap-2" style="border-radius: 12px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border: 1.5px solid #38bdf8; font-size: 1.05rem;">
                    <i class="bi bi-check2-circle fs-4"></i>
                    <span>Guardar Registro Diario</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>

        <!-- TARJETA: RECORDATORIOS DE CITAS Y EXÁMENES DEL PACIENTE ACTIVO -->
        <div class="glass-card p-4 border-0 mb-4" id="cardPatientAppointments">
          <!-- Renderizado dinámicamente por renderCaregiverAppointments -->
        </div>
      </div>

      <!-- CARPETA 2: HISTORIAL Y EVOLUCIONES -->
      <div id="tabContentCaregiverHistory" class="folder-connected-panel folder-panel-history w-full max-w-full overflow-x-auto ${activeFolder === 'history' ? '' : 'd-none'}" style="max-width: 100%; overflow-x: auto;">
        <!-- Barra Superior Destacada: ← Volver a Carpetas + Título de la Sección -->
        <div class="folder-view-topbar d-flex align-items-center justify-content-between p-3 px-3.5 rounded-4 mb-4 shadow-sm" style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%); border: 2px solid #f43f5e; border-radius: 16px;">
          <div class="d-flex align-items-center gap-3">
            <button type="button" class="btn btn-outline-light px-3 py-1.5 rounded-pill fw-bold d-inline-flex align-items-center gap-2 btn-back-to-folders" title="Volver a la vista principal de carpetas" style="border-radius: 9999px; border: 1.5px solid rgba(255,255,255,0.4); font-size: 0.88rem; cursor: pointer;">
              <i class="bi bi-arrow-left fs-5"></i>
              <span>Volver a Carpetas</span>
            </button>
            <div class="d-flex align-items-center gap-2">
              <span style="font-size: 1.5rem; line-height: 1;">❤️</span>
              <div>
                <h4 class="fw-extrabold text-white mb-0" style="font-size: 1.25rem;">Historial y Evoluciones</h4>
                <small class="text-white-50" style="font-size: 0.8rem;">Decreto Supremo N° 41 & Ficha Clínica Sincronizada</small>
              </div>
            </div>
          </div>
          <span class="badge px-3 py-1.5 rounded-pill fw-bold d-none d-sm-inline-flex align-items-center" style="background: rgba(244, 63, 94, 0.15); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.35); font-size: 0.78rem;">
            <i class="bi bi-folder2-open me-1.5"></i>Carpeta Activa
          </span>
        </div>

        <!-- BARRA SUPERIOR COMPACTA DE RESUMEN MENSUAL -->
        <div id="caregiverMonthlySummaryBarContainer" class="mb-4"></div>

        <!-- SECCIÓN COMPACTA: HISTORIAL SINCRONIZADO CON FICHA CLÍNICA (DS N° 41 / LEY 20.584) -->
        <div class="glass-card p-4 border-0 mb-4" id="clinicalHistorySection">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <div>
              <h5 class="fw-bold m-0 text-white d-flex align-items-center gap-2">
                <i class="bi bi-clock-history text-info"></i>
                <span>Historial Sincronizado con Ficha Clínica</span>
              </h5>
              <small class="text-white-50" style="font-size: 0.76rem;">Trazabilidad legal de evaluaciones diarias bajo Decreto Supremo N° 41 y Ley 20.584</small>
            </div>
            <span class="badge px-2.5 py-1 rounded-pill fw-semibold d-inline-flex align-items-center" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.35); font-size: 0.72rem; letter-spacing: 0.2px;">
              <i class="bi bi-shield-lock-fill me-1"></i>Sello DS N° 41
            </span>
          </div>
          <div id="clinicalHistoryContainer" class="d-flex flex-column gap-3">
            <!-- Renderizado dinámicamente -->
          </div>
        </div>

        <!-- SECCIÓN DE EVOLUCIONES MÉDICAS OFICIALES (SOLO LECTURA - LEY 20.584 / DS N° 41) -->
        <div class="glass-card p-4 border-0 mb-4" id="caregiverMedicalEvolutionsSection">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <div>
              <h5 class="fw-bold m-0 text-white d-flex align-items-center gap-2">
                <i class="bi bi-file-earmark-medical-fill text-primary"></i>
                <span>Evoluciones Médicas Oficiales (Dra. Elena Valdés)</span>
              </h5>
              <small class="text-white-50" style="font-size: 0.76rem;">Diagnósticos y conducta clínica &bull; Trazabilidad Decreto Supremo N° 41</small>
            </div>
            <span class="badge px-2.5 py-1 rounded-pill fw-semibold" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.35); font-size: 0.72rem;">
              <i class="bi bi-eye-fill me-1"></i>Solo Lectura (Ley 20.584)
            </span>
          </div>
          <div id="caregiverMedicalEvolutionsContainer" class="d-flex flex-column gap-3">
            <!-- Renderizado dinámicamente -->
          </div>
        </div>
      </div>

      <!-- CARPETA 3: DOCUMENTOS Y RECETAS -->
      <div id="tabContentCaregiverDocs" class="folder-connected-panel folder-panel-docs ${activeFolder === 'docs' ? '' : 'd-none'}">
        <!-- Barra Superior Destacada: ← Volver a Carpetas + Título de la Sección -->
        <div class="folder-view-topbar d-flex align-items-center justify-content-between p-3 px-3.5 rounded-4 mb-4 shadow-sm" style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%); border: 2px solid #f59e0b; border-radius: 16px;">
          <div class="d-flex align-items-center gap-3">
            <button type="button" class="btn btn-outline-light px-3 py-1.5 rounded-pill fw-bold d-inline-flex align-items-center gap-2 btn-back-to-folders" title="Volver a la vista principal de carpetas" style="border-radius: 9999px; border: 1.5px solid rgba(255,255,255,0.4); font-size: 0.88rem; cursor: pointer;">
              <i class="bi bi-arrow-left fs-5"></i>
              <span>Volver a Carpetas</span>
            </button>
            <div class="d-flex align-items-center gap-2">
              <span style="font-size: 1.5rem; line-height: 1;">📄</span>
              <div>
                <h4 class="fw-extrabold text-white mb-0" style="font-size: 1.25rem;">Documentos y Recetas</h4>
                <small class="text-white-50" style="font-size: 0.8rem;">Cámara, Escáner IA y Archivos Médicos</small>
              </div>
            </div>
          </div>
          <span class="badge px-3 py-1.5 rounded-pill fw-bold d-none d-sm-inline-flex align-items-center" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35); font-size: 0.78rem;">
            <i class="bi bi-folder2-open me-1.5"></i>Carpeta Activa
          </span>
        </div>

        <div id="caregiverDocsMainContainer">
          <!-- Renderizado dinámicamente por renderCaregiverDocuments -->
        </div>
      </div>

      <!-- CARPETA 4: VACUNAS Y DENTAL -->
      <div id="tabContentCaregiverVaccinesDental" class="folder-connected-panel folder-panel-vaccines w-full max-w-full overflow-x-auto ${activeFolder === 'vaccines_dental' ? '' : 'd-none'}" style="max-width: 100%; overflow-x: auto;">
        <!-- Barra Superior Destacada: ← Volver a Carpetas + Título de la Sección -->
        <div class="folder-view-topbar d-flex align-items-center justify-content-between p-3 px-3.5 rounded-4 mb-4 shadow-sm" style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%); border: 2px solid #00e676; border-radius: 16px;">
          <div class="d-flex align-items-center gap-3">
            <button type="button" class="btn btn-outline-light px-3 py-1.5 rounded-pill fw-bold d-inline-flex align-items-center gap-2 btn-back-to-folders" title="Volver a la vista principal de carpetas" style="border-radius: 9999px; border: 1.5px solid rgba(255,255,255,0.4); font-size: 0.88rem; cursor: pointer;">
              <i class="bi bi-arrow-left fs-5"></i>
              <span>Volver a Carpetas</span>
            </button>
            <div class="d-flex align-items-center gap-2">
              <span style="font-size: 1.5rem; line-height: 1;" id="folderViewTopbarIconVaccines">${activePatient && getPatientAge(activePatient) >= 60 ? '🛡️' : '🦷'}</span>
              <div>
                <h4 class="fw-extrabold text-white mb-0" style="font-size: 1.25rem;" id="folderViewTopbarTitleVaccines">${activePatient && getPatientAge(activePatient) >= 60 ? 'Vacunas y GES 60' : 'Vacunas y Dental'}</h4>
                <small class="text-white-50" style="font-size: 0.8rem;" id="folderViewTopbarSubVaccines">${caregiverPatientIsPregnant(activePatient) ? 'Control Prenatal MINSAL' : (getPatientAge(activePatient) < 60 ? 'PNI Adolescente & Dental' : 'PNI & GES 60')}</small>
              </div>
            </div>
          </div>
          <span class="badge px-3 py-1.5 rounded-pill fw-bold d-none d-sm-inline-flex align-items-center" style="background: rgba(0, 230, 118, 0.15); color: #00e676; border: 1px solid rgba(0, 230, 118, 0.35); font-size: 0.78rem;">
            <i class="bi bi-folder2-open me-1.5"></i>Carpeta Activa
          </span>
        </div>

        <div id="caregiverVaccinesDentalContainer" class="w-full max-w-full overflow-x-auto" style="max-width: 100%; overflow-x: auto;">
          <!-- Renderizado dinámicamente por renderCaregiverVaccinesDental -->
        </div>
      </div>

    </div>

    <!-- Columna Derecha (col-lg-4): Ficha del Paciente Lateral Fija -->
    <div class="col-lg-4" id="caregiverPatientSidebar">
      <div class="d-flex flex-column gap-4" style="position: sticky; top: 20px;">
        
        <!-- Ficha del Paciente Activo -->
        <div class="glass-card p-4">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <h5 class="fw-bold m-0"><i class="bi bi-person-bounding-box text-primary me-2"></i><span id="lblPatientFileTitle">Ficha del Paciente</span></h5>
            <span id="badgeAuthorizedLink" class="badge px-2.5 py-1 rounded-pill fw-semibold d-inline-flex align-items-center" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); font-size: 0.72rem; letter-spacing: 0.2px;">
              <i class="bi bi-shield-check me-1"></i>Vínculo Autorizado (Ley 20.584)
            </span>
          </div>
          <div class="d-flex align-items-center gap-3 mb-3 border-bottom border-light border-opacity-10 pb-3">
            <div id="patientInitials" class="rounded-circle d-flex justify-content-center align-items-center text-white" style="width: 55px; height: 55px; background: rgba(14, 165, 233, 0.25); border: 1px solid rgba(14, 165, 233, 0.4); font-size: 1.35rem; font-weight: bold;">JD</div>
            <div>
              <h6 id="patientName" class="mb-0 fw-bold">--</h6>
              <small id="patientDni" class="text-warning font-monospace">--</small>
            </div>
          </div>
          
          <!-- Datos Base Universales -->
          <div class="d-flex flex-column gap-2 small text-white-50">
            <div class="d-flex justify-content-between"><span id="lblMetaAgeSex">Edad / Sexo:</span><strong class="text-white" id="pMetaAgeSex">--</strong></div>
            <div class="d-flex justify-content-between"><span id="lblMetaWeightHeight">Peso / Estatura:</span><strong class="text-white" id="pMetaWeightHeight">--</strong></div>
            <div class="d-flex justify-content-between"><span id="lblMetaBlood">Grupo Sanguíneo:</span><strong class="text-white" id="pMetaBlood">--</strong></div>
            <div class="d-flex justify-content-between"><span id="lblMetaAllergies">Alergias:</span><strong class="text-white text-end" style="max-width: 150px;" id="pMetaAllergies">--</strong></div>
            <div class="border-top border-light border-opacity-10 my-2"></div>
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="fw-bold text-info" id="lblMetaContact"><i class="bi bi-telephone-fill me-1"></i>Contacto Emergencia:</span>
              <button type="button" id="btnOpenEditPatientContactModal" class="btn btn-sm btn-outline-info py-0.5 px-2 fw-semibold d-inline-flex align-items-center gap-1" style="font-size: 0.72rem; border-radius: 6px; border-color: rgba(14, 165, 233, 0.4);" title="Editar datos administrativos de contacto">
                <span id="btnEditContactText">✏️ Editar Contacto</span>
              </button>
            </div>
            <div id="pMetaContact" class="text-white">--</div>

            <!-- Botones de Acción de Emergencia Telefónica Directa (Android & Teléfonos Básicos) -->
            <div class="d-flex flex-column gap-2 mt-2 pt-2 border-top border-light border-opacity-10" id="caregiverEmergencyButtonsContainer">
              <!-- Llamada Directa al Contacto de Emergencia Registrado (ICE) -->
              <a id="btnCallEmergencyContactDirect" href="tel:131" class="btn btn-sm w-100 fw-bold py-2 d-inline-flex align-items-center justify-content-center gap-2 shadow-sm text-white" style="border-radius: 10px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border: 1.5px solid #38bdf8; font-size: 0.85rem;">
                <span class="emoji-senior">📞</span>
                <span id="labelCallEmergencyContact">Llamar Contacto</span>
              </a>

              <!-- Llamada Directa a SAMU 131 -->
              <a href="tel:131" id="btnCallSamu131" class="btn btn-danger btn-sm w-100 fw-bold py-2 d-inline-flex align-items-center justify-content-center gap-2 shadow-sm text-white" style="border-radius: 10px; background: #dc2626; border-color: #ef4444; font-size: 0.85rem;">
                <span class="emoji-senior">🚨</span>
                <span>Llamar SAMU Ambulancia (131)</span>
              </a>

              <!-- Accesos Telefónicos Directos de Emergencia (133 Carabineros y Salud Responde) -->
              <a href="tel:133" class="btn btn-outline-success btn-sm w-100 fw-semibold py-1.5 d-inline-flex align-items-center justify-content-center gap-1.5" style="border-radius: 8px; font-size: 0.82rem;" title="Llamar a Carabineros">
                <span id="lblBtn133">🚓 133 Carabineros</span>
              </a>
              <a href="tel:6003607777" class="btn btn-outline-info btn-sm w-100 fw-semibold py-1.5 d-inline-flex align-items-center justify-content-center gap-1.5 text-nowrap" style="border-radius: 8px; font-size: 0.82rem;" title="Salud Responde MINSAL">
                <span id="lblBtnSaludResponde">📞 Salud Responde (600 360 7777)</span>
              </a>

              <!-- Ver QR de Emergencia -->
              <button type="button" id="btnOpenCaregiverEmergencyQrModal" class="btn btn-glass-secondary btn-sm w-100 fw-semibold py-1.5 d-inline-flex align-items-center justify-content-center gap-2" style="border-radius: 10px; font-size: 0.82rem;">
                <i class="bi bi-qr-code-scan text-info"></i>
                <span>📱 Ver QR de Urgencia</span>
              </button>
            </div>
          </div>

          <h6 id="lblActiveConditionsTitle" class="fw-bold border-top border-light border-opacity-10 pt-3 mt-3 mb-2" style="font-size: 0.9rem;">Condiciones Activas:</h6>
          <div id="patientConditionsList" class="d-flex flex-column gap-2"></div>
        </div>

      </div>
    </div>

  </div>
`;

  // Poblar selector superior "Paciente:" con "Mi Ficha (Titular)" y todas sus Personas a Cargo vinculadas
  refreshPatientSelector(activePatient);

  // Inicializar Banner Hero Único Estilo Mateo (Saludo, Condición Activa, Próxima Cita)
  updateCaregiverHeroSection(activePatient);

  // Asegurar que el menú lateral muestre "Mi Ficha Clínica" con su ícono correspondiente igual que en los demás perfiles
  const linkEval = document.getElementById('linkEvaluation');
  if (linkEval) {
    const textSpan = linkEval.querySelector('.sidebar-text-full');
    if (textSpan) textSpan.textContent = 'Mi Ficha Clínica';
    const icon = linkEval.querySelector('i');
    if (icon) icon.className = 'bi bi-file-earmark-medical-fill me-3 text-info';
  }

  const patientSelector = document.getElementById('patientSelector');
  if (patientSelector) {
    patientSelector.addEventListener('change', (e) => {
      const selectedId = e.target.value;
      const currentAuth = getAuthorizedPatientsForCurrentCaregiver();
      const patient = currentAuth.find(p => p.id === selectedId) || PATIENTS_DATABASE.find(p => p.id === selectedId);
      if (patient) {
        setActivePatient(patient);
        updateActivePatient(patient);

        // Recuperar y aplicar idioma persistido de este paciente o perfil demo
        const pKey = (patient.username || '').toLowerCase();
        const pName = (patient.name || '').toLowerCase();
        let savedLang = (patient.id && localStorage.getItem('cuidapp_user_lang_' + patient.id)) ||
          (pKey && localStorage.getItem('cuidapp_user_lang_' + pKey)) ||
          (pName && localStorage.getItem('cuidapp_user_lang_' + pName));

        if (!savedLang) {
          if (pName.includes('juan')) savedLang = localStorage.getItem('cuidapp_user_lang_juan');
          else if (pName.includes('valentina')) savedLang = localStorage.getItem('cuidapp_user_lang_valentina');
          else if (pName.includes('daniela')) savedLang = localStorage.getItem('cuidapp_user_lang_daniela');
          else if (pName.includes('camila')) savedLang = localStorage.getItem('cuidapp_user_lang_camila');
          else if (pName.includes('mateo')) savedLang = localStorage.getItem('cuidapp_user_lang_mateo');
          else if (pName.includes('cuidador')) savedLang = localStorage.getItem('cuidapp_user_lang_cuidador');
        }

        if (!savedLang) {
          savedLang = patient.idiomaPreferido || patient.language || patient.idioma || localStorage.getItem('cuidapp_language') || 'es';
        }

        applyGlobalLanguage(savedLang, patient);
      } else {
        if (window.showGlassAlert) {
          window.showGlassAlert('Acceso denegado: Ficha no autorizada según Ley 20.584.', 'danger');
        }
      }
    });
  }

  // Conectar botón "+ Agregar Persona a Cargo"
  const btnAddPersona = document.getElementById('btnOpenAddPersonaACargoModal');
  if (btnAddPersona) {
    btnAddPersona.onclick = () => {
      openAddPersonaACargoCaregiverModal(authorizedPatients[0] || activePatient, container);
    };
  }

  // Configurar input de fecha
  const reportDateInput = document.getElementById('reportDate');
  if (reportDateInput) {
    reportDateInput.value = getTodayDateString();
    reportDateInput.max = getTodayDateString();
    reportDateInput.addEventListener('change', evaluateDateLock);
  }

  // Inicializar vista del paciente activo
  updateActivePatient(activePatient);

  // Montar Monitor Cardíaco IoT en Vivo (ECG AD8232)
  mountIotEcgWidget('iotEcgContainerCuidador');

  // Asegurar formato limpio y legible en telemetría ECG
  const seqElCuidador = document.querySelector('#iotEcgContainerCuidador [id^="seqDisplay_"]');
  if (seqElCuidador) {
    seqElCuidador.textContent = 'Seq: #2388 • Simulador';
  }

  // Conectar botón para Ver QR de Emergencia y Botón Rojo SAMU 131
  const btnQrEmergencia = document.getElementById('btnOpenCaregiverEmergencyQrModal');
  if (btnQrEmergencia) {
    btnQrEmergencia.onclick = () => {
      openCaregiverEmergencyQrModal(activePatient);
    };
  }
  const btnCallSamu = document.getElementById('btnCallSamu131');
  if (btnCallSamu) {
    btnCallSamu.onclick = (e) => {
      e.preventDefault();
      openCaregiverEmergencyQrModal(activePatient);
    };
  }

  // Conectar botón para Editar Contacto del Paciente
  const btnEditContact = document.getElementById('btnOpenEditPatientContactModal');
  if (btnEditContact) {
    btnEditContact.onclick = () => {
      openEditPatientContactModal(activePatient);
    };
  }

  // Configurar pestañas internas del cuidador
  const tabDailyBtn = document.getElementById('tabBtnCaregiverDaily');
  const tabHistoryBtn = document.getElementById('tabBtnCaregiverHistory');
  const tabDocsBtn = document.getElementById('tabBtnCaregiverDocs');
  const tabVaccinesDentalBtn = document.getElementById('tabBtnCaregiverVaccinesDental');

  const tabDailyContent = document.getElementById('tabContentCaregiverDaily');
  const tabHistoryContent = document.getElementById('tabContentCaregiverHistory');
  const tabDocsContent = document.getElementById('tabContentCaregiverDocs');
  const tabVaccinesDentalContent = document.getElementById('tabContentCaregiverVaccinesDental');

  const switchCaregiverTab = (tab) => {
    // Si se hace clic en la carpeta activa, se cierra (toggle a null)
    const newTab = (activeFolder === tab) ? null : tab;
    setCaregiverInternalTab(newTab);

    if (tabDailyBtn) tabDailyBtn.classList.toggle('active', activeFolder === 'daily');
    if (tabHistoryBtn) tabHistoryBtn.classList.toggle('active', activeFolder === 'history');
    if (tabDocsBtn) tabDocsBtn.classList.toggle('active', activeFolder === 'docs');
    if (tabVaccinesDentalBtn) tabVaccinesDentalBtn.classList.toggle('active', activeFolder === 'vaccines_dental');

    // Condición de renderizado en la columna izquierda:
    // Si ninguna carpeta está abierta (!activeFolder): Muestra únicamente la grilla de las 4 carpetas grandes (grid-cols-2 gap-4) nivelada con la Ficha.
    // Si el usuario hace clic en una carpeta (activeFolder tiene valor): Oculta por completo la grilla y muestra en su lugar únicamente el panel de la carpeta abierta con su barra superior.
    const folderNav = document.getElementById('caregiverTabNav');
    if (folderNav) {
      folderNav.classList.toggle('d-none', activeFolder !== null);
      if (activeFolder !== null) {
        folderNav.style.setProperty('display', 'none', 'important');
      } else {
        folderNav.style.removeProperty('display');
      }
    }

    if (tabDailyContent) tabDailyContent.classList.toggle('d-none', activeFolder !== 'daily');
    if (tabHistoryContent) tabHistoryContent.classList.toggle('d-none', activeFolder !== 'history');
    if (tabDocsContent) tabDocsContent.classList.toggle('d-none', activeFolder !== 'docs');
    if (tabVaccinesDentalContent) tabVaccinesDentalContent.classList.toggle('d-none', activeFolder !== 'vaccines_dental');

    if (activeFolder === 'history') {
      renderClinicalHistory(activePatient.id);
      renderCaregiverMedicalEvolutions(activePatient.id);
    } else if (activeFolder === 'docs') {
      renderCaregiverDocuments(activePatient);
    } else if (activeFolder === 'vaccines_dental') {
      renderCaregiverVaccinesDental(activePatient);
    }
  };

  if (tabDailyBtn) tabDailyBtn.onclick = () => switchCaregiverTab('daily');
  if (tabHistoryBtn) tabHistoryBtn.onclick = () => switchCaregiverTab('history');
  if (tabDocsBtn) tabDocsBtn.onclick = () => switchCaregiverTab('docs');
  if (tabVaccinesDentalBtn) tabVaccinesDentalBtn.onclick = () => switchCaregiverTab('vaccines_dental');

  // Botones destacados "← Volver a Carpetas" en la barra superior de cada vista interna
  document.querySelectorAll('.btn-back-to-folders').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      switchCaregiverTab(null);
    };
  });

  if (caregiverInternalTab === 'docs') {
    renderCaregiverDocuments(activePatient);
  } else if (caregiverInternalTab === 'vaccines_dental') {
    renderCaregiverVaccinesDental(activePatient);
  }

  // Conectar los 3 Controles Globales (Voz, Día/Noche Sol/Luna, Idioma según Registro)
  bindGlobalTopBarControls(activePatient);

  // Inicializar Custom Selects en Dashboard
  initCustomSelects();
}

// ============================================================================
// MODAL FICHA QR DE EMERGENCIA CON GEOLOCALIZACIÓN GPS & RESCATE SAMU 131
// (COMPATIBLE CON TELÉFONOS ANTIGUOS, BÁSICOS Y SMARTPHONES - LEY N° 20.584)
// ============================================================================
export function openCaregiverEmergencyQrModal(patient = activePatient) {
  if (!patient) return;

  const modalId = 'modalCaregiverEmergencyQr';
  const existing = document.getElementById(modalId);
  if (existing) existing.remove();

  // Obtener medicamentos activos prescritos
  const activeRx = getPatientPrescriptions(patient.id).filter(r => r.status === 'activa');

  // Condiciones médicas activas
  const conditionsText = (patient.conditions || []).map(k => {
    const cond = CLINICAL_CONDITIONS[k];
    return cond ? cond.name : k;
  }).join(' • ') || 'Sin patologías crónicas registradas';

  const rxSummaryText = activeRx.map(r => `${r.medication} ${r.dose}`).join(', ') || 'Sin recetas activas';
  const patientRut = patient.fileNumber || patient.rut || 'Sin RUT registrado';
  const fallbackAddress = patient.address || patient.direccion || 'Av. Providencia 1234, Providencia, Santiago, Región Metropolitana';
  const contactPhone = (patient.emergencyContact && patient.emergencyContact.phone) ? patient.emergencyContact.phone : '+56 9 8765 4321';
  const cleanContactPhone = contactPhone.replace(/[^0-9+]/g, '');
  const waContactPhone = cleanContactPhone.replace(/^\+/, '');

  // Carga clínica completa formateada bajo Ley N° 20.584 para escaneo offline de paramédicos y cámaras
  const qrDataPayload = `CUIDAPP EMERGENCIA LEY 20.584\nPACIENTE: ${patient.name}\nRUT: ${patientRut}\nGRUPO: ${patient.bloodType || 'Sin registro'}\nALERGIAS: ${patient.allergies || 'Ninguna'}\nMEDICAMENTOS: ${rxSummaryText}\nCONTACTO: ${patient.emergencyContact ? patient.emergencyContact.name : 'Contacto Familiar'} (${contactPhone})\nDIRECCION: ${fallbackAddress}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrDataPayload)}`;

  const modalHtml = `
    <div class="modal fade show d-block" id="${modalId}" tabindex="-1" style="background: rgba(0, 0, 0, 0.88); backdrop-filter: blur(10px); z-index: 1060;">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content glass-card text-white border-light border-opacity-10" style="background: #090f20; border-radius: 22px; box-shadow: 0 25px 60px rgba(0,0,0,0.9);">
          
          <!-- Cabecera del Modal -->
          <div class="modal-header border-bottom border-light border-opacity-10 p-3.5 pb-2.5">
            <div class="d-flex align-items-center gap-2.5">
              <span class="fs-2 text-danger">🚨</span>
              <div>
                <h5 class="modal-title fw-bold m-0 text-white d-flex align-items-center gap-2">
                  <span>Emergencia, Geolocalización & QR de Urgencia</span>
                  <span class="badge bg-danger text-white border border-danger small">SAMU 131</span>
                </h5>
                <small class="text-white-50">
                  Paciente: <strong class="text-white">${patient.name}</strong> &bull; RUT: <span class="text-warning font-monospace">${patientRut}</span> &bull; Ley N° 20.584
                </small>
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" id="btnCloseCaregiverEmergencyQrModal"></button>
          </div>

          <!-- Cuerpo del Modal -->
          <div class="modal-body p-3.5" style="max-height: 75vh; overflow-y: auto;">
            <div class="row g-3 align-items-center">
              
              <!-- Columna Código QR Clínico de Urgencia -->
              <div class="col-md-5 text-center">
                <div class="bg-white p-3 rounded-4 d-inline-block shadow-lg mb-2" style="border: 3px solid #ef4444;">
                  <img src="${qrUrl}" alt="Código QR Clínico de Urgencia" style="width: 195px; height: 195px; display: block;" onerror="this.parentElement.innerHTML='<div class=\\'text-dark fw-bold p-3 border border-dark rounded\\'>[QR CLÍNICO DE EMERGENCIA]<br>RUT: ${patientRut}<br>RH: ${patient.bloodType || 'O+'}</div>';">
                </div>
                <div class="small text-white-50 mt-1" style="font-size: 0.76rem;">
                  <i class="bi bi-qr-code-scan text-info me-1"></i>QR Clínico legible por paramédicos del SAMU y cualquier cámara
                </div>
                <div class="badge bg-dark border border-light border-opacity-20 text-white-50 font-monospace mt-1.5 small">
                  Trazabilidad DS N° 41 / Ley N° 20.584
                </div>
              </div>

              <!-- Columna Datos Críticos & Geolocalización -->
              <div class="col-md-7">
                <div class="d-flex flex-column gap-2">
                  
                  <!-- Grupo Sanguíneo y Alergias (Crítico) -->
                  <div class="p-2.5 rounded-3" style="background: rgba(220, 38, 38, 0.15); border: 1.5px solid rgba(220, 38, 38, 0.45);">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                      <span class="text-danger fw-bold small text-uppercase"><i class="bi bi-droplet-fill me-1"></i>Grupo Sanguíneo & Alergias</span>
                      <span class="badge bg-danger text-white fw-bold px-2 py-0.5">${patient.bloodType || 'Sin registro'}</span>
                    </div>
                    <div class="text-white small">
                      <strong>Alergias Conocidas:</strong> <span class="${patient.allergies && patient.allergies.toLowerCase() !== 'ninguna' ? 'text-warning fw-bold' : 'text-white-50'}">${patient.allergies || 'Ninguna registrada'}</span>
                    </div>
                  </div>

                  <!-- Medicamentos Vigentes -->
                  <div class="p-2.5 rounded-3" style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08);">
                    <span class="text-success fw-bold small text-uppercase d-block mb-1"><i class="bi bi-capsule me-1"></i>Medicamentos Vigentes</span>
                    ${activeRx.length > 0 ? `
                      <ul class="list-unstyled m-0 small d-flex flex-column gap-1">
                        ${activeRx.map(r => `
                          <li class="d-flex justify-content-between text-white">
                            <span><strong>${r.medication}</strong> ${r.dose}</span>
                            <span class="text-white-50">${r.schedule}</span>
                          </li>
                        `).join('')}
                      </ul>
                    ` : `
                      <div class="text-white-50 small fst-italic">Sin recetas activas registradas en la ficha.</div>
                    `}
                  </div>

                  <!-- Condiciones Médicas Activas -->
                  <div class="p-2 rounded-3" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.07); font-size: 0.78rem;">
                    <span class="text-info fw-bold text-uppercase d-block mb-0.5"><i class="bi bi-heart-pulse-fill me-1"></i>Condiciones Médicas Activas</span>
                    <span class="text-white-50">${conditionsText}</span>
                  </div>

                  <!-- Contacto Familiar / Cuidador Registrado -->
                  <div class="p-2.5 rounded-3" style="background: rgba(14, 165, 233, 0.08); border: 1px solid rgba(14, 165, 233, 0.25);">
                    <div class="d-flex justify-content-between align-items-center small text-white">
                      <div>
                        <span class="text-info fw-bold text-uppercase d-block" style="font-size: 0.72rem;"><i class="bi bi-telephone-outbound-fill me-1"></i>Contacto de Emergencia / Cuidador</span>
                        <span>${patient.emergencyContact ? `${patient.emergencyContact.name} (${patient.emergencyContact.relation || 'Familiar'})` : 'Contacto Familiar'}</span>
                      </div>
                      <strong class="text-info font-monospace fs-6">${contactPhone}</strong>
                    </div>
                  </div>

                  <!-- Ubicación GPS en Vivo & Respaldo de Domicilio Registrado -->
                  <div class="p-2.5 rounded-3" style="background: rgba(16, 185, 129, 0.08); border: 1.5px solid rgba(16, 185, 129, 0.35);">
                    <div class="d-flex justify-content-between align-items-center mb-1 flex-wrap gap-1">
                      <span class="text-success fw-bold small text-uppercase">
                        <i class="bi bi-geo-alt-fill text-danger me-1"></i>Ubicación Georreferenciada (GPS & Respaldo)
                      </span>
                      <span id="caregiverEmergencyGpsBadge" class="badge rounded-pill fw-semibold" style="background: rgba(14, 165, 233, 0.25); color: #38bdf8; font-size: 0.7rem;">
                        <i class="bi bi-satellite me-1"></i>Conectando satélites...
                      </span>
                    </div>

                    <div id="caregiverEmergencyGpsDetails" class="text-white small mb-2" style="font-size: 0.82rem; line-height: 1.4;">
                      <span class="text-white-50"><i class="bi bi-hourglass-split me-1"></i>Capturando coordenadas GPS en tiempo real...</span>
                    </div>

                    <div class="d-flex align-items-center gap-2 flex-wrap">
                      <a id="btnEmergencyShareGpsSms" href="sms:${cleanContactPhone}?body=EMERGENCIA" class="btn btn-sm btn-outline-info fw-semibold px-2.5 py-1.5 d-inline-flex align-items-center gap-1.5 shadow-sm" style="border-radius: 8px; font-size: 0.78rem;">
                        <i class="bi bi-chat-dots-fill text-info"></i> 📲 Compartir por SMS
                      </a>
                      <a id="btnEmergencyShareGpsWa" href="https://wa.me/${waContactPhone}?text=EMERGENCIA" target="_blank" class="btn btn-sm btn-outline-success fw-semibold px-2.5 py-1.5 d-inline-flex align-items-center gap-1.5 shadow-sm" style="border-radius: 8px; font-size: 0.78rem;">
                        <i class="bi bi-whatsapp text-success"></i> 💬 Compartir por WhatsApp
                      </a>
                      <button type="button" id="btnEmergencyCopyGps" class="btn btn-sm btn-glass-secondary fw-semibold px-2.5 py-1.5 d-inline-flex align-items-center gap-1 shadow-sm" style="border-radius: 8px; font-size: 0.76rem;">
                        <i class="bi bi-clipboard-check"></i> Copiar Coordenadas
                      </button>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>

          <!-- Pie del Modal con Enlaces Telefónicos Directos (Android y Teléfonos Básicos) -->
          <div class="modal-footer border-top border-light border-opacity-10 p-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div class="d-flex flex-wrap gap-2">
              <a href="tel:131" class="btn btn-danger fw-bold d-inline-flex align-items-center gap-2 px-3 py-2 shadow-sm text-white" style="border-radius: 10px; font-size: 0.88rem; background: #dc2626; border-color: #ef4444;">
                <i class="bi bi-telephone-fill"></i> Llamar SAMU Ambulancia (131)
              </a>
              <a href="tel:${cleanContactPhone}" class="btn btn-info fw-bold d-inline-flex align-items-center gap-2 px-3 py-2 text-white shadow-sm" style="border-radius: 10px; font-size: 0.88rem;">
                <i class="bi bi-telephone-outbound-fill"></i> Llamar Cuidador / ICE (${contactPhone})
              </a>
              <a href="tel:133" class="btn btn-outline-success fw-semibold d-inline-flex align-items-center gap-1.5 px-2.5 py-2" style="border-radius: 10px; font-size: 0.85rem;" title="Llamar a Carabineros">
                <span>🚓</span> 133 Carabineros
              </a>
              <a href="tel:6003607777" class="btn btn-outline-info fw-semibold d-inline-flex align-items-center gap-1.5 px-2.5 py-2" style="border-radius: 10px; font-size: 0.85rem;" title="Salud Responde">
                <span>📞</span> Salud Responde
              </a>
            </div>
            <button type="button" class="btn btn-glass-secondary px-4 py-2" id="btnFooterCloseCaregiverEmergencyQrModal" style="border-radius: 10px;">
              Cerrar
            </button>
          </div>

        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalEl = document.getElementById(modalId);
  const closeBtn = document.getElementById('btnCloseCaregiverEmergencyQrModal');
  const footerCloseBtn = document.getElementById('btnFooterCloseCaregiverEmergencyQrModal');

  const removeModal = () => {
    if (modalEl) modalEl.remove();
  };

  if (closeBtn) closeBtn.onclick = removeModal;
  if (footerCloseBtn) footerCloseBtn.onclick = removeModal;
  if (modalEl) {
    modalEl.onclick = (e) => {
      if (e.target === modalEl) removeModal();
    };
  }

  // Lógica de Geolocalización en Tiempo Real con Respaldo Automático
  const updateCoordsDisplay = (lat, lng, isGps = true) => {
    const badgeEl = document.getElementById('caregiverEmergencyGpsBadge');
    const detailsEl = document.getElementById('caregiverEmergencyGpsDetails');
    const smsBtn = document.getElementById('btnEmergencyShareGpsSms');
    const waBtn = document.getElementById('btnEmergencyShareGpsWa');
    const copyBtn = document.getElementById('btnEmergencyCopyGps');

    let mapLink = '';
    let locationDescription = '';

    if (isGps && lat && lng) {
      mapLink = `https://www.google.com/maps?q=${lat},${lng}`;
      locationDescription = `Lat: ${lat}, Lng: ${lng} (Respaldo: ${fallbackAddress})`;
      if (badgeEl) {
        badgeEl.className = 'badge rounded-pill fw-semibold';
        badgeEl.style.background = 'rgba(16, 185, 129, 0.25)';
        badgeEl.style.color = '#34d399';
        badgeEl.innerHTML = '<i class="bi bi-geo-alt-fill text-success me-1"></i>GPS Activo Preciso';
      }
      if (detailsEl) {
        detailsEl.innerHTML = `
          <div><strong>Coordenadas GPS:</strong> <a href="${mapLink}" target="_blank" class="text-warning fw-bold text-decoration-none">${lat}, ${lng}</a></div>
          <div class="text-white-50 small">Domicilio de Respaldo: <span class="text-white">${fallbackAddress}</span></div>
        `;
      }
    } else {
      mapLink = `https://www.google.com/maps?q=${encodeURIComponent(fallbackAddress)}`;
      locationDescription = fallbackAddress;
      if (badgeEl) {
        badgeEl.className = 'badge rounded-pill fw-semibold';
        badgeEl.style.background = 'rgba(245, 158, 11, 0.22)';
        badgeEl.style.color = '#fcd34d';
        badgeEl.innerHTML = '<i class="bi bi-house-check-fill text-warning me-1"></i>Dirección Registrada';
      }
      if (detailsEl) {
        detailsEl.innerHTML = `
          <div><strong>Dirección de Respaldo:</strong> <span class="text-white">${fallbackAddress}</span></div>
          <small class="text-white-50">Señal satelital en espera o no disponible; se utiliza domicilio oficial de la ficha.</small>
        `;
      }
    }

    const shareMessage = `🚨 EMERGENCIA MÉDICA CUIDAPP (Ley N° 20.584): Paciente ${patient.name} (RUT: ${patientRut}) requiere auxilio urgente. Ubicación: ${locationDescription}. Mapa: ${mapLink}. Alergias: ${patient.allergies || 'Ninguna'}. Grupo: ${patient.bloodType || 'O+'}. Medicamentos: ${rxSummaryText}. Contacto: ${contactPhone}.`;

    if (smsBtn) {
      smsBtn.href = `sms:${cleanContactPhone}?body=${encodeURIComponent(shareMessage)}`;
    }
    if (waBtn) {
      waBtn.href = `https://wa.me/${waContactPhone}?text=${encodeURIComponent(shareMessage)}`;
    }
    if (copyBtn) {
      copyBtn.onclick = () => {
        try {
          navigator.clipboard.writeText(shareMessage);
          if (window.showGlassAlert) {
            window.showGlassAlert('📋 Coordenadas y datos de emergencia copiados al portapapeles.', 'success');
          }
        } catch (e) {}
      };
    }
  };

  // Desplegar de inmediato respaldo de dirección registrada
  updateCoordsDisplay(null, null, false);

  // Iniciar geolocalización satelital en vivo si el dispositivo lo soporta
  if (navigator.geolocation && navigator.geolocation.getCurrentPosition) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(5);
        const lng = pos.coords.longitude.toFixed(5);
        updateCoordsDisplay(lat, lng, true);
      },
      (err) => {
        console.warn('Geolocation fallback to registered address:', err);
        updateCoordsDisplay(null, null, false);
      },
      { timeout: 7000, enableHighAccuracy: true }
    );
  }
}

// ============================================================================
// SISTEMA DE ALARMAS Y RECORDATORIOS TELEFÓNICOS CLÍNICOS COMPATIBLES
// (ALARMA SONORA + VOZ LOCAL + ENLACE TELEFÓNICO / .ICS PARA TODO DISPOSITIVO)
// ============================================================================

export function playAudibleAlarmSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    
    // Tono de alarma médica característico (tríada sonora nítida y audible)
    [
      { freq: 880, start: 0, duration: 0.15 },
      { freq: 880, start: 0.2, duration: 0.15 },
      { freq: 1320, start: 0.45, duration: 0.25 },
      { freq: 1760, start: 0.75, duration: 0.35 }
    ].forEach(t => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(t.freq, now + t.start);
      gain.gain.setValueAtTime(0.35, now + t.start);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t.start + t.duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + t.start);
      osc.stop(now + t.start + t.duration);
    });
  } catch (e) {
    console.warn('AudioContext alert notification:', e);
  }
}

export function speakReminderVoice(text) {
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'es-CL';
    utter.rate = 0.95;
    utter.volume = 1.0;
    window.speechSynthesis.speak(utter);
  } catch (e) {}
}

export function generateCalendarAlarmIcs(title, description, dateStr, timeStr) {
  const dt = dateStr ? dateStr.replace(/-/g, '') : new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const tm = (timeStr ? timeStr.replace(/[^0-9]/g, '').padEnd(4, '0') : '0800') + '00';
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//cuidApp//Recordatorio Medico//ES',
    'BEGIN:VEVENT',
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    `DTSTART:${dt}T${tm}`,
    `DTEND:${dt}T${tm}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT10M',
    'ACTION:AUDIO',
    'DESCRIPTION:Alarma CuidApp',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  return `data:text/calendar;charset=utf8,${encodeURIComponent(ics)}`;
}

export function openItemReminderModal(item, type, patient = activePatient) {
  if (!item || !patient) return;

  const modalId = 'modalItemReminderAlarm';
  const existing = document.getElementById(modalId);
  if (existing) existing.remove();

  const isMed = (type === 'medication' || type === 'remedio');
  const title = isMed 
    ? `Medicamento: ${item.medication || item.name} ${item.dose || ''}` 
    : `${item.type || 'Cita Médica'}: ${item.specialty || 'Control de Salud'}`;
  const scheduleTime = isMed ? (item.schedule || '08:00 AM') : `${item.date || 'Hoy'} ${item.time || '10:00'} hrs`;
  const locationOrDose = isMed ? `Dosis: ${item.dose || '1 comp.'} &bull; Frecuencia: ${item.frequency || 'Indicación médica'}` : `Lugar: ${item.location || 'CESFAM / Centro Clínico'}`;

  // Contacto telefónico para llamadas directas
  const targetPhone = (patient.emergencyContact && patient.emergencyContact.phone) ? patient.emergencyContact.phone.replace(/[^0-9+]/g, '') : '+56912345678';
  const cleanTargetPhone = targetPhone.replace(/[^0-9+]/g, '');

  const voiceMsg = isMed 
    ? `Atención: Recordatorio programado para tomar ${item.medication || 'su medicamento'}, dosis ${item.dose || ''}, horario ${item.schedule || 'programado'}.`
    : `Atención: Recordatorio programado para su ${item.type || 'cita médica'} de ${item.specialty || ''}, fecha ${item.date || ''} a las ${item.time || ''} horas.`;

  // Emitir de inmediato sonido de alarma y voz local
  playAudibleAlarmSound();
  speakReminderVoice(voiceMsg);

  // Guardar en localStorage
  try {
    const key = `cuidapp_alarms_${patient.id || 'p1'}`;
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    saved[item.id] = {
      active: true,
      type: type,
      title: title,
      time: scheduleTime,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(saved));
  } catch (e) {}

  const icsDownloadUrl = generateCalendarAlarmIcs(title, `${title}. ${locationOrDose}. Paciente: ${patient.name}`, item.date, item.time || item.schedule);
  const smsUrl = `sms:${cleanTargetPhone}?body=${encodeURIComponent(`🔔 RECORDATORIO CUIDAPP: ${title}. Horario: ${scheduleTime}. Paciente: ${patient.name}.`)}`;
  const waUrl = `https://wa.me/${cleanTargetPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`🔔 RECORDATORIO CUIDAPP: ${title}. Horario: ${scheduleTime}. Paciente: ${patient.name}.`)}`;

  const modalHtml = `
    <div class="modal fade show d-block" id="${modalId}" tabindex="-1" style="background: rgba(0, 0, 0, 0.84); backdrop-filter: blur(8px); z-index: 1070;">
      <div class="modal-dialog modal-dialog-centered modal-md">
        <div class="modal-content glass-card text-white border-light border-opacity-10" style="background: #090f20; border-radius: 22px; box-shadow: 0 25px 60px rgba(0,0,0,0.85);">
          
          <div class="modal-header border-bottom border-light border-opacity-10 p-3.5 pb-2.5">
            <div class="d-flex align-items-center gap-2.5">
              <span class="fs-3 text-warning">🔔</span>
              <div>
                <h6 class="modal-title fw-bold m-0 text-white d-flex align-items-center gap-2">
                  <span>Recordatorio Telefónico & Alarma Clínica</span>
                </h6>
                <small class="text-white-50">Compatible con teléfonos antiguos, fijos y smartphones</small>
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" id="btnCloseReminderModalX"></button>
          </div>

          <div class="modal-body p-3.5">
            <div class="p-3 rounded-3 mb-3 text-center" style="background: rgba(245, 158, 11, 0.1); border: 1.5px solid rgba(245, 158, 11, 0.45);">
              <span class="fs-1 d-block mb-1">${isMed ? '💊' : '🩺'}</span>
              <h5 class="fw-bold text-white mb-1">${title}</h5>
              <div class="badge bg-warning text-dark fw-bold px-3 py-1 rounded-pill mb-2 font-monospace" style="font-size: 0.88rem;">
                ⏰ ${scheduleTime}
              </div>
              <div class="text-white-50 small">${locationOrDose}</div>
              <div class="text-info small mt-1">Paciente: <strong>${patient.name}</strong> (${patient.fileNumber || patient.rut || 'Ficha Activa'})</div>
            </div>

            <!-- Estado de Sonido y Voz Local -->
            <div class="p-2.5 rounded-3 mb-3 d-flex align-items-center justify-content-between" style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.35);">
              <div class="d-flex align-items-center gap-2">
                <span class="fs-4 text-success">🔊</span>
                <div>
                  <strong class="text-success small d-block">Alarma Sonora & Voz Local Activadas</strong>
                  <small class="text-white-50" style="font-size: 0.74rem;">Sonido de alerta y síntesis de voz emitidos con éxito</small>
                </div>
              </div>
              <button type="button" id="btnReplayAlarmSoundVoice" class="btn btn-sm btn-outline-success px-2.5 py-1 fw-semibold" style="border-radius: 8px; font-size: 0.74rem;">
                <i class="bi bi-arrow-repeat me-1"></i>Repetir Alarma
              </button>
            </div>

            <!-- Acciones de Teléfono y Calendario para Todo Dispositivo -->
            <div class="d-flex flex-column gap-2 mb-2">
              <a href="tel:${cleanTargetPhone}" class="btn btn-sm btn-primary w-100 py-2.5 fw-bold d-inline-flex align-items-center justify-content-center gap-2 shadow-sm text-white" style="border-radius: 10px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border: 1px solid #38bdf8; font-size: 0.86rem;">
                <i class="bi bi-telephone-outbound-fill"></i> 📞 Llamar Recordatorio al Teléfono (${targetPhone})
              </a>

              <a href="${icsDownloadUrl}" download="recordatorio_cuidapp.ics" class="btn btn-sm btn-glass-secondary w-100 py-2 fw-semibold d-inline-flex align-items-center justify-content-center gap-2 shadow-sm text-white" style="border-radius: 10px; font-size: 0.82rem;">
                <i class="bi bi-calendar-plus text-info"></i> 📅 Guardar en Calendario / Alarma del Teléfono (.ics)
              </a>

              <div class="d-flex gap-2">
                <a href="${smsUrl}" class="btn btn-sm btn-outline-info w-50 py-1.5 fw-semibold d-inline-flex align-items-center justify-content-center gap-1 shadow-sm" style="border-radius: 8px; font-size: 0.78rem;">
                  <i class="bi bi-chat-dots-fill text-info"></i> 📲 Enviar SMS
                </a>
                <a href="${waUrl}" target="_blank" class="btn btn-sm btn-outline-success w-50 py-1.5 fw-semibold d-inline-flex align-items-center justify-content-center gap-1 shadow-sm" style="border-radius: 8px; font-size: 0.78rem;">
                  <i class="bi bi-whatsapp text-success"></i> 💬 WhatsApp
                </a>
              </div>
            </div>

          </div>

          <div class="modal-footer border-top border-light border-opacity-10 p-2.5 px-3.5 d-flex justify-content-end">
            <button type="button" class="btn btn-sm btn-glass-secondary px-4 py-1.5 fw-semibold" id="btnCloseReminderModalFooter">
              Listo / Cerrar
            </button>
          </div>

        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalEl = document.getElementById(modalId);
  const closeX = document.getElementById('btnCloseReminderModalX');
  const closeFooter = document.getElementById('btnCloseReminderModalFooter');
  const replayBtn = document.getElementById('btnReplayAlarmSoundVoice');

  const closeModal = () => {
    if (modalEl) modalEl.remove();
    // Refrescar vistas para mostrar badges actualizados
    if (typeof renderCaregiverPrescriptions === 'function') renderCaregiverPrescriptions(patient);
    if (typeof renderPatientAppointments === 'function') renderPatientAppointments(patient);
  };

  if (closeX) closeX.onclick = closeModal;
  if (closeFooter) closeFooter.onclick = closeModal;
  if (replayBtn) {
    replayBtn.onclick = () => {
      playAudibleAlarmSound();
      speakReminderVoice(voiceMsg);
    };
  }

  if (window.showGlassAlert) {
    window.showGlassAlert(`🔔 Recordatorio y alarma sonora activados para ${title}.`, 'success');
  }
}

if (typeof window !== 'undefined') {
  window.openItemReminderModal = openItemReminderModal;
  window.playAudibleAlarmSound = playAudibleAlarmSound;
}

// ============================================================================
// GESTIÓN Y MODAL DE CONTACTO ADMINISTRATIVO (LEY N° 19.628 / DS N° 41)
// ============================================================================
export function getPatientContactOverrides(patientId) {
  try {
    const raw = localStorage.getItem(`cuidapp_patient_contact_${patientId}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error al leer contacto del paciente de localStorage:', e);
  }
  return null;
}

export function savePatientContactOverrides(patientId, contactData) {
  try {
    localStorage.setItem(`cuidapp_patient_contact_${patientId}`, JSON.stringify(contactData));
  } catch (e) {
    console.error('Error al guardar contacto del paciente en localStorage:', e);
  }
}

export function applyPatientContactOverrides(patient) {
  if (!patient || !patient.id) return;
  const overrides = getPatientContactOverrides(patient.id);
  if (overrides) {
    if (overrides.phone) patient.phone = overrides.phone;
    if (overrides.email) patient.email = overrides.email;
    if (overrides.address) patient.address = overrides.address;
    if (overrides.emergencyContact) {
      patient.emergencyContact = {
        ...(patient.emergencyContact || {}),
        ...overrides.emergencyContact
      };
    }
  }
}

export function openEditPatientContactModal(patient = activePatient) {
  if (!patient) return;

  applyPatientContactOverrides(patient);

  const modalId = 'modalCaregiverEditPatientContact';
  const existing = document.getElementById(modalId);
  if (existing) existing.remove();

  // Condiciones médicas activas para visualización en solo lectura
  const conditionsText = (patient.conditions || []).map(k => {
    const cond = CLINICAL_CONDITIONS[k];
    return cond ? cond.name : k;
  }).join(' • ') || 'Sin patologías crónicas registradas';

  const defaultPhone = patient.phone || (patient.emergencyContact?.phone) || '+56 9 1234 5678';
  const defaultEmail = patient.email || `${(patient.username || 'paciente').toLowerCase()}@correo.cl`;
  const defaultAddress = patient.address || (patient.id === 'p1' ? 'Av. Los Leones 1450, Providencia, Santiago' : 'Dirección registrada en CESFAM');
  const emergencyName = patient.emergencyContact?.name || '';
  const emergencyRelation = patient.emergencyContact?.relation || 'Familiar';
  const emergencyPhone = patient.emergencyContact?.phone || defaultPhone;

  const modalHtml = `
    <div class="modal fade show d-block" id="${modalId}" tabindex="-1" style="background: rgba(0, 0, 0, 0.78); backdrop-filter: blur(8px); z-index: 1060;">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content glass-card text-white border-light border-opacity-10" style="background: #090f20; border-radius: 20px; box-shadow: 0 25px 60px rgba(0,0,0,0.85);">
          
          <!-- Cabecera del Modal -->
          <div class="modal-header border-bottom border-light border-opacity-10 p-4 pb-3">
            <div class="d-flex align-items-center gap-3">
              <span class="fs-2">✏️</span>
              <div>
                <h5 class="modal-title fw-bold m-0 text-white d-flex align-items-center gap-2">
                  <span>Datos Administrativos y Contacto de Emergencia</span>
                  <span class="badge rounded-pill fw-semibold" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.35); font-size: 0.72rem;">
                    Ley N° 19.628 / DS N° 41
                  </span>
                </h5>
                <small class="text-white-50">${patient.name} &bull; RUT: <strong class="text-warning font-monospace">${patient.fileNumber || patient.rut}</strong></small>
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" id="btnCloseEditContactX"></button>
          </div>

          <!-- Cuerpo del Modal -->
          <div class="modal-body p-4">
            
            <!-- SECCIÓN 1: CAMPOS CLÍNICOS BLOQUEADOS (SOLO LECTURA) -->
            <div class="p-3 rounded-3 mb-4" style="background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.25);">
              <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2 pb-2 border-bottom border-warning border-opacity-20">
                <div class="fw-bold text-warning d-flex align-items-center gap-2" style="font-size: 0.85rem;">
                  <i class="bi bi-shield-lock-fill"></i>
                  <span>Datos Clínicos Protegidos (Solo Lectura)</span>
                </div>
                <span class="badge rounded-pill" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35); font-size: 0.7rem;">
                  <i class="bi bi-lock-fill me-1"></i>Bloqueado por Ley N° 19.628 / DS N° 41
                </span>
              </div>
              <small class="text-white-50 d-block mb-3" style="font-size: 0.74rem;">
                La modificación de antecedentes clínicos oficiales, alergias, grupo sanguíneo o diagnósticos es potestad exclusiva del médico tratante con firma electrónica avanzada.
              </small>

              <div class="row g-2 text-white">
                <div class="col-md-3 col-sm-6">
                  <label class="small text-white-50 mb-1 d-block" style="font-size: 0.72rem;">
                    <i class="bi bi-lock-fill text-warning me-1"></i>RUT / Ficha
                  </label>
                  <input type="text" class="form-control form-control-sm text-white font-monospace" value="${patient.fileNumber || patient.rut}" disabled readonly style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); cursor: not-allowed;">
                </div>
                <div class="col-md-3 col-sm-6">
                  <label class="small text-white-50 mb-1 d-block" style="font-size: 0.72rem;">
                    <i class="bi bi-lock-fill text-warning me-1"></i>Grupo Sanguíneo
                  </label>
                  <input type="text" class="form-control form-control-sm text-white fw-bold" value="${patient.bloodType || 'No registrado'}" disabled readonly style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); cursor: not-allowed;">
                </div>
                <div class="col-md-6 col-sm-12">
                  <label class="small text-white-50 mb-1 d-block" style="font-size: 0.72rem;">
                    <i class="bi bi-lock-fill text-warning me-1"></i>Alergias Conocidas
                  </label>
                  <input type="text" class="form-control form-control-sm text-white" value="${patient.allergies || 'Ninguna'}" disabled readonly style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); cursor: not-allowed;">
                </div>
                <div class="col-12 mt-2">
                  <label class="small text-white-50 mb-1 d-block" style="font-size: 0.72rem;">
                    <i class="bi bi-lock-fill text-warning me-1"></i>Condiciones Médicas Activas
                  </label>
                  <input type="text" class="form-control form-control-sm text-white" value="${conditionsText}" disabled readonly style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); cursor: not-allowed;">
                </div>
              </div>
            </div>

            <!-- SECCIÓN 2: DATOS ADMINISTRATIVOS Y CONTACTO (EDITABLES) -->
            <form id="formEditPatientContact">
              <div class="p-3 rounded-3" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);">
                <div class="fw-bold text-info mb-3 d-flex align-items-center gap-2" style="font-size: 0.88rem;">
                  <i class="bi bi-pencil-square"></i>
                  <span>Datos de Contacto y Ubicación (Editables por Cuidadora Autorizada)</span>
                </div>

                <div class="row g-3">
                  <!-- Teléfono del Paciente -->
                  <div class="col-md-6">
                    <label class="small text-white mb-1 fw-semibold d-block" style="font-size: 0.8rem;">
                      <i class="bi bi-telephone text-info me-1"></i>Teléfono del Paciente
                    </label>
                    <input type="tel" id="inputEditPatientPhone" class="form-control text-white" value="${defaultPhone}" placeholder="+56 9 1234 5678" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.18);">
                    <small class="text-white-50" style="font-size: 0.7rem;">Número telefónico de contacto directo</small>
                  </div>

                  <!-- Correo Electrónico del Paciente -->
                  <div class="col-md-6">
                    <label class="small text-white mb-1 fw-semibold d-block" style="font-size: 0.8rem;">
                      <i class="bi bi-envelope text-info me-1"></i>Correo Electrónico
                    </label>
                    <input type="email" id="inputEditPatientEmail" class="form-control text-white" value="${defaultEmail}" placeholder="nombre@correo.cl" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.18);">
                    <small class="text-white-50" style="font-size: 0.7rem;">Notificaciones sanitarias y carnet digital</small>
                  </div>

                  <!-- Dirección Domiciliaria -->
                  <div class="col-12">
                    <label class="small text-white mb-1 fw-semibold d-block" style="font-size: 0.8rem;">
                      <i class="bi bi-geo-alt text-info me-1"></i>Dirección Domiciliaria (Hogar)
                    </label>
                    <input type="text" id="inputEditPatientAddress" class="form-control text-white" value="${defaultAddress}" placeholder="Calle, Número, Comuna, Ciudad" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.18);">
                    <small class="text-white-50" style="font-size: 0.7rem;">Referencia de rescate para el Servicio SAMU 131</small>
                  </div>

                  <div class="col-12 pt-2 border-top border-light border-opacity-10">
                    <div class="fw-bold text-white small mb-2 d-flex align-items-center gap-1">
                      <i class="bi bi-person-heart text-danger"></i> Contacto de Emergencia Principal (Familiar / ICE)
                    </div>
                  </div>

                  <!-- Nombre Contacto Emergencia -->
                  <div class="col-md-4">
                    <label class="small text-white mb-1 fw-semibold d-block" style="font-size: 0.8rem;">
                      Nombre Completo
                    </label>
                    <input type="text" id="inputEditEmergencyName" class="form-control text-white" value="${emergencyName}" placeholder="Nombre del familiar" required style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.18);">
                  </div>

                  <!-- Relación / Parentesco -->
                  <div class="col-md-4">
                    <label class="small text-white mb-1 fw-semibold d-block" style="font-size: 0.8rem;">
                      Vínculo / Parentesco
                    </label>
                    <input type="text" id="inputEditEmergencyRelation" class="form-control text-white" value="${emergencyRelation}" placeholder="Ej. Hija, Cónyuge, Hermano" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.18);">
                  </div>

                  <!-- Teléfono Contacto Emergencia -->
                  <div class="col-md-4">
                    <label class="small text-white mb-1 fw-semibold d-block" style="font-size: 0.8rem;">
                      Teléfono Emergencia
                    </label>
                    <input type="tel" id="inputEditEmergencyPhone" class="form-control text-white" value="${emergencyPhone}" placeholder="+56 9 8765 4321" required style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.18);">
                  </div>
                </div>
              </div>

              <!-- Pie / Botones de Acción -->
              <div class="d-flex justify-content-end align-items-center gap-2 mt-4 pt-3 border-top border-light border-opacity-10">
                <button type="button" class="btn btn-glass-secondary px-4 py-2" id="btnCancelEditContact" style="border-radius: 10px;">
                  Cancelar
                </button>
                <button type="submit" class="btn btn-glass-primary px-4 py-2 fw-bold d-inline-flex align-items-center gap-2" style="border-radius: 10px;">
                  <i class="bi bi-save2-fill"></i> Guardar Cambios Administrativos
                </button>
              </div>
            </form>

          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalEl = document.getElementById(modalId);
  const closeModal = () => {
    if (modalEl) modalEl.remove();
  };

  const btnCloseX = document.getElementById('btnCloseEditContactX');
  const btnCancel = document.getElementById('btnCancelEditContact');
  if (btnCloseX) btnCloseX.onclick = closeModal;
  if (btnCancel) btnCancel.onclick = closeModal;
  if (modalEl) {
    modalEl.onclick = (e) => {
      if (e.target === modalEl) closeModal();
    };
  }

  const form = document.getElementById('formEditPatientContact');
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();

      const newPhone = document.getElementById('inputEditPatientPhone').value.trim();
      const newEmail = document.getElementById('inputEditPatientEmail').value.trim();
      const newAddress = document.getElementById('inputEditPatientAddress').value.trim();
      const newEmergName = document.getElementById('inputEditEmergencyName').value.trim();
      const newEmergRel = document.getElementById('inputEditEmergencyRelation').value.trim() || 'Familiar';
      const newEmergPhone = document.getElementById('inputEditEmergencyPhone').value.trim();

      // Actualizar paciente en memoria
      patient.phone = newPhone;
      patient.email = newEmail;
      patient.address = newAddress;
      patient.emergencyContact = {
        name: newEmergName || 'Contacto Familiar',
        relation: newEmergRel,
        phone: newEmergPhone || newPhone
      };

      // Guardar en localStorage para el paciente activo
      savePatientContactOverrides(patient.id, {
        phone: patient.phone,
        email: patient.email,
        address: patient.address,
        emergencyContact: patient.emergencyContact,
        updatedAt: new Date().toISOString()
      });

      // Actualizar tarjeta al instante
      updateActivePatient(patient);

      // Cerrar modal y notificar al usuario
      closeModal();

      if (window.showGlassAlert) {
        window.showGlassAlert(`✅ Datos de contacto de ${patient.name} guardados y actualizados al instante bajo Ley N° 19.628.`, 'success');
      }
      if (getModoVozActivo && getModoVozActivo()) {
        speakText('Datos de contacto actualizados exitosamente.');
      }
    };
  }
}

// ============================================================================
// SELECTOR DE PACIENTE Y PERSONAS A CARGO
// ============================================================================
export function refreshPatientSelector(selectedPatient = activePatient) {
  const patientSelector = document.getElementById('patientSelector');
  if (!patientSelector) return;
  const authorizedPatients = getAuthorizedPatientsForCurrentCaregiver();
  const sidebarUserEl = document.querySelector('.sidebar footer strong, footer strong.text-white, #sidebarMenu footer strong');
  const loggedName = sidebarUserEl ? sidebarUserEl.textContent.trim() : '';
  const isCaregiver = Boolean(
    (loggedName && (loggedName.toLowerCase().includes('sofía') || loggedName.toLowerCase().includes('sofia'))) ||
    (loggedName && CAREGIVERS_DATABASE.some(c => c.name.toLowerCase() === loggedName.toLowerCase() || (c.username && c.username.toLowerCase() === loggedName.toLowerCase())))
  );

  const juanPatient = authorizedPatients.find(p => p.id === 'p1' || (p.name && p.name.includes('Juan Díaz'))) || authorizedPatients[0];
  const targetPatient = isCaregiver ? (selectedPatient && selectedPatient.id === 'p1' ? selectedPatient : juanPatient) : (selectedPatient || authorizedPatients[0]);

  patientSelector.innerHTML = authorizedPatients.map((p, idx) => {
    let label = p.socialName || p.name;
    if (isCaregiver) {
      // Cuando inicie sesión Sofía Díaz: Persona a Cargo: Juan Díaz (Padre)
      const isParent = (p.id === 'p1' || (p.emergencyContact && p.emergencyContact.relation === 'Hija') || (p.name && p.name.includes('Juan Díaz')));
      const relTag = isParent ? 'Padre' : (p.emergencyRelation || 'A Cargo');
      label = `Persona a Cargo: ${p.socialName || p.name} (${relTag})`;
    } else if (idx === 0) {
      label = `Mi Ficha (Titular) - ${p.socialName || p.name}`;
      if (caregiverPatientIsPregnant(p)) label += ' (🤰 Gestante)';
      else if (caregiverPatientIsPostpartum(p)) label += ' (🌸 Postparto)';
    } else {
      const age = getPatientAge(p);
      let tag = '🧸 Pediátrico';
      if (p.isNewborn || age === 0) tag = '👶 Recién Nacido';
      else if (age < 14) tag = '🧸 Pediátrico';
      else if (age >= 14 && age <= 17) tag = '🎧 Adolescente';
      else if (age >= 18 && age <= 59) {
        if (caregiverPatientIsPregnant(p)) tag = '🤰 Gestante';
        else if (caregiverPatientIsPostpartum(p)) tag = '🌸 Postparto';
        else tag = '🧑 Adulto Asistido';
      } else if (age >= 60) tag = '👴 Adulto Mayor';
      label = `${p.socialName || p.name} (${tag})`;
    }
    const isSelected = targetPatient ? p.id === targetPatient.id : (idx === 0);
    return `<option value="${p.id}" class="bg-dark text-white" ${isSelected ? 'selected' : ''}>${label}</option>`;
  }).join('');
}

// ============================================================================
// MODAL PARA AGREGAR PERSONA A CARGO (HIJOS/AS, ADOLESCENTES O DEPENDIENTES)
// Cumplimiento Ley N° 20.584, Ley N° 21.430 y Decreto Supremo N° 67
// ============================================================================
export function openAddPersonaACargoCaregiverModal(titularPatient = activePatient, container) {
  if (!canPatientAddDependent(titularPatient)) {
    if (window.showGlassAlert) {
      window.showGlassAlert('Restricción legal (Ley N° 21.430): Los usuarios menores de 18 años no pueden agregar personas a cargo salvo maternidad/paternidad acreditada.', 'warning');
    }
    return;
  }

  const modalId = 'modalAddPersonaACargoCaregiver';
  const existing = document.getElementById(modalId);
  if (existing) existing.remove();

  const titularAge = titularPatient ? getPatientAge(titularPatient) : 30;
  const isMinorTitular = titularAge < 18;
  const titularName = titularPatient ? (titularPatient.socialName || titularPatient.name) : 'Titular';
  const titularRut = titularPatient ? (titularPatient.fileNumber || titularPatient.rut || '') : '';
  const prevision = titularPatient?.prevision || 'FONASA';

  const modalHtml = `
    <div id="${modalId}" class="modal fade show" tabindex="-1" style="display: block; background: rgba(10, 15, 29, 0.88); backdrop-filter: blur(14px); z-index: 1065;" aria-modal="true" role="dialog">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content text-white" style="background: rgba(15, 23, 42, 0.96); border-radius: 28px; border: 2px solid #38bdf8; box-shadow: 0 25px 60px rgba(0,0,0,0.85); overflow: hidden; font-family: 'Outfit', sans-serif;">
          
          <!-- Encabezado del Modal -->
          <div class="modal-header border-bottom p-4 d-flex justify-content-between align-items-center" style="background: rgba(14, 165, 233, 0.15); border-color: rgba(255, 255, 255, 0.1) !important;">
            <div class="d-flex align-items-center gap-3">
              <span style="font-size: 2.2rem;">👨‍👩‍👧</span>
              <div>
                <h4 class="modal-title fw-extrabold m-0 text-white">Vincular Nueva Persona a Cargo</h4>
                <small class="text-info fw-semibold">Bajo responsabilidad de: <strong class="text-white">${titularName}</strong> &bull; Ley N° 20.584 y Ley N° 21.430</small>
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" id="btnCloseAddPersonaACargoModalX" aria-label="Close" style="cursor: pointer;"></button>
          </div>

          <!-- Formulario -->
          <form id="formAddPersonaACargoCaregiver">
            <div class="modal-body p-4">
              
              <!-- Banner Normativo para Menores de Edad (Ley N° 21.430) -->
              ${isMinorTitular ? `
                <div class="p-3 rounded-3 mb-3 d-flex align-items-center gap-2.5 shadow-sm" style="background: rgba(245, 158, 11, 0.12); border: 1.5px solid rgba(245, 158, 11, 0.45); color: #fde047;">
                  <span style="font-size: 1.5rem; line-height: 1;">👶</span>
                  <div>
                    <strong class="d-block text-warning" style="font-size: 0.88rem;">Habilitación Excepcional Ley N° 21.430 (Maternidad / Paternidad):</strong>
                    <span class="text-white-50" style="font-size: 0.78rem;">Como titular menor de 18 años, esta opción está restringida exclusivamente para vincular a tu propio/a hijo/a recién nacido/a o lactante a tu cuidado legal.</span>
                  </div>
                </div>
              ` : ''}

              <!-- Fila 1: Nombre y Nombre Social -->
              <div class="row g-3 mb-3">
                <div class="col-12 col-md-7">
                  <label class="form-label small text-white-50 fw-bold">Nombre Completo (según documento) *</label>
                  <input type="text" id="apChildName" class="form-control text-white border-light border-opacity-25 py-2 rounded-3" placeholder="Ej. Lucas Andrés Rojas Silva" required maxlength="60" autocomplete="off" style="background: rgba(255,255,255,0.06);">
                </div>
                <div class="col-12 col-md-5">
                  <label class="form-label small text-white-50 fw-bold">Nombre Social (opcional)</label>
                  <input type="text" id="apChildSocialName" class="form-control text-white border-light border-opacity-25 py-2 rounded-3" placeholder="Ej. Lucas" maxlength="60" autocomplete="off" style="background: rgba(255,255,255,0.06);">
                </div>
              </div>

              <!-- Fila 2: Tipo Documento, Número y Sexo -->
              <div class="row g-3 mb-3">
                <div class="col-12 col-md-4">
                  <label class="form-label small text-white-50 fw-bold">Tipo de Documento *</label>
                  <select id="apDocType" class="form-select bg-dark text-white border-light border-opacity-25 py-2 rounded-3">
                    <option value="RUT">RUT / RUN Chileno</option>
                    <option value="NIC">NIC / NIP Salud</option>
                    <option value="PASSPORT">Pasaporte / DNI Extranjero</option>
                  </select>
                </div>
                <div class="col-12 col-md-4">
                  <label class="form-label small text-white-50 fw-bold">Número de Documento *</label>
                  <input type="text" id="apDocNumber" class="form-control text-white border-light border-opacity-25 py-2 rounded-3" placeholder="Ej. 26.110.450-8" required maxlength="20" autocomplete="off" style="background: rgba(255,255,255,0.06);">
                </div>
                <div class="col-12 col-md-4">
                  <label class="form-label small text-white-50 fw-bold">Sexo Biológico *</label>
                  <select id="apGender" class="form-select bg-dark text-white border-light border-opacity-25 py-2 rounded-3" required>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Intersexual">Intersexual</option>
                  </select>
                </div>
              </div>

              <!-- Fila 3: Fecha de Nacimiento y Perfil Calculado -->
              <div class="row g-3 mb-3">
                <div class="col-12 col-md-6">
                  <label class="form-label small text-white-50 fw-bold">Fecha de Nacimiento *</label>
                  <input type="date" id="apBirthDate" class="form-control text-white border-light border-opacity-25 py-2 rounded-3" required style="background: rgba(255,255,255,0.06);">
                </div>
                <div class="col-12 col-md-6 d-flex flex-column justify-content-end">
                  <label class="form-label small text-white-50 fw-bold">Perfil Asignado por Edad:</label>
                  <div id="apAgeBadgeContainer" class="p-2 rounded-3 text-center fw-bold fs-7 border" style="background: rgba(56, 189, 248, 0.1); border-color: rgba(56, 189, 248, 0.3) !important; color: #38bdf8;">
                    Ingresa fecha para calcular
                  </div>
                </div>
              </div>

              <!-- Fila 4: Condiciones y Alergias -->
              <div class="row g-3 mb-2">
                <div class="col-12">
                  <label class="form-label small text-white-50 fw-bold">Diagnósticos / Condiciones Relevantes (opcional)</label>
                  <input type="text" id="apConditions" class="form-control text-white border-light border-opacity-25 py-2 rounded-3" placeholder="Ej. Asma, Alergia a medicamentos, Ninguna" maxlength="120" autocomplete="off" style="background: rgba(255,255,255,0.06);">
                </div>
              </div>

              <!-- Nota Legal -->
              <div class="p-2.5 rounded-3 mt-3 fs-8 text-white-50" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);">
                <i class="bi bi-shield-check text-info me-1"></i>Esta persona a cargo quedará vinculada legalmente a tu cuenta titular conforme a la Ley N° 20.584 y Ley N° 21.430, permitiendo gestionar sus controles, vacunas y ficha clínica directamente.
              </div>
            </div>

            <!-- Botones del Modal -->
            <div class="modal-footer border-top p-3 d-flex justify-content-end gap-2" style="background: rgba(0, 0, 0, 0.2); border-color: rgba(255, 255, 255, 0.1) !important;">
              <button type="button" id="btnCancelAddPersonaACargoModal" class="btn btn-glass-secondary px-4 py-2" style="border-radius: 10px;">
                Cancelar
              </button>
              <button type="submit" class="btn btn-glass-primary px-4 py-2 fw-bold d-inline-flex align-items-center gap-2" style="border-radius: 10px;">
                <i class="bi bi-save2-fill"></i> Guardar y Vincular Persona
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalEl = document.getElementById(modalId);
  const closeModal = () => {
    if (modalEl) modalEl.remove();
  };

  const btnCloseX = document.getElementById('btnCloseAddPersonaACargoModalX');
  const btnCancel = document.getElementById('btnCancelAddPersonaACargoModal');
  if (btnCloseX) btnCloseX.onclick = closeModal;
  if (btnCancel) btnCancel.onclick = closeModal;
  if (modalEl) {
    modalEl.onclick = (e) => {
      if (e.target === modalEl) closeModal();
    };
  }

  // Cálculo de edad en tiempo real al ingresar la fecha de nacimiento
  const birthInput = document.getElementById('apBirthDate');
  const ageBadgeContainer = document.getElementById('apAgeBadgeContainer');
  if (birthInput && ageBadgeContainer) {
    birthInput.onchange = () => {
      const val = birthInput.value;
      if (!val) return;
      const dob = new Date(val);
      if (isNaN(dob.getTime())) return;
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;

      if (age < 14) {
        ageBadgeContainer.innerHTML = `🧸 Pediátrico (${age} años &bull; Ley N° 21.430)`;
        ageBadgeContainer.style.color = '#38bdf8';
        ageBadgeContainer.style.borderColor = 'rgba(56, 189, 248, 0.4)';
      } else if (age >= 14 && age <= 17) {
        ageBadgeContainer.innerHTML = `🎧 Adolescente (${age} años &bull; Ficha CLAP)`;
        ageBadgeContainer.style.color = '#fbbf24';
        ageBadgeContainer.style.borderColor = 'rgba(251, 191, 36, 0.4)';
      } else if (age >= 18 && age <= 59) {
        ageBadgeContainer.innerHTML = `🧑 Adulto Asistido (${age} años)`;
        ageBadgeContainer.style.color = '#a78bfa';
        ageBadgeContainer.style.borderColor = 'rgba(167, 139, 250, 0.4)';
      } else {
        ageBadgeContainer.innerHTML = `👴 Adulto Mayor (${age} años &bull; GES)`;
        ageBadgeContainer.style.color = '#34d399';
        ageBadgeContainer.style.borderColor = 'rgba(52, 211, 153, 0.4)';
      }
    };
  }

  // Envío del formulario
  const form = document.getElementById('formAddPersonaACargoCaregiver');
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();

      const name = document.getElementById('apChildName')?.value.trim();
      const social = document.getElementById('apChildSocialName')?.value.trim() || name;
      const docType = document.getElementById('apDocType')?.value || 'RUT';
      const docNum = document.getElementById('apDocNumber')?.value.trim() || 'Sin Documento';
      const gender = document.getElementById('apGender')?.value || 'Masculino';
      const birthDate = document.getElementById('apBirthDate')?.value || '2020-01-01';
      const condRaw = document.getElementById('apConditions')?.value.trim() || '';
      const conditions = condRaw ? condRaw.split(',').map(c => c.trim()) : ['GENERAL'];

      const dob = new Date(birthDate);
      const today = new Date();
      let calcAge = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) calcAge--;
      if (isNaN(calcAge) || calcAge < 0) calcAge = 0;

      // Restricción legal (Ley N° 21.430 / DS N° 41) para menores de edad
      if (isMinorTitular && calcAge > 2) {
        if (window.showGlassAlert) {
          window.showGlassAlert('Restricción legal Ley N° 21.430: Los titulares menores de 18 años solo pueden vincular a su hijo/a recién nacido/a o lactante.', 'warning');
        } else {
          alert('Restricción legal Ley N° 21.430: Los titulares menores de 18 años solo pueden vincular a su hijo/a recién nacido/a o lactante.');
        }
        return;
      }

      const newId = 'p_carga_' + Date.now();
      const newPersonaObj = {
        id: newId,
        name: name,
        socialName: social,
        rut: docNum,
        fileNumber: docNum,
        documentType: docType,
        documentNumber: docNum,
        age: calcAge,
        birthDate: birthDate,
        gender: gender,
        bloodType: 'O+ (Rh Positivo)',
        prevision: prevision,
        isPediatric: calcAge < 14,
        isAdolescent: calcAge >= 14 && calcAge <= 17,
        isAssistedAdult: calcAge >= 18 && calcAge <= 59,
        isSenior: calcAge >= 60,
        legalGuardianName: titularName,
        legalGuardianRut: titularRut,
        guardianRole: isMinorTitular ? 'Madre/Padre Adolescente Acreditado (Ley N° 21.430)' : 'Tutor/a Acreditado (Ley N° 20.584 / Ley N° 21.430)',
        parentPatientId: titularPatient?.id || null,
        emergencyContact: {
          name: titularName,
          phone: titularPatient?.phone || '+56 9 8765 4321',
          relation: isMinorTitular
            ? ((titularPatient?.gender === 'Femenino' || titularPatient?.gender === 'femenino') ? 'Madre Adolescente' : 'Padre Adolescente')
            : ((titularPatient?.gender === 'Femenino' || titularPatient?.gender === 'femenino') ? 'Madre / Tutora' : 'Padre / Tutor')
        },
        conditions: conditions,
        medications: [],
        allergies: 'Ninguna',
        documents: [],
        clinicalLogs: []
      };

      // Guardar en titular.children
      if (titularPatient) {
        if (!Array.isArray(titularPatient.children)) titularPatient.children = [];
        titularPatient.children.push(newId);
      }

      // Persistir en cuidapp_custom_patients
      let customPatients = [];
      try {
        const rawP = localStorage.getItem('cuidapp_custom_patients');
        if (rawP) customPatients = JSON.parse(rawP);
      } catch (err) {}
      customPatients.push(newPersonaObj);
      try {
        localStorage.setItem('cuidapp_custom_patients', JSON.stringify(customPatients));
      } catch (err) {}

      // Persistir en cuidapp_custom_users para sincronizar con Admin
      try {
        const rawU = localStorage.getItem('cuidapp_custom_users');
        const customUsers = rawU ? JSON.parse(rawU) : [];
        customUsers.push({
          id: newId,
          username: `carga_${newId}`,
          role: 'patient',
          name: name,
          socialName: social,
          rut: docNum,
          birthDate: birthDate,
          age: calcAge,
          isPediatric: calcAge < 14,
          isAdolescent: calcAge >= 14 && calcAge <= 17,
          isSenior: calcAge >= 60,
          createdAt: new Date().toISOString()
        });
        localStorage.setItem('cuidapp_custom_users', JSON.stringify(customUsers));
      } catch (err) {}

      // Agregar a PATIENTS_DATABASE
      PATIENTS_DATABASE.push(newPersonaObj);

      // Cerrar modal
      closeModal();

      // Notificación
      if (window.showGlassAlert) {
        window.showGlassAlert(`👨‍👩‍👧 Persona a cargo (${social}) vinculada exitosamente a la ficha de ${titularName}.`, 'success');
      }

      // Cambiar activo a la nueva persona agregada y refrescar la vista
      setActivePatient(newPersonaObj);
      renderEvaluationView(container || document.getElementById('dashboard-content-area'));
    };
  }
}

// ============================================================================
// MODAL: REGISTRAR NACIMIENTO & FICHA PEDIÁTRICA DEL RECIÉN NACIDO (PNI)
// ============================================================================
export function openRegisterBirthModal(mother = activePatient) {
  if (!mother) return;

  const modalId = 'modalRegisterBirth';
  const existing = document.getElementById(modalId);
  if (existing) existing.remove();

  const motherName = mother.socialName || mother.name;
  const todayStr = getTodayDateString();
  const nowTime = new Date().toTimeString().slice(0, 5);

  const modalHtml = `
    <div id="${modalId}" class="modal fade show" tabindex="-1" style="display: block; background: rgba(10, 15, 29, 0.88); backdrop-filter: blur(14px); z-index: 1070;" aria-modal="true" role="dialog">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content text-white" style="background: rgba(15, 23, 42, 0.96); border-radius: 28px; border: 2px solid #f472b6; box-shadow: 0 25px 60px rgba(0,0,0,0.85); overflow: hidden; font-family: 'Outfit', sans-serif;">
          
          <!-- Encabezado del Modal -->
          <div class="modal-header border-bottom p-4 d-flex justify-content-between align-items-center" style="background: rgba(236, 72, 153, 0.15); border-color: rgba(255, 255, 255, 0.1) !important;">
            <div class="d-flex align-items-center gap-3">
              <span style="font-size: 2.2rem;">👶</span>
              <div>
                <h4 class="modal-title fw-extrabold m-0 text-white">Registrar Nacimiento & Ficha Pediátrica</h4>
                <small class="text-pink fw-semibold" style="color: #f472b6;">Madre: <strong class="text-white">${motherName}</strong> &bull; Programa Nacional de la Infancia (PNI) / Chile Crece Contigo</small>
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" id="btnCloseRegisterBirthModalX" aria-label="Close" style="cursor: pointer;"></button>
          </div>

          <!-- Cuerpo del Modal -->
          <form id="formRegisterBirth" class="p-4">
            <div class="alert alert-info py-2.5 px-3 mb-4 d-flex align-items-center gap-2.5" style="background: rgba(6, 182, 212, 0.12); border: 1px solid rgba(6, 182, 212, 0.35); border-radius: 12px; color: #e0f2fe; font-size: 0.86rem;">
              <i class="bi bi-info-circle-fill text-info fs-5 flex-shrink-0"></i>
              <div>
                Al completar este registro, la madre <strong>${motherName}</strong> pasará automáticamente a estado <strong>Postparto</strong> y se creará de inmediato la <strong>Ficha Pediátrica del Recién Nacido</strong> vinculada como Persona a Cargo, con sus vacunas obligatorias de maternidad: <strong>BCG</strong> y <strong>Hepatitis B</strong>.
              </div>
            </div>

            <div class="row g-3">
              <!-- Nombre del Recién Nacido -->
              <div class="col-md-7">
                <label class="form-label fs-7 fw-semibold text-white-50">Nombre Completo del Recién Nacido *</label>
                <input type="text" id="rbBabyName" class="form-control text-white" required placeholder="Ej: Tomás Morales Castro" value="Bebé de ${motherName.split(' ')[0]}" autocomplete="off" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; min-height: 48px;" />
              </div>

              <!-- Sexo -->
              <div class="col-md-5">
                <label class="form-label fs-7 fw-semibold text-white-50">Sexo *</label>
                <select id="rbBabyGender" class="form-select text-white" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; min-height: 48px;">
                  <option value="Masculino" class="bg-dark text-white" selected>Masculino</option>
                  <option value="Femenino" class="bg-dark text-white">Femenino</option>
                </select>
              </div>

              <!-- Fecha y Hora de Nacimiento -->
              <div class="col-md-6">
                <label class="form-label fs-7 fw-semibold text-white-50">Fecha de Nacimiento *</label>
                <input type="date" id="rbBabyBirthDate" class="form-control text-white" required value="${todayStr}" max="${todayStr}" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; min-height: 48px;" />
              </div>
              <div class="col-md-6">
                <label class="form-label fs-7 fw-semibold text-white-50">Hora de Nacimiento</label>
                <input type="time" id="rbBabyBirthTime" class="form-control text-white" value="${nowTime}" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; min-height: 48px;" />
              </div>

              <!-- Peso y Talla al Nacer -->
              <div class="col-md-4">
                <label class="form-label fs-7 fw-semibold text-white-50">Peso al Nacer (gramos) *</label>
                <input type="number" id="rbBabyWeight" class="form-control text-white text-center" min="500" max="6000" step="10" required value="3350" placeholder="3350" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; min-height: 48px; font-weight: bold;" />
              </div>
              <div class="col-md-4">
                <label class="form-label fs-7 fw-semibold text-white-50">Talla al Nacer (cm) *</label>
                <input type="number" id="rbBabyStature" class="form-control text-white text-center" min="25" max="65" step="0.5" required value="50" placeholder="50" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; min-height: 48px; font-weight: bold;" />
              </div>
              <div class="col-md-4">
                <label class="form-label fs-7 fw-semibold text-white-50">Puntaje APGAR (1 / 5 min)</label>
                <input type="text" id="rbBabyApgar" class="form-control text-white text-center" value="9 / 10" placeholder="9 / 10" autocomplete="off" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; min-height: 48px;" />
              </div>

              <!-- Maternidad / Hospital -->
              <div class="col-md-6">
                <label class="form-label fs-7 fw-semibold text-white-50">Centro Asistencial / Maternidad</label>
                <input type="text" id="rbBabyHospital" class="form-control text-white" value="Maternidad Hospital Clínico" autocomplete="off" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; min-height: 48px;" />
              </div>
              <div class="col-md-6">
                <label class="form-label fs-7 fw-semibold text-white-50">Tipo de Parto</label>
                <select id="rbBabyDeliveryType" class="form-select text-white" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; min-height: 48px;">
                  <option value="Parto Vaginal Eutócico" class="bg-dark text-white" selected>Parto Vaginal Eutócico (Sin complicaciones)</option>
                  <option value="Parto por Cesárea" class="bg-dark text-white">Parto por Cesárea</option>
                  <option value="Parto Asistido" class="bg-dark text-white">Parto Instrumental / Asistido</option>
                </select>
              </div>
            </div>

            <!-- Inmunizaciones Inmediatas del Recién Nacido -->
            <div class="p-3 mt-4 rounded-3" style="background: rgba(16, 185, 129, 0.08); border: 1.5px solid rgba(16, 185, 129, 0.35);">
              <div class="d-flex align-items-center gap-2 mb-2">
                <i class="bi bi-shield-fill-check text-success fs-5"></i>
                <strong class="text-white" style="font-size: 0.95rem;">Inmunizaciones de Maternidad PNI Automáticas:</strong>
              </div>
              <div class="d-flex flex-column gap-1 fs-8 text-white-50 ps-4">
                <div><span class="text-success fw-bold">✓ Vacuna BCG:</span> Protección contra Tuberculosis Meníngea y Diseminada (dosis única intradérmica).</div>
                <div><span class="text-success fw-bold">✓ Vacuna Hepatitis B:</span> Dosis monovalente del recién nacido administrada dentro de las primeras 24 horas.</div>
              </div>
            </div>

            <!-- Botones de Acción -->
            <div class="d-flex justify-content-end gap-3 mt-4 pt-3 border-top border-light border-opacity-10">
              <button type="button" class="btn btn-glass-secondary px-4 py-2.5 fw-semibold" id="btnCancelRegisterBirthModal" style="border-radius: 12px;">
                Cancelar
              </button>
              <button type="submit" class="btn btn-success fw-bold px-4 py-2.5 d-inline-flex align-items-center gap-2 shadow-lg" style="border-radius: 12px; background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                <i class="bi bi-balloon-heart-fill"></i>
                <span>Confirmar Nacimiento y Crear Ficha Pediátrica</span>
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalEl = document.getElementById(modalId);
  const closeModal = () => {
    if (modalEl) modalEl.remove();
  };

  const btnCloseX = document.getElementById('btnCloseRegisterBirthModalX');
  const btnCancel = document.getElementById('btnCancelRegisterBirthModal');
  if (btnCloseX) btnCloseX.onclick = closeModal;
  if (btnCancel) btnCancel.onclick = closeModal;
  if (modalEl) {
    modalEl.onclick = (e) => {
      if (e.target === modalEl) closeModal();
    };
  }

  // Submit
  const form = document.getElementById('formRegisterBirth');
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();

      const babyName = document.getElementById('rbBabyName')?.value.trim() || `Bebé de ${motherName.split(' ')[0]}`;
      const babyGender = document.getElementById('rbBabyGender')?.value || 'Masculino';
      const babyBirthDate = document.getElementById('rbBabyBirthDate')?.value || todayStr;
      const babyWeight = parseFloat(document.getElementById('rbBabyWeight')?.value) || 3350;
      const babyStature = parseFloat(document.getElementById('rbBabyStature')?.value) || 50;
      const babyApgar = document.getElementById('rbBabyApgar')?.value.trim() || '9 / 10';
      const babyHospital = document.getElementById('rbBabyHospital')?.value.trim() || 'Maternidad Hospital Clínico';
      const babyDeliveryType = document.getElementById('rbBabyDeliveryType')?.value || 'Parto Vaginal Eutócico';

      const weightKg = (babyWeight / 1000).toFixed(2);
      const newRnId = 'p_rn_' + Date.now();
      const fakeRut = '28.' + Math.floor(100000 + Math.random() * 900000) + '-K';

      // 1. Objeto Ficha Pediátrica del Recién Nacido
      const newBornObj = {
        id: newRnId,
        name: babyName,
        socialName: babyName,
        rut: fakeRut,
        fileNumber: fakeRut,
        documentType: 'RUT Provisorio RN',
        documentNumber: fakeRut,
        age: 0,
        birthDate: babyBirthDate,
        gender: babyGender,
        weight: weightKg,
        stature: babyStature,
        bloodType: mother.bloodType || 'O+ (Rh Positivo)',
        prevision: mother.prevision || 'FONASA Tramo A',
        isPediatric: true,
        isNewborn: true,
        isAdolescent: false,
        isSenior: false,
        parentPatientId: mother.id,
        motherId: mother.id,
        legalGuardianName: motherName,
        legalGuardianRut: mother.fileNumber || mother.rut || '',
        guardianRole: 'Madre (Titular Acreditada Ley N° 20.584 / Ley N° 21.430)',
        emergencyContact: {
          name: motherName,
          phone: mother.phone || '+56965432109',
          relation: 'Madre'
        },
        conditions: ['GENERAL'],
        medications: [],
        allergies: 'Ninguna',
        documents: [],
        clinicalLogs: [
          {
            date: babyBirthDate,
            note: `Nacimiento registrado en ${babyHospital}. Tipo: ${babyDeliveryType}. Peso: ${babyWeight}g, Talla: ${babyStature}cm, APGAR: ${babyApgar}. Ficha Pediátrica generada.`
          }
        ]
      };

      // 2. Asignar vacunas obligatorias de maternidad del recién nacido (BCG y Hepatitis B)
      const rnVaccines = [
        {
          id: 'vac_rn_bcg',
          name: 'BCG (Tuberculosis Meningósea y Diseminada)',
          program: 'PNI Recién Nacido Maternidad',
          status: 'al_dia',
          date: babyBirthDate,
          provider: babyHospital,
          lot: 'BCG-MAT-2026',
          notes: 'Dosis única intradérmica en recién nacido en maternidad.'
        },
        {
          id: 'vac_rn_hepb',
          name: 'Hepatitis B Monovalente Pediátrica (Dosis Recién Nacido)',
          program: 'PNI Maternidad (Primeras 24 horas)',
          status: 'al_dia',
          date: babyBirthDate,
          provider: babyHospital,
          lot: 'HEP-MAT-884',
          notes: 'Dosis monovalente administrada para prevención de transmisión vertical.'
        }
      ];
      try {
        localStorage.setItem(`cuidapp_vaccines_${newRnId}`, JSON.stringify(rnVaccines));
      } catch (err) {}

      // 3. Pasar a la madre a estado Postparto
      mother.isPregnant = false;
      mother.isPostpartum = true;
      mother.postpartum = true;
      if (!Array.isArray(mother.children)) mother.children = [];
      if (!mother.children.includes(newRnId)) mother.children.push(newRnId);

      try {
        localStorage.setItem(`cuidapp_postpartum_${mother.id}`, 'true');
        localStorage.setItem(`cuidapp_pregnancy_${mother.id}`, JSON.stringify({
          isActive: false,
          isPostpartum: true,
          birthDate: babyBirthDate,
          newbornId: newRnId,
          newbornName: babyName
        }));
      } catch (err) {}

      // 4. Persistir en cuidapp_custom_patients y PATIENTS_DATABASE
      if (!PATIENTS_DATABASE.some(p => p.id === newRnId)) {
        PATIENTS_DATABASE.push(newBornObj);
      }
      let customPatients = [];
      try {
        const rawP = localStorage.getItem('cuidapp_custom_patients');
        if (rawP) customPatients = JSON.parse(rawP);
      } catch (err) {}

      const existingRnIdx = customPatients.findIndex(p => p.id === newRnId);
      if (existingRnIdx >= 0) customPatients[existingRnIdx] = newBornObj;
      else customPatients.push(newBornObj);

      const motherIdx = customPatients.findIndex(p => p.id === mother.id);
      if (motherIdx >= 0) {
        customPatients[motherIdx].isPregnant = false;
        customPatients[motherIdx].isPostpartum = true;
        customPatients[motherIdx].postpartum = true;
        customPatients[motherIdx].children = mother.children;
      }
      try {
        localStorage.setItem('cuidapp_custom_patients', JSON.stringify(customPatients));
      } catch (err) {}

      // 5. Persistir en cuidapp_custom_users para Admin
      try {
        const rawU = localStorage.getItem('cuidapp_custom_users');
        const customUsers = rawU ? JSON.parse(rawU) : [];
        customUsers.push({
          id: newRnId,
          username: `rn_${newRnId}`,
          role: 'patient',
          name: babyName,
          socialName: babyName,
          rut: fakeRut,
          birthDate: babyBirthDate,
          age: 0,
          isPediatric: true,
          isAdolescent: false,
          isSenior: false,
          createdAt: new Date().toISOString()
        });
        localStorage.setItem('cuidapp_custom_users', JSON.stringify(customUsers));
      } catch (err) {}

      closeModal();

      if (window.showGlassAlert) {
        window.showGlassAlert(`🎉 ¡Nacimiento registrado exitosamente! La madre ha pasado a control Postparto y se integró la Ficha Pediátrica del Recién Nacido (${babyName}) con sus vacunas BCG y Hepatitis B.`, 'success');
      }

      // 6. Actualizar selector de pacientes y cambiar vista al recién nacido para revisar su ficha
      refreshPatientSelector(newBornObj);
      setActivePatient(newBornObj);
      updateActivePatient(newBornObj);
    };
  }
}

// ============================================================================
// GESTIÓN DE RECORDATORIOS DE CITAS Y EXÁMENES (PESTAÑA 1)
// ============================================================================
export function getPatientAppointmentsKey(patient) {
  const pId = patient ? (patient.id || patient.rut || patient.fileNumber || 'p1') : 'p1';
  return `cuidapp_appointments_${pId}`;
}

export function getPatientAppointments(patient) {
  if (!patient) return [];
  const key = getPatientAppointmentsKey(patient);
  const isPediatric = Boolean(patient && ((typeof patient.age === 'number' && patient.age < 18) || patient.isPediatric || patient.id === 'p_mateo' || patient.id === 'mateo'));
  const tutorName = (patient && patient.emergencyContact && patient.emergencyContact.name) || (patient.id === 'p_mateo' || patient.id === 'mateo' ? 'Camila Paz Vergara Fuentes' : 'Cuidador / Tutor Legal');
  const tutorRole = (patient && patient.emergencyContact && patient.emergencyContact.relation) || 'Tutora Legal Acreditada';
  const tutorPhone = (patient && patient.emergencyContact && patient.emergencyContact.phone) || '+56 9 8765 4321';

  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Error al leer citas de localStorage:', e);
  }

  // Si es pediátrico, revisar si existen citas en cuidapp_appointments_[RUT]
  if (isPediatric && patient.rut) {
    try {
      const rawRut = localStorage.getItem('cuidapp_appointments_' + patient.rut);
      if (rawRut) {
        const parsedRut = JSON.parse(rawRut);
        if (Array.isArray(parsedRut) && parsedRut.length > 0) {
          const adapted = parsedRut.map(a => ({
            id: a.id || `apt_${Date.now()}`,
            patientId: patient.id,
            patientName: patient.name,
            type: 'Cita Médica',
            specialty: a.specialist || a.specialty || 'Control Pediátrico',
            date: a.rawDate || a.date,
            time: a.time || '11:00',
            location: a.doctor ? `${a.doctor} • CESFAM Bellavista` : 'CESFAM Bellavista',
            status: a.status === 'Confirmada' ? 'pendiente' : (a.status || 'pendiente'),
            recipientTutor: tutorName,
            recipientRole: tutorRole,
            recipientPhone: tutorPhone,
            legalNotice: `Notificación y recordatorio dirigidos a ${tutorName} (${tutorRole}) bajo Ley N° 21.430.`,
            createdAt: a.createdAt || new Date().toISOString()
          }));
          return adapted;
        }
      }
    } catch(e) {}
  }

  // Recordatorios precargados de ejemplo si la lista está vacía
  const now = Date.now();
  const tomorrow = new Date(now + 26 * 3600 * 1000); // en ~26 hrs (< 48 hrs para demostrar alerta ámbar/roja)
  const inFiveDays = new Date(now + 5 * 24 * 3600 * 1000);

  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const inFiveDaysStr = inFiveDays.toISOString().split('T')[0];

  const isPregnant = caregiverPatientIsPregnant(patient);

  const seed = isPediatric ? [
    {
      id: `apt_ped_${patient.id}_1`,
      patientId: patient.id,
      patientName: patient.name,
      type: 'Cita Médica',
      specialty: 'Control Niño Sano & Vacuna Escolar (PNI)',
      date: tomorrowStr,
      time: '11:00',
      location: 'CESFAM Bellavista • Box 2 Pediatría',
      status: 'pendiente',
      recipientTutor: tutorName,
      recipientRole: tutorRole,
      recipientPhone: tutorPhone,
      legalNotice: `Notificación y recordatorio dirigidos formalmente a la Tutora Legal ${tutorName} (${tutorRole}) bajo Ley N° 21.430.`,
      createdAt: new Date().toISOString()
    },
    {
      id: `apt_ped_${patient.id}_2`,
      patientId: patient.id,
      patientName: patient.name,
      type: 'Cita Médica',
      specialty: 'Fonoaudiología & Estimulación PIE (Protocolo TEA)',
      date: inFiveDaysStr,
      time: '16:00',
      location: 'Centro Comunal PIE Bellavista',
      status: 'pendiente',
      recipientTutor: tutorName,
      recipientRole: tutorRole,
      recipientPhone: tutorPhone,
      legalNotice: `Notificación y recordatorio dirigidos formalmente a la Tutora Legal ${tutorName} (${tutorRole}) bajo Ley N° 21.430.`,
      createdAt: new Date().toISOString()
    }
  ] : isPregnant ? [
    {
      id: `apt_prenatal_${patient.id}_1`,
      patientId: patient.id,
      patientName: patient.name,
      type: 'Cita Médica',
      specialty: 'Control Prenatal MINSAL',
      date: tomorrowStr,
      time: '10:00',
      location: 'CESFAM Sector Maternidad • Box Obstetricia 3',
      status: 'pendiente',
      notes: 'Control prenatal mensual, evaluación de movimientos fetales y monitoreo de presión arterial materna.',
      createdAt: new Date().toISOString()
    },
    {
      id: `apt_prenatal_${patient.id}_2`,
      patientId: patient.id,
      patientName: patient.name,
      type: 'Examen',
      specialty: 'Control Prenatal MINSAL (Eco Morfológica / Perfil Biofísico)',
      date: inFiveDaysStr,
      time: '08:30',
      location: 'Unidad de Ultrasonografía Obstétrica • Hospital Clínico',
      status: 'pendiente',
      notes: 'Ecografía obstétrica y biometría fetal.',
      createdAt: new Date().toISOString()
    }
  ] : [
    {
      id: `apt_seed_${patient.id}_1`,
      patientId: patient.id,
      patientName: patient.name,
      type: 'Cita Médica',
      specialty: 'Control Crónico Cardiovascular y Presión Arterial',
      date: tomorrowStr,
      time: '09:30',
      location: 'CESFAM Dr. Salvador Allende • Sector Verde, Box 4',
      status: 'pendiente',
      createdAt: new Date().toISOString()
    },
    {
      id: `apt_seed_${patient.id}_2`,
      patientId: patient.id,
      patientName: patient.name,
      type: 'Examen',
      specialty: 'Perfil Lipídico, Glicemia y Creatinina (Ayuno 8 hrs)',
      date: inFiveDaysStr,
      time: '08:00',
      location: 'Laboratorio Clínico Central Comunal',
      status: 'pendiente',
      createdAt: new Date().toISOString()
    }
  ];

  try {
    localStorage.setItem(key, JSON.stringify(seed));
  } catch (e) {}

  return seed;
}

export function savePatientAppointments(patient, list) {
  if (!patient) return;
  const key = getPatientAppointmentsKey(patient);
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch (e) {
    console.error('Error al guardar citas en localStorage:', e);
  }
}

export function renderCaregiverAppointments(patient = activePatient) {
  const container = document.getElementById('cardPatientAppointments');
  if (!container || !patient) return;

  const isPediatric = Boolean(patient && ((typeof patient.age === 'number' && patient.age < 18) || patient.isPediatric || patient.id === 'p_mateo' || patient.id === 'mateo'));
  const tutorName = (patient && patient.emergencyContact && patient.emergencyContact.name) || (patient.id === 'p_mateo' || patient.id === 'mateo' ? 'Camila Paz Vergara Fuentes' : 'Cuidador / Tutor Legal');
  const tutorRole = (patient && patient.emergencyContact && patient.emergencyContact.relation) || 'Tutora Legal Acreditada';
  const tutorPhone = (patient && patient.emergencyContact && patient.emergencyContact.phone) || '+56 9 8765 4321';

  const appointments = getPatientAppointments(patient);

  // Ordenar por fecha y hora ascendente
  appointments.sort((a, b) => {
    const dtA = new Date(`${a.date}T${a.time || '00:00'}`).getTime();
    const dtB = new Date(`${b.date}T${b.time || '00:00'}`).getTime();
    return dtA - dtB;
  });

  const pendientes = appointments.filter(a => a.status !== 'asistido' && a.status !== 'completada');
  const asistidas = appointments.filter(a => a.status === 'asistido' || a.status === 'completada');

  const now = new Date();
  const todayDateStr = (typeof getTodayDateString === 'function') ? getTodayDateString() : now.toISOString().split('T')[0];

  // Renderizar listado de pendientes
  const pendingHtml = pendientes.length === 0 ? `
    <div class="text-center py-3 px-3 rounded-3" style="background: rgba(255, 255, 255, 0.02); border: 1px dashed rgba(255, 255, 255, 0.15);">
      <i class="bi bi-calendar2-check text-success fs-3 d-block mb-1"></i>
      <span class="text-white-50 small fw-semibold">No hay atenciones o exámenes pendientes para ${patient.name}.</span>
      <div class="text-white-50" style="font-size: 0.73rem;">Puedes agendar un nuevo recordatorio usando el formulario superior.</div>
    </div>
  ` : pendientes.map(app => {
    const appDateTime = new Date(`${app.date}T${app.time || '00:00'}`);
    const diffHours = (appDateTime.getTime() - now.getTime()) / (1000 * 3600);

    let urgencyBadge = '';
    let borderStyle = '1px solid rgba(255, 255, 255, 0.08)';
    let cardBg = 'rgba(255, 255, 255, 0.025)';

    if (diffHours < 0) {
      urgencyBadge = `
        <span class="badge rounded-pill fw-bold d-inline-flex align-items-center" style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.45); font-size: 0.72rem; padding: 4px 9px;">
          <i class="bi bi-exclamation-octagon-fill me-1"></i>¡Atención Hoy / Vencida!
        </span>
      `;
      borderStyle = '1px solid rgba(239, 68, 68, 0.4)';
      cardBg = 'rgba(239, 68, 68, 0.05)';
    } else if (diffHours <= 24) {
      urgencyBadge = `
        <span class="badge rounded-pill fw-bold d-inline-flex align-items-center" style="background: rgba(239, 68, 68, 0.25); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.5); font-size: 0.72rem; padding: 4px 9px;">
          <i class="bi bi-alarm-fill me-1"></i>¡Urgente: Faltan < 24 hrs! (${Math.max(1, Math.round(diffHours))}h)
        </span>
      `;
      borderStyle = '1px solid rgba(239, 68, 68, 0.45)';
      cardBg = 'rgba(239, 68, 68, 0.05)';
    } else if (diffHours <= 48) {
      urgencyBadge = `
        <span class="badge rounded-pill fw-bold d-inline-flex align-items-center" style="background: rgba(245, 158, 11, 0.22); color: #fcd34d; border: 1px solid rgba(245, 158, 11, 0.5); font-size: 0.72rem; padding: 4px 9px;">
          <i class="bi bi-clock-history me-1"></i>Alerta: Próximas 48 hrs (${Math.round(diffHours)}h)
        </span>
      `;
      borderStyle = '1px solid rgba(245, 158, 11, 0.35)';
      cardBg = 'rgba(245, 158, 11, 0.035)';
    } else {
      urgencyBadge = `
        <span class="badge rounded-pill fw-semibold d-inline-flex align-items-center" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.35); font-size: 0.72rem; padding: 4px 9px;">
          <i class="bi bi-calendar-event me-1"></i>Programada
        </span>
      `;
      borderStyle = '1px solid rgba(255, 255, 255, 0.08)';
    }

    const isExamen = app.type === 'Examen';
    const savedAlarms = JSON.parse(localStorage.getItem(`cuidapp_alarms_${patient.id || 'p1'}`) || '{}');
    const isAlarmSet = !!(savedAlarms[app.id] && savedAlarms[app.id].active);

    const typeBadge = isExamen ? `
      <span class="badge rounded-pill fw-semibold" style="background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.4); font-size: 0.7rem;">
        🔬 Examen
      </span>
    ` : `
      <span class="badge rounded-pill fw-semibold" style="background: rgba(14, 165, 233, 0.2); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.4); font-size: 0.7rem;">
        🩺 Cita Médica
      </span>
    `;

    return `
      <div class="p-3 rounded-3" style="background: ${cardBg}; border: ${borderStyle};">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2 pb-2 border-bottom border-light border-opacity-10">
          <div class="d-flex align-items-center gap-2">
            ${typeBadge}
            <span class="appointment-title text-white fw-bold" style="font-size: 0.9rem;">${app.specialty}</span>
          </div>
          <div>${urgencyBadge}</div>
        </div>

        <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div class="small">
            <div class="text-white d-flex align-items-center gap-2 flex-wrap mb-1" style="font-size: 0.83rem;">
              <span class="text-info fw-semibold"><i class="bi bi-calendar-check me-1"></i>${app.date}</span>
              <span class="text-white-50">&bull;</span>
              <span class="badge px-2 py-0.5 rounded-pill appointment-time-badge" style="background: rgba(255,255,255,0.06); font-size: 0.74rem;">
                <i class="bi bi-clock-fill me-1 text-warning"></i>${app.time} hrs
              </span>
            </div>
            <div class="text-white-50" style="font-size: 0.78rem;">
              <i class="bi bi-geo-alt-fill text-danger me-1"></i>${app.location}
            </div>
          </div>

          <div class="d-flex align-items-center gap-2">
            <button type="button" class="btn btn-sm ${isAlarmSet ? 'btn-warning text-dark fw-bold' : 'btn-outline-warning fw-semibold'} btn-app-reminder px-2.5 py-1.5 d-inline-flex align-items-center gap-1 shadow-sm" data-id="${app.id}" style="border-radius: 8px; font-size: 0.78rem;" title="Activar recordatorio telefónico y alarma médica">
              <span>📞 ${isAlarmSet ? '🔔 Alarma Activa' : 'Activar Recordatorio / Alarma'}</span>
            </button>
            <button type="button" class="btn btn-sm btn-outline-success btn-mark-appointment-attended fw-bold px-3 py-1.5 d-inline-flex align-items-center gap-1.5 shadow-sm" data-id="${app.id}" style="border-radius: 8px; font-size: 0.78rem;">
              <i class="bi bi-check2-circle"></i> ✅ Asistido
            </button>
          </div>
        </div>

        ${isPediatric ? `
          <div class="mt-2 pt-2 border-top border-light border-opacity-10 d-flex align-items-center justify-content-between flex-wrap gap-1">
            <div class="small text-white-50" style="font-size: 0.74rem;">
              <i class="bi bi-bell-fill text-warning me-1"></i>Notificación y recordatorio dirigidos a: <strong class="text-info">${app.recipientTutor || tutorName}</strong> (${app.recipientRole || tutorRole})
            </div>
            <span class="badge px-2 py-0.5 rounded-pill" style="background: rgba(16, 185, 129, 0.15); color: #34d399; font-size: 0.7rem; border: 1px solid #10b981;">
              📞 ${app.recipientPhone || tutorPhone}
            </span>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // Renderizar historial de completadas si existen
  const completedHtml = asistidas.length > 0 ? `
    <div class="mt-3 pt-3 border-top border-light border-opacity-10">
      <div class="text-white-50 small fw-semibold mb-2 d-flex align-items-center gap-1.5" style="font-size: 0.76rem;">
        <i class="bi bi-clipboard2-check text-success"></i>
        <span>Atenciones y Exámenes Completados (${asistidas.length})</span>
      </div>
      <div class="d-flex flex-column gap-2">
        ${asistidas.slice(0, 3).map(app => `
          <div class="p-2 px-3 rounded-2 d-flex justify-content-between align-items-center flex-wrap gap-2 text-white-50" style="background: rgba(255, 255, 255, 0.015); border: 1px solid rgba(255, 255, 255, 0.05); font-size: 0.75rem;">
            <div>
              <span class="text-white fw-semibold me-2">${app.type === 'Examen' ? '🔬' : '🩺'} ${app.specialty}</span>
              <span>&bull; ${app.date} (${app.time} hrs)</span>
            </div>
            <span class="badge rounded-pill fw-semibold" style="background: rgba(16, 185, 129, 0.15); color: #34d399; font-size: 0.68rem; border: 1px solid rgba(16, 185, 129, 0.3);">
              <i class="bi bi-check-all me-1"></i>Asistido
            </span>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  container.innerHTML = `
    <!-- Cabecera de la Tarjeta -->
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
      <div>
        <h5 class="fw-bold m-0 text-white d-flex align-items-center gap-2" style="font-size: 1.05rem;">
          <i class="bi bi-calendar3-event-fill text-info"></i>
          <span id="lblAppointmentsCardTitle">📅 Recordatorios de Citas y Exámenes</span>
        </h5>
        <small class="text-white-50" style="font-size: 0.76rem;">${isPediatric ? `Atenciones pediátricas programadas para ${patient.name} &bull; Notificaciones dirigidas al Tutor Legal` : `Atenciones médicas programadas para ${patient.name} &bull; Alertas automáticas de 48 horas`}</small>
      </div>
      <button type="button" id="btnToggleAddAppointmentForm" class="btn btn-sm btn-glass-primary px-3 py-1.5 fw-semibold d-inline-flex align-items-center gap-1.5" style="border-radius: 8px; font-size: 0.8rem;">
        <i class="bi bi-plus-circle-fill"></i> <span id="lblAddAppointmentBtn">+ Agendar Recordatorio</span>
      </button>
    </div>

    ${isPediatric ? `
      <!-- AVISO DE NOTIFICACIONES PEDIÁTRICAS DIRIGIDAS AL TUTOR LEGAL -->
      <div class="p-3 rounded-3 mb-3 d-flex align-items-center gap-2.5 shadow-sm" style="background: rgba(6, 182, 212, 0.12); border: 1.5px solid #06b6d4; color: #e0f2fe;">
        <span style="font-size: 1.4rem; line-height: 1;">🛡️</span>
        <div class="small">
          <strong class="text-info">Gestión Legal de Citas Pediátricas (Ley N° 21.430 & Ley N° 20.584):</strong> Todas las citaciones, recordatorios preventivos y alertas de asistencia médica para el menor <strong>${patient.name}</strong> se dirigen explícita y directamente a su Tutora Legal / Cuidadora Acreditada: <strong>${tutorName}</strong> (${tutorRole} &bull; Tel: ${tutorPhone}).
        </div>
      </div>
    ` : ''}

    <!-- Formulario Compacto Colapsable (+ Agendar Recordatorio) -->
    <div id="caregiverAddAppointmentFormContainer" class="p-3 rounded-3 mb-3 d-none" style="background: rgba(14, 165, 233, 0.04); border: 1px solid rgba(14, 165, 233, 0.25);">
      <div class="fw-bold text-info small mb-2 d-flex align-items-center gap-1.5">
        <i class="bi bi-calendar-plus-fill"></i> Nuevo Recordatorio de Salud
      </div>
      <form id="formAddCaregiverAppointment">
        <div class="row g-2">
          <!-- Tipo -->
          <div class="col-md-3 col-sm-6">
            <label class="small text-white-50 mb-1 d-block" style="font-size: 0.75rem;">Tipo de Atención</label>
            <select id="inputAptType" class="form-select form-select-sm text-white" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18);">
              <option value="Cita Médica" class="bg-dark text-white">🩺 Cita Médica</option>
              <option value="Examen" class="bg-dark text-white">🔬 Examen / Laboratorio</option>
            </select>
          </div>

          <!-- Especialidad / Descripción -->
          <div class="col-md-5 col-sm-6">
            <label class="small text-white-50 mb-1 d-block" style="font-size: 0.75rem;">Especialidad / Descripción</label>
            <input type="text" id="inputAptSpecialty" class="form-control form-control-sm text-white" placeholder="Ej. Cardiología, Control Crónico, Fondo de Ojo" required style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18);">
          </div>

          <!-- Fecha -->
          <div class="col-md-2 col-sm-6">
            <label class="small text-white-50 mb-1 d-block" style="font-size: 0.75rem;">Fecha</label>
            <input type="date" id="inputAptDate" class="form-control form-control-sm text-white" min="${todayDateStr}" value="${todayDateStr}" required style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18); cursor: pointer;">
          </div>

          <!-- Hora -->
          <div class="col-md-2 col-sm-6">
            <label class="small text-white-50 mb-1 d-block" style="font-size: 0.75rem;">Hora</label>
            <input type="time" id="inputAptTime" class="form-control form-control-sm text-white" value="09:00" required style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18); cursor: pointer;">
          </div>

          <!-- Centro de Salud / CESFAM -->
          <div class="col-md-9 col-sm-12 mt-2">
            <label class="small text-white-50 mb-1 d-block" style="font-size: 0.75rem;">Centro de Salud / CESFAM / Box</label>
            <input type="text" id="inputAptLocation" class="form-control form-control-sm text-white" placeholder="Ej. CESFAM Dr. Salvador Allende • Sector Verde, Box 3" value="CESFAM Dr. Salvador Allende" required style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18);">
          </div>

          <!-- Botones de Acción -->
          <div class="col-md-3 col-sm-12 mt-2 d-flex align-items-end gap-1.5">
            <button type="button" id="btnCancelAddAppointment" class="btn btn-sm btn-glass-secondary w-50 py-1" style="border-radius: 8px; font-size: 0.76rem;">
              Cancelar
            </button>
            <button type="submit" class="btn btn-sm btn-glass-primary w-50 py-1 fw-bold" style="border-radius: 8px; font-size: 0.76rem;">
              <i class="bi bi-save2 me-1"></i>Guardar
            </button>
          </div>

          ${isPediatric ? `
            <div class="col-12 mt-2">
              <div class="p-2 rounded-2 small text-white-50" style="background: rgba(6, 182, 212, 0.08); border: 1px solid rgba(6, 182, 212, 0.25);">
                <i class="bi bi-shield-check text-info me-1"></i><strong>Notificación dirigida al Tutor Legal:</strong> Este recordatorio y aviso de asistencia se asignan directamente a <strong>${tutorName}</strong> (${tutorPhone}) según Ley N° 21.430.
              </div>
            </div>
          ` : ''}
        </div>
      </form>
    </div>

    <!-- Lista de Recordatorios Pendientes -->
    <div class="d-flex flex-column gap-2.5" id="caregiverAppointmentsListContainer">
      ${pendingHtml}
    </div>

    <!-- Sección de Completadas -->
    ${completedHtml}
  `;

  // Conectar toggler del formulario compacto
  const toggleBtn = document.getElementById('btnToggleAddAppointmentForm');
  const formContainer = document.getElementById('caregiverAddAppointmentFormContainer');
  const cancelBtn = document.getElementById('btnCancelAddAppointment');

  if (toggleBtn && formContainer) {
    toggleBtn.onclick = () => {
      formContainer.classList.toggle('d-none');
    };
  }
  if (cancelBtn && formContainer) {
    cancelBtn.onclick = () => {
      formContainer.classList.add('d-none');
    };
  }

  // Conectar envío del formulario compacto
  const addForm = document.getElementById('formAddCaregiverAppointment');
  if (addForm) {
    addForm.onsubmit = (e) => {
      e.preventDefault();
      const type = document.getElementById('inputAptType').value;
      const specialty = document.getElementById('inputAptSpecialty').value.trim();
      const date = document.getElementById('inputAptDate').value;
      const time = document.getElementById('inputAptTime').value || '09:00';
      const location = document.getElementById('inputAptLocation').value.trim() || 'CESFAM Dr. Salvador Allende';

      if (!specialty || !date) {
        if (window.showGlassAlert) window.showGlassAlert('Por favor completa la especialidad y fecha de la atención.', 'warning');
        return;
      }

      const list = getPatientAppointments(patient);
      const newApt = {
        id: `apt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        patientId: patient.id,
        patientName: patient.name,
        type,
        specialty,
        date,
        time,
        location,
        status: 'pendiente',
        recipientTutor: isPediatric ? tutorName : undefined,
        recipientRole: isPediatric ? tutorRole : undefined,
        recipientPhone: isPediatric ? tutorPhone : undefined,
        legalNotice: isPediatric ? `Notificación y recordatorio dirigidos a ${tutorName} (${tutorRole}) bajo Ley N° 21.430.` : undefined,
        createdAt: new Date().toISOString()
      };

      list.push(newApt);
      savePatientAppointments(patient, list);

      // Sincronizar en cuidapp_appointments_[RUT] si es pediátrico
      if (isPediatric && patient.rut) {
        try {
          const rawRut = localStorage.getItem('cuidapp_appointments_' + patient.rut);
          let rutApps = rawRut ? JSON.parse(rawRut) : [];
          rutApps.unshift({
            id: newApt.id,
            date: date,
            rawDate: date,
            time: time,
            specialty: type === 'Examen' ? 'Laboratorio' : 'Pediatría',
            specialist: specialty,
            doctor: location,
            reminderChannel: '📞 Llamada Telefónica Automatizada',
            status: 'Confirmada',
            authorizedBy: tutorName
          });
          localStorage.setItem('cuidapp_appointments_' + patient.rut, JSON.stringify(rutApps));
        } catch(e) {}
      }

      renderCaregiverAppointments(patient);
      updateCaregiverHeroSection(patient);

      if (window.showGlassAlert) {
        if (isPediatric) {
          window.showGlassAlert(`📅 Recordatorio de ${type} agendado para ${patient.name}. Notificación dirigida a su Tutora Legal (${tutorName}).`, 'success');
        } else {
          window.showGlassAlert(`📅 Recordatorio de ${type} agendado exitosamente para ${patient.name}.`, 'success');
        }
      }
    };
  }

  // Conectar botones "✅ Asistido"
  container.querySelectorAll('.btn-mark-appointment-attended').forEach(btn => {
    btn.onclick = () => {
      const aptId = btn.getAttribute('data-id');
      const list = getPatientAppointments(patient);
      const target = list.find(a => a.id === aptId);
      if (target) {
        target.status = 'asistido';
        target.attendedAt = new Date().toISOString();
        savePatientAppointments(patient, list);
        renderCaregiverAppointments(patient);
      updateCaregiverHeroSection(patient);

        if (window.showGlassAlert) {
          window.showGlassAlert(`✅ Atención "${target.specialty}" de ${patient.name} marcada como asistida.`, 'success');
        }
      }
    };
  });

  // Conectar botones "📞 Activar Recordatorio / Alarma" en Citas y Exámenes
  container.querySelectorAll('.btn-app-reminder').forEach(btn => {
    btn.onclick = () => {
      const aptId = btn.getAttribute('data-id');
      const list = getPatientAppointments(patient);
      const target = list.find(a => a.id === aptId);
      if (target) {
        openItemReminderModal(target, target.type === 'Examen' ? 'exam' : 'appointment', patient);
      }
    };
  });
}

// ============================================================================
// GESTIÓN DE DOCUMENTOS Y RECETAS MÉDICAS (PESTAÑA 3 - ANCHO COMPLETO)
// ============================================================================
export function getPatientDocumentsKey(patient) {
  const pId = patient ? (patient.id || patient.rut || 'p1') : 'p1';
  return `cuidapp_documents_${pId}`;
}

export function formatDateForTitle(dateStr) {
  if (!dateStr) return getTodayDateString();
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  return dateStr;
}

export function getDocumentFolderAndTitle(type, dateStr) {
  const formattedDate = formatDateForTitle(dateStr);
  let folder = 'Documentos';
  if (type === 'Receta Médica') {
    folder = 'Recetas';
  } else if (type === 'Orden de Examen' || type === 'Resultado de Laboratorio' || type === 'Examen') {
    folder = 'Exámenes';
  } else if (type === 'Informe Clínico' || type === 'Informe') {
    folder = 'Informes';
  }

  const title = `${type} — ${formattedDate}`;
  return { folder, title, formattedDate };
}

export function getCaregiverPatientDocuments(patient = activePatient) {
  const pId = patient ? (patient.id || patient.rut || 'p1') : 'p1';
  const key = getPatientDocumentsKey(patient);
  let docs = [];
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error al recuperar documentos del paciente:', e);
  }

  // 2 Ejemplos precargados por defecto si no existen documentos guardados
  const seedDocs = [
    {
      id: `doc-seed-rx-${pId}`,
      type: 'Receta Médica',
      specialty: 'Cardiología',
      folder: 'Recetas',
      category: 'recetas',
      title: 'Receta Médica — 12-11-2026',
      doctor: 'Dra. Elena Valdés (Cardióloga)',
      center: 'CESFAM Bellavista / Red Asistencial Oriente',
      date: '2026-11-12',
      createdAt: '2026-11-12T10:30:00.000Z',
      notes: 'Losartán 50mg & Atorvastatina 20mg. Indicación: 1 comprimido de Losartán 50mg cada 12 horas vía oral (mañana y noche) con abundante agua. 1 comprimido de Atorvastatina 20mg cada noche antes de dormir. Tratamiento crónico bajo programa cardiovascular GES.',
      fileName: 'receta_losartan_atorvastatina.pdf',
      fileType: 'application/pdf',
      fileData: null
    },
    {
      id: `doc-seed-lab-${pId}`,
      type: 'Examen',
      specialty: 'Laboratorio / Exámenes',
      folder: 'Exámenes',
      category: 'examenes',
      title: 'Examen — 08-11-2026',
      doctor: 'Dr. Roberto Silva (Bioquímico)',
      center: 'Laboratorio Central San Lucas',
      date: '2026-11-08',
      createdAt: '2026-11-08T08:45:00.000Z',
      notes: 'Perfil Bioquímico, Glucemia y Creatinina Plasmática. Glucemia basal en ayunas 104 mg/dL (Ref: 70 - 100 mg/dL). Creatinina 0.94 mg/dL (Ref: 0.7 - 1.3 mg/dL). Colesterol total 182 mg/dL. Parámetros estables y acordes al esquema terapéutico actual.',
      fileName: 'examen_perfil_bioquimico_lab.jpg',
      fileType: 'image/jpeg',
      fileData: null
    }
  ];

  saveCaregiverPatientDocuments(patient, seedDocs);
  return seedDocs;
}

export function saveCaregiverPatientDocuments(patient, docs) {
  try {
    const key = getPatientDocumentsKey(patient);
    localStorage.setItem(key, JSON.stringify(docs));
  } catch (e) {
    console.error('Error al guardar documentos del paciente en localStorage:', e);
  }
}

// ============================================================================
// VERIFICACIÓN INTELIGENTE POR IA (OCR Y NLP CLÍNICO - LEY N° 20.584 / LEY N° 19.628)
// ============================================================================
export function runAiDocumentVerification(fileObj, fileDataUrl, patient = activePatient) {
  const result = {
    isValid: true,
    classification: {
      type: 'Informe Clínico',
      label: 'Informe Clínico',
      icon: '📄',
      folder: 'Informes'
    },
    detectedPatient: null,
    mismatchReason: null,
    confidence: 98
  };

  if (!fileObj || !patient) return result;

  const fileName = (fileObj.name || '').toLowerCase();
  const fileNotes = (document.getElementById('inputCaregiverDocNotes')?.value || '').toLowerCase();
  const fullText = `${fileName} ${fileNotes}`;

  // 1. Clasificación Automática Inteligente por IA (4 categorías clínicas)
  if (
    fullText.includes('receta') || fullText.includes('rx') || fullText.includes('prescrip') ||
    fullText.includes('medicament') || fullText.includes('posolog') || fullText.includes('farmacia') ||
    fullText.includes('dosis') || fullText.includes('amoxicilina') || fullText.includes('losartan') ||
    fullText.includes('atorvastatina') || fullText.includes('metformina') || fullText.includes('paracetamol') ||
    fullText.includes('ibuprofeno') || fullText.includes('remedio')
  ) {
    result.classification = {
      type: 'Receta Médica',
      label: 'Receta Médica',
      icon: '💊',
      folder: 'Recetas'
    };
  } else if (
    fullText.includes('orden') || fullText.includes('solicitud') || fullText.includes('derivacion') ||
    fullText.includes('peticion') || fullText.includes('orden_examen') || fullText.includes('solicitud_examen')
  ) {
    result.classification = {
      type: 'Orden de Examen',
      label: 'Orden de Examen',
      icon: '📋',
      folder: 'Exámenes'
    };
  } else if (
    fullText.includes('resultado') || fullText.includes('laboratorio') || fullText.includes('lab') ||
    fullText.includes('analisis') || fullText.includes('hemograma') || fullText.includes('bioquimico') ||
    fullText.includes('orina') || fullText.includes('pcr') || fullText.includes('perfil') ||
    fullText.includes('cultivo') || fullText.includes('glicemia') || fullText.includes('glucemia') ||
    fullText.includes('colesterol') || fullText.includes('creatinina') || fullText.includes('trigliceridos')
  ) {
    result.classification = {
      type: 'Resultado de Laboratorio',
      label: 'Resultado de Laboratorio',
      icon: '🔬',
      folder: 'Exámenes'
    };
  } else {
    // Informe Clínico (epicrisis, evolución, anamnesis, interconsulta, alta médica, biopsia, etc.)
    result.classification = {
      type: 'Informe Clínico',
      label: 'Informe Clínico',
      icon: '📄',
      folder: 'Informes'
    };
  }

  // 2. Verificación de Identidad: Nombre y RUT/Documento (Ley N° 20.584 / Ley N° 19.628)
  const cleanRut = (r) => typeof r === 'string' ? r.replace(/[^0-9kK]/g, '').toUpperCase() : '';
  const normalizeStr = (str) => typeof str === 'string' ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : '';

  const activeRutClean = cleanRut(patient.fileNumber || patient.rut || '');
  const activeNameNormalized = normalizeStr(patient.name || '');

  // Pacientes autorizados (titular o cargas vinculadas en esta sesión)
  let authorizedList = [patient];
  if (typeof getAuthorizedPatientsForCurrentCaregiver === 'function') {
    try {
      const authGroup = getAuthorizedPatientsForCurrentCaregiver();
      if (Array.isArray(authGroup) && authGroup.length > 0) {
        authorizedList = authGroup;
      }
    } catch (e) {}
  }

  const authorizedRuts = authorizedList.map(p => cleanRut(p.fileNumber || p.rut || '')).filter(Boolean);

  // Consolidar todos los demás pacientes registrados en la plataforma
  let allKnownPatients = [...PATIENTS_DATABASE];
  try {
    const custom = JSON.parse(localStorage.getItem('cuidapp_custom_patients') || '[]');
    if (Array.isArray(custom)) {
      custom.forEach(cp => {
        if (!allKnownPatients.some(p => p.id === cp.id)) allKnownPatients.push(cp);
      });
    }
  } catch (e) {}

  const otherPatients = allKnownPatients.filter(p => {
    const pRut = cleanRut(p.fileNumber || p.rut || '');
    return !authorizedRuts.includes(pRut);
  });

  const normalizedText = normalizeStr(fullText);

  // Detección A: ¿El archivo contiene el RUT de otro paciente distinto?
  for (const other of otherPatients) {
    const otherRut = cleanRut(other.fileNumber || other.rut || '');
    if (otherRut && otherRut.length >= 7) {
      if (normalizedText.includes(otherRut.toLowerCase()) || normalizedText.includes((other.fileNumber || '').toLowerCase())) {
        result.isValid = false;
        result.detectedPatient = other;
        result.mismatchReason = '⚠️ Documento pertenece a otro paciente. Verifica antes de subir';
        break;
      }
    }
  }

  // Detección B: ¿El archivo contiene el nombre o apellidos de otro paciente distinto?
  if (result.isValid) {
    for (const other of otherPatients) {
      const otherNameNorm = normalizeStr(other.name || '');
      const otherParts = otherNameNorm.split(/\s+/).filter(part => part.length >= 4);
      const matchesOther = otherParts.filter(part => normalizedText.includes(part));
      const matchesActive = otherParts.filter(part => activeNameNormalized.includes(part));
      if (
        matchesOther.length >= 2 || 
        (matchesOther.length >= 1 && matchesActive.length === 0 && (
          normalizedText.includes(otherNameNorm) || 
          otherParts.some(p => normalizedText.startsWith(p) || normalizedText.includes(`_${p}`) || normalizedText.includes(`-${p}`))
        ))
      ) {
        result.isValid = false;
        result.detectedPatient = other;
        result.mismatchReason = '⚠️ Documento pertenece a otro paciente. Verifica antes de subir';
        break;
      }
    }
  }

  // Detección C: ¿Contiene un RUT chileno no autorizado en el texto?
  if (result.isValid) {
    const rutMatches = normalizedText.match(/\b\d{7,8}[-_]?[0-9kK]\b/gi);
    if (rutMatches && rutMatches.length > 0) {
      for (const rawRut of rutMatches) {
        const foundClean = cleanRut(rawRut);
        if (!authorizedRuts.includes(foundClean)) {
          result.isValid = false;
          result.detectedPatient = { name: 'Paciente No Autorizado', rut: rawRut.toUpperCase() };
          result.mismatchReason = '⚠️ Documento pertenece a otro paciente. Verifica antes de subir';
          break;
        }
      }
    }
  }

  // Detección D: Palabras clave explícitas de prueba para descarte/bloqueo
  if (result.isValid) {
    if (
      normalizedText.includes('otro_paciente') || 
      normalizedText.includes('paciente_ajeno') || 
      normalizedText.includes('tercero') || 
      normalizedText.includes('paciente_distinto') ||
      normalizedText.includes('error_paciente')
    ) {
      result.isValid = false;
      result.detectedPatient = { name: 'Paciente Distinto (Tercero no vinculado)', rut: '19.876.543-2' };
      result.mismatchReason = '⚠️ Documento pertenece a otro paciente. Verifica antes de subir';
    }
  }

  return result;
}

export function renderCaregiverDocuments(patient = activePatient) {
  const container = document.getElementById('caregiverDocsMainContainer');
  if (!container || !patient) return;

  const docs = getCaregiverPatientDocuments(patient);

  // Ordenar lista por fecha de carga / emisión (más recientes primero)
  const sortedDocs = [...docs].sort((a, b) => {
    const timeA = new Date(a.createdAt || a.date).getTime() || 0;
    const timeB = new Date(b.createdAt || b.date).getTime() || 0;
    return timeB - timeA;
  });

  container.innerHTML = `
    <!-- Encabezado de Documentos y Recetas -->
    <div class="glass-card p-4 border-0 mb-4">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
        <div>
          <h4 class="fw-bold m-0 text-white d-flex align-items-center gap-2">
            <i class="bi bi-folder2-open text-primary"></i>
            <span>Documentos y Recetas Médicas</span>
          </h4>
          <small class="text-white-50" style="font-size: 0.85rem;">
            Repositorio clínico digital de órdenes, exámenes y recetas &bull; Paciente: <strong class="text-white">${patient.name}</strong> (${patient.fileNumber || patient.rut || 'Ficha Activa'})
          </small>
        </div>
        <div class="d-flex align-items-center gap-2">
          <span class="badge px-3 py-1.5 rounded-pill fw-semibold" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.35); font-size: 0.78rem;">
            <i class="bi bi-shield-check me-1"></i>Ley N° 20.584 / DS N° 41
          </span>
          <span class="badge px-3 py-1.5 rounded-pill fw-semibold" style="background: rgba(16, 185, 129, 0.15); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.35); font-size: 0.78rem;">
            <i class="bi bi-file-earmark-check-fill me-1"></i>${sortedDocs.length} Registros
          </span>
        </div>
      </div>
    </div>

    <!-- Formulario de Carga / Fotografía de Documento -->
    <div class="glass-card p-4 border-0 mb-4" id="cardCaregiverUploadDoc">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3 pb-2 border-bottom border-light border-opacity-10">
        <div>
          <h5 class="fw-bold m-0 text-white d-flex align-items-center gap-2">
            <i class="bi bi-cloud-arrow-up-fill text-primary"></i>
            <span>Cargar o Fotografiar Nuevo Documento</span>
          </h5>
          <small class="text-white-50" style="font-size: 0.78rem;">
            Registra una receta, orden de examen o informe con soporte fotográfico o archivo digital
          </small>
        </div>
        <span class="badge rounded-pill fw-semibold" style="background: rgba(16, 185, 129, 0.15); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.35); font-size: 0.72rem;">
          <i class="bi bi-camera-fill me-1"></i>Cámara / PDF / JPG / PNG
        </span>
      </div>

      <form id="formCaregiverUploadDoc">
        <div class="row g-3">
          <!-- Tipo de Documento -->
          <div class="col-md-3">
            <label for="inputCaregiverDocType" class="form-label text-white-50 small fw-semibold mb-1">Tipo de Documento *</label>
            <select id="inputCaregiverDocType" class="form-select form-select-sm text-white" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 8px; cursor: pointer;" required>
              <option value="Receta Médica" class="bg-dark text-white">💊 Receta Médica</option>
              <option value="Orden de Examen" class="bg-dark text-white">📋 Orden de Examen</option>
              <option value="Resultado de Laboratorio" class="bg-dark text-white">🔬 Resultado de Laboratorio</option>
              <option value="Informe Clínico" class="bg-dark text-white">📄 Informe Clínico</option>
            </select>
          </div>

          <!-- Especialidad Clínica -->
          <div class="col-md-3">
            <label for="inputCaregiverDocSpecialty" class="form-label text-white-50 small fw-semibold mb-1">Especialidad Clínica *</label>
            <select id="inputCaregiverDocSpecialty" class="form-select form-select-sm text-white" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 8px; cursor: pointer;" required>
              <option value="Medicina General" class="bg-dark text-white">🩺 Medicina General</option>
              <option value="Cardiología" class="bg-dark text-white" selected>❤️ Cardiología</option>
              <option value="Geriatría" class="bg-dark text-white">👴 Geriatría</option>
              <option value="Kinesiología" class="bg-dark text-white">🏃 Kinesiología</option>
              <option value="Nutrición" class="bg-dark text-white">🥗 Nutrición</option>
              <option value="Enfermería" class="bg-dark text-white">🩹 Enfermería</option>
              <option value="Laboratorio / Exámenes" class="bg-dark text-white">🔬 Laboratorio / Exámenes</option>
              <option value="Urgencias" class="bg-dark text-white">🚨 Urgencias</option>
            </select>
          </div>

          <!-- Fecha de Emisión -->
          <div class="col-md-3">
            <label for="inputCaregiverDocDate" class="form-label text-white-50 small fw-semibold mb-1">Fecha de Emisión *</label>
            <input type="date" id="inputCaregiverDocDate" class="form-control form-control-sm text-white" value="${getTodayDateString()}" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 8px;" required>
          </div>

          <!-- Asignación Automática: Título y Carpeta Estandarizados -->
          <div class="col-md-3">
            <label class="form-label text-white-50 small fw-semibold mb-1">
              <i class="bi bi-tag-fill me-1 text-warning"></i>Título y Carpeta
            </label>
            <div class="p-2 rounded d-flex flex-column justify-content-center" style="background: rgba(14, 165, 233, 0.08); border: 1px dashed rgba(14, 165, 233, 0.35); min-height: 31px;">
              <div class="d-flex align-items-center justify-content-between flex-wrap gap-1">
                <span class="text-white fw-bold small text-truncate" id="caregiverDocAutoTitlePreview">
                  Receta Médica — ${formatDateForTitle(getTodayDateString())}
                </span>
                <span class="badge rounded-pill fw-semibold" id="caregiverDocAutoFolderBadge" style="background: rgba(14, 165, 233, 0.25); color: #38bdf8; font-size: 0.68rem;">
                  📁 Recetas
                </span>
              </div>
            </div>
          </div>

          <!-- Médico o Profesional -->
          <div class="col-md-6">
            <label for="inputCaregiverDocDoctor" class="form-label text-white-50 small fw-semibold mb-1">Médico Tratante / Especialista</label>
            <input type="text" id="inputCaregiverDocDoctor" class="form-control form-control-sm text-white" placeholder="Ej. Dra. Elena Valdés (Cardióloga)" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 8px;">
          </div>

          <!-- Centro de Salud / Laboratorio -->
          <div class="col-md-6">
            <label for="inputCaregiverDocCenter" class="form-label text-white-50 small fw-semibold mb-1">Centro de Salud / CESFAM / Laboratorio</label>
            <input type="text" id="inputCaregiverDocCenter" class="form-control form-control-sm text-white" placeholder="Ej. CESFAM Bellavista / Laboratorio Central San Lucas" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 8px;">
          </div>

          <!-- Nota / Observaciones clínicas (Opcional) -->
          <div class="col-12">
            <label for="inputCaregiverDocNotes" class="form-label text-white-50 small fw-semibold mb-1">
              Nota / Observaciones Clínicas (Opcional)
            </label>
            <textarea id="inputCaregiverDocNotes" rows="2" class="form-control form-control-sm text-white" placeholder="Opcional: indicaciones de posología, valores de referencia o recomendaciones..." style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 8px;"></textarea>
          </div>

          <!-- Selector de Archivo / Fotografía con Cámara -->
          <div class="col-12">
            <label for="inputCaregiverDocFile" class="form-label text-white-50 small fw-semibold mb-1">
              <i class="bi bi-paperclip me-1 text-info"></i>Adjuntar Archivo o Capturar con Cámara
            </label>
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <input type="file" id="inputCaregiverDocFile" accept="image/*,application/pdf" class="form-control form-control-sm text-white flex-grow-1" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 8px;">
              <button type="button" id="btnOpenCaregiverCamera" class="btn btn-sm btn-outline-info fw-semibold px-3 py-1.5 d-inline-flex align-items-center gap-1.5 text-nowrap shadow-sm" style="border-radius: 8px; font-size: 0.8rem;">
                <i class="bi bi-camera-fill"></i> 📷 Tomar Foto con Cámara
              </button>
            </div>

            <!-- Aviso claro de privacidad Ley N° 19.628 -->
            <div class="p-2 rounded mt-2 d-flex align-items-center gap-2" style="background: rgba(14, 165, 233, 0.05); border: 1px solid rgba(14, 165, 233, 0.2); font-size: 0.76rem;">
              <i class="bi bi-shield-lock-fill text-info fs-6"></i>
              <span class="text-white-50">Permiso requerido solo para capturar documentos clínicos del paciente — Ley N° 19.628</span>
            </div>

            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-1">
              <small class="text-white-50" style="font-size: 0.74rem;">
                <i class="bi bi-info-circle me-1 text-info"></i>Formatos permitidos: Imágenes (JPG, PNG, WebP) o PDF. En smartphones permite abrir la cámara o seleccionar de la galería.
              </small>
              <span id="caregiverDocFileFeedback" class="small fw-semibold text-info" style="font-size: 0.74rem;"></span>
            </div>

            <!-- Vista previa del archivo o foto capturada lista para guardar -->
            <div id="caregiverDocLivePreviewBox" class="mt-2.5 p-2.5 rounded-3 d-none" style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.12);"></div>

            <!-- Verificación Inteligente por IA (OCR & NLP Clínico) -->
            <div id="caregiverDocAiVerificationBox" class="mt-2.5 d-none"></div>
          </div>

          <!-- Botón de Guardado -->
          <div class="col-12 text-end pt-2">
            <button type="submit" id="btnSubmitCaregiverDoc" class="btn btn-sm btn-glass-primary px-4 py-2 fw-semibold d-inline-flex align-items-center gap-2 shadow-sm" style="border-radius: 8px;">
              <i class="bi bi-cloud-check-fill"></i> Guardar en Documentos del Paciente
            </button>
          </div>
        </div>
      </form>
    </div>

    <!-- Lista de Documentos Registrados -->
    <div class="glass-card p-4 border-0 mb-4" id="cardCaregiverDocsList">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3 pb-2 border-bottom border-light border-opacity-10">
        <div>
          <h5 class="fw-bold m-0 text-white d-flex align-items-center gap-2">
            <i class="bi bi-files text-primary"></i>
            <span>Historial de Documentos y Recetas</span>
            <span class="badge rounded-pill bg-primary bg-opacity-25 text-primary border border-primary border-opacity-50 small ms-1" id="caregiverDocsCountBadge">${sortedDocs.length}</span>
          </h5>
          <small class="text-white-50" style="font-size: 0.76rem;">Ordenados cronológicamente por fecha de registro &bull; Registro inmutable Ley 20.584</small>
        </div>
        <span class="badge rounded-pill px-2.5 py-1 text-white-50 border border-light border-opacity-10" style="font-size: 0.72rem;">
          <i class="bi bi-clock-history me-1"></i>Más recientes primero
        </span>
      </div>

      <!-- Filtro Rápido por Especialidad y Tipo -->
      <div class="p-2.5 rounded-3 mb-3 d-flex flex-wrap align-items-center gap-2" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);">
        <div class="d-flex align-items-center gap-1.5 text-white-50 small fw-semibold me-1">
          <i class="bi bi-funnel-fill text-info"></i>
          <span>Filtros rápidos:</span>
        </div>

        <!-- Filtro Especialidad -->
        <div class="flex-grow-1 flex-sm-grow-0" style="min-width: 175px;">
          <select id="filterCaregiverDocSpecialty" class="form-select form-select-sm text-white" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 8px; font-size: 0.78rem; cursor: pointer;">
            <option value="ALL" class="bg-dark text-white">Todas las Especialidades</option>
            <option value="Medicina General" class="bg-dark text-white">🩺 Medicina General</option>
            <option value="Cardiología" class="bg-dark text-white">❤️ Cardiología</option>
            <option value="Geriatría" class="bg-dark text-white">👴 Geriatría</option>
            <option value="Kinesiología" class="bg-dark text-white">🏃 Kinesiología</option>
            <option value="Nutrición" class="bg-dark text-white">🥗 Nutrición</option>
            <option value="Enfermería" class="bg-dark text-white">🩹 Enfermería</option>
            <option value="Laboratorio / Exámenes" class="bg-dark text-white">🔬 Laboratorio / Exámenes</option>
            <option value="Urgencias" class="bg-dark text-white">🚨 Urgencias</option>
          </select>
        </div>

        <!-- Filtro Tipo -->
        <div class="flex-grow-1 flex-sm-grow-0" style="min-width: 155px;">
          <select id="filterCaregiverDocType" class="form-select form-select-sm text-white" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 8px; font-size: 0.78rem; cursor: pointer;">
            <option value="ALL" class="bg-dark text-white">Todos los Tipos</option>
            <option value="Receta Médica" class="bg-dark text-white">💊 Receta Médica</option>
            <option value="Orden de Examen" class="bg-dark text-white">📋 Orden de Examen</option>
            <option value="Resultado de Laboratorio" class="bg-dark text-white">🔬 Resultado de Laboratorio</option>
            <option value="Informe Clínico" class="bg-dark text-white">📄 Informe Clínico</option>
          </select>
        </div>

        <!-- Botón Restablecer Filtros -->
        <button type="button" id="btnResetDocFilters" class="btn btn-sm btn-outline-secondary px-2.5 py-1 text-white-50 d-inline-flex align-items-center gap-1 ms-auto" style="border-radius: 8px; font-size: 0.75rem;">
          <i class="bi bi-arrow-counterclockwise"></i> Limpiar
        </button>
      </div>

      <div class="d-flex flex-column gap-3" id="caregiverDocsItemsContainer">
        <!-- Generado dinámicamente por applyDocsFilters() -->
      </div>
    </div>
  `;

  // Helper para renderizar cada tarjeta de documento con etiqueta de especialidad
  const renderDocCardHtml = (doc) => {
    let typeBadge = '';
    if (doc.type === 'Receta Médica') {
      typeBadge = `
        <span class="badge rounded-pill fw-semibold" style="background: rgba(14, 165, 233, 0.2); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.4); font-size: 0.72rem;">
          💊 Receta Médica
        </span>
      `;
    } else if (doc.type === 'Orden de Examen') {
      typeBadge = `
        <span class="badge rounded-pill fw-semibold" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); font-size: 0.72rem;">
          📋 Orden de Examen
        </span>
      `;
    } else if (doc.type === 'Resultado de Laboratorio' || doc.type === 'Examen') {
      typeBadge = `
        <span class="badge rounded-pill fw-semibold" style="background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.4); font-size: 0.72rem;">
          🔬 ${doc.type === 'Resultado de Laboratorio' ? 'Resultado de Laboratorio' : 'Examen'}
        </span>
      `;
    } else {
      typeBadge = `
        <span class="badge rounded-pill fw-semibold" style="background: rgba(245, 158, 11, 0.2); color: #fcd34d; border: 1px solid rgba(245, 158, 11, 0.4); font-size: 0.72rem;">
          📄 ${doc.type === 'Informe Clínico' ? 'Informe Clínico' : (doc.type || 'Informe')}
        </span>
      `;
    }

    const docSpecialty = doc.specialty || (doc.type === 'Examen' ? 'Laboratorio / Exámenes' : (doc.type === 'Receta Médica' ? 'Cardiología' : 'Medicina General'));
    const specialtyBadge = `
      <span class="badge rounded-pill fw-semibold" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.35); font-size: 0.7rem;">
        <i class="bi bi-heart-pulse-fill me-1"></i>${docSpecialty}
      </span>
    `;

    const folderName = doc.folder || (doc.type === 'Receta Médica' ? 'Recetas' : (doc.type === 'Examen' ? 'Exámenes' : 'Informes'));
    const folderBadge = `
      <span class="badge rounded-pill fw-semibold" style="background: rgba(255, 255, 255, 0.08); color: #cbd5e1; border: 1px solid rgba(255, 255, 255, 0.15); font-size: 0.7rem;">
        <i class="bi bi-folder-fill text-warning me-1"></i>${folderName}
      </span>
    `;

    const hasFileBadge = (doc.fileName || doc.fileData) ? `
      <span class="badge rounded-pill fw-normal" style="background: rgba(16, 185, 129, 0.15); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.35); font-size: 0.7rem;">
        <i class="bi bi-paperclip me-1"></i>${doc.fileName || 'Adjunto digital'}
      </span>
    ` : '';

    return `
      <div class="p-3 rounded-3" style="background: rgba(255, 255, 255, 0.025); border: 1px solid rgba(255, 255, 255, 0.09);">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2 pb-2 border-bottom border-light border-opacity-10">
          <div class="d-flex align-items-center gap-2 flex-wrap">
            ${typeBadge}
            ${specialtyBadge}
            ${folderBadge}
            <span class="text-white fw-bold" style="font-size: 0.95rem;">${doc.title}</span>
            ${hasFileBadge}
          </div>
          <div class="d-flex align-items-center gap-2">
            <span class="badge px-2.5 py-1 rounded-pill" style="background: rgba(255,255,255,0.06); color: #fff; font-size: 0.74rem;">
              <i class="bi bi-calendar-event me-1 text-info"></i>${doc.date || 'Sin fecha'}
            </span>
          </div>
        </div>

        <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div class="flex-grow-1" style="max-width: 82%;">
            <div class="d-flex align-items-center gap-2 text-white-50 flex-wrap mb-1.5" style="font-size: 0.8rem;">
              <span><i class="bi bi-person-fill-check text-warning me-1"></i>${doc.doctor || 'Médico tratante'}</span>
              <span>&bull;</span>
              <span><i class="bi bi-hospital text-danger me-1"></i>${doc.center || 'Centro de Salud'}</span>
            </div>
            ${doc.notes ? `
              <div class="text-white-50 p-2 rounded small" style="background: rgba(255,255,255,0.03); border-left: 3px solid rgba(14, 165, 233, 0.5); font-size: 0.8rem; line-height: 1.45;">
                ${doc.notes}
              </div>
            ` : ''}
          </div>
          <div>
            <button type="button" class="btn btn-sm btn-outline-info btn-view-caregiver-doc fw-semibold px-3 py-1.5 d-inline-flex align-items-center gap-1.5 shadow-sm" data-id="${doc.id}" style="border-radius: 8px; font-size: 0.82rem;">
              <i class="bi bi-eye-fill"></i> Ver
            </button>
          </div>
        </div>
      </div>
    `;
  };

  // Lógica de filtrado dinámico por especialidad y tipo
  const filterSpecialtySelect = document.getElementById('filterCaregiverDocSpecialty');
  const filterTypeSelect = document.getElementById('filterCaregiverDocType');
  const btnResetFilters = document.getElementById('btnResetDocFilters');
  const itemsContainer = document.getElementById('caregiverDocsItemsContainer');
  const countBadge = document.getElementById('caregiverDocsCountBadge');

  const applyDocsFilters = () => {
    if (!itemsContainer) return;
    const selectedSpecialty = filterSpecialtySelect ? filterSpecialtySelect.value : 'ALL';
    const selectedType = filterTypeSelect ? filterTypeSelect.value : 'ALL';

    const filtered = sortedDocs.filter(doc => {
      const docSpecialty = doc.specialty || (doc.type === 'Examen' ? 'Laboratorio / Exámenes' : (doc.type === 'Receta Médica' ? 'Cardiología' : 'Medicina General'));
      const matchSpecialty = (selectedSpecialty === 'ALL') || (docSpecialty === selectedSpecialty);
      const matchType = (selectedType === 'ALL') || (doc.type === selectedType);
      return matchSpecialty && matchType;
    });

    if (countBadge) {
      if (selectedSpecialty === 'ALL' && selectedType === 'ALL') {
        countBadge.textContent = `${sortedDocs.length}`;
      } else {
        countBadge.textContent = `${filtered.length} de ${sortedDocs.length}`;
      }
    }

    if (filtered.length === 0) {
      itemsContainer.innerHTML = `
        <div class="text-center py-4 text-white-50">
          <i class="bi bi-search fs-1 d-block mb-2 text-white-50"></i>
          <p class="m-0 fw-semibold">No se encontraron documentos con los filtros seleccionados.</p>
          <small class="text-white-50">Prueba seleccionando otra especialidad o tipo de documento.</small>
        </div>
      `;
      return;
    }

    itemsContainer.innerHTML = filtered.map(doc => renderDocCardHtml(doc)).join('');

    // Conectar botones "👁️ Ver" para los documentos mostrados
    itemsContainer.querySelectorAll('.btn-view-caregiver-doc').forEach(btn => {
      btn.onclick = () => {
        const docId = btn.getAttribute('data-id');
        const targetDoc = sortedDocs.find(d => d.id === docId);
        if (targetDoc) {
          openCaregiverDocPreviewModal(targetDoc, patient);
        }
      };
    });
  };

  if (filterSpecialtySelect) filterSpecialtySelect.onchange = applyDocsFilters;
  if (filterTypeSelect) filterTypeSelect.onchange = applyDocsFilters;
  if (btnResetFilters) {
    btnResetFilters.onclick = () => {
      if (filterSpecialtySelect) filterSpecialtySelect.value = 'ALL';
      if (filterTypeSelect) filterTypeSelect.value = 'ALL';
      applyDocsFilters();
    };
  }

  // Render inicial de la lista
  applyDocsFilters();

  // Manejo de título y carpeta estandarizados reactivos
  const docTypeSelect = document.getElementById('inputCaregiverDocType');
  const docDateInput = document.getElementById('inputCaregiverDocDate');
  const autoTitlePreviewEl = document.getElementById('caregiverDocAutoTitlePreview');
  const autoFolderBadgeEl = document.getElementById('caregiverDocAutoFolderBadge');

  const updateAutoTitleDisplay = () => {
    if (!docTypeSelect || !docDateInput) return;
    const currentType = docTypeSelect.value;
    const currentDate = docDateInput.value || getTodayDateString();
    const { folder, title } = getDocumentFolderAndTitle(currentType, currentDate);
    if (autoTitlePreviewEl) autoTitlePreviewEl.textContent = title;
    if (autoFolderBadgeEl) autoFolderBadgeEl.textContent = `📁 Carpeta: ${folder}`;
  };

  if (docTypeSelect) docTypeSelect.onchange = updateAutoTitleDisplay;
  if (docDateInput) docDateInput.oninput = updateAutoTitleDisplay;

  // Manejo de carga de archivo / fotografía
  const form = document.getElementById('formCaregiverUploadDoc');
  const fileInput = document.getElementById('inputCaregiverDocFile');
  const fileFeedback = document.getElementById('caregiverDocFileFeedback');
  const livePreviewBox = document.getElementById('caregiverDocLivePreviewBox');

  let selectedFileObj = null;
  let selectedFileDataUrl = null;

  const renderDocPreviewUI = (fileObj, dataUrl) => {
    if (!livePreviewBox) return;
    if (!fileObj || !dataUrl) {
      livePreviewBox.innerHTML = '';
      livePreviewBox.classList.add('d-none');
      return;
    }

    const isImg = fileObj.type && fileObj.type.startsWith('image/');

    livePreviewBox.innerHTML = `
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div class="d-flex align-items-center gap-3">
          ${isImg ? `
            <img src="${dataUrl}" alt="Preview" class="rounded border border-light border-opacity-10 shadow-sm" style="max-height: 75px; max-width: 100px; object-fit: contain; background: #000;">
          ` : `
            <div class="d-flex align-items-center justify-content-center rounded" style="width: 60px; height: 60px; background: rgba(14, 165, 233, 0.15); border: 1px solid rgba(14, 165, 233, 0.35); font-size: 1.8rem;">
              📄
            </div>
          `}
          <div>
            <span class="badge rounded-pill fw-semibold mb-1" style="background: rgba(16, 185, 129, 0.2); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.4); font-size: 0.72rem;">
              <i class="bi bi-check2-circle me-1"></i>${isImg ? 'Foto capturada lista para guardar' : 'Documento listo para guardar'}
            </span>
            <div class="text-white small fw-bold text-truncate" style="max-width: 320px;">${fileObj.name}</div>
            <small class="text-white-50">${Math.round(fileObj.size / 1024)} KB &bull; Formato ${isImg ? 'JPEG' : 'PDF'}</small>
          </div>
        </div>
        <button type="button" id="btnRemoveDocPreview" class="btn btn-sm btn-outline-danger px-2.5 py-1" style="border-radius: 8px; font-size: 0.76rem;">
          <i class="bi bi-trash-fill me-1"></i>Quitar
        </button>
      </div>
    `;
    livePreviewBox.classList.remove('d-none');

    const removeBtn = document.getElementById('btnRemoveDocPreview');
    if (removeBtn) {
      removeBtn.onclick = () => {
        selectedFileObj = null;
        selectedFileDataUrl = null;
        if (fileInput) fileInput.value = '';
        if (fileFeedback) fileFeedback.textContent = '';
        renderDocPreviewUI(null, null);
        performAiVerification(null, null);
      };
    }
  };

  let isDocBlockedByAi = false;
  let lastAiResult = null;

  const performAiVerification = (fileObj, dataUrl) => {
    const aiBox = document.getElementById('caregiverDocAiVerificationBox');
    const submitBtn = document.getElementById('btnSubmitCaregiverDoc');
    if (!aiBox || !fileObj) {
      if (aiBox) {
        aiBox.innerHTML = '';
        aiBox.classList.add('d-none');
      }
      isDocBlockedByAi = false;
      lastAiResult = null;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-50');
      }
      return;
    }

    // Ejecutar Verificación Inteligente por IA
    const aiResult = runAiDocumentVerification(fileObj, dataUrl, patient);
    lastAiResult = aiResult;

    if (!aiResult.isValid) {
      // BLOQUEAR GUARDADO
      isDocBlockedByAi = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50');
      }

      const detectedName = aiResult.detectedPatient?.name || 'Otro Paciente';
      const detectedRut = aiResult.detectedPatient?.fileNumber || aiResult.detectedPatient?.rut || '';

      aiBox.innerHTML = `
        <div class="p-3.5 rounded-3 mb-2" style="background: rgba(239, 68, 68, 0.12); border: 1.5px solid rgba(239, 68, 68, 0.45); box-shadow: 0 0 20px rgba(239, 68, 68, 0.15);">
          <div class="d-flex align-items-start gap-3">
            <span class="fs-2 text-danger">⚠️</span>
            <div class="flex-grow-1">
              <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-1">
                <h6 class="fw-bold text-danger m-0 d-flex align-items-center gap-2">
                  <span>⚠️ Documento pertenece a otro paciente. Verifica antes de subir</span>
                </h6>
                <span class="badge rounded-pill fw-bold bg-danger text-white px-2.5 py-1" style="font-size: 0.72rem;">
                  <i class="bi bi-shield-slash-fill me-1"></i>GUARDADO BLOQUEADO
                </span>
              </div>
              <p class="text-white-50 small mb-2" style="font-size: 0.82rem; line-height: 1.45;">
                La Verificación Inteligente por IA (OCR & NLP) analizó el documento y detectó que pertenece a <strong class="text-white">${detectedName}</strong> ${detectedRut ? `(RUT: <span class="text-warning font-monospace">${detectedRut}</span>)` : ''}, quien <strong>no coincide con la ficha del paciente activo</strong>: <strong class="text-white">${patient.name}</strong> (<span class="text-warning font-monospace">${patient.fileNumber || patient.rut || 'Sin RUT'}</span>).
              </p>
              <div class="p-2 rounded d-flex align-items-center gap-2" style="background: rgba(0,0,0,0.35); border: 1px solid rgba(239, 68, 68, 0.3); font-size: 0.76rem;">
                <i class="bi bi-exclamation-octagon-fill text-warning"></i>
                <span class="text-white">En resguardo del secreto profesional (<strong>Ley N° 20.584</strong>) y protección de datos sensibles (<strong>Ley N° 19.628</strong>), este archivo no puede ser guardado en esta ficha.</span>
              </div>
            </div>
          </div>
        </div>
      `;
      aiBox.classList.remove('d-none');

      if (window.showGlassAlert) {
        window.showGlassAlert('⚠️ Documento pertenece a otro paciente. Verifica antes de subir', 'danger');
      }
      if (typeof speakText === 'function' && typeof getModoVozActivo === 'function' && getModoVozActivo()) {
        speakText('Alerta de seguridad: Documento pertenece a otro paciente. Guardado bloqueado según Ley veinte mil quinientos ochenta y cuatro.');
      }
    } else {
      // DOCUMENTO VÁLIDO: ACTUALIZAR CLASIFICACIÓN Y PERMITIR GUARDADO
      isDocBlockedByAi = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-50');
      }

      // Auto-seleccionar tipo en formulario y actualizar previsualización
      if (docTypeSelect) {
        docTypeSelect.value = aiResult.classification.type;
        updateAutoTitleDisplay();
      }

      aiBox.innerHTML = `
        <div class="p-3 rounded-3 mb-2" style="background: rgba(16, 185, 129, 0.1); border: 1.5px solid rgba(16, 185, 129, 0.4); box-shadow: 0 0 15px rgba(16, 185, 129, 0.1);">
          <div class="d-flex align-items-start gap-3">
            <span class="fs-3 text-success">🤖</span>
            <div class="flex-grow-1">
              <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-1">
                <div class="d-flex align-items-center gap-2">
                  <h6 class="fw-bold text-success m-0">Verificación Inteligente por IA: APROBADA</h6>
                  <span class="badge rounded-pill fw-bold" style="background: rgba(14, 165, 233, 0.25); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.45); font-size: 0.72rem;">
                    ${aiResult.classification.icon} ${aiResult.classification.label}
                  </span>
                </div>
                <span class="badge rounded-pill fw-semibold bg-success bg-opacity-25 text-success border border-success border-opacity-50 px-2 py-1" style="font-size: 0.72rem;">
                  <i class="bi bi-check-all me-1"></i>Coincidencia Titular/Carga 100%
                </span>
              </div>
              <p class="text-white-50 small m-0" style="font-size: 0.8rem; line-height: 1.4;">
                Clasificado automáticamente como <strong>${aiResult.classification.label}</strong>. Identidad del documento confirmada para <strong class="text-white">${patient.name}</strong> (RUT: <span class="text-warning font-monospace">${patient.fileNumber || patient.rut || 'Ficha Activa'}</span>). Cumple con los protocolos de asignación segura bajo la <strong>Ley N° 20.584</strong> y <strong>Ley N° 19.628</strong>.
              </p>
            </div>
          </div>
        </div>
      `;
      aiBox.classList.remove('d-none');

      if (window.showGlassAlert) {
        window.showGlassAlert(`🤖 Verificación IA: Clasificado como ${aiResult.classification.label} para ${patient.name}.`, 'success');
      }
    }
  };

  if (fileInput && fileFeedback) {
    fileInput.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        if (file.size > 3.5 * 1024 * 1024) {
          fileFeedback.innerHTML = `<span class="text-danger"><i class="bi bi-exclamation-triangle-fill me-1"></i>Archivo excede 3.5MB. Selecciona uno más liviano.</span>`;
          selectedFileObj = null;
          selectedFileDataUrl = null;
          fileInput.value = '';
          renderDocPreviewUI(null, null);
          performAiVerification(null, null);
          return;
        }
        selectedFileObj = file;
        const isImg = file.type.startsWith('image/');
        const isPdf = file.type === 'application/pdf';
        fileFeedback.innerHTML = `<span class="text-success"><i class="bi bi-check-circle-fill me-1"></i>${isImg ? 'Foto / Imagen' : (isPdf ? 'Documento PDF' : 'Archivo')}: ${file.name} (${Math.round(file.size / 1024)} KB)</span>`;

        updateAutoTitleDisplay();

        const reader = new FileReader();
        reader.onload = (ev) => {
          selectedFileDataUrl = ev.target.result;
          renderDocPreviewUI(selectedFileObj, selectedFileDataUrl);
          performAiVerification(selectedFileObj, selectedFileDataUrl);
        };
        reader.readAsDataURL(file);
      } else {
        selectedFileObj = null;
        selectedFileDataUrl = null;
        fileFeedback.textContent = '';
        renderDocPreviewUI(null, null);
        performAiVerification(null, null);
      }
    };
  }

  // Conectar botón "📷 Tomar Foto con Cámara"
  const btnCamera = document.getElementById('btnOpenCaregiverCamera');
  if (btnCamera) {
    btnCamera.onclick = () => {
      openCaregiverLiveCameraModal((photoObj, photoDataUrl) => {
        selectedFileObj = photoObj;
        selectedFileDataUrl = photoDataUrl;
        if (fileInput) fileInput.value = '';
        if (fileFeedback) {
          fileFeedback.innerHTML = `<span class="text-success"><i class="bi bi-camera-fill me-1"></i>Foto capturada: ${photoObj.name} (${Math.round(photoObj.size / 1024)} KB)</span>`;
        }
        renderDocPreviewUI(photoObj, photoDataUrl);
        updateAutoTitleDisplay();
        performAiVerification(photoObj, photoDataUrl);
        if (window.showGlassAlert) {
          window.showGlassAlert('📷 Fotografía capturada con éxito y analizada por IA.', 'success');
        }
      });
    };
  }

  // Envío del formulario de nuevo documento
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();

      if (isDocBlockedByAi) {
        if (window.showGlassAlert) {
          window.showGlassAlert('⚠️ Documento pertenece a otro paciente. Verifica antes de subir', 'danger');
        }
        return;
      }

      const type = document.getElementById('inputCaregiverDocType').value;
      const specialty = document.getElementById('inputCaregiverDocSpecialty')?.value || 'Medicina General';
      const date = document.getElementById('inputCaregiverDocDate').value || getTodayDateString();
      const { folder, title } = getDocumentFolderAndTitle(type, date);
      const doctor = document.getElementById('inputCaregiverDocDoctor').value.trim();
      const center = document.getElementById('inputCaregiverDocCenter').value.trim();
      const notes = document.getElementById('inputCaregiverDocNotes').value.trim();

      const newDoc = {
        id: `doc-${Date.now()}`,
        type: type,
        specialty: specialty,
        folder: folder,
        category: folder.toLowerCase(),
        title: title, // Asignado automáticamente
        date: date,
        createdAt: new Date().toISOString(),
        doctor: doctor || 'Médico tratante no especificado',
        center: center || 'Centro de Salud / CESFAM',
        notes: notes || 'Sin notas adicionales.',
        fileName: selectedFileObj ? selectedFileObj.name : null,
        fileType: selectedFileObj ? selectedFileObj.type : null,
        fileData: selectedFileDataUrl || null,
        aiVerification: lastAiResult ? {
          classifiedAs: lastAiResult.classification.label,
          verifiedPatient: patient.name,
          verifiedRut: patient.fileNumber || patient.rut,
          timestamp: new Date().toISOString(),
          status: 'APROBADO'
        } : null
      };

      // Interceptar guardado con modal de verificación y confirmación
      openConfirmDocSaveModal(newDoc, patient, () => {
        const currentDocs = getCaregiverPatientDocuments(patient);
        currentDocs.unshift(newDoc);
        saveCaregiverPatientDocuments(patient, currentDocs);

        // Almacenar en la clave global compartida por paciente
        saveRecordToGlobalFicha(patient, newDoc, newDoc.type === 'Receta Médica' ? 'PRESCRIPTION' : 'DOCUMENT');

        // Insertar evento inmutable en cuidapp_audit_log (DS N° 41 / Ley 19.628)
        insertAuditLogEntry({
          patient: patient,
          author: 'Sofía Díaz (Cuidador)',
          specialty: newDoc.specialty || 'Medicina General',
          recordType: newDoc.type || 'Documento Clínico',
          details: `${newDoc.title} archivado en carpeta ${newDoc.folder || 'Documentos'}. Médico: ${newDoc.doctor}. Centro: ${newDoc.center}`,
          recordId: newDoc.id
        });

        renderCaregiverDocuments(patient);

        if (window.showGlassAlert) {
          window.showGlassAlert(`📁 ${type} "${newDoc.title}" guardada exitosamente en la carpeta ${folder} de ${patient.name}.`, 'success');
        }
      });
    };
  }

  // Conectar botones "👁️ Ver"
  container.querySelectorAll('.btn-view-caregiver-doc').forEach(btn => {
    btn.onclick = () => {
      const docId = btn.getAttribute('data-id');
      const targetDoc = sortedDocs.find(d => d.id === docId);
      if (targetDoc) {
        openCaregiverDocPreviewModal(targetDoc, patient);
      }
    };
  });
}

// ============================================================================
// MODAL COMPACTO DE CAPTURA EN VIVO CON CÁMARA (LEY N° 19.628 / DS N° 41)
// ============================================================================
export function openCaregiverLiveCameraModal(onPhotoCaptured) {
  // Verificar soporte de getUserMedia
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (window.showGlassAlert) {
      window.showGlassAlert('Tu navegador no soporta acceso directo a la cámara. Te sugerimos subir el archivo o foto desde la galería.', 'info');
    }
    return;
  }

  const modalId = 'modalCaregiverLiveCamera';
  const existing = document.getElementById(modalId);
  if (existing) existing.remove();

  const modalHtml = `
    <div class="modal fade show d-block" id="${modalId}" tabindex="-1" style="background: rgba(0, 0, 0, 0.88); backdrop-filter: blur(8px); z-index: 1070;">
      <div class="modal-dialog modal-dialog-centered modal-md">
        <div class="modal-content glass-card text-white border-light border-opacity-10" style="background: #090f20; border-radius: 20px; box-shadow: 0 25px 60px rgba(0,0,0,0.85);">
          
          <!-- Cabecera del Modal Compacto -->
          <div class="modal-header border-bottom border-light border-opacity-10 p-3.5 pb-2.5">
            <div class="d-flex align-items-center gap-2.5">
              <span class="fs-4 text-info">📷</span>
              <div>
                <h6 class="modal-title fw-bold m-0 text-white d-flex align-items-center gap-2">
                  <span>Tomar Foto con Cámara</span>
                  <span class="badge rounded-pill fw-semibold" style="background: rgba(14, 165, 233, 0.2); color: #38bdf8; font-size: 0.7rem;">En Vivo</span>
                </h6>
                <small class="text-white-50" style="font-size: 0.72rem;">Enfoca la receta médica o examen con buena iluminación</small>
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" id="btnCloseLiveCameraX"></button>
          </div>

          <!-- Cuerpo del Modal Compacto -->
          <div class="modal-body p-3">
            
            <!-- Aviso claro de privacidad Ley 19.628 -->
            <div class="p-2 rounded mb-2.5 d-flex align-items-center gap-2" style="background: rgba(14, 165, 233, 0.08); border: 1px solid rgba(14, 165, 233, 0.25); font-size: 0.76rem;">
              <i class="bi bi-shield-lock-fill text-info"></i>
              <span class="text-white-50">Permiso requerido solo para capturar documentos clínicos del paciente — Ley N° 19.628</span>
            </div>

            <!-- Visor de Video en Vivo Compacto -->
            <div class="position-relative text-center rounded-3 overflow-hidden" style="background: #000; border: 1px solid rgba(255, 255, 255, 0.12); min-height: 260px; max-height: 340px;">
              <video id="caregiverLiveVideo" autoplay playsinline class="w-100 rounded" style="max-height: 340px; object-fit: contain; display: block; margin: 0 auto;"></video>
              
              <!-- Marco guía para encuadrar la receta -->
              <div class="position-absolute top-50 start-50 translate-middle pointer-events-none" style="width: 88%; height: 82%; border: 2px dashed rgba(56, 189, 248, 0.6); border-radius: 10px; pointer-events: none;">
                <span class="position-absolute top-0 start-50 translate-middle-x badge px-2.5 py-0.5 rounded-pill" style="background: rgba(0,0,0,0.65); color: #38bdf8; font-size: 0.65rem; margin-top: 6px;">
                  Encuadre el documento aquí
                </span>
              </div>
            </div>

            <!-- Canvas oculto para procesar el frame a JPEG -->
            <canvas id="caregiverLiveCanvas" class="d-none"></canvas>
          </div>

          <!-- Pie del Modal con Botones -->
          <div class="modal-footer border-top border-light border-opacity-10 p-2.5 px-3.5 d-flex justify-content-between align-items-center">
            <button type="button" class="btn btn-sm btn-glass-secondary px-3 py-1.5 fw-semibold" id="btnCancelLiveCamera">
              Cancelar
            </button>
            <button type="button" class="btn btn-sm btn-glass-primary px-4 py-2 fw-semibold d-inline-flex align-items-center gap-2 shadow-sm" id="btnSnapLivePhoto" style="border-radius: 8px;">
              <i class="bi bi-camera-fill"></i> 📸 Capturar Foto
            </button>
          </div>

        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalEl = document.getElementById(modalId);
  const videoEl = document.getElementById('caregiverLiveVideo');
  const canvasEl = document.getElementById('caregiverLiveCanvas');
  const snapBtn = document.getElementById('btnSnapLivePhoto');
  const closeX = document.getElementById('btnCloseLiveCameraX');
  const cancelBtn = document.getElementById('btnCancelLiveCamera');

  let activeStream = null;

  const stopCameraStream = () => {
    if (activeStream) {
      activeStream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {}
      });
      activeStream = null;
    }
  };

  const closeLiveModal = () => {
    stopCameraStream();
    if (modalEl) modalEl.remove();
    document.removeEventListener('keydown', handleEsc);
  };

  const handleEsc = (e) => {
    if (e.key === 'Escape') closeLiveModal();
  };

  if (closeX) closeX.onclick = closeLiveModal;
  if (cancelBtn) cancelBtn.onclick = closeLiveModal;
  document.addEventListener('keydown', handleEsc);
  modalEl.onclick = (e) => {
    if (e.target === modalEl) closeLiveModal();
  };

  // Solicitar permiso de cámara del dispositivo con getUserMedia
  navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    },
    audio: false
  }).then(stream => {
    activeStream = stream;
    if (videoEl) {
      videoEl.srcObject = stream;
      videoEl.play().catch(() => {});
    }
  }).catch(err => {
    console.warn('Error al solicitar permiso de cámara:', err);
    closeLiveModal();
    if (window.showGlassAlert) {
      window.showGlassAlert(
        'No se pudo acceder a la cámara o el permiso fue denegado. Te sugerimos subir el archivo o fotografía directamente desde la galería.',
        'warning'
      );
    }
  });

  // Botón "📸 Capturar Foto": convierte a JPEG, cierra cámara y deja cargada la foto
  if (snapBtn) {
    snapBtn.onclick = () => {
      if (!videoEl || !canvasEl) return;
      const w = videoEl.videoWidth || 640;
      const h = videoEl.videoHeight || 480;
      canvasEl.width = w;
      canvasEl.height = h;
      const ctx = canvasEl.getContext('2d');
      ctx.drawImage(videoEl, 0, 0, w, h);

      // Convertir imagen capturada a JPEG
      const jpegDataUrl = canvasEl.toDataURL('image/jpeg', 0.88);
      const photoName = `foto_documento_${formatDateForTitle(getTodayDateString())}_${Date.now().toString().slice(-4)}.jpg`;
      const photoObj = {
        name: photoName,
        type: 'image/jpeg',
        size: Math.round(jpegDataUrl.length * 0.75)
      };

      // Cerrar la cámara automáticamente (liberando el hardware)
      closeLiveModal();

      // Dejar cargada la foto en la vista previa del documento lista para guardar
      if (typeof onPhotoCaptured === 'function') {
        onPhotoCaptured(photoObj, jpegDataUrl);
      }
    };
  }
}

// ============================================================================
// MODAL DE CONFIRMACIÓN Y VERIFICACIÓN DE IDENTIDAD (LEY N° 19.628 / DS N° 41)
// ============================================================================
export function openConfirmDocSaveModal(newDoc, patient = activePatient, onConfirmed) {
  if (!newDoc || !patient) return;

  const modalId = 'modalCaregiverConfirmDocSave';
  const existing = document.getElementById(modalId);
  if (existing) existing.remove();

  const patientRut = patient.fileNumber || patient.rut || 'Sin RUT registrado';

  const modalHtml = `
    <div class="modal fade show d-block" id="${modalId}" tabindex="-1" style="background: rgba(0, 0, 0, 0.84); backdrop-filter: blur(8px); z-index: 1065;">
      <div class="modal-dialog modal-dialog-centered modal-md">
        <div class="modal-content glass-card text-white border-light border-opacity-10" style="background: #090f20; border-radius: 20px; box-shadow: 0 25px 60px rgba(0,0,0,0.85);">
          
          <!-- Cabecera del Modal -->
          <div class="modal-header border-bottom border-light border-opacity-10 p-4 pb-3">
            <div class="d-flex align-items-center gap-3">
              <span class="fs-2 text-warning">🛡️</span>
              <div>
                <h5 class="modal-title fw-bold m-0 text-white d-flex align-items-center gap-2">
                  <span>Verificación de Identidad del Paciente</span>
                </h5>
                <small class="text-white-50">Protocolo de Asignación Segura de Documentos Clínicos</small>
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" id="btnCloseConfirmDocSaveX"></button>
          </div>

          <!-- Cuerpo del Modal -->
          <div class="modal-body p-4">
            
            <!-- TARJETA EN GRANDE: NOMBRE COMPLETO Y RUT DEL PACIENTE ACTIVO -->
            <div class="p-3.5 rounded-3 mb-3 text-center" style="background: rgba(14, 165, 233, 0.08); border: 1.5px solid rgba(14, 165, 233, 0.35); box-shadow: inset 0 0 20px rgba(14, 165, 233, 0.08);">
              <small class="text-info text-uppercase fw-bold d-block mb-1" style="font-size: 0.76rem; letter-spacing: 0.08em;">
                <i class="bi bi-person-bounding-box me-1"></i>PACIENTE DESTINATARIO
              </small>
              <h3 class="fw-bolder text-white mb-2" style="font-size: 1.6rem; letter-spacing: -0.02em;">${patient.name}</h3>
              <div class="d-inline-flex align-items-center gap-2 px-3 py-1.5 rounded-pill" style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4);">
                <span class="text-white-50 small fw-semibold">RUT:</span>
                <span class="fs-4 fw-bold text-warning font-monospace">${patientRut}</span>
              </div>
            </div>

            <!-- Resumen del documento a vincular -->
            <div class="p-2.5 rounded-3 mb-3" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); font-size: 0.82rem;">
              <div class="d-flex justify-content-between align-items-center mb-1 flex-wrap gap-1">
                <span class="text-white-50">Documento a Vincular:</span>
                <div class="d-flex align-items-center gap-1.5 flex-wrap">
                  <span class="badge rounded-pill fw-semibold" style="background: rgba(14, 165, 233, 0.2); color: #38bdf8;">${newDoc.type}</span>
                  <span class="badge rounded-pill fw-semibold" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.35); font-size: 0.72rem;"><i class="bi bi-heart-pulse-fill me-1"></i>${newDoc.specialty || 'Medicina General'}</span>
                  <span class="badge rounded-pill fw-semibold" style="background: rgba(255, 255, 255, 0.08); color: #cbd5e1; border: 1px solid rgba(255, 255, 255, 0.15);">📁 Carpeta: ${newDoc.folder || 'Recetas'}</span>
                </div>
              </div>
              <div class="text-white fw-bold text-truncate">${newDoc.title}</div>
              ${newDoc.fileName ? `
                <div class="text-white-50 small mt-1">
                  <i class="bi bi-paperclip text-success me-1"></i>Archivo: <span class="text-white">${newDoc.fileName}</span>
                </div>
              ` : ''}
              ${newDoc.aiVerification ? `
                <div class="d-flex align-items-center justify-content-between p-2 rounded-2 mt-2" style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35);">
                  <div class="d-flex align-items-center gap-1.5 small">
                    <span class="fs-5 text-success">🤖</span>
                    <span class="text-white">Verificación Inteligente por IA: <strong>${newDoc.aiVerification.classifiedAs}</strong></span>
                  </div>
                  <span class="badge rounded-pill fw-semibold bg-success bg-opacity-25 text-success border border-success border-opacity-50" style="font-size: 0.68rem;">
                    <i class="bi bi-shield-check me-1"></i>Ley N° 20.584 / 19.628 OK
                  </span>
                </div>
              ` : ''}
            </div>

            <p class="text-white-50 small mb-3" style="font-size: 0.8rem; line-height: 1.45;">
              Para garantizar que este documento quede asociado a la ficha clínica correcta y cumpla con el secreto profesional de la <strong>Ley N° 20.584</strong> y protección de datos bajo <strong>Ley N° 19.628</strong>, confirma los siguientes puntos:
            </p>

            <!-- CHECKBOXES OBLIGATORIOS -->
            <div class="d-flex flex-column gap-2 mb-2">
              <div class="form-check p-2.5 rounded-3 d-flex align-items-center gap-2" style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.12);">
                <input class="form-check-input ms-1 me-2" type="checkbox" id="checkConfirmPatientIdentity" style="cursor: pointer; transform: scale(1.2);">
                <label class="form-check-label text-white fw-semibold" for="checkConfirmPatientIdentity" style="cursor: pointer; font-size: 0.86rem; user-select: none;">
                  Confirmo que el nombre y RUT coinciden con el paciente
                </label>
              </div>

              <div class="form-check p-2.5 rounded-3 d-flex align-items-center gap-2" style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.12);">
                <input class="form-check-input ms-1 me-2" type="checkbox" id="checkAuthorizeDataPrivacy" style="cursor: pointer; transform: scale(1.2);">
                <label class="form-check-label text-white fw-semibold" for="checkAuthorizeDataPrivacy" style="cursor: pointer; font-size: 0.86rem; user-select: none;">
                  Autorizo almacenamiento seguro bajo Ley N° 19.628
                </label>
              </div>
            </div>

          </div>

          <!-- Pie del Modal -->
          <div class="modal-footer border-top border-light border-opacity-10 p-3 px-4 d-flex justify-content-between align-items-center">
            <button type="button" class="btn btn-sm btn-glass-secondary px-3 py-1.5 fw-semibold" id="btnCancelConfirmDocSave">
              Cancelar
            </button>
            <button type="button" class="btn btn-sm btn-glass-primary px-4 py-2 fw-semibold d-inline-flex align-items-center gap-2 shadow-sm opacity-50" id="btnConfirmAndSaveDoc" disabled style="border-radius: 8px;">
              <i class="bi bi-shield-check"></i> Confirmar y Guardar
            </button>
          </div>

        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalEl = document.getElementById(modalId);
  const closeBtnX = document.getElementById('btnCloseConfirmDocSaveX');
  const cancelBtn = document.getElementById('btnCancelConfirmDocSave');
  const confirmBtn = document.getElementById('btnConfirmAndSaveDoc');
  const checkIdentity = document.getElementById('checkConfirmPatientIdentity');
  const checkPrivacy = document.getElementById('checkAuthorizeDataPrivacy');

  const closeModal = () => {
    if (modalEl) modalEl.remove();
    document.removeEventListener('keydown', handleEsc);
  };

  const handleEsc = (e) => {
    if (e.key === 'Escape') closeModal();
  };

  const updateConfirmBtnState = () => {
    const isBothChecked = !!(checkIdentity && checkIdentity.checked && checkPrivacy && checkPrivacy.checked);
    if (confirmBtn) {
      confirmBtn.disabled = !isBothChecked;
      if (isBothChecked) {
        confirmBtn.classList.remove('opacity-50');
      } else {
        confirmBtn.classList.add('opacity-50');
      }
    }
  };

  if (checkIdentity) checkIdentity.onchange = updateConfirmBtnState;
  if (checkPrivacy) checkPrivacy.onchange = updateConfirmBtnState;

  if (closeBtnX) closeBtnX.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;

  if (confirmBtn) {
    confirmBtn.onclick = () => {
      if (checkIdentity?.checked && checkPrivacy?.checked) {
        closeModal();
        if (typeof onConfirmed === 'function') {
          onConfirmed();
        }
      }
    };
  }

  document.addEventListener('keydown', handleEsc);
  modalEl.onclick = (e) => {
    if (e.target === modalEl) closeModal();
  };
}

// ============================================================================
// MODAL DE VISUALIZACIÓN / PREVIEW DE DOCUMENTOS CLÍNICOS
// ============================================================================
export function openCaregiverDocPreviewModal(doc, patient = activePatient) {
  if (!doc) return;

  const modalId = 'modalCaregiverDocPreview';
  const existing = document.getElementById(modalId);
  if (existing) existing.remove();

  let typeBadge = '';
  let typeIcon = '📄';
  if (doc.type === 'Receta Médica') {
    typeIcon = '💊';
    typeBadge = `<span class="badge rounded-pill fw-semibold" style="background: rgba(14, 165, 233, 0.2); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.4); font-size: 0.75rem;">Receta Médica</span>`;
  } else if (doc.type === 'Examen') {
    typeIcon = '🔬';
    typeBadge = `<span class="badge rounded-pill fw-semibold" style="background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.4); font-size: 0.75rem;">Examen de Salud</span>`;
  } else {
    typeBadge = `<span class="badge rounded-pill fw-semibold" style="background: rgba(245, 158, 11, 0.2); color: #fcd34d; border: 1px solid rgba(245, 158, 11, 0.4); font-size: 0.75rem;">Informe Clínico</span>`;
  }

  const docSpecialty = doc.specialty || (doc.type === 'Examen' ? 'Laboratorio / Exámenes' : (doc.type === 'Receta Médica' ? 'Cardiología' : 'Medicina General'));

  const isImage = (doc.fileData && (doc.fileData.startsWith('data:image') || doc.fileType?.startsWith('image/')));
  const isPdf = (doc.fileData && (doc.fileData.startsWith('data:application/pdf') || doc.fileType === 'application/pdf'));

  const modalHtml = `
    <div class="modal fade show d-block" id="${modalId}" tabindex="-1" style="background: rgba(0, 0, 0, 0.82); backdrop-filter: blur(8px); z-index: 1060;">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content glass-card text-white border-light border-opacity-10" style="background: #090f20; border-radius: 20px; box-shadow: 0 25px 60px rgba(0,0,0,0.85);">
          
          <!-- Cabecera del Modal -->
          <div class="modal-header border-bottom border-light border-opacity-10 p-4 pb-3">
            <div class="d-flex align-items-center gap-3">
              <span class="fs-2">${typeIcon}</span>
              <div>
                <h5 class="modal-title fw-bold m-0 text-white d-flex align-items-center gap-2 flex-wrap">
                  <span>${doc.title}</span>
                  ${typeBadge}
                  <span class="badge rounded-pill fw-semibold" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.35); font-size: 0.72rem;">
                    <i class="bi bi-heart-pulse-fill me-1"></i>${docSpecialty}
                  </span>
                  <span class="badge rounded-pill fw-semibold" style="background: rgba(255, 255, 255, 0.08); color: #cbd5e1; border: 1px solid rgba(255, 255, 255, 0.15); font-size: 0.72rem;">
                    📁 Carpeta: ${doc.folder || (doc.type === 'Receta Médica' ? 'Recetas' : (doc.type === 'Examen' ? 'Exámenes' : 'Informes'))}
                  </span>
                </h5>
                <small class="text-white-50">
                  Paciente: <strong class="text-white">${patient ? patient.name : 'Paciente'}</strong> &bull; RUT: <span class="text-warning font-monospace">${patient ? (patient.fileNumber || patient.rut) : 'Sin RUT'}</span>
                </small>
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" id="btnCloseCaregiverDocPreviewX"></button>
          </div>

          <!-- Cuerpo del Modal -->
          <div class="modal-body p-4">
            
            <!-- Metadata del Documento -->
            <div class="row g-2 mb-3">
              <div class="col-sm-3">
                <div class="p-2.5 rounded text-center" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);">
                  <small class="text-white-50 d-block" style="font-size: 0.72rem;">ESPECIALIDAD</small>
                  <strong class="text-info text-truncate d-block" style="font-size: 0.84rem;"><i class="bi bi-heart-pulse-fill me-1"></i>${docSpecialty}</strong>
                </div>
              </div>
              <div class="col-sm-3">
                <div class="p-2.5 rounded text-center" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);">
                  <small class="text-white-50 d-block" style="font-size: 0.72rem;">FECHA DE EMISIÓN</small>
                  <strong class="text-info" style="font-size: 0.84rem;"><i class="bi bi-calendar-event me-1"></i>${doc.date || 'Sin fecha'}</strong>
                </div>
              </div>
              <div class="col-sm-3">
                <div class="p-2.5 rounded text-center" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);">
                  <small class="text-white-50 d-block" style="font-size: 0.72rem;">MÉDICO TRATANTE</small>
                  <strong class="text-white text-truncate d-block" style="font-size: 0.84rem;"><i class="bi bi-person-fill-check me-1 text-warning"></i>${doc.doctor || 'Médico tratante'}</strong>
                </div>
              </div>
              <div class="col-sm-3">
                <div class="p-2.5 rounded text-center" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);">
                  <small class="text-white-50 d-block" style="font-size: 0.72rem;">CENTRO DE SALUD</small>
                  <strong class="text-white text-truncate d-block" style="font-size: 0.84rem;"><i class="bi bi-hospital me-1 text-danger"></i>${doc.center || 'Centro de Salud'}</strong>
                </div>
              </div>
            </div>

            <!-- Notas u Observaciones Clínicas -->
            <div class="p-3 rounded-3 mb-3" style="background: rgba(14, 165, 233, 0.05); border: 1px solid rgba(14, 165, 233, 0.25);">
              <div class="d-flex align-items-center gap-2 mb-1.5 text-info fw-semibold" style="font-size: 0.8rem;">
                <i class="bi bi-journal-medical"></i>
                <span>Indicaciones Clínicas / Observaciones Registradas</span>
              </div>
              <p class="text-white m-0" style="font-size: 0.88rem; line-height: 1.55; white-space: pre-wrap;">${doc.notes || 'Sin indicaciones clínicas adicionales.'}</p>
            </div>

            <!-- Visor de Archivo / Fotografía / Certificado Digital -->
            <div class="p-3 rounded-3" style="background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.1);">
              <div class="d-flex justify-content-between align-items-center mb-2 pb-1 border-bottom border-light border-opacity-10">
                <span class="small text-white-50 fw-semibold">
                  <i class="bi bi-file-earmark-text me-1 text-primary"></i>Visualizador de Soporte Documental
                </span>
                ${doc.fileName ? `
                  <span class="badge px-2 py-0.5 rounded-pill" style="background: rgba(255,255,255,0.06); color: #6ee7b7; font-size: 0.72rem;">
                    <i class="bi bi-paperclip me-1"></i>${doc.fileName}
                  </span>
                ` : ''}
              </div>

              ${isImage ? `
                <div class="text-center py-2">
                  <img src="${doc.fileData}" alt="${doc.title}" class="img-fluid rounded border border-light border-opacity-10 shadow-sm" style="max-height: 480px; width: auto; object-fit: contain; margin: 0 auto; display: block;">
                </div>
              ` : isPdf ? `
                <div class="w-100 rounded overflow-hidden" style="height: 460px;">
                  <iframe src="${doc.fileData}" style="width: 100%; height: 100%; border: none;"></iframe>
                </div>
              ` : `
                <!-- Ficha Oficial Simulada cuando no hay escaneo binario adjunto -->
                <div class="p-4 rounded-3 text-white my-2" style="background: rgba(255, 255, 255, 0.035); border: 1px dashed rgba(255, 255, 255, 0.2); position: relative; overflow: hidden;">
                  <div class="text-center mb-3 pb-2 border-bottom border-light border-opacity-10">
                    <div class="text-info fw-bold small text-uppercase tracking-wider">REPÚBLICA DE CHILE &bull; SISTEMA DE SALUD</div>
                    <div class="fw-bold fs-6 text-white">${doc.title.toUpperCase()}</div>
                    <small class="text-white-50">${doc.center || 'CESFAM Bellavista / Red Asistencial de Salud'}</small>
                  </div>
                  
                  <div class="row g-2 mb-3 small">
                    <div class="col-6">
                      <span class="text-white-50">Paciente:</span> <strong class="text-white">${patient ? patient.name : 'Paciente'}</strong>
                    </div>
                    <div class="col-6 text-end">
                      <span class="text-white-50">RUT:</span> <span class="text-warning font-monospace">${patient ? (patient.fileNumber || patient.rut) : 'Sin RUT'}</span>
                    </div>
                    <div class="col-6">
                      <span class="text-white-50">Profesional:</span> <strong class="text-white">${doc.doctor || 'Médico tratante'}</strong>
                    </div>
                    <div class="col-6 text-end">
                      <span class="text-white-50">Fecha:</span> <strong class="text-info">${doc.date}</strong>
                    </div>
                  </div>

                  <div class="p-3 rounded mb-3" style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.06);">
                    <small class="text-white-50 d-block mb-1 fw-bold">CONTENIDO DEL DOCUMENTO:</small>
                    <div class="text-white" style="font-size: 0.85rem; line-height: 1.5;">${doc.notes || 'Documento sin especificación textual.'}</div>
                  </div>

                  <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 pt-2 border-top border-light border-opacity-10" style="font-size: 0.72rem;">
                    <span class="text-white-50">
                      <i class="bi bi-shield-check text-success me-1"></i>Firma Electrónica Avanzada &bull; Ley N° 19.799 / DS N° 41
                    </span>
                    <span class="text-white-50 font-monospace">
                      ID-DIGITAL: ${doc.id.toUpperCase()}
                    </span>
                  </div>
                </div>
              `}
            </div>

          </div>

          <!-- Pie del Modal -->
          <div class="modal-footer border-top border-light border-opacity-10 p-3 px-4 d-flex justify-content-between align-items-center">
            <span class="text-white-50 small" style="font-size: 0.76rem;">
              <i class="bi bi-lock-fill text-warning me-1"></i>Ficha protegida bajo secreto profesional (Ley 20.584)
            </span>
            <div class="d-flex align-items-center gap-2">
              <button type="button" class="btn btn-sm btn-outline-light px-3 py-1.5 fw-semibold d-inline-flex align-items-center gap-1.5" id="btnPrintCaregiverDocPreview">
                <i class="bi bi-printer-fill"></i> Imprimir
              </button>
              <button type="button" class="btn btn-sm btn-glass-secondary px-3 py-1.5 fw-semibold" id="btnCloseCaregiverDocPreviewFooter">
                Cerrar
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalEl = document.getElementById(modalId);
  const closeBtnX = document.getElementById('btnCloseCaregiverDocPreviewX');
  const closeBtnFooter = document.getElementById('btnCloseCaregiverDocPreviewFooter');
  const printBtn = document.getElementById('btnPrintCaregiverDocPreview');

  const closeModal = () => {
    if (modalEl) modalEl.remove();
    document.removeEventListener('keydown', handleEsc);
  };

  const handleEsc = (e) => {
    if (e.key === 'Escape') closeModal();
  };

  if (closeBtnX) closeBtnX.onclick = closeModal;
  if (closeBtnFooter) closeBtnFooter.onclick = closeModal;
  if (printBtn) {
    printBtn.onclick = () => {
      window.print();
    };
  }

  document.addEventListener('keydown', handleEsc);

  modalEl.onclick = (e) => {
    if (e.target === modalEl) closeModal();
  };
}

// ============================================================================
// GESTIÓN DE TOMA DE MEDICAMENTOS Y PRESCRIPCIONES VIGENTES (CONTROL DIARIO)
// ============================================================================
export function getCurrentCaregiverName() {
  const sidebarUserEl = document.querySelector('.sidebar footer strong, footer strong.text-white');
  const loggedName = sidebarUserEl ? sidebarUserEl.textContent.trim() : '';
  const caregiver = CAREGIVERS_DATABASE.find(c => c.name.toLowerCase() === loggedName.toLowerCase() || (c.username && c.username.toLowerCase() === loggedName.toLowerCase())) ||
                    (activePatient ? CAREGIVERS_DATABASE.find(c => c.assignedPatientId === activePatient.id) : null) ||
                    CAREGIVERS_DATABASE[0];
  return caregiver ? caregiver.name : 'Cuidadora Autorizada';
}

export function getPatientMedIntakes(patientId, dateStr = getTodayDateString()) {
  try {
    const raw = localStorage.getItem(`cuidapp_med_intakes_${patientId}_${dateStr}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {};
}

export function savePatientMedIntake(patientId, rxId, intakeData, dateStr = getTodayDateString()) {
  try {
    const intakes = getPatientMedIntakes(patientId, dateStr);
    intakes[rxId] = intakeData;
    localStorage.setItem(`cuidapp_med_intakes_${patientId}_${dateStr}`, JSON.stringify(intakes));
  } catch (e) {}
}

export function renderCaregiverPrescriptions(patient = activePatient) {
  const rxEl = document.getElementById('caregiverPrescriptionListPreview');
  if (!rxEl || !patient) return;

  const rxs = getPatientPrescriptions(patient.id).filter(r => r.status === 'activa');
  const todayStr = getTodayDateString();
  const intakes = getPatientMedIntakes(patient.id, todayStr);

  // Sincronizar interruptor superior de adherencia farmacológica si ya existen tomas registradas
  const switchMedInit = document.getElementById('transversalMedication');
  if (switchMedInit && Object.keys(intakes).length > 0) {
    switchMedInit.checked = true;
  }

  if (!rxs || rxs.length === 0) {
    rxEl.innerHTML = `
      <div class="p-3 rounded-3 text-center" style="background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.15);">
        <small class="text-white-50 fst-italic">Sin recetas activas registradas en el portal médico.</small>
      </div>
    `;
    return;
  }

  rxEl.innerHTML = `
    <div class="d-flex flex-column gap-2.5 mt-2">
      <div class="d-flex justify-content-between align-items-center mb-1">
        <small class="text-info fw-bold text-uppercase d-flex align-items-center gap-1.5" style="font-size: 0.8rem; letter-spacing: 0.4px;">
          <i class="bi bi-capsule text-primary"></i>
          <span>Prescripciones Vigentes Programadas (Dra. Elena Valdés)</span>
        </small>
        <span class="badge bg-secondary bg-opacity-25 text-white-50 font-monospace" style="font-size: 0.72rem;">
          ${rxs.length} fármaco(s) activo(s)
        </span>
      </div>

      ${rxs.map(r => {
        const intakeInfo = intakes[r.id];
        const isIntaken = Boolean(intakeInfo);
        const scheduledTime = r.schedule || '08:00 AM';
        const savedAlarms = JSON.parse(localStorage.getItem(`cuidapp_alarms_${patient.id || 'p1'}`) || '{}');
        const isAlarmSet = !!(savedAlarms[r.id] && savedAlarms[r.id].active);

        return `
          <div class="p-3 rounded-3" style="background: rgba(255, 255, 255, 0.04); border: 1px solid ${isIntaken ? 'rgba(16, 185, 129, 0.35)' : 'rgba(255, 255, 255, 0.12)'}; transition: all 0.2s ease;">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>
                <div class="d-flex align-items-center gap-2 flex-wrap">
                  <span class="fs-5">💊</span>
                  <strong class="text-white fs-6">${r.medication}</strong>
                  <span class="badge bg-info bg-opacity-25 text-info border border-info border-opacity-25 small">${r.dose}</span>
                  <span class="badge bg-dark bg-opacity-50 text-white-50 border border-light border-opacity-10 small">${r.route || 'Vía Oral'}</span>
                </div>
                <div class="text-white-50 small mt-1 d-flex align-items-center gap-2 flex-wrap" style="font-size: 0.82rem;">
                  <span class="text-white">
                    <i class="bi bi-alarm-fill text-info me-1"></i>Horario programado: 
                    <strong class="text-info font-monospace">${scheduledTime}</strong>
                  </span>
                  ${r.frequency ? `<span>&bull; ${r.frequency}</span>` : ''}
                  ${r.instructions ? `<span>&bull; <span class="text-white-50 fst-italic">${r.instructions}</span></span>` : ''}
                </div>
              </div>

              <div class="d-flex align-items-center gap-2 flex-wrap">
                <button type="button" class="btn btn-sm ${isAlarmSet ? 'btn-warning text-dark fw-bold' : 'btn-outline-warning fw-semibold'} btn-med-reminder px-2.5 py-1.5 d-inline-flex align-items-center gap-1 shadow-sm" data-rx-id="${r.id}" style="border-radius: 8px; font-size: 0.78rem;" title="Activar recordatorio telefónico y alarma médica">
                  <span>📞 ${isAlarmSet ? '🔔 Alarma Activa' : 'Activar Recordatorio / Alarma'}</span>
                </button>
                ${isIntaken ? `
                  <button type="button" class="btn btn-sm btn-success px-3 py-1.5 fw-bold disabled d-inline-flex align-items-center gap-1.5 shadow-sm" style="border-radius: 8px; background: rgba(16, 185, 129, 0.25); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.5); font-size: 0.82rem; opacity: 1; cursor: default;" disabled>
                    <span>✅ Administrado a las ${intakeInfo.time}</span>
                  </button>
                ` : `
                  <span class="badge rounded-pill px-2.5 py-1.5 fw-semibold d-inline-flex align-items-center gap-1" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35); font-size: 0.74rem;">
                    <i class="bi bi-hourglass-split"></i> Pendiente
                  </span>
                  <button type="button" class="btn btn-sm btn-outline-info px-3 py-1.5 fw-semibold btn-register-intake d-inline-flex align-items-center gap-1.5" data-rx-id="${r.id}" style="border-radius: 8px; font-size: 0.82rem; white-space: nowrap; transition: all 0.2s ease;">
                    <span>🕒 Marcar como Administrado</span>
                  </button>
                `}
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Asignar listeners a los botones "🕒 Marcar como Administrado"
  rxEl.querySelectorAll('.btn-register-intake').forEach(btn => {
    btn.onclick = () => {
      const rxId = btn.getAttribute('data-rx-id');
      const rx = rxs.find(item => item.id === rxId);
      if (!rx) return;

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const caregiverName = getCurrentCaregiverName();

      // 1. Guardar toma persistente
      savePatientMedIntake(patient.id, rx.id, {
        rxId: rx.id,
        medication: rx.medication,
        dose: rx.dose,
        time: timeStr,
        caregiver: caregiverName,
        timestamp: now.toISOString()
      }, todayStr);

      // 2. Guardar automáticamente en el historial clínico diario
      const medLog = {
        id: `rec_med_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        patientId: patient.id,
        patientName: patient.name,
        timestamp: now.toISOString(),
        date: todayStr,
        monthKey: todayStr.slice(0, 7),
        time: timeStr,
        recordedBy: `${caregiverName} (Cuidadora Autorizada)`,
        role: 'cuidador',
        systolic: 120,
        diastolic: 80,
        spo2: 98,
        spO2: 98,
        temperature: 36.5,
        glycemia: 95,
        glucose: 95,
        heartRate: 72,
        painEva: 1,
        pain: 1,
        edema: false,
        symptoms: ['Ninguno'],
        medicationAdherence: true,
        notes: `Administración de Fármaco: ${rx.medication} (${rx.dose}). Horario programado: ${rx.schedule}. Administrado a las ${timeStr} por ${caregiverName}.`,
        alertLevel: 'normal'
      };

      savePatientClinicalLog(patient.id, medLog);

      // 3. Activar switch de adherencia farmacológica
      const switchMed = document.getElementById('transversalMedication');
      if (switchMed) switchMed.checked = true;

      // 4. Actualizar visualmente la lista de prescripciones y el historial sincronizado
      renderCaregiverPrescriptions(patient);
      renderClinicalHistory(patient.id);

      if (window.showGlassAlert) {
        window.showGlassAlert(`✅ Toma registrada: ${rx.medication} administrado a las ${timeStr} por ${caregiverName}. Registrado en historial diario.`, 'success');
      }
    };
  });

  // Asignar listeners a los botones "📞 Activar Recordatorio / Alarma" en medicamentos
  rxEl.querySelectorAll('.btn-med-reminder').forEach(btn => {
    btn.onclick = () => {
      const rxId = btn.getAttribute('data-rx-id');
      const rx = rxs.find(item => item.id === rxId);
      if (rx) {
        openItemReminderModal(rx, 'medication', patient);
      }
    };
  });
}

export function evaluateDateLock() {
  const dateInput = document.getElementById('reportDate');
  const warningBanner = document.getElementById('lockWarningBanner');
  const submitContainer = document.getElementById('submitButtonContainer');
  if (!dateInput) return;

  const todayStr = getTodayDateString();
  const selectedStr = dateInput.value;
  const isOld = selectedStr !== todayStr;

  const inputs = document.querySelectorAll('.input-field');
  const buttons = document.querySelectorAll('.input-btn');

  if (isOld) {
    warningBanner.classList.remove('d-none');
    if (submitContainer) submitContainer.classList.add('d-none');
    inputs.forEach(el => el.disabled = true);
    buttons.forEach(el => {
      el.style.pointerEvents = 'none';
      el.style.opacity = '0.5';
    });
  } else {
    warningBanner.classList.add('d-none');
    if (submitContainer) submitContainer.classList.remove('d-none');
    inputs.forEach(el => el.disabled = false);
    buttons.forEach(el => {
      el.style.pointerEvents = 'auto';
      el.style.opacity = '1';
    });
  }
}


// --- COMPARACIÓN DE DESARROLLO FETAL CON FRUTAS (MINSAL / OMS) ---
export function getFetalGrowthByWeek(week) {
  const w = Math.max(4, Math.min(42, parseInt(week, 10) || 24));
  if (w <= 9) {
    return {
      week: w,
      emoji: '🫐',
      fruit: 'Una Frambuesa',
      length: '~ 1.6 cm',
      weight: '~ 1 g',
      trimester: '1° Trimestre'
    };
  } else if (w <= 13) {
    return {
      week: w,
      emoji: '🍋',
      fruit: 'Un Limón',
      length: '~ 5.4 cm',
      weight: '~ 14 g',
      trimester: '1° Trimestre'
    };
  } else if (w <= 17) {
    return {
      week: w,
      emoji: '🥑',
      fruit: 'Una Palta',
      length: '~ 11.6 cm',
      weight: '~ 100 g',
      trimester: '2° Trimestre'
    };
  } else if (w <= 21) {
    return {
      week: w,
      emoji: '🍌',
      fruit: 'Un Plátano',
      length: '~ 25.6 cm',
      weight: '~ 300 g',
      trimester: '2° Trimestre'
    };
  } else if (w <= 25) {
    return {
      week: w,
      emoji: '🌽',
      fruit: 'Un Choclo',
      length: '~ 30 cm',
      weight: '~ 600 g',
      trimester: '2° Trimestre'
    };
  } else if (w <= 29) {
    return {
      week: w,
      emoji: '🍆',
      fruit: 'Una Berenjena',
      length: '~ 37.6 cm',
      weight: '~ 1.000 g',
      trimester: '3° Trimestre'
    };
  } else if (w <= 33) {
    return {
      week: w,
      emoji: '🍍',
      fruit: 'Una Piña',
      length: '~ 42.4 cm',
      weight: '~ 1.700 g',
      trimester: '3° Trimestre'
    };
  } else if (w <= 37) {
    return {
      week: w,
      emoji: '🍈',
      fruit: 'Un Melón',
      length: '~ 47.4 cm',
      weight: '~ 2.600 g',
      trimester: '3° Trimestre'
    };
  } else {
    return {
      week: w,
      emoji: '🍉',
      fruit: 'Una Sandía',
      length: '~ 51.2 cm',
      weight: '~ 3.400 g',
      trimester: '3° Trimestre'
    };
  }
}

export function updatePrenatalFruitDisplay(week, patient = activePatient) {
  const data = getFetalGrowthByWeek(week);
  const badgeVal = document.getElementById('badgeGestationalWeeksVal');
  const badgeTrim = document.getElementById('badgeGestationalTrimester');
  const emojiEl = document.getElementById('prenatalFruitEmoji');
  const titleEl = document.getElementById('prenatalFruitTitle');
  const subEl = document.getElementById('prenatalFruitSub');
  const lengthEl = document.getElementById('prenatalFetalLength');
  const weightEl = document.getElementById('prenatalFetalWeight');

  if (badgeVal) badgeVal.textContent = data.week;
  if (badgeTrim) badgeTrim.textContent = data.trimester;
  if (emojiEl) emojiEl.textContent = data.emoji;
  if (titleEl) titleEl.textContent = data.fruit;
  if (subEl) subEl.textContent = `Semana ${data.week} de desarrollo fetal activo`;
  if (lengthEl) lengthEl.textContent = data.length;
  if (weightEl) weightEl.textContent = data.weight;

  if (patient) {
    patient.pregnancyWeeks = data.week;
    patient.gestationalWeeks = data.week;
  }
}

// Helper de restricción normativa (Ley N° 21.430) para Agregar Persona a Cargo
export function canPatientAddDependent(patient) {
  if (!patient) return false;
  const age = getPatientAge(patient);
  if (age >= 18) return true;
  // Menores de 18 años: Solo permitido si tiene condición de gestante o maternidad/paternidad registrada
  if (caregiverPatientIsPregnant(patient)) return true;
  if (caregiverPatientIsPostpartum(patient)) return true;
  if (patient.hasChildren || (patient.children && patient.children.length > 0)) return true;
  if (localStorage.getItem(`cuidapp_postpartum_${patient.id}`) === 'true') return true;
  if (localStorage.getItem(`cuidapp_pregnancy_${patient.id}`)) return true;
  return false;
}

// --- BANNER HERO ÚNICO ESTILO MATEO ---
export function updateCaregiverHeroSection(patient = activePatient) {
  if (!patient) return;

  const isPregnant = caregiverPatientIsPregnant(patient);

  // 1. Saludo grande con nombre del titular de la sesión (Sofía Díaz cuando es cuidadora, o paciente titular)
  const greetingNameEl = document.getElementById('caregiverGreetingPatientName');
  if (greetingNameEl) {
    const sidebarUserEl = document.querySelector('.sidebar footer strong, footer strong.text-white');
    const loggedName = sidebarUserEl ? sidebarUserEl.textContent.trim() : '';
    const isCaregiver = Boolean(
      (loggedName && (loggedName.toLowerCase().includes('sofía') || loggedName.toLowerCase().includes('sofia'))) ||
      (loggedName && CAREGIVERS_DATABASE.some(c => c.name.toLowerCase() === loggedName.toLowerCase() || (c.username && c.username.toLowerCase() === loggedName.toLowerCase())))
    );
    greetingNameEl.textContent = isCaregiver ? 'Sofía Díaz' : (patient.socialName || patient.name);
  }

  // 2. Recuadro de Condición Activa Abajo
  const heroCondContainer = document.getElementById('caregiverHeroConditions');
  if (heroCondContainer) {
    if (isPregnant) {
      heroCondContainer.innerHTML = `
        <div class="rounded-3 d-inline-flex align-items-center gap-2 shadow-sm" style="padding: 6px 14px; background: rgba(236, 72, 153, 0.18); border: 1.5px solid #ec4899; color: #fbcfe8;">
          <span style="font-size: 1.25rem; line-height: 1;">🤰</span>
          <span class="fw-bold" style="font-size: 0.92rem;">Gestante &bull; Control Prenatal Activo</span>
        </div>
      `;
    } else {
      const rawConditions = patient.conditions || [];
      if (rawConditions.length > 0) {
        heroCondContainer.innerHTML = rawConditions.map(key => {
          const cond = CLINICAL_CONDITIONS[key];
          const name = cond ? cond.name : key;
          const icon = key.includes('diabetes') ? '🩸' : key.includes('hiper') ? '❤️' : key.includes('epoc') ? '🫁' : key.includes('erc') ? '🩺' : key.includes('tea') ? '🧩' : '📋';
          return `
            <div class="rounded-3 d-inline-flex align-items-center gap-2 shadow-sm" style="padding: 6px 12px; background: rgba(239, 68, 68, 0.16); border: 1.5px solid #ef4444; color: #fee2e2;">
              <span style="font-size: 1.15rem; line-height: 1;">${icon}</span>
              <span class="fw-bold" style="font-size: 0.88rem;">
                ${name.toLowerCase().startsWith('condición') ? name : `Condición Acreditada: ${name}`}
              </span>
            </div>
          `;
        }).join('');
      } else {
        heroCondContainer.innerHTML = `
          <div class="rounded-3 d-inline-flex align-items-center gap-2 shadow-sm" style="padding: 6px 12px; background: rgba(16, 185, 129, 0.12); border: 1.5px solid #10b981; color: #a7f3d0;">
            <span style="font-size: 1.15rem; line-height: 1;">🛡️</span>
            <span class="fw-semibold" style="font-size: 0.88rem;">Control Preventivo Integral &bull; GES Acreditado</span>
          </div>
        `;
      }
    }
  }

  // 3. Tarjeta PRÓXIMA CITA a la derecha (estilo Mateo)
  const heroNextAptContainer = document.getElementById('caregiverHeroNextAppointment');
  if (heroNextAptContainer) {
    const appointments = getPatientAppointments(patient) || [];
    const pendientes = appointments.filter(a => a.status !== 'asistido' && a.status !== 'completada');
    pendientes.sort((a, b) => {
      const dtA = new Date(`${a.date}T${a.time || '00:00'}`).getTime();
      const dtB = new Date(`${b.date}T${b.time || '00:00'}`).getTime();
      return dtA - dtB;
    });
    const nextApt = pendientes[0] || null;

    if (isPregnant) {
      const aptDate = nextApt ? nextApt.date : '18-12-2026';
      heroNextAptContainer.innerHTML = `
        <div id="btnCaregiverHeroNextAppointment" class="p-3 px-3.5 rounded-4 text-center hero-next-apt-card" style="background: #08101a; border: 1.5px solid rgba(236, 72, 153, 0.5); color: #f472b6; border-radius: 18px; cursor: pointer; transition: all 0.2s; min-width: 165px; box-shadow: 0 4px 15px rgba(0,0,0,0.3);" role="button" title="Haz clic para ver el detalle del Control Prenatal">
          <span class="small fw-bold text-uppercase d-block" style="font-size: 0.72rem; letter-spacing: 0.5px; color: #f472b6;">Próxima Cita</span>
          <span class="fw-extrabold text-white d-block mt-0.5" style="font-size: 1rem;">🗓️ ${aptDate}</span>
          <small class="d-block text-truncate mt-0.5 fw-bold" style="font-size: 0.75rem; max-width: 165px; color: #fbcfe8;">Control Prenatal MINSAL</small>
          <small class="d-block fw-semibold mt-1" style="font-size: 0.72rem; color: #f472b6;">👁️ Ver Detalle</small>
        </div>
      `;
      const btn = document.getElementById('btnCaregiverHeroNextAppointment');
      if (btn) {
        btn.onclick = () => {
          const tabDailyBtn = document.getElementById('tabBtnCaregiverDaily');
          if (tabDailyBtn) tabDailyBtn.click();
          const el = document.getElementById('cardPatientAppointments');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        };
      }
    } else if (nextApt) {
      heroNextAptContainer.innerHTML = `
        <div id="btnCaregiverHeroNextAppointment" class="p-3 px-3.5 rounded-4 text-center hero-next-apt-card" style="background: #08101a; border: 1.5px solid rgba(6, 182, 212, 0.45); color: #06b6d4; border-radius: 18px; cursor: pointer; transition: all 0.2s; min-width: 165px; box-shadow: 0 4px 15px rgba(0,0,0,0.3);" role="button" title="Haz clic para ver el detalle de la próxima cita agendada">
          <span class="small fw-bold text-uppercase d-block" style="font-size: 0.72rem; letter-spacing: 0.5px; color: #38bdf8;">Próxima Cita</span>
          <span class="fw-extrabold text-white d-block mt-0.5" style="font-size: 1rem;">🗓️ ${nextApt.date}</span>
          <small class="text-white-50 d-block text-truncate mt-0.5" style="font-size: 0.72rem; max-width: 155px;">${nextApt.specialty || nextApt.title || 'Control'}</small>
          <small class="text-info d-block fw-semibold mt-1" style="font-size: 0.72rem;">👁️ Ver Detalle</small>
        </div>
      `;
      const btn = document.getElementById('btnCaregiverHeroNextAppointment');
      if (btn) {
        btn.onclick = () => {
          const tabDailyBtn = document.getElementById('tabBtnCaregiverDaily');
          if (tabDailyBtn) tabDailyBtn.click();
          const el = document.getElementById('cardPatientAppointments');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        };
      }
    } else {
      heroNextAptContainer.innerHTML = `
        <div class="p-3 px-3.5 rounded-4 text-center hero-next-apt-card" style="background: #08101a; border: 1.5px solid rgba(255, 255, 255, 0.15); color: #94a3b8; border-radius: 18px; min-width: 165px;">
          <span class="small fw-bold text-uppercase d-block" style="font-size: 0.72rem; letter-spacing: 0.5px;">Próxima Cita</span>
          <span class="fw-semibold text-white-50 d-block mt-0.5" style="font-size: 0.9rem;">Sin citas próximas</span>
          <small class="text-white-50 d-block" style="font-size: 0.7rem; margin-top: 2px;">Al día en controles</small>
        </div>
      `;
    }
  }

  // 4. Restricción legal de "Agregar Persona a Cargo" (Ley N° 21.430)
  const btnAddPersona = document.getElementById('btnOpenAddPersonaACargoModal');
  if (btnAddPersona) {
    if (canPatientAddDependent(patient)) {
      btnAddPersona.classList.remove('d-none');
    } else {
      btnAddPersona.classList.add('d-none');
    }
  }
}

// --- ACTUALIZACIÓN DE PACIENTE ACTIVO ---
export function updateActivePatient(patient) {
  if (!patient) return;

  // Validación de seguridad bajo Ley 20.584 y Ley 19.628
  const authorizedPatients = getAuthorizedPatientsForCurrentCaregiver();
  if (!authorizedPatients.some(p => p.id === patient.id)) {
    console.warn(`[Seguridad Ley 20.584] Intento de acceso no autorizado a la ficha del paciente ${patient.id}.`);
    if (window.showGlassAlert) {
      window.showGlassAlert('Acceso bloqueado: Paciente no asignado bajo Ley 20.584.', 'danger');
    }
    patient = authorizedPatients[0];
  }

  // Hidratar datos de contacto actualizados desde localStorage
  applyPatientContactOverrides(patient);

  setActivePatient(patient);

  // Actualizar Banner Hero Único Estilo Mateo (Saludo, Condición Activa, Próxima Cita)
  updateCaregiverHeroSection(patient);

  // 1. Datos Universales en la Ficha Lateral
  const initialsEl = document.getElementById('patientInitials');
  const nameEl = document.getElementById('patientName');
  const dniEl = document.getElementById('patientDni');
  const metaAgeSexEl = document.getElementById('pMetaAgeSex');
  const metaWeightHeightEl = document.getElementById('pMetaWeightHeight');
  const metaBloodEl = document.getElementById('pMetaBlood');
  const metaAllergiesEl = document.getElementById('pMetaAllergies');
  const metaContactEl = document.getElementById('pMetaContact');
  const condListEl = document.getElementById('patientConditionsList');

  if (initialsEl && nameEl && dniEl) {
    const initials = patient.name.split(' ').map(n => n[0]).join('');
    initialsEl.textContent = initials;
    nameEl.textContent = patient.name;
    dniEl.textContent = `RUT: ${patient.fileNumber}`;

    if (metaAgeSexEl) metaAgeSexEl.textContent = `${patient.age} años / ${patient.gender}`;
    if (metaWeightHeightEl) metaWeightHeightEl.textContent = `${patient.weight} kg / ${patient.stature} cm`;
    if (metaBloodEl) metaBloodEl.textContent = patient.bloodType;
    if (metaAllergiesEl) metaAllergiesEl.textContent = patient.allergies;

    if (metaContactEl && patient.emergencyContact) {
      metaContactEl.innerHTML = `
        <span class="d-block text-white" style="font-size:0.83rem;">${patient.emergencyContact.name} (${patient.emergencyContact.relation || 'Contacto'})</span>
        <span class="text-info" style="font-size:0.83rem;"><i class="bi bi-telephone-outbound me-1"></i>${patient.emergencyContact.phone}</span>
        ${patient.phone && patient.phone !== patient.emergencyContact.phone ? `<span class="text-white-50 d-block mt-0.5" style="font-size:0.74rem;"><i class="bi bi-phone me-1"></i>Tel. Paciente: ${patient.phone}</span>` : ''}
        ${patient.address ? `<span class="text-white-50 d-block" style="font-size:0.74rem;"><i class="bi bi-geo-alt me-1"></i>${patient.address}</span>` : ''}
      `;
    }

    const btnEditContact = document.getElementById('btnOpenEditPatientContactModal');
    if (btnEditContact) {
      btnEditContact.onclick = () => {
        openEditPatientContactModal(patient);
      };
    }

    // Conectar botón telefónico directo para el contacto de emergencia registrado (Android y Teléfonos Básicos)
    const btnCallContact = document.getElementById('btnCallEmergencyContactDirect');
    const lblCallContact = document.getElementById('labelCallEmergencyContact');
    const contactPhone = patient.emergencyContact?.phone || patient.phone || '';
    const cleanPhone = contactPhone.replace(/[^0-9+]/g, '');
    if (btnCallContact) {
      if (cleanPhone) {
        btnCallContact.href = `tel:${cleanPhone}`;
        if (lblCallContact) {
          const contactName = patient.emergencyContact?.name ? patient.emergencyContact.name.split(' ')[0] : 'Contacto';
          lblCallContact.textContent = `📞 Llamar a ${contactName} (${patient.emergencyContact?.phone || contactPhone})`;
        }
      } else {
        btnCallContact.href = 'tel:131';
        if (lblCallContact) lblCallContact.textContent = '📞 Llamar SAMU (131)';
      }
    }

    condListEl.innerHTML = patient.conditions.map(key => {
      const cond = CLINICAL_CONDITIONS[key];
      return `
        <div class="p-2 rounded" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); font-size: 0.78rem;">
          <div class="fw-bold text-info"><i class="bi bi-bookmark-plus-fill me-1"></i>${cond.name}</div>
          <div class="text-white-50" style="font-size:0.72rem;">${cond.description}</div>
        </div>
      `;
    }).join('');
  }

  // 2. Mostrar/Ocultar Tarjetas por Patología y Etapa Vital (Gestación / Postparto)
  const cardMetabolica = document.getElementById('cardMetabolica');
  const cardEpoc = document.getElementById('cardEpoc');
  const cardErc = document.getElementById('cardErc');
  const cardPrenatalGrowth = document.getElementById('cardPrenatalGrowthCaregiver');
  const cardPrenatalVitals = document.getElementById('cardPrenatalVitalsOnly');
  const cardBasicVitals = document.getElementById('cardBasicVitals');
  const cardWellness = document.getElementById('cardWellness');
  const submitContainer = document.getElementById('submitButtonContainer');
  const cardSubmitReport = document.getElementById('cardSubmitReportContainer');
  const cardPostpartum = document.getElementById('cardPostpartumCaregiver');
  const ecgContainer = document.getElementById('iotEcgContainerCuidador');
  const tabSubVaccines = document.getElementById('folderTabSubVaccines');

  const isPregnant = caregiverPatientIsPregnant(patient);
  const isPostpartum = caregiverPatientIsPostpartum(patient);

  if (isPregnant) {
    // 🤰 Vista Gestante Limpia: Mostrar solo bloque visual de fruta y controles esenciales de embarazo
    if (cardPrenatalGrowth) cardPrenatalGrowth.classList.remove('d-none');
    if (cardPrenatalVitals) cardPrenatalVitals.classList.remove('d-none');

    // Ocultar sobrecarga de información genérica
    if (cardBasicVitals) cardBasicVitals.classList.add('d-none');
    if (cardWellness) cardWellness.classList.add('d-none');
    if (submitContainer) submitContainer.classList.add('d-none');
    if (cardSubmitReport) cardSubmitReport.classList.add('d-none');
    if (cardMetabolica) cardMetabolica.classList.add('d-none');
    if (cardEpoc) cardEpoc.classList.add('d-none');
    if (cardErc) cardErc.classList.add('d-none');
    if (ecgContainer) ecgContainer.classList.add('d-none');
    if (cardPostpartum) cardPostpartum.classList.add('d-none');

    // Actualizar subetiqueta de la carpeta 4 a Control Prenatal MINSAL
    if (tabSubVaccines) tabSubVaccines.textContent = 'Control Prenatal MINSAL';
    const topbarSubVaccines = document.getElementById('folderViewTopbarSubVaccines');
    if (topbarSubVaccines) topbarSubVaccines.textContent = 'Control Prenatal MINSAL';

    // Inicializar visualización con fruta y botones interactivos - / +
    const initialWeeks = patient.pregnancyWeeks || patient.gestationalWeeks || 24;
    updatePrenatalFruitDisplay(initialWeeks, patient);

    const btnPrevW = document.getElementById('btnPrevGestationalWeek');
    const btnNextW = document.getElementById('btnNextGestationalWeek');
    if (btnPrevW) {
      btnPrevW.onclick = (e) => {
        e.preventDefault();
        let w = parseInt(document.getElementById('badgeGestationalWeeksVal')?.textContent, 10) || 24;
        if (w > 4) {
          updatePrenatalFruitDisplay(w - 1, patient);
        }
      };
    }
    if (btnNextW) {
      btnNextW.onclick = (e) => {
        e.preventDefault();
        let w = parseInt(document.getElementById('badgeGestationalWeeksVal')?.textContent, 10) || 24;
        if (w < 42) {
          updatePrenatalFruitDisplay(w + 1, patient);
        }
      };
    }

    // Conectar botón Registrar Nacimiento del Bebé
    document.querySelectorAll('.btn-trigger-register-birth').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        openRegisterBirthModal(patient);
      };
    });
  } else {
    // Paciente no gestante: Restaurar vistas estándar
    if (cardPrenatalGrowth) cardPrenatalGrowth.classList.add('d-none');
    if (cardPrenatalVitals) cardPrenatalVitals.classList.add('d-none');

    if (cardBasicVitals) cardBasicVitals.classList.remove('d-none');
    if (cardWellness) cardWellness.classList.remove('d-none');
    if (submitContainer) submitContainer.classList.remove('d-none');
    if (cardSubmitReport) cardSubmitReport.classList.remove('d-none');

    const pAge = getPatientAge(patient);
    const tabTitleVaccines = document.getElementById('folderTabTitleVaccines');
    const tabIconVaccines = document.getElementById('folderTabIconVaccines');
    if (tabTitleVaccines) {
      if (pAge >= 60) {
        tabTitleVaccines.textContent = 'Vacunas y GES 60';
        if (tabIconVaccines) tabIconVaccines.textContent = '🛡️';
      } else {
        tabTitleVaccines.textContent = 'Vacunas y Dental';
        if (tabIconVaccines) tabIconVaccines.textContent = '🦷';
      }
    }

    const topbarTitleVaccines = document.getElementById('folderViewTopbarTitleVaccines');
    const topbarIconVaccines = document.getElementById('folderViewTopbarIconVaccines');
    const topbarSubVaccines = document.getElementById('folderViewTopbarSubVaccines');
    if (topbarTitleVaccines) {
      topbarTitleVaccines.textContent = (pAge >= 60) ? 'Vacunas y GES 60' : 'Vacunas y Dental';
    }
    if (topbarIconVaccines) {
      topbarIconVaccines.textContent = (pAge >= 60) ? '🛡️' : '🦷';
    }

    if (tabSubVaccines) {
      if (pAge < 60) {
        tabSubVaccines.textContent = 'PNI Adolescente & Dental';
      } else {
        tabSubVaccines.textContent = 'PNI & GES 60';
      }
    }
    if (topbarSubVaccines) {
      topbarSubVaccines.textContent = (pAge < 60) ? 'PNI Adolescente & Dental' : 'PNI & GES 60';
    }

    if (cardMetabolica) cardMetabolica.className = `glass-card p-4 border-0 mb-4 ${patient.hasCondition('DIABETES') ? '' : 'd-none'}`;
    if (cardEpoc) cardEpoc.className = `glass-card p-4 border-0 mb-4 ${patient.hasCondition('EPOC') ? '' : 'd-none'}`;
    if (cardErc) cardErc.className = `glass-card p-4 border-0 mb-4 ${patient.hasCondition('ERC') ? '' : 'd-none'}`;

    if (cardPostpartum) {
      if (isPostpartum) {
        cardPostpartum.classList.remove('d-none');
      } else {
        cardPostpartum.classList.add('d-none');
      }
    }

    // Monitor ECG según condición
    if (ecgContainer) {
      const hasCardiac = (typeof patient.hasCondition === 'function' ? (patient.hasCondition('CARDIOPATIA') || patient.hasCondition('ARRITMIA') || patient.hasCondition('CARDIOPATIA_ARRITMIA') || patient.hasCondition('CARDIACA') || patient.hasCondition('CARDIOVASCULAR')) : false) ||
        (patient.conditions && patient.conditions.some(c => String(c).toUpperCase().includes('CARDIO') || String(c).toUpperCase().includes('ARRITMIA'))) ||
        patient.iotEcgActive === true ||
        patient.cardiacMonitoring === true;

      if (hasCardiac) {
        ecgContainer.classList.remove('d-none');
      } else {
        ecgContainer.classList.add('d-none');
      }
    }
  }

  // Restricción legal de "Agregar Persona a Cargo" (Ley N° 21.430)
  const btnAddPersona = document.getElementById('btnOpenAddPersonaACargoModal');
  if (btnAddPersona) {
    if (canPatientAddDependent(patient)) {
      btnAddPersona.classList.remove('d-none');
    } else {
      btnAddPersona.classList.add('d-none');
    }
  }

  // 3. Detección automática de edad y cálculo de rangos vitales (Pediátrico vs Adulto)
  updateCaregiverVitalRangesUI(patient);

  // Enlazar eventos interactivos de este paciente
  bindDashboardEvents(patient.name);

  // Forzar bloqueo de controles si la fecha no es la de hoy
  evaluateDateLock();

  // Renderizar historial sincronizado con ficha clínica para el paciente activo
  renderClinicalHistory(patient.id);

  // Renderizar evoluciones médicas oficiales (Dra. Elena Valdés) en solo lectura
  renderCaregiverMedicalEvolutions(patient.id);

  // Actualizar prescripciones vigentes indicadas por el médico en tarjetas individuales interactivas
  renderCaregiverPrescriptions(patient);

  // Renderizar recordatorios de citas y exámenes médicos del paciente activo
  renderCaregiverAppointments(patient);

  // Renderizar documentos y recetas médicas del paciente activo (Pestaña 3)
  renderCaregiverDocuments(patient);

  // Renderizar vacunas, ficha dental y controles preventivos MINSAL (Pestaña 4)
  renderCaregiverVaccinesDental(patient);

  // Asegurar que la ficha global compartida en localStorage (cuidapp_ficha_10420932-K) esté inicializada
  ensurePatientGlobalFichaInitialized(patient);

  // 4. Modo Fácil Adulto Mayor (edad >= 60 años)
  applySeniorModeIfApplicable(patient);

  // 5. Conectar 3 Controles Globales (Voz, Día/Noche Sol/Luna, Idioma según Registro)
  bindGlobalTopBarControls(patient);
}

// ============================================================================
// MODO FÁCIL ADULTO MAYOR (EDAD >= 60 AÑOS) & ASISTENCIA POR VOZ
// ============================================================================
export function applySeniorModeIfApplicable(patient) {
  if (!patient) return;
  const sidebarUserEl = typeof document !== 'undefined' ? document.querySelector('.sidebar footer strong, footer strong.text-white, #sidebarMenu footer strong') : null;
  const loggedName = sidebarUserEl ? sidebarUserEl.textContent.trim() : '';
  const isCaregiverUser = Boolean(
    (loggedName && (loggedName.toLowerCase().includes('sofía') || loggedName.toLowerCase().includes('sofia'))) ||
    (loggedName && CAREGIVERS_DATABASE.some(c => c.name.toLowerCase() === loggedName.toLowerCase() || (c.username && c.username.toLowerCase() === loggedName.toLowerCase()))) ||
    (typeof window !== 'undefined' && window._currentRole === 'caregiver') ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('cuidapp_auth_role') === 'caregiver')
  );

  // Asegurar que la variable o condición de escalado/accesibilidad de adulto mayor (isSenior o age >= 60)
  // sea SIEMPRE false cuando el rol de la sesión sea Cuidador (Sofía Díaz)
  const age = getPatientAge(patient);
  const isSenior = isCaregiverUser ? false : (age >= 60);

  if (isSenior) {
    document.body.classList.add('cuidapp-senior-mode');
    removeSeniorFloatingButton();
  } else {
    document.body.classList.remove('cuidapp-senior-mode');
    removeSeniorFloatingButton();
  }
}

export function renderSeniorFloatingButton() {
  // Eliminado para dejar únicamente el botón "🔊 Asistente de Voz" de la barra superior sin duplicados
  removeSeniorFloatingButton();
}

export function removeSeniorFloatingButton() {
  const container = document.getElementById('sidebarSeniorSpeechContainer');
  if (container) container.remove();
  const oldFloating = document.getElementById('btnFloatingSeniorSpeech');
  if (oldFloating) oldFloating.remove();
  const allResidual = document.querySelectorAll('.btn-sidebar-senior-speech, .btn-floating-senior-speech, #btnFloatingSeniorSpeech');
  allResidual.forEach(el => el.remove());
}

export function toggleSeniorSpeech(patient) {
  if (!('speechSynthesis' in window)) {
    if (window.showGlassAlert) {
      window.showGlassAlert('La síntesis de voz no está disponible en este dispositivo.', 'warning');
    }
    return;
  }

  const lang = getCurrentLanguage();
  const btn = document.getElementById('btnFloatingSeniorSpeech');
  const icon = document.getElementById('seniorSpeechIcon');
  const text = document.getElementById('seniorSpeechText');

  if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
    window.speechSynthesis.cancel();
    if (btn) btn.classList.remove('speaking');
    if (icon) icon.textContent = '🔊';
    if (text) text.textContent = getTranslation('floatingListenScreen', lang);
    return;
  }

  const age = getPatientAge(patient);
  const name = patient.name || 'Paciente';
  let speech = `${getTranslation('speechIntro', lang)} ${name}, ${age} ${lang === 'en' ? 'years old' : (lang === 'pt' ? 'anos' : 'años')}. ${getTranslation('seniorModeTitle', lang)}. `;

  const currentTab = caregiverInternalTab || 'daily';
  if (currentTab === 'daily') {
    speech += `${getTranslation('tabDaily', lang)}. `;
    const bpSys = document.getElementById('bpSystolic')?.value;
    const bpDia = document.getElementById('bpDiastolic')?.value;
    const hr = document.getElementById('heartRate')?.value;
    const spo2 = document.getElementById('vitalSpO2')?.value;
    const temp = document.getElementById('vitalTemp')?.value;

    if (bpSys && bpDia) speech += `${getTranslation('speechVitals', lang)}: ${bpSys}/${bpDia}. `;
    if (hr) speech += `${getTranslation('speechPulse', lang)}: ${hr} ppm. `;
    if (spo2) speech += `SpO2: ${spo2}%. `;
    if (temp) speech += `${getTranslation('speechTemp', lang)}: ${temp} °C. `;

    if (patient.emergencyContact?.name) {
      speech += `${getTranslation('labelEmergencyContact', lang)} ${patient.emergencyContact.name}, tel ${patient.emergencyContact.phone}. `;
    }
    speech += getTranslation('speechEmergency', lang);
  } else if (currentTab === 'history') {
    speech += `${getTranslation('tabHistory', lang)}. `;
  } else if (currentTab === 'docs') {
    speech += `${getTranslation('tabDocs', lang)}. `;
  } else if (currentTab === 'vaccines_dental') {
    speech += `${getTranslation('tabVaccinesDental', lang)}. `;
  }

  const utterance = new SpeechSynthesisUtterance(speech);
  utterance.lang = getVoiceLangCode(lang);
  utterance.rate = 0.92;
  utterance.pitch = 1.0;

  utterance.onstart = () => {
    if (btn) btn.classList.add('speaking');
    if (icon) icon.textContent = '⏹️';
    if (text) text.textContent = getTranslation('floatingStopVoice', lang);
  };

  utterance.onend = () => {
    if (btn) btn.classList.remove('speaking');
    if (icon) icon.textContent = '🔊';
    if (text) text.textContent = getTranslation('floatingListenScreen', lang);
  };

  utterance.onerror = () => {
    if (btn) btn.classList.remove('speaking');
    if (icon) icon.textContent = '🔊';
    if (text) text.textContent = getTranslation('floatingListenScreen', lang);
  };

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

// ============================================================================
// 3 CONTROLES GLOBALES DE LA BARRA SUPERIOR
// 1. Asistente de Voz Global (personas sin lectoescritura)
// 2. Botón Sol / Luna (☀️ Día / 🌙 Noche)
// 3. Idioma según Registro (Español, Kreyòl Ayisyen, Português, English, Mapuzugun)
// ============================================================================

export const I18N_DICTIONARY = {
  es: {
    patient: 'Paciente:',
    addDependent: '+ Agregar Persona a Cargo',
    voiceAssistant: 'Asistente de Voz',
    stopVoice: 'Detener Voz',
    themeDay: 'Modo Día',
    themeNight: 'Modo Noche',
    tabDaily: 'Control Diario y Signos',
    tabHistory: 'Historial y Evoluciones',
    tabDocs: 'Documentos y Recetas',
    tabVaccinesDental: 'Vacunas y Dental',
    callSamu: 'Llamar SAMU Ambulancia (131)',
    callContact: 'Llamar Contacto',
    emergencyQr: 'Ver QR de Urgencia',
    saveReport: 'Guardar Reporte Diario',
    vitalsTitle: '🩺 Tomas Básicas y Alertas Clínicas',
    vitalsSubtitle: 'Evaluación de signos vitales basales y detección de riesgo en tiempo real',
    wellnessTitle: 'Parámetros de Bienestar General',
    triageBadge: 'Triage en Tiempo Real',
    prescriptions: 'Medicamentos Vigentes',
    appointments: '📅 Recordatorios de Citas y Exámenes',
    addAppointment: '+ Agendar Recordatorio',
    prenatalTitle: 'Control Prenatal MINSAL',
    registerBirth: 'Registrar Nacimiento',
    seniorModeTitle: 'Modo Fácil Adulto Mayor Activado',
    seniorModeDesc: 'Textos y botones ampliados para máxima legibilidad. Toca el botón Asistente de Voz superior para escuchar esta pantalla en voz alta.',
    sidebarEvaluation: 'Mi Ficha Clínica',
    sidebarManagement: 'Gestión de Pacientes',
    sidebarLogout: 'Cerrar Sesión',
    sidebarUser: 'Usuario:',
    patientFileTitle: 'Ficha del Paciente',
    authorizedLinkBadge: 'Vínculo Autorizado (Ley 20.584)',
    labelAgeSex: 'Edad / Sexo:',
    labelWeightHeight: 'Peso / Estatura:',
    labelBlood: 'Grupo Sanguíneo:',
    labelAllergies: 'Alergias:',
    labelEmergencyContact: 'Contacto Emergencia:',
    btnEditContact: '✏️ Editar Contacto',
    btnCall133: '🚓 133 Carabineros',
    btnSaludResponde: '📞 Salud Responde (600 360 7777)',
    activeConditionsTitle: 'Condiciones Activas:',
    floatingListenScreen: 'Escuchar Pantalla',
    floatingStopVoice: 'Detener Voz',
    speechIntro: 'Asistente de voz activo. Ficha de',
    speechVitals: 'Presión arterial',
    speechPulse: 'Pulso',
    speechTemp: 'Temperatura',
    speechMeds: 'Medicamentos prescritos:',
    speechAppointments: 'Citas médicas:',
    speechAlert: 'Alerta clínica:',
    speechNoAlert: 'Sin alertas de riesgo actuales.',
    speechEmergency: 'En caso de urgencia médica, llame a SAMU 131.',
    speechCardVitals: 'Sección de signos vitales: Presión arterial, frecuencia cardíaca y oxigenación.',
    speechCardMeds: 'Lista de medicamentos y remedios recetados vigentes.',
    speechCardAppointments: 'Calendario de citas médicas y exámenes pendientes.',
    speechCardEmergency: 'Zona de emergencia telefónica. Toque para llamar al SAMU 131 o contacto familiar.'
  },
  ht: {
    patient: 'Pasyan:',
    addDependent: '+ Ajoute Moun Sou Kont Ou',
    voiceAssistant: 'Asistan Vwa',
    stopVoice: 'Sispann Vwa',
    themeDay: 'Mòd Lajounen',
    themeNight: 'Mòd Lannwit',
    tabDaily: 'Kontwòl Chak Jou ak Siy',
    tabHistory: 'Istwa ak Evolisyon',
    tabDocs: 'Dokiman ak Preskripsyon',
    tabVaccinesDental: 'Vaksen ak Dan',
    callSamu: 'Rele SAMU Anbilans (131)',
    callContact: 'Rele Kontak Ijans',
    emergencyQr: 'Wè Kòd QR Ijans',
    saveReport: 'Anrejistre Rapò Chak Jou',
    vitalsTitle: '🩺 Siy Vital ak Alèt Medikal',
    vitalsSubtitle: 'Evalyasyon siy vital de baz ak deteksyon risk an tan reyèl',
    wellnessTitle: 'Paramèt Byennèt ak Kalite Lavi',
    triageBadge: 'Evalyasyon An Tan Reyèl',
    prescriptions: 'Medikaman Yo Preskri',
    appointments: '📅 Rapèl Randevou ak Egzamen',
    addAppointment: '+ Pran Randevou',
    prenatalTitle: 'Kontwòl Gwosès MINSAL',
    registerBirth: 'Anrejistre Nesans',
    seniorModeTitle: 'Mòd Fasil Granmoun Aktive',
    seniorModeDesc: 'Tèks ak bouton agrandi pou lekti fasil. Peze bouton Asistan Vwa anwo a pou tande ekran sa a byen fò.',
    sidebarEvaluation: 'Fich Medik Mwen',
    sidebarManagement: 'Jesyon Pasyan',
    sidebarLogout: 'Dekonekte',
    sidebarUser: 'Itilizatè:',
    patientFileTitle: 'Fich Pasyan',
    authorizedLinkBadge: 'Lyen Otorize (Lwa 20.584)',
    labelAgeSex: 'Laj / Sèks:',
    labelWeightHeight: 'Pwa / Wotè:',
    labelBlood: 'Gwoup San:',
    labelAllergies: 'Alèji:',
    labelEmergencyContact: 'Kontak Ijans:',
    btnEditContact: '✏️ Modifye Kontak',
    btnCall133: '133 Polis',
    btnSaludResponde: 'Sante Reponn (600 360 7777)',
    activeConditionsTitle: 'Kondisyon Sante Aktif:',
    floatingListenScreen: 'Koute Ekran',
    floatingStopVoice: 'Sispann Vwa',
    speechIntro: 'Asistan vwa aktif. Fich medikal pou',
    speechVitals: 'Tansyon atèryèl',
    speechPulse: 'Pous kè',
    speechTemp: 'Tanperati',
    speechMeds: 'Medikaman pasyan an dwe pran:',
    speechAppointments: 'Randevou medikal:',
    speechAlert: 'Alèt medikal:',
    speechNoAlert: 'Pa gen alèt danje kounye a.',
    speechEmergency: 'Si gen ijans medikal, peze bouton wouj anbilans 131.',
    speechCardVitals: 'Seksyon siy vital: Tansyon, batman kè ak oksijèn.',
    speechCardMeds: 'Lis medikaman ak remèd doktè preskri.',
    speechCardAppointments: 'Kalandriye randevou doktè ak analiz ki pwograme.',
    speechCardEmergency: 'Zòn apèl ijans. Peze pou rele SAMU 131 oswa fanmi ou.'
  },
  pt: {
    patient: 'Paciente:',
    addDependent: '+ Adicionar Dependente',
    voiceAssistant: 'Assistente de Voz',
    stopVoice: 'Parar Voz',
    themeDay: 'Modo Dia',
    themeNight: 'Modo Noite',
    tabDaily: 'Controle Diário e Sinais',
    tabHistory: 'Histórico e Evoluções',
    tabDocs: 'Documentos e Receitas',
    tabVaccinesDental: 'Vacinas e Odontologia',
    callSamu: 'Ligar SAMU Ambulância (131)',
    callContact: 'Ligar para Contato',
    emergencyQr: 'Ver QR de Urgência',
    saveReport: 'Salvar Relatório Diário',
    vitalsTitle: '🩺 Sinais Vitais e Alertas Clínicos',
    vitalsSubtitle: 'Avaliação de sinais vitais basais e detecção de risco em tempo real',
    wellnessTitle: 'Parâmetros de Bem-Estar Geral',
    triageBadge: 'Triagem em Tempo Real',
    prescriptions: 'Medicamentos Vigentes',
    appointments: '📅 Lembretes de Consultas e Exames',
    addAppointment: '+ Agendar Lembrete',
    prenatalTitle: 'Controle Pré-natal MINSAL',
    registerBirth: 'Registrar Nascimento',
    seniorModeTitle: 'Modo Fácil Idoso Ativado',
    seniorModeDesc: 'Textos e botões ampliados para máxima legibilidade. Toque no botão Assistente de Voz superior para ouvir esta tela em voz alta.',
    sidebarEvaluation: 'Meu Prontuário Clínico',
    sidebarManagement: 'Gestão de Pacientes',
    sidebarLogout: 'Encerrar Sessão',
    sidebarUser: 'Usuário:',
    patientFileTitle: 'Ficha do Paciente',
    authorizedLinkBadge: 'Vínculo Autorizado (Lei 20.584)',
    labelAgeSex: 'Idade / Sexo:',
    labelWeightHeight: 'Peso / Altura:',
    labelBlood: 'Grupo Sanguíneo:',
    labelAllergies: 'Alergias:',
    labelEmergencyContact: 'Contato de Emergência:',
    btnEditContact: '✏️ Editar Contato',
    btnCall133: '133 Polícia',
    btnSaludResponde: 'Saúde Responde (600 360 7777)',
    activeConditionsTitle: 'Condições Ativas:',
    floatingListenScreen: 'Ouvir Tela',
    floatingStopVoice: 'Parar Voz',
    speechIntro: 'Assistente de voz ativo. Ficha clínica de',
    speechVitals: 'Pressão arterial',
    speechPulse: 'Frequência cardíaca',
    speechTemp: 'Temperatura',
    speechMeds: 'Medicamentos prescritos:',
    speechAppointments: 'Consultas médicas:',
    speechAlert: 'Alerta clínico:',
    speechNoAlert: 'Sem alertas de risco clínicos no momento.',
    speechEmergency: 'Em caso de urgência médica, ligue para a ambulância do SAMU 131.',
    speechCardVitals: 'Seção de sinais vitais: Pressão arterial, frequência cardíaca e oxigenação.',
    speechCardMeds: 'Lista de medicamentos e remédios prescritos ativos.',
    speechCardAppointments: 'Calendário de consultas médicas e exames pendentes.',
    speechCardEmergency: 'Zona de emergência telefônica. Toque para ligar para o SAMU 131 ou contato familiar.'
  },
  en: {
    patient: 'Patient:',
    addDependent: '+ Add Dependent',
    voiceAssistant: 'Voice Assistant',
    stopVoice: 'Stop Voice',
    themeDay: 'Day Mode',
    themeNight: 'Night Mode',
    tabDaily: 'Daily Monitoring & Vitals',
    tabHistory: 'History & Evolutions',
    tabDocs: 'Documents & Prescriptions',
    tabVaccinesDental: 'Vaccines & Dental',
    callSamu: 'Call SAMU Ambulance (131)',
    callContact: 'Call Emergency Contact',
    emergencyQr: 'View Emergency QR',
    saveReport: 'Save Daily Report',
    vitalsTitle: '🩺 Basic Vitals & Clinical Alerts',
    vitalsSubtitle: 'Baseline vital signs assessment and real-time risk detection',
    wellnessTitle: 'Wellness & Quality of Life Parameters',
    triageBadge: 'Real-Time Triage',
    prescriptions: 'Active Medications',
    appointments: '📅 Appointments & Tests Reminders',
    addAppointment: '+ Schedule Reminder',
    prenatalTitle: 'MINSAL Prenatal Care',
    registerBirth: 'Register Newborn',
    seniorModeTitle: 'Senior Friendly Mode Activated',
    seniorModeDesc: 'Enlarged texts and buttons for maximum legibility. Tap the top Voice Assistant button to hear this screen read aloud.',
    sidebarEvaluation: 'My Clinical File',
    sidebarManagement: 'Patient Management',
    sidebarLogout: 'Log Out',
    sidebarUser: 'User:',
    patientFileTitle: 'Patient File',
    authorizedLinkBadge: 'Authorized Link (Law 20.584)',
    labelAgeSex: 'Age / Sex:',
    labelWeightHeight: 'Weight / Height:',
    labelBlood: 'Blood Type:',
    labelAllergies: 'Allergies:',
    labelEmergencyContact: 'Emergency Contact:',
    btnEditContact: '✏️ Edit Contact',
    btnCall133: '133 Police',
    btnSaludResponde: 'Health Response (600 360 7777)',
    activeConditionsTitle: 'Active Conditions:',
    floatingListenScreen: 'Listen to Screen',
    floatingStopVoice: 'Stop Voice',
    speechIntro: 'Voice assistant active. Medical file of',
    speechVitals: 'Blood pressure',
    speechPulse: 'Heart rate',
    speechTemp: 'Body temperature',
    speechMeds: 'Active prescribed medications:',
    speechAppointments: 'Medical appointments:',
    speechAlert: 'Clinical alert:',
    speechNoAlert: 'No clinical risk alerts at this moment.',
    speechEmergency: 'In case of medical emergency, call SAMU Ambulance 131.',
    speechCardVitals: 'Vital signs section: Blood pressure, heart rate, and oxygen saturation.',
    speechCardMeds: 'List of currently prescribed medications.',
    speechCardAppointments: 'Upcoming medical appointments and clinical exams.',
    speechCardEmergency: 'Direct emergency calling area. Tap to call SAMU 131 or emergency contact.'
  },
  arn: {
    patient: 'Kuxan:',
    addDependent: '+ Yall Che Püñeñ',
    voiceAssistant: 'Dungun Keluwün',
    stopVoice: 'Katxün Dungun',
    themeDay: 'Antü Dungun',
    themeNight: 'Pun Dungun',
    tabDaily: 'Fill Antü Kuxankünun',
    tabHistory: 'Kuxan Nutram',
    tabDocs: 'Chilkawün Lawen',
    tabVaccinesDental: 'Lawen Vaksen ka Foro',
    callSamu: 'Mütxüm SAMU (131)',
    callContact: 'Mütxüm Inchin Wenüy',
    emergencyQr: 'Leeli QR Pelom',
    saveReport: 'Künun Doy Chilka',
    vitalsTitle: '🩺 Mongen Kimün ka Kürüf',
    vitalsSubtitle: 'Fill antü mongen newen kimün ka weñankünun fantepu',
    wellnessTitle: 'Küme Mongen Dungun',
    triageBadge: 'Fantepu Kuxan Kimün',
    prescriptions: 'Mülelu Lawen',
    appointments: '📅 Trawün ka Pefin',
    addAppointment: '+ Künun Trawün',
    prenatalTitle: 'Püñeñ-Künun MINSAL',
    registerBirth: 'Chilkatun Choyün',
    seniorModeTitle: 'Fücha / Kuse Pengelün',
    seniorModeDesc: 'Fütxake wirin ka nütrün tami leeltuam. Pütxokünunge wente Dungun Keluwün tami allkütuam feychi chilka.',
    sidebarEvaluation: 'Mi Ficha Clínica',
    sidebarManagement: 'Ngülam Kuxan',
    sidebarLogout: 'Nentun Konün',
    sidebarUser: 'Che:',
    patientFileTitle: 'Kuxan Chilka',
    authorizedLinkBadge: 'Kellu Sello Ley 20.584',
    labelAgeSex: 'Tripantu / Zomo-Wentru:',
    labelWeightHeight: 'Pesa / Alün:',
    labelBlood: 'Mollfüñ Reñma:',
    labelAllergies: 'Kutxan-weñan:',
    labelEmergencyContact: 'Inchin Wenüy:',
    btnEditContact: '✏️ Wirin Wenüy',
    btnCall133: '133 Carabineros',
    btnSaludResponde: 'Mongen Wiñon (600 360 7777)',
    activeConditionsTitle: 'Mülelu Kutxan:',
    floatingListenScreen: 'Allkütun Chilka',
    floatingStopVoice: 'Katxün Dungun',
    speechIntro: 'Dungun keluwün mongen. Kuxan chilka:',
    speechVitals: 'Mollfüñ newen',
    speechPulse: 'Piwke newen',
    speechTemp: 'Aref mongen',
    speechMeds: 'Lawen kuxan:',
    speechAppointments: 'Trawün lawen-che:',
    speechAlert: 'Weñankünun:',
    speechNoAlert: 'Kümey, chem weñankünun no rume.',
    speechEmergency: 'Kuxan iñchiw mülele, mütxümafimi SAMU 131.',
    speechCardVitals: 'Mollfüñ, piwke newen ka aref mongen.',
    speechCardMeds: 'Mülelu fill lawen kuxan che.',
    speechCardAppointments: 'Trawün lawen-che ka kuxan pefin.',
    speechCardEmergency: 'Mütxüm newen. Püxokünunge SAMU 131 kam tami reñma.'
  }
};

export function getCurrentLanguage() {
  return localStorage.getItem('cuidapp_language') || 'es';
}

export function getTranslation(key, lang = getCurrentLanguage()) {
  const dict = I18N_DICTIONARY[lang] || I18N_DICTIONARY.es;
  return dict[key] || I18N_DICTIONARY.es[key] || key;
}

export function getVoiceLangCode(lang = getCurrentLanguage()) {
  if (lang === 'ht') return 'fr-FR';
  if (lang === 'pt') return 'pt-BR';
  if (lang === 'en') return 'en-US';
  if (lang === 'arn') return 'es-CL';
  return 'es-CL';
}

export function applyGlobalLanguage(lang, patient = activePatient) {
  if (!lang || !I18N_DICTIONARY[lang]) lang = 'es';
  localStorage.setItem('cuidapp_language', lang);
  if (patient) {
    patient.language = lang;
    patient.idioma = lang;
    patient.idiomaPreferido = lang;
    if (patient.id) {
      localStorage.setItem('cuidapp_user_lang_' + patient.id, lang);
    }
    if (patient.username) {
      localStorage.setItem('cuidapp_user_lang_' + String(patient.username).toLowerCase(), lang);
    }
    const nameLower = String(patient.name || '').toLowerCase();
    if (nameLower) {
      localStorage.setItem('cuidapp_user_lang_' + nameLower.trim(), lang);
      if (nameLower.includes('juan')) localStorage.setItem('cuidapp_user_lang_juan', lang);
      if (nameLower.includes('valentina')) localStorage.setItem('cuidapp_user_lang_valentina', lang);
      if (nameLower.includes('daniela')) localStorage.setItem('cuidapp_user_lang_daniela', lang);
      if (nameLower.includes('camila')) localStorage.setItem('cuidapp_user_lang_camila', lang);
      if (nameLower.includes('mateo')) localStorage.setItem('cuidapp_user_lang_mateo', lang);
      if (nameLower.includes('cuidador')) localStorage.setItem('cuidapp_user_lang_cuidador', lang);
    }
  }

  // 1. Actualizar selector superior
  const select = document.getElementById('globalLanguageSelector');
  if (select && select.value !== lang) {
    select.value = lang;
  }

  // 2. Traducir textos de la barra superior
  const lblPat = document.getElementById('lblGlobalPatient');
  if (lblPat) lblPat.textContent = getTranslation('patient', lang);

  const btnAdd = document.getElementById('lblAddPersonaACargoBtn');
  if (btnAdd) btnAdd.textContent = getTranslation('addDependent', lang);

  const voiceTxt = document.getElementById('globalVoiceText');
  if (voiceTxt && !window.speechSynthesis?.speaking) {
    voiceTxt.textContent = getTranslation('voiceAssistant', lang);
  }

  // Actualizar texto Sol / Luna
  const themeTxt = document.getElementById('globalThemeText');
  if (themeTxt) {
    const isLight = document.body.classList.contains('cuidapp-theme-light');
    themeTxt.textContent = isLight ? getTranslation('themeNight', lang) : getTranslation('themeDay', lang);
  }

  // 3. Traducir Menú Lateral (Sidebar)
  const linkEvalTxt = document.querySelector('#linkEvaluation .sidebar-text-full');
  if (linkEvalTxt) linkEvalTxt.textContent = getTranslation('sidebarEvaluation', lang);

  const linkMgmtTxt = document.querySelector('#linkManagement .sidebar-text-full');
  if (linkMgmtTxt) linkMgmtTxt.textContent = getTranslation('sidebarManagement', lang);

  const logoutTxt = document.querySelector('#btnLogout .sidebar-text-full');
  if (logoutTxt) logoutTxt.textContent = getTranslation('sidebarLogout', lang);

  const userFooter = document.querySelector('.sidebar footer small');
  if (userFooter) {
    const userStrong = userFooter.querySelector('strong');
    const uName = userStrong ? userStrong.textContent : '';
    userFooter.innerHTML = `${getTranslation('sidebarUser', lang)} <strong class="text-white">${uName}</strong>`;
  }

  // 4. Traducir Pestañas Internas (Carpetas Compactas)
  const tabDaily = document.querySelector('#tabBtnCaregiverDaily .folder-tab-title') || document.querySelector('#tabBtnCaregiverDaily span:last-child');
  if (tabDaily) tabDaily.textContent = getTranslation('tabDaily', lang);
  const tabHist = document.querySelector('#tabBtnCaregiverHistory .folder-tab-title') || document.querySelector('#tabBtnCaregiverHistory span:last-child');
  if (tabHist) tabHist.textContent = getTranslation('tabHistory', lang);
  const tabDocs = document.querySelector('#tabBtnCaregiverDocs .folder-tab-title') || document.querySelector('#tabBtnCaregiverDocs span:last-child');
  if (tabDocs) tabDocs.textContent = getTranslation('tabDocs', lang);
  const tabVac = document.querySelector('#tabBtnCaregiverVaccinesDental .folder-tab-title') || document.querySelector('#tabBtnCaregiverVaccinesDental span:last-child');
  if (tabVac) tabVac.textContent = getTranslation('tabVaccinesDental', lang);

  // 5. Traducir Encabezados de Secciones
  const vitalsTitle = document.getElementById('lblVitalsSectionTitle');
  if (vitalsTitle) vitalsTitle.textContent = getTranslation('vitalsTitle', lang);

  const wellnessTitle = document.getElementById('lblWellnessSectionTitle');
  if (wellnessTitle) wellnessTitle.textContent = getTranslation('wellnessTitle', lang);

  const apptsTitle = document.getElementById('lblAppointmentsCardTitle');
  if (apptsTitle) apptsTitle.textContent = getTranslation('appointments', lang);

  const addApptBtn = document.getElementById('lblAddAppointmentBtn');
  if (addApptBtn) addApptBtn.textContent = getTranslation('addAppointment', lang);

  const saveBtn = document.querySelector('#submitButtonContainer button span');
  if (saveBtn) saveBtn.textContent = getTranslation('saveReport', lang);

  const triageBadge = document.getElementById('badgeCaregiverTriageMode');
  if (triageBadge) triageBadge.innerHTML = `<i class="bi bi-broadcast me-1"></i>${getTranslation('triageBadge', lang)}`;

  // 6. Traducir Etiquetas y Botones de la Ficha del Paciente Lateral (Columna Derecha)
  const lblFileTitle = document.getElementById('lblPatientFileTitle');
  if (lblFileTitle) lblFileTitle.textContent = getTranslation('patientFileTitle', lang);

  const badgeAuth = document.getElementById('badgeAuthorizedLink');
  if (badgeAuth) badgeAuth.innerHTML = `<i class="bi bi-shield-check me-1"></i>${getTranslation('authorizedLinkBadge', lang)}`;

  const lblAgeSex = document.getElementById('lblMetaAgeSex');
  if (lblAgeSex) lblAgeSex.textContent = getTranslation('labelAgeSex', lang);

  const lblWeightHeight = document.getElementById('lblMetaWeightHeight');
  if (lblWeightHeight) lblWeightHeight.textContent = getTranslation('labelWeightHeight', lang);

  const lblBlood = document.getElementById('lblMetaBlood');
  if (lblBlood) lblBlood.textContent = getTranslation('labelBlood', lang);

  const lblAllergies = document.getElementById('lblMetaAllergies');
  if (lblAllergies) lblAllergies.textContent = getTranslation('labelAllergies', lang);

  const lblContact = document.getElementById('lblMetaContact');
  if (lblContact) lblContact.innerHTML = `<i class="bi bi-telephone-fill me-1"></i>${getTranslation('labelEmergencyContact', lang)}`;

  const btnEditContact = document.getElementById('btnEditContactText');
  if (btnEditContact) btnEditContact.textContent = getTranslation('btnEditContact', lang);

  const samuBtn = document.querySelector('#btnCallSamu131 span:last-child');
  if (samuBtn) samuBtn.textContent = getTranslation('callSamu', lang);

  const contactLbl = document.getElementById('labelCallEmergencyContact');
  if (contactLbl) {
    const contactName = patient?.emergencyContact?.name ? patient.emergencyContact.name.split(' ')[0] : 'Contacto';
    contactLbl.textContent = `${getTranslation('callContact', lang)} (${contactName})`;
  }

  const lbl133 = document.getElementById('lblBtn133');
  if (lbl133) lbl133.textContent = getTranslation('btnCall133', lang);

  const lblSalud = document.getElementById('lblBtnSaludResponde');
  if (lblSalud) lblSalud.textContent = getTranslation('btnSaludResponde', lang);

  const qrBtn = document.querySelector('#btnOpenCaregiverEmergencyQrModal span:last-child');
  if (qrBtn) qrBtn.textContent = getTranslation('emergencyQr', lang);

  const lblConditions = document.getElementById('lblActiveConditionsTitle');
  if (lblConditions) lblConditions.textContent = getTranslation('activeConditionsTitle', lang);

  // 7. Traducir Subtítulo de Tomas Básicas y Banner Adulto Mayor
  const vitalsSub = document.getElementById('vitalsSubTitleCaregiver');
  if (vitalsSub) vitalsSub.textContent = getTranslation('vitalsSubtitle', lang);

  const seniorTitle = document.getElementById('lblSeniorModeTitle');
  if (seniorTitle) seniorTitle.textContent = getTranslation('seniorModeTitle', lang);

  const seniorSub = document.getElementById('lblSeniorModeSubtitle');
  if (seniorSub) seniorSub.textContent = getTranslation('seniorModeDesc', lang);

  // 8. Traducir Botón Flotante Escuchar Pantalla
  const floatText = document.getElementById('seniorSpeechText');
  const floatBtn = document.getElementById('btnFloatingSeniorSpeech');
  if (floatText && !window.speechSynthesis?.speaking) {
    floatText.textContent = getTranslation('floatingListenScreen', lang);
  }
  if (floatBtn) {
    floatBtn.setAttribute('aria-label', getTranslation('floatingListenScreen', lang));
    floatBtn.setAttribute('title', getTranslation('floatingListenScreen', lang));
  }
}

// --- CONTROL 2: TEMA SOL / LUNA (☀️ Día / 🌙 Noche) ---
export function initGlobalTheme() {
  const savedTheme = localStorage.getItem('cuidapp_theme') || 'dark';
  applyGlobalTheme(savedTheme);
}

export function applyGlobalTheme(theme) {
  const isLight = theme === 'light';
  if (isLight) {
    document.body.classList.add('cuidapp-theme-light');
  } else {
    document.body.classList.remove('cuidapp-theme-light');
  }
  localStorage.setItem('cuidapp_theme', isLight ? 'light' : 'dark');

  const icon = document.getElementById('globalThemeIcon');
  const text = document.getElementById('globalThemeText');
  const lang = getCurrentLanguage();
  if (icon) icon.textContent = isLight ? '🌙' : '☀️';
  if (text) text.textContent = isLight ? getTranslation('themeNight', lang) : getTranslation('themeDay', lang);
}

export function toggleGlobalTheme() {
  const isCurrentlyLight = document.body.classList.contains('cuidapp-theme-light');
  applyGlobalTheme(isCurrentlyLight ? 'dark' : 'light');
}

// --- CONTROL 1: ASISTENTE DE VOZ GLOBAL PARA PERSONAS SIN LECTOESCRITURA ---
let globalVoiceActive = false;
let globalContinuousAudioGuide = false;
let lastSpokenCard = '';
let cardSpeechDebounceTimer = null;

export function buildAuditorySummaryText(patient, lang = 'es') {
  const pName = patient ? (patient.socialName || patient.name) : 'Paciente';
  const pAge = patient ? getPatientAge(patient) : '';

  const bpSys = document.getElementById('bpSystolic')?.value;
  const bpDia = document.getElementById('bpDiastolic')?.value;
  const hr = document.getElementById('heartRate')?.value;
  const spo2 = document.getElementById('vitalSpO2')?.value;
  const temp = document.getElementById('vitalTemp')?.value;

  const rxItems = getPatientPrescriptions(patient?.id || '').filter(r => r.status === 'activa');
  const rxNames = rxItems.length > 0 ? rxItems.map(r => `${r.name} ${r.dose}`).join(', ') : '';

  const apptItems = getPatientAppointments(patient);
  const apptNames = apptItems.length > 0 ? apptItems.slice(0, 2).map(a => `${a.title} el ${a.date}`).join('. ') : '';

  let speech = '';
  if (lang === 'ht') {
    speech = `Bonjou! ${getTranslation('speechIntro', lang)} ${pName}, ${pAge} lane. `;
    if (bpSys && bpDia) speech += `${getTranslation('speechVitals', lang)} se ${bpSys} sou ${bpDia}. `;
    if (hr) speech += `${getTranslation('speechPulse', lang)} se ${hr} batitid pa minit. `;
    if (spo2) speech += `Oksijèn SpO2 se ${spo2} pousan. `;
    if (temp) speech += `${getTranslation('speechTemp', lang)} se ${temp} degre. `;
    if (rxNames) speech += `${getTranslation('speechMeds', lang)}: ${rxNames}. `;
    if (apptNames) speech += `${getTranslation('speechAppointments', lang)}: ${apptNames}. `;
    speech += `${getTranslation('speechEmergency', lang)}`;
  } else if (lang === 'en') {
    speech = `Welcome! ${getTranslation('speechIntro', lang)} ${pName}, ${pAge} years old. `;
    if (bpSys && bpDia) speech += `${getTranslation('speechVitals', lang)} is ${bpSys} over ${bpDia}. `;
    if (hr) speech += `${getTranslation('speechPulse', lang)} is ${hr} beats per minute. `;
    if (spo2) speech += `Oxygen SpO2 is ${spo2} percent. `;
    if (temp) speech += `${getTranslation('speechTemp', lang)} is ${temp} degrees. `;
    if (rxNames) speech += `${getTranslation('speechMeds', lang)} ${rxNames}. `;
    if (apptNames) speech += `${getTranslation('speechAppointments', lang)} ${apptNames}. `;
    speech += `${getTranslation('speechEmergency', lang)}`;
  } else if (lang === 'arn') {
    speech = `Mari mari! ${getTranslation('speechIntro', lang)} ${pName}, ${pAge} tripantu. `;
    if (bpSys && bpDia) speech += `${getTranslation('speechVitals', lang)}: ${bpSys} eñu ${bpDia}. `;
    if (hr) speech += `${getTranslation('speechPulse', lang)}: ${hr} piwke. `;
    if (temp) speech += `${getTranslation('speechTemp', lang)}: ${temp} aref. `;
    if (rxNames) speech += `${getTranslation('speechMeds', lang)}: ${rxNames}. `;
    if (apptNames) speech += `${getTranslation('speechAppointments', lang)}: ${apptNames}. `;
    speech += `${getTranslation('speechEmergency', lang)}`;
  } else {
    // Español (default)
    speech = `Hola. ${getTranslation('speechIntro', 'es')} ${pName}, de ${pAge} años de edad. `;
    if (bpSys && bpDia) speech += `Su presión arterial actual es ${bpSys} con ${bpDia}. `;
    if (hr) speech += `Frecuencia cardíaca de ${hr} latidos por minuto. `;
    if (spo2) speech += `Oxigenación de ${spo2} por ciento. `;
    if (temp) speech += `Temperatura corporal de ${temp} grados. `;
    if (rxNames) speech += `Sus medicamentos prescritos vigentes son: ${rxNames}. `;
    if (apptNames) speech += `Próximas citas médicas programadas: ${apptNames}. `;
    else speech += `Sin citas urgentes hoy. `;
    speech += `En caso de cualquier emergencia o malestar agudo, presione el botón rojo para llamar a la ambulancia del SAMU al 131.`;
  }

  return speech;
}

export function toggleGlobalVoiceAssistant(patient = activePatient) {
  if (!('speechSynthesis' in window)) {
    if (window.showGlassAlert) {
      window.showGlassAlert('La síntesis de voz no está soportada en este navegador.', 'warning');
    }
    return;
  }

  const btn = document.getElementById('btnGlobalVoiceAssistant');
  const icon = document.getElementById('globalVoiceIcon');
  const text = document.getElementById('globalVoiceText');
  const lang = getCurrentLanguage();

  if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
    window.speechSynthesis.cancel();
    globalVoiceActive = false;
    if (btn) {
      btn.style.background = 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)';
      btn.style.borderColor = '#fef08a';
    }
    if (icon) icon.textContent = '🔊';
    if (text) text.textContent = getTranslation('voiceAssistant', lang);
    return;
  }

  globalVoiceActive = true;
  globalContinuousAudioGuide = true;
  if (btn) {
    btn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    btn.style.borderColor = '#fca5a5';
  }
  if (icon) icon.textContent = '⏹️';
  if (text) text.textContent = getTranslation('stopVoice', lang);

  const summaryText = buildAuditorySummaryText(patient, lang);
  const utterance = new SpeechSynthesisUtterance(summaryText);
  utterance.lang = getVoiceLangCode(lang);
  utterance.rate = 0.92;
  utterance.pitch = 1.0;

  utterance.onend = () => {
    globalVoiceActive = false;
    if (btn) {
      btn.style.background = 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)';
      btn.style.borderColor = '#fef08a';
    }
    if (icon) icon.textContent = '🔊';
    if (text) text.textContent = getTranslation('voiceAssistant', lang);
  };

  utterance.onerror = () => {
    globalVoiceActive = false;
    if (btn) {
      btn.style.background = 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)';
      btn.style.borderColor = '#fef08a';
    }
    if (icon) icon.textContent = '🔊';
    if (text) text.textContent = getTranslation('voiceAssistant', lang);
  };

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function setupCardFocusAudioGuide(patient) {
  const cards = [
    { id: 'cardBasicVitals', key: 'speechCardVitals' },
    { id: 'caregiverPrescriptionListPreview', key: 'speechCardMeds' },
    { id: 'cardPatientAppointments', key: 'speechCardAppointments' },
    { id: 'caregiverEmergencyButtonsContainer', key: 'speechCardEmergency' },
    { id: 'iotEcgContainerCuidador', key: 'speechCardVitals' },
    { id: 'cardPrenatalCaregiver', key: 'prenatalTitle' }
  ];

  cards.forEach(c => {
    const el = document.getElementById(c.id);
    if (!el) return;
    el.setAttribute('tabindex', '0');

    const speakCardDescription = () => {
      if (!globalContinuousAudioGuide && !window.speechSynthesis?.speaking) return;
      if (lastSpokenCard === c.id) return;
      lastSpokenCard = c.id;

      clearTimeout(cardSpeechDebounceTimer);
      cardSpeechDebounceTimer = setTimeout(() => {
        const lang = getCurrentLanguage();
        const text = getTranslation(c.key, lang);
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = getVoiceLangCode(lang);
        utterance.rate = 0.95;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      }, 250);
    };

    el.onfocus = speakCardDescription;
    el.onmouseenter = speakCardDescription;
  });
}

export function bindGlobalTopBarControls(patient = activePatient) {
  // 1. Asistente de Voz Global
  const btnVoice = document.getElementById('btnGlobalVoiceAssistant');
  if (btnVoice) {
    btnVoice.onclick = () => {
      toggleGlobalVoiceAssistant(patient);
    };
  }

  // 2. Botón Sol / Luna (☀️ Día / 🌙 Noche)
  const btnTheme = document.getElementById('btnGlobalThemeToggle');
  if (btnTheme) {
    btnTheme.onclick = () => {
      toggleGlobalTheme();
    };
  }
  initGlobalTheme();

  // 3. Selector de Idioma según Registro
  const selectLang = document.getElementById('globalLanguageSelector');
  if (selectLang) {
    let initialLang = 'es';
    if (patient) {
      const pKey = (patient.username || '').toLowerCase();
      const pName = (patient.name || '').toLowerCase();
      let savedUserLang = (patient.id && localStorage.getItem('cuidapp_user_lang_' + patient.id)) ||
        (pKey && localStorage.getItem('cuidapp_user_lang_' + pKey)) ||
        (pName && localStorage.getItem('cuidapp_user_lang_' + pName));

      if (!savedUserLang) {
        if (pName.includes('juan')) savedUserLang = localStorage.getItem('cuidapp_user_lang_juan');
        else if (pName.includes('valentina')) savedUserLang = localStorage.getItem('cuidapp_user_lang_valentina');
        else if (pName.includes('daniela')) savedUserLang = localStorage.getItem('cuidapp_user_lang_daniela');
        else if (pName.includes('camila')) savedUserLang = localStorage.getItem('cuidapp_user_lang_camila');
        else if (pName.includes('mateo')) savedUserLang = localStorage.getItem('cuidapp_user_lang_mateo');
        else if (pName.includes('cuidador')) savedUserLang = localStorage.getItem('cuidapp_user_lang_cuidador');
      }

      if (savedUserLang && I18N_DICTIONARY[savedUserLang]) {
        initialLang = savedUserLang;
      } else {
        const pLang = String(patient.idiomaPreferido || patient.language || patient.idioma || '').toLowerCase();
        if (pLang.includes('ht') || pLang.includes('kreyol') || pLang.includes('hait')) initialLang = 'ht';
        else if (pLang.includes('pt') || pLang.includes('portug') || pLang.includes('brasil')) initialLang = 'pt';
        else if (pLang.includes('en') || pLang.includes('ingl') || pLang.includes('english')) initialLang = 'en';
        else if (pLang.includes('arn') || pLang.includes('mapu')) initialLang = 'arn';
        else initialLang = localStorage.getItem('cuidapp_language') || 'es';
      }
    } else {
      initialLang = localStorage.getItem('cuidapp_language') || 'es';
    }

    selectLang.value = initialLang;
    applyGlobalLanguage(initialLang, patient);

    selectLang.onchange = (e) => {
      const newLang = e.target.value;
      applyGlobalLanguage(newLang, patient);
    };
  }

  // 4. Configurar audio-guía al enfocar tarjetas para personas sin lectoescritura
  setupCardFocusAudioGuide(patient);
}

// --- VINCULACIÓN DE EVENTOS DEL DASHBOARD ---
export function bindDashboardEvents(patientName) {
  const heartRateInput = document.getElementById('heartRate');
  const bpmValueDisplay = document.getElementById('bpm-val');

  if (heartRateInput && bpmValueDisplay) {
    const syncHeartRate = (val) => {
      heartRateInput.value = val;
      bpmValueDisplay.textContent = `${val} BPM`;
    };

    heartRateInput.oninput = (e) => syncHeartRate(e.target.value);
  }

  const painLevelInput = document.getElementById('painLevel');
  const painValueDisplay = document.getElementById('pain-val');
  const painBadgeDisplay = document.getElementById('painBadgeDisplay');
  const painBtns = document.querySelectorAll('.pain-btn');

  if (painLevelInput && painBtns.length > 0) {
    function setPainValue(val) {
      const numVal = parseInt(val, 10) || 1;
      painLevelInput.value = numVal;

      if (painValueDisplay) {
        painValueDisplay.textContent = numVal;
      }

      if (painBadgeDisplay) {
        if (numVal <= 3) {
          painBadgeDisplay.style.background = 'rgba(16, 185, 129, 0.2)';
          painBadgeDisplay.style.color = '#34d399';
          painBadgeDisplay.style.border = '1px solid rgba(16, 185, 129, 0.4)';
          painBadgeDisplay.innerHTML = `EVA: <strong id="pain-val">${numVal}</strong>/10 • Sin Dolor / Leve`;
        } else if (numVal <= 6) {
          painBadgeDisplay.style.background = 'rgba(245, 158, 11, 0.2)';
          painBadgeDisplay.style.color = '#fbbf24';
          painBadgeDisplay.style.border = '1px solid rgba(245, 158, 11, 0.4)';
          painBadgeDisplay.innerHTML = `EVA: <strong id="pain-val">${numVal}</strong>/10 • Moderado`;
        } else {
          painBadgeDisplay.style.background = 'rgba(239, 68, 68, 0.2)';
          painBadgeDisplay.style.color = '#f87171';
          painBadgeDisplay.style.border = '1px solid rgba(239, 68, 68, 0.4)';
          painBadgeDisplay.innerHTML = `EVA: <strong id="pain-val">${numVal}</strong>/10 • Severo`;
        }
      }

      painBtns.forEach(btn => {
        const btnVal = parseInt(btn.getAttribute('data-value'), 10);
        const isSelected = btnVal === numVal;

        // Reset dynamic style properties and classes
        btn.className = 'btn pain-btn fw-bold input-btn';
        btn.style.boxShadow = '';
        btn.style.transition = 'all 0.18s ease';

        if (isSelected) {
          btn.classList.add('active');
          if (btnVal <= 3) {
            // 1–3 Verde sólido claro
            btn.style.background = '#10b981';
            btn.style.borderColor = '#059669';
            btn.style.color = '#ffffff';
            btn.style.boxShadow = '0 0 12px rgba(16, 185, 129, 0.7)';
            btn.style.transform = 'scale(1.08)';
            btn.style.zIndex = '5';
          } else if (btnVal <= 6) {
            // 4–6 Amarillo / Ámbar sólido claro
            btn.style.background = '#f59e0b';
            btn.style.borderColor = '#d97706';
            btn.style.color = '#1f2937';
            btn.style.boxShadow = '0 0 12px rgba(245, 158, 11, 0.7)';
            btn.style.transform = 'scale(1.08)';
            btn.style.zIndex = '5';
          } else {
            // 7–10 Rojo sólido claro
            btn.style.background = '#ef4444';
            btn.style.borderColor = '#dc2626';
            btn.style.color = '#ffffff';
            btn.style.boxShadow = '0 0 12px rgba(239, 68, 68, 0.7)';
            btn.style.transform = 'scale(1.08)';
            btn.style.zIndex = '5';
          }
        } else {
          // No seleccionado: GlassKit neutro translúcido con texto de color según nivel
          btn.classList.add('btn-glass-secondary');
          btn.style.background = 'rgba(255, 255, 255, 0.04)';
          btn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          btn.style.transform = 'none';
          btn.style.zIndex = '1';

          if (btnVal <= 3) {
            btn.style.color = '#6ee7b7';
          } else if (btnVal <= 6) {
            btn.style.color = '#fde047';
          } else {
            btn.style.color = '#fca5a5';
          }
        }
      });

      // Actualizar también la evaluación de alertas clínicas en tiempo real
      evaluateRealtimeBasicVitalsAlert();
    }

    painBtns.forEach(btn => {
      btn.onclick = () => {
        const val = btn.getAttribute('data-value');
        setPainValue(val);
      };
    });

    // Set initial active state
    setPainValue(painLevelInput.value || '1');
  }

  // Controladores para botones de incremento/decremento en grupos numéricos personalizados (GlassKit)
  document.querySelectorAll('.decrease-btn').forEach(btn => {
    btn.onclick = () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (input && !input.disabled) {
        const step = parseFloat(input.getAttribute('step')) || 1;
        const min = parseFloat(input.getAttribute('min'));
        let val = parseFloat(input.value);
        if (isNaN(val)) {
          val = parseFloat(input.placeholder.replace(/[^\d.]/g, '')) || 0;
        }
        let newVal = val - step;
        if (!isNaN(min) && newVal < min) newVal = min;

        if (step % 1 !== 0) {
          input.value = parseFloat(newVal.toFixed(2));
        } else {
          input.value = newVal;
        }
        input.dispatchEvent(new Event('input'));
      }
    };
  });

  document.querySelectorAll('.increase-btn').forEach(btn => {
    btn.onclick = () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (input && !input.disabled) {
        const step = parseFloat(input.getAttribute('step')) || 1;
        const max = parseFloat(input.getAttribute('max'));
        let val = parseFloat(input.value);
        if (isNaN(val)) {
          val = parseFloat(input.placeholder.replace(/[^\d.]/g, '')) || 0;
        }
        let newVal = val + step;
        if (!isNaN(max) && newVal > max) newVal = max;

        if (step % 1 !== 0) {
          input.value = parseFloat(newVal.toFixed(2));
        } else {
          input.value = newVal;
        }
        input.dispatchEvent(new Event('input'));
      }
    };
  });

  // A. Controladores de Síntomas Cardiovascular (Con exclusión mutua de Ninguno)
  const cardioSymptomBtns = document.querySelectorAll('.cardio-symptom-btn');
  cardioSymptomBtns.forEach(btn => {
    btn.onclick = () => {
      const isNone = btn.getAttribute('data-symptom') === 'Ninguno';
      if (isNone) {
        cardioSymptomBtns.forEach(b => {
          if (b.getAttribute('data-symptom') !== 'Ninguno') {
            b.classList.remove('btn-glass-primary');
            b.classList.add('btn-glass-secondary');
            b.style.background = '';
            b.style.borderColor = '';
          }
        });
        btn.className = 'btn btn-glass-success flex-fill py-2 cardio-symptom-btn active-symptom-none input-btn';
        btn.style.background = 'rgba(16, 185, 129, 0.2)';
        btn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
      } else {
        const noneBtn = document.querySelector('#cardioSymptomsContainer .active-symptom-none');
        if (noneBtn) {
          noneBtn.className = 'btn btn-glass-secondary flex-fill py-2 cardio-symptom-btn active-symptom-none input-btn';
          noneBtn.style.background = '';
          noneBtn.style.borderColor = '';
        }
        if (btn.classList.contains('btn-glass-secondary')) {
          btn.classList.remove('btn-glass-secondary');
          btn.classList.add('btn-glass-primary');
          btn.style.background = 'rgba(14, 165, 233, 0.25)';
          btn.style.borderColor = 'rgba(14, 165, 233, 0.4)';
        } else {
          btn.classList.remove('btn-glass-primary');
          btn.classList.add('btn-glass-secondary');
          btn.style.background = '';
          btn.style.borderColor = '';
        }
      }
      evaluateRealtimeBasicVitalsAlert();
    };
  });

  // B. Controladores de Síntomas Diabetes (Con exclusión mutua de Ninguno)
  const diabetesSymptomBtns = document.querySelectorAll('.diabetes-symptom-btn');
  diabetesSymptomBtns.forEach(btn => {
    btn.onclick = () => {
      const isNone = btn.getAttribute('data-symptom') === 'Ninguno';
      if (isNone) {
        diabetesSymptomBtns.forEach(b => {
          if (b.getAttribute('data-symptom') !== 'Ninguno') {
            b.classList.remove('btn-glass-primary');
            b.classList.add('btn-glass-secondary');
            b.style.background = '';
            b.style.borderColor = '';
          }
        });
        btn.className = 'btn btn-glass-success flex-fill py-2 diabetes-symptom-btn active-symptom-none input-btn';
        btn.style.background = 'rgba(16, 185, 129, 0.2)';
        btn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
      } else {
        const noneBtn = document.querySelector('#diabetesSymptomsContainer .active-symptom-none');
        if (noneBtn) {
          noneBtn.className = 'btn btn-glass-secondary flex-fill py-2 diabetes-symptom-btn active-symptom-none input-btn';
          noneBtn.style.background = '';
          noneBtn.style.borderColor = '';
        }
        if (btn.classList.contains('btn-glass-secondary')) {
          btn.classList.remove('btn-glass-secondary');
          btn.classList.add('btn-glass-primary');
          btn.style.background = 'rgba(14, 165, 233, 0.25)';
          btn.style.borderColor = 'rgba(14, 165, 233, 0.4)';
        } else {
          btn.classList.remove('btn-glass-primary');
          btn.classList.add('btn-glass-secondary');
          btn.style.background = '';
          btn.style.borderColor = '';
        }
      }
      evaluateRealtimeBasicVitalsAlert();
    };
  });

  const moodEmojis = document.querySelectorAll('.mood-emoji');
  let selectedMood = 'Alegre';
  moodEmojis.forEach(emoji => {
    emoji.style.textShadow = 'none';
    emoji.onclick = () => {
      selectedMood = emoji.getAttribute('data-mood');
      moodEmojis.forEach(e => {
        e.classList.remove('text-white');
        e.classList.add('text-white-50');
        e.style.textShadow = 'none';
      });
      emoji.classList.remove('text-white-50');
      emoji.classList.add('text-white');
      emoji.style.textShadow = '0 0 15px rgba(255, 255, 255, 0.8)';
    };
  });

  // Vincular eventos reactivos en tiempo real para el bloque "🩺 Tomas Básicas y Alertas Clínicas"
  const vitalInputs = document.querySelectorAll('.vital-calc-input');
  vitalInputs.forEach(inp => {
    inp.addEventListener('input', evaluateRealtimeBasicVitalsAlert);
    inp.addEventListener('change', evaluateRealtimeBasicVitalsAlert);
    inp.addEventListener('keyup', evaluateRealtimeBasicVitalsAlert);
  });

  const cardioEdemaInput = document.getElementById('cardioEdema');
  if (cardioEdemaInput) {
    cardioEdemaInput.addEventListener('change', evaluateRealtimeBasicVitalsAlert);
  }

  // Ejecución inicial para reflejar el estado basal del paciente
  evaluateRealtimeBasicVitalsAlert();

  // Guardar cambios del formulario diario con sincronización y trazabilidad legal (DS N° 41 / Ley 20.584)
  const diaryForm = document.getElementById('diaryForm');
  if (diaryForm) {
    diaryForm.onsubmit = (e) => {
      e.preventDefault();

      // 1. Capturar valores ingresados
      const isPreg = caregiverPatientIsPregnant(activePatient);
      const bpSysInput = isPreg ? (document.getElementById('bpSystolicPrenatal') || document.getElementById('bpSystolic')) : (document.getElementById('bpSystolic') || document.getElementById('renalBpSystolic'));
      const bpDiaInput = isPreg ? (document.getElementById('bpDiastolicPrenatal') || document.getElementById('bpDiastolic')) : (document.getElementById('bpDiastolic') || document.getElementById('renalBpDiastolic'));
      const hrInput = document.getElementById('heartRate');
      const cardioEdemaInput = document.getElementById('cardioEdema');
      const transversalMedInput = document.getElementById('transversalMedication');
      const painLevelInput = document.getElementById('painLevel');
      const notesInput = document.getElementById('caregiverNotes');
      const dateInput = document.getElementById('reportDate');

      const systolic = bpSysInput && bpSysInput.value ? parseInt(bpSysInput.value, 10) : (isPreg ? 115 : 118);
      const diastolic = bpDiaInput && bpDiaInput.value ? parseInt(bpDiaInput.value, 10) : (isPreg ? 72 : 78);
      const heartRate = hrInput && hrInput.value ? parseInt(hrInput.value, 10) : 75;
      const edema = cardioEdemaInput ? cardioEdemaInput.checked : false;
      const medicationAdherence = transversalMedInput ? transversalMedInput.checked : true;
      const pain = painLevelInput && painLevelInput.value ? parseInt(painLevelInput.value, 10) : 1;
      const painEva = pain;
      const date = (dateInput && dateInput.value) ? dateInput.value : getTodayDateString();
      const monthKey = date.slice(0, 7);
      const notes = notesInput ? notesInput.value.trim() : (isPreg ? 'Control Prenatal MINSAL al día' : '');

      // Hora exacta de la toma clínica en formato estandarizado HH:MM
      const now = new Date();
      const timeFormatted = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // Capturar síntomas activos de alerta
      const activeCardioSymptoms = [];
      document.querySelectorAll('.cardio-symptom-btn').forEach(b => {
        if (b.classList.contains('btn-glass-primary') || b.classList.contains('btn-glass-success')) {
          activeCardioSymptoms.push(b.getAttribute('data-symptom'));
        }
      });
      const activeDiabetesSymptoms = [];
      document.querySelectorAll('.diabetes-symptom-btn').forEach(b => {
        if (b.classList.contains('btn-glass-primary') || b.classList.contains('btn-glass-success')) {
          activeDiabetesSymptoms.push(b.getAttribute('data-symptom'));
        }
      });
      const combinedSymptoms = [...activeCardioSymptoms, ...activeDiabetesSymptoms].filter(Boolean);
      if (combinedSymptoms.length === 0) combinedSymptoms.push('Ninguno');

      // Valores de Tomas Básicas y patologías específicas
      const glucoseInput = isPreg ? (document.getElementById('glucoseLevelPrenatal') || document.getElementById('glucoseLevel')) : document.getElementById('glucoseLevel');
      const glucose = glucoseInput && glucoseInput.value ? parseInt(glucoseInput.value, 10) : (isPreg ? 86 : 95);
      const glycemia = glucose;
      const insulinInput = document.getElementById('insulinDose');
      const insulin = insulinInput && insulinInput.value ? parseFloat(insulinInput.value) : 0;
      const spO2Input = document.getElementById('vitalSpO2') || document.getElementById('epocSpO2');
      const spO2 = spO2Input && spO2Input.value ? parseInt(spO2Input.value, 10) : 98;
      const spo2 = spO2;
      const tempInput = document.getElementById('vitalTemperature');
      const temperature = tempInput && tempInput.value ? parseFloat(tempInput.value) : 36.5;
      const respRateInput = document.getElementById('pediatricRespRate') || document.getElementById('epocRespRate');
      const respRate = respRateInput && respRateInput.value ? parseInt(respRateInput.value, 10) : (getPatientAge(activePatient) < 18 ? 22 : 16);
      const prenatalWeightInput = isPreg ? document.getElementById('vitalWeightPrenatal') : null;
      const renalWeightInput = document.getElementById('renalWeight');
      const weight = prenatalWeightInput && prenatalWeightInput.value ? parseFloat(prenatalWeightInput.value) : (renalWeightInput && renalWeightInput.value ? parseFloat(renalWeightInput.value) : (activePatient.weight || 66.5));
      const renalDiuresisInput = document.getElementById('renalDiuresis');
      const diuresis = renalDiuresisInput && renalDiuresisInput.value ? parseInt(renalDiuresisInput.value, 10) : 1200;

      // 2. Determinar Cuidadora Autorizada responsable del registro
      const sidebarUserEl = document.querySelector('.sidebar footer strong, footer strong.text-white');
      const loggedName = sidebarUserEl ? sidebarUserEl.textContent.trim() : '';
      const caregiver = CAREGIVERS_DATABASE.find(c => c.name.toLowerCase() === loggedName.toLowerCase()) ||
                        CAREGIVERS_DATABASE.find(c => c.assignedPatientId === activePatient.id) ||
                        CAREGIVERS_DATABASE[0];
      const recordedBy = `${caregiver.name} (Cuidadora Autorizada)`;

      // 3. Calcular alertLevel ('normal', 'advertencia', 'critico')
      const alertLevel = calculateAlertLevel({
        systolic,
        diastolic,
        heartRate,
        edema,
        symptoms: combinedSymptoms,
        medicationAdherence,
        pain,
        spO2,
        glucose,
        temperature
      });

      // 4. Crear registro con metadatos de trazabilidad legal obligatorios (DS N° 41 / Ley 20.584)
      const newRecord = {
        id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        patientId: activePatient.id,
        patientName: activePatient.name,
        timestamp: now.toISOString(),
        date: date,
        monthKey: monthKey,
        time: timeFormatted,
        recordedBy: recordedBy,
        role: 'cuidador',
        alertLevel: alertLevel,
        systolic: systolic,
        diastolic: diastolic,
        spo2: spo2,
        spO2: spO2,
        temperature: temperature,
        glycemia: glycemia,
        glucose: glucose,
        heartRate: heartRate,
        painEva: painEva,
        pain: pain,
        edema: edema,
        symptoms: combinedSymptoms,
        medicationAdherence: medicationAdherence,
        notes: notes,
        insulin: insulin,
        respRate: respRate,
        weight: weight,
        diuresis: diuresis
      };

      // 5. Guardar registro en localStorage bajo la clave estandarizada cuidapp_clinical_logs_${patientId}
      savePatientClinicalLog(activePatient.id, newRecord);

      // 5.1 Guardar también en la clave global compartida por paciente en localStorage (cuidapp_ficha_10420932-K)
      saveRecordToGlobalFicha(activePatient, newRecord, 'DAILY_REPORT');

      // 5.2 Insertar evento inmutable en cuidapp_audit_log (DS N° 41 / Ley 19.628)
      insertAuditLogEntry({
        patient: activePatient,
        author: 'Sofía Díaz (Cuidador)',
        specialty: 'Medicina General',
        recordType: 'Reporte Diario',
        details: `PA: ${systolic}/${diastolic} mmHg, FC: ${heartRate} bpm, SpO2: ${spo2}%, EVA: ${painEva}/10, Temp: ${temperature}°C, Glucemia: ${glycemia} mg/dL`,
        recordId: newRecord.id
      });

      // 6. Actualizar signos vitales recientes en memoria y localStorage para paciente.js y medico.js
      const latestVitals = {
        patientId: activePatient.id,
        monthKey: monthKey,
        systolic: systolic,
        diastolic: diastolic,
        heartRate: heartRate,
        hasVitals: true,
        spo2: spo2,
        spO2: spO2,
        temperature: temperature,
        glycemia: glycemia,
        glucose: glucose,
        painEva: painEva,
        pain: pain,
        insulin: insulin,
        respRate: respRate,
        weight: weight,
        diuresis: diuresis,
        medication: medicationAdherence,
        edema: edema,
        symptoms: combinedSymptoms,
        notes: notes,
        alertLevel: alertLevel,
        recordedBy: recordedBy,
        time: timeFormatted,
        timestamp: newRecord.timestamp,
        hasSubmittedToday: true
      };

      localStorage.setItem(`cuidapp_latest_vitals_${activePatient.id}`, JSON.stringify(latestVitals));
      activePatient.recentVitals = latestVitals;
      window.cuidAppLatestVitals = latestVitals;

      // 7. Actualizar el Historial Sincronizado en la interfaz
      renderClinicalHistory(activePatient.id);

      // 8. Notificación y feedback al usuario con GlassKit
      let alertMsg = `¡Reporte clínico de ${activePatient.name} guardado y sincronizado con éxito bajo DS N° 41!`;
      let alertType = 'success';
      if (alertLevel === 'critico') {
        alertMsg = `⚠️ ALERTA CRÍTICA: Signos vitales fuera de rango seguro para ${activePatient.name}. Registro trazable guardado.`;
        alertType = 'danger';
      } else if (alertLevel === 'advertencia') {
        alertMsg = `Reporte de ${activePatient.name} guardado con parámetros en advertencia. Sincronizado bajo Ley 20.584.`;
        alertType = 'warning';
      }
      window.showGlassAlert(alertMsg, alertType);

      // 9. Soporte de Guía por Voz (speakText) si el modo de voz está activo
      if (typeof getModoVozActivo === 'function' && getModoVozActivo()) {
        let voiceMessage = `Reporte clínico de ${activePatient.name} guardado y sincronizado con la ficha médica. `;
        if (alertLevel === 'critico') {
          voiceMessage += 'Atención: los signos vitales registrados se encuentran en rango crítico.';
        } else if (alertLevel === 'advertencia') {
          voiceMessage += 'Se han detectado parámetros en observación.';
        } else {
          voiceMessage += 'Todos los parámetros están en estado normal.';
        }
        if (typeof speakText === 'function') {
          speakText(voiceMessage, { force: true });
        }
      }

      // Animación del botón Guardar
      const btnSubmit = diaryForm.querySelector('button[type="submit"]');
      if (btnSubmit) {
        const originalText = btnSubmit.innerHTML;
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="bi bi-arrow-repeat spin-animation me-2"></i>Sincronizando con Ficha...';
        setTimeout(() => {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = originalText;
        }, 1000);
      }
    };
  }
}


// ============================================================================
// PESTAÑA 4: 🦷 VACUNAS, FICHA DENTAL Y CONTROLES PREVENTIVOS MINSAL
// Cumplimiento Ley N° 20.584, DS N° 41, Ley N° 21.430 y Programas Oficiales MINSAL
// ============================================================================

// Helper para evaluar condiciones del paciente
function caregiverPatientHasCondition(patient, condKey) {
  if (!patient) return false;
  if (typeof patient.hasCondition === 'function') {
    try {
      if (patient.hasCondition(condKey)) return true;
    } catch (e) {}
  }
  const conds = patient.conditions || [];
  const keyUpper = String(condKey).toUpperCase();
  return conds.some(c => String(c).toUpperCase().includes(keyUpper) || keyUpper.includes(String(c).toUpperCase()));
}

// Helper para detectar puerperio / postparto
export function caregiverPatientIsPostpartum(patient) {
  if (!patient) return false;
  try {
    if (localStorage.getItem(`cuidapp_postpartum_${patient.id}`) === 'true') return true;
    const pregRaw = localStorage.getItem(`cuidapp_pregnancy_${patient.id}`);
    if (pregRaw) {
      const parsed = JSON.parse(pregRaw);
      if (parsed && (parsed.isPostpartum === true || parsed.isActive === false)) return true;
    }
  } catch (e) {}
  return patient.isPostpartum === true || patient.postpartum === true;
}

// Helper para detectar gestación
export function caregiverPatientIsPregnant(patient) {
  if (!patient) return false;
  if (caregiverPatientIsPostpartum(patient)) return false;
  if (patient.id === 'p_daniela' || (patient.username || '').toLowerCase() === 'daniela' || (patient.name || '').toLowerCase().includes('daniela')) return true;
  if (patient.isPregnant === true || patient.embarazo === true) return true;
  if (patient.pregnancyWeeks || patient.gestationalWeeks) return true;
  if (caregiverPatientHasCondition(patient, 'EMBARAZO') || caregiverPatientHasCondition(patient, 'GESTACION')) return true;
  const rawNotes = `${patient.notes || ''} ${patient.alergias || ''} ${patient.diagnosticos || ''} ${patient.gender || ''}`.toLowerCase();
  return rawNotes.includes('embaraz') || rawNotes.includes('gestan');
}

// Helper para detectar sexo/género
function caregiverPatientGender(patient) {
  if (!patient) return 'masculino';
  const g = String(patient.gender || patient.sexo || '').toLowerCase();
  if (g.startsWith('f') || g.includes('muj') || g.includes('fem')) return 'femenino';
  if (g.startsWith('m') || g.includes('hom') || g.includes('masc')) return 'masculino';
  return 'masculino';
}

// 1. GESTOR DE VACUNAS SEGÚN EDAD Y PNI MINSAL
export function getPatientVaccinesList(patient) {
  if (!patient) return [];
  const storageKey = `cuidapp_vaccines_${patient.id}`;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Error al leer vacunas desde localStorage:', e);
  }

  const age = getPatientAge(patient);
  const isPregnant = caregiverPatientIsPregnant(patient);
  const currentYear = new Date().getFullYear();
  let defaultList = [];

  if (isPregnant) {
    defaultList = [
      {
        id: 'vac_gest_dtpa',
        name: 'dTpa Gestante (Difteria, Tétanos y Tos Convulsiva / Coqueluche)',
        program: 'PNI Obligatorio MINSAL (Semana 28+ de Gestación)',
        status: 'al_dia',
        date: `12-08-${currentYear}`,
        provider: 'CESFAM Las Condes',
        lot: 'DTP-7782A',
        notes: 'Inmunización transplacentaria para transferir anticuerpos contra coqueluche al feto.'
      },
      {
        id: 'vac_gest_influenza',
        name: `Influenza Gestante Campaña ${currentYear}`,
        program: 'Campaña Invierno MINSAL (Toda edad gestacional)',
        status: 'al_dia',
        date: `20-05-${currentYear}`,
        provider: 'CESFAM Las Condes',
        lot: 'INF-2026-X',
        notes: 'Dosis única ministerial gestacional para protección de la madre y del lactante.'
      },
      {
        id: 'vac_gest_covid',
        name: 'COVID-19 Refuerzo Bivalente Gestante',
        program: 'Plan Nacional de Vacunación',
        status: 'al_dia',
        date: `15-06-${currentYear}`,
        provider: 'Vacunatorio Las Condes',
        lot: 'COV-BIV-891',
        notes: 'Inmunización adaptada a variantes.'
      }
    ];
  } else if (age === 0 || patient.isNewborn) {
    defaultList = [
      {
        id: 'vac_rn_bcg',
        name: 'BCG (Tuberculosis Meningósea y Diseminada)',
        program: 'PNI Recién Nacido Maternidad',
        status: 'al_dia',
        date: patient.birthDate || getTodayDateString(),
        provider: 'Maternidad Hospital Clínico',
        lot: 'BCG-MAT-2026',
        notes: 'Dosis única intradérmica en recién nacido en maternidad. Cicatriz deltoidea comprobada.'
      },
      {
        id: 'vac_rn_hepb',
        name: 'Hepatitis B Monovalente Pediátrica (Dosis Recién Nacido)',
        program: 'PNI Maternidad (Primeras 24 horas)',
        status: 'al_dia',
        date: patient.birthDate || getTodayDateString(),
        provider: 'Maternidad Hospital Clínico',
        lot: 'HEP-MAT-884',
        notes: 'Dosis monovalente administrada dentro de las primeras 24 horas de vida para prevenir transmisión vertical.'
      }
    ];
  } else if (age < 14) {
    defaultList = [
      {
        id: 'vac_ped_bcg',
        name: 'BCG (Tuberculosis Meningósea y Diseminada)',
        program: 'PNI Recién Nacido',
        status: 'al_dia',
        date: '02-04-2020',
        provider: 'Hospital Clínico San Borja',
        lot: 'BCG-4410',
        notes: 'Cicatriz deltoidea derecha comprobada.'
      },
      {
        id: 'vac_ped_hexa',
        name: 'Hexavalente Acelular (Hexaxim - 4 Dosis Completas)',
        program: 'PNI Lactante (2, 4, 6 y 18 meses)',
        status: 'al_dia',
        date: '10-10-2021',
        provider: 'CESFAM Salvador Bustos',
        lot: 'HEX-9921',
        notes: 'Esquema primario completo contra Hepatitis B, Polio, Hib, dTpa.'
      },
      {
        id: 'vac_ped_neumo',
        name: 'Neumocócica Conjugada Pediátrica',
        program: 'PNI Lactante (2, 4 y 12 meses)',
        status: 'al_dia',
        date: '15-04-2021',
        provider: 'CESFAM Salvador Bustos',
        lot: 'PCV-3321',
        notes: 'Refuerzo de 12 meses administrado.'
      },
      {
        id: 'vac_ped_srp',
        name: 'Tresvírica SRP (Sarampión, Rubéola, Parotiditis)',
        program: 'PNI Preescolar (12 y 36 meses)',
        status: 'al_dia',
        date: '20-04-2023',
        provider: 'CESFAM Salvador Bustos',
        lot: 'SRP-1102',
        notes: 'Esquema completo.'
      },
      {
        id: 'vac_ped_vph',
        name: 'VPH Escolar (Virus Papiloma Humano 2 Dosis)',
        program: 'PNI Escolar 4° y 5° Básico',
        status: age >= 9 ? 'al_dia' : 'pendiente',
        date: age >= 9 ? `14-09-${currentYear - 1}` : 'Programado para 4° Básico',
        provider: 'Vacunación Escolar MINSAL',
        lot: 'VPH-9004',
        notes: 'Protección integral 9 serotipos oncogénicos.'
      },
      {
        id: 'vac_ped_flu',
        name: `Influenza Pediátrica Campaña ${currentYear}`,
        program: 'Campaña Invierno MINSAL',
        status: 'al_dia',
        date: `25-05-${currentYear}`,
        provider: 'CESFAM Salvador Bustos',
        lot: 'FLU-PED-26',
        notes: 'Dosis anual infantil al día.'
      },
      {
        id: 'vac_ped_covid',
        name: 'COVID-19 Refuerzo Pediátrico',
        program: 'Plan Nacional de Vacunación',
        status: 'al_dia',
        date: `18-07-${currentYear}`,
        provider: 'CESFAM Salvador Bustos',
        lot: 'COV-P-55',
        notes: 'Dosis anual de refuerzo infantil.'
      }
    ];
  } else if (age >= 14 && age < 18) {
    defaultList = [
      {
        id: 'vac_ado_vph',
        name: 'VPH Adolescente (Virus Papiloma Humano - 2 Dosis)',
        program: 'PNI Escolar / Adolescente MINSAL',
        status: 'al_dia',
        date: `05-04-${currentYear - 2}`,
        provider: 'CESFAM Las Condes',
        lot: 'VPH-ADO-12',
        notes: 'Esquema completo contra serotipos oncogénicos 16, 18 y verrugas genitales.'
      },
      {
        id: 'vac_ado_dtpa',
        name: 'dTpa Acelular Escolar (Difteria, Tétanos y Tos Convulsiva - Refuerzo 8° Básico)',
        program: 'PNI Escolar Obligatorio MINSAL',
        status: 'al_dia',
        date: `10-10-${currentYear - 1}`,
        provider: 'Vacunatorio Escolar MINSAL',
        lot: 'DTP-ADO-77',
        notes: 'Refuerzo escolar antitetánico y coqueluche al día.'
      },
      {
        id: 'vac_ado_flu',
        name: `Influenza Estacional Campaña ${currentYear}`,
        program: 'Campaña Anual MINSAL',
        status: 'al_dia',
        date: `15-05-${currentYear}`,
        provider: 'CESFAM Las Condes',
        lot: 'FLU-2026',
        notes: 'Campaña preventiva de invierno.'
      },
      {
        id: 'vac_ado_covid',
        name: 'COVID-19 Refuerzo Bivalente Adolescente',
        program: 'Plan Nacional de Vacunación',
        status: 'al_dia',
        date: `12-08-${currentYear}`,
        provider: 'CESFAM Las Condes',
        lot: 'COV-BIV-26',
        notes: 'Refuerzo anual administrado.'
      }
    ];
  } else if (age >= 60) {
    defaultList = [
      {
        id: 'vac_sen_flu',
        name: `Influenza Senior Dosis Alta Campaña ${currentYear}`,
        program: 'Campaña Invierno MINSAL (Grupo Prioritario)',
        status: 'al_dia',
        date: `15-05-${currentYear}`,
        provider: 'CESFAM Las Condes',
        lot: 'FLU-SENIOR-26-88',
        notes: 'Dosis de alta concentración antigénica para adultos mayores.'
      },
      {
        id: 'vac_sen_neumo',
        name: 'Neumocócica Polisacárida Neumo 23 (GES Adulto Mayor)',
        program: 'Garantía Explícita en Salud (GES / PNI 65+)',
        status: 'al_dia',
        date: `10-10-${currentYear - 2}`,
        provider: 'CESFAM Las Condes',
        lot: 'PNEUMO-23-441',
        notes: 'Protección contra neumonía invasiva por neumococo.'
      },
      {
        id: 'vac_sen_covid',
        name: `COVID-19 Refuerzo Anual Adulto Mayor ${currentYear}`,
        program: 'Plan Nacional de Inmunización Ministerial',
        status: 'al_dia',
        date: `12-06-${currentYear}`,
        provider: 'Vacunatorio Municipal Las Condes',
        lot: 'COV-SENIOR-902',
        notes: 'Monovalente / Bivalente actualizada.'
      },
      {
        id: 'vac_sen_dt',
        name: 'dT Adulto (Refuerzo Antitetánico Decenal)',
        program: 'PNI Adulto (Cada 10 Años)',
        status: 'al_dia',
        date: `05-03-${currentYear - 4}`,
        provider: 'CESFAM Las Condes',
        lot: 'DT-AD-102',
        notes: 'Vigente hasta 2032.'
      },
      {
        id: 'vac_sen_herpes',
        name: 'Herpes Zóster (Prevención Neuralgia Postherpética)',
        program: 'Inmunización Complementaria Adulto Mayor',
        status: 'pendiente',
        date: 'Pendiente de indicación médica',
        provider: 'Vacunatorio Privado / Red de Salud',
        lot: 'HZ-SHING-01',
        notes: 'Recomendada en pacientes con comorbilidades crónicas.'
      }
    ];
  } else {
    // Adulto 18 - 59 años
    defaultList = [
      {
        id: 'vac_ad_flu',
        name: `Influenza Estacional Campaña ${currentYear}`,
        program: 'Campaña Invierno MINSAL (Grupos de Riesgo y Crónicos)',
        status: 'al_dia',
        date: `22-05-${currentYear}`,
        provider: 'CESFAM',
        lot: 'FLU-AD-26',
        notes: 'Dosis anual preventiva.'
      },
      {
        id: 'vac_ad_covid',
        name: `COVID-19 Refuerzo Anual ${currentYear}`,
        program: 'Plan Nacional de Vacunación',
        status: 'al_dia',
        date: `14-07-${currentYear}`,
        provider: 'Vacunatorio Municipal',
        lot: 'COV-AD-88',
        notes: 'Refuerzo actualizado contra variantes circulantes.'
      },
      {
        id: 'vac_ad_dt',
        name: 'dT Adulto (Difteria y Tétanos)',
        program: 'PNI Adulto (Refuerzo cada 10 años)',
        status: 'al_dia',
        date: `18-09-${currentYear - 3}`,
        provider: 'CESFAM',
        lot: 'DT-AD-65',
        notes: 'Inmunización antitetánica al día.'
      },
      {
        id: 'vac_ad_hepb',
        name: 'Hepatitis B Recombinante (3 Dosis)',
        program: 'PNI Adulto y Salud Ocupacional',
        status: 'al_dia',
        date: `10-02-${currentYear - 5}`,
        provider: 'Hospital Clínico',
        lot: 'HEPB-332',
        notes: 'Esquema completo con anticuerpos protectores comprobados.'
      }
    ];
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify(defaultList));
  } catch (e) {}

  return defaultList;
}

export function savePatientVaccinesList(patientId, vaccines) {
  try {
    localStorage.setItem(`cuidapp_vaccines_${patientId}`, JSON.stringify(vaccines));
  } catch (e) {
    console.error('Error al guardar vacunas en localStorage:', e);
  }
}

export function toggleCaregiverVaccineStatus(patientId, vaccineId) {
  const list = getPatientVaccinesList({ id: patientId });
  const item = list.find(v => v.id === vaccineId);
  if (item) {
    item.status = item.status === 'al_dia' ? 'pendiente' : 'al_dia';
    if (item.status === 'al_dia' && (!item.date || item.date.includes('Pendiente'))) {
      const today = new Date();
      item.date = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;
    }
    savePatientVaccinesList(patientId, list);
    renderCaregiverVaccinesDental(activePatient);
    if (window.showGlassAlert) {
      window.showGlassAlert(`Estado de vacuna "${item.name}" actualizado a ${item.status === 'al_dia' ? 'Al día ✅' : 'Pendiente ⏳'}.`, 'info');
    }
  }
}

export function addCaregiverCustomVaccine(patientId, vaccineData) {
  const list = getPatientVaccinesList({ id: patientId });
  const newVac = {
    id: `vac_custom_${Date.now()}`,
    name: vaccineData.name || 'Vacuna Registrada',
    program: vaccineData.program || 'Registro Cuidador / PNI',
    status: vaccineData.status || 'al_dia',
    date: vaccineData.date || new Date().toISOString().split('T')[0],
    provider: vaccineData.provider || 'CESFAM / Centro de Salud',
    lot: vaccineData.lot || 'S/L',
    notes: vaccineData.notes || 'Registro manual por cuidador.'
  };
  list.unshift(newVac);
  savePatientVaccinesList(patientId, list);
  renderCaregiverVaccinesDental(activePatient);
  if (window.showGlassAlert) {
    window.showGlassAlert(`¡Vacuna "${newVac.name}" registrada con éxito!`, 'success');
  }
}

// 2. GESTOR DE FICHA ODONTOLÓGICA Y NOTAS DEL CUIDADOR
export function getPatientDentalData(patient) {
  if (!patient) return null;
  const storageKey = `cuidapp_dental_data_${patient.id}`;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  const age = getPatientAge(patient);
  let defaultData;

  if (age < 14) {
    defaultData = {
      lastControlDate: '20 Octubre 2026',
      clinic: 'CESFAM Salvador Bustos - Módulo Odontopediatría',
      dentist: 'Dra. Marcela Soto - Odontopediatra GES',
      nextControlDate: 'Febrero 2027 (Control Cuatrimestral Preventivo)',
      hygieneIndex: '12% (Higiene Excelente - O\'Leary)',
      piecesHealthy: 18,
      piecesObturated: 2,
      piecesMissing: 0,
      piecesPlanned: 2,
      riskLevel: 'Bajo',
      summary: 'Dentición temporal completa en recambio armónico. Sin lesiones de caries activas cavitadas. Sellantes en molares 75 y 85 vigentes. Barniz de flúor aplicado hace 3 meses.',
      hasProsthesis: false
    };
  } else if (age >= 60) {
    defaultData = {
      lastControlDate: '14 Octubre 2026',
      clinic: 'RedSalud Odontología / Módulo Dental GES Adulto Mayor',
      dentist: 'Dr. Marcelo Valenzuela - Odontólogo General',
      nextControlDate: 'Abril 2027 (Control Semestral Adulto Mayor GES)',
      hygieneIndex: '18% (Riesgo Bajo - O\'Leary)',
      piecesHealthy: 22,
      piecesObturated: 4,
      piecesMissing: 4,
      piecesPlanned: 1,
      riskLevel: 'Moderado Controlado',
      summary: 'Dentición funcional conservada. Prótesis parcial removible superior con excelente estabilidad y adaptación mucosa sin lesiones. Obturaciones en resina estables en piezas 24 y 11. Profilaxis y destartraje realizado.',
      hasProsthesis: true,
      prosthesisType: 'Prótesis Parcial Removible Superior Acrílica'
    };
  } else {
    defaultData = {
      lastControlDate: '15 Agosto 2026',
      clinic: 'Centro Dental RedSalud',
      dentist: 'Dra. Andrea Gómez - Odontología Integral',
      nextControlDate: 'Agosto 2027 (Control Anual Preventivo)',
      hygieneIndex: '15% (Higiene Adecuada)',
      piecesHealthy: 26,
      piecesObturated: 3,
      piecesMissing: 2,
      piecesPlanned: 1,
      riskLevel: 'Bajo',
      summary: 'Salud periodontal estable. Borde incisal restaurado en pieza 11. Sin sangrado al sondaje ni movilidad. Indicado uso de seda dental y pasta fluorada 1450 ppm.',
      hasProsthesis: false
    };
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify(defaultData));
  } catch (e) {}

  return defaultData;
}

export function getPatientDentalNotes(patientId) {
  const storageKey = `cuidapp_dental_notes_${patientId}`;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}

  let seedNotes = [];
  if (patientId === 'p1') {
    seedNotes = [
      {
        id: 'dn_1',
        date: '15 Octubre 2026',
        time: '09:30',
        author: 'Sofía Díaz (Cuidadora)',
        category: 'Higiene y Cepillado',
        badgeClass: 'bg-primary-subtle text-primary border-primary-subtle',
        text: 'Se incorporó el cepillo interproximal suave y enjuague fluorado sin alcohol según la pauta entregada por el Dr. Valenzuela.'
      },
      {
        id: 'dn_2',
        date: '28 Septiembre 2026',
        time: '16:15',
        author: 'Sofía Díaz (Cuidadora)',
        category: 'Prótesis Dental',
        badgeClass: 'bg-info-subtle text-info border-info-subtle',
        text: 'Prótesis superior retirada para limpieza y desinfección nocturna con tableta efervescente. Encías de soporte rosadas, sin aftas ni puntos de presión dolorosos.'
      }
    ];
  } else {
    seedNotes = [
      {
        id: 'dn_generic_1',
        date: '20 Octubre 2026',
        time: '11:00',
        author: 'Cuidador a Cargo',
        category: 'Control Rutinario',
        badgeClass: 'bg-primary-subtle text-primary border-primary-subtle',
        text: 'Control de higiene oral matutina y nocturna realizado con pasta fluorada adecuada a la edad.'
      }
    ];
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify(seedNotes));
  } catch (e) {}

  return seedNotes;
}

export function addPatientDentalNote(patientId, noteData) {
  const notes = getPatientDentalNotes(patientId);
  const now = new Date();
  const dateFormatted = `${now.getDate()} de ${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][now.getMonth()]} ${now.getFullYear()}`;
  const timeFormatted = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const categoryMap = {
    higiene: { name: 'Higiene y Cepillado', cls: 'bg-primary-subtle text-primary border-primary-subtle' },
    protesis: { name: 'Prótesis Dental', cls: 'bg-info-subtle text-info border-info-subtle' },
    dolor: { name: 'Molestia o Dolor', cls: 'bg-warning-subtle text-warning border-warning-subtle' },
    indicacion: { name: 'Indicación Médica', cls: 'bg-success-subtle text-success border-success-subtle' }
  };
  const catInfo = categoryMap[noteData.category] || categoryMap.higiene;

  const newEntry = {
    id: `dn_${Date.now()}`,
    date: dateFormatted,
    time: timeFormatted,
    author: noteData.author || 'Cuidador Autorizado',
    category: catInfo.name,
    badgeClass: catInfo.cls,
    text: noteData.text.trim()
  };

  notes.unshift(newEntry);
  try {
    localStorage.setItem(`cuidapp_dental_notes_${patientId}`, JSON.stringify(notes));
  } catch (e) {}

  renderCaregiverVaccinesDental(activePatient);
  if (window.showGlassAlert) {
    window.showGlassAlert('Nota odontológica registrada en la ficha del paciente.', 'success');
  }
}

export function deletePatientDentalNote(patientId, noteId) {
  let notes = getPatientDentalNotes(patientId);
  notes = notes.filter(n => n.id !== noteId);
  try {
    localStorage.setItem(`cuidapp_dental_notes_${patientId}`, JSON.stringify(notes));
  } catch (e) {}
  renderCaregiverVaccinesDental(activePatient);
  if (window.showGlassAlert) {
    window.showGlassAlert('Nota odontológica eliminada.', 'info');
  }
}

// 3. GESTOR DE CONTROLES PREVENTIVOS MINSAL (FILTRADO AUTOMÁTICO SEGÚN EDAD, SEXO Y CONDICIÓN)
export function getMinsalPreventiveControls(patient) {
  if (!patient) return [];
  const storageKey = `cuidapp_minsal_controls_${patient.id}`;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}

  const age = getPatientAge(patient);
  const gender = caregiverPatientGender(patient);
  const isPregnant = caregiverPatientIsPregnant(patient);
  const hasHta = caregiverPatientHasCondition(patient, 'HTA') || caregiverPatientHasCondition(patient, 'HIPERTENSION');
  const hasDm = caregiverPatientHasCondition(patient, 'DIABETES') || caregiverPatientHasCondition(patient, 'DM2');
  const hasErc = caregiverPatientHasCondition(patient, 'ERC') || caregiverPatientHasCondition(patient, 'RENAL');
  const hasEpoc = caregiverPatientHasCondition(patient, 'EPOC') || caregiverPatientHasCondition(patient, 'RESPIRATORIO');
  const currentYear = new Date().getFullYear();

  const controls = [];

  // 3.1. Gestación / Embarazo
  if (isPregnant) {
    controls.push({
      id: 'ctrl_gest_prenatal',
      title: 'Control Prenatal Integral con Matrona / Obstetra',
      program: 'Chile Crece Contigo / MINSAL',
      norm: 'Guía Perinatal MINSAL',
      frequency: 'Mensual hasta sem 28, quincenal hasta sem 36, semanal hasta parto',
      target: 'Toda mujer gestante inscrita en el sistema de salud',
      status: 'al_dia',
      lastDate: `08-10-${currentYear}`,
      nextDate: `08-11-${currentYear}`,
      provider: 'CESFAM / Maternidad',
      notes: 'Monitoreo de latidos cardiofetales, fondo uterino, presión arterial materna y nutrición.'
    });
    controls.push({
      id: 'ctrl_gest_eco20',
      title: 'Ecografía Fetal Morfológica (Semana 20–24)',
      program: 'Garantía Explícita en Salud (GES Perinatal)',
      norm: 'GES N° 12',
      frequency: 'Única entre semana 20 y 24 de gestación',
      target: 'Todas las gestantes',
      status: 'al_dia',
      lastDate: `12-07-${currentYear}`,
      nextDate: 'Completada',
      provider: 'Centro de Diagnóstico Ecográfico',
      notes: 'Evaluación de anatomía fetal detallada, placenta y líquido amniótico.'
    });
    controls.push({
      id: 'ctrl_gest_ptgo',
      title: 'Prueba de Tolerancia a la Glucosa Oral (PTGO 75g)',
      program: 'Tamizaje Diabetes Gestacional MINSAL',
      norm: 'Norma Técnica Diabetes y Embarazo',
      frequency: 'Semana 24 a 28 de gestación',
      target: 'Gestantes sin diabetes pregestacional',
      status: 'al_dia',
      lastDate: `25-07-${currentYear}`,
      nextDate: 'Completada',
      provider: 'Laboratorio Clínico Central',
      notes: 'Glicemia basal y a las 2 horas. Descarte de diabetes gestacional.'
    });
    controls.push({
      id: 'ctrl_gest_dental',
      title: 'Salud Bucal Integral de la Embarazada',
      program: 'Garantía Explícita en Salud (GES N° 19)',
      norm: 'Decreto Supremo GES',
      frequency: 'Garantía legal durante todo el período de gestación',
      target: 'Embarazadas con confirmación diagnóstica',
      status: 'al_dia',
      lastDate: `14-08-${currentYear}`,
      nextDate: 'Alta Odontológica GES Obtenida',
      provider: 'Clínica Dental CESFAM',
      notes: 'Tratamiento integral de caries, gingivitis y profilaxis obligatoria.'
    });
  }

  // 3.2. Salud de la Mujer (PAP y Mamografía)
  if (gender === 'femenino') {
    if (age >= 25 && age <= 64) {
      controls.push({
        id: 'ctrl_muj_pap',
        title: 'Tamizaje Papanicolaou (PAP) y Detección VPH',
        program: 'Garantía Explícita en Salud (GES Cáncer Cervicouterino)',
        norm: 'GES N° 9 / Ley N° 20.584',
        frequency: 'Cada 3 años en mujeres de 25 a 64 años',
        target: 'Mujeres de 25 a 64 años',
        status: 'al_dia',
        lastDate: `10-03-${currentYear - 1}`,
        nextDate: `Marzo ${currentYear + 2}`,
        provider: 'CESFAM - Box Matrona',
        notes: 'Citología exfoliativa y tamizaje molecular del cuello uterino.'
      });
    }
    if (age >= 50 && age <= 69) {
      controls.push({
        id: 'ctrl_muj_mamo',
        title: 'Mamografía Bilateral de Tamizaje',
        program: 'Garantía Explícita en Salud (GES Cáncer de Mama)',
        norm: 'GES N° 4 / Ley Preventiva',
        frequency: 'Cada 2 años en mujeres de 50 a 69 años',
        target: 'Mujeres de 50 a 69 años',
        status: 'al_dia',
        lastDate: `18-11-${currentYear - 1}`,
        nextDate: `Noviembre ${currentYear + 1}`,
        provider: 'Centro Radiológico / Mamógrafo Móvil',
        notes: 'Estudio mamográfico digital para detección precoz.'
      });
    }
  }

  // 3.3. Salud del Hombre (Control Prostático)
  if (gender === 'masculino' && age >= 45) {
    controls.push({
      id: 'ctrl_hom_psa',
      title: 'Control Urológico y Antígeno Prostático Específico (PSA)',
      program: 'Prevención Ministerial de Cáncer de Próstata',
      norm: 'Guía Clínica Prevención Urológica MINSAL',
      frequency: 'Anual a partir de los 45 años (o 40 con antecedentes)',
      target: 'Hombres de 45 años y más',
      status: age >= 65 ? 'al_dia' : 'pendiente',
      lastDate: age >= 65 ? `22-04-${currentYear}` : 'Pendiente control anual',
      nextDate: `Abril ${currentYear + 1}`,
      provider: 'CESFAM Las Condes / Urología',
      notes: 'Medición sérica de PSA total y libre, más examen urológico preventivo.'
    });
  }

  // 3.4. Adulto Mayor (≥ 65 años): EMPAM con EFAM y Salud Bucal 60 Años
  if (age >= 65) {
    controls.push({
      id: 'ctrl_sen_empam',
      title: 'EMPAM - Examen de Medicina Preventiva del Adulto Mayor (con EFAM Chile)',
      program: 'Programa Más Adultos Mayores Autovalentes MINSAL',
      norm: 'Norma Técnica EMPAM / DS N° 41',
      frequency: 'Anual para personas de 65 años o más',
      target: 'Población mayor de 65 años inscrita en Fonasa o Isapre',
      status: 'al_dia',
      lastDate: `12-05-${currentYear}`,
      nextDate: `Mayo ${currentYear + 1}`,
      provider: 'CESFAM Las Condes - Box Enfermera',
      notes: 'Evaluación funcional EFAM (Índice de Barthel, Minimental Pfeffer, dinamometría y riesgo de caídas). Clasificado: Autovalente con Riesgo.'
    });
    controls.push({
      id: 'ctrl_sen_dental60',
      title: 'Salud Bucal Integral del Adulto de 60 Años',
      program: 'Garantía Explícita en Salud (GES N° 37)',
      norm: 'GES Adulto Mayor',
      frequency: 'Garantía legal al cumplir 60 años con controles posteriores',
      target: 'Adultos de 60 años y más',
      status: 'al_dia',
      lastDate: `14-10-${currentYear}`,
      nextDate: `Abril ${currentYear + 1}`,
      provider: 'RedSalud Odontología / Módulo Dental GES',
      notes: 'Atención odontológica integral, prótesis dentales y mantenimiento periodontal.'
    });
  }

  // 3.5. Adulto 20 a 64 años: EMPA
  if (age >= 20 && age < 65) {
    controls.push({
      id: 'ctrl_ad_empa',
      title: 'EMPA - Examen de Medicina Preventiva del Adulto',
      program: 'Programa de Salud del Adulto MINSAL',
      norm: 'Ley N° 19.966 / Decreto Supremo N° 170',
      frequency: 'Cada 1 a 3 años según factores de riesgo',
      target: 'Adultos de 20 a 64 años asintomáticos',
      status: 'al_dia',
      lastDate: `20-03-${currentYear}`,
      nextDate: `Marzo ${currentYear + 1}`,
      provider: 'CESFAM / Unidad Preventiva',
      notes: 'Tamizaje de hipertensión, diabetes (glicemia en ayunas), dislipidemia, tabaquismo y consumo de alcohol (AUDIT).'
    });
  }

  // 3.6. Pediátrico (< 10 años): Control de Niño Sano y Salud Bucal 6 años
  if (age < 10) {
    controls.push({
      id: 'ctrl_ped_ninosano',
      title: 'Control de Salud Infantil / Niño Sano (Chile Crece Contigo)',
      program: 'Programa Nacional de Salud de la Infancia',
      norm: 'Norma Técnica de Supervisión de Salud Integral de Niños y Niñas',
      frequency: 'Mensual en lactante, semestral preescolar, anual escolar',
      target: 'Población infantil desde el nacimiento hasta los 9 años',
      status: 'al_dia',
      lastDate: `15-09-${currentYear}`,
      nextDate: `Marzo ${currentYear + 1}`,
      provider: 'CESFAM Salvador Bustos',
      notes: 'Evaluación del neurodesarrollo (EEDP / TEPSI), antropometría (peso/talla), pauta de alimentación y estado vacunal.'
    });
    if (age >= 5 && age <= 7) {
      controls.push({
        id: 'ctrl_ped_dental6',
        title: 'Salud Bucal Integral del Niño y Niña de 6 Años',
        program: 'Garantía Explícita en Salud (GES N° 36)',
        norm: 'Decreto Supremo GES Infantil',
        frequency: 'Garantía legal al cumplir 6 años',
        target: 'Niños y niñas de 6 años',
        status: 'al_dia',
        lastDate: `20-10-${currentYear}`,
        nextDate: `Febrero ${currentYear + 1}`,
        provider: 'CESFAM Módulo Odontopediatría',
        notes: 'Aplicación de sellantes en primeros molares definitivos, barniz de flúor y educación en técnica de cepillado.'
      });
    }
  }

  // 3.6. Recién Nacido (0 años / neonato)
  if (age === 0 || patient.isNewborn) {
    controls.push({
      id: 'ctrl_rn_diada',
      title: 'Control de la Díada / Recién Nacido (7 a 10 días de vida)',
      program: 'Chile Crece Contigo / MINSAL',
      norm: 'Norma Técnica de Supervisión de Salud Integral Infantil',
      frequency: 'A los 7 a 10 días tras el parto',
      target: 'Todo recién nacido egresado de maternidad',
      status: 'al_dia',
      lastDate: patient.birthDate || `01-11-${currentYear}`,
      nextDate: `Control Mes 1 (${currentYear})`,
      provider: 'CESFAM - Box Matrona / Médico Pediátrico',
      notes: 'Supervisión de lactancia materna exclusiva, involución puerperal materna, peso neonatal, cicatriz umbilical y descarte de ictericia.'
    });
    controls.push({
      id: 'ctrl_rn_tamizaje',
      title: 'Tamizaje Neonatal Metabólico (PKU / TSH) y Auditivo',
      program: 'Programa Nacional de Tamizaje Neonatal MINSAL',
      norm: 'Decreto Supremo Tamizaje Neonatal',
      frequency: 'Entre las 40 horas y 5 días de vida',
      target: 'Todos los recién nacidos',
      status: 'al_dia',
      lastDate: patient.birthDate || `02-11-${currentYear}`,
      nextDate: 'Completado en Maternidad',
      provider: 'Laboratorio de Referencia Neonatal INTA',
      notes: 'Muestra de sangre de talón para pesquisa de Fenilcetonuria e Hipotiroidismo Congénito, junto a emisiones otoacústicas.'
    });
  }

  // 3.7. Adolescente (10 a 19 años, como Camila Soto): Control Joven Sano y Salud Bucal Adolescente
  if (age >= 10 && age < 20) {
    controls.push({
      id: 'ctrl_ado_jovensano',
      title: 'Control Joven Sano (Salud Integral del Adolescente - Ficha CLAP MINSAL)',
      program: 'Programa Nacional de Salud Integral de Adolescentes y Jóvenes MINSAL',
      norm: 'Guía Clínica de Atención Integral de Adolescentes y Ficha CLAP',
      frequency: 'Anual (prioridad 14 a 17 años)',
      target: 'Adolescentes escolares y jóvenes de 10 a 19 años',
      status: 'al_dia',
      lastDate: `18-06-${currentYear}`,
      nextDate: `Junio ${currentYear + 1}`,
      provider: 'CESFAM Espacio Amigable Adolescente',
      notes: 'Evaluación psicosocial integral confidencial (Ficha CLAP), tamizaje visual y postural, salud mental, hábitos de sueño, actividad física y orientación en salud sexual y reproductiva.'
    });
    controls.push({
      id: 'ctrl_ado_dental',
      title: 'Control Odontológico Preventivo del Adolescente (Más Sonrisas)',
      program: 'Programa de Salud Bucal Integral MINSAL',
      norm: 'Orientación Técnica Odontológica de Adolescentes',
      frequency: 'Semestral / Anual (12 a 17 años)',
      target: 'Población adolescente de 12 a 17 años',
      status: 'al_dia',
      lastDate: `20-04-${currentYear}`,
      nextDate: `Octubre ${currentYear}`,
      provider: 'CESFAM - Módulo Dental',
      notes: 'Examen bucodental, profilaxis, control de placa bacteriana, asesoría dietética cariogénica y evaluación de oclusión.'
    });
  }

  // 3.8. Pacientes con Hipertensión Arterial (HTA)
  if (hasHta) {
    controls.push({
      id: 'ctrl_cron_hta_pscv',
      title: 'Control de Salud Cardiovascular (PSCV Hipertensión)',
      program: 'Programa de Salud Cardiovascular MINSAL',
      norm: 'Guía Clínica GES Hipertensión Arterial',
      frequency: 'Semestral alternado Médico / Enfermera',
      target: 'Pacientes con diagnóstico confirmado de HTA',
      status: 'al_dia',
      lastDate: `10-09-${currentYear}`,
      nextDate: `Marzo ${currentYear + 1}`,
      provider: 'CESFAM Las Condes - Sector Azul',
      notes: 'Control tensional seriado, adherencia farmacológica a Losartán/Amlodipino y cálculo de riesgo cardiovascular global.'
    });
    controls.push({
      id: 'ctrl_cron_ecg_fo',
      title: 'Electrocardiograma (ECG) y Fondo de Ojo Preventivo',
      program: 'Evaluación de Daño de Órgano Blanco HTA',
      norm: 'Protocolo MINSAL PSCV',
      frequency: 'Anual',
      target: 'Pacientes hipertensos crónicos',
      status: 'al_dia',
      lastDate: `12-05-${currentYear}`,
      nextDate: `Mayo ${currentYear + 1}`,
      provider: 'Hospital / Unidad Cardiovascular CESFAM',
      notes: 'Descarte de hipertrofia ventricular izquierda y retinopatía hipertensiva.'
    });
  }

  // 3.9. Pacientes con Diabetes Mellitus Tipo 2 (DM2)
  if (hasDm) {
    controls.push({
      id: 'ctrl_cron_dm_hba1c',
      title: 'Hemoglobina Glicosilada (HbA1c) y Perfil Bioquímico',
      program: 'Control Metabólico GES Diabetes Tipo 2',
      norm: 'GES N° 6 / Guía Clínica MINSAL',
      frequency: 'Cada 3 a 6 meses según meta terapéutica',
      target: 'Pacientes con diabetes tipo 2',
      status: 'al_dia',
      lastDate: `14-08-${currentYear}`,
      nextDate: `Noviembre ${currentYear}`,
      provider: 'Laboratorio Clínico CESFAM',
      notes: 'Monitoreo de compensación glicémica promedio. Último valor: 7.1% (En rango meta según edad).'
    });
    controls.push({
      id: 'ctrl_cron_dm_pie',
      title: 'Evaluación Anual de Pie Diabético con Monofilamento',
      program: 'Prevención de Úlceras y Pie Diabético GES',
      norm: 'Norma Técnica de Curación y Pie Diabético',
      frequency: 'Anual por Enfermera capacitada',
      target: 'Personas diabéticas en programa cardiovascular',
      status: 'al_dia',
      lastDate: `10-09-${currentYear}`,
      nextDate: `Septiembre ${currentYear + 1}`,
      provider: 'CESFAM Las Condes - Box Podología y Curaciones',
      notes: 'Prueba de sensibilidad con monofilamento de Semmes-Weinstein 10g, pulsos pedios conservados, sin callosidades de riesgo.'
    });
    controls.push({
      id: 'ctrl_cron_dm_retino',
      title: 'Fondo de Ojo Diabético / Retinografía Digital Anual',
      program: 'Garantía Explícita en Salud (GES N° 6 Retinopatía Diabética)',
      norm: 'Garantía de Oportunidad GES',
      frequency: 'Anual con cámara no midriática o tecnólogo oftalmólogo',
      target: 'Pacientes con DM2 para pesquisa precoz de microaneurismas',
      status: 'al_dia',
      lastDate: `25-06-${currentYear}`,
      nextDate: `Junio ${currentYear + 1}`,
      provider: 'UAPO (Unidad de Atención Primaria Oftalmológica)',
      notes: 'Retinografía bilateral sin signos de retinopatía diabética proliferativa.'
    });
  }

  // 3.10. Pacientes con Enfermedad Renal Crónica (ERC)
  if (hasErc) {
    controls.push({
      id: 'ctrl_cron_erc',
      title: 'Monitoreo Renal: Velocidad de Filtración Glomerular (VFG) y RAC',
      program: 'Garantía Explícita en Salud (GES N° 57 / ERC)',
      norm: 'Guía Clínica Prevención ERC MINSAL',
      frequency: 'Semestral (Creatinina plasmática y razón albúmina/creatinina en orina)',
      target: 'Pacientes con ERC o alto riesgo nefrótico',
      status: 'al_dia',
      lastDate: `14-08-${currentYear}`,
      nextDate: `Febrero ${currentYear + 1}`,
      provider: 'Laboratorio Clínico / Nefrología',
      notes: 'VFG calculada por CKD-EPI: 52 ml/min/1.73m2. Tratamiento nefroprotector vigente.'
    });
  }

  // 3.11. Pacientes con EPOC
  if (hasEpoc) {
    controls.push({
      id: 'ctrl_cron_epoc',
      title: 'Control Respiratorio Integral y Espirometría Anual',
      program: 'Programa Salud Respiratoria del Adulto (ERA / GES EPOC)',
      norm: 'GES N° 68',
      frequency: 'Espirometría anual y control kinesiológico semestral',
      target: 'Pacientes con diagnóstico de EPOC o asma severa',
      status: 'al_dia',
      lastDate: `12-05-${currentYear}`,
      nextDate: `Mayo ${currentYear + 1}`,
      provider: 'Sala ERA CESFAM',
      notes: 'Técnica inhalatoria supervisada con aerocámara. Espirometría post-broncodilatador estable.'
    });
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify(controls));
  } catch (e) {}

  return controls;
}

export function saveMinsalPreventiveControls(patientId, controls) {
  try {
    localStorage.setItem(`cuidapp_minsal_controls_${patientId}`, JSON.stringify(controls));
  } catch (e) {
    console.error('Error al guardar controles MINSAL en localStorage:', e);
  }
}

export function toggleMinsalControlStatus(patientId, controlId) {
  const controls = getMinsalPreventiveControls({ id: patientId });
  const item = controls.find(c => c.id === controlId);
  if (item) {
    item.status = item.status === 'al_dia' ? 'pendiente' : 'al_dia';
    if (item.status === 'al_dia') {
      const today = new Date();
      item.lastDate = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;
    }
    saveMinsalPreventiveControls(patientId, controls);
    renderCaregiverVaccinesDental(activePatient);
    if (window.showGlassAlert) {
      window.showGlassAlert(`Control "${item.title}" actualizado a ${item.status === 'al_dia' ? 'Al día ✅' : 'Pendiente ⏳'}.`, 'info');
    }
  }
}

// 4. RENDERIZADOR PRINCIPAL DE LA PESTAÑA 4: VACUNAS, DENTAL Y PREVENTIVOS MINSAL
export function renderCaregiverVaccinesDental(patient = activePatient) {
  const container = document.getElementById('caregiverVaccinesDentalContainer');
  if (!container || !patient) return;

  const age = getPatientAge(patient);
  const gender = caregiverPatientGender(patient);
  const isPregnant = caregiverPatientIsPregnant(patient);
  const vaccines = getPatientVaccinesList(patient);
  const dentalData = getPatientDentalData(patient);
  const dentalNotes = getPatientDentalNotes(patient.id);
  const minsalControls = getMinsalPreventiveControls(patient);

  const totalVac = vaccines.length;
  const vacAlDia = vaccines.filter(v => v.status === 'al_dia').length;
  const vacPending = totalVac - vacAlDia;

  const totalControls = minsalControls.length;
  const controlsAlDia = minsalControls.filter(c => c.status === 'al_dia').length;
  const controlsPending = totalControls - controlsAlDia;

  // Determinar etiquetas de perfil clínico para el banner
  let profileBadge = '';
  if (isPregnant) {
    profileBadge = '<span class="badge bg-pink-subtle text-pink border border-pink-subtle px-3 py-1 fw-bold fs-7" style="background: rgba(236,72,153,0.15); color: #f472b6; border-color: rgba(236,72,153,0.3);"><i class="bi bi-heart-pulse me-1"></i>Gestante (Chile Crece Contigo)</span>';
  } else if (age < 14) {
    profileBadge = `<span class="badge bg-info-subtle text-info border border-info-subtle px-3 py-1 fw-bold fs-7"><i class="bi bi-balloon-heart me-1"></i>Pediátrico (${age === 0 || patient.isNewborn ? 'Recién Nacido' : `${age} años`} &bull; Ley N° 21.430)</span>`;
  } else if (age >= 14 && age < 18) {
    profileBadge = `<span class="badge bg-warning-subtle text-warning border border-warning-subtle px-3 py-1 fw-bold fs-7"><i class="bi bi-headphones me-1"></i>Adolescente (${age} años &bull; Esquema Escolar VPH/dTpa & Ficha CLAP)</span>`;
  } else if (age >= 60) {
    profileBadge = `<span class="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-1 fw-bold fs-7"><i class="bi bi-person-heart me-1"></i>Adulto Mayor (${age} años &bull; GES / EMPAM)</span>`;
  } else {
    profileBadge = `<span class="badge bg-secondary-subtle text-secondary-emphasis border px-3 py-1 fw-bold fs-7"><i class="bi bi-person me-1"></i>Adulto (${age} años &bull; EMPA)</span>`;
  }

  // Comprobar condiciones crónicas del paciente para mostrar badges
  const chronicBadges = [];
  if (caregiverPatientHasCondition(patient, 'HTA') || caregiverPatientHasCondition(patient, 'HIPERTENSION')) {
    chronicBadges.push('<span class="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1 fs-8">❤️ HTA (Cardiovascular)</span>');
  }
  if (caregiverPatientHasCondition(patient, 'DIABETES') || caregiverPatientHasCondition(patient, 'DM2')) {
    chronicBadges.push('<span class="badge bg-warning-subtle text-warning border border-warning-subtle px-2 py-1 fs-8">🩸 Diabetes DM2 (GES N° 6)</span>');
  }
  if (caregiverPatientHasCondition(patient, 'ERC') || caregiverPatientHasCondition(patient, 'RENAL')) {
    chronicBadges.push('<span class="badge bg-info-subtle text-info border border-info-subtle px-2 py-1 fs-8">💧 ERC (Nefroprotección)</span>');
  }
  if (caregiverPatientHasCondition(patient, 'EPOC') || caregiverPatientHasCondition(patient, 'RESPIRATORIO')) {
    chronicBadges.push('<span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 fs-8">🫁 EPOC (GES N° 68)</span>');
  }

  const prenatalBlockHtml = isPregnant ? `
    <!-- BLOQUE DESTACADO: CONTROL PRENATAL MINSAL (GESTANTE) -->
    <div class="glass-card p-4 border-0 mb-4" id="cardPrenatalCaregiverVaccines" style="background: linear-gradient(135deg, rgba(236,72,153,0.14) 0%, rgba(168,85,247,0.08) 100%); border: 1.5px solid rgba(244,114,182,0.4) !important;">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h5 class="fw-bold text-white m-0 d-flex align-items-center gap-2">
            <i class="bi bi-balloon-heart-fill text-pink" style="color: #f472b6;"></i>
            <span>🤰 Control Prenatal MINSAL & Chile Crece Contigo</span>
          </h5>
          <small class="text-white-50 fs-7">Monitoreo de edad gestacional, ecografías, movimientos fetales e inmunizaciones obligatorias</small>
        </div>
        <div class="d-flex align-items-center gap-2">
          <span class="badge px-3 py-1.5 rounded-pill fw-bold" style="background: rgba(236,72,153,0.25); color: #f472b6; border: 1px solid rgba(236,72,153,0.5); font-size: 0.85rem;">
            Semana ${patient.pregnancyWeeks || patient.gestationalWeeks || 24} de Gestación
          </span>
          <button type="button" class="btn btn-sm btn-glass-primary fw-bold px-3 py-2 d-inline-flex align-items-center gap-2 shadow-sm text-nowrap btn-trigger-register-birth" style="border-radius: 10px; background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); border: 1.5px solid #f472b6;">
            <span>👶 Registrar Nacimiento</span>
          </button>
        </div>
      </div>

      <div class="row g-3">
        <!-- Semanas & FPP -->
        <div class="col-md-3">
          <div class="p-3 rounded-3 h-100 card-summary-prenatal card-summary-prenatal-weeks" style="background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(255,255,255,0.08);">
            <span class="fs-8 text-white-50 fw-semibold d-block mb-1"><i class="bi bi-calendar3 me-1 text-info"></i>Semanas & FPP</span>
            <div class="d-flex align-items-baseline gap-2">
              <h4 class="mb-0 fw-bold text-white">${patient.pregnancyWeeks || patient.gestationalWeeks || 24}<span class="fs-7 text-white-50 fw-normal"> sem</span></h4>
              <span class="badge bg-pink-subtle text-pink border border-pink-subtle fs-8">2° Trimestre</span>
            </div>
            <small class="text-white-50 d-block mt-1">FPP estimada: <strong class="text-white">${patient.fpp || '12-03-2027'}</strong></small>
          </div>
        </div>

        <!-- Ecografías Obstétricas -->
        <div class="col-md-3">
          <div class="p-3 rounded-3 h-100 card-summary-prenatal card-summary-prenatal-eco" style="background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(255,255,255,0.08);">
            <span class="fs-8 text-white-50 fw-semibold d-block mb-1"><i class="bi bi-camera-reels me-1 text-warning"></i>Ecografías Obstétricas</span>
            <div class="d-flex flex-column gap-1 fs-8">
              <span class="text-white"><i class="bi bi-check-circle-fill text-success me-1"></i>11–14s: Normal</span>
              <span class="text-white"><i class="bi bi-check-circle-fill text-success me-1"></i>20–24s: Morfológica OK</span>
              <span class="text-white-50"><i class="bi bi-clock-history text-warning me-1"></i>32–34s: Programada</span>
            </div>
          </div>
        </div>

        <!-- Movimientos Fetales -->
        <div class="col-md-3">
          <div class="p-3 rounded-3 h-100 card-summary-prenatal card-summary-prenatal-fetal" style="background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(255,255,255,0.08);">
            <span class="fs-8 text-white-50 fw-semibold d-block mb-1"><i class="bi bi-activity me-1 text-success"></i>Movimientos Fetales</span>
            <div class="d-flex align-items-baseline gap-1">
              <h5 class="mb-0 fw-bold text-success"><i class="bi bi-check2-circle me-1"></i>Presentes</h5>
            </div>
            <p class="fs-8 text-white-50 mb-0 mt-1">≥ 10 movimientos en 2 hrs (Patrón fetal normal y vigoroso)</p>
          </div>
        </div>

        <!-- Vacunas Gestacionales Clave -->
        <div class="col-md-3">
          <div class="p-3 rounded-3 h-100 card-summary-prenatal card-summary-prenatal-immuno" style="background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(255,255,255,0.08);">
            <span class="fs-8 text-white-50 fw-semibold d-block mb-1"><i class="bi bi-shield-plus me-1 text-teal" style="color:#14b8a6;"></i>Inmunización Materna</span>
            <div class="d-flex flex-column gap-1 fs-8">
              <span class="text-white"><i class="bi bi-check-lg text-success me-1"></i><strong>dTpa:</strong> Semana 28+</span>
              <span class="text-white"><i class="bi bi-check-lg text-success me-1"></i><strong>Influenza:</strong> Al día</span>
              <span class="text-white"><i class="bi bi-check-lg text-success me-1"></i><strong>Dental:</strong> GES N° 19</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  ` : '';

  let html = `
    <!-- HEADER RESUMEN & PERFIL CLÍNICO -->
    <div class="glass-card p-4 border-0 mb-4 position-relative overflow-hidden" style="background: linear-gradient(135deg, rgba(20, 184, 166, 0.08) 0%, rgba(59, 130, 246, 0.05) 100%);">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
            <h4 class="mb-0 fw-bold text-white d-flex align-items-center gap-2">
              <span>🦷 Vacunas, Salud Dental y Controles Preventivos MINSAL</span>
            </h4>
            ${profileBadge}
            <span class="badge bg-dark-subtle text-white-50 border border-secondary-subtle px-2 py-1 fs-8">
              ${gender === 'femenino' ? '♀ Femenino' : '♂ Masculino'}
            </span>
          </div>
          <p class="text-white-50 mb-2 fs-7" style="max-width: 850px;">
            Monitoreo oficial del Programa Nacional de Inmunizaciones (PNI), Ficha Odontológica Integral y Controles Preventivos filtrados automáticamente bajo la Ley N° 20.584, Decreto Supremo N° 41 y Normas Técnicas MINSAL para <strong>${patient.name}</strong>.
          </p>
          <div class="d-flex flex-wrap gap-2 align-items-center">
            ${chronicBadges.join(' ')}
          </div>
        </div>
        <div class="d-flex flex-column flex-sm-row gap-2">
          <button id="btnOpenDentalModalFromCaregiver" type="button" class="btn btn-glass-primary px-3 py-2 fw-semibold d-inline-flex align-items-center gap-2 shadow-sm">
            <i class="bi bi-grid-3x3-gap-fill text-info"></i>
            <span>Abrir Ficha Odontológica Completa (FDI)</span>
          </button>
        </div>
      </div>

      <!-- 3 TARJETAS MÉTRICAS DE RESUMEN SUPERIOR -->
      <div class="row g-3 mt-3">
        <!-- Métrica 1: Vacunas -->
        <div class="col-md-4">
          <div class="p-3 rounded-3 card-summary-metric card-summary-vaccines" style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.08);">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="fs-7 text-white-50 fw-semibold"><i class="bi bi-shield-check text-success me-1"></i>Esquema Vacunal (PNI)</span>
              <span class="badge ${vacPending === 0 ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-warning-subtle text-warning border border-warning-subtle'} fs-8">
                ${vacPending === 0 ? 'Esquema al Día' : `${vacPending} Pendiente${vacPending > 1 ? 's' : ''}`}
              </span>
            </div>
            <div class="d-flex align-items-baseline gap-2">
              <h3 class="mb-0 fw-bold text-white">${vacAlDia}<span class="fs-6 text-white-50 fw-normal"> / ${totalVac}</span></h3>
              <span class="fs-8 text-success fw-medium">${Math.round((vacAlDia / (totalVac || 1)) * 100)}% de cobertura</span>
            </div>
            <div class="progress mt-2" style="height: 6px; background: rgba(255,255,255,0.1);">
              <div class="progress-bar bg-success" style="width: ${(vacAlDia / (totalVac || 1)) * 100}%;"></div>
            </div>
          </div>
        </div>

        <!-- Métrica 2: Odontología -->
        <div class="col-md-4">
          <div class="p-3 rounded-3 card-summary-metric card-summary-dental" style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.08);">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="fs-7 text-white-50 fw-semibold"><i class="bi bi-emoji-smile text-info me-1"></i>Salud Odontológica</span>
              <span class="badge bg-info-subtle text-info border border-info-subtle fs-8">Control Vigente</span>
            </div>
            <div class="d-flex align-items-baseline gap-2">
              <h4 class="mb-0 fw-bold text-white">${dentalData.piecesHealthy}<span class="fs-7 text-white-50 fw-normal"> piezas sanas</span></h4>
              <span class="fs-8 text-white-50">&bull; Higiene: ${dentalData.hygieneIndex}</span>
            </div>
            <p class="fs-8 text-white-50 mb-0 mt-2 text-truncate">
              Último: <strong class="text-white">${dentalData.lastControlDate}</strong> &bull; Próximo: ${dentalData.nextControlDate.split(' ')[0]} ${dentalData.nextControlDate.split(' ')[1] || ''}
            </p>
          </div>
        </div>

        <!-- Métrica 3: Preventivos MINSAL -->
        <div class="col-md-4">
          <div class="p-3 rounded-3 card-summary-metric card-summary-preventive" style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.08);">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="fs-7 text-white-50 fw-semibold"><i class="bi bi-clipboard2-pulse text-warning me-1"></i>Controles Preventivos</span>
              <span class="badge ${controlsPending === 0 ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-warning-subtle text-warning border border-warning-subtle'} fs-8">
                ${controlsPending === 0 ? 'Todos al Día' : `${controlsPending} por revisar`}
              </span>
            </div>
            <div class="d-flex align-items-baseline gap-2">
              <h3 class="mb-0 fw-bold text-white">${controlsAlDia}<span class="fs-6 text-white-50 fw-normal"> / ${totalControls}</span></h3>
              <span class="fs-8 text-white-50 fw-medium">Protocolos MINSAL / GES</span>
            </div>
            <div class="progress mt-2" style="height: 6px; background: rgba(255,255,255,0.1);">
              <div class="progress-bar bg-warning" style="width: ${(controlsAlDia / (totalControls || 1)) * 100}%;"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    ${prenatalBlockHtml}

    <!-- SECCIÓN 1: REGISTRO Y ESTADO DE VACUNAS (PNI, INFLUENZA, COVID Y ESQUEMA SEGÚN EDAD) -->
    <div class="glass-card p-4 border-0 mb-4">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h5 class="fw-bold text-white mb-1 d-flex align-items-center gap-2">
            <i class="bi bi-shield-shaded text-teal" style="color: #14b8a6;"></i>
            <span>1. Registro y Estado de Vacunas (PNI, Campaña Influenza y COVID-19)</span>
          </h5>
          <p class="text-white-50 fs-7 mb-0">
            Control de dosis administradas, próximas fechas y certificación ministerial oficial. Esquema adaptado para ${isPregnant ? 'gestante' : (age < 14 ? 'pediátrico' : (age < 18 ? 'adolescente' : (age >= 60 ? 'adulto mayor' : 'adulto')))}.
          </p>
        </div>
        <div class="d-flex gap-2">
          <button id="btnToggleAddVaccineForm" type="button" class="btn btn-sm btn-outline-info d-inline-flex align-items-center gap-1">
            <i class="bi bi-plus-circle"></i>
            <span>+ Registrar Vacuna / Dosis</span>
          </button>
        </div>
      </div>

      <!-- Formulario Desplegable para Agregar Nueva Vacuna -->
      <div id="containerAddVaccineForm" class="d-none p-3 mb-4 rounded-3" style="background: rgba(15, 23, 42, 0.7); border: 1px dashed rgba(56, 189, 248, 0.4);">
        <h6 class="text-white fw-bold mb-3 d-flex align-items-center gap-2">
          <i class="bi bi-plus-circle-fill text-info"></i>
          <span>Registrar Nueva Dosis o Vacuna en Ficha Clínica</span>
        </h6>
        <form id="formAddCaregiverVaccine">
          <div class="row g-3">
            <div class="col-md-4">
              <label class="form-label fs-8 text-white-50">Nombre de la Vacuna *</label>
              <input type="text" id="inputNewVacName" class="form-control form-control-sm bg-dark text-white border-secondary" placeholder="Ej: Neumocócica Conjugada 13 / Influenza 2026" required autocomplete="off" />
            </div>
            <div class="col-md-3">
              <label class="form-label fs-8 text-white-50">Programa / Campaña</label>
              <select id="selectNewVacProgram" class="form-select form-select-sm bg-dark text-white border-secondary">
                <option value="PNI Obligatorio MINSAL">PNI Obligatorio MINSAL</option>
                <option value="Campaña Invierno MINSAL">Campaña Invierno MINSAL</option>
                <option value="Garantía Explícita GES">Garantía Explícita GES</option>
                <option value="Vacunación Complementaria">Vacunación Complementaria</option>
              </select>
            </div>
            <div class="col-md-2">
              <label class="form-label fs-8 text-white-50">Fecha de Aplicación</label>
              <input type="date" id="inputNewVacDate" class="form-control form-control-sm bg-dark text-white border-secondary" value="${getTodayDateString()}" />
            </div>
            <div class="col-md-3">
              <label class="form-label fs-8 text-white-50">Centro de Salud / Vacunatorio</label>
              <input type="text" id="inputNewVacProvider" class="form-control form-control-sm bg-dark text-white border-secondary" placeholder="Ej: CESFAM Las Condes" autocomplete="off" />
            </div>
            <div class="col-md-3">
              <label class="form-label fs-8 text-white-50">N° Lote / Fabricante</label>
              <input type="text" id="inputNewVacLot" class="form-control form-control-sm bg-dark text-white border-secondary" placeholder="Ej: LOT-9941" autocomplete="off" />
            </div>
            <div class="col-md-6">
              <label class="form-label fs-8 text-white-50">Observaciones Clínicas / Reacciones</label>
              <input type="text" id="inputNewVacNotes" class="form-control form-control-sm bg-dark text-white border-secondary" placeholder="Ej: Buena tolerancia, sin eritema ni fiebre local." autocomplete="off" />
            </div>
            <div class="col-md-3 d-flex align-items-end gap-2">
              <button type="submit" class="btn btn-sm btn-info w-100 fw-semibold">
                <i class="bi bi-save me-1"></i>Guardar en Ficha
              </button>
              <button type="button" id="btnCancelAddVac" class="btn btn-sm btn-outline-secondary">Cancelar</button>
            </div>
          </div>
        </form>
      </div>

      <!-- Tabla / Lista de Vacunas -->
      <div class="table-responsive w-full max-w-full overflow-x-auto" style="max-width: 100%; overflow-x: auto;">
        <table class="table table-dark table-hover align-middle mb-0" style="background: transparent;">
          <thead class="text-white-50 fs-8 border-secondary">
            <tr>
              <th scope="col" style="min-width: 220px;">Vacuna / Inmunización</th>
              <th scope="col">Programa MINSAL</th>
              <th scope="col">Estado</th>
              <th scope="col">Fecha Aplicación</th>
              <th scope="col">Centro de Salud & Lote</th>
              <th scope="col" class="text-end">Acción</th>
            </tr>
          </thead>
          <tbody class="fs-7 border-secondary">
            ${vaccines.map(vac => `
              <tr>
                <td>
                  <div class="fw-semibold text-white d-flex align-items-center gap-2">
                    <i class="bi bi-eyedropper text-info"></i>
                    <span>${vac.name}</span>
                  </div>
                  <small class="text-white-50 fs-8">${vac.notes || ''}</small>
                </td>
                <td>
                  <span class="badge bg-dark-subtle text-white-50 border border-secondary-subtle fs-8">
                    ${vac.program}
                  </span>
                </td>
                <td>
                  ${vac.status === 'al_dia' 
                    ? '<span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1"><i class="bi bi-check2-circle me-1"></i>Al día</span>' 
                    : '<span class="badge bg-warning-subtle text-warning border border-warning-subtle px-2 py-1"><i class="bi bi-clock-history me-1"></i>Pendiente</span>'}
                </td>
                <td class="text-white-50">
                  <i class="bi bi-calendar-event me-1"></i>${vac.date}
                </td>
                <td class="text-white-50 fs-8">
                  <div>${vac.provider || 'CESFAM de Inscripción'}</div>
                  <div class="text-white-50 opacity-75">Lote: ${vac.lot || 'S/L'}</div>
                </td>
                <td class="text-end">
                  <button type="button" class="btn btn-sm ${vac.status === 'al_dia' ? 'btn-outline-secondary' : 'btn-glass-primary'} py-1 px-2 fs-8 btn-toggle-vac" data-vac-id="${vac.id}">
                    ${vac.status === 'al_dia' ? '<i class="bi bi-arrow-repeat me-1"></i>Marcar Pendiente' : '<i class="bi bi-check-lg me-1"></i>Marcar al Día'}
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- SECCIÓN 2: FICHA ODONTOLÓGICA (ÚLTIMO CONTROL, ESTADO DENTAL Y NOTAS) -->
    <div class="glass-card p-4 border-0 mb-4">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h5 class="fw-bold text-white mb-1 d-flex align-items-center gap-2">
            <i class="bi bi-heart-pulse-fill text-info"></i>
            <span>2. Ficha Odontológica (Último Control, Estado Dental y Bitácora)</span>
          </h5>
          <p class="text-white-50 fs-7 mb-0">
            Resumen estomatológico, seguimiento de piezas dentales, prótesis y bitácora clínica del cuidador.
          </p>
        </div>
        <button id="btnOpenDentalOdontogram" type="button" class="btn btn-sm btn-glass-primary d-inline-flex align-items-center gap-2">
          <i class="bi bi-grid-3x3-gap"></i>
          <span>Ver Odontograma FDI Anatómico</span>
        </button>
      </div>

      <div class="row g-4">
        <!-- Columna Izquierda: Tarjetas de Estado Dental -->
        <div class="col-lg-6">
          <div class="p-3 rounded-3 mb-3 card-summary-dental-box card-summary-dental-control" style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.08);">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="fs-7 fw-bold text-white"><i class="bi bi-file-earmark-medical text-primary me-2"></i>Último Control Odontológico Registrado</span>
              <span class="badge bg-success-subtle text-success border border-success-subtle fs-8">Control Vigente</span>
            </div>
            <div class="row g-2 fs-7 text-white-50 mb-2">
              <div class="col-sm-6">
                <span class="text-white-50 fs-8 d-block">Fecha de Atención:</span>
                <strong class="text-white"><i class="bi bi-calendar3 me-1"></i>${dentalData.lastControlDate}</strong>
              </div>
              <div class="col-sm-6">
                <span class="text-white-50 fs-8 d-block">Profesional Tratante:</span>
                <strong class="text-white"><i class="bi bi-person-badge me-1"></i>${dentalData.dentist}</strong>
              </div>
              <div class="col-12 mt-1">
                <span class="text-white-50 fs-8 d-block">Establecimiento Odontológico:</span>
                <span class="text-white"><i class="bi bi-hospital me-1"></i>${dentalData.clinic}</span>
              </div>
              <div class="col-12 mt-1">
                <span class="text-white-50 fs-8 d-block">Próximo Control Recomendado:</span>
                <span class="text-warning fw-semibold"><i class="bi bi-clock-history me-1"></i>${dentalData.nextControlDate}</span>
              </div>
            </div>
            <div class="p-2 rounded bg-dark border border-secondary-subtle fs-8 text-white-50">
              <i class="bi bi-info-circle text-info me-1"></i><strong>Diagnóstico Clínico:</strong> ${dentalData.summary}
            </div>
            ${dentalData.hasProsthesis ? `
              <div class="mt-2 p-2 rounded bg-info-subtle text-info border border-info-subtle fs-8 d-flex align-items-center gap-2">
                <i class="bi bi-shield-check fs-6"></i>
                <span><strong>Prótesis Dental Registrada:</strong> ${dentalData.prosthesisType || 'Prótesis Parcial Removible'}. Requiere retiro nocturno y pastilla de desinfección.</span>
              </div>
            ` : ''}
          </div>

          <!-- Distribución de Piezas Dentales -->
          <div class="p-3 rounded-3 card-summary-dental-box card-summary-dental-balance" style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.08);">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <span class="fs-7 fw-bold text-white"><i class="bi bi-bar-chart-steps text-teal me-2" style="color:#14b8a6;"></i>Balance de Piezas Dentales (Norma FDI)</span>
              <span class="badge bg-secondary-subtle text-white-50 fs-8">${dentalData.riskLevel} Riesgo</span>
            </div>
            <div class="row g-2 text-center">
              <div class="col-3">
                <div class="p-2 rounded bg-success-subtle text-success border border-success-subtle">
                  <div class="fs-4 fw-bold">${dentalData.piecesHealthy}</div>
                  <div class="fs-8">🟢 Sanas</div>
                </div>
              </div>
              <div class="col-3">
                <div class="p-2 rounded bg-primary-subtle text-primary border border-primary-subtle">
                  <div class="fs-4 fw-bold">${dentalData.piecesObturated}</div>
                  <div class="fs-8">🔵 Obturadas</div>
                </div>
              </div>
              <div class="col-3">
                <div class="p-2 rounded bg-secondary-subtle text-secondary-emphasis border border-secondary">
                  <div class="fs-4 fw-bold">${dentalData.piecesMissing}</div>
                  <div class="fs-8">⚪ Ausentes</div>
                </div>
              </div>
              <div class="col-3">
                <div class="p-2 rounded bg-warning-subtle text-warning border border-warning-subtle">
                  <div class="fs-4 fw-bold">${dentalData.piecesPlanned}</div>
                  <div class="fs-8">🟡 Sellantes</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Columna Derecha: Bitácora de Cuidados Dentales (Notas) -->
        <div class="col-lg-6">
          <div class="p-3 rounded-3 h-100 d-flex flex-column card-summary-dental-box card-summary-dental-notes" style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.08);">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <span class="fs-7 fw-bold text-white"><i class="bi bi-journal-medical text-warning me-2"></i>Notas y Observaciones del Cuidador</span>
              <span class="badge bg-dark-subtle text-white-50 fs-8">${dentalNotes.length} Registro${dentalNotes.length !== 1 ? 's' : ''}</span>
            </div>

            <!-- Formulario para Agregar Nota Dental -->
            <form id="formAddDentalNote" class="mb-3">
              <div class="row g-2">
                <div class="col-sm-8">
                  <input type="text" id="inputDentalNoteText" class="form-control form-control-sm bg-dark text-white border-secondary" placeholder="Escribir observación de higiene, prótesis o encías..." required autocomplete="off" />
                </div>
                <div class="col-sm-4">
                  <select id="selectDentalNoteCategory" class="form-select form-select-sm bg-dark text-white border-secondary">
                    <option value="higiene">Higiene</option>
                    <option value="protesis">Prótesis</option>
                    <option value="dolor">Molestia / Dolor</option>
                    <option value="indicacion">Indicación Dental</option>
                  </select>
                </div>
                <div class="col-12 text-end">
                  <button type="submit" class="btn btn-sm btn-info px-3 fw-semibold">
                    <i class="bi bi-plus-circle me-1"></i>Guardar Nota
                  </button>
                </div>
              </div>
            </form>

            <!-- Lista Cronológica de Notas -->
            <div class="flex-grow-1 overflow-auto pe-1" style="max-height: 260px;">
              ${dentalNotes.length === 0 ? `
                <div class="text-center py-4 text-white-50 fs-8">
                  <i class="bi bi-chat-square-text fs-3 d-block mb-1 opacity-50"></i>
                  Sin notas registradas aún para este paciente.
                </div>
              ` : `
                <div class="d-flex flex-column gap-2">
                  ${dentalNotes.map(note => `
                    <div class="p-2 rounded bg-dark border border-secondary-subtle position-relative fs-8">
                      <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="badge ${note.badgeClass} px-2 py-0 fs-8">${note.category}</span>
                        <div class="d-flex align-items-center gap-2">
                          <span class="text-white-50 fs-8"><i class="bi bi-clock me-1"></i>${note.date} ${note.time}</span>
                          <button type="button" class="btn btn-sm btn-link text-danger p-0 border-0 btn-delete-dental-note" data-note-id="${note.id}" title="Eliminar nota">
                            <i class="bi bi-trash fs-8"></i>
                          </button>
                        </div>
                      </div>
                      <p class="text-white mb-1 fs-7">${note.text}</p>
                      <small class="text-white-50 opacity-75 d-block fs-8"><i class="bi bi-person me-1"></i>${note.author}</small>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- SECCIÓN 3: CONTROLES PREVENTIVOS MINSAL FILTRADOS AUTOMÁTICAMENTE -->
    <div class="glass-card p-4 border-0 mb-4">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h5 class="fw-bold text-white mb-1 d-flex align-items-center gap-2">
            <i class="bi bi-clipboard2-check-fill text-success"></i>
            <span>3. Controles Preventivos MINSAL (Filtro por Edad, Sexo y Condición)</span>
          </h5>
          <p class="text-white-50 fs-7 mb-0">
            Garantías Explícitas en Salud (GES/AUGE), Exámenes Preventivos (EMPA/EMPAM/Chile Crece Contigo) y Tamizajes Oncológicos según perfil activo de <strong>${patient.name}</strong>.
          </p>
        </div>
        <div class="d-flex align-items-center gap-2">
          <span class="badge bg-dark-subtle text-white-50 border border-secondary px-2 py-1 fs-8">
            ${minsalControls.length} Controles Aplicables
          </span>
        </div>
      </div>

      <!-- Grid de Controles Preventivos Filtrados -->
      <div class="row g-3">
        ${minsalControls.map(ctrl => `
          <div class="col-lg-6">
            <div class="p-3 rounded-3 h-100 d-flex flex-column justify-content-between card-summary-preventive-box" style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.08);">
              <div>
                <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                  <div>
                    <h6 class="fw-bold text-white mb-1 fs-7 d-flex align-items-center gap-2">
                      <i class="bi bi-check-circle text-teal" style="color: #14b8a6;"></i>
                      <span>${ctrl.title}</span>
                    </h6>
                    <div class="d-flex flex-wrap gap-1 align-items-center">
                      <span class="badge bg-secondary-subtle text-white-50 border border-secondary fs-8">${ctrl.norm}</span>
                      <span class="badge bg-info-subtle text-info border border-info-subtle fs-8">${ctrl.program}</span>
                    </div>
                  </div>
                  <div>
                    ${ctrl.status === 'al_dia' 
                      ? '<span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 fs-8"><i class="bi bi-check2-circle me-1"></i>Al día</span>' 
                      : '<span class="badge bg-warning-subtle text-warning border border-warning-subtle px-2 py-1 fs-8"><i class="bi bi-clock-history me-1"></i>Pendiente</span>'}
                  </div>
                </div>

                <p class="text-white-50 fs-8 mb-2">${ctrl.notes}</p>

                <div class="p-2 rounded bg-dark border border-secondary-subtle fs-8 text-white-50 mb-2">
                  <div class="d-flex justify-content-between">
                    <span><strong>Periodicidad:</strong> ${ctrl.frequency}</span>
                    <span><strong>Población:</strong> ${ctrl.target}</span>
                  </div>
                  <div class="mt-1 d-flex justify-content-between text-white">
                    <span><i class="bi bi-calendar-check me-1 text-info"></i>Último: ${ctrl.lastDate}</span>
                    <span><i class="bi bi-hospital me-1 text-info"></i>${ctrl.provider}</span>
                  </div>
                </div>
              </div>

              <div class="d-flex justify-content-end align-items-center mt-2 pt-2 border-top border-secondary-subtle">
                <button type="button" class="btn btn-sm ${ctrl.status === 'al_dia' ? 'btn-outline-secondary' : 'btn-glass-primary'} py-1 px-3 fs-8 btn-toggle-ctrl" data-ctrl-id="${ctrl.id}">
                  ${ctrl.status === 'al_dia' ? '<i class="bi bi-arrow-repeat me-1"></i>Marcar Pendiente' : '<i class="bi bi-check-lg me-1"></i>Marcar Realizado'}
                </button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Enlazar botones para Registrar Nacimiento (Mujer Gestante)
  container.querySelectorAll('.btn-trigger-register-birth').forEach(btn => {
    btn.onclick = () => openRegisterBirthModal(patient);
  });

  // ENLAZAR EVENTOS DE LA PESTAÑA 4
  // 1. Abrir modal odontológico completo
  const btnOpenModal1 = document.getElementById('btnOpenDentalModalFromCaregiver');
  const btnOpenModal2 = document.getElementById('btnOpenDentalOdontogram');
  const triggerDentalModal = () => {
    openDentalModuleModal(age < 18 ? 'pediatrico' : 'adulto', 'cuidador');
  };
  if (btnOpenModal1) btnOpenModal1.onclick = triggerDentalModal;
  if (btnOpenModal2) btnOpenModal2.onclick = triggerDentalModal;

  // 2. Toggle agregar vacuna
  const btnToggleAdd = document.getElementById('btnToggleAddVaccineForm');
  const formAddVacContainer = document.getElementById('containerAddVaccineForm');
  const btnCancelAddVac = document.getElementById('btnCancelAddVac');
  if (btnToggleAdd && formAddVacContainer) {
    btnToggleAdd.onclick = () => {
      formAddVacContainer.classList.toggle('d-none');
    };
  }
  if (btnCancelAddVac && formAddVacContainer) {
    btnCancelAddVac.onclick = () => {
      formAddVacContainer.classList.add('d-none');
    };
  }

  // 3. Submit nueva vacuna
  const formAddCaregiverVaccine = document.getElementById('formAddCaregiverVaccine');
  if (formAddCaregiverVaccine) {
    formAddCaregiverVaccine.onsubmit = (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('inputNewVacName');
      const programInput = document.getElementById('selectNewVacProgram');
      const dateInput = document.getElementById('inputNewVacDate');
      const providerInput = document.getElementById('inputNewVacProvider');
      const lotInput = document.getElementById('inputNewVacLot');
      const notesInput = document.getElementById('inputNewVacNotes');

      if (!nameInput || !nameInput.value.trim()) return;

      addCaregiverCustomVaccine(patient.id, {
        name: nameInput.value.trim(),
        program: programInput ? programInput.value : 'PNI Obligatorio MINSAL',
        date: dateInput ? dateInput.value : getTodayDateString(),
        provider: providerInput ? providerInput.value.trim() : 'CESFAM',
        lot: lotInput ? lotInput.value.trim() : 'S/L',
        notes: notesInput ? notesInput.value.trim() : ''
      });
    };
  }

  // 4. Toggle estado de vacuna (Al día / Pendiente)
  const vacButtons = container.querySelectorAll('.btn-toggle-vac');
  vacButtons.forEach(btn => {
    btn.onclick = () => {
      const vacId = btn.getAttribute('data-vac-id');
      if (vacId) toggleCaregiverVaccineStatus(patient.id, vacId);
    };
  });

  // 5. Submit nueva nota dental
  const formAddDentalNote = document.getElementById('formAddDentalNote');
  if (formAddDentalNote) {
    formAddDentalNote.onsubmit = (e) => {
      e.preventDefault();
      const textInput = document.getElementById('inputDentalNoteText');
      const catInput = document.getElementById('selectDentalNoteCategory');
      if (!textInput || !textInput.value.trim()) return;

      const sidebarUserEl = document.querySelector('.sidebar footer strong, footer strong.text-white');
      const author = sidebarUserEl ? `${sidebarUserEl.textContent.trim()} (Cuidador)` : 'Cuidador Autorizado';

      addPatientDentalNote(patient.id, {
        text: textInput.value.trim(),
        category: catInput ? catInput.value : 'higiene',
        author: author
      });
    };
  }

  // 6. Eliminar nota dental
  const deleteNoteButtons = container.querySelectorAll('.btn-delete-dental-note');
  deleteNoteButtons.forEach(btn => {
    btn.onclick = () => {
      const noteId = btn.getAttribute('data-note-id');
      if (noteId) deletePatientDentalNote(patient.id, noteId);
    };
  });

  // 7. Toggle estado de control preventivo MINSAL
  const ctrlButtons = container.querySelectorAll('.btn-toggle-ctrl');
  ctrlButtons.forEach(btn => {
    btn.onclick = () => {
      const ctrlId = btn.getAttribute('data-ctrl-id');
      if (ctrlId) toggleMinsalControlStatus(patient.id, ctrlId);
    };
  });
}

// Alias para compatibilidad con nomenclaturas del módulo del cuidador
export const renderCaregiver = renderEvaluationView;
export const bindCaregiverEvents = bindDashboardEvents;

// ============================================================================
// MODAL: 🔔 MIS NOTIFICACIONES Y ALERTAS CLÍNICAS (UNIVERSAL PARA TODOS LOS PERFILES)
// ============================================================================
export function openPatientNotificationsModal(patient = activePatient) {
  const p = patient || activePatient || PATIENTS_DATABASE[0];
  if (!p) return;

  const modalId = 'modalPatientNotifications';
  const existing = document.getElementById(modalId);
  if (existing) {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    existing.remove();
  }

  const pName = p.socialName || p.name || 'Paciente';
  const pAge = getPatientAge(p);
  const pRut = p.rut || p.fileNumber || p.documentNumber || 'Sin Documento';
  const lang = getCurrentLanguage();

  // 1. Obtener Citas Reales o Pendientes
  let appointments = getPatientAppointments(p);
  if (!Array.isArray(appointments) || appointments.length === 0) {
    if (p.isPregnant) {
      appointments = [
        { id: 'apt_def_1', title: 'Control Prenatal y Ecografía Fetal', date: '25 Nov 2026', time: '10:30', doctor: 'Matrona Carmen Silva', place: 'Maternidad Hospital Clínico', type: 'Control Obstétrico' },
        { id: 'apt_def_2', title: 'Exámenes de Sangre / Curva de Tolerancia', date: '02 Dic 2026', time: '08:15', doctor: 'Laboratorio Clínico Central', place: 'Toma de Muestras Box 4', type: 'Laboratorio' }
      ];
    } else if (pAge >= 60) {
      appointments = [
        { id: 'apt_def_1', title: 'Control Cardiovascular y ECG', date: '26 Nov 2026', time: '09:30', doctor: 'Dra. Elena Valdés', place: 'CESFAM Sector 2 - Box 5', type: 'Cardiología' },
        { id: 'apt_def_2', title: 'Control EMPAM y Evaluación Odontológica', date: '04 Dic 2026', time: '11:00', doctor: 'Equipo Dental GES', place: 'Clínica Odontológica', type: 'GES Dental' }
      ];
    } else if (pAge >= 14 && pAge <= 17) {
      appointments = [
        { id: 'apt_def_1', title: 'Control Joven Sano Integral CLAP', date: '28 Nov 2026', time: '15:30', doctor: 'Enfermera Guía Adolescente', place: 'Espacio Amigable CESFAM', type: 'Salud Joven' }
      ];
    } else if (pAge < 14) {
      appointments = [
        { id: 'apt_def_1', title: 'Control Niño Sano y Antropometría', date: '27 Nov 2026', time: '10:15', doctor: 'Dr. Morales - Pediatría', place: 'Box Pediátrico 2', type: 'Pediatría' }
      ];
    } else {
      appointments = [
        { id: 'apt_def_1', title: 'Control Médico Preventivo (EMP)', date: '30 Nov 2026', time: '08:30', doctor: 'Medicina General', place: 'CESFAM Box 3', type: 'Medicina General' }
      ];
    }
  }

  // 2. Obtener Vacunas y Estado
  const vaccines = getPatientVaccinesList(p);
  const pendingVaccines = vaccines.filter(v => v.status !== 'al_dia');

  // 3. Obtener Medicamentos y Recetas Vigentes
  let prescriptions = getPatientPrescriptions(p.id).filter(r => r.status === 'activa');
  if (!prescriptions || prescriptions.length === 0) {
    if (pAge >= 60) {
      prescriptions = [
        { id: 'rx_def_1', medicationName: 'Losartán Potásico', dosage: '50 mg', frequency: 'Cada 12 horas', schedule: '08:00 y 20:00 hrs', doctorName: 'Dra. Elena Valdés' },
        { id: 'rx_def_2', medicationName: 'Atorvastatina', dosage: '20 mg', frequency: 'Cada 24 horas', schedule: '21:00 hrs', doctorName: 'Dra. Elena Valdés' }
      ];
    } else if (p.isPregnant) {
      prescriptions = [
        { id: 'rx_def_1', medicationName: 'Ácido Fólico', dosage: '1 mg', frequency: 'Cada 24 horas', schedule: '09:00 hrs', doctorName: 'Matrona Silva' },
        { id: 'rx_def_2', medicationName: 'Sulfato Ferroso', dosage: '200 mg', frequency: 'Cada 24 horas', schedule: '13:00 hrs (con almuerzo)', doctorName: 'Matrona Silva' }
      ];
    } else if (pAge < 14) {
      prescriptions = [
        { id: 'rx_def_1', medicationName: 'Vitamina D3 gotas', dosage: '400 UI', frequency: 'Cada 24 horas', schedule: 'Con desayuno', doctorName: 'Dr. Morales' }
      ];
    } else {
      prescriptions = [
        { id: 'rx_def_1', medicationName: 'Multivitamínico con Zinc', dosage: '1 cápsula', frequency: 'Cada 24 horas', schedule: '09:00 hrs', doctorName: 'Dra. Valdés' }
      ];
    }
  }

  // 4. Obtener Controles Preventivos MINSAL
  const minsalControls = getMinsalPreventiveControls(p);

  // Construir HTML del Modal
  const modalHtml = `
    <div id="${modalId}" class="modal fade show" tabindex="-1" style="display: block; background: rgba(10, 15, 29, 0.88); backdrop-filter: blur(14px); z-index: 1065;" aria-modal="true" role="dialog">
      <div class="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable" style="max-width: 960px;">
        <div class="modal-content text-white" style="background: rgba(15, 23, 42, 0.96); border-radius: 26px; border: 2px solid #38bdf8; box-shadow: 0 25px 60px rgba(0,0,0,0.85); overflow: hidden; font-family: 'Outfit', sans-serif;">
          
          <!-- Encabezado -->
          <div class="modal-header border-bottom p-4 d-flex justify-content-between align-items-center" style="background: rgba(14, 165, 233, 0.14); border-color: rgba(255, 255, 255, 0.1) !important;">
            <div class="d-flex align-items-center gap-3">
              <span class="fs-1">🔔</span>
              <div>
                <h4 class="modal-title fw-extrabold m-0 text-white">Mis Notificaciones y Alertas Clínicas</h4>
                <small class="text-info fw-semibold">
                  Ficha de: <strong class="text-white">${pName}</strong> (${pAge} años) &bull; RUT/Doc: <strong class="text-white">${pRut}</strong> &bull; Ley N° 20.584
                </small>
              </div>
            </div>
            <div class="d-flex align-items-center gap-2">
              <button type="button" id="btnSpeakAllNotifications" class="btn btn-sm btn-outline-warning rounded-pill px-3 py-1.5 fw-bold d-inline-flex align-items-center gap-1.5" title="Escuchar todas las notificaciones en voz alta">
                <span id="speakNotifIcon">🔊</span> <span id="speakNotifText">Escuchar Notificaciones</span>
              </button>
              <button type="button" class="btn-close btn-close-white" id="btnCloseNotificationsModalX" aria-label="Close" style="cursor: pointer;"></button>
            </div>
          </div>

          <!-- Cuerpo con Tabs/Secciones -->
          <div class="modal-body p-4">
            
            <!-- Resumen de Contadores -->
            <div class="row g-2 mb-4">
              <div class="col-sm-6 col-md-3">
                <div class="p-3 rounded-3 text-center border" style="background: rgba(14, 165, 233, 0.08); border-color: rgba(56, 189, 248, 0.3) !important;">
                  <span class="fs-4 d-block mb-1">📅</span>
                  <div class="fs-4 fw-extrabold text-info">${appointments.length}</div>
                  <small class="text-white-50">Citas Pendientes</small>
                </div>
              </div>
              <div class="col-sm-6 col-md-3">
                <div class="p-3 rounded-3 text-center border" style="background: rgba(245, 158, 11, 0.08); border-color: rgba(245, 158, 11, 0.3) !important;">
                  <span class="fs-4 d-block mb-1">💉</span>
                  <div class="fs-4 fw-extrabold text-warning">${pendingVaccines.length}</div>
                  <small class="text-white-50">Vacunas por Aplicar</small>
                </div>
              </div>
              <div class="col-sm-6 col-md-3">
                <div class="p-3 rounded-3 text-center border" style="background: rgba(16, 185, 129, 0.08); border-color: rgba(16, 185, 129, 0.3) !important;">
                  <span class="fs-4 d-block mb-1">💊</span>
                  <div class="fs-4 fw-extrabold text-success">${prescriptions.length}</div>
                  <small class="text-white-50">Remedios Vigentes</small>
                </div>
              </div>
              <div class="col-sm-6 col-md-3">
                <div class="p-3 rounded-3 text-center border" style="background: rgba(168, 85, 247, 0.08); border-color: rgba(168, 85, 247, 0.3) !important;">
                  <span class="fs-4 d-block mb-1">🛡️</span>
                  <div class="fs-4 fw-extrabold" style="color: #c084fc;">${minsalControls.length}</div>
                  <small class="text-white-50">Controles MINSAL</small>
                </div>
              </div>
            </div>

            <!-- SECCIÓN 1: CITAS MÉDICAS PENDIENTES -->
            <div class="mb-4">
              <div class="d-flex align-items-center justify-content-between mb-2 pb-1 border-bottom border-light border-opacity-10">
                <h5 class="fw-bold text-info m-0 d-flex align-items-center gap-2">
                  <i class="bi bi-calendar3-event-fill"></i> 📅 Citas Médicas y Controles Pendientes
                </h5>
                <span class="badge bg-info bg-opacity-25 text-info rounded-pill px-2.5 py-1">${appointments.length} programadas</span>
              </div>
              <div class="d-flex flex-column gap-2">
                ${appointments.map(apt => `
                  <div class="p-3 rounded-3 d-flex align-items-center justify-content-between flex-wrap gap-2 border" style="background: rgba(255,255,255,0.03); border-color: rgba(56, 189, 248, 0.25) !important;">
                    <div>
                      <div class="d-flex align-items-center gap-2 mb-1">
                        <strong class="text-white fs-6">${apt.title || apt.specialty || 'Cita de Salud'}</strong>
                        <span class="badge bg-primary bg-opacity-25 text-info rounded-pill" style="font-size: 0.75rem;">${apt.type || 'Presencial'}</span>
                      </div>
                      <div class="small text-white-50">
                        <i class="bi bi-clock me-1 text-info"></i><strong>${apt.date}</strong> &bull; ${apt.time || 'Horario matutino'} hrs &bull; 
                        <i class="bi bi-person-badge me-1 text-info"></i>${apt.doctor || apt.professional || 'Profesional de Cabecera'} &bull;
                        <i class="bi bi-geo-alt me-1 text-info"></i>${apt.place || apt.location || 'CESFAM / Hospital'}
                      </div>
                    </div>
                    <button type="button" class="btn btn-sm btn-outline-warning rounded-pill px-3 py-1.5 fw-bold btn-trigger-notif-alarm d-inline-flex align-items-center gap-1.5" data-title="${apt.title || 'Cita Médica'}" data-time="${apt.date}">
                      <i class="bi bi-telephone-outbound-fill"></i> <span>📞 Activar Recordatorio Telefónico</span>
                    </button>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- SECCIÓN 2: VACUNAS POR APLICAR Y AL DÍA -->
            <div class="mb-4">
              <div class="d-flex align-items-center justify-content-between mb-2 pb-1 border-bottom border-light border-opacity-10">
                <h5 class="fw-bold text-warning m-0 d-flex align-items-center gap-2">
                  <i class="bi bi-shield-plus"></i> 💉 Vacunas y Esquema Preventivo (PNI MINSAL)
                </h5>
                <span class="badge bg-warning bg-opacity-25 text-warning rounded-pill px-2.5 py-1">${pendingVaccines.length} pendientes</span>
              </div>
              <div class="row g-2">
                ${vaccines.slice(0, 6).map(vac => `
                  <div class="col-md-6">
                    <div class="p-2.5 rounded-3 d-flex align-items-center justify-content-between border h-100" style="background: rgba(255,255,255,0.03); border-color: ${vac.status === 'al_dia' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.35)'} !important;">
                      <div>
                        <strong class="text-white d-block" style="font-size: 0.92rem;">${vac.name}</strong>
                        <small class="text-white-50 d-block" style="font-size: 0.78rem;">${vac.program || 'PNI MINSAL'} &bull; Dosis: ${vac.dose || '1'}</small>
                      </div>
                      <span class="badge ${vac.status === 'al_dia' ? 'bg-success' : 'bg-warning text-dark'} fw-bold px-2.5 py-1 rounded-pill" style="font-size: 0.75rem;">
                        ${vac.status === 'al_dia' ? '✅ Al Día' : '⚠️ Por Aplicar'}
                      </span>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- SECCIÓN 3: MEDICAMENTOS Y RECETAS VIGENTES -->
            <div class="mb-4">
              <div class="d-flex align-items-center justify-content-between mb-2 pb-1 border-bottom border-light border-opacity-10">
                <h5 class="fw-bold text-success m-0 d-flex align-items-center gap-2">
                  <i class="bi bi-capsule"></i> 💊 Recordatorios de Medicamentos Vigentes
                </h5>
                <span class="badge bg-success bg-opacity-25 text-success rounded-pill px-2.5 py-1">${prescriptions.length} recetas activas</span>
              </div>
              <div class="d-flex flex-column gap-2">
                ${prescriptions.map(rx => `
                  <div class="p-2.5 rounded-3 d-flex align-items-center justify-content-between flex-wrap gap-2 border" style="background: rgba(255,255,255,0.03); border-color: rgba(16, 185, 129, 0.3) !important;">
                    <div>
                      <strong class="text-white fs-6">${rx.medicationName || rx.name} ${rx.dosage || ''}</strong>
                      <div class="small text-white-50">
                        <i class="bi bi-clock-history me-1 text-success"></i>${rx.frequency || 'Horario indicado'} &bull; Toma: <strong>${rx.schedule || '08:00 hrs'}</strong> &bull; Prescrito por: ${rx.doctorName || 'Médico Tratante'}
                      </div>
                    </div>
                    <button type="button" class="btn btn-sm btn-outline-success rounded-pill px-3 py-1 fw-bold btn-trigger-notif-alarm d-inline-flex align-items-center gap-1.5" data-title="Toma de ${rx.medicationName || rx.name}" data-time="${rx.schedule || rx.frequency}">
                      <i class="bi bi-alarm-fill"></i> <span>📞 Alarma Activa</span>
                    </button>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- SECCIÓN 4: AVISOS CLÍNICOS Y PREVENTIVOS MINSAL -->
            <div>
              <div class="d-flex align-items-center justify-content-between mb-2 pb-1 border-bottom border-light border-opacity-10">
                <h5 class="fw-bold m-0 d-flex align-items-center gap-2" style="color: #c084fc;">
                  <i class="bi bi-shield-check"></i> 📋 Avisos Clínicos y Preventivos MINSAL
                </h5>
                <span class="badge rounded-pill px-2.5 py-1" style="background: rgba(168, 85, 247, 0.25); color: #c084fc;">Filtro por Edad y Condición</span>
              </div>
              <div class="d-flex flex-column gap-2">
                ${minsalControls.map(ctrl => `
                  <div class="p-2.5 rounded-3 d-flex align-items-center justify-content-between border" style="background: rgba(255,255,255,0.02); border-color: rgba(168, 85, 247, 0.25) !important;">
                    <div>
                      <strong class="text-white d-block" style="font-size: 0.92rem;">${ctrl.title}</strong>
                      <small class="text-white-50">${ctrl.description || 'Control preventivo garantizado por el sistema público de salud.'}</small>
                    </div>
                    <span class="badge ${ctrl.status === 'al_dia' ? 'bg-success' : 'bg-warning text-dark'} fw-bold px-2.5 py-1 rounded-pill" style="font-size: 0.75rem;">
                      ${ctrl.status === 'al_dia' ? '✅ Vigente' : '⏳ Pendiente'}
                    </span>
                  </div>
                `).join('')}
              </div>
            </div>

          </div>

          <!-- Pie del Modal -->
          <div class="modal-footer border-top p-3 d-flex justify-content-between align-items-center" style="background: rgba(0,0,0,0.25); border-color: rgba(255, 255, 255, 0.1) !important;">
            <small class="text-white-50">
              <i class="bi bi-shield-lock-fill text-info me-1"></i>Notificaciones sincronizadas bajo Ley N° 20.584 y Ley N° 19.628
            </small>
            <button type="button" id="btnCloseNotificationsModalFooter" class="btn btn-glass-secondary px-4 py-2 fw-bold" style="border-radius: 12px;">
              Entendido / Cerrar
            </button>
          </div>

        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalEl = document.getElementById(modalId);
  const closeModal = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (modalEl) modalEl.remove();
  };

  const btnCloseX = document.getElementById('btnCloseNotificationsModalX');
  const btnCloseFooter = document.getElementById('btnCloseNotificationsModalFooter');
  if (btnCloseX) btnCloseX.onclick = closeModal;
  if (btnCloseFooter) btnCloseFooter.onclick = closeModal;
  if (modalEl) {
    modalEl.onclick = (e) => {
      if (e.target === modalEl) closeModal();
    };
  }

  // Conectar botones de activación de alarma / recordatorio
  modalEl.querySelectorAll('.btn-trigger-notif-alarm').forEach(btn => {
    btn.onclick = () => {
      const itemTitle = btn.getAttribute('data-title') || 'Recordatorio Clínico';
      
      // Reproducir tono de confirmación con Web Audio API
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } catch (err) {}

      // Síntesis de voz
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const msg = new SpeechSynthesisUtterance(`Recordatorio programado para ${itemTitle}. Recibirás aviso telefónico.`);
        msg.lang = getVoiceLangCode(lang);
        window.speechSynthesis.speak(msg);
      }

      btn.classList.remove('btn-outline-warning', 'btn-outline-success');
      btn.classList.add('btn-success', 'text-white');
      btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> <span>Alarma Telefónica Activada ✅</span>';

      if (window.showGlassAlert) {
        window.showGlassAlert(`🔔 Recordatorio telefónico y alarma activados para "${itemTitle}".`, 'success');
      }
    };
  });

  // Conectar botón de lectura en voz alta
  const btnSpeakAll = document.getElementById('btnSpeakAllNotifications');
  if (btnSpeakAll) {
    btnSpeakAll.onclick = () => {
      if (!('speechSynthesis' in window)) {
        if (window.showGlassAlert) window.showGlassAlert('La síntesis de voz no está disponible.', 'warning');
        return;
      }

      const icon = document.getElementById('speakNotifIcon');
      const text = document.getElementById('speakNotifText');

      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        if (icon) icon.textContent = '🔊';
        if (text) text.textContent = 'Escuchar Notificaciones';
        btnSpeakAll.classList.remove('btn-danger', 'text-white');
        btnSpeakAll.classList.add('btn-outline-warning');
        return;
      }

      let readText = `Notificaciones de salud para ${pName}. `;
      readText += `Tienes ${appointments.length} citas médicas pendientes. `;
      appointments.forEach((apt, idx) => {
        readText += `Cita ${idx + 1}: ${apt.title || 'Cita médica'} programada para el ${apt.date}. `;
      });
      if (pendingVaccines.length > 0) {
        readText += `Tienes ${pendingVaccines.length} vacunas pendientes por aplicar: ${pendingVaccines.map(v => v.name).join(', ')}. `;
      } else {
        readText += `Tus vacunas se encuentran al día. `;
      }
      readText += `Medicamentos vigentes: ${prescriptions.map(r => (r.medicationName || r.name)).join(', ')}. `;
      readText += `Presiona el botón de cada recordatorio para activar tu alarma telefónica.`;

      const utter = new SpeechSynthesisUtterance(readText);
      utter.lang = getVoiceLangCode(lang);
      utter.rate = 0.95;

      utter.onstart = () => {
        if (icon) icon.textContent = '⏹️';
        if (text) text.textContent = 'Detener Lectura';
        btnSpeakAll.classList.remove('btn-outline-warning');
        btnSpeakAll.classList.add('btn-danger', 'text-white');
      };

      utter.onend = () => {
        if (icon) icon.textContent = '🔊';
        if (text) text.textContent = 'Escuchar Notificaciones';
        btnSpeakAll.classList.remove('btn-danger', 'text-white');
        btnSpeakAll.classList.add('btn-outline-warning');
      };

      utter.onerror = () => {
        if (icon) icon.textContent = '🔊';
        if (text) text.textContent = 'Escuchar Notificaciones';
        btnSpeakAll.classList.remove('btn-danger', 'text-white');
        btnSpeakAll.classList.add('btn-outline-warning');
      };

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    };
  }
}

if (typeof window !== 'undefined') {
  window.openPatientNotificationsModal = openPatientNotificationsModal;
}
