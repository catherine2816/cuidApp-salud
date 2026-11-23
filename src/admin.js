/**
 * @fileoverview Panel de Administración, Trazabilidad y Gobernanza de Datos - cuidApp
 * @module src/admin.js
 * @description Gestión corporativa y supervisión técnica:
 * - Tablero de KPIs globales de salud poblacional y telemetría
 * - Auditoría estricta de accesos (quién, cuándo y desde qué rol leyó o modificó fichas)
 * - Gestión de usuarios, perfiles clínicos y vínculos cuidador-paciente autorizados
 * - Supervisión del subsistema de telemetría IoT y monitores hospitalarios
 *
 * @compliance
 * - Decreto Supremo N° 41 MINSAL: Libro de Auditoría y Trazabilidad Inalterable
 * - Ley N° 20.584: Sanción al acceso indebido a registros confidenciales
 * - Ley N° 19.628: Privacidad y protección de bases de datos sensibles
 */

import {
  activePatient,
  setActivePatient,
  PATIENTS_DATABASE,
  CAREGIVERS_DATABASE,
  Patient,
  Caregiver,
  CLINICAL_CONDITIONS,
  initCustomSelects,
  cleanRut,
  formatRut,
  validateChileanRut,
  calculateAge,
  updateUserPasswordInSystem,
  registerPatientInDatabase
} from './main.js';
import { getIotEcgState } from './iot-ecg.js';

// --- ESTADO GLOBAL DE ADMINISTRACIÓN ---
export let adminSubTab = 'kpis'; // 'kpis', 'users', 'links', 'audit'
export let managementSubTab = 'kpis';

export function setManagementSubTab(tab) {
  managementSubTab = tab;
  adminSubTab = tab;
}
export function setAdminSubTab(tab) {
  adminSubTab = tab;
  managementSubTab = tab;
}
export function getManagementSubTab() {
  return adminSubTab;
}

export let editingItem = null;
export function setEditingItem(item) {
  editingItem = item;
}

// Filtros locales
let usersFilterRole = 'all';
let usersFilterStatus = 'all';
let usersSearchQuery = '';

let auditFilterRole = 'all';
let auditFilterType = 'all';
let auditFilterPeriod = 'all';
let auditSearchQuery = '';

// --- SISTEMA DE AUDITORÍA DE TRAZABILIDAD INMUTABLE (DECRETO SUPREMO N° 41) ---
export const auditLog = [];

export function logAdminAction(action, details, operator = 'Administrador Central (Admin)', patientId = null) {
  const timestamp = new Date().toISOString();
  const entry = {
    id: 'adm_audit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    timestamp,
    date: timestamp.split('T')[0],
    operator,
    role: 'admin',
    action,
    details: typeof details === 'string' ? details : JSON.stringify(details),
    patientId: patientId || (details && details.patientId) || null,
    patientName: (details && details.patientName) || null,
    legalSeal: 'DS N° 41 / Ley 19.628 Auditoría de Trazabilidad',
    hash: 'DS41-' + Math.random().toString(36).substring(2, 10).toUpperCase()
  };

  auditLog.unshift(entry);

  try {
    const raw = localStorage.getItem('cuidapp_admin_audit_log');
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(entry);
    if (list.length > 200) list.pop();
    localStorage.setItem('cuidapp_admin_audit_log', JSON.stringify(list));
  } catch (e) {
    console.error('Error guardando en cuidapp_admin_audit_log:', e);
  }

  return entry;
}

