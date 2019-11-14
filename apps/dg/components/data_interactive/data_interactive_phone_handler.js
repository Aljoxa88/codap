// ==========================================================================
//                          DG.DataInteractivePhoneHandler
//
//  Copyright (c) 2016 by The Concord Consortium, Inc. All rights reserved.
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

/** @class
 *
 * The DataInteractivePhoneHandler handles inbound messages for the Data Interactive
 * API.
 *
 * @extends SC.Object
 */
DG.DataInteractivePhoneHandler = SC.Object.extend(
    /** @scope DG.DataInteractivePhoneHandler.prototype */ {

      /**
       * @type {DG.GameController}
       */
      controller: null,

      modelProps: ['version', 'dimensions',
                  'preventBringToFront', 'preventDataContextReorg', 'preventTopLevelReorg',
                  'preventAttributeDeletion', 'allowEmptyAttributeDeletion',
                  'respectEditableItemAttribute', 'subscribeToDocuments'],

      /**
       * We need to be able to set title.
       */
      view: function() {
        return this.getPath('controller.view');
      }.property(),

      // Not working in at least one circumstance having to do with interactiveFrame:update
      // idBinding: SC.Binding.oneWay('*controller.model.id'),
      id: function() {
        return this.getPath('controller.model.id');
      }.property(),

      /**
       * Handles communication over PostMessage interface.
       *
       * Set up by creator.
       *
       * @property {iframePhone.IframePhoneRpcEndpoint}
       */
      rpcEndpoint: null,

      /**
       * Whether activity has been detected on this channel.
       * @property {boolean}
       */
      connected: false,

      /**
       * Initiates a message to the Data Interactive Plugin from codap with
       * optional callback
       *
       * @param message {Object}
       * @param callback {Function} (optional)
       */
      sendMessage: function (message, callback) {
        this.rpcEndpoint.call(message, callback);
      },

      handlerMap: null,

      /**
       Initialization method
       */
      init: function () {
        sc_super();

        this.handlerMap = {
          attribute: this.handleAttribute,
          attributeLocation: this.handleAttributeLocation,
          attributeList: this.handleAttributeList,
          'case': this.handleCase,
          allCases: this.handleAllCases,
          caseByIndex: this.handleCaseByIndexOrID,
          caseByID: this.handleCaseByIndexOrID,
          caseCount: this.handleCaseCount,
          caseSearch: this.handleCaseSearch,
          collection: this.handleCollection,
          collectionList: this.handleCollectionList,
          component: this.handleComponent,
          componentList: this.handleComponentList,
          dataContext: this.handleDataContext,
          dataContextFromURL: this.handleDataContextFromURL,
          dataContextList: this.handleDataContextList,
          document: this.handleDocument,
          global: this.handleGlobal,
          globalList: this.handleGlobalList,
          item: this.handleItems,
          itemByID: this.handleItemByID,
          itemByCaseID: this.handleItemByCaseID,
          itemCount: this.handleItemCount,
          itemSearch: this.handleItemSearch,
          interactiveFrame: this.handleInteractiveFrame,
          logMessage: this.handleLogMessage,
          logMessageMonitor: this.handleLogMessageMonitor,
          selectionList: this.handleSelectionList,
          undoChangeNotice: this.handleUndoChangeNotice
        };
      },

      /**
       * Break loops
       */
      destroy: function () {
        if (this.rpcEndpoint) {
          this.rpcEndpoint.disconnect();
        }

        // filter out this instance from the log monitor list
        var self = this;
        var dataInteractiveLogMonitor = DG.currDocumentController().dataInteractiveLogMonitor;
        dataInteractiveLogMonitor.set("logMonitors", dataInteractiveLogMonitor.get("logMonitors").filter(function (logMonitor) {
          return logMonitor.iPhoneHandler !== self;
        }));

        sc_super();
      },


      /**
       * CODAP's request of DI state (for saving)
       * @param {function} callback
       */
      requestDataInteractiveState: function (callback) {
        this.sendMessage({
          action: 'get',
          resource: 'interactiveState'
        }, callback);
      },

      /**
       * A resource selector identifies a CODAP resource. It is either a group
       * resource or an individual resource. This routine parses a resource
       * selector into its component parts and builds an equivalent object.
       *
       *   * Base resources: [interactiveFrame, logMessage]
       *   * Doc resources: [dataContext, component, global]
       *   * DataContext resources: [collection, attributes]
       *   * Collection resources: [case]
       *
       *   Some examples of resource selectors:
       *    * "dataContext[DataCard]", or
       *    * "dataContext[DataCard2].collection[Measurements].attribute"
       *
       *   These would parse to objects, respectively:
       *    * {dataContext: 'DataCard', type: 'dataContext'}
       *    * {dataContext: 'DataCard2', collection: 'Measurements', attribute: null, type: 'attribute'}
       *
       * @param iResource {string}
       * @returns {{}}
       */
      parseResourceSelector: function (iResource) {
        // selects phrases like 'aaaa[bbbb]' or 'aaaa' in a larger context
        // var selectorRE = /(([\w]+)(?:\[\s*([#\w][^\]]*)\s*\])?)/g;
        var selectorRE = /(([\w]+)(?:\[\s*([^\]]+)\s*\])?)/g;
        // selects complete strings matching the pattern 'aaaa[bbbb]' or 'aaaa'
        // var clauseRE =   /^([\w]+)(?:\[\s*([^\]][^\]]*)\s*\])?$/;
        var clauseRE =   /^([\w]+)(?:\[\s*([^\]]+)\s*\])?$/;
        var result = {};
        var selectors = iResource.match(selectorRE);
        result.type = '';
        selectors.forEach(function (selector) {
          var resourceType, resourceName;
          var match = clauseRE.exec(selector);
          resourceType = match[1];
          resourceName = match[2];
          result[resourceType] = resourceName || "";
          result.type = resourceType;
        });

        return result;
      },

      /**
       *
       * @param {object} resourceSelector Return value from parseResourceSelector
       * @param {string} action           Action name: get, create, update, delete, notify
       * @returns {{interactiveFrame: DG.DataInteractivePhoneHandler}}
       */
      resolveResources: function (resourceSelector, action) {
        function serializeItem(dataSet, item) {
          if (!item) {
            return;
          }
          var ret = {};
          var values = {};
          var attrs = dataSet.get('attrs');
          attrs.forEach(function (attr) {
            values[attr.name] = item.getValue(attr.id);
          });
          ret.values = values;
          ret.id = item.id;
          return ret;
        }
        function resolveContext(selector, myContext) {
          var document = DG.currDocumentController();
          var context;

          if (SC.empty(selector)) {
            return;
          }
          if (selector === '#default') {
            context = myContext;
          } else {
            context = document.getContextByName(resourceSelector.dataContext) ||
                (!isNaN(resourceSelector.dataContext) &&
                    document.getContextByID(resourceSelector.dataContext)) || null;
          }
          return context;
        }

        var result = { interactiveFrame: this.get('controller')};
        var dataContext;
        var collection;
        var attrName, attrKey;
        var dataSet;

        if (['interactiveFrame',
              'logMessage',
              'logMessageMonitor',
              'dataContextList',
              'undoChangeNotice',
              'undoableActionPerformed',
              'component',
              'componentList',
              'document',
              'global',
              'globalList'].indexOf(resourceSelector.type) < 0) {
          // if no data context provided, and we are not creating one, the
          // default data context is implied
          if (!(resourceSelector.dataContext) ) {
            if (action !== 'create' ||
                (resourceSelector.type !== 'dataContext' &&
                resourceSelector.type !== 'dataContextFromURL')) {
              resourceSelector.dataContext = '#default';
            }
            // set a flag in the result, so we can recognize this context as special.
            result.isDefaultDataContext = true;
          }
          result.dataContext = resolveContext(resourceSelector.dataContext,
              this.getPath('controller.context'));
        }

        dataContext = result.dataContext;

        if (resourceSelector.component) {
          result.component = DG.currDocumentController().getComponentByName(resourceSelector.component) ||
              (!isNaN(resourceSelector.component) &&
                  DG.currDocumentController().getComponentByID(resourceSelector.component));
        }

        if (resourceSelector.global) {
          result.global = DG.globalsController.getGlobalValueByName(resourceSelector.global) ||
              DG.globalsController.getGlobalValueByID(resourceSelector.global);
        }

        if (resourceSelector.dataContextList != null) {
          result.dataContextList = DG.currDocumentController()
            .get('contexts')
            .map(function (context) {
              return {
                name: context.get('name'),
                guid: context.get('id'),
                title: context.get('title')
              };
            });
        }

        if (resourceSelector.collection) {
          result.collection = dataContext &&
              (dataContext.getCollectionByName(resourceSelector.collection) ||
              (!isNaN(resourceSelector.collection) &&
                  dataContext.getCollectionByID(resourceSelector.collection)));
        }

        collection = result.collection;

        if (resourceSelector.attribute || resourceSelector.attributeLocation) {
          attrKey = resourceSelector.attribute?'attribute':'attributeLocation';
          attrName = resourceSelector[attrKey];
          result[attrKey] = (
            (
              dataContext && (
                  dataContext.getAttributeByName(attrName) ||
                  dataContext.getAttributeByName(dataContext.canonicalizeName(attrName))
              )
            ) ||
            (
              !isNaN(attrName) &&
              collection && collection.getAttributeByID(attrName)
            )
          );
        }

        if (resourceSelector.caseByID) {
          result.caseByID = dataContext.getCaseByID(resourceSelector.caseByID);
        }

        if (resourceSelector.caseByIndex) {
          result.caseByIndex = collection && collection.getCaseAt(Number(resourceSelector.caseByIndex));
        }

        if (resourceSelector.caseSearch) {
          result.caseSearch = collection && collection.searchCases(resourceSelector.caseSearch);
        }

        if (resourceSelector.item) {
          dataSet = result.dataContext && result.dataContext.get('dataSet');
          result.item = dataSet && serializeItem(dataSet,
              dataSet.getDataItem(Number(resourceSelector.item)));
        }

        if (resourceSelector.itemByID) {
          dataSet = result.dataContext && result.dataContext.get('dataSet');
          result.itemByID = dataSet &&
              serializeItem(dataSet,dataSet.getDataItemByID(resourceSelector.itemByID));
        }

        if (resourceSelector.itemCount != null) {
          result.itemCount = result.dataContext && result.dataContext.get('itemCount');
        }

        if (resourceSelector.itemSearch) {
          dataSet = result.dataContext && result.dataContext.get('dataSet');
          var items = dataSet && dataSet.getItemsBySearch(resourceSelector.itemSearch);
          result.itemSearch = items && items.map(function (item) {
                                        return serializeItem(dataSet, item);
                                      });
        }

        if (resourceSelector.itemByCaseID) {
          var myCase = result.dataContext && result.dataContext.getCaseByID(resourceSelector.itemByCaseID);
          dataSet = result.dataContext && result.dataContext.get('dataSet');
          result.itemByCaseID = dataSet && myCase && serializeItem(dataSet, myCase.get('item'));
        }

        DG.ObjectMap.forEach(resourceSelector, function (key, value) {
          // Make sure we got values for every non-terminal selector.
          if (SC.none(result[key]) && (key !== 'type') && (key !== resourceSelector.type)) {
            throw (new Error('Unable to resolve %@: %@'.loc(key, value)));
            //DG.log('Unable to resolve %@: %@'.loc(key, value));
          }
        });
        return result;
      },

      /**
       * Certain properties of the values object may need to be modified; e.g. attribute
       * names will need to conform to the conventions established by the API.
       * @param iValues {Object}
       */
      validateValues: function(iDataContext, iValues) {
        if( SC.none( iValues))
          return;
        if( iValues.type === 'graph') {
          ['xAttributeName', 'yAttributeName', 'y2AttributeName', 'legendAttributeName'].forEach( function( iPropName) {
            if( !SC.none(iDataContext) && !SC.none( iValues[iPropName])) {
              iValues[ iPropName] = iDataContext.canonicalizeName( iValues[ iPropName]);
            }
          });
        }
        return iValues;
      },

      filterResultValues: function (resultValues) {
        var maxLevels = 10;
        function renameKeys (obj) {
          if (obj.guid != null) {
            obj.id = obj.guid;
          }
          return obj;
        }
        function visit(obj, level) {
          var k,v;
          if ((level < 0) ||
              (!obj) ||
              (typeof obj === 'string') ||
              (typeof obj === 'number') ||
              (typeof obj === 'boolean')) {
            return;
          }
          if (Array.isArray(obj))  {
            obj.forEach(function (o) {
              visit(o, level - 1);
            });
          } else if (typeof obj === 'object') {
            for (k in obj) {
              if (obj.hasOwnProperty(k)) {
                v = obj[k];
                visit(v, level - 1);
              }
            }
            renameKeys(obj);
          }
        }
        visit(resultValues, maxLevels);
      },
      handleOneCommand: function (iCmd) {
        var result = {success: false};
        try {
          // parse the resource name into constituent parts
          var selectorMap = iCmd.resource && this.parseResourceSelector(
              iCmd.resource);

          // resolve identified resources
          var resourceMap = this.resolveResources(selectorMap, iCmd.action);

          var action = iCmd.action;
          var type = selectorMap && selectorMap.type;
          var values = this.validateValues(resourceMap.dataContext,
              iCmd.values);
          var metadata = iCmd.meta;

          var handler = type && this.handlerMap[type];

          if (handler) {
            if (handler[action]) {
              SC.run(function () {
                try {
                  result = handler[action].call(this, resourceMap, values,
                      metadata) || {success: false};
                  if (result.values) {
                    this.filterResultValues(result.values);
                  }
                } catch (ex) {
                  DG.logWarn(ex);
                  result.values = {error: ex.toString()};
                }
              }.bind(this));
            } else {
              result.values = {
                error: 'Unsupported action: %@/%@'.loc(action, type)
              };

            }
          } else {
            DG.logWarn("Unknown message type: " + type);
            result.values = {error: "Unknown message type: " + type};
          }
        } catch (ex) {
          DG.logWarn(ex);
          result.values = {error: ex.toString()};
        }
        return result;
      },
      /**
       * Respond to requests from a Data Interactive.
       *
       * Parses the request, instantiates any named resources, finds a handler
       * and invokes it.
       *
       * @param iMessage See documentation on the github wiki: TODO
       * @param iCallback
       */
      doCommand: function (iMessage, iCallback) {
        this.setIfChanged('connected', true);
        DG.log('Handle Request: ' + JSON.stringify(iMessage));
        var result = {success: false};
        if (!SC.none(iMessage)) {
          if (Array.isArray(iMessage)) {
            result = iMessage.map(function (cmd) {
              return this.handleOneCommand(cmd);
            }.bind(this));
          } else {
            result = this.handleOneCommand(iMessage);
          }
        }
        DG.log('Returning response: ' + JSON.stringify(result));
        iCallback(result);
      },

      /**
       *     {{
       *      action: 'update'|'get'|'delete'
       *      what: {type: 'interactiveFrame'}
       *      values: { {title: {String}, version: {String}, dimensions: { width: {Number}, height: {Number} }}}
       *     }}
       * @return {object} Object should include status and values.
       */
      handleInteractiveFrame: {
        update: function (iResources, iValues) {
          var diModel = iResources.interactiveFrame.getPath('model.content');
          var diComponent = DG.currDocumentController().getComponentByID(this.get('id'));
          var diView = this.get('view');
          var title = iValues.title || iValues.name;
          var userSetTitle = iResources.interactiveFrame.getPath('model.userSetTitle');
          DG.assert(diModel, 'DataInteractiveModel  exists' );
          DG.assert(diModel.constructor === DG.DataInteractiveModel, 'model content is DataInteractiveModel');
          if (iValues) {
            if (!SC.none(title) && !userSetTitle) {
              diModel.set('title', title);
            }
            if (iValues.cannotClose != null) {
              diComponent.set('cannotClose', iValues.cannotClose);
            }

            var props = this.get('modelProps');
            props.forEach(function(prop) {
              if (iValues[prop] != null) {
                diModel.set(prop, iValues[prop]);
              }
            });
          }
          if (DG.STANDALONE_MODE && title && DG.isStandaloneComponent(title, diComponent.get('type'))) {
            DG.log('isStandalone component: ' + title);
            diView.makeStandalone();
            // if( DG.KEEP_IN_BOUNDS_PREF) {
            //
            // }
          }

          return {
            success: true
          };
        },

        get: function (iResources) {
          var diModel = iResources.interactiveFrame.getPath('model.content');
          var componentStorage = iResources.interactiveFrame.getPath('model.componentStorage');
          DG.assert(diModel, 'DataInteractiveModel  exists' );
          DG.assert(diModel.constructor === DG.DataInteractiveModel, 'model content is DataInteractiveModel');

          var tReturnValues = {};
          tReturnValues.id = this.get('id');
          tReturnValues.title = diModel.get('title');

          var props = this.get('modelProps');
          props.forEach(function(prop) {
            tReturnValues[prop] = diModel.get(prop);
          });

          // if embedded mode, set externalUndoAvailable, if standalone mode,
          // set standaloneUndoModeAvailable.
          tReturnValues.externalUndoAvailable = !DG.STANDALONE_MODE;
          tReturnValues.standaloneUndoModeAvailable = !!DG.STANDALONE_MODE;
          tReturnValues.run_remote_endpoint = DG.run_remote_endpoint || 'unknown';
          if (componentStorage) {
            DG.log('Sending data interactive, %@, state: %@'.loc(
                tReturnValues.title, JSON.stringify(componentStorage.savedGameState)));
            tReturnValues.savedState = componentStorage.savedGameState;
          }
          return {
            success: true,
            values: tReturnValues
          };
        },

        notify: function (iResources, iValues) {
          function parseDataURL(dataUri) {
            var typeToExtensionMap = {'image/png': 'png', 'image/gif': 'gif'};
            var dataUriRE = /^data:([^,]*),(.*$)/;
            var matches = dataUriRE.exec(dataUri);
            var mediaType, content, mimeType, extension;
            if (matches) {
              mediaType = matches[1];
              content = matches[2];
              mimeType = Object.keys(typeToExtensionMap).find(function (key) {
                return mediaType.startsWith(key);
              });
              if (mimeType) {
                extension = typeToExtensionMap[mimeType];
              }
            }
            return {
              mediaType: mediaType,
              content: content,
              mimeType: mimeType,
              extension: extension
            };
          }
          function handleRequest (request) {
            if (request === 'openGuideConfiguration') {
              DG.currDocumentController().configureGuide();
            }
            else if (request === 'indicateBusy') {
              DG.splash.showSplash();
            }
            else if (request === 'indicateIdle') {
              DG.splash.hideSplash();
            }
            return {success: true};
          }
          var result = {success: true};
          var imageData;
          if (iValues.dirty) {
            DG.dirtyCurrentDocument(this.controller, true);
          }
          if (iValues.image) {
            imageData = parseDataURL(iValues.image);
            if (imageData) {
              DG.exportFile(imageData.content, imageData.extension, imageData.mimeType);
            }
            else {
              result = {
                success: false,
                values: {
                  error: "Failed to parse image data uri: " + iValues.image.slice(0, 20)
                }
              };
            }
          }
          if (iValues.request) {
            result = handleRequest(iValues.request);
          }
          return result;
        },
        'delete': function (/*iResource*/) {
          DG.closeComponent(this.get('id'));
          return {success: true};
        }
      },

      /**
       * handles operations on dataContext.
       *
       * Notes:
       *
       *  * At this point only one data context for each data interactive is permitted.
       *  * Updates permit modification of top-level api properties only. That is
       *    to say, not collections. Use collection API.
       *
       * @param  iMessage {object}
       *     {{
       *      action: 'create'|'update'|'get'|'delete'
       *      what: {{type: 'context'}}
       *      values: {{name: {string}, title: {string}, description: {string}, collections: [{Object}] }}
       *     }}
       *
       */
      handleDataContext: {
        create: function (iResources, iValues) {
          var context,
              status = true,
              createSpec = DG.copy(iValues),
              resultValues = DG.clone(iValues);
          // we don't want to create the collections yet
          delete createSpec.collections;
          context = DG.currDocumentController().createNewDataContext(createSpec);
          if (iResources.isDefaultDataContext) {
            this.setPath('controller.context', context);
          }
          // create the collections
          if (resultValues.collections) {
            resultValues.collections.forEach(function (collectionSpec) {
              var collectionClient,
                  parentCollectionClient,
                  error = false;

              // map requested names to valid names
              if (collectionSpec.attrs) {
                collectionSpec.attrs.forEach(function(attr) {
                  // original name and new name will be returned to client
                  attr.clientName = attr.name;
                  attr.name = context.canonicalizeName(attr.name);
                });
              }

              createSpec = DG.clone(collectionSpec);

              if (createSpec.parent) {
                parentCollectionClient = context.getCollectionByName(createSpec.parent);

                if (parentCollectionClient) {
                  createSpec.parent = parentCollectionClient.collection;
                } else {
                  DG.log( 'Attempt to create collection "%@": Unknown parent: "%@"'
                          .loc(createSpec.name, createSpec.parent));
                  error = true;
                }
              }
              if (!error) {
                collectionClient = context.createCollection(createSpec);

                // return id for created collection
                collectionSpec.id = collectionClient && collectionClient.get('id');

                if (collectionClient && collectionSpec.attrs) {
                  // return id for each created attribute
                  collectionSpec.attrs.forEach(function(attrSpec) {
                    var attr = collectionClient.getAttributeByName(attrSpec.name);
                    attrSpec.id = attr && attr.get('id');
                  });
                }
              }
              status = status && !SC.none(collectionClient);
            });
          }
          return {
            success: status,
            values: {
              name: context.get('name'),
              id: context.get('id'),
              title: context.get('title')
            }
          };
        },

        update: function (iResources, iValues) {
          var context = iResources.dataContext;
          if (context) {
            ['managingController', 'title', 'description', 'preventReorg']
              .forEach(function (prop) {
                if (!SC.none(iValues[prop])) {
                  context.set(prop, iValues[prop]);
                }
              });
          }
          return {
            success: true
          };
        },

        get: function (iResources, iValues) {
          var context = iResources.dataContext;
          var values;
          if (context) {
            values = context.get('model').toArchive(true, true/*omit cases*/);
          }
          return {
            success: !SC.none(values),
            values: values
          };
        },

        'delete': function (iResources, iValues) {
          var context = iResources.dataContext;
          var documentController = DG.currDocumentController();
          if (context) {
            documentController.destroyDataContext(context.get('id'));
            return {
              success: true
            };
          } else {
            return {
              success: false,
              values: {
                error: 'Could not find dataContext'
              }
            };
          }
        }
      },

      /**
       * handles creation of a dataContext by reading in a URL.
       *
       * @param  iMessage {object}
       *     {{
       *      action: 'create'
       *      resource: 'dataContextFromURL'
       *      values: {URL: {string}}
       *     }}
       *
       */
      handleDataContextFromURL: {
        create: function (iResources, iValues) {
          var tURL;
          var status = true;
          if (iValues.URL) {
            tURL = iValues.URL;
            delete iValues.URL;
            DG.appController.importTextFromUrl( tURL, false /* Don't show case table */);
          }
          return {
            success: status
          };
        }
      },

      /**
       * handles list operations on dataContext.
       *
       * Notes:
       *
       *  * At this point only one data context for each data interactive is permitted.
       *  * Updates permit modification of top-level api properties only. That is
       *    to say, not collections. Use collection API.
       *
       * @param  iMessage {object}
       *     {{
       *      action: 'get'
       *      what: {{type: 'context'}}
       *      values: {{name: {string}, title: {string}, description: {string}, collections: [{Object}] }}
       *     }}
       *
       */
      handleDataContextList: {
        get: function (iResources) {
          var success = (iResources.dataContextList != null);
          return success ? { success: true, values: iResources.dataContextList } : { success: false };
        }
      },

      /**
       * handles operations on collections.
       *
       * Notes:
       *   * Parent collection must be created before the child collection.
       *   * Parent collection can have at most one child collection.
       *
       * @param  iMessage {object}
       *     {{
       *      action: 'create'|'update'|'get'|'delete'
       *      what: {{type: 'collection', context: {String}, collection: {String}}
       *      values: {{
       *        name: {string},
       *        title: {string},
       *        description: {string},
       *        parent: {string},
       *        attribute: [{Object}],
       *        labels: [{Object}] }}
       *     }}
       *
       */
      handleCollection: {
        get: function (iResources) {
          if (!iResources.collection) {
            return {success: false, values: {error: 'Collection not found'}};
          }
          var model = iResources.collection.get('collection');
          var values = model.toArchive(true/*excludeCases*/);
          return {
            success: true,
            values: values
          };
        },
        create: function (iResources, iValues) {
          // returns a collection for the appropriate parent name, if any.
          function mapParent (context, parentName) {
            var parentKey;
            var collections;
            var collection;

            if (SC.none(parentName)) {
              collections = context.get('collections');
              if (collections && collections.length > 0) {
                parentKey = collections[collections.length - 1].get('id');
              }
            } else if (typeof parentName === 'number') {
              parentKey = parentName;
            } else if (parentName === '_root_') {
              parentKey = null;
            } else {
              collection = context.getCollectionByName(parentName);
              parentKey = collection ? collection.get('id') : null;
            }
            return (!SC.none(parentKey))? context.getCollectionByID(parentKey).collection: null;
          }

          // returns a success indicator and ids.
          function createOneCollection(iContext, iCollectionSpec, iRequester) {
            var change = {
              operation: 'createCollection',
              properties: iCollectionSpec,
              attributes: ( iCollectionSpec && iCollectionSpec.attributes ),
              requester: iRequester.get('id')
            };
            iCollectionSpec.parent = mapParent(iContext, iCollectionSpec.parent);
            var changeResult = iContext.applyChange(change);
            var success = (changeResult && changeResult.success);
            var ids = changeResult.collection && {
                  id: changeResult.collection.get('id'),
                  name: changeResult.collection.get('name')
                };
            return {
              success: success,
              values: ids
            };
          }

          var context = iResources.dataContext;
          var success = true;
          var collectionIdentifiers = [];

          if (!context) {
            return {success: false, values: {error: "no context"}};
          }

          if (!Array.isArray(iValues)) {
            iValues = [iValues];
          }

          iValues.every(function (iCollectionSpec) {
            var rslt = createOneCollection(context, iCollectionSpec, this);
            success = success && rslt.success;
            if (success) {
            collectionIdentifiers.push(rslt.values);
            }
            return success;
          }.bind(this));

          return {success: success, values: collectionIdentifiers};
        },
        update: function (iResources, iValues) {
          if (!iResources.collection) {
            return {success: false, values: {error: 'Collection not found'}};
          }

          var context = iResources.dataContext;
          var change = {
            operation: 'updateCollection',
            collection: iResources.collection,
            properties: iValues,
            requester: this.get('id')
          };
          var changeResult = context.applyChange(change);
          var success = (changeResult && changeResult.success) || success;
          return {
            success: success,
          };
        },
        'delete': function (iResources) {
          var context = iResources.dataContext;
          var collection = iResources.collection;

          if (!collection) {
            return {success: false, values: {error: 'Collection not found'}};
          }

          return context.applyChange({
            operation: 'deleteCollection',
            collection: collection,
            requester: this.get('id')
          });
        }
      },

      /**
       * handles operations on collection Lists.
       *
       * Notes:
       *   * List is in order of parentage, highest ancestor first, ultimate
       *     descendant last.
       *
       * @param  iMessage {object}
       *     {{
       *      action: 'get'
       *      what: {type: 'collection', context: {String}}
       *      }}
       * @return {object}
       *   {{
       *      success: {boolean}
       *      values: {
       *        name: {string},
       *        title: {string},
       *        guid: {number}
       *      }
       *     }}
       *
       */
      handleCollectionList: {
        get: function (iResources) {
          var context = iResources.dataContext;
          var values = context.get('collections').map(function (collection) {
            return {
              name: collection.get('name'),
              guid: collection.get('id'),
              title: collection.get('title')
            };
          });
          return {
            success: true,
            values: values
          };
        }
      },

      /**
       * handles operations on attributes.
       *
       * @param  iMessage {object}
       *     {{
       *        action: 'create'|'update'|'get'|'delete'
       *        what: {{type: 'attribute', context: {name}, collection: {string}, attribute: {string}}
       *        values: {[object]|object}
       *      }}
       *
       */
      handleAttribute: (function() {

        function applyChangeAndProcessResult(context, change, metadata) {
          if (metadata && metadata.dirtyDocument === false)
            change.dirtyDocument = false;
          var changeResult = context.applyChange(change),
              resultAttrs = changeResult && changeResult.attrs,
              returnAttrs = DG.DataInteractiveUtils.
                              mapAttributeProperties(resultAttrs, change.attrPropsArray),
              returnResult = { success: changeResult && changeResult.success };
          if (returnAttrs)
            returnResult.values = { attrs: returnAttrs };
          return returnResult;
        }

      return {
        get: function (iResources) {
          var attribute = iResources.attribute;
          var values;
          if (!attribute) {
            return {success: false, values: {error: 'Attribute not found'}};
          }
          values = attribute.toArchive();
          return {
            success: true,
            values: values
          };
        },
        create: function (iResources, iValues, iMetadata) {
          if (!iResources.dataContext) {
            return {success: false, values: {error: "no context"}};
          }
          if (!iResources.collection) {
            return {success: false, values: {error: 'Collection not found'}};
          }
          var context = iResources.dataContext;
          var attrSpecs = SC.clone(Array.isArray(iValues) ? iValues : [iValues]);
          if (attrSpecs.some(function(spec) { return !spec.name; })) {
            return {success: false, values: {error: "Create attribute: name required"}};
          }
          attrSpecs.forEach(function(attrSpec) {
            attrSpec.clientName = attrSpec.name;
            attrSpec.name = context.canonicalizeName(attrSpec.name);
          });
          var change = {
            operation: 'createAttributes',
            collection: iResources.collection,
            attrPropsArray: attrSpecs,
            requester: this.get('id')
          };
          return applyChangeAndProcessResult(context, change, iMetadata);
        },
        update: function (iResources, iValues, iMetadata) {
          var context = iResources.dataContext;
          if (!iResources.collection) {
            return {success: false, values: {error: 'Collection not found'}};
          }
          if (!iResources.attribute) {
            return {success: false, values: {error: 'Attribute not found'}};
          }
          if (!iValues.id && iResources.attribute.id)
            iValues.id = iResources.attribute.id;
          if (!iValues.name && iResources.attribute.name)
            iValues.name = iResources.attribute.name;
          else if (iValues.name) {
            iValues.clientName = iValues.name;
            iValues.name = context.canonicalizeName(iValues.name);
          }
          var change = {
            operation: 'updateAttributes',
            collection: iResources.collection,
            attrPropsArray: [iValues],
            requester: this.get('id')
          };
          return applyChangeAndProcessResult(context, change, iMetadata);
        },
        'delete': function (iResources, iValues, iMetadata) {
          var context = iResources.dataContext;
          var change = {
            operation: 'deleteAttributes',
            collection: iResources.collection,
            attrs: [iResources.attribute],
            requester: this.get('id')
          };
          if (iMetadata && iMetadata.dirtyDocument === false) {
            change.dirtyDocument = false;
          }
          var changeResult = context.applyChange(change);
          var success = (changeResult && changeResult.success);
          return {
            success: success,
          };
        }
      }; }()),

      handleAttributeLocation: {
        /*
         * Binds an attribute to a new collection in the data set. This
         * is equivalent to the data context attributeMove action.
         */
        update: function (iResources, iValues, iMetadata) {
          var context = iResources.dataContext;
          if (!context) {
            return {
                success: false,
                values: {error: 'context not found'}
              };
          }
          var change = {
            operation: 'moveAttribute',
            requester: this.get('id'),
            attr: iResources.attributeLocation,
          };
          if (iValues && !SC.none(iValues.collection)) {
            change.toCollection = context.getCollectionByName(iValues.collection) ||
                    context.getCollectionByID(iValues.collection);
            if (!change.toCollection) {
              return {
                success: false,
                values: {error: 'Target collection not found'}
              };
            }
          }
          if (iValues && !SC.none(iValues.position)) {
            change.position = iValues.position;
          }
          return context.applyChange(change);
        }
      },
      handleAttributeList: {
        get: function (iResources) {
          var collection = iResources.collection;
          var values = [];
          if (!collection) {
            return {success: false, values: {error: 'Collection not found'}};
          }

          collection.forEachAttribute(function (attr) {
            var value = {
              id: attr.get('id'),
              name: attr.get('name'),
              title: attr.get('title')
            };
            values.push(value);
          });
          return {
            success: true,
            values: values
          };
        }
      },

      handleCase: {
        create: function (iResources, iValues) {

          function convertDate( iValue) {
            if (iValue instanceof Date) {
              iValue.valueOf = function () {
                return Date.prototype.valueOf.apply(this) / 1000;
              };
            }
          }

          function fixDates(iCase) {
            if( Array.isArray( iCase.values)) {
              iCase.values.forEach(function (iValue) {
                convertDate( iValue);
              });
            }
            else if ( typeof iCase.values === 'object') {
              DG.ObjectMap.forEach( iCase.values, function( iKey, iValue) {
                convertDate( iValue);
              });
            }
          }

          function createOrAppendRequest(iCase) {
            fixDates(iCase);
            var parent = iCase.parent;
            var values = iCase.values;
            var req = requests.find(function (request) {
              return request.properties.parent === parent;
            });
            if (!req) {
              req = {
                operation: 'createCases',
                collection: collection,
                properties: {
                  parent: parent
                },
                values: [],
                requester: requester
              };
              requests.push(req);
            }
            req.values.push(values);
          }
          if (!iResources.collection) {
            return {success: false, values: {error: 'Collection not found'}};
          }

          var success = true;
          var context = iResources.dataContext;
          var collection = iResources.collection;
          var cases = Array.isArray(iValues)?iValues: [iValues];
          var IDs = [];
          var requester = this.get('id');
          var requests = [];

          // We wish to minimize the number of change requests submitted,
          // but create case change requests are not structured like cases.
          // we must reformat the Plugin API create/case to some number of
          // change requests, one for each parent referred to in the create/case
          // object.
          cases.forEach(createOrAppendRequest);
          requests.forEach(function (req) {
            var changeResult = context.applyChange(req);
            var success = success && (changeResult && changeResult.success);
            var index;
            if (changeResult.success) {
              for (index = 0; index < changeResult.caseIDs.length; index++) {
                var caseid = changeResult.caseIDs[index];
                var itemid = (index <= changeResult.itemIDs.length) ? changeResult.itemIDs[index] : null;
                IDs.push({id: caseid, itemID: itemid});
              }
            }
          });
          return {success: success, values: IDs};
        }
      },

      handleAllCases: {
        get: function (iResources) {
          var context = iResources.dataContext;
          var collection = iResources.collection;
          if (!context || !collection) {
            return {
              success: false
            };
          }

          var serializeCase = function (iCase) {
            var caseValues = {};
            collection.forEachAttribute(function (attr) {
              caseValues[attr.name] = iCase.getValue(attr.id);
            });
            return {
              'case': {
                id: iCase.id,
                parent: (iCase.parent && iCase.parent.id),
                children: iCase.children.map(function (child) {return child.id;}),
                values: caseValues
              },
              caseIndex: collection.getCaseIndexByID(iCase.get('id'))
            };
          }.bind(this);

          return {
            success: true,
            values: {
              collection: {
                name: collection.get('name'),
                id: collection.get('id')
              },
              cases: collection.get('casesController').map(serializeCase)
            }
          };
        },

        'delete': function (iResources) {
          var context = iResources.dataContext;
          var success = false;
          var changeResult, cases;
          if (context) {
            cases = context.get('allCases');
            changeResult = context.applyChange({
              operation: 'deleteCases',
              cases: cases,
              values: [],
              requester: this.get('id')
            });
            success = (changeResult && changeResult.success);
          }
          return {
            success: success
          };
        }
      },

      /**
       * Utility function to create a serializable representation of the case
       * for return to the data interactive
       * @param iCollection
       * @param iCase
       * @returns {{id: *, guid: *, parent: *, values: {}}}
       */
      makeSerializableCase: function (iCollection, iCase) {
        var values = {};
        iCollection.forEachAttribute(function (attr) {
          values[attr.name] = iCase.getValue(attr.id);
        });
        return  {
          id: iCase.id,
          parent: (iCase.parent && iCase.parent.id),
          collection: {
            name: iCollection.get('name'),
            id: iCollection.get('id')
          },
          values: values
        };
      },

      handleCaseByIndexOrID: {
        get: function (iResources) {
          function getCollectionClientFromCase(myCase, dataContext) {
            var collection = myCase.get('collection');
            var id = collection.get('id');
            return dataContext.getCollectionByID(id);
          }
          var dataContext = iResources.dataContext;
          var myCase = iResources.caseByIndex || iResources.caseByID;
          var collection = iResources.collection || getCollectionClientFromCase(myCase, dataContext);
          var values;
          if (myCase) {
            values = {
              'case': this.makeSerializableCase(collection, myCase),
              caseIndex: collection.getCaseIndexByID(myCase.get('id'))
            };
            values['case'].children = myCase.children.map(function (child) {return child.id;});
          }
          return {
            success: !SC.none(values),
            values: values
          };
        },
        notify: function (iResources, iValues) {
          if (!iResources.collection) {
            return {success: false, values: {error: 'Collection not found'}};
          }
          if (!(iResources.caseByID || iResources.caseByIndex)) {
            return {success: false, values: {error: 'Case not found'}};
          }

          var context = iResources.dataContext;
          var collection = iResources.collection;
          var theCase = iResources.caseByIndex || iResources.caseByID;
          var success = false;
          var changeResult;
          if (collection && theCase && iValues && iValues.caseOrder) {
            changeResult = context.applyChange({
              operation: 'moveCases',
              collection: collection,
              cases: [theCase],
              caseOrder: iValues.caseOrder,
              requester: this.get('id')
            });
            success = (changeResult && changeResult.success);
          }
          return {
            success: success
          };
        },
        update: function (iResources, iValues) {
          if (!iResources.collection) {
            return {success: false, values: {error: 'Collection not found'}};
          }
          if (!(iResources.caseByID || iResources.caseByIndex)) {
            return {success: false, values: {error: 'Case not found'}};
          }

          var context = iResources.dataContext;
          var collection = iResources.collection;
          var theCase = iResources.caseByIndex || iResources.caseByID;
          var success = false;
          var changeResult;
          if (collection && theCase && iValues && iValues.values) {
            changeResult = context.applyChange({
              operation: 'updateCases',
              collection: collection,
              cases: [theCase],
              values: [iValues.values],
              requester: this.get('id')
            });
            success = (changeResult && changeResult.success);
          }
          return {
            success: success
          };
        },
        'delete': function (iResources) {
          var context = iResources.dataContext;
          var collection = iResources.collection;
          var theCase = iResources.caseByIndex || iResources.caseByID;
          var success = false;
          var changeResult;
          if (collection && theCase) {
            changeResult = context.applyChange({
              operation: 'deleteCases',
              collection: collection,
              cases: [theCase],
              values: [],
              requester: this.get('id')
            });
            success = (changeResult && changeResult.success);
          }
          return {
            success: success
          };
        }
      },

      handleCaseCount: {
        get: function (iResources) {
          if (!iResources.collection) {
            return {success: false, values: {error: 'Collection not found'}};
          }

          var count = iResources.collection.casesController.length();
          return {
            success: true,
            values: count
          };
        }
      },

      handleCaseSearch: {
        get: function (iResources) {
          if (!iResources.collection) {
            return {success: false, values: {error: 'Collection not found'}};
          }
          var success = (iResources.caseSearch != null),
              cases = [];

          if (success) {
            cases = iResources.caseSearch.map(function (iCase) {
              return this.makeSerializableCase(iResources.collection, iCase);
            }.bind(this));
          }
          return {
            success: success,
            values: cases
          };
        }
      },

      handleItems: {
        get: function (iResources) {
          var success = (iResources.item != null),
              item;

          if (success) {
            item = iResources.item;
          }
          return {
            success: success,
            values: item
          };
        },

        create: function (iResources, iValues) {
          var context = iResources.dataContext;
          var result;
          if (context) {
            result = context.applyChange({
              operation: 'createItems',
              items: iValues,
              requester: this.get('id')
            });
            return result;
          }
          return {success: false};
        },
        'update': function (iResources, iValues) {
          var item = iResources.item;
          var context = iResources.dataContext;
          var createdCaseIDs, deletedCaseIDs, caseChanges;
          if (item != null) {
            caseChanges = context.applyChange({
              operation: 'updateItems',
              items: {id: item.id, values: iValues},
              requester: this.get('id')
            });
            if (caseChanges) {
              createdCaseIDs = caseChanges.createdCases?
                  caseChanges.createdCases.map(function (iCase) {return iCase.id; }):
                  [];
              deletedCaseIDs = caseChanges.deletedCases?
                  caseChanges.deletedCases.map(function (iCase) {return iCase.id; }):
                  [];
              return {
                success: true,
                values: {
                  createdCases: createdCaseIDs,
                  deletedCases: deletedCaseIDs
                }
              };
            }
          } else {
            return { success: false, values: {error: "item not found"}};
          }
        }

      },

      handleItemSearch: {
        get: function (iResources) {
          var success = (iResources.itemSearch != null),
              items = [];

          if (success) {
            items = iResources.itemSearch;
          }
          return {
            success: success,
            values: items
          };
        },
        'delete': function (iResources) {
          var items = iResources.itemSearch;
          var context = iResources.dataContext;
          var deletedItems;
          if (context && (items != null)) {
            context.applyChange({
              operation: 'deleteItems',
              items: items,
              requester: this.get('id')
            });
            deletedItems = context.deleteItems(items);
            if (deletedItems) {
              return {success: true, values: deletedItems && deletedItems.map(function (item) {return item.id;})};
            }
          }
          return {success: false};
        },
        notify: function (iResources, iValues) {
          var items = iResources.itemSearch;
          var context = iResources.dataContext;
          if (context && (items != null) && iValues.itemOrder) {
            context.applyChange({
              operation: 'moveItems',
              items: items,
              itemOrder: iValues.itemOrder,
              requester: this.get('id')
            });
            return {success: true};
          }
          return {success: false};
        }
      },

      handleItemByID:{
        get: function (iResources) {
          var success = (iResources.itemByID != null),
              item;

          if (success) {
            item = iResources.itemByID;
          }
          return {
            success: success,
            values: item
          };
        },

        'update': function (iResources, iValues) {
          var item = iResources.itemByID;
          // var itemID = item && item.id;
          // var newValues = item.values;
          var context = iResources.dataContext;
          var createdCaseIDs, deletedCaseIDs, caseChanges;
          if (item != null) {
            caseChanges = context.applyChange({
              operation: 'updateItems',
              items: {id: item.id, values: iValues},
              requester: this.get('id')
            });
            if (caseChanges) {
              createdCaseIDs = caseChanges.createdCases? caseChanges.createdCases.map(function (iCase) {return iCase.id; }): [];
              deletedCaseIDs = caseChanges.deletedCases? caseChanges.deletedCases.map(function (iCase) {return iCase.id; }): [];
              return {
                success: true,
                values: {
                  createdCases: createdCaseIDs,
                  deletedCases: deletedCaseIDs
                }
              };
            }
          } else {
            return { success: false, values: {error: "item not found"}};
          }
        },

        'delete': function (iResources) {
          var context = iResources.dataContext;
          var item = iResources.itemByID;
          var dataSet = context && context.get('dataSet');
          // DataContext/deleteItems expects actual SC.Items
          var scItem = dataSet && dataSet.getDataItemByID(item.id);
          var items = [scItem];
          var success = (scItem != null);
          var deletedItems;
          if (success) {
            context.applyChange({
              operation: 'deleteItems',
              items: items,
              requester: this.get('id')
            });
            deletedItems = context.deleteItems(items);
            if (deletedItems) {
              return {success: true, values: deletedItems && deletedItems.map(function (item) {return item.id;})};
            }
          } else {
            return {success: success};
          }
        }

      },
      handleItemByCaseID: {
        get: function (iResources) {
          var success = (iResources.itemByCaseID != null),
              items = [];

          if (success) {
            items = iResources.itemByCaseID;
          }
          return {
            success: success,
            values: items
          };
        },

        'update': function (iResources, iValues) {
          var item = iResources.itemByCaseID;
          // var itemID = item && item.id;
          // var newValues = item.values;
          var context = iResources.dataContext;
          var createdCaseIDs, deletedCaseIDs, caseChanges;
          if (item != null) {
            caseChanges = context.applyChange({
              operation: 'updateItems',
              items: {id: item.id, values: iValues},
              requester: this.get('id')
            });
            if (caseChanges) {
              createdCaseIDs = caseChanges.createdCases? caseChanges.createdCases.map(function (iCase) {return iCase.id; }): [];
              deletedCaseIDs = caseChanges.deletedCases? caseChanges.deletedCases.map(function (iCase) {return iCase.id; }): [];
              return {
                success: true,
                values: {
                  createdCases: createdCaseIDs,
                  deletedCases: deletedCaseIDs
                }
              };
            }
          } else {
            return { success: false, values: {error: "item not found"}};
          }
        },

        'delete': function (iResources) {
          var item = iResources.itemByCaseID;
          var items = [item];
          var context = iResources.dataContext;
          var success = (item != null);
          var deletedItems;
          if (success) {
            context.applyChange({
              operation: 'deleteItems',
              items: items,
              requester: this.get('id')
            });
            deletedItems = context.deleteItems(items);
            if (deletedItems) {
              return {success: true, values: deletedItems && deletedItems.map(function (item) {return item.id;})};
            }
          } else {
            return {success: success};
          }
        }
      },

      handleItemCount: {
        get: function (iResources) {
          var success = (iResources.itemCount != null);
          return success ? { success: true, values: iResources.itemCount } : { success: false };
        }
      },

      handleSelectionList: {
        /**
         * Returns an array containing ids of selected cases. If collection is
         * provided, will filter the list to members of the collection.
         * @param iResources
         * @returns {{success: boolean, values: *}}
         */
        get: function (iResources) {
          var context = iResources.dataContext;
          var collection = iResources.collection;
          var values = context && context.getSelectedCases().filter(function(iCase) {
            // if we specified a collection in the get, filter by it
            return (!collection || collection === iCase.collection);
          }).map(function (iCase) {
            var collectionID = iCase.getPath('collection.id');
            var collectionName = context.getCollectionByID(collectionID).get('name');
            return {
              collectionID: collectionID,
              collectionName: collectionName,
              caseID: iCase.get('id')
            };
          });
          if (!values) {
            return {success: false, values: {error: 'Unknown context.'}};
          }
          return {
            success: true,
            values: values
          };
        },
        /**
         * Creates a selection list in this context. The values provided will
         * replace the current selection list. Values are a array of case ids.
         * @param {object} iResources
         * @param {[number]} iValues
         * @returns {{success: boolean}}
         */
        create: function (iResources, iValues) {
          if (!iResources.dataContext) {
            return {success: false, values: {error: 'Unknown context.'}};
          }
          return this.doSelect(iResources, iValues, false);
        },
        /**
         * Updates a selection list in this context. The values provided will
         * amend the current selection list. Values are a array of case ids.
         * @param {object}iResources
         * @param {[number]} iValues
         * @returns {{success: boolean}}
         */
        update: function (iResources, iValues) {
          if (!iResources.dataContext) {
            return {success: false, values: {error: 'Unknown context.'}};
          }
          return this.doSelect(iResources, iValues, true);
        },
      },

      /**
       * Utility to initiate a select action in a data context.
       * @param {object} iResources
       * @param {[number]} iValues
       * @param {boolean} extend
       * @returns {{success: (*|boolean)}}
       */
      doSelect: function (iResources, iValues, extend) {
        var context = iResources.dataContext;
        var collection = iResources.collection;
        var cases;
        if (collection) {
          cases = iValues.map(function (caseID) {
            return collection.getCaseByID(caseID);
          }).filter(function (iCase) {return !!iCase; });
        } else {
          cases = iValues.map(function (caseID) {
            return context.getCaseByID(caseID);
          }).filter(function (iCase) {return !!iCase; });
        }
        var result = context.applyChange({
          operation: 'selectCases',
          collection: collection,
          cases: cases,
          select: true,
          extend: extend,
          requester: this.get('id')
        });
        return result;
      },

      handleComponent: (function () {
        // map CODAP Component types to DI-API component types
        var kTypeMap = {
          'DG.Calculator': 'calculator',
          'DG.TableView': 'caseTable',
          'DG.GameView': 'game',
          'DG.GraphView': 'graph',
          'DG.GuideView': 'guideView',
          'DG.MapView': 'map',
          'DG.SliderView': 'slider',
          'DG.TextView': 'text',
          'DG.WebView': 'webView'
        };

        // map DI-API component types to CODAP Component types
        var kResourceMap = {
          'calculator': 'DG.Calculator',
          'caseTable': 'DG.TableView',
          'game': 'DG.GameView',
          'graph': 'DG.GraphView',
          'guideView': 'DG.GuideView',
          'map': 'DG.MapView',
          'slider': 'DG.SliderView',
          'text': 'DG.TextView',
          'webView': 'DG.WebView'
        };

        var directMapping = function (key, value) {
          return {key: key, value: value};
        };

        var kComponentTypeDefaults = {
          slider: {
            dimensions: { width: 300, height: 98 }
          },
          caseTable: {
            dimensions: {width: 500, height: 200}
          }
        };

        // correspondence of DI-API properties to ComponentStorage properties.
        //
        // Direct means a one-to-one mapping.
        var kComponentStorageProperties = {
          calculator: {
            name: directMapping,
            title: directMapping,
            cannotClose: directMapping
          },
          caseTable: {
            name: directMapping,
            title: directMapping,
            cannotClose: directMapping
          },
          game: {
            currentGameName: function (key, value) {
              return {key: 'name', value: value};
            },
            currentGameUrl: function (key, value) {
              return {key: 'URL', value: value};
            },
            name: function (key, value) {
              return {key: 'currentGameName', value: value};
            },
            title: directMapping,
            URL: function (key, value) {
              return {key: 'currentGameUrl', value: value};
            },
            cannotClose: directMapping,
            isVisible: directMapping
          },
          graph: {
            name: directMapping,
            title: directMapping,
            dataContext: function (key, value) {
              var v;
              if (value) {
                v = (typeof value === 'string') ? DG.currDocumentController().getContextByName(
                    value) : value.get('name');
              }
              return {
                key: key,
                value: v
              };
            },
            xAttributeName: directMapping,
            yAttributeName: directMapping,
            y2AttributeName: directMapping,
            legendAttributeName: directMapping,
            enableNumberToggle: directMapping,
            numberToggleLastMode: directMapping,
            cannotClose: directMapping
          },
          guideView: {
            name: directMapping,
            title: directMapping,
            cannotClose: directMapping,
            items: directMapping,
            currentItemIndex: directMapping,
            isVisible: directMapping
          },
          map: {
            name: directMapping,
            title: directMapping,
            // todo: need more information than key/value to resolve
            // todo: can the component constructor resolve?
            legendAttributeName: directMapping,
            // todo: is this necessary? Will the map constructor be attentive to this?
            dataContextName: function (key, value) {
              return {key: 'context', value: DG.currDocumentController().getContextByName(value)};
            },
            context: function (key, value) {
              return {key: 'dataContextName', value: value.get('name')};
            },
            cannotClose: directMapping
          },
          slider: {
            animationDirection: directMapping,
            animationMode: directMapping,
            // todo: does slider construct global or is it expected to exist before?
            globalValueName: directMapping,
            lowerBound: directMapping,
            name: directMapping,
            title: directMapping,
            upperBound: directMapping,
            value: directMapping,
            cannotClose: directMapping
          },
          text: {
            name: directMapping,
            text: directMapping,
            title: directMapping,
            cannotClose: directMapping
          },
          webView: {
            name: directMapping,
            title: directMapping,
            URL: directMapping,
            cannotClose: directMapping
          }
        };

        function remapProperties(from, to, componentType) {
          var mapping = kComponentStorageProperties[componentType];
          if (!mapping) {
            return;
          }
          Object.keys(from).forEach(function (key) {
            var mappingType = mapping[key];
            var m;
            if (typeof mappingType === 'function') {
              m = mappingType(key, from[key]);
              if (to.set) {
                to.set(m.key, m.value);
              } else {
                to[m.key] = m.value;
              }
            }
          });
        }

        function mapTableLinkPropertiesFromDI(iIn, iOut) {
          var document = DG.currDocumentController();
          var context = iIn.dataContext && document.getContextByName(iIn.dataContext);
          if (context) {
            DG.ArchiveUtils.addLink(iOut, 'context', context);
          }
        }

        return {
          create: function (iResource, iValues) {
            var doc = DG.currDocumentController();
            var type = iValues.type;
            var typeClass = type && kResourceMap[type];
            // apply defaults
            var tValues = Object.assign({}, kComponentTypeDefaults[type] || {}, iValues);
            // We are going to construct props. Props is structured like a
            // a component definition in a document
            var props = {
              componentStorage: {}
            };
            // var name = iValues.name || iValues.title;
            var success = true;
            var component, errorMessage,global;

            // if (SC.none(name)) {
            //   success = false;
            //   errorMessage = "Components must have a name";
            // }

            if (SC.none(typeClass)) {
              success = false;
              errorMessage = 'Unknown component type: ' + type;
            }

            // If we have a valid type ...
            if (success) {
              props.document = doc;
              props.type = typeClass;
              // the allowMoreThanOne=false restriction is historical. It prevented
              // proliferation of components when a document was repeatedly opened
              // we default to allowing any number. It is a DI's responsibility
              // to avoid proliferation.
              props.allowMoreThanOne = true;

              // construct the layout object
              props.layout = {};
              if (tValues.dimensions) {
                props.layout = Object.assign(props.layout, tValues.dimensions);
              }
              if (tValues.position) {
                if (typeof tValues.position === 'string') {
                  props.position = tValues.position;
                } else if (typeof tValues.position === 'object') {
                  props.layout = Object.assign(props.layout, tValues.position);
                }
              }

              // copy those properties that can be handled by simple remap
              remapProperties(tValues, props.componentStorage, type);

              var tableDataContext;
              if (tValues.type === 'caseTable') {
                mapTableLinkPropertiesFromDI(tValues, props.componentStorage);
                if (tValues.dataContext)
                  tableDataContext = DG.currDocumentController().getContextByName(tValues.dataContext);
              }
              // tables with data contexts
              if ((tValues.type === 'caseTable') && tableDataContext) {
                DG.appController.showCaseDisplayFor(tableDataContext);
              }
              // sliders with global values
              else if ((tValues.type === 'slider') && tValues.globalValueName) {
                global = DG.globalsController.getGlobalValueByName(tValues.globalValueName);
                if (global) {
                  DG.ArchiveUtils.addLink(props.componentStorage, "model", global);
                  component = DG.currDocumentController().createComponentAndView(DG.Component.createComponent(props));
                  errorMessage = !component && 'Component creation failed';
                } else {
                  errorMessage = "Global not found: '%@'".loc(tValues.globalValueName);
                }
              }
              // all other components
              else {
                component = DG.currDocumentController().createComponentAndView(DG.Component.createComponent(props));
                errorMessage = !component && 'Component creation failed';
              }
            }

            if (success && component) {
              return {
                success: true,
                values: {
                  id: component.getPath('model.id'),
                  name: component.getPath('model.name'),
                  title: component.get('title'),
                  type: type
                }
              };
            } else {
              return {
                success: false,
                values: {
                  error: errorMessage || 'Unknown error'
                }
              };
            }
          },

          notify: function (iResources, iValues) {
            if (!iResources.component || iResources.component.get(
                'isDestroyed')) {
              return {success: false, values: {error: 'Component not found'}};
            }
            var component = iResources.component;
            var componentController = DG.currDocumentController().componentControllersMap[component.get('id')];
            var view = componentController && componentController.get('view');
            if (!view) {
              return {success: false, values: {error: 'Cannot find component view'}};
            }
            if (iValues.request) {
              if (iValues.request === 'select') {
                view.select();
              } else if (iValues.request === 'autoScale') {
                if (componentController && componentController.rescaleFunction) {
                  componentController.rescaleFunction();
                }
                else if (componentController && componentController.resizeColumns) {
                  componentController.resizeColumns();
                }
                else {
                  return {success: false, values: {error: 'Component does not support rescale'}};
                }
              }
            }

            return {
              success: true
            };
          },

          update: function (iResources, iValues) {
            if (!iResources.component || iResources.component.get(
                'isDestroyed')) {
              return {success: false, values: {error: 'Component not found'}};
            }

            var component = iResources.component,
                componentType = component && component.get('type'),
                codapType = componentType && kTypeMap[componentType],
                componentContent = DG.Component.getContent(component), position,
                dimensions, remapped = {};

            if (!component) {
              return {success: false, values: {error: 'Cannot find component'}};
            }

            if (iValues.position) {
              position = iValues.position;
              component.set('position', position);
              delete iValues.position;
            }
            if (!SC.none(iValues.cannotClose)) {
              component.set('cannotClose', iValues.cannotClose);
              delete iValues.cannotClose;
            }
            if (iValues.dimensions) {
              dimensions = iValues.dimensions;
              component.setPath('content.dimensions', dimensions);
              delete iValues.dimensions;
            }
            if (iValues.isVisible != null) {
              var view = DG.currDocumentController().componentControllersMap[component.get('id')].get('view');
              view.set('isVisible', iValues.isVisible);
              delete iValues.isVisible;
            }

            remapProperties(iValues, remapped, codapType);

            Object.keys(remapped).forEach(function (key) {
              componentContent.set(key, remapped[key]);
            });

            return {
              success: true
            };
          },

          get: function (iResources) {
            function remapArchiveComponent(archive) {
              function extractObjectName(componentStorage, iKey) {
                var dataContextID = DG.ArchiveUtils.getLinkID(componentStorage, iKey);
                var dataContext = DG.store.find(dataContextID);
                return dataContext && dataContext.get('name');
              }
              var rtn = {};
              // DG.log('Get Component: ' + JSON.stringify(archive));
              var componentStorage = archive.componentStorage;
              var layout = archive.layout;


              rtn.type = kTypeMap[archive.type];
              if (layout) {
                if (layout.height || layout.width) {
                  rtn.dimensions = {
                    height: layout.height || 0,
                    width: layout.width || 0
                  };
                }
                if ((layout.left != null) || (layout.x != null)) {
                  rtn.position = {
                    left: layout.left || layout.x || 0,
                    top: layout.top || layout.y || 0
                  };
                }
              }
              if (componentStorage) {
                remapProperties(componentStorage, rtn, rtn.type);
              }
              switch (rtn.type) {
                case 'caseTable':
                  rtn.dataContext = extractObjectName(componentStorage, 'context');
                  break;
                case 'graph':
                  rtn.xAttributeName = extractObjectName( componentStorage, 'xAttr');
                  rtn.yAttributeName = extractObjectName( componentStorage, 'yAttr');
                  rtn.y2AttributeName = extractObjectName( componentStorage, 'y2Attr');//jshint -W086
                case 'map': // eslint-disable-line no-fallthrough
                  rtn.dataContext = extractObjectName(componentStorage, 'context');
                  rtn.legendAttributeName = extractObjectName( componentStorage, 'legendAttr');
                  break;
                default:
              }
              return rtn;
            }
            var component = iResources.component;
            var componentController = DG.currDocumentController()
                                          .getComponentControllerForModel(component);
            componentController && componentController.willSaveComponent();
            var archive = component && component.toArchive();
            var serialized = archive && remapArchiveComponent(archive);
            if (serialized) {
              return {
                success: true,
                values: serialized
              };
            } else {
              return {
                success: false,
                values: {
                  error: 'Could not serialize component.'
                }
              };
            }
          },

          'delete': function (iResource) {
            var component = iResource.component,
                componentID = component && component.get('id');
            if (componentID)
              DG.closeComponent(componentID);
            return {success: true};
          },
          'toDIType': function (iCODAPType) {
            return kTypeMap[iCODAPType];
          }
        };
      }()),

      handleComponentList: {
        get: function (iResources) {
          var document = DG.currDocumentController();

          var result = [];
          DG.ObjectMap.forEach(document.get('componentControllersMap'), function(id, componentController) {
            var component = componentController.get('model');
            result.push( {
              id: component.get('id'),
              name: component.get('name'),
              title: component.get('title'),
              type: this.handleComponent.toDIType(component.get('type'))
            });
          }.bind(this));
          return {
            success: true,
            values: result
          };
        }
      },

