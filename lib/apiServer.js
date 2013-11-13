var restify  = require('restify');
var socketio = require('socket.io');
var logger = require('./logger')(module);

var SOCKET_IO_OPTS = {
    'log level': 0, // 0 - error, 1 - warn, 2 - info, 3 - debug
    'transports': ['websocket', 'flashsocket', 'htmlfile', 'xhr-polling', 'jsonp-polling']
};

var apiServer = module.exports = restify.createServer();
var io = apiServer.io = socketio.listen(apiServer, SOCKET_IO_OPTS);

io.enable('browser client minification');
io.enable('browser client etag');
io.enable('browser client gzip');

apiServer.on('uncaughtException', function(req, res, route, err){
    logger.error("error", {
        client  : req.connection.remoteAddress,
        time    : req.time(),
        method  : req.method,
        url     : req.url,
        headers : req.headers,
        error   : err.message,
        stack   : err.stack
    });
    res.send(500, err);
});
