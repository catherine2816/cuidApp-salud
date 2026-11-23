/**
 * @fileoverview Portal del Paciente y Telecuidado Especializado - cuidApp
 * @module src/paciente.js
 * @description Interfaz reactiva adaptada según etapa de vida y perfil clínico:
 * - Adolescentes (CLAP / MINSAL, confidencialidad y autonomía progresiva Ley 21.430)
 * - Adulto Mayor / Senior (interfaz táctil gigante de alto contraste, asistencia por voz)
 * - Gestante / Carnet Perinatal (semanas de gestación, controles, carnet prenatal digital)
 * - Telemetría IoT en vivo (ECG AD8232 a 250 Hz) y Simulador Telefónico IVR
 *
 * @compliance
 * - Ley N° 20.584: Acceso directo y transparente del paciente a su información médica
 * - Ley N° 21.430: Autonomía progresiva y confidencialidad en adolescentes
 * - Ley N° 21.541: Prestación remota y monitoreo telemático domiciliario
 * - Decreto Supremo N° 41 MINSAL: Integridad y trazabilidad de registros clínicos
 */

import {
  activePatient,
  getActivePatient,
  setActivePatient,
  PATIENTS_DATABASE,
  CAREGIVERS_DATABASE,
  speakText,
  attachVoiceGuidance,
  renderView,
  modoVozActivo,
  setModoVozActivo,
  debeSaludarAlIngresar,
  setDebeSaludarAlIngresar
} from './main.js';
import {
  isPediatric,
  setIsPediatric,
  getIsPediatric,
  pediatricSubTab,
  setPediatricSubTab,
  getPediatricSubTab,
  renderPediatricView,
  ensureMateoDemoData,
  getAddChildModalHTML
} from './pediatrico.js';
import { openDentalModuleModal } from './odontologia.js';
import { getPatientPrescriptions, getPatientMedicalEvolutions } from './medico.js';
import {
  renderEvaluationView,
  caregiverInternalTab,
  setCaregiverInternalTab,
  getCaregiverInternalTab,
  activeFolder,
  setActiveFolder,
  getActiveFolder,
  openRegisterBirthModal
} from './cuidador.js';
import { mountIotEcgWidget, getPatientEcgRecords } from './iot-ecg.js';

export let patientSubTab = 'salud';
export let patientActiveSubTab = 'salud';
export function setPatientSubTab(tab) {
  patientSubTab = tab;
  patientActiveSubTab = tab;
}
export function getPatientSubTab() {
  return patientSubTab;
}

export let _lastSpokenSubTab = null;
export function setLastSpokenSubTab(tab) {
  _lastSpokenSubTab = tab;
}

export let docsActiveFilter = 'todos'; // 'todos' | 'recetas' | 'examenes' | 'informes'
export function setDocsActiveFilter(filter) {
  docsActiveFilter = filter;
}

// --- MODO VISUAL SIMPLE / INCLUSIÓN UNIVERSAL (LEY N° 20.584) ---
export let modoVisualSimple = false;
try {
  modoVisualSimple = localStorage.getItem('cuidapp_simple_visual_mode') === 'true';
} catch (e) {}

export function setModoVisualSimple(val) {
  modoVisualSimple = !!val;
  try {
    localStorage.setItem('cuidapp_simple_visual_mode', modoVisualSimple ? 'true' : 'false');
  } catch (e) {}
}

// Helper para guardar autoreportes del paciente en bitácora clínica con trazabilidad DS N° 41
export function savePatientSelfLog(patientId, note, alertLevel = 'normal', mood = 'Bien') {
  try {
    const key = `cuidapp_clinical_logs_${patientId}`;
    const raw = localStorage.getItem(key);
    const logs = raw ? JSON.parse(raw) : [];
    const newEntry = {
      id: 'rec_patient_' + Date.now(),
      patientId: patientId,
      patientName: activePatient ? (activePatient.socialName || activePatient.name) : 'Paciente',
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
      recordedBy: `${activePatient ? (activePatient.socialName || activePatient.name) : 'Paciente'} (Autoreporte Inclusivo)`,
      role: 'paciente',
      vitals: {
        systolic: patientTempVitals?.systolic || 120,
        diastolic: patientTempVitals?.diastolic || 80,
        heartRate: patientTempVitals?.heartRate || 72,
        painLevel: mood === 'Mal' ? 5 : mood === 'Regular' ? 2 : 0
      },
      alertLevel: alertLevel,
      notes: `[Autoreporte Estado de Ánimo: ${mood}] ${note}`,
      legalSeal: 'DS N° 41 / Ley 20.584 Registro Autenticado de Paciente'
    };
    logs.unshift(newEntry);
    if (logs.length > 50) logs.pop();
    localStorage.setItem(key, JSON.stringify(logs));
    return newEntry;
  } catch (e) {
    console.error('Error guardando en cuidapp_clinical_logs:', e);
    return null;
  }
}

// --- 1. MODAL DE CREDENCIAL CLÍNICA PORTÁTIL DE URGENCIA (LEY N° 21.668 / LEY N° 20.584) ---
export function openMedicalCredentialModal() {
  const patient = activePatient;
  if (!patient) return;

  const activePrescriptions = getPatientPrescriptions(patient.id).filter(r => r.status === 'activa');

  let ecgStatusText = 'Ritmo Sinusal Regular (Sensor Conectado)';
  let ecgStatusBadge = 'bg-success text-success';
  try {
    const rawEcg = localStorage.getItem(`cuidapp_ecg_alerts_${patient.id}`);
    if (rawEcg) {
      const ecgAlerts = JSON.parse(rawEcg);
      if (ecgAlerts.length > 0) {
        const lastAlert = ecgAlerts[0];
        ecgStatusText = `${lastAlert.bpm} BPM [${lastAlert.state}] - ${lastAlert.detail || 'Alerta ECG registrada'}`;
        ecgStatusBadge = lastAlert.state === 'ROJO' ? 'bg-danger text-danger' : 'bg-warning text-warning';
      }
    }
  } catch (e) {}

  const qrDataPayload = JSON.stringify({
    rut: patient.fileNumber,
    paciente: patient.socialName || patient.name,
    nombreLegal: patient.name,
    edad: patient.age,
    sangre: patient.bloodType || 'O+',
    alergias: patient.allergies || 'Ninguna registrada',
    condiciones: patient.conditions || [],
    prevision: patient.prevision,
    recetas: activePrescriptions.map(r => `${r.medication} ${r.dose} (${r.schedule})`),
    ecg: ecgStatusText,
    emisor: 'cuidApp Chile Telemedicina (Ley 21.668 / Ley 20.584)'
  });

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrDataPayload)}`;

  let modalEl = document.getElementById('medicalCredentialModal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'medicalCredentialModal';
    document.body.appendChild(modalEl);
  }

  modalEl.innerHTML = `
    <div class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.82); backdrop-filter: blur(12px); z-index: 1080;">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content glass-card p-4 text-white" style="background: rgba(15, 23, 42, 0.96); border: 2px solid rgba(16, 185, 129, 0.5); border-radius: 26px; box-shadow: 0 25px 65px rgba(0,0,0,0.85);">
          <div class="modal-header border-bottom border-light border-opacity-10 pb-3">
            <div class="d-flex align-items-center gap-3">
              <span style="font-size: 2.4rem; line-height: 1;">🏥</span>
              <div>
                <h4 class="modal-title fw-bold text-white m-0" style="font-family: 'Outfit';">Credencial Clínica Portátil de Urgencia</h4>
                <small class="text-white-50">Resumen Oficial para Atención Médica Inmediata &bull; Ley N° 20.584 & Ley N° 21.668</small>
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" id="btnCloseMedicalCredential"></button>
          </div>

          <div class="modal-body py-3">
            <div class="row g-4 align-items-center">
              <!-- QR Dinámico -->
              <div class="col-md-5 text-center">
                <div class="p-3 bg-white rounded-4 d-inline-block shadow-lg mb-2" style="border: 3px solid rgba(16, 185, 129, 0.6);">
                  <img src="${qrImageUrl}" alt="Código QR Clínico" style="width: 200px; height: 200px; display: block;" onerror="this.parentElement.innerHTML='<div class=\\'text-dark p-4 border border-dark rounded\\'><strong>[QR CLÍNICO DE EMERGENCIA]</strong><br>RUT: ${patient.fileNumber}</div>'">
                </div>
                <div class="text-white-50 small mt-2">
                  <i class="bi bi-qr-code-scan me-1 text-success"></i> Escaneo rápido con cualquier lector médico o celular
                </div>
              </div>

              <!-- Ficha Resumen -->
              <div class="col-md-7">
                <div class="p-3 rounded-3 bg-white bg-opacity-5 border border-white border-opacity-10 mb-3">
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <h4 class="fw-bold m-0 text-white">${patient.socialName || patient.name}</h4>
                      ${patient.socialName && patient.socialName !== patient.name ? `<small class="text-white-50">Legal: ${patient.name}</small><br>` : ''}
                      <span class="text-warning font-monospace fw-bold fs-6">RUT: ${patient.fileNumber}</span>
                    </div>
                    <span class="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-50 px-3 py-1 fs-6">
                      Grupo: ${patient.bloodType || 'O+'}
                    </span>
                  </div>

                  <div class="row g-2 small text-white text-opacity-80 pt-2 border-top border-light border-opacity-10">
                    <div class="col-6"><strong>Edad:</strong> ${patient.age} años</div>
                    <div class="col-6"><strong>Sexo:</strong> ${patient.gender}</div>
                    <div class="col-6"><strong>Previsión:</strong> ${patient.prevision}</div>
                    <div class="col-6"><strong>Donante:</strong> ${patient.isOrganDonor ? 'Sí (Ley 19.451)' : 'No'}</div>
                  </div>
                </div>

                <!-- Alerta de Alergias -->
                <div class="p-2.5 rounded-3 mb-2 d-flex align-items-center gap-2 ${patient.allergies && patient.allergies.toLowerCase() !== 'ninguna' ? 'bg-danger bg-opacity-20 border border-danger border-opacity-40 text-danger' : 'bg-success bg-opacity-15 border border-success border-opacity-30 text-success'}">
                  <i class="bi bi-exclamation-octagon-fill fs-5"></i>
                  <div class="small">
                    <strong>Alergias Conocidas:</strong> ${patient.allergies || 'Ninguna registrada'}
                  </div>
                </div>

                <!-- Recetas Activas -->
                <div class="p-2.5 rounded-3 bg-white bg-opacity-5 border border-white border-opacity-10 mb-2 small">
                  <strong class="text-info d-block mb-1"><i class="bi bi-capsule me-1"></i>Medicamentos Actuales:</strong>
                  ${activePrescriptions.length > 0 ? activePrescriptions.map(r => `<span class="badge bg-primary bg-opacity-20 text-primary border border-primary border-opacity-25 me-1 mb-1">${r.medication} ${r.dose} (${r.schedule})</span>`).join('') : '<span class="text-white-50">Sin recetas activas registradas</span>'}
                </div>

                <!-- Estado ECG IoT -->
                <div class="p-2.5 rounded-3 bg-white bg-opacity-5 border border-white border-opacity-10 small d-flex align-items-center justify-content-between">
                  <div>
                    <strong class="text-white"><i class="bi bi-heart-pulse-fill text-danger me-1"></i>Monitor ECG IoT:</strong>
                    <div class="text-white-50" style="font-size: 0.78rem;">${ecgStatusText}</div>
                  </div>
                  <span class="badge-glass ${ecgStatusBadge} small">Telemetría AD8232</span>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer border-top border-light border-opacity-10 pt-3 d-flex justify-content-between flex-wrap gap-2">
            <button type="button" id="btnExportFhirJson" class="btn btn-glass-primary px-4 py-2 d-inline-flex align-items-center gap-2">
              <i class="bi bi-download"></i> <span>📥 Exportar Ficha Interoperable (Ley N° 21.668 / HL7 FHIR)</span>
            </button>
            <button type="button" class="btn btn-glass-secondary px-4 py-2" id="btnCloseMedicalCredentialFooter">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const closeFn = () => { modalEl.innerHTML = ''; };
  document.getElementById('btnCloseMedicalCredential').onclick = closeFn;
  document.getElementById('btnCloseMedicalCredentialFooter').onclick = closeFn;

  // Exportar archivo HL7 FHIR Interoperable JSON (Ley N° 21.668)
  document.getElementById('btnExportFhirJson').onclick = () => {
    const fhirBundle = {
      resourceType: "Bundle",
      id: `cuidapp-fhir-${patient.id}-${Date.now()}`,
      meta: {
        lastUpdated: new Date().toISOString(),
        profile: [
          "https://hl7chile.cl/fhir/ig/Core/StructureDefinition/BundleCl",
          "https://minsal.cl/fhir/ig/telemedicina/StructureDefinition/FichaInteroperable"
        ]
      },
      identifier: {
        system: "https://cuidapp.salud.gob.cl/bundles",
        value: `URN:UUID:${patient.id}`
      },
      type: "document",
      timestamp: new Date().toISOString(),
      legalBasis: {
        laws: ["Ley N° 21.668 (Interoperabilidad de la Ficha Clínica)", "Ley N° 20.584 (Derechos y Deberes del Paciente)", "Decreto Supremo N° 41 MINSAL"],
        traceabilitySeal: "DS41-MINSAL-" + Math.random().toString(36).substring(2, 10).toUpperCase()
      },
      entry: [
        {
          fullUrl: `urn:uuid:patient-${patient.id}`,
          resource: {
            resourceType: "Patient",
            id: patient.id,
            identifier: [
              {
                system: "http://regcivil.cl/run",
                value: patient.fileNumber
              }
            ],
            active: true,
            name: [
              {
                use: "usual",
                text: patient.socialName || patient.name
              },
              {
                use: "official",
                text: patient.name
              }
            ],
            gender: patient.gender === 'Femenino' ? 'female' : 'male',
            birthDate: patient.birthDate || '1950-01-01',
            telecom: [
              {
                system: "phone",
                value: patient.phone || patient.emergencyContact?.phone || "+56912345678"
              }
            ],
            extension: [
              {
                url: "https://hl7chile.cl/fhir/StructureDefinition/PrevisionSalud",
                valueString: patient.prevision
              },
              {
                url: "https://hl7chile.cl/fhir/StructureDefinition/PronombresIdentidad",
                valueString: patient.pronouns || "No informado"
              }
            ]
          }
        },
        {
          fullUrl: `urn:uuid:observation-vitals-${patient.id}`,
          resource: {
            resourceType: "Observation",
            status: "final",
            category: [
              {
                coding: [
                  {
                    system: "http://terminology.hl7.org/CodeSystem/observation-category",
                    code: "vital-signs"
                  }
                ]
              }
            ],
            code: {
              coding: [{ system: "http://loinc.org", code: "85354-9", display: "Blood pressure panel" }],
              text: "Signos Vitales y Presión Arterial"
            },
            component: [
              {
                code: { coding: [{ system: "http://loinc.org", code: "8480-6" }], text: "Sistólica" },
                valueQuantity: { value: patientTempVitals?.systolic || 120, unit: "mmHg" }
              },
              {
                code: { coding: [{ system: "http://loinc.org", code: "8462-4" }], text: "Diastólica" },
                valueQuantity: { value: patientTempVitals?.diastolic || 80, unit: "mmHg" }
              },
              {
                code: { coding: [{ system: "http://loinc.org", code: "8867-4" }], text: "Frecuencia Cardíaca" },
                valueQuantity: { value: patientTempVitals?.heartRate || 72, unit: "bpm" }
              }
            ]
          }
        },
        ...activePrescriptions.map((rx, idx) => ({
          fullUrl: `urn:uuid:medication-${idx}-${rx.id}`,
          resource: {
            resourceType: "MedicationStatement",
            id: rx.id,
            status: "active",
            medicationCodeableConcept: {
              text: `${rx.medication} ${rx.dose}`
            },
            dosage: [
              {
                text: `${rx.schedule} - ${rx.duration || 'Tratamiento Crónico'}`
              }
            ],
            informationSource: {
              display: rx.prescribedBy || "Dra. Elena Valdés (Reg. SIS N° 482910)"
            }
          }
        }))
      ]
    };

    const dataBlob = new Blob([JSON.stringify(fhirBundle, null, 2)], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(dataBlob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `ficha_clinica_interoperable_fhir_${patient.id}_ley21668.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(downloadUrl);

    window.showGlassAlert('📥 Ficha clínica interoperable HL7 FHIR descargada exitosamente.', 'success');
    if (modoVozActivo) speakText('Descarga de ficha clínica interoperable HL7 FHIR completada.');
  };

  if (modoVozActivo) {
    speakText(`Mostrando credencial clínica portátil de ${patient.socialName || patient.name}. Puedes descargar tu ficha interoperable para tu médico.`);
  }
}

// --- 3. SIMULADOR DE LLAMADA TELEFÓNICA AUTOMATIZADA (IVR PARA TELÉFONOS ANTIGUOS/FIJOS) ---
export function openIvrCallSimulationModal() {
  const patient = activePatient;
  if (!patient) return;

  let modalEl = document.getElementById('ivrCallSimulationModal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'ivrCallSimulationModal';
    document.body.appendChild(modalEl);
  }

  const voicePrompt = 'Hola, le llama cuidApp. Es hora de tomar su medicamento... Presione 1 si ya lo tomó, o presione 2 si necesita ayuda de su cuidador.';
  speakText(voicePrompt, { immediate: true, force: true });

  modalEl.innerHTML = `
    <div class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.85); backdrop-filter: blur(15px); z-index: 1085;">
      <div class="modal-dialog modal-dialog-centered" style="max-width: 430px;">
        <div class="modal-content glass-card p-4 text-white text-center" style="background: rgba(15, 23, 42, 0.98); border: 2px solid rgba(14, 165, 233, 0.55); border-radius: 32px; box-shadow: 0 30px 80px rgba(0,0,0,0.92);">
          
          <!-- Encabezado de Llamada Entrante -->
          <div class="mb-3">
            <div class="rounded-circle d-inline-flex justify-content-center align-items-center mb-2" style="width: 76px; height: 76px; background: rgba(14, 165, 233, 0.2); border: 2px solid #38bdf8;">
              <span class="phone-ringing-icon fs-1">📞</span>
            </div>
            <h5 class="fw-bold text-white mb-0" style="font-family: 'Outfit';">Llamada Automatizada cuidApp</h5>
            <small class="text-white-50">Línea de Asistencia MINSAL &bull; (+56 2 2800 9000)</small>
            <div class="mt-2">
              <span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25 px-3 py-1">
                <span class="blinking-dot me-1"></span> LLAMADA EN CURSO...
              </span>
            </div>
          </div>

          <!-- Mensaje IVR Dictado -->
          <div id="ivrMessageCard" class="p-3 rounded-4 mb-3 text-start" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);">
            <div class="d-flex align-items-start gap-2 mb-2">
              <span class="fs-4">🔊</span>
              <p class="m-0 text-white fw-semibold" style="font-size: 1.05rem; line-height: 1.4;">
                "Hola, le llama cuidApp. Es hora de tomar su medicamento... 
                <strong>Presione 1</strong> si ya lo tomó, o <strong>presione 2</strong> si necesita ayuda de su cuidador."
              </p>
            </div>
            <div class="text-end">
              <button type="button" id="btnRepeatIvrPrompt" class="btn btn-sm btn-glass-secondary text-white py-1 px-2.5 small" style="border-radius: 8px;">
                <i class="bi bi-arrow-repeat me-1"></i> Repetir audio
              </button>
            </div>
          </div>

          <!-- Teclado Telefónico Clásico (Dialpad) -->
          <div class="ivr-dialpad-grid mb-4">
            <button class="ivr-dialpad-btn" data-key="1">
              <span class="ivr-dialpad-number">1</span>
              <span class="ivr-dialpad-sub">✅ Ya la tomé</span>
            </button>
            <button class="ivr-dialpad-btn" data-key="2">
              <span class="ivr-dialpad-number">2</span>
              <span class="ivr-dialpad-sub text-warning">🆘 Ayuda</span>
            </button>
            <button class="ivr-dialpad-btn" data-key="3">
              <span class="ivr-dialpad-number">3</span>
              <span class="ivr-dialpad-sub">DEF</span>
            </button>
            <button class="ivr-dialpad-btn" data-key="4">
              <span class="ivr-dialpad-number">4</span>
              <span class="ivr-dialpad-sub">GHI</span>
            </button>
            <button class="ivr-dialpad-btn" data-key="5">
              <span class="ivr-dialpad-number">5</span>
              <span class="ivr-dialpad-sub">JKL</span>
            </button>
            <button class="ivr-dialpad-btn" data-key="6">
              <span class="ivr-dialpad-number">6</span>
              <span class="ivr-dialpad-sub">MNO</span>
            </button>
            <button class="ivr-dialpad-btn" data-key="7">
              <span class="ivr-dialpad-number">7</span>
              <span class="ivr-dialpad-sub">PQRS</span>
            </button>
            <button class="ivr-dialpad-btn" data-key="8">
              <span class="ivr-dialpad-number">8</span>
              <span class="ivr-dialpad-sub">TUV</span>
            </button>
            <button class="ivr-dialpad-btn" data-key="9">
              <span class="ivr-dialpad-number">9</span>
              <span class="ivr-dialpad-sub">WXYZ</span>
            </button>
            <button class="ivr-dialpad-btn" data-key="*">
              <span class="ivr-dialpad-number">*</span>
              <span class="ivr-dialpad-sub">Repetir</span>
            </button>
            <button class="ivr-dialpad-btn" data-key="0">
              <span class="ivr-dialpad-number">0</span>
              <span class="ivr-dialpad-sub">+</span>
            </button>
            <button class="ivr-dialpad-btn" data-key="#">
              <span class="ivr-dialpad-number">#</span>
              <span class="ivr-dialpad-sub">Fin</span>
            </button>
          </div>

          <!-- Botón de Colgar -->
          <div class="d-flex justify-content-center">
            <button type="button" id="btnHangUpIvr" class="btn btn-danger px-5 py-2.5 rounded-pill fw-bold shadow-lg d-inline-flex align-items-center gap-2" style="font-size: 1.15rem; background: #dc2626;">
              <i class="bi bi-telephone-x-fill fs-5"></i> Colgar Llamada
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const closeFn = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    modalEl.innerHTML = '';
  };

  document.getElementById('btnHangUpIvr').onclick = closeFn;

  document.getElementById('btnRepeatIvrPrompt').onclick = () => {
    speakText(voicePrompt, { immediate: true, force: true });
  };

  // Listeners de teclado numérico IVR
  modalEl.querySelectorAll('.ivr-dialpad-btn').forEach(btn => {
    btn.onclick = () => {
      const key = btn.getAttribute('data-key');
      if (key === '1') {
        // REGISTRO DE TOMA DE MEDICAMENTOS (OPCIÓN 1)
        window._medTakenMap = window._medTakenMap || {};
        const prescriptions = getPatientPrescriptions(patient.id);
        prescriptions.forEach(rx => { window._medTakenMap[rx.id] = true; });
        if (patientTempVitals) patientTempVitals.medication = true;

        // Registrar en bitácora clínica
        try {
          const logKey = `cuidapp_clinical_logs_${patient.id}`;
          const raw = localStorage.getItem(logKey);
          const logs = raw ? JSON.parse(raw) : [];
          logs.unshift({
            id: 'ivr_log_' + Date.now(),
            patientId: patient.id,
            patientName: patient.socialName || patient.name,
            timestamp: new Date().toISOString(),
            date: new Date().toISOString().split('T')[0],
            recordedBy: 'Sistema Telefónico IVR cuidApp (Respuesta Opción 1)',
            role: 'paciente',
            vitals: { systolic: patientTempVitals?.systolic || 120, diastolic: patientTempVitals?.diastolic || 80, heartRate: 72 },
            alertLevel: 'normal',
            notes: 'Medicamento confirmado como tomado por el paciente mediante llamada telefónica interactiva (Opción 1).',
            legalSeal: 'DS N° 41 / Ley 20.584 Trazabilidad Telefónica IVR'
          });
          localStorage.setItem(logKey, JSON.stringify(logs));
        } catch (e) {}

        const confirmMsg = 'Gracias. Se ha registrado exitosamente la toma de su medicamento. Que tenga un buen día.';
        speakText(confirmMsg, { immediate: true, force: true });
        window.showGlassAlert('🎉 Medicamento registrado por llamada IVR (Opción 1).', 'success');

        const msgCard = document.getElementById('ivrMessageCard');
        if (msgCard) {
          msgCard.className = 'p-3 rounded-4 mb-3 text-start bg-success bg-opacity-20 border border-success border-opacity-40 text-success';
          msgCard.innerHTML = `<h5 class="fw-bold mb-1"><i class="bi bi-check-circle-fill me-2"></i>¡Dosis Registrada con Éxito!</h5><p class="small m-0 text-white">Opción 1 recibida correctamente. Colgando llamada...</p>`;
        }
        setTimeout(closeFn, 2800);

      } else if (key === '2') {
        // ALERTA PRIORITARIA DE ASISTENCIA PARA LA CUIDADORA (OPCIÓN 2)
        try {
          const logKey = `cuidapp_clinical_logs_${patient.id}`;
          const raw = localStorage.getItem(logKey);
          const logs = raw ? JSON.parse(raw) : [];
          logs.unshift({
            id: 'ivr_alert_' + Date.now(),
            patientId: patient.id,
            patientName: patient.socialName || patient.name,
            timestamp: new Date().toISOString(),
            date: new Date().toISOString().split('T')[0],
            recordedBy: 'Sistema Telefónico IVR cuidApp (Respuesta Opción 2)',
            role: 'cuidador',
            vitals: { systolic: patientTempVitals?.systolic || 120, diastolic: patientTempVitals?.diastolic || 80, heartRate: 72 },
            alertLevel: 'critico',
            notes: '⚠️ ALERTA PRIORITARIA IVR: El paciente presionó Opción 2 solicitando asistencia urgente con sus medicamentos.',
            legalSeal: 'DS N° 41 / Ley 20.584 Alerta de Asistencia Telefónica'
          });
          localStorage.setItem(logKey, JSON.stringify(logs));
        } catch (e) {}

        const helpMsg = 'Opción 2 recibida. Hemos emitido una alerta prioritaria a su cuidadora Sofía Díaz para que se comunique con usted de inmediato.';
        speakText(helpMsg, { immediate: true, force: true });
        window.showGlassAlert('🚨 Alerta prioritaria enviada a tu cuidadora (Opción 2 recibida).', 'danger');

        const msgCard = document.getElementById('ivrMessageCard');
        if (msgCard) {
          msgCard.className = 'p-3 rounded-4 mb-3 text-start bg-danger bg-opacity-20 border border-danger border-opacity-40 text-danger';
          msgCard.innerHTML = `<h5 class="fw-bold mb-1"><i class="bi bi-exclamation-triangle-fill me-2"></i>¡Alerta Prioritaria Emitida!</h5><p class="small m-0 text-white">Se ha notificado a tu cuidadora Sofía Díaz para que te llame de inmediato.</p>`;
        }
        setTimeout(closeFn, 3500);

      } else if (key === '*') {
        speakText(voicePrompt, { immediate: true, force: true });
      } else if (key === '#') {
        closeFn();
      } else {
        speakText(`Ha presionado ${key}. Por favor presione 1 si ya tomó su remedio o 2 si necesita asistencia.`, { immediate: true, force: true });
      }
    };
  });
}

