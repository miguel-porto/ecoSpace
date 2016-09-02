package pt.floraon.ecospace;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import pt.floraon.ecospace.Dataset.Analysis;
import pt.floraon.ecospace.Dataset.DatasetException;

public class DatasetServer {
	public Map<String,Dataset> datasets=new HashMap<String,Dataset>();
	private int nDistanceDownloads=0;
	public DatasetServer() {
		NodeList dslist=GlobalOperations.getDatasets();
		long memory;
		for(int i=0;i<dslist.getLength();i++) {
			memory=0;
			Element dsn=(Element) dslist.item(i);
			Dataset ds=new Dataset(dsn);	// pass the XML element
			datasets.put(dsn.getAttribute("id").toString(),ds);
			EcoSpace.outputlog.println("Dataset "+ds.dID+" «"+ds.getDescription()+"»: "+(ds.isProcessed ? "PROCESSED ("+ds.taxonNames.size()+" taxa)" : "NOT PROCESSED"));
			if(ds.isProcessed) {
				for(Dataset.Analysis an : ds.analyses.values()) {
					memory+=an.getMemoryUsed();
					EcoSpace.outputlog.println("...Analysis "+an.getAnalysisID()+": "+an.getState()+" - variables "+an.getVariables().toString()+"; min frequency "+an.getMinFrequency());
				}
				EcoSpace.outputlog.println("...Total memory used: "+Math.ceil(memory/(1024*1024))+" Mb");
				//ds.CreateFromGBIFRequest(6635,"POLYGON((-9.78 44.11,-10.17 35.71,4.56 35.08,4.67 44.17,-9.78 44.11))");
			}
		}
// register a shutdown hook because we have memory allocated in JNI		
        Runtime.getRuntime().addShutdownHook(new Thread() {
            @Override
            public void run() {
            	Close();
            	EcoSpace.outputlog.println("Shutting down server..." );
            }
        });
	}
	
	public synchronized int getNDistanceDownloads() {
		return this.nDistanceDownloads;
	}
	
	public synchronized void pushDistanceDownload() {
		this.nDistanceDownloads++;
	}
	
	public synchronized void popDistanceDownload() {
		this.nDistanceDownloads--;
	}
	
	@SuppressWarnings("unchecked")
	public String GetDatasets() {
    	JSONArray dss=new JSONArray();
    	JSONObject tmpo,out;
    	String nrec;
    	out=new JSONObject();
    	out.put("success", true);

    	for(Entry<String, Dataset> ds:datasets.entrySet()) {
    		if(ds.getValue().GetState()==DATASETSTATE.EMPTY) continue;
    		tmpo=new JSONObject();
    		tmpo.put("id", ds.getValue().dID);
    		tmpo.put("desc", ds.getValue().getDescription());
    		tmpo.put("ntaxa",ds.getValue().taxonNames.size());
    		if(ds.getValue().FileKey!=null) tmpo.put("fileKey",ds.getValue().FileKey);
    		if(ds.getValue().GetState()==DATASETSTATE.IDLE) tmpo.put("ready",true); else tmpo.put("ready",false);
    		tmpo.put("state",GlobalOperations.translateDatasetState(ds.getValue().GetState()));
    				//+(ds.getValue().getProgress()==null ? "" : " "+ds.getValue().getProgress()+" records processed."));
    		
    		nrec=GlobalOperations.getDataset(ds.getValue().dID).getAttribute("numRecords");
    		if(nrec!="") tmpo.put("numrec", Integer.parseInt(nrec)); else tmpo.put("numrec", 0);
    		dss.add(tmpo);
    	}
    	out.put("datasets", dss);
    	return(out.toJSONString());
	}
	
