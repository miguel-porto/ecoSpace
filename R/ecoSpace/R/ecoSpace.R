# mvn clean package
setClass("eSnetwork",slots=c("dataset"="character","network"="character","query"="ANY","nneighbors"="numeric","nlevels"="numeric","querytype"="character"))

.onLoad<-function(libname,pkgname) {
	assign(".Last",function() {
		if(testServer(FALSE)) {
			cat("Stopping ecoSpace server...\n")
			stop.server()
		}
	}, envir = .GlobalEnv)
}

.onAttach<-function(libname,pkgname) {
	packageStartupMessage("This is ecoSpace.\nYou must start by typing start.server() to use this package.")
}

testServer<-function(fail=FALSE) {
	test=try(getURL("localhost:7520"),silent=TRUE)
	if(inherits(test,"try-error")) {
		if(fail) stop("ecoSpace server not running! Type start.server()")
		return(FALSE)
	} else return(TRUE)
}

start.server<-function() {
	if(testServer()) {
		cat("Server already running.\n")
		return(NULL)
	}
	path=system.file("java",package="ecoSpace")
	PATH_TO_JAR=paste("java -Djava.library.path=",path," -jar ",path,"/ecoSpace-server-java-1.0-SNAPSHOT-jar-with-dependencies.jar",sep="")
	prevwd=getwd()
	setwd(path)
	assign("serverProcess", pipe(PATH_TO_JAR), envir = .GlobalEnv)
	open(serverProcess,blocking=FALSE)
	setwd(prevwd)
	
	cat("Waiting for server to be ready")
	while(!testServer(FALSE)) {
		cat(".")
		flush.console()
		Sys.sleep(0.5)
	}
	cat(" server ready!\nExisting networks:\n\n")
	print(get.datasets())
}

stop.server<-function() {
	getURL("localhost:7520/stop")
	if(exists("serverProcess")) close(serverProcess)
}

get.variables<-function() {
	v=fromJSON(getURL("localhost:7520/getvariables"))
	rownames(v)=v[,1]
	v=v[,-1]
	return(v)
}

get.datasets<-function() {
	testServer(TRUE)

	res=fromJSON(getURL("localhost:7520/getdatasets"))
	if(!res$success) {
		stop(res$msg)
	} else {
		v=res$datasets
		if(length(v)==0) return(v)
		rownames(v)=v[,"id"]
		v=v[,!(colnames(v)=="id")]
		return(v)
	}
}

delete.all.datasets <- function(sure = FALSE) {
	if(!sure) {
		resp = readline("Are you sure you want to delete all datasets and networks (y/n)? ")
		if(resp == "y" || resp == "Y") sure = TRUE
	}
	
	if(sure) {
		fromJSON(getURL("localhost:7520/empty"))
	}
}

get.dataset.variables <- function(dataset) {
	to = options("timeout")
	
	options(timeout=600)
	a = read.table(paste("http://localhost:7520/exportvariables?did=", dataset, sep=""), row.names=NULL, header=TRUE, sep="\t", stringsAsFactors=FALSE)
	options(timeout=to)
	
	b = a[,5:dim(a)[2]]
	b[b == -1] = NA
	a[, 5:dim(a)[2]] = b
	return(a)
}

get.dataset.details<-function(dataset) {
	testServer(TRUE)
	res=fromJSON(getURL(paste("localhost:7520/getdatasetdetails?did=",dataset,sep="")))
	if(!res$success) {
		stop(res$msg)
	} else {
		return(res)
	}
}

get.networks<-function(dataset) {
	testServer(TRUE)
	res=fromJSON(getURL(paste("localhost:7520/getanalyses?did=",dataset,sep="")))
	if(!res$success) {
		stop(res$msg)
	} else {
		v=res$analyses
		if(length(v)==0) return(v)
		rownames(v)=v[,"id"]
		v=v[,!(colnames(v)=="id")]
		return(v)
	}
}

# creates a new dataset from an R data frame with the columns: latitude longitude taxon
# OR from a DWC file
new.dataset<-function(data,description=NULL) {
	testServer(TRUE)
	colsSimp=c("latitude","longitude","taxon")		# simplified dataset
	colsDWC=c("genus","taxonRank","specificEpithet","decimalLatitude","decimalLongitude") 	# DarwinCore file
	if(inherits(data,"character")) {	# data is a filename, assume it is a DWC occurrence text file
		filename=data
#		ori.dwc=read.csv(data,sep="\t",header=T,strings=F)
#		dwc=ori.dwc[,colsDWC]
	} else if(inherits(data,"data.frame")) {
		fmt=ifelse( all(colsSimp %in% colnames(data)), "simple", ifelse(all(colsDWC %in% colnames(data)), "dwc", "error"))
		switch(fmt
		,"simple"={
			spp=strsplit(as.character(data[,"taxon"])," ")
			len=sapply(spp,length)
			if(any(len<2)) stop("Records must have valid taxon names and be at least to species level.")
	
			dwc=data.frame(
				genus=sapply(spp,"[",1)
				,taxonRank=ifelse(len==2,"SPECIES","SUBSPECIES")
				,specificEpithet=sapply(spp,"[",2)
				,decimalLatitude=data[,"latitude"]
				,decimalLongitude=data[,"longitude"]
			)
		},"dwc"={
			dwc=data[,colsDWC]
		},"error"={
			stop( paste("Data frame must either have the columns ",paste(colsSimp,collapse=", ")," OR ",paste(colsDWC,collapse=", "),sep="") )
		}
		)
		
		filename=tempfile()
		write.table(dwc,file=filename,sep="\t",quote=FALSE,row.names=FALSE)
		if(is.null(description)) description="Local file"
		#print(paste("localhost:7520/adddataset/local?file=",curlEscape(filename),"&desc=",curlEscape(description),sep=""))
	} else stop("'data' must be either a data frame of taxon coordinates, or a path to a DarwinCore text file.")
	
	ds=fromJSON(getURL( paste("localhost:7520/adddataset/local?file=",curlEscape(filename),"&desc=",curlEscape(description),sep="") ))

	wait.for.dataset(ds$did)
	
	return(ds$did)
}

