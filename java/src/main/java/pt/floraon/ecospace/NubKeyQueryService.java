package pt.floraon.ecospace;

public class NubKeyQueryService implements QueryService {
	private String query;
	public NubKeyQueryService(String query) {
		this.query=query;
	}

	@Override
	public String[] executeQuery() {
		return GlobalOperations.getSpeciesFromNub(this.query.split(","));
	}
}
