// Adapted from makepng.c distributed with libpng
// gcc -O3 -o get-density-png -B lpng1614 get-density-png.c build-kernel.c -lpng -lm -lz 
#define _ISOC99_SOURCE /* for strtoull */
#include "/usr/lib/jvm/java-7-openjdk-amd64/include/jni.h"
#include "tiff-4.0.3/libtiff/tiffio.h"
#include "econav.h"
#include <stddef.h> /* for offsetof */
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <ctype.h>
#include <math.h>
#include <errno.h>

float* buildKernel(int side,float sigma,int dimension,int *outkernelhalfside,int *outkernelside,int *outkernelsidesq);
unsigned char red=0,green=120,blue=255;
int nclasses=2;

#if defined(HAVE_CONFIG_H) && !defined(PNG_NO_CONFIG_H)
#  include <config.h>
#endif

/* Define the following to use this test against your installed libpng, rather
 * than the one being built here:
 */
#ifdef PNG_FREESTANDING_TESTS
#  include <png.h>
#else
#  include "lpng1614/png.h"
#endif
/*
static void set_value(png_bytep row, size_t rowbytes, png_uint_32 x, png_uint_32 value) {
	int bit_depth=8;
	x *= 8;
	png_uint_32 offset = x >> 3;
	if(value>255) value=255;

	if (offset < rowbytes && (bit_depth < 16 || offset+1 < rowbytes)) {
		row += offset;
		*row = value;
	} else {
		fprintf(stderr, "makepng: row buffer overflow (internal error)\n");
		exit(1);
	}
}
*/

static void set_RGBA(png_bytep row,size_t rowbytes,png_uint_32 x,unsigned char r,unsigned char g,unsigned char b,unsigned char a) {
/*	x *= 8; 
	png_uint_32 offset = x >> 3;*/
	if (x < rowbytes) {
		row += x;
		*row = r;
		*(row+1) = g;
		*(row+2) = b;
		*(row+3) = a;
	} else {
		fprintf(stderr, "makepng: row buffer overflow (internal error)\n");
		exit(1);
	}
}

static void PNGCBAPI makepng_warning(png_structp png_ptr, png_const_charp message) {
   const char **ep = png_get_error_ptr(png_ptr);
   const char *name;

   if (ep != NULL && *ep != NULL)
      name = *ep;

   else
      name = "makepng";

  fprintf(stderr, "%s: warning: %s\n", name, message);
}

static void PNGCBAPI makepng_error(png_structp png_ptr, png_const_charp message) {
   makepng_warning(png_ptr, message);
   png_longjmp(png_ptr, 1);
}

static int /* 0 on success, else an error code */
write_png(unsigned char *dens,const char **name, FILE *fp, int color_type, int bit_depth,int width,int height,volatile png_fixed_point gamma,unsigned int filters, unsigned int *colors) {
	png_structp png_ptr = png_create_write_struct(PNG_LIBPNG_VER_STRING, name, makepng_error, makepng_warning);
	volatile png_infop info_ptr = NULL;
	volatile png_bytep row = NULL;
	png_bytep tmp;
	unsigned int i;

	if (png_ptr == NULL) {
		fprintf(stderr, "makepng: OOM allocating write structure\n");
		return 1;
	}

	if (setjmp(png_jmpbuf(png_ptr))) {
		png_structp nv_ptr = png_ptr;
		png_infop nv_info = info_ptr;

		png_ptr = NULL;
		info_ptr = NULL;
		png_destroy_write_struct(&nv_ptr, &nv_info);
		if (row != NULL) free(row);
		return 1;
	}

	/* Allow benign errors so that we can write PNGs with errors */
	png_set_benign_errors(png_ptr, 1/*allowed*/);
	png_init_io(png_ptr, fp);

	info_ptr = png_create_info_struct(png_ptr);
	if (info_ptr == NULL) png_error(png_ptr, "OOM allocating info structure");


	png_set_IHDR(png_ptr, info_ptr, width, height, bit_depth, color_type, PNG_INTERLACE_NONE, PNG_COMPRESSION_TYPE_BASE, PNG_FILTER_TYPE_BASE);

	if (gamma == PNG_DEFAULT_sRGB) png_set_sRGB(png_ptr, info_ptr, PNG_sRGB_INTENT_ABSOLUTE);

	/* Write the file header. */
	png_write_info(png_ptr, info_ptr);

	/* Restrict the filters */
	png_set_filter(png_ptr, PNG_FILTER_TYPE_BASE, filters);

	int passes = png_set_interlace_handling(png_ptr);
	int pass;
	png_size_t rowbytes = png_get_rowbytes(png_ptr, info_ptr);

	row = malloc(rowbytes);
	if (row == NULL) png_error(png_ptr, "OOM allocating row buffer");

	unsigned int y,x;
	for (pass = 0; pass < passes; ++pass) {
		for (y=0; y<height; ++y) {		
			for (x=0,tmp=row; x<width; ++x,tmp+=4) {
//				set_RGBA(row,rowbytes,4*x,dens[x+y*width],0,0,255);
//				set_RGBA(row,rowbytes,4*x,255,0,0,dens[x+y*width]==0 ? 255 : 100);
				*tmp = red;
				*(tmp+1) = green;
				*(tmp+2) = blue;
				*(tmp+3) = dens[x+y*width];		// alpha
/*				if(nclasses==1)
					*(tmp+3) = dens[x+y*width];		// alpha
				else
					*(tmp+3) = (dens[x+y*width]>>(8-nclasses))<<(8-nclasses);		// alpha*/
			}
			png_write_row(png_ptr, row);
		}
	}

	/* Finish writing the file. */
	png_write_end(png_ptr, info_ptr);


	png_structp nv_ptr = png_ptr;
	png_infop nv_info = info_ptr;

	png_ptr = NULL;
	info_ptr = NULL;
	png_destroy_write_struct(&nv_ptr, &nv_info);

	free(row);
	return 0;
}


