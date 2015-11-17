package pt.floraon.ecospace;

import java.io.BufferedReader;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;

public class OccurrenceInterface extends DataInterface {
// interface for a local occurrence.txt file	
	private String occurrenceFile;
	public OccurrenceInterface(String description,String url) {
		super(description,"occurrencefile",url);
	}
	
	public void SetProperties(String occurrenceFile) {
		this.occurrenceFile=occurrenceFile;
	}
	public boolean ExecuteRequest() {
		State=DATASETSTATE.PROCESSING_FILE;
		try {
			super.sdataset=ProcessOccurrenceFile(this.occurrenceFile);
		} catch (IOException e) {
			return false;
		}
		super.close();
		if(super.sdataset==null) {
			State=DATASETSTATE.ERROR;
			return(false);
		}
		State=DATASETSTATE.IDLE;
		return(true);
	}
	/**
	 * Reads a DWC occurrence file, taking the coordinates and taxon of species and subspecies. Excludes records which are not SPECIES or SUBSPECIES. 
	 * @param filename	Path to local text file
	 * @return A {@link SimpleDataset} with the included records.
	 * @throws IOException
	 */
	public static SimpleDataset ProcessOccurrenceFile(String filename) throws IOException {
		SimpleDataset sdataset=new SimpleDataset();
		CSVRecord record;
		CSVParser tmp;
		CSVFormat fmt=CSVFormat.DEFAULT.withDelimiter('\t');
		String line;
		Integer tRank,dLat,dLon,gen,sEpi;
		
		Map<String,Integer> head=new HashMap<String,Integer>();
		
		int count=0;

		InputStreamReader freader = new InputStreamReader(new FileInputStream(filename), StandardCharsets.UTF_8);
		//CSVParser parser = CSVParser.parse(new File(filename), java.nio.charset.StandardCharsets.UTF_8, CSVFormat.RFC4180);			
		BufferedReader br=new BufferedReader(freader);
		tmp=CSVParser.parse(br.readLine(), fmt);
		record=tmp.getRecords().get(0);
		for(int i=0;i<record.size();i++) head.put(record.get(i), i);
		
		tRank=head.get("taxonRank");
		dLat=head.get("decimalLatitude");
		dLon=head.get("decimalLongitude");
		gen=head.get("genus");
		sEpi=head.get("specificEpithet");
		
		while((line=br.readLine())!=null) {
			try {
				count++;
				tmp=CSVParser.parse(line, fmt);
				record=tmp.getRecords().get(0);
				if(record.get(tRank).toString().toUpperCase().equals("SPECIES") || record.get(tRank).toString().toUpperCase().equals("SUBSPECIES")) {
					if(!record.get(gen).trim().equals("")) {
						sdataset.addRecord(Float.parseFloat(record.get(dLat)), Float.parseFloat(record.get(dLon)), record.get(gen)+" "+record.get(sEpi));
					}
				}
			} catch (Throwable e) {
				EcoSpace.outputlog.println("Error found on line "+count+", skipped line: "+e.getMessage());
			}
		}
		br.close();
		Collections.sort(sdataset.records);

/*		 
		try {
			InputStreamReader freader = new InputStreamReader(new FileInputStream(filename), StandardCharsets.UTF_8);
			records = CSVFormat.DEFAULT.withDelimiter('\t').withHeader().parse(freader);
			Iterator<CSVRecord> it=records.iterator();
			try {
				while(it.hasNext()) {
					count++;
					record=it.next();
					if(record.get("taxonRank").toString().toUpperCase().equals("SPECIES") || record.get("taxonRank").toString().toUpperCase().equals("SUBSPECIES")) {
						sdataset.records.add(sdataset.new record(
								(float)Float.parseFloat(record.get("decimalLatitude"))
								,(float)Float.parseFloat(record.get("decimalLongitude"))
								,record.get("genus")+" "+record.get("specificEpithet")
								));
					}
				}
			} catch (Throwable e) {
				EcoSpace.outputlog.println("Error found on line "+count);
			}
/*			for(CSVRecord record : records) {
				if(record.get("taxonRank").toString().toUpperCase().equals("SPECIES") || record.get("taxonRank").toString().toUpperCase().equals("SUBSPECIES")) {
					sdataset.records.add(sdataset.new record(
							(float)Float.parseFloat(record.get("decimalLatitude"))
							,(float)Float.parseFloat(record.get("decimalLongitude"))
							,record.get("genus")+" "+record.get("specificEpithet")
							));
				}
			}
			Collections.sort(sdataset.records);			
		} catch (IOException e) {
			EcoSpace.outputlog.println(filename+" not found.");
			return(null);
		}*/
		EcoSpace.outputlog.println("Read "+sdataset.records.size()+" records.");
		return(sdataset);		
	}
}
