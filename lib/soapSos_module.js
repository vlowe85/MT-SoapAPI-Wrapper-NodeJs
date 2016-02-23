/* SOAP request func */
module.exports = function soapSos(xmlResponse, client, header, data) {
	if(xmlResponse!=''){
		var response = xmlResponse['env:Envelope']['env:Header']['n:Response']._;
		/* send LoginContinue request */
		if (response == 'Login'){
			client.SoSAppID = xmlResponse['env:Envelope']['env:Body']['n:ResponseLogin']['n:ApplicationID'];
			var SOAP_Headers = 	"POST /soap/sos/logincontinue HTTP/1.1\r\nHost: soap.example.com\r\nUser-Agent: SOAP-client/SecurityCenter3.0\r\n" +
								"Content-Type: application/soap+xml; charset=\"utf-8\"";
			var SOAP_Envelope= "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
				"<env:Envelope xmlns:env=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:SOAP-ENC=\"http://www.w3.org/2003/05/soap-encoding\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:n=\"http://www.mobiletornado.com/iprs/sos/soap\"><env:Header><n:Request>" +
				"LoginContinue" +"</n:Request></env:Header><env:Body>" +
				"<n:RequestLoginContinue xmlns:n=\"http://www.mobiletornado.com/iprs/sos/soap\">" +
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
				
			client.SoSnet.write(SOAP_Headers + "\r\nContent-Length:" + SOAP_Envelope.length.toString() + "\r\n\r\n");
			client.SoSnet.write(SOAP_Envelope);
			return;
		}
	}
	/* send Login request */
	if(header == 'login'){
		var SOAP_Headers = 	"POST /soap/sos/login HTTP/1.1\r\nHost: soap.example.com\r\nUser-Agent: SOAP-client/SecurityCenter3.0\r\n" +
							"Content-Type: application/soap+xml; charset=\"utf-8\"";		
		var SOAP_Envelope=  "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
							"<env:Envelope xmlns:env=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:SOAP-ENC=\"http://www.w3.org/2003/05/soap-encoding\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:n=\"http://www.mobiletornado.com/iprs/sos/soap\"><env:Header><n:Request>" +
							"Login" +
							"</n:Request></env:Header><env:Body>" +
							"<n:RequestLogin xmlns:n=\"http://www.mobiletornado.com/iprs/sos/soap\">" +
							"<n:Name>"+data+"</n:Name>" +
							"<n:OrgID>0</n:OrgID>" +										
							"<n:LoginEntityType>dispatcher</n:LoginEntityType>" +
							"<n:AuthType>simple</n:AuthType>" +
							"</n:RequestLogin></env:Body></env:Envelope>";
					
		client.SoSnet.write(SOAP_Headers + "\r\nContent-Length:" + SOAP_Envelope.length.toString() + "\r\n\r\n");
		client.SoSnet.write(SOAP_Envelope);
		return;
	}
	/* send Subscribe request */
	if(header == 'Subscribe'){
		var SOAP_Headers = 	"POST /soap/sos/subscribe HTTP/1.1\r\nHost: soap.example.com\r\nUser-Agent: SOAP-client/SecurityCenter3.0\r\nContent-Type: application/soap+xml; charset=\"utf-8\"";		
		var SOAP_Envelope=  "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
							"<env:Envelope xmlns:env=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:SOAP-ENC=\"http://www.w3.org/2003/05/soap-encoding\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:n=\"http://www.mobiletornado.com/iprs/sos/soap\"><env:Header><n:Request>" +
							"Subscribe" +
							"</n:Request></env:Header><env:Body>" +
							"<n:RequestSubscribe xmlns:n=\"http://www.mobiletornado.com/iprs/sos/soap\">" +
							"<n:ApplicationID>" + client.SoSAppID + "</n:ApplicationID><n:RequestID>"+ client.m_SosRequestId +"</n:RequestID>" +
							"<n:Org>0</n:Org>" +
							"<n:ExpirationSecs>" + data.expiration + "</n:ExpirationSecs>" +
							"</n:RequestSubscribe>" +
							"</env:Body></env:Envelope>";
				
		client.SoSnet.write(SOAP_Headers + "\r\nContent-Length:" + SOAP_Envelope.length.toString() + "\r\n\r\n");
		client.SoSnet.write(SOAP_Envelope);
		return;
	}

};
	