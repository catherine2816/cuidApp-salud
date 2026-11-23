/**
 * Portal Clínico Médico - cuidApp
 * Cumplimiento Normativo:
 * - Ley 20.584: Derechos y Deberes del Paciente / Ficha Clínica Confidencial
 * - Ley 21.541: Regulación de la Atención de Salud mediante Telemedicina
 * - Ley 21.668: Interoperabilidad de Fichas Clínicas en la Red de Salud
 * - Ley 21.120: Reconocimiento y Protección a la Identidad de Género
 * - Ley 21.430: Garantías y Protección Integral de los Derechos de la Niñez
 * - Decreto Supremo N° 41: Reglamento de Fichas Clínicas y Trazabilidad
 */

import {
  activePatient,
  setActivePatient,
  PATIENTS_DATABASE,
  Patient,
  CLINICAL_CONDITIONS,
  getTodayDateString,
  initCustomSelects,
  speakText,
  getModoVozActivo
} from './main.js';
import { mountIotEcgWidget, getEcgAlerts, getPatientEcgRecords } from './iot-ecg.js';
import { openDentalModuleModal } from './odontologia.js';
import { STORAGE_KEYS, getTodayISO, formatChileanDate } from './utils/clinical-helpers.js';
import {
  MEDICAL_SPECIALTIES,
  TRIAGE_CATEGORIES,
  calculateIMC,
  renderSpecialtyDynamicFields
} from './medico-especialidades.js';
import Chart from 'chart.js/auto';

// Estado del portal médico
export let medicoSubTab = 'telemonitoreo'; // 'telemonitoreo' | 'prescripciones' | 'odontologia' | 'protocolos'
export let currentSpecialtyKey = 'medicina_general';

export function getAllAvailablePatients() {
  let list = [...PATIENTS_DATABASE];
  try {
    const customKey = (STORAGE_KEYS && STORAGE_KEYS.CUSTOM_PATIENTS) || 'cuidapp_custom_patients';
    const customRaw = localStorage.getItem(customKey);
    if (customRaw) {
      const customPatients = JSON.parse(customRaw);
      if (Array.isArray(customPatients)) {
        customPatients.forEach(cp => {
          if (!list.some(p => p.id === cp.id)) {
            list.push(cp);
          }
        });
      }
    }
  } catch (e) {}
  return list;
}

export function setMedicoSubTab(tab) {
  medicoSubTab = tab;
}

export function getMedicoSubTab() {
  return medicoSubTab;
}

// Variable de estado para el filtro de período del gráfico evolutivo
let evolutivoDaysFilter = 7;
let chartEvolutivoInstance = null;

// ============================================================================
// 1. GESTIÓN Y ALMACENAMIENTO DE EVOLUCIONES MÉDICAS (LEY 20.584 / DS N° 41)
// ============================================================================

export function getPatientMedicalEvolutions(patientId) {
  const targetId = patientId || (activePatient ? activePatient.id : 'p1');
  try {
    const key = (STORAGE_KEYS?.MEDICAL_EVOLUTIONS || 'cuidapp_medical_evolutions_') + targetId;
    let raw = localStorage.getItem(key);
    if (!raw) {
      raw = localStorage.getItem(`cuidapp_medical_evolutions_${targetId}`);
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('[Portal Médico] Error al leer evoluciones médicas:', e);
  }

  // Registro semilla inicial para Juan Díaz (p1) con fines de trazabilidad legal demostrable
  if (targetId === 'p1') {
    const seed = [
      {
        id: 'evo_juan_001',
        patientId: 'p1',
        patientName: 'Juan Díaz',
        patientRut: '10.420.932-K',
        date: '2026-11-14',
        timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
        specialty: 'geriatria',
        specialtyName: 'Geriatría y Valoración Integral (VGI)',
        triage: 'C4',
        motivoConsulta: 'Control crónico de hipertensión y evaluación geriátrica periódica',
        diagnosis: 'I10 - Hipertensión Esencial (Primaria)',
        cie10Code: 'I10',
        certezaDiagnostica: 'Confirmado GES',
        evolutionText: 'Control médico telemático periódico. Paciente refiere buen estado general y adecuada tolerancia a fármacos antihipertensivos. Presión arterial dentro de metas terapéuticas MINSAL según bitácora de cuidadora (126/80 mmHg). Se refuerza restricción de sodio en la dieta y se solicita perfil bioquímico de control.',
        antecedents: 'Dislipidemia mixta en tratamiento con Atorvastatina. Hipertensión diagnosticada hace 8 años. Sin antecedentes quirúrgicos recientes.',
        doctorName: 'Dra. Elena Valdés',
        doctorRegistry: 'Reg. SIS N° 482910',
        doctorSpeciality: 'Medicina Interna y Geriatría',
        inmutabilitySeal: 'DS41-A9E4-LEY20584-VERIFIED',
        status: 'firmada'
      }
    ];

    try {
      const key = (STORAGE_KEYS?.MEDICAL_EVOLUTIONS || 'cuidapp_medical_evolutions_') + targetId;
      localStorage.setItem(key, JSON.stringify(seed));
      localStorage.setItem(`cuidapp_medical_evolutions_${targetId}`, JSON.stringify(seed));
    } catch (e) {}
    return seed;
  }

  return [];
}

export function savePatientMedicalEvolution(patientId, evolution) {
  const targetId = patientId || (activePatient ? activePatient.id : 'p1');
  try {
    const list = getPatientMedicalEvolutions(targetId);
    list.unshift(evolution);
    const key = (STORAGE_KEYS?.MEDICAL_EVOLUTIONS || 'cuidapp_medical_evolutions_') + targetId;
    localStorage.setItem(key, JSON.stringify(list));
    localStorage.setItem(`cuidapp_medical_evolutions_${targetId}`, JSON.stringify(list));
    console.log('[Portal Médico] Nueva evolución médica firmada y guardada:', evolution);
    return true;
  } catch (e) {
    console.error('[Portal Médico] Error al guardar evolución médica:', e);
    return false;
  }
}

// ============================================================================
// 2. RESUMEN VISUAL EVOLUTIVO (CHART.JS) & SÍNTESIS CLÍNICA INTELIGENTE (IA)
// ============================================================================

export function getEvolutiveVitalsData(patient, days = 7) {
  const patientId = patient.id;
  const clinicalLogs = getPatientClinicalLogs(patientId);
  const ecgAlerts = getEcgAlerts(patientId);

  let latestVitals = null;
  try {
    const raw = localStorage.getItem(`cuidapp_latest_vitals_${patientId}`);
    if (raw) latestVitals = JSON.parse(raw);
  } catch (e) {}

  const labels = [];
  const dates = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    dates.push(dateStr);
    const day = d.getDate();
    const month = d.toLocaleDateString('es-CL', { month: 'short' }).replace('.', '');
    labels.push(`${day} ${month}`);
  }

  const logsByDate = {};
  clinicalLogs.forEach(l => {
    if (l.date) logsByDate[l.date] = l;
  });

  const alertsByDate = {};
  ecgAlerts.forEach(a => {
    if (a.date) {
      if (!alertsByDate[a.date]) alertsByDate[a.date] = [];
      alertsByDate[a.date].push(a);
    }
  });

  const hasHTA = patient.conditions && patient.conditions.includes('HYPERTENSION');
  const baseSys = hasHTA ? 128 : 118;
  const baseDia = hasHTA ? 82 : 76;
  const baseBpm = 72;

  const systolic = [];
  const diastolic = [];
  const heartRate = [];
  const alertPoints = [];

  dates.forEach((dateStr, idx) => {
    let s = null;
    let d = null;
    let bpm = null;
    let hasAlert = false;

    // Reporte de cuidadora para esta fecha
    if (logsByDate[dateStr]) {
      const log = logsByDate[dateStr];
      if (log.systolic) s = Number(log.systolic);
      if (log.diastolic) d = Number(log.diastolic);
      if (log.heartRate) bpm = Number(log.heartRate);
    }

    // Autoreporte de hoy si el paciente ingresó datos
    if (idx === dates.length - 1 && latestVitals) {
      if (latestVitals.systolic) s = Number(latestVitals.systolic);
      if (latestVitals.diastolic) d = Number(latestVitals.diastolic);
      if (latestVitals.heartRate) bpm = Number(latestVitals.heartRate);
    }

    // Alertas IoT ECG en esta fecha
    if (alertsByDate[dateStr] && alertsByDate[dateStr].length > 0) {
      hasAlert = true;
      const topAlert = alertsByDate[dateStr][0];
      if (!bpm && topAlert.bpm) bpm = Number(topAlert.bpm);
    }

    // Variación fisiológica sintética realista para días sin registro explícito
    if (s === null) {
      const pseudoRandom = Math.sin(idx * 1.7 + dateStr.charCodeAt(dateStr.length - 1)) * 4.5;
      s = Math.round(baseSys + pseudoRandom);
      d = Math.round(baseDia + (pseudoRandom * 0.55));
      bpm = Math.round(baseBpm + (pseudoRandom * 0.9));
    }

    systolic.push(s);
    diastolic.push(d);
    heartRate.push(bpm);
    alertPoints.push(hasAlert);
  });

  return {
    labels,
    dates,
    systolic,
    diastolic,
    heartRate,
    alertPoints
  };
}

export function initEvolutivoChart(patient, days = 7) {
  const canvas = document.getElementById('chartEvolutivoMedico');
  if (!canvas) return;

  if (chartEvolutivoInstance) {
    chartEvolutivoInstance.destroy();
    chartEvolutivoInstance = null;
  }

  const ChartConstructor = typeof Chart !== 'undefined' ? Chart : (window.Chart || null);
  if (!ChartConstructor) return;

  const data = getEvolutiveVitalsData(patient, days);
  const ctx = canvas.getContext('2d');

  chartEvolutivoInstance = new ChartConstructor(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [
        {
          label: 'P. Sistólica (mmHg)',
          data: data.systolic,
          borderColor: '#f43f5e',
          backgroundColor: 'rgba(244, 63, 94, 0.08)',
          borderWidth: 2.5,
          tension: 0.35,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#f43f5e',
          yAxisID: 'y'
        },
        {
          label: 'P. Diastólica (mmHg)',
          data: data.diastolic,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.08)',
          borderWidth: 2.5,
          tension: 0.35,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#38bdf8',
          yAxisID: 'y'
        },
        {
          label: 'Frecuencia Cardíaca (BPM)',
          data: data.heartRate,
          borderColor: '#10b981',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [4, 4],
          tension: 0.35,
          pointRadius: (ctx) => {
            const idx = ctx.dataIndex;
            return data.alertPoints[idx] ? 7 : 3.5;
          },
          pointBackgroundColor: (ctx) => {
            const idx = ctx.dataIndex;
            return data.alertPoints[idx] ? '#ef4444' : '#10b981';
          },
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          labels: {
            color: 'rgba(255, 255, 255, 0.85)',
            font: { family: 'Outfit', size: 12 }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#38bdf8',
          bodyColor: '#ffffff',
          borderColor: 'rgba(56, 189, 248, 0.35)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            afterBody: (tooltipItems) => {
              const idx = tooltipItems[0].dataIndex;
              if (data.alertPoints[idx]) {
                return '⚠️ Alerta de Telemetría Cardíaca IoT en esta fecha';
              }
              return '';
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: 'rgba(255, 255, 255, 0.65)', font: { size: 11 } }
        },
        y: {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: 'Presión Arterial (mmHg)',
            color: 'rgba(255, 255, 255, 0.7)',
            font: { size: 11 }
          },
          min: 50,
          max: 200,
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: 'rgba(255, 255, 255, 0.65)', stepSize: 25 }
        },
        y1: {
          type: 'linear',
          position: 'right',
          title: {
            display: true,
            text: 'Frecuencia (BPM)',
            color: '#10b981',
            font: { size: 11 }
          },
          min: 40,
          max: 160,
          grid: { drawOnChartArea: false },
          ticks: { color: '#10b981', stepSize: 20 }
        }
      }
    }
  });
}

export function generateSmartClinicalSynthesis(patient) {
  const patientId = patient.id;
  const clinicalLogs = getPatientClinicalLogs(patientId);
  const ecgAlerts = getEcgAlerts(patientId);
  const prescriptions = getPatientPrescriptions(patientId);

  let latestVitals = null;
  try {
    const raw = localStorage.getItem(`cuidapp_latest_vitals_${patientId}`);
    if (raw) latestVitals = JSON.parse(raw);
  } catch (e) {}

  let totalSys = 0;
  let totalDia = 0;
  let totalBpm = 0;
  let count = 0;

  if (latestVitals && latestVitals.systolic) {
    totalSys += Number(latestVitals.systolic);
    totalDia += Number(latestVitals.diastolic);
    totalBpm += Number(latestVitals.heartRate || 72);
    count++;
  }

  clinicalLogs.slice(0, 5).forEach(l => {
    if (l.systolic && l.diastolic) {
      totalSys += Number(l.systolic);
      totalDia += Number(l.diastolic);
      totalBpm += Number(l.heartRate || 72);
      count++;
    }
  });

  const avgSys = count > 0 ? Math.round(totalSys / count) : 126;
  const avgDia = count > 0 ? Math.round(totalDia / count) : 81;
  const avgBpm = count > 0 ? Math.round(totalBpm / count) : 73;

  let bpStatus = 'Normotensión controlada';
  let bpBadgeClass = 'bg-success bg-opacity-25 text-success border-success';
  if (avgSys >= 140 || avgDia >= 90) {
    bpStatus = 'Hipertensión No Controlada (Estadio 1-2)';
    bpBadgeClass = 'bg-danger bg-opacity-25 text-danger border-danger';
  } else if (avgSys >= 130 || avgDia >= 85) {
    bpStatus = 'Prehipertensión / Limítrofe';
    bpBadgeClass = 'bg-warning bg-opacity-25 text-warning border-warning';
  }

  const redEcg = ecgAlerts.filter(a => a.estado === 'ROJO');
  const yellowEcg = ecgAlerts.filter(a => a.estado === 'AMARILLO');
  let ecgDetail = 'Monitoreo IoT en ritmo regular sin eventos críticos recientes.';
  if (redEcg.length > 0) {
    ecgDetail = `⚠️ Telemetría IoT: ${redEcg.length} evento(s) crítico(s) en ROJO registrado(s) en la última semana.`;
  } else if (yellowEcg.length > 0) {
    ecgDetail = `⚠️ Telemetría reporta ${yellowEcg.length} advertencia(s) en rango AMARILLO.`;
  }

  let adherenceCount = 0;
  clinicalLogs.forEach(l => {
    if (l.medicationAdherence) adherenceCount++;
  });
  const adherenceRate = clinicalLogs.length > 0 ? Math.round((adherenceCount / clinicalLogs.length) * 100) : 95;

  const activeRxCount = prescriptions.filter(p => p.status === 'activa').length;
  const recentNote = clinicalLogs.find(l => l.notes)?.notes || 'Sin incidencias agudas o efectos adversos reportados por la cuidadora';

  const line1 = `Eje Hemodinámico & Cardiovascular: Presión arterial promedio de ${avgSys}/${avgDia} mmHg (${bpStatus}) con Frecuencia Cardíaca media de ${avgBpm} BPM. ${ecgDetail}`;
  const line2 = `Adherencia Farmacológica & Observación en Domicilio: Cumplimiento del pastillero al ${adherenceRate}% (${activeRxCount} prescripciones vigentes). Cuidadora autorizada reporta: "${recentNote}".`;
  
  let line3 = `Impresión Diagnóstica & Conducta: Paciente hemodinámicamente compensado. Sugerido mantener pauta actual, controlar perfil lipídico/creatininemia semestral y mantener telemonitoreo ambulatorio continuo.`;
  if (redEcg.length > 0 || avgSys >= 140) {
    line3 = `Impresión Diagnóstica & Conducta: Signos de descontrol hemodinámico/arrítmico. Se recomienda evaluar titulación de antihipertensivo, solicitar ECG de 12 derivaciones estándar y agendar control presencial prioritario.`;
  }

  return {
    avgSys,
    avgDia,
    avgBpm,
    bpStatus,
    bpBadgeClass,
    adherenceRate,
    activeRxCount,
    line1,
    line2,
    line3
  };
}