// --- DICTADO POR VOZ CON SPEECH RECOGNITION (O FALLBACK AMIGABLE) ---
export function handleVoiceDictationForPatient(feedbackEl) {
  const patient = activePatient;
  if (!patient) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showSpeechFallbackModal();
    return;
  }

  try {
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-CL';
    recognition.continuous = false;
    recognition.interimResults = false;

    if (feedbackEl) {
      feedbackEl.classList.remove('d-none');
      feedbackEl.innerHTML = `<span class="spinner-grow spinner-grow-sm text-danger me-2"></span><strong class="text-warning">🔴 Escuchando... Habla ahora con tu voz</strong>`;
    }
    speakText('Te escucho. Por favor cuéntame cómo te sientes o qué necesitas.', { force: true });

    recognition.onresult = (event) => {
      const spokenText = event.results[0][0].transcript;
      if (!spokenText) return;

      try {
        const logKey = `cuidapp_clinical_logs_${patient.id}`;
        const raw = localStorage.getItem(logKey);
        const logs = raw ? JSON.parse(raw) : [];
        logs.unshift({
          id: 'voice_log_' + Date.now(),
          patientId: patient.id,
          patientName: patient.socialName || patient.name,
          timestamp: new Date().toISOString(),
          date: new Date().toISOString().split('T')[0],
          recordedBy: `${patient.socialName || patient.name} (Dictado por Voz)`,
          role: 'paciente',
          vitals: { systolic: patientTempVitals?.systolic || 120, diastolic: patientTempVitals?.diastolic || 80, heartRate: 72 },
          alertLevel: 'normal',
          notes: `[Mensaje Dictado por Voz]: "${spokenText}"`,
          legalSeal: 'DS N° 41 / Ley 20.584 Registro por Voz'
        });
        localStorage.setItem(logKey, JSON.stringify(logs));
      } catch (e) {}

      window.showGlassAlert(`🎤 Mensaje guardado: "${spokenText}"`, 'success');
      if (feedbackEl) {
        feedbackEl.innerHTML = `<i class="bi bi-check-circle-fill text-success me-2"></i><strong>Mensaje guardado:</strong> "${spokenText}"`;
      }
      speakText(`Guardé tu mensaje: "${spokenText}". Ya quedó registrado en tu ficha.`, { force: true });
    };

    recognition.onerror = () => {
      showSpeechFallbackModal();
    };

    recognition.start();
  } catch (err) {
    showSpeechFallbackModal();
  }
}

function showSpeechFallbackModal() {
  const patient = activePatient;
  const quickOptions = [
    "Me siento muy bien y con energía.",
    "Me duele un poco la cabeza.",
    "Tengo mareos y necesito descansar.",
    "Ya me tomé todos mis remedios de hoy.",
    "Necesito que mi cuidadora venga a revisarme."
  ];

  let modalEl = document.getElementById('speechFallbackModal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'speechFallbackModal';
    document.body.appendChild(modalEl);
  }

  modalEl.innerHTML = `
    <div class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.8); backdrop-filter: blur(12px); z-index: 1085;">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content glass-card p-4 text-white text-center" style="background: rgba(15, 23, 42, 0.98); border: 2px solid rgba(255,255,255,0.2); border-radius: 28px;">
          <h5 class="fw-bold mb-2 text-warning"><i class="bi bi-mic-fill me-2"></i>Comunicar con un Solo Toque</h5>
          <p class="small text-white-50 mb-3">Toca la frase que mejor describe cómo te sientes hoy para enviarla directamente a tu cuidador:</p>
          
          <div class="d-flex flex-column gap-2 mb-3">
            ${quickOptions.map(opt => `
              <button class="btn btn-glass-secondary text-start p-3 rounded-3 text-white quick-phrase-btn" data-phrase="${opt}" style="font-size: 1.15rem; border: 1.5px solid rgba(255,255,255,0.15);">
                🗣️ ${opt}
              </button>
            `).join('')}
          </div>

          <button type="button" class="btn btn-glass-secondary px-4 py-2" id="btnCloseSpeechFallback">Cerrar</button>
        </div>
      </div>
    </div>
  `;

  const closeFn = () => { modalEl.innerHTML = ''; };
  document.getElementById('btnCloseSpeechFallback').onclick = closeFn;

  modalEl.querySelectorAll('.quick-phrase-btn').forEach(btn => {
    btn.onclick = () => {
      const phrase = btn.getAttribute('data-phrase');
      try {
        const logKey = `cuidapp_clinical_logs_${patient.id}`;
        const raw = localStorage.getItem(logKey);
        const logs = raw ? JSON.parse(raw) : [];
        logs.unshift({
          id: 'phrase_log_' + Date.now(),
          patientId: patient.id,
          patientName: patient.socialName || patient.name,
          timestamp: new Date().toISOString(),
          date: new Date().toISOString().split('T')[0],
          recordedBy: `${patient.socialName || patient.name} (Mensaje Rápido)`,
          role: 'paciente',
          vitals: { systolic: 120, diastolic: 80, heartRate: 72 },
          alertLevel: phrase.includes('mareos') || phrase.includes('venga') ? 'advertencia' : 'normal',
          notes: `[Mensaje Rápido del Paciente]: "${phrase}"`,
          legalSeal: 'DS N° 41 / Ley 20.584 Registro Directo'
        });
        localStorage.setItem(logKey, JSON.stringify(logs));
      } catch (e) {}

      window.showGlassAlert(`Mensaje enviado: "${phrase}"`, 'success');
      speakText(`Mensaje enviado: "${phrase}". Tu cuidadora ya fue informada.`);
      closeFn();
    };
  });

  speakText('No pudimos acceder a tu micrófono. Puedes tocar cualquiera de las frases en pantalla para enviarla a tu cuidador.');
}

export function bindPatientEvents(container) {
  // Enlace y vinculación de eventos interactivos para la vista del paciente adulto
}

export let patientTempVitals = null;

// Helper para normalizar RUT
export function getPatientCleanRut(patient) {
  const raw = (patient && (patient.fileNumber || patient.rut)) || '';
  const noDots = String(raw).replace(/[\.\s]/g, '').trim().toUpperCase();
  if (noDots.includes('-')) return noDots;
  if (noDots.length > 1) return `${noDots.slice(0, -1)}-${noDots.slice(-1)}`;
  return noDots;
}

// Helper para determinar si un paciente es uno de los usuarios demo del sistema
export function isDemoPatient(patient) {
  if (!patient) return false;
  if (patient.isCustom || patient.isRegistered) return false;
  const demoIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p_mateo', 'mateo', 'p_camila', 'camila', 'p_valentina', 'valentina', 'p_lucas', 'lucas', 'p_daniela', 'daniela'];
  const demoUsernames = ['juan', 'maria', 'carlos', 'ana', 'luis', 'elena', 'roberto', 'mateo', 'camila', 'valentina', 'lucas', 'daniela'];
  const cleanRut = getPatientCleanRut(patient);
  const demoRuts = [
    '10420932-K', '12194883-2', '9183224-8', '7654321-K', '15024118-5', '14567890-1',
    '11109845-6', '9876543-2', '13281402-K', '11234567-8', '8032554-1',
    '25340112-9', '24118902-5', '24110456-8', '18940322-4', '26110450-8', '19450812-3'
  ];
  if (patient.id && demoIds.includes(patient.id)) return true;
  if (patient.username && demoUsernames.includes(patient.username.toLowerCase())) return true;
  if (cleanRut && demoRuts.includes(cleanRut)) return true;
  return false;
}

// Inicializar ficha cuidapp_ficha_[RUT] vacía para pacientes registrados que no sean demo
export function initNonDemoPatientFicha(patient) {
  if (!patient || isDemoPatient(patient)) return null;
  const cleanRut = getPatientCleanRut(patient);
  if (!cleanRut) return null;
  const primaryKey = `cuidapp_ficha_${cleanRut}`;
  const rawRut = patient.fileNumber || patient.rut || cleanRut;

  let ficha = null;
  try {
    const raw = localStorage.getItem(primaryKey) || localStorage.getItem(`cuidapp_ficha_${rawRut}`);
    if (raw) ficha = JSON.parse(raw);
  } catch (e) {}

  if (!ficha) {
    const isUnderage = (typeof patient.age === 'number' && patient.age < 18) || !!patient.isPediatric;
    ficha = {
      rut: cleanRut,
      patientRut: rawRut,
      patientId: patient.id,
      patientName: patient.socialName || patient.name,
      age: patient.age,
      isPediatric: isUnderage,
      updatedAt: new Date().toISOString(),
      reports: [],
      dailyReports: [],
      documents: [],
      prescriptions: [],
      exams: [],
      appointments: [],
      vitals: [],
      history: [],
      timeline: []
    };
    try {
      const serialized = JSON.stringify(ficha);
      localStorage.setItem(primaryKey, serialized);
      if (rawRut && rawRut !== cleanRut) {
        localStorage.setItem(`cuidapp_ficha_${rawRut}`, serialized);
      }
    } catch (e) {}
  }
  return ficha;
}

