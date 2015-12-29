var timeoutHandle=0;
var bioclimLayers=[];	// data bound to the bioclimatic plots
var layerOpacity=0.4;	// opacity of species layers in bioclimatic plots
var map=null;
var dragTimeoutHandle=0;
var _firstload,hasLoaded=false;
var isSmoothGraphAdjusting=false;	// true when the bang! process is still occurring
var ajaxLoaderTimer=0;
var noAutomaticThings=false;

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

function attachHyperlinkClicks(el) {
	for(var i=0;i<el.length;i++) {
		removeEvent('click', el[i], clickHyperlink);
		addEvent('click', el[i], clickHyperlink);
	}
}

function clickHyperlink(ev) {
	ev.preventDefault();
	var elp=getParentbyTag(ev.target,'a');
	updatePage({qs:elp.getAttribute('href')},true,true);
}

function clickDatasetSource(ev) {
	if(ev.target.tagName.toLowerCase()=='a') return;
	var src=ev.target.getAttribute('data-src');
	updatePage({qs:'?w=src&s='+src},true);
}

function clickKingdom(ev) {
	if(ev.target.tagName.toLowerCase()=='a') return;
	var tkey=ev.target.getAttribute('data-tkey');
	updatePage({qs:window.location.search+'&tkey='+tkey},true);
}

function requestGBIF(ev) {
	var king=getQueryVariable(window.location.search,'tkey');
	var wkt=getQueryVariable(window.location.search,'p');
	var desc=$('#mainholder input[name=desc]')[0].value;
	var auth=$('#mainholder input[name=authkey]')[0].value;

	if(desc.trim()=='' || auth.trim()=='') {
		alert('You must enter some description and an authorization key.');
		return;
	}
	loadXMLDoc('worker.php?w=newgbifds&auth='+encodeURIComponent(auth)+'&tkey='+king+'&desc='+encodeURIComponent(desc)+'&wkt='+encodeURIComponent(wkt),function(xmlo) {
		xmlo=xmlo.target;
		if(xmlo.readyState == 4 && xmlo.status == 200) {
			var data=xmlo.responseText;
			if(!data) return;
			data=JSON.parse(data);
			if(data.success)
				updatePage({qs:''},true);
			else
				alert(data.msg);
		}
	});
}

function requestFileKey() {
	var key=$('#mainholder input[name=fkey]')[0].value;
	var desc=$('#mainholder input[name=desc]')[0].value;
	var auth=$('#mainholder input[name=authkey]')[0].value;

	if(desc.trim()=='' || key.trim()=='' || auth.trim()=='') {
		alert('You must enter the file download key provided by GBIF, a description and an autorization key.');
		return;
	}
	if(!key.match(/^[0-9-]+$/i)) {
		alert('You must supply a valid download key');
		return;
	}
	loadXMLDoc('worker.php?w=newfkeyds&auth='+encodeURIComponent(auth)+'&fkey='+encodeURIComponent(key)+'&desc='+encodeURIComponent(desc),function(xmlo) {
		xmlo=xmlo.target;
		if(xmlo.readyState == 4 && xmlo.status == 200) {
			var data=xmlo.responseText;
			if(!data) return;
			data=JSON.parse(data);
			if(data.success)
				updatePage({qs:''},true);
			else
				alert(data.msg);
		}
	});
	
}

function requestDWCUrl() {
	var desc=$('#newwrapper input[name=desc]')[0].value;
	var url=$('#newwrapper input[name=dwcurl]')[0].value;
	var auth=$('#newwrapper input[name=authkey]')[0].value;

	if(desc.trim()=='' || url.trim()=='' || auth.trim()=='') {
		alert('You must enter a URL, a description and an authorization key.');
		return;
	}
	if(!url.match(re_weburl)) {
		alert('You must supply a valid and complete URL');
		return;
	}
	loadXMLDoc('worker.php?w=newdwcds&auth='+encodeURIComponent(auth)+'&url='+encodeURIComponent(url)+'&desc='+encodeURIComponent(desc),function(xmlo) {
		xmlo=xmlo.target;
		if(xmlo.readyState == 4 && xmlo.status == 200) {
			var data=xmlo.responseText;
			if(!data) return;
			data=JSON.parse(data);
			if(data.success)
				updatePage({qs:''},true);
			else
				alert(data.msg);
		}
	});
}

function enableDraw() {
	var drawControl = new L.Control.Draw({
		draw:{polyline:false,marker:false,polygon:{allowIntersection:false,guidelineDistance:10,shapeOptions:{color:'yellow',opacity:1,lineCap:'round',weight:3}}}
	});
	new L.Draw.Polygon(map, drawControl.options.draw.polygon).enable();
}

