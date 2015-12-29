var timeoutHandle=0;
var ajaxLoaderTimer=0;
var force=null;
var hasZoomed=0;
var zoom;		// the d3 zoom function
var gdata={nodes:[],links:[]};
var globalOptions={friction:0.6,gravity:0,chargeDistance:1000,linkStrength:0.3};
var entranceExpand=true;
var isSmoothGraphAdjusting=false;	// true when the bang! process is still occurring
var visibilityTimer=0;
var isTheDisplayTooSlow=false;
var highlightCluster=[];

var w = window,
    d = document,
    e = d.documentElement,
    g = d.getElementsByTagName('body')[0],
    winwid = w.innerWidth || e.clientWidth || g.clientWidth,
    winhei = w.innerHeight|| e.clientHeight|| g.clientHeight;

window.addEventListener('popstate', function(event) {
	if (_firstLoad)
		_firstLoad = false;
	else
		updatePage(event.state,false,true);
});

document.addEventListener('DOMContentLoaded', function() {
	_firstload=true;
	var qs=window.location.search;

	history.replaceState({qs:qs,data:{}},'ecoSpace navigator', qs ? qs : '?');
//return;
	hasLoaded=true;	
	updatePage({qs:qs},false,true);
	setTimeout(function () { _firstLoad = false; }, 0);
	
	addEvent('resize',window,handleResize);
});

function updatePage(state,pushstate,setoptions) {
console.log('AJAX: '+state.qs);
	if(!state) return;
	showAjaxLoader();
	var qs=state.qs;
	if(timeoutHandle) {
		clearTimeout(timeoutHandle);
		timeoutHandle=0;
	}

	if(!qs) {
		clearNavigator();
		fetchContent('worker.php?w=getdatasets',document.getElementById('mainholder'),function() {hasLoaded=true;afterAjax(state,pushstate,setoptions);});
		return;
	} else {
		var did=getQueryVariable(qs,'ds');
		var aid=getQueryVariable(qs,'an');
		var eq='all';
		if(did && aid) {		// add new taxon to graph or to bioclimatic explorer
			afterAjax(state,pushstate,setoptions);
			return;
		}
	}
	hideAjaxLoader();
}

function afterAjax(state,pushstate,setoptions) {
// this is called after the page has been changed, used to attach specific event handlers
	var qs=state.qs;
	var did=getQueryVariable(qs,'ds'),i;
	var aid=getQueryVariable(qs,'an');
	var qt=getQueryVariable(qs,'t');
	var eq='all';
	var page=getQueryVariable(qs,'p');
	var what=getQueryVariable(qs,'w');

	document.body.scrollTop=0;
	document.documentElement.scrollTop=0;

	if(did && aid) {	// it's either in navigator or bioclimatic
		var nt=getQueryVariable(qs,'v');
		if(force) {
			gdata.nodes.forEach(function(o, i) {o.c=0;});
			setForceOptions();
			var bd=document.querySelectorAll('#but-distdownload a');
			for(var i=0;i<bd.length;i++)	// update download links
				bd[i].setAttribute('href','worker.php?w=distdownload&did='+did+'&aid='+aid);
//					updateGraph(state,state.mode ? state.mode : ((!qt || qt=='i') ? 'add' : 'replace'),function() {
			updateGraph(state,state.mode ? state.mode : (!nt ? (qt=='i' ? 'add' : 'replace') : (nt=='p' ? 'replace' : 'add')),function() {
				attachAutomaticFit();
			});
		
		} else {
			showAjaxLoader();
			startNavigator(state,function() {
				showAjaxLoader();
				setForceOptions();
				afterAjax(state,pushstate,setoptions);
			});
			return;
		}
	
		var el=document.querySelector('#densitymap-holder .button');
		if(setoptions) {	// this sets the toolbar buttons according to the querystring
			setNNeighbors(parseInt(getQueryVariable(qs,'nn') ? getQueryVariable(qs,'nn') : getNNeighbors()));
		}
	}

	if(hasLoaded) {
		attachHyperlinkClicks($('a:not(.external)'));
		// and attach topbar button handlers (no matter which page is in
		var buttons=$('#mainholder .button:not(.dead)');
		for(i=0;i<buttons.length;i++) addEvent('click',buttons[i],clickTopButton);
		
		var wnddown=document.querySelector('#wnd-downloads .closebutton');
		if(wnddown) addEvent('click',wnddown,function() {clickTopButton({target:document.getElementById('but-download')});});
		
		hasLoaded=false;
	}

	if(pushstate) history.pushState(state, 'ecoSpace', qs ? qs : '?');
	
	var bd=document.querySelector('#but-popup a');
	if(bd) bd.setAttribute('href',window.location.search);
	
	if(window.location.hash) {
		var el=document.querySelector('a[name='+window.location.hash.substr(1)+']');
		if(el) {
			el.scrollIntoView();
		}
	}
}

function showAjaxLoader() {
	if(ajaxLoaderTimer) return;
	ajaxLoaderTimer=setTimeout(function() {
		ajaxLoaderTimer=0;
		var el=document.getElementById('loader');
		el.style.display='block';
		el.style.opacity=0;
		var dummy=el.offsetHeight;		// force redraw
		el.style.opacity=1;
	},500);
}

function hideAjaxLoader() {
	if(ajaxLoaderTimer) {
		clearTimeout(ajaxLoaderTimer);
		ajaxLoaderTimer=0;
	}
	var el=document.getElementById('loader');
	el.style.display='none';
}

