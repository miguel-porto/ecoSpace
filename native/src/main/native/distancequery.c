#include <jni.h>
#include <stdio.h>
#include <math.h>
#include <stdlib.h>
#include <locale.h>
#include <errno.h>
#include <unistd.h>
#include "econav.h"
#define CLUSTERBUFSIZE	15
/*
	This needs refactoring!!!
	I think there may be some memory leaks out there that may occur in particular (but very rare) situations
	
	Compiling:
	gcc -fPIC -O3 -o libecoSpace.so -shared -I/usr/lib/jvm/java-7-openjdk-amd64/include -B tiff-4.0.3/libtiff/.libs extract-vars.c distancequery.c distances.c readtiffs.c kernel-dens.c build-kernel.c -lc -ltiff
*/

typedef struct {
	int srcid,tarid;
	float similarity;
	bool bidirectional;
} LINK;

typedef struct {
	int nlinks;
	LINK *links;
} LINKS;

typedef struct {
	int nnodes;
	int *nodes,*level,*abundance;
} NODES;

void findRelatedTaxa(int taxpos,int taxAbundance, int howmanyNeigh,DISTANCE *dist,unsigned char *distance,NODES *outnodes,LINKS *outlinks,int level,bool onlyexisting);
int linkAlreadyExists(int node1,int node2,LINKS *linkarray);
static int numOutputLinks=100,outBufferSize=100000;
static long numOutputNodes;
/**
* Pushes or updates a node to the output stack. When updating, its abundance is increased by abund.
*/
bool PUSHNODE(int tpos, int level, int abund, NODES *nodes, bool onlyexisting) {
	bool exists;
	void *tmppointer;
	int i;
	for(i=0, exists=false; i<nodes->nnodes; i++) {
		if(nodes->nodes[i] == tpos) {exists=true;break;}
	}
	if(onlyexisting && !exists) return false;	// forget node, we can't add it
	
	if(!exists && nodes->nnodes >= numOutputNodes) {
		numOutputNodes += 20;
		if((tmppointer=realloc(nodes->nodes,sizeof(int)*numOutputNodes)))
			nodes->nodes=tmppointer;
		else error("Some error reallocating");

		if((tmppointer=realloc(nodes->abundance,sizeof(int)*numOutputNodes)))
			nodes->abundance=tmppointer;
		else error("Some error reallocating");
	
		if((tmppointer=realloc(nodes->level,sizeof(int)*numOutputNodes)))
			nodes->level=tmppointer;
		else error("Some error reallocating");
	
		printf("Increased buffer for nodes, %d %ld\n",nodes->nnodes,numOutputNodes);
		
		i = nodes->nnodes;
	}

	if(!exists) {
		nodes->nodes[i] = tpos;
		nodes->level[i] = level;
		nodes->abundance[i] = abund;
		nodes->nnodes++;
	} else {
		nodes->level[i] = (level < nodes->level[i] ? level : nodes->level[i]);	// the mininum level is kept
		nodes->abundance[i] += abund;
	}
	return true;
}

