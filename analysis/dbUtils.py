
import os, sys, glob, pdb, datetime
import numpy as np
import pandas as pd
import psycopg2


def copyCSVToPostgres(csvDir, nfsFlag=False, writeFullTable=False):

    # local
    pg_settings_loc = {'user': 'postgres', 
                      'pw': 'brc', 
                      'host': 'localhost',    
                      'port': 5432, 
                      'dbname': 'cycling'}
                
    # nfs
    pg_settings_nfs = {'user': '250742', 
                      'pw': 'pgc6646', 
                      'host': 'cyclingpostgres.local',    
                      'port': 5432, 
                      'dbname': 'cycling'}

    if nfsFlag:
        settings = pg_settings_nfs
    else:
        settings = pg_settings_loc

    try:
        conn = psycopg2.connect("dbname='%(dbname)s' user='%(user)s' host='%(host)s' password='%(pw)s'" % settings)
        print('connected!')
    except:
        print("unable to connect to database")
        return
        
    conn.autocommit = True
    cur = conn.cursor()
    
    # drop and recreate the preview table
    cur.execute("""DROP TABLE IF EXISTS activities_preview""")
    cur.execute("""CREATE TABLE activities_preview (lat decimal, lon decimal, id varchar);""")
    
    # copy the preview (downsampled) CSVs into the table
    csvFilenames = glob.glob(csvDir + os.sep + 'activities_preview' + os.sep + '*.csv')

    print(csvDir + os.sep + 'activities_preview' + os.sep + '*.csv')

    if not len(csvFilenames):
        print('No CSVs found!')
        return 

    for csvFilename in csvFilenames:
        print('Copying %s' % csvFilename)
        cur.execute(""" COPY activities_preview FROM %s CSV HEADER """, (csvFilename,))

    if not writeFullTable:
        return

    # delete the full (detailed) table in the cycling database if it exists
    cur.execute("""DROP TABLE IF EXISTS activities_detail""")

    # Notes re copying CSV data into postgres:    
    # We would like to cast integer fields (hrt, cad, pwr, tmp) as integers in the postgres table
    # However, because numpy doesn't let nan be an int type, the fitData structure has to be entirely float, 
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
            id varchar);
            """
            
    cur.execute(sql_create)

    # code duplicated from above for now
    csvFilenames = glob.glob(csvDir + os.sep + 'activities' + os.sep + '*.csv')
    if not len(csvFilenames):
        print('No CSVs found!')
        return 

    for csvFilename in csvFilenames:
        print('Copying %s' % csvFilename)
        cur.execute(""" COPY activities_detail FROM %s CSV HEADER """, (csvFilename,))


if __name__ == '__main__':

    csvDir = sys.argv[1]
    nfsFlag = bool(int(sys.argv[2])) # 0 for false

    copyCSVToPostgres(csvDir, nfsFlag=nfsFlag, writeFullTable=True)


# run locally:
# python dbUtils.py E:\\Dropbox\\_projects-gh\\activity-dashboard\\data\\ 0