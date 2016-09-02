#include <jni.h>
#include <stdio.h>
#include <math.h>
#include <stdlib.h>
#include "econav.h"

#define MAXMEMORYPERBATCH	2000L<<20		// we allow 2 Gb of memory to be occupied by each analysed batch
#define MAXSIDE				1000			// but we never allow a grid larger than 1000 cells
//#define VERBOSE

void saveKernelDensity(float *src,int nrecs,DENSITY *dst);
float* buildKernel(int side,float sigma,int dimension,int *outkernelhalfside,int *outkernelside,int *outkernelsidesq);

unsigned int side,arraysize;

JNIEXPORT jint JNICALL Java_pt_floraon_ecospace_nativeFunctions_computeKernelDensities(JNIEnv *env, jclass obj, jstring filename, jstring outfilename, jintArray variables,jint freqthresh,jfloat sigmapercent,jboolean downweight) {
// NOTE: "variables" must be in increasing order! 0 is latitude, 1 is longitude, 2... are the other climatic variables
	const char *pfilename=(*env)->GetStringUTFChars(env, filename , NULL );
	const char *poutfilename=(*env)->GetStringUTFChars(env, outfilename , NULL );
	
	FILE *varsfile,*densfile,*freqfile;
	int nvars,i,j,k,*freqs,ntaxafiltered=0,*mapIDs,*outIDs,d1,d2,d1from,d1to,d2from,d2to,d3from,d3to,d1kern,d2kern,sidesq;
	int lastID=-1,d2p,kernelhalfside,kernelside,kernelsidesq;
	register int d3p,d3;
	register float *d3kern;
	jsize nrecs;
	jint ntaxa,*pIDs;
	VARIABLE *vararray;
	VARIABLEHEADER *varheader;
	int nvarstouse=(int)(*env)->GetArrayLength(env,variables);		// how many vars will be used for kernel density
	jint *pvariables=(*env)->GetIntArrayElements(env, variables, 0);
	float sigma;
	float *kernel,*tmpdens;
	unsigned long *weight;
	DENSITY *densities;
	bool anythingtosave=false,skiprec;
	size_t dummy;
	
	varsfile=fopen(STANDARDVARIABLEFILE(pfilename),"r");
	dummy=fread(&nrecs,sizeof(jsize),1,varsfile);
	dummy=fread(&ntaxa,sizeof(jint),1,varsfile);
	dummy=fread(&nvars,sizeof(int),1,varsfile);
//	fseek(varsfile,nvars*sizeof(tmp.filename)+sizeof(long)*ntaxa,SEEK_CUR);
	fseek(varsfile,sizeof(long)*ntaxa,SEEK_CUR);	// skip index

	{	// redirect stdout to file
		int fd;
		fpos_t pos;
		fflush(stdout);
		fgetpos(stdout, &pos);
		fd = dup(fileno(stdout));
		FILE *dummy=freopen("logfile.txt", "a", stdout);
	}


	vararray=malloc(nvarstouse*nrecs*sizeof(VARIABLE));
	varheader=malloc(nvarstouse*sizeof(VARIABLEHEADER));
	pIDs=malloc(nrecs*sizeof(jint));
	dummy=fread(pIDs,sizeof(jint),nrecs,varsfile);
	fseek(varsfile,2*sizeof(jfloat)*nrecs,SEEK_CUR);	// skip original coordinates
	weight=malloc(sizeof(long)*nrecs);
	dummy=fread(weight,sizeof(long),nrecs,varsfile);

	for(i=0;i<nvarstouse;i++) {
		fseek(varsfile,(sizeof(VARIABLEHEADER) + sizeof(VARIABLE)*nrecs)*(pvariables[i]-(i==0 ? 0 : (pvariables[i-1]+1))),SEEK_CUR);
		dummy=fread(&varheader[i],sizeof(VARIABLEHEADER),1,varsfile);
		printf("Variable %d: min %f max %f\n",pvariables[i],varheader[i].min,varheader[i].max);
		dummy=fread(&vararray[i*nrecs],sizeof(VARIABLE),nrecs,varsfile);
	}
	
// count the # of records of each taxon
	freqs=calloc(ntaxa,sizeof(int));
	for(i=0;i<nrecs;i++) freqs[pIDs[i]]++;
// write out frequencies in a text file (for java)
	freqfile=fopen(FREQANALYSISFILE(pfilename),"w");
	for(i=0;i<ntaxa;i++) fprintf(freqfile,"%d\n",freqs[i]);
	fclose(freqfile);
// count the # of taxa after filtering out rarest	
	for(i=0;i<ntaxa;i++) if(freqs[i] >= freqthresh) ntaxafiltered++;
// create a mapping of IDs: because some IDs were removed, make them sequential without holes (remember that memory is the limiting factor here!)
	mapIDs=malloc(ntaxa*sizeof(int));
	for(i=0;i<ntaxa;i++) mapIDs[i]=-1;
	for(i=0,j=0;i<nrecs;i++) {
		if(freqs[pIDs[i]] >= freqthresh) {
			if(mapIDs[pIDs[i]]==-1) {
				mapIDs[pIDs[i]]=j;
				j++;
			}
		}
	}
//for(i=0;i<ntaxa;i++) printf("%d ",mapIDs[i]);
	
// compute the resolution of the multidimensional space so that not too much memory is occupied
	side=(int)pow((float)(MAXMEMORYPERBATCH)/(float)ntaxafiltered,(float)1/nvarstouse);
	if(side>MAXSIDE) side=MAXSIDE;
//side=40;
	sidesq=side*side;
	sigma=side*sigmapercent;
	arraysize=(int)pow(side,nvarstouse);

	printf("Using a grid with a side of %d cells, in %d variables (dimensions).\n",side,nvarstouse);
	printf("Reading %d variables of %d records of %d taxa (after filtering out those with less than %d occurrences)...\n",nvars,nrecs,ntaxafiltered,freqthresh);
// build the kernel for this case
	kernel=buildKernel(side,sigma,nvarstouse,&kernelhalfside,&kernelside,&kernelsidesq);

// compute densities
// allocate N multidimensional arrays (multidimensional grids to compute kernel densities in each cell)
	densities=malloc(ntaxafiltered*sizeof(DENSITY));
	outIDs=calloc(ntaxafiltered,sizeof(int));

	for(i=0;i<ntaxafiltered;i++) {
		densities[i].density=malloc(arraysize);
		memset(densities[i].density,0,arraysize);
	}

	printf("Computing kernel densities");fflush(stdout);

// scale the variables to the size of the grid
	for(i=0;i<nrecs;i++) {	
		for(k=0;k<nvarstouse;k++) {
			if(vararray[i+nrecs*k]!=RASTERNODATA) vararray[i+nrecs*k]=(vararray[i+nrecs*k]*side)/10000;
		}
	}
	
	#pragma omp parallel private(i,k,skiprec,tmpdens,anythingtosave,d1from,d1to,d1,d1kern,d2,d2from,d2to,d2p,d2kern,d3,d3from,d3to,d3p,d3kern)
	{
		tmpdens=malloc(arraysize*sizeof(float));
		memset(tmpdens,0,arraysize*sizeof(float));

		#pragma omp for
		for(j=0;j<ntaxa;j++) {		// NOTE: this loop doesn't need the records to be sorted, that's why it takes much longer
// TODO: we might have an index here, i.e. for each taxon, a list of tthe respective records, but it's so fast that maybe it's not a big issue, we're talking about a few thousands of taxa only.
			if(freqs[j]<freqthresh) continue;
			anythingtosave=false;
			for(i=0;i<nrecs;i++) {	// iterate through all records in search for this taxon ACK!! give me an index
				if(pIDs[i]!=j) continue;
				for(k=0,skiprec=false;k<nvarstouse;k++) {	// check if any one of the variables is NA. if it is, skip this record
					if(vararray[i+nrecs*k]==RASTERNODATA) {
						skiprec=true;
						break;
					}
				}
				if(skiprec) continue;		// skip NAs
	// now yeah, create density surface by summing the kernels record by record			
	// since it is not computationally feasible more than 3 dimensions, just make the optimized code for each case...
				switch(nvarstouse) {
					case 1:
						d1from=(vararray[i]-kernelhalfside)<0 ? 0 : (vararray[i]-kernelhalfside);
						d1to=(vararray[i]+kernelhalfside+1>side ? side : vararray[i]+kernelhalfside+1);
					
						for(d1=d1from,d1kern=vararray[i]-kernelhalfside<0 ? kernelhalfside-vararray[i] : 0;d1<d1to;d1++,d1kern++) {
							tmpdens[d1]+=kernel[d1kern] * (downweight ? ((float)weight[i]/MULTIPLIER) : 1);
						}
						anythingtosave=true;
					break;
				
					case 2:
						d1from=(vararray[i]-kernelhalfside)<0 ? 0 : (vararray[i]-kernelhalfside);
						d1to=(vararray[i]+kernelhalfside+1>side ? side : vararray[i]+kernelhalfside+1);
						d2from=(vararray[i+nrecs]-kernelhalfside)<0 ? 0 : (vararray[i+nrecs]-kernelhalfside);
						d2to=(vararray[i+nrecs]+kernelhalfside+1>side ? side : vararray[i+nrecs]+kernelhalfside+1);
					
						for(d1=d1from,d1kern=vararray[i]-kernelhalfside<0 ? kernelhalfside-vararray[i] : 0;d1<d1to;d1++,d1kern++) {
							for(d2=d2from,d2p=d1+d2from*side,d2kern=d1kern+((vararray[i+nrecs]-kernelhalfside)<0 ? (kernelhalfside-vararray[i+nrecs])*kernelside : 0);d2<d2to;d2++,d2p+=side,d2kern+=kernelside) {
								tmpdens[d2p]+=kernel[d2kern] * (downweight ? ((float)weight[i]/MULTIPLIER) : 1);
							}
						}
						anythingtosave=true;
					break;
				
					case 3:
						d1from=(vararray[i]-kernelhalfside)<0 ? 0 : (vararray[i]-kernelhalfside);
						d1to=(vararray[i]+kernelhalfside+1>side ? side : vararray[i]+kernelhalfside+1);
						d2from=(vararray[i+nrecs]-kernelhalfside)<0 ? 0 : (vararray[i+nrecs]-kernelhalfside);
						d2to=(vararray[i+nrecs]+kernelhalfside+1>side ? side : vararray[i+nrecs]+kernelhalfside+1);
						d3from=(vararray[i+nrecs*2]-kernelhalfside)<0 ? 0 : (vararray[i+nrecs*2]-kernelhalfside);
						d3to=(vararray[i+nrecs*2]+kernelhalfside+1>side ? side : vararray[i+nrecs*2]+kernelhalfside+1);
						for(d1=d1from,d1kern=vararray[i]-kernelhalfside<0 ? kernelhalfside-vararray[i] : 0;
							d1<d1to;
							d1++,d1kern++) {
							for(d2=d2from,d2p=d1+d2from*side,d2kern=d1kern+((vararray[i+nrecs]-kernelhalfside)<0 ? (kernelhalfside-vararray[i+nrecs])*kernelside : 0)
								;d2<d2to
								;d2++,d2p+=side,d2kern+=kernelside) {
								for(d3=d3from,d3p=d2p+d3from*sidesq
										,d3kern=&kernel[d2kern+((vararray[i+nrecs*2]-kernelhalfside)<0 ? (kernelhalfside-vararray[i+nrecs*2])*kernelsidesq : 0)]
									;d3<d3to
									;d3++,d3p+=sidesq,d3kern+=kernelsidesq) {
									tmpdens[d3p]+=*d3kern * (downweight ? ((float)weight[i]/MULTIPLIER) : 1);
									//kernel[d3kern];
								}
							}
						}
						anythingtosave=true;
					break;
				}
			}	// end record loop
			if(anythingtosave) {
				saveKernelDensity(tmpdens,freqs[j],&densities[mapIDs[j]]);		// save kernel density of previous taxon
				outIDs[mapIDs[j]]=j;
			} else outIDs[mapIDs[j]]=-1;
			anythingtosave=false;
			memset(tmpdens,0,arraysize*sizeof(float));
			printf(".");
			fflush(stdout);
		}	// end taxon loop
	}
/*	THIS is the working code. Above still developing.
	for(i=0;i<nrecs;i++) {	// iterate through all records IMPORTANT: records must be sorted by taxon ID
		if(freqs[pIDs[i]]>=freqthresh) {
			if(pIDs[i]!=lastID) {	// this record is already a different species
				if(anythingtosave) {
					saveKernelDensity(tmpdens,freqs[lastID],&densities[mapIDs[lastID]]);		// save kernel density of previous taxon
					outIDs[mapIDs[lastID]]=lastID;
				} else outIDs[mapIDs[lastID]]=-1;
				anythingtosave=false;
				memset(tmpdens,0,arraysize*sizeof(float));
				lastID=pIDs[i];
				printf(".");
				fflush(stdout);
			}
// scale the variables to the size of the grid
			for(j=0,skiprec=false;j<nvarstouse;j++) {
				if(vararray[i+nrecs*j]==RASTERNODATA) {
					skiprec=true;
					continue;
				} else vararray[i+nrecs*j]=(vararray[i+nrecs*j]*side)/10000;
			}
			if(skiprec) continue;		// skip NAs
// now yeah, create density surface by summing the kernels record by record			
// since it is not computationally feasible more than 3 dimensions, just make the optimized code for each case...
			switch(nvarstouse) {
				case 1:
					d1from=(vararray[i]-kernelhalfside)<0 ? 0 : (vararray[i]-kernelhalfside);
					d1to=(vararray[i]+kernelhalfside+1>side ? side : vararray[i]+kernelhalfside+1);
					
					for(d1=d1from,d1kern=vararray[i]-kernelhalfside<0 ? kernelhalfside-vararray[i] : 0;d1<d1to;d1++,d1kern++) {
						tmpdens[d1]+=kernel[d1kern] * (downweight ? ((float)weight[i]/MULTIPLIER) : 1);
					}
					anythingtosave=true;
				break;
				
				case 2:
					d1from=(vararray[i]-kernelhalfside)<0 ? 0 : (vararray[i]-kernelhalfside);
					d1to=(vararray[i]+kernelhalfside+1>side ? side : vararray[i]+kernelhalfside+1);
					d2from=(vararray[i+nrecs]-kernelhalfside)<0 ? 0 : (vararray[i+nrecs]-kernelhalfside);
					d2to=(vararray[i+nrecs]+kernelhalfside+1>side ? side : vararray[i+nrecs]+kernelhalfside+1);
					
					for(d1=d1from,d1kern=vararray[i]-kernelhalfside<0 ? kernelhalfside-vararray[i] : 0;d1<d1to;d1++,d1kern++) {
						for(d2=d2from,d2p=d1+d2from*side,d2kern=d1kern+((vararray[i+nrecs]-kernelhalfside)<0 ? (kernelhalfside-vararray[i+nrecs])*kernelside : 0);d2<d2to;d2++,d2p+=side,d2kern+=kernelside) {
							tmpdens[d2p]+=kernel[d2kern] * (downweight ? ((float)weight[i]/MULTIPLIER) : 1);
						}
					}
					anythingtosave=true;
				break;
				
				case 3:
					d1from=(vararray[i]-kernelhalfside)<0 ? 0 : (vararray[i]-kernelhalfside);
					d1to=(vararray[i]+kernelhalfside+1>side ? side : vararray[i]+kernelhalfside+1);
					d2from=(vararray[i+nrecs]-kernelhalfside)<0 ? 0 : (vararray[i+nrecs]-kernelhalfside);
					d2to=(vararray[i+nrecs]+kernelhalfside+1>side ? side : vararray[i+nrecs]+kernelhalfside+1);
					d3from=(vararray[i+nrecs*2]-kernelhalfside)<0 ? 0 : (vararray[i+nrecs*2]-kernelhalfside);
					d3to=(vararray[i+nrecs*2]+kernelhalfside+1>side ? side : vararray[i+nrecs*2]+kernelhalfside+1);
					for(d1=d1from,d1kern=vararray[i]-kernelhalfside<0 ? kernelhalfside-vararray[i] : 0;
						d1<d1to;
						d1++,d1kern++) {
						for(d2=d2from,d2p=d1+d2from*side,d2kern=d1kern+((vararray[i+nrecs]-kernelhalfside)<0 ? (kernelhalfside-vararray[i+nrecs])*kernelside : 0)
							;d2<d2to
							;d2++,d2p+=side,d2kern+=kernelside) {
							for(d3=d3from,d3p=d2p+d3from*sidesq
									,d3kern=&kernel[d2kern+((vararray[i+nrecs*2]-kernelhalfside)<0 ? (kernelhalfside-vararray[i+nrecs*2])*kernelsidesq : 0)]
								;d3<d3to
								;d3++,d3p+=sidesq,d3kern+=kernelsidesq) {
								tmpdens[d3p]+=*d3kern * (downweight ? ((float)weight[i]/MULTIPLIER) : 1);
								//kernel[d3kern];
							}
						}
					}
					anythingtosave=true;
				break;
			}
		}
	}
	saveKernelDensity(tmpdens,freqs[lastID],&densities[mapIDs[lastID]]);		// save kernel density of the last taxon
	outIDs[mapIDs[lastID]]=lastID;
*/

// scale all densities to the absolute maximum
/*	unsigned long maxmax=0;
	float factor;
	for(i=0;i<ntaxafiltered;i++) if(maxmax<densities[i].max) maxmax=densities[i].max;
	for(i=0;i<ntaxafiltered;i++) {
		factor=(float)densities[i].max/maxmax;
		for(j=0;j<arraysize;j++) densities[i].density[j]=(unsigned char)((float)densities[i].density[j]*factor);
	}
	*/
// now write to output file
	printf("\nWriting file...\n");
	densfile=fopen(DENSITYFILE(pfilename,poutfilename),"w");
	fwrite(&ntaxafiltered,sizeof(int),1,densfile);		// how many densities in file
	fwrite(outIDs,sizeof(int),ntaxafiltered,densfile);	// the real taxon IDs of each density
	fwrite(&side,sizeof(int),1,densfile);				// the size of the grid
	fwrite(&nvarstouse,sizeof(int),1,densfile);			// the number of variables
	for(k=0;k<ntaxafiltered;k++) {						// now the densities!
		fwrite(&densities[k],sizeof(DENSITY),1,densfile);	// of course, the pointer will be meaningless
		fwrite(densities[k].density,arraysize,1,densfile);
	}
	fclose(densfile);
#ifdef VERBOSE	
	for(k=3;k<4;k++) {	//ntaxafiltered
		printf("************* Taxon Nrecs: %d ************\n",densities[k].nrecords);
		switch(nvarstouse) {
			case 2:
				for(d1=0;d1<side;d1++) {
					for(d2=0;d2<side;d2++) {
							printf("%3d",densities[k].density[d1+d2*side]);
					}
					printf("\n");
				}
			break;
			
			case 3:
				for(d1=0;d1<5;d1++) {
					for(d2=0;d2<side;d2++) {
						for(d3=0;d3<side;d3++) {
							printf("%3d",densities[k].density[d1+d2*side+d3*sidesq]);
						}
						printf("\n");
					}
					printf("*****************\n");
				}
			break;
		}
		printf("********SUM: %f NRECS: %d*********\n",sum,densities[k].nrecords);
	}
	for(k=0;k<ntaxafiltered;k++) {
		for(d1=0,sum=0;d1<arraysize;d1++) sum+=(float)densities[k].density[d1]*densities[k].max/255.0;
		printf("SUM: %f NRECS: %d\n",sum,densities[k].nrecords);
	}
#endif
	
	
	fclose(varsfile);
	free(pIDs);
	free(freqs);
	free(vararray);
	free(varheader);
	free(kernel);
	free(mapIDs);
	free(tmpdens);
	for(i=0;i<ntaxafiltered;i++) free(densities[i].density);
	free(densities);
	free(outIDs);
	(*env)->ReleaseStringUTFChars(env,filename,pfilename);
	(*env)->ReleaseStringUTFChars(env,outfilename,poutfilename);
	return 1;
}

void saveKernelDensity(float *src,int nrecs,DENSITY *dst) {
// this stores the kernel density of a taxon in a 1-byte compact format, because we need to save memory
	int i;
	float max=-1,sum=0;
	dst->nrecords=nrecs;
// get the maximum value of the density
	for(i=0; i<arraysize; i++) if(src[i] > max) max = src[i];
// scale the density to 0-255 and save in uchar array
	for(i=0; i<arraysize; i++) {
		dst->density[i] = (unsigned char)(src[i] * MAXDENSITY / max);
		sum += dst->density[i] * max / (float)MAXDENSITY;
	}
	dst->max = (max < 0.0000001 ? -1 : max);
	dst->sum = sum;
	
	if(dst->max == -1) printf("[INFO] Discarded density with max %f and sum %f.\n", max, dst->sum);
}
