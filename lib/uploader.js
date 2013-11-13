var _      = require('lodash');
var config = require('../config');
var logger = require('./logger')(module);
var pty    = require('pty.js');
var Q      = require('q');

var PERCENT_PATTERN = /(\d+)%/;

module.exports.uploadArtifact = function(component, tempPath){
	var destination = component.destinationHost + ':' + component.destinationPath;
	
	logger.debug("uploading artifact", { destination: destination });

	var scp = _runCommand('scp', [tempPath, destination])
		.progress(function(line){
			var percentageString = line.match(PERCENT_PATTERN);
			if(percentageString){
				return Number(percentageString[1])/100;
			} else {
				return null;
			}
		});

	return scp;
};

module.exports.preDeploy = function(component){
	if(component.preDeployCommand){
		return _runSSHCommand(component.destinationHost, component.preDeployCommand);
	} else {
		return Q();
	}
};

module.exports.postDeploy = function(component){
	if(component.postDeployCommand){
		return _runSSHCommand(component.destinationHost, component.postDeployCommand);
	} else {
		return Q();
	}
};

function _runSSHCommand(host, command){
	return _runCommand('ssh', [host, command]);
}

function _runCommand(command, args){
	var deferred = Q.defer();

	logger.debug("spawn pty", { command: command, args: args });

	var childProcess = pty.spawn(command, args);

	childProcess.on('data', deferred.notify);
	childProcess.on('close', function(){
		var exitCode = childProcess.status;
		if(exitCode === 0){
			deferred.resolve();
		} else {
			deferred.reject(exitCode);
		}
	});
	// childProcess.on('error', deferred.reject);

	deferred.promise.then(function(){ logger.debug("pty finished"); });
	deferred.promise.fail(function(err){ logger.error("pty failed", { error: err }); });
	deferred.promise.progress(function(progress){ logger.debug("pty progress", { progress: progress.trim() }); });

	return deferred.promise;
}