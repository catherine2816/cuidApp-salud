/**
 * @fileoverview Portal Odontológico Integral y Odontograma Digital - cuidApp
 * @module src/odontologia.js
 * @description Gestión de salud bucal según nomenclatura FDI (Federación Dental Internacional):
 * - Odontograma interactivo anatómico para dentición permanente y temporal/pediátrica
 * - Registro de caries, restauraciones con ionómero/resina, sellantes y exodoncias
 * - Visor comparativo radiográfico antes/después y presupuestos GES odontológicos
 *
 * @compliance
 * - Ley N° 20.584: Consentimiento informado en procedimientos dentales
 * - Ley N° 21.668: Integración de la ficha odontológica al Registro Clínico Electrónico
 * - Ley N° 21.430: Enfoque odontopediátrico preventivo y derechos del menor
 */

export const dentalStore = {
  adulto: {
    '16': { oclusal: '#ef4444', status: 'caries', desc: 'Caries activa en fosa oclusal profunda' },
    '24': { oclusal: '#3b82f6', vestibular: '#3b82f6', status: 'obturacion', desc: 'Obturación estética con resina nanohíbrida' },
    '36': { whole: '#6b7280', status: 'ausente', desc: 'Pieza ausente por exodoncia previa indicada' },
    '46': { oclusal: '#10b981', status: 'planificado', desc: 'Tratamiento planificado: Sellante terapéutico' },
    '11': { oclusal: '#3b82f6', mesial: '#3b82f6', status: 'obturacion', desc: 'Restauración estética borde incisal' }
  },
  pediatrico: {
    '54': { oclusal: '#ef4444', status: 'caries', desc: 'Caries incipiente en fosa oclusal' },
    '64': { oclusal: '#3b82f6', status: 'obturacion', desc: 'Obturación con ionómero de vidrio' },
    '75': { oclusal: '#facc15', status: 'sellante', desc: 'Sellante preventivo libre de flúor' },
    '85': { oclusal: '#10b981', status: 'planificado', desc: 'Control preventivo programado' }
  }
};

export const dentalTreatments = {
  adulto: [
    { fecha: '14 Oct 2026', pieza: 'Pieza 24', procedimiento: 'Obturación resina nanohíbrida cara Oclusal-Vestibular', profesional: 'Dr. Marcelo Valenzuela - Odontólogo' },
    { fecha: '28 Sep 2026', pieza: 'Pieza 16', procedimiento: 'Diagnóstico de caries oclusal y preparación cavitaria', profesional: 'Dr. Marcelo Valenzuela - Odontólogo' },
    { fecha: '15 Ago 2026', pieza: 'General', procedimiento: 'Destartraje supragingival y profilaxis general', profesional: 'Dra. Andrea Gómez - Higienista Dental' },
    { fecha: '10 May 2026', pieza: 'Pieza 36', procedimiento: 'Control post exodoncia y evaluación de rehabilitación', profesional: 'Dr. Carlos Mendoza - Cirujano Máxilofacial' }
  ],
  pediatrico: [
    { fecha: '20 Oct 2026', pieza: 'Pieza 64', procedimiento: 'Obturación con ionómero de vidrio biocompatible', profesional: 'Dra. Marcela Soto - Odontopediatra' },
    { fecha: '10 Sep 2026', pieza: 'Pieza 75', procedimiento: 'Aplicación de sellante de fosas y fisuras', profesional: 'Dra. Marcela Soto - Odontopediatra' },
    { fecha: '15 Jul 2026', pieza: 'General', procedimiento: 'Barniz de flúor preventivo semestral (GES Infantil)', profesional: 'Dra. Marcela Soto - Odontopediatra' }
  ]
};

