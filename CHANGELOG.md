# Changelog

All notable changes to this project will be documented in this file.

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
