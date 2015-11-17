package pt.floraon.ecospace;

import java.awt.Color;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import org.apache.commons.codec.binary.Base64InputStream;
import org.apache.commons.io.IOUtils;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;

public class ScatterPlot {
	private static Color[] palette=new Color[]{new Color(0,100,255),new Color(255,100,0),new Color(0,155,0),new Color(155,0,155),new Color(255,0,0),new Color(0,150,150)};
	private int padbl=34,width,height,padur=15,innerpadding=5,scalesvg=1;
	private int varx=-1,vary=-1,drawwid,drawhei;
	private Integer[] tID;
	private Color[] color;
	private Dataset.Variable variablex=null,variabley=null;
	private Dataset ds;
	private Float sigmapercent;
	private String error;
	private Integer nclasses;
	/**
	 * 
	 * @param ds
	 * @param tID
	 * @param width
	 * @param height
	 * @param color
	 * @param vars
	 * @param sigmapercent
	 * @param error	An error message to display in the SVG instead of the scatterplot.
	 */
	public ScatterPlot(Dataset ds,Integer[] tID,int width,int height,Color color,Integer[] vars,Float sigmapercent,Integer nclasses,String error) {
		this.ds=ds;
		this.tID=tID;
		this.width=width;
		this.height=height;
		if(vars!=null) {
			this.varx=vars[0];
			this.vary=vars[1];
			this.variablex=ds.Variables.get(varx);
			this.variabley=ds.Variables.get(vary);
		}
		if(color==null) this.color=ScatterPlot.palette; else this.color=new Color[]{color};
		this.drawwid=width-padbl-padur-innerpadding;
		this.drawhei=height-padbl-padur-innerpadding;
		if(sigmapercent==null) this.sigmapercent=0.03f; else this.sigmapercent=sigmapercent;
		this.nclasses=(nclasses==null ? 5 : nclasses);
		this.error=error;
	}
	
	@SuppressWarnings("unchecked")
	public String getLayerJSON(Integer[] usedcolors) {	// gets a layer, the color is given by the first index that is missing in usedcolors
		JSONObject jobj,col;
		JSONArray jarr=new JSONArray();
		Integer colorindex;
		List<Integer> usedcolorsl = new ArrayList<Integer>(Arrays.asList(usedcolors));
		for(int k=0;k<tID.length;k++) {
			if(usedcolorsl.get(k)==-1) {
				for(colorindex=0;usedcolorsl.contains(colorindex);colorindex++) {}
				usedcolorsl.add(colorindex);
			} else colorindex=usedcolorsl.get(k);

			jobj=new JSONObject();
			col=new JSONObject();
			col.put("r", color[colorindex % color.length].getRed());
			col.put("g", color[colorindex % color.length].getGreen());
			col.put("b", color[colorindex % color.length].getBlue());
			//String qs="?did="+this.ds.dID+"&tids="+tID[0]+"&x="+drawwid+"&y="+drawhei+"&v="+variablex.name+","+variabley.name+"&m=0&r="+color[j].getRed()+"&g="+color[j].getGreen()+"&b="+color[j].getBlue()+"&sig="+sigmapercent;
			String qs="?did="+this.ds.dID+"&q="+tID[k]+"&t=i&x="+drawwid+"&y="+drawhei+"&m=0&r="+color[colorindex % color.length].getRed()+"&g="+color[colorindex % color.length].getGreen()+"&b="+color[colorindex % color.length].getBlue()+"&sig="+sigmapercent+"&nc=1";
			jobj.put("href", "density-map.php"+qs);
			jobj.put("x",padbl+innerpadding);
			jobj.put("y",padur);
			jobj.put("height",drawhei);
			jobj.put("width",drawwid);
			jobj.put("name",this.ds.taxonNames.get(tID[k]));
			jobj.put("idtax",tID[k]);
			jobj.put("color", col);
			jobj.put("colorindex", colorindex);
			jarr.add(jobj);
		}
		return(jarr.toJSONString());
	}
	
	public String toString() {
		return this.toString(false);
	}
	
