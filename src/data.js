/**
 * @fileoverview Catálogo Clínico Extensible y Bases de Datos Demográficas - cuidApp
 * @module src/data.js
 * @description Catálogo de condiciones médicas, patologías crónicas GES, neurodivergencias (Ley TEA N° 21.545),
 * protocolos de emergencia específicos y perfiles clínicos precargados para demostración.
 *
 * @compliance
 * - Ley N° 21.545: Ley TEA (Atención preferente e inclusión de neurodivergencias)
 * - Régimen de Garantías Explícitas en Salud (GES / AUGE)
 * - Ley N° 20.584: Protocolos de manejo respetuoso y no discriminación
 */

export {
  PATIENTS_DATABASE,
  CAREGIVERS_DATABASE,
  Patient,
  Caregiver,
  Condition,
  CONDITIONS_CATALOG
} from './main.js';

// ============================================================================
// CATÁLOGO CLÍNICO EXTENSIBLE (CLINICAL_CONDITIONS_CATALOG)
// Marco Normativo: Ley N° 21.430, Ley N° 21.545 (Ley TEA), Ley N° 20.584, GES MINSAL
// ============================================================================

export const CLINICAL_CONDITIONS_CATALOG = [
  // --- CATEGORÍA 1: NEURODIVERGENCIAS ---
  {
    id: 'TEA',
    category: 'Neurodivergencias',
    name: 'Condición del Espectro Autista (TEA Grado 2)',
    shortName: 'TEA Grado 2',
    code: 'F84.0',
    icon: '🧩',
    badgeColor: '#ec4899', // Fucsia GlassKit
    borderColor: '#db2777',
    lawReference: 'Ley N° 21.545 (Ley TEA) & Ley N° 21.430',
    description: 'Condición del neurodesarrollo caracterizada por diferencias en la comunicación social recíproca, patrones sensoriales y rutinas estructuradas.',
    emergencyProtocol: '1. Mantener calma y hablar con voz suave y frases cortas. 2. Reducir estímulos sensoriales (luces intensas, ruidos fuertes, aglomeración). 3. No sujetar bruscamente; permitir acompañamiento permanente del tutor legal acreditado (Camila Paz Vergara Fuentes). 4. Utilizar apoyos visuales o anticipación paso a paso antes de procedimientos médicos.',
    keywords: ['tea', 'autismo', 'espectro autista', 'asperger', 'neurodivergencia', 'f84']
  },
  {
    id: 'TDAH',
    category: 'Neurodivergencias',
    name: 'Trastorno por Déficit de Atención e Hiperactividad (TDAH)',
    shortName: 'TDAH',
    code: 'F90.0',
    icon: '⚡',
    badgeColor: '#06b6d4', // Turquesa GlassKit
    borderColor: '#0284c7',
    lawReference: 'Ley N° 20.422 (Inclusión) & Decreto 170 MINEDUC',
    description: 'Patrón persistente de desatención, hiperactividad o impulsividad que interfiere en el funcionamiento adaptativo y escolar.',
    emergencyProtocol: '1. Proporcionar instrucciones claras y de un solo paso. 2. Validar estado emocional sin juzgar la inquietud motriz. 3. Facilitar pausas y ambiente estructurado. 4. Mantener supervisión cercana durante procedimientos clínicos.',
    keywords: ['tdah', 'deficit atencional', 'hiperactividad', 'f90']
  },
  {
    id: 'TEL',
    category: 'Neurodivergencias',
    name: 'Trastorno Específico del Lenguaje / TDL',
    shortName: 'TEL Mixto / Expresivo',
    code: 'F80.1',
    icon: '🗣️',
    badgeColor: '#a855f7', // Púrpura
    borderColor: '#9333ea',
    lawReference: 'Decreto 170 PIE MINEDUC & Ley N° 21.430',
    description: 'Dificultades persistentes en la adquisición y uso del lenguaje en todas sus modalidades (oral, expresivo y comprensivo).',
    emergencyProtocol: '1. Hablar con lenguaje simple, pausado y sin ambigüedades. 2. Usar soporte de gestos, pictogramas o señas naturales. 3. Otorgar tiempo suficiente para que el paciente procese y responda.',
    keywords: ['tel', 'trastorno del lenguaje', 'tdl', 'fonoaudiologia', 'f80']
  },

  // --- CATEGORÍA 2: ENFERMEDADES CRÓNICAS ---
  {
    id: 'ASMA',
    category: 'Crónicas',
    name: 'Asma Bronquial Moderada / Severa',
    shortName: 'Asma Bronquial',
    code: 'J45.0',
    icon: '🫁',
    badgeColor: '#38bdf8', // Celeste
    borderColor: '#0284c7',
    lawReference: 'Garantía Explícita en Salud (GES Asma Infantil)',
    description: 'Enfermedad inflamatoria crónica de las vías respiratorias caracterizada por sibilancias, disnea y tos recurrente.',
    emergencyProtocol: '1. Sentar al paciente en posición semisentada erguida. 2. Administrar broncodilatador de rescate: Salbutamol 100 mcg (2 a 4 puff con aerocámara, separando cada inhalación por 30-60 seg). 3. Monitorear saturación SpO2 (objetivo >= 94%). 4. Si presenta retracción costal, aleteo nasal o cianosis, llamar a SAMU 131 de inmediato.',
    keywords: ['asma', 'bronquial', 'salbutamol', 'inhalador', 'j45', 'sibilancias']
  },
  {
    id: 'DIABETES_T1',
    category: 'Crónicas',
    name: 'Diabetes Mellitus Tipo 1 (Insulinodependiente)',
    shortName: 'Diabetes Tipo 1',
    code: 'E10.9',
    icon: '🩸',
    badgeColor: '#ef4444', // Rojo coral GlassKit
    borderColor: '#b91c1c',
    lawReference: 'GES Diabetes Tipo 1 & Ley Ricarte Soto (Bombas de Insulina)',
    description: 'Condición autoinmune con destrucción de células beta pancreáticas y déficit absoluto de insulina.',
    emergencyProtocol: '1. Ante sospecha de Hipoglucemia (< 70 mg/dL): si está consciente, administrar 15g de hidratos de carbono rápidos (1/2 vaso de jugo azucarado o 3 sobres de azúcar); esperar 15 min y remedir. 2. Si pierde la conciencia: NO dar nada por boca, colocar en posición lateral de seguridad y administrar Glucagón subcutáneo/intramuscular si está prescrito. Llamar SAMU 131.',
    keywords: ['diabetes', 'dm1', 'insulina', 'glucemia', 'glucosa', 'hipoglucemia', 'e10']
  },
  {
    id: 'EPILEPSIA',
    category: 'Crónicas',
    name: 'Epilepsia Infantil / Síndrome Convulsivo',
    shortName: 'Epilepsia Infantil',
    code: 'G40.9',
    icon: '⚡',
    badgeColor: '#eab308', // Amarillo
    borderColor: '#ca8a04',
    lawReference: 'GES Epilepsia no refractaria en menores de 15 años',
    description: 'Trastorno cerebral crónico caracterizado por una predisposición continuada a la generación de crisis epilépticas.',
    emergencyProtocol: '1. Mantener la calma y retirar objetos peligrosos del entorno. 2. Proteger la cabeza con algo blando. 3. NO introducir dedos ni objetos en la boca. 4. Colocar de lado (Posición Lateral de Seguridad - PLS). 5. Cronometrar la crisis. 6. Si dura más de 3 minutos, administrar Midazolam bucal o Diazepam rectal según receta médica. 7. Llamar SAMU 131.',
    keywords: ['epilepsia', 'convulsion', 'crisis convulsiva', 'midazolam', 'g40']
  },
  {
    id: 'CARDIOPATIA',
    category: 'Crónicas',
    name: 'Cardiopatía Congénita / Arritmia Pediátrica',
    shortName: 'Cardiopatía Congénita',
    code: 'Q24.9',
    icon: '❤️',
    badgeColor: '#f43f5e', // Rosa fuerte
    borderColor: '#e11d48',
    lawReference: 'GES Cardiopatías Congénitas Operables en menores de 15 años',
    description: 'Alteración estructural o funcional del corazón presente desde el nacimiento con riesgo de descompensación hemodinámica.',
    emergencyProtocol: '1. Reposo absoluto en posición semisentada o fowler. 2. Administrar oxígeno suplementario si está disponible. 3. Controlar frecuencia cardíaca y perfusión periférica. 4. Si presenta síncope, dolor torácico o cianosis peribucal, derivación inmediata en ambulancia SAMU 131.',
    keywords: ['cardiopatia', 'arritmia', 'corazon', 'congenita', 'q24']
  },

  // --- CATEGORÍA 3: GENÉTICAS ---
  {
    id: 'DOWN',
    category: 'Genéticas',
    name: 'Síndrome de Down (Trisomía 21)',
    shortName: 'Síndrome de Down',
    code: 'Q90.9',
    icon: '🧬',
    badgeColor: '#8b5cf6', // Violeta
    borderColor: '#7c3aed',
    lawReference: 'Ley N° 20.422 (Igualdad de Oportunidades e Inclusión Social)',
    description: 'Condición genética causada por una copia extra total o parcial del cromosoma 21, con características médicas asociadas.',
    emergencyProtocol: '1. Trato digno, paciente y empático adaptado a su edad y capacidad comprensiva. 2. Precaución con manipulación cervical por posible inestabilidad atlantoaxoidea. 3. Monitorear función respiratoria y cardíaca ante cualquier infección.',
    keywords: ['down', 'sindrome de down', 'trisomia 21', 'q90']
  },

  // --- CATEGORÍA 4: ALERGIAS SEVERAS / ANAFILAXIA ---
  {
    id: 'ANAFILAXIA',
    category: 'Alergias Severas / Anafilaxia',
    name: 'Alergia Severa con Riesgo de Anafilaxia (Alimentos/Medicamentos)',
    shortName: 'Riesgo de Anafilaxia',
    code: 'T78.2',
    icon: '⚠️',
    badgeColor: '#dc2626', // Rojo intenso
    borderColor: '#991b1b',
    lawReference: 'Ley N° 20.584 y Protocolo MINSAL Manejo Anafilaxia',
    description: 'Reacción alérgica multisistémica grave, potencialmente mortal, de instauración rápida tras exposición a alérgeno.',
    emergencyProtocol: '1. ¡EMERGENCIA VITAL! Administrar de inmediato Adrenalina / Epinefrina intramuscular con auto-inyector (EpiPen Jr 0.15 mg en cara anterolateral del muslo). 2. Acostar al paciente con las piernas elevadas. 3. Si hay vómitos o dificultad respiratoria, permitir posición semisentada. 4. LLAMAR INMEDIATAMENTE AL SAMU 131 indicando "Shock Anafiláctico Infantil". 5. Si no responde en 5-10 min, repetir dosis de adrenalina.',
    keywords: ['anafilaxia', 'epipen', 'adrenalina', 'alergia severa', 'mani', 'mariscos', 't78']
  },
  {
    id: 'APLV',
    category: 'Alergias Severas / Anafilaxia',
    name: 'Alergia a la Proteína de Leche de Vaca (APLV)',
    shortName: 'APLV',
    code: 'K52.2',
    icon: '🥛',
    badgeColor: '#f97316', // Naranja
    borderColor: '#ea580c',
    lawReference: 'Programa Nacional de Alimentación Complementaria (PNAC Alergia Alimentaria)',
    description: 'Reacción adversa inmunológica a una o más proteínas de la leche de vaca (caseína o suero).',
    emergencyProtocol: '1. Exclusión estricta e inmediata de alimentos contaminados con lácteos. 2. Administrar antihistamínico prescrito ante urticaria leve. 3. Si presenta compromiso respiratorio (estridor, disnea) o colapso, aplicar protocolo de anafilaxia con Adrenalina intramuscular y trasladar a urgencias.',
    keywords: ['aplv', 'leche', 'alergia alimentaria', 'caseina', 'k52']
  }
];

