// gcc -fPIC -O3 -o libecoSpace.so -shared -I/usr/lib/jvm/java-7-openjdk-amd64/include -B tiff-4.0.3/libtiff/.libs extract-vars.c distancequery.c distances.c readtiffs.c kernel-dens.c build-kernel.c -lc -ltiff 
#include <jni.h>
#include <stdio.h>
#include <math.h>
#include <stdlib.h>
#include <limits.h>
#include "tiff-4.0.3/libtiff/tiffio.h"
#include "econav.h"
#define SIGMA		10.f		// this is the Sigma for the downweighting algorithm
#define LENGTHGAU	50			// this is the length of the array containing the downweighting gaussian
#define COORDSCALE	0.1f		// this is the geographic size (in lat long) of the array containing the downweighting gaussian

//#define OUTPUTRAWVARIABLEFILE		// the raw variable values are curently not used, so we do not output this file

JNIEXPORT jint JNICALL Java_pt_floraon_ecospace_nativeFunctions_readVariablesFromCoords(JNIEnv *env, jclass obj, jfloatArray lat, jfloatArray lng, jintArray IDs,jint ntaxa, jstring _dID) {
/* this function reads the values of each TIF file at each passed coordinate, and writes a binary file with that table.
	only 8 bit and 16 bit TIF files supported!
	coordinates are floats, variables are longs.
	it also computes a weight for each record based on the geographic coordinates
*/
	const char *dID=(*env)->GetStringUTFChars(env, _dID , NULL );
	int i,j,nfiles;
	unsigned int line,pos;
	float minlat=10000,minlng=10000,maxlat=-10000,maxlng=-10000,ranlat,ranlng,factor,range;
	FILE *outstd;
	VARIABLE v,*tmpv,*stdlat,*stdlng;
	TIFFGEOREF tiffiles[MAXVARIABLES];
	VARIABLEHEADER variables[MAXVARIABLES],vlat,vlng;
	TIFFErrorHandler tifferror=TIFFSetWarningHandler(NULL);
	
    jsize nrecs = (*env)->GetArrayLength(env, lat);
	jfloat *plat = (*env)->GetFloatArrayElements(env, lat, 0);
	jfloat *plng = (*env)->GetFloatArrayElements(env, lng, 0);
	jint *pIDs= (*env)->GetIntArrayElements(env, IDs, 0);
	
	tmpv=malloc(nrecs*sizeof(VARIABLE));
	stdlat=malloc(nrecs*sizeof(VARIABLE));
	stdlng=malloc(nrecs*sizeof(VARIABLE));
	memset(tiffiles,0,sizeof(TIFFGEOREF)*MAXVARIABLES);
	memset(variables,0,sizeof(VARIABLEHEADER)*MAXVARIABLES);

	nfiles=readTiffFiles("tiff/",tiffiles,variables);
	
	// we don't force the user to have tiffs. can work with just lat long
/*	if(!nfiles) {
		free(tmpv);
		free(stdlat);
		free(stdlng);
		return 0;
	}*/

	for(i=0;i<MAXVARIABLES;i++) {
		variables[i].min=1000000;
		variables[i].max=-1000000;
	}

#ifdef OUTPUTRAWVARIABLEFILE
	FILE *outfile;
	outfile=fopen(VARIABLEFILE(dID),"w");
	fwrite(&nrecs,sizeof(jsize),1,outfile);
	fwrite(&ntaxa,sizeof(jint),1,outfile);
	fwrite(&nfiles,sizeof(int),1,outfile);
#endif
	outstd=fopen(STANDARDVARIABLEFILE(dID),"w");	
	fwrite(&nrecs,sizeof(jsize),1,outstd);
	fwrite(&ntaxa,sizeof(jint),1,outstd);
	fwrite(&nfiles,sizeof(int),1,outstd);
	
	{	// build an index of taxon IDs - for each ID, where is the first record of this ID
	// NOTE: the record IDs must be sequentially increasing along the records!
		printf("Building record index...\n");
		unsigned long *indID=malloc(sizeof(long)*ntaxa);
		unsigned long prev=9999999;
		for(i=0;i<ntaxa;i++) indID[i]=ULONG_MAX;
		for(i=0;i<nrecs;i++) {
			if(prev!=pIDs[i]) {
				indID[pIDs[i]]=i;
				prev=pIDs[i];
			}
		}

#ifdef OUTPUTRAWVARIABLEFILE
		fwrite(indID,sizeof(long),ntaxa,outfile);
		fwrite(pIDs,sizeof(jint),nrecs,outfile);	// taxon ID array for all records
		fwrite(plat,sizeof(jfloat),nrecs,outfile);
		fwrite(plng,sizeof(jfloat),nrecs,outfile);
#endif
		fwrite(indID,sizeof(long),ntaxa,outstd);
		fwrite(pIDs,sizeof(jint),nrecs,outstd);
		fwrite(plat,sizeof(jfloat),nrecs,outstd);
		fwrite(plng,sizeof(jfloat),nrecs,outstd);

// RECORD DOWNWEIGHTING
// compute a weight for each record such that records of the same species in the same place are downweighted, e.g. 2 records with the same coordinates account for 0.5 each
		printf("Computing weight for each record...");
		unsigned long *weight=calloc(nrecs,sizeof(long));
		unsigned long norm[LENGTHGAU];
		int tid;
		long long soma;
		unsigned int dx,dy;
		unsigned long hyp;

// compute a normal distribution
//	(1/(s*sqrt(2*pi)))*exp(-0.5*((x-u)/s)^2)
		for(i=0;i<LENGTHGAU;i++)
			norm[i]=(unsigned long)(exp(-0.5*((float)i/SIGMA)*((float)i/SIGMA))*MULTIPLIER);
		
		int tot,down;
		unsigned long weisum=0;
		for(tid=0;tid<ntaxa;tid++) {	// for each taxon independently...
			if(indID[tid]==ULONG_MAX) continue;
			for(i=indID[tid];pIDs[i]==tid && i<nrecs;i++) {	// for the ith record, compute weight
				soma=0;
				tot=0;down=0;
				for(j=indID[tid];pIDs[j]==tid && j<nrecs;j++) {	// inner record loop
					tot++;
					dx=(int)(fabs(plng[i]-plng[j])*((float)LENGTHGAU/COORDSCALE));
					dy=(int)(fabs(plat[i]-plat[j])*((float)LENGTHGAU/COORDSCALE));
					
					if(dx>LENGTHGAU || dy>LENGTHGAU) continue;
					hyp=dx*dx + dy*dy;			// TODO implement a geodesic distance
					if(hyp>LENGTHGAU*LENGTHGAU) continue;
					hyp=(unsigned long)sqrt(hyp);
//					printf("%f %f dx %d dy %d\n",fabs(plng[i]-plng[j]),fabs(plat[i]-plat[j]),dx,dy);
//					printf("Hyp %ld\n",hyp);
					if(hyp>0) down++;
					soma+=norm[hyp];
				}
				weight[i]=((long long)MULTIPLIER*(long long)MULTIPLIER)/soma;
				weisum+=weight[i];
//				printf("Down %d/%d Soma %llu; %lu\n",down,tot,soma,weight[i]);
			}
		}
		printf("Total # records: %d, # of equivalent records: %lu\n",nrecs,weisum/MULTIPLIER);
		fflush(stdout);
#ifdef OUTPUTRAWVARIABLEFILE
		fwrite(weight,sizeof(long),nrecs,outfile);
#endif
		fwrite(weight,sizeof(long),nrecs,outstd);
		
		free(weight);
		free(indID);
	}


// range-standardize coordinates to 0-9999 together (to maintain aspect ratio)
// compute max and min values

	for(i=0;i<nrecs;i++) {
		if(minlat>plat[i]) minlat=plat[i];
		if(maxlat<plat[i]) maxlat=plat[i];
		if(minlng>plng[i]) minlng=plng[i];
		if(maxlng<plng[i]) maxlng=plng[i];
	}
	
	ranlat=maxlat-minlat;
	ranlng=maxlng-minlng;
	factor=(ranlat>ranlng ? ranlat : ranlng)/9999;
// now range-standardize	
	for(i=0;i<nrecs;i++) {
		stdlat[i]=10000-((maxlat-plat[i])/factor);
		stdlng[i]=(plng[i]-minlng)/factor;
	}
	vlat.min=minlat;
	vlat.max=maxlat;
	vlng.min=minlng;
	vlng.max=maxlng;
	fwrite(&vlat,sizeof(VARIABLEHEADER),1,outstd);	// write variable header (min, max)
	fwrite(stdlat,sizeof(VARIABLE),nrecs,outstd);
	fwrite(&vlng,sizeof(VARIABLEHEADER),1,outstd);	// write variable header (min, max)
	fwrite(stdlng,sizeof(VARIABLE),nrecs,outstd);
    
    printf("Reading %d variables for %d coordinates...\nVariables done: ",nfiles,nrecs);fflush(stdout);
    
	for(i=0;i<nfiles;i++) {
	    for(j=0;j<nrecs;j++) {
			line=(int)floor((variables[i].tif->uly-plat[j])/variables[i].tif->py);
			if(line<variables[i].tif->hei) {
				pos=(int)floor((plng[j]-variables[i].tif->ulx)/variables[i].tif->px);
				if(pos<variables[i].tif->wid) {
					TIFFReadScanline(variables[i].tif->tif,variables[i].tif->buf,line,0);
					if(variables[i].tif->bps==8)
						v=((int8*)variables[i].tif->buf)[pos];
					else
						v=((int16*)variables[i].tif->buf)[pos];
					if(v==RASTERNODATA) {tmpv[j]=RASTERNODATA;continue;}
					
					if(variables[i].min>v) variables[i].min=(float)v;
					if(variables[i].max<v) variables[i].max=(float)v;
					variables[i].n++;
				} else v=RASTERNODATA;
			} else v=RASTERNODATA;
			tmpv[j]=v;
		}
		printf("%d ",i+1);
		fflush(stdout);
		
#ifdef OUTPUTRAWVARIABLEFILE
		fwrite(tmpv,sizeof(VARIABLE),nrecs,outfile);
#endif
// range-standardize	
		range=variables[i].max-variables[i].min;
		factor=range/9999;
		for(j=0;j<nrecs;j++) tmpv[j]=(tmpv[j]==RASTERNODATA ? RASTERNODATA : (tmpv[j]-variables[i].min)/factor);
// output	
		fwrite(&variables[i],sizeof(VARIABLEHEADER),1,outstd);	// write variable header (min, max)
		fwrite(tmpv,sizeof(VARIABLE),nrecs,outstd);		// write variable values
    }
    
	{	// write variable index text file (to be read in Java), which has the max and min for all vars, for this dataset
	
		FILE *varindex;
		varindex=fopen(VARIABLELISTFILE(dID),"w");
		
		char buf[100];
		sprintf(buf,"latitude\t%f\t%f\n",vlat.min,vlat.max);
		fputs(buf,varindex);
		sprintf(buf,"longitude\t%f\t%f\n",vlng.min,vlng.max);
		fputs(buf,varindex);
		for(i=0;i<nfiles && tiffiles[i].filename;i++) {	// write variable file names (TIFF file names)
			sprintf(buf,"%s\t%f\t%f\n",tiffiles[i].filename,variables[i].min,variables[i].max);
			fputs(buf,varindex);
		}
		fclose(varindex);
	}
    printf("Variables read.\n");
	(*env)->ReleaseFloatArrayElements(env, lat, plat, 0);
	(*env)->ReleaseFloatArrayElements(env, lng, plng, 0);
	(*env)->ReleaseIntArrayElements(env, IDs, pIDs, 0);
#ifdef OUTPUTRAWVARIABLEFILE
	fclose(outfile);
#endif
	fclose(outstd);
	free(tmpv);
	free(stdlat);
	free(stdlng);
	TIFFSetWarningHandler(tifferror);
	return 1 ;
}

