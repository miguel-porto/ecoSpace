package pt.floraon.ecospace;

import java.awt.Color;
import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.InputStreamReader;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.net.Socket;
import java.net.SocketException;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.ConcurrentModificationException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.apache.commons.codec.binary.Base64InputStream;
import org.apache.commons.io.IOUtils;
import org.apache.http.HttpResponse;
import org.apache.http.NameValuePair;
import org.apache.http.ProtocolVersion;
import org.apache.http.RequestLine;
import org.apache.http.client.utils.URIBuilder;
import org.apache.http.client.utils.URLEncodedUtils;
import org.apache.http.message.BasicHeader;
import org.apache.http.message.BasicHttpResponse;
import org.apache.http.message.BasicLineParser;
import org.apache.http.message.BasicStatusLine;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import pt.floraon.ecospace.Dataset.Analysis;
import pt.floraon.ecospace.Dataset.DatasetException;
import static pt.floraon.ecospace.nativeFunctions.*;

public class ServerDispatch implements Runnable{
    protected Socket clientSocket = null;
    protected String serverText   = null;
    protected DatasetServer datasetServer=null;
    protected MultiThreadedServer thr;

    public ServerDispatch(Socket clientSocket, String serverText,DatasetServer dss,MultiThreadedServer thr) {
        this.clientSocket = clientSocket;
        this.serverText   = serverText;
        this.datasetServer=dss;
        this.thr=thr;
    }
    
    @SuppressWarnings("unchecked")
	public static String error(String msg) {
		JSONObject jobj=new JSONObject();
		jobj.put("success", false);
		jobj.put("msg", msg);
		return(jobj.toJSONString());
	}
    
	public static String error(String msg,String format) {
		switch(format) {
		case "json":
			return error(msg);
		case "html":
			return "<p style=\"visibility:hidden\">"+msg+"</p>";
		case "page":
			return "<!DOCTYPE html><html xmlns=\"http://www.w3.org/1999/xhtml\" lang=\"en\"><body><p style=\"\">"+msg+"</p></body></html>";
		default:
			return error(msg);
		}
	}

	@SuppressWarnings("unchecked")
	public static String success(Object msg) {
		JSONObject jobj=new JSONObject();
		jobj.put("success", true);
		jobj.put("msg", msg);
		return(jobj.toJSONString());
	}
    
