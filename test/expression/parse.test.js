// test parse
var assert = require('assert');
var approx = require('../../tools/approx');
var math = require('../../index');
var ArgumentsError = require('../../lib/error/ArgumentsError');
var parse = require('../../lib/expression/parse');
var ConditionalNode = require('../../lib/expression/node/ConditionalNode');
var OperatorNode = require('../../lib/expression/node/OperatorNode');
var RangeNode = require('../../lib/expression/node/RangeNode');
var Complex = math.type.Complex;
var Matrix = math.type.Matrix;
var Unit = math.type.Unit;
var ResultSet = math.type.ResultSet;

/**
 * Helper function to parse an expression and immediately evaluate its results
 * @param {String} expr
 * @param {Object} [scope]
 * @return {*} result
 */
function parseAndEval(expr, scope) {
  return parse(expr)
      .compile(math)
      .eval(scope);
}

describe('parse', function() {

  it('should parse a single expression', function() {
    approx.equal(parse('2 + 6 / 3').compile(math).eval(), 4);
  });

  it('should parse an empty expression', function() {
    assert.strictEqual(parse('').compile(math).eval(), undefined);
  });

  it('should parse an array with expressions', function() {
    var scope = {};
    assert.deepEqual(parse(['a=3', 'b=4', 'a*b']).map(function (node) {
      return node.compile(math).eval(scope);
    }), [3, 4, 12]);
  });

  it('should parse a matrix with expressions', function() {
    var scope = {};
    assert.deepEqual(parse(new Matrix(['a=3', 'b=4', 'a*b'])).map(function (node) {
      return node.compile(math).eval(scope);
    }), new Matrix([3, 4, 12]));
  });

  it('should parse an array with an empty expression', function() {
    assert.deepEqual(parse(['']).map(function (node) {
      return node.compile(math).eval();
    }), [undefined]);
  });

  it('should parse an array with an empty expression', function() {
    assert.deepEqual(parse(new Matrix([''])).map(function (node) {
      return node.compile(math).eval();
    }), new Matrix([undefined]));
  });

  describe('multiline', function () {

    it('should parse multiline expressions', function() {
      assert.deepEqual(parse('a=3\nb=4\na*b').compile(math).eval(), new ResultSet([3, 4, 12]));
      assert.deepEqual(parse('b = 43; b * 4').compile(math).eval(), new ResultSet([172]));
    });

    it('should skip empty lines in multiline expressions', function() {
      assert.deepEqual(parse('\n;\n2 * 4\n').compile(math).eval(), new ResultSet([8]));
    });

    it('should spread operators over multiple lines', function() {
      assert.deepEqual(parse('2+\n3').compile(math).eval(), 5);
      assert.deepEqual(parse('2+\n\n3').compile(math).eval(), 5);
      assert.deepEqual(parse('2*\n3').compile(math).eval(), 6);
      assert.deepEqual(parse('2^\n3').compile(math).eval(), 8);
      assert.deepEqual(parse('2==\n3').compile(math).eval(), false);
      assert.deepEqual(parse('2*-\n3').compile(math).eval(), -6);
    });

    it('should spread a function over multiple lines', function() {
      assert.deepEqual(parse('add(\n4\n,\n2\n)').compile(math).eval(), 6);
    });

    it('should spread contents of parameters over multiple lines', function() {
      assert.deepEqual(parse('(\n4\n+\n2\n)').compile(math).eval(), 6);
    });

    it('should spread a function assignment over multiple lines', function() {
      assert.deepEqual(typeof parse('f(\nx\n,\ny\n)=\nx+\ny').compile(math).eval(), 'function');
    });

    it('should spread a variable assignment over multiple lines', function() {
      assert.deepEqual(parse('x=\n2').compile(math).eval(), 2);
    });

    it('should spread a matrix over multiple lines', function() {
      assert.deepEqual(parse('[\n1\n,\n2\n]').compile(math).eval(), new Matrix([1, 2]));
    });

    it('should spread a range over multiple lines', function() {
      assert.deepEqual(parse('2:\n4').compile(math).eval(), new Matrix([2,3,4]));
      assert.deepEqual(parse('2:\n2:\n6').compile(math).eval(), new Matrix([2,4,6]));
    });

    it('should spread an index over multiple lines', function() {
      assert.deepEqual(parse('a[\n1\n,\n1\n]').compile(math).eval({a: [[1,2],[3,4]]}), 1);
      assert.deepEqual(parse('a[\n1\n,\n1\n]=\n100').compile(math).eval({a: [[1,2],[3,4]]}), [[100,2],[3,4]]);
    });

  });

  it('should throw an error when scope contains a reserved keyword', function() {
    var scope = {
      end: 2
    };
    assert.throws(function () {
      parse('2+3').compile(math).eval(scope);
    }, /Scope contains an illegal symbol/);
  });

  it('should give informative syntax errors', function() {
    assert.throws(function () {parse('2 +')}, /Unexpected end of expression \(char 4\)/);
    assert.throws(function () {parse('2 ~ 3')}, /Syntax error in part "~ 3" \(char 3\)/);
    assert.throws(function () {parse('2 + 3 + *')}, /Value expected \(char 9\)/);
  });

  it('should throw an error if called with wrong number of arguments', function() {
    assert.throws(function () {parse()}, ArgumentsError);
    assert.throws(function () {parse(1,2,3)}, ArgumentsError);
    assert.throws(function () {parse([1, 2])}, TypeError);
  });

  it('should throw an error if called with a wrong type of argument', function() {
    assert.throws(function () {parse(23)}, TypeError);
    assert.throws(function () {parse(math.unit('5cm'))}, TypeError);
    assert.throws(function () {parse(new Complex(2,3))}, TypeError);
    assert.throws(function () {parse(true)}, TypeError);
  });

  it('should throw an error in case of unsupported characters', function() {
    assert.throws(function () {parse('2\u00A1')}, /Syntax error in part "\u00A1"/);
  });

  describe('comments', function () {

    it('should skip comments', function() {
      assert.equal(parseAndEval('2 + 3 # - 4'), 5);
    });

    it('should skip comments in a ResultSet', function() {
      assert.deepEqual(parseAndEval('2 + 3 # - 4\n6-2'), new ResultSet([5, 4]));
    });

  });

  describe('number', function () {

    it('should parse valid numbers', function() {
      assert.equal(parseAndEval('0'), 0);
      assert.equal(parseAndEval('3'), 3);
      assert.equal(parseAndEval('3.2'), 3.2);
      assert.equal(parseAndEval('003.2'), 3.2);
      assert.equal(parseAndEval('003.200'), 3.2);
      assert.equal(parseAndEval('.2'), 0.2);
      assert.equal(parseAndEval('2.'), 2);
      assert.equal(parseAndEval('3e2'), 300);
      assert.equal(parseAndEval('300e2'), 30000);
      assert.equal(parseAndEval('300e+2'), 30000);
      assert.equal(parseAndEval('300e-2'), 3);
      assert.equal(parseAndEval('300E-2'), 3);
      assert.equal(parseAndEval('3.2e2'), 320);
    });

    it('should throw an error with invalid numbers', function() {
      assert.throws(function () {parseAndEval('.'); }, SyntaxError);
      assert.throws(function () {parseAndEval('3.2.2'); }, SyntaxError);
      assert.throws(function () {parseAndEval('3.2e2.2'); }, SyntaxError);
      assert.throws(function () {parseAndEval('32e'); }, SyntaxError);
    });

  });

  describe('bignumber', function () {

    it('should parse bignumbers', function() {
      assert.deepEqual(parseAndEval('bignumber(0.1)'), math.bignumber(0.1));
      assert.deepEqual(parseAndEval('bignumber("1.2e500")'), math.bignumber('1.2e500'));
    });

    it('should output bignumbers if default number type is bignumber', function() {
      var bigmath = math.create({
        number: 'bignumber'
      });

      assert.deepEqual(parse('0.1').compile(bigmath).eval(), bigmath.bignumber(0.1));
      assert.deepEqual(parse('1.2e5000').compile(bigmath).eval(), bigmath.bignumber('1.2e5000'));
    });

  });

  describe('string', function () {

    it('should parse a string', function() {
      assert.deepEqual(parseAndEval('"hello"'), "hello");
      assert.deepEqual(parseAndEval('   "hi" '), "hi");
    });

    it('should throw an error with invalid strings', function() {
      assert.throws(function () {parseAndEval('"hi'); }, SyntaxError);
      assert.throws(function () {parseAndEval(' hi" '); }, Error);
    });

    it('should get a string subset', function() {
      var scope = {};
      assert.deepEqual(parseAndEval('c="hello"', scope), "hello");
      assert.deepEqual(parseAndEval('c[2:4]', scope), "ell");
      assert.deepEqual(parseAndEval('c[5:-1:1]', scope), "olleh");
      assert.deepEqual(parseAndEval('c[end-2:-1:1]', scope), "leh");
      assert.deepEqual(parseAndEval('"hello"[2:4]', scope), "ell");
    });

    it('should set a string subset', function() {
      var scope = {};
      assert.deepEqual(parseAndEval('c="hello"', scope), "hello");
      assert.deepEqual(parseAndEval('c[1] = "H"', scope), "Hello");
      assert.deepEqual(parseAndEval('c', scope), "Hello");
      assert.deepEqual(parseAndEval('c[6:11] = " world"', scope), "Hello world");
      assert.deepEqual(parseAndEval('c', scope), "Hello world");
      assert.deepEqual(scope.c, "Hello world");
    });

  });

  describe('unit', function () {

    it('should parse units', function() {
      assert.deepEqual(parseAndEval('5cm'), new Unit(5, 'cm'));
      assert.ok(parseAndEval('5cm') instanceof Unit);
    });

    it('should correctly parse negative temperatures', function () {
      approx.deepEqual(parseAndEval('-6 celsius'), new Unit(-6, 'celsius'));
      approx.deepEqual(parseAndEval('--6 celsius'), new Unit(6, 'celsius'));
      approx.deepEqual(parseAndEval('-6 celsius to fahrenheit'),
          new Unit(21.2, 'fahrenheit').to('fahrenheit'));
    });

    it('should convert units', function() {
      var scope = {};
      approx.deepEqual(parseAndEval('(5.08 cm * 1000) to inch', scope),
          math.unit(2000, 'inch').to('inch'));
      approx.deepEqual(parseAndEval('a = (5.08 cm * 1000) to mm', scope),
          math.unit(50800, 'mm').to('mm'));
      approx.deepEqual(parseAndEval('a to inch', scope),
          math.unit(2000, 'inch').to('inch'));

      approx.deepEqual(parseAndEval('10 celsius to fahrenheit'),
          math.unit(50, 'fahrenheit').to('fahrenheit'));
      approx.deepEqual(parseAndEval('20 celsius to fahrenheit'),
          math.unit(68, 'fahrenheit').to('fahrenheit'));
      approx.deepEqual(parseAndEval('50 fahrenheit to celsius'),
          math.unit(10, 'celsius').to('celsius'));
    });

    it('should evaluate operator "to" with correct precedence ', function () {
      approx.deepEqual(parseAndEval('5.08 cm * 1000 to inch'),
          new Unit(2000, 'inch').to('inch'));
    });

    it('should evaluate operator "in" (alias of "to") ', function () {
      approx.deepEqual(parseAndEval('5.08 cm in inch'),
          new Unit(2, 'inch').to('inch'));
    });

    it('should evaluate unit "in" (should not conflict with operator "in")', function () {
      approx.deepEqual(parseAndEval('2 in'),          new Unit(2, 'in'));
      approx.deepEqual(parseAndEval('5.08 cm in in'), new Unit(2, 'in').to('in'));
      approx.deepEqual(parseAndEval('5 in in in'),    new Unit(5, 'in').to('in'));
      approx.deepEqual(parseAndEval('2 in to meter'), new Unit(2, 'inch').to('meter'));
      approx.deepEqual(parseAndEval('2 in in meter'), new Unit(2, 'inch').to('meter'));
      approx.deepEqual(parseAndEval('a in inch', {a: new Unit(5.08, 'cm')}), new Unit(2, 'inch').to('inch'));
      // Note: the following is not supported (due to conflicts):
      //approx.deepEqual(parseAndEval('(2+3) in'), new Unit(5, 'inch'));
      //approx.deepEqual(parseAndEval('a in', {a: 5}), new Unit(5, 'inch'));
    });
  });

  describe('complex', function () {

    it('should parse complex values', function () {
      assert.deepEqual(parseAndEval('i'), new Complex(0,1));
      assert.deepEqual(parseAndEval('2+3i'), new Complex(2,3));
      assert.deepEqual(parseAndEval('2+3*i'), new Complex(2,3));
      assert.deepEqual(parseAndEval('1/2i'), new Complex(0, 0.5));
    });

  });

  describe('matrix', function () {

    it('should parse a matrix', function() {
      assert.ok(parseAndEval('[1,2;3,4]') instanceof Matrix);

      var m = parseAndEval('[1,2,3;4,5,6]');
      assert.deepEqual(m.size(), [2,3]);
      assert.deepEqual(m, new Matrix([[1,2,3],[4,5,6]]));

      var b = parseAndEval('[5, 6; 1, 1]');
      assert.deepEqual(b.size(), [2,2]);
      assert.deepEqual(b, new Matrix([[5,6],[1,1]]));

      // from 1 to n dimensions
      assert.deepEqual(parseAndEval('[ ]'), new Matrix([]));
      assert.deepEqual(parseAndEval('[1,2,3]'), new Matrix([1,2,3]));
      assert.deepEqual(parseAndEval('[1;2;3]'), new Matrix([[1],[2],[3]]));
      assert.deepEqual(parseAndEval('[[1,2],[3,4]]'), new Matrix([[1,2],[3,4]]));
      assert.deepEqual(parseAndEval('[[[1],[2]],[[3],[4]]]'), new Matrix([[[1],[2]],[[3],[4]]]));
    });

    it('should parse an empty matrix', function() {
      assert.deepEqual(parseAndEval('[]'), new Matrix([]));
    });

    it('should get a matrix subset', function() {
      var scope = {
        a: new Matrix([
          [1,2,3],
          [4,5,6],
          [7,8,9]
        ])
      };
      assert.deepEqual(parseAndEval('a[2, :]', scope),        new Matrix([[4,5,6]]));
      assert.deepEqual(parseAndEval('a[2, :2]', scope),       new Matrix([[4,5]]));
      assert.deepEqual(parseAndEval('a[2, :end-1]', scope),   new Matrix([[4,5]]));
      assert.deepEqual(parseAndEval('a[2, 2:]', scope),       new Matrix([[5,6]]));
      assert.deepEqual(parseAndEval('a[2, 2:3]', scope),      new Matrix([[5,6]]));
      assert.deepEqual(parseAndEval('a[2, 1:2:3]', scope),    new Matrix([[4,6]]));
      assert.deepEqual(parseAndEval('a[:, 2]', scope),        new Matrix([[2],[5],[8]]));
      assert.deepEqual(parseAndEval('a[:2, 2]', scope),       new Matrix([[2],[5]]));
      assert.deepEqual(parseAndEval('a[:end-1, 2]', scope),   new Matrix([[2],[5]]));
      assert.deepEqual(parseAndEval('a[2:, 2]', scope),       new Matrix([[5],[8]]));
      assert.deepEqual(parseAndEval('a[2:3, 2]', scope),      new Matrix([[5],[8]]));
      assert.deepEqual(parseAndEval('a[1:2:3, 2]', scope),    new Matrix([[2],[8]]));
    });

    it('should parse matrix resizings', function() {
      var scope = {};
      assert.deepEqual(parseAndEval('a = []', scope),    new Matrix([]));
      assert.deepEqual(parseAndEval('a[1:3,1] = [1;2;3]', scope), new Matrix([[1],[2],[3]]));
      assert.deepEqual(parseAndEval('a[:,2] = [4;5;6]', scope), new Matrix([[1,4],[2,5],[3,6]]));

      assert.deepEqual(parseAndEval('a = []', scope),    new Matrix([]));
      assert.deepEqual(parseAndEval('a[1,3] = 3', scope), new Matrix([[0,0,3]]));
      assert.deepEqual(parseAndEval('a[2,:] = [[4,5,6]]', scope), new Matrix([[0,0,3],[4,5,6]]));

      assert.deepEqual(parseAndEval('a = []', scope),    new Matrix([]));
      assert.deepEqual(parseAndEval('a[3,1] = 3', scope), new Matrix([[0],[0],[3]]));
      assert.deepEqual(parseAndEval('a[:,2] = [4;5;6]', scope), new Matrix([[0,4],[0,5],[3,6]]));

      assert.deepEqual(parseAndEval('a = []', scope),    new Matrix([]));
      assert.deepEqual(parseAndEval('a[1,1:3] = [[1,2,3]]', scope), new Matrix([[1,2,3]]));
      assert.deepEqual(parseAndEval('a[2,:] = [[4,5,6]]', scope), new Matrix([[1,2,3],[4,5,6]]));
    });

    it('should get/set the matrix correctly', function() {
      var scope = {};
      parseAndEval('a=[1,2;3,4]', scope);
      parseAndEval('a[1,1] = 100', scope);
      assert.deepEqual(scope.a.size(), [2,2]);
      assert.deepEqual(scope.a, new Matrix([[100,2],[3,4]]));
      parseAndEval('a[2:3,2:3] = [10,11;12,13]', scope);
      assert.deepEqual(scope.a.size(), [3,3]);
      assert.deepEqual(scope.a, new Matrix([[100, 2, 0],[3,10,11],[0,12,13]]));
      var a = scope.a;
      // note: after getting subset, uninitialized elements are replaced by elements with an undefined value
      assert.deepEqual(a.subset(math.index([0,3], [0,2])), new Matrix([[100,2],[3,10],[0,12]]));
      assert.deepEqual(parseAndEval('a[1:3,1:2]', scope), new Matrix([[100,2],[3,10],[0,12]]));

      scope.b = [[1,2],[3,4]];
      assert.deepEqual(parseAndEval('b[1,:]', scope), [[1, 2]]);
    });

    it('should get/set the matrix correctly for 3d matrices', function() {
      var scope = {};
      assert.deepEqual(parseAndEval('f=[1,2;3,4]', scope), new Matrix([[1,2],[3,4]]));
      assert.deepEqual(parseAndEval('size(f)', scope), new Matrix([2,2]));

      assert.deepEqual(parseAndEval('f[:,:,2]=[5,6;7,8]', scope), new Matrix([
        [
          [1,5],
          [2,6]
        ],
        [
          [3,7],
          [4,8]
        ]
      ]));

      assert.deepEqual(parseAndEval('size(f)', scope), new Matrix([2,2,2]));
      assert.deepEqual(parseAndEval('f[:,:,1]', scope), new Matrix([[[1],[2]],[[3],[4]]]));
      assert.deepEqual(parseAndEval('f[:,:,2]', scope), new Matrix([[[5],[6]],[[7],[8]]]));
      assert.deepEqual(parseAndEval('f[:,2,:]', scope), new Matrix([[[2,6]],[[4,8]]]));
      assert.deepEqual(parseAndEval('f[2,:,:]', scope), new Matrix([[[3,7],[4,8]]]));

      parseAndEval('a=diag([1,2,3,4])', scope);
      assert.deepEqual(parseAndEval('a[3:end, 3:end]', scope), new Matrix([[3,0],[0,4]]));
      assert.deepEqual(parseAndEval('a[3:end, 2:end]=9*ones(2,3)', scope), new Matrix([
        [1,0,0,0],
        [0,2,0,0],
        [0,9,9,9],
        [0,9,9,9]
      ]));
      assert.deepEqual(parseAndEval('a[2:end-1, 2:end-1]', scope), new Matrix([[2,0],[9,9]]));
    });

    it('should merge nested matrices', function() {
      var scope = {};
      parseAndEval('a=[1,2;3,4]', scope);

    });

    it('should parse matrix concatenations', function() {
      var scope = {};
      parseAndEval('a=[1,2;3,4]', scope);
      parseAndEval('b=[5,6;7,8]', scope);
      assert.deepEqual(parseAndEval('c=concat(a,b)', scope), new Matrix([[1,2,5,6],[3,4,7,8]]));
      assert.deepEqual(parseAndEval('c=concat(a,b,1)', scope), new Matrix([[1,2],[3,4],[5,6],[7,8]]));
      assert.deepEqual(parseAndEval('c=concat(concat(a,b), concat(b,a), 1)', scope), new Matrix([[1,2,5,6],[3,4,7,8],[5,6,1,2],[7,8,3,4]]));
      assert.deepEqual(parseAndEval('c=concat([[1,2]], [[3,4]], 1)', scope), new Matrix([[1,2],[3,4]]));
      assert.deepEqual(parseAndEval('c=concat([[1,2]], [[3,4]], 2)', scope), new Matrix([[1,2,3,4]]));
      assert.deepEqual(parseAndEval('c=concat([[1]], [2;3], 1)', scope), new Matrix([[1],[2],[3]]));
      assert.deepEqual(parseAndEval('d=1:3', scope), new Matrix([1,2,3]));
      assert.deepEqual(parseAndEval('concat(d,d)', scope), new Matrix([1,2,3,1,2,3]));
      assert.deepEqual(parseAndEval('e=1+d', scope), new Matrix([2,3,4]));
      assert.deepEqual(parseAndEval('size(e)', scope), new Matrix([3]));
      assert.deepEqual(parseAndEval('concat(e,e)', scope), new Matrix([2,3,4,2,3,4]));
      assert.deepEqual(parseAndEval('[[],[]]', scope), new Matrix([[],[]]));
      assert.deepEqual(parseAndEval('[[],[]]', scope).size(), [2, 0]);
      assert.deepEqual(parseAndEval('size([[],[]])', scope), new Matrix([2, 0]));
    });

    it('should execute map on an array with one based indices', function () {
      var logs = [];
      var scope = {
        A: [1,2,3],
        callback: function (value, index, matrix) {
          assert.strictEqual(matrix, scope.A);
          logs.push([value, index.map(function (v) {return v})]);
          return value + 1;
        }
      };
      var res = math.eval('map(A, callback)', scope);
      assert.deepEqual(res, [2,3,4]);

      assert.deepEqual(logs, [[1, [1]], [2, [2]], [3, [3]]]);
    });

    it('should execute map on a Matrix with one based indices', function () {
      var logs = [];
      var scope = {
        A: new Matrix([1,2,3]),
        callback: function (value, index, matrix) {
          assert.strictEqual(matrix, scope.A);
          logs.push([value, index.map(function (v) {return v})]);
          return value + 1;
        }
      };
      var res = math.eval('map(A, callback)', scope);
      assert.deepEqual(res, new Matrix([2,3,4]));

      assert.deepEqual(logs, [[1, [1]], [2, [2]], [3, [3]]]);
    });

    it('should execute forEach on an array with one based indices', function () {
      var logs = [];
      var scope = {
        A: [1,2,3],
        callback: function (value, index, matrix) {
          assert.strictEqual(matrix, scope.A);
          logs.push([value, index.map(function (v) {return v})]);
        }
      };
      math.eval('forEach(A, callback)', scope);

      assert.deepEqual(logs, [[1, [1]], [2, [2]], [3, [3]]]);
    });

    it('should execute forEach on a Matrix with one based indices', function () {
      var logs = [];
      var scope = {
        A: new Matrix([1,2,3]),
        callback: function (value, index, matrix) {
          assert.strictEqual(matrix, scope.A);
          logs.push([value, index.map(function (v) {return v})]);
        }
      };
      math.eval('forEach(A, callback)', scope);

      assert.deepEqual(logs, [[1, [1]], [2, [2]], [3, [3]]]);
    });

    it('should throw an error for invalid matrix', function() {
      assert.throws(function () {parseAndEval('[1, 2')}, /End of matrix ] expected/);
      assert.throws(function () {parseAndEval('[1; 2')}, /End of matrix ] expected/);
    });

    it('should throw an error when matrix rows mismatch', function() {
      assert.throws(function () {parseAndEval('[1, 2; 1, 2, 3]')}, /Column dimensions mismatch/);
    });

    it('should throw an error for invalid matrix subsets', function() {
      var scope = {a: [1,2,3]};
      assert.throws(function () {parseAndEval('a[1', scope)}, /Parenthesis ] expected/);
    });

    it('should throw an error for invalid matrix concatenations', function() {
      var scope = {};
      assert.throws(function () {parseAndEval('c=concat(a, [1,2,3])', scope)});
    });
  });

  describe('boolean', function () {

    it('should parse boolean values', function () {
      assert.equal(parseAndEval('true'), true);
      assert.equal(parseAndEval('false'), false);
    });

  });


  describe('constants', function () {

    it('should parse constants', function() {
      assert.deepEqual(parseAndEval('i'), new Complex(0, 1));
      approx.equal(parseAndEval('pi'), Math.PI);
      approx.equal(parseAndEval('e'), Math.E);
    });

  });

  describe('variables', function () {

    it('should parse valid variable assignments', function() {
      var scope = {};
      assert.equal(parseAndEval('a = 0.75', scope), 0.75);
      assert.equal(parseAndEval('a + 2', scope), 2.75);
      assert.equal(parseAndEval('a = 2', scope), 2);
      assert.equal(parseAndEval('a + 2', scope), 4);
      approx.equal(parseAndEval('pi * 2', scope), 6.283185307179586);
    });

    it('should throw an error on undefined symbol', function() {
      assert.throws(function() {parseAndEval('qqq + 2'); });
    });

    it('should throw an error on invalid assignments', function() {
      //assert.throws(function () {parseAndEval('sin(2) = 0.75')}, SyntaxError); // TODO: should this throw an exception?
      assert.throws(function () {parseAndEval('sin + 2 = 3')}, SyntaxError);
    });

    it('should parse nested assignments', function() {
      var scope = [];
      assert.equal(parseAndEval('c = d = (e = 4.5)', scope), 4.5);
      assert.equal(scope.c, 4.5);
      assert.equal(scope.d, 4.5);
      assert.equal(scope.e, 4.5);
      assert.deepEqual(parseAndEval('a = [1,2,f=3]', scope), new Matrix([1,2,3]));
      assert.equal(scope.f, 3);
      assert.equal(parseAndEval('2 + (g = 3 + 4)', scope), 9);
      assert.equal(scope.g, 7);
    });

    it('should throw an error for invalid nested assignments', function() {
      assert.throws(function () {parseAndEval('a(j = 3)', {})}, SyntaxError);
    });

  });


  describe('functions', function () {

    it('should parse functions', function() {
      assert.equal(parseAndEval('sqrt(4)'), 2);
      assert.equal(parseAndEval('sqrt(6+3)'), 3);
      assert.equal(parseAndEval('atan2(2,2)'), 0.7853981633974483);
      assert.deepEqual(parseAndEval('sqrt(-4)'), new Complex(0, 2));
      assert.equal(parseAndEval('abs(-4.2)'), 4.2);
      assert.equal(parseAndEval('add(2, 3)'), 5);
      approx.deepEqual(parseAndEval('1+exp(pi*i)'), new Complex(0, 0));
      assert.equal(parseAndEval('unequal(2, 3)'), true);
    });

    it('should parse functions without parameters', function() {
      assert.equal(parseAndEval('r()', {r: function() {return 2;}}), 2);
    });

    it('should parse function assignments', function() {
      var scope = {};
      parseAndEval('x=100', scope); // for testing scoping of the function variables
      assert.equal(parseAndEval('f(x) = x^2', scope).syntax, 'f(x)');
      assert.equal(parseAndEval('f(3)', scope), 9);
      assert.equal(scope.f(3), 9);
      assert.equal(scope.x, 100);
      assert.equal(parseAndEval('g(x, y) = x^y', scope).syntax, 'g(x, y)');
      assert.equal(parseAndEval('g(4,5)', scope), 1024);
      assert.equal(scope.g(4,5), 1024);
    });

    it ('should correctly evaluate variables in assigned functions', function () {
      var scope = {};
      assert.equal(parseAndEval('a = 3', scope), 3);
      assert.equal(parseAndEval('f(x) = a * x', scope).syntax, 'f(x)');
      assert.equal(parseAndEval('f(2)', scope), 6);
      assert.equal(parseAndEval('a = 5', scope), 5);
      assert.equal(parseAndEval('f(2)', scope), 10);
      assert.equal(parseAndEval('g(x) = x^q', scope).syntax, 'g(x)');
      assert.equal(parseAndEval('q = 4/2', scope), 2);
      assert.equal(parseAndEval('g(3)', scope), 9);
    });

    it('should throw an error for undefined variables in an assigned function', function() {
      var scope = {};
      assert.equal(parseAndEval('g(x) = x^q', scope).syntax, 'g(x)');
      assert.throws(function () {
        parseAndEval('g(3)', scope);
      }, function (err) {
        return (err instanceof Error) && (err.toString() == 'Error: Undefined symbol q');
      });
    });

    it('should throw an error on invalid left hand side of a function assignment', function() {
      assert.throws(function () {
        var scope = {};
        parseAndEval('g(x, 2) = x^2', scope);
      }, SyntaxError);

      assert.throws(function () {
        var scope = {};
        parseAndEval('2(x, 2) = x^2', scope);
      }, SyntaxError);
    });
  });

  describe ('parentheses', function () {
    it('should parse parentheses overriding the default precedence', function () {
      approx.equal(parseAndEval('2 - (2 - 2)'), 2);
      approx.equal(parseAndEval('2 - ((2 - 2) - 2)'), 4);
      approx.equal(parseAndEval('3 * (2 + 3)'), 15);
      approx.equal(parseAndEval('(2 + 3) * 3'), 15);
    });

    it('should throw an error in case of unclosed parentheses', function () {
      assert.throws(function () {parseAndEval('3 * (1 + 2')}, /Parenthesis \) expected/);
    });
  });

  describe ('operators', function () {

    it('should parse operations', function() {
      approx.equal(parseAndEval('(2+3)/4'), 1.25);
      approx.equal(parseAndEval('2+3/4'), 2.75);
      assert.equal(parse('0 + 2').toString(), '0 + 2');
    });

    it('should parse add +', function() {
      assert.equal(parseAndEval('2 + 3'), 5);
      assert.equal(parseAndEval('2 + 3 + 4'), 9);
    });

    it('should parse divide /', function() {
      assert.equal(parseAndEval('4 / 2'), 2);
      assert.equal(parseAndEval('8 / 2 / 2'), 2);
    });

    it('should parse dotDivide ./', function() {
      assert.equal(parseAndEval('4./2'), 2);
      assert.equal(parseAndEval('4 ./ 2'), 2);
      assert.equal(parseAndEval('8 ./ 2 / 2'), 2);

      assert.deepEqual(parseAndEval('[1,2,3] ./ [1,2,3]'), new Matrix([1,1,1]));
    });

    it('should parse dotMultiply .*', function() {
      approx.deepEqual(parseAndEval('2.*3'), 6);
      approx.deepEqual(parseAndEval('2 .* 3'), 6);
      approx.deepEqual(parseAndEval('2. * 3'), 6);
      approx.deepEqual(parseAndEval('4 .* 2'), 8);
      approx.deepEqual(parseAndEval('8 .* 2 .* 2'), 32);
      assert.deepEqual(parseAndEval('a=3; a.*4'), new ResultSet([12]));

      assert.deepEqual(parseAndEval('[1,2,3] .* [1,2,3]'), new Matrix([1,4,9]));
    });

    it('should parse dotPower .^', function() {
      approx.deepEqual(parseAndEval('2.^3'), 8);
      approx.deepEqual(parseAndEval('2 .^ 3'), 8);
      assert.deepEqual(parseAndEval('2. ^ 3'), 8);
      approx.deepEqual(parseAndEval('-2.^2'), -4);  // -(2^2)
      approx.deepEqual(parseAndEval('2.^3.^4'), 2.41785163922926e+24); // 2^(3^4)

      assert.deepEqual(parseAndEval('[2,3] .^ [2,3]'), new Matrix([4,27]));
    });

    it('should parse equal ==', function() {
      assert.strictEqual(parseAndEval('2 == 3'), false);
      assert.strictEqual(parseAndEval('2 == 2'), true);
      assert.deepEqual(parseAndEval('[2,3] == [2,4]'), new Matrix([true, false]));
    });

    it('should parse larger >', function() {
      assert.equal(parseAndEval('2 > 3'), false);
      assert.equal(parseAndEval('2 > 2'), false);
      assert.equal(parseAndEval('2 > 1'), true);
    });

    it('should parse largerEq >=', function() {
      assert.equal(parseAndEval('2 >= 3'), false);
      assert.equal(parseAndEval('2 >= 2'), true);
      assert.equal(parseAndEval('2 >= 1'), true);
    });

    it('should parse mod %', function() {
      approx.equal(parseAndEval('8 % 3'), 2);
    });

    it('should parse operator mod', function() {
      approx.equal(parseAndEval('8 mod 3'), 2);
    });

    it('should parse multiply *', function() {
      approx.equal(parseAndEval('4 * 2'), 8);
      approx.equal(parseAndEval('8 * 2 * 2'), 32);
    });

    it('should parse implicit multiplication', function() {
      assert.equal(parseAndEval('4a', {a:2}), 8);
      assert.equal(parseAndEval('4 a', {a:2}), 8);
      assert.equal(parseAndEval('a b', {a: 2, b: 4}), 8);
      assert.equal(parseAndEval('2a b', {a: 2, b: 4}), 16);
      assert.equal(parseAndEval('2a * b', {a: 2, b: 4}), 16);
      assert.equal(parseAndEval('2a / b', {a: 2, b: 4}), 1);
      assert.equal(parseAndEval('a b c', {a: 2, b: 4, c: 6}), 48);
      assert.equal(parseAndEval('a b*c', {a: 2, b: 4, c: 6}), 48);
      assert.equal(parseAndEval('a*b c', {a: 2, b: 4, c: 6}), 48);
      assert.equal(parseAndEval('a/b c', {a: 4, b: 2, c: 6}), 12);

      assert.equal(parseAndEval('1/2a', {a:2}), 1);
      assert.equal(parseAndEval('8/2a/2', {a:2}), 4);
      assert.equal(parseAndEval('8/2a*2', {a:2}), 16);
      assert.equal(parseAndEval('4*2a', {a:2}), 16);

      assert.equal(parseAndEval('(2+3)a', {a:2}), 10);
      assert.equal(parseAndEval('(2+3)2'), 10);
      assert.equal(parseAndEval('(2+3)-2'), 3); // no implicit multiplication, just a unary minus
      assert.equal(parseAndEval('(2+3)(-2)'), -10); //implicit multiplication
      assert.equal(parseAndEval('4(2+3)'), 20);
      assert.equal(parseAndEval('(a)(2+3)', {a:4}), 20);  // implicit multiplication
      assert.equal(parseAndEval('a(2+3)', {a: function() {return 42}}), 42); // function call

      assert.equal(parseAndEval('(2+3)(4+5)'), 45);
      assert.equal(parseAndEval('(2+3)(4+5)(3-1)'), 90);

      assert.equal(parseAndEval('(2a)^3', {a:2}), 64);
      assert.equal(parseAndEval('sqrt(2a)', {a:2}), 2);

      assert.deepEqual(parseAndEval('[2, 3] 2'), new Matrix([4, 6]));
      assert.deepEqual(parseAndEval('[2, 3] a', {a:2}), new Matrix([4, 6]));
      assert.deepEqual(parseAndEval('[2, 3] [3, 2]', {a:2}), 12); // implicit multiplication
      assert.deepEqual(parseAndEval('2 [2, 3]'), new Matrix([4, 6]));
      assert.deepEqual(parseAndEval('(A) [2,2,2]', {A: [1,2,3]}), 12);  // implicit multiplication
      assert.deepEqual(parseAndEval('A [2,2]', {A: [[1,2], [3,4]]}), 4); // index, no multiplication
    });

    it('should throw an error when having an implicit multiplication between two numbers', function() {
      assert.throws(function () {
        math.parse('2 3');
      }, /Unexpected part "3"/);
    });

    it('should parse pow ^', function() {
      approx.equal(parseAndEval('2^3'), 8);
      approx.equal(parseAndEval('-2^2'), -4);  // -(2^2)
      approx.equal(parseAndEval('2^3^4'), 2.41785163922926e+24); // 2^(3^4)
    });

    it('should parse smaller <', function() {
      assert.equal(parseAndEval('2 < 3'), true);
      assert.equal(parseAndEval('2 < 2'), false);
      assert.equal(parseAndEval('2 < 1'), false);
    });

    it('should parse smallerEq <=', function() {
      assert.equal(parseAndEval('2 <= 3'), true);
      assert.equal(parseAndEval('2 <= 2'), true);
      assert.equal(parseAndEval('2 <= 1'), false);
    });

    it('should parse minus -', function() {
      assert.equal(parseAndEval('4 - 2'), 2);
      assert.equal(parseAndEval('8 - 2 - 2'), 4);
    });

    it('should parse unary minus -', function() {
      assert.equal(parseAndEval('-2'), -2);
      assert.equal(parseAndEval('--2'), 2);
      assert.equal(parseAndEval('---2'), -2);

      assert.equal(parseAndEval('4*-2'), -8);
      assert.equal(parseAndEval('4 * -2'), -8);
      assert.equal(parseAndEval('4+-2'), 2);
      assert.equal(parseAndEval('4 + -2'), 2);
      assert.equal(parseAndEval('4--2'), 6);
      assert.equal(parseAndEval('4 - -2'), 6);

      assert.equal(parseAndEval('5-3'), 2);
      assert.equal(parseAndEval('5--3'), 8);
      assert.equal(parseAndEval('5---3'), 2);
      assert.equal(parseAndEval('5+---3'), 2);
      assert.equal(parseAndEval('5----3'), 8);
      assert.equal(parseAndEval('5+--(2+1)'), 8);
    });

    it('should parse unary +', function() {
      assert.equal(parseAndEval('+2'), 2);
      assert.equal(parseAndEval('++2'), 2);
      assert.equal(parseAndEval('+++2'), 2);
      assert.equal(parseAndEval('+true'), 1);

      assert.equal(parseAndEval('4*+2'), 8);
      assert.equal(parseAndEval('4 * +2'), 8);
      assert.equal(parseAndEval('4-+2'), 2);
      assert.equal(parseAndEval('4 - +2'), 2);
      assert.equal(parseAndEval('4++2'), 6);
      assert.equal(parseAndEval('4 + +2'), 6);

      assert.equal(parseAndEval('5+3'), 8);
      assert.equal(parseAndEval('5++3'), 8);
    });

    it('should parse unary plus and minus  +, -', function() {
      assert.equal(parseAndEval('-+2'), -2);
      assert.equal(parseAndEval('-+-2'), 2);
      assert.equal(parseAndEval('+-+-2'), 2);
      assert.equal(parseAndEval('+-2'), -2);
      assert.equal(parseAndEval('+-+2'), -2);
      assert.equal(parseAndEval('+-+-2'), 2);
    });

    it('should parse unequal !=', function() {
      assert.strictEqual(parseAndEval('2 != 3'), true);
      assert.strictEqual(parseAndEval('2 != 2'), false);
      assert.deepEqual(parseAndEval('[2,3] != [2,4]'), new Matrix([false, true]));
    });

    it('should parse conditional expression a ? b : c', function() {
      assert.equal(parseAndEval('2 ? true : false'), true);
      assert.equal(parseAndEval('0 ? true : false'), false);
      assert.equal(parseAndEval('false ? true : false'), false);

      assert.equal(parseAndEval('2 > 0 ? 1 : 2 < 0 ? -1 : 0'), 1);
      assert.equal(parseAndEval('(2 > 0 ? 1 : 2 < 0) ? -1 : 0'), -1);
      assert.equal(parseAndEval('-2 > 0 ? 1 : -2 < 0 ? -1 : 0'), -1);
      assert.equal(parseAndEval('0 > 0 ? 1 : 0 < 0 ? -1 : 0'), 0);
    });

    it('should lazily evaluate conditional expression a ? b : c', function() {
      var scope = {};
      math.parse('true ? (a = 2) : (b = 2)').compile(math).eval(scope);
      assert.deepEqual(scope, {a: 2});
    });

    it('should throw an error when false part of conditional expression is missing', function() {
      assert.throws(function() {parseAndEval('2 ? true')}, /False part of conditional expression expected/);
    });

    it('should parse : (range)', function() {
      assert.ok(parseAndEval('2:5') instanceof Matrix);
      assert.deepEqual(parseAndEval('2:5'), new Matrix([2,3,4,5]));
      assert.deepEqual(parseAndEval('10:-2:0'), new Matrix([10,8,6,4,2,0]));
      assert.deepEqual(parseAndEval('2:4.0'), new Matrix([2,3,4]));
      assert.deepEqual(parseAndEval('2:4.5'), new Matrix([2,3,4]));
      assert.deepEqual(parseAndEval('2:4.1'), new Matrix([2,3,4]));
      assert.deepEqual(parseAndEval('2:3.9'), new Matrix([2,3]));
      assert.deepEqual(parseAndEval('2:3.5'), new Matrix([2,3]));
      assert.deepEqual(parseAndEval('3:-1:0.5'), new Matrix([3,2,1]));
      assert.deepEqual(parseAndEval('3:-1:0.5'), new Matrix([3,2,1]));
      assert.deepEqual(parseAndEval('3:-1:0.1'), new Matrix([3,2,1]));
      assert.deepEqual(parseAndEval('3:-1:-0.1'), new Matrix([3,2,1,0]));
    });

    it('should parse to', function() {
      approx.deepEqual(parseAndEval('2.54 cm to inch'), math.unit(1, 'inch').to('inch'));
      approx.deepEqual(parseAndEval('2.54 cm + 2 inch to foot'), math.unit(0.25, 'foot').to('foot'));
    });

    it('should parse in', function() {
      approx.deepEqual(parseAndEval('2.54 cm in inch'), math.unit(1, 'inch').to('inch'));
    });

    it('should parse factorial !', function() {
      assert.deepEqual(parseAndEval('5!'), 120);
      assert.deepEqual(parseAndEval('[1,2,3,4]!'), new Matrix([1,2,6,24]));
      assert.deepEqual(parseAndEval('4!+2'), 26);
      assert.deepEqual(parseAndEval('4!-2'), 22);
      assert.deepEqual(parseAndEval('4!*2'), 48);
      assert.deepEqual(parseAndEval('3!!'), 720);
      assert.deepEqual(parseAndEval('[1,2;3,1]!\'!'), new Matrix([[1, 720], [2, 1]]));
      assert.deepEqual(parseAndEval('[4,5]![2,2]'), 24*2 + 120*2); // implicit multiplication
    });

    it('should parse transpose \'', function() {
      assert.deepEqual(parseAndEval('23\''), 23);
      assert.deepEqual(parseAndEval('[1,2,3;4,5,6]\''), new Matrix([[1,4],[2,5],[3,6]]));
      assert.ok(parseAndEval('[1,2,3;4,5,6]\'') instanceof Matrix);
      assert.deepEqual(parseAndEval('[1:5]'), new Matrix([[1,2,3,4,5]]));
      assert.deepEqual(parseAndEval('[1:5]\''), new Matrix([[1],[2],[3],[4],[5]]));
      assert.deepEqual(parseAndEval('size([1:5])'), new Matrix([1, 5]));
      assert.deepEqual(parseAndEval('[1,2;3,4]\''), new Matrix([[1,3],[2,4]]));
    });

    describe('operator precedence', function() {
      it('should respect precedence of plus and minus', function () {
        assert.equal(parseAndEval('4-2+3'), 5);
        assert.equal(parseAndEval('4-(2+3)'), -1);
        assert.equal(parseAndEval('4-2-3'), -1);
        assert.equal(parseAndEval('4-(2-3)'), 5);
      });

      it('should respect precedence of plus/minus and multiply/divide', function () {
        assert.equal(parseAndEval('2+3*4'), 14);
        assert.equal(parseAndEval('2*3+4'), 10);
      });

      it('should respect precedence of plus/minus and pow', function () {
        assert.equal(parseAndEval('2+3^2'), 11);
        assert.equal(parseAndEval('3^2+2'), 11);
        assert.equal(parseAndEval('8-2^2'), 4);
        assert.equal(parseAndEval('4^2-2'), 14);
      });

      it('should respect precedence of multiply/divide and pow', function () {
        assert.equal(parseAndEval('2*3^2'), 18);
        assert.equal(parseAndEval('3^2*2'), 18);
        assert.equal(parseAndEval('8/2^2'), 2);
        assert.equal(parseAndEval('4^2/2'), 8);
      });

      it('should respect precedence of pow', function () {
        assert.equal(parseAndEval('2^3'), 8);
        assert.equal(parseAndEval('2^3^4'), Math.pow(2, Math.pow(3, 4)));
        assert.equal(parseAndEval('1.5^1.5^1.5'), parseAndEval('1.5^(1.5^1.5)'));
        assert.equal(parseAndEval('1.5^1.5^1.5^1.5'), parseAndEval('1.5^(1.5^(1.5^1.5))'));
      });

      it('should respect precedence of unary plus and minus and pow', function () {
        assert.equal(parseAndEval('-3^2'), -9);
        assert.equal(parseAndEval('(-3)^2'), 9);
        assert.equal(parseAndEval('2^-2'), 0.25);
        assert.equal(parseAndEval('2^(-2)'), 0.25);

        assert.equal(parseAndEval('+3^2'), 9);
        assert.equal(parseAndEval('(+3)^2'), 9);
        assert.equal(parseAndEval('2^(+2)'), 4);
      });

      it('should respect precedence of factorial and pow', function () {
        assert.equal(parseAndEval('2^3!'), 64);
        assert.equal(parseAndEval('2^(3!)'), 64);
        assert.equal(parseAndEval('3!^2'), 36);
      });

      it('should respect precedence of factorial and (unary) plus/minus', function () {
        assert.equal(parseAndEval('-4!'), -24);
        assert.equal(parseAndEval('-(4!)'), -24);
        assert.equal(parseAndEval('3!+2'), 8);
        assert.equal(parseAndEval('(3!)+2'), 8);
        assert.equal(parseAndEval('+4!'), 24);
      });

      it.skip('should respect precedence of transpose', function () {
        // TODO: test transpose
      });

      it('should respect precedence of conditional operator and other operators', function () {
        assert.equal(parseAndEval('2 > 3 ? true : false'), false);
        assert.equal(parseAndEval('2 == 3 ? true : false'), false);
        assert.equal(parseAndEval('3 ? 2 + 4 : 2 - 1'), 6);
        assert.deepEqual(parseAndEval('3 ? true : false; 22'), new ResultSet([22]));
        assert.deepEqual(parseAndEval('3 ? 5cm to m : 5cm in mm'), new Unit(5, 'cm').to('m'));
        assert.deepEqual(parseAndEval('2 == 4-2 ? [1,2] : false'), new Matrix([1,2]));
        assert.deepEqual(parseAndEval('false ? 1:2:6'), new Matrix([2,3,4,5,6]));
      });

      it('should respect precedence of equal operator and conversion operators', function () {
        var node = math.parse('a == b to c'); // (a == b) to c
        assert.equal(node.op, 'to');

        var node2 = math.parse('a to b == c');
        assert.equal(node2.op, 'to');
      });

      it('should respect precedence of conditional operator and relational operators', function () {
        var node = math.parse('a == b ? a > b : a < b');
        assert(node instanceof ConditionalNode);
        assert.equal(node.condition.toString(), 'a == b');
        assert.equal(node.trueExpr.toString(), 'a > b');
        assert.equal(node.falseExpr.toString(), 'a < b');
      });

      it('should respect precedence of conditional operator and range operator', function () {
        var node = math.parse('a ? b : c : d');
        assert(node instanceof ConditionalNode);
        assert.equal(node.condition.toString(), 'a');
        assert.equal(node.trueExpr.toString(), 'b');
        assert.equal(node.falseExpr.toString(), 'c:d');
      });

      it.skip('should respect precedence of range operator and relational operators', function () {
        var node = math.parse('a:b == c:d');
        assert(node instanceof OperatorNode);
        assert.equal(node.params[0].toString(), 'a:b');
        assert.equal(node.params[1].toString(), 'c:d');
      });

      it('should respect precedence of range operator and operator plus and minus', function () {
        var node = math.parse('a + b : c - d');
        assert(node instanceof RangeNode);
        assert.equal(node.start.toString(), 'a + b');
        assert.equal(node.end.toString(), 'c - d');
      });

      // TODO: extensively test operator precedence

    });
  });

  describe('functions', function () {
    describe('functions', function () {
      it('should evaluate function "mod"', function () {
        approx.equal(parseAndEval('mod(8, 3)'), 2);

      });

      it('should evaluate function "to" ', function () {
        approx.deepEqual(parseAndEval('to(5.08 cm * 1000, inch)'),
            math.unit(2000, 'inch').to('inch'));
      });
    });

  });

  describe('bignumber', function () {
    var bigmath = math.create({
      number: 'bignumber'
    });
    var BigNumber = bigmath.type.BigNumber;

    it('should parse numbers as bignumber', function() {
      assert.deepEqual(bigmath.bignumber('2.3'), new BigNumber('2.3'));
      assert.deepEqual(bigmath.eval('2.3'), new BigNumber('2.3'));
      assert.deepEqual(bigmath.eval('2.3e+500'), new BigNumber('2.3e+500'));
    });

    it('should evaluate functions supporting bignumbers', function() {
      assert.deepEqual(bigmath.eval('0.1 + 0.2'), new BigNumber('0.3'));
    });

    it('should evaluate functions supporting bignumbers', function() {
      assert.deepEqual(bigmath.eval('add(0.1, 0.2)'), new BigNumber('0.3'));
    });

    it('should work with mixed numbers and bignumbers', function() {
      approx.equal(bigmath.eval('pi + 1'), 4.141592653589793);
    });

    it('should evaluate functions not supporting bignumbers', function() {
      approx.equal(bigmath.eval('sin(0.1)'), 0.09983341664682815);
    });

    it('should create a range from bignumbers', function() {
      assert.deepEqual(bigmath.eval('4:6'),
          bigmath.matrix([new BigNumber(4), new BigNumber(5), new BigNumber(6)]));
      assert.deepEqual(bigmath.eval('0:2:4'),
          bigmath.matrix([new BigNumber(0), new BigNumber(2), new BigNumber(4)]));
    });

    it('should create a matrix with bignumbers', function() {
      assert.deepEqual(bigmath.eval('[0.1, 0.2]'),
          bigmath.matrix([new BigNumber(0.1), new BigNumber(0.2)]));
    });

    it('should get a elements from a matrix with bignumbers', function() {
      var scope = {};
      assert.deepEqual(bigmath.eval('a=[0.1, 0.2]', scope),
          bigmath.matrix([new BigNumber(0.1), new BigNumber(0.2)]));

      assert.deepEqual(bigmath.eval('a[1]', scope), new BigNumber(0.1));
      assert.deepEqual(bigmath.eval('a[:]', scope),
          bigmath.matrix([new BigNumber(0.1), new BigNumber(0.2)]));
      assert.deepEqual(bigmath.eval('a[1:2]', scope),
          bigmath.matrix([new BigNumber(0.1), new BigNumber(0.2)]));
    });

    it('should replace elements in a matrix with bignumbers', function() {
      var scope = {};
      assert.deepEqual(bigmath.eval('a=[0.1, 0.2]', scope),
          bigmath.matrix([new BigNumber(0.1), new BigNumber(0.2)]));

      assert.deepEqual(bigmath.eval('a[1] = 0.3', scope),
          bigmath.matrix([new BigNumber(0.3), new BigNumber(0.2)]));
      assert.deepEqual(bigmath.eval('a[:] = [0.5, 0.6]', scope),
          bigmath.matrix([new BigNumber(0.5), new BigNumber(0.6)]));
      assert.deepEqual(bigmath.eval('a[1:2] = [0.7, 0.8]', scope),
          bigmath.matrix([new BigNumber(0.7), new BigNumber(0.8)]));
    });

    it('should work with complex numbers (downgrades bignumbers to number)', function() {
      assert.deepEqual(bigmath.eval('3i'), new Complex(0, 3));
      assert.deepEqual(bigmath.eval('2 + 3i'), new Complex(2, 3));
      assert.deepEqual(bigmath.eval('2 * i'), new Complex(0, 2));
    });

    it('should work with units (downgrades bignumbers to number)', function() {
      assert.deepEqual(bigmath.eval('2 cm'), new Unit(2, 'cm'));
    });
  });

  describe('scope', function () {

    it('should use a given scope for assignments', function() {
      var scope = {
        a: 3,
        b: 4
      };
      assert.deepEqual(parse('a*b').compile(math).eval(scope), 12);
      assert.deepEqual(parse('c=5').compile(math).eval(scope), 5);
      assert.deepEqual(parse('f(x) = x^a').compile(math).eval(scope).syntax, 'f(x)');


      assert.deepEqual(Object.keys(scope).length, 4);
      assert.deepEqual(scope.a, 3);
      assert.deepEqual(scope.b, 4);
      assert.deepEqual(scope.c, 5);
      assert.deepEqual(typeof scope.f, 'function');

      assert.equal(scope.f(3), 27);
      scope.a = 2;
      assert.equal(scope.f(3), 9);
      scope.hello = function (name) {
        return 'hello, ' + name + '!';
      };
      assert.deepEqual(parse('hello("jos")').compile(math).eval(scope), 'hello, jos!');
    });

    it('should parse undefined symbols, defining symbols, and removing symbols', function() {
      var scope = {};
      var n = parse('q');
      assert.throws(function () { n.compile(math).eval(scope); });
      parse('q=33').compile(math).eval(scope);
      assert.equal(n.compile(math).eval(scope), 33);
      delete scope.q;
      assert.throws(function () { n.compile(math).eval(scope); });

      n = parse('qq[1,1]=33');
      assert.throws(function () { n.compile(math).eval(scope); });
      parse('qq=[1,2;3,4]').compile(math).eval(scope);
      assert.deepEqual(n.compile(math).eval(scope), new Matrix([[33,2],[3,4]]));
      parse('qq=[4]').compile(math).eval(scope);
      assert.deepEqual(n.compile(math).eval(scope), new Matrix([[33]]));
      delete scope.qq;
      assert.throws(function () { n.compile(math).eval(scope); });
    });

    it('should evaluate a symbol with value null or undefined', function () {
      assert.equal(parse('a').compile(math).eval({a: null}), null);
      assert.equal(parse('a').compile(math).eval({a: undefined}), undefined);
    });

  });

  describe('errors', function () {

    it('should return IndexErrors with one based indices', function () {
      // functions throw a zero-based error
      assert.throws(function () {math.subset([1,2,3], math.index(4))}, /Index out of range \(4 > 2\)/);
      assert.throws(function () {math.subset([1,2,3], math.index(-2))}, /Index out of range \(-2 < 0\)/);

      // evaluation via parser throws one-based error
      assert.throws(function () {math.eval('A[4]', {A:[1,2,3]})}, /Index out of range \(4 > 3\)/);
      assert.throws(function () {math.eval('A[-2]', {A: [1,2,3]})}, /Index out of range \(-2 < 1\)/);
    });

    it('should return DimensionErrors with one based indices (subset)', function () {
      // TODO: it would be more clear when all errors where DimensionErrors

      // functions throw a zero-based error
      assert.throws(function () {math.subset([1,2,3], math.index(1,1))}, /DimensionError: Dimension mismatch \(2 != 1\)/);

      // evaluation via parser throws one-based error
      assert.throws(function () {math.eval('A[1,1]', {A: [1,2,3]})}, /DimensionError: Dimension mismatch \(2 != 1\)/);
    });

    it('should return DimensionErrors with one based indices (concat)', function () {
      // TODO: it would be more clear when all errors where DimensionErrors

      // functions throw a zero-based error
      assert.throws(function () {math.concat([1,2], [[3,4]])}, /DimensionError: Dimension mismatch \(1 != 2\)/);
      assert.throws(function () {math.concat([[1,2]], [[3,4]], 2)}, /IndexError: Index out of range \(2 > 1\)/);
      assert.throws(function () {math.concat([[1,2]], [[3,4]], -1)}, /IndexError: Index out of range \(-1 < 0\)/);

      // evaluation via parser throws one-based error
      assert.throws(function () {math.eval('concat([1,2], [[3,4]])')}, /DimensionError: Dimension mismatch \(1 != 2\)/);
      assert.throws(function () {math.eval('concat([[1,2]], [[3,4]], 3)')}, /IndexError: Index out of range \(3 > 2\)/);
      assert.throws(function () {math.eval('concat([[1,2]], [[3,4]], 0)')}, /IndexError: Index out of range \(0 < 1\)/);
    });

    it('should return DimensionErrors with one based indices (max)', function () {
      // TODO: it would be more clear when all errors where DimensionErrors

      // functions throw a zero-based error
      // TODO

      // evaluation via parser throws one-based error
      assert.deepEqual(math.eval('max([[1,2], [3,4]])'), 4);
      assert.deepEqual(math.eval('max([[1,2], [3,4]], 1)'), new Matrix([3, 4]));
      assert.deepEqual(math.eval('max([[1,2], [3,4]], 2)'), new Matrix([2, 4]));
      assert.throws(function () {math.eval('max([[1,2], [3,4]], 3)')}, /IndexError: Index out of range \(3 > 2\)/);
      assert.throws(function () {math.eval('max([[1,2], [3,4]], 0)')}, /IndexError: Index out of range \(0 < 1\)/);
    });

    it('should return DimensionErrors with one based indices (min)', function () {
      // TODO: it would be more clear when all errors where DimensionErrors

      // functions throw a zero-based error
      // TODO

      // evaluation via parser throws one-based error
      assert.deepEqual(math.eval('min([[1,2], [3,4]])'), 1);
      assert.deepEqual(math.eval('min([[1,2], [3,4]], 1)'), new Matrix([1, 2]));
      assert.deepEqual(math.eval('min([[1,2], [3,4]], 2)'), new Matrix([1, 3]));
      assert.throws(function () {math.eval('min([[1,2], [3,4]], 3)')}, /IndexError: Index out of range \(3 > 2\)/);
      assert.throws(function () {math.eval('min([[1,2], [3,4]], 0)')}, /IndexError: Index out of range \(0 < 1\)/);
    });

    it('should return DimensionErrors with one based indices (mean)', function () {
      // TODO: it would be more clear when all errors where DimensionErrors

      // functions throw a zero-based error
      // TODO

      // evaluation via parser throws one-based error
      assert.deepEqual(math.eval('mean([[1,2], [3,4]])'), 2.5);
      assert.deepEqual(math.eval('mean([[1,2], [3,4]], 1)'), new Matrix([2, 3]));
      assert.deepEqual(math.eval('mean([[1,2], [3,4]], 2)'), new Matrix([1.5, 3.5]));
      assert.throws(function () {math.eval('mean([[1,2], [3,4]], 3)')}, /IndexError: Index out of range \(3 > 2\)/);
      assert.throws(function () {math.eval('mean([[1,2], [3,4]], 0)')}, /IndexError: Index out of range \(0 < 1\)/);
    });

  });

  describe('node tree', function () {

    // TODO: test parsing into a node tree

    it('should correctly stringify a node tree', function() {
      assert.equal(parse('0').toString(), '0');
      assert.equal(parse('"hello"').toString(), '"hello"');
      assert.equal(parse('[1, 2 + 3i, 4]').toString(), '[1, 2 + (3 * i), 4]');
      assert.equal(parse('1/2a').toString(), '(1 / 2) * a');
    });

    describe('custom nodes', function () {
      // define a custom node
      function CustomNode (args) {
        this.args = args;
      }
      CustomNode.prototype = new math.expression.node.Node();
      CustomNode.prototype.toString = function () {
        return 'CustomNode';
      };
      CustomNode.prototype._compile = function (defs) {
        var strArgs = [];
        this.args.forEach(function (arg) {
          strArgs.push(arg.toString());
        });
        return '"CustomNode(' + strArgs.join(', ') + ')"';
      };

      var options = {
        nodes: {
          custom: CustomNode
        }
      };

      it('should parse custom nodes', function() {
        var node = parse('custom(x, (2+x), sin(x))', options);
        assert.equal(node.compile(math).eval(), 'CustomNode(x, 2 + x, sin(x))');
      });

      it('should parse custom nodes without parameters', function() {
        var node = parse('custom()', options);
        assert.equal(node.compile(math).eval(), 'CustomNode()');
        assert.equal(node.find({type: CustomNode}).length, 1);

        var node2 = parse('custom', options);
        assert.equal(node2.compile(math).eval(), 'CustomNode()');
        assert.equal(node2.find({type: CustomNode}).length, 1);
      });

      it('should throw an error on syntax errors in using custom nodes', function() {
        assert.throws(function () {parse('custom(x', options)}, /Parenthesis \) expected/);
        assert.throws(function () {parse('custom(x, ', options)}, /Unexpected end of expression/);
      });
    });

  });

});
