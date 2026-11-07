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

/* Bulletproof Library Card Overlays & Hitboxes (v2.1.0 fixes) */
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
    border: 1.5px solid rgba(255, 255, 255, 0.4) !important;
    border-radius: 6px !important;
    padding: 3px !important;
    cursor: pointer !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.8) !important;
    transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease !important;
    user-select: none !important;
}
.nexus-turbo-album-chk-wrap:hover {
    transform: scale(1.15) !important;
    background: #1f6feb !important;
    border-color: #58a6ff !important;
}
.alb.is-selected .nexus-turbo-album-chk-wrap,
.nexus-turbo-album-chk-wrap[aria-checked="true"] {
    background: #238636 !important;
    border-color: #2ea043 !important;
    box-shadow: 0 0 10px rgba(46, 160, 67, 0.8) !important;
}
.nexus-turbo-album-chk {
    width: 18px !important;
    height: 18px !important;
    cursor: pointer !important;
    accent-color: #2ea043 !important;
    margin: 0 !important;
    pointer-events: none !important;
}

.nexus-turbo-peek-album-badge {
    font-size: 11px;
    background: rgba(88, 166, 255, 0.15);
    color: #58a6ff;
    border: 1px solid rgba(88, 166, 255, 0.3);
    border-radius: 4px;
    padding: 1px 6px;
    margin-left: 6px;
    font-weight: 500;
    white-space: nowrap;
}
.nexus-turbo-peek-card-album {
    font-size: 10.5px;
    color: #58a6ff;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-bottom: 2px;
    font-weight: 500;
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

/* ═══════════════════════════════════════════════════════════════════
   v2.2.0 ULTRA-WIDE GALLERY & TRUE 16:9 PROPORTIONAL CARD OVERRIDES
   ═══════════════════════════════════════════════════════════════════ */

/* 1. Full Browser Width on Main /library Page (no 390px right dead zone) */
main,
main.max-w-6xl,
div.max-w-6xl,
.max-w-6xl,
.w-full.max-w-6xl,
.min-h-full > main {
    max-width: calc(100vw - 48px) !important;
    width: calc(100vw - 48px) !important;
    margin-left: auto !important;
    margin-right: auto !important;
    padding-left: 8px !important;
    padding-right: 8px !important;
    padding-bottom: 120px !important;
    box-sizing: border-box !important;
}

#grid,
.grid:has(> a.alb),
#grid.grid {
    display: grid !important;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)) !important;
    gap: 20px !important;
    width: 100% !important;
}

a.alb .strip,
.alb .strip,
div.strip {
    aspect-ratio: 16 / 10 !important;
    height: auto !important;
    min-height: 205px !important;
    max-height: 255px !important;
    position: relative !important;
    background: #090d14 !important;
    overflow: hidden !important;
}

/* 2. Quick Peek & Merged Gallery Modal: 86vw default + 96vw Ultra-Wide */
#nexus-turbo-peek-modal .nexus-turbo-peek-dialog,
.nexus-turbo-peek-dialog {
    position: fixed !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
    width: 86vw !important;
    max-width: 96vw !important;
    height: 92vh !important;
    max-height: 95vh !important;
    display: flex !important;
    flex-direction: column !important;
    overflow: hidden !important;
    border: 1px solid rgba(255, 255, 255, 0.22) !important;
    border-radius: 14px !important;
    background: #0d1117 !important;
    box-shadow: 0 32px 100px rgba(0, 0, 0, 0.95) !important;
    z-index: 2147483645 !important;
    transition: width 0.2s ease, height 0.2s ease !important;
}

#nexus-turbo-peek-modal .nexus-turbo-peek-dialog.is-ultrawide,
.nexus-turbo-peek-dialog.is-ultrawide {
    width: 96vw !important;
    max-width: 98vw !important;
    height: 95vh !important;
    max-height: 97vh !important;
}

