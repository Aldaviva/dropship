var _      = require('lodash');
var config = require('../config');
var fs     = require('fs');
var http   = require('http');
var logger = require('./logger')(module);
var Q      = require('q');
var temp   = require('temp');

exports.downloadArtifact = function(url){
	var deferred = Q.defer();
	var tempPath = temp.path({ prefix: "dropship.", suffix: ".tmp" });

	http.get(url, function(res){
		var writeStream = fs.createWriteStream(tempPath);
		res.pipe(writeStream);
		res.on('end', function(){
			logger.debug("download complete", { url: url });
			deferred.resolve(tempPath);
		});
	}).on('error', deferred.reject);

	logger.debug('downloading', { url: url, tempPath: tempPath });

	return deferred.promise;
};