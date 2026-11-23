/**
 * cuidApp - Módulo de Registro Clínico Electrónico (RCE) Multi-Especialidad
 * Cumplimiento Normativo: Ley N° 20.584, Ley N° 21.541 (Telemedicina), Ley N° 21.668 y Decreto Supremo N° 41 MINSAL
 */

import { STORAGE_KEYS, getTodayISO, formatChileanDate } from './utils/clinical-helpers.js';

// ============================================================================
// 1. CATÁLOGOS DE ESPECIALIDADES MÉDICAS Y CÓDIGOS CIE-10 MINSAL
// ============================================================================

export const MEDICAL_SPECIALTIES = {
  MEDICINA_GENERAL: {
    id: 'medicina_general',
    name: 'Medicina General y Familiar',
    icon: '🩺',
    badgeClass: 'bg-primary bg-opacity-25 text-info border border-info border-opacity-40',
    color: '#38bdf8',
    description: 'Atención primaria integral del adulto, control preventivo EMPA y patologías agudas/crónicas comunes.',
    cie10Presets: [
      { code: 'Z00.0', desc: 'Examen médico general / Control Preventivo Adulto (EMPA)' },
      { code: 'I10', desc: 'Hipertensión Esencial (Primaria)' },
      { code: 'E11', desc: 'Diabetes Mellitus Tipo 2 no insulinodependiente' },
      { code: 'E78.5', desc: 'Dislipidemia no especificada' },
      { code: 'J00', desc: 'Rinofaringitis aguda (Resfrío común)' },
      { code: 'K29.7', desc: 'Gastritis no especificada / Dispepsia funcional' },
      { code: 'M54.5', desc: 'Lumbago mecánico agudo no especificado' },
      { code: 'N39.0', desc: 'Infección del tracto urinario, sitio no especificado' }
    ]
  },
  GINECO_OBSTETRICIA: {
    id: 'gineco_obstetricia',
    name: 'Ginecología y Obstetricia',
    icon: '🤰',
    badgeClass: 'bg-pink bg-opacity-25 text-pink border border-pink border-opacity-40',
    color: '#f472b6',
    description: 'Control prenatal MINSAL / Chile Crece Contigo, salud sexual y reproductiva, climaterio y patología ginecológica.',
    cie10Presets: [
      { code: 'Z34.8', desc: 'Supervisión de embarazo normal multigesta' },
      { code: 'Z34.0', desc: 'Supervisión de primer embarazo normal (Primigesta)' },
      { code: 'O24.4', desc: 'Diabetes mellitus gestacional en control' },
      { code: 'O13', desc: 'Hipertensión inducida por el embarazo (Gestacional)' },
      { code: 'O21.0', desc: 'Hiperémesis gravídica leve a moderada' },
      { code: 'N76.0', desc: 'Vaginitis aguda / Síndrome de flujo vaginal' },
      { code: 'N92.0', desc: 'Menstruación excesiva y frecuente con ciclo regular' },
      { code: 'Z30.0', desc: 'Consejo y asesoramiento general sobre anticoncepción' }
    ]
  },
  PEDIATRIA: {
    id: 'pediatria',
    name: 'Pediatría y Salud Infantil',
    icon: '👶',
    badgeClass: 'bg-success bg-opacity-25 text-success border border-success border-opacity-40',
    color: '#34d399',
    description: 'Control de Niño Sano, crecimiento y desarrollo psicomotor (DSM), PNI y patología prevalente infantil (Ley 21.430).',
    cie10Presets: [
      { code: 'Z00.1', desc: 'Control de salud de rutina del niño sano (MINSAL)' },
      { code: 'J20.9', desc: 'Bronquitis aguda / Síndrome Bronquial Obstructivo (SBOR)' },
      { code: 'A09', desc: 'Gastroenteritis y diarrea de presunto origen infeccioso' },
      { code: 'J02.9', desc: 'Faringoamigdalitis aguda no especificada' },
      { code: 'H66.9', desc: 'Otitis media aguda serosa / supurativa' },
      { code: 'L20.9', desc: 'Dermatitis atópica infantil' },
      { code: 'F90.0', desc: 'Trastorno por déficit atencional e hiperactividad (TDAH)' },
      { code: 'R62.8', desc: 'Retraso en el desarrollo psicomotor / Evaluación DSM' }
    ]
  },
  GERIATRIA: {
    id: 'geriatria',
    name: 'Geriatría y Valoración Integral (VGI)',
    icon: '👴',
    badgeClass: 'bg-warning bg-opacity-25 text-warning border border-warning border-opacity-40',
    color: '#fbbf24',
    description: 'Valoración Geriátrica Integral (VGI), polifarmacia, fragilidad, funcionalidad Barthel y prevención de caídas.',
    cie10Presets: [
      { code: 'I10', desc: 'Hipertensión arterial esencial en el adulto mayor' },
      { code: 'F03', desc: 'Demencia no especificada / Deterioro Cognitivo Leve' },
      { code: 'M19.9', desc: 'Artrosis osteoarticular / Gonartrosis severa' },
      { code: 'M81.9', desc: 'Osteoporosis sin fractura patológica' },
      { code: 'R26.8', desc: 'Síndrome de caídas y alteración de la marcha' },
      { code: 'R41.0', desc: 'Desorientación temporoespacial / Confusión aguda' },
      { code: 'N18.3', desc: 'Enfermedad renal crónica estadio 3' },
      { code: 'Z73.6', desc: 'Limitación de actividades por dependencia funcional' }
    ]
  },
  CARDIOLOGIA: {
    id: 'cardiologia',
    name: 'Cardiología y Crónicos Cardiovasculares',
    icon: '🫀',
    badgeClass: 'bg-danger bg-opacity-25 text-danger border border-danger border-opacity-40',
    color: '#ff4d6d',
    description: 'Diagnóstico telemétrico ECG, insuficiencia cardíaca, arritmias, cardiopatía coronaria e hipertensión arterial refractaria.',
    cie10Presets: [
      { code: 'I10', desc: 'Hipertensión arterial esencial refractaria' },
      { code: 'I48.9', desc: 'Fibrilación y flutter auricular paroxístico' },
      { code: 'I25.9', desc: 'Cardiopatía isquémica crónica estable' },
      { code: 'I50.9', desc: 'Insuficiencia cardíaca congestiva descompensada' },
      { code: 'I49.9', desc: 'Arritmia cardíaca no especificada / Extrasístoles' },
      { code: 'I47.1', desc: 'Taquicardia supraventricular paroxística' },
      { code: 'I49.5', desc: 'Síndrome del seno enfermo / Bradicardia sintomática' },
      { code: 'E78.0', desc: 'Hipercolesterolemia pura / Riesgo cardiovascular alto' }
    ]
  },
  SALUD_MENTAL: {
    id: 'salud_mental',
    name: 'Salud Mental y Psiquiatría',
    icon: '🧠',
    badgeClass: 'bg-purple bg-opacity-25 text-purple border border-purple border-opacity-40',
    color: '#c084fc',
    description: 'Evaluación psicosocial, trastornos del ánimo y ansiedad, adherencia psicofarmacológica y contención en crisis.',
    cie10Presets: [
      { code: 'F41.1', desc: 'Trastorno de ansiedad generalizada (TAG)' },
      { code: 'F32.1', desc: 'Episodio depresivo moderado sin síntomas psicóticos' },
      { code: 'F41.0', desc: 'Trastorno de pánico episódico recurrente' },
      { code: 'F43.2', desc: 'Trastornos de adaptación con ánimo depresivo/ansioso' },
      { code: 'F51.0', desc: 'Insomnio crónico no orgánico' },
      { code: 'F31.9', desc: 'Trastorno afectivo bipolar en fase eutímica/depresiva' },
      { code: 'F90.0', desc: 'Trastorno de la actividad y la atención del adulto' },
      { code: 'F10.1', desc: 'Consumo perjudicial de alcohol / Dependencia' }
    ]
  },
  ODONTOLOGIA: {
    id: 'odontologia',
    name: 'Odontología y Salud Bucal',
    icon: '🦷',
    badgeClass: 'bg-info bg-opacity-25 text-info border border-info border-opacity-40',
    color: '#06b6d4',
    description: 'Odontograma clínico, periodoncia, caries dentales, disfunción de ATM y derivaciones de urgencia GES.',
    cie10Presets: [
      { code: 'K02.1', desc: 'Caries de la dentina activa' },
      { code: 'K05.1', desc: 'Gingivitis crónica marginal generalizada' },
      { code: 'K05.3', desc: 'Periodontitis crónica moderada a severa' },
      { code: 'K04.0', desc: 'Pulpitis irreversible aguda' },
      { code: 'K04.7', desc: 'Absceso periapical sin fístula' },
      { code: 'K08.1', desc: 'Desdentamiento parcial / Edentulismo' },
      { code: 'K07.6', desc: 'Trastorno de la articulación temporomandibular (ATM)' },
      { code: 'Z01.2', desc: 'Control odontológico preventivo / Profilaxis destartraje' }
    ]
  },
  KINESIOLOGIA: {
    id: 'kinesiologia',
    name: 'Kinesiología y Rehabilitación Física',
    icon: '🏃',
    badgeClass: 'bg-emerald bg-opacity-25 text-emerald border border-emerald border-opacity-40',
    color: '#10b981',
    description: 'Evaluación funcional de rangos articulares (ROM), fuerza muscular Daniels, dolor EVA y prescripción kinesiológica.',
    cie10Presets: [
      { code: 'M54.5', desc: 'Lumbago crónico de origen mecánico' },
      { code: 'M75.1', desc: 'Tendinopatía / Síndrome del manguito rotador' },
      { code: 'M17.0', desc: 'Gonartrosis primaria bilateral con limitación funcional' },
      { code: 'S83.5', desc: 'Rehabilitación post rotura ligamento cruzado anterior' },
      { code: 'S93.4', desc: 'Esguince de tobillo grado II/III' },
      { code: 'G81.9', desc: 'Secuela motora de ataque cerebrovascular (ACV)' },
      { code: 'J98.8', desc: 'Rehabilitación y kinesioterapia respiratoria' },
      { code: 'Z51.8', desc: 'Sesiones de reeducación neuromuscular y entrenamiento funcional' }
    ]
  }
};

