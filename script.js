// ===============================
// VELOCÍMETRO - SCRIPT PRINCIPAL
// ===============================

// Elementos principales
const modalAcceso = document.getElementById("modalAcceso");
const app = document.getElementById("app");
const nombreUsuarioInput = document.getElementById("nombreUsuario");
const usuarioActualTexto = document.getElementById("usuarioActual");

const btnIniciar = document.getElementById("btnIniciar");
const estadoPrueba = document.getElementById("estadoPrueba");

const latenciaTexto = document.getElementById("latencia");
const jitterTexto = document.getElementById("jitter");
const velocidadTexto = document.getElementById("velocidad");
const usoRecomendadoTexto = document.getElementById("usoRecomendado");

const semaforo = document.getElementById("semaforo");
const estadoRed = document.getElementById("estadoRed");
const recomendacion = document.getElementById("recomendacion");
const barraCalidad = document.getElementById("barraCalidad");
const porcentajeCalidad = document.getElementById("porcentajeCalidad");

const tablaHistorial = document.getElementById("tablaHistorial");
const resultadoPagina = document.getElementById("resultadoPagina");
const resultadoCSV = document.getElementById("resultadoCSV");
const interpretacionFinal = document.getElementById("interpretacionFinal");

const chipNavegacion = document.getElementById("chipNavegacion");
const chipClases = document.getElementById("chipClases");
const chipStreaming = document.getElementById("chipStreaming");
const chipJuegos = document.getElementById("chipJuegos");

let usuarioActivo = "Invitado";
let esInvitado = true;
let historial = [];
let grafico = null;
let ultimaMedicion = null;

// ===============================
// ACCESO DE USUARIO
// ===============================

function entrarComoInvitado() {
  usuarioActivo = "Invitado";
  esInvitado = true;
  historial = [];

  usuarioActualTexto.textContent = usuarioActivo;
  modalAcceso.classList.add("oculto");
  app.classList.remove("oculto");

  mostrarHistorial();
  actualizarGrafico();
}

function entrarConUsuario() {
  const nombre = nombreUsuarioInput.value.trim();

  if (nombre.length < 2) {
    alert("Escribe un nombre de usuario válido.");
    return;
  }

  usuarioActivo = limpiarTexto(nombre);
  esInvitado = false;

  localStorage.setItem("velocimetroUsuarioActivo", usuarioActivo);

  const historialGuardado = localStorage.getItem(obtenerClaveHistorial());
  historial = historialGuardado ? JSON.parse(historialGuardado) : [];

  usuarioActualTexto.textContent = usuarioActivo;
  modalAcceso.classList.add("oculto");
  app.classList.remove("oculto");

  mostrarHistorial();
  actualizarGrafico();
}

function cerrarSesion() {
  usuarioActivo = "Invitado";
  esInvitado = true;
  historial = [];
  ultimaMedicion = null;

  localStorage.removeItem("velocimetroUsuarioActivo");

  nombreUsuarioInput.value = "";
  usuarioActualTexto.textContent = "Invitado";

  app.classList.add("oculto");
  modalAcceso.classList.remove("oculto");

  reiniciarVista();
}

function obtenerClaveHistorial() {
  return `velocimetroHistorial_${usuarioActivo}`;
}

// ===============================
// UTILIDADES
// ===============================

function limpiarTexto(texto) {
  return texto.replace(/[<>]/g, "").trim();
}

function actualizarEstado(mensaje) {
  estadoPrueba.textContent = mensaje;
}

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function reiniciarVista() {
  latenciaTexto.textContent = "--";
  jitterTexto.textContent = "--";
  velocidadTexto.textContent = "--";
  usoRecomendadoTexto.textContent = "--";

  estadoRed.textContent = "Sin diagnóstico";
  recomendacion.textContent = "Ejecuta una medición para conocer la calidad de tu conexión.";
  semaforo.className = "semaforo gris";
  barraCalidad.style.width = "0%";
  porcentajeCalidad.textContent = "Calidad: --%";
  estadoPrueba.textContent = "Esperando inicio de medición...";

  interpretacionFinal.textContent =
    "Cuando realices una medición, aquí aparecerá una interpretación más clara sobre para qué actividades sirve tu conexión.";

  limpiarChips();
  mostrarHistorial();
  actualizarGrafico();
}

