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

	var publishBefore = _.partial(_generateBefore, projectId, component.id);
	var publishAfter = _.partial(_generateFinally, projectId, component.id);

	return Q()
		.finally(publishBefore('download'))
		.then(function(){
			return downloader.downloadArtifact(url);
		})
		.finally(publishAfter('download'))
		.then(function(_tempPath){
			tempPath = _tempPath;
		})
		.then(publishBefore('preDeploy'))
		.then(function(){
			return uploader.preDeploy(component);
		})
		.finally(publishAfter('preDeploy'))
		.finally(publishBefore('upload'))
		.then(function(){
			return uploader.uploadArtifact(component, tempPath)
				.progress(function(progress){
					_publish(projectId, component.id, 'upload', 'progress', { progress: progress });
				});
			//TODO publish upload progress
		})
		.finally(publishAfter('upload'))
		.finally(publishBefore('postDeploy'))
		.then(function(){
			return uploader.postDeploy(component);
		})
		.finally(publishAfter('postDeploy'));
};

function _generateBefore(projectId, componentId, stepName){
	return function(){
		_publish(projectId, componentId, stepName, 'start');
	};
}

function _generateFinally(projectId, componentId, stepName){
	/*var thenHandler = _generatePublisher(projectId, component.id, 'complete', stepName, );
	var failHandler = _generatePublisher(projectId, component.id, 'error', stepName, function(error){
		return { error: error };
	});*/

	return function(err){
		if(err){
			_publish(projectId, componentId, stepName, 'error', { error: err });
			throw err;
		} else {
			_publish(projectId, componentId, stepName, 'complete');
		}
	};
}

/*function _generatePublisher(projectId, componentId, event, stepName, extraArgHandler){
	return function(){
		
		_publish(projectId, componentId, event, stepName, extras)
	};
}*/

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