const btnIniciar = document.getElementById("btnIniciar");
const estadoPrueba = document.getElementById("estadoPrueba");

const latenciaTexto = document.getElementById("latencia");
const jitterTexto = document.getElementById("jitter");
const velocidadTexto = document.getElementById("velocidad");

const semaforo = document.getElementById("semaforo");
const estadoRed = document.getElementById("estadoRed");
const recomendacion = document.getElementById("recomendacion");
const barraCalidad = document.getElementById("barraCalidad");
const porcentajeCalidad = document.getElementById("porcentajeCalidad");

const tablaHistorial = document.getElementById("tablaHistorial");

let historial = JSON.parse(localStorage.getItem("historialTeleqos")) || [];

mostrarHistorial();

function actualizarEstado(mensaje) {
  estadoPrueba.textContent = mensaje;
}

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
      console.log("Error midiendo latencia:", error);
    }

    await esperar(300);
  }

  if (mediciones.length === 0) {
    throw new Error("No se pudo medir la latencia.");
  }

  const promedio = mediciones.reduce((suma, valor) => suma + valor, 0) / mediciones.length;
  const jitter = calcularJitter(mediciones);

  return {
    latencia: promedio,
    jitter: jitter
  };
}

function calcularJitter(mediciones) {
  if (mediciones.length < 2) {
    return 0;
  }

  let diferencias = [];

  for (let i = 1; i < mediciones.length; i++) {
    diferencias.push(Math.abs(mediciones[i] - mediciones[i - 1]));
  }

  const jitter = diferencias.reduce((suma, valor) => suma + valor, 0) / diferencias.length;
  return jitter;
}

async function medirVelocidad() {
  const bytes = 500000;
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
    console.log("No se pudo medir velocidad con descarga:", error);

    if (navigator.connection && navigator.connection.downlink) {
      return navigator.connection.downlink;
    }

    return 0;
  }
}

function clasificarRed(latencia, jitter, velocidad) {
  let puntos = 100;

  if (latencia > 80) puntos -= 25;
  if (latencia > 150) puntos -= 25;

  if (jitter > 20) puntos -= 20;
  if (jitter > 40) puntos -= 20;

  if (velocidad < 15) puntos -= 20;
  if (velocidad < 5) puntos -= 20;

  if (puntos < 0) puntos = 0;

  if (latencia < 80 && jitter < 20 && velocidad >= 15) {
    return {
      estado: "Buena conexión",
      color: "verde",
      recomendacion:
        "La red es adecuada para clases virtuales, videollamadas, navegación y streaming.",
      calidad: puntos
    };
  }

  if (latencia <= 150 && jitter <= 40 && velocidad >= 5) {
    return {
      estado: "Conexión regular",
      color: "amarillo",
      recomendacion:
        "La red permite navegar y asistir a clases, pero puede presentar cortes en videollamadas.",
      calidad: puntos
    };
  }

  return {
    estado: "Mala conexión",
    color: "rojo",
    recomendacion:
      "La red puede presentar lentitud, cortes o mala calidad. Se recomienda acercarse al router, cambiar de red o reducir dispositivos conectados.",
    calidad: puntos
  };
}

async function iniciarDiagnostico() {
  btnIniciar.disabled = true;
  btnIniciar.textContent = "Analizando...";

  try {
    actualizarEstado("Midiendo latencia y jitter...");

    latenciaTexto.textContent = "-- ms";
    jitterTexto.textContent = "-- ms";
    velocidadTexto.textContent = "-- Mbps";

    estadoRed.textContent = "Analizando red...";
    recomendacion.textContent = "Por favor espera mientras se realiza la prueba.";
    semaforo.className = "semaforo gris";
    barraCalidad.style.width = "0%";
    porcentajeCalidad.textContent = "Calidad: --%";

    const datosLatencia = await medirLatencia();

    actualizarEstado("Midiendo velocidad estimada de descarga...");

    const velocidad = await medirVelocidad();

    const latencia = datosLatencia.latencia;
    const jitter = datosLatencia.jitter;

    const resultado = clasificarRed(latencia, jitter, velocidad);

    latenciaTexto.textContent = `${latencia.toFixed(1)} ms`;
    jitterTexto.textContent = `${jitter.toFixed(1)} ms`;
    velocidadTexto.textContent = `${velocidad.toFixed(2)} Mbps`;

    semaforo.className = `semaforo ${resultado.color}`;
    estadoRed.textContent = resultado.estado;
    recomendacion.textContent = resultado.recomendacion;

    barraCalidad.style.width = `${resultado.calidad}%`;
    porcentajeCalidad.textContent = `Calidad: ${resultado.calidad}%`;

    actualizarEstado("Diagnóstico finalizado correctamente.");

    guardarEnHistorial(latencia, jitter, velocidad, resultado.estado);
  } catch (error) {
    actualizarEstado("Ocurrió un error al realizar la prueba.");
    estadoRed.textContent = "Error en el diagnóstico";
    recomendacion.textContent =
      "Verifica tu conexión a internet y vuelve a intentarlo.";
    console.log(error);
  }

  btnIniciar.disabled = false;
  btnIniciar.textContent = "Iniciar diagnóstico";
}

function guardarEnHistorial(latencia, jitter, velocidad, estado) {
  const prueba = {
    fecha: new Date().toLocaleString(),
    latencia: latencia.toFixed(1),
    jitter: jitter.toFixed(1),
    velocidad: velocidad.toFixed(2),
    estado: estado
  };

  historial.unshift(prueba);

  if (historial.length > 10) {
    historial.pop();
  }

  localStorage.setItem("historialTeleqos", JSON.stringify(historial));
  mostrarHistorial();
}

function mostrarHistorial() {
  tablaHistorial.innerHTML = "";

  if (historial.length === 0) {
    tablaHistorial.innerHTML = `
      <tr>
        <td colspan="5">Todavía no hay pruebas registradas.</td>
      </tr>
    `;
    return;
  }

  historial.forEach(prueba => {
    const fila = document.createElement("tr");

    fila.innerHTML = `
      <td>${prueba.fecha}</td>
      <td>${prueba.latencia} ms</td>
      <td>${prueba.jitter} ms</td>
      <td>${prueba.velocidad} Mbps</td>
      <td>${prueba.estado}</td>
    `;

    tablaHistorial.appendChild(fila);
  });
}

function borrarHistorial() {
  if (confirm("¿Seguro que deseas borrar el historial?")) {
    historial = [];
    localStorage.removeItem("historialTeleqos");
    mostrarHistorial();
  }
}
