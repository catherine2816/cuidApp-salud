# 🩺 cuidApp - Ecosistema Clínico Integrado, Telemetría IoT y Telecuidado

[![Vite](https://img.shields.io/badge/Vite-8.1.2-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Bootstrap 5](https://img.shields.io/badge/Bootstrap-5.3.2-7952B3?logo=bootstrap&logoColor=white)](https://getbootstrap.com/)
[![GlassKit](https://img.shields.io/badge/Design-GlassKit%20UI-0ea5e9)](https://cuidapp.cl)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-10b981?logo=pwa&logoColor=white)](public/manifest.json)
[![Capacitor Android](https://img.shields.io/badge/Capacitor-Android%20APK-3dc2ff?logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![Normativa MINSAL](https://img.shields.io/badge/MINSAL-DS%20N%C2%B0%2041%20%7C%20Ley%2020.584-ef4444)](#marco-normativo-y-legal-chileno)

**cuidApp** es una plataforma integral de salud digital y telecuidado diseñada bajo estándares chilenos de interoperabilidad clínica, telemetría cardiovascular en tiempo real y asistencia inclusiva para pacientes, cuidadores, profesionales médicos y administradores de salud.

---

## 📑 Tabla de Contenidos
1. [Marco Normativo y Legal Chileno](#marco-normativo-y-legal-chileno)
2. [Arquitectura Modular del Código (`src/`)](#arquitectura-modular-del-código-src)
3. [Credenciales Demo de Acceso Rápido (4 Roles)](#credenciales-demo-de-acceso-rápido-4-roles)
4. [Instalación y Ejecución en Desarrollo](#instalación-y-ejecución-en-desarrollo)
5. [Compilación para Producción](#compilación-para-producción)
6. [Empaquetado como App Nativa Android (APK) con Capacitor](#empaquetado-como-app-nativa-android-apk-con-capacitor)
7. [PWA e Instalación Directa](#pwa-e-instalación-directa)

---

## ⚖️ Marco Normativo y Legal Chileno

La arquitectura y los flujos de datos de **cuidApp** cumplen estrictamente con la legislación sanitaria y de derechos del paciente en Chile:

- **Decreto Supremo N° 41 MINSAL:** Reglamento de Fichas Clínicas. Estructura inalterable de evoluciones, recetas, anamnesis y libro de auditoría de accesos.
- **Ley N° 20.584:** Derechos y Deberes de las Personas en Salud. Acceso directo y transparente del paciente a sus antecedentes, consentimiento informado y protección de la confidencialidad.
- **Ley N° 21.541:** Regulación de la atención médica remota mediante Telemedicina y Telemonitoreo domiciliario.
- **Ley N° 21.668:** Interoperabilidad de Fichas Clínicas en la Red Asistencial (Exportación HL7 FHIR / JSON).
- **Ley N° 21.120:** Reconocimiento y protección a la Identidad de Género (respeto estricto a Nombre Social y género registral).
- **Ley N° 21.430:** Garantías y Protección Integral de los Derechos de la Niñez y Adolescencia (autonomía progresiva en adolescentes CLAP).
- **Ley N° 21.545 (Ley TEA):** Atención preferente e inclusión de personas en el espectro autista y neurodivergencias.
- **Ley N° 19.628:** Protección de la Vida Privada y Tratamiento de Datos Personales Sensibles en Salud.

---

## 🏗️ Arquitectura Modular del Código (`src/`)

El código fuente está desacoplado funcionalmente en módulos especializados dentro de `src/`:

```
cuidApp-demo-main/
├── public/
│   ├── favicon.svg             # Ícono vectorial de la aplicación
│   ├── icons.svg               # Biblioteca de íconos SVG
│   └── manifest.json           # Manifiesto oficial PWA (instalación en Android/iOS)
├── src/
│   ├── main.js                 # Orquestador central, enrutamiento RBAC y Web Speech API
│   ├── auth.js                 # Autenticación, Registro Universal inclusivo e IVR
│   ├── paciente.js             # Portal del Paciente (Adulto Mayor, Gestante, Adolescente)
│   ├── cuidador.js             # Portal del Cuidador, Signos Vitales, Triage, GPS y Urgencias
│   ├── medico.js               # Portal Médico y Registro Clínico Electrónico (RCE DS 41)
│   ├── medico-especialidades.js# Catálogos clínicos multi-especialidad y códigos CIE-10
│   ├── pediatrico.js           # Portal Pediátrico, Curvas OMS, PNI y Carnet con IA
│   ├── admin.js                # Panel de Administración, Trazabilidad y Auditoría Forense
│   ├── iot-ecg.js              # Telemetría Hospitalaria 250 Hz (AD8232 / Web Serial / MQTT)
│   ├── odontologia.js          # Odontograma anatómico FDI digital y tratamientos GES
│   ├── data.js                 # Catálogo extensible de patologías GES y perfiles demo
│   ├── style.css               # Estilos globales GlassKit UI y diseño responsivo
│   ├── assets/
│   │   └── glasskit/glasskit.css # Tokens de diseño Glassmorphism médico
│   └── utils/
│       ├── clinical-helpers.js # STORAGE_KEYS centralizadas, cálculo de edad y fechas
│       └── theme-manager.js    # Modo Día / Noche y accesibilidad WCAG 2.1 AA
├── index.html                  # Shell HTML con viewport móvil y enlace al manifiesto PWA
└── package.json                # Configuración de dependencias y scripts Vite
```

### Responsabilidad de los Módulos Principales
| Archivo | Responsabilidad Principal |
|---|---|
| `main.js` | Enrutamiento reactivo por roles, control de sesiones activas, orquestación del DOM, accesibilidad con locución por voz (`speakText`). |
| `auth.js` | Login 1-Click para demo, validación de RUT con algoritmo Módulo 11 oficial, registro multi-documento (RUT, NIC/NIP provisorio, Pasaporte extranjero) y recuperación asistida por audio/IVR. |
| `cuidador.js` | Control diario de pacientes asignados, ingreso de parámetros basales (PA, FC, SpO2, Temp, Glicemia), geolocalización GPS de emergencia (`navigator.geolocation`) y soporte multi-idioma (Español, Créole, Portugués, Inglés, Mapuzugun). |
| `paciente.js` | Vista adaptada para el titular. Incluye Modo Senior (botones gigantes de 60-80px de alto contraste), Carnet Prenatal Interactivo para embarazadas, confidencialidad para adolescentes y simulador de llamadas telefónicas IVR. |
| `medico.js` / `medico-especialidades.js` | Ficha Clínica RCE normativa DS 41. Anamnesis próxima y remota, examen físico por aparatos, selector CIE-10 MINSAL, emisión de recetas electrónicas y visualización de telemetría cardiovascular. |
| `pediatrico.js` | Curvas antropométricas oficiales OMS (Peso/Edad, Talla/Edad, IMC/Edad) graficadas con Chart.js, seguimiento de vacunas PNI y código QR de emergencia pediátrica. |
| `iot-ecg.js` | Monitor electrocardiográfico multiparámetro hospitalario (Derivación II, 250 Hz, 25 mm/s, 10 mm/mV) con cursor de barrido osciloscópico, detección de arritmias y persistencia de trazados. |
| `admin.js` | Cuadro de mando (KPIs), auditoría forense de accesos a fichas clínicas según Ley 19.628 y vinculación autorizada de cuidadores y tutores legales. |
| `utils/clinical-helpers.js` | Centralización de claves maestras de almacenamiento (`STORAGE_KEYS`), cálculo determinista de edad y formateo de fechas estándar chileno. |

---

## 🔑 Credenciales Demo de Acceso Rápido (4 Roles)

El sistema cuenta con un panel **1-Click Login** en la pantalla de inicio para probar todos los perfiles clínicos de inmediato:

| Rol | Usuario | Contraseña | Perfil Clínico / Demostración |
|---|---|---|---|
| 🛡️ **Administrador** | `admin` | `admin123` | **Administrador Central**: Auditoría forense Ley 19.628, trazabilidad DS 41, gestión de usuarios y métricas globales. |
| 🩺 **Médico** | `doctor` | `doctor123` | **Dra. Elena Valdés**: Registro Clínico Electrónico (RCE), evoluciones multi-especialidad, CIE-10 y prescripción de fármacos. |
| 🤝 **Cuidadora** | `sofia` | `sofia123` | **Sofía Díaz**: Gestión domiciliaria, registro de signos vitales, triage en vivo, administración de remedios y GPS de urgencias. |
| 👴 **Adulto Mayor** | `juan` | `juan123` | **Juan Díaz (76 años)**: Hipertensión, Artrosis, Cardiopatía. Modo Senior de alto contraste y Telemetría ECG IoT en vivo. |
| 🧒 **Pediátrico** | `mateo` | `mateo123` | **Mateo Morales (7 años)**: TEA Grado 2 (Ley 21.545), Curvas de Crecimiento OMS, carnet PNI y QR de urgencia con su tutora. |
| 🎒 **Adolescente** | `camila` | `1234` | **Camila Soto (14 años)**: Control CLAP / MINSAL, asma leve, autonomía progresiva y portal confidencial Ley 21.430. |
| 👩‍👧 **Madre / Tutora** | `valentina` | `1234` | **Valentina Rojas (32 años)**: Tutora legal acreditada con acceso supervisado a la ficha pediátrica de su hijo Lucas. |
| 🤰 **Gestante** | `daniela` | `1234` | **Daniela Morales (28 años)**: Embarazo 24 semanas. Carnet Prenatal Digital, control perinatal y registro de nacimiento postparto. |

---

## 💻 Instalación y Ejecución en Desarrollo

### Prerrequisitos
- **Node.js** v18.0.0 o superior
- **npm** v9.0.0 o superior

### Pasos de Ejecución
```bash
# 1. Ingresar al directorio del proyecto
cd cuidApp-demo-main

# 2. Instalar dependencias del proyecto
npm install

# 3. Iniciar el servidor local de desarrollo con Vite
npm run dev
```

El servidor estará disponible de forma inmediata en:
👉 **`http://localhost:5173/`**

---

## 📦 Compilación para Producción

Para generar el paquete optimizado y minificado para despliegue web:

```bash
# Compilar los bundles HTML, CSS y JS en la carpeta dist/
npm run build

# Previsualizar localmente el build de producción
npm run preview
```

---

## 📱 Empaquetado como App Nativa Android (APK) con Capacitor

**cuidApp** está completamente preparada para empaquetarse como aplicación nativa Android (APK / AAB) utilizando **Capacitor**:

### 1. Instalar Capacitor en el Proyecto
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
```

### 2. Inicializar la Configuración de Capacitor
```bash
npx cap init "cuidApp" "cl.cuidapp.salud" --web-dir dist
```

### 3. Compilar el Frontend Web
```bash
npm run build
```

### 4. Agregar la Plataforma Android
```bash
npx cap add android
```
*(Esto creará la carpeta nativa `android/` con el proyecto Gradle completo para Android Studio)*.

### 5. Sincronizar Assets Web con el Proyecto Nativo
```bash
npx cap sync android
```

### 6. Abrir en Android Studio y Generar el APK
```bash
npx cap open android
```
- En Android Studio, ve a **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
- El archivo ejecutable `.apk` se generará en `android/app/build/outputs/apk/debug/app-debug.apk` listo para instalar en cualquier teléfono o tablet Android.

---

## 🌐 PWA e Instalación Directa

Gracias al archivo `public/manifest.json` y a los metadatos integrados en `index.html`:
- **Android / Chrome:** Al navegar a la aplicación, aparecerá el aviso automático *"Agregar cuidApp a la pantalla principal"*.
- **iOS / Safari:** Al presionar el botón Compartir > *"Agregar al inicio"*, cuidApp se instalará como aplicación independiente (Standalone) sin barra de navegación del navegador, con estética nativa de pantalla completa.
- **Iconos adaptables:** Compatible con íconos vectoriales SVG escalables a cualquier densidad de pantalla (192x192 y 512x512).

---

## 🔒 Privacidad y Seguridad
Este software procesa información de salud confidencial. Todo almacenamiento local en cliente se realiza mediante claves aisladas y cifradas lógicamente bajo el principio de minimización de datos (Ley N° 19.628). La exportación de datos interoperables se rige por el estándar **HL7 FHIR Release 4** (Ley N° 21.668).
