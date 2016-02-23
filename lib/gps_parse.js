var io = require('socket.io'),
	constant = require('../config.js'),
	S = require('string'),
	net = require('net'),
	logger = require("../lib/log_module.js"),
	xml2js = require('xml2js'),
	soapGps = require('../lib/soapGps_module.js');
	
var _this = this;

/* define GPS forwarder constants */
var GPS_NONE = 					0;		// Designate end of data?
var GPS_LONGITUDE = 			2;		// degrees, multipled by 10^6; -180E6 to 180E6
var GPS_LATITUDE = 				3;		// degrees, multipled by 10^6; -90E6 to 90E6
var GPS_TIMESTAMP = 			16;		// Time (in seconds since 1/6/1980) when measurement was taken 

var OPCODE_HELLO = 				1;
var OPCODE_GPS_DATA = 			2;
var OPCODE_ACK = 				4;
var OPCODE_VERSION_MISMATCH = 	6;
var OPCODE_CONNECTED = 			7;

/* Parse NET response */
module.exports.parseSoap = function (io, client) {
	/* SubscribeForUserPositionUpdates timer */
	client.subscriptionInterval = setInterval(function(){ SubscribeForUserPositionUpdates(); }, constant.KA_TIMER_MS );
	var parser = new xml2js.Parser({
		normalize: true,
		trim: true,
		explicitArray: false
	});
	//client.net.setEncoding('utf8');
	var soapEnv = '';
	client.net.on('data', function(response) {
		if(client.m_nState  != 'STATE_WAIT_HIST') {
			parser.parseString(response);
		} else {
			/* berfore parsing, check the soap envelope is complete */
			var read = response.toString();
			if (read.substr(read.length-15) === "</env:Envelope>") {
				if(soapEnv.length > 0) {
					/* last chunk received, pass to xml parser */
					soapEnv += response
					parser.parseString(soapEnv);
					soapEnv = '';
					client.m_nState= 'STATE_READY';
				}
				/* soap envelope is complete, pass to xml parser */
				parser.parseString(response);
			} else {
				/* not soap response */
				if (read.substr(0, 4) === "HTTP") return;
				/* add chunck to soapEnv */
				soapEnv += response;
			}
		}
	});
	
	parser.addListener('end', function( xmlResponse ) {
		/* handle bad response */
		if(xmlResponse == null) return;
		if(xmlResponse['env:Envelope'] == null) return;
		//io.to(client.id).emit('SOAP', xmlResponse);
		if (typeof xmlResponse['env:Envelope']['env:Body']['env:Fault'] != 'undefined') {
			var FaultStr = xmlResponse['env:Envelope']['env:Body']['env:Fault']['env:Reason']['env:Text']._;
			/* just a KA request, dont show error */
			if(FaultStr.indexOf("(when trying to set user tracking frequency)") > -1) return;
			logger.gps('('+client.username+') Fault: '+FaultStr);
			return; 
		}
		var response = xmlResponse['env:Envelope']['env:Header']['n:Response']._;
		/* handle Login response */
		if (response == 'Login'){
			/* make SOAP LoginContinue request */
			soapGps(xmlResponse, client, '');
		}
		/* handle LoginContinue response */
		if (response == 'LoginContinue') {
			if(xmlResponse['env:Envelope']['env:Body']['n:ResponseLoginContinue']['n:ErrCode'] == "ok") {
				
				var nTimeMsecServer = xmlResponse['env:Envelope']['env:Body']['n:ResponseLoginContinue']['n:CurrentTime'];
				var nTimeMsecOur = new Date().getTime();
				
				if (nTimeMsecServer != 0) {
					client.m_TimeMsecDiff= nTimeMsecOur - nTimeMsecServer;
					logger.gps('('+client.username+') Clock difference is ' + client.m_TimeMsecDiff);
				}
				else {
					client.m_TimeMsecDiff= 0;
					logger.gps('('+client.username+') Old Server Plug-In. No clock difference calculation will be executed.');
				}
				client.m_nState= 'STATE_READY';
				client.m_RequestId = 0;
				client.lastSubscription = nTimeMsecOur;
				/* Successful login */
				io.to(client.id).emit('status', { service: 'gps', state: 1/*SOAP only*/ });
				io.to(client.id).emit('Login', 'OK');
			
				/* Connect TCP Forwarder */
				if( !client.fwdConnected ){
					_this.connectFwder(client);
				}
			} else {
				/* Unsuccessful login */
				io.to(client.id).emit('Error', "invalid login");
				client.net.destroy();
			}
		}
		/* handle GetLastPosition response */
		if ((response == 'GetLastPosition') &&
			(xmlResponse['env:Envelope']['env:Body']['n:ResponseGetLastPosition']['n:Status'] == "none"/*no error*/)) {

			var data = {
				strUserID : xmlResponse['env:Envelope']['env:Body']['n:ResponseGetLastPosition']['n:EntityGpsData']['n:Entity']['n:User'],
				strTime :   xmlResponse['env:Envelope']['env:Body']['n:ResponseGetLastPosition']['n:EntityGpsData']['n:GpsData']['n:TimeStamp'],
				strLongitude : xmlResponse['env:Envelope']['env:Body']['n:ResponseGetLastPosition']['n:EntityGpsData']['n:GpsData']['n:longitude'] / 1000000,
				strLatitude :  xmlResponse['env:Envelope']['env:Body']['n:ResponseGetLastPosition']['n:EntityGpsData']['n:GpsData']['n:latitude'] / 1000000
			};
			logger.gps(client.id+' ('+client.username+') got position for '+data.strUserID);
			/* add successful user to subscription */
			if (!client.subscriptions.indexOf(data.strUserID) > -1) {
				logger.gps(client.id+' ('+client.username+') adding user to subscriptions array: '+data.strUserID);
				client.subscriptions.push( data.strUserID);
			}
			io.to(client.id).emit('GPS', data);
		}
		/* handle SetTrackingFrequency response */
		if ((response == 'SetTrackingFrequency') &&
			(xmlResponse['env:Envelope']['env:Body']['n:ResponseSetTrackingFrequency']['n:Status'] == "none"/*no error*/)) {

			logger.gps(client.id+' ('+client.username+') SetTrackingFrequency response received OK');
		}
		/* handle HistoryQuery response */
		if ((response == 'HistoryQuery') &&
			(xmlResponse['env:Envelope']['env:Body']['n:ResponseHistoryQuery']['n:Status'] == "none"/*no error*/)) {
			var returnData = {};
			returnData.user = xmlResponse['env:Envelope']['env:Body']['n:ResponseHistoryQuery']['n:Entity']['n:User'];
			returnData.data = [];
			logger.gps(client.id+' ('+client.username+') HistoryQuery response for ' +returnData.user+ ' received OK');
			var dataArray = xmlResponse['env:Envelope']['env:Body']['n:ResponseHistoryQuery']['n:GpsData'];
			for ( var i=0 ; i< dataArray.length; i++ ) {
				var strTime =      dataArray[i]['n:TimeStamp'];
				var strLongitude = dataArray[i]['n:longitude'];
				var strLatitude =  dataArray[i]['n:latitude'];
				var nLongitude =   parseInt( strLongitude) / 1000000;
				var nLatitude =    parseInt( strLatitude)  / 1000000;
				var item = { lat:nLatitude, lng:nLongitude, timestamp:strTime };
				returnData.data.push(item);
			}
			io.to(client.id).emit('GPShistory', returnData);
		}
	});
		
	/* handle NET closure */
	client.net.on('close', function() {
		clearInterval(client.subscriptionInterval);
		client.netConnected = false;
		logger.gps(client.id + ' net connection closed');
	});
	
	/* handle NET error */
	client.net.on('error', function(ex) {
		client.netConnected = false;
		io.to(client.id).emit('Error', ex);
	});
	
	/* handle TCP uncaughtException */
	client.net.on('uncaughtException', function (err) {
		logger.error(err.stack);
		logger.gps(client.id+' ('+client.username+') NET uncaughtException');
	});
	
	/* SubscribeForUserPositionUpdates timer */
	function SubscribeForUserPositionUpdates() {
		/* try clear zombie socket.io connections */
		if(!client.username) {
			clearInterval(client.subscriptionInterval);
			if (io.sockets.connected[client.id]) {
				io.sockets.connected[client.id].disconnect();
				return;
			}
		}
		/* SubscribeForUserPositionUpdates */
		var now = new Date().getTime();
		var diff = now - client.lastSubscription;
		if(diff > constant.GPS_SUBSCRIPTION_TIMER_MS) {
			logger.gps(client.id+' ('+client.username+') Renewing subscriptions, this is a '+constant.GPS_SUBSCRIPTION_TIMER_MS / 60000 +' min interval');
			for (var i = 0; i < client.subscriptions.length; i++) {
				logger.gps(client.id+' ('+client.username+') Renewing subscription for user ' + client.subscriptions[i]);
				client.m_RequestId = client.m_RequestId +1;
				soapGps('', client, 'SetTrackingFrequency', { id : client.subscriptions[i], frequency : client.FrequencySecs });
			}
			client.lastSubscription = now;
		}
		/* send dummy soap request to stop network killing session */
		soapGps('', client, 'SetTrackingFrequency', { id : 0 /* dummy id 0 */, frequency : client.FrequencySecs } );
		/* send forwarder hello */
		_this.FwdHello(client);
	}
};