// --- GESTIÓN DE ESTADO DE CUENTAS (ACTIVO / SUSPENDIDO) ---
export function getUserStatusMap() {
  try {
    const raw = localStorage.getItem('cuidapp_user_status');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function setUserStatus(identifier, status, reason = 'Acción administrativa') {
  try {
    const map = getUserStatusMap();
    map[identifier] = status;
    localStorage.setItem('cuidapp_user_status', JSON.stringify(map));

    logAdminAction(
      status === 'suspended' ? 'SUSPEND_USER_ACCESS' : 'ACTIVATE_USER_ACCESS',
      { identifier, status, reason },
      'Administrador Central'
    );
    return true;
  } catch (e) {
    console.error('Error actualizando estado de usuario:', e);
    return false;
  }
}

// --- RENDERIZADO DE ETIQUETAS DE ROL TRANSLÚCIDAS Y LEGIBLES CON EMOJI ---
export function getRoleBadgeHtml(role) {
  switch (role) {
    case 'doctor':
      return `<span class="badge-glass px-2.5 py-1 rounded-2 d-inline-flex align-items-center gap-1.5" style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); font-size: 0.74rem; color: #34d399 !important; font-weight: 500;">
        <span>🧑⚕️</span> <span>Médico Tratante</span>
      </span>`;
    case 'caregiver':
      return `<span class="badge-glass px-2.5 py-1 rounded-2 d-inline-flex align-items-center gap-1.5" style="background: rgba(6, 182, 212, 0.15); border: 1px solid rgba(6, 182, 212, 0.35); font-size: 0.74rem; color: #38bdf8 !important; font-weight: 500;">
        <span>🤝</span> <span>Cuidador/a</span>
      </span>`;
    case 'admin':
      return `<span class="badge-glass px-2.5 py-1 rounded-2 d-inline-flex align-items-center gap-1.5" style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.35); font-size: 0.74rem; color: #fbbf24 !important; font-weight: 500;">
        <span>🛡️</span> <span>Administrador</span>
      </span>`;
    case 'patient':
    default:
      return `<span class="badge-glass px-2.5 py-1 rounded-2 d-inline-flex align-items-center gap-1.5" style="background: rgba(14, 165, 233, 0.15); border: 1px solid rgba(14, 165, 233, 0.35); font-size: 0.74rem; color: #7dd3fc !important; font-weight: 500;">
        <span>👤</span> <span>Paciente</span>
      </span>`;
  }
}

// --- FORMATO LIMPIO DE EDAD / CICLO VITAL CON EMOJI ---
export function getLifecycleDisplayHtml(user) {
  const ageDisplay = user.age ? `${user.age} años` : '—';

  // Médicos, Cuidadores y Administradores: texto sutil institucional
  if (user.role === 'doctor') {
    return `
      <div class="fw-semibold text-white">${ageDisplay}</div>
      <small class="text-white text-opacity-50 d-block mt-0.5" style="font-size: 0.72rem;">Personal Clínico</small>
    `;
  }
  if (user.role === 'caregiver') {
    return `
      <div class="fw-semibold text-white">${ageDisplay}</div>
      <small class="text-white text-opacity-50 d-block mt-0.5" style="font-size: 0.72rem;">Equipo Asistencial</small>
    `;
  }
  if (user.role === 'admin') {
    return `
      <div class="fw-semibold text-white">${ageDisplay}</div>
      <small class="text-white text-opacity-50 d-block mt-0.5" style="font-size: 0.72rem;">Administración Central</small>
    `;
  }

  // Pacientes: texto limpio con emoji sin recortar palabras
  const age = typeof user.age === 'number' ? user.age : (user.birthDate ? calculateAge(user.birthDate) : 0);
  
  let label = '🧑 Adulto';
  if (user.lifecycle?.stage === 'gestante' || user.isPregnant) {
    label = '🤰 Gestante';
  } else if (age >= 60 || user.lifecycle?.stage === 'adulto_mayor') {
    label = '👴 Adulto Mayor';
  } else if (age >= 10 && age < 18) {
    label = '🧑🎓 Adolescente (Ley 21.430)';
  } else if (age < 10 || user.isPediatric) {
    label = '🧒 Pediátrico';
  } else {
    label = '🧑 Adulto';
  }

  return `
    <div class="fw-semibold text-white">${ageDisplay}</div>
    <div class="text-white text-opacity-85 small mt-0.5" style="font-size: 0.74rem; white-space: nowrap;">${label}</div>
  `;
}

// --- DETERMINACIÓN DE CICLO VITAL SEGÚN MINSAL & LEY 21.430 ---
export function getPatientLifecycleStage(patient) {
  // 1. Gestante activa (Chile Crece Contigo)
  if (patient.isPregnant || patient.pregnancyWeeks) {
    return {
      stage: 'gestante',
      label: 'Gestante (Chile Crece Contigo)',
      icon: 'bi-balloon-heart-fill',
      badgeClass: 'bg-danger bg-opacity-25 text-danger border-danger'
    };
  }
  try {
    const rawPregnancy = localStorage.getItem(`cuidapp_pregnancy_${patient.id}`);
    if (rawPregnancy) {
      const preg = JSON.parse(rawPregnancy);
      if (preg && preg.active !== false) {
        return {
          stage: 'gestante',
          label: 'Gestante (Chile Crece Contigo)',
          icon: 'bi-balloon-heart-fill',
          badgeClass: 'bg-danger bg-opacity-25 text-danger border-danger'
        };
      }
    }
  } catch (e) {}

  const age = typeof patient.age === 'number' ? patient.age : (patient.birthDate ? calculateAge(patient.birthDate) : 0);

  if (age >= 10 && age < 18) {
    return {
      stage: 'adolescente',
      label: 'Adolescente (Ley 21.430)',
      icon: 'bi-person-badge',
      badgeClass: 'bg-primary bg-opacity-25 text-primary border-primary'
    };
  } else if (age < 10 || patient.isPediatric) {
    return {
      stage: 'pediatrico',
      label: 'Pediátrico (< 10 años)',
      icon: 'bi-balloon-fill',
      badgeClass: 'bg-info bg-opacity-25 text-info border-info'
    };
  } else if (age >= 60) {
    return {
      stage: 'adulto_mayor',
      label: 'Adulto Mayor (≥ 60 años)',
      icon: 'bi-person-heart',
      badgeClass: 'bg-warning bg-opacity-25 text-warning border-warning'
    };
  } else {
    return {
      stage: 'adulto',
      label: 'Adulto (18–59 años)',
      icon: 'bi-person',
      badgeClass: 'bg-secondary bg-opacity-25 text-light border-secondary'
    };
  }
}

// --- CONSOLIDACIÓN UNIFICADA DE USUARIOS DEL SISTEMA ---
export function getAllSystemUsers() {
  const statusMap = getUserStatusMap();
  const users = [];

  // 1. Pacientes (Memoria + cuidapp_custom_patients)
  PATIENTS_DATABASE.forEach(p => {
    const lifecycle = getPatientLifecycleStage(p);
    const username = p.username || `paciente_${p.id}`;
    const status = statusMap[username] || statusMap[cleanRut(p.fileNumber)] || 'active';
    users.push({
      id: p.id,
      key: 'pat_' + p.id,
      username,
      name: p.name,
      socialName: p.socialName || p.name,
      pronouns: p.pronouns || 'Él/Ella',
      rut: p.fileNumber || 'Sin RUT',
      age: p.age,
      birthDate: p.birthDate || '',
      gender: p.gender || 'No especificado',
      prevision: p.prevision || 'FONASA',
      bloodType: p.bloodType || 'No informado',
      allergies: p.allergies || 'Ninguna',
      conditions: p.conditions || [],
      phone: p.phone || (p.emergencyContact?.phone || 'No registrado'),
      emergencyContact: p.emergencyContact || null,
      tutorLegal: (p.age < 18 || p.isPediatric) ? (p.emergencyContact || { name: 'Tutor Acreditado', relation: 'Representante Legal', phone: '+56912345678' }) : null,
      role: 'patient',
      roleLabel: 'Paciente',
      roleBadge: 'bg-primary text-primary',
      roleIcon: 'bi-person-fill',
      lifecycle,
      status,
      rawObject: p
    });
  });

  // 2. Cuidadores Acreditados
  CAREGIVERS_DATABASE.forEach(c => {
    const username = c.username || `cuidador_${c.id}`;
    const status = statusMap[username] || 'active';
    const assignedPatient = PATIENTS_DATABASE.find(p => p.id === c.assignedPatientId);
    users.push({
      id: c.id,
      key: 'cg_' + c.id,
      username,
      name: c.name,
      socialName: c.name,
      pronouns: 'Ella/Él',
      rut: c.rut || '15.782.110-3',
      age: c.birthDate ? calculateAge(c.birthDate) : 38,
      birthDate: c.birthDate || '1986-04-18',
      gender: 'Femenino',
      prevision: 'FONASA',
      bloodType: 'O+',
      allergies: 'Ninguna',
      conditions: [],
      phone: c.phone || '+56912345678',
      email: c.email || 'cuidadora@cuidapp.com',
      assignedPatientName: assignedPatient ? assignedPatient.name : 'Sin asignación fija',
      assignedPatientId: c.assignedPatientId,
      role: 'caregiver',
      roleLabel: 'Cuidador/a Acreditada',
      roleBadge: 'bg-info text-info',
      roleIcon: 'bi-person-heart',
      lifecycle: { stage: 'adulto', label: 'Adulto (Cuidador Profesional)', badgeClass: 'bg-info text-info' },
      status,
      rawObject: c
    });
  });

  // 3. Médico Tratante Oficial
  const doctorStatus = statusMap['doctor'] || statusMap[cleanRut('12.842.910-7')] || 'active';
  users.push({
    id: 'med_elena',
    key: 'med_elena',
    username: 'doctor',
    name: 'Dra. Elena Valdés',
    socialName: 'Dra. Elena Valdés',
    pronouns: 'Ella',
    rut: '12.842.910-7',
    age: 46,
    birthDate: '1979-06-14',
    gender: 'Femenino',
    prevision: 'ISAPRE Banmédica',
    bloodType: 'A+',
    allergies: 'Ninguna',
    conditions: [],
    phone: '+56994829100',
    email: 'dra.valdes@cuidapp.salud.cl',
    specialty: 'Medicina Familiar y Telemedicina (Reg. SIS N° 482910)',
    role: 'doctor',
    roleLabel: 'Médico Tratante',
    roleBadge: 'bg-success text-success',
    roleIcon: 'bi-hospital-fill',
    lifecycle: { stage: 'adulto', label: 'Médico Tratante Acreditada', badgeClass: 'bg-success text-success' },
    status: doctorStatus,
    rawObject: null
  });

  // 4. Administrador Central
  const adminStatus = statusMap['admin'] || 'active';
  users.push({
    id: 'admin_root',
    key: 'admin_root',
    username: 'admin',
    name: 'Administrador Central cuidApp',
    socialName: 'Administrador Central',
    pronouns: 'Él/Ella',
    rut: '9.876.543-2',
    age: 42,
    birthDate: '1982-11-20',
    gender: 'Masculino',
    prevision: 'FONASA Tramo D',
    bloodType: 'O+',
    allergies: 'Ninguna',
    conditions: [],
    phone: '+56980009900',
    email: 'admin@cuidapp.salud.gob.cl',
    role: 'admin',
    roleLabel: 'Administrador del Sistema',
    roleBadge: 'bg-warning text-warning',
    roleIcon: 'bi-shield-lock-fill',
    lifecycle: { stage: 'adulto', label: 'Seguridad y Privacidad', badgeClass: 'bg-warning text-warning' },
    status: adminStatus,
    rawObject: null
  });

  // 5. Cargar usuarios adicionales desde cuidapp_custom_users si no existen ya
  try {
    const rawCustom = localStorage.getItem('cuidapp_custom_users');
    if (rawCustom) {
      const list = JSON.parse(rawCustom);
      list.forEach(cu => {
        if (!users.some(u => (cu.username && u.username === cu.username) || (cu.rut && cleanRut(u.rut) === cleanRut(cu.rut)) || (cu.id && u.id === cu.id))) {
          const status = statusMap[cu.username] || 'active';
          users.push({
            id: cu.id || 'usr_' + Date.now(),
            key: 'usr_' + (cu.username || cu.id),
            username: cu.username || `usuario_${cu.id}`,
            name: cu.name || cu.username || 'Usuario',
            socialName: cu.socialName || cu.name || cu.username || 'Usuario',
            pronouns: cu.pronouns || 'No especificado',
            rut: cu.rut || cu.fileNumber || 'Sin RUT',
            age: cu.age || (cu.birthDate ? calculateAge(cu.birthDate) : 30),
            birthDate: cu.birthDate || '',
            gender: cu.gender || 'No especificado',
            prevision: cu.prevision || 'FONASA',
            bloodType: cu.bloodType || 'O+',
            allergies: cu.allergies || 'Ninguna',
            conditions: cu.conditions || [],
            phone: cu.phone || 'No registrado',
            email: cu.email || `${cu.username || 'usuario'}@cuidapp.com`,
            role: cu.role || 'patient',
            roleLabel: cu.role === 'caregiver' ? 'Cuidador/a' : cu.role === 'doctor' ? 'Médico' : cu.role === 'admin' ? 'Administrador' : 'Paciente',
            roleBadge: cu.role === 'doctor' ? 'bg-success text-success' : cu.role === 'caregiver' ? 'bg-info text-info' : cu.role === 'admin' ? 'bg-warning text-warning' : 'bg-primary text-primary',
            roleIcon: cu.role === 'doctor' ? 'bi-hospital' : cu.role === 'caregiver' ? 'bi-person-heart' : cu.role === 'admin' ? 'bi-shield-lock' : 'bi-person',
            lifecycle: (cu.role === 'patient' || !cu.role) ? getPatientLifecycleStage(cu) : { stage: 'adulto', label: 'Usuario Registrado', badgeClass: 'bg-secondary text-secondary' },
            status,
            rawObject: cu
          });
        }
      });
    }
  } catch (e) {}

  // 6. Sincronizar todos los pacientes y personas a cargo creados en localStorage (cuidapp_custom_patients)
  try {
    const rawCustPat = localStorage.getItem('cuidapp_custom_patients');
    if (rawCustPat) {
      const patList = JSON.parse(rawCustPat);
      if (Array.isArray(patList)) {
        patList.forEach(cp => {
          const uname = cp.username || `paciente_${cp.id}`;
          if (!users.some(u => u.id === cp.id || (cp.username && u.username === cp.username) || (cp.rut && cleanRut(u.rut) === cleanRut(cp.rut)))) {
            const status = statusMap[uname] || 'active';
            users.push({
              id: cp.id,
              key: 'pat_' + cp.id,
              username: uname,
              name: cp.name || uname,
              socialName: cp.socialName || cp.name || uname,
              pronouns: cp.pronouns || 'Él/Ella',
              rut: cp.fileNumber || cp.rut || 'Sin RUT',
              age: cp.age || (cp.birthDate ? calculateAge(cp.birthDate) : 30),
              birthDate: cp.birthDate || '',
              gender: cp.gender || 'No especificado',
              prevision: cp.prevision || 'FONASA',
              bloodType: cp.bloodType || 'O+',
              allergies: cp.allergies || 'Ninguna',
              conditions: cp.conditions || [],
              phone: cp.phone || (cp.emergencyContact?.phone || 'No registrado'),
              emergencyContact: cp.emergencyContact || null,
              tutorLegal: (cp.age < 18 || cp.isPediatric) ? (cp.emergencyContact || { name: cp.legalGuardianName || 'Tutor Acreditado', relation: 'Representante Legal', phone: cp.phone || '+56912345678' }) : null,
              role: 'patient',
              roleLabel: 'Paciente',
              roleBadge: 'bg-primary text-primary',
              roleIcon: 'bi-person-fill',
              lifecycle: getPatientLifecycleStage(cp),
              status,
              rawObject: cp
            });
          }
        });
      }
    }
  } catch (e) {}

  return users;
}

// --- GESTIÓN DE VÍNCULOS LEGALES (LEY 20.584, LEY 19.628, LEY 21.430) ---
export function getCaregiverAssignments() {
  try {
    const raw = localStorage.getItem('cuidapp_caregiver_assignments');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}

  // Semilla base formalizada según Ley 20.584
  const defaultAssignments = [
    {
      id: 'asgn_01',
      caregiverId: 'c1',
      caregiverUsername: 'sofia',
      caregiverName: 'Sofía Díaz',
      caregiverRut: '15.782.110-3',
      patientId: 'p1',
      patientName: 'Juan Díaz',
      patientRut: '10.420.932-K',
      legalBasis: 'Consentimiento Informado Escrito (Ley N° 20.584 / Mandato Familiar)',
      scope: 'Acceso Integral a Bitácora, Signos Vitales y Adherencia Farmacológica',
      assignedDate: '2026-01-15T09:00:00Z',
      status: 'activo'
    },
    {
      id: 'asgn_02',
      caregiverId: 'c2',
      caregiverUsername: 'marcos',
      caregiverName: 'Marcos Rodríguez',
      caregiverRut: '14.890.123-5',
      patientId: 'p2',
      patientName: 'María Rodríguez',
      patientRut: '12.194.883-2',
      legalBasis: 'Poder Notarial de Cuidados de Salud (Ley N° 20.584 Art. 10)',
      scope: 'Monitoreo Diario y Asistencia Metabólica',
      assignedDate: '2026-02-01T10:30:00Z',
      status: 'activo'
    },
    {
      id: 'asgn_03',
      caregiverId: 'c3',
      caregiverUsername: 'laura',
      caregiverName: 'Laura Mendoza',
      caregiverRut: '13.456.789-1',
      patientId: 'p3',
      patientName: 'Carlos Mendoza',
      patientRut: '9.183.224-8',
      legalBasis: 'Designación de Cónyuge / Cuidadora Acreditada',
      scope: 'Control Cardiovascular y Administración Medicamentosa',
      assignedDate: '2026-02-10T14:15:00Z',
      status: 'activo'
    }
  ];

  try {
    localStorage.setItem('cuidapp_caregiver_assignments', JSON.stringify(defaultAssignments));
  } catch (e) {}

  return defaultAssignments;
}

export function saveCaregiverAssignment(assignment) {
  const assignments = getCaregiverAssignments();
  const existingIdx = assignments.findIndex(a => a.id === assignment.id);
  if (existingIdx >= 0) {
    assignments[existingIdx] = assignment;
  } else {
    assignments.unshift(assignment);
  }
  localStorage.setItem('cuidapp_caregiver_assignments', JSON.stringify(assignments));

  logAdminAction(
    'ASSIGN_CAREGIVER_LEGAL_LINK',
    {
      assignmentId: assignment.id,
      caregiver: assignment.caregiverName,
      patient: assignment.patientName,
      legalBasis: assignment.legalBasis,
      status: assignment.status
    },
    'Administrador Central',
    assignment.patientId
  );
  return assignments;
}

export function revokeCaregiverAssignment(assignmentId, reason = 'Revocación por solicitud de paciente/tutor o fin de contrato') {
  const assignments = getCaregiverAssignments();
  const target = assignments.find(a => a.id === assignmentId);
  if (target) {
    target.status = 'revocado';
    target.revokedAt = new Date().toISOString();
    target.revokedReason = reason;
    localStorage.setItem('cuidapp_caregiver_assignments', JSON.stringify(assignments));

    logAdminAction(
      'REVOKE_CAREGIVER_LEGAL_LINK',
      {
        assignmentId,
        caregiver: target.caregiverName,
        patient: target.patientName,
        reason
      },
      'Administrador Central',
      target.patientId
    );
    return true;
  }
  return false;
}

// --- CONSOLIDACIÓN DE REGISTROS DE TRAZABILIDAD CLÍNICA (DS N° 41) ---
export function getConsolidatedAuditLogs() {
  const consolidated = [];

  // 1. Logs de Cuidadores (cuidapp_clinical_logs_*)
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('cuidapp_clinical_logs_')) {
      const patientId = key.replace('cuidapp_clinical_logs_', '');
      const patient = PATIENTS_DATABASE.find(p => p.id === patientId);
      try {
        const logs = JSON.parse(localStorage.getItem(key));
        if (Array.isArray(logs)) {
          logs.forEach(log => {
            consolidated.push({
              id: log.id || 'log_' + Math.random().toString(36).substr(2, 6),
              timestamp: log.timestamp || new Date().toISOString(),
              eventType: 'CLINICAL_LOG',
              eventCategory: 'Evaluación Diaria Cuidadora',
              badgeClass: 'bg-primary bg-opacity-25 text-primary border-primary',
              icon: 'bi-pencil-square',
              operator: log.recordedBy || 'Sofía Díaz (Cuidadora Autorizada)',
              role: 'cuidador',
              roleLabel: 'Cuidadora Acreditada',
              patientId: patientId,
              patientName: log.patientName || (patient ? patient.name : 'Paciente ' + patientId),
              patientRut: patient ? patient.fileNumber : 'No registrado',
              alertLevel: log.alertLevel || 'normal',
              summary: `Signos vitales: Presión ${log.vitals?.systolic || '--'}/${log.vitals?.diastolic || '--'} mmHg, FC ${log.vitals?.heartRate || '--'} bpm, Dolor EVA: ${log.vitals?.painLevel || 0}/10. ${log.notes ? 'Apuntes: ' + log.notes : ''}`,
              legalSeal: log.legalSeal || 'DS N° 41 Trazabilidad Clínica'
            });
          });
        }
      } catch (e) {}
    }
  }

  // 2. Alertas Críticas ECG IoT (cuidapp_ecg_alerts_*)
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('cuidapp_ecg_alerts_')) {
      const patientId = key.replace('cuidapp_ecg_alerts_', '');
      const patient = PATIENTS_DATABASE.find(p => p.id === patientId);
      try {
        const alerts = JSON.parse(localStorage.getItem(key));
        if (Array.isArray(alerts)) {
          alerts.forEach(al => {
            consolidated.push({
              id: al.id || 'ecg_' + Math.random().toString(36).substr(2, 6),
              timestamp: al.timestamp || new Date().toISOString(),
              eventType: 'ECG_ALERT',
              eventCategory: 'Telemetría Cardíaca IoT (AD8232)',
              badgeClass: al.state === 'ROJO' ? 'bg-danger bg-opacity-25 text-danger border-danger' : 'bg-warning bg-opacity-25 text-warning border-warning',
              icon: 'bi-heart-pulse-fill',
              operator: al.source || 'Monitor IoT ESP32/AD8232 (Producción/Simulador)',
              role: 'iot',
              roleLabel: 'Dispositivo IoT',
              patientId: patientId,
              patientName: al.patientName || (patient ? patient.name : 'Paciente ' + patientId),
              patientRut: patient ? patient.fileNumber : 'No registrado',
              alertLevel: al.state === 'ROJO' ? 'critico' : 'advertencia',
              summary: `Evento de Arritmia/Anomalía Cardíaca [${al.state}]: ${al.bpm || 0} BPM. Detalle: ${al.detail || 'Señal alterada registrada en telemetría'}.`,
              legalSeal: 'Decreto Supremo N° 41 / Ley 20.584 Registro IoT'
            });
          });
        }
      } catch (e) {}
    }
  }

  // 3. Recetas Médicas Electrónicas (cuidapp_prescriptions_*)
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('cuidapp_prescriptions_')) {
      const patientId = key.replace('cuidapp_prescriptions_', '');
      const patient = PATIENTS_DATABASE.find(p => p.id === patientId);
      try {
        const rxs = JSON.parse(localStorage.getItem(key));
        if (Array.isArray(rxs)) {
          rxs.forEach(rx => {
            consolidated.push({
              id: rx.id || 'rx_' + Math.random().toString(36).substr(2, 6),
              timestamp: rx.date || new Date().toISOString(),
              eventType: 'PRESCRIPTION',
              eventCategory: 'Receta Médica Electrónica',
              badgeClass: 'bg-info bg-opacity-25 text-info border-info',
              icon: 'bi-capsule-pill',
              operator: rx.prescribedBy || 'Dra. Elena Valdés (Reg. SIS N° 482910)',
              role: 'medico',
              roleLabel: 'Médico Tratante',
              patientId: patientId,
              patientName: rx.patientName || (patient ? patient.name : 'Paciente ' + patientId),
              patientRut: patient ? patient.fileNumber : 'No registrado',
              alertLevel: 'normal',
              summary: `Prescripción: ${rx.medication} (${rx.dose}), Horario: ${rx.schedule}, Duración: ${rx.duration || 'Crónico'}. Estado: ${rx.status || 'activa'}.`,
              legalSeal: 'Ley 21.541 Telemedicina / DS N° 41'
            });
          });
        }
      } catch (e) {}
    }
  }

  // 4. Evoluciones Médicas y Diagnósticos (cuidapp_medical_evolutions_*)
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('cuidapp_medical_evolutions_')) {
      const patientId = key.replace('cuidapp_medical_evolutions_', '');
      const patient = PATIENTS_DATABASE.find(p => p.id === patientId);
      try {
        const evos = JSON.parse(localStorage.getItem(key));
        if (Array.isArray(evos)) {
          evos.forEach(evo => {
            consolidated.push({
              id: evo.id || 'evo_' + Math.random().toString(36).substr(2, 6),
              timestamp: evo.timestamp || new Date().toISOString(),
              eventType: 'MEDICAL_EVOLUTION',
              eventCategory: 'Evolución Médica Firmada',
              badgeClass: 'bg-success bg-opacity-25 text-success border-success',
              icon: 'bi-journal-medical',
              operator: `${evo.doctorName || 'Dra. Elena Valdés'} (${evo.doctorReg || 'Reg. SIS N° 482910'})`,
              role: 'medico',
              roleLabel: 'Médico Tratante',
              patientId: patientId,
              patientName: evo.patientName || (patient ? patient.name : 'Paciente ' + patientId),
              patientRut: patient ? patient.fileNumber : 'No registrado',
              alertLevel: 'normal',
              summary: `Diagnóstico: ${evo.diagnosis || 'Control de Rutina'}. Anamnesis: ${evo.anamnesis || 'Sin observaciones'}. Antecedentes: ${evo.newBackground || 'Sin cambios'}.`,
              legalSeal: evo.legalSeal || 'Firma Médica Electrónica DS N° 41'
            });
          });
        }
      } catch (e) {}
    }
  }

  // 5. Auditoría Administrativa (cuidapp_admin_audit_log)
  try {
    const rawAdmin = localStorage.getItem('cuidapp_admin_audit_log');
    if (rawAdmin) {
      const adminLogs = JSON.parse(rawAdmin);
      if (Array.isArray(adminLogs)) {
        adminLogs.forEach(al => {
          consolidated.push({
            id: al.id || 'adm_' + Math.random().toString(36).substr(2, 6),
            timestamp: al.timestamp || new Date().toISOString(),
            eventType: 'ADMIN_AUDIT',
            eventCategory: 'Auditoría Administrativa',
            badgeClass: 'bg-warning bg-opacity-25 text-warning border-warning',
            icon: 'bi-shield-check',
            operator: al.operator || 'Administrador Central',
            role: 'admin',
            roleLabel: 'Administrador Central',
            patientId: al.patientId || 'N/A',
            patientName: al.patientName || (al.patientId ? 'Paciente ' + al.patientId : 'Ecosistema cuidApp'),
            patientRut: al.patientRut || 'N/A',
            alertLevel: 'normal',
            summary: `Acción: [${al.action}] Detalle: ${al.details}`,
            legalSeal: al.legalSeal || 'DS N° 41 Seguridad de Datos'
          });
        });
      }
    }
  } catch (e) {}

  // 5.1 Registro Inmutable cuidapp_audit_log (DS N° 41 / Ley 19.628)
  try {
    const rawAudit = localStorage.getItem('cuidapp_audit_log');
    if (rawAudit) {
      const globalAuditLogs = JSON.parse(rawAudit);
      if (Array.isArray(globalAuditLogs)) {
        globalAuditLogs.forEach(entry => {
          if (!consolidated.some(c => c.id === entry.id)) {
            consolidated.push({
              id: entry.id || 'aud_' + Math.random().toString(36).substr(2, 6),
              timestamp: entry.timestamp || new Date().toISOString(),
              eventType: entry.eventType || 'CLINICAL_LOG',
              eventCategory: entry.eventCategory || entry.recordType || 'Auditoría Cuidador',
              badgeClass: entry.recordType?.includes('Receta') ? 'bg-info bg-opacity-25 text-info border-info' : 'bg-primary bg-opacity-25 text-primary border-primary',
              icon: 'bi-shield-check',
              operator: entry.author || entry.operator || 'Sofía Díaz (Cuidador)',
              role: entry.role || 'cuidador',
              roleLabel: entry.roleLabel || 'Cuidador',
              patientId: entry.patientId || 'p1',
              patientName: entry.patientName || 'Paciente',
              patientRut: entry.patientRut || '10.420.932-K',
              alertLevel: entry.alertLevel || 'normal',
              summary: entry.summary || `[${entry.specialty}] ${entry.recordType}: ${entry.details || ''}`,
              legalSeal: entry.legalSeal || 'DS N° 41 / Ley 19.628'
            });
          }
        });
      }
    }
  } catch (e) {}

  // 6. Accesos de Sesión (cuidapp_session_log)
  try {
    const rawSession = localStorage.getItem('cuidapp_session_log');
    if (rawSession) {
      const sessLogs = JSON.parse(rawSession);
      if (Array.isArray(sessLogs)) {
        sessLogs.forEach(sl => {
          consolidated.push({
            id: sl.id || 'sess_' + Math.random().toString(36).substr(2, 6),
            timestamp: sl.timestamp || new Date().toISOString(),
            eventType: 'SESSION_ACCESS',
            eventCategory: 'Control de Acceso / Sesión',
            badgeClass: 'bg-secondary bg-opacity-25 text-light border-secondary',
            icon: 'bi-door-open-fill',
            operator: `${sl.name || sl.user} (${sl.user})`,
            role: sl.role || 'usuario',
            roleLabel: sl.role ? sl.role.toUpperCase() : 'USUARIO',
            patientId: 'N/A',
            patientName: 'Sistema cuidApp',
            patientRut: 'N/A',
            alertLevel: 'normal',
            summary: `Inicio de sesión exitoso desde ${sl.ip || 'Red Asistencial'}. Estado: ${sl.status || 'AUTORIZADO'}.`,
            legalSeal: sl.legalSeal || 'DS N° 41 / Ley 19.628 Control de Acceso'
          });
        });
      }
    }
  } catch (e) {}

  // Ordenar cronológicamente descendente
  consolidated.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return consolidated;
}

