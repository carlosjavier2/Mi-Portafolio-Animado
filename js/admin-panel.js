/**
 * ==========================================================================
 * PANEL DE ANALÍTICAS ADMINISTRATIVO (MÓDULO ES6 + GSAP)
 * ==========================================================================
 * Lógica del panel secreto. Detecta el disparador secreto, inyecta la
 * interfaz glassmorphic, consulta los datos de Firebase (o simulados)
 * y ejecuta micro-animaciones premium ultra fluidas usando GSAP.
 */

import { db, isConfigured } from "./firebase-config.js";
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================================================
// CONFIGURACIÓN Y ESTADO
// ==========================================================================
const SECRET_WORD = "admin";
let typedSequence = "";
let clickCount = 0;
let clickTimer = null;
let isPanelOpen = false;
let adminOverlayEl = null;

// ==========================================================================
// INICIALIZACIÓN Y CAPTURA DE DISPARADORES
// ==========================================================================
function initTriggers() {
  console.log("🔒 Sistema de Acceso Secreto Inicializado.");

  // Disparador 1: Atajo de teclado (Ctrl + Shift + A)
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "a") {
      e.preventDefault();
      openAdminPanel();
    }
  });

  // Disparador 2: Escribir consecutivamente la palabra "admin"
  document.addEventListener("keypress", (e) => {
    // Evitar registrar si se está escribiendo en campos de formulario (como el de contacto)
    if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA") {
      return;
    }
    
    const key = e.key.toLowerCase();
    typedSequence += key;
    
    // Mantener la secuencia de teclas con la misma longitud que la palabra secreta
    if (typedSequence.length > SECRET_WORD.length) {
      typedSequence = typedSequence.substring(typedSequence.length - SECRET_WORD.length);
    }
    
    if (typedSequence === SECRET_WORD) {
      typedSequence = "";
      openAdminPanel();
    }
  });

  // Disparador 3: Triple clic sobre el logo principal de la cabecera (Mobile friendly!)
  const logoElements = document.querySelectorAll(".logo");
  logoElements.forEach((logo) => {
    logo.style.cursor = "pointer";
    logo.addEventListener("click", (e) => {
      e.preventDefault();
      clickCount++;
      
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        clickCount = 0;
      }, 500); // 500ms para completar el triple click

      if (clickCount === 3) {
        clickCount = 0;
        openAdminPanel();
      }
    });
  });
}

