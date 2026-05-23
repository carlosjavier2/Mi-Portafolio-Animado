/**
 * ==========================================================================
 * RASTREADOR DE VISITAS UNICIDAD Y SESIONES (MÓDULO ES6)
 * ==========================================================================
 * Este script identifica a cada visitante de forma única mediante un ID persistente
 * en localStorage. Registra las analíticas en la colección 'users_analytics'
 * de Cloud Firestore, manejando de forma inteligente la distinción entre
 * una nueva sesión (pestaña nueva / primera carga) y la navegación entre páginas.
 */

import { db, isConfigured } from "./firebase-config.js";
import { doc, setDoc, updateDoc, increment, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================================================
// DETECCIÓN DE USUARIO ÚNICO Y CONTROL DE SESIÓN
// ==========================================================================

const UID_STORAGE_KEY = "carlos_portfolio_uid";
const SESSION_STORAGE_KEY = "carlos_portfolio_session_active";

/**
 * Obtiene el ID único del usuario desde localStorage o genera uno nuevo.
 * @returns {Object} { uid: string, isNewUser: boolean }
 */
function getOrCreateUserId() {
  let uid = localStorage.getItem(UID_STORAGE_KEY);
  let isNewUser = false;

  if (!uid) {
    const timestamp = Math.floor(Date.now() / 1000);
    // Generar un sufijo aleatorio de 4 dígitos para robustez extra contra colisiones
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    uid = `usr_${timestamp}${randomSuffix}`;
    localStorage.setItem(UID_STORAGE_KEY, uid);
    isNewUser = true;
  }

  return { uid, isNewUser };
}

/**
 * Controla si esta carga de página corresponde a una nueva sesión de navegación.
 * @returns {boolean} true si es una nueva sesión en este navegador/pestaña
 */
function checkIsNewSession() {
  const sessionActive = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!sessionActive) {
    sessionStorage.setItem(SESSION_STORAGE_KEY, "true");
    return true; // Es el primer hit de esta sesión en la pestaña
  }
  return false; // El usuario ya está navegando dentro del sitio en esta pestaña
}

// ==========================================================================
// ANÁLISIS DE DISPOSITIVO Y ENTORNO
// ==========================================================================

function getDeviceType() {
  const ua = navigator.userAgent;
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return "Tablet";
  }
  if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) {
    return "Móvil";
  }
  return "Escritorio";
}

function getBrowserDetails() {
  const ua = navigator.userAgent;
  let os = "Desconocido";
  if (ua.indexOf("Win") !== -1) os = "Windows";
  else if (ua.indexOf("Mac") !== -1) os = "macOS";
  else if (ua.indexOf("Linux") !== -1) os = "Linux";
  else if (ua.indexOf("Android") !== -1) os = "Android";
  else if (ua.indexOf("like Mac") !== -1) os = "iOS";

  let browser = "Navegador";
  if (ua.indexOf("Chrome") !== -1) browser = "Chrome";
  else if (ua.indexOf("Safari") !== -1) browser = "Safari";
  else if (ua.indexOf("Firefox") !== -1) browser = "Firefox";
  else if (ua.indexOf("MSIE") !== -1 || !!document.documentMode === true) browser = "IE";
  
  return `${getDeviceType()} (${os} - ${browser})`;
}

// ==========================================================================
// FUNCIÓN PRINCIPAL DE RASTREO
// ==========================================================================

async function trackUserAnalytics() {
  const { uid, isNewUser } = getOrCreateUserId();
  const isNewSession = checkIsNewSession();
  const device = getBrowserDetails();
  const timestamp = new Date().toISOString();

  console.log(`🤖 [UID: ${uid}] | Nuevo Usuario: ${isNewUser} | Nueva Sesión: ${isNewSession}`);

  if (isConfigured) {
    try {
      const userDocRef = doc(db, "users_analytics", uid);

      if (isNewUser) {
        // REGISTRO DE NUEVO USUARIO
        // Se crea el documento con la sesión inicial y timestamps coincidentes
        await setDoc(userDocRef, {
          first_visit: serverTimestamp(),
          last_visit: serverTimestamp(),
          device: device,
          total_sessions: 1
        });
        console.log(`⚡ Firestore: Creado perfil único de usuario [${uid}].`);
      } else {
        // USUARIO EXISTENTE DE RETORNO
        if (isNewSession) {
          // Si el usuario ya existe y abre una nueva sesión (ej: nueva pestaña o vuelve más tarde)
          // Incrementamos total_sessions y actualizamos la última visita
          await updateDoc(userDocRef, {
            last_visit: serverTimestamp(),
            total_sessions: increment(1)
          });
          console.log(`⚡ Firestore: Sesión incrementada (+1) para el usuario [${uid}].`);
        } else {
          // Si es solo navegación interna dentro de la misma sesión activa
          // Únicamente actualizamos la marca de la última página vista sin inflar las sesiones
          await updateDoc(userDocRef, {
            last_visit: serverTimestamp()
          });
          console.log(`⚡ Firestore: Actualizada marca de actividad last_visit para [${uid}].`);
        }
      }
    } catch (error) {
      console.error("❌ Error al persistir datos en Firebase Firestore:", error);
    }
  } else {
    // Fallback de Simulación Local
    simulateLocalUserAnalytics(uid, isNewUser, isNewSession, device, timestamp);
  }
}

// ==========================================================================
// SIMULACIÓN DE MÉTRICAS LOCALES (MODO DEMO)
// ==========================================================================

function simulateLocalUserAnalytics(uid, isNewUser, isNewSession, device, timestamp) {
  let localUsers = JSON.parse(localStorage.getItem("admin_local_users_analytics")) || {};

  if (isNewUser || !localUsers[uid]) {
    // Crear entrada de simulación nueva
    localUsers[uid] = {
      first_visit: timestamp,
      last_visit: timestamp,
      device: device,
      total_sessions: 1
    };
    console.log(`📝 [Modo Demo] Perfil local creado para [${uid}].`);
  } else {
    // Actualizar usuario de retorno local
    localUsers[uid].last_visit = timestamp;
    if (isNewSession) {
      localUsers[uid].total_sessions += 1;
      console.log(`📝 [Modo Demo] Incrementada sesión (+1) local para [${uid}].`);
    } else {
      console.log(`📝 [Modo Demo] Actualizado last_visit local para [${uid}].`);
    }
  }

  localStorage.setItem("admin_local_users_analytics", JSON.stringify(localUsers));
}

// Inicializar cuando la carga del documento comience
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", trackUserAnalytics);
} else {
  trackUserAnalytics();
}