	public String toString(Boolean selfcontained) {
		StringBuilder out=new StringBuilder();
		
		out.append("<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" xmlns:eco=\"http://www.flora-on.pt/ecospace\" class=\"bioclimplot noselect\" width=\""+(width/scalesvg)+"px\" height=\""+(height/scalesvg)+"px\" viewbox=\"0 0 "+width+" "+height+"\">");		

		if(selfcontained) {
			out.append("<style type=\"text/css\"><![CDATA[");
			//out.append("* {stroke:black;}");
			out.append("text {font-family:sans-serif;fill:black;}");
			out.append("text.axislabels {font-size: 0.7em;}");
			out.append("text.axistitle {font-size: 1em;fill:black;}");
			out.append("line,path {stroke:black;} ]]></style>");
		}
		
		if(this.error!=null) {
			out.append("<text x=\""+(width/2)+"\" y=\""+(height/2)+"\" style=\"fill:black;font-size:1em;text-anchor:middle;\">"+this.error+"</text></svg>");
			return out.toString();
		}
		
		float[] varxscale=prettyTicks(variablex.min,variablex.max,6);
		float[] varyscale=prettyTicks(variabley.min,variabley.max,6);

		float scalex=(width-padbl-padur-innerpadding)/(varxscale[1]-varxscale[0]);
		float scaley=(height-padbl-padur-innerpadding)/(varyscale[1]-varyscale[0]);

// draw X axis ticks and labels
		out.append("<g class=\"axis\" eco:varx=\""+this.variablex.name+"\" eco:vary=\""+this.variabley.name+"\">");
		// fon:minx=\""+(varxscale[0]/variablex.scale)+"\" fon:miny=\""+(varyscale[0]/variabley.scale)+"\" fon:sx=\""+(scalex*variablex.scale)+"\" fon:sy=\""+(scaley*variabley.scale)+"\" fon:left=\""+(padbl+innerpadding)+"\" fon:top=\""+padur+"\" fon:right=\""+(width-padur)+"\" fon:bottom=\""+(height-padbl-innerpadding)+"\"
		out.append("<path d=\"M"+padbl+" "+padur+" L"+padbl+" "+(height-padbl)+"L"+(width-padur)+" "+(height-padbl)+"\" style=\"fill:none;stroke-width:1.5px;stroke-linecap:round\"></path>");
		float dec=(int) Math.pow(10, -Math.floor(Math.log10(varxscale[2]))),val,xpos,ypos;
		for(int i=0;i<varxscale[3];i++) {
			xpos=innerpadding+padbl+i*varxscale[2]*scalex;
			if(dec>0)
				val=Math.round(((varxscale[0]+i*varxscale[2])/variablex.scale)*dec)/dec;
			else
				val=((varxscale[0]+i*varxscale[2])/variablex.scale);
			
			out.append("<line x1=\""+xpos+"\" y1=\""+(height-padbl+5)+"\" x2=\""+xpos+"\" y2=\""+(height-padbl)+"\" style=\"stroke-width:1;stroke-linecap:round\"></line>");
			out.append("<text x=\""+xpos+"\" y=\""+(height-padbl+5)+"\" class=\"axislabels\" style=\"text-anchor:middle;\"><tspan dy=\"1.5ex\">"+val+"</tspan></text>");
		}
// draw X axis title	
		out.append("<text x=\""+((width-padbl-padur)/2+padbl)+"\" y=\""+(height-5)+"\" class=\"axistitle\" eco:var=\""+variablex.name+"\" eco:axis=\"x\" style=\"text-anchor: middle;\">"+variablex.title+"</text>");
		
// draw Y axis ticks and labels	
		dec=(int) Math.pow(10, -Math.floor(Math.log10(varxscale[2])));
		for(int i=0;i<varyscale[3];i++) {
			ypos=height-innerpadding-padbl-i*varyscale[2]*scaley;
			if(dec>0)
				val=Math.round(((varyscale[0]+i*varyscale[2])/variabley.scale)*dec)/dec;
			else
				val=((varyscale[0]+i*varyscale[2])/variabley.scale);
			out.append("<line y1=\""+ypos+"\" x1=\""+(padbl-5)+"\" y2=\""+ypos+"\" x2=\""+(padbl)+"\" style=\"stroke-width:1;stroke-linecap:round\"></line>");
			out.append("<text y=\""+ypos+"\" x=\""+(padbl-7)+"\" class=\"axislabels\" style=\"text-anchor: middle;\" transform=\"rotate(-90,"+(padbl-7)+","+ypos+")\">"+val+"</text>");
		}
// draw Y axis title
		out.append("<text y=\""+((height-padbl-padur)/2+padur)+"\" x=\""+(0)+"\" class=\"axistitle yaxis\" eco:var=\""+variabley.name+"\" eco:axis=\"y\" style=\"text-anchor: middle;\" transform=\"rotate(-90,0,"+((height-padbl-padur)/2+padur)+")\"><tspan dy=\"1.5ex\">"+variabley.title+"</tspan></text>");
		out.append("</g>");
		/*
		int j;
		for(int i=0;i<tID.length;i++) {
			j=i % color.length;
			String qs="?did="+this.ds.dID+"&tids="+tID[i]+"&x="+drawwid+"&y="+drawhei+"&v="+variablex.name+","+variabley.name+"&m=0&r="+color[j].getRed()+"&g="+color[j].getGreen()+"&b="+color[j].getBlue()+"&sig="+sigmapercent;
			out.append("<image eco:idtax=\""+tID[i]+"\" eco:name=\""+ds.TaxonNames.get(tID[i])+"\" xlink:href=\"density-map.php"+qs+"\" x=\""+(padbl+innerpadding)+"px\" y=\""+padur+"px\" height=\""+drawhei+"px\" width=\""+drawwid+"px\"/>");
		}
		*/
// now fetch the points for the two variables
/*		out.append("<g class=\"points visible\">");
		Process pr;
		String line;
		String[] vars;
		Float x,y,factorx=drawwid/10000f,factory=drawhei/10000f;
		String colorrgb = Integer.toHexString(color.getRGB());
		colorrgb = colorrgb.substring(2, colorrgb.length());
		try {
			pr=Runtime.getRuntime().exec("/home/miguel/workspace/ecoSpace/jni/get-points data/stdvars_"+dID+".bin "+varx+" "+vary+" "+tids);
			BufferedReader br=new BufferedReader(new InputStreamReader(pr.getInputStream()));
			while((line=br.readLine())!=null) {
				vars=line.split(" ");
				x=Float.parseFloat(vars[0])*factorx+padbl+innerpadding;
				y=height-Float.parseFloat(vars[1])*factory-padbl-innerpadding;
				
				out.append("<circle cx=\""+x+"\" cy=\""+y+"\" r=\"1.5\" style=\"fill:#"+colorrgb+"\"></circle>");
			}
			br.close();
		} catch (IOException e) {
			e.printStackTrace();
		}
		out.append("</g>");*/
		
		if(selfcontained && tID.length>0) {
			out.append("<image x=\""+(padbl+innerpadding)+"\" y=\""+padur+"\" width=\""+drawwid+"\" height=\""+drawhei+"\" xlink:href=\"data:image/png;base64,");
			Process pr1;
			Base64InputStream b64is;	// to base64 encode the PNG to put in the SVG inline
			try {
//				+"&q="+tID[k]+"&t=i&x="+drawwid+"&y="+drawhei+"&m=0&;
				pr1=Runtime.getRuntime().exec(System.getProperty("user.dir")+"/get-density-png data/stdvars_"+this.ds.dID+".bin "+
						drawwid+" "+drawhei+" "+varx+" "+vary+" "+0+" "+sigmapercent+" "+color[0].getRed()+" "+color[0].getGreen()+" "+color[0].getBlue()+" "+this.nclasses+" "+tID[0]);
						//tmp2.substring(1, tmp2.length()-1).replace(" ", "").replace(",", " "));
				b64is=new Base64InputStream(pr1.getInputStream(),true);
				out.append(IOUtils.toString(b64is));
				b64is.close();
			} catch (IOException e) {
				e.printStackTrace();
			}
			out.append("\"/>");
		}
		
		out.append("</svg>");
		return out.toString();
		
	}
	
