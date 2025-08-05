const cursor = document.getElementById('cursor');

if (cursor) {
    let mouseX = 0;
    let mouseY = 0;

    // Function to update cursor position
    function updateCursorPosition(e) {
        mouseX = e.clientX;
        mouseY = e.clientY;
    }

    // Animation loop for smooth movement
    function animateCursor() {
        // The translate needs to be adjusted by half the cursor's size to center it
        cursor.style.transform = `translate(${mouseX - cursor.offsetWidth / 2}px, ${mouseY - cursor.offsetHeight / 2}px)`;
        requestAnimationFrame(animateCursor);
    }

    // Event delegation for hover effect
    document.addEventListener('mouseover', (e) => {
        // Check if the element being hovered over is a carousel item
        if (e.target.closest('.group')) {
            cursor.classList.add('hovered');
        }
    });

    document.addEventListener('mouseout', (e) => {
        // Check if the element being left is a carousel item
        if (e.target.closest('.group')) {
            cursor.classList.remove('hovered');
        }
    });
    
    // Mouse press/release effect
    window.addEventListener("mousedown", () => {
        cursor.style.transform = `translate(${mouseX - cursor.offsetWidth / 2}px, ${mouseY - cursor.offsetHeight / 2}px) scale(0.8)`;
    });
    window.addEventListener("mouseup", () => {
        cursor.style.transform = `translate(${mouseX - cursor.offsetWidth / 2}px, ${mouseY - cursor.offsetHeight / 2}px) scale(1)`;
    });

    // Start listening for mouse movement and animating the cursor
    window.addEventListener('mousemove', updateCursorPosition);
    requestAnimationFrame(animateCursor);
}