/* SOAP request func */
module.exports = function soapGps(xmlResponse, client, header, data) {
	if(xmlResponse!=''){
		var response = xmlResponse['env:Envelope']['env:Header']['n:Response']._;
		/* send LoginContinue request */
		if (response == 'Login'){
			client.AppID = xmlResponse['env:Envelope']['env:Body']['n:ResponseLogin']['n:ApplicationID'];
			var SOAP_Headers = 	"POST /soap/gps/logincontinue HTTP/1.1\r\nHost: soap.example.com\r\nUser-Agent: SOAP-client/SecurityCenter3.0\r\n" +
								"Content-Type: application/soap+xml; charset=\"utf-8\"";
			var SOAP_Envelope= "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
				"<env:Envelope xmlns:env=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:SOAP-ENC=\"http://www.w3.org/2003/05/soap-encoding\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:n=\"http://www.mobiletornado.com/iprs/gps/soap\"><env:Header><n:Request>" +
				"LoginContinue" +"</n:Request></env:Header><env:Body>" +
				"<n:RequestLoginContinue xmlns:n=\"http://www.mobiletornado.com/iprs/gps/soap\">" +
				"<n:ApplicationID>" + xmlResponse['env:Envelope']['env:Body']['n:ResponseLogin']['n:ApplicationID'] + "</n:ApplicationID>" +
				"<n:URI>"      + xmlResponse['env:Envelope']['env:Body']['n:ResponseLogin']['n:URI'] + "</n:URI>" +
				"<n:Auth>"     + xmlResponse['env:Envelope']['env:Body']['n:ResponseLogin']['n:Auth'] + "</n:Auth>" +
				"<n:Nonce>"    + xmlResponse['env:Envelope']['env:Body']['n:ResponseLogin']['n:Nonce'] + "</n:Nonce>"  +
				"<n:Opaque>"   + xmlResponse['env:Envelope']['env:Body']['n:ResponseLogin']['n:Opaque'] + "</n:Opaque>" +
				"<n:Qop>"      + xmlResponse['env:Envelope']['env:Body']['n:ResponseLogin']['n:Qop'] + "</n:Qop>"    +
				"<n:Cnonce>"   + xmlResponse['env:Envelope']['env:Body']['n:ResponseLogin']['n:Cnonce'] + "</n:Cnonce>" +
				"<n:Realm>"    + xmlResponse['env:Envelope']['env:Body']['n:ResponseLogin']['n:Realm'] + "</n:Realm>"  +
				"<n:Response>" + client.password + "</n:Response>" +
				"</n:RequestLoginContinue></env:Body></env:Envelope>";
				
			client.net.write(SOAP_Headers + "\r\nContent-Length:" + SOAP_Envelope.length.toString() + "\r\n\r\n");
			client.net.write(SOAP_Envelope);
			return;
		}
	}
	/* send Login request */
	if(header == 'login'){
		var SOAP_Headers = 	"POST /soap/gps/login HTTP/1.1\r\nHost: soap.example.com\r\nUser-Agent: SOAP-client/SecurityCenter3.0\r\n" +
							"Content-Type: application/soap+xml; charset=\"utf-8\"";		
		var SOAP_Envelope=  "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
							"<env:Envelope xmlns:env=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:SOAP-ENC=\"http://www.w3.org/2003/05/soap-encoding\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:n=\"http://www.mobiletornado.com/iprs/gps/soap\"><env:Header><n:Request>" +
							"Login" +
							"</n:Request></env:Header><env:Body>" +
							"<n:RequestLogin xmlns:n=\"http://www.mobiletornado.com/iprs/gps/soap\">" +
							"<n:Name>"+data+"</n:Name>" +
							"<n:OrgID>0</n:OrgID>" +										
							"<n:LoginEntityType>dispatcher</n:LoginEntityType>" +
							"<n:AuthType>simple</n:AuthType>" +
							"</n:RequestLogin></env:Body></env:Envelope>";
					
		client.net.write(SOAP_Headers + "\r\nContent-Length:" + SOAP_Envelope.length.toString() + "\r\n\r\n");
		client.net.write(SOAP_Envelope);
		return;
	}
	/* send GetUserLastPosition request */
	if(header == 'GetUserLastPosition'){
		var SOAP_Headers = 	"POST /soap/gps/getlastposition HTTP/1.1\r\nHost: soap.example.com\r\nUser-Agent: SOAP-client/SecurityCenter3.0\r\nContent-Type: application/soap+xml; charset=\"utf-8\"";		
		var SOAP_Envelope=  "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
							"<env:Envelope xmlns:env=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:SOAP-ENC=\"http://www.w3.org/2003/05/soap-encoding\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:n=\"http://www.mobiletornado.com/iprs/gps/soap\"><env:Header><n:Request>" +
							"GetLastPosition" +
							"</n:Request></env:Header><env:Body>" +
							"<n:RequestGetLastPosition xmlns:n=\"http://www.mobiletornado.com/iprs/gps/soap\">" +
							"<n:ApplicationID>" + client.AppID + "</n:ApplicationID><n:RequestID>"+ client.m_RequestId +"</n:RequestID>" +
							"<n:DataSpecifier><n:Entity><n:User>" + data + "</n:User></n:Entity>" +				
							"<n:GpsDataMask><n:Type><n:GpsDataType>longitude</n:GpsDataType><n:GpsDataType>latitude</n:GpsDataType></n:Type></n:GpsDataMask>" +
							"</n:DataSpecifier></n:RequestGetLastPosition>" +
							"</env:Body></env:Envelope>";	
				
		client.net.write(SOAP_Headers + "\r\nContent-Length:" + SOAP_Envelope.length.toString() + "\r\n\r\n");
		client.net.write(SOAP_Envelope);
		return;
	}
	/* send SetTrackingFrequency request */
	if(header == 'SetTrackingFrequency'){
		var SOAP_Headers = 	"POST /soap/gps/settrackingfrequency HTTP/1.1\r\nHost: soap.example.com\r\nUser-Agent: SOAP-client/SecurityCenter3.0\r\nContent-Type: application/soap+xml; charset=\"utf-8\"";		
		var SOAP_Envelope=  "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
							"<env:Envelope xmlns:env=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:SOAP-ENC=\"http://www.w3.org/2003/05/soap-encoding\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:n=\"http://www.mobiletornado.com/iprs/gps/soap\"><env:Header><n:Request>" +
							"SetTrackingFrequency" +
							"</n:Request></env:Header><env:Body>" +
							"<n:RequestSetTrackingFrequency xmlns:n=\"http://www.mobiletornado.com/iprs/gps/soap\">" +
							"<n:ApplicationID>" + client.AppID + "</n:ApplicationID><n:RequestID>"+ client.m_RequestId +"</n:RequestID>" +
							"<n:User>" + data.id + "</n:User>" +
							"<n:FrequencySecs>" + data.frequency + "</n:FrequencySecs>" +
							"<n:ExpirationSecs>1800</n:ExpirationSecs>" +
							"</n:RequestSetTrackingFrequency>" +
							"</env:Body></env:Envelope>";	
				
		client.net.write(SOAP_Headers + "\r\nContent-Length:" + SOAP_Envelope.length.toString() + "\r\n\r\n");
		client.net.write(SOAP_Envelope);
		return;
	}
	/* send GetImmediateGpsData request */
	if(header == 'GetImmediateGpsData'){
		var SOAP_Headers = 	"POST /soap/gps/getimmediategpsdata HTTP/1.1\r\nHost: soap.example.com\r\nUser-Agent: SOAP-client/SecurityCenter3.0\r\nContent-Type: application/soap+xml; charset=\"utf-8\"";		
		var SOAP_Envelope=  "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
							"<env:Envelope xmlns:env=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:SOAP-ENC=\"http://www.w3.org/2003/05/soap-encoding\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:n=\"http://www.mobiletornado.com/iprs/gps/soap\"><env:Header><n:Request>" +
							"GetImmediateGpsData" +
							"</n:Request></env:Header><env:Body>" +
							"<n:RequestGetImmediateGpsData xmlns:n=\"http://www.mobiletornado.com/iprs/gps/soap\">" +
							"<n:ApplicationID>" + client.AppID + "</n:ApplicationID><n:RequestID>"+ client.m_RequestId +"</n:RequestID>" +
							"<n:User>" + data + "</n:User>" +
							"<n:GpsDataMask><n:Type><n:GpsDataType>longitude</n:GpsDataType><n:GpsDataType>latitude</n:GpsDataType></n:Type></n:GpsDataMask>" +
							"<n:MaxAgeSecs>60</n:MaxAgeSecs><n:TimeoutSecs>30</n:TimeoutSecs>" +
							"</n:RequestGetImmediateGpsData>" +
							"</env:Body></env:Envelope>";
				
		client.net.write(SOAP_Headers + "\r\nContent-Length:" + SOAP_Envelope.length.toString() + "\r\n\r\n");
		client.net.write(SOAP_Envelope);
		return;
	}
	/* send GetUserHistoryPositions request */
	if(header == 'HistoryQuery'){
		var SOAP_Headers = 	"POST /soap/gps/historyquery HTTP/1.1\r\nHost: soap.example.com\r\nUser-Agent: SOAP-client/SecurityCenter3.0\r\nContent-Type: application/soap+xml; charset=\"utf-8\"";		
		var SOAP_Envelope=  "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
							"<env:Envelope xmlns:env=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:SOAP-ENC=\"http://www.w3.org/2003/05/soap-encoding\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:n=\"http://www.mobiletornado.com/iprs/gps/soap\"><env:Header><n:Request>" +
							"HistoryQuery" +
							"</n:Request></env:Header><env:Body>" +
							"<n:RequestHistoryQuery xmlns:n=\"http://www.mobiletornado.com/iprs/gps/soap\">" +
							"<n:ApplicationID>" + client.AppID + "</n:ApplicationID><n:RequestID>"+ client.m_RequestId +"</n:RequestID>" +
							"<n:Entity><n:User>" + data.id + "</n:User></n:Entity>" +
							"<n:GpsDataMask><n:Type><n:GpsDataType>longitude</n:GpsDataType><n:GpsDataType>latitude</n:GpsDataType></n:Type></n:GpsDataMask>" +
							"<n:StartTime>" + data.TimestampStart + "</n:StartTime><n:EndTime>" + data.TimestampEnd + "</n:EndTime>" +
							"</n:RequestHistoryQuery>" +
							"</env:Body></env:Envelope>";
							
		client.m_nState= 'STATE_WAIT_HIST';		
		client.net.write(SOAP_Headers + "\r\nContent-Length:" + SOAP_Envelope.length.toString() + "\r\n\r\n");
		client.net.write(SOAP_Envelope);
		return;
	}
	/* send logout request */
	if(header == 'logout'){
		var SOAP_Headers = 	"POST /soap/gps/logout HTTP/1.1\r\nHost: soap.example.com\r\nUser-Agent: SOAP-client/SecurityCenter3.0\r\nContent-Type: application/soap+xml; charset=\"utf-8\"";		
		var SOAP_Envelope=  "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
							"<env:Envelope xmlns:env=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:SOAP-ENC=\"http://www.w3.org/2003/05/soap-encoding\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:n=\"http://www.mobiletornado.com/iprs/gps/soap\"><env:Header><n:Request>" +
							"Logout" +
							"</n:Request></env:Header><env:Body>" +
							"<n:RequestLogout xmlns:n=\"http://www.mobiletornado.com/iprs/gps/soap\"><n:ApplicationID>" + client.AppID + "</n:ApplicationID></n:RequestLogout>" +
							"</env:Body></env:Envelope>";
				
		client.net.write(SOAP_Headers + "\r\nContent-Length:" + SOAP_Envelope.length.toString() + "\r\n\r\n");
		client.net.write(SOAP_Envelope);
		return;
	}
};
	