/**
 * @fileoverview cuidApp - Orquestador Central y Núcleo de la Aplicación
 * @module src/main
 * @description Punto de entrada principal de cuidApp. Administra el enrutamiento reactivo
 * basado en roles (RBAC), ciclo de vida de sesión, autenticación, base de datos en memoria,
 * validación oficial de identidad chilena (RUT / Módulo 11) y accesibilidad por voz (Web Speech API).
 *
 * @compliance
 * - Ley N° 20.584: Derechos y Deberes del Paciente / Autonomía y Confidencialidad
 * - Ley N° 21.541: Regulación de Atención Médica por Telemedicina
 * - Ley N° 21.668: Interoperabilidad de Fichas Clínicas (HL7 FHIR / JSON)
 * - Ley N° 21.120: Identidad de Género y Uso Estricto de Nombre Social
 * - Ley N° 21.430: Protección Integral de la Niñez y Consentimiento de Tutores
 * - Decreto Supremo N° 41 MINSAL: Estándar y Trazabilidad de Ficha Clínica Electrónica
 */

import './style.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import {
  renderManagementView,
  renderCrudTable,
  showCrudForm,
  renderAdmin,
  managementSubTab,
  adminSubTab,
  setManagementSubTab,
  getManagementSubTab,
  editingItem,
  setEditingItem,
  auditLog,
  logAdminAction
} from './admin.js';
import { ThemeManager } from './utils/theme-manager.js';
import {
  renderEvaluationView,
  renderCaregiver,
  evaluateDateLock,
  updateActivePatient,
  bindDashboardEvents,
  bindCaregiverEvents,
  caregiverSubTab,
  setCaregiverSubTab,
  getCaregiverSubTab,
  openPatientNotificationsModal
} from './cuidador.js';
import { renderLogin, bindLoginEvents } from './auth.js';
import {
  renderPatientView,
  bindPatientEvents,
  patientSubTab,
  patientActiveSubTab,
  setPatientSubTab,
  getPatientSubTab,
  _lastSpokenSubTab,
  setLastSpokenSubTab,
  PATIENT_DOCUMENTS,
  getDocCategory
} from './paciente.js';
import {
  isPediatric,
  setIsPediatric,
  renderPediatricView
} from './pediatrico.js';
import { renderDoctorView } from './medico.js';

ThemeManager.init();

// Fallback implementation of window.showGlassAlert to replace the deleted GlassKit alert component
window.showGlassAlert = function (message, type = 'success') {
  const alertContainer = document.getElementById('glass-alerts-container') || (() => {
    const container = document.createElement('div');
    container.id = 'glass-alerts-container';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.zIndex = '9999';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    container.style.maxWidth = '350px';
    container.style.width = 'calc(100% - 40px)';
    document.body.appendChild(container);
    return container;
  })();

  const alert = document.createElement('div');
  alert.style.background = 'rgba(255, 255, 255, 0.08)';
  alert.style.backdropFilter = 'blur(12px)';
  alert.style.webkitBackdropFilter = 'blur(12px)';

  let iconClass = 'bi-info-circle';
  let borderColor = 'rgba(255, 255, 255, 0.2)';

  if (type === 'success') {
    borderColor = 'rgba(16, 185, 129, 0.4)';
    iconClass = 'bi-check-circle-fill text-success';
  } else if (type === 'danger' || type === 'error') {
    borderColor = 'rgba(239, 68, 68, 0.4)';
    iconClass = 'bi-exclamation-triangle-fill text-danger';
  } else if (type === 'warning') {
    borderColor = 'rgba(245, 158, 11, 0.4)';
    iconClass = 'bi-exclamation-circle-fill text-warning';
  } else if (type === 'info') {
    borderColor = 'rgba(6, 182, 212, 0.4)';
    iconClass = 'bi-info-circle-fill text-info';
  }

  alert.style.border = `1px solid ${borderColor}`;
  alert.style.borderRadius = '12px';
  alert.style.padding = '14px 18px';
  alert.style.color = '#fff';
  alert.style.boxShadow = '0 8px 32px 0 rgba(0, 0, 0, 0.3)';
  alert.style.display = 'flex';
  alert.style.alignItems = 'center';
  alert.style.gap = '12px';
  alert.style.transform = 'translateX(100%)';
  alert.style.opacity = '0';
  alert.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

  alert.innerHTML = `
    <i class="bi ${iconClass} fs-4"></i>
    <div style="flex-grow: 1; font-size: 0.9rem; font-weight: 500; line-height: 1.3;">${message}</div>
  `;

  alertContainer.appendChild(alert);

  setTimeout(() => {
    alert.style.transform = 'translateX(0)';
    alert.style.opacity = '1';
  }, 50);

  setTimeout(() => {
    alert.style.transform = 'translateX(120%)';
    alert.style.opacity = '0';
    setTimeout(() => {
      alert.remove();
    }, 400);
  }, 3000);
};

export class Condition {
  constructor(key, name, description) {
    this.key = key; // 'HYPERTENSION', 'DIABETES', 'EPOC', 'ERC', 'GENERAL'
    this.name = name;
    this.description = description;
  }
}

export class Patient {
  constructor(id, name, age, gender, weight, stature, bloodType, conditions, allergies, emergencyContact, fileNumber, username, password, socialName, pronouns, prevision, isAutonomous, birthDate, phone) {
    this.id = id;
    this.name = name;
    this.age = age;
    this.gender = gender; // 'Masculino' o 'Femenino'
    this.weight = weight; // Peso base en kg
    this.stature = stature; // Estatura en cm
    this.bloodType = bloodType; // Tipo de sangre (ej. 'O+')
    this.conditions = conditions || ['GENERAL']; // Array de keys de condiciones
    this.allergies = allergies || 'Ninguna'; // Alergias conocidas
    this.emergencyContact = emergencyContact; // { name, relation, phone }
    this.fileNumber = fileNumber; // RUT/DNI o Identificador
    this.rut = fileNumber || '';
    this.username = username || '';
    this.password = password || '';
    this.socialName = socialName || name;
    this.pronouns = pronouns || (gender === 'Femenino' ? 'Ella' : 'Él');
    this.prevision = prevision || 'FONASA Tramo B';
    this.isAutonomous = isAutonomous || false;
    this.birthDate = birthDate || '';
    this.phone = phone || '';
  }

