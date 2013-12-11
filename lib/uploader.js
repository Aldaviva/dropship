var _      = require('lodash');
var config = require('../config');
var logger = require('./logger')(module);
var pty    = require('pty.js');
var Q      = require('q');

var PERCENT_PATTERN = /(\d+)%/;
var EXIT_CODE_PATTERN = /pty exit code (-?[0-9]+)/

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

	var spawnCommand = "bash";
	var spawnArgs = ['-c', [command].concat(args).join(' ') + "; echo pty exit code $?"];

	logger.debug("spawn pty", { command: spawnCommand, args: spawnArgs });

	var childProcess = pty.spawn(spawnCommand, spawnArgs);

	childProcess.on('data', function(data){
		logger.trace(data, "output from pty");
		var exitCodeMatcher = data.match(EXIT_CODE_PATTERN);
		if(exitCodeMatcher){
			childProcess.status = Number(exitCodeMatcher[1]);
		} else if(data.trim().length) {
			deferred.notify(data);
		}
	});

	childProcess.on('close', function(){
		var exitCode = childProcess.status;
		if(exitCode === 0){
			deferred.resolve();
		} else {
			logger.error("non-zero exit code "+exitCode);
			deferred.reject(exitCode);
		}
	});

	childProcess.on('error', function(err){
		//https://github.com/chjj/pty.js/issues/34
		if(err.code != 'EIO' || err.syscall != 'read'){
			logger.error(err, "child process emitted error event")
			deferred.reject(err);
		}
	});

	deferred.promise.then(function(){ logger.debug("pty finished"); });
	deferred.promise.fail(function(err){ logger.error("pty failed", { error: err }); });
	deferred.promise.progress(function(progress){ logger.debug("pty progress", { progress: progress.trim() }); });

	return deferred.promise;
}