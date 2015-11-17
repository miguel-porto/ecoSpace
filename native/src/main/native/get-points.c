#include <stdio.h>
#include <stdlib.h>
#include "econav.h"
#include "/usr/lib/jvm/java-7-openjdk-amd64/include/jni.h"

// gcc -O3 -o get-points get-points.c
int main(int argc, char **argv) {
/*
	This fetches the variable values of all records of given taxa
	Arguments:
	- path to the variable file (vars_xxxxxx.bin)
	- variable for x axis (0=lat, 1=long, 2... n other vars)
	- variable for y axis (0=lat, 1=long, 2... n other vars)
	- any number of taxon IDs separated by spaces
*/
	if(argc<2) return 1;
	FILE *varsfile=fopen(argv[1],"rb");
	jsize nrecs;
	jint ntaxa,*pIDs;
	int nfiles,dummy,vars[]={atoi(argv[2]),atoi(argv[3])},i,nvars,j;
	int ntIDs=argc-4;
	int *tIDs=malloc(sizeof(int)*ntIDs);
	unsigned long *indID;
	VARIABLE *vararray;
	VARIABLEHEADER vhead[2];
	
	for(i=0;i<ntIDs;i++) tIDs[i]=atoi(argv[i+4]);
	
	dummy=fread(&nrecs,sizeof(jsize),1,varsfile);
	dummy=fread(&ntaxa,sizeof(jint),1,varsfile);
	dummy=fread(&nvars,sizeof(int),1,varsfile);
//	printf("# records: %d\n# taxa: %d\n# variables: %d\n",nrecs,ntaxa,nvars);
	indID=malloc(sizeof(long)*ntaxa);
	dummy=fread(indID,sizeof(long),ntaxa,varsfile);
//	for(i=0;i<ntaxa;i++) printf("%d %ld;",i,indID[i]);
	pIDs=malloc(nrecs*sizeof(jint));
	dummy=fread(pIDs,sizeof(jint),nrecs,varsfile);
	fseek(varsfile,2*sizeof(jfloat)*nrecs,SEEK_CUR);	// skip original lat long values

	vararray=malloc(2*nrecs*sizeof(VARIABLE));
	for(i=0;i<2;i++) {	// read the two variables that we want
		fseek(varsfile,(sizeof(VARIABLEHEADER) + sizeof(VARIABLE)*nrecs)*(vars[i]-(i==0 ? 0 : (vars[i-1]+1))),SEEK_CUR);
		dummy=fread(&vhead[i],sizeof(VARIABLEHEADER),1,varsfile);
//		printf("Variable %d: min %f max %f\n",i,vhead[i].min,vhead[i].max);
		dummy=fread(&vararray[i*nrecs],sizeof(VARIABLE),nrecs,varsfile);
	}

//	for(i=0;i<nrecs;i++) printf("%d %ld %ld; ",pIDs[i],vararray[i],vararray[i+nrecs]);

// start calculations			
	for(j=0;j<ntIDs;j++) {	// taxon loop
		for(i=indID[tIDs[j]];pIDs[i]==tIDs[j];i++) printf("%ld %ld\n",vararray[i],vararray[i+nrecs]);
	}

	
	free(tIDs);
	fclose(varsfile);
	free(indID);
	free(pIDs);
	free(vararray);
	return 0;
}

