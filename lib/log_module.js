var winston = require('winston');
winston.emitErrs = true;

var logger = new winston.Logger({
    transports: [
        new winston.transports.File({
            level: 'debug',
            filename: './logs/all-logs.log',
            handleExceptions: true,
            json: true,
            maxsize: 5242880, //5MB
            maxFiles: 5,
            colorize: false
        }),
        new winston.transports.Console({
            level: 'debug',
            handleExceptions: true,
            json: false,
            colorize: true,
			timestamp:true
        })
    ],
    exitOnError: false,
	levels: { error: 0, warn: 1, info: 2, verbose: 3, gps: 4, sos: 5, debug: 6, silly: 7 },
	colors: {
		verbose: 'cyan',
		info: 'green',
		warn: 'yellow',
		error: 'magenta',
		debug: 'blue',
		silly: 'magenta',
		gps: 'yellow',
		sos: 'red'
    }
});

module.exports = logger;
module.exports.stream = {
    write: function(message, encoding){
        logger.info(message);
    }
};