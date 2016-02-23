var io = require('socket.io'),
	constant = require('../config.js'),
	S = require('string'),
	net = require('net'),
	logger = require("../lib/log_module.js"),
	xml2js = require('xml2js'),
	soapSos = require('../lib/soapSos_module.js');
	
var _this = this;

/* define SOS forwarder constants */
var STATE_INIT =                   0;
var STATE_LOGIN_REQ =              1;
var STATE_LOGIN_CONT_REQ =         2;
var STATE_LOGIN_FAILED =           3;
var STATE_READY =                  4;
var STATE_WAIT_SUBSCRIBE =         5;
var STATE_WAIT_AUTO_APPROVE_RESP = 6;
var STATE_WAIT_ACK_RESP =          7;
var STATE_WAIT_CLOSE_RESP =        8;
var STATE_WAIT_HIST_RESP =         9;
var QUERY_EXTENDED_INFO_RESP =    10;

var OPCODE_HELLO = 				1;
var OPCODE_SOS_DATA = 			2;
var OPCODE_ACK = 				4;
var OPCODE_VERSION_MISMATCH = 	6;
var OPCODE_CONNECTED = 			7;

/* Parse NET response */
module.exports.parseSoap = function (io, client) {
	/* SubscribeForOrgUpdates timer */
	client.SosSubscriptionInterval = setInterval(function(){ SubscribeForOrgUpdates(); }, constant.KA_TIMER_MS );
	var parser = new xml2js.Parser({
		normalize: true,
		trim: false,
		explicitArray: false
	});
	//client.SoSnet.setEncoding('utf8');
	var soapEnv = '';
	client.SoSnet.on('data', function(response) {
		if(client.m_SoSnState  != 'STATE_WAIT_HIST_RESP') {
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
					client.m_SoSnState= 'STATE_READY';
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
			logger.sos(client.id+' ('+client.username+') Fault: '+FaultStr);
			return; 
		}
		var response = xmlResponse['env:Envelope']['env:Header']['n:Response']._;
		/* handle Login response */
		if (response == 'Login'){
			/* make SOAP LoginContinue request */
			soapSos(xmlResponse, client, '');
		}
		/* handle LoginContinue response */
		if (response == 'LoginContinue') {
			if(xmlResponse['env:Envelope']['env:Body']['n:ResponseLoginContinue']['n:ErrCode'] == "ok") {
				
				var nTimeMsecServer = xmlResponse['env:Envelope']['env:Body']['n:ResponseLoginContinue']['n:CurrentTime'];
				var nTimeMsecOur = new Date().getTime();
				
				if (nTimeMsecServer != 0) {
					client.m_SosTimeMsecDiff= nTimeMsecOur - nTimeMsecServer;
					logger.sos(client.id+' ('+client.username+') Clock difference is ' + client.m_SosTimeMsecDiff);
				}
				else {
					client.m_TimeMsecDiff= 0;
					logger.sos(client.id+' ('+client.username+') Old Server Plug-In. No clock difference calculation will be executed.');
				}
				client.m_SoSnState= 'STATE_READY';
				client.m_SosRequestId = 0;

				/* Successful login */
				io.to(client.id).emit('status', { service: 'sos', state: 1/*SOAP only*/ });
				//io.to(client.id).emit('Login', 'OK');
			
				/* Connect TCP Forwarder */
				if( !client.SoSfwdConnected ){
					_this.connectFwder(client);
				}
			} else {
				/* Unsuccessful login */
				//io.to(client.id).emit('Error', "invalid login");
				client.SoSnet.destroy();
			}
		}
		/* handle Subscribe response */
		if (response == 'Subscribe') {
			if(xmlResponse['env:Envelope']['env:Body']['n:ResponseSubscribe']['n:Status'] == "none") {
				logger.sos(client.id+' ('+client.username+') Organisation subscription renewal ok');
				var data = xmlResponse['env:Envelope']['env:Body']['n:ResponseSubscribe']['n:EntitySosData'];
				if(data) {
					var returnData = [];
					/* multiple alerts array */
					if (data instanceof Array) {
						for ( var i=0 ; i< data.length; i++ ) {
							var item = { OrgID: data[i]['n:Entity']['n:Org'], UserID: data[i]['n:Entity']['n:User'], SosID: data[i]['n:SosData']['n:SosID'], 
										 TimeStart: data[i]['n:SosData']['n:TimeStart'], Action: data[i]['n:SosData']['n:Action'], Priority: data[i]['n:SosData']['n:Priority'] };
							returnData.push( item);
						}
					} else /* single alert object */ {
						var item = { OrgID: data['n:Entity']['n:Org'], UserID: data['n:Entity']['n:User'], SosID: data['n:SosData']['n:SosID'], 
									 TimeStart: data['n:SosData']['n:TimeStart'], Action: data['n:SosData']['n:Action'], Priority: data['n:SosData']['n:Priority'] };
						returnData.push( item);
					}
					io.to(client.id).emit('SOS', returnData);
				}
			}
		}
	});
		
	/* handle NET closure */
	client.SoSnet.on('close', function() {
		clearInterval(client.SosSubscriptionInterval);
		client.SoSnetConnected = false;
		logger.sos(client.id + ' net connection closed');
	});
	
	/* handle NET error */
	client.SoSnet.on('error', function(ex) {
		client.SoSnetConnected = false;
		io.to(client.id).emit('Error', ex);
	});
	
	/* handle TCP uncaughtException */
	client.SoSnet.on('uncaughtException', function (err) {
		logger.error(err.stack);
		logger.sos(client.id+' ('+client.username+') NET uncaughtException');
	});
	
	function SubscribeForOrgUpdates() {
		/* try clear zombie socket.io connections */
		if(!client.username) {
			clearInterval(client.SosSubscriptionInterval);
			if (io.sockets.connected[client.id]) {
				io.sockets.connected[client.id].disconnect();
				return;
			}
		}
		/* SubscribeForOrgUpdates */
		++client.m_SosRequestId ;
		soapSos('', client, 'Subscribe', { expiration : 80  } );
		/* send forwarder hello */
		_this.FwdHello(client);
	}

};

