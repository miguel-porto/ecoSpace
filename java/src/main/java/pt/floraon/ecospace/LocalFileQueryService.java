package pt.floraon.ecospace;

import java.io.BufferedReader;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
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
	public Map<String, Integer> executeQuery() {
		String tmp;
		Map<String, Integer> out = new HashMap<String, Integer>();
		String[] tmp1;
		try {
			while((tmp=this.br.readLine())!=null) {
				tmp1=tmp.replaceAll("[\"']+", "").split("[ ,\t;]+"); // some very basic CSV parsing... we can use the official lib later
				switch(tmp1.length) {
				case 0: break;
				case 1:
					out.put(tmp1[0], 1);
					break;
				case 2:
					out.put(tmp1[0]+" "+tmp1[1], 1);
					break;
				default:	// the line has more than 2 words. The most likely scenario is that it is an infraspecific taxon, so we get the first 2 words...
					out.put(tmp1[0]+" "+tmp1[1], 1);
					continue;	// we only accept canonical species names for now (no infraspecific ranks)	
				}
			}
			this.br.close();
		} catch (IOException e) {
			return Collections.emptyMap();
		}
		return out;
	}

}
