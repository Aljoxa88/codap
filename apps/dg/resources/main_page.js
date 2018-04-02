// ==========================================================================
//                              DG.mainPage
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

// This page describes the main user interface for your application.
DG.mainPage = SC.Page.design((function() {

  var kButtonWidth = 40,
      kToolbarHeight = DG.STANDALONE_MODE ? 0 : 70,
      kInfobarHeight = 24,
      kIconTopPadding = 17;

  // begin compatible browser main page design
  return DG.Browser.isCompatibleBrowser() ? {

  // The main pane is made visible on screen as soon as your app is loaded.
  // Add childViews to this pane for views to display immediately on page load.
  mainPane: SC.MainPane.design({

    isTextSelectable: YES, // Makes text selectable in the background page in
                           // shared embedded mode

    sendEvent: function(action, evt, target) {
      if( action === 'mouseDown' || action === 'touchStart' || action === 'click') {
        this.hideInspectorPicker( target);
      }
      return sc_super();
    },

    hideInspectorPicker: function( iTarget) {
      var tInspectorPicker = this.get('inspectorPicker');
      if( tInspectorPicker) {
        // We can detect that the mousedown causing us to hide the inspectorPicker occurred in
        // the button that brings it up. In which case, when we handle that event, we won't want
        // to show that inspector picker again for this mouse click. Convoluted? Yes!
        if( iTarget && iTarget.iconClass && iTarget.iconClass === tInspectorPicker.buttonIconClass)
            tInspectorPicker.set('removedByClickInButton', true);
        tInspectorPicker.remove();
        tInspectorPicker.destroy(); // We regenerate each time
        this.set('inspectorPicker', null);
      }
    },

    /**
     * When a DG.InspectorPickerPane inits, it sets this property. When we receive a mouseDown,
     * we tell it to remove.
     *
     * @property {DG.InspectorPickerPane}
     */
    inspectorPicker: null,

    childViews: 'navBar topView scrollView'.w(),

    containerViewBinding: 'scrollView.contentView',

    navBar: SC.View.design({
      classNames: 'navBar'.w(),
      layout: { height: kInfobarHeight },
      childViews: 'leftSide rightSide'.w(),
      anchorLocation: SC.ANCHOR_TOP,
      isVisible: (DG.get('componentMode') !== 'yes') && (DG.get('embeddedMode') !== 'yes'),

      // CFM wrapper view
      leftSide: SC.View.design({
        layout: {left: 0, right: 30},
        // The following overrides cause sproutcore to pass on touch events
        // to React. Overriding captureTouch keeps higher level elements from
        // capturing the touch. Calling allowDefault in the touch events
        // propagates the original event through.
        captureTouch: function () {
          return YES;
        },
        touchStart: function (touch) {
          touch.allowDefault();
        },
        touchesDragged: function (touch) {
          touch.allowDefault();
        },
        touchEnd: function (touch) {
          touch.allowDefault();
        },

        classNames: 'leftSide'.w(),
        didAppendToDocument: function() {
          /* global Promise */
          DG.cfmViewConfig = Promise.resolve({
                              // used for the CFM menu bar
                              navBarId: this.getPath('layer.id')
                            });
        }
      }),

      rightSide: SC.View.design({
        classNames: 'rightSide'.w(),
        layout: { width: 30, height: 24, right: 0 },
        childViews: 'localeButton'.w(),
        // locales menu button
        localeButton: SC.PopupButtonView.extend({
          classNames: 'dg-icon-button'.w(),
          layout: { left:0, width: 30, height: 24 },
          menu: SC.MenuPane.extend({
            classNames: 'dg-locales-menu',
            itemToolTipKey: 'name',
            itemIconKey: 'icon',
            itemTitleKey: 'title',
            itemHeight: 24,
            itemWidth: 48,
            menuHeightPadding: 0,
            layout: { width: 90},
            items: function () {
              this.items = DG.locales.map(function (locale) {
                return {
                  name: locale.langName.loc(),
                  icon: locale.icon,
                  digraph: locale.langDigraph,
                  title: locale.langDigraph.toUpperCase()
                }
              });
            }.property().cacheable(true),
          }),
          currLocale: DG.locales.find(function (locale) {
            // DG.log('currentLanguage: ' + this.SC.Locale.currentLanguage)
            return locale.langDigraph === SC.Locale.currentLanguage;
          }),
          icon: function () {
            // DG.log('currLocale: ' + JSON.stringify(this.currLocale))
            return this.currLocale? this.currLocale.icon: null;
          }.property('currLocale'),
          // When a user selects a new locale we redirect relatively to
          // the site for the locale, taking with use query and hash parameters
          selectedItemDidChange: function () {
            function makeUrl(digraph, location) {
              var baseURL = 'https://codap.concord.org/releases/latest/static/dg/%@/cert/'.loc(digraph);
              if (location.pathname.indexOf('static/dg')>0) {
                baseURL = '../../%@/cert'.loc(digraph);
              }
              return baseURL + window.location.search+window.location.hash;
            }
            var item = this.menu.get('selectedItem');
            DG.assert(item, 'Check if locale item exists');
            window.location = makeUrl(item.digraph, window.location)
          }.observes('menu.selectedItem')
        }),
      })
    }),

    topView: SC.View.design({
      classNames: 'toolshelf-background'.w(),
      layout: { top: kInfobarHeight, height: kToolbarHeight - 1 },
      childViews: 'iconButtons rightButtons'.w(),

      iconButtons: SC.View.design(SC.FlowedLayout, {
        classNames: 'dg-icon-buttons'.w(),
        layout: { width: 0, height: kToolbarHeight - 1 },
        align: SC.ALIGN_LEFT,
        canWrap: false,
        shouldResizeHeight: false,
        defaultFlowSpacing: { left: 5, top: kIconTopPadding, right: 5 },
        init: function() {
          sc_super();
          // create tool buttons, left-justified
          DG.toolButtons.forEach( function( iButtonName, iIndex ) {
            var tButton = DG.ToolButtonData[iButtonName];
            if( iIndex === 0) {
              tButton.flowSpacing = { left: 10, top: kIconTopPadding, right: 5 };
            }
            tButton.classNames = tButton.classNames || '';
            tButton.classNames = (tButton.classNames + ' dg-toolshelf-button').w();
            this[ iButtonName] = DG.IconButton.create( tButton);
            this[ iButtonName].set('layout', { width: this[ iButtonName].getWidth(), height: 40 });
            this.appendChild( this[ iButtonName ]);
          }.bind(this));
        }
      }), // iconButtons

      rightButtons: SC.View.design(SC.FlowedLayout, {
        layout: { top: 0, right: 10, width: 0, height: kToolbarHeight - 1 },
        align: SC.ALIGN_RIGHT,
        canWrap: false,
        shouldResizeHeight: false,
        defaultFlowSpacing: { right: 10, top: kIconTopPadding },

        init: function() {
          sc_super();
          // create right buttons, right-justified
          DG.rightButtons.forEach( function( iButtonName ) {
            var tButton = DG.RightButtonData[iButtonName];
            tButton.classNames.push('dg-toolshelf-button');
            this[ iButtonName] = DG.IconButton.create( tButton);
            this[ iButtonName].set('layout', { width: this[ iButtonName].getWidth()/*, height: 40*/ });
            this.appendChild( this[ iButtonName ]);
          }.bind(this));
          DG.currDocumentController().set('guideButton', this.guideButton);
        },

        /**
         * Override this so that the child views will have a height that fits with their icon and label.
         * Without this, the menu for the options popup appears too low.
         * @param iChild {SC.View}
         * @param iLayout {Object}
         */
        applyPlanToView: function( iChild, iLayout) {
          SC.FlowedLayout.applyPlanToView.apply(this, arguments);
          if( iChild.adjustHeight)
            iChild.adjustHeight();
        }
      }) // rightButtons
    }), // topView

    scrollView: SC.ScrollView.design({
      layout: { top: kInfobarHeight + kToolbarHeight },
      horizontalAlign: SC.ALIGN_LEFT,
      verticalAlign: SC.ALIGN_TOP,
      classNames: 'dg-doc-background'.w(),
      alwaysBounceVertical: false,
      contentView: DG.ContainerView.design( {
      })
    }),

    flagsChanged: function( iEvent) {
//    if( iEvent.altKey)
//      console.log('altKey');
//    else
//      console.log('no altKey');
//    this.rootResponder.sendEvent('mouseMoved', iEvent);
    },

    /**
     * Decide whether the topView should be showing
     */
    init: function() {
      sc_super();
      if(( DG.get('componentMode') === 'yes') || ( DG.get('embeddedMode') === 'yes')) {
        var tScrollView = this.get('scrollView');
        this.setPath('topView.isVisible', false);
        tScrollView.adjust('top', 0);
        tScrollView.set('hasHorizontalScroller', false);
        tScrollView.set('hasVerticalScroller', false);
      }
      this.invokeLater( 'setupDragDrop', 300);
    },

    classNameBindings: [
        '_isDraggingFileOrURL:dg-receive-outside-drop',
        '_isDraggingAttr:dg-attr-drop'
    ],

    dragAttributeData: null,
    _isDraggingAttr: false,
    _isDraggingFileOrURL: false,

    /**
     * These methods -- dataDragEntered, dataDragHovered, dataDragDropped,
     * and dataDragExited -- support drags initiated outside the page,
     * specifically drags from plugins.
     */
    dataDragEntered: function (iEvent) {
      function findAttributeRefByID(id) {
        var contexts = DG.currDocumentController().contexts;
        var attrRef;
        contexts && contexts.some(function (context) {
          attrRef = context.getAttrRefByID(id);
          if (attrRef) { attrRef.context = context; }
          return !!attrRef;
        });
        return attrRef;
      }
      function computeDropData(_this, attrRef) {
        return {
          context: attrRef.context,
          collection: attrRef.collection.get('collection'),
          attribute: attrRef.attribute,
          text: attrRef.attribute.get('name')
        };
      }

      var context;
      var attrID = iEvent.dataTransfer.types.find(function (type) {
        var found = type.startsWith('application/x-codap-attr-');
        return found && type.replace('application/x-codap-attr-', '');
      });
      attrID = attrID && attrID.replace('application/x-codap-attr-', '');
      var attrRef = attrID && findAttributeRefByID(attrID);

      // DG.log('main: dataDragEntered: ' + (iEvent.dataTransfer && iEvent.dataTransfer.types.join())
      //     + ' attrID' + attrID
      //     + ' attrRef: ' + (attrRef && [attrRef.context.get('name'), attrRef.collection.get('name'), attrRef.attribute.get('id')].join())
      // );
      if (attrRef) {
        this.set('dragAttributeData', computeDropData(this, attrRef));
        this.set('_isDraggingAttr', true);
      } else {
        this.set('_isDraggingFileOrURL', true);
      }
    },

    dataDragHovered: function (iEvent) {
      if (this.get('_isDraggingFileOrURL')) {
        iEvent.dataTransfer.dropEffect = 'copy';
      }
      return YES;
    },

    dataDragDropped: function(iEvent) {
      var tElement = this.get('layer');
      var tDataTransfer = iEvent.dataTransfer;
      var isIE = (SC.browser.engine === SC.ENGINE.trident);
      var tFiles = tDataTransfer.files,
          tURIType = isIE ? 'URL': 'text/uri-list',
          tURI = tDataTransfer.getData(tURIType);
      if( tFiles && (tFiles.length > 0)) {
        DG.appController.importFile(tFiles[0]);  // We only deal with the first file
      }
      else if( !SC.empty(tURI)) {
        SC.run(function () {
          DG.appController.importURL( tURI);
        });
      }
      $(tElement).removeClass('dg-receive-outside-drop');

      iEvent.preventDefault();
      return false;

    },

    dataDragExited: function (iEvent) {
      this.set('_isDraggingFileOrURL', false);
      this.set('_isDraggingAttr', false);
      this.set('dragAttributeData', null);
      iEvent.preventDefault();
    },

    /**
      The mainPane itself should be the default key view, rather than an arbitrary subview.

      When the window gets focus, the mainPane gets a chance to specify the default key view
      (i.e. first responder) via this computed property. (See SC.RootResponder.focus() for details.)
      The base class implementation of nextValidKeyView() returns an arbitrary subview which happens
      to accept firstResponder status. Thus, launching the app results in an arbitrary tool shelf
      button (e.g. Reset Data) having the keyboard focus by default. We fix this and other related
      bugs here by having the mainPane specify that it should be the key view itself rather than
      one of its subviews. If we ever determine that some other view should be the default key
      view (e.g. the game view), this would be the place to specify that.
     */
    nextValidKeyView: function() {
      return this;
    }.property(),

    /**
     * Handle keyboard shortcuts at the document level
     * @param keystring {String}
     * @param evt {Event}
     */
    performKeyEquivalent: function(keystring, evt) {
      var tResult = YES;
      switch( keystring) {
        case 'ctrl_alt_c':
          DG.mainPage.toggleCalculator();
          break;
        case 'ctrl_alt_t':
          DG.mainPage.openCaseTablesForEachContext();
          break;
        case 'ctrl_alt_g':
          DG.mainPage.addGraph();
          break;
        case 'ctrl_alt_s':
          DG.mainPage.addSlider();
          break;
        case 'ctrl_alt_shift_t':
          DG.mainPage.addText();
          break;
        case 'ctrl_z':
          DG.UndoHistory.undo();
          break;
        case 'ctrl_y':
        case 'ctrl_shift_z':
          DG.UndoHistory.redo();
          break;
        default:
          tResult = sc_super();
      }
      return tResult;
    },

    /**
      Creates the specified component and its associated view.
      This is a handler for a sendAction() call. The original
      client calls sendAction() from the gameController.
      @param  {Object}    iSender -- The caller of sendAction()
      @param  {Object}    iContext -- Parameter object from the caller
              {String}      iContext.type -- The type of component to create
                                              e.g. 'DG.GraphView', 'DG.TableView'
     */
    createComponentAndView: function( iSender, iContext) {
      var typeString = iContext.type,
          dotPos = typeString && typeString.indexOf('.'),
          lastWord = dotPos >= 0 ? typeString.slice( dotPos + 1) : null,
          classProto = lastWord && DG[ lastWord],
          componentsOfType = classProto && DG.mainPage.getComponentsOfType( classProto);
      if( iContext.allowMoreThanOne || !componentsOfType || !componentsOfType.length)
        DG.currDocumentController().createComponentAndView( null, iContext.type, iContext);
    },

  }), // mainPane

    /*
     * DG.mainPage methods
     */

    docView: SC.outlet('mainPane.scrollView.contentView')


  } // end compatible browser mainPage design

  : { // begin incompatible browser main page design
    // The main pane is made visible on screen as soon as your app is loaded.
    // Add childViews to this pane for views to display immediately on page load.
    mainPane: SC.MainPane.design({
      childViews: 'messageView'.w(),

      messageView: SC.LabelView.design({
        layout: { centerX: 0, centerY: 0, width: 400, height:300},
        controlSize: SC.LARGE_CONTROL_SIZE,
        fontWeight: SC.BOLD_WEIGHT,
        textAlign: SC.ALIGN_LEFT,
        localize: true,
        value: 'DG.mainPage.mainPane.messageView.value' // "Unfortunately, DG is not currently..."
      })
    }) // mainPane
  }; // end incompatible browser main page design
}()));

