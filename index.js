let MAP;
let txUnit = 'ft';
let rxUnit = 'ft';

const MAPSTART_LAT = 3.1390; // Default to Malaysia (KL) center for 9M2PJU context
const MAPSTART_LNG = 101.6869;
const MAPSTART_ZOOM = 8;

const MAP_MAX_ZOOM = 18;

const LOOKS_LIKE_COORDS = /^(\-?\d+\.\d+)\s*,(\s*\-?\d+\.\d+)$/;

const FEET2METERS = 0.3048;

// add to Leaflet LatLng the calculation of a compass heading
L.LatLng.prototype.bearingTo = function(LatLng) {
    let d2r  = Math.PI / 180;
    let r2d  = 180 / Math.PI;
    let lat1 = this.lat * d2r;
    let lat2 = LatLng.lat * d2r;
    let dLon = (LatLng.lng-this.lng) * d2r;
    let y    = Math.sin(dLon) * Math.cos(lat2);
    let x    = Math.cos(lat1)*Math.sin(lat2) - Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon);
    return (parseInt( Math.atan2(y, x) * r2d ) + 360 ) % 360;
};

L.LatLng.prototype.bearingWordTo = function (other) {
    var bearing = this.bearingTo(other);
    var bearingword = '';
    if (bearing >= 22  && bearing <= 67)  bearingword = 'Northeast';
    else if (bearing >= 67 && bearing <= 112)  bearingword = 'East';
    else if (bearing >= 112 && bearing <= 157) bearingword = 'Southeast';
    else if (bearing >= 157 && bearing <= 202) bearingword = 'South';
    else if (bearing >= 202 && bearing <= 247) bearingword = 'Southwest';
    else if (bearing >= 247 && bearing <= 292) bearingword = 'West';
    else if (bearing >= 292 && bearing <= 337) bearingword = 'Northwest';
    else if (bearing >= 337 || bearing <= 22)  bearingword = 'North';
    return bearingword;
};

