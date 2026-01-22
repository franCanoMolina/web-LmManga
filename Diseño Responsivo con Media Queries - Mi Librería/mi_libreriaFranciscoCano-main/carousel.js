// ============================================
// CARRUSEL DE PRODUCTOS CON DESCUENTO
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    const productosGrid = document.querySelector('.productos-grid');
    const btnAnterior = document.querySelector('.carousel-btn-prev');
    const btnSiguiente = document.querySelector('.carousel-btn-next');
    
    // Configuración del carrusel
    const scrollAmount = 300; // Cantidad de píxeles a desplazar
    
    // Función para desplazar hacia la izquierda
    if (btnAnterior) {
        btnAnterior.addEventListener('click', function() {
            productosGrid.scrollBy({
                left: -scrollAmount,
                behavior: 'smooth'
            });
        });
    }
    
    // Función para desplazar hacia la derecha
    if (btnSiguiente) {
        btnSiguiente.addEventListener('click', function() {
            productosGrid.scrollBy({
                left: scrollAmount,
                behavior: 'smooth'
            });
        });
    }
    
    // Actualizar visibilidad de botones según posición del scroll
    function updateButtons() {
        if (!productosGrid) return;
        
        const maxScroll = productosGrid.scrollWidth - productosGrid.clientWidth;
        
        // Ocultar botón anterior si está al inicio
        if (btnAnterior) {
            btnAnterior.style.opacity = productosGrid.scrollLeft <= 0 ? '0.5' : '1';
            btnAnterior.style.cursor = productosGrid.scrollLeft <= 0 ? 'default' : 'pointer';
        }
        
        // Ocultar botón siguiente si está al final
        if (btnSiguiente) {
            btnSiguiente.style.opacity = productosGrid.scrollLeft >= maxScroll ? '0.5' : '1';
            btnSiguiente.style.cursor = productosGrid.scrollLeft >= maxScroll ? 'default' : 'pointer';
        }
    }
    
    // Escuchar evento de scroll para actualizar botones
    if (productosGrid) {
        productosGrid.addEventListener('scroll', updateButtons);
        updateButtons(); // Llamar al inicio
    }
});