// ============================================================================
// FUNCIONES AUXILIARES: CONDICIONES PERSONALIZADAS Y BÚSQUEDA EN CATÁLOGO
// ============================================================================

/**
 * Obtiene el catálogo completo de condiciones clínicas (base + personalizadas de localStorage)
 */
export function getClinicalConditionsCatalog() {
  let custom = [];
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('cuidapp_custom_conditions') : null;
    if (raw) {
      custom = JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error al leer cuidapp_custom_conditions:', e);
  }
  return [...CLINICAL_CONDITIONS_CATALOG, ...(Array.isArray(custom) ? custom : [])];
}

/**
 * Guarda una nueva condición clínica personalizada en localStorage (cuidapp_custom_conditions)
 */
export function saveCustomClinicalCondition(condition) {
  if (!condition || !condition.name) return null;
  const id = condition.id || `CUSTOM_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newCondition = {
    id: id,
    category: condition.category || 'Condiciones Personalizadas',
    name: condition.name,
    shortName: condition.shortName || condition.name,
    code: condition.code || 'R69',
    icon: condition.icon || '🩺',
    badgeColor: condition.badgeColor || '#06b6d4',
    borderColor: condition.borderColor || '#0284c7',
    lawReference: condition.lawReference || 'Ley N° 21.430 & Ley N° 20.584',
    description: condition.description || 'Condición clínica acreditada registrada por el tutor o profesional médico.',
    emergencyProtocol: condition.emergencyProtocol || '1. Mantener reposo. 2. Contactar a tutor legal y médico de cabecera. 3. En caso de riesgo vital, llamar al 131.',
    keywords: Array.isArray(condition.keywords) ? condition.keywords : [condition.name.toLowerCase()],
    isCustom: true,
    createdAt: new Date().toISOString()
  };

  try {
    let customList = [];
    const raw = localStorage.getItem('cuidapp_custom_conditions');
    if (raw) customList = JSON.parse(raw);
    customList.push(newCondition);
    localStorage.setItem('cuidapp_custom_conditions', JSON.stringify(customList));
  } catch (e) {
    console.error('Error al guardar en cuidapp_custom_conditions:', e);
  }

  return newCondition;
}

/**
 * Busca una condición clínica en el catálogo por ID, código CIE, nombre o palabras clave
 */
export function findConditionInCatalog(termOrId) {
  if (!termOrId) return null;
  const cleanTerm = String(termOrId).trim().toLowerCase();
  const allConditions = getClinicalConditionsCatalog();

  // 1. Coincidencia exacta por ID o código
  const exact = allConditions.find(c => 
    c.id.toLowerCase() === cleanTerm || 
    (c.code && c.code.toLowerCase() === cleanTerm)
  );
  if (exact) return exact;

  // 2. Coincidencia exacta por nombre o nombre corto
  const byName = allConditions.find(c => 
    c.name.toLowerCase() === cleanTerm || 
    c.shortName.toLowerCase() === cleanTerm
  );
  if (byName) return byName;

  // 3. Coincidencia parcial por keywords o texto
  const byKeyword = allConditions.find(c => 
    (c.keywords && c.keywords.some(k => cleanTerm.includes(k) || k.includes(cleanTerm))) ||
    c.name.toLowerCase().includes(cleanTerm) ||
    cleanTerm.includes(c.name.toLowerCase())
  );
  if (byKeyword) return byKeyword;

  return null;
}
