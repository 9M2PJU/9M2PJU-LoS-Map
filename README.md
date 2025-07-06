# UHF/VHF Line-of-Sight Calculator

This tool can help find locations allowing for line-of-sight communications such as UHF (70 cm) and VHF (2 meter) amateur radio, where line of sight matters more than atmospheric propagation.

This is an elevation map with other tools such as address search (geocoder) and a line drawing tool which will show the elevation changes along the line.

The website for this application is https://radiocalculator.xyz/ No signup, no ads, no BS - just loine of sight calculation.


## License and Thanks

This is released under MIT License, so you can take a copy and modify for your own use and others. Enjoy.

Thanks to:
- Github for hosting
- Leaflet for a fine map framework; Слава Україні! Героям слава!
- Esri for the topo map
- Open-Elevation for the elevation API
- OpenStreetMap for the Nominatim geocoder
- Highcharts for the charting
- And my employer, who let me use my free time for this


## Development

There is no build system, no Webpack, etc.so any web server that can serve static files will do.

```
python3 -m http.server
```

This will serve the site at http://localhost:8000

