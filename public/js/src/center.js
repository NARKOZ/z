ElementExtensions = {
	center: function(element, offset, limitX, limitY)
	{
		element = $(element);
		var elementDims = element.getDimensions();
		var viewPort = document.viewport.getDimensions();
		var offsets = document.viewport.getScrollOffsets();
		var centerX = viewPort.width / 2 + offsets.left - elementDims.width / 2;
		if (BrowserDetect.browser != "Firefox")
		{
			centerX = centerX - offset;
		}
		var centerY = viewPort.height / 2 + offsets.top - elementDims.height / 2;
		if (limitX && centerX < limitX)
		{
			centerX = parseInt(limitX);
		}
		if (limitY && centerY < limitY)
		{
			centerY = parseInt(limitY);
		}
		element.setStyle({position: 'absolute', top: Math.floor(centerY) + 'px', left: Math.floor(centerX) + 'px'});
		return element;			
	}
}
Element.addMethods(ElementExtensions);