/* Connect TCP Forwarder */
module.exports.connectFwder = function (client) {
	client.fwd.connect(constant.GPS_FWD_PORT, constant.GPS_IP , function() {
		logger.gps(client.id+' ('+client.username+') connected to forwarder: ' + constant.GPS_IP + ':'+constant.GPS_FWD_PORT);
		client.fwdConnected = true;
		_this.FwdHello(client);
	});	
};

/* Send Hello (Keep-Alive) */
module.exports.FwdHello = function (client) {
	if(client.fwdConnected) {
		//logger.debug(client.id+' ('+client.username+') sent Hello to gps forwarder, appID='+client.AppID);
		var buffer = new Buffer(25);
		var writer = new BinaryWriter(buffer);
		writer.writeUInt32BE(0); 							/* Request Type. */
		writer.writeUInt32BE(16); 							/* Length. */
		writer.writeUInt8(1); 								/* Opcode. */
		writer.writeUInt32BE(client.AppID / 0x100000000); 	/* GPS Server ID. */
		writer.writeUInt32BE(client.AppID & 0xffffffff); 	/* GPS Server ID part 2. */
		writer.writeUInt32BE(3 << 24); 						/* GPS Server Version (my version). */
		writer.writeUInt32BE(3 << 24); 						/* Oldest supported IPRS Server Version. */

		client.fwd.write(buffer);
	} else {
		_this.connectFwder(client);
	}
};

