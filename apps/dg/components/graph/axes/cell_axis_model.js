// ==========================================================================
//                          DG.CellAxisModel
//
//  Author:   William Finzer
//
//  Copyright (c) 2014 by The Concord Consortium, Inc. All rights reserved.
//
//  Licensed under the Apache License, Version 2.0 (the "License");
//  you may not use this file except in compliance with the License.
//  You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
//  Unless required by applicable law or agreed to in writing, software
//  distributed under the License is distributed on an "AS IS" BASIS,
//  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  See the License for the specific language governing permissions and
//  limitations under the License.
// ==========================================================================

sc_require('components/graph/axes/axis_model');

/** @class  DG.CellAxisModel - The model for a graph axis.

  @extends SC.Object
*/
DG.CellAxisModel = DG.AxisModel.extend(
/** @scope DG.CellAxisModel.prototype */ 
{
  /**
    Determined by asking attributeStats
    @property{Number} >= 1
  */
  numberOfCells: function() {
    return Math.max( 1, this.getPath('attributeDescription.attributeStats.numberOfCells'));
  }.property(),

  numberOfCellsDidChange: function() {
    this.notifyPropertyChange('numberOfCells');
  }.observes('*attributeDescription.attributeStats.numberOfCells'),

  /**
    Iterates through cells to find name with maximum length
    @property{Number}
  */
  maxCellNameLength: function() {
    var tMaxLength = 0;
    this.forEachCellDo( function( iIndex, iName) {
      tMaxLength = Math.max( tMaxLength, iName.length);
    });
    return tMaxLength;
  }.property()/*.cacheable()*/,
  maxCellNameLengthDidChange: function() {
    this.notifyPropertyChange('maxCellNameLength');
  }.observes('*attributeDescription.attributeStats.cellMap'),

  /**
    @property {Boolean}
  */
  isNumeric: false,

  /**
    @return{Number} corresponding to given name
  */
  cellNameToCellNumber: function( iCellName) {
    var stats = this.getPath('attributeDescription.attributeStats');
    return stats ? stats.cellNameToCellNumber( iCellName) : 0;
  },
  
  /**
    Go through each of the cells passing the given function, whose signature
      is ( iCellIndex, iName, iNumUses, iNumSelected )
  */
  forEachCellDo: function( iCellFunc) {
    var tCellMap = this.getPath('attributeDescription.attributeStats.cellMap'),
        tAttribute = this.getPath('attributeDescription.attribute'),
        tCellIndex = 0;
    if( DG.ObjectMap.length(tCellMap) === 0)
      iCellFunc( 0, '', 0, 0);  // There is always at least one cell
    else
      tAttribute.forEachCategory( function( iName, iColor, iIndex) {
        var tValues = tCellMap[ iName],
            tNumUses = tValues? tValues.cases.length: 0,
            tNumSelected = 0;
        if( tNumUses > 0) {
          iCellFunc(tCellIndex++, iName, tNumUses, tNumSelected);
        }
      });
  }
  
});