// starts the navigator interface from scratch
function startNavigator(state,callback,type) {
	hasLoaded=true;
	buildNavigator(type);
	if(callback) callback();
/*	removeWindows();
	var nt=getQueryVariable(state.qs,'v');
	var qt=getQueryVariable(state.qs,'t');
	if(!type) type=!nt ? (qt=='i' ? 'navigator' : 'patfinder') : (nt=='p' ? 'patfinder' : 'navigator');// (qt=='i' ? 'navigator' : 'patfinder');
	fetchContent('worker.php?w=navigator'+ifr+'&t='+type,document.getElementById('mainholder'),function() {
		if(getQueryVariable(state.qs,'clean')) document.getElementById('navigator-holder').classList.add('clean');
		hasLoaded=true;
		buildNavigator(type);
		if(callback) callback();
	});*/
}

function buildNavigator(type) {
// this is called only once to start the force layout
	force=d3.layout.force().size([winwid, winhei]);
	
/*
var x = d3.scale.linear()
    .domain([0, winwid])
    .range([0, winwid]);

var y = d3.scale.linear()
    .domain([0, winhei])
    .range([0, winhei]);

zoom = d3.behavior.zoom()
    .x(x)
    .y(y)
    .size([winwid, winhei])
    .on('zoom',zoomed);
  */  
	if(type=='patfinder') {
		var effhei=getEffectiveViewableHeight();
		var scale=0.4;
		var zoomWidth = (winwid-scale*winwid)/2;
		var zoomHeight = (effhei-scale*effhei)/2;
	} else {
		var scale=1;
		var zoomWidth=0;
		var zoomHeight=0;
	}
	lastZoom=scale;
	zoom = d3.behavior.zoom().translate([zoomWidth,zoomHeight]).scale(scale)
    	.scaleExtent([0.1, 4])
    	.on("zoom", zoomed)
    		
	forceSVG = d3.select('#navigator').append('svg:svg').attr('width', winwid).attr('height', winhei)
		.call(zoom).on('click',function() {
			if(d3.event.defaultPrevented) return; // ignore drag
			highlightCluster=[];
			classifyClusters(highlightCluster);
		});
		
	forceSVG=forceSVG.append('g');
	forceSVG.attr("transform", "translate("+zoomWidth+","+zoomHeight+") scale("+scale+")");

	force.nodes(gdata.nodes).links(gdata.links);
	forceNodes=forceSVG.selectAll(".node");
	forceLinks=forceSVG.selectAll(".link");

	force.on('tick', tickWithLinks);
	
	updateLinkDistance();
}

function zoomed() {
	var duration=null;
//	forceSVG.call(zoom.translate([100, 100]).event)
	if(d3.event.sourceEvent) {	// user has manually zoomed or panned
		d3.event.sourceEvent.stopPropagation();
		d3.event.sourceEvent.preventDefault();
		hasZoomed+=1;
		if(d3.event.sourceEvent.type=='wheel') duration=200;	// to avoid wiggly multitouch gestures
	} else duration=600;	// it's an automatic zoom to fit or button click
	if(d3.event.scale!=lastZoom) {	// has zoomed
		if(hasZoomed>=3 && document.getElementById('youcanzoom')) hideMessage();
		lastZoom=d3.event.scale;
		if(duration)
			forceSVG.transition().duration(duration).attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
		else
			forceSVG.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");

		if((d3.event.scale>0.7 && document.getElementById('navigator').classList.contains('nolabels')) ||
			(d3.event.scale<=0.7 && !document.getElementById('navigator').classList.contains('nolabels')))
			clickTopButton({target:document.getElementById('view-labels')});
	} else
		forceSVG.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
}

function tickWithLinks(e) {
	forceLinks.attr({
		x1:getX1
		,y1:getY1
		,x2:getX2
		,y2:getY2
	});
	forceNodes.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
}

function tickWithoutLinks(e) {
	forceNodes.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
}

function updateLinkDistance() {
	force.linkDistance(function(d) {return Math.pow(1.5,getLinkLength())-0;});
}

function getX1(d) { return d.source.x; }
function getY1(d) { return d.source.y; }
function getX2(d) { return d.target.x; }
function getY2(d) { return d.target.y; }

function handleResize() {
	winwid=window.innerWidth;
	winhei=window.innerHeight;
	if(force) {
		var svg=$('#navigator svg')[0];
		svg.style.height=winhei+'px';
		svg.style.width=winwid+'px';
		force.size([winwid,winhei]);
		if(!document.querySelector('#densitymap-holder.big')) force.resume();
	}

	adjustSidePane();
	
	el=document.querySelector('#densitymap-holder');
	if(el) {
		if(el.classList.contains('big')) {
			var tb=document.getElementById('topbar').getBoundingClientRect();
			var ts=document.getElementById('taxonselector').getBoundingClientRect();
			el.style.height=(winhei-tb.height)+'px';
			el.style.width=(winwid-ts.width)+'px';
		} else {
			el.style.height='auto';
			el.style.width='auto';
		}
	}
}

function adjustSidePane() {
	var el=document.querySelectorAll('.sidepane:not(.volatile)');
	var tb=document.getElementById('topbar');
	if(tb) tb=tb.getBoundingClientRect(); else return;
	
	for(var i=0;i<el.length;i++) {
		el[i].style.height=(winhei-tb.height)+'px';
	}
}