// Obtener lista de citas y notificaciones del paciente
export function getPatientAppointmentsList(patient) {
  if (!patient) return [];
  const cleanRut = getPatientCleanRut(patient);
  try {
    const rawApp = localStorage.getItem(`cuidapp_appointments_${patient.rut}`) || localStorage.getItem(`cuidapp_appointments_${cleanRut}`);
    if (rawApp) {
      const parsed = JSON.parse(rawApp);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}

  try {
    const rawFicha = localStorage.getItem(`cuidapp_ficha_${cleanRut}`) || localStorage.getItem(`cuidapp_ficha_${patient.rut}`);
    if (rawFicha) {
      const ficha = JSON.parse(rawFicha);
      if (ficha && Array.isArray(ficha.appointments) && ficha.appointments.length > 0) {
        return ficha.appointments;
      }
    }
  } catch (e) {}

  // Citas demo solo para Juan Díaz / usuarios demo adultos
  if (isDemoPatient(patient) && (patient.id === 'p1' || patient.username === 'juan')) {
    return [
      {
        id: 'notif-1',
        type: 'call',
        title: '📞 Llamada recibida hoy 08:00 AM: Recordatorio de Losartán',
        badge: 'Llamada de Voz IVR',
        badgeClass: 'bg-primary',
        sender: 'Sistema CuidApp Automatizado • Teléfono: +56 9 8765 4321',
        content: '"Hola Juan, te recordamos que a las 08:00 AM te corresponde tomar Losartán de 50 miligramos. Por favor, confirma marcando 1 o registrándolo en tu pastillero."'
      },
      {
        id: 'notif-2',
        type: 'sms',
        title: '📱 SMS enviado ayer: Recordatorio de cita',
        badge: 'Mensaje de Texto SMS',
        badgeClass: 'bg-success',
        sender: 'Remitente: CESFAM Bellavista • Ayer 16:30 PM',
        content: '"Estimado Juan Díaz, le recordamos su control médico con la Dra. Marcela Soto el próximo lunes a las 10:30 hrs en el CESFAM Bellavista."'
      }
    ];
  }
  return [];
}

// Helper para clasificar categoría de documentos (recetas, examenes, informes)
export function getDocCategory(doc) {
  if (doc.category) return doc.category;
  const t = (doc.type || '').toLowerCase();
  const n = (doc.name || '').toLowerCase();
  if (t.includes('receta') || n.includes('receta')) return 'recetas';
  if (t.includes('informe') || n.includes('informe') || t.includes('epicrisis') || n.includes('epicrisis')) return 'informes';
  return 'examenes';
}

// Base de datos de Documentos Clínicos del Paciente (Exámenes, Recetas e Informes)
export function getAllPatientDocuments(patientId) {
  const targetId = patientId || (activePatient ? activePatient.id : 'p1');
  const targetPatient = (activePatient && activePatient.id === targetId)
    ? activePatient
    : (PATIENTS_DATABASE.find(p => p.id === targetId) || activePatient || { id: targetId });
  const rutClean = getPatientCleanRut(targetPatient);

  const medicalEvolutions = getPatientMedicalEvolutions(targetId);
  const evoDocs = medicalEvolutions.map(evo => ({
    id: evo.id,
    name: `Evolución Médica: ${evo.diagnosis ? evo.diagnosis.split('-')[0].trim() : 'Control'}`,
    type: 'Informe Médico',
    category: 'informes',
    icon: '🩺',
    date: evo.date,
    doctor: `${evo.doctorName || 'Dra. Elena Valdés'} (${evo.doctorRegistry || 'Reg. SIS N° 482910'})`,
    center: 'Portal Clínico cuidApp Telemedicina',
    status: 'Firmada e Inmutable',
    statusColor: 'success',
    badgeText: 'Firma Oficial DS N° 41',
    summary: evo.evolutionText,
    details: [
      { label: 'Diagnóstico', value: evo.diagnosis, ref: 'CIE-10' },
      { label: 'Médico Tratante', value: `${evo.doctorName} (${evo.doctorRegistry})`, ref: 'SIS' },
      { label: 'Nuevos Antecedentes', value: evo.antecedents || 'Ninguno consignado', ref: 'Ficha' },
      { label: 'Sello de Inmutabilidad', value: evo.inmutabilitySeal, ref: 'DS N° 41' },
      { label: 'Marco Legal', value: 'Ley 20.584 / Ley 21.541 Telemedicina', ref: 'Norma' }
    ],
    notes: `Atención médica registrada y firmada digitalmente con sello inmutable bajo Decreto Supremo N° 41 y Ley 20.584.`
  }));

  let customDocs = [];
  try {
    const raw = localStorage.getItem(`cuidapp_documents_${targetId}`);
    if (raw) customDocs = JSON.parse(raw);
  } catch (e) {
    customDocs = [];
  }

  // Sincronización con la ficha global del paciente (cuidapp_ficha_[RUT])
  try {
    const rawFicha = localStorage.getItem(`cuidapp_ficha_${rutClean}`) || localStorage.getItem(`cuidapp_ficha_${targetPatient.rut || ''}`);
    if (rawFicha) {
      const fichaObj = JSON.parse(rawFicha);
      if (fichaObj && Array.isArray(fichaObj.documents)) {
        fichaObj.documents.forEach(d => {
          if (!customDocs.some(cd => cd.id === d.id)) {
            customDocs.push(d);
          }
        });
      }
    }
  } catch (e) {}

  // Base demo documents ONLY for Juan (p1). New/other patients start completely isolated
  const isDemo = isDemoPatient(targetPatient);
  const baseDocs = (isDemo && (targetId === 'p1' || targetId === 'juan')) ? PATIENT_DOCUMENTS : [];
  return [...customDocs, ...evoDocs, ...baseDocs];
}

export function savePatientCustomDocument(patientId, newDoc) {
  const targetId = patientId || (activePatient ? activePatient.id : 'p1');
  let docs = [];
  try {
    const raw = localStorage.getItem(`cuidapp_documents_${targetId}`);
    if (raw) docs = JSON.parse(raw);
  } catch (e) {
    docs = [];
  }
  docs.unshift(newDoc);
  try {
    localStorage.setItem(`cuidapp_documents_${targetId}`, JSON.stringify(docs));
  } catch (e) {}
  if (targetId === 'p1') {
    PATIENT_DOCUMENTS.unshift(newDoc);
  }
}

export const PATIENT_DOCUMENTS = [
  {
    id: 'doc-1',
    name: 'Examen de Sangre',
    type: 'Laboratorio Clínico',
    category: 'examenes',
    icon: '🧪',
    date: '10 Nov 2026',
    doctor: 'Dr. Roberto Silva',
    center: 'Laboratorio Central San Lucas',
    status: 'Normal',
    statusColor: 'success',
    badgeText: 'Completado',
    summary: 'Hemograma completo y perfil bioquímico de control preventivo.',
    details: [
      { label: 'Hemoglobina', value: '14.2 g/dL', ref: '13.0 - 17.0 g/dL' },
      { label: 'Glucemia Basal', value: '95 mg/dL', ref: '70 - 100 mg/dL' },
      { label: 'Colesterol Total', value: '180 mg/dL', ref: '< 200 mg/dL' },
      { label: 'Triglicéridos', value: '140 mg/dL', ref: '< 150 mg/dL' },
      { label: 'Creatinina', value: '0.9 mg/dL', ref: '0.7 - 1.3 mg/dL' }
    ],
    notes: 'Valores dentro de los rangos normales. Se sugiere mantener ingesta adecuada de agua y dieta balanceada.'
  },
  {
    id: 'doc-2',
    name: 'Receta Losartán',
    type: 'Receta Médica',
    category: 'recetas',
    icon: '💊',
    date: '08 Nov 2026',
    doctor: 'Dra. Marcela Soto',
    center: 'CESFAM Bellavista',
    status: 'Vigente',
    statusColor: 'primary',
    badgeText: 'Activa',
    summary: 'Tratamiento antihipertensivo oral para control de presión arterial.',
    details: [
      { label: 'Medicamento', value: 'Losartán Potásico 50mg', ref: 'Comprimidos' },
      { label: 'Posología', value: '1 comprimido cada 12 horas', ref: 'Vía oral' },
      { label: 'Duración', value: '30 días (Renovable)', ref: 'Crónico' },
      { label: 'Diagnóstico', value: 'Hipertensión Arterial Primaria', ref: 'CIE-10: I10' }
    ],
    notes: 'Tomar con abundante agua preferentemente junto al desayuno y la cena. Evitar saltarse tomas.'
  },
  {
    id: 'doc-3',
    name: 'Perfil Lipídico',
    type: 'Examen de Laboratorio',
    category: 'examenes',
    icon: '🧪',
    date: '25 Oct 2026',
    doctor: 'Dr. Roberto Silva',
    center: 'Laboratorio San Lucas',
    status: 'Control OK',
    statusColor: 'info',
    badgeText: 'Normal',
    summary: 'Análisis detallado de fracciones lipídicas y riesgo aterogénico.',
    details: [
      { label: 'Colesterol HDL', value: '48 mg/dL', ref: '> 40 mg/dL' },
      { label: 'Colesterol LDL', value: '110 mg/dL', ref: '< 130 mg/dL' },
      { label: 'Colesterol VLDL', value: '22 mg/dL', ref: '2 - 30 mg/dL' },
      { label: 'Lípidos Totales', value: '520 mg/dL', ref: '400 - 800 mg/dL' }
    ],
    notes: 'Fracción protectora HDL en nivel óptimo. Continuar actividad física moderada recomendada.'
  },
  {
    id: 'doc-4',
    name: 'Radiografía Tórax',
    type: 'Imagenología',
    category: 'examenes',
    icon: '📁',
    date: '14 Oct 2026',
    doctor: 'Dr. Andrés Valenzuela',
    center: 'Centro Radiológico Metropolitano',
    status: 'Revisado',
    statusColor: 'success',
    badgeText: 'Sin hallazgos',
    summary: 'Estudio radiográfico torácico anteroposterior y lateral.',
    details: [
      { label: 'Proyección', value: 'AP y Lateral', ref: 'Tórax óseo y blando' },
      { label: 'Parénquima', value: 'Sin focos de consolidación', ref: 'Normal' },
      { label: 'Silueta Cardíaca', value: 'Índice cardiotorácico 0.48', ref: '< 0.50' },
      { label: 'Costodiafragmáticos', value: 'Ángulos libres', ref: 'Normal' }
    ],
    notes: 'Estructuras óseas y partes blandas torácicas sin alteraciones patológicas agudas.'
  },
  {
    id: 'doc-5',
    name: 'Informe Cardiológico',
    type: 'Informe Médico',
    category: 'informes',
    icon: '📋',
    date: '02 Nov 2026',
    doctor: 'Dr. Fernando Morales',
    center: 'Clínica CardioSalud',
    status: 'Finalizado',
    statusColor: 'info',
    badgeText: 'Control Anual',
    summary: 'Evaluación cardiológica integral y recomendaciones de seguimiento.',
    details: [
      { label: 'Diagnóstico', value: 'Hipertensión arterial primaria controlada', ref: 'Evolución favorable' },
      { label: 'Ecocardiograma', value: 'Fracción de eyección 62%', ref: 'Normal (> 55%)' },
      { label: 'Plan Terapéutico', value: 'Mantener tratamiento antihipertensivo', ref: 'Control en 6 meses' }
    ],
    notes: 'Paciente con buena tolerancia a fármacos y parámetros hemodinámicos estables.'
  }
];


// ============================================================================
// PROTOCOLO PRENATAL & CHILE CRECE CONTIGO (FRUTAS POR SEMANA & LACTANCIA)
// ============================================================================
export const PREGNANCY_WEEKS_DATA = {
  4: { fruta: 'Semilla de Amapola', emoji: '🌱', largo: '0.1 cm', peso: '< 1 g', hito: 'Implantación del blastocisto en el endometrio e inicio del desarrollo del saco gestacional y tubo neural.', consejo: 'Inicia suplementación diaria con Ácido Fólico (1 mg/día) para prevenir anomalías del tubo neural.' },
  8: { fruta: 'Frambuesa', emoji: '🫐', largo: '1.6 cm', peso: '1 g', hito: 'Comienzan a formarse párpados, dedos y latido cardíaco detectable por ecografía Doppler (150-160 BPM).', consejo: 'Agenda tu primer control prenatal con matrona o gineco-obstetra en tu CESFAM o clínica.' },
  12: { fruta: 'Limón', emoji: '🍋', largo: '5.4 cm', peso: '14 g', hito: 'Todos los órganos vitales ya están formados. Reflejos de succión e inicio de deglución de líquido amniótico.', consejo: 'Momento de realizar la Ecografía 11-14 semanas (Translucencia Nucal y tamizaje genético).' },
  16: { fruta: 'Palta', emoji: '🥑', largo: '11.6 cm', peso: '100 g', hito: 'Los ojos ya perciben la luz a través de los párpados. Extremidades más coordinadas y primeros aleteos fetales.', consejo: 'Inicia Sulfato Ferroso y Calcio según las directrices nutricionales de Chile Crece Contigo.' },
  20: { fruta: 'Plátano', emoji: '🍌', largo: '25.6 cm', peso: '300 g', hito: 'Mitad de la gestación. Piel cubierta de vérmix caseoso y lanugo. Se perciben claramente las pataditas.', consejo: 'Ecografía Anatómica / Morfológica 20-24 semanas para revisión detallada de órganos fetales.' },
  24: { fruta: 'Choclo', emoji: '🌽', largo: '30.0 cm', peso: '600 g', hito: 'Oídos completamente desarrollados. El bebé reconoce y se calma con la voz materna y la música suave.', consejo: 'Realiza el test de tolerancia a la glucosa oral (PTGO) para pesquisa de diabetes gestacional.' },
  28: { fruta: 'Berenjena', emoji: '🍆', largo: '37.6 cm', peso: '1.0 kg', hito: 'Abre y cierra los ojos, con pestañas desarrolladas. Ciclos regulares de sueño y vigilia fetal.', consejo: 'Monitorea los movimientos fetales después de almuerzo y cena (al menos 6-10 movimientos en 2 hrs).' },
  32: { fruta: 'Piña', emoji: '🍍', largo: '42.4 cm', peso: '1.7 kg', hito: 'Pulmones casi maduros con síntesis de surfactante. Practica movimientos respiratorios rítmicos.', consejo: 'Ecografía de Crecimiento 32-34 semanas y participación en el taller prenatal del CESFAM.' },
  36: { fruta: 'Melón', emoji: '🍈', largo: '47.4 cm', peso: '2.6 kg', hito: 'Encajamiento en el canal del parto. Mayor tono muscular y depósito graso para regulación térmica.', consejo: 'Prepara el bolso de maternidad, carnet prenatal y revisa tu plan de parto respetado.' },
  40: { fruta: 'Sandía', emoji: '🍉', largo: '51.2 cm', peso: '3.4 kg', hito: 'Bebé a término completamente listo para nacer, respirar aire ambiente y alimentarse al pecho materno.', consejo: 'Acude a urgencia si tienes contracciones rítmicas cada 5 minutos, sangrado o pérdida de líquido.' }
};

export function getGestationalFruitData(week) {
  const w = Math.max(4, Math.min(41, parseInt(week, 10) || 24));
  if (w <= 9) {
    return { week: w, emoji: '🫐', fruit: 'Frambuesa', length: '1.6 cm', weight: '1 g', trimester: '1° Trimestre' };
  } else if (w <= 13) {
    return { week: w, emoji: '🍋', fruit: 'Limón', length: '5.4 cm', weight: '14 g', trimester: '1° Trimestre' };
  } else if (w <= 17) {
    return { week: w, emoji: '🥑', fruit: 'Palta', length: '11.6 cm', weight: '100 g', trimester: '2° Trimestre' };
  } else if (w <= 21) {
    return { week: w, emoji: '🍌', fruit: 'Plátano', length: '25.6 cm', weight: '300 g', trimester: '2° Trimestre' };
  } else if (w <= 25) {
    return { week: w, emoji: '🌽', fruit: 'Choclo', length: '30.0 cm', weight: '600 g', trimester: '2° Trimestre' };
  } else if (w <= 29) {
    return { week: w, emoji: '🍆', fruit: 'Berenjena', length: '37.6 cm', weight: '1.0 kg', trimester: '3° Trimestre' };
  } else if (w <= 33) {
    return { week: w, emoji: '🍍', fruit: 'Piña', length: '42.4 cm', weight: '1.7 kg', trimester: '3° Trimestre' };
  } else if (w <= 37) {
    return { week: w, emoji: '🍈', fruit: 'Melón', length: '47.4 cm', weight: '2.6 kg', trimester: '3° Trimestre' };
  } else {
    return { week: w, emoji: '🍉', fruit: 'Sandía', length: '51.2 cm', weight: '3.4 kg', trimester: '3° Trimestre' };
  }
}

export function getDynamicPatientAge(patient) {
  if (!patient) return 0;
  if (typeof patient.age === 'number') return patient.age;
  const bDateStr = patient.birthDate || patient.dob || patient.fechaNacimiento;
  if (bDateStr) {
    const bDate = new Date(bDateStr);
    if (!isNaN(bDate.getTime())) {
      const today = new Date();
      let age = today.getFullYear() - bDate.getFullYear();
      const m = today.getMonth() - bDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < bDate.getDate())) age--;
      return age;
    }
  }
  return 0;
}

export function isPatientPregnantDynamic(patient) {
  let p = patient;
  if (!p) {
    if (typeof getActivePatient === 'function') {
      try { p = getActivePatient(); } catch (e) {}
    }
    if (!p && typeof activePatient !== 'undefined' && activePatient) {
      p = activePatient;
    }
  }

  // Fallback si no está el objeto en memoria: buscar por selector de paciente o usuario de sesión
  if (!p && typeof document !== 'undefined') {
    const sel = document.getElementById('patientSelector');
    if (sel && sel.value && typeof PATIENTS_DATABASE !== 'undefined') {
      p = PATIENTS_DATABASE.find(item => item.id === sel.value) || null;
    }
    if (!p) {
      const userEl = document.querySelector('.sidebar footer strong, footer strong.text-white, #caregiverGreetingPatientName');
      const uName = userEl ? userEl.textContent.trim().toLowerCase() : '';
      if (uName.includes('daniela')) {
        p = (typeof PATIENTS_DATABASE !== 'undefined' && PATIENTS_DATABASE.find(item => item.id === 'p_daniela')) || { id: 'p_daniela', name: 'Daniela Morales', isPregnant: true, pregnancyWeeks: 24, rut: '19.450.812-3' };
      }
    }
  }
  if (!p && typeof localStorage !== 'undefined') {
    const storedUser = localStorage.getItem('cuidapp_auth_user') || localStorage.getItem('cuidapp_last_user');
    if (storedUser && typeof PATIENTS_DATABASE !== 'undefined') {
      p = PATIENTS_DATABASE.find(item => item.id === storedUser || item.username === storedUser) || null;
    }
  }

  if (!p) return false;

  // Si está explícitamente en postparto
  if (p.isPostpartum === true || p.postpartum === true) return false;
  if (typeof localStorage !== 'undefined' && (
    (p.id && localStorage.getItem(`cuidapp_postpartum_${p.id}`) === 'true') ||
    (p.rut && localStorage.getItem(`cuidapp_postpartum_${p.rut}`) === 'true')
  )) {
    return false;
  }

  // 1. Por RUT / ID / Nombre (Daniela Morales / 19.450.812-3 / p_daniela)
  const pId = String(p.id || '').toLowerCase();
  const pUsername = String(p.username || '').toLowerCase();
  const pName = String(p.name || p.socialName || '').toLowerCase();
  const pRut = String(p.rut || p.fileNumber || p.documentNumber || '');

  if (
    pId === 'p_daniela' ||
    pUsername === 'daniela' ||
    pName.includes('daniela morales') ||
    pName.includes('daniela') ||
    pRut.includes('19.450.812-3') ||
    pRut.replace(/[^0-9kK]/g, '') === '194508123'
  ) {
    return true;
  }

  // 2. Por propiedad directa: paciente.isPregnant, paciente.gestante, paciente.embarazo
  if (
    p.isPregnant === true ||
    p.pregnant === true ||
    p.embarazo === true ||
    p.gestante === true
  ) {
    return true;
  }

  // 3. Por semanas registradas
  if (
    (typeof p.pregnancyWeeks === 'number' && p.pregnancyWeeks > 0) ||
    (typeof p.gestationalWeeks === 'number' && p.gestationalWeeks > 0) ||
    (typeof p.semanasGestacion === 'number' && p.semanasGestacion > 0)
  ) {
    return true;
  }

  // 4. Por texto en su condición / etiqueta / diagnóstico:
  // String(paciente.condicion || paciente.condition || '').toLowerCase().includes('gestant') || ...includes('embaraz')
  const condText = String(p.condicion || p.condition || p.etiqueta || p.tag || '').toLowerCase();
  if (condText.includes('gestant') || condText.includes('embaraz') || condText.includes('gestac')) return true;

  if (Array.isArray(p.conditions) && p.conditions.some(c => {
    const s = String(c).toLowerCase();
    return s.includes('embaraz') || s.includes('gestan') || s.includes('gestac');
  })) return true;

  const raw = `${p.diagnosticos || ''} ${p.notes || ''} ${p.alergias || ''} ${p.diagnostico || ''}`.toLowerCase();
  if (raw.includes('embaraz') || raw.includes('gestan') || raw.includes('gestac')) return true;

  // 5. Incluso si el usuario viene cargado desde localStorage
  if (typeof localStorage !== 'undefined') {
    if (p.id && localStorage.getItem(`cuidapp_pregnancy_${p.id}`)) return true;
    if (p.rut && localStorage.getItem(`cuidapp_pregnancy_${p.rut}`)) return true;
    if (localStorage.getItem('cuidapp_pregnancy_p_daniela') && (pId === 'p_daniela' || pUsername === 'daniela' || pRut.includes('19.450.812-3'))) return true;
    try {
      const reg = localStorage.getItem('cuidapp_registered_patients');
      if (reg) {
        const parsed = JSON.parse(reg);
        const match = Array.isArray(parsed) && parsed.find(item => item.id === p.id || (item.rut && item.rut === p.rut));
        if (match && (
          match.isPregnant ||
          match.gestante ||
          match.embarazo ||
          String(match.condicion || match.condition || '').toLowerCase().includes('gestant') ||
          String(match.condicion || match.condition || '').toLowerCase().includes('embaraz')
        )) {
          return true;
        }
      }
    } catch (e) {}
  }

  return false;
}

export const esGestante = isPatientPregnantDynamic;

export function getPregnancyWeekData(week) {
  const weeks = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40];
  const closest = weeks.reduce((prev, curr) => Math.abs(curr - week) < Math.abs(prev - week) ? curr : prev);
  return { ...PREGNANCY_WEEKS_DATA[closest], weekNumber: week };
}