int main(int argc, char **argv) {
/*
	Arguments:
	- path to the variable file (vars_xxxxxx.bin)
	- X dimension of the output PNG
	- Y dimension of the output PNG
	- variable for x axis (0=lat, 1=long, 2... n other vars)
	- variable for y axis (0=lat, 1=long, 2... n other vars)
	- margin of the map, in % from the X and Y dimensions
	- sigma (in % of total width) of the gaussian kernel
	- red
	- green
	- blue
	- number of classes
	- any number of taxon IDs separated by spaces
*/
	if(argc<2) return 1;
	FILE *varsfile=fopen(argv[1],"rb");
	jsize nrecs;
	jint ntaxa,*pIDs;
	int nfiles,dummy,vars[]={atoi(argv[4]),atoi(argv[5])},i,nvars,j;
	int Xres=atoi(argv[2]),Yres=atoi(argv[3]);
	float margin=atof(argv[6]),sigmapercent=atof(argv[7]);
	nclasses=atoi(argv[11]);
	int ntIDs=argc-12;
	int *tIDs=malloc(sizeof(int)*ntIDs);
	unsigned long *indID,*weight;
	VARIABLE *vararray;
	VARIABLEHEADER vhead[2];
	
	red=(unsigned char)atoi(argv[8]);
	green=(unsigned char)atoi(argv[9]);
	blue=(unsigned char)atoi(argv[10]);
	
	for(i=0;i<ntIDs;i++) tIDs[i]=atoi(argv[i+12]);
	
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
	weight=malloc(sizeof(long)*nrecs);
	dummy=fread(weight,sizeof(long),nrecs,varsfile);

	vararray=malloc(2*nrecs*sizeof(VARIABLE));
	for(i=0;i<2;i++) {	// read the two variables that we want
		fseek(varsfile,(sizeof(VARIABLEHEADER) + sizeof(VARIABLE)*nrecs)*(vars[i]-(i==0 ? 0 : (vars[i-1]+1))),SEEK_CUR);
		dummy=fread(&vhead[i],sizeof(VARIABLEHEADER),1,varsfile);
//		printf("Variable %d: min %f max %f\n",i,vhead[i].min,vhead[i].max);
		dummy=fread(&vararray[i*nrecs],sizeof(VARIABLE),nrecs,varsfile);
	}

//	for(i=0;i<nrecs;i++) printf("%d %ld %ld; ",pIDs[i],vararray[i],vararray[i+nrecs]);

// start calculations
	int kernelhalfside,kernelside,kernelsidesq;
	float *kernel=buildKernel(Xres,sigmapercent*Xres,2,&kernelhalfside,&kernelside,&kernelsidesq);
	
	float *dens=malloc(Xres*Yres*sizeof(float));		// 2D array to make the calculations
	memset(dens,0,Xres*Yres*sizeof(float));
	float factorx=((float)Xres*(1.-margin*2))/10000.f
		,factory=((float)Yres*(1.-margin*2))/10000.f,maxd=0;
	int offset[2]={(int)((float)Xres*margin),(int)((float)Yres*margin)};
	int x,y,len=Xres*Yres;
	int d1to,d1from,d2to,d2from,d1kern,d2kern,d1,d2,d2p;
			
	if(ntIDs==0) {	// we want all records
		int step=nrecs>>17;
		if(step<1) step=1;
		for(i=0;i<nrecs;i+=step) {	// record loop	NOTE: for prformance reasons, this is just approximate, so we increment "step" here.
			x=(int)(vararray[i]*factorx)+offset[0];
			y=Yres-(int)(vararray[i+nrecs]*factory)-1-offset[1];
		
			d1from=(x-kernelhalfside)<0 ? 0 : (x-kernelhalfside);
			d1to=x+kernelhalfside+1>Xres ? Xres : (x+kernelhalfside+1);
			d2from=(y-kernelhalfside)<0 ? 0 : (y-kernelhalfside);
			d2to=y+kernelhalfside+1>Yres ? Yres : (y+kernelhalfside+1);
		
			for(d1=d1from,d1kern=x-kernelhalfside<0 ? (kernelhalfside-x) : 0;d1<d1to;d1++,d1kern++) {
				for(d2=d2from,d2p=d1+d2from*Xres,d2kern=d1kern+((y-kernelhalfside)<0 ? (kernelhalfside-y)*kernelside : 0);d2<d2to;d2++,d2p+=Xres,d2kern+=kernelside) {
					dens[d2p]+=kernel[d2kern];
//					dens[d2p]+=kernel[d2kern] * ((float)weight[i]/MULTIPLIER);
//					dens[d2p]=dens[d2p] > kernel[d2kern] ? dens[d2p] : kernel[d2kern];
				}
			}
		}
	} else {	// if more than one ID, merge together all IDs
		for(j=0;j<ntIDs;j++) {	// taxon loop
			for(i=indID[tIDs[j]];pIDs[i]==tIDs[j];i++) {	// record loop
				x=(int)(vararray[i]*factorx)+offset[0];
				y=Yres-(int)(vararray[i+nrecs]*factory)-1-offset[1];
			
				d1from=(x-kernelhalfside)<0 ? 0 : (x-kernelhalfside);
				d1to=x+kernelhalfside+1>Xres ? Xres : (x+kernelhalfside+1);
				d2from=(y-kernelhalfside)<0 ? 0 : (y-kernelhalfside);
				d2to=y+kernelhalfside+1>Yres ? Yres : (y+kernelhalfside+1);
			
				for(d1=d1from,d1kern=x-kernelhalfside<0 ? (kernelhalfside-x) : 0;d1<d1to;d1++,d1kern++) {
					for(d2=d2from,d2p=d1+d2from*Xres,d2kern=d1kern+((y-kernelhalfside)<0 ? (kernelhalfside-y)*kernelside : 0);d2<d2to;d2++,d2p+=Xres,d2kern+=kernelside) {
						dens[d2p]+=kernel[d2kern] * ((float)weight[i]/MULTIPLIER);
	//					dens[d2p]+=kernel[d2kern];
	//					dens[d2p]=dens[d2p] > kernel[d2kern] ? dens[d2p] : kernel[d2kern];
					}
				}
			
	//			dens[x+y*Xres]++;
			}
		}
	}
	
// transform and get maximum, so to scale colors
	for(x=0;x<len;x++) {
		dens[x]=pow(dens[x],0.33333f);	// apply a sqrt to reduce the influence of aggregated records
		if(dens[x]>maxd) maxd=dens[x];
	}

	unsigned char *outdens=malloc(len);
	if(nclasses<=2)
		for(x=0;x<len;x++) {outdens[x]=(unsigned char)((dens[x]/maxd) > 0.3 ? 255 : 0);}
	else
		for(x=0;x<len;x++) {outdens[x]=(unsigned char)( floor((dens[x]/maxd)*(float)nclasses)*(255.f/(float)nclasses) );}
		//for(x=0;x<len;x++) {outdens[x]=(unsigned char)((dens[x]/maxd)*255);}
	
/*	for(y=0;y<Yres;y++) {
		for(x=0;x<Xres;x++) printf("%02d",(int)dens[x+y*Xres]);
		printf("\n");
	}
*/
	
	FILE *fp = stdout;
	const char *file_name = NULL;
	unsigned int colors[5];
	unsigned int filters = PNG_ALL_FILTERS;
	int color_type,bit_depth;
	png_fixed_point gamma;
 
	memset(colors, 0, sizeof colors);

	gamma = PNG_DEFAULT_sRGB;
	color_type = PNG_COLOR_TYPE_RGB_ALPHA;
	bit_depth=8;
	//filters &= ~(PNG_FILTER_NONE | PNG_FILTER_AVG);
	filters = PNG_FILTER_NONE;

	int ret = write_png(outdens,&file_name, fp, color_type, bit_depth,Xres,Yres, gamma, filters, colors);
	if (ret != 0 && file_name != NULL) remove(file_name);
	
	free(kernel);
	free(outdens);
	free(tIDs);
	free(dens);
	fclose(varsfile);
	free(indID);
	free(pIDs);
	free(vararray);
	return ret;
}

