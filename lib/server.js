var _      = require('lodash');
var config = require('../config');
var logger = require('./logger')(module);

_.defaults(config, {
	httpPort: 8080,
	projects: []
});

_.each(config.projects, function(project){
	_.defaults(project, {
		"id": "?",
		"deployState": "idle",
		"scmUrl": "",
		"ciUrl": "",
		"components": [] 
	});
});

require('./appServer');