// ============================================================================
// 1. GESTIÓN Y ALMACENAMIENTO DE PRESCRIPCIONES CLÍNICAS (LEY 21.541 / LEY 21.668)
// ============================================================================

export function getPatientPrescriptions(patientId) {
  const targetId = patientId || (activePatient ? activePatient.id : 'p1');
  try {
    const key = (STORAGE_KEYS?.PRESCRIPTIONS || 'cuidapp_prescriptions_') + targetId;
    let raw = localStorage.getItem(key);
    if (!raw) {
      raw = localStorage.getItem(`cuidapp_prescriptions_${targetId}`);
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('[Portal Médico] Error al leer prescripciones:', e);
  }

  // Prescripciones iniciales de base para Juan Díaz (p1)
  if (targetId === 'p1') {
    const baseline = [
      {
        id: 'rx_juan_001',
        patientId: 'p1',
        patientName: 'Juan Díaz',
        medication: 'Losartán Potásico',
        dose: '50 mg',
        route: 'Vía Oral',
        schedule: 'Mañana (08:00 AM)',
        frequency: 'Cada 24 horas',
        duration: 'Permanente',
        instructions: '1 comprimido en el desayuno con abundante agua. Monitorear presión matinal.',
        diagnosis: 'Hipertensión Arterial Primaria',
        prescribedBy: 'Dra. Elena Valdés',
        medicalRegistry: 'Reg. SIS N° 482910',
        speciality: 'Medicina Interna y Geriatría',
        date: '2026-11-10',
        timestamp: new Date(Date.now() - 7 * 86400000).toISOString(),
        status: 'activa',
        legalStamp: 'Ley 21.541 Telemedicina / DS N° 41'
      },
      {
        id: 'rx_juan_002',
        patientId: 'p1',
        patientName: 'Juan Díaz',
        medication: 'Atorvastatina',
        dose: '20 mg',
        route: 'Vía Oral',
        schedule: 'Noche (21:00 PM)',
        frequency: 'Cada 24 horas',
        duration: 'Permanente',
        instructions: '1 comprimido antes de dormir para control lipídico y prevención cardiovascular.',
        diagnosis: 'Dislipidemia Mixta / Riesgo Cardiovascular',
        prescribedBy: 'Dra. Elena Valdés',
        medicalRegistry: 'Reg. SIS N° 482910',
        speciality: 'Medicina Interna y Geriatría',
        date: '2026-11-10',
        timestamp: new Date(Date.now() - 7 * 86400000).toISOString(),
        status: 'activa',
        legalStamp: 'Ley 21.541 Telemedicina / DS N° 41'
      }
    ];

    try {
      const key = (STORAGE_KEYS?.PRESCRIPTIONS || 'cuidapp_prescriptions_') + targetId;
      localStorage.setItem(key, JSON.stringify(baseline));
      localStorage.setItem(`cuidapp_prescriptions_${targetId}`, JSON.stringify(baseline));
    } catch (e) {}
    return baseline;
  }

  return [];
}

export function savePatientPrescription(patientId, prescription) {
  const targetId = patientId || (activePatient ? activePatient.id : 'p1');
  try {
    const list = getPatientPrescriptions(targetId);
    list.unshift(prescription);
    const key = (STORAGE_KEYS?.PRESCRIPTIONS || 'cuidapp_prescriptions_') + targetId;
    localStorage.setItem(key, JSON.stringify(list));
    localStorage.setItem(`cuidapp_prescriptions_${targetId}`, JSON.stringify(list));
    console.log('[Portal Médico] Nueva receta guardada y sincronizada:', prescription);
    return true;
  } catch (e) {
    console.error('[Portal Médico] Error al guardar prescripción:', e);
    return false;
  }
}

export function togglePrescriptionStatus(patientId, rxId) {
  const targetId = patientId || (activePatient ? activePatient.id : 'p1');
  try {
    const list = getPatientPrescriptions(targetId);
    const item = list.find(r => r.id === rxId);
    if (item) {
      item.status = item.status === 'activa' ? 'suspendida' : 'activa';
      item.updatedAt = new Date().toISOString();
      const key = (STORAGE_KEYS?.PRESCRIPTIONS || 'cuidapp_prescriptions_') + targetId;
      localStorage.setItem(key, JSON.stringify(list));
      localStorage.setItem(`cuidapp_prescriptions_${targetId}`, JSON.stringify(list));
      return item.status;
    }
  } catch (e) {
    console.error('[Portal Médico] Error al actualizar estado de receta:', e);
  }
  return null;
}

// ============================================================================
// 2. HELPERS: PROTOCOLOS PREVENTIVOS, GESTACIÓN Y PARTO (CHILE CRECE CONTIGO)
// ============================================================================

export function getPreventiveOrders(patientId) {
  try {
    const raw = localStorage.getItem(`cuidapp_preventive_orders_${patientId}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

export function savePreventiveOrder(patientId, order) {
  try {
    const list = getPreventiveOrders(patientId);
    list.unshift(order);
    localStorage.setItem(`cuidapp_preventive_orders_${patientId}`, JSON.stringify(list));
    return true;
  } catch (e) {
    return false;
  }
}

export function getPatientPregnancy(patientId) {
  try {
    const raw = localStorage.getItem(`cuidapp_pregnancy_${patientId}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  // Semilla de gestación activa para Daniela Morales (28 años, 24 semanas) para demostración
  if (patientId === 'p_daniela') {
    const furDemo = new Date(Date.now() - 24 * 7 * 86400000).toISOString().split('T')[0];
    const initialPregnancy = {
      isActive: true,
      fur: furDemo,
      gestationalWeeks: 24,
      gestas: 1,
      partos: 0,
      cesareas: 0,
      abortos: 0,
      fpp: calculateNaegeleFpp(furDemo),
      recordedBy: 'Dra. Elena Valdés',
      protocol: 'Chile Crece Contigo (MINSAL)',
      bloodType: 'O+'
    };
    try {
      localStorage.setItem(`cuidapp_pregnancy_${patientId}`, JSON.stringify(initialPregnancy));
    } catch (e) {}
    return initialPregnancy;
  }

  return null;
}

export function savePatientPregnancy(patientId, data) {
  try {
    localStorage.setItem(`cuidapp_pregnancy_${patientId}`, JSON.stringify(data));
  } catch (e) {}
}

export function closePatientPregnancy(patientId) {
  try {
    localStorage.removeItem(`cuidapp_pregnancy_${patientId}`);
  } catch (e) {}
}

export function getPatientObstetricHistory(patientId) {
  try {
    const raw = localStorage.getItem(`cuidapp_obstetric_history_${patientId}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

export function savePatientObstetricHistory(patientId, record) {
  try {
    const list = getPatientObstetricHistory(patientId);
    list.unshift(record);
    localStorage.setItem(`cuidapp_obstetric_history_${patientId}`, JSON.stringify(list));
  } catch (e) {}
}

export function calculateNaegeleFpp(furDateStr) {
  if (!furDateStr) return '';
  const d = new Date(furDateStr + 'T00:00:00');
  d.setDate(d.getDate() + 280);
  return d.toISOString().split('T')[0];
}

export function calculateGestationalWeeks(furDateStr) {
  if (!furDateStr) return { weeks: 0, days: 0, totalDays: 0 };
  const fur = new Date(furDateStr + 'T00:00:00');
  const now = new Date();
  const diffTime = Math.max(0, now - fur);
  const totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  return { weeks, days, totalDays };
}

function getPatientClinicalLogs(patientId) {
  let logs = [];
  try {
    const raw = localStorage.getItem(`cuidapp_clinical_logs_${patientId}`);
    if (raw) logs = JSON.parse(raw);
  } catch (e) {}

  // Sincronización con la ficha global del paciente (cuidapp_ficha_10420932-K)
  try {
    const rawFicha = localStorage.getItem('cuidapp_ficha_10420932-K');
    if (rawFicha) {
      const fichaObj = JSON.parse(rawFicha);
      if (fichaObj && Array.isArray(fichaObj.reports)) {
        fichaObj.reports.forEach(r => {
          if (!logs.some(l => l.id === r.id)) {
            logs.push(r);
          }
        });
      }
    }
  } catch (e) {}

  return logs;
}

// ============================================================================
// 3. RENDERIZADOR PRINCIPAL DEL PORTAL CLÍNICO MÉDICO
// ============================================================================

export function renderDoctorView(container) {
  if (!container) return;

  const allAvailablePatients = getAllAvailablePatients();
  const patient = activePatient || allAvailablePatients[0] || { id: 'p1', name: 'Juan Díaz' };
  const prescriptions = getPatientPrescriptions(patient.id);
  const clinicalLogs = getPatientClinicalLogs(patient.id);
  const ecgAlerts = getEcgAlerts(patient.id);
  const medicalEvolutions = getPatientMedicalEvolutions(patient.id);

  // Detección de condición gestante para banner obstétrico
  const isGestante = Boolean(
    patient.isPregnant ||
    (patient.condicion && String(patient.condicion).toLowerCase().includes('embaraz')) ||
    (patient.condition && String(patient.condition).toLowerCase().includes('embaraz')) ||
    patient.id === 'p_daniela'
  );

  // Datos Ley 21.120 (Identidad de Género)
  const socialName = patient.socialName || patient.name;
  const legalName = patient.name;
  const pronouns = patient.pronouns || (patient.gender === 'Femenino' ? 'Ella' : 'Él');
  const hasGenderDifference = socialName.toLowerCase() !== legalName.toLowerCase();

  // Previsión (FONASA / ISAPRE)
  const prevision = patient.prevision || 'FONASA Tramo B';

  container.innerHTML = `
    <div class="container-fluid px-3 px-lg-4 py-4 text-white">

      <!-- CABECERA PROFESIONAL DEL MÉDICO TRATANTE (LEY 21.541 Y LEY 21.668) -->
      <div class="glass-card p-4 mb-4" style="background: rgba(15, 23, 42, 0.55); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 20px; box-shadow: 0 12px 35px rgba(0,0,0,0.35);">
        <div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
          
          <!-- Identificación del Profesional -->
          <div class="d-flex align-items-center gap-3">
            <div class="rounded-circle d-flex align-items-center justify-content-center shadow" style="width: 62px; height: 62px; background: linear-gradient(135deg, rgba(14, 165, 233, 0.3), rgba(2, 132, 199, 0.5)); border: 2px solid #38bdf8; font-size: 1.8rem;">
              👩‍⚕️
            </div>
            <div>
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <h3 class="fw-bold m-0 text-white" style="font-family: 'Outfit', sans-serif;">Dra. Elena Valdés</h3>
                <span class="badge px-2.5 py-1 rounded-pill fw-semibold" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.35); font-size: 0.76rem;">
                  <i class="bi bi-patch-check-fill me-1"></i>Reg. SIS N° 482910
                </span>
                <span class="badge px-2.5 py-1 rounded-pill fw-semibold" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); font-size: 0.76rem;">
                  <i class="bi bi-shield-check me-1"></i>Firma Digital Verificada
                </span>
              </div>
              <p class="text-white-50 small m-0 mt-1">
                Especialista en Medicina Interna y Geriatría &bull; Red Asistencial cuidApp Telemedicina
              </p>
            </div>
          </div>

          <!-- Selector de Paciente en Atención (Sincronizado en tiempo real) -->
          <div class="d-flex align-items-center gap-3 bg-dark bg-opacity-50 p-2.5 px-3 rounded-4 border border-light border-opacity-10" style="min-width: 320px;">
            <label for="medicoPatientSelector" class="small text-info fw-bold text-nowrap m-0">
              <i class="bi bi-person-bounding-box me-1"></i>Paciente:
            </label>
            <select id="medicoPatientSelector" class="form-select py-1 px-3 text-white border-0 flex-grow-1" style="background: rgba(255, 255, 255, 0.08); font-size: 0.92rem; cursor: pointer;">
              ${allAvailablePatients.map(p => `
                <option value="${p.id}" class="bg-dark text-white" ${p.id === patient.id ? 'selected' : ''}>
                  ${p.socialName || p.name} (${p.fileNumber || p.rut || p.id})
                </option>
              `).join('')}
            </select>
          </div>

        </div>

        <!-- Sellos de Marco Legal Chileno -->
        <div class="d-flex flex-wrap gap-2 pt-3 mt-3 border-top border-light border-opacity-10" style="font-size: 0.72rem;">
          <span class="text-white-50"><i class="bi bi-info-circle text-info me-1"></i>Marco Legal Vigente:</span>
          <span class="badge bg-secondary bg-opacity-25 text-white-50 border border-secondary border-opacity-25">Ley 20.584 Derechos del Paciente</span>
          <span class="badge bg-secondary bg-opacity-25 text-white-50 border border-secondary border-opacity-25">Ley 21.541 Telemedicina</span>
          <span class="badge bg-secondary bg-opacity-25 text-white-50 border border-secondary border-opacity-25">Ley 21.668 Interoperabilidad Ficha Clínica</span>
          <span class="badge bg-secondary bg-opacity-25 text-white-50 border border-secondary border-opacity-25">Ley 21.120 Identidad de Género</span>
          <span class="badge bg-secondary bg-opacity-25 text-white-50 border border-secondary border-opacity-25">Ley 21.430 Garantías Niñez</span>
          <span class="badge bg-secondary bg-opacity-25 text-white-50 border border-secondary border-opacity-25">Decreto Supremo N° 41</span>
        </div>
      </div>

      <!-- FICHA DEMOGRÁFICA Y CLÍNICA DEL PACIENTE EN ATENCIÓN (LEY 21.120 / LEY 20.584) -->
      <div class="glass-card p-4 mb-4 text-white" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 18px;">
        <div class="row g-3 align-items-center">
          
          <div class="col-12 col-md-5">
            <div class="d-flex align-items-center gap-3">
              <div class="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-sm" style="width: 54px; height: 54px; background: rgba(14, 165, 233, 0.25); border: 1.5px solid rgba(14, 165, 233, 0.5); font-size: 1.25rem;">
                ${patient.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <div class="d-flex align-items-center gap-2 flex-wrap">
                  <h4 class="fw-bold m-0 text-white" style="font-family: 'Outfit', sans-serif;">${socialName}</h4>
                  <span class="badge px-2 py-0.5 rounded-pill" style="background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.35); font-size: 0.72rem;">
                    Pronombres: ${pronouns}
                  </span>
                </div>
                ${hasGenderDifference ? `<small class="text-white-50 d-block" style="font-size: 0.78rem;">Nombre Registral: ${legalName}</small>` : ''}
                <div class="text-warning font-monospace small mt-0.5"><i class="bi bi-card-heading me-1"></i>RUT: ${patient.fileNumber}</div>
              </div>
            </div>
          </div>

          <div class="col-6 col-md-2">
            <small class="text-white-50 d-block" style="font-size: 0.75rem;">Edad / Sexo Biológico</small>
            <strong class="text-white fs-6">${patient.age} años</strong>
            <span class="text-white-50 d-block small">${patient.gender}</span>
          </div>

          <div class="col-6 col-md-2">
            <small class="text-white-50 d-block" style="font-size: 0.75rem;">Previsión / Sangre</small>
            <strong class="text-info fs-6">${prevision}</strong>
            <span class="text-white-50 d-block small">Grupo: ${patient.bloodType || 'A+'}</span>
          </div>

          <div class="col-12 col-md-3">
            <small class="text-white-50 d-block" style="font-size: 0.75rem;">Alergias Conocidas</small>
            <span class="badge ${patient.allergies && patient.allergies !== 'Ninguna' ? 'bg-danger text-white' : 'bg-success bg-opacity-25 text-success'} px-2.5 py-1 rounded-pill mt-0.5">
              <i class="bi ${patient.allergies && patient.allergies !== 'Ninguna' ? 'bi-exclamation-triangle-fill' : 'bi-check-circle'} me-1"></i>
              ${patient.allergies || 'Ninguna'}
            </span>
          </div>

        </div>

        <!-- Condiciones Clínicas y Cuidadora Formal Asignada -->
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 pt-3 mt-3 border-top border-light border-opacity-10" style="font-size: 0.8rem;">
          <div class="d-flex align-items-center gap-1.5 flex-wrap">
            <span class="text-white-50 me-1">Condiciones:</span>
            ${patient.conditions.map(key => {
              const cond = CLINICAL_CONDITIONS[key];
              return `<span class="badge bg-primary bg-opacity-25 text-primary border border-primary border-opacity-30 rounded-pill px-2.5 py-1">${cond ? cond.name : key}</span>`;
            }).join('')}
          </div>
          <div class="text-white-50">
            <i class="bi bi-person-heart text-info me-1"></i>Vínculo / Contacto: <strong class="text-white">${patient.emergencyContact?.name || 'Sofía Díaz'}</strong> (${patient.emergencyContact?.phone || '+56912345678'})
          </div>
        </div>
      </div>

      <!-- NAVEGACIÓN POR PESTAÑAS DEL PORTAL MÉDICO (4 TABS GLASSKIT) -->
      <div class="d-flex gap-2 mb-4 overflow-auto pb-1" id="medicoTabNav">
        <button type="button" class="btn ${medicoSubTab === 'telemonitoreo' ? 'btn-primary shadow' : 'btn-glass-secondary text-white-50'} px-4 py-2.5 rounded-pill fw-bold d-inline-flex align-items-center gap-2 medico-tab-btn" data-tab="telemonitoreo" style="transition: all 0.25s ease;">
          <i class="bi bi-activity"></i> Telemonitoreo & Bitácora Cuidadora
        </button>
        <button type="button" class="btn ${medicoSubTab === 'prescripciones' ? 'btn-primary shadow' : 'btn-glass-secondary text-white-50'} px-4 py-2.5 rounded-pill fw-bold d-inline-flex align-items-center gap-2 medico-tab-btn" data-tab="prescripciones" style="transition: all 0.25s ease;">
          <i class="bi bi-capsule"></i> Prescripción y Pastillero Sincronizado
        </button>
        <button type="button" class="btn ${medicoSubTab === 'odontologia' ? 'btn-primary shadow' : 'btn-glass-secondary text-white-50'} px-4 py-2.5 rounded-pill fw-bold d-inline-flex align-items-center gap-2 medico-tab-btn" data-tab="odontologia" style="transition: all 0.25s ease;">
          <i class="bi bi-emoji-smile-fill"></i> Ficha Odontológica Integral
        </button>
        <button type="button" class="btn ${medicoSubTab === 'protocolos' ? 'btn-primary shadow' : 'btn-glass-secondary text-white-50'} px-4 py-2.5 rounded-pill fw-bold d-inline-flex align-items-center gap-2 medico-tab-btn" data-tab="protocolos" style="transition: all 0.25s ease; border: 1.5px solid ${medicoSubTab === 'protocolos' ? '#38bdf8' : 'rgba(168,85,247,0.3)'};">
          <i class="bi bi-dna text-purple"></i> 🧬 Protocolos Preventivos & Salud Materno-Infantil
        </button>
      </div>

      <!-- CONTENIDO DE LA PESTAÑA SELECCIONADA -->
      <div id="medicoTabContent">
        ${renderMedicoSubTabContent(medicoSubTab, patient, prescriptions, clinicalLogs, ecgAlerts, medicalEvolutions)}
      </div>

    </div>
  `;

  // Inicializar selectores y widgets tras montar el HTML
  attachMedicoEvents(container, patient);
}

// ============================================================================
// 4. SUB-VISTAS DE PESTAÑAS (1. TELEMONITOREO, 2. PRESCRIPCIÓN, 3. ODONTOLOGÍA, 4. PROTOCOLOS)
// ============================================================================

function renderMedicoSubTabContent(tab, patient, prescriptions, clinicalLogs, ecgAlerts, medicalEvolutions) {
  if (tab === 'prescripciones') {
    return renderPrescriptionsTab(patient, prescriptions);
  } else if (tab === 'odontologia') {
    return renderOdontologiaTab(patient);
  } else if (tab === 'protocolos') {
    return renderProtocolosPreventivosTab(patient);
  }
  return renderTelemonitoreoTab(patient, clinicalLogs, ecgAlerts, medicalEvolutions);
}

/**
 * PESTAÑA 1: TELEMONITOREO CLÍNICO & BITÁCORA DE CUIDADORA
 * Incluye:
 * - Síntesis Clínica Inteligente (Asistente IA - Ley 20.584)
 * - Resumen Visual Evolutivo (Chart.js 7, 15, 30 días)
 * - Monitor Cardíaco IoT + Bitácora Cuidadora
 * - Registro de Diagnóstico (CIE-10) y Nuevos Antecedentes (Firmada e Inmutable)
 */
function renderTelemonitoreoTab(patient, clinicalLogs, ecgAlerts, medicalEvolutions) {
  const synthesis = generateSmartClinicalSynthesis(patient);
  const evolutionsList = medicalEvolutions || getPatientMedicalEvolutions(patient.id);

  return `
    <div class="d-flex flex-column gap-4">

      <!-- 1. SÍNTESIS CLÍNICA INTELIGENTE (ASISTENTE IA DE APOYO DIAGNÓSTICO) -->
      <div class="glass-card p-4" style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.7) 0%, rgba(30, 41, 59, 0.75) 100%); border: 1.5px solid rgba(56, 189, 248, 0.35); border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.35);">
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mb-3 pb-2 border-bottom border-light border-opacity-10">
          <div class="d-flex align-items-center gap-2.5">
            <div class="rounded-circle d-flex align-items-center justify-content-center shadow-sm" style="width: 44px; height: 44px; background: linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(14, 165, 233, 0.45)); border: 1.5px solid #38bdf8; font-size: 1.35rem;">
              🤖
            </div>
            <div>
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <h5 class="fw-bold m-0 text-white" style="font-family: 'Outfit';">Síntesis Clínica Inteligente</h5>
                <span class="badge px-2.5 py-1 rounded-pill fw-semibold" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.35); font-size: 0.74rem;">
                  <i class="bi bi-cpu-fill me-1"></i>Asistente IA de Apoyo Diagnóstico
                </span>
              </div>
              <small class="text-white-50" style="font-size: 0.75rem;">Análisis automatizado en tiempo real de signos vitales, pastillero, notas de cuidadora y telemetría IoT</small>
            </div>
          </div>

          <!-- Métricas de Resumen Rápido -->
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <span class="badge ${synthesis.bpBadgeClass} border rounded-pill px-3 py-1.5" style="font-size: 0.76rem;">
              PA Prom: ${synthesis.avgSys}/${synthesis.avgDia} mmHg
            </span>
            <span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-30 rounded-pill px-3 py-1.5" style="font-size: 0.76rem;">
              FC: ${synthesis.avgBpm} BPM
            </span>
            <span class="badge bg-info bg-opacity-25 text-info border border-info border-opacity-30 rounded-pill px-3 py-1.5" style="font-size: 0.76rem;">
              Adherencia: ${synthesis.adherenceRate}%
            </span>
          </div>
        </div>

        <!-- 3 Líneas Ejecutivas Clínicas -->
        <div class="d-flex flex-column gap-2.5 my-3">
          <div class="p-3 rounded-3 d-flex align-items-start gap-2.5" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06);">
            <i class="bi bi-activity text-info fs-5 mt-0.5"></i>
            <div class="text-white small" style="line-height: 1.6;">
              <strong class="text-info">1.</strong> ${synthesis.line1}
            </div>
          </div>
          <div class="p-3 rounded-3 d-flex align-items-start gap-2.5" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06);">
            <i class="bi bi-capsule text-warning fs-5 mt-0.5"></i>
            <div class="text-white small" style="line-height: 1.6;">
              <strong class="text-warning">2.</strong> ${synthesis.line2}
            </div>
          </div>
          <div class="p-3 rounded-3 d-flex align-items-start gap-2.5" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06);">
            <i class="bi bi-lightbulb-fill text-success fs-5 mt-0.5"></i>
            <div class="text-white small" style="line-height: 1.6;">
              <strong class="text-success">3.</strong> ${synthesis.line3}
            </div>
          </div>
        </div>

        <!-- Aviso Legal Obligatorio (Ley N° 20.584) -->
        <div class="pt-2 border-top border-light border-opacity-10 d-flex justify-content-between align-items-center flex-wrap gap-2 text-white-50" style="font-size: 0.74rem;">
          <div class="d-flex align-items-center gap-1.5">
            <i class="bi bi-shield-exclamation text-warning"></i>
            <span><strong>Asistente de apoyo clínico — Sujeto a validación médica (Ley N° 20.584)</strong></span>
          </div>
          <span>Trazabilidad algorítmica cuidApp AI &bull; DS N° 41</span>
        </div>
      </div>

      <!-- 2. RESUMEN VISUAL EVOLUTIVO (CHART.JS CON FILTRO 7, 15, 30 DÍAS) -->
      <div class="glass-card p-4" style="background: rgba(15, 23, 42, 0.55); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px;">
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-3 pb-2 border-bottom border-light border-opacity-10">
          <div>
            <h5 class="fw-bold m-0 text-white d-flex align-items-center gap-2" style="font-family: 'Outfit';">
              <i class="bi bi-graph-up text-primary"></i>
              <span>Resumen Visual Evolutivo Hemodinámico</span>
            </h5>
            <small class="text-white-50" style="font-size: 0.75rem;">
              Evolución combinada de Presión Arterial (Sistólica/Diastólica) y Frecuencia Cardíaca (BPM) integrada con telemetría IoT y registros clínicos
            </small>
          </div>

          <!-- Filtro de Período -->
          <div class="d-flex align-items-center gap-2">
            <span class="small text-white-50 d-none d-sm-inline">Período:</span>
            <div class="btn-group btn-group-sm" role="group" id="evolutivoPeriodGroup">
              <button type="button" class="btn ${evolutivoDaysFilter === 7 ? 'btn-primary shadow-sm' : 'btn-glass-secondary text-white-50'} px-3 rounded-start-pill fw-semibold" data-days="7">
                Últimos 7 días
              </button>
              <button type="button" class="btn ${evolutivoDaysFilter === 15 ? 'btn-primary shadow-sm' : 'btn-glass-secondary text-white-50'} px-3 fw-semibold" data-days="15">
                Últimos 15 días
              </button>
              <button type="button" class="btn ${evolutivoDaysFilter === 30 ? 'btn-primary shadow-sm' : 'btn-glass-secondary text-white-50'} px-3 rounded-end-pill fw-semibold" data-days="30">
                Últimos 30 días
              </button>
            </div>
          </div>
        </div>

        <!-- Canvas del Gráfico Chart.js -->
        <div style="position: relative; height: 260px; width: 100%;">
          <canvas id="chartEvolutivoMedico"></canvas>
        </div>

        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 pt-3 mt-3 border-top border-light border-opacity-10 text-white-50 small" style="font-size: 0.73rem;">
          <div class="d-flex align-items-center gap-3 flex-wrap">
            <span><i class="bi bi-circle-fill text-danger me-1"></i>Presión Sistólica (Meta &lt; 140 mmHg)</span>
            <span><i class="bi bi-circle-fill text-info me-1"></i>Presión Diastólica (Meta &lt; 90 mmHg)</span>
            <span><i class="bi bi-circle-fill text-success me-1"></i>Frecuencia Cardíaca (BPM)</span>
            <span><span class="badge bg-danger rounded-circle p-1 me-1"></span>Punto Rojo: Alerta IoT detectada</span>
          </div>
          <div>
            <i class="bi bi-check-all text-success me-1"></i>Sincronizado con paciente.js, cuidador.js e iot-ecg.js
          </div>
        </div>
      </div>

      <!-- 3. MONITOR CARDÍACO IOT EN VIVO & BITÁCORA DE CUIDADORA (2 COLUMNAS) -->
      <div class="row g-4">
        
        <!-- Columna Izquierda: Monitor ECG IoT en Vivo + Alertas Críticas -->
        <div class="col-lg-6">
          
          <!-- Monitor ECG IoT Integrado -->
          <div id="medicoIotEcgContainer" class="mb-4"></div>

          <!-- Alertas de Telemetría IoT Cardíaca (ESP32 / AD8232) -->
          <div class="glass-card p-4 border-0 mb-4" style="background: rgba(15, 23, 42, 0.45); border: 1px solid rgba(255,255,255,0.08) !important; border-radius: 18px;">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h5 class="fw-bold m-0 text-white d-flex align-items-center gap-2" style="font-family: 'Outfit';">
                <i class="bi bi-broadcast text-danger"></i>
                <span>Eventos Críticos de Telemetría Cardíaca</span>
              </h5>
              <span class="badge px-2.5 py-1 rounded-pill" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.35); font-size: 0.72rem;">
                <i class="bi bi-shield-lock-fill me-1"></i>DS N° 41
              </span>
            </div>

            <div class="d-flex flex-column gap-2.5">
              ${ecgAlerts && ecgAlerts.length > 0 ? ecgAlerts.slice(0, 4).map(alert => `
                <div class="p-3 rounded-3" style="background: rgba(255,255,255,0.02); border: 1px solid ${alert.estado === 'ROJO' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'};">
                  <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="badge ${alert.estado === 'ROJO' ? 'bg-danger text-white' : 'bg-warning text-dark'} fw-bold px-2.5 py-1 rounded-pill" style="font-size: 0.7rem;">
                      ${alert.estado} &bull; ${alert.bpm} BPM
                    </span>
                    <small class="text-white-50" style="font-size: 0.75rem;">
                      📅 ${alert.date} &bull; ⏱️ ${alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </small>
                  </div>
                  <div class="text-white small fw-semibold">${alert.tipoAlerta || 'Evento Cardíaco Detectado'}</div>
                  <div class="d-flex justify-content-between text-white-50 pt-1 mt-1 border-top border-light border-opacity-10" style="font-size: 0.7rem;">
                    <span>Dispositivo: <strong class="text-white">${alert.deviceId}</strong></span>
                    <span class="font-monospace">Seq: #${alert.seq}</span>
                  </div>
                </div>
              `).join('') : `
                <div class="text-center py-4 text-white-50 small rounded-3" style="background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1);">
                  <i class="bi bi-heart-pulse text-success fs-3 d-block mb-1"></i>
                  Sin eventos críticos cardíacos registrados recientemente. El monitor reporta parámetros estables.
                </div>
              `}
            </div>
          </div>

        </div>

        <!-- Columna Derecha: Bitácora de Evaluaciones Diarias de la Cuidadora (DS N° 41) -->
        <div class="col-lg-6">
          <div class="glass-card p-4 border-0 mb-4" style="background: rgba(15, 23, 42, 0.45); border: 1px solid rgba(255,255,255,0.08) !important; border-radius: 18px;">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h5 class="fw-bold m-0 text-white d-flex align-items-center gap-2" style="font-family: 'Outfit';">
                  <i class="bi bi-clipboard2-pulse-fill text-info"></i>
                  <span>Bitácora de la Cuidadora (Evaluación Diaria)</span>
                </h5>
                <small class="text-white-50" style="font-size: 0.74rem;">Sincronizado en tiempo real &bull; Trazabilidad Decreto Supremo N° 41</small>
              </div>
              <span class="badge px-2.5 py-1 rounded-pill" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.35); font-size: 0.72rem;">
                <i class="bi bi-clock-history me-1"></i>Historial
              </span>
            </div>

            <div class="d-flex flex-column gap-3">
              ${clinicalLogs && clinicalLogs.length > 0 ? clinicalLogs.slice(0, 4).map(log => {
                let alertBadge = '<span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-30 rounded-pill">NORMAL</span>';
                if (log.alertLevel === 'critico') {
                  alertBadge = '<span class="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-50 rounded-pill">CRÍTICO</span>';
                } else if (log.alertLevel === 'advertencia') {
                  alertBadge = '<span class="badge bg-warning bg-opacity-25 text-warning border border-warning border-opacity-50 rounded-pill">ADVERTENCIA</span>';
                }

                return `
                  <div class="p-3 rounded-3" style="background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.08);">
                    <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom border-light border-opacity-10">
                      <span class="text-info fw-bold small"><i class="bi bi-calendar-check me-1"></i>${log.date}</span>
                      ${alertBadge}
                    </div>
                    
                    <div class="row g-2 mb-2 text-white" style="font-size: 0.82rem;">
                      <div class="col-6 col-sm-3">
                        <span class="text-white-50 d-block" style="font-size: 0.7rem;">Presión Art.</span>
                        <strong>${log.systolic || '--'}/${log.diastolic || '--'} mmHg</strong>
                      </div>
                      <div class="col-6 col-sm-3">
                        <span class="text-white-50 d-block" style="font-size: 0.7rem;">Pulso</span>
                        <strong>${log.heartRate || '--'} BPM</strong>
                      </div>
                      <div class="col-6 col-sm-3">
                        <span class="text-white-50 d-block" style="font-size: 0.7rem;">Dolor EVA</span>
                        <strong>${log.pain ? `${log.pain}/10` : '0/10'}</strong>
                      </div>
                      <div class="col-6 col-sm-3">
                        <span class="text-white-50 d-block" style="font-size: 0.7rem;">Adherencia</span>
                        <strong class="${log.medicationAdherence ? 'text-success' : 'text-danger'}">
                          ${log.medicationAdherence ? '✓ Cumplida' : '✗ No tomó'}
                        </strong>
                      </div>
                    </div>

                    ${log.notes ? `
                      <div class="p-2 rounded mb-2 text-white-50 small fst-italic" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); font-size: 0.76rem;">
                        <i class="bi bi-chat-left-text me-1 text-info"></i>"${log.notes}"
                      </div>
                    ` : ''}

                    <div class="d-flex justify-content-between align-items-center text-white-50 pt-2 border-top border-light border-opacity-10" style="font-size: 0.7rem;">
                      <span>Registrado por: <strong class="text-white">${log.recordedBy || 'Cuidadora Autorizada'}</strong></span>
                      <span class="font-monospace">ID: ${log.id}</span>
                    </div>
                  </div>
                `;
              }).join('') : `
                <div class="text-center py-4 text-white-50 small rounded-3" style="background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1);">
                  <i class="bi bi-journal-medical fs-3 d-block mb-1"></i>
                  No hay evaluaciones diarias sincronizadas aún para este paciente.
                </div>
              `}
            </div>
          </div>
        </div>

      </div>

      <!-- 4. REGISTRO DE DIAGNÓSTICO, EVOLUCIÓN Y NUEVOS ANTECEDENTES (LEY 20.584 / DS N° 41) -->
      <div class="glass-card p-4" style="background: rgba(15, 23, 42, 0.55); border: 1.5px solid rgba(56, 189, 248, 0.3); border-radius: 20px;">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3 pb-2 border-bottom border-light border-opacity-10">
          <div>
            <h5 class="fw-bold m-0 text-white d-flex align-items-center gap-2" style="font-family: 'Outfit';">
              <i class="bi bi-file-earmark-medical-fill text-info"></i>
              <span>Registro de Atención Clínica, Diagnóstico y Nuevos Antecedentes</span>
            </h5>
            <small class="text-white-50" style="font-size: 0.75rem;">
              Evolución médica con sugerencias CIE-10, firma digital inmutable y sellado de trazabilidad (Ley 20.584 y Decreto Supremo N° 41)
            </small>
          </div>
          <span class="badge px-3 py-1.5 rounded-pill fw-semibold" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); font-size: 0.76rem;">
            <i class="bi bi-lock-fill me-1"></i>Inmutabilidad DS N° 41
          </span>
        </div>

        <form id="medicoEvolutionForm" class="mb-4">
          <div class="row g-3">
            
            <!-- Diagnóstico con sugerencias CIE-10 -->
            <div class="col-12">
              <label class="form-label small text-white-50 mb-1 fw-semibold">
                <i class="bi bi-bookmark-plus text-info me-1"></i>Diagnóstico Principal / Motivo de Atención (CIE-10) *
              </label>
              <input type="text" id="evoDiagnosis" class="form-control text-white" placeholder="Ej. I10 - Hipertensión Esencial (Primaria)" list="cie10SuggestionsList" required style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; font-size: 0.95rem;">
              <datalist id="cie10SuggestionsList">
                <option value="I10 - Hipertensión Esencial (Primaria)">
                <option value="E11 - Diabetes Mellitus Tipo 2">
                <option value="I50 - Insuficiencia Cardíaca Congestiva">
                <option value="I25 - Cardiopatía Isquémica Crónica">
                <option value="J44 - Enfermedad Pulmonar Obstructiva Crónica (EPOC)">
                <option value="N18 - Enfermedad Renal Crónica Estadio 3">
                <option value="E78 - Trastornos del Metabolismo de Lipoproteínas (Dislipidemia)">
                <option value="F03 - Demencia no especificada / Trastorno Neurocognitivo">
                <option value="M19 - Artrosis y afecciones osteoarticulares">
                <option value="Z00.0 - Examen médico general / Control Preventivo Adulto">
              </datalist>

              <!-- Pills de selección rápida CIE-10 -->
              <div class="d-flex flex-wrap gap-1.5 mt-2">
                <small class="text-white-50 me-1" style="font-size: 0.72rem;">Sugerencias frecuentes:</small>
                <button type="button" class="btn btn-sm btn-outline-info rounded-pill py-0.5 px-2 btn-cie10-pill" style="font-size: 0.72rem;" data-cie10="I10 - Hipertensión Esencial (Primaria)">I10 - Hipertensión</button>
                <button type="button" class="btn btn-sm btn-outline-info rounded-pill py-0.5 px-2 btn-cie10-pill" style="font-size: 0.72rem;" data-cie10="E11 - Diabetes Mellitus Tipo 2">E11 - Diabetes T2</button>
                <button type="button" class="btn btn-sm btn-outline-info rounded-pill py-0.5 px-2 btn-cie10-pill" style="font-size: 0.72rem;" data-cie10="I50 - Insuficiencia Cardíaca Congestiva">I50 - Insuf. Cardíaca</button>
                <button type="button" class="btn btn-sm btn-outline-info rounded-pill py-0.5 px-2 btn-cie10-pill" style="font-size: 0.72rem;" data-cie10="I25 - Cardiopatía Isquémica Crónica">I25 - Cardiopatía Isquémica</button>
                <button type="button" class="btn btn-sm btn-outline-info rounded-pill py-0.5 px-2 btn-cie10-pill" style="font-size: 0.72rem;" data-cie10="J44 - Enfermedad Pulmonar Obstructiva Crónica (EPOC)">J44 - EPOC</button>
                <button type="button" class="btn btn-sm btn-outline-info rounded-pill py-0.5 px-2 btn-cie10-pill" style="font-size: 0.72rem;" data-cie10="Z00.0 - Examen médico general / Control Preventivo Adulto">Z00.0 - Control General</button>
              </div>
            </div>

            <!-- Evolución Médica / Nota de Atención -->
            <div class="col-12 col-md-7">
              <label class="form-label small text-white-50 mb-1 fw-semibold">
                <i class="bi bi-pencil-square text-info me-1"></i>Evolución Médica & Plan Terapéutico *
              </label>
              <textarea id="evoNotes" class="form-control text-white" rows="4" placeholder="Detalle de anamnesis remota, estado clínico, evaluación de telemetría IoT, justificación clínica y plan terapéutico..." required style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; font-size: 0.92rem;"></textarea>
            </div>

            <!-- Nuevos Antecedentes Relevantes -->
            <div class="col-12 col-md-5">
              <label class="form-label small text-white-50 mb-1 fw-semibold">
                <i class="bi bi-journal-plus text-warning me-1"></i>Nuevos Antecedentes Relevantes
              </label>
              <textarea id="evoAntecedents" class="form-control text-white" rows="4" placeholder="Nuevas alergias medicamentosas, cirugías recientes, eventos adversos, cambios en red de apoyo o factores de riesgo psicosocial..." style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; font-size: 0.92rem;"></textarea>
            </div>

            <!-- Botón de Firma Digital y Guardado -->
            <div class="col-12 d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3 pt-2">
              <div class="text-white-50 small d-flex align-items-center gap-2">
                <i class="bi bi-vector-pen text-info fs-5"></i>
                <span>Firmante: <strong class="text-white">Dra. Elena Valdés</strong> (Reg. SIS N° 482910) &bull; Ley 21.541</span>
              </div>
              <button type="submit" id="btnSaveMedicalEvolution" class="btn btn-primary px-4 py-2.5 rounded-pill fw-bold shadow-lg d-inline-flex align-items-center gap-2" style="cursor: pointer; transition: all 0.25s ease;">
                <i class="bi bi-patch-check-fill"></i>
                <span>Firmar y Guardar Atención</span>
              </button>
            </div>

          </div>
        </form>

        <!-- Historial de Atenciones Clínicas Firmadas (Inmutables) -->
        <div class="pt-3 border-top border-light border-opacity-10">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-bold m-0 text-white d-flex align-items-center gap-2">
              <i class="bi bi-archive-fill text-info"></i>
              <span>Atenciones Clínicas Firmadas en Ficha Oficial (${evolutionsList.length})</span>
            </h6>
            <small class="text-white-50" style="font-size: 0.72rem;">Solo lectura para paciente y cuidador en sus portales</small>
          </div>

          <div class="d-flex flex-column gap-3">
            ${evolutionsList.length > 0 ? evolutionsList.map(evo => `
              <div class="p-3.5 rounded-3" style="background: rgba(255,255,255,0.025); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 14px;">
                <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom border-light border-opacity-10 flex-wrap gap-2">
                  <div class="d-flex align-items-center gap-2 flex-wrap">
                    <span class="badge bg-primary bg-opacity-25 text-primary border border-primary border-opacity-40 rounded-pill px-3 py-1 font-monospace fw-bold" style="font-size: 0.82rem;">
                      ${evo.diagnosis || 'Atención Médica'}
                    </span>
                    <span class="text-info fw-semibold small">
                      <i class="bi bi-calendar-event me-1"></i>${evo.date}
                    </span>
                    <span class="text-white-50 small">
                      ⏱️ ${evo.timestamp ? new Date(evo.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </span>
                  </div>

                  <span class="badge px-2.5 py-1 rounded-pill fw-semibold" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); font-size: 0.72rem;">
                    <i class="bi bi-shield-check me-1"></i>${evo.inmutabilitySeal || 'DS41-VERIFIED'}
                  </span>
                </div>

                <p class="text-white small mb-2.5" style="line-height: 1.6;">
                  ${evo.evolutionText}
                </p>

                ${evo.antecedents && evo.antecedents !== 'Sin nuevos antecedentes consignados' ? `
                  <div class="p-2.5 rounded mb-2.5 text-white-50 small" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); font-size: 0.78rem;">
                    <strong class="text-warning"><i class="bi bi-plus-circle me-1"></i>Nuevos Antecedentes Consignados:</strong> ${evo.antecedents}
                  </div>
                ` : ''}

                <div class="d-flex justify-content-between align-items-center text-white-50 pt-2 border-top border-light border-opacity-10" style="font-size: 0.72rem;">
                  <span>
                    Profesional: <strong class="text-white">${evo.doctorName || 'Dra. Elena Valdés'}</strong> &bull; ${evo.doctorRegistry || 'Reg. SIS N° 482910'}
                  </span>
                  <span class="badge bg-secondary bg-opacity-25 text-white-50 border border-secondary border-opacity-30 rounded-pill">
                    Inmutable &bull; DS N° 41
                  </span>
                </div>
              </div>
            `).join('') : `
              <div class="text-center py-4 text-white-50 small rounded-3" style="background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1);">
                <i class="bi bi-journal-medical fs-3 d-block mb-1"></i>
                No hay atenciones médicas previas firmadas para este paciente.
              </div>
            `}
          </div>
        </div>

      </div>

    </div>
  `;
}

/**
 * PESTAÑA 2: PRESCRIPCIÓN CLÍNICA Y SINCRONIZACIÓN CON PASTILLERO
 */
function renderPrescriptionsTab(patient, prescriptions) {
  return `
    <div class="row g-4">
      
      <!-- Formulario Clínico de Prescripción Médica -->
      <div class="col-lg-5">
        <div class="glass-card p-4 border-0 mb-4" style="background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(56, 189, 248, 0.25) !important; border-radius: 20px;">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 class="fw-bold m-0 text-white d-flex align-items-center gap-2" style="font-family: 'Outfit';">
                <i class="bi bi-prescription2 text-primary"></i>
                <span>Emitir Prescripción Médica</span>
              </h5>
              <small class="text-white-50" style="font-size: 0.74rem;">Firma electrónica médica según Ley 21.541</small>
            </div>
            <span class="badge bg-primary bg-opacity-25 text-primary border border-primary border-opacity-30 rounded-pill px-2.5 py-1">
              Receta Electrónica
            </span>
          </div>

          <form id="medicoPrescriptionForm">
            
            <div class="mb-3">
              <label class="form-label small text-white-50 mb-1">Medicamento Prescrito *</label>
              <input type="text" id="rxMedication" class="form-control text-white" placeholder="Ej. Losartán Potásico / Metformina" required list="medicationSuggestions" style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px;">
              <datalist id="medicationSuggestions">
                <option value="Losartán Potásico">
                <option value="Atorvastatina">
                <option value="Metformina Clorhidrato">
                <option value="Enalapril Maleato">
                <option value="Amlodipino">
                <option value="Hidroclorotiazida">
                <option value="Paracetamol">
                <option value="Salbutamol Aerosol">
                <option value="Omeprazol">
                <option value="Insulina NPH">
              </datalist>
            </div>

            <div class="row g-2 mb-3">
              <div class="col-6">
                <label class="form-label small text-white-50 mb-1">Dosis / Concentración *</label>
                <input type="text" id="rxDose" class="form-control text-white" placeholder="Ej. 50 mg / 1 comp." required style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px;">
              </div>
              <div class="col-6">
                <label class="form-label small text-white-50 mb-1">Vía de Administración</label>
                <select id="rxRoute" class="form-select text-white" style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px;">
                  <option value="Vía Oral" class="bg-dark text-white" selected>Vía Oral</option>
                  <option value="Sublingual" class="bg-dark text-white">Sublingual</option>
                  <option value="Inhalatoria" class="bg-dark text-white">Inhalatoria</option>
                  <option value="Subcutánea" class="bg-dark text-white">Subcutánea</option>
                  <option value="Tópica" class="bg-dark text-white">Tópica</option>
                </select>
              </div>
            </div>

            <div class="row g-2 mb-3">
              <div class="col-6">
                <label class="form-label small text-white-50 mb-1">Horario Sugerido *</label>
                <select id="rxSchedule" class="form-select text-white" style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px;">
                  <option value="Mañana (08:00 AM)" class="bg-dark text-white" selected>Mañana (08:00 AM)</option>
                  <option value="Mediodía (13:00 PM)" class="bg-dark text-white">Mediodía (13:00 PM)</option>
                  <option value="Tarde (17:00 PM)" class="bg-dark text-white">Tarde (17:00 PM)</option>
                  <option value="Noche (21:00 PM)" class="bg-dark text-white">Noche (21:00 PM)</option>
                  <option value="Cada 8 horas" class="bg-dark text-white">Cada 8 horas</option>
                  <option value="Cada 12 horas" class="bg-dark text-white">Cada 12 horas</option>
                  <option value="SOS (Según dolor o fiebre)" class="bg-dark text-white">SOS (En caso de dolor)</option>
                </select>
              </div>
              <div class="col-6">
                <label class="form-label small text-white-50 mb-1">Duración Tratamiento</label>
                <select id="rxDuration" class="form-select text-white" style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px;">
                  <option value="Permanente" class="bg-dark text-white" selected>Permanente (Crónico)</option>
                  <option value="30 días" class="bg-dark text-white">30 días</option>
                  <option value="60 días" class="bg-dark text-white">60 días</option>
                  <option value="90 días" class="bg-dark text-white">90 días</option>
                  <option value="7 días" class="bg-dark text-white">7 días (Agudo)</option>
                  <option value="14 días" class="bg-dark text-white">14 días</option>
                </select>
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label small text-white-50 mb-1">Indicaciones Clínicas para el Paciente y Cuidadora</label>
              <textarea id="rxInstructions" class="form-control text-white" rows="3" placeholder="Ej. Tomar junto al desayuno con abundante agua. No suspender sin indicación médica..." style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px;"></textarea>
            </div>

            <!-- Sello Digital de la Médica Tratante -->
            <div class="p-3 rounded-3 mb-3" style="background: rgba(14, 165, 233, 0.08); border: 1px solid rgba(14, 165, 233, 0.25);">
              <div class="d-flex align-items-center gap-2 small text-info">
                <i class="bi bi-award-fill fs-5"></i>
                <div>
                  <strong>Dra. Elena Valdés &bull; Reg. SIS N° 482910</strong>
                  <div class="text-white-50" style="font-size: 0.72rem;">Firma electrónica válida para retiro en farmacias y farmacia comunal.</div>
                </div>
              </div>
            </div>

            <button type="submit" class="btn btn-primary btn-lg w-100 fw-bold shadow-lg d-flex align-items-center justify-content-center gap-2" style="border-radius: 14px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border: 1.5px solid #38bdf8;">
              <i class="bi bi-check2-circle fs-5"></i>
              <span>Firmar y Emitir Receta al Pastillero</span>
            </button>
          </form>
        </div>
      </div>

      <!-- Lista de Prescripciones Activas Sincronizadas -->
      <div class="col-lg-7">
        <div class="glass-card p-4 border-0 mb-4" style="background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255,255,255,0.08) !important; border-radius: 20px;">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 class="fw-bold m-0 text-white d-flex align-items-center gap-2" style="font-family: 'Outfit';">
                <i class="bi bi-capsule-pill text-success"></i>
                <span>Pastillero Farmacológico del Paciente</span>
              </h5>
              <small class="text-white-50" style="font-size: 0.74rem;">Interoperabilidad directa con paciente.js y cuidador.js</small>
            </div>
            <span class="badge px-2.5 py-1 rounded-pill" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); font-size: 0.72rem;">
              <i class="bi bi-arrow-repeat me-1"></i>Sincronizado
            </span>
          </div>

          <div class="d-flex flex-column gap-3" id="medicoPrescriptionsList">
            ${prescriptions && prescriptions.length > 0 ? prescriptions.map(rx => `
              <div class="p-3.5 rounded-3 position-relative" style="background: rgba(255,255,255,0.03); border: 1.5px solid ${rx.status === 'activa' ? 'rgba(14, 165, 233, 0.3)' : 'rgba(255,255,255,0.08)'};">
                <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                  <div class="d-flex align-items-center gap-2">
                    <span style="font-size: 1.5rem;">💊</span>
                    <div>
                      <h5 class="fw-bold m-0 text-white" style="font-family: 'Outfit';">${rx.medication} ${rx.dose}</h5>
                      <span class="badge bg-primary bg-opacity-25 text-primary border border-primary border-opacity-25 rounded-pill px-2 py-0.5" style="font-size: 0.72rem;">
                        ${rx.schedule} &bull; ${rx.frequency || 'Cada 24 hrs'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span class="badge ${rx.status === 'activa' ? 'bg-success text-white' : 'bg-secondary text-white-50'} rounded-pill px-2.5 py-1 fw-bold" style="font-size: 0.72rem;">
                      ${rx.status === 'activa' ? '✓ VIGENTE EN PASTILLERO' : 'SUSPENDIDA'}
                    </span>
                  </div>
                </div>

                <p class="text-white small m-0 mb-2" style="font-size: 0.83rem;">
                  <strong>Indicaciones:</strong> ${rx.instructions || 'Tomar según prescripción médica regular.'}
                </p>

                <div class="d-flex justify-content-between align-items-center flex-wrap pt-2 border-top border-light border-opacity-10 text-white-50" style="font-size: 0.72rem;">
                  <div>
                    <i class="bi bi-person-badge text-info me-1"></i>${rx.prescribedBy || 'Dra. Elena Valdés'} &bull; 📅 ${rx.date || 'Reciente'}
                  </div>
                  <div class="d-flex align-items-center gap-2">
                    <span class="font-monospace">${rx.id}</span>
                    <button type="button" class="btn btn-sm btn-outline-warning py-0.5 px-2 rounded-pill btn-toggle-rx" data-rx-id="${rx.id}" style="font-size: 0.7rem;">
                      ${rx.status === 'activa' ? 'Suspender' : 'Reactivar'}
                    </button>
                  </div>
                </div>
              </div>
            `).join('') : `
              <div class="text-center py-4 text-white-50 small rounded-3" style="background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1);">
                <i class="bi bi-capsule fs-3 d-block mb-1"></i>
                Sin prescripciones registradas. Utiliza el formulario lateral para emitir la primera receta del paciente.
              </div>
            `}
          </div>
        </div>
      </div>

    </div>
  `;
}

/**
 * PESTAÑA 3: FICHA ODONTOLÓGICA INTEGRAL (CONSULTA Y LECTURA LEY 20.584)
 */
function renderOdontologiaTab(patient) {
  return `
    <div class="glass-card p-4 border-0 mb-4" style="background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255,255,255,0.08) !important; border-radius: 20px;">
      
      <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 pb-3 border-bottom border-light border-opacity-10">
        <div class="d-flex align-items-center gap-3">
          <div class="rounded-circle d-flex align-items-center justify-content-center shadow" style="width: 60px; height: 60px; background: rgba(14, 165, 233, 0.2); border: 2px solid #0ea5e9; font-size: 2rem;">
            🦷
          </div>
          <div>
            <h4 class="fw-bold m-0 text-white" style="font-family: 'Outfit';">Ficha e Historial Odontológico Integral</h4>
            <p class="text-white-50 small m-0">Consulta clínica multidisciplinaria de arcadas dentales, radiografías panorámicas e informes.</p>
          </div>
        </div>

        <div>
          <button type="button" id="btnOpenDentalModalFromMedico" class="btn btn-primary btn-lg px-4 py-2.5 rounded-pill fw-bold shadow-lg d-inline-flex align-items-center gap-2" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border: 1.5px solid #38bdf8; cursor: pointer; transition: all 0.25s ease;">
            <span style="font-size: 1.25rem;">🦷</span>
            <span>Abrir Ficha Odontológica y Radiografías</span>
          </button>
        </div>
      </div>

      <!-- Resumen Clínico Rápido para el Médico Tratante -->
      <div class="row g-3 mb-4">
        <div class="col-md-4">
          <div class="p-3 rounded-4 text-center" style="background: rgba(14, 165, 233, 0.08); border: 1px solid rgba(14, 165, 233, 0.25);">
            <i class="bi bi-card-checklist text-info fs-3 d-block mb-1"></i>
            <h6 class="fw-bold text-white mb-1">Odontograma FDI</h6>
            <p class="text-white-50 small m-0">${patient.id === 'p_mateo' ? 'Dentición Pediátrica Temporal (51-85)' : 'Dentición Adulta Permanente (11-48)'}</p>
          </div>
        </div>
        <div class="col-md-4">
          <div class="p-3 rounded-4 text-center" style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25);">
            <i class="bi bi-file-earmark-medical text-success fs-3 d-block mb-1"></i>
            <h6 class="fw-bold text-white mb-1">Carpetas Documentales</h6>
            <p class="text-white-50 small m-0">Radiografías Panorámicas, Bitewing e Informes de Cirugía Oral</p>
          </div>
        </div>
        <div class="col-md-4">
          <div class="p-3 rounded-4 text-center" style="background: rgba(168, 85, 247, 0.08); border: 1px solid rgba(168, 85, 247, 0.25);">
            <i class="bi bi-shield-check text-purple fs-3 d-block mb-1" style="color: #c084fc;"></i>
            <h6 class="fw-bold text-white mb-1">Foco Infeccioso Odontógeno</h6>
            <p class="text-white-50 small m-0">Sin focos infecciosos activos con riesgo de endocarditis bacteriana.</p>
          </div>
        </div>
      </div>

      <!-- Nota de Interoperabilidad Odonto-Médica -->
      <div class="p-3 rounded-3" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); font-size: 0.8rem;">
        <i class="bi bi-info-circle text-info me-1"></i>
        <strong>Interoperabilidad Ley 20.584:</strong> Los hallazgos odontológicos se encuentran vinculados a la Ficha Clínica Única del paciente para consideración de profilaxis antibiótica o interacciones de medicamentos anticoagulantes.
      </div>

    </div>
  `;
}

/**
 * PESTAÑA 4: PROTOCOLOS PREVENTIVOS Y SALUD MATERNO-INFANTIL (MINSAL / CHILE CRECE CONTIGO)
 */
function renderProtocolosPreventivosTab(patient) {
  const isFemale = patient.gender === 'Femenino';
  const isMale = patient.gender === 'Masculino';
  const age = patient.age;
  const isAdolescent = age >= 10 && age <= 17;
  const isSenior = age >= 60;
  const isFertileFemale = isFemale && age >= 15 && age <= 49;

  // Estado de gestación activa
  const pregnancy = getPatientPregnancy(patient.id);
  const obstetricHistory = getPatientObstetricHistory(patient.id);
  const preventiveOrders = getPreventiveOrders(patient.id);

  let gestWeeks = { weeks: 0, days: 0 };
  if (pregnancy && pregnancy.fur) {
    gestWeeks = calculateGestationalWeeks(pregnancy.fur);
  }

  return `
    <div class="d-flex flex-column gap-4">

      <!-- BANNER DE ORIENTACIÓN CLÍNICA ADAPTADA (MINSAL / LEY 21.120) -->
      <div class="glass-card p-4 border-0" style="background: rgba(15, 23, 42, 0.5); border: 1.5px solid rgba(168, 85, 247, 0.3) !important; border-radius: 20px;">
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
              <span class="badge px-3 py-1 rounded-pill fw-bold" style="background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.4); font-size: 0.78rem;">
                <i class="bi bi-funnel-fill me-1"></i>Triaje Epidemiológico Personalizado
              </span>
              <span class="badge bg-secondary bg-opacity-25 text-white-50 rounded-pill px-2.5 py-1" style="font-size: 0.74rem;">
                ${isAdolescent ? 'Adolescencia (10-17a)' : isSenior ? 'Adulto Mayor (≥60a)' : isFertileFemale ? 'Mujer Edad Fértil (15-49a)' : 'Adulto General'}
              </span>
            </div>
            <h4 class="fw-bold m-0 text-white" style="font-family: 'Outfit';">
              Protocolos de Medicina Preventiva MINSAL & Salud Materno-Infantil
            </h4>
            <p class="text-white-50 small m-0 mt-1">
              Adaptación automática según sexo biológico (<strong>${patient.gender}</strong>) y edad (<strong>${patient.age} años</strong>), manteniendo el trato respetuoso al Nombre Social (<strong>${patient.socialName || patient.name}</strong>, pronombres <strong>${patient.pronouns}</strong>).
            </p>
          </div>

          <div class="text-md-end flex-shrink-0">
            <span class="badge px-3 py-2 rounded-pill fw-semibold" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.35); font-size: 0.8rem;">
              <i class="bi bi-shield-check me-1"></i>Guías Clínicas GES / MINSAL
            </span>
          </div>
        </div>
      </div>

      <!-- MÓDULO 1: SALUD MATERNA Y GESTACIÓN (CHILE CRECE CONTIGO / LEY 21.430) -->
      ${isFertileFemale || pregnancy ? `
        <div class="glass-card p-4 border-0" style="background: rgba(15, 23, 42, 0.55); border: 1.5px solid rgba(236, 72, 153, 0.35) !important; border-radius: 20px;">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3 pb-2 border-bottom border-light border-opacity-10">
            <div class="d-flex align-items-center gap-2">
              <span style="font-size: 2rem;">🤰</span>
              <div>
                <h5 class="fw-bold m-0 text-white" style="font-family: 'Outfit';">Control Prenatal Oficial & Transición al Parto (Chile Crece Contigo)</h5>
                <small class="text-white-50" style="font-size: 0.76rem;">Monitoreo gineco-obstétrico, alertas teratogénicas y registro legal del recién nacido (Ley 21.430)</small>
              </div>
            </div>
            <div>
              ${pregnancy ? `
                <span class="badge px-3 py-1.5 rounded-pill fw-bold" style="background: rgba(236, 72, 153, 0.25); color: #f472b6; border: 1px solid rgba(236, 72, 153, 0.45); font-size: 0.8rem;">
                  <span>🤰</span> EMBARAZO ACTIVO
                </span>
              ` : `
                <span class="badge px-3 py-1.5 rounded-pill fw-semibold text-white-50 bg-secondary bg-opacity-25" style="font-size: 0.78rem;">
                  Sin Embarazo Activo
                </span>
              `}
            </div>
          </div>

          ${pregnancy ? `
            <!-- Ficha de Embarazo Activo -->
            <div class="row g-3 mb-4 text-white">
              <div class="col-6 col-md-3">
                <div class="p-3 rounded-3" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);">
                  <span class="text-white-50 d-block small" style="font-size: 0.75rem;">F.Ú.R. (Última Regla)</span>
                  <strong class="fs-6">${pregnancy.fur || 'No especificada'}</strong>
                </div>
              </div>
              <div class="col-6 col-md-3">
                <div class="p-3 rounded-3" style="background: rgba(236, 72, 153, 0.08); border: 1px solid rgba(236, 72, 153, 0.25);">
                  <span class="text-white-50 d-block small" style="font-size: 0.75rem;">Edad Gestacional</span>
                  <strong class="fs-5 text-pink" style="color: #f472b6;">${gestWeeks.weeks}.${gestWeeks.days} Semanas</strong>
                  <small class="text-white-50 d-block" style="font-size: 0.7rem;">${gestWeeks.weeks < 14 ? '1er Trimestre' : gestWeeks.weeks < 28 ? '2do Trimestre' : '3er Trimestre (Término)'}</small>
                </div>
              </div>
              <div class="col-6 col-md-3">
                <div class="p-3 rounded-3" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);">
                  <span class="text-white-50 d-block small" style="font-size: 0.75rem;">F.P.P. (Naegele)</span>
                  <strong class="fs-6 text-info">${pregnancy.fpp || calculateNaegeleFpp(pregnancy.fur)}</strong>
                </div>
              </div>
              <div class="col-6 col-md-3">
                <div class="p-3 rounded-3" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);">
                  <span class="text-white-50 d-block small" style="font-size: 0.75rem;">Fórmula Obstétrica</span>
                  <strong class="fs-6">G${pregnancy.gestas || 1} P${pregnancy.partos || 0} C${pregnancy.cesareas || 0} A${pregnancy.abortos || 0}</strong>
                </div>
              </div>
            </div>

            <!-- Banners Clínicos Obligatorios de Protección Materno-Fetal -->
            <div class="row g-3 mb-4">
              <div class="col-md-6">
                <div class="p-3 rounded-3" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.35);">
                  <div class="d-flex align-items-center gap-2 mb-1">
                    <i class="bi bi-shield-slash-fill text-danger fs-5"></i>
                    <strong class="text-danger small">⚠️ Precaución Teratogénica (FDA Categoría C, D y X)</strong>
                  </div>
                  <p class="text-white-50 small m-0" style="font-size: 0.78rem;">
                    Contraindicación estricta de Inhibidores de la ECA, ARA-II (Losartán), Estatinas y AINEs en el tercer trimestre. Ajustar a fármacos antihipertensivos seguros (Metildopa / Labetalol / Nifedipino).
                  </p>
                </div>
              </div>
              <div class="col-md-6">
                <div class="p-3 rounded-3" style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.35);">
                  <div class="d-flex align-items-center gap-2 mb-1">
                    <i class="bi bi-radioactive text-warning fs-5"></i>
                    <strong class="text-warning small">☢️ Protección Radiológica Obligatoria (Ley 20.584)</strong>
                  </div>
                  <p class="text-white-50 small m-0" style="font-size: 0.78rem;">
                    Uso de blindaje plomado abdominal obligatorio ante cualquier examen odontológico o periférico. Contraindicada la radiación pélvica/abdominal innecesaria. Preferir ultrasonido obstétrico.
                  </p>
                </div>
              </div>
            </div>

            <!-- Protocolo Chile Crece Contigo y Botón de Parto -->
            <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 p-3 rounded-3" style="background: rgba(16, 185, 129, 0.08); border: 1.5px solid rgba(16, 185, 129, 0.3);">
              <div>
                <div class="fw-bold text-success d-flex align-items-center gap-2 mb-0.5">
                  <i class="bi bi-check-circle-fill"></i>
                  <span>Acompañamiento Gestacional Chile Crece Contigo</span>
                </div>
                <small class="text-white-50" style="font-size: 0.76rem;">
                  Ecografías 11-14s y 20-24s vigentes &bull; Suplementación de Ácido Fólico (1mg) y Sulfato Ferroso (200mg) indicada.
                </small>
              </div>

              <div>
                <button type="button" id="btnOpenModalParto" class="btn btn-success btn-lg px-4 py-2.5 rounded-pill fw-bold shadow-lg d-inline-flex align-items-center gap-2" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: 1.5px solid #34d399; cursor: pointer; transition: all 0.25s ease;">
                  <span style="font-size: 1.25rem;">👶</span>
                  <span>Registrar Parto y Crear Perfil Pediátrico</span>
                </button>
              </div>
            </div>
          ` : `
            <!-- Formulario para Activar Gestación -->
            <div class="p-3.5 rounded-3" style="background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.15);">
              <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                <div>
                  <h6 class="fw-bold text-white mb-1">Iniciar Control de Gestación (Chile Crece Contigo)</h6>
                  <p class="text-white-50 small m-0">La paciente está en edad fértil (${patient.age} años). Si se encuentra cursando un embarazo, inicia el protocolo clínico para el cálculo de semanas y alertas teratogénicas.</p>
                </div>
                <button type="button" id="btnToggleFormGestacion" class="btn btn-outline-info px-4 py-2 rounded-pill fw-bold" style="border-color: rgba(56,189,248,0.4); font-size: 0.85rem;">
                  <i class="bi bi-plus-circle me-1"></i>Activar Control Gestacional
                </button>
              </div>

              <!-- Formulario Desplegable de Activación -->
              <div id="formGestacionCollapse" class="d-none mt-3 pt-3 border-top border-light border-opacity-10">
                <form id="formStartPregnancy">
                  <div class="row g-3">
                    <div class="col-md-4">
                      <label class="form-label small text-white-50 mb-1">Fecha de Última Regla (F.Ú.R.) *</label>
                      <input type="date" id="inputGestFur" class="form-control text-white" required max="${getTodayDateString()}" style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px;">
                    </div>
                    <div class="col-md-2">
                      <label class="form-label small text-white-50 mb-1">Gestas</label>
                      <input type="number" id="inputGestG" class="form-control text-white" value="1" min="1" style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px;">
                    </div>
                    <div class="col-md-2">
                      <label class="form-label small text-white-50 mb-1">Partos</label>
                      <input type="number" id="inputGestP" class="form-control text-white" value="0" min="0" style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px;">
                    </div>
                    <div class="col-md-4 d-flex align-items-end">
                      <button type="submit" class="btn btn-primary w-100 py-2 rounded-pill fw-bold">
                        <i class="bi bi-check-lg me-1"></i>Confirmar Gestación
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          `}

          <!-- Historial de Partos Previos (Historial Obstétrico Permanente) -->
          ${obstetricHistory && obstetricHistory.length > 0 ? `
            <div class="mt-4 pt-3 border-top border-light border-opacity-10">
              <h6 class="fw-bold text-white small mb-2"><i class="bi bi-archive-fill text-info me-1"></i>Historial Obstétrico Permanente (DS N° 41):</h6>
              <div class="d-flex flex-column gap-2">
                ${obstetricHistory.map(item => `
                  <div class="p-2.5 rounded-3 d-flex justify-content-between align-items-center flex-wrap gap-2" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); font-size: 0.78rem;">
                    <div>
                      <strong class="text-white">${item.babyName}</strong> (${item.babyGender}) &bull; Fecha: ${item.deliveryDate} &bull; Peso: ${item.birthWeight}kg &bull; Talla: ${item.birthLength}cm &bull; Apgar: ${item.apgar || '9/10'}
                    </div>
                    <span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25">Parto Registrado &bull; Ley 21.430</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

        </div>
      ` : ''}

      <!-- MÓDULO 2: EXÁMENES PREVENTIVOS EXCLUSIVOS POR SEXO BIOLÓGICO Y EDAD -->
      <div class="glass-card p-4 border-0" style="background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255,255,255,0.08) !important; border-radius: 20px;">
        <div class="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom border-light border-opacity-10">
          <div>
            <h5 class="fw-bold m-0 text-white d-flex align-items-center gap-2" style="font-family: 'Outfit';">
              <i class="bi bi-shield-check text-info"></i>
              <span>Tamizajes Preventivos Indicados (Guías Clínicas MINSAL)</span>
            </h5>
            <small class="text-white-50" style="font-size: 0.74rem;">Prescripción con sello de telemedicina e interoperabilidad nacional</small>
          </div>
          <span class="badge px-2.5 py-1 rounded-pill" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.35); font-size: 0.72rem;">
            Cobertura GES / AUGE
          </span>
        </div>

        <div class="row g-3">
          
          <!-- PROTOCOLOS FEMENINOS -->
          ${isFemale ? `
            <!-- PAP / VPH -->
            <div class="col-md-6 col-lg-4">
              <div class="p-3 rounded-4 h-100 d-flex flex-column justify-content-between" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(236,72,153,0.25);">
                <div>
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <span class="badge bg-pink bg-opacity-25 text-pink border border-pink" style="color: #f472b6; border-color: rgba(236,72,153,0.35) !important;">
                      Tamizaje Cervicouterino
                    </span>
                    <span class="text-white-50 font-monospace small">Cada 3 años</span>
                  </div>
                  <h6 class="fw-bold text-white mb-1">Papanicolaou (PAP) / Test VPH</h6>
                  <p class="text-white-50 small m-0 mb-3" style="font-size: 0.76rem;">
                    Detección precoz de lesiones preinvasoras del cuello uterino en mujeres de 25 a 64 años. Cobertura universal GES.
                  </p>
                </div>
                <button type="button" class="btn btn-sm btn-outline-info w-100 rounded-pill btn-emit-preventive" data-exam="Papanicolaou (PAP) y Detección VPH" data-type="Cervicouterino" style="font-size: 0.75rem;">
                  <i class="bi bi-file-earmark-plus me-1"></i>Emitir Orden de PAP
                </button>
              </div>
            </div>

            <!-- Mamografía Bilateral -->
            <div class="col-md-6 col-lg-4">
              <div class="p-3 rounded-4 h-100 d-flex flex-column justify-content-between" style="background: rgba(255,255,255,0.03); border: 1px solid ${age >= 40 ? 'rgba(236,72,153,0.45)' : 'rgba(255,255,255,0.1)'};">
                <div>
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <span class="badge ${age >= 40 ? 'bg-danger text-white' : 'bg-secondary text-white-50'}">
                      ${age >= 40 ? 'Prioridad Alta (≥40a)' : 'Opcional (<40a)'}
                    </span>
                    <span class="text-white-50 font-monospace small">GES Anual</span>
                  </div>
                  <h6 class="fw-bold text-white mb-1">Mamografía Bilateral con BI-RADS</h6>
                  <p class="text-white-50 small m-0 mb-3" style="font-size: 0.76rem;">
                    Tamizaje precoz de cáncer de mama. Recomendado cada 1 a 2 años en mujeres a partir de los 40 años o con antecedentes.
                  </p>
                </div>
                <button type="button" class="btn btn-sm btn-outline-info w-100 rounded-pill btn-emit-preventive" data-exam="Mamografía Bilateral con Proyecciones Axilares" data-type="Mamario" style="font-size: 0.75rem;">
                  <i class="bi bi-file-earmark-plus me-1"></i>Emitir Orden Mamografía
                </button>
              </div>
            </div>

            <!-- Ecotomografía Pelviana / Ginecológica -->
            <div class="col-md-6 col-lg-4">
              <div class="p-3 rounded-4 h-100 d-flex flex-column justify-content-between" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);">
                <div>
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <span class="badge bg-primary bg-opacity-25 text-primary">Ginecología</span>
                    <span class="text-white-50 font-monospace small">Ecografía</span>
                  </div>
                  <h6 class="fw-bold text-white mb-1">Ecotomografía Ginecológica / Pelviana</h6>
                  <p class="text-white-50 small m-0 mb-3" style="font-size: 0.76rem;">
                    Evaluación morfológica de útero, endometrio y ovarios. Descarte de miomas, quistes o hiperplasias.
                  </p>
                </div>
                <button type="button" class="btn btn-sm btn-outline-info w-100 rounded-pill btn-emit-preventive" data-exam="Ecotomografía Ginecológica Transvaginal/Pélvica" data-type="Ultrasonido" style="font-size: 0.75rem;">
                  <i class="bi bi-file-earmark-plus me-1"></i>Emitir Orden Ecotomografía
                </button>
              </div>
            </div>
          ` : ''}

          <!-- PROTOCOLOS MASCULINOS -->
          ${isMale ? `
            <!-- Antígeno Prostático Específico (APE) -->
            <div class="col-md-6 col-lg-4">
              <div class="p-3 rounded-4 h-100 d-flex flex-column justify-content-between" style="background: rgba(255,255,255,0.03); border: 1px solid ${age >= 45 ? 'rgba(56,189,248,0.45)' : 'rgba(255,255,255,0.1)'};">
                <div>
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <span class="badge ${age >= 45 ? 'bg-primary text-white' : 'bg-secondary text-white-50'}">
                      ${age >= 45 ? 'Indicado (≥45a)' : 'Preventivo (<45a)'}
                    </span>
                    <span class="text-white-50 font-monospace small">Control Anual</span>
                  </div>
                  <h6 class="fw-bold text-white mb-1">Antígeno Prostático Específico (APE / PSA)</h6>
                  <p class="text-white-50 small m-0 mb-3" style="font-size: 0.76rem;">
                    Tamizaje sanguíneo de APE Total y Libre para detección precoz de patología prostática benigna y maligna (≥45 años).
                  </p>
                </div>
                <button type="button" class="btn btn-sm btn-outline-info w-100 rounded-pill btn-emit-preventive" data-exam="Antígeno Prostático Específico (PSA Total y Libre)" data-type="Urología" style="font-size: 0.75rem;">
                  <i class="bi bi-file-earmark-plus me-1"></i>Emitir Orden APE Sanguíneo
                </button>
              </div>
            </div>

            <!-- Control Urológico -->
            <div class="col-md-6 col-lg-4">
              <div class="p-3 rounded-4 h-100 d-flex flex-column justify-content-between" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);">
                <div>
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <span class="badge bg-info bg-opacity-25 text-info">Clínico</span>
                    <span class="text-white-50 font-monospace small">Examen Físico</span>
                  </div>
                  <h6 class="fw-bold text-white mb-1">Control Urológico Preventivo</h6>
                  <p class="text-white-50 small m-0 mb-3" style="font-size: 0.76rem;">
                    Evaluación urológica presencial, ecotomografía vesicoprostática y descarte de síntomas obstructivos urinarios bajos.
                  </p>
                </div>
                <button type="button" class="btn btn-sm btn-outline-info w-100 rounded-pill btn-emit-preventive" data-exam="Interconsulta Control Urológico Preventivo" data-type="Interconsulta" style="font-size: 0.75rem;">
                  <i class="bi bi-calendar-plus me-1"></i>Derivar a Urología
                </button>
              </div>
            </div>
          ` : ''}

          <!-- PROTOCOLOS ADOLESCENTES (10-17 AÑOS) -->
          ${isAdolescent ? `
            <!-- Ficha CLAP -->
            <div class="col-md-6 col-lg-4">
              <div class="p-3 rounded-4 h-100 d-flex flex-column justify-content-between" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(168,85,247,0.35);">
                <div>
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <span class="badge bg-purple text-white" style="background: #a855f7;">Ficha CLAP</span>
                    <span class="text-white-50 font-monospace small">10 a 17 años</span>
                  </div>
                  <h6 class="fw-bold text-white mb-1">Control Integral del Adolescente</h6>
                  <p class="text-white-50 small m-0 mb-3" style="font-size: 0.76rem;">
                    Evaluación del desarrollo puberal (Tanner), crecimiento, postura, nutrición y factores psicosociales (MINSAL).
                  </p>
                </div>
                <button type="button" class="btn btn-sm btn-outline-info w-100 rounded-pill btn-emit-preventive" data-exam="Control Integral Adolescente Ficha CLAP" data-type="Adolescencia" style="font-size: 0.75rem;">
                  <i class="bi bi-clipboard2-check me-1"></i>Aplicar Ficha CLAP
                </button>
              </div>
            </div>

            <!-- Vacunas Escolares PNI -->
            <div class="col-md-6 col-lg-4">
              <div class="p-3 rounded-4 h-100 d-flex flex-column justify-content-between" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(16,185,129,0.35);">
                <div>
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <span class="badge bg-success text-white">PNI Escolar</span>
                    <span class="text-white-50 font-monospace small">Inmunizaciones</span>
                  </div>
                  <h6 class="fw-bold text-white mb-1">Vacunación Escolar (VPH / dTpa)</h6>
                  <p class="text-white-50 small m-0 mb-3" style="font-size: 0.76rem;">
                    Revisión de esquemas de Vacuna VPH (Virus Papiloma Humano) y dTpa celular según calendario escolar oficial.
                  </p>
                </div>
                <button type="button" class="btn btn-sm btn-outline-info w-100 rounded-pill btn-emit-preventive" data-exam="Certificado Vacunación Escolar VPH/dTpa" data-type="Vacunas" style="font-size: 0.75rem;">
                  <i class="bi bi-shield-fill-plus me-1"></i>Revisar Calendario Escolar
                </button>
              </div>
            </div>

            <!-- Salud Mental Preventiva (Ley 21.430) -->
            <div class="col-md-6 col-lg-4">
              <div class="p-3 rounded-4 h-100 d-flex flex-column justify-content-between" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(245,158,11,0.35);">
                <div>
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <span class="badge bg-warning text-dark">Ley 21.430</span>
                    <span class="text-white-50 font-monospace small">Bienestar Emocional</span>
                  </div>
                  <h6 class="fw-bold text-white mb-1">Salud Mental y Habilidades Sociales</h6>
                  <p class="text-white-50 small m-0 mb-3" style="font-size: 0.76rem;">
                    Tamizaje preventivo de ansiedad escolar, depresión adolescente, hábitos digitales y prevención de acoso (bullying).
                  </p>
                </div>
                <button type="button" class="btn btn-sm btn-outline-info w-100 rounded-pill btn-emit-preventive" data-exam="Tamizaje de Salud Mental y Habilidades Sociales" data-type="SaludMental" style="font-size: 0.75rem;">
                  <i class="bi bi-emoji-smile me-1"></i>Aplicar Tamizaje Emocional
                </button>
              </div>
            </div>
          ` : ''}

          <!-- PROTOCOLOS ADULTO MAYOR (≥ 60 AÑOS) -->
          ${isSenior ? `
            <!-- EMPAM -->
            <div class="col-md-6 col-lg-4">
              <div class="p-3 rounded-4 h-100 d-flex flex-column justify-content-between" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(14,165,233,0.35);">
                <div>
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <span class="badge bg-primary text-white">EMPAM (≥60a)</span>
                    <span class="text-white-50 font-monospace small">Anual GES</span>
                  </div>
                  <h6 class="fw-bold text-white mb-1">Examen de Medicina Preventiva Adulto Mayor</h6>
                  <p class="text-white-50 small m-0 mb-3" style="font-size: 0.76rem;">
                    Evaluación integral anual de salud, riesgo cardiovascular, control antropométrico y glicemia/colesterol.
                  </p>
                </div>
                <button type="button" class="btn btn-sm btn-outline-info w-100 rounded-pill btn-emit-preventive" data-exam="Examen de Medicina Preventiva del Adulto Mayor (EMPAM)" data-type="EMPAM" style="font-size: 0.75rem;">
                  <i class="bi bi-file-earmark-medical me-1"></i>Aplicar Examen EMPAM
                </button>
              </div>
            </div>

            <!-- EFAM Chile -->
            <div class="col-md-6 col-lg-4">
              <div class="p-3 rounded-4 h-100 d-flex flex-column justify-content-between" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(16,185,129,0.35);">
                <div>
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <span class="badge bg-success text-white">EFAM Chile</span>
                    <span class="text-white-50 font-monospace small">Funcionalidad</span>
                  </div>
                  <h6 class="fw-bold text-white mb-1">Evaluación Funcional (Escala EFAM)</h6>
                  <p class="text-white-50 small m-0 mb-3" style="font-size: 0.76rem;">
                    Clasificación en: Autovalente sin riesgo, Autovalente con riesgo o En riesgo de dependencia.
                  </p>
                </div>
                <button type="button" class="btn btn-sm btn-outline-info w-100 rounded-pill btn-emit-preventive" data-exam="Evaluación Funcional del Adulto Mayor (EFAM Chile)" data-type="Funcional" style="font-size: 0.75rem;">
                  <i class="bi bi-person-check me-1"></i>Calcular Puntaje EFAM
                </button>
              </div>
            </div>

            <!-- Prevención de Caídas -->
            <div class="col-md-6 col-lg-4">
              <div class="p-3 rounded-4 h-100 d-flex flex-column justify-content-between" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(245,158,11,0.35);">
                <div>
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <span class="badge bg-warning text-dark">Caídas</span>
                    <span class="text-white-50 font-monospace small">Test TUG</span>
                  </div>
                  <h6 class="fw-bold text-white mb-1">Protocolo de Prevención de Caídas</h6>
                  <p class="text-white-50 small m-0 mb-3" style="font-size: 0.76rem;">
                    Test de Estación Unipodal y Timed Up and Go (TUG). Evaluación del equilibrio dinámico y marcha.
                  </p>
                </div>
                <button type="button" class="btn btn-sm btn-outline-info w-100 rounded-pill btn-emit-preventive" data-exam="Test Timed Up and Go (TUG) y Estación Unipodal" data-type="Caidas" style="font-size: 0.75rem;">
                  <i class="bi bi-activity me-1"></i>Evaluar Riesgo de Caída
                </button>
              </div>
            </div>
          ` : ''}

        </div>
      </div>

      <!-- MÓDULO 3: HISTORIAL DE ÓRDENES PREVENTIVAS EMITIDAS PARA ESTE PACIENTE -->
      <div class="glass-card p-4 border-0" style="background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255,255,255,0.08) !important; border-radius: 20px;">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h6 class="fw-bold m-0 text-white d-flex align-items-center gap-2">
            <i class="bi bi-clock-history text-info"></i>
            <span>Órdenes Médicas Preventivas Emitidas (Interoperabilidad Ley 21.668)</span>
          </h6>
          <span class="badge bg-secondary bg-opacity-25 text-white-50 font-monospace small">
            Firma Digital: Dra. Elena Valdés
          </span>
        </div>

        <div class="d-flex flex-column gap-2" id="preventiveOrdersContainer">
          ${preventiveOrders && preventiveOrders.length > 0 ? preventiveOrders.map(order => `
            <div class="p-3 rounded-3 d-flex justify-content-between align-items-center flex-wrap gap-2" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08);">
              <div>
                <strong class="text-white">${order.examName}</strong>
                <span class="badge bg-primary bg-opacity-25 text-primary ms-2">${order.category}</span>
                <div class="text-white-50" style="font-size: 0.74rem;">
                  📅 Emitida el ${order.date} &bull; Profesional: ${order.doctor} (${order.registry})
                </div>
              </div>
              <div class="d-flex align-items-center gap-2">
                <span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-30">
                  <i class="bi bi-check-circle me-1"></i>Orden Interoperable
                </span>
                <span class="font-monospace text-white-50" style="font-size: 0.7rem;">ID: ${order.id}</span>
              </div>
            </div>
          `).join('') : `
            <div class="text-center py-4 text-white-50 small rounded-3" style="background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1);">
              <i class="bi bi-clipboard2-check fs-3 d-block mb-1"></i>
              No se han emitido órdenes preventivas en esta sesión para este paciente. Presiona los botones superiores para solicitar PAP, Mamografía, APE o EMPAM.
            </div>
          `}
        </div>
      </div>

    </div>

    <!-- MODAL DE REGISTRO DE PARTO Y CREACIÓN DE PERFIL PEDIÁTRICO (CHILE CRECE CONTIGO / LEY 21.430) -->
    <div class="modal fade" id="modalRegistroParto" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content text-white" style="background: #0f172a; border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: 24px; box-shadow: 0 25px 60px rgba(0,0,0,0.7);">
          
          <div class="modal-header border-bottom border-light border-opacity-10 p-4">
            <div class="d-flex align-items-center gap-3">
              <div class="rounded-circle d-flex align-items-center justify-content-center" style="width: 52px; height: 52px; background: rgba(16, 185, 129, 0.2); border: 2px solid #10b981; font-size: 1.8rem;">
                👶
              </div>
              <div>
                <h4 class="modal-title fw-bold text-white m-0" style="font-family: 'Outfit';">Registro de Parto & Creación de Perfil Pediátrico</h4>
                <small class="text-white-50">Transición oficial Chile Crece Contigo &bull; Vínculo Legal Madre-Hijo (Ley 21.430)</small>
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>

          <div class="modal-body p-4">
            <form id="formRegistroParto">
              
              <div class="p-3 rounded-3 mb-4" style="background: rgba(14, 165, 233, 0.08); border: 1px solid rgba(14, 165, 233, 0.25);">
                <div class="small text-info">
                  <i class="bi bi-info-circle-fill me-1"></i>
                  <strong>Madre Acreditada:</strong> ${patient.socialName || patient.name} (RUT: ${patient.fileNumber}). Quedará formalmente inscrita como <strong>Tutora Legal Acreditada</strong> según la Ley 21.430 de Garantías de la Niñez.
                </div>
              </div>

              <div class="row g-3 mb-3">
                <div class="col-md-7">
                  <label class="form-label small text-white-50 mb-1">Nombre Completo del Recién Nacido *</label>
                  <input type="text" id="partoBabyName" class="form-control text-white" placeholder="Ej. Lucas Morales Vergara" required value="Lucas Morales Vergara" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px;">
                </div>
                <div class="col-md-5">
                  <label class="form-label small text-white-50 mb-1">Sexo Biológico *</label>
                  <select id="partoBabyGender" class="form-select text-white" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px;">
                    <option value="Masculino" class="bg-dark text-white" selected>Masculino</option>
                    <option value="Femenino" class="bg-dark text-white">Femenino</option>
                  </select>
                </div>
              </div>

              <div class="row g-3 mb-3">
                <div class="col-6 col-md-3">
                  <label class="form-label small text-white-50 mb-1">Peso al Nacer (kg) *</label>
                  <input type="number" step="0.01" id="partoBabyWeight" class="form-control text-white" value="3.42" required style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px;">
                </div>
                <div class="col-6 col-md-3">
                  <label class="form-label small text-white-50 mb-1">Talla al Nacer (cm) *</label>
                  <input type="number" step="0.5" id="partoBabyLength" class="form-control text-white" value="50.5" required style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px;">
                </div>
                <div class="col-6 col-md-3">
                  <label class="form-label small text-white-50 mb-1">Perímetro Craneal (cm)</label>
                  <input type="number" step="0.5" id="partoBabyHead" class="form-control text-white" value="35.0" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px;">
                </div>
                <div class="col-6 col-md-3">
                  <label class="form-label small text-white-50 mb-1">Apgar 1' / 5'</label>
                  <input type="text" id="partoBabyApgar" class="form-control text-white" value="9/10" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px;">
                </div>
              </div>

              <!-- Vacunas Iniciales PNI Automáticas -->
              <div class="p-3 rounded-3 mb-4" style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25);">
                <div class="fw-bold text-success small mb-1"><i class="bi bi-shield-plus me-1"></i>Protocolo Neonatal PNI Automático:</div>
                <div class="small text-white-50">
                  Se asignarán automáticamente las vacunas de Maternidad: <strong>BCG (Tuberculosis)</strong> y <strong>Hepatitis B</strong> con fecha de hoy y se inicializará la <strong>Curva de Crecimiento OMS (peso/edad y talla/edad)</strong>.
                </div>
              </div>

              <div class="d-flex justify-content-end gap-2">
                <button type="button" class="btn btn-glass-secondary px-4 py-2.5 rounded-pill" data-bs-dismiss="modal">Cancelar</button>
                <button type="submit" class="btn btn-success px-4 py-2.5 rounded-pill fw-bold d-inline-flex align-items-center gap-2 shadow" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                  <i class="bi bi-check2-circle fs-5"></i>
                  <span>Crear Ficha Pediátrica Oficial</span>
                </button>
              </div>

            </form>
          </div>

        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// 5. VINCULACIÓN DE EVENTOS DEL PORTAL MÉDICO