/* Connect TCP Forwarder */
module.exports.connectFwder = function (client) {
	client.SoSfwd.connect(constant.SOS_FWD_PORT, constant.SOS_IP , function() {
		logger.sos(client.id+' ('+client.username+') connected to forwarder: ' + constant.SOS_IP + ':'+constant.SOS_FWD_PORT);
		client.SoSfwdConnected = true;
		_this.FwdHello(client);
	});	
};

/* Send Hello (Keep-Alive) */
module.exports.FwdHello = function (client) {
	if(client.SoSfwdConnected) {
		//logger.debug(client.id+' ('+client.username+') sent Hello to sos forwarder, appID='+client.SoSAppID);
		var buffer = new Buffer(21);
		var writer = new BinaryWriter(buffer);
		//writer.writeUInt32BE(0); 								/* Request Type. */ /* Removed in the SOS forwarder. */
		writer.writeUInt32BE(16); 								/* Length. */
		writer.writeUInt8(1); 									/* Opcode. */
		writer.writeUInt32BE(client.SoSAppID / 0x100000000); 	/* SOS Server ID. */
		writer.writeUInt32BE(client.SoSAppID & 0xffffffff); 	/* SOS Server ID part 2. */
		writer.writeUInt32BE(3 << 24); 							/* SOS Server Version (my version). */
		writer.writeUInt32BE(3 << 24); 							/* Oldest supported IPRS Server Version. */

		client.SoSfwd.write(buffer);
	} else {
		_this.connectFwder(client);
	}
};

