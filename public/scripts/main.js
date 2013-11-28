var mediator = new Mediator();
var componentStepEls = {
	// "project:component:step": el
};

var REFRESH_FREQUENCY = 5*1000;
var STEP_LABELS = {
	preDeploy: 'preparing',
	download: 'fetching',
	upload: 'uploading',
	postDeploy: 'finalizing'
};

var project = null;

fetchProjectData().done(function(data){
	initProject();
});

setInterval(function(){
	if(project.deployState != 'in progress'){
		fetchProjectData().done(function(data){
			if(project.deployState != 'in progress'){
				renderProject();
			}
		});
	}
}, REFRESH_FREQUENCY);

$('#deployButton').click(function(event){
	event.preventDefault();
	$.post('/api/projects/'+projectId+'/deploy');
	project.deployState = 'in progress';
	$('.log').empty();
	renderProject();
});

$('.project .reload').attr('title', 'Refresh\n(Auto-refreshes every '+Math.round(REFRESH_FREQUENCY/1000)+' seconds)');


function fetchProjectData(){
	return $.getJSON('/api/projects/'+projectId)
		.done(function(data){
			project = data;
			return data;
		});
}

function initProject(){
	$('.loading').hide();
	$('.project').show();
	renderProject();

	mediator.subscribe('deploy:'+project.id+':start:_all', function(body, channel){
		$('.log').empty();
		project.deployState = "in progress";
		renderProject();
	});

	mediator.subscribe('deploy:'+project.id+':complete:_all', function(body){
		project.deployState = "complete";
		componentStepEls = {};
		renderProject();
	});

	mediator.subscribe('deploy:'+project.id+':error', function(body, channel){
		project.deployState = 'failed';
		renderProject();
	});

	mediator.subscribe('deploy:'+project.id, function(body, channel){
		renderStep(project.id, body.componentId, body.step, body.event, body);
		if(project.deployState != 'complete' && project.deployState != 'failed'){
			project.deployState = 'in progress';
		}
		renderProject();
	});
}

function renderProject(){
	var buildMoment = moment(project.build.endTime);
	var projectEl = $('.project');
	var buildEl = projectEl.find('.build');

	buildEl.find('.time .value')
		.text(buildMoment.fromNow())
		.attr({ title: buildMoment.format(), 'data-millis': buildMoment.valueOf() })
	buildEl.find('.author').toggle(!!project.build.commit.author)
		.find('.value').text(project.build.commit.author);
	buildEl.find('.message')
		.text(project.build.commit.message)
		.attr('href', project.build.commit.url);

	projectEl
		.toggleClass('deploying', (project.deployState == 'in progress'))
		.toggleClass('done', (project.deployState == 'complete' || project.deployState == 'failed'));

	renderDeployButton();
}

function renderDeployButton(){
	var deployButton = $('#deployButton');

	var buildState = project.build.state;
	var deployState = project.deployState;

	var cssClass = "";
	var disabledAttrValue = "disabled";
	var labelText = "";

	if(deployState == 'error'){
		cssClass = "error";
		labelText = "Deploy failed";
		disabledAttrValue = "";
	} else if(deployState == 'in progress'){
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
	} else if(deployState == 'complete'){
		cssClass = "success";
		labelText = 'Deployed';
	} else if(deployState == 'failed'){
		cssClass = 'error';
		labelText = 'Deploy Failed';
	} else {
		cssClass = "";
		labelText = "Deploy";
		disabledAttrValue = null;
	}

	deployButton
		.attr({
			"class": cssClass,
			"disabled": disabledAttrValue
		})
		.text(labelText);
}

function renderStep(projectId, componentId, step, event, body){
	var elementKey = [projectId, componentId, step].join(":");
	var el = componentStepEls[elementKey];
	var message;

	if(componentId == '_all'){
		if(event == 'start'){
			message = "deploying "+projectId;
		} else if(event == 'complete'){
			message = "deployed "+projectId;
		}
	} else {
		message = STEP_LABELS[step] + " " + componentId;
		if(body.progress){
			message += ' (' + Math.floor(body.progress*100) + '%)';
		}
	}

	if(event == 'start' || !el){
		el = $('<div>');
		var logEl = $('.project .details .log');
		logEl.append(el);
		componentStepEls[elementKey] = el;
	}

	if(event == 'error'){
		el.after($('<div>', { 'class': 'error message', text: body.error }));
	}

	var cssClass = (componentId == '_all') ? 'all '+event : event;

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

moment.lang('en-short', {
	relativeTime: {
		future : 'in %s',
		past   : function(token){
			var suffix = ' ago';
			return token + ((token == 'just now') ? '' : suffix);
		},
		s      : "just now",
		m      : '1 min.',
		mm     : '%d min.',
		h      : '1 hour',
		hh     : '%d hours',
		d      : '1 day',
		dd     : '%d days',
		M      : '1 month',
		MM     : '%d months',
		y      : '1 year',
		yy     : '%d years'
	}
});