function limpiarChips() {
  const chips = [chipNavegacion, chipClases, chipStreaming, chipJuegos];

  chips.forEach(chip => {
    chip.classList.remove("chip-ok", "chip-regular", "chip-mal");
  });
}

function formatearFecha() {
  return new Date().toLocaleString("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

// ===============================
// MEDICIÓN DE INTERNET
// ===============================

async function medirLatencia() {
  const mediciones = [];
  const url = "https://www.gstatic.com/generate_204";

  for (let i = 0; i < 8; i++) {
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
      console.warn("Error midiendo latencia:", error);
    }

    await esperar(250);
  }

  if (mediciones.length === 0) {
    throw new Error("No se pudo medir la latencia.");
  }

  const promedio =
    mediciones.reduce((suma, valor) => suma + valor, 0) / mediciones.length;

  const jitter = calcularJitter(mediciones);

  return {
    latencia: promedio,
    jitter: jitter
  };
}

function calcularJitter(mediciones) {
  if (mediciones.length < 2) return 0;

  const diferencias = [];

  for (let i = 1; i < mediciones.length; i++) {
    diferencias.push(Math.abs(mediciones[i] - mediciones[i - 1]));
  }

  return diferencias.reduce((suma, valor) => suma + valor, 0) / diferencias.length;
}

async function medirVelocidad() {
  const bytes = 2000000;
  const url = `https://speed.cloudflare.com/__down?bytes=${bytes}&nocache=${Date.now()}`;

  const inicio = performance.now();

  try {
    const respuesta = await fetch(url, {
      cache: "no-store"
    });

    const blob = await respuesta.blob();
    const fin = performance.now();

    const segundos = (fin - inicio) / 1000;
    const bitsDescargados = blob.size * 8;
    const mbps = bitsDescargados / segundos / 1000000;

    return mbps;
  } catch (error) {
    console.warn("No se pudo medir velocidad con descarga:", error);

    if (navigator.connection && navigator.connection.downlink) {
      return navigator.connection.downlink;
    }

    return 0;
  }
}

function clasificarRed(latencia, jitter, velocidad) {
  let puntos = 100;

  if (latencia > 50) puntos -= 10;
  if (latencia > 80) puntos -= 15;
  if (latencia > 150) puntos -= 25;

  if (jitter > 15) puntos -= 10;
  if (jitter > 25) puntos -= 15;
  if (jitter > 40) puntos -= 20;

  if (velocidad < 25) puntos -= 10;
  if (velocidad < 15) puntos -= 15;
  if (velocidad < 5) puntos -= 25;

  if (puntos < 0) puntos = 0;

  let uso = "";
  let estado = "";
  let color = "";
  let mensaje = "";

  if (puntos >= 85) {
    estado = "Excelente conexión";
    color = "verde";
    uso = "Streaming, clases, juegos y videollamadas";
    mensaje =
      "Tu conexión es estable y adecuada para actividades exigentes como videollamadas, clases virtuales, streaming y juegos en línea.";
  } else if (puntos >= 70) {
    estado = "Buena conexión";
    color = "verde";
    uso = "Clases, navegación y streaming";
    mensaje =
      "Tu conexión funciona bien para estudiar, navegar, ver videos y realizar videollamadas con calidad aceptable.";
  } else if (puntos >= 50) {
    estado = "Conexión regular";
    color = "amarillo";
    uso = "Navegación y clases básicas";
    mensaje =
      "La conexión puede servir para navegación y clases virtuales, pero puede presentar cortes en video, audio o streaming.";
  } else {
    estado = "Mala conexión";
    color = "rojo";
    uso = "Uso limitado";
    mensaje =
      "La conexión presenta problemas. Se recomienda acercarse al router, reducir dispositivos conectados o cambiar de red.";
  }

  return {
    estado,
    color,
    recomendacion: mensaje,
    calidad: puntos,
    uso
  };
}

async function iniciarDiagnostico() {
  btnIniciar.disabled = true;
  btnIniciar.textContent = "Analizando...";

  try {
    actualizarEstado("Midiendo latencia y jitter...");

    latenciaTexto.textContent = "--";
    jitterTexto.textContent = "--";
    velocidadTexto.textContent = "--";
    usoRecomendadoTexto.textContent = "--";

    estadoRed.textContent = "Analizando conexión...";
    recomendacion.textContent = "Espera mientras se realiza la medición.";
    semaforo.className = "semaforo gris";
    barraCalidad.style.width = "0%";
    porcentajeCalidad.textContent = "Calidad: --%";

    const datosLatencia = await medirLatencia();

    actualizarEstado("Midiendo velocidad estimada de descarga...");

    const velocidad = await medirVelocidad();

    const latencia = datosLatencia.latencia;
    const jitter = datosLatencia.jitter;

    const resultado = clasificarRed(latencia, jitter, velocidad);

    ultimaMedicion = {
      fecha: formatearFecha(),
      usuario: usuarioActivo,
      latencia: Number(latencia.toFixed(1)),
      jitter: Number(jitter.toFixed(1)),
      velocidad: Number(velocidad.toFixed(2)),
      calidad: resultado.calidad,
      estado: resultado.estado,
      uso: resultado.uso
    };

    latenciaTexto.textContent = ultimaMedicion.latencia;
    jitterTexto.textContent = ultimaMedicion.jitter;
    velocidadTexto.textContent = ultimaMedicion.velocidad;
    usoRecomendadoTexto.textContent = resultado.uso;

    semaforo.className = `semaforo ${resultado.color}`;
    estadoRed.textContent = resultado.estado;
    recomendacion.textContent = resultado.recomendacion;
    barraCalidad.style.width = `${resultado.calidad}%`;
    porcentajeCalidad.textContent = `Calidad: ${resultado.calidad}%`;

    actualizarInterpretacion(resultado.calidad);
    actualizarEstado("Medición finalizada correctamente.");

    if (!esInvitado) {
      guardarEnHistorial(ultimaMedicion);
    } else {
      actualizarEstado("Medición finalizada. Modo invitado: no se guardó historial.");
    }
  } catch (error) {
    actualizarEstado("Ocurrió un error al realizar la medición.");
    estadoRed.textContent = "Error en la medición";
    recomendacion.textContent =
      "Verifica tu conexión a internet y vuelve a intentarlo.";
    console.error(error);
  }

  btnIniciar.disabled = false;
  btnIniciar.textContent = "Iniciar medición";
}

// ===============================
// INTERPRETACIÓN
// ===============================

function actualizarInterpretacion(calidad) {
  limpiarChips();

  if (calidad >= 85) {
    interpretacionFinal.textContent =
      "Tu conexión es muy buena. Sirve para navegación, clases virtuales, streaming en alta calidad, videollamadas y juegos en línea.";

    chipNavegacion.classList.add("chip-ok");
    chipClases.classList.add("chip-ok");
    chipStreaming.classList.add("chip-ok");
    chipJuegos.classList.add("chip-ok");
  } else if (calidad >= 70) {
    interpretacionFinal.textContent =
      "Tu conexión es buena. Sirve para navegación, clases virtuales, videollamadas y streaming moderado. En juegos puede variar según la latencia.";

    chipNavegacion.classList.add("chip-ok");
    chipClases.classList.add("chip-ok");
    chipStreaming.classList.add("chip-regular");
    chipJuegos.classList.add("chip-regular");
  } else if (calidad >= 50) {
    interpretacionFinal.textContent =
      "Tu conexión es regular. Puede servir para navegación y clases básicas, pero puede tener cortes en video, streaming o juegos online.";

    chipNavegacion.classList.add("chip-ok");
    chipClases.classList.add("chip-regular");
    chipStreaming.classList.add("chip-mal");
    chipJuegos.classList.add("chip-mal");
  } else {
    interpretacionFinal.textContent =
      "Tu conexión es deficiente. Solo se recomienda navegación básica. Para clases, streaming o juegos se necesita mejorar la estabilidad.";

    chipNavegacion.classList.add("chip-regular");
    chipClases.classList.add("chip-mal");
    chipStreaming.classList.add("chip-mal");
    chipJuegos.classList.add("chip-mal");
  }
}

// ===============================
// HISTORIAL
// ===============================

function guardarEnHistorial(prueba) {
  historial.unshift(prueba);

  if (historial.length > 20) {
    historial.pop();
  }

  localStorage.setItem(obtenerClaveHistorial(), JSON.stringify(historial));
  mostrarHistorial();
  actualizarGrafico();
}

function mostrarHistorial() {
  tablaHistorial.innerHTML = "";

  if (historial.length === 0) {
    tablaHistorial.innerHTML = `
      <tr>
        <td colspan="7">Todavía no hay mediciones registradas.</td>
      </tr>
    `;
    return;
  }

  historial.forEach(prueba => {
    const fila = document.createElement("tr");

    fila.innerHTML = `
      <td>${prueba.fecha}</td>
      <td>${prueba.usuario}</td>
      <td>${prueba.latencia} ms</td>
      <td>${prueba.jitter} ms</td>
      <td>${prueba.velocidad} Mbps</td>
      <td>${prueba.calidad}%</td>
      <td>${prueba.estado}</td>
    `;

    tablaHistorial.appendChild(fila);
  });
}

function borrarHistorial() {
  if (esInvitado) {
    alert("Estás en modo invitado. No hay historial guardado.");
    return;
  }

  if (confirm("¿Seguro que deseas borrar el historial de este usuario?")) {
    historial = [];
    localStorage.removeItem(obtenerClaveHistorial());
    mostrarHistorial();
    actualizarGrafico();
  }
}

// ===============================
// GRÁFICO
// ===============================

function actualizarGrafico() {
  const canvas = document.getElementById("graficoHistorial");

  if (!canvas || typeof Chart === "undefined") return;

  const datos = [...historial].reverse();

  const etiquetas = datos.map((_, index) => `Prueba ${index + 1}`);
  const latencias = datos.map(item => Number(item.latencia));
  const jitters = datos.map(item => Number(item.jitter));
  const velocidades = datos.map(item => Number(item.velocidad));

  if (grafico) {
    grafico.destroy();
  }

  grafico = new Chart(canvas, {
    type: "line",
    data: {
      labels: etiquetas,
      datasets: [
        {
          label: "Latencia (ms)",
          data: latencias,
          borderWidth: 2,
          tension: 0.35
        },
        {
          label: "Jitter (ms)",
          data: jitters,
          borderWidth: 2,
          tension: 0.35
        },
        {
          label: "Velocidad (Mbps)",
          data: velocidades,
          borderWidth: 2,
          tension: 0.35
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "#e5e7eb"
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: "#94a3b8"
          },
          grid: {
            color: "rgba(148, 163, 184, 0.15)"
          }
        },
        y: {
          ticks: {
            color: "#94a3b8"
          },
          grid: {
            color: "rgba(148, 163, 184, 0.15)"
          }
        }
      }
    }
  });
}

