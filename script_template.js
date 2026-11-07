// ==UserScript==
// @name         Turbo.cr Library & Album Workspace (Standalone Edition)
// @namespace    https://github.com/ervss/turbo-cr-workspace
// @version      2.2.0
// @description  Standalone power-user workspace for Turbo.cr: cinema widescreen grid, multi-page library scanner, bitrate quality tags (4K/1080p/720p/SD), Ultra-Wide Quick Peek & Merged Multi-Album Gallery (5x3/4x3/3x2/2x2), direct stream resolver, built-in multi-video split-screen, .M3U8 playlist & JSON export, and offline IndexedDB history vault. No external server required!
// @author       ervss (https://github.com/ervss)
// @license      MIT
// @homepageURL  https://github.com/ervss/turbo-cr-workspace
// @supportURL   https://github.com/ervss/turbo-cr-workspace/issues
// @downloadURL  https://raw.githubusercontent.com/ervss/turbo-cr-workspace/main/turbo-library-workspace-standalone.user.js
// @updateURL    https://raw.githubusercontent.com/ervss/turbo-cr-workspace/main/turbo-library-workspace-standalone.user.js
// @match        https://turbo.cr/*
// @match        https://*.turbo.cr/*
// @run-at       document-idle
// @grant        GM_setClipboard
// @grant        GM_download
// ==/UserScript==

