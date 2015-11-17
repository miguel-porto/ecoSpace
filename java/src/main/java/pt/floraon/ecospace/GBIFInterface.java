package pt.floraon.ecospace;

import java.io.BufferedReader;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

import org.apache.commons.codec.binary.Base64;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.w3c.dom.Element;

class GBIFInterface extends DataInterface {
	private Integer TaxonKey;
	private String Polygon;
	public String FileKey;

	public GBIFInterface(String description,String url) {
		super(description, "GBIF",url);
	}
	
	public void SetProperties(Integer taxon_key,String polygon) {
		TaxonKey=taxon_key;
		Polygon=polygon;
	}
	
	public boolean ExecuteRequest() {
		State=DATASETSTATE.REQUESTING_FILE;
		try {
			requestData();
		} catch(IOException e) {
			e.printStackTrace();
			State=DATASETSTATE.ERROR;
			return(false);
		}
		State=DATASETSTATE.WAITING_FILE;

		Element el=GlobalOperations.getDataset(super.tmpID);
		el.setAttribute("GBIFfileKey", FileKey);
		GlobalOperations.updateXML();

		if(!GBIFFileKeyInterface.waitForFile(FileKey, super.tmpID)) {
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
	
	@SuppressWarnings("unchecked")
	private void requestData() throws IOException {
		JSONObject req,predicate,pred1,pred2,pred3;
		JSONArray predicates,address;
		String out="";
		req=new JSONObject();
		predicate=new JSONObject();
		predicates=new JSONArray();
		address=new JSONArray();
		address.add("mpbertolo@gmail.com");
		req.put("creator", "miguelporto");
		req.put("notification_address", address);
		
		pred1=new JSONObject();
		pred1.put("type","equals");
		pred1.put("key","HAS_COORDINATE");
		pred1.put("value","true");
		if(TaxonKey>0) {
			pred2=new JSONObject();
			pred2.put("type","equals");
			pred2.put("key","TAXON_KEY");
			pred2.put("value",TaxonKey.toString());
		} else pred2=null;
		pred3=new JSONObject();
		pred3.put("type","within");
		pred3.put("geometry",Polygon);
		
		predicates.add(pred1);
		if(pred2!=null) predicates.add(pred2);
		predicates.add(pred3);
		
		predicate.put("type", "and");
		predicate.put("predicates", predicates);
		req.put("predicate",predicate);

		// read gbif user account from external file
		String[] account=GlobalOperations.getGBIFAccount();
		
		EcoSpace.outputlog.println("Using GBIF account for user "+account[0]);
		URL url = new URL ("http://api.gbif.org/v1/occurrence/download/request");
		String encoding = Base64.encodeBase64String((account[0]+":"+account[1]).getBytes());
		
		HttpURLConnection connection = (HttpURLConnection) url.openConnection();
		connection.setRequestMethod("POST");
		connection.setDoOutput(true);
		
		connection.setRequestProperty("Authorization", "Basic " + encoding);
		connection.setRequestProperty("Content-Type","application/json");
		connection.setRequestProperty("Accept","application/json");
		
		//Send request
		DataOutputStream wr = new DataOutputStream (connection.getOutputStream ());
		wr.writeBytes (req.toJSONString());
		wr.flush();
		wr.close();
		
		InputStream content = (InputStream)connection.getInputStream();
		BufferedReader in=new BufferedReader (new InputStreamReader (content));
		String line;
		while ((line = in.readLine()) != null) {
		    out=out+line;
		}
		FileKey=out;
	}
}