// ===============================
// EXPORTAR CSV
// ===============================

function exportarCSV() {
  if (historial.length === 0) {
    alert("No hay historial para exportar.");
    return;
  }

  const encabezado = [
    "Fecha",
    "Usuario",
    "Latencia",
    "Jitter",
    "Velocidad",
    "Calidad",
    "Estado",
    "Uso recomendado"
  ];

  const filas = historial.map(item => [
    item.fecha,
    item.usuario,
    item.latencia,
    item.jitter,
    item.velocidad,
    item.calidad,
    item.estado,
    item.uso
  ]);

  const contenido = [encabezado, ...filas]
    .map(fila => fila.map(valor => `"${valor}"`).join(","))
    .join("\n");

  const blob = new Blob([contenido], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");

  enlace.href = url;
  enlace.download = `historial_velocimetro_${usuarioActivo}.csv`;
  enlace.click();

  URL.revokeObjectURL(url);
}

// ===============================
// IMPORTAR CSV Y ANALIZAR
// ===============================

function importarCSV(event) {
  const archivo = event.target.files[0];

  if (!archivo) return;

  const lector = new FileReader();

  lector.onload = function(e) {
    const texto = e.target.result;
    const datos = parsearCSV(texto);

    if (datos.length < 2) {
      resultadoCSV.innerHTML = "El archivo CSV no tiene datos suficientes.";
      return;
    }

    const encabezados = datos[0].map(h => h.toLowerCase().trim());
    const filas = datos.slice(1);

    const indiceLatencia = buscarIndice(encabezados, ["latencia", "latency"]);
    const indiceJitter = buscarIndice(encabezados, ["jitter"]);
    const indiceVelocidad = buscarIndice(encabezados, ["velocidad", "speed", "mbps"]);

    if (indiceLatencia === -1 || indiceJitter === -1 || indiceVelocidad === -1) {
      resultadoCSV.innerHTML = `
        <strong>No se pudo analizar el archivo.</strong><br>
        El CSV debe tener columnas llamadas Latencia, Jitter y Velocidad.
      `;
      return;
    }

    let buenas = 0;
    let regulares = 0;
    let malas = 0;

    let tabla = `
      <div class="tabla-contenedor">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Latencia</th>
              <th>Jitter</th>
              <th>Velocidad</th>
              <th>Calidad</th>
              <th>Estado</th>
              <th>Sirve para</th>
            </tr>
          </thead>
          <tbody>
    `;

    filas.forEach((fila, index) => {
      const latencia = convertirNumero(fila[indiceLatencia]);
      const jitter = convertirNumero(fila[indiceJitter]);
      const velocidad = convertirNumero(fila[indiceVelocidad]);

      if (isNaN(latencia) || isNaN(jitter) || isNaN(velocidad)) return;

      const resultado = clasificarRed(latencia, jitter, velocidad);

      if (resultado.calidad >= 70) buenas++;
      else if (resultado.calidad >= 50) regulares++;
      else malas++;

      tabla += `
        <tr>
          <td>${index + 1}</td>
          <td>${latencia} ms</td>
          <td>${jitter} ms</td>
          <td>${velocidad} Mbps</td>
          <td>${resultado.calidad}%</td>
          <td>${resultado.estado}</td>
          <td>${resultado.uso}</td>
        </tr>
      `;
    });

    tabla += `
          </tbody>
        </table>
      </div>
    `;

    resultadoCSV.innerHTML = `
      <strong>Análisis del archivo importado:</strong><br>
      Mediciones buenas: ${buenas}<br>
      Mediciones regulares: ${regulares}<br>
      Mediciones malas: ${malas}<br><br>
      ${tabla}
    `;
  };

  lector.readAsText(archivo, "UTF-8");
}

function parsearCSV(texto) {
  const filas = [];
  let fila = [];
  let valor = "";
  let dentroComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const caracter = texto[i];
    const siguiente = texto[i + 1];

    if (caracter === '"' && dentroComillas && siguiente === '"') {
      valor += '"';
      i++;
    } else if (caracter === '"') {
      dentroComillas = !dentroComillas;
    } else if (caracter === "," && !dentroComillas) {
      fila.push(valor.trim());
      valor = "";
    } else if ((caracter === "\n" || caracter === "\r") && !dentroComillas) {
      if (valor || fila.length > 0) {
        fila.push(valor.trim());
        filas.push(fila);
        fila = [];
        valor = "";
      }
    } else {
      valor += caracter;
    }
  }

  if (valor || fila.length > 0) {
    fila.push(valor.trim());
    filas.push(fila);
  }

  return filas;
}

