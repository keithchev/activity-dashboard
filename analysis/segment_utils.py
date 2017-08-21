# -*- coding: utf-8 -*-
"""
Created on Tue Nov 22 13:30:25 2016

@author: Keith
"""
# basic imports
import os, sys, glob, pdb

import numpy as np
import scipy as sp
import pandas as pd
import pymorph as pym
import matplotlib as mpl
import matplotlib.pyplot as plt

#from skimage import measure as imeasure
#from skimage import morphology as imorph

from numpy import array as array
from datetime import datetime
from geopy.distance import vincenty


def findSegmentInRide(segData, rideData):
    
    vecOffset = 10            # 10-ish secs (10 rows ahead)
    segLen = segData.shape[0] # rows in segData
    
    # use the midpoint of the segment
    segCenInd = int(round(segLen/2))
    segCen = segData.iloc[segCenInd]
    
    # direction forward in time from segment center
    segCenVec = array([segData.iloc[segCenInd + vecOffset].lat - segCen.lat, segData.iloc[segCenInd + vecOffset].lon - segCen.lon])    
    segCenVec = segCenVec / (segCenVec**2).sum()**.5
    
    # points in the rideData near the center of the segment
    cenInds, cenDists = find_points_near_point(segCen, rideData)
        
    segIndsList = []
    
    # if the ride traversed the segment more than once, we expect multiple entries in cenInds
    for ind in cenInds:
        
        vec = array([rideData.iloc[ind + vecOffset].lat - rideData.iloc[ind].lat, rideData.iloc[ind + vecOffset].lon - rideData.iloc[ind].lon])
        vec = vec / (vec*vec).sum()**.5        
        
        # projection of forward ride vector on segment ride vector
        # if ride was progressing in the same direction as the segment, 
        # we expect this to be nearly one (and not negative one)
        dp = (vec * segCenVec).sum()
        
        if dp > .9:
            
            inds_end, _ = find_points_near_point(segData.iloc[-1], rideData)
            inds_start, _ = find_points_near_point(segData.iloc[0], rideData)

            if len(inds_end) and len(inds_start):
                ind_end = inds_end[inds_end > ind][0]
                ind_start = inds_start[inds_start < ind][-1]
                
                segIndsList.append([ind_start, ind_end])
    
    # this is a list of start and stop indices 
    return segIndsList
    
    
def find_points_near_point(point, rideData):
    
    # finds all plausible points in rideData that match the given point
    # point is assumed to be a row from an activity/segment data (i.e., with .lat and .lon fields)
    
    # miles per degree lon/lat at 37N and -122W
    milesPerDegreeLon = 55.
    milesPerDegreeLat = 69.
    
    # min distance between point and a position in rideData for the match to be real
    # this is a reasonable offset for 1-sec data
    MIN_DISTANCE = 60 # feet
        
    # distances in miles from this point to each point in the ride
    dists = array(((milesPerDegreeLon*(rideData.lon - point.lon))**2 + (milesPerDegreeLat*(rideData.lat - point.lat))**2)**.5)

    # local minima in the list of dists
    inds = np.argwhere(pym.regmin((2**16 * dists / dists.max()).astype('uint16'))==True)

    # these are the 'real' inds (assuming rows are per second, dist shouldn't be greater than ~15 feet)
    inds = inds[:,1]
    inds = inds[5280*dists[inds] < MIN_DISTANCE]
    
    if len(inds)==0:
        return [], []
        
    # sometimes the minimum is two points wide (this may be a bug in pym.regmin)
    # this removes adjacent inds, if they exist, and appends the last element in inds 
    # (which is lost if indexing with result of np.diff)
    inds = np.concatenate( (inds[np.diff(inds)!=1], [inds[-1]]) )
    
    dists = dists[inds]
    
    return inds, dists
    
    
    
def find_best_match(seg, rde):
    # find possible matches between a list of lat/lon coords in seg 
    # and a longer list in rde

    segLen = seg.shape[0]
    dists = []
    
    seg_lat = array(seg.lat)
    seg_lon = array(seg.lon)
    
    for offset in np.arange(0, rde.shape[0] - segLen):
        rde_lat = array(rde.iloc[offset:offset + segLen].lat)
        rde_lon = array(rde.iloc[offset:offset + segLen].lon)
        dists.append( ((rde_lat - seg_lat)**2 + (rde_lon - seg_lon)**2).sum() / segLen )
        
    dists = array(dists);
    dists16 = (2**16*dists / dists.max()).astype('uint16')
    
    localMinInds = np.argwhere(pym.regmin(dists16)==True)
    localMinInds = localMinInds[:,1]
    
    return localMinInds, dists
        
        
def batchFindSegment(csvDir, segmentFile):
    
    segData = pd.read_csv(segmentFile)
    segLen  = segData.shape[0]
    segDst  = segData.dst.iloc[-1] - segData.dst.iloc[0]
    
    mergedSegData = []
    segList = []
    
    csvFilenames = glob.glob(csvDir + '*.csv')
    for csvFilename in csvFilenames:
            
        print(csvFilename)
        
        data = pd.read_csv(csvFilename)
        
        # if the datapoints are more than 1sec apart 
        if (data.sec.diff().median() > 1):
            continue
        
        # if the activity is very short, skip it
        if (data.dst.iloc[-1] < 2*segDst):
            continue
        
        # list of indices in data corresponding to start-end points of the segment
        indsList = findSegmentInRide(segData, data)
        
        if len(indsList):        
            segList.append( {'csv': csvFilename, 'indsList': indsList} )
            
            for ind in indsList:
            
                segID = str(data.iloc[0].id) + str(ind[0])
                
                segDataThis = data.iloc[ind[0]:ind[1]]
                
                segDataThis['segID'] = segID
    
                if not len(mergedSegData):
                    mergedSegData = segDataThis
                else:
                    mergedSegData = pd.concat([mergedSegData, segDataThis])
            
    return segList, mergedSegData
        
        
        
