# -*- coding: utf-8 -*-
"""
Created on Thu Oct 20 10:37:59 2016

@author: Keith
"""

import os, glob, pdb, datetime
import numpy as np
import scipy as sp
import pandas as pd
import scipy.interpolate as interp
import rdp
from numpy import array as npa
from datetime import datetime
from lxml import etree
from geopy.distance import vincenty
import psycopg2

from fitparse import FitFile

def makePreviewTable(csvDir, pw):
    
    try:
        conn = psycopg2.connect("dbname='cycling' user='postgres' host='localhost' password='" + pw + "'")
    except:
        print "unable to connect to database"
        return
        
    conn.autocommit = True
    cur = conn.cursor()
    
    cur.execute("""DROP TABLE IF EXISTS activities_preview""")
 
    cur.execute("""CREATE TABLE activities_preview (lat decimal, lon decimal, id decimal);""")
    
    sql_copy = """ COPY activities_preview FROM %s CSV HEADER """   
    
    csvFilenames = glob.glob(csvDir + '\\preview\\' + '*_preview.csv')

    for ind, csvFilename in enumerate(csvFilenames):
        
        print(csvFilename)
        
        cur.execute(sql_copy, (csvFilename,))

    
def makeDetailTable(csvDir, pw):
    
    try:
        conn = psycopg2.connect("dbname='cycling' user='postgres' host='localhost' password='" + pw + "'")
    except:
        print("unable to connect to database")
        return
        
    conn.autocommit = True
    cur = conn.cursor()
    
    # delete the csv table in the cycling database if it exists
    cur.execute("""DROP TABLE IF EXISTS activities_detail""")

    
    # create the table (columns are manually specified: alt,cad,dst,hrt,lat,lon,pwr,spd,time,tmp,sec,id)

    # ISSUE:    
    # We would like to cast integer fields (hrt, cad, pwr, tmp) as integers in the postgres table, but:
    # This is not easy, because numpy doesn't let nan be an int type, so the fitData structure has to be entirely float, 
    # which pandas writes to CSV with the decimal precision required for lat/lon fields (%0.6f)
    # In turn, postgres COPY command won't copy decimal-format integers (i.e., 123.000000) into integer-type columns. 
    # For now, leave all fields as decimal, since nans are important to indicate missing data
    # (and there is real missing data in the FIT files - occasional rows have no power entries, for example)

    sql_create = """
            CREATE TABLE activities_detail (
            alt decimal,
            cad decimal,
            dst decimal, 
            hrt decimal,
            lat decimal,
            lon decimal,
            pwr decimal,
            spd decimal,
            time varchar,
            tmp decimal,
            sec decimal,
            id decimal);
            """
            
    cur.execute(sql_create)
    
    sql_copy = """ COPY activities_detail FROM %s CSV HEADER """   
    
    csvFilenames = glob.glob(csvDir + '*.csv')

    for ind, csvFilename in enumerate(csvFilenames):
        
        print(csvFilename)
        
        cur.execute(sql_copy, (csvFilename,))


def makeDownsampledTracks(csvDir):
    
    csvFilenames = glob.glob(csvDir + '*.csv')
    for csvFilename in csvFilenames:

        csvPreviewFilename = csvFilename.replace('\\2016\\', '\\2016\\preview\\').replace('.csv', '_preview.csv')
        
        if os.path.isfile(csvPreviewFilename):
            continue
        
        data = pd.read_csv(csvFilename)
        
        lonlat = np.array(data[['lon', 'lat']])
        
        # epsilon=.0005 seems to be a good compromise for displaying a 300px square map
        # subsampling by ::3 speeds up the RDP algorithm and doesn't reduce any detail
        lonlat_sub = pd.DataFrame(rdp.rdp(lonlat[::3,:], epsilon=.0005))
        
        lonlat_sub['id'] = data['id'][0]
        
        lonlat_sub.columns = ['lon', 'lat', 'id']
        
        writeActivityCSV(lonlat_sub,csvPreviewFilename)       
        
        print(csvFilename)
        

def mergeDownsampledTracks(csvDir, mergedFilename):
    
    mergedData = []
    
    csvFilenames = glob.glob(csvDir + '*.csv')
    for csvFilename in csvFilenames:
        
        data = pd.read_csv(csvFilename)
        if not len(mergedData):
            mergedData = data
            continue
        
        mergedData = pd.concat([mergedData, data])
        
    writeActivityCSV(mergedData, mergedFilename)
        
    
def interpolateActivityData(csvFilename):
    data = pd.read_csv(csvFilename)
    # need to write this
    
    