function buscarIndice(encabezados, opciones) {
  return encabezados.findIndex(encabezado =>
    opciones.some(opcion => encabezado.includes(opcion))
  );
}

function convertirNumero(valor) {
  if (!valor) return NaN;

  return Number(
    valor
      .replace("ms", "")
      .replace("Mbps", "")
      .replace("%", "")
      .replace(",", ".")
      .trim()
  );
}

// ===============================
// ANÁLISIS POR PÁGINA O SERVICIO
// ===============================

function analizarUsoPagina() {
  const pagina = document.getElementById("urlPagina").value.trim();
  const tipo = document.getElementById("tipoActividad").value;
  const minutos = Number(document.getElementById("tiempoUso").value);

  if (!pagina) {
    alert("Escribe el nombre de una página o servicio.");
    return;
  }

  const datosUso = obtenerDatosUso(tipo);
  const consumoEstimado = (datosUso.consumoHora / 60) * minutos;

  let evaluacion = "";

  if (!ultimaMedicion) {
    evaluacion =
      "Primero realiza una medición general para comparar tu conexión actual con esta actividad.";
  } else {
    const resultado = evaluarActividadConMedicion(tipo, ultimaMedicion);

    evaluacion = `
      Según tu última medición:
      <br>
      <strong>${resultado}</strong>
    `;
  }

  resultadoPagina.innerHTML = `
    <strong>Página o servicio:</strong> ${limpiarTexto(pagina)}<br>
    <strong>Tipo de uso:</strong> ${datosUso.nombre}<br>
    <strong>Tiempo estimado:</strong> ${minutos} minutos<br>
    <strong>Consumo aproximado:</strong> ${consumoEstimado.toFixed(1)} MB<br>
    <strong>Requisito recomendado:</strong> ${datosUso.requisito}<br><br>
    ${evaluacion}
  `;
}

