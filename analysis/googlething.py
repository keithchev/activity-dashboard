# -*- coding: utf-8 -*-
"""
Created on Mon Oct 24 21:39:00 2016

@author: Keith
"""

def answer(x,y):
    
    x_not_y = [x_ for x_ in x if x_ not in y]
    
    y_not_x = [y_ for y_ in y if y_ not in x]
    
    if x_not_y:
        return x_not_y
    else:
        return y_not_x
        

def test():
    
    vals = range(0,10)
    
    for val in vals:
        
        print(val)
    
        if val==5:
            return
    
        
def find_smallest_sublist(arr, keyval):
    
    arr = list(arr)
    
    if keyval in arr:
        return [arr.index(keyval), arr.index(keyval)]
        
    if sum(arr)==keyval:
        return [0,len(arr)-1]
        
    if len(arr) < 3:
        return [-1,-1]
        
    sublist_sizes = range(2, len(arr))
    
    for sublist_size in sublist_sizes:
        
        sublist_offsets = range(0, len(arr) - sublist_size + 1)
        
        for sublist_offset in sublist_offsets:
                       
           if sum(arr[sublist_offset : sublist_offset + sublist_size])==keyval:
               
               return [sublist_offset, sublist_offset + sublist_size-1]
               
    return [-1,-1]
    
               
def find_first_sublist(arr, keyval):
    
    arr = list(arr)
        
    if sum(arr)==keyval:
        return [0,len(arr)-1]
        
    # if len(arr)==1:
        # return [-1,-1]
    
    sublist_offsets = range(0, len(arr))

    for sublist_offset in sublist_offsets:

       sublist_sizes = range(1, len(arr) - sublist_offset + 1)
                       
       for sublist_size in sublist_sizes:        
        
           if sum(arr[sublist_offset : sublist_offset + sublist_size])==keyval:
               
               return [sublist_offset, sublist_offset + sublist_size-1]
               
    return [-1,-1]      
    
    
    
    