export const dentalXrays = {
  adulto: [
    { id: 'rx1', nombre: 'Radiografía Panorámica Digital (Ortopantomografía)', fecha: '12 Oct 2026', tipo: 'Panorámica HD', url: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=800&q=80', nota: 'Evaluación de terceros molares y soporte alveolar.' },
    { id: 'rx2', nombre: 'Bite-Wing Bilateral Posterior (Aleta de Mordida)', fecha: '28 Sep 2026', tipo: 'Bite-Wing', url: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=800&q=80', nota: 'Detección de caries interproximales en premolares y molares.' },
    { id: 'rx3', nombre: 'Periapical Pieza 16 (Zona Molar)', fecha: '28 Sep 2026', tipo: 'Periapical', url: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=800&q=80', nota: 'Descarte de compromiso pulpar y estado periapical.' }
  ],
  pediatrico: [
    { id: 'rx_p1', nombre: 'Radiografía Panorámica Pediátrica Digital', fecha: '15 Jul 2026', tipo: 'Panorámica Infantil', url: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=800&q=80', nota: 'Evaluación del recambio dental y gérmenes permanentes.' },
    { id: 'rx_p2', nombre: 'Bite-Wing Pediátrica Molares Temporales', fecha: '20 Oct 2026', tipo: 'Bite-Wing', url: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=800&q=80', nota: 'Control de sellantes e indemnidad interproximal.' }
  ]
};

export const dentalFoldersData = {
  adulto: {
    radiografias: [
      { id: 'rx-1', nombre: 'Radiografía Panorámica Digital (Ortopantomografía)', fecha: '12 Oct 2026', especialista: 'Dr. Marcelo Valenzuela (Cirujano Dentista)', institucion: 'Centro Radiológico Maxilofacial', icono: '🩻', tipo: 'Radiografía Panorámica HD', tamano: '4.2 MB', nota: 'Soporte óseo alveolar conservado. Terceros molares 18 y 28 retenidos.' },
      { id: 'rx-2', nombre: 'Bite-Wing Bilateral Posterior (Aletas de Mordida)', fecha: '28 Sep 2026', especialista: 'Dra. Andrea Gómez (Radiología)', institucion: 'Clínica Odontológica Central', icono: '🩻', tipo: 'Bite-Wing Digital', tamano: '2.8 MB', nota: 'Sin caries interproximales activas en sector posterior.' },
      { id: 'rx-3', nombre: 'Periapical Pieza 16 (Zona Molar Superior)', fecha: '28 Sep 2026', especialista: 'Dr. Marcelo Valenzuela (Cirujano Dentista)', institucion: 'Clínica Odontológica Central', icono: '🩻', tipo: 'Radiografía Periapical', tamano: '1.5 MB', nota: 'Ausencia de lesión radiolúcida periapical. Cámara pulpar indemne.' }
    ],
    informes: [
      { id: 'inf-1', nombre: 'Informe Periodontal Completo (Periodontograma)', fecha: '15 Ago 2026', especialista: 'Dr. Roberto Salas (Periodoncista)', institucion: 'Centro Odontológico San Salvador', icono: '📄', tipo: 'Informe Especializado', tamano: '1.8 MB', nota: 'Profundidad de sondaje menor a 3mm generalizada. Encía con buena respuesta biológica.' },
      { id: 'inf-2', nombre: 'Presupuesto y Plan de Tratamiento Dental GES', fecha: '28 Sep 2026', especialista: 'Dra. María Paz Echeverría', institucion: 'CESFAM Bellavista', icono: '📄', tipo: 'Presupuesto Clínico Oficial', tamano: '850 KB', nota: 'Cobertura FONASA Tramo B & GES Salud Bucal Integral del Adulto.' },
      { id: 'inf-3', nombre: 'Certificado de Alta Odontológica Semestral', fecha: '14 Oct 2026', especialista: 'Dr. Marcelo Valenzuela (Cirujano Dentista)', institucion: 'Clínica Odontológica Central', icono: '📄', tipo: 'Certificado Clínico', tamano: '620 KB', nota: 'Paciente en condición de mantenimiento periodontal. Próximo control en 6 meses.' }
    ]
  },
  pediatrico: {
    radiografias: [
      { id: 'rx-p1', nombre: 'Radiografía Panorámica Infantil Digital', fecha: '15 Jul 2026', especialista: 'Dra. Marcela Soto (Odontopediatra)', institucion: 'CESFAM Bellavista Infantil', icono: '🩻', tipo: 'Panorámica Pediátrica', tamano: '3.6 MB', nota: 'Dentición temporal completa. Presencia normal de folículos dentarios permanentes.' },
      { id: 'rx-p2', nombre: 'Bite-Wing Molares Temporales Bilateral', fecha: '20 Oct 2026', especialista: 'Dra. Marcela Soto (Odontopediatra)', institucion: 'CESFAM Bellavista Infantil', icono: '🩻', tipo: 'Bite-Wing Infantil', tamano: '2.1 MB', nota: 'Control de sellantes en molares 75 y 85 satisfactorio.' }
    ],
    informes: [
      { id: 'inf-p1', nombre: 'Ficha de Evaluación de Riesgo Cariogénico Infantil', fecha: '20 Oct 2026', especialista: 'Dra. Marcela Soto (Odontopediatra)', institucion: 'CESFAM Bellavista Infantil', icono: '📄', tipo: 'Ficha Preventiva GES', tamano: '950 KB', nota: 'Riesgo cariogénico bajo. Adecuada técnica de higiene tutelada.' },
      { id: 'inf-p2', nombre: 'Constancia de Aplicación de Barniz de Flúor (GES 6 Años)', fecha: '15 Jul 2026', especialista: 'Dra. Marcela Soto (Odontopediatra)', institucion: 'CESFAM Bellavista Infantil', icono: '📄', tipo: 'Certificado Preventivo MINSAL', tamano: '720 KB', nota: 'Aplicación semestral de barniz de flúor al 5% completada exitosamente.' }
    ]
  }
};

export const DENTAL_COLORS = {
  caries: { label: 'Caries Activa', color: '#ef4444', textClass: 'text-white', badge: '🔴 Caries' },
  obturacion: { label: 'Obturación / Resina', color: '#38bdf8', textClass: 'text-white', badge: '🔵 Obturación' },
  planificado: { label: 'Tratamiento Planificado', color: '#10b981', textClass: 'text-white', badge: '🟢 Planificado' },
  ausente: { label: 'Pieza Ausente', color: '#64748b', textClass: 'text-white', badge: '⚪ Ausente' },
  sellante: { label: 'Sellante Preventivo', color: '#facc15', textClass: 'text-dark', badge: '🟡 Sellante' },
  sano: { label: 'Sano / Limpiar', color: '#1e293b', textClass: 'text-white', badge: '✨ Sano' }
};

export const FDI_TOOTH_NAMES = {
  // Adulto Superior Derecho (Cuadrante 1)
  '18': 'Tercer Molar (Muela del Juicio) Superior Derecho',
  '17': 'Segundo Molar Superior Derecho',
  '16': 'Primer Molar Superior Derecho',
  '15': 'Segundo Premolar Superior Derecho',
  '14': 'Primer Premolar Superior Derecho',
  '13': 'Canino Superior Derecho',
  '12': 'Incisivo Lateral Superior Derecho',
  '11': 'Incisivo Central Superior Derecho',
  // Adulto Superior Izquierdo (Cuadrante 2)
  '21': 'Incisivo Central Superior Izquierdo',
  '22': 'Incisivo Lateral Superior Izquierdo',
  '23': 'Canino Superior Izquierdo',
  '24': 'Primer Premolar Superior Izquierdo',
  '25': 'Segundo Premolar Superior Izquierdo',
  '26': 'Primer Molar Superior Izquierdo',
  '27': 'Segundo Molar Superior Izquierdo',
  '28': 'Tercer Molar (Muela del Juicio) Superior Izquierdo',
  // Adulto Inferior Izquierdo (Cuadrante 3)
  '38': 'Tercer Molar (Muela del Juicio) Inferior Izquierdo',
  '37': 'Segundo Molar Inferior Izquierdo',
  '36': 'Primer Molar Inferior Izquierdo',
  '35': 'Segundo Premolar Inferior Izquierdo',
  '34': 'Primer Premolar Inferior Izquierdo',
  '33': 'Canino Inferior Izquierdo',
  '32': 'Incisivo Lateral Inferior Izquierdo',
  '31': 'Incisivo Central Inferior Izquierdo',
  // Adulto Inferior Derecho (Cuadrante 4)
  '41': 'Incisivo Central Inferior Derecho',
  '42': 'Incisivo Lateral Inferior Derecho',
  '43': 'Canino Inferior Derecho',
  '44': 'Primer Premolar Inferior Derecho',
  '45': 'Segundo Premolar Inferior Derecho',
  '46': 'Primer Molar Inferior Derecho',
  '47': 'Segundo Molar Inferior Derecho',
  '48': 'Tercer Molar (Muela del Juicio) Inferior Derecho',
  // Pediátrico Temporal Superior
  '55': 'Segundo Molar Temporal Superior Derecho',
  '54': 'Primer Molar Temporal Superior Derecho',
  '53': 'Canino Temporal Superior Derecho',
  '52': 'Incisivo Lateral Temporal Superior Derecho',
  '51': 'Incisivo Central Temporal Superior Derecho',
  '61': 'Incisivo Central Temporal Superior Izquierdo',
  '62': 'Incisivo Lateral Temporal Superior Izquierdo',
  '63': 'Canino Temporal Superior Izquierdo',
  '64': 'Primer Molar Temporal Superior Izquierdo',
  '65': 'Segundo Molar Temporal Superior Izquierdo',
  // Pediátrico Temporal Inferior
  '75': 'Segundo Molar Temporal Inferior Izquierdo',
  '74': 'Primer Molar Temporal Inferior Izquierdo',
  '73': 'Canino Temporal Inferior Izquierdo',
  '72': 'Incisivo Lateral Temporal Inferior Izquierdo',
  '71': 'Incisivo Central Temporal Inferior Izquierdo',
  '81': 'Incisivo Central Temporal Inferior Derecho',
  '82': 'Incisivo Lateral Temporal Inferior Derecho',
  '83': 'Canino Temporal Inferior Derecho',
  '84': 'Primer Molar Temporal Inferior Derecho',
  '85': 'Segundo Molar Temporal Inferior Derecho'
};

export const FDI_TEETH = {
  adultSuperior: [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
  adultInferior: [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
  pediatricSuperior: [55, 54, 53, 52, 51, 61, 62, 63, 64, 65],
  pediatricInferior: [85, 84, 83, 82, 81, 71, 72, 73, 74, 75]
};

let currentPatientKey = 'adulto';
let currentSelectedTooth = '16';

// Renderizado individual de un diente en formato SVG anatómico con 5 caras y GlassKit oscuro
export function createToothSVG(toothNum, toothState = {}, isPediatricTooth = false, isReadOnly = false) {
  const isAbsent = toothState.whole === '#6b7280' || toothState.status === 'ausente';
  const defaultFill = '#0f172a'; // Esmalte en fondo GlassKit oscuro
  const cVestibular = isAbsent ? '#6b7280' : (toothState.vestibular || defaultFill);
  const cLingual = isAbsent ? '#6b7280' : (toothState.lingual || defaultFill);
  const cMesial = isAbsent ? '#6b7280' : (toothState.mesial || defaultFill);
  const cDistal = isAbsent ? '#6b7280' : (toothState.distal || defaultFill);
  const cOclusal = isAbsent ? '#6b7280' : (toothState.oclusal || defaultFill);

  const w = 40;
  const h = 40;
  const toothName = FDI_TOOTH_NAMES[toothNum.toString()] || `Pieza FDI ${toothNum}`;
  const isSelected = currentSelectedTooth === toothNum.toString();

  return `
    <div class="tooth-container d-inline-flex flex-column align-items-center m-1 ${isSelected ? 'selected-tooth' : ''}" 
         id="toothContainer_${toothNum}" 
         data-tooth="${toothNum}"
         style="user-select: none; transition: all 0.25s ease; cursor: pointer; padding: 4px 6px;">
      <!-- Número FDI -->
      <span class="small fw-extrabold mb-1 tooth-num-label" style="font-size: 0.82rem; color: ${isSelected ? '#38bdf8' : (isPediatricTooth ? '#7dd3fc' : '#94a3b8')}; font-family: 'Outfit', sans-serif; display: block; line-height: 1.25;">
        ${toothNum}
      </span>

      <!-- Representación Anatómica 5 Caras SVG -->
      <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" 
           class="tooth-svg shadow ${isSelected ? 'active-glow' : ''}" 
           data-tooth="${toothNum}" 
           style="border-radius: 8px; overflow: hidden; background: rgba(15, 23, 42, 0.95); border: ${isSelected ? '2px solid #38bdf8' : '1.5px solid rgba(56, 189, 248, 0.3)'}; transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease; ${isSelected ? 'box-shadow: 0 0 16px rgba(56, 189, 248, 0.8); transform: scale(1.18);' : ''}" 
           title="${toothName}">
        <!-- Cara Vestibular (Superior) -->
        <polygon points="2,2 38,2 29,11 11,11" fill="${cVestibular}" stroke="#475569" stroke-width="1.2" class="tooth-face" data-tooth="${toothNum}" data-face="vestibular" />
        
        <!-- Cara Mesial (Izquierda) -->
        <polygon points="2,2 11,11 11,29 2,38" fill="${cMesial}" stroke="#475569" stroke-width="1.2" class="tooth-face" data-tooth="${toothNum}" data-face="mesial" />
        
        <!-- Cara Distal (Derecha) -->
        <polygon points="38,2 38,38 29,29 29,11" fill="${cDistal}" stroke="#475569" stroke-width="1.2" class="tooth-face" data-tooth="${toothNum}" data-face="distal" />
        
        <!-- Cara Lingual / Palatina (Inferior) -->
        <polygon points="11,29 29,29 38,38 2,38" fill="${cLingual}" stroke="#475569" stroke-width="1.2" class="tooth-face" data-tooth="${toothNum}" data-face="lingual" />
        
        <!-- Cara Oclusal / Incisal (Centro) -->
        <rect x="11" y="11" width="18" height="18" fill="${cOclusal}" stroke="#475569" stroke-width="1.2" class="tooth-face" data-tooth="${toothNum}" data-face="oclusal" />
        
        ${isAbsent ? `<line x1="2" y1="2" x2="38" y2="38" stroke="#ef4444" stroke-width="2.8" stroke-linecap="round" />` : ''}
      </svg>
    </div>
  `;
}

// Generar Arcada Anatómica Curva (Herradura / Arco de Boca)
function renderCurvedArcade(teethArray, isSuperior, isPediatricGroup, isReadOnly) {
  const n = teethArray.length;
  const centerIdx = (n - 1) / 2;

  const teethHTML = teethArray.map((toothNum, i) => {
    const dist = Math.abs(i - centerIdx);
    const normalizedDist = dist / centerIdx; // 0 (centro) a 1 (extremos)

    // Curva cuadrática / exponencial para recrear la herradura dental humana
    let translateY = 0;
    let rotation = 0;

    if (isSuperior) {
      // Arco superior: invertido (∩). Los incisivos en el centro están arriba (Y=0), molares bajan (Y=+42)
      translateY = Math.pow(normalizedDist, 1.8) * 42;
      rotation = (i < centerIdx ? -1 : 1) * Math.pow(normalizedDist, 1.5) * 16;
    } else {
      // Arco inferior: U abierta (∪). Los incisivos en el centro están abajo (Y=+42), molares suben (Y=0)
      translateY = (1 - Math.pow(normalizedDist, 1.8)) * 42;
      rotation = (i < centerIdx ? 1 : -1) * Math.pow(normalizedDist, 1.5) * 16;
    }

    const toothState = (dentalStore[currentPatientKey] && dentalStore[currentPatientKey][toothNum.toString()]) || {};
    const svgHTML = createToothSVG(toothNum, toothState, isPediatricGroup, isReadOnly);

    return `
      <div class="arcade-tooth-wrapper" style="display: inline-block; transform: translateY(${translateY.toFixed(1)}px) rotate(${rotation.toFixed(1)}deg); transition: transform 0.3s ease; margin: 0 3px; padding: 4px 1px;">
        ${svgHTML}
      </div>
    `;
  }).join('');

  return `
    <div class="arcade-curved-container position-relative d-flex justify-content-center align-items-center flex-wrap" style="min-height: 175px; padding: 28px 14px; overflow-x: auto; overflow-y: visible;">
      <!-- Línea anatómica de encía en SVG semitransparente -->
      <svg class="gingiva-path position-absolute w-100" style="height: 125px; top: ${isSuperior ? '20px' : '12px'}; left: 0; pointer-events: none; z-index: 0;" preserveAspectRatio="none" viewBox="0 0 800 120">
        ${isSuperior ? `
          <path d="M 60,95 C 240,15 560,15 740,95" fill="none" stroke="rgba(244, 63, 94, 0.16)" stroke-width="32" stroke-linecap="round"/>
        ` : `
          <path d="M 60,25 C 240,105 560,105 740,25" fill="none" stroke="rgba(244, 63, 94, 0.16)" stroke-width="32" stroke-linecap="round"/>
        `}
      </svg>
      <div class="d-flex justify-content-center align-items-center flex-nowrap" style="position: relative; z-index: 1; max-width: 100%; padding: 10px 16px; overflow-x: auto;">
        ${teethHTML}
      </div>
    </div>
  `;
}

// Verificación de rol médico/odontólogo autenticado (Ley N° 20.584)
export function checkIsDoctorUser(userRole = null) {
  if (typeof userRole === 'string') {
    const r = userRole.toLowerCase();
    if (r === 'doctor' || r === 'medico' || r.includes('valdés') || r.includes('valdes') || r.includes('odontolog')) {
      return true;
    }
    if (r === 'patient' || r === 'paciente' || r === 'caregiver' || r === 'cuidador' || r === 'admin') {
      return false;
    }
  }

  if (typeof window !== 'undefined') {
    if (window.__cuidapp_role === 'doctor' || window.__cuidapp_role === 'medico') return true;
    if (window.currentUserRole === 'doctor' || window.currentUserRole === 'medico') return true;
    if (window.currentRole === 'doctor' || window.currentRole === 'medico') return true;
  }

  if (typeof document !== 'undefined') {
    if (document.getElementById('medicoPatientSelector') || document.getElementById('btnOpenDentalModalFromMedico')) {
      return true;
    }
    const linkDoctor = document.getElementById('linkDoctorView');
    if (linkDoctor && linkDoctor.classList.contains('active')) {
      return true;
    }
    const sidebar = document.getElementById('sidebarMenu');
    if (sidebar) {
      const sidebarText = sidebar.innerText || '';
      if (sidebarText.includes('Portal Clínico Médico') || sidebarText.includes('Dra. Elena Valdés')) {
        return true;
      }
    }
    if (document.querySelector('.doctor-view-container') || document.getElementById('doctorDashboardContent')) {
      return true;
    }
  }

  try {
    const sessionLogRaw = localStorage.getItem('cuidapp_session_log');
    if (sessionLogRaw) {
      const logs = JSON.parse(sessionLogRaw);
      if (Array.isArray(logs) && logs.length > 0) {
        const last = logs[0];
        if (last && (last.role === 'doctor' || last.role === 'medico' || last.user === 'Dra. Elena Valdés')) {
          if (typeof document !== 'undefined') {
            const pLink = document.getElementById('linkPatientView');
            const evalLink = document.getElementById('linkEvaluation');
            if ((pLink && pLink.classList.contains('active')) || (evalLink && evalLink.classList.contains('active'))) {
              return false;
            }
          }
          return true;
        }
      }
    }
  } catch (e) {}

  return false;
}

// 1. Función reutilizable renderOdontograma(container, patientId, userRole)
export function renderOdontograma(container, patientId = 'adulto', userRole = null) {
  if (!container) return;

  const isPediatric = (patientId === 'mateo' || patientId === 'pediatrico' || patientId === 'p_mateo');
  // Estrictamente solo lectura para pacientes adultos y pediátricos/tutores si no es Médico
  const isDoctor = checkIsDoctorUser(userRole);
  const isReadOnly = !isDoctor;
  currentPatientKey = isPediatric ? 'pediatrico' : 'adulto';

  if (!dentalStore[currentPatientKey]) {
    dentalStore[currentPatientKey] = {};
  }

  // Si la pieza seleccionada no corresponde al grupo actual, resetear a la primera
  if (isPediatric && (!FDI_TOOTH_NAMES[currentSelectedTooth] || parseInt(currentSelectedTooth) < 50)) {
    currentSelectedTooth = '54';
  } else if (!isPediatric && (!FDI_TOOTH_NAMES[currentSelectedTooth] || parseInt(currentSelectedTooth) > 50)) {
    currentSelectedTooth = '16';
  }

  const treatments = dentalTreatments[currentPatientKey] || [];
  const patientFolders = dentalFoldersData[currentPatientKey] || dentalFoldersData.adulto;
  const numRadiografias = patientFolders.radiografias?.length || 3;
  const numInformes = patientFolders.informes?.length || 3;

  container.innerHTML = `
    <div class="odontograma-module p-3 p-md-4" style="font-family: 'Outfit', sans-serif; color: #f8fafc;">
      <!-- Encabezado con Leyenda de Estados y Colores FDI (Dark GlassKit) -->
      <div class="p-3 p-md-4 rounded-4 mb-4" style="background: rgba(15, 23, 42, 0.95); border: 1.5px solid rgba(56, 189, 248, 0.35); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div class="d-flex align-items-center gap-2">
            <span style="font-size: 2.2rem;">🦷</span>
            <div>
              <h4 class="fw-extrabold m-0 text-white">Odontograma Anatómico Digital (FDI)</h4>
              <small class="text-white-50">${isPediatric ? 'Paciente Pediátrico: Dentición Temporal (Piezas 51–85)' : 'Paciente Adulto: Dentición Permanente (Piezas 11–48)'}</small>
            </div>
          </div>
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <span class="badge px-3 py-1.5 rounded-pill fw-bold" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4);">
              ${isPediatric ? '🧸 Dentición Temporal (51–85)' : '🦷 Dentición Permanente (11–48)'}
            </span>
            ${isReadOnly ? `
              <span class="badge px-3 py-1.5 rounded-pill fw-bold" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1.5px solid #ef4444;">
                🔒 Modo Solo Lectura • Registro exclusivo del Odontólogo (Ley N° 20.584)
              </span>
            ` : `
              <span class="badge px-3 py-1.5 rounded-pill fw-bold" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1.5px solid #10b981;">
                🩺 Edición Clínica Habilitada • Profesional Odontólogo
              </span>
            `}
          </div>
        </div>

        <!-- Leyenda de colores interactiva -->
        <div class="d-flex flex-wrap gap-2 pt-2 border-top border-secondary border-opacity-25 small">
          <span class="badge d-inline-flex align-items-center gap-1.5 px-3 py-1.5 rounded-pill text-white" style="background: #ef4444; border: 1px solid #f87171;">
            🔴 Caries
          </span>
          <span class="badge d-inline-flex align-items-center gap-1.5 px-3 py-1.5 rounded-pill text-white" style="background: #3b82f6; border: 1px solid #60a5fa;">
            🔵 Obturación
          </span>
          <span class="badge d-inline-flex align-items-center gap-1.5 px-3 py-1.5 rounded-pill text-white" style="background: #10b981; border: 1px solid #34d399;">
            🟢 Planificado
          </span>
          <span class="badge d-inline-flex align-items-center gap-1.5 px-3 py-1.5 rounded-pill text-white" style="background: #64748b; border: 1px solid #94a3b8;">
            ⚪ Ausente
          </span>
          <span class="badge d-inline-flex align-items-center gap-1.5 px-3 py-1.5 rounded-pill text-dark" style="background: #facc15; border: 1px solid #fde047;">
            🟡 Sellante
          </span>
          <span class="text-white-50 ms-auto align-self-center fst-italic">
            <i class="bi bi-cursor-fill text-info me-1"></i>Haz clic en cualquier pieza dental para ver su anatomía y evolución.
          </span>
        </div>
      </div>

      <!-- Lienzo de las Arcadas Anatómicas Curvas + Panel Lateral de Detalle -->
      <div class="row g-4 mb-4">
        <!-- Columna Izquierda: Arcadas Dentales en Herradura Real -->
        <div class="col-12 col-xl-8">
          <div class="p-3 p-md-4 rounded-4 text-center position-relative" style="background: rgba(15, 23, 42, 0.95); border: 1.5px solid rgba(56, 189, 248, 0.35); backdrop-filter: blur(20px); box-shadow: 0 10px 30px rgba(0,0,0,0.5); overflow: visible;">
            ${!isPediatric ? `
              <!-- Arcada Superior Adulto (18 a 28) -->
              <div class="mb-2">
                <span class="badge text-white px-3 py-1 rounded-pill fw-bold small" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15);">
                  ⬆️ Maxilar Superior (Arco Invertido ∩ &bull; Piezas 18 a 28)
                </span>
              </div>
              <div class="mb-4" id="teethAdultSuperior">
                ${renderCurvedArcade(FDI_TEETH.adultSuperior, true, false, isReadOnly)}
              </div>

              <!-- Arcada Inferior Adulto (48 a 38) -->
              <div class="mb-2 pt-2 border-top border-secondary border-opacity-25">
                <span class="badge text-white px-3 py-1 rounded-pill fw-bold small" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15);">
                  ⬇️ Mandíbula Inferior (Arco Abierto ∪ &bull; Piezas 48 a 38)
                </span>
              </div>
              <div id="teethAdultInferior">
                ${renderCurvedArcade(FDI_TEETH.adultInferior, false, false, isReadOnly)}
              </div>
            ` : `
              <!-- Arcada Superior Temporal (55 a 65) -->
              <div class="mb-2">
                <span class="badge text-white px-3 py-1 rounded-pill fw-bold small" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15);">
                  ⬆️ Maxilar Superior Infantil (Arco Invertido ∩ &bull; Piezas 55 a 65)
                </span>
              </div>
              <div class="mb-4" id="teethPediatricSuperior">
                ${renderCurvedArcade(FDI_TEETH.pediatricSuperior, true, true, isReadOnly)}
              </div>

              <!-- Arcada Inferior Temporal (85 a 75) -->
              <div class="mb-2 pt-2 border-top border-secondary border-opacity-25">
                <span class="badge text-white px-3 py-1 rounded-pill fw-bold small" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15);">
                  ⬇️ Mandíbula Inferior Infantil (Arco Abierto ∪ &bull; Piezas 85 a 75)
                </span>
              </div>
              <div id="teethPediatricInferior">
                ${renderCurvedArcade(FDI_TEETH.pediatricInferior, false, true, isReadOnly)}
              </div>
            `}
          </div>
        </div>

        <!-- Columna Derecha: Tarjeta / Panel de Detalle de la Pieza Seleccionada -->
        <div class="col-12 col-xl-4">
          <div class="p-3 p-md-4 rounded-4 h-100 d-flex flex-column justify-content-between" id="panelToothDetail" style="background: rgba(15, 23, 42, 0.95); border: 1.5px solid rgba(56, 189, 248, 0.4); backdrop-filter: blur(20px); box-shadow: 0 10px 30px rgba(0,0,0,0.5); overflow: visible; word-break: break-word;">
            <!-- Contenido dinámico del diente seleccionado -->
            <div id="toothDetailContent">
              <!-- Se inyecta dinámicamente con updateToothDetailPanel -->
            </div>

            <!-- Botones de Acción para la Pieza -->
            <div class="pt-3 border-top border-secondary border-opacity-25 d-flex flex-column gap-2">
              <button type="button" id="btnVerAntesDespues" class="btn w-100 py-2.5 px-3 rounded-pill fw-bold text-white shadow d-flex align-items-center justify-content-center gap-2" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border: 1.5px solid #38bdf8; cursor: pointer;">
                <span>✨ Ver Evolución Antes / Después</span>
              </button>
              ${!isReadOnly ? `
                <button type="button" id="btnEditarEstadoDiente" class="btn btn-outline-info w-100 py-2 px-3 rounded-pill fw-bold d-flex align-items-center justify-content-center gap-2" style="cursor: pointer;">
                  <span>✏️ Registrar Estado / Procedimiento FDI</span>
                </button>
              ` : `
                <div class="text-center p-2.5 rounded-3 mt-1" style="background: rgba(239, 68, 68, 0.12); border: 1.5px solid rgba(239, 68, 68, 0.35);">
                  <span class="fw-bold d-block" style="color: #f87171; font-size: 0.8rem; line-height: 1.35;">
                    🔒 Modo Solo Lectura • Registro exclusivo del Odontólogo (Ley N° 20.584)
                  </span>
                </div>
              `}
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Explorador de Carpetas Odontológicas GlassKit -->
      <div class="dental-folders-container p-3 p-md-4 rounded-4 mb-4" id="dentalExplorerContainer" style="background: rgba(15, 23, 42, 0.95); border: 1.5px solid rgba(56, 189, 248, 0.35); backdrop-filter: blur(20px); box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        
        <!-- VISTA INICIAL (RAÍZ): Tarjetas Cuadradas de Carpetas -->
        <div id="dentalExplorerRootView">
          <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <div class="d-flex align-items-center gap-2">
              <span style="font-size: 1.6rem;">📁</span>
              <div>
                <h5 class="fw-bold m-0 text-white">Explorador de Carpetas Dentales</h5>
                <small class="text-white-50">Documentos oficiales, radiografías panorámicas e informes clínicos</small>
              </div>
            </div>
            <span class="badge px-3 py-1.5 rounded-pill fw-semibold" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4);">
              2 Carpetas Disponibles
            </span>
          </div>

          <div class="row g-4 pt-2">
            <!-- Carpeta 1: Radiografías -->
            <div class="col-12 col-md-6">
              <div class="card-folder p-4 rounded-4 text-center position-relative" id="cardFolderRadiografias" role="button" style="background: rgba(30, 41, 59, 0.6); border: 2px solid rgba(56, 189, 248, 0.35); border-radius: 24px; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
                <div class="d-flex justify-content-center align-items-center mx-auto mb-3 rounded-circle shadow" style="width: 76px; height: 76px; background: rgba(56, 189, 248, 0.15); border: 2px solid #38bdf8;">
                  <span style="font-size: 2.8rem;">🩻</span>
                </div>
                <h4 class="fw-extrabold text-white mb-1.5" style="letter-spacing: -0.5px;">Radiografías</h4>
                <p class="text-white-50 small mb-3">Panorámicas, periapicales y aletas de mordida digitales</p>
                <span class="badge px-3.5 py-1.5 rounded-pill fw-bold" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid #38bdf8; font-size: 0.9rem;">
                  <span id="badgeCountRadiografias">${numRadiografias}</span> archivos almacenados
                </span>
              </div>
            </div>

            <!-- Carpeta 2: Informes Médicos y Dentales -->
            <div class="col-12 col-md-6">
              <div class="card-folder p-4 rounded-4 text-center position-relative" id="cardFolderInformes" role="button" style="background: rgba(30, 41, 59, 0.6); border: 2px solid rgba(192, 132, 252, 0.35); border-radius: 24px; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
                <div class="d-flex justify-content-center align-items-center mx-auto mb-3 rounded-circle shadow" style="width: 76px; height: 76px; background: rgba(192, 132, 252, 0.15); border: 2px solid #c084fc;">
                  <span style="font-size: 2.8rem;">📄</span>
                </div>
                <h4 class="fw-extrabold text-white mb-1.5" style="letter-spacing: -0.5px;">Informes</h4>
                <p class="text-white-50 small mb-3">Diagnósticos periodontales, presupuestos GES y certificados</p>
                <span class="badge px-3.5 py-1.5 rounded-pill fw-bold" style="background: rgba(192, 132, 252, 0.2); color: #c084fc; border: 1px solid #c084fc; font-size: 0.9rem;">
                  <span id="badgeCountInformes">${numInformes}</span> documentos disponibles
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- VISTA DETALLE: Explorador dentro de la Carpeta Abierta -->
        <div id="dentalExplorerDetailView" class="d-none">
          <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <button type="button" id="btnBackToFoldersRoot" class="btn px-4 py-2.5 rounded-pill fw-bold shadow-sm d-inline-flex align-items-center gap-2" style="background: rgba(255, 255, 255, 0.08); color: #f8fafc; border: 1.5px solid rgba(255, 255, 255, 0.2); cursor: pointer; transition: all 0.2s;">
              ⬅️ Volver a Carpetas
            </button>
            
            <div class="d-flex align-items-center gap-2">
              <span id="folderDetailEmoji" style="font-size: 1.8rem;">🩻</span>
              <div>
                <h4 class="fw-extrabold m-0 text-white" id="folderDetailTitle">Carpeta de Radiografías</h4>
                <small class="text-white-50" id="folderDetailSubtitle">Exámenes radiológicos y tomografías digitales</small>
              </div>
            </div>

            <!-- Botón Subir Documento (Solo Odontólogo / Modo Edición) -->
            ${!isReadOnly ? `
            <input type="file" id="inputUploadDentalDoc" accept=".pdf,image/*" style="display: none;">
            <button type="button" id="btnUploadDentalDoc" class="btn px-4 py-2.5 rounded-pill fw-bold text-white shadow-sm d-inline-flex align-items-center gap-2" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border: 1.5px solid #38bdf8; cursor: pointer;">
              <i class="bi bi-cloud-arrow-up-fill fs-5"></i>
              <span>➕ Subir Documento</span>
            </button>
            ` : ''}
          </div>

          <!-- Buscador y Filtro reactivo -->
          <div class="mb-4">
            <div class="input-group shadow-sm" style="border-radius: 16px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.15);">
              <span class="input-group-text border-0 ps-3" style="background: rgba(15, 23, 42, 0.8);" id="iconDetailSearch">
                <i class="bi bi-search text-info fs-5"></i>
              </span>
              <input type="text" id="inputDetailSearch" class="form-control border-0 py-2.5 text-white" placeholder="Buscar por fecha, especialista, institución o tipo de examen..." style="background: rgba(15, 23, 42, 0.8);">
            </div>
          </div>

          <!-- Banner de estado de carga -->
          <div id="bannerUploadStatus" class="p-3 rounded-4 mb-3 d-none text-center" style="background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8;">
            <span class="fw-bold"><i class="bi bi-arrow-repeat spin-animation me-2"></i>Analizando documento con IA y encriptando según Ley N° 20.584...</span>
          </div>

          <!-- Contenedor dinámico de lista de archivos de la carpeta -->
          <div id="folderFilesContainer" class="d-flex flex-column gap-3">
            <!-- Renderizado dinámicamente -->
          </div>
        </div>
      </div>

      <!-- 3. Historial de Tratamientos Odontológicos Realizados (Dark GlassKit Table) -->
      <div class="p-4 rounded-4" style="background: rgba(15, 23, 42, 0.95); border: 1.5px solid rgba(56, 189, 248, 0.35); backdrop-filter: blur(20px); box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div class="d-flex align-items-center gap-2">
            <span style="font-size: 1.6rem;">📋</span>
            <h5 class="fw-bold m-0 text-white">Historial de Tratamientos y Procedimientos Registrados</h5>
          </div>
          <span class="badge text-white px-3 py-1.5 rounded-pill fw-semibold" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15);">
            Trazabilidad Clínica Oficial &bull; Ley N° 20.584
          </span>
        </div>

        <div class="table-responsive">
          <table class="table table-borderless align-middle m-0" style="color: #f8fafc;">
            <thead>
              <tr style="border-bottom: 1.5px solid rgba(255, 255, 255, 0.12); color: #38bdf8; font-size: 0.85rem; text-transform: uppercase;">
                <th style="padding: 12px 16px;">Fecha</th>
                <th style="padding: 12px 16px;">Pieza / Zona</th>
                <th style="padding: 12px 16px;">Procedimiento Realizado</th>
                <th style="padding: 12px 16px;">Profesional Responsable</th>
                <th style="padding: 12px 16px; text-align: right;">Estado</th>
              </tr>
            </thead>
            <tbody id="dentalTreatmentsBody">
              ${treatments.map((t, idx) => `
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.06); transition: background 0.2s;" class="treatment-row">
                  <td style="padding: 14px 16px;" class="fw-bold text-white text-nowrap">
                    ${t.fecha}
                  </td>
                  <td style="padding: 14px 16px;">
                    <span class="badge px-3 py-1.5 rounded-pill fw-bold" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35);">
                      ${t.pieza}
                    </span>
                  </td>
                  <td style="padding: 14px 16px;" class="text-white">
                    ${t.procedimiento}
                  </td>
                  <td style="padding: 14px 16px;" class="text-white-50 small">
                    ${t.profesional}
                  </td>
                  <td style="padding: 14px 16px; text-align: right;">
                    <span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25 px-2.5 py-1 rounded-pill small">
                      Completado
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Función para refrescar el panel lateral con los datos del diente seleccionado
  const updateToothDetailPanel = (toothNum) => {
    currentSelectedTooth = toothNum.toString();
    const toothName = FDI_TOOTH_NAMES[currentSelectedTooth] || `Pieza FDI ${currentSelectedTooth}`;
    const toothState = (dentalStore[currentPatientKey] && dentalStore[currentPatientKey][currentSelectedTooth]) || {};
    const toothTreatments = treatments.filter(t => t.pieza.includes(currentSelectedTooth));
    
    // Identificar cuadrante
    const numInt = parseInt(currentSelectedTooth);
    let quadrantName = 'Cuadrante Superior Derecho (1)';
    if (numInt >= 21 && numInt <= 28) quadrantName = 'Cuadrante Superior Izquierdo (2)';
    else if (numInt >= 31 && numInt <= 38) quadrantName = 'Cuadrante Inferior Izquierdo (3)';
    else if (numInt >= 41 && numInt <= 48) quadrantName = 'Cuadrante Inferior Derecho (4)';
    else if (numInt >= 51 && numInt <= 55) quadrantName = 'Cuadrante Temporal Superior Derecho (5)';
    else if (numInt >= 61 && numInt <= 65) quadrantName = 'Cuadrante Temporal Superior Izquierdo (6)';
    else if (numInt >= 71 && numInt <= 75) quadrantName = 'Cuadrante Temporal Inferior Izquierdo (7)';
    else if (numInt >= 81 && numInt <= 85) quadrantName = 'Cuadrante Temporal Inferior Derecho (8)';

    const contentDiv = document.getElementById('toothDetailContent');
    if (!contentDiv) return;

    contentDiv.innerHTML = `
      <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <span class="badge bg-primary text-white px-3 py-1.5 rounded-pill fw-bold" style="font-size: 0.95rem;">
          🦷 Pieza FDI ${currentSelectedTooth}
        </span>
        <span class="badge bg-dark text-info border border-info border-opacity-25 px-2.5 py-1 rounded-pill small" style="white-space: normal; text-align: right; line-height: 1.25;">
          ${quadrantName}
        </span>
      </div>

      <h5 class="fw-extrabold text-white mb-2" style="line-height: 1.35; word-break: break-word;">${toothName}</h5>
      <p class="text-white-50 small mb-3" style="line-height: 1.5;">${toothState.desc || (toothState.status ? 'Registro clínico activo en ficha FDI.' : 'Pieza clínicamente sana, sin lesiones activas.')}</p>

      <!-- Estado Clínico Actual -->
      <div class="p-3 rounded-4 mb-3" style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255, 255, 255, 0.1);">
        <span class="small text-white-50 d-block mb-1 fw-bold text-uppercase" style="font-size: 0.75rem;">Estado Clínico Registrado:</span>
        <div class="d-flex align-items-center gap-2">
          ${toothState.status === 'caries' ? '<span class="badge bg-danger text-white px-3 py-1.5 rounded-pill fw-bold">🔴 Caries Activa</span>' :
            toothState.status === 'obturacion' ? '<span class="badge bg-info text-white px-3 py-1.5 rounded-pill fw-bold">🔵 Obturación en Resina</span>' :
            toothState.status === 'sellante' ? '<span class="badge bg-warning text-dark px-3 py-1.5 rounded-pill fw-bold">🟡 Sellante Preventivo</span>' :
            toothState.status === 'ausente' ? '<span class="badge bg-secondary text-white px-3 py-1.5 rounded-pill fw-bold">⚪ Pieza Ausente</span>' :
            toothState.status === 'planificado' ? '<span class="badge bg-success text-white px-3 py-1.5 rounded-pill fw-bold">🟢 Planificado</span>' :
            '<span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25 px-3 py-1.5 rounded-pill fw-bold">✨ Clínicamente Sano</span>'
          }
        </div>
      </div>

      <!-- Historial de Procedimientos de esta Pieza -->
      <div class="mb-3">
        <span class="small text-white-50 d-block mb-1.5 fw-bold text-uppercase" style="font-size: 0.75rem;">Historial en esta Pieza:</span>
        ${toothTreatments.length > 0 ? toothTreatments.map(t => `
          <div class="p-2.5 rounded-3 mb-2" style="background: rgba(255,255,255,0.04); border-left: 4px solid #38bdf8;">
            <div class="d-flex justify-content-between small text-white-50">
              <span>${t.fecha}</span>
              <span class="text-success fw-bold">Realizado</span>
            </div>
            <strong class="text-white small d-block mt-0.5">${t.procedimiento}</strong>
          </div>
        `).join('') : `
          <p class="text-white-50 small fst-italic m-0">Sin procedimientos invasivos previos registrados.</p>
        `}
      </div>
    `;

    // Actualizar brillo en el SVG seleccionado
    container.querySelectorAll('.tooth-svg').forEach(el => {
      const isThis = el.getAttribute('data-tooth') === currentSelectedTooth;
      el.style.border = isThis ? '2px solid #38bdf8' : '1.5px solid rgba(56, 189, 248, 0.3)';
      el.style.boxShadow = isThis ? '0 0 16px rgba(56, 189, 248, 0.8)' : 'none';
      el.style.transform = isThis ? 'scale(1.18)' : 'scale(1)';
    });

    container.querySelectorAll('.tooth-num-label').forEach(el => {
      const parent = el.closest('.tooth-container');
      const isThis = parent && parent.getAttribute('data-tooth') === currentSelectedTooth;
      el.style.color = isThis ? '#38bdf8' : (isPediatric ? '#7dd3fc' : '#94a3b8');
    });
  };

  // Inicializar panel lateral con la pieza predeterminada
  updateToothDetailPanel(currentSelectedTooth);

  // Conectar clics en los dientes anatómicos
  container.querySelectorAll('.tooth-svg').forEach(svg => {
    svg.onclick = (e) => {
      const toothNum = svg.getAttribute('data-tooth');
      updateToothDetailPanel(toothNum);
    };
  });

  // Conectar botón '✨ Ver Evolución Antes / Después'
  const btnVerAntesDespues = container.querySelector('#btnVerAntesDespues');
  if (btnVerAntesDespues) {
    btnVerAntesDespues.onclick = () => {
      openModalAntesDespues(currentSelectedTooth, currentPatientKey);
    };
  }

  // Conectar botón '✏️ Registrar Estado / Procedimiento' si está presente
  const btnEditarEstado = container.querySelector('#btnEditarEstadoDiente');
  if (btnEditarEstado) {
    btnEditarEstado.onclick = () => {
      openToothSelectorModal(currentSelectedTooth, 'oclusal', container, patientId, userRole);
    };
  }

  // Lógica del Explorador de Carpetas GlassKit (Raíz vs Detalle)
  let activeOpenedFolder = 'radiografias';
  let activeSearchTerm = '';

  const rootView = container.querySelector('#dentalExplorerRootView');
  const detailView = container.querySelector('#dentalExplorerDetailView');
  const cardRx = container.querySelector('#cardFolderRadiografias');
  const cardInf = container.querySelector('#cardFolderInformes');
  const btnBack = container.querySelector('#btnBackToFoldersRoot');
  const detailTitle = container.querySelector('#folderDetailTitle');
  const detailSubtitle = container.querySelector('#folderDetailSubtitle');
  const detailEmoji = container.querySelector('#folderDetailEmoji');
  const detailSearch = container.querySelector('#inputDetailSearch');
  const iconDetailSearch = container.querySelector('#iconDetailSearch');
  const filesList = container.querySelector('#folderFilesContainer');
  const btnUpload = container.querySelector('#btnUploadDentalDoc');
  const inputUpload = container.querySelector('#inputUploadDentalDoc');
  const bannerUpload = container.querySelector('#bannerUploadStatus');

  const renderFolderDetailFiles = () => {
    if (!filesList) return;
    const patientFolders = dentalFoldersData[currentPatientKey] || dentalFoldersData.adulto;
    const currentFiles = patientFolders[activeOpenedFolder] || [];

    const filtered = currentFiles.filter(item => {
      if (!activeSearchTerm.trim()) return true;
      const term = activeSearchTerm.toLowerCase();
      return (
        item.nombre.toLowerCase().includes(term) ||
        item.fecha.toLowerCase().includes(term) ||
        item.especialista.toLowerCase().includes(term) ||
        item.institucion.toLowerCase().includes(term) ||
        item.tipo.toLowerCase().includes(term) ||
        item.nota.toLowerCase().includes(term)
      );
    });

    if (filtered.length === 0) {
      filesList.innerHTML = `
        <div class="p-5 text-center rounded-4" style="background: rgba(30, 41, 59, 0.4); border: 1.5px dashed rgba(255, 255, 255, 0.15);">
          <span style="font-size: 3rem;" class="mb-2 d-block">🔍</span>
          <h6 class="fw-bold text-white mb-1">No se encontraron documentos en esta carpeta</h6>
          <p class="text-white-50 small m-0">${isReadOnly ? 'No hay documentos que coincidan con el término ingresado.' : 'Prueba con otro término de búsqueda o añade un nuevo documento.'}</p>
        </div>
      `;
      return;
    }

    filesList.innerHTML = filtered.map(file => {
      const isRx = activeOpenedFolder === 'radiografias';
      return `
        <div class="p-3.5 p-md-4 rounded-4 d-flex justify-content-between align-items-center flex-wrap gap-3 shadow-sm file-item-row" style="background: rgba(30, 41, 59, 0.6); border: 1.5px solid rgba(255, 255, 255, 0.12); border-left: 6px solid ${isRx ? '#38bdf8' : '#c084fc'}; border-radius: 20px; transition: transform 0.2s, background 0.2s;">
          <div class="d-flex align-items-center gap-3">
            <div class="d-flex justify-content-center align-items-center rounded-circle flex-shrink-0" style="width: 52px; height: 52px; background: ${isRx ? 'rgba(56, 189, 248, 0.15)' : 'rgba(192, 132, 252, 0.15)'}; border: 1.5px solid ${isRx ? '#38bdf8' : '#c084fc'};">
              <span style="font-size: 1.8rem;">${file.icono || (isRx ? '🩻' : '📄')}</span>
            </div>
            <div>
              <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
                <h6 class="fw-extrabold mb-0 text-white" style="font-size: 1.05rem;">${file.nombre}</h6>
                <span class="badge px-2.5 py-0.5 rounded-pill small" style="background: rgba(255, 255, 255, 0.08); color: ${isRx ? '#7dd3fc' : '#e9d5ff'}; border: 1px solid rgba(255, 255, 255, 0.15);">
                  ${file.tipo}
                </span>
              </div>
              <p class="small text-white-50 m-0 mb-1">
                <i class="bi bi-calendar3 me-1"></i><strong class="text-white">${file.fecha}</strong> &bull; 
                <i class="bi bi-person-fill ms-1 me-1"></i>${file.especialista} &bull; 
                <i class="bi bi-building ms-1 me-1"></i>${file.institucion} &bull; 
                <i class="bi bi-file-earmark-check ms-1 me-1"></i>${file.tamano}
              </p>
              <div class="small text-white-50 fst-italic">
                <i class="bi bi-info-circle text-info me-1"></i>${file.nota}
              </div>
            </div>
          </div>
          <div class="d-flex align-items-center gap-2 ms-auto">
            <button type="button" class="btn btn-sm px-3.5 py-2 rounded-pill fw-bold d-inline-flex align-items-center gap-1.5 btn-file-ver" data-file-title="${file.nombre}" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); cursor: pointer;">
              <i class="bi bi-eye-fill"></i> Visualizar
            </button>
            <button type="button" class="btn btn-sm px-3.5 py-2 rounded-pill fw-bold d-inline-flex align-items-center gap-1.5 btn-file-descargar" data-file-title="${file.nombre}" style="background: rgba(255, 255, 255, 0.08); color: #ffffff; border: 1.5px solid rgba(255, 255, 255, 0.2); cursor: pointer;">
              <i class="bi bi-download"></i> Descargar
            </button>
          </div>
        </div>
      `;
    }).join('');

    filesList.querySelectorAll('.btn-file-ver').forEach(btn => {
      btn.onclick = () => {
        const title = btn.getAttribute('data-file-title');
        if (window.showGlassAlert) {
          window.showGlassAlert(`👁️ Abriendo visor clínico oficial para: ${title}`, 'info');
        }
      };
    });

    filesList.querySelectorAll('.btn-file-descargar').forEach(btn => {
      btn.onclick = () => {
        const title = btn.getAttribute('data-file-title');
        if (window.showGlassAlert) {
          window.showGlassAlert(`📥 Descargando documento clínico oficial: ${title}`, 'success');
        }
      };
    });
  };

  const openFolder = (folderKey) => {
    activeOpenedFolder = folderKey;
    activeSearchTerm = '';
    if (detailSearch) detailSearch.value = '';

    const isRx = folderKey === 'radiografias';
    if (detailTitle) detailTitle.textContent = isRx ? 'Carpeta de Radiografías' : 'Carpeta de Informes';
    if (detailSubtitle) detailSubtitle.textContent = isRx ? 'Exámenes radiológicos, panorámicas y tomografías digitales' : 'Informes clínicos periodontales, presupuestos GES y certificados';
    if (detailEmoji) detailEmoji.textContent = isRx ? '🩻' : '📄';

    if (iconDetailSearch) {
      iconDetailSearch.style.color = isRx ? '#38bdf8' : '#c084fc';
    }

    if (btnUpload) {
      btnUpload.style.background = isRx ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'linear-gradient(135deg, #9333ea 0%, #7e22ce 100%)';
      btnUpload.style.border = isRx ? '1.5px solid #38bdf8' : '1.5px solid #c084fc';
    }

    if (rootView) rootView.classList.add('d-none');
    if (detailView) detailView.classList.remove('d-none');

    renderFolderDetailFiles();
  };

  if (cardRx) {
    cardRx.onclick = () => openFolder('radiografias');
  }

  if (cardInf) {
    cardInf.onclick = () => openFolder('informes');
  }

  if (btnBack) {
    btnBack.onclick = () => {
      if (detailView) detailView.classList.add('d-none');
      if (rootView) rootView.classList.remove('d-none');

      const countBadgeRx = container.querySelector('#badgeCountRadiografias');
      const countBadgeInf = container.querySelector('#badgeCountInformes');
      const patientFolders = dentalFoldersData[currentPatientKey] || dentalFoldersData.adulto;
      if (countBadgeRx) countBadgeRx.textContent = patientFolders.radiografias?.length || 3;
      if (countBadgeInf) countBadgeInf.textContent = patientFolders.informes?.length || 3;
    };
  }

  if (detailSearch) {
    detailSearch.oninput = (e) => {
      activeSearchTerm = e.target.value;
      renderFolderDetailFiles();
    };
  }

  if (btnUpload && inputUpload) {
    btnUpload.onclick = () => inputUpload.click();
    inputUpload.onchange = (e) => {
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        if (bannerUpload) bannerUpload.classList.remove('d-none');
        btnUpload.disabled = true;

        setTimeout(() => {
          if (bannerUpload) bannerUpload.classList.add('d-none');
          btnUpload.disabled = false;

          const isPdf = file.name.endsWith('.pdf');
          const isRx = activeOpenedFolder === 'radiografias';
          const newDoc = {
            id: `doc-${Date.now()}`,
            nombre: file.name.replace(/\.[^/.]+$/, "") + ` - ${new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}`,
            fecha: new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }),
            especialista: 'Dr. Marcelo Valenzuela (Cirujano Dentista)',
            institucion: 'Clínica Odontológica Central',
            icono: isRx ? '🩻' : '📄',
            tipo: isRx ? (isPdf ? 'Informe Radiológico Digital' : 'Radiografía Digital HD') : 'Informe Clínico Digital',
            tamano: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
            nota: 'Validado con IA: Sin hallazgos patológicos agudos.'
          };

          const patientFolders = dentalFoldersData[currentPatientKey] || dentalFoldersData.adulto;
          if (!patientFolders[activeOpenedFolder]) patientFolders[activeOpenedFolder] = [];
          patientFolders[activeOpenedFolder].unshift(newDoc);

          if (window.showGlassAlert) {
            window.showGlassAlert(`✨ Documento añadido exitosamente a la ${isRx ? 'Carpeta de Radiografías' : 'Carpeta de Informes'}.`, 'success');
          }

          renderFolderDetailFiles();
        }, 1500);

        e.target.value = '';
      }
    };
  }
}