new.network <- function(dataset, variables=c("latitude","longitude"), minFreq=5, sigmaPercent=0.01, downWeight=TRUE, async=FALSE) {
	if(!inherits(dataset,"character")) stop("from must be an object of class eSnetwork")
	testServer(TRUE)
	variables=paste(variables,collapse=",")
	res=fromJSON( getURL(paste("localhost:7520/open?did=",dataset,"&v=",curlEscape(variables),"&min=",minFreq,"&sig=",sigmaPercent,"&dw=",ifelse(downWeight,1,0),sep="")) )
	if(!res$success) {
		stop(res$msg)
	} else {
		nw=get.network(dataset=dataset, network=res$msg)
		if(!async)
			wait.for.network(nw)
		else
			message("NOTE: running in asynchronous mode. You have to check the state of the network computation using the returned object.")
		return(nw)
	}
}

get.network<-function(dataset, network, query=NULL, nneighbors=8, nlevels=1, queryType=c("i","json")[1]) {
	out=new("eSnetwork", dataset=dataset, network=network, query=query
		,nneighbors = nneighbors
		,nlevels = nlevels
		,querytype = queryType
		)
	return(out)
}

wait.for.dataset<-function(datasetID) {
	state=""
	while(!get.datasets()[datasetID,"ready"]) {
		newstate=get.datasets()[datasetID,"state"]
		if(newstate==state)
			cat(".")
		else {
			cat(paste("\n",newstate,sep=""))
			state=newstate
		}
		flush.console()
		Sys.sleep(0.5)
	}
	cat("\n")
	return(NULL)
}

wait.for.network<-function(network) {
	state=""
	while(TRUE) {
		res=.get.status(network)
		if(!res$success)
			stop(res$msg)
		else if(!res$msg$ready) {
			if(res$msg$state!=state)
				cat(paste(res$msg$state,"\n",sep=""))
			else
				cat(".")
			state=res$msg$state
		} else break
		
		flush.console()
		Sys.sleep(0.5)
	}
	return(NULL)
}

.printESnetwork <- function(object) {
	res=.get.status(object)
	if(!res$success) {
		stop(res$msg)
	} else {
		print(res$msg)
	}
}

setMethod("show", signature(object="eSnetwork"),.printESnetwork)
setMethod("print", signature(x="eSnetwork"),function(x) show(x))

.asIgraph<-function(from) {
	stopIfNotReady(from)
	if(is.null(from@query))
		query="all"
	else
		query=from@query
	url=paste("localhost:7520/get?q=", curlEscape(query), "&sec=1&nn=", from@nneighbors, "&lev=", from@nlevels, "&t=", from@querytype,"&fmt=igraph&did=", from@dataset, "&aid=", from@network,sep="")
	#cat("Fetching: ", url,"\n")
	content=getBinaryURL(url)
		
	tmp = tempfile()
	writeBin(content, con = tmp)
	load(tmp)
	
	# data.frame(vertex.attributes(graph))
	return(graph)
}
setAs("eSnetwork","igraph",.asIgraph)

asJSON<-function(from) {
	stopIfNotReady(from)
	if(is.null(from@query))
		query="all"
	else
		query=from@query
	content=fromJSON( getURL(paste("localhost:7520/get?q=",curlEscape(query),"&sec=1&nn=",from@nneighbors,"&lev=",from@nlevels, "&t=", from@querytype,"&fmt=json&did=",from@dataset,"&aid=",from@network,sep="")) )
	return(content)
}


.asDist<-function(from) {
	stopIfNotReady(from)
	content=getBinaryURL(paste("localhost:7520/distdownload?did=",from@dataset,"&aid=",from@network,sep=""))
	tmp = tempfile()
	writeBin(content, con = tmp)
	load(tmp)
	return(distances)
}
setAs("eSnetwork","dist",.asDist)

## Gets the processing status of the given network
.get.status<-function(network) {
	if(!is(network,"eSnetwork")) stop("from must be an object of class eSnetwork")
	res=fromJSON( getURL(paste("localhost:7520/status/",network@dataset,"/",network@network,sep="")) )
	return(res)
}

stopIfNotReady<-function(network) {
	res=.get.status(network)
	if(!res$success) {
		stop(res$msg)
	} else if(!res$msg$ready) stop("Dataset not ready: ",res$msg$state)
	return(res)
}

plot.eSnetwork<-function(object) {
	stopIfNotReady(object)
	browseURL(	
		paste("http://localhost:7520/navigator.html?ds=",object@dataset,"&an=",object@network,sep="")
	)
}

#data=data.frame(taxon=c("cistus ladanifer","cistus ladanifer","cistus ladanifer","cistus crispus"),latitude=c(38,37,37,38),longitude=c(-8,-8,-7,-9))
