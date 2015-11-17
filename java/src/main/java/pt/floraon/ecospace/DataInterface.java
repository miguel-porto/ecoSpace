package pt.floraon.ecospace;

import java.io.BufferedWriter;
import java.io.Closeable;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.util.UUID;

public abstract class DataInterface implements Closeable {
	public DATASETSTATE State;
	protected SimpleDataset sdataset;
	protected String Description,Origin,Url=null;
	protected String tmpID;
	public DataInterface(String description,String origin,String url) {
		Description=description;
		Origin=origin;
		Url=url;
		tmpID=UUID.randomUUID().toString().substring(33);
	}
	public abstract boolean ExecuteRequest();

	public void close() {
		sdataset.close();

		BufferedWriter bw;
		File spfile=new File("data/taxa_"+tmpID);
		try {
			bw=new BufferedWriter(new FileWriter(spfile));
			for(Species sp:sdataset.speciesList) {
				bw.write(sp.getName()+"\n");
			}
			bw.close();
		} catch (IOException e) {
			e.printStackTrace();
		}
	}
}