// Modal comparativo Antes / Después
export const modalAntesDespuesHTML = `
  <div id="modalAntesDespuesDental" class="modal fade" tabindex="-1" style="display: none; background: rgba(10, 15, 29, 0.9); backdrop-filter: blur(16px);" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-lg">
      <div class="modal-content text-white" style="background: rgba(15, 23, 42, 0.98); border: 2px solid #38bdf8; border-radius: 28px; box-shadow: 0 25px 60px rgba(0,0,0,0.9); overflow: hidden; font-family: 'Outfit', sans-serif;">
        <div class="modal-header border-bottom p-4 d-flex justify-content-between align-items-center" style="background: rgba(14, 165, 233, 0.15); border-color: rgba(255, 255, 255, 0.1) !important;">
          <div class="d-flex align-items-center gap-2">
            <span style="font-size: 2.2rem;">✨</span>
            <div>
              <h4 class="modal-title fw-extrabold m-0 text-white" id="modalAntesDespuesTitle">Evolución Clínica: Antes / Después</h4>
              <small class="text-info fw-semibold" id="modalAntesDespuesSubtitle">Comparativa de Recuperación y Restauración Dental</small>
            </div>
          </div>
          <button type="button" class="btn-close btn-close-white" id="btnCloseAntesDespuesX" aria-label="Close" style="cursor: pointer;"></button>
        </div>
        
        <div class="modal-body p-4">
          <div class="row g-4 text-center">
            <!-- Columna Antes -->
            <div class="col-12 col-md-6">
              <div class="p-3.5 rounded-4 h-100" style="background: rgba(239, 68, 68, 0.08); border: 2px dashed #ef4444;">
                <span class="badge bg-danger text-white px-3 py-1.5 rounded-pill fw-bold mb-3 d-inline-block">
                  🔴 ANTES: Lesión Cariosa Activa
                </span>
                <!-- Ilustración Anatómica Esquema Caries -->
                <div class="d-flex justify-content-center my-3">
                  <div style="width: 140px; height: 140px; border-radius: 50%; background: #0f172a; border: 3px solid #ef4444; position: relative;" class="d-flex align-items-center justify-content-center shadow-lg">
                    <svg width="100" height="100" viewBox="0 0 100 100">
                      <!-- Diente base -->
                      <path d="M 20,25 C 20,10 80,10 80,25 C 80,60 70,90 50,90 C 30,90 20,60 20,25 Z" fill="#1e293b" stroke="#cbd5e1" stroke-width="2"/>
                      <!-- Cavidad cariosa -->
                      <path d="M 40,25 C 45,18 55,18 60,25 C 65,35 55,42 50,42 C 45,42 35,35 40,25 Z" fill="#ef4444" stroke="#991b1b" stroke-width="2"/>
                      <circle cx="50" cy="30" r="4" fill="#7f1d1d" />
                    </svg>
                  </div>
                </div>
                <h6 class="fw-bold text-white mb-1">Caries Dentinaria Oclusal</h6>
                <p class="text-white-50 small mb-2">Lesión activa con pérdida de esmalte, dolor al frío y fosa retentiva pigmentada.</p>
                <span class="badge bg-dark text-danger border border-danger border-opacity-25 px-2.5 py-1 rounded-pill small">Control Inicial &bull; 28 Sep 2026</span>
              </div>
            </div>

            <!-- Columna Después -->
            <div class="col-12 col-md-6">
              <div class="p-3.5 rounded-4 h-100" style="background: rgba(56, 189, 248, 0.08); border: 2px solid #38bdf8;">
                <span class="badge bg-info text-white px-3 py-1.5 rounded-pill fw-bold mb-3 d-inline-block">
                  🟢 DESPUÉS: Restauración Anatómica
                </span>
                <!-- Ilustración Anatómica Esquema Resina/Sellado -->
                <div class="d-flex justify-content-center my-3">
                  <div style="width: 140px; height: 140px; border-radius: 50%; background: #0f172a; border: 3px solid #38bdf8; position: relative;" class="d-flex align-items-center justify-content-center shadow-lg">
                    <svg width="100" height="100" viewBox="0 0 100 100">
                      <!-- Diente base -->
                      <path d="M 20,25 C 20,10 80,10 80,25 C 80,60 70,90 50,90 C 30,90 20,60 20,25 Z" fill="#1e293b" stroke="#cbd5e1" stroke-width="2"/>
                      <!-- Restauración estética de resina -->
                      <path d="M 38,24 C 45,20 55,20 62,24 C 66,32 58,38 50,38 C 42,38 34,32 38,24 Z" fill="#38bdf8" stroke="#0284c7" stroke-width="2"/>
                      <!-- Brillo estético fotocurado -->
                      <path d="M 44,25 Q 50,22 56,25" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                  </div>
                </div>
                <h6 class="fw-bold text-white mb-1">Obturación Resina Nanohíbrida</h6>
                <p class="text-white-50 small mb-2">Sellado marginal hermético, anatomía oclusal esculpida y pulido de alto brillo.</p>
                <span class="badge bg-dark text-info border border-info border-opacity-25 px-2.5 py-1 rounded-pill small">Control de Alta &bull; 14 Oct 2026</span>
              </div>
            </div>
          </div>

          <div class="mt-4 p-3 rounded-4" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);">
            <div class="d-flex align-items-center gap-2">
              <span style="font-size: 1.5rem;">🩺</span>
              <div>
                <strong class="text-white small d-block">Procedimiento Validado por Odontólogo Tratante:</strong>
                <span class="text-white-50 small">Protocolo adhesivo de 4ª generación con grabado ácido total y lámpara LED de fotocurado. Ficha conforme Ley N° 20.584.</span>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer p-3 border-top justify-content-between" style="background: rgba(15, 23, 42, 0.98); border-color: rgba(255, 255, 255, 0.1) !important;">
          <span class="text-white-50 small"><i class="bi bi-shield-check text-info me-1"></i>Sello de Conformidad Clínica</span>
          <button type="button" class="btn btn-outline-light px-4 py-2 rounded-pill fw-bold" id="btnCloseAntesDespuesBtn">Cerrar Visor</button>
        </div>
      </div>
    </div>
  </div>
`;

