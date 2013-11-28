var config            = require('../config');
var deployer          = require('./deployer');
var logger            = require('./logger')(module);
var projectRepository = require('./projectRepository');
var server            = require('./appServer');

server.get('/api/projects', function(req, res){
	res.send(projects.listIds());
});

server.get('/api/projects/:id', function(req, res){
	projectRepository.fetchWithBuild(req.params.id)
		.then(function(project){
			res.send(project);
		})
		.fail(function(err){
			logger.error(err.stack || err.message);
			res.send(404, err);
		});
});

server.post('/api/projects/:id/deploy', function(req, res){
	projectRepository.fetchWithBuild(req.params.id)
		.fail(function(err){
			res.send(404, err);
			throw err;
		})
		.then(function(project){
			var deployStatus = deployer.deployProject(project);
			res.send(200);
			
			deployStatus.promise.fail(function(err){
				logger.error(err, "failed to deploy "+req.params.id);
			});
			// return deployStatus.promise
			// 	.then(function(){
			// 	});
		});
});