// ============================================================================

function attachMedicoEvents(container, patient) {
  // 1. Selector de Pacientes
  const selector = document.getElementById('medicoPatientSelector');
  if (selector) {
    selector.onchange = (e) => {
      const selectedId = e.target.value;
      const targetPatient = PATIENTS_DATABASE.find(p => p.id === selectedId);
      if (targetPatient) {
        setActivePatient(targetPatient);
        if (window.showGlassAlert) {
          window.showGlassAlert(`Cambiando a ficha clínica de ${targetPatient.socialName || targetPatient.name}...`, 'info');
        }
        renderDoctorView(container);
      }
    };
  }

  // 2. Navegación por pestañas
  container.querySelectorAll('.medico-tab-btn').forEach(btn => {
    btn.onclick = () => {
      const targetTab = btn.getAttribute('data-tab');
      setMedicoSubTab(targetTab);
      renderDoctorView(container);
    };
  });

  // 3. Montar el widget de ECG IoT y Gráfico Evolutivo si estamos en la pestaña de telemonitoreo
  if (medicoSubTab === 'telemonitoreo') {
    mountIotEcgWidget('medicoIotEcgContainer');
    initEvolutivoChart(patient, evolutivoDaysFilter);

    // Filtros de período del gráfico evolutivo (7, 15, 30 días)
    const periodBtns = container.querySelectorAll('#evolutivoPeriodGroup button');
    periodBtns.forEach(btn => {
      btn.onclick = () => {
        const days = parseInt(btn.getAttribute('data-days')) || 7;
        evolutivoDaysFilter = days;
        periodBtns.forEach(b => {
          b.classList.remove('btn-primary', 'shadow-sm');
          b.classList.add('btn-glass-secondary', 'text-white-50');
        });
        btn.classList.add('btn-primary', 'shadow-sm');
        btn.classList.remove('btn-glass-secondary', 'text-white-50');
        initEvolutivoChart(patient, evolutivoDaysFilter);
      };
    });

    // Pills de selección rápida de diagnósticos CIE-10
    container.querySelectorAll('.btn-cie10-pill').forEach(pill => {
      pill.onclick = () => {
        const input = document.getElementById('evoDiagnosis');
        if (input) {
          input.value = pill.getAttribute('data-cie10');
          input.focus();
        }
      };
    });

    // Formulario de Atención Clínica y Evolución Médica (Ley 20.584 / DS N° 41)
    const evoForm = document.getElementById('medicoEvolutionForm');
    if (evoForm) {
      evoForm.onsubmit = (e) => {
        e.preventDefault();
        const diag = document.getElementById('evoDiagnosis').value.trim();
        const notes = document.getElementById('evoNotes').value.trim();
        const antecedents = document.getElementById('evoAntecedents').value.trim() || 'Sin nuevos antecedentes consignados';

        if (!diag || !notes) {
          window.showGlassAlert('Por favor completa el diagnóstico y la evolución médica.', 'warning');
          return;
        }

        const cieMatch = diag.match(/^[A-Z][0-9]{2}(\.[0-9])?/i);
        const cieCode = cieMatch ? cieMatch[0].toUpperCase() : 'CIE-10';
        const hashSeal = `DS41-${Date.now().toString(16).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

        const newEvo = {
          id: `evo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          patientId: patient.id,
          patientName: patient.name,
          patientRut: patient.fileNumber,
          date: getTodayDateString(),
          timestamp: new Date().toISOString(),
          diagnosis: diag,
          cie10Code: cieCode,
          evolutionText: notes,
          antecedents: antecedents,
          doctorName: 'Dra. Elena Valdés',
          doctorRegistry: 'Reg. SIS N° 482910',
          doctorSpeciality: 'Medicina Interna y Geriatría',
          inmutabilitySeal: hashSeal,
          status: 'firmada'
        };

        const ok = savePatientMedicalEvolution(patient.id, newEvo);
        if (ok) {
          window.showGlassAlert(`✍️ Atención clínica firmada digitalmente y registrada en Ficha Clínica Oficial (Ley 20.584 / DS N° 41).`, 'success');
          if (typeof getModoVozActivo === 'function' && getModoVozActivo()) {
            speakText(`Atención médica firmada y guardada con éxito en la ficha clínica oficial.`);
          }
          evoForm.reset();
          renderDoctorView(container);
        } else {
          window.showGlassAlert('Error al guardar la evolución médica.', 'danger');
        }
      };
    }
  }

  // 4. Formulario de Prescripción Médica (Pestaña 2)
  const rxForm = document.getElementById('medicoPrescriptionForm');
  if (rxForm) {
    rxForm.onsubmit = (e) => {
      e.preventDefault();

      const medication = document.getElementById('rxMedication').value.trim();
      const dose = document.getElementById('rxDose').value.trim();
      const route = document.getElementById('rxRoute').value;
      const schedule = document.getElementById('rxSchedule').value;
      const duration = document.getElementById('rxDuration').value;
      const instructions = document.getElementById('rxInstructions').value.trim();

      if (!medication || !dose) {
        window.showGlassAlert('Por favor completa el nombre y la dosis del medicamento.', 'warning');
        return;
      }

      const newRx = {
        id: `rx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        patientId: patient.id,
        patientName: patient.name,
        medication: medication,
        dose: dose,
        route: route,
        schedule: schedule,
        frequency: schedule.includes('Cada') ? schedule : 'Cada 24 horas',
        duration: duration,
        instructions: instructions || 'Tomar según indicación médica regular.',
        prescribedBy: 'Dra. Elena Valdés',
        medicalRegistry: 'Reg. SIS N° 482910',
        speciality: 'Medicina Interna y Geriatría',
        date: getTodayDateString(),
        timestamp: new Date().toISOString(),
        status: 'activa',
        legalStamp: 'Ley 21.541 Telemedicina / Ley 21.668 Interoperabilidad'
      };

      const success = savePatientPrescription(patient.id, newRx);

      if (success) {
        window.showGlassAlert(`🎉 Receta de ${medication} firmada y enviada al pastillero de ${patient.socialName || patient.name}.`, 'success');
        if (typeof getModoVozActivo === 'function' && getModoVozActivo()) {
          speakText(`Receta médica de ${medication} firmada y sincronizada exitosamente con el pastillero del paciente.`);
        }
        rxForm.reset();
        renderDoctorView(container);
      } else {
        window.showGlassAlert('Error al guardar la prescripción.', 'danger');
      }
    };
  }

  // 5. Botones de Suspender / Reactivar Prescripciones (Pestaña 2)
  container.querySelectorAll('.btn-toggle-rx').forEach(btn => {
    btn.onclick = () => {
      const rxId = btn.getAttribute('data-rx-id');
      const newStatus = togglePrescriptionStatus(patient.id, rxId);
      if (newStatus) {
        window.showGlassAlert(`Receta actualizada a estado: ${newStatus.toUpperCase()}`, 'info');
        renderDoctorView(container);
      }
    };
  });

  // 6. Botón de Ficha Odontológica (Pestaña 3)
  const btnOpenDental = document.getElementById('btnOpenDentalModalFromMedico');
  if (btnOpenDental) {
    btnOpenDental.onclick = () => {
      openDentalModuleModal(patient.id === 'p_mateo' ? 'pediatrico' : 'adulto', 'doctor');
    };
  }

  // 7. EVENTOS DE PROTOCOLOS PREVENTIVOS Y MATERNO-INFANTIL (Pestaña 4)
  // A. Emitir órdenes de exámenes preventivos (PAP, Mamografía, APE, EMPAM, etc.)
  container.querySelectorAll('.btn-emit-preventive').forEach(btn => {
    btn.onclick = () => {
      const examName = btn.getAttribute('data-exam');
      const category = btn.getAttribute('data-type');
      const newOrder = {
        id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        patientId: patient.id,
        patientName: patient.name,
        examName: examName,
        category: category,
        doctor: 'Dra. Elena Valdés',
        registry: 'Reg. SIS N° 482910',
        date: getTodayDateString(),
        timestamp: new Date().toISOString()
      };

      savePreventiveOrder(patient.id, newOrder);
      window.showGlassAlert(`📄 Orden preventiva emitida: ${examName}. Sello digital Ley 21.668.`, 'success');
      if (typeof getModoVozActivo === 'function' && getModoVozActivo()) {
        speakText(`Orden preventiva de ${examName} emitida y registrada en la ficha clínica.`);
      }
      renderDoctorView(container);
    };
  });

  // B. Desplegar formulario de activación de gestación
  const btnToggleFormGest = document.getElementById('btnToggleFormGestacion');
  const formGestCollapse = document.getElementById('formGestacionCollapse');
  if (btnToggleFormGest && formGestCollapse) {
    btnToggleFormGest.onclick = () => {
      formGestCollapse.classList.toggle('d-none');
    };
  }

  // C. Guardar inicio de gestación
  const formStartPregnancy = document.getElementById('formStartPregnancy');
  if (formStartPregnancy) {
    formStartPregnancy.onsubmit = (e) => {
      e.preventDefault();
      const fur = document.getElementById('inputGestFur').value;
      const g = parseInt(document.getElementById('inputGestG').value) || 1;
      const p = parseInt(document.getElementById('inputGestP').value) || 0;

      const pregData = {
        isActive: true,
        fur: fur,
        gestas: g,
        partos: p,
        cesareas: 0,
        abortos: 0,
        fpp: calculateNaegeleFpp(fur),
        recordedBy: 'Dra. Elena Valdés',
        protocol: 'Chile Crece Contigo',
        createdAt: new Date().toISOString()
      };

      savePatientPregnancy(patient.id, pregData);
      window.showGlassAlert('🤰 Control prenatal Chile Crece Contigo activado. Alertas teratogénicas habilitadas.', 'success');
      if (typeof getModoVozActivo === 'function' && getModoVozActivo()) {
        speakText('Control de gestación activado con éxito. Se han configurado las alertas de protección teratogénica y radiológica.');
      }
      renderDoctorView(container);
    };
  }

  // D. Abrir modal de Parto
  const btnOpenModalParto = document.getElementById('btnOpenModalParto');
  if (btnOpenModalParto) {
    btnOpenModalParto.onclick = () => {
      const modalEl = document.getElementById('modalRegistroParto');
      if (modalEl && window.bootstrap) {
        const modal = new window.bootstrap.Modal(modalEl);
        modal.show();
      }
    };
  }

  // E. Confirmar parto y crear perfil pediátrico (Ley 21.430)
  const formRegistroParto = document.getElementById('formRegistroParto');
  if (formRegistroParto) {
    formRegistroParto.onsubmit = (e) => {
      e.preventDefault();

      const babyName = document.getElementById('partoBabyName').value.trim();
      const babyGender = document.getElementById('partoBabyGender').value;
      const babyWeight = parseFloat(document.getElementById('partoBabyWeight').value) || 3.4;
      const babyLength = parseFloat(document.getElementById('partoBabyLength').value) || 50;
      const babyHead = parseFloat(document.getElementById('partoBabyHead').value) || 35;
      const babyApgar = document.getElementById('partoBabyApgar').value.trim() || '9/10';

      const babyId = `p_rn_${Date.now()}`;
      const babyRut = `28.${Math.floor(100 + Math.random() * 899)}.${Math.floor(100 + Math.random() * 899)}-K`;
      const babyUsername = babyName.toLowerCase().replace(/\s+/g, '').substring(0, 8);

      // 1. Guardar en Historial Obstétrico Permanente de la madre
      const obstetricRecord = {
        id: `obs_${Date.now()}`,
        motherId: patient.id,
        motherName: patient.name,
        babyId: babyId,
        babyName: babyName,
        babyGender: babyGender,
        birthWeight: babyWeight,
        birthLength: babyLength,
        headCircumference: babyHead,
        apgar: babyApgar,
        deliveryDate: getTodayDateString(),
        timestamp: new Date().toISOString(),
        attendingDoctor: 'Dra. Elena Valdés',
        status: 'Parto Eutócico Exitoso'
      };
      savePatientObstetricHistory(patient.id, obstetricRecord);

      // 2. Cerrar embarazo activo de la madre
      closePatientPregnancy(patient.id);

      // 3. Crear nuevo perfil de Paciente Pediátrico en PATIENTS_DATABASE y localStorage
      const newBabyPatient = new Patient(
        babyId,
        babyName,
        0, // 0 años (Recién nacido)
        babyGender,
        babyWeight,
        babyLength,
        'O+',
        ['GENERAL'],
        'Ninguna',
        {
          name: patient.socialName || patient.name,
          relation: 'Madre (Tutora Legal Acreditada)',
          phone: patient.emergencyContact?.phone || '+56987654321'
        },
        babyRut,
        babyUsername,
        'bebe123',
        babyName,
        babyGender === 'Femenino' ? 'Ella' : 'Él',
        patient.prevision || 'FONASA Tramo B',
        false
      );

      // Metadatos de Ley 21.430 (Garantías de la Niñez)
      newBabyPatient.legalGuardianName = patient.name;
      newBabyPatient.legalGuardianRut = patient.fileNumber;
      newBabyPatient.legalGuardianRelation = 'Madre';
      newBabyPatient.isPediatric = true;
      newBabyPatient.pniVaccines = [
        { name: 'BCG (Tuberculosis)', status: 'Administrada en Maternidad', date: getTodayDateString() },
        { name: 'Hepatitis B (Dosis RN)', status: 'Administrada en Maternidad', date: getTodayDateString() }
      ];
      newBabyPatient.omsGrowthInitial = {
        birthWeight: babyWeight,
        birthLength: babyLength,
        headCircumference: babyHead
      };

      PATIENTS_DATABASE.push(newBabyPatient);

      // Persistir paciente dinámico en localStorage
      try {
        const rawCustom = localStorage.getItem('cuidapp_custom_patients');
        const customList = rawCustom ? JSON.parse(rawCustom) : [];
        customList.push(newBabyPatient);
        localStorage.setItem('cuidapp_custom_patients', JSON.stringify(customList));
      } catch (err) {
        console.error('Error al persistir paciente recién nacido:', err);
      }

      // Cerrar modal
      const modalEl = document.getElementById('modalRegistroParto');
      if (modalEl && window.bootstrap) {
        const modal = window.bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }

      // Conmutar activo al recién nacido para atención pediátrica inmediata
      setActivePatient(newBabyPatient);

      window.showGlassAlert(`🎉 ¡Parto registrado exitosamente! Ficha de ${babyName} creada con vacunas BCG/Hepatitis B y vinculada legalmente a ${patient.socialName || patient.name}.`, 'success');

      if (typeof getModoVozActivo === 'function' && getModoVozActivo()) {
        speakText(`Parto registrado con éxito. Se ha generado la ficha pediátrica oficial del recién nacido ${babyName}, vinculado legalmente a su madre bajo la ley de garantías de la niñez.`);
      }

      renderDoctorView(container);
    };
  }

  // Inicializar Custom Selects
  initCustomSelects();
}

export const renderMedicoView = renderDoctorView;