// Abrir modal Antes / Después
export function openModalAntesDespues(toothNum, patientKey) {
  let modalEl = document.getElementById('modalAntesDespuesDental');
  if (!modalEl) {
    const div = document.createElement('div');
    div.innerHTML = modalAntesDespuesHTML;
    document.body.appendChild(div.firstElementChild);
    modalEl = document.getElementById('modalAntesDespuesDental');
  }

  const title = document.getElementById('modalAntesDespuesTitle');
  const subtitle = document.getElementById('modalAntesDespuesSubtitle');
  const toothName = FDI_TOOTH_NAMES[toothNum] || `Pieza FDI ${toothNum}`;
  if (title) title.textContent = `Evolución: ${toothName}`;
  if (subtitle) subtitle.textContent = `Pieza FDI ${toothNum} • Comparativa de Tratamiento Clínico y Restauración`;

  const closeModal = () => {
    try {
      if (window.bootstrap && window.bootstrap.Modal) {
        const inst = window.bootstrap.Modal.getInstance(modalEl);
        if (inst) inst.hide();
      }
    } catch(e) {}
    modalEl.classList.remove('show');
    modalEl.style.display = 'none';
  };

  const btnX = document.getElementById('btnCloseAntesDespuesX');
  const btnClose = document.getElementById('btnCloseAntesDespuesBtn');
  if (btnX) btnX.onclick = closeModal;
  if (btnClose) btnClose.onclick = closeModal;

  try {
    if (window.bootstrap && window.bootstrap.Modal) {
      new window.bootstrap.Modal(modalEl).show();
      return;
    }
  } catch(e) {}
  modalEl.classList.add('show');
  modalEl.style.display = 'block';
}

