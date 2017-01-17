

function Calendar(div) {

  this.div = div;

  var tabs = d3.select("#calendar-tabs-container");

  var self = this;

  tabs.selectAll(".tab").data(["Months", "Weeks", "Days"])
      .enter().append("div")
      .attr("class", "tab")
      .attr("id", function (d) { return d; })
      .text(function (d) { return d; })
      .on("click", function () {
        tabs.selectAll(".tab").classed("tab-active", false);
        d3.select(this).classed("tab-active", true);
        self.load();
      });

  tabs.select("#Days").classed("tab-active", true);


  var calendarControls = d3.select("#calendar-controls-container");

  createCalendarControls(calendarControls);

  calendarControls.selectAll("select").on("change", this.onChange.bind(this) );

}

Calendar.prototype.onChange = function () {
  this.load();
}

Calendar.prototype.load = function() {

  this.calendarParameterColor  = d3.select("#calendar-select-parameter-color").property("value");
  this.calendarParameterHeight = d3.select("#calendar-select-parameter-height").property("value");

  this.calendarUnit = d3.select("#calendar-tabs-container").selectAll(".tab-active").text();

  var calWidth = parseInt(this.div.style("width"));

  var monthLabelOffset = 15;
  var monthSpacer = 2;

  var cellSize  = (calWidth - 11*monthSpacer)/7/12;
  var calHeight = cellSize * 6 + monthLabelOffset;   

  this.div.selectAll("svg").remove();

  svg = this.div.append("svg")
          .attr("width", calWidth )
          .attr("height", calHeight )
          .append("g")
          .attr("transform", "translate(" + 0 + "," + 3 + ")");

  // for now, make the calendar span 2016
  var days   = d3.timeDays(new Date(2016,0,1), new Date(2017,0,1));
  var weeks  = d3.timeWeeks(new Date(2016,0,1), new Date(2017,0,1));
  var months = d3.timeMonths(new Date(2016,0,1), new Date(2017,0,1));

  var ridesByWeek  = binActivities(weeks, this.calendarParameterColor);
  var ridesByMonth = binActivities(months, this.calendarParameterColor);


  // we want the weeks to start on Mondays
  weeks = weeks.map( function(week) { return new Date(week.getTime() + 86400000); });

  this_ = this;

  // pads for week or month view
  var padL = 40; var padR = 0; var padB = 15; var padT = 3;
  var rectHeight = (calHeight - padT - padB);


  if (this.calendarUnit==="Weeks") {
    var dateRangeInfo = ridesByWeek;
    var rectWidth  = Math.floor((calWidth - padL - padR)/52)-1;
    // this function positions the rectangles horizontally
    var rectXPos = function(d) { return padL + (rectWidth+1)*(d.start_date.getWeek()-2); }
  }

  if (this.calendarUnit==="Months") {
    var dateRangeInfo = ridesByMonth;
    var rectWidth = Math.floor((calWidth - padL - padR)/12)-1;
    var rectXPos = function(d) { return padL + (rectWidth+1)*(d.start_date.getMonth()); }
  }

  // draw the calendar if it's month or week view
  if (this.calendarUnit!=="Days") {

    // make a scale for the rect height using the within-week/bin sum of the height parameter
    var rectHeightScale = d3.scaleLinear()
                            .range([0, rectHeight ])
                            .domain([d3.min(dateRangeInfo, function(d) { return d.paramSums[this_.calendarParameterHeight]; }),
                                     d3.max(dateRangeInfo, function(d) { return d.paramSums[this_.calendarParameterHeight]; }) ]);

    var timeScale = d3.scaleTime()
                      .range([rectXPos(dateRangeInfo[0]), rectXPos(dateRangeInfo.last()) ])
                      .domain([dateRangeInfo[0].start_date, dateRangeInfo.last().start_date]);

    svg.append("g").attr("class", "axis").attr("id", "week-x-axis")
       .attr("transform", "translate(0," + rectHeight + monthLabelOffset + ")")
       .call(d3.axisBottom(timeScale).ticks(d3.timeMonth.every(1)).tickSize(0,0));

    // manually shift the x axis labels over by half a month so the label is centered in the month
    svg.select("#week-x-axis").selectAll("text").attr("transform", "translate(" + (timeScale(months[1]) - timeScale(months[0]))/2 + ",0)");

    svg.append("g").attr("class", "axis").attr("id", "week-y-axis")
       .attr("transform", "translate(" + (padL - 5) + "," + 0 + ")")
       .call(d3.axisLeft(rectHeightScale.range([rectHeight,0]))
               .ticks(2).tickSize(3,3)
               .tickValues([ rectHeightScale.domain()[0], rectHeightScale.domain()[1] ]));

    rectHeightScale.range([0, rectHeight]);

    rects = svg.selectAll(".calendar-week")
               .data(dateRangeInfo)
               .enter()
               .append("rect")
               .attr("class", "calendar-week")
               .attr("width", rectWidth)
               .attr("height", function (d) { 
                  return rectHeightScale(d.paramSums[this_.calendarParameterHeight]);
                })
               .attr("x", rectXPos) //
               .attr("y", function(d) { 
                  return rectHeight - rectHeightScale(d.paramSums[this_.calendarParameterHeight]) ; });

    svg.selectAll(".calendar-day").attr("class", "calendar-day-background");

  } 

  // else, draw days: this code is fundamentally different from month/week views
  if (this.calendarUnit==="Days") {

    var ridesByDay = binActivities(days, this.calendarParameterColor);

    svg.selectAll(".month-label")
      .data(months)
      .enter()
      .append("text")
      .attr("class", "month-label")
      .style("text-anchor", "middle")
      .text(function(d) { return d3.timeFormat("%B")(d); })
      .attr("transform", function(d) { 
          return "translate(" + (d.getMonth()*(2+cellSize*7) + cellSize*7/2) + "," + monthLabelOffset/2 + ")"; 
      });

    rects = svg.selectAll(".calendar-day")
               .data(ridesByDay)
               .enter()
               .append("rect")
               .attr("class", "calendar-day")
               .attr("width", cellSize)
               .attr("height", cellSize)
               .attr("x", function(d) { return calcCalendarCellPosition(d.start_date, cellSize, monthSpacer).x; })
               .attr("y", function(d) { return calcCalendarCellPosition(d.start_date, cellSize, monthSpacer).y + monthLabelOffset; });
  }

  var params = loadProps().rideParametersByKey;

  var rectTip = d3.tip().attr("class", "d3-tip d3-tip-calendar")
                  .offset([0,0])
                  .html(function (dateRangeInfo) {
                    var key1 = this_.calendarParameterColor; 
                    var key2 = this_.calendarParameterHeight;
                    var htmlString = 
                      "<span class='calendar-tip-title'>" + d3.timeFormat("%m/%d/%Y")(dateRangeInfo.start_date) + "<br></span>" + 
                      "<span class='calendar-tip-text'>" + 
                      params[key1].label + ": " + params[key1].format(dateRangeInfo.paramSums[key1]) + params[key1].units + "<br>" + 
                      params[key2].label + ": " + params[key2].format(dateRangeInfo.paramSums[key2]) + params[key2].units + "</span>";
                    return htmlString;
                  });

  svg.call(rectTip);

  rects.attr("fill", "#ddd");

  rects.filter( function(d) { return d.rideData.length; })
       .attr("fill", function(d) { return d.color; })
       .classed("calendar-rect-active", true)
       .on("mouseover", function (d) { 
          d3.select(this).attr("opacity", 0.5); 
          rectTip.show(d); })
       .on("mouseout", function (d) {
          d3.select(this).attr("opacity", 1); 
          rectTip.hide(d); })
       .on("dblclick", openActivity)
       .on("click", function(d) { changeSelectedDateRange(d); });
  
  this.rects = rects;
  this.update();

  return this;

}