/* Parse TCP Forwarder */
module.exports.parseFwder = function (io, client) {

	var nPktHeaderLength = 			 4/*Request Type*/    + 4/*Payload Length*/ + 1/*Opcode*/,
		nPktGPSDataPktHeaderLength = 8/*GPS Server ID*/   + 4/*Message ID*/ + 4/*Message ID salt*/ +
									 4/*Request Type*/    + 8/*Timestamp*/  + 8/*Server ID*/       +
									 4/*Server Version*/  + 8/*User ID*/    + 8/*Organization ID*/ +
									 4/*GPS Data Length*/;
	var i;
	var n;
	var nPayloadLen;
	var nOpcode;
	var nGpsRequestType;
	var nMessageIDHigh;
	var nMessageIDLow;
	var nServerVersion;
	var nUserIDLow;
	var nUserIDHigh;
	var strUserID;
	var strTime;
	var strLongitude;
	var strLatitude;
	var nOrgID;
	var nPktLen;
	var nDataLen;
	var nGPSDataType;
	var nGPSDataLen;
	var nGPSDataVal;
	var nLng;
	var nLat;
	var nTime;
	var bHasLng;
	var bHasLat;
	var eventObj;

	/* Forwarder incoming data handler */
	client.fwd.on('data', function(data) {

		var bytes = new Buffer(0); 
        var tmpBuffer = new Buffer(bytes.length + data.length);
        bytes.copy(tmpBuffer);
        data.copy (tmpBuffer, bytes.length );
        bytes = tmpBuffer;
        tmpBuffer = null;
		
        var nPktLen= 1/*dummy*/;

		if(bytes.length < nPktHeaderLength) {
			logger.gps(client.id + ' Waiting for the rest of the FWD packet header.');
		}
		else while((nPktLen != 0) && bytes.length >= nPktHeaderLength) {

			var reader = new BinaryReader(bytes);
			// Process output:
			nPktLen= 0;
			n = reader.readUInt32BE();
			nPayloadLen= reader.readUInt32BE();
			nOpcode = reader.readUInt8();
			
			switch (nOpcode) {
			case OPCODE_CONNECTED:
				logger.gps(client.id+' ('+client.username+') Got Hello Confirmation');  
				nPktLen= 9;
				if(client.fwdLoggedIn == false) {
					client.fwdLoggedIn = true;
					io.to(client.id).emit('status', { service: 'gps', state: 2 /*FWD Hello*/});
				}
				break;
			case OPCODE_VERSION_MISMATCH:
				logger.gps(client.id+' ('+client.username+') Got version mismatch with GPS notifications forwarder.');
				nPktLen= 25;
				break;
			case OPCODE_GPS_DATA:
				if (bytes.length >= (nPktHeaderLength + nPktGPSDataPktHeaderLength))
				{
					n=               reader.readUInt32BE();
					n=               reader.readUInt32BE();
					nMessageIDHigh=  reader.readUInt32BE();
					nMessageIDLow=   reader.readUInt32BE();
					nGpsRequestType= reader.readUInt32BE();
					nTime=           reader.readUInt32BE();
					nTime *=         0x100000000;
					nTime +=         reader.readUInt32BE();
					n=               reader.readUInt32BE();
					n=               reader.readUInt32BE();
					nServerVersion=  reader.readUInt32BE();
					nUserIDHigh=     reader.readUInt32BE();
					nUserIDLow=      reader.readUInt32BE();
					n=               reader.readUInt32BE();
					nOrgID=          reader.readUInt32BE();
					nDataLen=        reader.readUInt32BE();
					bHasLng=  false;
					bHasLat=  false;
					if (bytes.length >= (nPktHeaderLength + nPktGPSDataPktHeaderLength + nDataLen)) {
						strUserID= ConvertHL264bit( nUserIDHigh, nUserIDLow);
						logger.gps(client.id+' ('+client.username+') Got data payload for userid '+strUserID);
						for ( i=0 ; i<nDataLen ; ) {
							nGPSDataLen= 0;
							nGPSDataType= reader.readUInt8();
							i++;
							if (nGPSDataType != GPS_NONE) {
								nGPSDataLen=  reader.readUInt16BE();
								i += 2;
								if (nGPSDataLen != 4) {
									nGPSDataVal= 0;
									if ((nGPSDataLen >= 0) && ((i + nGPSDataLen) <= nDataLen)) {
										reader.seek(nGPSDataLen);
									}
									else {
										i= nDataLen;	/* Exit the loop. Length too high */
									}
								}
								else {
									nGPSDataVal= reader.readInt32BE();
									switch (nGPSDataType) {
										case GPS_LONGITUDE:	nLng=  nGPSDataVal;		bHasLng=  true;		break;
										case GPS_LATITUDE:	nLat=  nGPSDataVal;		bHasLat=  true;		break;
										//case GPS_TIMESTAMP:nTime=nGPSDataVal;		bHasTime= true;		break;
										default:														break;
									}
								}
								i += nGPSDataLen;
							}
						}
						if ((bHasLng == true) && (bHasLat == true)) {
							strTime = 	   nTime.toString();
							strLongitude = nLng.toString();
							strLatitude =  nLat.toString();
							logger.gps(client.id+' ('+client.username+') Finished Parsing FWD Packet.');
							var data = {
								strUserID : 	strUserID,
								strTime : 		strTime,
								strLongitude : 	strLongitude / 1000000,
								strLatitude :  	strLatitude / 1000000
							};
							/* Send GPS payload to client */
							io.to(client.id).emit('GPS', data);
						}
						else
							logger.error(client.id+' ('+client.username+') Warning: Partial GPS FWD Data!');
						SendAck(client, nMessageIDHigh, nMessageIDLow);
						nPktLen= nPktHeaderLength + nPktGPSDataPktHeaderLength + nDataLen;
					}
					else {
						logger.warn(client.id+' ('+client.username+') Waiting for the rest of the GPS FWD data.');
					}
				}
				break;
			}
			if (nPktLen != 0) {
				bytes = bytes.slice(nPktLen);
			}
		}
	});
	
	/* handle TCP closure */
	client.fwd.on('close', function() {
		client.fwdConnected = false;
		client.fwdLoggedIn 	= false;
		logger.gps(client.id+' ('+client.username+') fwd connection closed');
	});
	
	/* handle TCP uncaughtException */
	client.fwd.on('uncaughtException', function (err) {
		logger.error(err.stack);
		logger.gps(client.id+' ('+client.username+') FWD uncaughtException');
	});
};

