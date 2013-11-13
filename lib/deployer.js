var _          = require('lodash');
var config     = require('../config');
var downloader = require('./downloader');
var logger     = require('./logger')(module);
var mediator   = require('./mediator');
var Q          = require('q');
var uploader   = require('./uploader');

exports.deployProject = function(project){
	var deployId = _randomId();

	logger.info("deploying project", { project: project, deployId: deployId });
	
	var promiseChain = _.reduce(project.components, 
		function(chain, component){
			return chain.then(function(){
				logger.debug("deploying next component", { id: component.id });
				return deployComponent(component, deployId);
			});
		},
		Q.resolve());

	promiseChain.then(function(){
		logger.info("deployed "+project.id);
	});

	return {
		promise: promiseChain,
		deployId: deployId
	};
};

function deployComponent(component, deployId){
	var url = component.build.artifact;
	var tempPath;

	logger.debug("deployComponent", { component: component });

	// var publish = _.partial(_generatePublishers, component, deployId);
	var publishBefore = _.partial(_generateBefore, component, deployId);
	var publishAfter = _.partial(_generateFinally, component, deployId);

	return Q()
		.finally(publishBefore('download'))
		.then(function(){
			return downloader.downloadArtifact(url);
		})
		.finally(publishAfter('download'))
		.then(function(_tempPath){
			// logger.debug("artifact downloaded", { path: _tempPath });
			tempPath = _tempPath;
		})
		.then(publishBefore('preDeploy'))
		.then(function(){
			// logger.debug("start preDeploy", { componentId: component.id });
			return uploader.preDeploy(component);
		})
		.finally(publishAfter('preDeploy'))
		.finally(publishBefore('upload'))
		// .then.apply(undefined, publishAfter('preDeploy'))
		.then(function(){
			// logger.debug("end preDeploy", { componentId: component.id });
			// logger.debug("start uploadArtifact", { componentId: component.id });
			return uploader.uploadArtifact(component, tempPath);
		})
		.finally(publishAfter('upload'))
		.finally(publishBefore('postDeploy'))
		// .then.apply(null, publishAfter('uploadArtifact'))
		.then(function(){
			// logger.debug("end uploadArtifact", { componentId: component.id });
			// logger.debug("start postDeploy", { componentId: component.id });
			return uploader.postDeploy(component);
		})
		.finally(publishAfter('postDeploy'));
		// .then.apply(null, publishAfter('postDeploy'))
		// .then(function(){
			// logger.debug("end postDeploy", { componentId: component.id });
		// });
};

function _generateBefore(component, deployId, stepName){
	return _generatePublisher(deployId, component.id, stepName, 'start');
}

function _generateFinally(component, deployId, stepName){
	var thenHandler = _generatePublisher(deployId, component.id, stepName, 'complete');
	var failHandler = _generatePublisher(deployId, component.id, stepName, 'error', function(body, error){
		body.error = error;
	});

	return function(err){
		if(err){
			failHandler(err);
			throw err;
		} else {
			thenHandler();
		}
	};
}

/*function _generatePublishers(component, deployId, stepName, hasProgress){
	var generatePublisher = _.partial(_generatePublisher, deployId, component.id, stepName);

	var thenHandler = generatePublisher('complete');
	var failHandler = generatePublisher('error', function(body, error){
		body.error = error;
	});
	var progressHandler = (hasProgress) 
		? generatePublisher('progress', function(body, progress){
			body.progress = progress;
		})
		: null;
	logger.trace("_generatePublishers");

	return [thenHandler, failHandler, progressHandler];
};*/

function _generatePublisher(deployId, componentId, stepName, state, extraArgHandler){
	var topic = ['deploy', deployId, componentId, stepName, state].join(':');
	var body = _.extend({
		deployId: deployId,
		componentId: componentId,
		step: stepName,
		state: state
	});

	return function(){
		extraArgHandler && extraArgHandler.apply(null, arguments);
		logger.info("%s %s%s", stepName, componentId, (state == 'start' ? '' : ': '+state));
		mediator.publish(topic, body);
	};
}

/**
 * @param length the character length of the ID (optional, 32 by default)
 * @param radix the radix of the ID (optional, 16 by default)
 * @author Mike Sidorov (FarSeeing)
 * @{link https://gist.github.com/jed/973263/#comment-87510}
 */
function _randomId(length, radix){
	var c='';length=length||32;while(length--){c+=(0|Math.random(radix=radix||16)*radix).toString(radix)}return c;
}