Calendar.prototype.update = function () {

  // reset the color of all of the rectangles
  this.rects.filter( function(d) { return d.rideData.length; }).attr("fill", function(d) { return d.color; });

  // find the rect corresponding to the date range the currentActivity is in 
  var dateRangeInfo = this.rects.filter(function(d) { 
    return d.rideData.filter(function(rideDatum) { 
      return rideDatum.activity_id===DB.currentActivityInfo.activity_id; 
    }).length;
  }).attr("fill", "orange").data()[0];

  // if the new date range is not the current date range, reset it (this occurs if a distant activity was selected from history plot)
  if (dateRangeInfo.start_date.toString() !== DB.currentDateRangeInfo.start_date.toString()){

    changeSelectedDateRange(dateRangeInfo);

  }

  return this;

}

Calendar.prototype.updateFromActivity = function () {
}


function binActivities(dateList, parameterForColor) {

  var dt = dateList[1] - dateList[0];

  ridesByDate = dateList.map(function (date) { 
    
    var rideDataFiltered = DB.rideData.copy().filter( function (ride) { 
      var rideDate = DB.keyToDate(ride.start_date);
      return ( (rideDate.getTime() > date.getTime()) && (rideDate.getTime() <= (date.getTime() + dt)) );
    });

    var paramSums = {};

    var selectableParams = loadProps().rideParameters.filter( function (row) { return row.range.length!==0; });

    selectableParams.map( function (param) { 
      paramSums[param.key] = d3.sum(rideDataFiltered.map( function (rideDatum) { return rideDatum[param.key]; }));
    });

    return {start_date: date, rideData: rideDataFiltered, paramSums: paramSums}; 

  });


  var paramVals = ridesByDate.map(function (d) { return d.paramSums[parameterForColor]; })
                             .filter(function (d) { return d; });

  var cellColor = calendarColorScale(paramVals);

  ridesByDate = ridesByDate.map(function (d) { 
                  d.color = cellColor(d.paramSums[parameterForColor]).toString(); return d; });

  return ridesByDate;

}


