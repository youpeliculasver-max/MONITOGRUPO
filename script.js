// ==========================================
// VELOCÍMETRO - ARQUITECTURA ORIGINAL + LOTES DE HISTORIAL
// ==========================================

const modalLogin = document.getElementById("loginModal");
const inputUsuario = document.getElementById("inputUsuario");
const inputPassword = document.getElementById("inputPassword");
const usuarioActivoTexto = document.getElementById("usuarioActivo");
const btnSalir = document.getElementById("btnSalir");
const mainContent = document.getElementById("mainContent");

const modalListadoHistoriales = document.getElementById("modalListadoHistoriales");
const contenedorListaHistoriales = document.getElementById("contenedorListaHistoriales");

const btnIniciar = document.getElementById("btnIniciar");
const btnGuardarLote = document.getElementById("btnGuardarLote");
const btnVerLotes = document.getElementById("btnVerLotes");

const estadoPrueba = document.getElementById("estadoPrueba");
const latenciaTexto = document.getElementById("latencia");
const jitterTexto = document.getElementById("jitter");
const velocidadTexto = document.getElementById("velocidad");
const semaforo = document.getElementById("semaforo");
const estadoRed = document.getElementById("estadoRed");
const recomendacion = document.getElementById("recomendacion");
const tablaHistorial = document.getElementById("tablaHistorial");

// --- VARIABLES DE ESTADO ---
let usuarioActual = null;
let medicionesActuales = []; // Lo que se muestra SIEMPRE en la tabla/gráfico principal
let lotesGuardados = [];     // Los historiales guardados en la BD
let graficoEstabilidad = null; 

let baseDatosUsuarios = JSON.parse(localStorage.getItem("db_usuarios_v2")) || [];

// --- 1. SISTEMA DE SESIONES ---
function iniciarSesion(esUsuario) {
  if (!esUsuario) {
    usuarioActual = "Invitado";
    medicionesActuales = [];
    abrirDashboard();
    return;
  }

  const nombre = inputUsuario.value.trim();
  const password = inputPassword.value.trim();

  if (nombre === "" || password === "") return alert("Ingresa usuario y contraseña.");

  const usuarioExiste = baseDatosUsuarios.find(u => u.nombre === nombre);

  if (usuarioExiste) {
    if (usuarioExiste.password === password) {
      usuarioActual = nombre;
      cargarBaseDatosLotes();
      abrirDashboard();
    } else {
      alert("Contraseña incorrecta.");
    }
  } else {
    const confirmar = confirm(`El usuario "${nombre}" no existe. ¿Registrar con esta contraseña?`);
    if (confirmar) {
      baseDatosUsuarios.push({ nombre: nombre, password: password });
      localStorage.setItem("db_usuarios_v2", JSON.stringify(baseDatosUsuarios));
      usuarioActual = nombre;
      cargarBaseDatosLotes(); 
      abrirDashboard();
    }
  }
}

function cargarBaseDatosLotes() {
  lotesGuardados = JSON.parse(localStorage.getItem(`lotes_${usuarioActual}`)) || [];
}

function abrirDashboard() {
  modalLogin.style.display = "none";
  mainContent.style.display = "flex";
  usuarioActivoTexto.textContent = `Sesión: ${usuarioActual}`;
  
  if (usuarioActual !== "Invitado") {
    btnSalir.style.display = "inline-block";
    btnGuardarLote.style.display = "inline-block";
    btnVerLotes.style.display = "inline-block";
  }
  actualizarTabla();
  actualizarGrafico();
}

function cerrarSesion() {
  usuarioActual = null;
  medicionesActuales = [];
  inputUsuario.value = ""; inputPassword.value = "";
  btnSalir.style.display = "none";
  btnGuardarLote.style.display = "none";
  btnVerLotes.style.display = "none";
  mainContent.style.display = "none";
  modalLogin.style.display = "flex";
  if (graficoEstabilidad) { graficoEstabilidad.destroy(); graficoEstabilidad = null; }
}

// --- 2. GESTIÓN DE LOTES (GUARDAR Y CARGAR HISTORIALES) ---
function guardarLoteHistorial() {
  if (medicionesActuales.length === 0) return alert("No hay mediciones en pantalla para guardar.");
  
  const nombreLote = prompt("Dale un nombre a este historial (Ej: Pruebas Piso 2, Madrugada...):", "Historial " + new Date().toLocaleDateString());
  if (!nombreLote) return;

  const nuevoLote = {
    id: Date.now(),
    nombre: nombreLote,
    fecha: new Date().toLocaleString(),
    datos: [...medicionesActuales] // Copia lo de la pantalla
  };

  lotesGuardados.unshift(nuevoLote);
  localStorage.setItem(`lotes_${usuarioActual}`, JSON.stringify(lotesGuardados));
  alert(`Historial "${nombreLote}" guardado con éxito.`);
}