// --- CÁLCULO DE KPIS Y ESTADO DEL ECOSISTEMA ---
export function getEcosystemKpis() {
  const users = getAllSystemUsers();
  const patients = users.filter(u => u.role === 'patient');

  let pediatricCount = 0;
  let adolescentCount = 0;
  let adultCount = 0;
  let pregnancyCount = 0;
  let seniorCount = 0;

  patients.forEach(p => {
    const st = p.lifecycle.stage;
    if (st === 'gestante') pregnancyCount++;
    else if (st === 'pediatrico') pediatricCount++;
    else if (st === 'adolescente') adolescentCount++;
    else if (st === 'adulto_mayor') seniorCount++;
    else adultCount++;
  });

  const caregivers = users.filter(u => u.role === 'caregiver');
  const doctors = users.filter(u => u.role === 'doctor');
  const alliedStaffCount = 2; // Odontología & TENS equipo clínico de apoyo
  const totalClinicalTeam = doctors.length + caregivers.length + alliedStaffCount;
  const assignments = getCaregiverAssignments();
  const activeAssignments = assignments.filter(a => a.status === 'activo');

  // Tutores de menores de 18
  const minors = patients.filter(p => p.age < 18 || p.rawObject?.isPediatric);

  // Alertas ECG IoT críticas en localStorage
  let ecgCriticalCount = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('cuidapp_ecg_alerts_')) {
      try {
        const alerts = JSON.parse(localStorage.getItem(key));
        if (Array.isArray(alerts)) {
          ecgCriticalCount += alerts.filter(a => a.state === 'ROJO' || a.state === 'AMARILLO').length;
        }
      } catch (e) {}
    }
  }

  // Estado de conexión del Sensor AD8232 / ESP32 (Broker MQTT / Simulador)
  let ecgOnline = true;
  try {
    const iotState = getIotEcgState();
    if (iotState) {
      if (iotState.mode === 'mqtt') {
        ecgOnline = !!(iotState.connected && iotState.wsClient && iotState.wsClient.readyState === 1);
      } else {
        ecgOnline = iotState.connected !== false;
      }
    }
  } catch (e) {
    ecgOnline = true;
  }

  return {
    totalPatients: patients.length,
    pediatricCount,
    adolescentCount,
    adultCount,
    pregnancyCount,
    seniorCount,
    totalCaregivers: caregivers.length,
    activeAssignmentsCount: activeAssignments.length,
    totalMinors: minors.length,
    totalDoctors: doctors.length,
    totalClinicalTeam,
    ecgCriticalCount,
    ecgOnline
  };
}

// --- RENDERIZADOR PRINCIPAL DEL PANEL DE ADMINISTRACIÓN INTEGRAL ---
export function renderManagementView(container) {
  if (!container) return;

  const kpis = getEcosystemKpis();

  container.innerHTML = `
    <!-- Encabezado Institucional GlassKit con Sellos de Ley Chilena -->
    <div class="glass-card p-4 mb-4 text-white position-relative overflow-hidden" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px;">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div class="d-flex align-items-center gap-3">
          <div class="rounded-4 d-flex justify-content-center align-items-center bg-primary bg-opacity-25 border border-primary border-opacity-50 text-primary" style="width: 54px; height: 54px; font-size: 1.6rem; box-shadow: 0 0 25px rgba(14, 165, 233, 0.4);">
            <i class="bi bi-shield-lock-fill"></i>
          </div>
          <div>
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <h4 class="m-0 fw-bold text-white">Panel de Administración Integral cuidApp</h4>
              <span class="badge-glass bg-primary bg-opacity-25 text-primary border-primary small">Superintendencia de Salud</span>
            </div>
            <p class="m-0 text-white text-opacity-60 small mt-1">
              Centro de Mando, Auditoría de Trazabilidad y Gestión de Fichas Clínicas según Decreto Supremo N° 41 del MINSAL
            </p>
          </div>
        </div>

        <!-- Sellos de Cumplimiento Normativo Chileno -->
        <div class="d-flex flex-wrap gap-2">
          <span class="badge-glass bg-light bg-opacity-10 text-white border-light border-opacity-25 small" title="Protección de Datos Personales y Sensibles de Salud">
            <i class="bi bi-lock-fill me-1"></i>Ley N° 19.628
          </span>
        </div>
      </div>

      <!-- Barra de Pestañas de Administración -->
      <div class="d-flex flex-wrap gap-2 mt-4 pt-3 border-top border-light border-opacity-10">
        <button id="adminTabKpis" class="btn btn-sm ${adminSubTab === 'kpis' ? 'btn-glass-primary active' : 'btn-glass-secondary'} px-3 py-2">
          <i class="bi bi-speedometer2 me-2"></i>📊 KPIs & Estado Global
        </button>
        <button id="adminTabUsers" class="btn btn-sm ${adminSubTab === 'users' ? 'btn-glass-primary active' : 'btn-glass-secondary'} px-3 py-2">
          <i class="bi bi-people-fill me-2"></i>👥 Gestión de Usuarios y Fichas
        </button>
        <button id="adminTabLinks" class="btn btn-sm ${adminSubTab === 'links' ? 'btn-glass-primary active' : 'btn-glass-secondary'} px-3 py-2">
          <i class="bi bi-link-45deg me-2"></i>🔗 Vínculos Legales & Tutores
        </button>
        <button id="adminTabAudit" class="btn btn-sm ${adminSubTab === 'audit' ? 'btn-glass-primary active' : 'btn-glass-secondary'} px-3 py-2">
          <i class="bi bi-shield-check me-2"></i>🛡️ Auditoría de Trazabilidad DS N° 41
        </button>
      </div>
    </div>

    <!-- Espacio Principal de Trabajo -->
    <div id="adminWorkspaceArea" class="glass-card p-4 text-white"></div>

    <!-- Barra Inferior Discreta con Botón de Marco Normativo -->
    <div class="d-flex justify-content-end align-items-center mt-3 pt-2">
      <button id="btnOpenLegalFrameworkModal" class="btn btn-sm btn-glass-secondary text-white-50 px-3 py-1" style="font-size: 0.8rem; border-color: rgba(255,255,255,0.1); border-radius: 8px;">
        ⚖️ Ver Marco Normativo Aplicado
      </button>
    </div>

    <!-- Contenedor Dinámico para Modales GlassKit -->
    <div id="adminModalContainer"></div>
  `;

  // Listeners de navegación de pestañas
  const tabKpis = document.getElementById('adminTabKpis');
  const tabUsers = document.getElementById('adminTabUsers');
  const tabLinks = document.getElementById('adminTabLinks');
  const tabAudit = document.getElementById('adminTabAudit');

  if (tabKpis) tabKpis.onclick = () => { setAdminSubTab('kpis'); renderManagementView(container); };
  if (tabUsers) tabUsers.onclick = () => { setAdminSubTab('users'); renderManagementView(container); };
  if (tabLinks) tabLinks.onclick = () => { setAdminSubTab('links'); renderManagementView(container); };
  if (tabAudit) tabAudit.onclick = () => { setAdminSubTab('audit'); renderManagementView(container); };

  const btnLegalModal = document.getElementById('btnOpenLegalFrameworkModal');
  if (btnLegalModal) {
    btnLegalModal.onclick = () => openLegalFrameworkModal();
  }

  renderCurrentSubTab();
}

