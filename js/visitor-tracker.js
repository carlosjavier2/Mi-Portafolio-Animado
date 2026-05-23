/**
 * ==========================================================================
 * RASTREADOR DE VISITAS AUTOMÁTICO (MÓDULO ES6)
 * ==========================================================================
 * Este script se ejecuta en cada página del portafolio. Registra la visita,
 * incrementando los contadores globales y guardando un log detallado.
 */

import { db, isConfigured } from "./firebase-config.js";
import { doc, setDoc, updateDoc, increment, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Obtener el identificador legible de la página actual
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

// Detectar categoría del dispositivo del usuario
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

// Obtener detalles simplificados del navegador/SO
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

// Función principal para registrar la visita
async function trackVisit() {
  const pageKey = getPageKey();
  const device = getBrowserDetails();
  const referrer = document.referrer ? new URL(document.referrer).hostname : "Directo";
  const timestamp = new Date().toISOString();

  console.log(`🤖 Registrando visita en página: [${pageKey}]`);

  if (isConfigured) {
    try {
      // 1. Incrementar contadores globales en Firestore
      const counterRef = doc(db, "metrics", "global_counters");
      
      // Intentamos actualizar, si no existe el documento, lo creamos
      try {
        await updateDoc(counterRef, {
          total_views: increment(1),
          [`page_${pageKey}`]: increment(1)
        });
      } catch (err) {
        // Si falla porque no existe, inicializamos el documento
        await setDoc(counterRef, {
          total_views: 1,
          page_inicio: pageKey === "inicio" ? 1 : 0,
          page_sobre_mi: pageKey === "sobre_mi" ? 1 : 0,
          page_proyectos: pageKey === "proyectos" ? 1 : 0,
          page_contacto: pageKey === "contacto" ? 1 : 0
        }, { merge: true });
      }

      // 2. Registrar el log de visitas individual
      await addDoc(collection(db, "visits_log"), {
        page: pageKey,
        device: device,
        referrer: referrer,
        timestamp: serverTimestamp()
      });

      console.log("⚡ Visita registrada en la nube.");
    } catch (error) {
      console.error("❌ Error al guardar datos en Firebase:", error);
    }
  } else {
    // Modo Simulación Local usando localStorage si Firebase no está activo
    simulateLocalVisit(pageKey, device, referrer, timestamp);
  }
}

// Simulación de visitas locales con localStorage
function simulateLocalVisit(pageKey, device, referrer, timestamp) {
  // Obtener o inicializar métricas globales
  let localMetrics = JSON.parse(localStorage.getItem("admin_local_metrics")) || {
    total_views: 0,
    page_inicio: 0,
    page_sobre_mi: 0,
    page_proyectos: 0,
    page_contacto: 0
  };

  localMetrics.total_views += 1;
  const key = `page_${pageKey}`;
  if (localMetrics[key] !== undefined) {
    localMetrics[key] += 1;
  } else {
    localMetrics[key] = 1;
  }
  localStorage.setItem("admin_local_metrics", JSON.stringify(localMetrics));

  // Obtener o inicializar log de visitas
  let localLogs = JSON.parse(localStorage.getItem("admin_local_logs")) || [];
  localLogs.unshift({
    page: pageKey,
    device: device,
    referrer: referrer,
    timestamp: timestamp
  });

  // Limitar a los últimos 50 logs para rendimiento
  if (localLogs.length > 50) localLogs.pop();
  localStorage.setItem("admin_local_logs", JSON.stringify(localLogs));

  console.log("📝 [Modo Demo] Visita registrada en almacenamiento local de prueba.");
}

// Iniciar rastreo cuando el documento esté cargado
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", trackVisit);
} else {
  trackVisit();
}
