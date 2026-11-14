let MAP;
let txUnit = 'ft';
let rxUnit = 'ft';

const MAPSTART_LAT = 3.1390; // Default to Malaysia (KL) center for 9M2PJU context
const MAPSTART_LNG = 101.6869;
const MAPSTART_ZOOM = 8;

const MAP_MAX_ZOOM = 18;

const BASE_MAPS = {
    'Topographic': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community',
        maxZoom: MAP_MAX_ZOOM
    }),
    'Street': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }),
    'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
        maxZoom: MAP_MAX_ZOOM
    }),
    'Terrain': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
        maxZoom: 17
    })
};

const LOOKS_LIKE_COORDS = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/;

const FEET2METERS = 0.3048;
const STORAGE_KEY = 'los-map-state-v1';
const ELEV_CACHE = {};
const ELEV_CACHE_KEY = function(xlat, xlng, rlat, rlng) {
    return [xlat.toFixed(4), xlng.toFixed(4), rlat.toFixed(4), rlng.toFixed(4)].join('|');
};

// Fresnel zone: effective earth radius with k-factor for VHF/UHF refraction,
// 60 percent of 1st zone radius required clear.
const EARTH_R_EFF_M = 6371000 * (4 / 3);
const FRESNEL_CLEAR_FRACTION = 0.6;
const DEFAULT_FREQ_MHZ = 433;
const MIN_FREQ_MHZ = 30;
const MAX_FREQ_MHZ = 6000;