    @SuppressWarnings("unchecked")
	public void run() {
    	Process pr;
    	Dataset ds;
    	String dID,aID,tmp,query,queryType;
    	
    	int i;
    	OutputStream ostr=null;
    	JSONObject jobj;
		try {
			ostr = clientSocket.getOutputStream();
		} catch (IOException e1) {
			e1.printStackTrace();
		}
        try(BufferedReader in = new BufferedReader(new InputStreamReader(clientSocket.getInputStream()));) {
        	PrintWriter out=null;
        	String line=in.readLine();
        	BasicLineParser blp=new BasicLineParser();
        	RequestLine requestline=BasicLineParser.parseRequestLine(line,blp);
        	URI url=new URIBuilder(requestline.getUri()).build();
        	List<NameValuePair> qs=null;
        	if(url.getQuery()!=null) qs=URLEncodedUtils.parse(url.getRawQuery().toString(),StandardCharsets.UTF_8);

        	//    		curl -G 'localhost:7530/adddataset/dwc' --data-urlencode "url=http://flora-on.pt:8080/ipt/archive.do?r=flora-on" --data-urlencode "desc=Plantas do Flora-On"

    		String[] path=url.getPath().split("/");
    		if(path.length==0 || (path.length>1 && url.getPath().contains("."))) {	// asking for a web page!
    			if(path.length<2) path=new String[] {"","index.html"};
    			HttpResponse res=new BasicHttpResponse(new BasicStatusLine(new ProtocolVersion("HTTP",1,1),200,""));
    			Pattern ext=Pattern.compile("\\.([a-zA-Z]+)$",Pattern.CASE_INSENSITIVE);
    			Matcher match=ext.matcher(path[path.length-1].trim());
    			if(match.find()) {
    				switch(match.group(1)) {
    				case "html":
    				case "htm":
    					out = new PrintWriter(new OutputStreamWriter(ostr, StandardCharsets.UTF_8), true);
    					res.addHeader(new BasicHeader("Content-Type:","text/html"));
    					break;
    				case "png":
    					out = new PrintWriter(ostr);
    					res.addHeader(new BasicHeader("Content-Type:","image/png"));
    					break;
    				case "js":
    					out = new PrintWriter(ostr);
    					res.addHeader(new BasicHeader("Content-Type:","application/javascript"));
    					break;
    				case "css":
    					out = new PrintWriter(ostr);
    					res.addHeader(new BasicHeader("Content-Type:","text/css"));
    					break;
    				default:
    					out = new PrintWriter(new OutputStreamWriter(ostr, StandardCharsets.UTF_8), true);
    					res.addHeader(new BasicHeader("Content-Type:","text/html"));
    					break;
    				}
    			}
    			out.print(res.toString()+"\r\n");
    			out.print("\r\n");
    			out.flush();
    			File page;
    			if(path.length==2)
    				page=new File("web/"+path[1]);
    			else
    				page=new File("web/"+path[1]+"/"+path[2]);
    			IOUtils.copy(new FileInputStream(page), ostr);
    			out.close();
    			return;
			}

    		out = new PrintWriter(new OutputStreamWriter(ostr, StandardCharsets.UTF_8), true);
    		switch(path[1]) {
    		case "stop":
    			thr.stop(out);
    			break;
    		case "delete":
    			switch(path.length) {
    			case 2:
    				out.println(datasetServer.GetState());
    				break;
    			case 3:
    				ds=datasetServer.datasets.get(path[2]);
    				if(ds==null) {out.println(error("No such dataset ID."));break;}
    				GlobalOperations.removeDataset(path[2]);
    				GlobalOperations.updateXML();
    				datasetServer.datasets.remove(path[2]);
    				File dir=new File("data/");
    				File[] files=dir.listFiles();
    				for(File f:files) {
    					if(f.getName().contains(path[2])) {
    						out.println(f.getName());
    						f.delete();
    					}
    				}
    				break;
    			case 4:
    				ds=datasetServer.datasets.get(path[2]);
    				if(ds==null) {out.println(error("No such dataset ID."));break;}
    				GlobalOperations.removeAnalysis(path[2],path[3]);
    				GlobalOperations.updateXML();
    				ds.analyses.remove(path[3]);
    				File dir1=new File("data/");
    				File[] files1=dir1.listFiles();
    				for(File f:files1) {
    					if(f.getName().contains(path[3])) {
    						out.println(f.getName());
    						f.delete();
    					}
    				}
    				break;
    			}
    			break;
    		case "status":
    			switch(path.length) {
    			case 2:
    				out.println(datasetServer.GetState());
    				break;
    			case 3:
    				ds=datasetServer.datasets.get(path[2]);
    				if(ds!=null) {
    					jobj=new JSONObject();
    					jobj.put("id", path[2]);
    					jobj.put("state", GlobalOperations.translateDatasetState(ds.GetState())+(ds.getProgress()==null ? "" : " "+ds.getProgress()+" records processed."));
    					jobj.put("ready", (ds.GetState()==DATASETSTATE.IDLE ? true : false));
    					out.println(success(jobj));
    					//out.println("{\"success\":true,\"id\":\""+path[2]+"\",\"state\":\""+GlobalOperations.translateDatasetState(ds.GetState())+(ds.getProgress()==null ? "" : " "+ds.getProgress()+" records processed.")+"\",\"ready\":"+(ds.GetState()==DATASETSTATE.IDLE ? true : false)+"}");
    				} else
    					out.println(error("No such dataset ID."));
    				break;
    			case 4:
    				ds=datasetServer.datasets.get(path[2]);
    				if(ds!=null) {
    					Analysis an=ds.analyses.get(path[3]);
    					if(an!=null) {
    						Integer maxf;
    						if(ds.TaxonFrequencies.size()>0) {
	    						try {
	    							maxf=Collections.max(ds.TaxonFrequencies);
	    						} catch(ConcurrentModificationException e) {
	    							maxf=0;
	    						}
    						} else maxf=0;
    						jobj=new JSONObject();
    						jobj.put("id", path[3]);
    						jobj.put("state", an.getState());
    						jobj.put("ready", an.isReady());
    						jobj.put("minfreq", an.getMinFrequency());
    						jobj.put("sigmapercent", an.getSigmaPercent());
    						jobj.put("maxfreq", maxf);
    						out.println(success(jobj));
    						//out.println("{\"success\":true,\"id\":\""+path[3]+"\",\"state\":\""+an.getState()+"\",\"ready\":"+an.isReady()
    						//		+",\"minfreq\":"+an.getMinFrequency()+",\"sigmapercent\":"+an.getSigmaPercent()+",\"maxfreq\":"+maxf+"}");
    					} else
    						out.println(error("No such analysis ID"));
    				} else
    					out.println(error("No such dataset ID"));
    				break;
    			}
    			break;
    		case "close":
    			datasetServer.Close();
    			break;
    		case "clean":
    			int cl=datasetServer.CleanXMLIndex();
    			out.println(success("Cleaned "+cl+" empty datasets."));
    			break;
    		case "empty":
    			datasetServer.Close();
    			datasetServer.Empty();
				File dir=new File("data/");
				File[] files=dir.listFiles();
				for(File f:files) {
					f.delete();
				}
				out.println(success("Erased all datasets."));
    			break;
    			
    		case "getdatasets":
/*    			BasicHttpResponse response=new BasicHttpResponse(HttpVersion.HTTP_1_1,HttpStatus.SC_OK,null);
    			response.addHeader(new BasicHeader("Content-type","application/json"));
    			out.print(response.toString());*/
    			out.println(datasetServer.GetDatasets());
    			break;
    		
    		case "getdatasetdetails":
    			if(qs.size()==0) out.println("You must supply the dataset ID. Example:\ngetdatasetdetails?did=65d"); else {
    				dID=getQSValue("did",qs);
    				ds=datasetServer.datasets.get(dID);
    				if(ds!=null) {
    					jobj=new JSONObject();
    					jobj.put("success",true);
    					jobj.put("numspec", ds.taxonNames.size());
    					jobj.put("desc", ds.getDescription());
    					jobj.put("origin", ds.getOrigin());
    					jobj.put("url", ds.getUrl());
    					jobj.put("numrecords", ds.getNumRecords());
    					jobj.put("densmap","distr-map.php?did="+dID+"&q=all&x=500&y=500&nc=8&sig=0.017&r=0&g=0&b=255&buf=2&m=0.1");
    					JSONArray spp=new JSONArray();
    					for(String tn : ds.taxonNames) {
    						spp.add(tn);
    					}
    					jobj.put("species", spp);
    					out.println(jobj.toJSONString());
    				} else out.println("{\"success\":false,\"msg\":\"No such dataset ID\"}");
    			}
    			break;
    			
    		case "getanalyses":
    			if(qs==null || qs.size()==0) out.println(error("You must supply the dataset ID. Example:\ngetanalyses?did=65d79")); else {
    				dID=nativeFunctions.getQSValue("did",qs);
    				ds=datasetServer.datasets.get(dID);
    				if(ds!=null) {
    					jobj=new JSONObject();
    					jobj.put("success",true);
    					jobj.put("desc",ds.getDescription());
    					JSONArray analy=new JSONArray();
    					for(Analysis an:ds.analyses.values()) {
    						analy.add(an.toJSON());
    					}
    					jobj.put("analyses", analy);
    					out.println(jobj.toJSONString());
    				} else out.println(error("No such dataset ID"));
    			}
    			break;
    		case "getvariables":
    			NodeList varnl=GlobalOperations.getVariables();
    			Element tmpel;
    			String html=getQSValue("html", qs);
    			if(html==null || html=="0") {
	    			JSONArray outv=new JSONArray();
					jobj=new JSONObject();
	    			for(i=0;i<varnl.getLength();i++) {
	    				tmpel=((Element)varnl.item(i));
	    				jobj=new JSONObject();
	    				jobj.put("title", tmpel.getAttribute("title"));
	    				jobj.put("name", tmpel.getAttribute("file").replace(".tif", ""));
	    				jobj.put("abbrev", tmpel.getAttribute("abbrev"));
	    				outv.add(jobj);
	    			}
	    			out.println(outv.toJSONString());
    			} else {
	    			for(i=0;i<varnl.getLength();i++) {
	    				tmpel=((Element)varnl.item(i));
	    				out.print("<li data-file=\""+tmpel.getAttribute("file").replace(".tif", "")+"\">"+tmpel.getAttribute("title")+"</li>");
	    			}
    			}
    			break;
    			
    		case "newauthkey":
    			String pass=getQSValue("pass",qs);
    			String[] account=GlobalOperations.getGBIFAccount();
    			if(pass==null || !pass.equals(account[1])) {out.println(error("Unauthorized command"));break;}
    			out.println(success(GlobalOperations.newAuthorizationKey()));
    			break;
    		
    		case "requestauth":
    			String email=getQSValue("email",qs);
    			String reason=getQSValue("reason",qs);
    			File req=new File("KeyRequests.txt");
    			BufferedWriter bw=new BufferedWriter(new FileWriter(req,true));
    			bw.write(email+"\t"+reason+"\n");
    			bw.close();
    			out.println(success(null));
    			break;
    			
    		case "adddataset":
/*    			String authkey=getQSValue("auth",qs);
    			if(authkey==null) {out.println(error("You have to provide an authorization key as the parameter auth"));break;}
    			if(!GlobalOperations.checkAuthorizationKey(authkey)) {out.println(error("Invalid authorization key. Contact administrator to request a key."));break;}
    			*/
    			if(path.length<3) {out.println(error("What type of dataset? dwc | gbif | gbifkey"));break;}
    			switch(path[2]) {
    			case "local":	// add from a local DWC text file
    				if(qs.size()==0) out.println(error("You must supply the full path of the DWC text table and a description.")); else {
        				String file=getQSValue("file",qs);
        				String desc1=getQSValue("desc",qs);
    					
	    				OccurrenceInterface occ=new OccurrenceInterface(desc1,"Local file");
	    				occ.SetProperties(file);
	        			ds=new Dataset(occ);
	        			datasetServer.datasets.put(ds.dID, ds);
	        			if(ds.dID!=null) out.println("{\"success\":true,\"did\":\""+ds.dID+"\"}");
    				}
    				break;
    			case "dwc":
        			if(qs.size()==0) out.println("You must supply the URL of the DWC archive and a description."); else {
        				String urlar=getQSValue("url",qs);
        				String desc=getQSValue("desc",qs);
        				if(urlar==null || desc==null) {out.println("You must supply the URL of the DWC archive and a description.");break;}
        				if(urlar.trim().equals("") || desc.trim().equals("")) {out.println("You must supply the URL of the DWC archive and a description.");break;}
            			DWCFileInterface dwc=new DWCFileInterface(desc,urlar);
            			ds=new Dataset(dwc);
            			datasetServer.datasets.put(ds.dID, ds);
            			if(ds.dID!=null) out.println("{\"success\":true,\"did\":\""+ds.dID+"\"}");
        			}
    				break;
    			case "gbif":
        			if(qs.size()==0) out.println("You must supply the taxonKey, description and WKT."); else {
        				String tkey=getQSValue("tkey",qs);
        				String desc=getQSValue("desc",qs);
        				String wkt=getQSValue("wkt",qs);
        				if(tkey==null || desc==null || wkt==null) {out.println("You must supply the taxonKey, description and WKT.");break;}
        				GBIFInterface gbif=new GBIFInterface(desc,null);
        				gbif.SetProperties(Integer.parseInt(tkey),wkt);	//"POLYGON((-9.78 44.11,-10.17 35.71,4.56 35.08,4.67 44.17,-9.78 44.11))"
            			ds=new Dataset(gbif);
            			datasetServer.datasets.put(ds.dID, ds);
            			if(ds.dID!=null) out.println("{\"success\":true,\"did\":\""+ds.dID+"\"}");
        			}
    				break;
    			case "gbifkey":
        			if(qs.size()==0) out.println("You must supply the download file key and a description."); else {
        				String tkey=nativeFunctions.getQSValue("fkey",qs);
        				String desc=nativeFunctions.getQSValue("desc",qs);
        				if(tkey==null || desc==null) {out.println("You must supply the URL of the DWC archive and a description.");break;}
        				GBIFFileKeyInterface gbif=new GBIFFileKeyInterface(desc,null);
        				gbif.SetProperties(tkey);
            			ds=new Dataset(gbif);
            			datasetServer.datasets.put(ds.dID, ds);
            			if(ds.dID!=null) out.println("{\"success\":true,\"did\":\""+ds.dID+"\"}");
        			}
    				break;
    			}
    			break;

    		case "testfile":
    			Map<Integer, Integer> taxonids1=new HashMap<Integer, Integer> ();
    			dID=nativeFunctions.getQSValue("did",qs);
    			String file=nativeFunctions.getQSValue("sl",qs);		// this is the file name where the species list is stored (under ./uploads)
    			LocalFileQueryService lfqs=new LocalFileQueryService(file);
    			Map<String, Integer> query1=lfqs.executeQuery();
    			ds=datasetServer.datasets.get(dID);
    			if(ds==null) {
    				out.println(error("No such dataset"));
    				break;
    			}
				taxonids1=ds.taxonNames.parseQuery(query1);
    			out.println(success(taxonids1.size()+" species found out of "+query1.size()));
    			break;

    		case "exportvariables":
    			dID = getQSValue("did",qs);
    			ds = datasetServer.datasets.get(dID);
    			if(ds == null) {out.println(error("Dataset not found.","page"));break;}
    			String table = nativeFunctions.exportExtractedVariables(dID);
    			BufferedReader tabbuf = new BufferedReader(new FileReader(new File(table)));
    			BufferedWriter outtab = new BufferedWriter(new FileWriter(new File(table+"_out")));
    			String line1;
    			String[] fields;
    			line1 = tabbuf.readLine();		// this is the header
    			fields = line1.split("\t");
    			outtab.write("taxon\tID\tlatitude\tlongitude");
    			
    			for(Dataset.Variable va : ds.Variables) {
    				outtab.write("\t" + va.abbrev);
    			}
    			outtab.write("\n");

    			while((line1 = tabbuf.readLine()) != null) {
    				fields = line1.split("\t");
    				outtab.write(ds.taxonNames.get(Integer.parseInt(fields[0])));
    				for(String s : fields) {
    					outtab.write("\t" + s);
    				}
    				outtab.write("\n");
    			};
    			
    			tabbuf.close();
    			outtab.close();

    			HttpResponse res2 = new BasicHttpResponse(new BasicStatusLine(new ProtocolVersion("HTTP",1,1),200,""));
				out = new PrintWriter(new OutputStreamWriter(ostr, StandardCharsets.UTF_8), true);
				res2.addHeader(new BasicHeader("Content-Type:","text/plain"));
    			out.print(res2.toString()+"\r\n");
    			out.print("\r\n");
    			out.flush();
    			IOUtils.copy(new FileInputStream(new File(table+"_out")), ostr);
    			out.close();
    			//out.println(success(table+"_out"));
    			return;
    			
    		case "distdownload":
    			dID=getQSValue("did",qs);
				aID=getQSValue("aid",qs);
				if(datasetServer.getNDistanceDownloads()>0) {out.println(error("ecoSpace server is too busy at the moment. Please try again later. You can hit F5 to refresh this page, it will start downloading your requested file when ready.","page"));break;}
				ds=datasetServer.datasets.get(dID);
				if(ds==null) {out.println(error("Dataset not found.","page"));break;}
				Analysis an=ds.analyses.get(aID);
				if(an==null) {out.println(error("Analysis not found.","page"));break;}
				// this writes two temp files, one with the distnace matrix itself, other with the species IDs that correspond

				datasetServer.pushDistanceDownload();
				String distmat=an.downloadDistanceMatrix();
				String idfile=distmat.replace("/dist", "/idfi");
				String spfile=distmat.replace("/dist", "/spfi");
				String rdatafile="/tmp/distances_"+distmat.substring(distmat.length()-6)+".rdata";
				BufferedWriter bwsp=new BufferedWriter(new FileWriter(new File(spfile)));
				BufferedReader brid=new BufferedReader(new FileReader(new File(idfile)));
				for(String ids:brid.readLine().split("\t")) {
					if(Integer.parseInt(ids)<0)
						bwsp.write("NA\n");
					else
						bwsp.write(ds.taxonNames.get(Integer.parseInt(ids))+"\n");
				}
				brid.close();
				bwsp.close();
				// convert the text files into an Rdata file
				pr = null;
				try {
					pr = Runtime.getRuntime().exec(new String[] {"R", "-e","a=read.table('"+spfile+"',sep='\\t',strings=F)[,1]; b=as.matrix(read.table('"+distmat+"' ,h=F,sep='\\t'))/254; colnames(b)=a; rownames(b)=a; distances=as.dist(b); save(distances,file='"+rdatafile+"')"});
					pr.waitFor();
				} catch (IOException | InterruptedException e) {
					datasetServer.popDistanceDownload();
					e.printStackTrace();
					break;
				} finally {
					if(pr != null) {
						IOUtils.closeQuietly(pr.getInputStream());
						IOUtils.closeQuietly(pr.getOutputStream());
						IOUtils.closeQuietly(pr.getErrorStream());
						pr.destroy();
					}
				}
				
				FileInputStream fis=new FileInputStream(new File(rdatafile));
				try {
					IOUtils.copy(fis, ostr);
				} catch(SocketException e) {
					e.printStackTrace();
				}
				datasetServer.popDistanceDownload();
				fis.close();
				Files.delete(Paths.get(rdatafile));
				Files.delete(Paths.get(idfile));
				Files.delete(Paths.get(spfile));
				Files.delete(Paths.get(distmat));
    			break;

    		case "open":	// make new analysis (if it doesn't exist already) and return the analysis ID
    			if(qs.size()==0) out.println(error("You must supply the dataset dataset ID and the variables to analyse. Example:\nopen?id=65d79c6083&v=0,1,2&min=100&sig=0.02")); else {
    				dID=getQSValue("did",qs);
    				String v=getQSValue("v",qs);
    				String min=getQSValue("min",qs);
    				String sig=getQSValue("sig",qs);
    				String dw=getQSValue("dw",qs);
    				if(dw==null) dw="1";
    				if(dID==null || v==null || min==null || sig==null) {out.println(error("You must supply all four parameters: id, v, min, sig."));break;}
    				ds=datasetServer.datasets.get(dID);
    				if(ds==null) {out.println(error("Dataset "+dID+" not found."));break;}
    				String[] varss=v.split(",");
    				Integer[] varsc;
    				try {
    					varsc=ds.GetVariableCodes(varss);
    				} catch (IOException e) {
    					out.println(error("Some variable name(s) not found."));
    					break;
    				}
    				try {
    					aID=datasetServer.analyze(dID, varsc, Integer.parseInt(min),Float.parseFloat(sig),Integer.parseInt(dw)==1);
    				} catch (IOException e) {
    					out.println(error(e.getMessage()));
    					break;
    				}
    				out.println(success(aID));
    			}
    			break;
    			
    		case "get":		// query one analysis
    			if(qs.size()==0) out.println("You must supply the dataset dataset ID and the variables to analyse. Example:\nopen?id=65d&v=0,1,2&min=100&sig=0.02"); else {
    				dID=getQSValue("did",qs);
    				aID=getQSValue("aid",qs);
    				query=getQSValue("q",qs);	// this is a query that is sent as is to an external web service or local file
    				queryType=getQSValue("t",qs);	// this is either a taxon name or taxon ID query that is only searched internally
    				// NOTE: if query is 'all', the full network will be returned.
    				String makeClusters=getQSValue("cls",qs);
    				String nnei=getQSValue("nn",qs);
    				String nlev=getQSValue("lev",qs);
    				String tmp2=getQSValue("sec",qs);
    				String fmt=getQSValue("fmt",qs);
    				if(fmt==null) fmt="json"; else fmt=fmt.toLowerCase();
    				boolean loadSecondary=(tmp2==null ? false : (tmp2.equals("0") ? false : true));
    				Map<Integer, Integer> taxonids=new HashMap<Integer, Integer>();
    				Map<String, Integer> processedQuery=null;
    				if(dID==null || aID==null || query==null) {out.println(error("You must supply all four parameters: did, aid and q.",fmt));break;}
    				if(nnei==null) nnei="8";
    				if(nlev==null) nlev="1";
    				if(Integer.parseInt(nlev)>5) {out.println(error("Expanding more than 5 orders is not allowed.",fmt));break;}
    				
    				ds=datasetServer.datasets.get(dID);
    				if(ds==null) {out.println(error("Dataset not found.",fmt));break;}

    				QueryService qserv=null;
    				try {
    					qserv=QueryServiceFactory.newQueryService(queryType, query);
    				} catch (IOException e) {
    					out.println(error(e.getMessage(),fmt));
    					break;
    				}
    				
    				processedQuery=qserv.executeQuery();

    				if(fmt.equals("html") && processedQuery.size()>1) {out.println("<p style=\"visibility:hidden\">Requests in HTML format must be single-species queries.</p>");break;}

    				taxonids = ds.taxonNames.parseQuery(processedQuery);
					if(taxonids.size() == 0) {
						out.println(error("Query returned no results.",fmt));
						break;
					}
    				
					String resp=null;

					try {
						resp = datasetServer.Query(dID, aID, taxonids
								, Integer.parseInt(nnei),Integer.parseInt(nlev), loadSecondary
								, makeClusters==null ? true : makeClusters.equals("1")	// make clusters by default
								, queryType.equals("json") ? true : false);
					} catch (NumberFormatException e) {
						e.printStackTrace();
						break;
					} catch (DatasetException | IOException e) {
						out.println(error(e.getMessage(),fmt));
						break;
					}

					jobj=(JSONObject)JSONValue.parse(resp);
					JSONObject tmpo;
					if(!Boolean.parseBoolean(jobj.get("success").toString())) {out.println(error(jobj.get("msg").toString(),fmt));break;}
					JSONObject outj=new JSONObject();
					JSONArray nodes=(JSONArray) jobj.get("nodes");

					for(Object o:nodes) {		// for each taxon, add taxon names (the C routines only work with IDs)
						tmpo=(JSONObject)o;
						tmp=ds.taxonNames.get(Integer.parseInt(tmpo.get("id").toString()));
						tmpo.put("name", tmp);
						tmpo.put("nubKey",GlobalOperations.getNubFromSpecies(tmp));
					}
					outj.put("maxfreq", Collections.max(ds.TaxonFrequencies));
					outj.put("success", true);
					outj.put("order", Integer.parseInt(nlev));
					outj.put("nneighbors", Integer.parseInt(nnei));
					outj.put("results",jobj);

					JSONArray links;
					switch(fmt) {
					case "json":
						out.println(outj.toJSONString());
						break;
					case "html":	// output as HTML. Here, we must sort species by their distances.
						// first get the root node that was queried (note that, to get to here, only one root node was allowed)
						tmpo=null;
						for(Object o:nodes) {
							tmpo=(JSONObject)o;
							if(Integer.parseInt(tmpo.get("ori").toString())==1) break;
						}
						if(tmpo==null) {out.println(error("Unexpected error in processing: probably no relations found for queried species.",fmt));break;}
						
						int idroot=Integer.parseInt(tmpo.get("id").toString());
						links=(JSONArray) jobj.get("links");
						Map<String,Float> tmpmap=new HashMap<String,Float>();
						for(Object l:links) {	// get only the nodes with direct links (so, ignore order>1)
							tmpo=(JSONObject)l;
							if(Integer.parseInt(tmpo.get("sourceid").toString())==idroot) tmpmap.put(ds.taxonNames.get(Integer.parseInt(tmpo.get("targetid").toString())),Float.parseFloat(tmpo.get("wei").toString())); 
						}
						// sort species by link weight
						TreeMap<String,Float> sortedMap = new TreeMap<String,Float>(new ValueComparator(tmpmap));
						sortedMap.putAll(tmpmap);
						String outspp[]=new String[sortedMap.size()];
						Float outwei[]=new Float[sortedMap.size()];
						outspp=sortedMap.keySet().toArray(outspp);
						outwei=sortedMap.values().toArray(outwei);
						out.print("<p class=\"relatedspecies\">");
						for(int i2=0;i2<outspp.length-1;i2++) {
							out.print("<span data-gbifkey=\""+GlobalOperations.getNubFromSpecies(outspp[i2])+"\" data-weight=\""+outwei[i2]+"\">"+outspp[i2]+"</span>, ");
						}
						out.print("<span data-gbifkey=\""+GlobalOperations.getNubFromSpecies(outspp[outspp.length-1])+"\" data-weight=\""+outwei[outwei.length-1]+"\">"+outspp[outspp.length-1]+"</span>");
						out.print("</p>");
						out.flush();
						break;
					case "igraph":	// TODO this code is clumsy and inefficient. This should be formalized in classes
						Map<Long,String> nmap=new HashMap<Long,String>();
						for(Object o:nodes) {	// IDs to taxon names
							tmpo=(JSONObject)o;
							nmap.put((Long)tmpo.get("id"), (String)tmpo.get("name"));
						}
						
						File edgetmpfile=File.createTempFile("igraph-", null);
						File weitmpfile=File.createTempFile("wei-", null);
						File verttmpfile=File.createTempFile("vert-", null);
						File rdatatmpfile=File.createTempFile("rd-", ".rdata");
						BufferedWriter bwigrp=new BufferedWriter(new FileWriter(edgetmpfile));
						BufferedWriter bwwei=new BufferedWriter(new FileWriter(weitmpfile));
						BufferedWriter bwvert=new BufferedWriter(new FileWriter(verttmpfile));

						links=(JSONArray) jobj.get("links");
						for(Object o:links) {
							tmpo=(JSONObject)o;
							bwigrp.write(nmap.get((Long)tmpo.get("sourceid"))+"\n");
							bwigrp.write(nmap.get((Long)tmpo.get("targetid"))+"\n");
							bwwei.write(tmpo.get("wei").toString()+"\n");
							if(tmpo.get("bi").toString().equals("1")) {
								bwigrp.write(nmap.get((Long)tmpo.get("targetid"))+"\n");
								bwigrp.write(nmap.get((Long)tmpo.get("sourceid"))+"\n");
								bwwei.write(tmpo.get("wei").toString()+"\n");		// we assume the same weight for both directions (which is the maximum, see C code)
							}
						}
						String cls;
						for(Object o:nodes) {
							tmpo=(JSONObject)o;
							cls=tmpo.get("cls").toString();
							cls=cls.substring(1, cls.length()-1);
							bwvert.write(tmpo.get("name").toString()+"\t"+tmpo.get("flow").toString()+"\t"+tmpo.get("ori").toString()+"\t\""+cls+"\"\n");
						}
						bwigrp.close();
						bwwei.close();
						bwvert.close();
						// convert the text files into an Rdata file
						pr = null;
						try {
							pr = Runtime.getRuntime().exec(new String[] {"R", "-e",""
									+ "library(igraph);"
									+ "a=read.table('"+edgetmpfile.getPath()+"',sep='\\t',strings=F)[,1];"
									+ "b=read.table('"+weitmpfile.getPath()+"',sep='\\t',strings=F)[,1];"
									+ "c=read.table('"+verttmpfile.getPath()+"',sep='\\t',strings=F);"
									+ "graph=make_graph(a);"
									+ "graph=set_edge_attr(graph,'weight',value=b);"
									+ "mat=match(c[,1],names(V(graph)));"
									+ "c=c[!is.na(mat),];"
									+ "mat=mat[!is.na(mat)];"
									+ "ind=V(graph)[mat];"
									+ "graph=set_vertex_attr(graph,'PageRank', index=ind,value=c[,2]);"
									+ "graph=set_vertex_attr(graph,'Clusters', index=ind,value=c[,4]);"
									+ "graph=set_vertex_attr(graph,'InList', index=ind,value=c[,3]);"
									+ "save(graph,file='"+rdatatmpfile.getPath()+"');"});
							IOUtils.toString(pr.getInputStream());
							IOUtils.toString(pr.getErrorStream());
							pr.waitFor();
						} catch (IOException | InterruptedException e) {
							e.printStackTrace();
							break;
						} finally {
							if(pr != null) {
								/*pr.getInputStream().close();
								pr.getOutputStream().close();
								pr.getErrorStream().close();*/
								IOUtils.closeQuietly(pr.getInputStream());
								IOUtils.closeQuietly(pr.getOutputStream());
								IOUtils.closeQuietly(pr.getErrorStream());
								pr.destroy();
							}
						}
						
						Files.delete(edgetmpfile.toPath());
						Files.delete(weitmpfile.toPath());
						Files.delete(verttmpfile.toPath());
						FileInputStream fis1=new FileInputStream(rdatatmpfile);
						try {
							IOUtils.copy(fis1, ostr);
						} catch(SocketException e) {
							e.printStackTrace();
						}
						fis1.close();
						Files.delete(rdatatmpfile.toPath());
						break;
					default:
						out.println(error("Format "+fmt+" not recognized."));
						break;
					}
    			}
    			break;
    		case "gettaxa":
				dID=nativeFunctions.getQSValue("did",qs);
				aID=nativeFunctions.getQSValue("aid",qs);
				if(dID==null || aID==null) {out.println("{\"success\":false,\"msg\":\"You must supply the following parameters: did, aid\"}");break;}
				Dataset ds3=datasetServer.datasets.get(dID);
				Analysis an3=ds3.analyses.get(aID);
				List<String> tn;
				List<Integer> tfr;
				try {
					tn=ds3.taxonNames;
					tfr=ds3.TaxonFrequencies;
				} catch(NullPointerException e) {
					out.println("{\"success\":false}");
					return;
				}
				JSONArray ja=new JSONArray();
				jobj=null;
				for(i=0;i<tn.size();i++) {
					if(an3==null || (an3!=null && tfr.get(i)>=an3.getMinFrequency())) {
						jobj=new JSONObject();
						jobj.put("id", i);
						jobj.put("name", tn.get(i));
						jobj.put("fr", tfr.get(i));
						jobj.put("ht","<li>"+tn.get(i)+"</li>");
						ja.add(jobj);
					}
				}
				out.println(ja.toJSONString());
    			break;
    		
    		case "getorders":
    			String q=nativeFunctions.getQSValue("q", qs);
    			if(q!=null) out.println(TaxonomyRequests.getOrders(q));
    			break;
    		case "getkingdoms":
    			out.println(TaxonomyRequests.getKingdoms());
    			break;
    			
    		case "getqueryservices":
    			NodeList qserv=GlobalOperations.getQueryServices();
    			Element el,el1;
    			NodeList nl;
    			JSONArray jarr=new JSONArray(),examp;
    			JSONObject jobj1;
    			for(int i1=0;i1<qserv.getLength();i1++) {
    				el=(Element)qserv.item(i1);
    				jobj=new JSONObject();
    				jobj.put("name",el.getElementsByTagName("name").item(0).getTextContent());
    				jobj.put("logo",el.getElementsByTagName("logo").item(0).getTextContent());
    				examp=new JSONArray();
    				nl=el.getElementsByTagName("example");
    				for(int i2=0;i2<nl.getLength();i2++) {
    					jobj1=new JSONObject();
    					el1=(Element)nl.item(i2);
    					jobj1.put("link", el1.getTextContent());
    					jobj1.put("desc", el1.getAttribute("desc"));
    					examp.add(jobj1);
    				}
    				jobj.put("examples", examp);
    				jarr.add(jobj);
    			}
    			out.println(jarr.toJSONString());
    			break;
    			
    		case "png":
    			dID=nativeFunctions.getQSValue("did",qs);
    			String wid=nativeFunctions.getQSValue("x",qs);
    			String hei=nativeFunctions.getQSValue("y",qs);
    			String v=nativeFunctions.getQSValue("v",qs);
    			String tquery=nativeFunctions.getQSValue("q",qs);	// all means all species, or else, comma-separated IDs
    			String mar=nativeFunctions.getQSValue("m",qs);
    			String r=nativeFunctions.getQSValue("r",qs);
    			String g=nativeFunctions.getQSValue("g",qs);
    			String b=nativeFunctions.getQSValue("b",qs);
    			String sigma=nativeFunctions.getQSValue("sig",qs);
    			String nclasses=nativeFunctions.getQSValue("nc",qs);

    			if(dID==null || wid==null || hei==null || v==null || tquery==null) {out.println("{\"success\":false,\"msg\":\"You must supply at least the following parameters: did, x, y, v, tid\"}");break;}
				
    			Float margin=(mar==null ? 0.05f : Float.parseFloat(mar));
    			Integer red=(r==null ? 0 : Integer.parseInt(r));
    			Integer green=(g==null ? 100 : Integer.parseInt(g));
    			Integer blue=(b==null ? 255 : Integer.parseInt(b));
    			Float sigmapercent=(sigma==null ? 0.03f : Float.parseFloat(sigma));
    			Integer ncl=(nclasses==null ? 1 : Integer.parseInt(nclasses));
    			ds=datasetServer.datasets.get(dID);
    			if(ds==null) {out.println("{\"success\":false,\"msg\":\"Dataset "+dID+" not found.\"}");break;}
    			String[] varss=v.split(",");
				Integer[] varsc;

				try {
					varsc=ds.GetVariableCodes(varss);
				} catch (IOException e) {
					out.println("Some variable name(s) not found.");
					break;
				}
    			
				String tids=(tquery.equals("all") ? null : tquery.replace(","," "));
    			pr = null;
    			try {
    				//pr=Runtime.getRuntime().exec("/home/miguel/workspace/ecoSpace/jni/get-density-png data/stdvars_"+dID+".bin "+wid+" "+hei+" "+varsc[0]+" "+varsc[1]+" "+margin+" "+sigmapercent+" "+red+" "+green+" "+blue+" "+ncl+" "+tids);
    				pr = Runtime.getRuntime().exec(System.getProperty("user.dir")+"/get-density-png data/stdvars_"+dID+".bin "+wid+" "+hei+" "+varsc[0]+" "+varsc[1]+" "+margin+" "+sigmapercent+" "+red+" "+green+" "+blue+" "+ncl+(tids==null ? "" : " "+tids));
    				IOUtils.copy(pr.getInputStream(), ostr);
    			} catch (IOException e) {
    				e.printStackTrace();
    			} finally {
					if(pr != null) {
						IOUtils.closeQuietly(pr.getInputStream());
						IOUtils.closeQuietly(pr.getOutputStream());
						IOUtils.closeQuietly(pr.getErrorStream());
						pr.destroy();
					}
				}
    			break;
    			
    		case "distrmap":	// outputs a full SVG with map and density
				query=getQSValue("q",qs);	// this is a query that is sent as is to an external web service or local file
				queryType=getQSValue("t",qs);	// this is either a taxon name or taxon ID query that is only searched internally
    			dID=getQSValue("did",qs);
    			wid=getQSValue("x",qs);
    			hei=getQSValue("y",qs);    			
    			//tquery=getQSValue("tid",qs);
    			mar=getQSValue("m",qs);
    			r=getQSValue("r",qs);
    			g=getQSValue("g",qs);
    			b=getQSValue("b",qs);
    			sigma=getQSValue("sig",qs);
    			nclasses=getQSValue("nc",qs);
    			String buf=getQSValue("buf",qs);		// margin around density map, in degrees
    			String inlineStyles=getQSValue("incss",qs);		// set to 1 if we want inline CSS
    			String error=null;
    			varsc=null;
    			if(dID==null || wid==null || hei==null || query==null) {out.println(error("You must supply at least the following parameters: did, x, y, v, tid"));break;}
				
    			margin=(mar==null ? 0 : Float.parseFloat(mar));
    			red=(r==null ? 0 : Integer.parseInt(r));
    			green=(g==null ? 100 : Integer.parseInt(g));
    			blue=(b==null ? 255 : Integer.parseInt(b));
    			sigmapercent=(sigma==null ? 0.03f : Float.parseFloat(sigma));
    			ncl=(nclasses==null ? 3 : Integer.parseInt(nclasses));
    			Float buffer=(buf==null ? 0.5f : Float.parseFloat(buf));
    			Integer nwid=Integer.parseInt(wid);
    			Integer nhei=Integer.parseInt(hei);
    			
    			String tmp2=null;
    			Float minlat=null,maxlat=null,minlng=null,maxlng=null;

    			ds=datasetServer.datasets.get(dID);
    			if(ds==null) {
    				error="Dataset "+dID+" not found.";
    				minlng=0f;
    				minlat=0f;
    				maxlng=Float.parseFloat(wid);
    				maxlat=Float.parseFloat(hei);
    			} else {
	    			if(query.equals("all")) {
		    			tmp2="[all]";
	    			} else {
						QueryService qserv1=null;
						try {
							qserv1=QueryServiceFactory.newQueryService(queryType, query);
						} catch (IOException e) {
							out.println(error(e.getMessage()));
							break;
						}
		
		    			Map<Integer, Integer> tids1=new HashMap<Integer, Integer>();
		    			tids1=ds.taxonNames.parseQuery(qserv1.executeQuery());
		    			if(tids1.size()<1) error="Query returned no results.";
		    			tmp2=Arrays.toString(tids1.keySet().toArray(new String[0]));
	    			}
	
	    			minlat=ds.Variables.get(0).min;
	    			maxlat=ds.Variables.get(0).max;
	    			minlng=ds.Variables.get(1).min;
	    			maxlng=ds.Variables.get(1).max;
    			}
    			File paths=new File("worldpaths.svg");
    			BufferedReader br=new BufferedReader(new FileReader(paths));
    			out.print("<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" class=\"distrplot noselect\" width=\""+wid+"px\" height=\""+hei+"px\"");
    			out.print(" viewBox=\""+(minlng-buffer)+" "+(-maxlat-buffer)+" "+(maxlng-minlng+buffer*2)+" "+(maxlat-minlat+buffer*2)+"\">");
    			//out.print("<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" class=\"distrplot no-select\" width=\""+wid+"px\" height=\""+hei+"px\" viewBox=\"-180 -90 360 180\">");
    			if(inlineStyles!=null && inlineStyles.equals("1")) {
    				out.print("<style type=\"text/css\"><![CDATA[");
    				//out.print("path {fill:#ccc;stroke:#999;stroke-width:1;vector-effect:non-scaling-stroke;stroke-linejoin:round;} ]]></style>");
    				out.print("path {fill:#ccc;stroke-width:0;} ]]></style>");
    			}
    			while((tmp=br.readLine())!=null) {
    				out.print(tmp);
    			}

    			Float imgx=null,imgwid=null,imghei=null,imgy=null;
    			if(ds!=null) {
	    			Float rat=(maxlat-minlat)/(maxlng-minlng);
	    			//Float winrat=(float)nhei/nwid;
	    			Float newwid=rat>1 ? (maxlng-minlng)*rat : (maxlng-minlng);	// this is the width and height, in degrees, of the PNG
	    			Float newhei=rat<1 ? (maxlat-minlat)/rat : (maxlat-minlat);
	    			//EcoSpace.outputlog.println(rat+": "+newwid+" "+newhei);
	
	    			imgx=minlng-(newwid*margin)/(1-2*margin);
	    			imgwid=(newwid)/(1-2*margin);
	    			imghei=(newhei)/(1-2*margin); //(newhei)*(1+margin*2);
	    			imgy=maxlat+(newhei*margin)/(1-2*margin);
	    			try {
	    				varsc=ds.GetVariableCodes(new String[]{"longitude","latitude"});
	    			} catch (IOException e) {
	    				error="Some variable name(s) not found.";
	    				break;
	    			}
    			}
    			
    			if(error==null) {
    				if(inlineStyles!=null && inlineStyles.equals("1")) {	// TODO: this is partly redundant with the code under "png" option
    					out.print("<image x=\""+imgx+"\" y=\""+(-imgy)+"\" width=\""+imgwid+"\" height=\""+imghei+"\" xlink:href=\"data:image/png;base64,");
    					out.flush();
    	    			Process pr1 = null;
    	    			Base64InputStream b64is;	// to base64 encode the PNG to put in the SVG inline
    	    			try {
    	    				pr1=Runtime.getRuntime().exec(System.getProperty("user.dir")+"/get-density-png data/stdvars_"+dID+".bin "+nwid+" "+nhei+" "+varsc[0]+" "+varsc[1]+" "+margin+" "+sigma+" "+red+" "+green+" "+blue+" "+nclasses+" "+tmp2.substring(1, tmp2.length()-1).replace(" ", "").replace(",", " "));
    	    				b64is=new Base64InputStream(pr1.getInputStream(),true);
    	    				IOUtils.copy(b64is, ostr);
    	    				b64is.close();
    	    			} catch (IOException e) {
    	    				e.printStackTrace();
    	    			} finally {
							if(pr1 != null) {
								IOUtils.closeQuietly(pr1.getInputStream());
								IOUtils.closeQuietly(pr1.getOutputStream());
								IOUtils.closeQuietly(pr1.getErrorStream());
								pr1.destroy();
							}
						}
    	    			out.print("\"/>");
    	    			out.flush();
    				} else {
	    				String qs1="?did="+dID+"&amp;q="+tmp2.substring(1, tmp2.length()-1).replace(" ", "")+"&amp;x="+nwid+"&amp;y="+nhei+"&amp;v=longitude,latitude&amp;m="+margin+"&amp;r="+red+"&amp;g="+green+"&amp;b="+blue+"&amp;sig="+sigma+"&amp;nc="+nclasses;
	    				out.print("<image xlink:href=\"http://flora-on.pt/ecospace/density-map.php"+qs1+"\" x=\""+imgx+"\" y=\""+(-imgy)+"\" width=\""+imgwid+"\" height=\""+imghei+"\"/>");
    				}
    			} else {
    				out.print("<text x=\""+((minlng+maxlng)/2)+"\" y=\""+(-((minlat+maxlat)/2))+"\" style=\"fill:black;font-size:"+((maxlng-minlng+buffer*2)/20)+"px;text-anchor:middle;\">"+error+"</text>");
    			}
    			out.println("</svg>");
    			break;
    			
    		case "scatter":
    		case "scatterlayer":
    			error=null;
    			dID=nativeFunctions.getQSValue("did",qs);
    			query=getQSValue("q",qs);	// this is a query that is sent as is to an external web service or local file
    			queryType=getQSValue("t",qs);
    			String wid1=nativeFunctions.getQSValue("x",qs);
    			String hei1=nativeFunctions.getQSValue("y",qs);
    			String v1=nativeFunctions.getQSValue("v",qs);
    			String sigma1=nativeFunctions.getQSValue("sig",qs);
    			String ind=nativeFunctions.getQSValue("ind",qs);
    			String self=getQSValue("selfcontained",qs);
    			nclasses=getQSValue("nc",qs);
    			if(dID==null || wid1==null || hei1==null) {out.println("{\"success\":false,\"msg\":\"You must supply the following parameters: did, x, y, v\"}");break;}
    			r=getQSValue("r",qs);
    			g=getQSValue("g",qs);
    			b=getQSValue("b",qs);
    			Color color=null;
    			if(r!=null && g!=null && b!=null) color=new Color(Integer.parseInt(r), Integer.parseInt(g), Integer.parseInt(b));
    			Integer wid2=Integer.parseInt(wid1);
    			Integer hei2=Integer.parseInt(hei1);
    			Float sigmapercent1=(sigma1==null ? 0.03f : Float.parseFloat(sigma1));
    			   			
    			ds=datasetServer.datasets.get(dID);
    			if(ds==null) error="Dataset "+dID+" not found.";

    			Integer[] varsc1=null;
    			if(v1!=null && ds!=null) {
    				varsc1=new Integer[]{1,0};
    				String[] varss1=v1.split(",");
    				if(varss1.length!=2) error="You must supply either two comma-separated variable names, or none."; else {
	    				try {
	    					varsc1=ds.GetVariableCodes(varss1);
	    				} catch (IOException e) {
	    					error="Some variable name(s) not found.";
	    				}
    				}
    			}

    			Map<Integer, Integer> tids2=new HashMap<Integer, Integer>();
    			if(query!=null && ds!=null) {
	    			QueryService qserv2=null;
					try {
						qserv2=QueryServiceFactory.newQueryService(queryType, query);
					} catch (IOException e) {
						error=e.getMessage();
					}
	    			tids2=ds.taxonNames.parseQuery(qserv2.executeQuery());
	    			//if(tids2.length<1) error="Query returned no results.";
    			}
    			
    			ScatterPlot spl=new ScatterPlot(ds,tids2.keySet().toArray(new Integer[0]),wid2,hei2,color,varsc1,sigmapercent1,nclasses==null ? null : Integer.parseInt(nclasses),error);
    			if(path[1].equals("scatterlayer")) {
    				if(ind!=null) {
    					String[] colinds=ind.split(",");
    					Integer[] colind;
    					if(colinds[0].equals(""))
    						colind=new Integer[0];
    					else {
    						colind=new Integer[colinds.length];
    						for(int i1=0;i1<colinds.length;i1++) colind[i1]=Integer.parseInt(colinds[i1]);
    					}
    					if(tids2.size()==0)
    						out.println("[]");
    					else
    						out.println(spl.getLayerJSON(colind));
    				}
    			} else {
    				if(self!=null && Integer.parseInt(self)==1) {	// self-contained scatter for the api
    					out.println(spl.toString(true));
    				} else out.println(spl.toString());		// empty scatter for the bioclimatic interface
    			}
    			break;
    		default:
    			out.println("Unknown command: "+path[1]);
    		}
            out.close();
            in.close();
        } catch ( URISyntaxException | IOException e) {		// TODO: Must not catch all exceptions here!
            //report exception somewhere.
            e.printStackTrace();
        } catch (org.apache.http.ParseException pe) {
        	pe.printStackTrace();
        	return;
        }
    }
    
    class ValueComparator implements Comparator<String> {
    	Map<String, Float> map;
        public ValueComparator(Map<String, Float> base) {
            this.map = base;
        }
     
        public int compare(String a, String b) {
            if (map.get(a) >= map.get(b)) {
                return -1;
            } else {
                return 1;
            } // returning 0 would merge keys 
        }
    }
}