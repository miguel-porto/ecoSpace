#include <jni.h>
#include <stdio.h>
#include <math.h>
#include <stdlib.h>
#include <locale.h>
#include "tiff-4.0.3/libtiff/tiffio.h"
#include "econav.h"
/**
* Exports the values of all variables (TIFFs and lat long) for all coordinates in the dataset
*/
JNIEXPORT jstring JNICALL Java_pt_floraon_ecospace_nativeFunctions_exportExtractedVariables(JNIEnv *env, jclass obj, jstring filename) {
	int i, j;
	size_t dummy;
	jsize nrecs;
	jint ntaxa,*pIDs;
	jfloat *plat, *plng;
	int nvars;
	VARIABLE *vararray;
	VARIABLEHEADER *varheader;
	FILE *varsfile;

	const char *pfilename = (*env)->GetStringUTFChars(env, filename , NULL);

	{	// redirect stdout to file
		int fd;
		fpos_t pos;
		fflush(stdout);
		fgetpos(stdout, &pos);
		fd = dup(fileno(stdout));
		FILE *dummy=freopen("logfile.txt", "a", stdout);
	}

	varsfile = fopen(STANDARDVARIABLEFILE(pfilename), "r");
	dummy = fread(&nrecs, sizeof(jsize), 1, varsfile);
	dummy = fread(&ntaxa, sizeof(jint), 1, varsfile);
	dummy = fread(&nvars, sizeof(int), 1, varsfile);
	nvars += 2;		// nvars if the number of TIFFs. we add also lat long vars.
//	fseek(varsfile,nvars*sizeof(tmp.filename)+sizeof(long)*ntaxa,SEEK_CUR);
	fseek(varsfile,sizeof(long)*ntaxa,SEEK_CUR);	// skip index

	vararray = malloc(nvars*nrecs*sizeof(VARIABLE));
	varheader = malloc(nvars*sizeof(VARIABLEHEADER));
	pIDs = malloc(nrecs*sizeof(jint));	// this is the taxon IDs for each record
	plat = malloc(nrecs*sizeof(jfloat));	// this is the taxon IDs for each record
	plng = malloc(nrecs*sizeof(jfloat));	// this is the taxon IDs for each record
	
	dummy = fread(pIDs, sizeof(jint), nrecs, varsfile);
	dummy = fread(plat, sizeof(jfloat), nrecs, varsfile);
	dummy = fread(plng, sizeof(jfloat), nrecs, varsfile);
	//fseek(varsfile, 2*sizeof(jfloat)*nrecs, SEEK_CUR);	// skip original coordinates
	
	fseek(varsfile, sizeof(long)*nrecs, SEEK_CUR);	// skip weights

	for(i=0; i<nvars; i++) {
		//fseek(varsfile, (sizeof(VARIABLEHEADER) + sizeof(VARIABLE)*nrecs)*i, SEEK_CUR);
		dummy = fread(&varheader[i], sizeof(VARIABLEHEADER), 1, varsfile);
		printf("Variable %d: min %f max %f\n", i+1, varheader[i].min, varheader[i].max);
		dummy = fread(&vararray[i*nrecs], sizeof(VARIABLE), nrecs, varsfile);
	}

	// export text table
	char template[]="/tmp/variablesXXXXXX";
	int fd;
	FILE *tmpdist;
	setlocale(LC_NUMERIC, "C");

	fd = mkstemp(template);
	tmpdist=fdopen(fd,"w");
	
	fprintf(tmpdist, "ID\tlatitude\tlongitude");
	for(i=2; i<nvars; i++)
		fprintf(tmpdist, "\t%d", i-1);
	fprintf(tmpdist,"\n");
	
	VARIABLE tmp;
	for(i=0; i<nrecs; i++) {
		fprintf(tmpdist, "%d\t%f\t%f", pIDs[i], plat[i], plng[i]);
		for(j=0; j<nvars; j++) {
			tmp = vararray[j*nrecs + i];
			fprintf(tmpdist, "\t%ld", tmp == RASTERNODATA ? -1 : tmp);
		}
		fprintf(tmpdist,"\n");
	}
	fclose(tmpdist);
	
	free(vararray);
	free(varheader);
	free(pIDs);
	free(plat);
	free(plng);
	fclose(varsfile);
	fflush(stdout);

	jstring result;
	result = (*env)->NewStringUTF(env,template);
	return result;
}
