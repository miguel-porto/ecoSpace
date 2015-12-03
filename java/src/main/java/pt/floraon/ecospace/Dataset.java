package pt.floraon.ecospace;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

public class Dataset {
	public String dID,FileKey=null;
	public List<Variable> Variables=new ArrayList<Variable>();
	public TaxonNames taxonNames=new TaxonNames();
	public List<Integer> TaxonFrequencies=new ArrayList<Integer>();
	public Map<String,Analysis> analyses=new HashMap<String,Analysis>();
	private DATASETSTATE State;
	private DataProcessor dp=null;
	public boolean isProcessed;

	public class TaxonNames extends ArrayList<String> {
		private static final long serialVersionUID = 1L;
		/**
		 * Takes a Srting array, each element represents a species, and gets the internal IDs for each species
		 * @param query An array of either internal IDs or canonical species names. Can be mixed.
		 * @return An array of internal taxon IDs. Note: if a given input element is not found in this {@link Dataset}, no ID is returned. Hence, the number of elements of the output array may not be the same as the input array
		 */
		public List<Integer> parseQuery(String[] query) {
			String tmp;
			List<Integer> out=new ArrayList<Integer>();
			if(query.length==1 && query[0].toLowerCase().equals("all")) {
				out.add(-1);
				return out;
			} else {
				for(int i=0;i<query.length;i++) {
					if(query[i]==null) continue;
					tmp=query[i].toLowerCase();
					if(tmp.matches("^iid:[0-9]+$"))		// query is an internal taxon ID
						out.add(Integer.parseInt(tmp.substring(4)));
					else if(tmp.matches("^[0-9]+$")) {		// query is a plain number, which is assumed to be a GBIF nubKey ID
						tmp=GlobalOperations.getSpeciesFromNub(Long.parseLong(tmp));
						if(tmp==null) continue; else tmp=tmp.toLowerCase();
						for(int i1=0;i1<this.size();i1++) {
							if(this.get(i1).toLowerCase().equals(tmp)) {
								out.add(i1);
								break;
							}
						}
					} else {			// query is assumed to be a canonical species name; any string can go here, if it does not match, it is silently ignored.
						// TODO better parse species names, perhaps use GBIF services
						tmp=tmp.replace("+", " ");
						for(int i1=0;i1<this.size();i1++) {
							if(this.get(i1).toLowerCase().equals(tmp)) {
								out.add(i1);
								break;
							}
						}
					}
				}
			}
			return out;
		}
	}
	
    public static class DatasetException extends Exception {
		private static final long serialVersionUID = 1L;
          public DatasetException () {}
          public DatasetException (String message) {
             super(message);
          }
    }
   
	/**
	 * Gets the textual description of this dataset
	 * @return
	 */
	public String getDescription() {
		return(GlobalOperations.getDataset(dID).getElementsByTagName("description").item(0).getTextContent());
	}

	public String getOrigin() {
		return GlobalOperations.getDataset(dID).getAttribute("origin");
	}

	public Integer getNumRecords() {
		return Integer.parseInt(GlobalOperations.getDataset(dID).getAttribute("numRecords"));
	}

	public String getUrl() {
		NodeList tmp=GlobalOperations.getDataset(dID).getElementsByTagName("url");
		if(tmp.getLength()==0) return null;
		return(tmp.item(0).getTextContent());
	}

	public Dataset(Element dsel) {
// this registers an existing dataset which is already processed
// this is only meant to be run on server startup!
		isProcessed=false;
// open existing dataset
		State=DATASETSTATE.EMPTY;
		this.dID=dsel.getAttribute("id");
		this.FileKey=dsel.getAttribute("GBIFfileKey");
		if(this.FileKey.equals("")) this.FileKey=null;
// check if all data files exist
		//File f1=new File("data/vars_"+dID+".bin");
		File f2=new File("data/stdvars_"+dID+".bin");
		File f3=new File("data/taxa_"+dID);
		File f5=new File("data/varlist_"+dID+".txt");
		if(f2.isFile() && f3.isFile() && f5.isFile()) isProcessed=true;
// open handles to existing saved analyses
		try {
			if(isProcessed) Open(); else EcoSpace.outputlog.println("Missing data files for this dataset.");
		} catch(IOException e) {
			EcoSpace.outputlog.println(e.getMessage());
			isProcessed=false;
			State=DATASETSTATE.ERROR;
		}
	}

