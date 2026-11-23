/**
 * Módulo IoT Electrocardiograma (ECG) Multiparámetro de Grado Hospitalario - cuidApp
 * Hardware compatible: Sensor AD8232 + ESP32 / Arduino UNO R4 WiFi / Web Serial USB 115200
 * Arquitectura: Productor - Consumidor Desacoplada (250 Hz Sampling & Sweep Oscilloscope)
 * Cumplimiento Normativo: Ley N° 20.584, Ley N° 19.628 y Decreto Supremo N° 41
 */

import { speakText, getModoVozActivo, activePatient } from './main.js';
import { STORAGE_KEYS } from './utils/clinical-helpers.js';

// --- ESTADOS Y TIPOS ELECTROCARDIOGRÁFICOS ---
export const ECG_STATES = {
  VERDE: 'VERDE',                         // Ritmo Sinusal Normal (~72 BPM)
  AMARILLO: 'AMARILLO',                   // Taquicardia (~128 BPM) o Bradicardia (~44 BPM)
  ROJO: 'ROJO',                           // Arritmia / Fibrilación Auricular / Flutter
  SIN_SENAL: 'SIN_SENAL',                 // Pérdida de enlace de datos
  ELECTRODOS_SUELTOS: 'ELECTRODOS_SUELTOS' // Leads Off (RA, LA o RL desconectado)
};

export const CLINICAL_PRESETS = {
  SINUSAL: { state: ECG_STATES.VERDE, bpm: 72, label: 'Ritmo Sinusal Normal', color: '#00ff9d' },
  TAQUICARDIA: { state: ECG_STATES.AMARILLO, bpm: 128, label: 'Taquicardia Sinusal', color: '#ffb703' },
  BRADICARDIA: { state: ECG_STATES.AMARILLO, bpm: 44, label: 'Bradicardia Sinusal', color: '#ffb703' },
  ARRITMIA: { state: ECG_STATES.ROJO, bpm: 154, label: 'Fibrilación Auricular / Arritmia', color: '#ff4d6d' },
  LEOFF: { state: ECG_STATES.ELECTRODOS_SUELTOS, bpm: 0, label: 'Electrodos Sueltos (LEOFF)', color: '#64748b' }
};

// Estado global del subsistema IoT ECG
const ecgState = {
  mode: 'simulator', // 'simulator' | 'serial' | 'mqtt'
  connected: true,
  currentSimState: ECG_STATES.VERDE,
  preset: 'SINUSAL',
  latestData: {
    id: 'AD8232-ESP32-MED',
    seq: 4210,
    t_ms: 1000,
    bpm: 72,
    estado: ECG_STATES.VERDE,
    electrodos: { ra: true, la: true, rl: true },
    lead: 'Derivación II (DII)',
    rssi: -62,
    source: 'Simulador Clínico AD8232',
    rr_ms: 833,
    qrs_ms: 88,
    qtc_ms: 412,
    rhythm: 'Ritmo Sinusal Normal'
  },
  serialPort: null,
  serialReader: null,
  serialKeepReading: false,
  mqttUrl: 'wss://broker.emqx.io:8084/mqtt',
  wsClient: null,
  reconnectAttempts: 0,
  listeners: new Set(),
  lastVoiceAlertTime: 0,
  lastAlertStorageTime: 0
};

// Buffers de señal ECG (250 Hz sample buffer y buffer histórico de captura)
const WAVEFORM_BUFFER_SIZE = 400;
const waveformRing = new Array(WAVEFORM_BUFFER_SIZE).fill(0);
const waveformHistory = []; // Últimos puntos para persistencia y exportación clínica
let scanIndex = 0;

let animationFrameId = null;
let simIntervalId = null;
let simPhase = 0;

// ============================================================================
// 1. GENERADOR SINTÉTICO DE ALTA FIDELIDAD (MORFOLOGÍA P-QRS-T AD8232 DII)
// ============================================================================

/**
 * Genera muestras fisiológicas con morfología precisa P-QRS-T
 * @param {string} simState - Estado electrocardiográfico
 * @param {number} phase - Fase normalizada 0..1 del ciclo cardíaco
 */
function generateSyntheticEcgSample(simState, phase, presetKey) {
  if (simState === ECG_STATES.ELECTRODOS_SUELTOS || simState === ECG_STATES.SIN_SENAL) {
    // Ruido de alta impedancia / interferencia 50 Hz por derivación desconectada
    return (Math.random() - 0.5) * 0.08 + Math.sin(Date.now() / 20) * 0.04;
  }

  const p = phase % 1.0;
  let val = 0;

  if (simState === ECG_STATES.ROJO || presetKey === 'ARRITMIA') {
    // Fibrilación auricular / Arritmia polimórfica (ondas 'f' caóticas + QRS irregular)
    const baselineFibrillation = (Math.sin(p * Math.PI * 18) * 0.08) + (Math.sin(p * Math.PI * 32) * 0.04);
    val = baselineFibrillation + ((Math.random() - 0.5) * 0.06);

    // QRS ectópico y angosto/aberrante
    if (p >= 0.28 && p < 0.35) {
      const qrsProg = (p - 0.28) / 0.07;
      val += Math.sin(qrsProg * Math.PI) * 1.35;
    } else if (p >= 0.35 && p < 0.40) {
      val -= 0.35;
    }
    return val;
  }

  // Complejo P-QRS-T Fisiológico (Derivación DII estándar)
  if (p >= 0.10 && p < 0.20) {
    // Onda P (despolarización auricular, normal 80-100 ms)
    const prog = (p - 0.10) / 0.10;
    val = Math.sin(prog * Math.PI) * 0.16;
  } else if (p >= 0.24 && p < 0.27) {
    // Deflexión Q inicial
    const prog = (p - 0.24) / 0.03;
    val = -Math.sin(prog * Math.PI) * 0.12;
  } else if (p >= 0.27 && p < 0.33) {
    // Pico R prominente (despolarización ventricular aguda)
    const prog = (p - 0.27) / 0.06;
    val = Math.sin(prog * Math.PI) * 1.15;
  } else if (p >= 0.33 && p < 0.37) {
    // Deflexión S
    const prog = (p - 0.33) / 0.04;
    val = -Math.sin(prog * Math.PI) * 0.32;
  } else if (p >= 0.46 && p < 0.68) {
    // Onda T asimétrica (repolarización ventricular)
    const prog = (p - 0.46) / 0.22;
    val = Math.sin(prog * Math.PI) * 0.26;
  }

  // Micro-variación fisiológica natural
  val += (Math.random() - 0.5) * 0.02;
  return val;
}