  hasCondition(conditionKey) {
    return this.conditions.includes(conditionKey);
  }
}

export class Caregiver {
  constructor(id, name, email, assignedPatientId, username, password, rut, birthDate, phone) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.assignedPatientId = assignedPatientId; // Link a patient.id
    this.username = username;
    this.password = password;
    this.rut = rut || '15.782.110-3';
    this.birthDate = birthDate || '1985-04-18';
    this.phone = phone || '+56912345678';
  }
}

// Catálogo de Condiciones Clínicas
export const CLINICAL_CONDITIONS = {
  HYPERTENSION: new Condition('HYPERTENSION', 'Hipertensión Arterial', 'Monitoreo de presión, pulso, edemas y síntomas cardiovasculares.'),
  DIABETES: new Condition('DIABETES', 'Diabetes Mellitus', 'Control glucémico capilar por momentos, insulina y pie diabético.'),
  EPOC: new Condition('EPOC', 'EPOC o Asma', 'Evaluación de saturación SpO2, disnea de mMRC y secreciones.'),
  ERC: new Condition('ERC', 'Enfermedad Renal Crónica', 'Control riguroso de peso diario, diuresis y presión arterial.'),
  GENERAL: new Condition('GENERAL', 'Monitoreo de Bienestar', 'Control transversal de adherencia de medicamentos y dolor.')
};
export const CONDITIONS_CATALOG = CLINICAL_CONDITIONS;

// Base de datos en memoria (Pacientes y Cuidadores)
let PATIENTS_DATABASE = [
  new Patient('p1', 'Juan Díaz', 76, 'Masculino', 74, 168, 'A+', ['HYPERTENSION'], 'Penicilina', { name: 'Sofía Díaz', relation: 'Hija', phone: '+56912345678' }, '10.420.932-K', 'juan', 'juan123', 'Juan Díaz', 'Él', 'FONASA Tramo B', false, '1950-05-14', '+56912345678'),
  new Patient('p2', 'María Rodríguez', 68, 'Femenino', 65, 156, 'O+', ['DIABETES'], 'Ninguna', { name: 'Marcos Rodríguez', relation: 'Hijo', phone: '+56923456789' }, '12.194.883-2', 'maria', 'maria123', 'María Rodríguez', 'Ella', 'FONASA Tramo A', false, '1958-08-20', '+56923456789'),
  new Patient('p3', 'Carlos Mendoza', 82, 'Masculino', 80, 172, 'B-', ['HYPERTENSION', 'DIABETES'], 'Lactosa', { name: 'Laura Mendoza', relation: 'Esposa', phone: '+56934567890' }, '9.183.224-8', 'carlos', 'carlos123', 'Carlos Mendoza', 'Él', 'FONASA Tramo C', false, '1944-03-12', '+56934567890'),
  new Patient('p4', 'Ana Gómez', 59, 'Femenino', 70, 160, 'A-', ['EPOC'], 'Polvo, Sulfa', { name: 'Pedro Gómez', relation: 'Hermano', phone: '+56945678901' }, '15.024.118-5', 'ana', 'ana123', 'Ana Gómez', 'Ella', 'ISAPRE Colmena', true, '1967-11-05', '+56945678901'),
  new Patient('p5', 'Luis Martínez', 71, 'Masculino', 85, 175, 'O-', ['ERC', 'HYPERTENSION'], 'Ninguna', { name: 'Clara Martínez', relation: 'Hija', phone: '+56956789012' }, '11.109.845-6', 'luis', 'luis123', 'Luis Martínez', 'Él', 'FONASA Tramo D', false, '1955-09-18', '+56956789012'),
  new Patient('p6', 'Elena Vázquez', 65, 'Femenino', 68, 162, 'AB+', ['EPOC', 'ERC'], 'Dipirona', { name: 'Miguel Vázquez', relation: 'Hijo', phone: '+56967890123' }, '13.281.402-K', 'elena', 'elena123', 'Elena Vázquez', 'Ella', 'FONASA Tramo B', false, '1961-04-25', '+56967890123'),
  new Patient('p7', 'Roberto Castro', 79, 'Masculino', 78, 170, 'O+', ['HYPERTENSION', 'DIABETES', 'EPOC', 'ERC'], 'Ninguna', { name: 'Sandra Castro', relation: 'Hija', phone: '+56978901234' }, '8.032.554-1', 'roberto', 'roberto123', 'Roberto Castro', 'Él', 'FONASA Tramo A', false, '1947-12-30', '+56978901234'),
  
  // Pediátrico: Mateo Morales (7 años)
  new Patient('p_mateo', 'Mateo Morales', 7, 'Masculino', 24, 122, 'O+', ['GENERAL'], 'Ninguna', { name: 'Camila Paz Vergara Fuentes', relation: 'Tutora Legal', phone: '+56 9 8765 4321' }, '25.340.112-9', 'mateo', 'mateo123', 'Mateo Morales', 'Él', 'FONASA Tramo A', true, '2019-03-22', '+56 9 8765 4321'),
  
  // Perfil Demo: Adolescente (14 años) - Camila Soto (Ley 20.584 / Ficha CLAP)
  new Patient('p_camila', 'Camila Soto Miranda', 14, 'Femenino', 49, 158, 'A+', ['GENERAL'], 'Ninguna', { name: 'Patricia Miranda', relation: 'Madre (Tutora Acreditada)', phone: '+56987654321' }, '24.118.902-5', 'camila', '1234', 'Camila Soto', 'Ella', 'FONASA Tramo B', false, '2012-05-18', '+56987654321'),
  
  // Perfil Demo: Adulto Joven (32 años) - Valentina Rojas (Madre con hijo a cargo)
  new Patient('p_valentina', 'Valentina Rojas Valenzuela', 32, 'Femenino', 60, 165, 'A+', ['GENERAL'], 'Polen', { name: 'Felipe Rojas', relation: 'Hermano', phone: '+56976543211' }, '18.940.322-4', 'valentina', '1234', 'Valentina Rojas', 'Ella', 'ISAPRE Consalud', true, '1994-08-14', '+56976543210'),
  
  // Hijo a cargo de Valentina: Lucas Rojas (5 años, Pediátrico Ley 21.430)
  new Patient('p_lucas', 'Lucas Rojas Valenzuela', 5, 'Masculino', 19, 110, 'A+', ['GENERAL'], 'Ninguna', { name: 'Valentina Rojas', relation: 'Madre (Tutora Legal Acreditada)', phone: '+56976543210' }, '26.110.450-8', 'lucas', '1234', 'Lucas Rojas', 'Él', 'ISAPRE Consalud', false, '2021-04-10', '+56976543210'),
  
  // Perfil Demo: Gestante / Embarazada (28 años) - Daniela Morales (24 semanas activo)
  new Patient('p_daniela', 'Daniela Morales Castro', 28, 'Femenino', 66, 162, 'O+', ['GENERAL'], 'Ninguna', { name: 'Rodrigo Morales', relation: 'Pareja', phone: '+56965432109' }, '19.450.812-3', 'daniela', '1234', 'Daniela Morales', 'Ella', 'FONASA Tramo A', true, '1998-02-20', '+56965432109')
];

