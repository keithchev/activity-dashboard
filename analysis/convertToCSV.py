# -*- coding: utf-8 -*-
"""
Created on Wed Oct 19 15:33:22 2016

@author: Keith
"""

# -*- coding: utf-8 -*-


import os, glob, pdb
import numpy as np
import scipy as sp
import pandas as pd
import scipy.interpolate as interp
from numpy import array as npa
from datetime import datetime
from lxml import etree
from geopy.distance import vincenty
from geopy.distance import great_circle

# this converts TCX downloaded from Garmin's website to CSV
# (only TCX, not GPX, has powermeter data)

def convertTCXtoCSV():

    TCXs = glob.glob('E:\\Dropbox\\website\\dev2\\cycling\\tcx\\*.tcx')
    
    TCXTimeStampFormat = '%Y-%m-%dT%H:%M:%S.000Z'
    CSVTimeStampFormat = '%Y-%m-%d %H:%M:%S'
    
    for TCX in TCXs:
        
        CSVData = {}
        
        CSVData['timestamp'] = []
        CSVData['dst']  = []
        CSVData['lat']  = []
        CSVData['lon']  = []
        CSVData['alt']  = []
        CSVData['hrt']  = []
        CSVData['pwr']  = []
        CSVData['cad']  = []
        CSVData['sec']  = []
        
        tree = etree.parse(TCX)    
        root = tree.getroot()

        laps = root[0][0][1:-1]
        
        tsp_0 = datetime.strptime(laps[0][9][0][0].text, TCXTimeStampFormat)
                
        for lap in laps:
            tracks = lap[9]
            
            for track in tracks:   
                
                tsp = ''
                lat = ''
                lon = ''
                alt = ''
                dst = ''
                hrt = ''
                cad = ''
                pwr = ''
                
                for entry in track:
                    
                    if 'Time' in entry.tag:
                        tsp = datetime.strptime(entry.text, TCXTimeStampFormat)
                    
                    if 'Position' in entry.tag:
                        lat = float(entry[0].text)    # lat degrees
                        lon = float(entry[1].text)     # lon degrees
                        
                    if 'Altitude' in entry.tag:
                        alt = float(entry.text)        # altitude meters
                
                    if 'Distance' in entry.tag:                
                        dst = float(entry.text)        # distance meters
                        
                    if 'Heart' in entry.tag:
                        hrt = int(entry[0].text)     # heart rate bpm

                    if 'Cadence' in entry.tag:
                        cad = int(entry.text)        # cadence rpm
                    
                    if 'Extensions' in entry.tag:
                        exts = entry[0]
                        for ext in exts:
                            if 'Watts' in ext.tag:
                                pwr = int(ext.text)  # power watts
                            
                if tsp is not '':
                    CSVData['timestamp'].append( datetime.strftime(tsp, CSVTimeStampFormat) )
                    CSVData['sec'].append( (tsp - tsp_0).seconds )
                else:
                    CSVData['timestamp'].append('')
                    CSVData['sec'].append('')
                    
                CSVData['lat'].append(lat)
                CSVData['lon'].append(lon)
                CSVData['alt'].append(alt)
                CSVData['dst'].append(dst)
                CSVData['hrt'].append(hrt)
                CSVData['pwr'].append(pwr)
                CSVData['cad'].append(cad)
        
        CSVData = pd.DataFrame(CSVData)
        CSVData.to_csv(TCX.replace('.tcx', '.csv'), index=False, float_format='%0.6f')
  
def interpolateRides():
    
    sec_delta = 1 # seconds
    
    CSVs = glob.glob('E:\\Dropbox\\website\\dev2\\cycling\\tcx\\*.csv')
    
    for CSV in CSVs:
        
        data = pd.read_csv(CSV)

        data_interp = {}

        sec = data['sec'].tolist()  
        
        sec_interp = np.arange(sec[0], sec[-1], sec_delta)
        
        data_interp['sec'] = sec_interp.astype(float)

        for key in data.keys():      
            
            if key.find('sec') > -1:
                continue
            if key.find('time') > -1:
                continue
        
            interpolator     = interp.interp1d( sec, data[key].tolist(), kind='linear' )
            data_interp[key] = interpolator(sec_interp)


        data_interp = pd.DataFrame(data_interp)
        
        data_interp.to_csv(CSV.replace('.csv', '_interpolate.csv'), index=False, float_format='%0.6f')            
        
def convertGPXtoCSV(dirName, activityType):
    
    GPXs = glob.glob(dirName + '*.gpx')
    
    stravaTimeStampFormat = '%Y-%m-%dT%H:%M:%SZ'
    CSVTimeStampFormat    = '%Y-%m-%d %H:%M:%S'

    for GPX in GPXs:
        
        if not activityType in GPX:
            continue
        
        CSVData = {}
        
        CSVData['Time']       = []
        CSVData['Distance']   = []
        CSVData['Duration']   = []
        CSVData['Latitude']   = []
        CSVData['Longitude']  = []
        CSVData['Elevation']  = []
        
        totalDist = 0
        
        tree = etree.parse(GPX)
        
        root = tree.getroot()
        points = root[1][1]
        
        timeStamp_start = datetime.strptime(points[0][1].text, stravaTimeStampFormat)
        
        lat_last = float(points[0].values()[0])
        lon_last = float(points[0].values()[1])
        
        for point in points:
            
            lat_this = float(point.values()[0])
            lon_this = float(point.values()[1])
            
            elevation = float(point[0].text)
            
            timeStamp = datetime.strptime(point[1].text, stravaTimeStampFormat)
            
            totalSeconds = (timeStamp - timeStamp_start).seconds
            
            distDelta = vincenty( (lat_this, lon_this), (lat_last, lon_last) ).meters
            
            totalDist = totalDist + distDelta
            
            lat_last = lat_this
            lon_last = lon_this
            
            # Date,Distance,Elapsed-seconds,Elevation,Latitude,Longitude
            # 2013-03-18 18:30:45,0.0255,10.0000,435.0000,37.8743,-122.2557

            CSVData['Time']      .append( datetime.strftime(timeStamp, CSVTimeStampFormat) )
            CSVData['Distance']  .append( totalDist )
            CSVData['Duration']  .append( totalSeconds )
            CSVData['Latitude']  .append( lat_this )
            CSVData['Longitude'] .append( lon_this )
            CSVData['Elevation'] .append( elevation )
            
        CSVData = pd.DataFrame(CSVData)
    
        CSVData.to_csv(GPX.replace('.gpx', '.csv'), index=False, float_format='%0.6f')
    
        

    

    
