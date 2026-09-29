/**
 * Feedback Form Filler — Application Logic
 * 
 * Handles name input, live preview rendering, font scaling,
 * and high-quality PNG download using HTML Canvas.
 */

(function () {
    'use strict';

    // ==========================================
    // CONFIGURATION — Easily adjustable settings
    // ==========================================
    const CONFIG = {
        // Template image
        templateSrc: 'assets/template.jpg',

        // Original image dimensions
        templateWidth: 682,
        templateHeight: 1024,

        // Name text position (as percentage of template dimensions)
        // Calibrated to the pink brush-stroke area in the reference
        namePosition: {
            // X coordinate (percentage from left) — left edge of text area
            x: 14.5,
            // Y coordinate (percentage from top) — vertical center of text
            y: 33.5,
            // Maximum width of text area (percentage of template width)
            maxWidth: 60,
        },

        // Font settings
        font: {
            family: 'Dancing Script',
            fallback: 'cursive',
            weight: '700',
            color: '#3E2723',
            maxSize: 38,     // Maximum font size (px at original resolution)
            minSize: 18,     // Minimum font size (px at original resolution)
            defaultSize: 34, // Default font size for reference name length
        },

        // Text alignment
        textAlign: 'left',
        textBaseline: 'middle',

        // Default example name
        defaultName: 'Nilofer Sultana Person',

        // Download settings
        downloadPrefix: 'Feedback',
        downloadFormat: 'image/png',
        downloadQuality: 1.0,
    };

    // ==========================================
    // DOM REFERENCES
    // ==========================================
    const DOM = {
        nameInput:       document.getElementById('nameInput'),
        nameOverlay:     document.getElementById('nameOverlay'),
        nameText:        document.getElementById('nameText'),
        templateImage:   document.getElementById('templateImage'),
        previewWrapper:  document.getElementById('previewWrapper'),
        previewHint:     document.getElementById('previewHint'),
        downloadBtn:     document.getElementById('downloadBtn'),
        createAnotherBtn:document.getElementById('createAnotherBtn'),
        resetBtn:        document.getElementById('resetBtn'),
        downloadStatus:  document.getElementById('downloadStatus'),
        renderCanvas:    document.getElementById('renderCanvas'),
    };

    // ==========================================
    // STATE
    // ==========================================
    let currentName = CONFIG.defaultName;
    let templateLoaded = false;
    let templateImageObj = null;

    // ==========================================
    // INITIALIZATION
    // ==========================================
    function init() {
        // Preload the template image for canvas rendering
        preloadTemplate();

        // Set up event listeners
        DOM.nameInput.addEventListener('input', handleNameInput);
        DOM.downloadBtn.addEventListener('click', handleDownload);
        DOM.createAnotherBtn.addEventListener('click', handleCreateAnother);
        DOM.resetBtn.addEventListener('click', handleReset);

        // Initial render
        updatePreview(CONFIG.defaultName);
    }

    function preloadTemplate() {
        templateImageObj = new Image();
        templateImageObj.crossOrigin = 'anonymous';
        templateImageObj.onload = function () {
            templateLoaded = true;
            // Update config with actual dimensions if different
            CONFIG.templateWidth = templateImageObj.naturalWidth;
            CONFIG.templateHeight = templateImageObj.naturalHeight;
        };
        templateImageObj.onerror = function () {
            console.error('Failed to load template image.');
            showStatus('Template image failed to load.', 'error');
        };
        templateImageObj.src = CONFIG.templateSrc;
    }

    // ==========================================
    // EVENT HANDLERS
    // ==========================================
    function handleNameInput(e) {
        const name = e.target.value.trim();
        currentName = name || CONFIG.defaultName;
        updatePreview(currentName);

        // Update hint text
        if (name) {
            DOM.previewHint.textContent = `Previewing: "${currentName}"`;
            DOM.previewHint.classList.add('active');
        } else {
            DOM.previewHint.textContent = 'Showing default example — type a name to customize';
            DOM.previewHint.classList.remove('active');
        }
    }

    function handleDownload() {
        if (!templateLoaded) {
            showStatus('Please wait — template is still loading...', 'error');
            return;
        }

        const name = DOM.nameInput.value.trim() || CONFIG.defaultName;
        
        try {
            // Show processing state
            DOM.downloadBtn.disabled = true;
            DOM.downloadBtn.querySelector('svg').style.animation = 'spin 1s linear infinite';
            showStatus('Generating high-quality image...', '');

            // Use requestAnimationFrame to allow UI update before heavy work
            requestAnimationFrame(() => {
                generateImage(name).then(blob => {
                    // Create download link
                    const filename = sanitizeFilename(name);
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);

                    showStatus(`✓ Downloaded: ${filename}`, 'success');
                    DOM.downloadBtn.disabled = false;
                    DOM.downloadBtn.querySelector('svg').style.animation = '';
                }).catch(err => {
                    console.error('Download failed:', err);
                    showStatus('Download failed. Please try again.', 'error');
                    DOM.downloadBtn.disabled = false;
                    DOM.downloadBtn.querySelector('svg').style.animation = '';
                });
            });
        } catch (err) {
            console.error('Download error:', err);
            showStatus('An error occurred. Please try again.', 'error');
            DOM.downloadBtn.disabled = false;
            DOM.downloadBtn.querySelector('svg').style.animation = '';
        }
    }

    function handleCreateAnother() {
        DOM.nameInput.value = '';
        DOM.nameInput.focus();
        DOM.nameInput.select();
        currentName = CONFIG.defaultName;
        updatePreview(CONFIG.defaultName);
        DOM.previewHint.textContent = 'Showing default example — type a name to customize';
        DOM.previewHint.classList.remove('active');
        clearStatus();
    }

    function handleReset() {
        DOM.nameInput.value = CONFIG.defaultName;
        currentName = CONFIG.defaultName;
        updatePreview(CONFIG.defaultName);
        DOM.previewHint.textContent = 'Showing default example — type a name to customize';
        DOM.previewHint.classList.remove('active');
        clearStatus();

        // Subtle feedback animation
        DOM.nameInput.style.transition = 'background-color 0.3s';
        DOM.nameInput.style.backgroundColor = 'rgba(242, 184, 181, 0.2)';
        setTimeout(() => {
            DOM.nameInput.style.backgroundColor = '';
        }, 500);
    }

    // ==========================================
    // PREVIEW RENDERING
    // ==========================================
    function updatePreview(name) {
        DOM.nameText.textContent = name;
        
        // Calculate and apply responsive font size for the overlay
        requestAnimationFrame(() => {
            adjustOverlayFontSize(name);
        });
    }

    function adjustOverlayFontSize(name) {
        const overlay = DOM.nameOverlay;
        const textEl = DOM.nameText;
        
        if (!overlay || !textEl) return;

        const overlayWidth = overlay.clientWidth;
        if (overlayWidth === 0) return;

        // Target: text should use about 80% of the overlay width
        const maxTextWidth = overlayWidth * 0.85;
        
        // Start with max size relative to the preview
        const previewImg = DOM.templateImage;
        const scale = previewImg.clientWidth / CONFIG.templateWidth;
        
        let fontSize = CONFIG.font.maxSize * scale;
        const minFontSize = CONFIG.font.minSize * scale;

        // Binary search for the right font size
        textEl.style.fontSize = fontSize + 'px';
        
        while (textEl.scrollWidth > maxTextWidth && fontSize > minFontSize) {
            fontSize -= 0.5;
            textEl.style.fontSize = fontSize + 'px';
        }
    }

    // ==========================================
    // IMAGE GENERATION (Canvas)
    // ==========================================
    function generateImage(name) {
        return new Promise((resolve, reject) => {
            const canvas = DOM.renderCanvas;
            const ctx = canvas.getContext('2d');

            // Set canvas to original template dimensions
            canvas.width = CONFIG.templateWidth;
            canvas.height = CONFIG.templateHeight;

            // Draw the template background
            ctx.drawImage(templateImageObj, 0, 0, CONFIG.templateWidth, CONFIG.templateHeight);

            // Calculate text position in pixels
            const textX = (CONFIG.namePosition.x / 100) * CONFIG.templateWidth;
            const textY = (CONFIG.namePosition.y / 100) * CONFIG.templateHeight;
            const maxTextWidth = (CONFIG.namePosition.maxWidth / 100) * CONFIG.templateWidth;

            // Calculate optimal font size
            const fontSize = calculateCanvasFontSize(ctx, name, maxTextWidth);

            // Configure text rendering
            ctx.font = `${CONFIG.font.weight} ${fontSize}px "${CONFIG.font.family}", ${CONFIG.font.fallback}`;
            ctx.fillStyle = CONFIG.font.color;
            ctx.textAlign = CONFIG.textAlign;
            ctx.textBaseline = CONFIG.textBaseline;

            // Enable text smoothing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // Draw the name
            ctx.fillText(name, textX, textY);

            // Export as PNG blob
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Canvas toBlob returned null'));
                    }
                },
                CONFIG.downloadFormat,
                CONFIG.downloadQuality
            );
        });
    }

    function calculateCanvasFontSize(ctx, name, maxWidth) {
        let fontSize = CONFIG.font.defaultSize;
        const minSize = CONFIG.font.minSize;
        const maxSize = CONFIG.font.maxSize;

        // Start with max size
        fontSize = maxSize;

        // Measure and reduce until it fits
        ctx.font = `${CONFIG.font.weight} ${fontSize}px "${CONFIG.font.family}", ${CONFIG.font.fallback}`;
        let metrics = ctx.measureText(name);

        while (metrics.width > maxWidth && fontSize > minSize) {
            fontSize -= 0.5;
            ctx.font = `${CONFIG.font.weight} ${fontSize}px "${CONFIG.font.family}", ${CONFIG.font.fallback}`;
            metrics = ctx.measureText(name);
        }

        return fontSize;
    }

    // ==========================================
    // UTILITY FUNCTIONS
    // ==========================================
    function sanitizeFilename(name) {
        // Replace special characters and spaces
        const sanitized = name
            .replace(/[^a-zA-Z0-9\s\-]/g, '') // Remove special chars
            .replace(/\s+/g, '-')               // Spaces to hyphens
            .replace(/-+/g, '-')                // Multiple hyphens to single
            .replace(/^-|-$/g, '');              // Trim leading/trailing hyphens

        return `${CONFIG.downloadPrefix}-${sanitized || 'Unnamed'}.png`;
    }

    function showStatus(message, type) {
        DOM.downloadStatus.textContent = message;
        DOM.downloadStatus.className = 'download-status visible';
        if (type) {
            DOM.downloadStatus.classList.add(type);
        }

        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(clearStatus, 4000);
        }
    }

    function clearStatus() {
        DOM.downloadStatus.className = 'download-status';
        setTimeout(() => {
            DOM.downloadStatus.textContent = '';
        }, 300);
    }

    // ==========================================
    // RESPONSIVE HANDLING
    // ==========================================
    // Re-adjust font size when window resizes
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            updatePreview(currentName);
        }, 100);
    });

    // Also adjust after the template image loads in the browser
    DOM.templateImage.addEventListener('load', () => {
        updatePreview(currentName);
    });

    // ==========================================
    // CSS for spin animation (injected)
    // ==========================================
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);

    // ==========================================
    // START
    // ==========================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
