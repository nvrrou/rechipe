<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
    <title>Login / Registro | Modo Oscuro (Grises)</title>
    <!-- Font Awesome 6 (íconos, se mantienen en gris) -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
        }

        body {
            background: #000000;  
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 1.5rem;
        }

        /* Tarjeta principal - gris oscuro */
        .auth-card {
            background: #1c1c1c;
            border-radius: 2rem;
            width: 100%;
            max-width: 480px;
            padding: 2rem 1.8rem;
            box-shadow: 0 20px 35px -10px rgba(0, 0, 0, 0.8);
            border: 1px solid #2c2c2c;
        }

        /Pestañas en grises, siguiendo el formato re chipe/
        .tabs {
            display: flex;
            gap: 0.75rem;
            margin-bottom: 2rem;
            border-bottom: 1px solid #2e2e2e;
            padding-bottom: 0.75rem;
        }

        .tab-btn {
            flex: 1;
            background: transparent;
            border: none;
            padding: 0.7rem 0;
            font-size: 1.2rem;
            font-weight: 600;
            cursor: pointer;
            color: #9e9e9e;
            transition: all 0.2s ease;
            border-radius: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.6rem;
        }

        .tab-btn i {
            font-size: 1.1rem;
        }

        .tab-btn.active {
            background: #2c2c2c;
            color: #f0f0f0;
            box-shadow: 0 1px 3px rgba(255,255,255,0.05);
        }

        .tab-btn:not(.active):hover {
            color: #e0e0e0;
            background: #252525;
        }

        / Formularios /
        .form-container {
            margin-top: 1rem;
        }

        .auth-form {
            display: none;
            flex-direction: column;
            gap: 1.5rem;
        }

        .auth-form.active-form {
            display: flex;
        }

        / Campos de entrada /
        .input-group {
            position: relative;
            display: flex;
            align-items: center;
            background: #232323;
            border-radius: 1.2rem;
            padding: 0.2rem 1rem;
            border: 1px solid #3a3a3a;
            transition: all 0.2s;
        }

        .input-group:focus-within {
            border-color: #aaaaaa;
            box-shadow: 0 0 0 2px rgba(170, 170, 170, 0.2);
        }

        .input-group i {
            color: #8e8e8e;
            font-size: 1.2rem;
            width: 1.8rem;
        }

        .input-group input {
            background: transparent;
            border: none;
            padding: 1rem 0;
            font-size: 1rem;
            color: #f5f5f5;
            width: 100%;
            outline: none;
        }

        .input-group input::placeholder {
            color: #6b6b6b;
            font-weight: 400;
        }

        / Botón principal en gris /
        .btn-submit {
            background: #2e2e2e;
            color: #f0f0f0;
            border: 1px solid #404040;
            padding: 0.85rem;
            border-radius: 2rem;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
        }

        .btn-submit:hover {
            background: #3a3a3a;
            border-color: #5a5a5a;
        }

        .btn-submit:active {
            transform: scale(0.97);
        }

        .extra-links {
            display: flex;
            justify-content: space-between;
            font-size: 0.85rem;
            margin-top: 0.2rem;
        }

        .extra-links a {
            color: #b0b0b0;
            text-decoration: none;
            transition: color 0.2s;
        }

        .extra-links a:hover {
            color: #e0e0e0;
            text-decoration: underline;
        }

        /Mensajes /
        .msg {
            text-align: center;
            font-size: 0.85rem;
            margin-top: 0.5rem;
            padding: 0.6rem;
            border-radius: 1.2rem;
            background: #262626;
            color: #d4d4d4;
            border-left: 3px solid #6e6e6e;
        }

        .error-msg {
            color: #f0b3b3; /* un gris rosado muy suave, pero sigue siendo dentro de la gama gris clara */
            font-weight: 500;
        }

        .success-msg {
            color: #c0e0c0;
        }

        hr {
            border-color: #2c2c2c;
            margin: 0.5rem 0;
        }

        /* responsive */
        @media (max-width: 500px) {
            .auth-card {
                padding: 1.5rem;
            }
            .tab-btn {
                font-size: 1rem;
            }
        }
    </style>
</head>
<body>

<div class="auth-card">
    <div class="tabs">
        <button class="tab-btn active" id="loginTabBtn"><i class="fas fa-sign-in-alt"></i> Iniciar sesión</button>
        <button class="tab-btn" id="signupTabBtn"><i class="fas fa-user-plus"></i> Crear cuenta</button>
    </div>

    <div class="form-container">
        <!-- Formulario de LOGIN -->
        <form id="loginForm" class="auth-form active-form">
            <div class="input-group">
                <i class="fas fa-envelope"></i>
                <input type="email" id="loginEmail" placeholder="Correo electrónico" autocomplete="email">
            </div>
            <div class="input-group">
                <i class="fas fa-lock"></i>
                <input type="password" id="loginPassword" placeholder="Contraseña" autocomplete="current-password">
            </div>
            <button type="submit" class="btn-submit"><i class="fas fa-arrow-right-to-bracket"></i> Entrar</button>
            <div class="extra-links">
                <a href="#"><i class="far fa-question-circle"></i> ¿Olvidaste tu contraseña?</a>
            </div>
            <div id="loginMsg" class="msg"></div>
        </form>

        <!-- Formulario de REGISTRO (Signup) -->
        <form id="signupForm" class="auth-form">
            <div class="input-group">
                <i class="fas fa-user"></i>
                <input type="text" id="signupName" placeholder="Nombre completo" autocomplete="name">
            </div>
            <div class="input-group">
                <i class="fas fa-envelope"></i>
                <input type="email" id="signupEmail" placeholder="Correo electrónico" autocomplete="email">
            </div>
            <div class="input-group">
                <i class="fas fa-lock"></i>
                <input type="password" id="signupPassword" placeholder="Contraseña (mínimo 6 caracteres)">
            </div>
            <div class="input-group">
                <i class="fas fa-check-circle"></i>
                <input type="password" id="signupConfirm" placeholder="Confirmar contraseña">
            </div>
            <button type="submit" class="btn-submit"><i class="fas fa-user-check"></i> Registrarse</button>
            <div id="signupMsg" class="msg"></div>
        </form>
    </div>
