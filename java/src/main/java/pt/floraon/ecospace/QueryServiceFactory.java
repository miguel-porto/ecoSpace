package pt.floraon.ecospace;

import java.io.FileNotFoundException;
import java.io.IOException;

public final class QueryServiceFactory {
	/**
	 * Builds a query service to handle the requested query, of any query type
	 * @param queryType One of "i", "nub", "file" or a custom query type.
	 * @param query
	 * @return A QueryService ready to be executed.
	 * @throws IOException
	 */
	public static QueryService newQueryService(String queryType,String query) throws IOException {
		QueryService qserv;
		if(queryType==null) queryType="i";
		if(query.equalsIgnoreCase("all"))
			return new InternalQueryService("all");
			
		try {
			switch(queryType) {
			case "i":		// comma-separated internal IDs (these IDs depend on the analysis)
				qserv=new InternalQueryService(query);
				break;
			case "nub":		// comma-separated GBIF nubKey values
				qserv=new NubKeyQueryService(query);
				break;
			case "file":
				qserv=new LocalFileQueryService(query);
				break;
			case "json":
				qserv=new JSONQueryService(query);
				break;
				
			default:	// custom query service
				qserv=new ExternalQueryService(GlobalOperations.getQueryService(queryType),query); 
				break;
			}
		} catch (FileNotFoundException e) {
			throw new FileNotFoundException("File not found, have you uploaded it?");
		}
		return qserv;
	}
}
