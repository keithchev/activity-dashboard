

import os, glob, pdb
import numpy as np
import scipy as sp
import pandas as pd
import rdp
from fitFileUtils import *
from datetime import datetime



class ActivityList:

	def __init__(self, rootDir=None):

		if rootDir is None:
			rootDir = 'E:\\Dropbox\\_projects-gh\\activity-dashboard\\data\\'

		self.activityDir        = rootDir + 'activities' + os.sep
		self.activityPreviewDir = rootDir + 'activities_preview' + os.sep

		self.CSVs = glob.glob(rootDir + 'activities\\*.csv')
		self.FITs = glob.glob(rootDir + 'activities\\*.fit')

		self.metadataFilename = rootDir + 'metadata.csv'
		self.rootDir = rootDir


	# def update(self):
	# 	''' update everything when new activities (FIT files) are added '''
	# 	self.batchFITtoCSV()
	#	self.generateActivityIds()
	# 	self.updateMetadata()
	# 	self.makePreviewCSVs()


	def previewPath(self, csvFilename):
		return self.activityPreviewDir + csvFilename.split(os.sep)[-1].replace('.csv', '_preview.csv')

	def FILENAME_TO_ID(self, filename):
		''' simple algorithm to generate a unique ID from an activity filename '''
		return 'id' + filename.split('\\')[-1].split('.')[0].replace('-','')	


	def writeActivityCSV(self, data, filename):
		''' write an activity dataFrame to CSV '''

		# 6-decimal float precision is required for lat/lon coordinates
		# latitude accuracy: from 38 to 38.000001 is about 0.11 meters
		# longitude accuracy: from -122 to -122.000001 is 0.09 meters

		# note: None entries are turned into nan by pandas

		data.to_csv(filename, index=False, float_format='%0.6f')


	def batchFITtoCSV(self):

		for fitFilename in self.FITs:
			if os.path.isfile(fitFilename.replace('fit', 'csv')):
				continue

			print('Converting %s to CSV' % fitFilename)

			fitFileStructure = loadFIT(fitFilename)
			fitData = dataFromFIT(fitFileStructure)

			self.writeActivityCSV(fitData, fitFilename.replace('.fit', '.csv'))



	def updateMetadata(self):
		''' add new csv files (written from new FIT files) to the existing metadata file '''
		
		activityMetadata = pd.read_csv(self.metadataFilename)
		for csvFilename in self.CSVs:

			activityId = self.FILENAME_TO_ID(csvFilename)
			if activityId in list(activityMetadata.activity_id):
				continue
			
			print('Updating metadata for %s' % csvFilename)
				
			params, activityId = calcActivityParamsFromCSV(csvFilename)
			params['filename']    = csvFilename
			params['activity_id'] = activityId
			activityMetadata = activityMetadata.append(params, ignore_index=True)

		self.writeActivityCSV(activityMetadata, self.metadataFilename)


	def createMetadata(self):
		''' generate metadata file and add calculated stats from each FIT-derived CSV file 
		overwrites existing metdata file '''

		activityMetadata = pd.DataFrame(columns=['filename', 'activity_id'])
		activityMetadata['filename'] = self.CSVs

		for ind, row in activityMetadata.iterrows():
			csvFilename = row['filename']
			print('Adding fields to metadata for %s' % csvFilename)
			
			params, activityId = calcActivityParamsFromCSV(csvFilename)

			activityMetadata['activity_id'][ind] = activityId

			for key in params.keys():
				if key not in activityMetadata.keys():
					activityMetadata[key] = float(0)
				activityMetadata[key][ind] = params[key]

		self.writeActivityCSV(activityMetadata, self.metadataFilename)


	def generateActivityIds(self, rewriteIdsFlag=False):			
		''' generate unique activity id and add it to each activity's CSV fiel '''

		for csvFilename in self.CSVs:

			data = pd.read_csv(csvFilename)
			activityId = self.FILENAME_TO_ID(csvFilename)

			if 'id' not in data.keys() or rewriteIdsFlag:
				data['id'] = activityId
				self.writeActivityCSV(data, csvFilename)
		
				print("creating id for %s; id: %s" % (csvFilename.split(os.sep)[-1], activityId))
		

	def makePreviewCSVs(self):
		''' downsample lat/lon coords using rdp algorithm to generate small preview tracks '''

		for csvFilename in self.CSVs:
			
			csvPreviewFilename = self.previewPath(csvFilename)
			if os.path.isfile(csvPreviewFilename):
				continue
			
			data   = pd.read_csv(csvFilename)
			coords = np.array(data[['lon', 'lat']])
			
			# subsample the lat/lon coords using rdp algorithm
			# epsilon=.0005 seems to be a good compromise for displaying a 300px square map
			# subsampling by ::3 speeds up the RDP algorithm and doesn't reduce any detail
			coordsSubsample = pd.DataFrame(rdp.rdp(coords[::3,:], epsilon=.0005))
		
			coordsSubsample['id'] = data['id'][0]

			# column names
			coordsSubsample.columns = ['lon', 'lat', 'id']
			
			writeActivityCSV(coordsSubsample, csvPreviewFilename)	   
			
			print('subsampling %s' % csvFilename)
		
		# remake the concatenated preview CSV file
		self.catPreviewCSVs()
			

	def catPreviewCSVs(self):
		''' cat downsampled tracks into a single file '''

		mergedData = []
		for csvFilename in self.CSVs:
			data = pd.read_csv(self.previewPath(csvFilename))

			if not len(mergedData):
				mergedData = data
				continue
			mergedData = pd.concat([mergedData, data])
			
		writeActivityCSV(mergedData, self.rootDir + 'activities_preview_merged.csv')
		return

