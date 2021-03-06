/* global ReactDOMFactories */
// sc_require('react/dg-react');

DG.React.ready(function () {
  var
      // img = ReactDOMFactories.img,
      br = ReactDOMFactories.br,
      button = ReactDOMFactories.button,
      span = ReactDOMFactories.span;

  DG.React.Components.NavButtons = DG.React.createComponent(
      (function () {

        return {

          getPrevious: function () {
            this.props.onPrevious(this.props.collectionClient, this.props.caseIndex);
          },

          getNext: function () {
            this.props.onNext(this.props.collectionClient, this.props.caseIndex);
          },

          getNewCase: function () {
            this.props.onNewCase(this.props.collectionClient);
          },

          render: function () {
            var tCaseIndex = this.props.caseIndex,
                tNumCases = this.props.numCases,
                tFirstTitle,
                tFirstButton,
                tSecondTitle,
                tSecondButton,
                tAddCaseButton;
            if (!(tNumCases === 0 || (!SC.none(tCaseIndex) && tCaseIndex <= 1))) {
              tFirstTitle = !SC.none( tCaseIndex) ? 'DG.CaseCard.navPrevCase' : 'DG.CaseCard.navLastCase';
              tFirstButton = span({
                className: 'moonicon-icon-reverse-play',
                onClick: this.getPrevious,
                title: tFirstTitle.loc()
              });
            }
            if(!(this.props.numCases === 0 || (!SC.none(tCaseIndex) && tCaseIndex >= this.props.numCases))) {
              tSecondTitle = !SC.none( tCaseIndex) ? 'DG.CaseCard.navNextCase' : 'DG.CaseCard.navFirstCase';
              tSecondButton = span({
                className: 'moonicon-icon-play',
                onClick: this.getNext,
                title: tSecondTitle.loc()
              });
            }
            else {
              tSecondButton = span({
                className: 'moonicon-icon-play',
                style: { 'color': 'transparent', 'cursor': 'default'}
              });
            }
            var tAddCaseLabelWords = "DG.CaseCard.addCaseButton".loc(),
                tSpaceIndex = tAddCaseLabelWords.indexOf(' '),
                tFirstWord = tSpaceIndex >= 0 ? tAddCaseLabelWords.substring(0, tSpaceIndex) : tAddCaseLabelWords,
                tRemainder = tSpaceIndex >= 0 ? tAddCaseLabelWords.substring(tSpaceIndex) : '',
                tLabel = span({},tFirstWord,br(),tRemainder);
            tAddCaseButton =
                button({
                  className: 'dg-floating-button-right',
                  title: 'DG.CaseCard.newCaseToolTip'.loc(),
                  onClick: this.getNewCase
                }, tLabel);

            return span({className: 'nav-buttons dg-wants-touch'},
                tFirstButton, tSecondButton, tAddCaseButton);
          }
        };
      }()), []);

});