(function () {
    'use strict';

    // ── 0. Embed Frame Autoplay Handler ────────────────────────────
    if (window.top !== window) {
        if (/^\/embed\/[a-zA-Z0-9_-]+/i.test(location.pathname)) {
            const startAutoplay = () => {
                const video = document.querySelector('video#main-video, video');
                if (video && (video.src || video.currentSrc)) {
                    const p = video.play();
                    if (p && p.catch) {
                        p.catch(() => {
                            video.muted = true;
                            video.play().catch(() => {});
                        });
                    }
                    return true;
                }
                return false;
            };

            if (!startAutoplay()) {
                const obs = new MutationObserver(() => {
                    if (startAutoplay()) obs.disconnect();
                });
                obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
                setTimeout(() => obs.disconnect(), 10000);
            }
        }
        return;
    }
    if (!/(^|\.)turbo\.cr$/i.test(location.hostname)) return;

    console.log(
        '%c[Turbo Workspace v2.2.0 by ervss]%c Loaded — Standalone Edition (https://github.com/ervss/turbo-cr-workspace)',
        'color: #58a6ff; font-weight: bold',
        'color: #aaa'
    );

    // ── 1. DOM IDs & Storage Keys ──────────────────────────────────
    const TOOLBAR_ID = 'nexus-turbo-toolbar';
    const BUBBLE_ID = 'nexus-turbo-bubble';
    const TOAST_ID = 'nexus-turbo-toast';
    const GALLERY_ID = 'nexus-turbo-gallery';
    const PLAYER_ID = 'nexus-turbo-player';
    const SPLIT_ID = 'nexus-turbo-split-modal';
    const HELP_ID = 'nexus-turbo-help-modal';
    const PEEK_ID = 'nexus-turbo-peek-modal';
    const HISTORY_ID = 'nexus-turbo-history-modal';
    const STYLE_ID = 'turbo-workspace-standalone-styles';

    const STORAGE_POS_KEY = 'turbo_ws_pos';
    const STORAGE_MIN_KEY = 'turbo_ws_minimized';
    const STORAGE_GALLERY_KEY = 'turbo_ws_gallery_open';
    const STORAGE_INFINITE_KEY = 'turbo_ws_infinite_scroll';
    const STORAGE_PEEK_LAYOUT_KEY = 'turbo_ws_peek_layout_v2';
    const STORAGE_PEEK_WIDE_KEY = 'turbo_ws_peek_wide';

    // ── 2. State ───────────────────────────────────────────────────
    const state = {
        items: new Map(), // videoId -> { id, url, source_url, title, thumbnail, size, duration, quality, selected, row }
        busy: false,
        lastCardCount: 0,
        minimized: localStorage.getItem(STORAGE_MIN_KEY) === 'true',
        position: loadStoredPosition(),
        galleryOpen: localStorage.getItem(STORAGE_GALLERY_KEY) === 'true',
        galleryQuery: '',
        gallerySort: 'source',
        galleryPage: 0,
        galleryPerPage: 12,
        lastSelectedIndex: -1,
        currentPlayerIndex: -1,
    };

    const libState = {
        albums: new Map(), // id -> { id, title, url, cardEl, chkEl, badgeEl, peekBtn, scanned, files, videoCount, totalBytes, avgBytes, avgDuration, selected, visible }
        scanning: false,
        scanQueue: [],
        scanActive: 0,
        scanMaxConcurrency: 3,
        currentPage: 1,
        highestPage: 1,
        loadedPages: new Set(),
        maxPages: 40,
        paginationInitialized: false,
        loadingPage: false,
        infiniteScroll: localStorage.getItem(STORAGE_INFINITE_KEY) === 'true',
        busy: false,
        searchQuery: '',
        sortBy: 'default',
        filterMinVideos: 0,
        filterMinSizeMB: 0,
        filterMinDurationSec: 0,
        filterOnlySelected: false,
        filterOnlyScanned: false,
        filterQuality: 'all',
        autoScanNewPages: false,
        lastSelectedAlbumIndex: -1,
    };

    // ── 3. Style Injection ─────────────────────────────────────────
    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `/* __EMBEDDED_CSS__ */`;
        (document.head || document.documentElement).appendChild(style);
    }

    // ── 4. Route Helpers ───────────────────────────────────────────
    function isLibraryPage() {
        return /^\/library/i.test(location.pathname);
    }

    function isAlbumPage() {
        return /^\/a\/[a-zA-Z0-9_-]+/i.test(location.pathname);
    }

    function isWatchPage() {
        return /^\/v\/[a-zA-Z0-9_-]+/i.test(location.pathname);
    }

    // ── 5. Position & Dragging ─────────────────────────────────────
    function loadStoredPosition() {
        try {
            const raw = localStorage.getItem(STORAGE_POS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
                    return parsed;
                }
            }
        } catch {}
        return null;
    }

    function savePosition(x, y) {
        state.position = { x, y };
        try {
            localStorage.setItem(STORAGE_POS_KEY, JSON.stringify({ x, y }));
        } catch {}
    }

    function applyPosition(el, pos) {
        if (!el || !pos) return;
        const maxLeft = Math.max(10, window.innerWidth - (el.offsetWidth || 50) - 10);
        const maxTop = Math.max(10, window.innerHeight - (el.offsetHeight || 50) - 10);
        const safeX = Math.max(10, Math.min(maxLeft, pos.x));
        const safeTop = Math.max(10, Math.min(maxTop, pos.y));
        el.style.left = `${safeX}px`;
        el.style.top = `${safeTop}px`;
        el.style.right = 'auto';
        el.style.bottom = 'auto';
    }

    function makeDraggable(element, handle, onDragEnd) {
        let isDragging = false;
        let hasMoved = false;
        let startX = 0, startY = 0;
        let initialX = 0, initialY = 0;

        const onMouseDown = (e) => {
            if (e.target.closest('button, input, a, select, textarea, .nexus-turbo-min-btn')) return;
            isDragging = true;
            hasMoved = false;
            startX = e.clientX;
            startY = e.clientY;
            const rect = element.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
            element.style.transition = 'none';
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            e.preventDefault();
        };

        const onMouseMove = (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
                hasMoved = true;
            }
            const newX = initialX + dx;
            const newY = initialY + dy;
            const maxLeft = Math.max(10, window.innerWidth - element.offsetWidth - 10);
            const maxTop = Math.max(10, window.innerHeight - element.offsetHeight - 10);
            const safeX = Math.max(10, Math.min(maxLeft, newX));
            const safeTop = Math.max(10, Math.min(maxTop, newY));

            element.style.left = `${safeX}px`;
            element.style.top = `${safeTop}px`;
            element.style.right = 'auto';
            element.style.bottom = 'auto';
        };

        const onMouseUp = () => {
            if (!isDragging) return;
            isDragging = false;
            element.style.transition = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            if (hasMoved && onDragEnd) {
                const rect = element.getBoundingClientRect();
                onDragEnd(rect.left, rect.top);
            }
        };

        handle.addEventListener('mousedown', onMouseDown);
    }

    // ── 6. Formatting & Utilities ──────────────────────────────────
    function formatBytes(bytes) {
        if (!bytes || bytes <= 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function formatDuration(value, fallback = '—') {
        if (value === undefined || value === null) return fallback;
        const total = Math.max(0, Math.round(Number(value) || 0));
        if (total <= 0) return fallback;
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
            : `${m}:${String(s).padStart(2, '0')}`;
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>'"]/g, (char) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
        }[char]));
    }

    function toast(text, isError = false) {
        let el = document.getElementById(TOAST_ID);
        if (!el) {
            el = document.createElement('div');
            el.id = TOAST_ID;
            el.className = 'nexus-turbo-toast';
            document.body.appendChild(el);
        }
        el.style.borderColor = isError ? 'rgba(248, 81, 73, 0.6)' : 'rgba(88, 166, 255, 0.4)';
        el.innerHTML = `<span>${isError ? '⚠️' : '⚡'}</span><span>${text}</span>`;
        el.style.display = 'flex';
        clearTimeout(el._timer);
        el._timer = setTimeout(() => {
            el.style.display = 'none';
        }, 4000);
    }

    function copyToClipboard(text, successMsg = 'Copied to clipboard!') {
        if (typeof GM_setClipboard !== 'undefined') {
            GM_setClipboard(text);
            toast(`📋 ${successMsg}`);
            return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                toast(`📋 ${successMsg}`);
            }).catch(() => {
                fallbackCopy(text, successMsg);
            });
            return;
        }
        fallbackCopy(text, successMsg);
    }

    function fallbackCopy(text, successMsg) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            toast(`📋 ${successMsg}`);
        } catch {
            toast('Failed to copy to clipboard', true);
        }
        ta.remove();
    }

    function downloadFile(content, filename, mimeType = 'text/plain;charset=utf-8') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            a.remove();
            URL.revokeObjectURL(url);
        }, 2000);
    }

    // ── 7. Direct Stream Resolution Engine ─────────────────────────
    const streamCache = new Map();
    const STREAM_CACHE_TTL = 30 * 60 * 1000;

    async function resolveTurboStream(videoId) {
        if (!videoId) return null;
        const cached = streamCache.get(videoId);
        if (cached && cached.expires > Date.now() && cached.url) {
            return cached.url;
        }

        try {
            const resp = await fetch(`/api/sign?v=${encodeURIComponent(videoId)}`, {
                headers: { 'Accept': 'application/json, text/plain, */*' },
                credentials: 'same-origin',
            });
            if (resp.ok) {
                const data = await resp.json();
                if (data && data.url) {
                    streamCache.set(videoId, { url: data.url, expires: Date.now() + STREAM_CACHE_TTL });
                    return data.url;
                }
            }
        } catch (e) {
            console.warn('[Turbo Workspace] /api/sign failed for', videoId, e);
        }

        try {
            const resp = await fetch(`/embed/${encodeURIComponent(videoId)}`, { credentials: 'same-origin' });
            if (resp.ok) {
                const html = await resp.text();
                const directMatch = html.match(/const\s+VIDEO_DIRECT\s*=\s*["']([^"']+)["'];/);
                if (directMatch && !directMatch[1].includes('turbo.cr/')) {
                    const url = directMatch[1].replace(/\\/g, '');
                    streamCache.set(videoId, { url, expires: Date.now() + STREAM_CACHE_TTL });
                    return url;
                }
                const cdnMatch = html.match(/(https?:\/\/[^"'\s]+turbocdn[^"'\s]+\.mp4[^"'\s]*)/i);
                if (cdnMatch) {
                    const url = cdnMatch[1];
                    streamCache.set(videoId, { url, expires: Date.now() + STREAM_CACHE_TTL });
                    return url;
                }
            }
        } catch (e) {
            console.warn('[Turbo Workspace] Embed fallback failed for', videoId, e);
        }

        return null;
    }

    async function batchResolveStreams(files, onProgress) {
        const results = [];
        const concurrency = 4;
        let index = 0;

        async function worker() {
            while (index < files.length) {
                const i = index++;
                const f = files[i];
                const url = await resolveTurboStream(f.id);
                results[i] = { ...f, streamUrl: url || `https://turbo.cr/v/${f.id}` };
                if (onProgress) onProgress(results.filter(Boolean).length, files.length);
            }
        }

        const workers = Array.from({ length: Math.min(concurrency, files.length) }, () => worker());
        await Promise.all(workers);
        return results;
    }

    // ── 8. IndexedDB Vault Storage ─────────────────────────────────
    const DB_NAME = 'TurboWorkspaceVaultDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'albums';

    let dbPromise = null;
    function getVaultDB() {
        if (!dbPromise) {
            dbPromise = new Promise((resolve, reject) => {
                const req = indexedDB.open(DB_NAME, DB_VERSION);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    }
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        }
        return dbPromise;
    }

    async function vaultGetAlbum(id) {
        try {
            const db = await getVaultDB();
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.get(id);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(null);
            });
        } catch { return null; }
    }

    async function vaultSaveAlbum(record) {
        try {
            const db = await getVaultDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(record);
        } catch {}
    }

    async function vaultGetAllAlbums() {
        try {
            const db = await getVaultDB();
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve([]);
            });
        } catch { return []; }
    }

    async function vaultDeleteAlbum(id) {
        try {
            const db = await getVaultDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(id);
        } catch {}
    }

    async function vaultClearAll() {
        try {
            const db = await getVaultDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).clear();
        } catch {}
    }

    // ── 9. Quality Estimator ───────────────────────────────────────
    function calculateAlbumQuality(files) {
        if (!files || !files.length) {
            return { label: 'SD', icon: '📁', tier: 1, bitrateMbps: 0, badgeClass: 'badge-quality-sd', tooltip: 'No video files found' };
        }
        let totalBits = 0;
        let totalDur = 0;

        files.forEach((f) => {
            if (f.dur > 0 && f.size > 0) {
                totalBits += (f.size * 8);
                totalDur += f.dur;
            }
        });

        let avgBitrateMbps = 0;
        if (totalDur > 0) {
            avgBitrateMbps = (totalBits / totalDur) / 1000000;
        } else {
            const avgSizeMB = (files.reduce((a, b) => a + (b.size || 0), 0) / files.length) / (1024 * 1024);
            avgBitrateMbps = (avgSizeMB * 8) / 45; // estimate 45s average duration
        }

        if (avgBitrateMbps >= 12.0) {
            return {
                label: '4K UHD',
                icon: '💎',
                tier: 4,
                bitrateMbps: avgBitrateMbps,
                badgeClass: 'badge-quality-4k',
                tooltip: `Average bitrate: ${avgBitrateMbps.toFixed(1)} Mbps (4K Ultra HD quality)`
            };
        } else if (avgBitrateMbps >= 3.5) {
            return {
                label: '1080p FHD',
                icon: '⭐',
                tier: 3,
                bitrateMbps: avgBitrateMbps,
                badgeClass: 'badge-quality-1080p',
                tooltip: `Average bitrate: ${avgBitrateMbps.toFixed(1)} Mbps (Full HD quality)`
            };
        } else if (avgBitrateMbps >= 1.6) {
            return {
                label: '720p HD',
                icon: '⚡',
                tier: 2,
                bitrateMbps: avgBitrateMbps,
                badgeClass: 'badge-quality-720p',
                tooltip: `Average bitrate: ${avgBitrateMbps.toFixed(1)} Mbps (HD quality)`
            };
        } else {
            return {
                label: '480p SD',
                icon: '📁',
                tier: 1,
                bitrateMbps: avgBitrateMbps,
                badgeClass: 'badge-quality-sd',
                tooltip: `Average bitrate: ${avgBitrateMbps.toFixed(1)} Mbps (Standard/Low quality)`
            };
        }
    }

    function getSingleFileQuality(f) {
        if (!f || !f.size) return null;
        let mbps = 0;
        if (f.dur > 0) {
            mbps = ((f.size * 8) / f.dur) / 1000000;
        } else {
            mbps = (((f.size / (1024 * 1024)) * 8) / 45);
        }
        if (mbps >= 12.0) return { label: '4K UHD', badgeClass: 'badge-quality-4k', mbps };
        if (mbps >= 3.5) return { label: '1080p', badgeClass: 'badge-quality-1080p', mbps };
        if (mbps >= 1.6) return { label: '720p', badgeClass: 'badge-quality-720p', mbps };
        return { label: 'SD', badgeClass: 'badge-quality-sd', mbps };
    }

    // ── 10. HTML Parser (const FILES) ──────────────────────────────
    function parseFilesFromHtml(htmlText) {
        if (!htmlText) return [];

        // Attempt direct JSON.parse if the array block is standard JSON
        const jsonMatch = htmlText.match(/const\s+FILES\s*=\s*(\[\s*\{[\s\S]*?\}\s*\])\s*;/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[1]);
                if (Array.isArray(parsed) && parsed.length) {
                    return parsed.map((f) => ({
                        id: String(f.id || '').trim(),
                        name: String(f.name || `${f.id}.mp4`).replace(/\\"/g, '"').trim(),
                        size: parseInt(f.size || 0, 10),
                        dur: parseInt(f.dur || 0, 10),
                        thumb: String(f.thumb || '').replace(/\\\//g, '/'),
                        views: parseInt(f.views || 0, 10),
                    }));
                }
            } catch {}
        }

        // Robust fallback regex parsing supporting both quoted ("id":) and unquoted (id:) keys
        const blockMatch = htmlText.match(/const\s+FILES\s*=\s*\[(.*?)\]\s*;/s);
        if (!blockMatch) return [];
        const block = blockMatch[1];
        const files = [];
        const objectRegex = /\{([^}]+)\}/g;
        let objMatch;
        while ((objMatch = objectRegex.exec(block)) !== null) {
            const body = objMatch[1];
            const idMatch = body.match(/["']?id["']?\s*:\s*["']([^"']+)["']/);
            if (!idMatch) continue;
            const id = idMatch[1].trim();
            const nameMatch = body.match(/["']?name["']?\s*:\s*["']([^"']+)["']/);
            const name = nameMatch ? nameMatch[1].replace(/\\"/g, '"').trim() : `${id}.mp4`;
            const sizeMatch = body.match(/["']?size["']?\s*:\s*(\d+)/);
            const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 0;
            const durMatch = body.match(/["']?dur["']?\s*:\s*(\d+)/);
            const dur = durMatch ? parseInt(durMatch[1], 10) : 0;
            const thumbMatch = body.match(/["']?thumb["']?\s*:\s*["']([^"']+)["']/);
            const thumb = thumbMatch ? thumbMatch[1].replace(/\\\//g, '/') : '';
            const viewsMatch = body.match(/["']?views["']?\s*:\s*(\d+)/);
            const views = viewsMatch ? parseInt(viewsMatch[1], 10) : 0;
            files.push({ id, name, size, dur, thumb, views });
        }
        return files;
    }

    function detectPaginationInfo() {
        if (libState.paginationInitialized) return;
        libState.paginationInitialized = true;

        const urlPageMatch = location.search.match(/page=(\d+)/i);
        const initPage = urlPageMatch ? parseInt(urlPageMatch[1], 10) : 1;
        libState.currentPage = initPage;
        libState.highestPage = Math.max(libState.highestPage || 1, initPage);
        libState.loadedPages.add(initPage);

        const text = document.body.innerText || '';
        const m = text.match(/Page\s+(\d+)\s+of\s+(\d+)/i);
        if (m && m[2]) {
            libState.maxPages = Math.max(libState.maxPages, parseInt(m[2], 10) || 40);
        }

        document.querySelectorAll('a[href*="page="]').forEach((a) => {
            const pm = a.href.match(/page=(\d+)/);
            if (pm) {
                const p = parseInt(pm[1], 10);
                if (p > libState.maxPages) libState.maxPages = p;
            }
        });
    }

    function updateOnPageShowingText() {
        try {
            const spans = document.querySelectorAll('span, div, p');
            for (const el of spans) {
                if (/Showing\s+\d+\s+albums/i.test(el.textContent) && el.children.length === 0) {
                    el.textContent = `Showing ${libState.albums.size} albums — Pages 1–${libState.highestPage} of ${libState.maxPages}`;
                    break;
                }
            }
        } catch {}
    }

    function applyAlbumData(album, data) {
        album.scanned = true;
        const oldSelectedMap = new Map((album.files || []).map(f => [f.id, f.selected]));
        album.files = (data.files || []).map(f => ({
            ...f,
            selected: oldSelectedMap.has(f.id) ? oldSelectedMap.get(f.id) : (f.selected !== undefined ? f.selected : true)
        }));
        album.videoCount = album.files.length;
        album.totalBytes = album.files.reduce((acc, f) => acc + (f.size || 0), 0);
        album.avgBytes = album.videoCount > 0 ? Math.round(album.totalBytes / album.videoCount) : 0;
        album.avgDuration = album.videoCount > 0
            ? Math.round(album.files.reduce((acc, f) => acc + (f.dur || 0), 0) / album.videoCount)
            : 0;

        const quality = calculateAlbumQuality(album.files);
        album.quality = quality;

        if (album.badgeEl) {
            album.badgeEl.className = 'nexus-turbo-album-badge badge-done';
            const durFormatted = album.avgDuration > 0 ? formatDuration(album.avgDuration) : '—';
            const durTooltip = album.avgDuration > 0
                ? `Average duration: ${durFormatted}`
                : 'Duration not reported by Turbo.cr';
            album.badgeEl.innerHTML = `
                <div class="badge-row-primary">
                    <span class="badge-stat">🎬 <b class="stat-hl">${album.videoCount} vids</b></span>
                    <span class="badge-stat">📦 <b class="stat-green">${formatBytes(album.totalBytes)}</b></span>
                    <span class="badge-quality ${quality.badgeClass}" title="${escapeHtml(quality.tooltip)}">${quality.icon} <b>${quality.label}</b></span>
                </div>
                <div class="badge-row-secondary">
                    <span class="badge-stat">📊 Ø <b class="stat-purple">${formatBytes(album.avgBytes)}</b> / vid</span>
                    <span class="badge-stat" title="${durTooltip}">⏱️ Ø <b class="stat-amber">${durFormatted}</b></span>
                </div>
            `;
        }
    }

    // ── 11. Bulk Export Helpers ─────────────────────────────────────
    function copyWatchUrlsFromFiles(files) {
        if (!files || !files.length) {
            toast('No videos selected to copy', true);
            return;
        }
        const text = files.map(f => `https://turbo.cr/v/${f.id}`).join('\n');
        copyToClipboard(text, `${files.length} Watch URLs copied!`);
    }

    async function copyDirectUrlsFromFiles(files) {
        if (!files || !files.length) {
            toast('No videos selected to resolve', true);
            return;
        }
        toast(`⏳ Resolving direct streams for ${files.length} videos...`);
        const resolved = await batchResolveStreams(files, (curr, total) => {
            toast(`⏳ Resolving streams (${curr}/${total})...`);
        });
        const text = resolved.map(f => f.streamUrl).join('\n');
        copyToClipboard(text, `${resolved.length} Direct Stream URLs copied!`);
    }

    async function exportM3UPlaylist(files, albumName = 'TurboCR') {
        if (!files || !files.length) {
            toast('No videos selected for playlist', true);
            return;
        }
        toast(`⏳ Preparing .M3U8 playlist for ${files.length} videos...`);
        const resolved = await batchResolveStreams(files, (curr, total) => {
            toast(`⏳ Resolving streams for M3U8 (${curr}/${total})...`);
        });

        let m3u = '#EXTM3U\n';
        resolved.forEach((f) => {
            const title = (f.name || `Video ${f.id}`).replace(/[\r\n]/g, ' ');
            const dur = Math.max(0, f.dur || 0);
            m3u += `#EXTINF:${dur},${title}\n`;
            m3u += `${f.streamUrl}\n`;
        });

        const safeTitle = albumName.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 50) || 'TurboCR_Playlist';
        downloadFile(m3u, `${safeTitle}.m3u8`, 'application/x-mpegurl;charset=utf-8');
        toast(`🎵 Downloaded ${safeTitle}.m3u8 (${resolved.length} tracks)!`);
    }

    function exportMetadataJSON(files, albumMeta = {}) {
        if (!files || !files.length) {
            toast('No videos selected for JSON export', true);
            return;
        }
        const payload = {
            album: albumMeta,
            exportedAt: new Date().toISOString(),
            totalFiles: files.length,
            files: files.map(f => ({
                id: f.id,
                name: f.name || `Video ${f.id}`,
                watchUrl: `https://turbo.cr/v/${f.id}`,
                sizeBytes: f.size || 0,
                durationSeconds: f.dur || 0,
                thumbnail: f.thumb || `https://static.scdn.st/6049fd43-838b-492d-a20a-9aead716dfe7/thumbs/${f.id}.jpg`,
            })),
        };
        const safeTitle = (albumMeta.title || 'TurboCR_Metadata').replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 50);
        downloadFile(JSON.stringify(payload, null, 2), `${safeTitle}.json`, 'application/json;charset=utf-8');
        toast(`📄 Exported metadata for ${files.length} videos!`);
    }

    // ── 12. Built-in Multi-Video Split-Screen Wall ──────────────────
    function openSplitScreen(files) {
        if (!files || !files.length) {
            toast('No videos selected for Split-Screen', true);
            return;
        }

        const maxVideos = 12;
        const targetFiles = files.slice(0, maxVideos);
        if (files.length > maxVideos) {
            toast(`Showing first ${maxVideos} videos in Split-Screen.`);
        }

        const old = document.getElementById(SPLIT_ID);
        if (old) old.remove();

        const modal = document.createElement('div');
        modal.id = SPLIT_ID;
        modal.innerHTML = `
            <div class="nexus-turbo-split-topbar">
                <div class="nexus-turbo-split-title">
                    <span>📺 Split-Screen Player</span>
                    <span style="font-size:12px;color:#8b949e;font-weight:normal;">(${targetFiles.length} videos · hover to solo audio)</span>
                </div>
                <div class="nexus-turbo-split-controls">
                    <button type="button" class="nexus-turbo-split-btn" id="nexus-turbo-split-play-all">▶ Play All</button>
                    <button type="button" class="nexus-turbo-split-btn" id="nexus-turbo-split-pause-all">⏸ Pause All</button>
                    <button type="button" class="nexus-turbo-split-btn" id="nexus-turbo-split-mute-all">🔇 Mute All</button>
                    <button type="button" class="nexus-turbo-split-btn" id="nexus-turbo-split-fs" title="Toggle Fullscreen">⛶ Fullscreen</button>
                    <button type="button" class="nexus-turbo-split-btn danger" id="nexus-turbo-split-close">✕ Close</button>
                </div>
            </div>
            <div class="nexus-turbo-split-grid" data-count="${targetFiles.length}"></div>
        `;

        const gridEl = modal.querySelector('.nexus-turbo-split-grid');

        targetFiles.forEach((f) => {
            const tile = document.createElement('div');
            tile.className = 'nexus-turbo-split-tile';
            tile.dataset.id = f.id;
            tile.innerHTML = `
                <iframe src="https://turbo.cr/embed/${encodeURIComponent(f.id)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
                <div class="nexus-turbo-split-tile-info">
                    <span class="nexus-turbo-split-tile-title" title="${escapeHtml(f.name || f.title || f.id)}">${escapeHtml(f.name || f.title || f.id)}</span>
                    <span class="nexus-turbo-split-tile-badge">${formatDuration(f.dur || f.duration)}</span>
                </div>
            `;
            gridEl.appendChild(tile);
        });

        // Topbar action handlers
        modal.querySelector('#nexus-turbo-split-close').addEventListener('click', () => modal.remove());
        modal.querySelector('#nexus-turbo-split-fs').addEventListener('click', () => {
            if (!document.fullscreenElement) {
                modal.requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen().catch(() => {});
            }
        });

        modal.querySelector('#nexus-turbo-split-play-all').addEventListener('click', () => {
            modal.querySelectorAll('iframe').forEach(iframe => {
                try {
                    iframe.contentWindow?.postMessage({ type: 'play' }, '*');
                } catch {}
            });
        });

        modal.querySelector('#nexus-turbo-split-pause-all').addEventListener('click', () => {
            modal.querySelectorAll('iframe').forEach(iframe => {
                try {
                    iframe.contentWindow?.postMessage({ type: 'pause' }, '*');
                } catch {}
            });
        });

        modal.querySelector('#nexus-turbo-split-mute-all').addEventListener('click', () => {
            modal.querySelectorAll('.nexus-turbo-split-tile').forEach(t => t.classList.remove('is-audio-active'));
            modal.querySelectorAll('iframe').forEach(iframe => {
                try {
                    iframe.contentWindow?.postMessage({ type: 'mute' }, '*');
                } catch {}
            });
        });

        const onEsc = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', onEsc);
            }
        };
        document.addEventListener('keydown', onEsc);

        document.body.appendChild(modal);
        toast(`📺 Multi-Video Split-Screen active (${targetFiles.length} videos)`);
    }

    // ── 13. Help & Keyboard Shortcuts Modal ────────────────────────
    function openHelpModal() {
        const old = document.getElementById(HELP_ID);
        if (old) old.remove();

        const modal = document.createElement('div');
        modal.id = HELP_ID;
        modal.innerHTML = `
            <div class="nexus-turbo-help-backdrop" data-close-help></div>
            <div class="nexus-turbo-help-dialog" role="dialog" aria-modal="true">
                <div class="nexus-turbo-help-head">
                    <h3>⚡ Turbo.cr Workspace — Help & Shortcuts</h3>
                    <button type="button" class="nexus-turbo-min-btn" data-close-help style="font-size:18px;">✕</button>
                </div>
                <div class="nexus-turbo-help-body">
                    <p>Welcome to <b>Turbo.cr Workspace (Standalone Edition v2.1.0)</b> by <a href="https://github.com/ervss" target="_blank" style="color:#58a6ff;">ervss</a>. Works entirely inside your browser with no local backend required!</p>

                    <h4 style="margin:16px 0 8px;color:#f0f6fc;">⌨️ Keyboard Shortcuts</h4>
                    <table class="nexus-turbo-help-table">
                        <thead>
                            <tr><th>Shortcut</th><th>Action</th></tr>
                        </thead>
                        <tbody>
                            <tr><td><kbd>/</kbd></td><td>Focus search filter input</td></tr>
                            <tr><td><kbd>Shift</kbd> + <kbd>A</kbd></td><td>Select all visible albums / videos</td></tr>
                            <tr><td><kbd>Shift</kbd> + <kbd>C</kbd></td><td>Clear selection</td></tr>
                            <tr><td><kbd>S</kbd></td><td>Start / Pause background metadata scan</td></tr>
                            <tr><td><kbd>N</kbd></td><td>Load next library page</td></tr>
                            <tr><td><kbd>Alt</kbd> + <kbd>←</kbd> / <kbd>→</kbd></td><td>Previous / Next video in Modal Player</td></tr>
                            <tr><td><kbd>Shift</kbd> + Click</td><td>Range selection between items</td></tr>
                            <tr><td><kbd>?</kbd></td><td>Open this Help modal</td></tr>
                            <tr><td><kbd>Esc</kbd></td><td>Close any active modal dialog</td></tr>
                        </tbody>
                    </table>

                    <h4 style="margin:20px 0 8px;color:#f0f6fc;">💡 Pro Features</h4>
                    <ul style="padding-left:18px;margin:0;color:#c9d1d9;display:flex;flex-direction:column;gap:6px;">
                        <li><b>💎 Bitrate Quality Tags:</b> Albums are automatically evaluated based on total bits divided by duration: <code>4K UHD (≥12M)</code>, <code>1080p FHD (≥3.5M)</code>, <code>720p HD (≥1.6M)</code>, and <code>480p SD</code>.</li>
                        <li><b>👁️ Quick Peek:</b> Click the eye icon on any album card to inspect, filter, play, or export its videos without navigating away from <code>/library</code>.</li>
                        <li><b>🎵 Export .M3U:</b> Generates ready-to-stream playlists for VLC, MPV, IINA, or PotPlayer with direct CDN links.</li>
                        <li><b>📜 Offline History Vault:</b> Scanned albums are stored permanently in browser IndexedDB. Export a JSON backup anytime or import previous archives.</li>
                        <li><b>📺 Multi-Video Split-Screen:</b> Select up to 12 videos and watch them concurrently in an adaptive cinema grid.</li>
                    </ul>

                    <div style="margin-top:20px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.1);display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#8b949e;">
                        <span>Version 2.1.0 · MIT License</span>
                        <a href="https://github.com/ervss/turbo-cr-workspace" target="_blank" style="color:#58a6ff;text-decoration:none;">GitHub Repository ↗</a>
                    </div>
                </div>
            </div>
        `;

        modal.addEventListener('click', (e) => {
            if (e.target.hasAttribute('data-close-help') || e.target.closest('[data-close-help]')) {
                modal.remove();
            }
        });

        document.body.appendChild(modal);
    }

    // ── 14. Library Mode Logic ─────────────────────────────────────
    function applyLibraryFilterAndSort() {
        const container = document.getElementById('grid')
            || document.querySelector('.grid')
            || document.querySelector('a.alb')?.parentElement;
        if (!container) return;

        const albums = Array.from(libState.albums.values());
        const query = libState.searchQuery.trim().toLowerCase();

        let visibleCount = 0;
        albums.forEach((album) => {
            let visible = true;

            if (libState.filterOnlySelected && !album.selected) visible = false;
            if (visible && libState.filterOnlyScanned && !album.scanned) visible = false;

            if (visible && query) {
                const matches = (album.title || '').toLowerCase().includes(query) || album.id.toLowerCase().includes(query);
                if (!matches) visible = false;
            }

            if (visible && libState.filterMinVideos > 0) {
                if (!album.scanned || album.videoCount < libState.filterMinVideos) visible = false;
            }

            if (visible && libState.filterMinSizeMB > 0) {
                const sizeMB = (album.totalBytes || 0) / (1024 * 1024);
                if (!album.scanned || sizeMB < libState.filterMinSizeMB) visible = false;
            }

            if (visible && libState.filterMinDurationSec > 0) {
                if (!album.scanned || album.avgDuration < libState.filterMinDurationSec) visible = false;
            }

            if (visible && libState.filterQuality && libState.filterQuality !== 'all') {
                if (!album.scanned || !album.quality) {
                    visible = false;
                } else {
                    const qTier = album.quality.tier || 0;
                    if (libState.filterQuality === '4k' && qTier < 4) visible = false;
                    if (libState.filterQuality === '1080p' && qTier < 3) visible = false;
                    if (libState.filterQuality === '720p' && qTier < 2) visible = false;
                    if (libState.filterQuality === 'sd' && qTier > 1) visible = false;
                }
            }

            album.visible = visible;
            if (album.cardEl) {
                album.cardEl.classList.toggle('nexus-turbo-hidden', !visible);
                album.cardEl.style.setProperty('display', visible ? '' : 'none', 'important');
            }
            if (visible) visibleCount++;
        });

        const sorters = {
            default: () => 0,
            size_desc: (a, b) => (b.totalBytes || 0) - (a.totalBytes || 0),
            vids_desc: (a, b) => (b.videoCount || 0) - (a.videoCount || 0),
            dur_desc: (a, b) => (b.avgDuration || 0) - (a.avgDuration || 0),
            avg_desc: (a, b) => (b.avgBytes || 0) - (a.avgBytes || 0),
            name_asc: (a, b) => (a.title || '').localeCompare(b.title || '', undefined, { numeric: true }),
            selected_first: (a, b) => Number(b.selected) - Number(a.selected),
        };

        const sorter = sorters[libState.sortBy] || sorters.default;

        if (libState.sortBy !== 'default') {
            const sorted = [...albums].sort(sorter);
            sorted.forEach((album) => {
                if (album.cardEl && album.cardEl.parentElement === container) {
                    container.appendChild(album.cardEl);
                }
            });
        }

        updateLibraryToolbar();
    }

    async function openAlbumQuickPeek(album) {
        try {
            if (!album) return;
            if (!album.scanned || !album.files || !album.files.length) {
                toast(`⏳ Fetching videos for album "${album.title || album.id}"...`);
                await fetchAlbumMetadata(album);
            }

            const oldModal = document.getElementById(PEEK_ID);
            if (oldModal) oldModal.remove();

            let currentLayout = localStorage.getItem(STORAGE_PEEK_LAYOUT_KEY) || (window.innerWidth >= 1400 ? '4x3' : '3x2');
            let isUltraWide = localStorage.getItem(STORAGE_PEEK_WIDE_KEY) === 'true';
            let peekSearchQuery = '';
            let peekSortBy = 'default';
            let peekAlbumFilter = 'all';
            let peekVisibleLimit = 120;
            const PEEK_BATCH_SIZE = 120;

            const allFiles = Array.isArray(album.files) ? album.files : [];
            allFiles.forEach((f) => {
                if (f.selected === undefined) f.selected = true;
            });

            const uniqueAlbumTitles = [...new Set(allFiles.map(f => f.albumTitle).filter(Boolean))];

            const modal = document.createElement('div');
            modal.id = PEEK_ID;
            modal.innerHTML = `
                <div class="nexus-turbo-peek-backdrop" data-close-peek></div>
                <div class="nexus-turbo-peek-dialog ${isUltraWide ? 'is-ultrawide' : ''}" role="dialog" aria-modal="true">
                    <!-- Header -->
                    <div class="nexus-turbo-peek-header">
                        <h3>📂 ${escapeHtml(album.title)} <span style="font-size:12px;color:#8b949e;font-weight:normal;">(${album.videoCount || allFiles.length} videos · ${formatBytes(album.totalBytes)})</span></h3>
                        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                            <div class="nexus-turbo-layout-group">
                                <button type="button" class="nexus-turbo-layout-btn ${currentLayout === '5x3' ? 'is-active' : ''}" data-peek-layout="5x3" title="5 columns (Ultra-Wide)">▦ 5x3</button>
                                <button type="button" class="nexus-turbo-layout-btn ${currentLayout === '4x3' ? 'is-active' : ''}" data-peek-layout="4x3" title="4 columns (Widescreen)">▤ 4x3</button>
                                <button type="button" class="nexus-turbo-layout-btn ${currentLayout === '3x2' ? 'is-active' : ''}" data-peek-layout="3x2" title="3 columns (Balanced)">⊞ 3x2</button>
                                <button type="button" class="nexus-turbo-layout-btn ${currentLayout === '2x2' ? 'is-active' : ''}" data-peek-layout="2x2" title="2 columns (Large)">☷ 2x2</button>
                                <button type="button" class="nexus-turbo-layout-btn ${currentLayout === 'list' ? 'is-active' : ''}" data-peek-layout="list" title="Compact List view">☰ List</button>
                            </div>
                            <button type="button" class="nexus-turbo-layout-btn ${isUltraWide ? 'is-active' : ''}" id="nexus-turbo-peek-wide-btn" title="Toggle Ultra-Wide 96% Window Mode">↔ Wide</button>
                            <button type="button" class="nexus-turbo-min-btn" data-close-peek style="font-size:18px;">✕</button>
                        </div>
                    </div>

                    <!-- Action Toolbar -->
                    <div class="nexus-turbo-peek-toolbar">
                        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:#c9d1d9;">
                                <input type="checkbox" id="nexus-turbo-peek-select-all" class="nexus-turbo-peek-chk" checked>
                                <span>Select All</span>
                            </label>
                            <span id="nexus-turbo-peek-count" style="font-size:11.5px;color:#8b949e;">0 / 0 selected</span>
                            <input type="text" id="nexus-turbo-peek-search" class="nexus-turbo-peek-search-input" placeholder="🔍 Filter videos...">
                            <select id="nexus-turbo-peek-sort" class="nexus-turbo-peek-select" title="Sort videos inside gallery">
                                <option value="default">Sort: Default</option>
                                <option value="dur_desc">⏱️ Longest Duration</option>
                                <option value="dur_asc">⏱️ Shortest Duration</option>
                                <option value="size_desc">📦 Largest Size</option>
                                <option value="bitrate_desc">💎 Highest Bitrate</option>
                                <option value="name_asc">🔤 Name (A–Z)</option>
                                ${uniqueAlbumTitles.length > 1 ? '<option value="album_asc">📁 Album Name</option>' : ''}
                            </select>
                            ${uniqueAlbumTitles.length > 1 ? `
                            <select id="nexus-turbo-peek-album-filter" class="nexus-turbo-peek-select" title="Filter by source album">
                                <option value="all">📁 All Albums (${uniqueAlbumTitles.length})</option>
                                ${uniqueAlbumTitles.map(t => `<option value="${escapeHtml(t)}">📁 ${escapeHtml(t)}</option>`).join('')}
                            </select>
                            ` : ''}
                        </div>

                        <div class="nexus-turbo-peek-actions">
                            <button type="button" class="nexus-turbo-btn-split" id="nexus-turbo-peek-btn-split" title="Watch selected videos in Multi-Video Split-Screen">
                                📺 Split-Screen (0)
                            </button>
                            <button type="button" class="nexus-turbo-btn-copy" id="nexus-turbo-peek-btn-copy-watch" title="Copy Watch URLs to clipboard">
                                📋 Copy Watch URLs
                            </button>
                            <button type="button" class="nexus-turbo-btn-copy" id="nexus-turbo-peek-btn-copy-direct" title="Resolve and copy direct CDN stream links">
                                🔗 Copy Direct Streams
                            </button>
                            <button type="button" class="nexus-turbo-btn-export" id="nexus-turbo-peek-btn-m3u" title="Export .M3U8 playlist for VLC / MPV / PotPlayer">
                                🎵 Export .M3U
                            </button>
                            <button type="button" class="nexus-turbo-btn-export" id="nexus-turbo-peek-btn-json" title="Export structured JSON metadata">
                                📄 Export JSON
                            </button>
                        </div>
                    </div>

                    <!-- Gallery / Grid Container -->
                    <div class="nexus-turbo-peek-grid" id="nexus-turbo-peek-grid" data-layout="${currentLayout}"></div>

                    <!-- Pagination Footer Bar -->
                    <div id="nexus-turbo-peek-pagination-container"></div>
                </div>
            `;

        const dialogEl = modal.querySelector('.nexus-turbo-peek-dialog');
        const gridEl = modal.querySelector('#nexus-turbo-peek-grid');
        const countEl = modal.querySelector('#nexus-turbo-peek-count');
        const splitBtn = modal.querySelector('#nexus-turbo-peek-btn-split');
        const copyWatchBtn = modal.querySelector('#nexus-turbo-peek-btn-copy-watch');
        const copyDirectBtn = modal.querySelector('#nexus-turbo-peek-btn-copy-direct');
        const m3uBtn = modal.querySelector('#nexus-turbo-peek-btn-m3u');
        const jsonBtn = modal.querySelector('#nexus-turbo-peek-btn-json');
        const selectAllChk = modal.querySelector('#nexus-turbo-peek-select-all');
        const paginationContainer = modal.querySelector('#nexus-turbo-peek-pagination-container');
        const searchInput = modal.querySelector('#nexus-turbo-peek-search');
        const sortSelect = modal.querySelector('#nexus-turbo-peek-sort');
        const albumFilterSelect = modal.querySelector('#nexus-turbo-peek-album-filter');
        const wideBtn = modal.querySelector('#nexus-turbo-peek-wide-btn');

        let lastPeekIndex = -1;

        if (wideBtn && dialogEl) {
            wideBtn.addEventListener('click', () => {
                isUltraWide = !isUltraWide;
                localStorage.setItem(STORAGE_PEEK_WIDE_KEY, String(isUltraWide));
                dialogEl.classList.toggle('is-ultrawide', isUltraWide);
                wideBtn.classList.toggle('is-active', isUltraWide);
            });
        }

        function updatePeekToolbar() {
            const files = album.files || [];
            const sel = files.filter(f => f.selected);
            const selCount = sel.length;
            const selBytes = sel.reduce((acc, f) => acc + (f.size || 0), 0);

            countEl.textContent = `${selCount} / ${files.length} selected (${formatBytes(selBytes)})`;
            splitBtn.disabled = selCount === 0;
            splitBtn.innerHTML = `📺 Split-Screen (${selCount})`;

            copyWatchBtn.disabled = selCount === 0;
            copyDirectBtn.disabled = selCount === 0;
            m3uBtn.disabled = selCount === 0;
            jsonBtn.disabled = selCount === 0;

            selectAllChk.checked = files.length > 0 && selCount === files.length;
        }

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                peekSearchQuery = (e.target.value || '').trim();
                peekVisibleLimit = PEEK_BATCH_SIZE;
                renderPeekGrid();
            });
        }

        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                peekSortBy = e.target.value || 'default';
                renderPeekGrid();
            });
        }

        if (albumFilterSelect) {
            albumFilterSelect.addEventListener('change', (e) => {
                peekAlbumFilter = e.target.value || 'all';
                peekVisibleLimit = PEEK_BATCH_SIZE;
                renderPeekGrid();
            });
        }

        function renderPeekGrid() {
            gridEl.dataset.layout = currentLayout;
            const allFiles = album.files || [];
            allFiles.forEach((f) => {
                if (f.selected === undefined) f.selected = true;
            });
            const query = peekSearchQuery.toLowerCase();
            let filteredFiles = allFiles.filter((f) => {
                if (peekAlbumFilter !== 'all' && f.albumTitle !== peekAlbumFilter) return false;
                if (query) {
                    return (
                        (f.name || '').toLowerCase().includes(query) ||
                        (f.id || '').toLowerCase().includes(query) ||
                        (f.albumTitle || '').toLowerCase().includes(query)
                    );
                }
                return true;
            });

            if (peekSortBy !== 'default') {
                filteredFiles = [...filteredFiles].sort((a, b) => {
                    if (peekSortBy === 'dur_desc') return (b.dur || 0) - (a.dur || 0);
                    if (peekSortBy === 'dur_asc') return (a.dur || 0) - (b.dur || 0);
                    if (peekSortBy === 'size_desc') return (b.size || 0) - (a.size || 0);
                    if (peekSortBy === 'bitrate_desc') {
                        const brA = a.dur > 0 ? a.size / a.dur : 0;
                        const brB = b.dur > 0 ? b.size / b.dur : 0;
                        return brB - brA;
                    }
                    if (peekSortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
                    if (peekSortBy === 'album_asc') return (a.albumTitle || '').localeCompare(b.albumTitle || '');
                    return 0;
                });
            }

            if (!filteredFiles.length) {
                gridEl.innerHTML = `<div style="padding:40px;text-align:center;color:#8b949e">
                    ${query || peekAlbumFilter !== 'all' ? 'No matching videos found for this filter.' : 'No videos found in this album.'}
                </div>`;
                if (paginationContainer) paginationContainer.innerHTML = '';
                updatePeekToolbar();
                return;
            }

            const visibleFiles = filteredFiles.slice(0, peekVisibleLimit);

            if (currentLayout === 'list') {
                gridEl.innerHTML = visibleFiles.map((f, idx) => {
                    const qBadge = getSingleFileQuality(f);
                    return `
                    <div class="nexus-turbo-peek-item ${f.selected ? 'is-selected' : ''}" data-file-id="${escapeHtml(f.id)}" data-file-index="${idx}">
                        <input type="checkbox" class="nexus-turbo-peek-chk file-chk" ${f.selected ? 'checked' : ''} data-file-chk="${escapeHtml(f.id)}">
                        <div class="nexus-turbo-peek-poster" style="width:96px;height:54px;flex-shrink:0;cursor:pointer;" data-play-file="${escapeHtml(f.id)}">
                            <img src="${escapeHtml(f.thumb || '')}" alt="" onerror="this.style.display='none'">
                            <span class="nexus-turbo-peek-play-btn" style="width:28px;height:28px;font-size:12px;">▶</span>
                        </div>
                        <div class="nexus-turbo-peek-details">
                            <div class="nexus-turbo-peek-name" title="${escapeHtml(f.name)}">
                                ${escapeHtml(f.name)}
                                ${f.albumTitle ? `<span class="nexus-turbo-peek-album-badge" title="Album: ${escapeHtml(f.albumTitle)}">📁 ${escapeHtml(f.albumTitle)}</span>` : ''}
                            </div>
                            <div class="nexus-turbo-peek-sub">
                                <span>📦 ${formatBytes(f.size)}</span>
                                <span>⏱️ ${f.dur > 0 ? formatDuration(f.dur) : '—'}</span>
                                ${qBadge ? `<span class="nexus-turbo-peek-qbadge ${qBadge.badgeClass}">${qBadge.label}</span>` : ''}
                            </div>
                        </div>
                        <button type="button" class="nexus-turbo-btn-sub" data-play-file="${escapeHtml(f.id)}">▶ Play</button>
                        <button type="button" class="nexus-turbo-btn-sub" data-copy-single="${escapeHtml(f.id)}">📋 Link</button>
                        <a href="https://turbo.cr/v/${escapeHtml(f.id)}" target="_blank" class="nexus-turbo-peek-btn-open">↗</a>
                    </div>
                `;
                }).join('');
            } else {
                gridEl.innerHTML = visibleFiles.map((f, idx) => {
                    const qBadge = getSingleFileQuality(f);
                    return `
                    <div class="nexus-turbo-peek-card ${f.selected ? 'is-selected' : ''}" data-file-id="${escapeHtml(f.id)}" data-file-index="${idx}">
                        <div class="nexus-turbo-peek-poster">
                            <div class="nexus-turbo-peek-chk-wrap" title="Click to select / Shift+Click for range">
                                <input type="checkbox" class="nexus-turbo-peek-chk file-chk" ${f.selected ? 'checked' : ''} data-file-chk="${escapeHtml(f.id)}">
                            </div>
                            ${qBadge ? `<div class="nexus-turbo-peek-qbadge-overlay ${qBadge.badgeClass}" title="${qBadge.mbps.toFixed(1)} Mbps">${qBadge.label}</div>` : ''}
                            <img src="${escapeHtml(f.thumb || '')}" alt="" loading="lazy" onerror="this.src='https://turbo.cr/favicon.ico'">
                            <div class="nexus-turbo-peek-play-btn" data-play-file="${escapeHtml(f.id)}" title="Play ${escapeHtml(f.name)}">
                                ▶
                            </div>
                            <div class="nexus-turbo-peek-meta-badge">
                                <span>⏱️ ${f.dur > 0 ? formatDuration(f.dur) : '—'}</span>
                                <span>·</span>
                                <span>📦 ${formatBytes(f.size)}</span>
                            </div>
                        </div>
                        <div class="nexus-turbo-peek-card-body">
                            ${f.albumTitle ? `<div class="nexus-turbo-peek-card-album" title="Album: ${escapeHtml(f.albumTitle)}">📁 ${escapeHtml(f.albumTitle)}</div>` : ''}
                            <div class="nexus-turbo-peek-card-title" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
                            <div class="nexus-turbo-peek-card-actions">
                                <button type="button" class="nexus-turbo-btn-sub" data-play-file="${escapeHtml(f.id)}" title="Play video in popup player">
                                    ▶ Play
                                </button>
                                <button type="button" class="nexus-turbo-btn-sub" data-copy-single="${escapeHtml(f.id)}" title="Copy Watch URL">
                                    📋 Link
                                </button>
                                <a href="https://turbo.cr/v/${escapeHtml(f.id)}" target="_blank" class="nexus-turbo-peek-btn-open" title="Open on Turbo.cr">
                                    ↗
                                </a>
                            </div>
                        </div>
                    </div>
                `;
                }).join('');
            }

            if (paginationContainer) {
                if (filteredFiles.length > peekVisibleLimit) {
                    const remaining = filteredFiles.length - peekVisibleLimit;
                    const nextBatch = Math.min(PEEK_BATCH_SIZE, remaining);
                    paginationContainer.innerHTML = `
                        <div class="nexus-turbo-peek-pagination-bar">
                            <span style="font-size:12px;color:#8b949e;">
                                Showing <b>${visibleFiles.length}</b> of <b>${filteredFiles.length}</b> videos (total: ${allFiles.length})
                            </span>
                            <div style="display:flex;gap:8px;align-items:center;">
                                <button type="button" class="nexus-turbo-peek-load-more-btn" id="nexus-turbo-peek-load-more">
                                    ➕ Load next ${nextBatch} videos
                                </button>
                                <button type="button" class="nexus-turbo-peek-load-all-btn" id="nexus-turbo-peek-load-all">
                                    ⏩ Show all (${filteredFiles.length})
                                </button>
                            </div>
                        </div>
                    `;
                    paginationContainer.querySelector('#nexus-turbo-peek-load-more')?.addEventListener('click', () => {
                        peekVisibleLimit += PEEK_BATCH_SIZE;
                        renderPeekGrid();
                    });
                    paginationContainer.querySelector('#nexus-turbo-peek-load-all')?.addEventListener('click', () => {
                        peekVisibleLimit = filteredFiles.length;
                        renderPeekGrid();
                    });
                } else {
                    paginationContainer.innerHTML = '';
                }
            }

            updatePeekToolbar();
        }

        renderPeekGrid();

        // Layout Switchers
        modal.querySelectorAll('[data-peek-layout]').forEach((btn) => {
            btn.addEventListener('click', () => {
                currentLayout = btn.getAttribute('data-peek-layout');
                localStorage.setItem(STORAGE_PEEK_LAYOUT_KEY, currentLayout);
                modal.querySelectorAll('[data-peek-layout]').forEach(b => b.classList.remove('is-active'));
                btn.classList.add('is-active');
                renderPeekGrid();
            });
        });

        // Select All Checkbox
        selectAllChk.addEventListener('change', () => {
            const check = selectAllChk.checked;
            (album.files || []).forEach(f => { f.selected = check; });
            modal.querySelectorAll('.file-chk').forEach(c => { c.checked = check; });
            modal.querySelectorAll('.nexus-turbo-peek-card, .nexus-turbo-peek-item').forEach(el => {
                el.classList.toggle('is-selected', check);
            });
            updatePeekToolbar();
        });

        // Click Delegation on Grid (Checkboxes, Shift+Click, Play, Copy)
        gridEl.addEventListener('click', (e) => {
            const chkWrap = e.target.closest('.nexus-turbo-peek-chk-wrap');
            const chk = e.target.closest('[data-file-chk]') || chkWrap?.querySelector('[data-file-chk]');
            if (chk) {
                if (chkWrap && !e.target.closest('[data-file-chk]')) {
                    chk.checked = !chk.checked;
                }
                const fId = chk.getAttribute('data-file-chk');
                const card = chk.closest('.nexus-turbo-peek-card, .nexus-turbo-peek-item');
                const currIdx = parseInt(card?.dataset.fileIndex || '-1', 10);
                const file = (album.files || []).find(f => f.id === fId);

                if (file) {
                    file.selected = chk.checked;
                    if (card) card.classList.toggle('is-selected', file.selected);

                    // Shift+Click range selection
                    if (e.shiftKey && lastPeekIndex !== -1 && currIdx !== -1) {
                        const low = Math.min(lastPeekIndex, currIdx);
                        const high = Math.max(lastPeekIndex, currIdx);
                        const targetState = file.selected;
                        const visibleCards = gridEl.querySelectorAll('.nexus-turbo-peek-card, .nexus-turbo-peek-item');
                        visibleCards.forEach(c => {
                            const cIdx = parseInt(c.dataset.fileIndex || '-1', 10);
                            if (cIdx >= low && cIdx <= high) {
                                const cId = c.dataset.fileId;
                                const fObj = (album.files || []).find(x => x.id === cId);
                                if (fObj) fObj.selected = targetState;
                                const box = c.querySelector('.file-chk');
                                if (box) box.checked = targetState;
                                c.classList.toggle('is-selected', targetState);
                            }
                        });
                    }
                    lastPeekIndex = currIdx;
                    updatePeekToolbar();
                }
                return;
            }

            const playBtn = e.target.closest('[data-play-file]');
            if (playBtn) {
                const fId = playBtn.getAttribute('data-play-file');
                const file = (album.files || []).find(f => f.id === fId);
                const idx = (album.files || []).indexOf(file);
                openPlayer({ id: fId, title: file ? file.name : `Video ${fId}` }, idx, album.files);
                return;
            }

            const copyBtn = e.target.closest('[data-copy-single]');
            if (copyBtn) {
                const fId = copyBtn.getAttribute('data-copy-single');
                copyToClipboard(`https://turbo.cr/v/${fId}`, 'Watch URL copied!');
                return;
            }

            // Clicking on the thumbnail poster (outside play button & checkbox) toggles selection
            const poster = e.target.closest('.nexus-turbo-peek-poster');
            if (poster && !e.target.closest('[data-play-file]')) {
                const card = poster.closest('.nexus-turbo-peek-card');
                const box = card?.querySelector('.file-chk');
                if (box) {
                    box.checked = !box.checked;
                    const fId = box.getAttribute('data-file-chk');
                    const currIdx = parseInt(card.dataset.fileIndex || '-1', 10);
                    const file = (album.files || []).find(f => f.id === fId);
                    if (file) {
                        file.selected = box.checked;
                        card.classList.toggle('is-selected', file.selected);
                        if (e.shiftKey && lastPeekIndex !== -1 && currIdx !== -1) {
                            const low = Math.min(lastPeekIndex, currIdx);
                            const high = Math.max(lastPeekIndex, currIdx);
                            const targetState = file.selected;
                            const visibleCards = gridEl.querySelectorAll('.nexus-turbo-peek-card, .nexus-turbo-peek-item');
                            visibleCards.forEach(c => {
                                const cIdx = parseInt(c.dataset.fileIndex || '-1', 10);
                                if (cIdx >= low && cIdx <= high) {
                                    const cId = c.dataset.fileId;
                                    const fObj = (album.files || []).find(x => x.id === cId);
                                    if (fObj) fObj.selected = targetState;
                                    const b = c.querySelector('.file-chk');
                                    if (b) b.checked = targetState;
                                    c.classList.toggle('is-selected', targetState);
                                }
                            });
                        }
                        lastPeekIndex = currIdx;
                        updatePeekToolbar();
                    }
                }
            }
        });

        // Action Toolbar buttons
        splitBtn.addEventListener('click', () => {
            const selFiles = (album.files || []).filter(f => f.selected);
            openSplitScreen(selFiles);
        });

        copyWatchBtn.addEventListener('click', () => {
            const selFiles = (album.files || []).filter(f => f.selected);
            copyWatchUrlsFromFiles(selFiles);
        });

        copyDirectBtn.addEventListener('click', () => {
            const selFiles = (album.files || []).filter(f => f.selected);
            copyDirectUrlsFromFiles(selFiles);
        });

        m3uBtn.addEventListener('click', () => {
            const selFiles = (album.files || []).filter(f => f.selected);
            exportM3UPlaylist(selFiles, album.title);
        });

        jsonBtn.addEventListener('click', () => {
            const selFiles = (album.files || []).filter(f => f.selected);
            exportMetadataJSON(selFiles, { id: album.id, title: album.title, url: album.url });
        });

        modal.addEventListener('click', (e) => {
            if (e.target.hasAttribute('data-close-peek') || e.target.closest('[data-close-peek]') || e.target === modal) {
                modal.remove();
            }
        });

        document.body.appendChild(modal);
        } catch (err) {
            console.error('[Turbo Quick Peek Error]', err);
            toast(`Failed to open Quick Peek: ${err.message}`, true);
        }
    }

    let isScanningLibrary = false;
    function scanLibraryAlbums() {
        if (isScanningLibrary) return 0;
        isScanningLibrary = true;
        try {
            detectPaginationInfo();
            const cards = document.querySelectorAll('a.alb[href*="/a/"]');
            let added = 0;

        cards.forEach((card, index) => {
            const href = card.getAttribute('href') || '';
            const m = href.match(/\/a\/([a-zA-Z0-9_-]+)/);
            if (!m) return;
            const id = m[1];

            let album = libState.albums.get(id);
            if (!album) {
                const titleEl = card.querySelector('.truncate, [title], .font-medium') || card;
                const title = (titleEl.getAttribute('title') || titleEl.textContent || `Album ${id}`).trim();
                const fullUrl = href.startsWith('http') ? href : location.origin + href;

                album = {
                    id,
                    title,
                    url: fullUrl,
                    cardEl: card,
                    chkEl: null,
                    badgeEl: null,
                    peekBtn: null,
                    scanned: false,
                    files: [],
                    videoCount: 0,
                    totalBytes: 0,
                    avgBytes: 0,
                    avgDuration: 0,
                    selected: false,
                    visible: true,
                    index,
                };
                libState.albums.set(id, album);
                added++;
            } else {
                album.cardEl = card;
                album.index = index;
            }

            const strip = card.querySelector('.strip, .relative') || card;

            // 1. Checkbox Overlay (standard robust wrapper)
            let chkWrap = card.querySelector('.nexus-turbo-album-chk-wrap');
            let chk = card.querySelector('.nexus-turbo-album-chk');
            if (!chkWrap) {
                chkWrap = document.createElement('div');
                chkWrap.className = 'nexus-turbo-album-chk-wrap';
                chkWrap.setAttribute('role', 'checkbox');
                chkWrap.title = `Select/Deselect: ${album.title}`;
                chk = document.createElement('input');
                chk.type = 'checkbox';
                chk.className = 'nexus-turbo-album-chk';
                chk.title = `Select/Deselect: ${album.title}`;
                chk.tabIndex = -1;
                chkWrap.appendChild(chk);
                strip.appendChild(chkWrap);
            }
            album.chkEl = chk;
            chk.checked = !!album.selected;
            chkWrap.setAttribute('aria-checked', album.selected ? 'true' : 'false');
            card.classList.toggle('is-selected', !!album.selected);

            chkWrap.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
            };
            chk.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
            };

            // Selection toggle helper
            const toggleAlbumSelection = (wantState, isShift = false) => {
                const target = (typeof wantState === 'boolean') ? wantState : !album.selected;
                album.selected = target;
                if (album.chkEl) album.chkEl.checked = target;
                if (chkWrap) chkWrap.setAttribute('aria-checked', target ? 'true' : 'false');
                card.classList.toggle('is-selected', target);

                if (isShift && libState.lastSelectedAlbumIndex !== -1) {
                    const allAlbums = Array.from(libState.albums.values());
                    const low = Math.min(libState.lastSelectedAlbumIndex, album.index);
                    const high = Math.max(libState.lastSelectedAlbumIndex, album.index);
                    for (let i = low; i <= high; i++) {
                        const a = allAlbums[i];
                        if (a && a.visible !== false) {
                            a.selected = target;
                            if (a.chkEl) a.chkEl.checked = target;
                            if (a.cardEl) {
                                a.cardEl.classList.toggle('is-selected', target);
                                const wrap = a.cardEl.querySelector('.nexus-turbo-album-chk-wrap');
                                if (wrap) wrap.setAttribute('aria-checked', target ? 'true' : 'false');
                            }
                        }
                    }
                }
                libState.lastSelectedAlbumIndex = album.index;
                updateLibraryToolbar();
            };

            // 2. Quick Peek Button
            let peek = card.querySelector('.nexus-turbo-badge-peek');
            if (!peek) {
                peek = document.createElement('div');
                peek.className = 'nexus-turbo-badge-peek';
                peek.title = 'Quick peek videos inside album';
                peek.setAttribute('data-turbo', 'false');
                peek.setAttribute('role', 'button');
                peek.innerHTML = '👁️';
                strip.appendChild(peek);
            }
            album.peekBtn = peek;

            const onPeekClick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                openAlbumQuickPeek(album);
            };
            peek.onclick = onPeekClick;
            peek.onmousedown = (e) => e.stopPropagation();
            peek.onpointerdown = (e) => e.stopPropagation();

            // 3. Metadata Badge
            let badge = card.querySelector('.nexus-turbo-album-badge');
            if (!badge) {
                badge = document.createElement('div');
                badge.className = 'nexus-turbo-album-badge';
                badge.innerHTML = `<span class="badge-stat">⏳ Pending scan...</span>`;
                strip.appendChild(badge);
            }
            album.badgeEl = badge;

            if (album.scanned && !badge.classList.contains('badge-done')) {
                applyAlbumData(album, album);
            }

            // 4. Card-Level Capture Listener:
            // Intercepts clicks on custom overlays & thumbnail strip to prevent unwanted navigation
            if (!card.dataset.nexusCardBound) {
                card.dataset.nexusCardBound = '1';
                card.addEventListener('click', (e) => {
                    // Quick peek eye button clicked
                    if (e.target.closest('.nexus-turbo-badge-peek')) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        openAlbumQuickPeek(album);
                        return;
                    }
                    // Checkbox or Checkbox wrapper clicked -> Directly toggle selection and prevent <a> navigation
                    if (e.target.closest('.nexus-turbo-album-chk-wrap, .nexus-turbo-album-chk')) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        toggleAlbumSelection(!album.selected, e.shiftKey);
                        return;
                    }
                    // Thumbnail strip or badge clicked -> Select / Deselect album!
                    if (e.target.closest('.strip, .thumb, .nexus-turbo-album-badge')) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        toggleAlbumSelection(!album.selected, e.shiftKey);
                        return;
                    }
                    // Clicking title text in .p-2.5 opens album as normal
                }, true);
            }

            // Restore cached metadata
            try {
                const cached = sessionStorage.getItem(`nexus_turbo_alb_${id}`);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (parsed && Array.isArray(parsed.files)) {
                        applyAlbumData(album, parsed);
                    }
                }
            } catch {}

            vaultGetAlbum(id).then((saved) => {
                if (saved && Array.isArray(saved.files) && saved.files.length) {
                    applyAlbumData(album, saved);
                    updateLibraryToolbar();
                    updateOnPageShowingText();
                }
            });
        });

        if (added > 0) {
            updateLibraryToolbar();
            updateOnPageShowingText();
        }
        return added;
        } finally {
            isScanningLibrary = false;
        }
    }

    async function fetchAlbumMetadata(album) {
        if (album.scanned && album.files.length > 0) return album;

        if (album.badgeEl) {
            album.badgeEl.className = 'nexus-turbo-album-badge badge-scanning';
            album.badgeEl.innerHTML = `<span class="badge-stat">🔍 Scanning metadata...</span>`;
        }

        try {
            const resp = await fetch(album.url, { credentials: 'same-origin' });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const htmlText = await resp.text();
            const files = parseFilesFromHtml(htmlText);

            applyAlbumData(album, { files });

            try {
                sessionStorage.setItem(`nexus_turbo_alb_${album.id}`, JSON.stringify({ files }));
            } catch {}

            const albumRecord = {
                id: album.id,
                title: album.title,
                url: album.url,
                scannedAt: Date.now(),
                files: files,
                videoCount: album.videoCount,
                totalBytes: album.totalBytes,
                avgBytes: album.avgBytes,
                avgDuration: album.avgDuration,
                quality: album.quality,
            };
            vaultSaveAlbum(albumRecord);
            updateHistoryCounter();

            return album;
        } catch (err) {
            if (album.badgeEl) {
                album.badgeEl.className = 'nexus-turbo-album-badge';
                album.badgeEl.innerHTML = `<span class="badge-stat" style="color:#f85149">⚠️ Scan failed</span>`;
            }
            return album;
        }
    }

    async function runLibraryScanQueue() {
        if (!libState.scanning) return;

        while (libState.scanQueue.length > 0 && libState.scanActive < libState.scanMaxConcurrency) {
            const album = libState.scanQueue.shift();
            libState.scanActive++;
            updateLibraryToolbar();

            fetchAlbumMetadata(album).finally(() => {
                applyLibraryFilterAndSort();
                libState.scanActive--;
                updateLibraryToolbar();
                if (libState.scanQueue.length > 0 && libState.scanning) {
                    runLibraryScanQueue();
                } else if (libState.scanActive === 0 && libState.scanQueue.length === 0) {
                    libState.scanning = false;
                    toast(`✅ Scan complete! Scanned ${Array.from(libState.albums.values()).filter(a => a.scanned).length} albums.`);
                    updateLibraryToolbar();
                }
            });
        }
    }

    function startLibraryScan() {
        const unscanned = Array.from(libState.albums.values()).filter(a => !a.scanned);
        if (unscanned.length === 0) {
            toast('All visible albums are already scanned.');
            return;
        }
        libState.scanning = true;
        libState.scanQueue = unscanned;
        toast(`🔍 Scanning ${unscanned.length} albums in background...`);
        runLibraryScanQueue();
    }

    function stopLibraryScan() {
        libState.scanning = false;
        libState.scanQueue = [];
        toast('Scanning paused.');
        updateLibraryToolbar();
    }

    async function loadNextPage(numPages = 1) {
        if (libState.loadingPage) return;
        libState.loadingPage = true;
        updateLibraryToolbar();

        let addedTotal = 0;

        for (let i = 0; i < numPages; i++) {
            const nextPage = (libState.highestPage || 1) + 1;
            if (nextPage > libState.maxPages) {
                toast(`Reached the last page of Turbo library (${libState.maxPages}).`);
                break;
            }

            toast(`⏳ Loading page ${nextPage} of ${libState.maxPages}...`);
            try {
                const targetUrl = new URL(location.href);
                targetUrl.searchParams.set('page', nextPage);

                const resp = await fetch(targetUrl.toString(), { credentials: 'same-origin' });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const htmlText = await resp.text();

                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlText, 'text/html');
                const newCards = doc.querySelectorAll('#grid a.alb, a.alb[href*="/a/"]');

                if (!newCards.length) {
                    toast(`No albums found on page ${nextPage}.`);
                    break;
                }

                const container = document.getElementById('grid')
                    || document.querySelector('.grid')
                    || document.querySelector('a.alb')?.parentElement;

                if (container) {
                    newCards.forEach((c) => {
                        const href = c.getAttribute('href') || '';
                        if (href && container.querySelector(`a.alb[href="${href}"]`)) return;
                        const importedCard = document.importNode(c, true);
                        container.appendChild(importedCard);
                    });
                }

                libState.highestPage = nextPage;
                libState.currentPage = nextPage;
                libState.loadedPages.add(nextPage);

                const fetchedText = doc.body.innerText || '';
                const fm = fetchedText.match(/Page\s+(\d+)\s+of\s+(\d+)/i);
                if (fm && fm[2]) {
                    libState.maxPages = Math.max(libState.maxPages, parseInt(fm[2], 10) || 40);
                }

                const addedThisPage = scanLibraryAlbums();
                addedTotal += (addedThisPage || 0);
                updateOnPageShowingText();
                applyLibraryFilterAndSort();
                toast(`➕ Page ${nextPage} added! (+${addedThisPage || newCards.length} albums, total ${libState.albums.size})`);

                if (libState.autoScanNewPages) {
                    startLibraryScan();
                }
            } catch (err) {
                toast(`Error loading page ${nextPage}: ${err.message}`, true);
                break;
            }
        }

        libState.loadingPage = false;
        applyLibraryFilterAndSort();
    }

    function selectFirstNAlbums(count = 20) {
        const visibleAlbums = Array.from(libState.albums.values()).filter(a => a.visible !== false);
        let selectedCount = 0;
        visibleAlbums.forEach((album) => {
            const want = selectedCount < count;
            album.selected = want;
            if (album.chkEl) album.chkEl.checked = want;
            if (album.cardEl) {
                album.cardEl.classList.toggle('is-selected', want);
                const wrap = album.cardEl.querySelector('.nexus-turbo-album-chk-wrap');
                if (wrap) wrap.setAttribute('aria-checked', want ? 'true' : 'false');
            }
            if (want) selectedCount++;
        });
        if (libState.filterOnlySelected) {
            applyLibraryFilterAndSort();
        } else {
            updateLibraryToolbar();
        }
        toast(`Selected first ${selectedCount} visible albums.`);
    }

    function selectAllAlbums(select = true) {
        const targetAlbums = Array.from(libState.albums.values()).filter(a => a.visible !== false);
        targetAlbums.forEach((album) => {
            album.selected = select;
            if (album.chkEl) album.chkEl.checked = select;
            if (album.cardEl) {
                album.cardEl.classList.toggle('is-selected', select);
                const wrap = album.cardEl.querySelector('.nexus-turbo-album-chk-wrap');
                if (wrap) wrap.setAttribute('aria-checked', select ? 'true' : 'false');
            }
        });
        if (libState.filterOnlySelected) {
            applyLibraryFilterAndSort();
        } else {
            updateLibraryToolbar();
        }
        toast(select ? `Selected ${targetAlbums.length} visible albums.` : 'Selection cleared.');
    }

    async function ensureSelectedAlbumsScanned(selected) {
        const unscanned = selected.filter(a => !a.scanned);
        if (unscanned.length > 0) {
            toast(`⏳ Fetching missing metadata for ${unscanned.length} albums...`);
            await Promise.allSettled(unscanned.map(a => fetchAlbumMetadata(a)));
        }
    }

    function getAllFilesFromSelectedAlbums() {
        const selected = Array.from(libState.albums.values()).filter(a => a.selected);
        const files = [];
        selected.forEach((album) => {
            (album.files || []).forEach((f) => {
                files.push({ ...f, albumTitle: album.title });
            });
        });
        return { selected, files };
    }

    async function openMergedAlbumsViewer() {
        const { selected } = getAllFilesFromSelectedAlbums();
        if (!selected.length) {
            toast('⚠️ Please select at least 1 album first!', true);
            return;
        }

        await ensureSelectedAlbumsScanned(selected);
        const { files } = getAllFilesFromSelectedAlbums();

        if (!files.length) {
            toast('⚠️ No video files found in selected albums.', true);
            return;
        }

        const totalBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);

        const mergedAlbum = {
            id: 'merged_' + Date.now(),
            isMerged: true,
            title: `Merged Collection (${selected.length} albums · ${files.length} videos)`,
            url: window.location.href,
            videoCount: files.length,
            totalBytes: totalBytes,
            avgBytes: Math.round(totalBytes / files.length),
            avgDuration: 0,
            files: files.map(f => ({ ...f, selected: true })),
            scanned: true,
            selected: true,
        };

        openAlbumQuickPeek(mergedAlbum);
    }

    function updateLibraryToolbar() {
        const toolbar = document.getElementById(TOOLBAR_ID);
        if (!toolbar || !isLibraryPage()) return;

        const totalAlbums = libState.albums.size;
        const scannedAlbums = Array.from(libState.albums.values()).filter(a => a.scanned).length;
        const selectedAlbums = Array.from(libState.albums.values()).filter(a => a.selected);
        const selectedCount = selectedAlbums.length;

        const selectedVideos = selectedAlbums.reduce((sum, a) => sum + (a.videoCount || 0), 0);
        const selectedBytes = selectedAlbums.reduce((sum, a) => sum + (a.totalBytes || 0), 0);

        const countEl = toolbar.querySelector('.nexus-turbo-count');
        if (countEl) {
            countEl.innerHTML = `
                <b>${selectedCount}</b> / ${totalAlbums} albums
                ${selectedCount > 0 ? `· <b>${selectedVideos}</b> vids (${formatBytes(selectedBytes)})` : ''}
            `;
        }

        const visibleAlbums = Array.from(libState.albums.values()).filter(a => a.visible !== false);
        const visibleCount = visibleAlbums.length;

        const statsEl = toolbar.querySelector('#nexus-turbo-lib-stats');
        if (statsEl) {
            const pageRange = libState.highestPage > 1 ? `1–${libState.highestPage}` : `${libState.highestPage || 1}`;
            statsEl.innerHTML = `
                <span>Pages: <b>${pageRange}</b> / ${libState.maxPages}</span>
                <span>Visible: <b>${visibleCount}</b> / ${totalAlbums}</span>
            `;
        }

        const scanBtn = toolbar.querySelector('#nexus-turbo-scan-btn');
        if (scanBtn) {
            scanBtn.innerHTML = libState.scanning
                ? `⏸️ Pause (${libState.scanQueue.length} in queue)`
                : `🔍 Scan Albums (${totalAlbums - scannedAlbums})`;
            scanBtn.style.background = libState.scanning ? 'rgba(210, 153, 34, 0.25)' : '';
        }

        const loadNextBtn = toolbar.querySelector('#nexus-turbo-load-next-btn');
        if (loadNextBtn) {
            loadNextBtn.disabled = libState.loadingPage;
            loadNextBtn.innerHTML = libState.loadingPage ? '⏳ Loading...' : '➕ Next Page';
        }

        const fillEl = toolbar.querySelector('.nexus-turbo-progress-fill');
        if (fillEl) {
            const pct = totalAlbums > 0 ? Math.round((scannedAlbums / totalAlbums) * 100) : 0;
            fillEl.style.width = `${pct}%`;
        }

        const copyWatchBtn = toolbar.querySelector('#nexus-turbo-btn-copy-watch');
        if (copyWatchBtn) copyWatchBtn.disabled = selectedCount === 0;

        const copyDirectBtn = toolbar.querySelector('#nexus-turbo-btn-copy-direct');
        if (copyDirectBtn) copyDirectBtn.disabled = selectedCount === 0;

        const m3uBtn = toolbar.querySelector('#nexus-turbo-btn-m3u');
        if (m3uBtn) m3uBtn.disabled = selectedCount === 0;

        const jsonBtn = toolbar.querySelector('#nexus-turbo-btn-json');
        if (jsonBtn) jsonBtn.disabled = selectedCount === 0;

        const splitBtn = toolbar.querySelector('#nexus-turbo-btn-split');
        if (splitBtn) splitBtn.disabled = selectedCount === 0;

        const mergedBtn = toolbar.querySelector('#nexus-turbo-btn-merged');
        if (mergedBtn) mergedBtn.disabled = selectedCount === 0;
        const mergedCountEl = toolbar.querySelector('#nexus-turbo-merged-count');
        if (mergedCountEl) mergedCountEl.textContent = selectedCount;

        updateBubbleBadge();
    }

    function ensureLibraryToolbar() {
        if (!isLibraryPage()) return;
        let el = document.getElementById(TOOLBAR_ID);
        if (el) return;

        el = document.createElement('div');
        el.id = TOOLBAR_ID;
        el.innerHTML = `
            <div class="nexus-turbo-header" id="nexus-turbo-header">
                <div class="nexus-turbo-brand">
                    <span>⚡ <a href="https://github.com/ervss/turbo-cr-workspace" target="_blank">TURBO WORKSPACE</a> <small style="font-size:10px;color:#8b949e;font-weight:normal;">by ervss</small></span>
                </div>
                <div class="nexus-turbo-header-actions">
                    <button class="nexus-turbo-min-btn" id="nexus-turbo-help-btn" title="Shortcuts & Help (?)">?</button>
                    <button class="nexus-turbo-min-btn" id="nexus-turbo-min-btn" title="Minimize">—</button>
                </div>
            </div>

            <div class="nexus-turbo-info">
                <span class="nexus-turbo-count">0 / 0 albums</span>
                <span style="font-size:11px;color:#58a6ff;">turbo.cr/library</span>
            </div>

            <div class="nexus-turbo-progress-bar">
                <div class="nexus-turbo-progress-fill"></div>
            </div>

            <div class="nexus-turbo-lib-stats" id="nexus-turbo-lib-stats">
                <span>Pages: 1 / 40</span>
                <span>Visible: 0 / 0</span>
            </div>

            <!-- Filter & Sort Panel -->
            <div class="nexus-turbo-filter-box">
                <input type="search" class="nexus-turbo-search-input" id="nexus-turbo-search" placeholder="🔍 Search album title or ID... (Press /)">
                
                <div class="nexus-turbo-filter-grid">
                    <div class="nexus-turbo-filter-field">
                        <label class="nexus-turbo-filter-label" for="nexus-turbo-sort">🔃 Sort Order</label>
                        <select class="nexus-turbo-select" id="nexus-turbo-sort">
                            <option value="default">Default order</option>
                            <option value="size_desc">📦 Largest Size (GB)</option>
                            <option value="vids_desc">🎬 Most Videos</option>
                            <option value="dur_desc">⏱️ Longest Avg Duration</option>
                            <option value="avg_desc">📊 Highest Avg Size</option>
                            <option value="selected_first">⚡ Selected First</option>
                            <option value="name_asc">🔤 Name (A–Z)</option>
                        </select>
                    </div>

                    <div class="nexus-turbo-filter-field">
                        <label class="nexus-turbo-filter-label" for="nexus-turbo-filter-quality">💎 Quality Tier</label>
                        <select class="nexus-turbo-select" id="nexus-turbo-filter-quality">
                            <option value="all">Quality: All</option>
                            <option value="4k">💎 4K UHD (≥12M)</option>
                            <option value="1080p">⭐ 1080p+ (FHD & 4K)</option>
                            <option value="720p">⚡ 720p+ (HD & up)</option>
                            <option value="sd">📁 480p SD</option>
                        </select>
                    </div>

                    <div class="nexus-turbo-filter-field">
                        <label class="nexus-turbo-filter-label" for="nexus-turbo-filter-vids">🎬 Min Videos</label>
                        <select class="nexus-turbo-select" id="nexus-turbo-filter-vids">
                            <option value="0">Videos: All</option>
                            <option value="2">Videos: ≥ 2</option>
                            <option value="5">Videos: ≥ 5</option>
                            <option value="10">Videos: ≥ 10</option>
                            <option value="20">Videos: ≥ 20</option>
                            <option value="50">Videos: ≥ 50</option>
                        </select>
                    </div>

                    <div class="nexus-turbo-filter-field">
                        <label class="nexus-turbo-filter-label" for="nexus-turbo-filter-size">📦 Min Size</label>
                        <select class="nexus-turbo-select" id="nexus-turbo-filter-size">
                            <option value="0">Size: All</option>
                            <option value="10">Size: ≥ 10 MB</option>
                            <option value="50">Size: ≥ 50 MB</option>
                            <option value="200">Size: ≥ 200 MB</option>
                            <option value="500">Size: ≥ 500 MB</option>
                            <option value="1000">Size: ≥ 1 GB</option>
                            <option value="2000">Size: ≥ 2 GB</option>
                            <option value="5000">Size: ≥ 5 GB</option>
                        </select>
                    </div>
                </div>

                <div class="nexus-turbo-toggles">
                    <button type="button" class="nexus-turbo-toggle-btn" id="nexus-turbo-toggle-hide-unselected" title="Show only selected albums">
                        👁️ Selected Only
                    </button>
                    <button type="button" class="nexus-turbo-toggle-btn" id="nexus-turbo-toggle-only-scanned" title="Hide unscanned albums">
                        🔍 Scanned Only
                    </button>
                    <button type="button" class="nexus-turbo-toggle-btn" id="nexus-turbo-toggle-autoscan" title="Automatically scan newly loaded pages">
                        ⚡ Auto-Scan
                    </button>
                    <button type="button" class="nexus-turbo-toggle-btn" id="nexus-turbo-toggle-infinite" title="Automatically load next page on scroll">
                        ♾️ Infinite Scroll
                    </button>
                </div>
            </div>

            <div class="nexus-turbo-lib-row">
                <div class="nexus-turbo-btn-group">
                    <button class="nexus-turbo-btn-sub" id="nexus-turbo-select-20" style="flex:1" title="Select TOP 20 visible albums">
                        TOP 20
                    </button>
                    <button class="nexus-turbo-btn-sub" id="nexus-turbo-select-all" style="flex:1" title="Select all visible albums">
                        Visible
                    </button>
                    <button class="nexus-turbo-btn-sub" id="nexus-turbo-select-none" style="flex:1" title="Clear selection">
                        Clear
                    </button>
                </div>

                <div class="nexus-turbo-btn-group">
                    <button class="nexus-turbo-btn-sub" id="nexus-turbo-scan-btn" style="flex:2" title="Scan album metadata in background">
                        🔍 Scan Albums
                    </button>
                    <button class="nexus-turbo-btn-sub" id="nexus-turbo-load-next-btn" style="flex:2" title="Append next page into grid">
                        ➕ Next Page
                    </button>
                    <button class="nexus-turbo-btn-sub" id="nexus-turbo-load-5-btn" style="flex:1" title="Load 5 pages at once">
                        ⏩ +5
                    </button>
                </div>

                <div class="nexus-turbo-btn-group" style="margin-top:4px;">
                    <button class="nexus-turbo-btn-main" id="nexus-turbo-btn-merged" disabled style="flex:1.4;background:linear-gradient(135deg, #1f6feb 0%, #238636 100%);color:#fff;font-weight:700;padding:7px 10px;border-radius:6px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;gap:6px;border:1px solid rgba(255,255,255,0.2);box-shadow:0 2px 10px rgba(31,111,235,0.4);" title="Open all videos from selected albums together in one interactive gallery">
                        📂 Merged Gallery (<span id="nexus-turbo-merged-count">0</span>)
                    </button>
                    <button class="nexus-turbo-btn-split" id="nexus-turbo-btn-split" disabled style="flex:1;" title="Open selected albums in Split-Screen player">
                        📺 Split-Screen
                    </button>
                </div>

                <div class="nexus-turbo-btn-group" style="margin-top:2px;">
                    <button class="nexus-turbo-btn-sub" id="nexus-turbo-history-btn" style="flex:1" title="Browse offline IndexedDB history vault">
                        📜 History (<span id="nexus-turbo-history-count">0</span>)
                    </button>
                </div>

                <!-- Export & Copy Actions -->
                <div class="nexus-turbo-btn-group" style="margin-top:2px;">
                    <button class="nexus-turbo-btn-copy" id="nexus-turbo-btn-copy-watch" style="flex:1" disabled title="Copy Watch URLs for selected albums">
                        📋 Copy Links
                    </button>
                    <button class="nexus-turbo-btn-copy" id="nexus-turbo-btn-copy-direct" style="flex:1" disabled title="Resolve and copy direct CDN stream links">
                        🔗 Direct Streams
                    </button>
                    <button class="nexus-turbo-btn-export" id="nexus-turbo-btn-m3u" style="flex:1" disabled title="Export .M3U8 playlist for VLC / MPV / PotPlayer">
                        🎵 .M3U
                    </button>
                    <button class="nexus-turbo-btn-export" id="nexus-turbo-btn-json" style="flex:1" disabled title="Export metadata to JSON file">
                        📄 JSON
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(el);

        if (state.position) applyPosition(el, state.position);
        makeDraggable(el, el.querySelector('#nexus-turbo-header'), (x, y) => savePosition(x, y));

        el.querySelector('#nexus-turbo-help-btn').addEventListener('click', openHelpModal);
        el.querySelector('#nexus-turbo-min-btn').addEventListener('click', () => setMinimized(true));
        el.querySelector('#nexus-turbo-select-20').addEventListener('click', () => selectFirstNAlbums(20));
        el.querySelector('#nexus-turbo-select-all').addEventListener('click', () => selectAllAlbums(true));
        el.querySelector('#nexus-turbo-select-none').addEventListener('click', () => selectAllAlbums(false));
        el.querySelector('#nexus-turbo-history-btn').addEventListener('click', openLibraryHistoryModal);

        el.querySelector('#nexus-turbo-filter-quality').addEventListener('change', (e) => {
            libState.filterQuality = e.target.value;
            applyLibraryFilterAndSort();
        });

        const searchInput = el.querySelector('#nexus-turbo-search');
        searchInput.addEventListener('input', () => {
            libState.searchQuery = searchInput.value;
            applyLibraryFilterAndSort();
        });

        const sortSelect = el.querySelector('#nexus-turbo-sort');
        sortSelect.addEventListener('change', () => {
            libState.sortBy = sortSelect.value;
            applyLibraryFilterAndSort();
        });

        const vidsFilter = el.querySelector('#nexus-turbo-filter-vids');
        vidsFilter.addEventListener('change', () => {
            libState.filterMinVideos = parseInt(vidsFilter.value, 10) || 0;
            applyLibraryFilterAndSort();
        });

        const sizeFilter = el.querySelector('#nexus-turbo-filter-size');
        sizeFilter.addEventListener('change', () => {
            libState.filterMinSizeMB = parseInt(sizeFilter.value, 10) || 0;
            applyLibraryFilterAndSort();
        });

        const hideUnselectedBtn = el.querySelector('#nexus-turbo-toggle-hide-unselected');
        hideUnselectedBtn.addEventListener('click', () => {
            libState.filterOnlySelected = !libState.filterOnlySelected;
            hideUnselectedBtn.classList.toggle('is-active', libState.filterOnlySelected);
            applyLibraryFilterAndSort();
            toast(libState.filterOnlySelected ? '👁️ Showing only selected albums' : 'Showing all albums');
        });

        const onlyScannedBtn = el.querySelector('#nexus-turbo-toggle-only-scanned');
        onlyScannedBtn.addEventListener('click', () => {
            libState.filterOnlyScanned = !libState.filterOnlyScanned;
            onlyScannedBtn.classList.toggle('is-active', libState.filterOnlyScanned);
            applyLibraryFilterAndSort();
        });

        const autoScanBtn = el.querySelector('#nexus-turbo-toggle-autoscan');
        autoScanBtn.addEventListener('click', () => {
            libState.autoScanNewPages = !libState.autoScanNewPages;
            autoScanBtn.classList.toggle('is-active', libState.autoScanNewPages);
            toast(libState.autoScanNewPages ? '⚡ Auto-Scan enabled' : 'Auto-Scan disabled');
        });

        const infiniteBtn = el.querySelector('#nexus-turbo-toggle-infinite');
        if (libState.infiniteScroll) infiniteBtn.classList.add('is-active');
        infiniteBtn.addEventListener('click', () => {
            libState.infiniteScroll = !libState.infiniteScroll;
            localStorage.setItem(STORAGE_INFINITE_KEY, String(libState.infiniteScroll));
            infiniteBtn.classList.toggle('is-active', libState.infiniteScroll);
            toast(libState.infiniteScroll ? '♾️ Infinite Scroll enabled' : 'Infinite Scroll disabled');
        });

        el.querySelector('#nexus-turbo-scan-btn').addEventListener('click', () => {
            if (libState.scanning) stopLibraryScan();
            else startLibraryScan();
        });

        el.querySelector('#nexus-turbo-load-next-btn').addEventListener('click', () => loadNextPage(1));
        el.querySelector('#nexus-turbo-load-5-btn').addEventListener('click', () => loadNextPage(5));

        // Export Actions
        el.querySelector('#nexus-turbo-btn-merged')?.addEventListener('click', () => {
            openMergedAlbumsViewer();
        });

        el.querySelector('#nexus-turbo-btn-split').addEventListener('click', async () => {
            const { selected, files } = getAllFilesFromSelectedAlbums();
            await ensureSelectedAlbumsScanned(selected);
            const refetched = getAllFilesFromSelectedAlbums().files;
            openSplitScreen(refetched);
        });

        el.querySelector('#nexus-turbo-btn-copy-watch').addEventListener('click', async () => {
            const { selected } = getAllFilesFromSelectedAlbums();
            await ensureSelectedAlbumsScanned(selected);
            const { files } = getAllFilesFromSelectedAlbums();
            copyWatchUrlsFromFiles(files);
        });

        el.querySelector('#nexus-turbo-btn-copy-direct').addEventListener('click', async () => {
            const { selected } = getAllFilesFromSelectedAlbums();
            await ensureSelectedAlbumsScanned(selected);
            const { files } = getAllFilesFromSelectedAlbums();
            copyDirectUrlsFromFiles(files);
        });

        el.querySelector('#nexus-turbo-btn-m3u').addEventListener('click', async () => {
            const { selected } = getAllFilesFromSelectedAlbums();
            await ensureSelectedAlbumsScanned(selected);
            const { files } = getAllFilesFromSelectedAlbums();
            exportM3UPlaylist(files, `Turbo_Library_${selected.length}_Albums`);
        });

        el.querySelector('#nexus-turbo-btn-json').addEventListener('click', async () => {
            const { selected } = getAllFilesFromSelectedAlbums();
            await ensureSelectedAlbumsScanned(selected);
            const { files } = getAllFilesFromSelectedAlbums();
            exportMetadataJSON(files, { albumsCount: selected.length });
        });

        setMinimized(state.minimized);
        updateLibraryToolbar();
        updateHistoryCounter();

        // Infinite scroll event
        window.addEventListener('scroll', () => {
            if (!libState.infiniteScroll || libState.loadingPage) return;
            if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 600) {
                loadNextPage(1);
            }
        }, { passive: true });
    }

    // ── 15. History Vault Modal ────────────────────────────────────
    async function updateHistoryCounter() {
        try {
            const albums = await vaultGetAllAlbums();
            const el = document.getElementById('nexus-turbo-history-count');
            if (el) el.textContent = albums.length;
        } catch {}
    }

    async function openLibraryHistoryModal() {
        const old = document.getElementById(HISTORY_ID);
        if (old) old.remove();

        toast('⏳ Loading scanned albums from offline vault...');
        const albums = await vaultGetAllAlbums();
        albums.sort((a, b) => (b.scannedAt || 0) - (a.scannedAt || 0));

        let searchQuery = '';

        const modal = document.createElement('div');
        modal.id = HISTORY_ID;
        modal.innerHTML = `
            <div class="nexus-turbo-history-backdrop" data-close-history></div>
            <div class="nexus-turbo-history-dialog" role="dialog" aria-modal="true">
                <div class="nexus-turbo-history-header">
                    <div>
                        <h3 style="margin:0;font-size:16px;display:flex;align-items:center;gap:8px;">
                            📜 Offline History Vault 
                            <span style="font-size:12px;color:#8b949e;font-weight:normal;">(${albums.length} albums saved in browser IndexedDB)</span>
                        </h3>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                        <input type="text" id="nexus-turbo-history-search" class="nexus-turbo-peek-search-input" style="width:220px;" placeholder="🔍 Search in history...">
                        <button type="button" class="nexus-turbo-btn-export" id="nexus-turbo-history-export" title="Export entire vault to JSON file">💾 Export Vault</button>
                        <button type="button" class="nexus-turbo-btn-sub" id="nexus-turbo-history-import" title="Import JSON backup into vault">📂 Import Vault</button>
                        <input type="file" id="nexus-turbo-history-file-picker" accept=".json" style="display:none;">
                        <button type="button" class="nexus-turbo-btn-sub" id="nexus-turbo-history-clear" style="color:#f85149;" title="Clear all history from browser">🗑️ Clear</button>
                        <button type="button" class="nexus-turbo-min-btn" data-close-history style="font-size:18px;">✕</button>
                    </div>
                </div>
                <div class="nexus-turbo-history-body" id="nexus-turbo-history-list"></div>
            </div>
        `;

        document.body.appendChild(modal);

        const listEl = modal.querySelector('#nexus-turbo-history-list');
        const searchInput = modal.querySelector('#nexus-turbo-history-search');
        const filePicker = modal.querySelector('#nexus-turbo-history-file-picker');

        function renderHistoryList() {
            const q = searchQuery.trim().toLowerCase();
            const filtered = q
                ? albums.filter(a => (a.title || '').toLowerCase().includes(q) || (a.id || '').toLowerCase().includes(q))
                : albums;

            if (!filtered.length) {
                listEl.innerHTML = '<div style="padding:40px;text-align:center;color:#8b949e;">No matching albums found in vault history.</div>';
                return;
            }

            listEl.innerHTML = filtered.map(a => {
                const dateStr = a.scannedAt ? new Date(a.scannedAt).toLocaleDateString() + ' ' + new Date(a.scannedAt).toLocaleTimeString() : 'Unknown';
                const qData = a.quality || calculateAlbumQuality(a.files || []);
                return `
                    <div class="nexus-turbo-history-item" data-album-id="${escapeHtml(a.id)}">
                        <div style="display:flex;flex-direction:column;gap:3px;flex:1;min-width:0;">
                            <div style="font-size:13.5px;font-weight:600;color:#e6edf3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(a.title)}">
                                📁 ${escapeHtml(a.title)}
                            </div>
                            <div style="font-size:11.5px;color:#8b949e;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                                <span>🎬 <b>${a.videoCount || (a.files || []).length} vids</b></span>
                                <span>📦 <b>${formatBytes(a.totalBytes || 0)}</b></span>
                                <span class="badge-quality ${qData.badgeClass}">${qData.icon} ${qData.label} (${(qData.bitrateMbps || 0).toFixed(1)}M)</span>
                                <span>🕒 ${dateStr}</span>
                            </div>
                        </div>
                        <div style="display:flex;gap:6px;align-items:center;">
                            <button type="button" class="nexus-turbo-btn-sub" data-history-peek="${escapeHtml(a.id)}" title="Quick Peek album">👁️ Peek</button>
                            <button type="button" class="nexus-turbo-btn-sub" data-history-copy="${escapeHtml(a.id)}" title="Copy Watch URLs">📋 Copy</button>
                            <button type="button" class="nexus-turbo-btn-sub" data-history-m3u="${escapeHtml(a.id)}" title="Export .M3U8 playlist">🎵 M3U</button>
                            <a href="${escapeHtml(a.url || ('https://turbo.cr/a/' + a.id))}" target="_blank" class="nexus-turbo-btn-sub" style="text-decoration:none;" title="Open Album page">↗ Open</a>
                            <button type="button" class="nexus-turbo-btn-sub" data-history-del="${escapeHtml(a.id)}" style="color:#f85149;" title="Delete from vault">✕</button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        renderHistoryList();

        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            renderHistoryList();
        });

        // Delegate History buttons
        listEl.addEventListener('click', (e) => {
            const peekBtn = e.target.closest('[data-history-peek]');
            if (peekBtn) {
                const aId = peekBtn.getAttribute('data-history-peek');
                const targetAlbum = albums.find(a => a.id === aId);
                if (targetAlbum) openAlbumQuickPeek(targetAlbum);
                return;
            }

            const copyBtn = e.target.closest('[data-history-copy]');
            if (copyBtn) {
                const aId = copyBtn.getAttribute('data-history-copy');
                const targetAlbum = albums.find(a => a.id === aId);
                if (targetAlbum && targetAlbum.files) copyWatchUrlsFromFiles(targetAlbum.files);
                return;
            }

            const m3uBtn = e.target.closest('[data-history-m3u]');
            if (m3uBtn) {
                const aId = m3uBtn.getAttribute('data-history-m3u');
                const targetAlbum = albums.find(a => a.id === aId);
                if (targetAlbum && targetAlbum.files) exportM3UPlaylist(targetAlbum.files, targetAlbum.title);
                return;
            }

            const delBtn = e.target.closest('[data-history-del]');
            if (delBtn) {
                const aId = delBtn.getAttribute('data-history-del');
                vaultDeleteAlbum(aId).then(() => {
                    const idx = albums.findIndex(a => a.id === aId);
                    if (idx !== -1) albums.splice(idx, 1);
                    renderHistoryList();
                    updateHistoryCounter();
                    toast('Album removed from vault.');
                });
                return;
            }
        });

        // Export Vault JSON
        modal.querySelector('#nexus-turbo-history-export').addEventListener('click', () => {
            const payload = {
                generator: 'Turbo.cr Workspace by ervss',
                version: '2.1.0',
                exportedAt: new Date().toISOString(),
                albums,
            };
            downloadFile(JSON.stringify(payload, null, 2), `turbo_vault_backup_${Date.now()}.json`, 'application/json;charset=utf-8');
            toast(`💾 Exported ${albums.length} albums to JSON backup file!`);
        });

        // Import Vault JSON
        modal.querySelector('#nexus-turbo-history-import').addEventListener('click', () => {
            filePicker.click();
        });

        filePicker.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (evt) => {
                try {
                    const parsed = JSON.parse(evt.target.result);
                    const importedAlbums = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.albums) ? parsed.albums : []);
                    if (!importedAlbums.length) {
                        toast('No valid albums found in JSON file.', true);
                        return;
                    }
                    for (const a of importedAlbums) {
                        if (a && a.id) await vaultSaveAlbum(a);
                    }
                    toast(`📂 Successfully imported ${importedAlbums.length} albums into Vault!`);
                    modal.remove();
                    openLibraryHistoryModal();
                    updateHistoryCounter();
                } catch (err) {
                    toast(`JSON parse error: ${err.message}`, true);
                }
            };
            reader.readAsText(file);
        });

        // Clear All
        modal.querySelector('#nexus-turbo-history-clear').addEventListener('click', () => {
            if (confirm('Are you sure you want to delete all saved albums from browser vault?')) {
                vaultClearAll().then(() => {
                    albums.length = 0;
                    renderHistoryList();
                    updateHistoryCounter();
                    toast('Vault history cleared.');
                });
            }
        });

        modal.addEventListener('click', (e) => {
            if (e.target.hasAttribute('data-close-history') || e.target.closest('[data-close-history]')) {
                modal.remove();
            }
        });
    }

    // ── 16. Single Album Mode Logic (/a/<id>) ──────────────────────
    function getAlbumTitle() {
        const h1 = document.querySelector('h1');
        if (h1 && h1.textContent.trim()) return h1.textContent.trim();
        const title = document.title.replace(/\s*[—\-]\s*turbo\.cr.*$/i, '').trim();
        return title || 'Turbo.cr Album';
    }

    function scanRows() {
        if (!isAlbumPage()) return;

        // Try extracting const FILES from page HTML for rich metadata (duration, thumbs)
        let inlineFiles = [];
        try {
            inlineFiles = parseFilesFromHtml(document.documentElement.innerHTML);
        } catch {}
        const inlineMap = new Map(inlineFiles.map(f => [f.id, f]));

        const fileRows = document.querySelectorAll('tr.file-row, tr[data-id]');
        let added = 0;

        fileRows.forEach((tr, index) => {
            const id = tr.getAttribute('data-id') || '';
            if (!id) return;

            const inline = inlineMap.get(id);
            const name = inline?.name || tr.getAttribute('data-name') || tr.querySelector('a')?.textContent.trim() || `Video ${id}`;
            const size = inline?.size || parseInt(tr.getAttribute('data-size') || '0', 10) || 0;
            const duration = inline?.dur || 0;

            const a = tr.querySelector('a[href*="/v/"], a[href*="/d/"], a');
            let pageUrl = a ? a.getAttribute('href') : `/v/${id}`;
            if (pageUrl && pageUrl.startsWith('/')) pageUrl = location.origin + pageUrl;
            if (pageUrl && pageUrl.includes('/d/')) pageUrl = pageUrl.replace('/d/', '/v/');
            if (!pageUrl) pageUrl = `https://turbo.cr/v/${id}`;

            let thumbnail = inline?.thumb || a?.getAttribute('data-thumb') || tr.querySelector('img')?.src || '';
            if (!thumbnail && id) {
                thumbnail = `https://static.scdn.st/6049fd43-838b-492d-a20a-9aead716dfe7/thumbs/${id}.jpg`;
            }

            let quality = 'HD';
            if (/2160|4k/i.test(name)) quality = '4K';
            else if (/1440|2k/i.test(name)) quality = '2K';
            else if (/1080/i.test(name)) quality = '1080p';
            else if (/720/i.test(name)) quality = '720p';

            if (!state.items.has(id)) {
                state.items.set(id, {
                    id,
                    url: pageUrl,
                    source_url: pageUrl,
                    title: name,
                    thumbnail,
                    size,
                    duration,
                    quality,
                    selected: true,
                    row: tr,
                    index,
                });
                added++;
            } else {
                const item = state.items.get(id);
                if (item && duration && !item.duration) item.duration = duration;
                if (item && thumbnail && !item.thumbnail) item.thumbnail = thumbnail;
            }

            const chk = tr.querySelector('input[type="checkbox"]');
            if (chk) {
                chk.classList.remove('pointer-events-none', 'opacity-30');
                chk.style.pointerEvents = 'auto';
                chk.style.opacity = '1';
                chk.style.cursor = 'pointer';
                chk.checked = !!state.items.get(id)?.selected;
                chk.onchange = (e) => {
                    const item = state.items.get(id);
                    if (item) {
                        item.selected = chk.checked;

                        if (e.shiftKey && state.lastSelectedIndex !== -1) {
                            const all = Array.from(state.items.values());
                            const low = Math.min(state.lastSelectedIndex, item.index);
                            const high = Math.max(state.lastSelectedIndex, item.index);
                            for (let i = low; i <= high; i++) {
                                if (all[i]) {
                                    all[i].selected = item.selected;
                                    const c = all[i].row?.querySelector('input[type="checkbox"]');
                                    if (c) c.checked = item.selected;
                                }
                            }
                        }
                        state.lastSelectedIndex = item.index;
                        updateToolbar();
                    }
                };
            }
        });

        if (added > 0 || state.items.size !== state.lastCardCount) {
            state.lastCardCount = state.items.size;
            updateToolbar();
            ensureGallery();
        }
    }

    function selectedItems() {
        return Array.from(state.items.values()).filter((it) => it.selected);
    }

    function setMinimized(minimized) {
        state.minimized = minimized;
        try {
            localStorage.setItem(STORAGE_MIN_KEY, String(minimized));
        } catch {}

        const toolbar = document.getElementById(TOOLBAR_ID);
        let bubble = document.getElementById(BUBBLE_ID);

        if (minimized) {
            if (toolbar) toolbar.classList.add('nexus-turbo-minimized');
            if (!bubble) {
                bubble = document.createElement('div');
                bubble.id = BUBBLE_ID;
                bubble.className = 'nexus-turbo-bubble';
                bubble.title = 'Turbo.cr Workspace — Click to restore';
                bubble.innerHTML = `
                    <span>⚡</span>
                    <div class="nexus-turbo-bubble-badge" id="nexus-turbo-bubble-badge">0</div>
                `;
                document.body.appendChild(bubble);

                makeDraggable(bubble, bubble, (x, y) => savePosition(x, y));

                bubble.addEventListener('click', () => {
                    if (bubble._hasMoved) {
                        bubble._hasMoved = false;
                        return;
                    }
                    setMinimized(false);
                });
            }
            bubble.style.display = 'flex';
            if (state.position) applyPosition(bubble, state.position);
            updateBubbleBadge();
        } else {
            if (toolbar) {
                toolbar.classList.remove('nexus-turbo-minimized');
                if (state.position) applyPosition(toolbar, state.position);
            }
            if (bubble) bubble.style.display = 'none';
        }
    }

    function updateBubbleBadge() {
        const badge = document.getElementById('nexus-turbo-bubble-badge');
        if (!badge) return;
        const count = isLibraryPage()
            ? Array.from(libState.albums.values()).filter(a => a.selected).length
            : selectedItems().length;
        badge.textContent = count;
        badge.style.display = count > 0 ? 'block' : 'none';
    }

    function updateToolbar() {
        if (isLibraryPage()) {
            updateLibraryToolbar();
            return;
        }

        const toolbar = document.getElementById(TOOLBAR_ID);
        if (!toolbar) return;

        const total = state.items.size;
        const sel = selectedItems();
        const selCount = sel.length;
        const totalBytes = sel.reduce((acc, it) => acc + (it.size || 0), 0);

        const countEl = toolbar.querySelector('.nexus-turbo-count');
        if (countEl) {
            countEl.textContent = `${selCount} / ${total} selected (${formatBytes(totalBytes)})`;
        }

        const splitBtn = toolbar.querySelector('#nexus-turbo-album-split-btn');
        if (splitBtn) splitBtn.disabled = selCount === 0;

        const copyWatchBtn = toolbar.querySelector('#nexus-turbo-album-copy-watch');
        if (copyWatchBtn) copyWatchBtn.disabled = selCount === 0;

        const copyDirectBtn = toolbar.querySelector('#nexus-turbo-album-copy-direct');
        if (copyDirectBtn) copyDirectBtn.disabled = selCount === 0;

        const m3uBtn = toolbar.querySelector('#nexus-turbo-album-m3u');
        if (m3uBtn) m3uBtn.disabled = selCount === 0;

        const jsonBtn = toolbar.querySelector('#nexus-turbo-album-json');
        if (jsonBtn) jsonBtn.disabled = selCount === 0;

        updateBubbleBadge();
        renderGallery();
    }

    function galleryItems() {
        const query = state.galleryQuery.trim().toLocaleLowerCase();
        const items = Array.from(state.items.values()).filter((item) => {
            return !query || `${item.title} ${item.id}`.toLocaleLowerCase().includes(query);
        });
        const sorters = {
            source: () => 0,
            name: (a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }),
            size: (a, b) => (b.size || 0) - (a.size || 0),
            selected: (a, b) => Number(b.selected) - Number(a.selected),
        };
        const sorter = sorters[state.gallerySort] || sorters.source;
        return state.gallerySort === 'source' ? items : items.sort(sorter);
    }

    function setGalleryOpen(open) {
        state.galleryOpen = !!open;
        try { localStorage.setItem(STORAGE_GALLERY_KEY, String(state.galleryOpen)); } catch {}
        const gallery = document.getElementById(GALLERY_ID);
        if (gallery) gallery.hidden = !state.galleryOpen;
        if (state.galleryOpen) renderGallery();
    }

    // ── 17. Modal In-Page Video Player ─────────────────────────────
    function openPlayer(item, currentIndex = -1, allItems = []) {
        const old = document.getElementById(PLAYER_ID);
        if (old) old.remove();
        const id = String(item?.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
        if (!id) return;

        state.currentPlayerIndex = currentIndex;

        const dialog = document.createElement('div');
        dialog.id = PLAYER_ID;
        dialog.innerHTML = `
            <div class="nexus-turbo-player-backdrop" data-close-player></div>
            <section class="nexus-turbo-player-dialog" role="dialog" aria-modal="true" aria-label="Play ${escapeHtml(item.title)}">
                <div class="nexus-turbo-player-head" id="nexus-turbo-player-drag-handle">
                    <span title="${escapeHtml(item.title)}">🎬 ${escapeHtml(item.title)}</span>
                    <div class="nexus-turbo-player-controls">
                        ${allItems && allItems.length > 1 ? `
                            <button type="button" class="nexus-turbo-player-nav-btn" id="nexus-turbo-player-prev" ${currentIndex <= 0 ? 'disabled' : ''} title="Previous Video (Alt + ←)">◀ Prev</button>
                            <button type="button" class="nexus-turbo-player-nav-btn" id="nexus-turbo-player-next" ${currentIndex >= allItems.length - 1 ? 'disabled' : ''} title="Next Video (Alt + →)">Next ▶</button>
                        ` : ''}
                        <button type="button" class="nexus-turbo-player-ctrl-btn" id="nexus-turbo-player-copy-link" title="Copy Watch URL">📋</button>
                        <button type="button" class="nexus-turbo-player-ctrl-btn" id="nexus-turbo-player-theater" title="Theater Mode / Widescreen">⛶</button>
                        <a href="https://turbo.cr/v/${encodeURIComponent(id)}" target="_blank" class="nexus-turbo-player-ctrl-btn" title="Open on Turbo.cr" style="text-decoration:none;">↗</a>
                        <button type="button" class="nexus-turbo-player-ctrl-btn close" data-close-player aria-label="Close player">✕</button>
                    </div>
                </div>
                <div class="nexus-turbo-player-body">
                    <iframe src="https://turbo.cr/embed/${encodeURIComponent(id)}" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen></iframe>
                </div>
            </section>
        `;

        const dialogCard = dialog.querySelector('.nexus-turbo-player-dialog');
        const theaterBtn = dialog.querySelector('#nexus-turbo-player-theater');
        let isTheater = false;

        theaterBtn.addEventListener('click', () => {
            isTheater = !isTheater;
            dialogCard.classList.toggle('is-theater', isTheater);
            theaterBtn.innerHTML = isTheater ? '🗗' : '⛶';
        });

        dialog.querySelector('#nexus-turbo-player-copy-link')?.addEventListener('click', () => {
            copyToClipboard(`https://turbo.cr/v/${id}`, 'Watch link copied!');
        });

        // Prev / Next Video buttons
        dialog.querySelector('#nexus-turbo-player-prev')?.addEventListener('click', () => {
            if (allItems && currentIndex > 0) {
                const prev = allItems[currentIndex - 1];
                openPlayer(prev, currentIndex - 1, allItems);
            }
        });

        dialog.querySelector('#nexus-turbo-player-next')?.addEventListener('click', () => {
            if (allItems && currentIndex < allItems.length - 1) {
                const next = allItems[currentIndex + 1];
                openPlayer(next, currentIndex + 1, allItems);
            }
        });

        makeDraggable(dialogCard, dialog.querySelector('#nexus-turbo-player-drag-handle'));

        dialog.addEventListener('click', (event) => {
            if (event.target.hasAttribute('data-close-player')) {
                dialog.remove();
            }
        });

        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                dialog.remove();
                document.removeEventListener('keydown', onKeyDown);
            }
            if (e.altKey && e.key === 'ArrowLeft' && allItems && currentIndex > 0) {
                e.preventDefault();
                openPlayer(allItems[currentIndex - 1], currentIndex - 1, allItems);
            }
            if (e.altKey && e.key === 'ArrowRight' && allItems && currentIndex < allItems.length - 1) {
                e.preventDefault();
                openPlayer(allItems[currentIndex + 1], currentIndex + 1, allItems);
            }
        };
        document.addEventListener('keydown', onKeyDown);

        document.body.appendChild(dialog);
    }

    function renderGallery() {
        const gallery = document.getElementById(GALLERY_ID);
        if (!gallery || gallery.hidden) return;
        const items = galleryItems();
        const total = items.length;
        const perPage = state.galleryPerPage;
        const maxPage = Math.max(0, Math.ceil(total / perPage) - 1);
        state.galleryPage = Math.max(0, Math.min(state.galleryPage, maxPage));
        const start = state.galleryPage * perPage;
        const pageItems = items.slice(start, start + perPage);

        const grid = gallery.querySelector('#nexus-turbo-gallery-grid');
        const count = gallery.querySelector('#nexus-turbo-gallery-count');
        const pagination = gallery.querySelector('#nexus-turbo-gallery-pagination');

        if (count) {
            count.textContent = `Showing ${pageItems.length} of ${total} items (total ${state.items.size})`;
        }

        if (grid) {
            grid.innerHTML = pageItems.map((item, idx) => {
                const isSel = !!item.selected;
                const globalIdx = start + idx;
                return `
                    <article class="nexus-turbo-card ${isSel ? 'is-selected' : ''}" data-id="${escapeHtml(item.id)}" data-index="${globalIdx}">
                        <button class="nexus-turbo-card-check" type="button" data-toggle="${escapeHtml(item.id)}" aria-label="Select ${escapeHtml(item.title)}">
                            ${isSel ? '✓' : ''}
                        </button>
                        <button class="nexus-turbo-card-poster" type="button" data-play="${escapeHtml(item.id)}">
                            ${item.thumbnail ? `<img src="${escapeHtml(item.thumbnail)}" alt="" loading="lazy">` : '<div class="nexus-turbo-card-fallback">PREVIEW</div>'}
                            <span class="nexus-turbo-card-play">▶</span>
                        </button>
                        <div class="nexus-turbo-card-body">
                            <h3 title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h3>
                            <div class="nexus-turbo-card-meta">
                                <span>${escapeHtml(formatBytes(item.size))}</span>
                                <span>${escapeHtml(formatDuration(item.duration))}</span>
                                <span>${escapeHtml(item.quality || 'HD')}</span>
                            </div>
                            <div class="nexus-turbo-card-actions">
                                <button type="button" data-play="${escapeHtml(item.id)}">Play</button>
                                <button type="button" data-copy-link="${escapeHtml(item.id)}">Link</button>
                                <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">Open</a>
                            </div>
                        </div>
                    </article>
                `;
            }).join('');
        }

        if (pagination) {
            pagination.innerHTML = `
                <button type="button" data-page="prev" ${state.galleryPage === 0 ? 'disabled' : ''}>← Previous</button>
                <span>Page ${state.galleryPage + 1} of ${maxPage + 1}</span>
                <button type="button" data-page="next" ${state.galleryPage >= maxPage ? 'disabled' : ''}>Next →</button>
            `;
        }
    }

    function ensureGallery() {
        if (isLibraryPage()) return;
        let gallery = document.getElementById(GALLERY_ID);
        if (gallery) return;

        gallery = document.createElement('div');
        gallery.id = GALLERY_ID;
        gallery.hidden = !state.galleryOpen;
        gallery.innerHTML = `
            <section class="nexus-turbo-gallery-shell" aria-label="Album Gallery">
                <header class="nexus-turbo-gallery-header">
                    <div class="nexus-turbo-gallery-brand">
                        <span class="nexus-turbo-gallery-badge">TURBO WORKSPACE</span>
                        <div class="nexus-turbo-gallery-heading">
                            <h2>${escapeHtml(getAlbumTitle())}</h2>
                            <p id="nexus-turbo-gallery-count">Loading videos...</p>
                        </div>
                    </div>
                    <div class="nexus-turbo-gallery-actions">
                        <button type="button" class="nexus-turbo-gallery-btn" id="nexus-turbo-gal-split">📺 Split-Screen</button>
                        <button type="button" class="nexus-turbo-gallery-btn" id="nexus-turbo-gal-copy-watch">📋 Copy Watch</button>
                        <button type="button" class="nexus-turbo-gallery-btn" id="nexus-turbo-gal-copy-direct">🔗 Copy Direct</button>
                        <button type="button" class="nexus-turbo-gallery-btn" id="nexus-turbo-gal-m3u">🎵 Export .M3U</button>
                        <button type="button" class="nexus-turbo-gallery-btn" id="nexus-turbo-gal-json">📄 Export JSON</button>
                        <button type="button" class="nexus-turbo-gallery-btn" id="nexus-turbo-select-all-btn">Select All</button>
                        <button type="button" class="nexus-turbo-gallery-btn" id="nexus-turbo-select-none-btn">Clear</button>
                        <button type="button" class="nexus-turbo-gallery-btn" id="nexus-turbo-gallery-close">Close</button>
                    </div>
                </header>

                <div class="nexus-turbo-gallery-tools">
                    <div class="nexus-turbo-gallery-search">
                        <input type="search" id="nexus-turbo-gallery-search-input" placeholder="Search in album..." value="${escapeHtml(state.galleryQuery)}">
                    </div>
                    <div class="nexus-turbo-gallery-sort">
                        <label for="nexus-turbo-gallery-sort-select">Sort by:</label>
                        <select id="nexus-turbo-gallery-sort-select">
                            <option value="source" ${state.gallerySort === 'source' ? 'selected' : ''}>Original order</option>
                            <option value="name" ${state.gallerySort === 'name' ? 'selected' : ''}>Name</option>
                            <option value="size" ${state.gallerySort === 'size' ? 'selected' : ''}>Largest Size</option>
                            <option value="selected" ${state.gallerySort === 'selected' ? 'selected' : ''}>Selected first</option>
                        </select>
                    </div>
                </div>

                <div class="nexus-turbo-gallery-grid" id="nexus-turbo-gallery-grid"></div>
                <div class="nexus-turbo-gallery-pagination" id="nexus-turbo-gallery-pagination"></div>
            </section>
        `;

        gallery.addEventListener('click', (event) => {
            const toggle = event.target.closest('[data-toggle]');
            if (toggle) {
                const id = toggle.getAttribute('data-toggle');
                const item = state.items.get(id);
                if (item) {
                    item.selected = !item.selected;
                    const chk = item.row?.querySelector('input[type="checkbox"]');
                    if (chk) chk.checked = item.selected;

                    const card = toggle.closest('.nexus-turbo-card');
                    const cIdx = parseInt(card?.dataset.index || '-1', 10);
                    if (event.shiftKey && state.lastSelectedIndex !== -1 && cIdx !== -1) {
                        const items = galleryItems();
                        const low = Math.min(state.lastSelectedIndex, cIdx);
                        const high = Math.max(state.lastSelectedIndex, cIdx);
                        for (let i = low; i <= high; i++) {
                            if (items[i]) {
                                items[i].selected = item.selected;
                                const rChk = items[i].row?.querySelector('input[type="checkbox"]');
                                if (rChk) rChk.checked = item.selected;
                            }
                        }
                    }
                    state.lastSelectedIndex = cIdx;
                    updateToolbar();
                }
                return;
            }

            const play = event.target.closest('[data-play]');
            if (play) {
                const id = play.getAttribute('data-play');
                const item = state.items.get(id);
                const items = galleryItems();
                const idx = items.indexOf(item);
                if (item) openPlayer(item, idx, items);
                return;
            }

            const copyLink = event.target.closest('[data-copy-link]');
            if (copyLink) {
                const id = copyLink.getAttribute('data-copy-link');
                copyToClipboard(`https://turbo.cr/v/${id}`, 'Watch link copied!');
                return;
            }

            const pageBtn = event.target.closest('[data-page]');
            if (pageBtn) {
                const dir = pageBtn.getAttribute('data-page');
                state.galleryPage += dir === 'next' ? 1 : -1;
                renderGallery();
            }
        });

        gallery.querySelector('#nexus-turbo-gallery-close').addEventListener('click', () => setGalleryOpen(false));
        gallery.querySelector('#nexus-turbo-select-all-btn').addEventListener('click', () => {
            state.items.forEach((it) => {
                it.selected = true;
                const chk = it.row?.querySelector('input[type="checkbox"]');
                if (chk) chk.checked = true;
            });
            updateToolbar();
        });
        gallery.querySelector('#nexus-turbo-select-none-btn').addEventListener('click', () => {
            state.items.forEach((it) => {
                it.selected = false;
                const chk = it.row?.querySelector('input[type="checkbox"]');
                if (chk) chk.checked = false;
            });
            updateToolbar();
        });

        gallery.querySelector('#nexus-turbo-gal-split').addEventListener('click', () => {
            openSplitScreen(selectedItems());
        });
        gallery.querySelector('#nexus-turbo-gal-copy-watch').addEventListener('click', () => {
            copyWatchUrlsFromFiles(selectedItems());
        });
        gallery.querySelector('#nexus-turbo-gal-copy-direct').addEventListener('click', () => {
            copyDirectUrlsFromFiles(selectedItems());
        });
        gallery.querySelector('#nexus-turbo-gal-m3u').addEventListener('click', () => {
            exportM3UPlaylist(selectedItems(), getAlbumTitle());
        });
        gallery.querySelector('#nexus-turbo-gal-json').addEventListener('click', () => {
            exportMetadataJSON(selectedItems(), { title: getAlbumTitle(), url: location.href });
        });

        const search = gallery.querySelector('#nexus-turbo-gallery-search-input');
        search.addEventListener('input', () => {
            state.galleryQuery = search.value;
            state.galleryPage = 0;
            renderGallery();
        });

        const sort = gallery.querySelector('#nexus-turbo-gallery-sort-select');
        sort.addEventListener('change', () => {
            state.gallerySort = sort.value;
            renderGallery();
        });

        document.body.appendChild(gallery);
        renderGallery();
    }

    function ensureToolbar() {
        if (isLibraryPage()) {
            ensureLibraryToolbar();
            return;
        }

        let el = document.getElementById(TOOLBAR_ID);
        if (el) return;

        el = document.createElement('div');
        el.id = TOOLBAR_ID;
        el.innerHTML = `
            <div class="nexus-turbo-header" id="nexus-turbo-header">
                <div class="nexus-turbo-brand">
                    <span>⚡ <a href="https://github.com/ervss/turbo-cr-workspace" target="_blank">TURBO WORKSPACE</a> <small style="font-size:10px;color:#8b949e;font-weight:normal;">by ervss</small></span>
                </div>
                <div class="nexus-turbo-header-actions">
                    <button class="nexus-turbo-min-btn" id="nexus-turbo-album-help-btn" title="Shortcuts & Help (?)">?</button>
                    <button class="nexus-turbo-min-btn" id="nexus-turbo-min-btn" title="Minimize">—</button>
                </div>
            </div>
            <div class="nexus-turbo-info">
                <span class="nexus-turbo-count">0 / 0 selected</span>
                <span>turbo.cr/a</span>
            </div>
            <div class="nexus-turbo-actions" style="display:flex;gap:6px;flex-wrap:wrap;">
                <button class="nexus-turbo-btn-sub" id="nexus-turbo-gallery-btn" style="flex:1;">Gallery</button>
                <button class="nexus-turbo-btn-sub" id="nexus-turbo-select-btn" style="flex:1;">Select All</button>
                <button class="nexus-turbo-btn-split" id="nexus-turbo-album-split-btn" style="flex:1;" disabled>📺 Split-Screen</button>
            </div>
            <div class="nexus-turbo-actions" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:2px;">
                <button class="nexus-turbo-btn-copy" id="nexus-turbo-album-copy-watch" style="flex:1;" disabled title="Copy Watch URLs">📋 Copy Links</button>
                <button class="nexus-turbo-btn-copy" id="nexus-turbo-album-copy-direct" style="flex:1;" disabled title="Resolve Direct Streams">🔗 Direct Streams</button>
                <button class="nexus-turbo-btn-export" id="nexus-turbo-album-m3u" style="flex:1;" disabled title="Export .M3U8 playlist">🎵 .M3U</button>
                <button class="nexus-turbo-btn-export" id="nexus-turbo-album-json" style="flex:1;" disabled title="Export JSON metadata">📄 JSON</button>
            </div>
        `;

        document.body.appendChild(el);

        if (state.position) applyPosition(el, state.position);
        makeDraggable(el, el.querySelector('#nexus-turbo-header'), (x, y) => savePosition(x, y));

        el.querySelector('#nexus-turbo-album-help-btn').addEventListener('click', openHelpModal);
        el.querySelector('#nexus-turbo-min-btn').addEventListener('click', () => setMinimized(true));
        el.querySelector('#nexus-turbo-gallery-btn').addEventListener('click', () => setGalleryOpen(!state.galleryOpen));

        el.querySelector('#nexus-turbo-select-btn').addEventListener('click', () => {
            const allSelected = state.items.size > 0 && selectedItems().length === state.items.size;
            const newSelected = !allSelected;
            state.items.forEach((it) => {
                it.selected = newSelected;
                const chk = it.row?.querySelector('input[type="checkbox"]');
                if (chk) chk.checked = newSelected;
            });
            el.querySelector('#nexus-turbo-select-btn').textContent = newSelected ? 'Clear' : 'Select All';
            updateToolbar();
        });

        el.querySelector('#nexus-turbo-album-split-btn').addEventListener('click', () => openSplitScreen(selectedItems()));
        el.querySelector('#nexus-turbo-album-copy-watch').addEventListener('click', () => copyWatchUrlsFromFiles(selectedItems()));
        el.querySelector('#nexus-turbo-album-copy-direct').addEventListener('click', () => copyDirectUrlsFromFiles(selectedItems()));
        el.querySelector('#nexus-turbo-album-m3u').addEventListener('click', () => exportM3UPlaylist(selectedItems(), getAlbumTitle()));
        el.querySelector('#nexus-turbo-album-json').addEventListener('click', () => exportMetadataJSON(selectedItems(), { title: getAlbumTitle(), url: location.href }));

        setMinimized(state.minimized);
        updateToolbar();
    }

    // ── 18. Watch Page Button (/v/<id>) ────────────────────────────
    function ensureWatchPageButton() {
        if (!isWatchPage()) return;
        if (document.getElementById('nexus-turbo-watch-bar')) return;

        const target = document.querySelector('.player-container, #player, .video-container, .card, main') || document.body;
        const wrap = document.createElement('div');
        wrap.id = 'nexus-turbo-watch-bar';
        wrap.className = 'nexus-turbo-watch-btn-wrap';
        wrap.style.cssText = 'display:flex;gap:8px;align-items:center;margin:12px 0;flex-wrap:wrap;';

        const idMatch = location.pathname.match(/\/v\/([a-zA-Z0-9_-]+)/);
        const videoId = idMatch ? idMatch[1] : '';
        const title = document.querySelector('h1')?.textContent.trim() || document.title.replace(/\s*[—\-]\s*turbo\.cr.*$/i, '').trim();

        wrap.innerHTML = `
            <button class="nexus-turbo-watch-btn" id="nexus-turbo-watch-copy-direct">
                🔗 Copy Direct Stream Link
            </button>
            <button class="nexus-turbo-btn-sub" id="nexus-turbo-watch-copy-url" style="padding:10px 14px;">
                📋 Copy Link
            </button>
            <button class="nexus-turbo-btn-sub" id="nexus-turbo-watch-m3u" style="padding:10px 14px;">
                🎵 Export .M3U
            </button>
            <button class="nexus-turbo-btn-split" id="nexus-turbo-watch-split" style="padding:10px 14px;">
                📺 Split-Screen
            </button>
        `;

        wrap.querySelector('#nexus-turbo-watch-copy-direct').addEventListener('click', async () => {
            toast('⏳ Resolving direct stream link...');
            const direct = await resolveTurboStream(videoId);
            if (direct) {
                copyToClipboard(direct, 'Direct CDN stream URL copied!');
            } else {
                toast('Could not resolve direct CDN stream URL', true);
            }
        });

        wrap.querySelector('#nexus-turbo-watch-copy-url').addEventListener('click', () => {
            copyToClipboard(location.href, 'Watch URL copied!');
        });

        wrap.querySelector('#nexus-turbo-watch-m3u').addEventListener('click', async () => {
            exportM3UPlaylist([{ id: videoId, name: title, dur: 0 }], title);
        });

        wrap.querySelector('#nexus-turbo-watch-split').addEventListener('click', () => {
            openSplitScreen([{ id: videoId, name: title, dur: 0 }]);
        });

        if (target === document.body) {
            wrap.style.cssText += 'position:fixed;bottom:24px;left:24px;z-index:2147483646;';
            document.body.appendChild(wrap);
        } else {
            target.prepend(wrap);
        }
    }

    // ── 19. Global Keyboard Shortcuts Listener ─────────────────────
    function installKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const peek = document.getElementById(PEEK_ID);
                if (peek) { peek.remove(); return; }
                const player = document.getElementById(PLAYER_ID);
                if (player) { player.remove(); return; }
                const split = document.getElementById(SPLIT_ID);
                if (split) { split.remove(); return; }
                const hist = document.getElementById(HISTORY_ID);
                if (hist) { hist.remove(); return; }
                const help = document.getElementById(HELP_ID);
                if (help) { help.remove(); return; }
                const gallery = document.getElementById(GALLERY_ID);
                if (gallery && !gallery.hidden) { setGalleryOpen(false); return; }
                return;
            }

            if (e.target.matches('input, textarea, select')) return;

            if (e.key === '?') {
                e.preventDefault();
                openHelpModal();
                return;
            }

            if (e.key === '/') {
                const search = document.querySelector('#nexus-turbo-search, #nexus-turbo-gallery-search-input, #nexus-turbo-peek-search');
                if (search) {
                    e.preventDefault();
                    search.focus();
                    search.select();
                }
                return;
            }

            if (e.shiftKey && (e.key === 'A' || e.key === 'a')) {
                e.preventDefault();
                if (isLibraryPage()) selectAllAlbums(true);
                else {
                    state.items.forEach(it => {
                        it.selected = true;
                        const chk = it.row?.querySelector('input[type="checkbox"]');
                        if (chk) chk.checked = true;
                    });
                    updateToolbar();
                }
                return;
            }

            if (e.shiftKey && (e.key === 'C' || e.key === 'c')) {
                e.preventDefault();
                if (isLibraryPage()) selectAllAlbums(false);
                else {
                    state.items.forEach(it => {
                        it.selected = false;
                        const chk = it.row?.querySelector('input[type="checkbox"]');
                        if (chk) chk.checked = false;
                    });
                    updateToolbar();
                }
                return;
            }

            if (e.key === 's' || e.key === 'S') {
                if (isLibraryPage()) {
                    e.preventDefault();
                    if (libState.scanning) stopLibraryScan();
                    else startLibraryScan();
                }
                return;
            }

            if (e.key === 'n' || e.key === 'N') {
                if (isLibraryPage()) {
                    e.preventDefault();
                    loadNextPage(1);
                }
                return;
            }
        });
    }

    // ── 20. Initialization ─────────────────────────────────────────
    function init() {
        injectStyles();
        installKeyboardShortcuts();

        if (isLibraryPage()) {
            scanLibraryAlbums();
            ensureLibraryToolbar();
            let libTimer = null;
            const obs = new MutationObserver((mutations) => {
                const isOurOnly = mutations.every(m => {
                    const t = m.target;
                    return t && t.closest && (
                        t.closest('#nexus-turbo-toolbar') ||
                        t.closest('.nexus-turbo-album-badge') ||
                        t.closest('.nexus-turbo-album-chk-wrap') ||
                        t.closest('.nexus-turbo-badge-peek') ||
                        t.closest('#nexus-turbo-peek-modal') ||
                        t.closest('#nexus-turbo-split-modal') ||
                        t.closest('#nexus-turbo-history-modal')
                    );
                });
                if (isOurOnly) return;
                clearTimeout(libTimer);
                libTimer = setTimeout(() => scanLibraryAlbums(), 200);
            });
            obs.observe(document.body, { childList: true, subtree: true });
        } else if (isAlbumPage()) {
            scanRows();
            ensureToolbar();
            ensureGallery();
            const obs = new MutationObserver(() => scanRows());
            obs.observe(document.body, { childList: true, subtree: true });
        } else if (isWatchPage()) {
            ensureWatchPageButton();
            const obs = new MutationObserver(() => ensureWatchPageButton());
            obs.observe(document.body, { childList: true, subtree: true });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
