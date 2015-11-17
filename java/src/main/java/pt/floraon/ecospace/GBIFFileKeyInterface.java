package pt.floraon.ecospace;

import java.io.IOException;

public class GBIFFileKeyInterface extends DataInterface {
	private String fileKey;
	public GBIFFileKeyInterface(String description, String url) {
		super(description, "FileKey", url);
	}
	
	public void SetProperties(String filekey) {
		fileKey=filekey;
	}
	
	public boolean ExecuteRequest() {
		State=DATASETSTATE.WAITING_FILE;
		
		if(!waitForFile(fileKey,super.tmpID)) {
			State=DATASETSTATE.ERROR;
			return(false);
		}
		State=DATASETSTATE.PROCESSING_FILE;
		try {
			DWCFileInterface.unzipAndReadOccurrences("/tmp/zip_"+super.tmpID,"/tmp/"+super.tmpID);
			super.sdataset=OccurrenceInterface.ProcessOccurrenceFile("/tmp/"+super.tmpID);
		} catch (IOException e) {
			return false;
		}
		super.close();
		State=DATASETSTATE.IDLE;
		return(super.sdataset==null ? false : true);		
	}
	
	public static boolean waitForFile(String fileKey,String dID) {
		int count=0;
		EcoSpace.outputlog.println("Waiting for file "+fileKey+"...");
		try {
	        while(!HttpDownloadUtility.downloadFile("http://api.gbif.org/v1/occurrence/download/request/"+fileKey, "/tmp/zip_"+dID) && count<200) {
	        	EcoSpace.outputlog.print(".");
				count++;
	            Thread.sleep(15000);
	        }
		} catch (InterruptedException | IOException e) {
			EcoSpace.outputlog.println("Some error. "+fileKey);
			return(false);
		}
		if(count==200)
			return(false);
		else
			return(true);
	}
}
