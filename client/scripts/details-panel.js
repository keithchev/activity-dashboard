


function drawActivityDetail() {

  var div = d3.select("#div-main-container");

  d3.selectAll("#div-main-container form").remove();
  d3.selectAll("#div-main-container div").remove();

  createActivityDetailControls(div);

  // write the altitude plot container divs (for now these are hard-coded)
  div.append("div").attr("class", "row").attr("id", "alt-plot-container");

  // write the line plot container (sub divs are added by makeLinePlots)
  div.append("div").attr("class", "").attr("id", "plots-1d-container");

  // check to see if the current activity has switched
  // if it hasn't (if this is just a window resize call, for example), do not run processRideDetailData
  if (DB.rideDetailDataActivityID==DB.currentActivityInfo.activity_id) {
      makeRideDetailPlots(DB.rideDetailData);

  // load the data from the postgres databae
  } else {

    DB.rideDetailDataActivityID = DB.currentActivityInfo.activity_id;

    var jsonFile = "getActivityData.php?type=detail&id=" + DB.currentActivityInfo.activity_id;

    // if no postgres 
    var LAPTOP = false;
    if (LAPTOP) {
      jsonFile = "http://127.0.0.1:7777/dev2/activity-dashboard/ignore/test_activity_id=20151231110101.json";
    }

    d3.json(jsonFile, function(err, rideDetailData) {

      // process raw rideDetailData  - this can be slow
      DB.rideDetailData = processRideDetailData(rideDetailData);

      // load the plots
      makeRideDetailPlots(DB.rideDetailData);

      console.log('JSON loaded');

    });
  }
}


function makeRideDetailPlots(rideDetailData) {

  DB.rideDetailDataBrushed = [];

  // this is maybe repetitive with same lines in onChange
  DB.detailsXAxis     = d3.select("#details-select-x-axis").property("value");
  DB.detailsSmoothing = d3.select("#details-input-smoothing").property("value");

  var div = d3.select("#alt-plot-container");

  div.selectAll("div").remove();

  // home of the alt-plot at the top
  div.append("div").attr("class", "col-sm-8").attr("id", "alt-plot");

  // future home of brushed region stats
  div.append("div").attr("class", "col-sm-3");

  // bind and initialize the alt plot object
  d3.select("#alt-plot").data( [makeAltPlot(rideDetailData).target(d3.select("#alt-plot")).init()] );

  // list of params for line and histogram plot rows - need a list of lists
  var fields = ['alt','spd', 'pwr', 'hrt', 'cad',].map(function(field) { return [field]; });

  // // test case for eventual field plotting text box:
  // var fieldPseudoCode = "spd, pwr, hrt, pwr//hrt";
  // fields = parsePseudoCode(fieldPseudoCode);

  // bind the field names to the plot containers (these are row divs)
  var plotContainers = 
      d3.select("#plots-1d-container")
        .selectAll(".param-plot-container")
        .data(fields).enter()
        .append("div")
        .attr("class", "row param-plot-container");

  // add the line plot divs and bind a linePlot object to each
  plotContainers.selectAll(".param-plot")
    .data(function(field) {  return [makeLinePlot(rideDetailData).field(field[0])]; })
    .enter().append("div")
    .attr("class", "col-sm-8 param-plot")
    .attr("id", function(linePlot) { return linePlot.field(); })
    .each( function(linePlot) { linePlot.target(d3.select(this)).init(); });

  // add the histogram divs and bind a histogram object to each
  plotContainers.selectAll(".hist-plot")
    .data(function(field) {  return [makeHistogram(rideDetailData).field(field[0])]; })
    .enter().append("div")
    .attr("class", "col-sm-3 hist-plot")
    .attr("id", function(histogram) { return histogram.field(); })
    .each( function(histogram) { histogram.target(d3.select(this)).init(); });

  // plotContainers.selectAll(".hist-plot")
  //    .data(histograms)
  //    .enter().append("div")
  //    .attr("class", "col-sm-3 hist-plot")
  //    .each(function (histogram) { histogram.target(d3.select(this)).init(); });


  // last step: listeners for the plot controls 
  d3.select("#details-select-x-axis").on("change", onFormChange);
  d3.select("#details-input-smoothing").on("change", onFormChange);

}

