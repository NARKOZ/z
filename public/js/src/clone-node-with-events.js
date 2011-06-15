function cloneNodeWithEvents(orgNode)
{
	var orgNodeEvenets=orgNode.getElementsByTagName("*");
	var cloneNode=orgNode.cloneNode(true);
	var cloneNodeEvents=cloneNode.getElementsByTagName("*");
	var allEvents=new Array("onabort","onbeforecopy","onbeforecut","onbeforepaste","onblur","onchange","onclick","oncontextmenu","oncopy","ondblclick","ondrag","ondragend","ondragenter","ondragleave","ondragover","ondragstart","ondrop","onerror","onfocus","oninput","oninvalid","onkeydown","onkeypress","onkeyup","onload","onmousedown","onmousemove","onmouseout","onmouseover","onmouseup","onmousewheel","onpaste","onreset","onresize","onscroll","onsearch","onselect","onselectstart","onsubmit","onunload");
	for(var j=0;j<allEvents.length;j++)
	{
		eval("if(orgNode."+allEvents[j]+") cloneNode."+allEvents[j]+" = orgNode."+allEvents[j]);
	}
	for(var i=0;i<orgNodeEvenets.length;i++)
	{
		for(var j=0;j<allEvents.length;j++)
		{
			eval("if(orgNodeEvenets[i]."+allEvents[j]+") cloneNodeEvents[i]."+allEvents[j]+" = orgNodeEvenets[i]."+allEvents[j]);
		}
	}
	return cloneNode;
}
