var _      = require('lodash');
var config = require('../config');
var http   = require('http');
var Q      = require('q');
var logger = require('./logger')(module);

exports.getLatestBuild = function(project){
	logger.debug("fetching build data", { project: project });

	var rawJobBuildDataPromise = _getJSON(project.ciUrl+"/lastBuild/api/json");
	var rawComponentsBuildDataPromises = _.map(project.components, function(component){
		return _getJSON(project.ciUrl+'/'+component.package+'/lastBuild/api/json');
	});

	return Q.all([rawJobBuildDataPromise, Q.all(rawComponentsBuildDataPromises)])
		.spread(function(rawJobBuildData, rawComponentsBuildData){
			return {
				build: {
					state       : getBuildState(rawJobBuildData),
					endTime     : getEndTime(rawJobBuildData),
					commit: {
						author  : getCommitAuthor(rawJobBuildData),
						message : getCommitMessage(rawJobBuildData),
						hash    : getCommitHash(rawJobBuildData),
						url     : getCommitUrl(rawJobBuildData, project.scmUrl)
					}
				},
				components: getArtifacts(project.components, rawComponentsBuildData)
			};
		});
};

/**
 * @returns String one of "success", "failure", "unstable", or "aborted"
 */
function getBuildState(raw){
	return raw.result.toLowerCase();
}

/**
 * @returns Number milliseconds of timestamp when build finished
 */
function getEndTime(raw){
	return raw.timestamp + raw.duration;
}

/**
 * @returns String git commit author of triggering commit
 */
function getCommitAuthor(raw){
	var lastChangeSet = _getLastChangeSetItem(raw);
	if(lastChangeSet){
		return lastChangeSet.author.fullName;
	} else {
		return _.find(raw.actions, 'causes').causes[0].userId;
	}
}

function getCommitMessage(raw){
	var lastChangeSet = _getLastChangeSetItem(raw);
	if(lastChangeSet){
		return lastChangeSet.comment.trim();
	} else {
		return "no changes";
	}
}

function getCommitHash(raw){
	var lastChangeSet = _getLastChangeSetItem(raw);
	if(lastChangeSet){
		return lastChangeSet.commitId;
	} else {
		return _.find(raw.actions, 'lastBuiltRevision').lastBuiltRevision.SHA1;
	}
}

function getCommitUrl(raw, scmUrl){
	var hash = getCommitHash(raw);
	return scmUrl + '/commit/' + hash;
}

function getArtifacts(components, rawComponentsBuildData){
	return _.map(components, function(component, mIdx){
		var raw = rawComponentsBuildData[mIdx];
		var fileNamePattern = new RegExp(component.fileNamePattern);
		var artifact = _.find(raw.artifacts, function(artifact){
			return fileNamePattern.test(artifact.fileName);
		});
		return { build: { artifact: raw.url + 'artifact/' + artifact.relativePath }};
	});
}

function _getJSON(url){
	var deferred = Q.defer();

	http.get(url, function(res){
		var start = new Date();
		var resultBuffer = '';
		res.on('data', function(chunk){
			resultBuffer += chunk;
		});
		res.on('end', function(){
			var json = JSON.parse(resultBuffer);
			logger.trace({ url: url, duration: (new Date() - start) });
			deferred.resolve(json);
		});
	}).on('error', deferred.reject);

	return deferred.promise;
}

function _getLastChangeSetItem(raw){
	return _.last(raw.changeSet.items);
}