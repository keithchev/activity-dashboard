



function makeMosaic() {
  
  // hard-coded target div
  var div = d3.select("#div-main-container");

  d3.selectAll("#div-main-container form").remove();
  d3.selectAll("#div-main-container div").remove();

  drawMosaicControls(div);

  var previewData = DB.previewData,
      rideData = DB.rideData.copy(), //.slice(100),
      rideDataSorted = rideData.slice(0); // this makes a copy

  var numColumns = 12,
      numTiles = rideData.length,
      width = parseInt(div.style("width")),
      tileSize = Math.floor(width/numColumns),
      numRows  = Math.ceil(rideDataSorted.length / numColumns),
      height   = tileSize * numRows;

  div.select("svg").remove();

  var svg = div.append("svg").attr("width", width).attr("height", height);
    
  // add an index field to rideData 
  rideData = rideData.map(function (d, i) { d.index = i; return d; });

  function mosaic() {};

  mosaic.draw_ = function() {  

    // deprecated - drawing in a div 

    sortRideData(rideDataSorted);
    // mapdiv      = d3.select(div).append("div").attr("class", "tile-map"),

    var tiles = div.selectAll(".tile").data(rideDataSorted);

    tiles.enter()
         .append("div")
         .attr("class", "col-sm-1 tile")
         .append("div")
         .attr("class", "tile-map")
         .each(function(rideDatum) { drawRideInTile(rideDatum, this); })
         .on("mouseover", function() { d3.select(this).select("svg").attr("opacity", .5); })
         .on("mouseout", function() { d3.select(this).select("svg").attr("opacity", 1); })
         .on("click", function(rideDataRow) { changeActivity(rideDataRow); });

    tiles.each(function(rideDatum) { drawRideInTile(rideDatum, this); });
    return mosaic;
  }

  mosaic.draw = function() {

    // if this is called, we're redrawing from scratch
    svg.selectAll("g").remove();

    var tiles = svg.selectAll("g").data(rideData);

    // draw the maps
    tiles.enter().append("g")
         .each(function(rideDatum) { drawRideInTile2(rideDatum, this, tileSize); })
         .on("mouseover", function() { d3.select(this).attr("opacity", .7); })
         .on("mouseout", function() { d3.select(this).attr("opacity", 1); })
         .on("click", function(rideDataRow) { changeActivity(rideDataRow); });

    return mosaic;
  }

  mosaic.sort = function () {

    sortRideData(rideDataSorted);
    indicesSorted  = rideDataSorted.map(function(d) { return d.index; });

    var tiles = svg.selectAll("g");

    tiles.transition().duration(500)
         .attr("transform", function(rideDatum) { 
            var rank   = indicesSorted.indexOf(rideDatum.index),
                rowNum = Math.floor(rank / numColumns),
                colNum = rank - rowNum * numColumns;
            return "translate(" + colNum * tileSize + "," + rowNum * tileSize + ")";// + "scale(" + (75/rideDatum.total_distance) + ")";
          });

    return mosaic;

  }


  mosaic.update = function () {

    var parameterForColor = d3.select("#mosaic-select-parameter-color").property("value"),
        cellColor = calendarColorScale(rideData.map(function(d) { return d[parameterForColor];}).filter(function(d) { return !!d; }));
    
    svg.selectAll("rect")
       .style("opacity", 0)
       .filter(function(rideDataRow) { return rideDataRow.activity_id===DB.currentActivityInfo.activity_id; })
       .style("opacity", .7);

    svg.selectAll("g")
       .select("path").transition().duration(500)
       .style("stroke", function(rideDatum) { return cellColor(rideDatum[parameterForColor]); })
       .style("fill", function(rideDatum) { return lightenColor(cellColor(rideDatum[parameterForColor]),.8); });

    return mosaic;

  }

 
  function drawRideInTile2(rideDatum, g, tileSize) {

    var g = d3.select(g);
    var width = tileSize;
    var pad = 3;

    // var parameterForColor = d3.select("#calendar-select-parameter-color").property("value"),
    //     cellColor = calendarColorScale(rideData.map(function(d) { return d[parameterForColor];}).filter(function(d) { return !!d; })),
    //     pathColor = cellColor(rideDatum[parameterForColor]);

    pathColor = "#666";

    var ridePoints  = previewData.filter(function (d) { return d.id===rideDatum.activity_id; })
                                 .map(function (d) { return [+d.lon, +d.lat]; });

    var cen = [ d3.mean(ridePoints, function(d) { return d[0]; }), 
                d3.mean(ridePoints, function(d) { return d[1]; }) ];

    var lonEast = d3.max(ridePoints, function(d) { return d[0]; }),
        lonWest = d3.min(ridePoints, function(d) { return d[0]; }),
        latNorth = d3.max(ridePoints, function(d) { return d[1]; }),
        latSouth = d3.min(ridePoints, function(d) { return d[1]; });

    var scaleType = d3.select("#mosaic-select-scale").property("value");

    // empirically, this scale is small enough to span the largest ride for 50x50 SVG
    var scaleFixed = 10000;

    // reassign ridePoints as json object
    ridePoints = {type: "LineString", coordinates: ridePoints,};

    // projection - fitExtent auto's the domain to the area spanned by coords in ridePoints
    var projection = d3.geoMercator();

    if (scaleType==="relative") projection.fitExtent([[pad,pad], [width-2*pad, width-2*pad]], ridePoints);
    if (scaleType==="absolute") projection.center(cen).scale(10000).translate([ width/2, width/2 ]);

    var path = d3.geoPath().projection(projection);

    var bounds = path.bounds(ridePoints);

    if (d3.max([ bounds[1][0] - bounds[0][0], bounds[1][1] - bounds[1][0] ]) < 1.5*tileSize) {

      g.append("rect")
       .attr("x", 0).attr("y", 0)
       .attr("width", tileSize).attr("height", tileSize)
       .attr("opacity", 0)
       .attr("class", "mosaic-rect");

      g.append("path")
       .datum(ridePoints)
       .attr("d", path)
       .attr("class", "tile-path")
       .style("stroke", pathColor)
       .style("fill", lightenColor(pathColor, .8));


    }
  }

  function drawRideInTile(rideDatum, mapdiv) {

    mapdiv = d3.select(mapdiv);

    var width = parseInt(mapdiv.style("width"));

    //mapdiv.remove("svg");

    var pathColor   = cellColor(rideDatum[parameterForColor]);

    var ridePoints  = previewData.filter(function (d) { return d.id===rideDatum.activity_id; })
                                 .map(function (d) { return [+d.lon, +d.lat]; });

    var cen = [d3.mean(ridePoints, function(d) { return d[0]; }), d3.mean(ridePoints, function(d) { return d[1]; })];

    var lonEast = d3.max(ridePoints, function(d) { return d[0]; }),
        lonWest = d3.min(ridePoints, function(d) { return d[0]; }),
        latNorth = d3.max(ridePoints, function(d) { return d[1]; }),
        latSouth = d3.min(ridePoints, function(d) { return d[1]; });
        
    var svg   = mapdiv.append("svg").attr("width", width).attr("height", width),

    // reassign ridePoints as json object
    ridePoints = {type: "LineString", coordinates: ridePoints,};

    // projection - fitExtent auto's the domain to the area spanned by coords in ridePoints
    var projection = d3.geoMercator();//.fitExtent([[0,0], [width, width]], ridePoints);

    var scale = 360*width / (lonEast - lonWest);

    // empirically, this scale is small enough to span the largest ride for 50x50 SVG
    var scaleFixed = 10000;

    projection.center(cen).scale(10000).translate([ width/2, width/2 ]);

    var path = d3.geoPath().projection(projection);

    svg.append("path")
        .datum(ridePoints)
        .attr("d", path)
        .attr("class", "tile-path")
        .style("stroke", pathColor)
        .style("fill", lightenColor(pathColor, .9));

  }

  // no longer used, but shows how to draw each tile from postgres db
  function drawTileFromPostgres(rideDatum, div) {
            
    var mapdiv = d3.select(div).append("div").attr("class", "tile-map");
    var pathColor = cellColor(rideDatum[parameterForColor]);

    d3.json('getActivityData.php?type=preview&id=' + rideDatum.activity_id, function(err, data) {
      if (!err) {
         // lat and lon columns are switched in the postgres db - so this gives [lon, lat]
         var ridePoints = data.map(function (d) { return [+d.lat, +d.lon]; });
      } 
    });
  }

  function sortRideData(rideDataSorted) {

    var param = d3.select("#mosaic-select-parameter-order").property("value");

    rideDataSorted.sort(function(x1,x2) { return d3.descending(+x1[param], +x2[param]); });

    return rideDataSorted;

  }


  function drawMosaicControls(div) {

  div.selectAll("form").remove();

  var formdiv = div.append("form").attr("class", "form-inline")
                   .append("div").attr("class", "form-group").attr("id", "div-mosaic-controls");

  var classStr = "form-control form-control-history";

  formdiv.append("label").attr("class", "label-history").text("Order by: ");
  formdiv.append("select").attr("class", classStr).attr("id", "mosaic-select-parameter-order");

  formdiv.append("label").attr("class", "label-history").text("Color by: ");
  formdiv.append("select").attr("class", classStr).attr("id", "mosaic-select-parameter-color");

  formdiv.append("label").attr("class", "label-history").text("Scale: ");
  formdiv.append("select").attr("class", classStr).attr("id", "mosaic-select-scale");

  var mosaicSelectOrder  = d3.select("#mosaic-select-parameter-order");
  var mosaicSelectColor  = d3.select("#mosaic-select-parameter-color");
  var mosaicSelectScale  = d3.select("#mosaic-select-scale");

  var selectableParams = loadProps().rideParameters.filter( function(row) { return row.range.length!=0; });
  
  mosaicSelectOrder.selectAll("option")
                        .data(selectableParams)
                        .enter().append("option")
                        .attr("value", function(d) { return d.key; })
                        .text(function(d) { return d.label; });
  
  mosaicSelectColor.selectAll("option")
                        .data(selectableParams)
                        .enter().append("option")
                        .attr("value", function(d) { return d.key; })
                        .text(function(d) { return d.label; });

  mosaicSelectScale.selectAll("option")
                   .data(['relative', 'absolute', 'blank'])
                   .enter().append("option")
                   .attr("value", function (d) { return d; })
                   .text(function(d) { return d.toUpperCase()[0] + d.slice(1); });

  mosaicSelectOrder.property("value", "total_distance");
  mosaicSelectColor.property("value", "elevation_gain");
  mosaicSelectScale.property("value", "relative");

  mosaicSelectOrder.on("change", onMosaicSort);
  mosaicSelectColor.on("change", onMosaicColorChange);
  mosaicSelectScale.on("change", onMosaicScaleChange);

  function onMosaicSort() { DB.mosaic.sort(); }
  function onMosaicColorChange() { DB.mosaic.update(); }
  function onMosaicScaleChange() { DB.mosaic.draw().sort(); }

  }


  return mosaic;
} // makeMosaic
