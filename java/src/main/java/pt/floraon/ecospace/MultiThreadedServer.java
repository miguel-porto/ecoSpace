package pt.floraon.ecospace;

import java.net.ServerSocket;
import java.net.Socket;
import java.io.IOException;
import java.io.PrintWriter;

public class MultiThreadedServer implements Runnable{

    protected int          serverPort   = 8080;
    protected ServerSocket serverSocket = null;
    protected boolean      isStopped    = false;
    protected Thread       runningThread= null;
    protected DatasetServer dss;

    public MultiThreadedServer(int port,DatasetServer _dss){
        this.serverPort = port;
        this.dss=_dss;
    }

    public void run(){
        synchronized(this) {
            this.runningThread = Thread.currentThread();
        }
    	try {
			openServerSocket();
		} catch (IOException e1) {
			EcoSpace.outputlog.println("ERROR\n"+e1.getMessage());
			return;
		}
        while(! isStopped()){
            Socket clientSocket = null;
            try {
                clientSocket = this.serverSocket.accept();
            } catch (IOException e) {
                if(isStopped()) {
                	EcoSpace.outputlog.println("Server Stopped.") ;
                    return;
                }
                throw new RuntimeException(
                    "Error accepting client connection", e);
            }
            new Thread(
                new ServerDispatch(clientSocket, "Multithreaded Server",dss,this)
            ).start();
        }
        EcoSpace.outputlog.println("Server Stopped.") ;
    }


    private synchronized boolean isStopped() {
        return this.isStopped;
    }

    public synchronized void stop(PrintWriter out){
        this.isStopped = true;
        try {
            this.serverSocket.close();
            dss.ShutDown();
            GlobalOperations.close();
            out.println("STOPPED");
        } catch (IOException e) {
            throw new RuntimeException("Error closing server", e);
        }
    }

    private void openServerSocket() throws IOException {
    	this.serverSocket = new ServerSocket(this.serverPort);
    }

}