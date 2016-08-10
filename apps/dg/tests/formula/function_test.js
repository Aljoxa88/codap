// ==========================================================================
//                        DG.Formula Unit Test
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

sc_require('formula/formula');

module("DG.Formula", {
  setup: function() {
  },
  teardown: function() {
  }
});

test("Basic tests with default compile and evaluation contexts", function() {

  // Returns true if the expression is volatile, i.e. repeated
  // evaluation doesn't give the same result.
  function isVolatile( iSource) {
    return iSource.indexOf('random') >= 0;
  }
  
  // Returns true if the two values specified are essentially equivalent.
  // Uses a proportion test for real numbers so rounding errors aren't
  // interpreted as incorrect results.
  function isEquivalent( iValue1, iValue2) {
    // Must have same JavaScript types
    var type1 = typeof iValue1,
        type2 = typeof iValue2;
    if( type1 !== type2) return false;
    // Numeric results require a bit more consideration
    if( type1 === 'number') {
      // NaN-status must be equivalent
      if( isNaN( iValue1) !== isNaN( iValue2)) return false;
      if( isNaN( iValue1) && isNaN( iValue2)) return true;
      // Identical values are clearly equivalent
      if( iValue1 === iValue2) return true;
      // Use proportional difference to compare real numbers
      var diffProportion = Math.abs( iValue1 - iValue2) / 
                          Math.max( Math.abs( iValue1), Math.abs( iValue2));
      return diffProportion < 1e-10;
    }
    // All non-numeric results must be identical
    return iValue1 === iValue2;
  }

  function buildAndEval( iSource, iContext, iEvalContext) {
    var formula = DG.Formula.create({ source: iSource });

    if( iContext) formula.set('context', iContext);
    
    //performanceTest( iSource, formula, iContext, iEvalContext);

    var compiledResult = formula.evaluate( iEvalContext),
        directResult = formula.evaluateDirect( iEvalContext),
        returnedResult = compiledResult;
    if( !isVolatile( iSource) && !isEquivalent( compiledResult, directResult)) {
      returnedResult = "Compiled (%@) !== Direct (%@)".fmt( compiledResult, directResult);
    }
    return returnedResult;
  }
  
  function floatEquals( iResult, iExpected, iDescription, iTolerance) {
    var diff = Math.abs( iResult - iExpected),
        tolerance = iTolerance || 1e-10;
    return ok( diff < tolerance, "%@:  Result: %@, Expected: %@".fmt( iDescription, iResult, iExpected));
  }
  
  function inRange( iVal, iMin, iMax, iDescription) {
    return ok( (iMin <= iVal) && (iVal <= iMax), iDescription);
  }
 
  //console.profile("formula unit test profile");
  
  // arithmetic functions
  equals( buildAndEval("abs(-1)"), 1, "abs() -- absolute value");
  equals( buildAndEval("abs(0)"), 0, "abs() -- absolute value");
  equals( buildAndEval("abs(1)"), 1, "abs() -- absolute value");
  equals( buildAndEval("ceil(-1.5)"), -1, "ceil() -- ceiling");
  equals( buildAndEval("ceil(1.5)"), 2, "ceil() -- ceiling");
  equals( buildAndEval("exp(0)"), 1, "exp() -- exponential (e^x)");
  equals( buildAndEval("exp(1)"), Math.E, "exp() -- exponential (e^x)");
  equals( buildAndEval("floor(-1.5)"), -2, "floor() -- floor");
  equals( buildAndEval("floor(1.5)"), 1, "floor() -- floor");
  floatEquals( buildAndEval("frac(1.5)"), 0.5, "frac(x) -- the fractional part of x");
  floatEquals( buildAndEval("frac(-1.5)"), -0.5, "frac(x) -- the fractional part of x");
  floatEquals( buildAndEval("ln(10)"), Math.LN10, "ln(x) -- natural logarithm");
  floatEquals( buildAndEval("log(e)"), Math.LOG10E, "log(x) -- base 10 logarithm");
  equals( buildAndEval("pow(2,3)"), 8, "pow(x,y) -- x^y");
  equals( buildAndEval("pow(-2,3)"), -8, "pow(x,y) -- x^y");
  equals( buildAndEval("round(1.9)"), 2, "round() -- round to integer");
  floatEquals( buildAndEval("round(1.987,2)"), 1.99, "round(x,n) -- round to decimal");
  floatEquals( buildAndEval("round(2012,-2)"), 2000, "round(x,n) -- round to decimal");
  floatEquals( buildAndEval("sqrt(2)"), Math.SQRT2, "sqrt(x) -- square root");
  floatEquals( buildAndEval("sqrt(1/2)"), Math.SQRT1_2, "sqrt(x) -- square root");
  equals( buildAndEval("trunc(1.5)"), 1, "trunc(x) -- truncate to integer");
  equals( buildAndEval("trunc(-1.5)"), -1, "trunc(x) -- truncate to integer");

  // other functions
  equals( buildAndEval("isFinite(0)"), true, "isFinite(0)");
  equals( buildAndEval("isFinite('0')"), true, "isFinite('0')");
  equals( buildAndEval("isFinite('')"), false, "isFinite('')");
  equals( buildAndEval("isFinite('string')"), false, "isFinite('string')");
  equals( buildAndEval("isFinite(0/1)"), true, "isFinite(0/1)");
  equals( buildAndEval("isFinite(1/0)"), false, "isFinite(1/0)");
  equals( buildAndEval("isFinite(0/0)"), false, "isFinite(0/0)");
  inRange( buildAndEval("random()"), 0, 1, "random() -- pseudo-random number generation");
  inRange( buildAndEval("random(10)"), 0, 10, "random(max) -- pseudo-random number generation");
  inRange( buildAndEval("random(5,10)"), 5, 10, "random(min,max) -- pseudo-random number generation");

  // string functions
  equals(buildAndEval("beginsWith('abcdef', 'abc')"), true, "beginsWith");
  equals(buildAndEval("beginsWith('abcdef', 'def')"), false, "beginsWith");
  equals(buildAndEval("beginsWith('abcdef', '')"), true, "beginsWith -- all strings contain empty string");
  equals(buildAndEval("beginsWith('', '')"), true, "beginsWith -- all strings contain empty string");
  equals(buildAndEval("charAt('abcdef', 0)"), '', "charAt('abcdef', 0)");
  equals(buildAndEval("charAt('abcdef', 1)"), 'a', "charAt('abcdef', 1)");
  equals(buildAndEval("charAt('abcdef', 1.5)"), 'a', "charAt('abcdef', 1.5)");
  equals(buildAndEval("charAt('abcdef', 3)"), 'c', "charAt('abcdef', 3)");
  equals(buildAndEval("charAt('abcdef', -3)"), 'd', "charAt('abcdef', -3)");
  equals(buildAndEval("charAt('abcdef', 8)"), '', "charAt('abcdef', 8)");
  equals(buildAndEval("concat('a')"), 'a', "concat");
  equals(buildAndEval("concat('a', 'b', 'c')"), 'abc', "concat");
  equals(buildAndEval("endsWith('abcdef', 'abc')"), false, "endsWith");
  equals(buildAndEval("endsWith('abcdef', 'def')"), true, "endsWith");
  equals(buildAndEval("endsWith('abcdef', '')"), true, "endsWith -- all strings contain empty string");
  equals(buildAndEval("endsWith('', '')"), true, "endsWith -- all strings contain empty string");
  equals(buildAndEval("findString('abcdef', 'a')"), '1', "findString('abcdef', 'a')");
  equals(buildAndEval("findString('abcdef', 'f')"), '6', "findString('abcdef', 'f')");
  equals(buildAndEval("findString('abcdef', 'g')"), '0', "findString('abcdef', 'g')");
  equals(buildAndEval("findString('abcdef', '')"), '1', "findString('abcdef', 'g')");
  equals(buildAndEval("findString('abcdef', 'a', 2)"), '0', "findString('abcdef', 'a', 2)");
  equals(buildAndEval("findString('abcabc', 'a', 2)"), '4', "findString('abcabc', 'a', 2)");
  equals(buildAndEval("findString('abcabc', 'a', -3)"), '4', "findString('abcabc', 'a', -3)");
  equals(buildAndEval("includes('abcdef', 'a')"), true, "includes('abcdef', 'a')");
  equals(buildAndEval("includes('abcdef', 'f')"), true, "includes('abcdef', 'f')");
  equals(buildAndEval("includes('abcdef', 'g')"), false, "includes('abcdef', 'g')");
  equals(buildAndEval("includes('abcdef', '')"), true, "includes('abcdef', '')");
  equals(buildAndEval("includes('', 'a')"), false, "includes('', 'a')");
  equals(buildAndEval("includes('', '')"), true, "includes('', '')");
  equals(buildAndEval("join(':', 'a')"), 'a', "join(':', 'a')");
  equals(buildAndEval("join(':', 'a', 'b', 'c')"), 'a:b:c', "join(':', 'a', 'b', 'c'");
  equals(buildAndEval("join('', 'a', 'b', 'c')"), 'abc', "join('', 'a', 'b', 'c'");
  equals(buildAndEval("repeatString('#', 3)"), '###', "repeatString('#', 3)");
  equals(buildAndEval("repeatString('', 3)"), '', "repeatString('', 3)");
  equals(buildAndEval("repeatString('#', 0)"), '', "repeatString('#', 0)");
  equals(buildAndEval("repeatString('#', 'a')"), '', "repeatString('#', 'a')");
  equals(buildAndEval("replaceChars('xyzdef', 1, 3, 'abc')"), 'abcdef', "replaceChars('xyzdef', 1, 3, 'abc')");
  equals(buildAndEval("replaceChars('abcxyz', -3, 3, 'def')"), 'abcdef', "replaceChars('abcxyz', -3, 3, 'def')");
  equals(buildAndEval("replaceChars('', 1, 3, 'abc')"), '', "replaceChars('', 1, 3, 'abc')");
  equals(buildAndEval("replaceChars('abcxyzdef', 4, 3, '')"), 'abcdef', "replaceChars('abcxyzdef', 3, 3, '')");
  equals(buildAndEval("replaceString('xyzdef', 'xyz', 'abc')"), 'abcdef', "replaceString('xyzdef', 'xyz', 'abc')");
  equals(buildAndEval("replaceString('abcxyz', 'xyz', 'def')"), 'abcdef', "replaceString('abcxyz', 'xyz', 'def')");
  equals(buildAndEval("replaceString('ababab', 'a', 'c')"), 'cbcbcb', "replaceString('ababab', 'a', 'c')");
  equals(buildAndEval("replaceString('', 'xyz', 'abc')"), '', "replaceString('', 'xyz', 'abc')");
  equals(buildAndEval("replaceString('abcxyzdef', 'xyz', '')"), 'abcdef', "replaceString('abcxyzdef', 'xyz', '')");
  equals(buildAndEval("stringLength('abcdef')"), 6, "stringLength('abcdef')");
  equals(buildAndEval("stringLength('abcxyzdef')"), 9, "stringLength('abcxyzdef')");
  equals(buildAndEval("stringLength('')"), 0, "stringLength('')");
  equals(buildAndEval("split('12/31/2015', '/', 1)"), '12', "split('12/31/2015', '/', 1)");
  equals(buildAndEval("split('12/31/2015', '/', 2)"), '31', "split('12/31/2015', '/', 2)");
  equals(buildAndEval("split('12/31/2015', '/', 3)"), '2015', "split('12/31/2015', '/', 3)");
  equals(buildAndEval("split('12/31/2015', '/', 0)"), '', "split('12/31/2015', '/', 0)");
  equals(buildAndEval("split('12', '/', 1)"), '12', "split('12', '/', 1)");
  equals(buildAndEval("subString('abcdef', 4)"), 'def', "subString('abcdef', 4)");
  equals(buildAndEval("subString('abcdef', 0, 3)"), 'abc', "subString('abcdef', 1, 3)");
  equals(buildAndEval("subString('abcdef', 1, 3)"), 'abc', "subString('abcdef', 1, 3)");
  equals(buildAndEval("subString('abcdef', -3)"), 'def', "subString('abcdef', -3)");
  equals(buildAndEval("subString('', 1, 3)"), '', "subString('', 1, 3)");
  equals(buildAndEval("subString('', -10)"), '', "subString('', -10)");
  equals(buildAndEval("toLower('abcdef')"), 'abcdef', "toLower('abcdef')");
  equals(buildAndEval("toLower('ABCDEF')"), 'abcdef', "toLower('ABCDEF')");
  equals(buildAndEval("toLower('')"), '', "toLower('')");
  equals(buildAndEval("toUpper('abcdef')"), 'ABCDEF', "toUpper('abcdef')");
  equals(buildAndEval("toUpper('ABCDEF')"), 'ABCDEF', "toUpper('ABCDEF')");
  equals(buildAndEval("toUpper('')"), '', "toUpper('')");
  equals(buildAndEval("trim('')"), '', "trim('')");
  equals(buildAndEval("trim('  a  ')"), 'a', "trim('  a  ')");
  equals(buildAndEval("trim('  a   b  ')"), 'a b', "trim('  a   b  ')");

  // trigonometric functions
  equals( buildAndEval("acos(1)"), 0, "acos() -- arccosine");
  equals( buildAndEval("asin(0)"), 0, "asin() -- arcsine");
  equals( buildAndEval("atan(0)"), 0, "atan() -- arctangent");
  equals( buildAndEval("atan2(0,1)"), 0, "atan2() -- arctangent (two arguments)");
  
  //console.profileEnd();
  //ok(false, "End-of-tests sentinel: All other tests processed to completion!");
});

