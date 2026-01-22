// ============================================
// SECRETS PAGE SCRIPT - Display Secrets
// ============================================

document.addEventListener('DOMContentLoaded', function () {
    const secretsList = document.getElementById('secretsList');
    const emptyState = document.getElementById('emptyState');
    const secretCount = document.getElementById('secretCount');

    // Load secrets from localStorage (user-specific)
    function getSecrets() {
        const currentUser = getCurrentUser();
        if (!currentUser) return [];

        const secrets = localStorage.getItem(`secrets_${currentUser}`);
        return secrets ? JSON.parse(secrets) : [];
    }

    // Save secrets to localStorage (user-specific)
    function saveSecrets(secrets) {
        const currentUser = getCurrentUser();
        if (!currentUser) return;

        localStorage.setItem(`secrets_${currentUser}`, JSON.stringify(secrets));
    }

    // Format date to readable string
    function formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
            if (diffHours === 0) {
                const diffMinutes = Math.floor(diffTime / (1000 * 60));
                return diffMinutes <= 1 ? 'Hace un momento' : `Hace ${diffMinutes} minutos`;
            }
            return diffHours === 1 ? 'Hace 1 hora' : `Hace ${diffHours} horas`;
        } else if (diffDays === 1) {
            return 'Ayer';
        } else if (diffDays < 7) {
            return `Hace ${diffDays} días`;
        } else {
            return date.toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    }

    // Delete a secret
    function deleteSecret(id) {
        const secrets = getSecrets();
        const filteredSecrets = secrets.filter(secret => secret.id !== id);
        saveSecrets(filteredSecrets);
        displaySecrets();
    }

    // Create secret card HTML
    function createSecretCard(secret) {
        const card = document.createElement('div');
        card.className = 'secret-card';
        card.innerHTML = `
            <div class="secret-header">
                <div class="secret-date">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M8 4V8L10.5 9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    ${formatDate(secret.date)}
                </div>
                <button class="btn-delete" onclick="deleteSecretById(${secret.id})">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 4H3.33333H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M5.33334 4V2.66667C5.33334 2.31304 5.47381 1.97391 5.72386 1.72386C5.97391 1.47381 6.31305 1.33333 6.66668 1.33333H9.33334C9.68697 1.33333 10.0261 1.47381 10.2761 1.72386C10.5262 1.97391 10.6667 2.31304 10.6667 2.66667V4M12.6667 4V13.3333C12.6667 13.687 12.5262 14.0261 12.2761 14.2761C12.0261 14.5262 11.687 14.6667 11.3333 14.6667H4.66668C4.31305 14.6667 3.97391 14.5262 3.72386 14.2761C3.47381 14.0261 3.33334 13.687 3.33334 13.3333V4H12.6667Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Eliminar
                </button>
            </div>
            <div class="secret-text">${escapeHtml(secret.text)}</div>
        `;
        return card;
    }

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Display all secrets
    function displaySecrets() {
        const secrets = getSecrets();

        // Update counter
        secretCount.textContent = secrets.length;

        // Clear current list
        secretsList.innerHTML = '';

        if (secrets.length === 0) {
            emptyState.classList.add('show');
            secretsList.style.display = 'none';
        } else {
            emptyState.classList.remove('show');
            secretsList.style.display = 'flex';

            secrets.forEach(secret => {
                const card = createSecretCard(secret);
                secretsList.appendChild(card);
            });
        }
    }

    // Make delete function global so it can be called from onclick
    window.deleteSecretById = function (id) {
        if (confirm('¿Estás seguro de que quieres eliminar este secreto?')) {
            deleteSecret(id);
        }
    };

    // Initial display
    displaySecrets();

    // Update display when localStorage changes (if user has multiple tabs open)
    window.addEventListener('storage', function (e) {
        const currentUser = getCurrentUser();
        if (e.key === `secrets_${currentUser}`) {
            displaySecrets();
        }
    });
});