function clampFreqMHz(v) {
    let f = parseFloat(v);
    if (isNaN(f)) return DEFAULT_FREQ_MHZ;
    if (f < MIN_FREQ_MHZ) return MIN_FREQ_MHZ;
    if (f > MAX_FREQ_MHZ) return MAX_FREQ_MHZ;
    return f;
}

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
    const $freq = $('input[name="freq"]');
    const $freqerror = $('#freqerror');
    
    const $xlocate = $form.find('button[name="xlocate"]');
    const $rlocate = $form.find('button[name="rlocate"]');
    const $btnSwap = $('#btn-swap');
    const $btnClear = $('#btn-clear');
    const $btnZoomLink = $('#btn-zoomlink');
    const $btnCopyLink = $('#btn-copylink');
    const $xpick = $form.find('button[name="xpick"]');
    const $rpick = $form.find('button[name="rpick"]');
    const $xerror = $('#xerror');
    const $rerror = $('#rerror');
    const $mapWrap = $('#map-wrap');
    const $mapHint = $('#map-hint');
    const $toast = $('#app-toast');
    let pickTarget = null;
    let toastTimer = null;

    function showToast(msg, kind) {
        $toast.text(msg).removeClass('info').addClass('show');
        if (kind === 'info') $toast.addClass('info');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function() { $toast.removeClass('show'); }, 4200);
    }

    function showFieldError($el, msg) {
        if (!msg) { $el.removeClass('show').text(''); return; }
        $el.text(msg).addClass('show');
    }

    //
    // basic setup of the map and the drag markers
    //

    MAP = L.map('map').setView([MAPSTART_LAT, MAPSTART_LNG], MAPSTART_ZOOM);

    MAP._baseName = 'Topographic';
    MAP.basemap = BASE_MAPS.Topographic.addTo(MAP);
    L.control.layers(BASE_MAPS, null, {
        position: 'topright',
        collapsed: window.innerWidth < 992
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
    }).bindTooltip('Tx', { permanent: true, direction: 'top', offset: [0, -14], className: 'marker-label' });
    MAP.rmarker = L.marker([0, 0], {
        title: "Receiving location",
        draggable: true,
        icon: rxIcon
    }).bindTooltip('Rx', { permanent: true, direction: 'top', offset: [0, -14], className: 'marker-label' });

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

    function setPickTarget(t) {
        const prev = pickTarget;
        pickTarget = t;
        const isPicking = !!t;
        $mapWrap.toggleClass('picking', isPicking);
        $xpick.toggleClass('pick-active', t === 'tx').attr('aria-pressed', t === 'tx' ? 'true' : 'false');
        $rpick.toggleClass('pick-active', t === 'rx').attr('aria-pressed', t === 'rx' ? 'true' : 'false');
        if (t === 'tx') $mapHint.text('Pick mode: click the map to set Tx. Esc to cancel.');
        else if (t === 'rx') $mapHint.text('Pick mode: click the map to set Rx. Esc to cancel.');
        else updateMapHint();
        if (isPicking) {
            $mapHint.attr('tabindex', '-1').focus({ preventScroll: true });
        } else if (prev && document.activeElement === $mapHint[0]) {
            (prev === 'tx' ? $xpick : $rpick).focus({ preventScroll: true });
        }
    }

    function updateMapHint() {
        const hasTx = MAP.hasLayer(MAP.xmarker);
        const hasRx = MAP.hasLayer(MAP.rmarker);
        if (hasTx && hasRx) $mapHint.text('Drag markers or Pick on map to adjust. Click chart to inspect terrain.');
        else $mapHint.text('Search, use GPS, or tap Pick on map, then click the map to set Tx and Rx.');
    }

    MAP.on('click', function (e) {
        if (!pickTarget) return;
        const v = `${e.latlng.lat.toFixed(6)},${e.latlng.lng.toFixed(6)}`;
        if (pickTarget === 'tx') {
            $xaddr_input.val(v).change();
            setPickTarget('rx');
        } else {
            $raddr_input.val(v).change();
            setPickTarget(null);
        }
    });

    $(document).on('keydown', function (e) {
        if (e.key === 'Escape' && pickTarget) setPickTarget(null);
    });

    $xpick.click(function () { setPickTarget(pickTarget === 'tx' ? null : 'tx'); });
    $rpick.click(function () { setPickTarget(pickTarget === 'rx' ? null : 'rx'); });

    MAP.lineofsight = L.polyline([[0, 0], [0, 0]], {
        color: '#22d3ee',
        weight: 4,
        opacity: 0.9
    });

	MAP.tooltip = L.tooltip();

    //
    // address search; position & add the markers
    //

    $xaddr_input.change(function () {
        const address = $xaddr_input.val().trim();
        if (!address) { showFieldError($xerror, ''); return; }
        const coordbits = address.match(LOOKS_LIKE_COORDS);
        if (! coordbits) return;  // not coords; wait for Find/geocode
        showFieldError($xerror, '');

        const lat = parseFloat(coordbits[1]);
        const lng = parseFloat(coordbits[2]);
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            showFieldError($xerror, 'Coordinates out of range.');
            return;
        }
        placeTransmitMarker(lat, lng);
        if (typeof updateMapHint === 'function') updateMapHint();
    });
    $raddr_input.change(function () {
        const address = $raddr_input.val().trim();
        if (!address) { showFieldError($rerror, ''); return; }
        const coordbits = address.match(LOOKS_LIKE_COORDS);
        if (! coordbits) return;  // not coords; wait for Find/geocode
        showFieldError($rerror, '');

        const lat = parseFloat(coordbits[1]);
        const lng = parseFloat(coordbits[2]);
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            showFieldError($rerror, 'Coordinates out of range.');
            return;
        }
        placeReceiveMarker(lat, lng);
        if (typeof updateMapHint === 'function') updateMapHint();
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
    $freq.change(function (event) {
        const f = clampFreqMHz($freq.val());
        $freq.val(f);
        showFieldError($freqerror, '');
        if (MAP.hasLayer(MAP.xmarker) && MAP.hasLayer(MAP.rmarker)) updateTheLine();
        saveState();
    });
    $freq.keyup(function (event) {
        if (event.key == 'Enter') $freq.change();
    });
    $('.freq-preset').click(function (e) {
        e.preventDefault();
        const f = clampFreqMHz($(this).attr('data-freq'));
        $freq.val(f).change();
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
        if (! address) { showFieldError($xerror, 'Enter an address or lat,lng.'); return; }

        // if it looks like coordinates, skip geocoding; just trigger change()
        if (address.match(LOOKS_LIKE_COORDS)) return $xaddr_input.change();

        toggleSearchLoading('xsearchgo', true);
        geocodeAddress(address, function (resultlist) {
            toggleSearchLoading('xsearchgo', false);
            if (! resultlist || ! resultlist.length) {
                showFieldError($xerror, 'Could not find that address.');
                showToast('Tx: address not found.');
                return;
            }

            const lat = parseFloat(resultlist[0].lat);
            const lng = parseFloat(resultlist[0].lon);
            $xaddr_input.val(`${lat.toFixed(6)},${lng.toFixed(6)}`).change();
        }, function() {
            toggleSearchLoading('xsearchgo', false);
            showFieldError($xerror, 'Geocoding offline. Try lat,lng instead.');
            showToast('Geocoding offline. Try lat,lng.');
        });
    });

    $raddr_go.click(function () {
        const address = $raddr_input.val().trim();
        if (! address) { showFieldError($rerror, 'Enter an address or lat,lng.'); return; }

        // if it looks like coordinates, skip geocoding; just trigger change()
        if (address.match(LOOKS_LIKE_COORDS)) return $raddr_input.change();

        toggleSearchLoading('rsearchgo', true);
        geocodeAddress(address, function (resultlist) {
            toggleSearchLoading('rsearchgo', false);
            if (! resultlist || ! resultlist.length) {
                showFieldError($rerror, 'Could not find that address.');
                showToast('Rx: address not found.');
                return;
            }

            const lat = parseFloat(resultlist[0].lat);
            const lng = parseFloat(resultlist[0].lon);
            $raddr_input.val(`${lat.toFixed(6)},${lng.toFixed(6)}`).change();
        }, function() {
            toggleSearchLoading('rsearchgo', false);
            showFieldError($rerror, 'Geocoding offline. Try lat,lng instead.');
            showToast('Geocoding offline. Try lat,lng.');
        });
    });

    // Locate Me (GPS) features
    function handleLocate(inputEl, $errEl, label) {
        if (!navigator.geolocation) {
            showToast('Geolocation is not supported by this browser.');
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
                showFieldError($errEl, 'Unable to retrieve location: ' + error.message);
                showToast(label + ': ' + error.message);
                $btn.text(originalText);
                $btn.prop('disabled', false);
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
    }

    $xlocate.click(function() {
        handleLocate.call(this, $xaddr_input, $xerror, 'Tx');
    });

    $rlocate.click(function() {
        handleLocate.call(this, $raddr_input, $rerror, 'Rx');
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

    $btnClear.click(function() {
        $xaddr_input.val('');
        $raddr_input.val('');
        showFieldError($xerror, '');
        showFieldError($rerror, '');
        MAP.xmarker.removeFrom(MAP);
        MAP.rmarker.removeFrom(MAP);
        MAP.lineofsight.removeFrom(MAP);
        MAP._hasFitLink = false;
        $('#readouts').addClass('d-none');
        const emptyMsg = document.getElementById('profile-empty');
        if (emptyMsg) emptyMsg.classList.remove('d-none');
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
        document.location.hash = '';
        setPickTarget('tx');
        updateMapHint();
        showToast('Cleared. Pick Tx on the map to start again.', 'info');
    });

    $btnZoomLink.click(function() {
        if (MAP.hasLayer(MAP.xmarker) && MAP.hasLayer(MAP.rmarker)) {
            MAP.fitBounds(MAP.lineofsight.getBounds().pad(0.25));
        } else {
            showToast('Set both Tx and Rx first.', 'info');
        }
    });

    $btnCopyLink.click(function() {
        const url = document.location.href;
        function done() { showToast('Link copied.', 'info'); }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(done, function() { showToast('Copy failed. Copy the URL manually.'); });
        } else {
            const ta = document.createElement('textarea');
            ta.value = url;
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); done(); }
            catch (e) { showToast('Copy failed. Copy the URL manually.'); }
            document.body.removeChild(ta);
        }
    });

    MAP.on('baselayerchange', function(e) { MAP._baseName = e.name; saveState(); });

    window.addEventListener('offline', function() { showToast('You are offline. Map tiles and search need a connection.'); });
    window.addEventListener('online', function() { showToast('Back online.', 'info'); });

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
    function saveState() {
        try {
            const s = {
                x: $xaddr_input.val(),
                r: $raddr_input.val(),
                xh: $xheight.val(),
                rh: $rheight.val(),
                xu: txUnit,
                ru: rxUnit,
                base: MAP._baseName || 'Topographic',
                freq: clampFreqMHz($freq.val())
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
        } catch (e) {}
    }

    function applyBasemap(name) {
        if (!name || !BASE_MAPS[name] || MAP._baseName === name) return;
        if (MAP.basemap) MAP.removeLayer(MAP.basemap);
        MAP._baseName = name;
        MAP.basemap = BASE_MAPS[name].addTo(MAP);
    }

    function loadStoredState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return false;
            const s = JSON.parse(raw);
            if (!s || (!s.x && !s.r)) return false;
            txUnit = s.xu === 'm' ? 'm' : 'ft';
            rxUnit = s.ru === 'm' ? 'm' : 'ft';
            setUnitVisual('x', txUnit);
            setUnitVisual('r', rxUnit);
            if (s.xh !== undefined) $xheight.val(s.xh);
            if (s.rh !== undefined) $rheight.val(s.rh);
            if (s.freq !== undefined) $freq.val(clampFreqMHz(s.freq));
            if (s.base) applyBasemap(s.base);
            if (s.x) $xaddr_input.val(s.x).change();
            if (s.r) $raddr_input.val(s.r).change();
            return true;
        } catch (e) { return false; }
    }

    if (document.location.hash) {
        const coords = document.location.hash.replace(/^#/, '').split(',').map(i => parseFloat(i));
        if (coords.length == 4 && !isNaN(coords[0]) && !isNaN(coords[1]) && !isNaN(coords[2]) && !isNaN(coords[3])) {
            $xaddr_input.val(`${coords[0]},${coords[1]}`).change();
            $raddr_input.val(`${coords[2]},${coords[3]}`).change();
        }
        else if ((coords.length == 6 || coords.length == 7) && !isNaN(coords[0]) && !isNaN(coords[1]) && !isNaN(coords[2]) && !isNaN(coords[3]) && !isNaN(coords[4]) && !isNaN(coords[5])) {
            // Initial hash values are always stored in feet
            txUnit = 'ft';
            rxUnit = 'ft';
            setUnitVisual('x', 'ft');
            setUnitVisual('r', 'ft');
			$xheight.val(coords[4]);
			$rheight.val(coords[5]);
            if (coords.length == 7 && !isNaN(coords[6])) $freq.val(clampFreqMHz(coords[6]));
        	$xaddr_input.val(`${coords[0]},${coords[1]}`).change();
            $raddr_input.val(`${coords[2]},${coords[3]}`).change();
        }
    }
    else {
        loadStoredState();
    }
    updateMapHint();
});


