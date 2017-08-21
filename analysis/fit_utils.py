
import os, glob, pdb
from datetime import datetime
import numpy as np
import scipy as sp
import pandas as pd
from fitparse import FitFile

def load_fit(filename):
    
    fit_file_structure = FitFile(filename)
    fit_file_structure.parse()
    return fit_file_structure


def data_from_fit(fit_file_structure):
    
    records = fit_file_structure.get_messages('record')
    
    fit_data = {}
    
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
                 
    garmin_fields = (
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
                 
    semicircles_to_deg = 180.0/(2**31)
    
    for field in fields: fit_data[field] = []
    
    # load all the field values (if not present in the record, list entry will be None)
    for record in records:
        for field, garmin_field in zip(fields, garmin_fields):
            fit_data[field].append(record.get_value(garmin_fields))
            
    # convert lat/lon to decimal degrees (from semicircles)
    fit_data['lat'] = [None if lat is None else lat * semicircles_to_deg for lat in fit_data['lat']]
    fit_data['lon'] = [None if lon is None else lon * semicircles_to_deg for lon in fit_data['lon']]
    
    # add an elapsed time field (in seconds)
    # DataFrame converts time to a time object
    # explicit way: data['time'] = [datetime.strptime(t, '%Y-%m-%d %H:%M:%S') for t in data['time']]
    
    fit_data = pd.DataFrame(fit_data)
    dt = fit_data['time'] - fit_data['time'][0]
    fit_data['sec'] = [t/np.timedelta64(1,'s') for t in dt]
    
#    fit_data['sec'] = fit_data['sec'].astype('int16')
#    fit_data['cad'] = fit_data['cad'].astype('int16')
#    fit_data['pwr'] = fit_data['pwr'].astype('int16')
#    fit_data['hrt'] = fit_data['hrt'].astype('int16')    
#    fit_data['tmp'] = fit_data['tmp'].astype('int16')    

    return fit_data
    