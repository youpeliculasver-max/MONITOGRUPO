// ==========================================
// VELOCÍMETRO - SCRIPT COMPLETO
// ==========================================

// 1. Referencias al DOM
const modalLogin = document.getElementById("loginModal");
const inputUsuario = document.getElementById("inputUsuario");
const usuarioActivoTexto = document.getElementById("usuarioActivo");
const btnSalir = document.getElementById("btnSalir");
const mainContent = document.getElementById("mainContent");

const btnIniciar = document.getElementById("btnIniciar");
const estadoPrueba = document.getElementById("estadoPrueba");
const latenciaTexto = document.getElementById("latencia");
const jitterTexto = document.getElementById("jitter");
const velocidadTexto = document.getElementById("velocidad");

const semaforo = document.getElementById("semaforo");
const estadoRed = document.getElementById("estadoRed");
const recomendacion = document.getElementById("recomendacion");
const tablaHistorial = document.getElementById("tablaHistorial");

// 2. Variables de Estado Globales
let usuarioActual = null;
let historial = [];
let graficoEstabilidad = null; 

let baseDatosUsuarios = JSON.parse(localStorage.getItem("db_usuarios_teleqos")) || [];

// 3. Gestión de Sesiones
function iniciarSesion(esUsuario) {
  if (!esUsuario) {
    usuarioActual = "Invitado";
    historial = [];
    abrirDashboard();
    return;
  }

  const nombre = inputUsuario.value.trim();
  if (nombre === "") {
    alert("Por favor, ingresa un nombre de usuario.");
    return;
  }

  const usuarioExiste = baseDatosUsuarios.includes(nombre);

  if (usuarioExiste) {
    usuarioActual = nombre;
    cargarHistorialUsuario();
    abrirDashboard();
  } else {
    const confirmar = confirm(`El usuario "${nombre}" no existe. ¿Deseas registrar este perfil?`);
    if (confirmar) {
      baseDatosUsuarios.push(nombre);
      localStorage.setItem("db_usuarios_teleqos", JSON.stringify(baseDatosUsuarios));
      usuarioActual = nombre;
      cargarHistorialUsuario(); 
      abrirDashboard();
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
  }
  
  actualizarTabla();
  actualizarGrafico();
}

function cerrarSesion() {
  usuarioActual = null;
  historial = [];
  inputUsuario.value = "";
  btnSalir.style.display = "none";
  mainContent.style.display = "none";
  modalLogin.style.display = "flex";
  
  if (graficoEstabilidad) {
    graficoEstabilidad.destroy();
    graficoEstabilidad = null;
  }
}

// 4. Utilidades
function actualizarEstado(mensaje) {
  estadoPrueba.textContent = mensaje;
}

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 5. Motor de Latencia y Jitter
async function medirLatencia() {
  const mediciones = [];
  const url = "https://www.gstatic.com/generate_204";

  for (let i = 0; i < 6; i++) {
    const inicio = performance.now();
    try {
      await fetch(`${url}?nocache=${Date.now()}-${i}`, {
        mode: "no-cors",
        cache: "no-store"
      });
      const fin = performance.now();
      const tiempo = fin - inicio;
      mediciones.push(tiempo);
    } catch (error) {
      console.log("Error en paquete de latencia:", error);
    }
    await esperar(300);
  }

  if (mediciones.length === 0) {
    throw new Error("Pérdida total de paquetes.");
  }

  const promedio = mediciones.reduce((suma, valor) => suma + valor, 0) / mediciones.length;
  const jitter = calcularJitter(mediciones);

  return { latencia: promedio, jitter: jitter };
}

function calcularJitter(mediciones) {
  if (mediciones.length < 2) return 0;
  let diferencias = [];
  for (let i = 1; i < mediciones.length; i++) {
    diferencias.push(Math.abs(mediciones[i] - mediciones[i - 1]));
  }
  return diferencias.reduce((suma, valor) => suma + valor, 0) / diferencias.length;
}

// 6. Motor de Velocidad (Payload 5MB)
async function medirVelocidad() {
  const bytes = 5000000; 
  const url = `https://speed.cloudflare.com/__down?bytes=${bytes}&nocache=${Date.now()}`;
  const inicio = performance.now();

  try {
    const respuesta = await fetch(url, { cache: "no-store" });
    const blob = await respuesta.blob();
    const fin = performance.now();

    const segundos = (fin - inicio) / 1000;
    const bitsDescargados = blob.size * 8;
    const mbps = bitsDescargados / segundos / 1000000;
    return mbps;
  } catch (error) {
    console.log("Error midiendo velocidad:", error);
    if (navigator.connection && navigator.connection.downlink) {
      return navigator.connection.downlink;
    }
    return 0;
  }
}

// 7. Evaluación QoS Estricta
function clasificarRed(latencia, jitter, velocidad) {
  let puntos = 100;

  if (latencia > 100) puntos -= 20;
  if (latencia > 200) puntos -= 30;
  if (jitter > 30) puntos -= 20;
  if (jitter > 50) puntos -= 20;
  if (velocidad < 10) puntos -= 20;
  if (velocidad < 2) puntos -= 30;

  if (puntos < 0) puntos = 0;

  if (latencia < 100 && jitter < 30 && velocidad >= 10) {
    return { estado: "Óptimo", color: "verde", recomendacion: "Enlace estable. Apto para VoIP y Streaming HD sin cortes.", calidad: puntos };
  }
  if (latencia <= 200 && jitter <= 50 && velocidad >= 2) {
    return { estado: "Regular", color: "amarillo", recomendacion: "Enlace degradado. Posible retardo en aplicaciones en tiempo real.", calidad: puntos };
  }
  return { estado: "Crítico", color: "rojo", recomendacion: "Falla de QoS. Revisar cobertura de celda o saturación del medio.", calidad: puntos };
}

// 8. Flujo Principal de Diagnóstico
async function iniciarDiagnostico() {
  btnIniciar.disabled = true;
  btnIniciar.textContent = "Analizando Enlace...";

  try {
    actualizarEstado("Midiendo latencia y jitter...");
    latenciaTexto.textContent = "-- ms";
    jitterTexto.textContent = "-- ms";
    velocidadTexto.textContent = "-- Mbps";
    estadoRed.textContent = "Analizando...";
    recomendacion.textContent = "Evaluando parámetros...";
    semaforo.className = "semaforo gris";

    const datosLatencia = await medirLatencia();
    actualizarEstado("Midiendo Throughput (Payload 5MB)...");
    const velocidad = await medirVelocidad();

    const lat = datosLatencia.latencia;
    const jit = datosLatencia.jitter;
    const resultado = clasificarRed(lat, jit, velocidad);

    latenciaTexto.textContent = `${lat.toFixed(1)} ms`;
    jitterTexto.textContent = `${jit.toFixed(1)} ms`;
    velocidadTexto.textContent = `${velocidad.toFixed(2)} Mbps`;

    semaforo.className = `semaforo ${resultado.color}`;
    estadoRed.textContent = resultado.estado;
    recomendacion.textContent = resultado.recomendacion;

    actualizarEstado("Análisis finalizado.");

    if (usuarioActual && usuarioActual !== "Invitado") {
      guardarEnHistorial(lat, jit, velocidad, resultado.estado);
    }
  } catch (error) {
    actualizarEstado("Error crítico en el enlace.");
    estadoRed.textContent = "Falla de red";
    semaforo.className = "semaforo rojo";
    console.log(error);
  }
  
  btnIniciar.disabled = false;
  btnIniciar.textContent = "Iniciar Medición";
}

// 9. Historial y Almacenamiento
function guardarEnHistorial(latencia, jitter, velocidad, estado) {
  const prueba = {
    fecha: new Date().toLocaleString(),
    latencia: latencia.toFixed(1),
    jitter: jitter.toFixed(1),
    velocidad: velocidad.toFixed(2),
    estado: estado
  };

  historial.unshift(prueba);
  if (historial.length > 20) historial.pop();

  localStorage.setItem(`historial_${usuarioActual}`, JSON.stringify(historial));
  actualizarTabla();
  actualizarGrafico();
}

function actualizarTabla() {
  tablaHistorial.innerHTML = "";
  if (historial.length === 0) {
    tablaHistorial.innerHTML = `<tr><td colspan="5">Sin registros en esta sesión.</td></tr>`;
    return;
  }
  historial.forEach(p => {
    const fila = document.createElement("tr");
    fila.innerHTML = `<td>${p.fecha}</td><td>${p.latencia} ms</td><td>${p.jitter} ms</td><td>${p.velocidad} Mbps</td><td>${p.estado}</td>`;
    tablaHistorial.appendChild(fila);
  });
}

function borrarHistorial() {
  if (confirm(`¿Seguro que deseas borrar los datos del usuario ${usuarioActual}?`)) {
    historial = [];
    localStorage.removeItem(`historial_${usuarioActual}`);
    actualizarTabla();
    actualizarGrafico();
  }
}

// 10. CSV y Gráficos (Chart.js)
function exportarCSV() {
  if (historial.length === 0) return alert("No hay datos para exportar.");
  
  let csv = "Fecha,Latencia(ms),Jitter(ms),Velocidad(Mbps),Estado\n";
  historial.forEach(r => { 
    csv += `${r.fecha},${r.latencia},${r.jitter},${r.velocidad},${r.estado}\n`; 
  });
  
  const link = document.createElement("a");
  link.href = encodeURI("data:text/csv;charset=utf-8," + csv);
  link.download = `Reporte_QoS_${usuarioActual}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
      if(cols.length >= 5) {
        nuevosDatos.push({ 
          fecha: cols[0], latencia: cols[1], jitter: cols[2], 
          velocidad: cols[3], estado: cols[4].trim() 
        });
      }
    });
    
    if(nuevosDatos.length > 0) {
      historial = nuevosDatos.concat(historial).slice(0, 20);
      if (usuarioActual !== "Invitado") {
        localStorage.setItem(`historial_${usuarioActual}`, JSON.stringify(historial));
      }
      actualizarTabla();
      actualizarGrafico();
      alert("CSV Importado y analizado con éxito.");
    }
  };
  lector.readAsText(archivo);
}

function actualizarGrafico() {
  const canvas = document.getElementById('graficoEstabilidad');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  if (graficoEstabilidad) graficoEstabilidad.destroy();
  
  const datosInvertidos = [...historial].reverse();
  const etiquetas = datosInvertidos.map(d => d.fecha.split(',')[1] || "");
  const latencias = datosInvertidos.map(d => parseFloat(d.latencia));
  const velocidades = datosInvertidos.map(d => parseFloat(d.velocidad));

  graficoEstabilidad = new Chart(ctx, {
    type: 'line',
    data: {
      labels: etiquetas,
      datasets: [
        { 
          label: 'Latencia (ms)', data: latencias, borderColor: '#ef4444', 
          backgroundColor: 'rgba(239,68,68,0.1)', tension: 0.3, fill: true, yAxisID: 'y' 
        },
        { 
          label: 'Velocidad (Mbps)', data: velocidades, borderColor: '#10b981', 
          backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.3, fill: true, yAxisID: 'y1' 
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'ms', color: '#94a3b8' } },
        y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Mbps', color: '#94a3b8' } }
      },
      plugins: { legend: { labels: { color: '#f8fafc' } } }
    }
  });
}
