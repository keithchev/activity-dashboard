

function HistoryPlot(div) {

  this.div = div;
  this.div.selectAll("div").remove();
  this.div.selectAll("svg").remove();

  createHistoryPlotControls(this.div);

  div.append("div").attr("id", "div-history-plot");

  this.rideData = DB.rideData.copy();
  this.params   = loadProps().rideParametersByKey;
  this.rideDict = listOfDictsToDictOfLists(this.rideData);

  var onChange = this.draw.bind(this);

  d3.select("#history-select-parameter").on("change", onChange );
  d3.select("#history-select-conv-type").on("change", onChange );
  d3.select("#history-select-conv-window").on("change", onChange );
  d3.select("#history-select-mean-or-sum").on("change", onChange );

}

// this draws the history plot from scratch (called on init or window resize)
HistoryPlot.prototype.load = function () {

  var divSize = {'w': parseInt(d3.select("#div-history-plot").style('width')),
                 'h': parseInt(d3.select("#div-history-plot").style('width'))/2};
  
  var divPad = 0; 
  var plotPad = {'h': 20, 'w': 50};
  var plotSize = {'h': divSize.h - divPad, 'w': divSize.w - divPad};

  d3.select("#div-history-plot").selectAll("svg").remove();

  var svg = d3.select("#div-history-plot")
          .append("svg")
          .attr("width", plotSize.w)
          .attr("height", plotSize.h)
          .attr("fill", "#efefef")
          .append("g")
          .attr("transform", "translate(" + divPad + "," + divPad + ")");

  svg.append("g")
     .attr("class", "axis")
     .attr("id", "history-x-axis")
     .attr("transform", "translate(0," + (plotSize.h - plotPad.h ) + ")");

  svg.append("g")
     .attr("class", "axis")
     .attr("id", "history-y-axis-left")
     .attr("transform", "translate(" + (plotPad.w - 10) + ",0)");

  svg.append("g")
     .attr("class", "axis")
     .attr("id", "history-y-axis-right")
     .attr("transform", "translate(" + (plotSize.w - plotPad.w) + ",0)");

  svg.append("path")
     .attr("class", "line-plot-path")
     .attr("id", "conv-path")
     .attr("stroke", "tomato")
     .attr("stroke-width", 1.5)
     .attr("fill", "none");
 
  this.plotSize = plotSize;
  this.plotPad = plotPad;
  this.svg = svg;

  this.draw();
  this.update();

}

HistoryPlot.prototype.draw = function () { 

  var params = loadProps().rideParametersByKey,

     historyPlotConvWindow = d3.select("#history-select-conv-window").property("value"),
     historyPlotParameter  = d3.select("#history-select-parameter").property("value"),
     historyPlotConvType   = d3.select("#history-select-conv-type").property("value"),
     historyPlotMeanOrSum  = d3.select("#history-select-mean-or-sum").property("checked");

  var plotSize = this.plotSize,
      plotPad  = this.plotPad,
      svg = this.svg;

  var XScale, XAxis, XGrid, YAxisLeft, YAxisRight, YScaleParam, YScaleConv, lineConv;

  var date_i = d3.timeDay.offset(d3.min(this.rideDict.timestamp), 0),
      date_f = d3.timeDay.offset(d3.max(this.rideDict.timestamp), 0);

  var convData = [];
  if (historyPlotConvType != "None") {
    convData = calcConvolution(
                historyPlotConvType, 
                historyPlotConvWindow*24*3600000, 
                historyPlotParameter
                );
  }

  XScale = d3.scaleTime().range([plotPad.w, plotSize.w - plotPad.w]).domain([date_i, date_f]);

  XAxis = d3.axisBottom(XScale).ticks(d3.timeMonth.every(1)).tickFormat("").tickSize(0,0,0);

  XGrid = d3.axisBottom(XScale)
            .ticks(d3.timeMonth.every(1))
            .tickFormat(d3.timeFormat("%b %y"))
            .tickSize(-(plotSize.h - 2*plotPad.h),0,0);

  YScaleParam = d3.scaleLinear()
                  .range([ plotSize.h - plotPad.h, plotPad.h ])
                  .domain(params[historyPlotParameter].range);

  YScaleConv = d3.scaleLinear()
                 .range([ plotSize.h - plotPad.h, plotPad.h ])
                 .domain(params[historyPlotParameter].range); 

  lineConv = d3.line()
               .x(function(d) {return XScale(d.days); })
               .y(function(d) {return YScaleConv(d.conv/d.count); })
               .curve(d3.curveLinear);

  this.svg.select("#history-y-axis-right").attr("visibility", "hidden");

  if (!historyPlotMeanOrSum) {
    convData = convData.map(function(d){ d.count = 1; return d; });
    YScaleConv.domain([ YScaleParam.domain()[0], d3.max(convData, function(d) { return d.conv/d.count; }) ]);
    this.svg.select("#history-y-axis-right").attr("visibility", "visible");
  } 

  var tickStep = params[historyPlotParameter].step;

  YAxisLeft = d3.axisLeft(YScaleParam)
                .tickValues(d3.range(tickStep, YScaleParam.domain()[1], tickStep))
                .tickSize((-plotSize.w + plotPad.w)*0, 0, 0);

  YAxisRight = d3.axisRight(YScaleConv).tickSize(0,0,0).ticks(4);

  if (historyPlotParameter == 'total_time_sec') {
    YAxisLeft.tickFormat( function (sec) { return Math.floor(sec/3600) + "h"; });
    YAxisRight.tickFormat( function (sec) { return Math.floor(sec/3600) + "h"; });
  }

  svg.select("#history-x-axis").call(XGrid);
  svg.select("#history-y-axis-left").transition().duration(500).call(YAxisLeft);
  svg.select("#history-y-axis-right").transition().duration(500).call(YAxisRight);

  svg.select("#conv-path").transition().duration(500).attr("d", function(d) { return lineConv(convData); });

  svg.selectAll(".history-dot")
    .data(this.rideData)
    .enter().append("circle")
    .attr("class", "history-dot")
    .attr("r", 5)
    .attr("cx", function(d) { return XScale(d.timestamp); })
    .attr("cy", function(d) { return YScaleParam(d[historyPlotParameter]); })
    .style("fill", function(d) { return "#0066ff"; })
    .style("opacity", .7)
    .on("mouseover", function() { 
      d3.select(this).attr("r", 7); })
    .on("mouseout", function() { 
      d3.select(this).attr("r", 5); })
    .on("click", function(rideDataRow) { 
      changeActivity(rideDataRow); });

  svg.selectAll(".history-dot").transition().duration(500)
  .attr("cy", function(d) { return YScaleParam(d[historyPlotParameter]); });

  // remove the first y axis tick 
  d3.selectAll("#history-y-axis-left g").each( function() { 
    if (d3.select(this).select("text").text()=="0") { 
      d3.select(this).attr("visibility", "hidden"); 
    } 
  });

  // remove the first y axis tick 
  d3.selectAll("#history-y-axis-right g").each( function() { 
    if (d3.select(this).select("text").text()=="0") { 
      d3.select(this).attr("visibility", "hidden"); 
    }
  });

}

