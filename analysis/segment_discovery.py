# -*- coding: utf-8 -*-
"""
Created on Tue Nov 29 18:39:24 2016

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


def loadTestMergedData():
    
    # load merge of all activities that traversed tunnel
    # (as a tractable example of merged data consisting of partially overlapping tracks)
    
    # berkeley ROI
    latROI = [37.84, 37.91]
    lonROI = [-122.275, -122.19]
    
    csvDir = 'E:\\Dropbox\\website\\dev2\\activity-dashboard\\data\\2016\\'
    mdfname = csvDir + 'metadata'
    md = pd.read_csv(mdfname)
    
    # here is the merged data for tunnel attempts
    segData = pd.read_csv('E:\Dropbox\website\dev2\\activity-dashboard\client\data\segments\\tunnel_list.csv')

    # activity ids corresponding to all tunnel attemps
    activityIDs = np.unique(segData.id)
    
    # all activity IDs
    activityIDs = np.unique(md.activity_id)
    
    data_cat = {'lat':[], 'lon':[], 'latvec':[], 'lonvec':[], 'spd':[], 'pwr':[], 'hrt':[]}
    
    for id in activityIDs:
        
        fname = md.ix[md.activity_id==id].filename.iloc[0]
        print(fname)
        
        data_csv = pd.read_csv(fname)
        
        data_this = vecsFromData(data_csv)
        
        mask = (data_this['lat'] > latROI[0]) * (data_this['lat'] < latROI[1]) * (data_this['lon'] > lonROI[0]) * (data_this['lon'] < lonROI[1])
        
        if not mask.sum():
            continue
        
        for k in data_cat.keys():
            data_this[k] = data_this[k][mask]
            data_cat[k] = np.concatenate((data_cat[k], data_this[k]))

    return data_cat
    
    
def vecsFromData(data):
    
    # transform the an activity data lat/lon points into a list of vecs
    
    data_out = {}
        
    dlat = data.lat.diff()
    dlon = data.lon.diff()
    
    mag = (dlat**2 + dlon**2)**.5

    # nx2 array of normal vectors
    nvecs = array([array(dlat / mag), array(dlon / mag)]).transpose()

    # delete vectors with any nan components (first row is nan from .diff())
    mk = (np.isnan(nvecs).sum(axis=1) == 0)
    nvecs = nvecs[mk,:]
    
    data_out['latvec'] = nvecs[:,0].squeeze()
    data_out['lonvec'] = nvecs[:,1].squeeze()
    
    keys = ['lat', 'lon', 'pwr', 'hrt', 'spd']
    
    for key in keys:
        data_out[key] = array(data[key])[mk].squeeze()
    
    return data_out
    
    
    
def makeHistogram(lat, lon, n=1):
    
    # lat and lon spacing equivalent to 6.55*n feet
    dlat = .000018 * n
    dlon = .0000227 * n
    
    MIN_COUNT = 3
    
    lonEdges = np.arange(lon.min(), lon.max() + dlon, dlon)
    latEdges = np.arange(lat.min(), lat.max() + dlat, dlat)
    
    latN = latEdges.shape[0]
    lonN = lonEdges.shape[0]
    
    # index of the interval/bin in edges that each entry in pos falls into
    latBinInds = np.digitize(lat, latEdges)
    lonBinInds = np.digitize(lon, lonEdges)
    
    # linearized indices of each lat-lon coord in pos
    flatInds = latBinInds * lonN + lonBinInds
    
    # bins in the histogram that are nonempty
    nonEmptyBinInds = np.unique(flatInds)

    # count for each index using pandas (much more efficient than np.bincount)
    # flatCount is indexed by nonEmptyBinInds
    # counts = pd.DataFrame(pd.value_counts(pd.Series(flatInds)))
    
    # this trick works by using searchsorted
    counts = np.bincount(nonEmptyBinInds.searchsorted(flatInds))

    # select only bins above the threshold number of counts
    mask = array(counts > MIN_COUNT).squeeze()
    
    nonEmptyBinInds = nonEmptyBinInds[mask]
    counts = counts[mask]
    
    print(nonEmptyBinInds.shape)
    
    indsWithinBins = []
    
    # get the lat/lon coords of each non-empty bin
    # this loop runs about 170 inds/sec
    for ind in nonEmptyBinInds:
        
        latInd, lonInd = ind2sub(ind, lonN)
    
        # rows of pos array whose lat/lon coords are in the current bin (whose linear index is ind)
        # is there a way to speed this up?
        indsWithinThisBin = np.intersect1d(np.argwhere(latBinInds==latInd), np.argwhere(lonBinInds==lonInd))
        
        indsWithinBins.append(indsWithinThisBin)
        
    return nonEmptyBinInds, indsWithinBins, [latN, lonN], latEdges, lonEdges

        # view arrows
        # quiver(posH[:,1], posH[:,0], vecH[:,1], vecH[:,0], angles='xy',scale_units='xy', scale=10000)



def binStats(histBinInds, indsWithinBins, histShape, latEdges, lonEdges, data):
    
    latList = []
    lonList = []
    pwrList = []
    hrtList = []
    vecLatList = []
    vecLonList = []
            
    nCols = histShape[1]      
      
    for histBinInd, indsWithinBin in zip(histBinInds, indsWithinBins):
        
        latInd, lonInd = ind2sub(histBinInd, nCols)

        latList = np.append(latList, latEdges[latInd])
        lonList = np.append(lonList, lonEdges[lonInd])
        
        vlat = data['latvec'][indsWithinBin]
        vlon = data['lonvec'][indsWithinBin]
        
        th = np.sign(vlat) * np.cos(vlon/vlat)
        
        
        # median vector of position in this bin
        vecLatList = np.append(vecLatList, np.median(data['latvec'][indsWithinBin]))
        vecLonList = np.append(vecLonList, np.median(data['lonvec'][indsWithinBin]))
        
        # mean power at this bin
        pwrList = np.append(pwrList, np.max(data['pwr'][indsWithinBin]))
        
        
    return array([latList, lonList]).transpose(), array([vecLatList, vecLonList]).transpose(), pwrList



def ind2sub(ind, numCols):
    # linear index to subindices for 2d array
    # (linearization by concatenating rows)
    
    row = np.floor(ind/numCols)
    col = ind - row * numCols
    
    return row, col
