package pt.floraon.ecospace;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;

/**
 * This class is currently not used.
 * @author miguel
 *
 */
public class TaxonomyRequests {
	private static Integer pageSize=500;
	public static String getOrders(String kingdom) {
		String out="",tmps="";
		Integer offset=0;
		Boolean end;
		JSONObject tmp=new JSONObject();
		//http://api.gbif.org/v1/species/search?q=plantae&rank=ORDER
		do {
			try {
				URL url = new URL ("http://api.gbif.org/v1/species/search?q="+kingdom+"&rank=ORDER&nameType=WELLFORMED&status=ACCEPTED&datasetKey=d7dddbf4-2cf0-4f39-9b2a-bb099caae36c&limit="+pageSize+"&offset="+offset);
				//URL url = new URL ("http://api.gbif.org/v1/species/match?kingdom="+kingdom+"&strict=true&rank=ORDER");
				HttpURLConnection connection = (HttpURLConnection) url.openConnection();
				connection.setRequestMethod("GET");
				connection.setDoOutput(true);
				
				//Send request		
				InputStream content = (InputStream)connection.getInputStream();
				BufferedReader in=new BufferedReader (new InputStreamReader (content));
				String line;
				while ((line = in.readLine()) != null) {
				    tmps=tmps+line;
				}
			} catch(Exception e) {
				e.printStackTrace();
			}
			
			JSONObject resp=(JSONObject)JSONValue.parse(tmps);
			tmps="";
			end=Boolean.parseBoolean(resp.get("endOfRecords").toString());
			//Integer nresults=Integer.parseInt(resp.get("count").toString());
			
			JSONArray res=(JSONArray)resp.get("results");
			for(Object o:res) {
				tmp=(JSONObject)o;
				out+=tmp.get("orderKey")+"\t"+tmp.get("canonicalName")+"\n";
			}
			EcoSpace.outputlog.println(tmps);
			offset+=pageSize;
		} while(!end);
		return(out);
	}

	@SuppressWarnings("unchecked")
	public static String getKingdoms() {
		String tmps="";
		JSONObject tmp=new JSONObject();
		try {
			URL url = new URL ("http://api.gbif.org/v1/species/search?rank=KINGDOM&nameType=WELLFORMED&status=ACCEPTED&datasetKey=d7dddbf4-2cf0-4f39-9b2a-bb099caae36c");
			//URL url = new URL ("http://api.gbif.org/v1/species/match?kingdom="+kingdom+"&strict=true&rank=ORDER");
			HttpURLConnection connection = (HttpURLConnection) url.openConnection();
			connection.setRequestMethod("GET");
			connection.setDoOutput(true);
			
			//Send request		
			InputStream content = (InputStream)connection.getInputStream();
			BufferedReader in=new BufferedReader (new InputStreamReader (content));
			String line;
			while ((line = in.readLine()) != null) {
			    tmps=tmps+line;
			}
		} catch(Exception e) {
			e.printStackTrace();
		}
		
		JSONObject resp=(JSONObject)JSONValue.parse(tmps),tmp1;
	
		JSONArray res=(JSONArray)resp.get("results"),outres=new JSONArray();
		for(Object o:res) {
			tmp=(JSONObject)o;
			tmp1=new JSONObject();
			tmp1.put("taxonKey", tmp.get("kingdomKey"));
			tmp1.put("name", tmp.get("canonicalName"));
			outres.add(tmp1);
		}
		return(outres.toJSONString());
	}
}