// ============================================================================
// 2. CATEGORIZACIÓN DE RIESGO CLÍNICO / TRIAGE HOSPITALARIO MINSAL
// ============================================================================

export const TRIAGE_CATEGORIES = [
  { code: 'C1', label: 'C1 - Riesgo Vital Inmediato (Reanimación / Paro)', badgeStyle: 'background: rgba(239, 68, 68, 0.35); color: #f87171; border: 1px solid #ef4444;' },
  { code: 'C2', label: 'C2 - Emergencia Evidente (Atención < 15 min)', badgeStyle: 'background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid #f87171;' },
  { code: 'C3', label: 'C3 - Urgencia Médica (Atención < 60 min)', badgeStyle: 'background: rgba(245, 158, 11, 0.25); color: #fbbf24; border: 1px solid #f59e0b;' },
  { code: 'C4', label: 'C4 - Consulta Prioritaria (Atención < 120 min)', badgeStyle: 'background: rgba(14, 165, 233, 0.2); color: #38bdf8; border: 1px solid #0284c7;' },
  { code: 'C5', label: 'C5 - Atención General / Control Programado', badgeStyle: 'background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid #10b981;' }
];

// ============================================================================
// 3. CÁLCULO ANTROPOMÉTRICO AUTOMÁTICO (IMC & CLASIFICACIÓN CLÍNICA OMS)
// ============================================================================