	private float[] prettyTicks(float min,float max,int nticks) {
			float rg=max-min;
			float[] prettyspaces=new float[]{0.1f,0.2f,0.5f,1f,2f,5f,10f,20f,50f};
			float ideal=rg/(nticks-1);
			int grand=(int)Math.floor(Math.log10(ideal));

			float[] possib=new float[prettyspaces.length];
			float minpossib=100000;
			int whichmin=0;
			for(int i=0;i<prettyspaces.length;i++) {
				prettyspaces[i]*=Math.pow(10,grand);
				possib[i]=ideal-prettyspaces[i];
				if(Math.abs(possib[i])<minpossib) {
					minpossib=Math.abs(possib[i]);
					whichmin=i;
				}
			}
			float whi=prettyspaces[whichmin];

			int newmin=(int)(Math.floor(min/Math.pow(10,grand))*Math.pow(10,grand));
			int newmax=(int)(Math.ceil(max/Math.pow(10,grand))*Math.pow(10,grand));
			nticks=(int)(Math.floor((newmax-newmin)/whi)+1);
			//echo("N ticks:".($nticks+1)."<br>Interv:".$whi."<br>Rounded Range:".($whi*$nticks)."<br>");
			
			return(new float[]{newmin,newmax,whi,nticks});
	}
}