// Metadatos de perfiles predeterminados
const pMateo = PATIENTS_DATABASE.find(p => p.id === 'p_mateo');
if (pMateo) {
  pMateo.name = 'Mateo Morales';
  pMateo.socialName = 'Mateo Morales';
  pMateo.rut = '25.340.112-9';
  pMateo.fileNumber = '25.340.112-9';
  pMateo.age = 7;
  pMateo.isPediatric = true;
  pMateo.legalGuardianName = 'Camila Paz Vergara Fuentes';
  pMateo.legalGuardianRut = '16.890.432-1';
  pMateo.legalGuardianRelation = 'Tutora Legal';
  pMateo.emergencyContact = { name: 'Camila Paz Vergara Fuentes', relation: 'Tutora Legal', phone: '+56 9 8765 4321' };
}
const pCamila = PATIENTS_DATABASE.find(p => p.id === 'p_camila');
if (pCamila) {
  pCamila.rut = '24.118.902-5';
  pCamila.age = 14;
  pCamila.isPediatric = true;
  pCamila.isAdolescent = true;
  pCamila.schoolVaccines = ['VPH (2da dosis)', 'dTpa'];
  pCamila.clapRecord = true;
  pCamila.legalGuardianName = 'Patricia Miranda';
  pCamila.legalGuardianRut = '14.280.912-3';
}

const pValentina = PATIENTS_DATABASE.find(p => p.id === 'p_valentina');
if (pValentina) {
  pValentina.rut = '18.940.322-4';
  pValentina.age = 32;
  pValentina.isPediatric = false;
  pValentina.children = ['p_lucas'];
}

const pLucas = PATIENTS_DATABASE.find(p => p.id === 'p_lucas');
if (pLucas) {
  pLucas.rut = '26.110.450-8';
  pLucas.age = 5;
  pLucas.isPediatric = true;
  pLucas.legalGuardianName = 'Valentina Rojas';
  pLucas.legalGuardianRut = '18.940.322-4';
  pLucas.legalGuardianRelation = 'Madre (Tutora Legal Acreditada)';
}

const pDaniela = PATIENTS_DATABASE.find(p => p.id === 'p_daniela');
if (pDaniela) {
  pDaniela.rut = '19.450.812-3';
  pDaniela.age = 28;
  pDaniela.isPregnant = true;
  pDaniela.pregnancyWeeks = 24;
  pDaniela.gestationalWeeks = 24;
  const furDate = new Date(Date.now() - 24 * 7 * 86400000).toISOString().split('T')[0];
  const fppDate = new Date(new Date(furDate).getTime() + 280 * 86400000).toISOString().split('T')[0];
  pDaniela.fur = furDate;
  pDaniela.fpp = fppDate;

  try {
    const existingDanPreg = localStorage.getItem('cuidapp_pregnancy_p_daniela');
    if (!existingDanPreg) {
      const initialDanPreg = {
        isActive: true,
        fur: furDate,
        fpp: fppDate,
        gestationalWeeks: 24,
        gestas: 1,
        partos: 0,
        cesareas: 0,
        abortos: 0,
        bloodType: 'O+',
        protocol: 'Chile Crece Contigo (MINSAL)',
        recordedBy: 'Dra. Elena Valdés',
        prenatalControls: [
          { week: 10, date: new Date(Date.now() - 14 * 7 * 86400000).toISOString().split('T')[0], notes: 'Ingreso precoz MINSAL, ecografía 11-14 sem normal' },
          { week: 16, date: new Date(Date.now() - 8 * 7 * 86400000).toISOString().split('T')[0], notes: 'Control nutricional y tamizaje glucemia normal' },
          { week: 22, date: new Date(Date.now() - 2 * 7 * 86400000).toISOString().split('T')[0], notes: 'Ecografía morfológica de 2do trimestre normal' }
        ],
        supplements: ['Ácido Fólico', 'Sulfato Ferroso']
      };
      localStorage.setItem('cuidapp_pregnancy_p_daniela', JSON.stringify(initialDanPreg));
    }
  } catch (e) {}
}

