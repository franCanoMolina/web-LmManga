// ============================================
// AUTHENTICATION SCRIPT
// ============================================

document.addEventListener('DOMContentLoaded', function () {
    // Check if user is already logged in
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
        window.location.href = 'index.html';
        return;
    }

    // DOM Elements
    const tabs = document.querySelectorAll('.auth-tab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const errorMessage = document.getElementById('errorMessage');

    // Tab Switching
    tabs.forEach(tab => {
        tab.addEventListener('click', function () {
            const targetTab = this.dataset.tab;

            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            // Update active form
            if (targetTab === 'login') {
                loginForm.classList.add('active');
                registerForm.classList.remove('active');
            } else {
                registerForm.classList.add('active');
                loginForm.classList.remove('active');
            }

            // Clear error message
            hideError();
        });
    });

    // Login Form Handler
    loginForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!username || !password) {
            showError('Por favor completa todos los campos');
            return;
        }

        // Get users from localStorage
        const users = getUsers();
        const user = users.find(u => u.username === username);

        if (!user) {
            showError('Usuario no encontrado');
            return;
        }

        if (user.password !== password) {
            showError('Contraseña incorrecta');
            return;
        }

        // Login successful
        localStorage.setItem('currentUser', username);

        // Success animation
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        submitBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16.6667 5L7.50001 14.1667L3.33334 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            ¡Bienvenido!
        `;
        submitBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';

        // Redirect after short delay
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 800);
    });

    // Register Form Handler
    registerForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const username = document.getElementById('registerUsername').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;

        // Validation
        if (!username || !password || !confirmPassword) {
            showError('Por favor completa todos los campos');
            return;
        }

        if (username.length < 3) {
            showError('El usuario debe tener al menos 3 caracteres');
            return;
        }

        if (password.length < 4) {
            showError('La contraseña debe tener al menos 4 caracteres');
            return;
        }

        if (password !== confirmPassword) {
            showError('Las contraseñas no coinciden');
            return;
        }

        // Check if username already exists
        const users = getUsers();
        if (users.find(u => u.username === username)) {
            showError('Este usuario ya existe');
            return;
        }

        // Create new user
        const newUser = {
            username: username,
            password: password,
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        localStorage.setItem('users', JSON.stringify(users));

        // Auto-login
        localStorage.setItem('currentUser', username);

        // Success animation
        const submitBtn = registerForm.querySelector('button[type="submit"]');
        submitBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16.6667 5L7.50001 14.1667L3.33334 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            ¡Cuenta creada!
        `;
        submitBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';

        // Redirect after short delay
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 800);
    });

    // Helper Functions
    function getUsers() {
        const users = localStorage.getItem('users');
        return users ? JSON.parse(users) : [];
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.add('show');

        // Shake animation
        errorMessage.style.animation = 'shake 0.5s';
        setTimeout(() => {
            errorMessage.style.animation = '';
        }, 500);
    }

    function hideError() {
        errorMessage.textContent = '';
        errorMessage.classList.remove('show');
    }

    // Clear error on input
    const inputs = document.querySelectorAll('.form-input');
    inputs.forEach(input => {
        input.addEventListener('input', hideError);
    });
});
