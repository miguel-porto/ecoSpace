package pt.floraon.ecospace;

public class InternalQueryService implements QueryService {
	private String query;
	public InternalQueryService(String query) {
		this.query=query;
	}

	@Override
	public String[] executeQuery() {
		return this.query.split(",");
	}
}
