
document.addEventListener('DOMContentLoaded', function() {
    const hamburger = document.querySelector('.hamburger-btn');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            navMenu.classList.toggle('active');
           
            this.textContent = navMenu.classList.contains('active') ? '✕' : '☰';
        });
    }
});