export function renderPregnantDashboard(container, patient) {
  if (!container || !patient) return;
  const currentWeek = patient.pregnancyWeek || 24;
  const weekData = getPregnancyWeekData(currentWeek);

  // Contador de pataditas persistente por fecha
  const kickKey = `cuidapp_fetal_kicks_${patient.id}_${new Date().toISOString().slice(0, 10)}`;
  let kickCount = parseInt(localStorage.getItem(kickKey) || '0', 10);

  container.innerHTML = `
    <div class="container-fluid px-3 px-md-4 py-4 text-white" style="font-family: 'Outfit', sans-serif;">
      <!-- CABECERA MATERNAL WARM GLASSKIT -->
      <div class="glass-card p-4 mb-4 text-white d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3" style="background: linear-gradient(135deg, rgba(244, 63, 94, 0.16) 0%, rgba(192, 132, 252, 0.14) 50%, rgba(245, 158, 11, 0.12) 100%); border: 2px solid rgba(244, 63, 94, 0.4); border-radius: 26px; box-shadow: 0 15px 35px rgba(244, 63, 94, 0.15);">
        <div>
          <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
            <span class="badge px-3 py-1.5 rounded-pill fw-bold" style="background: rgba(244, 63, 94, 0.25); color: #fda4af; border: 1.5px solid #f43f5e; font-size: 0.9rem;">
              🤰 Embarazo Activo &bull; Semana ${currentWeek}
            </span>
            <span class="badge px-3 py-1.5 rounded-pill fw-semibold" style="background: rgba(192, 132, 252, 0.25); color: #e9d5ff; border: 1.5px solid #c084fc; font-size: 0.9rem;">
              Chile Crece Contigo &bull; Ley N° 20.584
            </span>
          </div>
          <h1 class="fw-extrabold m-0 text-white" style="font-size: 2.2rem;">¡Hola, ${patient.socialName || patient.name}! 💕</h1>
          <p class="text-white-50 m-0 mt-1" style="font-size: 1.05rem;">Seguimiento prenatal integral, desarrollo del bebé y bienestar materno.</p>
        </div>
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <button type="button" id="btnMaternalShowCard" class="btn px-3.5 py-2.5 rounded-pill fw-bold text-white shadow-sm d-inline-flex align-items-center gap-2" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: 1.5px solid #6ee7b7; font-size: 0.95rem; cursor: pointer;">
            <span>🏥</span> <span>Mostrar mi Ficha</span>
          </button>
          <button type="button" id="btnMaternalDental" class="btn px-3.5 py-2.5 rounded-pill fw-bold text-white shadow-sm d-inline-flex align-items-center gap-2" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border: 1.5px solid #38bdf8; font-size: 0.95rem; cursor: pointer;">
            <span>🦷</span> <span>Salud Oral GES</span>
          </button>
          <button type="button" id="btnMaternalSamu" class="btn btn-danger px-3.5 py-2.5 rounded-pill fw-bold text-white shadow-sm d-inline-flex align-items-center gap-2" style="cursor: pointer;">
            <span>🚨</span> <span>SAMU 131</span>
          </button>
        </div>
      </div>

      <!-- 1. 🍓 VISUALIZADOR INTERACTIVO DEL TAMAÑO DEL BEBÉ (FRUTAS POR SEMANA) -->
      <div class="glass-card p-4 p-md-5 mb-4 text-white" style="border-radius: 28px; background: rgba(15, 23, 42, 0.92); border: 2px solid rgba(244, 63, 94, 0.35); box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4 border-bottom border-light border-opacity-10 pb-3">
          <div class="d-flex align-items-center gap-3">
            <span style="font-size: 3.2rem; line-height: 1;">🍓</span>
            <div>
              <h2 class="fw-extrabold m-0 text-white" style="font-size: 1.9rem;">Visualizador del Bebé: Frutas por Semana</h2>
              <span class="text-white-50" style="font-size: 1.05rem;">Desliza el selector para ver el crecimiento comparativo semana a semana</span>
            </div>
          </div>
          <span class="badge px-3 py-2 rounded-pill fw-bold" style="background: rgba(244, 63, 94, 0.2); color: #fda4af; border: 1px solid rgba(244, 63, 94, 0.4); font-size: 1.05rem;">
            Semana seleccionada: <strong id="lblCurrentWeekNum">${currentWeek}</strong> de 40
          </span>
        </div>

        <!-- Slider interactivo de la semana 4 a la 40 -->
        <div class="mb-4 px-2">
          <input type="range" class="form-range" id="maternalWeekSlider" min="4" max="40" step="1" value="${currentWeek}" style="accent-color: #f43f5e; height: 10px; cursor: pointer;">
          <div class="d-flex justify-content-between text-white-50 small fw-bold px-1 mt-1">
            <span>Sem 4 (Semilla)</span>
            <span>Sem 12 (Ciruela)</span>
            <span>Sem 20 (Plátano)</span>
            <span>Sem 28 (Berenjena)</span>
            <span>Sem 36 (Melón)</span>
            <span>Sem 40 (Sandía)</span>
          </div>
        </div>

        <!-- Tarjeta dinámica de la Fruta -->
        <div id="maternalFruitDisplay" class="p-4 rounded-4" style="background: linear-gradient(135deg, rgba(244, 63, 94, 0.1) 0%, rgba(192, 132, 252, 0.08) 100%); border: 1.5px solid rgba(244, 63, 94, 0.25);">
          <div class="row align-items-center g-4">
            <div class="col-12 col-md-3 text-center">
              <div style="font-size: 6rem; line-height: 1; filter: drop-shadow(0 8px 16px rgba(244, 63, 94, 0.4));" id="fruitEmoji" class="mb-2">
                ${weekData.emoji}
              </div>
              <h4 class="fw-extrabold text-white m-0" id="fruitName">${weekData.fruta}</h4>
              <small class="text-white-50">Tamaño comparativo</small>
            </div>
            <div class="col-12 col-md-9">
              <div class="row g-3 mb-3">
                <div class="col-6 col-sm-3">
                  <div class="p-3 rounded-3 text-center" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);">
                    <small class="text-white-50 d-block">Longitud</small>
                    <strong class="fs-5 text-warning" id="fruitLength">${weekData.largo}</strong>
                  </div>
                </div>
                <div class="col-6 col-sm-3">
                  <div class="p-3 rounded-3 text-center" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);">
                    <small class="text-white-50 d-block">Peso Estimado</small>
                    <strong class="fs-5 text-info" id="fruitWeight">${weekData.peso}</strong>
                  </div>
                </div>
                <div class="col-12 col-sm-6">
                  <div class="p-3 rounded-3" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);">
                    <small class="text-white-50 d-block">Estado Gestacional</small>
                    <strong class="text-white" id="fruitTrimester">${currentWeek <= 13 ? 'Primer Trimestre (Formación embrionaria)' : currentWeek <= 27 ? 'Segundo Trimestre (Crecimiento & Sentidos)' : 'Tercer Trimestre (Maduración & A término)'}</strong>
                  </div>
                </div>
              </div>
              <div class="p-3.5 rounded-3 mb-2" style="background: rgba(255,255,255,0.04); border-left: 4px solid #f43f5e;">
                <h6 class="fw-bold text-white mb-1">👶 Hito del Desarrollo Fetal:</h6>
                <p class="m-0 text-white-50" id="fruitMilestone">${weekData.hito}</p>
              </div>
              <div class="p-3.5 rounded-3" style="background: rgba(255,255,255,0.04); border-left: 4px solid #c084fc;">
                <h6 class="fw-bold text-white mb-1">💡 Consejo Clínico para la Mamá:</h6>
                <p class="m-0 text-white-50" id="fruitTip">${weekData.consejo}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. CONTROLES PRENATALES MINSAL & CHILE CRECE CONTIGO -->
      <div class="row g-4 mb-4">
        <!-- Cronograma de Ecografías -->
        <div class="col-12 col-lg-7">
          <div class="glass-card p-4 h-100 text-white" style="border-radius: 24px; background: rgba(15, 23, 42, 0.92); border: 1.5px solid rgba(192, 132, 252, 0.35);">
            <div class="d-flex align-items-center gap-2 mb-3">
              <span style="font-size: 2rem;">🩻</span>
              <h4 class="fw-bold m-0" style="font-family: 'Outfit';">Cronograma de Ecografías Oficiales (MINSAL)</h4>
            </div>
            <div class="d-flex flex-column gap-3">
              <!-- Eco 1 -->
              <div class="p-3.5 rounded-4 d-flex justify-content-between align-items-center gap-3" style="background: rgba(16, 185, 129, 0.08); border: 1.5px solid rgba(16, 185, 129, 0.35);">
                <div>
                  <h6 class="fw-bold text-white m-0">11 a 14 Semanas &bull; Ecografía Translucencia Nucal</h6>
                  <small class="text-white-50">Tamizaje precoz de aneuploidías y cálculo preciso de edad gestacional.</small>
                </div>
                <span class="badge bg-success bg-opacity-25 text-success border border-success rounded-pill px-3 py-1.5 fw-bold text-nowrap">
                  ✅ Realizada
                </span>
              </div>
              <!-- Eco 2 -->
              <div class="p-3.5 rounded-4 d-flex justify-content-between align-items-center gap-3" style="background: rgba(14, 165, 233, 0.08); border: 1.5px solid rgba(14, 165, 233, 0.35);">
                <div>
                  <h6 class="fw-bold text-white m-0">20 a 24 Semanas &bull; Ecografía Morfológica / Anatómica</h6>
                  <small class="text-white-50">Evaluación exhaustiva de anatomía fetal, corazón y placenta (Chile Crece Contigo).</small>
                </div>
                <span class="badge bg-info bg-opacity-25 text-info border border-info rounded-pill px-3 py-1.5 fw-bold text-nowrap">
                  ✅ Vigente
                </span>
              </div>
              <!-- Eco 3 -->
              <div class="p-3.5 rounded-4 d-flex justify-content-between align-items-center gap-3" style="background: rgba(245, 158, 11, 0.08); border: 1.5px solid rgba(245, 158, 11, 0.35);">
                <div>
                  <h6 class="fw-bold text-white m-0">32 a 34 Semanas &bull; Ecografía Doppler de Crecimiento</h6>
                  <small class="text-white-50">Estimación de peso fetal, líquido amniótico y bienestar circulatorio.</small>
                </div>
                <span class="badge bg-warning bg-opacity-25 text-warning border border-warning rounded-pill px-3 py-1.5 fw-bold text-nowrap">
                  ⏳ Programada
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Suplementos y Contador de Pataditas -->
        <div class="col-12 col-lg-5">
          <div class="glass-card p-4 h-100 text-white d-flex flex-column justify-content-between" style="border-radius: 24px; background: rgba(15, 23, 42, 0.92); border: 1.5px solid rgba(245, 158, 11, 0.35);">
            <div>
              <div class="d-flex align-items-center gap-2 mb-3">
                <span style="font-size: 2rem;">👣</span>
                <h4 class="fw-bold m-0" style="font-family: 'Outfit';">Contador de Movimientos Fetales</h4>
              </div>
              <p class="text-white-50 small mb-3">Cuenta las pataditas del bebé tras las comidas. La norma MINSAL sugiere registrar al menos 6 a 10 movimientos en 2 horas.</p>
              
              <div class="p-4 rounded-4 text-center mb-3" style="background: rgba(0,0,0,0.35); border: 1.5px solid rgba(245, 158, 11, 0.3);">
                <div class="text-white-50 small text-uppercase fw-bold mb-1">Movimientos Registrados Hoy</div>
                <div class="fw-extrabold text-warning m-0" id="lblKickCount" style="font-size: 3.5rem; line-height: 1;">${kickCount}</div>
                <small class="text-white-50 d-block mt-1">Objetivo: &ge; 10 pataditas</small>
              </div>

              <div class="d-flex gap-2">
                <button type="button" id="btnRegisterKick" class="btn btn-warning w-100 py-3 rounded-pill fw-bold text-dark shadow-sm d-flex align-items-center justify-content-center gap-2" style="font-size: 1.15rem; cursor: pointer;">
                  <span>👣</span> <span>¡Sentí una patadita!</span>
                </button>
                <button type="button" id="btnResetKicks" class="btn btn-glass-secondary px-3 py-3 rounded-pill text-white" title="Reiniciar contador de hoy">
                  <i class="bi bi-arrow-counterclockwise"></i>
                </button>
              </div>
            </div>

            <!-- Suplementos rápidos -->
            <div class="mt-4 pt-3 border-top border-light border-opacity-10">
              <small class="text-white-50 fw-bold d-block mb-2">Suplementación Prenatal MINSAL:</small>
              <div class="d-flex flex-wrap gap-1.5">
                <span class="badge bg-success bg-opacity-25 text-white border border-success rounded-pill px-2.5 py-1">💊 Ácido Fólico 1mg</span>
                <span class="badge bg-success bg-opacity-25 text-white border border-success rounded-pill px-2.5 py-1">💊 Sulfato Ferroso 200mg</span>
                <span class="badge bg-success bg-opacity-25 text-white border border-success rounded-pill px-2.5 py-1">💊 Calcio 1200mg</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. 🤱 GUÍA INTERACTIVA DE LACTANCIA & POSPARTO (CHILE CRECE CONTIGO) -->
      <div class="glass-card p-4 p-md-5 mb-4 text-white" style="border-radius: 28px; background: rgba(15, 23, 42, 0.94); border: 2px solid rgba(192, 132, 252, 0.35);">
        <div class="d-flex align-items-center gap-3 mb-4 border-bottom border-light border-opacity-10 pb-3">
          <span style="font-size: 3.2rem; line-height: 1;">🤱</span>
          <div>
            <h2 class="fw-extrabold m-0 text-white" style="font-size: 1.9rem;">Guía de Lactancia Materna & Cuidados del Posparto</h2>
            <span class="text-white-50" style="font-size: 1.05rem;">Recomendaciones basadas en evidencia para un amamantamiento exitoso y seguro</span>
          </div>
        </div>

        <div class="row g-4">
          <!-- Col 1: Acople Correcto -->
          <div class="col-12 col-md-4">
            <div class="p-4 rounded-4 h-100" style="background: rgba(244, 63, 94, 0.08); border: 1.5px solid rgba(244, 63, 94, 0.3);">
              <div class="d-flex align-items-center gap-2 mb-2">
                <span style="font-size: 2rem;">🍼</span>
                <h5 class="fw-bold text-white m-0">Técnica de Acople Correcto</h5>
              </div>
              <ul class="text-white-50 small ps-3 mb-0" style="line-height: 1.8;">
                <li><strong class="text-white">Boca bien abierta:</strong> El bebé debe abarcar gran parte de la areola inferior, no solo el pezón.</li>
                <li><strong class="text-white">Labios evertidos:</strong> Ambos labios volteados hacia afuera ("boca de pez").</li>
                <li><strong class="text-white">Mentón pegado:</strong> El mentón del bebé descansa en el pecho materno, permitiendo respirar por la nariz.</li>
                <li><strong class="text-white">Sin dolor:</strong> La lactancia no debe doler. Si arde o lastima, corrige el acople rompiendo el vacío con el meñique.</li>
              </ul>
            </div>
          </div>

          <!-- Col 2: Banco de Leche MINSAL -->
          <div class="col-12 col-md-4">
            <div class="p-4 rounded-4 h-100" style="background: rgba(14, 165, 233, 0.08); border: 1.5px solid rgba(14, 165, 233, 0.3);">
              <div class="d-flex align-items-center gap-2 mb-2">
                <span style="font-size: 2rem;">❄️</span>
                <h5 class="fw-bold text-white m-0">Banco de Leche en Casa (MINSAL)</h5>
              </div>
              <ul class="text-white-50 small ps-3 mb-0" style="line-height: 1.8;">
                <li><strong class="text-white">Temperatura ambiente (16°C a 26°C):</strong> 4 a 6 horas en lugar fresco.</li>
                <li><strong class="text-white">Refrigerador (al fondo, no en la puerta):</strong> hasta 72 horas.</li>
                <li><strong class="text-white">Congelador con puerta separada (-18°C):</strong> 3 a 6 meses.</li>
                <li><strong class="text-white">Descongelado seguro:</strong> A baño maría apagado o en el refrigerador. <span class="text-danger fw-bold">¡NUNCA microondas ni fuego directo!</span></li>
              </ul>
            </div>
          </div>

          <!-- Col 3: Señales de Alerta Materna -->
          <div class="col-12 col-md-4">
            <div class="p-4 rounded-4 h-100" style="background: rgba(239, 68, 68, 0.08); border: 1.5px solid rgba(239, 68, 68, 0.3);">
              <div class="d-flex align-items-center gap-2 mb-2">
                <span style="font-size: 2rem;">🚨</span>
                <h5 class="fw-bold text-white m-0">Señales de Alerta Materna</h5>
              </div>
              <ul class="text-white-50 small ps-3 mb-0" style="line-height: 1.8;">
                <li><strong class="text-danger">Fiebre &ge; 38°C:</strong> Posible infección o mastitis puerperal.</li>
                <li><strong class="text-danger">Sangrado excesivo:</strong> Manchar más de 2 toallas higiénicas por hora o coágulos grandes.</li>
                <li><strong class="text-danger">Cefalea intensa o luces:</strong> Presión alta / sospecha de preeclampsia.</li>
                <li><strong class="text-danger">Dolor en pantorrilla o dificultad para respirar:</strong> Sospecha de trombosis.</li>
                <li><strong class="text-warning">Tristeza persistente / llanto frecuente:</strong> Solicitar apoyo por depresión posparto.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL DE REGISTRAR NACIMIENTO (TRANSICIÓN AUTOMÁTICA AL PARTO) -->
    <div id="modalRegistrarNacimiento" class="modal fade" tabindex="-1" style="display: none; background: rgba(10, 15, 29, 0.88); backdrop-filter: blur(14px);" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content text-white" style="background: rgba(15, 23, 42, 0.96); border-radius: 28px; border: 2px solid #f59e0b; box-shadow: 0 25px 60px rgba(0,0,0,0.85); overflow: hidden; font-family: 'Outfit', sans-serif;">
          <div class="modal-header border-bottom p-4 d-flex justify-content-between align-items-center" style="background: rgba(245, 158, 11, 0.15); border-color: rgba(255, 255, 255, 0.1) !important;">
            <div class="d-flex align-items-center gap-2">
              <span style="font-size: 2.2rem;">👶</span>
              <div>
                <h4 class="modal-title fw-extrabold m-0 text-white">Registrar Nacimiento &bull; Transición al Parto</h4>
                <small class="text-warning fw-semibold">Genera automáticamente la Ficha Pediátrica Oficial (Ley N° 21.430 / Chile Crece Contigo)</small>
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" id="btnCloseNewbornModalX" aria-label="Close" style="cursor: pointer;"></button>
          </div>
          <form id="formRegistrarNacimiento">
            <div class="modal-body p-4">
              <p class="text-white-50 small mb-4">Completa los antecedentes del recién nacido para dar de alta su carnet infantil y vincularlo inmediatamente a la ficha de la madre.</p>
              
              <div class="row g-3 mb-3">
                <div class="col-12 col-md-7">
                  <label class="form-label small text-white-50 fw-bold">Nombre Completo del Bebé *</label>
                  <input type="text" id="nbName" class="form-control bg-dark text-white border-light border-opacity-25 py-2.5 rounded-3" placeholder="Ej. Gabriel Ignacio Morales" required>
                </div>
                <div class="col-12 col-md-5">
                  <label class="form-label small text-white-50 fw-bold">Nombre Social / Pronombres</label>
                  <input type="text" id="nbSocialName" class="form-control bg-dark text-white border-light border-opacity-25 py-2.5 rounded-3" placeholder="Ej. Gabriel (Él)">
                </div>
              </div>

              <div class="row g-3 mb-3">
                <div class="col-12 col-md-6">
                  <label class="form-label small text-white-50 fw-bold">RUT o N° Provisorio *</label>
                  <input type="text" id="nbRut" class="form-control bg-dark text-white border-light border-opacity-25 py-2.5 rounded-3" placeholder="Ej. 29.812.345-K" required>
                </div>
                <div class="col-12 col-md-6">
                  <label class="form-label small text-white-50 fw-bold">Sexo Biológico *</label>
                  <select id="nbGender" class="form-select bg-dark text-white border-light border-opacity-25 py-2.5 rounded-3" required>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Intersexual">Intersexual</option>
                  </select>
                </div>
              </div>

              <div class="row g-3 mb-3">
                <div class="col-6 col-md-3">
                  <label class="form-label small text-white-50 fw-bold">Fecha Nacimiento *</label>
                  <input type="date" id="nbBirthDate" class="form-control bg-dark text-white border-light border-opacity-25 py-2.5 rounded-3" value="${new Date().toISOString().slice(0, 10)}" required>
                </div>
                <div class="col-6 col-md-3">
                  <label class="form-label small text-white-50 fw-bold">Hora *</label>
                  <input type="time" id="nbBirthTime" class="form-control bg-dark text-white border-light border-opacity-25 py-2.5 rounded-3" value="08:30" required>
                </div>
                <div class="col-6 col-md-3">
                  <label class="form-label small text-white-50 fw-bold">Peso al Nacer (gramos) *</label>
                  <input type="number" id="nbWeight" class="form-control bg-dark text-white border-light border-opacity-25 py-2.5 rounded-3" placeholder="Ej. 3400" min="500" max="6500" required>
                </div>
                <div class="col-6 col-md-3">
                  <label class="form-label small text-white-50 fw-bold">Talla (cm) *</label>
                  <input type="number" step="0.5" id="nbHeight" class="form-control bg-dark text-white border-light border-opacity-25 py-2.5 rounded-3" placeholder="Ej. 50" min="25" max="65" required>
                </div>
              </div>

              <div class="p-3 rounded-3" style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3);">
                <small class="text-success d-block fw-semibold"><i class="bi bi-shield-check me-1"></i>Tutora Acreditada: ${patient.name} (RUT: ${patient.rut}) &bull; Previsión: ${patient.prevision || 'FONASA'}</small>
              </div>
            </div>
            <div class="modal-footer p-3 border-top justify-content-between" style="background: rgba(15, 23, 42, 0.98); border-color: rgba(255, 255, 255, 0.1) !important;">
              <button type="button" class="btn btn-outline-secondary px-4 py-2 rounded-pill fw-bold text-white" id="btnCloseNewbornModalBtn">Cancelar</button>
              <button type="submit" class="btn btn-warning px-5 py-2.5 rounded-pill fw-bold text-dark shadow-lg">
                👶 Registrar y Crear Ficha Pediátrica
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  // Listeners interactivos del Portal Maternal
  const slider = document.getElementById('maternalWeekSlider');
  const lblWeek = document.getElementById('lblCurrentWeekNum');
  const emojiEl = document.getElementById('fruitEmoji');
  const nameEl = document.getElementById('fruitName');
  const lengthEl = document.getElementById('fruitLength');
  const weightEl = document.getElementById('fruitWeight');
  const trimesterEl = document.getElementById('fruitTrimester');
  const milestoneEl = document.getElementById('fruitMilestone');
  const tipEl = document.getElementById('fruitTip');

  const updateFruit = (week) => {
    const data = getPregnancyWeekData(parseInt(week, 10));
    if (lblWeek) lblWeek.textContent = week;
    if (emojiEl) emojiEl.textContent = data.emoji;
    if (nameEl) nameEl.textContent = data.fruta;
    if (lengthEl) lengthEl.textContent = data.largo;
    if (weightEl) weightEl.textContent = data.peso;
    if (milestoneEl) milestoneEl.textContent = data.hito;
    if (tipEl) tipEl.textContent = data.consejo;
    if (trimesterEl) {
      trimesterEl.textContent = week <= 13 ? 'Primer Trimestre (Formación embrionaria)' : week <= 27 ? 'Segundo Trimestre (Crecimiento & Sentidos)' : 'Tercer Trimestre (Maduración & A término)';
    }
  };

  if (slider) {
    slider.oninput = (e) => updateFruit(e.target.value);
  }

  // Contador de pataditas
  const btnKick = document.getElementById('btnRegisterKick');
  const btnResetKick = document.getElementById('btnResetKicks');
  const lblKick = document.getElementById('lblKickCount');

  if (btnKick) {
    btnKick.onclick = () => {
      kickCount++;
      localStorage.setItem(kickKey, kickCount.toString());
      if (lblKick) lblKick.textContent = kickCount;
      if (kickCount === 10) {
        window.showGlassAlert('🎉 ¡Meta de 10 movimientos fetales alcanzada hoy! Tu bebé está activo y saludable.', 'success');
        speakText('Meta de diez movimientos fetales alcanzada hoy. Tu bebé está activo y saludable.');
      } else {
        window.showGlassAlert(`👣 Patadita registrada (#${kickCount}).`, 'info');
      }
    };
  }

  if (btnResetKick) {
    btnResetKick.onclick = () => {
      kickCount = 0;
      localStorage.setItem(kickKey, '0');
      if (lblKick) lblKick.textContent = '0';
      window.showGlassAlert('Contador de pataditas reiniciado.', 'info');
    };
  }

  // Botones de Cabecera
  const btnMaternalShowCard = document.getElementById('btnMaternalShowCard');
  if (btnMaternalShowCard) {
    btnMaternalShowCard.onclick = openMedicalCredentialModal;
  }

  const btnMaternalDental = document.getElementById('btnMaternalDental');
  if (btnMaternalDental) {
    btnMaternalDental.onclick = () => openDentalModuleModal(patient.id);
  }

  const btnMaternalSamu = document.getElementById('btnMaternalSamu');
  if (btnMaternalSamu) {
    btnMaternalSamu.onclick = () => {
      window.showGlassAlert('🚨 Conectando llamada de urgencia obstétrica al SAMU 131...', 'danger');
      window.location.href = 'tel:131';
    };
  }

  // Modal Registrar Nacimiento
  const modalNb = document.getElementById('modalRegistrarNacimiento');
  const btnOpenNb = document.getElementById('btnOpenNewbornModal');
  const btnCloseNbX = document.getElementById('btnCloseNewbornModalX');
  const btnCloseNbBtn = document.getElementById('btnCloseNewbornModalBtn');
  const formNb = document.getElementById('formRegistrarNacimiento');

  const openNbModal = () => {
    if (!modalNb) return;
    if (window.bootstrap && window.bootstrap.Modal) {
      new window.bootstrap.Modal(modalNb).show();
    } else {
      modalNb.classList.add('show');
      modalNb.style.display = 'block';
      document.body.classList.add('modal-open');
    }
  };

  const closeNbModal = () => {
    if (!modalNb) return;
    try {
      if (window.bootstrap && window.bootstrap.Modal) {
        const inst = window.bootstrap.Modal.getInstance(modalNb);
        if (inst) inst.hide();
      }
    } catch(e) {}
    modalNb.classList.remove('show');
    modalNb.style.display = 'none';
    document.body.classList.remove('modal-open');
    const backdrop = document.querySelector('.modal-backdrop');
    if (backdrop) backdrop.remove();
  };

  if (btnOpenNb) btnOpenNb.onclick = openNbModal;
  if (btnCloseNbX) btnCloseNbX.onclick = closeNbModal;
  if (btnCloseNbBtn) btnCloseNbBtn.onclick = closeNbModal;

  if (formNb) {
    formNb.onsubmit = (e) => {
      e.preventDefault();
      const nbName = document.getElementById('nbName')?.value.trim() || 'Recién Nacido';
      const nbSocialName = document.getElementById('nbSocialName')?.value.trim() || nbName;
      const nbRut = document.getElementById('nbRut')?.value.trim() || '29.999.888-1';
      const nbGender = document.getElementById('nbGender')?.value || 'Femenino';
      const nbBirthDate = document.getElementById('nbBirthDate')?.value || new Date().toISOString().slice(0, 10);
      const nbWeight = parseFloat(document.getElementById('nbWeight')?.value) || 3400;
      const nbHeight = parseFloat(document.getElementById('nbHeight')?.value) || 50;

      const newBabyId = 'p_nb_' + Date.now();
      const newBaby = {
        id: newBabyId,
        name: nbName,
        socialName: nbSocialName,
        rut: nbRut,
        age: 0,
        birthDate: nbBirthDate,
        gender: nbGender,
        bloodType: patient.bloodType || 'O+ (Rh Positivo)',
        prevision: patient.prevision || 'FONASA Tramo B',
        isPediatric: true,
        legalGuardianName: patient.name,
        legalGuardianRut: patient.rut,
        guardianRole: 'Madre Acreditada (Ley 21.430)',
        parentPatientId: patient.id,
        emergencyContact: {
          name: patient.name,
          phone: patient.phone || '+56 9 8765 4321',
          relation: 'Madre'
        },
        conditions: [],
        medications: [],
        allergies: [],
        documents: [],
        weight: (nbWeight / 1000).toFixed(2),
        height: nbHeight
      };

      // Guardar en custom patients
      let customPatients = [];
      try {
        const raw = localStorage.getItem('cuidapp_custom_patients');
        if (raw) customPatients = JSON.parse(raw);
      } catch(err) {}
      customPatients.push(newBaby);
      localStorage.setItem('cuidapp_custom_patients', JSON.stringify(customPatients));
      PATIENTS_DATABASE.push(newBaby);

      // Actualizar a la madre
      patient.isPregnant = false;
      patient.postpartum = true;

      closeNbModal();
      window.showGlassAlert(`🎉 ¡Felicitaciones! Nacimiento de ${nbSocialName} registrado exitosamente. Se ha creado su Ficha Pediátrica Oficial.`, 'success');
      speakText(`Felicitaciones por el nacimiento de ${nbSocialName}. Su ficha pediátrica oficial ha sido creada.`);

      // Ofrecer abrir su ficha pediátrica
      setTimeout(() => {
        window._parentPatientBackup = patient;
        setActivePatient(newBaby);
        setIsPediatric(true);
        renderPediatricView(container, () => {
          setActivePatient(window._parentPatientBackup || patient);
          setIsPediatric(false);
          renderPatientView(container);
        });
      }, 1500);
    };
  }
}