$(document).ready(function () {
    const $form = $('#searchform');
    const $xaddr_input = $form.find('input[name="xaddr"]');
    const $raddr_input = $form.find('input[name="raddr"]');
    const $xaddr_go = $form.find('button[name="xsearchgo"]');
    const $raddr_go = $form.find('button[name="rsearchgo"]');
    const $xheight = $('input[name="xheight"]');
    const $rheight = $('input[name="rheight"]');
    
    const $xlocate = $form.find('button[name="xlocate"]');
    const $rlocate = $form.find('button[name="rlocate"]');
    const $btnSwap = $('#btn-swap');

    //
    // basic setup of the map and the drag markers
    //

    MAP = L.map('map').setView([MAPSTART_LAT, MAPSTART_LNG], MAPSTART_ZOOM);

    MAP.basemap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
	    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community'
    }).addTo(MAP);

    // Custom pulsing marker icons
    const txIcon = L.divIcon({
        className: 'custom-marker marker-tx',
        html: '<div class="marker-pulse"></div><div class="marker-pin"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
    });

    const rxIcon = L.divIcon({
        className: 'custom-marker marker-rx',
        html: '<div class="marker-pulse"></div><div class="marker-pin"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
    });

    MAP.xmarker = L.marker([0, 0], {
        title: "Transmitting location",
        draggable: true,
        icon: txIcon
    });
    MAP.rmarker = L.marker([0, 0], {
        title: "Receiving location",
        draggable: true,
        icon: rxIcon
    });

    MAP.xmarker.on('drag', function () {
        hideLineOfSight();
    });
    MAP.rmarker.on('drag', function () {
        hideLineOfSight();
    });
    MAP.xmarker.on('dragend', function () {
        const lat = this.getLatLng().lat;
        const lng = this.getLatLng().lng;
        $xaddr_input.val(`${lat.toFixed(6)},${lng.toFixed(6)}`).change();
    });
    MAP.rmarker.on('dragend', function () {
        const lat = this.getLatLng().lat;
        const lng = this.getLatLng().lng;
        $raddr_input.val(`${lat.toFixed(6)},${lng.toFixed(6)}`).change();
    });

    MAP.lineofsight = L.polyline([[0, 0], [0, 0]], {
        color: 'darkblue',
        weight: 4,
        opacity: 0.8
    });

	MAP.tooltip = L.tooltip();

    //
    // address search; position & add the markers
    //

    $xaddr_input.change(function () {
        const address = $xaddr_input.val().trim();
        const coordbits = address.match(LOOKS_LIKE_COORDS);
        if (! coordbits) return;  // change() is to shift the marker, but only if the input looks like coordinates

        const lat = parseFloat(coordbits[1]);
        const lng = parseFloat(coordbits[2]);
        placeTransmitMarker(lat, lng);
    });
    $raddr_input.change(function () {
        const address = $raddr_input.val().trim();
        const coordbits = address.match(LOOKS_LIKE_COORDS);
        if (! coordbits) return;  // change() is to shift the marker, but only if the input looks like coordinates

        const lat = parseFloat(coordbits[1]);
        const lng = parseFloat(coordbits[2]);
        placeReceiveMarker(lat, lng);
    });

    $xaddr_input.keyup(function (event) {
        if (event.key == 'Enter') $xaddr_go.click();
    });
    $raddr_input.keyup(function (event) {
        if (event.key == 'Enter') $raddr_go.click();
    });
    $xheight.keyup(function (event) {
        if (event.key == 'Enter') $xaddr_go.click();
    });
    $rheight.keyup(function (event) {
        if (event.key == 'Enter') $raddr_go.click();
    });
    $xheight.change(function (event) {
        $xaddr_input.change();
    });
    $rheight.change(function (event) {
        $raddr_input.change();
    });

    // Loading indicator helper
    function toggleSearchLoading(buttonName, isLoading) {
        const $btn = $form.find(`button[name="${buttonName}"]`);
        if (isLoading) {
            $btn.html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>');
            $btn.prop('disabled', true);
        } else {
            $btn.text('Find');
            $btn.prop('disabled', false);
        }
    }

    $xaddr_go.click(function () {
        const address = $xaddr_input.val().trim();
        if (! address) return;

        // if it looks like coordinates, skip geocoding; just trigger change()
        if (address.match(LOOKS_LIKE_COORDS)) return $xaddr_input.change();

        toggleSearchLoading('xsearchgo', true);
        geocodeAddress(address, function (resultlist) {
            toggleSearchLoading('xsearchgo', false);
            if (! resultlist || ! resultlist.length) return alert("Could not find that address.");

            const lat = parseFloat(resultlist[0].lat);
            const lng = parseFloat(resultlist[0].lon);
            $xaddr_input.val(`${lat.toFixed(6)},${lng.toFixed(6)}`).change();
        }, function() {
            toggleSearchLoading('xsearchgo', false);
            alert("Error connecting to geocoding service.");
        });
    });

    $raddr_go.click(function () {
        const address = $raddr_input.val().trim();
        if (! address) return;

        // if it looks like coordinates, skip geocoding; just trigger change()
        if (address.match(LOOKS_LIKE_COORDS)) return $raddr_input.change();

        toggleSearchLoading('rsearchgo', true);
        geocodeAddress(address, function (resultlist) {
            toggleSearchLoading('rsearchgo', false);
            if (! resultlist || ! resultlist.length) return alert("Could not find that address.");

            const lat = parseFloat(resultlist[0].lat);
            const lng = parseFloat(resultlist[0].lon);
            $raddr_input.val(`${lat.toFixed(6)},${lng.toFixed(6)}`).change();
        }, function() {
            toggleSearchLoading('rsearchgo', false);
            alert("Error connecting to geocoding service.");
        });
    });

    // Locate Me (GPS) features
    function handleLocate(inputEl) {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser.");
            return;
        }
        
        const $btn = $(this);
        const originalText = $btn.text();
        $btn.html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>');
        $btn.prop('disabled', true);
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                inputEl.val(`${lat.toFixed(6)},${lng.toFixed(6)}`).change();
                $btn.text(originalText);
                $btn.prop('disabled', false);
            },
            (error) => {
                alert("Unable to retrieve location: " + error.message);
                $btn.text(originalText);
                $btn.prop('disabled', false);
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
    }

    $xlocate.click(function() {
        handleLocate.call(this, $xaddr_input);
    });

    $rlocate.click(function() {
        handleLocate.call(this, $raddr_input);
    });

    // Swap locations
    $btnSwap.click(function() {
        const txAddr = $xaddr_input.val();
        const rxAddr = $raddr_input.val();
        const txHeight = $xheight.val();
        const rxHeight = $rheight.val();

        // Swap heights
        $xheight.val(rxHeight);
        $rheight.val(txHeight);

        // Swap unit state variables
        const tempUnit = txUnit;
        txUnit = rxUnit;
        rxUnit = tempUnit;

        // Update dropdown active visuals
        setUnitVisual('x', txUnit);
        setUnitVisual('r', rxUnit);

        // Swap input values and trigger updates
        $xaddr_input.val(rxAddr);
        $raddr_input.val(txAddr);

        $xaddr_input.change();
        $raddr_input.change();
    });

    // Unit toggle helpers
    function setUnitVisual(type, targetUnit) {
        const $toggle = type === 'x' ? $('#xunit-toggle') : $('#runit-toggle');
        const $items = type === 'x' ? $('.xunit-select') : $('.runit-select');
        const $input = type === 'x' ? $xheight : $rheight;

        $items.removeClass('active');
        $items.filter(`[data-unit="${targetUnit}"]`).addClass('active');
        $toggle.text(targetUnit);

        if (targetUnit === 'm') {
            $input.attr('max', Math.round(500 * FEET2METERS));
        } else {
            $input.attr('max', 500);
        }
    }

    function toggleUnit(type, targetUnit) {
        const currentUnit = type === 'x' ? txUnit : rxUnit;
        if (currentUnit === targetUnit) return;

        const $input = type === 'x' ? $xheight : $rheight;
        let val = parseFloat($input.val()) || 0;

        if (targetUnit === 'm') {
            val = Math.round(val * FEET2METERS);
        } else {
            val = Math.round(val / FEET2METERS);
        }

        $input.val(val);

        if (type === 'x') {
            txUnit = targetUnit;
        } else {
            rxUnit = targetUnit;
        }

        setUnitVisual(type, targetUnit);
    }

    $('.xunit-select').click(function (e) {
        e.preventDefault();
        toggleUnit('x', $(this).attr('data-unit'));
        $xaddr_input.change();
    });

    $('.runit-select').click(function (e) {
        e.preventDefault();
        toggleUnit('r', $(this).attr('data-unit'));
        $raddr_input.change();
    });

    // Invalidate Leaflet size when window resizes to keep map full-bleed
    $(window).on('resize', function() {
        if (MAP) {
            MAP.invalidateSize();
        }
    });

    //
    // if there is a hash with xlat,xlng,rlat,rlng then fill the search boxes and submit them now
    // yeah, you can share a line just by sharing the URL
    //

    if (document.location.hash) {
        const coords = document.location.hash.replace(/^#/, '').split(',').map(i => parseFloat(i));
        if (coords.length == 4 && !isNaN(coords[0]) && !isNaN(coords[1]) && !isNaN(coords[2]) && !isNaN(coords[3])) {
            $xaddr_input.val(`${coords[0]},${coords[1]}`).change();
            $raddr_input.val(`${coords[2]},${coords[3]}`).change();
        }
        else if (coords.length == 6 && !isNaN(coords[0]) && !isNaN(coords[1]) && !isNaN(coords[2]) && !isNaN(coords[3]) && !isNaN(coords[4]) && !isNaN(coords[5])) {
            // Initial hash values are always stored in feet
            txUnit = 'ft';
            rxUnit = 'ft';
            setUnitVisual('x', 'ft');
            setUnitVisual('r', 'ft');
			$xheight.val(coords[4]);
			$rheight.val(coords[5]);
        	$xaddr_input.val(`${coords[0]},${coords[1]}`).change();
            $raddr_input.val(`${coords[2]},${coords[3]}`).change();
        }
    }
});


