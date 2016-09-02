ifeq ("$(wildcard $(JAVA_HOME))","")
$(error JAVA_HOME not correctly defined "$(JAVA_HOME)", run R CMD javareconf to fix the problem)
endif

.PHONY: all mylibs infom

PKG_CFLAGS = $(JAVA_CPPFLAGS) $(SHLIB_OPENMP_CFLAGS) -Itiff-4.0.6/libtiff/
	
PKG_LIBS = $(SHLIB_OPENMP_CFLAGS) -Ltiff-4.0.6/libtiff/.libs -ltiff

all: infom mylibs ecoSpace

ecoSpace: mylibs
# check /usr/lib/R/etc/Makeconf
	$(CC) $(CFLAGS) $(CPICFLAGS) -o ${R_PACKAGE_DIR}/libs/ecoSpace -shared $(PKG_CFLAGS) extract-vars.c distancequery.c distances.c readtiffs.c kernel-dens.c build-kernel.c export-vars.c $(PKG_LIBS)
# copy files to the package folder
	mv Infomap-0.18/Infomap ${R_PACKAGE_DIR}/libs/

# compile libtiff
mylibs:
	cd tiff-4.0.6; ./configure; $(MAKE)

# compile Infomap
infom:
	$(MAKE) -C Infomap-0.18

