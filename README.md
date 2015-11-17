# ecoSpace-server
[ecoSpace](http://www.flora-on.pt/ecospace) is an online tool to interactively assemble, explore and analyse species ecological networks, where species relationships are inferred from plain species occurrence data.
It is targeted at revealing the biogeographic structure underlying species assemblages.
ecoSpace-server is the Java server that does all the computations necessary for assembling species networks:
* fetches occurence data from [GBIF](http://www.gbif.org) according to user queries;
* extracts the values of all bioclimatic variables downloaded from [WorldClim](http://www.worldclim.org) for all occurrences;
* computes and stores the multidimensional kernel density surfaces for the variables chosen by the user (currently up to 3-dimensional spaces are supported);
* computes and stores the pairwise distance matrices by the intersection of the kernel densities of all pairs of species;
* assembles species networks based on the distance matrices and the user queries;
* [exposes services](http://flora-on.pt/ecospace/?w=api) for querying the network and displaying kernel density surfaces in self-contained SVG.

The code is here provided as an Eclipse project.

