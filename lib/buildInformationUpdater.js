var _                 = require('lodash');
var config            = require('../config');
var logger            = require('./logger')(module);
var mediator          = require('./mediator');
var projectRepository = require('./projectRepository');
var Q                 = require('q');
var request           = require('pr-request2');

mediator.subscribe("deploy", onDeployComplete, {
	predicate: function(opts){
		return opts.event === 'complete';
	}
});

/**
 * Update the Build Information for a particular build of a Jenkins project.
 *
 * @param project from the projectRepository
 * @param displayName 'If set, this text is used instead of the default "#NNN" to point to this build. Leave this empty/null/undefined to use the default.'
 * @param description 'This description is placed on the build top page so that visitors can know what this build did. You can use any HTML tags (or markup in the configured language) here.'
  *
  * @return promise that will be resolved or rejected based on the response from the HTTP call to Jenkins
 */
var updateBuildInformation = exports.updateBuildInformation = function(project, displayName, description){
	logger.debug({ project: project, displayName: displayName, description: description }, "updating Jenkins build information...");
	return request({
		method: "POST",
		url: project.ci.url + '/lastBuild/configSubmit',
		form: {
			json: JSON.stringify({
				displayName: displayName || "",
				description: description || null
			})
		},
		// proxy: "http://sigyn.bjn.mobi:9998",
		auth: {
			username: project.ci.username,
			password: project.ci.password
		}
	})
	.then(function(res){
		if(res.statusCode >= 400){
			logger.error({ statusCode: res.statusCode }, "unable to update Jenkins build information");
			logger.error(res.body);
			throw new Error("unable to update Jenkins build information");
		} else {
			logger.debug({ status: res.statusCode }, "updated Jenkins build information");
		}
	});
};

function onDeployComplete(opts, channel){
	var project = projectRepository.getWithoutBuild(opts.projectId);
	return updateBuildInformation(project, null, "shipped");
}