function geocodeAddress (address, successcallback, errorcallback) {
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(address);
    const ctrl = new AbortController();
    const timer = setTimeout(function() { ctrl.abort(); }, 8000);
    fetch(url, { signal: ctrl.signal, headers: { 'Accept': 'application/json' } })
        .then(function(res) {
            clearTimeout(timer);
            if (!res.ok) throw new Error('geocode ' + res.status);
            return res.json();
        })
        .then(function(json) { successcallback(json); })
        .catch(function(err) {
            clearTimeout(timer);
            errorcallback(err);
        });
}


function placeTransmitMarker (lat, lng) {
    MAP.xmarker.setLatLng([lat, lng]).addTo(MAP);
    MAP.xmarker.bindPopup(`<strong>Tx</strong><br>${lat.toFixed(6)},${lng.toFixed(6)}`);
    if (MAP.hasLayer(MAP.xmarker) && MAP.hasLayer(MAP.rmarker)) updateTheLine();
}


function placeReceiveMarker (lat, lng) {
    MAP.rmarker.setLatLng([lat, lng]).addTo(MAP);
    MAP.rmarker.bindPopup(`<strong>Rx</strong><br>${lat.toFixed(6)},${lng.toFixed(6)}`);
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
    const bounds = MAP.lineofsight.getBounds().pad(0.25);
    // Preserve user zoom: only fit when link is outside current view or first link.
    if (!MAP._hasFitLink || !MAP.getBounds().contains(bounds)) {
        MAP.fitBounds(bounds);
        MAP._hasFitLink = true;
    }
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
    $statusContainer.removeClass('los-clear los-blocked los-marginal bg-secondary').addClass('los-calculating');
    $statusContainer.css('cursor', '').off('click.retry');
    $statusText.text('Calculating...');

    const freqMHz = clampFreqMHz($('input[name="freq"]').val() || DEFAULT_FREQ_MHZ);
    const lambda_m = 300 / freqMHz;

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

    const elevKey = ELEV_CACHE_KEY(xlat, xlng, rlat, rlng);
    const locParam = points.map(p => `${p[0]},${p[1]}`).join('|');

    function showElevOffline() {
        $statusContainer.removeClass('los-calculating').addClass('bg-secondary');
        $statusText.text('Elevation Offline - tap to retry');
        $statusContainer.css('cursor', 'pointer').off('click.retry').on('click.retry', function() {
            $statusContainer.css('cursor', '');
            updateReadouts();
        });
    }

    function handleElevResponse(response) {
            if (!response || !response.results || response.results.length === 0) {
                showElevOffline();
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

            $readouts.find('span[data-readout="freq_mhz"]').text(freqMHz);

            // Fresnel zone check with earth bulge (k-factor included in EARTH_R_EFF_M).
            // Chart shows raw terrain, so the clearance boundary is drawn in
            // raw-elevation space: los - bulge - 0.6 * r1.
            let isBlocked = false;
            let isMarginal = false;
            let maxR1 = 0;
            let worstClear_m = Infinity;
            let worstPct = Infinity;
            const totalPoints = response.results.length;

            for (let i = 1; i < totalPoints - 1; i++) {
                const fraction = i / (totalPoints - 1);
                const d1 = lenstep * i;
                const d2 = totalmeters - d1;
                const los_h = transmit_total_m + (receive_total_m - transmit_total_m) * fraction;
                const bulge = (d1 * d2) / (2 * EARTH_R_EFF_M);
                const r1 = (d1 <= 0 || d2 <= 0 || totalmeters <= 0) ? 0 : Math.sqrt(lambda_m * d1 * d2 / totalmeters);
                if (r1 > maxR1) maxR1 = r1;
                const terrainEff = response.results[i].elevation + bulge;

                // Hard block: terrain breaks the geometric line
                if (terrainEff > los_h) {
                    isBlocked = true;
                }
                // Fresnel: 60 percent of 1st zone must be clear
                const clearance = los_h - FRESNEL_CLEAR_FRACTION * r1 - terrainEff;
                if (clearance < worstClear_m) worstClear_m = clearance;
                const pct = r1 > 0.01 ? ((los_h - terrainEff) / r1) * 100 : 100;
                if (pct < worstPct) worstPct = pct;
                if (!isBlocked && clearance < 0) {
                    isMarginal = true;
                }
            }
            if (!isFinite(worstClear_m)) worstClear_m = 0;
            if (!isFinite(worstPct)) worstPct = 100;

            $readouts.find('span[data-readout="fresnel_max_m"]').text(maxR1.toFixed(1));
            $readouts.find('span[data-readout="fresnel_clear_m"]').text(worstClear_m.toFixed(1));
            $readouts.find('span[data-readout="fresnel_clear_pct"]').text(worstPct.toFixed(0));

            const $fresnelwarn = $('#fresnelwarn');
            if (!isBlocked && isMarginal) $fresnelwarn.removeClass('d-none');
            else $fresnelwarn.addClass('d-none');

            // Update status badge UI
            if (isBlocked) {
                $statusContainer.removeClass('los-calculating los-clear los-marginal').addClass('los-blocked');
                $statusText.text('Blocked by Terrain');
                MAP.lineofsight.setStyle({ color: '#fb7185' });
            } else if (isMarginal) {
                $statusContainer.removeClass('los-calculating los-clear los-blocked').addClass('los-marginal');
                $statusText.text('Marginal - Fresnel Intruded');
                MAP.lineofsight.setStyle({ color: '#f59e0b' });
            } else {
                $statusContainer.removeClass('los-calculating los-blocked los-marginal').addClass('los-clear');
                $statusText.text('Clear Line-of-Sight');
                MAP.lineofsight.setStyle({ color: '#34d399' });
            }
            const linkBlocked = isBlocked;

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

            const fresnelPoints = response.results.map((point, i) => {
                const fraction = i / (response.results.length - 1);
                const d1 = lenstep * i;
                const d2 = totalmeters - d1;
                const losVal = transmit_total_m + (receive_total_m - transmit_total_m) * fraction;
                const bulge = (d1 * d2) / (2 * EARTH_R_EFF_M);
                const r1 = (d1 <= 0 || d2 <= 0 || totalmeters <= 0) ? 0 : Math.sqrt(lambda_m * d1 * d2 / totalmeters);
                const fresVal = losVal - bulge - FRESNEL_CLEAR_FRACTION * r1;
                return {
                    x: i * lenstep / 1000.0,
                    y: fresVal,
                    distance_km: (i * lenstep / 1000.0).toFixed(1),
                    distance_mi: (i * lenstep / 1609.43).toFixed(1),
                    elevation_ft: Math.round(fresVal / FEET2METERS),
                    elevation_m: Math.round(fresVal)
                };
            });

            renderElevationProfile(terrainPoints, losPoints, linkBlocked, fresnelPoints, isMarginal);
            MAP.xmarker.setPopupContent(`<strong>Tx</strong><br>${xlat.toFixed(6)},${xlng.toFixed(6)}<br>Ground: ${Math.round(tx_ground_m)} m`);
            MAP.rmarker.setPopupContent(`<strong>Rx</strong><br>${rlat.toFixed(6)},${rlng.toFixed(6)}<br>Ground: ${Math.round(rx_ground_m)} m`);
            const emptyMsg = document.getElementById('profile-empty');
            if (emptyMsg) emptyMsg.classList.add('d-none');
    }

    function fetchOpenTopoFallback() {
        $.ajax({
            url: 'https://api.opentopodata.org/v1/srtm90m',
            data: { locations: locParam },
            timeout: 12000,
            success: function (resp) {
                if (!resp || !resp.results || !resp.results.length) { showElevOffline(); return; }
                const norm = {
                    results: resp.results.map(function(r) {
                        return {
                            elevation: r.elevation,
                            latitude: r.location ? r.location.lat : 0,
                            longitude: r.location ? r.location.lng : 0
                        };
                    })
                };
                ELEV_CACHE[elevKey] = norm;
                handleElevResponse(norm);
            },
            error: showElevOffline
        });
    }

    if (ELEV_CACHE[elevKey] && ELEV_CACHE[elevKey].results.length === points.length) {
        handleElevResponse(ELEV_CACHE[elevKey]);
        // Refresh distance and bearing from cache without network delay, then still update heights.
    } else {
        $.ajax({
            url: 'https://api.open-elevation.com/api/v1/lookup',
            data: { locations: locParam },
            timeout: 12000,
            success: function (response) {
                if (!response || !response.results || !response.results.length) { fetchOpenTopoFallback(); return; }
                ELEV_CACHE[elevKey] = response;
                handleElevResponse(response);
            },
            error: fetchOpenTopoFallback
        });
    }
}

function renderElevationProfile(terrainPoints, losPoints, isBlocked, fresnelPoints, isMarginal) {
    if (window.Highcharts) {
        renderHighchartsProfile(terrainPoints, losPoints, isBlocked, fresnelPoints, isMarginal);
        return;
    }

    renderSvgElevationProfile(terrainPoints, losPoints, isBlocked, fresnelPoints, isMarginal);
}

function renderHighchartsProfile(terrainPoints, losPoints, isBlocked, fresnelPoints, isMarginal) {
    const linkColor = isBlocked ? '#fb7185' : (isMarginal ? '#f59e0b' : '#34d399');
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
                style: { color: 'rgba(203, 213, 225, 0.85)', fontSize: '0.8rem' }
            },
            labels: { style: { color: 'rgba(203, 213, 225, 0.78)', fontSize: '0.75rem' } },
            lineColor: 'rgba(226, 232, 240, 0.14)',
            tickColor: 'rgba(226, 232, 240, 0.14)'
        },
        yAxis: {
            title: {
                text: 'Elevation (m)',
                style: { color: 'rgba(203, 213, 225, 0.85)', fontSize: '0.8rem' }
            },
            labels: { style: { color: 'rgba(203, 213, 225, 0.78)', fontSize: '0.75rem' } },
            gridLineColor: 'rgba(226, 232, 240, 0.08)',
            lineColor: 'rgba(226, 232, 240, 0.14)',
            tickColor: 'rgba(226, 232, 240, 0.14)'
        },
        legend: {
            enabled: true,
            itemStyle: { color: 'rgba(248, 250, 252, 0.82)', fontSize: '0.8rem' }
        },
        credits: {
            enabled: false
        },
        tooltip: {
            shared: true,
            backgroundColor: 'rgba(17, 24, 39, 0.97)',
            borderColor: 'rgba(34, 211, 238, 0.35)',
            style: { color: '#f8fafc' },
            formatter: function () {
                const terrainPoint = this.points.find(p => p.series.name === 'Terrain').point;
                const losPoint = this.points.find(p => p.series.name === 'Line of Sight').point;
                const fresPoint = this.points.find(p => p.series.name === '60% Fresnel');
                const fresOpts = fresPoint ? fresPoint.point.options : null;

                if (terrainPoint) {
                    MAP.tooltip.setLatLng([terrainPoint.lat, terrainPoint.lng])
                        .setContent(`<strong>Distance:</strong> ${terrainPoint.options.distance_km} km (${terrainPoint.options.distance_mi} mi)<br/>
                                     <strong>Terrain:</strong> ${terrainPoint.options.elevation_m} m (${terrainPoint.options.elevation_ft} ft)<br/>
                                     <strong>LoS Path:</strong> ${losPoint ? losPoint.options.elevation_m : 0} m (${losPoint ? losPoint.options.elevation_ft : 0} ft)<br/>
                                     <strong>60% Fresnel:</strong> ${fresOpts ? fresOpts.elevation_m : 0} m`)
                        .addTo(MAP);
                }

                let text = `<strong>Distance:</strong> ${terrainPoint.options.distance_km} km (${terrainPoint.options.distance_mi} mi)<br/>`;
                text += `<span style="color:#22d3ee">\u25CF</span> Terrain: <b>${terrainPoint.options.elevation_m} m</b> (${terrainPoint.options.elevation_ft} ft)<br/>`;
                if (losPoint) {
                    text += `<span style="color:${linkColor}">\u25CF</span> LoS Path: <b>${losPoint.options.elevation_m} m</b> (${losPoint.options.elevation_ft} ft)<br/>`;
                }
                if (fresOpts) {
                    text += `<span style="color:#f59e0b">\u25CF</span> 60% Fresnel: <b>${fresOpts.elevation_m} m</b> (${fresOpts.elevation_ft} ft)`;
                }
                return text;
            }
        },
        series: [
            {
                name: 'Terrain',
                type: 'area',
                data: terrainPoints,
                color: '#22d3ee',
                fillColor: {
                    linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
                    stops: [
                        [0, 'rgba(34, 211, 238, 0.28)'],
                        [1, 'rgba(15, 23, 32, 0.05)']
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
                color: linkColor,
                lineWidth: 3,
                dashStyle: 'Dash',
                marker: { enabled: false },
                events: {
                    mouseOut: function () {
                        MAP.tooltip.setLatLng([0, 0]).removeFrom(MAP);
                    }
                }
            },
            {
                name: '60% Fresnel',
                type: 'line',
                data: fresnelPoints || [],
                color: '#f59e0b',
                lineWidth: 2,
                dashStyle: 'Dot',
                marker: { enabled: false },
                events: {
                    mouseOut: function () {
                        MAP.tooltip.setLatLng([0, 0]).removeFrom(MAP);
                    }
                }
            }
        ]
    });
}