	public Integer[] GetVariableCodes(String[] vars) throws IOException {
		Integer[] codes=new Integer[vars.length];
		Integer tmp;
		for(int i=0;i<vars.length;i++) {
			tmp=-1;
			for(int j=0;j<Variables.size();j++) {
				if(Variables.get(j).name.equals(vars[i])) {tmp=j;break;}
			}
			if(tmp==-1) throw new IOException("Variable name not found"); else codes[i]=tmp; 
		}
		return(codes);
	}

	public String[] GetVariableNames(Integer[] vars) throws IOException {
		String[] codes=new String[vars.length];
		for(int i=0;i<vars.length;i++) {
			if(vars[i]>vars.length) codes[i]="NA"; else codes[i]=Variables.get(i).name;
		}
		return(codes);
	}
	/**
	 * Open a dataset by reading files into memory
	 * @throws IOException
	 */
	private void Open() throws IOException {
		String tmp;
//read taxa names
		File f3=new File("data/taxa_"+dID);
		File f4=new File("data/freqs_"+dID+".txt");
		
		BufferedReader br=new BufferedReader(new FileReader(f3));
		while((tmp=br.readLine())!=null) {
			taxonNames.add(tmp);
		}
		br.close();
		
		if(f4.isFile()) {
			readFrequencies();
			if(taxonNames.size()!=TaxonFrequencies.size()) throw new IOException("Taxon names file has not the same number of records as taxon frequencies file.");
		}
		
		File varfile=new File("data/varlist_"+dID+".txt");
		try(BufferedReader bw=new BufferedReader(new FileReader(varfile))) {
			while((tmp=bw.readLine())!=null) {
				String[] line=tmp.split("\t");
				String tmp1=line[0].replace(".tif", "");
				Element var=GlobalOperations.getVariable(tmp1);
				Variables.add(new Variable(tmp1,var.getAttribute("title"),var.getAttribute("abbrev"),Float.parseFloat(line[1]),Float.parseFloat(line[2]),Float.parseFloat(var.getAttribute("scale"))));
			}
		} catch (IOException e) {
			e.printStackTrace();
			return;
		} catch (NumberFormatException e1) {
			e1.printStackTrace();
			System.err.println("\nError processing the variable index in file datasets.xml. Confirm that all variables have the scale attribute.");
			return;
		}
		
//read and open handles for existing analyses
		Element parent=GlobalOperations.getDataset(dID);
		NodeList nl=parent.getElementsByTagName("analysis");
		Element tmp1;
		for(int i=0;i<nl.getLength();i++) {
			tmp1=(Element)nl.item(i);
			Analysis an=new Analysis(tmp1);
			if(an.State!=ANALYSISSTATE.ERROR) analyses.put(an.aID,an); else parent.removeChild(tmp1);
		}
		GlobalOperations.updateXML();
		State=DATASETSTATE.IDLE;
	}
	
	private void updateNumRecords(Integer numRecords) {
		GlobalOperations.getDataset(dID).setAttribute("numRecords",numRecords.toString());
		GlobalOperations.updateXML();
	}
	private void readFrequencies() throws FileNotFoundException, IOException {
		String tmp;
		File f4=new File("data/freqs_"+dID+".txt");
		BufferedReader fr=new BufferedReader(new FileReader(f4));
		while((tmp=fr.readLine())!=null) {
			TaxonFrequencies.add(Integer.parseInt(tmp));
		}
		fr.close();
	}
	
	public Dataset(DataInterface dataint) {
// this creates a new dataset from a given data interface
		isProcessed=false;
		State=DATASETSTATE.EMPTY;
		dID=dataint.tmpID;//UUID.randomUUID().toString().substring(26);		
		dp=new DataProcessor(dataint);
		new Thread(dp).start();
		
		GlobalOperations.addDataset(dID, dataint.Origin, dataint.Description,dataint.Url);
		GlobalOperations.updateXML();
	}
	
	public DATASETSTATE GetState() {
		if(dp!=null) return dp.dataint.State; else return(State);
	}
	
	public Integer getProgress() {
		if(dp!=null && dp.dataint!=null && dp.dataint.sdataset!=null && dp.dataint.sdataset.records!=null) {
			return dp.dataint.sdataset.records.size();
		} else return null;
	}

	public String Query(String aID,Integer[] taxID,int nNeigh,int nLevels,boolean loadSecondaryLinks,boolean makeClusters) throws DatasetException, IOException {
		Analysis an=this.analyses.get(aID);
		if(an==null) throw new DatasetException("Analysis "+aID+" not found.");
		return an.Query(taxID,nNeigh,nLevels,loadSecondaryLinks,makeClusters);
	}

