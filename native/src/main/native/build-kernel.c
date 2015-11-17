#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#define SQRT2PI				2.506628f
#define DISCARDKERNELTHRESH	0.0005

float* buildKernel(int side,float sigma,int dimension,int *outkernelhalfside,int *outkernelside,int *outkernelsidesq) {
// compute the n-dimensional gaussian kernel with the same side
	int i,kernellength,d1,d2,kernelhalfside,kernelside,kernelsidesq;
	float *kernel,sum=0;
	register int d3;
	unsigned long hyp;
// first, make a 1-D trial to compute the size of the kernel window (discard very low kernel values)
	kernel=malloc(side*sizeof(float));
	for(i=0;i<side;i++) {
		kernel[i]=(1/(sigma*SQRT2PI))*exp(-(i*i)/(2*sigma*sigma));		// use the array just for temporary calculations here
	}
	for(i=0;i<side && kernel[i]>DISCARDKERNELTHRESH;i++) {}		// size of the kernel window (discard very low values)
	kernelhalfside=i;
	kernelside=kernelhalfside*2+1;
	kernelsidesq=kernelside*kernelside;
	free(kernel);
// now go for real n-D kernel
	kernellength=(int)pow(kernelside,dimension);
	kernel=malloc(kernellength*sizeof(float));		// this is a N-dimensional array

//	printf("Kernel window side: %d cells (%d%% of total)\n",kernelside,(int)(((float)kernelside/side)*100));
	switch(dimension) {
		case 1:
			for(d1=0,sum=0;d1<kernelside;d1++) {
				hyp=(d1-kernelhalfside)*(d1-kernelhalfside);
				kernel[d1]=(1/(sigma*SQRT2PI))*exp(-hyp/(2*sigma*sigma));
				sum+=kernel[d1];
			}
			break;
		case 2:
			for(d1=0,sum=0;d1<kernelside;d1++) {
				for(d2=0;d2<kernelside;d2++) {
					hyp=(d1-kernelhalfside)*(d1-kernelhalfside) + (d2-kernelhalfside)*(d2-kernelhalfside);
					kernel[d1+d2*kernelside]=(1/(sigma*SQRT2PI))*exp(-hyp/(2*sigma*sigma));
					sum+=kernel[d1+d2*kernelside];
				}
			}
#ifdef VERBOSE
			for(d1=0;d1<kernelside;d1++) {
				for(d2=0;d2<kernelside;d2++) printf("%2d ",(int)(kernel[d1+d2*kernelside]*100));
				printf("\n");
			}
#endif
		break;
		
		case 3:
			for(d1=0,sum=0;d1<kernelside;d1++) {
				for(d2=0;d2<kernelside;d2++) {
					for(d3=0;d3<kernelside;d3++) {
						hyp=(d1-kernelhalfside)*(d1-kernelhalfside) + (d2-kernelhalfside)*(d2-kernelhalfside) + (d3-kernelhalfside)*(d3-kernelhalfside);
						kernel[d1+d2*kernelside+d3*kernelsidesq]=(1/(sigma*SQRT2PI))*exp(-hyp/(2*sigma*sigma));
						sum+=kernel[d1+d2*kernelside+d3*kernelsidesq];
					}
				}
			}		
#ifdef VERBOSE
			for(d1=0;d1<kernelside;d1++) {
				for(d2=0;d2<kernelside;d2++) {
					for(d3=0;d3<kernelside;d3++) {
						printf("%2d ",(int)(kernel[d1+d2*kernelside+d3*kernelsidesq]));
					}
					printf("\n");
				}
				printf("************************\n");
			}
			printf("***********SUM %f*************\n",sum);
#endif
		break;
	}

// kernel values must sum to unity
	for(d1=0;d1<kernellength;d1++) kernel[d1]/=sum;

	*outkernelhalfside=kernelhalfside;
	*outkernelside=kernelside;
	*outkernelsidesq=kernelsidesq;
	return kernel;
}

	/*
sum=0;
			for(d1=0;d1<kernelside;d1++) {
				for(d2=0;d2<kernelside;d2++) {
					for(d3=0;d3<kernelside;d3++) {
						sum+=kernel[d1+d2*kernelside+d3*kernelsidesq];
						printf("%2d ",(int)(kernel[d1+d2*kernelside+d3*kernelsidesq]));
					}
					printf("\n");
				}
				printf("************************\n");
			}
			printf("***********SUM %f*************\n",sum);
*/