// --- VISTA 3: PORTAL DE PACIENTE ---

// Función para conectar eventos del modal Agregar Hijo/a
function bindAddChildModalEvents(container) {
  const modalAddChild = document.getElementById('modalAddChild');
  const btnOpenAddChildModal = document.getElementById('btnOpenAddChildModal');
  const btnCloseAddChildModalX = document.getElementById('btnCloseAddChildModalX');
  const btnCloseAddChildModalBtn = document.getElementById('btnCloseAddChildModalBtn');
  const formAddChild = document.getElementById('formAddChild');

  const openChildModal = () => {
    if (!modalAddChild) return;
    if (window.bootstrap && window.bootstrap.Modal) {
      new window.bootstrap.Modal(modalAddChild).show();
    } else {
      modalAddChild.classList.add('show');
      modalAddChild.style.display = 'block';
      document.body.classList.add('modal-open');
    }
  };

  const closeChildModal = () => {
    if (!modalAddChild) return;
    try {
      if (window.bootstrap && window.bootstrap.Modal) {
        const inst = window.bootstrap.Modal.getInstance(modalAddChild);
        if (inst) inst.hide();
      }
    } catch(e) {}
    modalAddChild.classList.remove('show');
    modalAddChild.style.display = 'none';
    document.body.classList.remove('modal-open');
    const backdrop = document.querySelector('.modal-backdrop');
    if (backdrop) backdrop.remove();
  };

  if (btnOpenAddChildModal) btnOpenAddChildModal.onclick = openChildModal;
  if (btnCloseAddChildModalX) btnCloseAddChildModalX.onclick = closeChildModal;
  if (btnCloseAddChildModalBtn) btnCloseAddChildModalBtn.onclick = closeChildModal;

  if (formAddChild) {
    formAddChild.onsubmit = (e) => {
      e.preventDefault();
      const chName = document.getElementById('acChildName')?.value.trim() || 'Niño/a';
      const chSocial = document.getElementById('acChildSocialName')?.value.trim() || chName;
      const chRut = document.getElementById('acChildRut')?.value.trim() || '28.111.222-3';
      const chGender = document.getElementById('acChildGender')?.value || 'Masculino';
      const chBirthDate = document.getElementById('acChildBirthDate')?.value || '2021-06-15';
      const chCondRaw = document.getElementById('acChildConditions')?.value.trim() || '';
      const chConditions = chCondRaw ? chCondRaw.split(',').map(c => c.trim()) : [];

      const birthYear = new Date(chBirthDate).getFullYear();
      const calcAge = Math.max(0, new Date().getFullYear() - birthYear);
      const isPed = calcAge < 14;
      const isAdo = calcAge >= 14 && calcAge <= 17;
      const isAssisted = calcAge >= 18 && calcAge <= 59;
      const isOld = calcAge >= 60;

      const newChildId = 'p_child_' + Date.now();
      const newChildObj = {
        id: newChildId,
        name: chName,
        socialName: chSocial,
        rut: chRut,
        documentNumber: chRut,
        age: calcAge,
        birthDate: chBirthDate,
        gender: chGender,
        bloodType: 'O+ (Rh Positivo)',
        prevision: (activePatient && activePatient.prevision) || 'FONASA Tramo B',
        isPediatric: isPed,
        isAdolescent: isAdo,
        isAssistedAdult: isAssisted,
        isSenior: isOld,
        legalGuardianName: (activePatient && activePatient.name) || 'Tutor/a',
        legalGuardianRut: (activePatient && activePatient.rut) || '',
        guardianRole: 'Tutor/a Acreditada (Ley N° 20.584 / Ley N° 21.430)',
        parentPatientId: activePatient ? activePatient.id : null,
        emergencyContact: {
          name: (activePatient && activePatient.name) || 'Tutor/a',
          phone: (activePatient && activePatient.phone) || '+56 9 8765 4321',
          relation: (activePatient && activePatient.gender === 'Femenino') ? 'Madre' : 'Padre / Tutor'
        },
        conditions: chConditions,
        medications: [],
        allergies: [],
        documents: []
      };

      if (activePatient) {
        if (!Array.isArray(activePatient.children)) activePatient.children = [];
        activePatient.children.push(newChildId);
      }

      let customP = [];
      try {
        const raw = localStorage.getItem('cuidapp_custom_patients');
        if (raw) customP = JSON.parse(raw);
      } catch(err) {}
      customP.push(newChildObj);
      localStorage.setItem('cuidapp_custom_patients', JSON.stringify(customP));
      if (typeof PATIENTS_DATABASE !== 'undefined') PATIENTS_DATABASE.push(newChildObj);

      closeChildModal();
      window.showGlassAlert(`👨‍👩‍👧 Ficha de persona a cargo (${chSocial}) creada y vinculada exitosamente.`, 'success');
      if (typeof speakText === 'function') speakText(`Ficha de ${chSocial} creada y vinculada exitosamente.`);
      renderPatientView(container);
    };
  }
}


// ============================================================================
// CARNET PRENATAL MINSAL & CONTROLES OBSTÉTRICOS (HISTORIAL Y EVOLUCIONES)
// ============================================================================
export function renderPrenatalHistorySection(historyTab, patient, currentWeeks = 24) {
  if (!historyTab || !patient) return;
  let section = historyTab.querySelector('#sectionCarnetPrenatalMinsal');
  if (!section) {
    section = document.createElement('div');
    section.id = 'sectionCarnetPrenatalMinsal';
    section.className = 'glass-card p-4 border-0 mb-4';
    section.style.background = 'linear-gradient(135deg, rgba(236,72,153,0.12) 0%, rgba(14,165,233,0.08) 100%)';
    section.style.border = '1.5px solid rgba(244,114,182,0.45)';
    section.style.borderRadius = '20px';

    const topbar = historyTab.querySelector('.folder-view-topbar');
    const insertBeforeEl = historyTab.querySelector('#caregiverMonthlySummaryBarContainer') || historyTab.querySelector('#clinicalHistorySection') || (topbar ? topbar.nextSibling : historyTab.firstChild);
    if (insertBeforeEl) {
      historyTab.insertBefore(section, insertBeforeEl);
    } else {
      historyTab.appendChild(section);
    }
  }

  const fpp = patient.fpp || (() => {
    const rem = Math.max(0, 40 - currentWeeks);
    const d = new Date();
    d.setDate(d.getDate() + rem * 7);
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
  })();

  const trimester = currentWeeks <= 13 ? '1° Trimestre (Formación embrionaria)' : currentWeeks <= 27 ? '2° Trimestre (Crecimiento & Sentidos)' : '3° Trimestre (Maduración & A término)';

  const evolKey = `cuidapp_prenatal_evolutions_${patient.id}`;
  let evolutions = [];
  try {
    const stored = localStorage.getItem(evolKey);
    if (stored) evolutions = JSON.parse(stored);
  } catch (e) {}

  if (!evolutions || evolutions.length === 0) {
    evolutions = [
      {
        date: '18 Nov 2026',
        week: currentWeeks,
        title: `Control Prenatal Integral (${currentWeeks} Semanas)`,
        professional: 'Matrona Carla Henríquez &bull; CESFAM Las Condes',
        badge: 'Al Día',
        badgeColor: 'success',
        details: [
          { label: 'Presión Arterial', value: '110/70 mmHg', status: 'Normotensa' },
          { label: 'Altura Uterina (AU)', value: `${Math.max(12, currentWeeks - 2)} cm`, status: 'Adecuada para EG' },
          { label: 'Latidos Cardiofetales (LCF)', value: '148 LPM', status: 'Rítmicos y vigorosos' },
          { label: 'Movimientos Fetales', value: 'Presentes y activos', status: 'Patrón normal' }
        ],
        notes: 'Paciente asiste a control prenatal periódico en excelentes condiciones. Se realiza tamizaje PTGO y se prescribe suplementación continua de Sulfato Ferroso y Calcio. Participación activa en talleres prenatales Chile Crece Contigo.'
      },
      {
        date: '24 Oct 2026',
        week: Math.max(4, currentWeeks - 4),
        title: 'Ecografía Morfológica Fetal & Control Obstétrico',
        professional: 'Dr. Gonzalo Paredes (Ginecólogo Obstetra)',
        badge: 'Completado',
        badgeColor: 'info',
        details: [
          { label: 'Anatomía Fetal', value: 'Sin defectos estructurales', status: 'Normal' },
          { label: 'Placenta y LA', value: 'Normoinserta posterior, ILA 14 cm', status: 'Normal' },
          { label: 'Doppler Materno-Fetal', value: 'Flujo útero-placentario normal', status: 'Bajo riesgo' }
        ],
        notes: 'Examen morfológico exhaustivo. Biometría simétrica coincidente con edad gestacional. Sin marcadores de aneuploidías.'
      }
    ];
    try {
      localStorage.setItem(evolKey, JSON.stringify(evolutions));
    } catch (e) {}
  }

  section.innerHTML = `
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
      <div>
        <h4 class="glass-title m-0 d-flex align-items-center gap-2">
          <span style="font-size: 1.6rem;">🤰</span>
          <span>Carnet Prenatal MINSAL & Controles Obstétricos</span>
        </h4>
        <small class="text-white-50" style="font-size: 0.8rem;">Vigilancia del binomio madre-hijo, edad gestacional y controles de matronería &bull; Chile Crece Contigo</small>
      </div>
      <span class="badge px-3 py-1.5 rounded-pill fw-bold" style="background: rgba(236,72,153,0.22); color: #f472b6; border: 1.5px solid #f472b6; font-size: 0.82rem;">
        <i class="bi bi-heart-pulse-fill me-1"></i>Control Materno Activo
      </span>
    </div>

    <!-- Fila Resumen: FPP, Trimestre, Viabilidad -->
    <div class="row g-3 mb-4">
      <div class="col-md-4">
        <div class="p-3 rounded-3 h-100" style="background: rgba(15, 23, 42, 0.7); border: 1.5px solid rgba(244,114,182,0.35);">
          <span class="text-white-50 small d-block mb-1" style="font-size: 0.75rem;"><i class="bi bi-calendar-heart me-1 text-danger"></i>Fecha Probable de Parto (FPP)</span>
          <strong class="fs-5 text-white d-block" id="prenatalFppVal">${fpp}</strong>
          <small class="text-pink d-block mt-1" style="color: #f472b6; font-size: 0.72rem;">Cálculo según Regla de Naegele / Ecografía Precoz</small>
        </div>
      </div>
      <div class="col-md-4">
        <div class="p-3 rounded-3 h-100" style="background: rgba(15, 23, 42, 0.7); border: 1.5px solid rgba(56,189,248,0.35);">
          <span class="text-white-50 small d-block mb-1" style="font-size: 0.75rem;"><i class="bi bi-clock-history me-1 text-info"></i>Trimestre & Edad Gestacional</span>
          <strong class="fs-5 text-info d-block">Semana ${currentWeeks}</strong>
          <small class="text-white-50 d-block mt-1" style="font-size: 0.72rem;">${trimester}</small>
        </div>
      </div>
      <div class="col-md-4">
        <div class="p-3 rounded-3 h-100" style="background: rgba(15, 23, 42, 0.7); border: 1.5px solid rgba(34,197,94,0.35);">
          <span class="text-white-50 small d-block mb-1" style="font-size: 0.75rem;"><i class="bi bi-shield-check me-1 text-success"></i>Estado del Embarazo</span>
          <strong class="fs-5 text-success d-block">Fisiológico &bull; Feto Activo</strong>
          <small class="text-white-50 d-block mt-1" style="font-size: 0.72rem;">Curva de crecimiento y signos vitales en rango</small>
        </div>
      </div>
    </div>

    <!-- Lista de Evoluciones Obstétricas -->
    <h5 class="fw-bold text-white mb-3 d-flex align-items-center gap-2" style="font-size: 1.05rem;">
      <i class="bi bi-journal-medical text-info"></i>
      <span>Evoluciones Clínicas de Matrona y Médico Obstetra</span>
    </h5>
    <div class="d-flex flex-column gap-3">
      ${evolutions.map(ev => `
        <div class="p-3.5 rounded-3" style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.12);">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
            <div>
              <strong class="text-white fs-6">${ev.title}</strong>
              <small class="text-white-50 d-block" style="font-size: 0.75rem;"><i class="bi bi-person-badge me-1 text-info"></i>${ev.professional} &bull; <i class="bi bi-calendar3 me-1 text-white-50"></i>${ev.date}</small>
            </div>
            <span class="badge bg-${ev.badgeColor || 'success'} bg-opacity-25 text-${ev.badgeColor || 'success'} border border-${ev.badgeColor || 'success'} px-2.5 py-1 rounded-pill" style="font-size: 0.75rem;">
              ${ev.badge}
            </span>
          </div>
          <div class="row g-2 mb-2 pt-2 border-top border-light border-opacity-10">
            ${ev.details.map(d => `
              <div class="col-6 col-md-3">
                <span class="text-white-50 small d-block" style="font-size: 0.7rem;">${d.label}:</span>
                <strong class="text-white" style="font-size: 0.82rem;">${d.value}</strong>
                <small class="text-success d-block" style="font-size: 0.68rem;">${d.status}</small>
              </div>
            `).join('')}
          </div>
          <p class="text-white-50 small mb-0 mt-2" style="font-size: 0.78rem; line-height: 1.45;">
            <strong class="text-white">Indicaciones:</strong> ${ev.notes}
          </p>
        </div>
      `).join('')}
    </div>
  `;
}

