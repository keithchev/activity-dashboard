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


def tcx_to_csv():
    '''
    Parse TCX downloaded from Garmin's website and save to CSV
    (this is needed because only TCX, not GPX, has powermeter data)
    (August 2017: GPX from Strava's bulk download now includes power data - use gpx_to_csv below)
    '''
    
    tcx_timestamp_format = '%Y-%m-%dT%H:%M:%S.000Z'
    csv_timestamp_format = '%Y-%m-%d %H:%M:%S'

    TCXs = glob.glob('E:\\Dropbox\\website\\dev2\\cycling\\tcx\\*.tcx')
    for TCX in TCXs:
        data = {}
        data['timestamp'] = []
        data['dst']  = []
        data['lat']  = []
        data['lon']  = []
        data['alt']  = []
        data['hrt']  = []
        data['pwr']  = []
        data['cad']  = []
        data['sec']  = []
        
        tree = etree.parse(TCX)    
        root = tree.getroot()
        laps = root[0][0][1:-1]
        
        time_0 = datetime.strptime(laps[0][9][0][0].text, tcx_timestamp_format)
        for lap in laps:
            tracks = lap[9]

            for track in tracks:   
                time = ''
                lat = np.nan
                lon = np.nan
                alt = np.nan
                dst = np.nan
                hrt = np.nan
                cad = np.nan
                pwr = np.nan
                
                for entry in track:
                    if 'Time' in entry.tag:
                        time = datetime.strptime(entry.text, tcx_timestamp_format)
                    
                    # lat/lon degrees
                    if 'Position' in entry.tag:
                        lat = float(entry[0].text)
                        lon = float(entry[1].text) 
                    
                    # elevation in meters
                    if 'Altitude' in entry.tag:
                        alt = float(entry.text)
                
                    # distance in meters
                    if 'Distance' in entry.tag:                
                        dst = float(entry.text)
                        
                    # HR bpm
                    if 'Heart' in entry.tag:
                        hrt = int(entry[0].text)

                    # cadence rpm
                    if 'Cadence' in entry.tag:
                        cad = int(entry.text)
                    
                    # power watts
                    if 'Extensions' in entry.tag:
                        exts = entry[0]
                        for ext in exts:
                            if 'Watts' in ext.tag:
                                pwr = int(ext.text)
                            
                if timestamp:
                    data['timestamp'].append(datetime.strftime(time, csv_timestamp_format) )
                    data['sec'].append((time - time_0).seconds )
                else:
                    data['timestamp'].append('')
                    data['sec'].append(np.nan)
                    
                data['lat'].append(lat)
                data['lon'].append(lon)
                data['alt'].append(alt)
                data['dst'].append(dst)
                data['hrt'].append(hrt)
                data['pwr'].append(pwr)
                data['cad'].append(cad)
        
        data = pd.DataFrame(data)
        data.to_csv(TCX.replace('.tcx', '.csv'), index=False, float_format='%0.6f')
  



def gpx_to_csv(dirname_or_filename, activity_type, debug_flag=False):
    '''
    cConvert GPX downloaded from Strava (via bulk download) to CSV
    This is now (August 2017) useful, since Strava finally includes powermeter data in GPX

    # Arguments
        dir_name: directory containing GPX files (usually extracted activities.zip from Strava)
        activity_type: one of 'Ride', 'Run', 'Hike', 'Walk' (appended by Strava)

    '''

    # string to match tag fieldnames in the GPX
    # these are of the form {<xmlns schema url>}tag_name
    # for example: {http://www.garmin.com/xmlschemas/TrackPointExtension/v1}atemp
    tag = '}%s'

    if os.path.isdir(dirname_or_filename):
        GPXs = glob.glob(dirname + '*.gpx')

    elif os.path.isfile(dirname_or_filename):
        GPXs = [dirname_or_filename]

    gpx_timestamp_format = '%Y-%m-%dT%H:%M:%SZ'
    csv_timestamp_format = '%Y-%m-%d %H:%M:%S'

    for GPX in GPXs:
        if not activity_type in GPX:
            continue
        
        data = {}
        data['time'] = []
        data['lat']  = []
        data['lon']  = []
        data['alt']  = []
        data['hrt']  = []
        data['pwr']  = []
        data['cad']  = []
        
        tree = etree.parse(GPX)
        root = tree.getroot()
        trackpoints = root[1][1]

        for trackpoint in trackpoints:

            lat = float(trackpoint.get('lat'))
            lon = float(trackpoint.get('lon'))

            if debug_flag:
                print('%s, %s' % (lat, lon))
            
            time = None
            alt = None
            pwr = None
            tmp = None
            hrt = None
            cad = None

            # ele, time, extensions
            for field in trackpoint:

                if tag % 'ele' in field.tag:
                    alt = float(field.text)

                if tag % 'time' in field.tag:
                    time = datetime.strptime(field.text, gpx_timestamp_format)

                if tag % 'extensions' in field.tag:
                    extensions = field

            # power and TrackPointExtension
            for field in extensions:

                if tag % 'power' in field.tag:
                    pwr = float(field.text)

                if tag % 'TrackPointExtension' in field.tag:
                    trackpointextension = field

            # atemp, hr, cad
            for field in trackpointextension:

                if tag % 'atemp' in field.tag:
                    tmp = float(field.text)

                if tag % 'hr' in field.tag:
                    hrt = float(field.text)

                if tag % 'cad' in field.tag:
                    cad = float(field.text)

            data['time'].append(time)
            data['lat'].append(lat)
            data['lon'].append(lon)
            data['alt'].append(alt)
            data['hrt'].append(hrt)
            data['pwr'].append(pwr)
            data['cad'].append(cad)

        data = pd.DataFrame(data)

        data['timestamp'] = data.time.apply(lambda t: datetime.strftime(time, csv_timestamp_format))

        data['sec'] = (data.time - data.time[0]).apply(lambda dt: dt.seconds)

        total_dist = 0
        data['dst'] = 0
        lat_last, lon_last = data.loc[0].lat, data.loc[0].lon

        for ind, row in data.iterrows():
            total_dist += vincenty((row.lat, row.lon), (lat_last, lon_last)).meters
            data.set_value(ind, 'dst', total_dist)
            lat_last, lon_last = row.lat, row.lon

        return data

        data.to_csv(GPX.replace('.gpx', '.csv'), index=False, float_format='%0.6f')
    

    

    
def interpolate_rides():
    '''
    Interpolate CSV data (from tcx_to_csv or gpx_to_csv)
    Needed to eliminate variation in time interval between adjacent trackpoints
    '''

    sec_delta = 1 # seconds
    
    CSVs = glob.glob('E:\\Dropbox\\website\\dev2\\cycling\\tcx\\*.csv')
    for CSV in CSVs:
        
        data = pd.read_csv(CSV)
        data_interp = {}

        sec = data['sec'].tolist()  
        data_interp['sec'] = np.arange(sec[0], sec[-1], sec_delta)

        for key in data.keys():      
            if key.find('sec') > -1:
                continue
            if key.find('time') > -1:
                continue
        
            interpolator     = interp.interp1d( sec, data[key].tolist(), kind='linear' )
            data_interp[key] = interpolator(data_interp['sec'])

        data_interp = pd.DataFrame(data_interp)
        data_interp.to_csv(CSV.replace('.csv', '_interpolate.csv'), index=False, float_format='%0.6f')            
        