function parsePseudoCode(pseudoCode) {

  var primitives = /alt|spd|pwr|hrt|cad|vam|slp|elg|wrk/,
      entries = pseudoCode.split(","),
      fieldData = [];

  for (entry in entries) {

    // split by * or / signs
    fields = entry.split(/\W/);

    // if this is a simple field
    if (fields.length==1) {
      // and it matches a primitive field
      if (fields[0].match(primitives)!= null) {
        fieldData.push( {field: fields[0], func: function(d) { return d[fields[0]]; } });
      }

    // else this is a compound field
    } else {

    }  
  }
}


function getXParam() {

    var detailsXAxis = d3.select("#details-select-x-axis").property("value");

    return ({Time: "sec", Distance: "dst"})[detailsXAxis];
}

function onFormChange() {

    var xParam = getXParam(),
        smoothWindow = parseInt(d3.select("#details-input-smoothing").property("value"));

    // update the alt plot
    d3.select("#alt-plot").each(function (altPlot_) { altPlot_.xParam(xParam).update(); });

    // update each param line plot
    d3.selectAll(".param-plot").each(function (linePlot_) { linePlot_.smoothWindow(smoothWindow).xParam(xParam).update(); });

}

function makeAltPlot(rideDetailData, xParam) {

  var ldp = loadActivityProps(),
      lpp = loadActivityProps().linePlotProps;

  var svg, svgG, xParam = getXParam(), targetDiv, XScale;

  lpp.padB = 20;

  function altPlot() {}

  altPlot.xParam = function(val) {
    if (!arguments.length) return xParam; 
    xParam = val;
    return altPlot;
  }

  // this is assumed to be a d3 selection
  altPlot.target = function(val) {
    if (!arguments.length) return targetDiv;
    targetDiv = val;
    return altPlot;
  }

  altPlot.init = function() {

    svg = targetDiv.append("svg")
                   .attr("height", lpp.height + lpp.padB + lpp.padB)
                   .attr("width", parseInt(d3.select("#alt-plot").style("width"))*lpp.relWidth);

    svgG = svg.append("g").attr("transform", "translate(" + lpp.padL + "," + lpp.padT + ")");

    svgG.append("g").attr("class", "axis").attr("id", "alt-plot-x-axis")
           .attr("transform", "translate(0," + (lpp.height) + ")");

    svgG.append("g").attr("class", "axis").attr("id", "alt-plot-y-axis");
      
    svgG.append("path").attr("id", "alt-area");
    svgG.append("path").attr("class", "mouse-position-path");

    svgG.append("g").attr("class", "brush");

    altPlot.update();
    return altPlot;

  }

  altPlot.update = function() {

    XScale = d3.scaleLinear()
                   .range( [0, +svg.attr("width") - lpp.padL - lpp.padR])
                   .domain([0, rideDetailData.last()[xParam]]);

    var XAxis = { sec: 
                    d3.axisBottom(XScale)
                      .tickValues(d3.range(0, XScale.domain()[1], 1200)) // every 20 min
                      .tickFormat(formatTimeTicks)
                      .tickSize(0,0), 
                  dst:
                    d3.axisBottom(XScale)
                      .tickValues(d3.range(0, XScale.domain()[1], 5)) // every 5 miles
                      .tickSize(0,0)
                };       


    svgG.select("#alt-plot-x-axis").call(XAxis[xParam]);

    svgG.select("#alt-plot-y-axis").selectAll("path").attr("visibility", "hidden");

    var YScaleAlt = d3.scaleLinear()
                      .range([lpp.height, 0])
                      .domain([ d3.min(rideDetailData, function(d) { return d.alt; }),
                                d3.max(rideDetailData, function(d) { return d.alt; }) ]);

    var areaAlt = d3.area()
                    .x(  function(d) { return XScale(d[xParam]); })
                    .y1( function(d) { return YScaleAlt(d.alt); })
                    .y0( lpp.height );

    var YAxisAlt  = d3.axisLeft(YScaleAlt)
                      .ticks(3).tickFormat( lpp.tickFormat['alt'] ).tickSize(-lpp.width + lpp.padL, 0);

    svgG.select("#alt-plot-y-axis").call(YAxisAlt);

    var brush = d3.brushX()
                  .extent([[0,0], [lpp.width, lpp.height]])
                  .on("start brush end", brushed);

    svgG.select(".brush").call(brush);

    svgG.select("#alt-area")
       .attr("d", function(d) { return areaAlt(rideDetailData); })
       .attr("stroke-width", 0)
       .attr("fill", "#aaa")
       .attr("opacity", .8);

    function brushed() {

      var brushRange = d3.event.selection, // this would also work: d3.brushSelection(this);
          domain = (brushRange == null) ? XScale.domain() : brushRange.map(XScale.invert) ;

      // update the linePlots (which also updates DB.rideDetailBrushed)
      d3.selectAll(".param-plot").each(function (linePlot_) {
            linePlot_.XDomain(domain).update(); });

      // update the histPlots (which uses DB.rideDetailBrushed)
      d3.selectAll(".hist-plot").each(function (histPlot_) {
            histPlot_.update(); });

      // if the brush range is not null, load brushed region stats into the preview table
      if (brushRange!=null) {
        activityInfoThis = calcLocalActivityInfo(DB.rideDetailDataBrushed);
        displayActivityStats(activityInfoThis);
      } else {
        displayActivityStats(DB.currentActivityInfo);
      }
    }
  }

  return altPlot;

} // makeRideDetailAltPlot



