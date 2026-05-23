(function () {
    // ---------- VARIABLES GLOBALES ----------
    let perfilActual = null; // { tipo: 'invitado' } o { tipo: 'usuario', nombre: '...' }
    let historial = [];
    let chartHistorial = null;

    // ---------- REFERENCIAS AL DOM ----------
    const loginOverlay = document.getElementById('loginOverlay');
    const dashboard = document.getElementById('dashboard');
    const tabs = document.querySelectorAll('.tab-btn');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const loginUsuario = document.getElementById('loginUsuario');
    const loginPassword = document.getElementById('loginPassword');
    const loginError = document.getElementById('loginError');
    const regUsuario = document.getElementById('regUsuario');
    const regPassword = document.getElementById('regPassword');
    const regPasswordConfirm = document.getElementById('regPasswordConfirm');
    const regError = document.getElementById('regError');
    const btnLogin = document.getElementById('btnLogin');
    const btnRegister = document.getElementById('btnRegister');
    const btnGuestFromLogin = document.getElementById('btnGuestFromLogin');
    const btnGuestFromReg = document.getElementById('btnGuestFromReg');
    const nombreMostrado = document.getElementById('nombreMostrado');
    const btnCerrarSesion = document.getElementById('btnCerrarSesion');

    const btnIniciar = document.getElementById('btnIniciar');
    const estadoPrueba = document.getElementById('estadoPrueba');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const latenciaValor = document.getElementById('latenciaValor');
    const jitterValor = document.getElementById('jitterValor');
    const velocidadValor = document.getElementById('velocidadValor');
    const semaforo = document.getElementById('semaforo');
    const estadoRed = document.getElementById('estadoRed');
    const recomendacion = document.getElementById('recomendacion');
    const barraCalidad = document.getElementById('barraCalidad');
    const porcentajeCalidad = document.getElementById('porcentajeCalidad');
    const tablaHistorial = document.getElementById('tablaHistorial');
    const btnExportarCSV = document.getElementById('btnExportarCSV');
    const btnImportarCSV = document.getElementById('btnImportarCSV');
    const fileInputCSV = document.getElementById('fileInputCSV');
    const csvAnalysisContainer = document.getElementById('csvAnalysisContainer');
    const graficoCanvas = document.getElementById('graficoHistorial');

    // ---------- GESTIÓN DE USUARIOS (localStorage) ----------
    function getUsersDB() {
        return JSON.parse(localStorage.getItem('velocimetro_users') || '{}');
    }

    function saveUsersDB(users) {
        localStorage.setItem('velocimetro_users', JSON.stringify(users));
    }

    function userExists(username) {
        return getUsersDB().hasOwnProperty(username);
    }

    function registerUser(username, password) {
        const users = getUsersDB();
        users[username] = password; // en producción usaríamos hash
        saveUsersDB(users);
    }

    function validateLogin(username, password) {
        const users = getUsersDB();
        return users[username] === password;
    }

    // ---------- CAMBIO DE PESTAÑAS ----------
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
            loginError.style.display = 'none';
            regError.style.display = 'none';
        });
    });

    // ---------- SESIONES ----------
    function entrarComoInvitado() {
        perfilActual = { tipo: 'invitado' };
        mostrarDashboard();
    }

    function iniciarSesionUsuario(username) {
        perfilActual = { tipo: 'usuario', nombre: username };
        cargarHistorial();
        mostrarDashboard();
    }

    function cerrarSesion() {
        perfilActual = null;
        dashboard.classList.add('hidden');
        loginOverlay.classList.remove('hidden');
        // Limpiar campos
        loginUsuario.value = '';
        loginPassword.value = '';
        regUsuario.value = '';
        regPassword.value = '';
        regPasswordConfirm.value = '';
        loginError.style.display = 'none';
        regError.style.display = 'none';
        // Volver a pestaña de inicio de sesión
        tabs[0].click();
        if (chartHistorial) chartHistorial.destroy();
    }

    function mostrarDashboard() {
        loginOverlay.classList.add('hidden');
        dashboard.classList.remove('hidden');
        nombreMostrado.textContent = perfilActual.tipo === 'usuario' ? perfilActual.nombre : 'Invitado';
        if (perfilActual.tipo !== 'usuario') historial = [];
        actualizarTablaYGrafico();
    }

    // Eventos de los botones de login/registro
    btnLogin.addEventListener('click', () => {
        const u = loginUsuario.value.trim();
        const p = loginPassword.value;
        if (!u || !p) {
            loginError.textContent = 'Completa todos los campos';
            loginError.style.display = 'block';
            return;
        }
        if (!userExists(u)) {
            loginError.textContent = 'El usuario no existe';
            loginError.style.display = 'block';
            return;
        }
        if (!validateLogin(u, p)) {
            loginError.textContent = 'Contraseña incorrecta';
            loginError.style.display = 'block';
            return;
        }
        loginError.style.display = 'none';
        iniciarSesionUsuario(u);
    });

    btnRegister.addEventListener('click', () => {
        const u = regUsuario.value.trim();
        const p = regPassword.value;
        const pc = regPasswordConfirm.value;
        regError.style.display = 'none';
        if (!u || !p || !pc) {
            regError.textContent = 'Completa todos los campos';
            regError.style.display = 'block';
            return;
        }
        if (p !== pc) {
            regError.textContent = 'Las contraseñas no coinciden';
            regError.style.display = 'block';
            return;
        }
        if (userExists(u)) {
            regError.textContent = 'El nombre de usuario ya está en uso';
            regError.style.display = 'block';
            return;
        }
        registerUser(u, p);
        regError.style.display = 'none';
        iniciarSesionUsuario(u);
    });

    btnGuestFromLogin.addEventListener('click', entrarComoInvitado);
    btnGuestFromReg.addEventListener('click', entrarComoInvitado);
    btnCerrarSesion.addEventListener('click', cerrarSesion);

    // ---------- GESTIÓN DEL HISTORIAL ----------
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

    // ---------- MEDICIONES DE RED ----------
    function esperar(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function medirLatencia() {
        const mediciones = [];
        for (let i = 0; i < 6; i++) {
            const inicio = performance.now();
            try {
                await fetch(`https://www.gstatic.com/generate_204?nocache=${Date.now()}-${i}`, {
                    mode: 'no-cors',
                    cache: 'no-store'
                });
                mediciones.push(performance.now() - inicio);
            } catch (e) {
                console.log('Error midiendo latencia:', e);
            }
            await esperar(300);
        }
        if (mediciones.length === 0) throw new Error('Sin mediciones de latencia');
        const promedio = mediciones.reduce((a, b) => a + b, 0) / mediciones.length;
        let jitter = 0;
        if (mediciones.length > 1) {
            const diferencias = [];
            for (let i = 1; i < mediciones.length; i++) {
                diferencias.push(Math.abs(mediciones[i] - mediciones[i - 1]));
            }
            jitter = diferencias.reduce((a, b) => a + b, 0) / diferencias.length;
        }
        return { latencia: promedio, jitter };
    }

    async function medirVelocidad() {
        try {
            const inicio = performance.now();
            const respuesta = await fetch(
                `https://speed.cloudflare.com/__down?bytes=500000&nocache=${Date.now()}`,
                { cache: 'no-store' }
            );
            const blob = await respuesta.blob();
            const fin = performance.now();
            return (blob.size * 8) / ((fin - inicio) / 1000) / 1000000;
        } catch (e) {
            if (navigator.connection?.downlink) return navigator.connection.downlink;
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
        puntos = Math.max(0, puntos);

        if (latencia < 80 && jitter < 20 && velocidad >= 15) {
            return {
                estado: 'Buena conexión',
                color: 'verde',
                recomendacion: 'Ideal para videollamadas, streaming 4K, gaming y trabajo remoto.',
                calidad: puntos
            };
        }
        if (latencia <= 150 && jitter <= 40 && velocidad >= 5) {
            return {
                estado: 'Conexión regular',
                color: 'amarillo',
                recomendacion: 'Funciona para navegación y videollamadas básicas, pero puede tener cortes.',
                calidad: puntos
            };
        }
        return {
            estado: 'Mala conexión',
            color: 'rojo',
            recomendacion: 'Red inestable. Evita videoconferencias y streaming en alta calidad.',
            calidad: puntos
        };
    }

    // ---------- DIAGNÓSTICO PRINCIPAL ----------
    async function iniciarDiagnostico() {
        btnIniciar.disabled = true;
        btnIniciar.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Analizando...';
        progressContainer.classList.remove('hidden');
        progressBar.style.width = '0%';
        estadoPrueba.innerHTML = '<i class="fas fa-clock"></i> Midiendo latencia...';

        try {
            progressBar.style.width = '30%';
            const { latencia, jitter } = await medirLatencia();

            progressBar.style.width = '60%';
            estadoPrueba.innerHTML = '<i class="fas fa-download"></i> Midiendo velocidad...';
            const velocidad = await medirVelocidad();

            progressBar.style.width = '90%';
            const resultado = clasificarRed(latencia, jitter, velocidad);

            // Actualizar interfaz
            latenciaValor.textContent = latencia.toFixed(1);
            jitterValor.textContent = jitter.toFixed(1);
            velocidadValor.textContent = velocidad.toFixed(2);
            semaforo.className = `semaforo ${resultado.color}`;
            estadoRed.textContent = resultado.estado;
            recomendacion.textContent = resultado.recomendacion;
            barraCalidad.style.width = `${resultado.calidad}%`;
            porcentajeCalidad.textContent = `Calidad: ${resultado.calidad}%`;
            estadoPrueba.innerHTML = '<i class="fas fa-check-circle"></i> Diagnóstico completo.';

            // Guardar en historial
            agregarPrueba({
                fecha: new Date().toLocaleString(),
                latencia: latencia.toFixed(1),
                jitter: jitter.toFixed(1),
                velocidad: velocidad.toFixed(2),
                estado: resultado.estado
            });
        } catch (error) {
            estadoPrueba.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error en la prueba.';
            console.error(error);
        } finally {
            btnIniciar.disabled = false;
            btnIniciar.innerHTML = '<i class="fas fa-bolt"></i> Iniciar prueba';
            setTimeout(() => {
                progressContainer.classList.add('hidden');
                progressBar.style.width = '0%';
            }, 500);
        }
    }

    btnIniciar.addEventListener('click', iniciarDiagnostico);

    // ---------- TABLA Y GRÁFICO ----------
    function actualizarTablaYGrafico() {
        // Limpiar tabla
        tablaHistorial.innerHTML = '';
        if (historial.length === 0) {
            tablaHistorial.innerHTML =
                '<tr><td colspan="5" style="text-align:center;">Sin datos aún.</td></tr>';
        } else {
            historial.forEach(prueba => {
                const fila = document.createElement('tr');
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

        // Gráfico (velocidad a lo largo del tiempo)
        if (chartHistorial) chartHistorial.destroy();
        if (historial.length > 0) {
            const labels = historial.map(p => p.fecha.split(',')[0]).reverse();
            const datosVelocidad = historial.map(p => parseFloat(p.velocidad)).reverse();

            chartHistorial = new Chart(graficoCanvas, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Velocidad (Mbps)',
                        data: datosVelocidad,
                        borderColor: '#00a8ff',
                        backgroundColor: 'rgba(0,168,255,0.1)',
                        tension: 0.3,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: '#e2e8f0' }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: '#a0aec0' },
                            grid: { color: '#1e293b' }
                        },
                        y: {
                            ticks: { color: '#a0aec0' },
                            grid: { color: '#1e293b' }
                        }
                    }
                }
            });
        }
    }

    // ---------- EXPORTAR / IMPORTAR CSV ----------
    btnExportarCSV.addEventListener('click', () => {
        if (historial.length === 0) {
            alert('No hay datos para exportar.');
            return;
        }
        let csv = 'Fecha,Latencia (ms),Jitter (ms),Velocidad (Mbps),Estado\n';
        historial.forEach(prueba => {
            csv += `"${prueba.fecha}",${prueba.latencia},${prueba.jitter},${prueba.velocidad},"${prueba.estado}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `historial_${perfilActual.tipo === 'usuario' ? perfilActual.nombre : 'invitado'}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    });

    btnImportarCSV.addEventListener('click', () => fileInputCSV.click());

    fileInputCSV.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const lineas = event.target.result.split('\n').filter(l => l.trim() !== '');
            if (lineas.length < 2) {
                alert('El archivo CSV no tiene datos válidos.');
                return;
            }

            const cabecera = lineas[0].toLowerCase().includes('fecha');
            const datos = cabecera ? lineas.slice(1) : lineas;
            let analisis = '<strong>Análisis de CSV importado:</strong><br>';
            let importados = 0;

            datos.forEach(linea => {
                const columnas = linea.split(',');
                if (columnas.length < 4) return;

                const fecha = columnas[0].trim();
                const latencia = parseFloat(columnas[1]);
                const jitter = parseFloat(columnas[2]);
                const velocidad = parseFloat(columnas[3]);

                if (isNaN(latencia) || isNaN(jitter) || isNaN(velocidad)) return;

                const resultado = clasificarRed(latencia, jitter, velocidad);

                // Agregar al historial si el usuario está logueado
                if (perfilActual.tipo === 'usuario') {
                    historial.unshift({
                        fecha: fecha || new Date().toLocaleString(),
                        latencia: latencia.toFixed(1),
                        jitter: jitter.toFixed(1),
                        velocidad: velocidad.toFixed(2),
                        estado: resultado.estado
                    });
                    importados++;
                }

                // Texto del análisis
                analisis += `<br>🔹 <strong>${fecha || 'Sin fecha'}</strong>: ${resultado.estado} - ${resultado.recomendacion}`;
                if (latencia < 50 && jitter < 10 && velocidad > 20) {
                    analisis += ' ✅ VoIP/4K/Gaming';
                } else if (latencia < 100 && velocidad > 5) {
                    analisis += ' ⚠️ Streaming HD básico';
                } else {
                    analisis += ' ❌ Solo navegación básica';
                }
            });

            if (perfilActual.tipo === 'usuario' && importados > 0) {
                guardarHistorial();
            }
            actualizarTablaYGrafico();
            csvAnalysisContainer.classList.remove('hidden');
            csvAnalysisContainer.innerHTML = analisis;
        };

        reader.readAsText(file);
        fileInputCSV.value = ''; // reset
    });

    // ---------- INICIALIZACIÓN ----------
    window.addEventListener('load', () => {
        loginOverlay.classList.remove('hidden');
        dashboard.classList.add('hidden');
        tabs[0].click(); // asegura que la pestaña de login esté activa
    });
})();
