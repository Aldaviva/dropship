var config            = require('../config');
var deployer          = require('./deployer');
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
			res.send(404, err);
		});
});

server.post('/api/projects/:id/deploy', function(req, res){
	projectRepository.fetchWithBuild(req.params.id)
		.then(function(project){
			var deployStatus = deployer.deployProject(project);
			deployStatus.promise.done();
			res.send({ deployId: deployStatus.deployId });
		})
		.fail(function(err){
			res.send(404, err);
		});
});