/*
      handleDocument: {
        update: function (iResources, iDocObject) {
          var tDocController = DG.currDocumentController(),
              tComponentControllers = tDocController.get('componentControllersMap'),
              tComponentsStorage = iDocObject.components,
              tIDsOfStoredComponents = tComponentsStorage.map(
                  function( iCompStorage) {
                    return Number( iCompStorage.guid);
                  });
          // If there are component controllers with no analogous storage element, delete them
          DG.ObjectMap.forEach(tComponentControllers, function (iGuid, iController) {
            var tFoundStorage = tIDsOfStoredComponents.indexOf( Number(iGuid)) >= 0;
            if (!tFoundStorage) {
              DG.closeComponent(iGuid);
            }
          });

          tComponentsStorage.forEach(function (iCompStorage) {
            var tComponentController = tComponentControllers[iCompStorage.guid],
                tModel = tComponentController && tComponentController.get('model'),
                tView = tComponentController && tComponentController.get('view');
            if (tComponentController) {
              if (tModel && tModel.restoreStorage)
                tModel.restoreStorage(iCompStorage);
              if( tView)
                tView.adjust( iCompStorage.layout);
            }
            else {
              DG.mainPage.get('mainPane').createComponentAndView(null, iCompStorage);
            }
          });
          return {
            success: true,
            values: result
          };
        },
        get: function() {
          if (DG.currDocumentController().notificationManager)
            DG.currDocumentController().notificationManager.sendDocumentToSubscribers();
        }
      },

*/
      handleLogMessage: {
        notify: function (iResources, iValues) {
          DG.Debug.logUserWithTopic.apply(DG.Debug, [iValues.topic, iValues.formatStr].concat(iValues.replaceArgs));
          DG.dirtyCurrentDocument(this.controller, true);
          return {
            success: true
          };
        }
      },

      handleLogMessageMonitor: {
        register: function (iResource, iValues) {
          if (!iValues.topic && !iValues.topicPrefix && !iValues.formatStr && !iValues.formatPrefix && !iValues.message) {
            return {
              success: false,
              values: {
                error: 'At least one of the following values must be passed: topic, topicPrefix, formatStr, formatPrefix or message.'
              }
            };
          }

          var dataInteractiveLogMonitor = DG.currDocumentController().dataInteractiveLogMonitor;
          var logMonitor = SC.Object.create({
            iPhoneHandler: this,
            values: {
              id: dataInteractiveLogMonitor.get("nextLogMonitorId"),
              clientId: iValues.clientId, // optional client supplied id that it can use to denote monitor
              topic: iValues.topic,
              topicPrefix: iValues.topicPrefix,
              formatStr: iValues.formatStr,
              formatPrefix: iValues.formatPrefix,
              message: iValues.message
            }
          });
          dataInteractiveLogMonitor.get("logMonitors").pushObject(logMonitor);
          dataInteractiveLogMonitor.set("nextLogMonitorId", dataInteractiveLogMonitor.get("nextLogMonitorId") + 1);

          return {
            success: true,
            logMonitor: logMonitor.values
          };
        },

        unregister: function (iResource, iValues) {
          if (!iValues.id && !iValues.clientId) {
            return {
              success: false,
              values: {
                error: 'Missing monitor id or clientId in values'
              }
            };
          }
          var dataInteractiveLogMonitor = DG.currDocumentController().dataInteractiveLogMonitor;
          dataInteractiveLogMonitor.set("logMonitors", dataInteractiveLogMonitor.get("logMonitors").filter(function (logMonitor) {
            var logMonitorValues = logMonitor.values;
            if (iValues.id && (iValues.id !== logMonitorValues.id)) {
              return true;
            }
            if (iValues.clientId && (iValues.clientId !== logMonitorValues.clientId)) {
              return true;
            }
            return false;
          }));

          return {
            success: true
          };
        },

      },

      handleUndoChangeNotice: {
        /**
         * The DataInteractive performed an undoable action
         *
         * We don't perform any action, because the external game has already performed the
         * action. We simply store this new command in the stack, and the undo/redo of this
         * command call undo/redo on the game.
         */
        notify: function (iResources, iValues) {
          var self = this;
          function handleUndoRedoCompleted (ret) {
            if (ret && ret.success === false) {
              // The Data Interactive was not able to successfully undo or redo an action
              DG.UndoHistory.showErrorAlert(true, {message: "Data Interactive error"});
            }
          }

          function registerUndoChangeNotice(logMessage, rpcEndpoint) {
            DG.UndoHistory.execute(DG.Command.create({
              name: 'interactive.undoableAction',
              undoString: 'DG.Undo.interactiveUndoableAction',
              redoString: 'DG.Redo.interactiveUndoableAction',
              log: 'Interactive action occurred: ' + logMessage,
              execute: function () {
              },
              undo: function () {
                // FIXME If the game component was removed and then re-added via an undo,
                // then calling undo or redo here will likely fail because the game's undo stack would
                // probably have been cleared.
                var message = {action: 'notify', resource: 'undoChangeNotice', values: {operation: "undoAction"}};
                self.sendMessage(message, handleUndoRedoCompleted);
              },
              redo: function () {
                var message = {action: 'notify', resource: 'undoChangeNotice', values: {operation: "redoAction"}};
                self.sendMessage(message, handleUndoRedoCompleted);
              }
            }));
            return true;
          }

          var logMessage = iValues && iValues.logMessage ? iValues.logMessage : "Unknown action";
          var success = true;

          switch (iValues.operation){
            case 'undoableActionPerformed':
              success = registerUndoChangeNotice(logMessage, this.get('rpcEndpoint'));
              break;
            case 'undoButtonPress':
              DG.UndoHistory.undo();
              break;

            case 'redoButtonPress':
              DG.UndoHistory.redo();
              break;
          }
          return {success: success, values: { canUndo: DG.UndoHistory.get('canUndo'),
                                              canRedo: DG.UndoHistory.get('canRedo') } };
        }
      },
      handleGlobal: {
        get: function (iResources) {
          var global = iResources.global;
          if (global) {
            return {
              success: true,
              values: {
                name: global.name,
                value: global.value,
                id: global.id
              }
            };
          } else {
            return {success: false, values: {error: 'Not found'}};
          }
        },
        update: function (iResources, iValues) {
          var global = iResources.global;
          var newValue = iValues.value;

          if (global && !SC.none(newValue)) {
            global.set('value', newValue);
            return {success: true};
          } else {
            return {success: false, values: {error: 'missing global or value'}};
          }
        },
        create: function (iResources, iValues) {
          var g = DG.globalsController.createGlobalValue(iValues);
          var result = SC.none(g)
                ?{error: 'error creating global value'}
                :{name: g.name, value: g.value, id: g.id};
          return {success: !SC.none(g), values: result};
        }
      },
      handleGlobalList: {
        get: function (iResources) {
          var names = DG.globalsController.getGlobalValueNames();
          var result = names.map(function (name) {
            var global = DG.globalsController.getGlobalValueByName(name);
            if (global) {
              return {
                name: global.name, value: global.value, id: global.id
              };
            }
            return null;
          }).filter(function(el) { return el; });
          return {success: true, values: result};
        }
      }
      //get: function (iResources) {
      //  return {
      //    success: true,
      //  }
      //},
      //create: function (iResources, iValues) {
      //  return {
      //    success: true,
      //  }
      //},
      //update: function (iResources, iValues) {
      //  return {
      //    success: true,
      //  }
      //}
      //delete: function (iResources) {
      //  return {
      //    success: true,
      //  }
      //}
    });