function setForceOptions() {
	if(!force) return;
	force
		.friction(globalOptions.friction)
		.gravity(globalOptions.gravity)
		.chargeDistance(globalOptions.chargeDistance)
		.linkStrength(globalOptions.linkStrength);
}

function updateGraph(state,mode,callback) {
	var qs=state.qs;
	var qt=getQueryVariable(qs,'t');
	var eq='all';
	var nt=getQueryVariable(qs,'v');	// navigator type
	var opts={
		nlevels: 1
		,nneighbors: getQueryVariable(qs,'nn')===null ? getNNeighbors() : parseInt(getQueryVariable(qs,'nn'))
		,navtype: !nt ? (qt=='i' ? 'navigator' : 'patfinder') : (nt=='p' ? 'patfinder' : 'navigator')	// default is navigator
		,seclinks: 1
		,mode: mode
		,aid: getQueryVariable(qs,'an')
		,did: getQueryVariable(qs,'ds')
		,qt:qt
		,callback:callback
	};
	loadNeighbors(eq,opts);
}

function getNNeighbors() {
	var el=document.getElementById('nneighbors').innerHTML;
	if(el) return parseInt(el);
	else return 5;
}

function setNNeighbors(nnei) {
	var el=document.querySelector('#nneighbors');
	if(el && nnei!==null && nnei!==undefined && !isNaN(nnei)) el.innerHTML=nnei;
}

function loadNeighbors(taxid,opt,nocenter) {
//	if(!force) buildNavigator();
	force.stop();
	if(opt.nlevels===undefined || isNaN(opt.nlevels)) opt.nlevels=1;
	if(opt.nneighbors===undefined || isNaN(opt.nneighbors)) opt.nneighbors=getNNeighbors();
	if(opt.seclinks===undefined || isNaN(opt.seclinks)) opt.seclinks=getSeclinks();
	if(opt.qt===undefined || !opt.qt) opt.qt='i';
	if(opt.did===undefined || !opt.did) opt.did=getQueryVariable(window.location.search,'ds');
	if(opt.aid===undefined || !opt.aid) opt.aid=getQueryVariable(window.location.search,'an');
	var nav=document.getElementById('navigator-holder');
	if(nav) nav.classList.remove('disabled');
	if(taxid.toLowerCase()=='all') {	// exception: all means full network!
		opt.qt='i';
		showMessage("Warning: displaying the full network may cause your browser to run very slowly, and may take a while to load. Please be patient.");
		if(nav) nav.classList.add('fullnetwork');
	} else if(nav) nav.classList.remove('fullnetwork');
	
	var querypar='&q='+encodeURIComponent(taxid);	//(opt.internal ? '&q='+encodeURIComponent(taxid.join(',')) : '&q='+encodeURIComponent(taxid));
	
	var makeClusters='&cls=0';
	if(opt.navtype=='patfinder' || !opt.navtype) {		// hide map
		var mapel=document.getElementById('densitymap');
		mapel.style.display='none';
		makeClusters='&cls=1';
	}

	var bd=document.querySelectorAll('#but-download a');
	for(var i=0;i<bd.length;i++)
		bd[i].setAttribute('href','worker.php?w=getneig&nnei='+opt.nneighbors+'&did='+opt.did+'&aid='+opt.aid+'&nlevels='+opt.nlevels+'&t='+opt.qt+querypar+'&sec='+opt.seclinks+'&down=csv&cls=1');

	bd=document.querySelectorAll('#but-downloadigraph a');
	for(var i=0;i<bd.length;i++)
		bd[i].setAttribute('href','worker.php?w=getneig&nnei='+opt.nneighbors+'&did='+opt.did+'&aid='+opt.aid+'&nlevels='+opt.nlevels+'&t='+opt.qt+querypar+'&sec='+opt.seclinks+'&down=igraph');
		
	//document.querySelector('#but-download input[type=hidden]').value='worker.php?w=getneig&nnei='+opt.nneighbors+'&did='+did+'&aid='+aid+'&nlevels='+opt.nlevels+querypar+'&sec='+opt.seclinks+'&down=1';
//	alert('worker.php?w=getneig&nnei='+opt.nneighbors+'&did='+opt.did+'&aid='+opt.aid+'&nlevels='+opt.nlevels+'&t='+opt.qt+querypar+'&sec='+opt.seclinks+makeClusters);
//	d3.json('worker.php?w=getneig&nnei='+opt.nneighbors+'&did='+opt.did+'&aid='+opt.aid+'&nlevels='+opt.nlevels+'&t='+opt.qt+querypar+'&sec='+opt.seclinks+makeClusters, function(error, res) {
	d3.json('http://localhost:7520/get?lev='+opt.nlevels+'&nn='+opt.nneighbors+'&did='+opt.did+'&aid='+opt.aid+'&t=i&q=all', function(error, res) {
		entranceExpand=false;
	console.log(res);
		if(!res) return;
		if(!res.success) {
			if(res.serverdown) {
				var nav=document.getElementById('navigator-holder');
				if(nav) nav.classList.add('disabled');
				showWindow('<div><h1>Server down</h1><h2>ecoSpace server is down. Sorry for the inconvenience.</h2><p><a href="?">back to homepage</a></p></div>',{});
				hideAjaxLoader();
				return;
			} else {
				showMessage(res.msg,{timeout:5000});
				onUpdateData();
				return;
			}
		}
		var graph=res.results;
		for(var i=0;i<graph.nodes.length;i++) {	
			graph.nodes[i].c=graph.nodes[i].ori;
			graph.nodes[i].nrec=(graph.nodes[i].nrec/res.maxfreq)*2000;		// turn abundance to a relative scale (to the dataset maximum)
		}
		updateData(graph.nodes,graph.links,opt.origin,opt.mode ? opt.mode : 'replace');
		if(opt.callback) opt.callback();
	});
}