// Cargar pacientes dinámicos persistidos y fusionar con PATIENTS_DATABASE
try {
  const customPatientsRaw = localStorage.getItem('cuidapp_custom_patients');
  if (customPatientsRaw) {
    const customList = JSON.parse(customPatientsRaw);
    if (Array.isArray(customList)) {
      customList.forEach(cp => {
        const existingIdx = PATIENTS_DATABASE.findIndex(p => p.id === cp.id || (p.username && p.username.toLowerCase() === (cp.username || '').toLowerCase()));
        if (existingIdx >= 0) {
          Object.assign(PATIENTS_DATABASE[existingIdx], cp);
        } else {
          const pat = new Patient(
            cp.id, cp.name, cp.age, cp.gender || cp.bioSex, cp.weight || 70, cp.stature || 165, cp.bloodType || 'O+',
            cp.conditions || [], cp.allergies || 'Ninguna', cp.emergencyContact || { name: cp.name, phone: cp.phone || '' },
            cp.fileNumber || cp.rut, cp.username, cp.password, cp.socialName || cp.name, cp.pronouns || 'Él',
            cp.prevision || 'FONASA Tramo B', cp.isAutonomous !== undefined ? cp.isAutonomous : true,
            cp.birthDate || '', cp.phone || ''
          );
          Object.assign(pat, cp);
          PATIENTS_DATABASE.push(pat);
        }
      });
    }
  }
} catch (e) {
  console.warn('Error al cargar cuidapp_custom_patients:', e);
}

let CAREGIVERS_DATABASE = [
  new Caregiver('c1', 'Sofía Díaz', 'sofia@cuidapp.com', 'p1', 'sofia', 'sofia123', '15.782.110-3', '1985-04-18', '+56912345678'),
  new Caregiver('c2', 'Marcos Rodríguez', 'marcos@cuidapp.com', 'p2', 'marcos', 'marcos123', '14.890.123-5', '1982-09-10', '+56923456789'),
  new Caregiver('c3', 'Laura Mendoza', 'laura@cuidapp.com', 'p3', 'laura', 'laura123', '13.456.789-1', '1980-12-03', '+56934567890')
];

// Cargar cuidadores dinámicos persistidos
try {
  const customCaregiversRaw = localStorage.getItem('cuidapp_custom_caregivers');
  if (customCaregiversRaw) {
    const list = JSON.parse(customCaregiversRaw);
    if (Array.isArray(list)) {
      list.forEach(cg => {
        if (!CAREGIVERS_DATABASE.some(c => c.id === cg.id || c.username === cg.username)) {
          CAREGIVERS_DATABASE.push(new Caregiver(cg.id, cg.name, cg.email, cg.assignedPatientId, cg.username, cg.password, cg.rut, cg.birthDate, cg.phone));
        }
      });
    }
  }
} catch (e) {}

// Cargar sobreescrituras de contraseñas de usuarios recuperadas en el login
try {
  const overridesRaw = localStorage.getItem('cuidapp_password_overrides');
  if (overridesRaw) {
    const overrides = JSON.parse(overridesRaw);
    PATIENTS_DATABASE.forEach(p => {
      if (overrides[p.username]) p.password = overrides[p.username];
    });
    CAREGIVERS_DATABASE.forEach(c => {
      if (overrides[c.username]) c.password = overrides[c.username];
    });
  }
} catch (e) {}

// Sincronización y registro de nuevo paciente (Ley 19.628 y Ley 20.584)
export function registerPatientInDatabase(patient) {
  const existingIdx = PATIENTS_DATABASE.findIndex(p => p.id === patient.id || p.username === patient.username);
  if (existingIdx >= 0) {
    PATIENTS_DATABASE[existingIdx] = patient;
  } else {
    PATIENTS_DATABASE.unshift(patient);
  }

  // Persistir en cuidapp_custom_patients
  try {
    const raw = localStorage.getItem('cuidapp_custom_patients');
    const list = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex(p => p.id === patient.id || p.username === patient.username);
    if (idx >= 0) {
      list[idx] = patient;
    } else {
      list.unshift(patient);
    }
    localStorage.setItem('cuidapp_custom_patients', JSON.stringify(list));
  } catch (e) {
    console.error('Error al guardar en cuidapp_custom_patients:', e);
  }

  // Persistir en cuidapp_custom_users
  try {
    const rawUsers = localStorage.getItem('cuidapp_custom_users');
    const userList = rawUsers ? JSON.parse(rawUsers) : [];
    const userEntry = {
      id: patient.id,
      username: patient.username,
      password: patient.password,
      role: 'patient',
      name: patient.name,
      socialName: patient.socialName,
      rut: patient.fileNumber,
      birthDate: patient.birthDate,
      age: patient.age,
      isPediatric: patient.isPediatric,
      createdAt: new Date().toISOString()
    };
    const uIdx = userList.findIndex(u => u.username === patient.username || u.rut === patient.fileNumber);
    if (uIdx >= 0) {
      userList[uIdx] = userEntry;
    } else {
      userList.unshift(userEntry);
    }
    localStorage.setItem('cuidapp_custom_users', JSON.stringify(userList));
  } catch (e) {
    console.error('Error al guardar en cuidapp_custom_users:', e);
  }

  return patient;
}

// Funciones de utilidad para RUT y Validación Chilena
export function cleanRut(rut) {
  return typeof rut === 'string' ? rut.replace(/[^0-9kK]/g, '').toUpperCase() : '';
}

export function formatRut(rut) {
  const cleaned = cleanRut(rut);
  if (cleaned.length < 2) return cleaned;
  const dv = cleaned.slice(-1);
  const body = cleaned.slice(0, -1);
  
  let formattedBody = '';
  let count = 0;
  for (let i = body.length - 1; i >= 0; i--) {
    formattedBody = body[i] + formattedBody;
    count++;
    if (count % 3 === 0 && i > 0) {
      formattedBody = '.' + formattedBody;
    }
  }
  return `${formattedBody}-${dv}`;
}