function makeLinePlot(rideDetailData) {

  var field = '', fieldFunc, XDomain = [], targetDiv, mouseLineTip;

  var xParam = getXParam();
  var smoothWindow = parseInt(d3.select("#details-input-smoothing").property("value"));

  var resetXAxis = 0;

  var adp = loadActivityProps();
  var lpp = loadActivityProps().linePlotProps;

  var svg, XScale, YScale, fieldIsPrimitive, plotColor;

  function linePlot() {};

  linePlot.field = function(val) {
    if (!arguments.length) return field;
    field = val;
    return linePlot;
  }

  linePlot.XDomain = function(val) {
    if(!arguments.length) return XDomain;
    XDomain = val;
    return linePlot;
  }

  linePlot.xParam = function(val) {
    if(!arguments.length) return xParam;
    if(val!=xParam) resetXAxis = 1; 
    xParam = val;
    return linePlot;
  }

  linePlot.smoothWindow = function(val) {
    if (!arguments.length) return smoothWindow;
    smoothWindow = val;
    return linePlot;
  }

  // this is assumed to be a d3 selection
  linePlot.target = function(val) {
    if (!arguments.length) return targetDiv;
    targetDiv = val;
    return linePlot;
  }

  linePlot.mouseLineTip = function() {
    return mouseLineTip;
  }

  linePlot.fieldFunc = function (func) {
    if (!arguments.length) return fieldFunc;
    fieldFunc = func;
    return linePlot;
  }

  linePlot.init = function() {

    // parseInt is required here - simple type conversion won't work (style end in 'px')
    var targetDivWidth = parseInt(targetDiv.style('width'));

    svg = targetDiv.attr("id", field).append("svg");

    svg.attr("height", lpp.height )
           .attr("width", targetDivWidth*lpp.relWidth)
           .attr("class", "")
           .attr("id", field);

    svg.append("defs").append("clipPath")
           .attr("id", "clip")
           .append("rect")
           .attr("width", svg.attr("width") - lpp.padB - lpp.padT)
           .attr("height", lpp.height);

    // plot label
    svg.append("text")
       .attr("transform", "translate(0,15)")
       .attr("text-anchor", "start")
       .attr("style", "font-size: 12px; font-weight: bold;")
       .text("fieldname"); // initial text

    var svgG = svg.append("g").attr("transform", "translate(" + lpp.padL + "," + lpp.padT + ")");

    svgG.append("g").attr("class", "axis").attr("id", "y-axis");

    svgG.append("path")
        .attr("class", "param-plot-path")
        .attr("id", "y-axis-path")
        .attr("stroke", plotColor)
        .attr("stroke-width", 1)
        .attr("fill", "none");

    svgG.append("path")
        .attr("class", "param-plot-path")
        .attr("id", "mean-path")
        .attr("stroke", "#000") // initial stroke color
        .style("stroke-dasharray", "3,3")
        .attr("stroke-width", 1)
        .attr("fill", "none");

    svgG.append("path").attr("class", "mouse-position-path");
    
    // order in .offset below is [y,x] and [0,0] is center of the mouse line 
    // (+8 for tip's div height (14px font size + 2px padding) and +15 for the offset corresponding to the svg label above)
    mouseLineTip = d3.tip()
       .attr("class", "d3-tip d3-tip-line")
       .attr("id", field)
       .offset([-lpp.height/2 - lpp.padT + 8 + 10, 0]) 
       .direction('e')
       .html(function (d) { 
          return "<span class='plot-title-value'>"+ lpp.tickFormat[d.field()](rideDetailData[d.mousePositionIndex][d.field()]) +"</span>"+ 
                 "<span class='plot-title-units'>"+ adp.paramUnits[d.field()] +"</span>";
        });

    svg.call(mouseLineTip);

    linePlot.update();

    return linePlot;
  }

  linePlot.update = function() {

    // figure out if the field is a primitive (not derived) field, or a 
    fieldIsPrimitive = Object.keys(adp.paramLabels).includes(field) ? true : false;

    // set the plot color (for the lines)
    plotColor = fieldIsPrimitive ? adp.paramColors[field] : "rgb(0,0,0)";
    plotLabel = fieldIsPrimitive ? adp.paramLabels[field] : "Derived";

    svg.select("text").text(plotLabel);
    svg.selectAll("path").attr("stroke", plotColor);

    // var fieldFuncSimple  = function(d) { return d.field; };
    // var fieldFuncComplex = function (d) { return d.field1/d.field2; };

    // var scaledFieldFunc = function(fieldFunc, scale) { 
    //   if(typeof(scale)==='undefined') var scale = function (_) { return _; };
    //   return function(d){ return scale(fieldFunc(d)); };
    // }

    var rideDetailData_ = smoothRide(rideDetailData, smoothWindow);

    // for now, scales and axes are defined from scratch here
    // (though subject to closure so mousemove can access them)

    var XScale = d3.scaleLinear().range([0, +svg.attr("width") - lpp.padL - lpp.padR]);
    var YScale = d3.scaleLinear().range([ lpp.height - lpp.padT - lpp.padB, 0 ]);

    var meanLine  = d3.line().x(function(d) { return d.x; }).y(function(d) { return d.y; });
    var paramLine = d3.line().x(function(d) { return XScale(d[xParam]); }).y(function(d) { return YScale(d[field]); });


    if (resetXAxis || !XDomain.length) XDomain = [0, rideDetailData_.last()[xParam]];

    if (resetXAxis) resetXAxis = 0;

    XDomain = (XDomain[1] - XDomain[0]) > (rideDetailData_[1][xParam] - rideDetailData_[0][xParam]) ? XDomain : [0, rideDetailData_.last()[xParam]];

    XScale.domain(XDomain);

    if (Object.keys(adp.paramDomains).includes(field)) {
      YScale.domain(adp.paramDomains[field]);
    } else {
      YScale.domain([ d3.min(rideDetailData_, function(d){return d[field]; }), 
                      d3.max(rideDetailData_, function(d){return d[field]; }) ]);
    }

    DB.rideDetailDataBrushed = rideDetailData_.filter( 
        function (d) { return d[xParam] > XDomain[0] && d[xParam] < XDomain[1]; });

    var meanSelection = d3.mean(DB.rideDetailDataBrushed, function(d) { return d[field]; });
      
    var meanLineData = [ { "x": XScale.range()[0], "y": YScale(meanSelection) },
                         { "x": XScale.range()[1], "y": YScale(meanSelection) } ];

    // this has to be called *after* domains of XScale and YScale have been updated
    var YAxis = d3.axisLeft(YScale);
    var XAxis = d3.axisBottom(XScale);

    YAxis.tickValues(YScale.domain().concat(meanSelection))
         .tickFormat(lpp.tickFormat[field])
         .tickSize(0,0);

    svg.select("#y-axis").call(YAxis);
    
    svg.select("#y-axis-path").attr("d", function(d) { return paramLine(rideDetailData_); });
    svg.select("#mean-path").attr("d", function(d) { return meanLine(meanLineData); });
      
    // for some reason, linePlot.mousemove does not work as a callback here
    // (after replacing function mousemove with linePlot.mousemove = function )
    svg.on("mousemove", mousemove);
    svg.on("mouseout", mouseout);

    function mouseout() {

      d3.selectAll(".mouse-position-path").attr("visibility", "hidden");
      
      d3.selectAll(".param-plot")
        .each(function (linePlot_) { 
            d3.select("#" + linePlot_.field()).select("svg").call(linePlot_.mouseLineTip());
            linePlot_.mouseLineTip().hide(); 
        }); 
    }

    function mousemove() {

      var mousePos  = d3.mouse(svg.node());
      var mouseXPos = mousePos[0] - lpp.padL;

      var dists = [];
      for (i = 0; i < rideDetailData_.length; i++) {
        dists.push( Math.abs(mouseXPos - XScale(rideDetailData_[i][xParam])) );
      }

      var mousePositionIndex = dists.indexOf(Math.min.apply(Math, dists));

      var mouseLine = d3.line().x(function(d) { return d.x; }).y(function(d) { return d.y; });
      
      var lineData = [ { "x": XScale(rideDetailData_[mousePositionIndex][xParam]), "y": lpp.height  },
                       { "x": XScale(rideDetailData_[mousePositionIndex][xParam]), "y": 0 } ];

      d3.selectAll(".mouse-position-path").attr("d", mouseLine(lineData)).attr("visibility", "visible");

       DB.mouseMarker.setLatLng([ +rideDetailData[mousePositionIndex].lat, +rideDetailData[mousePositionIndex].lon ]);
       // mouseMarker.setRadius(  +rideDetailData[mousePositionIndex].alt/100 );

      d3.selectAll(".param-plot")
        .each(function (linePlot_) { 

          linePlot_['mousePositionIndex'] = mousePositionIndex; 

          // even though tip is called on svg in linePlot.init, this is again necessary
          // (otherwise all the tips are drawn on the moused-over plot)
          // svg_ and not svg to avoid overwriting linePlot's private svg var
          var svg_ = d3.select("#" + linePlot_.field()).select("svg");
          svg_.call(linePlot_.mouseLineTip());

          linePlot_.mouseLineTip().show(linePlot_, svg_.select(".mouse-position-path").node()); 

          }); 

    } // mousemove


    return linePlot;
  } // linePlot.update

  return linePlot;
} //makeLinePlot