// Modal compacto del Marco Normativo Aplicado (Leyes Chilenas vigentes)
export function openLegalFrameworkModal() {
  const container = document.getElementById('adminModalContainer') || document.body;
  
  const modalId = 'modalLegalFramework';
  const existing = document.getElementById(modalId);
  if (existing) existing.remove();

  const modalHtml = `
    <div class="modal fade show d-block" id="${modalId}" tabindex="-1" style="background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px); z-index: 1060;">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content glass-card text-white border-light border-opacity-10" style="background: #0b1329; border-radius: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.8);">
          <div class="modal-header border-bottom border-light border-opacity-10 pb-3">
            <div class="d-flex align-items-center gap-2">
              <span class="fs-4">⚖️</span>
              <div>
                <h5 class="modal-title fw-bold m-0 text-white">Marco Normativo Aplicado en cuidApp</h5>
                <small class="text-white-50">Legislación y reglamentos vigentes de la República de Chile integrados en la plataforma</small>
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" id="btnCloseLegalFrameworkModal"></button>
          </div>
          <div class="modal-body p-4" style="max-height: 70vh; overflow-y: auto;">
            <div class="d-flex flex-column gap-3">
              <div class="p-3 rounded-3" style="background: rgba(255,255,255,0.03); border-left: 4px solid #0ea5e9;">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <strong class="text-info">Ley N° 20.584</strong>
                  <span class="badge bg-info bg-opacity-25 text-info small">Derechos y Deberes en Salud</span>
                </div>
                <div class="text-white text-opacity-80 small">Regula los derechos y deberes que tienen las personas en relación con acciones vinculadas a su atención en salud. Garantiza el acceso transparente a la Ficha Clínica Oficial, la autonomía del paciente y el consentimiento informado.</div>
              </div>

              <div class="p-3 rounded-3" style="background: rgba(255,255,255,0.03); border-left: 4px solid #38bdf8;">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <strong class="text-white">Ley N° 19.628</strong>
                  <span class="badge bg-light bg-opacity-25 text-white small">Protección de Datos Personales</span>
                </div>
                <div class="text-white text-opacity-80 small">Protección de la vida privada y tratamiento de datos personales sensibles de salud. Asegura el aislamiento criptográfico local, la estricta reserva clínica y la prohibición de clonación de historiales demo en registros nuevos.</div>
              </div>

              <div class="p-3 rounded-3" style="background: rgba(255,255,255,0.03); border-left: 4px solid #10b981;">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <strong class="text-success">Ley N° 21.541</strong>
                  <span class="badge bg-success bg-opacity-25 text-success small">Telesalud y Telemedicina</span>
                </div>
                <div class="text-white text-opacity-80 small">Regula la atención médica y odontológica a distancia (telesalud). Exige consentimiento informado explícito de audio y video antes de habilitar la cámara, con resguardo de confidencialidad y registro del profesional tratante.</div>
              </div>

              <div class="p-3 rounded-3" style="background: rgba(255,255,255,0.03); border-left: 4px solid #f59e0b;">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <strong class="text-warning">Ley N° 21.430</strong>
                  <span class="badge bg-warning bg-opacity-25 text-warning small">Protección de la Niñez y Adolescencia</span>
                </div>
                <div class="text-white text-opacity-80 small">Garantías y protección integral de los derechos de la niñez y adolescencia. Establece la acreditación obligatoria de Tutores Legales para menores de edad, y consagra la autonomía progresiva y confidencialidad médica en adolescentes (12 a 17 años).</div>
              </div>

              <div class="p-3 rounded-3" style="background: rgba(255,255,255,0.03); border-left: 4px solid #a855f7;">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <strong class="text-primary" style="color: #c084fc !important;">Ley N° 21.668</strong>
                  <span class="badge bg-primary bg-opacity-25 text-primary small">Atención Preferente</span>
                </div>
                <div class="text-white text-opacity-80 small">Modifica la Ley N° 20.584 para consagrar el derecho a la atención preferente y oportuna a personas mayores de 60 años, personas con discapacidad o movilidad reducida, y cuidadores acreditados (activando el Modo Visual Simple y acceso directo a urgencias SAMU 131).</div>
              </div>

              <div class="p-3 rounded-3" style="background: rgba(255,255,255,0.03); border-left: 4px solid #ec4899;">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <strong class="text-danger" style="color: #f472b6 !important;">Ley N° 21.120</strong>
                  <span class="badge bg-danger bg-opacity-25 text-danger small">Identidad de Género</span>
                </div>
                <div class="text-white text-opacity-80 small">Reconoce y da protección al derecho a la identidad de género. Exige el uso obligatorio, prioritario y respetuoso del Nombre Social y Pronombres de atención en todas las interfaces asistenciales, recetas y fichas del sistema.</div>
              </div>

              <div class="p-3 rounded-3" style="background: rgba(255,255,255,0.03); border-left: 4px solid #06b6d4;">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <strong class="text-info" style="color: #22d3ee !important;">Decreto Supremo N° 41 (MINSAL)</strong>
                  <span class="badge bg-info bg-opacity-25 text-info small">Reglamento de Ficha Clínica</span>
                </div>
                <div class="text-white text-opacity-80 small">Norma del Ministerio de Salud que rige las fichas clínicas digitales. Obliga a garantizar inmutabilidad, trazabilidad clínica por rol de operador, conservación cronológica íntegra y sellos temporales inviolables para cada registro asistencial.</div>
              </div>
            </div>
          </div>
          <div class="modal-footer border-top border-light border-opacity-10 pt-3">
            <button type="button" class="btn btn-sm btn-glass-secondary px-4" id="btnCloseLegalFrameworkFooter">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', modalHtml);

  const modalEl = document.getElementById(modalId);
  const close = () => { if (modalEl) modalEl.remove(); };
  const btnClose = document.getElementById('btnCloseLegalFrameworkModal');
  const btnFooter = document.getElementById('btnCloseLegalFrameworkFooter');
  if (btnClose) btnClose.onclick = close;
  if (btnFooter) btnFooter.onclick = close;
}

export function renderCurrentSubTab() {
  const workspace = document.getElementById('adminWorkspaceArea');
  if (!workspace) return;

  if (adminSubTab === 'kpis') {
    renderKpisTab(workspace);
  } else if (adminSubTab === 'users') {
    renderUsersTab(workspace);
  } else if (adminSubTab === 'links') {
    renderLinksTab(workspace);
  } else if (adminSubTab === 'audit') {
    renderAuditTab(workspace);
  }
}

// ============================================================================
// PESTAÑA 1: KPIS Y ESTADO GLOBAL DEL ECOSISTEMA
// ============================================================================
function renderKpisTab(workspace) {
  const kpis = getEcosystemKpis();

  workspace.innerHTML = `
    <!-- Tarjetas de Métricas Principales -->
    <div class="row g-3 mb-4">
      <!-- Pacientes Totales y Segmentación -->
      <div class="col-12 col-md-6 col-xl-3">
        <div class="glass-card p-3 h-100 position-relative overflow-hidden border-primary border-opacity-25" style="background: rgba(14, 165, 233, 0.05);">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
              <small class="text-white text-opacity-60 fw-semibold text-uppercase" style="letter-spacing: 0.5px;">Pacientes Activos</small>
              <h2 class="fw-bold text-white my-1">${kpis.totalPatients}</h2>
            </div>
            <div class="p-2 rounded-3 bg-primary bg-opacity-25 text-primary border border-primary border-opacity-25">
              <i class="bi bi-people-fill fs-4"></i>
            </div>
          </div>
          <div class="pt-2 border-top border-light border-opacity-10">
            <div class="text-white text-opacity-60 small mb-2" style="font-size: 0.75rem;">
              Segmentación por Ciclo Vital:
            </div>
            <div class="d-flex flex-column gap-1 text-white small" style="font-size: 0.76rem;">
              <div class="d-flex justify-content-between align-items-center">
                <span class="text-white text-opacity-85">👴 Adultos Mayores</span>
                <strong class="text-white fw-bold">${kpis.seniorCount}</strong>
              </div>
              <div class="d-flex justify-content-between align-items-center">
                <span class="text-white text-opacity-85">🤰 Gestantes</span>
                <strong class="text-white fw-bold">${kpis.pregnancyCount}</strong>
              </div>
              <div class="d-flex justify-content-between align-items-center">
                <span class="text-white text-opacity-85">🧒 Pediátricos</span>
                <strong class="text-white fw-bold">${kpis.pediatricCount}</strong>
              </div>
              <div class="d-flex justify-content-between align-items-center">
                <span class="text-white text-opacity-85">🧑🎓 Adolescentes</span>
                <strong class="text-white fw-bold">${kpis.adolescentCount}</strong>
              </div>
              <div class="d-flex justify-content-between align-items-center">
                <span class="text-white text-opacity-85">🧑 Adultos</span>
                <strong class="text-white fw-bold">${kpis.adultCount}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Red de Cuidado y Tutores -->
      <div class="col-12 col-md-6 col-xl-3">
        <div class="glass-card p-3 h-100 border-info border-opacity-25" style="background: rgba(6, 182, 212, 0.05);">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
              <small class="text-white text-opacity-60 fw-semibold text-uppercase" style="letter-spacing: 0.5px;">Red de Cuidado & Tutores</small>
              <h2 class="fw-bold text-info my-1">${kpis.totalCaregivers}</h2>
            </div>
            <div class="p-2 rounded-3 bg-info bg-opacity-25 text-info border border-info border-opacity-25">
              <i class="bi bi-person-heart fs-4"></i>
            </div>
          </div>
          <div class="pt-2 border-top border-light border-opacity-10 small text-white text-opacity-70">
            <div class="d-flex justify-content-between mb-1">
              <span>Vínculos Acreditados:</span>
              <strong class="text-info">${kpis.activeAssignmentsCount} vigentes</strong>
            </div>
            <div class="d-flex justify-content-between">
              <span>Tutores Ley 21.430:</span>
              <strong class="text-warning">${kpis.totalMinors} acreditados</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- Equipo Clínico Acreditado -->
      <div class="col-12 col-md-6 col-xl-3">
        <div class="glass-card p-3 h-100 border-success border-opacity-25" style="background: rgba(16, 185, 129, 0.05);">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
              <small class="text-white text-opacity-60 fw-semibold text-uppercase" style="letter-spacing: 0.5px;">Equipo Médico Tratante</small>
              <h2 class="fw-bold text-success my-1">${kpis.totalClinicalTeam}</h2>
            </div>
            <div class="p-2 rounded-3 bg-success bg-opacity-25 text-success border border-success border-opacity-25">
              <i class="bi bi-hospital fs-4"></i>
            </div>
          </div>
          <div class="pt-2 border-top border-light border-opacity-10 small text-white text-opacity-70">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="text-white text-opacity-80">🩺 Dra. Elena Valdés</span>
              <span class="badge-glass text-success px-2 py-0.5 rounded-2" style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); font-size: 0.7rem;">🟢 En turno</span>
            </div>
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="text-white text-opacity-80">🤝 Sofía (Cuidadora)</span>
              <span class="badge-glass text-success px-2 py-0.5 rounded-2" style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); font-size: 0.7rem;">🟢 Activa</span>
            </div>
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="text-white text-opacity-80">🦷 Odontología & TENS</span>
              <span class="badge-glass text-success px-2 py-0.5 rounded-2" style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); font-size: 0.7rem;">🟢 2 Activos</span>
            </div>
            <div class="d-flex justify-content-between align-items-center pt-1 border-top border-light border-opacity-10 text-white-50" style="font-size: 0.72rem;">
              <span>Telemedicina Ley 21.541:</span>
              <strong class="text-success">Habilitada</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- Telemetría IoT ECG -->
      <div class="col-12 col-md-6 col-xl-3">
        <div class="glass-card p-3 h-100 border-danger border-opacity-25" style="background: rgba(239, 68, 68, 0.05);">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
              <small class="text-white text-opacity-60 fw-semibold text-uppercase" style="letter-spacing: 0.5px;">Alertas Críticas ECG IoT</small>
              <h2 class="fw-bold text-danger my-1">${kpis.ecgCriticalCount}</h2>
            </div>
            <div class="p-2 rounded-3 bg-danger bg-opacity-25 text-danger border border-danger border-opacity-25">
              <i class="bi bi-heart-pulse-fill fs-4"></i>
            </div>
          </div>
          <div class="pt-2 border-top border-light border-opacity-10 small text-white text-opacity-70">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="text-white text-opacity-80">Sensor AD8232 / ESP32:</span>
              ${kpis.ecgOnline ? `
                <span class="badge-glass text-success px-2 py-0.5 rounded-2" style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); font-size: 0.7rem;">🟢 En línea (MQTT)</span>
              ` : `
                <span class="badge-glass text-white-50 px-2 py-0.5 rounded-2" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15); font-size: 0.7rem;">⚪ En espera</span>
              `}
            </div>
            <div class="d-flex justify-content-between align-items-center">
              <span class="text-white text-opacity-80">Telemetría Crítica:</span>
              <strong class="${kpis.ecgCriticalCount > 0 ? 'text-danger' : 'text-success'}">${kpis.ecgCriticalCount > 0 ? 'Eventos registrados' : 'Estable'}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Panel de Distribución Poblacional -->
    <div class="row g-4">
      <!-- Resumen Demográfico y de Salud -->
      <div class="col-12">
        <div class="glass-card p-4 h-100" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px;">
          <h5 class="fw-bold mb-3 text-info d-flex align-items-center gap-2">
            <i class="bi bi-pie-chart-fill"></i> Distribución de Pacientes por Ciclo Vital y Previsión
          </h5>
          <div class="row g-3">
            <div class="col-sm-6">
              <div class="p-3 rounded-3" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);">
                <div class="text-white-50 small mb-2">Ciclo Vital (MINSAL)</div>
                <div class="d-flex align-items-center justify-content-between mb-2">
                  <span class="small">👶 Pediátrico (< 10 años)</span>
                  <span class="fw-bold text-info">${kpis.pediatricCount} (${Math.round((kpis.pediatricCount / (kpis.totalPatients || 1)) * 100)}%)</span>
                </div>
                <div class="d-flex align-items-center justify-content-between mb-2">
                  <span class="small">🧒 Adolescente (10–17 años)</span>
                  <span class="fw-bold text-primary">${kpis.adolescentCount} (${Math.round((kpis.adolescentCount / (kpis.totalPatients || 1)) * 100)}%)</span>
                </div>
                <div class="d-flex align-items-center justify-content-between mb-2">
                  <span class="small">🧑 Adulto (18–59 años)</span>
                  <span class="fw-bold text-white">${kpis.adultCount} (${Math.round((kpis.adultCount / (kpis.totalPatients || 1)) * 100)}%)</span>
                </div>
                <div class="d-flex align-items-center justify-content-between mb-2">
                  <span class="small">🤰 Gestante (Embarazo Activo)</span>
                  <span class="fw-bold text-danger">${kpis.pregnancyCount} (${Math.round((kpis.pregnancyCount / (kpis.totalPatients || 1)) * 100)}%)</span>
                </div>
                <div class="d-flex align-items-center justify-content-between">
                  <span class="small">👴 Adulto Mayor (≥ 60 años)</span>
                  <span class="fw-bold text-warning">${kpis.seniorCount} (${Math.round((kpis.seniorCount / (kpis.totalPatients || 1)) * 100)}%)</span>
                </div>
              </div>
            </div>

            <div class="col-sm-6">
              <div class="p-3 rounded-3 h-100" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);">
                <div class="text-white-50 small mb-2">Cobertura Previsional y GES</div>
                <div class="d-flex align-items-center justify-content-between mb-2">
                  <span class="small"><i class="bi bi-shield-check text-success me-1"></i>FONASA Tramo A / B</span>
                  <span class="fw-bold text-success">Gratuidad Total</span>
                </div>
                <div class="d-flex align-items-center justify-content-between mb-2">
                  <span class="small"><i class="bi bi-shield-check text-primary me-1"></i>FONASA Tramo C / D</span>
                  <span class="fw-bold text-primary">Copago Institucional</span>
                </div>
                <div class="d-flex align-items-center justify-content-between mb-2">
                  <span class="small"><i class="bi bi-shield-check text-warning me-1"></i>ISAPRE (Colmena, Banmédica)</span>
                  <span class="fw-bold text-warning">Convenio Digital</span>
                </div>
                <div class="mt-3 pt-2 border-top border-light border-opacity-10 text-white-50 small">
                  Todos los registros cumplen con el repositorio estandarizado de Ficha Digital interoperable (Ley 21.668).
                </div>
              </div>
            </div>
          </div>

          <div class="mt-3 text-end">
            <button id="btnGoToUsers" class="btn btn-sm btn-glass-primary px-3">
              <i class="bi bi-people me-1"></i> Ver Catálogo Completo de Usuarios
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const btnGoToUsers = document.getElementById('btnGoToUsers');
  if (btnGoToUsers) {
    btnGoToUsers.onclick = () => {
      setAdminSubTab('users');
      renderManagementView(document.getElementById('dashboard-content-area'));
    };
  }
}

