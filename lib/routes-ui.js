var config            = require('../config');
var projectRepository = require('./projectRepository');
var server            = require('./appServer');

server.get('/', function(req, res){
	res.redirect('/projects');
});

server.get('/projects', function(req, res){
	res.render('projects', {
		projectIds: projectRepository.listIds().sort()
	});
});

server.get('/projects/:id', function(req, res){
	var project = projectRepository.getWithoutBuild(req.params.id);
	if(project){
		res.render('project', { projectId: project.id });
	} else {
		res.send(404, "No project with id = "+req.params.id);
	}
});