export function calculateIMC(weightKg, heightCm) {
  const w = parseFloat(weightKg);
  const h = parseFloat(heightCm) / 100;
  if (!w || !h || h <= 0) {
    return { imc: null, label: '--', classColor: 'text-white-50' };
  }
  const imc = parseFloat((w / (h * h)).toFixed(1));
  let label = 'Peso Normal';
  let classColor = 'text-success';

  if (imc < 18.5) {
    label = 'Bajo Peso';
    classColor = 'text-warning';
  } else if (imc >= 25 && imc < 30) {
    label = 'Sobrepeso';
    classColor = 'text-warning';
  } else if (imc >= 30 && imc < 35) {
    label = 'Obesidad Grado I';
    classColor = 'text-danger';
  } else if (imc >= 35 && imc < 40) {
    label = 'Obesidad Grado II';
    classColor = 'text-danger';
  } else if (imc >= 40) {
    label = 'Obesidad Mórbida (Grado III)';
    classColor = 'text-danger';
  }

  return { imc, label, classColor };
}

// ============================================================================
// 4. GENERADOR DE FORMULARIOS ESPECÍFICOS POR ESPECIALIDAD MÉDICA
// ============================================================================

/**
 * Retorna el HTML con los campos semiológicos dedicados según la especialidad
 * @param {string} specialtyId - ID de especialidad (ej. 'gineco_obstetricia')
 * @param {object} patient - Paciente activo
 * @returns {string} Fragmento HTML estructurado
 */