// ============================================================================
// PESTAÑA 2: GESTIÓN DE USUARIOS Y FICHAS (CRUD COMPLETO)
// ============================================================================
function renderUsersTab(workspace) {
  const allUsers = getAllSystemUsers();

  // Filtrado reactivo
  const filteredUsers = allUsers.filter(u => {
    // Filtro por rol
    if (usersFilterRole !== 'all' && u.role !== usersFilterRole) return false;
    // Filtro por estado
    if (usersFilterStatus !== 'all' && u.status !== usersFilterStatus) return false;
    // Filtro por búsqueda
    if (usersSearchQuery) {
      const q = usersSearchQuery.toLowerCase();
      const matchName = u.name.toLowerCase().includes(q);
      const matchSocial = (u.socialName || '').toLowerCase().includes(q);
      const matchRut = u.rut.toLowerCase().includes(q) || cleanRut(u.rut).includes(cleanRut(q));
      const matchUser = u.username.toLowerCase().includes(q);
      if (!matchName && !matchSocial && !matchRut && !matchUser) return false;
    }
    return true;
  });

  workspace.innerHTML = `
    <!-- Barra Superior de Controles y Filtros -->
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4 pb-3 border-bottom border-light border-opacity-10">
      <div class="d-flex flex-wrap align-items-center gap-2">
        <!-- Buscador -->
        <div class="input-group input-group-sm" style="max-width: 280px;">
          <span class="input-group-text bg-transparent border-light border-opacity-25 text-white-50"><i class="bi bi-search"></i></span>
          <input type="text" id="usersSearchInput" class="form-control bg-transparent border-light border-opacity-25 text-white" placeholder="Buscar por Nombre, RUT o Usuario..." value="${usersSearchQuery}">
        </div>

        <!-- Filtro Rol -->
        <select id="usersRoleSelect" class="form-select form-select-sm text-white" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); width: auto;">
          <option value="all" class="bg-dark" ${usersFilterRole === 'all' ? 'selected' : ''}>Todos los Roles</option>
          <option value="patient" class="bg-dark" ${usersFilterRole === 'patient' ? 'selected' : ''}>Pacientes</option>
          <option value="caregiver" class="bg-dark" ${usersFilterRole === 'caregiver' ? 'selected' : ''}>Cuidadores/as</option>
          <option value="doctor" class="bg-dark" ${usersFilterRole === 'doctor' ? 'selected' : ''}>Médicos</option>
          <option value="admin" class="bg-dark" ${usersFilterRole === 'admin' ? 'selected' : ''}>Administradores</option>
        </select>

        <!-- Filtro Estado -->
        <select id="usersStatusSelect" class="form-select form-select-sm text-white" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); width: auto;">
          <option value="all" class="bg-dark" ${usersFilterStatus === 'all' ? 'selected' : ''}>Todos los Estados</option>
          <option value="active" class="bg-dark" ${usersFilterStatus === 'active' ? 'selected' : ''}>🟢 Activos</option>
          <option value="suspended" class="bg-dark" ${usersFilterStatus === 'suspended' ? 'selected' : ''}>🔴 Suspendidos</option>
        </select>

        <span class="text-white-50 small ms-2">${filteredUsers.length} perfil(es)</span>
      </div>

      <!-- Botón Nuevo Perfil -->
      <button id="btnCreateNewUser" class="btn btn-sm btn-glass-primary px-3 py-2">
        <i class="bi bi-person-plus-fill me-2"></i>Crear Nuevo Perfil
      </button>
    </div>

    <!-- Tabla Unificada de Perfiles -->
    <div class="table-responsive">
      <table class="table table-dark table-hover bg-transparent text-white align-middle" style="--bs-table-bg: transparent; --bs-table-border-color: rgba(255,255,255,0.08);">
        <thead>
          <tr>
            <th scope="col" class="text-white-50">Identidad / Nombre Social (Ley 21.120)</th>
            <th scope="col" class="text-white-50" style="white-space: nowrap;">RUT Chileno</th>
            <th scope="col" class="text-white-50">Edad / Ciclo Vital</th>
            <th scope="col" class="text-white-50">Sexo / Previsión</th>
            <th scope="col" class="text-white-50">Rol en cuidApp</th>
            <th scope="col" class="text-white-50" style="white-space: nowrap;">Estado</th>
            <th scope="col" class="text-white-50 text-end">Acciones Administrativas</th>
          </tr>
        </thead>
        <tbody>
          ${filteredUsers.map(u => {
            const initials = u.name.split(' ').map(n => n[0]).slice(0, 2).join('');
            const isSuspended = u.status === 'suspended';
            const isSenior = u.age >= 60;
            const isMinor = u.age < 18;

            return `
              <tr style="${isSuspended ? 'opacity: 0.6; filter: grayscale(40%);' : ''}">
                <td>
                  <div class="d-flex align-items-center gap-3">
                    <div class="rounded-circle d-flex justify-content-center align-items-center bg-primary bg-opacity-25 border border-primary border-opacity-25 text-white fw-bold" style="width: 38px; height: 38px; font-size: 0.85rem;">
                      ${initials}
                    </div>
                    <div>
                      <div class="fw-bold d-flex align-items-center gap-2">
                        <span>${u.socialName || u.name}</span>
                        ${u.pronouns ? `<span class="badge-glass bg-light bg-opacity-10 text-white-50 border-light border-opacity-10 small" style="font-size: 0.65rem;">${u.pronouns}</span>` : ''}
                      </div>
                      ${u.socialName && u.socialName !== u.name ? `<small class="text-white-50 d-block" style="font-size: 0.72rem;">Legal: ${u.name}</small>` : ''}
                      <small class="text-white text-opacity-40 font-monospace" style="font-size: 0.7rem;">@${u.username}</small>
                    </div>
                  </div>
                </td>

                <td style="white-space: nowrap;">
                  <code class="text-warning font-monospace" style="white-space: nowrap;">${u.rut}</code>
                </td>

                <td>
                  ${getLifecycleDisplayHtml(u)}
                </td>

                <td>
                  <div class="small">${u.gender}</div>
                  <small class="text-white-50">${u.prevision}</small>
                </td>

                <td>
                  ${getRoleBadgeHtml(u.role)}
                </td>

                <td style="white-space: nowrap;">
                  ${isSuspended ? `
                    <span class="badge-glass bg-danger bg-opacity-25 text-danger border-danger small" style="display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;">
                      <i class="bi bi-slash-circle"></i><span>Suspendido</span>
                    </span>
                  ` : `
                    <span class="badge-glass bg-success bg-opacity-25 text-success border-success small" style="display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;">
                      <i class="bi bi-check-circle-fill"></i><span>Activo</span>
                    </span>
                  `}
                </td>

                <td class="text-end">
                  <div class="btn-group btn-group-sm">
                    <!-- Ver Ficha Rápida -->
                    <button class="btn btn-glass-secondary view-profile-btn" data-key="${u.key}" title="Ver Ficha Rápida">
                      <i class="bi bi-eye-fill"></i>
                    </button>

                    <!-- Activar / Suspender -->
                    <button class="btn ${isSuspended ? 'btn-glass-primary' : 'btn-glass-danger'} toggle-status-btn" data-username="${u.username}" data-status="${u.status}" title="${isSuspended ? 'Reactivar Acceso' : 'Suspender Acceso'}">
                      <i class="bi ${isSuspended ? 'bi-unlock-fill' : 'bi-lock-fill'}"></i>
                    </button>

                    <!-- Restablecer Clave Temporal -->
                    <button class="btn btn-glass-secondary reset-pwd-btn" data-username="${u.username}" data-name="${u.socialName || u.name}" title="Restablecer Clave Temporal">
                      <i class="bi bi-key-fill text-warning"></i>
                    </button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Listeners de filtros
  const searchInput = document.getElementById('usersSearchInput');
  const roleSelect = document.getElementById('usersRoleSelect');
  const statusSelect = document.getElementById('usersStatusSelect');
  const btnCreateNew = document.getElementById('btnCreateNewUser');

  if (searchInput) {
    searchInput.oninput = (e) => {
      usersSearchQuery = e.target.value.trim();
      renderUsersTab(workspace);
    };
  }

  if (roleSelect) {
    roleSelect.onchange = (e) => {
      usersFilterRole = e.target.value;
      renderUsersTab(workspace);
    };
  }

  if (statusSelect) {
    statusSelect.onchange = (e) => {
      usersFilterStatus = e.target.value;
      renderUsersTab(workspace);
    };
  }

  if (btnCreateNew) {
    btnCreateNew.onclick = () => {
      showCreateUserModal();
    };
  }

  // Listeners de acciones por fila
  workspace.querySelectorAll('.view-profile-btn').forEach(btn => {
    btn.onclick = () => {
      const key = btn.getAttribute('data-key');
      const user = allUsers.find(u => u.key === key);
      if (user) showQuickProfileModal(user);
    };
  });

  workspace.querySelectorAll('.toggle-status-btn').forEach(btn => {
    btn.onclick = () => {
      const uname = btn.getAttribute('data-username');
      const currentSt = btn.getAttribute('data-status');
      const newSt = currentSt === 'suspended' ? 'active' : 'suspended';
      const verb = newSt === 'suspended' ? 'suspender' : 'reactivar';

      if (confirm(`¿Confirmas ${verb} el acceso al sistema para el usuario @${uname}?`)) {
        setUserStatus(uname, newSt, `Modificación manual desde panel de administración`);
        window.showGlassAlert(`Estado del usuario @${uname} actualizado a: ${newSt === 'suspended' ? 'SUSPENDIDO' : 'ACTIVO'}.`, newSt === 'suspended' ? 'warning' : 'success');
        renderUsersTab(workspace);
      }
    };
  });

  workspace.querySelectorAll('.reset-pwd-btn').forEach(btn => {
    btn.onclick = () => {
      const uname = btn.getAttribute('data-username');
      const name = btn.getAttribute('data-name');
      showResetPasswordModal(uname, name);
    };
  });
}

// Modal de Ficha Rápida
function showQuickProfileModal(user) {
  const container = document.getElementById('adminModalContainer');
  if (!container) return;

  const isMinor = user.age < 18;
  const isSenior = user.age >= 60;

  container.innerHTML = `
    <div class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.7); backdrop-filter: blur(10px); z-index: 1060;">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content glass-card p-4 text-white" style="background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(255,255,255,0.15); border-radius: 24px;">
          <div class="modal-header border-bottom border-light border-opacity-10 pb-3">
            <div>
              <h5 class="modal-title fw-bold text-info d-flex align-items-center gap-2">
                <i class="bi bi-person-vcard-fill"></i> Ficha Integral de Identidad & Salud
              </h5>
              <small class="text-white-50">Cumplimiento estricto Ley N° 20.584, Ley N° 21.120 y Ley N° 21.430</small>
            </div>
            <button type="button" class="btn-close btn-close-white" id="btnCloseQuickProfile"></button>
          </div>

          <div class="modal-body py-3">
            <div class="row g-3">
              <div class="col-md-6">
                <div class="p-3 rounded-3 bg-white bg-opacity-5 border border-white border-opacity-10">
                  <h6 class="text-info fw-bold mb-3"><i class="bi bi-info-circle me-1"></i>Datos Demográficos & Identidad</h6>
                  <ul class="list-unstyled mb-0 small">
                    <li class="mb-2"><strong>Nombre Legal:</strong> ${user.name}</li>
                    <li class="mb-2"><strong>Nombre Social:</strong> <span class="text-warning fw-bold">${user.socialName || user.name}</span> (${user.pronouns || 'No informado'})</li>
                    <li class="mb-2"><strong>RUT Chileno:</strong> <code>${user.rut}</code></li>
                    <li class="mb-2"><strong>Fecha de Nacimiento:</strong> ${user.birthDate || 'No registrada'} (${user.age} años)</li>
                    <li class="mb-2"><strong>Sexo Biológico:</strong> ${user.gender}</li>
                    <li class="mb-2"><strong>Previsión:</strong> ${user.prevision}</li>
                    <li><strong>Teléfono / Contacto:</strong> ${user.phone}</li>
                  </ul>
                </div>
              </div>

              <div class="col-md-6">
                <div class="p-3 rounded-3 bg-white bg-opacity-5 border border-white border-opacity-10">
                  <h6 class="text-success fw-bold mb-3"><i class="bi bi-heart-pulse me-1"></i>Datos Clínicos & Cobertura</h6>
                  <ul class="list-unstyled mb-0 small">
                    <li class="mb-2"><strong>Grupo Sanguíneo:</strong> <code class="text-white">${user.bloodType}</code></li>
                    <li class="mb-2"><strong>Alergias Conocidas:</strong> <span class="text-danger">${user.allergies}</span></li>
                    <li class="mb-2"><strong>Ciclo Vital:</strong> <span class="text-white text-opacity-90">${user.role === 'patient' ? (user.lifecycle?.stage === 'gestante' ? '🤰 Gestante' : user.lifecycle?.stage === 'adulto_mayor' ? '👴 Adulto Mayor' : user.lifecycle?.stage === 'pediatrico' ? '🧒 Pediátrico' : user.lifecycle?.stage === 'adolescente' ? '🧑🎓 Adolescente' : '🧑 Adulto') : (user.role === 'doctor' ? 'Personal Clínico' : user.role === 'caregiver' ? 'Equipo Asistencial' : 'Administración Central')}</span></li>
                    <li class="mb-2"><strong>Rol en Sistema:</strong> ${getRoleBadgeHtml(user.role)}</li>
                    <li><strong>Estado de Cuenta:</strong> ${user.status === 'suspended' ? '<span class="text-danger fw-bold">SUSPENDIDO</span>' : '<span class="text-success fw-bold">ACTIVO</span>'}</li>
                  </ul>
                </div>
              </div>

              ${isMinor ? `
                <div class="col-12">
                  <div class="p-3 rounded-3 bg-warning bg-opacity-10 border border-warning border-opacity-25">
                    <h6 class="text-warning fw-bold mb-2"><i class="bi bi-balloon-heart me-1"></i>Tutor Legal / Representante Acreditado (Ley N° 21.430)</h6>
                    <div class="row g-2 small">
                      <div class="col-sm-4"><strong>Nombre Tutor:</strong> ${user.tutorLegal?.name || user.emergencyContact?.name || 'Acreditado en Ficha'}</div>
                      <div class="col-sm-4"><strong>Vínculo:</strong> ${user.tutorLegal?.relation || user.emergencyContact?.relation || 'Madre / Padre'}</div>
                      <div class="col-sm-4"><strong>Teléfono:</strong> ${user.tutorLegal?.phone || user.emergencyContact?.phone || '+56912345678'}</div>
                    </div>
                  </div>
                </div>
              ` : ''}

              ${user.role === 'caregiver' ? `
                <div class="col-12">
                  <div class="p-3 rounded-3 bg-info bg-opacity-10 border border-info border-opacity-25">
                    <h6 class="text-info fw-bold mb-2"><i class="bi bi-person-heart me-1"></i>Vínculo de Cuidados Acreditado (Ley N° 20.584)</h6>
                    <p class="m-0 small">Paciente asignado formalmente: <strong>${user.assignedPatientName || 'Sin asignación fija'}</strong>. Acceso exclusivo a signos vitales y bitácora clínica del paciente vinculado.</p>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>

          <div class="modal-footer border-top border-light border-opacity-10 pt-3">
            <button type="button" class="btn btn-glass-secondary px-4" id="btnCloseQuickProfileFooter">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const closeFn = () => { container.innerHTML = ''; };
  document.getElementById('btnCloseQuickProfile').onclick = closeFn;
  document.getElementById('btnCloseQuickProfileFooter').onclick = closeFn;
}

