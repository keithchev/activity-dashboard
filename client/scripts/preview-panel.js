  
function ActivityList(div) {

    this.params = loadProps().rideParametersByKey;
    this.div = div;

    // hard-coded column keys and names
    this.columnParams = ["start_date", "total_distance", "elevation_gain", "total_work"];
    this.columnNames  = ["Date", "Miles", "Vert", "Work"];

}

ActivityList.prototype.load = function(rideData) {

    var params = loadProps().rideParametersByKey;

    this.div.select("table").remove();
    this.div.append("table").attr("class", "table");

    var thead = this.div.select("table").append("thead");
    var tbody = this.div.select("table").append("tbody");

    thead.append("tr").selectAll("th").data(this.columnNames).enter().append("th").text(function(d) { return d; });

    var tr = tbody.selectAll("tr")
              .data(rideData).enter()
              .append("tr")
              .attr("class", "activity-list-row")
              .on("mouseover", function() { d3.select(this).attr("class", d3.select(this).attr("class") + " mouseoverd"); })
              .on("mouseout", function() { d3.select(this).attr("class", d3.select(this).attr("class").replace(" mouseoverd","")); })
              .on("click", function (d) { 
                d3.select("#activity-list-container").selectAll("tr").attr("class", "activity-list-row");
                d3.select(this).attr("class", "activity-list-row selected");
                changeActivity(d); });

    // column definitions by binding a list of keys for rideData entries bound to tr    
    var td = tr.selectAll("td").data(this.columnParams).enter().append("td");

    // write the column entries using the row's data
    td.append("span").attr("class", "activity-list-item").text(function (key) { 
      var this_tr = this.parentNode.parentNode;
      return params[key].format(d3.select(this_tr).data()[0][key]);  });

    return this;

  }

ActivityList.prototype.update = function() {

  var tr = this.div.select("tbody").selectAll("tr");
  tr.attr("class", "activity-list-row");

  // highlight selected activity
  // this should be the first activity in the list if a new date range was selected 
  // which is determined by update functions for date range click events
  tr.filter(function(d) { return d.activity_id===DB.currentActivityInfo.activity_id; })
    .attr("class", "activity-list-row selected");

  return this;

}


function displayActivityStats(currentActivityInfo) {

  var params = loadProps().rideParametersByKey;

  d3.select("#activity-info-container").select("table").remove();
  d3.select("#activity-datetime-container").selectAll("span").remove();

  var longDate = function (dateString) { return d3.timeFormat("%B %d, %Y")(d3.timeParse("%Y-%m-%d")(dateString)); }

  d3.select("#activity-datetime-container").append("span").attr("class", "activity-datetime")
    .text(longDate(DB.currentActivityInfo["start_date"]));

  // d3.select("#activity-datetime-container").append("span").attr("class", "activity-datetime")
  //   .text(params.start_time.format(DB.currentActivityInfo["start_time"]));

  var tbody = d3.select("#activity-info-container").append("table").attr("class", "table").append("tbody");

  // these are a list of parameter keys in order of appearance in the table
  var table_parameters = [
        ["start_time",       "total_time"],
        ["total_distance",   "average_speed"],
        ["elevation_gain",   "vert_per_mile"],
        ["total_work",       "total_calories"],
        ["average_power",    "normalized_power"],
        ["intensity_factor", "training_stress_score", ]];

  var tr = tbody.selectAll("tr").data(table_parameters).enter().append("tr");

  // this line creates a td for each column in table_parameters
  var td = tr.selectAll("td").data(function(d) { return d; }).enter().append("td");

  td.append("span").attr("class", "activity-parameter-value").text(function(d) { return params[d].format(currentActivityInfo[params[d].key]); });
  td.append("span").attr("class", "activity-parameter-unit").text(function(d) { return "" + params[d].units; });
  td.append("br");
  td.append("span").attr("class", "activity-parameter-name").text(function(d) { return params[d].label; });
}


function initMap() {

    var lineOptions = {
    color: "red",
    weight: 3,
    opacity: 0.7
  };

  var markerOptions = {
      fillColor: "steelblue",
      stroke: true,
      weight: 2,
      color: "#fff",
      opacity: 1,
      fillOpacity: 1,
     };

  DB.previewMap = new L.map("activity-map-container");

  L.tileLayer("http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom: 18}).addTo(DB.previewMap);

  DB.previewMap.attributionControl.setPrefix(""); // Don't show the 'Powered by Leaflet' text

  // var berkeley = new L.LatLng(37.86, -122.25); // geographical point (longitude and latitude)
  // DB.previewMap.setView(berkeley, 13);

  DB.previewPolyline = new L.Polyline([], lineOptions);
  DB.previewMap.addLayer(DB.previewPolyline);    

  DB.mouseMarker = new L.circleMarker([], markerOptions);
  DB.previewMap.addLayer(DB.mouseMarker);

  

}

function loadMap() {

  var ridePoints = [];

  d3.json("getActivityData.php?type=preview&id=" + DB.currentActivityInfo.activity_id, function(err, data) {
  debugger;
    if (!err) {

      for (i = 0; i < data.length; i++) {
        ridePoints.push( [+data[i].lon, +data[i].lat] );
      }

      DB.previewPolyline.setLatLngs(ridePoints);
      DB.mouseMarker.setLatLng([ +data[0].lat, +data[0].lon ]);
      DB.mouseMarker.setRadius(5);

      DB.previewMap.fitBounds(DB.previewPolyline.getBounds());


      
    }
  });

}