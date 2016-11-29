

function dictOfListsToListOfDicts(dict) {

  var list = [];
  var keys = Object.keys(dict);

  for (i = 0; i < dict[keys[0]].length; i++) {
    list[i] = {};
  }

  for (ind in keys) {
    for (i = 0; i < dict[keys[ind]].length; i++) {
      list[i][keys[ind]] = dict[keys[ind]][i];
    }
  }
  return list;
}

function listOfDictsToDictOfLists(list) {

  var dict = {};
  var keys = Object.keys(list[0]);

  for (ind in keys) {
    key = keys[ind];
    dict[key] = [];
    for (i = 0; i < list.length; i++) {
      dict[key][i] = list[i][key];
    }
  }
  return dict;
}

function calcMeanOverDomain(rideData, field, domain) {

  rideData = listOfDictsToDictOfLists(rideData);

  var sec = rideData.sec;

  var range = [];

  for (n = 0; n < domain.length; n++) {
    dists = [];
    for (i = 0; i < sec.length; i++) {
      dists.push( Math.abs(sec[i] - domain[n]) );
    }
    range.push(dists.indexOf(Math.min.apply(Math, dists)));
  }

  var fieldData = rideData[field].slice(range[0], range[1]);

  return fieldData.reduce(function(x1, x2) { return x1 + x2; }) / fieldData.length;
}

function calcRawSpd(rideData) {

  rideData = listOfDictsToDictOfLists(rideData);

  var sec = rideData.sec;
  var dst = rideData.dst;
  var spd = [0];

  for (i = 1; i < sec.length; i++) {
    spd.push( (dst[i] - dst[i-1]) / ( (sec[i] - sec[i-1]) / 3600) ); 
  }

  rideData.spd = spd;
  rideData = dictOfListsToListOfDicts(rideData);

  return rideData;
}

function calcElevationGain(rideData) {

  rideData = listOfDictsToDictOfLists(rideData);

  var sec = rideData.sec;
  var alt = rideData.alt;
  var dst = rideData.dst;
  var pwr = rideData.pwr;

  var elg = [0], vam = [0], slp = [0], wrk = [0];
  
  var dSec = sec[1] - sec[0];
  var dAlt, dDst;

  for (i = 1; i < sec.length; i++) {

    dAlt = alt[i] - alt[i-1];
    dDst = dst[i] - dst[i-1];

    // vertical ascent velocity
    vam.push( 3600 * dAlt/3.28/dSec ); // in meters per hour

    // slope
    (dDst != 0) ? slp.push( 100*(alt[i] - alt[i-1]) / (dDst * 5280) ) : slp.push(0);
    
    // cumulative elevation gain
    dAlt = dAlt < 0 ? 0 : dAlt;
    elg.push(elg[i-1] + dAlt);

    // cumulative work
    wrk.push(wrk[i-1] + pwr[i]*dSec/1000.);

  }

  rideData.elg = elg;
  rideData.vam = vam;
  rideData.slp = slp;
  rideData.wrk = wrk;

  rideData = dictOfListsToListOfDicts(rideData);

  return rideData;
}

function smoothRide(rideData, windowSize) {
  // simple moving-average of ride data (might be slow)

  rideData = listOfDictsToDictOfLists(rideData);

  var datafield, datafieldMA, windowSum;
  var rideDataMA = {};
  var numPoints = rideData.sec.length;
  var keys = Object.keys(rideData);

  for (ind in keys) {
    var key = keys[ind];

    // don't smooth the time, obviously
    if (key==='sec') { 
      rideDataMA[key] = rideData[key].slice(0, numPoints - windowSize - 1);
      continue; 
    }

    datafield   = rideData[key];
    datafieldMA = [];
    windowSum   = 0;

    for (i = 0; i < (numPoints - windowSize - 1); i++) {

      datafieldMA.push(d3.mean(datafield.slice(i, i + windowSize)));

      //if (isNaN(windowSum)){ datafieldMA[i] = datafield[i]; }
    }
    rideDataMA[key] = datafieldMA;
  }
  return dictOfListsToListOfDicts(rideDataMA);
}

