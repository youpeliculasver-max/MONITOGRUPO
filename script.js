// 1. Referencias al DOM
const modalLogin = document.getElementById("loginModal");
const inputUsuario = document.getElementById("inputUsuario");
const inputPassword = document.getElementById("inputPassword");
const usuarioActivoTexto = document.getElementById("usuarioActivo");
const btnSalir = document.getElementById("btnSalir");
const btnVerHistorial = document.getElementById("btnVerHistorial");
const mainContent = document.getElementById("mainContent");
const historialModal = document.getElementById("historialModal");

const btnIniciar = document.getElementById("btnIniciar");
const btnGuardar = document.getElementById("btnGuardar");
const estadoPrueba = document.getElementById("estadoPrueba");
const latenciaTexto = document.getElementById("latencia");
const jitterTexto = document.getElementById("jitter");
const velocidadTexto = document.getElementById("velocidad");

const semaforo = document.getElementById("semaforo");
const estadoRed = document.getElementById("estadoRed");
const recomendacion = document.getElementById("recomendacion");
const tablaHistorial = document.getElementById("tablaHistorial");

// 2. Variables Globales
let usuarioActual = null;
let historial = [];
let graficoEstabilidad = null; 
let ultimaMedicion = null; // Guarda temporalmente la prueba antes de guardarla

// Base de datos de usuarios (con contraseña)
let baseDatosUsuarios = JSON.parse(localStorage.getItem("db_usuarios_v2")) || [];

// ==========================================
// SISTEMA DE SESIONES Y CONTRASEÑA
// ==========================================
function iniciarSesion(esUsuario) {
  if (!esUsuario) {
    usuarioActual = "Invitado";
    historial = [];
    abrirDashboard();
    return;
  }

  const nombre = inputUsuario.value.trim();
  const password = inputPassword.value.trim();

  if (nombre === "" || password === "") {
    alert("Por favor, ingresa un usuario y una contraseña.");
    return;
  }

  const usuarioExiste = baseDatosUsuarios.find(u => u.nombre === nombre);

  if (usuarioExiste) {
    if (usuarioExiste.password === password) {
      usuarioActual = nombre;
      cargarHistorialUsuario();
      abrirDashboard();
    } else {
      alert("Contraseña incorrecta para el usuario " + nombre);
    }
  } else {
    const confirmar = confirm(`El usuario "${nombre}" no existe. ¿Deseas registrarte con esta contraseña?`);
    if (confirmar) {
      baseDatosUsuarios.push({ nombre: nombre, password: password });
      localStorage.setItem("db_usuarios_v2", JSON.stringify(baseDatosUsuarios));
      usuarioActual = nombre;
      cargarHistorialUsuario(); 
      abrirDashboard();
      alert("¡Registro exitoso!");
    }
  }
}

function cargarHistorialUsuario() {
  historial = JSON.parse(localStorage.getItem(`historial_${usuarioActual}`)) || [];
}

function abrirDashboard() {
  modalLogin.style.display = "none";
  mainContent.style.display = "flex";
  usuarioActivoTexto.textContent = `Sesión: ${usuarioActual}`;
  
  if (usuarioActual !== "Invitado") {
    btnSalir.style.display = "inline-block";
    btnVerHistorial.style.display = "inline-block";
  }
}

function cerrarSesion() {
  usuarioActual = null;
  historial = [];
  inputUsuario.value = "";
  inputPassword.value = "";
  btnSalir.style.display = "none";
  btnVerHistorial.style.display = "none";
  mainContent.style.display = "none";
  btnGuardar.style.display = "none";
  modalLogin.style.display = "flex";
  cerrarHistorial();
}

// ==========================================
// VENTANA FLOTANTE DEL HISTORIAL
// ==========================================
function abrirHistorial() {
  historialModal.style.display = "flex";
  actualizarTabla();
  actualizarGrafico();
}

function cerrarHistorial() {
  historialModal.style.display = "none";
  if (graficoEstabilidad) {
    graficoEstabilidad.destroy();
    graficoEstabilidad = null;
  }
}

