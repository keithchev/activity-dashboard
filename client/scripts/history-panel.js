function HistoryPlot(div) {

  this.div = div;
  this.div.selectAll("div").remove();
  this.div.selectAll("svg").remove();

  var controlsContainer = div.append("div").attr("id", "history-controls-container");

  createHistoryPlotControls(controlsContainer);

  div.append("div").attr("id", "history-plot-container");

  this.rideData = DB.rideData.copy();
  this.params   = loadProps().rideParametersByKey;
  this.rideDict = listOfDictsToDictOfLists(this.rideData);

  var onChange = this.draw.bind(this);

  var self = this;

  d3.select("#history-select-parameter-y").on("change", onChange ).property("value", "total_distance");
  d3.select("#history-select-parameter-color").on("change", onChange ).property("value", "normalized_power");

  d3.select("#history-select-conv-window").on("change", onChange ).property("value", "30");

  d3.select("#history-select-conv-type").selectAll(".tab-small").on("click", onClick );
  d3.select("#history-select-mean-or-sum").selectAll(".tab-small").on("click", onClick );

  d3.select("#history-select-conv-type").select(".tab-small").classed("tab-small-active", true);
  d3.select("#history-select-mean-or-sum").select(".tab-small").classed("tab-small-active", true);


  function onClick() {
    d3.select(this.parentNode).selectAll(".tab-small").classed("tab-small-active", false);
    d3.select(this).classed("tab-small-active", true);
    self.draw();
  }

}

// this draws the history plot from scratch (called on init or window resize)
HistoryPlot.prototype.load = function () {

  var divSize = {"w": parseInt(d3.select("#history-plot-container").style("width")),
                 "h": parseInt(d3.select("#history-plot-container").style("width"))/2};
  
  var divPad   = 0; 
  var plotPad  = {"h": 20, "w": 50};
  var plotSize = {"h": divSize.h - divPad, "w": divSize.w - divPad};

  d3.select("#history-plot-container").selectAll("svg").remove();

  var svg = d3.select("#history-plot-container")
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
     .attr("id", "conv-path");
 
  this.plotSize = plotSize;
  this.plotPad = plotPad;
  this.svg = svg;

  this.draw();
  this.update();

}

HistoryPlot.prototype.draw = function () { 

  var params = loadProps().rideParametersByKey,

     convWindow      = d3.select("#history-select-conv-window").property("value"),
     plotParameterY  = d3.select("#history-select-parameter-y").property("value"),
     plotParameterColor = d3.select("#history-select-parameter-color").property("value");

     convType   = d3.select("#history-select-conv-type").select(".tab-small-active").text(),
     meanOrSum  = d3.select("#history-select-mean-or-sum").select(".tab-small-active").text();

  var plotSize = this.plotSize,
      plotPad  = this.plotPad,
      svg = this.svg, 
      dotRadius = 3;

  var xScale, xAxis, xGrid, yAxisLeft, yAxisRight, yScaleParam, yScaleConv, lineConv;

  var startDate = d3.timeDay.offset(d3.min(this.rideDict.timestamp), 0),
      endDate   = d3.timeDay.offset(d3.max(this.rideDict.timestamp), 0);

  var colorParamMax = d3.max(this.rideData, function (d) { return +d[plotParameterColor]; });
  var colorParamMin = d3.min(this.rideData, function (d) { return +d[plotParameterColor] > 0 ? +d[plotParameterColor] : Infinity; });

  this.rideData.forEach(function (d) { 
                  d.color = d3.interpolateBlues(.3+(d[plotParameterColor] - colorParamMin)/(colorParamMax - colorParamMin)).toString(); });

   function interpolateNoMiddle(t,w) {
    t = (t > (.5-w) && t < .5) ? .5-w : t;
    t = (t < (.5+w) && t > .5) ? .5+w : t;
    return t;
   }

  var convData = [];
  if (convType != "None") {
    convData = calcConvolution(
                convType, 
                convWindow*24*3600000, 
                plotParameterY
                );
  }

  xScale = d3.scaleTime().range([plotPad.w, plotSize.w - plotPad.w]).domain([startDate, endDate]);
  xAxis  = d3.axisBottom(xScale).ticks(d3.timeMonth.every(1)).tickFormat("").tickSize(0,0,0);

  xGrid = d3.axisBottom(xScale)
            .ticks(d3.timeMonth.every(1))
            .tickFormat(d3.timeFormat("%b %y"))
            .tickSize(-(plotSize.h - 2*plotPad.h),0,0);

  yScaleParam = d3.scaleLinear()
                  .range([ plotSize.h - plotPad.h, plotPad.h ])
                  .domain(params[plotParameterY].range);

  yScaleConv = d3.scaleLinear()
                 .range([ plotSize.h - plotPad.h, plotPad.h ])
                 .domain(params[plotParameterY].range); 

  lineConv = d3.line()
               .x(function(d) {return xScale(d.days); })
               .y(function(d) {return yScaleConv(d.conv/d.count); })
               .curve(d3.curveLinear);

  this.svg.select("#history-y-axis-right").attr("visibility", "hidden");

  if (meanOrSum==="Sum") {
    convData = convData.map(function(d){ d.count = 1; return d; });
    yScaleConv.domain([ yScaleParam.domain()[0], d3.max(convData, function(d) { return d.conv/d.count; }) ]);
    this.svg.select("#history-y-axis-right").attr("visibility", "visible");
  } 

  // force the filled path back to the x-axis
  convData.push({days: xScale.domain()[1], conv: yScaleConv.domain()[0], count: 1});

  var tickStep = params[plotParameterY].step;

  yAxisLeft = d3.axisLeft(yScaleParam)
                .tickValues(d3.range(tickStep, yScaleParam.domain()[1], tickStep))
                .tickSize((-plotSize.w + plotPad.w)*0, 0, 0);

  yAxisRight = d3.axisRight(yScaleConv).tickSize(0,0,0).ticks(4);

  if (plotParameterY==="total_time_sec") {
    yAxisLeft.tickFormat( function (sec) { return Math.floor(sec/3600) + "h"; });
    yAxisRight.tickFormat( function (sec) { return Math.floor(sec/3600) + "h"; });
  }

  svg.select("#history-x-axis").call(xGrid);
  svg.select("#history-y-axis-left").transition().duration(500).call(yAxisLeft);
  svg.select("#history-y-axis-right").transition().duration(500).call(yAxisRight);

  svg.select("#conv-path")
     .transition().duration(500)
     .attr("d", function () { return lineConv(convData); });

  svg.selectAll(".history-dot")
    .data(this.rideData)
    .enter().append("circle")
    .attr("class", "history-dot")
    .attr("r", dotRadius)
    .attr("cx", function (d) { return xScale(d.timestamp); })
    .attr("cy", function (d) { return yScaleParam(d[plotParameterY]); })
    .attr("fill", function (d) { return d.color; })
    .on("mouseover", function() { d3.select(this).attr("r", dotRadius*2); })
    .on("mouseout", function() {  d3.select(this).attr("r", dotRadius); })
    .on("click", function (d) {  changeActivity(d); });

  svg.selectAll(".history-dot").transition().duration(500)
  .attr("cy", function (d) { return yScaleParam(d[plotParameterY]); })
  .attr("fill", function (d) { return d.color; });

  // remove the first y axis tick 
  d3.selectAll("#history-y-axis-left g").each( function() { 
    if (d3.select(this).select("text").text()==="0") { 
      d3.select(this).attr("visibility", "hidden"); 
    } 
  });

  // remove the first y axis tick 
  d3.selectAll("#history-y-axis-right g").each( function() { 
    if (d3.select(this).select("text").text()==="0") { 
      d3.select(this).attr("visibility", "hidden"); 
    }
  });

}

