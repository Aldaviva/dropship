var apiServer = require('./apiServer');
var config    = require('../config');
var logger = require('./logger')(module);

require('./routes');

apiServer.listen(config.httpPort, function(){
	logger.info("Listening on %s", apiServer.url);
});