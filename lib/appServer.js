var _              = require('lodash');
var config         = require('../config');
var express        = require('express');
var hbs            = require('hbs');
var http           = require('http');
var lessMiddleware = require('less-middleware');
var logger         = require('./logger')(module);
var mediator       = require('./mediator');
var path           = require('path');
var slash          = require('express-slash');
var socketio       = require('socket.io');

var app = module.exports = express();
var publicDir = path.join(__dirname, '../public');

app.set('port', config.httpPort);
app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'html');
app.engine('html', hbs.__express);
app.enable('strict routing');

var accessLog = require('./logger')().child();
app.use(function(req, res, next){
	accessLog.trace({ method: req.method, url: req.url });
	next();
});
app.use(express.json());
app.use(express.urlencoded());
app.use(app.router);
app.use(slash());
app.use(function(err, req, res, next){
	logger.error(err.stack || err.message);
	res.type('text');
	res.send(500, err.message);
});
app.use(lessMiddleware({ src: publicDir, force: true }));
app.use('/scripts/lib/', express.static(path.join(__dirname, '../bower_components'), { maxAge: 24*60*60*1000 }));
app.use(express.static(publicDir, { maxAge: 60*60*1000 }));
app.use(function(req, res, next){
	res.send(404);
	accessLog.debug({ method: req.method, url: req.url, status: res.statusCode })
});


var server = http.createServer(app);

var io = server.io = socketio.listen(server, {
    'log level': 1, // 0 - error, 1 - warn, 2 - info, 3 - debug
    //'transports': ['websocket', 'flashsocket', 'htmlfile', 'xhr-polling', 'jsonp-polling']
});
io.enable('browser client minification');
io.enable('browser client etag');
io.enable('browser client gzip');

server.listen(app.get('port'), function(){
	logger.info("Listening on http://*:" + app.get('port'));
});

//test broadcasting upload progress
// setInterval(function(){
// 	logger.debug("sending fake broadcast event");
// 	io.sockets.emit('deploy', { topic: 'deploy:catalyst:_all:start', body: { test: true, componentId: 'storm', step: 'upload', state: 'progress', progress: Math.random() }});
// }, 3000);

mediator.subscribe('deploy', function(body, channel){
	var topic = channel.namespace;
	io.sockets.emit('deploy', { topic: topic, body: body });
});

require('./routes-api');
require('./routes-ui');