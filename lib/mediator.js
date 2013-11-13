var Mediator = require("mediator-js").Mediator;
var logger = require('./logger')(module);

var mediator = module.exports = new Mediator();

mediator.subscribe('deploy', function(body, topic){
	logger.trace({
		topic: topic.namespace,
		body: body
	});
});