function abrirVentanaHistoriales() {
  contenedorListaHistoriales.innerHTML = "";
  
  if (lotesGuardados.length === 0) {
    contenedorListaHistoriales.innerHTML = "<p>No tienes historiales guardados aún.</p>";
  } else {
    lotesGuardados.forEach(lote => {
      const div = document.createElement("div");
      div.className = "item-historial";
      div.innerHTML = `
        <div>
          <h4>${lote.nombre}</h4>
          <p>${lote.fecha} • ${lote.datos.length} mediciones</p>
        </div>
        <div>
          <button class="btn-cargar" onclick="cargarLoteEnPantalla(${lote.id})">Cargar a Pantalla</button>
          <button class="btn-eliminar-lote" onclick="eliminarLote(${lote.id})">X</button>
        </div>
      `;
      contenedorListaHistoriales.appendChild(div);
    });
  }
  
  modalListadoHistoriales.style.display = "flex";
}

function cerrarVentanaHistoriales() {
  modalListadoHistoriales.style.display = "none";
}

function cargarLoteEnPantalla(id) {
  const lote = lotesGuardados.find(l => l.id === id);
  if (lote) {
    if(confirm(`¿Cargar el historial "${lote.nombre}" a la pantalla principal?`)) {
      medicionesActuales = [...lote.datos];
      actualizarTabla();
      actualizarGrafico();
      cerrarVentanaHistoriales();
    }
  }
}

function eliminarLote(id) {
  if(confirm("¿Seguro que deseas eliminar este historial guardado?")) {
    lotesGuardados = lotesGuardados.filter(l => l.id !== id);
    localStorage.setItem(`lotes_${usuarioActual}`, JSON.stringify(lotesGuardados));
    abrirVentanaHistoriales(); // Refresca la lista
  }
}

// --- 3. MOTOR DE MEDICIÓN ---
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
    actualizarEstado("Medición terminada.");

    // Al terminar, se agrega directo a la tabla de la pantalla principal
    medicionesActuales.unshift({
      fecha: new Date().toLocaleString(),
      latencia: dLat.latencia.toFixed(1),
      jitter: dLat.jitter.toFixed(1),
      velocidad: vel.toFixed(2),
      estado: res.estado
    });

    if (medicionesActuales.length > 50) medicionesActuales.pop();
    actualizarTabla();
    actualizarGrafico();

  } catch (e) {
    actualizarEstado("Error crítico."); semaforo.className = "semaforo rojo";
  }
  btnIniciar.disabled = false;
}

// --- 4. EXPORTAR, IMPORTAR Y LIMPIAR PANTALLA PRINCIPAL ---
function limpiarPantallaActual() {
  if(confirm("¿Limpiar la pantalla? (Asegúrate de haber presionado 'Guardar Historial Actual' si quieres conservar los datos)")) {
    medicionesActuales = [];
    actualizarTabla();
    actualizarGrafico();
  }
}

function actualizarTabla() {
  tablaHistorial.innerHTML = "";
  if (medicionesActuales.length === 0) {
    tablaHistorial.innerHTML = `<tr><td colspan="5">Inicia una prueba o carga un historial para ver datos.</td></tr>`;
    return;
  }
  medicionesActuales.forEach(p => {
    const fila = document.createElement("tr");
    fila.innerHTML = `<td>${p.fecha}</td><td>${p.latencia} ms</td><td>${p.jitter} ms</td><td>${p.velocidad} Mbps</td><td>${p.estado}</td>`;
    tablaHistorial.appendChild(fila);
  });
}

function exportarCSV() {
  if (medicionesActuales.length === 0) return alert("No hay datos en pantalla.");
  let csv = "Fecha,Latencia(ms),Jitter(ms),Velocidad(Mbps),Estado\n";
  medicionesActuales.forEach(r => csv += `${r.fecha},${r.latencia},${r.jitter},${r.velocidad},${r.estado}\n`);
  const link = document.createElement("a");
  link.href = encodeURI("data:text/csv;charset=utf-8," + csv);
  link.download = `Exportacion_${usuarioActual}.csv`;
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
      medicionesActuales = nuevosDatos.concat(medicionesActuales).slice(0, 50);
      actualizarTabla(); actualizarGrafico();
      alert("CSV Importado a la pantalla principal.");
    }
  };
  lector.readAsText(archivo);
}

// Plugin de fondo oscuro para PNG
const pluginFondoOscuro = {
  id: 'customCanvasBackgroundColor',
  beforeDraw: (chart, args, options) => {
    const {ctx} = chart; ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = options.color || '#0f172a';
    ctx.fillRect(0, 0, chart.width, chart.height); ctx.restore();
  }
};

function actualizarGrafico() {
  const canvas = document.getElementById('graficoEstabilidad');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  if (graficoEstabilidad) graficoEstabilidad.destroy();
  if (medicionesActuales.length === 0) return;

  const datosInvertidos = [...medicionesActuales].reverse();
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
    plugins: [pluginFondoOscuro]
  });
}

function descargarGrafico() {
  if (medicionesActuales.length === 0) return alert("No hay datos en pantalla.");
  const canvas = document.getElementById('graficoEstabilidad');
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `Grafico_${usuarioActual}.png`;
  link.click();
}
