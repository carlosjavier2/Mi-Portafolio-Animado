/**
 * ==========================================================================
 * CONFIGURACIÓN E INICIALIZACIÓN DE FIREBASE (MÓDULO ES6)
 * ==========================================================================
 * Este archivo inicializa el SDK modular de Firebase usando la CDN oficial.
 * Puedes sustituir los valores del objeto `firebaseConfig` con las claves
 * de tu proyecto de Firebase.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Reemplaza estos valores con los de tu consola de Firebase (Proyecto Spark Gratuito)
const firebaseConfig = {
  apiKey: "AIzaSyDj4NTTXLS0ubV7S5wM4HnNhZK5h_5Kp2U",
  authDomain: "mi-portafolio-animado.firebaseapp.com",
  projectId: "mi-portafolio-animado",
  storageBucket: "mi-portafolio-animado.firebasestorage.app",
  messagingSenderId: "862068865581",
  appId: "1:862068865581:web:713b6b46e2c302a55716a4",
  measurementId: "G-QRGWDVD619"
};

// Bandera para verificar si las credenciales fueron configuradas por el usuario
const isConfigured = firebaseConfig.apiKey !== "TU_API_KEY_AQUI";

let app = null;
let db = null;

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("⚡ Firebase inicializado exitosamente.");
  } catch (error) {
    console.error("❌ Error al inicializar Firebase:", error);
  }
} else {
  console.warn(
    "⚠️ Firebase no configurado. Las visitas se simularán localmente en el Panel de Analíticas hasta que agregues tus credenciales en 'js/firebase-config.js'."
  );
}

export { db, isConfigured };
