# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### 🔧 Fixes
- **Elevation profile restored**: replaced the dead browser elevation APIs (open-elevation returns 429 quota errors, opentopodata responses are blocked by CORS so the chart stayed blank) with AWS Terrain Tiles decoded in-browser. No API key needed.
- **Visible error state**: if terrain data cannot be fetched, the chart area now says so with a retry hint instead of staying blank. The status badge tap-to-retry still applies.
- **Clear resets chart**: clearing Tx/Rx now also clears the rendered profile instead of leaving a stale chart behind.
- Moved `index.js` to load with `defer` and bumped the service worker cache so returning visitors pick up the new code.

## [2.0.0] - 2026-01-21

### ✨ New Features
- **Modern UI Redesign**: Completely overhauled the interface with a "fancy" deep-space dark theme, featuring animated floating orbs and glassmorphism cards.
- **Progressive Web App (PWA)**: Added `manifest.json` and Service Worker support. The app is now installable on mobile and desktop devices and works offline.
- **Mobile Optimization**: Implemented a responsive, mobile-first design. Cards stack vertically on smaller screens, and tap targets are optimized for touch.
- **Footer**: Added attribution footer "Redesign by 9M2PJU 🇲🇾".
- **Typography**: Integrated 'Outfit' and 'Inter' Google Fonts for a modern, clean look.

### ⚡ Improvements
- **Performance**: Added cache-busting strategies (`v=2.0`) to ensure users always see the latest version.
- **Map Experience**: Optimized map container height for mobile devices to prevent layout issues.
- **Accessibility**: Improved contrast and readability with the new color palette.

### 🔧 Fixes
- Removed inline styles in favor of a clean, external CSS stylesheet.
- Fixed Highcharts theming to match the new dark mode aesthetic.
- Removed broken or outdated links.

---

## [1.0.0] - 2017-06-25
- Original release by Greg Allensworth.
- Basic Line-of-Sight calculation using Google Maps/Leaflet and Open-Elevation API.