function showMessage(txt,opts) {
	//if(noAutomaticThings) return;
	var msg=document.getElementById('message');
	if(!msg) {
		var tb=document.getElementById('topbar');
		if(!tb) return;
		var fc=tb.querySelector(':first-child');
		if(opts && opts.id) var id=' id="'+opts.id+'"'; else var id='';
		var frag=createHTML('<div id="message"><div class="closebutton"></div><div class="content"'+id+'>'+txt+'</div><p style="clear:both;margin:0;padding:0"/></div>');
		tb.insertBefore(frag,fc);
		msg=document.getElementById('message');
	} else {
		msg.querySelector('.content').innerHTML=txt;
		if(opts) msg.querySelector('.content').id=(opts.id ? opts.id : undefined);
	}
	addEvent('click',document.querySelector('#message .closebutton'),hideMessage);
	if(opts && opts.timeout) {
		setTimeout(hideMessage,opts.timeout);
	}
	handleResize();
}

function createHTML(htmlStr) {
    var frag = document.createDocumentFragment(),
        temp = document.createElement('div');
    temp.innerHTML = htmlStr;
    while (temp.firstChild) {
        frag.appendChild(temp.firstChild);
    }
    return frag;
}

function hideMessage() {
	fadeToEnd('#message',true,handleResize);
}

function attachHyperlinkClicks(el) {
	for(var i=0;i<el.length;i++) {
		removeEvent('click', el[i], clickHyperlink);
		addEvent('click', el[i], clickHyperlink);
	}
}


function clickTopButton(ev) {
	if(getParentbyClass(ev.target,'disabled')!==null) return;
	var el=getParentbyClass(ev.target,'button');
	
	if(el.classList.contains('toggle')) {
		if(el.classList.contains('radio')) {
			var buts=el.parentNode.querySelectorAll('.button.toggle.radio.selected');
			for(var i=0;i<buts.length;i++) buts[i].classList.remove('selected');
		}
		el.classList.toggle('selected');
	}
	switch(el.id) {
		case 'view-compact':
		case 'view-cozy':
		case 'view-spatious':
			updateLinkDistance();
			if(!document.querySelector('#densitymap-holder.big')) force.start();
			break;
		case 'but-upload':
			showSpeciesListUploader(true);
			break;
		case 'expand-0':
		case 'expand-1':
		case 'expand-2':
		case 'expand-3':
			checkVeryLarge();
			highlightCluster=[];
			updatePage({qs: buildQueryString({nlev: parseInt(el.id.substr(-1))},false)},true);
			break;
			
		case 'but-zoomin':
			zoomFull(1.2);
			hasZoomed+=1;
			break;
		case 'but-zoomout':
			zoomFull(0.8);
			hasZoomed+=1;
			break;
			
		case 'but-downloadsvg':
			downloadCurrentSVG();
			break;
			
		case 'but-navigator':
			if(el.classList.contains('selected'))
				showMessage('Click a node to enter the navigator view');
			else
				hideMessage();
/*			switchNavigatorTo('navigator');
			setForceOptions();*/
			break;
		
		case 'but-nnei':
			var sl=el.querySelector('.verticalslide');
			el.classList.toggle('floating');
			el.parentNode.querySelectorAll('.legend')[1].classList.toggle('nodisp');
			sl.classList.toggle('nodisp');
			var dummy=sl.offsetHeight;		// force redraw
			if(sl.classList.contains('nodisp')) {
				sl.style.maxHeight='0px';
				var oldval=el.querySelector('.bigtext').innerHTML;
				var val=ev.target.getAttribute('data-val');
				if(val!==null) {
					el.querySelector('.bigtext').innerHTML=val;
					if(parseInt(oldval)!=parseInt(val)) {
						checkVeryLarge();
						highlightCluster=[];
						force.stop();
						updatePage({qs:buildQueryString({
							nnei: parseInt($('#nneighbors')[0].innerHTML)
						},false)},true);
					}
				}
			} else {
				sl.style.maxHeight='300px';
			}
			break;
			
/*		case 'but-seclinks':
			updatePage({qs: buildQueryString({seclinks: el.classList.contains('selected') ? 1 : 0},false)},true);
			break;*/
			
		case 'view-links':
			linksVisible=document.getElementById('navigator').classList.contains('nolinks');
			if(linksVisible) {
				force.on('tick', tickWithLinks);
				tickWithLinks();
			} else {
				force.on('tick', tickWithoutLinks);
				tickWithoutLinks();
			}
			document.getElementById('navigator').classList.toggle('nolinks');
			break;
		case 'view-labels':
			document.getElementById('navigator').classList.toggle('nolabels');
			break;
/*		case 'view-original':
			document.getElementById('navigator').classList.toggle('onlyoriginal');
			break;*/
		case 'but-home':
			updatePage({qs:''},true);
			break;
		case 'but-clean':
			cleanNodesFarther(1,true);
			break;
		case 'but-addtax':
			if(document.getElementById('densitymap-holder').classList.contains('big')) break;
			
			if(el.classList.contains('selected'))
				showTaxonSelector(false);
			else
				hideSidePane('taxonselector');
			break;
		case 'but-changematrix':
			if(el.classList.contains('selected'))
				showDistanceMatrix();
			else
				hideSidePane('distancematrix');
			break;

		case 'but-fullscreen':
			document.getElementById('navigator-holder').classList.toggle('fullscreen');
			break;
			
		case 'but-expand':
			cleanNodesFarther(2,true);
			updatePage({qs: buildQueryString({nlev:2},false)},true);
			break;
			
		case 'but-sortname':
		case 'but-sortfreq':
			var els=$('#taxonselector .button');
			for(var i=0;i<els.length;i++) els[i].classList.remove('selected');
			el.classList.add('selected');
			sortTaxonSelector();
			break;
		
		case 'but-bioclim':
			updatePage({qs:buildQueryString({page:'bio'},false)},true);
			break;
			
		case 'but-ecospace':
			updatePage({qs:buildQueryString({page:null,navtype:'navigator'},false)},true);
			break;
		case 'but-hints':
			var msg='<h2>A few hints</h2><p style="font-size:0.8em">Click a node to subdivide its cluster into sub-clusters &#x26AB Drag &amp; zoom the graph with the mouse &amp; mousewheel &#x26AB Filled circles are the species present in your list; open circles are neighbors which were not in the list &#x26AB Size of circles is proportional to the flow (PageRank) of the node &#x26AB If the display is too clumsy, try the cozy view &#x26AB Adjust the neighbor order and number of neighbors to get the most info of your network: more links mean more information is taken into account, but also potentially more noise! &#x26AB Change the underlying variables by changing the distance matrix: different variables may yield quite different networks! &#x26AB If you think the network is not at its best configuration, you can drag nodes to rearrange it &#x26AB You can download your network and underlying data!</p>';
			showMessage(msg);
			break;
		case 'but-bang':
			doBang();
			break;
			
		case 'but-download':
			if(el.classList.contains('selected')) {
				var el=document.getElementById('wnd-downloads');
				if(el) {
					el.style.display='block';
					var dummy=el.offsetHeight;		// force redraw
					el.style.opacity='1';
				}
			} else
				hideSidePane('wnd-downloads');
			break;
			
		case 'but-stop':
			if(el.classList.contains('selected'))
				force.stop();
			else
				force.start();
			break;
	}
}