function obtenerDatosUso(tipo) {
  const datos = {
    navegacion: {
      nombre: "Navegación web",
      consumoHora: 150,
      requisito: "Desde 3 Mbps, latencia menor a 150 ms."
    },
    clase: {
      nombre: "Clase virtual",
      consumoHora: 700,
      requisito: "Desde 5 Mbps, jitter bajo y latencia menor a 150 ms."
    },
    videollamada: {
      nombre: "Videollamada",
      consumoHora: 900,
      requisito: "Desde 8 Mbps, jitter menor a 40 ms."
    },
    streaming: {
      nombre: "Streaming de video",
      consumoHora: 1500,
      requisito: "Desde 15 Mbps para buena calidad."
    },
    juegos: {
      nombre: "Juegos en línea",
      consumoHora: 300,
      requisito: "Latencia menor a 80 ms y jitter menor a 25 ms."
    },
    descarga: {
      nombre: "Descarga de archivos",
      consumoHora: 2500,
      requisito: "Mientras más Mbps, menor tiempo de descarga."
    }
  };

  return datos[tipo];
}

function evaluarActividadConMedicion(tipo, medicion) {
  const latencia = medicion.latencia;
  const jitter = medicion.jitter;
  const velocidad = medicion.velocidad;

  if (tipo === "navegacion") {
    return velocidad >= 3 && latencia <= 150
      ? "Sí sirve para navegación web."
      : "Puede presentar lentitud en navegación.";
  }

  if (tipo === "clase") {
    return velocidad >= 5 && latencia <= 150 && jitter <= 40
      ? "Sí sirve para clases virtuales."
      : "Puede fallar en clases virtuales con cámara o audio.";
  }

  if (tipo === "videollamada") {
    return velocidad >= 8 && latencia <= 120 && jitter <= 35
      ? "Sí sirve para videollamadas."
      : "Puede tener cortes, retrasos o baja calidad de audio/video.";
  }

  if (tipo === "streaming") {
    return velocidad >= 15
      ? "Sí sirve para streaming de video."
      : "Puede cargar lento o bajar la calidad del video.";
  }

  if (tipo === "juegos") {
    return latencia <= 80 && jitter <= 25
      ? "Sí sirve para juegos en línea."
      : "Puede tener lag, retraso o inestabilidad.";
  }

  if (tipo === "descarga") {
    return velocidad >= 20
      ? "Buena velocidad para descargar archivos."
      : "Las descargas pueden tardar más de lo esperado.";
  }

  return "No se pudo evaluar esta actividad.";
}