function renderSvgElevationProfile(terrainPoints, losPoints, isBlocked, fresnelPoints, isMarginal) {
    const container = document.getElementById('elevationprofile');
    if (!container || !terrainPoints.length || !losPoints.length) return;

    const width = Math.max(container.clientWidth || 720, 320);
    const height = Math.max(container.clientHeight || 180, 150);
    const pad = { top: 14, right: 16, bottom: 30, left: 48 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const maxDistance = Math.max(...terrainPoints.map(point => point.x), 1);
    const elevations = terrainPoints.concat(losPoints, fresnelPoints || []).map(point => point.y);
    const minElevation = Math.min(...elevations);
    const maxElevation = Math.max(...elevations);
    const elevationRange = Math.max(maxElevation - minElevation, 1);
    const yMin = Math.floor((minElevation - elevationRange * 0.08) / 50) * 50;
    const yMax = Math.ceil((maxElevation + elevationRange * 0.08) / 50) * 50;
    const yRange = Math.max(yMax - yMin, 1);
    const losColor = isBlocked ? '#fb7185' : (isMarginal ? '#f59e0b' : '#34d399');

    const xFor = point => pad.left + (point.x / maxDistance) * plotWidth;
    const yFor = point => pad.top + ((yMax - point.y) / yRange) * plotHeight;
    const terrainLine = terrainPoints.map(point => `${xFor(point).toFixed(1)},${yFor(point).toFixed(1)}`).join(' ');
    const losLine = losPoints.map(point => `${xFor(point).toFixed(1)},${yFor(point).toFixed(1)}`).join(' ');
    const fresLine = (fresnelPoints && fresnelPoints.length) ? fresnelPoints.map(point => `${xFor(point).toFixed(1)},${yFor(point).toFixed(1)}`).join(' ') : '';
    const areaPath = `M ${pad.left},${pad.top + plotHeight} L ${terrainLine.replaceAll(' ', ' L ')} L ${pad.left + plotWidth},${pad.top + plotHeight} Z`;
    const midElevation = Math.round((yMin + yMax) / 2);

    container.innerHTML = `
        <svg class="fallback-profile" viewBox="0 0 ${width} ${height}" role="img" aria-label="Elevation profile chart">
            <defs>
                <linearGradient id="terrain-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.28" />
                    <stop offset="100%" stop-color="#22d3ee" stop-opacity="0.04" />
                </linearGradient>
            </defs>
            <line class="profile-grid" x1="${pad.left}" y1="${pad.top}" x2="${pad.left + plotWidth}" y2="${pad.top}" />
            <line class="profile-grid" x1="${pad.left}" y1="${pad.top + plotHeight / 2}" x2="${pad.left + plotWidth}" y2="${pad.top + plotHeight / 2}" />
            <line class="profile-grid" x1="${pad.left}" y1="${pad.top + plotHeight}" x2="${pad.left + plotWidth}" y2="${pad.top + plotHeight}" />
            <path class="profile-area" d="${areaPath}" />
            <polyline class="profile-terrain" points="${terrainLine}" />
            <polyline class="profile-los" points="${losLine}" style="stroke:${losColor}" />
            ${fresLine ? `<polyline class="profile-fresnel" points="${fresLine}" />` : ''}
            <text class="profile-label" x="${pad.left - 8}" y="${pad.top + 4}" text-anchor="end">${Math.round(yMax)} m</text>
            <text class="profile-label" x="${pad.left - 8}" y="${pad.top + plotHeight / 2 + 4}" text-anchor="end">${midElevation} m</text>
            <text class="profile-label" x="${pad.left - 8}" y="${pad.top + plotHeight + 4}" text-anchor="end">${Math.round(yMin)} m</text>
            <text class="profile-label" x="${pad.left}" y="${height - 8}">0 km</text>
            <text class="profile-label" x="${pad.left + plotWidth}" y="${height - 8}" text-anchor="end">${maxDistance.toFixed(1)} km</text>
            <g class="profile-legend">
                <circle cx="${pad.left + 4}" cy="${pad.top + 12}" r="4" fill="#22d3ee" />
                <text x="${pad.left + 14}" y="${pad.top + 16}">Terrain</text>
                <circle cx="${pad.left + 86}" cy="${pad.top + 12}" r="4" fill="${losColor}" />
                <text x="${pad.left + 96}" y="${pad.top + 16}">Line of sight</text>
                <circle cx="${pad.left + 196}" cy="${pad.top + 12}" r="4" fill="#f59e0b" />
                <text x="${pad.left + 206}" y="${pad.top + 16}">60% Fresnel</text>
            </g>
        </svg>
    `;
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
    const freqMHz = clampFreqMHz($('input[name="freq"]').val() || DEFAULT_FREQ_MHZ);

    document.location.hash = `${xlat},${xlng},${rlat},${rlng},${xheight_ft},${rheight_ft},${freqMHz}`;
    try {
        const s = {
            x: $('input[name="xaddr"]').val(),
            r: $('input[name="raddr"]').val(),
            xh: $('input[name="xheight"]').val(),
            rh: $('input[name="rheight"]').val(),
            xu: txUnit,
            ru: rxUnit,
            base: MAP._baseName || 'Topographic',
            freq: freqMHz
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch (e) {}
}
