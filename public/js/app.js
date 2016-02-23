/* define globals */
var credentials;
var loggedIn = false;
var wasLoggedIn = false;

/* define iprs contacts */
var IprsContacts = { 
	447884001671:  { name: 'Vince Lowe'  }, 
	5551000009323: { name: 'Vince BlackB'} 
}; 


/* document ready */
$(document).ready(function() {
	/* show login modal */
	$('#loginModal').modal('show');
	
	/* handle login form submit */
	$('#loginForm').submit(function(e){
		e.preventDefault();
		$('body').addClass('waiting');
		$(this).find(':submit').button('loading');
		var data = {
			username : $("input[name='username']").val(),
			password : $("input[name='password']").val()
		};
		credentials = data;
		/* send login data to socket.io */
		socket.emit('login', data);
		return false;
	});
	/* handle gpsHistory form submit */
	$('#gpsHistoryForm').submit(function(e){
		e.preventDefault();
		if($("select[name='user']").val() == "") return;
		/* show busy cursor */
		$('body').addClass('waiting');
		/* clear existing history markers */
		clearHistoryMarkers();
		/* clear existing history polylines */
		clearPolylines();	
		//$(this).find(':submit').button('loading');
		var data = {
			userid : $("select[name='user']").val(),
			start  : $("input[name='start']").val(),
			end    : $("input[name='end']").val()
		};
		/* send gps history data to socket.io */
		socket.emit('HistoryQuery', data);
		return false;
	});
	/* handle search address form submit */
	$('#addressSearch').submit(function(e){
		e.preventDefault();
		$(this).find(':submit').button('loading');
		codeAddress();
		return false;
	});
	/* handle set tracking frequency submit */
	$('#setTrackingFrequency').keypress(function (e) {
		if (e.which == 13) {
			var frequency = $('#setTrackingFrequency').val();
			socket.emit('SetTrackingFrequencyValue', frequency);
			return false;
		}
	});
	/* handle GetImmediateGpsData click */
	$('#GetImmediateGpsData').click(function(e){
		socket.emit('GetImmediateGpsData');
		e.preventDefault();
	});
	/* handle GpsHistory click */
	$('#GetGpsHistory').click(function(e){
		/* show GpsHistory modal */
		$('#gpsHistoryModal').modal('show');		
		e.preventDefault();
	});
});

/* Socket.io */
var socket = io();	
socket.on('connect', function() {
	/* auto re-login */
	if((credentials) && (wasLoggedIn)) {
		socket.emit('login', credentials);
	}
});
socket.on('Login', function(result){
	$('body').removeClass('waiting');
	if(result == "OK") {
		loggedIn = true;
		wasLoggedIn = true;
		$('.loggedout').addClass('hidden');
		$('.loggedin').removeClass('hidden');
		$('#loginModal').modal('hide');
		$('#loginForm').find(':submit').button('reset');
		/* populate contacts dropdown */
		$('.chosen-select').empty();
		$('.chosen-select').append('<option value=""></option>');
		$.each( IprsContacts , function( id, user ) {
			/* get contacts positions */
			socket.emit('GetUserLastPosition', id);
			$('.chosen-select').append('<option value='+id+'>' +user.name+ '</option>');
		});
		$('.chosen-select').trigger("chosen:updated");
	}
});
socket.on('status', function(data){
	if(data.service == "gps") {
		if(data.state == 1) { /* SOAP only, make indicator Yellow */
			$('#gps-status').removeClass('label-success').removeClass('label-danger').addClass('label-warning');
		}
		if(data.state == 2) { /* SOAP & FWD, make indicator Green */
			$('#gps-status').removeClass('label-warning').removeClass('label-danger').addClass('label-success');
		}
	}
	if(data.service == "sos") {
		if(data.state == 1) { /* SOAP only, make indicator Yellow */
			$('#sos-status').removeClass('label-success').removeClass('label-danger').addClass('label-warning');
		}
		if(data.state == 2) { /* SOAP & FWD, make indicator Green */
			$('#sos-status').removeClass('label-warning').removeClass('label-danger').addClass('label-success');
		}
	}
});
socket.on('GPS', function(gps){
	/* lookup display name */
	var name;
	for(key in IprsContacts) {
		if(key == gps.strUserID) {
			name = IprsContacts[key].name;
		}
	}
	addMarker(gps.strUserID, name, gps.strLatitude, gps.strLongitude, gps.strTime);
});
socket.on('GPShistory', function(data){
	gpsHistoryHandler(data);
});
socket.on('SOS', function(sos){
	$.each( sos, function( i, item ) {
		/* lookup display name */
		var name;
		for(key in IprsContacts) {
			if(key == item.UserID) {
				name = IprsContacts[key].name;
			}
		}
		addSos(name, item);
	});
});
socket.on('KA', function(data){
	console.log(data);
});
socket.on('SOAP', function(response){
	console.log(response);
});
socket.on('Error', function(error){
	$( "#map" ).effect( "shake" );
	if(error == "invalid login") {
		$('#loginForm').find(':submit').button('reset');
		$('#gps-status').removeClass('label-success').removeClass('label-warning').addClass('label-danger');
	}
});
socket.on('disconnect', function () {
	loggedIn = false;
	$('.loggedin').addClass('hidden');
	$('.loggedout').removeClass('hidden');
	$('#gps-status,#sos-status').removeClass('label-success').removeClass('label-warning').addClass('label-danger');
});