DG.mainPage.toggleCalculator = function() {
  DG.currDocumentController().
      toggleComponent( this.get('docView'), 'calcView');
};

DG.mainPage.openCaseTablesForEachContext = function () {
  DG.currDocumentController().openCaseTablesForEachContext();
};

DG.mainPage.openCaseTableForNewContext = function () {
  DG.appController.importText('new', 'new_table');
};

DG.mainPage.addMap = function() {
  DG.currDocumentController().addMap( this.get('docView'));
};

DG.mainPage.addSlider = function() {
  return DG.currDocumentController().addSlider( this.get('docView'));
};

DG.mainPage.addGraph = function() {
  return DG.currDocumentController().addGraph( this.get('docView'));
};

DG.mainPage.addText = function() {
  return DG.currDocumentController().addText( this.get('docView'));
};

DG.mainPage.addMap = function() {
  return DG.currDocumentController().addMap( this.get('docView'));
};

/* DG.mainPage.getComponentsOfType - Given the prototype class of a type of component, e.g.
  DG.SliderView, return an array containing all of those objects that are content views of
  the document.
*/
DG.mainPage.getComponentsOfType = function( aPrototype) {
  var docView = this.get('docView'),
      tComponentViews = docView && docView.get('childViews'),
      tDesiredViews = tComponentViews && tComponentViews.filter( function( aComponentView) {
            return aComponentView.contentIsInstanceOf && aComponentView.contentIsInstanceOf( aPrototype);
          });
  return tDesiredViews ? tDesiredViews.getEach('contentView') : [];
};

DG.mainPage.closeAllComponents = function() {
  this.get('docView').destroyAllChildren();
};

DG.mainPage.addGameIfNotPresent = function() {
  if( DG.mainPage.mainPane.addGame && (DG.mainPage.getComponentsOfType( DG.GameView).length === 0))
    DG.mainPage.mainPane.addGame();
  // addGameIfNotPresent() is only called on initial presentation of the document,
  // so it's a good time to synchronize the saved change count.
  DG.currDocumentController().updateSavedChangeCount();
};
