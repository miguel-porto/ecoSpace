package pt.floraon.ecospace;

import java.io.IOException;

public class Species implements Comparable<Species> {
	private String name;
	private Long nubKey;
	private Integer ID=null;
	
	/**
	 * If species is not in the CSV list, this adds a new species and respective nubKey.
	 * @param name
	 * @throws IOException
	 */
	public Species(String name) throws IOException {
		this.name=name;
		this.nubKey=GlobalOperations.addSpecies(name);
	}
	
	public String toString() {
		return this.name;
	}
	
	public Long getNubKey() {
		return this.nubKey;
	}
	
	public String getName() {
		return this.name;
	}
	
	public void setInternalID(int id) {
		this.ID=id;
	}
	
	public Integer getInternalID() {
		return this.ID;
	}

	@Override
	public int compareTo(Species o) {
		return this.name.compareTo(o.name);
	}
}