def calcActivityParamsFromCSV(arg):
    
    # calc various activities stats from a FIT-file-derived CSV file
    
    if type(arg) is str:
        data = pd.read_csv(arg)
    else:
        data = arg
        
    params = {}
    
    FEET_PER_METER = 3.2808
    FEET_PER_MILE  = 5280.
    
    # We assume any power greater than this threshold is spurious 
    ABS_MAX_PWR = 700

    # by setting spurious power to nan, it will be ignored by .sum() and .mean()
    data.pwr[data.pwr > ABS_MAX_PWR] = float('nan')
    
    data.time = [datetime.strptime(t, '%Y-%m-%d %H:%M:%S') for t in data.time]
    
    dt = data.time[data.shape[0]-1] - data.time[0]

    params['start_date'] = str(data.time[0].date())
    params['start_time'] = str(data.time[0].time())
    params['total_time'] = str(dt)[-8:]  # format in hh:mm:ss
    
    params['moving_time'] = calcMovingTime(data)
    
    params['total_distance'] = data.dst.max() * FEET_PER_METER / FEET_PER_MILE
    params['average_speed']  = data.spd[data.spd>0].mean() * 3600. * FEET_PER_METER / FEET_PER_MILE
    
    dalt = data.alt.diff()
    dalt[dalt < 0] = 0
    params['elevation_gain'] = dalt.sum() * FEET_PER_METER
    
    pwr = data.pwr.multiply(data.sec.diff())
    
    params['total_work']       = pwr.sum()*dt/1000. # in kJ
    params['average_power']    = pwr.mean()
    
    pwrMovingAv = calcPwrMovingAverage(data)
    
    params['normalized_power'] = (pwrMovingAv[~np.isnan(pwrMovingAv)]**4).mean()**.25
    
    return params
    
    
def addFieldsToMetadata(metadataFilename):
    
    # add calculated stats from each FIT-derived CSV file to the metadata file
    md = pd.read_csv(metadataFilename)
     
    for ind, row in md.iterrows():
        csvFilename = row['filename']
        params = calcActivityParamsFromCSV(csvFilename)
        
        for key in params.keys():
            md[key][ind] = params[key]

    print((100*ind)/md.shape[0])
        
    writeActivityCSV(md, metadataFilename)



def calcMovingTime(data):
    # need to write this
    return 0
    
    
def calcPwrMovingAverage(data):
    
    # here we average the raw power data in a window, which is the first step
    # in calculating normalized power
    
    # this is the window size Coggan et al use (30 seconds)
    WINDOW_SIZE = 30 # **in seconds**
    
    dt = data.sec.diff()
    dt[0] = 0
    
    pwr_window = np.array(data.pwr)*float('nan')
    
    for ind in np.arange(0, data.shape[0], 30):
        
        # here we assume that dt is rarely less than one second to define an ROI that will span the window
        ROI_SIZE = WINDOW_SIZE + 10
        
        # relative elapsed time (from window start at ind)
        elapsed_time = np.cumsum(np.array(dt[ind:ind + ROI_SIZE]))
        
        # skip this window if it contains too few data point - i.e., window spans a long pause
        if ( (elapsed_time < WINDOW_SIZE).sum() < 10 ):
            continue
        
        # crop a region of interest
        pwr_crop        = data.pwr[ind:ind + ROI_SIZE]
        pwr_window_crop = pwr_window[ind:ind + ROI_SIZE]
            
        # assign the mean power in this window to every time point in pwr_window
        pwr_window_crop[elapsed_time <= WINDOW_SIZE] = pwr_crop[elapsed_time <= WINDOW_SIZE].mean()
        
        # insert this chunk of mean power back into the full pwr_window array
        pwr_window[ind:ind + ROI_SIZE] = pwr_window_crop
        
    return pwr_window


def addFieldToCSV(csvDir, metadataFilename):
    # add a new (derived, obviously) field to each CSV activity file
    # written to add 30-second power moving average in order to rapidly calculate
    # the NP for a brush-selected region of an activity in the dashboard
    # 11/16/2016
    # need to write this - or perhaps implement in js
    return


def updateMetadata(csvDir, metadataFilename):
    
    # add new csv files (written from new FIT files) to the existing metadata file
    
    csvFilenames = glob.glob(csvDir + '*.csv')

    md = pd.read_csv(metadataFilename)
     
    for csvFilename in csvFilenames:
        print(csvFilename)

        if csvFilename in list(md.filename):
            continue
        
        print(csvFilename)

        activityID = FILENAME_TO_ID(csvFilename)

        data = pd.read_csv(csvFilename)
        data['id'] = activityID
        writeActivityCSV(data, csvFilename)
            
        params = calcActivityParamsFromCSV(data)
        
        params['filename'] = csvFilename
        params['activity_id'] = activityID
        
        md = md.append(params, ignore_index=True)
    
    writeActivityCSV(md, metadataFilename)

    

