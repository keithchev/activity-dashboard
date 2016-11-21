
function drawActivityDetail() {

  var div = d3.select("#div-main-container");

  d3.selectAll("#div-main-container form").remove();
  d3.selectAll("#div-main-container div").remove();

  createActivityDetailControls(div);

  // write the altitude plot container divs (for now these are hard-coded)
  div.append("div")
     .attr("class", "row")
     .attr("id", "alt-plot-container");

  // write the line plot container (sub divs are added by makeLinePlots)
  div.append("div")
     .attr("class", "")
     .attr("id", "plots-1d-container");

  var json_string = "getActivityData.php?type=detail&id=" + DB.currentActivityInfo.activity_id;

  // if no postgres 
  if (false) {
    json_string = "http://127.0.0.1:7777/dev2/activity-dashboard/ignore/test_activity_id=20151231110101.json";
  }

  d3.json(json_string, function(err, rideDetailData) {

    DB.rideDetailData = processRideDetailData(rideDetailData);

    // this is maybe repetitive with same lines in onChange
    DB.detailsXAxis = d3.select("#details-select-x-axis").property("value");
    DB.detailsSmoothing = d3.select("#details-input-smoothing").property("value");

    makeRideDetailAltPlot(DB.rideDetailData, 'sec');
    makeRideDetailPlots(DB.rideDetailData);

    d3.select("#details-select-x-axis").on("change", onChange);
    d3.select("#details-input-smoothing").on("change", onChange);

  });
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

  var SUBSAMPLE_RATE = 5;

  for (i = 0; i < rideDetailData.length; i = i + SUBSAMPLE_RATE) {
    rideDetailData_.push(rideDetailData[i]);
  }

  rideDetailData = rideDetailData_;
  rideDetailData = calcRawSpd(rideDetailData);
    
  return rideDetailData;
}

function onChange() {

    DB.detailsXAxis = d3.select("#details-select-x-axis").property("value");
    DB.detailsSmoothing = d3.select("#details-input-smoothing").property("value");

    var xParam = ({Time: "sec", Distance: "dst"})[DB.detailsXAxis];

    makeRideDetailAltPlot(DB.rideDetailData, xParam);

    d3.selectAll(".param-plot")
      .each(function (linePlot_) { linePlot_.xParam(xParam).update(); });

}

function makeRideDetailAltPlot(rideDetailData, xParam) {

  var ldp = loadActivityProps();
  var lpp = loadActivityProps().linePlotProps;

  lpp.padB = 10;

  var div = d3.select("#alt-plot-container");

  div.selectAll("div").remove();

  div.append("div").attr("class", "col-sm-8").attr("id", "alt-plot");

  // future home of brushed region stats
  div.append("div").attr("class", "col-sm-3");

  svg = d3.select("#alt-plot").append("svg")
          .attr("height", lpp.height + lpp.padB + lpp.padB)
          .attr("width", parseInt(d3.select("#alt-plot").style("width"))*lpp.relWidth);

  var altPlot = svg.append("g").attr("transform", "translate(" + lpp.padL + "," + lpp.padT + ")");

  altPlot.append("g")
         .attr("class", "axis")
         .attr("id", "x-axis")
         .attr("transform", "translate(0," + (lpp.height) + ")");

  altPlot.append("g")
         .attr("class", "axis")
         .attr("id", "y-axis");
    
  altPlot.append("path").attr("id", "alt-area");
  altPlot.append("path").attr("class", "mouse-position-path");

  var XScale = d3.scaleLinear()
                 .range( [0, +svg.attr("width") - lpp.padL - lpp.padR])
                 .domain([0, rideDetailData.last()[xParam]]);

  var XAxis  = d3.axisBottom(XScale);

  if (xParam=="sec") {
    XAxis.tickValues(d3.range(0, XScale.domain()[1], 1200)) // every 20 min
         .tickFormat(formatTimeTicks).tickSize(0,0);
  } else {
    XAxis.tickValues(d3.range(0, XScale.domain()[1], 5));  //every 5 miles
  }

  altPlot.select("#x-axis").call(XAxis);

  var YScaleAlt = d3.scaleLinear()
                    .range([lpp.height, 0])
                    .domain([ d3.min(rideDetailData, function(d) { return d.alt; }),
                              d3.max(rideDetailData, function(d) { return d.alt; }) ]);

  var areaAlt = d3.area()
                  .x(  function(d) { return XScale(d[xParam]); })
                  .y1( function(d) { return YScaleAlt(d.alt); })
                  .y0( lpp.height );

  var YAxisAlt  = d3.axisLeft(YScaleAlt)
                    .ticks(3).tickFormat( lpp.tickFormat['alt'] ).tickSize(0,0);

  altPlot.select("#y-axis").call(YAxisAlt);

  var brush = d3.brushX()
                .extent([[0,0], [lpp.width, lpp.height]])
                .on("start brush end", brushed);

  if (altPlot.select(".brush").empty()) {
    altPlot.append("g").attr("class", "brush").call(brush);
  } else {
    altPlot.select(".brush").call(brush);
  }

  altPlot.select("#alt-area")
     .attr("d", function(d) { return areaAlt(rideDetailData); })
     .attr("stroke-width", 0)
     .attr("fill", "#888")
     .attr("opacity", 0.5);

  function brushed() {

    var brushRange = d3.event.selection; // this would also work: d3.brushSelection(this);
    var domain = (brushRange == null) ? XScale.domain() : brushRange.map(XScale.invert) ;
    
    d3.selectAll(".param-plot")
      .each(function (linePlot_) {
          linePlot_.XDomain(domain).update(); 
      });
  }

} // makeRideDetailAltPlot