# end class ActivityList



def calcActivityParamsFromCSV(activity):
    ''' calc various activities stats from a FIT-file-derived CSV file '''
    
    if type(activity) is str:
        data = pd.read_csv(activity)
    else:
        data = activity
        
    activityId = data['id'][0]
    params = {}

    FEET_PER_MILE  = 5280.    
    FEET_PER_METER = 3.2808
    
    # We assume any power greater than this threshold is spurious 
    ABS_MAX_PWR = 700

    # by setting spurious power to nan, it will be ignored by .sum() and .mean()
    data.pwr[data.pwr > ABS_MAX_PWR] = float('nan')
        
    data.time = [datetime.strptime(t, '%Y-%m-%d %H:%M:%S') for t in data.time]
    
    # subtract 8 hours to get to PST (note: datetime object is somehow recast as pandas.tslib.Timestamp above)
    data.time = data.time - np.timedelta64(8, 'h')
    
    dt = data.time[data.shape[0]-1] - data.time[0]

    params['start_date'] = str(data.time[0].date())
    params['start_time'] = str(data.time[0].time())
    params['total_time'] = str(dt)[-8:]  # format in hh:mm:ss
    
    # params['moving_time'] = calcMovingTime(data)
    
    params['total_distance'] = data.dst.max() * FEET_PER_METER / FEET_PER_MILE
    params['average_speed']  = data.spd[data.spd>0].mean() * 3600. * FEET_PER_METER / FEET_PER_MILE
    
    dalt = data.alt.diff()
    dalt[dalt < 0] = 0
    params['elevation_gain'] = dalt.sum() * FEET_PER_METER
    
    pwr = data.pwr.multiply(data.sec.diff())
    
    params['total_work']       = pwr.sum()/1000. # in kJ
    params['average_power']    = pwr.mean()
    
    pwrMovingAv = calcPwrMovingAverage(data)
    
    params['normalized_power'] = (pwrMovingAv[~np.isnan(pwrMovingAv)]**4).mean()**.25
    
    return params, activityId
        
    
def calcPwrMovingAverage(data):
    ''' here we average the raw power data in a window
    this is the first step in calculating normalized power '''
    
    # window size used in Coggan et al (30 seconds)
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




    
    