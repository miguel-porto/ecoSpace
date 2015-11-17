package pt.floraon.ecospace;

import java.io.Closeable;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
/**
 * Represents a very very simple in-memory dataset with only coordinates, taxon name (genus+species) and GBIF nubKey.
 * @author miguel
 *
 */
public class SimpleDataset implements Closeable {
	public int[] taxID;
	public List<Species> speciesList;
	public Map<String,Integer> speciesMap=new HashMap<String,Integer>();
	private Set<Species> speciesSet=new HashSet<Species>();
	
	public class Record implements Comparable<Record> {
		float lat,lng;
		Species species;
		
		@Override
	    public int compareTo(Record other){
	        return this.species.getName().compareTo(other.species.getName());
	    }
		
		public Record(float _lat,float _lng,Species _spp) {
			lat=_lat;
			lng=_lng;
			species=_spp;
		}
	}
	public List<Record> records=new ArrayList<Record>();
	
	public void addRecord(float _lat,float _lng,String _spp) throws IOException {
		Species sp=null;
		boolean found=false;
		Iterator<Species> it=speciesSet.iterator();
		while(it.hasNext()) {
			sp=it.next();
			if(sp.getName().equals(_spp)) {
				found=true;
				break;
			}
		}
		if(!found) {
			sp=new Species(_spp);
			speciesSet.add(sp);
		}
		if(sp!=null) records.add(new Record(_lat,_lng,sp));
	}
	
	private void processSpecies() {
		this.speciesList = new ArrayList<Species>(speciesSet);
		Collections.sort(this.speciesList);
		
		for(int i=0;i<this.speciesList.size();i++) {
			this.speciesList.get(i).setInternalID(i);
			this.speciesMap.put(this.speciesList.get(i).getName(), i);
		}
	}
	
	public float[] getLatArray() {
		float[] lat=new float[records.size()];
		Iterator<Record> it=records.iterator();

		for (int i = 0; i < lat.length; i++) {
	        lat[i] = it.next().lat;
	    }
		return(lat);
	}

	public float[] getLngArray() {
		float[] lng=new float[records.size()];
		Iterator<Record> it=records.iterator();
		for (int i = 0; i < lng.length; i++) {
	        lng[i] = it.next().lng;
	    }
		return(lng);
	}

	/**
	 * Assigns a serial number to each taxon and write taxon list to a file 
	 */
	@Override
	public void close() {
		taxID=new int[records.size()];
		int i=0;
		EcoSpace.outputlog.println("Processing species names...");
		processSpecies();
		EcoSpace.outputlog.println("Assigning IDs to records...");
		for(Record rec : records) {
			//taxID[i]=SpeciesNames.indexOf(sp.speciesName);
			//EcoSpace.outputlog.println(rec.species.getName()+": "+rec.species.getInternalID()+", "+this.speciesMap.get(rec.species.getName()));
			taxID[i]=rec.species.getInternalID();//this.speciesMap.get(sp.species.getName());
			i++;
		}
	}
}