function makeRideDetailPlots(rideDetailData) {
  
  //var windowSize = +document.getElementById("text-smoothing-window").value;
  var windowSize = 5;

  // need a list of lists to pass to select().data()
  var fields = ['spd', 'pwr', 'hrt', 'cad', 'vam', 'slp'].map(function(field) { return [field]; });

  rideDetailData = smoothRide(rideDetailData, windowSize);
  rideDetailData = calcElevationGain(rideDetailData);

  var linePlots = [];
  
  fields.forEach( function(field) { 
    linePlots.push(makeLinePlot(rideDetailData).field(field)); 
  });

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


  // plotContainers.selectAll(".hist-plot")
  //    .data(histPlots)
  //    .enter().append("div")
  //    .attr("class", "col-sm-3 hist-plot")
  //    .each(function (histPlot) { histPlot.target(d3.select(this)).init(); });

}


function makeLinePlot(rideDetailData) {

  var field = '', smoothing = 5, XDomain = [], xParam = 'sec', targetDiv, mouseLineTip;

  var resetXAxis = 0;

  var svg;

  var adp = loadActivityProps();
  var lpp = loadActivityProps().linePlotProps;
  var hpp = loadActivityProps().histPlotProps;

  var XScale, YScale;

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

  linePlot.smoothing = function(val) {
    if (!arguments.length) return smoothing;
    smoothing = val;
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

  linePlot.init = function() {

    // parseInt is required here - simple type conversion won't work (style end in 'px')
    var targetDivWidth = parseInt(targetDiv.style('width'));

    svg = targetDiv.attr("id", field).append("svg");

    svg.attr("height", lpp.height + lpp.padT + lpp.padB)
           .attr("width", targetDivWidth*lpp.relWidth)
           .attr("class", "")
           .attr("id", field);

    svg.append("defs").append("clipPath")
           .attr("id", "clip")
           .append("rect")
           .attr("width", svg.attr("width") - lpp.padB - lpp.padT)
           .attr("height", lpp.height);


    var plot = svg.append("g").attr("transform", "translate(" + lpp.padL + "," + lpp.padT + ")");

    plot.append("g").attr("class", "axis").attr("id", "y-axis");

    plot.append("path")
        .attr("class", "param-plot-path")
        .attr("id", "y-axis-path")
        .attr("stroke", adp.paramColors[field])
        .attr("stroke-width", 1)
        .attr("fill", "none");

    plot.append("path")
        .attr("class", "param-plot-path")
        .attr("id", "mean-path")
        .attr("stroke", adp.paramColors[field])
        .style("stroke-dasharray", "3,3")
        .attr("stroke-width", 1)
        .attr("fill", "none");

    plot.append("path").attr("class", "mouse-position-path");

    mouseLineTip = d3.tip()
       .attr("class", "d3-tip d3-tip-line")
       .attr("id", field)
       .offset([-lpp.height/2 + 8, -5]) // +8 for tip's div height (14px font size + 2px padding)
       .direction("e")
       .html(function (d) { 
          return "<span class='plot-title-value'>"+ lpp.tickFormat[d.field()](rideDetailData[d.mousePositionIndex][d.field()]) +"</span>"+ 
                 "<span class='plot-title-units'>"+ adp.paramUnits[d.field()] +"</span>";
        });

    svg.call(mouseLineTip);

    linePlot.update();

    return linePlot;
  }

  linePlot.update = function(resetXAxis) {

      // for now, scales and axes are defined from scratch here
      // (though subject to closure so mousemove can access them)


      var XScale = d3.scaleLinear().range([0, +svg.attr("width") - lpp.padL - lpp.padR]);
      var YScale = d3.scaleLinear().range([ lpp.height, 0 ]);

      var meanLine  = d3.line().x(function(d) { return d.x; }).y(function(d) { return d.y; });
      var paramLine = d3.line().x(function(d) { return XScale(d[xParam]); }).y(function(d) { return YScale(d[field]); });

      if (resetXAxis || !XDomain.length) XDomain = [0, rideDetailData.last()[xParam]];

      if (resetXAxis) resetXAxis = 0;

      XScale.domain(XDomain);
      YScale.domain(adp.paramDomains[field]);

      var rideDetailDataBrushed = rideDetailData.filter( function (d) { return d[xParam] > XDomain[0] && d[xParam] < XDomain[1]; });
  
      // var meanSelection = listOfDictsToDictOfLists(rideDetailDataBrushed)[field]
      //                 .reduce(function(x1, x2) { return x1 + x2; }) / rideDetailDataBrushed.length;

      var meanSelection = d3.mean(rideDetailDataBrushed, function(d) { return d[field]; });
        
      var meanLineData = [ { "x": XScale.range()[0], "y": YScale(meanSelection) },
                           { "x": XScale.range()[1], "y": YScale(meanSelection) } ];

      // this has to be called *after* domains of XScale and YScale have been updated
      var YAxis = d3.axisLeft(YScale);
      var XAxis = d3.axisBottom(XScale);

      YAxis.tickValues(adp.paramDomains[field].concat(meanSelection))
           .tickFormat(lpp.tickFormat[field])
           .tickSize(0,0);

      svg.select("#y-axis").call(YAxis);
      
      svg.select("#y-axis-path").attr("d", function(d) { return paramLine(rideDetailData); });
      svg.select("#mean-path").attr("d", function(d) { return meanLine(meanLineData); });
        
      svg.on("mousemove", linePlot.mousemove);
      svg.on("mouseout", linePlot.mouseout);


      return linePlot;
  }

  linePlot.mousemove = function() {

    var mousePos  = d3.mouse(this);
    var mouseXPos = mousePos[0] - lpp.padL;

    var dists = [];
    for (i = 0; i < rideDetailData.length; i++) {
      dists.push( Math.abs(mouseXPos - XScale(rideDetailData[i][xParam])) );
    }

    var mousePositionIndex = dists.indexOf(Math.min.apply(Math, dists));

    var mouseLine = d3.line().x(function(d) { return d.x; }).y(function(d) { return d.y; });
    
    var lineData = [ { "x": XScale(rideDetailData[mousePositionIndex][x]), "y": YScale.range()[0] },
                     { "x": XScale(rideDetailData[mousePositionIndex][x]), "y": YScale.range()[1] } ];

    d3.selectAll(".mouse-position-path").attr("d", mouseLine(lineData)).attr("visibility", "visible");

     // mouseMarker.setLatLng([ +rideDetailData[mousePositionIndex].lat, +rideDetailData[mousePositionIndex].lon ]);
     // mouseMarker.setRadius(  +rideDetailData[mousePositionIndex].alt/100 );

    d3.selectAll(".param-plot")
      .each(function (linePlot_) { 

        linePlot_['mousePositionIndex'] = mousePositionIndex; 

        // even though tip is called on svg in linePlot.init, this is again necessary
        // (otherwise all the tips are drawn on the moused-over plot)
        // svg_ and not svg to avoid overwriting linePlot's private svg var
        var svg_ = d3.select("#" + linePlot_.field()).select("svg");
        svg_.call(linePlot_.mouseLineTip());

        linePlot_.mouseLineTip()
          .direction( function () { return 'w'; }) // (XScale(rideDetailData[mousePositionIndex].sec) > XScale.range()[1] * .8) ? 'w' : 'e'; })
          .show(linePlot_, svg_.select(".mouse-position-path").node()); 

        }); 

  } // mousemove

  linePlot.mouseout = function() {

    d3.selectAll(".mouse-position-path").attr("visibility", "hidden");
    
    d3.selectAll(".param-plot")
      .each(function (linePlot_) { 
          d3.select("#" + linePlot_.field()).select("svg").call(linePlot_.mouseLineTip());
          linePlot_.mouseLineTip().hide(); 
      }); 
  }

  return linePlot;

} //makeLinePlot



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
    };

    var paramColors = {
      spd: "rgb(30, 190, 30)",
      pwr: "rgb(250, 80, 30)",
      hrt: "rgb(30, 80, 200)",
      cad: "rgb(220, 20, 190)",
      vam: "rgb(80, 80, 80)",
      slp: "rgb(30, 30, 30)",
    };

    var paramUnits = {
      alt: "feet",
      spd: "mph",
      pwr: "watts",
      hrt: "bpm",
      cad: "rpm",
      vam: "VAM",
      slp: "slope",
    };

    var paramUnitsAbbr = {
      alt: "ft",
      spd: "mph",
      pwr: "W",
      hrt: "bpm",
      cad: "rpm",
      vam: "VAM",
      slp: "%",
    };

    var paramBins = {
      alt: [],
      spd: d3.range(5, 45, 2),
      pwr: d3.range(0, 450, 25),
      hrt: d3.range(90, 190, 5),
      cad: d3.range(50, 100, 5),
      vam: d3.range(-1000, 2000, 200),
      slp: d3.range(-15, 15, 2),
    }

    var tickFormat = {
      alt: function (tick) { return tickFormatFcn(tick/1000, 1); },
      spd: function (tick) { return tickFormatFcn(tick, 1); },
      pwr: f0,
      hrt: f0,
      cad: f0,
      vam: function (tick) { return tickFormatFcn(tick/10, 0); },
      slp: function (tick) { return tickFormatFcn(tick, 1); },
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
      padT: 5, 
      padB:  5,
      width: 500, relWidth: 1,
      height: 100,

      XAxisTimeFlag: 0,
      doSmoothingFlag: 0,
      tickFormat: tickFormat,
    };

    var histPlotProps = {
      padL: 20, 
      padR: 0,
      padT: 10, 
      padB:  5,
      width: 500, relWidth: 1,
      height: 100,
      
      XAxisTimeFlag: 0,
      doSmoothingFlag: 0,
      tickFormat: tickFormat,
    };

    var detailProps = {

        paramDomains:  paramDomains,
        paramColors:   paramColors,
        paramUnits:    paramUnits,
        paramUnitsAbbr: paramUnitsAbbr,
        paramBins:     paramBins,
        linePlotProps: linePlotProps,
        histPlotProps: histPlotProps,

        scatterPlotProps:   scatterPlotProps,

    };

    return detailProps;
}
