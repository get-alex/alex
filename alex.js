(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.alex = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer
 * @license MIT
 * @module alex
 * @fileoverview
 *   alex checks your (or someone else’s) writing for possible
 *   inconsiderate wording.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var VFile = require('vfile');
var remark = require('remark');
var retext = require('retext');
var english = require('retext-english');
var equality = require('retext-equality');
var remark2retext = require('remark-retext');
var sort = require('vfile-sort');

/*
 * Processor.
 */

var text = retext().use(english).use(equality);
var markdown = remark().use(remark2retext, text);

/**
 * Wrap the given processor.
 *
 * @param {Processor} processor - Remark or Retext.
 */
function factory(processor) {
    /**
     * alex.
     *
     * Read markdown as input, converts to natural language,
     * then detect violations.
     *
     * @example
     *   alex('We’ve confirmed his identity.').messages;
     *   // [ { [1:17-1:20: `his` may be insensitive, use `their`, `theirs` instead]
     *   //   name: '1:17-1:20',
     *   //   file: '',
     *   //   reason: '`his` may be insensitive, use `their`, `theirs` instead',
     *   //   line: 1,
     *   //   column: 17,
     *   //   fatal: false } ]
     *
     * @param {string|VFile} value - Content
     * @return {VFile} - Result.
     */
    return function (value) {
        var file = new VFile(value);

        processor.parse(file);
        processor.run(file);

        sort(file);

        return file;
    }
}

/*
 * Expose.
 */

var alex = factory(markdown);

alex.text = factory(text);
alex.markdown = alex;

module.exports = alex;

},{"remark":56,"remark-retext":54,"retext":68,"retext-english":64,"retext-equality":65,"vfile":81,"vfile-sort":80}],2:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer
 * @license MIT
 * @module array-iterate
 * @fileoverview `forEach` with the possibility to change the next position.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Methods.
 */

var has = Object.prototype.hasOwnProperty;

/**
 * Callback given to `iterate`.
 *
 * @callback iterate~callback
 * @this {*} - `context`, when given to `iterate`.
 * @param {*} value - Current iteration.
 * @param {number} index - Position of `value` in `values`.
 * @param {{length: number}} values - Currently iterated over.
 * @return {number?} - Position to go to next.
 */

/**
 * `Array#forEach()` with the possibility to change
 * the next position.
 *
 * @param {{length: number}} values - Values.
 * @param {arrayIterate~callback} callback - Callback given to `iterate`.
 * @param {*?} [context] - Context object to use when invoking `callback`.
 */
function iterate(values, callback, context) {
    var index = -1;
    var result;

    if (!values) {
        throw new Error(
            'TypeError: Iterate requires that |this| ' +
            'not be ' + values
        );
    }

    if (!has.call(values, 'length')) {
        throw new Error(
            'TypeError: Iterate requires that |this| ' +
            'has a `length`'
        );
    }

    if (typeof callback !== 'function') {
        throw new Error(
            'TypeError: callback must be a function'
        );
    }

    /*
     * The length might change, so we do not cache it.
     */

    while (++index < values.length) {
        /*
         * Skip missing values.
         */

        if (!(index in values)) {
            continue;
        }

        result = callback.call(context, values[index], index, values);

        /*
         * If `callback` returns a `number`, move `index` over to
         * `number`.
         */

        if (typeof result === 'number') {
            /*
             * Make sure that negative numbers do not
             * break the loop.
             */

            if (result < 0) {
                index = 0;
            }

            index = result - 1;
        }
    }
}

/*
 * Expose.
 */

module.exports = iterate;

},{}],3:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer
 * @license MIT
 * @module attach-ware
 * @fileoverview Middleware with configuration.
 * @example
 *   var ware = require('attach-ware')(require('ware'));
 *
 *   var middleware = ware()
 *     .use(function (context, options) {
 *         if (!options.condition) return;
 *
 *         return function (req, res, next) {
 *           res.x = 'hello';
 *           next();
 *         };
 *     }, {
 *         'condition': true
 *     })
 *     .use(function (context, options) {
 *         if (!options.condition) return;
 *
 *         return function (req, res, next) {
 *           res.y = 'world';
 *           next();
 *         };
 *     }, {
 *         'condition': false
 *     });
 *
 *   middleware.run({}, {}, function (err, req, res) {
 *     res.x; // "hello"
 *     res.y; // undefined
 *   });
 */

'use strict';

var slice = [].slice;
var unherit = require('unherit');

/**
 * Clone `Ware` without affecting the super-class and
 * turn it into configurable middleware.
 *
 * @param {Function} Ware - Ware-like constructor.
 * @return {Function} AttachWare - Configurable middleware.
 */
function patch(Ware) {
    /*
     * Methods.
     */

    var useFn = Ware.prototype.use;

    /**
     * @constructor
     * @class {AttachWare}
     */
    var AttachWare = unherit(Ware);

    AttachWare.prototype.foo = true;

    /**
     * Attach configurable middleware.
     *
     * @memberof {AttachWare}
     * @this {AttachWare}
     * @param {Function} attach
     * @return {AttachWare} - `this`.
     */
    function use(attach) {
        var self = this;
        var params = slice.call(arguments, 1);
        var index;
        var length;
        var fn;

        /*
         * Accept other `AttachWare`.
         */

        if (attach instanceof AttachWare) {
            if (attach.attachers) {
                return self.use(attach.attachers);
            }

            return self;
        }

        /*
         * Accept normal ware.
         */

        if (attach instanceof Ware) {
            self.fns = self.fns.concat(attach.fns);
            return self;
        }

        /*
         * Multiple attachers.
         */

        if ('length' in attach && typeof attach !== 'function') {
            index = -1;
            length = attach.length;

            while (++index < length) {
                self.use.apply(self, [attach[index]].concat(params));
            }

            return self;
        }

        /*
         * Single attacher.
         */

        fn = attach.apply(null, [self.context || self].concat(params));

        /*
         * Store the attacher to not break `new Ware(otherWare)`
         * functionality.
         */

        if (!self.attachers) {
            self.attachers = [];
        }

        self.attachers.push(attach);

        /*
         * Pass `fn` to the original `Ware#use()`.
         */

        if (fn) {
            useFn.call(self, fn);
        }

        return self;
    }

    AttachWare.prototype.use = use;

    return function (fn) {
        return new AttachWare(fn);
    };
}

module.exports = patch;

},{"unherit":74}],4:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer. All rights reserved.
 * @module bail
 * @fileoverview Throw a given error.
 */

'use strict';

/**
 * Throw a given error.
 *
 * @example
 *   bail();
 *
 * @example
 *   bail(new Error('failure'));
 *   // Error: failure
 *   //     at repl:1:6
 *   //     at REPLServer.defaultEval (repl.js:154:27)
 *   //     ...
 *
 * @param {Error?} [err] - Optional error.
 * @throws {Error} - `err`, when given.
 */
function bail(err) {
    if (err) {
        throw err;
    }
}

/*
 * Expose.
 */

module.exports = bail;

},{}],5:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)
	var PLUS_URL_SAFE = '-'.charCodeAt(0)
	var SLASH_URL_SAFE = '_'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS ||
		    code === PLUS_URL_SAFE)
			return 62 // '+'
		if (code === SLASH ||
		    code === SLASH_URL_SAFE)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],6:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('is-array')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var rootParent = {}

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Safari 5-7 lacks support for changing the `Object.prototype.constructor` property
 *     on objects.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

function typedArraySupport () {
  function Bar () {}
  try {
    var arr = new Uint8Array(1)
    arr.foo = function () { return 42 }
    arr.constructor = Bar
    return arr.foo() === 42 && // typed array instances can be augmented
        arr.constructor === Bar && // constructor can be set
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (arg) {
  if (!(this instanceof Buffer)) {
    // Avoid going through an ArgumentsAdaptorTrampoline in the common case.
    if (arguments.length > 1) return new Buffer(arg, arguments[1])
    return new Buffer(arg)
  }

  this.length = 0
  this.parent = undefined

  // Common case.
  if (typeof arg === 'number') {
    return fromNumber(this, arg)
  }

  // Slightly less common case.
  if (typeof arg === 'string') {
    return fromString(this, arg, arguments.length > 1 ? arguments[1] : 'utf8')
  }

  // Unusual.
  return fromObject(this, arg)
}

function fromNumber (that, length) {
  that = allocate(that, length < 0 ? 0 : checked(length) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < length; i++) {
      that[i] = 0
    }
  }
  return that
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') encoding = 'utf8'

  // Assumption: byteLength() return value is always < kMaxLength.
  var length = byteLength(string, encoding) | 0
  that = allocate(that, length)

  that.write(string, encoding)
  return that
}

function fromObject (that, object) {
  if (Buffer.isBuffer(object)) return fromBuffer(that, object)

  if (isArray(object)) return fromArray(that, object)

  if (object == null) {
    throw new TypeError('must start with number, buffer, array or string')
  }

  if (typeof ArrayBuffer !== 'undefined') {
    if (object.buffer instanceof ArrayBuffer) {
      return fromTypedArray(that, object)
    }
    if (object instanceof ArrayBuffer) {
      return fromArrayBuffer(that, object)
    }
  }

  if (object.length) return fromArrayLike(that, object)

  return fromJsonObject(that, object)
}

function fromBuffer (that, buffer) {
  var length = checked(buffer.length) | 0
  that = allocate(that, length)
  buffer.copy(that, 0, 0, length)
  return that
}

function fromArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Duplicate of fromArray() to keep fromArray() monomorphic.
function fromTypedArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  // Truncating the elements is probably not what people expect from typed
  // arrays with BYTES_PER_ELEMENT > 1 but it's compatible with the behavior
  // of the old Buffer constructor.
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array) {
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    array.byteLength
    that = Buffer._augment(new Uint8Array(array))
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromTypedArray(that, new Uint8Array(array))
  }
  return that
}

function fromArrayLike (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Deserialize { type: 'Buffer', data: [1,2,3,...] } into a Buffer object.
// Returns a zero-length buffer for inputs that don't conform to the spec.
function fromJsonObject (that, object) {
  var array
  var length = 0

  if (object.type === 'Buffer' && isArray(object.data)) {
    array = object.data
    length = checked(array.length) | 0
  }
  that = allocate(that, length)

  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
}

function allocate (that, length) {
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = Buffer._augment(new Uint8Array(length))
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that.length = length
    that._isBuffer = true
  }

  var fromPool = length !== 0 && length <= Buffer.poolSize >>> 1
  if (fromPool) that.parent = rootParent

  return that
}

function checked (length) {
  // Note: cannot use `length < kMaxLength` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (subject, encoding) {
  if (!(this instanceof SlowBuffer)) return new SlowBuffer(subject, encoding)

  var buf = new Buffer(subject, encoding)
  delete buf.parent
  return buf
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  var i = 0
  var len = Math.min(x, y)
  while (i < len) {
    if (a[i] !== b[i]) break

    ++i
  }

  if (i !== len) {
    x = a[i]
    y = b[i]
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) throw new TypeError('list argument must be an Array of Buffers.')

  if (list.length === 0) {
    return new Buffer(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; i++) {
      length += list[i].length
    }
  }

  var buf = new Buffer(length)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

function byteLength (string, encoding) {
  if (typeof string !== 'string') string = '' + string

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'binary':
      // Deprecated
      case 'raw':
      case 'raws':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

// pre-set for values that may exist in the future
Buffer.prototype.length = undefined
Buffer.prototype.parent = undefined

function slowToString (encoding, start, end) {
  var loweredCase = false

  start = start | 0
  end = end === undefined || end === Infinity ? this.length : end | 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return 0
  return Buffer.compare(this, b)
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset) {
  if (byteOffset > 0x7fffffff) byteOffset = 0x7fffffff
  else if (byteOffset < -0x80000000) byteOffset = -0x80000000
  byteOffset >>= 0

  if (this.length === 0) return -1
  if (byteOffset >= this.length) return -1

  // Negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

  if (typeof val === 'string') {
    if (val.length === 0) return -1 // special case: looking for empty string always fails
    return String.prototype.indexOf.call(this, val, byteOffset)
  }
  if (Buffer.isBuffer(val)) {
    return arrayIndexOf(this, val, byteOffset)
  }
  if (typeof val === 'number') {
    if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
      return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
    }
    return arrayIndexOf(this, [ val ], byteOffset)
  }

  function arrayIndexOf (arr, val, byteOffset) {
    var foundIndex = -1
    for (var i = 0; byteOffset + i < arr.length; i++) {
      if (arr[byteOffset + i] === val[foundIndex === -1 ? 0 : i - foundIndex]) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === val.length) return byteOffset + foundIndex
      } else {
        foundIndex = -1
      }
    }
    return -1
  }

  throw new TypeError('val must be string, number or Buffer')
}

// `get` is deprecated
Buffer.prototype.get = function get (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` is deprecated
Buffer.prototype.set = function set (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) throw new Error('Invalid hex string')
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    var swap = encoding
    encoding = offset
    offset = length | 0
    length = swap
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'binary':
        return binaryWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
  }

  if (newBuf.length) newBuf.parent = this.parent || this

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
  if (offset < 0) throw new RangeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; i--) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; i++) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), targetStart)
  }

  return len
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function fill (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new RangeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new RangeError('start out of bounds')
  if (end < 0 || end > this.length) throw new RangeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function toArrayBuffer () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function _augment (arr) {
  arr.constructor = Buffer
  arr._isBuffer = true

  // save reference to original Uint8Array set method before overwriting
  arr._set = arr.set

  // deprecated
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.indexOf = BP.indexOf
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUIntLE = BP.readUIntLE
  arr.readUIntBE = BP.readUIntBE
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readIntLE = BP.readIntLE
  arr.readIntBE = BP.readIntBE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUIntLE = BP.writeUIntLE
  arr.writeUIntBE = BP.writeUIntBE
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeIntLE = BP.writeIntLE
  arr.writeIntBE = BP.writeIntBE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; i++) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"base64-js":5,"ieee754":21,"is-array":23}],7:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer. All rights reserved.
 * @module ccount
 * @fileoverview Count characters.
 */

'use strict';

/**
 * Count how many characters `character` occur in `value`.
 *
 * @example
 *   ccount('foo(bar(baz)', '(') // 2
 *   ccount('foo(bar(baz)', ')') // 1
 *
 * @param {string} value - Content, coerced to string.
 * @param {string} character - Single character to look
 *   for.
 * @return {number} - Count.
 * @throws {Error} - when `character` is not a single
 *   character.
 */
function ccount(value, character) {
    var index = -1;
    var count = 0;
    var length;

    value = String(value);
    length = value.length;

    if (typeof character !== 'string' || character.length !== 1) {
        throw new Error('Expected character');
    }

    while (++index < length) {
        if (value.charAt(index) === character) {
            count++;
        }
    }

    return count;
}

/*
 * Expose.
 */

module.exports = ccount;

},{}],8:[function(require,module,exports){
module.exports={
  "nbsp": " ",
  "iexcl": "¡",
  "cent": "¢",
  "pound": "£",
  "curren": "¤",
  "yen": "¥",
  "brvbar": "¦",
  "sect": "§",
  "uml": "¨",
  "copy": "©",
  "ordf": "ª",
  "laquo": "«",
  "not": "¬",
  "shy": "­",
  "reg": "®",
  "macr": "¯",
  "deg": "°",
  "plusmn": "±",
  "sup2": "²",
  "sup3": "³",
  "acute": "´",
  "micro": "µ",
  "para": "¶",
  "middot": "·",
  "cedil": "¸",
  "sup1": "¹",
  "ordm": "º",
  "raquo": "»",
  "frac14": "¼",
  "frac12": "½",
  "frac34": "¾",
  "iquest": "¿",
  "Agrave": "À",
  "Aacute": "Á",
  "Acirc": "Â",
  "Atilde": "Ã",
  "Auml": "Ä",
  "Aring": "Å",
  "AElig": "Æ",
  "Ccedil": "Ç",
  "Egrave": "È",
  "Eacute": "É",
  "Ecirc": "Ê",
  "Euml": "Ë",
  "Igrave": "Ì",
  "Iacute": "Í",
  "Icirc": "Î",
  "Iuml": "Ï",
  "ETH": "Ð",
  "Ntilde": "Ñ",
  "Ograve": "Ò",
  "Oacute": "Ó",
  "Ocirc": "Ô",
  "Otilde": "Õ",
  "Ouml": "Ö",
  "times": "×",
  "Oslash": "Ø",
  "Ugrave": "Ù",
  "Uacute": "Ú",
  "Ucirc": "Û",
  "Uuml": "Ü",
  "Yacute": "Ý",
  "THORN": "Þ",
  "szlig": "ß",
  "agrave": "à",
  "aacute": "á",
  "acirc": "â",
  "atilde": "ã",
  "auml": "ä",
  "aring": "å",
  "aelig": "æ",
  "ccedil": "ç",
  "egrave": "è",
  "eacute": "é",
  "ecirc": "ê",
  "euml": "ë",
  "igrave": "ì",
  "iacute": "í",
  "icirc": "î",
  "iuml": "ï",
  "eth": "ð",
  "ntilde": "ñ",
  "ograve": "ò",
  "oacute": "ó",
  "ocirc": "ô",
  "otilde": "õ",
  "ouml": "ö",
  "divide": "÷",
  "oslash": "ø",
  "ugrave": "ù",
  "uacute": "ú",
  "ucirc": "û",
  "uuml": "ü",
  "yacute": "ý",
  "thorn": "þ",
  "yuml": "ÿ",
  "fnof": "ƒ",
  "Alpha": "Α",
  "Beta": "Β",
  "Gamma": "Γ",
  "Delta": "Δ",
  "Epsilon": "Ε",
  "Zeta": "Ζ",
  "Eta": "Η",
  "Theta": "Θ",
  "Iota": "Ι",
  "Kappa": "Κ",
  "Lambda": "Λ",
  "Mu": "Μ",
  "Nu": "Ν",
  "Xi": "Ξ",
  "Omicron": "Ο",
  "Pi": "Π",
  "Rho": "Ρ",
  "Sigma": "Σ",
  "Tau": "Τ",
  "Upsilon": "Υ",
  "Phi": "Φ",
  "Chi": "Χ",
  "Psi": "Ψ",
  "Omega": "Ω",
  "alpha": "α",
  "beta": "β",
  "gamma": "γ",
  "delta": "δ",
  "epsilon": "ε",
  "zeta": "ζ",
  "eta": "η",
  "theta": "θ",
  "iota": "ι",
  "kappa": "κ",
  "lambda": "λ",
  "mu": "μ",
  "nu": "ν",
  "xi": "ξ",
  "omicron": "ο",
  "pi": "π",
  "rho": "ρ",
  "sigmaf": "ς",
  "sigma": "σ",
  "tau": "τ",
  "upsilon": "υ",
  "phi": "φ",
  "chi": "χ",
  "psi": "ψ",
  "omega": "ω",
  "thetasym": "ϑ",
  "upsih": "ϒ",
  "piv": "ϖ",
  "bull": "•",
  "hellip": "…",
  "prime": "′",
  "Prime": "″",
  "oline": "‾",
  "frasl": "⁄",
  "weierp": "℘",
  "image": "ℑ",
  "real": "ℜ",
  "trade": "™",
  "alefsym": "ℵ",
  "larr": "←",
  "uarr": "↑",
  "rarr": "→",
  "darr": "↓",
  "harr": "↔",
  "crarr": "↵",
  "lArr": "⇐",
  "uArr": "⇑",
  "rArr": "⇒",
  "dArr": "⇓",
  "hArr": "⇔",
  "forall": "∀",
  "part": "∂",
  "exist": "∃",
  "empty": "∅",
  "nabla": "∇",
  "isin": "∈",
  "notin": "∉",
  "ni": "∋",
  "prod": "∏",
  "sum": "∑",
  "minus": "−",
  "lowast": "∗",
  "radic": "√",
  "prop": "∝",
  "infin": "∞",
  "ang": "∠",
  "and": "∧",
  "or": "∨",
  "cap": "∩",
  "cup": "∪",
  "int": "∫",
  "there4": "∴",
  "sim": "∼",
  "cong": "≅",
  "asymp": "≈",
  "ne": "≠",
  "equiv": "≡",
  "le": "≤",
  "ge": "≥",
  "sub": "⊂",
  "sup": "⊃",
  "nsub": "⊄",
  "sube": "⊆",
  "supe": "⊇",
  "oplus": "⊕",
  "otimes": "⊗",
  "perp": "⊥",
  "sdot": "⋅",
  "lceil": "⌈",
  "rceil": "⌉",
  "lfloor": "⌊",
  "rfloor": "⌋",
  "lang": "〈",
  "rang": "〉",
  "loz": "◊",
  "spades": "♠",
  "clubs": "♣",
  "hearts": "♥",
  "diams": "♦",
  "quot": "\"",
  "amp": "&",
  "lt": "<",
  "gt": ">",
  "OElig": "Œ",
  "oelig": "œ",
  "Scaron": "Š",
  "scaron": "š",
  "Yuml": "Ÿ",
  "circ": "ˆ",
  "tilde": "˜",
  "ensp": " ",
  "emsp": " ",
  "thinsp": " ",
  "zwnj": "‌",
  "zwj": "‍",
  "lrm": "‎",
  "rlm": "‏",
  "ndash": "–",
  "mdash": "—",
  "lsquo": "‘",
  "rsquo": "’",
  "sbquo": "‚",
  "ldquo": "“",
  "rdquo": "”",
  "bdquo": "„",
  "dagger": "†",
  "Dagger": "‡",
  "permil": "‰",
  "lsaquo": "‹",
  "rsaquo": "›",
  "euro": "€"
}

},{}],9:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer
 * @license MIT
 * @module character-entities-html4
 * @fileoverview HTML4 character entity information.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Expose.
 */

module.exports = require('./index.json');

},{"./index.json":8}],10:[function(require,module,exports){
module.exports={
  "AElig": "Æ",
  "AMP": "&",
  "Aacute": "Á",
  "Acirc": "Â",
  "Agrave": "À",
  "Aring": "Å",
  "Atilde": "Ã",
  "Auml": "Ä",
  "COPY": "©",
  "Ccedil": "Ç",
  "ETH": "Ð",
  "Eacute": "É",
  "Ecirc": "Ê",
  "Egrave": "È",
  "Euml": "Ë",
  "GT": ">",
  "Iacute": "Í",
  "Icirc": "Î",
  "Igrave": "Ì",
  "Iuml": "Ï",
  "LT": "<",
  "Ntilde": "Ñ",
  "Oacute": "Ó",
  "Ocirc": "Ô",
  "Ograve": "Ò",
  "Oslash": "Ø",
  "Otilde": "Õ",
  "Ouml": "Ö",
  "QUOT": "\"",
  "REG": "®",
  "THORN": "Þ",
  "Uacute": "Ú",
  "Ucirc": "Û",
  "Ugrave": "Ù",
  "Uuml": "Ü",
  "Yacute": "Ý",
  "aacute": "á",
  "acirc": "â",
  "acute": "´",
  "aelig": "æ",
  "agrave": "à",
  "amp": "&",
  "aring": "å",
  "atilde": "ã",
  "auml": "ä",
  "brvbar": "¦",
  "ccedil": "ç",
  "cedil": "¸",
  "cent": "¢",
  "copy": "©",
  "curren": "¤",
  "deg": "°",
  "divide": "÷",
  "eacute": "é",
  "ecirc": "ê",
  "egrave": "è",
  "eth": "ð",
  "euml": "ë",
  "frac12": "½",
  "frac14": "¼",
  "frac34": "¾",
  "gt": ">",
  "iacute": "í",
  "icirc": "î",
  "iexcl": "¡",
  "igrave": "ì",
  "iquest": "¿",
  "iuml": "ï",
  "laquo": "«",
  "lt": "<",
  "macr": "¯",
  "micro": "µ",
  "middot": "·",
  "nbsp": " ",
  "not": "¬",
  "ntilde": "ñ",
  "oacute": "ó",
  "ocirc": "ô",
  "ograve": "ò",
  "ordf": "ª",
  "ordm": "º",
  "oslash": "ø",
  "otilde": "õ",
  "ouml": "ö",
  "para": "¶",
  "plusmn": "±",
  "pound": "£",
  "quot": "\"",
  "raquo": "»",
  "reg": "®",
  "sect": "§",
  "shy": "­",
  "sup1": "¹",
  "sup2": "²",
  "sup3": "³",
  "szlig": "ß",
  "thorn": "þ",
  "times": "×",
  "uacute": "ú",
  "ucirc": "û",
  "ugrave": "ù",
  "uml": "¨",
  "uuml": "ü",
  "yacute": "ý",
  "yen": "¥",
  "yuml": "ÿ"
}

},{}],11:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer
 * @license MIT
 * @module character-entities-legacy
 * @fileoverview HTML legacy character entity information.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Expose.
 */

module.exports = require('./index.json');

},{"./index.json":10}],12:[function(require,module,exports){
module.exports={
  "AElig": "Æ",
  "AMP": "&",
  "Aacute": "Á",
  "Abreve": "Ă",
  "Acirc": "Â",
  "Acy": "А",
  "Afr": "𝔄",
  "Agrave": "À",
  "Alpha": "Α",
  "Amacr": "Ā",
  "And": "⩓",
  "Aogon": "Ą",
  "Aopf": "𝔸",
  "ApplyFunction": "⁡",
  "Aring": "Å",
  "Ascr": "𝒜",
  "Assign": "≔",
  "Atilde": "Ã",
  "Auml": "Ä",
  "Backslash": "∖",
  "Barv": "⫧",
  "Barwed": "⌆",
  "Bcy": "Б",
  "Because": "∵",
  "Bernoullis": "ℬ",
  "Beta": "Β",
  "Bfr": "𝔅",
  "Bopf": "𝔹",
  "Breve": "˘",
  "Bscr": "ℬ",
  "Bumpeq": "≎",
  "CHcy": "Ч",
  "COPY": "©",
  "Cacute": "Ć",
  "Cap": "⋒",
  "CapitalDifferentialD": "ⅅ",
  "Cayleys": "ℭ",
  "Ccaron": "Č",
  "Ccedil": "Ç",
  "Ccirc": "Ĉ",
  "Cconint": "∰",
  "Cdot": "Ċ",
  "Cedilla": "¸",
  "CenterDot": "·",
  "Cfr": "ℭ",
  "Chi": "Χ",
  "CircleDot": "⊙",
  "CircleMinus": "⊖",
  "CirclePlus": "⊕",
  "CircleTimes": "⊗",
  "ClockwiseContourIntegral": "∲",
  "CloseCurlyDoubleQuote": "”",
  "CloseCurlyQuote": "’",
  "Colon": "∷",
  "Colone": "⩴",
  "Congruent": "≡",
  "Conint": "∯",
  "ContourIntegral": "∮",
  "Copf": "ℂ",
  "Coproduct": "∐",
  "CounterClockwiseContourIntegral": "∳",
  "Cross": "⨯",
  "Cscr": "𝒞",
  "Cup": "⋓",
  "CupCap": "≍",
  "DD": "ⅅ",
  "DDotrahd": "⤑",
  "DJcy": "Ђ",
  "DScy": "Ѕ",
  "DZcy": "Џ",
  "Dagger": "‡",
  "Darr": "↡",
  "Dashv": "⫤",
  "Dcaron": "Ď",
  "Dcy": "Д",
  "Del": "∇",
  "Delta": "Δ",
  "Dfr": "𝔇",
  "DiacriticalAcute": "´",
  "DiacriticalDot": "˙",
  "DiacriticalDoubleAcute": "˝",
  "DiacriticalGrave": "`",
  "DiacriticalTilde": "˜",
  "Diamond": "⋄",
  "DifferentialD": "ⅆ",
  "Dopf": "𝔻",
  "Dot": "¨",
  "DotDot": "⃜",
  "DotEqual": "≐",
  "DoubleContourIntegral": "∯",
  "DoubleDot": "¨",
  "DoubleDownArrow": "⇓",
  "DoubleLeftArrow": "⇐",
  "DoubleLeftRightArrow": "⇔",
  "DoubleLeftTee": "⫤",
  "DoubleLongLeftArrow": "⟸",
  "DoubleLongLeftRightArrow": "⟺",
  "DoubleLongRightArrow": "⟹",
  "DoubleRightArrow": "⇒",
  "DoubleRightTee": "⊨",
  "DoubleUpArrow": "⇑",
  "DoubleUpDownArrow": "⇕",
  "DoubleVerticalBar": "∥",
  "DownArrow": "↓",
  "DownArrowBar": "⤓",
  "DownArrowUpArrow": "⇵",
  "DownBreve": "̑",
  "DownLeftRightVector": "⥐",
  "DownLeftTeeVector": "⥞",
  "DownLeftVector": "↽",
  "DownLeftVectorBar": "⥖",
  "DownRightTeeVector": "⥟",
  "DownRightVector": "⇁",
  "DownRightVectorBar": "⥗",
  "DownTee": "⊤",
  "DownTeeArrow": "↧",
  "Downarrow": "⇓",
  "Dscr": "𝒟",
  "Dstrok": "Đ",
  "ENG": "Ŋ",
  "ETH": "Ð",
  "Eacute": "É",
  "Ecaron": "Ě",
  "Ecirc": "Ê",
  "Ecy": "Э",
  "Edot": "Ė",
  "Efr": "𝔈",
  "Egrave": "È",
  "Element": "∈",
  "Emacr": "Ē",
  "EmptySmallSquare": "◻",
  "EmptyVerySmallSquare": "▫",
  "Eogon": "Ę",
  "Eopf": "𝔼",
  "Epsilon": "Ε",
  "Equal": "⩵",
  "EqualTilde": "≂",
  "Equilibrium": "⇌",
  "Escr": "ℰ",
  "Esim": "⩳",
  "Eta": "Η",
  "Euml": "Ë",
  "Exists": "∃",
  "ExponentialE": "ⅇ",
  "Fcy": "Ф",
  "Ffr": "𝔉",
  "FilledSmallSquare": "◼",
  "FilledVerySmallSquare": "▪",
  "Fopf": "𝔽",
  "ForAll": "∀",
  "Fouriertrf": "ℱ",
  "Fscr": "ℱ",
  "GJcy": "Ѓ",
  "GT": ">",
  "Gamma": "Γ",
  "Gammad": "Ϝ",
  "Gbreve": "Ğ",
  "Gcedil": "Ģ",
  "Gcirc": "Ĝ",
  "Gcy": "Г",
  "Gdot": "Ġ",
  "Gfr": "𝔊",
  "Gg": "⋙",
  "Gopf": "𝔾",
  "GreaterEqual": "≥",
  "GreaterEqualLess": "⋛",
  "GreaterFullEqual": "≧",
  "GreaterGreater": "⪢",
  "GreaterLess": "≷",
  "GreaterSlantEqual": "⩾",
  "GreaterTilde": "≳",
  "Gscr": "𝒢",
  "Gt": "≫",
  "HARDcy": "Ъ",
  "Hacek": "ˇ",
  "Hat": "^",
  "Hcirc": "Ĥ",
  "Hfr": "ℌ",
  "HilbertSpace": "ℋ",
  "Hopf": "ℍ",
  "HorizontalLine": "─",
  "Hscr": "ℋ",
  "Hstrok": "Ħ",
  "HumpDownHump": "≎",
  "HumpEqual": "≏",
  "IEcy": "Е",
  "IJlig": "Ĳ",
  "IOcy": "Ё",
  "Iacute": "Í",
  "Icirc": "Î",
  "Icy": "И",
  "Idot": "İ",
  "Ifr": "ℑ",
  "Igrave": "Ì",
  "Im": "ℑ",
  "Imacr": "Ī",
  "ImaginaryI": "ⅈ",
  "Implies": "⇒",
  "Int": "∬",
  "Integral": "∫",
  "Intersection": "⋂",
  "InvisibleComma": "⁣",
  "InvisibleTimes": "⁢",
  "Iogon": "Į",
  "Iopf": "𝕀",
  "Iota": "Ι",
  "Iscr": "ℐ",
  "Itilde": "Ĩ",
  "Iukcy": "І",
  "Iuml": "Ï",
  "Jcirc": "Ĵ",
  "Jcy": "Й",
  "Jfr": "𝔍",
  "Jopf": "𝕁",
  "Jscr": "𝒥",
  "Jsercy": "Ј",
  "Jukcy": "Є",
  "KHcy": "Х",
  "KJcy": "Ќ",
  "Kappa": "Κ",
  "Kcedil": "Ķ",
  "Kcy": "К",
  "Kfr": "𝔎",
  "Kopf": "𝕂",
  "Kscr": "𝒦",
  "LJcy": "Љ",
  "LT": "<",
  "Lacute": "Ĺ",
  "Lambda": "Λ",
  "Lang": "⟪",
  "Laplacetrf": "ℒ",
  "Larr": "↞",
  "Lcaron": "Ľ",
  "Lcedil": "Ļ",
  "Lcy": "Л",
  "LeftAngleBracket": "⟨",
  "LeftArrow": "←",
  "LeftArrowBar": "⇤",
  "LeftArrowRightArrow": "⇆",
  "LeftCeiling": "⌈",
  "LeftDoubleBracket": "⟦",
  "LeftDownTeeVector": "⥡",
  "LeftDownVector": "⇃",
  "LeftDownVectorBar": "⥙",
  "LeftFloor": "⌊",
  "LeftRightArrow": "↔",
  "LeftRightVector": "⥎",
  "LeftTee": "⊣",
  "LeftTeeArrow": "↤",
  "LeftTeeVector": "⥚",
  "LeftTriangle": "⊲",
  "LeftTriangleBar": "⧏",
  "LeftTriangleEqual": "⊴",
  "LeftUpDownVector": "⥑",
  "LeftUpTeeVector": "⥠",
  "LeftUpVector": "↿",
  "LeftUpVectorBar": "⥘",
  "LeftVector": "↼",
  "LeftVectorBar": "⥒",
  "Leftarrow": "⇐",
  "Leftrightarrow": "⇔",
  "LessEqualGreater": "⋚",
  "LessFullEqual": "≦",
  "LessGreater": "≶",
  "LessLess": "⪡",
  "LessSlantEqual": "⩽",
  "LessTilde": "≲",
  "Lfr": "𝔏",
  "Ll": "⋘",
  "Lleftarrow": "⇚",
  "Lmidot": "Ŀ",
  "LongLeftArrow": "⟵",
  "LongLeftRightArrow": "⟷",
  "LongRightArrow": "⟶",
  "Longleftarrow": "⟸",
  "Longleftrightarrow": "⟺",
  "Longrightarrow": "⟹",
  "Lopf": "𝕃",
  "LowerLeftArrow": "↙",
  "LowerRightArrow": "↘",
  "Lscr": "ℒ",
  "Lsh": "↰",
  "Lstrok": "Ł",
  "Lt": "≪",
  "Map": "⤅",
  "Mcy": "М",
  "MediumSpace": " ",
  "Mellintrf": "ℳ",
  "Mfr": "𝔐",
  "MinusPlus": "∓",
  "Mopf": "𝕄",
  "Mscr": "ℳ",
  "Mu": "Μ",
  "NJcy": "Њ",
  "Nacute": "Ń",
  "Ncaron": "Ň",
  "Ncedil": "Ņ",
  "Ncy": "Н",
  "NegativeMediumSpace": "​",
  "NegativeThickSpace": "​",
  "NegativeThinSpace": "​",
  "NegativeVeryThinSpace": "​",
  "NestedGreaterGreater": "≫",
  "NestedLessLess": "≪",
  "NewLine": "\n",
  "Nfr": "𝔑",
  "NoBreak": "⁠",
  "NonBreakingSpace": " ",
  "Nopf": "ℕ",
  "Not": "⫬",
  "NotCongruent": "≢",
  "NotCupCap": "≭",
  "NotDoubleVerticalBar": "∦",
  "NotElement": "∉",
  "NotEqual": "≠",
  "NotEqualTilde": "≂̸",
  "NotExists": "∄",
  "NotGreater": "≯",
  "NotGreaterEqual": "≱",
  "NotGreaterFullEqual": "≧̸",
  "NotGreaterGreater": "≫̸",
  "NotGreaterLess": "≹",
  "NotGreaterSlantEqual": "⩾̸",
  "NotGreaterTilde": "≵",
  "NotHumpDownHump": "≎̸",
  "NotHumpEqual": "≏̸",
  "NotLeftTriangle": "⋪",
  "NotLeftTriangleBar": "⧏̸",
  "NotLeftTriangleEqual": "⋬",
  "NotLess": "≮",
  "NotLessEqual": "≰",
  "NotLessGreater": "≸",
  "NotLessLess": "≪̸",
  "NotLessSlantEqual": "⩽̸",
  "NotLessTilde": "≴",
  "NotNestedGreaterGreater": "⪢̸",
  "NotNestedLessLess": "⪡̸",
  "NotPrecedes": "⊀",
  "NotPrecedesEqual": "⪯̸",
  "NotPrecedesSlantEqual": "⋠",
  "NotReverseElement": "∌",
  "NotRightTriangle": "⋫",
  "NotRightTriangleBar": "⧐̸",
  "NotRightTriangleEqual": "⋭",
  "NotSquareSubset": "⊏̸",
  "NotSquareSubsetEqual": "⋢",
  "NotSquareSuperset": "⊐̸",
  "NotSquareSupersetEqual": "⋣",
  "NotSubset": "⊂⃒",
  "NotSubsetEqual": "⊈",
  "NotSucceeds": "⊁",
  "NotSucceedsEqual": "⪰̸",
  "NotSucceedsSlantEqual": "⋡",
  "NotSucceedsTilde": "≿̸",
  "NotSuperset": "⊃⃒",
  "NotSupersetEqual": "⊉",
  "NotTilde": "≁",
  "NotTildeEqual": "≄",
  "NotTildeFullEqual": "≇",
  "NotTildeTilde": "≉",
  "NotVerticalBar": "∤",
  "Nscr": "𝒩",
  "Ntilde": "Ñ",
  "Nu": "Ν",
  "OElig": "Œ",
  "Oacute": "Ó",
  "Ocirc": "Ô",
  "Ocy": "О",
  "Odblac": "Ő",
  "Ofr": "𝔒",
  "Ograve": "Ò",
  "Omacr": "Ō",
  "Omega": "Ω",
  "Omicron": "Ο",
  "Oopf": "𝕆",
  "OpenCurlyDoubleQuote": "“",
  "OpenCurlyQuote": "‘",
  "Or": "⩔",
  "Oscr": "𝒪",
  "Oslash": "Ø",
  "Otilde": "Õ",
  "Otimes": "⨷",
  "Ouml": "Ö",
  "OverBar": "‾",
  "OverBrace": "⏞",
  "OverBracket": "⎴",
  "OverParenthesis": "⏜",
  "PartialD": "∂",
  "Pcy": "П",
  "Pfr": "𝔓",
  "Phi": "Φ",
  "Pi": "Π",
  "PlusMinus": "±",
  "Poincareplane": "ℌ",
  "Popf": "ℙ",
  "Pr": "⪻",
  "Precedes": "≺",
  "PrecedesEqual": "⪯",
  "PrecedesSlantEqual": "≼",
  "PrecedesTilde": "≾",
  "Prime": "″",
  "Product": "∏",
  "Proportion": "∷",
  "Proportional": "∝",
  "Pscr": "𝒫",
  "Psi": "Ψ",
  "QUOT": "\"",
  "Qfr": "𝔔",
  "Qopf": "ℚ",
  "Qscr": "𝒬",
  "RBarr": "⤐",
  "REG": "®",
  "Racute": "Ŕ",
  "Rang": "⟫",
  "Rarr": "↠",
  "Rarrtl": "⤖",
  "Rcaron": "Ř",
  "Rcedil": "Ŗ",
  "Rcy": "Р",
  "Re": "ℜ",
  "ReverseElement": "∋",
  "ReverseEquilibrium": "⇋",
  "ReverseUpEquilibrium": "⥯",
  "Rfr": "ℜ",
  "Rho": "Ρ",
  "RightAngleBracket": "⟩",
  "RightArrow": "→",
  "RightArrowBar": "⇥",
  "RightArrowLeftArrow": "⇄",
  "RightCeiling": "⌉",
  "RightDoubleBracket": "⟧",
  "RightDownTeeVector": "⥝",
  "RightDownVector": "⇂",
  "RightDownVectorBar": "⥕",
  "RightFloor": "⌋",
  "RightTee": "⊢",
  "RightTeeArrow": "↦",
  "RightTeeVector": "⥛",
  "RightTriangle": "⊳",
  "RightTriangleBar": "⧐",
  "RightTriangleEqual": "⊵",
  "RightUpDownVector": "⥏",
  "RightUpTeeVector": "⥜",
  "RightUpVector": "↾",
  "RightUpVectorBar": "⥔",
  "RightVector": "⇀",
  "RightVectorBar": "⥓",
  "Rightarrow": "⇒",
  "Ropf": "ℝ",
  "RoundImplies": "⥰",
  "Rrightarrow": "⇛",
  "Rscr": "ℛ",
  "Rsh": "↱",
  "RuleDelayed": "⧴",
  "SHCHcy": "Щ",
  "SHcy": "Ш",
  "SOFTcy": "Ь",
  "Sacute": "Ś",
  "Sc": "⪼",
  "Scaron": "Š",
  "Scedil": "Ş",
  "Scirc": "Ŝ",
  "Scy": "С",
  "Sfr": "𝔖",
  "ShortDownArrow": "↓",
  "ShortLeftArrow": "←",
  "ShortRightArrow": "→",
  "ShortUpArrow": "↑",
  "Sigma": "Σ",
  "SmallCircle": "∘",
  "Sopf": "𝕊",
  "Sqrt": "√",
  "Square": "□",
  "SquareIntersection": "⊓",
  "SquareSubset": "⊏",
  "SquareSubsetEqual": "⊑",
  "SquareSuperset": "⊐",
  "SquareSupersetEqual": "⊒",
  "SquareUnion": "⊔",
  "Sscr": "𝒮",
  "Star": "⋆",
  "Sub": "⋐",
  "Subset": "⋐",
  "SubsetEqual": "⊆",
  "Succeeds": "≻",
  "SucceedsEqual": "⪰",
  "SucceedsSlantEqual": "≽",
  "SucceedsTilde": "≿",
  "SuchThat": "∋",
  "Sum": "∑",
  "Sup": "⋑",
  "Superset": "⊃",
  "SupersetEqual": "⊇",
  "Supset": "⋑",
  "THORN": "Þ",
  "TRADE": "™",
  "TSHcy": "Ћ",
  "TScy": "Ц",
  "Tab": "\t",
  "Tau": "Τ",
  "Tcaron": "Ť",
  "Tcedil": "Ţ",
  "Tcy": "Т",
  "Tfr": "𝔗",
  "Therefore": "∴",
  "Theta": "Θ",
  "ThickSpace": "  ",
  "ThinSpace": " ",
  "Tilde": "∼",
  "TildeEqual": "≃",
  "TildeFullEqual": "≅",
  "TildeTilde": "≈",
  "Topf": "𝕋",
  "TripleDot": "⃛",
  "Tscr": "𝒯",
  "Tstrok": "Ŧ",
  "Uacute": "Ú",
  "Uarr": "↟",
  "Uarrocir": "⥉",
  "Ubrcy": "Ў",
  "Ubreve": "Ŭ",
  "Ucirc": "Û",
  "Ucy": "У",
  "Udblac": "Ű",
  "Ufr": "𝔘",
  "Ugrave": "Ù",
  "Umacr": "Ū",
  "UnderBar": "_",
  "UnderBrace": "⏟",
  "UnderBracket": "⎵",
  "UnderParenthesis": "⏝",
  "Union": "⋃",
  "UnionPlus": "⊎",
  "Uogon": "Ų",
  "Uopf": "𝕌",
  "UpArrow": "↑",
  "UpArrowBar": "⤒",
  "UpArrowDownArrow": "⇅",
  "UpDownArrow": "↕",
  "UpEquilibrium": "⥮",
  "UpTee": "⊥",
  "UpTeeArrow": "↥",
  "Uparrow": "⇑",
  "Updownarrow": "⇕",
  "UpperLeftArrow": "↖",
  "UpperRightArrow": "↗",
  "Upsi": "ϒ",
  "Upsilon": "Υ",
  "Uring": "Ů",
  "Uscr": "𝒰",
  "Utilde": "Ũ",
  "Uuml": "Ü",
  "VDash": "⊫",
  "Vbar": "⫫",
  "Vcy": "В",
  "Vdash": "⊩",
  "Vdashl": "⫦",
  "Vee": "⋁",
  "Verbar": "‖",
  "Vert": "‖",
  "VerticalBar": "∣",
  "VerticalLine": "|",
  "VerticalSeparator": "❘",
  "VerticalTilde": "≀",
  "VeryThinSpace": " ",
  "Vfr": "𝔙",
  "Vopf": "𝕍",
  "Vscr": "𝒱",
  "Vvdash": "⊪",
  "Wcirc": "Ŵ",
  "Wedge": "⋀",
  "Wfr": "𝔚",
  "Wopf": "𝕎",
  "Wscr": "𝒲",
  "Xfr": "𝔛",
  "Xi": "Ξ",
  "Xopf": "𝕏",
  "Xscr": "𝒳",
  "YAcy": "Я",
  "YIcy": "Ї",
  "YUcy": "Ю",
  "Yacute": "Ý",
  "Ycirc": "Ŷ",
  "Ycy": "Ы",
  "Yfr": "𝔜",
  "Yopf": "𝕐",
  "Yscr": "𝒴",
  "Yuml": "Ÿ",
  "ZHcy": "Ж",
  "Zacute": "Ź",
  "Zcaron": "Ž",
  "Zcy": "З",
  "Zdot": "Ż",
  "ZeroWidthSpace": "​",
  "Zeta": "Ζ",
  "Zfr": "ℨ",
  "Zopf": "ℤ",
  "Zscr": "𝒵",
  "aacute": "á",
  "abreve": "ă",
  "ac": "∾",
  "acE": "∾̳",
  "acd": "∿",
  "acirc": "â",
  "acute": "´",
  "acy": "а",
  "aelig": "æ",
  "af": "⁡",
  "afr": "𝔞",
  "agrave": "à",
  "alefsym": "ℵ",
  "aleph": "ℵ",
  "alpha": "α",
  "amacr": "ā",
  "amalg": "⨿",
  "amp": "&",
  "and": "∧",
  "andand": "⩕",
  "andd": "⩜",
  "andslope": "⩘",
  "andv": "⩚",
  "ang": "∠",
  "ange": "⦤",
  "angle": "∠",
  "angmsd": "∡",
  "angmsdaa": "⦨",
  "angmsdab": "⦩",
  "angmsdac": "⦪",
  "angmsdad": "⦫",
  "angmsdae": "⦬",
  "angmsdaf": "⦭",
  "angmsdag": "⦮",
  "angmsdah": "⦯",
  "angrt": "∟",
  "angrtvb": "⊾",
  "angrtvbd": "⦝",
  "angsph": "∢",
  "angst": "Å",
  "angzarr": "⍼",
  "aogon": "ą",
  "aopf": "𝕒",
  "ap": "≈",
  "apE": "⩰",
  "apacir": "⩯",
  "ape": "≊",
  "apid": "≋",
  "apos": "'",
  "approx": "≈",
  "approxeq": "≊",
  "aring": "å",
  "ascr": "𝒶",
  "ast": "*",
  "asymp": "≈",
  "asympeq": "≍",
  "atilde": "ã",
  "auml": "ä",
  "awconint": "∳",
  "awint": "⨑",
  "bNot": "⫭",
  "backcong": "≌",
  "backepsilon": "϶",
  "backprime": "‵",
  "backsim": "∽",
  "backsimeq": "⋍",
  "barvee": "⊽",
  "barwed": "⌅",
  "barwedge": "⌅",
  "bbrk": "⎵",
  "bbrktbrk": "⎶",
  "bcong": "≌",
  "bcy": "б",
  "bdquo": "„",
  "becaus": "∵",
  "because": "∵",
  "bemptyv": "⦰",
  "bepsi": "϶",
  "bernou": "ℬ",
  "beta": "β",
  "beth": "ℶ",
  "between": "≬",
  "bfr": "𝔟",
  "bigcap": "⋂",
  "bigcirc": "◯",
  "bigcup": "⋃",
  "bigodot": "⨀",
  "bigoplus": "⨁",
  "bigotimes": "⨂",
  "bigsqcup": "⨆",
  "bigstar": "★",
  "bigtriangledown": "▽",
  "bigtriangleup": "△",
  "biguplus": "⨄",
  "bigvee": "⋁",
  "bigwedge": "⋀",
  "bkarow": "⤍",
  "blacklozenge": "⧫",
  "blacksquare": "▪",
  "blacktriangle": "▴",
  "blacktriangledown": "▾",
  "blacktriangleleft": "◂",
  "blacktriangleright": "▸",
  "blank": "␣",
  "blk12": "▒",
  "blk14": "░",
  "blk34": "▓",
  "block": "█",
  "bne": "=⃥",
  "bnequiv": "≡⃥",
  "bnot": "⌐",
  "bopf": "𝕓",
  "bot": "⊥",
  "bottom": "⊥",
  "bowtie": "⋈",
  "boxDL": "╗",
  "boxDR": "╔",
  "boxDl": "╖",
  "boxDr": "╓",
  "boxH": "═",
  "boxHD": "╦",
  "boxHU": "╩",
  "boxHd": "╤",
  "boxHu": "╧",
  "boxUL": "╝",
  "boxUR": "╚",
  "boxUl": "╜",
  "boxUr": "╙",
  "boxV": "║",
  "boxVH": "╬",
  "boxVL": "╣",
  "boxVR": "╠",
  "boxVh": "╫",
  "boxVl": "╢",
  "boxVr": "╟",
  "boxbox": "⧉",
  "boxdL": "╕",
  "boxdR": "╒",
  "boxdl": "┐",
  "boxdr": "┌",
  "boxh": "─",
  "boxhD": "╥",
  "boxhU": "╨",
  "boxhd": "┬",
  "boxhu": "┴",
  "boxminus": "⊟",
  "boxplus": "⊞",
  "boxtimes": "⊠",
  "boxuL": "╛",
  "boxuR": "╘",
  "boxul": "┘",
  "boxur": "└",
  "boxv": "│",
  "boxvH": "╪",
  "boxvL": "╡",
  "boxvR": "╞",
  "boxvh": "┼",
  "boxvl": "┤",
  "boxvr": "├",
  "bprime": "‵",
  "breve": "˘",
  "brvbar": "¦",
  "bscr": "𝒷",
  "bsemi": "⁏",
  "bsim": "∽",
  "bsime": "⋍",
  "bsol": "\\",
  "bsolb": "⧅",
  "bsolhsub": "⟈",
  "bull": "•",
  "bullet": "•",
  "bump": "≎",
  "bumpE": "⪮",
  "bumpe": "≏",
  "bumpeq": "≏",
  "cacute": "ć",
  "cap": "∩",
  "capand": "⩄",
  "capbrcup": "⩉",
  "capcap": "⩋",
  "capcup": "⩇",
  "capdot": "⩀",
  "caps": "∩︀",
  "caret": "⁁",
  "caron": "ˇ",
  "ccaps": "⩍",
  "ccaron": "č",
  "ccedil": "ç",
  "ccirc": "ĉ",
  "ccups": "⩌",
  "ccupssm": "⩐",
  "cdot": "ċ",
  "cedil": "¸",
  "cemptyv": "⦲",
  "cent": "¢",
  "centerdot": "·",
  "cfr": "𝔠",
  "chcy": "ч",
  "check": "✓",
  "checkmark": "✓",
  "chi": "χ",
  "cir": "○",
  "cirE": "⧃",
  "circ": "ˆ",
  "circeq": "≗",
  "circlearrowleft": "↺",
  "circlearrowright": "↻",
  "circledR": "®",
  "circledS": "Ⓢ",
  "circledast": "⊛",
  "circledcirc": "⊚",
  "circleddash": "⊝",
  "cire": "≗",
  "cirfnint": "⨐",
  "cirmid": "⫯",
  "cirscir": "⧂",
  "clubs": "♣",
  "clubsuit": "♣",
  "colon": ":",
  "colone": "≔",
  "coloneq": "≔",
  "comma": ",",
  "commat": "@",
  "comp": "∁",
  "compfn": "∘",
  "complement": "∁",
  "complexes": "ℂ",
  "cong": "≅",
  "congdot": "⩭",
  "conint": "∮",
  "copf": "𝕔",
  "coprod": "∐",
  "copy": "©",
  "copysr": "℗",
  "crarr": "↵",
  "cross": "✗",
  "cscr": "𝒸",
  "csub": "⫏",
  "csube": "⫑",
  "csup": "⫐",
  "csupe": "⫒",
  "ctdot": "⋯",
  "cudarrl": "⤸",
  "cudarrr": "⤵",
  "cuepr": "⋞",
  "cuesc": "⋟",
  "cularr": "↶",
  "cularrp": "⤽",
  "cup": "∪",
  "cupbrcap": "⩈",
  "cupcap": "⩆",
  "cupcup": "⩊",
  "cupdot": "⊍",
  "cupor": "⩅",
  "cups": "∪︀",
  "curarr": "↷",
  "curarrm": "⤼",
  "curlyeqprec": "⋞",
  "curlyeqsucc": "⋟",
  "curlyvee": "⋎",
  "curlywedge": "⋏",
  "curren": "¤",
  "curvearrowleft": "↶",
  "curvearrowright": "↷",
  "cuvee": "⋎",
  "cuwed": "⋏",
  "cwconint": "∲",
  "cwint": "∱",
  "cylcty": "⌭",
  "dArr": "⇓",
  "dHar": "⥥",
  "dagger": "†",
  "daleth": "ℸ",
  "darr": "↓",
  "dash": "‐",
  "dashv": "⊣",
  "dbkarow": "⤏",
  "dblac": "˝",
  "dcaron": "ď",
  "dcy": "д",
  "dd": "ⅆ",
  "ddagger": "‡",
  "ddarr": "⇊",
  "ddotseq": "⩷",
  "deg": "°",
  "delta": "δ",
  "demptyv": "⦱",
  "dfisht": "⥿",
  "dfr": "𝔡",
  "dharl": "⇃",
  "dharr": "⇂",
  "diam": "⋄",
  "diamond": "⋄",
  "diamondsuit": "♦",
  "diams": "♦",
  "die": "¨",
  "digamma": "ϝ",
  "disin": "⋲",
  "div": "÷",
  "divide": "÷",
  "divideontimes": "⋇",
  "divonx": "⋇",
  "djcy": "ђ",
  "dlcorn": "⌞",
  "dlcrop": "⌍",
  "dollar": "$",
  "dopf": "𝕕",
  "dot": "˙",
  "doteq": "≐",
  "doteqdot": "≑",
  "dotminus": "∸",
  "dotplus": "∔",
  "dotsquare": "⊡",
  "doublebarwedge": "⌆",
  "downarrow": "↓",
  "downdownarrows": "⇊",
  "downharpoonleft": "⇃",
  "downharpoonright": "⇂",
  "drbkarow": "⤐",
  "drcorn": "⌟",
  "drcrop": "⌌",
  "dscr": "𝒹",
  "dscy": "ѕ",
  "dsol": "⧶",
  "dstrok": "đ",
  "dtdot": "⋱",
  "dtri": "▿",
  "dtrif": "▾",
  "duarr": "⇵",
  "duhar": "⥯",
  "dwangle": "⦦",
  "dzcy": "џ",
  "dzigrarr": "⟿",
  "eDDot": "⩷",
  "eDot": "≑",
  "eacute": "é",
  "easter": "⩮",
  "ecaron": "ě",
  "ecir": "≖",
  "ecirc": "ê",
  "ecolon": "≕",
  "ecy": "э",
  "edot": "ė",
  "ee": "ⅇ",
  "efDot": "≒",
  "efr": "𝔢",
  "eg": "⪚",
  "egrave": "è",
  "egs": "⪖",
  "egsdot": "⪘",
  "el": "⪙",
  "elinters": "⏧",
  "ell": "ℓ",
  "els": "⪕",
  "elsdot": "⪗",
  "emacr": "ē",
  "empty": "∅",
  "emptyset": "∅",
  "emptyv": "∅",
  "emsp13": " ",
  "emsp14": " ",
  "emsp": " ",
  "eng": "ŋ",
  "ensp": " ",
  "eogon": "ę",
  "eopf": "𝕖",
  "epar": "⋕",
  "eparsl": "⧣",
  "eplus": "⩱",
  "epsi": "ε",
  "epsilon": "ε",
  "epsiv": "ϵ",
  "eqcirc": "≖",
  "eqcolon": "≕",
  "eqsim": "≂",
  "eqslantgtr": "⪖",
  "eqslantless": "⪕",
  "equals": "=",
  "equest": "≟",
  "equiv": "≡",
  "equivDD": "⩸",
  "eqvparsl": "⧥",
  "erDot": "≓",
  "erarr": "⥱",
  "escr": "ℯ",
  "esdot": "≐",
  "esim": "≂",
  "eta": "η",
  "eth": "ð",
  "euml": "ë",
  "euro": "€",
  "excl": "!",
  "exist": "∃",
  "expectation": "ℰ",
  "exponentiale": "ⅇ",
  "fallingdotseq": "≒",
  "fcy": "ф",
  "female": "♀",
  "ffilig": "ﬃ",
  "fflig": "ﬀ",
  "ffllig": "ﬄ",
  "ffr": "𝔣",
  "filig": "ﬁ",
  "fjlig": "fj",
  "flat": "♭",
  "fllig": "ﬂ",
  "fltns": "▱",
  "fnof": "ƒ",
  "fopf": "𝕗",
  "forall": "∀",
  "fork": "⋔",
  "forkv": "⫙",
  "fpartint": "⨍",
  "frac12": "½",
  "frac13": "⅓",
  "frac14": "¼",
  "frac15": "⅕",
  "frac16": "⅙",
  "frac18": "⅛",
  "frac23": "⅔",
  "frac25": "⅖",
  "frac34": "¾",
  "frac35": "⅗",
  "frac38": "⅜",
  "frac45": "⅘",
  "frac56": "⅚",
  "frac58": "⅝",
  "frac78": "⅞",
  "frasl": "⁄",
  "frown": "⌢",
  "fscr": "𝒻",
  "gE": "≧",
  "gEl": "⪌",
  "gacute": "ǵ",
  "gamma": "γ",
  "gammad": "ϝ",
  "gap": "⪆",
  "gbreve": "ğ",
  "gcirc": "ĝ",
  "gcy": "г",
  "gdot": "ġ",
  "ge": "≥",
  "gel": "⋛",
  "geq": "≥",
  "geqq": "≧",
  "geqslant": "⩾",
  "ges": "⩾",
  "gescc": "⪩",
  "gesdot": "⪀",
  "gesdoto": "⪂",
  "gesdotol": "⪄",
  "gesl": "⋛︀",
  "gesles": "⪔",
  "gfr": "𝔤",
  "gg": "≫",
  "ggg": "⋙",
  "gimel": "ℷ",
  "gjcy": "ѓ",
  "gl": "≷",
  "glE": "⪒",
  "gla": "⪥",
  "glj": "⪤",
  "gnE": "≩",
  "gnap": "⪊",
  "gnapprox": "⪊",
  "gne": "⪈",
  "gneq": "⪈",
  "gneqq": "≩",
  "gnsim": "⋧",
  "gopf": "𝕘",
  "grave": "`",
  "gscr": "ℊ",
  "gsim": "≳",
  "gsime": "⪎",
  "gsiml": "⪐",
  "gt": ">",
  "gtcc": "⪧",
  "gtcir": "⩺",
  "gtdot": "⋗",
  "gtlPar": "⦕",
  "gtquest": "⩼",
  "gtrapprox": "⪆",
  "gtrarr": "⥸",
  "gtrdot": "⋗",
  "gtreqless": "⋛",
  "gtreqqless": "⪌",
  "gtrless": "≷",
  "gtrsim": "≳",
  "gvertneqq": "≩︀",
  "gvnE": "≩︀",
  "hArr": "⇔",
  "hairsp": " ",
  "half": "½",
  "hamilt": "ℋ",
  "hardcy": "ъ",
  "harr": "↔",
  "harrcir": "⥈",
  "harrw": "↭",
  "hbar": "ℏ",
  "hcirc": "ĥ",
  "hearts": "♥",
  "heartsuit": "♥",
  "hellip": "…",
  "hercon": "⊹",
  "hfr": "𝔥",
  "hksearow": "⤥",
  "hkswarow": "⤦",
  "hoarr": "⇿",
  "homtht": "∻",
  "hookleftarrow": "↩",
  "hookrightarrow": "↪",
  "hopf": "𝕙",
  "horbar": "―",
  "hscr": "𝒽",
  "hslash": "ℏ",
  "hstrok": "ħ",
  "hybull": "⁃",
  "hyphen": "‐",
  "iacute": "í",
  "ic": "⁣",
  "icirc": "î",
  "icy": "и",
  "iecy": "е",
  "iexcl": "¡",
  "iff": "⇔",
  "ifr": "𝔦",
  "igrave": "ì",
  "ii": "ⅈ",
  "iiiint": "⨌",
  "iiint": "∭",
  "iinfin": "⧜",
  "iiota": "℩",
  "ijlig": "ĳ",
  "imacr": "ī",
  "image": "ℑ",
  "imagline": "ℐ",
  "imagpart": "ℑ",
  "imath": "ı",
  "imof": "⊷",
  "imped": "Ƶ",
  "in": "∈",
  "incare": "℅",
  "infin": "∞",
  "infintie": "⧝",
  "inodot": "ı",
  "int": "∫",
  "intcal": "⊺",
  "integers": "ℤ",
  "intercal": "⊺",
  "intlarhk": "⨗",
  "intprod": "⨼",
  "iocy": "ё",
  "iogon": "į",
  "iopf": "𝕚",
  "iota": "ι",
  "iprod": "⨼",
  "iquest": "¿",
  "iscr": "𝒾",
  "isin": "∈",
  "isinE": "⋹",
  "isindot": "⋵",
  "isins": "⋴",
  "isinsv": "⋳",
  "isinv": "∈",
  "it": "⁢",
  "itilde": "ĩ",
  "iukcy": "і",
  "iuml": "ï",
  "jcirc": "ĵ",
  "jcy": "й",
  "jfr": "𝔧",
  "jmath": "ȷ",
  "jopf": "𝕛",
  "jscr": "𝒿",
  "jsercy": "ј",
  "jukcy": "є",
  "kappa": "κ",
  "kappav": "ϰ",
  "kcedil": "ķ",
  "kcy": "к",
  "kfr": "𝔨",
  "kgreen": "ĸ",
  "khcy": "х",
  "kjcy": "ќ",
  "kopf": "𝕜",
  "kscr": "𝓀",
  "lAarr": "⇚",
  "lArr": "⇐",
  "lAtail": "⤛",
  "lBarr": "⤎",
  "lE": "≦",
  "lEg": "⪋",
  "lHar": "⥢",
  "lacute": "ĺ",
  "laemptyv": "⦴",
  "lagran": "ℒ",
  "lambda": "λ",
  "lang": "⟨",
  "langd": "⦑",
  "langle": "⟨",
  "lap": "⪅",
  "laquo": "«",
  "larr": "←",
  "larrb": "⇤",
  "larrbfs": "⤟",
  "larrfs": "⤝",
  "larrhk": "↩",
  "larrlp": "↫",
  "larrpl": "⤹",
  "larrsim": "⥳",
  "larrtl": "↢",
  "lat": "⪫",
  "latail": "⤙",
  "late": "⪭",
  "lates": "⪭︀",
  "lbarr": "⤌",
  "lbbrk": "❲",
  "lbrace": "{",
  "lbrack": "[",
  "lbrke": "⦋",
  "lbrksld": "⦏",
  "lbrkslu": "⦍",
  "lcaron": "ľ",
  "lcedil": "ļ",
  "lceil": "⌈",
  "lcub": "{",
  "lcy": "л",
  "ldca": "⤶",
  "ldquo": "“",
  "ldquor": "„",
  "ldrdhar": "⥧",
  "ldrushar": "⥋",
  "ldsh": "↲",
  "le": "≤",
  "leftarrow": "←",
  "leftarrowtail": "↢",
  "leftharpoondown": "↽",
  "leftharpoonup": "↼",
  "leftleftarrows": "⇇",
  "leftrightarrow": "↔",
  "leftrightarrows": "⇆",
  "leftrightharpoons": "⇋",
  "leftrightsquigarrow": "↭",
  "leftthreetimes": "⋋",
  "leg": "⋚",
  "leq": "≤",
  "leqq": "≦",
  "leqslant": "⩽",
  "les": "⩽",
  "lescc": "⪨",
  "lesdot": "⩿",
  "lesdoto": "⪁",
  "lesdotor": "⪃",
  "lesg": "⋚︀",
  "lesges": "⪓",
  "lessapprox": "⪅",
  "lessdot": "⋖",
  "lesseqgtr": "⋚",
  "lesseqqgtr": "⪋",
  "lessgtr": "≶",
  "lesssim": "≲",
  "lfisht": "⥼",
  "lfloor": "⌊",
  "lfr": "𝔩",
  "lg": "≶",
  "lgE": "⪑",
  "lhard": "↽",
  "lharu": "↼",
  "lharul": "⥪",
  "lhblk": "▄",
  "ljcy": "љ",
  "ll": "≪",
  "llarr": "⇇",
  "llcorner": "⌞",
  "llhard": "⥫",
  "lltri": "◺",
  "lmidot": "ŀ",
  "lmoust": "⎰",
  "lmoustache": "⎰",
  "lnE": "≨",
  "lnap": "⪉",
  "lnapprox": "⪉",
  "lne": "⪇",
  "lneq": "⪇",
  "lneqq": "≨",
  "lnsim": "⋦",
  "loang": "⟬",
  "loarr": "⇽",
  "lobrk": "⟦",
  "longleftarrow": "⟵",
  "longleftrightarrow": "⟷",
  "longmapsto": "⟼",
  "longrightarrow": "⟶",
  "looparrowleft": "↫",
  "looparrowright": "↬",
  "lopar": "⦅",
  "lopf": "𝕝",
  "loplus": "⨭",
  "lotimes": "⨴",
  "lowast": "∗",
  "lowbar": "_",
  "loz": "◊",
  "lozenge": "◊",
  "lozf": "⧫",
  "lpar": "(",
  "lparlt": "⦓",
  "lrarr": "⇆",
  "lrcorner": "⌟",
  "lrhar": "⇋",
  "lrhard": "⥭",
  "lrm": "‎",
  "lrtri": "⊿",
  "lsaquo": "‹",
  "lscr": "𝓁",
  "lsh": "↰",
  "lsim": "≲",
  "lsime": "⪍",
  "lsimg": "⪏",
  "lsqb": "[",
  "lsquo": "‘",
  "lsquor": "‚",
  "lstrok": "ł",
  "lt": "<",
  "ltcc": "⪦",
  "ltcir": "⩹",
  "ltdot": "⋖",
  "lthree": "⋋",
  "ltimes": "⋉",
  "ltlarr": "⥶",
  "ltquest": "⩻",
  "ltrPar": "⦖",
  "ltri": "◃",
  "ltrie": "⊴",
  "ltrif": "◂",
  "lurdshar": "⥊",
  "luruhar": "⥦",
  "lvertneqq": "≨︀",
  "lvnE": "≨︀",
  "mDDot": "∺",
  "macr": "¯",
  "male": "♂",
  "malt": "✠",
  "maltese": "✠",
  "map": "↦",
  "mapsto": "↦",
  "mapstodown": "↧",
  "mapstoleft": "↤",
  "mapstoup": "↥",
  "marker": "▮",
  "mcomma": "⨩",
  "mcy": "м",
  "mdash": "—",
  "measuredangle": "∡",
  "mfr": "𝔪",
  "mho": "℧",
  "micro": "µ",
  "mid": "∣",
  "midast": "*",
  "midcir": "⫰",
  "middot": "·",
  "minus": "−",
  "minusb": "⊟",
  "minusd": "∸",
  "minusdu": "⨪",
  "mlcp": "⫛",
  "mldr": "…",
  "mnplus": "∓",
  "models": "⊧",
  "mopf": "𝕞",
  "mp": "∓",
  "mscr": "𝓂",
  "mstpos": "∾",
  "mu": "μ",
  "multimap": "⊸",
  "mumap": "⊸",
  "nGg": "⋙̸",
  "nGt": "≫⃒",
  "nGtv": "≫̸",
  "nLeftarrow": "⇍",
  "nLeftrightarrow": "⇎",
  "nLl": "⋘̸",
  "nLt": "≪⃒",
  "nLtv": "≪̸",
  "nRightarrow": "⇏",
  "nVDash": "⊯",
  "nVdash": "⊮",
  "nabla": "∇",
  "nacute": "ń",
  "nang": "∠⃒",
  "nap": "≉",
  "napE": "⩰̸",
  "napid": "≋̸",
  "napos": "ŉ",
  "napprox": "≉",
  "natur": "♮",
  "natural": "♮",
  "naturals": "ℕ",
  "nbsp": " ",
  "nbump": "≎̸",
  "nbumpe": "≏̸",
  "ncap": "⩃",
  "ncaron": "ň",
  "ncedil": "ņ",
  "ncong": "≇",
  "ncongdot": "⩭̸",
  "ncup": "⩂",
  "ncy": "н",
  "ndash": "–",
  "ne": "≠",
  "neArr": "⇗",
  "nearhk": "⤤",
  "nearr": "↗",
  "nearrow": "↗",
  "nedot": "≐̸",
  "nequiv": "≢",
  "nesear": "⤨",
  "nesim": "≂̸",
  "nexist": "∄",
  "nexists": "∄",
  "nfr": "𝔫",
  "ngE": "≧̸",
  "nge": "≱",
  "ngeq": "≱",
  "ngeqq": "≧̸",
  "ngeqslant": "⩾̸",
  "nges": "⩾̸",
  "ngsim": "≵",
  "ngt": "≯",
  "ngtr": "≯",
  "nhArr": "⇎",
  "nharr": "↮",
  "nhpar": "⫲",
  "ni": "∋",
  "nis": "⋼",
  "nisd": "⋺",
  "niv": "∋",
  "njcy": "њ",
  "nlArr": "⇍",
  "nlE": "≦̸",
  "nlarr": "↚",
  "nldr": "‥",
  "nle": "≰",
  "nleftarrow": "↚",
  "nleftrightarrow": "↮",
  "nleq": "≰",
  "nleqq": "≦̸",
  "nleqslant": "⩽̸",
  "nles": "⩽̸",
  "nless": "≮",
  "nlsim": "≴",
  "nlt": "≮",
  "nltri": "⋪",
  "nltrie": "⋬",
  "nmid": "∤",
  "nopf": "𝕟",
  "not": "¬",
  "notin": "∉",
  "notinE": "⋹̸",
  "notindot": "⋵̸",
  "notinva": "∉",
  "notinvb": "⋷",
  "notinvc": "⋶",
  "notni": "∌",
  "notniva": "∌",
  "notnivb": "⋾",
  "notnivc": "⋽",
  "npar": "∦",
  "nparallel": "∦",
  "nparsl": "⫽⃥",
  "npart": "∂̸",
  "npolint": "⨔",
  "npr": "⊀",
  "nprcue": "⋠",
  "npre": "⪯̸",
  "nprec": "⊀",
  "npreceq": "⪯̸",
  "nrArr": "⇏",
  "nrarr": "↛",
  "nrarrc": "⤳̸",
  "nrarrw": "↝̸",
  "nrightarrow": "↛",
  "nrtri": "⋫",
  "nrtrie": "⋭",
  "nsc": "⊁",
  "nsccue": "⋡",
  "nsce": "⪰̸",
  "nscr": "𝓃",
  "nshortmid": "∤",
  "nshortparallel": "∦",
  "nsim": "≁",
  "nsime": "≄",
  "nsimeq": "≄",
  "nsmid": "∤",
  "nspar": "∦",
  "nsqsube": "⋢",
  "nsqsupe": "⋣",
  "nsub": "⊄",
  "nsubE": "⫅̸",
  "nsube": "⊈",
  "nsubset": "⊂⃒",
  "nsubseteq": "⊈",
  "nsubseteqq": "⫅̸",
  "nsucc": "⊁",
  "nsucceq": "⪰̸",
  "nsup": "⊅",
  "nsupE": "⫆̸",
  "nsupe": "⊉",
  "nsupset": "⊃⃒",
  "nsupseteq": "⊉",
  "nsupseteqq": "⫆̸",
  "ntgl": "≹",
  "ntilde": "ñ",
  "ntlg": "≸",
  "ntriangleleft": "⋪",
  "ntrianglelefteq": "⋬",
  "ntriangleright": "⋫",
  "ntrianglerighteq": "⋭",
  "nu": "ν",
  "num": "#",
  "numero": "№",
  "numsp": " ",
  "nvDash": "⊭",
  "nvHarr": "⤄",
  "nvap": "≍⃒",
  "nvdash": "⊬",
  "nvge": "≥⃒",
  "nvgt": ">⃒",
  "nvinfin": "⧞",
  "nvlArr": "⤂",
  "nvle": "≤⃒",
  "nvlt": "<⃒",
  "nvltrie": "⊴⃒",
  "nvrArr": "⤃",
  "nvrtrie": "⊵⃒",
  "nvsim": "∼⃒",
  "nwArr": "⇖",
  "nwarhk": "⤣",
  "nwarr": "↖",
  "nwarrow": "↖",
  "nwnear": "⤧",
  "oS": "Ⓢ",
  "oacute": "ó",
  "oast": "⊛",
  "ocir": "⊚",
  "ocirc": "ô",
  "ocy": "о",
  "odash": "⊝",
  "odblac": "ő",
  "odiv": "⨸",
  "odot": "⊙",
  "odsold": "⦼",
  "oelig": "œ",
  "ofcir": "⦿",
  "ofr": "𝔬",
  "ogon": "˛",
  "ograve": "ò",
  "ogt": "⧁",
  "ohbar": "⦵",
  "ohm": "Ω",
  "oint": "∮",
  "olarr": "↺",
  "olcir": "⦾",
  "olcross": "⦻",
  "oline": "‾",
  "olt": "⧀",
  "omacr": "ō",
  "omega": "ω",
  "omicron": "ο",
  "omid": "⦶",
  "ominus": "⊖",
  "oopf": "𝕠",
  "opar": "⦷",
  "operp": "⦹",
  "oplus": "⊕",
  "or": "∨",
  "orarr": "↻",
  "ord": "⩝",
  "order": "ℴ",
  "orderof": "ℴ",
  "ordf": "ª",
  "ordm": "º",
  "origof": "⊶",
  "oror": "⩖",
  "orslope": "⩗",
  "orv": "⩛",
  "oscr": "ℴ",
  "oslash": "ø",
  "osol": "⊘",
  "otilde": "õ",
  "otimes": "⊗",
  "otimesas": "⨶",
  "ouml": "ö",
  "ovbar": "⌽",
  "par": "∥",
  "para": "¶",
  "parallel": "∥",
  "parsim": "⫳",
  "parsl": "⫽",
  "part": "∂",
  "pcy": "п",
  "percnt": "%",
  "period": ".",
  "permil": "‰",
  "perp": "⊥",
  "pertenk": "‱",
  "pfr": "𝔭",
  "phi": "φ",
  "phiv": "ϕ",
  "phmmat": "ℳ",
  "phone": "☎",
  "pi": "π",
  "pitchfork": "⋔",
  "piv": "ϖ",
  "planck": "ℏ",
  "planckh": "ℎ",
  "plankv": "ℏ",
  "plus": "+",
  "plusacir": "⨣",
  "plusb": "⊞",
  "pluscir": "⨢",
  "plusdo": "∔",
  "plusdu": "⨥",
  "pluse": "⩲",
  "plusmn": "±",
  "plussim": "⨦",
  "plustwo": "⨧",
  "pm": "±",
  "pointint": "⨕",
  "popf": "𝕡",
  "pound": "£",
  "pr": "≺",
  "prE": "⪳",
  "prap": "⪷",
  "prcue": "≼",
  "pre": "⪯",
  "prec": "≺",
  "precapprox": "⪷",
  "preccurlyeq": "≼",
  "preceq": "⪯",
  "precnapprox": "⪹",
  "precneqq": "⪵",
  "precnsim": "⋨",
  "precsim": "≾",
  "prime": "′",
  "primes": "ℙ",
  "prnE": "⪵",
  "prnap": "⪹",
  "prnsim": "⋨",
  "prod": "∏",
  "profalar": "⌮",
  "profline": "⌒",
  "profsurf": "⌓",
  "prop": "∝",
  "propto": "∝",
  "prsim": "≾",
  "prurel": "⊰",
  "pscr": "𝓅",
  "psi": "ψ",
  "puncsp": " ",
  "qfr": "𝔮",
  "qint": "⨌",
  "qopf": "𝕢",
  "qprime": "⁗",
  "qscr": "𝓆",
  "quaternions": "ℍ",
  "quatint": "⨖",
  "quest": "?",
  "questeq": "≟",
  "quot": "\"",
  "rAarr": "⇛",
  "rArr": "⇒",
  "rAtail": "⤜",
  "rBarr": "⤏",
  "rHar": "⥤",
  "race": "∽̱",
  "racute": "ŕ",
  "radic": "√",
  "raemptyv": "⦳",
  "rang": "⟩",
  "rangd": "⦒",
  "range": "⦥",
  "rangle": "⟩",
  "raquo": "»",
  "rarr": "→",
  "rarrap": "⥵",
  "rarrb": "⇥",
  "rarrbfs": "⤠",
  "rarrc": "⤳",
  "rarrfs": "⤞",
  "rarrhk": "↪",
  "rarrlp": "↬",
  "rarrpl": "⥅",
  "rarrsim": "⥴",
  "rarrtl": "↣",
  "rarrw": "↝",
  "ratail": "⤚",
  "ratio": "∶",
  "rationals": "ℚ",
  "rbarr": "⤍",
  "rbbrk": "❳",
  "rbrace": "}",
  "rbrack": "]",
  "rbrke": "⦌",
  "rbrksld": "⦎",
  "rbrkslu": "⦐",
  "rcaron": "ř",
  "rcedil": "ŗ",
  "rceil": "⌉",
  "rcub": "}",
  "rcy": "р",
  "rdca": "⤷",
  "rdldhar": "⥩",
  "rdquo": "”",
  "rdquor": "”",
  "rdsh": "↳",
  "real": "ℜ",
  "realine": "ℛ",
  "realpart": "ℜ",
  "reals": "ℝ",
  "rect": "▭",
  "reg": "®",
  "rfisht": "⥽",
  "rfloor": "⌋",
  "rfr": "𝔯",
  "rhard": "⇁",
  "rharu": "⇀",
  "rharul": "⥬",
  "rho": "ρ",
  "rhov": "ϱ",
  "rightarrow": "→",
  "rightarrowtail": "↣",
  "rightharpoondown": "⇁",
  "rightharpoonup": "⇀",
  "rightleftarrows": "⇄",
  "rightleftharpoons": "⇌",
  "rightrightarrows": "⇉",
  "rightsquigarrow": "↝",
  "rightthreetimes": "⋌",
  "ring": "˚",
  "risingdotseq": "≓",
  "rlarr": "⇄",
  "rlhar": "⇌",
  "rlm": "‏",
  "rmoust": "⎱",
  "rmoustache": "⎱",
  "rnmid": "⫮",
  "roang": "⟭",
  "roarr": "⇾",
  "robrk": "⟧",
  "ropar": "⦆",
  "ropf": "𝕣",
  "roplus": "⨮",
  "rotimes": "⨵",
  "rpar": ")",
  "rpargt": "⦔",
  "rppolint": "⨒",
  "rrarr": "⇉",
  "rsaquo": "›",
  "rscr": "𝓇",
  "rsh": "↱",
  "rsqb": "]",
  "rsquo": "’",
  "rsquor": "’",
  "rthree": "⋌",
  "rtimes": "⋊",
  "rtri": "▹",
  "rtrie": "⊵",
  "rtrif": "▸",
  "rtriltri": "⧎",
  "ruluhar": "⥨",
  "rx": "℞",
  "sacute": "ś",
  "sbquo": "‚",
  "sc": "≻",
  "scE": "⪴",
  "scap": "⪸",
  "scaron": "š",
  "sccue": "≽",
  "sce": "⪰",
  "scedil": "ş",
  "scirc": "ŝ",
  "scnE": "⪶",
  "scnap": "⪺",
  "scnsim": "⋩",
  "scpolint": "⨓",
  "scsim": "≿",
  "scy": "с",
  "sdot": "⋅",
  "sdotb": "⊡",
  "sdote": "⩦",
  "seArr": "⇘",
  "searhk": "⤥",
  "searr": "↘",
  "searrow": "↘",
  "sect": "§",
  "semi": ";",
  "seswar": "⤩",
  "setminus": "∖",
  "setmn": "∖",
  "sext": "✶",
  "sfr": "𝔰",
  "sfrown": "⌢",
  "sharp": "♯",
  "shchcy": "щ",
  "shcy": "ш",
  "shortmid": "∣",
  "shortparallel": "∥",
  "shy": "­",
  "sigma": "σ",
  "sigmaf": "ς",
  "sigmav": "ς",
  "sim": "∼",
  "simdot": "⩪",
  "sime": "≃",
  "simeq": "≃",
  "simg": "⪞",
  "simgE": "⪠",
  "siml": "⪝",
  "simlE": "⪟",
  "simne": "≆",
  "simplus": "⨤",
  "simrarr": "⥲",
  "slarr": "←",
  "smallsetminus": "∖",
  "smashp": "⨳",
  "smeparsl": "⧤",
  "smid": "∣",
  "smile": "⌣",
  "smt": "⪪",
  "smte": "⪬",
  "smtes": "⪬︀",
  "softcy": "ь",
  "sol": "/",
  "solb": "⧄",
  "solbar": "⌿",
  "sopf": "𝕤",
  "spades": "♠",
  "spadesuit": "♠",
  "spar": "∥",
  "sqcap": "⊓",
  "sqcaps": "⊓︀",
  "sqcup": "⊔",
  "sqcups": "⊔︀",
  "sqsub": "⊏",
  "sqsube": "⊑",
  "sqsubset": "⊏",
  "sqsubseteq": "⊑",
  "sqsup": "⊐",
  "sqsupe": "⊒",
  "sqsupset": "⊐",
  "sqsupseteq": "⊒",
  "squ": "□",
  "square": "□",
  "squarf": "▪",
  "squf": "▪",
  "srarr": "→",
  "sscr": "𝓈",
  "ssetmn": "∖",
  "ssmile": "⌣",
  "sstarf": "⋆",
  "star": "☆",
  "starf": "★",
  "straightepsilon": "ϵ",
  "straightphi": "ϕ",
  "strns": "¯",
  "sub": "⊂",
  "subE": "⫅",
  "subdot": "⪽",
  "sube": "⊆",
  "subedot": "⫃",
  "submult": "⫁",
  "subnE": "⫋",
  "subne": "⊊",
  "subplus": "⪿",
  "subrarr": "⥹",
  "subset": "⊂",
  "subseteq": "⊆",
  "subseteqq": "⫅",
  "subsetneq": "⊊",
  "subsetneqq": "⫋",
  "subsim": "⫇",
  "subsub": "⫕",
  "subsup": "⫓",
  "succ": "≻",
  "succapprox": "⪸",
  "succcurlyeq": "≽",
  "succeq": "⪰",
  "succnapprox": "⪺",
  "succneqq": "⪶",
  "succnsim": "⋩",
  "succsim": "≿",
  "sum": "∑",
  "sung": "♪",
  "sup1": "¹",
  "sup2": "²",
  "sup3": "³",
  "sup": "⊃",
  "supE": "⫆",
  "supdot": "⪾",
  "supdsub": "⫘",
  "supe": "⊇",
  "supedot": "⫄",
  "suphsol": "⟉",
  "suphsub": "⫗",
  "suplarr": "⥻",
  "supmult": "⫂",
  "supnE": "⫌",
  "supne": "⊋",
  "supplus": "⫀",
  "supset": "⊃",
  "supseteq": "⊇",
  "supseteqq": "⫆",
  "supsetneq": "⊋",
  "supsetneqq": "⫌",
  "supsim": "⫈",
  "supsub": "⫔",
  "supsup": "⫖",
  "swArr": "⇙",
  "swarhk": "⤦",
  "swarr": "↙",
  "swarrow": "↙",
  "swnwar": "⤪",
  "szlig": "ß",
  "target": "⌖",
  "tau": "τ",
  "tbrk": "⎴",
  "tcaron": "ť",
  "tcedil": "ţ",
  "tcy": "т",
  "tdot": "⃛",
  "telrec": "⌕",
  "tfr": "𝔱",
  "there4": "∴",
  "therefore": "∴",
  "theta": "θ",
  "thetasym": "ϑ",
  "thetav": "ϑ",
  "thickapprox": "≈",
  "thicksim": "∼",
  "thinsp": " ",
  "thkap": "≈",
  "thksim": "∼",
  "thorn": "þ",
  "tilde": "˜",
  "times": "×",
  "timesb": "⊠",
  "timesbar": "⨱",
  "timesd": "⨰",
  "tint": "∭",
  "toea": "⤨",
  "top": "⊤",
  "topbot": "⌶",
  "topcir": "⫱",
  "topf": "𝕥",
  "topfork": "⫚",
  "tosa": "⤩",
  "tprime": "‴",
  "trade": "™",
  "triangle": "▵",
  "triangledown": "▿",
  "triangleleft": "◃",
  "trianglelefteq": "⊴",
  "triangleq": "≜",
  "triangleright": "▹",
  "trianglerighteq": "⊵",
  "tridot": "◬",
  "trie": "≜",
  "triminus": "⨺",
  "triplus": "⨹",
  "trisb": "⧍",
  "tritime": "⨻",
  "trpezium": "⏢",
  "tscr": "𝓉",
  "tscy": "ц",
  "tshcy": "ћ",
  "tstrok": "ŧ",
  "twixt": "≬",
  "twoheadleftarrow": "↞",
  "twoheadrightarrow": "↠",
  "uArr": "⇑",
  "uHar": "⥣",
  "uacute": "ú",
  "uarr": "↑",
  "ubrcy": "ў",
  "ubreve": "ŭ",
  "ucirc": "û",
  "ucy": "у",
  "udarr": "⇅",
  "udblac": "ű",
  "udhar": "⥮",
  "ufisht": "⥾",
  "ufr": "𝔲",
  "ugrave": "ù",
  "uharl": "↿",
  "uharr": "↾",
  "uhblk": "▀",
  "ulcorn": "⌜",
  "ulcorner": "⌜",
  "ulcrop": "⌏",
  "ultri": "◸",
  "umacr": "ū",
  "uml": "¨",
  "uogon": "ų",
  "uopf": "𝕦",
  "uparrow": "↑",
  "updownarrow": "↕",
  "upharpoonleft": "↿",
  "upharpoonright": "↾",
  "uplus": "⊎",
  "upsi": "υ",
  "upsih": "ϒ",
  "upsilon": "υ",
  "upuparrows": "⇈",
  "urcorn": "⌝",
  "urcorner": "⌝",
  "urcrop": "⌎",
  "uring": "ů",
  "urtri": "◹",
  "uscr": "𝓊",
  "utdot": "⋰",
  "utilde": "ũ",
  "utri": "▵",
  "utrif": "▴",
  "uuarr": "⇈",
  "uuml": "ü",
  "uwangle": "⦧",
  "vArr": "⇕",
  "vBar": "⫨",
  "vBarv": "⫩",
  "vDash": "⊨",
  "vangrt": "⦜",
  "varepsilon": "ϵ",
  "varkappa": "ϰ",
  "varnothing": "∅",
  "varphi": "ϕ",
  "varpi": "ϖ",
  "varpropto": "∝",
  "varr": "↕",
  "varrho": "ϱ",
  "varsigma": "ς",
  "varsubsetneq": "⊊︀",
  "varsubsetneqq": "⫋︀",
  "varsupsetneq": "⊋︀",
  "varsupsetneqq": "⫌︀",
  "vartheta": "ϑ",
  "vartriangleleft": "⊲",
  "vartriangleright": "⊳",
  "vcy": "в",
  "vdash": "⊢",
  "vee": "∨",
  "veebar": "⊻",
  "veeeq": "≚",
  "vellip": "⋮",
  "verbar": "|",
  "vert": "|",
  "vfr": "𝔳",
  "vltri": "⊲",
  "vnsub": "⊂⃒",
  "vnsup": "⊃⃒",
  "vopf": "𝕧",
  "vprop": "∝",
  "vrtri": "⊳",
  "vscr": "𝓋",
  "vsubnE": "⫋︀",
  "vsubne": "⊊︀",
  "vsupnE": "⫌︀",
  "vsupne": "⊋︀",
  "vzigzag": "⦚",
  "wcirc": "ŵ",
  "wedbar": "⩟",
  "wedge": "∧",
  "wedgeq": "≙",
  "weierp": "℘",
  "wfr": "𝔴",
  "wopf": "𝕨",
  "wp": "℘",
  "wr": "≀",
  "wreath": "≀",
  "wscr": "𝓌",
  "xcap": "⋂",
  "xcirc": "◯",
  "xcup": "⋃",
  "xdtri": "▽",
  "xfr": "𝔵",
  "xhArr": "⟺",
  "xharr": "⟷",
  "xi": "ξ",
  "xlArr": "⟸",
  "xlarr": "⟵",
  "xmap": "⟼",
  "xnis": "⋻",
  "xodot": "⨀",
  "xopf": "𝕩",
  "xoplus": "⨁",
  "xotime": "⨂",
  "xrArr": "⟹",
  "xrarr": "⟶",
  "xscr": "𝓍",
  "xsqcup": "⨆",
  "xuplus": "⨄",
  "xutri": "△",
  "xvee": "⋁",
  "xwedge": "⋀",
  "yacute": "ý",
  "yacy": "я",
  "ycirc": "ŷ",
  "ycy": "ы",
  "yen": "¥",
  "yfr": "𝔶",
  "yicy": "ї",
  "yopf": "𝕪",
  "yscr": "𝓎",
  "yucy": "ю",
  "yuml": "ÿ",
  "zacute": "ź",
  "zcaron": "ž",
  "zcy": "з",
  "zdot": "ż",
  "zeetrf": "ℨ",
  "zeta": "ζ",
  "zfr": "𝔷",
  "zhcy": "ж",
  "zigrarr": "⇝",
  "zopf": "𝕫",
  "zscr": "𝓏",
  "zwj": "‍",
  "zwnj": "‌"
}

},{}],13:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer
 * @license MIT
 * @module character-entities
 * @fileoverview HTML character entity information.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Expose.
 */

module.exports = require('./index.json');

},{"./index.json":12}],14:[function(require,module,exports){
module.exports={
  "0": "�",
  "128": "€",
  "130": "‚",
  "131": "ƒ",
  "132": "„",
  "133": "…",
  "134": "†",
  "135": "‡",
  "136": "ˆ",
  "137": "‰",
  "138": "Š",
  "139": "‹",
  "140": "Œ",
  "142": "Ž",
  "145": "‘",
  "146": "’",
  "147": "“",
  "148": "”",
  "149": "•",
  "150": "–",
  "151": "—",
  "152": "˜",
  "153": "™",
  "154": "š",
  "155": "›",
  "156": "œ",
  "158": "ž",
  "159": "Ÿ"
}

},{}],15:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer
 * @license MIT
 * @module character-reference-invalid
 * @fileoverview HTML invalid numeric character reference information.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Expose.
 */

module.exports = require('./index.json');

},{"./index.json":14}],16:[function(require,module,exports){
(function (Buffer){
var clone = (function() {
'use strict';

/**
 * Clones (copies) an Object using deep copying.
 *
 * This function supports circular references by default, but if you are certain
 * there are no circular references in your object, you can save some CPU time
 * by calling clone(obj, false).
 *
 * Caution: if `circular` is false and `parent` contains circular references,
 * your program may enter an infinite loop and crash.
 *
 * @param `parent` - the object to be cloned
 * @param `circular` - set to true if the object to be cloned may contain
 *    circular references. (optional - true by default)
 * @param `depth` - set to a number if the object is only to be cloned to
 *    a particular depth. (optional - defaults to Infinity)
 * @param `prototype` - sets the prototype to be used when cloning an object.
 *    (optional - defaults to parent prototype).
*/
function clone(parent, circular, depth, prototype) {
  var filter;
  if (typeof circular === 'object') {
    depth = circular.depth;
    prototype = circular.prototype;
    filter = circular.filter;
    circular = circular.circular
  }
  // maintain two arrays for circular references, where corresponding parents
  // and children have the same index
  var allParents = [];
  var allChildren = [];

  var useBuffer = typeof Buffer != 'undefined';

  if (typeof circular == 'undefined')
    circular = true;

  if (typeof depth == 'undefined')
    depth = Infinity;

  // recurse this function so we don't reset allParents and allChildren
  function _clone(parent, depth) {
    // cloning null always returns null
    if (parent === null)
      return null;

    if (depth == 0)
      return parent;

    var child;
    var proto;
    if (typeof parent != 'object') {
      return parent;
    }

    if (clone.__isArray(parent)) {
      child = [];
    } else if (clone.__isRegExp(parent)) {
      child = new RegExp(parent.source, __getRegExpFlags(parent));
      if (parent.lastIndex) child.lastIndex = parent.lastIndex;
    } else if (clone.__isDate(parent)) {
      child = new Date(parent.getTime());
    } else if (useBuffer && Buffer.isBuffer(parent)) {
      child = new Buffer(parent.length);
      parent.copy(child);
      return child;
    } else {
      if (typeof prototype == 'undefined') {
        proto = Object.getPrototypeOf(parent);
        child = Object.create(proto);
      }
      else {
        child = Object.create(prototype);
        proto = prototype;
      }
    }

    if (circular) {
      var index = allParents.indexOf(parent);

      if (index != -1) {
        return allChildren[index];
      }
      allParents.push(parent);
      allChildren.push(child);
    }

    for (var i in parent) {
      var attrs;
      if (proto) {
        attrs = Object.getOwnPropertyDescriptor(proto, i);
      }

      if (attrs && attrs.set == null) {
        continue;
      }
      child[i] = _clone(parent[i], depth - 1);
    }

    return child;
  }

  return _clone(parent, depth);
}

/**
 * Simple flat clone using prototype, accepts only objects, usefull for property
 * override on FLAT configuration object (no nested props).
 *
 * USE WITH CAUTION! This may not behave as you wish if you do not know how this
 * works.
 */
clone.clonePrototype = function clonePrototype(parent) {
  if (parent === null)
    return null;

  var c = function () {};
  c.prototype = parent;
  return new c();
};

// private utility functions

function __objToStr(o) {
  return Object.prototype.toString.call(o);
};
clone.__objToStr = __objToStr;

function __isDate(o) {
  return typeof o === 'object' && __objToStr(o) === '[object Date]';
};
clone.__isDate = __isDate;

function __isArray(o) {
  return typeof o === 'object' && __objToStr(o) === '[object Array]';
};
clone.__isArray = __isArray;

function __isRegExp(o) {
  return typeof o === 'object' && __objToStr(o) === '[object RegExp]';
};
clone.__isRegExp = __isRegExp;

function __getRegExpFlags(re) {
  var flags = '';
  if (re.global) flags += 'g';
  if (re.ignoreCase) flags += 'i';
  if (re.multiline) flags += 'm';
  return flags;
};
clone.__getRegExpFlags = __getRegExpFlags;

return clone;
})();

if (typeof module === 'object' && module.exports) {
  module.exports = clone;
}

}).call(this,require("buffer").Buffer)
},{"buffer":6}],17:[function(require,module,exports){

/**
 * slice() reference.
 */

var slice = Array.prototype.slice;

/**
 * Expose `co`.
 */

module.exports = co;

/**
 * Wrap the given generator `fn` and
 * return a thunk.
 *
 * @param {Function} fn
 * @return {Function}
 * @api public
 */

function co(fn) {
  var isGenFun = isGeneratorFunction(fn);

  return function (done) {
    var ctx = this;

    // in toThunk() below we invoke co()
    // with a generator, so optimize for
    // this case
    var gen = fn;

    // we only need to parse the arguments
    // if gen is a generator function.
    if (isGenFun) {
      var args = slice.call(arguments), len = args.length;
      var hasCallback = len && 'function' == typeof args[len - 1];
      done = hasCallback ? args.pop() : error;
      gen = fn.apply(this, args);
    } else {
      done = done || error;
    }

    next();

    // #92
    // wrap the callback in a setImmediate
    // so that any of its errors aren't caught by `co`
    function exit(err, res) {
      setImmediate(function(){
        done.call(ctx, err, res);
      });
    }

    function next(err, res) {
      var ret;

      // multiple args
      if (arguments.length > 2) res = slice.call(arguments, 1);

      // error
      if (err) {
        try {
          ret = gen.throw(err);
        } catch (e) {
          return exit(e);
        }
      }

      // ok
      if (!err) {
        try {
          ret = gen.next(res);
        } catch (e) {
          return exit(e);
        }
      }

      // done
      if (ret.done) return exit(null, ret.value);

      // normalize
      ret.value = toThunk(ret.value, ctx);

      // run
      if ('function' == typeof ret.value) {
        var called = false;
        try {
          ret.value.call(ctx, function(){
            if (called) return;
            called = true;
            next.apply(ctx, arguments);
          });
        } catch (e) {
          setImmediate(function(){
            if (called) return;
            called = true;
            next(e);
          });
        }
        return;
      }

      // invalid
      next(new TypeError('You may only yield a function, promise, generator, array, or object, '
        + 'but the following was passed: "' + String(ret.value) + '"'));
    }
  }
}

/**
 * Convert `obj` into a normalized thunk.
 *
 * @param {Mixed} obj
 * @param {Mixed} ctx
 * @return {Function}
 * @api private
 */

function toThunk(obj, ctx) {

  if (isGeneratorFunction(obj)) {
    return co(obj.call(ctx));
  }

  if (isGenerator(obj)) {
    return co(obj);
  }

  if (isPromise(obj)) {
    return promiseToThunk(obj);
  }

  if ('function' == typeof obj) {
    return obj;
  }

  if (isObject(obj) || Array.isArray(obj)) {
    return objectToThunk.call(ctx, obj);
  }

  return obj;
}

/**
 * Convert an object of yieldables to a thunk.
 *
 * @param {Object} obj
 * @return {Function}
 * @api private
 */

function objectToThunk(obj){
  var ctx = this;
  var isArray = Array.isArray(obj);

  return function(done){
    var keys = Object.keys(obj);
    var pending = keys.length;
    var results = isArray
      ? new Array(pending) // predefine the array length
      : new obj.constructor();
    var finished;

    if (!pending) {
      setImmediate(function(){
        done(null, results)
      });
      return;
    }

    // prepopulate object keys to preserve key ordering
    if (!isArray) {
      for (var i = 0; i < pending; i++) {
        results[keys[i]] = undefined;
      }
    }

    for (var i = 0; i < keys.length; i++) {
      run(obj[keys[i]], keys[i]);
    }

    function run(fn, key) {
      if (finished) return;
      try {
        fn = toThunk(fn, ctx);

        if ('function' != typeof fn) {
          results[key] = fn;
          return --pending || done(null, results);
        }

        fn.call(ctx, function(err, res){
          if (finished) return;

          if (err) {
            finished = true;
            return done(err);
          }

          results[key] = res;
          --pending || done(null, results);
        });
      } catch (err) {
        finished = true;
        done(err);
      }
    }
  }
}

/**
 * Convert `promise` to a thunk.
 *
 * @param {Object} promise
 * @return {Function}
 * @api private
 */

function promiseToThunk(promise) {
  return function(fn){
    promise.then(function(res) {
      fn(null, res);
    }, fn);
  }
}

/**
 * Check if `obj` is a promise.
 *
 * @param {Object} obj
 * @return {Boolean}
 * @api private
 */

function isPromise(obj) {
  return obj && 'function' == typeof obj.then;
}

/**
 * Check if `obj` is a generator.
 *
 * @param {Mixed} obj
 * @return {Boolean}
 * @api private
 */

function isGenerator(obj) {
  return obj && 'function' == typeof obj.next && 'function' == typeof obj.throw;
}

/**
 * Check if `obj` is a generator function.
 *
 * @param {Mixed} obj
 * @return {Boolean}
 * @api private
 */

function isGeneratorFunction(obj) {
  return obj && obj.constructor && 'GeneratorFunction' == obj.constructor.name;
}

/**
 * Check for plain object.
 *
 * @param {Mixed} val
 * @return {Boolean}
 * @api private
 */

function isObject(val) {
  return val && Object == val.constructor;
}

/**
 * Throw `err` in a new stack.
 *
 * This is used when co() is invoked
 * without supplying a callback, which
 * should only be for demonstrational
 * purposes.
 *
 * @param {Error} err
 * @api private
 */

function error(err) {
  if (!err) return;
  setImmediate(function(){
    throw err;
  });
}

},{}],18:[function(require,module,exports){
'use strict';

/*
 * Constants.
 */

var WHITE_SPACE_COLLAPSABLE = /\s+/g;
var SPACE = ' ';

/**
 * Replace multiple white-space characters with a single space.
 *
 * @example
 *   collapse(' \t\nbar \nbaz\t'); // ' bar baz '
 *
 * @param {string} value - Value with uncollapsed white-space,
 *   coerced to string.
 * @return {string} - Value with collapsed white-space.
 */
function collapse(value) {
    return String(value).replace(WHITE_SPACE_COLLAPSABLE, SPACE);
}

/*
 * Expose.
 */

module.exports = collapse;

},{}],19:[function(require,module,exports){
/**
 * Extend an object with another.
 *
 * @param {Object, ...} src, ...
 * @return {Object} merged
 * @api private
 */

module.exports = function(src) {
  var objs = [].slice.call(arguments, 1), obj;

  for (var i = 0, len = objs.length; i < len; i++) {
    obj = objs[i];
    for (var prop in obj) {
      src[prop] = obj[prop];
    }
  }

  return src;
}

},{}],20:[function(require,module,exports){
'use strict';

var hasOwn = Object.prototype.hasOwnProperty;
var toStr = Object.prototype.toString;

var isArray = function isArray(arr) {
	if (typeof Array.isArray === 'function') {
		return Array.isArray(arr);
	}

	return toStr.call(arr) === '[object Array]';
};

var isPlainObject = function isPlainObject(obj) {
	if (!obj || toStr.call(obj) !== '[object Object]') {
		return false;
	}

	var hasOwnConstructor = hasOwn.call(obj, 'constructor');
	var hasIsPrototypeOf = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
	// Not own constructor property must be Object
	if (obj.constructor && !hasOwnConstructor && !hasIsPrototypeOf) {
		return false;
	}

	// Own properties are enumerated firstly, so to speed up,
	// if last one is own, then all properties are own.
	var key;
	for (key in obj) {/**/}

	return typeof key === 'undefined' || hasOwn.call(obj, key);
};

module.exports = function extend() {
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[0],
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if (typeof target === 'boolean') {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	} else if ((typeof target !== 'object' && typeof target !== 'function') || target == null) {
		target = {};
	}

	for (; i < length; ++i) {
		options = arguments[i];
		// Only deal with non-null/undefined values
		if (options != null) {
			// Extend the base object
			for (name in options) {
				src = target[name];
				copy = options[name];

				// Prevent never-ending loop
				if (target !== copy) {
					// Recurse if we're merging plain objects or arrays
					if (deep && copy && (isPlainObject(copy) || (copyIsArray = isArray(copy)))) {
						if (copyIsArray) {
							copyIsArray = false;
							clone = src && isArray(src) ? src : [];
						} else {
							clone = src && isPlainObject(src) ? src : {};
						}

						// Never move original objects, clone them
						target[name] = extend(deep, clone, copy);

					// Don't bring in undefined values
					} else if (typeof copy !== 'undefined') {
						target[name] = copy;
					}
				}
			}
		}
	}

	// Return the modified object
	return target;
};


},{}],21:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],22:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],23:[function(require,module,exports){

/**
 * isArray
 */

var isArray = Array.isArray;

/**
 * toString
 */

var str = Object.prototype.toString;

/**
 * Whether or not the given `val`
 * is an array.
 *
 * example:
 *
 *        isArray([]);
 *        // > true
 *        isArray(arguments);
 *        // > false
 *        isArray('');
 *        // > false
 *
 * @param {mixed} val
 * @return {bool}
 */

module.exports = isArray || function (val) {
  return !! val && '[object Array]' == str.call(val);
};

},{}],24:[function(require,module,exports){
'use strict';

/**
 * Get the count of the longest repeating streak of
 * `character` in `value`.
 *
 * @example
 *   longestStreak('` foo `` bar `', '`') // 2
 *
 * @param {string} value - Content, coerced to string.
 * @param {string} character - Single character to look
 *   for.
 * @return {number} - Number of characters at the place
 *   where `character` occurs in its longest streak in
 *   `value`.
 * @throws {Error} - when `character` is not a single
 *   character.
 */
function longestStreak(value, character) {
    var count = 0;
    var maximum = 0;
    var index = -1;
    var length;

    value = String(value);
    length = value.length;

    if (typeof character !== 'string' || character.length !== 1) {
        throw new Error('Expected character');
    }

    while (++index < length) {
        if (value.charAt(index) === character) {
            count++;

            if (count > maximum) {
                maximum = count;
            }
        } else {
            count = 0;
        }
    }

    return maximum;
}

/*
 * Expose.
 */

module.exports = longestStreak;

},{}],25:[function(require,module,exports){
'use strict';

/*
 * Useful expressions.
 */

var EXPRESSION_DOT = /\./;
var EXPRESSION_LAST_DOT = /\.[^.]*$/;

/*
 * Allowed alignment values.
 */

var LEFT = 'l';
var RIGHT = 'r';
var CENTER = 'c';
var DOT = '.';
var NULL = '';

var ALLIGNMENT = [LEFT, RIGHT, CENTER, DOT, NULL];

/*
 * Characters.
 */

var COLON = ':';
var DASH = '-';
var PIPE = '|';
var SPACE = ' ';
var NEW_LINE = '\n';

/**
 * Get the length of `value`.
 *
 * @param {string} value
 * @return {number}
 */
function lengthNoop(value) {
    return String(value).length;
}

/**
 * Get a string consisting of `length` `character`s.
 *
 * @param {number} length
 * @param {string} [character=' ']
 * @return {string}
 */
function pad(length, character) {
    return Array(length + 1).join(character || SPACE);
}

/**
 * Get the position of the last dot in `value`.
 *
 * @param {string} value
 * @return {number}
 */
function dotindex(value) {
    var match = EXPRESSION_LAST_DOT.exec(value);

    return match ? match.index + 1 : value.length;
}

/**
 * Create a table from a matrix of strings.
 *
 * @param {Array.<Array.<string>>} table
 * @param {Object?} options
 * @param {boolean?} [options.rule=true]
 * @param {string?} [options.delimiter=" | "]
 * @param {string?} [options.start="| "]
 * @param {string?} [options.end=" |"]
 * @param {Array.<string>?} options.align
 * @param {function(string)?} options.stringLength
 * @return {string} Pretty table
 */
function markdownTable(table, options) {
    var settings = options || {};
    var delimiter = settings.delimiter;
    var start = settings.start;
    var end = settings.end;
    var alignment = settings.align;
    var calculateStringLength = settings.stringLength || lengthNoop;
    var cellCount = 0;
    var rowIndex = -1;
    var rowLength = table.length;
    var sizes = [];
    var align;
    var rule;
    var rows;
    var row;
    var cells;
    var index;
    var position;
    var size;
    var value;
    var spacing;
    var before;
    var after;

    alignment = alignment ? alignment.concat() : [];

    if (delimiter === null || delimiter === undefined) {
        delimiter = SPACE + PIPE + SPACE;
    }

    if (start === null || start === undefined) {
        start = PIPE + SPACE;
    }

    if (end === null || end === undefined) {
        end = SPACE + PIPE;
    }

    while (++rowIndex < rowLength) {
        row = table[rowIndex];

        index = -1;

        if (row.length > cellCount) {
            cellCount = row.length;
        }

        while (++index < cellCount) {
            position = row[index] ? dotindex(row[index]) : null;

            if (!sizes[index]) {
                sizes[index] = 3;
            }

            if (position > sizes[index]) {
                sizes[index] = position;
            }
        }
    }

    if (typeof alignment === 'string') {
        alignment = pad(cellCount, alignment).split('');
    }

    /*
     * Make sure only valid alignments are used.
     */

    index = -1;

    while (++index < cellCount) {
        align = alignment[index];

        if (typeof align === 'string') {
            align = align.charAt(0).toLowerCase();
        }

        if (ALLIGNMENT.indexOf(align) === -1) {
            align = NULL;
        }

        alignment[index] = align;
    }

    rowIndex = -1;
    rows = [];

    while (++rowIndex < rowLength) {
        row = table[rowIndex];

        index = -1;
        cells = [];

        while (++index < cellCount) {
            value = row[index];

            if (value === null || value === undefined) {
                value = '';
            } else {
                value = String(value);
            }

            if (alignment[index] !== DOT) {
                cells[index] = value;
            } else {
                position = dotindex(value);

                size = sizes[index] +
                    (EXPRESSION_DOT.test(value) ? 0 : 1) -
                    (calculateStringLength(value) - position);

                cells[index] = value + pad(size - 1);
            }
        }

        rows[rowIndex] = cells;
    }

    sizes = [];
    rowIndex = -1;

    while (++rowIndex < rowLength) {
        cells = rows[rowIndex];

        index = -1;

        while (++index < cellCount) {
            value = cells[index];

            if (!sizes[index]) {
                sizes[index] = 3;
            }

            size = calculateStringLength(value);

            if (size > sizes[index]) {
                sizes[index] = size;
            }
        }
    }

    rowIndex = -1;

    while (++rowIndex < rowLength) {
        cells = rows[rowIndex];

        index = -1;

        while (++index < cellCount) {
            value = cells[index];

            position = sizes[index] - (calculateStringLength(value) || 0);
            spacing = pad(position);

            if (alignment[index] === RIGHT || alignment[index] === DOT) {
                value = spacing + value;
            } else if (alignment[index] !== CENTER) {
                value = value + spacing;
            } else {
                position = position / 2;

                if (position % 1 === 0) {
                    before = position;
                    after = position;
                } else {
                    before = position + 0.5;
                    after = position - 0.5;
                }

                value = pad(before) + value + pad(after);
            }

            cells[index] = value;
        }

        rows[rowIndex] = cells.join(delimiter);
    }

    if (settings.rule !== false) {
        index = -1;
        rule = [];

        while (++index < cellCount) {
            align = alignment[index];

            /*
             * When `align` is left, don't add colons.
             */

            value = align === RIGHT || align === NULL ? DASH : COLON;
            value += pad(sizes[index] - 2, DASH);
            value += align !== LEFT && align !== NULL ? COLON : DASH;

            rule[index] = value;
        }

        rows.splice(1, 0, rule.join(delimiter));
    }

    return start + rows.join(end + NEW_LINE + start) + end;
}

/*
 * Expose `markdownTable`.
 */

module.exports = markdownTable;

},{}],26:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer
 * @license MIT
 * @module nlcst:is-literal
 * @fileoverview Check whether an NLCST node is meant literally.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var toString = require('nlcst-to-string');

/*
 * Single delimiters.
 */

var single = {
    '-': true, // hyphen-minus
    '–': true, // en-dash
    '—': true, // em-dash
    ':': true, // colon
    ';': true // semicolon
};

/*
 * Pair delimiters. From common sense, and wikipedia:
 * Mostly from https://en.wikipedia.org/wiki/Quotation_mark.
 */

var pairs = {
    ',': {
        ',': true
    },
    '-': {
        '-': true
    },
    '–': {
        '–': true
    },
    '—': {
        '—': true
    },
    '"': {
        '"': true
    },
    '\'': {
        '\'': true
    },
    '‘': {
        '’': true
    },
    '‚': {
        '’': true
    },
    '’': {
        '’': true,
        '‚': true
    },
    '“': {
        '”': true
    },
    '”': {
        '”': true
    },
    '„': {
        '”': true,
        '“': true
    },
    '«': {
        '»': true
    },
    '»': {
        '«': true
    },
    '‹': {
        '›': true
    },
    '›': {
        '‹': true
    },
    '(': {
        ')': true
    },
    '[': {
        ']': true
    },
    '{': {
        '}': true
    },
    '⟨': {
        '⟩': true
    },
    '「': {
        '」': true
    }
}

/**
 * Check whether parent contains word-nodes between
 * `start` and `end`.
 *
 * @param {NLCSTParentNode} parent - Node with children.
 * @param {number} start - Starting point (inclusive).
 * @param {number} end - Ending point (exclusive).
 * @return {boolean} - Whether word-nodes are found.
 */
function containsWord(parent, start, end) {
    var siblings = parent.children;
    var index = start - 1;

    while (++index < end) {
        if (siblings[index].type === 'WordNode') {
            return true;
        }
    }

    return false;
}

/**
 * Check if there are word nodes before `position`
 * in `parent`.
 *
 * @param {NLCSTParentNode} parent - Node with children.
 * @param {number} position - Position before which to
 *   check.
 * @return {boolean} - Whether word-nodes are found.
 */
function hasWordsBefore(parent, position) {
    return containsWord(parent, 0, position);
}

/**
 * Check if there are word nodes before `position`
 * in `parent`.
 *
 * @param {NLCSTParentNode} parent - Node with children.
 * @param {number} position - Position afyer which to
 *   check.
 * @return {boolean} - Whether word-nodes are found.
 */
function hasWordsAfter(parent, position) {
    return containsWord(parent, position + 1, parent.children.length);
}

/**
 * Check if `node` is in `delimiters`.
 *
 * @param {Node} node - Node to check.
 * @param {Object} delimiters - Map of delimiters.
 * @return {(Node|boolean)?} - `false` if not, the given
 *   node when true, and `null` when this is a white-space
 *   node.
 */
function delimiterCheck(node, delimiters) {
    var type = node.type;

    if (type === 'WordNode' || type === 'SourceNode') {
        return false;
    }

    if (type === 'WhiteSpaceNode') {
        return null;
    }

    return toString(node) in delimiters ? node : false;
}

/**
 * Find the next delimiter after `position` in
 * `parent`. Returns the delimiter node when found.
 *
 * @param {NLCSTParentNode} parent - Parent to search.
 * @param {number} position - Position to search after.
 * @param {Object} delimiters - Map of delimiters.
 * @return {Node?} - Following delimiter.
 */
function nextDelimiter(parent, position, delimiters) {
    var siblings = parent.children;
    var index = position;
    var length = siblings.length;
    var result;

    while (++index < length) {
        result = delimiterCheck(siblings[index], delimiters);

        if (result === null) {
            continue;
        }

        return result;
    }

    return null;
}

/**
 * Find the previous delimiter before `position` in
 * `parent`. Returns the delimiter node when found.
 *
 * @param {NLCSTParentNode} parent - Parent to search.
 * @param {number} position - Position to search before.
 * @param {Object} delimiters - Map of delimiters.
 * @return {Node?} - Previous delimiter.
 */
function previousDelimiter(parent, position, delimiters) {
    var siblings = parent.children;
    var index = position;
    var result;

    while (index--) {
        result = delimiterCheck(siblings[index], delimiters);

        if (result === null) {
            continue;
        }

        return result;
    }

    return null;
}

/**
 * Check if the node in `parent` at `position` is enclosed
 * by matching delimiters.
 *
 * @param {NLCSTParentNode} parent - Parent to search.
 * @param {number} position - Position of node to check.
 * @param {Object} delimiters - Map of delimiters.
 * @return {boolean} - Whether the node is wrapped.
 */
function isWrapped(parent, position, delimiters) {
    var prev = previousDelimiter(parent, position, delimiters);
    var next;

    if (prev) {
        next = nextDelimiter(parent, position, delimiters[toString(prev)]);
    }

    return Boolean(next);
}

/**
 * Check if the node in `parent` at `position` is enclosed
 * by matching delimiters.
 *
 * For example, in:
 *
 * -   `Foo - is meant as a literal.`;
 * -   `Meant as a literal is - foo.`;
 * -   `The word “foo” is meant as a literal.`;
 *
 * ...`foo` is literal.
 *
 * @param {NLCSTParentNode} parent - Parent to search.
 * @param {number} index - Position of node to check.
 * @return {boolean} - Whether the node is wrapped.
 */
function isLiteral(parent, index) {
    if (!(parent && parent.children)) {
        throw new Error('Parent must be a node');
    }

    if (isNaN(index)) {
        throw new Error('Index must be a number');
    }

    if (
        (!hasWordsBefore(parent, index) && nextDelimiter(parent, index, single)) ||
        (!hasWordsAfter(parent, index) && previousDelimiter(parent, index, single)) ||
        isWrapped(parent, index, pairs)
    ) {
        return true;
    }

    return false;
}

/*
 * Expose.
 */

module.exports = isLiteral;

},{"nlcst-to-string":27}],27:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer
 * @license MIT
 * @module nlcst:to-string
 * @fileoverview Transform an NLCST node into a string.
 */

'use strict';

/* eslint-env commonjs */

/**
 * Stringify an NLCST node.
 *
 * @param {NLCSTNode|Array.<NLCSTNode>} node - Node to to
 *   stringify.
 * @param {string} separator - Value to separate each item
 *   with.
 * @return {string} - Stringified `node`.
 */
function nlcstToString(node, separator) {
    var values;
    var length;
    var children;

    separator = separator || '';

    if (typeof node.value === 'string') {
        return node.value;
    }

    children = 'length' in node ? node : node.children;
    length = children.length;

    /*
     * Shortcut: This is pretty common, and a small performance win.
     */

    if (length === 1 && 'value' in children[0]) {
        return children[0].value;
    }

    values = [];

    while (length--) {
        values[length] = nlcstToString(children[length], separator);
    }

    return values.join(separator);
}

/*
 * Expose.
 */

module.exports = nlcstToString;

},{}],28:[function(require,module,exports){
'use strict';

// modified from https://github.com/es-shims/es5-shim
var has = Object.prototype.hasOwnProperty;
var toStr = Object.prototype.toString;
var slice = Array.prototype.slice;
var isArgs = require('./isArguments');
var hasDontEnumBug = !({ toString: null }).propertyIsEnumerable('toString');
var hasProtoEnumBug = function () {}.propertyIsEnumerable('prototype');
var dontEnums = [
	'toString',
	'toLocaleString',
	'valueOf',
	'hasOwnProperty',
	'isPrototypeOf',
	'propertyIsEnumerable',
	'constructor'
];
var equalsConstructorPrototype = function (o) {
	var ctor = o.constructor;
	return ctor && ctor.prototype === o;
};
var blacklistedKeys = {
	$console: true,
	$frame: true,
	$frameElement: true,
	$frames: true,
	$parent: true,
	$self: true,
	$webkitIndexedDB: true,
	$webkitStorageInfo: true,
	$window: true
};
var hasAutomationEqualityBug = (function () {
	/* global window */
	if (typeof window === 'undefined') { return false; }
	for (var k in window) {
		try {
			if (!blacklistedKeys['$' + k] && has.call(window, k) && window[k] !== null && typeof window[k] === 'object') {
				try {
					equalsConstructorPrototype(window[k]);
				} catch (e) {
					return true;
				}
			}
		} catch (e) {
			return true;
		}
	}
	return false;
}());
var equalsConstructorPrototypeIfNotBuggy = function (o) {
	/* global window */
	if (typeof window === 'undefined' || !hasAutomationEqualityBug) {
		return equalsConstructorPrototype(o);
	}
	try {
		return equalsConstructorPrototype(o);
	} catch (e) {
		return false;
	}
};

var keysShim = function keys(object) {
	var isObject = object !== null && typeof object === 'object';
	var isFunction = toStr.call(object) === '[object Function]';
	var isArguments = isArgs(object);
	var isString = isObject && toStr.call(object) === '[object String]';
	var theKeys = [];

	if (!isObject && !isFunction && !isArguments) {
		throw new TypeError('Object.keys called on a non-object');
	}

	var skipProto = hasProtoEnumBug && isFunction;
	if (isString && object.length > 0 && !has.call(object, 0)) {
		for (var i = 0; i < object.length; ++i) {
			theKeys.push(String(i));
		}
	}

	if (isArguments && object.length > 0) {
		for (var j = 0; j < object.length; ++j) {
			theKeys.push(String(j));
		}
	} else {
		for (var name in object) {
			if (!(skipProto && name === 'prototype') && has.call(object, name)) {
				theKeys.push(String(name));
			}
		}
	}

	if (hasDontEnumBug) {
		var skipConstructor = equalsConstructorPrototypeIfNotBuggy(object);

		for (var k = 0; k < dontEnums.length; ++k) {
			if (!(skipConstructor && dontEnums[k] === 'constructor') && has.call(object, dontEnums[k])) {
				theKeys.push(dontEnums[k]);
			}
		}
	}
	return theKeys;
};

keysShim.shim = function shimObjectKeys() {
	if (Object.keys) {
		var keysWorksWithArguments = (function () {
			// Safari 5.0 bug
			return (Object.keys(arguments) || '').length === 2;
		}(1, 2));
		if (!keysWorksWithArguments) {
			var originalKeys = Object.keys;
			Object.keys = function keys(object) {
				if (isArgs(object)) {
					return originalKeys(slice.call(object));
				} else {
					return originalKeys(object);
				}
			};
		}
	} else {
		Object.keys = keysShim;
	}
	return Object.keys || keysShim;
};

module.exports = keysShim;

},{"./isArguments":29}],29:[function(require,module,exports){
'use strict';

var toStr = Object.prototype.toString;

module.exports = function isArguments(value) {
	var str = toStr.call(value);
	var isArgs = str === '[object Arguments]';
	if (!isArgs) {
		isArgs = str !== '[object Array]' &&
			value !== null &&
			typeof value === 'object' &&
			typeof value.length === 'number' &&
			value.length >= 0 &&
			toStr.call(value.callee) === '[object Function]';
	}
	return isArgs;
};

},{}],30:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer
 * @license MIT
 * @module parse-english
 * @fileoverview English (natural language) parser.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var Parser = require('parse-latin');
var nlcstToString = require('nlcst-to-string');
var visitChildren = require('unist-util-visit-children');
var modifyChildren = require('unist-util-modify-children');

/*
 * Constants.
 */

/*
 * Match a blacklisted (case-insensitive) abbreviation
 * which when followed by a full-stop does not depict
 * a sentence terminal marker.
 */

var EXPRESSION_ABBREVIATION_ENGLISH_PREFIX = new RegExp(
    '^(' +
        /*
         * Business Abbreviations:
         *
         * Incorporation, Limited company.
         */

        'inc|ltd|' +

        /*
         * English unit abbreviations:
         * - Note that *Metric abbreviations* do not use
         *   full stops.
         * - Note that some common plurals are included,
         *   although units should not be pluralised.
         *
         * barrel, cubic, dozen, fluid (ounce), foot, gallon, grain, gross,
         * inch, karat / knot, pound, mile, ounce, pint, quart, square,
         * tablespoon, teaspoon, yard.
         */

        'bbls?|cu|doz|fl|ft|gal|gr|gro|in|kt|lbs?|mi|oz|pt|qt|sq|tbsp|' +
        'tsp|yds?|' +

        /*
         * Abbreviations of time references:
         *
         * seconds, minutes, hours, Monday, Tuesday, *, Wednesday,
         * Thursday, *, Friday, Saturday, Sunday, January, Februari, March,
         * April, June, July, August, September, *, October, November,
         * December.
         */

        'sec|min|hr|mon|tue|tues|wed|thu|thurs|fri|sat|sun|jan|feb|mar|' +
        'apr|jun|jul|aug|sep|sept|oct|nov|dec' +
    ')$'
    /*
     * NOTE! There's no `i` flag here because the value to
     * test against should be all lowercase!
     */
);

/*
 * Match a blacklisted (case-sensitive) abbreviation
 * which when followed by a full-stop does not depict
 * a sentence terminal marker.
 */

var EXPRESSION_ABBREVIATION_ENGLISH_PREFIX_SENSITIVE = new RegExp(
    '^(' +
        /*
         * Social:
         *
         * Mister, Mistress, Mistress, woman, Mademoiselle, Madame, Monsieur,
         * Misters, Mesdames, Junior, Senior, *.
         */

        'Mr|Mrs|Miss|Ms|Mss|Mses|Mlle|Mme|M|Messrs|Mmes|Jr|Sr|Snr|' +

        /*
         * Rank and academic:
         *
         * Doctor, Magister, Attorney, Profesor, Honourable, Reverend,
         * Father, Monsignor, Sister, Brother, Saint, President,
         * Superintendent, Representative, Senator.
         */

        'Dr|Mgr|Atty|Prof|Hon|Rev|Fr|Msgr|Sr|Br|St|Pres|Supt|Rep|Sen|' +

        /*
         * Rank and military:
         *
         * Governor, Ambassador, Treasurer, Secretary, Admiral, Brigadier,
         * General, Commander, Colonel, Captain, Lieutenant, Major,
         * Sergeant, Petty Officer, Warrant Officer, Purple Heart.
         */

        'Gov|Amb|Treas|Sec|Amd|Brig|Gen|Cdr|Col|Capt|Lt|Maj|Sgt|Po|Wo|Ph|' +

        /*
         * Common geographical abbreviations:
         *
         * Avenue, Boulevard, Mountain, Road, Building, National, *, Route, *,
         * County, Park, Square, Drive, Port or Point, Street or State, Fort,
         * Peninsula, Territory, Highway, Freeway, Parkway.
         */

        'Ave|Blvd|Mt|Rd|Bldgs?|Nat|Natl|Rt|Rte|Co|Pk|Sq|Dr|Pt|St|' +
        'Ft|Pen|Terr|Hwy|Fwy|Pkwy|' +

        /*
         * American state abbreviations:
         *
         * Alabama, Arizona, Arkansas, California, *, Colorado, *,
         * Connecticut, Delaware, Florida, Georgia,Idaho, *, Illinois,
         * Indiana, Iowa, Kansas, *, Kentucky, *, Louisiana, Maine, Maryland,
         * Massachusetts, Michigan, Minnesota, Mississippi, Missouri, Montana,
         * Nebraska, *, Nevada, Mexico, Dakota, Oklahoma, *, Oregon,
         * Pennsylvania, *, *, Tennessee, Texas, Utah, Vermont, Virginia,
         * Washington, Wisconsin, *, Wyoming.
         */

        'Ala|Ariz|Ark|Cal|Calif|Col|Colo|Conn|Del|Fla|Ga|Ida|Id|Ill|Ind|' +
        'Ia|Kan|Kans|Ken|Ky|La|Me|Md|Mass|Mich|Minn|Miss|Mo|Mont|Neb|' +
        'Nebr|Nev|Mex|Dak|Okla|Ok|Ore|Penna|Penn|Pa|Tenn|Tex|Ut|Vt|Va|' +
        'Wash|Wis|Wisc|Wyo|' +

        /*
         * Canadian province abbreviations:
         *
         * Alberta, Manitoba, Ontario, Quebec, *, Saskatchewan,
         * Yukon Territory.
         */

        'Alta|Man|Ont|Qu\u00E9|Que|Sask|Yuk|' +

        /*
         * English county abbreviations:
         *
         * Bedfordshire, Berkshire, Buckinghamshire, Cambridgeshire,
         * Cheshire, Cornwall, Cumberland, Derbyshire, *, Devon, Dorset,
         * Durham, Gloucestershire, Hampshire, Herefordshire, *,
         * Hertfordshire, Huntingdonshire, Lancashire, Leicestershire,
         * Lincolnshire, Middlesex, *, *, Norfolk, Northamptonshire,
         * Northumberland, *, Nottinghamshire, Oxfordshire, Rutland,
         * Shropshire, Somerset, Staffordshire, *, Suffolk, Surrey,
         * Sussex, *, Warwickshire, *, *, Westmorland, Wiltshire,
         * Worcestershire, Yorkshire.
         */

        'Beds|Berks|Bucks|Cambs|Ches|Corn|Cumb|Derbys|Derbs|Dev|Dor|Dur|' +
        'Glos|Hants|Here|Heref|Herts|Hunts|Lancs|Leics|Lincs|Mx|Middx|Mddx|' +
        'Norf|Northants|Northumb|Northd|Notts|Oxon|Rut|Shrops|Salop|Som|' +
        'Staffs|Staf|Suff|Sy|Sx|Ssx|Warks|War|Warw|Westm|Wilts|Worcs|Yorks' +
    ')$'
);

/*
 * Match a blacklisted word which when followed by
 * an apostrophe depicts elision.
 */

var EXPRESSION_ELISION_ENGLISH_PREFIX = new RegExp(
    '^(' +
        /*
         * Includes:
         *
         * - o' > of;
         * - ol' > old.
         */

        'o|ol' +
    ')$'
);

/*
 * Match a blacklisted word which when preceded by
 * an apostrophe depicts elision.
 */

var EXPRESSION_ELISION_ENGLISH_AFFIX = new RegExp(
    '^(' +
        /*
         * Includes:
         *
         * - 'im > him;
         * - 'er > her;
         * - 'em > them.
         * - 'cause > because.
         */

        'im|er|em|cause|' +

        /*
         * Includes:
         *
         * - 'twas > it was;
         * - 'tis > it is;
         * - 'twere > it were.
         */

        'twas|tis|twere|' +

        /*
         * Matches groups of year, optionally followed
         * by an `s`.
         */

        '\\d\\ds?' +
    ')$'
);

/*
 * Match one apostrophe.
 */

var EXPRESSION_APOSTROPHE = /^['\u2019]$/;

/**
 * Merge a sentence into its next sentence,
 * when the sentence ends with a certain word.
 *
 * @param {NLCSTNode} child - Node.
 * @param {number} index - Position of `child` in `parent`.
 * @param {NLCSTParagraphNode} parent - Parent of `child`.
 * @return {number?}
 */
function mergeEnglishPrefixExceptions(child, index, parent) {
    var children = child.children;
    var prev;
    var node;
    var prevValue;
    var next;

    if (
        children &&
        children.length &&
        index !== parent.children.length - 1
    ) {
        prev = children[children.length - 2];
        node = children[children.length - 1];

        if (
            node &&
            prev &&
            prev.type === 'WordNode' &&
            nlcstToString(node) === '.'
        ) {
            prevValue = nlcstToString(prev);

            if (
                EXPRESSION_ABBREVIATION_ENGLISH_PREFIX_SENSITIVE.test(
                    prevValue
                ) ||
                EXPRESSION_ABBREVIATION_ENGLISH_PREFIX.test(
                    prevValue.toLowerCase()
                )
            ) {
                next = parent.children[index + 1];

                child.children = children.concat(next.children);

                /*
                 * Update position.
                 */

                if (child.position && next.position) {
                    child.position.end = next.position.end;
                }

                parent.children.splice(index + 1, 1);

                return index - 1;
            }
        }
    }
}

/**
 * Merge an apostrophe depicting elision into
 * its surrounding word.
 *
 * @param {NLCSTNode} child - Node.
 * @param {number} index - Position of `child` in `parent`.
 * @param {NLCSTSentenceNode} parent - Parent of `child`.
 */
function mergeEnglishElisionExceptions(child, index, parent) {
    var siblings;
    var length;
    var value;
    var node;
    var other;

    if (
        child.type !== 'PunctuationNode' &&
        child.type !== 'SymbolNode'
    ) {
        return;
    }

    siblings = parent.children;

    length = siblings.length;

    value = nlcstToString(child);

    /*
     * Match abbreviation of `with`, `w/`
     */

    if (value === '/') {
        node = siblings[index - 1];

        if (node && nlcstToString(node).toLowerCase() === 'w') {
            /*
             * Remove the slash from parent.
             */

            siblings.splice(index, 1);

            /*
             * Append the slash into the children of the
             * previous node.
             */

            node.children.push(child);

            /*
             * Update position.
             */

            if (node.position && child.position) {
                node.position.end = child.position.end;
            }
        }
    } else if (EXPRESSION_APOSTROPHE.test(value)) {
       /*
        * If two preceding (the first white space and the
        * second a word), and one following (white space)
        * nodes exist...
        */

        node = siblings[index - 1];

        if (
            index > 2 &&
            index < length - 1 &&
            node.type === 'WordNode' &&
            siblings[index - 2].type === 'WhiteSpaceNode' &&
            siblings[index + 1].type === 'WhiteSpaceNode' &&
            EXPRESSION_ELISION_ENGLISH_PREFIX.test(
                nlcstToString(node).toLowerCase()
            )
        ) {
            /*
             * Remove the apostrophe from parent.
             */

            siblings.splice(index, 1);

            /*
             * Append the apostrophe into the children of
             * node.
             */

            node.children.push(child);

            /*
             * Update position.
             */

            if (node.position && child.position) {
                node.position.end = child.position.end;
            }

            return;
        }

        /*
         * If a following word exists, and the preceding node
         * is not a word...
         */

        if (
            index !== length - 1 &&
            siblings[index + 1].type === 'WordNode' &&
            (
                index === 0 ||
                siblings[index - 1].type !== 'WordNode'
            )
        ) {
            node = siblings[index + 1];
            value = nlcstToString(node).toLowerCase();

            if (EXPRESSION_ELISION_ENGLISH_AFFIX.test(value)) {
                /*
                 * Remove the apostrophe from parent.
                 */

                siblings.splice(index, 1);

                /*
                 * Prepend the apostrophe into the children of
                 * node.
                 */

                node.children = [child].concat(node.children);

                /*
                 * Update position.
                 */

                if (node.position && child.position) {
                    node.position.start = child.position.start;
                }

            /*
             * If both preceded and followed by an apostrophe,
             * and the word is `n`...
             */
            } else if (
                value === 'n' &&
                index < length - 2 &&
                EXPRESSION_APOSTROPHE.test(
                    nlcstToString(siblings[index + 2])
                )
            ) {
                other = siblings[index + 2];

                /*
                 * Remove the apostrophe from parent.
                 */

                siblings.splice(index, 1);
                siblings.splice(index + 1, 1);

                /*
                 * Prepend the preceding apostrophe and append
                 * the into the following apostrophe into
                 * the children of node.
                 */

                node.children = [child].concat(node.children, other);

                /*
                 * Update position.
                 */

                if (node.position) {
                    /* istanbul ignore else */
                    if (child.position) {
                        node.position.start = child.position.start;
                    }

                    /* istanbul ignore else */
                    if (other.position) {
                        node.position.end = other.position.end;
                    }
                }
            }
        }
    }
}

/**
 * Transform English natural language into an NLCST-tree.
 *
 * @constructor {ParseEnglish}
 */
function ParseEnglish(file, options) {
    if (!(this instanceof ParseEnglish)) {
        return new ParseEnglish(file, options);
    }

    Parser.apply(this, arguments);
}

/*
 * Inherit from `ParseLatin`.
 */

var parserPrototype;

/**
 * Constructor to create a `ParseEnglish` prototype.
 */
function ParserPrototype () {}

ParserPrototype.prototype = Parser.prototype;

parserPrototype = new ParserPrototype();

ParseEnglish.prototype = parserPrototype;

/*
 * Add modifiers to `parser`.
 */

parserPrototype.tokenizeSentencePlugins =
    [visitChildren(mergeEnglishElisionExceptions)].concat(
        parserPrototype.tokenizeSentencePlugins
    );

parserPrototype.tokenizeParagraphPlugins =
    [modifyChildren(mergeEnglishPrefixExceptions)].concat(
        parserPrototype.tokenizeParagraphPlugins
    );

/*
 * Expose `ParseEnglish`.
 */

module.exports = ParseEnglish;

},{"nlcst-to-string":27,"parse-latin":32,"unist-util-modify-children":77,"unist-util-visit-children":78}],31:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer
 * @license MIT
 * @module parse-entities
 * @fileoverview Parse HTML character references: fast, spec-compliant,
 *   positional information.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var characterEntities = require('character-entities');
var legacy = require('character-entities-legacy');
var invalid = require('character-reference-invalid');

/*
 * Methods.
 */

var fromCharCode = String.fromCharCode;
var has = Object.prototype.hasOwnProperty;
var noop = Function.prototype;

/*
 * Reference types.
 */

var NAMED = 'named';
var HEXADECIMAL = 'hexadecimal';
var DECIMAL = 'decimal';

/*
 * Map of bases.
 */

var BASE = {};

BASE[HEXADECIMAL] = 16;
BASE[DECIMAL] = 10;

/*
 * Warning messages.
 */

var NUMERIC_REFERENCE = 'Numeric character references';
var NAMED_REFERENCE = 'Named character references';
var TERMINATED = ' must be terminated by a semicolon';
var VOID = ' cannot be empty';

var NAMED_NOT_TERMINATED = 1;
var NUMERIC_NOT_TERMINATED = 2;
var NAMED_EMPTY = 3;
var NUMERIC_EMPTY = 4;
var NAMED_UNKNOWN = 5;
var NUMERIC_DISALLOWED = 6;
var NUMERIC_PROHIBITED = 7;

var MESSAGES = {};

MESSAGES[NAMED_NOT_TERMINATED] = NAMED_REFERENCE + TERMINATED;
MESSAGES[NUMERIC_NOT_TERMINATED] = NUMERIC_REFERENCE + TERMINATED;
MESSAGES[NAMED_EMPTY] = NAMED_REFERENCE + VOID;
MESSAGES[NUMERIC_EMPTY] = NUMERIC_REFERENCE + VOID;
MESSAGES[NAMED_UNKNOWN] = NAMED_REFERENCE + ' must be known';
MESSAGES[NUMERIC_DISALLOWED] = NUMERIC_REFERENCE + ' cannot be disallowed';
MESSAGES[NUMERIC_PROHIBITED] = NUMERIC_REFERENCE + ' cannot be outside the ' +
    'permissible Unicode range';

/*
 * Characters.
 */

var REPLACEMENT = '\uFFFD';
var FORM_FEED = '\f';
var AMPERSAND = '&';
var OCTOTHORP = '#';
var SEMICOLON = ';';
var NEWLINE = '\n';
var X_LOWER = 'x';
var X_UPPER = 'X';
var SPACE = ' ';
var LESS_THAN = '<';
var EQUAL = '=';
var EMPTY = '';
var TAB = '\t';

/**
 * Get the character-code at the first indice in
 * `character`.
 *
 * @param {string} character - Value.
 * @return {number} - Character-code at the first indice
 *   in `character`.
 */
function charCode(character) {
    return character.charCodeAt(0);
}

/**
 * Check whether `character` is a decimal.
 *
 * @param {string} character - Value.
 * @return {boolean} - Whether `character` is a decimal.
 */
function isDecimal(character) {
    var code = charCode(character);

    return code >= 48 /* 0 */ && code <= 57 /* 9 */;
}

/**
 * Check whether `character` is a hexadecimal.
 *
 * @param {string} character - Value.
 * @return {boolean} - Whether `character` is a
 *   hexadecimal.
 */
function isHexadecimal(character) {
    var code = charCode(character);

    return (code >= 48 /* 0 */ && code <= 57 /* 9 */) ||
        (code >= 65 /* A */ && code <= 70 /* F */) ||
        (code >= 97 /* a */ && code <= 102 /* f */);
}

/**
 * Check whether `character` is an alphanumeric.
 *
 * @param {string} character - Value.
 * @return {boolean} - Whether `character` is an
 *   alphanumeric.
 */
function isAlphanumeric(character) {
    var code = charCode(character);

    return (code >= 48 /* 0 */ && code <= 57 /* 9 */) ||
        (code >= 65 /* A */ && code <= 90 /* Z */) ||
        (code >= 97 /* a */ && code <= 122 /* z */);
}

/**
 * Check whether `character` is outside the permissible
 * unicode range.
 *
 * @param {number} characterCode - Value.
 * @return {boolean} - Whether `character` is an
 *   outside the permissible unicode range.
 */
function isProhibited(characterCode) {
    return (characterCode >= 0xD800 && characterCode <= 0xDFFF) ||
        (characterCode > 0x10FFFF);
}

/**
 * Check whether `character` is disallowed.
 *
 * @param {number} characterCode - Value.
 * @return {boolean} - Whether `character` is disallowed.
 */
function isWarning(characterCode) {
    return (characterCode >= 0x0001 && characterCode <= 0x0008) ||
        (characterCode >= 0x000D && characterCode <= 0x001F) ||
        (characterCode >= 0x007F && characterCode <= 0x009F) ||
        (characterCode >= 0xFDD0 && characterCode <= 0xFDEF) ||
        characterCode === 0x000B ||
        characterCode === 0xFFFE ||
        characterCode === 0xFFFF ||
        characterCode === 0x1FFFE ||
        characterCode === 0x1FFFF ||
        characterCode === 0x2FFFE ||
        characterCode === 0x2FFFF ||
        characterCode === 0x3FFFE ||
        characterCode === 0x3FFFF ||
        characterCode === 0x4FFFE ||
        characterCode === 0x4FFFF ||
        characterCode === 0x5FFFE ||
        characterCode === 0x5FFFF ||
        characterCode === 0x6FFFE ||
        characterCode === 0x6FFFF ||
        characterCode === 0x7FFFE ||
        characterCode === 0x7FFFF ||
        characterCode === 0x8FFFE ||
        characterCode === 0x8FFFF ||
        characterCode === 0x9FFFE ||
        characterCode === 0x9FFFF ||
        characterCode === 0xAFFFE ||
        characterCode === 0xAFFFF ||
        characterCode === 0xBFFFE ||
        characterCode === 0xBFFFF ||
        characterCode === 0xCFFFE ||
        characterCode === 0xCFFFF ||
        characterCode === 0xDFFFE ||
        characterCode === 0xDFFFF ||
        characterCode === 0xEFFFE ||
        characterCode === 0xEFFFF ||
        characterCode === 0xFFFFE ||
        characterCode === 0xFFFFF ||
        characterCode === 0x10FFFE ||
        characterCode === 0x10FFFF;
}

/*
 * Map of types to tests. Each type of character reference
 * accepts different characters. This test is used to
 * detect whether a reference has ended (as the semicolon
 * is not strictly needed).
 */

var TESTS = {};

TESTS[NAMED] = isAlphanumeric;
TESTS[DECIMAL] = isDecimal;
TESTS[HEXADECIMAL] = isHexadecimal;

/**
 * Parse entities.
 *
 * @param {string} value - Value to tokenise.
 * @param {Object?} [settings] - Configuration.
 */
function parse(value, settings) {
    var additional = settings.additional;
    var handleText = settings.text;
    var handleReference = settings.reference;
    var handleWarning = settings.warning;
    var textContext = settings.textContext;
    var referenceContext = settings.referenceContext;
    var warningContext = settings.warningContext;
    var pos = settings.position;
    var indent = settings.indent || [];
    var length = value.length;
    var index = 0;
    var lines = -1;
    var column = pos.column || 1;
    var line = pos.line || 1;
    var queue = EMPTY;
    var result = [];
    var entityCharacters;
    var terminated;
    var characters;
    var character;
    var reference;
    var following;
    var warning;
    var reason;
    var output;
    var entity;
    var begin;
    var start;
    var type;
    var test;
    var prev;
    var next;
    var diff;
    var end;

    /**
     * Get current position.
     *
     * @return {Object} - Positional information of a
     *   single point.
     */
    function now() {
        return {
            'line': line,
            'column': column,
            'offset': index + (pos.offset || 0)
        };
    }

    /**
     * “Throw” a parse-error: a warning.
     *
     * @param {number} code - Identifier of reason for
     *   failing.
     * @param {number} offset - Offset in characters from
     *   the current position point at which the
     *   parse-error ocurred, cannot point past newlines.
     */
    function parseError(code, offset) {
        var position = now();

        position.column += offset;
        position.offset += offset;

        handleWarning.call(warningContext, MESSAGES[code], position, code);
    }

    /**
     * Get character at position.
     *
     * @param {number} position - Indice of character in `value`.
     * @return {string} - Character at `position` in
     *   `value`.
     */
    function at(position) {
        return value.charAt(position);
    }

    /**
     * Flush `queue` (normal text). Macro invoked before
     * each entity and at the end of `value`.
     *
     * Does nothing when `queue` is empty.
     */
    function flush() {
        if (queue) {
            result.push(queue);

            if (handleText) {
                handleText.call(textContext, queue, {
                    'start': prev,
                    'end': now()
                });
            }

            queue = EMPTY;
        }
    }

    /*
     * Cache the current point.
     */

    prev = now();

    /*
     * Wrap `handleWarning`.
     */

    warning = handleWarning ? parseError : noop;

    /*
     * Ensure the algorithm walks over the first character
     * and the end (inclusive).
     */

    index--;
    length++;

    while (++index < length) {
        /*
         * If the previous character was a newline.
         */

        if (character === NEWLINE) {
            column = indent[lines] || 1;
        }

        character = at(index);

        /*
         * Handle anything other than an ampersand,
         * including newlines and EOF.
         */

        if (character !== AMPERSAND) {
            if (character === NEWLINE) {
                line++;
                lines++;
                column = 0;
            }

            if (character) {
                queue += character;
                column++;
            } else {
                flush();
            }
        } else {
            following = at(index + 1);

            /*
             * The behaviour depends on the identity of the next character.
             */

            if (
                following === TAB ||
                following === NEWLINE ||
                following === FORM_FEED ||
                following === SPACE ||
                following === LESS_THAN ||
                following === AMPERSAND ||
                following === EMPTY ||
                (additional && following === additional)
            ) {
                /*
                 * Not a character reference. No characters
                 * are consumed, and nothing is returned.
                 * This is not an error, either.
                 */

                queue += character;
                column++;

                continue;
            }

            start = begin = end = index + 1;

            /*
             * Numerical entity.
             */

            if (following !== OCTOTHORP) {
                type = NAMED;
            } else {
                end = ++begin;

                /*
                 * The behaviour further depends on the
                 * character after the U+0023 NUMBER SIGN.
                 */

                following = at(end);

                if (following === X_LOWER || following === X_UPPER) {
                    /*
                     * ASCII hex digits.
                     */

                    type = HEXADECIMAL;
                    end = ++begin;
                } else {
                    /*
                     * ASCII digits.
                     */

                    type = DECIMAL;
                }
            }

            entityCharacters = entity = characters = EMPTY;
            test = TESTS[type];
            end--;

            while (++end < length) {
                following = at(end);

                if (!test(following)) {
                    break;
                }

                characters += following;

                /*
                 * Check if we can match a legacy named
                 * reference.  If so, we cache that as the
                 * last viable named reference.  This
                 * ensures we do not need to walk backwards
                 * later.
                 */

                if (
                    type === NAMED &&
                    has.call(legacy, characters)
                ) {
                    entityCharacters = characters;
                    entity = legacy[characters];
                }
            }

            terminated = at(end) === SEMICOLON;

            if (terminated) {
                end++;

                if (
                    type === NAMED &&
                    has.call(characterEntities, characters)
                ) {
                    entityCharacters = characters;
                    entity = characterEntities[characters];
                }
            }

            diff = 1 + end - start;

            if (!characters) {
                /*
                 * An empty (possible) entity is valid, unless
                 * its numeric (thus an ampersand followed by
                 * an octothorp).
                 */

                if (type !== NAMED) {
                    warning(NUMERIC_EMPTY, diff);
                }
            } else if (type === NAMED) {
                /*
                 * An ampersand followed by anything
                 * unknown, and not terminated, is invalid.
                 */

                if (terminated && !entity) {
                    warning(NAMED_UNKNOWN, 1);
                } else {
                    /*
                     * If theres something after an entity
                     * name which is not known, cap the
                     * reference.
                     */

                    if (entityCharacters !== characters) {
                        end = begin + entityCharacters.length;
                        diff = 1 + end - begin;
                        terminated = false;
                    }

                    /*
                     * If the reference is not terminated,
                     * warn.
                     */

                    if (!terminated) {
                        reason = entityCharacters ?
                            NAMED_NOT_TERMINATED :
                            NAMED_EMPTY;

                        if (!settings.attribute) {
                            warning(reason, diff);
                        } else {
                            following = at(end);

                            if (following === EQUAL) {
                                warning(reason, diff);
                                entity = null;
                            } else if (isAlphanumeric(following)) {
                                entity = null;
                            } else {
                                warning(reason, diff);
                            }
                        }
                    }
                }

                reference = entity;
            } else {
                if (!terminated) {
                    /*
                     * All non-terminated numeric entities are
                     * not rendered, and trigger a warning.
                     */

                    warning(NUMERIC_NOT_TERMINATED, diff);
                }

                /*
                 * When terminated and number, parse as
                 * either hexadecimal or decimal.
                 */

                reference = parseInt(characters, BASE[type]);

                /*
                 * Trigger a warning when the parsed number
                 * is prohibited, and replace with
                 * replacement character.
                 */

                if (isProhibited(reference)) {
                    warning(NUMERIC_PROHIBITED, diff);

                    reference = REPLACEMENT;
                } else if (reference in invalid) {
                    /*
                     * Trigger a warning when the parsed number
                     * is disallowed, and replace by an
                     * alternative.
                     */

                    warning(NUMERIC_DISALLOWED, diff);

                    reference = invalid[reference];
                } else {
                    /*
                     * Parse the number.
                     */

                    output = EMPTY;

                    /*
                     * Trigger a warning when the parsed
                     * number should not be used.
                     */

                    if (isWarning(reference)) {
                        warning(NUMERIC_DISALLOWED, diff);
                    }

                    /*
                     * Stringify the number.
                     */

                    if (reference > 0xFFFF) {
                        reference -= 0x10000;
                        output += fromCharCode(
                            reference >>> 10 & 0x3FF | 0xD800
                        );

                        reference = 0xDC00 | reference & 0x3FF;
                    }

                    reference = output + fromCharCode(reference);
                }
            }

            /*
             * If we could not find a reference, queue the
             * checked characters (as normal characters),
             * and move the pointer to their end. This is
             * possible because we can be certain neither
             * newlines nor ampersands are included.
             */

            if (!reference) {
                characters = value.slice(start - 1, end);
                queue += characters;
                column += characters.length;
                index = end - 1;
            } else {
                /*
                 * Found it! First eat the queued
                 * characters as normal text, then eat
                 * an entity.
                 */

                flush();

                prev = now();
                index = end - 1;
                column += end - start + 1;
                result.push(reference);
                next = now();
                next.offset++;

                if (handleReference) {
                    handleReference.call(referenceContext, reference, {
                        'start': prev,
                        'end': next
                    }, value.slice(start - 1, end));
                }

                prev = next;
            }
        }
    }

    /*
     * Return the reduced nodes, and any possible warnings.
     */

    return result.join(EMPTY);
}

var defaults = {
    'warning': null,
    'reference': null,
    'text': null,
    'warningContext': null,
    'referenceContext': null,
    'textContext': null,
    'position': {},
    'additional': null,
    'attribute': false
};

/**
 * Wrap to ensure clean parameters are given to `parse`.
 *
 * @param {string} value - Value with entities.
 * @param {Object?} [options] - Configuration.
 */
function wrapper(value, options) {
    var settings = {};
    var key;

    if (!options) {
        options = {};
    }

    for (key in defaults) {
        settings[key] = options[key] || defaults[key];
    }

    if (settings.position.indent || settings.position.start) {
        settings.indent = settings.position.indent || [];
        settings.position = settings.position.start;
    }

    return parse(value, settings);
}

/*
 * Expose.
 */

module.exports = wrapper;

},{"character-entities":13,"character-entities-legacy":11,"character-reference-invalid":15}],32:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer
 * @license MIT
 * @module parse-latin
 * @fileoverview Latin-script (natural language) parser.
 */

'use strict';

/* eslint-env commonjs */

module.exports = require('./lib/parse-latin');

},{"./lib/parse-latin":34}],33:[function(require,module,exports){
/* This module is generated by `script/build-expressions.js` */
'use strict'
/* eslint-env commonjs */
module.exports = {
    'affixSymbol': /^([\)\]\}\u0F3B\u0F3D\u169C\u2046\u207E\u208E\u2309\u230B\u232A\u2769\u276B\u276D\u276F\u2771\u2773\u2775\u27C6\u27E7\u27E9\u27EB\u27ED\u27EF\u2984\u2986\u2988\u298A\u298C\u298E\u2990\u2992\u2994\u2996\u2998\u29D9\u29DB\u29FD\u2E23\u2E25\u2E27\u2E29\u3009\u300B\u300D\u300F\u3011\u3015\u3017\u3019\u301B\u301E\u301F\uFD3E\uFE18\uFE36\uFE38\uFE3A\uFE3C\uFE3E\uFE40\uFE42\uFE44\uFE48\uFE5A\uFE5C\uFE5E\uFF09\uFF3D\uFF5D\uFF60\uFF63]|["'\xBB\u2019\u201D\u203A\u2E03\u2E05\u2E0A\u2E0D\u2E1D\u2E21]|[!\.\?\u2026\u203D])\1*$/,
    'newLine': /^(\r?\n|\r)+$/,
    'newLineMulti': /^(\r?\n|\r){2,}$/,
    'terminalMarker': /^((?:[!\.\?\u2026\u203D])+)$/,
    'wordSymbolInner': /^((?:[&'\-\.:=\?@\xAD\xB7\u2010\u2011\u2019\u2027])|(?:[\/_])+)$/,
    'punctuation': /^(?:[!"'-\),-\/:;\?\[-\]_\{\}\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061E\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u0AF0\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166D\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u201F\u2022-\u2027\u2032-\u203A\u203C-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E42\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD801\uDD6F|\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC9\uDDCD\uDDDB\uDDDD-\uDDDF\uDE38-\uDE3D\uDEA9]|\uD805[\uDCC6\uDDC1-\uDDD7\uDE41-\uDE43\uDF3C-\uDF3E]|\uD809[\uDC70-\uDC74]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]|\uD82F\uDC9F|\uD836[\uDE87-\uDE8B])+$/,
    'numerical': /^(?:[0-9\xB2\xB3\xB9\xBC-\xBE\u0660-\u0669\u06F0-\u06F9\u07C0-\u07C9\u0966-\u096F\u09E6-\u09EF\u09F4-\u09F9\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0B72-\u0B77\u0BE6-\u0BF2\u0C66-\u0C6F\u0C78-\u0C7E\u0CE6-\u0CEF\u0D66-\u0D75\u0DE6-\u0DEF\u0E50-\u0E59\u0ED0-\u0ED9\u0F20-\u0F33\u1040-\u1049\u1090-\u1099\u1369-\u137C\u16EE-\u16F0\u17E0-\u17E9\u17F0-\u17F9\u1810-\u1819\u1946-\u194F\u19D0-\u19DA\u1A80-\u1A89\u1A90-\u1A99\u1B50-\u1B59\u1BB0-\u1BB9\u1C40-\u1C49\u1C50-\u1C59\u2070\u2074-\u2079\u2080-\u2089\u2150-\u2182\u2185-\u2189\u2460-\u249B\u24EA-\u24FF\u2776-\u2793\u2CFD\u3007\u3021-\u3029\u3038-\u303A\u3192-\u3195\u3220-\u3229\u3248-\u324F\u3251-\u325F\u3280-\u3289\u32B1-\u32BF\uA620-\uA629\uA6E6-\uA6EF\uA830-\uA835\uA8D0-\uA8D9\uA900-\uA909\uA9D0-\uA9D9\uA9F0-\uA9F9\uAA50-\uAA59\uABF0-\uABF9\uFF10-\uFF19]|\uD800[\uDD07-\uDD33\uDD40-\uDD78\uDD8A\uDD8B\uDEE1-\uDEFB\uDF20-\uDF23\uDF41\uDF4A\uDFD1-\uDFD5]|\uD801[\uDCA0-\uDCA9]|\uD802[\uDC58-\uDC5F\uDC79-\uDC7F\uDCA7-\uDCAF\uDCFB-\uDCFF\uDD16-\uDD1B\uDDBC\uDDBD\uDDC0-\uDDCF\uDDD2-\uDDFF\uDE40-\uDE47\uDE7D\uDE7E\uDE9D-\uDE9F\uDEEB-\uDEEF\uDF58-\uDF5F\uDF78-\uDF7F\uDFA9-\uDFAF]|\uD803[\uDCFA-\uDCFF\uDE60-\uDE7E]|\uD804[\uDC52-\uDC6F\uDCF0-\uDCF9\uDD36-\uDD3F\uDDD0-\uDDD9\uDDE1-\uDDF4\uDEF0-\uDEF9]|\uD805[\uDCD0-\uDCD9\uDE50-\uDE59\uDEC0-\uDEC9\uDF30-\uDF3B]|\uD806[\uDCE0-\uDCF2]|\uD809[\uDC00-\uDC6E]|\uD81A[\uDE60-\uDE69\uDF50-\uDF59\uDF5B-\uDF61]|\uD834[\uDF60-\uDF71]|\uD835[\uDFCE-\uDFFF]|\uD83A[\uDCC7-\uDCCF]|\uD83C[\uDD00-\uDD0C])+$/,
    'lowerInitial': /^(?:[a-z\xB5\xDF-\xF6\xF8-\xFF\u0101\u0103\u0105\u0107\u0109\u010B\u010D\u010F\u0111\u0113\u0115\u0117\u0119\u011B\u011D\u011F\u0121\u0123\u0125\u0127\u0129\u012B\u012D\u012F\u0131\u0133\u0135\u0137\u0138\u013A\u013C\u013E\u0140\u0142\u0144\u0146\u0148\u0149\u014B\u014D\u014F\u0151\u0153\u0155\u0157\u0159\u015B\u015D\u015F\u0161\u0163\u0165\u0167\u0169\u016B\u016D\u016F\u0171\u0173\u0175\u0177\u017A\u017C\u017E-\u0180\u0183\u0185\u0188\u018C\u018D\u0192\u0195\u0199-\u019B\u019E\u01A1\u01A3\u01A5\u01A8\u01AA\u01AB\u01AD\u01B0\u01B4\u01B6\u01B9\u01BA\u01BD-\u01BF\u01C6\u01C9\u01CC\u01CE\u01D0\u01D2\u01D4\u01D6\u01D8\u01DA\u01DC\u01DD\u01DF\u01E1\u01E3\u01E5\u01E7\u01E9\u01EB\u01ED\u01EF\u01F0\u01F3\u01F5\u01F9\u01FB\u01FD\u01FF\u0201\u0203\u0205\u0207\u0209\u020B\u020D\u020F\u0211\u0213\u0215\u0217\u0219\u021B\u021D\u021F\u0221\u0223\u0225\u0227\u0229\u022B\u022D\u022F\u0231\u0233-\u0239\u023C\u023F\u0240\u0242\u0247\u0249\u024B\u024D\u024F-\u0293\u0295-\u02AF\u0371\u0373\u0377\u037B-\u037D\u0390\u03AC-\u03CE\u03D0\u03D1\u03D5-\u03D7\u03D9\u03DB\u03DD\u03DF\u03E1\u03E3\u03E5\u03E7\u03E9\u03EB\u03ED\u03EF-\u03F3\u03F5\u03F8\u03FB\u03FC\u0430-\u045F\u0461\u0463\u0465\u0467\u0469\u046B\u046D\u046F\u0471\u0473\u0475\u0477\u0479\u047B\u047D\u047F\u0481\u048B\u048D\u048F\u0491\u0493\u0495\u0497\u0499\u049B\u049D\u049F\u04A1\u04A3\u04A5\u04A7\u04A9\u04AB\u04AD\u04AF\u04B1\u04B3\u04B5\u04B7\u04B9\u04BB\u04BD\u04BF\u04C2\u04C4\u04C6\u04C8\u04CA\u04CC\u04CE\u04CF\u04D1\u04D3\u04D5\u04D7\u04D9\u04DB\u04DD\u04DF\u04E1\u04E3\u04E5\u04E7\u04E9\u04EB\u04ED\u04EF\u04F1\u04F3\u04F5\u04F7\u04F9\u04FB\u04FD\u04FF\u0501\u0503\u0505\u0507\u0509\u050B\u050D\u050F\u0511\u0513\u0515\u0517\u0519\u051B\u051D\u051F\u0521\u0523\u0525\u0527\u0529\u052B\u052D\u052F\u0561-\u0587\u13F8-\u13FD\u1D00-\u1D2B\u1D6B-\u1D77\u1D79-\u1D9A\u1E01\u1E03\u1E05\u1E07\u1E09\u1E0B\u1E0D\u1E0F\u1E11\u1E13\u1E15\u1E17\u1E19\u1E1B\u1E1D\u1E1F\u1E21\u1E23\u1E25\u1E27\u1E29\u1E2B\u1E2D\u1E2F\u1E31\u1E33\u1E35\u1E37\u1E39\u1E3B\u1E3D\u1E3F\u1E41\u1E43\u1E45\u1E47\u1E49\u1E4B\u1E4D\u1E4F\u1E51\u1E53\u1E55\u1E57\u1E59\u1E5B\u1E5D\u1E5F\u1E61\u1E63\u1E65\u1E67\u1E69\u1E6B\u1E6D\u1E6F\u1E71\u1E73\u1E75\u1E77\u1E79\u1E7B\u1E7D\u1E7F\u1E81\u1E83\u1E85\u1E87\u1E89\u1E8B\u1E8D\u1E8F\u1E91\u1E93\u1E95-\u1E9D\u1E9F\u1EA1\u1EA3\u1EA5\u1EA7\u1EA9\u1EAB\u1EAD\u1EAF\u1EB1\u1EB3\u1EB5\u1EB7\u1EB9\u1EBB\u1EBD\u1EBF\u1EC1\u1EC3\u1EC5\u1EC7\u1EC9\u1ECB\u1ECD\u1ECF\u1ED1\u1ED3\u1ED5\u1ED7\u1ED9\u1EDB\u1EDD\u1EDF\u1EE1\u1EE3\u1EE5\u1EE7\u1EE9\u1EEB\u1EED\u1EEF\u1EF1\u1EF3\u1EF5\u1EF7\u1EF9\u1EFB\u1EFD\u1EFF-\u1F07\u1F10-\u1F15\u1F20-\u1F27\u1F30-\u1F37\u1F40-\u1F45\u1F50-\u1F57\u1F60-\u1F67\u1F70-\u1F7D\u1F80-\u1F87\u1F90-\u1F97\u1FA0-\u1FA7\u1FB0-\u1FB4\u1FB6\u1FB7\u1FBE\u1FC2-\u1FC4\u1FC6\u1FC7\u1FD0-\u1FD3\u1FD6\u1FD7\u1FE0-\u1FE7\u1FF2-\u1FF4\u1FF6\u1FF7\u210A\u210E\u210F\u2113\u212F\u2134\u2139\u213C\u213D\u2146-\u2149\u214E\u2184\u2C30-\u2C5E\u2C61\u2C65\u2C66\u2C68\u2C6A\u2C6C\u2C71\u2C73\u2C74\u2C76-\u2C7B\u2C81\u2C83\u2C85\u2C87\u2C89\u2C8B\u2C8D\u2C8F\u2C91\u2C93\u2C95\u2C97\u2C99\u2C9B\u2C9D\u2C9F\u2CA1\u2CA3\u2CA5\u2CA7\u2CA9\u2CAB\u2CAD\u2CAF\u2CB1\u2CB3\u2CB5\u2CB7\u2CB9\u2CBB\u2CBD\u2CBF\u2CC1\u2CC3\u2CC5\u2CC7\u2CC9\u2CCB\u2CCD\u2CCF\u2CD1\u2CD3\u2CD5\u2CD7\u2CD9\u2CDB\u2CDD\u2CDF\u2CE1\u2CE3\u2CE4\u2CEC\u2CEE\u2CF3\u2D00-\u2D25\u2D27\u2D2D\uA641\uA643\uA645\uA647\uA649\uA64B\uA64D\uA64F\uA651\uA653\uA655\uA657\uA659\uA65B\uA65D\uA65F\uA661\uA663\uA665\uA667\uA669\uA66B\uA66D\uA681\uA683\uA685\uA687\uA689\uA68B\uA68D\uA68F\uA691\uA693\uA695\uA697\uA699\uA69B\uA723\uA725\uA727\uA729\uA72B\uA72D\uA72F-\uA731\uA733\uA735\uA737\uA739\uA73B\uA73D\uA73F\uA741\uA743\uA745\uA747\uA749\uA74B\uA74D\uA74F\uA751\uA753\uA755\uA757\uA759\uA75B\uA75D\uA75F\uA761\uA763\uA765\uA767\uA769\uA76B\uA76D\uA76F\uA771-\uA778\uA77A\uA77C\uA77F\uA781\uA783\uA785\uA787\uA78C\uA78E\uA791\uA793-\uA795\uA797\uA799\uA79B\uA79D\uA79F\uA7A1\uA7A3\uA7A5\uA7A7\uA7A9\uA7B5\uA7B7\uA7FA\uAB30-\uAB5A\uAB60-\uAB65\uAB70-\uABBF\uFB00-\uFB06\uFB13-\uFB17\uFF41-\uFF5A]|\uD801[\uDC28-\uDC4F]|\uD803[\uDCC0-\uDCF2]|\uD806[\uDCC0-\uDCDF]|\uD835[\uDC1A-\uDC33\uDC4E-\uDC54\uDC56-\uDC67\uDC82-\uDC9B\uDCB6-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDCCF\uDCEA-\uDD03\uDD1E-\uDD37\uDD52-\uDD6B\uDD86-\uDD9F\uDDBA-\uDDD3\uDDEE-\uDE07\uDE22-\uDE3B\uDE56-\uDE6F\uDE8A-\uDEA5\uDEC2-\uDEDA\uDEDC-\uDEE1\uDEFC-\uDF14\uDF16-\uDF1B\uDF36-\uDF4E\uDF50-\uDF55\uDF70-\uDF88\uDF8A-\uDF8F\uDFAA-\uDFC2\uDFC4-\uDFC9\uDFCB])/,
    'token': /(?:[0-9A-Za-z\xAA\xB2\xB3\xB5\xB9\xBA\xBC-\xBE\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u052F\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u08A0-\u08B4\u08E3-\u0963\u0966-\u096F\u0971-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u09F4-\u09F9\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0AF9\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71-\u0B77\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BF2\u0C00-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58-\u0C5A\u0C60-\u0C63\u0C66-\u0C6F\u0C78-\u0C7E\u0C81-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D01-\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D57\u0D5F-\u0D63\u0D66-\u0D75\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F33\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1369-\u137C\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u17F0-\u17F9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19DA\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1AB0-\u1ABE\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1CD0-\u1CD2\u1CD4-\u1CF6\u1CF8\u1CF9\u1D00-\u1DF5\u1DFC-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2070\u2071\u2074-\u2079\u207F-\u2089\u2090-\u209C\u20D0-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2150-\u2189\u2460-\u249B\u24EA-\u24FF\u2776-\u2793\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2CFD\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u2E2F\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099\u309A\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u3192-\u3195\u31A0-\u31BA\u31F0-\u31FF\u3220-\u3229\u3248-\u324F\u3251-\u325F\u3280-\u3289\u32B1-\u32BF\u3400-\u4DB5\u4E00-\u9FD5\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA672\uA674-\uA67D\uA67F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AD\uA7B0-\uA7B7\uA7F7-\uA827\uA830-\uA835\uA840-\uA873\uA880-\uA8C4\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA8FD\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uA9E0-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE2F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD07-\uDD33\uDD40-\uDD78\uDD8A\uDD8B\uDDFD\uDE80-\uDE9C\uDEA0-\uDED0\uDEE0-\uDEFB\uDF00-\uDF23\uDF30-\uDF4A\uDF50-\uDF7A\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDCA0-\uDCA9\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC58-\uDC76\uDC79-\uDC9E\uDCA7-\uDCAF\uDCE0-\uDCF2\uDCF4\uDCF5\uDCFB-\uDD1B\uDD20-\uDD39\uDD80-\uDDB7\uDDBC-\uDDCF\uDDD2-\uDE03\uDE05\uDE06\uDE0C-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE38-\uDE3A\uDE3F-\uDE47\uDE60-\uDE7E\uDE80-\uDE9F\uDEC0-\uDEC7\uDEC9-\uDEE6\uDEEB-\uDEEF\uDF00-\uDF35\uDF40-\uDF55\uDF58-\uDF72\uDF78-\uDF91\uDFA9-\uDFAF]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2\uDCFA-\uDCFF\uDE60-\uDE7E]|\uD804[\uDC00-\uDC46\uDC52-\uDC6F\uDC7F-\uDCBA\uDCD0-\uDCE8\uDCF0-\uDCF9\uDD00-\uDD34\uDD36-\uDD3F\uDD50-\uDD73\uDD76\uDD80-\uDDC4\uDDCA-\uDDCC\uDDD0-\uDDDA\uDDDC\uDDE1-\uDDF4\uDE00-\uDE11\uDE13-\uDE37\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEEA\uDEF0-\uDEF9\uDF00-\uDF03\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3C-\uDF44\uDF47\uDF48\uDF4B-\uDF4D\uDF50\uDF57\uDF5D-\uDF63\uDF66-\uDF6C\uDF70-\uDF74]|\uD805[\uDC80-\uDCC5\uDCC7\uDCD0-\uDCD9\uDD80-\uDDB5\uDDB8-\uDDC0\uDDD8-\uDDDD\uDE00-\uDE40\uDE44\uDE50-\uDE59\uDE80-\uDEB7\uDEC0-\uDEC9\uDF00-\uDF19\uDF1D-\uDF2B\uDF30-\uDF3B]|\uD806[\uDCA0-\uDCF2\uDCFF\uDEC0-\uDEF8]|\uD808[\uDC00-\uDF99]|\uD809[\uDC00-\uDC6E\uDC80-\uDD43]|[\uD80C\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD811[\uDC00-\uDE46]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDE60-\uDE69\uDED0-\uDEED\uDEF0-\uDEF4\uDF00-\uDF36\uDF40-\uDF43\uDF50-\uDF59\uDF5B-\uDF61\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50-\uDF7E\uDF8F-\uDF9F]|\uD82C[\uDC00\uDC01]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99\uDC9D\uDC9E]|\uD834[\uDD65-\uDD69\uDD6D-\uDD72\uDD7B-\uDD82\uDD85-\uDD8B\uDDAA-\uDDAD\uDE42-\uDE44\uDF60-\uDF71]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB\uDFCE-\uDFFF]|\uD836[\uDE00-\uDE36\uDE3B-\uDE6C\uDE75\uDE84\uDE9B-\uDE9F\uDEA1-\uDEAF]|\uD83A[\uDC00-\uDCC4\uDCC7-\uDCD6]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD83C[\uDD00-\uDD0C]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1]|\uD87E[\uDC00-\uDE1D]|\uDB40[\uDD00-\uDDEF])+|(?:[\t-\r \x85\xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000])+|(?:[\uD800-\uDFFF])+|([\s\S])\1*/g,
    'word': /^(?:[0-9A-Za-z\xAA\xB2\xB3\xB5\xB9\xBA\xBC-\xBE\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u052F\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u08A0-\u08B4\u08E3-\u0963\u0966-\u096F\u0971-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u09F4-\u09F9\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0AF9\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71-\u0B77\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BF2\u0C00-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58-\u0C5A\u0C60-\u0C63\u0C66-\u0C6F\u0C78-\u0C7E\u0C81-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D01-\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D57\u0D5F-\u0D63\u0D66-\u0D75\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F33\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1369-\u137C\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u17F0-\u17F9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19DA\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1AB0-\u1ABE\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1CD0-\u1CD2\u1CD4-\u1CF6\u1CF8\u1CF9\u1D00-\u1DF5\u1DFC-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2070\u2071\u2074-\u2079\u207F-\u2089\u2090-\u209C\u20D0-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2150-\u2189\u2460-\u249B\u24EA-\u24FF\u2776-\u2793\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2CFD\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u2E2F\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099\u309A\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u3192-\u3195\u31A0-\u31BA\u31F0-\u31FF\u3220-\u3229\u3248-\u324F\u3251-\u325F\u3280-\u3289\u32B1-\u32BF\u3400-\u4DB5\u4E00-\u9FD5\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA672\uA674-\uA67D\uA67F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AD\uA7B0-\uA7B7\uA7F7-\uA827\uA830-\uA835\uA840-\uA873\uA880-\uA8C4\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA8FD\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uA9E0-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE2F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD07-\uDD33\uDD40-\uDD78\uDD8A\uDD8B\uDDFD\uDE80-\uDE9C\uDEA0-\uDED0\uDEE0-\uDEFB\uDF00-\uDF23\uDF30-\uDF4A\uDF50-\uDF7A\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDCA0-\uDCA9\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC58-\uDC76\uDC79-\uDC9E\uDCA7-\uDCAF\uDCE0-\uDCF2\uDCF4\uDCF5\uDCFB-\uDD1B\uDD20-\uDD39\uDD80-\uDDB7\uDDBC-\uDDCF\uDDD2-\uDE03\uDE05\uDE06\uDE0C-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE38-\uDE3A\uDE3F-\uDE47\uDE60-\uDE7E\uDE80-\uDE9F\uDEC0-\uDEC7\uDEC9-\uDEE6\uDEEB-\uDEEF\uDF00-\uDF35\uDF40-\uDF55\uDF58-\uDF72\uDF78-\uDF91\uDFA9-\uDFAF]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2\uDCFA-\uDCFF\uDE60-\uDE7E]|\uD804[\uDC00-\uDC46\uDC52-\uDC6F\uDC7F-\uDCBA\uDCD0-\uDCE8\uDCF0-\uDCF9\uDD00-\uDD34\uDD36-\uDD3F\uDD50-\uDD73\uDD76\uDD80-\uDDC4\uDDCA-\uDDCC\uDDD0-\uDDDA\uDDDC\uDDE1-\uDDF4\uDE00-\uDE11\uDE13-\uDE37\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEEA\uDEF0-\uDEF9\uDF00-\uDF03\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3C-\uDF44\uDF47\uDF48\uDF4B-\uDF4D\uDF50\uDF57\uDF5D-\uDF63\uDF66-\uDF6C\uDF70-\uDF74]|\uD805[\uDC80-\uDCC5\uDCC7\uDCD0-\uDCD9\uDD80-\uDDB5\uDDB8-\uDDC0\uDDD8-\uDDDD\uDE00-\uDE40\uDE44\uDE50-\uDE59\uDE80-\uDEB7\uDEC0-\uDEC9\uDF00-\uDF19\uDF1D-\uDF2B\uDF30-\uDF3B]|\uD806[\uDCA0-\uDCF2\uDCFF\uDEC0-\uDEF8]|\uD808[\uDC00-\uDF99]|\uD809[\uDC00-\uDC6E\uDC80-\uDD43]|[\uD80C\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD811[\uDC00-\uDE46]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDE60-\uDE69\uDED0-\uDEED\uDEF0-\uDEF4\uDF00-\uDF36\uDF40-\uDF43\uDF50-\uDF59\uDF5B-\uDF61\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50-\uDF7E\uDF8F-\uDF9F]|\uD82C[\uDC00\uDC01]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99\uDC9D\uDC9E]|\uD834[\uDD65-\uDD69\uDD6D-\uDD72\uDD7B-\uDD82\uDD85-\uDD8B\uDDAA-\uDDAD\uDE42-\uDE44\uDF60-\uDF71]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB\uDFCE-\uDFFF]|\uD836[\uDE00-\uDE36\uDE3B-\uDE6C\uDE75\uDE84\uDE9B-\uDE9F\uDEA1-\uDEAF]|\uD83A[\uDC00-\uDCC4\uDCC7-\uDCD6]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD83C[\uDD00-\uDD0C]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1]|\uD87E[\uDC00-\uDE1D]|\uDB40[\uDD00-\uDDEF])+$/,
    'whiteSpace': /^(?:[\t-\r \x85\xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000])+$/
};

},{}],34:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer
 * @license MIT
 * @module parse-latin
 * @fileoverview Latin-script (natural language) parser.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var createParser = require('./parser');
var expressions = require('./expressions');

/*
 * == CLASSIFY ===============================================================
 */

/*
 * Constants.
 */

/*
 * Match all tokens:
 * - One or more number, alphabetic, or
 *   combining characters;
 * - One or more white space characters;
 * - One or more astral plane characters;
 * - One or more of the same character;
 */

var EXPRESSION_TOKEN = expressions.token;

/*
 * Match a word.
 */

var EXPRESSION_WORD = expressions.word;

/*
 * Match a string containing ONLY punctuation.
 */

var EXPRESSION_PUNCTUATION = expressions.punctuation;

/*
 * Match a string containing ONLY white space.
 */

var EXPRESSION_WHITE_SPACE = expressions.whiteSpace;

/**
 * Classify a token.
 *
 * @param {string?} value - Value to classify.
 * @return {string} - value's type.
 */
function classify(value) {
    if (EXPRESSION_WHITE_SPACE.test(value)) {
        return 'WhiteSpace';
    }

    if (EXPRESSION_WORD.test(value)) {
        return 'Word';
    }

    if (EXPRESSION_PUNCTUATION.test(value)) {
        return 'Punctuation';
    }

    return 'Symbol';
}

/**
 * Transform a `value` into a list of `NLCSTNode`s.
 *
 * @param {ParseLatin} parser - Context.
 * @param {string?} value - Value to tokenize.
 * @return {Array.<NLCSTNode>}
 */
function tokenize(parser, value) {
    var tokens;
    var offset;
    var line;
    var column;
    var match;

    if (value === null || value === undefined) {
        value = '';
    } else if (value instanceof String) {
        value = value.toString();
    }

    if (typeof value !== 'string') {
        /**
         * Return the given nodes if this is either an
         * empty array, or an array with a node as a first
         * child.
         */

        if ('length' in value && (!value[0] || value[0].type)) {
            return value;
        }

        throw new Error(
            'Illegal invocation: \'' + value + '\'' +
            ' is not a valid argument for \'ParseLatin\''
        );
    }

    tokens = [];

    if (!value) {
        return tokens;
    }

    offset = 0;
    line = 1;
    column = 1;

    /**
     * Get the current position.
     *
     * @example
     *   position = now(); // {line: 1, column: 1}
     *
     * @return {Object}
     */
    function now() {
        return {
            'line': line,
            'column': column,
            'offset': offset
        };
    }

    /**
     * Store position information for a node.
     *
     * @example
     *   start = now();
     *   updatePosition('foo');
     *   location = new Position(start);
     *   // {start: {line: 1, column: 1}, end: {line: 1, column: 3}}
     *
     * @param {Object} start - Starting position.
     */
    function Position(start) {
        this.start = start;
        this.end = now();
    }

    /**
     * Mark position and patch `node.position`.
     *
     * @example
     *   var update = position();
     *   updatePosition('foo');
     *   update({});
     *   // {
     *   //   position: {
     *   //     start: {line: 1, column: 1}
     *   //     end: {line: 1, column: 3}
     *   //   }
     *   // }
     *
     * @returns {function(Node): Node}
     */
    function position() {
        var before = now();

        /**
         * Add the position to a node.
         *
         * @example
         *   update({type: 'text', value: 'foo'});
         *
         * @param {Node} node - Node to attach position
         *   on.
         * @return {Node} - `node`.
         */
        function patch(node) {
            node.position = new Position(before);

            return node;
        }

        return patch;
    }

    /**
     * Update line and column based on `value`.
     *
     * @example
     *   update('foo');
     *
     * @param {string} subvalue - Eaten value..
     */
    function update(subvalue) {
        var subvalueLength = subvalue.length;
        var character = -1;
        var lastIndex = -1;

        offset += subvalueLength;

        while (++character < subvalueLength) {
            if (subvalue.charAt(character) === '\n') {
                lastIndex = character;
                line++;
            }
        }

        if (lastIndex === -1) {
            column = column + subvalueLength;
        } else {
            column = subvalueLength - lastIndex;
        }
    }

    /**
     * Add mechanism.
     *
     * @param {NLCSTNode} node - Node to add.
     * @param {NLCSTParentNode?} [parent] - Optional parent
     *   node to insert into.
     * @return {NLCSTNode} - `node`.
     */
    function add(node, parent) {
        if (parent) {
            parent.children.push(node);
        } else {
            tokens.push(node);
        }

        return node;
    }

    /**
     * Remove `subvalue` from `value`.
     * Expects `subvalue` to be at the start from
     * `value`, and applies no validation.
     *
     * @example
     *   eat('foo')({type: 'TextNode', value: 'foo'});
     *
     * @param {string} subvalue - Removed from `value`,
     *   and passed to `update`.
     * @return {Function} - Wrapper around `add`, which
     *   also adds `position` to node.
     */
    function eat(subvalue) {
        var pos = position();

        /**
         * Add the given arguments, add `position` to
         * the returned node, and return the node.
         *
         * @return {Node}
         */
        function apply() {
            return pos(add.apply(null, arguments));
        }

        value = value.substring(subvalue.length);

        update(subvalue);

        return apply;
    }

    /**
     * Remove `subvalue` from `value`. Does not patch
     * positional information.
     *
     * @param {string} subvalue - Value to eat.
     * @return {Function}
     */
    function noPositionEat(subvalue) {
        /**
         * Add the given arguments and return the node.
         *
         * @return {Node}
         */
        function apply() {
            return add.apply(null, arguments);
        }

        value = value.substring(subvalue.length);

        return apply;
    }

    /*
     * Eat mechanism to use.
     */

    var eater = parser.position ? eat : noPositionEat;

    /**
     * Continue matching.
     */
    function next() {
        EXPRESSION_TOKEN.lastIndex = 0;

        match = EXPRESSION_TOKEN.exec(value);
    }

    next();

    while (match) {
        parser['tokenize' + classify(match[0])](match[0], eater);

        next();
    }

    return tokens;
}

/**
 * Add mechanism used when text-tokenisers are called
 * directly outside of the `tokenize` function.
 *
 * @param {NLCSTNode} node - Node to add.
 * @param {NLCSTParentNode?} [parent] - Optional parent
 *   node to insert into.
 * @return {NLCSTNode} - `node`.
 */
function noopAdd(node, parent) {
    if (parent) {
        parent.children.push(node);
    }

    return node;
}

/**
 * Eat and add mechanism without adding positional
 * information, used when text-tokenisers are called
 * directly outside of the `tokenize` function.
 *
 * @return {Function}
 */
function noopEat() {
    return noopAdd;
}

/*
 * == PARSE LATIN ============================================================
 */

/**
 * Transform Latin-script natural language into
 * an NLCST-tree.
 *
 * @param {VFile?} file - Virtual file.
 * @param {Object?} options - Configuration.
 * @constructor {ParseLatin}
 */
function ParseLatin(file, options) {
    var position;

    if (!(this instanceof ParseLatin)) {
        return new ParseLatin(file, options);
    }

    if (file && file.message) {
        this.file = file;
    } else {
        options = file;
    }

    position = options && options.position;

    if (position !== null && position !== undefined) {
        this.position = Boolean(position);
    }
}

/*
 * Quick access to the prototype.
 */

var parseLatinPrototype = ParseLatin.prototype;

/*
 * Default position.
 */

parseLatinPrototype.position = true;

/*
 * == TOKENIZE ===============================================================
 */

/**
 * Transform a `value` into a list of `NLCSTNode`s.
 *
 * @see tokenize
 */
parseLatinPrototype.tokenize = function (value) {
    return tokenize(this, value);
};

/*
 * == TEXT NODES =============================================================
 */

/**
 * Factory to create a `Text`.
 *
 * @param {string} type - Name of text node.
 * @return {function(value): NLCSTText}
 */
function createTextFactory(type) {
    type += 'Node';

    /**
     * Construct a `Text` from a bound `type`
     *
     * @param {value} value - Value of the node.
     * @param {Function?} [eat] - Optional eat mechanism
     *   to use.
     * @param {NLCSTParentNode?} [parent] - Optional
     *   parent to insert into.
     * @return {NLCSTText}
     */
    return function (value, eat, parent) {
        if (value === null || value === undefined) {
            value = '';
        }

        return (eat || noopEat)(value)({
            'type': type,
            'value': String(value)
        }, parent);
    };
}

/**
 * Create a `SymbolNode` with the given `value`.
 *
 * @param {string?} value
 * @return {NLCSTSymbolNode}
 */
parseLatinPrototype.tokenizeSymbol = createTextFactory('Symbol');

/**
 * Create a `WhiteSpaceNode` with the given `value`.
 *
 * @param {string?} value
 * @return {NLCSTWhiteSpaceNode}
 */
parseLatinPrototype.tokenizeWhiteSpace = createTextFactory('WhiteSpace');

/**
 * Create a `PunctuationNode` with the given `value`.
 *
 * @param {string?} value
 * @return {NLCSTPunctuationNode}
 */
parseLatinPrototype.tokenizePunctuation = createTextFactory('Punctuation');

/**
 * Create a `SourceNode` with the given `value`.
 *
 * @param {string?} value
 * @return {NLCSTSourceNode}
 */
parseLatinPrototype.tokenizeSource = createTextFactory('Source');

/**
 * Create a `TextNode` with the given `value`.
 *
 * @param {string?} value
 * @return {NLCSTTextNode}
 */
parseLatinPrototype.tokenizeText = createTextFactory('Text');

/*
 * == PARENT NODES ===========================================================
 *
 * All these nodes are `pluggable`: they come with a
 * `use` method which accepts a plugin
 * (`function(NLCSTNode)`). Every time one of these
 * methods are called, the plugin is invoked with the
 * node, allowing for easy modification.
 *
 * In fact, the internal transformation from `tokenize`
 * (a list of words, white space, punctuation, and
 * symbols) to `tokenizeRoot` (an NLCST tree), is also
 * implemented through this mechanism.
 */

/**
 * Run transform plug-ins for `key` on `nodes`.
 *
 * @param {string} key - Unique name.
 * @param {Array.<Node>} nodes - List of nodes.
 * @return {Array.<Node>} - `nodes`.
 */
function run(key, nodes) {
    var wareKey = key + 'Plugins';
    var plugins = this[wareKey];
    var index = -1;

    if (plugins) {
        while (plugins[++index]) {
            plugins[index](nodes);
        }
    }

    return nodes;
}

/*
 * Expose `run`.
 */

parseLatinPrototype.run = run;

/**
 * @param {Function} Constructor - Context.
 * @param {string} key - Unique name.
 * @param {function(*): undefined} callback - Wrapped.
 */
function pluggable(Constructor, key, callback) {
    /**
     * Set a pluggable version of `callback`
     * on `Constructor`.
     */
    Constructor.prototype[key] = function () {
        return this.run(key, callback.apply(this, arguments));
    };
}

/**
 * Factory to inject `plugins`. Takes `callback` for
 * the actual inserting.
 *
 * @param {function(Object, string, Array.<Function>)} callback - Wrapped.
 * @return {function(string, Array.<Function>)}
 */
function useFactory(callback) {
    /*
     * Validate if `plugins` can be inserted. Invokes
     * the bound `callback` to do the actual inserting.
     *
     * @param {string} key - Method to inject on
     * @param {Array.<Function>|Function} plugins - One
     *   or more plugins.
     */

    return function (key, plugins) {
        var self = this;
        var wareKey;

        /*
         * Throw if the method is not pluggable.
         */

        if (!(key in self)) {
            throw new Error(
                'Illegal Invocation: Unsupported `key` for ' +
                '`use(key, plugins)`. Make sure `key` is a ' +
                'supported function'
            );
        }

        /*
         * Fail silently when no plugins are given.
         */

        if (!plugins) {
            return;
        }

        wareKey = key + 'Plugins';

        /*
         * Make sure `plugins` is a list.
         */

        if (typeof plugins === 'function') {
            plugins = [plugins];
        } else {
            plugins = plugins.concat();
        }

        /*
         * Make sure `wareKey` exists.
         */

        if (!self[wareKey]) {
            self[wareKey] = [];
        }

        /*
         * Invoke callback with the ware key and plugins.
         */

        callback(self, wareKey, plugins);
    };
}

/*
 * Inject `plugins` to modifiy the result of the method
 * at `key` on the operated on context.
 *
 * @param {string} key
 * @param {Function|Array.<Function>} plugins
 * @this {ParseLatin|Object}
 */

parseLatinPrototype.use = useFactory(function (context, key, plugins) {
    context[key] = context[key].concat(plugins);
});

/*
 * Inject `plugins` to modifiy the result of the method
 * at `key` on the operated on context, before any other.
 *
 * @param {string} key
 * @param {Function|Array.<Function>} plugins
 * @this {ParseLatin|Object}
 */

parseLatinPrototype.useFirst = useFactory(function (context, key, plugins) {
    context[key] = plugins.concat(context[key]);
});

/**
 * Create a `WordNode` with its children set to a single
 * `TextNode`, its value set to the given `value`.
 *
 * @see pluggable
 *
 * @param {string?} value - Value to classify as a word.
 * @return {NLCSTWordNode}
 */
pluggable(ParseLatin, 'tokenizeWord', function (value, eat) {
    var add = (eat || noopEat)('');
    var parent = {
        'type': 'WordNode',
        'children': []
    };

    this.tokenizeText(value, eat, parent);

    return add(parent);
});

/**
 * Create a `SentenceNode` with its children set to
 * `Node`s, their values set to the tokenized given
 * `value`.
 *
 * Unless plugins add new nodes, the sentence is
 * populated by `WordNode`s, `SymbolNode`s,
 * `PunctuationNode`s, and `WhiteSpaceNode`s.
 *
 * @see pluggable
 *
 * @param {string?} value
 * @return {NLCSTSentenceNode}
 */
pluggable(ParseLatin, 'tokenizeSentence', createParser({
    'type': 'SentenceNode',
    'tokenizer': 'tokenize'
}));

/**
 * Create a `ParagraphNode` with its children set to
 * `Node`s, their values set to the tokenized given
 * `value`.
 *
 * Unless plugins add new nodes, the paragraph is
 * populated by `SentenceNode`s and `WhiteSpaceNode`s.
 *
 * @see pluggable
 *
 * @param {string?} value
 * @return {NLCSTParagraphNode}
 */
pluggable(ParseLatin, 'tokenizeParagraph', createParser({
    'type': 'ParagraphNode',
    'delimiter': expressions.terminalMarker,
    'delimiterType': 'PunctuationNode',
    'tokenizer': 'tokenizeSentence'
}));

/**
 * Create a `RootNode` with its children set to `Node`s,
 * their values set to the tokenized given `value`.
 *
 * Unless plugins add new nodes, the root is populated by
 * `ParagraphNode`s and `WhiteSpaceNode`s.
 *
 * @see pluggable
 *
 * @param {string?} value
 * @return {NLCSTRootNode}
 */
pluggable(ParseLatin, 'tokenizeRoot', createParser({
    'type': 'RootNode',
    'delimiter': expressions.newLine,
    'delimiterType': 'WhiteSpaceNode',
    'tokenizer': 'tokenizeParagraph'
}));

/**
 * Easy access to the document parser. This additionally
 * supports retext-style invocation: where an instance is
 * created for each file, and the file is given on
 * instanciation.
 *
 * @see ParseLatin#tokenizeRoot
 */
parseLatinPrototype.parse = function (value) {
    return this.tokenizeRoot(this.file ? this.file.toString() : value);
};

/*
 * == PLUGINS ================================================================
 */

parseLatinPrototype.use('tokenizeSentence', [
    require('./plugin/merge-initial-word-symbol'),
    require('./plugin/merge-final-word-symbol'),
    require('./plugin/merge-inner-word-symbol'),
    require('./plugin/merge-initialisms'),
    require('./plugin/merge-words'),
    require('./plugin/patch-position')
]);

parseLatinPrototype.use('tokenizeParagraph', [
    require('./plugin/merge-non-word-sentences'),
    require('./plugin/merge-affix-symbol'),
    require('./plugin/merge-initial-lower-case-letter-sentences'),
    require('./plugin/merge-prefix-exceptions'),
    require('./plugin/merge-affix-exceptions'),
    require('./plugin/merge-remaining-full-stops'),
    require('./plugin/make-initial-white-space-siblings'),
    require('./plugin/make-final-white-space-siblings'),
    require('./plugin/break-implicit-sentences'),
    require('./plugin/remove-empty-nodes'),
    require('./plugin/patch-position')
]);

parseLatinPrototype.use('tokenizeRoot', [
    require('./plugin/make-initial-white-space-siblings'),
    require('./plugin/make-final-white-space-siblings'),
    require('./plugin/remove-empty-nodes'),
    require('./plugin/patch-position')
]);

/*
 * == EXPORT =================================================================
 */

/*
 * Expose.
 */

module.exports = ParseLatin;

},{"./expressions":33,"./parser":35,"./plugin/break-implicit-sentences":36,"./plugin/make-final-white-space-siblings":37,"./plugin/make-initial-white-space-siblings":38,"./plugin/merge-affix-exceptions":39,"./plugin/merge-affix-symbol":40,"./plugin/merge-final-word-symbol":41,"./plugin/merge-initial-lower-case-letter-sentences":42,"./plugin/merge-initial-word-symbol":43,"./plugin/merge-initialisms":44,"./plugin/merge-inner-word-symbol":45,"./plugin/merge-non-word-sentences":46,"./plugin/merge-prefix-exceptions":47,"./plugin/merge-remaining-full-stops":48,"./plugin/merge-words":49,"./plugin/patch-position":50,"./plugin/remove-empty-nodes":51}],35:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer
 * @license MIT
 * @module parse-latin:parser
 * @fileoverview Construct a parser for a given node.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var tokenizer = require('./tokenizer');

/**
 * Construct a parser based on `options`.
 *
 * @param {Object} options - Configuration.
 * @return {function(string): NLCSTNode}
 */
function parserFactory(options) {
    var type = options.type;
    var tokenizerProperty = options.tokenizer;
    var delimiter = options.delimiter;
    var tokenize = delimiter && tokenizer(options.delimiterType, delimiter);

    return function (value) {
        var children = this[tokenizerProperty](value);

        return {
            'type': type,
            'children': tokenize ? tokenize(children) : children
        };
    };
}

/*
 * Expose.
 */

module.exports = parserFactory;

},{"./tokenizer":52}],36:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer
 * @license MIT
 * @module parse-latin:plugin:break-implicit-sentencs
 * @fileoverview Break a sentence if a white space with
 *   more than one new-line is found.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var nlcstToString = require('nlcst-to-string');
var modifyChildren = require('unist-util-modify-children');
var expressions = require('../expressions');

/*
 * Constants.
 *
 * - Two or more new line characters.
 */

var EXPRESSION_MULTI_NEW_LINE = expressions.newLineMulti;

/**
 * Break a sentence if a white space with more
 * than one new-line is found.
 *
 * @param {NLCSTNode} child - Node.
 * @param {number} index - Position of `child` in `parent`.
 * @param {NLCSTParagraphNode} parent - Parent of `child`.
 * @return {undefined}
 */
function breakImplicitSentences(child, index, parent) {
    var children;
    var position;
    var length;
    var tail;
    var head;
    var end;
    var insertion;
    var node;

    if (child.type !== 'SentenceNode') {
        return;
    }

    children = child.children;

    /*
     * Ignore first and last child.
     */

    length = children.length - 1;
    position = 0;

    while (++position < length) {
        node = children[position];

        if (
            node.type !== 'WhiteSpaceNode' ||
            !EXPRESSION_MULTI_NEW_LINE.test(nlcstToString(node))
        ) {
            continue;
        }

        child.children = children.slice(0, position);

        insertion = {
            'type': 'SentenceNode',
            'children': children.slice(position + 1)
        };

        tail = children[position - 1];
        head = children[position + 1];

        parent.children.splice(index + 1, 0, node, insertion);

        if (child.position && tail.position && head.position) {
            end = child.position.end;

            child.position.end = tail.position.end;

            insertion.position = {
                'start': head.position.start,
                'end': end
            };
        }

        return index + 1;
    }
}

/*
 * Expose `breakImplicitSentences` as a plugin.
 */

module.exports = modifyChildren(breakImplicitSentences);

},{"../expressions":33,"nlcst-to-string":27,"unist-util-modify-children":77}],37:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer
 * @license MIT
 * @module parse-latin:plugin:make-final-white-space-siblings
 * @fileoverview Make final white-space siblings.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var modifyChildren = require('unist-util-modify-children');

/**
 * Move white space ending a paragraph up, so they are
 * the siblings of paragraphs.
 *
 * @param {NLCSTNode} child - Node.
 * @param {number} index - Position of `child` in `parent`.
 * @param {NLCSTParent} parent - Parent of `child`.
 * @return {undefined|number}
 */
function makeFinalWhiteSpaceSiblings(child, index, parent) {
    var children = child.children;
    var prev;

    if (
        children &&
        children.length !== 0 &&
        children[children.length - 1].type === 'WhiteSpaceNode'
    ) {
        parent.children.splice(index + 1, 0, child.children.pop());
        prev = children[children.length - 1];

        if (prev && prev.position && child.position) {
            child.position.end = prev.position.end;
        }

        /*
         * Next, iterate over the current node again.
         */

        return index;
    }
}

/*
 * Expose `makeFinalWhiteSpaceSiblings` as a modifier.
 */

module.exports = modifyChildren(makeFinalWhiteSpaceSiblings);

},{"unist-util-modify-children":77}],38:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer
 * @license MIT
 * @module parse-latin:plugin:make-initial-white-space-siblings
 * @fileoverview Make initial white-space siblings.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var visitChildren = require('unist-util-visit-children');

/**
 * Move white space starting a sentence up, so they are
 * the siblings of sentences.
 *
 * @param {NLCSTNode} child - Node.
 * @param {number} index - Position of `child` in `parent`.
 * @param {NLCSTParent} parent - Parent of `child`.
 */
function makeInitialWhiteSpaceSiblings(child, index, parent) {
    var children = child.children;
    var next;

    if (
        children &&
        children.length !== 0 &&
        children[0].type === 'WhiteSpaceNode'
    ) {
        parent.children.splice(index, 0, children.shift());
        next = children[0];

        if (next && next.position && child.position) {
            child.position.start = next.position.start;
        }
    }
}

/*
 * Expose `makeInitialWhiteSpaceSiblings` as a plugin.
 */

module.exports = visitChildren(makeInitialWhiteSpaceSiblings);

},{"unist-util-visit-children":78}],39:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer
 * @license MIT
 * @module parse-latin:plugin:merge-affix-exceptions
 * @fileoverview Merge a sentence into its previous
 *   sentence, when the sentence starts with a comma.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var nlcstToString = require('nlcst-to-string');
var modifyChildren = require('unist-util-modify-children');

/**
 * Merge a sentence into its previous sentence, when
 * the sentence starts with a comma.
 *
 * @param {NLCSTNode} child - Node.
 * @param {number} index - Position of `child` in `parent`.
 * @param {NLCSTParagraphNode} parent - Parent of `child`.
 * @return {undefined|number}
 */
function mergeAffixExceptions(child, index, parent) {
    var children = child.children;
    var node;
    var position;
    var value;
    var previousChild;

    if (!children || !children.length || index === 0) {
        return;
    }

    position = -1;

    while (children[++position]) {
        node = children[position];

        if (node.type === 'WordNode') {
            return;
        }

        if (
            node.type === 'SymbolNode' ||
            node.type === 'PunctuationNode'
        ) {
            value = nlcstToString(node);

            if (value !== ',' && value !== ';') {
                return;
            }

            previousChild = parent.children[index - 1];

            previousChild.children = previousChild.children.concat(children);

            /*
             * Update position.
             */

            if (previousChild.position && child.position) {
                previousChild.position.end = child.position.end;
            }

            parent.children.splice(index, 1);

            /*
             * Next, iterate over the node *now* at the current
             * position.
             */

            return index;
        }
    }
}

/*
 * Expose `mergeAffixExceptions` as a modifier.
 */

module.exports = modifyChildren(mergeAffixExceptions);

},{"nlcst-to-string":27,"unist-util-modify-children":77}],40:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer
 * @license MIT
 * @module parse-latin:plugin:merge-affix-symbol
 * @fileoverview Move certain punctuation following a
 *   terminal marker (thus in the next sentence) to the
 *   previous sentence.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var nlcstToString = require('nlcst-to-string');
var modifyChildren = require('unist-util-modify-children');
var expressions = require('../expressions');

/*
 * Constants.
 *
 * - Closing or final punctuation, or terminal markers
 *   that should still be included in the previous
 *   sentence, even though they follow the sentence's
 *   terminal marker.
 */

var EXPRESSION_AFFIX_SYMBOL = expressions.affixSymbol;

/**
 * Move certain punctuation following a terminal
 * marker (thus in the next sentence) to the
 * previous sentence.
 *
 * @param {NLCSTNode} child - Node.
 * @param {number} index - Position of `child` in `parent`.
 * @param {NLCSTParagraphNode} parent - Parent of `child`.
 * @return {undefined|number}
 */
function mergeAffixSymbol(child, index, parent) {
    var children = child.children;
    var first;
    var second;
    var prev;

    if (
        children &&
        children.length &&
        index !== 0
    ) {
        first = children[0];
        second = children[1];
        prev = parent.children[index - 1];

        if (
            (
                first.type === 'SymbolNode' ||
                first.type === 'PunctuationNode'
            ) &&
            EXPRESSION_AFFIX_SYMBOL.test(nlcstToString(first))
        ) {
            prev.children.push(children.shift());

            /*
             * Update position.
             */

            if (first.position && prev.position) {
                prev.position.end = first.position.end;
            }

            if (second && second.position && child.position) {
                child.position.start = second.position.start;
            }

            /*
             * Next, iterate over the previous node again.
             */

            return index - 1;
        }
    }
}

/*
 * Expose `mergeAffixSymbol` as a modifier.
 */

module.exports = modifyChildren(mergeAffixSymbol);

},{"../expressions":33,"nlcst-to-string":27,"unist-util-modify-children":77}],41:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer
 * @license MIT
 * @module parse-latin:plugin:merge-final-word-symbol
 * @fileoverview Merge certain symbols into their preceding word.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var nlcstToString = require('nlcst-to-string');
var modifyChildren = require('unist-util-modify-children');

/**
 * Merge certain punctuation marks into their
 * preceding words.
 *
 * @param {NLCSTNode} child - Node.
 * @param {number} index - Position of `child` in `parent`.
 * @param {NLCSTSentenceNode} parent - Parent of `child`.
 * @return {undefined|number}
 */
function mergeFinalWordSymbol(child, index, parent) {
    var children;
    var prev;
    var next;

    if (
        index !== 0 &&
        (
            child.type === 'SymbolNode' ||
            child.type === 'PunctuationNode'
        ) &&
        nlcstToString(child) === '-'
    ) {
        children = parent.children;

        prev = children[index - 1];
        next = children[index + 1];

        if (
            (
                !next ||
                next.type !== 'WordNode'
            ) &&
            (
                prev &&
                prev.type === 'WordNode'
            )
        ) {
            /*
             * Remove `child` from parent.
             */

            children.splice(index, 1);

            /*
             * Add the punctuation mark at the end of the
             * previous node.
             */

            prev.children.push(child);

            /*
             * Update position.
             */

            if (prev.position && child.position) {
                prev.position.end = child.position.end;
            }

            /*
             * Next, iterate over the node *now* at the
             * current position (which was the next node).
             */

            return index;
        }
    }
}

/*
 * Expose `mergeFinalWordSymbol` as a modifier.
 */

module.exports = modifyChildren(mergeFinalWordSymbol);

},{"nlcst-to-string":27,"unist-util-modify-children":77}],42:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer
 * @license MIT
 * @module parse-latin:plugin:merge-initial-lower-case-letter-sentences
 * @fileoverview Merge a sentence into its previous
 *   sentence, when the sentence starts with a lower case
 *   letter.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var nlcstToString = require('nlcst-to-string');
var modifyChildren = require('unist-util-modify-children');
var expressions = require('../expressions');

/*
 * Constants.
 *
 * - Initial lowercase letter.
 */

var EXPRESSION_LOWER_INITIAL = expressions.lowerInitial;

/**
 * Merge a sentence into its previous sentence, when
 * the sentence starts with a lower case letter.
 *
 * @param {NLCSTNode} child - Node.
 * @param {number} index - Position of `child` in `parent`.
 * @param {NLCSTParagraphNode} parent - Parent of `child`.
 * @return {undefined|number}
 */
function mergeInitialLowerCaseLetterSentences(child, index, parent) {
    var children = child.children;
    var position;
    var node;
    var siblings;
    var prev;

    if (
        children &&
        children.length &&
        index !== 0
    ) {
        position = -1;

        while (children[++position]) {
            node = children[position];

            if (node.type === 'WordNode') {
                if (!EXPRESSION_LOWER_INITIAL.test(nlcstToString(node))) {
                    return;
                }

                siblings = parent.children;

                prev = siblings[index - 1];

                prev.children = prev.children.concat(children);

                siblings.splice(index, 1);

                /*
                 * Update position.
                 */

                if (prev.position && child.position) {
                    prev.position.end = child.position.end;
                }

                /*
                 * Next, iterate over the node *now* at
                 * the current position.
                 */

                return index;
            }

            if (
                node.type === 'SymbolNode' ||
                node.type === 'PunctuationNode'
            ) {
                return;
            }
        }
    }
}

/*
 * Expose `mergeInitialLowerCaseLetterSentences` as a modifier.
 */

module.exports = modifyChildren(mergeInitialLowerCaseLetterSentences);

},{"../expressions":33,"nlcst-to-string":27,"unist-util-modify-children":77}],43:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer
 * @license MIT
 * @module parse-latin:plugin:merge-initial-word-symbol
 * @fileoverview Merge certain symbols into their next word.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var nlcstToString = require('nlcst-to-string');
var modifyChildren = require('unist-util-modify-children');

/**
 * Merge certain punctuation marks into their
 * following words.
 *
 * @param {NLCSTNode} child - Node.
 * @param {number} index - Position of `child` in `parent`.
 * @param {NLCSTSentenceNode} parent - Parent of `child`.
 * @return {undefined|number}
 */
function mergeInitialWordSymbol(child, index, parent) {
    var children;
    var next;

    if (
        (
            child.type !== 'SymbolNode' &&
            child.type !== 'PunctuationNode'
        ) ||
        nlcstToString(child) !== '&'
    ) {
        return;
    }

    children = parent.children;

    next = children[index + 1];

    /*
     * If either a previous word, or no following word,
     * exists, exit early.
     */

    if (
        (
            index !== 0 &&
            children[index - 1].type === 'WordNode'
        ) ||
        !(
            next &&
            next.type === 'WordNode'
        )
    ) {
        return;
    }

    /*
     * Remove `child` from parent.
     */

    children.splice(index, 1);

    /*
     * Add the punctuation mark at the start of the
     * next node.
     */

    next.children.unshift(child);

    /*
     * Update position.
     */

    if (next.position && child.position) {
        next.position.start = child.position.start;
    }

    /*
     * Next, iterate over the node at the previous
     * position, as it's now adjacent to a following
     * word.
     */

    return index - 1;
}

/*
 * Expose `mergeInitialWordSymbol` as a modifier.
 */

module.exports = modifyChildren(mergeInitialWordSymbol);

},{"nlcst-to-string":27,"unist-util-modify-children":77}],44:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer
 * @license MIT
 * @module parse-latin:plugin:merge-initialisms
 * @fileoverview Merge initialisms.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var nlcstToString = require('nlcst-to-string');
var modifyChildren = require('unist-util-modify-children');
var expressions = require('../expressions');

/*
 * Constants.
 *
 * - Numbers.
 */

var EXPRESSION_NUMERICAL = expressions.numerical;

/**
 * Merge initialisms.
 *
 * @param {NLCSTNode} child - Node.
 * @param {number} index - Position of `child` in `parent`.
 * @param {NLCSTSentenceNode} parent - Parent of `child`.
 * @return {undefined|number}
 */
function mergeInitialisms(child, index, parent) {
    var siblings;
    var prev;
    var children;
    var length;
    var position;
    var otherChild;
    var isAllDigits;
    var value;

    if (
        index !== 0 &&
        nlcstToString(child) === '.'
    ) {
        siblings = parent.children;

        prev = siblings[index - 1];
        children = prev.children;

        length = children && children.length;

        if (
            prev.type === 'WordNode' &&
            length !== 1 &&
            length % 2 !== 0
        ) {
            position = length;

            isAllDigits = true;

            while (children[--position]) {
                otherChild = children[position];

                value = nlcstToString(otherChild);

                if (position % 2 === 0) {
                    /*
                     * Initialisms consist of one
                     * character values.
                     */

                    if (value.length > 1) {
                        return;
                    }

                    if (!EXPRESSION_NUMERICAL.test(value)) {
                        isAllDigits = false;
                    }
                } else if (value !== '.') {
                    if (position < length - 2) {
                        break;
                    } else {
                        return;
                    }
                }
            }

            if (!isAllDigits) {
                /*
                 * Remove `child` from parent.
                 */

                siblings.splice(index, 1);

                /*
                 * Add child to the previous children.
                 */

                children.push(child);

                /*
                 * Update position.
                 */

                if (prev.position && child.position) {
                    prev.position.end = child.position.end;
                }

                /*
                 * Next, iterate over the node *now* at the current
                 * position.
                 */

                return index;
            }
        }
    }
}

/*
 * Expose `mergeInitialisms` as a modifier.
 */

module.exports = modifyChildren(mergeInitialisms);

},{"../expressions":33,"nlcst-to-string":27,"unist-util-modify-children":77}],45:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer
 * @license MIT
 * @module parse-latin:plugin:merge-inner-word-symbol
 * @fileoverview Merge words joined by certain punctuation
 *   marks.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var nlcstToString = require('nlcst-to-string');
var modifyChildren = require('unist-util-modify-children');
var expressions = require('../expressions');

/*
 * Constants.
 *
 * - Symbols part of surrounding words.
 */

var EXPRESSION_INNER_WORD_SYMBOL = expressions.wordSymbolInner;

/**
 * Merge words joined by certain punctuation marks.
 *
 * @param {NLCSTNode} child - Node.
 * @param {number} index - Position of `child` in `parent`.
 * @param {NLCSTSentenceNode} parent - Parent of `child`.
 * @return {undefined|number}
 */
function mergeInnerWordSymbol(child, index, parent) {
    var siblings;
    var sibling;
    var prev;
    var last;
    var position;
    var tokens;
    var queue;

    if (
        index !== 0 &&
        (
            child.type === 'SymbolNode' ||
            child.type === 'PunctuationNode'
        )
    ) {
        siblings = parent.children;

        prev = siblings[index - 1];

        if (prev && prev.type === 'WordNode') {
            position = index - 1;

            tokens = [];
            queue = [];

            /*
             * - If a token which is neither word nor
             *   inner word symbol is found, the loop
             *   is broken.
             * - If an inner word symbol is found,
             *   it's queued.
             * - If a word is found, it's queued (and
             *   the queue stored and emptied).
             */

            while (siblings[++position]) {
                sibling = siblings[position];

                if (sibling.type === 'WordNode') {
                    tokens = tokens.concat(queue, sibling.children);

                    queue = [];
                } else if (
                    (
                        sibling.type === 'SymbolNode' ||
                        sibling.type === 'PunctuationNode'
                    ) &&
                    EXPRESSION_INNER_WORD_SYMBOL.test(nlcstToString(sibling))
                ) {
                    queue.push(sibling);
                } else {
                    break;
                }
            }

            if (tokens.length) {
                /*
                 * If there is a queue, remove its length
                 * from `position`.
                 */

                if (queue.length) {
                    position -= queue.length;
                }

                /*
                 * Remove every (one or more) inner-word punctuation
                 * marks and children of words.
                 */

                siblings.splice(index, position - index);

                /*
                 * Add all found tokens to `prev`s children.
                 */

                prev.children = prev.children.concat(tokens);

                last = tokens[tokens.length - 1];

                /*
                 * Update position.
                 */

                if (prev.position && last.position) {
                    prev.position.end = last.position.end;
                }

                /*
                 * Next, iterate over the node *now* at the current
                 * position.
                 */

                return index;
            }
        }
    }
}

/*
 * Expose `mergeInnerWordSymbol` as a modifier.
 */

module.exports = modifyChildren(mergeInnerWordSymbol);

},{"../expressions":33,"nlcst-to-string":27,"unist-util-modify-children":77}],46:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer
 * @license MIT
 * @module parse-latin:plugin:merge-non-word-sentences
 * @fileoverview Merge a sentence into the following
 *   sentence, when the sentence does not contain word
 *   tokens.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var modifyChildren = require('unist-util-modify-children');

/**
 * Merge a sentence into the following sentence, when
 * the sentence does not contain word tokens.
 *
 * @param {NLCSTNode} child - Node.
 * @param {number} index - Position of `child` in `parent`.
 * @param {NLCSTParagraphNode} parent - Parent of `child`.
 * @return {undefined|number}
 */
function mergeNonWordSentences(child, index, parent) {
    var children = child.children;
    var position = -1;
    var prev;
    var next;

    while (children[++position]) {
        if (children[position].type === 'WordNode') {
            return;
        }
    }

    prev = parent.children[index - 1];

    if (prev) {
        prev.children = prev.children.concat(children);

        /*
         * Remove the child.
         */

        parent.children.splice(index, 1);

        /*
         * Patch position.
         */

        if (prev.position && child.position) {
            prev.position.end = child.position.end;
        }

        /*
         * Next, iterate over the node *now* at
         * the current position (which was the
         * next node).
         */

        return index;
    }

    next = parent.children[index + 1];

    if (next) {
        next.children = children.concat(next.children);

        /*
         * Patch position.
         */

        if (next.position && child.position) {
            next.position.start = child.position.start;
        }

        /*
         * Remove the child.
         */

        parent.children.splice(index, 1);
    }
}

/*
 * Expose `mergeNonWordSentences` as a modifier.
 */

module.exports = modifyChildren(mergeNonWordSentences);

},{"unist-util-modify-children":77}],47:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer
 * @license MIT
 * @module parse-latin:plugin:merge-prefix-exceptions
 * @fileoverview Merge a sentence into its next sentence,
 *   when the sentence ends with a certain word.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var nlcstToString = require('nlcst-to-string');
var modifyChildren = require('unist-util-modify-children');

/*
 * Constants.
 *
 * - Blacklist of full stop characters that should not
 *   be treated as terminal sentence markers: A
 *   case-insensitive abbreviation.
 */

var EXPRESSION_ABBREVIATION_PREFIX = new RegExp(
    '^(' +
        '[0-9]+|' +
        '[a-z]|' +

        /*
         * Common Latin Abbreviations:
         * Based on: http://en.wikipedia.org/wiki/List_of_Latin_abbreviations
         * Where only the abbreviations written without joining full stops,
         * but with a final full stop, were extracted.
         *
         * circa, capitulus, confer, compare, centum weight, eadem, (et) alii,
         * et cetera, floruit, foliis, ibidem, idem, nemine && contradicente,
         * opere && citato, (per) cent, (per) procurationem, (pro) tempore,
         * sic erat scriptum, (et) sequentia, statim, videlicet.
         */

        'al|ca|cap|cca|cent|cf|cit|con|cp|cwt|ead|etc|ff|' +
        'fl|ibid|id|nem|op|pro|seq|sic|stat|tem|viz' +
    ')$'
);

/**
 * Merge a sentence into its next sentence, when the
 * sentence ends with a certain word.
 *
 * @param {NLCSTNode} child - Node.
 * @param {number} index - Position of `child` in `parent`.
 * @param {NLCSTParagraphNode} parent - Parent of `child`.
 * @return {undefined|number}
 */
function mergePrefixExceptions(child, index, parent) {
    var children = child.children;
    var node;
    var next;

    if (
        children &&
        children.length &&
        index !== parent.children.length - 1
    ) {
        node = children[children.length - 1];

        if (
            node &&
            nlcstToString(node) === '.'
        ) {
            node = children[children.length - 2];

            if (
                node &&
                node.type === 'WordNode' &&
                EXPRESSION_ABBREVIATION_PREFIX.test(
                    nlcstToString(node).toLowerCase()
                )
            ) {
                next = parent.children[index + 1];

                child.children = children.concat(next.children);

                parent.children.splice(index + 1, 1);

                /*
                 * Update position.
                 */

                if (next.position && child.position) {
                    child.position.end = next.position.end;
                }

                /*
                 * Next, iterate over the current node again.
                 */

                return index - 1;
            }
        }
    }
}

/*
 * Expose `mergePrefixExceptions` as a modifier.
 */

module.exports = modifyChildren(mergePrefixExceptions);

},{"nlcst-to-string":27,"unist-util-modify-children":77}],48:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer
 * @license MIT
 * @module parse-latin:plugin:merge-remaining-full-stops
 * @fileoverview Merge non-terminal-marker full stops into
 *   previous or next adjacent words.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var nlcstToString = require('nlcst-to-string');
var visitChildren = require('unist-util-visit-children');
var expressions = require('../expressions');

/*
 * Constants.
 *
 * - Blacklist of full stop characters that should not
 *   be treated as terminal sentence markers: A
 *   case-insensitive abbreviation.
 */

var EXPRESSION_TERMINAL_MARKER = expressions.terminalMarker;

/**
 * Merge non-terminal-marker full stops into
 * the previous word (if available), or the next
 * word (if available).
 *
 * @param {NLCSTNode} child - Node.
 */
function mergeRemainingFullStops(child) {
    var children = child.children;
    var position = children.length;
    var hasFoundDelimiter = false;
    var grandchild;
    var prev;
    var next;
    var nextNext;

    while (children[--position]) {
        grandchild = children[position];

        if (
            grandchild.type !== 'SymbolNode' &&
            grandchild.type !== 'PunctuationNode'
        ) {
            /*
             * This is a sentence without terminal marker,
             * so we 'fool' the code to make it think we
             * have found one.
             */

            if (grandchild.type === 'WordNode') {
                hasFoundDelimiter = true;
            }

            continue;
        }

        /*
         * Exit when this token is not a terminal marker.
         */

        if (!EXPRESSION_TERMINAL_MARKER.test(nlcstToString(grandchild))) {
            continue;
        }

        /*
         * Ignore the first terminal marker found
         * (starting at the end), as it should not
         * be merged.
         */

        if (!hasFoundDelimiter) {
            hasFoundDelimiter = true;

            continue;
        }

        /*
         * Only merge a single full stop.
         */

        if (nlcstToString(grandchild) !== '.') {
            continue;
        }

        prev = children[position - 1];
        next = children[position + 1];

        if (prev && prev.type === 'WordNode') {
            nextNext = children[position + 2];

            /*
             * Continue when the full stop is followed by
             * a space and another full stop, such as:
             * `{.} .`
             */

            if (
                next &&
                nextNext &&
                next.type === 'WhiteSpaceNode' &&
                nlcstToString(nextNext) === '.'
            ) {
                continue;
            }

            /*
             * Remove `child` from parent.
             */

            children.splice(position, 1);

            /*
             * Add the punctuation mark at the end of the
             * previous node.
             */

            prev.children.push(grandchild);

            /*
             * Update position.
             */

            if (grandchild.position && prev.position) {
                prev.position.end = grandchild.position.end;
            }

            position--;
        } else if (next && next.type === 'WordNode') {
            /*
             * Remove `child` from parent.
             */

            children.splice(position, 1);

            /*
             * Add the punctuation mark at the start of
             * the next node.
             */

            next.children.unshift(grandchild);

            if (grandchild.position && next.position) {
                next.position.start = grandchild.position.start;
            }
        }
    }
}

/*
 * Expose `mergeRemainingFullStops` as a plugin.
 */

module.exports = visitChildren(mergeRemainingFullStops);

},{"../expressions":33,"nlcst-to-string":27,"unist-util-visit-children":78}],49:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer
 * @license MIT
 * @module parse-latin:plugin:merge-words
 * @fileoverview Merge adjacent words.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var modifyChildren = require('unist-util-modify-children');

/**
 * Merge multiple words. This merges the children of
 * adjacent words, something which should not occur
 * naturally by parse-latin, but might happen when
 * custom tokens were passed in.
 *
 * @param {NLCSTNode} child - Node.
 * @param {number} index - Position of `child` in `parent`.
 * @param {NLCSTSentenceNode} parent - Parent of `child`.
 * @return {undefined|number}
 */
function mergeFinalWordSymbol(child, index, parent) {
    var siblings = parent.children;
    var next;

    if (child.type === 'WordNode') {
        next = siblings[index + 1];

        if (next && next.type === 'WordNode') {
            /*
             * Remove `next` from parent.
             */

            siblings.splice(index + 1, 1);

            /*
             * Add the punctuation mark at the end of the
             * previous node.
             */

            child.children = child.children.concat(next.children);

            /*
             * Update position.
             */

            if (next.position && child.position) {
                child.position.end = next.position.end;
            }

            /*
             * Next, re-iterate the current node.
             */

            return index;
        }
    }
}

/*
 * Expose `mergeFinalWordSymbol` as a modifier.
 */

module.exports = modifyChildren(mergeFinalWordSymbol);

},{"unist-util-modify-children":77}],50:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer
 * @license MIT
 * @module parse-latin:plugin:patch-position
 * @fileoverview Patch `position` on a parent node based
 *   on its first and last child.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var visitChildren = require('unist-util-visit-children');

/**
 * Add a `position` object when it does not yet exist
 * on `node`.
 *
 * @param {NLCSTNode} node - Node to patch.
 */
function patch(node) {
    if (!node.position) {
        node.position = {};
    }
}

/**
 * Patch the position on a parent node based on its first
 * and last child.
 *
 * @param {NLCSTNode} child - Node.
 */
function patchPosition(child, index, node) {
    var siblings = node.children;

    if (!child.position) {
        return;
    }

    if (
        index === 0 &&
        (!node.position || /* istanbul ignore next */ !node.position.start)
    ) {
        patch(node);
        node.position.start = child.position.start;
    }

    if (
        index === siblings.length - 1 &&
        (!node.position || !node.position.end)
    ) {
        patch(node);
        node.position.end = child.position.end;
    }
}

/*
 * Expose `patchPosition` as a plugin.
 */

module.exports = visitChildren(patchPosition);

},{"unist-util-visit-children":78}],51:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer
 * @license MIT
 * @module parse-latin:plugin:remove-empty-nodes
 * @fileoverview Remove empty child nodes without children.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var modifyChildren = require('unist-util-modify-children');

/**
 * Remove empty children.
 *
 * @param {NLCSTNode} child - Node.
 * @param {number} index - Position of `child` in `parent`.
 * @param {NLCSTParagraphNode} parent - Parent of `child`.
 * @return {undefined|number}
 */
function removeEmptyNodes(child, index, parent) {
    if ('children' in child && !child.children.length) {
        parent.children.splice(index, 1);

        /*
         * Next, iterate over the node *now* at
         * the current position (which was the
         * next node).
         */

        return index;
    }
}

/*
 * Expose `removeEmptyNodes` as a modifier.
 */

module.exports = modifyChildren(removeEmptyNodes);

},{"unist-util-modify-children":77}],52:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer
 * @license MIT
 * @module parse-latin:tokenizer
 * @fileoverview Tokenize tokens matching an expression as
 *   a given node-type.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var nlcstToString = require('nlcst-to-string');

/**
 * Factory to create a tokenizer based on a given
 * `expression`.
 *
 * @param {string} childType - Type of child to tokenize
 *   as.
 * @param {RegExp} expression - Expression to use for
 *   tokenization.
 * @return {function(NLCSTParent): Array.<NLCSTChild>}
 */
function tokenizerFactory(childType, expression) {
    /**
     * A function which splits
     *
     * @param {NLCSTParent} node - Parent node.
     * @return {Array.<NLCSTChild>}
     */
    return function (node) {
        var children = [];
        var tokens = node.children;
        var type = node.type;
        var length = tokens.length;
        var index = -1;
        var lastIndex = length - 1;
        var start = 0;
        var first;
        var last;
        var parent;

        while (++index < length) {
            if (
                index === lastIndex ||
                (
                    tokens[index].type === childType &&
                    expression.test(nlcstToString(tokens[index]))
                )
            ) {
                first = tokens[start];
                last = tokens[index];

                parent = {
                    'type': type,
                    'children': tokens.slice(start, index + 1)
                };

                if (first.position && last.position) {
                    parent.position = {
                        'start': first.position.start,
                        'end': last.position.end
                    };
                }

                children.push(parent);

                start = index + 1;
            }
        }

        return children;
    };
}

/*
 * Expose.
 */

module.exports = tokenizerFactory;

},{"nlcst-to-string":27}],53:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer
 * @license MIT
 * @module remark:range
 * @fileoverview Patch index-based range on mdast nodes.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var visit = require('unist-util-visit');

/**
 * Calculate offsets for `lines`.
 *
 * @param {Array.<string>} lines - Lines to compile.
 * @return {Array.<number>} - List of offsets per line.
 */
function toOffsets(lines) {
    var total = 0;
    var index = -1;
    var length = lines.length;
    var result = [];

    while (++index < length) {
        result[index] = total += lines[index].length + 1;
    }

    return result;
}

/**
 * Add an offset based on `offsets` to `position`.
 *
 * @param {Object} position - Position.
 * @param {Function} fn - Calculator.
 */
function addRange(position, fn) {
    position.offset = fn(position);
}

/**
 * Factory to reverse an offset into a line--column
 * tuple.
 *
 * @param {Array.<number>} offsets - Offsets, as returned
 *   by `toOffsets()`.
 * @return {Function} - Bound method.
 */
function positionToOffsetFactory(offsets) {
    /**
     * Calculate offsets for `lines`.
     *
     * @param {Object} position - Position.
     * @return {Object} - Object with `line` and `colymn`
     *   properties based on the bound `offsets`.
     */
    function positionToOffset(position) {
        var line = position && position.line;
        var column = position && position.column;

        if (!isNaN(line) && !isNaN(column)) {
            return ((offsets[line - 2] || 0) + column - 1) || 0;
        }

        return -1;
    }

    return positionToOffset;
}

/**
 * Factory to reverse an offset into a line--column
 * tuple.
 *
 * @param {Array.<number>} offsets - Offsets, as returned
 *   by `toOffsets()`.
 * @return {Function} - Bound method.
 */
function offsetToPositionFactory(offsets) {
    /**
     * Calculate offsets for `lines`.
     *
     * @param {number} offset - Offset.
     * @return {Object} - Object with `line` and `colymn`
     *   properties based on the bound `offsets`.
     */
    function offsetToPosition(offset) {
        var index = -1;
        var length = offsets.length;

        if (offset < 0) {
            return {};
        }

        while (++index < length) {
            if (offsets[index] > offset) {
                return {
                    'line': index + 1,
                    'column': (offset - (offsets[index - 1] || 0)) + 1
                };
            }
        }

        return {};
    }

    return offsetToPosition;
}

/**
 * Add ranges for `ast`.
 *
 * @param {Node} ast - Context to patch.
 * @param {VFile} file - Virtual file.
 */
function transformer(ast, file) {
    var contents = String(file).split('\n');
    var positionToOffset;

    /*
     * Invalid.
     */

    if (!file || typeof file.contents !== 'string') {
        throw new Error('Missing `file` for remark-range');
    }

    /*
     * Construct.
     */

    contents = toOffsets(contents);
    positionToOffset = positionToOffsetFactory(contents);

    /*
     * Expose methods.
     */

    file.offsetToPosition = offsetToPositionFactory(contents);
    file.positionToOffset = positionToOffset;

    /*
     * Add `offset` on both `start` and `end`.
     */

    visit(ast, function (node) {
        var position = node.position;

        if (position && position.start) {
            addRange(position.start, positionToOffset);
        }

        if (position && position.end) {
            addRange(position.end, positionToOffset);
        }
    });
}

/**
 * Attacher.
 *
 * @return {Function} - `transformer`.
 */
function attacher() {
    return transformer;
}

/*
 * Expose.
 */

module.exports = attacher;

},{"unist-util-visit":79}],54:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2016 Titus Wormer
 * @license MIT
 * @module remark:retext
 * @fileoverview retext support for remark.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var bridge = require('unified-bridge');
var mdast2nlcst = require('mdast-util-to-nlcst');

/**
 * retext support for remark.
 *
 * @param {Remark} remark - Origin processor.
 * @param {Retext} retext - Destination processor.
 * @param {VFile} file - Virtual file.
 */
function enter(remark, retext, file) {
    return mdast2nlcst(file, retext.Parser);
}

/*
 * Expose.
 */

module.exports = bridge({
    'name': 'retext',
    'enter': enter
});

},{"mdast-util-to-nlcst":55,"unified-bridge":75}],55:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2015-2016 Titus Wormer
 * @license MIT
 * @module mdast:util:to-nlcst
 * @fileoverview Create a Natural Language Concrete Syntax Tree from
 *   a Markdown Abstract Syntax Tree.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var range = require('remark-range');
var toString = require('nlcst-to-string');
var repeat = require('repeat-string');

/*
 * Map of ignored mdast nodes: nodes which have no (simple)
 * representation in NLCST.
 */

var IGNORE = {
    'horizontalRule': true,
    'table': true,
    'tableRow': true,
    'tableCell': true
};

/*
 * Constants.
 */

var C_NEWLINE = '\n';

/**
 * Create an position object for `offset` in `file`.
 *
 * @param {number} offset - Offset in `file`.
 * @param {File} file - Virtual file.
 * @return {Object} - Positional information.
 */
function position(offset, file) {
    var pos = file.offsetToPosition(offset);

    pos.offset = offset;

    return pos;
}

/**
 * Create a location object for `start` and `end` in
 * `file`.
 *
 * @param {number} start - Starting offset in `file`.
 * @param {number} end - Ending offset in `file`.
 * @param {File} file - Virtual file.
 * @return {Object} - Location information.
 */
function location(start, end, file) {
    return {
        'start': position(start, file),
        'end': position(end, file)
    };
}

/**
 * Patch a position on each node in `nodes`.
 * `offset` is the offset in `file` this run of content
 * starts at.
 *
 * Note that NLCST nodes are concrete, meaning that their
 * starting and ending positions can be inferred from their
 * content.
 *
 * @param {Array.<NLCSTNode>} nodes - NLCST nodes.
 * @param {File} file - Virtual file.
 * @param {number} offset - Starting offset for `nodes`.
 * @return {Array.<NLCSTNode>} - `nodes`.
 */
function patch(nodes, file, offset) {
    var length = nodes.length;
    var index = -1;
    var start = offset;
    var children;
    var node;
    var end;

    while (++index < length) {
        node = nodes[index];
        children = node.children;

        if (children) {
            patch(children, file, start);
        }

        end = start + toString(node).length;

        node.position = location(start, end, file);

        start = end;
    }

    return nodes;
}

/*
 * Transformers.
 */

var all;
var one;

/**
 * Convert all nodes in `parent` (mdast) into NLCST.
 *
 * @param {MDASTNode} parent - Parent node.
 * @param {File} file - Virtual file.
 * @param {Parser} parser - NLCST parser.
 * @return {Array.<NLCSTNode>} - Concatenation of calling
 *   `one` on each MDASTNode in `parent`.
 */
all = function (parent, file, parser) {
    var children = parent.children;
    var length = children && children.length;
    var index = -1;
    var result = [];
    var child;
    var node;
    var pos;
    var prevEndLine;
    var prevOffset;
    var endLine;

    while (++index < length) {
        node = children[index];
        pos = node.position;
        endLine = pos.start.line;

        if (prevEndLine && endLine !== prevEndLine) {
            child = parser.tokenizeWhiteSpace(
                repeat(C_NEWLINE, endLine - prevEndLine)
            );

            patch([child], file, prevOffset);

            if (child.value.length < 2) {
                child.value = repeat(C_NEWLINE, 2);
            }

            result.push(child);
        }

        child = one(node, index, parent, file, parser);

        if (child) {
            result = result.concat(child);
        }

        prevEndLine = pos.end.line;
        prevOffset = pos.end.offset;
    }

    return result;
};

/**
 * Convert `node` into NLCST.
 *
 * @param {MDASTNode} node - Node.
 * @param {number} index - Position of `node` in `parent`.
 * @param {MDASTNode} parent - Parent node of `node`.
 * @param {File} file - Virtual file.
 * @param {Parser} parser - NLCST parser.
 * @return {Array.<NLCSTNode>?} - A list of NLCST nodes, if
 *   `node` could be converted.
 */
one = function (node, index, parent, file, parser) {
    var type = node.type;
    var pos = node.position;
    var start = pos.start;
    var end = pos.end;
    var replacement;

    if (type in IGNORE) {
        return null;
    }

    if (node.children) {
        replacement = all(node, file, parser);
    } else if (
        type === 'image' ||
        type === 'imageReference'
    ) {
        replacement = patch(parser.tokenize(
            node.alt
        ), file, start.offset + 2);
    } else if (
        type === 'text' ||
        type === 'escape'
    ) {
        replacement = patch(parser.tokenize(node.value), file, start.offset);
    } else if (node.type === 'break') {
        replacement = patch([
            parser.tokenizeWhiteSpace('\n')
        ], file, start.offset);
    } else if (node.type === 'inlineCode') {
        replacement = patch([parser.tokenizeSource(
            file.toString().slice(start.offset, end.offset)
        )], file, start.offset);
    }

    return replacement || null;
};

/**
 * Transform `ast` into `nlcst`.
 *
 * @param {File} file - Virtual file.
 * @param {Parser|Function} Parser - (Instance of) NLCST
 *   parser.
 * @return {NLCSTNode} - NLCST.
 */
function toNLCST(file, Parser) {
    var ast;
    var space;
    var parser;

    /*
     * Warn for invalid parameters.
     */

    if (!file || !file.messages) {
        throw new Error('mdast-util-to-nlcst expected file');
    }

    space = file.namespace('mdast');
    ast = space.tree || space.ast;

    if (!ast || !ast.type) {
        throw new Error('mdast-util-to-nlcst expected node');
    }

    if (
        !ast.position ||
        !ast.position.start ||
        !ast.position.start.column ||
        !ast.position.start.line
    ) {
        throw new Error('mdast-util-to-nlcst expected position on nodes');
    }

    /*
     * Construct parser.
     */

    if (!Parser) {
        throw new Error('mdast-util-to-nlcst expected parser');
    }

    parser = 'parse' in Parser ? Parser : new Parser();

    /*
     * Patch ranges.
     */

    range()(ast, file);

    /*
     * Transform mdast into NLCST tokens, and pass these
     * into `parser.parse` to insert sentences, paragraphs
     * where needed.
     */

    return parser.parse(one(ast, null, null, file, parser));
}

/*
 * Expose.
 */

module.exports = toNLCST;

},{"nlcst-to-string":27,"remark-range":53,"repeat-string":63}],56:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2015-2016 Titus Wormer
 * @license MIT
 * @module remark
 * @version 3.2.0
 * @fileoverview Markdown processor powered by plugins.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var unified = require('unified');
var Parser = require('./lib/parse.js');
var Compiler = require('./lib/stringify.js');
var escape = require('./lib/escape.json');

/*
 * Exports.
 */

module.exports = unified({
    'name': 'mdast',
    'Parser': Parser,
    'Compiler': Compiler,
    'data': {
        'escape': escape
    }
});

},{"./lib/escape.json":59,"./lib/parse.js":60,"./lib/stringify.js":61,"unified":76}],57:[function(require,module,exports){
module.exports=[
    "article",
    "header",
    "aside",
    "hgroup",
    "blockquote",
    "hr",
    "iframe",
    "body",
    "li",
    "map",
    "button",
    "object",
    "canvas",
    "ol",
    "caption",
    "output",
    "col",
    "p",
    "colgroup",
    "pre",
    "dd",
    "progress",
    "div",
    "section",
    "dl",
    "table",
    "td",
    "dt",
    "tbody",
    "embed",
    "textarea",
    "fieldset",
    "tfoot",
    "figcaption",
    "th",
    "figure",
    "thead",
    "footer",
    "tr",
    "form",
    "ul",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "video",
    "script",
    "style"
]

},{}],58:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2015-2016 Titus Wormer
 * @license MIT
 * @module remark:defaults
 * @version 3.2.0
 * @fileoverview Default values for parse and
 *  stringification settings.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Note that `stringify.entities` is a string.
 */

module.exports = {
    'parse': {
        'position': true,
        'gfm': true,
        'yaml': true,
        'commonmark': false,
        'footnotes': false,
        'pedantic': false,
        'breaks': false
    },
    'stringify': {
        'gfm': true,
        'commonmark': false,
        'entities': 'false',
        'setext': false,
        'closeAtx': false,
        'looseTable': false,
        'spacedTable': true,
        'incrementListMarker': true,
        'fences': false,
        'fence': '`',
        'bullet': '-',
        'listItemIndent': 'tab',
        'rule': '*',
        'ruleSpaces': true,
        'ruleRepetition': 3,
        'strong': '*',
        'emphasis': '_'
    }
};

},{}],59:[function(require,module,exports){
module.exports={
  "default": [
    "\\",
    "`",
    "*",
    "{",
    "}",
    "[",
    "]",
    "(",
    ")",
    "#",
    "+",
    "-",
    ".",
    "!",
    "_",
    ">"
  ],
  "gfm": [
    "\\",
    "`",
    "*",
    "{",
    "}",
    "[",
    "]",
    "(",
    ")",
    "#",
    "+",
    "-",
    ".",
    "!",
    "_",
    ">",
    "~",
    "|"
  ],
  "commonmark": [
    "\\",
    "`",
    "*",
    "{",
    "}",
    "[",
    "]",
    "(",
    ")",
    "#",
    "+",
    "-",
    ".",
    "!",
    "_",
    ">",
    "~",
    "|",
    "\n",
    "\"",
    "$",
    "%",
    "&",
    "'",
    ",",
    "/",
    ":",
    ";",
    "<",
    "=",
    "?",
    "@",
    "^"
  ]
}

},{}],60:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2015-2016 Titus Wormer
 * @license MIT
 * @module remark:parse
 * @version 3.2.0
 * @fileoverview Parse a markdown document into an
 *   abstract syntax tree.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var decode = require('parse-entities');
var repeat = require('repeat-string');
var trim = require('trim');
var trimTrailingLines = require('trim-trailing-lines');
var extend = require('extend.js');
var utilities = require('./utilities.js');
var defaultOptions = require('./defaults.js').parse;
var blockElements = require('./block-elements.json');

/*
 * Methods.
 */

var raise = utilities.raise;
var clean = utilities.clean;
var validate = utilities.validate;
var normalize = utilities.normalizeIdentifier;
var stateToggler = utilities.stateToggler;
var mergeable = utilities.mergeable;
var MERGEABLE_NODES = utilities.MERGEABLE_NODES;
var has = {}.hasOwnProperty;

/*
 * Numeric constants.
 */

var SPACE_SIZE = 1;
var TAB_SIZE = 4;
var CODE_INDENT_LENGTH = 4;
var MIN_FENCE_COUNT = 3;
var MAX_ATX_COUNT = 6;
var MAX_LINE_HEADING_INDENT = 3;
var HORIZONTAL_RULE_MARKER_COUNT = 3;
var MIN_CLOSING_HTML_NEWLINE_COUNT = 2;
var MIN_BREAK_LENGTH = 2;
var MIN_TABLE_COLUMNS = 2;
var MIN_TABLE_ROWS = 2;

/*
 * Error messages.
 */

var ERR_INFINITE_LOOP = 'Infinite loop';
var ERR_MISSING_LOCATOR = 'Missing locator: ';
var ERR_INCORRECTLY_EATEN = 'Incorrectly eaten value: please report this ' +
    'warning on http://git.io/vUYWz';

/*
 * Expressions.
 */

var EXPRESSION_BULLET = /^([ \t]*)([*+-]|\d+[.)])( {1,4}(?! )| |\t|$)([^\n]*)/;
var EXPRESSION_PEDANTIC_BULLET = /^([ \t]*)([*+-]|\d+[.)])([ \t]+)/;
var EXPRESSION_INITIAL_INDENT = /^( {1,4}|\t)?/gm;
var EXPRESSION_INITIAL_TAB = /^( {4}|\t)?/gm;
var EXPRESSION_HTML_LINK_OPEN = /^<a /i;
var EXPRESSION_HTML_LINK_CLOSE = /^<\/a>/i;
var EXPRESSION_LOOSE_LIST_ITEM = /\n\n(?!\s*$)/;
var EXPRESSION_TASK_ITEM = /^\[([\ \t]|x|X)\][\ \t]/;

/*
 * Characters.
 */

var C_BACKSLASH = '\\';
var C_UNDERSCORE = '_';
var C_ASTERISK = '*';
var C_TICK = '`';
var C_AT_SIGN = '@';
var C_HASH = '#';
var C_PLUS = '+';
var C_DASH = '-';
var C_DOT = '.';
var C_PIPE = '|';
var C_DOUBLE_QUOTE = '"';
var C_SINGLE_QUOTE = '\'';
var C_COMMA = ',';
var C_SLASH = '/';
var C_COLON = ':';
var C_SEMI_COLON = ';';
var C_QUESTION_MARK = '?';
var C_CARET = '^';
var C_EQUALS = '=';
var C_EXCLAMATION_MARK = '!';
var C_TILDE = '~';
var C_LT = '<';
var C_GT = '>';
var C_BRACKET_OPEN = '[';
var C_BRACKET_CLOSE = ']';
var C_PAREN_OPEN = '(';
var C_PAREN_CLOSE = ')';
var C_SPACE = ' ';
var C_FORM_FEED = '\f';
var C_NEWLINE = '\n';
var C_CARRIAGE_RETURN = '\r';
var C_TAB = '\t';
var C_VERTICAL_TAB = '\v';
var C_NO_BREAK_SPACE = '\u00a0';
var C_OGHAM_SPACE = '\u1680';
var C_MONGOLIAN_VOWEL_SEPARATOR = '\u180e';
var C_EN_QUAD = '\u2000';
var C_EM_QUAD = '\u2001';
var C_EN_SPACE = '\u2002';
var C_EM_SPACE = '\u2003';
var C_THREE_PER_EM_SPACE = '\u2004';
var C_FOUR_PER_EM_SPACE = '\u2005';
var C_SIX_PER_EM_SPACE = '\u2006';
var C_FIGURE_SPACE = '\u2007';
var C_PUNCTUATION_SPACE = '\u2008';
var C_THIN_SPACE = '\u2009';
var C_HAIR_SPACE = '\u200a';
var C_LINE_SEPARATOR = '​\u2028';
var C_PARAGRAPH_SEPARATOR = '​\u2029';
var C_NARROW_NO_BREAK_SPACE = '\u202f';
var C_IDEOGRAPHIC_SPACE = '\u3000';
var C_ZERO_WIDTH_NO_BREAK_SPACE = '\ufeff';
var C_X_LOWER = 'x';

/*
 * Character codes.
 */

var CC_A_LOWER = 'a'.charCodeAt(0);
var CC_A_UPPER = 'A'.charCodeAt(0);
var CC_Z_LOWER = 'z'.charCodeAt(0);
var CC_Z_UPPER = 'Z'.charCodeAt(0);
var CC_0 = '0'.charCodeAt(0);
var CC_9 = '9'.charCodeAt(0);

/*
 * Protocols.
 */

var HTTP_PROTOCOL = 'http://';
var HTTPS_PROTOCOL = 'https://';
var MAILTO_PROTOCOL = 'mailto:';

var PROTOCOLS = [
    HTTP_PROTOCOL,
    HTTPS_PROTOCOL,
    MAILTO_PROTOCOL
];

var PROTOCOLS_LENGTH = PROTOCOLS.length;

/*
 * Textual constants.
 */

var YAML_FENCE = repeat(C_DASH, 3);
var CODE_INDENT = repeat(C_SPACE, CODE_INDENT_LENGTH);
var EMPTY = '';
var BLOCK = 'block';
var INLINE = 'inline';
var COMMENT_START = '<!--';
var COMMENT_END = '-->';
var CDATA_START = '<![CDATA[';
var CDATA_END = ']]>';
var COMMENT_END_CHAR = COMMENT_END.charAt(0);
var CDATA_END_CHAR = CDATA_END.charAt(0);
var COMMENT_START_LENGTH = COMMENT_START.length;
var COMMENT_END_LENGTH = COMMENT_END.length;
var CDATA_START_LENGTH = CDATA_START.length;
var CDATA_END_LENGTH = CDATA_END.length;

/*
 * Node types.
 */

var T_HORIZONTAL_RULE = 'horizontalRule';
var T_HTML = 'html';
var T_YAML = 'yaml';
var T_TABLE = 'table';
var T_TABLE_CELL = 'tableCell';
var T_TABLE_HEADER = 'tableHeader';
var T_TABLE_ROW = 'tableRow';
var T_PARAGRAPH = 'paragraph';
var T_TEXT = 'text';
var T_CODE = 'code';
var T_LIST = 'list';
var T_LIST_ITEM = 'listItem';
var T_DEFINITION = 'definition';
var T_FOOTNOTE_DEFINITION = 'footnoteDefinition';
var T_HEADING = 'heading';
var T_BLOCKQUOTE = 'blockquote';
var T_LINK = 'link';
var T_IMAGE = 'image';
var T_FOOTNOTE = 'footnote';
var T_STRONG = 'strong';
var T_EMPHASIS = 'emphasis';
var T_DELETE = 'delete';
var T_INLINE_CODE = 'inlineCode';
var T_BREAK = 'break';
var T_ROOT = 'root';

/*
 * Available table alignments.
 */

var TABLE_ALIGN_LEFT = 'left';
var TABLE_ALIGN_CENTER = 'center';
var TABLE_ALIGN_RIGHT = 'right';
var TABLE_ALIGN_NONE = null;

/*
 * Available reference types.
 */

var REFERENCE_TYPE_SHORTCUT = 'shortcut';
var REFERENCE_TYPE_COLLAPSED = 'collapsed';
var REFERENCE_TYPE_FULL = 'full';

/*
 * A map of characters, and their column length,
 * which can be used as indentation.
 */

var INDENTATION_CHARACTERS = {};

INDENTATION_CHARACTERS[C_SPACE] = SPACE_SIZE;
INDENTATION_CHARACTERS[C_TAB] = TAB_SIZE;

/*
 * A map of characters, which can be used to mark emphasis.
 */

var EMPHASIS_MARKERS = {};

EMPHASIS_MARKERS[C_ASTERISK] = true;
EMPHASIS_MARKERS[C_UNDERSCORE] = true;

/*
 * A map of characters, which can be used to mark rules.
 */

var RULE_MARKERS = {};

RULE_MARKERS[C_ASTERISK] = true;
RULE_MARKERS[C_UNDERSCORE] = true;
RULE_MARKERS[C_DASH] = true;

/*
 * A map of characters which can be used to mark
 * list-items.
 */

var LIST_UNORDERED_MARKERS = {};

LIST_UNORDERED_MARKERS[C_ASTERISK] = true;
LIST_UNORDERED_MARKERS[C_PLUS] = true;
LIST_UNORDERED_MARKERS[C_DASH] = true;

/*
 * A map of characters which can be used to mark
 * list-items after a digit.
 */

var LIST_ORDERED_MARKERS = {};

LIST_ORDERED_MARKERS[C_DOT] = true;

/*
 * A map of characters which can be used to mark
 * list-items after a digit.
 */

var LIST_ORDERED_COMMONMARK_MARKERS = {};

LIST_ORDERED_COMMONMARK_MARKERS[C_DOT] = true;
LIST_ORDERED_COMMONMARK_MARKERS[C_PAREN_CLOSE] = true;

/*
 * A map of characters, which can be used to mark link
 * and image titles.
 */

var LINK_TITLE_MARKERS = {};

LINK_TITLE_MARKERS[C_DOUBLE_QUOTE] = C_DOUBLE_QUOTE;
LINK_TITLE_MARKERS[C_SINGLE_QUOTE] = C_SINGLE_QUOTE;

/*
 * A map of characters, which can be used to mark link
 * and image titles in commonmark-mode.
 */

var COMMONMARK_LINK_TITLE_MARKERS = {};

COMMONMARK_LINK_TITLE_MARKERS[C_DOUBLE_QUOTE] = C_DOUBLE_QUOTE;
COMMONMARK_LINK_TITLE_MARKERS[C_SINGLE_QUOTE] = C_SINGLE_QUOTE;
COMMONMARK_LINK_TITLE_MARKERS[C_PAREN_OPEN] = C_PAREN_CLOSE;

/*
 * A map of characters which can be used to mark setext
 * headers, mapping to their corresponding depth.
 */

var SETEXT_MARKERS = {};

SETEXT_MARKERS[C_EQUALS] = 1;
SETEXT_MARKERS[C_DASH] = 2;

/*
 * A map of two functions which can create list items.
 */

var LIST_ITEM_MAP = {};

LIST_ITEM_MAP.true = renderPedanticListItem;
LIST_ITEM_MAP.false = renderNormalListItem;

/**
 * Check whether `character` is alphabetic.
 *
 * @param {string} character - Single character to check.
 * @return {boolean} - Whether or not `character` is
 *   alphabetic.
 */
function isAlphabetic(character) {
    var code = character.charCodeAt(0);

    return (code >= CC_A_LOWER && code <= CC_Z_LOWER) ||
        (code >= CC_A_UPPER && code <= CC_Z_UPPER);
}

/**
 * Check whether `character` is numeric.
 *
 * @param {string} character - Single character to check.
 * @return {boolean} - Whether or not `character` is
 *   numeric.
 */
function isNumeric(character) {
    var code = character.charCodeAt(0);

    return code >= CC_0 && code <= CC_9;
}

/**
 * Check whether `character` is a word character.
 *
 * @param {string} character - Single character to check.
 * @return {boolean} - Whether or not `character` is a
 *   word character.
 */
function isWordCharacter(character) {
    return character === C_UNDERSCORE ||
        isAlphabetic(character) ||
        isNumeric(character);
}

/**
 * Check whether `character` is white-space.
 *
 * @param {string} character - Single character to check.
 * @return {boolean} - Whether or not `character` is
 *   white-space.
 */
function isWhiteSpace(character) {
    return character === C_SPACE ||
        character === C_FORM_FEED ||
        character === C_NEWLINE ||
        character === C_CARRIAGE_RETURN ||
        character === C_TAB ||
        character === C_VERTICAL_TAB ||
        character === C_NO_BREAK_SPACE ||
        character === C_OGHAM_SPACE ||
        character === C_MONGOLIAN_VOWEL_SEPARATOR ||
        character === C_EN_QUAD ||
        character === C_EM_QUAD ||
        character === C_EN_SPACE ||
        character === C_EM_SPACE ||
        character === C_THREE_PER_EM_SPACE ||
        character === C_FOUR_PER_EM_SPACE ||
        character === C_SIX_PER_EM_SPACE ||
        character === C_FIGURE_SPACE ||
        character === C_PUNCTUATION_SPACE ||
        character === C_THIN_SPACE ||
        character === C_HAIR_SPACE ||
        character === C_LINE_SEPARATOR ||
        character === C_PARAGRAPH_SEPARATOR ||
        character === C_NARROW_NO_BREAK_SPACE ||
        character === C_IDEOGRAPHIC_SPACE ||
        character === C_ZERO_WIDTH_NO_BREAK_SPACE;
}

/**
 * Check whether `character` can be inside an unquoted
 * attribute value.
 *
 * @param {string} character - Single character to check.
 * @return {boolean} - Whether or not `character` can be
 *   inside an unquoted attribute value.
 */
function isUnquotedAttributeCharacter(character) {
    return character !== C_DOUBLE_QUOTE &&
        character !== C_SINGLE_QUOTE &&
        character !== C_EQUALS &&
        character !== C_LT &&
        character !== C_GT &&
        character !== C_TICK;
}

/**
 * Check whether `character` can be inside a double-quoted
 * attribute value.
 *
 * @property {string} delimiter - Closing delimiter.
 * @param {string} character - Single character to check.
 * @return {boolean} - Whether or not `character` can be
 *   inside a double-quoted attribute value.
 */
function isDoubleQuotedAttributeCharacter(character) {
    return character !== C_DOUBLE_QUOTE;
}

isDoubleQuotedAttributeCharacter.delimiter = C_DOUBLE_QUOTE;

/**
 * Check whether `character` can be inside a single-quoted
 * attribute value.
 *
 * @property {string} delimiter - Closing delimiter.
 * @param {string} character - Single character to check.
 * @return {boolean} - Whether or not `character` can be
 *   inside a single-quoted attribute value.
 */
function isSingleQuotedAttributeCharacter(character) {
    return character !== C_SINGLE_QUOTE;
}

isSingleQuotedAttributeCharacter.delimiter = C_SINGLE_QUOTE;

/**
 * Check whether `character` can be inside an enclosed
 * URI.
 *
 * @property {string} delimiter - Closing delimiter.
 * @param {string} character - Character to test.
 * @return {boolean} - Whether or not `character` can be
 *   inside an enclosed URI.
 */
function isEnclosedURLCharacter(character) {
    return character !== C_GT &&
        character !== C_BRACKET_OPEN &&
        character !== C_BRACKET_CLOSE;
}

isEnclosedURLCharacter.delimiter = C_GT;

/**
 * Check whether `character` can be inside an unclosed
 * URI.
 *
 * @param {string} character - Character to test.
 * @return {boolean} - Whether or not `character` can be
 *   inside an unclosed URI.
 */
function isUnclosedURLCharacter(character) {
    return character !== C_BRACKET_OPEN &&
        character !== C_BRACKET_CLOSE &&
        !isWhiteSpace(character);
}

/**
 * Factory to create an entity decoder.
 *
 * @param {Object} context - Context to attach to, e.g.,
 *   a parser.
 * @return {Function} - See `decode`.
 */
function decodeFactory(context) {
    /**
     * Normalize `position` to add an `indent`.
     *
     * @param {Position} position - Reference
     * @return {Position} - Augmented with `indent`.
     */
    function normalize(position) {
        return {
            'start': position,
            'indent': context.getIndent(position.line)
        };
    }

    /**
     * Handle a warning.
     *
     * @this {VFile} - Virtual file.
     * @param {string} reason - Reason for warning.
     * @param {Position} position - Place of warning.
     * @param {number} code - Code for warning.
     */
    function handleWarning(reason, position, code) {
        if (code === 3) {
            return;
        }

        context.file.warn(reason, position);
    }

    /**
     * Decode `value` (at `position`) into text-nodes.
     *
     * @param {string} value - Value to parse.
     * @param {Position} position - Position to start parsing at.
     * @param {Function} handler - Node handler.
     */
    function decoder(value, position, handler) {
        var hasPosition = context.options.position;

        decode(value, {
            'position': position && normalize(position),
            'warning': hasPosition && handleWarning,
            'text': handler,
            'reference': handler,
            'textContext': context,
            'referenceContext': context
        });
    }

    /**
     * Decode `value` (at `position`) into a string.
     *
     * @param {string} value - Value to parse.
     * @param {Position} position - Position to start
     *   parsing at.
     * @return {string} - Plain-text.
     */
    function decodeRaw(value, position) {
        return decode(value, {
            'position': position && normalize(position),
            'warning': context.options.position && handleWarning
        });
    }

    decoder.raw = decodeRaw;

    return decoder;
}

/**
 * Factory to de-escape a value, based on a list at `key`
 * in `scope`.
 *
 * @example
 *   var scope = {escape: ['a']}
 *   var descape = descapeFactory(scope, 'escape');
 *
 * @param {Object} scope - List of escapable characters.
 * @param {string} key - Key in `map` at which the list
 *   exists.
 * @return {function(string): string} - Function which
 *   takes a value and returns its unescaped version.
 */
function descapeFactory(scope, key) {
    /**
     * De-escape a string using the expression at `key`
     * in `scope`.
     *
     * @example
     *   var scope = {escape: ['a']}
     *   var descape = descapeFactory(scope, 'escape');
     *   descape('\a \b'); // 'a \b'
     *
     * @param {string} value - Escaped string.
     * @return {string} - Unescaped string.
     */
    function descape(value) {
        var prev = 0;
        var index = value.indexOf(C_BACKSLASH);
        var escape = scope[key];
        var queue = [];
        var character;

        while (index !== -1) {
            queue.push(value.slice(prev, index));
            prev = index + 1;
            character = value.charAt(prev);

            /*
             * If the following character is not a valid escape,
             * add the slash.
             */

            if (!character || escape.indexOf(character) === -1) {
                queue.push(C_BACKSLASH);
            }

            index = value.indexOf(C_BACKSLASH, prev);
        }

        queue.push(value.slice(prev));

        return queue.join(EMPTY);
    }

    return descape;
}

/**
 * Gets indentation information for a line.
 *
 * @example
 *   getIndent('  foo');
 *   // {indent: 2, stops: {1: 0, 2: 1}}
 *
 *   getIndent('\tfoo');
 *   // {indent: 4, stops: {4: 0}}
 *
 *   getIndent('  \tfoo');
 *   // {indent: 4, stops: {1: 0, 2: 1, 4: 2}}
 *
 *   getIndent('\t  foo')
 *   // {indent: 6, stops: {4: 0, 5: 1, 6: 2}}
 *
 * @param {string} value - Indented line.
 * @return {Object} - Indetation information.
 */
function getIndent(value) {
    var index = 0;
    var indent = 0;
    var character = value.charAt(index);
    var stops = {};
    var size;

    while (character in INDENTATION_CHARACTERS) {
        size = INDENTATION_CHARACTERS[character];

        indent += size;

        if (size > 1) {
            indent = Math.floor(indent / size) * size;
        }

        stops[indent] = index;

        character = value.charAt(++index);
    }

    return {
        'indent': indent,
        'stops': stops
    };
}

/**
 * Remove the minimum indent from every line in `value`.
 * Supports both tab, spaced, and mixed indentation (as
 * well as possible).
 *
 * @example
 *   removeIndentation('  foo'); // 'foo'
 *   removeIndentation('    foo', 2); // '  foo'
 *   removeIndentation('\tfoo', 2); // '  foo'
 *   removeIndentation('  foo\n bar'); // ' foo\n bar'
 *
 * @param {string} value - Value to trim.
 * @param {number?} [maximum] - Maximum indentation
 *   to remove.
 * @return {string} - Unindented `value`.
 */
function removeIndentation(value, maximum) {
    var values = value.split(C_NEWLINE);
    var position = values.length + 1;
    var minIndent = Infinity;
    var matrix = [];
    var index;
    var indentation;
    var stops;
    var padding;

    values.unshift(repeat(C_SPACE, maximum) + C_EXCLAMATION_MARK);

    while (position--) {
        indentation = getIndent(values[position]);

        matrix[position] = indentation.stops;

        if (trim(values[position]).length === 0) {
            continue;
        }

        if (indentation.indent) {
            if (indentation.indent > 0 && indentation.indent < minIndent) {
                minIndent = indentation.indent;
            }
        } else {
            minIndent = Infinity;

            break;
        }
    }

    if (minIndent !== Infinity) {
        position = values.length;

        while (position--) {
            stops = matrix[position];
            index = minIndent;

            while (index && !(index in stops)) {
                index--;
            }

            if (
                trim(values[position]).length !== 0 &&
                minIndent &&
                index !== minIndent
            ) {
                padding = C_TAB;
            } else {
                padding = EMPTY;
            }

            values[position] = padding + values[position].slice(
                index in stops ? stops[index] + 1 : 0
            );
        }
    }

    values.shift();

    return values.join(C_NEWLINE);
}

/**
 * Tokenise a line.
 *
 * @example
 *   tokenizeNewline(eat, '\n\n');
 *
 * @param {function(string)} eat - Eater.
 * @param {string} value - Rest of content.
 * @param {boolean?} [silent] - Whether this is a dry run.
 * @return {boolean?} - `true` when matching.
 */
function tokenizeNewline(eat, value, silent) {
    var character = value.charAt(0);
    var length;
    var subvalue;
    var queue;
    var index;

    if (character !== C_NEWLINE) {
        return;
    }

    /* istanbul ignore if - never used (yet) */
    if (silent) {
        return true;
    }

    index = 1;
    length = value.length;
    subvalue = C_NEWLINE;
    queue = EMPTY;

    while (index < length) {
        character = value.charAt(index);

        if (!isWhiteSpace(character)) {
            break;
        }

        queue += character;

        if (character === C_NEWLINE) {
            subvalue += queue;
            queue = EMPTY;
        }

        index++;
    }

    eat(subvalue);
}

/**
 * Tokenise an indented code block.
 *
 * @example
 *   tokenizeCode(eat, '\tfoo');
 *
 * @param {function(string)} eat - Eater.
 * @param {string} value - Rest of content.
 * @param {boolean?} [silent] - Whether this is a dry run.
 * @return {Node?|boolean} - `code` node.
 */
function tokenizeCode(eat, value, silent) {
    var self = this;
    var index = -1;
    var length = value.length;
    var character;
    var subvalue = EMPTY;
    var content = EMPTY;
    var subvalueQueue = EMPTY;
    var contentQueue = EMPTY;
    var blankQueue;
    var indent;

    while (++index < length) {
        character = value.charAt(index);

        if (indent) {
            indent = false;

            subvalue += subvalueQueue;
            content += contentQueue;
            subvalueQueue = contentQueue = EMPTY;

            if (character === C_NEWLINE) {
                subvalueQueue = contentQueue = character;
            } else {
                subvalue += character;
                content += character;

                while (++index < length) {
                    character = value.charAt(index);

                    if (!character || character === C_NEWLINE) {
                        contentQueue = subvalueQueue = character;
                        break;
                    }

                    subvalue += character;
                    content += character;
                }
            }
        } else if (
            character === C_SPACE &&
            value.charAt(index + 1) === C_SPACE &&
            value.charAt(index + 2) === C_SPACE &&
            value.charAt(index + 3) === C_SPACE
        ) {
            subvalueQueue += CODE_INDENT;
            index += 3;
            indent = true;
        } else if (character === C_TAB) {
            subvalueQueue += character;
            indent = true;
        } else {
            blankQueue = EMPTY;

            while (character === C_TAB || character === C_SPACE) {
                blankQueue += character;
                character = value.charAt(++index);
            }

            if (character !== C_NEWLINE) {
                break;
            }

            subvalueQueue += blankQueue + character;
            contentQueue += character;
        }
    }

    if (content) {
        if (silent) {
            return true;
        }

        return eat(subvalue)(self.renderCodeBlock(content));
    }
}

/**
 * Tokenise a fenced code block.
 *
 * @example
 *   tokenizeFences(eat, '```js\nfoo()\n```');
 *
 * @param {function(string)} eat - Eater.
 * @param {string} value - Rest of content.
 * @param {boolean?} [silent] - Whether this is a dry run.
 * @return {Node?|boolean} - `code` node.
 */
function tokenizeFences(eat, value, silent) {
    var self = this;
    var settings = self.options;
    var length = value.length + 1;
    var index = 0;
    var subvalue = EMPTY;
    var fenceCount;
    var marker;
    var character;
    var flag;
    var queue;
    var content;
    var exdentedContent;
    var closing;
    var exdentedClosing;
    var indent;
    var now;

    if (!settings.gfm) {
        return;
    }

    /*
     * Eat initial spacing.
     */

    while (index < length) {
        character = value.charAt(index);

        if (character !== C_SPACE && character !== C_TAB) {
            break;
        }

        subvalue += character;
        index++;
    }

    indent = index; // TODO: CHECK.

    /*
     * Eat the fence.
     */

    character = value.charAt(index);

    if (character !== C_TILDE && character !== C_TICK) {
        return;
    }

    index++;
    marker = character;
    fenceCount = 1;
    subvalue += character;

    while (index < length) {
        character = value.charAt(index);

        if (character !== marker) {
            break;
        }

        subvalue += character;
        fenceCount++;
        index++;
    }

    if (fenceCount < MIN_FENCE_COUNT) {
        return;
    }

    /*
     * Eat spacing before flag.
     */

    while (index < length) {
        character = value.charAt(index);

        if (character !== C_SPACE && character !== C_TAB) {
            break;
        }

        subvalue += character;
        index++;
    }

    /*
     * Eat flag.
     */

    flag = queue = EMPTY;

    while (index < length) {
        character = value.charAt(index);

        if (
            character === C_NEWLINE ||
            character === C_TILDE ||
            character === C_TICK
        ) {
            break;
        }

        if (character === C_SPACE || character === C_TAB) {
            queue += character;
        } else {
            flag += queue + character;
            queue = EMPTY;
        }

        index++;
    }

    character = value.charAt(index);

    if (character && character !== C_NEWLINE) {
        return;
    }

    if (silent) {
        return true;
    }

    now = eat.now();
    now.column += subvalue.length;

    subvalue += flag;
    flag = self.decode.raw(self.descape(flag), now);

    if (queue) {
        subvalue += queue;
    }

    queue = closing = exdentedClosing = content = exdentedContent = EMPTY;

    /*
     * Eat content.
     */

    while (index < length) {
        character = value.charAt(index);
        content += closing;
        exdentedContent += exdentedClosing;
        closing = exdentedClosing = EMPTY;

        if (character !== C_NEWLINE) {
            content += character;
            exdentedClosing += character;
            index++;
            continue;
        }

        /*
         * Add the newline to `subvalue` if its the first
         * character. Otherwise, add it to the `closing`
         * queue.
         */

        if (!content) {
            subvalue += character;
        } else {
            closing += character;
            exdentedClosing += character;
        }

        queue = EMPTY;
        index++;

        while (index < length) {
            character = value.charAt(index);

            if (character !== C_SPACE) {
                break;
            }

            queue += character;
            index++;
        }

        closing += queue;
        exdentedClosing += queue.slice(indent);

        if (queue.length >= CODE_INDENT_LENGTH) {
            continue;
        }

        queue = EMPTY;

        while (index < length) {
            character = value.charAt(index);

            if (character !== marker) {
                break;
            }

            queue += character;
            index++;
        }

        closing += queue;
        exdentedClosing += queue;

        if (queue.length < fenceCount) {
            continue;
        }

        queue = EMPTY;

        while (index < length) {
            character = value.charAt(index);

            if (character !== C_SPACE && character !== C_TAB) {
                break;
            }

            closing += character;
            exdentedClosing += character;
            index++;
        }

        if (!character || character === C_NEWLINE) {
            break;
        }
    }

    subvalue += content + closing;

    return eat(subvalue)(self.renderCodeBlock(exdentedContent, flag));
}

/**
 * Tokenise an ATX-style heading.
 *
 * @example
 *   tokenizeHeading(eat, ' # foo');
 *
 * @param {function(string)} eat - Eater.
 * @param {string} value - Rest of content.
 * @param {boolean?} [silent] - Whether this is a dry run.
 * @return {Node?|boolean} - `heading` node.
 */
function tokenizeHeading(eat, value, silent) {
    var self = this;
    var settings = self.options;
    var length = value.length + 1;
    var index = -1;
    var now = eat.now();
    var subvalue = EMPTY;
    var content = EMPTY;
    var character;
    var queue;
    var depth;

    /*
     * Eat initial spacing.
     */

    while (++index < length) {
        character = value.charAt(index);

        if (character !== C_SPACE && character !== C_TAB) {
            index--;
            break;
        }

        subvalue += character;
    }

    /*
     * Eat hashes.
     */

    depth = 0;
    length = index + MAX_ATX_COUNT + 1;

    while (++index <= length) {
        character = value.charAt(index);

        if (character !== C_HASH) {
            index--;
            break;
        }

        subvalue += character;
        depth++;
    }

    if (
        !depth ||
        (!settings.pedantic && value.charAt(index + 1) === C_HASH)
    ) {
        return;
    }

    length = value.length + 1;

    /*
     * Eat intermediate white-space.
     */

    queue = EMPTY;

    while (++index < length) {
        character = value.charAt(index);

        if (character !== C_SPACE && character !== C_TAB) {
            index--;
            break;
        }

        queue += character;
    }

    /*
     * Exit when not in pedantic mode without spacing.
     */

    if (
        !settings.pedantic &&
        !queue.length &&
        character &&
        character !== C_NEWLINE
    ) {
        return;
    }

    if (silent) {
        return true;
    }

    /*
     * Eat content.
     */

    subvalue += queue;
    queue = content = EMPTY;

    while (++index < length) {
        character = value.charAt(index);

        if (!character || character === C_NEWLINE) {
            break;
        }

        if (
            character !== C_SPACE &&
            character !== C_TAB &&
            character !== C_HASH
        ) {
            content += queue + character;
            queue = EMPTY;
            continue;
        }

        while (character === C_SPACE || character === C_TAB) {
            queue += character;
            character = value.charAt(++index);
        }

        while (character === C_HASH) {
            queue += character;
            character = value.charAt(++index);
        }

        while (character === C_SPACE || character === C_TAB) {
            queue += character;
            character = value.charAt(++index);
        }

        index--;
    }

    now.column += subvalue.length;
    subvalue += content + queue;

    return eat(subvalue)(self.renderHeading(content, depth, now));
}

/**
 * Tokenise a Setext-style heading.
 *
 * @example
 *   tokenizeLineHeading(eat, 'foo\n===');
 *
 * @param {function(string)} eat - Eater.
 * @param {string} value - Rest of content.
 * @param {boolean?} [silent] - Whether this is a dry run.
 * @return {Node?|boolean} - `heading` node.
 */
function tokenizeLineHeading(eat, value, silent) {
    var self = this;
    var now = eat.now();
    var length = value.length;
    var index = -1;
    var subvalue = EMPTY;
    var content;
    var queue;
    var character;
    var marker;
    var depth;

    /*
     * Eat initial indentation.
     */

    while (++index < length) {
        character = value.charAt(index);

        if (character !== C_SPACE || index >= MAX_LINE_HEADING_INDENT) {
            index--;
            break;
        }

        subvalue += character;
    }

    /*
     * Eat content.
     */

    content = queue = EMPTY;

    while (++index < length) {
        character = value.charAt(index);

        if (character === C_NEWLINE) {
            index--;
            break;
        }

        if (character === C_SPACE || character === C_TAB) {
            queue += character;
        } else {
            content += queue + character;
            queue = EMPTY;
        }
    }

    now.column += subvalue.length;
    subvalue += content + queue;

    /*
     * Ensure the content is followed by a newline and a
     * valid marker.
     */

    character = value.charAt(++index);
    marker = value.charAt(++index);

    if (
        character !== C_NEWLINE ||
        !SETEXT_MARKERS[marker]
    ) {
        return;
    }

    if (silent) {
        return true;
    }

    subvalue += character;

    /*
     * Eat Setext-line.
     */

    queue = marker;
    depth = SETEXT_MARKERS[marker];

    while (++index < length) {
        character = value.charAt(index);

        if (character !== marker) {
            if (character !== C_NEWLINE) {
                return;
            }

            index--;
            break;
        }

        queue += character;
    }

    return eat(subvalue + queue)(self.renderHeading(content, depth, now));
}

/**
 * Tokenise a horizontal rule.
 *
 * @example
 *   tokenizeHorizontalRule(eat, '***');
 *
 * @param {function(string)} eat - Eater.
 * @param {string} value - Rest of content.
 * @param {boolean?} [silent] - Whether this is a dry run.
 * @return {Node?|boolean} - `horizontalRule` node.
 */
function tokenizeHorizontalRule(eat, value, silent) {
    var self = this;
    var index = -1;
    var length = value.length + 1;
    var subvalue = EMPTY;
    var character;
    var marker;
    var markerCount;
    var queue;

    while (++index < length) {
        character = value.charAt(index);

        if (character !== C_TAB && character !== C_SPACE) {
            break;
        }

        subvalue += character;
    }

    if (RULE_MARKERS[character] !== true) {
        return;
    }

    marker = character;
    subvalue += character;
    markerCount = 1;
    queue = EMPTY;

    while (++index < length) {
        character = value.charAt(index);

        if (character === marker) {
            markerCount++;
            subvalue += queue + marker;
            queue = EMPTY;
        } else if (character === C_SPACE) {
            queue += character;
        } else if (
            markerCount >= HORIZONTAL_RULE_MARKER_COUNT &&
            (!character || character === C_NEWLINE)
        ) {
            subvalue += queue;

            if (silent) {
                return true;
            }

            return eat(subvalue)(self.renderVoid(T_HORIZONTAL_RULE));
        } else {
            return;
        }
    }
}

/**
 * Tokenise a blockquote.
 *
 * @example
 *   tokenizeBlockquote(eat, '> Foo');
 *
 * @param {function(string)} eat - Eater.
 * @param {string} value - Rest of content.
 * @param {boolean?} [silent] - Whether this is a dry run.
 * @return {Node?|boolean} - `blockquote` node.
 */
function tokenizeBlockquote(eat, value, silent) {
    var self = this;
    var commonmark = self.options.commonmark;
    var now = eat.now();
    var indent = self.indent(now.line);
    var length = value.length;
    var values = [];
    var contents = [];
    var indents = [];
    var add;
    var tokenizers;
    var index = 0;
    var character;
    var rest;
    var nextIndex;
    var content;
    var line;
    var startIndex;
    var prefixed;

    while (index < length) {
        character = value.charAt(index);

        if (character !== C_SPACE && character !== C_TAB) {
            break;
        }

        index++;
    }

    if (value.charAt(index) !== C_GT) {
        return;
    }

    if (silent) {
        return true;
    }

    tokenizers = self.blockTokenizers;
    index = 0;

    while (index < length) {
        nextIndex = value.indexOf(C_NEWLINE, index);
        startIndex = index;
        prefixed = false;

        if (nextIndex === -1) {
            nextIndex = length;
        }

        while (index < length) {
            character = value.charAt(index);

            if (character !== C_SPACE && character !== C_TAB) {
                break;
            }

            index++;
        }

        if (value.charAt(index) === C_GT) {
            index++;
            prefixed = true;

            if (value.charAt(index) === C_SPACE) {
                index++;
            }
        } else {
            index = startIndex;
        }

        content = value.slice(index, nextIndex);

        if (!prefixed && !trim(content)) {
            index = startIndex;
            break;
        }

        if (!prefixed) {
            rest = value.slice(index);

            if (
                commonmark &&
                (
                    tokenizers.code.call(self, eat, rest, true) ||
                    tokenizers.fences.call(self, eat, rest, true) ||
                    tokenizers.heading.call(self, eat, rest, true) ||
                    tokenizers.lineHeading.call(self, eat, rest, true) ||
                    tokenizers.horizontalRule.call(self, eat, rest, true) ||
                    tokenizers.html.call(self, eat, rest, true) ||
                    tokenizers.list.call(self, eat, rest, true)
                )
            ) {
                break;
            }

            if (
                !commonmark &&
                (
                    tokenizers.definition.call(self, eat, rest, true) ||
                    tokenizers.footnoteDefinition.call(self, eat, rest, true)
                )
            ) {
                break;
            }
        }

        line = startIndex === index ?
            content :
            value.slice(startIndex, nextIndex);

        indents.push(index - startIndex);
        values.push(line);
        contents.push(content);

        index = nextIndex + 1;
    }

    index = -1;
    length = indents.length;
    add = eat(values.join(C_NEWLINE));

    while (++index < length) {
        indent(indents[index]);
    }

    return add(self.renderBlockquote(contents.join(C_NEWLINE), now));
}

/**
 * Tokenise a list.
 *
 * @example
 *   tokenizeList(eat, '- Foo');
 *
 * @param {function(string)} eat - Eater.
 * @param {string} value - Rest of content.
 * @param {boolean?} [silent] - Whether this is a dry run.
 * @return {Node?|boolean} - `list` node.
 */
function tokenizeList(eat, value, silent) {
    var self = this;
    var commonmark = self.options.commonmark;
    var pedantic = self.options.pedantic;
    var tokenizers = self.blockTokenizers;
    var markers;
    var index = 0;
    var length = value.length;
    var start = null;
    var queue;
    var ordered;
    var character;
    var marker;
    var nextIndex;
    var startIndex;
    var prefixed;
    var currentMarker;
    var content;
    var line;
    var prevEmpty;
    var empty;
    var items;
    var allLines;
    var emptyLines;
    var item;
    var enterTop;
    var exitBlockquote;
    var isLoose;
    var node;
    var now;
    var end;
    var indented;
    var size;

    while (index < length) {
        character = value.charAt(index);

        if (character !== C_SPACE && character !== C_TAB) {
            break;
        }

        index++;
    }

    character = value.charAt(index);

    markers = commonmark ?
        LIST_ORDERED_COMMONMARK_MARKERS :
        LIST_ORDERED_MARKERS;

    if (LIST_UNORDERED_MARKERS[character] === true) {
        marker = character;
        ordered = false;
    } else {
        ordered = true;
        queue = EMPTY;

        while (index < length) {
            character = value.charAt(index);

            if (!isNumeric(character)) {
                break;
            }

            queue += character;
            index++;
        }

        character = value.charAt(index);

        if (!queue || markers[character] !== true) {
            return;
        }

        start = parseInt(queue, 10);
        marker = character;
    }

    character = value.charAt(++index);

    if (character !== C_SPACE && character !== C_TAB) {
        return;
    }

    if (silent) {
        return true;
    }

    index = 0;
    items = [];
    allLines = [];
    emptyLines = [];

    while (index < length) {
        nextIndex = value.indexOf(C_NEWLINE, index);
        startIndex = index;
        prefixed = false;
        indented = false;

        if (nextIndex === -1) {
            nextIndex = length;
        }

        end = index + TAB_SIZE;
        size = 0;

        while (index < length) {
            character = value.charAt(index);

            if (character === C_TAB) {
                size += TAB_SIZE - size % TAB_SIZE;
            } else if (character === C_SPACE) {
                size++;
            } else {
                break;
            }

            index++;
        }

        if (size >= TAB_SIZE) {
            indented = true;
        }

        if (item && size >= item.indent) {
            indented = true;
        }

        character = value.charAt(index);
        currentMarker = null;

        if (!indented) {
            if (LIST_UNORDERED_MARKERS[character] === true) {
                currentMarker = character;
                index++;
                size++;
            } else {
                queue = EMPTY;

                while (index < length) {
                    character = value.charAt(index);

                    if (!isNumeric(character)) {
                        break;
                    }

                    queue += character;
                    index++;
                }

                character = value.charAt(index);
                index++;

                if (queue && markers[character] === true) {
                    currentMarker = character;
                    size += queue.length + 1;
                }
            }

            if (currentMarker) {
                character = value.charAt(index);

                if (character === C_TAB) {
                    size += TAB_SIZE - size % TAB_SIZE;
                    index++;
                } else if (character === C_SPACE) {
                    end = index + TAB_SIZE;

                    while (index < end) {
                        if (value.charAt(index) !== C_SPACE) {
                            break;
                        }

                        index++;
                        size++;
                    }

                    if (index === end && value.charAt(index) === C_SPACE) {
                        index -= TAB_SIZE - 1;
                        size -= TAB_SIZE - 1;
                    }
                } else if (
                    character !== C_NEWLINE &&
                    character !== EMPTY
                ) {
                    currentMarker = null;
                }
            }
        }

        if (currentMarker) {
            if (commonmark && marker !== currentMarker) {
                break;
            }

            prefixed = true;
        } else {
            if (
                !commonmark &&
                !indented &&
                value.charAt(startIndex) === C_SPACE
            ) {
                indented = true;
            } else if (
                commonmark &&
                item
            ) {
                indented = size >= item.indent || size > TAB_SIZE;
            }

            prefixed = false;
            index = startIndex;
        }

        line = value.slice(startIndex, nextIndex);
        content = startIndex === index ? line : value.slice(index, nextIndex);

        if (currentMarker && RULE_MARKERS[currentMarker] === true) {
            if (
                tokenizers.horizontalRule.call(self, eat, line, true)
            ) {
                break;
            }
        }

        prevEmpty = empty;
        empty = !trim(content).length;

        if (indented && item) {
            item.value = item.value.concat(emptyLines, line);
            allLines = allLines.concat(emptyLines, line);
            emptyLines = [];
        } else if (prefixed) {
            if (emptyLines.length) {
                item.value.push(EMPTY);
                item.trail = emptyLines.concat();
            }

            item = {
                // 'bullet': value.slice(startIndex, index),
                'value': [line],
                'indent': size,
                'trail': []
            };

            items.push(item);
            allLines = allLines.concat(emptyLines, line);
            emptyLines = [];
        } else if (empty) {
            // TODO: disable when in pedantic-mode.
            if (prevEmpty) {
                break;
            }

            emptyLines.push(line);
        } else {
            if (prevEmpty) {
                break;
            }

            if (
                !pedantic &&
                tokenizers.horizontalRule.call(self, eat, line, true)
            ) {
                break;
            }

            if (!commonmark) {
                if (
                    tokenizers.definition.call(self, eat, line, true) ||
                    tokenizers.footnoteDefinition.call(self, eat, line, true)
                ) {
                    break;
                }
            }

            item.value = item.value.concat(emptyLines, line);
            allLines = allLines.concat(emptyLines, line);
            emptyLines = [];
        }

        index = nextIndex + 1;
    }

    node = eat(allLines.join(C_NEWLINE)).reset({
        'type': T_LIST,
        'ordered': ordered,
        'start': start,
        'loose': null,
        'children': []
    });

    enterTop = self.exitTop();
    exitBlockquote = self.enterBlockquote();
    isLoose = false;
    index = -1;
    length = items.length;

    while (++index < length) {
        item = items[index].value.join(C_NEWLINE);
        now = eat.now();

        item = eat(item)(self.renderListItem(item, now), node);

        if (item.loose) {
            isLoose = true;
        }

        item = items[index].trail.join(C_NEWLINE);

        if (index !== length - 1) {
            item += C_NEWLINE;
        }

        eat(item);
    }

    enterTop();
    exitBlockquote();

    node.loose = isLoose;

    return node;
}

/**
 * Try to match comment.
 *
 * @param {string} value - Value to parse.
 * @param {Object} settings - Configuration as available on
 *   a parser.
 * @return {string?} - When applicable, the comment at the
 *   start of `value`.
 */
function eatHTMLComment(value, settings) {
    var index = COMMENT_START_LENGTH;
    var queue = COMMENT_START;
    var length = value.length;
    var commonmark = settings.commonmark;
    var character;
    var hasNonDash;

    if (value.slice(0, index) === queue) {
        while (index < length) {
            character = value.charAt(index);

            if (
                character === COMMENT_END_CHAR &&
                value.slice(index, index + COMMENT_END_LENGTH) === COMMENT_END
            ) {
                return queue + COMMENT_END;
            }

            if (commonmark) {
                if (character === C_GT && !hasNonDash) {
                    return;
                }

                if (character === C_DASH) {
                    if (value.charAt(index + 1) === C_DASH) {
                        return;
                    }
                } else {
                    hasNonDash = true;
                }
            }

            queue += character;
            index++;
        }
    }
}

/**
 * Try to match CDATA.
 *
 * @param {string} value - Value to parse.
 * @return {string?} - When applicable, the CDATA at the
 *   start of `value`.
 */
function eatHTMLCDATA(value) {
    var index = CDATA_START_LENGTH;
    var queue = value.slice(0, index);
    var length = value.length;
    var character;

    if (queue.toUpperCase() === CDATA_START) {
        while (index < length) {
            character = value.charAt(index);

            if (
                character === CDATA_END_CHAR &&
                value.slice(index, index + CDATA_END_LENGTH) === CDATA_END
            ) {
                return queue + CDATA_END;
            }

            queue += character;
            index++;
        }
    }
}

/**
 * Try to match a processing instruction.
 *
 * @param {string} value - Value to parse.
 * @return {string?} - When applicable, the processing
 *   instruction at the start of `value`.
 */
function eatHTMLProcessingInstruction(value) {
    var index = 0;
    var queue = EMPTY;
    var length = value.length;
    var character;

    if (
        value.charAt(index) === C_LT &&
        value.charAt(++index) === C_QUESTION_MARK
    ) {
        queue = C_LT + C_QUESTION_MARK;
        index++;

        while (index < length) {
            character = value.charAt(index);

            if (
                character === C_QUESTION_MARK &&
                value.charAt(index + 1) === C_GT
            ) {
                return queue + character + C_GT;
            }

            queue += character;
            index++;
        }
    }
}

/**
 * Try to match a declaration.
 *
 * @param {string} value - Value to parse.
 * @return {string?} - When applicable, the declaration at
 *   the start of `value`.
 */
function eatHTMLDeclaration(value) {
    var index = 0;
    var length = value.length;
    var queue = EMPTY;
    var subqueue = EMPTY;
    var character;

    if (
        value.charAt(index) === C_LT &&
        value.charAt(++index) === C_EXCLAMATION_MARK
    ) {
        queue = C_LT + C_EXCLAMATION_MARK;
        index++;

        /*
         * Eat as many alphabetic characters as
         * possible.
         */

        while (index < length) {
            character = value.charAt(index);

            if (!isAlphabetic(character)) {
                break;
            }

            subqueue += character;
            index++;
        }

        character = value.charAt(index);

        if (!subqueue || !isWhiteSpace(character)) {
            return;
        }

        queue += subqueue + character;
        index++;

        while (index < length) {
            character = value.charAt(index);

            if (character === C_GT) {
                return queue;
            }

            queue += character;
            index++;
        }
    }
}

/**
 * Try to match a closing tag.
 *
 * @param {string} value - Value to parse.
 * @param {boolean?} [isBlock] - Whether the tag-name
 *   must be a known block-level node to match.
 * @return {string?} - When applicable, the closing tag at
 *   the start of `value`.
 */
function eatHTMLClosingTag(value, isBlock) {
    var index = 0;
    var length = value.length;
    var queue = EMPTY;
    var subqueue = EMPTY;
    var character;

    if (
        value.charAt(index) === C_LT &&
        value.charAt(++index) === C_SLASH
    ) {
        queue = C_LT + C_SLASH;
        subqueue = character = value.charAt(++index);

        if (!isAlphabetic(character)) {
            return;
        }

        index++;

        /*
         * Eat as many alphabetic characters as
         * possible.
         */

        while (index < length) {
            character = value.charAt(index);

            if (!isAlphabetic(character) && !isNumeric(character)) {
                break;
            }

            subqueue += character;
            index++;
        }

        if (isBlock && blockElements.indexOf(subqueue.toLowerCase()) === -1) {
            return;
        }

        queue += subqueue;

        /*
         * Eat white-space.
         */

        while (index < length) {
            character = value.charAt(index);

            if (!isWhiteSpace(character)) {
                break;
            }

            queue += character;
            index++;
        }

        if (value.charAt(index) === C_GT) {
            return queue + C_GT;
        }
    }
}

/**
 * Try to match an opening tag.
 *
 * @param {string} value - Value to parse.
 * @param {boolean?} [isBlock] - Whether the tag-name
 *   must be a known block-level node to match.
 * @return {string?} - When applicable, the opening tag at
 *   the start of `value`.
 */
function eatHTMLOpeningTag(value, isBlock) {
    var index = 0;
    var length = value.length;
    var queue = EMPTY;
    var subqueue = EMPTY;
    var character = value.charAt(index);
    var hasEquals;
    var test;

    if (character === C_LT) {
        queue = character;
        subqueue = character = value.charAt(++index);

        if (!isAlphabetic(character)) {
            return;
        }

        index++;

        /*
         * Eat as many alphabetic characters as
         * possible.
         */

        while (index < length) {
            character = value.charAt(index);

            if (!isAlphabetic(character) && !isNumeric(character)) {
                break;
            }

            subqueue += character;
            index++;
        }

        if (isBlock && blockElements.indexOf(subqueue.toLowerCase()) === -1) {
            return;
        }

        queue += subqueue;
        subqueue = EMPTY;

        /*
         * Find attributes.
         */

        while (index < length) {
            /*
             * Eat white-space.
             */

            while (index < length) {
                character = value.charAt(index);

                if (!isWhiteSpace(character)) {
                    break;
                }

                subqueue += character;
                index++;
            }

            if (!subqueue) {
                break;
            }

            /*
             * Eat an attribute name.
             */

            queue += subqueue;
            subqueue = EMPTY;
            character = value.charAt(index);

            if (
                isAlphabetic(character) ||
                character === C_UNDERSCORE ||
                character === C_COLON
            ) {
                subqueue = character;
                index++;

                while (index < length) {
                    character = value.charAt(index);

                    if (
                        !isAlphabetic(character) &&
                        !isNumeric(character) &&
                        character !== C_UNDERSCORE &&
                        character !== C_COLON &&
                        character !== C_DOT &&
                        character !== C_DASH
                    ) {
                        break;
                    }

                    subqueue += character;
                    index++;
                }
            }

            if (!subqueue) {
                break;
            }

            queue += subqueue;
            subqueue = EMPTY;
            hasEquals = false;

            /*
             * Eat zero or more white-space and one
             * equals sign.
             */

            while (index < length) {
                character = value.charAt(index);

                if (!isWhiteSpace(character)) {
                    if (!hasEquals && character === C_EQUALS) {
                        hasEquals = true;
                    } else {
                        break;
                    }
                }

                subqueue += character;
                index++;
            }

            queue += subqueue;
            subqueue = EMPTY;

            if (!hasEquals) {
                queue += subqueue;
            } else {
                character = value.charAt(index);
                queue += subqueue;

                if (character === C_DOUBLE_QUOTE) {
                    test = isDoubleQuotedAttributeCharacter;
                    subqueue = character;
                    index++;
                } else if (character === C_SINGLE_QUOTE) {
                    test = isSingleQuotedAttributeCharacter;
                    subqueue = character;
                    index++;
                } else {
                    test = isUnquotedAttributeCharacter;
                    subqueue = EMPTY;
                }

                while (index < length) {
                    character = value.charAt(index);

                    if (!test(character)) {
                        break;
                    }

                    subqueue += character;
                    index++;
                }

                character = value.charAt(index);
                index++;

                if (!test.delimiter) {
                    if (!subqueue.length) {
                        return;
                    }

                    index--;
                } else if (character === test.delimiter) {
                    subqueue += character;
                } else {
                    return;
                }

                queue += subqueue;
                subqueue = EMPTY;
            }
        }

        /*
         * More white-space is already eaten by the
         * attributes subroutine.
         */

        character = value.charAt(index);

        /*
         * Eat an optional backslash (for self-closing
         * tags).
         */

        if (character === C_SLASH) {
            queue += character;
            character = value.charAt(++index);
        }

        return character === C_GT ? queue + character : null;
    }
}

/**
 * Tokenise HTML.
 *
 * @example
 *   tokenizeHTML(eat, '<span>foo</span>');
 *
 * @param {function(string)} eat - Eater.
 * @param {string} value - Rest of content.
 * @param {boolean?} [silent] - Whether this is a dry run.
 * @return {Node?|boolean} - `html` node.
 */
function tokenizeHTML(eat, value, silent) {
    var self = this;
    var index = 0;
    var length = value.length;
    var subvalue = EMPTY;
    var offset;
    var lineCount;
    var character;
    var queue;

    /*
     * Eat initial spacing.
     */

    while (index < length) {
        character = value.charAt(index);

        if (character !== C_TAB && character !== C_SPACE) {
            break;
        }

        subvalue += character;
        index++;
    }

    offset = index;
    value = value.slice(offset);

    /*
     * Try to eat an HTML thing.
     */

    queue = eatHTMLComment(value, self.options) ||
        eatHTMLCDATA(value) ||
        eatHTMLProcessingInstruction(value) ||
        eatHTMLDeclaration(value) ||
        eatHTMLClosingTag(value, true) ||
        eatHTMLOpeningTag(value, true);

    if (!queue) {
        return;
    }

    if (silent) {
        return true;
    }

    subvalue += queue;
    index = subvalue.length - offset;
    queue = EMPTY;

    while (index < length) {
        character = value.charAt(index);

        if (character === C_NEWLINE) {
            queue += character;
            lineCount++;
        } else if (queue.length < MIN_CLOSING_HTML_NEWLINE_COUNT) {
            subvalue += queue + character;
            queue = EMPTY;
        } else {
            break;
        }

        index++;
    }

    return eat(subvalue)(self.renderRaw(T_HTML, subvalue));
}

/**
 * Tokenise a definition.
 *
 * @example
 *   var value = '[foo]: http://example.com "Example Domain"';
 *   tokenizeDefinition(eat, value);
 *
 * @property {boolean} onlyAtTop
 * @property {boolean} notInBlockquote
 * @param {function(string)} eat - Eater.
 * @param {string} value - Rest of content.
 * @param {boolean?} [silent] - Whether this is a dry run.
 * @return {Node?|boolean} - `definition` node.
 */
function tokenizeDefinition(eat, value, silent) {
    var self = this;
    var commonmark = self.options.commonmark;
    var index = 0;
    var length = value.length;
    var subvalue = EMPTY;
    var beforeURL;
    var beforeTitle;
    var queue;
    var character;
    var test;
    var identifier;
    var url;
    var title;

    while (index < length) {
        character = value.charAt(index);

        if (character !== C_SPACE && character !== C_TAB) {
            break;
        }

        subvalue += character;
        index++;
    }

    character = value.charAt(index);

    if (character !== C_BRACKET_OPEN) {
        return;
    }

    index++;
    subvalue += character;
    queue = EMPTY;

    while (index < length) {
        character = value.charAt(index);

        if (character === C_BRACKET_CLOSE) {
            break;
        } else if (character === C_BACKSLASH) {
            queue += character;
            index++;
            character = value.charAt(index);
        }

        queue += character;
        index++;
    }

    if (
        !queue ||
        value.charAt(index) !== C_BRACKET_CLOSE ||
        value.charAt(index + 1) !== C_COLON
    ) {
        return;
    }

    identifier = queue;
    subvalue += queue + C_BRACKET_CLOSE + C_COLON;
    index = subvalue.length;
    queue = EMPTY;

    while (index < length) {
        character = value.charAt(index);

        if (
            character !== C_TAB &&
            character !== C_SPACE &&
            character !== C_NEWLINE
        ) {
            break;
        }

        subvalue += character;
        index++;
    }

    character = value.charAt(index);
    queue = EMPTY;
    beforeURL = subvalue;

    if (character === C_LT) {
        index++;

        while (index < length) {
            character = value.charAt(index);

            if (!isEnclosedURLCharacter(character)) {
                break;
            }

            queue += character;
            index++;
        }

        character = value.charAt(index);

        if (character !== isEnclosedURLCharacter.delimiter) {
            if (commonmark) {
                return;
            }

            index -= queue.length + 1;
            queue = EMPTY;
        } else {
            subvalue += C_LT + queue + character;
            index++;
        }
    }

    if (!queue) {
        while (index < length) {
            character = value.charAt(index);

            if (!isUnclosedURLCharacter(character)) {
                break;
            }

            queue += character;
            index++;
        }

        subvalue += queue;
    }

    if (!queue) {
        return;
    }

    url = queue;
    queue = EMPTY;

    while (index < length) {
        character = value.charAt(index);

        if (
            character !== C_TAB &&
            character !== C_SPACE &&
            character !== C_NEWLINE
        ) {
            break;
        }

        queue += character;
        index++;
    }

    character = value.charAt(index);
    test = null;

    if (character === C_DOUBLE_QUOTE) {
        test = C_DOUBLE_QUOTE;
    } else if (character === C_SINGLE_QUOTE) {
        test = C_SINGLE_QUOTE;
    } else if (character === C_PAREN_OPEN) {
        test = C_PAREN_CLOSE;
    }

    if (!test) {
        queue = EMPTY;
        index = subvalue.length;
    } else if (!queue) {
        return;
    } else {
        subvalue += queue + character;
        index = subvalue.length;
        queue = EMPTY;

        while (index < length) {
            character = value.charAt(index);

            if (character === test) {
                break;
            }

            if (character === C_NEWLINE) {
                index++;
                character = value.charAt(index);

                if (character === C_NEWLINE || character === test) {
                    return;
                }

                queue += C_NEWLINE;
            }

            queue += character;
            index++;
        }

        character = value.charAt(index);

        if (character !== test) {
            return;
        }

        beforeTitle = subvalue;
        subvalue += queue + character;
        index++;
        title = queue;
        queue = EMPTY;
    }

    while (index < length) {
        character = value.charAt(index);

        if (character !== C_TAB && character !== C_SPACE) {
            break;
        }

        subvalue += character;
        index++;
    }

    character = value.charAt(index);

    if (!character || character === C_NEWLINE) {
        if (silent) {
            return true;
        }

        beforeURL = eat(beforeURL).test().end;
        url = self.decode.raw(self.descape(url), beforeURL);

        if (title) {
            beforeTitle = eat(beforeTitle).test().end;
            title = self.decode.raw(self.descape(title), beforeTitle);
        }

        return eat(subvalue)({
            'type': T_DEFINITION,
            'identifier': normalize(identifier),
            'title': title || null,
            'link': url
        });
    }
}

tokenizeDefinition.onlyAtTop = true;
tokenizeDefinition.notInBlockquote = true;

/**
 * Tokenise YAML front matter.
 *
 * @example
 *   tokenizeYAMLFrontMatter(eat, '---\nfoo: bar\n---');
 *
 * @property {boolean} onlyAtStart
 * @param {function(string)} eat - Eater.
 * @param {string} value - Rest of content.
 * @param {boolean?} [silent] - Whether this is a dry run.
 * @return {Node?|boolean} - `yaml` node.
 */
function tokenizeYAMLFrontMatter(eat, value, silent) {
    var self = this;
    var subvalue;
    var content;
    var index;
    var length;
    var character;
    var queue;

    if (
        !self.options.yaml ||
        value.charAt(0) !== C_DASH ||
        value.charAt(1) !== C_DASH ||
        value.charAt(2) !== C_DASH ||
        value.charAt(3) !== C_NEWLINE
    ) {
        return;
    }

    subvalue = YAML_FENCE + C_NEWLINE;
    content = queue = EMPTY;
    index = 3;
    length = value.length;

    while (++index < length) {
        character = value.charAt(index);

        if (
            character === C_DASH &&
            (queue || !content) &&
            value.charAt(index + 1) === C_DASH &&
            value.charAt(index + 2) === C_DASH
        ) {
            /* istanbul ignore if - never used (yet) */
            if (silent) {
                return true;
            }

            subvalue += queue + YAML_FENCE;

            return eat(subvalue)(self.renderRaw(T_YAML, content));
        }

        if (character === C_NEWLINE) {
            queue += character;
        } else {
            subvalue += queue + character;
            content += queue + character;
            queue = EMPTY;
        }
    }
}

tokenizeYAMLFrontMatter.onlyAtStart = true;

/**
 * Tokenise a footnote definition.
 *
 * @example
 *   tokenizeFootnoteDefinition(eat, '[^foo]: Bar.');
 *
 * @property {boolean} onlyAtTop
 * @property {boolean} notInBlockquote
 * @param {function(string)} eat - Eater.
 * @param {string} value - Rest of content.
 * @param {boolean?} [silent] - Whether this is a dry run.
 * @return {Node?|boolean} - `footnoteDefinition` node.
 */
function tokenizeFootnoteDefinition(eat, value, silent) {
    var self = this;
    var index;
    var length;
    var subvalue;
    var now;
    var indent;
    var content;
    var queue;
    var subqueue;
    var character;
    var identifier;

    if (!self.options.footnotes) {
        return;
    }

    index = 0;
    length = value.length;
    subvalue = EMPTY;
    now = eat.now();
    indent = self.indent(now.line);

    while (index < length) {
        character = value.charAt(index);

        if (!isWhiteSpace(character)) {
            break;
        }

        subvalue += character;
        index++;
    }

    if (
        value.charAt(index) !== C_BRACKET_OPEN ||
        value.charAt(index + 1) !== C_CARET
    ) {
        return;
    }

    subvalue += C_BRACKET_OPEN + C_CARET;
    index = subvalue.length;
    queue = EMPTY;

    while (index < length) {
        character = value.charAt(index);

        if (character === C_BRACKET_CLOSE) {
            break;
        } else if (character === C_BACKSLASH) {
            queue += character;
            index++;
            character = value.charAt(index);
        }

        queue += character;
        index++;
    }

    if (
        !queue ||
        value.charAt(index) !== C_BRACKET_CLOSE ||
        value.charAt(index + 1) !== C_COLON
    ) {
        return;
    }

    if (silent) {
        return true;
    }

    identifier = normalize(queue);
    subvalue += queue + C_BRACKET_CLOSE + C_COLON;
    index = subvalue.length;

    while (index < length) {
        character = value.charAt(index);

        if (
            character !== C_TAB &&
            character !== C_SPACE
        ) {
            break;
        }

        subvalue += character;
        index++;
    }

    now.column += subvalue.length;
    queue = content = subqueue = EMPTY;

    while (index < length) {
        character = value.charAt(index);

        if (character === C_NEWLINE) {
            subqueue = character;
            index++;

            while (index < length) {
                character = value.charAt(index);

                if (character !== C_NEWLINE) {
                    break;
                }

                subqueue += character;
                index++;
            }

            queue += subqueue;
            subqueue = EMPTY;

            while (index < length) {
                character = value.charAt(index);

                if (character !== C_SPACE) {
                    break;
                }

                subqueue += character;
                index++;
            }

            if (!subqueue.length) {
                break;
            }

            queue += subqueue;
        }

        if (queue) {
            content += queue;
            queue = EMPTY;
        }

        content += character;
        index++;
    }

    subvalue += content;

    content = content.replace(EXPRESSION_INITIAL_TAB, function (line) {
        indent(line.length);

        return EMPTY;
    });

    return eat(subvalue)(
        self.renderFootnoteDefinition(identifier, content, now)
    );
}

tokenizeFootnoteDefinition.onlyAtTop = true;
tokenizeFootnoteDefinition.notInBlockquote = true;

/**
 * Tokenise a table.
 *
 * @example
 *   tokenizeTable(eat, ' | foo |\n | --- |\n | bar |');
 *
 * @property {boolean} onlyAtTop
 * @param {function(string)} eat - Eater.
 * @param {string} value - Rest of content.
 * @param {boolean?} [silent] - Whether this is a dry run.
 * @return {Node?|boolean} - `table` node.
 */
function tokenizeTable(eat, value, silent) {
    var self = this;
    var index;
    var alignments;
    var alignment;
    var subvalue;
    var row;
    var length;
    var lines;
    var queue;
    var character;
    var hasDash;
    var align;
    var cell;
    var preamble;
    var count;
    var opening;
    var now;
    var position;
    var lineCount;
    var line;
    var rows;
    var table;
    var lineIndex;
    var pipeIndex;
    var first;

    /*
     * Exit when not in gfm-mode.
     */

    if (!self.options.gfm) {
        return;
    }

    /*
     * Get the rows.
     * Detecting tables soon is hard, so there are some
     * checks for performance here, such as the minimum
     * number of rows, and allowed characters in the
     * alignment row.
     */

    index = lineCount = 0;
    length = value.length + 1;
    lines = [];

    while (index < length) {
        lineIndex = value.indexOf(C_NEWLINE, index);
        pipeIndex = value.indexOf(C_PIPE, index + 1);

        if (lineIndex === -1) {
            lineIndex = value.length;
        }

        if (
            pipeIndex === -1 ||
            pipeIndex > lineIndex
        ) {
            if (lineCount < MIN_TABLE_ROWS) {
                return;
            }

            break;
        }

        lines.push(value.slice(index, lineIndex));
        lineCount++;
        index = lineIndex + 1;
    }

    /*
     * Parse the alignment row.
     */

    subvalue = lines.join(C_NEWLINE);
    alignments = lines.splice(1, 1)[0];
    index = 0;
    length = alignments.length;
    lineCount--;
    alignment = false;
    align = [];

    while (index < length) {
        character = alignments.charAt(index);

        if (character === C_PIPE) {
            hasDash = null;

            if (alignment === false) {
                if (first === false) {
                    return;
                }
            } else {
                align.push(alignment);
                alignment = false;
            }

            first = false;
        } else if (character === C_DASH) {
            hasDash = true;
            alignment = alignment || TABLE_ALIGN_NONE;
        } else if (character === C_COLON) {
            if (alignment === TABLE_ALIGN_LEFT) {
                alignment = TABLE_ALIGN_CENTER;
            } else if (hasDash && alignment === TABLE_ALIGN_NONE) {
                alignment = TABLE_ALIGN_RIGHT;
            } else {
                alignment = TABLE_ALIGN_LEFT;
            }
        } else if (!isWhiteSpace(character)) {
            return;
        }

        index++;
    }

    if (alignment !== false) {
        align.push(alignment);
    }

    /*
     * Exit when without enough columns.
     */

    if (align.length < MIN_TABLE_COLUMNS) {
        return;
    }

    /* istanbul ignore if - never used (yet) */
    if (silent) {
        return true;
    }

    /*
     * Parse the rows.
     */

    position = -1;
    rows = [];

    table = eat(subvalue).reset({
        'type': T_TABLE,
        'align': align,
        'children': rows
    });

    while (++position < lineCount) {
        line = lines[position];
        row = self.renderParent(position ? T_TABLE_ROW : T_TABLE_HEADER, []);

        /*
         * Eat a newline character when this is not the
         * first row.
         */

        if (position) {
            eat(C_NEWLINE);
        }

        /*
         * Eat the row.
         */

        eat(line).reset(row, table);

        length = line.length + 1;
        index = 0;
        queue = EMPTY;
        cell = EMPTY;
        preamble = true;
        count = opening = null;

        while (index < length) {
            character = line.charAt(index);

            if (character === C_TAB || character === C_SPACE) {
                if (cell) {
                    queue += character;
                } else {
                    eat(character);
                }

                index++;
                continue;
            }

            if (character === EMPTY || character === C_PIPE) {
                if (preamble) {
                    eat(character);
                } else {
                    if (character && opening) {
                        queue += character;
                        index++;
                        continue;
                    }

                    if ((cell || character) && !preamble) {
                        subvalue = cell;

                        if (queue.length > 1) {
                            if (character) {
                                subvalue += queue.slice(0, queue.length - 1);
                                queue = queue.charAt(queue.length - 1);
                            } else {
                                subvalue += queue;
                                queue = EMPTY;
                            }
                        }

                        now = eat.now();

                        eat(subvalue)(
                            self.renderInline(T_TABLE_CELL, cell, now), row
                        );
                    }

                    eat(queue + character);

                    queue = EMPTY;
                    cell = EMPTY;
                }
            } else {
                if (queue) {
                    cell += queue;
                    queue = EMPTY;
                }

                cell += character;

                if (character === C_BACKSLASH && index !== length - 2) {
                    cell += line.charAt(index + 1);
                    index++;
                }

                if (character === C_TICK) {
                    count = 1;

                    while (line.charAt(index + 1) === character) {
                        cell += character;
                        index++;
                        count++;
                    }

                    if (!opening) {
                        opening = count;
                    } else if (count >= opening) {
                        opening = 0;
                    }
                }
            }

            preamble = false;
            index++;
        }

        /*
         * Eat the alignment row.
         */

        if (!position) {
            eat(C_NEWLINE + alignments);
        }
    }

    return table;
}

tokenizeTable.onlyAtTop = true;

/**
 * Tokenise a paragraph node.
 *
 * @example
 *   tokenizeParagraph(eat, 'Foo.');
 *
 * @param {function(string)} eat - Eater.
 * @param {string} value - Rest of content.
 * @param {boolean?} [silent] - Whether this is a dry run.
 * @return {Node?|boolean} - `paragraph` node.
 */
function tokenizeParagraph(eat, value, silent) {
    var self = this;
    var settings = self.options;
    var commonmark = settings.commonmark;
    var gfm = settings.gfm;
    var tokenizers = self.blockTokenizers;
    var index = value.indexOf(C_NEWLINE);
    var length = value.length;
    var position;
    var subvalue;
    var character;
    var size;
    var now;

    while (index < length) {
        /*
         * Eat everything if there’s no following newline.
         */

        if (index === -1) {
            index = length;
            break;
        }

        /*
         * Stop if the next character is NEWLINE.
         */

        if (value.charAt(index + 1) === C_NEWLINE) {
            break;
        }

        /*
         * In commonmark-mode, following indented lines
         * are part of the paragraph.
         */

        if (commonmark) {
            size = 0;
            position = index + 1;

            while (position < length) {
                character = value.charAt(position);

                if (character === C_TAB) {
                    size = TAB_SIZE;
                    break;
                } else if (character === C_SPACE) {
                    size++;
                } else {
                    break;
                }

                position++;
            }

            if (size >= TAB_SIZE) {
                index = value.indexOf(C_NEWLINE, index + 1);
                continue;
            }
        }

        /*
         * Check if the following code contains a possible
         * block.
         */

        subvalue = value.slice(index + 1);

        if (
            tokenizers.horizontalRule.call(self, eat, subvalue, true) ||
            tokenizers.heading.call(self, eat, subvalue, true) ||
            tokenizers.fences.call(self, eat, subvalue, true) ||
            tokenizers.blockquote.call(self, eat, subvalue, true) ||
            tokenizers.html.call(self, eat, subvalue, true)
        ) {
            break;
        }

        if (gfm && tokenizers.list.call(self, eat, subvalue, true)) {
            break;
        }

        if (
            !commonmark &&
            (
                tokenizers.lineHeading.call(self, eat, subvalue, true) ||
                tokenizers.definition.call(self, eat, subvalue, true) ||
                tokenizers.footnoteDefinition.call(self, eat, subvalue, true)
            )
        ) {
            break;
        }

        index = value.indexOf(C_NEWLINE, index + 1);
    }

    subvalue = value.slice(0, index);

    if (trim(subvalue) === EMPTY) {
        eat(subvalue);

        return null;
    }

    /* istanbul ignore if - never used (yet) */
    if (silent) {
        return true;
    }

    now = eat.now();
    subvalue = trimTrailingLines(subvalue);

    return eat(subvalue)(self.renderInline(T_PARAGRAPH, subvalue, now));
}

/**
 * Tokenise a text node.
 *
 * @example
 *   tokenizeText(eat, 'foo');
 *
 * @param {function(string)} eat - Eater.
 * @param {string} value - Rest of content.
 * @param {boolean?} [silent] - Whether this is a dry run.
 * @return {Node?|boolean} - `text` node.
 */
function tokenizeText(eat, value, silent) {
    var self = this;
    var methods;
    var tokenizers;
    var index;
    var length;
    var subvalue;
    var position;
    var tokenizer;
    var name;
    var min;
    var now;

    /* istanbul ignore if - never used (yet) */
    if (silent) {
        return true;
    }

    methods = self.inlineMethods;
    length = methods.length;
    tokenizers = self.inlineTokenizers;
    index = -1;
    min = value.length;

    while (++index < length) {
        name = methods[index];

        if (name === 'inlineText' || !tokenizers[name]) {
            continue;
        }

        tokenizer = tokenizers[name].locator;

        if (!tokenizer) {
            eat.file.fail(ERR_MISSING_LOCATOR + C_TICK + name + C_TICK);
            continue;
        }

        position = tokenizer.call(self, value, 1);

        if (position !== -1 && position < min) {
            min = position;
        }
    }

    subvalue = value.slice(0, min);
    now = eat.now();

    self.decode(subvalue, now, function (content, position, source) {
        eat(source || content)(self.renderRaw(T_TEXT, content));
    });
}

/**
 * Create a code-block node.
 *
 * @example
 *   renderCodeBlock('foo()', 'js', now());
 *
 * @param {string?} [value] - Code.
 * @param {string?} [language] - Optional language flag.
 * @param {Function} eat - Eater.
 * @return {Object} - `code` node.
 */
function renderCodeBlock(value, language) {
    return {
        'type': T_CODE,
        'lang': language || null,
        'value': trimTrailingLines(value || EMPTY)
    };
}

/**
 * Create a list-item using overly simple mechanics.
 *
 * @example
 *   renderPedanticListItem('- _foo_', now());
 *
 * @param {string} value - List-item.
 * @param {Object} position - List-item location.
 * @return {string} - Cleaned `value`.
 */
function renderPedanticListItem(value, position) {
    var self = this;
    var indent = self.indent(position.line);

    /**
     * A simple replacer which removed all matches,
     * and adds their length to `offset`.
     *
     * @param {string} $0 - Indentation to subtract.
     * @return {string} - An empty string.
     */
    function replacer($0) {
        indent($0.length);

        return EMPTY;
    }

    /*
     * Remove the list-item’s bullet.
     */

    value = value.replace(EXPRESSION_PEDANTIC_BULLET, replacer);

    /*
     * The initial line was also matched by the below, so
     * we reset the `line`.
     */

    indent = self.indent(position.line);

    return value.replace(EXPRESSION_INITIAL_INDENT, replacer);
}

/**
 * Create a list-item using sane mechanics.
 *
 * @example
 *   renderNormalListItem('- _foo_', now());
 *
 * @param {string} value - List-item.
 * @param {Object} position - List-item location.
 * @return {string} - Cleaned `value`.
 */
function renderNormalListItem(value, position) {
    var self = this;
    var indent = self.indent(position.line);
    var max;
    var bullet;
    var rest;
    var lines;
    var trimmedLines;
    var index;
    var length;

    /*
     * Remove the list-item’s bullet.
     */

    value = value.replace(EXPRESSION_BULLET, function ($0, $1, $2, $3, $4) {
        bullet = $1 + $2 + $3;
        rest = $4;

        /*
         * Make sure that the first nine numbered list items
         * can indent with an extra space.  That is, when
         * the bullet did not receive an extra final space.
         */

        if (Number($2) < 10 && bullet.length % 2 === 1) {
            $2 = C_SPACE + $2;
        }

        max = $1 + repeat(C_SPACE, $2.length) + $3;

        return max + rest;
    });

    lines = value.split(C_NEWLINE);

    trimmedLines = removeIndentation(
        value, getIndent(max).indent
    ).split(C_NEWLINE);

    /*
     * We replaced the initial bullet with something
     * else above, which was used to trick
     * `removeIndentation` into removing some more
     * characters when possible. However, that could
     * result in the initial line to be stripped more
     * than it should be.
     */

    trimmedLines[0] = rest;

    indent(bullet.length);

    index = 0;
    length = lines.length;

    while (++index < length) {
        indent(lines[index].length - trimmedLines[index].length);
    }

    return trimmedLines.join(C_NEWLINE);
}

/**
 * Create a list-item node.
 *
 * @example
 *   renderListItem('- _foo_', now());
 *
 * @param {Object} value - List-item.
 * @param {Object} position - List-item location.
 * @return {Object} - `listItem` node.
 */
function renderListItem(value, position) {
    var self = this;
    var checked = null;
    var node;
    var task;
    var indent;

    value = LIST_ITEM_MAP[self.options.pedantic].apply(self, arguments);

    if (self.options.gfm) {
        task = value.match(EXPRESSION_TASK_ITEM);

        if (task) {
            indent = task[0].length;
            checked = task[1].toLowerCase() === C_X_LOWER;

            self.indent(position.line)(indent);
            value = value.slice(indent);
        }
    }

    node = {
        'type': T_LIST_ITEM,
        'loose': EXPRESSION_LOOSE_LIST_ITEM.test(value) ||
            value.charAt(value.length - 1) === C_NEWLINE
    };

    if (self.options.gfm) {
        node.checked = checked;
    }

    node.children = self.tokenizeBlock(value, position);

    return node;
}

/**
 * Create a footnote-definition node.
 *
 * @example
 *   renderFootnoteDefinition('1', '_foo_', now());
 *
 * @param {string} identifier - Unique reference.
 * @param {string} value - Contents
 * @param {Object} position - Definition location.
 * @return {Object} - `footnoteDefinition` node.
 */
function renderFootnoteDefinition(identifier, value, position) {
    var self = this;
    var exitBlockquote = self.enterBlockquote();
    var node;

    node = {
        'type': T_FOOTNOTE_DEFINITION,
        'identifier': identifier,
        'children': self.tokenizeBlock(value, position)
    };

    exitBlockquote();

    return node;
}

/**
 * Create a heading node.
 *
 * @example
 *   renderHeading('_foo_', 1, now());
 *
 * @param {string} value - Content.
 * @param {number} depth - Heading depth.
 * @param {Object} position - Heading content location.
 * @return {Object} - `heading` node
 */
function renderHeading(value, depth, position) {
    return {
        'type': T_HEADING,
        'depth': depth,
        'children': this.tokenizeInline(value, position)
    };
}

/**
 * Create a blockquote node.
 *
 * @example
 *   renderBlockquote('_foo_', eat);
 *
 * @param {string} value - Content.
 * @param {Object} now - Position.
 * @return {Object} - `blockquote` node.
 */
function renderBlockquote(value, now) {
    var self = this;
    var exitBlockquote = self.enterBlockquote();
    var node = {
        'type': T_BLOCKQUOTE,
        'children': self.tokenizeBlock(value, now)
    };

    exitBlockquote();

    return node;
}

/**
 * Create a void node.
 *
 * @example
 *   renderVoid('horizontalRule');
 *
 * @param {string} type - Node type.
 * @return {Object} - Node of type `type`.
 */
function renderVoid(type) {
    return {
        'type': type
    };
}

/**
 * Create a parent.
 *
 * @example
 *   renderParent('paragraph', '_foo_');
 *
 * @param {string} type - Node type.
 * @param {Array.<Object>} children - Child nodes.
 * @return {Object} - Node of type `type`.
 */
function renderParent(type, children) {
    return {
        'type': type,
        'children': children
    };
}

/**
 * Create a raw node.
 *
 * @example
 *   renderRaw('inlineCode', 'foo()');
 *
 * @param {string} type - Node type.
 * @param {string} value - Contents.
 * @return {Object} - Node of type `type`.
 */
function renderRaw(type, value) {
    return {
        'type': type,
        'value': value
    };
}

/**
 * Create a link node.
 *
 * @example
 *   renderLink(true, 'example.com', 'example', 'Example Domain', now(), eat);
 *   renderLink(false, 'fav.ico', 'example', 'Example Domain', now(), eat);
 *
 * @param {boolean} isLink - Whether linking to a document
 *   or an image.
 * @param {string} href - URI reference.
 * @param {string} text - Content.
 * @param {string?} title - Title.
 * @param {Object} position - Location of link.
 * @return {Object} - `link` or `image` node.
 */
function renderLink(isLink, href, text, title, position) {
    var self = this;
    var exitLink = self.enterLink();
    var node;

    node = {
        'type': isLink ? T_LINK : T_IMAGE,
        'title': title || null
    };

    if (isLink) {
        node.href = href;
        node.children = self.tokenizeInline(text, position);
    } else {
        node.src = href;
        node.alt = text ?
            self.decode.raw(self.descape(text), position) :
            null;
    }

    exitLink();

    return node;
}

/**
 * Create a footnote node.
 *
 * @example
 *   renderFootnote('_foo_', now());
 *
 * @param {string} value - Contents.
 * @param {Object} position - Location of footnote.
 * @return {Object} - `footnote` node.
 */
function renderFootnote(value, position) {
    return this.renderInline(T_FOOTNOTE, value, position);
}

/**
 * Add a node with inline content.
 *
 * @example
 *   renderInline('strong', '_foo_', now());
 *
 * @param {string} type - Node type.
 * @param {string} value - Contents.
 * @param {Object} position - Location of node.
 * @return {Object} - Node of type `type`.
 */
function renderInline(type, value, position) {
    return this.renderParent(type, this.tokenizeInline(value, position));
}

/**
 * Add a node with block content.
 *
 * @example
 *   renderBlock('blockquote', 'Foo.', now());
 *
 * @param {string} type - Node type.
 * @param {string} value - Contents.
 * @param {Object} position - Location of node.
 * @return {Object} - Node of type `type`.
 */
function renderBlock(type, value, position) {
    return this.renderParent(type, this.tokenizeBlock(value, position));
}

/**
 * Find a possible escape sequence.
 *
 * @example
 *   locateEscape('foo \- bar'); // 4
 *
 * @param {string} value - Value to search.
 * @param {number} fromIndex - Index to start searching at.
 * @return {number} - Location of possible escape sequence.
 */
function locateEscape(value, fromIndex) {
    return value.indexOf(C_BACKSLASH, fromIndex);
}

/**
 * Tokenise an escape sequence.
 *
 * @example
 *   tokenizeEscape(eat, '\\a');
 *
 * @property {Function} locator - Escape locator.
 * @param {function(string)} eat - Eater.
 * @param {string} value - Rest of content.
 * @param {boolean?} [silent] - Whether this is a dry run.
 * @return {Node?|boolean} - `text` or `break` node.
 */
function tokenizeEscape(eat, value, silent) {
    var self = this;
    var character;

    if (value.charAt(0) === C_BACKSLASH) {
        character = value.charAt(1);

        if (self.escape.indexOf(character) !== -1) {
            /* istanbul ignore if - never used (yet) */
            if (silent) {
                return true;
            }

            return eat(C_BACKSLASH + character)(
                character === C_NEWLINE ?
                    self.renderVoid(T_BREAK) :
                    self.renderRaw(T_TEXT, character)
            );
        }
    }
}

tokenizeEscape.locator = locateEscape;

/**
 * Find a possible auto-link.
 *
 * @example
 *   locateAutoLink('foo <bar'); // 4
 *
 * @param {string} value - Value to search.
 * @param {number} fromIndex - Index to start searching at.
 * @return {number} - Location of possible auto-link.
 */
function locateAutoLink(value, fromIndex) {
    return value.indexOf(C_LT, fromIndex);
}

/**
 * Tokenise a URL in carets.
 *
 * @example
 *   tokenizeAutoLink(eat, '<http://foo.bar>');
 *
 * @property {boolean} notInLink
 * @property {Function} locator - Auto-link locator.
 * @param {function(string)} eat - Eater.
 * @param {string} value - Rest of content.
 * @param {boolean?} [silent] - Whether this is a dry run.
 * @return {Node?|boolean} - `link` node.
 */
function tokenizeAutoLink(eat, value, silent) {
    var self;
    var subvalue;
    var length;
    var index;
    var queue;
    var character;
    var hasAtCharacter;
    var link;
    var now;
    var content;
    var tokenize;
    var node;

    if (value.charAt(0) !== C_LT) {
        return;
    }

    self = this;
    subvalue = EMPTY;
    length = value.length;
    index = 0;
    queue = EMPTY;
    hasAtCharacter = false;
    link = EMPTY;

    index++;
    subvalue = C_LT;

    while (index < length) {
        character = value.charAt(index);

        if (
            character === C_SPACE ||
            character === C_GT ||
            character === C_AT_SIGN ||
            (character === C_COLON && value.charAt(index + 1) === C_SLASH)
        ) {
            break;
        }

        queue += character;
        index++;
    }

    if (!queue) {
        return;
    }

    link += queue;
    queue = EMPTY;

    character = value.charAt(index);
    link += character;
    index++;

    if (character === C_AT_SIGN) {
        hasAtCharacter = true;
    } else {
        if (
            character !== C_COLON ||
            value.charAt(index + 1) !== C_SLASH
        ) {
            return;
        }

        link += C_SLASH;
        index++;
    }

    while (index < length) {
        character = value.charAt(index);

        if (character === C_SPACE || character === C_GT) {
            break;
        }

        queue += character;
        index++;
    }

    character = value.charAt(index);

    if (!queue || character !== C_GT) {
        return;
    }

    /* istanbul ignore if - never used (yet) */
    if (silent) {
        return true;
    }

    link += queue;
    content = link;
    subvalue += link + character;
    now = eat.now();
    now.column++;

    if (hasAtCharacter) {
        if (
            link.substr(0, MAILTO_PROTOCOL.length).toLowerCase() !==
            MAILTO_PROTOCOL
        ) {
            link = MAILTO_PROTOCOL + link;
        } else {
            content = content.substr(MAILTO_PROTOCOL.length);
            now.column += MAILTO_PROTOCOL.length;
        }
    }

    /*
     * Temporarily remove support for escapes in autolinks.
     */

    tokenize = self.inlineTokenizers.escape;
    self.inlineTokenizers.escape = null;

    node = eat(subvalue)(
        self.renderLink(true, decode(link), content, null, now, eat)
    );

    self.inlineTokenizers.escape = tokenize;

    return node;
}

tokenizeAutoLink.notInLink = true;
tokenizeAutoLink.locator = locateAutoLink;

/**
 * Find a possible URL.
 *
 * @example
 *   locateURL('foo http://bar'); // 4
 *
 * @param {string} value - Value to search.
 * @param {number} fromIndex - Index to start searching at.
 * @return {number} - Location of possible URL.
 */
function locateURL(value, fromIndex) {
    var index = -1;
    var min = -1;
    var position;

    if (!this.options.gfm) {
        return -1;
    }

    while (++index < PROTOCOLS_LENGTH) {
        position = value.indexOf(PROTOCOLS[index], fromIndex);

        if (position !== -1 && (position < min || min === -1)) {
            min = position;
        }
    }

    return min;
}

/**
 * Tokenise a URL in text.
 *
 * @example
 *   tokenizeURL(eat, 'http://foo.bar');
 *
 * @property {boolean} notInLink
 * @property {Function} locator - URL locator.
 * @param {function(string)} eat - Eater.
 * @param {string} value - Rest of content.
 * @param {boolean?} [silent] - Whether this is a dry run.
 * @return {Node?|boolean} - `link` node.
 */
function tokenizeURL(eat, value, silent) {
    var self = this;
    var subvalue;
    var content;
    var character;
    var index;
    var position;
    var protocol;
    var match;
    var length;
    var queue;
    var once;
    var now;

    if (!self.options.gfm) {
        return;
    }

    subvalue = EMPTY;
    index = -1;
    length = PROTOCOLS_LENGTH;

    while (++index < length) {
        protocol = PROTOCOLS[index];
        match = value.slice(0, protocol.length);

        if (match.toLowerCase() === protocol) {
            subvalue = match;
            break;
        }
    }

    if (!subvalue) {
        return;
    }

    index = subvalue.length;
    length = value.length;
    queue = EMPTY;

    while (index < length) {
        character = value.charAt(index);

        if (isWhiteSpace(character) || character === C_LT) {
            break;
        }

        if (
            character === C_DOT ||
            character === C_COMMA ||
            character === C_COLON ||
            character === C_SEMI_COLON ||
            character === C_DOUBLE_QUOTE ||
            character === C_SINGLE_QUOTE ||
            character === C_PAREN_CLOSE ||
            character === C_BRACKET_CLOSE
        ) {
            if (once) {
                break;
            }

            once = true;
        }

        queue += character;
        index++;
    }

    if (!queue) {
        return;
    }

    subvalue += queue;
    content = subvalue;

    if (protocol === MAILTO_PROTOCOL) {
        position = queue.indexOf(C_AT_SIGN);

        if (position === -1 || position === length - 1) {
            return;
        }

        content = content.substr(MAILTO_PROTOCOL.length);
    }

    /* istanbul ignore if - never used (yet) */
    if (silent) {
        return true;
    }

    now = eat.now();

    return eat(subvalue)(
        self.renderLink(true, decode(subvalue), content, null, now, eat)
    );
}

tokenizeURL.notInLink = true;
tokenizeURL.locator = locateURL;

/**
 * Find a possible tag.
 *
 * @example
 *   locateTag('foo <bar'); // 4
 *
 * @param {string} value - Value to search.
 * @param {number} fromIndex - Index to start searching at.
 * @return {number} - Location of possible tag.
 */
function locateTag(value, fromIndex) {
    return value.indexOf(C_LT, fromIndex);
}

/**
 * Tokenise an HTML tag.
 *
 * @example
 *   tokenizeTag(eat, '<span foo="bar">');
 *
 * @property {Function} locator - Tag locator.
 * @param {function(string)} eat - Eater.
 * @param {string} value - Rest of content.
 * @param {boolean?} [silent] - Whether this is a dry run.
 * @return {Node?|boolean} - `html` node.
 */
function tokenizeTag(eat, value, silent) {
    var self = this;
    var subvalue = eatHTMLComment(value, self.options) ||
        eatHTMLCDATA(value) ||
        eatHTMLProcessingInstruction(value) ||
        eatHTMLDeclaration(value) ||
        eatHTMLClosingTag(value) ||
        eatHTMLOpeningTag(value);

    if (!subvalue) {
        return;
    }

    /* istanbul ignore if - never used (yet) */
    if (silent) {
        return true;
    }

    if (!self.inLink && EXPRESSION_HTML_LINK_OPEN.test(subvalue)) {
        self.inLink = true;
    } else if (self.inLink && EXPRESSION_HTML_LINK_CLOSE.test(subvalue)) {
        self.inLink = false;
    }

    return eat(subvalue)(self.renderRaw(T_HTML, subvalue));
}

tokenizeTag.locator = locateTag;

/**
 * Find a possible link.
 *
 * @example
 *   locateLink('foo ![bar'); // 4
 *
 * @param {string} value - Value to search.
 * @param {number} fromIndex - Index to start searching at.
 * @return {number} - Location of possible link.
 */
function locateLink(value, fromIndex) {
    var link = value.indexOf(C_BRACKET_OPEN, fromIndex);
    var image = value.indexOf(C_EXCLAMATION_MARK + C_BRACKET_OPEN, fromIndex);

    if (image === -1) {
        return link;
    }

    /*
     * Link can never be `-1` if an image is found, so we don’t need to
     * check for that :)
     */

    return link < image ? link : image;
}

/**
 * Tokenise a link.
 *
 * @example
 *   tokenizeLink(eat, '![foo](fav.ico "Favicon"));
 *
 * @property {Function} locator - Link locator.
 * @param {function(string)} eat - Eater.
 * @param {string} value - Rest of content.
 * @param {boolean?} [silent] - Whether this is a dry run.
 * @return {Node?|boolean} - `link` or `image` node.
 */
function tokenizeLink(eat, value, silent) {
    var self = this;
    var subvalue = EMPTY;
    var index = 0;
    var character = value.charAt(0);
    var beforeURL;
    var beforeTitle;
    var whiteSpaceQueue;
    var commonmark;
    var openCount;
    var hasMarker;
    var markers;
    var isImage;
    var content;
    var marker;
    var length;
    var title;
    var depth;
    var queue;
    var url;
    var now;

    /*
     * Detect whether this is an image.
     */

    if (character === C_EXCLAMATION_MARK) {
        isImage = true;
        subvalue = character;
        character = value.charAt(++index);
    }

    /*
     * Eat the opening.
     */

    if (character !== C_BRACKET_OPEN) {
        return;
    }

    /*
     * Exit when this is a link and we’re already inside
     * a link.
     */

    if (!isImage && self.inLink) {
        return;
    }

    subvalue += character;
    queue = EMPTY;
    index++;

    /*
     * Eat the content.
     */

    commonmark = self.options.commonmark;
    length = value.length;
    now = eat.now();
    depth = 0;

    now.column += index;

    while (index < length) {
        character = value.charAt(index);

        if (character === C_BRACKET_OPEN) {
            depth++;
        } else if (character === C_BRACKET_CLOSE) {
            /*
             * Allow a single closing bracket when not in
             * commonmark-mode.
             */

            if (!commonmark && !depth) {
                if (value.charAt(index + 1) === C_PAREN_OPEN) {
                    break;
                }

                depth++;
            }

            if (depth === 0) {
                break;
            }

            depth--;
        }

        queue += character;
        index++;
    }

    /*
     * Eat the content closing.
     */

    if (
        value.charAt(index) !== C_BRACKET_CLOSE ||
        value.charAt(++index) !== C_PAREN_OPEN
    ) {
        return;
    }

    subvalue += queue + C_BRACKET_CLOSE + C_PAREN_OPEN;
    index++;
    content = queue;

    /*
     * Eat white-space.
     */

    while (index < length) {
        character = value.charAt(index);

        if (!isWhiteSpace(character)) {
            break;
        }

        subvalue += character;
        index++;
    }

    /*
     * Eat the URL.
     */

    character = value.charAt(index);
    markers = commonmark ? COMMONMARK_LINK_TITLE_MARKERS : LINK_TITLE_MARKERS;
    openCount = 0;
    queue = EMPTY;
    beforeURL = subvalue;

    if (character === C_LT) {
        index++;
        beforeURL += C_LT;

        while (index < length) {
            character = value.charAt(index);

            if (character === C_GT) {
                break;
            }

            if (commonmark && character === C_NEWLINE) {
                return;
            }

            queue += character;
            index++;
        }

        if (value.charAt(index) !== C_GT) {
            return;
        }

        subvalue += C_LT + queue + C_GT;
        url = queue;
        index++;
    } else {
        character = null;
        whiteSpaceQueue = EMPTY;

        while (index < length) {
            character = value.charAt(index);

            if (whiteSpaceQueue && has.call(markers, character)) {
                break;
            }

            if (isWhiteSpace(character)) {
                if (commonmark) {
                    break;
                }

                whiteSpaceQueue += character;
            } else {
                if (character === C_PAREN_OPEN) {
                    depth++;
                    openCount++;
                } else if (character === C_PAREN_CLOSE) {
                    if (depth === 0) {
                        break;
                    }

                    depth--;
                }

                queue += whiteSpaceQueue;
                whiteSpaceQueue = EMPTY;

                if (character === C_BACKSLASH) {
                    queue += C_BACKSLASH;
                    character = value.charAt(++index);
                }

                queue += character;
            }

            index++;
        }

        queue = queue;
        subvalue += queue;
        url = queue;
        index = subvalue.length;
    }

    /*
     * Eat white-space.
     */

    queue = EMPTY;

    while (index < length) {
        character = value.charAt(index);

        if (!isWhiteSpace(character)) {
            break;
        }

        queue += character;
        index++;
    }

    character = value.charAt(index);
    subvalue += queue;

    /*
     * Eat the title.
     */

    if (queue && has.call(markers, character)) {
        index++;
        subvalue += character;
        queue = EMPTY;
        marker = markers[character];
        beforeTitle = subvalue;

        /*
         * In commonmark-mode, things are pretty easy: the
         * marker cannot occur inside the title.
         *
         * Non-commonmark does, however, support nested
         * delimiters.
         */

        if (commonmark) {
            while (index < length) {
                character = value.charAt(index);

                if (character === marker) {
                    break;
                }

                if (character === C_BACKSLASH) {
                    queue += C_BACKSLASH;
                    character = value.charAt(++index);
                }

                index++;
                queue += character;
            }

            character = value.charAt(index);

            if (character !== marker) {
                return;
            }

            title = queue;
            subvalue += queue + character;
            index++;

            while (index < length) {
                character = value.charAt(index);

                if (!isWhiteSpace(character)) {
                    break;
                }

                subvalue += character;
                index++;
            }
        } else {
            whiteSpaceQueue = EMPTY;

            while (index < length) {
                character = value.charAt(index);

                if (character === marker) {
                    if (hasMarker) {
                        queue += marker + whiteSpaceQueue;
                        whiteSpaceQueue = EMPTY;
                    }

                    hasMarker = true;
                } else if (!hasMarker) {
                    queue += character;
                } else if (character === C_PAREN_CLOSE) {
                    subvalue += queue + marker + whiteSpaceQueue;
                    title = queue;
                    break;
                } else if (isWhiteSpace(character)) {
                    whiteSpaceQueue += character;
                } else {
                    queue += marker + whiteSpaceQueue + character;
                    whiteSpaceQueue = EMPTY;
                    hasMarker = false;
                }

                index++;
            }
        }
    }

    if (value.charAt(index) !== C_PAREN_CLOSE) {
        return;
    }

    /* istanbul ignore if - never used (yet) */
    if (silent) {
        return true;
    }

    subvalue += C_PAREN_CLOSE;

    url = self.decode.raw(self.descape(url), eat(beforeURL).test().end);

    if (title) {
        beforeTitle = eat(beforeTitle).test().end;
        title = self.decode.raw(self.descape(title), beforeTitle);
    }

    return eat(subvalue)(
        self.renderLink(!isImage, url, content, title, now, eat)
    );
}

tokenizeLink.locator = locateLink;

/**
 * Tokenise a reference link, image, or footnote;
 * shortcut reference link, or footnote.
 *
 * @example
 *   tokenizeReference(eat, '[foo]');
 *   tokenizeReference(eat, '[foo][]');
 *   tokenizeReference(eat, '[foo][bar]');
 *
 * @property {Function} locator - Reference locator.
 * @param {function(string)} eat - Eater.
 * @param {string} value - Rest of content.
 * @param {boolean?} [silent] - Whether this is a dry run.
 * @return {Node?|boolean} - Reference node.
 */
function tokenizeReference(eat, value, silent) {
    var self = this;
    var character = value.charAt(0);
    var index = 0;
    var length = value.length;
    var subvalue = EMPTY;
    var intro = EMPTY;
    var type = T_LINK;
    var referenceType = REFERENCE_TYPE_SHORTCUT;
    var text;
    var identifier;
    var now;
    var node;
    var exitLink;
    var queue;
    var bracketed;
    var depth;

    /*
     * Check whether we’re eating an image.
     */

    if (character === C_EXCLAMATION_MARK) {
        type = T_IMAGE;
        intro = character;
        character = value.charAt(++index);
    }

    if (character !== C_BRACKET_OPEN) {
        return;
    }

    index++;
    intro += character;
    queue = EMPTY;

    /*
     * Check whether we’re eating a footnote.
     */

    if (
        self.options.footnotes &&
        type === T_LINK &&
        value.charAt(index) === C_CARET
    ) {
        intro += C_CARET;
        index++;
        type = T_FOOTNOTE;
    }

    /*
     * Eat the text.
     */

    depth = 0;

    while (index < length) {
        character = value.charAt(index);

        if (character === C_BRACKET_OPEN) {
            bracketed = true;
            depth++;
        } else if (character === C_BRACKET_CLOSE) {
            if (!depth) {
                break;
            }

            depth--;
        }

        if (character === C_BACKSLASH) {
            queue += C_BACKSLASH;
            character = value.charAt(++index);
        }

        queue += character;
        index++;
    }

    subvalue = text = queue;
    character = value.charAt(index);

    if (character !== C_BRACKET_CLOSE) {
        return;
    }

    index++;
    subvalue += character;
    queue = EMPTY;

    while (index < length) {
        character = value.charAt(index);

        if (!isWhiteSpace(character)) {
            break;
        }

        queue += character;
        index++;
    }

    character = value.charAt(index);

    if (character !== C_BRACKET_OPEN) {
        if (!text) {
            return;
        }

        identifier = text;
    } else {
        identifier = EMPTY;
        queue += character;
        index++;

        while (index < length) {
            character = value.charAt(index);

            if (
                character === C_BRACKET_OPEN ||
                character === C_BRACKET_CLOSE
            ) {
                break;
            }

            if (character === C_BACKSLASH) {
                identifier += C_BACKSLASH;
                character = value.charAt(++index);
            }

            identifier += character;
            index++;
        }

        character = value.charAt(index);

        if (character === C_BRACKET_CLOSE) {
            queue += identifier + character;
            index++;

            referenceType = identifier ?
                REFERENCE_TYPE_FULL :
                REFERENCE_TYPE_COLLAPSED;
        } else {
            identifier = EMPTY;
        }

        subvalue += queue;
        queue = EMPTY;
    }

    /*
     * Brackets cannot be inside the identifier.
     */

    if (referenceType !== REFERENCE_TYPE_FULL && bracketed) {
        return;
    }

    /*
     * Inline footnotes cannot have an identifier.
     */

    if (type === T_FOOTNOTE && referenceType !== REFERENCE_TYPE_SHORTCUT) {
        type = T_LINK;
        intro = C_BRACKET_OPEN + C_CARET;
        text = C_CARET + text;
    }

    subvalue = intro + subvalue;

    if (type === T_LINK && self.inLink) {
        return null;
    }

    /* istanbul ignore if - never used (yet) */
    if (silent) {
        return true;
    }

    if (type === T_FOOTNOTE && text.indexOf(C_SPACE) !== -1) {
        return eat(subvalue)(self.renderFootnote(text, eat.now()));
    }

    now = eat.now();
    now.column += intro.length;
    identifier = referenceType === REFERENCE_TYPE_FULL ? identifier : text;

    node = {
        'type': type + 'Reference',
        'identifier': normalize(identifier)
    };

    if (type === T_LINK || type === T_IMAGE) {
        node.referenceType = referenceType;
    }

    if (type === T_LINK) {
        exitLink = self.enterLink();
        node.children = self.tokenizeInline(text, now);
        exitLink();
    } else if (type === T_IMAGE) {
        node.alt = self.decode.raw(self.descape(text), now) || null;
    }

    return eat(subvalue)(node);
}

tokenizeReference.locator = locateLink;

/**
 * Find a possible strong emphasis.
 *
 * @example
 *   locateStrong('foo **bar'); // 4
 *
 * @param {string} value - Value to search.
 * @param {number} fromIndex - Index to start searching at.
 * @return {number} - Location of possible strong emphasis.
 */
function locateStrong(value, fromIndex) {
    var asterisk = value.indexOf(C_ASTERISK + C_ASTERISK, fromIndex);
    var underscore = value.indexOf(C_UNDERSCORE + C_UNDERSCORE, fromIndex);

    if (underscore === -1) {
        return asterisk;
    }

    if (asterisk === -1) {
        return underscore;
    }

    return underscore < asterisk ? underscore : asterisk;
}

/**
 * Tokenise strong emphasis.
 *
 * @example
 *   tokenizeStrong(eat, '**foo**');
 *   tokenizeStrong(eat, '__foo__');
 *
 * @property {Function} locator - Strong emphasis locator.
 * @param {function(string)} eat - Eater.
 * @param {string} value - Rest of content.
 * @param {boolean?} [silent] - Whether this is a dry run.
 * @return {Node?|boolean} - `strong` node.
 */
function tokenizeStrong(eat, value, silent) {
    var self = this;
    var index = 0;
    var character = value.charAt(index);
    var now;
    var pedantic;
    var marker;
    var queue;
    var subvalue;
    var length;
    var prev;

    if (
        EMPHASIS_MARKERS[character] !== true ||
        value.charAt(++index) !== character
    ) {
        return;
    }

    pedantic = self.options.pedantic;
    marker = character;
    subvalue = marker + marker;
    length = value.length;
    index++;
    queue = character = EMPTY;

    if (pedantic && isWhiteSpace(value.charAt(index))) {
        return;
    }

    while (index < length) {
        prev = character;
        character = value.charAt(index);

        if (
            character === marker &&
            value.charAt(index + 1) === marker &&
            (!pedantic || !isWhiteSpace(prev))
        ) {
            character = value.charAt(index + 2);

            if (character !== marker) {
                if (!trim(queue)) {
                    return;
                }

                /* istanbul ignore if - never used (yet) */
                if (silent) {
                    return true;
                }

                now = eat.now();
                now.column += 2;

                return eat(subvalue + queue + subvalue)(
                    self.renderInline(T_STRONG, queue, now)
                );
            }
        }

        if (!pedantic && character === C_BACKSLASH) {
            queue += character;
            character = value.charAt(++index);
        }

        queue += character;
        index++;
    }
}

tokenizeStrong.locator = locateStrong;

/**
 * Find possible slight emphasis.
 *
 * @example
 *   locateEmphasis('foo *bar'); // 4
 *
 * @param {string} value - Value to search.
 * @param {number} fromIndex - Index to start searching at.
 * @return {number} - Location of possible slight emphasis.
 */
function locateEmphasis(value, fromIndex) {
    var asterisk = value.indexOf(C_ASTERISK, fromIndex);
    var underscore = value.indexOf(C_UNDERSCORE, fromIndex);

    if (underscore === -1) {
        return asterisk;
    }

    if (asterisk === -1) {
        return underscore;
    }

    return underscore < asterisk ? underscore : asterisk;
}

/**
 * Tokenise slight emphasis.
 *
 * @example
 *   tokenizeEmphasis(eat, '*foo*');
 *   tokenizeEmphasis(eat, '_foo_');
 *
 * @property {Function} locator - Slight emphasis locator.
 * @param {function(string)} eat - Eater.
 * @param {string} value - Rest of content.
 * @param {boolean?} [silent] - Whether this is a dry run.
 * @return {Node?|boolean} - `emphasis` node.
 */
function tokenizeEmphasis(eat, value, silent) {
    var self = this;
    var index = 0;
    var character = value.charAt(index);
    var now;
    var pedantic;
    var marker;
    var queue;
    var subvalue;
    var length;
    var prev;

    if (EMPHASIS_MARKERS[character] !== true) {
        return;
    }

    pedantic = self.options.pedantic;
    subvalue = marker = character;
    length = value.length;
    index++;
    queue = character = EMPTY;

    if (pedantic && isWhiteSpace(value.charAt(index))) {
        return;
    }

    while (index < length) {
        prev = character;
        character = value.charAt(index);

        if (
            character === marker &&
            (!pedantic || !isWhiteSpace(prev))
        ) {
            character = value.charAt(++index);

            if (character !== marker) {
                if (!trim(queue) || prev === marker) {
                    return;
                }

                if (
                    pedantic ||
                    marker !== C_UNDERSCORE ||
                    !isWordCharacter(character)
                ) {
                    /* istanbul ignore if - never used (yet) */
                    if (silent) {
                        return true;
                    }

                    now = eat.now();
                    now.column++;

                    return eat(subvalue + queue + marker)(
                        self.renderInline(T_EMPHASIS, queue, now)
                    );
                }
            }

            queue += marker;
        }

        if (!pedantic && character === C_BACKSLASH) {
            queue += character;
            character = value.charAt(++index);
        }

        queue += character;
        index++;
    }
}

tokenizeEmphasis.locator = locateEmphasis;

/**
 * Find a possible deletion.
 *
 * @example
 *   locateDeletion('foo ~~bar'); // 4
 *
 * @param {string} value - Value to search.
 * @param {number} fromIndex - Index to start searching at.
 * @return {number} - Location of possible deletion.
 */
function locateDeletion(value, fromIndex) {
    return value.indexOf(C_TILDE + C_TILDE, fromIndex);
}

/**
 * Tokenise a deletion.
 *
 * @example
 *   tokenizeDeletion(eat, '~~foo~~');
 *
 * @property {Function} locator - Deletion locator.
 * @param {function(string)} eat - Eater.
 * @param {string} value - Rest of content.
 * @param {boolean?} [silent] - Whether this is a dry run.
 * @return {Node?|boolean} - `delete` node.
 */
function tokenizeDeletion(eat, value, silent) {
    var self = this;
    var character = EMPTY;
    var previous = EMPTY;
    var preceding = EMPTY;
    var subvalue = EMPTY;
    var index;
    var length;
    var now;

    if (
        !self.options.gfm ||
        value.charAt(0) !== C_TILDE ||
        value.charAt(1) !== C_TILDE ||
        isWhiteSpace(value.charAt(2))
    ) {
        return;
    }

    index = 1;
    length = value.length;
    now = eat.now();
    now.column += 2;

    while (++index < length) {
        character = value.charAt(index);

        if (
            character === C_TILDE &&
            previous === C_TILDE &&
            (!preceding || !isWhiteSpace(preceding))
        ) {
            /* istanbul ignore if - never used (yet) */
            if (silent) {
                return true;
            }

            return eat(C_TILDE + C_TILDE + subvalue + C_TILDE + C_TILDE)(
                self.renderInline(T_DELETE, subvalue, now)
            );
        }

        subvalue += previous;
        preceding = previous;
        previous = character;
    }
}

tokenizeDeletion.locator = locateDeletion;

/**
 * Find possible inline code.
 *
 * @example
 *   locateInlineCode('foo `bar'); // 4
 *
 * @param {string} value - Value to search.
 * @param {number} fromIndex - Index to start searching at.
 * @return {number} - Location of possible inline code.
 */
function locateInlineCode(value, fromIndex) {
    return value.indexOf(C_TICK, fromIndex);
}

/**
 * Tokenise inline code.
 *
 * @example
 *   tokenizeInlineCode(eat, '`foo()`');
 *
 * @property {Function} locator - Inline code locator.
 * @param {function(string)} eat - Eater.
 * @param {string} value - Rest of content.
 * @param {boolean?} [silent] - Whether this is a dry run.
 * @return {Node?|boolean} - `inlineCode` node.
 */
function tokenizeInlineCode(eat, value, silent) {
    var self = this;
    var length = value.length;
    var index = 0;
    var queue = EMPTY;
    var tickQueue = EMPTY;
    var contentQueue;
    var whiteSpaceQueue;
    var count;
    var openingCount;
    var subvalue;
    var character;
    var found;
    var next;

    while (index < length) {
        if (value.charAt(index) !== C_TICK) {
            break;
        }

        queue += C_TICK;
        index++;
    }

    if (!queue) {
        return;
    }

    subvalue = queue;
    openingCount = index;
    queue = EMPTY;
    next = value.charAt(index);
    count = 0;

    while (index < length) {
        character = next;
        next = value.charAt(index + 1);

        if (character === C_TICK) {
            count++;
            tickQueue += character;
        } else {
            count = 0;
            queue += character;
        }

        if (count && next !== C_TICK) {
            if (count === openingCount) {
                subvalue += queue + tickQueue;
                found = true;
                break;
            }

            queue += tickQueue;
            tickQueue = EMPTY;
        }

        index++;
    }

    if (!found) {
        if (openingCount % 2 !== 0) {
            return;
        }

        queue = EMPTY;
    }

    /* istanbul ignore if - never used (yet) */
    if (silent) {
        return true;
    }

    contentQueue = whiteSpaceQueue = EMPTY;
    length = queue.length;
    index = -1;

    while (++index < length) {
        character = queue.charAt(index);

        if (isWhiteSpace(character)) {
            whiteSpaceQueue += character;
            continue;
        }

        if (whiteSpaceQueue) {
            if (contentQueue) {
                contentQueue += whiteSpaceQueue;
            }

            whiteSpaceQueue = EMPTY;
        }

        contentQueue += character;
    }

    return eat(subvalue)(self.renderRaw(T_INLINE_CODE, contentQueue));
}

tokenizeInlineCode.locator = locateInlineCode;

/**
 * Find a possible break.
 *
 * @example
 *   locateBreak('foo   \nbar'); // 3
 *
 * @param {string} value - Value to search.
 * @param {number} fromIndex - Index to start searching at.
 * @return {number} - Location of possible break.
 */
function locateBreak(value, fromIndex) {
    var index = value.indexOf(C_NEWLINE, fromIndex);

    while (index > fromIndex) {
        if (value.charAt(index - 1) !== C_SPACE) {
            break;
        }

        index--;
    }

    return index;
}

/**
 * Tokenise a break.
 *
 * @example
 *   tokenizeBreak(eat, '  \n');
 *
 * @property {Function} locator - Break locator.
 * @param {function(string)} eat - Eater.
 * @param {string} value - Rest of content.
 * @param {boolean?} [silent] - Whether this is a dry run.
 * @return {Node?|boolean} - `break` node.
 */
function tokenizeBreak(eat, value, silent) {
    var self = this;
    var breaks = self.options.breaks;
    var length = value.length;
    var index = -1;
    var queue = EMPTY;
    var character;

    while (++index < length) {
        character = value.charAt(index);

        if (character === C_NEWLINE) {
            if (!breaks && index < MIN_BREAK_LENGTH) {
                return;
            }

            /* istanbul ignore if - never used (yet) */
            if (silent) {
                return true;
            }

            queue += character;
            return eat(queue)(self.renderVoid(T_BREAK));
        }

        if (character !== C_SPACE) {
            return;
        }

        queue += character;
    }
}

tokenizeBreak.locator = locateBreak;

/**
 * Construct a new parser.
 *
 * @example
 *   var parser = new Parser(new VFile('Foo'));
 *
 * @constructor
 * @class {Parser}
 * @param {VFile} file - File to parse.
 * @param {Object?} [options] - Passed to
 *   `Parser#setOptions()`.
 */
function Parser(file, options, processor) {
    var self = this;

    self.file = file;
    self.inLink = false;
    self.atTop = true;
    self.atStart = true;
    self.inBlockquote = false;
    self.data = processor.data;

    self.descape = descapeFactory(self, 'escape');
    self.decode = decodeFactory(self);

    self.options = extend({}, self.options);

    self.setOptions(options);
}

/**
 * Set options.  Does not overwrite previously set
 * options.
 *
 * @example
 *   var parser = new Parser();
 *   parser.setOptions({gfm: true});
 *
 * @this {Parser}
 * @throws {Error} - When an option is invalid.
 * @param {Object?} [options] - Parse settings.
 * @return {Parser} - `self`.
 */
Parser.prototype.setOptions = function (options) {
    var self = this;
    var escape = self.data.escape;
    var current = self.options;
    var key;

    if (options === null || options === undefined) {
        options = {};
    } else if (typeof options === 'object') {
        options = extend({}, options);
    } else {
        raise(options, 'options');
    }

    for (key in defaultOptions) {
        validate.boolean(options, key, current[key]);
    }

    self.options = options;

    if (options.commonmark) {
        self.escape = escape.commonmark;
    } else if (options.gfm) {
        self.escape = escape.gfm;
    } else {
        self.escape = escape.default;
    }

    return self;
};

/*
 * Expose `defaults`.
 */

Parser.prototype.options = defaultOptions;

/**
 * Factory to track indentation for each line corresponding
 * to the given `start` and the number of invocations.
 *
 * @param {number} start - Starting line.
 * @return {function(offset)} - Indenter.
 */
Parser.prototype.indent = function (start) {
    var self = this;
    var line = start;

    /**
     * Intender which increments the global offset,
     * starting at the bound line, and further incrementing
     * each line for each invocation.
     *
     * @example
     *   indenter(2);
     *
     * @param {number} offset - Number to increment the
     *   offset.
     */
    function indenter(offset) {
        self.offset[line] = (self.offset[line] || 0) + offset;

        line++;
    }

    return indenter;
};

/**
 * Get found offsets starting at `start`.
 *
 * @param {number} start - Starting line.
 * @return {Array.<number>} - Offsets starting at `start`.
 */
Parser.prototype.getIndent = function (start) {
    var offset = this.offset;
    var result = [];

    while (++start) {
        if (!(start in offset)) {
            break;
        }

        result.push((offset[start] || 0) + 1);
    }

    return result;
};

/**
 * Parse the bound file.
 *
 * @example
 *   new Parser(new File('_Foo_.')).parse();
 *
 * @this {Parser}
 * @return {Object} - `root` node.
 */
Parser.prototype.parse = function () {
    var self = this;
    var value = clean(String(self.file));
    var node;

    /*
     * Add an `offset` matrix, used to keep track of
     * syntax and white space indentation per line.
     */

    self.offset = {};

    node = self.renderBlock(T_ROOT, value);

    if (self.options.position) {
        node.position = {
            'start': {
                'line': 1,
                'column': 1
            }
        };

        node.position.end = self.eof || node.position.start;
    }

    return node;
};

/*
 * Enter and exit helpers.
 */

Parser.prototype.enterLink = stateToggler('inLink', false);
Parser.prototype.exitTop = stateToggler('atTop', true);
Parser.prototype.exitStart = stateToggler('atStart', true);
Parser.prototype.enterBlockquote = stateToggler('inBlockquote', false);

/*
 * Expose helpers
 */

Parser.prototype.renderRaw = renderRaw;
Parser.prototype.renderVoid = renderVoid;
Parser.prototype.renderParent = renderParent;
Parser.prototype.renderInline = renderInline;
Parser.prototype.renderBlock = renderBlock;

Parser.prototype.renderLink = renderLink;
Parser.prototype.renderCodeBlock = renderCodeBlock;
Parser.prototype.renderBlockquote = renderBlockquote;
Parser.prototype.renderListItem = renderListItem;
Parser.prototype.renderFootnoteDefinition = renderFootnoteDefinition;
Parser.prototype.renderHeading = renderHeading;
Parser.prototype.renderFootnote = renderFootnote;

/**
 * Construct a tokenizer.  This creates both
 * `tokenizeInline` and `tokenizeBlock`.
 *
 * @example
 *   Parser.prototype.tokenizeInline = tokenizeFactory('inline');
 *
 * @param {string} type - Name of parser, used to find
 *   its expressions (`%sMethods`) and tokenizers
 *   (`%Tokenizers`).
 * @return {Function} - Tokenizer.
 */
function tokenizeFactory(type) {
    /**
     * Tokenizer for a bound `type`
     *
     * @example
     *   parser = new Parser();
     *   parser.tokenizeInline('_foo_');
     *
     * @param {string} value - Content.
     * @param {Object?} [location] - Offset at which `value`
     *   starts.
     * @return {Array.<Object>} - Nodes.
     */
    function tokenize(value, location) {
        var self = this;
        var offset = self.offset;
        var tokens = [];
        var methods = self[type + 'Methods'];
        var tokenizers = self[type + 'Tokenizers'];
        var line = location ? location.line : 1;
        var column = location ? location.column : 1;
        var patchPosition = self.options.position;
        var add;
        var index;
        var length;
        var method;
        var name;
        var matched;
        var valueLength;
        var eater;

        /*
         * Trim white space only lines.
         */

        if (!value) {
            return tokens;
        }

        /**
         * Update line and column based on `value`.
         *
         * @example
         *   updatePosition('foo');
         *
         * @param {string} subvalue - Subvalue to eat.
         */
        function updatePosition(subvalue) {
            var lastIndex = -1;
            var index = subvalue.indexOf(C_NEWLINE);

            while (index !== -1) {
                line++;
                lastIndex = index;
                index = subvalue.indexOf(C_NEWLINE, index + 1);
            }

            if (lastIndex === -1) {
                column = column + subvalue.length;
            } else {
                column = subvalue.length - lastIndex;
            }

            if (line in offset) {
                if (lastIndex !== -1) {
                    column += offset[line];
                } else if (column <= offset[line]) {
                    column = offset[line] + 1;
                }
            }
        }

        /**
         * Get offset. Called before the first character is
         * eaten to retrieve the range's offsets.
         *
         * @return {Function} - `done`, to be called when
         *   the last character is eaten.
         */
        function getOffset() {
            var indentation = [];
            var pos = line + 1;

            /**
             * Done. Called when the last character is
             * eaten to retrieve the range’s offsets.
             *
             * @return {Array.<number>} - Offset.
             */
            function done() {
                var last = line + 1;

                while (pos < last) {
                    indentation.push((offset[pos] || 0) + 1);

                    pos++;
                }

                return indentation;
            }

            return done;
        }

        /**
         * Get the current position.
         *
         * @example
         *   position = now(); // {line: 1, column: 1}
         *
         * @return {Object} - Current Position.
         */
        function now() {
            return {
                'line': line,
                'column': column
            };
        }

        /**
         * Store position information for a node.
         *
         * @example
         *   start = now();
         *   updatePosition('foo');
         *   location = new Position(start);
         *   // {start: {line: 1, column: 1}, end: {line: 1, column: 3}}
         *
         * @param {Object} start - Starting position.
         */
        function Position(start) {
            this.start = start;
            this.end = now();
        }

        /**
         * Throw when a value is incorrectly eaten.
         * This shouldn’t happen but will throw on new,
         * incorrect rules.
         *
         * @example
         *   // When the current value is set to `foo bar`.
         *   validateEat('foo');
         *   eat('foo');
         *
         *   validateEat('bar');
         *   // throws, because the space is not eaten.
         *
         * @param {string} subvalue - Value to be eaten.
         * @throws {Error} - When `subvalue` cannot be eaten.
         */
        function validateEat(subvalue) {
            /* istanbul ignore if */
            if (value.substring(0, subvalue.length) !== subvalue) {
                self.file.fail(ERR_INCORRECTLY_EATEN, now());
            }
        }

        /**
         * Mark position and patch `node.position`.
         *
         * @example
         *   var update = position();
         *   updatePosition('foo');
         *   update({});
         *   // {
         *   //   position: {
         *   //     start: {line: 1, column: 1}
         *   //     end: {line: 1, column: 3}
         *   //   }
         *   // }
         *
         * @returns {Function} - Updater.
         */
        function position() {
            var before = now();

            /**
             * Add the position to a node.
             *
             * @example
             *   update({type: 'text', value: 'foo'});
             *
             * @param {Node} node - Node to attach position
             *   on.
             * @param {Array} [indent] - Indentation for
             *   `node`.
             * @return {Node} - `node`.
             */
            function update(node, indent) {
                var prev = node.position;
                var start = prev ? prev.start : before;
                var combined = [];
                var n = prev && prev.end.line;
                var l = before.line;

                node.position = new Position(start);

                /*
                 * If there was already a `position`, this
                 * node was merged.  Fixing `start` wasn’t
                 * hard, but the indent is different.
                 * Especially because some information, the
                 * indent between `n` and `l` wasn’t
                 * tracked.  Luckily, that space is
                 * (should be?) empty, so we can safely
                 * check for it now.
                 */

                if (prev && indent && prev.indent) {
                    combined = prev.indent;

                    if (n < l) {
                        while (++n < l) {
                            combined.push((offset[n] || 0) + 1);
                        }

                        combined.push(before.column);
                    }

                    indent = combined.concat(indent);
                }

                node.position.indent = indent || [];

                return node;
            }

            return update;
        }

        /**
         * Add `node` to `parent`s children or to `tokens`.
         * Performs merges where possible.
         *
         * @example
         *   add({});
         *
         *   add({}, {children: []});
         *
         * @param {Object} node - Node to add.
         * @param {Object} [parent] - Parent to insert into.
         * @return {Object} - Added or merged into node.
         */
        add = function (node, parent) {
            var prev;
            var children;

            if (!parent) {
                children = tokens;
            } else {
                children = parent.children;
            }

            prev = children[children.length - 1];

            if (
                prev &&
                node.type === prev.type &&
                node.type in MERGEABLE_NODES &&
                mergeable(prev) &&
                mergeable(node)
            ) {
                node = MERGEABLE_NODES[node.type].call(
                    self, prev, node
                );
            }

            if (node !== prev) {
                children.push(node);
            }

            if (self.atStart && tokens.length) {
                self.exitStart();
            }

            return node;
        };

        /**
         * Remove `subvalue` from `value`.
         * Expects `subvalue` to be at the start from
         * `value`, and applies no validation.
         *
         * @example
         *   eat('foo')({type: 'text', value: 'foo'});
         *
         * @param {string} subvalue - Removed from `value`,
         *   and passed to `updatePosition`.
         * @return {Function} - Wrapper around `add`, which
         *   also adds `position` to node.
         */
        function eat(subvalue) {
            var indent = getOffset();
            var pos = position();
            var current = now();

            validateEat(subvalue);

            /**
             * Add the given arguments, add `position` to
             * the returned node, and return the node.
             *
             * @param {Object} node - Node to add.
             * @param {Object} [parent] - Node to insert into.
             * @return {Node} - Added node.
             */
            function apply(node, parent) {
                return pos(add(pos(node), parent), indent);
            }

            /**
             * Functions just like apply, but resets the
             * content:  the line and column are reversed,
             * and the eaten value is re-added.
             *
             * This is useful for nodes with a single
             * type of content, such as lists and tables.
             *
             * See `apply` above for what parameters are
             * expected.
             *
             * @return {Node} - Added node.
             */
            function reset() {
                var node = apply.apply(null, arguments);

                line = current.line;
                column = current.column;
                value = subvalue + value;

                return node;
            }

            /**
             * Test the position, after eating, and reverse
             * to a not-eaten state.
             *
             * @return {Position} - Position after eating `subvalue`.
             */
            function test() {
                var result = pos({});

                line = current.line;
                column = current.column;
                value = subvalue + value;

                return result.position;
            }

            apply.reset = reset;
            apply.test = reset.test = test;

            value = value.substring(subvalue.length);

            updatePosition(subvalue);

            indent = indent();

            return apply;
        }

        /**
         * Same as `eat` above, but will not add positional
         * information to nodes.
         *
         * @example
         *   noEat('foo')({type: 'text', value: 'foo'});
         *
         * @param {string} subvalue - Removed from `value`.
         * @return {Function} - Wrapper around `add`.
         */
        function noEat(subvalue) {
            validateEat(subvalue);

            /**
             * Add the given arguments, and return the
             * node.
             *
             * @return {Node} - Added node.
             */
            function apply() {
                return add.apply(null, arguments);
            }

            /**
             * Functions just like apply, but resets the
             * content: the eaten value is re-added.
             *
             * @return {Node} - Added node.
             */
            function reset() {
                var node = apply.apply(null, arguments);

                value = subvalue + value;

                return node;
            }

            /**
             * Test the position, which in this mode is an
             * empty object.
             *
             * @return {Object} - Empty position object.
             */
            function test() {
                value = subvalue + value;

                return {};
            }

            apply.reset = reset;
            apply.test = reset.test = test;

            value = value.substring(subvalue.length);

            return apply;
        }

        /*
         * Expose the eater, depending on if `position`s
         * should be patched on nodes.
         */

        eater = patchPosition ? eat : noEat;

        /*
         * Expose `now` on `eater`.
         */

        eater.now = now;

        /*
         * Expose `file` on `eater`.
         */

        eater.file = self.file;

        /*
         * Sync initial offset.
         */

        updatePosition(EMPTY);

        /*
         * Iterate over `value`, and iterate over all
         * tokenizers.  When one eats something, re-iterate
         * with the remaining value.  If no tokenizer eats,
         * something failed (should not happen) and an
         * exception is thrown.
         */

        while (value) {
            index = -1;
            length = methods.length;
            matched = false;

            while (++index < length) {
                name = methods[index];
                method = tokenizers[name];

                if (
                    method &&
                    (!method.onlyAtStart || self.atStart) &&
                    (!method.onlyAtTop || self.atTop) &&
                    (!method.notInBlockquote || !self.inBlockquote) &&
                    (!method.notInLink || !self.inLink)
                ) {
                    valueLength = value.length;

                    method.apply(self, [eater, value]);

                    matched = valueLength !== value.length;

                    if (matched) {
                        break;
                    }
                }
            }

            /* istanbul ignore if */
            if (!matched) {
                self.file.fail(ERR_INFINITE_LOOP, eater.now());

                /*
                 * Errors are not thrown on `File#fail`
                 * when `quiet: true`.
                 */

                break;
            }
        }

        self.eof = now();

        return tokens;
    }

    return tokenize;
}

/*
 * Expose tokenizers for block-level nodes.
 */

Parser.prototype.blockTokenizers = {
    'yamlFrontMatter': tokenizeYAMLFrontMatter,
    'newline': tokenizeNewline,
    'code': tokenizeCode,
    'fences': tokenizeFences,
    'heading': tokenizeHeading,
    'lineHeading': tokenizeLineHeading,
    'horizontalRule': tokenizeHorizontalRule,
    'blockquote': tokenizeBlockquote,
    'list': tokenizeList,
    'html': tokenizeHTML,
    'definition': tokenizeDefinition,
    'footnoteDefinition': tokenizeFootnoteDefinition,
    'table': tokenizeTable,
    'paragraph': tokenizeParagraph
};

/*
 * Expose order in which to parse block-level nodes.
 */

Parser.prototype.blockMethods = [
    'yamlFrontMatter',
    'newline',
    'code',
    'fences',
    'blockquote',
    'heading',
    'horizontalRule',
    'list',
    'lineHeading',
    'html',
    'footnoteDefinition',
    'definition',
    'looseTable',
    'table',
    'paragraph'
];

/**
 * Block tokenizer.
 *
 * @example
 *   var parser = new Parser();
 *   parser.tokenizeBlock('> foo.');
 *
 * @param {string} value - Content.
 * @return {Array.<Object>} - Nodes.
 */

Parser.prototype.tokenizeBlock = tokenizeFactory(BLOCK);

/*
 * Expose tokenizers for inline-level nodes.
 */

Parser.prototype.inlineTokenizers = {
    'escape': tokenizeEscape,
    'autoLink': tokenizeAutoLink,
    'url': tokenizeURL,
    'tag': tokenizeTag,
    'link': tokenizeLink,
    'reference': tokenizeReference,
    'strong': tokenizeStrong,
    'emphasis': tokenizeEmphasis,
    'deletion': tokenizeDeletion,
    'inlineCode': tokenizeInlineCode,
    'break': tokenizeBreak,
    'inlineText': tokenizeText
};

/*
 * Expose order in which to parse inline-level nodes.
 */

Parser.prototype.inlineMethods = [
    'escape',
    'autoLink',
    'url',
    'tag',
    'link',
    'reference',
    'shortcutReference',
    'strong',
    'emphasis',
    'deletion',
    'inlineCode',
    'break',
    'inlineText'
];

/**
 * Inline tokenizer.
 *
 * @example
 *   var parser = new Parser();
 *   parser.tokenizeInline('_foo_');
 *
 * @param {string} value - Content.
 * @return {Array.<Object>} - Nodes.
 */

Parser.prototype.tokenizeInline = tokenizeFactory(INLINE);

/*
 * Expose `tokenizeFactory` so dependencies could create
 * their own tokenizers.
 */

Parser.prototype.tokenizeFactory = tokenizeFactory;

/*
 * Expose `parse` on `module.exports`.
 */

module.exports = Parser;

},{"./block-elements.json":57,"./defaults.js":58,"./utilities.js":62,"extend.js":19,"parse-entities":31,"repeat-string":63,"trim":73,"trim-trailing-lines":72}],61:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2015-2016 Titus Wormer
 * @license MIT
 * @module remark:stringify
 * @version 3.2.0
 * @fileoverview Compile an abstract syntax tree into
 *   a markdown document.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var decode = require('parse-entities');
var encode = require('stringify-entities');
var table = require('markdown-table');
var repeat = require('repeat-string');
var extend = require('extend.js');
var ccount = require('ccount');
var longestStreak = require('longest-streak');
var utilities = require('./utilities.js');
var defaultOptions = require('./defaults.js').stringify;

/*
 * Methods.
 */

var raise = utilities.raise;
var validate = utilities.validate;
var stateToggler = utilities.stateToggler;
var mergeable = utilities.mergeable;
var MERGEABLE_NODES = utilities.MERGEABLE_NODES;

/*
 * Constants.
 */

var INDENT = 4;
var MINIMUM_CODE_FENCE_LENGTH = 3;
var YAML_FENCE_LENGTH = 3;
var MINIMUM_RULE_LENGTH = 3;
var MAILTO = 'mailto:';
var ERROR_LIST_ITEM_INDENT = 'Cannot indent code properly. See ' +
    'http://git.io/mdast-lii';

/*
 * Expressions.
 */

var EXPRESSIONS_WHITE_SPACE = /\s/;

/*
 * Naive fence expression.
 */

var FENCE = /([`~])\1{2}/;

/*
 * Expression for a protocol.
 *
 * @see http://en.wikipedia.org/wiki/URI_scheme#Generic_syntax
 */

var PROTOCOL = /^[a-z][a-z+.-]+:\/?/i;

/*
 * Punctuation characters.
 */

var PUNCTUATION = /[-!"#$%&'()*+,.\/:;<=>?@\[\\\]^`{|}~_]/;

/*
 * Characters.
 */

var ANGLE_BRACKET_CLOSE = '>';
var ANGLE_BRACKET_OPEN = '<';
var ASTERISK = '*';
var BACKSLASH = '\\';
var CARET = '^';
var COLON = ':';
var SEMICOLON = ';';
var DASH = '-';
var DOT = '.';
var EMPTY = '';
var EQUALS = '=';
var EXCLAMATION_MARK = '!';
var HASH = '#';
var AMPERSAND = '&';
var LINE = '\n';
var CARRIAGE = '\r';
var FORM_FEED = '\f';
var PARENTHESIS_OPEN = '(';
var PARENTHESIS_CLOSE = ')';
var PIPE = '|';
var PLUS = '+';
var QUOTE_DOUBLE = '"';
var QUOTE_SINGLE = '\'';
var SPACE = ' ';
var TAB = '\t';
var VERTICAL_TAB = '\u000B';
var SQUARE_BRACKET_OPEN = '[';
var SQUARE_BRACKET_CLOSE = ']';
var TICK = '`';
var TILDE = '~';
var UNDERSCORE = '_';

/*
 * Entities.
 */

var ENTITY_AMPERSAND = AMPERSAND + 'amp' + SEMICOLON;
var ENTITY_ANGLE_BRACKET_OPEN = AMPERSAND + 'lt' + SEMICOLON;
var ENTITY_COLON = AMPERSAND + '#x3A' + SEMICOLON;

/*
 * Character combinations.
 */

var BREAK = LINE + LINE;
var GAP = BREAK + LINE;
var DOUBLE_TILDE = TILDE + TILDE;

/*
 * Allowed entity options.
 */

var ENTITY_OPTIONS = {};

ENTITY_OPTIONS.true = true;
ENTITY_OPTIONS.false = true;
ENTITY_OPTIONS.numbers = true;
ENTITY_OPTIONS.escape = true;

/*
 * Allowed list-bullet characters.
 */

var LIST_BULLETS = {};

LIST_BULLETS[ASTERISK] = true;
LIST_BULLETS[DASH] = true;
LIST_BULLETS[PLUS] = true;

/*
 * Allowed horizontal-rule bullet characters.
 */

var HORIZONTAL_RULE_BULLETS = {};

HORIZONTAL_RULE_BULLETS[ASTERISK] = true;
HORIZONTAL_RULE_BULLETS[DASH] = true;
HORIZONTAL_RULE_BULLETS[UNDERSCORE] = true;

/*
 * Allowed emphasis characters.
 */

var EMPHASIS_MARKERS = {};

EMPHASIS_MARKERS[UNDERSCORE] = true;
EMPHASIS_MARKERS[ASTERISK] = true;

/*
 * Allowed fence markers.
 */

var FENCE_MARKERS = {};

FENCE_MARKERS[TICK] = true;
FENCE_MARKERS[TILDE] = true;

/*
 * Which method to use based on `list.ordered`.
 */

var ORDERED_MAP = {};

ORDERED_MAP.true = 'visitOrderedItems';
ORDERED_MAP.false = 'visitUnorderedItems';

/*
 * Allowed list-item-indent's.
 */

var LIST_ITEM_INDENTS = {};

var LIST_ITEM_TAB = 'tab';
var LIST_ITEM_ONE = '1';
var LIST_ITEM_MIXED = 'mixed';

LIST_ITEM_INDENTS[LIST_ITEM_ONE] = true;
LIST_ITEM_INDENTS[LIST_ITEM_TAB] = true;
LIST_ITEM_INDENTS[LIST_ITEM_MIXED] = true;

/*
 * Which checkbox to use.
 */

var CHECKBOX_MAP = {};

CHECKBOX_MAP.null = EMPTY;
CHECKBOX_MAP.undefined = EMPTY;
CHECKBOX_MAP.true = SQUARE_BRACKET_OPEN + 'x' + SQUARE_BRACKET_CLOSE + SPACE;
CHECKBOX_MAP.false = SQUARE_BRACKET_OPEN + SPACE + SQUARE_BRACKET_CLOSE +
    SPACE;

/**
 * Encode noop.
 * Simply returns the given value.
 *
 * @example
 *   var encode = encodeNoop();
 *   encode('AT&T') // 'AT&T'
 *
 * @param {string} value - Content.
 * @return {string} - Content, without any modifications.
 */
function encodeNoop(value) {
    return value;
}

/**
 * Factory to encode HTML entities.
 * Creates a no-operation function when `type` is
 * `'false'`, a function which encodes using named
 * references when `type` is `'true'`, and a function
 * which encodes using numbered references when `type` is
 * `'numbers'`.
 *
 * @example
 *   encodeFactory('false')('AT&T') // 'AT&T'
 *   encodeFactory('true')('AT&T') // 'AT&amp;T'
 *   encodeFactory('numbers')('AT&T') // 'ATT&#x26;T'
 *
 * @param {string} type - Either `'true'`, `'false'`, or
 *   `'numbers'`.
 * @return {function(string): string} - Function which
 *   takes a value and returns its encoded version.
 */
function encodeFactory(type) {
    var options = {};

    if (type === 'false') {
        return encodeNoop;
    }

    if (type === 'true') {
        options.useNamedReferences = true;
    }

    if (type === 'escape') {
        options.escapeOnly = options.useNamedReferences = true;
    }

    /**
     * Encode HTML entities using `he` using bound options.
     *
     * @see https://github.com/mathiasbynens/he#strict
     *
     * @example
     *   // When `type` is `'true'`.
     *   encode('AT&T'); // 'AT&amp;T'
     *
     *   // When `type` is `'numbers'`.
     *   encode('AT&T'); // 'ATT&#x26;T'
     *
     * @param {string} value - Content.
     * @param {Object} [node] - Node which is compiled.
     * @return {string} - Encoded content.
     * @throws {Error} - When `file.quiet` is not `true`.
     *   However, by default `he` does not throw on
     *   parse errors, but when
     *   `he.encode.options.strict: true`, they occur on
     *   invalid HTML.
     */
    function encoder(value) {
        return encode(value, options);
    }

    return encoder;
}

/**
 * Check if a string starts with HTML entity.
 *
 * @example
 *   startsWithEntity('&copycat') // true
 *   startsWithEntity('&foo &amp &bar') // false
 *
 * @param {string} value - Value to check.
 * @return {boolean} - Whether `value` starts an entity.
 */
function startsWithEntity(value) {
    var prefix;

    /* istanbul ignore if - Currently also tested for at
     * implemention, but we keep it here because that’s
     * proper. */
    if (value.charAt(0) !== AMPERSAND) {
        return false;
    }

    prefix = value.split(AMPERSAND, 2).join(AMPERSAND);

    return decode(prefix).length !== prefix.length;
}

/**
 * Check if `character` is a valid alignment row character.
 *
 * @example
 *   isAlignmentRowCharacter(':') // true
 *   isAlignmentRowCharacter('=') // false
 *
 * @param {string} character - Character to check.
 * @return {boolean} - Whether `character` is a valid
 *   alignment row character.
 */
function isAlignmentRowCharacter(character) {
    return character === COLON ||
        character === DASH ||
        character === SPACE ||
        character === PIPE;
}

/**
 * Check if `index` in `value` is inside an alignment row.
 *
 * @example
 *   isInAlignmentRow(':--:', 2) // true
 *   isInAlignmentRow(':--:\n:-*-:', 9) // false
 *
 * @param {string} value - Value to check.
 * @param {number} index - Position in `value` to check.
 * @return {boolean} - Whether `index` in `value` is in
 *   an alignment row.
 */
function isInAlignmentRow(value, index) {
    var length = value.length;
    var start = index;
    var character;

    while (++index < length) {
        character = value.charAt(index);

        if (character === LINE) {
            break;
        }

        if (!isAlignmentRowCharacter(character)) {
            return false;
        }
    }

    index = start;

    while (--index > -1) {
        character = value.charAt(index);

        if (character === LINE) {
            break;
        }

        if (!isAlignmentRowCharacter(character)) {
            return false;
        }
    }

    return true;
}

/**
 * Factory to escape characters.
 *
 * @example
 *   var escape = escapeFactory({ commonmark: true });
 *   escape('x*x', { type: 'text', value: 'x*x' }) // 'x\\*x'
 *
 * @param {Object} options - Compiler options.
 * @return {function(value, node, parent): string} - Function which
 *   takes a value and a node and (optionally) its parent and returns
 *   its escaped value.
 */
function escapeFactory(options) {
    /**
     * Escape punctuation characters in a node's value.
     *
     * @param {string} value - Value to escape.
     * @param {Object} node - Node in which `value` exists.
     * @param {Object} [parent] - Parent of `node`.
     * @return {string} - Escaped `value`.
     */
    return function escape(value, node, parent) {
        var self = this;
        var gfm = options.gfm;
        var commonmark = options.commonmark;
        var siblings = parent && parent.children;
        var index = siblings && siblings.indexOf(node);
        var prev = siblings && siblings[index - 1];
        var next = siblings && siblings[index + 1];
        var length = value.length;
        var position = -1;
        var queue = [];
        var escaped = queue;
        var afterNewLine;
        var character;

        if (prev) {
            afterNewLine = prev.type === 'text' && /\n\s*$/.test(prev.value);
        } else if (parent) {
            afterNewLine = parent.type === 'paragraph';
        }

        while (++position < length) {
            character = value.charAt(position);

            if (
                character === BACKSLASH ||
                character === TICK ||
                character === ASTERISK ||
                character === SQUARE_BRACKET_OPEN ||
                character === UNDERSCORE ||
                (self.inLink && character === SQUARE_BRACKET_CLOSE) ||
                (
                    gfm &&
                    character === PIPE &&
                    (
                        self.inTable ||
                        isInAlignmentRow(value, position)
                    )
                )
            ) {
                afterNewLine = false;
                queue.push(BACKSLASH);
            } else if (character === ANGLE_BRACKET_OPEN) {
                afterNewLine = false;

                if (commonmark) {
                    queue.push(BACKSLASH);
                } else {
                    queue.push(ENTITY_ANGLE_BRACKET_OPEN);
                    continue;
                }
            } else if (
                gfm &&
                !self.inLink &&
                character === COLON &&
                (
                    queue.slice(-6).join(EMPTY) === 'mailto' ||
                    queue.slice(-5).join(EMPTY) === 'https' ||
                    queue.slice(-4).join(EMPTY) === 'http'
                )
            ) {
                afterNewLine = false;

                if (commonmark) {
                    queue.push(BACKSLASH);
                } else {
                    queue.push(ENTITY_COLON);
                    continue;
                }
            /* istanbul ignore if - Impossible to test with
             * the current set-up.  We need tests which try
             * to force markdown content into the tree. */
            } else if (
                character === AMPERSAND &&
                startsWithEntity(value.slice(position))
            ) {
                afterNewLine = false;

                if (commonmark) {
                    queue.push(BACKSLASH);
                } else {
                    queue.push(ENTITY_AMPERSAND);
                    continue;
                }
            } else if (
                gfm &&
                character === TILDE &&
                value.charAt(position + 1) === TILDE
            ) {
                queue.push(BACKSLASH, TILDE);
                afterNewLine = false;
                position += 1;
            } else if (character === LINE) {
                afterNewLine = true;
            } else if (afterNewLine) {
                if (
                    character === ANGLE_BRACKET_CLOSE ||
                    character === HASH ||
                    LIST_BULLETS[character]
                ) {
                    queue.push(BACKSLASH);
                    afterNewLine = false;
                } else if (
                    character !== SPACE &&
                    character !== TAB &&
                    character !== CARRIAGE &&
                    character !== VERTICAL_TAB &&
                    character !== FORM_FEED
                ) {
                    afterNewLine = false;
                }
            }

            queue.push(character);
        }

        /*
         * Multi-node versions.
         */

        if (siblings && node.type === 'text') {
            /*
             * Check for an opening parentheses after a
             * link-reference (which can be joined by
             * white-space).
             */

            if (
                prev &&
                prev.referenceType === 'shortcut'
            ) {
                position = -1;
                length = escaped.length;

                while (++position < length) {
                    character = escaped[position];

                    if (character === SPACE || character === TAB) {
                        continue;
                    }

                    if (character === PARENTHESIS_OPEN) {
                        escaped[position] = BACKSLASH + character;
                    }

                    if (character === COLON) {
                        if (commonmark) {
                            escaped[position] = BACKSLASH + character;
                        } else {
                            escaped[position] = ENTITY_COLON;
                        }
                    }

                    break;
                }
            }

            /*
             * Ensure non-auto-links are not seen as links.
             * This pattern needs to check the preceding
             * nodes too.
             */

            if (
                gfm &&
                !self.inLink &&
                prev &&
                prev.type === 'text' &&
                value.charAt(0) === COLON
            ) {
                queue = prev.value.slice(-6);

                if (
                    queue === 'mailto' ||
                    queue.slice(-5) === 'https' ||
                    queue.slice(-4) === 'http'
                ) {
                    if (commonmark) {
                        escaped.unshift(BACKSLASH);
                    } else {
                        escaped.splice(0, 1, ENTITY_COLON);
                    }
                }
            }

            /*
             * Escape ampersand if it would otherwise
             * start an entity.
             */

            if (
                next &&
                next.type === 'text' &&
                value.slice(-1) === AMPERSAND &&
                startsWithEntity(AMPERSAND + next.value)
            ) {
                if (commonmark) {
                    escaped.splice(escaped.length - 1, 0, BACKSLASH);
                } else {
                    escaped.push('amp', SEMICOLON);
                }
            }

            /*
             * Escape double tildes in GFM.
             */

            if (
                gfm &&
                next &&
                next.type === 'text' &&
                value.slice(-1) === TILDE &&
                next.value.charAt(0) === TILDE
            ) {
                escaped.splice(escaped.length - 1, 0, BACKSLASH);
            }
        }

        return escaped.join(EMPTY);
    };
}

/**
 * Wrap `url` in angle brackets when needed, or when
 * forced.
 *
 * In links, images, and definitions, the URL part needs
 * to be enclosed when it:
 *
 * - has a length of `0`;
 * - contains white-space;
 * - has more or less opening than closing parentheses.
 *
 * @example
 *   encloseURI('foo bar') // '<foo bar>'
 *   encloseURI('foo(bar(baz)') // '<foo(bar(baz)>'
 *   encloseURI('') // '<>'
 *   encloseURI('example.com') // 'example.com'
 *   encloseURI('example.com', true) // '<example.com>'
 *
 * @param {string} uri - URI to enclose.
 * @param {boolean?} [always] - Force enclosing.
 * @return {boolean} - Properly enclosed `uri`.
 */
function encloseURI(uri, always) {
    if (
        always ||
        !uri.length ||
        EXPRESSIONS_WHITE_SPACE.test(uri) ||
        ccount(uri, PARENTHESIS_OPEN) !== ccount(uri, PARENTHESIS_CLOSE)
    ) {
        return ANGLE_BRACKET_OPEN + uri + ANGLE_BRACKET_CLOSE;
    }

    return uri;
}

/**
 * There is currently no way to support nested delimiters
 * across Markdown.pl, CommonMark, and GitHub (RedCarpet).
 * The following code supports Markdown.pl and GitHub.
 * CommonMark is not supported when mixing double- and
 * single quotes inside a title.
 *
 * @see https://github.com/vmg/redcarpet/issues/473
 * @see https://github.com/jgm/CommonMark/issues/308
 *
 * @example
 *   encloseTitle('foo') // '"foo"'
 *   encloseTitle('foo \'bar\' baz') // '"foo \'bar\' baz"'
 *   encloseTitle('foo "bar" baz') // '\'foo "bar" baz\''
 *   encloseTitle('foo "bar" \'baz\'') // '"foo "bar" \'baz\'"'
 *
 * @param {string} title - Content.
 * @return {string} - Properly enclosed title.
 */
function encloseTitle(title) {
    var delimiter = QUOTE_DOUBLE;

    if (title.indexOf(delimiter) !== -1) {
        delimiter = QUOTE_SINGLE;
    }

    return delimiter + title + delimiter;
}

/**
 * Pad `value` with `level * INDENT` spaces.  Respects
 * lines. Ignores empty lines.
 *
 * @example
 *   pad('foo', 1) // '    foo'
 *
 * @param {string} value - Content.
 * @param {number} level - Indentation level.
 * @return {string} - Padded `value`.
 */
function pad(value, level) {
    var index;
    var padding;

    value = value.split(LINE);

    index = value.length;
    padding = repeat(SPACE, level * INDENT);

    while (index--) {
        if (value[index].length !== 0) {
            value[index] = padding + value[index];
        }
    }

    return value.join(LINE);
}

/**
 * Construct a new compiler.
 *
 * @example
 *   var compiler = new Compiler(new File('> foo.'));
 *
 * @constructor
 * @class {Compiler}
 * @param {File} file - Virtual file.
 * @param {Object?} [options] - Passed to
 *   `Compiler#setOptions()`.
 */
function Compiler(file, options) {
    var self = this;

    self.file = file;

    self.options = extend({}, self.options);

    self.setOptions(options);
}

/*
 * Cache prototype.
 */

var compilerPrototype = Compiler.prototype;

/*
 * Expose defaults.
 */

compilerPrototype.options = defaultOptions;

/*
 * Map of applicable enum's.
 */

var maps = {
    'entities': ENTITY_OPTIONS,
    'bullet': LIST_BULLETS,
    'rule': HORIZONTAL_RULE_BULLETS,
    'listItemIndent': LIST_ITEM_INDENTS,
    'emphasis': EMPHASIS_MARKERS,
    'strong': EMPHASIS_MARKERS,
    'fence': FENCE_MARKERS
};

/**
 * Set options.  Does not overwrite previously set
 * options.
 *
 * @example
 *   var compiler = new Compiler();
 *   compiler.setOptions({bullet: '*'});
 *
 * @this {Compiler}
 * @throws {Error} - When an option is invalid.
 * @param {Object?} [options] - Stringify settings.
 * @return {Compiler} - `self`.
 */
compilerPrototype.setOptions = function (options) {
    var self = this;
    var current = self.options;
    var ruleRepetition;
    var key;

    if (options === null || options === undefined) {
        options = {};
    } else if (typeof options === 'object') {
        options = extend({}, options);
    } else {
        raise(options, 'options');
    }

    for (key in defaultOptions) {
        validate[typeof current[key]](
            options, key, current[key], maps[key]
        );
    }

    ruleRepetition = options.ruleRepetition;

    if (ruleRepetition && ruleRepetition < MINIMUM_RULE_LENGTH) {
        raise(ruleRepetition, 'options.ruleRepetition');
    }

    self.encode = encodeFactory(String(options.entities));
    self.escape = escapeFactory(options);

    self.options = options;

    return self;
};

/*
 * Enter and exit helpers.
 */

compilerPrototype.enterLink = stateToggler('inLink', false);
compilerPrototype.enterTable = stateToggler('inTable', false);

/**
 * Visit a node.
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.visit({
 *     type: 'strong',
 *     children: [{
 *       type: 'text',
 *       value: 'Foo'
 *     }]
 *   });
 *   // '**Foo**'
 *
 * @param {Object} node - Node.
 * @param {Object?} [parent] - `node`s parent.
 * @return {string} - Compiled `node`.
 */
compilerPrototype.visit = function (node, parent) {
    var self = this;

    /*
     * Fail on unknown nodes.
     */

    if (typeof self[node.type] !== 'function') {
        self.file.fail(
            'Missing compiler for node of type `' +
            node.type + '`: `' + node + '`',
            node
        );
    }

    return self[node.type](node, parent);
};

/**
 * Visit all children of `parent`.
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.all({
 *     type: 'strong',
 *     children: [{
 *       type: 'text',
 *       value: 'Foo'
 *     },
 *     {
 *       type: 'text',
 *       value: 'Bar'
 *     }]
 *   });
 *   // ['Foo', 'Bar']
 *
 * @param {Object} parent - Parent node of children.
 * @return {Array.<string>} - List of compiled children.
 */
compilerPrototype.all = function (parent) {
    var self = this;
    var children = parent.children;
    var values = [];
    var index = 0;
    var length = children.length;
    var node = children[0];
    var next;

    if (length === 0) {
        return values;
    }

    while (++index < length) {
        next = children[index];

        if (
            node.type === next.type &&
            node.type in MERGEABLE_NODES &&
            mergeable(node) &&
            mergeable(next)
        ) {
            node = MERGEABLE_NODES[node.type].call(self, node, next);
        } else {
            values.push(self.visit(node, parent));
            node = next;
        }
    }

    values.push(self.visit(node, parent));

    return values;
};

/**
 * Visit ordered list items.
 *
 * Starts the list with
 * `node.start` and increments each following list item
 * bullet by one:
 *
 *     2. foo
 *     3. bar
 *
 * In `incrementListMarker: false` mode, does not increment
 * each marker and stays on `node.start`:
 *
 *     1. foo
 *     1. bar
 *
 * Adds an extra line after an item if it has
 * `loose: true`.
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.visitOrderedItems({
 *     type: 'list',
 *     ordered: true,
 *     children: [{
 *       type: 'listItem',
 *       children: [{
 *         type: 'text',
 *         value: 'bar'
 *       }]
 *     }]
 *   });
 *   // '1.  bar'
 *
 * @param {Object} node - `list` node with
 *   `ordered: true`.
 * @return {string} - Markdown list.
 */
compilerPrototype.visitOrderedItems = function (node) {
    var self = this;
    var increment = self.options.incrementListMarker;
    var values = [];
    var start = node.start;
    var children = node.children;
    var length = children.length;
    var index = -1;
    var bullet;

    while (++index < length) {
        bullet = (increment ? start + index : start) + DOT;
        values[index] = self.listItem(children[index], node, index, bullet);
    }

    return values.join(LINE);
};

/**
 * Visit unordered list items.
 *
 * Uses `options.bullet` as each item's bullet.
 *
 * Adds an extra line after an item if it has
 * `loose: true`.
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.visitUnorderedItems({
 *     type: 'list',
 *     ordered: false,
 *     children: [{
 *       type: 'listItem',
 *       children: [{
 *         type: 'text',
 *         value: 'bar'
 *       }]
 *     }]
 *   });
 *   // '-   bar'
 *
 * @param {Object} node - `list` node with
 *   `ordered: false`.
 * @return {string} - Markdown list.
 */
compilerPrototype.visitUnorderedItems = function (node) {
    var self = this;
    var values = [];
    var children = node.children;
    var length = children.length;
    var index = -1;
    var bullet = self.options.bullet;

    while (++index < length) {
        values[index] = self.listItem(children[index], node, index, bullet);
    }

    return values.join(LINE);
};

/**
 * Stringify a block node with block children (e.g., `root`
 * or `blockquote`).
 *
 * Knows about code following a list, or adjacent lists
 * with similar bullets, and places an extra newline
 * between them.
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.block({
 *     type: 'root',
 *     children: [{
 *       type: 'paragraph',
 *       children: [{
 *         type: 'text',
 *         value: 'bar'
 *       }]
 *     }]
 *   });
 *   // 'bar'
 *
 * @param {Object} node - `root` node.
 * @return {string} - Markdown block content.
 */
compilerPrototype.block = function (node) {
    var self = this;
    var values = [];
    var children = node.children;
    var length = children.length;
    var index = -1;
    var child;
    var prev;

    while (++index < length) {
        child = children[index];

        if (prev) {
            /*
             * Duplicate nodes, such as a list
             * directly following another list,
             * often need multiple new lines.
             *
             * Additionally, code blocks following a list
             * might easily be mistaken for a paragraph
             * in the list itself.
             */

            if (child.type === prev.type && prev.type === 'list') {
                values.push(prev.ordered === child.ordered ? GAP : BREAK);
            } else if (
                prev.type === 'list' &&
                child.type === 'code' &&
                !child.lang
            ) {
                values.push(GAP);
            } else {
                values.push(BREAK);
            }
        }

        values.push(self.visit(child, node));

        prev = child;
    }

    return values.join(EMPTY);
};

/**
 * Stringify a root.
 *
 * Adds a final newline to ensure valid POSIX files.
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.root({
 *     type: 'root',
 *     children: [{
 *       type: 'paragraph',
 *       children: [{
 *         type: 'text',
 *         value: 'bar'
 *       }]
 *     }]
 *   });
 *   // 'bar'
 *
 * @param {Object} node - `root` node.
 * @return {string} - Markdown document.
 */
compilerPrototype.root = function (node) {
    return this.block(node) + LINE;
};

/**
 * Stringify a heading.
 *
 * In `setext: true` mode and when `depth` is smaller than
 * three, creates a setext header:
 *
 *     Foo
 *     ===
 *
 * Otherwise, an ATX header is generated:
 *
 *     ### Foo
 *
 * In `closeAtx: true` mode, the header is closed with
 * hashes:
 *
 *     ### Foo ###
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.heading({
 *     type: 'heading',
 *     depth: 2,
 *     children: [{
 *       type: 'strong',
 *       children: [{
 *         type: 'text',
 *         value: 'bar'
 *       }]
 *     }]
 *   });
 *   // '## **bar**'
 *
 * @param {Object} node - `heading` node.
 * @return {string} - Markdown heading.
 */
compilerPrototype.heading = function (node) {
    var self = this;
    var setext = self.options.setext;
    var closeAtx = self.options.closeAtx;
    var depth = node.depth;
    var content = self.all(node).join(EMPTY);
    var prefix;

    if (setext && depth < 3) {
        return content + LINE +
            repeat(depth === 1 ? EQUALS : DASH, content.length);
    }

    prefix = repeat(HASH, node.depth);
    content = prefix + SPACE + content;

    if (closeAtx) {
        content += SPACE + prefix;
    }

    return content;
};

/**
 * Stringify text.
 *
 * Supports named entities in `settings.encode: true` mode:
 *
 *     AT&amp;T
 *
 * Supports numbered entities in `settings.encode: numbers`
 * mode:
 *
 *     AT&#x26;T
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.text({
 *     type: 'text',
 *     value: 'foo'
 *   });
 *   // 'foo'
 *
 * @param {Object} node - `text` node.
 * @param {Object} parent - Parent of `node`.
 * @return {string} - Raw markdown text.
 */
compilerPrototype.text = function (node, parent) {
    return this.encode(this.escape(node.value, node, parent), node);
};

/**
 * Stringify a paragraph.
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.paragraph({
 *     type: 'paragraph',
 *     children: [{
 *       type: 'strong',
 *       children: [{
 *         type: 'text',
 *         value: 'bar'
 *       }]
 *     }]
 *   });
 *   // '**bar**'
 *
 * @param {Object} node - `paragraph` node.
 * @return {string} - Markdown paragraph.
 */
compilerPrototype.paragraph = function (node) {
    return this.all(node).join(EMPTY);
};

/**
 * Stringify a block quote.
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.paragraph({
 *     type: 'blockquote',
 *     children: [{
 *       type: 'paragraph',
 *       children: [{
 *         type: 'strong',
 *         children: [{
 *           type: 'text',
 *           value: 'bar'
 *         }]
 *       }]
 *     }]
 *   });
 *   // '> **bar**'
 *
 * @param {Object} node - `blockquote` node.
 * @return {string} - Markdown block quote.
 */
compilerPrototype.blockquote = function (node) {
    var values = this.block(node).split(LINE);
    var result = [];
    var length = values.length;
    var index = -1;
    var value;

    while (++index < length) {
        value = values[index];
        result[index] = (value ? SPACE : EMPTY) + value;
    }

    return ANGLE_BRACKET_CLOSE + result.join(LINE + ANGLE_BRACKET_CLOSE);
};

/**
 * Stringify a list. See `Compiler#visitOrderedList()` and
 * `Compiler#visitUnorderedList()` for internal working.
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.visitUnorderedItems({
 *     type: 'list',
 *     ordered: false,
 *     children: [{
 *       type: 'listItem',
 *       children: [{
 *         type: 'text',
 *         value: 'bar'
 *       }]
 *     }]
 *   });
 *   // '-   bar'
 *
 * @param {Object} node - `list` node.
 * @return {string} - Markdown list.
 */
compilerPrototype.list = function (node) {
    return this[ORDERED_MAP[node.ordered]](node);
};

/**
 * Stringify a list item.
 *
 * Prefixes the content with a checked checkbox when
 * `checked: true`:
 *
 *     [x] foo
 *
 * Prefixes the content with an unchecked checkbox when
 * `checked: false`:
 *
 *     [ ] foo
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.listItem({
 *     type: 'listItem',
 *     checked: true,
 *     children: [{
 *       type: 'text',
 *       value: 'bar'
 *     }]
 *   }, {
 *     type: 'list',
 *     ordered: false,
 *     children: [{
 *       type: 'listItem',
 *       checked: true,
 *       children: [{
 *         type: 'text',
 *         value: 'bar'
 *       }]
 *     }]
 *   }, 0, '*');
 *   '-   [x] bar'
 *
 * @param {Object} node - `listItem` node.
 * @param {Object} parent - `list` node.
 * @param {number} position - Index of `node` in `parent`.
 * @param {string} bullet - Bullet to use.  This, and the
 *   `listItemIndent` setting define the used indent.
 * @return {string} - Markdown list item.
 */
compilerPrototype.listItem = function (node, parent, position, bullet) {
    var self = this;
    var style = self.options.listItemIndent;
    var children = node.children;
    var values = [];
    var index = -1;
    var length = children.length;
    var loose = node.loose;
    var value;
    var indent;
    var spacing;

    while (++index < length) {
        values[index] = self.visit(children[index], node);
    }

    value = CHECKBOX_MAP[node.checked] + values.join(loose ? BREAK : LINE);

    if (
        style === LIST_ITEM_ONE ||
        (style === LIST_ITEM_MIXED && value.indexOf(LINE) === -1)
    ) {
        indent = bullet.length + 1;
        spacing = SPACE;
    } else {
        indent = Math.ceil((bullet.length + 1) / INDENT) * INDENT;
        spacing = repeat(SPACE, indent - bullet.length);
    }

    value = bullet + spacing + pad(value, indent / INDENT).slice(indent);

    if (loose && parent.children.length - 1 !== position) {
        value += LINE;
    }

    return value;
};

/**
 * Stringify inline code.
 *
 * Knows about internal ticks (`\``), and ensures one more
 * tick is used to enclose the inline code:
 *
 *     ```foo ``bar`` baz```
 *
 * Even knows about inital and final ticks:
 *
 *     `` `foo ``
 *     `` foo` ``
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.inlineCode({
 *     type: 'inlineCode',
 *     value: 'foo(); `bar`; baz()'
 *   });
 *   // '``foo(); `bar`; baz()``'
 *
 * @param {Object} node - `inlineCode` node.
 * @return {string} - Markdown inline code.
 */
compilerPrototype.inlineCode = function (node) {
    var value = node.value;
    var ticks = repeat(TICK, longestStreak(value, TICK) + 1);
    var start = ticks;
    var end = ticks;

    if (value.charAt(0) === TICK) {
        start += SPACE;
    }

    if (value.charAt(value.length - 1) === TICK) {
        end = SPACE + end;
    }

    return start + node.value + end;
};

/**
 * Stringify YAML front matter.
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.yaml({
 *     type: 'yaml',
 *     value: 'foo: bar'
 *   });
 *   // '---\nfoo: bar\n---'
 *
 * @param {Object} node - `yaml` node.
 * @return {string} - Markdown YAML document.
 */
compilerPrototype.yaml = function (node) {
    var delimiter = repeat(DASH, YAML_FENCE_LENGTH);
    var value = node.value ? LINE + node.value : EMPTY;

    return delimiter + value + LINE + delimiter;
};

/**
 * Stringify a code block.
 *
 * Creates indented code when:
 *
 * - No language tag exists;
 * - Not in `fences: true` mode;
 * - A non-empty value exists.
 *
 * Otherwise, GFM fenced code is created:
 *
 *     ```js
 *     foo();
 *     ```
 *
 * When in ``fence: `~` `` mode, uses tildes as fences:
 *
 *     ~~~js
 *     foo();
 *     ~~~
 *
 * Knows about internal fences (Note: GitHub/Kramdown does
 * not support this):
 *
 *     ````javascript
 *     ```markdown
 *     foo
 *     ```
 *     ````
 *
 * Supports named entities in the language flag with
 * `settings.encode` mode.
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.code({
 *     type: 'code',
 *     lang: 'js',
 *     value: 'fooo();'
 *   });
 *   // '```js\nfooo();\n```'
 *
 * @param {Object} node - `code` node.
 * @param {Object} parent - Parent of `node`.
 * @return {string} - Markdown code block.
 */
compilerPrototype.code = function (node, parent) {
    var self = this;
    var value = node.value;
    var options = self.options;
    var marker = options.fence;
    var language = self.encode(node.lang || EMPTY, node);
    var fence;

    /*
     * Without (needed) fences.
     */

    if (!language && !options.fences && value) {
        /*
         * Throw when pedantic, in a list item which
         * isn’t compiled using a tab.
         */

        if (
            parent &&
            parent.type === 'listItem' &&
            options.listItemIndent !== LIST_ITEM_TAB &&
            options.pedantic
        ) {
            self.file.fail(ERROR_LIST_ITEM_INDENT, node.position);
        }

        return pad(value, 1);
    }

    fence = longestStreak(value, marker) + 1;

    /*
     * Fix GFM / RedCarpet bug, where fence-like characters
     * inside fenced code can exit a code-block.
     * Yes, even when the outer fence uses different
     * characters, or is longer.
     * Thus, we can only pad the code to make it work.
     */

    if (FENCE.test(value)) {
        value = pad(value, 1);
    }

    fence = repeat(marker, Math.max(fence, MINIMUM_CODE_FENCE_LENGTH));

    return fence + language + LINE + value + LINE + fence;
};

/**
 * Stringify HTML.
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.html({
 *     type: 'html',
 *     value: '<div>bar</div>'
 *   });
 *   // '<div>bar</div>'
 *
 * @param {Object} node - `html` node.
 * @return {string} - Markdown HTML.
 */
compilerPrototype.html = function (node) {
    return node.value;
};

/**
 * Stringify a horizontal rule.
 *
 * The character used is configurable by `rule`: (`'_'`)
 *
 *     ___
 *
 * The number of repititions is defined through
 * `ruleRepetition`: (`6`)
 *
 *     ******
 *
 * Whether spaces delimit each character, is configured
 * through `ruleSpaces`: (`true`)
 *
 *     * * *
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.horizontalRule({
 *     type: 'horizontalRule'
 *   });
 *   // '***'
 *
 * @return {string} - Markdown rule.
 */
compilerPrototype.horizontalRule = function () {
    var options = this.options;
    var rule = repeat(options.rule, options.ruleRepetition);

    if (options.ruleSpaces) {
        rule = rule.split(EMPTY).join(SPACE);
    }

    return rule;
};

/**
 * Stringify a strong.
 *
 * The marker used is configurable by `strong`, which
 * defaults to an asterisk (`'*'`) but also accepts an
 * underscore (`'_'`):
 *
 *     _foo_
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.strong({
 *     type: 'strong',
 *     children: [{
 *       type: 'text',
 *       value: 'Foo'
 *     }]
 *   });
 *   // '**Foo**'
 *
 * @param {Object} node - `strong` node.
 * @return {string} - Markdown strong-emphasised text.
 */
compilerPrototype.strong = function (node) {
    var marker = this.options.strong;

    marker = marker + marker;

    return marker + this.all(node).join(EMPTY) + marker;
};

/**
 * Stringify an emphasis.
 *
 * The marker used is configurable by `emphasis`, which
 * defaults to an underscore (`'_'`) but also accepts an
 * asterisk (`'*'`):
 *
 *     *foo*
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.emphasis({
 *     type: 'emphasis',
 *     children: [{
 *       type: 'text',
 *       value: 'Foo'
 *     }]
 *   });
 *   // '_Foo_'
 *
 * @param {Object} node - `emphasis` node.
 * @return {string} - Markdown emphasised text.
 */
compilerPrototype.emphasis = function (node) {
    var marker = this.options.emphasis;

    return marker + this.all(node).join(EMPTY) + marker;
};

/**
 * Stringify a hard break.
 *
 * In Commonmark mode, trailing backslash form is used in order
 * to preserve trailing whitespace that the line may end with,
 * and also for better visibility.
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.break({
 *     type: 'break'
 *   });
 *   // '  \n'
 *
 * @return {string} - Hard markdown break.
 */
compilerPrototype.break = function () {
    return this.options.commonmark ? BACKSLASH + LINE : SPACE + SPACE + LINE;
};

/**
 * Stringify a delete.
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.delete({
 *     type: 'delete',
 *     children: [{
 *       type: 'text',
 *       value: 'Foo'
 *     }]
 *   });
 *   // '~~Foo~~'
 *
 * @param {Object} node - `delete` node.
 * @return {string} - Markdown strike-through.
 */
compilerPrototype.delete = function (node) {
    return DOUBLE_TILDE + this.all(node).join(EMPTY) + DOUBLE_TILDE;
};

/**
 * Stringify a link.
 *
 * When no title exists, the compiled `children` equal
 * `href`, and `href` starts with a protocol, an auto
 * link is created:
 *
 *     <http://example.com>
 *
 * Otherwise, is smart about enclosing `href` (see
 * `encloseURI()`) and `title` (see `encloseTitle()`).
 *
 *    [foo](<foo at bar dot com> 'An "example" e-mail')
 *
 * Supports named entities in the `href` and `title` when
 * in `settings.encode` mode.
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.link({
 *     type: 'link',
 *     href: 'http://example.com',
 *     title: 'Example Domain',
 *     children: [{
 *       type: 'text',
 *       value: 'Foo'
 *     }]
 *   });
 *   // '[Foo](http://example.com "Example Domain")'
 *
 * @param {Object} node - `link` node.
 * @return {string} - Markdown link.
 */
compilerPrototype.link = function (node) {
    var self = this;
    var url = self.encode(node.href, node);
    var exit = self.enterLink();
    var escapedURL = self.encode(self.escape(node.href, node));
    var value = self.all(node).join(EMPTY);

    exit();

    if (
        node.title === null &&
        PROTOCOL.test(url) &&
        (escapedURL === value || escapedURL === MAILTO + value)
    ) {
        /*
         * Backslash escapes do not work in autolinks,
         * so we do not escape.
         */

        return encloseURI(self.encode(node.href), true);
    }

    url = encloseURI(url);

    if (node.title) {
        url += SPACE + encloseTitle(self.encode(self.escape(
            node.title, node
        ), node));
    }

    value = SQUARE_BRACKET_OPEN + value + SQUARE_BRACKET_CLOSE;

    value += PARENTHESIS_OPEN + url + PARENTHESIS_CLOSE;

    return value;
};

/**
 * Stringify a link label.
 *
 * Because link references are easily, mistakingly,
 * created (for example, `[foo]`), reference nodes have
 * an extra property depicting how it looked in the
 * original document, so stringification can cause minimal
 * changes.
 *
 * @example
 *   label({
 *     type: 'referenceImage',
 *     referenceType: 'full',
 *     identifier: 'foo'
 *   });
 *   // '[foo]'
 *
 *   label({
 *     type: 'referenceImage',
 *     referenceType: 'collapsed',
 *     identifier: 'foo'
 *   });
 *   // '[]'
 *
 *   label({
 *     type: 'referenceImage',
 *     referenceType: 'shortcut',
 *     identifier: 'foo'
 *   });
 *   // ''
 *
 * @param {Object} node - `linkReference` or
 *   `imageReference` node.
 * @return {string} - Markdown label reference.
 */
function label(node) {
    var value = EMPTY;
    var type = node.referenceType;

    if (type === 'full') {
        value = node.identifier;
    }

    if (type !== 'shortcut') {
        value = SQUARE_BRACKET_OPEN + value + SQUARE_BRACKET_CLOSE;
    }

    return value;
}

/**
 * For shortcut reference links, the contents is also an
 * identifier, and for identifiers extra backslashes do
 * matter.
 *
 * This function takes an escaped value from shortcut's children
 * and an identifier and removes extra backslashes.
 *
 * @example
 *   unescapeShortcutLinkReference('a\\*b', 'a*b')
 *   // 'a*b'
 *
 * @param {string} value - Escaped and stringified link value.
 * @param {string} identifier - Link identifier, in one of its
 *   equivalent forms.
 * @return {string} - Link value with some characters unescaped.
 */
function unescapeShortcutLinkReference(value, identifier) {
    var index = 0;
    var position = 0;
    var length = value.length;
    var count = identifier.length;
    var result = [];
    var start;

    while (index < length) {
        /*
         * Take next non-punctuation characters from `value`.
         */

        start = index;

        while (
            index < length &&
            !PUNCTUATION.test(value.charAt(index))
        ) {
            index += 1;
        }

        result.push(value.slice(start, index));

        /*
         * Advance `position` to the next punctuation character.
         */
        while (
            position < count &&
            !PUNCTUATION.test(identifier.charAt(position))
        ) {
            position += 1;
        }

        /*
         * Take next punctuation characters from `identifier`.
         */
        start = position;

        while (
            position < count &&
            PUNCTUATION.test(identifier.charAt(position))
        ) {
            position += 1;
        }

        result.push(identifier.slice(start, position));

        /*
         * Advance `index` to the next non-punctuation character.
         */
        while (index < length && PUNCTUATION.test(value.charAt(index))) {
            index += 1;
        }
    }

    return result.join(EMPTY);
}

/**
 * Stringify a link reference.
 *
 * See `label()` on how reference labels are created.
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.linkReference({
 *     type: 'linkReference',
 *     referenceType: 'collapsed',
 *     identifier: 'foo',
 *     children: [{
 *       type: 'text',
 *       value: 'Foo'
 *     }]
 *   });
 *   // '[Foo][]'
 *
 * @param {Object} node - `linkReference` node.
 * @return {string} - Markdown link reference.
 */
compilerPrototype.linkReference = function (node) {
    var self = this;
    var exitLink = self.enterLink();
    var value = self.all(node).join(EMPTY);

    exitLink();

    if (node.referenceType == 'shortcut') {
        value = unescapeShortcutLinkReference(value, node.identifier);
    }

    return SQUARE_BRACKET_OPEN + value + SQUARE_BRACKET_CLOSE + label(node);
};

/**
 * Stringify an image reference.
 *
 * See `label()` on how reference labels are created.
 *
 * Supports named entities in the `alt` when
 * in `settings.encode` mode.
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.imageReference({
 *     type: 'imageReference',
 *     referenceType: 'full',
 *     identifier: 'foo',
 *     alt: 'Foo'
 *   });
 *   // '![Foo][foo]'
 *
 * @param {Object} node - `imageReference` node.
 * @return {string} - Markdown image reference.
 */
compilerPrototype.imageReference = function (node) {
    var alt = this.encode(node.alt, node) || EMPTY;

    return EXCLAMATION_MARK +
        SQUARE_BRACKET_OPEN + alt + SQUARE_BRACKET_CLOSE +
        label(node);
};

/**
 * Stringify a footnote reference.
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.footnoteReference({
 *     type: 'footnoteReference',
 *     identifier: 'foo'
 *   });
 *   // '[^foo]'
 *
 * @param {Object} node - `footnoteReference` node.
 * @return {string} - Markdown footnote reference.
 */
compilerPrototype.footnoteReference = function (node) {
    return SQUARE_BRACKET_OPEN + CARET + node.identifier +
        SQUARE_BRACKET_CLOSE;
};

/**
 * Stringify an link- or image definition.
 *
 * Is smart about enclosing `href` (see `encloseURI()`) and
 * `title` (see `encloseTitle()`).
 *
 *    [foo]: <foo at bar dot com> 'An "example" e-mail'
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.definition({
 *     type: 'definition',
 *     link: 'http://example.com',
 *     title: 'Example Domain',
 *     identifier: 'foo'
 *   });
 *   // '[foo]: http://example.com "Example Domain"'
 *
 * @param {Object} node - `definition` node.
 * @return {string} - Markdown link- or image definition.
 */
compilerPrototype.definition = function (node) {
    var value = SQUARE_BRACKET_OPEN + node.identifier + SQUARE_BRACKET_CLOSE;
    var url = encloseURI(node.link);

    if (node.title) {
        url += SPACE + encloseTitle(node.title);
    }

    return value + COLON + SPACE + url;
};

/**
 * Stringify an image.
 *
 * Is smart about enclosing `href` (see `encloseURI()`) and
 * `title` (see `encloseTitle()`).
 *
 *    ![foo](</fav icon.png> 'My "favourite" icon')
 *
 * Supports named entities in `src`, `alt`, and `title`
 * when in `settings.encode` mode.
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.image({
 *     type: 'image',
 *     href: 'http://example.png/favicon.png',
 *     title: 'Example Icon',
 *     alt: 'Foo'
 *   });
 *   // '![Foo](http://example.png/favicon.png "Example Icon")'
 *
 * @param {Object} node - `image` node.
 * @return {string} - Markdown image.
 */
compilerPrototype.image = function (node) {
    var url = encloseURI(this.encode(node.src, node));
    var value;

    if (node.title) {
        url += SPACE + encloseTitle(this.encode(node.title, node));
    }

    value = EXCLAMATION_MARK +
        SQUARE_BRACKET_OPEN + this.encode(node.alt || EMPTY, node) +
        SQUARE_BRACKET_CLOSE;

    value += PARENTHESIS_OPEN + url + PARENTHESIS_CLOSE;

    return value;
};

/**
 * Stringify a footnote.
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.footnote({
 *     type: 'footnote',
 *     children: [{
 *       type: 'text',
 *       value: 'Foo'
 *     }]
 *   });
 *   // '[^Foo]'
 *
 * @param {Object} node - `footnote` node.
 * @return {string} - Markdown footnote.
 */
compilerPrototype.footnote = function (node) {
    return SQUARE_BRACKET_OPEN + CARET + this.all(node).join(EMPTY) +
        SQUARE_BRACKET_CLOSE;
};

/**
 * Stringify a footnote definition.
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.footnoteDefinition({
 *     type: 'footnoteDefinition',
 *     identifier: 'foo',
 *     children: [{
 *       type: 'paragraph',
 *       children: [{
 *         type: 'text',
 *         value: 'bar'
 *       }]
 *     }]
 *   });
 *   // '[^foo]: bar'
 *
 * @param {Object} node - `footnoteDefinition` node.
 * @return {string} - Markdown footnote definition.
 */
compilerPrototype.footnoteDefinition = function (node) {
    var id = node.identifier.toLowerCase();

    return SQUARE_BRACKET_OPEN + CARET + id +
        SQUARE_BRACKET_CLOSE + COLON + SPACE +
        this.all(node).join(BREAK + repeat(SPACE, INDENT));
};

/**
 * Stringify table.
 *
 * Creates a fenced table by default, but not in
 * `looseTable: true` mode:
 *
 *     Foo | Bar
 *     :-: | ---
 *     Baz | Qux
 *
 * NOTE: Be careful with `looseTable: true` mode, as a
 * loose table inside an indented code block on GitHub
 * renders as an actual table!
 *
 * Creates a spaces table by default, but not in
 * `spacedTable: false`:
 *
 *     |Foo|Bar|
 *     |:-:|---|
 *     |Baz|Qux|
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.table({
 *     type: 'table',
 *     align: ['center', null],
 *     children: [
 *       {
 *         type: 'tableHeader',
 *         children: [
 *           {
 *             type: 'tableCell'
 *             children: [{
 *               type: 'text'
 *               value: 'Foo'
 *             }]
 *           },
 *           {
 *             type: 'tableCell'
 *             children: [{
 *               type: 'text'
 *               value: 'Bar'
 *             }]
 *           }
 *         ]
 *       },
 *       {
 *         type: 'tableRow',
 *         children: [
 *           {
 *             type: 'tableCell'
 *             children: [{
 *               type: 'text'
 *               value: 'Baz'
 *             }]
 *           },
 *           {
 *             type: 'tableCell'
 *             children: [{
 *               type: 'text'
 *               value: 'Qux'
 *             }]
 *           }
 *         ]
 *       }
 *     ]
 *   });
 *   // '| Foo | Bar |\n| :-: | --- |\n| Baz | Qux |'
 *
 * @param {Object} node - `table` node.
 * @return {string} - Markdown table.
 */
compilerPrototype.table = function (node) {
    var self = this;
    var loose = self.options.looseTable;
    var spaced = self.options.spacedTable;
    var rows = node.children;
    var index = rows.length;
    var exit = self.enterTable();
    var result = [];
    var start;

    while (index--) {
        result[index] = self.all(rows[index]);
    }

    exit();

    start = loose ? EMPTY : spaced ? PIPE + SPACE : PIPE;

    return table(result, {
        'align': node.align,
        'start': start,
        'end': start.split(EMPTY).reverse().join(EMPTY),
        'delimiter': spaced ? SPACE + PIPE + SPACE : PIPE
    });
};

/**
 * Stringify a table cell.
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.tableCell({
 *     type: 'tableCell',
 *     children: [{
 *       type: 'text'
 *       value: 'Qux'
 *     }]
 *   });
 *   // 'Qux'
 *
 * @param {Object} node - `tableCell` node.
 * @return {string} - Markdown table cell.
 */
compilerPrototype.tableCell = function (node) {
    return this.all(node).join(EMPTY);
};

/**
 * Stringify the bound file.
 *
 * @example
 *   var file = new VFile('__Foo__');
 *
 *   file.namespace('mdast').tree = {
 *     type: 'strong',
 *     children: [{
 *       type: 'text',
 *       value: 'Foo'
 *     }]
 *   });
 *
 *   new Compiler(file).compile();
 *   // '**Foo**'
 *
 * @this {Compiler}
 * @return {string} - Markdown document.
 */
compilerPrototype.compile = function () {
    return this.visit(this.file.namespace('mdast').tree);
};

/*
 * Expose `stringify` on `module.exports`.
 */

module.exports = Compiler;

},{"./defaults.js":58,"./utilities.js":62,"ccount":7,"extend.js":19,"longest-streak":24,"markdown-table":25,"parse-entities":31,"repeat-string":63,"stringify-entities":70}],62:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2015-2016 Titus Wormer
 * @license MIT
 * @module remark:utilities
 * @version 3.2.0
 * @fileoverview Collection of tiny helpers useful for
 *   both parsing and compiling markdown.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var collapseWhiteSpace = require('collapse-white-space');

/*
 * Expressions.
 */

var EXPRESSION_LINE_BREAKS = /\r\n|\r/g;
var EXPRESSION_SYMBOL_FOR_NEW_LINE = /\u2424/g;
var EXPRESSION_BOM = /^\ufeff/;

/**
 * Throw an exception with in its `message` `value`
 * and `name`.
 *
 * @param {*} value - Invalid value.
 * @param {string} name - Setting name.
 */
function raise(value, name) {
    throw new Error(
        'Invalid value `' + value + '` ' +
        'for setting `' + name + '`'
    );
}

/**
 * Validate a value to be boolean. Defaults to `def`.
 * Raises an exception with `context[name]` when not
 * a boolean.
 *
 * @example
 *   validateBoolean({foo: null}, 'foo', true) // true
 *   validateBoolean({foo: false}, 'foo', true) // false
 *   validateBoolean({foo: 'bar'}, 'foo', true) // Throws
 *
 * @throws {Error} - When a setting is neither omitted nor
 *   a boolean.
 * @param {Object} context - Settings.
 * @param {string} name - Setting name.
 * @param {boolean} def - Default value.
 */
function validateBoolean(context, name, def) {
    var value = context[name];

    if (value === null || value === undefined) {
        value = def;
    }

    if (typeof value !== 'boolean') {
        raise(value, 'options.' + name);
    }

    context[name] = value;
}

/**
 * Validate a value to be boolean. Defaults to `def`.
 * Raises an exception with `context[name]` when not
 * a boolean.
 *
 * @example
 *   validateNumber({foo: null}, 'foo', 1) // 1
 *   validateNumber({foo: 2}, 'foo', 1) // 2
 *   validateNumber({foo: 'bar'}, 'foo', 1) // Throws
 *
 * @throws {Error} - When a setting is neither omitted nor
 *   a number.
 * @param {Object} context - Settings.
 * @param {string} name - Setting name.
 * @param {number} def - Default value.
 */
function validateNumber(context, name, def) {
    var value = context[name];

    if (value === null || value === undefined) {
        value = def;
    }

    if (typeof value !== 'number' || value !== value) {
        raise(value, 'options.' + name);
    }

    context[name] = value;
}

/**
 * Validate a value to be in `map`. Defaults to `def`.
 * Raises an exception with `context[name]` when not
 * not in `map`.
 *
 * @example
 *   var map = {bar: true, baz: true};
 *   validateString({foo: null}, 'foo', 'bar', map) // 'bar'
 *   validateString({foo: 'baz'}, 'foo', 'bar', map) // 'baz'
 *   validateString({foo: true}, 'foo', 'bar', map) // Throws
 *
 * @throws {Error} - When a setting is neither omitted nor
 *   in `map`.
 * @param {Object} context - Settings.
 * @param {string} name - Setting name.
 * @param {string} def - Default value.
 * @param {Object} map - Enum.
 */
function validateString(context, name, def, map) {
    var value = context[name];

    if (value === null || value === undefined) {
        value = def;
    }

    if (!(value in map)) {
        raise(value, 'options.' + name);
    }

    context[name] = value;
}

/**
 * Clean a string in preperation of parsing.
 *
 * @example
 *   clean('\ufefffoo'); // 'foo'
 *   clean('foo\r\nbar'); // 'foo\nbar'
 *   clean('foo\u2424bar'); // 'foo\nbar'
 *
 * @param {string} value - Content to clean.
 * @return {string} - Cleaned content.
 */
function clean(value) {
    return String(value)
        .replace(EXPRESSION_BOM, '')
        .replace(EXPRESSION_LINE_BREAKS, '\n')
        .replace(EXPRESSION_SYMBOL_FOR_NEW_LINE, '\n');
}

/**
 * Normalize an identifier.  Collapses multiple white space
 * characters into a single space, and removes casing.
 *
 * @example
 *   normalizeIdentifier('FOO\t bar'); // 'foo bar'
 *
 * @param {string} value - Content to normalize.
 * @return {string} - Normalized content.
 */
function normalizeIdentifier(value) {
    return collapseWhiteSpace(value).toLowerCase();
}

/**
 * Construct a state `toggler`: a function which inverses
 * `property` in context based on its current value.
 * The by `toggler` returned function restores that value.
 *
 * @example
 *   var context = {};
 *   var key = 'foo';
 *   var val = true;
 *   context[key] = val;
 *   context.enter = stateToggler(key, val);
 *   context[key]; // true
 *   var exit = context.enter();
 *   context[key]; // false
 *   var nested = context.enter();
 *   context[key]; // false
 *   nested();
 *   context[key]; // false
 *   exit();
 *   context[key]; // true
 *
 * @param {string} key - Property to toggle.
 * @param {boolean} state - It's default state.
 * @return {function(): function()} - Enter.
 */
function stateToggler(key, state) {
    /**
     * Construct a toggler for the bound `key`.
     *
     * @return {Function} - Exit state.
     */
    function enter() {
        var self = this;
        var current = self[key];

        self[key] = !state;

        /**
         * State canceler, cancels the state, if allowed.
         */
        function exit() {
            self[key] = current;
        }

        return exit;
    }

    return enter;
}

/*
 * Define nodes of a type which can be merged.
 */

var MERGEABLE_NODES = {};

/**
 * Check whether a node is mergeable with adjacent nodes.
 *
 * @param {Object} node - Node to check.
 * @return {boolean} - Whether `node` is mergable.
 */
function mergeable(node) {
    var start;
    var end;

    if (node.type !== 'text' || !node.position) {
        return true;
    }

    start = node.position.start;
    end = node.position.end;

    /*
     * Only merge nodes which occupy the same size as their
     * `value`.
     */

    return start.line !== end.line ||
        end.column - start.column === node.value.length;
}

/**
 * Merge two text nodes: `node` into `prev`.
 *
 * @param {Object} prev - Preceding sibling.
 * @param {Object} node - Following sibling.
 * @return {Object} - `prev`.
 */
MERGEABLE_NODES.text = function (prev, node) {
    prev.value += node.value;

    return prev;
};

/**
 * Merge two blockquotes: `node` into `prev`, unless in
 * CommonMark mode.
 *
 * @param {Object} prev - Preceding sibling.
 * @param {Object} node - Following sibling.
 * @return {Object} - `prev`, or `node` in CommonMark mode.
 */
MERGEABLE_NODES.blockquote = function (prev, node) {
    if (this.options.commonmark) {
        return node;
    }

    prev.children = prev.children.concat(node.children);

    return prev;
};

/*
 * Expose `validate`.
 */

exports.validate = {
    'boolean': validateBoolean,
    'string': validateString,
    'number': validateNumber
};

/*
 * Expose.
 */

exports.normalizeIdentifier = normalizeIdentifier;
exports.clean = clean;
exports.raise = raise;
exports.stateToggler = stateToggler;
exports.mergeable = mergeable;
exports.MERGEABLE_NODES = MERGEABLE_NODES;

},{"collapse-white-space":18}],63:[function(require,module,exports){
/*!
 * repeat-string <https://github.com/jonschlinkert/repeat-string>
 *
 * Copyright (c) 2014-2015, Jon Schlinkert.
 * Licensed under the MIT License.
 */

'use strict';

/**
 * Expose `repeat`
 */

module.exports = repeat;

/**
 * Repeat the given `string` the specified `number`
 * of times.
 *
 * **Example:**
 *
 * ```js
 * var repeat = require('repeat-string');
 * repeat('A', 5);
 * //=> AAAAA
 * ```
 *
 * @param {String} `string` The string to repeat
 * @param {Number} `number` The number of times to repeat the string
 * @return {String} Repeated string
 * @api public
 */

function repeat(str, num) {
  if (typeof str !== 'string') {
    throw new TypeError('repeat-string expects a string.');
  }

  if (num === 1) return str;
  if (num === 2) return str + str;

  var max = str.length * num;
  if (cache !== str || typeof cache === 'undefined') {
    cache = str;
    res = '';
  }

  while (max > res.length && num > 0) {
    if (num & 1) {
      res += str;
    }

    num >>= 1;
    if (!num) break;
    str += str;
  }

  return res.substr(0, max);
}

/**
 * Results cache
 */

var res = '';
var cache;

},{}],64:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer
 * @license MIT
 * @module retext:english
 * @fileoverview English language support for retext.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var Parser = require('parse-english');

/**
 * Attach `parse-english`.
 *
 * @param {Retext} processor - Instance.
 */
function attacher(processor) {
    processor.Parser = Parser;
}

/*
 * Expose.
 */

module.exports = attacher;

},{"parse-english":30}],65:[function(require,module,exports){
'use strict';

module.exports = require('./lib/equality.js');

},{"./lib/equality.js":66}],66:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer
 * @license MIT
 * @module retext:equality
 * @fileoverview Warn about possible insensitive, inconsiderate language
 *   with Retext.
 */

'use strict';

/*
 * Dependencies.
 */

var keys = require('object-keys');
var visit = require('unist-util-visit');
var nlcstToString = require('nlcst-to-string');
var isLiteral = require('nlcst-is-literal');
var patterns = require('./patterns.json');

/*
 * Internal mapping.
 */

var byId = {};
var byWord = {};

(function () {
    var index = -1;
    var length = patterns.length;
    var pattern;
    var inconsiderate;
    var id;
    var phrase;
    var firstWord;

    while (++index < length) {
        pattern = patterns[index];
        inconsiderate = pattern.inconsiderate;
        id = pattern.id;

        byId[id] = pattern;

        for (phrase in inconsiderate) {
            firstWord = phrase.split(' ')[0].toLowerCase();

            if (firstWord in byWord) {
                byWord[firstWord].push(id);
            } else {
                byWord[firstWord] = [id];
            }
        }
    }
})();

/**
 * Get the first key at which `value` lives in `context`.
 *
 * @todo Externalise.
 * @param {Object} object - Context to search in.
 * @param {*} value - Value to search for.
 * @return {string?} - First key at which `value` lives,
 *   when applicable.
 */
function byValue(object, value) {
    var key;

    for (key in object) {
        if (object[key] === value) {
            return key;
        }
    }

    /* istanbul ignore next */
    return null;
}

/**
 * Get a string value from a node.
 *
 * @param {NLCSTNode} node - NLCST node.
 * @return {string}
 */
function toString(node) {
    return nlcstToString(node).replace(/['’-]/g, '');
}

/**
 * Get the value of multiple nodes
 *
 * @param {Array.<NLCSTNode>} node - NLCST nodes.
 * @return {string}
 */
function valueOf(node) {
    return nlcstToString({
        'children': node
    });
}

/**
 * Check `expression` in `parent` at `position`,
 * where `expression` is list of words.
 *
 * @param {Array} phrase - List of words.
 * @param {NLCSTNode} parent - Parent node.
 * @param {number} position - Position in `parent` to
 *   check.
 * @return {Array.<NLCSTNode>?} - When matched to
 *   skip, because one word matched.
 */
function matches(phrase, parent, position) {
    var siblings = parent.children;
    var node = siblings[position];
    var queue = [node];
    var index = -1;
    var length;

    phrase = phrase.split(' ');
    length = phrase.length;

    while (++index < length) {
        /*
         * Check if this node matches.
         */

        if (!node || phrase[index] !== toString(node).toLowerCase()) {
            return null;
        }

        /*
         * Exit if this is the last node.
         */

        if (index === length - 1) {
            break;
        }

        /*
         * Find the next word.
         */

        while (++position < siblings.length) {
            node = siblings[position];
            queue.push(node);

            if (node.type === 'WordNode') {
                break;
            }

            if (node.type === 'WhiteSpaceNode') {
                continue;
            }

            return null;
        }
    }

    return queue;
}

/**
 * Check `expression` in `parent` at `position`.
 *
 * @param {Object} expression - Violation expression.
 * @param {NLCSTNode} parent - Parent node.
 * @param {number} position - Position in `parent` to
 *   check.
 * @return {Object?} - Result.
 */
function check(expression, parent, position) {
    var values = expression.inconsiderate;
    var phrase;
    var result;

    for (phrase in values) {
        result = matches(phrase, parent, position);

        if (result) {
            return {
                'end': position + result.length - 1,
                'category': values[phrase]
            };
        }
    }

    return null;
}

/**
 * Create a human readable warning message for `violation`
 * and suggest `suggestion`.
 *
 * @example
 *   message('one', 'two');
 *   // '`one` may be insensitive, use `two` instead'
 *
 *   message(['one', 'two'], 'three');
 *   // '`one`, `two` may be insensitive, use `three` instead'
 *
 *   message(['one', 'two'], 'three', '/');
 *   // '`one` / `two` may be insensitive, use `three` instead'
 *
 * @param {*} violation - One or more violations.
 * @param {*} suggestion - One or more suggestions.
 * @param {string} [joiner] - Joiner to use.
 * @return {string} - Human readable warning.
 */
function message(violation, suggestion, joiner) {
    return quote(violation, joiner) +
        ' may be insensitive, use ' +
        quote(suggestion, joiner) +
        ' instead';
}

/**
 * Quote text meant as literal.
 *
 * @example
 *   quote('one');
 *   // '`one`'
 *
 * @example
 *   quote(['one', 'two']);
 *   // '`one`, `two`'
 *
 * @example
 *   quote(['one', 'two'], '/');
 *   // '`one` / `two`'
 *
 * @param {string|Array.<string>} value - One or more
 *   violations.
 * @param {string} [joiner] - Joiner to use.
 * @return {string} - Quoted, joined `value`.
 */
function quote(value, joiner) {
    joiner = !joiner || joiner === ',' ? '`, `' : '` ' + joiner + ' `';

    return '`' + (value.join ? value.join(joiner) : value) + '`';
}

/**
 * Check whether the first character of a given value is
 * upper-case. Supports a string, or a list of strings.
 * Defers to the standard library for what defines
 * a “upper case” letter.
 *
 * @example
 *   isCapitalized('one'); // false
 *   isCapitalized('One'); // true
 *
 * @example
 *   isCapitalized(['one', 'Two']); // false
 *   isCapitalized(['One', 'two']); // true
 *
 * @param {string|Array.<string>} value - One, or a list
 *   of strings.
 * @return {boolean} - Whether the first character is
 *   upper-case.
 */
function isCapitalized(value) {
    var character = (value.charAt ? value : value[0]).charAt(0);

    return character.toUpperCase() === character;
}

/**
 * Capitalize a list of values.
 *
 * @example
 *   capitalize(['one', 'two']); // ['One', 'Two']
 *
 * @param {Array.<string>} value - List of values.
 * @return {Array.<string>} - Capitalized values.
 */
function capitalize(value) {
    var result = [];
    var index = -1;
    var length;

    length = value.length;

    while (++index < length) {
        result[index] = value[index].charAt(0).toUpperCase() +
            value[index].slice(1);
    }

    return result;
}

/**
 * Warn on `file` about `violation` (at `node`) with
 * `suggestion`s.
 *
 * @param {File} file - Virtual file.
 * @param {string|Array.<string>} violation - One or more
 *   violations.
 * @param {string|Array.<string>} suggestion - One or more
 *   suggestions.
 * @param {Node} node - Node which violates.
 * @param {string?} [note] - Extensive description.
 * @param {string?} [joiner] - Joiner of message.
 * @param {NLCSTNode} node - Node which violates.
 */
function warn(file, violation, suggestion, node, note, joiner) {
    var warning;

    if (!('join' in suggestion)) {
        suggestion = keys(suggestion);
    }

    if (isCapitalized(violation)) {
        suggestion = capitalize(suggestion);
    }

    warning = file.warn(message(violation, suggestion, joiner), node);

    if (note) {
        warning.note = note;
    }
}

/**
 * Test `epxression` on the node at `position` in
 * `parent`.
 *
 * @param {File} file - Virtual file.
 * @param {Object} expression - An expression mapping
 *   offenses to fixes.
 * @param {number} position - Index in `parent`
 * @param {Node} parent - Parent node.
 */
function test(file, expression, position, parent) {
    var result = check(expression, parent, position);

    if (result) {
        return {
            'id': expression.id,
            'type': result.category,
            'parent': parent,
            'start': position,
            'end': result.end
        };
    }

    return null;
}

/**
 * Handle matches for a `simple` pattern.  Simple-patterns
 * need no extra logic, every match is triggered as a
 * warning.
 *
 * @param {Array.<Object>} matches - List of matches
 *   matching `pattern` in a context.
 * @param {Object} pattern - Simple-pattern object.
 * @param {VFile} file - Virtual file.
 */
function simple(matches, pattern, file) {
    var length = matches.length;
    var index = -1;
    var match;
    var siblings;

    while (++index < length) {
        match = matches[index];
        siblings = match.parent.children;

        warn(file, valueOf(
            siblings.slice(match.start, match.end + 1)
        ), pattern.considerate, siblings[match.start], pattern.note);
    }
}

/**
 * Handle matches for an `and` pattern.  And-patterns
 * trigger a warning when every category is present.
 *
 * For example, when `master` and `slave` occur in a
 * context together, they trigger a warning.
 *
 * @param {Array.<Object>} matches - List of matches
 *   matching `pattern` in a context.
 * @param {Object} pattern - And-pattern object.
 * @param {VFile} file - Virtual file.
 */
function and(matches, pattern, file) {
    var categories = pattern.categories.concat();
    var length = matches.length;
    var index = -1;
    var phrases = [];
    var suggestions = [];
    var match;
    var position;
    var siblings;
    var first;

    while (++index < length) {
        match = matches[index];
        siblings = match.parent.children;
        position = categories.indexOf(match.type);

        if (position !== -1) {
            categories.splice(position, 1);
            phrases.push(valueOf(siblings.slice(match.start, match.end + 1)));
            suggestions.push(byValue(pattern.considerate, match.type));

            if (!first) {
                first = siblings[match.start];
            }

            if (categories.length === 0) {
                warn(file, phrases, suggestions, first, pattern.note, '/');
            }
        }
    }
}

/**
 * Handle matches for an `or` pattern.  Or-patterns
 * trigger a warning unless every category is present.
 *
 * For example, when `him` and `her` occur adjacent
 * to each other, they are not warned about. But when
 * they occur alone, they are.
 *
 * @param {Array.<Object>} matches - List of matches
 *   matching `pattern` in a context.
 * @param {Object} pattern - Or-pattern object.
 * @param {VFile} file - Virtual file.
 */
function or(matches, pattern, file) {
    var length = matches.length;
    var index = -1;
    var match;
    var next;
    var siblings;
    var sibling;
    var start;
    var end;

    while (++index < length) {
        match = matches[index];
        siblings = match.parent.children;
        next = matches[index + 1];

        if (
            next &&
            next.parent === match.parent &&
            next.type !== match.type
        ) {
            start = match.end;
            end = next.start;

            while (++start < end) {
                sibling = siblings[start];

                if (
                    sibling.type === 'WhiteSpaceNode' ||
                    (
                        sibling.type === 'WordNode' &&
                        /(and|or)/.test(toString(sibling))
                    )
                ) {
                    continue;
                }

                break;
            }

            /*
             * If we didn't break...
             */

            if (start === end) {
                index++;
                continue;
            }
        }

        warn(file, valueOf(
            siblings.slice(match.start, match.end + 1)
        ), pattern.considerate, siblings[match.start], pattern.note);
    }
}

/*
 * Dictionary of handled patterns.
 */

var handlers = {};

handlers.and = and;
handlers.or = or;
handlers.simple = simple;

/**
 * Factory to create a visitor which warns on `file`.
 *
 * @param {File} file - Virtual file.
 * @return {Function} - Paragraph visitor.
 */
function factory(file) {
    /**
     * Search `node` for violations.
     *
     * @param {NLCSTParagraphNode} node - Paragraph.
     */
    return function (node) {
        var matches = {};
        var id;
        var pattern;

        /*
         * Find offending words.
         */

        visit(node, 'WordNode', function (child, position, parent) {
            var value;
            var patterns;
            var length;
            var index;
            var result;

            if (isLiteral(parent, position)) {
                return;
            }

            value = toString(child).toLowerCase()
            patterns = byWord.hasOwnProperty(value) ? byWord[value] : null;
            length = patterns ? patterns.length : 0;
            index = -1;

            while (++index < length) {
                result = test(file, byId[patterns[index]], position, parent);

                if (result) {
                    if (result.id in matches) {
                        matches[result.id].push(result);
                    } else {
                        matches[result.id] = [result];
                    }
                }
            }
        });

        /*
         * Ignore or trigger offending words based on
         * their pattern.
         */

        for (id in matches) {
            pattern = byId[id];
            handlers[pattern.type](matches[id], pattern, file);
        }
    };
}

/**
 * Transformer.
 *
 * @param {NLCSTNode} cst - Syntax tree.
 */
function transformer(cst, file) {
    visit(cst, 'ParagraphNode', factory(file));
}

/**
 * Attacher.
 *
 * @return {Function} - `transformer`.
 */
function attacher() {
    return transformer;
}

/*
 * Expose.
 */

module.exports = attacher;

},{"./patterns.json":67,"nlcst-is-literal":26,"nlcst-to-string":27,"object-keys":28,"unist-util-visit":79}],67:[function(require,module,exports){
module.exports=[
  {
    "id": 0,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "their": "a",
      "theirs": "a",
      "them": "a"
    },
    "inconsiderate": {
      "her": "female",
      "hers": "female",
      "him": "male",
      "his": "male"
    }
  },
  {
    "id": 1,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "they": "a",
      "it": "a"
    },
    "inconsiderate": {
      "she": "female",
      "he": "male"
    }
  },
  {
    "id": 2,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "themselves": "a",
      "theirself": "a",
      "self": "a"
    },
    "inconsiderate": {
      "herself": "female",
      "himself": "male"
    }
  },
  {
    "id": 3,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "kid": "a",
      "child": "a"
    },
    "inconsiderate": {
      "girl": "female",
      "boy": "male"
    }
  },
  {
    "id": 4,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "people": "a",
      "persons": "a",
      "folks": "a"
    },
    "inconsiderate": {
      "women": "female",
      "girls": "female",
      "gals": "female",
      "ladies": "female",
      "men": "male",
      "guys": "male",
      "dudes": "male",
      "gents": "male",
      "gentlemen": "male",
      "mankind": "male"
    }
  },
  {
    "id": 5,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "person": "a",
      "friend": "a",
      "pal": "a",
      "folk": "a",
      "individual": "a"
    },
    "inconsiderate": {
      "woman": "female",
      "gal": "female",
      "lady": "female",
      "babe": "female",
      "bimbo": "female",
      "chick": "female",
      "guy": "male",
      "lad": "male",
      "fellow": "male",
      "dude": "male",
      "bro": "male",
      "gentleman": "male"
    }
  },
  {
    "id": 6,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "native land": "a"
    },
    "inconsiderate": {
      "motherland": "female",
      "fatherland": "male"
    }
  },
  {
    "id": 7,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "native tongue": "a",
      "native language": "a"
    },
    "inconsiderate": {
      "mother tongue": "female",
      "father tongue": "male"
    }
  },
  {
    "id": 8,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "first-year students": "a",
      "freshers": "a"
    },
    "inconsiderate": {
      "freshwomen": "female",
      "freshmen": "male"
    }
  },
  {
    "id": 9,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "garbage collector": "a",
      "waste collector": "a",
      "trash collector": "a"
    },
    "inconsiderate": {
      "garbagewoman": "female",
      "garbageman": "male"
    }
  },
  {
    "id": 10,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "garbage collectors": "a",
      "waste collectors": "a",
      "trash collectors": "a"
    },
    "inconsiderate": {
      "garbagewomen": "female",
      "garbagemen": "male"
    }
  },
  {
    "id": 11,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "chair": "a",
      "chairperson": "a",
      "coordinator": "a"
    },
    "inconsiderate": {
      "chairwoman": "female",
      "chairman": "male"
    }
  },
  {
    "id": 12,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "committee member": "a"
    },
    "inconsiderate": {
      "committee woman": "female",
      "committee man": "male"
    }
  },
  {
    "id": 13,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "cowhand": "a"
    },
    "inconsiderate": {
      "cowgirl": "female",
      "cowboy": "male"
    }
  },
  {
    "id": 14,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "cowhands": "a"
    },
    "inconsiderate": {
      "cowgirls": "female",
      "cowboys": "male"
    }
  },
  {
    "id": 15,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "cattle rancher": "a"
    },
    "inconsiderate": {
      "cattlewoman": "female",
      "cattleman": "male"
    }
  },
  {
    "id": 16,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "cattle ranchers": "a"
    },
    "inconsiderate": {
      "cattlewomen": "female",
      "cattlemen": "male"
    }
  },
  {
    "id": 17,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "chairs": "a",
      "chairpersons": "a",
      "coordinators": "a"
    },
    "inconsiderate": {
      "chairwomen": "female",
      "chairmen": "male"
    }
  },
  {
    "id": 18,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "mail carrier": "a",
      "letter carrier": "a",
      "postal worker": "a"
    },
    "inconsiderate": {
      "postwoman": "female",
      "mailwoman": "female",
      "postman": "male",
      "mailman": "male"
    }
  },
  {
    "id": 19,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "mail carriers": "a",
      "letter carriers": "a",
      "postal workers": "a"
    },
    "inconsiderate": {
      "postwomen": "female",
      "mailwomen": "female",
      "postmen": "male",
      "mailmen": "male"
    }
  },
  {
    "id": 20,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "officer": "a",
      "police officer": "a"
    },
    "inconsiderate": {
      "policewoman": "female",
      "policeman": "male"
    }
  },
  {
    "id": 21,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "officers": "a",
      "police officers": "a"
    },
    "inconsiderate": {
      "policewomen": "female",
      "policemen": "male"
    }
  },
  {
    "id": 22,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "flight attendant": "a"
    },
    "inconsiderate": {
      "stewardess": "female",
      "steward": "male"
    }
  },
  {
    "id": 23,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "flight attendants": "a"
    },
    "inconsiderate": {
      "stewardesses": "female",
      "stewards": "male"
    }
  },
  {
    "id": 24,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "member of congress": "a",
      "congress person": "a",
      "legislator": "a",
      "representative": "a"
    },
    "inconsiderate": {
      "congresswoman": "female",
      "congressman": "male"
    }
  },
  {
    "id": 25,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "member of congresss": "a",
      "congress persons": "a",
      "legislators": "a",
      "representatives": "a"
    },
    "inconsiderate": {
      "congresswomen": "female",
      "congressmen": "male"
    }
  },
  {
    "id": 26,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "fire fighter": "a"
    },
    "inconsiderate": {
      "firewoman": "female",
      "fireman": "male"
    }
  },
  {
    "id": 27,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "fire fighters": "a"
    },
    "inconsiderate": {
      "firewomen": "female",
      "firemen": "male"
    }
  },
  {
    "id": 28,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "fisher": "a",
      "crew member": "a"
    },
    "inconsiderate": {
      "fisherwoman": "female",
      "fisherman": "male"
    }
  },
  {
    "id": 29,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "fishers": "a"
    },
    "inconsiderate": {
      "fisherwomen": "female",
      "fishermen": "male"
    }
  },
  {
    "id": 30,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "kinship": "a",
      "community": "a"
    },
    "inconsiderate": {
      "sisterhood": "female",
      "brotherhood": "male"
    }
  },
  {
    "id": 31,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "common person": "a",
      "average person": "a"
    },
    "inconsiderate": {
      "common girl": "female",
      "common man": "male"
    }
  },
  {
    "id": 32,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "business executive": "a",
      "entrepreneur": "a",
      "business person": "a",
      "professional": "a"
    },
    "inconsiderate": {
      "businesswoman": "female",
      "salarywoman": "female",
      "businessman": "male",
      "salaryman": "male"
    }
  },
  {
    "id": 33,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "business executives": "a",
      "entrepreneurs": "a"
    },
    "inconsiderate": {
      "businesswomen": "female",
      "salarywomen": "female",
      "career girl": "female",
      "career woman": "female",
      "businessmen": "male",
      "salarymen": "male"
    }
  },
  {
    "id": 34,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "cleaner": "a"
    },
    "inconsiderate": {
      "cleaning lady": "female",
      "cleaning girl": "female",
      "cleaning woman": "female",
      "janitress": "female",
      "cleaning man": "male",
      "cleaning boy": "male",
      "janitor": "male"
    }
  },
  {
    "id": 35,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "cleaners": "a"
    },
    "inconsiderate": {
      "cleaning ladies": "female",
      "cleaning girls": "female",
      "janitresses": "female",
      "cleaning men": "male",
      "janitors": "male"
    }
  },
  {
    "id": 36,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "courier": "a",
      "messenger": "a"
    },
    "inconsiderate": {
      "delivery girl": "female",
      "delivery boy": "male"
    }
  },
  {
    "id": 37,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "supervisor": "a",
      "shift boss": "a"
    },
    "inconsiderate": {
      "forewoman": "female",
      "foreman": "male"
    }
  },
  {
    "id": 38,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "lead": "a",
      "front": "a",
      "figurehead": "a"
    },
    "inconsiderate": {
      "frontwoman, front woman": "female",
      "frontman, front man": "male"
    }
  },
  {
    "id": 39,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "figureheads": "a"
    },
    "inconsiderate": {
      "front women, frontwomen": "female",
      "front men, frontmen": "male"
    }
  },
  {
    "id": 40,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "supervisors": "a",
      "shift bosses": "a"
    },
    "inconsiderate": {
      "forewomen": "female",
      "foremen": "male"
    }
  },
  {
    "id": 41,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "insurance agent": "a"
    },
    "inconsiderate": {
      "insurance woman": "female",
      "insurance man": "male"
    }
  },
  {
    "id": 42,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "insurance agents": "a"
    },
    "inconsiderate": {
      "insurance women": "female",
      "insurance men": "male"
    }
  },
  {
    "id": 43,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "proprietor": "a",
      "building manager": "a"
    },
    "inconsiderate": {
      "landlady": "female",
      "landlord": "male"
    }
  },
  {
    "id": 44,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "proprietors": "a",
      "building managers": "a"
    },
    "inconsiderate": {
      "landladies": "female",
      "landlords": "male"
    }
  },
  {
    "id": 45,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "graduate": "a"
    },
    "inconsiderate": {
      "alumna": "female",
      "alumnus": "male"
    }
  },
  {
    "id": 46,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "graduates": "a"
    },
    "inconsiderate": {
      "alumnae": "female",
      "alumni": "male"
    }
  },
  {
    "id": 47,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "anchor": "a",
      "journalist": "a"
    },
    "inconsiderate": {
      "newswoman": "female",
      "newspaperwoman": "female",
      "anchorwoman": "female",
      "newsman": "male",
      "newspaperman": "male",
      "anchorman": "male"
    }
  },
  {
    "id": 48,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "anchors": "a",
      "journalists": "a"
    },
    "inconsiderate": {
      "newswomen": "female",
      "newspaperwomen": "female",
      "anchorwomen": "female",
      "newsmen": "male",
      "newspapermen": "male",
      "anchormen": "male"
    }
  },
  {
    "id": 49,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "repairer": "a",
      "technician": "a"
    },
    "inconsiderate": {
      "repairwoman": "female",
      "repairman": "male"
    }
  },
  {
    "id": 50,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "technicians": "a"
    },
    "inconsiderate": {
      "repairwomen": "female",
      "repairmen": "male"
    }
  },
  {
    "id": 51,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "salesperson": "a",
      "sales clerk": "a",
      "sales rep": "a",
      "sales agent": "a",
      "seller": "a"
    },
    "inconsiderate": {
      "saleswoman": "female",
      "sales woman": "female",
      "saleslady": "female",
      "salesman": "male",
      "sales man": "male"
    }
  },
  {
    "id": 52,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "sales clerks": "a",
      "sales reps": "a",
      "sales agents": "a",
      "sellers": "a"
    },
    "inconsiderate": {
      "saleswomen": "female",
      "sales women": "female",
      "salesladies": "female",
      "salesmen": "male",
      "sales men": "male"
    }
  },
  {
    "id": 53,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "soldier": "a",
      "service representative": "a"
    },
    "inconsiderate": {
      "servicewoman": "female",
      "serviceman": "male"
    }
  },
  {
    "id": 54,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "soldiers": "a",
      "service representatives": "a"
    },
    "inconsiderate": {
      "servicewomen": "female",
      "servicemen": "male"
    }
  },
  {
    "id": 55,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "server": "a"
    },
    "inconsiderate": {
      "waitress": "female",
      "waiter": "male"
    }
  },
  {
    "id": 56,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "servers": "a"
    },
    "inconsiderate": {
      "waitresses": "female",
      "waiters": "male"
    }
  },
  {
    "id": 57,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "worker": "a",
      "wage earner": "a",
      "taxpayer": "a"
    },
    "inconsiderate": {
      "workwoman": "female",
      "working woman": "female",
      "workman": "male",
      "working man": "male"
    }
  },
  {
    "id": 58,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "workers": "a"
    },
    "inconsiderate": {
      "workwomen": "female",
      "workmen": "male"
    }
  },
  {
    "id": 59,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "performer": "a",
      "star": "a",
      "artist": "a"
    },
    "inconsiderate": {
      "actress": "female",
      "actor": "male"
    }
  },
  {
    "id": 60,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "performers": "a",
      "stars": "a",
      "artists": "a"
    },
    "inconsiderate": {
      "actresses": "female",
      "actors": "male"
    }
  },
  {
    "id": 61,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "pilot": "a",
      "aviator": "a",
      "airstaff": "a"
    },
    "inconsiderate": {
      "aircrewwoman": "female",
      "aircrew woman": "female",
      "aircrewman": "male",
      "airman": "male"
    }
  },
  {
    "id": 62,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "pilots": "a",
      "aviators": "a",
      "airstaff": "a"
    },
    "inconsiderate": {
      "aircrewwomen": "female",
      "aircrew women": "female",
      "aircrewmen": "male",
      "airmen": "male"
    }
  },
  {
    "id": 63,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "cabinet member": "a"
    },
    "inconsiderate": {
      "alderwoman": "female",
      "alderman": "male"
    }
  },
  {
    "id": 64,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "cabinet": "a",
      "cabinet members": "a"
    },
    "inconsiderate": {
      "alderwomen": "female",
      "aldermen": "male"
    }
  },
  {
    "id": 65,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "assembly person": "a",
      "assembly worker": "a"
    },
    "inconsiderate": {
      "assemblywoman": "female",
      "assemblyman": "male"
    }
  },
  {
    "id": 66,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "relative": "a"
    },
    "inconsiderate": {
      "kinswoman": "female",
      "aunt": "female",
      "kinsman": "male",
      "uncle": "male"
    }
  },
  {
    "id": 67,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "relatives": "a"
    },
    "inconsiderate": {
      "kinswomen": "female",
      "aunts": "female",
      "kinsmen": "male",
      "uncles": "male"
    }
  },
  {
    "id": 68,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "klansperson": "a"
    },
    "inconsiderate": {
      "klanswoman": "female",
      "klansman": "male"
    }
  },
  {
    "id": 69,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "clansperson": "a",
      "clan member": "a"
    },
    "inconsiderate": {
      "clanswoman": "female",
      "clansman": "male"
    }
  },
  {
    "id": 70,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "klan": "a",
      "klanspersons": "a"
    },
    "inconsiderate": {
      "klanswomen": "female",
      "klansmen": "male"
    }
  },
  {
    "id": 71,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "boogey": "a"
    },
    "inconsiderate": {
      "boogeywoman": "female",
      "boogeyman": "male"
    }
  },
  {
    "id": 72,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "boogie": "a"
    },
    "inconsiderate": {
      "boogiewoman": "female",
      "boogieman": "male"
    }
  },
  {
    "id": 73,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "bogey": "a"
    },
    "inconsiderate": {
      "bogeywoman": "female",
      "bogeyman": "male"
    }
  },
  {
    "id": 74,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "bogie": "a"
    },
    "inconsiderate": {
      "bogiewoman": "female",
      "bogieman": "male"
    }
  },
  {
    "id": 75,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "boogies": "a"
    },
    "inconsiderate": {
      "boogiewomen": "female",
      "boogiemen": "male"
    }
  },
  {
    "id": 76,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "bogies": "a"
    },
    "inconsiderate": {
      "bogiewomen": "female",
      "bogiemen": "male"
    }
  },
  {
    "id": 77,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "bonder": "a"
    },
    "inconsiderate": {
      "bondswoman": "female",
      "bondsman": "male"
    }
  },
  {
    "id": 78,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "bonders": "a"
    },
    "inconsiderate": {
      "bondswomen": "female",
      "bondsmen": "male"
    }
  },
  {
    "id": 79,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "partner": "a",
      "significant other": "a",
      "spouse": "a"
    },
    "inconsiderate": {
      "wife": "female",
      "husband": "male"
    }
  },
  {
    "id": 80,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "partners": "a",
      "significant others": "a",
      "spouses": "a"
    },
    "inconsiderate": {
      "wives": "female",
      "husbands": "male"
    }
  },
  {
    "id": 81,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "partner": "a",
      "friend": "a",
      "significant other": "a"
    },
    "inconsiderate": {
      "girlfriend": "female",
      "boyfriend": "male"
    }
  },
  {
    "id": 82,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "partners": "a",
      "friends": "a",
      "significant others": "a"
    },
    "inconsiderate": {
      "girlfriends": "female",
      "boyfriends": "male"
    }
  },
  {
    "id": 83,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "childhood": "a"
    },
    "inconsiderate": {
      "girlhood": "female",
      "boyhood": "male"
    }
  },
  {
    "id": 84,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "childish": "a"
    },
    "inconsiderate": {
      "girly": "female",
      "girlish": "female",
      "boyish": "male"
    }
  },
  {
    "id": 85,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "traveler": "a"
    },
    "inconsiderate": {
      "journeywoman": "female",
      "journeyman": "male"
    }
  },
  {
    "id": 86,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "travelers": "a"
    },
    "inconsiderate": {
      "journeywomen": "female",
      "journeymen": "male"
    }
  },
  {
    "id": 87,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "godparent": "a",
      "elder": "a",
      "patron": "a"
    },
    "inconsiderate": {
      "godmother": "female",
      "patroness": "female",
      "godfather": "male"
    }
  },
  {
    "id": 88,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "grandchild": "a"
    },
    "inconsiderate": {
      "granddaughter": "female",
      "grandson": "male"
    }
  },
  {
    "id": 89,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "grandchildred": "a"
    },
    "inconsiderate": {
      "granddaughters": "female",
      "grandsons": "male"
    }
  },
  {
    "id": 90,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "ancestor": "a"
    },
    "inconsiderate": {
      "foremother": "female",
      "forefather": "male"
    }
  },
  {
    "id": 91,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "ancestors": "a"
    },
    "inconsiderate": {
      "foremothers": "female",
      "forefathers": "male"
    }
  },
  {
    "id": 92,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "grandparent": "a",
      "ancestor": "a"
    },
    "inconsiderate": {
      "granny": "female",
      "grandma": "female",
      "grandmother": "female",
      "grandpappy": "male",
      "granddaddy": "male",
      "gramps": "male",
      "grandpa": "male",
      "grandfather": "male"
    }
  },
  {
    "id": 93,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "grandparents": "a",
      "ancestors": "a"
    },
    "inconsiderate": {
      "grandmothers": "female",
      "grandfathers": "male"
    }
  },
  {
    "id": 94,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "spouse": "a"
    },
    "inconsiderate": {
      "bride": "female",
      "groom": "male"
    }
  },
  {
    "id": 95,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "sibling": "a"
    },
    "inconsiderate": {
      "sister": "female",
      "brother": "male"
    }
  },
  {
    "id": 96,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "siblings": "a"
    },
    "inconsiderate": {
      "sisters": "female",
      "brothers": "male"
    }
  },
  {
    "id": 97,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "camera operator": "a",
      "camera person": "a"
    },
    "inconsiderate": {
      "camerawoman": "female",
      "cameraman": "male"
    }
  },
  {
    "id": 98,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "camera operators": "a"
    },
    "inconsiderate": {
      "camerawomen": "female",
      "cameramen": "male"
    }
  },
  {
    "id": 99,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "troglodyte": "a",
      "hominidae": "a"
    },
    "inconsiderate": {
      "cavewoman": "female",
      "caveman": "male"
    }
  },
  {
    "id": 100,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "troglodytae": "a",
      "troglodyti": "a",
      "troglodytes": "a",
      "hominids": "a"
    },
    "inconsiderate": {
      "cavewomen": "female",
      "cavemen": "male"
    }
  },
  {
    "id": 101,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "clergyperson": "a",
      "clergy": "a",
      "cleric": "a"
    },
    "inconsiderate": {
      "clergywomen": "female",
      "clergyman": "male"
    }
  },
  {
    "id": 102,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "clergies": "a",
      "clerics": "a"
    },
    "inconsiderate": {
      "clergywomen": "female",
      "clergymen": "male"
    }
  },
  {
    "id": 103,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "council member": "a"
    },
    "inconsiderate": {
      "councilwoman": "female",
      "councilman": "male"
    }
  },
  {
    "id": 104,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "council members": "a"
    },
    "inconsiderate": {
      "councilwomen": "female",
      "councilmen": "male"
    }
  },
  {
    "id": 105,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "country person": "a"
    },
    "inconsiderate": {
      "countrywoman": "female",
      "countryman": "male"
    }
  },
  {
    "id": 106,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "country folk": "a"
    },
    "inconsiderate": {
      "countrywomen": "female",
      "countrymen": "male"
    }
  },
  {
    "id": 107,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "artisan": "a",
      "craftsperson": "a",
      "skilled worker": "a"
    },
    "inconsiderate": {
      "handywoman": "female",
      "craftswoman": "female",
      "handyman": "male",
      "craftsman": "male"
    }
  },
  {
    "id": 108,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "presenter": "a",
      "entertainer": "a"
    },
    "inconsiderate": {
      "hostess": "female",
      "host": "male"
    }
  },
  {
    "id": 109,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "presenters": "a",
      "entertainers": "a"
    },
    "inconsiderate": {
      "hostesses": "female",
      "hosts": "male"
    }
  },
  {
    "id": 110,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "artisans": "a",
      "craftspersons": "a",
      "skilled workers": "a"
    },
    "inconsiderate": {
      "handywomen": "female",
      "craftswomen": "female",
      "handymen": "male",
      "craftsmen": "male"
    }
  },
  {
    "id": 111,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "guillotine": "a"
    },
    "inconsiderate": {
      "hangwoman": "female",
      "hangman": "male"
    }
  },
  {
    "id": 112,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "guillotines": "a"
    },
    "inconsiderate": {
      "hangwomen": "female",
      "hangmen": "male"
    }
  },
  {
    "id": 113,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "sidekick": "a"
    },
    "inconsiderate": {
      "henchwoman": "female",
      "henchman": "male"
    }
  },
  {
    "id": 114,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "sidekicks": "a"
    },
    "inconsiderate": {
      "henchwomen": "female",
      "henchmen": "male"
    }
  },
  {
    "id": 115,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "role-model": "a"
    },
    "inconsiderate": {
      "heroine": "female",
      "hero": "male"
    }
  },
  {
    "id": 116,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "role-models": "a"
    },
    "inconsiderate": {
      "heroines": "female",
      "heroes": "male"
    }
  },
  {
    "id": 117,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "parental": "a",
      "warm": "a",
      "intimate": "a"
    },
    "inconsiderate": {
      "maternal": "female",
      "paternal": "male",
      "fraternal": "male"
    }
  },
  {
    "id": 118,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "parental": "a"
    },
    "inconsiderate": {
      "maternity": "female",
      "paternity": "male"
    }
  },
  {
    "id": 119,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "parents": "a"
    },
    "inconsiderate": {
      "mamas": "female",
      "mothers": "female",
      "moms": "female",
      "mums": "female",
      "mommas": "female",
      "mommies": "female",
      "papas": "male",
      "fathers": "male",
      "dads": "male",
      "daddies": "male"
    }
  },
  {
    "id": 120,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "parent": "a"
    },
    "inconsiderate": {
      "mama": "female",
      "mother": "female",
      "mom": "female",
      "mum": "female",
      "momma": "female",
      "mommy": "female",
      "papa": "male",
      "father": "male",
      "dad": "male",
      "pop": "male",
      "daddy": "male"
    }
  },
  {
    "id": 121,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "child": "a"
    },
    "inconsiderate": {
      "daughter": "female",
      "son": "male"
    }
  },
  {
    "id": 122,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "children": "a"
    },
    "inconsiderate": {
      "daughters": "female",
      "sons": "male"
    }
  },
  {
    "id": 123,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "convierge": "a"
    },
    "inconsiderate": {
      "doorwoman": "female",
      "doorman": "male"
    }
  },
  {
    "id": 124,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "convierges": "a"
    },
    "inconsiderate": {
      "doorwomen": "female",
      "doormen": "male"
    }
  },
  {
    "id": 125,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "humanly": "a",
      "mature": "a"
    },
    "inconsiderate": {
      "feminin": "female",
      "dudely": "male",
      "manly": "male"
    }
  },
  {
    "id": 126,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "humans": "a"
    },
    "inconsiderate": {
      "females": "female",
      "males": "male"
    }
  },
  {
    "id": 127,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "ruler": "a"
    },
    "inconsiderate": {
      "empress": "female",
      "queen": "female",
      "emperor": "male",
      "king": "male"
    }
  },
  {
    "id": 128,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "rulers": "a"
    },
    "inconsiderate": {
      "empresses": "female",
      "queens": "female",
      "emperors": "male",
      "kings": "male"
    }
  },
  {
    "id": 129,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "jumbo": "a",
      "gigantic": "a"
    },
    "inconsiderate": {
      "queensize": "female",
      "kingsize": "male"
    }
  },
  {
    "id": 130,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "power behind the throne": "a"
    },
    "inconsiderate": {
      "queenmaker": "female",
      "kingmaker": "male"
    }
  },
  {
    "id": 131,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "civilian": "a"
    },
    "inconsiderate": {
      "laywoman": "female",
      "layman": "male"
    }
  },
  {
    "id": 132,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "civilians": "a"
    },
    "inconsiderate": {
      "laywomen": "female",
      "laymen": "male"
    }
  },
  {
    "id": 133,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "official": "a",
      "owner": "a",
      "expert": "a",
      "superior": "a",
      "chief": "a",
      "ruler": "a"
    },
    "inconsiderate": {
      "dame": "female",
      "lord": "male"
    }
  },
  {
    "id": 134,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "officials": "a",
      "masters": "a",
      "chiefs": "a",
      "rulers": "a"
    },
    "inconsiderate": {
      "dames": "female",
      "lords": "male"
    }
  },
  {
    "id": 135,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "adulthood": "a",
      "personhood": "a"
    },
    "inconsiderate": {
      "girlhood": "female",
      "masculinity": "male",
      "manhood": "male"
    }
  },
  {
    "id": 136,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "humanity": "a"
    },
    "inconsiderate": {
      "femininity": "female",
      "manliness": "male"
    }
  },
  {
    "id": 137,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "shooter": "a"
    },
    "inconsiderate": {
      "markswoman": "female",
      "marksman": "male"
    }
  },
  {
    "id": 138,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "shooters": "a"
    },
    "inconsiderate": {
      "markswomen": "female",
      "marksmen": "male"
    }
  },
  {
    "id": 139,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "intermediary": "a",
      "go-between": "a"
    },
    "inconsiderate": {
      "middlewoman": "female",
      "middleman": "male"
    }
  },
  {
    "id": 140,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "intermediaries": "a",
      "go-betweens": "a"
    },
    "inconsiderate": {
      "middlewomen": "female",
      "middlemen": "male"
    }
  },
  {
    "id": 141,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "milk person": "a"
    },
    "inconsiderate": {
      "milkwoman": "female",
      "milkman": "male"
    }
  },
  {
    "id": 142,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "milk people": "a"
    },
    "inconsiderate": {
      "milkwomen": "female",
      "milkmen": "male"
    }
  },
  {
    "id": 143,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "nibling": "a",
      "sibling’s child": "a"
    },
    "inconsiderate": {
      "niece": "female",
      "nephew": "male"
    }
  },
  {
    "id": 144,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "niblings": "a",
      "sibling’s children": "a"
    },
    "inconsiderate": {
      "nieces": "female",
      "nephews": "male"
    }
  },
  {
    "id": 145,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "noble": "a"
    },
    "inconsiderate": {
      "noblewoman": "female",
      "nobleman": "male"
    }
  },
  {
    "id": 146,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "nobles": "a"
    },
    "inconsiderate": {
      "noblewomen": "female",
      "noblemen": "male"
    }
  },
  {
    "id": 147,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "notary": "a",
      "consumer advocate": "a",
      "trouble shooter": "a"
    },
    "inconsiderate": {
      "ombudswoman": "female",
      "ombudsman": "male"
    }
  },
  {
    "id": 148,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "notaries": "a"
    },
    "inconsiderate": {
      "ombudswomen": "female",
      "ombudsmen": "male"
    }
  },
  {
    "id": 149,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "heir": "a"
    },
    "inconsiderate": {
      "princess": "female",
      "prince": "male"
    }
  },
  {
    "id": 150,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "heirs": "a"
    },
    "inconsiderate": {
      "princesses": "female",
      "princes": "male"
    }
  },
  {
    "id": 151,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "fairy": "a"
    },
    "inconsiderate": {
      "sandwoman": "female",
      "sandman": "male"
    }
  },
  {
    "id": 152,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "fairies": "a"
    },
    "inconsiderate": {
      "sandwomen": "female",
      "sandmen": "male"
    }
  },
  {
    "id": 153,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "promoter": "a"
    },
    "inconsiderate": {
      "showwoman": "female",
      "showman": "male"
    }
  },
  {
    "id": 154,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "promoters": "a"
    },
    "inconsiderate": {
      "showwomen": "female",
      "show women": "female",
      "showmen": "male"
    }
  },
  {
    "id": 155,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "astronaut": "a"
    },
    "inconsiderate": {
      "spacewoman": "female",
      "spaceman": "male"
    }
  },
  {
    "id": 156,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "astronauts": "a"
    },
    "inconsiderate": {
      "spacewomen": "female",
      "spacemen": "male"
    }
  },
  {
    "id": 157,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "speaker": "a",
      "spokesperson": "a",
      "representative": "a"
    },
    "inconsiderate": {
      "spokeswoman": "female",
      "spokesman": "male"
    }
  },
  {
    "id": 158,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "speakers": "a",
      "spokespersons": "a"
    },
    "inconsiderate": {
      "spokeswomen": "female",
      "spokesmen": "male"
    }
  },
  {
    "id": 159,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "athlete": "a",
      "sports person": "a"
    },
    "inconsiderate": {
      "sportswoman": "female",
      "sportsman": "male"
    }
  },
  {
    "id": 160,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "athletes": "a",
      "sports persons": "a"
    },
    "inconsiderate": {
      "sportswomen": "female",
      "sportsmen": "male"
    }
  },
  {
    "id": 161,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "senator": "a"
    },
    "inconsiderate": {
      "stateswoman": "female",
      "statesman": "male"
    }
  },
  {
    "id": 162,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "step-sibling": "a"
    },
    "inconsiderate": {
      "stepsister": "female",
      "stepbrother": "male"
    }
  },
  {
    "id": 163,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "step-siblings": "a"
    },
    "inconsiderate": {
      "stepsisters": "female",
      "stepbrothers": "male"
    }
  },
  {
    "id": 164,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "step-parent": "a"
    },
    "inconsiderate": {
      "stepmom": "female",
      "stepmother": "female",
      "stepdad": "male",
      "stepfather": "male"
    }
  },
  {
    "id": 165,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "step-parents": "a"
    },
    "inconsiderate": {
      "stepmothers": "female",
      "stepfathers": "male"
    }
  },
  {
    "id": 166,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "titan": "a"
    },
    "inconsiderate": {
      "superwoman": "female",
      "superman": "male"
    }
  },
  {
    "id": 167,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "titans": "a"
    },
    "inconsiderate": {
      "superwomen": "female",
      "supermen": "male"
    }
  },
  {
    "id": 168,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "inhumane": "a"
    },
    "inconsiderate": {
      "unwomanly": "female",
      "unwomenly": "female",
      "unmanly": "male",
      "unmenly": "male"
    }
  },
  {
    "id": 169,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "watcher": "a"
    },
    "inconsiderate": {
      "watchwoman": "female",
      "watchman": "male"
    }
  },
  {
    "id": 170,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "watchers": "a"
    },
    "inconsiderate": {
      "watchwomen": "female",
      "watchmen": "male"
    }
  },
  {
    "id": 171,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "weather forecaster": "a",
      "meteorologist": "a"
    },
    "inconsiderate": {
      "weatherwoman": "female",
      "weatherman": "male"
    }
  },
  {
    "id": 172,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "weather forecasters": "a",
      "meteorologists": "a"
    },
    "inconsiderate": {
      "weatherwomen": "female",
      "weathermen": "male"
    }
  },
  {
    "id": 173,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "bereaved": "a"
    },
    "inconsiderate": {
      "widow": "female",
      "widows": "female",
      "widower": "male",
      "widowers": "male"
    }
  },
  {
    "id": 174,
    "type": "or",
    "categories": [
      "female",
      "male"
    ],
    "considerate": {
      "own person": "a"
    },
    "inconsiderate": {
      "own woman": "female",
      "own man": "male"
    }
  },
  {
    "id": 175,
    "type": "simple",
    "categories": [
      "male"
    ],
    "considerate": {
      "french": "a"
    },
    "inconsiderate": {
      "frenchmen": "male"
    }
  },
  {
    "id": 176,
    "type": "simple",
    "categories": [
      "female"
    ],
    "considerate": {
      "courteous": "a",
      "cultured": "a"
    },
    "inconsiderate": {
      "ladylike": "female"
    }
  },
  {
    "id": 177,
    "type": "simple",
    "categories": [
      "male"
    ],
    "considerate": {
      "resolutely": "a",
      "bravely": "a"
    },
    "inconsiderate": {
      "like a man": "male"
    }
  },
  {
    "id": 178,
    "type": "simple",
    "categories": [
      "female"
    ],
    "considerate": {
      "birth name": "a"
    },
    "inconsiderate": {
      "maiden name": "female"
    }
  },
  {
    "id": 179,
    "type": "simple",
    "categories": [
      "female"
    ],
    "considerate": {
      "first voyage": "a"
    },
    "inconsiderate": {
      "maiden voyage": "female"
    }
  },
  {
    "id": 180,
    "type": "simple",
    "categories": [
      "male"
    ],
    "considerate": {
      "strong enough": "a"
    },
    "inconsiderate": {
      "man enough": "male"
    }
  },
  {
    "id": 181,
    "type": "simple",
    "categories": [
      "male"
    ],
    "considerate": {
      "upstaging": "a",
      "competitiveness": "a"
    },
    "inconsiderate": {
      "oneupmanship": "male"
    }
  },
  {
    "id": 182,
    "type": "simple",
    "categories": [
      "female"
    ],
    "considerate": {
      "ms.": "a"
    },
    "inconsiderate": {
      "miss.": "female",
      "mrs.": "female"
    }
  },
  {
    "id": 183,
    "type": "simple",
    "categories": [
      "male"
    ],
    "considerate": {
      "manufactured": "a",
      "artificial": "a",
      "synthetic": "a",
      "machine-made": "a"
    },
    "inconsiderate": {
      "manmade": "male"
    }
  },
  {
    "id": 184,
    "type": "simple",
    "categories": [
      "male"
    ],
    "considerate": {
      "dynamo": "a"
    },
    "inconsiderate": {
      "man of action": "male"
    }
  },
  {
    "id": 185,
    "type": "simple",
    "categories": [
      "male"
    ],
    "considerate": {
      "scholar": "a",
      "writer": "a",
      "literary figure": "a"
    },
    "inconsiderate": {
      "man of letters": "male"
    }
  },
  {
    "id": 186,
    "type": "simple",
    "categories": [
      "male"
    ],
    "considerate": {
      "sophisticate": "a"
    },
    "inconsiderate": {
      "man of the world": "male"
    }
  },
  {
    "id": 187,
    "type": "simple",
    "categories": [
      "male"
    ],
    "considerate": {
      "camaraderie": "a"
    },
    "inconsiderate": {
      "fellowship": "male"
    }
  },
  {
    "id": 188,
    "type": "simple",
    "categories": [
      "male"
    ],
    "considerate": {
      "first-year student": "a",
      "fresher": "a"
    },
    "inconsiderate": {
      "freshman": "male",
      "freshwoman": "male"
    }
  },
  {
    "id": 189,
    "type": "simple",
    "categories": [
      "male"
    ],
    "considerate": {
      "quality construction": "a",
      "expertise": "a"
    },
    "inconsiderate": {
      "workmanship": "male"
    }
  },
  {
    "id": 190,
    "type": "simple",
    "categories": [
      "female"
    ],
    "considerate": {
      "homemaker": "a",
      "homeworker": "a"
    },
    "inconsiderate": {
      "housewife": "female"
    }
  },
  {
    "id": 191,
    "type": "simple",
    "categories": [
      "female"
    ],
    "considerate": {
      "homemakers": "a",
      "homeworkers": "a"
    },
    "inconsiderate": {
      "housewives": "female"
    }
  },
  {
    "id": 192,
    "type": "simple",
    "categories": [
      "female"
    ],
    "considerate": {
      "loving": "a",
      "warm": "a",
      "nurturing": "a"
    },
    "inconsiderate": {
      "motherly": "female"
    }
  },
  {
    "id": 193,
    "type": "simple",
    "categories": [
      "male"
    ],
    "considerate": {
      "human resources": "a"
    },
    "inconsiderate": {
      "manpower": "male"
    }
  },
  {
    "id": 194,
    "type": "simple",
    "categories": [
      "male"
    ],
    "considerate": {
      "emcee": "a",
      "moderator": "a",
      "convenor": "a"
    },
    "inconsiderate": {
      "master of ceremonies": "male"
    }
  },
  {
    "id": 195,
    "type": "simple",
    "categories": [
      "male"
    ],
    "considerate": {
      "skilled": "a",
      "authoritative": "a",
      "commanding": "a"
    },
    "inconsiderate": {
      "masterful": "male"
    }
  },
  {
    "id": 196,
    "type": "simple",
    "categories": [
      "male"
    ],
    "considerate": {
      "genius": "a",
      "creator": "a",
      "instigator": "a",
      "oversee": "a",
      "launch": "a",
      "originate": "a"
    },
    "inconsiderate": {
      "mastermind": "male"
    }
  },
  {
    "id": 197,
    "type": "simple",
    "categories": [
      "male"
    ],
    "considerate": {
      "work of genius": "a",
      "chef d’oeuvre": "a"
    },
    "inconsiderate": {
      "masterpiece": "male"
    }
  },
  {
    "id": 198,
    "type": "simple",
    "categories": [
      "male"
    ],
    "considerate": {
      "vision": "a",
      "comprehensive plan": "a"
    },
    "inconsiderate": {
      "masterplan": "male"
    }
  },
  {
    "id": 199,
    "type": "simple",
    "categories": [
      "male"
    ],
    "considerate": {
      "trump card": "a",
      "stroke of genius": "a"
    },
    "inconsiderate": {
      "masterstroke": "male"
    }
  },
  {
    "id": 200,
    "type": "simple",
    "categories": [
      "male"
    ],
    "considerate": {
      "fanatic": "a",
      "zealot": "a",
      "enthusiast": "a"
    },
    "inconsiderate": {
      "madman": "male",
      "mad man": "male"
    }
  },
  {
    "id": 201,
    "type": "simple",
    "categories": [
      "male"
    ],
    "considerate": {
      "maniacs": "a"
    },
    "inconsiderate": {
      "madmen": "male",
      "mad men": "male"
    }
  },
  {
    "id": 202,
    "type": "simple",
    "categories": [
      "male"
    ],
    "considerate": {
      "humankind": "a"
    },
    "inconsiderate": {
      "mankind": "male"
    }
  },
  {
    "id": 203,
    "type": "simple",
    "categories": [
      "male"
    ],
    "considerate": {
      "staff hours": "a",
      "hours of work": "a"
    },
    "inconsiderate": {
      "manhour": "male",
      "man hour": "male"
    }
  },
  {
    "id": 204,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "staffed": "a",
      "crewed": "a",
      "piloted": "a"
    },
    "inconsiderate": {
      "manned": "a"
    }
  },
  {
    "id": 205,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "robotic": "a",
      "automated": "a"
    },
    "inconsiderate": {
      "unmanned": "a"
    }
  },
  {
    "id": 206,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "whining": "a",
      "complaining": "a",
      "crying": "a"
    },
    "inconsiderate": {
      "bitching": "a",
      "moaning": "a"
    }
  },
  {
    "id": 207,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "whine": "a",
      "complain": "a",
      "cry": "a"
    },
    "inconsiderate": {
      "bitch": "a",
      "moan": "a"
    }
  },
  {
    "id": 208,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "person with learning disabilities": "a"
    },
    "inconsiderate": {
      "learning disabled": "a"
    }
  },
  {
    "id": 209,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "turned off": "a",
      "person with a disability": "a",
      "people with disabilities": "a"
    },
    "inconsiderate": {
      "disabled": "a"
    }
  },
  {
    "id": 210,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "person with a disability": "a",
      "people with disabilities": "a"
    },
    "inconsiderate": {
      "birth defect": "a"
    },
    "note": "If possible, describe exacly what this is. (source: http://ncdj.org/style-guide/)"
  },
  {
    "id": 211,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "person with a disability": "a",
      "people with disabilities": "a"
    },
    "inconsiderate": {
      "birth defect": "a",
      "suffers from disabilities": "a",
      "suffering from disabilities": "a",
      "suffering from a disability": "a",
      "afflicted with disabilities": "a",
      "afflicted with a disability": "a"
    }
  },
  {
    "id": 212,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "people with intellectual disabilities": "a"
    },
    "inconsiderate": {
      "intellectually disabled people": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 213,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "person with an intellectual disability": "a"
    },
    "inconsiderate": {
      "intellectually disabled": "a",
      "suffers from intellectual disabilities": "a",
      "suffering from intellectual disabilities": "a",
      "suffering from an intellectual disability": "a",
      "afflicted with intellectual disabilities": "a",
      "afflicted with a intellectual disability": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 214,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "rude": "a",
      "mean": "a",
      "disgusting": "a",
      "vile": "a",
      "person with symptoms of mental illness": "a",
      "person with mental illness": "a",
      "person with symptoms of a mental disorder": "a",
      "person with a mental disorder": "a"
    },
    "inconsiderate": {
      "batshit": "a",
      "psycho": "a",
      "crazy": "a",
      "insane": "a",
      "insanity": "a",
      "loony": "a",
      "lunacy": "a",
      "lunatic": "a",
      "mentally ill": "a",
      "psychopathology": "a",
      "mental defective": "a",
      "moron": "a",
      "moronic": "a",
      "nuts": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 215,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "fluctuating": "a",
      "person with schizophrenia": "a",
      "person with bipolar disorder": "a"
    },
    "inconsiderate": {
      "bipolar": "a",
      "schizophrenic": "a",
      "schizo": "a",
      "suffers from schizophrenia": "a",
      "suffering from schizophrenia": "a",
      "afflicted with schizophrenia": "a"
    }
  },
  {
    "id": 216,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "accessible parking": "a"
    },
    "inconsiderate": {
      "handicapped parking": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 217,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "person with a handicap": "a"
    },
    "inconsiderate": {
      "handicapped": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 218,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "person with an amputation": "a"
    },
    "inconsiderate": {
      "amputee": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 219,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "person with a limp": "a"
    },
    "inconsiderate": {
      "cripple": "a",
      "crippled": "a"
    }
  },
  {
    "id": 220,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "person with Down Syndrome": "a"
    },
    "inconsiderate": {
      "mongoloid": "a"
    }
  },
  {
    "id": 221,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "individual who has had a stroke": "a"
    },
    "inconsiderate": {
      "stroke victim": "a",
      "suffering from a stroke": "a",
      "victim of a stroke": "a"
    }
  },
  {
    "id": 222,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "person who has multiple sclerosis": "a"
    },
    "inconsiderate": {
      "suffers from multiple sclerosis": "a",
      "suffering from multiple sclerosis": "a",
      "victim of multiple sclerosis": "a",
      "multiple sclerosis victim": "a",
      "afflicted with multiple sclerosis": "a"
    }
  },
  {
    "id": 223,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "with family support needs": "a"
    },
    "inconsiderate": {
      "family burden": "a"
    }
  },
  {
    "id": 224,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "psychiatric hospital": "a",
      "mental health hospital": "a"
    },
    "inconsiderate": {
      "asylum": "a"
    }
  },
  {
    "id": 225,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "chaos": "a",
      "hectic": "a",
      "pandemonium": "a"
    },
    "inconsiderate": {
      "asylum": "a",
      "bedlam": "a",
      "madhouse": "a",
      "loony bin": "a"
    }
  },
  {
    "id": 226,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Down Syndrome": "a"
    },
    "inconsiderate": {
      "downs syndrome": "a"
    },
    "note": "Source: http://www.specialolympics.org/uploadedFiles/Fact%20Sheet_Terminology%20Guide.pdf"
  },
  {
    "id": 227,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "silly": "a",
      "dullard": "a",
      "person with Down Syndrome": "a",
      "person with developmental disabilities": "a",
      "delay": "a",
      "hold back": "a"
    },
    "inconsiderate": {
      "retard": "a",
      "retarded": "a"
    }
  },
  {
    "id": 228,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "sillies": "a",
      "dullards": "a",
      "people with developmental disabilities": "a",
      "people with Down’s Syndrome": "a",
      "delays": "a",
      "holds back": "a"
    },
    "inconsiderate": {
      "retards": "a"
    }
  },
  {
    "id": 229,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "person with a psychotic condition": "a",
      "person with psychosis": "a"
    },
    "inconsiderate": {
      "psychotic": "a",
      "suffers from psychosis": "a",
      "suffering from psychosis": "a",
      "afflicted with psychosis": "a",
      "victim of psychosis": "a"
    }
  },
  {
    "id": 230,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "boring": "a",
      "dull": "a"
    },
    "inconsiderate": {
      "lame": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 231,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "person with AIDS": "a"
    },
    "inconsiderate": {
      "suffering from aids": "a",
      "suffer from aids": "a",
      "suffers from aids": "a",
      "afflicted with aids": "a",
      "victim of aids": "a",
      "aids victim": "a"
    }
  },
  {
    "id": 232,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "uses a wheelchair": "a"
    },
    "inconsiderate": {
      "confined to a wheelchair": "a",
      "bound to a wheelchair": "a",
      "restricted to a wheelchair": "a",
      "wheelchair bound": "a"
    }
  },
  {
    "id": 233,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "athletes": "a",
      "Special Olympics athletes": "a"
    },
    "inconsiderate": {
      "special olympians": "a",
      "special olympic athletes": "a"
    },
    "note": "Source: http://www.specialolympics.org/uploadedFiles/Fact%20Sheet_Terminology%20Guide.pdf"
  },
  {
    "id": 234,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "non-disabled": "a"
    },
    "inconsiderate": {
      "ablebodied": "a"
    },
    "note": "Sometimes `typical` can be used. (source: http://ncdj.org/style-guide/)"
  },
  {
    "id": 235,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "person with a drug addiction": "a",
      "person recovering from a drug addiction": "a"
    },
    "inconsiderate": {
      "addict": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 236,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "people with a drug addiction": "a",
      "people recovering from a drug addiction": "a"
    },
    "inconsiderate": {
      "addicts": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 237,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "people with a drug addiction": "a",
      "people recovering from a drug addiction": "a"
    },
    "inconsiderate": {
      "addicts": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 238,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "someone with an alcohol problem": "a"
    },
    "inconsiderate": {
      "alcoholic": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 239,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "person with autism spectrum disorder": "a"
    },
    "inconsiderate": {
      "autistic": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 240,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "deaf": "a"
    },
    "inconsiderate": {
      "deaf and dumb": "a",
      "deafmute": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 241,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "person with dementia": "a"
    },
    "inconsiderate": {
      "demented": "a",
      "senile": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 242,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "sad": "a",
      "blue": "a",
      "bummed out": "a",
      "person with seasonal affective disorder": "a",
      "person with psychotic depression": "a",
      "person with postpartum depression": "a"
    },
    "inconsiderate": {
      "depressed": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 243,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "person with dwarfism": "a"
    },
    "inconsiderate": {
      "vertically challenged": "a",
      "midget": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 244,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "person with dyslexia": "a"
    },
    "inconsiderate": {
      "dyslexic": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 245,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "person with epilepsy": "a"
    },
    "inconsiderate": {
      "epileptic": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 246,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "hard of hearing": "a",
      "partially deaf": "a",
      "partial hearing loss": "a",
      "deaf": "a"
    },
    "inconsiderate": {
      "hearing impaired": "a",
      "hearing impairment": "a"
    },
    "note": "When possible, ask the person what they prefer. (source: http://ncdj.org/style-guide/)"
  },
  {
    "id": 247,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "polio": "a",
      "person who had polio": "a"
    },
    "inconsiderate": {
      "infantile paralysis": "a",
      "suffers from polio": "a",
      "suffering from polio": "a",
      "suffering from a polio": "a",
      "afflicted with polio": "a",
      "afflicted with a polio": "a",
      "victim of polio": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 248,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "sustain an injury": "a",
      "receive an injury": "a"
    },
    "inconsiderate": {
      "suffer from an injury": "a",
      "suffers from an injury": "a",
      "suffering from an injury": "a",
      "afflicted with an injury": "a",
      "victim of an injury": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 249,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "sustain injuries": "a",
      "receive injuries": "a"
    },
    "inconsiderate": {
      "suffer from injuries": "a",
      "suffers from injuries": "a",
      "suffering from injuries": "a",
      "afflicted with injuries": "a",
      "victim of injuries": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 250,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "person with paraplegia": "a"
    },
    "inconsiderate": {
      "paraplegic": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 251,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "person with quadriplegia": "a"
    },
    "inconsiderate": {
      "quadriplegic": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 252,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "person with cerebral palsy": "a"
    },
    "inconsiderate": {
      "spastic": "a",
      "spaz": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 253,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "stuttering": "a"
    },
    "inconsiderate": {
      "stammering": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 254,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "person who stutters": "a"
    },
    "inconsiderate": {
      "stutterer": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 255,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Tourette syndrome": "a"
    },
    "inconsiderate": {
      "tourettes syndrome": "a",
      "tourettes disorder": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 256,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "treatment center": "a"
    },
    "inconsiderate": {
      "rehab center": "a",
      "detox center": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 257,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "treatment": "a"
    },
    "inconsiderate": {
      "rehab": "a",
      "detox": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 258,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "person with a personality disorder": "a",
      "person with psychopathic personality": "a"
    },
    "inconsiderate": {
      "sociopath": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 259,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "people with psychopathic personalities": "a",
      "people with a personality disorder": "a"
    },
    "inconsiderate": {
      "sociopaths": "a"
    },
    "note": "Source: http://ncdj.org/style-guide/"
  },
  {
    "id": 260,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "foolish": "a",
      "ludicrous": "a",
      "speechless": "a",
      "silent": "a"
    },
    "inconsiderate": {
      "dumb": "a"
    },
    "note": "Source: http://www.autistichoya.com/p/ableist-words-and-terms-to-avoid.html"
  },
  {
    "id": 261,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "foolish": "a",
      "ludicrous": "a",
      "unintelligent": "a"
    },
    "inconsiderate": {
      "simpleton": "a",
      "stupid": "a",
      "wacko": "a",
      "whacko": "a"
    },
    "note": "Source: http://www.mmonjejr.com/2014/02/deconstructing-stupid.html"
  },
  {
    "id": 262,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "fit of terror": "a",
      "scare": "a"
    },
    "inconsiderate": {
      "panic attack": "a"
    }
  },
  {
    "id": 263,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "thin": "a",
      "slim": "a"
    },
    "inconsiderate": {
      "anorexic": "a"
    }
  },
  {
    "id": 264,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "obsessive": "a",
      "pedantic": "a",
      "niggly": "a",
      "picky": "a"
    },
    "inconsiderate": {
      "ocd": "a",
      "o.c.d": "a",
      "o.c.d.": "a"
    },
    "note": "Source: http://english.stackexchange.com/questions/247550/"
  },
  {
    "id": 265,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "restlessness": "a",
      "sleeplessness": "a"
    },
    "inconsiderate": {
      "insomnia": "a"
    }
  },
  {
    "id": 266,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "person who has insomnia": "a"
    },
    "inconsiderate": {
      "insomniac": "a"
    }
  },
  {
    "id": 267,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "people who have insomnia": "a"
    },
    "inconsiderate": {
      "insomniacs": "a"
    }
  },
  {
    "id": 268,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "empty": "a",
      "sterile": "a",
      "infertile": "a"
    },
    "inconsiderate": {
      "barren": "a"
    },
    "note": "Source: http://www.autistichoya.com/p/ableist-words-and-terms-to-avoid.html"
  },
  {
    "id": 269,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "careless": "a",
      "heartless": "a",
      "indifferent": "a",
      "insensitive": "a"
    },
    "inconsiderate": {
      "blind to": "a",
      "blind eye to": "a",
      "blinded by": "a"
    },
    "note": "Source: http://www.autistichoya.com/p/ableist-words-and-terms-to-avoid.html"
  },
  {
    "id": 270,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "careless": "a",
      "heartless": "a",
      "indifferent": "a",
      "insensitive": "a"
    },
    "inconsiderate": {
      "blind to": "a",
      "blind eye to": "a",
      "blinded by": "a",
      "deaf to": "a",
      "deaf ear to": "a",
      "deafened by": "a"
    },
    "note": "Source: http://www.autistichoya.com/p/ableist-words-and-terms-to-avoid.html"
  },
  {
    "id": 271,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "creep": "a",
      "fool": "a"
    },
    "inconsiderate": {
      "cretin": "a"
    },
    "note": "Source: http://www.autistichoya.com/p/ableist-words-and-terms-to-avoid.html"
  },
  {
    "id": 272,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "absurd": "a",
      "foolish": "a"
    },
    "inconsiderate": {
      "daft": "a"
    },
    "note": "Source: http://www.autistichoya.com/p/ableist-words-and-terms-to-avoid.html"
  },
  {
    "id": 273,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "foolish": "a",
      "ludicrous": "a",
      "silly": "a"
    },
    "inconsiderate": {
      "feebleminded": "a",
      "feeble minded": "a",
      "idiot": "a",
      "imbecile": "a"
    },
    "note": "Source: http://www.autistichoya.com/p/ableist-words-and-terms-to-avoid.html"
  },
  {
    "id": 274,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "person with a cleft-lip and palate": "a"
    },
    "inconsiderate": {
      "harelipped": "a",
      "cleftlipped": "a"
    },
    "note": "Source: http://www.autistichoya.com/p/ableist-words-and-terms-to-avoid.html"
  },
  {
    "id": 275,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "cleft-lip and palate": "a"
    },
    "inconsiderate": {
      "harelip": "a"
    },
    "note": "Source: http://www.autistichoya.com/p/ableist-words-and-terms-to-avoid.html"
  },
  {
    "id": 276,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "cleft-lip and palate": "a"
    },
    "inconsiderate": {
      "harelip": "a"
    },
    "note": "Source: http://www.autistichoya.com/p/ableist-words-and-terms-to-avoid.html"
  },
  {
    "id": 277,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "fanatic": "a",
      "zealot": "a",
      "enthusiast": "a"
    },
    "inconsiderate": {
      "maniac": "a"
    },
    "note": "Source: http://www.autistichoya.com/p/ableist-words-and-terms-to-avoid.html"
  },
  {
    "id": 278,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Armenian person": "a",
      "Armenian American": "a"
    },
    "inconsiderate": {
      "armo": "a"
    }
  },
  {
    "id": 279,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Armenian people": "a",
      "Armenian Americans": "a"
    },
    "inconsiderate": {
      "armos": "a"
    }
  },
  {
    "id": 280,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Australian Aboriginal": "a",
      "people of the Pacific islands": "a"
    },
    "inconsiderate": {
      "boongas": "a",
      "boongs": "a",
      "bungas": "a",
      "boonies": "a"
    }
  },
  {
    "id": 281,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Australian Aboriginal": "a",
      "Pacific islander": "a"
    },
    "inconsiderate": {
      "boonga": "a",
      "boong": "a",
      "bong": "a",
      "bung": "a",
      "bunga": "a",
      "boonie": "a"
    }
  },
  {
    "id": 282,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Dutch person": "a"
    },
    "inconsiderate": {
      "cheesehead": "a"
    }
  },
  {
    "id": 283,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Dutch people": "a"
    },
    "inconsiderate": {
      "cheeseheads": "a"
    }
  },
  {
    "id": 284,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "French person": "a"
    },
    "inconsiderate": {
      "cheeseeating surrender monkey": "a",
      "cheese eating surrender monkey": "a"
    }
  },
  {
    "id": 285,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "French people": "a"
    },
    "inconsiderate": {
      "cheeseeating surrender monkies": "a",
      "cheese eating surrender monkies": "a"
    }
  },
  {
    "id": 286,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Finnish American": "a"
    },
    "inconsiderate": {
      "chinaswede": "a",
      "china swede": "a"
    }
  },
  {
    "id": 287,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Finnish Americans": "a"
    },
    "inconsiderate": {
      "chinaswedes": "a",
      "china swedes": "a"
    }
  },
  {
    "id": 288,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Chinese person": "a"
    },
    "inconsiderate": {
      "chinamen": "a"
    }
  },
  {
    "id": 289,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Chinese people": "a"
    },
    "inconsiderate": {
      "ching chong": "a",
      "chinaman": "a"
    }
  },
  {
    "id": 290,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Chinese person": "a",
      "Asian person": "a"
    },
    "inconsiderate": {
      "banana": "a",
      "ching chong": "a",
      "chink": "a"
    }
  },
  {
    "id": 291,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Chinese people": "a",
      "Asian people": "a"
    },
    "inconsiderate": {
      "bananas": "a",
      "ching chongs": "a",
      "chinks": "a"
    }
  },
  {
    "id": 292,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Chinese person": "a",
      "Korean person": "a"
    },
    "inconsiderate": {
      "chonky": "a",
      "chunky": "a",
      "chunger": "a"
    }
  },
  {
    "id": 293,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Chinese people": "a",
      "Korean people": "a"
    },
    "inconsiderate": {
      "chonkies": "a",
      "chunkies": "a",
      "chonkys": "a",
      "chunkys": "a",
      "chungers": "a"
    }
  },
  {
    "id": 294,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Canadian Aboriginal": "a"
    },
    "inconsiderate": {
      "chug": "a"
    }
  },
  {
    "id": 295,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Canadian Aboriginals": "a"
    },
    "inconsiderate": {
      "chugs": "a"
    }
  },
  {
    "id": 296,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Hispanic person": "a",
      "person of color": "a",
      "black person": "a"
    },
    "inconsiderate": {
      "coconut": "a",
      "oreo": "a"
    }
  },
  {
    "id": 297,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Hispanic people": "a",
      "people of color": "a",
      "black people": "a"
    },
    "inconsiderate": {
      "coconuts": "a",
      "oreos": "a"
    }
  },
  {
    "id": 298,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Cajun": "a"
    },
    "inconsiderate": {
      "coonass": "a",
      "coon ass": "a"
    }
  },
  {
    "id": 299,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Cajun people": "a"
    },
    "inconsiderate": {
      "coonasses": "a",
      "coon asses": "a"
    }
  },
  {
    "id": 300,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Indian person": "a"
    },
    "inconsiderate": {
      "currymuncher": "a",
      "curry muncher": "a"
    }
  },
  {
    "id": 301,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Indian people": "a"
    },
    "inconsiderate": {
      "currymunchers": "a",
      "curry munchers": "a"
    }
  },
  {
    "id": 302,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Hindi person": "a"
    },
    "inconsiderate": {
      "Dotheads": "a",
      "Dot heads": "a"
    }
  },
  {
    "id": 303,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Hindi people": "a"
    },
    "inconsiderate": {
      "Dothead": "a",
      "Dot head": "a"
    }
  },
  {
    "id": 304,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Caribbean people": "a"
    },
    "inconsiderate": {
      "golliwogs": "a"
    }
  },
  {
    "id": 305,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Caribbean person": "a"
    },
    "inconsiderate": {
      "golliwog": "a"
    }
  },
  {
    "id": 306,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "foreigners": "a"
    },
    "inconsiderate": {
      "guizi": "a"
    }
  },
  {
    "id": 307,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "ripped-off": "a",
      "bamboozled": "a",
      "cheated": "a"
    },
    "inconsiderate": {
      "gyped": "a",
      "gypped": "a"
    }
  },
  {
    "id": 308,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "rip-off": "a",
      "bamboozle": "a",
      "cheat": "a"
    },
    "inconsiderate": {
      "gyp": "a"
    }
  },
  {
    "id": 309,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Romani people": "a"
    },
    "inconsiderate": {
      "gyppos": "a",
      "gippos": "a",
      "gypos": "a",
      "gyppies": "a",
      "gyppys": "a",
      "gipps": "a",
      "gypsys": "a",
      "gypsies": "a"
    }
  },
  {
    "id": 310,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Romani person": "a"
    },
    "inconsiderate": {
      "gyppo": "a",
      "gippo": "a",
      "gypo": "a",
      "gyppie": "a",
      "gyppy": "a",
      "gipp": "a",
      "gypsy": "a"
    }
  },
  {
    "id": 311,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "afrikaner": "a"
    },
    "inconsiderate": {
      "hairyback": "a"
    }
  },
  {
    "id": 312,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "afrikaners": "a"
    },
    "inconsiderate": {
      "hairybacks": "a"
    }
  },
  {
    "id": 313,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Maori person": "a"
    },
    "inconsiderate": {
      "hori": "a"
    }
  },
  {
    "id": 314,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Maoris": "a"
    },
    "inconsiderate": {
      "horis": "a"
    }
  },
  {
    "id": 315,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Indonesian person": "a"
    },
    "inconsiderate": {
      "jap": "a"
    }
  },
  {
    "id": 316,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Indonesians": "a"
    },
    "inconsiderate": {
      "indons": "a"
    }
  },
  {
    "id": 317,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Japanese person": "a"
    },
    "inconsiderate": {
      "jap": "a"
    }
  },
  {
    "id": 318,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Japanese": "a"
    },
    "inconsiderate": {
      "japs": "a"
    }
  },
  {
    "id": 319,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Koreans": "a"
    },
    "inconsiderate": {
      "gyopos": "a",
      "kyopos": "a",
      "kimchis": "a"
    }
  },
  {
    "id": 320,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Korean person": "a"
    },
    "inconsiderate": {
      "gyopo": "a",
      "kyopo": "a",
      "kimchi": "a"
    }
  },
  {
    "id": 321,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Lebanese": "a"
    },
    "inconsiderate": {
      "lebos": "a"
    }
  },
  {
    "id": 322,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Lebanese person": "a"
    },
    "inconsiderate": {
      "lebo": "a"
    }
  },
  {
    "id": 323,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Lithuanians": "a"
    },
    "inconsiderate": {
      "lugans": "a"
    }
  },
  {
    "id": 324,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Lithuanian person": "a"
    },
    "inconsiderate": {
      "lugan": "a"
    }
  },
  {
    "id": 325,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Poles": "a",
      "Slavs": "a"
    },
    "inconsiderate": {
      "polacks": "a",
      "pollocks": "a"
    }
  },
  {
    "id": 326,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Pole": "a",
      "Slav": "a",
      "Polish person": "a",
      "Slavic person": "a"
    },
    "inconsiderate": {
      "polack": "a",
      "pollock": "a"
    }
  },
  {
    "id": 327,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "English": "a",
      "British": "a"
    },
    "inconsiderate": {
      "lebo": "a",
      "pom": "a",
      "poms": "a",
      "pohm": "a",
      "pohms": "a",
      "pommy": "a",
      "pommie": "a",
      "pommies": "a",
      "pommie grant": "a",
      "pommie grants": "a"
    }
  },
  {
    "id": 328,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Hispanic": "a",
      "Spanish": "a"
    },
    "inconsiderate": {
      "spic": "a",
      "spick": "a",
      "spik": "a",
      "spig": "a",
      "spigotty": "a"
    }
  },
  {
    "id": 329,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "German": "a"
    },
    "inconsiderate": {
      "boche": "a",
      "bosche": "a",
      "bosch": "a",
      "hun": "a",
      "jerry": "a",
      "kraut": "a",
      "piefke": "a",
      "squarehead": "a"
    }
  },
  {
    "id": 330,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Germans": "a"
    },
    "inconsiderate": {
      "boches": "a",
      "bosches": "a",
      "boschs": "a",
      "huns": "a",
      "jerries": "a",
      "krauts": "a",
      "piefkes": "a",
      "squareheads": "a"
    }
  },
  {
    "id": 331,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "female Australian Aboriginal": "a"
    },
    "inconsiderate": {
      "lubra": "a"
    }
  },
  {
    "id": 332,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "female Native American": "a"
    },
    "inconsiderate": {
      "squa": "a",
      "skwa": "a",
      "esqua": "a",
      "sqeh": "a",
      "skwe": "a",
      "que": "a",
      "kwa": "a",
      "ikwe": "a",
      "exkwew": "a",
      "xkwe": "a"
    }
  },
  {
    "id": 333,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "italian": "a"
    },
    "inconsiderate": {
      "dago": "a",
      "dego": "a",
      "greaseball": "a",
      "greaser": "a",
      "guinea": "a",
      "ginzo": "a",
      "swamp guinea": "a"
    }
  },
  {
    "id": 334,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "italians": "a"
    },
    "inconsiderate": {
      "dagos": "a",
      "degos": "a",
      "greaseballs": "a",
      "greasers": "a",
      "guineas": "a",
      "ginzos": "a",
      "swamp guineas": "a"
    }
  },
  {
    "id": 335,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "person of color": "a",
      "black person": "a",
      "non-Muslim": "a"
    },
    "inconsiderate": {
      "kaffir": "a",
      "kaffer": "a",
      "kafir": "a",
      "kaffre": "a",
      "kuffar": "a"
    }
  },
  {
    "id": 336,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "african americans": "a",
      "south americans": "a",
      "Caribbean people": "a",
      "africans": "a",
      "people of color": "a",
      "black people": "a"
    },
    "inconsiderate": {
      "abid": "a",
      "abeed": "a",
      "bluegums": "a",
      "bootlips": "a",
      "bounty bars": "a",
      "brownies": "a",
      "buffies": "a",
      "burrheads": "a",
      "burr heads": "a",
      "coons": "a",
      "darkeys": "a",
      "darkies": "a",
      "eight balls": "a",
      "gables": "a",
      "groids": "a",
      "jigaboos": "a",
      "jiggabos": "a",
      "jigaroonis": "a",
      "jijjiboos": "a",
      "zigabos": "a",
      "jigs": "a",
      "jiggs": "a",
      "jiggas": "a",
      "jiggers": "a",
      "jungle bunnies": "a",
      "macacas": "a",
      "maumaus": "a",
      "mau maus": "a",
      "mooncrickets": "a",
      "moon crickets": "a",
      "pickaninnies": "a",
      "porch monkies": "a",
      "sambos": "a",
      "spades": "a",
      "spearchuckers": "a",
      "sooties": "a",
      "schvartsen": "a",
      "schwartzen": "a",
      "thicklips": "a",
      "tar babies": "a",
      "niggers": "a",
      "negros": "a",
      "nigers": "a",
      "nigs": "a",
      "nigors": "a",
      "nigras": "a",
      "nigres": "a",
      "nigars": "a",
      "niggurs": "a",
      "niggas": "a",
      "niggahs": "a",
      "niggars": "a",
      "nigguhs": "a",
      "niggresses": "a",
      "nigettes": "a"
    }
  },
  {
    "id": 337,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "african american": "a",
      "south american": "a",
      "Caribbean person": "a",
      "african": "a",
      "person of color": "a",
      "black person": "a"
    },
    "inconsiderate": {
      "abid": "a",
      "abeed": "a",
      "alligator bait": "a",
      "gator bait": "a",
      "bluegum": "a",
      "bootlip": "a",
      "bounty bar": "a",
      "brownie": "a",
      "buffy": "a",
      "burrhead": "a",
      "burr head": "a",
      "coon": "a",
      "darky": "a",
      "darkey": "a",
      "darkie": "a",
      "gable": "a",
      "eight ball": "a",
      "groid": "a",
      "jigaboo": "a",
      "jiggabo": "a",
      "jigarooni": "a",
      "jijjiboo": "a",
      "zigabo": "a",
      "jig": "a",
      "jigg": "a",
      "jigga": "a",
      "jigger": "a",
      "jungle bunny": "a",
      "macaca": "a",
      "maumau": "a",
      "mau mau": "a",
      "mooncricket": "a",
      "moon cricket": "a",
      "pickaninny": "a",
      "porch monkey": "a",
      "sambo": "a",
      "spade": "a",
      "spearchuckers": "a",
      "sooty": "a",
      "schvartse": "a",
      "schwartze": "a",
      "thicklip": "a",
      "tar baby": "a",
      "nigger": "a",
      "negro": "a",
      "niger": "a",
      "nig": "a",
      "nigor": "a",
      "nigra": "a",
      "nigre": "a",
      "nigar": "a",
      "niggur": "a",
      "nigga": "a",
      "niggah": "a",
      "niggar": "a",
      "nigguh": "a",
      "niggress": "a",
      "nigette": "a"
    }
  },
  {
    "id": 338,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Native Americans": "a"
    },
    "inconsiderate": {
      "injuns": "a",
      "prairie niggers": "a",
      "redskins": "a",
      "timber niggers": "a"
    }
  },
  {
    "id": 339,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Native American": "a"
    },
    "inconsiderate": {
      "injun": "a",
      "prairie nigger": "a",
      "redskin": "a",
      "timber nigger": "a"
    }
  },
  {
    "id": 340,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "middle eastern person": "a",
      "arabic person": "a"
    },
    "inconsiderate": {
      "arabush": "a",
      "camel jockey": "a",
      "dune coon": "a",
      "hajji": "a",
      "hadji": "a",
      "haji": "a"
    }
  },
  {
    "id": 341,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "middle eastern people": "a",
      "arabic people": "a"
    },
    "inconsiderate": {
      "arabushs": "a",
      "camel jockeys": "a",
      "dune coons": "a",
      "hajjis": "a",
      "hadjis": "a",
      "hajis": "a"
    }
  },
  {
    "id": 342,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "sikhs": "a",
      "arabs": "a",
      "muslims": "a"
    },
    "inconsiderate": {
      "pakis": "a",
      "ragheads": "a",
      "sand niggers": "a",
      "towel heads": "a"
    }
  },
  {
    "id": 343,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "sikh": "a",
      "arab": "a",
      "muslim": "a"
    },
    "inconsiderate": {
      "pakis": "a",
      "osama": "a",
      "raghead": "a",
      "sand nigger": "a",
      "towel head": "a"
    }
  },
  {
    "id": 344,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "mexican": "a",
      "immigrant": "a",
      "migrant worker": "a"
    },
    "inconsiderate": {
      "beaner": "a",
      "beaney": "a",
      "tacohead": "a",
      "wetback": "a",
      "illegal": "a",
      "pocho": "a",
      "pocha": "a"
    }
  },
  {
    "id": 345,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "mexicans": "a",
      "immigrants": "a",
      "migrant workers": "a"
    },
    "inconsiderate": {
      "beaners": "a",
      "beaneys": "a",
      "tacoheads": "a",
      "wetbacks": "a",
      "illegals": "a",
      "pochos": "a",
      "pochas": "a"
    }
  },
  {
    "id": 346,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "caucasian": "a"
    },
    "inconsiderate": {
      "bule": "a",
      "gora": "a",
      "gub": "a",
      "gubba": "a",
      "gweilo": "a",
      "gwailo": "a",
      "kwai lo": "a",
      "haole": "a",
      "honky": "a",
      "honkey": "a",
      "honkie": "a",
      "japie": "a",
      "yarpie": "a",
      "mabuno": "a",
      "mahbuno": "a",
      "klansman": "a",
      "mzungu": "a",
      "redleg": "a",
      "redneck": "a",
      "roundeye": "a",
      "whitey": "a",
      "wigger": "a",
      "whigger": "a",
      "wigga": "a"
    }
  },
  {
    "id": 347,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "caucasians": "a"
    },
    "inconsiderate": {
      "bules": "a",
      "goras": "a",
      "gubs": "a",
      "gubbas": "a",
      "gweilos": "a",
      "gwailos": "a",
      "kwai los": "a",
      "haoles": "a",
      "honkeys": "a",
      "honkies": "a",
      "japies": "a",
      "yarpies": "a",
      "mabunos": "a",
      "mahbunos": "a",
      "klansmen": "a",
      "mzungus": "a",
      "redlegs": "a",
      "rednecks": "a",
      "round eyes": "a",
      "whities": "a",
      "whiteys": "a",
      "wiggers": "a",
      "whiggers": "a",
      "wiggas": "a",
      "white trash": "a"
    }
  },
  {
    "id": 348,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "ukrainian": "a"
    },
    "inconsiderate": {
      "ukrop": "a",
      "khokhol": "a",
      "khokhols": "a"
    }
  },
  {
    "id": 349,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Russian": "a"
    },
    "inconsiderate": {
      "moskal": "a",
      "katsap": "a",
      "kacap": "a"
    }
  },
  {
    "id": 350,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "Russians": "a"
    },
    "inconsiderate": {
      "moskals": "a",
      "katsaps": "a",
      "kacaps": "a",
      "kacapas": "a"
    }
  },
  {
    "id": 351,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "african": "a"
    },
    "inconsiderate": {
      "uncle tom": "a"
    }
  },
  {
    "id": 352,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "foreigner": "a",
      "asian": "a",
      "african": "a"
    },
    "inconsiderate": {
      "wog": "a"
    }
  },
  {
    "id": 353,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "foreigners": "a",
      "asians": "a",
      "africans": "a"
    },
    "inconsiderate": {
      "wogs": "a"
    }
  },
  {
    "id": 354,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "northerner": "a",
      "american": "a"
    },
    "inconsiderate": {
      "gringo": "a",
      "hillbilly": "a",
      "seppo": "a",
      "septic": "a",
      "yankee": "a",
      "yank": "a"
    }
  },
  {
    "id": 355,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "northerners": "a",
      "americans": "a"
    },
    "inconsiderate": {
      "gringos": "a",
      "hillbillies": "a",
      "seppos": "a",
      "septics": "a",
      "yankees": "a",
      "yanks": "a"
    }
  },
  {
    "id": 356,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "jew": "a"
    },
    "inconsiderate": {
      "christ killers": "a",
      "cushi": "a",
      "kushi": "a",
      "heeb": "a",
      "hebe": "a",
      "hymie": "a",
      "ike": "a",
      "ikeymo": "a",
      "kike": "a",
      "kyke": "a",
      "yid": "a",
      "shylock": "a"
    }
  },
  {
    "id": 357,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "jews": "a"
    },
    "inconsiderate": {
      "christ killers": "a",
      "cushis": "a",
      "kushis": "a",
      "heebs": "a",
      "hebes": "a",
      "hymies": "a",
      "ikes": "a",
      "ikeymos": "a",
      "kikes": "a",
      "kykes": "a",
      "yids": "a",
      "shylocks": "a"
    }
  },
  {
    "id": 358,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "asian": "a"
    },
    "inconsiderate": {
      "buddhahead": "a",
      "coolie": "a",
      "dink": "a",
      "gook": "a",
      "gookeye": "a",
      "gook eye": "a",
      "gooky": "a",
      "pancake face": "a",
      "slope": "a",
      "slopehead": "a",
      "slopy": "a",
      "slopey": "a",
      "sloper": "a",
      "squinty": "a",
      "zipperhead": "a"
    }
  },
  {
    "id": 359,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "asians": "a"
    },
    "inconsiderate": {
      "buddhaheads": "a",
      "coolies": "a",
      "dinks": "a",
      "gooks": "a",
      "gookeyes": "a",
      "gook eyes": "a",
      "gookies": "a",
      "pancake faces": "a",
      "slopes": "a",
      "slopeheads": "a",
      "slopies": "a",
      "slopeys": "a",
      "slopers": "a",
      "stuinties": "a",
      "zipperheads": "a"
    }
  },
  {
    "id": 360,
    "type": "and",
    "categories": [
      "a",
      "b"
    ],
    "considerate": {
      "primary": "a",
      "primaries": "a",
      "replica": "b",
      "replicas": "b"
    },
    "inconsiderate": {
      "master": "a",
      "masters": "a",
      "slave": "b",
      "slaves": "b"
    }
  },
  {
    "id": 361,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "gay": "a",
      "gay man": "a",
      "lesbian": "a",
      "gay person/people": "a"
    },
    "inconsiderate": {
      "homosexual": "a"
    },
    "note": "Source: http://www.glaad.org/reference/offensive"
  },
  {
    "id": 362,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "relationship": "a"
    },
    "inconsiderate": {
      "homosexual relations": "a",
      "homosexual relationship": "a"
    },
    "note": "Source: http://www.glaad.org/reference/offensive"
  },
  {
    "id": 363,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "couple": "a"
    },
    "inconsiderate": {
      "homosexual couple": "a"
    },
    "note": "Source: http://www.glaad.org/reference/offensive"
  },
  {
    "id": 364,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "sexual orientation": "a",
      "orientation": "a"
    },
    "inconsiderate": {
      "sexual preference": "a"
    },
    "note": "Source: http://www.glaad.org/reference/offensive"
  },
  {
    "id": 365,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "gay lives": "a",
      "gay/lesbian lives": "a"
    },
    "inconsiderate": {
      "gay lifestyle": "a",
      "homosexual lifestyle": "a"
    },
    "note": "Source: http://www.glaad.org/reference/offensive"
  },
  {
    "id": 366,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "sexual orientation": "a",
      "orientation": "a"
    },
    "inconsiderate": {
      "sexual preference": "a"
    },
    "note": "Source: http://www.glaad.org/reference/offensive"
  },
  {
    "id": 367,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "gay issues": "a"
    },
    "inconsiderate": {
      "gay agenda": "a",
      "homosexual agenda": "a"
    },
    "note": "Source: http://www.glaad.org/reference/offensive"
  },
  {
    "id": 368,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "equal rights": "a",
      "civil rights for gay people": "a"
    },
    "inconsiderate": {
      "special rights": "a",
      "gay rights": "a"
    },
    "note": "Source: http://www.glaad.org/reference/style"
  },
  {
    "id": 369,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "gay": "a"
    },
    "inconsiderate": {
      "fag": "a",
      "faggot": "a",
      "dyke": "a",
      "homo": "a",
      "sodomite": "a"
    },
    "note": "Source: http://www.glaad.org/reference/offensive"
  },
  {
    "id": 370,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "bisexual": "a"
    },
    "inconsiderate": {
      "bi": "a"
    },
    "note": "Source: http://www.glaad.org/reference/style"
  },
  {
    "id": 371,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "gay marriage": "a",
      "same-sex marriage": "a"
    },
    "inconsiderate": {
      "homosexual marriage": "a"
    },
    "note": "Source: http://www.glaad.org/reference/style"
  },
  {
    "id": 372,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "transgender": "a"
    },
    "inconsiderate": {
      "tranny": "a"
    },
    "note": "Source: http://www.glaad.org/reference/style"
  },
  {
    "id": 373,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "cross-dresser": "a"
    },
    "inconsiderate": {
      "transvestite": "a"
    },
    "note": "Source: http://www.glaad.org/reference/transgender"
  },
  {
    "id": 374,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "transition": "a"
    },
    "inconsiderate": {
      "sexchange": "a",
      "sex change": "a"
    },
    "note": "Source: http://www.glaad.org/reference/transgender"
  },
  {
    "id": 375,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "sex reassignment surgery": "a"
    },
    "inconsiderate": {
      "sex change operation": "a"
    },
    "note": "Source: http://www.glaad.org/reference/transgender"
  },
  {
    "id": 376,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "transgender people": "a"
    },
    "inconsiderate": {
      "transgenders": "a"
    },
    "note": "Transgender should be used as an adjective, not as a noun. (source: http://www.glaad.org/reference/transgender)"
  },
  {
    "id": 377,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "a transgender person": "a"
    },
    "inconsiderate": {
      "a transgender": "a"
    },
    "note": "Transgender should be used as an adjective, not as a noun. (source: http://www.glaad.org/reference/transgender)"
  },
  {
    "id": 378,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "trangender": "a"
    },
    "inconsiderate": {
      "transgendered": "a"
    },
    "note": "Source: http://www.glaad.org/reference/transgender"
  },
  {
    "id": 379,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "being trangender": "a",
      "the movement for transgender equality": "a"
    },
    "inconsiderate": {
      "transgenderism": "a"
    },
    "note": "Source: http://www.glaad.org/reference/transgender"
  },
  {
    "id": 380,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "assigned male at birth": "a",
      "designated male at birth": "a"
    },
    "inconsiderate": {
      "biologically male": "a",
      "born a man": "a",
      "genetically male": "a"
    }
  },
  {
    "id": 381,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "assigned female at birth": "a",
      "designated female at birth": "a"
    },
    "inconsiderate": {
      "biologically female": "a",
      "born a woman": "a",
      "genetically female": "a"
    }
  },
  {
    "id": 382,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "non-discrimination law": "a",
      "non-discrimination ordinance": "a"
    },
    "inconsiderate": {
      "bathroom bill": "a"
    },
    "note": "Source: http://www.glaad.org/reference/transgender"
  },
  {
    "id": 383,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "died by suicide": "a",
      "completed suicide": "a"
    },
    "inconsiderate": {
      "committed suicide": "a"
    },
    "note": "Source: https://www.afsp.org/news-events/for-the-media/reporting-on-suicide"
  },
  {
    "id": 384,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "die by suicide": "a",
      "complete suicide": "a"
    },
    "inconsiderate": {
      "commit suicide": "a"
    },
    "note": "Source: https://www.afsp.org/news-events/for-the-media/reporting-on-suicide"
  },
  {
    "id": 385,
    "type": "simple",
    "categories": [
      "a"
    ],
    "considerate": {
      "rise in suicides": "a"
    },
    "inconsiderate": {
      "suicide epidemic": "a"
    },
    "note": "Source: https://www.afsp.org/news-events/for-the-media/reporting-on-suicide"
  }
]

},{}],68:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer.
 * @license MIT
 * @module retext
 * @fileoverview Extensible system for analysing and manipulating
 *   natural language.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var unified = require('unified');
var Parser = require('parse-latin');
var Compiler = require('./lib/compile.js');

/*
 * Exports.
 */

module.exports = unified({
    'name': 'retext',
    'Parser': Parser,
    'Compiler': Compiler
});

},{"./lib/compile.js":69,"parse-latin":32,"unified":76}],69:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer. All rights reserved.
 * @license MIT
 * @module retext:compile
 * @fileoverview Compile nlcst to string.
 */

/* eslint-env commonjs */

'use strict';

/*
 * Dependencies.
 */

var toString = require('nlcst-to-string');

/**
 * Construct a new compiler.
 *
 * @example
 *   var file = new VFile('Hello World.');
 *
 *   file.namespace('retext').cst = {
 *       'type': 'SentenceNode',
 *       'children': [
 *           {
 *               'type': 'WordNode',
 *               'children': [{
 *                   'type': 'TextNode',
 *                   'value': 'Hello'
 *               }]
 *           },
 *           {
 *               'type': 'WhiteSpaceNode',
 *               'value': ' '
 *           },
 *           {
 *               'type': 'WordNode',
 *               'children': [{
 *                   'type': 'TextNode',
 *                   'value': 'World'
 *               }]
 *           },
 *           {
 *               'type': 'PunctuationNode',
 *               'value': '.'
 *           }
 *       ]
 *   };
 *
 *   var compiler = new Compiler(file);
 *
 * @constructor
 * @class {Compiler}
 * @param {File} file - Virtual file.
 */
function Compiler(file) {
    this.file = file;
}

/**
 * Stringify the bound file.
 *
 * @example
 *   var file = new VFile('Hello');
 *
 *   file.namespace('retext').cst = {
 *     type: 'WordNode',
 *     children: [{
 *       type: 'TextNode',
 *       value: 'Hello'
 *     }]
 *   });
 *
 *   new Compiler(file).compile();
 *   // 'Foo'
 *
 * @this {Compiler}
 * @return {string} - Document.
 */
function compile() {
    return toString(this.file.namespace('retext').tree);
}

/*
 * Expose `compile`.
 */

Compiler.prototype.compile = compile;

/*
 * Expose.
 */

module.exports = Compiler;

},{"nlcst-to-string":27}],70:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer
 * @license MIT
 * @module stringify-entities
 * @fileoverview Encode HTML character references and character entities.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var entities = require('character-entities-html4');
var EXPRESSION_NAMED = require('./lib/expression.js');

/*
 * Methods.
 */

var has = {}.hasOwnProperty;

/*
 * List of enforced escapes.
 */

var escapes = ['"', '\'', '<', '>', '&', '`'];

/*
 * Map of characters to names.
 */

var characters = {};

(function () {
    var name;

    for (name in entities) {
        characters[entities[name]] = name;
    }
})();

/*
 * Regular expressions.
 */

var EXPRESSION_ESCAPE = new RegExp('[' + escapes.join('') + ']', 'g');
var EXPRESSION_SURROGATE_PAIR = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
var EXPRESSION_BMP = /[\x01-\t\x0B\f\x0E-\x1F\x7F\x81\x8D\x8F\x90\x9D\xA0-\uFFFF]/g;

/**
 * Transform `code` into a hexadecimal character reference.
 *
 * @param {number} code - Number to encode.
 * @return {string} - `code` encoded as hexadecimal.
 */
function characterCodeToHexadecimalReference(code) {
    return '&#x' + code.toString(16).toUpperCase() + ';';
}

/**
 * Transform `character` into a hexadecimal character
 * reference.
 *
 * @param {string} character - Character to encode.
 * @return {string} - `character` encoded as hexadecimal.
 */
function characterToHexadecimalReference(character) {
    return characterCodeToHexadecimalReference(character.charCodeAt(0));
}

/**
 * Transform `code` into an entity.
 *
 * @param {string} name - Name to wrap.
 * @return {string} - `name` encoded as hexadecimal.
 */
function toNamedEntity(name) {
    return '&' + name + ';';
}

/**
 * Transform `code` into an entity.
 *
 * @param {string} character - Character to encode.
 * @return {string} - `name` encoded as hexadecimal.
 */
function characterToNamedEntity(character) {
    return toNamedEntity(characters[character]);
}

/**
 * Encode special characters in `value`.
 *
 * @param {string} value - Value to encode.
 * @param {Object?} [options] - Configuration.
 * @param {boolean?} [options.escapeOnly=false]
 *   - Whether to only escape required characters.
 * @param {boolean?} [options.useNamedReferences=false]
 *   - Whether to use entities where possible.
 * @return {string} - Encoded `value`.
 */
function encode(value, options) {
    var settings = options || {};
    var escapeOnly = settings.escapeOnly;
    var named = settings.useNamedReferences;
    var map = named ? characters : null;

    value = value.replace(EXPRESSION_ESCAPE, function (character) {
        return map && has.call(map, character) ?
            toNamedEntity(map[character]) :
            characterToHexadecimalReference(character);
    });

    if (escapeOnly) {
        return value;
    }

    if (named) {
        value = value.replace(EXPRESSION_NAMED, characterToNamedEntity);
    }

    return value
        .replace(EXPRESSION_SURROGATE_PAIR, function (pair) {
            return characterCodeToHexadecimalReference(
                (pair.charCodeAt(0) - 0xD800) * 0x400 +
                pair.charCodeAt(1) - 0xDC00 + 0x10000
            );
        })
        .replace(EXPRESSION_BMP, characterToHexadecimalReference);
}

/**
 * Shortcut to escape special characters in HTML.
 *
 * @param {string} value - Value to encode.
 * @return {string} - Encoded `value`.
 */
function escape(value) {
    return encode(value, {
        'escapeOnly': true,
        'useNamedReferences': true
    });
}

encode.escape = escape;

/*
 * Expose.
 */

module.exports = encode;

},{"./lib/expression.js":71,"character-entities-html4":9}],71:[function(require,module,exports){
/* This script was generated by `script/generate-expression.js` */

'use strict';

/* eslint-env commonjs */
/* eslint-disable no-irregular-whitespace */

module.exports = /[ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿƒΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρςστυφχψωϑϒϖ•…′″‾⁄℘ℑℜ™ℵ←↑→↓↔↵⇐⇑⇒⇓⇔∀∂∃∅∇∈∉∋∏∑−∗√∝∞∠∧∨∩∪∫∴∼≅≈≠≡≤≥⊂⊃⊄⊆⊇⊕⊗⊥⋅⌈⌉⌊⌋〈〉◊♠♣♥♦ŒœŠšŸˆ˜   ‌‍‎‏–—‘’‚“”„†‡‰‹›€]/g;

},{}],72:[function(require,module,exports){
'use strict';

/*
 * Constants.
 */

var LINE = '\n';

/**
 * Remove final newline characters from `value`.
 *
 * @example
 *   trimTrailingLines('foo\nbar'); // 'foo\nbar'
 *   trimTrailingLines('foo\nbar\n'); // 'foo\nbar'
 *   trimTrailingLines('foo\nbar\n\n'); // 'foo\nbar'
 *
 * @param {string} value - Value with trailing newlines,
 *   coerced to string.
 * @return {string} - Value without trailing newlines.
 */
function trimTrailingLines(value) {
    var index;

    value = String(value);
    index = value.length;

    while (value.charAt(--index) === LINE) { /* empty */ }

    return value.slice(0, index + 1);
}

/*
 * Expose.
 */

module.exports = trimTrailingLines;

},{}],73:[function(require,module,exports){

exports = module.exports = trim;

function trim(str){
  return str.replace(/^\s*|\s*$/g, '');
}

exports.left = function(str){
  return str.replace(/^\s*/, '');
};

exports.right = function(str){
  return str.replace(/\s*$/, '');
};

},{}],74:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer
 * @license MIT
 * @module unherit
 * @fileoverview Create a custom constructor which can be modified
 *   without affecting the original class.
 * @example
 *   var EventEmitter = require('events').EventEmitter;
 *   var Emitter = unherit(EventEmitter);
 *   // Create a private class which acts just like
 *   // `EventEmitter`.
 *
 *   Emitter.prototype.defaultMaxListeners = 0;
 *   // Now, all instances of `Emitter` have no maximum
 *   // listeners, without affecting other `EventEmitter`s.
 */

'use strict';

/*
 * Dependencies.
 */

var clone = require('clone');
var inherits = require('inherits');

/**
 * Create a custom constructor which can be modified
 * without affecting the original class.
 *
 * @param {Function} Super - Super-class.
 * @return {Function} - Constructor acting like `Super`,
 *   which can be modified without affecting the original
 *   class.
 */
function unherit(Super) {
    var base = clone(Super.prototype);
    var result;
    var key;

    /**
     * Constructor accepting a single argument,
     * which itself is an `arguments` object.
     */
    function From(parameters) {
        return Super.apply(this, parameters);
    }

    /**
     * Constructor accepting variadic arguments.
     */
    function Of() {
        if (!(this instanceof Of)) {
            return new From(arguments);
        }

        return Super.apply(this, arguments);
    }

    inherits(Of, Super);
    inherits(From, Of);

    /*
     * Both do duplicate work. However, cloning the
     * prototype ensures clonable things are cloned
     * and thus used. The `inherits` call ensures
     * `instanceof` still thinks an instance subclasses
     * `Super`.
     */

    result = Of.prototype;

    for (key in base) {
        result[key] = base[key];
    }

    return Of;
}

/*
 * Expose.
 */

module.exports = unherit;

},{"clone":16,"inherits":22}],75:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2016 Titus Wormer
 * @license MIT
 * @module unified:bridge
 * @fileoverview Transform between two unified processors.
 */

'use strict';

/* eslint-env commonjs */

/**
 * Create a bridge between two unified processors.
 *
 * @param {Object} options - Configuration.
 * @param {Function} options.enter - Enter mutator.
 * @param {Function} [options.exit] - Exit mutator.
 * @param {string} [options.name] - Name of destination
 *   syntax tree.
 * @return {Bridge} - A bridge usable as a plug-in.
 */
function bridge(options) {
    var name = options.name;
    var enter = options.enter;
    var exit = options.exit;

    if (typeof name !== 'string') {
        throw new Error(
            'Expected string for name, got ' +
            '`' + name + '`'
        );
    }

    if (!enter) {
        throw new Error(
            'Expected `enter`, got `' + enter + '`'
        );
    }

    return function (origin, destination) {
        if (!destination) {
            throw new Error(
                'Expected destination processor, got ' +
                '`' + destination + '`'
            );
        }

        return function (node, file, next) {
            var tree = enter(origin, destination, file, node);

            file.namespace(name).tree = tree;

            destination.run(tree, file, function (err) {
                if (err) {
                    next(err);
                    return;
                }

                if (exit) {
                    exit(destination, origin, file, tree, node);
                }

                next();
            });
        };
    };
}

/*
 * Expose.
 */

module.exports = bridge;

},{}],76:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer
 * @license MIT
 * @module unified
 * @fileoverview Parse / Transform / Compile / Repeat.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var bail = require('bail');
var ware = require('ware');
var AttachWare = require('attach-ware')(ware);
var VFile = require('vfile');
var unherit = require('unherit');
var extend;

try {
    extend = require('node-extend');
} catch (e) {
    extend = require('extend');
}

/*
 * Processing pipeline.
 */

var pipeline = ware()
    .use(function (ctx) {
        ctx.tree = ctx.context.parse(ctx.file, ctx.settings);
    })
    .use(function (ctx, next) {
        ctx.context.run(ctx.tree, ctx.file, next);
    })
    .use(function (ctx) {
        ctx.result = ctx.context.stringify(ctx.tree, ctx.file, ctx.settings);
    });

/**
 * Construct a new Processor class based on the
 * given options.
 *
 * @param {Object} options - Configuration.
 * @param {string} options.name - Private storage.
 * @param {Function} options.Parser - Class to turn a
 *   virtual file into a syntax tree.
 * @param {Function} options.Compiler - Class to turn a
 *   syntax tree into a string.
 * @return {Processor} - A new constructor.
 */
function unified(options) {
    var name = options.name;
    var Parser = options.Parser;
    var Compiler = options.Compiler;
    var data = options.data;

    /**
     * Construct a Processor instance.
     *
     * @constructor
     * @class {Processor}
     */
    function Processor(processor) {
        var self = this;

        if (!(self instanceof Processor)) {
            return new Processor(processor);
        }

        self.ware = new AttachWare(processor && processor.ware);
        self.ware.context = self;

        self.Parser = unherit(Parser);
        self.Compiler = unherit(Compiler);

        if (self.data) {
            self.data = extend(true, {}, self.data);
        }
    }

    /**
     * Either return `context` if its an instance
     * of `Processor` or construct a new `Processor`
     * instance.
     *
     * @private
     * @param {Processor?} [context] - Context object.
     * @return {Processor} - Either `context` or a new
     *   Processor instance.
     */
    function instance(context) {
        return context instanceof Processor ? context : new Processor();
    }

    /**
     * Attach a plugin.
     *
     * @this {Processor?} - Either a Processor instance or
     *   the Processor constructor.
     * @return {Processor}
     */
    function use() {
        var self = instance(this);

        self.ware.use.apply(self.ware, arguments);

        return self;
    }

    /**
     * Transform.
     *
     * @this {Processor?} - Either a Processor instance or
     *   the Processor constructor.
     * @param {Node} [node] - Syntax tree.
     * @param {VFile?} [file] - Virtual file.
     * @param {Function?} [done] - Callback.
     * @return {Node} - `node`.
     */
    function run(node, file, done) {
        var self = this;
        var space;

        if (typeof file === 'function') {
            done = file;
            file = null;
        }

        if (!file && node && !node.type) {
            file = node;
            node = null;
        }

        file = new VFile(file);
        space = file.namespace(name);

        if (!node) {
            node = space.tree || node;
        } else if (!space.tree) {
            space.tree = node;
        }

        if (!node) {
            throw new Error('Expected node, got ' + node);
        }

        done = typeof done === 'function' ? done : bail;

        /*
         * Only run when this is an instance of Processor,
         * and when there are transformers.
         */

        if (self.ware && self.ware.fns) {
            self.ware.run(node, file, done);
        } else {
            done(null, node, file);
        }

        return node;
    }

    /**
     * Parse a file.
     *
     * Patches the parsed node onto the `name`
     * namespace on the `type` property.
     *
     * @this {Processor?} - Either a Processor instance or
     *   the Processor constructor.
     * @param {string|VFile} value - Input to parse.
     * @param {Object?} [settings] - Configuration.
     * @return {Node} - `node`.
     */
    function parse(value, settings) {
        var file = new VFile(value);
        var CustomParser = (this && this.Parser) || Parser;
        var node = new CustomParser(file, settings, instance(this)).parse();

        file.namespace(name).tree = node;

        return node;
    }

    /**
     * Compile a file.
     *
     * Used the parsed node at the `name`
     * namespace at `'tree'` when no node was given.
     *
     * @this {Processor?} - Either a Processor instance or
     *   the Processor constructor.
     * @param {Object} [node] - Syntax tree.
     * @param {VFile} [file] - File with syntax tree.
     * @param {Object?} [settings] - Configuration.
     * @return {string} - Compiled `file`.
     */
    function stringify(node, file, settings) {
        var CustomCompiler = (this && this.Compiler) || Compiler;
        var space;

        if (settings === null || settings === undefined) {
            settings = file;
            file = null;
        }

        if (!file && node && !node.type) {
            file = node;
            node = null;
        }

        file = new VFile(file);
        space = file.namespace(name);

        if (!node) {
            node = space.tree || node;
        } else if (!space.tree) {
            space.tree = node;
        }

        if (!node) {
            throw new Error('Expected node, got ' + node);
        }

        return new CustomCompiler(file, settings, instance(this)).compile();
    }

    /**
     * Parse / Transform / Compile.
     *
     * @this {Processor?} - Either a Processor instance or
     *   the Processor constructor.
     * @param {string|VFile} value - Input to process.
     * @param {Object?} [settings] - Configuration.
     * @param {Function?} [done] - Callback.
     * @return {string?} - Parsed document, when
     *   transformation was async.
     */
    function process(value, settings, done) {
        var self = instance(this);
        var file = new VFile(value);
        var result = null;

        if (typeof settings === 'function') {
            done = settings;
            settings = null;
        }

        pipeline.run({
            'context': self,
            'file': file,
            'settings': settings || {}
        }, function (err, res) {
            result = res && res.result;

            if (done) {
                done(err, file, result);
            } else if (err) {
                bail(err);
            }
        });

        return result;
    }

    /*
     * Methods / functions.
     */

    var proto = Processor.prototype;

    Processor.use = proto.use = use;
    Processor.parse = proto.parse = parse;
    Processor.run = proto.run = run;
    Processor.stringify = proto.stringify = stringify;
    Processor.process = proto.process = process;
    Processor.data = proto.data = data || null;

    return Processor;
}

/*
 * Expose.
 */

module.exports = unified;

},{"attach-ware":3,"bail":4,"extend":20,"node-extend":20,"unherit":74,"vfile":81,"ware":82}],77:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer
 * @license MIT
 * @module unist:util:modify-children
 * @fileoverview Unist utility to modify direct children of a parent.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var iterate = require('array-iterate');

/**
 * Modifier for children of `parent`.
 *
 * @typedef modifyChildren~callback
 * @param {Node} child - Current iteration;
 * @param {number} index - Position of `child` in `parent`;
 * @param {Node} parent - Parent node of `child`.
 * @return {number?} - Next position to iterate.
 */

/**
 * Function invoking a bound `fn` for each child of `parent`.
 *
 * @typedef modifyChildren~modifier
 * @param {Node} parent - Node with children.
 * @throws {Error} - When not given a parent node.
 */

/**
 * Pass the context as the third argument to `callback`.
 *
 * @param {modifyChildren~callback} callback - Function to wrap.
 * @return {function(Node, number): number?} - Intermediate
 *   version partially aplied version of
 *   `modifyChildren~modifier`.
 */
function wrapperFactory(callback) {
    return function (value, index) {
        return callback(value, index, this);
    };
}

/**
 * Turns `callback` into a ``iterator'' accepting a parent.
 *
 * see ``array-iterate'' for more info.
 *
 * @param {modifyChildren~callback} callback - Function to wrap.
 * @return {modifyChildren~modifier}
 */
function iteratorFactory(callback) {
    return function (parent) {
        var children = parent && parent.children;

        if (!children) {
            throw new Error('Missing children in `parent` for `modifier`');
        }

        return iterate(children, callback, parent);
    };
}

/**
 * Turns `callback` into a child-modifier accepting a parent.
 *
 * See `array-iterate` for more info.
 *
 * @param {modifyChildren~callback} callback - Function to wrap.
 * @return {modifyChildren~modifier} - Wrapped `fn`.
 */
function modifierFactory(callback) {
    return iteratorFactory(wrapperFactory(callback));
}

/*
 * Expose.
 */

module.exports = modifierFactory;

},{"array-iterate":2}],78:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer
 * @license MIT
 * @module unist:util:visit-children
 * @fileoverview Unist utility to visit direct children of a parent.
 */

'use strict';

/* eslint-env commonjs */

/**
 * Visitor for children of `parent`.
 *
 * @typedef visitChildren~callback
 * @param {Node} child - Current iteration;
 * @param {number} index - Position of `child` in `parent`;
 * @param {Node} parent - Parent node of `child`.
 */

/**
 * Function invoking a bound `fn` for each child of `parent`.
 *
 * @typedef visitChildren~visitor
 * @param {Node} parent - Node with children.
 * @throws {Error} - When not given a parent node.
 */

/**
 * Turns `callback` into a child-visitor accepting a parent.
 *
 * @param {visitChildren~callback} callback - Function to wrap.
 * @return {visitChildren~visitor} - Wrapped `fn`.
 */
function visitorFactory(callback) {
    return function (parent) {
        var index = -1;
        var children = parent && parent.children;

        if (!children) {
            throw new Error('Missing children in `parent` for `visitor`');
        }

        while (++index in children) {
            callback(children[index], index, parent);
        }
    };
}

/*
 * Expose.
 */

module.exports = visitorFactory;

},{}],79:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer. All rights reserved.
 * @module unist:util:visit
 * @fileoverview Utility to recursively walk over unist nodes.
 */

'use strict';

/**
 * Walk forwards.
 *
 * @param {Array.<*>} values - Things to iterate over,
 *   forwards.
 * @param {function(*, number): boolean} callback - Function
 *   to invoke.
 * @return {boolean} - False if iteration stopped.
 */
function forwards(values, callback) {
    var index = -1;
    var length = values.length;

    while (++index < length) {
        if (callback(values[index], index) === false) {
            return false;
        }
    }

    return true;
}

/**
 * Walk backwards.
 *
 * @param {Array.<*>} values - Things to iterate over,
 *   backwards.
 * @param {function(*, number): boolean} callback - Function
 *   to invoke.
 * @return {boolean} - False if iteration stopped.
 */
function backwards(values, callback) {
    var index = values.length;
    var length = -1;

    while (--index > length) {
        if (callback(values[index], index) === false) {
            return false;
        }
    }

    return true;
}

/**
 * Visit.
 *
 * @param {Node} tree - Root node
 * @param {string} [type] - Node type.
 * @param {function(node): boolean?} callback - Invoked
 *   with each found node.  Can return `false` to stop.
 * @param {boolean} [reverse] - By default, `visit` will
 *   walk forwards, when `reverse` is `true`, `visit`
 *   walks backwards.
 */
function visit(tree, type, callback, reverse) {
    var iterate;
    var one;
    var all;

    if (typeof type === 'function') {
        reverse = callback;
        callback = type;
        type = null;
    }

    iterate = reverse ? backwards : forwards;

    /**
     * Visit `children` in `parent`.
     */
    all = function (children, parent) {
        return iterate(children, function (child, index) {
            return child && one(child, index, parent);
        });
    };

    /**
     * Visit a single node.
     */
    one = function (node, index, parent) {
        var result;

        index = index || (parent ? 0 : null);

        if (!type || node.type === type) {
            result = callback(node, index, parent || null);
        }

        if (node.children && result !== false) {
            return all(node.children, node);
        }

        return result;
    };

    one(tree);
}

/*
 * Expose.
 */

module.exports = visit;

},{}],80:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer
 * @license MIT
 * @module vfile:sort
 * @fileoverview Sort VFile messages by line/column.
 */

'use strict';

/**
 * Compare a single property.
 *
 * @param {VFileMessage} a - Original.
 * @param {VFileMessage} b - Comparison.
 * @param {string} property - Property to compare.
 * @return {number}
 */
function check(a, b, property) {
    return (a[property] || 0) - (b[property] || 0);
}

/**
 * Comparator.
 *
 * @param {VFileMessage} a - Original.
 * @param {VFileMessage} b - Comparison.
 * @return {number}
 */
function comparator(a, b) {
    return check(a, b, 'line') || check(a, b, 'column') || -1;
}

/**
 * Sort all `file`s messages by line/column.
 *
 * @param {VFile} file - Virtual file.
 * @return {VFile} - `file`.
 */
function sort(file) {
    file.messages.sort(comparator);
    return file;
}

/*
 * Expose.
 */

module.exports = sort;

},{}],81:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer
 * @license MIT
 * @module vfile
 * @fileoverview Virtual file format to attach additional
 *   information related to processed input.  Similar to
 *   `wearefractal/vinyl`.  Additionally, `VFile` can be
 *   passed directly to ESLint formatters to visualise
 *   warnings and errors relating to a file.
 * @example
 *   var VFile = require('vfile');
 *
 *   var file = new VFile({
 *     'directory': '~',
 *     'filename': 'example',
 *     'extension': 'txt',
 *     'contents': 'Foo *bar* baz'
 *   });
 *
 *   file.toString(); // 'Foo *bar* baz'
 *   file.filePath(); // '~/example.txt'
 *
 *   file.move({'extension': 'md'});
 *   file.filePath(); // '~/example.md'
 *
 *   file.warn('Something went wrong', {'line': 2, 'column': 3});
 *   // { [~/example.md:2:3: Something went wrong]
 *   //   name: '~/example.md:2:3',
 *   //   file: '~/example.md',
 *   //   reason: 'Something went wrong',
 *   //   line: 2,
 *   //   column: 3,
 *   //   fatal: false }
 */

'use strict';

var SEPARATOR = '/';

try {
    SEPARATOR = require('pa' + 'th').sep;
} catch (e) { /* empty */ }

/**
 * Construct a new file message.
 *
 * Note: We cannot invoke `Error` on the created context,
 * as that adds readonly `line` and `column` attributes on
 * Safari 9, thus throwing and failing the data.
 *
 * @example
 *   var message = new VFileMessage('Whoops!');
 *
 *   message instanceof Error // true
 *
 * @constructor
 * @class {VFileMessage}
 * @param {string} reason - Reason for messaging.
 * @property {boolean} [fatal=null] - Whether the message
 *   is fatal.
 * @property {string} [name=''] - File-name and positional
 *   information.
 * @property {string} [file=''] - File-path.
 * @property {string} [reason=''] - Reason for messaging.
 * @property {number} [line=null] - Start of message.
 * @property {number} [column=null] - Start of message.
 * @property {Position|Location} [location=null] - Place of
 *   message.
 * @property {string} [stack] - Stack-trace of warning.
 */
function VFileMessage(reason) {
    this.message = reason;
}

/**
 * Inherit from `Error#`.
 */
function VFileMessagePrototype() {}

VFileMessagePrototype.prototype = Error.prototype;

var proto = new VFileMessagePrototype();

VFileMessage.prototype = proto;

/*
 * Expose defaults.
 */

proto.file = proto.name = proto.reason = proto.message = proto.stack = '';
proto.fatal = proto.column = proto.line = null;

/**
 * File-related message with location information.
 *
 * @typedef {Error} VFileMessage
 * @property {string} name - (Starting) location of the
 *   message, preceded by its file-path when available,
 *   and joined by `:`. Used internally by the native
 *   `Error#toString()`.
 * @property {string} file - File-path.
 * @property {string} reason - Reason for message.
 * @property {number?} line - Line of message, when
 *   available.
 * @property {number?} column - Column of message, when
 *   available.
 * @property {string?} stack - Stack of message, when
 *   available.
 * @property {boolean?} fatal - Whether the associated file
 *   is still processable.
 */

/**
 * Stringify a position.
 *
 * @example
 *   stringify({'line': 1, 'column': 3}) // '1:3'
 *   stringify({'line': 1}) // '1:1'
 *   stringify({'column': 3}) // '1:3'
 *   stringify() // '1:1'
 *
 * @private
 * @param {Object?} [position] - Single position, like
 *   those available at `node.position.start`.
 * @return {string}
 */
function stringify(position) {
    if (!position) {
        position = {};
    }

    return (position.line || 1) + ':' + (position.column || 1);
}

/**
 * ESLint's formatter API expects `filePath` to be a
 * string.  This hack supports invocation as well as
 * implicit coercion.
 *
 * @example
 *   var file = new VFile({
 *     'filename': 'example',
 *     'extension': 'txt'
 *   });
 *
 *   filePath = filePathFactory(file);
 *
 *   String(filePath); // 'example.txt'
 *   filePath(); // 'example.txt'
 *
 * @private
 * @param {VFile} file - Virtual file.
 * @return {Function}
 */
function filePathFactory(file) {
    /**
     * Get the filename, with extension and directory, if applicable.
     *
     * @example
     *   var file = new VFile({
     *     'directory': '~',
     *     'filename': 'example',
     *     'extension': 'txt'
     *   });
     *
     *   String(file.filePath); // ~/example.txt
     *   file.filePath() // ~/example.txt
     *
     * @memberof {VFile}
     * @property {Function} toString - Itself. ESLint's
     *   formatter API expects `filePath` to be `string`.
     *   This hack supports invocation as well as implicit
     *   coercion.
     * @return {string} - If the `vFile` has a `filename`,
     *   it will be prefixed with the directory (slashed),
     *   if applicable, and suffixed with the (dotted)
     *   extension (if applicable).  Otherwise, an empty
     *   string is returned.
     */
    function filePath() {
        var directory = file.directory;
        var separator;

        if (file.filename || file.extension) {
            separator = directory.charAt(directory.length - 1);

            if (separator === '/' || separator === '\\') {
                directory = directory.slice(0, -1);
            }

            if (directory === '.') {
                directory = '';
            }

            return (directory ? directory + SEPARATOR : '') +
                file.filename +
                (file.extension ? '.' + file.extension : '');
        }

        return '';
    }

    filePath.toString = filePath;

    return filePath;
}

/**
 * Construct a new file.
 *
 * @example
 *   var file = new VFile({
 *     'directory': '~',
 *     'filename': 'example',
 *     'extension': 'txt',
 *     'contents': 'Foo *bar* baz'
 *   });
 *
 *   file === VFile(file) // true
 *   file === new VFile(file) // true
 *   VFile('foo') instanceof VFile // true
 *
 * @constructor
 * @class {VFile}
 * @param {Object|VFile|string} [options] - either an
 *   options object, or the value of `contents` (both
 *   optional).  When a `file` is passed in, it's
 *   immediately returned.
 * @property {string} [contents=''] - Content of file.
 * @property {string} [directory=''] - Path to parent
 *   directory.
 * @property {string} [filename=''] - Filename.
 *   A file-path can still be generated when no filename
 *   exists.
 * @property {string} [extension=''] - Extension.
 *   A file-path can still be generated when no extension
 *   exists.
 * @property {boolean?} quiet - Whether an error created by
 *   `VFile#fail()` is returned (when truthy) or thrown
 *   (when falsey). Ensure all `messages` associated with
 *   a file are handled properly when setting this to
 *   `true`.
 * @property {Array.<VFileMessage>} messages - List of associated
 *   messages.
 */
function VFile(options) {
    var self = this;

    /*
     * No `new` operator.
     */

    if (!(self instanceof VFile)) {
        return new VFile(options);
    }

    /*
     * Given file.
     */

    if (
        options &&
        typeof options.message === 'function' &&
        typeof options.hasFailed === 'function'
    ) {
        return options;
    }

    if (!options) {
        options = {};
    } else if (typeof options === 'string') {
        options = {
            'contents': options
        };
    }

    self.contents = options.contents || '';

    self.messages = [];

    /*
     * Make sure eslint’s formatters stringify `filePath`
     * properly.
     */

    self.filePath = filePathFactory(self);

    self.history = [];

    self.move({
        'filename': options.filename,
        'directory': options.directory,
        'extension': options.extension
    })
}

/**
 * Get the value of the file.
 *
 * @example
 *   var vFile = new VFile('Foo');
 *   String(vFile); // 'Foo'
 *
 * @this {VFile}
 * @memberof {VFile}
 * @return {string} - value at the `contents` property
 *   in context.
 */
function toString() {
    return this.contents;
}

/**
 * Move a file by passing a new directory, filename,
 * and extension.  When these are not given, the default
 * values are kept.
 *
 * @example
 *   var file = new VFile({
 *     'directory': '~',
 *     'filename': 'example',
 *     'extension': 'txt',
 *     'contents': 'Foo *bar* baz'
 *   });
 *
 *   file.move({'directory': '/var/www'});
 *   file.filePath(); // '/var/www/example.txt'
 *
 *   file.move({'extension': 'md'});
 *   file.filePath(); // '/var/www/example.md'
 *
 * @this {VFile}
 * @memberof {VFile}
 * @param {Object?} [options] - Configuration.
 * @return {VFile} - Context object.
 */
function move(options) {
    var self = this;
    var before = self.filePath();
    var after;

    if (!options) {
        options = {};
    }

    self.directory = options.directory || self.directory || '';
    self.filename = options.filename || self.filename || '';
    self.extension = options.extension || self.extension || '';

    after = self.filePath();

    if (after && before !== after) {
        self.history.push(after);
    }

    return self;
}

/**
 * Create a message with `reason` at `position`.
 * When an error is passed in as `reason`, copies the
 * stack.  This does not add a message to `messages`.
 *
 * @example
 *   var file = new VFile();
 *
 *   file.message('Something went wrong');
 *   // { [1:1: Something went wrong]
 *   //   name: '1:1',
 *   //   file: '',
 *   //   reason: 'Something went wrong',
 *   //   line: null,
 *   //   column: null }
 *
 * @this {VFile}
 * @memberof {VFile}
 * @param {string|Error} reason - Reason for message.
 * @param {Node|Location|Position} [position] - Location
 *   of message in file.
 * @return {VFileMessage} - File-related message with
 *   location information.
 */
function message(reason, position) {
    var filePath = this.filePath();
    var range;
    var err;
    var location = {
        'start': {
            'line': null,
            'column': null
        },
        'end': {
            'line': null,
            'column': null
        }
    };

    /*
     * Node / location / position.
     */

    if (position && position.position) {
        position = position.position;
    }

    if (position && position.start) {
        range = stringify(position.start) + '-' + stringify(position.end);
        location = position;
        position = position.start;
    } else {
        range = stringify(position);

        if (position) {
            location.start = position;
            location.end.line = null;
            location.end.column = null;
        }
    }

    err = new VFileMessage(reason.message || reason);

    err.name = (filePath ? filePath + ':' : '') + range;
    err.file = filePath;
    err.reason = reason.message || reason;
    err.line = position ? position.line : null;
    err.column = position ? position.column : null;
    err.location = location;

    if (reason.stack) {
        err.stack = reason.stack;
    }

    return err;
}

/**
 * Warn. Creates a non-fatal message (see `VFile#message()`),
 * and adds it to the file's `messages` list.
 *
 * @example
 *   var file = new VFile();
 *
 *   file.warn('Something went wrong');
 *   // { [1:1: Something went wrong]
 *   //   name: '1:1',
 *   //   file: '',
 *   //   reason: 'Something went wrong',
 *   //   line: null,
 *   //   column: null,
 *   //   fatal: false }
 *
 * @see VFile#message
 * @this {VFile}
 * @memberof {VFile}
 */
function warn() {
    var err = this.message.apply(this, arguments);

    err.fatal = false;

    this.messages.push(err);

    return err;
}

/**
 * Fail. Creates a fatal message (see `VFile#message()`),
 * sets `fatal: true`, adds it to the file's
 * `messages` list.
 *
 * If `quiet` is not `true`, throws the error.
 *
 * @example
 *   var file = new VFile();
 *
 *   file.fail('Something went wrong');
 *   // 1:1: Something went wrong
 *   //     at VFile.exception (vfile/index.js:296:11)
 *   //     at VFile.fail (vfile/index.js:360:20)
 *   //     at repl:1:6
 *
 *   file.quiet = true;
 *   file.fail('Something went wrong');
 *   // { [1:1: Something went wrong]
 *   //   name: '1:1',
 *   //   file: '',
 *   //   reason: 'Something went wrong',
 *   //   line: null,
 *   //   column: null,
 *   //   fatal: true }
 *
 * @this {VFile}
 * @memberof {VFile}
 * @throws {VFileMessage} - When not `quiet: true`.
 * @param {string|Error} reason - Reason for failure.
 * @param {Node|Location|Position} [position] - Place
 *   of failure in file.
 * @return {VFileMessage} - Unless thrown, of course.
 */
function fail(reason, position) {
    var err = this.message(reason, position);

    err.fatal = true;

    this.messages.push(err);

    if (!this.quiet) {
        throw err;
    }

    return err;
}

/**
 * Check if a fatal message occurred making the file no
 * longer processable.
 *
 * @example
 *   var file = new VFile();
 *   file.quiet = true;
 *
 *   file.hasFailed(); // false
 *
 *   file.fail('Something went wrong');
 *   file.hasFailed(); // true
 *
 * @this {VFile}
 * @memberof {VFile}
 * @return {boolean} - `true` if at least one of file's
 *   `messages` has a `fatal` property set to `true`
 */
function hasFailed() {
    var messages = this.messages;
    var index = -1;
    var length = messages.length;

    while (++index < length) {
        if (messages[index].fatal) {
            return true;
        }
    }

    return false;
}

/**
 * Access metadata.
 *
 * @example
 *   var file = new VFile('Foo');
 *
 *   file.namespace('foo').bar = 'baz';
 *
 *   console.log(file.namespace('foo').bar) // 'baz';
 *
 * @this {VFile}
 * @memberof {VFile}
 * @param {string} key - Namespace key.
 * @return {Object} - Private space.
 */
function namespace(key) {
    var self = this;
    var space = self.data;

    if (!space) {
        space = self.data = {};
    }

    if (!space[key]) {
        space[key] = {};
    }

    return space[key];
}

/*
 * Methods.
 */

var vFilePrototype = VFile.prototype;

vFilePrototype.move = move;
vFilePrototype.toString = toString;
vFilePrototype.message = message;
vFilePrototype.warn = warn;
vFilePrototype.fail = fail;
vFilePrototype.hasFailed = hasFailed;
vFilePrototype.namespace = namespace;

/*
 * Expose.
 */

module.exports = VFile;

},{}],82:[function(require,module,exports){
/**
 * Module Dependencies
 */

var slice = [].slice;
var wrap = require('wrap-fn');

/**
 * Expose `Ware`.
 */

module.exports = Ware;

/**
 * Throw an error.
 *
 * @param {Error} error
 */

function fail (err) {
  throw err;
}

/**
 * Initialize a new `Ware` manager, with optional `fns`.
 *
 * @param {Function or Array or Ware} fn (optional)
 */

function Ware (fn) {
  if (!(this instanceof Ware)) return new Ware(fn);
  this.fns = [];
  if (fn) this.use(fn);
}

/**
 * Use a middleware `fn`.
 *
 * @param {Function or Array or Ware} fn
 * @return {Ware}
 */

Ware.prototype.use = function (fn) {
  if (fn instanceof Ware) {
    return this.use(fn.fns);
  }

  if (fn instanceof Array) {
    for (var i = 0, f; f = fn[i++];) this.use(f);
    return this;
  }

  this.fns.push(fn);
  return this;
};

/**
 * Run through the middleware with the given `args` and optional `callback`.
 *
 * @param {Mixed} args...
 * @param {Function} callback (optional)
 * @return {Ware}
 */

Ware.prototype.run = function () {
  var fns = this.fns;
  var ctx = this;
  var i = 0;
  var last = arguments[arguments.length - 1];
  var done = 'function' == typeof last && last;
  var args = done
    ? slice.call(arguments, 0, arguments.length - 1)
    : slice.call(arguments);

  // next step
  function next (err) {
    if (err) return (done || fail)(err);
    var fn = fns[i++];
    var arr = slice.call(args);

    if (!fn) {
      return done && done.apply(null, [null].concat(args));
    }

    wrap(fn, next).apply(ctx, arr);
  }

  next();

  return this;
};

},{"wrap-fn":83}],83:[function(require,module,exports){
/**
 * Module Dependencies
 */

var noop = function(){};
var co = require('co');

/**
 * Export `wrap-fn`
 */

module.exports = wrap;

/**
 * Wrap a function to support
 * sync, async, and gen functions.
 *
 * @param {Function} fn
 * @param {Function} done
 * @return {Function}
 * @api public
 */

function wrap(fn, done) {
  done = once(done || noop);

  return function() {
    // prevents arguments leakage
    // see https://github.com/petkaantonov/bluebird/wiki/Optimization-killers#3-managing-arguments
    var i = arguments.length;
    var args = new Array(i);
    while (i--) args[i] = arguments[i];

    var ctx = this;

    // done
    if (!fn) {
      return done.apply(ctx, [null].concat(args));
    }

    // async
    if (fn.length > args.length) {
      // NOTE: this only handles uncaught synchronous errors
      try {
        return fn.apply(ctx, args.concat(done));
      } catch (e) {
        return done(e);
      }
    }

    // generator
    if (generator(fn)) {
      return co(fn).apply(ctx, args.concat(done));
    }

    // sync
    return sync(fn, done).apply(ctx, args);
  }
}

/**
 * Wrap a synchronous function execution.
 *
 * @param {Function} fn
 * @param {Function} done
 * @return {Function}
 * @api private
 */

function sync(fn, done) {
  return function () {
    var ret;

    try {
      ret = fn.apply(this, arguments);
    } catch (err) {
      return done(err);
    }

    if (promise(ret)) {
      ret.then(function (value) { done(null, value); }, done);
    } else {
      ret instanceof Error ? done(ret) : done(null, ret);
    }
  }
}

/**
 * Is `value` a generator?
 *
 * @param {Mixed} value
 * @return {Boolean}
 * @api private
 */

function generator(value) {
  return value
    && value.constructor
    && 'GeneratorFunction' == value.constructor.name;
}


/**
 * Is `value` a promise?
 *
 * @param {Mixed} value
 * @return {Boolean}
 * @api private
 */

function promise(value) {
  return value && 'function' == typeof value.then;
}

/**
 * Once
 */

function once(fn) {
  return function() {
    var ret = fn.apply(this, arguments);
    fn = noop;
    return ret;
  };
}

},{"co":17}]},{},[1])(1)
});