function geocodeAddress (address, successcallback, errorcallback) {
    $.ajax({
        url: 'https://nominatim.openstreetmap.org/search',
        'data': {
            q: address,
            format: 'json',
            limit: 1,
        },
        dataType: 'jsonp',
        jsonp: 'json_callback',
        success: successcallback,
        error: errorcallback,
        timeout: 8000,
        crossDomain: true
    });
}


function placeTransmitMarker (lat, lng) {
    MAP.xmarker.setLatLng([lat, lng]).addTo(MAP);
    if (MAP.hasLayer(MAP.xmarker) && MAP.hasLayer(MAP.rmarker)) updateTheLine();
}


function placeReceiveMarker (lat, lng) {
    MAP.rmarker.setLatLng([lat, lng]).addTo(MAP);
    if (MAP.hasLayer(MAP.xmarker) && MAP.hasLayer(MAP.rmarker)) updateTheLine();
}


function hideLineOfSight () {
    MAP.lineofsight.removeFrom(MAP);
}


function updateTheLine () {
    placeLineOfSight();
    updateReadouts();
    updateAddressBar();
}


function placeLineOfSight () {
    const points = [
        MAP.xmarker.getLatLng(),
        MAP.rmarker.getLatLng()
    ];
    MAP.lineofsight.setLatLngs(points).addTo(MAP);
    MAP.fitBounds(MAP.lineofsight.getBounds().pad(0.25));
}


