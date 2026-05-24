/**
 * ==========================================================================
 * RASTREADOR DE VISITAS UNICIDAD Y SESIONES (MÓDULO ES6)
 * ==========================================================================
 * Este script identifica a cada visitante de forma única mediante un ID persistente
 * en localStorage. Registra las analíticas en la colección 'users_analytics'
 * de Cloud Firestore, manejando de forma inteligente la distinción entre
 * una nueva sesión y la navegación, y guardando el historial de páginas vistas
 * de forma individual en un mapa 'paginas_vistas'.
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
// ANÁLISIS DE DISPOSITIVO, ENTORNO Y SECCIÓN ACTUAL
// ==========================================================================

/**
 * Obtiene la clave de sección a partir de la URL actual.
 * @returns {string} Clave de la página (ej: 'inicio', 'sobre_mi', 'proyectos')
 */
function getPageKey() {
  const path = window.location.pathname;
  const page = path.substring(path.lastIndexOf("/") + 1);
  
  if (page === "" || page === "index.html") return "inicio";
  if (page === "sobre-mi.html") return "sobre_mi";
  if (page === "proyectos.html") return "proyectos";
  if (page === "contacto.html") return "contacto";
  
  // Para páginas de detalle de proyectos u otras
  return page.replace(".html", "").replace(/-/g, "_");
}

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
  const pageKey = getPageKey();
  const device = getBrowserDetails();
  const timestamp = new Date().toISOString();

  console.log(`🤖 [UID: ${uid}] | Nueva pág: [${pageKey}] | Nuevo Usr: ${isNewUser} | Nueva Sesión: ${isNewSession}`);

  if (isConfigured) {
    try {
      const userDocRef = doc(db, "users_analytics", uid);

      if (isNewUser) {
        // REGISTRO DE NUEVO USUARIO
        // Se crea el documento inicializando la sección actual en 'paginas_vistas'
        await setDoc(userDocRef, {
          first_visit: serverTimestamp(),
          last_visit: serverTimestamp(),
          device: device,
          total_sessions: 1,
          paginas_vistas: {
            [pageKey]: 1
          }
        });
        console.log(`⚡ Firestore: Creado perfil único [${uid}] con vista inicial a [${pageKey}].`);
      } else {
        // USUARIO EXISTENTE DE RETORNO
        if (isNewSession) {
          // Incrementa sesiones y suma +1 en la página visitada
          await updateDoc(userDocRef, {
            last_visit: serverTimestamp(),
            total_sessions: increment(1),
            [`paginas_vistas.${pageKey}`]: increment(1)
          });
          console.log(`⚡ Firestore: Sesión (+1) y pág [${pageKey}] (+1) para el usuario [${uid}].`);
        } else {
          // Navegación en la misma sesión: Solo suma +1 a la página y actualiza last_visit
          await updateDoc(userDocRef, {
            last_visit: serverTimestamp(),
            [`paginas_vistas.${pageKey}`]: increment(1)
          });
          console.log(`⚡ Firestore: Actividad interna. Pág [${pageKey}] (+1) para el usuario [${uid}].`);
        }
      }
    } catch (error) {
      console.error("❌ Error al persistir datos en Firebase Firestore:", error);
    }
  } else {
    // Fallback de Simulación Local
    simulateLocalUserAnalytics(uid, isNewUser, isNewSession, pageKey, device, timestamp);
  }
}

// ==========================================================================
// SIMULACIÓN DE MÉTRICAS LOCALES (MODO DEMO)
// ==========================================================================

function simulateLocalUserAnalytics(uid, isNewUser, isNewSession, pageKey, device, timestamp) {
  let localUsers = JSON.parse(localStorage.getItem("admin_local_users_analytics")) || {};

  if (isNewUser || !localUsers[uid]) {
    // Crear entrada de simulación nueva con el mapa de páginas vistas inicializado
    localUsers[uid] = {
      first_visit: timestamp,
      last_visit: timestamp,
      device: device,
      total_sessions: 1,
      paginas_vistas: {
        [pageKey]: 1
      }
    };
    console.log(`📝 [Modo Demo] Perfil local creado para [${uid}] con vista inicial a [${pageKey}].`);
  } else {
    // Actualizar usuario de retorno local
    localUsers[uid].last_visit = timestamp;
    
    // Inicializar mapa de páginas si no existe
    if (!localUsers[uid].paginas_vistas) {
      localUsers[uid].paginas_vistas = {};
    }
    
    localUsers[uid].paginas_vistas[pageKey] = (localUsers[uid].paginas_vistas[pageKey] || 0) + 1;

    if (isNewSession) {
      localUsers[uid].total_sessions += 1;
      console.log(`📝 [Modo Demo] Sesión (+1) y pág [${pageKey}] (+1) local para [${uid}].`);
    } else {
      console.log(`📝 [Modo Demo] Pág [${pageKey}] (+1) local para [${uid}].`);
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