// ============================================================================
// REGISTRO DE ECOGRAFÍAS Y EXÁMENES PRENATALES (DOCUMENTOS Y RECETAS)
// ============================================================================
export function renderPrenatalDocumentsSection(docsTab, patient) {
  if (!docsTab || !patient) return;
  let section = docsTab.querySelector('#sectionEcografiasExamenesPrenatales');
  if (!section) {
    section = document.createElement('div');
    section.id = 'sectionEcografiasExamenesPrenatales';
    section.className = 'glass-card p-4 border-0 mb-4';
    section.style.background = 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(236,72,153,0.08) 100%)';
    section.style.border = '1.5px solid rgba(245,158,11,0.45)';
    section.style.borderRadius = '20px';

    const topbar = docsTab.querySelector('.folder-view-topbar');
    const insertBeforeEl = docsTab.querySelector('#caregiverDocsMainContainer') || (topbar ? topbar.nextSibling : docsTab.firstChild);
    if (insertBeforeEl) {
      docsTab.insertBefore(section, insertBeforeEl);
    } else {
      docsTab.appendChild(section);
    }
  }

  const ecoKey = `cuidapp_prenatal_ecografias_${patient.id}`;
  let ecografias = [];
  try {
    const stored = localStorage.getItem(ecoKey);
    if (stored) ecografias = JSON.parse(stored);
  } catch (e) {}

  if (!ecografias || ecografias.length === 0) {
    ecografias = [
      {
        id: 'eco-1',
        title: 'Ecografía Doppler / Morfológica Fetal',
        category: 'Ecografía Fetal',
        icon: '📷',
        date: '24 Oct 2026',
        week: '22 Semanas',
        doctor: 'Dr. Gonzalo Paredes',
        center: 'Centro de Diagnóstico Perinatal',
        conclusion: 'Biometría fetal acorde a 22+1 semanas. Anatomía fetal completa sin malformaciones. Flujometría Doppler de arterias uterinas normal. Placenta posterior grado I.',
        status: 'Validado'
      },
      {
        id: 'eco-2',
        title: 'Ecografía 11-14 Semanas (Tamizaje Genético)',
        category: 'Ecografía Fetal',
        icon: '📷',
        date: '12 Ago 2026',
        week: '12 Semanas',
        doctor: 'Dra. Verónica Silva',
        center: 'Clínica Obstétrica Santiago',
        conclusion: 'Translucencia Nucal (TN) 1.2 mm. Hueso nasal presente. Ducto venoso con onda normal. Riesgo bajo para trisomías 21, 18 y 13.',
        status: 'Validado'
      },
      {
        id: 'eco-3',
        title: 'Perfil Bioquímico & Rutina Prenatal 1° Trimestre',
        category: 'Laboratorio Prenatal',
        icon: '🧪',
        date: '05 Ago 2026',
        week: '11 Semanas',
        doctor: 'Lab. Clínico Central',
        center: 'CESFAM Las Condes',
        conclusion: 'Glicemia basal 84 mg/dL (Normal). Hematocrito 36.5%, Hemoglobina 12.2 g/dL. Grupo O Rh(+). VDRL no reactivo. VIH no reactivo. Urocultivo negativo.',
        status: 'Validado'
      }
    ];
    try {
      localStorage.setItem(ecoKey, JSON.stringify(ecografias));
    } catch (e) {}
  }

  const renderContent = () => {
    section.innerHTML = `
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h4 class="glass-title m-0 d-flex align-items-center gap-2">
            <span style="font-size: 1.6rem;">📑</span>
            <span>Registro de Ecografías y Exámenes Prenatales</span>
          </h4>
          <small class="text-white-50" style="font-size: 0.8rem;">Ecografía Obstétrica, Eco Doppler / Morfológica y Perfil Bioquímico &bull; DS N° 41 / MINSAL</small>
        </div>
        <button type="button" id="btnToggleAddEcoForm" class="btn btn-sm btn-outline-warning rounded-pill px-3 py-1.5 fw-bold d-inline-flex align-items-center gap-1.5" style="border-radius: 9999px; font-size: 0.84rem; cursor: pointer;">
          <i class="bi bi-plus-circle-fill"></i>
          <span>Agregar Nueva Ecografía o Informe</span>
        </button>
      </div>

      <!-- Formulario Desplegable para Agregar Ecografía -->
      <div id="formAddEcoContainer" class="p-3.5 rounded-3 mb-4 d-none" style="background: rgba(15, 23, 42, 0.9); border: 1.5px solid #f59e0b;">
        <h6 class="fw-bold text-warning mb-2.5"><i class="bi bi-file-earmark-plus me-1.5"></i>Registrar Nueva Ecografía / Examen Prenatal</h6>
        <form id="formAddPrenatalEco">
          <div class="row g-2 mb-2">
            <div class="col-md-6">
              <label class="form-label small text-white-50 mb-0.5">Tipo de Examen *</label>
              <select id="ecoType" class="form-select form-select-sm bg-dark text-white border-secondary" required>
                <option value="Ecografía Obstétrica">Ecografía Obstétrica</option>
                <option value="Eco Doppler / Morfológica Fetal">Eco Doppler / Morfológica Fetal</option>
                <option value="Ecografía 11-14 Semanas">Ecografía 11-14 Semanas</option>
                <option value="Ecografía Crecimiento 32-34 Semanas">Ecografía Crecimiento 32-34 Semanas</option>
                <option value="Perfil Bioquímico Prenatal">Perfil Bioquímico Prenatal</option>
              </select>
            </div>
            <div class="col-md-3">
              <label class="form-label small text-white-50 mb-0.5">Semanas Gestación *</label>
              <input type="number" id="ecoWeeks" class="form-control form-select-sm bg-dark text-white border-secondary" min="4" max="42" value="${patient.pregnancyWeeks || 24}" required>
            </div>
            <div class="col-md-3">
              <label class="form-label small text-white-50 mb-0.5">Fecha *</label>
              <input type="date" id="ecoDate" class="form-control form-select-sm bg-dark text-white border-secondary" value="${new Date().toISOString().slice(0, 10)}" required>
            </div>
          </div>
          <div class="row g-2 mb-2">
            <div class="col-md-6">
              <label class="form-label small text-white-50 mb-0.5">Centro Médico / CESFAM</label>
              <input type="text" id="ecoCenter" class="form-control form-select-sm bg-dark text-white border-secondary" placeholder="Ej: Clínica Obstétrica / CESFAM Las Condes" value="Centro Perinatal">
            </div>
            <div class="col-md-6">
              <label class="form-label small text-white-50 mb-0.5">Médico / Especialista</label>
              <input type="text" id="ecoDoctor" class="form-control form-select-sm bg-dark text-white border-secondary" placeholder="Ej: Dr. Gonzalo Paredes" value="Dra. Obstetra de Turno">
            </div>
          </div>
          <div class="mb-3">
            <label class="form-label small text-white-50 mb-0.5">Conclusiones / Biometría Fetal</label>
            <textarea id="ecoConclusion" rows="2" class="form-control form-select-sm bg-dark text-white border-secondary" placeholder="Ej: Feto único en presentación cefálica, biometría simétrica, líquido amniótico normal." required>Biometría fetal acorde a edad gestacional. Sin anomalías detectadas. Placenta y líquido amniótico normales.</textarea>
          </div>
          <div class="d-flex justify-content-end gap-2">
            <button type="button" id="btnCancelAddEco" class="btn btn-sm btn-outline-light px-3 py-1">Cancelar</button>
            <button type="submit" class="btn btn-sm btn-warning px-3 py-1 fw-bold text-dark"><i class="bi bi-save me-1"></i>Guardar Informe</button>
          </div>
        </form>
      </div>

      <!-- Listado de Ecografías Registradas -->
      <div class="d-flex flex-column gap-3" id="listEcografiasContainer">
        ${ecografias.map(eco => `
          <div class="p-3.5 rounded-3 d-flex flex-column gap-2" style="background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(255,255,255,0.12);">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div class="d-flex align-items-center gap-2.5">
                <span style="font-size: 1.5rem;">${eco.icon || '📷'}</span>
                <div>
                  <strong class="text-white fs-6">${eco.title}</strong>
                  <small class="text-white-50 d-block" style="font-size: 0.74rem;">${eco.center} &bull; ${eco.doctor} &bull; <span class="text-info">${eco.week}</span></small>
                </div>
              </div>
              <div class="d-flex align-items-center gap-2">
                <span class="badge bg-success bg-opacity-25 text-success border border-success px-2.5 py-1 rounded-pill" style="font-size: 0.72rem;">
                  <i class="bi bi-check-circle-fill me-1"></i>${eco.status || 'Validado'}
                </span>
                <span class="text-white-50 small" style="font-size: 0.74rem;"><i class="bi bi-calendar3 me-1"></i>${eco.date}</span>
              </div>
            </div>
            <p class="text-white-50 small mb-0 pt-2 border-top border-light border-opacity-10" style="font-size: 0.78rem; line-height: 1.45;">
              <strong class="text-white">Conclusión:</strong> ${eco.conclusion}
            </p>
          </div>
        `).join('')}
      </div>
    `;

    const btnToggle = section.querySelector('#btnToggleAddEcoForm');
    const formContainer = section.querySelector('#formAddEcoContainer');
    const btnCancel = section.querySelector('#btnCancelAddEco');
    const formEco = section.querySelector('#formAddPrenatalEco');

    if (btnToggle && formContainer) {
      btnToggle.onclick = () => {
        formContainer.classList.toggle('d-none');
      };
    }
    if (btnCancel && formContainer) {
      btnCancel.onclick = () => {
        formContainer.classList.add('d-none');
      };
    }
    if (formEco) {
      formEco.onsubmit = (e) => {
        e.preventDefault();
        const newEco = {
          id: 'eco-' + Date.now(),
          title: section.querySelector('#ecoType').value,
          category: 'Ecografía Fetal',
          icon: '📷',
          date: section.querySelector('#ecoDate').value,
          week: section.querySelector('#ecoWeeks').value + ' Semanas',
          doctor: section.querySelector('#ecoDoctor').value,
          center: section.querySelector('#ecoCenter').value,
          conclusion: section.querySelector('#ecoConclusion').value,
          status: 'Validado'
        };
        ecografias.unshift(newEco);
        try {
          localStorage.setItem(ecoKey, JSON.stringify(ecografias));
        } catch (err) {}
        if (window.showGlassAlert) {
          window.showGlassAlert('✅ Ecografía registrada exitosamente en el historial prenatal.', 'success');
        }
        renderContent();
      };
    }
  };

  renderContent();
}

// ============================================================================
// SINCRONIZACIÓN Y RENDERIZADO REACTIVO DE MÓDULOS PRENATALES
// ============================================================================
export function syncPrenatalModulesForActivePatient(targetContainer = (typeof document !== 'undefined' ? document : null)) {
  if (!targetContainer || typeof document === 'undefined') return;

  let patient = null;
  if (typeof getActivePatient === 'function') {
    try { patient = getActivePatient(); } catch (e) {}
  }
  if (!patient && typeof activePatient !== 'undefined' && activePatient) {
    patient = activePatient;
  }
  if (!patient) {
    const sel = document.getElementById('patientSelector');
    if (sel && sel.value && typeof PATIENTS_DATABASE !== 'undefined') {
      patient = PATIENTS_DATABASE.find(p => p.id === sel.value);
    }
  }
  if (!patient) {
    const userEl = document.querySelector('.sidebar footer strong, footer strong.text-white, #caregiverGreetingPatientName');
    const uName = userEl ? userEl.textContent.trim().toLowerCase() : '';
    if (uName.includes('daniela') && typeof PATIENTS_DATABASE !== 'undefined') {
      patient = PATIENTS_DATABASE.find(p => p.id === 'p_daniela');
    }
  }

  if (!patient) return;

  const isGestantePatient = isPatientPregnantDynamic(patient);

  // Regla dinámica Adolescente (paciente.age < 18 o fecha de nacimiento menor a 18 años):
  // En el banner superior, oculta automáticamente el botón "+ Agregar Persona a Cargo" para cualquier usuario menor de 18 años (Ley N° 21.430, salvo condición de embarazo o maternidad/paternidad registrada).
  const pAge = getDynamicPatientAge(patient);
  const hasPaternityMaternity = isGestantePatient || Boolean(
    patient.hasChildren ||
    (Array.isArray(patient.children) && patient.children.length > 0) ||
    (typeof localStorage !== 'undefined' && localStorage.getItem(`cuidapp_postpartum_${patient.id}`) === 'true')
  );
  const isAdolescentWithoutDependentRight = (pAge < 18) && !hasPaternityMaternity;

  const btnAddPersona = targetContainer.querySelector ? (targetContainer.querySelector('#btnOpenAddPersonaACargoModal') || document.getElementById('btnOpenAddPersonaACargoModal')) : document.getElementById('btnOpenAddPersonaACargoModal');
  if (btnAddPersona) {
    if (isAdolescentWithoutDependentRight) {
      btnAddPersona.classList.add('d-none');
      btnAddPersona.style.setProperty('display', 'none', 'important');
    } else {
      btnAddPersona.classList.remove('d-none');
      btnAddPersona.style.removeProperty('display');
    }
  }

  // Regla dinámica Mujer Gestante (paciente.isPregnant === true, condición activa de embarazo/gestación o Daniela Morales):
  // Dentro de las vistas internas de sus carpetas se activa el módulo clínico completo de Control Prenatal:
  const cardGrowth = targetContainer.querySelector ? (targetContainer.querySelector('#cardPrenatalGrowthCaregiver') || document.getElementById('cardPrenatalGrowthCaregiver')) : document.getElementById('cardPrenatalGrowthCaregiver');
  const historyTab = targetContainer.querySelector ? (targetContainer.querySelector('#tabContentCaregiverHistory') || document.getElementById('tabContentCaregiverHistory')) : document.getElementById('tabContentCaregiverHistory');
  const docsTab = targetContainer.querySelector ? (targetContainer.querySelector('#tabContentCaregiverDocs') || document.getElementById('tabContentCaregiverDocs')) : document.getElementById('tabContentCaregiverDocs');

  if (isGestantePatient) {
    // --- 1. DENTRO DE CONTROL DIARIO Y SIGNOS (ARRIBA DE SUS SIGNOS VITALES) ---
    if (cardGrowth) {
      cardGrowth.classList.remove('d-none');
      cardGrowth.style.removeProperty('display');

      let currentWeek = parseInt(
        (typeof localStorage !== 'undefined' && localStorage.getItem(`cuidapp_gestational_weeks_${patient.id}`)) ||
        patient.pregnancyWeeks ||
        patient.gestationalWeeks ||
        24,
        10
      );
      if (isNaN(currentWeek) || currentWeek < 4 || currentWeek > 41) currentWeek = 24;

      const updateGestationalView = (w) => {
        const data = getGestationalFruitData(w);
        const badgeVal = cardGrowth.querySelector('#badgeGestationalWeeksVal');
        const badgeTrim = cardGrowth.querySelector('#badgeGestationalTrimester');
        const emojiEl = cardGrowth.querySelector('#prenatalFruitEmoji');
        const titleEl = cardGrowth.querySelector('#prenatalFruitTitle');
        const subEl = cardGrowth.querySelector('#prenatalFruitSub');
        const lengthEl = cardGrowth.querySelector('#prenatalFetalLength');
        const weightEl = cardGrowth.querySelector('#prenatalFetalWeight');

        if (badgeVal) badgeVal.textContent = data.week;
        if (badgeTrim) badgeTrim.textContent = data.trimester;
        if (emojiEl) emojiEl.textContent = data.emoji;
        if (titleEl) titleEl.textContent = `Un ${data.fruit}`;
        if (subEl) subEl.textContent = `Semana ${data.week} de desarrollo fetal activo`;
        if (lengthEl) lengthEl.textContent = `~ ${data.length}`;
        if (weightEl) weightEl.textContent = `~ ${data.weight}`;

        patient.pregnancyWeeks = data.week;
        patient.gestationalWeeks = data.week;
        try {
          localStorage.setItem(`cuidapp_gestational_weeks_${patient.id}`, String(data.week));
        } catch (e) {}

        // Actualizar FPP en Historial si ya está renderizado
        const fppEl = document.getElementById('prenatalFppVal');
        if (fppEl && !patient.fpp) {
          const rem = Math.max(0, 40 - data.week);
          const d = new Date();
          d.setDate(d.getDate() + rem * 7);
          fppEl.textContent = d.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
        }
      };

      updateGestationalView(currentWeek);

      const btnPrevW = cardGrowth.querySelector('#btnPrevGestationalWeek');
      const btnNextW = cardGrowth.querySelector('#btnNextGestationalWeek');
      if (btnPrevW && !btnPrevW._prenatalBound) {
        btnPrevW._prenatalBound = true;
        btnPrevW.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          let w = parseInt(cardGrowth.querySelector('#badgeGestationalWeeksVal')?.textContent || '24', 10);
          if (w > 4) {
            w--;
            updateGestationalView(w);
          }
        };
      }
      if (btnNextW && !btnNextW._prenatalBound) {
        btnNextW._prenatalBound = true;
        btnNextW.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          let w = parseInt(cardGrowth.querySelector('#badgeGestationalWeeksVal')?.textContent || '24', 10);
          if (w < 41) {
            w++;
            updateGestationalView(w);
          }
        };
      }

      // Controles rápidos prenatales: movimientos fetales diarios y adherencia a ácido fólico/hierro
      let quickControls = cardGrowth.querySelector('#prenatalInteractiveQuickControls');
      if (!quickControls) {
        quickControls = document.createElement('div');
        quickControls.id = 'prenatalInteractiveQuickControls';
        quickControls.className = 'p-3 rounded-4 mb-3';
        quickControls.style.background = 'rgba(15, 23, 42, 0.65)';
        quickControls.style.border = '1.5px solid rgba(244,114,182,0.3)';

        const insertTarget = cardGrowth.querySelector('.row.g-3') || cardGrowth.querySelector('.btn-trigger-register-birth')?.parentElement || cardGrowth.lastChild;
        cardGrowth.insertBefore(quickControls, insertTarget);
      }

      const todayDateStr = new Date().toISOString().slice(0, 10);
      const kickKey = `cuidapp_fetal_kicks_${patient.id}_${todayDateStr}`;
      let kicks = parseInt(localStorage.getItem(kickKey) || '12', 10);

      const folicKey = `cuidapp_supp_folic_${patient.id}_${todayDateStr}`;
      const ironKey = `cuidapp_supp_iron_${patient.id}_${todayDateStr}`;
      let folicTaken = localStorage.getItem(folicKey) === 'true';
      let ironTaken = localStorage.getItem(ironKey) !== 'false';

      const renderQuickControls = () => {
        quickControls.innerHTML = `
          <div class="row g-3 align-items-center">
            <div class="col-md-6">
              <div class="p-3 rounded-3 h-100" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);">
                <div class="d-flex justify-content-between align-items-center mb-1.5">
                  <span class="text-white-50 small fw-bold"><i class="bi bi-activity text-success me-1"></i>Movimientos Fetales Diarios</span>
                  <span class="badge ${kicks >= 10 ? 'bg-success' : 'bg-warning'} bg-opacity-25 text-${kicks >= 10 ? 'success' : 'warning'} border border-${kicks >= 10 ? 'success' : 'warning'} px-2 py-0.5 rounded-pill" style="font-size: 0.72rem;">
                    ${kicks >= 10 ? 'Patrón Normal' : 'Atención'}
                  </span>
                </div>
                <div class="d-flex align-items-center justify-content-between gap-2 mt-2">
                  <div>
                    <strong class="fs-4 text-white" id="valFetalKicks">${kicks}</strong>
                    <small class="text-white-50 ms-1" style="font-size: 0.75rem;">movimientos hoy</small>
                    <small class="d-block text-success" style="font-size: 0.68rem;">≥ 10 movimientos en 2 hrs (MINSAL)</small>
                  </div>
                  <div class="d-flex align-items-center gap-1.5">
                    <button type="button" id="btnRegisterKickQuick" class="btn btn-sm btn-outline-success px-2.5 py-1 rounded-pill fw-bold d-inline-flex align-items-center gap-1" style="font-size: 0.8rem; cursor: pointer;">
                      <span>👶 + Patadita</span>
                    </button>
                    <button type="button" id="btnResetKicksQuick" class="btn btn-sm btn-outline-secondary px-2 py-1 rounded-circle" title="Reiniciar contador" style="width: 28px; height: 28px; line-height: 1; cursor: pointer;">
                      ↺
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="col-md-6">
              <div class="p-3 rounded-3 h-100" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);">
                <span class="text-white-50 small fw-bold d-block mb-1.5"><i class="bi bi-capsule text-warning me-1"></i>Suplementos Prenatales & Adherencia</span>
                <div class="d-flex flex-column gap-2 mt-1">
                  <div class="d-flex align-items-center justify-content-between p-1.5 px-2.5 rounded" style="background: rgba(255,255,255,0.04);">
                    <span class="text-white small" style="font-size: 0.78rem;"><strong>Ácido Fólico (1 mg):</strong></span>
                    <button type="button" id="btnToggleFolic" class="btn btn-sm py-0.5 px-2 rounded-pill fw-semibold ${folicTaken ? 'btn-success' : 'btn-outline-warning'}" style="font-size: 0.74rem;">
                      ${folicTaken ? 'Tomado hoy ✅' : 'Pendiente ⏳'}
                    </button>
                  </div>
                  <div class="d-flex align-items-center justify-content-between p-1.5 px-2.5 rounded" style="background: rgba(255,255,255,0.04);">
                    <span class="text-white small" style="font-size: 0.78rem;"><strong>Hierro + Calcio:</strong></span>
                    <button type="button" id="btnToggleIron" class="btn btn-sm py-0.5 px-2 rounded-pill fw-semibold ${ironTaken ? 'btn-success' : 'btn-outline-warning'}" style="font-size: 0.74rem;">
                      ${ironTaken ? 'Tomado hoy ✅' : 'Pendiente ⏳'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;

        const btnKick = quickControls.querySelector('#btnRegisterKickQuick');
        const btnReset = quickControls.querySelector('#btnResetKicksQuick');
        const btnFolic = quickControls.querySelector('#btnToggleFolic');
        const btnIron = quickControls.querySelector('#btnToggleIron');

        if (btnKick) {
          btnKick.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            kicks++;
            localStorage.setItem(kickKey, String(kicks));
            renderQuickControls();
            if (window.showGlassAlert) {
              window.showGlassAlert('👶 Movimiento fetal registrado (+1).', 'info');
            }
          };
        }
        if (btnReset) {
          btnReset.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            kicks = 0;
            localStorage.setItem(kickKey, '0');
            renderQuickControls();
          };
        }
        if (btnFolic) {
          btnFolic.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            folicTaken = !folicTaken;
            localStorage.setItem(folicKey, String(folicTaken));
            renderQuickControls();
          };
        }
        if (btnIron) {
          btnIron.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            ironTaken = !ironTaken;
            localStorage.setItem(ironKey, String(ironTaken));
            renderQuickControls();
          };
        }
      };

      renderQuickControls();

      // Botón único "👶 Registrar Nacimiento del Bebé" bien ubicado en la tarjeta maternal (evita duplicación)
      const existingMaternalBirthBtn = document.querySelector('#cardPrenatalVitalsOnly .btn-trigger-register-birth') || document.querySelector('.btn-trigger-register-birth');
      let btnRegisterBirth = cardGrowth.querySelector('#btnRegisterBirthPrenatalGrowth');
      if (existingMaternalBirthBtn && btnRegisterBirth) {
        btnRegisterBirth.closest('.mt-3')?.remove();
      } else if (!existingMaternalBirthBtn && !btnRegisterBirth) {
        const birthContainer = document.createElement('div');
        birthContainer.className = 'mt-3 pt-3 border-top border-light border-opacity-10';
        birthContainer.innerHTML = `
          <button type="button" id="btnRegisterBirthPrenatalGrowth" class="btn btn-lg w-100 fw-bold py-2.5 d-inline-flex align-items-center justify-content-center gap-2 shadow-sm text-white btn-trigger-register-birth" style="border-radius: 14px; background: linear-gradient(135deg, #ec4899 0%, #be185d 100%); border: 1.5px solid #f472b6; font-size: 1rem; cursor: pointer;">
            <span style="font-size: 1.3rem; line-height: 1;">👶</span>
            <span>Registrar Nacimiento del Bebé</span>
          </button>
        `;
        cardGrowth.appendChild(birthContainer);
        btnRegisterBirth = cardGrowth.querySelector('#btnRegisterBirthPrenatalGrowth');
      }

      document.querySelectorAll('.btn-trigger-register-birth').forEach(btn => {
        if (!btn._prenatalBound) {
          btn._prenatalBound = true;
          btn.onclick = (e) => {
            e.preventDefault();
            openRegisterBirthModal(patient);
          };
        }
      });

      // Asegurar visibilidad de signos vitales prenatales esenciales
      const cardPrenatalVitals = document.getElementById('cardPrenatalVitalsOnly');
      if (cardPrenatalVitals) {
        cardPrenatalVitals.classList.remove('d-none');
        cardPrenatalVitals.style.removeProperty('display');
      }
    }

    // --- 2. DENTRO DE HISTORIAL Y EVOLUCIONES: SECCIÓN CARNET PRENATAL MINSAL & CONTROLES OBSTÉTRICOS ---
    if (historyTab) {
      renderPrenatalHistorySection(historyTab, patient, patient.pregnancyWeeks || 24);
    }

    // --- 3. DENTRO DE DOCUMENTOS Y RECETAS: SECCIÓN REGISTRO DE ECOGRAFÍAS Y EXÁMENES PRENATALES ---
    if (docsTab) {
      renderPrenatalDocumentsSection(docsTab, patient);
    }
  } else {
    if (cardGrowth) {
      cardGrowth.classList.add('d-none');
      cardGrowth.style.setProperty('display', 'none', 'important');
    }
    const existingPrenatalHist = targetContainer.querySelector ? (targetContainer.querySelector('#sectionCarnetPrenatalMinsal') || document.getElementById('sectionCarnetPrenatalMinsal')) : document.getElementById('sectionCarnetPrenatalMinsal');
    if (existingPrenatalHist) existingPrenatalHist.remove();
    const existingPrenatalDocs = targetContainer.querySelector ? (targetContainer.querySelector('#sectionEcografiasExamenesPrenatales') || document.getElementById('sectionEcografiasExamenesPrenatales')) : document.getElementById('sectionEcografiasExamenesPrenatales');
    if (existingPrenatalDocs) existingPrenatalDocs.remove();
  }

  // --- 4. SINCRONIZACIÓN REACTIVA DEL MÓDULO CARDIOVASCULAR ECG IoT (AD8232) ---
  syncCardiovascularModuleForActivePatient(targetContainer, patient);
}

// ============================================================================
// EVALUACIÓN CLÍNICA Y SINCRONIZACIÓN ECG IoT (AD8232)
// ============================================================================

/**
 * Evalúa si el paciente tiene indicación de telemetría y monitoreo cardiovascular
 * (Hipertensión, antecedentes cardíacos, arritmia, o pacientes crónicos Juan Díaz p1, Mendoza p3, Martínez p5, Castro p7)
 * Excluye explícitamente a pacientes pediátricos y adolescentes.
 * @param {object} paciente - Objeto paciente
 * @returns {boolean}
 */
export function hasCardiovascularMonitoring(paciente) {
  let p = paciente;
  if (!p) {
    if (typeof getActivePatient === 'function') {
      try { p = getActivePatient(); } catch (e) {}
    }
    if (!p && typeof activePatient !== 'undefined' && activePatient) {
      p = activePatient;
    }
  }
  if (!p && typeof document !== 'undefined') {
    const sel = document.getElementById('patientSelector');
    if (sel && sel.value && typeof PATIENTS_DATABASE !== 'undefined') {
      p = PATIENTS_DATABASE.find(item => item.id === sel.value) || null;
    }
  }
  if (!p) return false;

  // Si es pediátrico o adolescente, se excluye automáticamente
  const age = getDynamicPatientAge(p);
  if (p.isPediatric === true || p.isAdolescent === true || (age > 0 && age < 18)) {
    return false;
  }

  // 1. Evaluación por conditions (ej: ['HYPERTENSION', 'DIABETES'])
  if (Array.isArray(p.conditions)) {
    const hasCardio = p.conditions.some(c => {
      const str = String(typeof c === 'object' && c !== null ? (c.id || c.name || c.code || '') : c).toUpperCase();
      return str.includes('HYPERTENSION') || str.includes('HIPERTENSION') || str.includes('CARDIO') || str.includes('ARRITMIA') || str.includes('ECG');
    });
    if (hasCardio) return true;
  }

  // 2. Búsqueda por texto en campos clínicos descriptivos
  const textPool = [
    p.condicion,
    p.condition,
    p.diagnostico,
    p.diagnosis,
    p.clinicalCondition,
    p.medicalNotes,
    p.category,
    p.nombreCondicion
  ].filter(Boolean).join(' ').toLowerCase();

  const cardiacTerms = [
    'hipertens',
    'hypertens',
    'cardio',
    'cardíac',
    'cardiac',
    'arritmi',
    'coraz',
    'ecg',
    'presión alta',
    'presion alta',
    'ad8232'
  ];

  if (cardiacTerms.some(term => textPool.includes(term))) {
    return true;
  }

  // 3. Pacientes crónicos cardiovasculares demo del sistema (Juan Díaz p1, Carlos Mendoza p3, Luis Martínez p5, Roberto Castro p7)
  if (['p1', 'p3', 'p5', 'p7'].includes(p.id)) {
    return true;
  }

  return false;
}

/**
 * Renderiza e inyecta de forma reactiva el Monitor Electrocardiográfico Multiparámetro
 * dentro de la carpeta Control Diario y Signos (#tabContentCaregiverDaily)
 */
export function syncCardiovascularModuleForActivePatient(targetContainer = (typeof document !== 'undefined' ? document : null), patientObj = null) {
  if (!targetContainer || typeof document === 'undefined') return;

  let patient = patientObj;
  if (!patient && typeof getActivePatient === 'function') {
    try { patient = getActivePatient(); } catch (e) {}
  }
  if (!patient && typeof activePatient !== 'undefined' && activePatient) {
    patient = activePatient;
  }
  if (!patient) {
    const sel = document.getElementById('patientSelector');
    if (sel && sel.value && typeof PATIENTS_DATABASE !== 'undefined') {
      patient = PATIENTS_DATABASE.find(p => p.id === sel.value);
    }
  }
  if (!patient) return;

  const dailyTab = targetContainer.querySelector ? (targetContainer.querySelector('#tabContentCaregiverDaily') || document.getElementById('tabContentCaregiverDaily')) : document.getElementById('tabContentCaregiverDaily');
  if (!dailyTab) return;

  const needsCardio = hasCardiovascularMonitoring(patient);
  let cardCardio = dailyTab.querySelector('#cardCardioEcgPatient') || document.getElementById('cardCardioEcgPatient');

  if (needsCardio) {
    if (!cardCardio) {
      cardCardio = document.createElement('div');
      cardCardio.id = 'cardCardioEcgPatient';
      cardCardio.className = 'glass-card p-3 p-md-4 border-0 mb-4';
      cardCardio.style.cssText = 'background: linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(15, 23, 42, 0.95) 100%); border: 1.5px solid rgba(56, 189, 248, 0.35) !important; border-radius: 20px;';

      cardCardio.innerHTML = `
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <h4 class="glass-title m-0 d-flex align-items-center gap-2">
              <span class="text-white fw-bold">🫀 Telemetría Electrocardiográfica (IoT AD8232)</span>
            </h4>
            <small class="text-white-50" style="font-size: 0.8rem;">Monitoreo en tiempo real de ritmo cardíaco, derivaciones y sincronización clínica &bull; Ley N° 20.584 / DS N° 41</small>
          </div>
          <div>
            <span class="badge px-3 py-1.5 rounded-pill fw-bold d-inline-flex align-items-center gap-1.5" style="background: rgba(14, 165, 233, 0.2); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.45); font-size: 0.82rem;">
              <i class="bi bi-heart-pulse-fill text-danger"></i> Monitoreo Cardiovascular
            </span>
          </div>
        </div>

        <!-- Contenedor del Monitor Multiparámetro IoT -->
        <div id="ecgWidgetMountPoint" class="mb-3"></div>

        <!-- Listado compacto de trazados capturados y enviados -->
        <div id="ecgPatientHistoryWrap" class="p-3 rounded-4" style="background: rgba(5, 11, 16, 0.85); border: 1px solid #152738;">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <div class="d-flex align-items-center gap-2">
              <i class="bi bi-file-earmark-medical text-info"></i>
              <span class="text-white fw-bold font-monospace small">ÚLTIMOS TRAZADOS ECG TRANSMITIDOS AL MÉDICO</span>
            </div>
            <span class="badge bg-secondary bg-opacity-25 text-white-50 font-monospace" style="font-size: 0.68rem;" id="ecgRecordsCount">0 registros</span>
          </div>
          <div id="ecgRecordsListContainer"></div>
        </div>
      `;

      // Inyectar en #diaryForm o dailyTab justo antes de los signos vitales
      const form = dailyTab.querySelector('#diaryForm') || dailyTab;
      const prenatalCard = form.querySelector('#cardPrenatalGrowthCaregiver');
      const vitalsRow = form.querySelector('.row.g-4') || form.querySelector('.row');

      if (prenatalCard && prenatalCard.nextSibling) {
        form.insertBefore(cardCardio, prenatalCard.nextSibling);
      } else if (vitalsRow) {
        form.insertBefore(cardCardio, vitalsRow);
      } else if (form.firstChild) {
        form.insertBefore(cardCardio, form.firstChild);
      } else {
        form.appendChild(cardCardio);
      }

      // Escuchar eventos de captura dentro de cardCardio para actualizar la lista reactivamente
      cardCardio.addEventListener('click', (e) => {
        const btn = e.target && e.target.closest('button');
        if (btn && btn.textContent && btn.textContent.includes('Capturar')) {
          setTimeout(() => renderCompactEcgRecordsList(cardCardio, patient.id), 200);
          setTimeout(() => renderCompactEcgRecordsList(cardCardio, patient.id), 1200);
        }
      });
    }

    cardCardio.classList.remove('d-none');
    cardCardio.style.removeProperty('display');

    // Montar widget del monitor si no está montado
    const mountPoint = cardCardio.querySelector('#ecgWidgetMountPoint');
    if (mountPoint && !mountPoint._ecgWidgetMounted) {
      mountPoint._ecgWidgetMounted = true;
      mountIotEcgWidget(mountPoint, { patientId: patient.id, patientName: patient.socialName || patient.name });
    }

    // Renderizar listado compacto de trazados capturados
    renderCompactEcgRecordsList(cardCardio, patient.id);
  } else {
    // Si no requiere monitoreo cardiovascular (ej. gestante sin cardiopatía, pediátrico o adolescente)
    if (cardCardio) {
      cardCardio.classList.add('d-none');
      cardCardio.style.setProperty('display', 'none', 'important');
    }
  }
}

function renderCompactEcgRecordsList(cardCardio, patientId) {
  if (!cardCardio) return;
  const container = cardCardio.querySelector('#ecgRecordsListContainer');
  const countBadge = cardCardio.querySelector('#ecgRecordsCount');
  if (!container) return;

  const records = getPatientEcgRecords(patientId);
  if (countBadge) countBadge.textContent = `${records.length} registro${records.length === 1 ? '' : 's'}`;

  if (!records || records.length === 0) {
    container.innerHTML = `
      <div class="text-center py-2.5 text-white-50" style="font-size: 0.78rem;">
        <i class="bi bi-clock-history me-1.5 text-info"></i> No hay capturas registradas aún. Presiona <strong class="text-white">"📸 Capturar y Enviar Trazado ECG"</strong> en el monitor para sincronizar el primer registro con la ficha médica.
      </div>
    `;
    return;
  }

  const recent = records.slice(0, 4);
  const rowsHtml = recent.map(rec => {
    let rhythmColor = '#00ff9d';
    if (rec.estado === 'AMARILLO' || (rec.bpm && (rec.bpm > 100 || rec.bpm < 60))) rhythmColor = '#ffb703';
    if (rec.estado === 'ROJO' || String(rec.rhythm || '').toLowerCase().includes('arritmi')) rhythmColor = '#ff4d6d';

    return `
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 p-2 rounded-2 mb-1.5" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.07); font-size: 0.75rem;">
        <div class="d-flex align-items-center gap-2">
          <span class="badge font-monospace px-2 py-1" style="background: ${rhythmColor}1f; color: ${rhythmColor}; border: 1px solid ${rhythmColor}55;">
            ${rec.bpm ? `${rec.bpm} BPM` : '--'}
          </span>
          <div>
            <span class="text-white fw-bold d-block">${rec.rhythm || 'Ritmo Sinusal Normal'}</span>
            <small class="text-white-50 font-monospace" style="font-size: 0.68rem;">${rec.lead || 'DII'} &bull; RR: ${rec.intervals?.rr_ms || '--'}ms &bull; QRS: ${rec.intervals?.qrs_ms || '--'}ms &bull; QTc: ${rec.intervals?.qtc_ms || '--'}ms</small>
          </div>
        </div>

        <div class="d-flex align-items-center gap-2">
          <span class="badge rounded-pill px-2.5 py-1 d-inline-flex align-items-center" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.35); font-size: 0.7rem;">
            <i class="bi bi-cloud-check-fill me-1"></i>Sincronizado con Ficha Médica
          </span>
          <span class="text-white-50 font-monospace" style="font-size: 0.7rem;">
            ${rec.isoDate || ''} ${rec.time || ''}
          </span>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = rowsHtml;
}

