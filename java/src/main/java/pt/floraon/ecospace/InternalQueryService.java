package pt.floraon.ecospace;

import java.util.HashMap;
import java.util.Map;

public class InternalQueryService implements QueryService {
	private String query;
	public InternalQueryService(String query) {
		this.query=query;
	}

	@Override
	public Map<String, Integer> executeQuery() {
		Map<String, Integer> out = new HashMap<String, Integer>();
		for(String s : this.query.split(",")) {
			out.put(s, 1);
		}
		return out;
	}
}