JNIEXPORT jlongArray JNICALL Java_pt_floraon_ecospace_nativeFunctions_openDistanceMatrix(JNIEnv *env, jclass obj, jstring dID, jstring aID) {
	const char *pdID=(*env)->GetStringUTFChars(env, dID , NULL );
	const char *paID=(*env)->GetStringUTFChars(env, aID , NULL );
	FILE *distfile=fopen(DISTANCEFILE(pdID,paID),"r");
	size_t dummy;
	DISTANCE *dist=malloc(sizeof(DISTANCE));
	if(!distfile) return(0);
	dummy=fread(&dist->ntaxa,sizeof(int),1,distfile);
	dist->IDs=malloc(dist->ntaxa*sizeof(int));
	dist->freqs=malloc(dist->ntaxa*sizeof(int));
	dummy=fread(dist->IDs,sizeof(int),dist->ntaxa,distfile);
	dummy=fread(dist->freqs,sizeof(int),dist->ntaxa,distfile);
	dist->dist=malloc(sizeof(char)*dist->ntaxa*dist->ntaxa);
	dummy=fread(dist->dist,sizeof(char),dist->ntaxa*dist->ntaxa,distfile);


	fclose(distfile);
	(*env)->ReleaseStringUTFChars(env,dID,pdID);
	(*env)->ReleaseStringUTFChars(env,aID,paID);

/*	for(i=0;i<dist->ntaxa;i++) {
		for(j=0;j<dist->ntaxa;j++) {
			printf("%c ",48+(char)((float)dist->dist[i+j*dist->ntaxa]/255*10));
		}
		printf("\n");
	}	*/
	
/*	free(dist->dist);
	free(dist->IDs);
	free(dist);*/
	jlongArray result;
	result = (*env)->NewLongArray(env, 2);
	if (result == NULL) return NULL;
	jlong fill[2];
	fill[0]=(jlong)dist;
	fill[1]=sizeof(char)*dist->ntaxa*dist->ntaxa;
	(*env)->SetLongArrayRegion(env, result, 0, 2, fill);
	return result;

//	return((jlong)dist);
}

JNIEXPORT jstring JNICALL Java_pt_floraon_ecospace_nativeFunctions_exportDistanceMatrix(JNIEnv *env, jclass obj, jlong ptr) {
	DISTANCE *dist=(DISTANCE*)ptr;
	char template[]="/tmp/distXXXXXX",idfile[]="/tmp/idfiXXXXXX";
	int fd,i,j;
	FILE *tmpdist,*tmpids;
	setlocale(LC_NUMERIC, "C");
	
	fd=mkstemp(template);

	strcpy(&idfile[9],&template[9]);
		
	tmpdist=fdopen(fd,"w");
	for(i=0;i<dist->ntaxa;i++) {
		for(j=0;j<dist->ntaxa;j++) {
//			fprintf(tmpdist,"%f",(float)dist->dist[i*dist->ntaxa + j]/MAXDISTANCE);
			fprintf(tmpdist,"%d",dist->dist[i*dist->ntaxa + j]);
			if(j<dist->ntaxa-1) fprintf(tmpdist,"\t");
		}
		fprintf(tmpdist,"\n");
	}
	fclose(tmpdist);

	tmpids=fopen(idfile,"w");
	for(i=0;i<dist->ntaxa;i++)
		fprintf(tmpids,"%d\t",dist->IDs[i]);
		
	fprintf(tmpids,"\n");
	fclose(tmpids);
	
	jstring result;
	result = (*env)->NewStringUTF(env,template);
	return result;

}

JNIEXPORT jint JNICALL Java_pt_floraon_ecospace_nativeFunctions_closeDistanceMatrix(JNIEnv *env, jclass obj, jlong ptr) {
	DISTANCE *dist=(DISTANCE*)ptr;
/*	int i;
	printf("NT %d\n",dist->ntaxa);
	for(i=0;i<dist->ntaxa;i++) printf("%d: %d\n",dist->IDs[i],dist->freqs[i]);
	printf("\n========\n");*/
	free(dist->dist);
	free(dist->IDs);
	free(dist->freqs);
	free(dist);
	return 0;
}