/* send Ack */
function SendAck(client, nMessageIDHigh, nMessageIDLow) {

	var buffer = new Buffer(29);
	var writer = new BinaryWriter(buffer);
	writer.writeUInt32BE( 0);							/* Request Type. */
	writer.writeUInt32BE( 20);							/* Length. */
	writer.writeUInt8( OPCODE_ACK);						/* Opcode. */
	writer.writeUInt32BE( client.AppID / 0x100000000);	/* GPS Server ID. */
	writer.writeUInt32BE( client.AppID & 0xffffffff);	/* GPS Server ID part 2. */
	writer.writeUInt32BE( nMessageIDHigh);				/* Message ID. */
	writer.writeUInt32BE( nMessageIDLow);				/* Message ID. */
	writer.writeUInt32BE( 0/*OK*/); 					/* Response Code. */

    client.fwd.write(buffer);
}

/* Convert HL 264bit */
function ConvertHL264bit(nHigh, nLow) {
	var low = [281474976710656, 562949953421312, 125899906842624, 251799813685248,
	                           503599627370496, 007199254740992, 014398509481984, 028797018963968,
	                           057594037927936, 115188075855872, 230376151711744, 460752303423488,
	                           921504606846976, 843009213693952, 686018427387904, 372036854775808];
	var high = [  0,    0,    1,    2,
	              4,    9,   18,   36,
	             72,  144,  288,  576,
	           1152, 2305, 4611, 9223 ];

   	var nL= nLow;
	var nH= 0;
	var n= nHigh & 0x0000ffff;
	var i= 0;
	var binarydigit;
	var str;
	n *= 0x0100000000;
	nL += n;
	nHigh /= 0x10000;
	for ( i=0 ; (i<16) && (nHigh>0) ; i++, nHigh/=2 )
	{
		binarydigit= nHigh & 0x01;
		if (binarydigit != 0)
		{
			nL += low[i];
			nH += high[i];
			if (nL >= 1000000000000000)
			{
				nH++;
				nL -= 1000000000000000;
			}
		}
	}
	if (nH > 0)
	{
		str= "000000000000000" + nL.toString();
		str= str.substr( str.length - 15);
		str= nH.toString() + str;
	}
	else
		str= nL.toString();
	return (str);  

}
	