// Modal para Restablecer Contraseña Temporal
function showResetPasswordModal(username, name) {
  const container = document.getElementById('adminModalContainer');
  if (!container) return;

  const tempPassword = 'CuidApp' + Math.floor(1000 + Math.random() * 9000) + '!';

  container.innerHTML = `
    <div class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.7); backdrop-filter: blur(10px); z-index: 1060;">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content glass-card p-4 text-white" style="background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(255,255,255,0.15); border-radius: 24px;">
          <div class="modal-header border-bottom border-light border-opacity-10 pb-3">
            <h5 class="modal-title fw-bold text-warning d-flex align-items-center gap-2">
              <i class="bi bi-key-fill"></i> Restablecer Clave Temporal
            </h5>
            <button type="button" class="btn-close btn-close-white" id="btnCloseResetModal"></button>
          </div>

          <div class="modal-body py-3">
            <p class="small text-white-50">Se generará una contraseña temporal de un solo uso para el usuario <strong>${name}</strong> (@${username}). Por seguridad, el usuario deberá cambiarla en su siguiente acceso.</p>
            
            <div class="p-3 rounded bg-white bg-opacity-5 border border-white border-opacity-10 text-center my-3">
              <label class="text-white-50 small d-block mb-1">Nueva Contraseña Temporal</label>
              <h4 class="text-warning font-monospace fw-bold m-0" id="tempPassText">${tempPassword}</h4>
            </div>

            <div class="alert alert-info bg-info bg-opacity-10 border-info border-opacity-25 text-info small mb-0">
              <i class="bi bi-shield-check me-1"></i> Esta acción quedará registrada en el Libro de Auditoría de Trazabilidad DS N° 41.
            </div>
          </div>

          <div class="modal-footer border-top border-light border-opacity-10 pt-3">
            <button type="button" class="btn btn-glass-secondary" id="btnCancelReset">Cancelar</button>
            <button type="button" class="btn btn-glass-primary" id="btnConfirmReset">Aplicar y Notificar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const closeFn = () => { container.innerHTML = ''; };
  document.getElementById('btnCloseResetModal').onclick = closeFn;
  document.getElementById('btnCancelReset').onclick = closeFn;

  document.getElementById('btnConfirmReset').onclick = () => {
    updateUserPasswordInSystem(username, tempPassword);
    logAdminAction('RESET_USER_PASSWORD', { username, name, tempPassword }, 'Administrador Central');
    window.showGlassAlert(`Contraseña temporal actualizada exitosamente para @${username}.`, 'success');
    closeFn();
  };
}

// Modal para Crear Nuevo Perfil desde Administración
function showCreateUserModal() {
  const container = document.getElementById('adminModalContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.7); backdrop-filter: blur(10px); z-index: 1060;">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content glass-card p-4 text-white" style="background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(255,255,255,0.15); border-radius: 24px; max-height: 90vh; overflow-y: auto;">
          <div class="modal-header border-bottom border-light border-opacity-10 pb-3">
            <h5 class="modal-title fw-bold text-info d-flex align-items-center gap-2">
              <i class="bi bi-person-fill-add"></i> Crear Nuevo Perfil en cuidApp
            </h5>
            <button type="button" class="btn-close btn-close-white" id="btnCloseCreateUser"></button>
          </div>

          <form id="formAdminCreateUser" class="modal-body py-3">
            <!-- Selección de Rol -->
            <div class="row g-3 mb-3">
              <div class="col-sm-6">
                <label class="form-label text-white-50 small">Rol en el Ecosistema</label>
                <select id="newUserRole" class="form-select text-white" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15);" required>
                  <option value="patient" class="bg-dark">Paciente (Cualquier Ciclo Vital)</option>
                  <option value="caregiver" class="bg-dark">Cuidador/a Acreditada</option>
                  <option value="doctor" class="bg-dark">Médico Tratante</option>
                  <option value="admin" class="bg-dark">Administrador del Sistema</option>
                </select>
              </div>

              <div class="col-sm-6">
                <label class="form-label text-white-50 small">RUT Chileno</label>
                <input type="text" id="newUserRut" class="form-control text-white" placeholder="Ej. 12.345.678-5" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15);" required>
                <div id="rutValidationFeedback" class="small mt-1" style="display: none;"></div>
              </div>
            </div>

            <!-- Nombres -->
            <div class="row g-3 mb-3">
              <div class="col-sm-6">
                <label class="form-label text-white-50 small">Nombre Legal Completo</label>
                <input type="text" id="newUserName" class="form-control text-white" placeholder="Ej. Juan Andrés Díaz Morales" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15);" required>
              </div>
              <div class="col-sm-6">
                <label class="form-label text-white-50 small">Nombre Social y Pronombres (Ley 21.120)</label>
                <div class="d-flex gap-2">
                  <input type="text" id="newUserSocialName" class="form-control text-white" placeholder="Nombre Social" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15);">
                  <select id="newUserPronouns" class="form-select text-white" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); width: 110px;">
                    <option value="Él" class="bg-dark">Él</option>
                    <option value="Ella" class="bg-dark">Ella</option>
                    <option value="Elle" class="bg-dark">Elle</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Fecha Nacimiento, Sexo, Previsión -->
            <div class="row g-3 mb-3">
              <div class="col-sm-4">
                <label class="form-label text-white-50 small">Fecha de Nacimiento</label>
                <input type="date" id="newUserBirthDate" class="form-control text-white" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15);" required>
              </div>
              <div class="col-sm-4">
                <label class="form-label text-white-50 small">Sexo Biológico</label>
                <select id="newUserGender" class="form-select text-white" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15);">
                  <option value="Masculino" class="bg-dark">Masculino</option>
                  <option value="Femenino" class="bg-dark">Femenino</option>
                  <option value="Intersexual" class="bg-dark">Intersexual</option>
                </select>
              </div>
              <div class="col-sm-4">
                <label class="form-label text-white-50 small">Previsión de Salud</label>
                <select id="newUserPrevision" class="form-select text-white" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15);">
                  <option value="FONASA Tramo A" class="bg-dark">FONASA Tramo A</option>
                  <option value="FONASA Tramo B" class="bg-dark">FONASA Tramo B</option>
                  <option value="FONASA Tramo C" class="bg-dark">FONASA Tramo C</option>
                  <option value="FONASA Tramo D" class="bg-dark">FONASA Tramo D</option>
                  <option value="ISAPRE Colmena" class="bg-dark">ISAPRE Colmena</option>
                  <option value="ISAPRE Banmédica" class="bg-dark">ISAPRE Banmédica</option>
                </select>
              </div>
            </div>

            <!-- Sección Condicional de Tutor Legal para Menores de 18 (Ley 21.430) -->
            <div id="sectionNewUserTutor" class="p-3 rounded-3 mb-3" style="display: none; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25);">
              <label class="fw-bold small text-warning mb-2 d-flex align-items-center gap-1">
                <i class="bi bi-balloon-heart-fill"></i> Tutor Legal Obligatorio (Menor de 18 años — Ley N° 21.430)
              </label>
              <div class="row g-2">
                <div class="col-sm-4">
                  <input type="text" id="newTutorName" class="form-control form-control-sm text-white" placeholder="Nombre Completo Tutor" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15);">
                </div>
                <div class="col-sm-4">
                  <input type="text" id="newTutorRut" class="form-control form-control-sm text-white" placeholder="RUT del Tutor" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15);">
                </div>
                <div class="col-sm-4">
                  <input type="text" id="newTutorRelation" class="form-control form-control-sm text-white" placeholder="Parentesco (Madre/Padre)" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15);">
                </div>
              </div>
            </div>

            <!-- Credenciales de Acceso -->
            <div class="row g-3 mb-3">
              <div class="col-sm-6">
                <label class="form-label text-white-50 small">Usuario de Acceso</label>
                <input type="text" id="newUsername" class="form-control text-white" placeholder="Ej. juandiaz" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15);" required>
              </div>
              <div class="col-sm-6">
                <label class="form-label text-white-50 small">Contraseña</label>
                <input type="password" id="newUserPass" class="form-control text-white" placeholder="Mínimo 6 caracteres" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15);" required>
              </div>
            </div>

            <div class="modal-footer border-top border-light border-opacity-10 pt-3 px-0 pb-0">
              <button type="button" class="btn btn-glass-secondary" id="btnCancelCreateUser">Cancelar</button>
              <button type="submit" class="btn btn-glass-primary px-4">Guardar y Habilitar Perfil</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  const closeFn = () => { container.innerHTML = ''; };
  document.getElementById('btnCloseCreateUser').onclick = closeFn;
  document.getElementById('btnCancelCreateUser').onclick = closeFn;

  // Validación dinámica de RUT
  const rutInput = document.getElementById('newUserRut');
  const rutFeedback = document.getElementById('rutValidationFeedback');
  rutInput.oninput = (e) => {
    const formatted = formatRut(e.target.value);
    e.target.value = formatted;
    if (formatted.length >= 8) {
      const valid = validateChileanRut(formatted);
      rutFeedback.style.display = 'block';
      if (valid) {
        rutFeedback.className = 'small text-success mt-1';
        rutFeedback.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i>RUT chileno válido';
      } else {
        rutFeedback.className = 'small text-danger mt-1';
        rutFeedback.innerHTML = '<i class="bi bi-exclamation-circle-fill me-1"></i>Dígito verificador incorrecto';
      }
    } else {
      rutFeedback.style.display = 'none';
    }
  };

  // Escuchar cambio en fecha de nacimiento para mostrar u ocultar tutor
  const birthInput = document.getElementById('newUserBirthDate');
  const tutorSection = document.getElementById('sectionNewUserTutor');
  birthInput.onchange = (e) => {
    const age = calculateAge(e.target.value);
    if (age < 18) {
      tutorSection.style.display = 'block';
    } else {
      tutorSection.style.display = 'none';
    }
  };

  // Form submission
  document.getElementById('formAdminCreateUser').onsubmit = (e) => {
    e.preventDefault();
    const role = document.getElementById('newUserRole').value;
    const rut = document.getElementById('newUserRut').value.trim();
    const name = document.getElementById('newUserName').value.trim();
    const socialName = document.getElementById('newUserSocialName').value.trim() || name;
    const pronouns = document.getElementById('newUserPronouns').value;
    const birthDate = document.getElementById('newUserBirthDate').value;
    const gender = document.getElementById('newUserGender').value;
    const prevision = document.getElementById('newUserPrevision').value;
    const username = document.getElementById('newUsername').value.trim().toLowerCase();
    const password = document.getElementById('newUserPass').value.trim();
    const age = calculateAge(birthDate);

    if (!validateChileanRut(rut)) {
      window.showGlassAlert('Por favor ingresa un RUT chileno válido con dígito verificador correcto.', 'danger');
      return;
    }

    if (role === 'patient') {
      const isPediatric = age < 18;
      let emergencyContact = { name: 'Contacto de Salud', relation: 'Familiar', phone: '+56912345678' };
      if (isPediatric) {
        const tName = document.getElementById('newTutorName').value.trim();
        const tRut = document.getElementById('newTutorRut').value.trim();
        const tRel = document.getElementById('newTutorRelation').value.trim();
        if (!tName || !tRut) {
          window.showGlassAlert('Para menores de 18 años es obligatorio registrar al Tutor Legal (Ley N° 21.430).', 'warning');
          return;
        }
        emergencyContact = { name: tName, relation: tRel || 'Tutor Legal', phone: '+56912345678', tutorRut: tRut };
      }

      const newPatient = new Patient(
        'p_' + Date.now(),
        name,
        age,
        gender,
        65,
        165,
        'O+',
        ['GENERAL'],
        'Ninguna',
        emergencyContact,
        rut,
        username,
        password,
        socialName,
        pronouns,
        prevision,
        !isPediatric,
        birthDate,
        '+56912345678'
      );

      registerPatientInDatabase(newPatient);
      logAdminAction('CREATE_PATIENT_PROFILE', { username, name, rut, age, isPediatric }, 'Administrador Central', newPatient.id);
    } else if (role === 'caregiver') {
      const newCaregiver = new Caregiver(
        'c_' + Date.now(),
        name,
        `${username}@cuidapp.com`,
        PATIENTS_DATABASE[0] ? PATIENTS_DATABASE[0].id : 'p1',
        username,
        password,
        rut,
        birthDate,
        '+56912345678'
      );
      CAREGIVERS_DATABASE.push(newCaregiver);

      // Persistir cuidador dinámico
      try {
        const rawC = localStorage.getItem('cuidapp_custom_caregivers');
        const listC = rawC ? JSON.parse(rawC) : [];
        listC.push(newCaregiver);
        localStorage.setItem('cuidapp_custom_caregivers', JSON.stringify(listC));
      } catch (e) {}

      logAdminAction('CREATE_CAREGIVER_PROFILE', { username, name, rut }, 'Administrador Central');
    } else {
      // Guardar en cuidapp_custom_users
      try {
        const rawUsers = localStorage.getItem('cuidapp_custom_users');
        const userList = rawUsers ? JSON.parse(rawUsers) : [];
        userList.push({
          id: 'usr_' + Date.now(),
          username,
          password,
          role,
          name,
          socialName,
          pronouns,
          rut,
          birthDate,
          age,
          gender,
          prevision,
          createdAt: new Date().toISOString()
        });
        localStorage.setItem('cuidapp_custom_users', JSON.stringify(userList));
      } catch (e) {}

      logAdminAction('CREATE_STAFF_PROFILE', { username, name, rut, role }, 'Administrador Central');
    }

    window.showGlassAlert(`Perfil de ${socialName} creado exitosamente.`, 'success');
    closeFn();
    renderCurrentSubTab();
  };
}

// ============================================================================
// PESTAÑA 3: GESTIÓN DE VÍNCULOS LEGALES & TUTORES (LEY 20.584 / LEY 21.430)
// ============================================================================
function renderLinksTab(workspace) {
  const assignments = getCaregiverAssignments();
  const allUsers = getAllSystemUsers();
  const minors = allUsers.filter(u => u.role === 'patient' && (u.age < 18 || u.rawObject?.isPediatric));

  workspace.innerHTML = `
    <!-- Alerta Informativa del Marco Jurídico -->
    <div class="alert alert-info bg-info bg-opacity-10 border-info border-opacity-25 text-white small p-3 rounded-3 mb-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
      <div class="d-flex align-items-center gap-2">
        <i class="bi bi-shield-lock-fill fs-4 text-info"></i>
        <div>
          <strong class="text-info d-block">Control de Acceso Estricto y Trazabilidad de Vínculos de Salud</strong>
          <span>Según la Ley N° 20.584 y Ley N° 19.628, los cuidadores SOLO pueden consultar fichas de pacientes formalmente vinculados. Para menores de edad rige la tutela acreditada de la Ley N° 21.430.</span>
        </div>
      </div>
      <button id="btnNewAssignment" class="btn btn-sm btn-glass-primary px-3 py-2">
        <i class="bi bi-link-45deg me-1"></i> Formalizar Nueva Asignación
      </button>
    </div>

    <!-- SECCIÓN 1: Vínculos Cuidador ↔ Paciente -->
    <div class="mb-5">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h5 class="fw-bold m-0 text-white d-flex align-items-center gap-2">
          <i class="bi bi-person-heart text-info"></i> Asignaciones Cuidador/a ↔ Paciente (Ley N° 20.584)
        </h5>
        <span class="badge-glass bg-info bg-opacity-25 text-info border-info small">${assignments.filter(a => a.status === 'activo').length} vínculos vigentes</span>
      </div>

      <div class="table-responsive">
        <table class="table table-dark table-hover bg-transparent text-white align-middle" style="--bs-table-bg: transparent; --bs-table-border-color: rgba(255,255,255,0.08);">
          <thead>
            <tr>
              <th scope="col" class="text-white-50">Cuidador/a Acreditada</th>
              <th scope="col" class="text-white-50">Paciente Vinculado</th>
              <th scope="col" class="text-white-50">Fundamento Legal Acreditado</th>
              <th scope="col" class="text-white-50">Fecha Asignación</th>
              <th scope="col" class="text-white-50">Estado</th>
              <th scope="col" class="text-white-50 text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${assignments.map(a => {
              const isRevoked = a.status === 'revocado';
              return `
                <tr style="${isRevoked ? 'opacity: 0.55;' : ''}">
                  <td>
                    <div class="fw-bold">${a.caregiverName}</div>
                    <small class="text-white-50 font-monospace">${a.caregiverRut || 'RUT Acreditado'}</small>
                  </td>
                  <td>
                    <div class="fw-bold text-info">${a.patientName}</div>
                    <small class="text-warning font-monospace">${a.patientRut || 'RUT Paciente'}</small>
                  </td>
                  <td>
                    <span class="small d-block text-white text-opacity-80">${a.legalBasis}</span>
                    <small class="text-white-50" style="font-size: 0.72rem;">${a.scope || 'Acceso asistencial estándar'}</small>
                  </td>
                  <td>
                    <span class="small">${a.assignedDate ? a.assignedDate.split('T')[0] : '2026-01-15'}</span>
                  </td>
                  <td style="white-space: nowrap;">
                    ${isRevoked ? `
                      <span class="badge-glass bg-danger bg-opacity-25 text-danger border-danger small" style="display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;">
                        <i class="bi bi-x-circle"></i><span>Revocado</span>
                      </span>
                    ` : `
                      <span class="badge-glass bg-success bg-opacity-25 text-success border-success small" style="display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;">
                        <i class="bi bi-check-circle-fill"></i><span>Vigente</span>
                      </span>
                    `}
                  </td>
                  <td class="text-end">
                    ${isRevoked ? `
                      <button class="btn btn-sm btn-glass-primary reactivate-asgn-btn" data-id="${a.id}">Reactivar</button>
                    ` : `
                      <button class="btn btn-sm btn-glass-danger revoke-asgn-btn" data-id="${a.id}">Revocar Acceso</button>
                    `}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- SECCIÓN 2: Tutores Legales Acreditados de Menores de Edad (Ley 21.430) -->
    <div>
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 class="fw-bold m-0 text-white d-flex align-items-center gap-2">
            <i class="bi bi-balloon-heart text-warning"></i> Tutores Legales Acreditados de Menores (Ley N° 21.430)
          </h5>
          <small class="text-white-50">Representación formal para consentimientos y atenciones pediátricas</small>
        </div>
        <span class="badge-glass bg-warning bg-opacity-25 text-warning border-warning small">${minors.length} menor(es) en seguimiento</span>
      </div>

      <div class="table-responsive">
        <table class="table table-dark table-hover bg-transparent text-white align-middle" style="--bs-table-bg: transparent; --bs-table-border-color: rgba(255,255,255,0.08);">
          <thead>
            <tr>
              <th scope="col" class="text-white-50">Paciente Pediátrico / Adolescente</th>
              <th scope="col" class="text-white-50" style="white-space: nowrap;">Edad / Ciclo Vital</th>
              <th scope="col" class="text-white-50">Tutor Legal Acreditado</th>
              <th scope="col" class="text-white-50" style="white-space: nowrap;">Parentesco / Mandato</th>
              <th scope="col" class="text-white-50" style="white-space: nowrap;">Contacto Directo</th>
              <th scope="col" class="text-white-50 text-end" style="white-space: nowrap;">Acreditación</th>
            </tr>
          </thead>
          <tbody>
            ${minors.map(m => {
              const tutor = m.tutorLegal || m.emergencyContact || { name: 'Tutor Acreditado', relation: 'Madre', phone: '+56912345678' };
              const relText = tutor.relation ? (tutor.relation.toLowerCase().includes('tutor') || tutor.relation.toLowerCase().includes('legal') ? tutor.relation : `${tutor.relation} • Tutora`) : 'Tutora Legal';
              return `
                <tr>
                  <td style="white-space: nowrap;">
                    <div class="fw-bold text-info">${m.socialName || m.name}</div>
                    <small class="text-warning font-monospace" style="white-space: nowrap;">${m.rut}</small>
                  </td>
                  <td style="white-space: nowrap;">
                    ${getLifecycleDisplayHtml(m)}
                  </td>
                  <td style="white-space: nowrap;">
                    <div class="fw-bold text-white">${tutor.name}</div>
                    <small class="text-white-50 font-monospace" style="white-space: nowrap;">${tutor.tutorRut || 'RUT Acreditado'}</small>
                  </td>
                  <td style="white-space: nowrap;">
                    <span class="text-white text-opacity-90 fw-medium" style="white-space: nowrap;">${relText}</span>
                  </td>
                  <td style="white-space: nowrap;">
                    <code class="text-light" style="white-space: nowrap;">${tutor.phone}</code>
                  </td>
                  <td class="text-end" style="white-space: nowrap;">
                    <span class="badge-glass px-2.5 py-1 rounded-2" style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); font-size: 0.74rem; color: #34d399 !important; font-weight: 500; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">
                      <span>✅</span> <span>Acreditada</span>
                    </span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Listeners
  const btnNew = document.getElementById('btnNewAssignment');
  if (btnNew) {
    btnNew.onclick = () => {
      showNewAssignmentModal();
    };
  }

  workspace.querySelectorAll('.revoke-asgn-btn').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-id');
      const reason = prompt('Indica el motivo de la revocación de acceso (conforme al DS N° 41):', 'Término de funciones / Solicitud familiar');
      if (reason) {
        revokeCaregiverAssignment(id, reason);
        window.showGlassAlert('Vínculo de acceso revocado inmediatamente.', 'warning');
        renderLinksTab(workspace);
      }
    };
  });

  workspace.querySelectorAll('.reactivate-asgn-btn').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-id');
      const assignments = getCaregiverAssignments();
      const asgn = assignments.find(a => a.id === id);
      if (asgn) {
        asgn.status = 'activo';
        saveCaregiverAssignment(asgn);
        window.showGlassAlert('Vínculo legal reactivado exitosamente.', 'success');
        renderLinksTab(workspace);
      }
    };
  });
}

