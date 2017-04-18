
import os, glob, pdb
from datetime import datetime
import numpy as np
import scipy as sp
import pandas as pd
from fitparse import FitFile

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
    