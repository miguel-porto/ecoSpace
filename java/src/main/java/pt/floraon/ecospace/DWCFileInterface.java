package pt.floraon.ecospace;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
/**
 * Requests a DarwinCore file download (ZIPped or not), waiting until it is ready. Checks file every 10 secs.
 * After downloaded, tries to unzip it and processes the occurrence.txt, or if not a ZIP, directly processes the text file assuming it is in DWC format. 
 * @author miguel
 *
 */
public class DWCFileInterface extends DataInterface {
	private String fileurl=null;
	public DWCFileInterface(String description,String url) {
		super(description,"DWCfile",url);
		this.fileurl=url;			
	}
	
	@Override
	public boolean ExecuteRequest() {
		State=DATASETSTATE.WAITING_FILE;
		try {
	        while(!HttpDownloadUtility.downloadFile(fileurl, "/tmp/zip_"+super.tmpID)) {
	        	EcoSpace.outputlog.print(".");
	            Thread.sleep(10000);
	        }
		} catch (InterruptedException | IOException e) {
			return(false);
		}

		State=DATASETSTATE.PROCESSING_FILE;
		super.sdataset=null;
		try {
			unzipAndReadOccurrences("/tmp/zip_"+super.tmpID,"/tmp/"+super.tmpID);	// try to open as ZIP file
		} catch (IOException e) {
			EcoSpace.outputlog.println("ZIP file error, trying as text: "+e.getMessage());
			try {
				super.sdataset=OccurrenceInterface.ProcessOccurrenceFile("/tmp/zip_"+super.tmpID);		// if not, try as text file
			} catch (IOException e1) {
				EcoSpace.outputlog.println("Text file error: "+e1.getMessage());
				return false;
			}
		}
		if(super.sdataset==null) {
			try {
				super.sdataset=OccurrenceInterface.ProcessOccurrenceFile("/tmp/"+super.tmpID);
			} catch (IOException e) {
				return false;
			}
		}
		super.close();
		State=DATASETSTATE.IDLE;
		return(super.sdataset==null ? false : true);
	}
	
	public static void unzipAndReadOccurrences(String occurenceFileName,String outfilename) throws IOException {
		FileInputStream fis = new FileInputStream(occurenceFileName);
		ZipInputStream zin = new ZipInputStream(new BufferedInputStream(fis)); 
		ZipEntry entry;
		int count;
		int BUFFER = 20000;
		boolean read=false;
		byte[] data = new byte[BUFFER];
		
		while((entry = zin.getNextEntry()) != null) {
			if(entry.getName().equals("occurrence.txt")) {
				read=true;
				if(entry.getSize()>4*1024*1024*1024) {
					zin.close();
					throw new IOException("File too large, occurrence file should not be larger than 4 Gb"); 
				}
				FileOutputStream fos = new FileOutputStream(outfilename);
				BufferedOutputStream dest = new BufferedOutputStream(fos, BUFFER);
				while ((count = zin.read(data, 0, BUFFER)) != -1) {
					//EcoSpace.outputlog.write(x);
					dest.write(data, 0, count);
				}
				dest.flush();
				dest.close();
				break;
			}
		}
		zin.close();
		if(!read) throw new IOException("Invalid ZIP file, no occurrence.txt found");
	}

}
