/**
 * @fileoverview Módulo de Autenticación, Registro Universal y Recuperación - cuidApp
 * @module src/auth
 * @description Gestión integral de acceso por credenciales, 1-Click Demo Login,
 * registro universal inclusivo (RUT chileno, NIC/NIP provisorio y Pasaporte extranjero),
 * guía locutada por voz para personas con discapacidad visual y recuperación de cuenta (vía correo o IVR).
 *
 * @compliance
 * - Ley N° 19.628: Protección de Datos de Carácter Personal y Sensibles
 * - Ley N° 20.584: Validación de Identidad y Consentimiento Informado
 * - Ley N° 21.120: Registro con Nombre Social y Género Autoidentificado
 * - Decreto Supremo N° 41 MINSAL: Validación de Identidad de Titulares y Representantes Legales
 */

import {
  PATIENTS_DATABASE,
  CAREGIVERS_DATABASE,
  Patient,
  handleLoginSuccess,
  registerPatientInDatabase,
  updateUserPasswordInSystem,
  cleanRut,
  formatRut,
  validateChileanRut,
  calculateAge,
  speakText,
  getModoVozActivo
} from './main.js';

// Objeto de credenciales nativas demo (cuidApp Telemedicina)
export const NATIVE_DEMO_CREDENTIALS = {
  admin: { role: 'admin', password: 'admin123', name: 'Administrador Central' },
  doctor: { role: 'doctor', password: 'doctor123', name: 'Dra. Elena Valdés' },
  sofia: { role: 'caregiver', password: 'sofia123', name: 'Sofía Díaz' },
  juan: { role: 'patient', patientId: 'p1', password: 'juan123', name: 'Juan Díaz' },
  mateo: { role: 'patient', patientId: 'p_mateo', password: 'mateo123', name: 'Mateo Morales', age: 7, isPediatric: true },
  camila: { role: 'patient', patientId: 'p_camila', password: '1234', name: 'Camila Soto', age: 14, isPediatric: true, isAdolescent: true },
  valentina: { role: 'patient', patientId: 'p_valentina', password: '1234', name: 'Valentina Rojas', age: 32, isPediatric: false, children: ['p_lucas'] },
  daniela: { role: 'patient', patientId: 'p_daniela', password: '1234', name: 'Daniela Morales', age: 28, isPregnant: true, pregnancyWeeks: 24, gestationalWeeks: 24 }
};

// --- RELOJ DEL LOGIN ---
export function updateZorinClock() {
  const clockEl = document.getElementById('zorinClock');
  if (!clockEl) return;
  const now = new Date();
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const dayName = days[now.getDay()];
  const dayNum = now.getDate();
  const monthName = months[now.getMonth()];
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  clockEl.textContent = `${dayName} ${dayNum} de ${monthName} ${hours}:${minutes}`;
}
setInterval(updateZorinClock, 1000);