// ==========================================
// MOTOR DE MEDICIÓN
// ==========================================
function actualizarEstado(mensaje) { estadoPrueba.textContent = mensaje; }
function esperar(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function medirLatencia() {
  const mediciones = [];
  const url = "https://www.gstatic.com/generate_204";
  for (let i = 0; i < 6; i++) {
    const inicio = performance.now();
    try {
      await fetch(`${url}?nocache=${Date.now()}-${i}`, { mode: "no-cors", cache: "no-store" });
      mediciones.push(performance.now() - inicio);
    } catch (e) {}
    await esperar(300);
  }
  if (mediciones.length === 0) throw new Error("Falla de red");
  const promedio = mediciones.reduce((a, b) => a + b, 0) / mediciones.length;
  let dif = [];
  for (let i = 1; i < mediciones.length; i++) dif.push(Math.abs(mediciones[i] - mediciones[i-1]));
  const jitter = dif.length ? dif.reduce((a, b) => a + b, 0) / dif.length : 0;
  return { latencia: promedio, jitter: jitter };
}

async function medirVelocidad() {
  const url = `https://speed.cloudflare.com/__down?bytes=5000000&nocache=${Date.now()}`;
  const inicio = performance.now();
  try {
    const res = await fetch(url, { cache: "no-store" });
    const blob = await res.blob();
    return (blob.size * 8) / ((performance.now() - inicio) / 1000) / 1000000;
  } catch (e) { return navigator.connection?.downlink || 0; }
}

function clasificarRed(lat, jit, vel) {
  let pts = 100;
  if (lat > 100) pts -= 20; if (lat > 200) pts -= 30;
  if (jit > 30) pts -= 20; if (jit > 50) pts -= 20;
  if (vel < 10) pts -= 20; if (vel < 2) pts -= 30;
  if (pts < 0) pts = 0;

  if (lat < 100 && jit < 30 && vel >= 10) return { estado: "Óptimo", color: "verde", rec: "Apto para VoIP y Streaming." };
  if (lat <= 200 && jit <= 50 && vel >= 2) return { estado: "Regular", color: "amarillo", rec: "Posible retardo." };
  return { estado: "Crítico", color: "rojo", rec: "Falla de QoS." };
}

async function iniciarDiagnostico() {
  btnIniciar.disabled = true; 
  btnGuardar.style.display = "none";
  actualizarEstado("Midiendo latencia y jitter...");
  semaforo.className = "semaforo gris";

  try {
    const dLat = await medirLatencia();
    actualizarEstado("Midiendo Throughput (5MB)...");
    const vel = await medirVelocidad();
    
    const res = clasificarRed(dLat.latencia, dLat.jitter, vel);

    latenciaTexto.textContent = `${dLat.latencia.toFixed(1)} ms`;
    jitterTexto.textContent = `${dLat.jitter.toFixed(1)} ms`;
    velocidadTexto.textContent = `${vel.toFixed(2)} Mbps`;
    semaforo.className = `semaforo ${res.color}`;
    estadoRed.textContent = res.estado;
    recomendacion.textContent = res.rec;
    actualizarEstado("Análisis finalizado.");

    // Guarda temporalmente la medición
    ultimaMedicion = {
      fecha: new Date().toLocaleString(),
      latencia: dLat.latencia.toFixed(1),
      jitter: dLat.jitter.toFixed(1),
      velocidad: vel.toFixed(2),
      estado: res.estado
    };

    // Muestra el botón de guardar SOLO si iniciaste sesión
    if (usuarioActual !== "Invitado") btnGuardar.style.display = "inline-block";

  } catch (e) {
    actualizarEstado("Error crítico."); semaforo.className = "semaforo rojo";
  }
  btnIniciar.disabled = false;
}

// ==========================================
// GUARDAR PRUEBA Y EXPORTAR DATOS
// ==========================================
function guardarMedicionActual() {
  if (!ultimaMedicion) return;
  historial.unshift(ultimaMedicion);
  if (historial.length > 50) historial.pop(); 
  localStorage.setItem(`historial_${usuarioActual}`, JSON.stringify(historial));
  
  alert("¡Medición guardada correctamente en tu historial!");
  btnGuardar.style.display = "none"; // Oculta para no guardar la misma prueba 2 veces
}

function actualizarTabla() {
  tablaHistorial.innerHTML = "";
  if (historial.length === 0) {
    tablaHistorial.innerHTML = `<tr><td colspan="5">Aún no has guardado mediciones.</td></tr>`;
    return;
  }
  historial.forEach(p => {
    const fila = document.createElement("tr");
    fila.innerHTML = `<td>${p.fecha}</td><td>${p.latencia} ms</td><td>${p.jitter} ms</td><td>${p.velocidad} Mbps</td><td>${p.estado}</td>`;
    tablaHistorial.appendChild(fila);
  });
}

function borrarHistorial() {
  if (confirm(`¿Seguro que deseas borrar TODAS las mediciones guardadas de ${usuarioActual}?`)) {
    historial = [];
    localStorage.removeItem(`historial_${usuarioActual}`);
    actualizarTabla();
    actualizarGrafico();
  }
}

function exportarCSV() {
  if (historial.length === 0) return alert("No hay datos guardados.");
  let csv = "Fecha,Latencia(ms),Jitter(ms),Velocidad(Mbps),Estado\n";
  historial.forEach(r => csv += `${r.fecha},${r.latencia},${r.jitter},${r.velocidad},${r.estado}\n`);
  const link = document.createElement("a");
  link.href = encodeURI("data:text/csv;charset=utf-8," + csv);
  link.download = `Reporte_QoS_${usuarioActual}.csv`;
  link.click();
}

function procesarCSV(evento) {
  const archivo = evento.target.files[0];
  if (!archivo) return;
  const lector = new FileReader();
  lector.onload = function(e) {
    const lineas = e.target.result.split("\n").slice(1); 
    const nuevosDatos = [];
    lineas.forEach(linea => {
      if(linea.trim() === "") return;
      const cols = linea.split(",");
      if(cols.length >= 5) nuevosDatos.push({ fecha: cols[0], latencia: cols[1], jitter: cols[2], velocidad: cols[3], estado: cols[4].trim() });
    });
    if(nuevosDatos.length > 0) {
      historial = nuevosDatos.concat(historial).slice(0, 50);
      localStorage.setItem(`historial_${usuarioActual}`, JSON.stringify(historial));
      actualizarTabla(); actualizarGrafico();
      alert("CSV Importado correctamente.");
    }
  };
  lector.readAsText(archivo);
}

// ==========================================
// GRÁFICO (CON EXPORTACIÓN A PNG)
// ==========================================
// Plugin para dar fondo oscuro a la imagen descargada (Chart.js v3/v4)
const pluginFondoOscuro = {
  id: 'customCanvasBackgroundColor',
  beforeDraw: (chart, args, options) => {
    const {ctx} = chart;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = options.color || '#0f172a';
    ctx.fillRect(0, 0, chart.width, chart.height);
    ctx.restore();
  }
};

function actualizarGrafico() {
  const canvas = document.getElementById('graficoEstabilidad');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  if (graficoEstabilidad) graficoEstabilidad.destroy();
  if (historial.length === 0) return;

  const datosInvertidos = [...historial].reverse();
  const etiquetas = datosInvertidos.map(d => d.fecha.split(',')[1] || "");
  const latencias = datosInvertidos.map(d => parseFloat(d.latencia));
  const velocidades = datosInvertidos.map(d => parseFloat(d.velocidad));

  graficoEstabilidad = new Chart(ctx, {
    type: 'line',
    data: {
      labels: etiquetas,
      datasets: [
        { label: 'Latencia (ms)', data: latencias, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.2)', tension: 0.3, fill: true, yAxisID: 'y' },
        { label: 'Velocidad (Mbps)', data: velocidades, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.2)', tension: 0.3, fill: true, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'ms', color: '#94a3b8' } },
        y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Mbps', color: '#94a3b8' } }
      },
      plugins: { 
        legend: { labels: { color: '#f8fafc' } },
        customCanvasBackgroundColor: { color: '#0f172a' } 
      }
    },
    plugins: [pluginFondoOscuro] // Aplica el fondo para descargar correctamente
  });
}

function descargarGrafico() {
  if (historial.length === 0) return alert("No hay datos para graficar.");
  const canvas = document.getElementById('graficoEstabilidad');
  const imageURL = canvas.toDataURL("image/png"); 
  const link = document.createElement("a");
  link.href = imageURL;
  link.download = `Grafico_Estabilidad_${usuarioActual}.png`;
  link.click();
}
