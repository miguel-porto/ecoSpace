var force=null;
var forceSVG=null;
var container=null;
var secondaryLinks=true;
var tracklog=true;
var forceNodes,forceLinks;
var colorcircle=['#f33','#f55','#f77','#f99','#fbb','#fdd'];
var colortext=['#000','#222','#444','#666','#888','#aaa'];
var gdata={nodes:[],links:[]};
var globalOptions={patfinder:{friction:0.6,gravity:0,chargeDistance:1000,linkStrength:0.3}
				,navigator:{friction:0.7,gravity:0.1,chargeDistance:100000,linkStrength:0.7}};
var highlightCluster=[];
var entranceExpand=true;
var linksVisible=true;
var lastZoom;
var visibilityTimer=0;
var isTheDisplayTooSlow=false;
var hasZoomed=0;
var zoom;		// the d3 zoom function

function showSpeciesListUploader(closebutton) {
	showWindow('',{id:'speclistupload',classes:'justified big',closeable:closebutton});
	fetchContent('worker.php?w=getchoosespecies',document.querySelector('#speclistupload .content'),function() {
		addEvent('change',document.querySelector('#speclistupload input[type=file]'),function(ev) {
			var file=this.files[0];
			var types=['text/plain','text/comma-separated-values','text/csv','application/csv','application/excel','application/vnd.ms-excel','application/vnd.msexcel'];
			if(types.indexOf(file.type)==-1) {
				alert('File must be a text or CSV file');
			}
		});
	
		addEvent('keypress',document.querySelector('#speclistupload input[name=query]'),function(ev) {
			if(ev.keyCode==13) {
				if(getNavigatorType()=='patfinder') {
					updatePage({qs:buildQueryString({
						eq:document.querySelector('#speclistupload input[name=query]').value
						,seclinks:1
						,navtype:'patfinder'
						,qt:'flora-on'		// TODO
					},false)},true,false);
				} else {
					updatePage({qs:buildQueryString({
						eq:document.querySelector('#speclistupload input[name=query]').value
						,nnei:5,nlev:2,seclinks:1
						,navtype:'patfinder'
						,qt:'flora-on'		// TODO
					},false)},true,true);
				}
				fadeToEnd('#speclistupload',true);
			}
		});

		addEvent('click',document.querySelector('#speclistupload .bigmenuholder'),function(ev) {
			if(ev.target.tagName!='A') return;
			ev.preventDefault();
			updatePage({qs:buildQueryString({
				eq:ev.target.textContent,
				nnei:5,nlev:1,seclinks:1
				,qt:'flora-on'		// TODO
			},false)},true,true);
			fadeToEnd('#speclistupload',true);
		});
		
		addEvent('submit',document.querySelector('#speclistupload form'),function(ev) {
			ev.preventDefault();
			var fileel=document.querySelector('#speclistupload input[type=file]');
			var file=fileel.files;
			if(file.length<1) {		//text/plain
				alert('Please select a text or CSV file.');
				return;
			}
			var xhr = new XMLHttpRequest();
			var fd = new FormData();
			xhr.open("POST", 'worker.php', true);
			xhr.onreadystatechange = function() {
				if (xhr.readyState == 4 && xhr.status == 200) {
					var resp=JSON.parse(xhr.responseText);
					if(getNavigatorType()=='patfinder')
						var opt={eq:resp.file,qt:'file'};
					else
						var opt={eq:resp.file,qt:'file',nlev:2,nnei:5};
						
					force.stop();
					gdata={nodes:[],links:[]};
					updatePage({qs: buildQueryString(opt,false)},true,true);
					fadeToEnd('#speclistupload',true);
				}
			};
			fd.append("upload_file", fileel.files[0]);
			xhr.send(fd);
		});
	});
}