HistoryPlot.prototype.update = function() {

    this.svg.selectAll(".history-dot")
        .classed("history-dot-selected", false)
        .filter(function (d) { return d.activity_id === DB.currentActivityInfo.activity_id; })
        .classed("history-dot-selected", true);
    
}

function createHistoryPlotControls(container) {

  container.select("form").remove();

  var form = container.append("form").attr("class", "form-inline")
                      .append("div").attr("class", "form-group");
  
  // ---- parameter ----
  var selectableParams = loadProps().rideParameters.filter( function(row) { return row.range.length!=0; });

  form.append("label").attr("class", "label-history").text("Y: ");
  form.append("select")
      .attrs({class: "form-control form-control-history", id: "history-select-parameter-y"})
      .selectAll("option").data(selectableParams)
      .enter().append("option")
      .attr("value", function (d) { return d.key; })
      .text(function (d) { return d.label; });

  form.append("label").attr("class", "label-history").text("Color: ");
  form.append("select")
      .attrs({class: "form-control form-control-history", id: "history-select-parameter-color"})
      .selectAll("option").data(selectableParams)
      .enter().append("option")
      .attr("value", function (d) { return d.key; })
      .text(function (d) { return d.label; });

  // ---- convolution type ---- 
  form.append("div").attrs({class: "history-tab-container", id: "history-select-conv-type"})
      .selectAll("tab-small").data(["Window", "Exponential"])
      .enter().append("div")
      .attrs({class: "tab-small"})
      .text(function (d) { return d; });

  // ---- window size ----
  form.append("label").attr("class", "label-history").text("Window size: ");
  form.append("input")
      .attr("class", "form-control form-control-history")
      .attr("id", "history-select-conv-window");

  // ---- mean or sum ----
  form.append("div").attrs({class: "history-tab-container", id: "history-select-mean-or-sum"})
      .selectAll("tab-small").data(["Mean", "Sum"])
      .enter().append("div")
      .attrs({class: "tab-small"})
      .text(function (d) { return d; });


}



function calcConvolution(convType, windowSize, param) {

  var rideData = DB.rideData.copy();

  if (convType==="Window") { calcConvWeight = convWeightWindow; }
  if (convType==="Exponential") {calcConvWeight = convWeightExp; }

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


