let MAP;

const MAPSTART_LAT = 0; // 37.80;
const MAPSTART_LNG = 0; // -98.50;
const MAPSTART_ZOOM = 2; // 4.00;

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

    //
    // basic setup of the map and the drag markers
    //

    MAP = L.map('map').setView([MAPSTART_LAT, MAPSTART_LNG], MAPSTART_ZOOM);

    MAP.basemap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
	    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community'
    }).addTo(MAP);

    MAP.xmarker = L.marker([0, 0], {
        title: "Transmitting location",
        draggable: true,
    });
    MAP.rmarker = L.marker([0, 0], {
        title: "Receiving location",
        draggable: true,
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
        $xaddr_input.val(`${lat},${lng}`).change();
    });
    MAP.rmarker.on('dragend', function () {
        const lat = this.getLatLng().lat;
        const lng = this.getLatLng().lng;
        $raddr_input.val(`${lat},${lng}`).change();
    });

    MAP.lineofsight = L.polyline([[0, 0], [0, 0]], {
        color: 'darkblue',
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

    $xaddr_go.click(function () {
        const address = $xaddr_input.val().trim();
        if (! address) return;

        // if it looks like coordinates, skip geocoding; just trigger change()
        if (address.match(LOOKS_LIKE_COORDS)) return $xaddr_input.change();

        // geocode, fill in coordinates, then trigger change()
        geocodeAddress(address, function (resultlist) {
            if (! resultlist || ! resultlist.length) return alert("Could not find that address.");

            const lat = parseFloat(resultlist[0].lat);
            const lng = parseFloat(resultlist[0].lon);
            $xaddr_input.val(`${lat},${lng}`).change();
        });
    });
    $raddr_go.click(function () {
        const address = $raddr_input.val().trim();
        if (! address) return;

        // if it looks like coordinates, skip geocoding; just trigger change()
        if (address.match(LOOKS_LIKE_COORDS)) return $raddr_input.change();

        // geocode, fill in coordinates, then trigger change()
        geocodeAddress(address, function (resultlist) {
            if (! resultlist || ! resultlist.length) return alert("Could not find that address.");

            const lat = parseFloat(resultlist[0].lat);
            const lng = parseFloat(resultlist[0].lon);
            $raddr_input.val(`${lat},${lng}`).change();
        });
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
			$xheight.val(coords[4]);
			$rheight.val(coords[5]);
        	$xaddr_input.val(`${coords[0]},${coords[1]}`).change();
            $raddr_input.val(`${coords[2]},${coords[3]}`).change();
        }
    }
});


function geocodeAddress (address, successcallback) {
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
    MAP.fitBounds(MAP.lineofsight.getBounds().pad(0.2));
}