function requestAuthkey() {
	var reason=$('#mainholder input[name=reason]')[0].value;
	var email=$('#mainholder input[name=email]')[0].value;

	if(reason.trim()=='' || email.trim()=='') {
		alert('You must enter your email and a reason for requesting an authorization key.');
		return;
	}
	loadXMLDoc('worker.php?w=requestauth&email='+encodeURIComponent(email)+'&reason='+encodeURIComponent(reason),function(xmlo) {
		xmlo=xmlo.target;
		if(xmlo.readyState == 4 && xmlo.status == 200) {
			var data=xmlo.responseText;
			if(!data) return;
			data=JSON.parse(data);
			if(data.success) {
				alert('Authorization key requested. You\'ll be contacted at '+email);
				updatePage({qs:''},true);
			} else alert(data.msg);
		}
	});
}

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
		var w=getQueryVariable(qs,'w');
		if(w) {
			clearNavigator();
			fetchContent('worker.php'+qs,document.getElementById('mainholder'),function() {hasLoaded=true;afterAjax(state,pushstate,setoptions);});
			return;
		} else {
			var did=getQueryVariable(qs,'ds');
			var aid=getQueryVariable(qs,'an');
			var eq=getQueryVariable(qs,'q');	// query
			var page=getQueryVariable(qs,'p');

			if(did && !aid) {	// it's in the variable menu page
				clearNavigator();
				fetchContent('worker.php?w=getvariables&did='+did,document.getElementById('mainholder'),function() {hasLoaded=true;toggleOrnaments(false);afterAjax(state,pushstate);});
				return;
			}
			if(did && aid && eq===null) {		// initialize a new navigator
				afterAjax(state,pushstate,setoptions);
				return;
			}

			if(did && aid && eq!==null) {		// add new taxon to graph or to bioclimatic explorer
				if(!page || page=='nav' || page=='') {
					afterAjax(state,pushstate,setoptions);
					return;
				}
				if(page=='bio') {
					updateBioclimatic(state,pushstate);
					return;
				}
			}
		}
	}
	hideAjaxLoader();
}

function updateGraph(state,mode,callback) {
	var qs=state.qs;
	var qt=getQueryVariable(qs,'t');
	var eq=getQueryVariable(qs,'q');
	var nt=getQueryVariable(qs,'v');	// navigator type
//	if(qt=='i') eq=eq.split(',');
	var opts={
		nlevels: getQueryVariable(qs,'nlev')===null ? getNLevels() : parseInt(getQueryVariable(qs,'nlev'))
		,nneighbors: getQueryVariable(qs,'nn')===null ? getNNeighbors() : parseInt(getQueryVariable(qs,'nn'))
		,navtype: !nt ? (qt=='i' ? 'navigator' : 'patfinder') : (nt=='p' ? 'patfinder' : 'navigator')	// default is navigator
		,seclinks: getQueryVariable(qs,'sec')===null ? getSeclinks() : parseInt(getQueryVariable(qs,'sec'))
		,mode: mode
		,aid: getQueryVariable(qs,'an')
		,did: getQueryVariable(qs,'ds')
		,qt:qt
		,callback:callback
	};
	loadNeighbors(eq,opts);
}

function inIframe() {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
}

// starts the navigator interface from scratch
function startNavigator(state,callback,type) {
	if(inIframe()) var ifr='&iframe=1'; else ifr='';
	removeWindows();
	var nt=getQueryVariable(state.qs,'v');
	var qt=getQueryVariable(state.qs,'t');
	if(!type) type=!nt ? (qt=='i' ? 'navigator' : 'patfinder') : (nt=='p' ? 'patfinder' : 'navigator');// (qt=='i' ? 'navigator' : 'patfinder');
	fetchContent('worker.php?w=navigator'+ifr+'&t='+type,document.getElementById('mainholder'),function() {
		if(getQueryVariable(state.qs,'clean')) document.getElementById('navigator-holder').classList.add('clean');
		hasLoaded=true;
		buildNavigator(type);
		if(callback) callback();
		//attachAutomaticFit();
	});
}

