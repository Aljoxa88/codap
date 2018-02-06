// ==========================================================================
//                            DG.CategoriesView
//
//  Author:   William Finzer
//
//  Copyright (c) 2018 by The Concord Consortium, Inc. All rights reserved.
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

sc_require('views/raphael_base');

/** @class  DG.CategoriesView - View of portion of legend that displays squares for each category of
 * a legend. The squares are selectable and can be dragged to change order.

 @extends DG.RaphaelBaseView
 */
DG.CategoriesView = DG.RaphaelBaseView.extend(
    (function () {
          var kMinWidth = 150; // of a cell. Used to determine how many columns

          var CategoryKey = SC.Object.extend({
            model: null,
            paper: null,

            /**
             * @property { String}
             */
            cellName: null,

            /**
             * Function set on initialization. Returns integer.
             */
            coordinatesToCellNum: null,

            // @property { Raphael Element }
            keyRect: null,
            // @property { Raphael Element }
            keyText: null,
            color: null,

            left: 0,
            top: 0,
            rectSize: 0,

            containingView: null,

            init: function () {
              var this_ = this,
                  tView = this.containingView,
                  tDragStartCoord, tCellBeingDragged, tOriginalCellIndex, tOffset,
                  selectCasesInCell = function (iEvent) {
                    SC.run(function () {
                      this_.get('model').selectCasesInCell(this_.cellName, iEvent.shiftKey);
                    }.bind(this));
                  },
                  beginDrag = function (iWindowX, iWindowY) {
                    tDragStartCoord = DG.ViewUtilities.windowToViewCoordinates({x: iWindowX, y: iWindowY}, tView);
                    tOriginalCellIndex = tCellBeingDragged = this_.coordinatesToCellNum(tDragStartCoord);
                    tOffset = { x: this_.left - tDragStartCoord.x,
                                y: this_.top - tDragStartCoord.y };
                  },
                  doDrag = function (iDeltaX, iDeltaY, iWindowX, iWindowY) {
                    var tModel = this_.get('model'),
                        tCurrentCoord = {
                          x: tDragStartCoord.x + iDeltaX,
                          y: tDragStartCoord.y + iDeltaY
                        },
                        tCategoryInCurrentCell = this_.coordinatesToCellNum(tCurrentCoord);
                    // Todo Touch is currently returning NaN for window coordinates. Fix this
                    if (isNaN(tCurrentCoord.x) || isNaN(tCurrentCoord.y) || isNaN(tCategoryInCurrentCell))
                      return;
                    SC.run(function () {
                      if (tCategoryInCurrentCell !== tCellBeingDragged) {
                        var tSign = Math.sign(tCategoryInCurrentCell - tCellBeingDragged),
                            tCellToSwap = tCellBeingDragged + tSign;
                        // Insist on pairwise swaps until we get one beyond tCategoryInCurrentCell
                        while (tCellToSwap !== tCategoryInCurrentCell + tSign) {
                          tModel.swapCategoriesByIndex(tCellBeingDragged, tCellToSwap);
                          tCellToSwap += tSign;
                          tCellBeingDragged += tSign;
                        }
                        tCellBeingDragged = tCategoryInCurrentCell;
                      }
                      tView.set('dragInfo', {
                        cellBeingDragged: tCellBeingDragged,
                        offset: tOffset,
                        position: tCurrentCoord,
                      });
                      tView.displayDidChange();
                      tView.propertyDidChange('categoriesDragged');
                    });
                  },
                  endDrag = function (iEvent) {
                    SC.run(function () {
                      tView.set('dragInfo', null);
                      tView.displayDidChange();
                      tView.propertyDidChange('categoriesDragged');
                      tView.updateLayerIfNeeded();
                    });
                  };

              this.keyRect = this.paper.rect(0, 0, this.rectSize, this.rectSize)
                  .attr({fill: this.color})
                  .addClass(DG.PlotUtilities.kLegendKey)
                  .click(selectCasesInCell)
                  .drag(doDrag, beginDrag, endDrag);
              this.keyText = this.paper.text(0, 0, this.cellName)
                  .attr({'text-anchor': 'start'})
                  .addClass(DG.PlotUtilities.kLegendKeyName)
                  .click(selectCasesInCell)
                  .drag(doDrag, beginDrag, endDrag);
            },

            destroy: function () {
              this.keyRect.remove();
              this.keyText.remove();

              sc_super();
            },

            draw: function () {
              // body of draw
              this.keyRect.attr({
                x: this.left,
                y: this.top,
                width: this.rectSize,
                height: this.rectSize,
                fill: this.color
              });
              this.keyText.attr({
                x: this.left + this.rectSize + 5,
                y: this.top + this.rectSize - 5,
                text: this.cellName
              });
            }
          });

          /** @scope DG.CategoriesView.prototype */
          return {
            displayProperties: ['model.attributeDescription.attribute',
              'model.attributeDescription.attributeStats.categoricalStats.numberOfCells'],

            /**
             Set by owning LegendView on creation
             @property { DG.LegendModel }
             */
            model: null,

            /**
             * Cache of
             * @property { [CategoryKey] }
             */
            categoryKeys: null,

            /**
             * @property {{}}
             */
            dragInfo: null,

            init: function () {
              sc_super();
              this.categoryKeys = {};
            },

            desiredExtent: function (iRowHeight) {
              var tWidth = this.getPath('parentView.frame.width') || kMinWidth,
                  tNumColumns = Math.max(2, Math.floor(tWidth / kMinWidth)),
                  tNumCells = this.model ? this.getPath('model.numberOfCells') : 0,
                  tNumRows = Math.ceil(tNumCells / tNumColumns);
              return tNumRows * iRowHeight;
            },

            doDraw: function drawCategoriesKey() {
              var tAttrDesc = this.getPath('model.attributeDescription'),
                  tWidth = this._paper.width,
                  tHeight = this._paper.height,
                  tNumColumns = Math.max(2, Math.floor(tWidth / kMinWidth)),
                  tColWidth = tWidth / tNumColumns,
                  tNumCells = this.getPath('model.numberOfCells'),
                  tNumRows = Math.ceil(tNumCells / tNumColumns),
                  tRowHeight = tHeight / tNumRows,
                  // tSize = Math.max(0, tRowHeight),
                  tCellIndex,
                  tCellNames = this.getPath('model.cellNames'),
                  tCategoryKeys = this.get('categoryKeys'),
                  coordinatesToCellNum = function (iCoords) {
                    var tCol = Math.floor(iCoords.x / tColWidth),
                        tRow = Math.floor(iCoords.y / this.rowHeight),
                        tCellNum = tCol + tRow * tNumColumns;
/*
                    console.log('x: %@, y: %@, row: %@, col: %@, cell: %@, colWidth: %@'.loc(
                        iCoords.x, iCoords.y, tRow, tCol, tCellNum, tColWidth));
*/
                    return tCellNum < 0 || tCellNum >= tNumCells ? null : tCellNum;
                  }.bind( this);
              this.set('rowHeight', tRowHeight);
              // Mark them all as unused so we can get rid of ones no longer present
              DG.ObjectMap.forEach(tCategoryKeys, function (iName, iKey) {
                iKey.set('inUse',false);
              });

              for (tCellIndex = 0; tCellIndex < tNumCells; tCellIndex++) {
                var tName = tCellNames[tCellIndex],
                    tColor = DG.ColorUtilities.calcCaseColor(tName, tAttrDesc).colorString,
                    tRow = Math.floor(tCellIndex / tNumColumns),
                    tCol = tCellIndex % tNumColumns,
                    tCategoryKey = tCategoryKeys[tName];
                if (!tCategoryKey) {
                  tCategoryKeys[tName] = tCategoryKey = CategoryKey.create({
                    model: this.get('model'),
                    paper: this.get('paper'),
                    containingView: this,
                    coordinatesToCellNum: coordinatesToCellNum
                  });
                }
                if( this.dragInfo && this.dragInfo.cellBeingDragged === tCellIndex) {
                  tCategoryKey.set('left', this.dragInfo.position.x + this.dragInfo.offset.x );
                  tCategoryKey.set('top', this.dragInfo.position.y + this.dragInfo.offset.y );
                } else {
                  tCategoryKey.set('left', tCol * tWidth / tNumColumns);
                  tCategoryKey.set('top', tRow * tRowHeight);
                }
                tCategoryKey.set('rectSize', tRowHeight - 5);
                tCategoryKey.set('color', tColor);
                tCategoryKey.set('cellName', tName);
                tCategoryKey.set('inUse', true);
                tCategoryKey.draw();
              }

              // Those that are unused get destroyed
              DG.ObjectMap.forEach(tCategoryKeys, function (iName, iKey) {
                if (!iKey.inUse) {
                  iKey.destroy();
                  delete tCategoryKeys[iName];
                }
              });

            },

            selectCasesBetween: function (iLower, iUpper, iExtend) {
              var tAttrID = this.getPath('model.attributeDescription.attribute.id'),
                  tCases = this.getPath('model.dataConfiguration.cases'),
                  tAttrName = this.getPath('model.attributeDescription.attribute.name'),
                  tChange = {
                    operation: 'selectCases',
                    collection: this.getPath('dataConfiguration.collectionClient'),
                    cases: [],
                    select: true,
                    extend: iExtend
                  };
              if (SC.none(tAttrID) || SC.none(tCases))
                return;
              tCases.forEach(function (iCase) {
                var tValue = iCase.getNumValue(tAttrID);
                if (tValue >= iLower && tValue <= iUpper)
                  tChange.cases.push(iCase);
              });
              this.getPath('model.dataConfiguration.dataContext').applyChange(tChange);
              DG.logUser("caseSelected with values of: %@ between %@ and %@", tAttrName, iLower, iUpper);

            }

          };
        }
        ()
    ))
;