function updateReadouts () {
    const xlatlng = MAP.xmarker.getLatLng();
    const rlatlng = MAP.rmarker.getLatLng();
    const xlat = xlatlng.lat;
    const xlng = xlatlng.lng;
    const rlat = rlatlng.lat;
    const rlng = rlatlng.lng;
    const xheight = parseInt($('input[name="xheight"]').val());
    const rheight = parseInt($('input[name="rheight"]').val());

    const $readouts = $('#readouts');
    $readouts.removeClass('d-none');

    // the elevation points are asynchronous
    // fetch the list of the first point (transmitter) and last point (receiver)
    // plus X points in between, to form the elevation profile
    // thank you, Open-Elevation!

    // generate X points along the straight line; a list of [[lat,lng,distance], [lat,lng,distance], [lat,lng,distance]...]
    // the lat,lng will be for elevation (Y axis) and distance along the line will form the X axis
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
            // now to display results!
            // response.results is a set of {latitude, longitude, elevation} objects

			// add xheight and rheight to the first and last points
			// elevation is meters, inputs are feet
			response.results[0].elevation += (xheight * FEET2METERS);
			response.results[response.results.length - 1].elevation += (rheight * FEET2METERS);

            // the distance and bearing can be had from the LatLng themselves
            // don't need the API for these, but this is where we're doing the readouts
            const distance_km = xlatlng.distanceTo(rlatlng) / 1000.0;
            const distance_mi = xlatlng.distanceTo(rlatlng) / 1609.34;
            const bearing_deg = xlatlng.bearingTo(rlatlng);
            const bearing_txt = xlatlng.bearingWordTo(rlatlng);

            $readouts.find('span[data-readout="distance_km"]').text(distance_km.toFixed(1));
            $readouts.find('span[data-readout="distance_mi"]').text(distance_mi.toFixed(1));
            $readouts.find('span[data-readout="bearing_deg"]').text(bearing_deg);
            $readouts.find('span[data-readout="bearing_txt"]').text(bearing_txt);

            // the first and last point are the transmitter and the receiver
            // get their elevation, calculate the horizon distance, and fill those in to the slots
            const transmit_elevation_m = response.results[0].elevation;
            const transmit_elevation_ft = Math.round(response.results[0].elevation / 0.3048);
            const receive_elevation_m = response.results[response.results.length - 1].elevation;
            const receive_elevation_ft = Math.round(response.results[response.results.length - 1].elevation / 0.3048);

            const pyth1 = Math.pow(transmit_elevation_m + 6378137, 2) - 40680631590769;
            const pyth2 = Math.pow(receive_elevation_m + 6378137, 2) - 40680631590769;
            const horizon_km = ((Math.sqrt(pyth1) + Math.sqrt(pyth2)) / 1000.0).toFixed(1);
            const horizon_mi = ((Math.sqrt(pyth1) + Math.sqrt(pyth2)) / 1609.34).toFixed(1);

            $readouts.find('span[data-readout="transmit_elevation_m"]').text(Math.round(transmit_elevation_m));
            $readouts.find('span[data-readout="transmit_elevation_ft"]').text(transmit_elevation_ft);
            $readouts.find('span[data-readout="receive_elevation_m"]').text(Math.round(receive_elevation_m));
            $readouts.find('span[data-readout="receive_elevation_ft"]').text(receive_elevation_ft);
            $readouts.find('span[data-readout="horizon_mi"]').text(horizon_mi);
            $readouts.find('span[data-readout="horizon_km"]').text(horizon_km);

            const $insufficienthorizon = $('#insufficienthorizon');
            if (distance_km > horizon_km) $insufficienthorizon.removeClass('d-none');
            else $insufficienthorizon.addClass('d-none');

            // remap the result points to Highcharts-compatible dicts with a "y" attribute for the chart and other attributes for tooltips
            const chartpoints = response.results.map((point, i) => {
                return {
                    y: point.elevation,
                    lat: point.latitude,
                    lng: point.longitude,
                    distance_km: (i * lenstep / 1000.0).toFixed(1),
                    distance_mi: (i * lenstep / 1609.43).toFixed(1),
                    elevation_ft: Math.round(point.elevation / 0.3048),
                    elevation_m: Math.round(point.elevation),
                };
            });

            // hand off to Highcharts
            Highcharts.setOptions({
                plotOptions: {
                    series: {
                        animation: false,
                    },
                },
            });

            Highcharts.chart('elevationprofile', {
                chart: {
                    type: 'area',
                },
                title: {
                    text: "",
                },
                yAxis: {
                    visible: false,
                },
                xAxis: {
                    visible: false,
                },
                legend: {
                    enabled: false,
                },
                tooltip: {
                    formatter: function () {
						// side effect, map tooltip; see also mouseOut handler
						MAP.tooltip.setLatLng([this.point.lat, this.point.lng]).setContent(`<strong>Distance:</strong> ${this.point.options.distance_mi} miles, ${this.point.options.distance_km} kilometers<br/><strong>Elevation:</strong> ${this.point.options.elevation_ft} feet, ${this.point.options.elevation_m} meters`).addTo(MAP);

                        return `<strong>Distance:</strong> ${this.point.options.distance_mi} miles, ${this.point.options.distance_km} kilometers<br/><strong>Elevation:</strong> ${this.point.options.elevation_ft} feet, ${this.point.options.elevation_m} meters`;
                    },
                },
                plotOptions: {
                    area: {
                        marker: {
                            enabled: false,
                        },
                    },
                },
                series: [
                    {
                    	data: chartpoints,
                    	events: {
                    		mouseOut: function (event) {  // clear map tooltip, see also tooltip formatter
								MAP.tooltip.setLatLng([0, 0]).removeFrom(MAP);
                    		},
                    	},
                    },
                ],
            });
        },
    });
}


function updateAddressBar () {
    const xlatlng = MAP.xmarker.getLatLng();
    const rlatlng = MAP.rmarker.getLatLng();
    const xlat = xlatlng.lat;
    const xlng = xlatlng.lng;
    const rlat = rlatlng.lat;
    const rlng = rlatlng.lng;
    const xheight = $('input[name="xheight"]').val();
    const rheight = $('input[name="rheight"]').val();

    document.location.hash = `${xlat},${xlng},${rlat},${rlng},${xheight},${rheight}`;
}

