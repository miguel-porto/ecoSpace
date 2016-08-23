package pt.floraon.ecospace;

import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.apache.http.NameValuePair;

// http://omtlab.com/java-run-javah-from-eclipse/

public class nativeFunctions {
	static native int readVariablesFromCoords(float[] lat,float[] lng,int[] IDs,int nTaxa,String dID);
	static native long initProgressDistanceMatrix();	// allocates a new progress indicator
	static native long computeDistanceMatrix(String dID,String aID,long handle);
	static native int getProgressDistanceMatrix(long handle,boolean free);
	static native int computeKernelDensities(String dID,String aID,int[] variables,int frequencyThreshold,float sigmaPercent,boolean downWeight);
	static native String exportExtractedVariables(String dID);
	static native long[] openDistanceMatrix(String dID,String aID);
	static native String exportDistanceMatrix(long handle);
	//static native String queryRelatedTaxa(long handle,int taxID,int nlevels,int maxperlevel);
	/**
	 * Loads neighbors of target taxa
	 * @param handle	C pointer to distance structure (returned by {@link openDistanceMatrix})
	 * @param taxID		Array of internal (target) taxon IDs
	 * @param nlevels	Number of neighbor levels to expand from the target taxa
	 * @param maxperlevel	Number of neighbors to load in each expanded level
	 * @param loadSecondaryLinks	Boolean indicating whether to create relationships between loaded neighbors, or only between target taxa and their direct neighbors
	 * @param makeClusters	Boolean. Use Infomap to partition the network into clusters?
	 * @return	JSON string ready for d3.js
	 */
	static native String getRelationships(long handle,int[] taxID, int[] abundances,int nlevels,int maxperlevel,boolean loadSecondaryLinks,boolean makeClusters);
	static native int closeDistanceMatrix(long handle);
	static native byte[] getDensityPNG();
	static {
        System.loadLibrary("ecoSpace-JNI");
    }
	
	public static int[] toPrimitiveInt(List<Integer> numbers)	{
	    int[] ret = new int[numbers.size()];
	    Iterator<Integer> iterator = numbers.iterator();
	    for (int i = 0; i < ret.length; i++) ret[i] = iterator.next().intValue();
	    return ret;
	}
	public static Integer[] stringToIntArray(String arr) {
		String[] items = arr.replaceAll("\\[", "").replaceAll("\\]", "").replaceAll(" ", "").split(",");

		Integer[] results = new Integer[items.length];

		for (int i = 0; i < items.length; i++) {
			results[i] = Integer.parseInt(items[i]);
		}
		return(results);
	}
	
	public static String getQSValue(String key,List<NameValuePair> qs) {
		if(qs==null) return null;
		for(NameValuePair i:qs) {
			if(i.getName().equals(key)) return(i.getValue());
		}
		return null;
	}
// from http://stackoverflow.com/questions/13592236/parse-the-uri-string-into-name-value-collection-in-java	
	public static Map<String, String> splitQuery(String query) throws UnsupportedEncodingException {
	    Map<String, String> query_pairs = new LinkedHashMap<String, String>();
	    String[] pairs = query.split("&");
	    for (String pair : pairs) {
	        int idx = pair.indexOf("=");
	        query_pairs.put(URLDecoder.decode(pair.substring(0, idx), "UTF-8").toLowerCase(), URLDecoder.decode(pair.substring(idx + 1), "UTF-8"));
	    }
	    return query_pairs;
	}	
/*
	public static float[] toPrimitiveFloat(List<Float> numbers)	{
	    float[] ret = new float[numbers.size()];
	    Iterator<Float> iterator = numbers.iterator();
	    for (int i = 0; i < ret.length; i++)
	    {
	        ret[i] = iterator.next().floatValue();
	    }
	    return ret;
	}
*/
}