function createCalendarTabs(div) {


}


function createCalendarControls(div) {

  div.selectAll("form").remove();

  var formdiv = div.append("form").attr("class", "form-inline")
                   .append("div").attr("class", "form-group");

  var classStr = "form-control form-control-history";

  formdiv.append("label").attr("class", "label-history").text("Color: ");
  formdiv.append("select")
        .attr("class", classStr)
        .attr("id", "calendar-select-parameter-color");

  formdiv.append("label").attr("class", "label-history").text("Height: ");
  formdiv.append("select")
        .attr("class", classStr)
        .attr("id", "calendar-select-parameter-height");

  var selectionCalParamColor  = d3.select("#calendar-select-parameter-color");
  var selectionCalParamHeight = d3.select("#calendar-select-parameter-height");

  var selectableParams = loadProps().rideParameters.filter( function(row) { return row.range.length!==0; });
  
  selectionCalParamColor.selectAll("option")
                        .data(selectableParams)
                        .enter().append("option")
                        .attr("value", function(d) { return d.key; })
                        .text(function(d) { return d.label; });
  
  selectionCalParamHeight.selectAll("option")
                        .data(selectableParams)
                        .enter().append("option")
                        .attr("value", function(d) { return d.key; })
                        .text(function(d) { return d.label; });

  selectionCalParamColor.property("value", "total_distance");
  selectionCalParamHeight.property("value", "elevation_gain");

}


function calcCalendarCellPosition(date, cellSize, monthSpacer) {

  var pos = {};

  var y = date.getFullYear();
  var m = date.getMonth();

  var monthStartDate = new Date(y, m, 1);

  // we want Monday to be column 0, but .getDay() sets 0 at Sunday
  var monthStart_DOW = monthStartDate.getDay() - 1 === -1 ? 6 : monthStartDate.getDay() - 1;

  var d_DOW = date.getDay()-1 === -1 ? 6 : date.getDay()-1;
  var offset = monthStart_DOW > 0 ? 7 - monthStart_DOW : 0;

   // this is the column - offset by prior months and spacing between months
  pos.x = cellSize*(d_DOW + m * 7) + monthSpacer*m;

  // this is the calendar row
  pos.y = cellSize*Math.floor( (date.getDate() - 1 + monthStart_DOW)/7 );

  return pos;
}

