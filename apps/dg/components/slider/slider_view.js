// ==========================================================================
//                            DG.SliderView
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

/** @class  DG.SliderView - The top level view for a slider

 @extends DG.View
 */
DG.SliderView = SC.View.extend(
  /** @scope DG.SliderView.prototype */
  (function() {
    var kWidth = 30,
        kThumbHeight = 36,
        kAxisHeight = 20,
        kButtonHeight = 18,
        kButtonWidth = 20,
        kGap = 5,
        tMouseDownInfo,
        tDraggingThumb = false;

    return {
      backgroundColor: "white",

      /**
       The model on which this view is based.
       @property { DG.SliderModel }
       */
      model: null,

      /**
       The model on which this view is based.
       @property { DG.CellLinearAxisView }
       */
      axisView: null,

      /**
       Subview that displays draggable thumb.
       @property { SC.ImageView }
       */
      thumbView: null,

      /**
       Subview that displays slider name and value.
       @property { SC.IconButton }
       */
      startButton: null,

      /**
       Subview that displays slider name and value.
       @property { SC.LabelView }
       */
      valueView: null,

      /**
       Set to true when user editing of valueView begins
       @property {Boolean}
       */
      userEdit: false,

      /**
       Stores the value of the slider before a mousedrag begins
       @property { Number }
       */
      _previousValue: 0,

      /**
       My model's value if there is one.
       @property { Number }
       */
      value: function() {
        return this.getPath('model.value');
      }.property('model').cacheable(),

      valueDidChange: function() {
        this.notifyPropertyChange('value');
      }.observes('*model.value'),

      /**
       The name of my model's global value
       @property { String }
       */
      name: function() {
        return this.getPath('model.name');
      }.property('model').cacheable(),

      nameDidChange: function() {
        this.notifyPropertyChange('name');
      }.observes('*model.name'),

      /**
       The screen coordinate of the model value.
       @property { Number }
       */
      thumbCoord: function() {
        var tValue = this.get('value'),
            tAxisView = this.get('axisView');
        return (SC.none( tValue) || SC.none( tAxisView)) ? null : tAxisView.dataToCoordinate( tValue);
      }.property('value'),

      thumbCoordDidChange: function() {
        this.notifyPropertyChange('thumbCoord');
      }.observes('*axisView.model.lowerBound', '*axisView.model.upperBound'),

      init: function() {
        // Notice that we are explicitly creating and laying out our subviews. This is because
        // when we tried doing it through childViews (the usual way), something about the dependencies
        // wouldn't work. (Might be worth figuring out.)
        sc_super();
        DG.assert( !SC.none( this.get( 'model' ) ) );

        this.set( 'axisView', DG.CellLinearAxisView.create(
          { layout: { bottom: 0, height: kAxisHeight }, orientation: 'horizontal', isDropTarget: false } ) );
        this.appendChild( this.axisView );
        this.setPath( 'axisView.model', this.getPath( 'model.axis' ) );

        this._previousValue = this.getPath('model.value');

        this.set('thumbView',
            DG.IconButton.create( {
              layout: { bottom: kAxisHeight, width: kWidth, height: kThumbHeight },
              iconExtent: { width: kWidth, height: kThumbHeight },
              iconClass: 'thumb-icon',
              classNames: 'display-styles'.w(),
              toolTip: 'DG.SliderView.thumbView.toolTip', // "Start/stop animation"
              localize: true,
              touchPriority: true,
              mouseDown: function() { return NO; }
            }));
        this.appendChild( this.thumbView );

        this.set('startButton',
          DG.IconButton.create( {
            layout: {top: kGap + 2, left: 2, width: kButtonWidth + 2, height: kButtonHeight + 2},
            iconExtent: { width: kButtonWidth, height: kButtonHeight },
            classNames: 'display-styles'.w(),
            target: this,
            action: 'toggleAnimation',
            toolTip: 'DG.SliderView.startButton.toolTip', // "Start/stop animation"
            localize: true
          }));
        this.appendChild( this.startButton );

        this.set('valueView',
          SC.LabelView.create(DG.MouseAndTouchView, {
            layout: { left: kButtonWidth + kGap, top: 3, bottom: kAxisHeight + 16 },
            classNames: 'slider-label'.w(),
            isEditable: true,
            exampleNode: null,
            inlineEditorWillBeginEditing: function( iEditor, iValue, iEditable) {
              sc_super();
              var tFrame = this.get('frame'),
                  kXGap = 4, kYGap = 5,
                  tOrigin = DG.ViewUtilities.viewToWindowCoordinates( { x: kXGap - 2, y: kYGap - 7 }, this);

              this.parentView.set('userEdit', true);

              // SC 1.10 introduced a new inline editor model in which
              // an 'exampleNode' is used to adjust inline editor style.
              var exampleNode = this.get('exampleNode');
              if(!exampleNode) {
                var parentNode = this.getPath('parentView.layer');
                exampleNode = this.get('layer').cloneNode(false);
                exampleNode.id = exampleNode.id + "-clone";
                exampleNode.style.visibility = 'hidden';
                parentNode.appendChild(exampleNode);
                this.set('exampleNode', exampleNode);
              }
              exampleNode.style.left = 0 + 'px';
              exampleNode.style.top = 9 + 'px';

              iEditor.set({ exampleElement: exampleNode,
                            exampleFrame: { x: tOrigin.x, y: tOrigin.y,
                                            width: tFrame.width - 2 * kXGap,
                                            height: tFrame.height - 2 * kYGap }});
            },
            doIt: function() {
              this.beginEditing();
            }
        }));
        this.appendChild( this.valueView );
      },

      _destroy: function () {
        var controller = this.get('controller');
        if( controller)
          controller.stopAnimation();
        this.model.destroy(); // so that it can unlink observers
      },

      willDestroy: function() {
        console.log('SliderView.willDestroy');
        this._destroy;
        sc_super();
      },

      destroy: function () {
        console.log('SliderView.destroy');
        this._destroy;
        sc_super();
      },

      viewDidResize: function() {
        sc_super();
        this.positionThumb();
      },

      /**
       * Use the value to position the thumbView.
       */
      positionThumb: function() {
        var tCoord = this.get('thumbCoord');
        if( DG.isFinite( tCoord)) {
          var thumbView = this.get('thumbView');
          if( thumbView)
            thumbView.adjust('left', tCoord + 0.5 - kWidth / 2);
        }
      }.observes('thumbCoord'),

      /**
       * Use the value to position the thumbView.
       */
      updateValueView: function() {
        var tAxis = this.get('axisView'),
            tDelta = tAxis.coordinateToData( 1) - tAxis.coordinateToData( 0),
            tLogDelta = Math.log( tDelta) / Math.LN10,
            tMaxDecimals = Math.ceil( -tLogDelta),
            tModel = this.get('model'),
            tName = SC.none( tModel) ? '' : tModel.get('name'),
            tNumber = SC.none( tModel) ? '' : DG.Format.number().fractionDigits( 0, tMaxDecimals)( tModel.get('value'));

        this.setPath('valueView.value', tName + ' = ' + tNumber);
      }.observes('thumbCoord', 'name'),

      mouseDown: function( iEvent) {
        DG.globalEditorLock.commitCurrentEdit();
        var tThumbFrame = this.getPath('thumbView.frame');
        tMouseDownInfo = {
          pagePoint: { x: iEvent.pageX, y: iEvent.pageY },
          viewPoint: DG.ViewUtilities.windowToViewCoordinates( { x: iEvent.pageX, y: iEvent.pageY }, this),
          thumbCoord: this.get('thumbCoord')
        };
        if( DG.ViewUtilities.ptInRect( tMouseDownInfo.viewPoint, tThumbFrame)) {
          this._previousValue = this.getPath('model.value');
          tDraggingThumb = true;
          return YES;  // We handled it
        }
        else
          // Let other event handling proceed - especially double-click
          return NO;
      },

      mouseDragged: function( iEvent) {
        if( tDraggingThumb) {
          var tDelta = iEvent.pageX - tMouseDownInfo.pagePoint.x,
              tNewCoord = tMouseDownInfo.thumbCoord + tDelta,
              tNewValue = this.get('axisView').coordinateToData( tNewCoord);
          this.setPath('model.value', tNewValue);
        }
      },

      mouseUp: function() {
        if( tDraggingThumb) {
          var this_ = this;
          DG.UndoHistory.execute(DG.Command.create({
            name: 'slider.change',
            undoString: 'DG.Undo.slider.change',
            redoString: 'DG.Redo.slider.change',
            log: "sliderThumbDrag: { \"name\": \"%@\", \"newValue\": %@ }".fmt(this_.getPath('model.name'), this_.getPath('model.value')),
            _componentId: this_.getPath('controller.model.id'),
            _controller: function() {
              return DG.currDocumentController().componentControllersMap[this._componentId];
            },
            _view: function() {
              return this._controller().get('sliderView');
            },
            _newValue: this_.getPath('model.value'),
            _prevValue: this_._previousValue,
            execute: function() {
              this._view().get('model').encompassValue();
              if (this._newValue === this._prevValue) {
                this.causedChange = false;
              }
            },
            undo: function() {
              var view = this._view();
              view.setPath('model.value', this._prevValue);
              view.get('model').encompassValue();
            },
            redo: function() {
              var view = this._view();
              view.setPath('model.value', this._newValue);
              view.get('model').encompassValue();
            }
          }));
        }
        tDraggingThumb = false;
      },

      touchStart: function(evt){
        return this.mouseDown(evt);
      },
      touchEnd: function(evt){
        return this.mouseUp(evt);
      },
      touchesDragged: function( evt, touches) {
        return this.mouseDragged( evt);
      },

      toggleAnimation: function() {
        var controller = this.get('controller');
        if( controller)
          controller.toggleAnimation();
      },

      /**
       * Updates the start button appearance
       */
      isAnimatingDidChange: function() {
        var startButton = this.get('startButton');
        if( !this.getPath('controller.isAnimating')) {
          startButton.set('iconClass', 'play-icon');
        }
        else {
          startButton.set('iconClass', 'pause-icon');
        }
      }.observes('*controller.isAnimating'),

      /**
       * Parses the user-edited contents of valueView. If it can identify a variable name and value,
       * the global value name and value will be set accordingly.
       */
      valueViewWasEdited: function() {
        // regular expression for matching 'variable = value'
        // TODO: Do better with white space
        // TODO: Handle scientific notation? Thousands separators? Internationalization?
        var kMatchExp = /^\s*([a-zA-Z_][\w]*)\s*=\s*([+\-]?[0-9.]+)/,
            tResult, tNewValue, tNewName;
        // We only want to parse the expression if the user actually edited it
        if( this.get('userEdit')) {
          var tNewString = this.getPath('valueView.value');
          tNewString = tNewString.replace('\u2212', '-');
          this.set('userEdit', false);
          tResult = kMatchExp.exec( tNewString);
          DG.logUser("sliderEdit: { expression: '%@', result: %@ }",
                                      tNewString, !SC.none( tResult) ? "success" : "failure");
          if( !SC.none( tResult)) {
            tNewValue = parseFloat( tResult[ 2]);
            tNewName = tResult[ 1];
            this.setPathIfChanged('model.value', tNewValue);
            this.setPathIfChanged('model.name', tNewName);
            this.get('model').encompassValue();
          }
          else
            this.updateValueView();
        }
      }.observes('.valueView.value')

    };
  }()) );

