#include <stdio.h>
#include <string.h>
#include <dirent.h>
#include <stdlib.h>
#include <unistd.h>
#include <locale.h>
#include "./tiff-4.0.3/libtiff/tiffio.h"
#include "econav.h"

unsigned int readTiffFiles(char *directory,TIFFGEOREF *tiffiles,VARIABLEHEADER *headers) {
	setlocale(LC_NUMERIC, "C");
	DIR *dir;
	FILE *worldfile;
	struct dirent *ent;
	unsigned int nfiles,errors=0,n;
	char buf[200];
	float tmp1,tmp2,tmp3;
	// scan directory for TIF files and get their names
	if((dir = opendir(directory)) != NULL) {
		nfiles=0;
		while ((ent = readdir (dir)) != NULL) {
			if(strcmp(&ent->d_name[strlen(ent->d_name)-4],".tif")==0) {
				if(headers) {
//						headers[nfiles].idvar=atoi(buf);
					headers[nfiles].tif=&tiffiles[nfiles];
				}
				strcpy(buf,directory);
				strcat(buf,ent->d_name);
				buf[strlen(buf)-4]=0;
				strcat(buf,".tfw");

				if(access(buf,F_OK)==-1)
					printf("Missing .tfw file for %s, ignoring tif.\n",ent->d_name);
				else {	// read world file to get pixel size and UL coords
					strcpy(tiffiles[nfiles].filename,ent->d_name);
					worldfile=fopen(buf,"r");
					n=fscanf(worldfile,"%f %f %f %f %f %f",&tiffiles[nfiles].px,&tmp1,&tmp1,&tiffiles[nfiles].py,&tmp2,&tmp3);
					tiffiles[nfiles].py=-tiffiles[nfiles].py;
					tiffiles[nfiles].ulx=tmp2-tiffiles[nfiles].px/2;
					tiffiles[nfiles].uly=tmp3+tiffiles[nfiles].py/2;
					fclose(worldfile);
					// open TIFF file and get sizes etc.						
					memset(buf,0,200);
					strcat(buf,directory);
					strcat(buf,tiffiles[nfiles].filename);
					tiffiles[nfiles].tif=TIFFOpen(buf,"r");
					printf("*************************\nFile %s\n",buf);
					TIFFGetField(tiffiles[nfiles].tif,TIFFTAG_IMAGEWIDTH, &tiffiles[nfiles].wid);
					TIFFGetField(tiffiles[nfiles].tif,TIFFTAG_IMAGELENGTH, &tiffiles[nfiles].hei);
					TIFFGetField(tiffiles[nfiles].tif,TIFFTAG_BITSPERSAMPLE,&tiffiles[nfiles].bps);
					TIFFGetField(tiffiles[nfiles].tif,TIFFTAG_SAMPLESPERPIXEL,&tiffiles[nfiles].spp);

					tiffiles[nfiles].npixels=tiffiles[nfiles].wid*tiffiles[nfiles].hei;
					tiffiles[nfiles].buf=_TIFFmalloc(TIFFScanlineSize(tiffiles[nfiles].tif));
					printf("%d x %d x %d bps x %d spp, upper left: %f %f\nScale: %f %f\n",tiffiles[nfiles].wid,tiffiles[nfiles].hei,tiffiles[nfiles].bps,tiffiles[nfiles].spp,tiffiles[nfiles].ulx,tiffiles[nfiles].uly,tiffiles[nfiles].px,tiffiles[nfiles].py);
					if(tiffiles[nfiles].bps!=8 && tiffiles[nfiles].bps!=16) {puts(ANSI_COLOR_RED"Bits per sample not supported"ANSI_COLOR_RESET);errors++;}
					if(tiffiles[nfiles].spp!=1) {puts(ANSI_COLOR_RED"Samples per pixel>1 not supported"ANSI_COLOR_RESET);errors++;}

					nfiles++;
				}
			}
		}
		closedir(dir);
	} else {
		perror(directory);
		return 0;
	}
	if(errors) {printf("%d errors, cannot continue.\n",errors);return 0;}
	return nfiles;
}