export function validateChileanRut(rut) {
  const cleaned = cleanRut(rut);
  if (cleaned.length < 8 || cleaned.length > 9) return false;
  
  const dv = cleaned.slice(-1);
  const body = cleaned.slice(0, -1);
  if (!/^\d+$/.test(body)) return false;
  
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  
  const expectedDvNum = 11 - (sum % 11);
  let expectedDv = '';
  if (expectedDvNum === 11) expectedDv = '0';
  else if (expectedDvNum === 10) expectedDv = 'K';
  else expectedDv = String(expectedDvNum);
  
  return dv === expectedDv;
}

export function calculateAge(birthDateStr) {
  if (!birthDateStr) return 0;
  const today = new Date();
  const birthDate = new Date(birthDateStr + 'T00:00:00');
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

// Actualización segura de contraseña para cualquier usuario del sistema
export function updateUserPasswordInSystem(identifier, newPassword) {
  let overrides = {};
  try {
    const raw = localStorage.getItem('cuidapp_password_overrides');
    if (raw) overrides = JSON.parse(raw);
  } catch (e) {}

  const cleanedSearch = cleanRut(identifier);

  // 1. Buscar en pacientes
  const patient = PATIENTS_DATABASE.find(p => 
    (p.username && p.username.toLowerCase() === identifier.toLowerCase()) ||
    (p.fileNumber && cleanRut(p.fileNumber) === cleanedSearch)
  );

  if (patient) {
    patient.password = newPassword;
    overrides[patient.username] = newPassword;
    try {
      localStorage.setItem('cuidapp_password_overrides', JSON.stringify(overrides));
    } catch (e) {}

    // Actualizar en cuidapp_custom_patients
    try {
      const raw = localStorage.getItem('cuidapp_custom_patients');
      if (raw) {
        const list = JSON.parse(raw);
        const item = list.find(p => p.id === patient.id || p.username === patient.username);
        if (item) {
          item.password = newPassword;
          localStorage.setItem('cuidapp_custom_patients', JSON.stringify(list));
        }
      }
    } catch (e) {}

    // Actualizar en cuidapp_custom_users
    try {
      const rawUsers = localStorage.getItem('cuidapp_custom_users');
      if (rawUsers) {
        const userList = JSON.parse(rawUsers);
        const u = userList.find(x => x.username === patient.username || cleanRut(x.rut) === cleanedSearch);
        if (u) {
          u.password = newPassword;
          localStorage.setItem('cuidapp_custom_users', JSON.stringify(userList));
        }
      }
    } catch (e) {}

    return { success: true, role: 'patient', user: patient };
  }

  // 2. Buscar en cuidadores
  const caregiver = CAREGIVERS_DATABASE.find(c => 
    (c.username && c.username.toLowerCase() === identifier.toLowerCase()) ||
    (c.rut && cleanRut(c.rut) === cleanedSearch) ||
    (c.username === 'sofia' && cleanedSearch === cleanRut('15.782.110-3'))
  );

  if (caregiver) {
    caregiver.password = newPassword;
    overrides[caregiver.username] = newPassword;
    try {
      localStorage.setItem('cuidapp_password_overrides', JSON.stringify(overrides));
    } catch (e) {}
    return { success: true, role: 'caregiver', user: caregiver };
  }

  // 3. Administrador o Médico
  if (identifier.toLowerCase() === 'admin' || cleanedSearch === cleanRut('9.876.543-2')) {
    overrides['admin'] = newPassword;
    try {
      localStorage.setItem('cuidapp_password_overrides', JSON.stringify(overrides));
    } catch (e) {}
    return { success: true, role: 'admin', user: { name: 'Administrador', username: 'admin' } };
  }

  if (identifier.toLowerCase() === 'doctor' || cleanedSearch === cleanRut('12.842.910-7')) {
    overrides['doctor'] = newPassword;
    try {
      localStorage.setItem('cuidapp_password_overrides', JSON.stringify(overrides));
    } catch (e) {}
    return { success: true, role: 'doctor', user: { name: 'Dra. Elena Valdés', username: 'doctor' } };
  }

  return { success: false, message: 'Usuario no encontrado' };
}

// Estado global de la aplicación
let currentUser = 'admin';
let currentView = 'evaluation'; // 'evaluation' o 'management'
export let activePatient = PATIENTS_DATABASE[0];
export function getActivePatient() { return activePatient; }
export function setActivePatient(patient) { activePatient = patient; }
export let modoVozActivo = false; // Modo Asistido por Voz para el paciente
export function setModoVozActivo(val) { modoVozActivo = val; }
export function getModoVozActivo() { return modoVozActivo; }
let _speechDebounceTimer = null;
let _lastSpokenText = '';
let _lastSpokenTime = 0;
export let debeSaludarAlIngresar = false; // Solo se activa al ingresar desde el login al Dashboard
export function setDebeSaludarAlIngresar(val) { debeSaludarAlIngresar = val; }

export { PATIENTS_DATABASE, CAREGIVERS_DATABASE };

export function handleLoginSuccess({ role, patient, caregiver }) {
  if (role === 'admin') {
    currentUser = 'admin';
    currentView = 'management';
    setTimeout(() => {
      renderDashboard('admin');
    }, 1500);
  } else if (role === 'patient') {
    currentUser = 'patient_' + patient.id;
    activePatient = patient;
    debeSaludarAlIngresar = true;

    // Calcular edad para el enrutamiento legal (Ley N° 21.430 / Ley N° 20.584)
    const patientAge = (typeof patient.age === 'number' && !isNaN(patient.age))
      ? patient.age
      : (patient.birthDate ? (new Date().getFullYear() - new Date(patient.birthDate).getFullYear()) : 70);

    // Enrutamiento Estricto: Mantener intacto Mateo (7a) y cualquier menor < 14 años que entre directo
    if (patientAge < 14 || patient.username === 'mateo') {
      currentView = 'patient_dashboard';
      setIsPediatric(true);
    } else {
      // Todos los demás perfiles (Cuidador, Juan 76a, Camila 14a, Valentina 32a, Daniela 28a y nuevos >= 14a):
      // Renderizan exactamente la vista clínica de 2 columnas del Cuidador
      currentView = 'evaluation';
      setIsPediatric(false);
    }

    setPatientSubTab('salud');

    // Preferencias de accesibilidad si es adulto mayor (≥ 60 años)
    if (patientAge >= 60) {
      setModoVozActivo(true);
      document.body.classList.add('cuidapp-senior-mode');
    } else {
      document.body.classList.remove('cuidapp-senior-mode');
    }

    setTimeout(() => {
      renderDashboard(patient.socialName || patient.name);
    }, 1500);
  } else if (role === 'caregiver') {
    currentUser = caregiver.name;
    const assigned = PATIENTS_DATABASE.find(p => p.id === caregiver.assignedPatientId);
    activePatient = assigned || PATIENTS_DATABASE[0];
    currentView = 'evaluation';
    setTimeout(() => {
      renderDashboard(caregiver.name);
    }, 1500);
  } else if (role === 'doctor') {
    currentUser = 'Dra. Elena Valdés';
    currentView = 'doctor';
    setTimeout(() => {
      renderDashboard('Dra. Elena Valdés');
    }, 1500);
  }
}

export function speakText(text, options = {}) {
  if (!text) return;
  if (!modoVozActivo && !options.force) return;
  if (!('speechSynthesis' in window)) return;

  const now = Date.now();
  if (text === _lastSpokenText && (now - _lastSpokenTime) < 2000 && !options.immediate) {
    return;
  }

  const executeSpeech = () => {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-CL';
      utterance.rate = 1.0;
      _lastSpokenText = text;
      _lastSpokenTime = Date.now();
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  };

  if (options.debounceMs) {
    clearTimeout(_speechDebounceTimer);
    _speechDebounceTimer = setTimeout(executeSpeech, options.debounceMs);
  } else {
    clearTimeout(_speechDebounceTimer);
    executeSpeech();
  }
}

// Utilidad para asociar guía por voz anticipatoria (hover/focus) y activa (click)
export function attachVoiceGuidance(target, hoverText, clickText) {
  const el = typeof target === 'string' ? document.getElementById(target) || document.querySelector(target) : target;
  if (!el) return;

  if (hoverText) {
    el.addEventListener('mouseenter', () => {
      if (modoVozActivo) {
        speakText(hoverText, { debounceMs: 180 });
      }
    });
    el.addEventListener('focus', () => {
      if (modoVozActivo) {
        speakText(hoverText, { debounceMs: 120 });
      }
    });
  }

  if (clickText) {
    el.addEventListener('click', () => {
      if (modoVozActivo) {
        speakText(clickText, { immediate: true });
      }
    });
  }
}

// --- UTILERÍAS ---
export function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// --- RENDERIZADO DE PANTALLAS ---

function renderDashboard(user) {
  document.querySelector('#app').innerHTML = `
    <div id="ambient-orb"></div>
    <div class="d-flex" style="min-height: 100vh;">
      
      <!-- Sidebar de GlassKit -->
      <nav class="sidebar d-flex flex-column" id="sidebarMenu" style="background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(15px); border-right: 1px solid rgba(255, 255, 255, 0.08); z-index: 1000;">
        <header class="d-flex justify-content-between align-items-center p-3 border-bottom border-light border-opacity-25" style="height: 70px;" id="sidebarHeader">
          <div class="sidebar-logo-container d-flex align-items-center">
            <i class="bi bi-heart-pulse-fill text-white fs-4 me-2" id="sidebarLogoIcon"></i>
            <div class="sidebar-logo-text">
              <h4 class="fw-bold m-0 text-white" style="font-size: 1.2rem; letter-spacing: 1px;">cuidApp</h4>
            </div>
          </div>
          <button id="sidebarToggleBtn" class="nav-toggle-btn toggle-sidebar-btn d-none d-lg-flex" aria-label="Toggle Sidebar" type="button">
            <div class="hamburger-lines">
              <span class="line line1"></span>
              <span class="line line2"></span>
              <span class="line line3"></span>
            </div>
          </button>
        </header>

        <div class="pt-3 flex-grow-1">
          <div class="px-3 d-flex flex-column gap-1">
            ${currentUser.startsWith('patient_') ? `
            ${(isPediatric || (activePatient && ((typeof activePatient.age === 'number' && activePatient.age < 14) || activePatient.username === 'mateo'))) ? `
            <a href="#" class="nav-link ${currentView === 'patient_dashboard' && patientSubTab === 'salud' ? 'active' : ''}" id="linkPatientView">
              <i class="bi bi-heart-pulse-fill me-3"></i> <span class="sidebar-text-full">Mi Portal Pediátrico</span>
            </a>
            ` : `
            <a href="#" class="nav-link ${currentView === 'evaluation' ? 'active' : ''}" id="linkPatientClinical">
              <i class="bi bi-file-earmark-medical-fill me-3 text-info"></i> <span class="sidebar-text-full">Mi Ficha Clínica</span>
            </a>
            `}
            <a href="#" class="nav-link" id="linkPatientNotifications">
              <i class="bi bi-bell-fill me-3 text-warning"></i> <span class="sidebar-text-full">🔔 Mis Notificaciones</span>
            </a>
            ` : currentView === 'doctor' ? `
            <a href="#" class="nav-link active" id="linkDoctorView">
              <i class="bi bi-hospital me-3 text-info"></i> <span class="sidebar-text-full">Portal Clínico Médico</span>
            </a>
            <a href="#" class="nav-link" id="linkDoctorNotifications">
              <i class="bi bi-bell-fill me-3 text-warning"></i> <span class="sidebar-text-full">🔔 Mis Notificaciones</span>
            </a>
            ` : `
            <a href="#" class="nav-link ${currentView === 'evaluation' ? 'active' : ''}" id="linkEvaluation">
              <i class="bi bi-pencil-square me-3"></i> <span class="sidebar-text-full">Evaluación Diaria</span>
            </a>
            <a href="#" class="nav-link" id="linkCaregiverNotifications">
              <i class="bi bi-bell-fill me-3 text-warning"></i> <span class="sidebar-text-full">🔔 Mis Notificaciones</span>
            </a>
            ${user === 'admin' ? `
            <a href="#" class="nav-link ${currentView === 'management' ? 'active' : ''}" id="linkManagement">
              <i class="bi bi-shield-lock-fill me-3 text-warning"></i> <span class="sidebar-text-full">Administración Integral</span>
            </a>
            ` : ''}
            `}
          </div>
        </div>

        <div class="mt-auto my-3 border-top border-light border-opacity-25"></div>
        <footer class="mb-4 text-center px-3 pt-2">
          <small class="text-white text-opacity-50 d-block mb-3 sidebar-text-full">
            Usuario: <strong class="text-white">${user}</strong>
          </small>
          <button id="btnLogout" class="btn-glass-danger btn-sm w-100 py-2 border-0 d-flex align-items-center justify-content-center" style="cursor: pointer; border-radius: 12px;">
            <i class="bi bi-box-arrow-left"></i><span class="sidebar-text-full ms-2">Cerrar Sesión</span>
          </button>
        </footer>
      </nav>

      <!-- Área de Contenido Principal -->
      <main class="main-content flex-grow-1 w-100" style="min-height: 100vh;">
        <!-- Top Navbar (Visible solo en Móviles) -->
        <nav id="main-navbar" class="glass-nav mb-4 p-3 px-4 d-flex justify-content-between align-items-center d-lg-none" role="banner">
          <div class="nav-brand d-flex align-items-center gap-2">
            <i class="bi bi-heart-pulse-fill text-white fs-5"></i>
            <span class="fw-bold text-white fs-6" style="letter-spacing: 1px;">cuidApp</span>
          </div>
          <button class="nav-toggle-btn toggle-sidebar-btn" aria-label="Toggle Sidebar" id="mobileSidebarToggle" type="button">
            <div class="hamburger-lines">
              <span class="line line1"></span>
              <span class="line line2"></span>
              <span class="line line3"></span>
            </div>
          </button>
        </nav>
        <div id="dashboard-content-area" class="pb-24"></div>
      </main>
    </div>
  `;

  // Registrar listeners del Sidebar
  const linkEvaluation = document.getElementById('linkEvaluation');
  if (linkEvaluation) {
    linkEvaluation.onclick = (e) => {
      e.preventDefault();
      currentView = 'evaluation';
      document.body.classList.remove('sidebar-mobile-open');
      renderView();
    };
  }

  const linkManagement = document.getElementById('linkManagement');
  if (linkManagement) {
    linkManagement.onclick = (e) => {
      e.preventDefault();
      currentView = 'management';
      document.body.classList.remove('sidebar-mobile-open');
      renderView();
    };
  }

  const linkPatientClinical = document.getElementById('linkPatientClinical');
  if (linkPatientClinical) {
    attachVoiceGuidance(linkPatientClinical, 'Mi Ficha Clínica. Monitoreo diario, signos vitales, recetas, vacunas y controles preventivos.');
    linkPatientClinical.onclick = (e) => {
      e.preventDefault();
      currentView = 'evaluation';
      document.body.classList.remove('sidebar-mobile-open');
      renderView();
    };
  }

  const linkPatientView = document.getElementById('linkPatientView');
  if (linkPatientView) {
    attachVoiceGuidance(linkPatientView, 'Mi Portal Pediátrico. Al hacer clic regresarás a tu portal infantil.');
    linkPatientView.onclick = (e) => {
      e.preventDefault();
      if (modoVozActivo) speakText('Regresando a tu pantalla principal...');
      setPatientSubTab('salud');
      currentView = 'patient_dashboard';
      document.body.classList.remove('sidebar-mobile-open');
      renderView();
    };
  }

  const handleOpenGlobalNotifications = (e) => {
    e.preventDefault();
    document.body.classList.remove('sidebar-mobile-open');
    if (modoVozActivo) speakText('Abriendo tus notificaciones y recordatorios...');
    openPatientNotificationsModal(activePatient);
  };

  const linkPatientNotifications = document.getElementById('linkPatientNotifications');
  if (linkPatientNotifications) {
    attachVoiceGuidance(linkPatientNotifications, 'Mis Notificaciones. Al hacer clic revisarás tus citas pendientes, vacunas, recordatorios de remedios y avisos clínicos.');
    linkPatientNotifications.onclick = handleOpenGlobalNotifications;
  }

  const linkCaregiverNotifications = document.getElementById('linkCaregiverNotifications');
  if (linkCaregiverNotifications) {
    linkCaregiverNotifications.onclick = handleOpenGlobalNotifications;
  }

  const linkDoctorNotifications = document.getElementById('linkDoctorNotifications');
  if (linkDoctorNotifications) {
    linkDoctorNotifications.onclick = handleOpenGlobalNotifications;
  }

  document.getElementById('btnLogout').onclick = () => {
    setLastSpokenSubTab(null);
    debeSaludarAlIngresar = false;
    document.body.classList.remove('sidebar-mobile-open');
    document.body.classList.remove('sidebar-collapsed');
    window.showGlassAlert('Cerrando sesión...', 'info');
    setTimeout(() => {
      renderLogin();
    }, 800);
  };

  // Toggle del Sidebar en Escritorio
  const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
  if (sidebarToggleBtn) {
    sidebarToggleBtn.onclick = () => {
      document.body.classList.toggle('sidebar-collapsed');
    };
  }

  // Toggle del Sidebar en Móvil
  const mobileSidebarToggle = document.getElementById('mobileSidebarToggle');
  if (mobileSidebarToggle) {
    mobileSidebarToggle.onclick = () => {
      document.body.classList.toggle('sidebar-mobile-open');
    };
  }



  // Scroll handler para cambiar opacidad del top navbar
  const glassNav = document.getElementById('main-navbar');
  window.onscroll = () => {
    if (glassNav) {
      if (window.scrollY > 10) {
        glassNav.classList.add('scrolled');
      } else {
        glassNav.classList.remove('scrolled');
      }
    }
  };

  renderView();
}

export function renderView() {
  const evalLink = document.getElementById('linkEvaluation');
  const clinicalLink = document.getElementById('linkPatientClinical');
  const manageLink = document.getElementById('linkManagement');
  if (evalLink && manageLink) {
    if (currentView === 'evaluation') {
      evalLink.classList.add('active');
      manageLink.classList.remove('active');
    } else {
      evalLink.classList.remove('active');
      manageLink.classList.add('active');
    }
  }
  if (clinicalLink) {
    clinicalLink.classList.toggle('active', currentView === 'evaluation');
  }

  const pView = document.getElementById('linkPatientView');
  const pNotif = document.getElementById('linkPatientNotifications');
  if (pView) {
    if (patientSubTab === 'notificaciones') {
      pView.classList.remove('active');
      if (pNotif) pNotif.classList.add('active');
    } else {
      pView.classList.add('active');
      if (pNotif) pNotif.classList.remove('active');
    }
  }

  const contentArea = document.getElementById('dashboard-content-area');
  if (!contentArea) return;

  if (currentView !== 'evaluation') {
    document.body.classList.remove('cuidapp-senior-mode');
    const seniorSpeechBtn = document.getElementById('btnFloatingSeniorSpeech');
    if (seniorSpeechBtn) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      seniorSpeechBtn.remove();
    }
  }

  const isPediatricActive = isPediatric || (activePatient && (
    (typeof activePatient.age === 'number' && activePatient.age < 14) ||
    activePatient.username === 'mateo'
  ));

  if (isPediatricActive && (currentView === 'patient_dashboard' || currentView === 'evaluation')) {
    currentView = 'patient_dashboard';
    setIsPediatric(true);
    renderPediatricView(contentArea, () => renderPediatricView(contentArea));
  } else if (currentView === 'evaluation') {
    renderEvaluationView(contentArea);
  } else if (currentView === 'management') {
    renderManagementView(contentArea);
  } else if (currentView === 'patient_dashboard') {
    renderPatientView(contentArea);
  } else if (currentView === 'doctor') {
    renderDoctorView(contentArea);
  }
}

