var bunyan = require('bunyan');
var path = require('path');
var Q = require('q');

var parentLogger = bunyan.createLogger({ name: 'dropship' });
parentLogger.level("trace");

var qLogger = parentLogger.child({ module: 'q' });
// Q.onerror = function(err){
// 	qLogger.error({ error: err });
// };
Q.longStackSupport = true;

module.exports = function(module){
	if(module){
		return parentLogger.child({ module: path.basename(module.filename, '.js') });
	} else {
		return parentLogger;
	}
};