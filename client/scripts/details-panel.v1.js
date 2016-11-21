
  function drawActivityDetail() {

    d3.selectAll("#div-main-container form").remove();
    d3.selectAll("#div-main-container div").remove();

    // write the altitude plot container divs (for now these are hard-coded)
    d3.select("#div-main-container")
      .append("div")
      .attr("class", "row")
      .attr("id", "alt-plot-container");

    // write the line plot container (sub divs are added by makeLinePlots)
    d3.select("#div-main-container")
      .append("div")
      .attr("class", "")
      .attr("id", "plots-1d-container");

    var json_string = "getActivityData.php?type=detail&id=" + DB.currentActivityInfo.activity_id;

    var USING_LAPTOP = 0;

    if (USING_LAPTOP) {
      json_string = "http://127.0.0.1:7777/dev2/activity-dashboard/ignore/test_activity_id=20151231110101.json";
    }

    d3.json(json_string, function(err, rideDetailData) {

      DB.rideDetailData = processRideDetailData(rideDetailData);

      makeRideDetailAltPlot(DB.rideDetailData);
      makeRideDetailPlots(DB.rideDetailData);
    });
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

  function makeRideDetailAltPlot(rideDetailData) {

    var ldp = loadActivityProps();
    var lpp = loadActivityProps().linePlotProps;

    lpp.padB = 20;

    var div = d3.select("#alt-plot-container");

    div.selectAll("div").remove();

    var svg = div.append("div").attr("class", "col-sm-8 line-plot").attr("id", "alt-plot").append("svg");

    div.append("div").attr("class", "col-sm-3 hist-plot").append("svg");

    svg.attr("height", lpp.height + lpp.padB + lpp.padB)
       .attr("width", parseInt(d3.select(svg.node().parentNode).style("width"))*lpp.relWidth);

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
                   .domain([0, rideDetailData[rideDetailData.length-1].sec]);

    var XAxis  = d3.axisBottom(XScale)
                   .tickValues(d3.range(0, XScale.domain()[1], 1200))
                   .tickFormat(formatTimeTicks).tickSize(0,0);

    altPlot.select("#x-axis").call(XAxis);

    var YScaleAlt = d3.scaleLinear()
                      .range([lpp.height, 0])
                      .domain([ d3.min(rideDetailData, function(d) { return d.alt; }),
                                d3.max(rideDetailData, function(d) { return d.alt; }) ]);

    var areaAlt = d3.area()
                    .x(  function(d) { return XScale(d.sec); })
                    .y1( function(d) { return YScaleAlt(d.alt); })
                    .y0( lpp.height );

    var YAxisAlt  = d3.axisLeft(YScaleAlt)
                      .ticks(3).tickFormat( lpp.tickFormat['alt'] );

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
      
      d3.selectAll(".line-plot-container")
        .each(function (linePlot) { 
            //d3.select(this).call(linePlot.XDomain(domain));
            linePlot.XDomain(domain)(d3.select(this)); 
          });
    }

  } // makeRideDetailAltPlot




    function makeRideDetailPlots(rideDetailData) {
  
    //var windowSize = +document.getElementById("text-smoothing-window").value;
    var windowSize = 5;

    var fields = ['spd', 'pwr', 'hrt', 'cad', 'vam', 'slp'];

    rideDetailData = smoothRide(rideDetailData, windowSize);
    rideDetailData = calcElevationGain(rideDetailData);

    var linePlots = [];
    
    fields.forEach( function(field) { 
      linePlots.push(makeLinePlot(rideDetailData).field(field)); 
    });

    d3.select("#plots-1d-container")
      .selectAll("div")
      .data(linePlots)
      .enter().append("div")
      .attr("class", "row line-plot-container");

    d3.selectAll(".line-plot-container")
      .data(linePlots)
      .each(function (linePlot) { d3.select(this).call(linePlot); });

  }



  function makeLinePlot(rideDetailData) {

    rideDetailData = calcElevationGain(rideDetailData);

    var field, smoothing = 0, XDomain = [];
    var N = rideDetailData.length;
    var mouseLineTip;

    function linePlot(div) {

      var adp = loadActivityProps();
      var lpp = loadActivityProps().linePlotProps;
      var hpp = loadActivityProps().histPlotProps;

      var svgLine = div.select(".line-plot").select("svg");
      var svgHist = div.select(".hist-plot").select("svg");

      if (div.select("svg").empty()) {

        svgLine = div.append("div").attr("class", "col-sm-8 line-plot").attr("id", field).append("svg");
        svgHist = div.append("div").attr("class", "col-sm-3 hist-plot").append("svg");

        svgLine.attr("height", lpp.height + lpp.padT + lpp.padB)
               .attr("width", parseInt(d3.select(svgLine.node().parentNode).style("width"))*lpp.relWidth)
               .attr("class", "");

        svgHist.attr("height", hpp.height + hpp.padT + hpp.padB)
               .attr("width", parseInt(d3.select(svgHist.node().parentNode).style("width"))*hpp.relWidth)
               .attr("class", "");

        svgLine.append("defs").append("clipPath")
               .attr("id", "clip")
               .append("rect")
               .attr("width", svgLine.attr("width") - lpp.padB - lpp.padT)
               .attr("height", lpp.height);

        var plot = svgLine.append("g").attr("transform", "translate(" + lpp.padL + "," + lpp.padT + ")");

        plot.append("g").attr("class", "axis").attr("id", "y-axis");

        plot.append("path").attr("class", "line-plot-path").attr("id", "y-axis-path");
        plot.append("path").attr("class", "line-plot-path").attr("id", "mean-path");
        plot.append("path").attr("class", "mouse-position-path");

        var hist = svgHist.append("g").attr("transform", "translate(" + hpp.padL + "," + hpp.padT + ")");

        hist.append("path").attr("id", "total-hist-area");
        hist.append("g").attr("id", "bin-container");

        hist.append("g")
            .attr("class", "axis")
            .attr("id", "x-axis")
            .attr("transform", "translate(0," + (hpp.height - hpp.padB -hpp.padT) + ")");

        hist.append("g")
            .attr("class", "axis")
            .attr("id", "y-axis")
            .attr("transform", "translate(" + (0) + ",0)");

        hist.append("g").append("text").attr("class", "hist-max-label");

        mouseLineTip = d3.tip()
           .attr("class", "d3-tip d3-tip-line")
           .attr("id", field)
           .offset([-lpp.height/2 + 8, -1]) // +8 for div height (14px font size + 2px padding)
           .direction("e")
           .html(function (d) { 
              return "<span class='plot-title-value'>" + lpp.tickFormat[d.field()]( rideDetailData[d.mousePositionIndex][d.field()])  + "</span>" + 
                     "<span class='plot-title-units'>" +  adp.paramUnits[d.field()] + "</span>" ;
            });
      }

      var XScale = d3.scaleLinear().range([0, +svgLine.attr("width") - lpp.padL - lpp.padR]);
      var YScale = d3.scaleLinear().range([ lpp.height, 0 ]);

      var YAxis = d3.axisLeft(YScale);
      var XAxis = d3.axisBottom(XScale);

      var meanLine = d3.line().x(function(d) { return d.x; }).y(function(d) { return d.y; });

      XDomain = XDomain.length ? XDomain : [0, rideDetailData[N-1].sec];
      XDomain = (XDomain[1] - XDomain[0] > 10) ? XDomain : [0, rideDetailData[N-1].sec];
      
      XScale.domain(XDomain);
      YScale.domain(adp.paramDomains[field]);

      var rideDetailDataBrushed = rideDetailData.filter( function (d) { return d.sec > XDomain[0] && d.sec < XDomain[1]; });
  
      meanSelection = listOfDictsToDictOfLists(rideDetailDataBrushed)[field]
                      .reduce(function(x1, x2) { return x1 + x2; }) / rideDetailDataBrushed.length;
        
      var meanLineData = [ { "x": XScale.range()[0], "y": YScale(meanSelection) },
                           { "x": XScale.range()[1], "y": YScale(meanSelection) } ];

      YAxis.tickValues(adp.paramDomains[field].concat(meanSelection))
           .tickFormat(lpp.tickFormat[field]);
           //.tickSize(0,0);

      paramLine = d3.line().x(function(d) { return XScale(d.sec); })
                           .y(function(d) { return YScale(d[field]); });

      svgLine.select("#y-axis").call(YAxis);
      
      svgLine.select("#y-axis-path")
          .attr("d", function(d) { return paramLine(rideDetailData); })
          .attr("stroke", adp.paramColors[field])
          .attr("stroke-width", 1)
          .attr("fill", "none");

      svgLine.select("#mean-path")
          .attr("d", function(d) { return meanLine(meanLineData); })
          .attr("stroke", adp.paramColors[field])
          .style("stroke-dasharray", "3,3")
          .attr("stroke-width", 1)
          .attr("fill", "none");
        
      svgLine.on("mousemove", mousemove);
      svgLine.on("mouseout", mouseout);


      XScaleHist = d3.scaleLinear()
                     .range([0, +svgHist.attr("width") - hpp.padL - hpp.padR])
                     .domain([adp.paramBins[field][0], adp.paramBins[field].slice(-1)[0]]);

      histBinsTotal = d3.histogram()
                        .domain(XScaleHist.domain())
                        .thresholds(adp.paramBins[field])
                        (rideDetailData.map( function(d) { return d[field]; }));

      histBinsBrush = d3.histogram()
                        .domain(XScaleHist.domain())
                        .thresholds(adp.paramBins[field])
                       (rideDetailDataBrushed.map( function(d) { return d[field]; }));

      YScaleHist = d3.scaleLinear()
                     .range([ 0, hpp.height - hpp.padT - hpp.padB ])
                     .domain([d3.max(histBinsBrush, function(bin) { return bin.length; }), 0]);

      YScaleHistTot = d3.scaleLinear()
                     .range([ 0, hpp.height - hpp.padT - hpp.padB ])
                     .domain([d3.max(histBinsTotal, function(bin) { return bin.length; }), 0]);

      XAxisHist = d3.axisBottom(XScaleHist)
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

      var dt = rideDetailData[1].sec - rideDetailData[0].sec;

      binTip = d3.tip().attr("class", "d3-tip")
                       .offset([-10,0])
                       .html(function (bin) { 
                          return "<span class='plot-title-value'>" + bin.x0 + '-' + bin.x1 + "</span>" + 
                                 "<span class='plot-title-units'>" + bin.units + "</span>" + "<br>" + 
                                 "<span class='plot-title-value'>" + formatTimeTicks(bin.length * dt) + "</span>";
                        });

      svgHist.call(binTip);

      svgHist.select("#x-axis").call(XAxisHist);

      svgHist.select("#total-hist-area")
             .attr("d", function(d) { return histArea(histBinsTotal); })
             .attr("stroke-width", 0)
             .attr("fill", adp.paramColors[field])
             .attr("opacity", 0.3);

      histBars = svgHist.select("#bin-container").selectAll("rect").data(histBinsBrush);

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

      svgHist.select(".hist-max-label")
             .attr("transform", "translate( " + maxBarPos + ",-3)")
             .attr("text-anchor", "middle")
             .attr("style", "font-size: 9px;")
             .text(formatTimeTicks(d3.max(histBinsHeight)*dt));

      svgHist.select("#x-axis").selectAll("path").attr("stroke", adp.paramColors[field]);



      function mousemove(d, i) {

        var mousePos  = d3.mouse(this);
        var divID     = d3.select(this.parentNode).attr("id");
        var mouseXPos = mousePos[0] - lpp.padL;

        dists = [];
        for (i = 0; i < rideDetailData.length; i++) {
          dists.push( Math.abs(mouseXPos - XScale(rideDetailData[i].sec)) );
        }

        mousePositionIndex = dists.indexOf(Math.min.apply(Math, dists));

        var mouseLine = d3.line().x(function(d) { return d.x; }).y(function(d) { return d.y; });
        
        var lineData = [ { "x": XScale(rideDetailData[mousePositionIndex].sec), "y": YScale.range()[0] },
                         { "x": XScale(rideDetailData[mousePositionIndex].sec), "y": YScale.range()[1] } ];

        d3.selectAll(".mouse-position-path").attr("d", mouseLine(lineData)).attr("visibility", "visible");

      //   // mouseMarker.setLatLng([ +rideDetailData[mousePositionIndex].lat, +rideDetailData[mousePositionIndex].lon ]);
      //   // mouseMarker.setRadius(  +rideDetailData[mousePositionIndex].alt/100 );

        d3.selectAll(".line-plot-container")
          .select(".plot-title-value")
          .text( function (d) { 
            return lpp.tickFormat[d.field()]( rideDetailData[mousePositionIndex][d.field()] ); 
          });

        d3.select("#alt-title").text(rideDetailData[mousePositionIndex].alt.toFixed(0));


        d3.selectAll(".line-plot-container")
          .each(function (d) { 

              d['mousePositionIndex'] = mousePositionIndex; 
              svg = d3.select("#" + d.field()).select("svg");
              svg.call(d.mouseLineTip());

              d.mouseLineTip()
               .direction(function () { 
                  if (XScale(rideDetailData[mousePositionIndex].sec) > XScale.range()[1] * .8) {
                    return 'w';
                  } else {
                    return 'e';
                  } })
               .show(d, svg.select(".mouse-position-path").node()); 

            }); 
        

      } // mousemove

      function mouseout(d, i) {

        d3.selectAll(".mouse-position-path").attr("visibility", "hidden");
        
        d3.selectAll(".line-plot-container")
          .each(function (d) { 

              svg = d3.select("#" + d.field()).select("svg");
              svg.call(d.mouseLineTip());

              d.mouseLineTip().hide(); 

          }); 
      }

    } // linePlot

    linePlot.mouseLineTip = function(val) {
      if (!arguments.length) return mouseLineTip;
      field = val;
      return linePlot;
    }

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

    linePlot.smoothing = function(val) {
      if (!arguments.length) return smoothing;
      smoothing = val;
      return linePlot;
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