	public void Close() {
		for(Analysis an:analyses.values()) {
			an.Close();
		}
	}
	/**
	 * Either place a new async analysis running or fetch an existing analysis with the given parameters. In any case, return the aID immediately. The web app must check when is it ready. 
	 * @param vars
	 * @param min_freq
	 * @param sigmaPercent
	 * @return The analysis ID
	 */
	public String Analyze(Integer[] vars,Integer min_freq,Float sigmaPercent,boolean downweight) {
		Analysis thisan;
		if(this.State!=DATASETSTATE.IDLE) return null;
		String aID=GlobalOperations.findAnalysis(dID, vars, min_freq, sigmaPercent,downweight);
		
		if(aID==null) {
			thisan=new Analysis(vars,min_freq,sigmaPercent,downweight);
			analyses.put(thisan.aID,thisan);
			aID=thisan.aID;
			new Thread(thisan).start();
// update XML with this analysis
			GlobalOperations.addAnalysis(thisan);//this.dID,thisan.aID,vars,min_freq,sigmaPercent);
			GlobalOperations.updateXML();
		}
		return(aID);
	}
	
	private class DataProcessor implements Runnable {
		private DataInterface dataint;
		public DataProcessor(DataInterface dataint) {
			this.dataint=dataint;
		}
		@Override
		public void run() {
			if(!dataint.ExecuteRequest()) {
				dataint.State=DATASETSTATE.ERROR;
				dp=null;
				return;
			}
			dataint.State=DATASETSTATE.READING_VARIABLES;
			updateNumRecords(dataint.sdataset.taxID.length);
			nativeFunctions.readVariablesFromCoords(dataint.sdataset.getLatArray(),dataint.sdataset.getLngArray(),dataint.sdataset.taxID,dataint.sdataset.speciesList.size(),dID);
			EcoSpace.outputlog.println("Ok");
			try {
				Open();
			} catch(IOException e) {
				isProcessed=false;
				dataint.State=DATASETSTATE.ERROR;
				return;
			}
			dp=null;
			dataint.State=DATASETSTATE.IDLE;
		}
		
	}
	
	public class Analysis implements Runnable {
		private String aID;
		private Set<Integer> variables;
		private int min_frequency;
		private float sigmaPercent;
		private boolean downWeight;
		private long memory;
		private long handle=0,progressHandle=0;		// this is the C pointer to the distance matrix of this analysis and to the progress when computing distance matrix
		private ANALYSISSTATE State;
		
		public Analysis(Integer[] vars,Integer min_freq,Float sigmaPercent,boolean downweight) {
// make new analysis
			variables=new HashSet<Integer>(Arrays.asList(vars));
			this.min_frequency=min_freq;
			this.sigmaPercent=sigmaPercent;
			this.downWeight=downweight;
			aID=UUID.randomUUID().toString().substring(33);
		}
		/**
		 * Constructs a new Analysis from the XML entry in index file.
		 * @param anEl XML entry
		 */
		public Analysis(Element anEl) {
// register existing analysis on server startup			
			this.variables=new HashSet<Integer>(Arrays.asList(nativeFunctions.stringToIntArray(anEl.getAttribute("variables"))));
			this.min_frequency=Integer.parseInt(anEl.getAttribute("minfreq"));
			this.aID=anEl.getAttribute("id");
			this.sigmaPercent=Float.parseFloat(anEl.getAttribute("sigmaPercent"));
			this.downWeight=Boolean.parseBoolean(anEl.getAttribute("downWeight"));
			File f1=new File("data/dens_"+dID+"_"+aID+".bin");
			File f2=new File("data/dist_"+dID+"_"+aID+".bin");
			if(f1.isFile() && f2.isFile()) {
// files exist, let's open distance matrix
				long[] ret=nativeFunctions.openDistanceMatrix(dID, aID);
				this.handle=ret[0];
				this.memory=ret[1];
				if(this.handle!=0) this.State=ANALYSISSTATE.READY; else this.State=ANALYSISSTATE.ERROR;
			} else this.State=ANALYSISSTATE.ERROR;
		}
		
		public String getDatasetID() {
			return dID;
		}
		
		public Float getSigmaPercent() {
			return this.sigmaPercent;
		}
		
