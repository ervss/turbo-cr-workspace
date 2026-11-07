const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
    console.log('=== Running Playwright E2E Test for Turbo.cr Standalone Workspace ===');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    const pageErrors = [];
    page.on('pageerror', (err) => {
        console.error('Page error:', err);
        pageErrors.push(err);
    });
    page.on('console', (msg) => {
        console.log('[BROWSER LOG]:', msg.text());
    });

    const mockLibraryHtml = `<!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>Turbo.cr Library</title></head>
    <body style="background:#0b0e14;color:#fff;">
        <main>
            <div id="grid" class="grid">
                <a class="alb" href="/a/alb01">
                    <div class="strip"><img src="https://turbo.cr/thumb1.jpg" alt=""></div>
                    <div class="p-2.5"><span class="font-medium truncate" title="Summer Vacation 2026">Summer Vacation 2026</span></div>
                </a>
                <a class="alb" href="/a/alb02">
                    <div class="strip"><img src="https://turbo.cr/thumb2.jpg" alt=""></div>
                    <div class="p-2.5"><span class="font-medium truncate" title="Mountain Trekking 4K">Mountain Trekking 4K</span></div>
                </a>
                <a class="alb" href="/a/alb03">
                    <div class="strip"><img src="https://turbo.cr/thumb3.jpg" alt=""></div>
                    <div class="p-2.5"><span class="font-medium truncate" title="Drone Flight HD">Drone Flight HD</span></div>
                </a>
            </div>
            <span>Showing 3 albums</span>
        </main>
    </body>
    </html>`;

    const albumFilesMap = {
        alb01: [
            { id: "v01", name: "Beach Walking.mp4", size: 314572800, dur: 120, thumb: "https://turbo.cr/v01.jpg", views: 12 },
            { id: "v02", name: "Sunset Cocktails.mp4", size: 419430400, dur: 180, thumb: "https://turbo.cr/v02.jpg", views: 24 }
        ],
        alb02: [
            { id: "v03", name: "Mountain Peak 4K.mp4", size: 943718400, dur: 300, thumb: "https://turbo.cr/v03.jpg", views: 88 }
        ],
        alb03: [
            { id: "v04", name: "Forest Drone HD.mp4", size: 52428800, dur: 60, thumb: "https://turbo.cr/v04.jpg", views: 5 }
        ]
    };

    await page.route('**/*', async (route) => {
        const u = new URL(route.request().url());

        if (u.pathname === '/library') {
            return route.fulfill({ status: 200, contentType: 'text/html', body: mockLibraryHtml });
        }

        if (u.pathname.startsWith('/a/')) {
            const albId = u.pathname.split('/').pop();
            const files = albumFilesMap[albId] || [];
            const html = `<!DOCTYPE html><html><head><title>Album ${albId} | Turbo.cr</title></head><body>
                <h1>Album ${albId}</h1>
                <script>
                const FILES = ${JSON.stringify(files)};
                </script>
                <table>
                ${files.map(f => `<tr class="file-row" data-id="${f.id}" data-name="${f.name}" data-size="${f.size}">
                    <td><input type="checkbox"></td>
                    <td><a href="/v/${f.id}">${f.name}</a></td>
                </tr>`).join('')}
                </table>
            </body></html>`;
            return route.fulfill({ status: 200, contentType: 'text/html', body: html });
        }

        if (u.pathname === '/api/sign') {
            const vId = u.searchParams.get('v') || 'v01';
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ url: `https://turbocdn.st/data/${vId}.mp4?token=mock123` })
            });
        }

        if (u.pathname.startsWith('/embed/')) {
            const vId = u.pathname.split('/').pop();
            return route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: `<html><body><video id="main-video" src="https://turbocdn.st/data/${vId}.mp4"></video></body></html>`
            });
        }

        if (u.pathname.endsWith('.jpg')) {
            return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="100%" height="100%" fill="#1f2937"/></svg>' });
        }

        return route.fulfill({ status: 200, body: 'ok' });
    });

    const userScriptPath = path.join(__dirname, 'turbo-library-workspace-standalone.user.js');

    // ───────────────────────────────────────────────────────────────
    // Phase 1: Test /library mode
    // ───────────────────────────────────────────────────────────────
    console.log('Navigating to https://turbo.cr/library...');
    await page.goto('https://turbo.cr/library');
    await page.addScriptTag({ path: userScriptPath });

    // 1. Check toolbar existence
    const toolbar = page.locator('#nexus-turbo-toolbar');
    await toolbar.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ 1. Floating toolbar visible on /library');

    // 2. Check cards enhancement
    const cards = page.locator('a.alb');
    assert.strictEqual(await cards.count(), 3);
    const firstCard = cards.nth(0);
    await firstCard.locator('.nexus-turbo-album-chk').waitFor({ state: 'visible' });
    await firstCard.locator('.nexus-turbo-album-badge').waitFor({ state: 'visible' });
    await firstCard.locator('.nexus-turbo-badge-peek').waitFor({ state: 'visible' });
    console.log('✓ 2. Cards enhanced with checkbox, badge, and quick peek button');

    // 3. Scan Albums
    console.log('Clicking "Scan Albums"...');
    await page.locator('#nexus-turbo-scan-btn').click();
    await firstCard.locator('.nexus-turbo-album-badge.badge-done').waitFor({ timeout: 5000 });

    const badgeText = await firstCard.locator('.nexus-turbo-album-badge').innerText();
    assert.match(badgeText, /2 vids/i);
    assert.match(badgeText, /UHD|FHD|HD|SD/i);
    console.log('✓ 3. Background scan completed; badges updated with video count & quality tags');

    // 4. Test Selection (Shift+Click)
    console.log('Testing Shift+Click range selection on album cards...');
    await cards.nth(0).locator('.nexus-turbo-album-chk').click();
    await cards.nth(1).locator('.nexus-turbo-album-chk').click({ modifiers: ['Shift'] });
    const countText = await toolbar.locator('.nexus-turbo-count').innerText();
    assert.match(countText, /2 \/ 3 albums/);
    console.log('✓ 4. Shift+Click range selection selected 2 albums');

    // 5. Test Quick Peek Modal
    console.log('Testing Quick Peek modal on first album...');
    await firstCard.locator('.nexus-turbo-badge-peek').click();
    const peekModal = page.locator('#nexus-turbo-peek-modal');
    await peekModal.waitFor({ state: 'visible', timeout: 4000 });
    const peekCards = peekModal.locator('.nexus-turbo-peek-card');
    assert.strictEqual(await peekCards.count(), 2);
    console.log('✓ 5. Quick Peek modal opened with 2 video cards');

    // 6. Test Quick Peek Layout Switching
    console.log('Testing layout switcher in Quick Peek...');
    await peekModal.locator('[data-peek-layout="4x3"]').click();
    assert.strictEqual(await peekModal.locator('#nexus-turbo-peek-grid').getAttribute('data-layout'), '4x3');
    await peekModal.locator('[data-peek-layout="list"]').click();
    assert.strictEqual(await peekModal.locator('#nexus-turbo-peek-grid').getAttribute('data-layout'), 'list');
    console.log('✓ 6. Layout switcher changed grid layout successfully');

    // 7. Test Built-in Split-Screen from Quick Peek
    console.log('Testing Split-Screen launch from Quick Peek...');
    console.log('Split button text:', await peekModal.locator('#nexus-turbo-peek-btn-split').innerText());
    console.log('Peek count text:', await peekModal.locator('#nexus-turbo-peek-count').innerText());
    await peekModal.locator('#nexus-turbo-peek-btn-split').click();
    const splitModal = page.locator('#nexus-turbo-split-modal');
    await splitModal.waitFor({ state: 'visible', timeout: 4000 });
    const splitTiles = splitModal.locator('.nexus-turbo-split-tile');
    assert.strictEqual(await splitTiles.count(), 2);
    console.log('✓ 7. Built-in Multi-Video Split-Screen rendered 2 concurrent video tiles');

    // Close Split-Screen with Escape
    await page.keyboard.press('Escape');
    await splitModal.waitFor({ state: 'detached', timeout: 3000 });
    console.log('✓ 8. Split-Screen modal closed via Escape key');

    // Close Quick Peek modal with Escape
    await page.keyboard.press('Escape');
    await peekModal.waitFor({ state: 'detached', timeout: 3000 });
    console.log('✓ 9. Quick Peek modal closed via Escape key');

    // 8. Test Help Modal via ? key
    console.log('Testing Help Modal via ? key...');
    await page.keyboard.press('?');
    const helpModal = page.locator('#nexus-turbo-help-modal');
    await helpModal.waitFor({ state: 'visible', timeout: 3000 });
    assert.match(await helpModal.innerText(), /Keyboard Shortcuts/);
    await page.keyboard.press('Escape');
    await helpModal.waitFor({ state: 'detached', timeout: 3000 });
    console.log('✓ 10. Help modal opened with ? and closed with Escape');

    // 9. Test History Modal
    console.log('Testing History Modal...');
    await toolbar.locator('#nexus-turbo-history-btn').click();
    const historyModal = page.locator('#nexus-turbo-history-modal');
    await historyModal.waitFor({ state: 'visible', timeout: 3000 });
    const historyItems = historyModal.locator('.nexus-turbo-history-item');
    assert(await historyItems.count() >= 1, 'History must contain scanned albums');
    await page.keyboard.press('Escape');
    await historyModal.waitFor({ state: 'detached', timeout: 3000 });
    console.log('✓ 11. Offline History Vault opened and verified');

    // ───────────────────────────────────────────────────────────────
    // Phase 2: Test /a/alb01 Single Album mode
    // ───────────────────────────────────────────────────────────────
    console.log('Navigating to Single Album page https://turbo.cr/a/alb01...');
    await page.goto('https://turbo.cr/a/alb01');
    await page.addScriptTag({ path: userScriptPath });

    const albumToolbar = page.locator('#nexus-turbo-toolbar');
    await albumToolbar.waitFor({ state: 'visible', timeout: 5000 });
    const albumCountText = await albumToolbar.locator('.nexus-turbo-count').innerText();
    assert.match(albumCountText, /2 \/ 2 selected/);
    console.log('✓ 12. Single Album toolbar active & parsed files table with inline const FILES');

    // Test Album Gallery Overlay
    await albumToolbar.locator('#nexus-turbo-gallery-btn').click();
    const albumGallery = page.locator('#nexus-turbo-gallery');
    await albumGallery.waitFor({ state: 'visible', timeout: 3000 });
    const galleryCards = albumGallery.locator('.nexus-turbo-card');
    assert.strictEqual(await galleryCards.count(), 2);
    console.log('✓ 13. Fullscreen Album Gallery rendered 2 video cards');

    // Close Gallery
    await albumGallery.locator('#nexus-turbo-gallery-close').click();

    // Verify zero uncaught errors
    assert.strictEqual(pageErrors.length, 0, `Expected 0 page errors, found: ${pageErrors.map(e => e.message).join(', ')}`);

    console.log('==================================================================');
    console.log('🎉 ALL PLAYWRIGHT E2E BROWSER TESTS PASSED (100% SUCCESS)!');
    console.log('==================================================================');

    await browser.close();
})();