function makeHistogram(rideDetailData) {
  
  var field, XDomain, barTip;
  
  var adp = loadActivityProps();
  var lpp = loadActivityProps().linePlotProps;
  var hpp = loadActivityProps().histogramProps;

  var svg, XScaleHist, YScaleHist, YScaleHistTot, histBinsTotal, histBinsBrush;

  var dt = rideDetailData[1].sec - rideDetailData[0].sec;


  function histogram(div) {

  }

  histogram.field = function(val) {
    if (!arguments.length) return field;
    field = val;
    return histogram;
  }

  histogram.target = function(val) {
    if (!arguments.length) return targetDiv;
    targetDiv = val;
    return histogram;
  }

  histogram.XDomain = function(val) {
    if(!arguments.length) return XDomain;
    XDomain = val;
    return histogram;
  }

  histogram.init = function() {

    var targetDivWidth = parseInt(targetDiv.style('width'));

    svg = targetDiv.attr("id", field).append("svg");

    svg.attr("height", hpp.height )
           .attr("width", targetDivWidth*hpp.relWidth)
           .attr("class", "")
           .attr("id", field);

    var svgG = svg.append("g").attr("transform", "translate(" + hpp.padL + "," + hpp.padT + ")");

    svgG.append("path").attr("id", "total-hist-area");
    svgG.append("g").attr("id", "bin-container");

    svgG.append("g")
        .attr("class", "axis")
        .attr("id", "x-axis")
        .attr("transform", "translate(0," + (hpp.height - hpp.padT - hpp.padB) + ")");

    svgG.append("g")
        .attr("class", "axis")
        .attr("id", "y-axis")
        .attr("transform", "translate(" + (0) + ",0)");

    svgG.append("g").append("text").attr("class", "hist-max-label");
    
    XScaleHist = d3.scaleLinear()
                   .range([0, +svg.attr("width") - hpp.padL - hpp.padR])
                   .domain([adp.paramBins[field][0], adp.paramBins[field].slice(-1)[0]]);
    
    histBinsTotal = d3.histogram()
                          .domain(XScaleHist.domain())
                          .thresholds(adp.paramBins[field])
                          (rideDetailData.map( function(d) { return d[field]; }));

    YScaleHistTot = d3.scaleLinear()
                          .range([ 0, hpp.height - hpp.padT - hpp.padB ])
                          .domain([d3.max(histBinsTotal, function(bin) { return bin.length; }), 0]);
                   

    histogram.update();

    return histogram;
  }

  histogram.update = function() {

    var histBinsBrush = d3.histogram()
                          .domain(XScaleHist.domain())
                          .thresholds(adp.paramBins[field])
                          (DB.rideDetailDataBrushed.map( function(d) { return d[field]; }));

    var YScaleHist = d3.scaleLinear()
                       .range([ 0, hpp.height - hpp.padT - hpp.padB ])
                       .domain([d3.max(histBinsBrush, function(bin) { return bin.length; }), 0]);

    var meanSelection = d3.mean(DB.rideDetailDataBrushed, function(d) { return d[field]; });

    var XAxisHist = d3.axisBottom(XScaleHist)
                      .tickValues([XScaleHist.domain()[0], meanSelection])
                      .tickFormat(lpp.tickFormat[field])
                      .tickSize(0,0);

    var histLine = d3.line()
                     .x( function(d) { return XScaleHist((d.x1 + d.x0)/2); })
                     .y(function(d) { return YScaleHistTot(d.length); });

    var histArea = d3.area()
                     .x(histLine.x())
                     .y1(histLine.y())
                     .y0(YScaleHistTot(0))
                     .curve(d3.curveBasis);


    binTip = d3.tip().attr("class", "d3-tip")
                     .offset([-10,0])
                     .html(function (bin) { 
                        return "<span class='plot-title-value'>" + bin.x0 + '-' + bin.x1 + "</span>" + 
                               "<span class='plot-title-units'>" + bin.units + "</span>" + "<br>" + 
                               "<span class='plot-title-value'>" + formatTimeTicks(bin.length * dt) + "</span>";
                      });

    svg.call(binTip);

    svg.select("#x-axis").call(XAxisHist);

    svg.select("#total-hist-area")
           .attr("d", function(d) { return histArea(histBinsTotal); })
           .attr("stroke-width", 0)
           .attr("fill", adp.paramColors[field])
           .attr("opacity", 0.3);

    histBars = svg.select("#bin-container").selectAll("rect").data(histBinsBrush);

    histBars.transition()
            .attr("y", function (bin) { 
                return YScaleHist(bin.length); })
            .attr("height", function (bin) { 
                return YScaleHist.range()[1] - YScaleHist(bin.length); });

    histBars.enter().append("rect")
            .attr("class", "bar")
            .attr("stroke", adp.paramColors[field])
            .attr("fill", lightenColor(adp.paramColors[field], .5))
            .attr("width", function(bin) {
                return XScaleHist(bin.x1) - XScaleHist(bin.x0); })
            .attr("height", function (bin) { 
                return YScaleHist.range()[1] - YScaleHist(bin.length); })
            .attr("x", function (bin) { 
                return XScaleHist(bin.x0) + 1; })
            .attr("y", function (bin) { 
                return YScaleHist(bin.length); })
            .on("mouseover", function (bin) { 
                d3.select(this).attr("fill", lightenColor(adp.paramColors[field], 1));
                bin['units'] = adp.paramUnitsAbbr[field]; 
                binTip.show(bin); })
            .on("mouseout", function (bin) { 
                d3.select(this).attr("fill", lightenColor(adp.paramColors[field], .5)); 
                binTip.hide(bin); });

    histBinsHeight = histBinsBrush.map( function(bin) { return bin.length; });
    maxBarIndex = histBinsHeight.indexOf(d3.max(histBinsHeight));

    maxBarPos = XScaleHist((histBinsBrush[maxBarIndex].x1 + histBinsBrush[maxBarIndex].x0)/2);

    svg.select(".hist-max-label")
           .attr("transform", "translate( " + maxBarPos + ",-3)")
           .attr("text-anchor", "middle")
           .attr("style", "font-size: 9px;")
           .text(formatTimeTicks(d3.max(histBinsHeight)*dt));

    svg.select("#x-axis").selectAll("path").attr("stroke", "#333");//adp.paramColors[field]);

    return histogram;

  } // update

  return histogram;

} // makeHistogram




