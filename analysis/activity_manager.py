

import os, glob, pdb
import numpy as np
import scipy as sp
import pandas as pd
import rdp
import fit_utils
from datetime import datetime



class ActivityList(object):

	def __init__(self, root_dir=None):

		if root_dir is None:
			root_dir = 'E:\\Dropbox\\_projects-gh\\activity-dashboard\\data\\'

		self.activity_dir = root_dir + 'activities' + os.sep
		self.activity_preview_dir = root_dir + 'activities_preview' + os.sep

		self.CSVs = glob.glob(root_dir + 'activities\\*.csv')
		self.FITs = glob.glob(root_dir + 'activities\\*.fit')

		self.metadata_filename = root_dir + 'metadata.csv'
		self.root_dir = root_dir


	# def update(self):
	# 	''' update everything when new activities (FIT files) are added '''
	# 	self.batchFITtoCSV()
	#	self.generateactivity_ids()
	# 	self.updateMetadata()
	# 	self.makePreviewCSVs()


	def preview_path(self, csv_filename):
		return self.activity_preview_dir + csv_filename.split(os.sep)[-1].replace('.csv', '_preview.csv')


	def filename_to_id(self, filename):
		''' generate a unique ID from an activity filename '''
		
		# old method
		# return 'id' + filename.split('\\')[-1].split('.')[0].replace('-','')	

		return hash(filename)


	def write_activity_csv(self, data, filename):
		''' write an activity dataFrame to CSV 

		6-decimal float precision is required for lat/lon coordinates:
			latitude accuracy from 38 to 38.000001 is about 0.11 meters
			longitude accuracy from -122 to -122.000001 is 0.09 meters

		Note that None entries are turned into nan by pandas

		'''
		data.to_csv(filename, index=False, float_format='%0.6f')


	def batch_fit_to_csv(self):

		for fit_filename in self.FITs:
			if os.path.isfile(fit_filename.replace('fit', 'csv')):
				continue

			print('Converting %s to CSV' % fit_filename)

			fit_structure = fit_utils.load_fit(fit_filename)
			fit_data = fit_utils.data_from_fit(fit_structure)

			self.write_activity_csv(fit_data, fit_filename.replace('.fit', '.csv'))



	def update_metadata(self):
		''' add new csv files (written from new FIT files) to the existing metadata file '''
		
		activity_metadata = pd.read_csv(self.metadata_filename)

		for csv_filename in self.CSVs:
			activity_id = self.filename_to_id(csv_filename)
			if activity_id in list(activity_metadata.activity_id):
				continue
			
			print('Updating metadata for %s' % csv_filename)
				
			params, activity_id = activity_params_from_csv(csv_filename)
			params['filename']    = csv_filename
			params['activity_id'] = activity_id
			activity_metadata = activity_metadata.append(params, ignore_index=True)

		self.write_activity_csv(activity_metadata, self.metadata_filename)


	def create_metadata(self):
		''' 
		Generate metadata file and add calculated stats from each FIT-derived CSV file 

		*** overwrites existing metdata file ***

		'''

		activity_metadata = pd.DataFrame(columns=['filename', 'activity_id'])
		activity_metadata['filename'] = self.CSVs

		for ind, row in activity_metadata.iterrows():
			csv_filename = row['filename']
			print('Adding fields to metadata for %s' % csv_filename)
			
			params, activity_id = activity_params_from_csv(csv_filename)

			activity_metadata['activity_id'][ind] = activity_id

			for key in params.keys():
				if key not in activity_metadata.keys():
					activity_metadata[key] = float(0)
				activity_metadata[key][ind] = params[key]

		self.write_activity_csv(activity_metadata, self.metadata_filename)



	def generate_activity_ids(self, rewrite_ids=False):			
		''' generate unique activity id and add it to each activity's CSV file '''

		for csv_filename in self.CSVs:

			data = pd.read_csv(csv_filename)
			activity_id = self.filename_to_id(csv_filename)

			if 'id' not in data.keys() or rewrite_ids:
				data['id'] = activity_id
				self.write_activity_csv(data, csv_filename)
		
				print("creating id for %s; id: %s" % (csv_filename.split(os.sep)[-1], activity_id))
		


	def make_preview_csvs(self):
		''' downsample lat/lon coords using rdp algorithm to generate small preview tracks '''

		for csv_filename in self.CSVs:
			
			csv_preview_filename = self.preview_path(csv_filename)
			if os.path.isfile(csv_preview_filename):
				continue
			
			data   = pd.read_csv(csv_filename)
			coords = np.array(data[['lon', 'lat']])
			
			# subsample the lat/lon coords using rdp algorithm
			# epsilon=.0005 seems to be a good compromise for displaying a 300px square map
			# subsampling by ::3 speeds up the RDP algorithm and doesn't reduce any detail
			coords_sub = pd.DataFrame(rdp.rdp(coords[::3,:], epsilon=.0005))
		
			coords_sub['id'] = data['id'][0]

			# column names
			coords_sub.columns = ['lon', 'lat', 'id']
			
			self.write_activity_csv(coords_sub, csv_preview_filename)	   
			
			print('subsampling %s' % csv_filename)
		
		# rebuild the concatenated preview file
		self.cat_preview_csvs()
			

	def cat_preview_csvs(self):
		'''  '''

		merged_data = []
		for csv_filename in self.CSVs:
			data = pd.read_csv(self.preview_path(csv_filename))

			if not len(merged_data):
				merged_data = data
				continue
			merged_data = pd.concat([merged_data, data])
			
		self.write_activity_csv(merged_data, self.root_dir + 'activities_preview_merged.csv')
		return

# end class ActivityList



def activity_params_from_csv(activity):
    ''' calc various activities stats from a FIT-file-derived CSV file '''
    
    if type(activity) is str:
        data = pd.read_csv(activity)
    else:
        data = activity
        
    activity_id = data['id'][0]
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
    
    pwr_ma = moving_average(data, 'pwr')
    
    params['normalized_power'] = (pwr_ma[~np.isnan(pwr_ma)]**4).mean()**.25
    
    return params, activity_id
        
    
def moving_average(data, field='pwr'):
    ''' here we average the raw power data in a window
    this is the first step in calculating normalized power '''
    
    # window size used in Coggan et al (30 seconds)
    WINDOW_SIZE = 30 # **in seconds**
    
    dt = data.sec.diff()
    dt[0] = 0
    
    window = np.array(data[field])*float('nan')
    
    for ind in np.arange(0, data.shape[0], 30):
        
        # here we assume that dt is rarely less than one second to define an ROI that will span the window
        ROI_SIZE = WINDOW_SIZE + 10
        
        # relative elapsed time (from window start at ind)
        elapsed_time = np.cumsum(np.array(dt[ind:ind + ROI_SIZE]))
        
        # skip this window if it contains too few data point - i.e., window spans a long pause
        if ( (elapsed_time < WINDOW_SIZE).sum() < 10 ):
            continue
        
        # crop a region of interest
        data_crop   = data[field][ind:ind + ROI_SIZE]
        window_crop = window[ind:ind + ROI_SIZE]
            
        # assign the mean power in this window to every time point in pwr_window
        window_crop[elapsed_time <= WINDOW_SIZE] = data_crop[elapsed_time <= WINDOW_SIZE].mean()
        
        # insert this chunk of mean power back into the full pwr_window array
        window[ind:ind + ROI_SIZE] = window_crop
        
    return window




    
    