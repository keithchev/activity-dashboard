# -*- coding: utf-8 -*-
"""
Created on Thu Dec 08 22:05:51 2016

@author: Keith
"""

import math

def answer_(pegs):
    
    
    N = len(pegs)
    
    nIsOdd = math.fmod(N,2)
    
    pegSum = 0  
        
    for i in range(N-1):
        
        # N even, i even: +1; N even, i odd: -1
        # N odd, i even: -1; N odd, i odd: +1        
        
        sign = nIsOdd == math.fmod(i,2)
        
        if not sign: sign = -1
        
        pegSum += sign*(pegs[i+1] - pegs[i])
        
       
    sign = 1
    if (math.fmod(N,2)): sign = -1
        
    # this is the radius of the last cog
    radius_n = sign*pegSum
    
    # solution exists (ignoring physical constraints)
    if (radius_n > 0):
        
        # and this the radius of the first
        radius_1 = 2*radius_n

        # if the first cog can fit        
        if ( (radius_1 < (pegs[2]-pegs[1])) and (radius_n < (pegs[-1]-pegs[-2])) ):      
        
            return [radius_1, 1]


    return [-1,-1]
        
        
        
        
    def answer(pegs):
        
        N = len(pegs)
        
        cog_1 = range(1, peg[2]-peg[1]-1)
        
        
        
        
        
        
        
        