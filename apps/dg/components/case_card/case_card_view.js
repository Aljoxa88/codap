// ==========================================================================
//                            DG.CaseCardView
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

/* global ReactDOM */
/** @class  DG.CaseCardView - The top level view for a case card

 @extends DG.View
 */
DG.CaseCardView = SC.View.extend(
    /** @scope DG.CaseCardView.prototype */
    (function () {

      return {

        isDropTarget: true, // So we'll participate in SC drag-drop

        /**
         The model on which this view is based.
         @property { DG.CaseCardModel }
         */
        model: null,

        /**
         * @property { DG.DataContext }
         */
        context: null,

        /**
         * @property {Element}
         */
        reactDiv: null,

        dragInProgress: false,

        classNames: 'react-data-card-view'.w(),

        classNameBindings: ['dragInProgress'],

        initCardLayer: function () {
          var tLayer = this.get('layer'),
              tReactCard = DG.React.Components.CaseCard({
                container: tLayer,
                context: this.get('context')
              });
          this.reactDiv = document.createElement('div');
          tLayer.appendChild(this.reactDiv);
          DG.React.toggleRender(this.reactDiv, tReactCard);
        },

        destroy: function () {
          DG.React.toggleRender(this.reactDiv);

          sc_super();
        },

        renderCard: function (iExtraProps) {
          var currProps = Object.assign({container: this.get('layer'), context: this.get('context')},
              iExtraProps || {});
          ReactDOM.render( DG.React.Components.CaseCard( currProps), this.reactDiv);
        },

        isValidAttribute: function (iDrag) {
          var tDragAttr = iDrag.data.attribute,
              tAttrs = this.get('context').getAttributes();
          return tAttrs.indexOf(tDragAttr) >= 0;
        },

        computeDragOperations: function (iDrag) {
          var tResult;
          if (this.isValidAttribute(iDrag))
            tResult = SC.DRAG_LINK;
          else
            tResult = SC.DRAG_NONE;
          return tResult;
        },

        dragEntered: function (iDragObject, iEvent) {
          this.renderCard({ dragStatus: { dragObject: iDragObject, event: iEvent}});
        },

        dragUpdated: function (iDragObject, iEvent) {
          this.renderCard({ dragStatus: { dragObject: iDragObject, event: iEvent}});
        },

        dragExited: function (iDragObject, iEvent) {
          this.renderCard({ dragStatus: null});
        },

        acceptDragOperation: function () {
          return YES;
        },

        dragStarted: function (iDrag) {
          if (this.isValidAttribute(iDrag)) {
            this.set('dragInProgress', true);
          }
        },

        dragEnded: function () {
          this.set('dragInProgress', false);
          this.dragExited();
        },

        performDragOperation: function( iDragObject, iOp) {
          this.renderCard({ dragStatus: { dragObject: iDragObject, op: iOp } });
        }

        // todo: handle data drags

      };
    }()));