// Modal para Formalizar Nueva Asignación Cuidador ↔ Paciente
function showNewAssignmentModal() {
  const container = document.getElementById('adminModalContainer');
  if (!container) return;

  const caregivers = CAREGIVERS_DATABASE;
  const patients = PATIENTS_DATABASE;

  container.innerHTML = `
    <div class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.7); backdrop-filter: blur(10px); z-index: 1060;">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content glass-card p-4 text-white" style="background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(255,255,255,0.15); border-radius: 24px;">
          <div class="modal-header border-bottom border-light border-opacity-10 pb-3">
            <h5 class="modal-title fw-bold text-info d-flex align-items-center gap-2">
              <i class="bi bi-link-45deg"></i> Formalizar Asignación Cuidador ↔ Paciente
            </h5>
            <button type="button" class="btn-close btn-close-white" id="btnCloseNewAsgn"></button>
          </div>

          <form id="formNewAssignment" class="modal-body py-3">
            <div class="mb-3">
              <label class="form-label text-white-50 small">Cuidador/a Acreditada</label>
              <select id="asgnCaregiverSelect" class="form-select text-white" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15);" required>
                ${caregivers.map(c => `
                  <option value="${c.id}" class="bg-dark">${c.name} (${c.rut || 'RUT Acreditado'})</option>
                `).join('')}
              </select>
            </div>

            <div class="mb-3">
              <label class="form-label text-white-50 small">Paciente Titular</label>
              <select id="asgnPatientSelect" class="form-select text-white" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15);" required>
                ${patients.map(p => `
                  <option value="${p.id}" class="bg-dark">${p.name} (RUT: ${p.fileNumber})</option>
                `).join('')}
              </select>
            </div>

            <div class="mb-3">
              <label class="form-label text-white-50 small">Fundamento Legal / Documento Acreditado</label>
              <select id="asgnLegalBasis" class="form-select text-white" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15);">
                <option value="Consentimiento Informado Escrito (Ley N° 20.584)" class="bg-dark">Consentimiento Informado Escrito (Ley N° 20.584)</option>
                <option value="Poder Notarial de Cuidados de Salud" class="bg-dark">Poder Notarial de Cuidados de Salud</option>
                <option value="Mandato Familiar / Representación Legal" class="bg-dark">Mandato Familiar / Representación Legal</option>
                <option value="Resolución Judicial de Curaduría" class="bg-dark">Resolución Judicial de Curaduría</option>
              </select>
            </div>

            <div class="mb-3">
              <label class="form-label text-white-50 small">Alcance del Acceso Asistencial</label>
              <input type="text" id="asgnScope" class="form-control text-white" value="Acceso Integral a Bitácora, Signos Vitales y Adherencia Farmacológica" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15);" required>
            </div>

            <div class="modal-footer border-top border-light border-opacity-10 pt-3 px-0 pb-0">
              <button type="button" class="btn btn-glass-secondary" id="btnCancelNewAsgn">Cancelar</button>
              <button type="submit" class="btn btn-glass-primary px-4">Guardar Asignación</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  const closeFn = () => { container.innerHTML = ''; };
  document.getElementById('btnCloseNewAsgn').onclick = closeFn;
  document.getElementById('btnCancelNewAsgn').onclick = closeFn;

  document.getElementById('formNewAssignment').onsubmit = (e) => {
    e.preventDefault();
    const cId = document.getElementById('asgnCaregiverSelect').value;
    const pId = document.getElementById('asgnPatientSelect').value;
    const legalBasis = document.getElementById('asgnLegalBasis').value;
    const scope = document.getElementById('asgnScope').value.trim();

    const caregiver = caregivers.find(c => c.id === cId);
    const patient = patients.find(p => p.id === pId);

    const newAssignment = {
      id: 'asgn_' + Date.now(),
      caregiverId: cId,
      caregiverUsername: caregiver ? caregiver.username : '',
      caregiverName: caregiver ? caregiver.name : 'Cuidador',
      caregiverRut: caregiver ? caregiver.rut : '',
      patientId: pId,
      patientName: patient ? patient.name : 'Paciente',
      patientRut: patient ? patient.fileNumber : '',
      legalBasis,
      scope,
      assignedDate: new Date().toISOString(),
      status: 'activo'
    };

    saveCaregiverAssignment(newAssignment);
    window.showGlassAlert(`Asignación legal formalizada entre ${newAssignment.caregiverName} y ${newAssignment.patientName}.`, 'success');
    closeFn();
    renderCurrentSubTab();
  };
}

// ============================================================================
// EXPORTADOR OFICIAL DE REPORTE DE AUDITORÍA PDF / IMPRESIÓN (DS N° 41 MINSAL)
// ============================================================================
function exportAuditPdfReport(logs) {
  const printWindow = window.open('', '_blank', 'width=1150,height=800');
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }) + ' - ' + now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const rowsHtml = (logs && logs.length > 0) ? logs.map((l, index) => {
    const dateStr = l.timestamp ? l.timestamp.replace('T', ' ').substring(0, 19) : '--';
    const isAlert = l.alertLevel === 'critico' || l.alertLevel === 'advertencia';
    return `
      <tr>
        <td style="text-align: center; font-weight: 700; width: 35px; color: #475569;">${index + 1}</td>
        <td>
          <div style="font-weight: 700; color: #0369a1; font-size: 8.5pt;">${l.eventCategory || 'EVENTO'}</div>
          <div style="font-family: monospace; font-size: 7pt; color: #64748b; margin-top: 2px;">${l.legalSeal || 'DS41-MINSAL'}</div>
        </td>
        <td>
          <div style="font-weight: 600; color: #0f172a;">${l.operator || 'Operador'}</div>
          <div style="font-size: 7.5pt; color: #64748b;">${l.roleLabel || 'Personal'}</div>
        </td>
        <td>
          <div style="font-weight: 600; color: #0f172a;">${l.patientName || 'N/A'}</div>
          <div style="font-family: monospace; font-size: 7.5pt; color: #b45309;">${l.patientRut || '--'}</div>
        </td>
        <td style="font-family: monospace; font-size: 8pt; white-space: nowrap; color: #334155;">${dateStr}</td>
        <td style="font-size: 8.5pt; line-height: 1.35; ${isAlert ? 'color: #b91c1c; font-weight: 600;' : 'color: #1e293b;'}">
          ${l.summary || '--'}
        </td>
      </tr>
    `;
  }).join('') : `
    <tr>
      <td colspan="6" style="text-align: center; padding: 30px; color: #64748b;">
        No hay registros de auditoría que coincidan con los filtros aplicados.
      </td>
    </tr>
  `;

  const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>cuidApp • Reporte de Trazabilidad DS N° 41 MINSAL</title>
  <style>
    @page {
      size: landscape A4;
      margin: 12mm 14mm 14mm 14mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 24px;
      font-size: 9pt;
    }
    .print-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-bottom: 18px;
    }
    .btn-action {
      font-family: inherit;
      font-size: 9pt;
      padding: 7px 15px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      border: 1px solid transparent;
      transition: all 0.15s ease;
    }
    .btn-print {
      background: #0284c7;
      color: #ffffff;
    }
    .btn-print:hover {
      background: #0369a1;
    }
    .btn-close {
      background: #f1f5f9;
      color: #334155;
      border-color: #cbd5e1;
    }
    .report-header {
      border-bottom: 2px solid #0284c7;
      padding-bottom: 12px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .brand-title {
      font-size: 15pt;
      font-weight: 800;
      color: #0369a1;
      margin: 0 0 4px 0;
      letter-spacing: -0.3px;
    }
    .brand-subtitle {
      font-size: 9.5pt;
      font-weight: 600;
      color: #475569;
      margin: 0;
    }
    .meta-details {
      text-align: right;
      font-size: 8pt;
      color: #475569;
      line-height: 1.45;
    }
    .meta-details strong {
      color: #0f172a;
    }
    .summary-strip {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #0284c7;
      padding: 7px 12px;
      margin-bottom: 14px;
      font-size: 8pt;
      display: flex;
      justify-content: space-between;
      border-radius: 3px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
    }
    th {
      background: #0f172a;
      color: #ffffff;
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 7px 8px;
      border: 1px solid #0f172a;
      text-align: left;
    }
    td {
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      vertical-align: top;
      background: #ffffff;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    .report-footer {
      font-size: 7.5pt;
      color: #64748b;
      text-align: center;
      margin-top: 18px;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
    }
    @media print {
      body {
        padding: 0;
      }
      .no-print, .print-actions {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-actions no-print">
    <button class="btn-action btn-print" onclick="window.print()">📄 Guardar como PDF / Imprimir</button>
    <button class="btn-action btn-close" onclick="window.close()">Cerrar</button>
  </div>

  <div class="report-header">
    <div>
      <h1 class="brand-title">cuidApp • Reporte de Trazabilidad DS N° 41 MINSAL</h1>
      <p class="brand-subtitle">Pistas de Auditoría y Control de Acceso a Fichas Clínicas (Ley N° 20.584 / Ley N° 19.628)</p>
    </div>
    <div class="meta-details">
      <div><strong>Fecha de Emisión:</strong> ${dateFormatted}</div>
      <div><strong>Marco Normativo:</strong> DS N° 41 MINSAL (Reglamento de Ficha Clínica)</div>
      <div><strong>Ambiente:</strong> Plataforma cuidApp Producción Segura</div>
    </div>
  </div>

  <div class="summary-strip">
    <span><strong>Filtro Actual:</strong> Registros seleccionados en vista activa</span>
    <span><strong>Total de Registros Emitidos:</strong> ${logs.length} evento(s)</span>
    <span><strong>Integridad de Trazabilidad:</strong> Sello criptográfico verificado</span>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 30px; text-align: center;">#</th>
        <th style="width: 175px;">Sello / Evento (DS N° 41)</th>
        <th style="width: 175px;">Autor / Operador</th>
        <th style="width: 175px;">Paciente Afectado</th>
        <th style="width: 125px;">Fecha & Hora ISO</th>
        <th>Detalle de Trazabilidad</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="report-footer">
    Documento oficial generado para fines de fiscalización sanitaria y trazabilidad clínica electrónica conforme al DS N° 41 MINSAL. 
    Prohibida su alteración o adulteración. cuidApp Medical System.
  </div>

  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 350);
    });
  </script>
</body>
</html>`;

  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  } else {
    // Fallback directo en ventana actual si ventanas emergentes están bloqueadas
    window.print();
  }
}

