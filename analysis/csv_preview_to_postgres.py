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

cur.execute("""DROP TABLE IF EXISTS activities_preview""")

cur.execute("""CREATE TABLE activities_preview (lat decimal, lon decimal, id decimal);""")

sql_copy = """ COPY activities_preview FROM %s CSV HEADER """   

csvFilenames = glob.glob(csvDir + '*_preview.csv')

for ind, csvFilename in enumerate(csvFilenames):
    
    print('Copying ' + csvFilename)
    
    cur.execute(sql_copy, (csvFilename,))

    
print('finished copying CSVs')

sys.exit()

