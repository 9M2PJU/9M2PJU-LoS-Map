# 📡 9M2PJU Line-of-Sight Map

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![Version](https://img.shields.io/badge/version-2.0.0-purple.svg) ![PWA](https://img.shields.io/badge/PWA-Supported-green.svg)

A modern, high-precision **UHF/VHF Line-of-Sight Calculator** designed for amateur radio operators. This tool visualizes potential signal paths between two coordinates using real-world terrain data, helping you plan links for 70cm and 2m bands.

**[🌐 LIVE APP: https://los.hamradio.my](https://los.hamradio.my)**

---

## ✨ Features

- **🎨 Modern Dark Theme**: A stunning "Deep Space" interface with glassmorphism effects, animated background orbs, and fluid animations.
- **📱 Mobile-First Design**: Fully responsive layout that adapts perfectly to phones, tablets, and desktops.
- **🚀 Installable App (PWA)**: Install it directly to your home screen! Works like a native app with offline capabilities.
- **🗺️ Interactive Map**: Drag-and-drop markers for Transmitting and Receiving locations.
- **⛰️ Elevation Profile**: Real-time terrain analysis chart powered by Highcharts.
- **📍 Smart Geocoding**: Search by address or paste coordinates directly from RepeaterBook.
- **🇲🇾 Malaysian Ham Friendly**: Default view optimized for the region, hosted by 9M2PJU.

---

## 🛠️ Technology Stack

- **Core**: HTML5, Vanilla JavaScript, CSS3 (Custom Properties)
- **Map Engine**: [Leaflet.js](https://leafletjs.com/) with Topographic Basemaps
- **Data Visualization**: [Highcharts](https://www.highcharts.com/)
- **Styling**: Bootstrap 5 + Custom Glassmorphism CSS
- **Data Source**: [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (Terrarium encoding, decoded in-browser, no API key)
- **Geocoding**: [Nominatim (OpenStreetMap)](https://nominatim.org/)

---

## 🚀 Quick Start

### Online Usage
Simply visit **[los.hamradio.my](https://los.hamradio.my)** on any device.

### Local Development
To run this project locally on your machine:

1. Clone the repository:
   ```bash
   git clone https://github.com/9M2PJU/9M2PJU-LoS-Map.git
   ```
2. Navigate to the folder:
   ```bash
   cd 9M2PJU-LoS-Map
   ```
3. Start a simple HTTP server (Python example):
   ```bash
   python -m http.server 8000
   ```
4. Open `http://localhost:8000` in your browser.

---

## 💡 How to Use

1. **Enter Locations**: Type an address or latitude,longitude for both the **Transmitter** and **Receiver**.
2. **Adjust Height**: Enter the mast height (in feet) for both points to improve accuracy.
3. **Analyze**: The map will draw a blue line between the points.
   - **Green/Blue Chart**: Shows the terrain profile.
   - **Warning**: If the path is blocked by terrain, you'll see a warning message.
4. **RepeaterBook Trick**: You can paste RepeaterBook console coordinates directly into the search box! (See the "How to" section in the app).

---

## 📜 Credits & License

**Redesigned & Maintained by [9M2PJU](https://hamradio.my)** 🇲🇾

Based on the original work by **[Greg Allensworth](https://github.com/gregallensworth/ham-uhfvhf-map)**.

Distributed under the **MIT License**. See `LICENSE` for more information.