function updateData(newnodes,newlinks,origin,mode) {
	var markinitial=false;
	if(newnodes) {
		var merge=mergeNodes(newnodes);
		if(mode=='replace') {	// add new nodes and remove from graph those that are not in newnodes
			gdata.nodes=merge.keep;
		}
		var onlynewnodes=merge.add;
	// set initial coordinates
		if(origin && origin.x) {
			for(var i=0;i<onlynewnodes.length;i++) {
				var ang=Math.random()*2*3.14159;
				onlynewnodes[i].x=origin.x+60*Math.cos(ang);
				onlynewnodes[i].y=origin.y+60*Math.sin(ang);
			}
		} else {
			for(var i=0;i<onlynewnodes.length;i++) {
				onlynewnodes[i].x=Math.random()*winwid;
				onlynewnodes[i].y=Math.random()*winhei;
				if(markinitial && onlynewnodes[i].c) onlynewnodes[i].keepalive=1;
			}
		}
	// add those nodes
		gdata.nodes=gdata.nodes.concat(onlynewnodes);
	}
	if(newlinks) {
		var merge=mergeLinks(newlinks);
		if(mode=='replace') {	// add new nodes and remove from graph those that are not in newnodes
			matchLinksToNodes(merge.keep);
			gdata.links=merge.keep;
		}
		var onlynewlinks=merge.add;
		if(onlynewlinks.length>1000) {
			if(!document.getElementById('navigator').classList.contains('nolinks'))
				clickTopButton({target:document.getElementById('view-links')});
			if(!document.getElementById('navigator').classList.contains('nolabels'))
				clickTopButton({target:document.getElementById('view-labels')});
				
			if(visibilityTimer)	clearInterval(visibilityTimer);
			visibilityTimer=setInterval(function() {
				if(!force) {clearInterval(visibilityTimer);visibilityTimer=0;return;}
				if(force.alpha()<0.02 && !isSmoothGraphAdjusting) {
					clearInterval(visibilityTimer);
					visibilityTimer=0;
					if(document.getElementById('navigator').classList.contains('nolinks'))
						clickTopButton({target:document.getElementById('view-links')});
					/*if(document.getElementById('navigator').classList.contains('nolabels'))
						clickTopButton({target:document.getElementById('view-labels')});*/
					if(document.getElementById('slowmessage')) hideMessage();
									
					if(gdata.links.length>1000 && !isTheDisplayTooSlow) {
						isTheDisplayTooSlow=true;
						setTimeout(function() {
							var linksVisible=!document.getElementById('navigator').classList.contains('nolinks');
							if(linksVisible)
								showMessage('Is the display too slow? Try switching off the links or using the Chrome browser.',{timeout:5000});
							else
								showMessage('Is the display too slow? Try using the Chrome browser.',{timeout:5000});
/*							addEvent('click',document.querySelector('#message a'),function(ev) {
								ev.preventDefault();
								downloadCurrentSVG();
							});*/
						},5000);
					}
				}
			},1000);
			showMessage('Your query resulted in '+(gdata.links.length+onlynewlinks.length)+' links. Links have been hidden to accelerate the initial organization. They will be automatically switched on after the network cools down.',{id:'slowmessage'});
		}
		
		matchLinksToNodes(onlynewlinks);
		gdata.links=gdata.links.concat(onlynewlinks);
	}
	//if((onlynewlinks && onlynewlinks.length>0) || (onlynewnodes && onlynewnodes.length>0)) 
	onUpdateData();
}

