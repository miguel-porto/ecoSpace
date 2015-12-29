# mvn clean package

.onLoad<-function(libname,pkgname) {
# java -Djava.library.path=/home/miguel/workspace/ecospace/R/ecoSpace/inst/java/ -jar /home/miguel/workspace/ecospace/R/ecoSpace/inst/java/ecoSpace-server-java-1.0-SNAPSHOT-jar-with-dependencies.jar
	assign(".Last",function() {
		if(testServer(FALSE)) {
			cat("Stopping ecoSpace server...\n")
			stop.server()
		}
	}, envir = .GlobalEnv)
}

.onAttach<-function(libname,pkgname) {
	packageStartupMessage("This is ecoSpace.\nType start.server() before doing any operation.")
}

testServer<-function(fail=FALSE) {
	test=try(getURL("localhost:7520"),silent=TRUE)
	if(inherits(test,"try-error")) {
		if(fail) stop("ecoSpace server not running! Type start.server()")
		return(FALSE)
	} else return(TRUE)
}

start.server<-function() {
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
	cat(" server ready!\nExisting analyses:\n\n")
	print(get.datasets())
}

stop.server<-function() {
	getURL("localhost:7520/stop")
	close(serverProcess)
	#prevwd=getwd()
	#setwd(pathtoserver)
	#cmd=paste(pathtoserver,"/run stop",sep="")
	#system(cmd)
	#setwd(prevwd)
}

distance.matrix<-function(dataset,analysis) {
	content=getBinaryURL(paste("localhost:7520/distdownload?did=",dataset,"&aid=",analysis,sep=""))
	tmp = tempfile()
	writeBin(content, con = tmp)
	load(tmp)
	return(distances)
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

get.analyses<-function(dataset) {
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
		ori.dwc=read.csv(data,sep="\t",header=T,strings=F)
		dwc=ori.dwc[,colsDWC]
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
			dwc=data
		},"error"={
			stop( paste("Data frame must either have the columns ",paste(colsSimp,collapse=", ")," OR ",paste(colsDWC,collapse=", "),sep="") )
		}
		)
	} else stop("'data' must be either a data frame of taxon coordinates, or a path to a DarwinCore text file.")
	
	filename=tempfile()
	write.table(dwc,file=filename,sep="\t",quote=FALSE,row.names=FALSE)
	if(is.null(description)) description="Local file"
	#print(paste("localhost:7520/adddataset/local?file=",curlEscape(filename),"&desc=",curlEscape(description),sep=""))
	did=fromJSON(getURL( paste("localhost:7520/adddataset/local?file=",curlEscape(filename),"&desc=",curlEscape(description),sep="") ))
	
	return(did)
}

new.network<-function(dataset,variables=c("latitude","longitude"),minFreq=5,sigmaPercent=0.01,downWeight=TRUE) {
	variables=paste(variables,collapse=",")
	res=fromJSON( getURL(paste("localhost:7520/open?did=",dataset,"&v=",curlEscape(variables),"&min=",minFreq,"&sig=",sigmaPercent,"&dw=",ifelse(downWeight,1,0),sep="")) )
	if(!res$success) {
		stop(res$msg)
	} else {
		out=list(dataset=dataset,analysis=res$msg)
		class(out)="ecospace"
		return(out)
	}
}

as.igraph<-function(from) {
	stopIfNotReady(from)
	content=getBinaryURL(paste("localhost:7520/get?q=all&sec=1&fmt=igraph&did=",from[["dataset"]],"&aid=",from[["analysis"]],sep=""))
	tmp = tempfile()
	writeBin(content, con = tmp)
	load(tmp)
	
	# data.frame(vertex.attributes(graph))
	return(graph)
}

setAs("ecospace","igraph",as.igraph)

plot.ecospace<-function(network) {
	stopIfNotReady(network)
	browseURL(	
		paste("http://localhost:7520/navigator.html?ds=",network[["dataset"]],"&an=",network[["analysis"]],sep="")
	)
}

## Gets the processing status of the given network
get.status<-function(network) {
	if(!inherits(network,"ecospace")) stop("from must be an object of class ecospace")
	res=fromJSON( getURL(paste("localhost:7520/status/",network[["dataset"]],"/",network[["analysis"]],sep="")) )
	return(res)
}

stopIfNotReady<-function(network) {
	res=get.status(network)
	if(!res$success) {
		stop(res$msg)
	} else if(!res$msg$ready) stop("Dataset not ready: ",res$msg$state)
	return(res)
}

#data=data.frame(taxon=c("cistus ladanifer","cistus ladanifer","cistus ladanifer","cistus crispus"),latitude=c(38,37,37,38),longitude=c(-8,-8,-7,-9))