HistoryPlot.prototype.update = function() {

    this.svg.selectAll(".history-dot")
        .style("fill", "#0066ff")
        .style("opacity", .7)
        .filter(function (d) { return d.activity_id == DB.currentActivityInfo.activity_id; })
        .style("fill", "orange").style("opacity", 1);
    
}

function createHistoryPlotControls(targetDiv) {

  //we assume targetDiv is a d3 selection
  targetDiv.select("form").remove();
  targetDiv.append("form").attr("class", "form-inline");
  targetDiv.select("form").append("div")
           .attr("class", "form-group").attr("id", "div-history-controls");
  
  var formdiv = targetDiv.select("#div-history-controls");

  var classStr = "form-control form-control-history";

  formdiv.append("label").attr("for", "history-select-parameter").attr("class", "label-history").text("Parameter: ");
  formdiv.append("select").attr("class", classStr).attr("id", "history-select-parameter");

  formdiv.append("label").attr("for", "history-select-conv-type").attr("class", "label-history").text("Convolution type: ");
  formdiv.append("select").attr("class", classStr).attr("id", "history-select-conv-type");
  
  formdiv.append("label").attr("for", "history-select-conv-window").attr("class", "label-history").text("Window size: ");
  formdiv.append("input").attr("class", classStr).attr("id", "history-select-conv-window");

  formdiv.append("label").attr("for", "history-select-mean-or-sum").attr("class", "label-history").text("Show mean: ");
  formdiv.append("input").attr("type", "checkbox").attr("class", classStr).attr("id", "history-select-mean-or-sum");

  var historySelectParameter  = d3.select("#history-select-parameter"),
      historySelectConvType   = d3.select("#history-select-conv-type"),
      historySelectConvWindow = d3.select("#history-select-conv-window"),
      historySelectMeanOrSum  = d3.select("#history-select-mean-or-sum");

  selectableParams = loadProps().rideParameters.filter( function(row) { return row.range.length!=0; });
  
  historySelectParameter.selectAll("option")
                .data(selectableParams)
                .enter().append("option")
                .attr("value", function(d) { return d.key; })
                .text(function(d) { return d.label; });

  historySelectConvType.selectAll("option")
                   .data(['None', 'Window', 'Exponential'])
                   .enter().append("option")
                   .attr("value", function (d) { return d; })
                   .text(function(d) { return d; }); 

  historySelectParameter.property("value", "total_distance");
  historySelectConvType.property("value", "Window");
  historySelectConvWindow.property("value", "30");
  historySelectMeanOrSum.property("checked", false);

}



function calcConvolution(convType, windowSize, param) {

  var rideData = DB.rideData.copy();

  if (convType == 'Window') { calcConvWeight = convWeightWindow; }
  if (convType == 'Exponential') {calcConvWeight = convWeightExp; }

  var windowSizeInDays = Math.ceil(windowSize / (3600000 * 24));

  var days = d3.timeDay.range(rideData[0].timestamp, rideData[rideData.length-1].timestamp);

  var conv  = new Array(days.length).fill(0);
  var count = new Array(days.length).fill(0);

  for (i = 0; i < rideData.length; i=i+1) {
    for (j = windowSizeInDays+1; j < days.length; j=j+1) {

      dt = days[j] - rideData[i].timestamp;
      convWeight = calcConvWeight(dt, windowSize);

      if (convWeight > 0) { count[j]++; }
      conv[j] = conv[j] + convWeight * rideData[i][param];
    }
  }

  var convData = [];
  for (j = 0; j < days.length; j=j+1) {
    convData.push( {days: days[j], conv: conv[j], count: count[j] > 0 ? count[j] : 9999,} );
  }

  return convData;

}

function convWeightWindow(dt, windowSize) {
  var neg_one_day = 86400000;
  dt = (dt < neg_one_day) ? windowSize : dt;
  return (dt < windowSize) ? 1 : 0;
}


function convWeightExp(dt, windowSize) {
  var neg_one_day = 86400000;
  dt = (dt < neg_one_day) ? windowSize : dt;
  return (dt < windowSize) ? Math.exp(-dt / windowSize) : 0;
}