	/**
	 * Gets how many analyses are currently being computed
	 * @return
	 */
	public int getNumberCurrentAnalyses() {
		int nan=0;
		for(Dataset ds:this.datasets.values()) {
			for(Analysis an:ds.analyses.values()) {
				if(an.getStateCode()==ANALYSISSTATE.COMPUTING_DISTANCES ||
					an.getStateCode()==ANALYSISSTATE.COMPUTING_KERNEL_DENSITIES) nan++; 
			}
		}
		return nan;
	}
	
	/**
	 * Places a new analysis running, or fetches an analysis ID in case the analysis already exists.
	 * @param dID Dataset ID
	 * @param vars Variable codes
	 * @param min_freq
	 * @param sigmaPercent
	 * @param downweight
	 * @return An analysis ID. It can correspond to a newly created analysis, or an existing one.
	 * @throws IOException
	 */
	public String analyze(String dID,Integer[] vars,Integer min_freq,Float sigmaPercent,boolean downweight) throws IOException {
		String aID=null;
		Dataset ds=datasets.get(dID);
		if(ds==null) throw new IOException("Dataset "+dID+" not found.");
		switch(vars.length) {
		case 3:		// check if server is too busy
			if(this.getNumberCurrentAnalyses()>0) throw new IOException("Server too busy right now. Please try again later, or use an existing analysis.");
		case 1:
		case 2:
			aID=ds.Analyze(vars, min_freq,sigmaPercent,downweight);
			if(aID==null) throw new IOException("Some error requesting the analysis.");
			return aID;
			
		default:
			throw new IOException("Currently, cannot compute distances with more than 3 variables.");
		}
	}

	public void Close() {
		for(Dataset ds:datasets.values()) {
			ds.Close();
		}
	}
	
	public int CleanXMLIndex() {
// removes problematic datasets from XML
		int i,count=0;
		Node parent=GlobalOperations.getRoot();
		NodeList dsl=GlobalOperations.getDatasets();
		List<Element> toremove=new ArrayList<Element>();
		for(i=0;i<dsl.getLength();i++) {
			Element el=(Element) dsl.item(i);
			if(datasets.get(el.getAttribute("id")).GetState()==DATASETSTATE.EMPTY || datasets.get(el.getAttribute("id")).GetState()==DATASETSTATE.ERROR) {
				toremove.add(el);
				datasets.get(el.getAttribute("id")).Close();
				datasets.remove(el.getAttribute("id"));
			}
		}
		for(Element el:toremove) {
			count++;
			parent.removeChild(el);
		}
		GlobalOperations.updateXML();
		return(count);
	}
	
	public String Query(String dID,String aID,Map<Integer, Integer> taxID,int nNeigh,int nLevels,boolean loadSecondaryLinks,boolean makeClusters, boolean sampleBased) throws DatasetException, IOException {
		Dataset ds=datasets.get(dID);
		if(ds==null) throw new DatasetException("Dataset "+dID+" not found.");
		return ds.Query(aID,taxID,nNeigh,nLevels,loadSecondaryLinks,makeClusters, sampleBased);
	}
	
	public String GetState() {
		String msg,out="";
		for(Entry<String, Dataset> ds:datasets.entrySet()) {
			msg="Dataset "+ds.getValue().dID+" «"+ds.getValue().getDescription()+"»: "+GlobalOperations.translateDatasetState(ds.getValue().GetState())+(ds.getValue().getProgress()==null ? "" : " "+ds.getValue().getProgress()+" records processed.");
			out+=msg+"\n";
			for(Analysis an:ds.getValue().analyses.values()) {
				out+="...Analysis "+an.getAnalysisID()+": "+an.getState()+" - variables "+an.getVariables().toString()+"; min frequency "+an.getMinFrequency()+"; sigma "+an.getSigmaPercent()+"; memory "+Math.ceil(an.getMemoryUsed()/(1024*1024))+" Mb\n";
			}
		}
		return(out);
	}
	
	public void Empty() {
		datasets.clear();
		GlobalOperations.Empty();
		GlobalOperations.updateXML();
	}
	public void ShutDown() {
		
	}
}
