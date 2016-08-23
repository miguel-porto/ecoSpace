package pt.floraon.ecospace;

import java.util.HashMap;
import java.util.Map;

public class NubKeyQueryService implements QueryService {
	private String query;
	public NubKeyQueryService(String query) {
		this.query=query;
	}

	@Override
	public Map<String, Integer> executeQuery() {
		Map<String, Integer> out = new HashMap<String, Integer>();
		for(String s : GlobalOperations.getSpeciesFromNub(this.query.split(","))) {
			out.put(s, 1);
		}
		return out;
	}
}