// Modal interactivo para seleccionar la cara y color del diente (GlassKit Dark UI)
export const modalToothColorSelectorHTML = `
  <div id="modalToothColorSelector" class="modal fade" tabindex="-1" style="display: none; background: rgba(10, 15, 29, 0.9); backdrop-filter: blur(14px);" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content text-white" style="background: rgba(15, 23, 42, 0.98); border-radius: 28px; border: 2px solid #38bdf8; box-shadow: 0 25px 60px rgba(0,0,0,0.9); overflow: hidden; font-family: 'Outfit', sans-serif;">
        <div class="modal-header border-bottom p-4 d-flex justify-content-between align-items-center" style="background: rgba(14, 165, 233, 0.15); border-color: rgba(255, 255, 255, 0.1) !important;">
          <div class="d-flex align-items-center gap-2">
            <span style="font-size: 2rem;">🦷</span>
            <div>
              <h5 class="modal-title fw-extrabold m-0 text-white" id="modalToothTitle">Marcar Pieza Dental</h5>
              <small class="text-white-50" id="modalToothSubtitle">Selecciona la cara y el estado clínico según FDI</small>
            </div>
          </div>
          <button type="button" class="btn-close btn-close-white" id="btnCloseToothModalX" aria-label="Close" style="cursor: pointer;"></button>
        </div>
        
        <div class="modal-body p-4 text-center">
          <!-- Selector de Cara del Diente -->
          <div class="mb-3 text-start">
            <label class="form-label small fw-bold text-white-50 text-uppercase mb-1">Cara del Diente a Marcar:</label>
            <div class="d-flex flex-wrap gap-1.5 justify-content-center" id="faceSelectorButtons">
              <button type="button" class="btn btn-sm btn-primary active px-2.5 py-1.5 rounded-pill fw-bold" data-face-select="oclusal">Oclusal (Centro)</button>
              <button type="button" class="btn btn-sm btn-outline-info px-2.5 py-1.5 rounded-pill fw-bold" data-face-select="vestibular">Vestibular</button>
              <button type="button" class="btn btn-sm btn-outline-info px-2.5 py-1.5 rounded-pill fw-bold" data-face-select="lingual">Palatina / Lingual</button>
              <button type="button" class="btn btn-sm btn-outline-info px-2.5 py-1.5 rounded-pill fw-bold" data-face-select="mesial">Mesial</button>
              <button type="button" class="btn btn-sm btn-outline-info px-2.5 py-1.5 rounded-pill fw-bold" data-face-select="distal">Distal</button>
              <button type="button" class="btn btn-sm btn-outline-secondary px-2.5 py-1.5 rounded-pill fw-bold" data-face-select="whole">Toda la Pieza</button>
            </div>
          </div>

          <!-- Los 5 Botones de Colores FDI -->
          <label class="form-label small fw-bold text-white-50 text-uppercase mb-2 text-start d-block">Selecciona el Estado Clínico:</label>
          <div class="d-flex flex-column gap-2 mb-3">
            <button type="button" class="btn py-2.5 px-3 rounded-4 fw-extrabold text-white text-start d-flex justify-content-between align-items-center shadow-sm" data-color-action="caries" style="background: #ef4444; border: 1.5px solid #f87171; cursor: pointer;">
              <span>🔴 Caries Activa</span>
              <span class="badge bg-white text-danger fw-bold">Rojo</span>
            </button>

            <button type="button" class="btn py-2.5 px-3 rounded-4 fw-extrabold text-white text-start d-flex justify-content-between align-items-center shadow-sm" data-color-action="obturacion" style="background: #3b82f6; border: 1.5px solid #60a5fa; cursor: pointer;">
              <span>🔵 Obturación (Resina / Amalgama)</span>
              <span class="badge bg-white text-primary fw-bold">Azul</span>
            </button>

            <button type="button" class="btn py-2.5 px-3 rounded-4 fw-extrabold text-white text-start d-flex justify-content-between align-items-center shadow-sm" data-color-action="planificado" style="background: #10b981; border: 1.5px solid #34d399; cursor: pointer;">
              <span>🟢 Planificado (Tratamiento futuro)</span>
              <span class="badge bg-white text-success fw-bold">Verde</span>
            </button>

            <button type="button" class="btn py-2.5 px-3 rounded-4 fw-extrabold text-white text-start d-flex justify-content-between align-items-center shadow-sm" data-color-action="ausente" style="background: #64748b; border: 1.5px solid #9ca3af; cursor: pointer;">
              <span>⚪ Ausente / Exodoncia</span>
              <span class="badge bg-white text-secondary fw-bold">Gris</span>
            </button>

            <button type="button" class="btn py-2.5 px-3 rounded-4 fw-extrabold text-dark text-start d-flex justify-content-between align-items-center shadow-sm" data-color-action="sellante" style="background: #facc15; border: 1.5px solid #fde047; cursor: pointer;">
              <span>🟡 Sellante (Preventivo)</span>
              <span class="badge bg-dark text-warning fw-bold">Amarillo</span>
            </button>

            <button type="button" class="btn py-2 px-3 rounded-4 fw-bold text-white text-start d-flex justify-content-between align-items-center" data-color-action="sano" style="background: rgba(255,255,255,0.06); border: 1.5px dashed rgba(255,255,255,0.25); cursor: pointer;">
              <span>✨ Sano / Limpiar Marca</span>
              <span class="small text-white-50">Esmalte Sano</span>
            </button>
          </div>
        </div>

        <div class="modal-footer p-3 border-top justify-content-between" style="background: rgba(15, 23, 42, 0.98); border-color: rgba(255, 255, 255, 0.1) !important;">
          <small class="text-white-50"><i class="bi bi-shield-check text-success me-1"></i>Ficha Odontológica Oficial FDI &bull; Ley N° 20.584</small>
          <button type="button" class="btn btn-outline-light px-4 py-2 rounded-pill fw-bold" id="btnCloseToothModalBtn">Cerrar</button>
        </div>
      </div>
    </div>
  </div>
`;

