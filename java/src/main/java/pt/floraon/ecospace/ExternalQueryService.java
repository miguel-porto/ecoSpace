package pt.floraon.ecospace;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import java.net.URLConnection;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;
import org.w3c.dom.Element;

/**
 * Represents an external query service
 * @author miguel
 *
 */
public class ExternalQueryService implements QueryService {
	private String name,domain,path,addparams,qparam,query;
	/**
	 * Constructs a new query from the XML element in the index file, and a query string
	 * @param queryServiceData XML element
	 * @param query Query to be executed
	 */
	public ExternalQueryService(Element queryServiceData,String query) {
		this.query=query;
		this.name=queryServiceData.getElementsByTagName("name").item(0).getTextContent();
		this.domain=queryServiceData.getElementsByTagName("domain").item(0).getTextContent();
		this.path=queryServiceData.getElementsByTagName("path").item(0).getTextContent();
		this.qparam=queryServiceData.getElementsByTagName("queryParam").item(0).getTextContent();
		this.addparams=queryServiceData.getElementsByTagName("additionalParams").item(0).getTextContent();
	}
	
	@Override
	public Map<String, Integer> executeQuery() {
		Map<String, Integer> out = new HashMap<String, Integer>();
		URI uri;
		StringBuilder resp;
		try {
			uri = new URI("http",this.domain,this.path,this.qparam+"="+URLEncoder.encode(this.query, StandardCharsets.UTF_8.toString())+"&"+this.addparams,null);
			URL website = uri.toURL();
			URLConnection yc = website.openConnection();
			BufferedReader in1 = new BufferedReader(new InputStreamReader(yc.getInputStream()));
			String inputLine;
			resp=new StringBuilder();
			while ((inputLine = in1.readLine()) != null)
				resp.append(inputLine);
			in1.close();
		} catch (URISyntaxException | IOException e) {
			return Collections.emptyMap();
		}
		
		// for now, we must hard code the parsing of the response here...
		switch(this.name) {
		case "Flora-On":
			JSONArray respobj=(JSONArray)JSONValue.parse(resp.toString());
			JSONObject sp;
			@SuppressWarnings("unchecked")
			Iterator<JSONObject> species=respobj.iterator();
			while(species.hasNext()) {
				sp=species.next();
				out.put(sp.get("genero")+" "+sp.get("especie"), 1);
			}
			break;
		}
		return out;
	}
}