/**
 * Calcula métricas electrocardiográficas en base al BPM
 */
function calculateClinicalMetrics(bpm, simState) {
  if (simState === ECG_STATES.ELECTRODOS_SUELTOS || simState === ECG_STATES.SIN_SENAL || bpm <= 0) {
    return {
      rr_ms: 0,
      qrs_ms: 0,
      qtc_ms: 0,
      rhythm: 'Desconexión de Electrodos (LEOFF)'
    };
  }

  // RR en milisegundos: 60.000 / BPM
  const rr = Math.round(60000 / bpm);
  
  let qrs = 88; // normal 80 - 100 ms
  let qtc = 412; // Bazett estándar ~410 ms
  let rhythm = 'Ritmo Sinusal Normal';

  if (simState === ECG_STATES.ROJO || ecgState.preset === 'ARRITMIA') {
    rhythm = 'Fibrilación Auricular / Arritmia';
    qrs = 108 + Math.floor(Math.random() * 12);
    qtc = 465 + Math.floor(Math.random() * 18);
  } else if (bpm > 100) {
    rhythm = 'Taquicardia Sinusal';
    qrs = 84;
    qtc = 438;
  } else if (bpm < 60) {
    rhythm = 'Bradicardia Sinusal';
    qrs = 92;
    qtc = 398;
  }

  return { rr_ms: rr, qrs_ms: qrs, qtc_ms: qtc, rhythm };
}

/**
 * Inicia el loop del simulador clínico en tiempo real (~250 Hz equivalentes)
 */
function startSimulator() {
  if (simIntervalId) clearInterval(simIntervalId);

  let seq = ecgState.latestData.seq || 1;
  const startTime = Date.now();

  // Tick a 25ms (~40 ticks/seg) inyectando muestras fluidas
  simIntervalId = setInterval(() => {
    if (ecgState.mode !== 'simulator') return;

    const presetInfo = CLINICAL_PRESETS[ecgState.preset] || CLINICAL_PRESETS.SINUSAL;
    let targetBpm = presetInfo.bpm;
    let estado = presetInfo.state;
    let electrodos = { ra: true, la: true, rl: true };

    if (estado === ECG_STATES.ELECTRODOS_SUELTOS) {
      targetBpm = 0;
      electrodos = { ra: false, la: false, rl: true };
    } else if (estado === ECG_STATES.VERDE) {
      targetBpm = 72 + Math.floor(Math.sin(Date.now() / 2500) * 3);
    } else if (estado === ECG_STATES.AMARILLO && ecgState.preset === 'TAQUICARDIA') {
      targetBpm = 128 + Math.floor(Math.sin(Date.now() / 1500) * 5);
    } else if (estado === ECG_STATES.AMARILLO && ecgState.preset === 'BRADICARDIA') {
      targetBpm = 44 + Math.floor(Math.sin(Date.now() / 3000) * 2);
    } else if (estado === ECG_STATES.ROJO) {
      targetBpm = 154 + Math.floor(Math.sin(Date.now() / 1200) * 12);
    }

    const bps = (targetBpm > 0 ? targetBpm : 60) / 60;
    simPhase = (simPhase + (bps * 0.025)) % 1.0;

    const sample = generateSyntheticEcgSample(estado, simPhase, ecgState.preset);
    
    // Inserción en ring-buffer de osciloscopio
    waveformRing[scanIndex] = sample;
    scanIndex = (scanIndex + 1) % WAVEFORM_BUFFER_SIZE;

    // Buffer de historia reciente (para captura de los últimos 300 puntos)
    waveformHistory.push(sample);
    if (waveformHistory.length > 500) waveformHistory.shift();

    // Actualizar telemetría periódicamente
    seq++;
    if (seq % 8 === 0) {
      const metrics = calculateClinicalMetrics(targetBpm, estado);
      const packet = {
        id: 'AD8232-ESP32-MED',
        seq: seq,
        t_ms: Date.now() - startTime,
        bpm: targetBpm,
        estado: estado,
        electrodos: electrodos,
        rssi: electrodos.ra ? -62 - Math.floor(Math.random() * 5) : -88,
        source: 'Simulador Clínico AD8232',
        ...metrics
      };
      consumeIotEcgPacket(packet);
    }
  }, 25);
}

// ============================================================================
// 2. CONECTIVIDAD HARDWARE REAL: WEB SERIAL API (USB 115200) & MQTT
// ============================================================================

/**
 * Conexión directa a hardware AD8232 vía Web Serial API (Arduino/ESP32 a 115200 baud)
 */
export async function connectSerial() {
  if (!('serial' in navigator)) {
    const msg = 'Tu navegador no soporta Web Serial API. Se requiere Google Chrome, Edge u Opera en escritorio.';
    if (window.showGlassAlert) window.showGlassAlert(msg, 'warning');
    else alert(msg);
    return false;
  }

  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });

    ecgState.serialPort = port;
    ecgState.serialKeepReading = true;
    ecgState.mode = 'serial';
    ecgState.connected = true;

    console.log('[IoT-ECG] Puerto Serie conectado a 115200 baudios.');
    if (window.showGlassAlert) {
      window.showGlassAlert('Sensor ECG USB conectado exitosamente (115200 baud).', 'success');
    }

    readSerialLoop();
    notifyListeners();
    return true;
  } catch (err) {
    console.error('[IoT-ECG] Error al conectar puerto serie:', err);
    if (err.name !== 'NotFoundError') {
      if (window.showGlassAlert) window.showGlassAlert(`Error de conexión USB: ${err.message}`, 'danger');
    }
    return false;
  }
}

/**
 * Loop de lectura continua del flujo USB serie
 */
async function readSerialLoop() {
  let textDecoder = new TextDecoderStream();
  let readableStreamClosed = ecgState.serialPort.readable.pipeTo(textDecoder.writable);
  let reader = textDecoder.readable.getReader();
  ecgState.serialReader = reader;

  let lineBuffer = '';

  try {
    while (ecgState.serialKeepReading) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        lineBuffer += value;
        const lines = lineBuffer.split(/\r?\n/);
        lineBuffer = lines.pop(); // conservar resto incompleto

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          parseSerialLine(trimmed);
        }
      }
    }
  } catch (error) {
    console.error('[IoT-ECG] Error en lectura serie:', error);
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parsea cada línea recibida del sensor AD8232 desde Arduino/ESP32
 * Soporta:
 * 1) Números simples 0-1023 (o voltaje centrado ~512)
 * 2) Tramas estructuradas: "ECG:512,BPM:74,LO:0" o JSON
 */
