// ==========================================================================
//                        DG.ScatterPlotModel
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

sc_require('components/graph/plots/plot_model');
sc_require('components/graph/plots/numeric_plot_model_mixin');

/** @class  DG.ScatterPlotModel

 @extends DG.PlotModel
 */
DG.ScatterPlotModel = DG.PlotModel.extend(DG.NumericPlotModelMixin,
    /** @scope DG.ScatterPlotModel.prototype */
    {
      /**
       @property { DG.MovableLineModel }
       */
      movableLine: null,

      /**
       @property { Boolean, read only }
       */
      isMovableLineVisible: function () {
        return !SC.none(this.movableLine) && this.movableLine.get('isVisible');
      }.property(),
      isMovableLineVisibleDidChange: function() {
        this.notifyPropertyChange('isMovableLineVisible');
      }.observes('*movableLine.isVisible'),

      /**
       @property { DG.MultipleLSRLsModel }
       */
      multipleLSRLs: null,

      /**
       @property { Boolean, read only }
       */
      isLSRLVisible: function () {
        return !SC.none(this.multipleLSRLs) && this.multipleLSRLs.get('isVisible');
      }.property(),
      isLSRLVisibleDidChange: function() {
        this.notifyPropertyChange('isLSRLVisible');
      }.observes('*multipleLSRLs.isVisible'),

      /**
       @property { Boolean, read only }
       */
      isInterceptLocked: function () {
        return !SC.none(this.movableLine) && this.movableLine.get('isInterceptLocked') ||
            !SC.none(this.multipleLSRLs) && this.multipleLSRLs.get('isInterceptLocked');
      }.property(),
      isInterceptLockedDidChange: function() {
        this.notifyPropertyChange('isInterceptLocked');
      }.observes('*movableLine.isInterceptLocked', '*multipleLSRLs.isInterceptLocked'),

      /**
       @property { Boolean }
       */
      areSquaresVisible: false,

      /**
       * Used for notification
       * @property{}
       */
      squares: null,

      init: function() {
        sc_super();
        this.addObserver('movableLine.slope',this.lineDidChange);
        this.addObserver('movableLine.intercept',this.lineDidChange);
      },

      destroy: function() {
        this.removeObserver('movableLine.slope',this.lineDidChange);
        this.removeObserver('movableLine.intercept',this.lineDidChange);
        sc_super();
      },

      /**
       * Used for notification
       */
      lineDidChange: function () {
        SC.run(function() {
          this.notifyPropertyChange('squares');
        }.bind(this));
      },

      /**
       * Utility function to create a movable line when needed
       */
      createMovableLine: function () {
        if (SC.none(this.movableLine)) {
          this.beginPropertyChanges();
          this.set('movableLine', DG.MovableLineModel.create( {
            plotModel: this,
            showSumSquares: this.get('areSquaresVisible')
          }));
          this.movableLine.recomputeSlopeAndIntercept(this.get('xAxis'), this.get('yAxis'));
          this.endPropertyChanges();
        }
      },

      squaresVisibilityChanged: function() {
        var tMovableLine = this.get('movableLine'),
            tMultipleLSRLs = this.get('multipleLSRLs'),
            tSquaresVisible = this.get('areSquaresVisible');
        if( tMovableLine)
            tMovableLine.set('showSumSquares', tSquaresVisible);
        if( tMultipleLSRLs)
            tMultipleLSRLs.set('showSumSquares', tSquaresVisible);
      }.observes('areSquaresVisible'),

      /**
       If we need to make a movable line, do so. In any event toggle its visibility.
       */
      toggleMovableLine: function () {
        var this_ = this;

        function toggle() {
          if (SC.none(this_.movableLine)) {
            this_.createMovableLine(); // Default is to be visible
          }
          else {
            this_.movableLine.recomputeSlopeAndInterceptIfNeeded(this_.get('xAxis'), this_.get('yAxis'));
            this_.movableLine.set('isVisible', !this_.movableLine.get('isVisible'));
          }
        }

        var willShow = !this.movableLine || !this.movableLine.get('isVisible');
        DG.UndoHistory.execute(DG.Command.create({
          name: "graph.toggleMovableLine",
          undoString: (willShow ? 'DG.Undo.graph.showMovableLine' : 'DG.Undo.graph.hideMovableLine'),
          redoString: (willShow ? 'DG.Redo.graph.showMovableLine' : 'DG.Redo.graph.hideMovableLine'),
          log: "toggleMovableLine: %@".fmt(willShow ? "show" : "hide"),
          execute: function () {
            toggle();
          },
          undo: function () {
            toggle();
          }
        }));
      },

      /**
       * Utility function to create the multipleLSRLs object when needed
       */
      createLSRLLines: function () {
        if (SC.none(this.multipleLSRLs)) {
          this.set('multipleLSRLs', DG.MultipleLSRLsModel.create( {
            plotModel: this,
            showSumSquares: this.get('areSquaresVisible'),
            isInterceptLocked: this.get('isInterceptLocked')
          }));
          this.setPath('multipleLSRLs.isVisible', true);
        }
      },

      /**
       If we need to make a movable line, do so. In any event toggle its visibility.
       */
      toggleLSRLLine: function () {
        var this_ = this;

        function toggle() {
          if (SC.none(this_.multipleLSRLs)) {
            this_.createLSRLLines();
          }
          else {
            this_.multipleLSRLs.set('isVisible', !this_.multipleLSRLs.get('isVisible'));
          }
        }

        var willShow = !this.multipleLSRLs || !this.multipleLSRLs.get('isVisible');
        DG.UndoHistory.execute(DG.Command.create({
          name: "graph.toggleLSRLLine",
          undoString: (willShow ? 'DG.Undo.graph.showLSRL' : 'DG.Undo.graph.hideLSRL'),
          redoString: (willShow ? 'DG.Redo.graph.showLSRL' : 'DG.Redo.graph.hideLSRL'),
          log: "toggleLSRL: %@".fmt(willShow ? "show" : "hide"),
          execute: function () {
            toggle();
          },
          undo: function () {
            toggle();
          }
        }));
      },

      /**
       If we need to make a movable line, do so. In any event toggle whether its intercept is locked.
       */
      toggleInterceptLocked: function () {
        var this_ = this;

        function toggle() {
          if( !SC.none(this_.movableLine)) {
            this_.movableLine.toggleInterceptLocked();
            this_.movableLine.recomputeSlopeAndInterceptIfNeeded(this_.get('xAxis'), this_.get('yAxis'));
          }
          if( !SC.none(this_.multipleLSRLs)) {
            this_.multipleLSRLs.toggleInterceptLocked();
          }
        }

        var willLock = (this.movableLine && !this.movableLine.get('isInterceptLocked')) ||
                      (this.multipleLSRLs && !this.multipleLSRLs.get('isInterceptLocked'));
        DG.UndoHistory.execute(DG.Command.create({
          name: "graph.toggleLockIntercept",
          undoString: (willLock ? 'DG.Undo.graph.lockIntercept' : 'DG.Undo.graph.unlockIntercept'),
          redoString: (willLock ? 'DG.Redo.graph.lockIntercept' : 'DG.Redo.graph.unlockIntercept'),
          log: "lockIntercept: %@".fmt(willLock),
          execute: function () {
            this._undoData = {
              movableLine: this_.movableLine ? this_.movableLine.createStorage() : null,
              lsrlStorage: this_.multipleLSRLs ? this_.multipleLSRLs.createStorage() : null
            };
            toggle();
          },
          undo: function () {
            this_.movableLine.restoreStorage(this._undoData.movableLine);
            this_.multipleLSRLs.restoreStorage(this._undoData.lsrlStorage);
          }
        }));
      },

      /**
       If we need to make a plotted function, do so. In any event toggle its visibility.
       */
      togglePlotFunction: function () {
        var this_ = this;

        function toggle() {
          this_.toggleAdornmentVisibility('plottedFunction', 'togglePlotFunction');
        }

        var willShow = !this.isAdornmentVisible('plottedFunction');
        DG.UndoHistory.execute(DG.Command.create({
          name: "graph.togglePlotFunction",
          undoString: (willShow ? 'DG.Undo.graph.showPlotFunction' : 'DG.Undo.graph.hidePlotFunction'),
          redoString: (willShow ? 'DG.Redo.graph.showPlotFunction' : 'DG.Redo.graph.hidePlotFunction'),
          log: "togglePlotFunction: %@".fmt(willShow ? "show" : "hide"),
          execute: function () {
            toggle();
          },
          undo: function () {
            toggle();
          }
        }));
      },

      /**
       If we need to make a connecting line, do so. In any event toggle its visibility.
       */
      toggleConnectingLine: function () {
        var this_ = this;

        function toggle() {
          var tAdornModel = this_.toggleAdornmentVisibility('connectingLine', 'toggleConnectingLine');
          if (tAdornModel && tAdornModel.get('isVisible'))
            tAdornModel.recomputeValue(); // initialize
        }

        var willShow = !this.isAdornmentVisible('connectingLine');
        DG.UndoHistory.execute(DG.Command.create({
          name: "graph.toggleConnectingLine",
          undoString: (willShow ? 'DG.Undo.graph.showConnectingLine' : 'DG.Undo.graph.hideConnectingLine'),
          redoString: (willShow ? 'DG.Redo.graph.showConnectingLine' : 'DG.Redo.graph.hideConnectingLine'),
          log: "toggleConnectingLine: %@".fmt(willShow ? "show" : "hide"),
          execute: function () {
            toggle();
          },
          undo: function () {
            toggle();
          }
        }));
      },

      /**
       * Toggle where the squares drawn from points to lines and functions are being shown
       */
      toggleShowSquares: function () {
        var this_ = this;

        function toggle() {
          this_.set('areSquaresVisible', !this_.get('areSquaresVisible'));
        }

        var willShow = !this.get('areSquaresVisible');
        DG.UndoHistory.execute(DG.Command.create({
          name: "graph.toggleShowSquares",
          undoString: (willShow ? 'DG.Undo.graph.showSquares' : 'DG.Undo.graph.hideSquares'),
          redoString: (willShow ? 'DG.Redo.graph.showSquares' : 'DG.Redo.graph.hideSquares'),
          log: "toggleShowSquares: %@".fmt(willShow ? "show" : "hide"),
          execute: function () {
            toggle();
          },
          undo: function () {
            toggle();
          }
        }));
      },

      handleDataConfigurationChange: function () {
        sc_super();
        this.rescaleAxesFromData(true, /* allow scale shrinkage */
            true /* do animation */);

        var adornmentModel = this.getAdornmentModel('connectingLine');
        if (adornmentModel) {
          adornmentModel.setComputingNeeded();  // invalidate if axis model/attribute change
        }
      },

      /**
       Each axis should rescale based on the values to be plotted with it.
       @param{Boolean} Default is false
       @param{Boolean} Default is true
       @param{Boolean} Default is false
       */
      rescaleAxesFromData: function (iAllowScaleShrinkage, iAnimatePoints, iLogIt, isUserAction) {
        if (iAnimatePoints === undefined)
          iAnimatePoints = true;
        this.doRescaleAxesFromData([DG.GraphTypes.EPlace.eX, DG.GraphTypes.EPlace.eY, DG.GraphTypes.EPlace.eY2],
            iAllowScaleShrinkage, iAnimatePoints, isUserAction);
        if (iLogIt && !isUserAction)
          DG.logUser("rescaleScatterplot");
      },

      /**
       @param{ {x: {Number}, y: {Number} } }
       @param{Number}
       */
      dilate: function (iFixedPoint, iFactor) {
        this.doDilation([DG.GraphTypes.EPlace.eX, DG.GraphTypes.EPlace.eY], iFixedPoint, iFactor);
      },

      checkboxDescriptions: function () {
        var this_ = this;
        return sc_super().concat([
          {
            title: 'DG.Inspector.graphConnectingLine',
            value: this_.isAdornmentVisible('connectingLine'),
            classNames: 'graph-connectingLine-check'.w(),
            valueDidChange: function () {
              this_.toggleConnectingLine();
            }.observes('value')
          },
          {
            title: 'DG.Inspector.graphMovableLine',
            value: this_.get('isMovableLineVisible'),
            classNames: 'graph-movableLine-check'.w(),
            valueDidChange: function () {
              this_.toggleMovableLine();
            }.observes('value')
          },
          {
            title: 'DG.Inspector.graphLSRL',
            value: this_.get('isLSRLVisible'),
            classNames: 'graph-lsrl-check'.w(),
            valueDidChange: function () {
              this_.toggleLSRLLine();
            }.observes('value')
          },
          {
            title: 'DG.Inspector.graphInterceptLocked',
            classNames: 'graph-interceptLocked-check'.w(),
            _finishedInit: false,
            valueDidChange: function () {
              if( this._finishedInit)
                this_.toggleInterceptLocked();
            }.observes('value'),
            lineVisibilityChanged: function() {
              this.set('value', this_.get('isInterceptLocked'));
              this.set('isEnabled', this_.get('isMovableLineVisible') || this_.get('isLSRLVisible'));
            },
            init: function() {
              sc_super();
              this.lineVisibilityChanged();
              this_.addObserver('isMovableLineVisible', this, 'lineVisibilityChanged');
              this_.addObserver('isLSRLVisible', this, 'lineVisibilityChanged');
              this._finishedInit = true;
            },
            destroy: function() {
              this_.removeObserver('isMovableLineVisible', this, 'lineVisibilityChanged');
              this_.removeObserver('isLSRLVisible', this, 'lineVisibilityChanged');
              sc_super();
            }
          },
          {
            title: 'DG.Inspector.graphPlottedFunction',
            value: this_.isAdornmentVisible('plottedFunction'),
            classNames: 'graph-plottedFunction-check'.w(),
            valueDidChange: function () {
              this_.togglePlotFunction();
            }.observes('value')
          },
          {
            title: 'DG.Inspector.graphPlottedValue',
            value: this_.isAdornmentVisible('plottedValue'),
            classNames: 'graph-plottedValue-check'.w(),
            valueDidChange: function () {
              this_.togglePlotValue();
            }.observes('value')
          },
          {
            title: 'DG.Inspector.graphSquares',
            value: this_.get('areSquaresVisible'),
            classNames: 'graph-squares-check'.w(),
            lineVisibilityChanged: function() {
              var tLineIsVisible = this_.get('isMovableLineVisible') || this_.get('isLSRLVisible');
              this.set('isEnabled', tLineIsVisible);
              if( this_.get('areSquaresVisible') && !tLineIsVisible)
                this.set('value', false);
            },
            init: function() {
              sc_super();
              this.lineVisibilityChanged();
              this_.addObserver('isMovableLineVisible', this, 'lineVisibilityChanged');
              this_.addObserver('isLSRLVisible', this, 'lineVisibilityChanged');
            },
            destroy: function() {
              this_.removeObserver('isMovableLineVisible', this, 'lineVisibilityChanged');
              this_.removeObserver('isLSRLVisible', this, 'lineVisibilityChanged');
            },
            valueDidChange: function () {
              this_.toggleShowSquares();
            }.observes('value')
          }
        ]);
      }.property(),

      /**
       * @return { Object } with properties specific to a given subclass
       */
      createStorage: function () {
        var tStorage = sc_super(),
            tMovableLine = this.get('movableLine'),
            tLSRL = this.get('multipleLSRLs');
        if (!SC.none(tMovableLine))
          tStorage.movableLineStorage = tMovableLine.createStorage();
        if (!SC.none(tLSRL) && tLSRL.get('isVisible'))
          tStorage.multipleLSRLsStorage = tLSRL.createStorage();
        if (this.get('areSquaresVisible'))
          tStorage.areSquaresVisible = true;
        if (this.get('isLSRLVisible'))
          tStorage.isLSRLVisible = true;

        return tStorage;
      },

      /**
       * @param { Object } with properties specific to a given subclass
       */
      restoreStorage: function (iStorage) {

        /*  Older documents stored adornments individually in the plot model
         *  that used them, e.g. movable lines and function plots were stored
         *  here with the scatter plot model. In newer documents, there is an
         *  'adornments' property in the base class (plot model) which stores
         *  all or most of the adornments. To preserve file format compatibility
         *  we move the locally stored storage objects into the base class
         *  'adornments' property where the base class will process them when
         *  we call sc_super().
         */
        this.moveAdornmentStorage(iStorage, 'movableLine', iStorage.movableLineStorage);
        this.moveAdornmentStorage(iStorage, 'multipleLSRLs', iStorage.multipleLSRLsStorage);
        this.moveAdornmentStorage(iStorage, 'plottedFunction', iStorage.plottedFunctionStorage);

        sc_super();

        if (iStorage.movableLineStorage) {
          if (SC.none(this.movableLine))
            this.createMovableLine();
          this.get('movableLine').restoreStorage(iStorage.movableLineStorage);
        }
        if (iStorage.multipleLSRLsStorage) {
          if (SC.none(this.multipleLSRLs))
            this.createLSRLLines();
          this.get('multipleLSRLs').restoreStorage(iStorage.multipleLSRLsStorage);
        }
        if (iStorage.areSquaresVisible)
          this.toggleShowSquares();

        // Legacy document support
        if (iStorage.plottedFunctionStorage) {
          if (SC.none(this.plottedFunction))
            this.set('plottedFunction', DG.PlottedFunctionModel.create());
          this.get('plottedFunction').restoreStorage(iStorage.plottedFunctionStorage);
        }
      },

      onRescaleIsComplete: function () {
        if (!SC.none(this.movableLine))
          this.movableLine.recomputeSlopeAndInterceptIfNeeded(this.get('xAxis'), this.get('yAxis'));
      },

      /**
       * Get an array of non-missing case counts in each axis cell.
       * Also cell index on primary and secondary axis, with primary axis as major axis.
       * @return {Array} [{count, primaryCell, secondaryCell},...] (all values are integers 0+).
       */
      getCellCaseCounts: function () {
        var tCases = this.get('cases'),
            tXVarID = this.get('xVarID'),
            tYVarID = this.get('yVarID'),
            tCount = 0,
            tValueArray = [];

        if (!( tXVarID && tYVarID )) {
          return tValueArray; // too early to recompute, caller must try again later.
        }

        // compute count and percent cases in each cell, excluding missing values
        tCases.forEach(function (iCase, iIndex) {
          var tXVal = iCase.getNumValue(tXVarID),
              tYVal = iCase.getNumValue(tYVarID);
          if (isFinite(tXVal) && isFinite(tYVal)) ++tCount;
        });

        // initialize the values for the single 'cell' of the scatterplot
        tValueArray.push({
          count: tCount,
          primaryCell: 0,
          secondaryCell: 0
        });
        return tValueArray;
      }

    });