/* 3. Grid Container inside Quick Peek: never compress rows, support 5x3 / 4x3 / 3x2 / 2x2 */
#nexus-turbo-peek-modal .nexus-turbo-peek-grid,
.nexus-turbo-peek-grid {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    overflow-y: auto !important;
    padding: 18px 22px !important;
    box-sizing: border-box !important;
    grid-auto-rows: max-content !important;
    align-content: start !important;
    align-items: stretch !important;
}

#nexus-turbo-peek-modal .nexus-turbo-peek-grid[data-layout="5x3"],
.nexus-turbo-peek-grid[data-layout="5x3"] {
    display: grid !important;
    grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
    gap: 16px !important;
}

#nexus-turbo-peek-modal .nexus-turbo-peek-grid[data-layout="4x3"],
.nexus-turbo-peek-grid[data-layout="4x3"] {
    display: grid !important;
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
    gap: 18px !important;
}

#nexus-turbo-peek-modal .nexus-turbo-peek-grid[data-layout="3x2"],
.nexus-turbo-peek-grid[data-layout="3x2"] {
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    gap: 20px !important;
}

#nexus-turbo-peek-modal .nexus-turbo-peek-grid[data-layout="2x2"],
.nexus-turbo-peek-grid[data-layout="2x2"] {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 22px !important;
}

@media (max-width: 1400px) {
    #nexus-turbo-peek-modal .nexus-turbo-peek-grid[data-layout="5x3"] {
        grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
    }
}
@media (max-width: 1100px) {
    #nexus-turbo-peek-modal .nexus-turbo-peek-grid[data-layout="5x3"],
    #nexus-turbo-peek-modal .nexus-turbo-peek-grid[data-layout="4x3"] {
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    }
}
@media (max-width: 780px) {
    #nexus-turbo-peek-modal .nexus-turbo-peek-grid[data-layout="5x3"],
    #nexus-turbo-peek-modal .nexus-turbo-peek-grid[data-layout="4x3"],
    #nexus-turbo-peek-modal .nexus-turbo-peek-grid[data-layout="3x2"] {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }
}

/* 4. Video Cards & 16:9 Thumbnails: no max-height crop, no clipped footer buttons */
#nexus-turbo-peek-modal .nexus-turbo-peek-card,
.nexus-turbo-peek-card {
    position: relative !important;
    background: #141a24 !important;
    border: 1px solid rgba(255, 255, 255, 0.14) !important;
    border-radius: 10px !important;
    overflow: hidden !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: flex-start !important;
    height: auto !important;
    min-height: 0 !important;
    box-sizing: border-box !important;
    transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease !important;
}

#nexus-turbo-peek-modal .nexus-turbo-peek-card:hover,
.nexus-turbo-peek-card:hover {
    border-color: rgba(88, 166, 255, 0.6) !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.65) !important;
}

#nexus-turbo-peek-modal .nexus-turbo-peek-card:not([style]) .nexus-turbo-peek-poster,
.nexus-turbo-peek-card .nexus-turbo-peek-poster {
    position: relative !important;
    width: 100% !important;
    aspect-ratio: 16 / 9 !important;
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    background: #090d13 !important;
    overflow: hidden !important;
    cursor: pointer !important;
    flex-shrink: 0 !important;
}

.nexus-turbo-peek-card .nexus-turbo-peek-poster img {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
    display: block !important;
    transition: transform 0.25s ease !important;
}

.nexus-turbo-peek-card:hover .nexus-turbo-peek-poster img {
    transform: scale(1.03) !important;
}

#nexus-turbo-peek-modal .nexus-turbo-peek-card-body,
.nexus-turbo-peek-card-body {
    padding: 10px 12px !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: space-between !important;
    gap: 6px !important;
    flex: 0 0 auto !important;
    min-height: 0 !important;
    height: auto !important;
    background: #10151f !important;
    border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
    box-sizing: border-box !important;
    overflow: visible !important;
}

