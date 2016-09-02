#include <stdint.h>
#include <stdbool.h>
#include <string.h>
#include "tiff-4.0.6/libtiff/tiffio.h"

#define MAXVARIABLES 		30
#define MAXDISTANCE			254
#define	NA_DISTANCE			255			// taxon distances are uchars. NA is for distances between taxa which have no data (bad coordinates)
#define MAXDENSITY			255			// kernel densities are scaled to 0-255 (uchars)
#define MAXLINKDISTANCE		254			// the maximum distance between two taxa that is output as a graph link
#define RASTERNODATA 		-9999
#define MULTIPLIER			100000		// we use integers whenever possible. decimal numbers are multiplied by this value

#define ANSI_COLOR_RED     "\x1b[31m"
#define ANSI_COLOR_GREEN   "\x1b[32m"
#define ANSI_COLOR_YELLOW  "\x1b[33m"
#define ANSI_COLOR_RESET   "\x1b[0m"

#define VARIABLEFILE(UID)	({fnbuf[0]=0;strcat(fnbuf,"data/vars_");strcat(fnbuf,UID);strcat(fnbuf,".bin");fnbuf;})
#define STANDARDVARIABLEFILE(UID)	({fnbuf[0]=0;strcat(fnbuf,"data/stdvars_");strcat(fnbuf,UID);strcat(fnbuf,".bin");fnbuf;})
#define VARIABLELISTFILE(UID)	({fnbuf[0]=0;strcat(fnbuf,"data/varlist_");strcat(fnbuf,UID);strcat(fnbuf,".txt");fnbuf;})
#define DENSITYFILE(UID,AID)	({fnbuf[0]=0;strcat(fnbuf,"data/dens_");strcat(fnbuf,UID);strcat(fnbuf,"_");strcat(fnbuf,AID);strcat(fnbuf,".bin");fnbuf;})
#define DISTANCEFILE(UID,AID)	({fnbuf[0]=0;strcat(fnbuf,"data/dist_");strcat(fnbuf,UID);strcat(fnbuf,"_");strcat(fnbuf,AID);strcat(fnbuf,".bin");fnbuf;})
#define FREQANALYSISFILE(UID)	({fnbuf[0]=0;strcat(fnbuf,"data/freqs_");strcat(fnbuf,UID);strcat(fnbuf,".txt");fnbuf;})

typedef long VARIABLE;

typedef struct {
	unsigned short nvars;
	unsigned long nvarrecs,maxidrec,maxident,maxnumrecs;
} VARIABLESET;

typedef struct {
	unsigned long idrec,ident,weight;
	unsigned short idvar,index;
	VARIABLE val,stdval;
} VARIABLERECORD;

struct _VARIABLEHEADER;
typedef struct _VARIABLEHEADER VARIABLEHEADER;

struct _TIFFGEOREF;
typedef struct _TIFFGEOREF TIFFGEOREF;

#ifdef _TIFFIO_
struct _TIFFGEOREF {
	VARIABLEHEADER *header;
	TIFF *tif;
	char filename[80];
    size_t npixels;
    tdata_t buf;
	float ulx,uly;
	uint32_t wid,hei;
	uint16_t bps,spp;    
	float px,py;
};
#endif

struct _VARIABLEHEADER {
	float min,max;
	unsigned int n;
	TIFFGEOREF *tif;
};

typedef struct {
	unsigned long minx,maxx,miny,maxy;
	float resx,resy;
} WINDOW;

typedef struct {
	VARIABLE v1,v2;
} VPAIR;

typedef struct {
	long x,y;
	unsigned long idrec,ident,weight;
} LONGPOINT;

typedef struct {
	unsigned int nrecords;
	float max,sum;
	unsigned char *density;
} DENSITY;

typedef struct {
	int ntaxa,*IDs,*freqs;
	unsigned char *dist;
} DISTANCE;

char fnbuf[150];

unsigned int readTiffFiles(char *directory,TIFFGEOREF *tiffiles,VARIABLEHEADER *headers);
