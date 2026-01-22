// ============================================
// SESSION MANAGEMENT
// ============================================

// Check if user is logged in, redirect to auth if not
function requireAuth() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        window.location.href = 'auth.html';
        return false;
    }
    return true;
}

// Get current logged in user
function getCurrentUser() {
    return localStorage.getItem('currentUser');
}

// Logout user
function logout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'auth.html';
}

// Initialize session protection and UI
function initSession() {
    if (!requireAuth()) {
        return;
    }

    const currentUser = getCurrentUser();

    // Update navbar with user info and logout button
    updateNavbar(currentUser);
}

// Update navbar to show username and logout button
function updateNavbar(username) {
    const navMenu = document.querySelector('.nav-menu');
    if (!navMenu) return;

    // Check if already updated
    if (document.querySelector('.user-info')) return;

    // Create user info element
    const userInfo = document.createElement('li');
    userInfo.className = 'user-info';
    userInfo.innerHTML = `
        <span class="username">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13.3333 14V12.6667C13.3333 11.9594 13.0524 11.2811 12.5523 10.781C12.0522 10.281 11.3739 10 10.6667 10H5.33333C4.62609 10 3.94781 10.281 3.44772 10.781C2.94762 11.2811 2.66667 11.9594 2.66667 12.6667V14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M8 7.33333C9.47276 7.33333 10.6667 6.13943 10.6667 4.66667C10.6667 3.19391 9.47276 2 8 2C6.52724 2 5.33333 3.19391 5.33333 4.66667C5.33333 6.13943 6.52724 7.33333 8 7.33333Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            ${username}
        </span>
    `;

    // Create logout button
    const logoutItem = document.createElement('li');
    logoutItem.innerHTML = `
        <button class="btn-logout" onclick="logout()">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V3.33333C2 2.97971 2.14048 2.64057 2.39052 2.39052C2.64057 2.14048 2.97971 2 3.33333 2H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M10.6667 11.3333L14 8L10.6667 4.66667" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M14 8H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Cerrar Sesión
        </button>
    `;

    navMenu.appendChild(userInfo);
    navMenu.appendChild(logoutItem);
}

// Run session initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', initSession);