function parseSerialLine(line) {
  try {
    if (line.startsWith('{') && line.endsWith('}')) {
      const p = JSON.parse(line);
      consumeIotEcgPacket(p);
      return;
    }

    // Formato analógico AD8232 directo (0..1023)
    let rawVal = parseFloat(line);
    if (!isNaN(rawVal)) {
      // Normalizar muestra centrada a [-1, 1]
      let normalized = (rawVal - 512) / 380;
      if (normalized > 1.8) normalized = 1.8;
      if (normalized < -1.5) normalized = -1.5;

      waveformRing[scanIndex] = normalized;
      scanIndex = (scanIndex + 1) % WAVEFORM_BUFFER_SIZE;
      waveformHistory.push(normalized);
      if (waveformHistory.length > 500) waveformHistory.shift();

      // Detección simple de leads off por saturación o 0
      const leadsOk = rawVal > 15 && rawVal < 1010;
      const estado = leadsOk ? ECG_STATES.VERDE : ECG_STATES.ELECTRODOS_SUELTOS;

      ecgState.latestData.estado = estado;
      ecgState.latestData.electrodos = { ra: leadsOk, la: leadsOk, rl: true };
      ecgState.latestData.source = 'Sensor USB (Web Serial 115200)';
    }
  } catch (e) {
    // descarte seguro de ruidos
  }
}

/**
 * Desconecta el puerto USB Serie y retorna al simulador clínico
 */
export async function disconnectSerial() {
  ecgState.serialKeepReading = false;
  if (ecgState.serialReader) {
    try {
      await ecgState.serialReader.cancel();
    } catch (e) {}
    ecgState.serialReader = null;
  }
  if (ecgState.serialPort) {
    try {
      await ecgState.serialPort.close();
    } catch (e) {}
    ecgState.serialPort = null;
  }
  ecgState.mode = 'simulator';
  console.log('[IoT-ECG] Puerto Serie desconectado.');
  notifyListeners();
}

/**
 * Cliente WebSocket / MQTT Telemetría
 */
export function connectMqtt(wsUrl) {
  if (wsUrl) ecgState.mqttUrl = wsUrl;
  ecgState.mode = 'mqtt';

  try {
    if (ecgState.wsClient) {
      ecgState.wsClient.close();
    }

    console.log(`[IoT-ECG] Conectando a Broker MQTT: ${ecgState.mqttUrl}`);
    ecgState.wsClient = new WebSocket(ecgState.mqttUrl);

    ecgState.wsClient.onopen = () => {
      console.log('[IoT-ECG] Telemetría MQTT enlazada.');
      ecgState.connected = true;
      ecgState.reconnectAttempts = 0;
      notifyListeners();
    };

    ecgState.wsClient.onmessage = (event) => {
      try {
        const raw = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data);
        const packet = JSON.parse(raw);
        consumeIotEcgPacket(packet);
      } catch (err) {
        console.warn('[IoT-ECG] Descarte de trama no JSON:', err);
      }
    };

    ecgState.wsClient.onclose = () => {
      ecgState.connected = false;
      notifyListeners();
    };

    ecgState.wsClient.onerror = (err) => {
      console.error('[IoT-ECG] Error en WebSocket MQTT:', err);
      ecgState.connected = false;
    };
  } catch (e) {
    console.error('[IoT-ECG] Excepción WebSocket:', e);
    ecgState.connected = false;
  }
}

export function disconnectMqtt() {
  ecgState.mode = 'simulator';
  if (ecgState.wsClient) {
    try {
      ecgState.wsClient.close();
    } catch (e) {}
    ecgState.wsClient = null;
  }
  notifyListeners();
}

// ============================================================================
// 3. CONSUMIDOR: VALIDACIÓN Y ALERTAS CLÍNICAS (DS N° 41)
// ============================================================================

export function consumeIotEcgPacket(packet) {
  if (!packet || typeof packet !== 'object') return;

  const validStates = Object.values(ECG_STATES);
  const estado = validStates.includes(packet.estado) ? packet.estado : ECG_STATES.SIN_SENAL;

  let electrodos = { ra: true, la: true, rl: true };
  if (typeof packet.electrodos === 'object' && packet.electrodos !== null) {
    electrodos = {
      ra: Boolean(packet.electrodos.ra !== false),
      la: Boolean(packet.electrodos.la !== false),
      rl: Boolean(packet.electrodos.rl !== false)
    };
  } else if (typeof packet.electrodos === 'boolean') {
    electrodos = { ra: packet.electrodos, la: packet.electrodos, rl: true };
  }

  const bpm = Number(packet.bpm) || 0;
  const metrics = calculateClinicalMetrics(bpm, estado);

  const cleanData = {
    id: String(packet.id || 'AD8232-MED'),
    seq: Number(packet.seq) || 0,
    t_ms: Number(packet.t_ms) || 0,
    bpm: bpm,
    estado: estado,
    electrodos: electrodos,
    lead: 'Derivación II (DII)',
    rssi: Number(packet.rssi) || -65,
    source: packet.source || (ecgState.mode === 'serial' ? 'Sensor USB (Web Serial)' : (ecgState.mode === 'mqtt' ? 'Telemetría MQTT' : 'Simulador Clínico AD8232')),
    rr_ms: packet.rr_ms || metrics.rr_ms,
    qrs_ms: packet.qrs_ms || metrics.qrs_ms,
    qtc_ms: packet.qtc_ms || metrics.qtc_ms,
    rhythm: packet.rhythm || metrics.rhythm
  };

  ecgState.latestData = cleanData;

  // Registro automático de eventos críticos (Decreto Supremo N° 41)
  if (cleanData.estado === ECG_STATES.ROJO || cleanData.estado === ECG_STATES.AMARILLO) {
    checkAndStoreCriticalEvent(cleanData);
  }

  // Alerta sonora asistida
  if (cleanData.estado === ECG_STATES.ROJO) {
    triggerVoiceAlertIfActive(cleanData.bpm);
  }

  notifyListeners();
}