function attachAutomaticFit() {
//	if(noAutomaticThings) return;
	if(getNavigatorType()=='navigator') return;
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

function switchNavigatorTo(navtype) {
	var navhol=document.getElementById('navigator-holder');
	if(getNavigatorType()=='navigator' && navtype=='patfinder') hasZoomed=0;
	
	var types=['navigator','patfinder'];
	navhol.classList.remove(types[0]);
	navhol.classList.remove(types[1]);
	navhol.classList.add(navtype);
//	if(navtype=='navigator' && document.getElementById('but-seclinks').classList.contains('selected')) clickTopButton({target:document.getElementById('but-seclinks')});
	if(navtype=='navigator') {
		clickTopButton({target:document.getElementById('view-cozy')});
		if(document.getElementById('navigator').classList.contains('nolinks'))
			clickTopButton({target:document.getElementById('view-links')});
		if(document.getElementById('navigator').classList.contains('nolabels'))
			clickTopButton({target:document.getElementById('view-labels')});
	} else hideSidePane('taxonselector');
}

function updateBioclimatic(state,pushstate) {
	if($('svg.bioclimplot').length==0)
		startBioclimatic(state,pushstate);
	else {
		var ds=getQueryVariable(state.qs,'ds');
		var an=getQueryVariable(state.qs,'an');
		var tid=getQueryVariable(state.qs,'q').split(',');
		var sigma=getSigma();
		if(tid[0]=='') {
			bioclimLayers=[];
			updateBioclimaticData(bioclimLayers);
			afterAjax(state,pushstate);
			return;
		}
// map the taxon ids to the color indexes, to get indexes that are not used
		var usedcolors=[];
		var colormap=bioclimLayers.map(function(el,i) {return [el.idtax,el.colorindex]});
		for(var i=0;i<tid.length;i++) {
			var foi=false;
			for(var j=0;j<colormap.length;j++) {
				if(parseInt(tid[i])==colormap[j][0]) {
					usedcolors.push(colormap[j][1]);
					foi=true;
					break;
				}
			}
			if(!foi) usedcolors.push(-1);
		}
//alert('worker.php?w=getscatterlayer&ds='+ds+'&sig='+sigma+'&q='+tid+'&ind='+usedcolors.join(','));
//alert('worker.php?w=getscatterlayer&ds='+ds+'&sig='+sigma+'&q='+tid+'&t=i&ind='+usedcolors.join(','));
		loadXMLDoc('worker.php?w=getscatterlayer&ds='+ds+'&sig='+sigma+'&q='+tid+'&t=i&ind='+usedcolors.join(','),function(xmlo) {
			xmlo=xmlo.target;
			if(xmlo.readyState == 4 && xmlo.status == 200) {
				var data=xmlo.responseText;
				if(!data) return;
				bioclimLayers=JSON.parse(data);
				updateBioclimaticData(bioclimLayers);
				afterAjax(state,pushstate);
			}
		});
	}
}

function updateBioclimaticData(newdata) {
console.log(newdata);
	var upd=d3.select('#layers #layerlist').selectAll('li').data(newdata,keyFunction);
	upd.enter().append('li').text(function(d) {return(d.name);})
		.style('background',function(d) {return('linear-gradient(rgba('+d.color.r+','+d.color.g+','+d.color.b+',0.5),rgba('+d.color.r+','+d.color.g+','+d.color.b+',0.3))');})
		.on('click',function(d) {
			d3.select(this).on('mouseover',null).on('mouseout',null);
			document.querySelector('#layerlist').classList.add('removing');
			bioclimLayers.splice(bioclimLayers.indexOf(d),1);	// remove data entry
//			d3.select(this).remove();
//			bioclimLayers=d3.select('#layers #layerlist').selectAll('li').data();
			updateBioclimaticData(bioclimLayers);
			var tids=bioclimLayers.map(function(el,i) {return el.idtax});
			var did=getQueryVariable(window.location.search,'ds');
			var aid=getQueryVariable(window.location.search,'an');
			var newqs='?ds='+did+'&an='+aid+'&q=iid:'+tids.join(',iid:')+'&p=bio';
			afterAjax({qs:newqs},true);
		}).on('mouseover',function(d) {
			if(document.querySelector('#layerlist').classList.contains('removing')) return;
			var lay=d3.selectAll('svg.bioclimplot image').filter(function(dd,i) {return(d.idtax==dd.idtax); });
			var otherlay=d3.selectAll('svg.bioclimplot image').filter(function(dd,i) {return(d.idtax!=dd.idtax); });
			lay.each(function(d,i) {	// move layer to top
				var parent=this.parentNode;
				var removed=d3.select(this).remove();
				d3.select(parent).append(function() {return(removed.node());});
			});
			lay.transition().duration(400).style('opacity',1);
			otherlay.transition().duration(400).style('opacity',0.4);
		}).on('mouseout',function(d) {
			if(document.querySelector('#layerlist').classList.contains('removing')) return;
			var lay=d3.selectAll('svg.bioclimplot image');
			lay.transition().duration(400).style('opacity',layerOpacity);
		});

	upd.exit().style('opacity','0.5').transition().duration(200).style('opacity','0').remove();
	
	d3.selectAll('svg.bioclimplot').each(function(d,i) {	// update all plots
		var varx=this.querySelector('g.axis').getAttribute('eco:varx');
		var vary=this.querySelector('g.axis').getAttribute('eco:vary');
		var upd=d3.select(this).selectAll('image').data(newdata,keyFunction);
		upd.exit().transition().duration(500).style('opacity',0).remove().each('end',function() {
			var el=document.querySelector('#layerlist');
			if(!el) return;
			document.querySelector('#layerlist').classList.remove('removing');
			var lay=d3.selectAll('svg.bioclimplot image');
			lay.style('opacity',layerOpacity);
		});
		
		var ent=upd.enter().append('image').attr({
			'xlink:href':function(d) {
				var ncl=getNumberClasses();
				d.href=d.href.replace(/nc=[0-9.]*/i,'nc='+ncl);
				return(d.href+'&v='+varx+','+vary);
			}
			,'x':function(d) {return(d.x);}
			,'y':function(d) {return(d.y);}
			,'width':function(d) {return(d.width);}
			,'height':function(d) {return(d.height);}
			,'eco:eco:name':function(d) {return(d.name);}
			,'eco:eco:idtax':function(d) {return(d.idtax);}
		}).style('opacity',layerOpacity);
//		if(ent.size()>0) updateLayerNClasses();
		ent.style('opacity',0).transition().duration(500).style('opacity',layerOpacity);
	});
}

function keyFunction(d) {return d.idtax;}

function getNumberClasses() {
	var ncl=parseFloat(document.querySelector('#nclasses input[type=hidden]').value);
	layerOpacity=(ncl<3 ? 0.4 : 1);
	return ncl;
}

function updateLayerNClasses() {
	var ncl=getNumberClasses();
	var imgs=$('svg.bioclimplot image');
	for(var i=0;i<imgs.length;i++) {
		var nhr=imgs[i].getAttribute('href');
		nhr=nhr.replace(/nc=[0-9.]*/i,'nc='+ncl);
		imgs[i].setAttribute('href',nhr);
		imgs[i].style.opacity=layerOpacity;
	}
}

function startBioclimatic(state,pushstate) {
	removeWindows();
	clearNavigator();
	var did=getQueryVariable(state.qs,'ds');
	var aid=getQueryVariable(state.qs,'an');
	var tid=getQueryVariable(state.qs,'q');
//	fetchContent('worker.php?w=explorer&ds='+did+'&an='+aid+'&q='+tid,document.getElementById('mainholder'),function() {
	fetchContent('worker.php'+state.qs+'&w=explorer',document.getElementById('mainholder'),function() {
		hasLoaded=true;
		updateBioclimatic(state,pushstate);
	});
}

function clickAxis(ev) {
	var ax=getParentbyClass(ev.target,'axistitle');
	var plot=getParentbyClass(ev.target,'bioclimplot');
	var variable=ax.getAttribute('eco:var');
	var varwnd=document.getElementById('variable-list');
	d3.select(varwnd).datum({'plot':plot,'axis':ax.getAttribute('eco:axis')});
	varwnd.style.display='block';
	varwnd.style.opacity=0;
	var dummy=varwnd.offsetHeight;		// force redraw
	varwnd.style.opacity=1;
}

function selectVarAxis(ev) {
	var variable=ev.target.getAttribute('data-file');
	if(!variable) return;
	var did=getQueryVariable(window.location.search,'ds');
	var aid=getQueryVariable(window.location.search,'an');
	var sigma=getSigma();
	var plot=d3.select('#variable-list').datum().plot;
	var axis=d3.select('#variable-list').datum().axis;
	var varx=(axis=='x' ? variable : plot.querySelector('g.axis').getAttribute('eco:varx'));
	var vary=(axis=='y' ? variable : plot.querySelector('g.axis').getAttribute('eco:vary'));
	hideSelectVarAxis();
	fetchContent('worker.php?w=getonescatter&sig='+sigma+'&ds='+did+'&v='+varx+','+vary+'&an='+aid,plot.parentNode,function() {
		hasLoaded=true;
		updateBioclimatic({qs:window.location.search},false);
	});
}

function hideSelectVarAxis() {
//	document.getElementById('variable-list').style.display='none';
	fadeToEnd('#variable-list',false);
}

function clearNavigator() {
	if(force) {
		force.stop();
		gdata={nodes:[],links:[]};
		force=null;
		removeWindows(true);
	}
/*	var par=document.getElementById('mainholder');
	var el1=document.getElementById('navigator-holder');*/
	fadeToEnd('navigator-holder',true);
//	if(el1) par.removeChild(el1);
}

function requestAnalysis(ds,vars,minfreq,sigma,downweight) {
	loadXMLDoc('worker.php?w=getanalysisid&id='+ds+'&v='+encodeURIComponent(vars)+'&mf='+minfreq+'&sig='+sigma+'&dw='+(downweight ? 1 : 0),function(xmlo) {
		xmlo=xmlo.target;
		if(xmlo.readyState == 4 && xmlo.status == 200) {
			var data=xmlo.responseText;
			data=JSON.parse(data);
			if(data.success)
				updatePage({qs:'?ds='+ds+'&an='+data.id},true);
			else {
				alert(data.msg);
			}
/*			var el=$('#mainholder')[0];
			el.innerHTML=data;*/
//			if(callback) callback();
		}
	});	
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

/**
 Requests an analysis and waits until ready. After ready, display the Taxon Selector.
*/
function getAnalysisState(dID,aID) {
	loadXMLDoc('worker.php?w=getanalysisstate&did='+dID+'&aid='+aID,function(xmlo) {
		xmlo=xmlo.target;
		if(xmlo.readyState == 4 && xmlo.status == 200) {
			var data=xmlo.responseText;
			if(!data || data.trim()=='') {
				timeoutHandle=setTimeout(function() {getAnalysisState(dID,aID);},2000);
				return;
			}
			data=JSON.parse(data);
			var el=$('#waitanalysis h2')[0];
			if(data.success) {
				data=data.msg;
				el.innerHTML=data.state;
				if(data.ready) {
					removeWindows();
					showTellMeWhat();
				} else
					timeoutHandle=setTimeout(function() {getAnalysisState(dID,aID);},1000);
				return;
			} else el.innerHTML=data.msg;
			timeoutHandle=0;
		}
	});
}

function showTellMeWhat() {
	hideAjaxLoader();
	showWindow('<div class="bigmenuitem" data-name="patfinder"><img src="images/patfinder.png"/><h1 class="big">I have a species list or assemblage I want to analyse</h1><h2>take me to the biogeographic pattern finder!</h2><p style="clear:both"/></div><hr/><div class="bigmenuitem holder"><div data-name="fullnetwork" style="float:left"><img src="images/fullnet.png"/><h2>take me to the FULL network</h2></div><div data-name="navigator" style="float:right"><img src="images/clicknxpand.png"/><h2>let me just explore the species pool</h2></div><h1 class="big">I have nothing<br/><br/>&lt; &nbsp;&nbsp;choose&nbsp;&nbsp; &gt;</h1><p style="clear:both"/></div>',{id:'tellmewhat',classes:'medium'});
	addEvent('click',document.getElementById('tellmewhat'),function(ev) {
		if(ev.target.hasAttribute('data-name'))
			var el=ev.target;
		else {
			if(ev.target.parentNode.hasAttribute('data-name'))
				var el=ev.target.parentNode;
			else
				var el=getParentbyClass(ev.target,'bigmenuitem');
		}
		if(el) {
			var nt=el.getAttribute('data-name');
			if(!nt) return;
			if(nt=='fullnetwork') {
				if(!confirm('Warning! Displaying the full network may cause your browser to run very slowly. Using Chrome is highly recommended. Proceed?')) return;
//				alert(buildQueryString({eq:'all'},false));
				showAjaxLoader();
				startNavigator({qs:window.location.search},function() {
					afterAjax({qs:buildQueryString({eq:'all'},false)},true,true);
				},nt);
				fadeToEnd('#tellmewhat',true);
				return;
			}

			fadeToEnd('#tellmewhat',true);
			showAjaxLoader();
			startNavigator({qs:window.location.search},function() {
// this is what happens upon first entrance in navigator
				entranceExpand=true;
				switch(nt) {
				case 'patfinder':
					hideAjaxLoader();
					showSpeciesListUploader(false);
					break;
				case 'navigator':
					showTaxonSelector(true);
					break;
				}
				setForceOptions();
			},nt);
		}
	});
}

function fetchContent(url,el,callback) {
	loadXMLDoc(url,function(xmlo) {
		xmlo=xmlo.target;
		if(xmlo.readyState == 4 && xmlo.status == 200) {
			var data=xmlo.responseText;
			//removeWindows();
			el.innerHTML=data;
//			if(reattach) hasLoaded=true;
			if(callback) callback();
		}
	});
}

function removeWindows(all) {
	if(all)
		var wnds=$('.window');
	else
		var wnds=$('.window:not(.fixed)');
	var parent;
	for(var i=0;i<wnds.length;i++) {
		parent=wnds[i].parentNode;
		parent.removeChild(wnds[i]);
	}
}

function showWindow(html,props) {
	if(props.closeable && !props.id) return;
	if(props.id) {
		if(document.getElementById(props.id)) {fadeToEnd('#'+props.id,true);return;}
	}
	var frag=createHTML('<div class="window'+(props.classes ? ' '+props.classes : '')+'"'+(props.id ? ' id="'+props.id+'"' : '')+'>'+(props.closeable ? '<div class="closebutton"></div>' : '')+'<div class="content">'+html+'</div></div>');
	document.body.appendChild(frag);
	addEvent('click',document.querySelector('#'+props.id+' .closebutton'),function(ev) {fadeToEnd('#'+props.id,true);});
}

function handleResize() {
	winwid=window.innerWidth;
	winhei=window.innerHeight;
/*	var stb=getComputedStyle($('#topbar')[0]);
	var width=winwid;
	var height=winhei-parseInt(stb.height);*/
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

function getDatasetStates() {
	loadXMLDoc('worker.php?w=getdatasetstates',function(xmlo) {
		xmlo=xmlo.target;
		if(xmlo.readyState == 4 && xmlo.status == 200) {
			var data=xmlo.responseText;
			data=JSON.parse(data);
			data=data.datasets;
			var els=$('#mainmenu .bigmenuitem');
			var dids=[];
			for(var i=0;i<els.length;i++) dids.push(els[i].getAttribute('data-did'));
			var anynotready=false;
			for(var i=0;i<data.length;i++) {
				var ind=dids.indexOf(data[i].id);
				if(data[i].ready) {
					if(ind>-1) {
						var el=els[ind].querySelector('p.notready');
						if(parseInt(data[i].ntaxa)==0) {
							anynotready=true;
							el.innerHTML='computing variables...';
						} else {
							if(el) el.parentNode.removeChild(el);
							el=els[ind].querySelector('h2');
							if(el) el.innerHTML=data[i].ntaxa+' taxa | '+data[i].numrec+' records';
						}
					}
				} else {
					anynotready=true;
					if(ind>-1) {
						els[ind].querySelector('h2').innerHTML='';
						console.log(data[i]);
						els[ind].querySelector('p.notready').innerHTML=data[i].state+'...';
					}
				}
			}

			if(anynotready)
				timeoutHandle=setTimeout(getDatasetStates,2000);
			else
				timeoutHandle=0;
		}
	});
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
		var page=opts.page;
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
		var page=(opts.page || opts.page===null) ? opts.page : getQueryVariable(qs,'p');
		var what=(opts.what || opts.what===null) ? opts.what : getQueryVariable(qs,'w');
		var secl=(opts.seclinks!==undefined) ? opts.seclinks : getQueryVariable(qs,'sec');
	}

	if(eq && eq.toLowerCase=='all') qt='i';
	var q=[];
	if(did) q.push('ds='+did);
	if(aid) q.push('an='+aid);
	if(qt && page!='bio') q.push('t='+qt);
	if(nt) q.push('v='+(nt=='patfinder' ? 'p' : 'n'));
	if(eq) q.push('q='+eq);
	if(sl && page!='bio') q.push('sl='+sl);
	if(nnei!==null && nnei!==undefined && page!='bio') q.push('nn='+nnei);
	if(nlev!==null && nlev!==undefined && page!='bio') q.push('nlev='+nlev);
	if(page) q.push('p='+page);
	if(what) q.push('w='+what);
	if(secl!==null && secl!==undefined && page!='bio') q.push('sec='+secl);
	return '?'+q.join('&');
}

/**
	setoptions: pass true to set option buttons according to querystring
*/
function afterAjax(state,pushstate,setoptions) {
// this is called after the page has been changed, used to attach specific event handlers
	var qs=state.qs;
	var did=getQueryVariable(qs,'ds'),i;
	var aid=getQueryVariable(qs,'an');
	var qt=getQueryVariable(qs,'t');
	var eq=getQueryVariable(qs,'q');
	var page=getQueryVariable(qs,'p');
	var what=getQueryVariable(qs,'w');

	document.body.scrollTop=0;
	document.documentElement.scrollTop=0;

	if(what) {
		var left=what.split('#');
		if(left[0]!='info' && left[0]!='api') toggleOrnaments(false);
		removeWindows();
		hideAjaxLoader();
		switch(what) {
		case 'new':
			var dss=$('.biglist li');
			for(var i=0;i<dss.length;i++) {
//				removeEvent('click',dss[i],clickDatasetSource);
				addEvent('click',dss[i],clickDatasetSource);
			}
			break;
		case 'auth':
			addEvent('click',document.querySelector('#request'),requestAuthkey);
			break
		case 'src':
				var src=getQueryVariable(qs,'s');
				switch(src) {
				case 'gbif':
					var pol=getQueryVariable(qs,'p');
					if(!pol) {		// no polygon query yet
//						seps[2].style.display='block';
						if(!map || !document.getElementById('map').firstChild) {		// there is no map yet
							map = L.map('map').setView([20, 0], 1);
							L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}', {
								attribution: 'Tiles &copy; Esri',
								maxZoom: 13
							}).addTo(map);

							L.drawLocal.draw.handlers.polygon.tooltip.start='Click to start drawing polygon';
							L.drawLocal.draw.handlers.polygon.tooltip.cont='Click to continue';
							L.drawLocal.draw.handlers.polygon.tooltip.end='Click on the 1st point to close polygon';
							L.drawLocal.draw.handlers.polyline.error='Edges cannot intersect!';

							map.on('draw:created', function (e) {
								var area=(LGeo.area(e.layer) / 1000000);
								if(area>1500000) {
									alert('Due to limited server capacity, the spatial query is currently limited to 1.5 million square kilometers. Your polygon has '+(area/1000000).toFixed(2)+' Mkm2');
									enableDraw();
									return;
								}
								var type = e.layerType,layer = e.layer;
								var wkt='POLYGON((';
								for(var i=0;i<layer._latlngs.length;i++) {
									wkt+=(Math.round(layer._latlngs[i].lng*1000)/1000)+' '+(Math.round(layer._latlngs[i].lat*1000)/1000)+',';
								}
								wkt+=(Math.round(layer._latlngs[0].lng*1000)/1000)+' '+(Math.round(layer._latlngs[0].lat*1000)/1000);
								wkt+='))';
								document.getElementById('map').setAttribute('data-wkt',wkt);
								updatePage({qs:'?w=src&s=gbif&p='+encodeURIComponent(wkt)},true);
							});
						}
						enableDraw();
					} else {	// polygon query done
						var king=getQueryVariable(qs,'tkey');
						if(king===null) {
							var king=document.querySelectorAll('#kingdomlist li');
							for(var i=0;i<king.length;i++) {
//								removeEvent('click',king[i],clickKingdom);
								addEvent('click',king[i],clickKingdom);
							}
						} else {
//							removeEvent('click',seps[4].querySelector('.button'),requestGBIF);
							addEvent('click',document.querySelector('#request'),requestGBIF);
						}
					}
					break;
		
				case 'dwc':
					//removeEvent('click',seps[5].querySelector('.button'),requestDWCUrl);
					addEvent('click',document.querySelector('#request'),requestDWCUrl);
					break;
				case 'fkey':
					//removeEvent('click',seps[6].querySelector('.button'),requestFileKey);
					addEvent('click',document.querySelector('#request'),requestFileKey);
					break;
				}
			break;
		}
	}
	if(!did && !what) {	// it's in the home page
		hideAjaxLoader();
		removeWindows();
		var logo=document.getElementById('logo');
		if(logo) logo.classList.remove('small');
		toggleOrnaments(true);
		var dsel=$('#mainmenu .bigmenuitem');	
		for(var i=0;i<dsel.length;i++) {
			addEvent('click',dsel[i],function(ev) {
				if(ev.target.tagName.toLowerCase()=='a') return;
				var par=getParentbyClass(ev.target,'bigmenuitem');
				var anch=par.querySelector('a');
				if(par.querySelector('p.notready')) {
					par.querySelector('p.notready').innerHTML='<span style="color:red">Dataset not ready!</span> Feel free to close and come back later.';
					clearTimeout(timeoutHandle);
					timeoutHandle=setTimeout(getDatasetStates,2000);
					return;
				}
				if(anch && anch.href.split('?')[1]!='w=new')
					updatePage({qs:'?ds='+getQueryVariable('?'+anch.href.split('?')[1],'ds')},true);
				else {	// new dataset
					updatePage({qs:'?w=new'},true);
				}
			});
			addEvent('click',dsel[i].querySelector('a'),function(ev) {ev.stopPropagation();});
		}
		if($('#mainmenu p.notready').length>0)
			timeoutHandle=setTimeout(getDatasetStates,2000);
		
	}
	
	if(did && !aid) {	// it's in the variable menu page
		var vars=$('#variablemenu ul li');
		hideAjaxLoader();
		if(vars.length>0) {
			removeWindows();
			toggleOrnaments(false);
			for(i=0;i<vars.length;i++) {
				addEvent('click',vars[i],function(ev) {
					var sel=$('#variablemenu ul.biglist li.selected');
					if(!ev.target.classList.contains('selected') && sel.length>2) sel[0].classList.remove('selected');
					ev.target.classList.toggle('selected');
				});
			}
			var vars=$('#analysismenu tr.analysis');
			for(i=0;i<vars.length;i++) {
				addEvent('click',vars[i],function(ev) {
					var row=getParentbyTag(ev.target,'tr');
					updatePage({qs:buildQueryString({did:did,aid:row.querySelector('input[name=analysisid]').value},true)},true);
	//				updatePage({qs:'?ds='+did+'&an='+row.querySelector('input[name=analysisid]').value},true);	
				});
			}
			addEvent('click',document.querySelector('#variablemenu .button'),function(ev) {
	/*			alert('Due to limited server capacity, requesting new analyses is temporarily disabled. Please select one of the existing analysis on the right panel. Sorry for the inconvenience.');
				return;*/
				ev.preventDefault();
	// conduct analysis
				var downweight=document.querySelector('#variablemenu input[name=downweight]').checked;
				var selvar=$('#variablemenu ul li.selected');
				if(selvar.length<1 || selvar.length>3) return;
				var sigma=parseFloat(document.querySelector('input[name=sigma]').value);
				if(sigma<0.005 || sigma>0.4) {alert("Please enter a smoothing factor between 0.005 and 0.4");return;}
				var minfreq=parseInt(document.querySelector('#variablemenu input[name=minfreq]').value);
				if(minfreq<0) {alert("Please enter a positive minimum number of occurrences.");return;}
	//			document.querySelector('#variablemenu').style.opacity=0;
				var values=[].map.call(selvar, function(obj) {
	  				return obj.querySelector('input[name=file]').value;
				});
				requestAnalysis(did,values.join(','),minfreq,sigma,downweight);
			});
		}
	}

	if(did && aid) {	// it's either in navigator or bioclimatic
		toggleOrnaments(false);
		if(eq!==null) {
			if(page=='bio') {	// it's in bioclimatic
				if(hasLoaded) {
					var sliders=$('#topbar .slider');
					for(i=0;i<sliders.length;i++) makeSlider(sliders[i]);
				}
				hideAjaxLoader();
				if($('#taxonselector ul.taxonlist li').length==0) populateTaxaList('taxonselector');
				var tit=$('svg.bioclimplot text.axistitle');
				for(var i=0;i<tit.length;i++) {		// attach click to axes
					removeEvent('click',tit[i],clickAxis);
					addEvent('click',tit[i],clickAxis);
				}
				var varli=document.querySelector('#variable-list .taxonlist');
				removeEvent('click',varli,selectVarAxis);
				addEvent('click',varli,selectVarAxis);
				removeEvent('click',document.querySelector('#variable-list .closebutton'),hideSelectVarAxis);
				addEvent('click',document.querySelector('#variable-list .closebutton'),hideSelectVarAxis);
				var buts=$('#layers .button');
				for(var i=0;i<buts.length;i++) {
					removeEvent('click',buts[i],removeAllLayers);
					addEvent('click',buts[i],removeAllLayers);
				}
				handleResize();
			} else {	// it's in navigator
				var nt=getQueryVariable(qs,'v');
				if(force) {
					gdata.nodes.forEach(function(o, i) {o.c=0;});
					switchNavigatorTo(!nt ? (qt=='i' ? 'navigator' : 'patfinder') : (nt=='p' ? 'patfinder' : 'navigator'));
					setForceOptions();
					var bd=document.querySelectorAll('#but-distdownload a');
					for(var i=0;i<bd.length;i++)	// update download links
						bd[i].setAttribute('href','worker.php?w=distdownload&did='+did+'&aid='+aid);
//					updateGraph(state,state.mode ? state.mode : ((!qt || qt=='i') ? 'add' : 'replace'),function() {
					updateGraph(state,state.mode ? state.mode : (!nt ? (qt=='i' ? 'add' : 'replace') : (nt=='p' ? 'replace' : 'add')),function() {
						if(getNavigatorType()=='navigator') {
							var seln=forceNodes.filter(function(d,i) {return(d.c==1);});
							if(seln.size()==1) loadMap(seln.datum());
						}
						attachAutomaticFit();
					});
				
				} else {
					showAjaxLoader();
					startNavigator(state,function() {
						showAjaxLoader();
						switchNavigatorTo(!nt ? (qt=='i' ? 'navigator' : 'patfinder') : (nt=='p' ? 'patfinder' : 'navigator'));
						setForceOptions();
						afterAjax(state,pushstate,setoptions);
					});
					return;
				}
			
				var el=document.querySelector('#densitymap-holder .button');
				removeEvent('click',el,toggleMapSize);
				addEvent('click',el,toggleMapSize);
				if(setoptions) {	// this sets the toolbar buttons according to the querystring
					setNNeighbors(parseInt(getQueryVariable(qs,'nn') ? getQueryVariable(qs,'nn') : getNNeighbors()));
					setSeclinks(parseInt(getQueryVariable(qs,'sec') ? getQueryVariable(qs,'sec') : getSeclinks()));
					setNLevels(parseInt(getQueryVariable(qs,'nlev') ? getQueryVariable(qs,'nlev') : getNLevels()));
				}
			}
		} else {
//			removeWindows();
			hideAjaxLoader();
			if(!document.getElementById('tellmewhat')) {
				var el=document.getElementById('menuholder');
				if(el) $('#mainholder')[0].removeChild(el);
				clearNavigator();
				showWindow('<h1>Requesting analysis...</h1><h2></h2><p class="info">this may take some time...<br/>feel free to close and come back later<br/>or try an <a href="?ds='+did+'">existing analysis</a></p>',{id:'waitanalysis'});
				timeoutHandle=setTimeout(function() {getAnalysisState(did,aid);},1000);
			}
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

function toggleOrnaments(vis) {
	var el=document.getElementById('footer');
	if(!el) return;
	el.style.display=vis ? 'block' : 'none';

	var el=document.getElementById('whatsnew');
	if(!el) return;
	el.style.display=vis ? 'block' : 'none';
}

function toggleMapSize(ev) {
	var but=document.querySelector('#densitymap-holder .button');
	but.classList.toggle('selected');
	if(but.classList.contains('selected')) {
		but.querySelector('img').src='images/minimize.png';
		but.querySelector('.legend').innerHTML='minimize';
	} else {
		but.querySelector('img').src='images/full_screen.png';
		but.querySelector('.legend').innerHTML='fullscreen';
	}
		
	var tid=getQueryVariable(window.location.search,'q');
	var el=document.getElementById('densitymap-holder');
	el.classList.toggle('big');
	if(el.classList.contains('big')) {
		showTaxonSelector(false);
		document.querySelector('#topbar #but-addtax').classList.add('selected');
		handleResize();
		var mapel=document.getElementById('densitymap');
		var tb=mapel.getBoundingClientRect();
		force.stop();
		
		var seln=forceNodes.filter(function(d,i) {return(d.c==1);});
		if(seln.size()==1) loadMap(seln.datum(),tb.width);

//		loadMap(forceNodes.filter(function(d,i) {return(d.id==parseInt(tid));}).datum(),tb.width);
	} else {
		hideSidePane('taxonselector');
		document.querySelector('#topbar #but-addtax').classList.remove('selected');
		var mapel=document.getElementById('densitymap');
		mapel.innerHTML='';

		var seln=forceNodes.filter(function(d,i) {return(d.c==1);});
		if(seln.size()==1) loadMap(seln.datum(),300);

//		loadMap(forceNodes.filter(function(d,i) {return(d.id==parseInt(tid));}).datum(),300);
		force.start();
	}
}

function removeAllLayers(ev) {
	var el=getParentbyClass(ev.target,'button');
	switch(el.id) {
	case 'removeall':
		updateBioclimaticData([]);
		var did=getQueryVariable(window.location.search,'ds');
		var aid=getQueryVariable(window.location.search,'an');
		afterAjax({qs:'?ds='+did+'&an='+aid+'&q=&p=bio'},true);
		break;
	case 'openecospace':
		var tid=getQueryVariable(window.location.search,'q');
		if(tid.trim()!='') updatePage({qs: buildQueryString({page:null,qt:'i'},false)}, true);
//		updatePage({qs:window.location.search.replace(/&?p=bio/i,'')},true);
		break;
	}
}

//
// Regular Expression for URL validation
//
// Author: Diego Perini
// Updated: 2010/12/05
// License: MIT
//
// Copyright (c) 2010-2013 Diego Perini (http://www.iport.it)
//
// Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation
// files (the "Software"), to deal in the Software without
// restriction, including without limitation the rights to use,
// copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the
// Software is furnished to do so, subject to the following
// conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
// /^(?:(?:https?|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:\/\S*)?$/i

function makeSlider(el) {
	var dr=d3.behavior.drag();
	var drag = d3.behavior.drag()
		.origin(function() {return({x:this.offsetLeft+10,y:this.offsetTop});})
		.on('drag', dragmove)
		.on('dragend',dragend);
	d3.select(el).select('.cursor').call(drag);
	addEvent('click',el,sliderJump);
	var val=parseFloat(el.querySelector('input[type=hidden]').value);
	matchSliderToValue(el,val);
}

function matchSliderToValue(el,val) {
	var wid=el.clientWidth;
	var mini=parseFloat(el.getAttribute('data-min'));
	var maxi=parseFloat(el.getAttribute('data-max'));
	var newleft=((val-mini)/maxi)*wid-10;
	if(newleft<-10) newleft=-10;
	if(newleft>wid-10) newleft=wid-10;
	var cur=el.querySelector('.cursor');
	cur.style.left=newleft+'px';
	el.querySelector('input[type=hidden]').value=val;
}

function sliderJump(ev) {
	if(ev.target!==this) return;
	var cur=ev.target.querySelector('.cursor');
	var wid=this.clientWidth;
//	console.log(ev.pageX-ev.target.offsetLeft);
	if(cur.offsetLeft>ev.pageX-ev.target.offsetLeft)
		var newleft=(cur.offsetLeft)-3-wid*0.10;
	else
		var newleft=(cur.offsetLeft)-3+wid*0.10;
	if(newleft<-10) newleft=-10;
	if(newleft>wid-10) newleft=wid-10;
	cur.style.left=newleft+'px';
	dragend.call(cur);
}

function dragmove(d) {
	var el=this;
	var par=el.parentNode.clientWidth;
	if(d3.event.x>=0 && d3.event.x<=par) d3.select(el).style('left',(d3.event.x-10)+'px');
	
	var perc=(el.offsetLeft+10)/el.parentNode.clientWidth;
	var mini=parseFloat(el.parentNode.getAttribute('data-min'));
	var maxi=parseFloat(el.parentNode.getAttribute('data-max'));
	el.parentNode.querySelector('input[type=hidden]').value=(maxi-mini)*perc+mini;
//	el.parentNode.querySelector('.cursor .label').innerHTML=parseInt((maxi-mini)*perc+mini);
	if(!el.parentNode.classList.contains('notimmediate')) {
		dragTimeoutHandle=setTimeout(function() {dragend.call(el);},parseInt(el.parentNode.getAttribute('data-dormancy')) || 100);
	}
}	

function dragend(d) {
	if(dragTimeoutHandle) {
		clearTimeout(dragTimeoutHandle);
		dragTimeoutHandle=0;
	}
	switch(this.parentNode.id) {
/*	case 'nneighbors':
		highlightCluster=[];
		smoothGraphChange();
		updatePage({qs:buildQueryString({
			nnei: parseInt(this.parentNode.querySelector('input[type=hidden]').value)
		},false)},true);
		
		break;
*/	
	case 'nclasses':
		updateLayerNClasses();
		break;
		
	case 'sigma':
		var sigma=getSigma();
		var imgs=$('svg.bioclimplot image');
		for(var i=0;i<imgs.length;i++) {
			var nhr=imgs[i].getAttribute('href');
			nhr=nhr.replace(/sig=[0-9.]*/i,'sig='+sigma);
			imgs[i].setAttribute('href',nhr);
		}
		break;
	}
}

function getSigma() {
	return parseFloat(document.querySelector('#sigma input[type=hidden]').value);
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

function showMessage(txt,opts) {
	if(noAutomaticThings) return;
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

function hideMessage() {
	fadeToEnd('#message',true,handleResize);
}

var re_weburl = new RegExp(
  "^" +
    "(?:(?:https?|ftp)://)" +
    "(?:\\S+(?::\\S*)?@)?" +
    "(?:" +
      "(?!(?:10|127)(?:\\.\\d{1,3}){3})" +
      "(?!(?:169\\.254|192\\.168)(?:\\.\\d{1,3}){2})" +
      "(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})" +
      "(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])" +
      "(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}" +
      "(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))" +
    "|" +
      "(?:(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)" +
      "(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*" +
      "(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))" +
    ")" +
    "(?::\\d{2,5})?" +
    "(?:/\\S*)?" +
  "$", "i"
);