function formatTimeTicks(sec) {

  var time = '';

  var h = Math.floor(sec/3600);
  var m = Math.floor( (sec - h*3600)/60 );
  var s = sec - h*3600 - m*60;

  time = time + h + 'h' + d3.format("02.0f")(m) + 'm';

  return time;
}


  function loadActivityProps() {

    var f0 = d3.format('.0f');
    var f1 = d3.format('.1f');

    tickFormatFcn = function (tick, ndec) {
      return (Math.ceil(tick) - tick > 0) ? d3.format('.' + ndec + 'f')(tick) : d3.format('.0f')(tick);
    }
    

    var paramDomains = {
      spd: [0, 40], 
      pwr: [0, 400],
      hrt: [60, 200],
      cad: [0, 120],
      vam: [-5000, 3000],
      slp: [-20, 20],
      elg: [0, 5000],
      wrk: [0, 3000],
    };

    var paramColors = {
      alt: "rgb(0,0,0)",
      spd: "rgb(30, 190, 30)",
      pwr: "rgb(250, 80, 30)",
      hrt: "rgb(30, 80, 200)",
      cad: "rgb(220, 20, 190)",
      vam: "rgb(80, 80, 80)",
      slp: "rgb(30, 30, 30)",
      elg: "rgb(30, 30, 30)",
      wrk: "rgb(30, 30, 30)",
    };

    var paramLabels = {
      alt: "Elevation",
      spd: "Speed",
      pwr: "Power",
      hrt: "Heart rate",
      cad: "Cadence",
      vam: "VAM",
      slp: "Slope",
      elg: "Elevation gain",
      wrk: "Work",
    };

    var paramUnits = {
      alt: "feet",
      spd: "mph",
      pwr: "watts",
      hrt: "bpm",
      cad: "rpm",
      vam: "VAM",
      slp: "slope",
      elg: "feet",
      wrk: "kJ",
    };

    var paramUnitsAbbr = {
      alt: "ft",
      spd: "mph",
      pwr: "W",
      hrt: "bpm",
      cad: "rpm",
      vam: "VAM",
      slp: "%",
      elg: "ft",
      wrk: "kJ",
    };

    var paramBins = {
      alt: d3.range(0,10000,500),
      spd: d3.range(5, 45, 2),
      pwr: d3.range(0, 450, 25),
      hrt: d3.range(90, 190, 5),
      cad: d3.range(50, 100, 5),
      vam: d3.range(-1000, 2000, 200),
      slp: d3.range(-15, 15, 2),
    }

    var tickFormat = {
      alt: function (tick) { return tickFormatFcn(tick, 1); },
      spd: function (tick) { return tickFormatFcn(tick, 1); },
      pwr: f0,
      hrt: f0,
      cad: f0,
      vam: function (tick) { return tickFormatFcn(tick, 0); },
      slp: function (tick) { return tickFormatFcn(tick, 1); },
      elg: function (tick) { return tickFormatFcn(tick, 1); },
      wrk: f0,
    };

    var scatterPlotProps = {
      padL: 40,
      padR: 10,
      padT: 20,
      padB: 30,
      height: 200,
      width: 200,
    };

    var linePlotProps = {
      padL: 30, 
      padR: 5,
      padT: 25, 
      padB:  10,
      width: 500, relWidth: 1,
      height: 120,

      XAxisTimeFlag: 0,
      doSmoothingFlag: 0,
      tickFormat: tickFormat,
    };

    var histogramProps = {
      padL: 20, 
      padR: 0,
      padT: 15, 
      padB:  10,
      width: 500, relWidth: 1,
      height: 120,
      
      XAxisTimeFlag: 0,
      doSmoothingFlag: 0,
      tickFormat: tickFormat,
    };

    var detailProps = {

        paramDomains:  paramDomains,
        paramColors:   paramColors,
        paramLabels:   paramLabels,
        paramUnits:    paramUnits,
        paramUnitsAbbr: paramUnitsAbbr,
        paramBins:     paramBins,
        linePlotProps: linePlotProps,
        histogramProps: histogramProps,

        scatterPlotProps:   scatterPlotProps,

    };

    return detailProps;
}