function doBang() {
	if(!force || getNavigatorType()=='navigator' || isSmoothGraphAdjusting) {
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

function downloadCurrentSVG() {
/*	highlightCluster=[];
	classifyClusters(highlightCluster);*/
	var obj={nodes:[],links:[]};
	var minx=100000,maxx=-100000,miny=100000,maxy=-100000;
	for(var i=0;i<gdata.nodes.length;i++) {
		if(gdata.nodes[i].x<minx) minx=gdata.nodes[i].x;
		if(gdata.nodes[i].x>maxx) maxx=gdata.nodes[i].x;
		if(gdata.nodes[i].y<miny) miny=gdata.nodes[i].y;
		if(gdata.nodes[i].y>maxy) maxy=gdata.nodes[i].y;
	}
	obj.rect={minx:minx,maxx:maxx,miny:miny,maxy:maxy};
	forceNodes.each(function(d,i) {
		var cs=getComputedStyle(this.querySelector('circle'));
		obj.nodes.push({
			transform:this.getAttribute('transform')
			,x:d.x,y:d.y
			,ori:d.ori
			,txt:d.name
			,cluster:d.cls
			,r:this.querySelector('circle').getAttribute('r')
			,fill:cs.fill
			,stroke:cs.stroke
			,strokeWidth:cs.strokeWidth
			,visi:!this.hasClass('hidden')
		});
	});

	forceLinks.each(function(d,i) {
		var cs=getComputedStyle(this);
		obj.links.push({
			x1:d.source.x
			,y1:d.source.y
			,x2:d.target.x
			,y2:d.target.y
			,stroke:cs.stroke
			,strokeWidth:cs.strokeWidth
			,strokeOpacity:cs.strokeOpacity
			,strokeDasharray:cs.strokeDasharray
		});
	});
	
	var xhr = new XMLHttpRequest();
	var fd = new FormData();
	xhr.open("POST", 'worker.php', true);
	xhr.onreadystatechange = function() {
		if (!(xhr.readyState == 4 && xhr.status == 200)) return;
		var filename = "";
		var disposition = xhr.getResponseHeader('Content-Disposition');
		if (disposition && disposition.indexOf('attachment') !== -1) {
			var filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i;
			var matches = filenameRegex.exec(disposition);
			if (matches != null && matches[1]) filename = matches[1].replace(/['"]/g, '');
		}

        var type = xhr.getResponseHeader('Content-Type');
        var blob = new Blob([xhr.responseText], { type: type });

        if (typeof window.navigator.msSaveBlob !== 'undefined') {
            // IE workaround for "HTML7007: One or more blob URLs were revoked by closing the blob for which they were created. These URLs will no longer resolve as the data backing the URL has been freed."
            window.navigator.msSaveBlob(blob, filename);
        } else {
            var URL = window.URL || window.webkitURL;
            var downloadUrl = URL.createObjectURL(blob);
            if (filename) {
                // use HTML5 a[download] attribute to specify filename
                var a = document.createElement("a");
                // safari doesn't support this yet
                if (typeof a.download === 'undefined') {
                    window.location = downloadUrl;
                } else {
                    a.href = downloadUrl;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                }
            } else {
            	alert('Some error occurred, network too large?');
//                window.location = downloadUrl;
            }

            setTimeout(function () { URL.revokeObjectURL(downloadUrl); }, 100); // cleanup
        }
	};
	
	fd.append("w","downloadSVG");
	fd.append("data", JSON.stringify(obj));
	xhr.send(fd);
}

function checkVeryLarge() {
//	if(gdata.nodes.length>300 && getNLevels()>2 && getNNeighbors()>5) {
	if(gdata.nodes.length*Math.pow(getNNeighbors(),getNLevels())>20000) {
		showMessage('You requested potentially a very large network. Be patient while it loads...',{timeout:5000});
		setTimeout(function(){}, 10);
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
			if(getNavigatorType()=='patfinder') {
				checkVeryLarge();
				highlightCluster=[];
				updatePage({qs: buildQueryString({nlev: parseInt(el.id.substr(-1))},false)},true);
			}
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
					if(getNavigatorType()=='patfinder' && parseInt(oldval)!=parseInt(val)) {
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

// gets whether we are in Pattern Finder or Navigator
function getNavigatorType() {
	var el=document.getElementById('navigator-holder');
	if(!el) return null;
	if(el.classList.contains('patfinder')) return 'patfinder';
	if(el.classList.contains('navigator')) return 'navigator';
	return null;
}

function mapCoordinatesToSVG(svgel,x,y) {
	var pnt=svgel.createSVGPoint();
	var svgCTM=svgel.querySelector('g').getScreenCTM();		// the g here is the g element that has the zoom transformations
	pnt.x=x;
	pnt.y=y;
	return(pnt.matrixTransform(svgCTM.inverse()));
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

function setForceOptions() {
	if(!force) return;
	var nt=getNavigatorType();
	force
		.friction(globalOptions[nt].friction)
		.gravity(globalOptions[nt].gravity)
		.chargeDistance(globalOptions[nt].chargeDistance)
		.linkStrength(globalOptions[nt].linkStrength);
}
//var zoom;
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
		if(getNavigatorType()=='patfinder') {
			if((d3.event.scale>0.7 && document.getElementById('navigator').classList.contains('nolabels')) ||
				(d3.event.scale<=0.7 && !document.getElementById('navigator').classList.contains('nolabels')))
				clickTopButton({target:document.getElementById('view-labels')});
		}
	} else
		forceSVG.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
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
//	updateForceLayout();
//	onUpdateData();

	
// and attach button handlers
/*	var buttons=$('#topbar .button');
	for(i=0;i<buttons.length;i++) addEvent('click',buttons[i],clickTopButton);*/
}

function updateLinkDistance() {
	force.linkDistance(function(d) {return Math.pow(1.5,getLinkLength())-0;});
}

function getX1(d) { return d.source.x; }
function getY1(d) { return d.source.y; }
function getX2(d) { return d.target.x; }
function getY2(d) { return d.target.y; }

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
/**
 * Assigns classes to all nodes according to their properties
*/
function classifyClusters(level) {
	if(getNavigatorType()!='patfinder') return;
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

function updateClusterInfo(clusterStats) {
	var el=document.getElementById('clusterinfo');
	if(!el) return;
	el.innerHTML=(clusterStats.lastClicked.length>0 ? '<b>Cluster '+clusterStats.lastClicked.join(':')+'</b><br/>' : '<b>Whole network</b><br/>')+clusterStats.nsubclusters+' '+(clusterStats.lastClicked.length>0 ? 'sub-' : '')+'clusters<br/>'+clusterStats.nnodes+' species<br/>'+clusterStats.inquery+' in assemblage';
}

function updateStyles(which) {
	var allnodes=forceSVG.selectAll('.node:not(.removing)');
	var allcircles=allnodes.selectAll('circle');
	if(which & 1) {
//			.style('stroke', function(d) { return d.l==0 ? '#00f' : '#fff'; })
//			.style('stroke', function(d) { return d.l==0 ? '#00f' : colorcircle[d.l]; })
//			.attr('r', function(d) { return Math.sqrt(d.a)*0.8; });
//			.attr('r', function(d) { return Math.sqrt(d.a)*0.06; });

		if(getNavigatorType()=='navigator') {
			allcircles
				.style('fill', function(d) { return d.c ? '#ff0' : (d.keepalive ? '#90c' : colorcircle[d.lev]); })
				.transition().duration(2000)
				.style('stroke-width', function(d) { return d.keepalive || d.c ? 3 : 0; })
				.attr('r', function(d) { return Math.sqrt(d.nrec)*0.8;});
		} else {
			allcircles.style('fill', '')
				.style('stroke-width','')
				.attr('r', function(d) { return Math.sqrt(d.flow*15000)+5;});
		}
	//		forceSVG.selectAll('.node:not(.removing) circle').style('fill', function(d) { return d.c ? '#ff0' : (d.ori ? '#07f' : (d.keepalive ? '#90c' : colorcircle[d.l])); })
		
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
//			.style("stroke-width", 1)
			//.style('stroke-opacity',function(d) { return isNaN(d.source.l) ? 0 : 1/(0.6666*d.source.l+0.3333); });
//			.style('stroke-opacity',function(d) { return d.source.l==d.target.l ? (secondaryLinks ? 0.2 : 0) : 1;});
//			.style('stroke-dasharray',function(d) {return d.source.l==d.target.l ? '5,5' : '';});
	}
}
function updateStrengths() {
	if(getNavigatorType()=='patfinder') {
//		force.charge(function(d) {return -Math.sqrt(d.a)*20;});
		force.charge(-400);
	} else {
		force.charge(function(d) {return(d.c ? -12000 : -Math.sqrt(d.nrec)*20);});		// the focused node is given more repulsion
	}
//		.charge(function (d) {return(d.c ? -12000 : -Math.sqrt(d.weight)*200);});
//		.charge(function(d) {return(-Math.sqrt(d.a)*40);});
//		.charge(function(d) {return(d.c ? -200 : -Math.sqrt(d.a)*10);});		// the focused node is given more repulsion
//		.charge(-200);
}

function updateData(newnodes,newlinks,origin,mode) {
	var markinitial=getNavigatorType()=='navigator';
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
									
					if(gdata.links.length>1000 && !isTheDisplayTooSlow && !noAutomaticThings) {
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


function loadNeighbors(taxid,opt,nocenter) {
//	if(!force) buildNavigator();
	force.stop();
	if(opt.nlevels===undefined || isNaN(opt.nlevels)) opt.nlevels=1;
	if(entranceExpand && getNavigatorType()=='navigator') opt.nlevels=2;
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
	
	d3.json('worker.php?w=getneig&nnei='+opt.nneighbors+'&did='+opt.did+'&aid='+opt.aid+'&nlevels='+opt.nlevels+'&t='+opt.qt+querypar+'&sec='+opt.seclinks+makeClusters, function(error, res) {
		if(entranceExpand && getNavigatorType()=='navigator') setTimeout(zoomFull,2000);
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

function countLinks(node) {
	var count=0;
	for(var i=0;i<gdata.links.length;i++) {	// count how many this node has
		if(gdata.links[i].source.id==node.id || gdata.links[i].target.id==node.id) count++;
	}
	return(count);
}

function getClickType() {
	var bs=document.getElementById('but-navigator').classList.contains('selected');
	return getNavigatorType()=='patfinder' ? (bs ? 0 : 1) : 0;
}

// Toggle children on click.
function clickNode(d) {
	if(d3.event.defaultPrevented) return; // ignore drag
	d3.event.preventDefault();
	if(document.getElementById('bioexplorer')) {
		var tid=getQueryVariable(window.location.search,'q').split(',');
		if(tid.length==1 && tid[0]=='') tid=[];
		if(tid.indexOf('iid:'+d.id)==-1) {
			tid.push('iid:'+d.id);
			updatePage({qs:buildQueryString({qt:'i',eq:tid.join(','),page:'bio'},false)},true,false);
		}
	}
	
	if(document.getElementById('navigator')) {
		var bs=document.getElementById('but-navigator').classList.contains('selected');
		switch(getClickType()) {
		case 0:
			setSeclinks(false);
			if(bs) { // it's in pattern finder, change to navigator
				force.stop();
				clickTopButton({target:document.getElementById('but-navigator')});
/*				document.getElementById('but-navigator').classList.remove('selected');
				fadeToEnd('#message',true,handleResize);*/
				switchNavigatorTo('navigator');
				setForceOptions();
				d.fixed=true;
				d.keepalive=true;
				updateData([d],[],null,'replace');
				setTimeout(function() {
					d.fixed=false;
					if(force && !document.querySelector('#densitymap-holder.big')) force.resume();
					setTimeout(zoomFull,1000);
				},2000);
				entranceExpand=true;
				setNLevels(1);
				setNNeighbors(8);
			} else {
				var clickedagain=false;
				loadMap(d);
				computeShortestDistances(d);
				var nnei=getNNeighbors();
				if(d.c==1) {	// if the focused node is clicked again, add more neighbors
					nnei+=countLinks(d);
					clickedagain=true;
				}
				forceNodes.each(function(d1) {d1.c=0;});
				d.c=1;
				d.fixed=true;
				d.keepalive=true;
				setTimeout(function() {
					d.fixed=false;
					if(force && !document.querySelector('#densitymap-holder.big')) force.resume();
				},2000);
			}
			if(entranceExpand) {
//				afterAjax({qs:buildQueryString({qt:'i',eq:d.id,nnei:8,nlev:2},false)},true);
				updatePage({qs:buildQueryString({qt:'i',eq:'iid:'+d.id,nnei:8,nlev:2,seclinks:0,navtype:getNavigatorType()},false)},true,false);
			} else {
	///			loadNeighbors([d.id],{nlevels:getNLevels(),nneighbors: nnei,internal: true,mode: 'add',origin:d,qt:'i'});
				updatePage({qs:buildQueryString({qt:'i',eq:'iid:'+d.id,nnei:nnei,nlev:getNLevels(),seclinks:0,navtype:getNavigatorType()},false)},true,false);
			}
//			afterAjax({qs:buildQueryString({qt:'i',eq:d.id,nnei:nnei,nlev:getNLevels()},false)},true);

//			updateGraph({qs:buildQueryString({eq:null,iq:d.id,nnei:nnei,nlev:1},false)},true,'add');
//			updatePage({qs:buildQueryString({eq:null,iq:d.id,nnei:nnei,nlev:1},false)},true);
			break;
		
		case 1:
			if(d.cls) {
				if(this.hasClass('hidden')) {
					highlightCluster=[];
				} else {
					if(d.cls[highlightCluster.length])
						highlightCluster.push(d.cls[highlightCluster.length]);
				}
			}
			classifyClusters(highlightCluster);
			break;
		}
	}
}

function getNLevels() {
	var el=document.querySelector('#buts-nlevels .button.selected .bigtext');
	if(!el) return 2;
	return parseInt(el.innerHTML);
}

function setNLevels(nlev) {
	if(nlev<4) {
		var el=document.querySelector('#expand-'+nlev);
		var buts=el.parentNode.querySelectorAll('.button.toggle.radio.selected');
		for(var i=0;i<buts.length;i++) buts[i].classList.remove('selected');
		el.classList.add('selected');
	}
}

function getNNeighbors() {
	var el=document.getElementById('nneighbors').innerHTML;
	if(el) return parseInt(el);
	else return (getNavigatorType()=='patfinder' ? 5 : 8);
	
	//return parseInt($('#nneighbors input[type=hidden]')[0].value);
	//return parseInt(getQueryVariable(window.location.search,'nnei') || $('#nneighbors input[type=hidden]')[0].value);
}

function setNNeighbors(nnei) {
	var el=document.querySelector('#nneighbors');
	if(el && nnei!==null && nnei!==undefined && !isNaN(nnei)) el.innerHTML=nnei;
}

function getSeclinks() {	// this option is deprecated
	return 1;
/*	var el=document.querySelector('#but-seclinks');
	if(el) return el.classList.contains('selected') ? 1 : 0; else return 0;*/
}

function setSeclinks(secl) {
	if(!secl)
		document.querySelector('#but-seclinks').classList.remove('selected');
	else
		document.querySelector('#but-seclinks').classList.add('selected');
}


function getLinkLength() {
	var el=document.querySelector('#linklength .button.selected');
	switch(el.id) {
	case 'view-compact': return 7;
	case 'view-cozy': return 11.5;
	case 'view-spatious': return 14;
	}
}

function loadMap(node,size) {
	var mapel=document.getElementById('densitymap');
	if(!mapel) return;
	if(getNavigatorType()=='navigator') {
		mapel.style.display='block';
		var did=getQueryVariable(window.location.search,'ds');
		var tb=mapel.getBoundingClientRect();
		if(!size) var size=tb.width; else var refresh=true;
		if(size<300) size=300;
		if(document.getElementById('distrib-name').textContent==node.name && !refresh) return;
		document.getElementById('distrib-name').innerHTML=node.name;
		//mapel.src='density-map.php?did='+did+'&nc=3&tids='+node.id;
		fetchContent('distr-map.php?did='+did+'&q=iid:'+node.id+'&x='+size+'&y='+size+'&nc=8&sig=0.02&r=0&g=0&b=255&m=0.1&buf=0.8',mapel,function() {
			document.getElementById('densitymap-holder').classList.remove('nodisp');
		});
		handleResize();
	} else {
		mapel.style.display='none';
	}
}

/*
function expandNode(d,noload,nlevels,nneighbors,nocenter) {
	gdata.nodes.forEach(function(o, i) {o.c=0;});
	if(!nocenter) {
		d.c=1;		// clicked node is the new center
		loadMap(d);
		d.l=0;		// clicked node is level 0
		d.fixed=true;
		setTimeout(function() {
			d.fixed=false;
			if(force && !document.querySelector('#densitymap-holder.big')) force.resume();
		},2000);
	}	
	if(tracklog) {
		d.keepalive=true;
		this.addClass('visited');	// in some browsers, the SVG element doesn't have classList
	}
//	centernode=d.index;
	if(!noload) loadNeighbors([parseInt(d.id)],{x:d.x,y:d.y,r:90,internal:true,nlevels:nlevels ? nlevels : 1,nneighbors:nneighbors,callback:nocenter ? null : function() {computeShortestDistances(d);}},nocenter);
}*/

function computeShortestDistances(d) {
	// when done loading, reassign the level for all nodes (shortest path to center) and remove farther levels
	var sp = new ShortestPathCalculator(gdata.nodes, gdata.links);
	var route;
	for(var i=0;i<gdata.nodes.length;i++) {
		if(i!=d.index) {
			route = sp.findRoute(i,d.index);
			if(route) gdata.nodes[i].l=route.distance ? route.distance : NaN;
		} else gdata.nodes[i].l=0;
	}
	if(getNavigatorType()=='navigator') cleanNodesFarther(4,false);
}

function cleanNodesFarther(level,cleanislands) {
	for(var i=gdata.nodes.length-1;i>-1;i--) {		// remove farther nodes
		if((gdata.nodes[i].l>level && !gdata.nodes[i].keepalive) || (cleanislands && isNaN(gdata.nodes[i].l))) gdata.nodes.splice(i,1);
	}
	
	var ids=gdata.nodes.map(function(d) {return(d.id);});
	for(i=gdata.links.length-1;i>-1;i--) {		// remove orphan links
		if(ids.indexOf(gdata.links[i].source.id)==-1 || ids.indexOf(gdata.links[i].target.id)==-1) gdata.links.splice(i,1);
	}
	onUpdateData();
//	updateForceLayout();
}

function showTaxonSelector(volatile) {
	var el=document.getElementById('taxonselector');
	if(el) {
		if(!volatile) el.classList.remove('volatile');
		el.style.display='flex';
		var dummy=el.offsetHeight;		// force redraw
		el.style.opacity='1';
	} else {
		showWindow('<div><h1>'+(volatile ? 'Pick a taxon' : 'Add taxon')+'</h1><input type="text" name="taxon"/><br/>sort by <span class=\"button\" id=\"but-sortname\">name</span> | <span class=\"button selected\" id=\"but-sortfreq\">abundance</span><p style=\"clear:both;\"/></div><div><ul class="taxonlist"></ul></div>',{id:'taxonselector',classes:'sidepane '+(volatile ? 'volatile' : 'fixed')});
		populateTaxaList('taxonselector');
	}
	adjustSidePane();
	if(el=document.getElementById('bioexplorer')) {
		el.classList.add('hastaxonsel');
	}
}

function showDistanceMatrix() {
	var el=document.getElementById('distancematrix');
	if(el) {
		el.style.display='block';
		var dummy=el.offsetHeight;		// force redraw
		el.style.opacity='1';
	} else {
		showWindow('<h1>Choose a distance matrix</h1><div class="subcontent"></div>',{id:'distancematrix',classes:'sidepane fixed'});
		var elID='distancematrix';
		var did=getQueryVariable(window.location.search,'ds');	
		
		loadXMLDoc('worker.php?w=getanalyses&did='+did,function(xmlo) {
			xmlo=xmlo.target;
			if(xmlo.readyState == 4 && xmlo.status == 200) {
				var data=xmlo.responseText;
				var el=document.querySelector('#distancematrix .subcontent');
				el.innerHTML=data;
				var els=el.querySelectorAll('.analysis');

				var aids=el.querySelectorAll('.analysis input[type=hidden]');
				aids=[].map.call(aids,function(d) {return d.value});
				var sel=aids.indexOf(getQueryVariable(window.location.search,'an'));
				els[sel].classList.add('selected');
				for(var i=0;i<els.length;i++) {
					if(!els[i].querySelector('input[type=hidden]')) continue;
					addEvent('click',els[i],function(ev) {
						var el=getParentbyClass(ev.target,'analysis');
						if(el.classList.contains('selected')) return;
						var par=getParentbyTag(el,'ul');
						var ans=par.querySelectorAll('.analysis');
						for(var i=0;i<ans.length;i++)
							ans[i].classList.remove('selected');
						el.classList.add('selected');
						var aid=el.querySelector('input[type=hidden]').value;
						highlightCluster=[];
						if(getNavigatorType()=='navigator') {
							updatePage({qs: buildQueryString({aid:aid},false), mode:'replace'},true,false);
/*							var qs=buildQueryString({aid:aid},false);
							updateGraph({qs: qs},'replace',function() {
								history.pushState({qs: qs}, 'ecoSpace', qs);
							});*/
						} else
							updatePage({qs: buildQueryString({aid:aid},false)},true,false);
					});
				}
			}
		});	
		
	}
	adjustSidePane();
}

function populateTaxaList(elID) {
	showAjaxLoader();
	var did=getQueryVariable(window.location.search,'ds');
	var aid=getQueryVariable(window.location.search,'an');
	if(!did || !aid) return;
	loadXMLDoc('worker.php?w=gettaxa&did='+did+'&aid='+aid,function(xmlo) {
		xmlo=xmlo.target;
		if(xmlo.readyState == 4 && xmlo.status == 200) {
			var data=xmlo.responseText;
			data=JSON.parse(data);
			hideAjaxLoader();
			var lis=d3.select('#'+elID+' ul.taxonlist').selectAll('li').data(data).enter()
				.append('li')
				.text(function(d) {return(d.name);}).on('click',function(d) {
/*					var node=forceSVG.selectAll('.node').filter(function(d1) {
						return d1.id==d.id;
					});
					clickNode.call(node.node(),d);*/
					clickNode(d);
					if(document.getElementById(elID).classList.contains('volatile')) hideSidePane('taxonselector');
				});
			sortTaxonSelector();
			var els=$('#'+elID+' span.button');
			for(var i=0;i<els.length;i++) addEvent('click',els[i],clickTopButton);
			addEvent('keyup',$('#'+elID+' input[name=taxon]')[0],function(ev) {
				if(timeoutHandle) clearTimeout(timeoutHandle);
				timeoutHandle=setTimeout(doTaxonFilter,500);
			});
		}
	});	
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

function hideSidePane(id) {
	fadeToEnd('#'+id,false);
	if(el=document.getElementById('bioexplorer')) {
		el.classList.remove('hastaxonsel');
	}
}

function removeEl(ev) {
	var par=ev.target.parentNode;
	par.removeChild(ev.target);
}

function displayNone(ev) {
	if(ev.target!==this) return;
	ev.target.style.display='none';
	removeEvent('transitionend',ev.target,displayNone);
}

function doTaxonFilter() {
	timeoutHandle=0;
	var re=new RegExp(document.querySelector('#taxonselector input[name=taxon]').value,'i');
	d3.selectAll('#taxonselector ul.taxonlist li').style({'display':'list-item'}).filter(function(d,i) {
		if(d.name.match(re)) return false; else return true;
	}).style({'display':'none'});
}

function sortTaxonSelector() {
	var sortorder=document.querySelector('#taxonselector .button.selected').id;
	if(sortorder=='but-sortname')
		d3.select('#taxonselector ul.taxonlist').selectAll('li').sort(compareName);
	else
		d3.select('#taxonselector ul.taxonlist').selectAll('li').sort(compareAbund);
}

function compareName(a,b) {
  if (a.name < b.name) return -1;
  if (a.name > b.name) return 1;
  return 0;
}

function compareAbund(a,b) {
  if (a.fr < b.fr) return 1;
  if (a.fr > b.fr) return -1;
  return 0;
}

/*
function augment(withFn) {
    var name, fn;
    for (name in window) {
        fn = window[name];
        if (typeof fn === 'function') {
            window[name] = (function(name, fn) {
                var args = arguments;
                return function() {
                    withFn.apply(this, args);
                    return fn.apply(this, arguments);

                }
            })(name, fn);
        }
    }
}

augment(function(name, fn) {
    console.log("calling " + name);
});
*/
