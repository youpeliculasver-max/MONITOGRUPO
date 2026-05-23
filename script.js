(function () {
    // ---------- VARIABLES GLOBALES ----------
    let perfilActual = null; // { tipo: 'invitado' } o { tipo: 'usuario', nombre }
    let historial = [];
    let chartHistorial = null;

    // ---------- REFERENCIAS AL DOM ----------
    const loginModal = document.getElementById('loginModal');
    const inputUsuario = document.getElementById('inputUsuario');
    const btnIngresar = document.getElementById('btnIngresar');
    const btnInvitado = document.getElementById('btnInvitado');
    const mainContent = document.getElementById('mainContent');
    const usuarioActivo = document.getElementById('usuarioActivo');
    const btnSalir = document.getElementById('btnSalir');
    const btnIniciar = document.getElementById('btnIniciar');
    const estadoPrueba = document.getElementById('estadoPrueba');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const latenciaTexto = document.getElementById('latencia');
    const jitterTexto = document.getElementById('jitter');
    const velocidadTexto = document.getElementById('velocidad');
    const semaforo = document.getElementById('semaforo');
    const estadoRed = document.getElementById('estadoRed');
    const recomendacion = document.getElementById('recomendacion');
    const barraCalidad = document.getElementById('barraCalidad');
    const barraFill = document.getElementById('barraFill');
    const porcentajeCalidad = document.getElementById('porcentajeCalidad');
    const tablaHistorial = document.getElementById('tablaHistorial');
    const btnExportar = document.getElementById('btnExportar');
    const importarCSV = document.getElementById('importarCSV');
    const btnBorrar = document.getElementById('btnBorrar');
    const csvAnalysisContainer = document.getElementById('csvAnalysisContainer');
    const graficoCanvas = document.getElementById('graficoEstabilidad');

    // ---------- GESTIÓN DE PERFILES (localStorage) ----------
    function getUsersDB() {
        return JSON.parse(localStorage.getItem('velocimetro_users') || '{}');
    }
    function saveUsersDB(users) {
        localStorage.setItem('velocimetro_users', JSON.stringify(users));
    }
    function userExists(username) {
        return getUsersDB().hasOwnProperty(username);
    }
    function registerUser(username) {
        const users = getUsersDB();
        users[username] = true; // Solo necesitamos la clave
        saveUsersDB(users);
    }

    function iniciarSesion(esUsuario) {
        if (esUsuario) {
            const nombre = inputUsuario.value.trim();
            if (!nombre) return alert('Por favor ingresa un nombre de usuario.');
            if (!userExists(nombre)) registerUser(nombre);
            perfilActual = { tipo: 'usuario', nombre };
        } else {
            perfilActual = { tipo: 'invitado' };
        }
        // Ocultar modal y mostrar dashboard
        loginModal.classList.add('hidden');
        mainContent.style.display = 'block';
        usuarioActivo.textContent = `Sesión: ${perfilActual.tipo === 'usuario' ? perfilActual.nombre : 'Invitado'}`;
        cargarHistorial();
        actualizarTablaYGrafico();
    }

    function cerrarSesion() {
        perfilActual = null;
        historial = [];
        if (chartHistorial) chartHistorial.destroy();
        mainContent.style.display = 'none';
        loginModal.classList.remove('hidden');
        inputUsuario.value = '';
        usuarioActivo.textContent = 'Sesión: Pendiente';
    }

    btnIngresar.addEventListener('click', () => iniciarSesion(true));
    btnInvitado.addEventListener('click', () => iniciarSesion(false));
    btnSalir.addEventListener('click', cerrarSesion);

    // ---------- HISTORIAL ----------
    function getStorageKey() {
        return perfilActual?.tipo === 'usuario' ? `historial_${perfilActual.nombre}` : null;
    }
    function cargarHistorial() {
        const key = getStorageKey();
        historial = key ? JSON.parse(localStorage.getItem(key) || '[]') : [];
    }
    function guardarHistorial() {
        const key = getStorageKey();
        if (key) localStorage.setItem(key, JSON.stringify(historial));
    }
    function agregarPrueba(prueba) {
        if (perfilActual.tipo === 'usuario') {
            historial.unshift(prueba);
            if (historial.length > 20) historial.pop();
            guardarHistorial();
        } else {
            historial.unshift(prueba);
            if (historial.length > 20) historial.pop();
        }
        actualizarTablaYGrafico();
    }

    // ---------- MEDICIONES ----------
    function esperar(ms) { return new Promise(r => setTimeout(r, ms)); }
    async function medirLatencia() {
        const mediciones = [];
        for (let i = 0; i < 6; i++) {
            const inicio = performance.now();
            try {
                await fetch(`https://www.gstatic.com/generate_204?nocache=${Date.now()}-${i}`, { mode: 'no-cors', cache: 'no-store' });
                mediciones.push(performance.now() - inicio);
            } catch (e) {}
            await esperar(300);
        }
        if (mediciones.length === 0) throw new Error('Sin mediciones');
        const promedio = mediciones.reduce((a,b)=>a+b,0)/mediciones.length;
        let jitter = 0;
        if (mediciones.length > 1) {
            const diffs = [];
            for (let i=1; i<mediciones.length; i++) diffs.push(Math.abs(mediciones[i]-mediciones[i-1]));
            jitter = diffs.reduce((a,b)=>a+b,0)/diffs.length;
        }
        return { latencia: promedio, jitter };
    }
    async function medirVelocidad() {
        try {
            const inicio = performance.now();
            const res = await fetch(`https://speed.cloudflare.com/__down?bytes=500000&nocache=${Date.now()}`, { cache: 'no-store' });
            const blob = await res.blob();
            return (blob.size * 8) / ((performance.now() - inicio)/1000) / 1000000;
        } catch (e) {
            return navigator.connection?.downlink || 0;
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
        puntos = Math.max(0, puntos);
        if (latencia < 80 && jitter < 20 && velocidad >= 15) return { estado: 'Buena conexión', color: 'verde', rec: 'Ideal para videollamadas, streaming 4K y gaming.', calidad: puntos };
        if (latencia <= 150 && jitter <= 40 && velocidad >= 5) return { estado: 'Conexión regular', color: 'amarillo', rec: 'Funciona para navegación, pero puede tener cortes.', calidad: puntos };
        return { estado: 'Mala conexión', color: 'rojo', rec: 'Red inestable. Evita videoconferencias.', calidad: puntos };
    }

    // ---------- DIAGNÓSTICO ----------
    async function iniciarDiagnostico() {
        btnIniciar.disabled = true;
        btnIniciar.textContent = 'Analizando...';
        progressContainer.classList.remove('hidden');
        progressBar.style.width = '0%';
        estadoPrueba.textContent = 'Midiendo latencia...';
        try {
            progressBar.style.width = '30%';
            const { latencia, jitter } = await medirLatencia();
            progressBar.style.width = '60%';
            estadoPrueba.textContent = 'Midiendo velocidad...';
            const velocidad = await medirVelocidad();
            progressBar.style.width = '90%';
            const resultado = clasificarRed(latencia, jitter, velocidad);
            latenciaTexto.textContent = latencia.toFixed(1) + ' ms';
            jitterTexto.textContent = jitter.toFixed(1) + ' ms';
            velocidadTexto.textContent = velocidad.toFixed(2) + ' Mbps';
            semaforo.className = `semaforo ${resultado.color}`;
            estadoRed.textContent = resultado.estado;
            recomendacion.textContent = resultado.rec;
            barraCalidad.classList.remove('hidden');
            barraFill.style.width = `${resultado.calidad}%`;
            porcentajeCalidad.textContent = `Calidad: ${resultado.calidad}%`;
            estadoPrueba.textContent = 'Diagnóstico completo.';
            agregarPrueba({
                fecha: new Date().toLocaleString(),
                latencia: latencia.toFixed(1),
                jitter: jitter.toFixed(1),
                velocidad: velocidad.toFixed(2),
                estado: resultado.estado
            });
        } catch (error) {
            estadoPrueba.textContent = 'Error en la prueba.';
            console.error(error);
        } finally {
            btnIniciar.disabled = false;
            btnIniciar.textContent = 'Iniciar Medición';
            setTimeout(() => {
                progressContainer.classList.add('hidden');
                progressBar.style.width = '0%';
            }, 500);
        }
    }
    btnIniciar.addEventListener('click', iniciarDiagnostico);

    // ---------- TABLA Y GRÁFICO ----------
    function actualizarTablaYGrafico() {
        tablaHistorial.innerHTML = historial.length ? '' : '<tr><td colspan="5">Sin datos aún.</td></tr>';
        historial.forEach(p => {
            const fila = document.createElement('tr');
            fila.innerHTML = `<td>${p.fecha}</td><td>${p.latencia} ms</td><td>${p.jitter} ms</td><td>${p.velocidad} Mbps</td><td>${p.estado}</td>`;
            tablaHistorial.appendChild(fila);
        });
        if (chartHistorial) chartHistorial.destroy();
        if (historial.length) {
            const labels = historial.map(p => p.fecha.split(',')[0]).reverse();
            const datos = historial.map(p => parseFloat(p.velocidad)).reverse();
            chartHistorial = new Chart(graficoCanvas, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'Velocidad (Mbps)',
                        data: datos,
                        borderColor: '#38bdf8',
                        backgroundColor: 'rgba(56,189,248,0.1)',
                        tension: 0.3,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { labels: { color: '#e2e8f0' } } },
                    scales: {
                        x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
                        y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
                    }
                }
            });
        }
    }

    // ---------- CSV ----------
    btnExportar.addEventListener('click', () => {
        if (!historial.length) return alert('No hay datos.');
        let csv = 'Fecha,Latencia (ms),Jitter (ms),Velocidad (Mbps),Estado\n';
        historial.forEach(p => csv += `"${p.fecha}",${p.latencia},${p.jitter},${p.velocidad},"${p.estado}"\n`);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `historial_${perfilActual.tipo === 'usuario' ? perfilActual.nombre : 'invitado'}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    });

    importarCSV.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const lineas = event.target.result.split('\n').filter(l => l.trim());
            if (lineas.length < 2) return alert('CSV inválido');
            const cabecera = lineas[0].toLowerCase().includes('fecha');
            const datos = cabecera ? lineas.slice(1) : lineas;
            let analisis = '<strong>Análisis de CSV:</strong><br>';
            let importados = 0;
            datos.forEach(linea => {
                const cols = linea.split(',');
                if (cols.length < 4) return;
                const [fecha, lat, jit, vel] = [cols[0].trim(), parseFloat(cols[1]), parseFloat(cols[2]), parseFloat(cols[3])];
                if (isNaN(lat) || isNaN(jit) || isNaN(vel)) return;
                const res = clasificarRed(lat, jit, vel);
                if (perfilActual.tipo === 'usuario') {
                    historial.unshift({ fecha: fecha || new Date().toLocaleString(), latencia: lat.toFixed(1), jitter: jit.toFixed(1), velocidad: vel.toFixed(2), estado: res.estado });
                    importados++;
                }
                analisis += `<br>🔹 <strong>${fecha || 'Sin fecha'}</strong>: ${res.estado} - ${res.rec}`;
            });
            if (perfilActual.tipo === 'usuario' && importados > 0) guardarHistorial();
            actualizarTablaYGrafico();
            csvAnalysisContainer.classList.remove('hidden');
            csvAnalysisContainer.innerHTML = analisis;
        };
        reader.readAsText(file);
        importarCSV.value = '';
    });

    btnBorrar.addEventListener('click', () => {
        if (confirm('¿Borrar todo el historial?')) {
            historial = [];
            if (perfilActual.tipo === 'usuario') guardarHistorial();
            actualizarTablaYGrafico();
        }
    });

    // Inicialización
    window.addEventListener('load', () => {
        loginModal.classList.remove('hidden');
        mainContent.style.display = 'none';
    });
})();
