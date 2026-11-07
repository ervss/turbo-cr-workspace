# Turbo.cr Library & Album Workspace (Standalone Edition)

[![Version](https://img.shields.io/badge/version-2.1.0-22c55e.svg)](https://github.com/ervss/turbo-cr-workspace)
[![Author](https://img.shields.io/badge/author-ervss-8b5cf6.svg)](https://github.com/ervss)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Install Userscript](https://img.shields.io/badge/Install-Tampermonkey%20%2F%20Violentmonkey-brightgreen?logo=tampermonkey)](https://raw.githubusercontent.com/ervss/turbo-cr-workspace/main/turbo-library-workspace-standalone.user.js)

Created by **[ervss](https://github.com/ervss)** — **Turbo.cr Workspace** is a high-performance, standalone userscript that transforms [Turbo.cr](https://turbo.cr/library) into an ultra-responsive, cinema-widescreen media exploration and curation workspace.

This **Standalone Edition (v2.1.0)** runs **100% inside your browser**—no Chrome extension runtime, local Python server, or companion apps required.

### 🆕 What's New in v2.1.0
- 📂 **Merged Multi-Album Gallery ("Spoločný Album"):** Select multiple albums on `/library` and click the new prominent **📂 Merged Gallery (<span id="nexus-turbo-merged-count">X</span>)** button to aggregate all video files from all selected folders into a unified interactive Quick Peek gallery! Supports multi-layout switching (`3x2`, `4x3`, `2x2`, `list`), parent album tags on every video, combined search filtering, multi-video Split-Screen wall, and bulk `.M3U`/`.JSON` exports.
- 🎯 **Fixed Card Checkbox Selector & Deselection:** Resolved event capture conflicts on album card thumbnails. Clicking the top-left checkbox wrapper now reliably selects and deselects the album with visual feedback (`[✔]` badge with emerald glow) across all browsers and userscript managers without triggering link navigation.
- ⌨️ **Universal Escape Key Handler:** Pressing <kbd>Esc</kbd> now closes active modals (Quick Peek, Merged Gallery, Split-Screen, History, Help) even if an input field currently has keyboard focus.

---

## ⚡ One-Click Installation

1. Install a userscript manager extension in your browser:
   - **[Tampermonkey](https://www.tampermonkey.net/)** (Recommended for Chrome, Edge, Brave, Firefox, Safari)
   - **[Violentmonkey](https://violentmonkey.github.io/)** (Open-source alternative)
2. **[👉 Click Here to Install `turbo-library-workspace-standalone.user.js` (1-Click Raw Link)](https://raw.githubusercontent.com/ervss/turbo-cr-workspace/main/turbo-library-workspace-standalone.user.js)**
3. Confirm installation in your userscript manager. Automatic updates from GitHub are pre-configured!
4. Open [https://turbo.cr/library](https://turbo.cr/library) or any album page (`https://turbo.cr/a/...`) to start using it immediately.

---

## ✨ Key Features

### 1. Cinema Widescreen Grid (`/library`)
- Removes Turbo.cr's artificial `1152px` container limit to expand the album grid across the full browser width (`minmax(360px, 1fr)`).
- Enlarges thumbnail strips to `230px` height with sharp image scaling and hover zoom.
- Injects a fast selection checkbox and a Quick Peek eye button (`👁️`) on every card.

### 2. Multi-Page Background Scanner & Bitrate Quality Tags
- **Background Metadata Scanner:** Click **🔍 Scan Albums** to automatically fetch album contents and count videos, total size, and durations in the background.
- **Bitrate Quality Estimator:** Automatically calculates the average Mbps bitrate (`totalBits / totalDuration`) across all album files and displays luxury 2-row badges:
  - 💎 **4K UHD:** ≥ 12.0 Mbps
  - ⭐ **1080p FHD:** ≥ 3.5 Mbps
  - ⚡ **720p HD:** ≥ 1.6 Mbps
  - 📁 **480p SD:** Standard/low bitrate
- **Multi-Page Appender:** Click **➕ Next Page** or **⏩ +5** to append subsequent library pages directly into the current grid without page reload, plus optional **♾️ Infinite Scroll**.

### 3. Quick Peek Modal (`👁️`)
- Click the eye icon (`👁️`) on any album card to preview all its videos inside a full-screen modal without leaving `/library`.
- Switch dynamically between **4 layouts**: `▦ 3x2`, `▤ 4x3`, `☷ 2x2`, and `☰ List`.
- In-modal search filter, batch pagination (100 per page or Show All), individual play button (`▶`), and bulk actions.

### 4. Built-in Multi-Video Split-Screen Wall
- Select up to **12 videos** and click **📺 Split-Screen** to watch them side-by-side in an adaptive responsive grid.
- **Top Controls:** `▶ Play All`, `⏸ Pause All`, `🔇 Mute All`, and `⛶ Fullscreen`.
- **Audio Solo on Hover:** Hovering over any video tile instantly unmutes it and mutes all others for effortless browsing.

### 5. Direct Stream Resolution & Bulk Exports
- **📋 Copy Watch URLs:** Copies `https://turbo.cr/v/<id>` links for all selected albums or videos.
- **🔗 Copy Direct Streams:** Directly queries Turbo's `/api/sign?v=<id>` endpoint to resolve signed CDN `.mp4` URLs (ideal for JDownloader 2, IDM, Aria2, or `yt-dlp`).
- **🎵 Export .M3U8 Playlist:** Generates a ready-to-play `.m3u8` playlist with track titles and durations that streams directly in **VLC**, **MPV**, **IINA**, or **PotPlayer**.
- **📄 Export JSON:** Downloads complete structured metadata (titles, IDs, sizes, durations, thumbnails) for archiving.

### 6. Offline History Vault (`📜 History Vault`)
- Scanned album metadata is stored permanently in browser **IndexedDB** (`TurboWorkspaceVaultDB`).
- Reopening `/library` immediately restores all badges without re-fetching!
- Open the History Vault to browse previously scanned albums, export a full **💾 JSON Backup**, import existing archives, or delete obsolete entries.

### 7. Single Album (`/a/<id>`) & Watch Page (`/v/<id>`) Modes
- **Single Album Gallery:** Full-screen overlay gallery with search, sort, pagination, modal player, Split-Screen, and export tools.
- **Inline Metadata Enrichment:** Reads inline `const FILES` so video duration and HD thumbnails are immediately available.
- **Watch Page Action Bar:** Floating quick actions below the video player to copy direct CDN stream links, copy watch URLs, or export `.m3u8`.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>/</kbd> | Focus the search filter input |
| <kbd>Shift</kbd> + <kbd>A</kbd> | Select all visible albums / videos |
| <kbd>Shift</kbd> + <kbd>C</kbd> | Clear selection |
| <kbd>Shift</kbd> + Click | Select a continuous range between two cards |
| <kbd>S</kbd> | Start / Pause background album scanner |
| <kbd>N</kbd> | Load next library page |
| <kbd>Alt</kbd> + <kbd>←</kbd> / <kbd>→</kbd> | Previous / Next video in Modal Video Player |
| <kbd>?</kbd> | Open Shortcuts & Help modal |
| <kbd>Esc</kbd> | Close active modal dialog (Player, Peek, Split-Screen, History, Help) |

---

## 💡 Pro Tips & Tricks

1. **Stream Albums Directly in VLC / MPV Without Downloading:**
   Select the albums or videos you want, click **🎵 Export .M3U**, and open the downloaded `.m3u8` file in VLC or MPV. Your media player will stream the videos directly from the CDN with full playlist navigation!

2. **Bulk Downloading with JDownloader 2 or IDM:**
   Select your items and click **🔗 Copy Direct Streams** (or **🔗 Direct Streams** on the toolbar). The script resolves the underlying CDN `.mp4` links with a progress toast and copies them to your clipboard ready for download managers.

3. **Range Selection for Fast Curation:**
   Click the checkbox on the first item, hold <kbd>Shift</kbd>, and click the checkbox on the tenth item. All 10 items will be selected instantly.

4. **Filter by True Quality (Bitrate):**
   Filenames like "1080p" can often be misleading re-encodes. Use the **💎 Quality Tier** filter on the toolbar to filter for `💎 4K UHD (≥12 Mbps)` or `⭐ 1080p+ (≥3.5 Mbps)` based on real calculated bitrate.

5. **Backup Your Vault:**
   If you regularly scan library pages, click **📜 History** and hit **💾 Export Vault** to save a `.json` backup of all your scanned metadata. You can restore it on any browser or computer using **📂 Import Vault**.

---

## 📄 License

Released under the [MIT License](./LICENSE) by **[ervss](https://github.com/ervss)**.