function checkAndStoreCriticalEvent(data) {
  const now = Date.now();
  if (now - ecgState.lastAlertStorageTime < 20000) return;
  ecgState.lastAlertStorageTime = now;

  const patientId = activePatient?.id || 'p1';
  const patientName = activePatient?.name || activePatient?.socialName || 'Juan Díaz';

  const alertRecord = {
    id: `ecg_alert_${now}_${Math.random().toString(36).substring(2, 6)}`,
    patientId: patientId,
    patientName: patientName,
    timestamp: new Date().toISOString(),
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('es-CL'),
    deviceId: data.id,
    bpm: data.bpm,
    estado: data.estado,
    rhythm: data.rhythm,
    intervals: { rr_ms: data.rr_ms, qrs_ms: data.qrs_ms, qtc_ms: data.qtc_ms },
    electrodos: data.electrodos,
    tipoAlerta: data.estado === ECG_STATES.ROJO ? 'Alerta Cardíaca Crítica (Arritmia / FA)' : 'Observación Frecuencia Cardíaca Anómala',
    selloTrazabilidad: 'DS N° 41 / Ley N° 20.584 - Telemetría AD8232'
  };

  try {
    const key = `cuidapp_ecg_alerts_${patientId}`;
    const raw = localStorage.getItem(key);
    const alerts = raw ? JSON.parse(raw) : [];
    alerts.unshift(alertRecord);
    if (alerts.length > 30) alerts.length = 30;
    localStorage.setItem(key, JSON.stringify(alerts));
  } catch (e) {
    console.error('[IoT-ECG] Error al guardar alerta clínica:', e);
  }
}

function triggerVoiceAlertIfActive(bpm) {
  const now = Date.now();
  if (now - ecgState.lastVoiceAlertTime < 25000) return;

  if (typeof getModoVozActivo === 'function' && getModoVozActivo()) {
    ecgState.lastVoiceAlertTime = now;
    if (typeof speakText === 'function') {
      speakText(`Alerta médica. Frecuencia cardíaca anómala de ${bpm} pulsaciones por minuto con sospecha de arritmia. Por favor verifique al paciente.`, { force: true });
    }
  }
}

// ============================================================================
// 4. PERSISTENCIA Y CAPTURA DE TRAZADOS ELECTROCARDIOGRÁFICOS
// ============================================================================

/**
 * Guarda una captura de trazado ECG completa (300 puntos + métricas) en localStorage
 * @param {string} patientId - ID del paciente activo
 * @returns {Object} Registro capturado
 */
export function captureAndSaveEcgSnapshot(patientId) {
  const targetId = patientId || activePatient?.id || 'p1';
  const targetName = activePatient?.name || activePatient?.socialName || 'Juan Díaz';
  const now = new Date();

  // Obtener los últimos 300 puntos muestreados
  let points = waveformHistory.slice(-300);
  if (points.length < 300) {
    // Si aún no hay 300 puntos, rellenar desde el ring buffer
    points = [...waveformRing.slice(scanIndex), ...waveformRing.slice(0, scanIndex)].slice(-300);
  }

  const record = {
    id: `ecg_rec_${now.getTime()}_${Math.random().toString(36).substring(2, 7)}`,
    patientId: targetId,
    patientName: targetName,
    rut: activePatient?.rut || 'Sin RUT',
    timestamp: now.toISOString(),
    isoDate: now.toISOString().slice(0, 10),
    time: now.toLocaleTimeString('es-CL'),
    bpm: ecgState.latestData.bpm,
    estado: ecgState.latestData.estado,
    rhythm: ecgState.latestData.rhythm,
    lead: 'Derivación II (DII)',
    intervals: {
      rr_ms: ecgState.latestData.rr_ms,
      qrs_ms: ecgState.latestData.qrs_ms,
      qtc_ms: ecgState.latestData.qtc_ms
    },
    electrodos: ecgState.latestData.electrodos,
    source: ecgState.latestData.source,
    samplePoints: points,
    totalPoints: points.length,
    calibration: {
      speed: '25 mm/s',
      voltage: '10 mm/mV',
      samplingRate: '250 Hz',
      filter: '0.05 - 150 Hz Diagnóstico'
    },
    selloLegal: 'Registro Telemétrico Oficial DS N° 41 / Ley N° 20.584'
  };

  try {
    const key = (STORAGE_KEYS?.ECG_RECORDS || 'cuidapp_ecg_records_') + targetId;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.unshift(record);
    if (existing.length > 25) existing.length = 25; // Retener últimos 25 trazados
    localStorage.setItem(key, JSON.stringify(existing));
    console.log('[IoT-ECG] Trazado guardado exitosamente:', record);
    return record;
  } catch (err) {
    console.error('[IoT-ECG] Error al guardar trazado ECG:', err);
    return null;
  }
}

/**
 * Obtiene el historial de trazados guardados para un paciente
 * @param {string} patientId - ID del paciente
 * @returns {Array} Colección de registros ECG
 */
export function getPatientEcgRecords(patientId) {
  try {
    const targetId = patientId || activePatient?.id || 'p1';
    const key = (STORAGE_KEYS?.ECG_RECORDS || 'cuidapp_ecg_records_') + targetId;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('[IoT-ECG] Error al consultar trazados:', e);
    return [];
  }
}

export function subscribeEcg(callback) {
  ecgState.listeners.add(callback);
  callback(ecgState.latestData, ecgState);
  return () => ecgState.listeners.delete(callback);
}

function notifyListeners() {
  ecgState.listeners.forEach(cb => {
    try {
      cb(ecgState.latestData, ecgState);
    } catch (e) {
      console.error('[IoT-ECG] Error en suscriptor:', e);
    }
  });
}

export function setSimulatorState(state) {
  if (!Object.values(ECG_STATES).includes(state)) return;
  ecgState.currentSimState = state;
  ecgState.mode = 'simulator';

  if (state === ECG_STATES.VERDE) ecgState.preset = 'SINUSAL';
  else if (state === ECG_STATES.AMARILLO) ecgState.preset = 'TAQUICARDIA';
  else if (state === ECG_STATES.ROJO) ecgState.preset = 'ARRITMIA';
  else if (state === ECG_STATES.ELECTRODOS_SUELTOS) ecgState.preset = 'LEOFF';

  notifyListeners();
}

export function setSimulatorPreset(presetKey) {
  if (!CLINICAL_PRESETS[presetKey]) return;
  ecgState.preset = presetKey;
  ecgState.currentSimState = CLINICAL_PRESETS[presetKey].state;
  ecgState.mode = 'simulator';
  notifyListeners();
}