// ==========================================================================
// INYECCIÓN DE LA INTERFAZ DE ADMINISTRACIÓN
// ==========================================================================
function injectAdminPanelDOM() {
  if (document.getElementById("admin-secure-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "admin-secure-overlay";
  overlay.className = "admin-overlay";
  overlay.innerHTML = `
    <div class="admin-panel" id="admin-panel-container">
      <div class="admin-panel-header">
        <div class="admin-header-title">
          <span class="pulse-dot"></span>
          SECURITY PROTOCOL // VISITOR ANALYTICS
        </div>
        <button class="admin-close-btn" id="admin-close-btn" aria-label="Cerrar Panel">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="admin-panel-content">
        <!-- Tarjeta Principal: Total de Visitas -->
        <div class="admin-metric-card total-card">
          <div class="card-label">TOTAL VISITS // OVERALL</div>
          <div class="card-value" id="admin-stat-total">0000</div>
          <div class="card-footer">SYSTEM ONLINE & TRACKING</div>
        </div>

        <!-- Secciones Secundarias: Columnas de Estadísticas y Logs -->
        <div class="admin-grid">
          <!-- Columna Izquierda: Estadísticas de Páginas -->
          <div class="admin-section-box">
            <h3 class="box-title">PAGE PENETRATION // METRICS</h3>
            
            <div class="page-stat-item">
              <div class="page-info-row">
                <span class="page-name">INICIO (/)</span>
                <span class="page-count-val" id="count-inicio">0</span>
              </div>
              <div class="page-bar-bg"><div class="page-bar-fill" id="bar-inicio"></div></div>
            </div>

            <div class="page-stat-item">
              <div class="page-info-row">
                <span class="page-name">SOBRE MÍ (/sobre-mi)</span>
                <span class="page-count-val" id="count-sobre-mi">0</span>
              </div>
              <div class="page-bar-bg"><div class="page-bar-fill" id="bar-sobre-mi"></div></div>
            </div>

            <div class="page-stat-item">
              <div class="page-info-row">
                <span class="page-name">PROYECTOS (/proyectos)</span>
                <span class="page-count-val" id="count-proyectos">0</span>
              </div>
              <div class="page-bar-bg"><div class="page-bar-fill" id="bar-proyectos"></div></div>
            </div>

            <div class="page-stat-item">
              <div class="page-info-row">
                <span class="page-name">CONTACTO (/contacto)</span>
                <span class="page-count-val" id="count-contacto">0</span>
              </div>
              <div class="page-bar-bg"><div class="page-bar-fill" id="bar-contacto"></div></div>
            </div>
          </div>

          <!-- Columna Derecha: Registro de Visitas Recientes (Feed) -->
          <div class="admin-section-box">
            <h3 class="box-title">LIVE FEED // LAST VISITS</h3>
            <div class="logs-feed-container" id="admin-logs-feed">
              <div class="log-entry loading">Esperando conexión de datos...</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  adminOverlayEl = overlay;

  // Registrar eventos de cierre
  document.getElementById("admin-close-btn").addEventListener("click", closeAdminPanel);
  
  // Cerrar al hacer clic en el velo de fondo (fuera de la ventana)
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeAdminPanel();
  });

  // Cerrar con la tecla Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isPanelOpen) closeAdminPanel();
  });

  // Pre-configuración del estado inicial con GSAP para evitar flash visual
  gsap.set(overlay, { display: "none", opacity: 0 });
  gsap.set("#admin-panel-container", { scale: 0.9, y: 50, opacity: 0 });
}

// ==========================================================================
// CONSULTA DE DATOS (FIREBASE O SIMULACIÓN LOCAL)
// ==========================================================================
async function fetchAnalyticsData() {
  let stats = {
    total_views: 0,
    page_inicio: 0,
    page_sobre_mi: 0,
    page_proyectos: 0,
    page_contacto: 0
  };
  
  let visitsLog = [];

  if (isConfigured) {
    try {
      // 1. Obtener contadores globales
      const counterRef = doc(db, "metrics", "global_counters");
      const snap = await getDoc(counterRef);
      if (snap.exists()) {
        stats = snap.data();
      }

      // 2. Obtener las últimas 10 visitas de la bitácora
      const logColRef = collection(db, "visits_log");
      const q = query(logColRef, orderBy("timestamp", "desc"), limit(10));
      const logSnap = await getDocs(q);
      
      logSnap.forEach((doc) => {
        const item = doc.data();
        visitsLog.push({
          page: item.page,
          device: item.device,
          referrer: item.referrer,
          timestamp: item.timestamp?.toDate ? item.timestamp.toDate().toISOString() : new Date().toISOString()
        });
      });
    } catch (error) {
      console.error("❌ Error al obtener datos de Firebase:", error);
    }
  } else {
    // Recuperar simulación de localStorage
    stats = JSON.parse(localStorage.getItem("admin_local_metrics")) || stats;
    visitsLog = JSON.parse(localStorage.getItem("admin_local_logs")) || [];
    visitsLog = visitsLog.slice(0, 10);
  }

  return { stats, visitsLog };
}

// Formatear tiempos relativos simples (ej: "hace 2 min")
function getRelativeTimeString(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 60) return "ahora mismo";
  if (diffMin === 1) return "hace 1 min";
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffHr === 1) return "hace 1 hora";
  return `hace ${diffHr} horas`;
}

// Renderizar la información de visitas
function populateUI(data) {
  const { stats, visitsLog } = data;

  // Iniciar animación de números incrementales con GSAP
  animateCounter("admin-stat-total", stats.total_views || 0);
  animateCounter("count-inicio", stats.page_inicio || 0);
  animateCounter("count-sobre-mi", stats.page_sobre_mi || 0);
  animateCounter("count-proyectos", stats.page_proyectos || 0);
  animateCounter("count-contacto", stats.page_contacto || 0);

  // Calcular y animar las barras de porcentaje
  const total = stats.total_views || 1; // Evitar división por cero
  animateProgressBar("bar-inicio", ((stats.page_inicio || 0) / total) * 100);
  animateProgressBar("bar-sobre-mi", ((stats.page_sobre_mi || 0) / total) * 100);
  animateProgressBar("bar-proyectos", ((stats.page_proyectos || 0) / total) * 100);
  animateProgressBar("bar-contacto", ((stats.page_contacto || 0) / total) * 100);

  // Renderizar log de visitas
  const logFeedContainer = document.getElementById("admin-logs-feed");
  logFeedContainer.innerHTML = "";

  if (visitsLog.length === 0) {
    logFeedContainer.innerHTML = `<div class="log-entry empty">Ninguna visita registrada aún en la base de datos.</div>`;
    return;
  }

  visitsLog.forEach((log) => {
    const entry = document.createElement("div");
    entry.className = "log-entry";
    
    // Definir iconos o colores para las páginas
    let badgeClass = "badge-other";
    if (log.page === "inicio") badgeClass = "badge-inicio";
    else if (log.page === "sobre_mi") badgeClass = "badge-sobre-mi";
    else if (log.page === "proyectos") badgeClass = "badge-proyectos";
    else if (log.page === "contacto") badgeClass = "badge-contacto";

    const relativeTime = getRelativeTimeString(log.timestamp);
    const pageName = log.page.toUpperCase().replace("_", " ");

    entry.innerHTML = `
      <div class="log-header-row">
        <span class="log-badge ${badgeClass}">${pageName}</span>
        <span class="log-time">${relativeTime}</span>
      </div>
      <div class="log-details">
        <span class="log-device" title="${log.device}">🖥️ ${log.device}</span>
        <span class="log-ref">🔗 ${log.referrer}</span>
      </div>
    `;
    logFeedContainer.appendChild(entry);
  });
}

// ==========================================================================
// ANIMACIONES PREMIUM CON GSAP
// ==========================================================================

// Animador incremental de números
function animateCounter(elementId, targetValue) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const countObj = { val: 0 };
  
  gsap.to(countObj, {
    val: targetValue,
    duration: 1.5,
    ease: "power3.out",
    snap: "val",
    onUpdate: () => {
      // Formatear números con ceros a la izquierda para el total principal
      if (elementId === "admin-stat-total") {
        element.innerText = String(Math.floor(countObj.val)).padStart(4, "0");
      } else {
        element.innerText = Math.floor(countObj.val).toLocaleString();
      }
    }
  });
}

// Animador de ancho para barras de progreso
function animateProgressBar(elementId, percentage) {
  const bar = document.getElementById(elementId);
  if (!bar) return;

  // Animación del ancho optimizada por GPU usando scaleX (evita reflow de width)
  // Pero al ser una barra simple, usaremos transform-origin y scaleX
  gsap.fromTo(bar, 
    { scaleX: 0, transformOrigin: "left center" }, 
    { scaleX: percentage / 100, duration: 1.4, ease: "power4.out", delay: 0.2 }
  );
}

// Animación de apertura del panel
async function openAdminPanel() {
  if (isPanelOpen) return;
  isPanelOpen = true;

  // Inyectar DOM si es la primera vez
  injectAdminPanelDOM();

  const overlay = adminOverlayEl;
  const container = document.getElementById("admin-panel-container");

  // Crear la línea de tiempo de entrada
  const tl = gsap.timeline({
    defaults: { ease: "power3.out" }
  });

  // Mostrar el overlay e iniciar la carga de datos en paralelo
  tl.to(overlay, {
    display: "flex",
    opacity: 1,
    backdropFilter: "blur(18px)",
    duration: 0.6
  });

  // Traer el panel con un efecto Cyberpunk elástico (back.out)
  tl.to(container, {
    opacity: 1,
    scale: 1,
    y: 0,
    duration: 0.8,
    ease: "back.out(1.3)"
  }, "-=0.4");

  // Obtener y poblar datos asíncronamente
  try {
    const data = await fetchAnalyticsData();
    populateUI(data);
  } catch (err) {
    console.error("Error al poblar la UI:", err);
  }
}

// Animación de cierre del panel
function closeAdminPanel() {
  if (!isPanelOpen) return;
  isPanelOpen = false;

  const overlay = adminOverlayEl;
  const container = document.getElementById("admin-panel-container");

  const tl = gsap.timeline({
    defaults: { ease: "power3.in" },
    onComplete: () => {
      gsap.set(overlay, { display: "none" });
    }
  });

  // Desvanecer y deslizar hacia abajo el panel
  tl.to(container, {
    opacity: 0,
    scale: 0.95,
    y: 30,
    duration: 0.4
  });

  // Desvanecer el fondo desenfocado
  tl.to(overlay, {
    opacity: 0,
    backdropFilter: "blur(0px)",
    duration: 0.4
  }, "-=0.3");
}

// Iniciar cargador de disparadores globales al montar
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTriggers);
} else {
  initTriggers();
}
