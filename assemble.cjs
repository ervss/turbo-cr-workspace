const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CSS_SRC = path.join(ROOT, 'extensions', 'Nexus_Gallery', 'turbo_grid_importer.css');
const OUT_USERJS = path.join(__dirname, 'turbo-library-workspace-standalone.user.js');

console.log('Reading base CSS from:', CSS_SRC);
let baseCss = '';
if (fs.existsSync(CSS_SRC)) {
    baseCss = fs.readFileSync(CSS_SRC, 'utf8');
} else {
    console.warn('Warning: CSS_SRC not found, will use fallback');
}

// Extra CSS for Standalone features: Split-Screen modal, Help modal, Vault export/import, range selection
const extraCss = `
/* ═══════════════════════════════════════════════════════════════════
   STANDALONE EDITION ENHANCEMENTS (by ervss)
   ═══════════════════════════════════════════════════════════════════ */

/* Branding badge in headers */
.nexus-turbo-brand a {
    color: #58a6ff;
    text-decoration: none;
    font-weight: 700;
}
.nexus-turbo-brand a:hover {
    text-decoration: underline;
}

/* History Modal Wrapper */
#nexus-turbo-history-modal {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: grid;
    place-items: center;
    padding: 24px;
}

/* Action button variants */
.nexus-turbo-btn-copy {
    background: rgba(56, 139, 253, 0.15);
    border: 1px solid rgba(88, 166, 255, 0.35);
    color: #58a6ff;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 11.5px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    transition: all 0.15s ease;
}
.nexus-turbo-btn-copy:hover {
    background: #1f6feb;
    color: #fff;
    border-color: #58a6ff;
}

.nexus-turbo-btn-export {
    background: rgba(35, 134, 54, 0.18);
    border: 1px solid rgba(46, 160, 67, 0.4);
    color: #3fb950;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 11.5px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    transition: all 0.15s ease;
}
.nexus-turbo-btn-export:hover {
    background: #238636;
    color: #fff;
    border-color: #2ea043;
}

/* Help & Shortcuts Modal */
#nexus-turbo-help-modal {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: grid;
    place-items: center;
    padding: 24px;
}
.nexus-turbo-help-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(2, 4, 8, 0.85);
    backdrop-filter: blur(6px);
}
.nexus-turbo-help-dialog {
    position: relative;
    width: min(720px, 94vw);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #0d1117;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 14px;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.9);
    color: #e6edf3;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.nexus-turbo-help-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 18px;
    background: rgba(22, 27, 34, 0.85);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.nexus-turbo-help-head h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: #58a6ff;
    display: flex;
    align-items: center;
    gap: 8px;
}
.nexus-turbo-help-body {
    padding: 20px;
    overflow-y: auto;
    font-size: 13px;
    line-height: 1.6;
}
.nexus-turbo-help-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
}
.nexus-turbo-help-table th,
.nexus-turbo-help-table td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.nexus-turbo-help-table th {
    color: #8b949e;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.nexus-turbo-help-table kbd {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 11.5px;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    color: #79c0ff;
    box-shadow: 0 1px 0 rgba(0, 0, 0, 0.2);
}

/* Built-in Multi-Video Split-Screen Wall */
#nexus-turbo-split-modal {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    background: #06090e;
    overflow: hidden;
}
.nexus-turbo-split-topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 18px;
    background: #0d1117;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    color: #e6edf3;
    flex-shrink: 0;
    gap: 12px;
    flex-wrap: wrap;
}
.nexus-turbo-split-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    font-weight: 700;
    color: #f0f6fc;
}
.nexus-turbo-split-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}
.nexus-turbo-split-btn {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.16);
    color: #e6edf3;
    padding: 5px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    transition: all 0.15s ease;
}
.nexus-turbo-split-btn:hover {
    background: rgba(255, 255, 255, 0.16);
    color: #fff;
}
.nexus-turbo-split-btn.danger:hover {
    background: #da3633;
    border-color: #f85149;
}
.nexus-turbo-split-grid {
    flex: 1;
    display: grid;
    gap: 6px;
    padding: 8px;
    overflow: hidden;
    background: #000;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
}

/* Dynamic Grid layouts for Split-Screen */
.nexus-turbo-split-grid[data-count="1"] { grid-template-columns: 1fr; }
.nexus-turbo-split-grid[data-count="2"] { grid-template-columns: repeat(2, 1fr); }
.nexus-turbo-split-grid[data-count="3"],
.nexus-turbo-split-grid[data-count="4"] { grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(2, 1fr); }
.nexus-turbo-split-grid[data-count="5"],
.nexus-turbo-split-grid[data-count="6"] { grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, 1fr); }
.nexus-turbo-split-grid[data-count="7"],
.nexus-turbo-split-grid[data-count="8"],
.nexus-turbo-split-grid[data-count="9"] { grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); }
.nexus-turbo-split-grid[data-count="10"],
.nexus-turbo-split-grid[data-count="11"],
.nexus-turbo-split-grid[data-count="12"] { grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(3, 1fr); }

.nexus-turbo-split-tile {
    position: relative;
    background: #0d1117;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
    transition: border-color 0.15s ease;
}
.nexus-turbo-split-tile:hover {
    border-color: #58a6ff;
}
.nexus-turbo-split-tile.is-audio-active {
    border-color: #3fb950;
    box-shadow: 0 0 12px rgba(63, 185, 80, 0.4);
}
.nexus-turbo-split-tile video,
.nexus-turbo-split-tile iframe {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: #000;
    border: 0;
}
.nexus-turbo-split-tile-info {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(0deg, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0) 100%);
    padding: 6px 10px;
    font-size: 11px;
    color: #e6edf3;
    display: flex;
    justify-content: space-between;
    align-items: center;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease;
}
.nexus-turbo-split-tile:hover .nexus-turbo-split-tile-info {
    opacity: 1;
}
.nexus-turbo-split-tile-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 75%;
}
.nexus-turbo-split-tile-badge {
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    padding: 1px 5px;
    font-size: 10px;
}

/* Nav buttons in Modal Player */
.nexus-turbo-player-nav-btn {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    color: #c9d1d9;
    padding: 3px 8px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
}
.nexus-turbo-player-nav-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.18);
    color: #fff;
}
.nexus-turbo-player-nav-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
}

/* Bulletproof Library Card Overlays & Hitboxes (v2.0.1 fixes) */
.alb.is-selected {
    outline: 3px solid #58a6ff !important;
    outline-offset: 2px !important;
    box-shadow: 0 0 18px rgba(88, 166, 255, 0.5) !important;
}

.nexus-turbo-album-chk-wrap {
    position: absolute !important;
    top: 8px !important;
    left: 8px !important;
    z-index: 35 !important;
    background: rgba(13, 17, 23, 0.92) !important;
    border: 1px solid rgba(255, 255, 255, 0.3) !important;
    border-radius: 6px !important;
    padding: 4px !important;
    cursor: pointer !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.7) !important;
    transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease !important;
}
.nexus-turbo-album-chk-wrap:hover {
    transform: scale(1.12) !important;
    background: #1f6feb !important;
    border-color: #58a6ff !important;
}
.nexus-turbo-album-chk {
    width: 18px !important;
    height: 18px !important;
    cursor: pointer !important;
    accent-color: #2ea043 !important;
    margin: 0 !important;
    pointer-events: auto !important;
}

.nexus-turbo-badge-peek {
    position: absolute !important;
    top: 8px !important;
    right: 8px !important;
    z-index: 35 !important;
    background: rgba(13, 17, 23, 0.92) !important;
    border: 1px solid rgba(88, 166, 255, 0.6) !important;
    border-radius: 8px !important;
    padding: 4px 8px !important;
    font-size: 14px !important;
    cursor: pointer !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.7) !important;
    backdrop-filter: blur(6px) !important;
    transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease !important;
    user-select: none !important;
}
.nexus-turbo-badge-peek:hover {
    transform: scale(1.15) !important;
    background: #1f6feb !important;
    border-color: #58a6ff !important;
    color: #fff !important;
}
`;

const combinedCss = (baseCss + '\n' + extraCss).replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');

// Now let's read the JavaScript template file or build it
console.log('Combined CSS length:', combinedCss.length);

const templateJs = fs.readFileSync(path.join(__dirname, 'script_template.js'), 'utf8');
const finalScript = templateJs.replace('/* __EMBEDDED_CSS__ */', combinedCss);

fs.writeFileSync(OUT_USERJS, finalScript, 'utf8');
console.log('Successfully created:', OUT_USERJS, 'Size:', finalScript.length, 'bytes');