function createActivityDetailControls(div) {

  div.selectAll("form").remove();

  var formdiv = div.append("form").attr("class", "form-inline")
                   .append("div").attr("class", "form-group").attr("id", "div-details-controls");

  var classStr = "form-control form-control-history";

  formdiv.append("label").attr("for", "details-select-x-axis").attr("class", "label-history").text("x-axis: ");
  formdiv.append("select").attr("class", classStr).attr("id", "details-select-x-axis");

  formdiv.append("label").attr("for", "details-input-smoothing").attr("class", "label-history").text("Smoothing: ");
  formdiv.append("input").attr("class", classStr).attr("id", "details-input-smoothing");

  var selectionXAxis = d3.select("#details-select-x-axis");
  var inputSmoothing = d3.select("#details-input-smoothing");
  
  selectionXAxis.selectAll("option")
                .data(['Time', 'Distance'])
                .enter().append("option")
                .attr("value", function(d) { return d; })
                .text(function(d) { return d; });

  selectionXAxis.property("value", "Time");
  inputSmoothing.property("value", "5");

}

function processRideDetailData(rideDetailData) {

  rideDetailData.forEach(function (row, index) {

    row.dst = row.dst / 1609;  // distance in miles
    row.alt = row.alt * 3.28;  // elevation in feet

    row.cad = +row.cad; // cadence in RPM
    row.pwr = +row.pwr; // power in watts
    row.hrt = +row.hrt; // heart rate in bpm
    row.sec = +row.sec; // elapsed time in seconds
    row.lat = +row.lat;
    row.lon = +row.lon;

  });

  var rideDetailData_ = [];

  // hard-coded subsample rate (not strictly by timestamp but by row)
  var SUBSAMPLE_RATE = 5;

  for (i = 0; i < rideDetailData.length; i = i + SUBSAMPLE_RATE) {
    rideDetailData_.push(rideDetailData[i]);
  }

  rideDetailData = rideDetailData_;

  // calc raw speed (without any smoothing)
  rideDetailData = calcRawSpd(rideDetailData);

  // calc elevation gain, slope, and VAM
  rideDetailData = calcElevationGain(rideDetailData);

    
  return rideDetailData;
}