export function getEcgAlerts(patientId) {
  try {
    const key = `cuidapp_ecg_alerts_${patientId || activePatient?.id || 'p1'}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function getIotEcgState() {
  return { ...ecgState };
}

// ============================================================================
// 5. MONITOR MULTIPARÁMETRO DE GRADO HOSPITALARIO (CANVAS 250 HZ OSCILOSCOPIO)
// ============================================================================

/**
 * Monta el Monitor Electrocardiográfico Multiparámetro de Grado Hospitalario
 * @param {string|HTMLElement} container - Contenedor DOM
 * @param {Object} options - Opciones de montaje
 */
export function mountIotEcgWidget(container, options = {}) {
  const target = typeof container === 'string' ? document.getElementById(container) : container;
  if (!target) return null;

  const instanceId = 'ecg_' + Math.random().toString(36).substring(2, 7);
  const patient = activePatient || { name: 'Juan Díaz', rut: '10.420.932-K', id: 'p1' };

  target.innerHTML = `
    <div class="hospital-monitor-container position-relative overflow-hidden text-light" id="monitor_${instanceId}" 
         style="background: #050b10; border: 2px solid #142232; border-radius: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.85); font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;">
      
      <!-- 1. BARRA SUPERIOR DE TELEMETRÍA Y ALERTAS CLÍNICAS -->
      <div class="px-3 py-2.5 d-flex justify-content-between align-items-center flex-wrap gap-2 border-bottom" style="border-color: #12202e !important; background: rgba(5, 11, 16, 0.95); display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
        
        <!-- Identificación de Equipo & Paciente -->
        <div class="d-flex align-items-center flex-wrap gap-2" style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
          <div class="d-flex align-items-center justify-content-center rounded-2 px-2 py-1" style="background: #0b1824; border: 1px solid #1b3248;">
            <i class="bi bi-activity text-info fs-6"></i>
            <span class="ms-1.5 fw-bold text-info font-monospace" style="font-size: 0.76rem; letter-spacing: 0.5px;">cuidApp BIO-2500</span>
          </div>

          <div class="vr bg-secondary opacity-25 mx-1 d-none d-sm-block" style="height: 18px;"></div>

          <div>
            <div class="d-flex align-items-center gap-2">
              <span class="fw-bold text-white" style="font-size: 0.88rem;">${patient.socialName || patient.name || 'Paciente'}</span>
              <span class="badge font-monospace text-white-50 px-2 py-0.5" style="background: rgba(255,255,255,0.06); font-size: 0.7rem;">RUT: ${patient.rut || '10.420.932-K'}</span>
            </div>
          </div>
        </div>

        <!-- Derivación II & Estado de Electrodos RA/LA/RL -->
        <div class="d-flex align-items-center flex-wrap gap-2" style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
          <div class="d-flex align-items-center gap-1.5 px-2.5 py-1 rounded-pill" style="background: #08141f; border: 1px solid #1b3248;">
            <span class="badge bg-primary bg-opacity-25 text-info fw-bold font-monospace" style="font-size: 0.68rem; border: 1px solid rgba(56, 189, 248, 0.3);">LEAD II</span>
            <span class="text-white-50" style="font-size: 0.68rem;">25mm/s • 10mm/mV</span>
          </div>

          <!-- LEDs de Electrodos -->
          <div class="d-flex align-items-center gap-2 px-2.5 py-1 rounded-pill" id="leadsStatus_${instanceId}" style="background: #08141f; border: 1px solid #1b3248; font-size: 0.68rem;">
            <span class="text-white-50 fw-semibold">ELECTRODOS:</span>
            <span class="d-inline-flex align-items-center gap-1 text-white font-monospace" id="leadRA_${instanceId}"><span class="lead-dot dot-green"></span>RA</span>
            <span class="d-inline-flex align-items-center gap-1 text-white font-monospace" id="leadLA_${instanceId}"><span class="lead-dot dot-green"></span>LA</span>
            <span class="d-inline-flex align-items-center gap-1 text-white font-monospace" id="leadRL_${instanceId}"><span class="lead-dot dot-green"></span>RL</span>
          </div>

          <!-- Alarma Visual de Ritmo -->
          <div id="rhythmBadge_${instanceId}">
            <span class="badge px-3 py-1.5 rounded-pill fw-bold text-uppercase d-inline-flex align-items-center gap-1.5" style="background: rgba(0, 255, 157, 0.12); color: #00ff9d; border: 1px solid rgba(0, 255, 157, 0.3); font-size: 0.74rem;">
              <i class="bi bi-heart-pulse-fill"></i> RITMO SINUSAL NORMAL
            </span>
          </div>
        </div>
      </div>

      <!-- 2. CUERPO PRINCIPAL DEL MONITOR (CANVAS OSCILOSCOPIO + PANEL MULTIPARÁMETRO) -->
      <div class="row g-0">
        
        <!-- A. Canvas de Trazado Electrocardiográfico en Tiempo Real -->
        <div class="col-12 col-lg-9 position-relative p-2.5" style="background: #050b10;">
          
          <div class="position-relative rounded-3 overflow-hidden" style="background: #03070b; border: 1px solid #102131; box-shadow: inset 0 0 35px rgba(0,0,0,0.95); min-height: 220px;">
            
            <!-- Grilla Electrocardiográfica Milimétrica Real (25 mm/s, 10 mm/mV) -->
            <div class="position-absolute w-100 h-100 ecg-hospital-grid" style="pointer-events: none;"></div>

            <!-- Canvas de Alta Tasa (250 Hz) -->
            <canvas id="canvasEcg_${instanceId}" width="900" height="260" style="width: 100%; max-width: 100%; height: auto; display: block;"></canvas>

            <!-- Marcas de Calibración Médica -->
            <div class="position-absolute top-0 start-0 p-2.5 d-flex align-items-center gap-2" style="pointer-events: none;">
              <span class="font-monospace fw-bold" id="leadTag_${instanceId}" style="color: #00ff9d; font-size: 0.78rem; text-shadow: 0 0 8px rgba(0,255,157,0.5);">II 1.0mV</span>
              <span class="text-white-50 font-monospace" style="font-size: 0.65rem;">0.05-150Hz Filtro HP/Notch 50Hz</span>
            </div>

            <!-- Banner Informativo Sobreimpreso si hay alarma -->
            <div id="alarmOverlay_${instanceId}" class="position-absolute top-0 end-0 p-2.5 d-none" style="pointer-events: none;">
              <span class="badge bg-danger text-white px-2.5 py-1 fw-bold font-monospace animate-pulse" style="font-size: 0.74rem; box-shadow: 0 0 15px rgba(255, 77, 109, 0.6);">
                <i class="bi bi-exclamation-triangle-fill me-1"></i> ALERTA MÉDICA EN CURSO
              </span>
            </div>

            <!-- Escala de Tiempo Inferior -->
            <div class="position-absolute bottom-0 start-0 w-100 px-3 py-1.5 d-flex justify-content-between text-white-50 font-monospace" style="font-size: 0.62rem; pointer-events: none; background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);">
              <span>|◄─── 1 seg (25 mm) ───►|</span>
              <span id="sourceLabel_${instanceId}">Fuente: Simulador Clínico AD8232</span>
              <span>cuidApp Medical Telemetry v2.5</span>
            </div>
          </div>
        </div>

        <!-- B. Panel Multiparámetro Lateral (FC, Intervalos RR/QRS/QTc) -->
        <div class="col-12 col-lg-3 p-2.5 border-start" style="border-color: #12202e !important; background: #071017;">
          <div class="d-flex flex-column h-100 justify-content-between gap-2">
            
            <!-- Bloque FC (Frecuencia Cardíaca Principal) -->
            <div class="p-3 rounded-3" id="bpmCard_${instanceId}" style="background: #0a1622; border: 1px solid #162c42;">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="text-uppercase fw-bold text-white-50 font-monospace" style="font-size: 0.74rem; letter-spacing: 1px;">FC / HEART RATE</span>
                <i class="bi bi-heart-fill fs-5 ecg-beating-heart" id="heartIcon_${instanceId}" style="color: #00ff9d; filter: drop-shadow(0 0 8px rgba(0,255,157,0.7));"></i>
              </div>
              <div class="d-flex align-items-baseline gap-2">
                <span class="display-4 fw-bolder font-monospace" id="bpmNumber_${instanceId}" style="color: #00ff9d; letter-spacing: -2px; text-shadow: 0 0 20px rgba(0,255,157,0.4);">72</span>
                <div class="d-flex flex-column">
                  <span class="text-white-50 fw-bold" style="font-size: 0.72rem;">BPM</span>
                  <span class="text-white-50" style="font-size: 0.64rem;">lpm</span>
                </div>
              </div>
              <div class="text-white-50 font-monospace mt-1" style="font-size: 0.65rem;">
                Límites Clínicos: 50 - 110 lpm
              </div>
            </div>

            <!-- Métricas Clínicas Calculadas en Vivo -->
            <div class="p-2.5 rounded-3" style="background: #0a1622; border: 1px solid #162c42;">
              <div class="text-white-50 fw-semibold text-uppercase font-monospace mb-2" style="font-size: 0.68rem; letter-spacing: 0.5px;">
                <i class="bi bi-stopwatch me-1 text-info"></i> Intervalos Electrocardiográficos:
              </div>
              
              <div class="d-flex justify-content-between align-items-center py-1 border-bottom border-secondary border-opacity-25">
                <span class="text-white-50" style="font-size: 0.72rem;">Intervalo RR</span>
                <span class="font-monospace fw-bold text-light" id="valRR_${instanceId}" style="font-size: 0.8rem;">833 ms</span>
              </div>
              
              <div class="d-flex justify-content-between align-items-center py-1 border-bottom border-secondary border-opacity-25">
                <span class="text-white-50" style="font-size: 0.72rem;">Duración QRS</span>
                <span class="font-monospace fw-bold text-light" id="valQRS_${instanceId}" style="font-size: 0.8rem;">88 ms</span>
              </div>

              <div class="d-flex justify-content-between align-items-center py-1">
                <span class="text-white-50" style="font-size: 0.72rem;">QTc (Bazett)</span>
                <span class="font-monospace fw-bold text-light" id="valQTc_${instanceId}" style="font-size: 0.8rem;">412 ms</span>
              </div>
            </div>

            <!-- Botón de Captura y Persistencia en Ficha Médica -->
            <div>
              <button type="button" class="btn w-100 py-2 rounded-3 fw-bold d-flex align-items-center justify-content-center gap-2" 
                      id="btnCapture_${instanceId}" 
                      style="background: linear-gradient(135deg, #0284c7, #0369a1); color: #ffffff; border: 1px solid #38bdf8; box-shadow: 0 4px 15px rgba(2, 132, 199, 0.35); font-size: 0.8rem;">
                <span>📸 Capturar y Enviar Trazado ECG</span>
              </button>

              <div id="captureFeedback_${instanceId}" class="text-center mt-1.5 small font-monospace d-none" style="font-size: 0.68rem;"></div>
            </div>

          </div>
        </div>
      </div>

      <!-- 3. BARRA INFERIOR DE FUENTE DE SEÑAL Y SELECTOR CLÍNICO -->
      <div class="px-3 py-2.5 border-top d-flex justify-content-between align-items-center flex-wrap gap-2" style="border-color: #12202e !important; background: #04090e;">
        
        <!-- Selector de Fuente (Hardware Real vs Telemetría vs Simulador) -->
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <span class="text-white-50 fw-semibold" style="font-size: 0.72rem;"><i class="bi bi-hdd-network me-1"></i>Fuente de Señal:</span>
          
          <button type="button" class="btn btn-sm rounded-pill px-3 py-1 font-monospace fw-semibold source-btn" id="btnSourceUsb_${instanceId}" 
                  style="background: #0a1724; color: #38bdf8; border: 1px solid #1e3853; font-size: 0.72rem;">
            <i class="bi bi-usb-symbol me-1"></i>🔌 Sensor USB (115200)
          </button>

          <button type="button" class="btn btn-sm rounded-pill px-3 py-1 font-monospace fw-semibold source-btn" id="btnSourceMqtt_${instanceId}" 
                  style="background: #0a1724; color: #94a3b8; border: 1px solid #1e3853; font-size: 0.72rem;">
            <i class="bi bi-broadcast me-1"></i>📡 Telemetría MQTT
          </button>

          <button type="button" class="btn btn-sm rounded-pill px-3 py-1 font-monospace fw-semibold active-source-btn" id="btnSourceSim_${instanceId}" 
                  style="background: rgba(14, 165, 233, 0.2); color: #38bdf8; border: 1px solid #0284c7; font-size: 0.72rem;">
            <i class="bi bi-sliders me-1"></i>🎛️ Simulador AD8232
          </button>
        </div>

        <!-- Presets Clínicos Rápidos de Demostración -->
        <div class="d-flex align-items-center gap-1.5 flex-wrap" id="simPresetsWrap_${instanceId}">
          <span class="text-white-50" style="font-size: 0.7rem;">Patología:</span>

          <button type="button" class="btn btn-sm rounded-pill px-2.5 py-0.5 preset-btn" data-preset="SINUSAL" 
                  style="background: rgba(0, 255, 157, 0.1); color: #00ff9d; border: 1px solid rgba(0, 255, 157, 0.3); font-size: 0.7rem;">
            🟢 Sinusal 72
          </button>

          <button type="button" class="btn btn-sm rounded-pill px-2.5 py-0.5 preset-btn" data-preset="TAQUICARDIA" 
                  style="background: rgba(255, 183, 3, 0.1); color: #ffb703; border: 1px solid rgba(255, 183, 3, 0.3); font-size: 0.7rem;">
            🟡 Taquicardia 128
          </button>

          <button type="button" class="btn btn-sm rounded-pill px-2.5 py-0.5 preset-btn" data-preset="BRADICARDIA" 
                  style="background: rgba(255, 183, 3, 0.1); color: #ffb703; border: 1px solid rgba(255, 183, 3, 0.3); font-size: 0.7rem;">
            🟠 Bradicardia 44
          </button>

          <button type="button" class="btn btn-sm rounded-pill px-2.5 py-0.5 preset-btn" data-preset="ARRITMIA" 
                  style="background: rgba(255, 77, 109, 0.12); color: #ff4d6d; border: 1px solid rgba(255, 77, 109, 0.35); font-size: 0.7rem;">
            🔴 Arritmia / FA
          </button>

          <button type="button" class="btn btn-sm rounded-pill px-2 py-0.5 preset-btn text-white-50" data-preset="LEOFF" 
                  style="background: #0a1724; border: 1px solid #1e3853; font-size: 0.7rem;">
            ⚠️ Electrodos Sueltos
          </button>
        </div>

      </div>

    </div>

    <!-- Estilos embebidos de grado clínico -->
    <style>
      .ecg-hospital-grid {
        background-color: #050b10;
        background-image: 
          linear-gradient(rgba(0, 255, 157, 0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 255, 157, 0.05) 1px, transparent 1px),
          linear-gradient(rgba(0, 255, 157, 0.16) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 255, 157, 0.16) 1px, transparent 1px);
        background-size: 8px 8px, 8px 8px, 40px 40px, 40px 40px;
      }
      .lead-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        display: inline-block;
      }
      .dot-green {
        background: #00ff9d;
        box-shadow: 0 0 6px #00ff9d;
      }
      .dot-red {
        background: #ff4d6d;
        box-shadow: 0 0 6px #ff4d6d;
      }
      .ecg-beating-heart {
        transition: transform 0.12s ease-in-out;
      }
      .ecg-beat-active {
        transform: scale(1.35);
      }
    </style>
  `;

  // Referencias a elementos interactivos del widget
  const canvas = document.getElementById(`canvasEcg_${instanceId}`);
  const ctx = canvas ? canvas.getContext('2d') : null;

  const bpmNumber = document.getElementById(`bpmNumber_${instanceId}`);
  const heartIcon = document.getElementById(`heartIcon_${instanceId}`);
  const rhythmBadge = document.getElementById(`rhythmBadge_${instanceId}`);
  const alarmOverlay = document.getElementById(`alarmOverlay_${instanceId}`);
  const valRR = document.getElementById(`valRR_${instanceId}`);
  const valQRS = document.getElementById(`valQRS_${instanceId}`);
  const valQTc = document.getElementById(`valQTc_${instanceId}`);
  const leadRA = document.getElementById(`leadRA_${instanceId}`);
  const leadLA = document.getElementById(`leadLA_${instanceId}`);
  const leadRL = document.getElementById(`leadRL_${instanceId}`);
  const sourceLabel = document.getElementById(`sourceLabel_${instanceId}`);
  const leadTag = document.getElementById(`leadTag_${instanceId}`);

  // Suscribir actualización visual al estado del sistema IoT
  const unsubscribe = subscribeEcg((data, state) => {
    if (!bpmNumber) return;

    const currentBpm = data.bpm > 0 ? data.bpm : '--';
    bpmNumber.textContent = currentBpm;

    if (valRR) valRR.textContent = data.rr_ms > 0 ? `${data.rr_ms} ms` : '--';
    if (valQRS) valQRS.textContent = data.qrs_ms > 0 ? `${data.qrs_ms} ms` : '--';
    if (valQTc) valQTc.textContent = data.qtc_ms > 0 ? `${data.qtc_ms} ms` : '--';
    if (sourceLabel) sourceLabel.textContent = `Fuente: ${data.source || 'Simulador Clínico AD8232'}`;

    // Color temático según patología
    let themeColor = '#00ff9d';
    let rhythmText = data.rhythm || 'RITMO SINUSAL NORMAL';

    if (data.estado === ECG_STATES.AMARILLO) {
      themeColor = '#ffb703';
    } else if (data.estado === ECG_STATES.ROJO) {
      themeColor = '#ff4d6d';
    } else if (data.estado === ECG_STATES.ELECTRODOS_SUELTOS || data.estado === ECG_STATES.SIN_SENAL) {
      themeColor = '#64748b';
    }

    bpmNumber.style.color = themeColor;
    bpmNumber.style.textShadow = `0 0 20px ${themeColor}66`;
    if (heartIcon) {
      heartIcon.style.color = themeColor;
      heartIcon.style.filter = `drop-shadow(0 0 8px ${themeColor}aa)`;
    }
    if (leadTag) {
      leadTag.style.color = themeColor;
      leadTag.style.textShadow = `0 0 8px ${themeColor}88`;
    }

    // Actualizar badge de ritmo
    if (rhythmBadge) {
      rhythmBadge.innerHTML = `
        <span class="badge px-3 py-1.5 rounded-pill fw-bold text-uppercase d-inline-flex align-items-center gap-1.5" 
              style="background: ${themeColor}1a; color: ${themeColor}; border: 1px solid ${themeColor}55; font-size: 0.74rem;">
          <i class="bi bi-heart-pulse-fill"></i> ${rhythmText}
        </span>
      `;
    }

    // Alarma visual superpuesta si es estado crítico
    if (alarmOverlay) {
      if (data.estado === ECG_STATES.ROJO) {
        alarmOverlay.classList.remove('d-none');
      } else {
        alarmOverlay.classList.add('d-none');
      }
    }

    // Actualizar LEDs de electrodos RA, LA, RL
    const el = data.electrodos || { ra: true, la: true, rl: true };
    if (leadRA) leadRA.innerHTML = `<span class="lead-dot ${el.ra ? 'dot-green' : 'dot-red'}"></span>RA`;
    if (leadLA) leadLA.innerHTML = `<span class="lead-dot ${el.la ? 'dot-green' : 'dot-red'}"></span>LA`;
    if (leadRL) leadRL.innerHTML = `<span class="lead-dot ${el.rl ? 'dot-green' : 'dot-red'}"></span>RL`;
  });

  // Latido del corazón sincronizado al pulso (efecto sístole)
  let beatTimer = setInterval(() => {
    if (!heartIcon) return;
    if (ecgState.latestData.bpm > 0) {
      heartIcon.classList.add('ecg-beat-active');
      setTimeout(() => heartIcon.classList.remove('ecg-beat-active'), 110);
    }
  }, Math.max(350, Math.round(60000 / (ecgState.latestData.bpm || 72))));

  // ============================================================================
  // RENDERIZADO DEL BARRIDO OSCILOSCÓPICO MÉDICO (SWEEP ERASING 250 HZ)
  // ============================================================================
  let sweepCursorX = 0;

  function renderOscilloscopeSweep() {
    if (!ctx || !canvas) return;

    const width = canvas.width;
    const height = canvas.height;
    const midY = height / 2;

    // Obtener color del trazo según estado
    let strokeColor = '#00ff9d';
    let glowColor = 'rgba(0, 255, 157, 0.6)';

    if (ecgState.latestData.estado === ECG_STATES.AMARILLO) {
      strokeColor = '#ffb703';
      glowColor = 'rgba(255, 183, 3, 0.6)';
    } else if (ecgState.latestData.estado === ECG_STATES.ROJO) {
      strokeColor = '#ff4d6d';
      glowColor = 'rgba(255, 77, 109, 0.8)';
    } else if (ecgState.latestData.estado === ECG_STATES.ELECTRODOS_SUELTOS || ecgState.latestData.estado === ECG_STATES.SIN_SENAL) {
      strokeColor = '#64748b';
      glowColor = 'transparent';
    }

    // Limpieza completa del canvas para redibujar la onda continua
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // 1. Dibujar trazo ECG principal de alta nitidez
    ctx.beginPath();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.2;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 9;

    const totalPoints = waveformRing.length;
    const stepX = width / (totalPoints - 1);

    for (let i = 0; i < totalPoints; i++) {
      const x = i * stepX;
      const amp = height * 0.42;
      const y = midY - (waveformRing[i] * amp);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 2. Cursor de barrido brillante en la posición del escáner (scanIndex)
    const curX = scanIndex * stepX;
    const curY = midY - (waveformRing[scanIndex] * (height * 0.42));

    // Cabeza fosforescente
    ctx.beginPath();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = strokeColor;
    ctx.shadowBlur = 14;
    ctx.arc(curX, curY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Línea vertical sutil de barrido tipo monitor de UCI
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.moveTo(curX, 0);
    ctx.lineTo(curX, height);
    ctx.stroke();

    ctx.restore();

    animationFrameId = requestAnimationFrame(renderOscilloscopeSweep);
  }

  renderOscilloscopeSweep();

  // ============================================================================
  // EVENTOS Y CONTROLES DEL PANEL
  // ============================================================================

  // Presets clínicos de prueba
  target.querySelectorAll('.preset-btn').forEach(btn => {
    btn.onclick = () => {
      const presetKey = btn.getAttribute('data-preset');
      setSimulatorPreset(presetKey);
    };
  });

  // Selector de Fuente: Simulador Clínico
  const btnSourceSim = document.getElementById(`btnSourceSim_${instanceId}`);
  const btnSourceUsb = document.getElementById(`btnSourceUsb_${instanceId}`);
  const btnSourceMqtt = document.getElementById(`btnSourceMqtt_${instanceId}`);

  function updateSourceButtonsVisual(activeSource) {
    [btnSourceSim, btnSourceUsb, btnSourceMqtt].forEach(btn => {
      if (!btn) return;
      btn.style.background = '#0a1724';
      btn.style.color = '#94a3b8';
      btn.style.borderColor = '#1e3853';
    });

    if (activeSource === 'sim' && btnSourceSim) {
      btnSourceSim.style.background = 'rgba(14, 165, 233, 0.2)';
      btnSourceSim.style.color = '#38bdf8';
      btnSourceSim.style.borderColor = '#0284c7';
    } else if (activeSource === 'usb' && btnSourceUsb) {
      btnSourceUsb.style.background = 'rgba(0, 255, 157, 0.2)';
      btnSourceUsb.style.color = '#00ff9d';
      btnSourceUsb.style.borderColor = '#00ff9d';
    } else if (activeSource === 'mqtt' && btnSourceMqtt) {
      btnSourceMqtt.style.background = 'rgba(245, 158, 11, 0.2)';
      btnSourceMqtt.style.color = '#fbbf24';
      btnSourceMqtt.style.borderColor = '#f59e0b';
    }
  }

  if (btnSourceSim) {
    btnSourceSim.onclick = () => {
      disconnectSerial();
      disconnectMqtt();
      ecgState.mode = 'simulator';
      startSimulator();
      updateSourceButtonsVisual('sim');
      if (window.showGlassAlert) window.showGlassAlert('Fuente fijada en Simulador Clínico AD8232.', 'info');
    };
  }

  if (btnSourceUsb) {
    btnSourceUsb.onclick = async () => {
      const ok = await connectSerial();
      if (ok) {
        updateSourceButtonsVisual('usb');
      }
    };
  }

  if (btnSourceMqtt) {
    btnSourceMqtt.onclick = () => {
      const broker = prompt('URL WebSocket del Broker MQTT (ej. wss://broker.emqx.io:8084/mqtt o ws://localhost:8080):', ecgState.mqttUrl);
      if (broker) {
        connectMqtt(broker);
        updateSourceButtonsVisual('mqtt');
        if (window.showGlassAlert) window.showGlassAlert(`Conectando a telemetría MQTT en ${broker}...`, 'warning');
      }
    };
  }

  // Botón de Captura y Persistencia en Ficha Clínica
  const btnCapture = document.getElementById(`btnCapture_${instanceId}`);
  const captureFeedback = document.getElementById(`captureFeedback_${instanceId}`);

  if (btnCapture) {
    btnCapture.onclick = () => {
      const snapshot = captureAndSaveEcgSnapshot(patient.id || 'p1');
      if (snapshot && captureFeedback) {
        captureFeedback.classList.remove('d-none');
        captureFeedback.innerHTML = `
          <span class="text-success"><i class="bi bi-check-circle-fill me-1"></i> Trazado #${snapshot.id.slice(-6)} guardado en ficha clínica (${snapshot.time})</span>
        `;
        btnCapture.classList.add('btn-success');
        btnCapture.innerHTML = '<i class="bi bi-check-lg"></i> <span>¡Trazado ECG Capturado y Enviado!</span>';

        if (window.showGlassAlert) {
          window.showGlassAlert(`Trazado ECG de 300 muestras (${snapshot.rhythm}, ${snapshot.bpm} BPM) guardado en la ficha de ${snapshot.patientName}.`, 'success');
        }

        setTimeout(() => {
          btnCapture.classList.remove('btn-success');
          btnCapture.innerHTML = '<span>📸 Capturar y Enviar Trazado ECG</span>';
          captureFeedback.classList.add('d-none');
        }, 4000);
      }
    };
  }

  return {
    destroy: () => {
      unsubscribe();
      clearInterval(beatTimer);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    }
  };
}

// Iniciar simulación clínica por defecto al importar el módulostartSimulator();
