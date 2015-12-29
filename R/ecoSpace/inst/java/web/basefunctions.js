var $=function(elem) {
  return document.querySelectorAll(elem);
}

function addEvent(evnt, elem, func) {
	if(!elem) return;
   if (elem.addEventListener)  // W3C DOM
      elem.addEventListener(evnt,func,false);
   else if (elem.attachEvent) { // IE DOM
      elem.attachEvent('on'+evnt, func);
   } else { // No much to do
      elem['on'+evnt] = func;
   }
}

function removeEvent(evnt,elem,func) {
   if (elem.removeEventListener)  // W3C DOM
      elem.removeEventListener(evnt,func,false);
   else if (elem.detachEvent) { // IE DOM
      elem.detachEvent('on'+evnt, func);
   } else { // No much to do
      elem['on'+evnt] = null;
   }
}

function loadXMLDoc(doc,onopen) {
    var xmlhttp;

    if (window.XMLHttpRequest) {	// code for IE7+, Firefox, Chrome, Opera, Safari
        xmlhttp = new XMLHttpRequest();
    } else {	// code for IE6, IE5
        xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
    }
    xmlhttp.onreadystatechange = onopen;
    xmlhttp.open("GET", doc, true);
    xmlhttp.send();
}

function getQueryVariable(query,variable) {
	if(!query) return null;
    var query = query.substring(1);
    var vars = query.split('&');

    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split('=');
        if (decodeURIComponent(pair[0]) == variable) {
            return decodeURIComponent(pair[1]);
        }
    }
    return null;
}

/*function updateSVG(el,dots) {
	var keys,k;
	for(var i=0;i<dots.length;i++) {
		var newElement = document.createElementNS("http://www.w3.org/2000/svg", dots[i].type);
		for(var k in dots[i]) {
			if(k!='type' && k!='elements' && k!='text') {
				if(k.indexOf(':')>-1)
					newElement.setAttributeNS('http://www.flora-on.pt',k.split(':')[1],dots[i][k]);
				else
					newElement.setAttributeNS(null,k,dots[i][k]);
			}
		}
		if(dots[i].type=='text') newElement.innerHTML=dots[i].text;
		el.appendChild(newElement);
		if(dots[i].type=='g') updateSVG(newElement,dots[i].elements);
		
//		if(newElement.classList.contains('contour')) attachOverPoly([newElement]);
	}
}*/

function getParentbyTag(el,tagname) {
	while(el.tagName.toLowerCase()!=tagname) {
		el=el.parentNode;
	};
	return(el);
}

function getParentbyClass(el,classname) {
	if(!el) return(null);
	while(!el.classList.contains(classname)) {
		el=el.parentNode;
		if(!el.classList) return null;
	};
	return(el);
}

SVGElement.prototype.addClass = function (className) {
  if (!this.hasClass(className)) {
    this.setAttribute('class', this.getAttribute('class') + ' ' + className);
  }
};

SVGElement.prototype.hasClass = function (className) {
  return new RegExp('(\\s|^)' + className + '(\\s|$)').test(this.getAttribute('class'));
};