/* Buffer helpers */
function BinaryReader(buffer) {
	this.buffer = buffer;
}

BinaryReader.prototype.readUInt8 = function() {
	var ret = this.buffer.readUInt8(0);
	this.buffer = this.buffer.slice(1);
	return ret;
}

BinaryReader.prototype.readUInt32BE = function() {
	var ret = this.buffer.readUInt32BE(0);
	this.buffer = this.buffer.slice(4);
	return ret;
}

BinaryReader.prototype.readInt32BE = function() {
	var ret = this.buffer.readInt32BE(0);
	this.buffer = this.buffer.slice(4);
	return ret;
}

BinaryReader.prototype.readUInt16BE = function() {
	var ret = this.buffer.readUInt16BE(0);
	this.buffer = this.buffer.slice(2);
	return ret;
}

BinaryReader.prototype.seek = function(offset) {
	return this.buffer = this.buffer.slice(offset);
}

function BinaryWriter(buffer) {
	this._position = 0;
	this.buffer = buffer;
}

/*BinaryWriter.prototype.writeUInt32BE = function(val) {
	this.buffer.writeUInt32BE(val, this._position);
	this._position+=4;
}*/

BinaryWriter.prototype.writeUInt32BE = function(val) {
	this.buffer.writeUInt32BE(val, this._position, true); /* set True for linux compatibility */
	this._position+=4;
}

BinaryWriter.prototype.writeUInt8 = function(val) {
	this.buffer.writeUInt8(val, this._position);
	this._position+=1;
}