void findRelatedTaxa(int basetax,int taxAbundance,int howmanyNeigh, DISTANCE *dist,unsigned char *distance,NODES *nodes,LINKS *outlinks,int level,bool onlyexisting) {
	int which,offset,mind=0,k,j,noadd,i;
	void *tmppointer;
	bool exists;
	offset=basetax*dist->ntaxa;

	for(k=0;k<howmanyNeigh;k++) {
//	while(k<howmanyNeigh) {
		mind=NA_DISTANCE+1;
		which=-1;
		for(j=0;j<dist->ntaxa;j++) {	// search for the taxon with the lowest distance
			if(j!=basetax && distance[j+offset]<mind && distance[j+offset]!=NA_DISTANCE) {
				mind=distance[j+offset];
				which=j;
			}
		}
		if(which==-1 || mind>MAXLINKDISTANCE) break;
		
		exists = PUSHNODE(which, level, taxAbundance, nodes, onlyexisting);

		if(onlyexisting && !exists) continue;
		
		int laa=linkAlreadyExists(basetax,which,outlinks);
		float similarity = (1.0f-(float)distance[which+offset]/MAXDISTANCE) * (float)taxAbundance;
		if(laa>-1) {
			outlinks->links[laa].bidirectional=true;
			outlinks->links[laa].similarity =			// set the similarity to the largest similarity of the two.
				(outlinks->links[laa].similarity > similarity ? outlinks->links[laa].similarity : similarity);
		} else {
			if(outlinks->nlinks >= numOutputLinks) {
				numOutputLinks+=1000;
				if((tmppointer=realloc(outlinks->links,sizeof(LINK)*numOutputLinks)))
					outlinks->links=tmppointer;
				else error("Some error reallocating");
				printf("Increased buffer for links\n");
			}
		
			outlinks->links[outlinks->nlinks].srcid = basetax;
			outlinks->links[outlinks->nlinks].tarid = which;
			outlinks->links[outlinks->nlinks].similarity = 9999;//similarity;
			outlinks->links[outlinks->nlinks].bidirectional = false;
			outlinks->nlinks++;
		}
		distance[which+offset] = NA_DISTANCE;	// mark this node so that it won't be repeated within this expansion loop
	}
}


int linkAlreadyExists(int node1,int node2,LINKS *linkarray) {
	int i;
	for(i=0;i<linkarray->nlinks;i++) {
		if((linkarray->links[i].srcid == node1 && linkarray->links[i].tarid == node2) || (linkarray->links[i].srcid == node2 && linkarray->links[i].tarid == node1)) return i;
	}
	return -1;
}

