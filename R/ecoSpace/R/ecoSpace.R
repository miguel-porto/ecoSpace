.onLoad<-function(libname,pkgname) {
	test=try(getURL("localhost:7520"),silent=TRUE)
	if(inherits(test,"try-error")) {
		cat("ERROR: ecoSpace server not running!\n")
	} else {
		cat("Welcome to ecoSpace!\nExisting analyses:\n\n")
		print(get.datasets())
	}
}

start.server<-function(pathtoserver) {
	prevwd=getwd()
	setwd(pathtoserver)
	cmd=paste(pathtoserver,"/run start",sep="")
	system(cmd)
	setwd(prevwd)
}

stop.server<-function(pathtoserver) {
	prevwd=getwd()
	setwd(pathtoserver)
	cmd=paste(pathtoserver,"/run stop",sep="")
	system(cmd)
	setwd(prevwd)
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
	v=fromJSON(getURL("localhost:7520/getdatasets"))$datasets
	rownames(v)=v[,"id"]
	v=v[,!(colnames(v)=="id")]
	return(v)
}

get.analyses<-function(dataset) {
	v=fromJSON(getURL(paste("localhost:7520/getanalyses?did=",dataset,sep="")))$analyses
	rownames(v)=v[,"id"]
	v=v[,!(colnames(v)=="id")]
	return(v)
}

# creates a new dataset from an R data frame with the columns: latitude longitude taxon
new.dataset<-function(data,description=NULL) {
	if(inherits(
	if( !("latitude" %in% colnames(data)) || !("longitude" %in% colnames(data)) || !("taxon" %in% colnames(data))) stop("Data frame must have the columns \"latitude\", \"longitude\" and \"taxon\".")
	
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
	
	filename=tempfile()
	write.table(dwc,file=filename,sep="\t",quote=FALSE,row.names=FALSE)
	if(is.null(description)) description="Local file"
	did=fromJSON(getURL( paste("localhost:7520/adddataset/local?file=",curlEscape(filename),"&desc=",curlEscape(description),sep="") ))
	
	return(dwc)
}

new.analysis<-function(dataset,variables=c("latitude","longitude"),minFreq=5,sigmaPercent=0.01,downWeight=TRUE) {
	variables=paste(variables,collapse=",")
	res=fromJSON(
		getURL(paste("localhost:7520/open?did=",dataset,"&v=",curlEscape(variables),"&min=",minFreq,"&sig=",sigmaPercent,"&dw=",ifelse(downWeight,1,0),sep=""))
	)
	if(!res$success) {
		stop(res$msg)
	} else {
		return(res$msg)
	}
}

#data=data.frame(taxon=c("cistus ladanifer","cistus ladanifer","cistus ladanifer","cistus crispus"),latitude=c(38,37,37,38),longitude=c(-8,-8,-7,-9))