// ===============================
// COPIAR RESULTADO
// ===============================

function copiarResultado() {
  if (!ultimaMedicion) {
    alert("Primero realiza una medición.");
    return;
  }

  const texto = `
VELOCÍMETRO - Resultado de medición
Usuario: ${ultimaMedicion.usuario}
Fecha: ${ultimaMedicion.fecha}
Latencia: ${ultimaMedicion.latencia} ms
Jitter: ${ultimaMedicion.jitter} ms
Velocidad: ${ultimaMedicion.velocidad} Mbps
Calidad: ${ultimaMedicion.calidad}%
Estado: ${ultimaMedicion.estado}
Uso recomendado: ${ultimaMedicion.uso}
  `.trim();

  navigator.clipboard
    .writeText(texto)
    .then(() => alert("Resultado copiado correctamente."))
    .catch(() => alert("No se pudo copiar el resultado."));
}

// ===============================
// INICIO
// ===============================

document.addEventListener("DOMContentLoaded", () => {
  const usuarioGuardado = localStorage.getItem("velocimetroUsuarioActivo");

  if (usuarioGuardado) {
    usuarioActivo = usuarioGuardado;
    esInvitado = false;

    const historialGuardado = localStorage.getItem(obtenerClaveHistorial());
    historial = historialGuardado ? JSON.parse(historialGuardado) : [];

    usuarioActualTexto.textContent = usuarioActivo;
    modalAcceso.classList.add("oculto");
    app.classList.remove("oculto");

    mostrarHistorial();
    actualizarGrafico();
  }
});
