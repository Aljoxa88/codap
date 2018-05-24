// sc_require('react/dg-react');
/* global React */

DG.React.ready(function () {
  var
      img = React.DOM.img,
      td = React.DOM.td;

  DG.React.Components.AttributeNameCell = DG.React.createComponent(
      (function () {

        return {

          moveDirection: '',

          render: function () {
            var this_ = this;

            function assignCellRef(iElement) {
              this_.cellRef = iElement;
            }

            function dragLocation() {
              if (this_.props.dragStatus && this_.props.dragStatus.event && this_.cellRef) {
                var tEvent = this_.props.dragStatus.event,
                    tX = tEvent.clientX,
                    tY = tEvent.clientY,
                    tRect = this_.cellRef.getBoundingClientRect();
                if (tX > tRect.x && tX < tRect.x + tRect.width && tY > tRect.y) {
                  if (tY < tRect.y + tRect.height / 2) {
                    this_.moveDirection = 'up';
                    return 'attr-cell-upper';
                  }
                  else if (tY < tRect.y + tRect.height) {
                    this_.moveDirection = 'down';
                    return 'attr-cell-lower';
                  }
                }
              }
              this_.moveDirection = '';
              return '';
            }

            function handleDropIfAny() {
              if (this_.props.dragStatus &&
                  this_.props.dragStatus.op === SC.DRAG_LINK &&
                  this_.props.dropCallback &&
                  this_.moveDirection !== '') {
                this_.props.dropCallback(this_.moveDirection);
              }
            }

            function clickHandler(iCallback) {
              SC.run(function () {
                this_.dropdown.hide();
                iCallback();
              });
            }

            function editAttributeClickHandler() {
              clickHandler(this_.props.editAttributeCallback);
            }

            function editFormulaClickHandler() {
              clickHandler(this_.props.editFormulaCallback);
            }

            function deleteAttributeClickHandler() {
              clickHandler(this_.props.deleteAttributeCallback);
            }

            function rerandomizeClickHandler() {
              clickHandler(this_.props.rerandomizeCallback);
            }

            function newAttributeClickHandler() {
              this_.props.newAttributeCallback();
            }

            handleDropIfAny();

            var tClassName = 'attr-cell ' + dragLocation(),
                tMenuItems = [
                  {
                    label: 'DG.TableController.headerMenuItems.editAttribute'.loc(),
                    clickHandler: editAttributeClickHandler
                  },
                  {
                    label: 'DG.TableController.headerMenuItems.editFormula'.loc(),
                    disabled: !this.props.attributeIsEditableCallback(),
                    clickHandler: editFormulaClickHandler
                  },
                  {
                    label: 'DG.TableController.headerMenuItems.randomizeAttribute'.loc(),
                    disabled: !this.props.attributeCanBeRandomizedCallback(),
                    clickHandler: rerandomizeClickHandler
                  },
                  {
                    label: 'DG.TableController.headerMenuItems.deleteAttribute'.loc(),
                    disabled: false,
                    clickHandler: deleteAttributeClickHandler
                  }
                ].map(function (iItem, iIndex) {
                  return DG.React.Components.DropdownItem({
                        disabled: iItem.disabled,
                        key: 'item-' + iIndex,
                        clickHandler: iItem.clickHandler
                      },
                      iItem.label);
                }),
                tAttributeName = DG.React.Components.Dropdown({
                  trigger: this.props.content,
                  menuItems: tMenuItems,
                  ref: function (iDropdown) {
                    this.dropdown = iDropdown;
                  }.bind(this),
                  onRefCallback: assignCellRef
                }),
                tNewAttrButton = (this.props.index === 0) ?
                    img({
                      src: static_url('images/add_circle_grey_72x72.png'),
                      className: 'dg-floating-plus',
                      width: 19,
                      height: 19,
                      title: 'DG.TableController.newAttributeTooltip'.loc(),
                      onClick: newAttributeClickHandler
                    }) :
                    '';

            return td({
              className: tClassName,
              ref: assignCellRef
            }, tNewAttrButton, tAttributeName);
          }
        };
      })(), []);

});