// ============================================================================
// COMPROBANTE INDIVIDUAL DE AUDITORÍA PDF (LEY N° 19.628 / DS N° 41 MINSAL)
// ============================================================================
function exportSingleAuditPdfCertificate(log) {
  const printWindow = window.open('', '_blank', 'width=920,height=850');
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }) + ' - ' + now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const eventDateStr = log.timestamp ? log.timestamp.replace('T', ' ').substring(0, 19) : '--';
  const isAlert = log.alertLevel === 'critico' || log.alertLevel === 'advertencia';

  const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Comprobante de Trazabilidad Clínica • ${log.legalSeal || 'DS41'}</title>
  <style>
    @page {
      size: portrait A4;
      margin: 15mm 20mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 30px;
      font-size: 10pt;
      line-height: 1.5;
    }
    .print-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-bottom: 25px;
    }
    .btn-action {
      font-family: inherit;
      font-size: 9.5pt;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      border: 1px solid transparent;
      transition: all 0.15s ease;
    }
    .btn-print {
      background: #0284c7;
      color: #ffffff;
    }
    .btn-print:hover {
      background: #0369a1;
    }
    .btn-close {
      background: #f1f5f9;
      color: #334155;
      border-color: #cbd5e1;
    }
    .cert-container {
      border: 2px solid #0284c7;
      border-radius: 8px;
      padding: 28px;
      position: relative;
      background: #ffffff;
    }
    .cert-header {
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 16px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .cert-title {
      font-size: 15pt;
      font-weight: 800;
      color: #0369a1;
      margin: 0 0 6px 0;
      letter-spacing: -0.3px;
    }
    .cert-subtitle {
      font-size: 9pt;
      font-weight: 600;
      color: #475569;
      margin: 0;
    }
    .cert-seal {
      background: #e0f2fe;
      color: #0369a1;
      border: 1px solid #bae6fd;
      padding: 4px 10px;
      border-radius: 6px;
      font-family: monospace;
      font-size: 8.5pt;
      font-weight: 700;
      display: inline-block;
      margin-top: 8px;
    }
    .cert-meta-right {
      text-align: right;
      font-size: 8.5pt;
      color: #475569;
      line-height: 1.45;
    }
    .section-title {
      font-size: 9pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0369a1;
      margin-bottom: 10px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
    }
    .data-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }
    .data-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px 14px;
    }
    .data-card-full {
      grid-column: span 2;
    }
    .field-label {
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: #64748b;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .field-value {
      font-size: 10pt;
      font-weight: 600;
      color: #0f172a;
    }
    .field-sub {
      font-size: 8.5pt;
      color: #475569;
      margin-top: 2px;
    }
    .law-notice {
      background: #f0fdf4;
      border-left: 4px solid #16a34a;
      border-radius: 4px;
      padding: 12px 14px;
      font-size: 8.5pt;
      color: #166534;
      margin-top: 18px;
      margin-bottom: 22px;
      line-height: 1.45;
    }
    .cert-footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-top: 1px solid #e2e8f0;
      padding-top: 18px;
      font-size: 8pt;
      color: #64748b;
    }
    .signature-box {
      text-align: center;
      width: 220px;
    }
    .signature-line {
      border-top: 1px solid #0f172a;
      margin-bottom: 6px;
    }
    @media print {
      body {
        padding: 0;
      }
      .no-print, .print-actions {
        display: none !important;
      }
      .cert-container {
        border-color: #000000;
      }
    }
  </style>
</head>
<body>
  <div class="print-actions no-print">
    <button class="btn-action btn-print" onclick="window.print()">📄 Guardar como PDF / Imprimir</button>
    <button class="btn-action btn-close" onclick="window.close()">Cerrar</button>
  </div>

  <div class="cert-container">
    <div class="cert-header">
      <div>
        <h1 class="cert-title">CERTIFICADO INDIVIDUAL DE TRAZABILIDAD</h1>
        <p class="cert-subtitle">Registro Oficial Inmutable de Acceso y Modificación de Ficha Clínica</p>
        <div class="cert-seal">SELLO: ${log.legalSeal || 'DS41-MINSAL-CHILE'}</div>
      </div>
      <div class="cert-meta-right">
        <div><strong>Fecha de Emisión:</strong> ${dateFormatted}</div>
        <div><strong>Folio Oficial:</strong> CUID-${Date.now().toString().slice(-6)}</div>
        <div><strong>Normativa:</strong> Ley N° 19.628 & DS N° 41 MINSAL</div>
      </div>
    </div>

    <div class="section-title">Detalle del Registro de Auditoría de Trazabilidad</div>

    <div class="data-grid">
      <div class="data-card">
        <div class="field-label">Sello / Categoría del Evento (DS N° 41)</div>
        <div class="field-value" style="color: #0369a1;">${log.eventCategory || 'AUDITORÍA CLÍNICA'}</div>
        <div class="field-sub font-monospace">${log.legalSeal || 'DS41-MINSAL'}</div>
      </div>

      <div class="data-card">
        <div class="field-label">Autor / Operador Responsable</div>
        <div class="field-value">${log.operator || 'Operador Registrado'}</div>
        <div class="field-sub">Rol en cuidApp: ${log.roleLabel || 'Personal Clínico'}</div>
      </div>

      <div class="data-card">
        <div class="field-label">Paciente Afectado (Titular de Datos)</div>
        <div class="field-value">${log.patientName || 'N/A'}</div>
        <div class="field-sub font-monospace" style="color: #b45309;">RUT: ${log.patientRut || '--'}</div>
      </div>

      <div class="data-card">
        <div class="field-label">Fecha & Hora del Suceso (ISO 8601)</div>
        <div class="field-value font-monospace" style="font-size: 9.5pt;">${eventDateStr}</div>
        <div class="field-sub">Estampa horaria sincronizada NTP oficial</div>
      </div>

      <div class="data-card data-card-full">
        <div class="field-label">Detalle Clínico / Operativo Registrado</div>
        <div class="field-value" style="font-size: 9.5pt; font-weight: 500; line-height: 1.45; ${isAlert ? 'color: #b91c1c;' : 'color: #0f172a;'}">
          ${log.summary || '--'}
        </div>
      </div>
    </div>

    <div class="law-notice">
      <strong>⚖️ Respaldo y Cumplimiento Legal (Ley N° 19.628 & Ley N° 20.584):</strong><br>
      Este comprobante certifica la trazabilidad estricta e inmutable del acceso a los datos sensibles de salud del paciente, garantizando confidencialidad y control conforme al Artículo 10° de la Ley N° 19.628 sobre Protección de la Vida Privada y a los Artículos 8° y 13° del DS N° 41/2012 del MINSAL. Prohibida su alteración o adulteración.
    </div>

    <div class="cert-footer">
      <div>
        <div><strong>Plataforma:</strong> cuidApp Sistema Asistencial & Telecuidado v2.4</div>
        <div><strong>Validación Criptográfica:</strong> SHA-256 Sello Inmutable</div>
      </div>
      <div class="signature-box">
        <div class="signature-line"></div>
        <div>Firma y Sello de Auditoría cuidApp</div>
        <div style="font-size: 7.5pt; color: #94a3b8;">Oficial de Seguridad de la Información</div>
      </div>
    </div>
  </div>

  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 350);
    });
  </script>
</body>
</html>`;

  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  } else {
    window.print();
  }
}

// ============================================================================
// PESTAÑA 4: AUDITORÍA DE TRAZABILIDAD CONSOLIDADA (DECRETO SUPREMO N° 41)
// ============================================================================
function renderAuditTab(workspace) {
  const allLogs = getConsolidatedAuditLogs();

  // Filtros reactivos
  const filteredLogs = allLogs.filter(log => {
    // Filtro por rol
    if (auditFilterRole !== 'all' && log.role !== auditFilterRole) return false;
    // Filtro por tipo
    if (auditFilterType !== 'all' && log.eventType !== auditFilterType) return false;
    // Filtro por búsqueda
    if (auditSearchQuery) {
      const q = auditSearchQuery.toLowerCase();
      const matchOp = log.operator.toLowerCase().includes(q);
      const matchPat = (log.patientName || '').toLowerCase().includes(q);
      const matchRut = (log.patientRut || '').toLowerCase().includes(q);
      const matchSumm = log.summary.toLowerCase().includes(q);
      if (!matchOp && !matchPat && !matchRut && !matchSumm) return false;
    }
    return true;
  });

  workspace.innerHTML = `
    <!-- Encabezado Institucional Exclusivo para Impresión Directa (@media print) -->
    <div class="d-none d-print-block mb-3 border-bottom pb-2">
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <h4 class="fw-bold mb-0 text-dark">cuidApp • Reporte de Trazabilidad DS N° 41 MINSAL</h4>
          <small class="text-muted">Registro Oficial de Pistas de Auditoría y Acceso a Ficha Clínica Electrónica</small>
        </div>
        <div class="text-end text-muted small">
          <div>Fecha de Emisión: ${new Date().toLocaleDateString('es-CL')} ${new Date().toLocaleTimeString('es-CL')}</div>
          <div>DS N° 41 / Ley N° 20.584 / Ley N° 19.628</div>
        </div>
      </div>
    </div>

    <!-- Barra Superior de Filtros y Acciones de Trazabilidad -->
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4 pb-3 border-bottom border-light border-opacity-10">
      <div class="d-flex flex-wrap align-items-center gap-2">
        <!-- Buscador -->
        <div class="input-group input-group-sm" style="max-width: 280px;">
          <span class="input-group-text bg-transparent border-light border-opacity-25 text-white-50"><i class="bi bi-search"></i></span>
          <input type="text" id="auditSearchInput" class="form-control bg-transparent border-light border-opacity-25 text-white" placeholder="Buscar en auditoría..." value="${auditSearchQuery}">
        </div>

        <!-- Filtro Rol -->
        <select id="auditRoleSelect" class="form-select form-select-sm text-white" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); width: auto;">
          <option value="all" class="bg-dark" ${auditFilterRole === 'all' ? 'selected' : ''}>Todos los Roles</option>
          <option value="cuidador" class="bg-dark" ${auditFilterRole === 'cuidador' ? 'selected' : ''}>Cuidadora</option>
          <option value="medico" class="bg-dark" ${auditFilterRole === 'medico' ? 'selected' : ''}>Médico</option>
          <option value="iot" class="bg-dark" ${auditFilterRole === 'iot' ? 'selected' : ''}>Monitor IoT</option>
          <option value="admin" class="bg-dark" ${auditFilterRole === 'admin' ? 'selected' : ''}>Administrador</option>
        </select>

        <!-- Filtro Tipo de Evento -->
        <select id="auditTypeSelect" class="form-select form-select-sm text-white" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); width: auto;">
          <option value="all" class="bg-dark" ${auditFilterType === 'all' ? 'selected' : ''}>Todos los Eventos</option>
          <option value="CLINICAL_LOG" class="bg-dark" ${auditFilterType === 'CLINICAL_LOG' ? 'selected' : ''}>Evaluaciones Clínicas</option>
          <option value="ECG_ALERT" class="bg-dark" ${auditFilterType === 'ECG_ALERT' ? 'selected' : ''}>Alertas Críticas ECG</option>
          <option value="PRESCRIPTION" class="bg-dark" ${auditFilterType === 'PRESCRIPTION' ? 'selected' : ''}>Recetas Médicas</option>
          <option value="MEDICAL_EVOLUTION" class="bg-dark" ${auditFilterType === 'MEDICAL_EVOLUTION' ? 'selected' : ''}>Evoluciones Médicas</option>
          <option value="ADMIN_AUDIT" class="bg-dark" ${auditFilterType === 'ADMIN_AUDIT' ? 'selected' : ''}>Auditoría Admin</option>
          <option value="SESSION_ACCESS" class="bg-dark" ${auditFilterType === 'SESSION_ACCESS' ? 'selected' : ''}>Accesos de Sesión</option>
        </select>

        <span class="text-white-50 small ms-2">${filteredLogs.length} registro(s)</span>
      </div>

      <!-- Exportar Reporte de Auditoría -->
      <div class="d-flex gap-2">
        <button id="btnExportAuditJson" class="btn btn-sm btn-glass-secondary px-3 py-2">
          <i class="bi bi-download me-1"></i> Exportar JSON
        </button>
        <button id="btnPrintAuditReport" class="btn btn-sm btn-glass-primary px-3 py-2">
          📄 Exportar Informe PDF
        </button>
      </div>
    </div>

    <!-- Tabla Consolidada de Auditoría de Trazabilidad -->
    <div class="table-responsive">
      <table class="table table-dark table-hover bg-transparent text-white align-middle" style="--bs-table-bg: transparent; --bs-table-border-color: rgba(255,255,255,0.08);">
        <thead>
          <tr>
            <th scope="col" class="text-white-50">Sello / Evento (DS N° 41)</th>
            <th scope="col" class="text-white-50">Autor / Operador</th>
            <th scope="col" class="text-white-50">Paciente Afectado</th>
            <th scope="col" class="text-white-50">Fecha & Hora ISO</th>
            <th scope="col" class="text-white-50">Detalle de Trazabilidad</th>
            <th scope="col" class="text-white-50 text-center" style="width: 110px;">Comprobante</th>
          </tr>
        </thead>
        <tbody>
          ${filteredLogs.length === 0 ? `
            <tr>
              <td colspan="6" class="text-center py-4 text-white-50">
                <i class="bi bi-inbox fs-3 d-block mb-2"></i>
                No se encontraron registros de auditoría que coincidan con los filtros aplicados.
              </td>
            </tr>
          ` : filteredLogs.map((l, index) => {
            const dateStr = l.timestamp ? l.timestamp.replace('T', ' ').substring(0, 19) : '--';
            const isAlert = l.alertLevel === 'critico' || l.alertLevel === 'advertencia';

            return `
              <tr>
                <td>
                  <span class="badge-glass ${l.badgeClass} small d-inline-flex align-items-center gap-1" style="font-size: 0.72rem;">
                    <i class="bi ${l.icon}"></i> ${l.eventCategory}
                  </span>
                  <div class="text-white text-opacity-40 font-monospace mt-1" style="font-size: 0.65rem;">${l.legalSeal}</div>
                </td>

                <td>
                  <div class="fw-bold">${l.operator}</div>
                  <span class="badge-glass bg-white bg-opacity-10 text-white-50 border-white border-opacity-10 small" style="font-size: 0.65rem;">${l.roleLabel}</span>
                </td>

                <td>
                  <div class="fw-semibold text-info">${l.patientName}</div>
                  <small class="text-warning font-monospace" style="font-size: 0.72rem;">${l.patientRut}</small>
                </td>

                <td>
                  <code class="text-white-50" style="font-size: 0.78rem;">${dateStr}</code>
                </td>

                <td>
                  <div class="small ${isAlert ? 'text-danger fw-semibold' : 'text-white text-opacity-80'}" style="max-width: 420px; line-height: 1.35;">
                    ${l.summary}
                  </div>
                </td>

                <td class="text-center">
                  <button class="btn btn-sm btn-glass-secondary px-2 py-1 btn-single-audit-pdf" data-index="${index}" title="Comprobante Individual de Trazabilidad (Ley N° 19.628)" style="font-size: 0.72rem; white-space: nowrap;">
                    📄 PDF
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Listeners
  const searchInput = document.getElementById('auditSearchInput');
  const roleSelect = document.getElementById('auditRoleSelect');
  const typeSelect = document.getElementById('auditTypeSelect');
  const btnExport = document.getElementById('btnExportAuditJson');
  const btnPrint = document.getElementById('btnPrintAuditReport');

  if (searchInput) {
    searchInput.oninput = (e) => {
      auditSearchQuery = e.target.value.trim();
      renderAuditTab(workspace);
    };
  }

  if (roleSelect) {
    roleSelect.onchange = (e) => {
      auditFilterRole = e.target.value;
      renderAuditTab(workspace);
    };
  }

  if (typeSelect) {
    typeSelect.onchange = (e) => {
      auditFilterType = e.target.value;
      renderAuditTab(workspace);
    };
  }

  if (btnExport) {
    btnExport.onclick = () => {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `auditoria_trazabilidad_cuidapp_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      window.showGlassAlert('Informe de trazabilidad exportado en formato JSON inmutable.', 'success');
    };
  }

  if (btnPrint) {
    btnPrint.onclick = () => {
      exportAuditPdfReport(filteredLogs);
    };
  }

  // Listeners para comprobantes individuales de trazabilidad (Ley N° 19.628 / DS N° 41)
  workspace.querySelectorAll('.btn-single-audit-pdf').forEach(btn => {
    btn.onclick = (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
      const singleLog = filteredLogs[idx];
      if (singleLog) {
        exportSingleAuditPdfCertificate(singleLog);
      }
    };
  });
}

// --- COMPATIBILIDAD CON EXPORTACIONES PREVIAS ---
export function renderCrudTable() {
  const workspace = document.getElementById('adminWorkspaceArea');
  if (workspace) renderUsersTab(workspace);
}

export function showCrudForm() {
  showCreateUserModal();
}

// Alias principal de exportación
export const renderAdmin = renderManagementView;
