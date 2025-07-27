# 9M2PJU Line-of-Sight Map

This is a UHF/VHF Line-of-Sight Calculator designed for amateur radio operators, particularly those working on the 70 cm and 2 meter bands. It helps identify potential line-of-sight paths between two locations, where terrain and elevation play a more critical role than atmospheric conditions.

This tool features:
- Elevation profile mapping along a path
- Geocoding (address/coordinates search)
- Interactive line drawing
- Clean, ad-free interface
- Fully responsive dark mode design
- Optimized for mobile and desktop browsers

🌐 Live version: [https://los.hamradio.my](https://los.hamradio.my)  
No signup. No ads. No nonsense — just effective line-of-sight calculation.

---

## 🔧 Modifications by 9M2PJU

This fork includes the following enhancements:

- ✅ **Dark Mode UI** using Bootstrap 5.3 with a mobile-first layout  
- ✅ **SEO meta tags** for better discoverability  
- ✅ **Improved Highcharts theme** for dark elevation profiles  
- ✅ **Responsive layout** for phones, tablets, and desktops  
- ✅ **Clean UI structure** using cards, form controls, and spacing improvements  
- ✅ **Malay & international ham operator friendly** usage  
- ✅ **Hosted on a Malaysian ham radio domain** for regional convenience  

---

## 📄 License and Acknowledgements

This project is released under the **MIT License**, so you're free to copy, modify, and redistribute it.

### Special Thanks:

- 👨‍💻 **Original Developer:** [Greg Allensworth](https://github.com/gregallensworth/ham-uhfvhf-map) — for creating the base project this was built upon. Without his solid groundwork, this tool wouldn’t exist.  
- 🗺️ [Leaflet](https://leafletjs.com/) – for the map interface  
- 🌍 [Esri](https://www.esri.com/) – for the topographic basemap  
- 🏔️ [Open-Elevation](https://open-elevation.com/) – for elevation API  
- 🧭 [OpenStreetMap Nominatim](https://nominatim.org/) – for geocoding/search  
- 📈 [Highcharts](https://www.highcharts.com/) – for the elevation profile chart  

---

## ⚙️ Development

There’s no build system or dependency manager required. Any basic web server will do.

To run locally:

```bash
python3 -m http.server
````

Then open in your browser:

```
http://localhost:8000
```

---

Enjoy exploring UHF/VHF terrain like never before!