function mergeNodes(newnodes) {
	var oldids=gdata.nodes.map(function(d) {return(d.id);});
	var newids=newnodes.map(function(d) {return(d.id);});
	var inters=newids.filter(function(n) {	// nodes in common
	    return oldids.indexOf(n) != -1
	});
// merge node properties
/*	var tari,srci;
	for(var i=0;i<inters.length;i++) {	// TODO should iterate over all properties
		tari=oldids.indexOf(inters[i]);
		srci=newids.indexOf(inters[i]);
		gdata.nodes[tari].n=newnodes[srci].n;
		gdata.nodes[tari].r=newnodes[srci].r;
		gdata.nodes[tari].l=newnodes[srci].l;
		gdata.nodes[tari].c=newnodes[srci].c;
		gdata.nodes[tari].com=newnodes[srci].com;
		gdata.nodes[tari].a=newnodes[srci].a;
		gdata.nodes[tari].oldid=newnodes[srci].oldid;
		//gdata.nodes[oldids.indexOf(inters[i])]=newnodes[newids.indexOf(inters[i])];
	}*/

	var onlynew=newnodes.filter(function(n) {
		return inters.indexOf(n.id)==-1;
	});

	var incommon=gdata.nodes.filter(function(n) {
		return inters.indexOf(n.id)>-1;
	});
	incommon.map(function(n) {
		var n1=newnodes[newids.indexOf(n.id)];
		for(var attrname in n1) { n[attrname] = n1[attrname]; }
		return n;
	});

	return {add:onlynew,keep:incommon};
}

function onUpdateData() {
	var drag=force.drag().on('dragstart',function(d) {
		d3.event.sourceEvent.stopPropagation();
	});
	force.stop();
	force.nodes(gdata.nodes).links(gdata.links);
	forceNodes=forceNodes.data(gdata.nodes, function(d) { return d.id;});
	forceNodes.exit().attr('class', 'node removing').transition().duration(500).style('opacity',0).remove();
	forceLinks=forceLinks.data(gdata.links);
	forceLinks.exit().attr('class', 'link removing').transition().duration(500).style('opacity',0).remove();
	updateStrengths();
	force.start();
	
	var tmp=forceNodes.enter();	
	tmp=tmp.append('g').attr('class','node').call(force.drag).on('click',clickNode);//.on('mouseover',function(d) {d3.select(d3.event.target).style('fill','black');});
	
	tmp.append('circle');
	tmp.append('text').attr("dx", 0).attr("dy", ".35em");
	
	forceLinks.enter().insert('line','svg g').attr("class", "link");
	classifyClusters(highlightCluster);

	updateStyles(3);
	hideAjaxLoader();
//	if(!document.querySelector('#densitymap-holder.big')) force.start();
	if(gdata.nodes.length>400) doBang();
}

function doBang() {
	if(!force || isSmoothGraphAdjusting) {
		clearTimeout(isSmoothGraphAdjusting);
		isSmoothGraphAdjusting=0;
		return;
	}
	var original=document.querySelector('#linklength .button.selected');
	force.linkStrength(0.015);
	clickTopButton({target:document.getElementById('view-spatious')});
	isSmoothGraphAdjusting=setTimeout(function() {
		if(!force) {
			isSmoothGraphAdjusting=0;
			return;
		}
		force.linkStrength(0.2);
		force.start();
		isSmoothGraphAdjusting=setTimeout(function() {
			if(!force) {
				isSmoothGraphAdjusting=0;
				return;
			}
			clickTopButton({target:document.getElementById('view-compact')});
			//clickTopButton({target:original});
			setForceOptions();
			force.start();
			isSmoothGraphAdjusting=0;
		},12000/2);
	},8000/2);
}

function mergeLinks(newlinks) {
	var sourceids=gdata.links.map(function(d) {return(d.source.id);});
	var targetids=gdata.links.map(function(d) {return(d.target.id);});
	var onlynew=newlinks.filter(function(d) {
		if(sourceids.indexOf(d.sourceid)==-1 || targetids.indexOf(d.targetid)==-1) return true;
		for(var i=0;i<sourceids.length;i++) {
			if(sourceids[i]==d.sourceid && targetids[i]==d.targetid) {
				//gdata.links[i].current=d.current;
				return false;
			}
		}
		return true;
	});

	var incommon=newlinks.filter(function(d) {
		if(sourceids.indexOf(d.sourceid)==-1 || targetids.indexOf(d.targetid)==-1) return false;
		for(var i=0;i<sourceids.length;i++) {
			if(sourceids[i]==d.sourceid && targetids[i]==d.targetid) return true;
		}
		return false;
	});
	return {add:onlynew,keep:incommon};
}

