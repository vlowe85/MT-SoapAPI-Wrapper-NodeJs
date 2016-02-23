var map;				// the google map
var markers = {};       // create markers object
var historyMarkers = {};// history markers object
var sos = {};			// sos alerts object
var geocoder;			// google maps geocoder
var infowindow;			// google maps infowindow
var polylines = [];		// google maps polyline array
var overlay;			// google maps overlay
var colours = ["purple", "yellow", "blue", "green", "red", "orange"];

/* document ready */
$(document).ready(function() {
	$('.chosen-select').chosen({width: "200px"});
    $('.chosen-select').chosen().change(function () {
		var id = $(this).find('option:selected').val();
		map.panTo(markers[id].position);
    });
});

/* init map */
function initMap() {
	map = new google.maps.Map(document.getElementById('map'), {
		center: {lat: -34.397, lng: 150.644},
		zoom: 8
	});
	map.addListener('click', function(e) {
		if(infowindow) infowindow.close();
	});
	geocoder = new google.maps.Geocoder;
	
	overlay = new google.maps.OverlayView();
	overlay.draw = function() {};
	overlay.setMap(map);
}

/* add marker to map */
function addMarker(id, name, lat, lng, timestamp) {
	if(id in markers) {
		/* update existing marker */
		markers[id].timestamp = timestamp;
		if((markers[id].latitude !== lat) && (markers[id].longitude !== lng)) {
			markers[id].latitude  = lat;
			markers[id].longitude = lng;
			markers[id].timestamp = timestamp;
			markers[id].setPosition({lat: lat, lng: lng});
		}
		/* show marker update notification */
		PNotify.desktop.permission();
		(new PNotify({
			title: name,
			text: 'Live GPS update received at '+ moment(parseInt(markers[id].timestamp)).format("h:mm:ss a"),
			opacity: .8,
			styling: 'bootstrap3',
			desktop: {
				desktop: true,
				icon: 'img/tornado.png'
			}
		})).get().click(function(e) {
			if ($('.ui-pnotify-closer, .ui-pnotify-sticker, .ui-pnotify-closer *, .ui-pnotify-sticker *').is(e.target)) return;
			window.focus();
		});
	} else {
		/* add new marker */
		var marker = new google.maps.Marker({
			position: {lat: lat, lng: lng},
			map: map,
			title: name,
			icon: 'http://maps.google.com/intl/en_us/mapfiles/ms/micons/'+colours[Math.floor(Math.random()*colours.length)]+'-dot.png',
			id: id,
			timestamp: timestamp,
			latitude: lat,
			longitude: lng
		});
		markers[id] = marker;
		/* pan to marker */
		map.panTo(marker.position);
		marker.addListener('click', function() {
			if(infowindow) infowindow.close();
			showInfowindow(markers[id]);
		});
		marker.addListener('mouseover', function () {
			var tooltip = $('#tooltip');
			/* get marker pixel position */
			var proj = overlay.getProjection();
			var pos = marker.getPosition();
			var p = proj.fromLatLngToContainerPixel(pos);
			/* show tooltip */
			tooltip.remove();
			tooltip = $(' <div id="tooltip" title="'+ marker.title+'"></div>');
			tooltip.css({"left": p.x + "px", "top": (p.y + 20) + "px"});
			$('#map').after(tooltip);
			tooltip.tooltip();
			tooltip.tooltip('show'); 
		});
		marker.addListener('mouseout', function () {
			var tooltip = $('#tooltip');
			/* remove tooltip */
			tooltip.tooltip('hide');
			tooltip.remove();
		});
	}
}

/* handle GPS history data */
function gpsHistoryHandler(data) {
	var user = data.user;
	var points = data.data;
	var colour = colours[Math.floor(Math.random()*colours.length)];
	historyMarkers[user] = {};
	if(points.length > 0 ) {
		/* add Clear button on map */
		var clearControlDiv = document.createElement('div');
		var centerControl = new ClearControl(clearControlDiv, map);
		clearControlDiv.index = 1;
		map.controls[google.maps.ControlPosition.TOP_RIGHT].push(clearControlDiv);
		/* add markers */
		for ( var i=0 ; i< points.length; i++ ) {
			addHistoryMarkers(i, user, points[i], colour);
		}
		addPolylines(points, colour);
	}
	/* hide busy cursor */
	$('body').removeClass('waiting');
	/* hide GpsHistory modal */
	$('#gpsHistoryModal').modal('hide');		
}

/* add history markers to map */
function addHistoryMarkers(i, name, point, colour) {
	/* add new marker */
	var marker = new google.maps.Marker({
		position: {lat: point.lat, lng: point.lng},
		map: map,
		title: name,
		icon: 'http://labs.google.com/ridefinder/images/mm_20_'+colour+'.png',
		id: name,
		timestamp: point.timestamp,
		latitude: point.lat,
		longitude: point.lng
	});
	marker.addListener('click', function() {
		if(infowindow) infowindow.close();
		showInfowindow(historyMarkers[name][i]);
	});
	marker.addListener('mouseover', function () {
		var tooltip = $('#tooltip');
		/* get marker pixel position */
		var proj = overlay.getProjection();
		var pos = marker.getPosition();
		var p = proj.fromLatLngToContainerPixel(pos);
		/* show tooltip */
		tooltip.remove();
		tooltip = $(' <div id="tooltip" title="'+ marker.title+'"></div>');
		tooltip.css({"left": p.x + "px", "top": (p.y + 20) + "px"});
		$('#map').after(tooltip);
		tooltip.tooltip();
		tooltip.tooltip('show'); 
	});
	marker.addListener('mouseout', function () {
		var tooltip = $('#tooltip');
		/* remove tooltip */
		tooltip.tooltip('hide');
		tooltip.remove();
	});
	historyMarkers[name][i] = marker;
}