def createMetadata(csvDir, rewriteIDs=0):
        
    # (re-)create activity metadata, looking for unique activity IDs in each
    # CSV file and loading them into activityMetadata

    # NOTE: 
    # this will be very slow if we just want to add a new CSV to the existing
    # metadata file, because this function loads every CSV
        
    csvFilenames = glob.glob(csvDir + '*.csv')
    
    activityMetadata = pd.DataFrame()
    activityMetadata['filename'] = csvFilenames
    
    activityMetadata['activity_id'] = [0]*len(csvFilenames)
        
    for ind, row in activityMetadata.iterrows():
        
        csvFilename = row['filename']
        
        data = pd.read_csv(csvFilename)
                        
        if 'id' in data.keys() and not rewriteIDs:
            activityID = data['id'][0]        
        else:
            activityID = FILENAME_TO_ID(csvFilename)
            data['id'] = activityID
            writeActivityCSV(data, csvFilename)
            
        print(csvFilename)
        print(activityID)

        activityMetadata['activity_id'][ind] = activityID
        
    writeActivityCSV(activityMetadata, csvDir + 'metadata')

    
def FILENAME_TO_ID(filename):
    
    # this should not be changed - simple algorithm to generate a unique 
    # ID (essentially start date and time) from an activity filename

    activityID = filename.split('\\')[-1].split('.')[0].replace('-','')
    return activityID    
    
    
def batchFITtoCSV(fitDir):
    
    fitFilenames = glob.glob(fitDir + '*.fit')
    
    for fitFilename in fitFilenames:
        
        if os.path.isfile(fitFilename.replace('fit', 'csv')):
            continue
        
        print(fitFilename)
        
        fitFileStructure = loadFIT(fitFilename)
        fitData          = dataFromFIT(fitFileStructure)
        
        writeActivityCSV(fitData, fitFilename.replace('.fit', '.csv'))
        

def loadFIT(fitFilename):
    
    fitFileStructure = FitFile(fitFilename)
    fitFileStructure.parse()

    return fitFileStructure


def dataFromFIT(fitFileStructure):
    
    records = fitFileStructure.get_messages('record')
    
    fitData = {}
    
    fields    = ('time', 
                 'lat',
                 'lon',
                 'alt', 
                 'dst', 
                 'spd',
                 'pwr',
                 'hrt',
                 'cad',
                 'tmp')
                 
    garminFields = (
                 'timestamp',
                 'position_lat',  # semicircles
                 'position_long', # semicircles
                 'altitude',      # meters
                 'distance',      # meters
                 'speed',         # meters/sec
                 'power',         # watts
                 'heart_rate',    # bpm
                 'cadence',       # rpm
                 'temperature'    # deg C
                 )
                 
    semicirclesToDeg = 180.0/(2**31)
    
    for field in fields: fitData[field] = []
    
    # load all the field values (if not present in the record, list entry will be None)
    for record in records:
        for field, garminField in zip(fields, garminFields):
            fitData[field].append(record.get_value(garminField))
            
    # convert lat/lon to decimal degrees (from semicircles)
    fitData['lat'] = [None if lat is None else lat * semicirclesToDeg for lat in fitData['lat']]
    fitData['lon'] = [None if lon is None else lon * semicirclesToDeg for lon in fitData['lon']]
    
    # add an elapsed time field (in seconds)
    # DataFrame converts time to a time object
    # explicit way: data['time'] = [datetime.strptime(t, '%Y-%m-%d %H:%M:%S') for t in data['time']]
    
    fitData = pd.DataFrame(fitData)
    dt = fitData['time'] - fitData['time'][0]
    fitData['sec'] = [t/np.timedelta64(1,'s') for t in dt]
    
#    fitData['sec'] = fitData['sec'].astype('int16')
#    fitData['cad'] = fitData['cad'].astype('int16')
#    fitData['pwr'] = fitData['pwr'].astype('int16')
#    fitData['hrt'] = fitData['hrt'].astype('int16')    
#    fitData['tmp'] = fitData['tmp'].astype('int16')    

    return fitData
    
def writeActivityCSV(data, filename):
    
    # (None entries are turned into nan by pandas)
    data = pd.DataFrame(data)
    
    # 6-decimal float precision is required for lat/lon coordinates
    
    # latitude accuracy: from 38 to 38.000001 is about 0.11 meters
    # longitude accuracy: from -122 to -122.000001 is 0.09 meters
    
    data.to_csv(filename, index=False, float_format='%0.6f')

    
    
    
    
    
        