function updateReadouts () {
    const xlatlng = MAP.xmarker.getLatLng();
    const rlatlng = MAP.rmarker.getLatLng();
    const xlat = xlatlng.lat;
    const xlng = xlatlng.lng;
    const rlat = rlatlng.lat;
    const rlng = rlatlng.lng;
    
    const xheight_input = parseInt($('input[name="xheight"]').val()) || 0;
    const rheight_input = parseInt($('input[name="rheight"]').val()) || 0;

    // Convert mast height input values to meters for calculation
    const xheight_m = txUnit === 'ft' ? (xheight_input * FEET2METERS) : xheight_input;
    const rheight_m = rxUnit === 'ft' ? (rheight_input * FEET2METERS) : rheight_input;

    const $readouts = $('#readouts');
    $readouts.removeClass('d-none');

    // Update status badge UI to calculating
    const $statusText = $('#los-status-text');
    const $statusContainer = $('#los-status-container');
    $statusContainer.removeClass('los-clear los-blocked').addClass('los-calculating');
    $statusText.text('Calculating...');

    // generate 50 points along the line
    const howmanypoints = 50;
    const totalmeters = xlatlng.distanceTo(rlatlng);

    const points = [];
    const latstep = (rlat - xlat) / howmanypoints;
    const lngstep = (rlng - xlng) / howmanypoints;
    const lenstep = totalmeters / howmanypoints;  // meters

    points.push([xlat, xlng, 0]);
    for (let i = 1; i <= howmanypoints; i++) {
        const lat = xlat + (i * latstep);
        const lng = xlng + (i * lngstep);
        const m = lenstep * i;
        points.push([lat, lng, m]);
    }

    $.ajax({
        url: 'https://api.open-elevation.com/api/v1/lookup',
        'data': {
            locations: points.map(p => `${p[0]},${p[1]}`).join('|'),
        },
        success: function (response) {
            if (!response || !response.results || response.results.length === 0) {
                $statusContainer.removeClass('los-calculating').addClass('bg-secondary');
                $statusText.text('Elevation Error');
                return;
            }

            // Ground elevations
            const tx_ground_m = response.results[0].elevation;
            const rx_ground_m = response.results[response.results.length - 1].elevation;

            // Total elevations (ground + mast)
            const transmit_total_m = tx_ground_m + xheight_m;
            const receive_total_m = rx_ground_m + rheight_m;

            // Distance and bearing calculations
            const distance_km = totalmeters / 1000.0;
            const distance_mi = totalmeters / 1609.34;
            const bearing_deg = xlatlng.bearingTo(rlatlng);
            const bearing_txt = xlatlng.bearingWordTo(rlatlng);

            $readouts.find('span[data-readout="distance_km"]').text(distance_km.toFixed(1));
            $readouts.find('span[data-readout="distance_mi"]').text(distance_mi.toFixed(1));
            $readouts.find('span[data-readout="bearing_deg"]').text(bearing_deg);
            $readouts.find('span[data-readout="bearing_txt"]').text(bearing_txt);

            // Horizon distance calculation based on total antenna height
            const pyth1 = Math.pow(transmit_total_m + 6378137, 2) - 40680631590769;
            const pyth2 = Math.pow(receive_total_m + 6378137, 2) - 40680631590769;
            const horizon_km = ((Math.sqrt(pyth1) + Math.sqrt(pyth2)) / 1000.0).toFixed(1);
            const horizon_mi = ((Math.sqrt(pyth1) + Math.sqrt(pyth2)) / 1609.34).toFixed(1);

            $readouts.find('span[data-readout="transmit_elevation_m"]').text(Math.round(tx_ground_m));
            $readouts.find('span[data-readout="transmit_elevation_ft"]').text(Math.round(tx_ground_m / FEET2METERS));
            $readouts.find('span[data-readout="receive_elevation_m"]').text(Math.round(rx_ground_m));
            $readouts.find('span[data-readout="receive_elevation_ft"]').text(Math.round(rx_ground_m / FEET2METERS));
            $readouts.find('span[data-readout="horizon_mi"]').text(horizon_mi);
            $readouts.find('span[data-readout="horizon_km"]').text(horizon_km);

            const $insufficienthorizon = $('#insufficienthorizon');
            if (distance_km > horizon_km) $insufficienthorizon.removeClass('d-none');
            else $insufficienthorizon.addClass('d-none');

            // Physical Line of Sight intersection check
            let isBlocked = false;
            const totalPoints = response.results.length;

            for (let i = 1; i < totalPoints - 1; i++) {
                // Interpolate LoS height at this fraction of the path
                const fraction = i / (totalPoints - 1);
                const los_height_at_point = transmit_total_m + (receive_total_m - transmit_total_m) * fraction;
                
                // If terrain is higher than the line of sight line
                if (response.results[i].elevation > los_height_at_point) {
                    isBlocked = true;
                    break;
                }
            }

            // Update status badge UI
            if (isBlocked) {
                $statusContainer.removeClass('los-calculating los-clear').addClass('los-blocked');
                $statusText.text('❌ Blocked by Terrain');
                MAP.lineofsight.setStyle({ color: '#ff4466' }); // Red polyline
            } else {
                $statusContainer.removeClass('los-calculating los-blocked').addClass('los-clear');
                $statusText.text('✅ Clear Line-of-Sight');
                MAP.lineofsight.setStyle({ color: '#00ff88' }); // Green polyline
            }

            // Prepare chart points
            const terrainPoints = response.results.map((point, i) => {
                return {
                    x: i * lenstep / 1000.0,
                    y: point.elevation,
                    lat: point.latitude,
                    lng: point.longitude,
                    distance_km: (i * lenstep / 1000.0).toFixed(1),
                    distance_mi: (i * lenstep / 1609.43).toFixed(1),
                    elevation_ft: Math.round(point.elevation / FEET2METERS),
                    elevation_m: Math.round(point.elevation),
                };
            });

            const losPoints = response.results.map((point, i) => {
                const fraction = i / (response.results.length - 1);
                const losVal = transmit_total_m + (receive_total_m - transmit_total_m) * fraction;
                return {
                    x: i * lenstep / 1000.0,
                    y: losVal,
                    distance_km: (i * lenstep / 1000.0).toFixed(1),
                    distance_mi: (i * lenstep / 1609.43).toFixed(1),
                    elevation_ft: Math.round(losVal / FEET2METERS),
                    elevation_m: Math.round(losVal)
                };
            });

            // Initialize Highcharts
            Highcharts.setOptions({
                plotOptions: {
                    series: {
                        animation: false,
                    },
                },
            });

            Highcharts.chart('elevationprofile', {
                chart: {
                    backgroundColor: 'transparent',
                    style: {
                        fontFamily: 'Inter, sans-serif'
                    },
                    marginRight: 10,
                    spacingBottom: 5
                },
                title: {
                    text: null
                },
                xAxis: {
                    title: {
                        text: 'Distance (km)',
                        style: { color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.8rem' }
                    },
                    labels: { style: { color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.75rem' } },
                    lineColor: 'rgba(255, 255, 255, 0.1)',
                    tickColor: 'rgba(255, 255, 255, 0.1)'
                },
                yAxis: {
                    title: {
                        text: 'Elevation (m)',
                        style: { color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.8rem' }
                    },
                    labels: { style: { color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.75rem' } },
                    gridLineColor: 'rgba(255, 255, 255, 0.05)',
                    lineColor: 'rgba(255, 255, 255, 0.1)',
                    tickColor: 'rgba(255, 255, 255, 0.1)'
                },
                legend: {
                    enabled: true,
                    itemStyle: { color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.8rem' }
                },
                credits: {
                    enabled: false
                },
                tooltip: {
                    shared: true,
                    backgroundColor: 'rgba(15, 12, 41, 0.95)',
                    borderColor: 'rgba(0, 212, 255, 0.3)',
                    style: { color: '#ffffff' },
                    formatter: function () {
                        const terrainPoint = this.points.find(p => p.series.name === 'Terrain').point;
                        const losPoint = this.points.find(p => p.series.name === 'Line of Sight').point;
                        
                        if (terrainPoint) {
                            MAP.tooltip.setLatLng([terrainPoint.lat, terrainPoint.lng])
                                .setContent(`<strong>Distance:</strong> ${terrainPoint.options.distance_km} km (${terrainPoint.options.distance_mi} mi)<br/>
                                             <strong>Terrain:</strong> ${terrainPoint.options.elevation_m} m (${terrainPoint.options.elevation_ft} ft)<br/>
                                             <strong>LoS Path:</strong> ${losPoint ? losPoint.options.elevation_m : 0} m (${losPoint ? losPoint.options.elevation_ft : 0} ft)`)
                                .addTo(MAP);
                        }

                        let text = `<strong>Distance:</strong> ${terrainPoint.options.distance_km} km (${terrainPoint.options.distance_mi} mi)<br/>`;
                        text += `<span style="color:#7b2cbf">\u25CF</span> Terrain: <b>${terrainPoint.options.elevation_m} m</b> (${terrainPoint.options.elevation_ft} ft)<br/>`;
                        if (losPoint) {
                            const color = isBlocked ? '#ff4466' : '#00ff88';
                            text += `<span style="color:${color}">\u25CF</span> LoS Path: <b>${losPoint.options.elevation_m} m</b> (${losPoint.options.elevation_ft} ft)`;
                        }
                        return text;
                    }
                },
                series: [
                    {
                        name: 'Terrain',
                        type: 'area',
                        data: terrainPoints,
                        color: '#7b2cbf',
                        fillColor: {
                            linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
                            stops: [
                                [0, 'rgba(123, 44, 191, 0.45)'],
                                [1, 'rgba(15, 12, 41, 0.05)']
                            ]
                        },
                        lineWidth: 2,
                        marker: { enabled: false },
                        events: {
                            mouseOut: function () {
                                MAP.tooltip.setLatLng([0, 0]).removeFrom(MAP);
                            }
                        }
                    },
                    {
                        name: 'Line of Sight',
                        type: 'line',
                        data: losPoints,
                        color: isBlocked ? '#ff4466' : '#00ff88',
                        lineWidth: 3,
                        dashStyle: 'Dash',
                        marker: { enabled: false },
                        events: {
                            mouseOut: function () {
                                MAP.tooltip.setLatLng([0, 0]).removeFrom(MAP);
                            }
                        }
                    }
                ]
            });
        },
        error: function() {
            $statusContainer.removeClass('los-calculating').addClass('bg-secondary');
            $statusText.text('Elevation Offline');
        }
    });
}


function updateAddressBar () {
    const xlatlng = MAP.xmarker.getLatLng();
    const rlatlng = MAP.rmarker.getLatLng();
    const xlat = xlatlng.lat;
    const xlng = xlatlng.lng;
    const rlat = rlatlng.lat;
    const rlng = rlatlng.lng;
    
    // Store height in feet in hash for backward compatibility
    const xheight_input = parseInt($('input[name="xheight"]').val()) || 0;
    const rheight_input = parseInt($('input[name="rheight"]').val()) || 0;

    const xheight_ft = txUnit === 'm' ? Math.round(xheight_input / FEET2METERS) : xheight_input;
    const rheight_ft = rxUnit === 'm' ? Math.round(rheight_input / FEET2METERS) : rheight_input;

    document.location.hash = `${xlat},${xlng},${rlat},${rlng},${xheight_ft},${rheight_ft}`;
}


