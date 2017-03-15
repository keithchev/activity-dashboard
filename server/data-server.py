import sqlalchemy
import numpy as np
import pandas as pd

from flask import Flask, render_template, request

app = Flask(__name__)

@app.route('/')
def loadData():

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
                      
    pg_settings = pg_settings_loc
    if nfsFlag:
        pg_settings = pg_settings_nfs
                  
    contentType = {'Content-Type': 'application/json; charset=utf-8'}
    
    activityID = request.args.get('id')
    
    if not activityID.isdigit():
        return '[]', 200, contentType
    
    con = sqlalchemy.create_engine(
        '''postgres://%(user)s:%(pw)s@%(host)s:%(port)s/%(dbname)s''' % pg_settings)
    
    try:
        data = pd.read_sql_query(
        '''select * from activities_preview where id = %s''' % activityID, con)
    except:
        return '[]', 200, contentType
        
    if not len(data):
        return '[]', 200, contentType
    
    return data.to_json(orient='records'), 200, contentType



if __name__=='__main__':
    
    nfsFlag = 
    app.run(debug=True)
    
    

# # get a list of column names
# '''select column_name 
# from information_schema.columns 
# where table_name = \'merged_rivers\''''