// --- INITIALIZE CUSTOM SELECTS (GLASSKIT) ---
export function initCustomSelects() {
  if (typeof document === 'undefined') return;

  document.querySelectorAll('.form-select').forEach(select => {
    if (select.parentNode && select.parentNode.classList.contains('custom-select-wrapper')) return;

    select.style.display = 'none';

    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper position-relative';

    const trigger = document.createElement('div');
    trigger.className = 'form-select custom-select-trigger d-flex justify-content-between align-items-center';
    trigger.style.cursor = 'pointer';

    const triggerText = document.createElement('span');
    const selectedOption = select.options[select.selectedIndex];
    triggerText.textContent = selectedOption ? selectedOption.textContent : '';
    trigger.appendChild(triggerText);

    const arrow = document.createElement('i');
    arrow.className = 'bi bi-chevron-down ms-2 text-white';
    arrow.style.transition = 'transform 0.2s ease';
    trigger.appendChild(arrow);

    wrapper.appendChild(trigger);

    const dropdown = document.createElement('div');
    dropdown.className = 'custom-select-dropdown glass-card position-absolute w-100 mt-1 d-none p-2';
    dropdown.style.zIndex = '1050';

    Array.from(select.options).forEach((option, index) => {
      const item = document.createElement('div');
      item.className = 'custom-select-option px-3 py-2 rounded-2 mb-1';
      if (index === select.options.length - 1) {
        item.className = 'custom-select-option px-3 py-2 rounded-2';
      }
      item.textContent = option.textContent;

      if (index === select.selectedIndex) {
        item.classList.add('active');
      }

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        select.selectedIndex = index;
        select.dispatchEvent(new Event('change', { bubbles: true }));

        triggerText.textContent = option.textContent;

        dropdown.querySelectorAll('.custom-select-option').forEach((opt, idx) => {
          if (idx === index) {
            opt.classList.add('active');
          } else {
            opt.classList.remove('active');
          }
        });

        dropdown.classList.add('d-none');
        arrow.style.transform = 'rotate(0deg)';
      });

      dropdown.appendChild(item);
    });

    wrapper.appendChild(dropdown);

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !dropdown.classList.contains('d-none');
      document.querySelectorAll('.custom-select-dropdown').forEach(d => d.classList.add('d-none'));
      document.querySelectorAll('.custom-select-trigger i').forEach(a => a.style.transform = 'rotate(0deg)');

      if (!isOpen) {
        dropdown.classList.remove('d-none');
        arrow.style.transform = 'rotate(180deg)';
      }
    });

    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.custom-select-dropdown').forEach(d => d.classList.add('d-none'));
    document.querySelectorAll('.custom-select-trigger i').forEach(a => a.style.transform = 'rotate(0deg)');
  });
}

// --- SEGUIMIENTO DE MOUSE ---
let orbFrameId = null;
document.addEventListener('mousemove', function (e) {
  if (orbFrameId) cancelAnimationFrame(orbFrameId);
  orbFrameId = requestAnimationFrame(() => {
    const orb = document.getElementById('ambient-orb');
    if (orb) {
      orb.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
    }
  });
});


// Aplicar preferencia global de tema guardada antes del primer render
try {
  if (localStorage.getItem('cuidapp_theme') === 'light') {
    document.body.classList.add('cuidapp-theme-light');
  }
} catch (e) {}

renderLogin();
