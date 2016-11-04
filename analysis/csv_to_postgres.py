# -*- coding: utf-8 -*-
"""
Created on Mon Oct 24 21:19:32 2016

@author: Keith
"""

import sys, os, glob
import psycopg2

csvDir = sys.argv[1]
pw = sys.argv[2]

print('csv dir is ' + csvDir)

try:
    conn = psycopg2.connect("dbname='cycling' user='250742' host='cyclingpostgres.local' password='" + pw + "'")
    # conn = psycopg2.connect("dbname='cycling' user='231830' host='10.255.0.166' password=''")
    print('connected!')
except:
    print("unable to connect to database")
    sys.exit()
    
conn.autocommit = True
cur = conn.cursor()

# delete the csv table in the cycling database if it exists
# cur.execute("""drop table activities;""")

# create the table (columns are manually specified: alt,cad,dst,hrt,lat,lon,pwr,spd,time,tmp,sec,id)

sql_create = """
        CREATE TABLE activities (
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

print('created table activities')

sql_copy = """ COPY activities FROM %s CSV HEADER """   

csvFilenames = glob.glob(csvDir + '*.csv')

for ind, csvFilename in enumerate(csvFilenames):
    
    print('Copying ' + csvFilename)
    
    cur.execute(sql_copy, (csvFilename,))
    
print('finished copying CSVs')

sys.exit()

