// ==========================================================================
//                          DG.BarChartModel
//
//  Author:   William Finzer
//
//  Copyright (c) 2017 by The Concord Consortium, Inc. All rights reserved.
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

sc_require('components/graph/plots/chart_model');
sc_require('components/graph/plots/numeric_plot_model_mixin');

/** @class  DG.BarChartModel - The model for a plot with categorical axes

 @extends DG.ChartModel
 */
DG.BarChartModel = DG.ChartModel.extend(DG.NumericPlotModelMixin,
    /** @scope DG.BarChartModel.prototype */
    {
      /**
       * Override
       * @property {Boolean}
       */
      displayAsBarChart: true,

      breakdownType: DG.Analysis.EBreakdownType.eCount,

      /**
       * We want an 'other' axis for count or percent.
       * @property {Boolean}
       */
      wantsOtherAxis: true,

      naturalUpperBound: function () {
        var tNaturalUpperBound;
        switch (this.get('breakdownType')) {
          case DG.Analysis.EBreakdownType.eCount:
            tNaturalUpperBound = Math.max( 4, this.get('maxInCell'));
            break;
          case DG.Analysis.EBreakdownType.ePercent:
            tNaturalUpperBound = 100;
            break;
        }
        return 1.05 * tNaturalUpperBound;
      }.property('breakdownType'),

      breakdownTypeDidChange: function () {
        var tNewType = this.get('breakdownType'),
            tNewUpperBound;
        this.setPath('secondaryAxisModel.scaleType', tNewType);
        tNewUpperBound = this.get('naturalUpperBound');
        this.get('secondaryAxisModel').setLowerAndUpperBounds(0, tNewUpperBound, true /* with animation */);
      }.observes('breakdownType'),

      /**
       Subclasses may override
       @param { DG.GraphTypes.EPlace }
       @return{ {min:{Number}, max:{Number} isDataInteger:{Boolean}} }
       */
      getDataMinAndMaxForDimension: function (iPlace) {
        var tResult = {
          min: 0,
          max: this.get('naturalUpperBound'),
          isDataInteger: this.get('breakdownType') === DG.Analysis.EBreakdownType.eCount
        };
        return tResult;
      },

      lastConfigurationControls: function () {
        var tControls = sc_super(),
            this_ = this,
            kRowHeight = 18,
            kControlValues = {
              count: 'DG.Inspector.graphCount'.loc(),
              percent: 'DG.Inspector.graphPercent'.loc()
            };

        function mapValueToBreakdownType(iValue) {
          var tKind = -1;
          switch (iValue) {
            case kControlValues.count:
              tKind = DG.Analysis.EBreakdownType.eCount;
              break;
            case kControlValues.percent:
              tKind = DG.Analysis.EBreakdownType.ePercent;
              break;
          }
          return tKind;
        }

        function mapBreakdownTypeToValue(iType) {
          var tValue = '';
          switch (iType) {
            case DG.Analysis.EBreakdownType.eCount:
              tValue = kControlValues.count;
              break;
            case DG.Analysis.EBreakdownType.ePercent:
              tValue = kControlValues.percent;
              break;
          }
          return tValue;
        }

        tControls.push(
            SC.LabelView.create({
              layout: {height: kRowHeight},
              value: 'DG.Inspector.displayScale',
              localize: true
            })
        );

        tControls.push(
            SC.RadioView.create({
              items: [kControlValues.count, kControlValues.percent],
              value: mapBreakdownTypeToValue(this_.get('breakdownType')),
              layoutDirection: SC.LAYOUT_VERTICAL,
              layout: {height: 3 * kRowHeight},
              classNames: 'dg-inspector-radio'.w(),
              valueDidChange: function () {
                this_.set('breakdownType', mapValueToBreakdownType(this.value));
              }.observes('value')
            })
        );
        return tControls;
      }.property('plot'),

      /**
       Each axis should rescale based on the values to be plotted with it.
       @param iAllowScaleShrinkage{Boolean} Default is false
       @param iAnimatePoints {Boolean} Default is true
       @param iLogIt {Boolean} Default is false
       @param iUserAction {Boolean} Default is false
       */
      rescaleAxesFromData: function (iAllowScaleShrinkage, iAnimatePoints, iLogIt, iUserAction) {
        if (iAnimatePoints === undefined)
          iAnimatePoints = true;
        this.doRescaleAxesFromData([this.get('secondaryAxisPlace')], iAllowScaleShrinkage, iAnimatePoints, iUserAction);
        if (iLogIt)
          DG.logUser("rescaleDotPlot");
      },
      /**
       * @return {Object} the saved data.
       */
      createStorage: function () {
        var tStorage = sc_super();

        tStorage.breakdownType = this.breakdownType;

        return tStorage;
      },

      /**
       * @param iStorage
       */
      restoreStorage: function (iStorage) {
        sc_super();
        if (!SC.none(iStorage.breakdownType)) {
          this.set( 'breakdownType', iStorage.breakdownType);
        }
      }


    });