/* add google map polylines */
function addPolylines(pointsArray, colour) {
	var polyline = new google.maps.Polyline({
		path: pointsArray,
		geodesic: true,
		strokeColor: colour,
		strokeOpacity: 0.5,
		strokeWeight: 4
	});
	polylines.push(polyline);
	polyline.setMap(map);
}

/* clear google map polylines */
function clearPolylines() {
	for(var i=0 ; i< polylines.length; i++ ) {
		polylines[i].setMap(null);
	}
	polylines = [];
}

/* clear google map history markers */
function clearHistoryMarkers() {
	for(key in historyMarkers) {	
		$.each( historyMarkers[key] , function( i, marker ) {
			marker.setMap(null);
		});		
	}
	map.controls[google.maps.ControlPosition.TOP_RIGHT].clear(); 
}

/* show google map infowindow */
function showInfowindow(marker) {
	infowindow = new google.maps.InfoWindow;
	/* gets markers address from geocoder */
	geocoder.geocode({'location': marker.position}, function(results, status) {
		if (status === google.maps.GeocoderStatus.OK) {
			if (results[1]) {
				infowindow.setContent(marker.title+'<br />'+ results[1].formatted_address+'<br />'
									+ moment(parseInt(marker.timestamp)).fromNow()+'<br />'+ moment(parseInt(marker.timestamp)).format("MMMM Do YYYY, h:mm:ss a") );
			} else {
				infowindow.setContent('No results found');
			}
		} else {
			infowindow.setContent('Geocoder failed due to: ' + status);
		}
		infowindow.open(map, marker);
	});
}

/* get LatLng from address  */
function codeAddress() {
	geocoder.geocode( { 'address': $("input[name='address']").val()}, function(results, status) {
		if (status == google.maps.GeocoderStatus.OK) {
			map.setCenter(results[0].geometry.location);
			map.setZoom(17);
			setTimeout(function(){ $('#addressSearch').find(':submit').button('reset'); }, 500);
		} else {
			alert("Geocode was not successful for the following reason: " + status);
			$('#addressSearch').find(':submit').button('reset');
		}
	});
}

function ClearControl(controlDiv, map) {
	/* Set CSS for the control border. */
	var controlUI = document.createElement('div');
	controlUI.style.backgroundColor = '#fff';
	controlUI.style.border = '2px solid #fff';
	controlUI.style.borderRadius = '3px';
	controlUI.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
	controlUI.style.cursor = 'pointer';
	controlUI.style.marginBottom = '22px';
	controlUI.style.textAlign = 'center';
	controlUI.title = 'Click to clear history data from the map';
	controlDiv.appendChild(controlUI);

	/* Set CSS for the control interior. */
	var controlText = document.createElement('div');
	controlText.style.color = 'rgb(25,25,25)';
	controlText.style.fontFamily = 'Roboto,Arial,sans-serif';
	controlText.style.fontSize = '16px';
	controlText.style.lineHeight = '38px';
	controlText.style.paddingLeft = '5px';
	controlText.style.paddingRight = '5px';
	controlText.innerHTML = 'Clear history';
	controlUI.appendChild(controlText); 

	controlUI.addEventListener('click', function() {
		/* clear existing history markers */
		clearHistoryMarkers();
		/* clear existing history polylines */
		clearPolylines();	
	});
}

/* Gps history data picker */
$(function() {
	function cb(start, end) {
		$('#historyrange span').html(start.format('MMMM D, YYYY') + ' - ' + end.format('MMMM D, YYYY'));
		$("input[name='start']").val(start.valueOf());
		$("input[name='end']").val(end.valueOf());
	}
	cb(moment().subtract(3, 'days'), moment());
	$('#historyrange').daterangepicker({
		dateLimit: {
		   'days': 30
		},
		ranges: {
		   'Today': [moment(), moment()],
		   'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
		   'Last 7 Days': [moment().subtract(6, 'days'), moment()],
		   'Last 30 Days': [moment().subtract(29, 'days'), moment()],
		   'This Month': [moment().startOf('month'), moment().endOf('month')]
		}
	}, cb);
});

function addSos(name, item) {
	if(!name) name = item.UserID;
	if(name in sos) {
		sos[name].TimeStart = moment(parseInt(item.TimeStart)).format("h:mm:ss a");
		sos[name].SosID = item.SosID;
		sos[name].Action = item.Action;
	} else {
		item.TimeStart = moment(parseInt(item.TimeStart)).format("h:mm:ss a");
		item.AlertShown = false;
		sos[name] = item;
		
		if(item.UserID in markers) {
			map.panTo(markers[item.UserID].position);
			map.setZoom(20);
		}

		/* show sos notification */
		PNotify.desktop.permission();
		(new PNotify({
			title: name,
			text: 'SOS alert received at '+ moment(parseInt(item.TimeStart)).format("h:mm:ss a"),
			opacity: .8,
			styling: 'bootstrap3',
			desktop: {
				desktop: true,
				icon: 'img/sos.png'
			}
		})).get().click(function(e) {
			if ($('.ui-pnotify-closer, .ui-pnotify-sticker, .ui-pnotify-closer *, .ui-pnotify-sticker *').is(e.target)) return;
			window.focus();
		});		
	}
}