// Modal maestro de "Mi Ficha Dental"
export const modalFichaDentalHTML = `
  <div id="modalFichaDentalIntegrada" class="modal fade" tabindex="-1" style="display: none; background: rgba(10, 15, 29, 0.9); backdrop-filter: blur(16px);" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
      <div class="modal-content text-white" style="background: rgba(15, 23, 42, 0.98); backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px); border-radius: 28px; border: 1.5px solid rgba(56, 189, 248, 0.4); box-shadow: 0 25px 60px rgba(0,0,0,0.9); overflow: hidden; font-family: 'Outfit', sans-serif;">
        <div class="modal-header border-bottom p-4 d-flex justify-content-between align-items-center" style="background: rgba(14, 165, 233, 0.15); border-color: rgba(255, 255, 255, 0.1) !important;">
          <div class="d-flex align-items-center gap-3">
            <span style="font-size: 2.6rem;">🦷</span>
            <div>
              <h4 class="modal-title fw-extrabold m-0 text-white">Mi Ficha Dental Integral</h4>
              <small class="text-white-50">Odontograma Digital Anatómico FDI, Carpetas Odontológicas y Registro de Procedimientos</small>
            </div>
          </div>
          <button type="button" class="btn-close btn-close-white" id="btnCloseModalFichaDentalX" aria-label="Close" style="cursor: pointer;"></button>
        </div>
        
        <div class="modal-body p-4 p-md-5" id="modalFichaDentalBody" style="overflow-x: auto;">
          <!-- Contenido dinámico renderizado con renderOdontograma -->
        </div>

        <div class="modal-footer p-3 px-4 border-top justify-content-between" style="background: rgba(15, 23, 42, 0.98); border-color: rgba(255, 255, 255, 0.1) !important;">
          <span class="text-white-50 small"><i class="bi bi-shield-check text-info me-1"></i>Ficha Odontológica Oficial cuidApp &bull; Ley N° 20.584</span>
          <button type="button" class="btn btn-outline-light px-4 py-2 rounded-pill fw-bold" id="btnCloseModalFichaDentalBtn">Cerrar Ficha Dental</button>
        </div>
      </div>
    </div>
  </div>
  ${modalToothColorSelectorHTML}
  ${modalAntesDespuesHTML}
`;