/*
	Gets the relationships between all nodes that are passed.
	taxID: internal taxon IDs to load
	
*/
JNIEXPORT jstring JNICALL Java_pt_floraon_ecospace_nativeFunctions_getRelationships(JNIEnv *env, jclass obj, jlong ptr, jintArray taxID, jintArray abund, jint nlevels, jint maxperlevel, jboolean loadsecondarylinks, jboolean makeClusters) {

	char buf[1000];
	char *out=malloc(outBufferSize);
	void *tmppointer;
	jstring result;
	bool all=false;
/*	if(!loadsecondarylinks && nlevels<1) {
		strcpy(out,"{\"success\":true,\"nodes\":[],\"links\":[]}");
		result = (*env)->NewStringUTF(env,out);
		return result;
	}*/
	DISTANCE *dist=(DISTANCE*)ptr;
	jint *tid = (*env)->GetIntArrayElements(env, taxID, 0);
	jint *tab = (*env)->GetIntArrayElements(env, abund, 0);
	jsize lenquery = (*env)->GetArrayLength(env, taxID);
	if(lenquery>0 && tid[0]==-1) {
		lenquery=dist->ntaxa;		// special case: -1 means to query all species
		nlevels=0;
		loadsecondarylinks=true;
		all=true;
	}
	int i,j,taxpos,taxabund;
	NODES nodes;
	LINKS links;
	unsigned char *distance=malloc(sizeof(char)*dist->ntaxa*dist->ntaxa);	// must create a copy of original distance matrix to work
	unsigned char *cluster;
	float *flow;
	setlocale(LC_NUMERIC, "C");	

	{	// redirect stdout to file
		int fd;
		fpos_t pos;
		fflush(stdout);
		fgetpos(stdout, &pos);
		fd = dup(fileno(stdout));
		FILE *dummy=freopen("logfile.txt", "a", stdout);
	}

	numOutputNodes=(maxperlevel<1) ? lenquery : ( (nlevels<1) ? lenquery : ((long)pow(maxperlevel,nlevels)*lenquery+lenquery) );
	if(numOutputNodes>20000 && nlevels>0) numOutputNodes=20000;
	nodes.nodes=malloc(sizeof(int)*numOutputNodes);
	if(!nodes.nodes) {printf("Error allocating memory for %ld nodes\n",numOutputNodes);fflush(stdout);return (*env)->NewGlobalRef(env, NULL);}
	nodes.abundance=malloc(sizeof(int)*numOutputNodes);
	if(!nodes.abundance) {printf("Error allocating memory for %ld abundances\n",numOutputNodes);fflush(stdout);return (*env)->NewGlobalRef(env, NULL);}
	nodes.level=malloc(sizeof(int)*numOutputNodes);
	if(!nodes.level) {free(nodes.nodes);free(nodes.abundance);printf("Error allocating memory for %ld nodes\n",numOutputNodes);fflush(stdout);return (*env)->NewGlobalRef(env, NULL);}
	links.links=malloc(sizeof(LINK)*numOutputLinks);
	nodes.nnodes=0;
	links.nlinks=0;
	
	printf("Memory OK, allocated space for %d nodes.\n",numOutputNodes);
	printf("This is the abundance version.\n");
	printf("The first abundances are: %d %d %d %d\n",tab[0],tab[1],tab[2],tab[3]);
	fflush(stdout);
// search for the position of each taxon ID
	if(all) {
		for(i=0;i<dist->ntaxa;i++) {	// push all valid nodes
			if(dist->IDs[i]>0) PUSHNODE(i, 0, 1, &nodes, false);
		}
	} else {
		for(i=0;i<lenquery;i++) {
			for(taxpos=0;taxpos<dist->ntaxa;taxpos++) {
				if(dist->IDs[taxpos]==(int)tid[i]) break;
			}
			if(taxpos==dist->ntaxa) continue;	// taxID not found
			PUSHNODE(taxpos, 0, tab[i], &nodes, false);		// push into output node stack
		}
	}
	
	if(nodes.nnodes==0) {
		strcpy(out,"{\"success\":true,\"nodes\":[],\"links\":[]}");
		result = (*env)->NewStringUTF(env,out);

		(*env)->ReleaseIntArrayElements(env, taxID, tid, 0);
		(*env)->ReleaseIntArrayElements(env, abund, tab, 0);
		free(nodes.nodes);
		free(nodes.abundance);
		free(nodes.level);
		free(links.links);
		free(distance);
		return result;
	}
//	for(i=0;i<nodes.nnodes;i++) printf("%d\n",nodes.nodes[i]);

	if(maxperlevel>0) {	// node expansion loop
		memcpy(distance,dist->dist,sizeof(char)*dist->ntaxa*dist->ntaxa);
	
		int counter=1;
		taxpos = nodes.nodes[0];
		taxabund = nodes.abundance[0];
		do {
			if(nodes.level[counter-1]+1 <= (int)nlevels)	// explode: the children of this node will still be inside the max nr of levels
				findRelatedTaxa(taxpos, taxabund,maxperlevel,dist,distance,&nodes,&links,nodes.level[counter-1]+1,false);
			else {
				if(loadsecondarylinks) findRelatedTaxa(taxpos, taxabund,maxperlevel,dist,distance,&nodes,&links,nodes.level[counter-1]+1,true);
			}
			taxpos = nodes.nodes[counter];	// move on to the next node
			taxabund = nodes.abundance[counter];
			counter++;
		} while(counter-1<nodes.nnodes);
	}
//int mind,offset;

	bool clusters_computed = makeClusters && maxperlevel>0 && links.nlinks>0;
//	clusters_computed=false;

	if(clusters_computed) {
// find clusters with Infomap
		int tmpfd;
		char template2[100];
		memset(template2,0,100);
		strcpy(template2,"/tmp/treeXXXXXX");
		FILE *treeout=0;
		int count=0;
		do {
			tmpfd=mkstemp(template2);
			if(tmpfd!=-1) {
				printf("%s ********************\n",template2);
				treeout=fdopen(tmpfd,"wx");
				if(!treeout) {
					memset(template2,0,100);
					strcpy(template2,"/tmp/treeXXXXXX");
					count++;
				}
			} else {
				printf("Error creating tempfile: %d\n",errno);
				memset(template2,0,100);
				strcpy(template2,"/tmp/treeXXXXXX");
				count++;
			}
		} while(!treeout && count<15);

		int maxid=0;
		printf("EXPORTING\n# nodes: %d\n", nodes.nnodes);
		for(j=0;j<nodes.nnodes;j++) {
			if(nodes.nodes[j]>maxid) maxid=nodes.nodes[j];
		}
		int *dic=malloc(sizeof(int)*(maxid+1));
		
		if(!dic || count==15) {
			printf("Some ERROR on dic");	
			fclose(treeout);
			clusters_computed=false;
			goto abort;
		}
		
		fprintf(treeout,"*Vertices %d\n",nodes.nnodes);
		for(j=0;j<nodes.nnodes;j++) {
			fprintf(treeout,"%d \"%d\"\n",j+1,dist->IDs[nodes.nodes[j]]);
			//printf("%d \"%d\"\n",j+1,dist->IDs[nodes.nodes[j]]);
			dic[nodes.nodes[j]]=j+1;
		}
		
		int k, srcab, tarab;
		fprintf(treeout,"*Edges %d\n",links.nlinks);
		for(j=0;j<links.nlinks;j++) {
			if(!dic[links.links[j].srcid]) {
				printf("Some ERROR");
				fclose(treeout);
				free(dic);
				clusters_computed=false;
				goto abort;
			}
			
			for(k=0, srcab=0, tarab=0; k<nodes.nnodes; k++) {		// search for the abundances of the two participating nodes
				if(nodes.nodes[k] == links.links[j].srcid) {
					srcab = nodes.abundance[k];
					if(tarab) break;
				}
				if(nodes.nodes[k] == links.links[j].tarid) {
					tarab = nodes.abundance[k];
					if(srcab) break;
				}
			}
			links.links[j].similarity = (float)(srcab + tarab) / 2;
			fprintf(treeout,"%d %d %f\n", dic[links.links[j].srcid], dic[links.links[j].tarid], links.links[j].similarity);
			//printf("%d_%d %d_%d Simi: %f\n", links.links[j].srcid, dic[links.links[j].srcid], links.links[j].tarid, dic[links.links[j].tarid], links.links[j].similarity);
		}
		fclose(treeout);
		free(dic);
//fflush(stdout);
//		int ret=system("/home/miguel/Infomap/Infomap '/home/miguel/workspace/ecoSpace/jni/tree.pajek' -ipajek /home/miguel/workspace/ecoSpace/jni --directed --tree");
		char cmdbuf[100];
		sprintf(cmdbuf,"./Infomap '%s' -ipajek /tmp -N2 --directed --tree",template2);
		int trycount=0,ret;
		
		while((ret=system(cmdbuf))) {
			trycount++;
			printf("Failed to run command %s, trying again %d\n",cmdbuf,trycount);
			if(trycount>5) break;
		}
		if(trycount>5) {
			clusters_computed=false;
			goto abort;
		}
		//system("./Infomap 'tree.pajek' -ipajek ./ --directed --tree");

		unlink(template2);
		strcat(template2,".tree");
		FILE *clusters=fopen(template2,"r");
		char *toto=fgets(out,outBufferSize,clusters),*tmpbuf;
		float tmpflow;
		flow=malloc(sizeof(float)*nodes.nnodes);
		int id,ind,len;
		cluster=malloc(CLUSTERBUFSIZE*nodes.nnodes);	// reserve space for up to 10 hierarchical partitioning levels
		tmpbuf=malloc(300);
// read Infomap output
		while(fscanf(clusters,"%s %f \"%d\" %d",tmpbuf,&tmpflow,&id,&ind)>0) {
			len=strlen(tmpbuf);
			for(i=0;i<len;i++) {
				if(tmpbuf[i]==':') tmpbuf[i]=',';
			}
// discard the last cluster level
			for(i=strlen(tmpbuf)-1;i>-1 && tmpbuf[i]!=',';i--) {}
			tmpbuf[i]=0;
			memcpy(&cluster[(ind-1)*CLUSTERBUFSIZE],tmpbuf,i+1);
			flow[ind-1]=tmpflow;
		}
		fclose(clusters);
		unlink(template2);
		free(tmpbuf);
	}
	abort:

	memset(out,0,outBufferSize);
	strcpy(out,"{\"success\":true,\"nodes\":[");
	if(nodes.nnodes==0) {
		strcat(out,"],\"links\":[]}");
	} else {
		for(j=0;j<nodes.nnodes;j++) {
/*
offset=nodes.nodes[j]*dist->ntaxa;
mind=0;
for(k=0;k<dist->ntaxa;k++) {
	if(k!=nodes.nodes[j]) mind+=MAXDISTANCE-dist->dist[k+offset];
}
*/
/*			sprintf(buf,"{\"id\":%d,\"a\":%d,\"l\":%d,\"c\":%d,\"or\":%d,\"cls\":[%s],\"flow\":%f,\"node\":%d},"
				,dist->IDs[nodes.nodes[j]]
				,dist->freqs[nodes.nodes[j]]
				,nodes.level[j]
				,j<lenquery ? 1 : 0
				,nodes.level[j]==0 ? 1 : 0
				,clusters_computed ? (char*)&cluster[j*CLUSTERBUFSIZE] : ""
				,clusters_computed ? flow[j] : 0
				,nodes.nodes[j]);*/

			sprintf(buf,"{\"id\":%d,\"nrec\":%d,\"lev\":%d,\"abund\":%d,\"ori\":%d,\"cls\":[%s],\"flow\":%f},"
				,dist->IDs[nodes.nodes[j]]
				,dist->freqs[nodes.nodes[j]]
				,nodes.level[j]
				,nodes.abundance[j]
				,nodes.level[j]==0 ? 1 : 0
				,clusters_computed ? (char*)&cluster[j*CLUSTERBUFSIZE] : ""
				,clusters_computed ? flow[j] : 0);

			if(strlen(out)+strlen(buf)>=outBufferSize) {
				outBufferSize+=100000;
				if((tmppointer=realloc(out,outBufferSize)))
					out=tmppointer;
				else error("Some error reallocating");
			}
			strcat(out,buf);
		}
		
		out[strlen(out)-1]=0;
		if(links.nlinks==0) {
			strcat(out,"],\"links\":[]}");	// FIXME: should test buffer size here too
		} else {
			strcat(out,"],\"links\":[");	// FIXME: should test buffer size here too
	
			for(j=0;j<links.nlinks;j++) {
				sprintf(buf,"{\"sourceid\":%d,\"targetid\":%d,\"wei\":%f,\"bi\":%d},"
					, dist->IDs[links.links[j].srcid]
					, dist->IDs[links.links[j].tarid]
					, links.links[j].similarity
					, links.links[j].bidirectional ? 1 : 0);
					
				if(strlen(out)+strlen(buf)>=outBufferSize) {
					outBufferSize+=100000;
					if((tmppointer=realloc(out,outBufferSize)))
						out=tmppointer;
					else error("Some error reallocating");
				}
				strcat(out,buf);
			}
			out[strlen(out)-1]=0;
			strcat(out,"]}");
		}
	}

	result = (*env)->NewStringUTF(env,out);
	(*env)->ReleaseIntArrayElements(env, taxID, tid, 0);
	(*env)->ReleaseIntArrayElements(env, abund, tab, 0);
	if(clusters_computed) free(cluster);
	free(nodes.nodes);
	free(nodes.abundance);
	free(nodes.level);
	free(links.links);
	free(distance);
	return result;
}

