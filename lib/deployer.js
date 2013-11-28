var _          = require('lodash');
var config     = require('../config');
var downloader = require('./downloader');
var logger     = require('./logger')(module);
var mediator   = require('./mediator');
var Q          = require('q');
var uploader   = require('./uploader');

exports.deployProject = function(project){
	logger.info("deploying project", { project: project });
	mediator.publish(['deploy', project.id, 'start', '_all'].join(':'), {
		projectId: project.id,
		componentId: '_all',
		event: 'start'
	});

	var promiseChain = _.reduce(project.components, 
		function(chain, component){
			return chain.then(function(){
				logger.debug("deploying next component", { id: component.id });
				return deployComponent(project.id, component);
			});
		},
		Q.resolve());

	promiseChain.then(function(){
		logger.info("deployed "+project.id);
		mediator.publish(['deploy', project.id, 'complete', '_all'].join(':'), {
			projectId: project.id,
			componentId: '_all',
			event: 'complete'
		});
	});

	return {
		promise: promiseChain
	};
};

function deployComponent(projectId, component){
	var url = component.build.artifact;
	var tempPath;

	logger.debug("deployComponent", { component: component });

	var logStart   = _logStart(projectId, component.id);
	var logFailure = _logFailure(projectId, component.id);
	var logSuccess = _logSuccess(projectId, component.id);

	return Q()
		.then(logStart('download'))
		.then(function(){
			return downloader.downloadArtifact(url);
		})
		.then(logSuccess('download'), logFailure('download'))
		.then(function(_tempPath){
			tempPath = _tempPath;
		})

		.then(logStart('preDeploy'))
		.then(function(){
			return uploader.preDeploy(component);
			// throw new Error("testing failures"); //FIXME testing
		})
		.then(logSuccess('preDeploy'), logFailure('preDeploy'))

		.then(logStart('upload'))
		.then(function(){
			return uploader.uploadArtifact(component, tempPath)
				.progress(function(progress){
					_publish(projectId, component.id, 'upload', 'progress', { progress: progress });
				});
		})
		.then(logSuccess('upload'), logFailure('upload'))

		.then(logStart('postDeploy'))
		.then(function(){
			return uploader.postDeploy(component);
		})
		.then(logSuccess('postDeploy'), logFailure('postDeploy'));
};

var _logStart = _.curry(function(projectId, componentId, stepName){
	return _.partial(_publish, projectId, componentId, stepName, 'start');
});

var _logFailure = _.curry(function(projectId, componentId, stepName){
	return function(err){
		if(!err.logged){
			logger.error(JSON.stringify(err));
			_publish(projectId, componentId, stepName, 'error', { error: err.message });
			err.logged = true;
		}
		throw err;
	};
});

var _logSuccess = _.curry(function(projectId, componentId, stepName){
	return function(result){
		_publish(projectId, componentId, stepName, 'complete');
		return result;
	};
});

function _publish(projectId, componentId, stepName, event, extras){
	// logger.info("%s %s%s", stepName, componentId, (event == 'start' ? '' : ': '+event));
	var topic = ['deploy', projectId, event, componentId, stepName].join(':');
	var body = _.extend({
		projectId: projectId,
		componentId: componentId,
		step: stepName,
		event: event
	}, extras);
	logger.info(body, "publish");

	mediator.publish(topic, body);
}

/**
 * Generate a string of random alphanumeric characters.
 * @param length the character length of the ID (optional, 32 by default)
 * @param radix the radix of the ID (optional, 16 by default)
 * @author Mike Sidorov (FarSeeing)
 * @{link https://gist.github.com/jed/973263/#comment-87510}
 */
function _randomId(length, radix){
	var c='';length=length||32;while(length--){c+=(0|Math.random(radix=radix||16)*radix).toString(radix)}return c;
}