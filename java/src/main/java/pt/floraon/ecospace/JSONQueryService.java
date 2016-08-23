package pt.floraon.ecospace;

import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

import org.json.simple.JSONArray;
import org.json.simple.parser.JSONParser;
import org.json.simple.parser.ParseException;

public class JSONQueryService implements QueryService {
	private String query;
	public JSONQueryService(String query) {
		this.query=query;
	}

	@Override
	public Map<String, Integer> executeQuery() {
		Map<String, Integer> out = new HashMap<String, Integer>();
		//System.out.println(this.query);
		JSONParser jp = new JSONParser();
		JSONArray obj;
		JSONArray line;
		try {
			obj=(JSONArray) jp.parse(this.query);
		} catch (ParseException e) {
			e.printStackTrace();
			return Collections.emptyMap();
		}
		
		@SuppressWarnings("unchecked")
		Iterator<JSONArray> species = obj.iterator();
		while(species.hasNext()) {
			line = species.next();
			out.put(line.get(0).toString(), Integer.parseInt(line.get(1).toString()));
			//System.out.println(line.get(0).toString() +": "+ Integer.parseInt(line.get(1).toString()));
		}
		return out;
	}
/*	
	JSONArray respobj=(JSONArray)JSONValue.parse(resp.toString());
	JSONObject sp;
	@SuppressWarnings("unchecked")
	Iterator<JSONObject> species=respobj.iterator();
	while(species.hasNext()) {
		sp=species.next();
		out.put(sp.get("genero")+" "+sp.get("especie"), 1);
	}
*/
}