function matchLinksToNodes(links) {
	var nodeids=gdata.nodes.map(function(d) {return(d.id);});
	for(var i=0;i<links.length;i++) {
		links[i].source=nodeids.indexOf(links[i].sourceid);
		links[i].target=nodeids.indexOf(links[i].targetid);
	}
}

function updateStrengths() {
	force.charge(-400);
}

function fadeToEnd(sel,remove,callback) {
	var ts=document.querySelector(sel);
	if(!ts) return;
	if(remove) {
		var fn=function(ev) {removeEvent('transitionend',ts,fn);removeEl.call(this,{target:ts});if(callback) callback();};
	} else
		var fn=function(ev) {removeEvent('transitionend',ts,fn);displayNone.call(this,{target:ts});if(callback) callback();};
		
	addEvent('transitionend',ts,fn);
	ts.style.transition='opacity 0.3s';
	ts.style.opacity='0';
}

function removeEl(ev) {
	var par=ev.target.parentNode;
	par.removeChild(ev.target);
}

function getLinkLength() {
	var el=document.querySelector('#linklength .button.selected');
	switch(el.id) {
	case 'view-compact': return 7;
	case 'view-cozy': return 11.5;
	case 'view-spatious': return 14;
	}
}

function clickNode(d) {
	if(d3.event.defaultPrevented) return; // ignore drag
	d3.event.preventDefault();
	
	if(document.getElementById('navigator')) {
		if(d.cls) {
			if(this.hasClass('hidden')) {
				highlightCluster=[];
			} else {
				if(d.cls[highlightCluster.length])
					highlightCluster.push(d.cls[highlightCluster.length]);
			}
		}
		classifyClusters(highlightCluster);
	}
}

/**
 * Assigns classes to all nodes according to their properties
*/
function classifyClusters(level) {
	var count=0,countquery=0,maxi=0;

	forceSVG.selectAll('.node:not(.removing)').attr('class',function(d) {
		var classes=['node'];
		if(d.ori) classes.push('original');
//		if(hide && level>-1 && d.cls[level]!=hide) classes.push('hidden'); else {
			if(d.cls) {
				var foi=false;
				for(var i=0;i<level.length;i++) {
					if(d.cls[i]!=level[i]) {foi=true;break;}
				}
				if(foi) classes.push('hidden'); else {
					count++;
					if(d.ori) countquery++;
					if(d.cls[level.length]>maxi) maxi=d.cls[level.length];
					if(d.cls.length>=level.length) classes.push('cluster'+(parseInt((d.cls[level.length]-1) % 11)+1) );
				}
			}
	//	}
		return classes.join(' ');
	});
	
	forceSVG.selectAll('.link:not(.removing)').attr('class',function(d) {
		if(d.bi) var base='link bidirectional '; else var base='link ';
		var foi=false;
		for(var i=0;i<(highlightCluster.length+1);i++) {
			if(d.source.cls[i]!=d.target.cls[i]) {foi=true;break;}
		}
		if(!foi) return base+'cluster'+(parseInt((d.source.cls[level.length]-1) % 11)+1); else return base+'nocluster';
		//d.source.cls[highlightCluster.length]; 
	});
	
	updateClusterInfo({lastClicked:level,nnodes:count,inquery:countquery,nsubclusters:maxi});
	updateStyles(2);
}

function updateStyles(which) {
	var allnodes=forceSVG.selectAll('.node:not(.removing)');
	var allcircles=allnodes.selectAll('circle');
	if(which & 1) {
		allcircles.style('fill', '')
			.style('stroke-width','')
			.attr('r', function(d) { return Math.sqrt(d.flow*15000)+5;});
		
		forceSVG.selectAll('.node:not(.removing) text')
			.style('font-size', function(d) { return [15,13,9,8,7,6,5][d.lev]+'px'; }) //{ return [20,16,14,12,9,8,7][d.l]+'px'; })
//			.style('fill', function(d) { return colortext[d.l]; })
			.text(function(d) { return d.name; });
		allnodes
			.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
/*			.style('fill-opacity', function(d) { return isNaN(d.l) ? 0 : 1/(0.6666*(d.l==0 ? 1 : d.l)+0.3333); })
			.style('stroke-opacity', function(d) { return isNaN(d.l) ? 0 : 1/(0.6666*(d.l==0 ? 1 : d.l)+0.3333); })*/
	}
	if(which & 2) {
		forceSVG.selectAll('.link:not(.removing)')
			.style("stroke-width", function(d) {return Math.pow((d.wei + 0.01),2)*10;})
			.style('stroke',function(d) {
				var src=allnodes.filter(function(d1) {return d1.id==d.source.id}).node();
				var tar=allnodes.filter(function(d1) {return d1.id==d.target.id}).node();
				if(src.hasClass('hidden') || tar.hasClass('hidden')) return '#eee';
			})
	}
}

function updateClusterInfo(clusterStats) {
	var el=document.getElementById('clusterinfo');
	if(!el) return;
	el.innerHTML=(clusterStats.lastClicked.length>0 ? '<b>Cluster '+clusterStats.lastClicked.join(':')+'</b><br/>' : '<b>Whole network</b><br/>')+clusterStats.nsubclusters+' '+(clusterStats.lastClicked.length>0 ? 'sub-' : '')+'clusters<br/>'+clusterStats.nnodes+' species<br/>'+clusterStats.inquery+' in assemblage';
}

