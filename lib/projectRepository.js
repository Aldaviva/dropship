var _      = require('lodash');
var ci     = require('./ci');
var config = require('../config');
var Q      = require('q');

/**
 * This contains a slow remote call. It sometimes takes 5 seconds and I don't know why.
 * Returns the static configuration data as well as data about the latest build.
 */
exports.fetchWithBuild = function(projectId){
	var project = exports.getWithoutBuild(projectId);
	if(project) {

		return ci.getLatestBuild(project)
			.then(function(build){
				return _.merge(build, project);
			});

	} else {
		return Q.reject("No project with id = "+projectId+", try one of "+_.pluck(config.projects, 'id').join(", ")+'.');
	}
};

/**
 * Omits data about the latest build so we can skip the slow remote call.
 * Just returns the static configuration data.
 */
exports.getWithoutBuild = function(projectId){
	return _.find(config.projects, { id: projectId });
};

exports.listIds = function(){
	return _.pluck(config.projects, 'id');
};