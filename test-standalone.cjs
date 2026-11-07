const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert');

const scriptPath = path.join(__dirname, 'turbo-library-workspace-standalone.user.js');
console.log('Testing standalone script:', scriptPath);

assert(fs.existsSync(scriptPath), 'UserScript file must exist');
const code = fs.readFileSync(scriptPath, 'utf8');

// 1. Header validations
console.log('✓ Validating UserScript headers...');
assert(code.includes('@name         Turbo.cr Library & Album Workspace (Standalone Edition)'), 'Must have correct name');
assert(code.includes('@author       ervss (https://github.com/ervss)'), 'Must have author ervss');
assert(code.includes('@homepageURL  https://github.com/ervss/turbo-cr-workspace'), 'Must have homepageURL');
assert(code.includes('@downloadURL  https://raw.githubusercontent.com/ervss/turbo-cr-workspace/main/turbo-library-workspace-standalone.user.js'), 'Must have downloadURL');
assert(code.includes('@updateURL    https://raw.githubusercontent.com/ervss/turbo-cr-workspace/main/turbo-library-workspace-standalone.user.js'), 'Must have updateURL');
assert(code.includes('@match        https://turbo.cr/*'), 'Must match turbo.cr');

// 2. Zero local backend / extension dependencies
console.log('✓ Checking for zero localhost / chrome.runtime dependencies...');
assert(!code.includes('chrome.runtime.sendMessage'), 'Must not call chrome.runtime.sendMessage');
assert(!code.includes('127.0.0.1'), 'Must not contain 127.0.0.1');
assert(!code.includes('localhost'), 'Must not contain localhost');
assert(!code.includes('NEXUS_TURBO_HUNTER_PUSH'), 'Must not contain NEXUS_TURBO_HUNTER_PUSH');
assert(!code.includes('NEXUS_TURBO_IMPORT_BULK'), 'Must not contain NEXUS_TURBO_IMPORT_BULK');

// 3. UI translation checks
console.log('✓ Checking for UI English translations...');
const slovakStrings = [
    'Skenujem metadáta',
    'Preskenovaných',
    'Zálohovať na disk',
    'Do Testera',
    'Importovať do Nexusu',
    'História preskenovaných',
    'Označiť všetky',
    'Zrušiť výber',
    'Kino režim',
    'Priemerný dátový tok'
];
for (const s of slovakStrings) {
    assert(!code.includes(s), `Must not contain untranslated Slovak string: "${s}"`);
}

// 4. Standalone feature keywords
console.log('✓ Checking standalone feature presence...');
assert(code.includes('resolveTurboStream'), 'Must include direct stream resolver');
assert(code.includes('openSplitScreen'), 'Must include multi-video Split-Screen');
assert(code.includes('exportM3UPlaylist'), 'Must include .M3U8 playlist export');
assert(code.includes('exportMetadataJSON'), 'Must include JSON metadata export');
assert(code.includes('openHelpModal'), 'Must include Help & Shortcuts modal');
assert(code.includes('TurboWorkspaceVaultDB'), 'Must include standalone IndexedDB vault');

// 5. JavaScript Syntax compilation
console.log('✓ Compiling script with Node.js VM...');
new vm.Script(code);

// 6. Test Core Logic in Isolated Context
console.log('✓ Testing parser & quality estimator logic...');
const context = {
    console,
    Math,
    parseInt,
    parseFloat,
    String,
    Number,
    Array,
    Object,
    RegExp,
    Date,
    URL,
    Map,
    Set,
    JSON,
    window: { top: null },
    location: { hostname: 'turbo.cr', pathname: '/library' },
};
context.window.top = context.window;

// Extract functions for unit testing
const fnScript = new vm.Script(`
    ${code.slice(code.indexOf('function formatBytes'), code.indexOf('function detectPaginationInfo'))}
    globalThis.formatBytes = formatBytes;
    globalThis.formatDuration = formatDuration;
    globalThis.calculateAlbumQuality = calculateAlbumQuality;
    globalThis.parseFilesFromHtml = parseFilesFromHtml;
`);
const vmContext = vm.createContext(context);
fnScript.runInContext(vmContext);

// Test formatBytes
assert.strictEqual(context.formatBytes(0), '0 B');
assert.strictEqual(context.formatBytes(1024), '1 KB');
assert.strictEqual(context.formatBytes(1024 * 1024 * 500), '500 MB');
assert.strictEqual(context.formatBytes(1024 * 1024 * 1024 * 2.5), '2.5 GB');

// Test formatDuration (v2.0.1 returns '—' for 0 to prevent misleading '0:00')
assert.strictEqual(context.formatDuration(0), '—');
assert.strictEqual(context.formatDuration(0, '0:00'), '0:00');
assert.strictEqual(context.formatDuration(45), '0:45');
assert.strictEqual(context.formatDuration(125), '2:05');
assert.strictEqual(context.formatDuration(3665), '1:01:05');

// Test calculateAlbumQuality
const sampleFiles4K = [
    { id: 'v1', size: 500 * 1024 * 1024, dur: 200 }, // ~20 Mbps
    { id: 'v2', size: 600 * 1024 * 1024, dur: 250 },
];
const q4k = context.calculateAlbumQuality(sampleFiles4K);
assert.strictEqual(q4k.label, '4K UHD');
assert.strictEqual(q4k.tier, 4);

const sampleFilesFHD = [
    { id: 'v1', size: 50 * 1024 * 1024, dur: 80 }, // ~5 Mbps
];
const qFhd = context.calculateAlbumQuality(sampleFilesFHD);
assert.strictEqual(qFhd.label, '1080p FHD');
assert.strictEqual(qFhd.tier, 3);

// Test parseFilesFromHtml
const mockHtml = [
    '<!DOCTYPE html>',
    '<html><head><title>Test Album</title></head>',
    '<body>',
    '<script>',
    'const FILES = [',
    '    {id: "vid_001", name: "Vacation Day 1.mp4", size: 104857600, dur: 120, thumb: "https:\\/\\/cdn.example\\/thumb1.jpg", views: 42},',
    '    {id: "vid_002", name: "Vacation Day 2.mp4", size: 209715200, dur: 240, thumb: "https:\\/\\/cdn.example\\/thumb2.jpg", views: 99}',
    '];',
    '</script>',
    '</body></html>'
].join('\n');
const parsed = context.parseFilesFromHtml(mockHtml);
assert.strictEqual(parsed.length, 2);
assert.strictEqual(parsed[0].id, 'vid_001');
assert.strictEqual(parsed[0].name, 'Vacation Day 1.mp4');
assert.strictEqual(parsed[0].size, 104857600);
assert.strictEqual(parsed[0].dur, 120);
assert.strictEqual(parsed[0].thumb, 'https://cdn.example/thumb1.jpg');
assert.strictEqual(parsed[0].views, 42);

console.log('✅ ALL UNIT & STANDALONE TESTS PASSED SUCCESSFULLY!');