// --- RENDERIZADO DEL LOGIN & MODALES GLASSKIT ---
export function renderLogin() {
  const currentTheme = localStorage.getItem('cuidapp_theme') || 'dark';
  const isLight = currentTheme === 'light';
  if (isLight) {
    document.body.classList.add('cuidapp-theme-light');
  } else {
    document.body.classList.remove('cuidapp-theme-light');
  }

  document.querySelector('#app').innerHTML = `
    <div id="ambient-orb"></div>
    <section id="login-section" class="content-section position-relative overflow-hidden" style="padding: 0; min-height: 100vh;">
        <div class="zorin-login-container d-flex flex-column align-items-center justify-content-between py-4 position-relative" style="min-height: 100vh;">
            <!-- CAJA DE PERFILES DEMO ARRIBA A LA IZQUIERDA (COMPACTO 2 COLUMNAS, 11px, MAX 340px) -->
            <div class="zorin-credentials-widget p-2.5 glass-card position-absolute" style="top: 18px; left: 24px; max-width: 340px; width: calc(100% - 48px); z-index: 100; border-radius: 16px; background: rgba(15, 23, 42, 0.72); border: 1px solid rgba(255, 255, 255, 0.12); box-shadow: 0 10px 30px rgba(0,0,0,0.35); font-size: 11px;">
                <div class="d-flex align-items-center justify-content-between mb-1.5 pb-1 border-bottom border-light border-opacity-10">
                  <span class="fw-bold text-white d-flex align-items-center gap-1" style="font-size: 11px;">
                    <i class="bi bi-shield-check text-info"></i>
                    <span>Acceso Rápido Demo (1-Click)</span>
                  </span>
                  <span class="badge bg-primary bg-opacity-25 text-info" style="font-size: 9px; padding: 2px 5px;">8 Perfiles</span>
                </div>
                <div class="d-grid gap-1" style="grid-template-columns: 1fr 1fr; font-size: 11px;">
                  <button type="button" class="btn btn-sm btn-quick-login text-start p-1 rounded-2 text-white border border-light border-opacity-10 shadow-sm" data-user="admin" data-pass="admin123" style="background: rgba(255,255,255,0.05); font-size: 11px; cursor: pointer; transition: background 0.15s;">
                    <div class="fw-bold text-truncate" style="font-size: 11px;">🛡️ Admin</div>
                    <code class="text-info" style="font-size: 10px;">admin / admin123</code>
                  </button>
                  <button type="button" class="btn btn-sm btn-quick-login text-start p-1 rounded-2 text-white border border-light border-opacity-10 shadow-sm" data-user="doctor" data-pass="doctor123" style="background: rgba(255,255,255,0.05); font-size: 11px; cursor: pointer; transition: background 0.15s;">
                    <div class="fw-bold text-truncate" style="font-size: 11px;">🩺 Médico</div>
                    <code class="text-info" style="font-size: 10px;">doctor / doctor123</code>
                  </button>
                  <button type="button" class="btn btn-sm btn-quick-login text-start p-1 rounded-2 text-white border border-light border-opacity-10 shadow-sm" data-user="sofia" data-pass="sofia123" style="background: rgba(255,255,255,0.05); font-size: 11px; cursor: pointer; transition: background 0.15s;">
                    <div class="fw-bold text-truncate" style="font-size: 11px;">🤝 Cuidador</div>
                    <code class="text-info" style="font-size: 10px;">sofia / sofia123</code>
                  </button>
                  <button type="button" class="btn btn-sm btn-quick-login text-start p-1 rounded-2 text-white border border-light border-opacity-10 shadow-sm" data-user="juan" data-pass="juan123" style="background: rgba(255,255,255,0.05); font-size: 11px; cursor: pointer; transition: background 0.15s;">
                    <div class="fw-bold text-truncate" style="font-size: 11px;">👴 Juan (76a)</div>
                    <code class="text-info" style="font-size: 10px;">juan / juan123</code>
                  </button>
                  <button type="button" class="btn btn-sm btn-quick-login text-start p-1 rounded-2 text-white border border-light border-opacity-10 shadow-sm" data-user="mateo" data-pass="mateo123" style="background: rgba(255,255,255,0.05); font-size: 11px; cursor: pointer; transition: background 0.15s;">
                    <div class="fw-bold text-truncate" style="font-size: 11px;">🧒 Mateo (7a)</div>
                    <code class="text-info" style="font-size: 10px;">mateo / mateo123</code>
                  </button>
                  <button type="button" class="btn btn-sm btn-quick-login text-start p-1 rounded-2 text-white border border-light border-opacity-10 shadow-sm" data-user="camila" data-pass="1234" style="background: rgba(255,255,255,0.05); font-size: 11px; cursor: pointer; transition: background 0.15s;">
                    <div class="fw-bold text-truncate" style="font-size: 11px;">🎒 Camila (14a)</div>
                    <code class="text-info" style="font-size: 10px;">camila / 1234</code>
                  </button>
                  <button type="button" class="btn btn-sm btn-quick-login text-start p-1 rounded-2 text-white border border-light border-opacity-10 shadow-sm" data-user="valentina" data-pass="1234" style="background: rgba(255,255,255,0.05); font-size: 11px; cursor: pointer; transition: background 0.15s;">
                    <div class="fw-bold text-truncate" style="font-size: 11px;">👩‍👧 Valentina (32a)</div>
                    <code class="text-info" style="font-size: 10px;">valentina / 1234</code>
                  </button>
                  <button type="button" class="btn btn-sm btn-quick-login text-start p-1 rounded-2 text-white border border-light border-opacity-10 shadow-sm" data-user="daniela" data-pass="1234" style="background: rgba(255,255,255,0.05); font-size: 11px; cursor: pointer; transition: background 0.15s;">
                    <div class="fw-bold text-truncate" style="font-size: 11px;">🤰 Daniela (28a)</div>
                    <code class="text-info" style="font-size: 10px;">daniela / 1234</code>
                  </button>
                </div>
            </div>

            <!-- SELECTOR DE TEMA GLOBAL (SOL / LUNA) ESQUINA SUPERIOR DERECHA, JUNTO A LA FECHA/HORA -->
            <div class="zorin-theme-widget position-absolute" style="top: 18px; right: 24px; z-index: 100;">
              <button type="button" id="loginThemeToggleBtn" class="btn btn-sm px-3 py-1.5 fw-bold d-inline-flex align-items-center gap-2 shadow-sm text-white" style="border-radius: 12px; background: rgba(15, 23, 42, 0.72); border: 1.5px solid rgba(255, 255, 255, 0.2); cursor: pointer; transition: all 0.2s;" title="Alternar entre Modo Día y Modo Noche para toda la aplicación">
                <span id="loginThemeIcon" style="font-size: 1.15rem;">${isLight ? '🌙' : '☀️'}</span>
                <span id="loginThemeText" class="fw-semibold">${isLight ? 'Modo Noche' : 'Modo Día'}</span>
              </button>
            </div>

            <div class="w-100 d-flex flex-column align-items-center gap-1">
                <div class="zorin-top-bar d-flex justify-content-center w-100 pt-3">
                    <div id="zorinClock" class="fw-medium text-white text-opacity-80">-- -- --:--</div>
                </div>
            </div>
            
            <div class="zorin-center-login d-flex flex-column align-items-center gap-2">
                <div class="zorin-avatar shadow-lg d-flex justify-content-center align-items-center" style="width: 80px; height: 80px; border-radius: 50%; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); overflow: hidden;">
                    <i id="zorinAvatarIcon" class="bi bi-person text-white text-opacity-40" style="font-size: 2.5rem;"></i>
                </div>
                <div id="zorinGreeting" class="zorin-username text-white text-center m-0 fw-medium" style="font-size: 1.15rem;">¿Hola?</div>
                
                <div id="loginStepUsername" class="w-100 text-center">
                    <form id="formUsername" class="zorin-input-wrapper mt-1 px-4 d-flex align-items-center justify-content-center gap-2">
                        <div class="zorin-spacer" style="width: 32px; height: 32px;"></div>
                        <div class="zorin-input-container position-relative flex-grow-1" style="min-width: 280px; max-width: 100%;">
                            <input type="text" id="zorinUsername" class="zorin-input text-center rounded-pill py-1 text-white border-white border-opacity-25 w-100" placeholder="Usuario, RUT o Pasaporte" autocomplete="username" required style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.25); outline: none;">
                        </div>
                        <button type="submit" class="zorin-forward-btn btn-glass-secondary rounded-circle d-flex align-items-center justify-content-center" style="width: 32px; height: 32px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); color: #fff;"><i class="bi bi-arrow-right-short fs-4"></i></button>
                    </form>
                </div>
                
                <div id="loginStepPassword" class="w-100 text-center d-none">
                    <form id="formPassword" class="zorin-input-wrapper mt-1 px-4 d-flex align-items-center justify-content-center gap-2">
                        <button type="button" id="btnBackToUser" class="zorin-back-btn btn-glass-secondary rounded-circle d-flex align-items-center justify-content-center" style="width: 32px; height: 32px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); color: #fff;"><i class="bi bi-arrow-left-short fs-4"></i></button>
                        <div class="zorin-input-container position-relative flex-grow-1" style="min-width: 280px; max-width: 100%; display: flex; align-items: center;">
                            <input type="password" id="zorinPassword" class="zorin-input rounded-pill py-1 text-center w-100 text-white border-white border-opacity-25" placeholder="Contraseña" autocomplete="current-password" required style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.25); outline: none; padding-right: 30px;">
                            <span id="togglePasswordVisibility" class="zorin-toggle-password position-absolute" style="right: 12px; cursor: pointer; color: rgba(255,255,255,0.6);"><i id="passwordEyeIcon" class="bi bi-eye"></i></span>
                        </div>
                        <button type="submit" class="zorin-forward-btn btn-glass-secondary rounded-circle d-flex align-items-center justify-content-center" style="width: 32px; height: 32px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); color: #fff;"><i class="bi bi-arrow-right-short fs-4"></i></button>
                    </form>
                </div>

                <!-- ACCIONES RÁPIDAS: REGISTRO Y RECUPERACIÓN (LEY 20.584, 21.120, 21.430, 19.628) -->
                <div class="d-flex flex-column align-items-center gap-2 mt-3 w-100 px-3" style="max-width: 320px;">
                  <button type="button" id="btnOpenRegisterModal" class="btn w-100 rounded-pill py-2 px-3 fw-bold text-white d-inline-flex align-items-center justify-content-center gap-2 shadow" style="font-size: 0.88rem; background: linear-gradient(135deg, rgba(14, 165, 233, 0.35) 0%, rgba(2, 132, 199, 0.55) 100%); border: 1.5px solid rgba(56, 189, 248, 0.45); cursor: pointer; transition: all 0.25s ease;">
                    <span>✨ ¿Eres nuevo? Crear Ficha y Registrarme</span>
                  </button>
                  <button type="button" id="btnOpenRecoveryModal" class="btn btn-link text-white text-opacity-75 small text-decoration-none d-inline-flex align-items-center gap-1.5 p-1" style="font-size: 0.82rem; cursor: pointer; transition: color 0.2s ease;">
                    <span>🔑 ¿Olvidaste tu contraseña?</span>
                  </button>
                </div>
            </div>

            <div class="zorin-bottom-bar w-100 d-flex justify-content-center align-items-center position-relative pb-4 gap-2">
                <i class="bi bi-heart-pulse-fill text-white fs-4 me-1"></i>
                <div class="zorin-logo fw-bold" style="font-family: 'Outfit', sans-serif; letter-spacing: 4px; font-size: 1.2rem; color: rgba(255,255,255,0.85); margin-top: 2px;">CUIDAPP</div>
                <i id="settingsBtn" class="bi bi-gear zorin-settings-btn position-absolute" style="right: 40px; cursor: pointer; font-size: 1.15rem; color: rgba(255,255,255,0.6);"></i>
            </div>
        </div>

        <!-- ===================================================================== -->
        <!-- MODAL A: REGISTRO DE NUEVO PACIENTE (LEY 21.120 / LEY 21.430 / LEY 19.628) -->
        <!-- ===================================================================== -->
        <div id="modalRegisterPatient" class="modal fade" tabindex="-1" aria-hidden="true" style="display: none;">
          <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
            <div class="modal-content text-white" style="background: rgba(15, 23, 42, 0.96); backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px); border: 1.5px solid rgba(56, 189, 248, 0.35); border-radius: 24px; box-shadow: 0 25px 60px rgba(0,0,0,0.85);">
              
              <div class="modal-header border-bottom border-light border-opacity-10 p-3.5 p-md-4">
                <div class="d-flex align-items-center gap-3">
                  <div class="rounded-circle d-flex align-items-center justify-content-center shadow" style="width: 52px; height: 52px; background: linear-gradient(135deg, rgba(14, 165, 233, 0.3), rgba(2, 132, 199, 0.5)); border: 2px solid #38bdf8; font-size: 1.6rem;">
                    ✨
                  </div>
                  <div>
                    <h5 class="modal-title fw-bold m-0 text-white" style="font-family: 'Outfit'; font-size: 1.35rem;">Crear Ficha y Registrarme en cuidApp</h5>
                    <small class="text-white-50" style="font-size: 0.88rem;">Registro confidencial y seguro de tu ficha clínica personal</small>
                  </div>
                </div>
                <div class="d-flex align-items-center gap-2">
                  <button type="button" id="btnSpeakRegisterStep" class="btn btn-warning rounded-pill px-3 py-2 fw-bold text-dark d-inline-flex align-items-center gap-2 shadow-sm" style="font-size: 0.95rem; border: 1.5px solid #fbbf24; cursor: pointer;" title="Escuchar instrucciones por voz para personas no lectoras">
                    <span style="font-size: 1.25rem;">🔊</span>
                    <span id="textSpeakRegisterStep">Escuchar paso</span>
                  </button>
                  <button type="button" class="btn-close btn-close-white ms-1" data-bs-dismiss="modal" aria-label="Cerrar" id="btnCloseRegisterModal" style="position: relative; z-index: 1060; cursor: pointer;"></button>
                </div>
              </div>

              <div class="modal-body p-3.5 p-md-4">

                <!-- ASISTENTE DE 3 PASOS: INDICADORES VISUALES -->
                <div class="mb-4 p-2.5 p-md-3 rounded-4" style="background: rgba(255, 255, 255, 0.04); border: 1.5px solid rgba(56, 189, 248, 0.25);">
                  <div class="d-flex justify-content-between align-items-center gap-2">
                    
                    <!-- Indicador Paso 1 -->
                    <div id="stepIndicator1" class="flex-fill text-center p-2 rounded-3" style="background: rgba(14, 165, 233, 0.25); border: 1.5px solid #38bdf8; transition: all 0.2s;">
                      <div class="fw-bold text-info" style="font-size: 0.82rem; letter-spacing: 0.5px;">PASO 1</div>
                      <div class="fw-semibold text-white" style="font-size: 0.95rem;">👤 Identificación</div>
                    </div>

                    <div class="text-white-50 fw-bold" style="font-size: 1.1rem;">➔</div>

                    <!-- Indicador Paso 2 -->
                    <div id="stepIndicator2" class="flex-fill text-center p-2 rounded-3" style="background: rgba(255, 255, 255, 0.05); border: 1.5px solid rgba(255, 255, 255, 0.15); transition: all 0.2s;">
                      <div class="fw-bold text-white-50" style="font-size: 0.82rem; letter-spacing: 0.5px;">PASO 2</div>
                      <div class="fw-semibold text-white-50" style="font-size: 0.95rem;">🩺 Salud y Contacto</div>
                    </div>

                    <div class="text-white-50 fw-bold" style="font-size: 1.1rem;">➔</div>

                    <!-- Indicador Paso 3 -->
                    <div id="stepIndicator3" class="flex-fill text-center p-2 rounded-3" style="background: rgba(255, 255, 255, 0.05); border: 1.5px solid rgba(255, 255, 255, 0.15); transition: all 0.2s;">
                      <div class="fw-bold text-white-50" style="font-size: 0.82rem; letter-spacing: 0.5px;">PASO 3</div>
                      <div class="fw-semibold text-white-50" style="font-size: 0.95rem;">🔒 Cuenta y Acceso</div>
                    </div>

                  </div>
                </div>

                <form id="formRegisterPatient" novalidate autocomplete="off">
                  
                  <!-- ============================================== -->
                  <!-- PASO 1: IDENTIFICACIÓN Y DOCUMENTO -->
                  <!-- ============================================== -->
                  <div id="regStepPane1" class="reg-step-pane">
                    <div class="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom border-light border-opacity-10">
                      <h5 class="fw-bold text-info m-0 d-flex align-items-center gap-2" style="font-size: 1.15rem;">
                        <i class="bi bi-person-badge-fill"></i>
                        <span>Paso 1: Identificación y Documento</span>
                      </h5>
                      <span class="badge rounded-pill px-3 py-1.5" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; font-size: 0.85rem; border: 1px solid rgba(14, 165, 233, 0.3);">Paso 1 de 3</span>
                    </div>

                    <div class="row g-3">
                      <!-- Nombre Completo (según tu documento) -->
                      <div class="col-12">
                        <label class="form-label fw-bold text-white mb-1" style="font-size: 1.02rem;">Nombre Completo (según tu documento) *</label>
                        <input type="text" id="regLegalName" class="form-control text-white" placeholder="Ej. Juan Andrés Díaz Silva" required maxlength="60" autocomplete="off" style="background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.25); border-radius: 12px; font-size: 1.05rem; padding: 0.65rem 1rem;">
                        <small class="text-white-50 d-block mt-1" style="font-size: 0.85rem;">Ingresa tu nombre y dos apellidos tal como aparecen en tu documento oficial (solo letras).</small>
                      </div>

                      <!-- Nombre Social (oculto detrás de botón opcional) -->
                      <div class="col-12">
                        <div id="regSocialNameGroup" class="d-none p-3 rounded-3 mb-2" style="background: rgba(14, 165, 233, 0.08); border: 1.5px dashed rgba(56, 189, 248, 0.4);">
                          <label class="form-label fw-bold text-info mb-1" style="font-size: 1rem;">Nombre Social (opcional)</label>
                          <input type="text" id="regSocialName" class="form-control text-white" placeholder="¿Cómo te gustaría que cuidApp te llame?" maxlength="60" autocomplete="off" style="background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.25); border-radius: 12px; font-size: 1.02rem; padding: 0.65rem 1rem;">
                          <small class="text-info d-block mt-1" style="font-size: 0.85rem;">Será tu nombre prioritario en la aplicación, avisos y recordatorios de salud.</small>
                        </div>
                        <button type="button" id="btnToggleSocialName" class="btn btn-sm btn-outline-info rounded-pill px-3 py-1.5 fw-semibold d-inline-flex align-items-center gap-1.5" style="font-size: 0.92rem; cursor: pointer;">
                          <span>+ Agregar nombre social</span>
                        </button>
                      </div>

                      <!-- Selector de Documento -->
                      <div class="col-md-5">
                        <label class="form-label fw-bold text-white mb-1" style="font-size: 1.02rem;">Tipo de Documento *</label>
                        <select id="regDocType" class="form-select text-white fw-medium" style="background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.25); border-radius: 12px; font-size: 1.02rem; padding: 0.65rem 1rem;">
                          <option value="RUT" class="bg-dark text-white" selected>RUT / RUN Chileno</option>
                          <option value="NIC" class="bg-dark text-white">NIC / NIP Salud (Provisorio)</option>
                          <option value="PASAPORTE" class="bg-dark text-white">Pasaporte / DNI Extranjero</option>
                        </select>
                      </div>

                      <!-- Número de Documento -->
                      <div class="col-md-7">
                        <label class="form-label fw-bold text-white mb-1" id="regDocNumberLabel" style="font-size: 1.02rem;">Número de Documento *</label>
                        <input type="text" id="regRut" class="form-control text-white" placeholder="12.345.678-K" required maxlength="12" autocomplete="off" style="background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.25); border-radius: 12px; font-size: 1.05rem; padding: 0.65rem 1rem;">
                        <small id="regRutFeedback" class="text-white-50 d-block mt-1" style="font-size: 0.85rem;">Validación de formato y dígito verificador Módulo 11.</small>
                      </div>

                      <!-- Fecha de Nacimiento -->
                      <div class="col-md-6">
                        <label class="form-label fw-bold text-white mb-1" style="font-size: 1.02rem;">Fecha de Nacimiento *</label>
                        <input type="date" id="regBirthDate" class="form-control text-white" required autocomplete="off" style="background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.25); border-radius: 12px; font-size: 1.05rem; padding: 0.65rem 1rem;">
                        <div id="regAgeDisplay" class="small fw-bold mt-1 text-info" style="font-size: 0.9rem;">Edad calculada: --</div>
                      </div>

                      <!-- Pronombres -->
                      <div class="col-md-6">
                        <label class="form-label fw-bold text-white mb-1" style="font-size: 1.02rem;">Pronombres de Preferencia *</label>
                        <select id="regPronouns" class="form-select text-white" style="background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.25); border-radius: 12px; font-size: 1.02rem; padding: 0.65rem 1rem;">
                          <option value="Él" class="bg-dark text-white">Él (He/Him)</option>
                          <option value="Ella" class="bg-dark text-white">Ella (She/Her)</option>
                          <option value="Elle" class="bg-dark text-white">Elle (They/Them)</option>
                          <option value="Otro" class="bg-dark text-white">Otro / Prefiero no especificar</option>
                        </select>
                      </div>

                      <!-- País de Origen / Pueblo Originario (Asignación automática de idioma) -->
                      <div class="col-12">
                        <label class="form-label fw-bold text-white mb-1" style="font-size: 1.02rem;">🌎 País de Origen / Pueblo Originario</label>
                        <select id="regCountryOrigin" class="form-select text-white" style="background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.25); border-radius: 12px; font-size: 1.02rem; padding: 0.65rem 1rem;">
                          <option value="Chile" class="bg-dark text-white" selected>🇨🇱 Chile</option>
                          <option value="Haití" class="bg-dark text-white">🇭🇹 Haití (Kreyòl Ayisyen)</option>
                          <option value="Brasil" class="bg-dark text-white">🇧🇷 Brasil (Português)</option>
                          <option value="Estados Unidos / Reino Unido" class="bg-dark text-white">🇺🇸 Estados Unidos / Reino Unido (English)</option>
                          <option value="Pueblo Mapuche" class="bg-dark text-white">🌿 Pueblo Mapuche (Mapuzugun)</option>
                          <option value="Argentina" class="bg-dark text-white">🇦🇷 Argentina</option>
                          <option value="Bolivia" class="bg-dark text-white">🇧🇴 Bolivia</option>
                          <option value="Colombia" class="bg-dark text-white">🇨🇴 Colombia</option>
                          <option value="Ecuador" class="bg-dark text-white">🇪🇨 Ecuador</option>
                          <option value="Perú" class="bg-dark text-white">🇵🇪 Perú</option>
                          <option value="Venezuela" class="bg-dark text-white">🇻🇪 Venezuela</option>
                          <option value="Otro" class="bg-dark text-white">🌐 Otro país / pueblo originario</option>
                        </select>
                        <small class="text-white-50 d-block mt-1" style="font-size: 0.85rem;">Configurará automáticamente el idioma preferente de tu portal clínico.</small>
                      </div>
                    </div>

                    <!-- SECCIÓN DINÁMICA: REPRESENTANTE / TUTOR LEGAL (MENOR DE 18 AÑOS) -->
                    <div id="regTutorSection" class="p-3.5 mt-3 mb-2 rounded-4 d-none" style="background: rgba(168, 85, 247, 0.12); border: 1.5px solid rgba(168, 85, 247, 0.45);">
                      <div class="d-flex align-items-center gap-2 mb-2">
                        <span class="fs-3">👶</span>
                        <div>
                          <strong class="text-white" style="font-size: 1rem;">Representante / Tutor Legal (Menor de 18 años)</strong>
                          <small class="text-white-50 d-block" style="font-size: 0.85rem;">El paciente es menor de edad. Se requiere registrar el tutor legal acreditado para gestionar el portal.</small>
                        </div>
                      </div>

                      <div class="row g-2 mt-1">
                        <div class="col-md-5">
                          <label class="form-label fw-semibold text-white-50 mb-1" style="font-size: 0.92rem;">Nombre Completo del Tutor/a *</label>
                          <input type="text" id="regTutorName" class="form-control text-white" placeholder="Ej. Camila Vergara" maxlength="60" autocomplete="off" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); border-radius: 10px; font-size: 0.98rem;">
                        </div>
                        <div class="col-md-4">
                          <label class="form-label fw-semibold text-white-50 mb-1" style="font-size: 0.92rem;">RUT o Documento del Tutor/a *</label>
                          <input type="text" id="regTutorRut" class="form-control text-white" placeholder="18.940.322-4" maxlength="20" autocomplete="off" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); border-radius: 10px; font-size: 0.98rem;">
                        </div>
                        <div class="col-md-3">
                          <label class="form-label fw-semibold text-white-50 mb-1" style="font-size: 0.92rem;">Vínculo *</label>
                          <select id="regTutorRelation" class="form-select text-white" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); border-radius: 10px; font-size: 0.98rem;">
                            <option value="Madre" class="bg-dark text-white">Madre</option>
                            <option value="Padre" class="bg-dark text-white">Padre</option>
                            <option value="Tutor Legal Acreditado" class="bg-dark text-white">Tutor Legal Acreditado</option>
                            <option value="Abuelo/a" class="bg-dark text-white">Abuelo/a</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <!-- SECCIÓN SENIOR: AVISO ACCESIBILIDAD (≥ 60 AÑOS) -->
                    <div id="regSeniorNotice" class="p-3 mt-3 mb-2 rounded-4 d-none" style="background: rgba(14, 165, 233, 0.12); border: 1.5px solid rgba(14, 165, 233, 0.45);">
                      <div class="d-flex align-items-center gap-3">
                        <span class="fs-2">👴</span>
                        <div>
                          <strong class="text-info" style="font-size: 1.05rem;">Atención Preferente Adulto Mayor (≥ 60 años)</strong>
                          <p class="text-white-50 m-0" style="font-size: 0.88rem;">Tu portal se configurará con asistencia por voz automática, botones más grandes y texto de alto contraste para tu comodidad.</p>
                        </div>
                      </div>
                    </div>

                    <!-- Botones de Navegación Paso 1 -->
                    <div class="d-flex justify-content-between align-items-center gap-2 pt-4 mt-3 border-top border-light border-opacity-10">
                      <button type="button" id="btnCancelRegister" class="btn btn-outline-light px-4 py-2.5 rounded-pill fw-bold" data-bs-dismiss="modal" style="font-size: 1rem; position: relative; z-index: 1060; cursor: pointer;">
                        Cancelar
                      </button>
                      <button type="button" id="btnNextStep1" class="btn btn-primary px-4 py-2.5 rounded-pill fw-bold shadow-lg d-inline-flex align-items-center gap-2" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border: 1.5px solid #38bdf8; font-size: 1.05rem; cursor: pointer;">
                        <span>Siguiente: Salud y Contacto</span>
                        <i class="bi bi-arrow-right"></i>
                      </button>
                    </div>
                  </div>

                  <!-- ============================================== -->
                  <!-- PASO 2: DATOS CLÍNICOS, SALUD Y CONTACTO -->
                  <!-- ============================================== -->
                  <div id="regStepPane2" class="reg-step-pane d-none">
                    <div class="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom border-light border-opacity-10">
                      <h5 class="fw-bold text-info m-0 d-flex align-items-center gap-2" style="font-size: 1.15rem;">
                        <i class="bi bi-heart-pulse-fill"></i>
                        <span>Paso 2: Datos de Salud y Contacto</span>
                      </h5>
                      <span class="badge rounded-pill px-3 py-1.5" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; font-size: 0.85rem; border: 1px solid rgba(14, 165, 233, 0.3);">Paso 2 de 3</span>
                    </div>

                    <div class="row g-3">
                      <!-- Teléfono de Contacto (sin Tipo de Teléfono) -->
                      <div class="col-md-6">
                        <label class="form-label fw-bold text-white mb-1" style="font-size: 1.02rem;">Teléfono de Contacto *</label>
                        <input type="tel" id="regPhone" class="form-control text-white" placeholder="+56912345678" required maxlength="12" autocomplete="off" style="background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.25); border-radius: 12px; font-size: 1.05rem; padding: 0.65rem 1rem;">
                        <small class="text-white-50 d-block mt-1" style="font-size: 0.85rem;">Ingresa + y hasta 11 dígitos para recordatorios y avisos clínicos.</small>
                      </div>

                      <!-- Sexo Biológico -->
                      <div class="col-md-6">
                        <label class="form-label fw-bold text-white mb-1" style="font-size: 1.02rem;">Sexo Biológico *</label>
                        <select id="regBioSex" class="form-select text-white" style="background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.25); border-radius: 12px; font-size: 1.02rem; padding: 0.65rem 1rem;">
                          <option value="Femenino" class="bg-dark text-white">Femenino</option>
                          <option value="Masculino" class="bg-dark text-white">Masculino</option>
                          <option value="Intersexual" class="bg-dark text-white">Intersexual</option>
                        </select>
                      </div>

                      <!-- Grupo Sanguíneo -->
                      <div class="col-md-6">
                        <label class="form-label fw-bold text-white mb-1" style="font-size: 1.02rem;">Grupo Sanguíneo *</label>
                        <select id="regBloodType" class="form-select text-white" style="background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.25); border-radius: 12px; font-size: 1.02rem; padding: 0.65rem 1rem;">
                          <option value="O+" class="bg-dark text-white">O+</option>
                          <option value="O-" class="bg-dark text-white">O-</option>
                          <option value="A+" class="bg-dark text-white">A+</option>
                          <option value="A-" class="bg-dark text-white">A-</option>
                          <option value="B+" class="bg-dark text-white">B+</option>
                          <option value="B-" class="bg-dark text-white">B-</option>
                          <option value="AB+" class="bg-dark text-white">AB+</option>
                          <option value="AB-" class="bg-dark text-white">AB-</option>
                        </select>
                      </div>

                      <!-- Previsión de Salud -->
                      <div class="col-md-6">
                        <label class="form-label fw-bold text-white mb-1" style="font-size: 1.02rem;">Previsión de Salud *</label>
                        <select id="regPrevision" class="form-select text-white" style="background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.25); border-radius: 12px; font-size: 1.02rem; padding: 0.65rem 1rem;">
                          <option value="FONASA Tramo A" class="bg-dark text-white">FONASA Tramo A (Gratuidad)</option>
                          <option value="FONASA Tramo B" class="bg-dark text-white" selected>FONASA Tramo B</option>
                          <option value="FONASA Tramo C" class="bg-dark text-white">FONASA Tramo C</option>
                          <option value="FONASA Tramo D" class="bg-dark text-white">FONASA Tramo D</option>
                          <option value="ISAPRE Banmédica" class="bg-dark text-white">ISAPRE Banmédica</option>
                          <option value="ISAPRE Colmena" class="bg-dark text-white">ISAPRE Colmena</option>
                          <option value="ISAPRE Consalud" class="bg-dark text-white">ISAPRE Consalud</option>
                          <option value="ISAPRE CruzBlanca" class="bg-dark text-white">ISAPRE CruzBlanca</option>
                          <option value="ISAPRE Nueva Masvida" class="bg-dark text-white">ISAPRE Nueva Masvida</option>
                          <option value="Particular / Otro" class="bg-dark text-white">Particular / Otro</option>
                        </select>
                      </div>

                      <!-- Idioma Preferente de la Ficha -->
                      <div class="col-md-6">
                        <label class="form-label fw-bold text-white mb-1" style="font-size: 1.02rem;">🌐 Idioma de tu Ficha</label>
                        <select id="regLanguage" class="form-select text-white" style="background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.25); border-radius: 12px; font-size: 1.02rem; padding: 0.65rem 1rem;">
                          <option value="es" class="bg-dark text-white" selected>🇨🇱 Español</option>
                          <option value="ht" class="bg-dark text-white">🇭🇹 Kreyòl Ayisyen</option>
                          <option value="pt" class="bg-dark text-white">🇧🇷 Português</option>
                          <option value="en" class="bg-dark text-white">🇺🇸 English</option>
                          <option value="arn" class="bg-dark text-white">🌿 Mapuzugun</option>
                        </select>
                      </div>

                      <!-- Alergias Conocidas -->
                      <div class="col-12">
                        <label class="form-label fw-bold text-white mb-1" style="font-size: 1.02rem;">Alergias Conocidas</label>
                        <input type="text" id="regAllergies" class="form-control text-white" placeholder="Ej. Penicilina, Mariscos, o Ninguna..." value="Ninguna" maxlength="120" autocomplete="off" style="background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.25); border-radius: 12px; font-size: 1.05rem; padding: 0.65rem 1rem;">
                      </div>

                      <!-- Condiciones de Salud Declaradas (sin menciones a leyes) -->
                      <div class="col-12 mt-2">
                        <label class="form-label fw-bold text-white mb-1 d-flex justify-content-between align-items-center">
                          <span style="font-size: 1.02rem;">Condiciones de Salud o Movilidad (Opcional)</span>
                          <span class="text-info" style="font-size: 0.85rem;">Toca para marcar o desmarcar</span>
                        </label>
                        <div class="d-flex flex-wrap gap-2 mb-2" id="regConditionBadges">
                          <button type="button" class="btn btn-sm text-white px-3 py-1.5 rounded-pill condition-toggle-btn border border-light border-opacity-25" data-val="HYPERTENSION" style="background: rgba(255,255,255,0.06); font-size: 0.9rem;">🫀 Hipertensión</button>
                          <button type="button" class="btn btn-sm text-white px-3 py-1.5 rounded-pill condition-toggle-btn border border-light border-opacity-25" data-val="DIABETES" style="background: rgba(255,255,255,0.06); font-size: 0.9rem;">🩸 Diabetes</button>
                          <button type="button" class="btn btn-sm text-white px-3 py-1.5 rounded-pill condition-toggle-btn border border-light border-opacity-25" data-val="EPOC" style="background: rgba(255,255,255,0.06); font-size: 0.9rem;">🫁 Asma / EPOC</button>
                          <button type="button" class="btn btn-sm text-white px-3 py-1.5 rounded-pill condition-toggle-btn border border-light border-opacity-25" data-val="ONCOLOGIA" style="background: rgba(255,255,255,0.06); font-size: 0.9rem;">🎗️ Oncología</button>
                          <button type="button" class="btn btn-sm text-white px-3 py-1.5 rounded-pill condition-toggle-btn border border-light border-opacity-25" data-val="MOVILIDAD_REDUCIDA" style="background: rgba(255,255,255,0.06); font-size: 0.9rem;">♿ Movilidad Reducida</button>
                          <button type="button" class="btn btn-sm text-white px-3 py-1.5 rounded-pill condition-toggle-btn border border-light border-opacity-25" data-val="TEA" style="background: rgba(255,255,255,0.06); font-size: 0.9rem;">🧩 TEA</button>
                          <button type="button" class="btn btn-sm text-white px-3 py-1.5 rounded-pill condition-toggle-btn border border-light border-opacity-25" data-val="ERC" style="background: rgba(255,255,255,0.06); font-size: 0.9rem;">🧪 Enfermedad Renal</button>
                        </div>
                        <input type="text" id="regCustomConditions" class="form-control text-white" placeholder="Otras condiciones médicas o necesidades especiales..." maxlength="120" autocomplete="off" style="background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.25); border-radius: 12px; font-size: 1rem; padding: 0.65rem 1rem;">
                      </div>
                    </div>

                    <!-- SECCIÓN DINÁMICA: PERSONAS A CARGO (ADULTOS >= 18 AÑOS) -->
                    <div id="regChildrenSection" class="p-3.5 mt-3 mb-2 rounded-4 d-none" style="background: rgba(14, 165, 233, 0.08); border: 1.5px solid rgba(56, 189, 248, 0.35);">
                      <div class="d-flex align-items-center justify-content-between mb-2">
                        <div class="d-flex align-items-center gap-2">
                          <span class="fs-3">👨‍👩‍👧‍👦</span>
                          <div>
                            <strong class="text-white" style="font-size: 1rem;">¿Tienes personas a tu cargo?</strong>
                            <small class="text-white-50 d-block" style="font-size: 0.85rem;">Vincula y gestiona las fichas clínicas de niños, adolescentes, adultos asistidos o adultos mayores bajo tu cuidado.</small>
                          </div>
                        </div>
                        <button type="button" id="btnAddChildForm" class="btn btn-sm btn-outline-info rounded-pill px-3 py-1.5 d-inline-flex align-items-center gap-1.5 fw-semibold" style="font-size: 0.9rem; cursor: pointer;">
                          <i class="bi bi-plus-circle-fill"></i>
                          <span>+ Agregar Persona a Cargo</span>
                        </button>
                      </div>

                      <div id="regChildrenList" class="d-flex flex-column gap-2 mt-2">
                        <!-- Lista dinámica de personas a cargo agregadas -->
                      </div>
                    </div>

                    <!-- Botones de Navegación Paso 2 -->
                    <div class="d-flex justify-content-between align-items-center gap-2 pt-4 mt-3 border-top border-light border-opacity-10">
                      <button type="button" id="btnPrevStep2" class="btn btn-outline-light px-4 py-2.5 rounded-pill fw-bold d-inline-flex align-items-center gap-2" style="font-size: 1rem; cursor: pointer;">
                        <i class="bi bi-arrow-left"></i>
                        <span>Paso Anterior</span>
                      </button>
                      <button type="button" id="btnNextStep2" class="btn btn-primary px-4 py-2.5 rounded-pill fw-bold shadow-lg d-inline-flex align-items-center gap-2" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border: 1.5px solid #38bdf8; font-size: 1.05rem; cursor: pointer;">
                        <span>Siguiente: Cuenta y Acceso</span>
                        <i class="bi bi-arrow-right"></i>
                      </button>
                    </div>
                  </div>

                  <!-- ============================================== -->
                  <!-- PASO 3: CREDENCIALES DE ACCESO Y CONFIRMACIÓN -->
                  <!-- ============================================== -->
                  <div id="regStepPane3" class="reg-step-pane d-none">
                    <div class="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom border-light border-opacity-10">
                      <h5 class="fw-bold text-info m-0 d-flex align-items-center gap-2" style="font-size: 1.15rem;">
                        <i class="bi bi-shield-lock-fill"></i>
                        <span>Paso 3: Credenciales de Acceso y Confirmación</span>
                      </h5>
                      <span class="badge rounded-pill px-3 py-1.5" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; font-size: 0.85rem; border: 1px solid rgba(14, 165, 233, 0.3);">Paso 3 de 3</span>
                    </div>

                    <!-- Resumen amigable previo a confirmar -->
                    <div id="regStep3Summary" class="p-3 mb-3 rounded-4" style="background: rgba(56, 189, 248, 0.08); border: 1.5px solid rgba(56, 189, 248, 0.3);">
                      <div class="d-flex align-items-center gap-2 mb-1.5">
                        <span class="text-info fs-5">📋</span>
                        <strong class="text-white" style="font-size: 0.98rem;">Resumen de tu Ficha:</strong>
                      </div>
                      <div class="row g-2 text-white-50" style="font-size: 0.9rem;">
                        <div class="col-sm-6"><strong>Nombre:</strong> <span id="summaryRegName" class="text-white">-</span></div>
                        <div class="col-sm-6"><strong>Documento:</strong> <span id="summaryRegDoc" class="text-white">-</span></div>
                        <div class="col-sm-6"><strong>Teléfono:</strong> <span id="summaryRegPhone" class="text-white">-</span></div>
                        <div class="col-sm-6"><strong>Previsión:</strong> <span id="summaryRegPrevision" class="text-white">-</span></div>
                      </div>
                    </div>

                    <div class="row g-3">
                      <!-- Nombre de Usuario -->
                      <div class="col-12">
                        <label class="form-label fw-bold text-white mb-1" style="font-size: 1.02rem;">Nombre de Usuario *</label>
                        <input type="text" id="regUsername" class="form-control text-white" placeholder="Ej. juanito2026" required maxlength="25" autocomplete="off" style="background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.25); border-radius: 12px; font-size: 1.05rem; padding: 0.65rem 1rem;">
                        <small class="text-white-50 d-block mt-1" style="font-size: 0.85rem;">Este nombre de usuario y tu contraseña te servirán para iniciar sesión en la plataforma.</small>
                      </div>

                      <!-- Contraseña -->
                      <div class="col-md-6">
                        <label class="form-label fw-bold text-white mb-1" style="font-size: 1.02rem;">Contraseña *</label>
                        <input type="password" id="regPassword" class="form-control text-white" placeholder="Mínimo 4 caracteres" required minlength="4" maxlength="25" autocomplete="off" style="background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.25); border-radius: 12px; font-size: 1.05rem; padding: 0.65rem 1rem;">
                      </div>

                      <!-- Confirmar Contraseña -->
                      <div class="col-md-6">
                        <label class="form-label fw-bold text-white mb-1" style="font-size: 1.02rem;">Confirmar Contraseña *</label>
                        <input type="password" id="regPasswordConfirm" class="form-control text-white" placeholder="Repite tu contraseña" required minlength="4" maxlength="25" autocomplete="off" style="background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.25); border-radius: 12px; font-size: 1.05rem; padding: 0.65rem 1rem;">
                      </div>
                    </div>

                    <!-- CONSENTIMIENTO INFORMADO -->
                    <div class="p-3 mt-4 mb-3 rounded-4" style="background: rgba(255,255,255,0.03); border: 1px dashed rgba(255,255,255,0.2);">
                      <div class="form-check d-flex align-items-start gap-2.5">
                        <input class="form-check-input mt-1" type="checkbox" id="regConsent" required style="cursor: pointer; width: 1.35rem; height: 1.35rem; border-color: rgba(56, 189, 248, 0.5);">
                        <label class="form-check-label text-white" for="regConsent" style="font-size: 0.92rem; line-height: 1.55; cursor: pointer;">
                          <strong>Autorización y Consentimiento Legal:</strong> De conformidad con la Ley N° 19.628 (Protección de Datos Personales), Ley N° 20.584 (Derechos y Deberes del Paciente), Ley N° 21.120 (Identidad de Género) y Decreto N° 67, autorizo el resguardo confidencial y portabilidad de mis registros clínicos. Declaro comprender que cuidApp es una herramienta de monitoreo y portabilidad de información de salud, y NO realiza diagnósticos médicos ni reemplaza la atención profesional.
                        </label>
                      </div>
                    </div>

                    <!-- Botones de Navegación Paso 3 -->
                    <div class="d-flex justify-content-between align-items-center gap-2 pt-3 mt-3 border-top border-light border-opacity-10">
                      <button type="button" id="btnPrevStep3" class="btn btn-outline-light px-4 py-2.5 rounded-pill fw-bold d-inline-flex align-items-center gap-2" style="font-size: 1rem; cursor: pointer;">
                        <i class="bi bi-arrow-left"></i>
                        <span>Paso Anterior</span>
                      </button>
                      <button type="submit" id="btnSubmitRegister" class="btn btn-success px-4 py-2.5 rounded-pill fw-bold shadow-lg d-inline-flex align-items-center gap-2" style="background: linear-gradient(135deg, #059669 0%, #047857 100%); border: 1.5px solid #34d399; font-size: 1.05rem; cursor: pointer;">
                        <i class="bi bi-check-circle-fill"></i>
                        <span>Crear Ficha y Registrarme</span>
                      </button>
                    </div>
                  </div>

                </form>
              </div>

            </div>
          </div>
        </div>

        <!-- ===================================================================== -->
        <!-- MODAL B: RECUPERACIÓN SEGURA Y ACCESIBLE (LEY 19.628 / DS N° 41) -->
        <!-- ===================================================================== -->
        <div id="modalPasswordRecovery" class="modal fade" tabindex="-1" aria-hidden="true" style="display: none;">
          <div class="modal-dialog modal-dialog-centered modal-md">
            <div class="modal-content text-white" style="background: rgba(15, 23, 42, 0.96); backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px); border: 1.5px solid rgba(245, 158, 11, 0.4); border-radius: 24px; box-shadow: 0 25px 60px rgba(0,0,0,0.85);">
              
              <div class="modal-header border-bottom border-light border-opacity-10 p-4">
                <div class="d-flex align-items-center gap-3">
                  <div class="rounded-circle d-flex align-items-center justify-content-center shadow" style="width: 50px; height: 50px; background: linear-gradient(135deg, rgba(245, 158, 11, 0.3), rgba(217, 119, 6, 0.5)); border: 2px solid #fbbf24; font-size: 1.5rem;">
                    🔑
                  </div>
                  <div>
                    <h5 class="modal-title fw-bold m-0 text-white" style="font-family: 'Outfit'; font-size: 1.25rem;">Recuperación Segura de Contraseña</h5>
                    <small class="text-white-50" style="font-size: 0.74rem;">Protección de Datos Sensibles (Ley N° 19.628 / DS N° 41)</small>
                  </div>
                </div>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar" id="btnCloseRecoveryModal"></button>
              </div>

              <div class="modal-body p-4">

                <!-- PASO 1: VALIDACIÓN DE IDENTIDAD POR RUT + NACIMIENTO -->
                <div id="recoveryStep1">
                  <p class="text-white-50 small mb-3">
                    Ingresa tu RUT chileno y fecha de nacimiento registrada para validar tu identidad de forma confidencial.
                  </p>

                  <div class="mb-3">
                    <label class="form-label small text-white-50 mb-1">RUT Chileno *</label>
                    <input type="text" id="recRut" class="form-control text-white" placeholder="10.420.932-K" maxlength="12" style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.18); border-radius: 12px; font-size: 0.95rem;">
                  </div>

                  <div class="mb-3">
                    <label class="form-label small text-white-50 mb-1">Fecha de Nacimiento *</label>
                    <input type="date" id="recBirthDate" class="form-control text-white" style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.18); border-radius: 12px; font-size: 0.95rem;">
                  </div>

                  <div class="p-2.5 rounded-3 mb-3 text-white-50" style="background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); font-size: 0.72rem;">
                    💡 <em>Cuentas de demostración disponibles:</em><br>
                    &bull; <strong>Juan Díaz:</strong> <code>10.420.932-K</code> &bull; Nacimiento: <code>1950-05-14</code><br>
                    &bull; <strong>Mateo Morales:</strong> <code>25.340.112-9</code> &bull; Nacimiento: <code>2019-03-22</code><br>
                    &bull; <strong>Sofía Díaz:</strong> <code>15.782.110-3</code> &bull; Nacimiento: <code>1985-04-18</code>
                  </div>

                  <button type="button" id="btnVerifyIdentity" class="btn btn-warning w-100 py-2.5 rounded-pill fw-bold text-dark d-inline-flex align-items-center justify-content-center gap-2 shadow" style="font-size: 0.92rem;">
                    <i class="bi bi-shield-lock-fill"></i>
                    <span>Verificar Identidad</span>
                  </button>
                </div>

                <!-- PASO 2: CANAL INCLUSIVO DE VERIFICACIÓN Y NUEVA CLAVE -->
                <div id="recoveryStep2" class="d-none">
                  
                  <div class="p-3 mb-3 rounded-3" style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.35);">
                    <div class="d-flex align-items-center gap-2">
                      <i class="bi bi-check-circle-fill text-success fs-5"></i>
                      <div>
                        <strong class="text-white" id="recVerifiedUserName">Usuario Identificado</strong>
                        <small class="text-white-50 d-block" id="recVerifiedUserRut" style="font-size: 0.74rem;">RUT Validado</small>
                      </div>
                    </div>
                  </div>

                  <label class="form-label small text-white-50 mb-2 fw-semibold">Selecciona Canal Inclusivo de Verificación:</label>
                  
                  <!-- 3 CANALES INCLUSIVOS -->
                  <div class="d-flex flex-column gap-2 mb-3">
                    
                    <!-- Canal 1: Correo / SMS -->
                    <button type="button" class="btn btn-glass-secondary text-start p-2.5 rounded-3 d-flex align-items-center justify-content-between text-white btn-channel-select active" id="btnChannelSms" style="border: 1.5px solid #38bdf8; background: rgba(14, 165, 233, 0.15);">
                      <div class="d-flex align-items-center gap-2.5">
                        <span class="fs-5">📧</span>
                        <div>
                          <strong class="d-block text-white" style="font-size: 0.85rem;">Código por Correo / SMS</strong>
                          <small class="text-white-50" style="font-size: 0.72rem;">Envío simulado en pantalla con código de 6 dígitos</small>
                        </div>
                      </div>
                      <i class="bi bi-check2-circle text-info fs-5"></i>
                    </button>

                    <!-- Canal 2: Llamada IVR de Voz -->
                    <button type="button" class="btn btn-glass-secondary text-start p-2.5 rounded-3 d-flex align-items-center justify-content-between text-white btn-channel-select" id="btnChannelVoice" style="border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.03);">
                      <div class="d-flex align-items-center gap-2.5">
                        <span class="fs-5">📞</span>
                        <div>
                          <strong class="d-block text-white" style="font-size: 0.85rem;">Llamada Telefónica de Voz (IVR)</strong>
                          <small class="text-white-50" style="font-size: 0.72rem;">Accesible para teléfonos fijos/básicos (dictado por voz)</small>
                        </div>
                      </div>
                      <i class="bi bi-volume-up-fill text-success fs-5"></i>
                    </button>

                    <!-- Canal 3: Asistencia de Cuidador/Tutor -->
                    <button type="button" class="btn btn-glass-secondary text-start p-2.5 rounded-3 d-flex align-items-center justify-content-between text-white btn-channel-select" id="btnChannelTutor" style="border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.03);">
                      <div class="d-flex align-items-center gap-2.5">
                        <span class="fs-5">🛡️</span>
                        <div>
                          <strong class="d-block text-white" style="font-size: 0.85rem;">Asistencia Cuidador / Tutor Autorizado</strong>
                          <small class="text-white-50" style="font-size: 0.72rem;">Desbloqueo asistido bajo Ley N° 20.584</small>
                        </div>
                      </div>
                      <i class="bi bi-shield-check text-warning fs-5"></i>
                    </button>
                  </div>

                  <!-- Mensaje dinámico del canal activo con código OTP -->
                  <div id="recChannelFeedback" class="p-3 mb-3 rounded-3 text-center" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(56, 189, 248, 0.3);">
                    <small class="text-white-50 d-block mb-1">Código de verificación generado (6 dígitos):</small>
                    <div id="recOtpCodeDisplay" class="fs-2 fw-bold font-monospace text-info letter-spacing-2">------</div>
                    <small id="recChannelSubtext" class="text-white-50 d-block mt-1" style="font-size: 0.72rem;">Ingresa este código a continuación.</small>
                  </div>

                  <!-- FORMULARIO DE RESTABLECIMIENTO -->
                  <form id="formResetPassword">
                    <div class="mb-3">
                      <label class="form-label small text-white-50 mb-1">Ingresa el Código OTP (6 dígitos) *</label>
                      <input type="text" id="recOtpInput" class="form-control text-center text-white font-monospace fw-bold fs-5" maxlength="6" placeholder="000000" required style="background: rgba(255,255,255,0.08); border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: 12px; letter-spacing: 4px;">
                    </div>

                    <div class="row g-2 mb-3">
                      <div class="col-6">
                        <label class="form-label small text-white-50 mb-1">Nueva Clave *</label>
                        <input type="password" id="recNewPassword" class="form-control text-white" placeholder="Mínimo 4 caracteres" required minlength="4" style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.18); border-radius: 12px; font-size: 0.9rem;">
                      </div>
                      <div class="col-6">
                        <label class="form-label small text-white-50 mb-1">Confirmar Clave *</label>
                        <input type="password" id="recConfirmPassword" class="form-control text-white" placeholder="Repite la clave" required minlength="4" style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.18); border-radius: 12px; font-size: 0.9rem;">
                      </div>
                    </div>

                    <button type="submit" id="btnSaveNewPassword" class="btn btn-success w-100 py-2.5 rounded-pill fw-bold shadow-lg d-inline-flex align-items-center justify-content-center gap-2" style="font-size: 0.92rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: 1.5px solid #34d399;">
                      <i class="bi bi-check2-circle"></i>
                      <span>Guardar Nueva Contraseña e Iniciar Sesión</span>
                    </button>
                  </form>

                </div>

              </div>

            </div>
          </div>
        </div>

    </section>
  `;

  bindLoginEvents();
}

