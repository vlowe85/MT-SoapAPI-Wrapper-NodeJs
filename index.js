var app = require('express')(),
	constant = require('./config.js'),
	http = require('http').Server(app),
	io = require('socket.io')(http),
	net = require('net'),
	logger = require("./lib/log_module.js"),
	soapGps = require('./lib/soapGps_module.js'),
	soapSos = require('./lib/soapSos_module.js'),
	func = require('./lib/app_module.js');
	
/* Expose 'public' directory */
var	express=require('express');
app.use(express.static('public'));
/* Connected clients object */	
var clients = {};
/* socket.io keep-alive repeater, just in case */
setInterval(function(){ keepalive(); }, constant.KA_TIMER_MS );

app.get('/', function(req, res){
	res.sendFile(__dirname + '/public/index.html');
});

/* got new socket.io connection */
io.on('connection', function(socket){
	/* define client variables */
	clients[socket.id] = socket;
	var _this = clients[socket.id];
	
    logger.info('New client connected (id=' + socket.id + '). Clients connected = '+Object.keys(clients).length);
	
	_this.net = new net.Socket();			/* GPS SOAP socket */
	_this.fwd = new net.Socket();			/* GPS Forwarder socket */
	_this.netConnected = false;				/* GPS SOAP connected bool */
	_this.fwdConnected = false;				/* GPS Forwarder connected bool */
	_this.fwdLoggedIn  = false;				/* GPS Forwarder logged in bool */
	_this.subscriptionInterval;				/* Subscription interval timer */
	_this.subscriptions = new Array();		/* Array of users subscribed for updates */
	_this.lastSubscription;					/* Last GPS subscription timestamp in ms */
	_this.FrequencySecs = '600'; 			/* default 10 mins */
	
	_this.SoSnet = new net.Socket();		/* SOS SOAP socket */
	_this.SoSfwd = new net.Socket();		/* SOS Forwarder socket */
	_this.SosSubscriptionInterval;			/* Subscription interval timer */
	_this.SoSnetConnected = false;			/* SOS SOAP connected bool */
	_this.SoSfwdConnected = false;			/* SOS Forwarder connected bool */
	_this.SoSfwdLoggedIn  = false;			/* SOS Forwarder logged in bool */
	
	/* include gps parsers */
	require('./lib/gps_parse.js').parseSoap(io, _this);
	require('./lib/gps_parse.js').parseFwder(io, _this);
	
	/* include sos parsers */
	require('./lib/sos_parse.js').parseSoap(io, _this);
	require('./lib/sos_parse.js').parseFwder(io, _this);
	
	/* on Login request */
	socket.on('login', function(credentials /* {username} {password} */){
		/* connect gps */
		if( !_this.netConnected ){
			_this.net.connect(constant.GPS_SOAP_PORT, constant.GPS_IP, function() {
				logger.gps('('+socket.id + ') '+credentials.username+' connected to: ' + constant.GPS_IP + ':'+constant.GPS_SOAP_PORT);
				_this.netConnected = true;
				_this.username = credentials.username;
				_this.password = credentials.password;
				_this.m_RequestId = 1;
				/* make SOAP Login request */
				soapGps('', _this, 'login', credentials.username);				
			});			
		} else {
			/* make SOAP Login request */
			_this.m_RequestId = _this.m_RequestId +1;
			soapGps('', _this, 'login', credentials.username);			
		}
		/* connect sos */
		if( !_this.SoSnetConnected ){
			_this.SoSnet.connect(constant.SOS_SOAP_PORT, constant.SOS_IP, function() {
				logger.sos('('+socket.id + ') '+credentials.username+' connected to: ' + constant.SOS_IP + ':'+constant.SOS_SOAP_PORT);
				_this.SoSnetConnected = true;
				_this.username = credentials.username;
				_this.password = credentials.password;
				_this.m_SosRequestId = 1;
				/* make SOAP Login request */
				soapSos('', _this, 'login', credentials.username);				
			});			
		} else {
			/* make SOAP Login request */
			_this.m_SosRequestId = _this.m_SosRequestId +1;
			soapSos('', _this, 'login', credentials.username);			
		}
	});

	/* on GetUserLastPosition request */
	socket.on('GetUserLastPosition', function(userid/* {userid} */){	
		if( ! _this.netConnected ){
			_this.net.connect(constant.GPS_SOAP_PORT, constant.GPS_IP, function() {
				logger.gps(socket.id + ' connected to: ' + constant.GPS_IP + ':'+constant.GPS_SOAP_PORT);
				_this.netConnected = true;	
				if(_this.username) {
					/* make SOAP Login request */
					soapGps('', _this, 'login', _this.username);
				} else {
					/* not authenticated */
					logger.gps(socket.id+" unable to GetLastPosition, not authenticated");
					io.to(socket.id).emit('Error', 'GPS socket not connected!');
					return;
				}
			});					
		}
		/* make SOAP GetUserLastPosition request */
		_this.m_RequestId = _this.m_RequestId +1;
		soapGps('', _this, 'GetUserLastPosition', userid);
		/* make SOAP SetTrackingFrequency request */
		_this.m_RequestId = _this.m_RequestId +1;
		soapGps('', _this, 'SetTrackingFrequency', { id : userid, frequency : _this.FrequencySecs } );
	});
	
	/* on SetTrackingFrequency request */
	socket.on('SetTrackingFrequency', function(userid/* {userid} */){	
		if( ! _this.netConnected ){
			_this.net.connect(constant.GPS_SOAP_PORT, constant.GPS_IP, function() {
				logger.gps(socket.id + ' connected to: ' + constant.GPS_IP + ':'+constant.GPS_SOAP_PORT);
				_this.netConnected = true;	
				if(_this.username) {
					/* make SOAP Login request */
					soapGps('', _this, 'login', _this.username);
				} else {
					/* not authenticated */
					logger.gps(socket.id+" unable to SetTrackingFrequency, not authenticated");
					io.to(socket.id).emit('Error', 'GPS socket not connected!');
					return;
				}
			});					
		}
		/* make SOAP SetTrackingFrequency request */
		_this.m_RequestId = _this.m_RequestId +1;
		soapGps('', _this, 'SetTrackingFrequency', { id : userid, frequency : _this.FrequencySecs });
	});
	
	/* on SetTrackingFrequency value */
	socket.on('SetTrackingFrequencyValue', function(newValue/* {newValue} */){	
		_this.FrequencySecs = newValue;
		logger.gps(socket.id+' ('+_this.username+') Set tracking frequency value set to '+newValue);
		/* send new subscription to users */
		for (var i = 0; i < _this.subscriptions.length; i++) {
			logger.gps(socket.id+' ('+_this.username+') Renewing subscription for user ' + _this.subscriptions[i]);
			_this.m_RequestId = _this.m_RequestId +1;
			soapGps('', _this, 'SetTrackingFrequency', { id : _this.subscriptions[i], frequency : _this.FrequencySecs });
		}
		/* update last subscription time */
		var now = new Date().getTime();
		_this.lastSubscription = now;
	});
	
	/* on GetImmediateGpsData request */
	socket.on('GetImmediateGpsData', function(/* userid */){	
		if( ! _this.netConnected ){
			_this.net.connect(constant.GPS_SOAP_PORT, constant.GPS_IP, function() {
				logger.gps(socket.id + ' connected to: ' + constant.GPS_IP + ':'+constant.GPS_SOAP_PORT);
				_this.netConnected = true;	
				if(_this.username) {
					/* make SOAP Login request */
					soapGps('', _this, 'login', _this.username);
				} else {
					/* not authenticated */
					logger.gps(socket.id+" unable to GetImmediateGpsData, not authenticated");
					io.to(socket.id).emit('Error', 'GPS socket not connected!');
					return;
				}
			});					
		}
		/* make SOAP GetImmediateGpsData request for all subscribed users */
		for (var i = 0; i < _this.subscriptions.length; i++) {
			logger.gps(socket.id+' ('+_this.username+') sent GetImmediateGpsData request for user ' + _this.subscriptions[i]);
			_this.m_RequestId = _this.m_RequestId +1;
			soapGps('', _this, 'GetImmediateGpsData', _this.subscriptions[i]);
		}
	});
	
	/* on HistoryQuery request */
	socket.on('HistoryQuery', function(data/* {userid} {start} {end}  */){	
		if( ! _this.netConnected ){
			_this.net.connect(constant.GPS_SOAP_PORT, constant.GPS_IP, function() {
				logger.gps(socket.id + ' connected to: ' + constant.GPS_IP + ':'+constant.GPS_SOAP_PORT);
				_this.netConnected = true;	
				if(_this.username) {
					/* make SOAP Login request */
					soapGps('', _this, 'login', _this.username);
				} else {
					/* not authenticated */
					logger.gps(socket.id+" unable to do HistoryQuery, not authenticated");
					io.to(socket.id).emit('Error', 'GPS socket not connected!');
					return;
				}
			});					
		}
		/* make SOAP HistoryQuery request */
		_this.m_RequestId = _this.m_RequestId +1;
		soapGps('', _this, 'HistoryQuery', { id : data.userid, TimestampStart : data.start, TimestampEnd : data.end });
	});
	
	/* on Socket.io disconnection */
    socket.on('disconnect', function() {
		/* destroy tcp connections */
		_this.net.destroy();
		_this.fwd.destroy();
		_this.SoSnet.destroy();
		_this.SoSfwd.destroy();
		/* cleanup clients object */
		clients[socket.id] = null;
		delete clients[socket.id];
		logger.info('Client gone (id=' + socket.id + '). Clients connected = '+Object.keys(clients).length);
    });
	
	/* on Socket.io error */
	socket.on('error', function (exception) {
		/* destroy tcp connections */
		_this.net.destroy();
		_this.fwd.destroy();
		/* cleanup clients object */
		clients[socket.id] = null;
		delete clients[socket.id];
		logger.error('Socket error (id=' + socket.id + '). Exception = '+exception);
	});

});

/* http listener */
http.listen(constant.PORT, function(){
	logger.info('Mobile Tornado Node.js api, Site: '+constant.SITE);
	logger.info('listening on *:'+constant.PORT);
});

/* socket.io keep-alive helper func */
function keepalive() {
	for (var socket in clients) {		  
		io.to(clients[socket].id).emit('KA', 'hello');
	}
}