function calcLocalActivityInfo(rideDetailData) {

  // this function recapitulates the currentActivityInfo data for an arbitrary rideDetailData array
  // this function is usually called by the alt-plot's brushed function and rideDetailData is cropped
  // according to the brushed region

  // parameter keys

   var  table_parameters = [
        ['start_time',       'total_time'],
        ['total_distance',   'average_speed'],
        ['elevation_gain',   'vert_per_mile'],
        ['total_work',       'total_calories'],
        ['average_power',    'normalized_power'],
        ['intensity_factor', 'training_stress_score', ]];

  // activity info for the whole current activity
  var activityInfo = DB.currentActivityInfo;

  var dt = rideDetailData[1].sec - rideDetailData[0].sec;

  var activityInfoThis = {};

  // get a date for the start time
  var start_time = d3.timeParse("%H:%M:%S")(activityInfo.start_time)
  
  // calculate the start time of the brushed region
  activityInfoThis.start_time = d3.timeFormat("%H:%M:%S")
    (new Date(d3.timeParse("%H:%M:%S")(activityInfo.start_time).getTime() + 1000*rideDetailData[0].sec));

  activityInfoThis.total_time = formatDuration(delta('sec'));;

  activityInfoThis.total_distance  = delta('dst');
  activityInfoThis.total_work      = delta('wrk');
  activityInfoThis.elevation_gain  = delta('elg');

  activityInfoThis.total_calories  = activityInfoThis.total_work * 1.1;  
  activityInfoThis.vert_per_mile   = activityInfoThis.elevation_gain / activityInfoThis.total_distance;

  activityInfoThis.average_speed   = d3.mean(rideDetailData, function(d) { return d.spd; });
  activityInfoThis.average_power   = d3.mean(rideDetailData, function(d) { return d.pwr; });

  activityInfoThis.normalized_power = 0;
  activityInfoThis.intensity_factor = 0;
  activityInfoThis.training_stress_score = 0;

  return activityInfoThis;

  function delta(key) { return rideDetailData.last()[key] - rideDetailData[0][key]; }

  function formatDuration(sec) {

    var h = Math.floor(sec/3600.);
    var m = Math.floor((sec-h*3600)/60);
    var s = sec - 3600*h - 60*m;

    var fmt = d3.format("02.0f");

    return fmt(h) + ":" + fmt(m) + ":" + fmt(s);

  }
}

