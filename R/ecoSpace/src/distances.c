#include <jni.h>
#include <stdio.h>
#include <math.h>
#include <stdlib.h>
#include <omp.h>
#include "econav.h"

//unsigned char computeDistance(DENSITY d1,DENSITY d2,size_t size);

JNIEXPORT jlong JNICALL Java_pt_floraon_ecospace_nativeFunctions_initProgressDistanceMatrix (JNIEnv *env, jclass obj) {
	int *progress=malloc(sizeof(int));
	*progress=0;
	return (jlong)progress;
}

JNIEXPORT jlong JNICALL Java_pt_floraon_ecospace_nativeFunctions_computeDistanceMatrix(JNIEnv *env, jclass obj, jstring uid, jstring anuid, jlong _progress) {
	int *progress=(int*)_progress;
	const char *puid=(*env)->GetStringUTFChars(env, uid , NULL );
	const char *panuid=(*env)->GetStringUTFChars(env, anuid , NULL );
	int ntaxa,*IDs,i,nvars,arraysize,j;
	register int k;
	register unsigned char *pd2;
	unsigned int side,*freqs;
	unsigned char *distances;
	DENSITY *densities;
	size_t dummy;
	FILE *densfile,*outfile;
	
	{	// redirect stdout to file
		int fd;
		fpos_t pos;
		fflush(stdout);
		fgetpos(stdout, &pos);
		fd = dup(fileno(stdout));
		FILE *dummy=freopen("logfile.txt", "a", stdout);
	}

	densfile=fopen(DENSITYFILE(puid,panuid),"r");
	if(!densfile) return 0;
	dummy=fread(&ntaxa,sizeof(int),1,densfile);
	IDs=malloc(ntaxa*sizeof(int));
	dummy=fread(IDs,sizeof(int),ntaxa,densfile);
	printf("Computing distance matrix\nReading densities for %d taxa.\n",ntaxa);
//for(i=0;i<ntaxa;i++) printf("%d ",IDs[i]);
	dummy=fread(&side,sizeof(int),1,densfile);
	dummy=fread(&nvars,sizeof(int),1,densfile);

	arraysize=(int)pow(side,nvars);
	
	printf("\nSide of grid: %d\nNr. of variables: %d\n",side,nvars);

// read densities	
	densities=malloc(ntaxa*sizeof(DENSITY));
	freqs=malloc(ntaxa*sizeof(int));
	for(i=0;i<ntaxa;i++) {
		dummy=fread(&densities[i],sizeof(DENSITY),1,densfile);
		freqs[i]=densities[i].nrecords;
		densities[i].density=malloc(arraysize);
		dummy=fread(densities[i].density,arraysize,1,densfile);

//		for(j=0,sum=0;j<arraysize;j++) sum+=(float)densities[i].density[j]*densities[i].max/255.0;
//		printf("Max: %f; SUM: %f NRECS: %d\n",densities[i].max,densities[i].sum,densities[i].nrecords);
	}

	distances=malloc(ntaxa*ntaxa);
	
// compute square distance matrix. for each taxon pair...
// TODO optimize this for speed
	float *tmp1,tmp2,v;
	tmp1=malloc(arraysize*sizeof(float));
	int counter=0;
	for(i=0;i<ntaxa;i++) {
//printf("Taxon %d, max density %f\n",i,densities[i].max);
		if(densities[i].max < 0) {	// if this taxon has no kernel density (because of NAs)
			printf("[INFO] Skipping taxon number %d with ID %d\n", i, IDs[i]);
			for(j=i; j<ntaxa; j++) distances[i+j*ntaxa] = NA_DISTANCE;
			#pragma omp atomic
			counter += (ntaxa-i);
			continue;
		}
		for(k=0;k<arraysize;k++)
			tmp1[k]=(float)densities[i].density[k]*densities[i].max/((float)MAXDENSITY*densities[i].sum);

		#pragma omp parallel private(j,v,k,pd2,tmp2)
		{
//			printf("Parallelizing with %d threads...\n",omp_get_num_threads());fflush(stdout);
			#pragma omp for
			for(j=i;j<ntaxa;j++) {
				if(densities[j].max < 0) {	// if this taxon has no kernel density (because of NAs)
					distances[i+j*ntaxa] = NA_DISTANCE;
					#pragma omp atomic
					counter++;
					continue;
				}
				v=0;
				for(k=0,pd2=densities[j].density;k<arraysize;k++,pd2++) {
					tmp2=(float)(*pd2) * densities[j].max / ((float)MAXDENSITY * densities[j].sum);
//			printf("%f : %f ",tmp1[k]*1000,tmp2*1000);
					v+=(tmp1[k]<tmp2 ? tmp1[k] : tmp2);			
				}
				distances[i+j*ntaxa]=(unsigned char)((1-v)*MAXDISTANCE);
				#pragma omp atomic
				counter++;
			}
		}
//		printf("Taxon %d\n",i);fflush(stdout);
		*progress=(int)(((float)counter / (ntaxa*(ntaxa+1)/2))*1000);
	}
// copy the lower triangle
	for(i=0;i<ntaxa;i++) {
		for(j=i;j<ntaxa;j++) distances[j+i*ntaxa]=distances[i+j*ntaxa];
	}

/*	for(i=0;i<ntaxa;i++) {
		for(j=0;j<ntaxa;j++) {
			printf("%c ",48+(char)((float)distances[i+j*ntaxa]/255*10));
		}
		printf("\n");
	}	*/
/*printf("Wrote to file!\n");
for(i=0;i<ntaxa;i++) printf("%d ",IDs[i]);
printf("OK\n");*/

	outfile=fopen(DISTANCEFILE(puid,panuid),"w");
	if(!outfile) return 0;
	fwrite(&ntaxa,sizeof(int),1,outfile);
	fwrite(IDs,sizeof(int),ntaxa,outfile);
	fwrite(freqs,sizeof(int),ntaxa,outfile);
	fwrite(distances,sizeof(char),ntaxa*ntaxa,outfile);
	fclose(outfile);
		
	free(distances);
	for(i=0;i<ntaxa;i++) free(densities[i].density);
	free(densities);
	free(IDs);
	free(tmp1);
	free(freqs);
	fclose(densfile);
	(*env)->ReleaseStringUTFChars(env,uid,puid);
	(*env)->ReleaseStringUTFChars(env,anuid,panuid);
	
	return (jlong)progress;
}

JNIEXPORT jint JNICALL Java_pt_floraon_ecospace_nativeFunctions_getProgressDistanceMatrix (JNIEnv *env, jclass obj, jlong ptr, jboolean _free) {
	int *progress=(int*)ptr;
	int ret=*progress;
	if(_free) free(progress);
	return ret;
}


/*
unsigned char computeDistance(DENSITY d1,DENSITY d2,size_t size) {
// compute fast intersection of two kernel densities
	register unsigned char *pd1,*pd2;
	register int i;
	float v=0;
	float tmp1,tmp2;
	for(i=0,pd1=d1.density,pd2=d2.density;i<size;i++,pd1++,pd2++) {
		tmp1=(float)(*pd1)*d1.max/((float)255*d1.sum);
		tmp2=(float)(*pd2)*d2.max/((float)255*d2.sum);
		v+=(tmp1<tmp2 ? tmp1 : tmp2);
	}
	return((unsigned char)((1-v)*255));
}*/