</div>

<script>
    // Elementos DOM
    const loginTab = document.getElementById('loginTabBtn');
    const signupTab = document.getElementById('signupTabBtn');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const loginMsg = document.getElementById('loginMsg');
    const signupMsg = document.getElementById('signupMsg');

    // Cambiar entre pestañas (solo en grises)
    function activateTab(tab) {
        if (tab === 'login') {
            loginTab.classList.add('active');
            signupTab.classList.remove('active');
            loginForm.classList.add('active-form');
            signupForm.classList.remove('active-form');
            signupMsg.innerHTML = '';
            loginMsg.innerHTML = '';
        } else {
            signupTab.classList.add('active');
            loginTab.classList.remove('active');
            signupForm.classList.add('active-form');
            loginForm.classList.remove('active-form');
            loginMsg.innerHTML = '';
            signupMsg.innerHTML = '';
        }
    }

    loginTab.addEventListener('click', () => activateTab('login'));
    signupTab.addEventListener('click', () => activateTab('signup'));


    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value.trim();

        loginMsg.innerHTML = '';
        
        if (!email || !password) {
            loginMsg.innerHTML = '<span class="error-msg">✋ Necesitamos tu correo y contraseña para entrar.</span>';
            return;
        }
        if (!email.includes('@') || !email.includes('.')) {
            loginMsg.innerHTML = '<span class="error-msg">📧 El correo no parece válido. Ejemplo: nombre@dominio.com</span>';
            return;
        }
        if (password.length < 3) {
            loginMsg.innerHTML = '<span class="error-msg">🔒 La contraseña es demasiado corta (mínimo 3 caracteres).</span>';
            return;
        }
        // Simulación 
        loginMsg.innerHTML = '<span class="success-msg">✅ ¡Bienvenido de vuelta! Redirigiendo... (Demo)</span>';
        // Opcional: limpiar campos o hacer algo después de 1 segundo
        setTimeout(() => {
            // Aquí podrías redirigir a otra página
            loginMsg.innerHTML = '<span class="success-msg">✨ Sesión iniciada correctamente (simulación).</span>';
        }, 1000);
    });

    // ---- REGISTRO  ----
    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('signupName').value.trim();
        const email = document.getElementById('signupEmail').value.trim();
        const pwd = document.getElementById('signupPassword').value.trim();
        const confirmPwd = document.getElementById('signupConfirm').value.trim();

        signupMsg.innerHTML = '';

        if (!name || !email || !pwd || !confirmPwd) {
            signupMsg.innerHTML = '<span class="error-msg">📝 Todos los campos son obligatorios. Por favor, rellénalos.</span>';
            return;
        }
        if (name.length < 2) {
            signupMsg.innerHTML = '<span class="error-msg">👤 El nombre debe tener al menos 2 letras.</span>';
            return;
        }
        if (!email.includes('@') || !email.includes('.')) {
            signupMsg.innerHTML = '<span class="error-msg">📧 El correo electrónico no es válido (debe llevar @ y un punto).</span>';
            return;
        }
        if (pwd.length < 6) {
            signupMsg.innerHTML = '<span class="error-msg">🔐 La contraseña debe tener al menos 6 caracteres por seguridad.</span>';
            return;
        }
        if (pwd !== confirmPwd) {
            signupMsg.innerHTML = '<span class="error-msg">⚠️ Las contraseñas no coinciden. Escríbelas igual.</span>';
            return;
        }

        // Simulación de registro exitoso
        signupMsg.innerHTML = '<span class="success-msg">🎉 ¡Cuenta creada con éxito! Ahora inicia sesión.</span>';
        // Después de 2 segundos cambiar a login y limpiar campos
        setTimeout(() => {
            activateTab('login');
            // limpiar formulario de registro para una nueva oportunidad
            document.getElementById('signupName').value = '';
            document.getElementById('signupEmail').value = '';
            document.getElementById('signupPassword').value = '';
            document.getElementById('signupConfirm').value = '';
            signupMsg.innerHTML = '';
            // Además mostrar mensaje amable en login
            loginMsg.innerHTML = '<span class="success-msg">👋 ¡Listo! Usa tus nuevas credenciales para iniciar sesión.</span>';
        }, 1800);
    });
</script>
</body>
</html>
