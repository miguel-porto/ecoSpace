package pt.floraon.ecospace;

import java.io.BufferedReader;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.util.HashSet;
import java.util.Set;
/**
 * Executes a query using a local text file with a list of species, or a list of nubKeys
 * @author miguel
 *
 */
public class LocalFileQueryService implements QueryService {
	private BufferedReader br;
	public LocalFileQueryService(String file) throws IOException,FileNotFoundException {
		br=new BufferedReader(new FileReader(file));
	}
	
	@Override
	public String[] executeQuery() {
		String tmp;
		Set<String> species=new HashSet<String>();
		String[] tmp1;
		try {
			while((tmp=this.br.readLine())!=null) {
				tmp1=tmp.replaceAll("[\"']+", "").split("[ ,\t;]+"); // some very basic CSV parsing... we can use the official lib later
				switch(tmp1.length) {
				case 0: break;
				case 1:
					species.add(tmp1[0]);
					break;
				case 2:
					species.add(tmp1[0]+" "+tmp1[1]);
					break;
				default:	// the line has more than 2 words. The most likely scenario is that it is an infraspecific taxon, so we get the first 2 words...
					species.add(tmp1[0]+" "+tmp1[1]);
					continue;	// we only accept canonical species names for now (no infraspecific ranks)	
				}
			}
			this.br.close();
		} catch (IOException e) {
			return null;
		}
		String[] processedQuery = new String[0];
		return species.toArray(processedQuery);
	}

}
