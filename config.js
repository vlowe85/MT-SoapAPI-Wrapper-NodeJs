/* set app config */
module.exports = Object.freeze({
	SITE:	'UK Platform',
	PORT:	8080,
    GPS_IP: '85.118.26.16',
    GPS_SOAP_PORT: 8081,
	GPS_FWD_PORT:  26000,
    SOS_IP: '85.118.26.17',
    SOS_SOAP_PORT: 8082,
	SOS_FWD_PORT:  26001,
	KA_TIMER_MS:   1000 * 60, /* 1 min */
	GPS_SUBSCRIPTION_TIMER_MS: 25 * 60 * 1000 /* 25 mins */
});