export function renderPatientView(container) {
  if (!container) return;

  // 1. Completar datos de Mateo cuando sea demo (Mateo Morales, RUT 25.340.112-9, Edad 7 años, Tutora Camila Paz Vergara Fuentes)
  if (activePatient) {
    ensureMateoDemoData(activePatient);
  }

  // 2. Si el paciente no es demo, inicializar su ficha cuidapp_ficha_[RUT] vacía (0 exámenes, 0 citas, 0 signos vitales)
  if (activePatient && !isDemoPatient(activePatient)) {
    initNonDemoPatientFicha(activePatient);
  }

  // 3. Mantener exactamente intacto Mateo (7a) y cualquier menor < 14 años que entre directo
  if (activePatient) {
    const isUnderage = (typeof activePatient.age === 'number' && activePatient.age < 14) || activePatient.username === 'mateo';
    setIsPediatric(isUnderage);
  }

  // Si el paciente es menor de 14 años (o Mateo), mantener intacto en la vista pediátrica especializada
  if (isPediatric || (activePatient && ((typeof activePatient.age === 'number' && activePatient.age < 14) || activePatient.username === 'mateo'))) {
    return renderPediatricView(container, () => renderPatientView(container));
  }

  // Todos los demás perfiles de pacientes (Juan Díaz 76a, Camila 14a, Valentina 32a, Daniela 28a y nuevos >= 14a):
  // Renderizan la vista clínica unificada de 2 columnas con las 4 carpetas:
  // - Para Adulto Mayor (Juan Díaz, edad >= 60 / isSenior):
  //   Se elimina por completo el layout especial antiguo de Adulto Mayor para que pase exactamente
  //   por el mismo flujo visual limpio que ya tienen Valentina y Daniela:
  //   * 4 carpetas grandes niveladas en altura con la Ficha del Paciente (grid-cols-2 gap-4 h-full min-h-[195px]).
  //   * Al hacer clic en una carpeta (activeFolder !== null), se ocultan las 4 carpetas y se muestra únicamente el panel de la carpeta abierta con su barra superior ← Volver a Carpetas.
  //   * Al presionar ← Volver a Carpetas, vuelve a activeFolder = null mostrando de nuevo las 4 carpetas grandes.
  //   * Tablas y controles ajustados con w-full overflow-x-auto para no desbordar la Ficha del Paciente.
  // Desactivar y eliminar por completo el aumento/escalado de fuentes y modo senior para Adulto Mayor (Juan Díaz / edad >= 60)
  // para que Juan Díaz (y cualquier adulto mayor >= 60 años) use exactamente la misma estructura limpia,
  // tamaño de fuente y grilla de 4 carpetas grandes (min-h-[195px]) que ya funciona en los perfiles de Sofía Díaz y Valentina.
  const isSenior = false;

  if (typeof document !== 'undefined') {
    document.body.classList.remove('cuidapp-senior-mode');
    // Observer permanente en sesión de paciente para evitar que ningún evento reactive cuidapp-senior-mode
    if (!window._seniorModeObserverBound) {
      window._seniorModeObserverBound = true;
      const obs = new MutationObserver(() => {
        if (document.body.classList.contains('cuidapp-senior-mode')) {
          document.body.classList.remove('cuidapp-senior-mode');
        }
      });
      obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
  }
  modoVisualSimple = false;
  try {
    localStorage.removeItem('cuidapp_simple_visual_mode');
  } catch (e) {}

  const renderedView = renderEvaluationView(container);

  if (typeof document !== 'undefined') {
    document.body.classList.remove('cuidapp-senior-mode');

    // Aumentar únicamente el tamaño visual del emoji/ícono superior en las 4 tarjetas cuando el usuario autenticado sea Adulto Mayor (edad >= 60)
    const sidebarUserEl = document.querySelector('.sidebar footer strong, footer strong.text-white, #sidebarMenu footer strong');
    const loggedName = sidebarUserEl ? sidebarUserEl.textContent.trim() : '';
    const isCaregiverSession = Boolean(
      (loggedName && (loggedName.toLowerCase().includes('sofía') || loggedName.toLowerCase().includes('sofia'))) ||
      (loggedName && CAREGIVERS_DATABASE.some(c => c.name.toLowerCase() === loggedName.toLowerCase() || (c.username && c.username.toLowerCase() === loggedName.toLowerCase()))) ||
      (typeof window !== 'undefined' && window._currentRole === 'caregiver') ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('cuidapp_auth_role') === 'caregiver')
    );
    const isSeniorUser = !isCaregiverSession && activePatient && ((typeof activePatient.age === 'number' && activePatient.age >= 60) || activePatient.isSenior);

    let styleSeniorIcons = document.getElementById('styleSeniorFolderIcons');
    if (isSeniorUser) {
      if (!styleSeniorIcons) {
        styleSeniorIcons = document.createElement('style');
        styleSeniorIcons.id = 'styleSeniorFolderIcons';
        document.head.appendChild(styleSeniorIcons);
      }
      styleSeniorIcons.textContent = `
        #caregiverTabNav .folder-tab-card .folder-tab-icon,
        #caregiverTabNav .folder-tab-card > span:first-child,
        #tabBtnCaregiverDaily .folder-tab-icon,
        #tabBtnCaregiverHistory .folder-tab-icon,
        #tabBtnCaregiverDocs .folder-tab-icon,
        #tabBtnCaregiverVaccinesDental .folder-tab-icon {
          font-size: 3.75rem !important;
          transform: scale(1.45) !important;
          transform-origin: center !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          margin-bottom: 6px !important;
          line-height: 1 !important;
        }
        #caregiverTabNav .folder-tab-card svg,
        #caregiverTabNav .folder-tab-card img {
          width: 4rem !important;
          height: 4rem !important;
          transform: scale(1.45) !important;
          transform-origin: center !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          margin-bottom: 6px !important;
        }
      `;

      // Aplicar directamente al DOM de las 4 tarjetas detectando si es span, svg o img
      const folderCards = container.querySelectorAll('#tabBtnCaregiverDaily, #tabBtnCaregiverHistory, #tabBtnCaregiverDocs, #tabBtnCaregiverVaccinesDental, .caregiver-folder-grid .folder-tab-card');
      folderCards.forEach(card => {
        const iconEl = card.querySelector('.folder-tab-icon') || card.querySelector('svg, img, span:first-child');
        if (iconEl) {
          if (iconEl.tagName === 'SVG' || iconEl.tagName === 'IMG') {
            iconEl.style.setProperty('width', '4rem', 'important');
            iconEl.style.setProperty('height', '4rem', 'important');
            iconEl.style.setProperty('min-width', '4rem', 'important');
            iconEl.style.setProperty('min-height', '4rem', 'important');
          } else {
            iconEl.style.setProperty('font-size', '3.75rem', 'important');
          }
          iconEl.style.setProperty('transform', 'scale(1.45)', 'important');
          iconEl.style.setProperty('transform-origin', 'center', 'important');
          iconEl.style.setProperty('display', 'inline-flex', 'important');
          iconEl.style.setProperty('align-items', 'center', 'important');
          iconEl.style.setProperty('justify-content', 'center', 'important');
          iconEl.style.setProperty('margin-bottom', '6px', 'important');
          iconEl.style.setProperty('line-height', '1', 'important');
        }
      });
    } else {
      if (styleSeniorIcons) styleSeniorIcons.remove();
    }

    const folderNav = document.getElementById('caregiverTabNav');
    if (folderNav) {
      if (activeFolder !== null) {
        folderNav.classList.add('d-none');
        folderNav.style.setProperty('display', 'none', 'important');
      } else {
        folderNav.classList.remove('d-none');
        folderNav.style.removeProperty('display');
      }
    }

    // Sincronizar módulos clínicos prenatales y reglas dinámicas
    syncPrenatalModulesForActivePatient(container);
  }

  return renderedView;
}

