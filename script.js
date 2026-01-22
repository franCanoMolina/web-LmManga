// ============================================
// MAIN PAGE SCRIPT - Save Secrets
// ============================================

document.addEventListener('DOMContentLoaded', function () {
    const secretInput = document.getElementById('secretInput');
    const saveButton = document.getElementById('saveButton');

    // Load existing secrets from localStorage (user-specific)
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

    // Add animation to button on input
    secretInput.addEventListener('input', function () {
        if (this.value.trim().length > 0) {
            saveButton.style.transform = 'scale(1.02)';
        } else {
            saveButton.style.transform = 'scale(1)';
        }
    });

    // Save secret when button is clicked
    saveButton.addEventListener('click', function () {
        const secretText = secretInput.value.trim();

        if (secretText === '') {
            // Add shake animation if empty
            secretInput.style.animation = 'shake 0.5s';
            setTimeout(() => {
                secretInput.style.animation = '';
            }, 500);
            return;
        }

        // Create new secret object
        const newSecret = {
            id: Date.now(),
            text: secretText,
            date: new Date().toISOString()
        };

        // Get existing secrets and add new one
        const secrets = getSecrets();
        secrets.unshift(newSecret); // Add to beginning of array
        saveSecrets(secrets);

        // Success animation
        saveButton.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16.6667 5L7.50001 14.1667L3.33334 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            ¡Guardado!
        `;
        saveButton.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';

        // Clear input
        secretInput.value = '';

        // Reset button after 2 seconds
        setTimeout(() => {
            saveButton.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16.6667 9.16667V15.8333C16.6667 16.2754 16.4911 16.6993 16.1785 17.0118C15.866 17.3244 15.442 17.5 15 17.5H5.00001C4.55798 17.5 4.13406 17.3244 3.82149 17.0118C3.50893 16.6993 3.33334 16.2754 3.33334 15.8333V5.83333C3.33334 5.39131 3.50893 4.96738 3.82149 4.65482C4.13406 4.34226 4.55798 4.16667 5.00001 4.16667H11.6667M15 2.5H17.5V5M17.5 2.5L10 10L7.5 7.5L15 0L17.5 2.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Guardar Secreto
            `;
            saveButton.style.background = 'linear-gradient(135deg, var(--purple-600) 0%, var(--purple-700) 100%)';
        }, 2000);
    });

    // Allow Enter key to save (with Ctrl/Cmd)
    secretInput.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            saveButton.click();
        }
    });
});

// Add shake animation to CSS dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);