		public Integer getMinFrequency() {
			return this.min_frequency;
		}
		
		public Boolean getDownWeight() {
			return this.downWeight;
		}
		
		public Long getMemoryUsed() {
			return this.memory;
		}
		
		public String getAnalysisID() {
			return this.aID;
		}
		
		public Set<Integer> getVariables() {
			return this.variables;
		}
		
		public String downloadDistanceMatrix() {
			return nativeFunctions.exportDistanceMatrix(this.handle);
		}
		
		@SuppressWarnings("unchecked")
		public JSONObject toJSON() {
			JSONObject tmp=new JSONObject();
			tmp.put("id", this.aID);
			tmp.put("minfreq", this.min_frequency);
			tmp.put("sigmapercent",this.sigmaPercent);
			tmp.put("downweight",this.downWeight);
			JSONArray vars=new JSONArray();
			JSONArray varcodes=new JSONArray();
			for(Integer v:this.variables) {
				vars.add(Dataset.this.Variables.get(v).abbrev);
				varcodes.add(Dataset.this.Variables.get(v).name);
			}
			tmp.put("variables", vars);
			tmp.put("variableCodes", varcodes);
			tmp.put("ready", this.isReady() ? 1 : 0);
			return tmp;
		}
		
		public String getState() {
			switch(this.State) {
				case COMPUTING_KERNEL_DENSITIES: return("Computing kernel densities");
				case COMPUTING_DISTANCES: return("Computing distances... "+(this.progressHandle!=0 ? ((float)nativeFunctions.getProgressDistanceMatrix(this.progressHandle,false)/10)+"%" : "done!"));
				case READY: return("READY");
				case ERROR: return("ERROR");
				default: return("Undefined");
			}
		}
		
		public ANALYSISSTATE getStateCode() {
			return this.State;
		}
		
		public boolean isReady() {
			return(this.State==ANALYSISSTATE.READY);
		}
		
		public void Close() {
			if(this.handle!=0) {
				EcoSpace.outputlog.println("Closing "+this.aID);
				nativeFunctions.closeDistanceMatrix(this.handle);
				this.handle=0;
			} else EcoSpace.outputlog.println("Already closed");
		}
		public String Query(Integer[] taxID,int nNeigh,int nLevels,boolean loadSecondaryLinks, boolean makeClusters) throws DatasetException, IOException {
			int[] tmp=nativeFunctions.toPrimitiveInt(Arrays.asList(taxID));
			if(this.handle!=0 && this.State==ANALYSISSTATE.READY) {
				String out=nativeFunctions.getRelationships(this.handle, tmp, nLevels, nNeigh, loadSecondaryLinks, makeClusters);
				if(out==null)
					throw new IOException("Some error occurred while fetching relations");
				else
					return out; 
			}
				//return(nativeFunctions.queryRelatedTaxa(this.handle, taxID[0], nLevels, nNeigh));
			throw new DatasetException("Analysis "+this.aID+" not ready.");
		}
		
		@Override
		public void run() {
			this.State=ANALYSISSTATE.COMPUTING_KERNEL_DENSITIES;
			nativeFunctions.computeKernelDensities(dID,this.aID,nativeFunctions.toPrimitiveInt(new ArrayList<Integer>(this.variables)),this.min_frequency,this.sigmaPercent,this.downWeight);
			try {
				readFrequencies();
			} catch (IOException e) {
				e.printStackTrace();
				return;
			}			
			this.State=ANALYSISSTATE.COMPUTING_DISTANCES;
			// create progress variable in C and get pointer
			this.progressHandle=nativeFunctions.initProgressDistanceMatrix();
			nativeFunctions.computeDistanceMatrix(dID,aID,this.progressHandle);
			// free progress pointer
			nativeFunctions.getProgressDistanceMatrix(this.progressHandle, true);
			this.progressHandle=0;
			long[] ret=nativeFunctions.openDistanceMatrix(dID, aID);
			this.handle=ret[0];
			this.memory=ret[1];
			if(this.handle!=0) this.State=ANALYSISSTATE.READY; else this.State=ANALYSISSTATE.ERROR;
		}
	}
	
	public class Variable {
		public String name,title,abbrev;
		public Float min,max,scale;
		private Variable(String name,String title,String abbrev,Float min,Float max,Float scale) {
			this.name=name;
			this.title=title;
			this.min=min;
			this.max=max;
			this.scale=scale;
			this.abbrev=abbrev;
		}
	}
}