// --- VINCULACIÓN DE EVENTOS DEL LOGIN & MODALES ---
export function bindLoginEvents() {
  // Alternar Modo Día / Modo Noche desde la pantalla principal de Login
  const loginThemeBtn = document.getElementById('loginThemeToggleBtn');
  if (loginThemeBtn) {
    loginThemeBtn.onclick = () => {
      const isCurrentlyLight = document.body.classList.contains('cuidapp-theme-light');
      const newTheme = isCurrentlyLight ? 'dark' : 'light';
      if (newTheme === 'light') {
        document.body.classList.add('cuidapp-theme-light');
      } else {
        document.body.classList.remove('cuidapp-theme-light');
      }
      localStorage.setItem('cuidapp_theme', newTheme);
      const icon = document.getElementById('loginThemeIcon');
      const text = document.getElementById('loginThemeText');
      if (icon) icon.textContent = newTheme === 'light' ? '🌙' : '☀️';
      if (text) text.textContent = newTheme === 'light' ? 'Modo Noche' : 'Modo Día';
    };
  }

  const usernameInput = document.getElementById('zorinUsername');
  const greetingEl = document.getElementById('zorinGreeting');
  const stepUser = document.getElementById('loginStepUsername');
  const stepPass = document.getElementById('loginStepPassword');
  const formUsername = document.getElementById('formUsername');
  const formPassword = document.getElementById('formPassword');
  const btnBackToUser = document.getElementById('btnBackToUser');
  const togglePasswordVisibility = document.getElementById('togglePasswordVisibility');
  const passwordInput = document.getElementById('zorinPassword');
  const eyeIcon = document.getElementById('passwordEyeIcon');
  const settingsBtn = document.getElementById('settingsBtn');

  function updateZorinGreeting(newText) {
    if (greetingEl) {
      greetingEl.style.transition = 'opacity 0.2s ease, transform 0.2s cubic-bezier(.34,1.56,.64,1)';
      greetingEl.style.opacity = '0';
      greetingEl.style.transform = 'translateY(-8px) scale(0.9)';

      setTimeout(() => {
        greetingEl.textContent = newText;
        greetingEl.style.opacity = '1';
        greetingEl.style.transform = 'translateY(0) scale(1)';
      }, 200);
    }
  }

  function goToPasswordStep() {
    const rawInput = usernameInput.value.trim();
    if (!rawInput) {
      window.showGlassAlert('Por favor, ingresa tu usuario o número de documento.', 'warning');
      return;
    }

    const lower = rawInput.toLowerCase();
    const cleanDoc = rawInput.replace(/[\.\-\s]/g, '').toUpperCase();
    let displayName = rawInput;

    const demoRutToName = {
      '241189025': 'Camila Soto',
      '189403224': 'Valentina Rojas',
      '194508123': 'Daniela Morales',
      '123456789': 'Juan Díaz',
      '261104508': 'Lucas Rojas'
    };

    if (NATIVE_DEMO_CREDENTIALS[lower]) {
      displayName = NATIVE_DEMO_CREDENTIALS[lower].name;
    } else if (demoRutToName[cleanDoc]) {
      displayName = demoRutToName[cleanDoc];
    } else {
      const p = PATIENTS_DATABASE.find(item => 
        (item.username && item.username.toLowerCase() === lower) ||
        (item.rut && item.rut.replace(/[\.\-\s]/g, '').toUpperCase() === cleanDoc) ||
        (item.documentNumber && item.documentNumber.replace(/[\.\-\s]/g, '').toUpperCase() === cleanDoc)
      );
      if (p) {
        displayName = p.socialName || p.name || p.username;
      } else {
        const c = CAREGIVERS_DATABASE.find(item =>
          (item.username && item.username.toLowerCase() === lower) ||
          (item.rut && item.rut.replace(/[\.\-\s]/g, '').toUpperCase() === cleanDoc)
        );
        if (c) {
          displayName = c.name || c.username;
        } else {
          try {
            const rawCustom = localStorage.getItem('cuidapp_custom_users');
            if (rawCustom) {
              const uList = JSON.parse(rawCustom);
              const cu = uList.find(item =>
                (item.username && item.username.toLowerCase() === lower) ||
                (item.rut && item.rut.replace(/[\.\-\s]/g, '').toUpperCase() === cleanDoc) ||
                (item.documentNumber && item.documentNumber.replace(/[\.\-\s]/g, '').toUpperCase() === cleanDoc)
              );
              if (cu) {
                displayName = cu.socialName || cu.name || cu.username;
              }
            }
          } catch (e) {}
        }
      }
    }

    updateZorinGreeting(`¡Hola ${displayName}!`);
    stepUser.classList.add('d-none');
    stepPass.classList.remove('d-none');

    setTimeout(() => {
      passwordInput.focus();
    }, 100);
  }

  function goToUsernameStep() {
    updateZorinGreeting('¿Hola?');
    stepPass.classList.add('d-none');
    stepUser.classList.remove('d-none');

    setTimeout(() => {
      usernameInput.focus();
    }, 100);
  }

  if (formUsername) {
    formUsername.addEventListener('submit', (e) => {
      e.preventDefault();
      goToPasswordStep();
    });
  }

  if (btnBackToUser) {
    btnBackToUser.addEventListener('click', goToUsernameStep);
  }

  if (togglePasswordVisibility && passwordInput && eyeIcon) {
    togglePasswordVisibility.addEventListener('click', () => {
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.classList.remove('bi-eye');
        eyeIcon.classList.add('bi-eye-slash');
      } else {
        passwordInput.type = 'password';
        eyeIcon.classList.remove('bi-eye-slash');
        eyeIcon.classList.add('bi-eye');
      }
    });
  }

  if (formPassword) {
    formPassword.addEventListener('submit', (e) => {
      e.preventDefault();
      submitZorinLogin();
    });
  }

  // BOTONES DE ACCESO RÁPIDO DEMO (1-CLICK LOGIN)
  document.querySelectorAll('.btn-quick-login').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const u = (btn.dataset.user || '').trim().toLowerCase();
      const p = (NATIVE_DEMO_CREDENTIALS[u] && NATIVE_DEMO_CREDENTIALS[u].password) || btn.dataset.pass || '1234';
      if (usernameInput && passwordInput) {
        usernameInput.value = u;
        passwordInput.value = p;
        updateZorinGreeting(`¡Hola ${u}!`);
        submitZorinLogin();
      }
    });
  });

  function submitZorinLogin() {
    const rawInput = (usernameInput.value || '').trim();
    const user = rawInput.toLowerCase();
    const cleanDoc = rawInput.replace(/[\.\-\s]/g, '').toUpperCase();
    const pass = (passwordInput.value || '').trim();
    const centerForm = document.querySelector('.zorin-center-login');

    let overrides = {};
    try {
      const raw = localStorage.getItem('cuidapp_password_overrides');
      if (raw) overrides = JSON.parse(raw);
    } catch (e) {}

    let userStatus = {};
    try {
      const rawStatus = localStorage.getItem('cuidapp_user_status');
      if (rawStatus) userStatus = JSON.parse(rawStatus);
    } catch (e) {}

    // Mapeo de RUTs conocidos a perfiles demo para permitir ingreso por RUT o usuario
    const demoRutToUser = {
      '241189025': 'camila',
      '189403224': 'valentina',
      '194508123': 'daniela',
      '123456789': 'juan',
      '261104508': 'lucas'
    };

    const effectiveDemoUser = NATIVE_DEMO_CREDENTIALS[user] ? user : demoRutToUser[cleanDoc];

    if (user !== 'admin' && (userStatus[user] === 'suspended' || (effectiveDemoUser && userStatus[effectiveDemoUser] === 'suspended'))) {
      window.showGlassAlert('Acceso bloqueado: Perfil suspendido por administración (Ley N° 20.584 / DS N° 41).', 'danger');
      if (centerForm) {
        centerForm.classList.add('shake-error');
        setTimeout(() => centerForm.classList.remove('shake-error'), 600);
      }
      return;
    }

    const logSessionAccess = (username, role, name) => {
      try {
        const raw = localStorage.getItem('cuidapp_session_log');
        const logs = raw ? JSON.parse(raw) : [];
        logs.unshift({
          id: 'sess_' + Date.now(),
          timestamp: new Date().toISOString(),
          user: username,
          role: role,
          name: name,
          ip: '192.168.1.42 (Red Asistencial)',
          status: 'AUTORIZADO',
          legalSeal: 'DS N° 41 / Ley 19.628 Control de Acceso'
        });
        if (logs.length > 50) logs.pop();
        localStorage.setItem('cuidapp_session_log', JSON.stringify(logs));
      } catch (e) {}
    };

    // 1. Verificación directa contra el objeto de credenciales nativas demo (por username o RUT)
    if (effectiveDemoUser && NATIVE_DEMO_CREDENTIALS[effectiveDemoUser]) {
      const nativeCred = NATIVE_DEMO_CREDENTIALS[effectiveDemoUser];
      const effectivePass = overrides[effectiveDemoUser] || overrides[user] || nativeCred.password;
      const isDemoMatch = 
        pass === effectivePass || 
        pass === nativeCred.password ||
        (effectiveDemoUser === 'camila' && (pass === '1234' || pass === 'camila1234')) ||
        (effectiveDemoUser === 'valentina' && (pass === '1234' || pass === 'valentina1234')) ||
        (effectiveDemoUser === 'daniela' && (pass === '1234' || pass === 'daniela1234'));

      if (isDemoMatch) {
        if (stepPass) stepPass.classList.add('d-none');
        updateZorinGreeting('Acceso Concedido');

        if (nativeCred.role === 'admin') {
          logSessionAccess('admin', 'admin', nativeCred.name);
          window.showGlassAlert('¡Acceso concedido a cuidApp (Admin)!', 'success');
          handleLoginSuccess({ role: 'admin' });
          return;
        }

        if (nativeCred.role === 'doctor') {
          logSessionAccess('doctor', 'medico', nativeCred.name);
          window.showGlassAlert('¡Bienvenido/a, Dra. Elena Valdés!', 'success');
          handleLoginSuccess({ role: 'doctor' });
          return;
        }

        if (nativeCred.role === 'caregiver') {
          const caregiver = CAREGIVERS_DATABASE.find(c => c.username && c.username.toLowerCase() === effectiveDemoUser) || { name: nativeCred.name };
          const cKey = effectiveDemoUser.toLowerCase();
          const cName = (caregiver.name || nativeCred.name || '').toLowerCase();
          let savedLang = localStorage.getItem(`cuidapp_user_lang_${cKey}`) ||
            (caregiver.id && localStorage.getItem(`cuidapp_user_lang_${caregiver.id}`)) ||
            (cName && localStorage.getItem(`cuidapp_user_lang_${cName}`));
          if (!savedLang) {
            const cLang = String(caregiver.idiomaPreferido || caregiver.language || caregiver.idioma || caregiver.paisOrigen || '').toLowerCase();
            if (cLang.includes('ht') || cLang.includes('kreyol') || cLang.includes('hait')) savedLang = 'ht';
            else if (cLang.includes('pt') || cLang.includes('portug') || cLang.includes('brasil')) savedLang = 'pt';
            else if (cLang.includes('en') || cLang.includes('ingl') || cLang.includes('english')) savedLang = 'en';
            else if (cLang.includes('arn') || cLang.includes('mapu')) savedLang = 'arn';
            else savedLang = localStorage.getItem('cuidapp_language') || 'es';
          }
          const userLang = savedLang || 'es';
          caregiver.idiomaPreferido = userLang;
          caregiver.language = userLang;
          caregiver.idioma = userLang;
          try {
            localStorage.setItem('cuidapp_language', userLang);
            localStorage.setItem(`cuidapp_user_lang_${cKey}`, userLang);
            if (caregiver.id) localStorage.setItem(`cuidapp_user_lang_${caregiver.id}`, userLang);
          } catch (e) {}
          logSessionAccess(effectiveDemoUser, 'cuidador', caregiver.name || nativeCred.name);
          window.showGlassAlert(`¡Bienvenido/a, ${caregiver.name || nativeCred.name}!`, 'success');
          handleLoginSuccess({ role: 'caregiver', caregiver });
          return;
        }

        if (nativeCred.role === 'patient') {
          let pat = PATIENTS_DATABASE.find(p => p.id === nativeCred.patientId || (p.username && p.username.toLowerCase() === effectiveDemoUser));
          if (!pat) {
            pat = new Patient(
              nativeCred.patientId, nativeCred.name, nativeCred.age || 30,
              effectiveDemoUser === 'camila' || effectiveDemoUser === 'valentina' || effectiveDemoUser === 'daniela' ? 'Femenino' : 'Masculino',
              55, 160, 'O+', ['GENERAL'], 'Ninguna',
              { name: 'Contacto', phone: '+56 9 8765 4321' },
              '12.345.678-9', effectiveDemoUser, nativeCred.password, nativeCred.name,
              effectiveDemoUser === 'camila' || effectiveDemoUser === 'valentina' || effectiveDemoUser === 'daniela' ? 'Ella' : 'Él',
              'FONASA Tramo B', !nativeCred.isPediatric, '', ''
            );
            PATIENTS_DATABASE.unshift(pat);
          }

          // Garantizar asignación exacta de flags clínicas requeridas
          if (effectiveDemoUser === 'camila') {
            pat.age = 14;
            pat.isPediatric = true;
            pat.isAdolescent = true;
            pat.rut = pat.rut || '24.118.902-5';
          } else if (effectiveDemoUser === 'valentina') {
            pat.age = 32;
            pat.isPediatric = false;
            pat.children = ['p_lucas'];
            pat.rut = pat.rut || '18.940.322-4';
            if (!PATIENTS_DATABASE.some(p => p.id === 'p_lucas')) {
              const pLucas = new Patient('p_lucas', 'Lucas Rojas Valenzuela', 5, 'Masculino', 19, 110, 'A+', ['GENERAL'], 'Ninguna', { name: 'Valentina Rojas', relation: 'Madre (Tutora Legal Acreditada)', phone: '+56976543210' }, '26.110.450-8', 'lucas', '1234', 'Lucas Rojas', 'Él', 'ISAPRE Consalud', false, '2021-04-10', '+56976543210');
              pLucas.isPediatric = true;
              pLucas.rut = '26.110.450-8';
              PATIENTS_DATABASE.push(pLucas);
            }
          } else if (effectiveDemoUser === 'daniela') {
            pat.age = 28;
            pat.isPregnant = true;
            pat.pregnancyWeeks = 24;
            pat.gestationalWeeks = 24;
            pat.rut = pat.rut || '19.450.812-3';
          }

          const pKey = (effectiveDemoUser || '').toLowerCase();
          const pName = (pat.name || '').toLowerCase();
          let savedDemoLang = localStorage.getItem(`cuidapp_user_lang_${pKey}`) ||
            (pat.id && localStorage.getItem(`cuidapp_user_lang_${pat.id}`)) ||
            (pat.username && localStorage.getItem(`cuidapp_user_lang_${pat.username.toLowerCase()}`)) ||
            (pName && localStorage.getItem(`cuidapp_user_lang_${pName}`));

          if (!savedDemoLang) {
            const pLang = String(pat.idiomaPreferido || pat.language || pat.idioma || pat.paisOrigen || '').toLowerCase();
            if (pLang.includes('ht') || pLang.includes('kreyol') || pLang.includes('hait')) savedDemoLang = 'ht';
            else if (pLang.includes('pt') || pLang.includes('portug') || pLang.includes('brasil')) savedDemoLang = 'pt';
            else if (pLang.includes('en') || pLang.includes('ingl') || pLang.includes('english')) savedDemoLang = 'en';
            else if (pLang.includes('arn') || pLang.includes('mapu')) savedDemoLang = 'arn';
            else savedDemoLang = localStorage.getItem('cuidapp_language') || 'es';
          }
          const userLang = savedDemoLang || 'es';
          pat.idiomaPreferido = userLang;
          pat.language = userLang;
          pat.idioma = userLang;
          try {
            localStorage.setItem('cuidapp_language', userLang);
            localStorage.setItem(`cuidapp_user_lang_${pKey}`, userLang);
            if (pat.id) localStorage.setItem(`cuidapp_user_lang_${pat.id}`, userLang);
          } catch (e) {}

          logSessionAccess(effectiveDemoUser, 'paciente', pat.socialName || pat.name);
          window.showGlassAlert(`¡Bienvenido/a, ${pat.socialName || pat.name}!`, 'success');
          handleLoginSuccess({ role: 'patient', patient: pat });
          return;
        }
      }
    }

    const effectiveAdminPass = overrides['admin'] || 'admin123';
    const effectiveDoctorPass = overrides['doctor'] || 'doctor123';

    if (user === 'admin' && pass === effectiveAdminPass) {
      stepPass.classList.add('d-none');
      updateZorinGreeting('Acceso Concedido');
      logSessionAccess('admin', 'admin', 'Administrador Central');
      window.showGlassAlert('¡Acceso concedido a cuidApp (Admin)!', 'success');
      handleLoginSuccess({ role: 'admin' });
      return;
    }

    if (user === 'doctor' && pass === effectiveDoctorPass) {
      stepPass.classList.add('d-none');
      updateZorinGreeting('Acceso Concedido');
      logSessionAccess('doctor', 'medico', 'Dra. Elena Valdés');
      window.showGlassAlert('¡Bienvenido/a, Dra. Elena Valdés!', 'success');
      handleLoginSuccess({ role: 'doctor' });
      return;
    }

    // Buscar en la base de datos de pacientes (por username o documento chileno/extranjero)
    const patient = PATIENTS_DATABASE.find(p => {
      if (p.username && p.username.toLowerCase() === user) return true;
      const pDoc = p.rut || p.documentNumber || p.fileNumber || '';
      if (pDoc.toLowerCase() === user) return true;
      if (pDoc.replace(/[\.\-\s]/g, '').toUpperCase() === cleanDoc) return true;
      return false;
    });
    if (patient) {
      const uKey = patient.username || user;
      const effectivePatientPass = overrides[uKey] || overrides[user] || patient.password;
      if (pass === effectivePatientPass) {
        stepPass.classList.add('d-none');
        updateZorinGreeting('Acceso Concedido');

        const pUserKey = (patient.username || user || '').toLowerCase();
        const pUserName = (patient.name || '').toLowerCase();
        let savedLang = localStorage.getItem(`cuidapp_user_lang_${pUserKey}`) ||
          (patient.id && localStorage.getItem(`cuidapp_user_lang_${patient.id}`)) ||
          (pUserName && localStorage.getItem(`cuidapp_user_lang_${pUserName}`));

        if (!savedLang) {
          const pLang = String(patient.idiomaPreferido || patient.language || patient.idioma || patient.paisOrigen || '').toLowerCase();
          if (pLang.includes('ht') || pLang.includes('kreyol') || pLang.includes('hait')) savedLang = 'ht';
          else if (pLang.includes('pt') || pLang.includes('portug') || pLang.includes('brasil')) savedLang = 'pt';
          else if (pLang.includes('en') || pLang.includes('ingl') || pLang.includes('english')) savedLang = 'en';
          else if (pLang.includes('arn') || pLang.includes('mapu')) savedLang = 'arn';
          else savedLang = localStorage.getItem('cuidapp_language') || 'es';
        }

        const userLang = savedLang || 'es';
        patient.idiomaPreferido = userLang;
        patient.language = userLang;
        patient.idioma = userLang;
        try {
          localStorage.setItem('cuidapp_language', userLang);
          localStorage.setItem(`cuidapp_user_lang_${pUserKey}`, userLang);
          if (patient.id) localStorage.setItem(`cuidapp_user_lang_${patient.id}`, userLang);
        } catch (e) {}

        logSessionAccess(uKey, 'paciente', patient.socialName || patient.name);
        window.showGlassAlert(`¡Bienvenido/a, ${patient.socialName || patient.name}!`, 'success');
        handleLoginSuccess({ role: 'patient', patient });
        return;
      }
    }

    // Buscar en cuidadores (por username o documento)
    const caregiver = CAREGIVERS_DATABASE.find(c => {
      if (c.username && c.username.toLowerCase() === user) return true;
      const cDoc = c.rut || c.documentNumber || '';
      if (cDoc.toLowerCase() === user) return true;
      if (cDoc.replace(/[\.\-\s]/g, '').toUpperCase() === cleanDoc) return true;
      return false;
    });
    if (caregiver) {
      const uKey = caregiver.username || user;
      const effectiveCaregiverPass = overrides[uKey] || overrides[user] || caregiver.password;
      if (pass === effectiveCaregiverPass) {
        stepPass.classList.add('d-none');
        updateZorinGreeting('Acceso Concedido');

        const cKey = (caregiver.username || user || '').toLowerCase();
        const cName = (caregiver.name || '').toLowerCase();
        let savedLang = localStorage.getItem(`cuidapp_user_lang_${cKey}`) ||
          (caregiver.id && localStorage.getItem(`cuidapp_user_lang_${caregiver.id}`)) ||
          (cName && localStorage.getItem(`cuidapp_user_lang_${cName}`));

        if (!savedLang) {
          const cLang = String(caregiver.idiomaPreferido || caregiver.language || caregiver.idioma || caregiver.paisOrigen || '').toLowerCase();
          if (cLang.includes('ht') || cLang.includes('kreyol') || cLang.includes('hait')) savedLang = 'ht';
          else if (cLang.includes('pt') || cLang.includes('portug') || cLang.includes('brasil')) savedLang = 'pt';
          else if (cLang.includes('en') || cLang.includes('ingl') || cLang.includes('english')) savedLang = 'en';
          else if (cLang.includes('arn') || cLang.includes('mapu')) savedLang = 'arn';
          else savedLang = localStorage.getItem('cuidapp_language') || 'es';
        }

        const userLang = savedLang || 'es';
        caregiver.idiomaPreferido = userLang;
        caregiver.language = userLang;
        caregiver.idioma = userLang;
        try {
          localStorage.setItem('cuidapp_language', userLang);
          localStorage.setItem(`cuidapp_user_lang_${cKey}`, userLang);
          if (caregiver.id) localStorage.setItem(`cuidapp_user_lang_${caregiver.id}`, userLang);
        } catch (e) {}

        logSessionAccess(uKey, 'cuidador', caregiver.name);
        window.showGlassAlert(`¡Bienvenido/a, ${caregiver.name}!`, 'success');
        handleLoginSuccess({ role: 'caregiver', caregiver });
        return;
      }
    }

    // Buscar SIEMPRE en usuarios personalizados persistidos en cuidapp_custom_users (por username o documento)
    try {
      const rawUsers = localStorage.getItem('cuidapp_custom_users');
      if (rawUsers) {
        const customUsers = JSON.parse(rawUsers);
        if (Array.isArray(customUsers)) {
          const customUser = customUsers.find(u => {
            if (u.username && u.username.toLowerCase() === user) return true;
            const uDoc = u.rut || u.documentNumber || '';
            if (uDoc.toLowerCase() === user) return true;
            if (uDoc.replace(/[\.\-\s]/g, '').toUpperCase() === cleanDoc) return true;
            return false;
          });
          if (customUser) {
            const uKey = customUser.username || user;
            const effectiveCustomPass = overrides[uKey] || overrides[user] || customUser.password;
            if (pass === effectiveCustomPass) {
              stepPass.classList.add('d-none');
              updateZorinGreeting('Acceso Concedido');

              if (customUser.role === 'patient') {
                let pat = PATIENTS_DATABASE.find(p => p.id === customUser.id || (p.username && p.username.toLowerCase() === uKey.toLowerCase()));
                if (!pat) {
                  const customPatientsRaw = localStorage.getItem('cuidapp_custom_patients');
                  const pList = customPatientsRaw ? JSON.parse(customPatientsRaw) : [];
                  const pData = pList.find(p => p.id === customUser.id || (p.username && p.username.toLowerCase() === uKey.toLowerCase())) || customUser;
                  pat = new Patient(
                    pData.id, pData.name, pData.age, pData.gender || pData.bioSex, pData.weight || 70, pData.stature || 165,
                    pData.bloodType || 'O+', pData.conditions || [], pData.allergies || 'Ninguna',
                    pData.emergencyContact || { name: pData.name, phone: pData.phone || '' },
                    pData.fileNumber || pData.rut, pData.username, pData.password,
                    pData.socialName || pData.name, pData.pronouns || 'Él', pData.prevision || 'FONASA Tramo B',
                    !pData.isPediatric, pData.birthDate || '', pData.phone || ''
                  );
                  Object.assign(pat, pData);
                  PATIENTS_DATABASE.unshift(pat);
                }
                const savedCustomLang = localStorage.getItem(`cuidapp_user_lang_${uKey}`) ||
                  (pat?.id && localStorage.getItem(`cuidapp_user_lang_${pat.id}`)) ||
                  (customUser?.id && localStorage.getItem(`cuidapp_user_lang_${customUser.id}`));
                const userLang = savedCustomLang || pat?.idiomaPreferido || pat?.language || pat?.idioma || customUser?.idiomaPreferido || customUser?.language || 'es';
                if (pat) {
                  pat.idiomaPreferido = userLang;
                  pat.language = userLang;
                  pat.idioma = userLang;
                }
                try { localStorage.setItem('cuidapp_language', userLang); } catch (e) {}

                logSessionAccess(uKey, 'paciente', pat.socialName || pat.name);
                window.showGlassAlert(`¡Bienvenido/a, ${pat.socialName || pat.name}!`, 'success');
                handleLoginSuccess({ role: 'patient', patient: pat });
                return;
              } else if (customUser.role === 'caregiver') {
                const cKey = (uKey || '').toLowerCase();
                const cName = (customUser.name || '').toLowerCase();
                let savedLang = localStorage.getItem(`cuidapp_user_lang_${cKey}`) ||
                  (customUser.id && localStorage.getItem(`cuidapp_user_lang_${customUser.id}`)) ||
                  (cName && localStorage.getItem(`cuidapp_user_lang_${cName}`));
                if (!savedLang) {
                  const cLang = String(customUser.idiomaPreferido || customUser.language || customUser.idioma || customUser.paisOrigen || '').toLowerCase();
                  if (cLang.includes('ht') || cLang.includes('kreyol') || cLang.includes('hait')) savedLang = 'ht';
                  else if (cLang.includes('pt') || cLang.includes('portug') || cLang.includes('brasil')) savedLang = 'pt';
                  else if (cLang.includes('en') || cLang.includes('ingl') || cLang.includes('english')) savedLang = 'en';
                  else if (cLang.includes('arn') || cLang.includes('mapu')) savedLang = 'arn';
                  else savedLang = localStorage.getItem('cuidapp_language') || 'es';
                }
                const userLang = savedLang || 'es';
                customUser.idiomaPreferido = userLang;
                customUser.language = userLang;
                try {
                  localStorage.setItem('cuidapp_language', userLang);
                  localStorage.setItem(`cuidapp_user_lang_${cKey}`, userLang);
                  if (customUser.id) localStorage.setItem(`cuidapp_user_lang_${customUser.id}`, userLang);
                } catch (e) {}
                logSessionAccess(uKey, 'cuidador', customUser.name);
                window.showGlassAlert(`¡Bienvenido/a, ${customUser.name}!`, 'success');
                handleLoginSuccess({ role: 'caregiver', caregiver: customUser });
                return;
              } else if (customUser.role === 'doctor') {
                logSessionAccess(uKey, 'medico', customUser.name || 'Médico Tratante');
                window.showGlassAlert(`¡Bienvenido/a, Dra. Elena Valdés!`, 'success');
                handleLoginSuccess({ role: 'doctor' });
                return;
              } else if (customUser.role === 'admin') {
                logSessionAccess(uKey, 'admin', 'Administrador');
                window.showGlassAlert('¡Acceso concedido a cuidApp (Admin)!', 'success');
                handleLoginSuccess({ role: 'admin' });
                return;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Error al autenticar en cuidapp_custom_users:', e);
    }

    // Autenticación fallida con animación shake
    if (centerForm) {
      centerForm.classList.add('shake-animation');
      centerForm.style.animation = 'shake 0.5s ease-in-out';
      window.showGlassAlert('Autenticación fallida. Verifica usuario y contraseña.', 'danger');

      setTimeout(() => {
        centerForm.classList.remove('shake-animation');
        centerForm.style.animation = '';
      }, 500);
    }
  }

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      window.showGlassAlert('Ajustes del sistema de cuidApp.', 'info', [
        { text: 'Ver Presentación', class: 'btn-glass-primary', onClick: () => { window.location.href = '/showcase.html'; } },
        { text: 'Cerrar', class: 'btn-glass-secondary', onClick: (t) => t.remove() }
      ]);
    });
  }

  // =========================================================================
  // VINCULACIÓN DE FLUJO A: REGISTRO DE NUEVO PACIENTE
  // =========================================================================
  const btnOpenRegister = document.getElementById('btnOpenRegisterModal');
  const modalRegisterEl = document.getElementById('modalRegisterPatient');
  const regRutInput = document.getElementById('regRut');
  const regRutFeedback = document.getElementById('regRutFeedback');
  const regBirthInput = document.getElementById('regBirthDate');
  const regAgeDisplay = document.getElementById('regAgeDisplay');
  const regTutorSection = document.getElementById('regTutorSection');
  const regSeniorNotice = document.getElementById('regSeniorNotice');
  const regChildrenSection = document.getElementById('regChildrenSection');
  const regChildrenList = document.getElementById('regChildrenList');
  const btnAddChildForm = document.getElementById('btnAddChildForm');
  const formRegister = document.getElementById('formRegisterPatient');

  // Conjunto para seguimiento de condiciones marcadas interactivamente
  const selectedConditionsSet = new Set();
  document.querySelectorAll('.condition-toggle-btn').forEach(btn => {
    btn.onclick = () => {
      const val = btn.dataset.val;
      if (selectedConditionsSet.has(val)) {
        selectedConditionsSet.delete(val);
        btn.classList.remove('btn-info', 'text-dark', 'fw-bold');
        btn.classList.add('text-white');
        btn.style.background = 'rgba(255,255,255,0.06)';
      } else {
        selectedConditionsSet.add(val);
        btn.classList.add('btn-info', 'text-dark', 'fw-bold');
        btn.classList.remove('text-white');
        btn.style.background = '#38bdf8';
      }
    };
  });

  // =========================================================================
  // CONTROL DEL ASISTENTE EN 3 PASOS (WIZARD PEDIÁTRICO / ADULTO / SENIOR)
  // =========================================================================
  let currentRegStep = 1;

  function updateRegStepUI(step) {
    currentRegStep = step;
    const pane1 = document.getElementById('regStepPane1');
    const pane2 = document.getElementById('regStepPane2');
    const pane3 = document.getElementById('regStepPane3');

    const ind1 = document.getElementById('stepIndicator1');
    const ind2 = document.getElementById('stepIndicator2');
    const ind3 = document.getElementById('stepIndicator3');

    if (pane1) pane1.classList.toggle('d-none', step !== 1);
    if (pane2) pane2.classList.toggle('d-none', step !== 2);
    if (pane3) pane3.classList.toggle('d-none', step !== 3);

    // Indicador 1
    if (ind1) {
      const textDiv = ind1.querySelector('.fw-semibold');
      if (step === 1) {
        ind1.style.background = 'rgba(14, 165, 233, 0.25)';
        ind1.style.border = '1.5px solid #38bdf8';
        if (textDiv) { textDiv.className = 'fw-semibold text-white'; textDiv.innerHTML = '👤 Identificación'; }
      } else if (step > 1) {
        ind1.style.background = 'rgba(16, 185, 129, 0.15)';
        ind1.style.border = '1.5px solid #10b981';
        if (textDiv) { textDiv.className = 'fw-semibold text-success'; textDiv.innerHTML = '👤 Identificación ✓'; }
      }
    }

    // Indicador 2
    if (ind2) {
      const textDiv = ind2.querySelector('.fw-semibold');
      if (step === 2) {
        ind2.style.background = 'rgba(14, 165, 233, 0.25)';
        ind2.style.border = '1.5px solid #38bdf8';
        if (textDiv) { textDiv.className = 'fw-semibold text-white'; textDiv.innerHTML = '🩺 Salud y Contacto'; }
      } else if (step > 2) {
        ind2.style.background = 'rgba(16, 185, 129, 0.15)';
        ind2.style.border = '1.5px solid #10b981';
        if (textDiv) { textDiv.className = 'fw-semibold text-success'; textDiv.innerHTML = '🩺 Salud y Contacto ✓'; }
      } else {
        ind2.style.background = 'rgba(255, 255, 255, 0.05)';
        ind2.style.border = '1.5px solid rgba(255, 255, 255, 0.15)';
        if (textDiv) { textDiv.className = 'fw-semibold text-white-50'; textDiv.innerHTML = '🩺 Salud y Contacto'; }
      }
    }

    // Indicador 3
    if (ind3) {
      const textDiv = ind3.querySelector('.fw-semibold');
      if (step === 3) {
        ind3.style.background = 'rgba(14, 165, 233, 0.25)';
        ind3.style.border = '1.5px solid #38bdf8';
        if (textDiv) { textDiv.className = 'fw-semibold text-white'; textDiv.innerHTML = '🔒 Cuenta y Acceso'; }

        // Actualizar resumen en Paso 3
        const legName = document.getElementById('regLegalName')?.value.trim() || '-';
        const socName = document.getElementById('regSocialName')?.value.trim();
        const dType = document.getElementById('regDocType')?.value || 'RUT';
        const dNum = document.getElementById('regRut')?.value.trim() || '-';
        const ph = document.getElementById('regPhone')?.value.trim() || '-';
        const pr = document.getElementById('regPrevision')?.value || '-';

        const sumName = document.getElementById('summaryRegName');
        const sumDoc = document.getElementById('summaryRegDoc');
        const sumPhone = document.getElementById('summaryRegPhone');
        const sumPrev = document.getElementById('summaryRegPrevision');

        if (sumName) sumName.textContent = socName ? `${socName} (${legName})` : legName;
        if (sumDoc) sumDoc.textContent = `${dType}: ${dNum}`;
        if (sumPhone) sumPhone.textContent = ph;
        if (sumPrev) sumPrev.textContent = pr;
      } else {
        ind3.style.background = 'rgba(255, 255, 255, 0.05)';
        ind3.style.border = '1.5px solid rgba(255, 255, 255, 0.15)';
        if (textDiv) { textDiv.className = 'fw-semibold text-white-50'; textDiv.innerHTML = '🔒 Cuenta y Acceso'; }
      }
    }

    // Desplazar vista del modal hacia arriba
    const modalScrollEl = modalRegisterEl?.querySelector('.modal-body');
    if (modalScrollEl) modalScrollEl.scrollTop = 0;
  }

  // =========================================================================
  // ASISTENCIA POR VOZ Y MODO GUÍA POR CAMPO (speechSynthesis en español)
  // =========================================================================
  let regVoiceGuideActive = false;

  function speakTextInSpanish(text) {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-CL';
        utterance.rate = 0.96;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
        return;
      } catch (err) {}
    }
    if (typeof speakText === 'function') {
      speakText(text, { force: true, immediate: true });
    }
  }

  function setVoiceGuideActive(active) {
    regVoiceGuideActive = active;
    const btnText = document.getElementById('textSpeakRegisterStep');
    const btn = document.getElementById('btnSpeakRegisterStep');
    if (btnText && btn) {
      if (regVoiceGuideActive) {
        btnText.textContent = 'Voz Activa';
        btn.classList.add('shadow-lg');
        btn.style.boxShadow = '0 0 16px rgba(251, 191, 36, 0.75)';
      } else {
        btnText.textContent = 'Escuchar paso';
        btn.style.boxShadow = '';
      }
    }
  }

  // Locución por voz para personas no lectoras o con baja visión usando speechSynthesis en español
  function speakStepInstruction(step) {
    let msg = '';
    if (step === 1) {
      msg = 'Paso uno: Identificación y documento. Escribe tu nombre completo según tu documento, selecciona tu tipo de documento, escribe el número y tu fecha de nacimiento. Luego presiona Siguiente.';
    } else if (step === 2) {
      msg = 'Paso dos: Datos de salud y contacto. Escribe tu teléfono con código más y dígitos, selecciona tu sexo biológico, grupo sanguíneo y previsión de salud. Si tienes personas a cargo, puedes agregarlas aquí.';
    } else {
      msg = 'Paso tres: Cuenta y acceso. Escribe un nombre de usuario y tu contraseña de al menos cuatro caracteres. Luego marca la autorización legal y pulsa Crear Ficha y Registrarme.';
    }
    speakTextInSpanish(msg);
  }

  const btnSpeakStep = document.getElementById('btnSpeakRegisterStep');
  if (btnSpeakStep) {
    btnSpeakStep.onclick = () => {
      // Activa o alterna el modo asistencia por voz y lee el paso actual
      setVoiceGuideActive(!regVoiceGuideActive || !regVoiceGuideActive);
      setVoiceGuideActive(true);
      speakStepInstruction(currentRegStep);
    };
  }

  // Diccionario de guía por voz interactiva para cada campo al hacer foco/clic
  const fieldSpokenGuides = {
    'regLegalName': 'Nombre Completo: escribe tu nombre y dos apellidos según aparecen en tu documento oficial.',
    'regSocialName': 'Nombre Social opcional: escribe el nombre con el que prefieres que cuidApp te identifique.',
    'regDocType': 'Tipo de Documento: selecciona si ingresarás RUT chileno, código NIC de salud o pasaporte extranjero.',
    'regRut': 'Número de Documento: ingresa el número o código de tu identificación.',
    'regBirthDate': 'Fecha de Nacimiento: selecciona tu fecha de nacimiento para calcular tu edad y perfil clínico.',
    'regPronouns': 'Pronombres: selecciona los pronombres con los que te identificas.',
    'regTutorName': 'Nombre del Tutor: ingresa el nombre de la madre, padre o representante legal acreditado.',
    'regTutorRut': 'Documento del Tutor: ingresa el RUT o documento de identidad del tutor legal acreditado.',
    'regTutorRelation': 'Vínculo: selecciona el parentesco o relación con el paciente.',
    'regPhone': 'Teléfono de Contacto: ingresa tu número con código más y dígitos para recordatorios y avisos.',
    'regBioSex': 'Sexo Biológico: selecciona tu sexo biológico para los registros de salud.',
    'regBloodType': 'Grupo Sanguíneo: selecciona tu tipo de sangre y factor RH.',
    'regPrevision': 'Previsión de Salud: selecciona si perteneces a FONASA o a una ISAPRE.',
    'regAllergies': 'Alergias Conocidas: escribe si tienes alergia a medicamentos, alimentos o déjalo en Ninguna.',
    'regCustomConditions': 'Condiciones de Salud: escribe otras necesidades de salud o movilidad que desees registrar.',
    'regUsername': 'Nombre de Usuario: escribe el nombre con el que iniciarás sesión en cuidApp.',
    'regPassword': 'Contraseña: escribe una clave de al menos cuatro caracteres.',
    'regPasswordConfirm': 'Confirmar Contraseña: vuelve a escribir exactamente la misma contraseña.',
    'regConsent': 'Autorización y Consentimiento Legal: marca esta casilla para autorizar el resguardo confidencial de tus registros clínicos.'
  };

  if (formRegister) {
    formRegister.addEventListener('focusin', (e) => {
      if (!regVoiceGuideActive) return;
      const target = e.target;
      if (!target) return;

      const id = target.id;
      if (id && fieldSpokenGuides[id]) {
        speakTextInSpanish(fieldSpokenGuides[id]);
        return;
      }

      if (target.classList.contains('child-name')) {
        speakTextInSpanish('Nombre de la persona a cargo: ingresa el nombre de la persona bajo tu cuidado.');
      } else if (target.classList.contains('child-doctype')) {
        speakTextInSpanish('Tipo de documento: selecciona si la persona a cargo tiene RUT chileno, NIC o pasaporte.');
      } else if (target.classList.contains('child-rut')) {
        speakTextInSpanish('Número de documento de la persona a cargo.');
      } else if (target.classList.contains('child-birth')) {
        speakTextInSpanish('Fecha de nacimiento de la persona a cargo: calcularemos su perfil clínico en tiempo real.');
      } else if (target.classList.contains('child-gender')) {
        speakTextInSpanish('Sexo biológico de la persona a cargo.');
      } else if (target.classList.contains('child-prevision')) {
        speakTextInSpanish('Previsión de salud de la persona a cargo.');
      } else if (target.classList.contains('child-conditions')) {
        speakTextInSpanish('Condiciones o necesidades de salud de la persona a cargo.');
      }
    });
  }

  // =========================================================================
  // SANITIZACIÓN EN TIEMPO REAL Y LÍMITES DE CARACTERES (maxLength)
  // =========================================================================
  const regLegalNameInput = document.getElementById('regLegalName');
  if (regLegalNameInput) {
    regLegalNameInput.oninput = (e) => {
      // Solo letras (con tildes y ñ) y espacios, máx 60 caracteres
      e.target.value = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '').slice(0, 60);
    };
  }

  const regSocialNameInput = document.getElementById('regSocialName');
  if (regSocialNameInput) {
    regSocialNameInput.oninput = (e) => {
      // Solo letras (con tildes y ñ) y espacios, máx 60 caracteres
      e.target.value = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '').slice(0, 60);
    };
  }

  const regTutorNameInput = document.getElementById('regTutorName');
  if (regTutorNameInput) {
    regTutorNameInput.oninput = (e) => {
      e.target.value = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '').slice(0, 60);
    };
  }

  const regTutorRutInput = document.getElementById('regTutorRut');
  if (regTutorRutInput) {
    regTutorRutInput.oninput = (e) => {
      e.target.value = formatRut(e.target.value).slice(0, 12);
    };
  }

  const regPhoneInput = document.getElementById('regPhone');
  if (regPhoneInput) {
    regPhoneInput.oninput = (e) => {
      // Permite solo + y dígitos (0-9), rechazando letras o símbolos como # o &, máx 12 caracteres
      let val = e.target.value;
      const startsWithPlus = val.startsWith('+');
      val = val.replace(/\D/g, '');
      if (startsWithPlus) {
        val = '+' + val;
      }
      e.target.value = val.slice(0, 12);
    };
  }

  const regAllergiesInput = document.getElementById('regAllergies');
  if (regAllergiesInput) {
    regAllergiesInput.oninput = (e) => {
      // Máximo 120 caracteres sin símbolos especiales (# & < > { })
      e.target.value = e.target.value.replace(/[#&<>{}]/g, '').slice(0, 120);
    };
  }

  const regCustomConditionsInput = document.getElementById('regCustomConditions');
  if (regCustomConditionsInput) {
    regCustomConditionsInput.oninput = (e) => {
      // Máximo 120 caracteres sin símbolos especiales (# & < > { })
      e.target.value = e.target.value.replace(/[#&<>{}]/g, '').slice(0, 120);
    };
  }

  const regUsernameInput = document.getElementById('regUsername');
  if (regUsernameInput) {
    regUsernameInput.oninput = (e) => {
      e.target.value = e.target.value.slice(0, 25);
    };
  }

  const regPasswordInput = document.getElementById('regPassword');
  if (regPasswordInput) {
    regPasswordInput.oninput = (e) => {
      e.target.value = e.target.value.slice(0, 25);
    };
  }

  const regPasswordConfirmInput = document.getElementById('regPasswordConfirm');
  if (regPasswordConfirmInput) {
    regPasswordConfirmInput.oninput = (e) => {
      e.target.value = e.target.value.slice(0, 25);
    };
  }

  // Botón opcional para desplegar u ocultar Nombre Social
  const btnToggleSocial = document.getElementById('btnToggleSocialName');
  const regSocialGroup = document.getElementById('regSocialNameGroup');
  if (btnToggleSocial && regSocialGroup) {
    btnToggleSocial.onclick = () => {
      const isHidden = regSocialGroup.classList.contains('d-none');
      if (isHidden) {
        regSocialGroup.classList.remove('d-none');
        btnToggleSocial.innerHTML = '<span>✕ Ocultar nombre social</span>';
        const inp = document.getElementById('regSocialName');
        if (inp) inp.focus();
      } else {
        regSocialGroup.classList.add('d-none');
        btnToggleSocial.innerHTML = '<span>+ Agregar nombre social</span>';
      }
    };
  }

  // Selector dinámico de Tipo de Documento (RUT / RUN Chileno, NIC / NIP Salud, Pasaporte / DNI)
  const regDocTypeSelect = document.getElementById('regDocType');
  if (regDocTypeSelect && regRutInput) {
    regDocTypeSelect.onchange = (e) => {
      const type = e.target.value;
      const labelEl = document.getElementById('regDocNumberLabel');
      if (type === 'RUT') {
        if (labelEl) labelEl.textContent = 'Número de RUT / RUN Chileno *';
        regRutInput.placeholder = '12.345.678-K';
        regRutInput.maxLength = 12;
        regRutInput.value = formatRut(regRutInput.value).slice(0, 12);
        if (regRutFeedback) regRutFeedback.innerHTML = '<span class="text-white-50">Validación de formato y dígito verificador Módulo 11 (máx 12 caracteres).</span>';
      } else if (type === 'NIC') {
        if (labelEl) labelEl.textContent = 'Número NIC / NIP Salud *';
        regRutInput.placeholder = '100234567';
        regRutInput.maxLength = 20;
        regRutInput.value = regRutInput.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 20);
        regRutInput.style.borderColor = 'rgba(255,255,255,0.25)';
        if (regRutFeedback) regRutFeedback.innerHTML = '<span class="text-info">Número alfanumérico provisorio (máx 20 caracteres).</span>';
      } else {
        if (labelEl) labelEl.textContent = 'Número de Pasaporte o DNI *';
        regRutInput.placeholder = 'A12345678 o DNI';
        regRutInput.maxLength = 20;
        regRutInput.value = regRutInput.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 20);
        regRutInput.style.borderColor = 'rgba(255,255,255,0.25)';
        if (regRutFeedback) regRutFeedback.innerHTML = '<span class="text-info">Documento de identidad alfanumérico de tu país (máx 20 caracteres).</span>';
      }
    };
  }

  // Apertura y reinicio del asistente de registro
  if (btnOpenRegister && modalRegisterEl) {
    btnOpenRegister.onclick = () => {
      updateRegStepUI(1);
      setVoiceGuideActive(false);
      if (window.bootstrap && window.bootstrap.Modal) {
        const m = window.bootstrap.Modal.getOrCreateInstance(modalRegisterEl);
        m.show();
      } else {
        modalRegisterEl.classList.add('show');
        modalRegisterEl.style.display = 'block';
      }
    };
  }

  // Cierre inmediato y reinicio del asistente de registro al Paso 1 con detención de voz
  function closeAndResetRegisterModal() {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    setVoiceGuideActive(false);

    updateRegStepUI(1);

    if (window.bootstrap && window.bootstrap.Modal) {
      const m = window.bootstrap.Modal.getInstance(modalRegisterEl) || window.bootstrap.Modal.getOrCreateInstance(modalRegisterEl);
      if (m) m.hide();
    }
    if (modalRegisterEl) {
      modalRegisterEl.classList.remove('show');
      modalRegisterEl.style.display = 'none';
      modalRegisterEl.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('padding-right');
    document.body.style.removeProperty('overflow');
    document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
  }

  const btnCloseReg = document.getElementById('btnCloseRegisterModal');
  if (btnCloseReg) {
    btnCloseReg.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeAndResetRegisterModal();
    };
  }

  const btnCancelReg = document.getElementById('btnCancelRegister');
  if (btnCancelReg) {
    btnCancelReg.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeAndResetRegisterModal();
    };
  }

  // Detener voz y reiniciar al cerrar el modal por cualquier vía
  modalRegisterEl?.addEventListener('hidden.bs.modal', () => {
    closeAndResetRegisterModal();
  });

  // Autoformato y validación Módulo 11 en vivo SOLO para RUT chileno; alfanumérico para NIC/Pasaporte
  if (regRutInput) {
    regRutInput.oninput = (e) => {
      const docType = regDocTypeSelect ? regDocTypeSelect.value : 'RUT';
      if (docType === 'RUT') {
        const formatted = formatRut(e.target.value).slice(0, 12);
        e.target.value = formatted;
        if (formatted.length >= 8) {
          const isValid = validateChileanRut(formatted);
          if (isValid) {
            regRutInput.style.borderColor = '#10b981';
            if (regRutFeedback) {
              regRutFeedback.innerHTML = '<span class="text-success"><i class="bi bi-check-circle-fill me-1"></i>RUT chileno válido</span>';
            }
          } else {
            regRutInput.style.borderColor = '#f87171';
            if (regRutFeedback) {
              regRutFeedback.innerHTML = '<span class="text-warning"><i class="bi bi-exclamation-triangle me-1"></i>Dígito verificador no coincide</span>';
            }
          }
        }
      } else {
        e.target.value = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 20);
        regRutInput.style.borderColor = 'rgba(255,255,255,0.25)';
        if (regRutFeedback) {
          regRutFeedback.innerHTML = '<span class="text-info"><i class="bi bi-info-circle me-1"></i>Documento alfanumérico ingresado</span>';
        }
      }
    };
  }

  // Asignación automática de idioma según País de Origen / Pueblo Originario
  const regCountryEl = document.getElementById('regCountryOrigin');
  const regLangEl = document.getElementById('regLanguage');
  if (regCountryEl) {
    const handleCountryChange = () => {
      const c = (regCountryEl.value || '').toLowerCase();
      let autoLang = 'es';
      if (c.includes('hait')) autoLang = 'ht';
      else if (c.includes('brasil') || c.includes('brazil')) autoLang = 'pt';
      else if (c.includes('estados unidos') || c.includes('reino unido') || c.includes('ee.uu') || c.includes('usa') || c.includes('uk')) autoLang = 'en';
      else if (c.includes('mapuche') || c.includes('mapu')) autoLang = 'arn';
      else autoLang = 'es';
      if (regLangEl) regLangEl.value = autoLang;
    };
    regCountryEl.addEventListener('change', handleCountryChange);
  }

  // Botón Siguiente Paso 1
  const btnNext1 = document.getElementById('btnNextStep1');
  if (btnNext1) {
    btnNext1.onclick = () => {
      const legalName = document.getElementById('regLegalName')?.value.trim();
      if (!legalName) {
        window.showGlassAlert('Por favor ingresa tu nombre completo.', 'warning');
        document.getElementById('regLegalName')?.focus();
        return;
      }
      const docType = regDocTypeSelect ? regDocTypeSelect.value : 'RUT';
      const docVal = regRutInput ? regRutInput.value.trim() : '';
      if (!docVal) {
        window.showGlassAlert('Por favor ingresa el número de documento.', 'warning');
        regRutInput?.focus();
        return;
      }
      if (docType === 'RUT' && !validateChileanRut(docVal)) {
        window.showGlassAlert('El RUT ingresado no es válido. Revisa formato y dígito verificador.', 'warning');
        regRutInput?.focus();
        return;
      }
      const birthVal = regBirthInput ? regBirthInput.value : '';
      if (!birthVal) {
        window.showGlassAlert('Por favor selecciona tu fecha de nacimiento.', 'warning');
        regBirthInput?.focus();
        return;
      }
      const age = calculateAge(birthVal);
      if (age < 18) {
        const tName = document.getElementById('regTutorName')?.value.trim();
        const tRut = document.getElementById('regTutorRut')?.value.trim();
        if (!tName || !tRut) {
          window.showGlassAlert('Por favor completa el nombre y documento del tutor legal acreditado.', 'warning');
          document.getElementById('regTutorName')?.focus();
          return;
        }
      }
      updateRegStepUI(2);
      if (regVoiceGuideActive) {
        speakStepInstruction(2);
      }
    };
  }

  // Botón Siguiente Paso 2
  const btnNext2 = document.getElementById('btnNextStep2');
  if (btnNext2) {
    btnNext2.onclick = () => {
      const phone = document.getElementById('regPhone')?.value.trim();
      if (!phone) {
        window.showGlassAlert('Por favor ingresa un teléfono de contacto.', 'warning');
        document.getElementById('regPhone')?.focus();
        return;
      }
      updateRegStepUI(3);
      if (regVoiceGuideActive) {
        speakStepInstruction(3);
      }
    };
  }

  // Botones Anterior
  const btnPrev2 = document.getElementById('btnPrevStep2');
  if (btnPrev2) {
    btnPrev2.onclick = () => {
      updateRegStepUI(1);
      if (regVoiceGuideActive) speakStepInstruction(1);
    };
  }

  const btnPrev3 = document.getElementById('btnPrevStep3');
  if (btnPrev3) {
    btnPrev3.onclick = () => {
      updateRegStepUI(2);
      if (regVoiceGuideActive) speakStepInstruction(2);
    };
  }

  // Escucha de fecha de nacimiento para cálculo automático de edad y enrutamiento por ley
  if (regBirthInput) {
    regBirthInput.onchange = (e) => {
      const birthVal = e.target.value;
      const age = calculateAge(birthVal);
      if (regAgeDisplay) {
        regAgeDisplay.innerHTML = `<span class="text-info fw-bold">${age} años</span>`;
      }

      // Si es menor de 18 años: Exigir tutor legal (Ley 21.430) y ocultar sección de personas a cargo propias
      if (age < 18) {
        if (regTutorSection) regTutorSection.classList.remove('d-none');
        if (regSeniorNotice) regSeniorNotice.classList.add('d-none');
        if (regChildrenSection) regChildrenSection.classList.add('d-none');
        const tutorName = document.getElementById('regTutorName');
        const tutorRut = document.getElementById('regTutorRut');
        if (tutorName) tutorName.required = true;
        if (tutorRut) tutorRut.required = true;
      } else {
        if (regTutorSection) regTutorSection.classList.add('d-none');
        if (regChildrenSection) regChildrenSection.classList.remove('d-none');
        const tutorName = document.getElementById('regTutorName');
        const tutorRut = document.getElementById('regTutorRut');
        if (tutorName) tutorName.required = false;
        if (tutorRut) tutorRut.required = false;

        // Si es mayor o igual a 60 años: Mostrar preferencia de accesibilidad
        if (age >= 60) {
          if (regSeniorNotice) regSeniorNotice.classList.remove('d-none');
        } else {
          if (regSeniorNotice) regSeniorNotice.classList.add('d-none');
        }
      }
    };
  }

  // Agregar dinámicamente formulario de persona a cargo
  if (btnAddChildForm && regChildrenList) {
    btnAddChildForm.onclick = () => {
      const childIndex = regChildrenList.children.length + 1;
      const childCard = document.createElement('div');
      childCard.className = 'reg-child-card p-3 rounded-3 position-relative border border-info border-opacity-25 shadow-sm';
      childCard.style.background = 'rgba(15, 23, 42, 0.75)';
      childCard.innerHTML = `
        <div class="d-flex align-items-center justify-content-between mb-2 pb-1 border-bottom border-light border-opacity-10">
          <strong class="text-info small"><i class="bi bi-person-heart me-1"></i>Persona a Cargo #${childIndex}</strong>
          <button type="button" class="btn btn-sm text-danger p-0 border-0 btn-remove-child" title="Eliminar persona a cargo">
            <i class="bi bi-trash3-fill"></i>
          </button>
        </div>
        <div class="row g-2">
          <div class="col-md-5">
            <label class="form-label text-white-50 small mb-0.5">Nombre Completo *</label>
            <input type="text" class="form-control form-control-sm text-white child-name" placeholder="Ej. Lucas Rojas" required maxlength="60" autocomplete="off" style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.18); border-radius: 8px;">
          </div>
          <div class="col-md-3">
            <label class="form-label text-white-50 small mb-0.5">Tipo Documento *</label>
            <select class="form-select form-select-sm text-white child-doctype" style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.18); border-radius: 8px;">
              <option value="RUT" class="bg-dark text-white">RUT / RUN Chileno</option>
              <option value="NIC" class="bg-dark text-white">NIC / NIP Salud</option>
              <option value="PASAPORTE" class="bg-dark text-white">Pasaporte / DNI Extranjero</option>
            </select>
          </div>
          <div class="col-md-4">
            <label class="form-label text-white-50 small mb-0.5 child-rut-label">N° Documento *</label>
            <input type="text" class="form-control form-control-sm text-white child-rut" placeholder="26.110.450-8" maxlength="12" required autocomplete="off" style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.18); border-radius: 8px;">
          </div>
          <div class="col-md-4">
            <label class="form-label text-white-50 small mb-0.5">Fecha Nacimiento *</label>
            <input type="date" class="form-control form-control-sm text-white child-birth" required autocomplete="off" style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.18); border-radius: 8px;">
          </div>
          <div class="col-md-4">
            <label class="form-label text-white-50 small mb-0.5">Sexo Biológico *</label>
            <select class="form-select form-select-sm text-white child-gender" style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.18); border-radius: 8px;">
              <option value="Masculino" class="bg-dark text-white">Masculino</option>
              <option value="Femenino" class="bg-dark text-white">Femenino</option>
              <option value="Intersexual" class="bg-dark text-white">Intersexual</option>
            </select>
          </div>
          <div class="col-md-4">
            <label class="form-label text-white-50 small mb-0.5">Previsión</label>
            <select class="form-select form-select-sm text-white child-prevision" style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.18); border-radius: 8px;">
              <option value="FONASA Tramo B" class="bg-dark text-white">FONASA Tramo B</option>
              <option value="FONASA Tramo A" class="bg-dark text-white">FONASA Tramo A</option>
              <option value="ISAPRE Consalud" class="bg-dark text-white">ISAPRE Consalud</option>
              <option value="ISAPRE Colmena" class="bg-dark text-white">ISAPRE Colmena</option>
              <option value="Particular / Otro" class="bg-dark text-white">Particular / Otro</option>
            </select>
          </div>
          <div class="col-12">
            <label class="form-label text-white-50 small mb-0.5">Condiciones / Necesidades</label>
            <input type="text" class="form-control form-control-sm text-white child-conditions" placeholder="Ej. TEA, Asma, Alergias, Movilidad reducida..." maxlength="120" autocomplete="off" style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.18); border-radius: 8px;">
          </div>
          <div class="col-12">
            <div class="child-profile-badge d-none mt-1 p-2 rounded-2" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);">
            </div>
          </div>
        </div>
      `;

      // Sanitización de persona a cargo en tiempo real
      const childNameIn = childCard.querySelector('.child-name');
      if (childNameIn) {
        childNameIn.oninput = (e) => {
          e.target.value = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '').slice(0, 60);
        };
      }

      const childDocTypeSelect = childCard.querySelector('.child-doctype');
      const childRutIn = childCard.querySelector('.child-rut');
      const childRutLabel = childCard.querySelector('.child-rut-label');

      if (childDocTypeSelect && childRutIn) {
        childDocTypeSelect.onchange = () => {
          const type = childDocTypeSelect.value;
          if (type === 'RUT') {
            if (childRutLabel) childRutLabel.textContent = 'RUT Chileno *';
            childRutIn.placeholder = '26.110.450-8';
            childRutIn.maxLength = 12;
            childRutIn.value = formatRut(childRutIn.value).slice(0, 12);
          } else if (type === 'NIC') {
            if (childRutLabel) childRutLabel.textContent = 'NIC / NIP Salud *';
            childRutIn.placeholder = '100234567';
            childRutIn.maxLength = 20;
            childRutIn.value = childRutIn.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 20);
          } else {
            if (childRutLabel) childRutLabel.textContent = 'Pasaporte / DNI *';
            childRutIn.placeholder = 'A12345678 o DNI';
            childRutIn.maxLength = 20;
            childRutIn.value = childRutIn.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 20);
          }
        };

        childRutIn.oninput = (e) => {
          if (childDocTypeSelect.value === 'RUT') {
            e.target.value = formatRut(e.target.value).slice(0, 12);
          } else {
            e.target.value = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 20);
          }
        };
      }

      const childConditionsIn = childCard.querySelector('.child-conditions');
      if (childConditionsIn) {
        childConditionsIn.oninput = (e) => {
          e.target.value = e.target.value.replace(/[#&<>{}]/g, '').slice(0, 120);
        };
      }

      // Cálculo de edad en tiempo real y asignación de perfil clínico (Ley N° 20.584 y Ley N° 21.430)
      const childBirthIn = childCard.querySelector('.child-birth');
      const childProfileBadge = childCard.querySelector('.child-profile-badge');

      if (childBirthIn && childProfileBadge) {
        const updateChildProfile = () => {
          const bVal = childBirthIn.value;
          if (!bVal) {
            childProfileBadge.classList.add('d-none');
            childProfileBadge.innerHTML = '';
            return;
          }
          const cAge = calculateAge(bVal);
          childProfileBadge.classList.remove('d-none');

          let profileLabel = '';
          let badgeClass = '';
          if (cAge < 14) {
            profileLabel = '🧸 Pediátrico';
            badgeClass = 'bg-primary text-white';
          } else if (cAge <= 17) {
            profileLabel = '🎧 Adolescente';
            badgeClass = 'bg-info text-dark';
          } else if (cAge <= 59) {
            profileLabel = '🧑 Adulto Asistido';
            badgeClass = 'bg-success text-white';
          } else {
            profileLabel = '👴 Adulto Mayor';
            badgeClass = 'bg-warning text-dark';
          }

          childProfileBadge.innerHTML = `
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-1">
              <div>
                <span class="badge ${badgeClass} px-2.5 py-1 fw-bold" style="font-size: 11px;">
                  ${profileLabel} (${cAge} ${cAge === 1 ? 'año' : 'años'})
                </span>
                <span class="text-white-50 ms-2 small" style="font-size: 11px;">Perfil clínico asignado</span>
              </div>
              <small class="text-info" style="font-size: 10px;">
                <i class="bi bi-shield-check me-0.5"></i>Conforme a Ley N° 20.584 y Ley N° 21.430
              </small>
            </div>
          `;
        };

        childBirthIn.onchange = updateChildProfile;
        childBirthIn.oninput = updateChildProfile;
      }

      // Remover persona a cargo
      childCard.querySelector('.btn-remove-child').onclick = () => {
        childCard.remove();
      };

      regChildrenList.appendChild(childCard);
    };
  }

  // =========================================================================
  // ENVÍO DEL FORMULARIO DE REGISTRO EN EL PASO 3 (AISLAMIENTO TOTAL)
  // =========================================================================
  if (formRegister) {
    formRegister.onsubmit = (e) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        const legalName = document.getElementById('regLegalName')?.value.trim() || '';
        const socialName = document.getElementById('regSocialName')?.value.trim() || legalName;
        const pronouns = document.getElementById('regPronouns')?.value || 'Él';
        const docType = document.getElementById('regDocType')?.value || 'RUT';
        const rut = document.getElementById('regRut')?.value.trim() || '';
        const birthDate = document.getElementById('regBirthDate')?.value || '';
        const age = calculateAge(birthDate);

        const bioSex = document.getElementById('regBioSex')?.value || 'Masculino';
        const phone = document.getElementById('regPhone')?.value.trim() || '';
        const bloodType = document.getElementById('regBloodType')?.value || 'O+';
        const prevision = document.getElementById('regPrevision')?.value || 'FONASA Tramo B';
        const countryOrigin = document.getElementById('regCountryOrigin')?.value || 'Chile';
        let preferredLanguage = document.getElementById('regLanguage')?.value;
        if (!preferredLanguage) {
          const c = countryOrigin.toLowerCase();
          if (c.includes('hait')) preferredLanguage = 'ht';
          else if (c.includes('brasil') || c.includes('brazil')) preferredLanguage = 'pt';
          else if (c.includes('estados unidos') || c.includes('reino unido') || c.includes('ee.uu') || c.includes('usa') || c.includes('uk')) preferredLanguage = 'en';
          else if (c.includes('mapuche') || c.includes('mapu')) preferredLanguage = 'arn';
          else preferredLanguage = 'es';
        }
        const allergies = document.getElementById('regAllergies')?.value.trim() || 'Ninguna';

        const username = document.getElementById('regUsername')?.value.trim().toLowerCase() || '';
        const pass = document.getElementById('regPassword')?.value.trim() || '';
        const passConfirm = document.getElementById('regPasswordConfirm')?.value.trim() || '';
        const consent = document.getElementById('regConsent')?.checked;

        // Validaciones Paso 3 (Credenciales y Consentimiento)
        if (!username) {
          window.showGlassAlert('Por favor ingresa un nombre de usuario.', 'warning');
          document.getElementById('regUsername')?.focus();
          return;
        }

        if (username.length > 25) {
          window.showGlassAlert('El nombre de usuario no puede exceder 25 caracteres.', 'warning');
          document.getElementById('regUsername')?.focus();
          return;
        }

        if (!pass || pass.length < 4) {
          window.showGlassAlert('La contraseña debe tener al menos 4 caracteres.', 'warning');
          document.getElementById('regPassword')?.focus();
          return;
        }

        if (pass.length > 25) {
          window.showGlassAlert('La contraseña no puede exceder 25 caracteres.', 'warning');
          document.getElementById('regPassword')?.focus();
          return;
        }

        if (pass !== passConfirm) {
          window.showGlassAlert('Las contraseñas no coinciden. Por favor verifica.', 'warning');
          document.getElementById('regPasswordConfirm')?.focus();
          return;
        }

        if (!consent) {
          window.showGlassAlert('Debes aceptar la autorización de consentimiento informado para continuar.', 'warning');
          document.getElementById('regConsent')?.focus();
          return;
        }

        // Validaciones de Paso 1 (por si hubo omisión)
        if (!legalName) {
          window.showGlassAlert('Por favor completa tu nombre completo en el Paso 1.', 'warning');
          updateRegStepUI(1);
          document.getElementById('regLegalName')?.focus();
          return;
        }

        if (!rut) {
          window.showGlassAlert('Por favor completa tu número de documento en el Paso 1.', 'warning');
          updateRegStepUI(1);
          document.getElementById('regRut')?.focus();
          return;
        }

        if (docType === 'RUT') {
          if (!validateChileanRut(rut)) {
            window.showGlassAlert('El RUT ingresado no es válido. Revisa formato y dígito verificador.', 'warning');
            updateRegStepUI(1);
            document.getElementById('regRut')?.focus();
            return;
          }
        } else {
          if (rut.length < 3) {
            window.showGlassAlert('El número de documento ingresado debe tener al menos 3 caracteres.', 'warning');
            updateRegStepUI(1);
            document.getElementById('regRut')?.focus();
            return;
          }
        }

        if (!birthDate) {
          window.showGlassAlert('Por favor selecciona tu fecha de nacimiento en el Paso 1.', 'warning');
          updateRegStepUI(1);
          document.getElementById('regBirthDate')?.focus();
          return;
        }

        // Validar tutor si es menor de 18 años
        const isUnderage = age < 18;
        let tutorName = '';
        let tutorRut = '';
        let tutorRelation = '';

        if (isUnderage) {
          tutorName = document.getElementById('regTutorName')?.value.trim() || '';
          tutorRut = document.getElementById('regTutorRut')?.value.trim() || '';
          tutorRelation = document.getElementById('regTutorRelation')?.value || 'Tutor Legal Acreditado';

          if (!tutorName || !tutorRut) {
            window.showGlassAlert('Por favor completa el nombre y documento del tutor legal acreditado en el Paso 1.', 'warning');
            updateRegStepUI(1);
            return;
          }
        }

        // Validaciones de Paso 2
        if (!phone) {
          window.showGlassAlert('Por favor ingresa un teléfono de contacto en el Paso 2.', 'warning');
          updateRegStepUI(2);
          document.getElementById('regPhone')?.focus();
          return;
        }

        // Validar duplicados ÚNICAMENTE por Tipo + Número de Documento (Ley N° 20.584 y Decreto Supremo N° 67)
        const cleanDocForCheck = (type, doc) => {
          if (!doc) return '';
          if (type === 'RUT') return cleanRut(doc);
          return doc.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        };
        const targetDocClean = cleanDocForCheck(docType, rut);

        if (targetDocClean.length >= 3) {
          const isDocDuplicateInPatients = PATIENTS_DATABASE.some(p => {
            const pType = p.documentType || 'RUT';
            const pDoc = p.rut || p.fileNumber || p.documentNumber || '';
            const pDocClean = cleanDocForCheck(pType, pDoc);
            return pDocClean && pType === docType && pDocClean === targetDocClean;
          });

          let isDocDuplicateInStorage = false;
          try {
            const rawCustomUsers = localStorage.getItem('cuidapp_custom_users');
            if (rawCustomUsers) {
              const customUsers = JSON.parse(rawCustomUsers);
              if (Array.isArray(customUsers)) {
                isDocDuplicateInStorage = customUsers.some(u => {
                  const uType = u.documentType || 'RUT';
                  const uDoc = u.rut || u.documentNumber || '';
                  const uDocClean = cleanDocForCheck(uType, uDoc);
                  return uDocClean && uType === docType && uDocClean === targetDocClean;
                });
              }
            }
          } catch (e) {}

          if (isDocDuplicateInPatients || isDocDuplicateInStorage) {
            window.showGlassAlert('Ya existe un registro con este Tipo y Número de Documento en la plataforma (Ley N° 20.584 / Decreto Supremo N° 67).', 'warning');
            return;
          }
        }

        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }

        // Recolección limpia de condiciones declaradas (CERO contaminación demo)
        const declaredConditions = Array.from(selectedConditionsSet);
        const customCondText = document.getElementById('regCustomConditions')?.value.trim();
        if (customCondText) {
          declaredConditions.push(customCondText);
        }

        const newId = `p_cust_${Date.now()}`;
        const newPatient = new Patient(
          newId,
          legalName,
          age,
          bioSex,
          isUnderage ? 25 : 70,
          isUnderage ? 120 : 165,
          bloodType,
          declaredConditions,
          allergies,
          {
            name: isUnderage ? tutorName : legalName,
            relation: isUnderage ? tutorRelation : 'Contacto de Emergencia',
            phone: phone
          },
          rut,
          username,
          pass,
          socialName,
          pronouns,
          prevision,
          !isUnderage,
          birthDate,
          phone
        );

        newPatient.documentType = docType;
        newPatient.documentNumber = rut;
        newPatient.fileNumber = rut;
        newPatient.phoneType = 'móvil';
        newPatient.isPediatric = isUnderage;
        newPatient.paisOrigen = countryOrigin;
        newPatient.idiomaPreferido = preferredLanguage;
        newPatient.language = preferredLanguage;
        newPatient.idioma = preferredLanguage;
        try {
          localStorage.setItem('cuidapp_language', preferredLanguage);
          localStorage.setItem(`cuidapp_user_lang_${username}`, preferredLanguage);
          if (newPatient.id) {
            localStorage.setItem(`cuidapp_user_lang_${newPatient.id}`, preferredLanguage);
          }
        } catch (e) {}
        newPatient.conditions = declaredConditions;
        newPatient.medications = [];
        newPatient.surgeries = [];
        newPatient.documents = [];
        newPatient.clinicalLogs = [];
        newPatient.recentVitals = null;
        newPatient.children = [];

        if (isUnderage) {
          newPatient.legalGuardianName = tutorName;
          newPatient.legalGuardianRut = tutorRut;
          newPatient.legalGuardianRelation = tutorRelation;
        }

        try {
          localStorage.removeItem(`cuidapp_clinical_logs_${newId}`);
          localStorage.removeItem(`cuidapp_prescriptions_${newId}`);
          localStorage.removeItem(`cuidapp_ecg_alerts_${newId}`);
          localStorage.removeItem(`cuidapp_pregnancy_${newId}`);
        } catch (e) {}

        // Procesar y crear fichas para personas a cargo si existen (Ley N° 20.584 y Ley N° 21.430)
        const childCards = document.querySelectorAll('.reg-child-card');
        childCards.forEach((card, idx) => {
          const cName = card.querySelector('.child-name')?.value.trim();
          const cDocType = card.querySelector('.child-doctype')?.value || 'RUT';
          const cRut = card.querySelector('.child-rut')?.value.trim();
          const cBirth = card.querySelector('.child-birth')?.value;
          const cBioSex = card.querySelector('.child-gender')?.value || 'Masculino';
          const cPrevision = card.querySelector('.child-prevision')?.value || prevision;
          const cCondsRaw = card.querySelector('.child-conditions')?.value.trim();
          const cConds = cCondsRaw ? [cCondsRaw] : [];

          if (cName && cBirth) {
            const cAge = calculateAge(cBirth);
            const childId = `p_ped_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`;
            const childPatient = new Patient(
              childId,
              cName,
              cAge,
              cBioSex,
              cAge < 14 ? 18 : 60,
              cAge < 14 ? 105 : 160,
              'O+',
              cConds,
              'Ninguna',
              {
                name: legalName,
                relation: 'Madre/Padre/Tutor Legal Acreditado',
                phone: phone
              },
              cRut || `DOC-${idx}-${Date.now()}`,
              (cName.split(' ')[0] || 'cargo').toLowerCase() + Math.floor(100 + Math.random() * 900),
              pass,
              cName.split(' ')[0] || cName,
              cBioSex === 'Femenino' ? 'Ella' : 'Él',
              cPrevision,
              cAge >= 18,
              cBirth,
              phone
            );
            childPatient.documentType = cDocType;
            childPatient.documentNumber = cRut;
            childPatient.rut = cRut;
            childPatient.fileNumber = cRut;
            childPatient.isPediatric = cAge < 14;
            childPatient.isAdolescent = cAge >= 14 && cAge <= 17;
            childPatient.isAssistedAdult = cAge >= 18 && cAge <= 59;
            childPatient.isSenior = cAge >= 60;
            childPatient.legalGuardianName = legalName;
            childPatient.legalGuardianRut = rut;
            childPatient.legalGuardianRelation = 'Tutor Legal Acreditado (Ley N° 20.584 / Ley N° 21.430)';
            childPatient.conditions = cConds;
            childPatient.medications = [];
            childPatient.surgeries = [];
            childPatient.documents = [];
            childPatient.clinicalLogs = [];
            childPatient.recentVitals = null;

            try {
              localStorage.removeItem(`cuidapp_clinical_logs_${childId}`);
              localStorage.removeItem(`cuidapp_prescriptions_${childId}`);
              localStorage.removeItem(`cuidapp_ecg_alerts_${childId}`);
            } catch (e) {}

            registerPatientInDatabase(childPatient);
            newPatient.children.push(childId);
          }
        });

        // Registrar y sincronizar nuevo paciente principal en PATIENTS_DATABASE y localStorage
        registerPatientInDatabase(newPatient);

        // Cerrar modal de forma limpia
        if (window.bootstrap && window.bootstrap.Modal) {
          const m = window.bootstrap.Modal.getInstance(modalRegisterEl) || window.bootstrap.Modal.getOrCreateInstance(modalRegisterEl);
          if (m) m.hide();
        }
        if (modalRegisterEl) {
          modalRegisterEl.classList.remove('show');
          modalRegisterEl.style.display = 'none';
          modalRegisterEl.setAttribute('aria-hidden', 'true');
        }
        document.body.classList.remove('modal-open');
        document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());

        // Aviso de éxito y locución de bienvenida
        window.showGlassAlert(`🎉 ¡Ficha creada exitosamente! Bienvenido/a a cuidApp, ${socialName}.`, 'success');

        if (typeof speakText === 'function') {
          speakText(`Bienvenido a cuidApp, ${socialName}. Tu ficha clínica ha sido registrada exitosamente.`);
        }

        // Dejar listo el acceso en los campos de login
        const zorinUser = document.getElementById('zorinUsername');
        const zorinPass = document.getElementById('zorinPassword');
        if (zorinUser) zorinUser.value = username;
        if (zorinPass) zorinPass.value = pass;
        updateZorinGreeting(`¡Hola ${socialName}!`);

        // Acceso directo al portal del paciente
        handleLoginSuccess({ role: 'patient', patient: newPatient });
      } catch (err) {
        console.error('Error durante el registro:', err);
        window.showGlassAlert('Ocurrió un error al procesar el registro. Por favor verifica tus datos.', 'danger');
      }
    };
  }

  // =========================================================================
  // VINCULACIÓN DE FLUJO B: RECUPERACIÓN SEGURA DE CONTRASEÑA (LEY 19.628)
  // =========================================================================
  const btnOpenRecovery = document.getElementById('btnOpenRecoveryModal');
  const modalRecoveryEl = document.getElementById('modalPasswordRecovery');
  const recRutInput = document.getElementById('recRut');
  const recBirthInput = document.getElementById('recBirthDate');
  const btnVerifyId = document.getElementById('btnVerifyIdentity');
  const recoveryStep1 = document.getElementById('recoveryStep1');
  const recoveryStep2 = document.getElementById('recoveryStep2');
  const recVerifiedUserName = document.getElementById('recVerifiedUserName');
  const recVerifiedUserRut = document.getElementById('recVerifiedUserRut');
  const recOtpCodeDisplay = document.getElementById('recOtpCodeDisplay');
  const recChannelSubtext = document.getElementById('recChannelSubtext');

  const btnChanSms = document.getElementById('btnChannelSms');
  const btnChanVoice = document.getElementById('btnChannelVoice');
  const btnChanTutor = document.getElementById('btnChannelTutor');
  const formResetPass = document.getElementById('formResetPassword');

  let currentTargetUser = null;
  let currentGeneratedOtp = '';

  if (btnOpenRecovery && modalRecoveryEl) {
    btnOpenRecovery.onclick = () => {
      // Reiniciar estado
      if (recoveryStep1) recoveryStep1.classList.remove('d-none');
      if (recoveryStep2) recoveryStep2.classList.add('d-none');
      if (recRutInput) recRutInput.value = '';
      if (recBirthInput) recBirthInput.value = '';
      currentTargetUser = null;
      currentGeneratedOtp = '';

      if (window.bootstrap && window.bootstrap.Modal) {
        const m = window.bootstrap.Modal.getOrCreateInstance(modalRecoveryEl);
        m.show();
      } else {
        modalRecoveryEl.classList.add('show');
        modalRecoveryEl.style.display = 'block';
      }
    };
  }

  if (recRutInput) {
    recRutInput.oninput = (e) => {
      e.target.value = formatRut(e.target.value);
    };
  }

  // Paso 1: Validación de Identidad por RUT + Fecha de Nacimiento
  if (btnVerifyId) {
    btnVerifyId.onclick = () => {
      const inputRut = recRutInput.value.trim();
      const inputBirth = recBirthInput.value;

      if (!inputRut) {
        window.showGlassAlert('Por favor ingresa tu RUT chileno.', 'warning');
        return;
      }

      const searchRutClean = cleanRut(inputRut);

      // Buscar en pacientes
      let user = PATIENTS_DATABASE.find(p => {
        const rutMatch = cleanRut(p.fileNumber) === searchRutClean;
        if (!rutMatch) return false;
        if (inputBirth && p.birthDate) {
          return p.birthDate === inputBirth;
        }
        return true;
      });

      // Si no es paciente, buscar en cuidadores
      if (!user) {
        user = CAREGIVERS_DATABASE.find(c => {
          const rutMatch = cleanRut(c.rut || '15.782.110-3') === searchRutClean;
          if (!rutMatch) return false;
          if (inputBirth && c.birthDate) {
            return c.birthDate === inputBirth;
          }
          return true;
        });
      }

      // Si es admin o doctor
      if (!user) {
        if (searchRutClean === cleanRut('9.876.543-2') && (!inputBirth || inputBirth === '1980-01-01')) {
          user = { username: 'admin', name: 'Administrador', socialName: 'Admin', fileNumber: '9.876.543-2', role: 'admin' };
        } else if (searchRutClean === cleanRut('12.842.910-7') && (!inputBirth || inputBirth === '1978-11-20')) {
          user = { username: 'doctor', name: 'Dra. Elena Valdés', socialName: 'Dra. Elena Valdés', fileNumber: '12.842.910-7', role: 'doctor' };
        }
      }

      if (!user) {
        window.showGlassAlert('No se encontró un usuario coincidente con ese RUT y fecha de nacimiento (Ley 19.628).', 'danger');
        return;
      }

      currentTargetUser = user;
      currentGeneratedOtp = Math.floor(100000 + Math.random() * 900000).toString();

      if (recVerifiedUserName) recVerifiedUserName.textContent = user.socialName || user.name;
      if (recVerifiedUserRut) recVerifiedUserRut.textContent = `RUT Validado: ${user.fileNumber || inputRut}`;
      if (recOtpCodeDisplay) recOtpCodeDisplay.textContent = currentGeneratedOtp;

      recoveryStep1.classList.add('d-none');
      recoveryStep2.classList.remove('d-none');

      window.showGlassAlert('✅ Identidad verificada con éxito. Selecciona tu canal de verificación.', 'success');
    };
  }

  // Selector de Canales Inclusivos
  function setChannelActive(activeBtn) {
    [btnChanSms, btnChanVoice, btnChanTutor].forEach(b => {
      if (b) {
        b.style.border = '1px solid rgba(255,255,255,0.15)';
        b.style.background = 'rgba(255,255,255,0.03)';
      }
    });
    if (activeBtn) {
      activeBtn.style.border = '1.5px solid #38bdf8';
      activeBtn.style.background = 'rgba(14, 165, 233, 0.15)';
    }
  }

  if (btnChanSms) {
    btnChanSms.onclick = () => {
      setChannelActive(btnChanSms);
      if (recChannelSubtext) {
        recChannelSubtext.textContent = '📨 Código enviado por SMS/Email a tu teléfono registrado. Ingresa los 6 dígitos a continuación.';
      }
      window.showGlassAlert(`SMS simulado enviado al teléfono registrado con código: ${currentGeneratedOtp}`, 'info');
    };
  }

  if (btnChanVoice) {
    btnChanVoice.onclick = () => {
      setChannelActive(btnChanVoice);
      if (recChannelSubtext) {
        recChannelSubtext.textContent = '📞 Central IVR cuidApp: Dictando código de seguridad en altavoz...';
      }
      const spelledDigits = currentGeneratedOtp.split('').join(', ');
      speakText(`Atención: Tu código de seguridad cuidApp es: ${spelledDigits}. Repito: ${spelledDigits}.`, { force: true, immediate: true });
      window.showGlassAlert('📞 Dictando código de seguridad por llamada de voz asistida.', 'success');
    };
  }

  if (btnChanTutor) {
    btnChanTutor.onclick = () => {
      setChannelActive(btnChanTutor);
      if (recChannelSubtext) {
        recChannelSubtext.textContent = '🛡️ Solicitud de desbloqueo autorizada por el cuidador/tutor acreditado en Ficha Clínica.';
      }
      window.showGlassAlert(`Asistencia de cuidador/tutor autorizada con éxito. Código: ${currentGeneratedOtp}`, 'success');
    };
  }

  // Paso 3: Guardar Nueva Contraseña
  if (formResetPass) {
    formResetPass.onsubmit = (e) => {
      e.preventDefault();
      const enteredOtp = document.getElementById('recOtpInput')?.value.trim();
      const newPass = document.getElementById('recNewPassword')?.value.trim();
      const confirmPass = document.getElementById('recConfirmPassword')?.value.trim();

      if (!enteredOtp || enteredOtp !== currentGeneratedOtp) {
        window.showGlassAlert('El código de 6 dígitos ingresado es incorrecto. Por favor verifica.', 'danger');
        return;
      }

      if (!newPass || newPass.length < 4) {
        window.showGlassAlert('La contraseña debe tener al menos 4 caracteres.', 'warning');
        return;
      }

      if (newPass !== confirmPass) {
        window.showGlassAlert('Las contraseñas no coinciden.', 'warning');
        return;
      }

      if (!currentTargetUser) {
        window.showGlassAlert('Error de sesión en el proceso de recuperación.', 'danger');
        return;
      }

      // Actualizar la contraseña en el sistema
      const res = updateUserPasswordInSystem(currentTargetUser.username || currentTargetUser.fileNumber, newPass);

      // Cerrar modal
      if (window.bootstrap && window.bootstrap.Modal) {
        const m = window.bootstrap.Modal.getInstance(modalRecoveryEl);
        if (m) m.hide();
      }
      modalRecoveryEl.classList.remove('show');
      modalRecoveryEl.style.display = 'none';
      document.body.classList.remove('modal-open');
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) backdrop.remove();

      window.showGlassAlert('🔑 ¡Contraseña actualizada exitosamente! Iniciando sesión...', 'success');

      speakText('Contraseña actualizada con éxito. Iniciando sesión en tu portal.', { force: true, immediate: true });

      // Iniciar sesión de inmediato según rol
      if (res.role === 'patient') {
        handleLoginSuccess({ role: 'patient', patient: res.user });
      } else if (res.role === 'caregiver') {
        handleLoginSuccess({ role: 'caregiver', caregiver: res.user });
      } else if (res.role === 'admin') {
        handleLoginSuccess({ role: 'admin' });
      } else if (res.role === 'doctor') {
        handleLoginSuccess({ role: 'doctor' });
      }
    };
  }
}

export {};