// Abrir el selector de estado y colores para un diente específico
function openToothSelectorModal(toothNum, defaultFace = 'oclusal', parentContainer, patientId, userRole = null) {
  const isDoctor = checkIsDoctorUser(userRole);
  if (!isDoctor) {
    if (typeof window !== 'undefined' && window.showGlassAlert) {
      window.showGlassAlert('🔒 Modo Solo Lectura • Registro exclusivo del Odontólogo (Ley N° 20.584). La edición clínica solo puede ser realizada por el profesional odontólogo.', 'warning');
    }
    return;
  }

  currentSelectedTooth = toothNum.toString();
  let selectedFace = defaultFace;

  const modalEl = document.getElementById('modalToothColorSelector');
  if (!modalEl) return;

  const modalTitle = document.getElementById('modalToothTitle');
  const modalSubtitle = document.getElementById('modalToothSubtitle');
  const toothName = FDI_TOOTH_NAMES[toothNum] || `Pieza FDI ${toothNum}`;
  if (modalTitle) modalTitle.textContent = `Marcar ${toothName}`;
  if (modalSubtitle) modalSubtitle.textContent = `Pieza FDI ${toothNum} • Selecciona la cara del diente y el estado clínico según FDI`;

  // Marcar botón de cara activa
  const faceButtons = modalEl.querySelectorAll('[data-face-select]');
  faceButtons.forEach(btn => {
    const f = btn.getAttribute('data-face-select');
    btn.className = (f === selectedFace)
      ? 'btn btn-sm btn-primary active px-2.5 py-1.5 rounded-pill fw-bold'
      : 'btn btn-sm btn-outline-info px-2.5 py-1.5 rounded-pill fw-bold';
    
    btn.onclick = () => {
      selectedFace = f;
      faceButtons.forEach(b => {
        b.className = (b.getAttribute('data-face-select') === selectedFace)
          ? 'btn btn-sm btn-primary active px-2.5 py-1.5 rounded-pill fw-bold'
          : 'btn btn-sm btn-outline-info px-2.5 py-1.5 rounded-pill fw-bold';
      });
    };
  });

  const closeSelectorModal = () => {
    try {
      if (window.bootstrap && window.bootstrap.Modal) {
        const inst = window.bootstrap.Modal.getInstance(modalEl);
        if (inst) inst.hide();
      }
    } catch (e) {}
    modalEl.classList.remove('show');
    modalEl.style.display = 'none';
  };

  const btnCloseX = document.getElementById('btnCloseToothModalX');
  if (btnCloseX) btnCloseX.onclick = closeSelectorModal;

  const btnClose = document.getElementById('btnCloseToothModalBtn');
  if (btnClose) btnClose.onclick = closeSelectorModal;

  // Botones de colores
  const colorButtons = modalEl.querySelectorAll('[data-color-action]');
  colorButtons.forEach(btn => {
    btn.onclick = () => {
      const action = btn.getAttribute('data-color-action');
      const colorDef = DENTAL_COLORS[action] || DENTAL_COLORS.sano;

      if (!dentalStore[currentPatientKey]) dentalStore[currentPatientKey] = {};
      if (!dentalStore[currentPatientKey][toothNum]) dentalStore[currentPatientKey][toothNum] = {};

      const toothState = dentalStore[currentPatientKey][toothNum];

      if (selectedFace === 'whole' || action === 'ausente') {
        toothState.whole = colorDef.color;
        toothState.vestibular = colorDef.color;
        toothState.lingual = colorDef.color;
        toothState.mesial = colorDef.color;
        toothState.distal = colorDef.color;
        toothState.oclusal = colorDef.color;
        toothState.status = action;
        toothState.desc = `Pieza marcada como ${colorDef.label}`;
      } else {
        toothState[selectedFace] = colorDef.color;
        toothState.status = action;
        toothState.desc = `${colorDef.label} en cara ${selectedFace.toUpperCase()}`;
        if (toothState.whole) delete toothState.whole;
      }

      if (action !== 'sano') {
        const newHist = {
          fecha: new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }),
          pieza: `Pieza ${toothNum}`,
          procedimiento: `${colorDef.label} en cara ${selectedFace.toUpperCase()}`,
          profesional: currentPatientKey === 'pediatrico' ? 'Dra. Marcela Soto - Odontopediatra' : 'Dr. Marcelo Valenzuela - Odontólogo'
        };
        if (!dentalTreatments[currentPatientKey]) dentalTreatments[currentPatientKey] = [];
        dentalTreatments[currentPatientKey].unshift(newHist);
      }

      closeSelectorModal();

      if (window.showGlassAlert) {
        window.showGlassAlert(`Pieza ${toothNum} marcada como ${colorDef.label} (${selectedFace.toUpperCase()}).`, 'success');
      }

      if (parentContainer) {
        renderOdontograma(parentContainer, patientId, userRole);
      }
    };
  });

  try {
    if (window.bootstrap && window.bootstrap.Modal) {
      new window.bootstrap.Modal(modalEl).show();
      return;
    }
  } catch (e) {}
  modalEl.classList.add('show');
  modalEl.style.display = 'block';
}

// 5. Función principal para abrir el módulo "Mi Ficha Dental"
export function openDentalModuleModal(patientId = 'adulto', userRole = null) {
  let modalEl = document.getElementById('modalFichaDentalIntegrada');
  
  if (!modalEl) {
    const div = document.createElement('div');
    div.id = 'dentalModuleWrapper';
    div.innerHTML = modalFichaDentalHTML;
    document.body.appendChild(div);
    modalEl = document.getElementById('modalFichaDentalIntegrada');
  }

  const modalBody = document.getElementById('modalFichaDentalBody');
  if (modalBody) {
    renderOdontograma(modalBody, patientId, userRole);
  }

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

  const btnCloseX = document.getElementById('btnCloseModalFichaDentalX');
  if (btnCloseX) btnCloseX.onclick = closeModal;

  const btnCloseBtn = document.getElementById('btnCloseModalFichaDentalBtn');
  if (btnCloseBtn) btnCloseBtn.onclick = closeModal;

  if (window.showGlassAlert) {
    window.showGlassAlert('🦷 Abriendo Mi Ficha Dental Integral...', 'info');
  }

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