// ============================================================================
// 2. MODO VISUAL SIMPLE / INCLUSIÓN UNIVERSAL (LEY N° 20.584)
// ============================================================================
function renderSimpleVisualView(container) {
  const patient = activePatient;
  if (!patient) return;

  const activePrescriptions = getPatientPrescriptions(patient.id).filter(r => r.status === 'activa');
  window._medTakenMap = window._medTakenMap || {};

  const hasPrescriptions = activePrescriptions.length > 0;
  const morningMed = hasPrescriptions ? (activePrescriptions.find(r => (r.schedule || '').toLowerCase().includes('mañana') || (r.schedule || '').toLowerCase().includes('8:') || (r.schedule || '').toLowerCase().includes('desayuno')) || activePrescriptions[0]) : null;
  const noonMed = hasPrescriptions ? (activePrescriptions.find(r => (r.schedule || '').toLowerCase().includes('mediodía') || (r.schedule || '').toLowerCase().includes('almuerzo') || (r.schedule || '').toLowerCase().includes('13:')) || (activePrescriptions.length > 1 ? activePrescriptions[1] : null)) : null;
  const nightMed = hasPrescriptions ? (activePrescriptions.find(r => (r.schedule || '').toLowerCase().includes('noche') || (r.schedule || '').toLowerCase().includes('21:') || (r.schedule || '').toLowerCase().includes('cena')) || (activePrescriptions.length > 2 ? activePrescriptions[2] : null)) : null;

  const isMorningTaken = morningMed ? !!window._medTakenMap[morningMed.id] : false;
  const isNoonTaken = noonMed ? !!window._medTakenMap[noonMed.id] : false;
  const isNightTaken = nightMed ? !!window._medTakenMap[nightMed.id] : false;

  container.innerHTML = `
    <div class="container-fluid px-3 px-md-4 py-4 text-white cuidapp-simple-mode">
      <!-- Barra Superior Accesible -->
      <div class="glass-card p-4 mb-4 text-white d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3" style="background: rgba(15, 23, 42, 0.96); border: 2.5px solid #38bdf8; border-radius: 26px;">
        <div>
          <h1 class="fw-extrabold m-0 text-white" style="font-size: 2.4rem;">¡Hola, ${patient.socialName || patient.name}! 👋</h1>
          <p class="text-warning m-0 mt-1 fw-bold fs-5"><i class="bi bi-eye-fill me-2"></i>Modo Visual Simple Activo (Iconos Grandes, Alto Contraste & Voz Ley N° 20.584)</p>
        </div>
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <button type="button" id="btnShowMedicalCardSimple" class="btn btn-success px-4 py-3 rounded-pill fw-bold text-white shadow-lg d-inline-flex align-items-center gap-2" style="font-size: 1.25rem; cursor: pointer;">
            <span>🏥</span> <span>Mostrar mi Ficha al Médico</span>
          </button>
          ${patient.age < 50 ? `
            <button type="button" id="btnExitSimpleVisualMode" class="btn btn-glass-secondary px-4 py-3 rounded-pill fw-bold text-white shadow-sm d-inline-flex align-items-center gap-2" style="font-size: 1.15rem; cursor: pointer;">
              <span>👁️</span> <span>Modo Normal</span>
            </button>
          ` : ''}
        </div>
      </div>

      <!-- 1. PASTILLERO ICONOGRÁFICO UNIVERSAL (3 BLOQUES O ESTADO VACÍO LIMPIO) -->
      <div class="glass-card p-4 p-md-5 mb-4" style="border-radius: 28px; border: 2.5px solid rgba(255,255,255,0.3); background: rgba(15, 23, 42, 0.95);">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4 border-bottom border-light border-opacity-20 pb-3">
          <div class="d-flex align-items-center gap-3">
            <span style="font-size: 3.8rem; line-height: 1;">💊</span>
            <div>
              <h2 class="fw-extrabold text-white m-0" style="font-size: 2.2rem;">Mis Remedios de Hoy (Pastillero Visual)</h2>
              <span class="text-white-50 fs-5">${hasPrescriptions ? 'Toca el botón verde grande después de tomarte cada dosis:' : 'Estado de prescripciones sincronizadas con tu médico:'}</span>
            </div>
          </div>
          <button type="button" id="btnSimpleIvrCall" class="btn btn-warning px-4 py-3 rounded-pill fw-bold text-dark shadow-lg d-inline-flex align-items-center gap-2" style="font-size: 1.2rem; cursor: pointer;">
            <span class="phone-ringing-icon fs-3">📞</span> <span>Simular Llamada Recordatorio (Teléfono Fijo/Básico)</span>
          </button>
        </div>

        ${!hasPrescriptions ? `
          <div class="p-5 text-center text-white-50 rounded-4" style="background: rgba(255,255,255,0.02); border: 2px dashed rgba(255,255,255,0.2);">
            <span style="font-size: 4rem;" class="d-block mb-2">💊</span>
            <h3 class="fw-bold text-white mb-2" style="font-size: 1.8rem;">Sin medicamentos indicados para hoy</h3>
            <p class="fs-5 text-white-50 m-0">No hay recetas activas registradas para este paciente. Tu médico tratante puede prescribir medicamentos desde el Portal Médico.</p>
          </div>
        ` : `
          <!-- Los 3 Bloques Visuales: 🌅 Mañana, ☀️ Mediodía, 🌙 Noche -->
          <div class="row g-4 mb-3">
            <!-- 🌅 Mañana -->
            <div class="col-12 col-lg-4">
              <div class="glass-card p-4 text-center h-100 d-flex flex-column justify-content-between" style="border-radius: 24px; background: rgba(245, 158, 11, 0.12); border: 2.5px solid #f59e0b;">
                <div>
                  <div style="font-size: 4.5rem; line-height: 1;" class="mb-2">🌅 💊</div>
                  <h3 class="fw-bold text-warning mb-1">Mañana</h3>
                  <span class="badge bg-warning text-dark px-3 py-1 fs-6 mb-3">Desayuno (8:00 AM)</span>
                  <div class="p-3 rounded-3 mb-3 text-white fw-bold fs-5" style="background: rgba(0,0,0,0.35);">
                    ${morningMed ? `${morningMed.medication} ${morningMed.dose}` : 'Sin medicamento en este horario'}
                  </div>
                </div>
                ${morningMed ? `
                  <div>
                    <button type="button" class="btn ${isMorningTaken ? 'btn-success' : 'btn-primary'} w-100 py-3 rounded-4 fw-bold shadow-lg d-flex align-items-center justify-content-center gap-2 btn-simple-take-med" data-rx-id="${morningMed.id}" data-med="${morningMed.medication}" style="font-size: 1.35rem; cursor: pointer;">
                      <span>${isMorningTaken ? '🎉' : '✅'}</span>
                      <span>${isMorningTaken ? '¡Ya la tomé!' : 'Ya la tomé'}</span>
                    </button>
                    <button type="button" class="btn btn-glass-secondary w-100 mt-2 py-2 text-white btn-read-dose" data-text="En la mañana con el desayuno debes tomar tu dosis de ${morningMed.medication} ${morningMed.dose}.">
                      <i class="bi bi-volume-up-fill me-1"></i> Escuchar dosis
                    </button>
                  </div>
                ` : ''}
              </div>
            </div>

            <!-- ☀️ Mediodía -->
            <div class="col-12 col-lg-4">
              <div class="glass-card p-4 text-center h-100 d-flex flex-column justify-content-between" style="border-radius: 24px; background: rgba(14, 165, 233, 0.12); border: 2.5px solid #38bdf8;">
                <div>
                  <div style="font-size: 4.5rem; line-height: 1;" class="mb-2">☀️ 🥗</div>
                  <h3 class="fw-bold text-info mb-1">Mediodía</h3>
                  <span class="badge bg-info text-white px-3 py-1 fs-6 mb-3">Almuerzo (13:00 PM)</span>
                  <div class="p-3 rounded-3 mb-3 text-white fw-bold fs-5" style="background: rgba(0,0,0,0.35);">
                    ${noonMed ? `${noonMed.medication} ${noonMed.dose}` : 'Control de Almuerzo & Hidratación'}
                  </div>
                </div>
                ${noonMed ? `
                  <div>
                    <button type="button" class="btn ${isNoonTaken ? 'btn-success' : 'btn-primary'} w-100 py-3 rounded-4 fw-bold shadow-lg d-flex align-items-center justify-content-center gap-2 btn-simple-take-med" data-rx-id="${noonMed.id}" data-med="${noonMed.medication}" style="font-size: 1.35rem; cursor: pointer;">
                      <span>${isNoonTaken ? '🎉' : '✅'}</span>
                      <span>${isNoonTaken ? '¡Listo!' : 'Ya la tomé'}</span>
                    </button>
                    <button type="button" class="btn btn-glass-secondary w-100 mt-2 py-2 text-white btn-read-dose" data-text="Al mediodía con tu almuerzo recuerda tomar tu dosis de ${noonMed.medication}.">
                      <i class="bi bi-volume-up-fill me-1"></i> Escuchar dosis
                    </button>
                  </div>
                ` : `
                  <button type="button" class="btn btn-glass-secondary w-100 py-3 rounded-4 text-white fs-6" disabled>
                    💧 Mantener Hidratación
                  </button>
                `}
              </div>
            </div>

            <!-- 🌙 Noche -->
            <div class="col-12 col-lg-4">
              <div class="glass-card p-4 text-center h-100 d-flex flex-column justify-content-between" style="border-radius: 24px; background: rgba(139, 92, 246, 0.12); border: 2.5px solid #a78bfa;">
                <div>
                  <div style="font-size: 4.5rem; line-height: 1;" class="mb-2">🌙 🛌</div>
                  <h3 class="fw-bold text-white mb-1">Noche</h3>
                  <span class="badge bg-secondary text-white px-3 py-1 fs-6 mb-3">Cena / Reposo (21:00 PM)</span>
                  <div class="p-3 rounded-3 mb-3 text-white fw-bold fs-5" style="background: rgba(0,0,0,0.35);">
                    ${nightMed ? `${nightMed.medication} ${nightMed.dose}` : 'Sin medicamento de noche'}
                  </div>
                </div>
                ${nightMed ? `
                  <div>
                    <button type="button" class="btn ${isNightTaken ? 'btn-success' : 'btn-primary'} w-100 py-3 rounded-4 fw-bold shadow-lg d-flex align-items-center justify-content-center gap-2 btn-simple-take-med" data-rx-id="${nightMed.id}" data-med="${nightMed.medication}" style="font-size: 1.35rem; cursor: pointer;">
                      <span>${isNightTaken ? '🎉' : '✅'}</span>
                      <span>${isNightTaken ? '¡Ya la tomé!' : 'Ya la tomé'}</span>
                    </button>
                    <button type="button" class="btn btn-glass-secondary w-100 mt-2 py-2 text-white btn-read-dose" data-text="En la noche antes de dormir debes tomar tu dosis de ${nightMed.medication}.">
                      <i class="bi bi-volume-up-fill me-1"></i> Escuchar dosis
                    </button>
                  </div>
                ` : `
                  <button type="button" class="btn btn-glass-secondary w-100 py-3 rounded-4 text-white fs-6" disabled>
                    🛌 Descanso Nocturno
                  </button>
                `}
              </div>
            </div>
          </div>
        `}
      </div>

      <!-- 2. ACCESOS DIRECTOS GIGANTES A LAS CARPETAS DEL PACIENTE -->
      <div class="row g-4 mb-4">
        <!-- Mis Exámenes e Informes -->
        <div class="col-12 col-md-4">
          <div role="button" id="btnSimpleGoExamenes" class="glass-card p-4 text-center h-100 d-flex flex-column justify-content-center align-items-center" style="border-radius: 24px; background: rgba(14, 165, 233, 0.12); border: 2.5px solid #38bdf8; cursor: pointer; transition: all 0.25s ease;">
            <span style="font-size: 4rem; line-height: 1;" class="mb-2">📁</span>
            <h3 class="fw-bold text-white mb-1" style="font-size: 1.7rem;">Mis Exámenes</h3>
            <span class="text-white-50 fs-6">Recetas, informes y escáner IA</span>
          </div>
        </div>

        <!-- Mi Presión y Corazón ECG -->
        <div class="col-12 col-md-4">
          <div role="button" id="btnSimpleGoPresion" class="glass-card p-4 text-center h-100 d-flex flex-column justify-content-center align-items-center" style="border-radius: 24px; background: rgba(239, 68, 68, 0.12); border: 2.5px solid #f87171; cursor: pointer; transition: all 0.25s ease;">
            <span style="font-size: 4rem; line-height: 1;" class="mb-2">❤️</span>
            <h3 class="fw-bold text-white mb-1" style="font-size: 1.7rem;">Presión y Corazón</h3>
            <span class="text-white-50 fs-6">Signos vitales y monitor ECG en vivo</span>
          </div>
        </div>

        <!-- Mi Ficha Dental -->
        <div class="col-12 col-md-4">
          <div role="button" id="btnSimpleGoDental" class="glass-card p-4 text-center h-100 d-flex flex-column justify-content-center align-items-center" style="border-radius: 24px; background: rgba(16, 185, 129, 0.12); border: 2.5px solid #34d399; cursor: pointer; transition: all 0.25s ease;">
            <span style="font-size: 4rem; line-height: 1;" class="mb-2">🦷</span>
            <h3 class="fw-bold text-white mb-1" style="font-size: 1.7rem;">Mi Ficha Dental</h3>
            <span class="text-white-50 fs-6">Odontograma y radiografías</span>
          </div>
        </div>
      </div>
      </div>

      <!-- 2. ¿CÓMO ME SIENTO HOY? (CERO-TEXTO) Y BOTÓN DE MICRÓFONO -->
      <div class="glass-card p-4 p-md-5 mb-4" style="border-radius: 28px; border: 2.5px solid rgba(255,255,255,0.3); background: rgba(15, 23, 42, 0.95);">
        <div class="d-flex align-items-center gap-3 mb-4 border-bottom border-light border-opacity-20 pb-3">
          <span style="font-size: 3.8rem; line-height: 1;">😃</span>
          <div>
            <h2 class="fw-extrabold text-white m-0" style="font-size: 2.2rem;">¿Cómo me siento hoy?</h2>
            <span class="text-white-50 fs-5">Toca la cara que muestre cómo te sientes ahora, o presiona el micrófono para hablar:</span>
          </div>
        </div>

        <!-- 3 Botones Gigantes de Expresión Facial -->
        <div class="row g-4 mb-4">
          <div class="col-4">
            <div role="button" class="simple-mood-btn mood-good w-100" id="simpleMoodGood">
              <div style="font-size: 5.5rem; line-height: 1;" class="mb-2">😊</div>
              <h3 class="fw-bold text-success m-0" style="font-size: 2rem;">Bien</h3>
            </div>
          </div>
          <div class="col-4">
            <div role="button" class="simple-mood-btn mood-neutral w-100" id="simpleMoodNeutral">
              <div style="font-size: 5.5rem; line-height: 1;" class="mb-2">😐</div>
              <h3 class="fw-bold text-warning m-0" style="font-size: 2rem;">Regular</h3>
            </div>
          </div>
          <div class="col-4">
            <div role="button" class="simple-mood-btn mood-bad w-100" id="simpleMoodBad">
              <div style="font-size: 5.5rem; line-height: 1;" class="mb-2">😟</div>
              <h3 class="fw-bold text-danger m-0" style="font-size: 2rem;">Mal</h3>
            </div>
          </div>
        </div>

        <!-- Botón de Micrófono Gigante: 🎤 Dictar con mi voz -->
        <div class="text-center pt-3 border-top border-light border-opacity-20">
          <button type="button" id="btnSimpleVoiceDictation" class="btn btn-warning px-5 py-3.5 rounded-pill fw-bold text-dark shadow-lg d-inline-flex align-items-center gap-3" style="font-size: 1.55rem; border: 3px solid #fef08a; cursor: pointer;">
            <span class="fs-2">🎤</span>
            <span>Dictar con mi voz</span>
          </button>
          <div id="simpleVoiceFeedback" class="mt-3 fs-5 d-none text-white"></div>
        </div>
      </div>

      <!-- 3. BOTÓN GIGANTE DE EMERGENCIA -->
      <div class="mb-4">
        <button type="button" id="btnSimpleAyudaUrgente" class="btn btn-danger w-100 py-4 rounded-5 fw-extrabold shadow-lg d-flex align-items-center justify-content-center gap-3" style="font-size: 2rem; background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); border: 3px solid #fca5a5; cursor: pointer;">
          <span style="font-size: 2.8rem;">🚨</span>
          <span>¡AYUDA URGENTE! (Llamar Cuidador / SAMU)</span>
        </button>
      </div>
    </div>
  `;

  // Listeners de la vista simple
  const btnShowMedicalCardSimple = document.getElementById('btnShowMedicalCardSimple');
  if (btnShowMedicalCardSimple) {
    btnShowMedicalCardSimple.onclick = openMedicalCredentialModal;
  }

  const btnExitSimple = document.getElementById('btnExitSimpleVisualMode');
  if (btnExitSimple) {
    btnExitSimple.onclick = () => {
      setModoVisualSimple(false);
      renderPatientView(container);
    };
  }

  const btnSimpleIvr = document.getElementById('btnSimpleIvrCall');
  if (btnSimpleIvr) {
    btnSimpleIvr.onclick = openIvrCallSimulationModal;
  }

  // Navegación a carpetas en modo simple
  const btnSimpleGoExamenes = document.getElementById('btnSimpleGoExamenes');
  if (btnSimpleGoExamenes) {
    btnSimpleGoExamenes.onclick = () => {
      if (modoVozActivo) speakText('Abriendo tu carpeta de exámenes e informes médicos.');
      patientSubTab = 'examenes';
      renderPatientView(container);
    };
  }

  const btnSimpleGoPresion = document.getElementById('btnSimpleGoPresion');
  if (btnSimpleGoPresion) {
    btnSimpleGoPresion.onclick = () => {
      if (modoVozActivo) speakText('Abriendo sección de presión arterial y monitor cardíaco.');
      patientSubTab = 'presion';
      renderPatientView(container);
    };
  }

  const btnSimpleGoDental = document.getElementById('btnSimpleGoDental');
  if (btnSimpleGoDental) {
    btnSimpleGoDental.onclick = () => {
      if (modoVozActivo) speakText('Abriendo tu ficha dental.');
      openDentalModuleModal(patient.id);
    };
  }

  container.querySelectorAll('.btn-simple-take-med').forEach(btn => {
    btn.onclick = () => {
      const rxId = btn.getAttribute('data-rx-id');
      const medName = btn.getAttribute('data-med');
      window._medTakenMap[rxId] = !window._medTakenMap[rxId];
      if (patientTempVitals) patientTempVitals.medication = true;

      if (window._medTakenMap[rxId]) {
        savePatientSelfLog(patient.id, `Dosis de ${medName} registrada como tomada en modo visual simple.`, 'normal', 'Bien');
        window.showGlassAlert(`🎉 ¡Excelente! Registraste la toma de ${medName}.`, 'success');
        speakText(`¡Muy bien! Has registrado que te tomaste tu dosis de ${medName}.`);
      } else {
        window.showGlassAlert(`Registro de ${medName} desmarcado.`, 'info');
      }
      renderPatientView(container);
    };
  });

  container.querySelectorAll('.btn-read-dose').forEach(btn => {
    btn.onclick = () => {
      const text = btn.getAttribute('data-text');
      speakText(text, { immediate: true, force: true });
    };
  });

  // Botones de Caras (Cero-Texto)
  const smGood = document.getElementById('simpleMoodGood');
  if (smGood) {
    smGood.onclick = () => {
      savePatientSelfLog(patient.id, 'Paciente reporta sentirse Bien.', 'normal', 'Bien');
      window.showGlassAlert('😊 ¡Qué bueno que te sientas bien hoy!', 'success');
      speakText('Nos alegra mucho que te sientas bien hoy.');
    };
  }

  const smNeutral = document.getElementById('simpleMoodNeutral');
  if (smNeutral) {
    smNeutral.onclick = () => {
      savePatientSelfLog(patient.id, 'Paciente reporta sentirse Regular.', 'normal', 'Regular');
      window.showGlassAlert('😐 Gracias por avisar. Recuerda descansar.', 'info');
      speakText('Entendido. Recuerda descansar un poco y tomar agua.');
    };
  }

  const smBad = document.getElementById('simpleMoodBad');
  if (smBad) {
    smBad.onclick = () => {
      savePatientSelfLog(patient.id, 'Paciente reporta sentirse Mal o cansado.', 'advertencia', 'Mal');
      window.showGlassAlert('😟 Alerta enviada a tu cuidador. Por favor descansa.', 'warning');
      speakText('Hemos registrado que no te sientes bien. Tu cuidadora ha sido informada.');
    };
  }

  const btnDictation = document.getElementById('btnSimpleVoiceDictation');
  if (btnDictation) {
    btnDictation.onclick = () => {
      handleVoiceDictationForPatient(document.getElementById('simpleVoiceFeedback'));
    };
  }

  const btnAyuda = document.getElementById('btnSimpleAyudaUrgente');
  if (btnAyuda) {
    btnAyuda.onclick = () => {
      window.showGlassAlert('🚨 Activando protocolo de emergencia...', 'danger');
      speakText('Activando llamada de emergencia a tu red de apoyo y al SAMU 131.');
      window.location.href = 'tel:131';
    };
  }
}

// ============================================================================
// ESCUCHA PERMANENTE DE EVENTOS Y OBSERVADOR DOM PARA MÓDULOS PRENATALES
// ============================================================================
if (typeof document !== 'undefined') {
  // 1. Delegación de clics: navegación de carpetas, cambio de pestañas, volver a carpetas y cambio de paciente
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!target) return;
    if (
      target.closest('#tabBtnCaregiverDaily') ||
      target.closest('#tabBtnCaregiverHistory') ||
      target.closest('#tabBtnCaregiverDocs') ||
      target.closest('#tabBtnCaregiverVaccinesDental') ||
      target.closest('.folder-tab-card') ||
      target.closest('.btn-back-to-folders') ||
      target.closest('#patientSelector') ||
      target.closest('#linkPatientClinical') ||
      target.closest('#linkPatientView')
    ) {
      setTimeout(() => {
        syncPrenatalModulesForActivePatient();
      }, 50);
      setTimeout(() => {
        syncPrenatalModulesForActivePatient();
      }, 200);
    }
  });

  // 2. Cambio en el selector de paciente
  document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'patientSelector') {
      setTimeout(() => {
        syncPrenatalModulesForActivePatient();
      }, 50);
      setTimeout(() => {
        syncPrenatalModulesForActivePatient();
      }, 250);
    }
  });

  // 3. MutationObserver para inyectar los módulos en el contenedor activo tan pronto como se renderice
  let prenatalSyncTimer = null;
  const prenatalObserver = new MutationObserver((mutations) => {
    let shouldSync = false;
    for (const m of mutations) {
      if (m.addedNodes && m.addedNodes.length > 0) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) {
            if (
              node.id === 'dashboard-content-area' ||
              node.id === 'tabContentCaregiverDaily' ||
              node.id === 'tabContentCaregiverHistory' ||
              node.id === 'tabContentCaregiverDocs' ||
              node.id === 'cardPrenatalGrowthCaregiver' ||
              node.id === 'cardCardioEcgPatient' ||
              (node.querySelector && (
                node.querySelector('#tabContentCaregiverDaily') ||
                node.querySelector('#tabContentCaregiverHistory') ||
                node.querySelector('#tabContentCaregiverDocs') ||
                node.querySelector('#cardPrenatalGrowthCaregiver') ||
                node.querySelector('#cardCardioEcgPatient')
              ))
            ) {
              shouldSync = true;
              break;
            }
          }
        }
      }
      if (shouldSync) break;
    }

    if (shouldSync) {
      if (prenatalSyncTimer) clearTimeout(prenatalSyncTimer);
      prenatalSyncTimer = setTimeout(() => {
        syncPrenatalModulesForActivePatient();
      }, 40);
    }
  });

  if (document.body) {
    prenatalObserver.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.body) {
        prenatalObserver.observe(document.body, { childList: true, subtree: true });
      }
      syncPrenatalModulesForActivePatient();
    });
  }

  // Sincronización inicial
  setTimeout(() => {
    syncPrenatalModulesForActivePatient();
  }, 100);
}
