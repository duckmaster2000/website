(() => {
    const BLOCKED_KEYS = new Set([
        'F12',
        'I',
        'J',
        'C',
        'U'
    ]);

    const isMac = navigator.platform.toUpperCase().includes('MAC');
    let warningVisible = false;
    let warningNode = null;

    function shouldBlockShortcut(event) {
        const key = String(event.key || '').toUpperCase();
        const hasPrimary = isMac ? event.metaKey : event.ctrlKey;

        if (key === 'F12') return true;
        if (hasPrimary && event.shiftKey && (key === 'I' || key === 'J' || key === 'C')) return true;
        if (hasPrimary && key === 'U') return true;
        return false;
    }

    function showWarning() {
        if (warningVisible) return;
        warningVisible = true;

        warningNode = document.createElement('div');
        warningNode.setAttribute('aria-live', 'polite');
        warningNode.style.position = 'fixed';
        warningNode.style.inset = '0';
        warningNode.style.zIndex = '2147483647';
        warningNode.style.display = 'grid';
        warningNode.style.placeItems = 'center';
        warningNode.style.background = 'rgba(4, 8, 20, 0.94)';
        warningNode.style.color = '#e9f4ff';
        warningNode.style.fontFamily = 'Segoe UI, Arial, sans-serif';
        warningNode.style.padding = '1rem';
        warningNode.innerHTML = '<div style="max-width:680px;border:1px solid rgba(149,255,216,0.5);border-radius:14px;padding:1rem 1.2rem;background:rgba(10,20,40,0.85)"><h2 style="margin:0 0 .4rem;font-size:1.2rem">Developer Tools Detected</h2><p style="margin:0;line-height:1.6;color:#cde4ff">This site blocks inspect shortcuts for casual browsing. Please close developer tools to continue using the page.</p></div>';

        document.body.appendChild(warningNode);
    }

    function hideWarning() {
        warningVisible = false;
        if (warningNode && warningNode.parentNode) {
            warningNode.parentNode.removeChild(warningNode);
        }
        warningNode = null;
    }

    function monitorDevtools() {
        const widthGap = window.outerWidth - window.innerWidth;
        const heightGap = window.outerHeight - window.innerHeight;
        const isOpen = widthGap > 170 || heightGap > 170;

        if (isOpen) {
            showWarning();
        } else {
            hideWarning();
        }
    }

    document.addEventListener('contextmenu', (event) => {
        event.preventDefault();
    });

    document.addEventListener('keydown', (event) => {
        if (!BLOCKED_KEYS.has(String(event.key || '').toUpperCase()) && !shouldBlockShortcut(event)) {
            return;
        }

        if (shouldBlockShortcut(event)) {
            event.preventDefault();
            event.stopPropagation();
        }
    }, true);

    window.addEventListener('resize', monitorDevtools);
    window.addEventListener('load', monitorDevtools);

    setInterval(monitorDevtools, 1200);
})();
