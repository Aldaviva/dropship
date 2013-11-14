var mediator = new Mediator();
var componentStepEls = {
	// "project:component:step": el
};

var project = null;
setLayout("idle");

$.getJSON('/api/projects/'+projectId)
	.done(function(data){
		project = data;
		initProject();
	});

$('#deployButton').click(function(event){
	event.preventDefault();
	$.post('/api/projects/'+projectId+'/deploy');
	project.deployState = 'in progress';
	setLayout('deploying');
	renderProject();
});

function initProject(){
	$('.loading').hide();
	$('.project').show();
	renderProject();

	mediator.subscribe('deploy:'+project.id+':start:_all', function(body, channel){
		$('.progress').empty();
		project.deployState = "in progress";
		renderProject();
	});

	mediator.subscribe('deploy:'+project.id+':complete:_all', function(body){
		project.deployState = "complete";
		setLayout('idle');
		componentStepEls = {};
		renderProject();
	});

	mediator.subscribe('deploy:'+project.id+':error', function(body, channel){
		project.deployState = 'failed';
		renderProject();
	});

	mediator.subscribe('deploy:'+project.id, function(body, channel){
		renderStep(project.id, body.componentId, body.step, body.event, body.progress);
		setLayout('deploying');
	}, { predicate: function(body){
		return (body.componentId != '_all') || (body.event != 'complete');
	}});
}

function renderProject(){
	$('.build .time .value').text(new Date(project.build.endTime));
	$('.build .author .value').text(project.build.commit.author);
	$('.build .message').text(project.build.commit.message);

	renderDeployButton();
}

function setLayout(mode){
	var projectEl = $('.project');
	var buildEl = projectEl.find('.build');
	var progressEl = projectEl.find('.progress');
	var currentMode = projectEl.hasClass('deploying') ? 'deploying' : 'idle';

	if(currentMode != mode){
		if(mode == "idle") {
			buildEl.show();
			progressEl.hide();
			projectEl.removeClass('deploying');
		} else if(mode == "deploying") {
			buildEl.hide();
			progressEl.show();
			projectEl.addClass('deploying');
		}
	}
}

function renderDeployButton(){
	var deployButton = $('#deployButton');

	var buildState = project.build.state;
	var deployState = project.deployState;

	var cssClass = "";
	var disabledAttrValue = "disabled";
	var labelText = "";

	if(project.deployState == 'error'){
		cssClass = "error";
		labelText = "Deploy failed";
		disabledAttrValue = "";
	} else if(project.deployState == 'in progress'){
		cssClass = "unavailable";
		labelText = "Deploying\u2026";
	} else if(buildState == 'failure' || buildState == 'unstable'){
		cssClass = "error";
		labelText = "Build broken";
	} else if(buildState == 'aborted'){
		cssClass = "unavailable";
		labelText = "Build stopped";
	} else if(buildState == 'in progress'){
		cssClass = "unavailable";
		labelText = "Building\u2026";
	} else {
		cssClass = "";
		labelText = "Deploy";
		disabledAttrValue = null;
	}

	deployButton
		.attr({
			"value": labelText,
			"class": cssClass,
			"disabled": disabledAttrValue
		});
}

function renderStep(projectId, componentId, step, event, progress){
	var elementKey = [projectId, componentId, step].join(":");
	var el = componentStepEls[elementKey];
	var message;
	if(componentId == '_all'){
		if(event == 'start'){
			message = "Deploying "+projectId;
		} else if(event == 'complete'){
			message = "Successfully deployed "+projectId;
		}
	} else {
		message = step + " " + componentId + (progress ? ' (' + Math.floor(progress*100) + '%)' : '');
	}

	if(event == 'start' || !el){
		el = $('<div>');
		$('.project .details .progress').append(el);
		componentStepEls[elementKey] = el;
	}

	var cssClass = (event == 'start' && componentId == '_all') ? 'complete' : event;

	el.text(message).attr("class", cssClass);
}

var socket = io.connect(location.protocol+"//"+location.host);
socket.on('deploy', function(message){
	console.log(message.topic, message.body);
	mediator.publish(message.topic, message.body);
});
socket.on('error', function(err){
	console.error(err);
});