/* Parse TCP Forwarder */
module.exports.parseFwder = function (io, client) {

	var nPktHeaderLength = 0/*4*/ /*Request Type*/ /* Removed in the SOS forwarder. */ + 4/*Payload Length*/ + 1/*Opcode*/;
	var nPktSOSDataPktHeaderLength = 8/*SOS Server ID*/   + 4/*Message ID*/ + 4/*Message ID salt*/ +
											   0/*4*//*RequestType*/+ 8/*Timestamp*/  + 8/*Server ID*/       +
											   4/*Server Version*/  + 8/*User ID*/    + 8/*Organization ID*/ +
											   4/*SOS Data Length*/;
											   
	var i;
	var n;
	var nPayloadLen;
	var nOpcode;
	var nSosRequestType;
	var nMessageIDHigh;
	var nMessageIDLow;
	var nServerVersion;
	var nUserIDLow;
	var nUserIDHigh;
	var strBody;
	var strUserID;
	var strTime;
	var nOrgID;
	var nPktLen;
	var nDataLen;
	var nSOSDataType;
	var nSOSDataLen;
	var nSOSDataVal;
	var nLng;
	var nLat;
	var nTime;
	var eventObj;

	/* Forwarder incoming data handler */
	client.SoSfwd.on('data', function(data) {
		var bytes = new Buffer(0); 
        var tmpBuffer = new Buffer(bytes.length + data.length);
        bytes.copy(tmpBuffer);
        data.copy (tmpBuffer, bytes.length );
        bytes = tmpBuffer;
        tmpBuffer = null;
        var nPktLen= 1/*dummy*/;

		if(bytes.length < nPktHeaderLength) {
			logger.sos(client.id+' ('+client.username+') Waiting for the rest of the FWD packet header.');
		}
		else while((nPktLen != 0) && bytes.length >= nPktHeaderLength) {
			var reader = new BinaryReader(bytes);
			//logger.sos(reader);
			// Process output:
			nPktLen= 0;
			//n = reader.readUInt32BE();				/* Removed in the SOS forwarder. */
			nPayloadLen= reader.readUInt32BE();
			nOpcode = reader.readUInt8();
			
			switch (nOpcode) {
			case OPCODE_CONNECTED:
				logger.sos(client.id+' ('+client.username+') Got Hello Confirmation');  
				nPktLen= 9;
				if(client.SoSfwdLoggedIn == false) {
					client.SoSfwdLoggedIn = true;
					io.to(client.id).emit('status', { service: 'sos', state: 2 /*FWD Hello*/});
					/* SubscribeForOrgUpdates */
					++client.m_SosRequestId ;
					setTimeout( function() { soapSos('', client, 'Subscribe', { expiration : 80  } ) }, 10 * 1000);
				}
				break;
			case OPCODE_VERSION_MISMATCH:
				logger.sos(client.id+' ('+client.username+') Got version mismatch with GPS notifications forwarder.');
				nPktLen= 25;
				break;
			case OPCODE_SOS_DATA:
				if (bytes.length >= (nPktHeaderLength + nPktSOSDataPktHeaderLength))
				{
					n=               reader.readUInt32BE();
					n=               reader.readUInt32BE();
					nMessageIDHigh=  reader.readUInt32BE();
					nMessageIDLow=   reader.readUInt32BE();
					//nGpsRequestType= reader.readUInt32BE();
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
					if (bytes.length >= (nPktHeaderLength + nPktSOSDataPktHeaderLength + nDataLen)) {
						strUserID= ConvertHL264bit( nUserIDHigh, nUserIDLow);
						logger.sos(client.id+' ('+client.username+') Got data payload for userid '+strUserID);
						if (nDataLen > 0)
						{
							//strBody= m_bytearrayIncomingPkt.readUTFBytes( nDataLen);
							//HandleSOSNotification( strBody);
						}
						logger.sos(client.id+' ('+client.username+') Finished Parsing FWD Packet.');
						SendAck(client, nMessageIDHigh, nMessageIDLow);
						nPktLen= nPktHeaderLength + nPktSOSDataPktHeaderLength + nDataLen;
					}
					else {
						logger.warn(client.id+' ('+client.username+') Waiting for the rest of the SOS FWD data.');
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
	client.SoSfwd.on('close', function() {
		client.SoSfwdConnected = false;
		client.SoSfwdLoggedIn  = false;
		logger.sos(client.id+' ('+client.username+') fwd connection closed');
	});
	
	/* handle TCP uncaughtException */
	client.SoSfwd.on('uncaughtException', function (err) {
		logger.error(err.stack);
		logger.sos(client.id+' ('+client.username+') FWD uncaughtException');
	});

};

/* send Ack */
function SendAck(client, nMessageIDHigh, nMessageIDLow) {

	var buffer = new Buffer(25);
	var writer = new BinaryWriter(buffer);
	//writer.writeUInt32BE( 0);								/* Request Type. */    /* Removed in the SOS forwarder. */
	writer.writeUInt32BE( 20);								/* Length. */
	writer.writeUInt8( OPCODE_ACK);							/* Opcode. */
	writer.writeUInt32BE( client.SoSAppID / 0x100000000);	/* SOS Server ID. */
	writer.writeUInt32BE( client.SoSAppID & 0xffffffff);	/* SOS Server ID part 2. */
	writer.writeUInt32BE( nMessageIDHigh);					/* Message ID. */
	writer.writeUInt32BE( nMessageIDLow);					/* Message ID. */
	writer.writeUInt32BE( 0/*OK*/); 						/* Response Code. */

    client.SoSfwd.write(buffer);
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