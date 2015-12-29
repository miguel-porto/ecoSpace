package pt.floraon.ecospace;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.io.PrintWriter;
import java.io.UnsupportedEncodingException;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Date;

public class EcoSpace {
	public static int serverPort=7520;
	public static PrintStream outputlog;
	public static void main( final String[] args ) throws InterruptedException {
		int maxAttemps=100;
		try {
			outputlog=new PrintStream(System.out,true,StandardCharsets.UTF_8.toString());
		} catch (UnsupportedEncodingException e1) {
			outputlog=System.out;
		}
		
		StartServer();

		/*
		to convert WorldClim to TIF
		for f in *.bil; do gdal_translate -of GTiff -co "TFW=YES" -outsize 50% 50% $f ${f%.*}.tif; done
		*/
/*
		if(args.length<1) {
			outputlog.println("Expected arguments start | stop | direct");
			return;
		}
		
		if(args[0].equals("direct")) {
			try {
				outputlog=new PrintStream(new File("logfile.txt"),StandardCharsets.UTF_8.toString());
				Date now=new Date();
				outputlog.println("**********************SERVER START ON "+now.toString()+"***************************************\n");
			} catch (FileNotFoundException | UnsupportedEncodingException e) {
				e.printStackTrace();
				outputlog=System.out;
			}
			outputlog.println("Starting server directly. Press Ctrl+C to quit.");
			StartServer();
		}
		if(args[0].equals("start")) {
			outputlog.println("Starting server on port "+serverPort+"\nServer root directory: "+System.getProperty("user.dir"));
			outputlog.print("Waiting for server to be ready");
			try {
				Runtime.getRuntime().exec("java -Djava.library.path="+System.getProperty("user.dir")+" -jar ecoSpace.jar direct", null, new File(System.getProperty("user.dir")));
			} catch (IOException e) {
				outputlog.println(e.getMessage());
				return;
			}
			//java -Djava.library.path=/home/miguel/workspace/ecoSpace/jni -jar
			Socket server=null;
			
		    int attempts = 0;
	        while(attempts < maxAttemps) {
				try {
					server = new Socket("localhost", serverPort);
				} catch (IOException e) {
					outputlog.print(".");
				}
				if(server!=null) break;
	            attempts++;
	            Thread.sleep(1000);
	        }
	        if(attempts==maxAttemps)
	        	outputlog.println("\nServer not ready...");
	        else
	        	outputlog.println("\nServer ready on port "+serverPort);
	        
		}
		
		if(args[0].equals("stop")) {
			outputlog.println("Opening socket...");
			Socket server;
			PrintWriter out;
			InputStream instream;
			try {
				server = new Socket("localhost", serverPort);
				out = new PrintWriter(server.getOutputStream(), true);
				 instream=server.getInputStream();
			} catch(IOException e) {
				outputlog.println(e.getMessage());
				return;
			}
		    
		    // send stop message to server
		    out.println("stop");
		    
		    outputlog.println("Waiting for server to stop");
		    BufferedReader in = new BufferedReader(new InputStreamReader(instream));
		    String a;
		    int attempts = 0;
		    
		    try {
		        while(attempts < maxAttemps) {
		        	a=in.readLine();
		        	if(a==null)
		        		outputlog.print(".");
		        	else if(a.equals("STOPPED")) {
		        		outputlog.println(a);
		        		break;
		        	} else
		        		outputlog.println(a);
		            attempts++;
		            Thread.sleep(1000);
		        }
		        out.close();
		        in.close();
		        outputlog.close();
		        server.close();
		    } catch(IOException e) {
		    	outputlog.println(e.getMessage());
				return;		    	
		    }
		}
			*/
	}
	public static void StartServer() {
		new GlobalOperations();
		DatasetServer dss = new DatasetServer();
		MultiThreadedServer server = new MultiThreadedServer(serverPort,dss);
		EcoSpace.outputlog.println("OK this is new");
		EcoSpace.outputlog.flush();
		server.run();
	}
}