export function renderSpecialtyDynamicFields(specialtyId, patient = {}) {
  const specKey = specialtyId || 'medicina_general';

  // 1. GINECOLOGÍA Y OBSTETRICIA
  if (specKey === 'gineco_obstetricia') {
    const isPregnant = patient.isPregnant || false;
    const weeks = patient.pregnancyWeeks || 24;
    return `
      <div class="p-3.5 rounded-3 mb-3" style="background: rgba(244, 114, 182, 0.06); border: 1px solid rgba(244, 114, 182, 0.25);">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <span class="text-pink fw-bold small"><i class="bi bi-heart-pulse me-1"></i>Examen Físico Gineco-Obstétrico & Chile Crece Contigo</span>
          <span class="badge rounded-pill" style="background: rgba(244, 114, 182, 0.2); color: #f472b6;">EG: ${weeks} Semanas</span>
        </div>
        <div class="row g-2.5">
          <div class="col-6 col-md-3">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Altura Uterina (AU)</label>
            <div class="input-group input-group-sm">
              <input type="number" id="specField_au" class="form-control text-white bg-dark border-secondary" placeholder="22" value="22" step="0.5">
              <span class="input-group-text bg-secondary bg-opacity-25 text-white-50">cm</span>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Latidos Cardiofetales (LCF)</label>
            <div class="input-group input-group-sm">
              <input type="number" id="specField_lcf" class="form-control text-white bg-dark border-secondary" placeholder="142" value="142">
              <span class="input-group-text bg-secondary bg-opacity-25 text-white-50">lpm</span>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Presentación Fetal</label>
            <select id="specField_presentacion" class="form-select form-select-sm text-white bg-dark border-secondary">
              <option value="Cefálica" selected>Cefálica</option>
              <option value="Podálica">Podálica</option>
              <option value="Transversa">Transversa</option>
              <option value="No determinable">No determinable</option>
            </select>
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Movimientos Fetales</label>
            <select id="specField_movFetales" class="form-select form-select-sm text-white bg-dark border-secondary">
              <option value="Activos y presentes" selected>Activos y presentes (≥10/2h)</option>
              <option value="Disminuidos">Disminuidos</option>
              <option value="Ausentes">Ausentes</option>
            </select>
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Fórmula Obstétrica (G P A C)</label>
            <input type="text" id="specField_gpa" class="form-control form-control-sm text-white bg-dark border-secondary" placeholder="Ej: G1 P0 A0 C0" value="G1 P0 A0 C0">
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Examen Especuloscopía / Cuello Uterino</label>
            <input type="text" id="specField_especulo" class="form-control form-control-sm text-white bg-dark border-secondary" placeholder="Cuello posterior, cerrado, sin sangrado ni pérdida de LA">
          </div>
        </div>
      </div>
    `;
  }

  // 2. PEDIATRÍA
  if (specKey === 'pediatria') {
    return `
      <div class="p-3.5 rounded-3 mb-3" style="background: rgba(52, 211, 153, 0.06); border: 1px solid rgba(52, 211, 153, 0.25);">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <span class="text-success fw-bold small"><i class="bi bi-person-heart me-1"></i>Evaluación Pediátrica, Nutricional & Desarrollo Psicomotor (DSM)</span>
          <span class="badge rounded-pill bg-success bg-opacity-25 text-success">Control Niño Sano MINSAL</span>
        </div>
        <div class="row g-2.5">
          <div class="col-6 col-md-3">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Perímetro Craneano (PC)</label>
            <div class="input-group input-group-sm">
              <input type="number" id="specField_pc" class="form-control text-white bg-dark border-secondary" placeholder="51" value="51" step="0.5">
              <span class="input-group-text bg-secondary bg-opacity-25 text-white-50">cm</span>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Desarrollo Psicomotor (DSM)</label>
            <select id="specField_dsm" class="form-select form-select-sm text-white bg-dark border-secondary">
              <option value="Normal / Adecuado a la edad" selected>Normal / Adecuado a la edad</option>
              <option value="Rezago en lenguaje">Rezago en lenguaje</option>
              <option value="Rezago motor fino/grueso">Rezago motor fino/grueso</option>
              <option value="Riesgo / Déficit DSM">Riesgo / Déficit DSM</option>
            </select>
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Percentil P/T o IMC/E</label>
            <select id="specField_percentil" class="form-select form-select-sm text-white bg-dark border-secondary">
              <option value="p50 (Eutrófico)" selected>p50 (Eutrófico)</option>
              <option value="p10-p50 (Normal bajo)">p10-p50 (Normal bajo)</option>
              <option value="p75-p90 (Sobrepeso)">p75-p90 (Sobrepeso)</option>
              <option value=">p97 (Obesidad)">>p97 (Obesidad)</option>
              <option value="<p3 (Déficit ponderal)">&lt;p3 (Déficit ponderal)</option>
            </select>
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Vacunas PNI Escolar / Infantil</label>
            <select id="specField_vacunas" class="form-select form-select-sm text-white bg-dark border-secondary">
              <option value="Calendario al día verificado" selected>Calendario al día verificado</option>
              <option value="Vacunación pendiente">Vacunación pendiente</option>
              <option value="Campaña escolar completada">Campaña escolar completada</option>
            </select>
          </div>
          <div class="col-12">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Alimentación y Hábitos</label>
            <input type="text" id="specField_alim" class="form-control form-control-sm text-white bg-dark border-secondary" placeholder="Alimentación completa familiar, adecuada ingesta de líquidos, buen apetito.">
          </div>
        </div>
      </div>
    `;
  }

  // 3. GERIATRÍA
  if (specKey === 'geriatria') {
    return `
      <div class="p-3.5 rounded-3 mb-3" style="background: rgba(251, 191, 36, 0.06); border: 1px solid rgba(251, 191, 36, 0.25);">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <span class="text-warning fw-bold small"><i class="bi bi-clipboard2-check me-1"></i>Valoración Geriátrica Integral (VGI) & Barthel</span>
          <span class="badge rounded-pill bg-warning bg-opacity-25 text-warning">Ley 20.584 / DS N° 41</span>
        </div>
        <div class="row g-2.5">
          <div class="col-6 col-md-3">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Índice de Barthel (Funcional)</label>
            <div class="input-group input-group-sm">
              <input type="number" id="specField_barthel" class="form-control text-white bg-dark border-secondary" placeholder="95" value="95" min="0" max="100">
              <span class="input-group-text bg-secondary bg-opacity-25 text-white-50">/100 pts</span>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Función Cognitiva (Pfeiffer/MMSE)</label>
            <select id="specField_cognitiva" class="form-select form-select-sm text-white bg-dark border-secondary">
              <option value="Normal / Sin deterioro" selected>Normal / Sin deterioro (0-2 errores)</option>
              <option value="Deterioro cognitivo leve">Deterioro cognitivo leve (3-4 errores)</option>
              <option value="Deterioro cognitivo moderado">Deterioro cognitivo moderado</option>
              <option value="Deterioro severo / Demencia">Deterioro severo / Demencia</option>
            </select>
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Riesgo de Caídas (Downton)</label>
            <select id="specField_caidas" class="form-select form-select-sm text-white bg-dark border-secondary">
              <option value="Bajo riesgo (&lt;2 pts)" selected>Bajo riesgo (&lt;2 pts)</option>
              <option value="Alto riesgo (≥2 pts)">Alto riesgo (≥2 pts)</option>
              <option value="Antecedente de caída reciente">Antecedente de caída reciente</option>
            </select>
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Criterio Polifarmacia</label>
            <select id="specField_polifarmacia" class="form-select form-select-sm text-white bg-dark border-secondary">
              <option value="Presente (≥5 fármacos activos)" selected>Presente (≥5 fármacos activos)</option>
              <option value="No presente (&lt;5 fármacos)">No presente (&lt;5 fármacos)</option>
            </select>
          </div>
        </div>
      </div>
    `;
  }

  // 4. CARDIOLOGÍA / CRÓNICOS
  if (specKey === 'cardiologia') {
    return `
      <div class="p-3.5 rounded-3 mb-3" style="background: rgba(255, 77, 109, 0.06); border: 1px solid rgba(255, 77, 109, 0.25);">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <span class="text-danger fw-bold small"><i class="bi bi-heart-pulse-fill me-1"></i>Evaluación Semiología Cardiovascular & Telemetría IoT</span>
          <span class="badge rounded-pill bg-danger bg-opacity-25 text-danger">Lead II • 250 Hz</span>
        </div>
        <div class="row g-2.5">
          <div class="col-6 col-md-3">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Auscultación Cardíaca</label>
            <select id="specField_auscultacion" class="form-select form-select-sm text-white bg-dark border-secondary">
              <option value="R1 y R2 normofonéticos, sin soplos" selected>R1 y R2 normofonéticos, sin soplos</option>
              <option value="Soplo sistólico eyectivo I-II/VI">Soplo sistólico eyectivo I-II/VI</option>
              <option value="R1 desdoblado">R1 desdoblado</option>
              <option value="Presencia de R3 / Galope">Presencia de R3 / Galope</option>
            </select>
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Pulsos Periféricos & Llenado</label>
            <select id="specField_pulsos" class="form-select form-select-sm text-white bg-dark border-secondary">
              <option value="Presentes, simétricos, llenado capilar &lt;2s" selected>Presentes, simétricos, llenado &lt;2s</option>
              <option value="Disminuidos en MMII">Disminuidos en MMII</option>
              <option value="Ausencia de pulsos distales">Ausencia de pulsos distales</option>
            </select>
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Edema Extremidades (Godet)</label>
            <select id="specField_edema" class="form-select form-select-sm text-white bg-dark border-secondary">
              <option value="Sin edema (Godet -)" selected>Sin edema (Godet -)</option>
              <option value="Edema maleolar leve (Godet +)">Edema maleolar leve (Godet +)</option>
              <option value="Edema moderado (Godet ++)">Edema moderado (Godet ++)</option>
              <option value="Edema severo con fóvea (Godet +++)">Edema severo con fóvea (Godet +++)</option>
            </select>
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Riesgo Cardiovascular (RCV)</label>
            <select id="specField_rcv" class="form-select form-select-sm text-white bg-dark border-secondary">
              <option value="Bajo (&lt;5%)">Bajo (&lt;5%)</option>
              <option value="Moderado (5-9%)">Moderado (5-9%)</option>
              <option value="Alto (≥10%)" selected>Alto (≥10% por HTA/DM)</option>
              <option value="Muy Alto (Evento previo)">Muy Alto (Evento previo)</option>
            </select>
          </div>
        </div>
      </div>
    `;
  }

  // 5. SALUD MENTAL
  if (specKey === 'salud_mental') {
    return `
      <div class="p-3.5 rounded-3 mb-3" style="background: rgba(192, 132, 252, 0.06); border: 1px solid rgba(192, 132, 252, 0.25);">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <span class="text-purple fw-bold small"><i class="bi bi-headset me-1"></i>Examen Mental Semiología Psiquiátrica & GAD/PHQ</span>
          <span class="badge rounded-pill bg-purple bg-opacity-25 text-purple">Confidencial Ley 20.584</span>
        </div>
        <div class="row g-2.5">
          <div class="col-6 col-md-3">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Orientación Temporoespacial</label>
            <select id="specField_orientacion" class="form-select form-select-sm text-white bg-dark border-secondary">
              <option value="Orientado lúcido en tiempo, espacio y persona" selected>Orientado lúcido (T, E, P)</option>
              <option value="Desorientación temporal parcial">Desorientación temporal parcial</option>
              <option value="Desorientación global">Desorientación global</option>
            </select>
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Ánimo / Afecto</label>
            <select id="specField_animo" class="form-select form-select-sm text-white bg-dark border-secondary">
              <option value="Eutímico, afecto concordante" selected>Eutímico, afecto concordante</option>
              <option value="Ánimo hipotímico / angustioso">Ánimo hipotímico / angustioso</option>
              <option value="Hipertímico / Labil">Hipertímico / Labil</option>
              <option value="Aplanamiento afectivo">Aplanamiento afectivo</option>
            </select>
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Riesgo Suicida / Autolesión</label>
            <select id="specField_suicida" class="form-select form-select-sm text-white bg-dark border-secondary">
              <option value="Descartado / Sin ideación ni plan" selected>Descartado / Sin ideación</option>
              <option value="Ideación pasiva de muerte sin plan">Ideación pasiva sin plan</option>
              <option value="Riesgo activo (Activar protocolo)">Riesgo activo (Activar protocolo)</option>
            </select>
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Patrón de Sueño / Insomnio</label>
            <select id="specField_sueno" class="form-select form-select-sm text-white bg-dark border-secondary">
              <option value="Sueño reparador (6-8 hrs)" selected>Sueño reparador (6-8 hrs)</option>
              <option value="Insomnio de conciliación">Insomnio de conciliación</option>
              <option value="Insomnio de mantención">Insomnio de mantención</option>
              <option value="Despertar precoz">Despertar precoz</option>
            </select>
          </div>
        </div>
      </div>
    `;
  }

  // 6. ODONTOLOGÍA
  if (specKey === 'odontologia') {
    return `
      <div class="p-3.5 rounded-3 mb-3" style="background: rgba(6, 182, 212, 0.06); border: 1px solid rgba(6, 182, 212, 0.25);">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <span class="text-info fw-bold small"><i class="bi bi-shield-shaded me-1"></i>Odontograma Clínico & Examen Estomatológico</span>
          <span class="badge rounded-pill bg-info bg-opacity-25 text-info">GES Salud Oral</span>
        </div>
        <div class="row g-2.5">
          <div class="col-6 col-md-4">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Índice Periodontal / Encías</label>
            <select id="specField_encias" class="form-select form-select-sm text-white bg-dark border-secondary">
              <option value="Encías sanas, rosadas, sin sangrado al sondaje" selected>Encías sanas, sin sangrado</option>
              <option value="Gingivitis marginal leve">Gingivitis marginal leve</option>
              <option value="Periodontitis con bolsas activas">Periodontitis con bolsas activas</option>
            </select>
          </div>
          <div class="col-6 col-md-4">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Articulación Temporomandibular (ATM)</label>
            <select id="specField_atm" class="form-select form-select-sm text-white bg-dark border-secondary">
              <option value="Apertura normal simétrica, sin chasquidos" selected>Normal simétrica, sin ruido</option>
              <option value="Chasquido uni/bilateral no doloroso">Chasquido uni/bilateral</option>
              <option value="Bruxismo severo / dolor muscular">Bruxismo / Dolor muscular</option>
            </select>
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Piezas Dentales Afectadas</label>
            <input type="text" id="specField_piezas" class="form-control form-control-sm text-white bg-dark border-secondary" placeholder="Ej: Pieza 1.6 obturada, 2.4 caries oclusal">
          </div>
        </div>
      </div>
    `;
  }

  // 7. KINESIOLOGÍA / REHABILITACIÓN
  if (specKey === 'kinesiologia') {
    return `
      <div class="p-3.5 rounded-3 mb-3" style="background: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.25);">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <span class="text-emerald fw-bold small"><i class="bi bi-lightning-charge me-1"></i>Evaluación Kinesiológica: Dolor EVA, Rangos Articulares (ROM) & Daniels</span>
          <span class="badge rounded-pill bg-success bg-opacity-25 text-success">Rehabilitación Funcional</span>
        </div>
        <div class="row g-2.5">
          <div class="col-6 col-md-3">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Dolor EVA (0 a 10)</label>
            <div class="input-group input-group-sm">
              <input type="number" id="specField_eva" class="form-control text-white bg-dark border-secondary" placeholder="4" value="4" min="0" max="10">
              <span class="input-group-text bg-secondary bg-opacity-25 text-white-50">/10</span>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Rango Articular (ROM)</label>
            <select id="specField_rom" class="form-select form-select-sm text-white bg-dark border-secondary">
              <option value="Completo e indoloro" selected>Completo e indoloro</option>
              <option value="Limitado por dolor al final del arco">Limitado por dolor al final</option>
              <option value="Limitación moderada a severa">Limitación moderada a severa</option>
            </select>
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Fuerza Muscular (Daniels 0-5)</label>
            <select id="specField_daniels" class="form-select form-select-sm text-white bg-dark border-secondary">
              <option value="M5 (Fuerza normal contra resistencia)" selected>M5 (Normal contra resistencia)</option>
              <option value="M4 (Vence resistencia moderada)">M4 (Resistencia moderada)</option>
              <option value="M3 (Vence gravedad sin resistencia)">M3 (Solo gravedad)</option>
              <option value="M2 (Movimiento eliminando gravedad)">M2 (Eliminando gravedad)</option>
            </select>
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Marcha y Balance Dinámico</label>
            <select id="specField_marcha" class="form-select form-select-sm text-white bg-dark border-secondary">
              <option value="Marcha independiente, braceo conservado" selected>Independiente conservada</option>
              <option value="Marcha claudicante / antiálgica">Claudicante / Antiálgica</option>
              <option value="Requiere ayuda técnica (Bastón/Andador)">Requiere ayuda técnica</option>
            </select>
          </div>
        </div>
      </div>
    `;
  }

  // 8. MEDICINA GENERAL POR DEFECTO
  return `
    <div class="p-3.5 rounded-3 mb-3" style="background: rgba(56, 189, 248, 0.05); border: 1px solid rgba(56, 189, 248, 0.2);">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <span class="text-info fw-bold small"><i class="bi bi-file-earmark-medical me-1"></i>Examen Físico Segmentario Estándar</span>
        <span class="badge rounded-pill bg-primary bg-opacity-25 text-info">Medicina General</span>
      </div>
      <div class="row g-2.5">
        <div class="col-12 col-md-4">
          <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Cabeza, Cuello & Faringe</label>
          <input type="text" id="specField_cabeza" class="form-control form-control-sm text-white bg-dark border-secondary" placeholder="Normocráneo, mucosas hidratadas, faringe sin exudado" value="Normocráneo, mucosas hidratadas, faringe rosada sin exudado">
        </div>
        <div class="col-12 col-md-4">
          <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Tórax & Aparato Respiratorio</label>
          <input type="text" id="specField_torax" class="form-control form-control-sm text-white bg-dark border-secondary" placeholder="Murmullo pulmonar presente bilateral, sin ruidos agregados" value="Murmullo pulmonar presente bilateral, sin ruidos agregados">
        </div>
        <div class="col-12 col-md-4">
          <label class="form-label text-white-50 small mb-0.5" style="font-size: 0.72rem;">Abdomen & Extremidades</label>
          <input type="text" id="specField_abdomen" class="form-control form-control-sm text-white bg-dark border-secondary" placeholder="Blando, depresible, indoloro, sin masas ni visceromegalias" value="Blando, depresible, indoloro, sin edema en extremidades">
        </div>
      </div>
    </div>
  `;
}