function attachAutomaticFit() {
	if(hasZoomed<1) setTimeout(automaticFit,5000);
	if(hasZoomed<3) setTimeout(function() {
		if(hasZoomed<3) showMessage('You can zoom and pan the graph with the mouse and mousewheel!',{id:'youcanzoom'});
	},30000);
}

function automaticFit() {
	if(hasZoomed<1) {
		zoomFull();
		setTimeout(automaticFit,15000);
	}
}

function checkVeryLarge() {
//	if(gdata.nodes.length>300 && getNLevels()>2 && getNNeighbors()>5) {
	if(gdata.nodes.length*Math.pow(getNNeighbors(),1)>20000) {
		showMessage('You requested potentially a very large network. Be patient while it loads...',{timeout:5000});
		setTimeout(function(){}, 10);
	}
}

/**
	Fits the whole graph inside the window
*/
function zoomFull(factor) {
	var svg=d3.select('#navigator svg');
	svg.call(zoom.event);
	var trans1=zoom.translate();
	var scale=zoom.scale();
	var padding=winhei*0.15;
	var effhei=getEffectiveViewableHeight()-padding;

	if(factor==undefined) {
		var minx=100000,maxx=-100000,miny=100000,maxy=-100000;
		for(var i=0;i<gdata.nodes.length;i++) {
			if(gdata.nodes[i].x>maxx) maxx=gdata.nodes[i].x;
			if(gdata.nodes[i].x<minx) minx=gdata.nodes[i].x;
			if(gdata.nodes[i].y>maxy) maxy=gdata.nodes[i].y;
			if(gdata.nodes[i].y<miny) miny=gdata.nodes[i].y;
		}
	} else {
		var ul=mapCoordinatesToSVG(svg.node(),0,winhei-effhei);
		var br=mapCoordinatesToSVG(svg.node(),winwid,effhei);
		var nwid=(br.x-ul.x)*(factor-1);
		var nhei=(br.y-ul.y)*(factor-1);
		var minx=ul.x+nwid/2;
		var maxx=br.x-nwid/2;
		var miny=ul.y+nhei/2;
		var maxy=br.y-nhei/2;
	}

	if((maxx-minx)/(maxy-miny) > winwid/effhei)
		var newscale=winwid/(maxx-minx);
	else
		var newscale=effhei/(maxy-miny);
	var tx=-((maxx+minx)/2)*newscale+(winwid/2);
	var ty=-((maxy+miny)/2)*newscale+(effhei/2)+(winhei-(effhei+padding))+padding/2;
	zoom.translate([tx,ty]).scale(newscale);
	svg.call(zoom.event);
}

function getEffectiveViewableHeight() {
	var tbel=document.getElementById('topbar');
	if(!tbel) return winhei;
	var tb=tbel.getBoundingClientRect();
	if(tbel.offsetParent===null) {
		return winhei;
	} else
		return winhei-tb.height;
}

/**
 * parameters: (pass null to remove a parameter from querystring)
 * what
 * page
 * did
 * aid
 * qt		query type i: internal (comma-separated taxon names or IDs only)
 * eq		external query
 * nnei
 * nlev
*/

function buildQueryString(opts,clear) {
	if(clear) {
		var did=opts.did;
		var aid=opts.aid;
		var qt=opts.qt;
		var nt=opts.navtype;
		var eq=opts.eq;
		var sl=opts.sl;		// species list file name
		var nnei=opts.nnei;
		var nlev=opts.nlev;
		var what=opts.what;
		var secl=opts.seclinks;
	} else {
		var qs=window.location.search;
		var did =(opts.did || opts.did===null) ? opts.did : getQueryVariable(qs,'ds');
		var aid =(opts.aid || opts.aid===null) ? opts.aid : getQueryVariable(qs,'an');
		var qt  =(opts.qt || opts.qt===null) ? opts.qt : getQueryVariable(qs,'t');
		var nt  =(opts.navtype || opts.navtype===null) ? opts.navtype : (getQueryVariable(qs,'v')=='p' ? 'patfinder' : (qt=='i' ? 'navigator' : 'patfinder'));
		var eq  =(opts.eq || opts.eq===null)  ? opts.eq : getQueryVariable(qs,'q');
		var sl  =(opts.sl || opts.sl===null)  ? opts.sl : getQueryVariable(qs,'sl');
		var nnei=(opts.nnei!==undefined) ? opts.nnei : getQueryVariable(qs,'nn');
		var nlev=(opts.nlev!==undefined) ? opts.nlev : getQueryVariable(qs,'nlev');
		var what=(opts.what || opts.what===null) ? opts.what : getQueryVariable(qs,'w');
		var secl=(opts.seclinks!==undefined) ? opts.seclinks : getQueryVariable(qs,'sec');
	}

	if(eq && eq.toLowerCase=='all') qt='i';
	var q=[];
	if(did) q.push('ds='+did);
	if(aid) q.push('an='+aid);
	if(qt) q.push('t='+qt);
	if(nt) q.push('v='+(nt=='patfinder' ? 'p' : 'n'));
	if(eq) q.push('q='+eq);
	if(sl) q.push('sl='+sl);
	if(nnei!==null && nnei!==undefined) q.push('nn='+nnei);
	if(nlev!==null && nlev!==undefined) q.push('nlev='+nlev);
	if(what) q.push('w='+what);
	if(secl!==null && secl!==undefined) q.push('sec='+secl);
	return '?'+q.join('&');
}

