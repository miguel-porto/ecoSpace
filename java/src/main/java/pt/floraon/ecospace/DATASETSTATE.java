package pt.floraon.ecospace;

public enum DATASETSTATE {
	EMPTY
	,IDLE
	,REQUESTING_FILE
	,WAITING_FILE
	,DOWNLOADING_FILE
	,PROCESSING_FILE
	,READING_VARIABLES
	,ERROR;
	
    @Override
    public String toString() {
		switch(this) {
		case IDLE: return "Idle";
		case EMPTY: return"Empty dataset";
		case REQUESTING_FILE: return "Requesting dataset";
		case WAITING_FILE: return "Waiting for file to be ready for download";
		case PROCESSING_FILE: return"Processing occurrence file";
		case READING_VARIABLES: return"Reading variables from coordinates";
		case ERROR: return "Some error occurred while processing";
		default: return "Undefined";
		}
    }
}