#nexus-turbo-peek-modal .nexus-turbo-peek-card-actions,
.nexus-turbo-peek-card-actions {
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    height: 30px !important;
    min-height: 30px !important;
    margin-top: 4px !important;
    flex-shrink: 0 !important;
    visibility: visible !important;
    opacity: 1 !important;
}

#nexus-turbo-peek-modal .nexus-turbo-peek-card-actions .nexus-turbo-btn-sub {
    flex: 1 1 auto !important;
    height: 28px !important;
    padding: 0 8px !important;
    font-size: 11.5px !important;
    font-weight: 600 !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 4px !important;
    border-radius: 6px !important;
    background: rgba(56, 139, 253, 0.14) !important;
    border: 1px solid rgba(88, 166, 255, 0.3) !important;
    color: #c9d1d9 !important;
    cursor: pointer !important;
    transition: all 0.15s ease !important;
}

#nexus-turbo-peek-modal .nexus-turbo-peek-card-actions .nexus-turbo-btn-sub:hover {
    background: #1f6feb !important;
    border-color: #58a6ff !important;
    color: #fff !important;
}

/* 5. Quality Overlay Badge & Toolbar Selects inside Quick Peek / Merged Gallery */
.nexus-turbo-peek-qbadge-overlay {
    position: absolute !important;
    top: 8px !important;
    right: 8px !important;
    z-index: 6 !important;
    padding: 2px 7px !important;
    border-radius: 5px !important;
    font-size: 10px !important;
    font-weight: 700 !important;
    letter-spacing: 0.3px !important;
    pointer-events: none !important;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.65) !important;
}
.nexus-turbo-peek-qbadge {
    padding: 1px 6px !important;
    border-radius: 4px !important;
    font-size: 10px !important;
    font-weight: 700 !important;
}
.nexus-turbo-peek-qbadge-overlay.badge-quality-4k,
.nexus-turbo-peek-qbadge.badge-quality-4k {
    background: linear-gradient(135deg, #7c3aed, #db2777) !important;
    color: #fff !important;
    border: 1px solid rgba(255, 255, 255, 0.3) !important;
}
.nexus-turbo-peek-qbadge-overlay.badge-quality-1080p,
.nexus-turbo-peek-qbadge.badge-quality-1080p {
    background: linear-gradient(135deg, #0284c7, #059669) !important;
    color: #fff !important;
    border: 1px solid rgba(255, 255, 255, 0.25) !important;
}
.nexus-turbo-peek-qbadge-overlay.badge-quality-720p,
.nexus-turbo-peek-qbadge.badge-quality-720p {
    background: linear-gradient(135deg, #2563eb, #4f46e5) !important;
    color: #fff !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
}
.nexus-turbo-peek-qbadge-overlay.badge-quality-sd,
.nexus-turbo-peek-qbadge.badge-quality-sd {
    background: rgba(51, 65, 85, 0.9) !important;
    color: #cbd5e1 !important;
    border: 1px solid rgba(255, 255, 255, 0.15) !important;
}

.nexus-turbo-peek-select {
    background: #161b22 !important;
    color: #c9d1d9 !important;
    border: 1px solid rgba(255, 255, 255, 0.16) !important;
    border-radius: 6px !important;
    padding: 5px 10px !important;
    font-size: 12px !important;
    cursor: pointer !important;
    outline: none !important;
}
.nexus-turbo-peek-select:hover,
.nexus-turbo-peek-select:focus {
    border-color: #58a6ff !important;
}
`;

const combinedCss = (baseCss + '\n' + extraCss).replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');

// Now let's read the JavaScript template file or build it
console.log('Combined CSS length:', combinedCss.length);

const templateJs = fs.readFileSync(path.join(__dirname, 'script_template.js'), 'utf8');
const finalScript = templateJs.replace('/* __EMBEDDED_CSS__ */', combinedCss);

fs.writeFileSync(OUT_USERJS, finalScript, 'utf8');
console.log('Successfully created:', OUT_USERJS, 'Size:', finalScript.length, 'bytes');
