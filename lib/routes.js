var _        = require('lodash');
var ci       = require('./ci');
var config   = require('../config');
var deployer = require('./deployer');
var server   = require('./apiServer');
var Q = require('q');

server.get('api/projects', function(req, res){
	res.send(_.pluck(config.projects, 'id'));
});

server.get('api/projects/:id', function(req, res){
	/*var project = _.find(config.projects, { id: req.params.id });
	if(project) {

		ci.getLatestBuild(project)
			.then(function(build){
				var response = _.merge(build, project);
				res.send(response);
			})
			.done();

	} else {
		res.send(404, "No project with id = "+req.params.id+", try one of "+_.pluck(config.projects, 'id').join(", ")+'.');
	}*/
	getProjectById(req.params.id)
		.then(function(project){
			res.send(project);
		})
		.fail(function(err){
			res.send(404, err);
		});
});

server.post('api/projects/:id/deploy', function(req, res){
	getProjectById(req.params.id)
		.then(function(project){
			var deployStatus = deployer.deployProject(project);
			deployStatus.promise.done();
			res.send({ deployId: deployStatus.deployId });
		})
		.fail(function(err){
			res.send(404, err);
		});
});

function getProjectById(projectId){
	var project = _.find(config.projects, { id: projectId });
	if(project) {

		return ci.getLatestBuild(project)
			.then(function(build){
				return _.merge(build, project);
			});

	} else {
		return Q.reject("No project with id = "+projectId+", try one of "+_.pluck(config.projects, 'id').join(", ")+'.');
	}
}