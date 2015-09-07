(function outer(modules, cache, entries){

  /**
   * Global
   */

  var global = (function(){ return this; })();

  /**
   * Require `name`.
   *
   * @param {String} name
   * @api public
   */

  function require(name){
    if (cache[name]) return cache[name].exports;
    if (modules[name]) return call(name, require);
    throw new Error('cannot find module "' + name + '"');
  }

  /**
   * Call module `id` and cache it.
   *
   * @param {Number} id
   * @param {Function} require
   * @return {Function}
   * @api private
   */

  function call(id, require){
    var m = cache[id] = { exports: {} };
    var mod = modules[id];
    var name = mod[2];
    var fn = mod[0];
    var threw = true;

    try {
      fn.call(m.exports, function(req){
        var dep = modules[id][1][req];
        return require(dep || req);
      }, m, m.exports, outer, modules, cache, entries);
      threw = false;
    } finally {
      if (threw) {
        delete cache[id];
      } else if (name) {
        // expose as 'name'.
        cache[name] = cache[id];
      }
    }

    return cache[id].exports;
  }

  /**
   * Require all entries exposing them on global if needed.
   */

  for (var id in entries) {
    if (entries[id]) {
      global[entries[id]] = require(id);
    } else {
      require(id);
    }
  }

  /**
   * Duo flag.
   */

  require.duo = true;

  /**
   * Expose cache.
   */

  require.cache = cache;

  /**
   * Expose modules
   */

  require.modules = modules;

  /**
   * Return newest require.
   */

   return require;
})({
1: [function(require, module, exports) {
'use strict';

/*
 * Dependencies.
 */

var alex = require('wooorm/alex');
var debounce = require('component/debounce');
var events = require('component/event');

/*
 * Nodes.
 */

var $input = document.getElementsByTagName('textarea')[0];
var $highlight = document.getElementById('highlight');
var $issues = document.getElementById('issues');
var $noIssues = document.getElementById('no-issues');

function decorateMessage(message) {
    var value = message.reason;
    var index = value.indexOf('use');

    return value.replace(/`(.+?)`/g, function ($0, $1, position) {
        var name = position > index ? 'ok' : 'nok';
        return '<code class="label label-' + name + '">' + $1 + '</code>';
    });
}

function getOffsets(messages) {
    var length = messages.length;
    var map = {};
    var offsets = [];
    var index = -1;
    var position = undefined;
    var start = undefined;
    var end = undefined;
    var key = undefined;
    var prev = undefined;

    /*
     * Algorithm is a bit funky as the locations are sorted,
     * thus we can expect a lot to be true.
     */

    while (++index < length) {
        position = messages[index].location || {};
        start = position.start && position.start.offset;
        end = position.end && position.end.offset;

        if (isNaN(start) || isNaN(end)) {
            continue;
        }

        if (prev && end < prev) {
            continue;
        }

        prev = end;

        if (start in map) {
            if (end > map[start]) {
                map[start] = end;
            }
        } else {
            map[start] = end;
        }
    }

    for (key in map) {
        offsets.push([Number(key), map[key]]);
    }

    return offsets;
}

function decorateContent(content, messages) {
    var offsets = getOffsets(messages);
    var length = offsets.length;
    var $fragment = document.createDocumentFragment();
    var index = -1;
    var last = 0;
    var offset = undefined;
    var value = undefined;
    var warning = undefined;
    var $warning = undefined;

    while (++index < length) {
        offset = offsets[index];

        $fragment.appendChild(document.createTextNode(content.slice(last, offset[0])));

        $warning = document.createElement('span');
        $warning.className = 'offense';
        $warning.appendChild(document.createTextNode(content.slice(offset[0], offset[1])));

        $fragment.appendChild($warning);

        last = offset[1];
    }

    $fragment.appendChild(document.createTextNode(content.slice(last)));

    return $fragment;
}

function removeChildren($node) {
    var $head = undefined;

    while ($head = $node.firstChild) {
        $node.removeChild($head);
    }
}

var previousValue = '';

/**
 * Change.
 */
function onchange() {
    var value = $input.value;
    var messages = undefined;
    var index = undefined;
    var length = undefined;
    var $fragment = undefined;
    var $item = undefined;
    var $head = undefined;
    var message = undefined;

    if (value !== previousValue) {
        previousValue = value;
        messages = alex(value).messages;
        index = -1;
        length = messages.length;
        $fragment = document.createDocumentFragment();

        $noIssues.setAttribute('style', length ? 'display:none' : '');
        $issues.setAttribute('style', !length ? 'display:none' : '');

        $highlight.setAttribute('style', 'opacity:0');
        removeChildren($highlight);

        $highlight.appendChild(decorateContent(value, messages));
        $highlight.setAttribute('style', '');

        removeChildren($issues);

        while (++index < length) {
            message = messages[index];
            $item = document.createElement('li');
            $item.className = 'issue';
            $item.source = message.toString();
            $item.innerHTML = decorateMessage(message);

            $fragment.appendChild($item);
        }

        $issues.appendChild($fragment);
    }

    $highlight.scrollTop = $input.scrollTop;
    $highlight.style.opacity = '';
}

function onstart() {
    if ($input.value !== previousValue || $highlight.scrollTop !== $input.scrollTop) {
        $highlight.style.opacity = '0';
    }
}

var end = debounce(onchange, 300);
var start = debounce(onstart, 100, true);

['change', 'onpropertychange', 'input', 'keydown', 'click', 'focus', 'scroll'].forEach(function (name) {
    events.bind($input, name, start);
    events.bind($input, name, end);
});

onchange();
}, {"wooorm/alex":2,"component/debounce":3,"component/event":4}],
2: [function(require, module, exports) {
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

var bail = require('bail');
var mdast = require('mdast');
var bridge = require('mdast-util-to-nlcst');
var retext = require('retext');
var parser = require('retext-english');
var equality = require('retext-equality');
var sort = require('vfile-sort');

/*
 * Processor.
 */

var markdown = mdast();
var english = retext().use(parser).use(equality);

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
function alex(value) {
  var result;

  /*
   * All callbacks are in fact completely sync.
   */

  markdown.process(value, function (err, file) {
    bail(err);

    bridge(file);

    english.run(file);

    sort(file);

    result = file;
  });

  return result;
}

/*
 * Expose.
 */

module.exports = alex;
}, {"bail":5,"mdast":6,"mdast-util-to-nlcst":7,"retext":8,"retext-english":9,"retext-equality":10,"vfile-sort":11}],
5: [function(require, module, exports) {
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
}, {}],
6: [function(require, module, exports) {
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer
 * @license MIT
 * @module mdast
 * @fileoverview Markdown processor powered by plugins.
 */

'use strict';

/*
 * Dependencies.
 */

var unified = require('unified');
var Parser = require('./lib/parse.js');
var Compiler = require('./lib/stringify.js');

/*
 * Exports.
 */

module.exports = unified({
  'name': 'mdast',
  'type': 'ast',
  'Parser': Parser,
  'Compiler': Compiler
});
}, {"unified":12,"./lib/parse.js":13,"./lib/stringify.js":14}],
12: [function(require, module, exports) {
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer
 * @license MIT
 * @module unified
 * @fileoverview Parse / Transform / Compile / Repeat.
 */

'use strict';

/*
 * Dependencies.
 */

var bail = require('bail');
var ware = require('ware');
var AttachWare = require('attach-ware')(ware);
var VFile = require('vfile');
var unherit = require('unherit');

/*
 * Processing pipeline.
 */

var pipeline = ware().use(function (ctx) {
    ctx.tree = ctx.context.parse(ctx.file, ctx.settings);
}).use(function (ctx, next) {
    ctx.context.run(ctx.tree, ctx.file, next);
}).use(function (ctx) {
    ctx.result = ctx.context.stringify(ctx.tree, ctx.file, ctx.settings);
});

/**
 * Construct a new Processor class based on the
 * given options.
 *
 * @param {Object} options - Configuration.
 * @param {string} options.name - Private storage.
 * @param {string} options.type - Type of syntax tree.
 * @param {Function} options.Parser - Class to turn a
 *   virtual file into a syntax tree.
 * @param {Function} options.Compiler - Class to turn a
 *   syntax tree into a string.
 * @return {Processor} - A new constructor.
 */
function unified(options) {
    var name = options.name;
    var type = options.type;
    var Parser = options.Parser;
    var Compiler = options.Compiler;

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
            node = space[type] || node;
        } else if (!space[type]) {
            space[type] = node;
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
        var CustomParser = this && this.Parser || Parser;
        var node = new CustomParser(file, settings).parse();

        file.namespace(name)[type] = node;

        return node;
    }

    /**
     * Compile a file.
     *
     * Used the parsed node at the `name`
     * namespace at `type` when no node was given.
     *
     * @this {Processor?} - Either a Processor instance or
     *   the Processor constructor.
     * @param {Object} [node] - Syntax tree.
     * @param {VFile} [file] - File with syntax tree.
     * @param {Object?} [settings] - Configuration.
     * @return {string} - Compiled `file`.
     */
    function stringify(node, file, settings) {
        var CustomCompiler = this && this.Compiler || Compiler;
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
            node = space[type] || node;
        } else if (!space[type]) {
            space[type] = node;
        }

        if (!node) {
            throw new Error('Expected node, got ' + node);
        }

        return new CustomCompiler(file, settings).compile();
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

    return Processor;
}

/*
 * Expose.
 */

module.exports = unified;
}, {"bail":5,"ware":15,"attach-ware":16,"vfile":17,"unherit":18}],
15: [function(require, module, exports) {
/**
 * Module Dependencies
 */

'use strict';

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

function fail(err) {
  throw err;
}

/**
 * Initialize a new `Ware` manager, with optional `fns`.
 *
 * @param {Function or Array or Ware} fn (optional)
 */

function Ware(fn) {
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
  var args = done ? slice.call(arguments, 0, arguments.length - 1) : slice.call(arguments);

  // next step
  function next(err) {
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
}, {"wrap-fn":19}],
19: [function(require, module, exports) {
/**
 * Module Dependencies
 */

'use strict';

var noop = function noop() {};
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

  return function () {
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
  };
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
      ret.then(function (value) {
        done(null, value);
      }, done);
    } else {
      ret instanceof Error ? done(ret) : done(null, ret);
    }
  };
}

/**
 * Is `value` a generator?
 *
 * @param {Mixed} value
 * @return {Boolean}
 * @api private
 */

function generator(value) {
  return value && value.constructor && 'GeneratorFunction' == value.constructor.name;
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
  return function () {
    var ret = fn.apply(this, arguments);
    fn = noop;
    return ret;
  };
}
}, {"co":20}],
20: [function(require, module, exports) {

/**
 * slice() reference.
 */

'use strict';

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
      var args = slice.call(arguments),
          len = args.length;
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
      setImmediate(function () {
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
          ret = gen['throw'](err);
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
          ret.value.call(ctx, function () {
            if (called) return;
            called = true;
            next.apply(ctx, arguments);
          });
        } catch (e) {
          setImmediate(function () {
            if (called) return;
            called = true;
            next(e);
          });
        }
        return;
      }

      // invalid
      next(new TypeError('You may only yield a function, promise, generator, array, or object, ' + 'but the following was passed: "' + String(ret.value) + '"'));
    }
  };
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

function objectToThunk(obj) {
  var ctx = this;
  var isArray = Array.isArray(obj);

  return function (done) {
    var keys = Object.keys(obj);
    var pending = keys.length;
    var results = isArray ? new Array(pending) // predefine the array length
    : new obj.constructor();
    var finished;

    if (!pending) {
      setImmediate(function () {
        done(null, results);
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

        fn.call(ctx, function (err, res) {
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
  };
}

/**
 * Convert `promise` to a thunk.
 *
 * @param {Object} promise
 * @return {Function}
 * @api private
 */

function promiseToThunk(promise) {
  return function (fn) {
    promise.then(function (res) {
      fn(null, res);
    }, fn);
  };
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
  return obj && 'function' == typeof obj.next && 'function' == typeof obj['throw'];
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
  setImmediate(function () {
    throw err;
  });
}
}, {}],
16: [function(require, module, exports) {
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
}, {"unherit":18}],
18: [function(require, module, exports) {
"use strict";

(function (f) {
  if (typeof exports === "object" && typeof module !== "undefined") {
    module.exports = f();
  } else if (typeof define === "function" && define.amd) {
    define([], f);
  } else {
    var g;if (typeof window !== "undefined") {
      g = window;
    } else if (typeof global !== "undefined") {
      g = global;
    } else if (typeof self !== "undefined") {
      g = self;
    } else {
      g = this;
    }g.unherit = f();
  }
})(function () {
  var define, module, exports;return (function e(t, n, r) {
    function s(o, u) {
      if (!n[o]) {
        if (!t[o]) {
          var a = typeof require == "function" && require;if (!u && a) return a(o, !0);if (i) return i(o, !0);var f = new Error("Cannot find module '" + o + "'");throw (f.code = "MODULE_NOT_FOUND", f);
        }var l = n[o] = { exports: {} };t[o][0].call(l.exports, function (e) {
          var n = t[o][1][e];return s(n ? n : e);
        }, l, l.exports, e, t, n, r);
      }return n[o].exports;
    }var i = typeof require == "function" && require;for (var o = 0; o < r.length; o++) s(r[o]);return s;
  })({ 1: [function (require, module, exports) {
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
    }, { "clone": 2, "inherits": 3 }], 2: [function (require, module, exports) {
      var clone = (function () {
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
            circular = circular.circular;
          }
          // maintain two arrays for circular references, where corresponding parents
          // and children have the same index
          var allParents = [];
          var allChildren = [];

          var useBuffer = typeof Buffer != 'undefined';

          if (typeof circular == 'undefined') circular = true;

          if (typeof depth == 'undefined') depth = Infinity;

          // recurse this function so we don't reset allParents and allChildren
          function _clone(parent, depth) {
            // cloning null always returns null
            if (parent === null) return null;

            if (depth == 0) return parent;

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
              } else {
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
          if (parent === null) return null;

          var c = function c() {};
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
    }, {}], 3: [function (require, module, exports) {
      if (typeof Object.create === 'function') {
        // implementation from standard node.js 'util' module
        module.exports = function inherits(ctor, superCtor) {
          ctor.super_ = superCtor;
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
          ctor.super_ = superCtor;
          var TempCtor = function TempCtor() {};
          TempCtor.prototype = superCtor.prototype;
          ctor.prototype = new TempCtor();
          ctor.prototype.constructor = ctor;
        };
      }
    }, {}] }, {}, [1])(1);
});
}, {}],
17: [function(require, module, exports) {
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
} catch (e) {} /* empty */

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

            return (directory ? directory + SEPARATOR : '') + file.filename + (file.extension ? '.' + file.extension : '');
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

    if (options && typeof options.message === 'function' && typeof options.hasFailed === 'function') {
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
    });
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

    err = new Error(reason.message || reason);

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
}, {}],
13: [function(require, module, exports) {
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer
 * @license MIT
 * @module mdast:parse
 * @fileoverview Parse a markdown document into an
 *   abstract syntax tree.
 */

'use strict';

/*
 * Dependencies.
 */

var he = require('he');
var repeat = require('repeat-string');
var trim = require('trim');
var trimTrailingLines = require('trim-trailing-lines');
var extend = require('extend.js');
var utilities = require('./utilities.js');
var defaultExpressions = require('./expressions.js');
var defaultOptions = require('./defaults.js').parse;

/*
 * Methods.
 */

var raise = utilities.raise;
var clean = utilities.clean;
var validate = utilities.validate;
var normalize = utilities.normalizeIdentifier;
var arrayPush = [].push;

/*
 * Characters.
 */

var AT_SIGN = '@';
var CARET = '^';
var EQUALS = '=';
var EXCLAMATION_MARK = '!';
var MAILTO_PROTOCOL = 'mailto:';
var NEW_LINE = '\n';
var SPACE = ' ';
var TAB = '\t';
var EMPTY = '';
var LT = '<';
var GT = '>';
var BRACKET_OPEN = '[';

/*
 * Types.
 */

var BLOCK = 'block';
var INLINE = 'inline';
var HORIZONTAL_RULE = 'horizontalRule';
var HTML = 'html';
var YAML = 'yaml';
var TABLE = 'table';
var TABLE_CELL = 'tableCell';
var TABLE_HEADER = 'tableHeader';
var TABLE_ROW = 'tableRow';
var PARAGRAPH = 'paragraph';
var TEXT = 'text';
var CODE = 'code';
var LIST = 'list';
var LIST_ITEM = 'listItem';
var FOOTNOTE_DEFINITION = 'footnoteDefinition';
var HEADING = 'heading';
var BLOCKQUOTE = 'blockquote';
var LINK = 'link';
var IMAGE = 'image';
var FOOTNOTE = 'footnote';
var ESCAPE = 'escape';
var STRONG = 'strong';
var EMPHASIS = 'emphasis';
var DELETE = 'delete';
var INLINE_CODE = 'inlineCode';
var BREAK = 'break';
var ROOT = 'root';

/**
 * Wrapper around he's `decode` function.
 *
 * @example
 *   decode('&amp;'); // '&'
 *   decode('&amp'); // '&'
 *
 * @param {string} value
 * @param {function(string)} eat
 * @return {string}
 * @throws {Error} - When `eat.file.quiet` is not `true`.
 *   However, by default `he` does not throw on incorrect
 *   encoded entities, but when
 *   `he.decode.options.strict: true`, they occur on
 *   entities with a missing closing semi-colon.
 */
function decode(value, eat) {
    try {
        return he.decode(value);
    } catch (exception) {
        eat.file.fail(exception, eat.now());
    }
}

/**
 * Factory to de-escape a value, based on an expression
 * at `key` in `scope`.
 *
 * @example
 *   var expressions = {escape: /\\(a)/}
 *   var descape = descapeFactory(expressions, 'escape');
 *
 * @param {Object} scope - Map of expressions.
 * @param {string} key - Key in `map` at which the
 *   non-global expression exists.
 * @return {function(string): string} - Function which
 *   takes a value and returns its unescaped version.
 */
function descapeFactory(scope, key) {
    var globalExpression;
    var expression;

    /**
     * Private method to get a global expression
     * from the expression at `key` in `scope`.
     * This method is smart about not recreating
     * the expressions every time.
     *
     * @private
     * @return {RegExp}
     */
    function generate() {
        if (scope[key] !== globalExpression) {
            globalExpression = scope[key];
            expression = new RegExp(scope[key].source.replace(CARET, EMPTY), 'g');
        }

        return expression;
    }

    /**
     * De-escape a string using the expression at `key`
     * in `scope`.
     *
     * @example
     *   var expressions = {escape: /\\(a)/}
     *   var descape = descapeFactory(expressions, 'escape');
     *   descape('\a'); // 'a'
     *
     * @param {string} value - Escaped string.
     * @return {string} - Unescaped string.
     */
    function descape(value) {
        return value.replace(generate(), '$1');
    }

    return descape;
}

/*
 * Tab size.
 */

var TAB_SIZE = 4;

/*
 * Expressions.
 */

var EXPRESSION_RIGHT_ALIGNMENT = /^[ \t]*-+:[ \t]*$/;
var EXPRESSION_CENTER_ALIGNMENT = /^[ \t]*:-+:[ \t]*$/;
var EXPRESSION_LEFT_ALIGNMENT = /^[ \t]*:-+[ \t]*$/;
var EXPRESSION_TABLE_FENCE = /^[ \t]*|\|[ \t]*$/g;
var EXPRESSION_TABLE_INITIAL = /^[ \t]*\|/g;
var EXPRESSION_TABLE_CONTENT = /[ \t]*?((?:\\[\s\S]|[^\|])+?)([ \t]?\|[ \t]?\n?|\n?$)/g;
var EXPRESSION_TABLE_BORDER = /[ \t]*\|[ \t]*/;
var EXPRESSION_BLOCK_QUOTE = /^[ \t]*>[ \t]?/gm;
var EXPRESSION_BULLET = /^([ \t]*)([*+-]|\d+[.)])( {1,4}(?! )| |\t)([^\n]*)/;
var EXPRESSION_PEDANTIC_BULLET = /^([ \t]*)([*+-]|\d+[.)])([ \t]+)/;
var EXPRESSION_INITIAL_INDENT = /^( {1,4}|\t)?/gm;
var EXPRESSION_INITIAL_TAB = /^( {4}|\t)?/gm;
var EXPRESSION_HTML_LINK_OPEN = /^<a /i;
var EXPRESSION_HTML_LINK_CLOSE = /^<\/a>/i;
var EXPRESSION_LOOSE_LIST_ITEM = /\n\n(?!\s*$)/;
var EXPRESSION_TASK_ITEM = /^\[([\ \t]|x|X)\][\ \t]/;

/*
 * A map of characters, and their column length,
 * which can be used as indentation.
 */

var INDENTATION_CHARACTERS = {};

INDENTATION_CHARACTERS[SPACE] = SPACE.length;
INDENTATION_CHARACTERS[TAB] = TAB_SIZE;

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
 * @return {Object}
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
 * @param {string} value
 * @param {number?} [maximum] - Maximum indentation
 *   to remove.
 * @return {string} - Unindented `value`.
 */
function removeIndentation(value, maximum) {
    var values = value.split(NEW_LINE);
    var position = values.length + 1;
    var minIndent = Infinity;
    var matrix = [];
    var index;
    var indentation;
    var stops;
    var padding;

    values.unshift(repeat(SPACE, maximum) + EXCLAMATION_MARK);

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

            if (trim(values[position]).length !== 0 && minIndent && index !== minIndent) {
                padding = TAB;
            } else {
                padding = EMPTY;
            }

            values[position] = padding + values[position].slice(index in stops ? stops[index] + 1 : 0);
        }
    }

    values.shift();

    return values.join(NEW_LINE);
}

/**
 * Ensure that `value` is at least indented with
 * `indent` spaces.  Does not support tabs. Does support
 * multiple lines.
 *
 * @example
 *   ensureIndentation('foo', 2); // '  foo'
 *   ensureIndentation('  foo', 4); // '    foo'
 *
 * @param {string} value
 * @param {number} indent - The maximum amount of
 *   spacing to insert.
 * @return {string} - indented `value`.
 */
function ensureIndentation(value, indent) {
    var values = value.split(NEW_LINE);
    var length = values.length;
    var index = -1;
    var line;
    var position;

    while (++index < length) {
        line = values[index];

        position = -1;

        while (++position < indent) {
            if (line.charAt(position) !== SPACE) {
                values[index] = repeat(SPACE, indent - position) + line;
                break;
            }
        }
    }

    return values.join(NEW_LINE);
}

/**
 * Get the alignment from a table rule.
 *
 * @example
 *   getAlignment([':-', ':-:', '-:', '--']);
 *   // ['left', 'center', 'right', null];
 *
 * @param {Array.<string>} cells
 * @return {Array.<string?>}
 */
function getAlignment(cells) {
    var results = [];
    var index = -1;
    var length = cells.length;
    var alignment;

    while (++index < length) {
        alignment = cells[index];

        if (EXPRESSION_RIGHT_ALIGNMENT.test(alignment)) {
            results[index] = 'right';
        } else if (EXPRESSION_CENTER_ALIGNMENT.test(alignment)) {
            results[index] = 'center';
        } else if (EXPRESSION_LEFT_ALIGNMENT.test(alignment)) {
            results[index] = 'left';
        } else {
            results[index] = null;
        }
    }

    return results;
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

/**
 * Construct a state toggler which doesn't toggle.
 *
 * @example
 *   var context = {};
 *   var key = 'foo';
 *   var val = true;
 *   context[key] = val;
 *   context.enter = noopToggler();
 *   context[key]; // true
 *   var exit = context.enter();
 *   context[key]; // true
 *   exit();
 *   context[key]; // true
 *
 * @return {function(): function()} - Enter.
 */
function noopToggler() {
    /**
     * No-operation.
     */
    function exit() {}

    /**
     * @return {Function}
     */
    function enter() {
        return exit;
    }

    return enter;
}

/*
 * Define nodes of a type which can be merged.
 */

var MERGEABLE_NODES = {};

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

/**
 * Merge two lists: `node` into `prev`. Knows, about
 * which bullets were used.
 *
 * @param {Object} prev - Preceding sibling.
 * @param {Object} node - Following sibling.
 * @return {Object} - `prev`, or `node` when the lists are
 *   of different types (a different bullet is used).
 */
MERGEABLE_NODES.list = function (prev, node) {
    if (!this.currentBullet || this.currentBullet !== this.previousBullet || this.currentBullet.length !== 1) {
        return node;
    }

    prev.children = prev.children.concat(node.children);

    return prev;
};

/**
 * Tokenise a line.  Unsets `currentBullet` and
 * `previousBullet` if more than one lines are found, thus
 * preventing lists from merging when they use different
 * bullets.
 *
 * @example
 *   tokenizeNewline(eat, '\n\n');
 *
 * @param {function(string)} eat
 * @param {string} $0 - Lines.
 */
function tokenizeNewline(eat, $0) {
    if ($0.length > 1) {
        this.currentBullet = null;
        this.previousBullet = null;
    }

    eat($0);
}

/**
 * Tokenise an indented code block.
 *
 * @example
 *   tokenizeCode(eat, '\tfoo');
 *
 * @param {function(string)} eat
 * @param {string} $0 - Whole code.
 * @return {Node} - `code` node.
 */
function tokenizeCode(eat, $0) {
    $0 = trimTrailingLines($0);

    return eat($0)(this.renderCodeBlock(removeIndentation($0, TAB_SIZE), null, eat));
}

/**
 * Tokenise a fenced code block.
 *
 * @example
 *   var $0 = '```js\nfoo()\n```';
 *   tokenizeFences(eat, $0, '', '```', '`', 'js', 'foo()\n');
 *
 * @param {function(string)} eat
 * @param {string} $0 - Whole code.
 * @param {string} $1 - Initial spacing.
 * @param {string} $2 - Initial fence.
 * @param {string} $3 - Fence marker.
 * @param {string} $4 - Programming language flag.
 * @param {string} $5 - Content.
 * @return {Node} - `code` node.
 */
function tokenizeFences(eat, $0, $1, $2, $3, $4, $5) {
    $0 = trimTrailingLines($0);

    /*
     * If the initial fence was preceded by spaces,
     * exdent that amount of white space from the code
     * block.  Because it's possible that the code block
     * is exdented, we first have to ensure at least
     * those spaces are available.
     */

    if ($1) {
        $5 = removeIndentation(ensureIndentation($5, $1.length), $1.length);
    }

    return eat($0)(this.renderCodeBlock($5, $4, eat));
}

/**
 * Tokenise an ATX-style heading.
 *
 * @example
 *   tokenizeHeading(eat, ' # foo', ' ', '#', ' ', 'foo');
 *
 * @param {function(string)} eat
 * @param {string} $0 - Whole heading.
 * @param {string} $1 - Initial spacing.
 * @param {string} $2 - Hashes.
 * @param {string} $3 - Internal spacing.
 * @param {string} $4 - Content.
 * @return {Node} - `heading` node.
 */
function tokenizeHeading(eat, $0, $1, $2, $3, $4) {
    var now = eat.now();

    now.column += ($1 + $2 + ($3 || '')).length;

    return eat($0)(this.renderHeading($4, $2.length, now));
}

/**
 * Tokenise a Setext-style heading.
 *
 * @example
 *   tokenizeLineHeading(eat, 'foo\n===', '', 'foo', '=');
 *
 * @param {function(string)} eat
 * @param {string} $0 - Whole heading.
 * @param {string} $1 - Initial spacing.
 * @param {string} $2 - Content.
 * @param {string} $3 - Underline marker.
 * @return {Node} - `heading` node.
 */
function tokenizeLineHeading(eat, $0, $1, $2, $3) {
    var now = eat.now();

    now.column += $1.length;

    return eat($0)(this.renderHeading($2, $3 === EQUALS ? 1 : 2, now));
}

/**
 * Tokenise a horizontal rule.
 *
 * @example
 *   tokenizeHorizontalRule(eat, '***');
 *
 * @param {function(string)} eat
 * @param {string} $0 - Whole rule.
 * @return {Node} - `horizontalRule` node.
 */
function tokenizeHorizontalRule(eat, $0) {
    return eat($0)(this.renderVoid(HORIZONTAL_RULE));
}

/**
 * Tokenise a blockquote.
 *
 * @example
 *   tokenizeBlockquote(eat, '> Foo');
 *
 * @param {function(string)} eat
 * @param {string} $0 - Whole blockquote.
 * @return {Node} - `blockquote` node.
 */
function tokenizeBlockquote(eat, $0) {
    var now = eat.now();
    var indent = this.indent(now.line);
    var value = trimTrailingLines($0);
    var add = eat(value);

    value = value.replace(EXPRESSION_BLOCK_QUOTE, function (prefix) {
        indent(prefix.length);

        return '';
    });

    return add(this.renderBlockquote(value, now));
}

/**
 * Tokenise a list.
 *
 * @example
 *   tokenizeList(eat, '- Foo', '', '-');
 *
 * @param {function(string)} eat
 * @param {string} $0 - Whole list.
 * @param {string} $1 - Indent.
 * @param {string} $2 - Bullet.
 * @return {Node} - `list` node.
 */
function tokenizeList(eat, $0, $1, $2) {
    var self = this;
    var firstBullet = $2;
    var value = trimTrailingLines($0);
    var matches = value.match(self.rules.item);
    var length = matches.length;
    var index = 0;
    var isLoose = false;
    var now;
    var bullet;
    var item;
    var enterTop;
    var exitBlockquote;
    var node;
    var indent;
    var size;
    var position;
    var end;

    /*
     * Determine if all list-items belong to the
     * same list.
     */

    if (!self.options.pedantic) {
        while (++index < length) {
            bullet = self.rules.bullet.exec(matches[index])[0];

            if (firstBullet !== bullet && (firstBullet.length === 1 && bullet.length === 1 || bullet.charAt(bullet.length - 1) !== firstBullet.charAt(firstBullet.length - 1))) {
                matches = matches.slice(0, index);
                matches[index - 1] = trimTrailingLines(matches[index - 1]);

                length = matches.length;

                break;
            }
        }
    }

    if (self.options.commonmark) {
        index = -1;

        while (++index < length) {
            item = matches[index];
            indent = self.rules.indent.exec(item);
            indent = indent[1] + repeat(SPACE, indent[2].length) + indent[3];
            size = getIndent(indent).indent;
            position = indent.length;
            end = item.length;

            while (++position < end) {
                if (item.charAt(position) === NEW_LINE && item.charAt(position - 1) === NEW_LINE && getIndent(item.slice(position + 1)).indent < size) {
                    matches[index] = item.slice(0, position - 1);

                    matches = matches.slice(0, index + 1);
                    length = matches.length;

                    break;
                }
            }
        }
    }

    self.previousBullet = self.currentBullet;
    self.currentBullet = firstBullet;

    index = -1;

    node = eat(matches.join(NEW_LINE)).reset(self.renderList([], firstBullet));

    enterTop = self.exitTop();
    exitBlockquote = self.enterBlockquote();

    while (++index < length) {
        item = matches[index];
        now = eat.now();

        item = eat(item)(self.renderListItem(item, now), node);

        if (item.loose) {
            isLoose = true;
        }

        if (index !== length - 1) {
            eat(NEW_LINE);
        }
    }

    node.loose = isLoose;

    enterTop();
    exitBlockquote();

    return node;
}

/**
 * Tokenise HTML.
 *
 * @example
 *   tokenizeHtml(eat, '<span>foo</span>');
 *
 * @param {function(string)} eat
 * @param {string} $0 - Whole HTML.
 * @return {Node} - `html` node.
 */
function tokenizeHtml(eat, $0) {
    $0 = trimTrailingLines($0);

    return eat($0)(this.renderRaw(HTML, $0));
}

/**
 * Tokenise a definition.
 *
 * @example
 *   var $0 = '[foo]: http://example.com "Example Domain"';
 *   var $1 = 'foo';
 *   var $2 = 'http://example.com';
 *   var $3 = 'Example Domain';
 *   tokenizeDefinition(eat, $0, $1, $2, $3);
 *
 * @property {boolean} onlyAtTop
 * @property {boolean} notInBlockquote
 * @param {function(string)} eat
 * @param {string} $0 - Whole definition.
 * @param {string} $1 - Key.
 * @param {string} $2 - URL.
 * @param {string} $3 - Title.
 * @return {Node} - `definition` node.
 */
function tokenizeDefinition(eat, $0, $1, $2, $3) {
    var link = $2;

    /*
     * Remove angle-brackets from `link`.
     */

    if (link.charAt(0) === LT && link.charAt(link.length - 1) === GT) {
        link = link.slice(1, -1);
    }

    return eat($0)({
        'type': 'definition',
        'identifier': normalize($1),
        'title': $3 ? decode(this.descape($3), eat) : null,
        'link': decode(this.descape(link), eat)
    });
}

tokenizeDefinition.onlyAtTop = true;
tokenizeDefinition.notInBlockquote = true;

/**
 * Tokenise YAML front matter.
 *
 * @example
 *   var $0 = '---\nfoo: bar\n---';
 *   var $1 = 'foo: bar';
 *   tokenizeYAMLFrontMatter(eat, $0, $1);
 *
 * @property {boolean} onlyAtStart
 * @param {function(string)} eat
 * @param {string} $0 - Whole front matter.
 * @param {string} $1 - Content.
 * @return {Node} - `yaml` node.
 */
function tokenizeYAMLFrontMatter(eat, $0, $1) {
    return eat($0)(this.renderRaw(YAML, $1 ? trimTrailingLines($1) : EMPTY));
}

tokenizeYAMLFrontMatter.onlyAtStart = true;

/**
 * Tokenise a footnote definition.
 *
 * @example
 *   var $0 = '[foo]: Bar.';
 *   var $1 = '[foo]';
 *   var $2 = 'foo';
 *   var $3 = 'Bar.';
 *   tokenizeFootnoteDefinition(eat, $0, $1, $2, $3);
 *
 * @property {boolean} onlyAtTop
 * @property {boolean} notInBlockquote
 * @param {function(string)} eat
 * @param {string} $0 - Whole definition.
 * @param {string} $1 - Whole key.
 * @param {string} $2 - Key.
 * @param {string} $3 - Whole value.
 * @return {Node} - `footnoteDefinition` node.
 */
function tokenizeFootnoteDefinition(eat, $0, $1, $2, $3) {
    var self = this;
    var now = eat.now();
    var indent = self.indent(now.line);

    $3 = $3.replace(EXPRESSION_INITIAL_TAB, function (value) {
        indent(value.length);

        return EMPTY;
    });

    now.column += $1.length;

    return eat($0)(self.renderFootnoteDefinition(normalize($2), $3, now));
}

tokenizeFootnoteDefinition.onlyAtTop = true;
tokenizeFootnoteDefinition.notInBlockquote = true;

/**
 * Tokenise a table.
 *
 * @example
 *   var $0 = ' | foo |\n | --- |\n | bar |';
 *   var $1 = ' | foo |';
 *   var $2 = '| foo |';
 *   var $3 = ' | --- |';
 *   var $4 = '| --- |';
 *   var $5 = ' | bar |';
 *   tokenizeTable(eat, $0, $1, $2, $3, $4, $5);
 *
 * @property {boolean} onlyAtTop
 * @param {function(string)} eat
 * @param {string} $0 - Whole table.
 * @param {string} $1 - Whole heading.
 * @param {string} $2 - Trimmed heading.
 * @param {string} $3 - Whole alignment.
 * @param {string} $4 - Trimmed alignment.
 * @param {string} $5 - Rows.
 * @return {Node} - `table` node.
 */
function tokenizeTable(eat, $0, $1, $2, $3, $4, $5) {
    var self = this;
    var node;
    var index;
    var length;

    $0 = trimTrailingLines($0);

    node = eat($0).reset({
        'type': TABLE,
        'align': [],
        'children': []
    });

    /**
     * Eat a fence.  Returns an empty string so it can be
     * passed to `String#replace()`.
     *
     * @param {string} value - Fence.
     * @return {string} - Empty string.
     */
    function eatFence(value) {
        eat(value);

        return EMPTY;
    }

    /**
     * Factory to eat a cell to a bound `row`.
     *
     * @param {Object} row - Parent to add cells to.
     * @return {Function} - `eatCell` bound to `row`.
     */
    function eatCellFactory(row) {
        /**
         * Eat a cell.  Returns an empty string so it can be
         * passed to `String#replace()`.
         *
         * @param {string} value - Complete match.
         * @param {string} content - Cell content.
         * @param {string} pipe - Fence.
         * @return {string} - Empty string.
         */
        function eatCell(value, content, pipe) {
            var cell = trim.left(content);
            var diff = content.length - cell.length;
            var now;

            eat(content.slice(0, diff));

            now = eat.now();

            eat(cell)(self.renderInline(TABLE_CELL, trim.right(cell), now), row);

            eat(pipe);

            return EMPTY;
        }

        return eatCell;
    }

    /**
     * Eat a row of type `type`.
     *
     * @param {string} type - Type of the returned node,
     *   such as `tableHeader` or `tableRow`.
     * @param {string} value - Row, including initial and
     *   final fences.
     */
    function renderRow(type, value) {
        var row = eat(value).reset(self.renderParent(type, []), node);

        value.replace(EXPRESSION_TABLE_INITIAL, eatFence).replace(EXPRESSION_TABLE_CONTENT, eatCellFactory(row));
    }

    /*
     * Add the table's header.
     */

    renderRow(TABLE_HEADER, $1);

    eat(NEW_LINE);

    /*
     * Add the table's alignment.
     */

    eat($3);

    $4 = $4.replace(EXPRESSION_TABLE_FENCE, EMPTY).split(EXPRESSION_TABLE_BORDER);

    node.align = getAlignment($4);

    /*
     * Add the table rows to table's children.
     */

    $5 = trimTrailingLines($5).split(NEW_LINE);

    index = -1;
    length = $5.length;

    while (++index < length) {
        renderRow(TABLE_ROW, $5[index]);

        if (index !== length - 1) {
            eat(NEW_LINE);
        }
    }

    return node;
}

tokenizeTable.onlyAtTop = true;

/**
 * Tokenise a paragraph node.
 *
 * @example
 *   tokenizeParagraph(eat, 'Foo.');
 *
 * @param {function(string)} eat
 * @param {string} $0 - Whole paragraph.
 * @return {Node?} - `paragraph` node, when the node does
 *   not just contain white space.
 */
function tokenizeParagraph(eat, $0) {
    var now = eat.now();

    if (trim($0) === EMPTY) {
        eat($0);

        return null;
    }

    $0 = trimTrailingLines($0);

    return eat($0)(this.renderInline(PARAGRAPH, $0, now));
}

/**
 * Tokenise a text node.
 *
 * @example
 *   tokenizeText(eat, 'foo');
 *
 * @param {function(string)} eat
 * @param {string} $0 - Whole text.
 * @return {Node} - `text` node.
 */
function tokenizeText(eat, $0) {
    return eat($0)(this.renderRaw(TEXT, $0));
}

/**
 * Create a code-block node.
 *
 * @example
 *   renderCodeBlock('foo()', 'js', now());
 *
 * @param {string?} [value] - Code.
 * @param {string?} [language] - Optional language flag.
 * @param {Function} eat
 * @return {Object} - `code` node.
 */
function renderCodeBlock(value, language, eat) {
    return {
        'type': CODE,
        'lang': language ? decode(this.descape(language), eat) : null,
        'value': trimTrailingLines(value || EMPTY)
    };
}

/**
 * Create a list node.
 *
 * @example
 *   var children = [renderListItem('- foo')];
 *   renderList(children, '-');
 *
 * @param {string} children - Children.
 * @param {string} bullet - First bullet.
 * @return {Object} - `list` node.
 */
function renderList(children, bullet) {
    var start = parseInt(bullet, 10);

    if (start !== start) {
        start = null;
    }

    /*
     * `loose` should be added later.
     */

    return {
        'type': LIST,
        'ordered': bullet.length > 1,
        'start': start,
        'loose': null,
        'children': children
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
     * @param {string} $0
     * @return {string}
     */
    function replacer($0) {
        indent($0.length);

        return EMPTY;
    }

    /*
     * Remove the list-item's bullet.
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
    var bullet;
    var rest;
    var lines;
    var trimmedLines;
    var index;
    var length;
    var max;

    /*
     * Remove the list-item's bullet.
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
            $2 = SPACE + $2;
        }

        max = $1 + repeat(SPACE, $2.length) + $3;

        return max + rest;
    });

    lines = value.split(NEW_LINE);

    trimmedLines = removeIndentation(value, getIndent(max).indent).split(NEW_LINE);

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

    return trimmedLines.join(NEW_LINE);
}

/*
 * A map of two functions which can create list items.
 */

var LIST_ITEM_MAP = {};

LIST_ITEM_MAP['true'] = renderPedanticListItem;
LIST_ITEM_MAP['false'] = renderNormalListItem;

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
            checked = task[1].toLowerCase() === 'x';

            self.indent(position.line)(indent);
            value = value.slice(indent);
        }
    }

    node = {
        'type': LIST_ITEM,
        'loose': EXPRESSION_LOOSE_LIST_ITEM.test(value) || value.charAt(value.length - 1) === NEW_LINE
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
        'type': FOOTNOTE_DEFINITION,
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
        'type': HEADING,
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
        'type': BLOCKQUOTE,
        'children': this.tokenizeBlock(value, now)
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
 * @param {function(string)} eat
 * @return {Object} - `link` or `image` node.
 */
function renderLink(isLink, href, text, title, position, eat) {
    var self = this;
    var exitLink = self.enterLink();
    var node;

    node = {
        'type': isLink ? LINK : IMAGE,
        'title': title ? decode(self.descape(title), eat) : null
    };

    href = decode(href, eat);

    if (isLink) {
        node.href = href;
        node.children = self.tokenizeInline(text, position);
    } else {
        node.src = href;
        node.alt = text ? decode(self.descape(text), eat) : null;
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
    return this.renderInline(FOOTNOTE, value, position);
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
 * Tokenise an escape sequence.
 *
 * @example
 *   tokenizeEscape(eat, '\\a', 'a');
 *
 * @param {function(string)} eat
 * @param {string} $0 - Whole escape.
 * @param {string} $1 - Escaped character.
 * @return {Node} - `escape` node.
 */
function tokenizeEscape(eat, $0, $1) {
    return eat($0)(this.renderRaw(ESCAPE, $1));
}

/**
 * Tokenise a URL in carets.
 *
 * @example
 *   tokenizeAutoLink(eat, '<http://foo.bar>', 'http://foo.bar', '');
 *
 * @property {boolean} notInLink
 * @param {function(string)} eat
 * @param {string} $0 - Whole link.
 * @param {string} $1 - URL.
 * @param {string?} [$2] - Protocol or at.
 * @return {Node} - `link` node.
 */
function tokenizeAutoLink(eat, $0, $1, $2) {
    var self = this;
    var href = $1;
    var text = $1;
    var now = eat.now();
    var offset = 1;
    var tokenize;
    var node;

    if ($2 === AT_SIGN) {
        if (text.substr(0, MAILTO_PROTOCOL.length).toLowerCase() !== MAILTO_PROTOCOL) {
            href = MAILTO_PROTOCOL + text;
        } else {
            text = text.substr(MAILTO_PROTOCOL.length);
            offset += MAILTO_PROTOCOL.length;
        }
    }

    now.column += offset;

    /*
     * Temporarily remove support for escapes in autolinks.
     */

    tokenize = self.inlineTokenizers.escape;
    self.inlineTokenizers.escape = null;

    node = eat($0)(self.renderLink(true, href, text, null, now, eat));

    self.inlineTokenizers.escape = tokenize;

    return node;
}

tokenizeAutoLink.notInLink = true;

/**
 * Tokenise a URL in text.
 *
 * @example
 *   tokenizeURL(eat, 'http://foo.bar');
 *
 * @property {boolean} notInLink
 * @param {function(string)} eat
 * @param {string} $0 - Whole link.
 * @return {Node} - `link` node.
 */
function tokenizeURL(eat, $0) {
    var now = eat.now();

    return eat($0)(this.renderLink(true, $0, $0, null, now, eat));
}

tokenizeURL.notInLink = true;

/**
 * Tokenise an HTML tag.
 *
 * @example
 *   tokenizeTag(eat, '<span foo="bar">');
 *
 * @param {function(string)} eat
 * @param {string} $0 - Content.
 * @return {Node} - `html` node.
 */
function tokenizeTag(eat, $0) {
    var self = this;

    if (!self.inLink && EXPRESSION_HTML_LINK_OPEN.test($0)) {
        self.inLink = true;
    } else if (self.inLink && EXPRESSION_HTML_LINK_CLOSE.test($0)) {
        self.inLink = false;
    }

    return eat($0)(self.renderRaw(HTML, $0));
}

/**
 * Tokenise a link.
 *
 * @example
 *   tokenizeLink(
 *     eat, '![foo](fav.ico "Favicon")', '![', 'foo', null,
 *     'fav.ico', 'Foo Domain'
 *   );
 *
 * @param {function(string)} eat
 * @param {string} $0 - Whole link.
 * @param {string} $1 - Prefix.
 * @param {string} $2 - Text.
 * @param {string?} $3 - URL wrapped in angle braces.
 * @param {string?} $4 - Literal URL.
 * @param {string?} $5 - Title wrapped in single or double
 *   quotes.
 * @param {string?} [$6] - Title wrapped in double quotes.
 * @param {string?} [$7] - Title wrapped in parentheses.
 * @return {Node?} - `link` node, `image` node, or `null`.
 */
function tokenizeLink(eat, $0, $1, $2, $3, $4, $5, $6, $7) {
    var isLink = $1 === BRACKET_OPEN;
    var href = $4 || $3 || '';
    var title = $7 || $6 || $5;
    var now;

    if (!isLink || !this.inLink) {
        now = eat.now();

        now.column += $1.length;

        return eat($0)(this.renderLink(isLink, this.descape(href), $2, title, now, eat));
    }

    return null;
}

/**
 * Tokenise a reference link, image, or footnote;
 * shortcut reference link, or footnote.
 *
 * @example
 *   tokenizeReference(eat, '[foo]', '[', 'foo');
 *   tokenizeReference(eat, '[foo][]', '[', 'foo', '');
 *   tokenizeReference(eat, '[foo][bar]', '[', 'foo', 'bar');
 *
 * @param {function(string)} eat
 * @param {string} $0 - Whole link.
 * @param {string} $1 - Prefix.
 * @param {string} $2 - identifier.
 * @param {string} $3 - Content.
 * @return {Node?} - `linkReference`, `imageReference`, or
 *   `footnoteReference`.  Returns null when this is a link
 *   reference, but we're already in a link.
 */
function tokenizeReference(eat, $0, $1, $2, $3) {
    var self = this;
    var text = $2;
    var identifier = $3 || $2;
    var type = $1 === BRACKET_OPEN ? 'link' : 'image';
    var isFootnote = self.options.footnotes && identifier.charAt(0) === CARET;
    var now = eat.now();
    var referenceType;
    var node;
    var exitLink;

    if ($3 === undefined) {
        referenceType = 'shortcut';
    } else if ($3 === '') {
        referenceType = 'collapsed';
    } else {
        referenceType = 'full';
    }

    if (referenceType !== 'shortcut') {
        isFootnote = false;
    }

    if (isFootnote) {
        identifier = identifier.substr(1);
    }

    if (isFootnote) {
        if (identifier.indexOf(SPACE) !== -1) {
            return eat($0)(self.renderFootnote(identifier, eat.now()));
        } else {
            type = 'footnote';
        }
    }

    if (self.inLink && type === 'link') {
        return null;
    }

    now.column += $1.length;

    node = {
        'type': type + 'Reference',
        'identifier': normalize(identifier)
    };

    if (type === 'link' || type === 'image') {
        node.referenceType = referenceType;
    }

    if (type === 'link') {
        exitLink = self.enterLink();
        node.children = self.tokenizeInline(text, now);
        exitLink();
    } else if (type === 'image') {
        node.alt = decode(self.descape(text), eat);
    }

    return eat($0)(node);
}

/**
 * Tokenise strong emphasis.
 *
 * @example
 *   tokenizeStrong(eat, '**foo**', '**', 'foo');
 *   tokenizeStrong(eat, '__foo__', null, null, '__', 'foo');
 *
 * @param {function(string)} eat
 * @param {string} $0 - Whole emphasis.
 * @param {string?} $1 - Marker.
 * @param {string?} $2 - Content.
 * @param {string?} [$3] - Marker.
 * @param {string?} [$4] - Content.
 * @return {Node?} - `strong` node, when not empty.
 */
function tokenizeStrong(eat, $0, $1, $2, $3, $4) {
    var now = eat.now();
    var value = $2 || $4;

    if (trim(value) === EMPTY) {
        return null;
    }

    now.column += 2;

    return eat($0)(this.renderInline(STRONG, value, now));
}

/**
 * Tokenise slight emphasis.
 *
 * @example
 *   tokenizeEmphasis(eat, '*foo*', '*', 'foo');
 *   tokenizeEmphasis(eat, '_foo_', null, null, '_', 'foo');
 *
 * @param {function(string)} eat
 * @param {string} $0 - Whole emphasis.
 * @param {string?} $1 - Marker.
 * @param {string?} $2 - Content.
 * @param {string?} [$3] - Marker.
 * @param {string?} [$4] - Content.
 * @return {Node?} - `emphasis` node, when not empty.
 */
function tokenizeEmphasis(eat, $0, $1, $2, $3, $4) {
    var now = eat.now();
    var marker = $1 || $3;
    var value = $2 || $4;

    if (trim(value) === EMPTY || value.charAt(0) === marker || value.charAt(value.length - 1) === marker) {
        return null;
    }

    now.column += 1;

    return eat($0)(this.renderInline(EMPHASIS, value, now));
}

/**
 * Tokenise a deletion.
 *
 * @example
 *   tokenizeDeletion(eat, '~~foo~~', '~~', 'foo');
 *
 * @param {function(string)} eat
 * @param {string} $0 - Whole deletion.
 * @param {string} $1 - Content.
 * @return {Node} - `delete` node.
 */
function tokenizeDeletion(eat, $0, $1) {
    var now = eat.now();

    now.column += 2;

    return eat($0)(this.renderInline(DELETE, $1, now));
}

/**
 * Tokenise inline code.
 *
 * @example
 *   tokenizeInlineCode(eat, '`foo()`', '`', 'foo()');
 *
 * @param {function(string)} eat
 * @param {string} $0 - Whole code.
 * @param {string} $1 - Initial markers.
 * @param {string} $2 - Content.
 * @return {Node} - `inlineCode` node.
 */
function tokenizeInlineCode(eat, $0, $1, $2) {
    return eat($0)(this.renderRaw(INLINE_CODE, trim($2 || '')));
}

/**
 * Tokenise a break.
 *
 * @example
 *   tokenizeBreak(eat, '  \n');
 *
 * @param {function(string)} eat
 * @param {string} $0
 * @return {Node} - `break` node.
 */
function tokenizeBreak(eat, $0) {
    return eat($0)(this.renderVoid(BREAK));
}

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
function Parser(file, options) {
    var self = this;
    var rules = extend({}, self.expressions.rules);

    self.file = file;
    self.inLink = false;
    self.atTop = true;
    self.atStart = true;
    self.inBlockquote = false;

    self.rules = rules;
    self.descape = descapeFactory(rules, 'escape');

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
    var expressions = self.expressions;
    var rules = self.rules;
    var current = self.options;
    var key;

    if (options === null || options === undefined) {
        options = {};
    } else if (typeof options === 'object') {
        options = extend({}, options);
    } else {
        raise(options, 'options');
    }

    self.options = options;

    for (key in defaultOptions) {
        validate.boolean(options, key, current[key]);

        if (options[key]) {
            extend(rules, expressions[key]);
        }
    }

    if (options.gfm && options.breaks) {
        extend(rules, expressions.breaksGFM);
    }

    if (options.gfm && options.commonmark) {
        extend(rules, expressions.commonmarkGFM);
    }

    if (options.commonmark) {
        self.enterBlockquote = noopToggler();
    }

    return self;
};

/*
 * Expose `defaults`.
 */

Parser.prototype.options = defaultOptions;

/*
 * Expose `expressions`.
 */

Parser.prototype.expressions = defaultExpressions;

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
     *   indenter(2)
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

    node = self.renderBlock(ROOT, value);

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
Parser.prototype.renderList = renderList;
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
 * @return {function(string, Object?): Array.<Object>}
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
        var rules = self.rules;
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
        var match;
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
         * @param {string} subvalue
         */
        function updatePosition(subvalue) {
            var character = -1;
            var subvalueLength = subvalue.length;
            var lastIndex = -1;

            while (++character < subvalueLength) {
                if (subvalue.charAt(character) === NEW_LINE) {
                    lastIndex = character;
                    line++;
                }
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
         * Get offset. Called before the fisrt character is
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
             * eaten to retrieve the range's offsets.
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
         * @return {Object}
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
         * @param {Object} start
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
                self.file.fail('Incorrectly eaten value: please report this ' + 'warning on http://git.io/vUYWz', now());
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
            function update(node, indent) {
                var prev = node.position;
                var start = prev ? prev.start : before;
                var combined = [];
                var n = prev && prev.end.line;
                var l = before.line;

                node.position = new Position(start);

                /*
                 * If there was already a `position`, this
                 * node was merged.  Fixing `start` wasn't
                 * hard, but the indent is different.
                 * Especially because some information, the
                 * indent between `n` and `l` wasn't
                 * tracked.  Luckily, that space is
                 * (should be?) empty, so we can safely
                 * check for it now.
                 */

                if (prev) {
                    combined = prev.indent;

                    if (n < l) {
                        while (++n < l) {
                            combined.push((offset[n] || 0) + 1);
                        }

                        combined.push(before.column);
                    }

                    indent = combined.concat(indent);
                }

                node.position.indent = indent;

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
            var isMultiple = ('length' in node);
            var prev;
            var children;

            if (!parent) {
                children = tokens;
            } else {
                children = parent.children;
            }

            if (isMultiple) {
                arrayPush.apply(children, node);
            } else {
                if (type === INLINE && node.type === TEXT) {
                    node.value = decode(node.value, eater);
                }

                prev = children[children.length - 1];

                if (prev && node.type === prev.type && node.type in MERGEABLE_NODES) {
                    node = MERGEABLE_NODES[node.type].call(self, prev, node);
                }

                if (node !== prev) {
                    children.push(node);
                }

                if (self.atStart && tokens.length) {
                    self.exitStart();
                }
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
             * @return {Node}
             */
            function apply() {
                return pos(add.apply(null, arguments), indent);
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
             * @return {Node}
             */
            function reset() {
                var node = apply.apply(null, arguments);

                line = current.line;
                column = current.column;
                value = subvalue + value;

                return node;
            }

            apply.reset = reset;

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
             * @return {Node}
             */
            function apply() {
                return add.apply(null, arguments);
            }

            /**
             * Functions just like apply, but resets the
             * content: the eaten value is re-added.
             *
             * @return {Node}
             */
            function reset() {
                var node = apply.apply(null, arguments);

                value = subvalue + value;

                return node;
            }

            apply.reset = reset;

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
         * block-expressions.  When one matches, invoke
         * its companion function.  If no expression
         * matches, something failed (should not happen)
         * and an exception is thrown.
         */

        while (value) {
            index = -1;
            length = methods.length;
            matched = false;

            while (++index < length) {
                name = methods[index];
                method = tokenizers[name];

                if (method && rules[name] && (!method.onlyAtStart || self.atStart) && (!method.onlyAtTop || self.atTop) && (!method.notInBlockquote || !self.inBlockquote) && (!method.notInLink || !self.inLink)) {
                    match = rules[name].exec(value);

                    if (match) {
                        valueLength = value.length;

                        method.apply(self, [eater].concat(match));

                        matched = valueLength !== value.length;

                        if (matched) {
                            break;
                        }
                    }
                }
            }

            /* istanbul ignore if */
            if (!matched) {
                self.file.fail('Infinite loop', eater.now());

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
    'html': tokenizeHtml,
    'definition': tokenizeDefinition,
    'footnoteDefinition': tokenizeFootnoteDefinition,
    'looseTable': tokenizeTable,
    'table': tokenizeTable,
    'paragraph': tokenizeParagraph
};

/*
 * Expose order in which to parse block-level nodes.
 */

Parser.prototype.blockMethods = ['yamlFrontMatter', 'newline', 'code', 'fences', 'blockquote', 'heading', 'horizontalRule', 'list', 'lineHeading', 'html', 'definition', 'footnoteDefinition', 'looseTable', 'table', 'paragraph', 'blockText'];

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
    'shortcutReference': tokenizeReference,
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

Parser.prototype.inlineMethods = ['escape', 'autoLink', 'url', 'tag', 'link', 'reference', 'shortcutReference', 'strong', 'emphasis', 'deletion', 'inlineCode', 'break', 'inlineText'];

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
}, {"he":21,"repeat-string":22,"trim":23,"trim-trailing-lines":24,"extend.js":25,"./utilities.js":26,"./expressions.js":27,"./defaults.js":28}],
21: [function(require, module, exports) {
/*! http://mths.be/he v0.5.0 by @mathias | MIT license */
'use strict';

;(function (root) {

	// Detect free variables `exports`.
	var freeExports = typeof exports == 'object' && exports;

	// Detect free variable `module`.
	var freeModule = typeof module == 'object' && module && module.exports == freeExports && module;

	// Detect free variable `global`, from Node.js or Browserified code,
	// and use it as `root`.
	var freeGlobal = typeof global == 'object' && global;
	if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal) {
		root = freeGlobal;
	}

	/*--------------------------------------------------------------------------*/

	// All astral symbols.
	var regexAstralSymbols = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
	// All ASCII symbols (not just printable ASCII) except those listed in the
	// first column of the overrides table.
	// http://whatwg.org/html/tokenization.html#table-charref-overrides
	var regexAsciiWhitelist = /[\x01-\x7F]/g;
	// All BMP symbols that are not ASCII newlines, printable ASCII symbols, or
	// code points listed in the first column of the overrides table on
	// http://whatwg.org/html/tokenization.html#table-charref-overrides.
	var regexBmpWhitelist = /[\x01-\t\x0B\f\x0E-\x1F\x7F\x81\x8D\x8F\x90\x9D\xA0-\uFFFF]/g;

	var regexEncodeNonAscii = /<\u20D2|=\u20E5|>\u20D2|\u205F\u200A|\u219D\u0338|\u2202\u0338|\u2220\u20D2|\u2229\uFE00|\u222A\uFE00|\u223C\u20D2|\u223D\u0331|\u223E\u0333|\u2242\u0338|\u224B\u0338|\u224D\u20D2|\u224E\u0338|\u224F\u0338|\u2250\u0338|\u2261\u20E5|\u2264\u20D2|\u2265\u20D2|\u2266\u0338|\u2267\u0338|\u2268\uFE00|\u2269\uFE00|\u226A\u0338|\u226A\u20D2|\u226B\u0338|\u226B\u20D2|\u227F\u0338|\u2282\u20D2|\u2283\u20D2|\u228A\uFE00|\u228B\uFE00|\u228F\u0338|\u2290\u0338|\u2293\uFE00|\u2294\uFE00|\u22B4\u20D2|\u22B5\u20D2|\u22D8\u0338|\u22D9\u0338|\u22DA\uFE00|\u22DB\uFE00|\u22F5\u0338|\u22F9\u0338|\u2933\u0338|\u29CF\u0338|\u29D0\u0338|\u2A6D\u0338|\u2A70\u0338|\u2A7D\u0338|\u2A7E\u0338|\u2AA1\u0338|\u2AA2\u0338|\u2AAC\uFE00|\u2AAD\uFE00|\u2AAF\u0338|\u2AB0\u0338|\u2AC5\u0338|\u2AC6\u0338|\u2ACB\uFE00|\u2ACC\uFE00|\u2AFD\u20E5|[\xA0-\u0113\u0116-\u0122\u0124-\u012B\u012E-\u014D\u0150-\u017E\u0192\u01B5\u01F5\u0237\u02C6\u02C7\u02D8-\u02DD\u0311\u0391-\u03A1\u03A3-\u03A9\u03B1-\u03C9\u03D1\u03D2\u03D5\u03D6\u03DC\u03DD\u03F0\u03F1\u03F5\u03F6\u0401-\u040C\u040E-\u044F\u0451-\u045C\u045E\u045F\u2002-\u2005\u2007-\u2010\u2013-\u2016\u2018-\u201A\u201C-\u201E\u2020-\u2022\u2025\u2026\u2030-\u2035\u2039\u203A\u203E\u2041\u2043\u2044\u204F\u2057\u205F-\u2063\u20AC\u20DB\u20DC\u2102\u2105\u210A-\u2113\u2115-\u211E\u2122\u2124\u2127-\u2129\u212C\u212D\u212F-\u2131\u2133-\u2138\u2145-\u2148\u2153-\u215E\u2190-\u219B\u219D-\u21A7\u21A9-\u21AE\u21B0-\u21B3\u21B5-\u21B7\u21BA-\u21DB\u21DD\u21E4\u21E5\u21F5\u21FD-\u2205\u2207-\u2209\u220B\u220C\u220F-\u2214\u2216-\u2218\u221A\u221D-\u2238\u223A-\u2257\u2259\u225A\u225C\u225F-\u2262\u2264-\u228B\u228D-\u229B\u229D-\u22A5\u22A7-\u22B0\u22B2-\u22BB\u22BD-\u22DB\u22DE-\u22E3\u22E6-\u22F7\u22F9-\u22FE\u2305\u2306\u2308-\u2310\u2312\u2313\u2315\u2316\u231C-\u231F\u2322\u2323\u232D\u232E\u2336\u233D\u233F\u237C\u23B0\u23B1\u23B4-\u23B6\u23DC-\u23DF\u23E2\u23E7\u2423\u24C8\u2500\u2502\u250C\u2510\u2514\u2518\u251C\u2524\u252C\u2534\u253C\u2550-\u256C\u2580\u2584\u2588\u2591-\u2593\u25A1\u25AA\u25AB\u25AD\u25AE\u25B1\u25B3-\u25B5\u25B8\u25B9\u25BD-\u25BF\u25C2\u25C3\u25CA\u25CB\u25EC\u25EF\u25F8-\u25FC\u2605\u2606\u260E\u2640\u2642\u2660\u2663\u2665\u2666\u266A\u266D-\u266F\u2713\u2717\u2720\u2736\u2758\u2772\u2773\u27C8\u27C9\u27E6-\u27ED\u27F5-\u27FA\u27FC\u27FF\u2902-\u2905\u290C-\u2913\u2916\u2919-\u2920\u2923-\u292A\u2933\u2935-\u2939\u293C\u293D\u2945\u2948-\u294B\u294E-\u2976\u2978\u2979\u297B-\u297F\u2985\u2986\u298B-\u2996\u299A\u299C\u299D\u29A4-\u29B7\u29B9\u29BB\u29BC\u29BE-\u29C5\u29C9\u29CD-\u29D0\u29DC-\u29DE\u29E3-\u29E5\u29EB\u29F4\u29F6\u2A00-\u2A02\u2A04\u2A06\u2A0C\u2A0D\u2A10-\u2A17\u2A22-\u2A27\u2A29\u2A2A\u2A2D-\u2A31\u2A33-\u2A3C\u2A3F\u2A40\u2A42-\u2A4D\u2A50\u2A53-\u2A58\u2A5A-\u2A5D\u2A5F\u2A66\u2A6A\u2A6D-\u2A75\u2A77-\u2A9A\u2A9D-\u2AA2\u2AA4-\u2AB0\u2AB3-\u2AC8\u2ACB\u2ACC\u2ACF-\u2ADB\u2AE4\u2AE6-\u2AE9\u2AEB-\u2AF3\u2AFD\uFB00-\uFB04]|\uD835[\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDCCF\uDD04\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDD6B]/g;
	var encodeMap = { '\xC1': 'Aacute', '\xE1': 'aacute', 'Ă': 'Abreve', 'ă': 'abreve', '∾': 'ac', '∿': 'acd', '∾̳': 'acE', '\xC2': 'Acirc', '\xE2': 'acirc', '\xB4': 'acute', 'А': 'Acy', 'а': 'acy', '\xC6': 'AElig', '\xE6': 'aelig', '⁡': 'af', '𝔄': 'Afr', '𝔞': 'afr', '\xC0': 'Agrave', '\xE0': 'agrave', 'ℵ': 'aleph', 'Α': 'Alpha', 'α': 'alpha', 'Ā': 'Amacr', 'ā': 'amacr', '⨿': 'amalg', '&': 'amp', '⩕': 'andand', '⩓': 'And', '∧': 'and', '⩜': 'andd', '⩘': 'andslope', '⩚': 'andv', '∠': 'ang', '⦤': 'ange', '⦨': 'angmsdaa', '⦩': 'angmsdab', '⦪': 'angmsdac', '⦫': 'angmsdad', '⦬': 'angmsdae', '⦭': 'angmsdaf', '⦮': 'angmsdag', '⦯': 'angmsdah', '∡': 'angmsd', '∟': 'angrt', '⊾': 'angrtvb', '⦝': 'angrtvbd', '∢': 'angsph', '\xC5': 'angst', '⍼': 'angzarr', 'Ą': 'Aogon', 'ą': 'aogon', '𝔸': 'Aopf', '𝕒': 'aopf', '⩯': 'apacir', '≈': 'ap', '⩰': 'apE', '≊': 'ape', '≋': 'apid', '\'': 'apos', '\xE5': 'aring', '𝒜': 'Ascr', '𝒶': 'ascr', '≔': 'colone', '*': 'ast', '≍': 'CupCap', '\xC3': 'Atilde', '\xE3': 'atilde', '\xC4': 'Auml', '\xE4': 'auml', '∳': 'awconint', '⨑': 'awint', '≌': 'bcong', '϶': 'bepsi', '‵': 'bprime', '∽': 'bsim', '⋍': 'bsime', '∖': 'setmn', '⫧': 'Barv', '⊽': 'barvee', '⌅': 'barwed', '⌆': 'Barwed', '⎵': 'bbrk', '⎶': 'bbrktbrk', 'Б': 'Bcy', 'б': 'bcy', '„': 'bdquo', '∵': 'becaus', '⦰': 'bemptyv', 'ℬ': 'Bscr', 'Β': 'Beta', 'β': 'beta', 'ℶ': 'beth', '≬': 'twixt', '𝔅': 'Bfr', '𝔟': 'bfr', '⋂': 'xcap', '◯': 'xcirc', '⋃': 'xcup', '⨀': 'xodot', '⨁': 'xoplus', '⨂': 'xotime', '⨆': 'xsqcup', '★': 'starf', '▽': 'xdtri', '△': 'xutri', '⨄': 'xuplus', '⋁': 'Vee', '⋀': 'Wedge', '⤍': 'rbarr', '⧫': 'lozf', '▪': 'squf', '▴': 'utrif', '▾': 'dtrif', '◂': 'ltrif', '▸': 'rtrif', '␣': 'blank', '▒': 'blk12', '░': 'blk14', '▓': 'blk34', '█': 'block', '=⃥': 'bne', '≡⃥': 'bnequiv', '⫭': 'bNot', '⌐': 'bnot', '𝔹': 'Bopf', '𝕓': 'bopf', '⊥': 'bot', '⋈': 'bowtie', '⧉': 'boxbox', '┐': 'boxdl', '╕': 'boxdL', '╖': 'boxDl', '╗': 'boxDL', '┌': 'boxdr', '╒': 'boxdR', '╓': 'boxDr', '╔': 'boxDR', '─': 'boxh', '═': 'boxH', '┬': 'boxhd', '╤': 'boxHd', '╥': 'boxhD', '╦': 'boxHD', '┴': 'boxhu', '╧': 'boxHu', '╨': 'boxhU', '╩': 'boxHU', '⊟': 'minusb', '⊞': 'plusb', '⊠': 'timesb', '┘': 'boxul', '╛': 'boxuL', '╜': 'boxUl', '╝': 'boxUL', '└': 'boxur', '╘': 'boxuR', '╙': 'boxUr', '╚': 'boxUR', '│': 'boxv', '║': 'boxV', '┼': 'boxvh', '╪': 'boxvH', '╫': 'boxVh', '╬': 'boxVH', '┤': 'boxvl', '╡': 'boxvL', '╢': 'boxVl', '╣': 'boxVL', '├': 'boxvr', '╞': 'boxvR', '╟': 'boxVr', '╠': 'boxVR', '˘': 'breve', '\xA6': 'brvbar', '𝒷': 'bscr', '⁏': 'bsemi', '⧅': 'bsolb', '\\': 'bsol', '⟈': 'bsolhsub', '•': 'bull', '≎': 'bump', '⪮': 'bumpE', '≏': 'bumpe', 'Ć': 'Cacute', 'ć': 'cacute', '⩄': 'capand', '⩉': 'capbrcup', '⩋': 'capcap', '∩': 'cap', '⋒': 'Cap', '⩇': 'capcup', '⩀': 'capdot', 'ⅅ': 'DD', '∩︀': 'caps', '⁁': 'caret', 'ˇ': 'caron', 'ℭ': 'Cfr', '⩍': 'ccaps', 'Č': 'Ccaron', 'č': 'ccaron', '\xC7': 'Ccedil', '\xE7': 'ccedil', 'Ĉ': 'Ccirc', 'ĉ': 'ccirc', '∰': 'Cconint', '⩌': 'ccups', '⩐': 'ccupssm', 'Ċ': 'Cdot', 'ċ': 'cdot', '\xB8': 'cedil', '⦲': 'cemptyv', '\xA2': 'cent', '\xB7': 'middot', '𝔠': 'cfr', 'Ч': 'CHcy', 'ч': 'chcy', '✓': 'check', 'Χ': 'Chi', 'χ': 'chi', 'ˆ': 'circ', '≗': 'cire', '↺': 'olarr', '↻': 'orarr', '⊛': 'oast', '⊚': 'ocir', '⊝': 'odash', '⊙': 'odot', '\xAE': 'reg', 'Ⓢ': 'oS', '⊖': 'ominus', '⊕': 'oplus', '⊗': 'otimes', '○': 'cir', '⧃': 'cirE', '⨐': 'cirfnint', '⫯': 'cirmid', '⧂': 'cirscir', '∲': 'cwconint', '”': 'rdquo', '’': 'rsquo', '♣': 'clubs', ':': 'colon', '∷': 'Colon', '⩴': 'Colone', ',': 'comma', '@': 'commat', '∁': 'comp', '∘': 'compfn', 'ℂ': 'Copf', '≅': 'cong', '⩭': 'congdot', '≡': 'equiv', '∮': 'oint', '∯': 'Conint', '𝕔': 'copf', '∐': 'coprod', '\xA9': 'copy', '℗': 'copysr', '↵': 'crarr', '✗': 'cross', '⨯': 'Cross', '𝒞': 'Cscr', '𝒸': 'cscr', '⫏': 'csub', '⫑': 'csube', '⫐': 'csup', '⫒': 'csupe', '⋯': 'ctdot', '⤸': 'cudarrl', '⤵': 'cudarrr', '⋞': 'cuepr', '⋟': 'cuesc', '↶': 'cularr', '⤽': 'cularrp', '⩈': 'cupbrcap', '⩆': 'cupcap', '∪': 'cup', '⋓': 'Cup', '⩊': 'cupcup', '⊍': 'cupdot', '⩅': 'cupor', '∪︀': 'cups', '↷': 'curarr', '⤼': 'curarrm', '⋎': 'cuvee', '⋏': 'cuwed', '\xA4': 'curren', '∱': 'cwint', '⌭': 'cylcty', '†': 'dagger', '‡': 'Dagger', 'ℸ': 'daleth', '↓': 'darr', '↡': 'Darr', '⇓': 'dArr', '‐': 'dash', '⫤': 'Dashv', '⊣': 'dashv', '⤏': 'rBarr', '˝': 'dblac', 'Ď': 'Dcaron', 'ď': 'dcaron', 'Д': 'Dcy', 'д': 'dcy', '⇊': 'ddarr', 'ⅆ': 'dd', '⤑': 'DDotrahd', '⩷': 'eDDot', '\xB0': 'deg', '∇': 'Del', 'Δ': 'Delta', 'δ': 'delta', '⦱': 'demptyv', '⥿': 'dfisht', '𝔇': 'Dfr', '𝔡': 'dfr', '⥥': 'dHar', '⇃': 'dharl', '⇂': 'dharr', '˙': 'dot', '`': 'grave', '˜': 'tilde', '⋄': 'diam', '♦': 'diams', '\xA8': 'die', 'ϝ': 'gammad', '⋲': 'disin', '\xF7': 'div', '⋇': 'divonx', 'Ђ': 'DJcy', 'ђ': 'djcy', '⌞': 'dlcorn', '⌍': 'dlcrop', '$': 'dollar', '𝔻': 'Dopf', '𝕕': 'dopf', '⃜': 'DotDot', '≐': 'doteq', '≑': 'eDot', '∸': 'minusd', '∔': 'plusdo', '⊡': 'sdotb', '⇐': 'lArr', '⇔': 'iff', '⟸': 'xlArr', '⟺': 'xhArr', '⟹': 'xrArr', '⇒': 'rArr', '⊨': 'vDash', '⇑': 'uArr', '⇕': 'vArr', '∥': 'par', '⤓': 'DownArrowBar', '⇵': 'duarr', '̑': 'DownBreve', '⥐': 'DownLeftRightVector', '⥞': 'DownLeftTeeVector', '⥖': 'DownLeftVectorBar', '↽': 'lhard', '⥟': 'DownRightTeeVector', '⥗': 'DownRightVectorBar', '⇁': 'rhard', '↧': 'mapstodown', '⊤': 'top', '⤐': 'RBarr', '⌟': 'drcorn', '⌌': 'drcrop', '𝒟': 'Dscr', '𝒹': 'dscr', 'Ѕ': 'DScy', 'ѕ': 'dscy', '⧶': 'dsol', 'Đ': 'Dstrok', 'đ': 'dstrok', '⋱': 'dtdot', '▿': 'dtri', '⥯': 'duhar', '⦦': 'dwangle', 'Џ': 'DZcy', 'џ': 'dzcy', '⟿': 'dzigrarr', '\xC9': 'Eacute', '\xE9': 'eacute', '⩮': 'easter', 'Ě': 'Ecaron', 'ě': 'ecaron', '\xCA': 'Ecirc', '\xEA': 'ecirc', '≖': 'ecir', '≕': 'ecolon', 'Э': 'Ecy', 'э': 'ecy', 'Ė': 'Edot', 'ė': 'edot', 'ⅇ': 'ee', '≒': 'efDot', '𝔈': 'Efr', '𝔢': 'efr', '⪚': 'eg', '\xC8': 'Egrave', '\xE8': 'egrave', '⪖': 'egs', '⪘': 'egsdot', '⪙': 'el', '∈': 'in', '⏧': 'elinters', 'ℓ': 'ell', '⪕': 'els', '⪗': 'elsdot', 'Ē': 'Emacr', 'ē': 'emacr', '∅': 'empty', '◻': 'EmptySmallSquare', '▫': 'EmptyVerySmallSquare', ' ': 'emsp13', ' ': 'emsp14', ' ': 'emsp', 'Ŋ': 'ENG', 'ŋ': 'eng', ' ': 'ensp', 'Ę': 'Eogon', 'ę': 'eogon', '𝔼': 'Eopf', '𝕖': 'eopf', '⋕': 'epar', '⧣': 'eparsl', '⩱': 'eplus', 'ε': 'epsi', 'Ε': 'Epsilon', 'ϵ': 'epsiv', '≂': 'esim', '⩵': 'Equal', '=': 'equals', '≟': 'equest', '⇌': 'rlhar', '⩸': 'equivDD', '⧥': 'eqvparsl', '⥱': 'erarr', '≓': 'erDot', 'ℯ': 'escr', 'ℰ': 'Escr', '⩳': 'Esim', 'Η': 'Eta', 'η': 'eta', '\xD0': 'ETH', '\xF0': 'eth', '\xCB': 'Euml', '\xEB': 'euml', '€': 'euro', '!': 'excl', '∃': 'exist', 'Ф': 'Fcy', 'ф': 'fcy', '♀': 'female', 'ﬃ': 'ffilig', 'ﬀ': 'fflig', 'ﬄ': 'ffllig', '𝔉': 'Ffr', '𝔣': 'ffr', 'ﬁ': 'filig', '◼': 'FilledSmallSquare', 'fj': 'fjlig', '♭': 'flat', 'ﬂ': 'fllig', '▱': 'fltns', 'ƒ': 'fnof', '𝔽': 'Fopf', '𝕗': 'fopf', '∀': 'forall', '⋔': 'fork', '⫙': 'forkv', 'ℱ': 'Fscr', '⨍': 'fpartint', '\xBD': 'half', '⅓': 'frac13', '\xBC': 'frac14', '⅕': 'frac15', '⅙': 'frac16', '⅛': 'frac18', '⅔': 'frac23', '⅖': 'frac25', '\xBE': 'frac34', '⅗': 'frac35', '⅜': 'frac38', '⅘': 'frac45', '⅚': 'frac56', '⅝': 'frac58', '⅞': 'frac78', '⁄': 'frasl', '⌢': 'frown', '𝒻': 'fscr', 'ǵ': 'gacute', 'Γ': 'Gamma', 'γ': 'gamma', 'Ϝ': 'Gammad', '⪆': 'gap', 'Ğ': 'Gbreve', 'ğ': 'gbreve', 'Ģ': 'Gcedil', 'Ĝ': 'Gcirc', 'ĝ': 'gcirc', 'Г': 'Gcy', 'г': 'gcy', 'Ġ': 'Gdot', 'ġ': 'gdot', '≥': 'ge', '≧': 'gE', '⪌': 'gEl', '⋛': 'gel', '⩾': 'ges', '⪩': 'gescc', '⪀': 'gesdot', '⪂': 'gesdoto', '⪄': 'gesdotol', '⋛︀': 'gesl', '⪔': 'gesles', '𝔊': 'Gfr', '𝔤': 'gfr', '≫': 'gg', '⋙': 'Gg', 'ℷ': 'gimel', 'Ѓ': 'GJcy', 'ѓ': 'gjcy', '⪥': 'gla', '≷': 'gl', '⪒': 'glE', '⪤': 'glj', '⪊': 'gnap', '⪈': 'gne', '≩': 'gnE', '⋧': 'gnsim', '𝔾': 'Gopf', '𝕘': 'gopf', '⪢': 'GreaterGreater', '≳': 'gsim', '𝒢': 'Gscr', 'ℊ': 'gscr', '⪎': 'gsime', '⪐': 'gsiml', '⪧': 'gtcc', '⩺': 'gtcir', '>': 'gt', '⋗': 'gtdot', '⦕': 'gtlPar', '⩼': 'gtquest', '⥸': 'gtrarr', '≩︀': 'gvnE', ' ': 'hairsp', 'ℋ': 'Hscr', 'Ъ': 'HARDcy', 'ъ': 'hardcy', '⥈': 'harrcir', '↔': 'harr', '↭': 'harrw', '^': 'Hat', 'ℏ': 'hbar', 'Ĥ': 'Hcirc', 'ĥ': 'hcirc', '♥': 'hearts', '…': 'mldr', '⊹': 'hercon', '𝔥': 'hfr', 'ℌ': 'Hfr', '⤥': 'searhk', '⤦': 'swarhk', '⇿': 'hoarr', '∻': 'homtht', '↩': 'larrhk', '↪': 'rarrhk', '𝕙': 'hopf', 'ℍ': 'Hopf', '―': 'horbar', '𝒽': 'hscr', 'Ħ': 'Hstrok', 'ħ': 'hstrok', '⁃': 'hybull', '\xCD': 'Iacute', '\xED': 'iacute', '⁣': 'ic', '\xCE': 'Icirc', '\xEE': 'icirc', 'И': 'Icy', 'и': 'icy', 'İ': 'Idot', 'Е': 'IEcy', 'е': 'iecy', '\xA1': 'iexcl', '𝔦': 'ifr', 'ℑ': 'Im', '\xCC': 'Igrave', '\xEC': 'igrave', 'ⅈ': 'ii', '⨌': 'qint', '∭': 'tint', '⧜': 'iinfin', '℩': 'iiota', 'Ĳ': 'IJlig', 'ĳ': 'ijlig', 'Ī': 'Imacr', 'ī': 'imacr', 'ℐ': 'Iscr', 'ı': 'imath', '⊷': 'imof', 'Ƶ': 'imped', '℅': 'incare', '∞': 'infin', '⧝': 'infintie', '⊺': 'intcal', '∫': 'int', '∬': 'Int', 'ℤ': 'Zopf', '⨗': 'intlarhk', '⨼': 'iprod', '⁢': 'it', 'Ё': 'IOcy', 'ё': 'iocy', 'Į': 'Iogon', 'į': 'iogon', '𝕀': 'Iopf', '𝕚': 'iopf', 'Ι': 'Iota', 'ι': 'iota', '\xBF': 'iquest', '𝒾': 'iscr', '⋵': 'isindot', '⋹': 'isinE', '⋴': 'isins', '⋳': 'isinsv', 'Ĩ': 'Itilde', 'ĩ': 'itilde', 'І': 'Iukcy', 'і': 'iukcy', '\xCF': 'Iuml', '\xEF': 'iuml', 'Ĵ': 'Jcirc', 'ĵ': 'jcirc', 'Й': 'Jcy', 'й': 'jcy', '𝔍': 'Jfr', '𝔧': 'jfr', 'ȷ': 'jmath', '𝕁': 'Jopf', '𝕛': 'jopf', '𝒥': 'Jscr', '𝒿': 'jscr', 'Ј': 'Jsercy', 'ј': 'jsercy', 'Є': 'Jukcy', 'є': 'jukcy', 'Κ': 'Kappa', 'κ': 'kappa', 'ϰ': 'kappav', 'Ķ': 'Kcedil', 'ķ': 'kcedil', 'К': 'Kcy', 'к': 'kcy', '𝔎': 'Kfr', '𝔨': 'kfr', 'ĸ': 'kgreen', 'Х': 'KHcy', 'х': 'khcy', 'Ќ': 'KJcy', 'ќ': 'kjcy', '𝕂': 'Kopf', '𝕜': 'kopf', '𝒦': 'Kscr', '𝓀': 'kscr', '⇚': 'lAarr', 'Ĺ': 'Lacute', 'ĺ': 'lacute', '⦴': 'laemptyv', 'ℒ': 'Lscr', 'Λ': 'Lambda', 'λ': 'lambda', '⟨': 'lang', '⟪': 'Lang', '⦑': 'langd', '⪅': 'lap', '\xAB': 'laquo', '⇤': 'larrb', '⤟': 'larrbfs', '←': 'larr', '↞': 'Larr', '⤝': 'larrfs', '↫': 'larrlp', '⤹': 'larrpl', '⥳': 'larrsim', '↢': 'larrtl', '⤙': 'latail', '⤛': 'lAtail', '⪫': 'lat', '⪭': 'late', '⪭︀': 'lates', '⤌': 'lbarr', '⤎': 'lBarr', '❲': 'lbbrk', '{': 'lcub', '[': 'lsqb', '⦋': 'lbrke', '⦏': 'lbrksld', '⦍': 'lbrkslu', 'Ľ': 'Lcaron', 'ľ': 'lcaron', 'Ļ': 'Lcedil', 'ļ': 'lcedil', '⌈': 'lceil', 'Л': 'Lcy', 'л': 'lcy', '⤶': 'ldca', '“': 'ldquo', '⥧': 'ldrdhar', '⥋': 'ldrushar', '↲': 'ldsh', '≤': 'le', '≦': 'lE', '⇆': 'lrarr', '⟦': 'lobrk', '⥡': 'LeftDownTeeVector', '⥙': 'LeftDownVectorBar', '⌊': 'lfloor', '↼': 'lharu', '⇇': 'llarr', '⇋': 'lrhar', '⥎': 'LeftRightVector', '↤': 'mapstoleft', '⥚': 'LeftTeeVector', '⋋': 'lthree', '⧏': 'LeftTriangleBar', '⊲': 'vltri', '⊴': 'ltrie', '⥑': 'LeftUpDownVector', '⥠': 'LeftUpTeeVector', '⥘': 'LeftUpVectorBar', '↿': 'uharl', '⥒': 'LeftVectorBar', '⪋': 'lEg', '⋚': 'leg', '⩽': 'les', '⪨': 'lescc', '⩿': 'lesdot', '⪁': 'lesdoto', '⪃': 'lesdotor', '⋚︀': 'lesg', '⪓': 'lesges', '⋖': 'ltdot', '≶': 'lg', '⪡': 'LessLess', '≲': 'lsim', '⥼': 'lfisht', '𝔏': 'Lfr', '𝔩': 'lfr', '⪑': 'lgE', '⥢': 'lHar', '⥪': 'lharul', '▄': 'lhblk', 'Љ': 'LJcy', 'љ': 'ljcy', '≪': 'll', '⋘': 'Ll', '⥫': 'llhard', '◺': 'lltri', 'Ŀ': 'Lmidot', 'ŀ': 'lmidot', '⎰': 'lmoust', '⪉': 'lnap', '⪇': 'lne', '≨': 'lnE', '⋦': 'lnsim', '⟬': 'loang', '⇽': 'loarr', '⟵': 'xlarr', '⟷': 'xharr', '⟼': 'xmap', '⟶': 'xrarr', '↬': 'rarrlp', '⦅': 'lopar', '𝕃': 'Lopf', '𝕝': 'lopf', '⨭': 'loplus', '⨴': 'lotimes', '∗': 'lowast', '_': 'lowbar', '↙': 'swarr', '↘': 'searr', '◊': 'loz', '(': 'lpar', '⦓': 'lparlt', '⥭': 'lrhard', '‎': 'lrm', '⊿': 'lrtri', '‹': 'lsaquo', '𝓁': 'lscr', '↰': 'lsh', '⪍': 'lsime', '⪏': 'lsimg', '‘': 'lsquo', '‚': 'sbquo', 'Ł': 'Lstrok', 'ł': 'lstrok', '⪦': 'ltcc', '⩹': 'ltcir', '<': 'lt', '⋉': 'ltimes', '⥶': 'ltlarr', '⩻': 'ltquest', '◃': 'ltri', '⦖': 'ltrPar', '⥊': 'lurdshar', '⥦': 'luruhar', '≨︀': 'lvnE', '\xAF': 'macr', '♂': 'male', '✠': 'malt', '⤅': 'Map', '↦': 'map', '↥': 'mapstoup', '▮': 'marker', '⨩': 'mcomma', 'М': 'Mcy', 'м': 'mcy', '—': 'mdash', '∺': 'mDDot', ' ': 'MediumSpace', 'ℳ': 'Mscr', '𝔐': 'Mfr', '𝔪': 'mfr', '℧': 'mho', '\xB5': 'micro', '⫰': 'midcir', '∣': 'mid', '−': 'minus', '⨪': 'minusdu', '∓': 'mp', '⫛': 'mlcp', '⊧': 'models', '𝕄': 'Mopf', '𝕞': 'mopf', '𝓂': 'mscr', 'Μ': 'Mu', 'μ': 'mu', '⊸': 'mumap', 'Ń': 'Nacute', 'ń': 'nacute', '∠⃒': 'nang', '≉': 'nap', '⩰̸': 'napE', '≋̸': 'napid', 'ŉ': 'napos', '♮': 'natur', 'ℕ': 'Nopf', '\xA0': 'nbsp', '≎̸': 'nbump', '≏̸': 'nbumpe', '⩃': 'ncap', 'Ň': 'Ncaron', 'ň': 'ncaron', 'Ņ': 'Ncedil', 'ņ': 'ncedil', '≇': 'ncong', '⩭̸': 'ncongdot', '⩂': 'ncup', 'Н': 'Ncy', 'н': 'ncy', '–': 'ndash', '⤤': 'nearhk', '↗': 'nearr', '⇗': 'neArr', '≠': 'ne', '≐̸': 'nedot', '​': 'ZeroWidthSpace', '≢': 'nequiv', '⤨': 'toea', '≂̸': 'nesim', '\n': 'NewLine', '∄': 'nexist', '𝔑': 'Nfr', '𝔫': 'nfr', '≧̸': 'ngE', '≱': 'nge', '⩾̸': 'nges', '⋙̸': 'nGg', '≵': 'ngsim', '≫⃒': 'nGt', '≯': 'ngt', '≫̸': 'nGtv', '↮': 'nharr', '⇎': 'nhArr', '⫲': 'nhpar', '∋': 'ni', '⋼': 'nis', '⋺': 'nisd', 'Њ': 'NJcy', 'њ': 'njcy', '↚': 'nlarr', '⇍': 'nlArr', '‥': 'nldr', '≦̸': 'nlE', '≰': 'nle', '⩽̸': 'nles', '≮': 'nlt', '⋘̸': 'nLl', '≴': 'nlsim', '≪⃒': 'nLt', '⋪': 'nltri', '⋬': 'nltrie', '≪̸': 'nLtv', '∤': 'nmid', '⁠': 'NoBreak', '𝕟': 'nopf', '⫬': 'Not', '\xAC': 'not', '≭': 'NotCupCap', '∦': 'npar', '∉': 'notin', '≹': 'ntgl', '⋵̸': 'notindot', '⋹̸': 'notinE', '⋷': 'notinvb', '⋶': 'notinvc', '⧏̸': 'NotLeftTriangleBar', '≸': 'ntlg', '⪢̸': 'NotNestedGreaterGreater', '⪡̸': 'NotNestedLessLess', '∌': 'notni', '⋾': 'notnivb', '⋽': 'notnivc', '⊀': 'npr', '⪯̸': 'npre', '⋠': 'nprcue', '⧐̸': 'NotRightTriangleBar', '⋫': 'nrtri', '⋭': 'nrtrie', '⊏̸': 'NotSquareSubset', '⋢': 'nsqsube', '⊐̸': 'NotSquareSuperset', '⋣': 'nsqsupe', '⊂⃒': 'vnsub', '⊈': 'nsube', '⊁': 'nsc', '⪰̸': 'nsce', '⋡': 'nsccue', '≿̸': 'NotSucceedsTilde', '⊃⃒': 'vnsup', '⊉': 'nsupe', '≁': 'nsim', '≄': 'nsime', '⫽⃥': 'nparsl', '∂̸': 'npart', '⨔': 'npolint', '⤳̸': 'nrarrc', '↛': 'nrarr', '⇏': 'nrArr', '↝̸': 'nrarrw', '𝒩': 'Nscr', '𝓃': 'nscr', '⊄': 'nsub', '⫅̸': 'nsubE', '⊅': 'nsup', '⫆̸': 'nsupE', '\xD1': 'Ntilde', '\xF1': 'ntilde', 'Ν': 'Nu', 'ν': 'nu', '#': 'num', '№': 'numero', ' ': 'numsp', '≍⃒': 'nvap', '⊬': 'nvdash', '⊭': 'nvDash', '⊮': 'nVdash', '⊯': 'nVDash', '≥⃒': 'nvge', '>⃒': 'nvgt', '⤄': 'nvHarr', '⧞': 'nvinfin', '⤂': 'nvlArr', '≤⃒': 'nvle', '<⃒': 'nvlt', '⊴⃒': 'nvltrie', '⤃': 'nvrArr', '⊵⃒': 'nvrtrie', '∼⃒': 'nvsim', '⤣': 'nwarhk', '↖': 'nwarr', '⇖': 'nwArr', '⤧': 'nwnear', '\xD3': 'Oacute', '\xF3': 'oacute', '\xD4': 'Ocirc', '\xF4': 'ocirc', 'О': 'Ocy', 'о': 'ocy', 'Ő': 'Odblac', 'ő': 'odblac', '⨸': 'odiv', '⦼': 'odsold', 'Œ': 'OElig', 'œ': 'oelig', '⦿': 'ofcir', '𝔒': 'Ofr', '𝔬': 'ofr', '˛': 'ogon', '\xD2': 'Ograve', '\xF2': 'ograve', '⧁': 'ogt', '⦵': 'ohbar', 'Ω': 'ohm', '⦾': 'olcir', '⦻': 'olcross', '‾': 'oline', '⧀': 'olt', 'Ō': 'Omacr', 'ō': 'omacr', 'ω': 'omega', 'Ο': 'Omicron', 'ο': 'omicron', '⦶': 'omid', '𝕆': 'Oopf', '𝕠': 'oopf', '⦷': 'opar', '⦹': 'operp', '⩔': 'Or', '∨': 'or', '⩝': 'ord', 'ℴ': 'oscr', '\xAA': 'ordf', '\xBA': 'ordm', '⊶': 'origof', '⩖': 'oror', '⩗': 'orslope', '⩛': 'orv', '𝒪': 'Oscr', '\xD8': 'Oslash', '\xF8': 'oslash', '⊘': 'osol', '\xD5': 'Otilde', '\xF5': 'otilde', '⨶': 'otimesas', '⨷': 'Otimes', '\xD6': 'Ouml', '\xF6': 'ouml', '⌽': 'ovbar', '⏞': 'OverBrace', '⎴': 'tbrk', '⏜': 'OverParenthesis', '\xB6': 'para', '⫳': 'parsim', '⫽': 'parsl', '∂': 'part', 'П': 'Pcy', 'п': 'pcy', '%': 'percnt', '.': 'period', '‰': 'permil', '‱': 'pertenk', '𝔓': 'Pfr', '𝔭': 'pfr', 'Φ': 'Phi', 'φ': 'phi', 'ϕ': 'phiv', '☎': 'phone', 'Π': 'Pi', 'π': 'pi', 'ϖ': 'piv', 'ℎ': 'planckh', '⨣': 'plusacir', '⨢': 'pluscir', '+': 'plus', '⨥': 'plusdu', '⩲': 'pluse', '\xB1': 'pm', '⨦': 'plussim', '⨧': 'plustwo', '⨕': 'pointint', '𝕡': 'popf', 'ℙ': 'Popf', '\xA3': 'pound', '⪷': 'prap', '⪻': 'Pr', '≺': 'pr', '≼': 'prcue', '⪯': 'pre', '≾': 'prsim', '⪹': 'prnap', '⪵': 'prnE', '⋨': 'prnsim', '⪳': 'prE', '′': 'prime', '″': 'Prime', '∏': 'prod', '⌮': 'profalar', '⌒': 'profline', '⌓': 'profsurf', '∝': 'prop', '⊰': 'prurel', '𝒫': 'Pscr', '𝓅': 'pscr', 'Ψ': 'Psi', 'ψ': 'psi', ' ': 'puncsp', '𝔔': 'Qfr', '𝔮': 'qfr', '𝕢': 'qopf', 'ℚ': 'Qopf', '⁗': 'qprime', '𝒬': 'Qscr', '𝓆': 'qscr', '⨖': 'quatint', '?': 'quest', '"': 'quot', '⇛': 'rAarr', '∽̱': 'race', 'Ŕ': 'Racute', 'ŕ': 'racute', '√': 'Sqrt', '⦳': 'raemptyv', '⟩': 'rang', '⟫': 'Rang', '⦒': 'rangd', '⦥': 'range', '\xBB': 'raquo', '⥵': 'rarrap', '⇥': 'rarrb', '⤠': 'rarrbfs', '⤳': 'rarrc', '→': 'rarr', '↠': 'Rarr', '⤞': 'rarrfs', '⥅': 'rarrpl', '⥴': 'rarrsim', '⤖': 'Rarrtl', '↣': 'rarrtl', '↝': 'rarrw', '⤚': 'ratail', '⤜': 'rAtail', '∶': 'ratio', '❳': 'rbbrk', '}': 'rcub', ']': 'rsqb', '⦌': 'rbrke', '⦎': 'rbrksld', '⦐': 'rbrkslu', 'Ř': 'Rcaron', 'ř': 'rcaron', 'Ŗ': 'Rcedil', 'ŗ': 'rcedil', '⌉': 'rceil', 'Р': 'Rcy', 'р': 'rcy', '⤷': 'rdca', '⥩': 'rdldhar', '↳': 'rdsh', 'ℜ': 'Re', 'ℛ': 'Rscr', 'ℝ': 'Ropf', '▭': 'rect', '⥽': 'rfisht', '⌋': 'rfloor', '𝔯': 'rfr', '⥤': 'rHar', '⇀': 'rharu', '⥬': 'rharul', 'Ρ': 'Rho', 'ρ': 'rho', 'ϱ': 'rhov', '⇄': 'rlarr', '⟧': 'robrk', '⥝': 'RightDownTeeVector', '⥕': 'RightDownVectorBar', '⇉': 'rrarr', '⊢': 'vdash', '⥛': 'RightTeeVector', '⋌': 'rthree', '⧐': 'RightTriangleBar', '⊳': 'vrtri', '⊵': 'rtrie', '⥏': 'RightUpDownVector', '⥜': 'RightUpTeeVector', '⥔': 'RightUpVectorBar', '↾': 'uharr', '⥓': 'RightVectorBar', '˚': 'ring', '‏': 'rlm', '⎱': 'rmoust', '⫮': 'rnmid', '⟭': 'roang', '⇾': 'roarr', '⦆': 'ropar', '𝕣': 'ropf', '⨮': 'roplus', '⨵': 'rotimes', '⥰': 'RoundImplies', ')': 'rpar', '⦔': 'rpargt', '⨒': 'rppolint', '›': 'rsaquo', '𝓇': 'rscr', '↱': 'rsh', '⋊': 'rtimes', '▹': 'rtri', '⧎': 'rtriltri', '⧴': 'RuleDelayed', '⥨': 'ruluhar', '℞': 'rx', 'Ś': 'Sacute', 'ś': 'sacute', '⪸': 'scap', 'Š': 'Scaron', 'š': 'scaron', '⪼': 'Sc', '≻': 'sc', '≽': 'sccue', '⪰': 'sce', '⪴': 'scE', 'Ş': 'Scedil', 'ş': 'scedil', 'Ŝ': 'Scirc', 'ŝ': 'scirc', '⪺': 'scnap', '⪶': 'scnE', '⋩': 'scnsim', '⨓': 'scpolint', '≿': 'scsim', 'С': 'Scy', 'с': 'scy', '⋅': 'sdot', '⩦': 'sdote', '⇘': 'seArr', '\xA7': 'sect', ';': 'semi', '⤩': 'tosa', '✶': 'sext', '𝔖': 'Sfr', '𝔰': 'sfr', '♯': 'sharp', 'Щ': 'SHCHcy', 'щ': 'shchcy', 'Ш': 'SHcy', 'ш': 'shcy', '↑': 'uarr', '\xAD': 'shy', 'Σ': 'Sigma', 'σ': 'sigma', 'ς': 'sigmaf', '∼': 'sim', '⩪': 'simdot', '≃': 'sime', '⪞': 'simg', '⪠': 'simgE', '⪝': 'siml', '⪟': 'simlE', '≆': 'simne', '⨤': 'simplus', '⥲': 'simrarr', '⨳': 'smashp', '⧤': 'smeparsl', '⌣': 'smile', '⪪': 'smt', '⪬': 'smte', '⪬︀': 'smtes', 'Ь': 'SOFTcy', 'ь': 'softcy', '⌿': 'solbar', '⧄': 'solb', '/': 'sol', '𝕊': 'Sopf', '𝕤': 'sopf', '♠': 'spades', '⊓': 'sqcap', '⊓︀': 'sqcaps', '⊔': 'sqcup', '⊔︀': 'sqcups', '⊏': 'sqsub', '⊑': 'sqsube', '⊐': 'sqsup', '⊒': 'sqsupe', '□': 'squ', '𝒮': 'Sscr', '𝓈': 'sscr', '⋆': 'Star', '☆': 'star', '⊂': 'sub', '⋐': 'Sub', '⪽': 'subdot', '⫅': 'subE', '⊆': 'sube', '⫃': 'subedot', '⫁': 'submult', '⫋': 'subnE', '⊊': 'subne', '⪿': 'subplus', '⥹': 'subrarr', '⫇': 'subsim', '⫕': 'subsub', '⫓': 'subsup', '∑': 'sum', '♪': 'sung', '\xB9': 'sup1', '\xB2': 'sup2', '\xB3': 'sup3', '⊃': 'sup', '⋑': 'Sup', '⪾': 'supdot', '⫘': 'supdsub', '⫆': 'supE', '⊇': 'supe', '⫄': 'supedot', '⟉': 'suphsol', '⫗': 'suphsub', '⥻': 'suplarr', '⫂': 'supmult', '⫌': 'supnE', '⊋': 'supne', '⫀': 'supplus', '⫈': 'supsim', '⫔': 'supsub', '⫖': 'supsup', '⇙': 'swArr', '⤪': 'swnwar', '\xDF': 'szlig', '\t': 'Tab', '⌖': 'target', 'Τ': 'Tau', 'τ': 'tau', 'Ť': 'Tcaron', 'ť': 'tcaron', 'Ţ': 'Tcedil', 'ţ': 'tcedil', 'Т': 'Tcy', 'т': 'tcy', '⃛': 'tdot', '⌕': 'telrec', '𝔗': 'Tfr', '𝔱': 'tfr', '∴': 'there4', 'Θ': 'Theta', 'θ': 'theta', 'ϑ': 'thetav', '  ': 'ThickSpace', ' ': 'thinsp', '\xDE': 'THORN', '\xFE': 'thorn', '⨱': 'timesbar', '\xD7': 'times', '⨰': 'timesd', '⌶': 'topbot', '⫱': 'topcir', '𝕋': 'Topf', '𝕥': 'topf', '⫚': 'topfork', '‴': 'tprime', '™': 'trade', '▵': 'utri', '≜': 'trie', '◬': 'tridot', '⨺': 'triminus', '⨹': 'triplus', '⧍': 'trisb', '⨻': 'tritime', '⏢': 'trpezium', '𝒯': 'Tscr', '𝓉': 'tscr', 'Ц': 'TScy', 'ц': 'tscy', 'Ћ': 'TSHcy', 'ћ': 'tshcy', 'Ŧ': 'Tstrok', 'ŧ': 'tstrok', '\xDA': 'Uacute', '\xFA': 'uacute', '↟': 'Uarr', '⥉': 'Uarrocir', 'Ў': 'Ubrcy', 'ў': 'ubrcy', 'Ŭ': 'Ubreve', 'ŭ': 'ubreve', '\xDB': 'Ucirc', '\xFB': 'ucirc', 'У': 'Ucy', 'у': 'ucy', '⇅': 'udarr', 'Ű': 'Udblac', 'ű': 'udblac', '⥮': 'udhar', '⥾': 'ufisht', '𝔘': 'Ufr', '𝔲': 'ufr', '\xD9': 'Ugrave', '\xF9': 'ugrave', '⥣': 'uHar', '▀': 'uhblk', '⌜': 'ulcorn', '⌏': 'ulcrop', '◸': 'ultri', 'Ū': 'Umacr', 'ū': 'umacr', '⏟': 'UnderBrace', '⏝': 'UnderParenthesis', '⊎': 'uplus', 'Ų': 'Uogon', 'ų': 'uogon', '𝕌': 'Uopf', '𝕦': 'uopf', '⤒': 'UpArrowBar', '↕': 'varr', 'υ': 'upsi', 'ϒ': 'Upsi', 'Υ': 'Upsilon', '⇈': 'uuarr', '⌝': 'urcorn', '⌎': 'urcrop', 'Ů': 'Uring', 'ů': 'uring', '◹': 'urtri', '𝒰': 'Uscr', '𝓊': 'uscr', '⋰': 'utdot', 'Ũ': 'Utilde', 'ũ': 'utilde', '\xDC': 'Uuml', '\xFC': 'uuml', '⦧': 'uwangle', '⦜': 'vangrt', '⊊︀': 'vsubne', '⫋︀': 'vsubnE', '⊋︀': 'vsupne', '⫌︀': 'vsupnE', '⫨': 'vBar', '⫫': 'Vbar', '⫩': 'vBarv', 'В': 'Vcy', 'в': 'vcy', '⊩': 'Vdash', '⊫': 'VDash', '⫦': 'Vdashl', '⊻': 'veebar', '≚': 'veeeq', '⋮': 'vellip', '|': 'vert', '‖': 'Vert', '❘': 'VerticalSeparator', '≀': 'wr', '𝔙': 'Vfr', '𝔳': 'vfr', '𝕍': 'Vopf', '𝕧': 'vopf', '𝒱': 'Vscr', '𝓋': 'vscr', '⊪': 'Vvdash', '⦚': 'vzigzag', 'Ŵ': 'Wcirc', 'ŵ': 'wcirc', '⩟': 'wedbar', '≙': 'wedgeq', '℘': 'wp', '𝔚': 'Wfr', '𝔴': 'wfr', '𝕎': 'Wopf', '𝕨': 'wopf', '𝒲': 'Wscr', '𝓌': 'wscr', '𝔛': 'Xfr', '𝔵': 'xfr', 'Ξ': 'Xi', 'ξ': 'xi', '⋻': 'xnis', '𝕏': 'Xopf', '𝕩': 'xopf', '𝒳': 'Xscr', '𝓍': 'xscr', '\xDD': 'Yacute', '\xFD': 'yacute', 'Я': 'YAcy', 'я': 'yacy', 'Ŷ': 'Ycirc', 'ŷ': 'ycirc', 'Ы': 'Ycy', 'ы': 'ycy', '\xA5': 'yen', '𝔜': 'Yfr', '𝔶': 'yfr', 'Ї': 'YIcy', 'ї': 'yicy', '𝕐': 'Yopf', '𝕪': 'yopf', '𝒴': 'Yscr', '𝓎': 'yscr', 'Ю': 'YUcy', 'ю': 'yucy', '\xFF': 'yuml', 'Ÿ': 'Yuml', 'Ź': 'Zacute', 'ź': 'zacute', 'Ž': 'Zcaron', 'ž': 'zcaron', 'З': 'Zcy', 'з': 'zcy', 'Ż': 'Zdot', 'ż': 'zdot', 'ℨ': 'Zfr', 'Ζ': 'Zeta', 'ζ': 'zeta', '𝔷': 'zfr', 'Ж': 'ZHcy', 'ж': 'zhcy', '⇝': 'zigrarr', '𝕫': 'zopf', '𝒵': 'Zscr', '𝓏': 'zscr', '‍': 'zwj', '‌': 'zwnj' };

	var regexEscape = /["&'<>`]/g;
	var escapeMap = {
		'"': '&quot;',
		'&': '&amp;',
		'\'': '&#x27;',
		'<': '&lt;',
		// See https://mathiasbynens.be/notes/ambiguous-ampersands: in HTML, the
		// following is not strictly necessary unless it’s part of a tag or an
		// unquoted attribute value. We’re only escaping it to support those
		// situations, and for XML support.
		'>': '&gt;',
		// In Internet Explorer ≤ 8, the backtick character can be used
		// to break out of (un)quoted attribute values or HTML comments.
		// See http://html5sec.org/#102, http://html5sec.org/#108, and
		// http://html5sec.org/#133.
		'`': '&#x60;'
	};

	var regexInvalidEntity = /&#(?:[xX][^a-fA-F0-9]|[^0-9xX])/;
	var regexInvalidRawCodePoint = /[\0-\x08\x0B\x0E-\x1F\x7F-\x9F\uFDD0-\uFDEF\uFFFE\uFFFF]|[\uD83F\uD87F\uD8BF\uD8FF\uD93F\uD97F\uD9BF\uD9FF\uDA3F\uDA7F\uDABF\uDAFF\uDB3F\uDB7F\uDBBF\uDBFF][\uDFFE\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
	var regexDecode = /&#([0-9]+)(;?)|&#[xX]([a-fA-F0-9]+)(;?)|&([0-9a-zA-Z]+);|&(Aacute|iacute|Uacute|plusmn|otilde|Otilde|Agrave|agrave|yacute|Yacute|oslash|Oslash|Atilde|atilde|brvbar|Ccedil|ccedil|ograve|curren|divide|Eacute|eacute|Ograve|oacute|Egrave|egrave|ugrave|frac12|frac14|frac34|Ugrave|Oacute|Iacute|ntilde|Ntilde|uacute|middot|Igrave|igrave|iquest|aacute|laquo|THORN|micro|iexcl|icirc|Icirc|Acirc|ucirc|ecirc|Ocirc|ocirc|Ecirc|Ucirc|aring|Aring|aelig|AElig|acute|pound|raquo|acirc|times|thorn|szlig|cedil|COPY|Auml|ordf|ordm|uuml|macr|Uuml|auml|Ouml|ouml|para|nbsp|Euml|quot|QUOT|euml|yuml|cent|sect|copy|sup1|sup2|sup3|Iuml|iuml|shy|eth|reg|not|yen|amp|AMP|REG|uml|ETH|deg|gt|GT|LT|lt)([=a-zA-Z0-9])?/g;
	var decodeMap = { 'Aacute': '\xC1', 'aacute': '\xE1', 'Abreve': 'Ă', 'abreve': 'ă', 'ac': '∾', 'acd': '∿', 'acE': '∾̳', 'Acirc': '\xC2', 'acirc': '\xE2', 'acute': '\xB4', 'Acy': 'А', 'acy': 'а', 'AElig': '\xC6', 'aelig': '\xE6', 'af': '⁡', 'Afr': '𝔄', 'afr': '𝔞', 'Agrave': '\xC0', 'agrave': '\xE0', 'alefsym': 'ℵ', 'aleph': 'ℵ', 'Alpha': 'Α', 'alpha': 'α', 'Amacr': 'Ā', 'amacr': 'ā', 'amalg': '⨿', 'amp': '&', 'AMP': '&', 'andand': '⩕', 'And': '⩓', 'and': '∧', 'andd': '⩜', 'andslope': '⩘', 'andv': '⩚', 'ang': '∠', 'ange': '⦤', 'angle': '∠', 'angmsdaa': '⦨', 'angmsdab': '⦩', 'angmsdac': '⦪', 'angmsdad': '⦫', 'angmsdae': '⦬', 'angmsdaf': '⦭', 'angmsdag': '⦮', 'angmsdah': '⦯', 'angmsd': '∡', 'angrt': '∟', 'angrtvb': '⊾', 'angrtvbd': '⦝', 'angsph': '∢', 'angst': '\xC5', 'angzarr': '⍼', 'Aogon': 'Ą', 'aogon': 'ą', 'Aopf': '𝔸', 'aopf': '𝕒', 'apacir': '⩯', 'ap': '≈', 'apE': '⩰', 'ape': '≊', 'apid': '≋', 'apos': '\'', 'ApplyFunction': '⁡', 'approx': '≈', 'approxeq': '≊', 'Aring': '\xC5', 'aring': '\xE5', 'Ascr': '𝒜', 'ascr': '𝒶', 'Assign': '≔', 'ast': '*', 'asymp': '≈', 'asympeq': '≍', 'Atilde': '\xC3', 'atilde': '\xE3', 'Auml': '\xC4', 'auml': '\xE4', 'awconint': '∳', 'awint': '⨑', 'backcong': '≌', 'backepsilon': '϶', 'backprime': '‵', 'backsim': '∽', 'backsimeq': '⋍', 'Backslash': '∖', 'Barv': '⫧', 'barvee': '⊽', 'barwed': '⌅', 'Barwed': '⌆', 'barwedge': '⌅', 'bbrk': '⎵', 'bbrktbrk': '⎶', 'bcong': '≌', 'Bcy': 'Б', 'bcy': 'б', 'bdquo': '„', 'becaus': '∵', 'because': '∵', 'Because': '∵', 'bemptyv': '⦰', 'bepsi': '϶', 'bernou': 'ℬ', 'Bernoullis': 'ℬ', 'Beta': 'Β', 'beta': 'β', 'beth': 'ℶ', 'between': '≬', 'Bfr': '𝔅', 'bfr': '𝔟', 'bigcap': '⋂', 'bigcirc': '◯', 'bigcup': '⋃', 'bigodot': '⨀', 'bigoplus': '⨁', 'bigotimes': '⨂', 'bigsqcup': '⨆', 'bigstar': '★', 'bigtriangledown': '▽', 'bigtriangleup': '△', 'biguplus': '⨄', 'bigvee': '⋁', 'bigwedge': '⋀', 'bkarow': '⤍', 'blacklozenge': '⧫', 'blacksquare': '▪', 'blacktriangle': '▴', 'blacktriangledown': '▾', 'blacktriangleleft': '◂', 'blacktriangleright': '▸', 'blank': '␣', 'blk12': '▒', 'blk14': '░', 'blk34': '▓', 'block': '█', 'bne': '=⃥', 'bnequiv': '≡⃥', 'bNot': '⫭', 'bnot': '⌐', 'Bopf': '𝔹', 'bopf': '𝕓', 'bot': '⊥', 'bottom': '⊥', 'bowtie': '⋈', 'boxbox': '⧉', 'boxdl': '┐', 'boxdL': '╕', 'boxDl': '╖', 'boxDL': '╗', 'boxdr': '┌', 'boxdR': '╒', 'boxDr': '╓', 'boxDR': '╔', 'boxh': '─', 'boxH': '═', 'boxhd': '┬', 'boxHd': '╤', 'boxhD': '╥', 'boxHD': '╦', 'boxhu': '┴', 'boxHu': '╧', 'boxhU': '╨', 'boxHU': '╩', 'boxminus': '⊟', 'boxplus': '⊞', 'boxtimes': '⊠', 'boxul': '┘', 'boxuL': '╛', 'boxUl': '╜', 'boxUL': '╝', 'boxur': '└', 'boxuR': '╘', 'boxUr': '╙', 'boxUR': '╚', 'boxv': '│', 'boxV': '║', 'boxvh': '┼', 'boxvH': '╪', 'boxVh': '╫', 'boxVH': '╬', 'boxvl': '┤', 'boxvL': '╡', 'boxVl': '╢', 'boxVL': '╣', 'boxvr': '├', 'boxvR': '╞', 'boxVr': '╟', 'boxVR': '╠', 'bprime': '‵', 'breve': '˘', 'Breve': '˘', 'brvbar': '\xA6', 'bscr': '𝒷', 'Bscr': 'ℬ', 'bsemi': '⁏', 'bsim': '∽', 'bsime': '⋍', 'bsolb': '⧅', 'bsol': '\\', 'bsolhsub': '⟈', 'bull': '•', 'bullet': '•', 'bump': '≎', 'bumpE': '⪮', 'bumpe': '≏', 'Bumpeq': '≎', 'bumpeq': '≏', 'Cacute': 'Ć', 'cacute': 'ć', 'capand': '⩄', 'capbrcup': '⩉', 'capcap': '⩋', 'cap': '∩', 'Cap': '⋒', 'capcup': '⩇', 'capdot': '⩀', 'CapitalDifferentialD': 'ⅅ', 'caps': '∩︀', 'caret': '⁁', 'caron': 'ˇ', 'Cayleys': 'ℭ', 'ccaps': '⩍', 'Ccaron': 'Č', 'ccaron': 'č', 'Ccedil': '\xC7', 'ccedil': '\xE7', 'Ccirc': 'Ĉ', 'ccirc': 'ĉ', 'Cconint': '∰', 'ccups': '⩌', 'ccupssm': '⩐', 'Cdot': 'Ċ', 'cdot': 'ċ', 'cedil': '\xB8', 'Cedilla': '\xB8', 'cemptyv': '⦲', 'cent': '\xA2', 'centerdot': '\xB7', 'CenterDot': '\xB7', 'cfr': '𝔠', 'Cfr': 'ℭ', 'CHcy': 'Ч', 'chcy': 'ч', 'check': '✓', 'checkmark': '✓', 'Chi': 'Χ', 'chi': 'χ', 'circ': 'ˆ', 'circeq': '≗', 'circlearrowleft': '↺', 'circlearrowright': '↻', 'circledast': '⊛', 'circledcirc': '⊚', 'circleddash': '⊝', 'CircleDot': '⊙', 'circledR': '\xAE', 'circledS': 'Ⓢ', 'CircleMinus': '⊖', 'CirclePlus': '⊕', 'CircleTimes': '⊗', 'cir': '○', 'cirE': '⧃', 'cire': '≗', 'cirfnint': '⨐', 'cirmid': '⫯', 'cirscir': '⧂', 'ClockwiseContourIntegral': '∲', 'CloseCurlyDoubleQuote': '”', 'CloseCurlyQuote': '’', 'clubs': '♣', 'clubsuit': '♣', 'colon': ':', 'Colon': '∷', 'Colone': '⩴', 'colone': '≔', 'coloneq': '≔', 'comma': ',', 'commat': '@', 'comp': '∁', 'compfn': '∘', 'complement': '∁', 'complexes': 'ℂ', 'cong': '≅', 'congdot': '⩭', 'Congruent': '≡', 'conint': '∮', 'Conint': '∯', 'ContourIntegral': '∮', 'copf': '𝕔', 'Copf': 'ℂ', 'coprod': '∐', 'Coproduct': '∐', 'copy': '\xA9', 'COPY': '\xA9', 'copysr': '℗', 'CounterClockwiseContourIntegral': '∳', 'crarr': '↵', 'cross': '✗', 'Cross': '⨯', 'Cscr': '𝒞', 'cscr': '𝒸', 'csub': '⫏', 'csube': '⫑', 'csup': '⫐', 'csupe': '⫒', 'ctdot': '⋯', 'cudarrl': '⤸', 'cudarrr': '⤵', 'cuepr': '⋞', 'cuesc': '⋟', 'cularr': '↶', 'cularrp': '⤽', 'cupbrcap': '⩈', 'cupcap': '⩆', 'CupCap': '≍', 'cup': '∪', 'Cup': '⋓', 'cupcup': '⩊', 'cupdot': '⊍', 'cupor': '⩅', 'cups': '∪︀', 'curarr': '↷', 'curarrm': '⤼', 'curlyeqprec': '⋞', 'curlyeqsucc': '⋟', 'curlyvee': '⋎', 'curlywedge': '⋏', 'curren': '\xA4', 'curvearrowleft': '↶', 'curvearrowright': '↷', 'cuvee': '⋎', 'cuwed': '⋏', 'cwconint': '∲', 'cwint': '∱', 'cylcty': '⌭', 'dagger': '†', 'Dagger': '‡', 'daleth': 'ℸ', 'darr': '↓', 'Darr': '↡', 'dArr': '⇓', 'dash': '‐', 'Dashv': '⫤', 'dashv': '⊣', 'dbkarow': '⤏', 'dblac': '˝', 'Dcaron': 'Ď', 'dcaron': 'ď', 'Dcy': 'Д', 'dcy': 'д', 'ddagger': '‡', 'ddarr': '⇊', 'DD': 'ⅅ', 'dd': 'ⅆ', 'DDotrahd': '⤑', 'ddotseq': '⩷', 'deg': '\xB0', 'Del': '∇', 'Delta': 'Δ', 'delta': 'δ', 'demptyv': '⦱', 'dfisht': '⥿', 'Dfr': '𝔇', 'dfr': '𝔡', 'dHar': '⥥', 'dharl': '⇃', 'dharr': '⇂', 'DiacriticalAcute': '\xB4', 'DiacriticalDot': '˙', 'DiacriticalDoubleAcute': '˝', 'DiacriticalGrave': '`', 'DiacriticalTilde': '˜', 'diam': '⋄', 'diamond': '⋄', 'Diamond': '⋄', 'diamondsuit': '♦', 'diams': '♦', 'die': '\xA8', 'DifferentialD': 'ⅆ', 'digamma': 'ϝ', 'disin': '⋲', 'div': '\xF7', 'divide': '\xF7', 'divideontimes': '⋇', 'divonx': '⋇', 'DJcy': 'Ђ', 'djcy': 'ђ', 'dlcorn': '⌞', 'dlcrop': '⌍', 'dollar': '$', 'Dopf': '𝔻', 'dopf': '𝕕', 'Dot': '\xA8', 'dot': '˙', 'DotDot': '⃜', 'doteq': '≐', 'doteqdot': '≑', 'DotEqual': '≐', 'dotminus': '∸', 'dotplus': '∔', 'dotsquare': '⊡', 'doublebarwedge': '⌆', 'DoubleContourIntegral': '∯', 'DoubleDot': '\xA8', 'DoubleDownArrow': '⇓', 'DoubleLeftArrow': '⇐', 'DoubleLeftRightArrow': '⇔', 'DoubleLeftTee': '⫤', 'DoubleLongLeftArrow': '⟸', 'DoubleLongLeftRightArrow': '⟺', 'DoubleLongRightArrow': '⟹', 'DoubleRightArrow': '⇒', 'DoubleRightTee': '⊨', 'DoubleUpArrow': '⇑', 'DoubleUpDownArrow': '⇕', 'DoubleVerticalBar': '∥', 'DownArrowBar': '⤓', 'downarrow': '↓', 'DownArrow': '↓', 'Downarrow': '⇓', 'DownArrowUpArrow': '⇵', 'DownBreve': '̑', 'downdownarrows': '⇊', 'downharpoonleft': '⇃', 'downharpoonright': '⇂', 'DownLeftRightVector': '⥐', 'DownLeftTeeVector': '⥞', 'DownLeftVectorBar': '⥖', 'DownLeftVector': '↽', 'DownRightTeeVector': '⥟', 'DownRightVectorBar': '⥗', 'DownRightVector': '⇁', 'DownTeeArrow': '↧', 'DownTee': '⊤', 'drbkarow': '⤐', 'drcorn': '⌟', 'drcrop': '⌌', 'Dscr': '𝒟', 'dscr': '𝒹', 'DScy': 'Ѕ', 'dscy': 'ѕ', 'dsol': '⧶', 'Dstrok': 'Đ', 'dstrok': 'đ', 'dtdot': '⋱', 'dtri': '▿', 'dtrif': '▾', 'duarr': '⇵', 'duhar': '⥯', 'dwangle': '⦦', 'DZcy': 'Џ', 'dzcy': 'џ', 'dzigrarr': '⟿', 'Eacute': '\xC9', 'eacute': '\xE9', 'easter': '⩮', 'Ecaron': 'Ě', 'ecaron': 'ě', 'Ecirc': '\xCA', 'ecirc': '\xEA', 'ecir': '≖', 'ecolon': '≕', 'Ecy': 'Э', 'ecy': 'э', 'eDDot': '⩷', 'Edot': 'Ė', 'edot': 'ė', 'eDot': '≑', 'ee': 'ⅇ', 'efDot': '≒', 'Efr': '𝔈', 'efr': '𝔢', 'eg': '⪚', 'Egrave': '\xC8', 'egrave': '\xE8', 'egs': '⪖', 'egsdot': '⪘', 'el': '⪙', 'Element': '∈', 'elinters': '⏧', 'ell': 'ℓ', 'els': '⪕', 'elsdot': '⪗', 'Emacr': 'Ē', 'emacr': 'ē', 'empty': '∅', 'emptyset': '∅', 'EmptySmallSquare': '◻', 'emptyv': '∅', 'EmptyVerySmallSquare': '▫', 'emsp13': ' ', 'emsp14': ' ', 'emsp': ' ', 'ENG': 'Ŋ', 'eng': 'ŋ', 'ensp': ' ', 'Eogon': 'Ę', 'eogon': 'ę', 'Eopf': '𝔼', 'eopf': '𝕖', 'epar': '⋕', 'eparsl': '⧣', 'eplus': '⩱', 'epsi': 'ε', 'Epsilon': 'Ε', 'epsilon': 'ε', 'epsiv': 'ϵ', 'eqcirc': '≖', 'eqcolon': '≕', 'eqsim': '≂', 'eqslantgtr': '⪖', 'eqslantless': '⪕', 'Equal': '⩵', 'equals': '=', 'EqualTilde': '≂', 'equest': '≟', 'Equilibrium': '⇌', 'equiv': '≡', 'equivDD': '⩸', 'eqvparsl': '⧥', 'erarr': '⥱', 'erDot': '≓', 'escr': 'ℯ', 'Escr': 'ℰ', 'esdot': '≐', 'Esim': '⩳', 'esim': '≂', 'Eta': 'Η', 'eta': 'η', 'ETH': '\xD0', 'eth': '\xF0', 'Euml': '\xCB', 'euml': '\xEB', 'euro': '€', 'excl': '!', 'exist': '∃', 'Exists': '∃', 'expectation': 'ℰ', 'exponentiale': 'ⅇ', 'ExponentialE': 'ⅇ', 'fallingdotseq': '≒', 'Fcy': 'Ф', 'fcy': 'ф', 'female': '♀', 'ffilig': 'ﬃ', 'fflig': 'ﬀ', 'ffllig': 'ﬄ', 'Ffr': '𝔉', 'ffr': '𝔣', 'filig': 'ﬁ', 'FilledSmallSquare': '◼', 'FilledVerySmallSquare': '▪', 'fjlig': 'fj', 'flat': '♭', 'fllig': 'ﬂ', 'fltns': '▱', 'fnof': 'ƒ', 'Fopf': '𝔽', 'fopf': '𝕗', 'forall': '∀', 'ForAll': '∀', 'fork': '⋔', 'forkv': '⫙', 'Fouriertrf': 'ℱ', 'fpartint': '⨍', 'frac12': '\xBD', 'frac13': '⅓', 'frac14': '\xBC', 'frac15': '⅕', 'frac16': '⅙', 'frac18': '⅛', 'frac23': '⅔', 'frac25': '⅖', 'frac34': '\xBE', 'frac35': '⅗', 'frac38': '⅜', 'frac45': '⅘', 'frac56': '⅚', 'frac58': '⅝', 'frac78': '⅞', 'frasl': '⁄', 'frown': '⌢', 'fscr': '𝒻', 'Fscr': 'ℱ', 'gacute': 'ǵ', 'Gamma': 'Γ', 'gamma': 'γ', 'Gammad': 'Ϝ', 'gammad': 'ϝ', 'gap': '⪆', 'Gbreve': 'Ğ', 'gbreve': 'ğ', 'Gcedil': 'Ģ', 'Gcirc': 'Ĝ', 'gcirc': 'ĝ', 'Gcy': 'Г', 'gcy': 'г', 'Gdot': 'Ġ', 'gdot': 'ġ', 'ge': '≥', 'gE': '≧', 'gEl': '⪌', 'gel': '⋛', 'geq': '≥', 'geqq': '≧', 'geqslant': '⩾', 'gescc': '⪩', 'ges': '⩾', 'gesdot': '⪀', 'gesdoto': '⪂', 'gesdotol': '⪄', 'gesl': '⋛︀', 'gesles': '⪔', 'Gfr': '𝔊', 'gfr': '𝔤', 'gg': '≫', 'Gg': '⋙', 'ggg': '⋙', 'gimel': 'ℷ', 'GJcy': 'Ѓ', 'gjcy': 'ѓ', 'gla': '⪥', 'gl': '≷', 'glE': '⪒', 'glj': '⪤', 'gnap': '⪊', 'gnapprox': '⪊', 'gne': '⪈', 'gnE': '≩', 'gneq': '⪈', 'gneqq': '≩', 'gnsim': '⋧', 'Gopf': '𝔾', 'gopf': '𝕘', 'grave': '`', 'GreaterEqual': '≥', 'GreaterEqualLess': '⋛', 'GreaterFullEqual': '≧', 'GreaterGreater': '⪢', 'GreaterLess': '≷', 'GreaterSlantEqual': '⩾', 'GreaterTilde': '≳', 'Gscr': '𝒢', 'gscr': 'ℊ', 'gsim': '≳', 'gsime': '⪎', 'gsiml': '⪐', 'gtcc': '⪧', 'gtcir': '⩺', 'gt': '>', 'GT': '>', 'Gt': '≫', 'gtdot': '⋗', 'gtlPar': '⦕', 'gtquest': '⩼', 'gtrapprox': '⪆', 'gtrarr': '⥸', 'gtrdot': '⋗', 'gtreqless': '⋛', 'gtreqqless': '⪌', 'gtrless': '≷', 'gtrsim': '≳', 'gvertneqq': '≩︀', 'gvnE': '≩︀', 'Hacek': 'ˇ', 'hairsp': ' ', 'half': '\xBD', 'hamilt': 'ℋ', 'HARDcy': 'Ъ', 'hardcy': 'ъ', 'harrcir': '⥈', 'harr': '↔', 'hArr': '⇔', 'harrw': '↭', 'Hat': '^', 'hbar': 'ℏ', 'Hcirc': 'Ĥ', 'hcirc': 'ĥ', 'hearts': '♥', 'heartsuit': '♥', 'hellip': '…', 'hercon': '⊹', 'hfr': '𝔥', 'Hfr': 'ℌ', 'HilbertSpace': 'ℋ', 'hksearow': '⤥', 'hkswarow': '⤦', 'hoarr': '⇿', 'homtht': '∻', 'hookleftarrow': '↩', 'hookrightarrow': '↪', 'hopf': '𝕙', 'Hopf': 'ℍ', 'horbar': '―', 'HorizontalLine': '─', 'hscr': '𝒽', 'Hscr': 'ℋ', 'hslash': 'ℏ', 'Hstrok': 'Ħ', 'hstrok': 'ħ', 'HumpDownHump': '≎', 'HumpEqual': '≏', 'hybull': '⁃', 'hyphen': '‐', 'Iacute': '\xCD', 'iacute': '\xED', 'ic': '⁣', 'Icirc': '\xCE', 'icirc': '\xEE', 'Icy': 'И', 'icy': 'и', 'Idot': 'İ', 'IEcy': 'Е', 'iecy': 'е', 'iexcl': '\xA1', 'iff': '⇔', 'ifr': '𝔦', 'Ifr': 'ℑ', 'Igrave': '\xCC', 'igrave': '\xEC', 'ii': 'ⅈ', 'iiiint': '⨌', 'iiint': '∭', 'iinfin': '⧜', 'iiota': '℩', 'IJlig': 'Ĳ', 'ijlig': 'ĳ', 'Imacr': 'Ī', 'imacr': 'ī', 'image': 'ℑ', 'ImaginaryI': 'ⅈ', 'imagline': 'ℐ', 'imagpart': 'ℑ', 'imath': 'ı', 'Im': 'ℑ', 'imof': '⊷', 'imped': 'Ƶ', 'Implies': '⇒', 'incare': '℅', 'in': '∈', 'infin': '∞', 'infintie': '⧝', 'inodot': 'ı', 'intcal': '⊺', 'int': '∫', 'Int': '∬', 'integers': 'ℤ', 'Integral': '∫', 'intercal': '⊺', 'Intersection': '⋂', 'intlarhk': '⨗', 'intprod': '⨼', 'InvisibleComma': '⁣', 'InvisibleTimes': '⁢', 'IOcy': 'Ё', 'iocy': 'ё', 'Iogon': 'Į', 'iogon': 'į', 'Iopf': '𝕀', 'iopf': '𝕚', 'Iota': 'Ι', 'iota': 'ι', 'iprod': '⨼', 'iquest': '\xBF', 'iscr': '𝒾', 'Iscr': 'ℐ', 'isin': '∈', 'isindot': '⋵', 'isinE': '⋹', 'isins': '⋴', 'isinsv': '⋳', 'isinv': '∈', 'it': '⁢', 'Itilde': 'Ĩ', 'itilde': 'ĩ', 'Iukcy': 'І', 'iukcy': 'і', 'Iuml': '\xCF', 'iuml': '\xEF', 'Jcirc': 'Ĵ', 'jcirc': 'ĵ', 'Jcy': 'Й', 'jcy': 'й', 'Jfr': '𝔍', 'jfr': '𝔧', 'jmath': 'ȷ', 'Jopf': '𝕁', 'jopf': '𝕛', 'Jscr': '𝒥', 'jscr': '𝒿', 'Jsercy': 'Ј', 'jsercy': 'ј', 'Jukcy': 'Є', 'jukcy': 'є', 'Kappa': 'Κ', 'kappa': 'κ', 'kappav': 'ϰ', 'Kcedil': 'Ķ', 'kcedil': 'ķ', 'Kcy': 'К', 'kcy': 'к', 'Kfr': '𝔎', 'kfr': '𝔨', 'kgreen': 'ĸ', 'KHcy': 'Х', 'khcy': 'х', 'KJcy': 'Ќ', 'kjcy': 'ќ', 'Kopf': '𝕂', 'kopf': '𝕜', 'Kscr': '𝒦', 'kscr': '𝓀', 'lAarr': '⇚', 'Lacute': 'Ĺ', 'lacute': 'ĺ', 'laemptyv': '⦴', 'lagran': 'ℒ', 'Lambda': 'Λ', 'lambda': 'λ', 'lang': '⟨', 'Lang': '⟪', 'langd': '⦑', 'langle': '⟨', 'lap': '⪅', 'Laplacetrf': 'ℒ', 'laquo': '\xAB', 'larrb': '⇤', 'larrbfs': '⤟', 'larr': '←', 'Larr': '↞', 'lArr': '⇐', 'larrfs': '⤝', 'larrhk': '↩', 'larrlp': '↫', 'larrpl': '⤹', 'larrsim': '⥳', 'larrtl': '↢', 'latail': '⤙', 'lAtail': '⤛', 'lat': '⪫', 'late': '⪭', 'lates': '⪭︀', 'lbarr': '⤌', 'lBarr': '⤎', 'lbbrk': '❲', 'lbrace': '{', 'lbrack': '[', 'lbrke': '⦋', 'lbrksld': '⦏', 'lbrkslu': '⦍', 'Lcaron': 'Ľ', 'lcaron': 'ľ', 'Lcedil': 'Ļ', 'lcedil': 'ļ', 'lceil': '⌈', 'lcub': '{', 'Lcy': 'Л', 'lcy': 'л', 'ldca': '⤶', 'ldquo': '“', 'ldquor': '„', 'ldrdhar': '⥧', 'ldrushar': '⥋', 'ldsh': '↲', 'le': '≤', 'lE': '≦', 'LeftAngleBracket': '⟨', 'LeftArrowBar': '⇤', 'leftarrow': '←', 'LeftArrow': '←', 'Leftarrow': '⇐', 'LeftArrowRightArrow': '⇆', 'leftarrowtail': '↢', 'LeftCeiling': '⌈', 'LeftDoubleBracket': '⟦', 'LeftDownTeeVector': '⥡', 'LeftDownVectorBar': '⥙', 'LeftDownVector': '⇃', 'LeftFloor': '⌊', 'leftharpoondown': '↽', 'leftharpoonup': '↼', 'leftleftarrows': '⇇', 'leftrightarrow': '↔', 'LeftRightArrow': '↔', 'Leftrightarrow': '⇔', 'leftrightarrows': '⇆', 'leftrightharpoons': '⇋', 'leftrightsquigarrow': '↭', 'LeftRightVector': '⥎', 'LeftTeeArrow': '↤', 'LeftTee': '⊣', 'LeftTeeVector': '⥚', 'leftthreetimes': '⋋', 'LeftTriangleBar': '⧏', 'LeftTriangle': '⊲', 'LeftTriangleEqual': '⊴', 'LeftUpDownVector': '⥑', 'LeftUpTeeVector': '⥠', 'LeftUpVectorBar': '⥘', 'LeftUpVector': '↿', 'LeftVectorBar': '⥒', 'LeftVector': '↼', 'lEg': '⪋', 'leg': '⋚', 'leq': '≤', 'leqq': '≦', 'leqslant': '⩽', 'lescc': '⪨', 'les': '⩽', 'lesdot': '⩿', 'lesdoto': '⪁', 'lesdotor': '⪃', 'lesg': '⋚︀', 'lesges': '⪓', 'lessapprox': '⪅', 'lessdot': '⋖', 'lesseqgtr': '⋚', 'lesseqqgtr': '⪋', 'LessEqualGreater': '⋚', 'LessFullEqual': '≦', 'LessGreater': '≶', 'lessgtr': '≶', 'LessLess': '⪡', 'lesssim': '≲', 'LessSlantEqual': '⩽', 'LessTilde': '≲', 'lfisht': '⥼', 'lfloor': '⌊', 'Lfr': '𝔏', 'lfr': '𝔩', 'lg': '≶', 'lgE': '⪑', 'lHar': '⥢', 'lhard': '↽', 'lharu': '↼', 'lharul': '⥪', 'lhblk': '▄', 'LJcy': 'Љ', 'ljcy': 'љ', 'llarr': '⇇', 'll': '≪', 'Ll': '⋘', 'llcorner': '⌞', 'Lleftarrow': '⇚', 'llhard': '⥫', 'lltri': '◺', 'Lmidot': 'Ŀ', 'lmidot': 'ŀ', 'lmoustache': '⎰', 'lmoust': '⎰', 'lnap': '⪉', 'lnapprox': '⪉', 'lne': '⪇', 'lnE': '≨', 'lneq': '⪇', 'lneqq': '≨', 'lnsim': '⋦', 'loang': '⟬', 'loarr': '⇽', 'lobrk': '⟦', 'longleftarrow': '⟵', 'LongLeftArrow': '⟵', 'Longleftarrow': '⟸', 'longleftrightarrow': '⟷', 'LongLeftRightArrow': '⟷', 'Longleftrightarrow': '⟺', 'longmapsto': '⟼', 'longrightarrow': '⟶', 'LongRightArrow': '⟶', 'Longrightarrow': '⟹', 'looparrowleft': '↫', 'looparrowright': '↬', 'lopar': '⦅', 'Lopf': '𝕃', 'lopf': '𝕝', 'loplus': '⨭', 'lotimes': '⨴', 'lowast': '∗', 'lowbar': '_', 'LowerLeftArrow': '↙', 'LowerRightArrow': '↘', 'loz': '◊', 'lozenge': '◊', 'lozf': '⧫', 'lpar': '(', 'lparlt': '⦓', 'lrarr': '⇆', 'lrcorner': '⌟', 'lrhar': '⇋', 'lrhard': '⥭', 'lrm': '‎', 'lrtri': '⊿', 'lsaquo': '‹', 'lscr': '𝓁', 'Lscr': 'ℒ', 'lsh': '↰', 'Lsh': '↰', 'lsim': '≲', 'lsime': '⪍', 'lsimg': '⪏', 'lsqb': '[', 'lsquo': '‘', 'lsquor': '‚', 'Lstrok': 'Ł', 'lstrok': 'ł', 'ltcc': '⪦', 'ltcir': '⩹', 'lt': '<', 'LT': '<', 'Lt': '≪', 'ltdot': '⋖', 'lthree': '⋋', 'ltimes': '⋉', 'ltlarr': '⥶', 'ltquest': '⩻', 'ltri': '◃', 'ltrie': '⊴', 'ltrif': '◂', 'ltrPar': '⦖', 'lurdshar': '⥊', 'luruhar': '⥦', 'lvertneqq': '≨︀', 'lvnE': '≨︀', 'macr': '\xAF', 'male': '♂', 'malt': '✠', 'maltese': '✠', 'Map': '⤅', 'map': '↦', 'mapsto': '↦', 'mapstodown': '↧', 'mapstoleft': '↤', 'mapstoup': '↥', 'marker': '▮', 'mcomma': '⨩', 'Mcy': 'М', 'mcy': 'м', 'mdash': '—', 'mDDot': '∺', 'measuredangle': '∡', 'MediumSpace': ' ', 'Mellintrf': 'ℳ', 'Mfr': '𝔐', 'mfr': '𝔪', 'mho': '℧', 'micro': '\xB5', 'midast': '*', 'midcir': '⫰', 'mid': '∣', 'middot': '\xB7', 'minusb': '⊟', 'minus': '−', 'minusd': '∸', 'minusdu': '⨪', 'MinusPlus': '∓', 'mlcp': '⫛', 'mldr': '…', 'mnplus': '∓', 'models': '⊧', 'Mopf': '𝕄', 'mopf': '𝕞', 'mp': '∓', 'mscr': '𝓂', 'Mscr': 'ℳ', 'mstpos': '∾', 'Mu': 'Μ', 'mu': 'μ', 'multimap': '⊸', 'mumap': '⊸', 'nabla': '∇', 'Nacute': 'Ń', 'nacute': 'ń', 'nang': '∠⃒', 'nap': '≉', 'napE': '⩰̸', 'napid': '≋̸', 'napos': 'ŉ', 'napprox': '≉', 'natural': '♮', 'naturals': 'ℕ', 'natur': '♮', 'nbsp': '\xA0', 'nbump': '≎̸', 'nbumpe': '≏̸', 'ncap': '⩃', 'Ncaron': 'Ň', 'ncaron': 'ň', 'Ncedil': 'Ņ', 'ncedil': 'ņ', 'ncong': '≇', 'ncongdot': '⩭̸', 'ncup': '⩂', 'Ncy': 'Н', 'ncy': 'н', 'ndash': '–', 'nearhk': '⤤', 'nearr': '↗', 'neArr': '⇗', 'nearrow': '↗', 'ne': '≠', 'nedot': '≐̸', 'NegativeMediumSpace': '​', 'NegativeThickSpace': '​', 'NegativeThinSpace': '​', 'NegativeVeryThinSpace': '​', 'nequiv': '≢', 'nesear': '⤨', 'nesim': '≂̸', 'NestedGreaterGreater': '≫', 'NestedLessLess': '≪', 'NewLine': '\n', 'nexist': '∄', 'nexists': '∄', 'Nfr': '𝔑', 'nfr': '𝔫', 'ngE': '≧̸', 'nge': '≱', 'ngeq': '≱', 'ngeqq': '≧̸', 'ngeqslant': '⩾̸', 'nges': '⩾̸', 'nGg': '⋙̸', 'ngsim': '≵', 'nGt': '≫⃒', 'ngt': '≯', 'ngtr': '≯', 'nGtv': '≫̸', 'nharr': '↮', 'nhArr': '⇎', 'nhpar': '⫲', 'ni': '∋', 'nis': '⋼', 'nisd': '⋺', 'niv': '∋', 'NJcy': 'Њ', 'njcy': 'њ', 'nlarr': '↚', 'nlArr': '⇍', 'nldr': '‥', 'nlE': '≦̸', 'nle': '≰', 'nleftarrow': '↚', 'nLeftarrow': '⇍', 'nleftrightarrow': '↮', 'nLeftrightarrow': '⇎', 'nleq': '≰', 'nleqq': '≦̸', 'nleqslant': '⩽̸', 'nles': '⩽̸', 'nless': '≮', 'nLl': '⋘̸', 'nlsim': '≴', 'nLt': '≪⃒', 'nlt': '≮', 'nltri': '⋪', 'nltrie': '⋬', 'nLtv': '≪̸', 'nmid': '∤', 'NoBreak': '⁠', 'NonBreakingSpace': '\xA0', 'nopf': '𝕟', 'Nopf': 'ℕ', 'Not': '⫬', 'not': '\xAC', 'NotCongruent': '≢', 'NotCupCap': '≭', 'NotDoubleVerticalBar': '∦', 'NotElement': '∉', 'NotEqual': '≠', 'NotEqualTilde': '≂̸', 'NotExists': '∄', 'NotGreater': '≯', 'NotGreaterEqual': '≱', 'NotGreaterFullEqual': '≧̸', 'NotGreaterGreater': '≫̸', 'NotGreaterLess': '≹', 'NotGreaterSlantEqual': '⩾̸', 'NotGreaterTilde': '≵', 'NotHumpDownHump': '≎̸', 'NotHumpEqual': '≏̸', 'notin': '∉', 'notindot': '⋵̸', 'notinE': '⋹̸', 'notinva': '∉', 'notinvb': '⋷', 'notinvc': '⋶', 'NotLeftTriangleBar': '⧏̸', 'NotLeftTriangle': '⋪', 'NotLeftTriangleEqual': '⋬', 'NotLess': '≮', 'NotLessEqual': '≰', 'NotLessGreater': '≸', 'NotLessLess': '≪̸', 'NotLessSlantEqual': '⩽̸', 'NotLessTilde': '≴', 'NotNestedGreaterGreater': '⪢̸', 'NotNestedLessLess': '⪡̸', 'notni': '∌', 'notniva': '∌', 'notnivb': '⋾', 'notnivc': '⋽', 'NotPrecedes': '⊀', 'NotPrecedesEqual': '⪯̸', 'NotPrecedesSlantEqual': '⋠', 'NotReverseElement': '∌', 'NotRightTriangleBar': '⧐̸', 'NotRightTriangle': '⋫', 'NotRightTriangleEqual': '⋭', 'NotSquareSubset': '⊏̸', 'NotSquareSubsetEqual': '⋢', 'NotSquareSuperset': '⊐̸', 'NotSquareSupersetEqual': '⋣', 'NotSubset': '⊂⃒', 'NotSubsetEqual': '⊈', 'NotSucceeds': '⊁', 'NotSucceedsEqual': '⪰̸', 'NotSucceedsSlantEqual': '⋡', 'NotSucceedsTilde': '≿̸', 'NotSuperset': '⊃⃒', 'NotSupersetEqual': '⊉', 'NotTilde': '≁', 'NotTildeEqual': '≄', 'NotTildeFullEqual': '≇', 'NotTildeTilde': '≉', 'NotVerticalBar': '∤', 'nparallel': '∦', 'npar': '∦', 'nparsl': '⫽⃥', 'npart': '∂̸', 'npolint': '⨔', 'npr': '⊀', 'nprcue': '⋠', 'nprec': '⊀', 'npreceq': '⪯̸', 'npre': '⪯̸', 'nrarrc': '⤳̸', 'nrarr': '↛', 'nrArr': '⇏', 'nrarrw': '↝̸', 'nrightarrow': '↛', 'nRightarrow': '⇏', 'nrtri': '⋫', 'nrtrie': '⋭', 'nsc': '⊁', 'nsccue': '⋡', 'nsce': '⪰̸', 'Nscr': '𝒩', 'nscr': '𝓃', 'nshortmid': '∤', 'nshortparallel': '∦', 'nsim': '≁', 'nsime': '≄', 'nsimeq': '≄', 'nsmid': '∤', 'nspar': '∦', 'nsqsube': '⋢', 'nsqsupe': '⋣', 'nsub': '⊄', 'nsubE': '⫅̸', 'nsube': '⊈', 'nsubset': '⊂⃒', 'nsubseteq': '⊈', 'nsubseteqq': '⫅̸', 'nsucc': '⊁', 'nsucceq': '⪰̸', 'nsup': '⊅', 'nsupE': '⫆̸', 'nsupe': '⊉', 'nsupset': '⊃⃒', 'nsupseteq': '⊉', 'nsupseteqq': '⫆̸', 'ntgl': '≹', 'Ntilde': '\xD1', 'ntilde': '\xF1', 'ntlg': '≸', 'ntriangleleft': '⋪', 'ntrianglelefteq': '⋬', 'ntriangleright': '⋫', 'ntrianglerighteq': '⋭', 'Nu': 'Ν', 'nu': 'ν', 'num': '#', 'numero': '№', 'numsp': ' ', 'nvap': '≍⃒', 'nvdash': '⊬', 'nvDash': '⊭', 'nVdash': '⊮', 'nVDash': '⊯', 'nvge': '≥⃒', 'nvgt': '>⃒', 'nvHarr': '⤄', 'nvinfin': '⧞', 'nvlArr': '⤂', 'nvle': '≤⃒', 'nvlt': '<⃒', 'nvltrie': '⊴⃒', 'nvrArr': '⤃', 'nvrtrie': '⊵⃒', 'nvsim': '∼⃒', 'nwarhk': '⤣', 'nwarr': '↖', 'nwArr': '⇖', 'nwarrow': '↖', 'nwnear': '⤧', 'Oacute': '\xD3', 'oacute': '\xF3', 'oast': '⊛', 'Ocirc': '\xD4', 'ocirc': '\xF4', 'ocir': '⊚', 'Ocy': 'О', 'ocy': 'о', 'odash': '⊝', 'Odblac': 'Ő', 'odblac': 'ő', 'odiv': '⨸', 'odot': '⊙', 'odsold': '⦼', 'OElig': 'Œ', 'oelig': 'œ', 'ofcir': '⦿', 'Ofr': '𝔒', 'ofr': '𝔬', 'ogon': '˛', 'Ograve': '\xD2', 'ograve': '\xF2', 'ogt': '⧁', 'ohbar': '⦵', 'ohm': 'Ω', 'oint': '∮', 'olarr': '↺', 'olcir': '⦾', 'olcross': '⦻', 'oline': '‾', 'olt': '⧀', 'Omacr': 'Ō', 'omacr': 'ō', 'Omega': 'Ω', 'omega': 'ω', 'Omicron': 'Ο', 'omicron': 'ο', 'omid': '⦶', 'ominus': '⊖', 'Oopf': '𝕆', 'oopf': '𝕠', 'opar': '⦷', 'OpenCurlyDoubleQuote': '“', 'OpenCurlyQuote': '‘', 'operp': '⦹', 'oplus': '⊕', 'orarr': '↻', 'Or': '⩔', 'or': '∨', 'ord': '⩝', 'order': 'ℴ', 'orderof': 'ℴ', 'ordf': '\xAA', 'ordm': '\xBA', 'origof': '⊶', 'oror': '⩖', 'orslope': '⩗', 'orv': '⩛', 'oS': 'Ⓢ', 'Oscr': '𝒪', 'oscr': 'ℴ', 'Oslash': '\xD8', 'oslash': '\xF8', 'osol': '⊘', 'Otilde': '\xD5', 'otilde': '\xF5', 'otimesas': '⨶', 'Otimes': '⨷', 'otimes': '⊗', 'Ouml': '\xD6', 'ouml': '\xF6', 'ovbar': '⌽', 'OverBar': '‾', 'OverBrace': '⏞', 'OverBracket': '⎴', 'OverParenthesis': '⏜', 'para': '\xB6', 'parallel': '∥', 'par': '∥', 'parsim': '⫳', 'parsl': '⫽', 'part': '∂', 'PartialD': '∂', 'Pcy': 'П', 'pcy': 'п', 'percnt': '%', 'period': '.', 'permil': '‰', 'perp': '⊥', 'pertenk': '‱', 'Pfr': '𝔓', 'pfr': '𝔭', 'Phi': 'Φ', 'phi': 'φ', 'phiv': 'ϕ', 'phmmat': 'ℳ', 'phone': '☎', 'Pi': 'Π', 'pi': 'π', 'pitchfork': '⋔', 'piv': 'ϖ', 'planck': 'ℏ', 'planckh': 'ℎ', 'plankv': 'ℏ', 'plusacir': '⨣', 'plusb': '⊞', 'pluscir': '⨢', 'plus': '+', 'plusdo': '∔', 'plusdu': '⨥', 'pluse': '⩲', 'PlusMinus': '\xB1', 'plusmn': '\xB1', 'plussim': '⨦', 'plustwo': '⨧', 'pm': '\xB1', 'Poincareplane': 'ℌ', 'pointint': '⨕', 'popf': '𝕡', 'Popf': 'ℙ', 'pound': '\xA3', 'prap': '⪷', 'Pr': '⪻', 'pr': '≺', 'prcue': '≼', 'precapprox': '⪷', 'prec': '≺', 'preccurlyeq': '≼', 'Precedes': '≺', 'PrecedesEqual': '⪯', 'PrecedesSlantEqual': '≼', 'PrecedesTilde': '≾', 'preceq': '⪯', 'precnapprox': '⪹', 'precneqq': '⪵', 'precnsim': '⋨', 'pre': '⪯', 'prE': '⪳', 'precsim': '≾', 'prime': '′', 'Prime': '″', 'primes': 'ℙ', 'prnap': '⪹', 'prnE': '⪵', 'prnsim': '⋨', 'prod': '∏', 'Product': '∏', 'profalar': '⌮', 'profline': '⌒', 'profsurf': '⌓', 'prop': '∝', 'Proportional': '∝', 'Proportion': '∷', 'propto': '∝', 'prsim': '≾', 'prurel': '⊰', 'Pscr': '𝒫', 'pscr': '𝓅', 'Psi': 'Ψ', 'psi': 'ψ', 'puncsp': ' ', 'Qfr': '𝔔', 'qfr': '𝔮', 'qint': '⨌', 'qopf': '𝕢', 'Qopf': 'ℚ', 'qprime': '⁗', 'Qscr': '𝒬', 'qscr': '𝓆', 'quaternions': 'ℍ', 'quatint': '⨖', 'quest': '?', 'questeq': '≟', 'quot': '"', 'QUOT': '"', 'rAarr': '⇛', 'race': '∽̱', 'Racute': 'Ŕ', 'racute': 'ŕ', 'radic': '√', 'raemptyv': '⦳', 'rang': '⟩', 'Rang': '⟫', 'rangd': '⦒', 'range': '⦥', 'rangle': '⟩', 'raquo': '\xBB', 'rarrap': '⥵', 'rarrb': '⇥', 'rarrbfs': '⤠', 'rarrc': '⤳', 'rarr': '→', 'Rarr': '↠', 'rArr': '⇒', 'rarrfs': '⤞', 'rarrhk': '↪', 'rarrlp': '↬', 'rarrpl': '⥅', 'rarrsim': '⥴', 'Rarrtl': '⤖', 'rarrtl': '↣', 'rarrw': '↝', 'ratail': '⤚', 'rAtail': '⤜', 'ratio': '∶', 'rationals': 'ℚ', 'rbarr': '⤍', 'rBarr': '⤏', 'RBarr': '⤐', 'rbbrk': '❳', 'rbrace': '}', 'rbrack': ']', 'rbrke': '⦌', 'rbrksld': '⦎', 'rbrkslu': '⦐', 'Rcaron': 'Ř', 'rcaron': 'ř', 'Rcedil': 'Ŗ', 'rcedil': 'ŗ', 'rceil': '⌉', 'rcub': '}', 'Rcy': 'Р', 'rcy': 'р', 'rdca': '⤷', 'rdldhar': '⥩', 'rdquo': '”', 'rdquor': '”', 'rdsh': '↳', 'real': 'ℜ', 'realine': 'ℛ', 'realpart': 'ℜ', 'reals': 'ℝ', 'Re': 'ℜ', 'rect': '▭', 'reg': '\xAE', 'REG': '\xAE', 'ReverseElement': '∋', 'ReverseEquilibrium': '⇋', 'ReverseUpEquilibrium': '⥯', 'rfisht': '⥽', 'rfloor': '⌋', 'rfr': '𝔯', 'Rfr': 'ℜ', 'rHar': '⥤', 'rhard': '⇁', 'rharu': '⇀', 'rharul': '⥬', 'Rho': 'Ρ', 'rho': 'ρ', 'rhov': 'ϱ', 'RightAngleBracket': '⟩', 'RightArrowBar': '⇥', 'rightarrow': '→', 'RightArrow': '→', 'Rightarrow': '⇒', 'RightArrowLeftArrow': '⇄', 'rightarrowtail': '↣', 'RightCeiling': '⌉', 'RightDoubleBracket': '⟧', 'RightDownTeeVector': '⥝', 'RightDownVectorBar': '⥕', 'RightDownVector': '⇂', 'RightFloor': '⌋', 'rightharpoondown': '⇁', 'rightharpoonup': '⇀', 'rightleftarrows': '⇄', 'rightleftharpoons': '⇌', 'rightrightarrows': '⇉', 'rightsquigarrow': '↝', 'RightTeeArrow': '↦', 'RightTee': '⊢', 'RightTeeVector': '⥛', 'rightthreetimes': '⋌', 'RightTriangleBar': '⧐', 'RightTriangle': '⊳', 'RightTriangleEqual': '⊵', 'RightUpDownVector': '⥏', 'RightUpTeeVector': '⥜', 'RightUpVectorBar': '⥔', 'RightUpVector': '↾', 'RightVectorBar': '⥓', 'RightVector': '⇀', 'ring': '˚', 'risingdotseq': '≓', 'rlarr': '⇄', 'rlhar': '⇌', 'rlm': '‏', 'rmoustache': '⎱', 'rmoust': '⎱', 'rnmid': '⫮', 'roang': '⟭', 'roarr': '⇾', 'robrk': '⟧', 'ropar': '⦆', 'ropf': '𝕣', 'Ropf': 'ℝ', 'roplus': '⨮', 'rotimes': '⨵', 'RoundImplies': '⥰', 'rpar': ')', 'rpargt': '⦔', 'rppolint': '⨒', 'rrarr': '⇉', 'Rrightarrow': '⇛', 'rsaquo': '›', 'rscr': '𝓇', 'Rscr': 'ℛ', 'rsh': '↱', 'Rsh': '↱', 'rsqb': ']', 'rsquo': '’', 'rsquor': '’', 'rthree': '⋌', 'rtimes': '⋊', 'rtri': '▹', 'rtrie': '⊵', 'rtrif': '▸', 'rtriltri': '⧎', 'RuleDelayed': '⧴', 'ruluhar': '⥨', 'rx': '℞', 'Sacute': 'Ś', 'sacute': 'ś', 'sbquo': '‚', 'scap': '⪸', 'Scaron': 'Š', 'scaron': 'š', 'Sc': '⪼', 'sc': '≻', 'sccue': '≽', 'sce': '⪰', 'scE': '⪴', 'Scedil': 'Ş', 'scedil': 'ş', 'Scirc': 'Ŝ', 'scirc': 'ŝ', 'scnap': '⪺', 'scnE': '⪶', 'scnsim': '⋩', 'scpolint': '⨓', 'scsim': '≿', 'Scy': 'С', 'scy': 'с', 'sdotb': '⊡', 'sdot': '⋅', 'sdote': '⩦', 'searhk': '⤥', 'searr': '↘', 'seArr': '⇘', 'searrow': '↘', 'sect': '\xA7', 'semi': ';', 'seswar': '⤩', 'setminus': '∖', 'setmn': '∖', 'sext': '✶', 'Sfr': '𝔖', 'sfr': '𝔰', 'sfrown': '⌢', 'sharp': '♯', 'SHCHcy': 'Щ', 'shchcy': 'щ', 'SHcy': 'Ш', 'shcy': 'ш', 'ShortDownArrow': '↓', 'ShortLeftArrow': '←', 'shortmid': '∣', 'shortparallel': '∥', 'ShortRightArrow': '→', 'ShortUpArrow': '↑', 'shy': '\xAD', 'Sigma': 'Σ', 'sigma': 'σ', 'sigmaf': 'ς', 'sigmav': 'ς', 'sim': '∼', 'simdot': '⩪', 'sime': '≃', 'simeq': '≃', 'simg': '⪞', 'simgE': '⪠', 'siml': '⪝', 'simlE': '⪟', 'simne': '≆', 'simplus': '⨤', 'simrarr': '⥲', 'slarr': '←', 'SmallCircle': '∘', 'smallsetminus': '∖', 'smashp': '⨳', 'smeparsl': '⧤', 'smid': '∣', 'smile': '⌣', 'smt': '⪪', 'smte': '⪬', 'smtes': '⪬︀', 'SOFTcy': 'Ь', 'softcy': 'ь', 'solbar': '⌿', 'solb': '⧄', 'sol': '/', 'Sopf': '𝕊', 'sopf': '𝕤', 'spades': '♠', 'spadesuit': '♠', 'spar': '∥', 'sqcap': '⊓', 'sqcaps': '⊓︀', 'sqcup': '⊔', 'sqcups': '⊔︀', 'Sqrt': '√', 'sqsub': '⊏', 'sqsube': '⊑', 'sqsubset': '⊏', 'sqsubseteq': '⊑', 'sqsup': '⊐', 'sqsupe': '⊒', 'sqsupset': '⊐', 'sqsupseteq': '⊒', 'square': '□', 'Square': '□', 'SquareIntersection': '⊓', 'SquareSubset': '⊏', 'SquareSubsetEqual': '⊑', 'SquareSuperset': '⊐', 'SquareSupersetEqual': '⊒', 'SquareUnion': '⊔', 'squarf': '▪', 'squ': '□', 'squf': '▪', 'srarr': '→', 'Sscr': '𝒮', 'sscr': '𝓈', 'ssetmn': '∖', 'ssmile': '⌣', 'sstarf': '⋆', 'Star': '⋆', 'star': '☆', 'starf': '★', 'straightepsilon': 'ϵ', 'straightphi': 'ϕ', 'strns': '\xAF', 'sub': '⊂', 'Sub': '⋐', 'subdot': '⪽', 'subE': '⫅', 'sube': '⊆', 'subedot': '⫃', 'submult': '⫁', 'subnE': '⫋', 'subne': '⊊', 'subplus': '⪿', 'subrarr': '⥹', 'subset': '⊂', 'Subset': '⋐', 'subseteq': '⊆', 'subseteqq': '⫅', 'SubsetEqual': '⊆', 'subsetneq': '⊊', 'subsetneqq': '⫋', 'subsim': '⫇', 'subsub': '⫕', 'subsup': '⫓', 'succapprox': '⪸', 'succ': '≻', 'succcurlyeq': '≽', 'Succeeds': '≻', 'SucceedsEqual': '⪰', 'SucceedsSlantEqual': '≽', 'SucceedsTilde': '≿', 'succeq': '⪰', 'succnapprox': '⪺', 'succneqq': '⪶', 'succnsim': '⋩', 'succsim': '≿', 'SuchThat': '∋', 'sum': '∑', 'Sum': '∑', 'sung': '♪', 'sup1': '\xB9', 'sup2': '\xB2', 'sup3': '\xB3', 'sup': '⊃', 'Sup': '⋑', 'supdot': '⪾', 'supdsub': '⫘', 'supE': '⫆', 'supe': '⊇', 'supedot': '⫄', 'Superset': '⊃', 'SupersetEqual': '⊇', 'suphsol': '⟉', 'suphsub': '⫗', 'suplarr': '⥻', 'supmult': '⫂', 'supnE': '⫌', 'supne': '⊋', 'supplus': '⫀', 'supset': '⊃', 'Supset': '⋑', 'supseteq': '⊇', 'supseteqq': '⫆', 'supsetneq': '⊋', 'supsetneqq': '⫌', 'supsim': '⫈', 'supsub': '⫔', 'supsup': '⫖', 'swarhk': '⤦', 'swarr': '↙', 'swArr': '⇙', 'swarrow': '↙', 'swnwar': '⤪', 'szlig': '\xDF', 'Tab': '\t', 'target': '⌖', 'Tau': 'Τ', 'tau': 'τ', 'tbrk': '⎴', 'Tcaron': 'Ť', 'tcaron': 'ť', 'Tcedil': 'Ţ', 'tcedil': 'ţ', 'Tcy': 'Т', 'tcy': 'т', 'tdot': '⃛', 'telrec': '⌕', 'Tfr': '𝔗', 'tfr': '𝔱', 'there4': '∴', 'therefore': '∴', 'Therefore': '∴', 'Theta': 'Θ', 'theta': 'θ', 'thetasym': 'ϑ', 'thetav': 'ϑ', 'thickapprox': '≈', 'thicksim': '∼', 'ThickSpace': '  ', 'ThinSpace': ' ', 'thinsp': ' ', 'thkap': '≈', 'thksim': '∼', 'THORN': '\xDE', 'thorn': '\xFE', 'tilde': '˜', 'Tilde': '∼', 'TildeEqual': '≃', 'TildeFullEqual': '≅', 'TildeTilde': '≈', 'timesbar': '⨱', 'timesb': '⊠', 'times': '\xD7', 'timesd': '⨰', 'tint': '∭', 'toea': '⤨', 'topbot': '⌶', 'topcir': '⫱', 'top': '⊤', 'Topf': '𝕋', 'topf': '𝕥', 'topfork': '⫚', 'tosa': '⤩', 'tprime': '‴', 'trade': '™', 'TRADE': '™', 'triangle': '▵', 'triangledown': '▿', 'triangleleft': '◃', 'trianglelefteq': '⊴', 'triangleq': '≜', 'triangleright': '▹', 'trianglerighteq': '⊵', 'tridot': '◬', 'trie': '≜', 'triminus': '⨺', 'TripleDot': '⃛', 'triplus': '⨹', 'trisb': '⧍', 'tritime': '⨻', 'trpezium': '⏢', 'Tscr': '𝒯', 'tscr': '𝓉', 'TScy': 'Ц', 'tscy': 'ц', 'TSHcy': 'Ћ', 'tshcy': 'ћ', 'Tstrok': 'Ŧ', 'tstrok': 'ŧ', 'twixt': '≬', 'twoheadleftarrow': '↞', 'twoheadrightarrow': '↠', 'Uacute': '\xDA', 'uacute': '\xFA', 'uarr': '↑', 'Uarr': '↟', 'uArr': '⇑', 'Uarrocir': '⥉', 'Ubrcy': 'Ў', 'ubrcy': 'ў', 'Ubreve': 'Ŭ', 'ubreve': 'ŭ', 'Ucirc': '\xDB', 'ucirc': '\xFB', 'Ucy': 'У', 'ucy': 'у', 'udarr': '⇅', 'Udblac': 'Ű', 'udblac': 'ű', 'udhar': '⥮', 'ufisht': '⥾', 'Ufr': '𝔘', 'ufr': '𝔲', 'Ugrave': '\xD9', 'ugrave': '\xF9', 'uHar': '⥣', 'uharl': '↿', 'uharr': '↾', 'uhblk': '▀', 'ulcorn': '⌜', 'ulcorner': '⌜', 'ulcrop': '⌏', 'ultri': '◸', 'Umacr': 'Ū', 'umacr': 'ū', 'uml': '\xA8', 'UnderBar': '_', 'UnderBrace': '⏟', 'UnderBracket': '⎵', 'UnderParenthesis': '⏝', 'Union': '⋃', 'UnionPlus': '⊎', 'Uogon': 'Ų', 'uogon': 'ų', 'Uopf': '𝕌', 'uopf': '𝕦', 'UpArrowBar': '⤒', 'uparrow': '↑', 'UpArrow': '↑', 'Uparrow': '⇑', 'UpArrowDownArrow': '⇅', 'updownarrow': '↕', 'UpDownArrow': '↕', 'Updownarrow': '⇕', 'UpEquilibrium': '⥮', 'upharpoonleft': '↿', 'upharpoonright': '↾', 'uplus': '⊎', 'UpperLeftArrow': '↖', 'UpperRightArrow': '↗', 'upsi': 'υ', 'Upsi': 'ϒ', 'upsih': 'ϒ', 'Upsilon': 'Υ', 'upsilon': 'υ', 'UpTeeArrow': '↥', 'UpTee': '⊥', 'upuparrows': '⇈', 'urcorn': '⌝', 'urcorner': '⌝', 'urcrop': '⌎', 'Uring': 'Ů', 'uring': 'ů', 'urtri': '◹', 'Uscr': '𝒰', 'uscr': '𝓊', 'utdot': '⋰', 'Utilde': 'Ũ', 'utilde': 'ũ', 'utri': '▵', 'utrif': '▴', 'uuarr': '⇈', 'Uuml': '\xDC', 'uuml': '\xFC', 'uwangle': '⦧', 'vangrt': '⦜', 'varepsilon': 'ϵ', 'varkappa': 'ϰ', 'varnothing': '∅', 'varphi': 'ϕ', 'varpi': 'ϖ', 'varpropto': '∝', 'varr': '↕', 'vArr': '⇕', 'varrho': 'ϱ', 'varsigma': 'ς', 'varsubsetneq': '⊊︀', 'varsubsetneqq': '⫋︀', 'varsupsetneq': '⊋︀', 'varsupsetneqq': '⫌︀', 'vartheta': 'ϑ', 'vartriangleleft': '⊲', 'vartriangleright': '⊳', 'vBar': '⫨', 'Vbar': '⫫', 'vBarv': '⫩', 'Vcy': 'В', 'vcy': 'в', 'vdash': '⊢', 'vDash': '⊨', 'Vdash': '⊩', 'VDash': '⊫', 'Vdashl': '⫦', 'veebar': '⊻', 'vee': '∨', 'Vee': '⋁', 'veeeq': '≚', 'vellip': '⋮', 'verbar': '|', 'Verbar': '‖', 'vert': '|', 'Vert': '‖', 'VerticalBar': '∣', 'VerticalLine': '|', 'VerticalSeparator': '❘', 'VerticalTilde': '≀', 'VeryThinSpace': ' ', 'Vfr': '𝔙', 'vfr': '𝔳', 'vltri': '⊲', 'vnsub': '⊂⃒', 'vnsup': '⊃⃒', 'Vopf': '𝕍', 'vopf': '𝕧', 'vprop': '∝', 'vrtri': '⊳', 'Vscr': '𝒱', 'vscr': '𝓋', 'vsubnE': '⫋︀', 'vsubne': '⊊︀', 'vsupnE': '⫌︀', 'vsupne': '⊋︀', 'Vvdash': '⊪', 'vzigzag': '⦚', 'Wcirc': 'Ŵ', 'wcirc': 'ŵ', 'wedbar': '⩟', 'wedge': '∧', 'Wedge': '⋀', 'wedgeq': '≙', 'weierp': '℘', 'Wfr': '𝔚', 'wfr': '𝔴', 'Wopf': '𝕎', 'wopf': '𝕨', 'wp': '℘', 'wr': '≀', 'wreath': '≀', 'Wscr': '𝒲', 'wscr': '𝓌', 'xcap': '⋂', 'xcirc': '◯', 'xcup': '⋃', 'xdtri': '▽', 'Xfr': '𝔛', 'xfr': '𝔵', 'xharr': '⟷', 'xhArr': '⟺', 'Xi': 'Ξ', 'xi': 'ξ', 'xlarr': '⟵', 'xlArr': '⟸', 'xmap': '⟼', 'xnis': '⋻', 'xodot': '⨀', 'Xopf': '𝕏', 'xopf': '𝕩', 'xoplus': '⨁', 'xotime': '⨂', 'xrarr': '⟶', 'xrArr': '⟹', 'Xscr': '𝒳', 'xscr': '𝓍', 'xsqcup': '⨆', 'xuplus': '⨄', 'xutri': '△', 'xvee': '⋁', 'xwedge': '⋀', 'Yacute': '\xDD', 'yacute': '\xFD', 'YAcy': 'Я', 'yacy': 'я', 'Ycirc': 'Ŷ', 'ycirc': 'ŷ', 'Ycy': 'Ы', 'ycy': 'ы', 'yen': '\xA5', 'Yfr': '𝔜', 'yfr': '𝔶', 'YIcy': 'Ї', 'yicy': 'ї', 'Yopf': '𝕐', 'yopf': '𝕪', 'Yscr': '𝒴', 'yscr': '𝓎', 'YUcy': 'Ю', 'yucy': 'ю', 'yuml': '\xFF', 'Yuml': 'Ÿ', 'Zacute': 'Ź', 'zacute': 'ź', 'Zcaron': 'Ž', 'zcaron': 'ž', 'Zcy': 'З', 'zcy': 'з', 'Zdot': 'Ż', 'zdot': 'ż', 'zeetrf': 'ℨ', 'ZeroWidthSpace': '​', 'Zeta': 'Ζ', 'zeta': 'ζ', 'zfr': '𝔷', 'Zfr': 'ℨ', 'ZHcy': 'Ж', 'zhcy': 'ж', 'zigrarr': '⇝', 'zopf': '𝕫', 'Zopf': 'ℤ', 'Zscr': '𝒵', 'zscr': '𝓏', 'zwj': '‍', 'zwnj': '‌' };
	var decodeMapLegacy = { 'Aacute': '\xC1', 'aacute': '\xE1', 'Acirc': '\xC2', 'acirc': '\xE2', 'acute': '\xB4', 'AElig': '\xC6', 'aelig': '\xE6', 'Agrave': '\xC0', 'agrave': '\xE0', 'amp': '&', 'AMP': '&', 'Aring': '\xC5', 'aring': '\xE5', 'Atilde': '\xC3', 'atilde': '\xE3', 'Auml': '\xC4', 'auml': '\xE4', 'brvbar': '\xA6', 'Ccedil': '\xC7', 'ccedil': '\xE7', 'cedil': '\xB8', 'cent': '\xA2', 'copy': '\xA9', 'COPY': '\xA9', 'curren': '\xA4', 'deg': '\xB0', 'divide': '\xF7', 'Eacute': '\xC9', 'eacute': '\xE9', 'Ecirc': '\xCA', 'ecirc': '\xEA', 'Egrave': '\xC8', 'egrave': '\xE8', 'ETH': '\xD0', 'eth': '\xF0', 'Euml': '\xCB', 'euml': '\xEB', 'frac12': '\xBD', 'frac14': '\xBC', 'frac34': '\xBE', 'gt': '>', 'GT': '>', 'Iacute': '\xCD', 'iacute': '\xED', 'Icirc': '\xCE', 'icirc': '\xEE', 'iexcl': '\xA1', 'Igrave': '\xCC', 'igrave': '\xEC', 'iquest': '\xBF', 'Iuml': '\xCF', 'iuml': '\xEF', 'laquo': '\xAB', 'lt': '<', 'LT': '<', 'macr': '\xAF', 'micro': '\xB5', 'middot': '\xB7', 'nbsp': '\xA0', 'not': '\xAC', 'Ntilde': '\xD1', 'ntilde': '\xF1', 'Oacute': '\xD3', 'oacute': '\xF3', 'Ocirc': '\xD4', 'ocirc': '\xF4', 'Ograve': '\xD2', 'ograve': '\xF2', 'ordf': '\xAA', 'ordm': '\xBA', 'Oslash': '\xD8', 'oslash': '\xF8', 'Otilde': '\xD5', 'otilde': '\xF5', 'Ouml': '\xD6', 'ouml': '\xF6', 'para': '\xB6', 'plusmn': '\xB1', 'pound': '\xA3', 'quot': '"', 'QUOT': '"', 'raquo': '\xBB', 'reg': '\xAE', 'REG': '\xAE', 'sect': '\xA7', 'shy': '\xAD', 'sup1': '\xB9', 'sup2': '\xB2', 'sup3': '\xB3', 'szlig': '\xDF', 'THORN': '\xDE', 'thorn': '\xFE', 'times': '\xD7', 'Uacute': '\xDA', 'uacute': '\xFA', 'Ucirc': '\xDB', 'ucirc': '\xFB', 'Ugrave': '\xD9', 'ugrave': '\xF9', 'uml': '\xA8', 'Uuml': '\xDC', 'uuml': '\xFC', 'Yacute': '\xDD', 'yacute': '\xFD', 'yen': '\xA5', 'yuml': '\xFF' };
	var decodeMapNumeric = { '0': '�', '128': '€', '130': '‚', '131': 'ƒ', '132': '„', '133': '…', '134': '†', '135': '‡', '136': 'ˆ', '137': '‰', '138': 'Š', '139': '‹', '140': 'Œ', '142': 'Ž', '145': '‘', '146': '’', '147': '“', '148': '”', '149': '•', '150': '–', '151': '—', '152': '˜', '153': '™', '154': 'š', '155': '›', '156': 'œ', '158': 'ž', '159': 'Ÿ' };
	var invalidReferenceCodePoints = [1, 2, 3, 4, 5, 6, 7, 8, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 64976, 64977, 64978, 64979, 64980, 64981, 64982, 64983, 64984, 64985, 64986, 64987, 64988, 64989, 64990, 64991, 64992, 64993, 64994, 64995, 64996, 64997, 64998, 64999, 65000, 65001, 65002, 65003, 65004, 65005, 65006, 65007, 65534, 65535, 131070, 131071, 196606, 196607, 262142, 262143, 327678, 327679, 393214, 393215, 458750, 458751, 524286, 524287, 589822, 589823, 655358, 655359, 720894, 720895, 786430, 786431, 851966, 851967, 917502, 917503, 983038, 983039, 1048574, 1048575, 1114110, 1114111];

	/*--------------------------------------------------------------------------*/

	var stringFromCharCode = String.fromCharCode;

	var object = {};
	var hasOwnProperty = object.hasOwnProperty;
	var has = function has(object, propertyName) {
		return hasOwnProperty.call(object, propertyName);
	};

	var contains = function contains(array, value) {
		var index = -1;
		var length = array.length;
		while (++index < length) {
			if (array[index] == value) {
				return true;
			}
		}
		return false;
	};

	var merge = function merge(options, defaults) {
		if (!options) {
			return defaults;
		}
		var result = {};
		var key;
		for (key in defaults) {
			// A `hasOwnProperty` check is not needed here, since only recognized
			// option names are used anyway. Any others are ignored.
			result[key] = has(options, key) ? options[key] : defaults[key];
		}
		return result;
	};

	// Modified version of `ucs2encode`; see http://mths.be/punycode.
	var codePointToSymbol = function codePointToSymbol(codePoint, strict) {
		var output = '';
		if (codePoint >= 0xD800 && codePoint <= 0xDFFF || codePoint > 0x10FFFF) {
			// See issue #4:
			// “Otherwise, if the number is in the range 0xD800 to 0xDFFF or is
			// greater than 0x10FFFF, then this is a parse error. Return a U+FFFD
			// REPLACEMENT CHARACTER.”
			if (strict) {
				parseError('character reference outside the permissible Unicode range');
			}
			return '�';
		}
		if (has(decodeMapNumeric, codePoint)) {
			if (strict) {
				parseError('disallowed character reference');
			}
			return decodeMapNumeric[codePoint];
		}
		if (strict && contains(invalidReferenceCodePoints, codePoint)) {
			parseError('disallowed character reference');
		}
		if (codePoint > 0xFFFF) {
			codePoint -= 0x10000;
			output += stringFromCharCode(codePoint >>> 10 & 0x3FF | 0xD800);
			codePoint = 0xDC00 | codePoint & 0x3FF;
		}
		output += stringFromCharCode(codePoint);
		return output;
	};

	var hexEscape = function hexEscape(symbol) {
		return '&#x' + symbol.charCodeAt(0).toString(16).toUpperCase() + ';';
	};

	var parseError = function parseError(message) {
		throw Error('Parse error: ' + message);
	};

	/*--------------------------------------------------------------------------*/

	var encode = function encode(string, options) {
		options = merge(options, encode.options);
		var strict = options.strict;
		if (strict && regexInvalidRawCodePoint.test(string)) {
			parseError('forbidden code point');
		}
		var encodeEverything = options.encodeEverything;
		var useNamedReferences = options.useNamedReferences;
		var allowUnsafeSymbols = options.allowUnsafeSymbols;
		if (encodeEverything) {
			// Encode ASCII symbols.
			string = string.replace(regexAsciiWhitelist, function (symbol) {
				// Use named references if requested & possible.
				if (useNamedReferences && has(encodeMap, symbol)) {
					return '&' + encodeMap[symbol] + ';';
				}
				return hexEscape(symbol);
			});
			// Shorten a few escapes that represent two symbols, of which at least one
			// is within the ASCII range.
			if (useNamedReferences) {
				string = string.replace(/&gt;\u20D2/g, '&nvgt;').replace(/&lt;\u20D2/g, '&nvlt;').replace(/&#x66;&#x6A;/g, '&fjlig;');
			}
			// Encode non-ASCII symbols.
			if (useNamedReferences) {
				// Encode non-ASCII symbols that can be replaced with a named reference.
				string = string.replace(regexEncodeNonAscii, function (string) {
					// Note: there is no need to check `has(encodeMap, string)` here.
					return '&' + encodeMap[string] + ';';
				});
			}
			// Note: any remaining non-ASCII symbols are handled outside of the `if`.
		} else if (useNamedReferences) {
				// Apply named character references.
				// Encode `<>"'&` using named character references.
				if (!allowUnsafeSymbols) {
					string = string.replace(regexEscape, function (string) {
						return '&' + encodeMap[string] + ';'; // no need to check `has()` here
					});
				}
				// Shorten escapes that represent two symbols, of which at least one is
				// `<>"'&`.
				string = string.replace(/&gt;\u20D2/g, '&nvgt;').replace(/&lt;\u20D2/g, '&nvlt;');
				// Encode non-ASCII symbols that can be replaced with a named reference.
				string = string.replace(regexEncodeNonAscii, function (string) {
					// Note: there is no need to check `has(encodeMap, string)` here.
					return '&' + encodeMap[string] + ';';
				});
			} else if (!allowUnsafeSymbols) {
				// Encode `<>"'&` using hexadecimal escapes, now that they’re not handled
				// using named character references.
				string = string.replace(regexEscape, hexEscape);
			}
		return string
		// Encode astral symbols.
		.replace(regexAstralSymbols, function ($0) {
			// https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
			var high = $0.charCodeAt(0);
			var low = $0.charCodeAt(1);
			var codePoint = (high - 0xD800) * 0x400 + low - 0xDC00 + 0x10000;
			return '&#x' + codePoint.toString(16).toUpperCase() + ';';
		})
		// Encode any remaining BMP symbols that are not printable ASCII symbols
		// using a hexadecimal escape.
		.replace(regexBmpWhitelist, hexEscape);
	};
	// Expose default options (so they can be overridden globally).
	encode.options = {
		'allowUnsafeSymbols': false,
		'encodeEverything': false,
		'strict': false,
		'useNamedReferences': false
	};

	var decode = function decode(html, options) {
		options = merge(options, decode.options);
		var strict = options.strict;
		if (strict && regexInvalidEntity.test(html)) {
			parseError('malformed character reference');
		}
		return html.replace(regexDecode, function ($0, $1, $2, $3, $4, $5, $6, $7) {
			var codePoint;
			var semicolon;
			var hexDigits;
			var reference;
			var next;
			if ($1) {
				// Decode decimal escapes, e.g. `&#119558;`.
				codePoint = $1;
				semicolon = $2;
				if (strict && !semicolon) {
					parseError('character reference was not terminated by a semicolon');
				}
				return codePointToSymbol(codePoint, strict);
			}
			if ($3) {
				// Decode hexadecimal escapes, e.g. `&#x1D306;`.
				hexDigits = $3;
				semicolon = $4;
				if (strict && !semicolon) {
					parseError('character reference was not terminated by a semicolon');
				}
				codePoint = parseInt(hexDigits, 16);
				return codePointToSymbol(codePoint, strict);
			}
			if ($5) {
				// Decode named character references with trailing `;`, e.g. `&copy;`.
				reference = $5;
				if (has(decodeMap, reference)) {
					return decodeMap[reference];
				} else {
					// Ambiguous ampersand; see http://mths.be/notes/ambiguous-ampersands.
					if (strict) {
						parseError('named character reference was not terminated by a semicolon');
					}
					return $0;
				}
			}
			// If we’re still here, it’s a legacy reference for sure. No need for an
			// extra `if` check.
			// Decode named character references without trailing `;`, e.g. `&amp`
			// This is only a parse error if it gets converted to `&`, or if it is
			// followed by `=` in an attribute context.
			reference = $6;
			next = $7;
			if (next && options.isAttributeValue) {
				if (strict && next == '=') {
					parseError('`&` did not start a character reference');
				}
				return $0;
			} else {
				if (strict) {
					parseError('named character reference was not terminated by a semicolon');
				}
				// Note: there is no need to check `has(decodeMapLegacy, reference)`.
				return decodeMapLegacy[reference] + (next || '');
			}
		});
	};
	// Expose default options (so they can be overridden globally).
	decode.options = {
		'isAttributeValue': false,
		'strict': false
	};

	var escape = function escape(string) {
		return string.replace(regexEscape, function ($0) {
			// Note: there is no need to check `has(escapeMap, $0)` here.
			return escapeMap[$0];
		});
	};

	/*--------------------------------------------------------------------------*/

	var he = {
		'version': '0.5.0',
		'encode': encode,
		'decode': decode,
		'escape': escape,
		'unescape': decode
	};

	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
		define(function () {
			return he;
		});
	} else if (freeExports && !freeExports.nodeType) {
		if (freeModule) {
			// in Node.js or RingoJS v0.8.0+
			freeModule.exports = he;
		} else {
			// in Narwhal or RingoJS v0.7.0-
			for (var key in he) {
				has(he, key) && (freeExports[key] = he[key]);
			}
		}
	} else {
		// in Rhino or a web browser
		root.he = he;
	}
})(undefined);
}, {}],
22: [function(require, module, exports) {
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
}, {}],
23: [function(require, module, exports) {
'use strict';

exports = module.exports = trim;

function trim(str) {
  if (str.trim) return str.trim();
  return str.replace(/^\s*|\s*$/g, '');
}

exports.left = function (str) {
  if (str.trimLeft) return str.trimLeft();
  return str.replace(/^\s*/, '');
};

exports.right = function (str) {
  if (str.trimRight) return str.trimRight();
  return str.replace(/\s*$/, '');
};
}, {}],
24: [function(require, module, exports) {
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

  while (value.charAt(--index) === LINE) {/* empty */}

  return value.slice(0, index + 1);
}

/*
 * Expose.
 */

module.exports = trimTrailingLines;
}, {}],
25: [function(require, module, exports) {
/**
 * Extend an object with another.
 *
 * @param {Object, ...} src, ...
 * @return {Object} merged
 * @api private
 */

"use strict";

module.exports = function (src) {
  var objs = [].slice.call(arguments, 1),
      obj;

  for (var i = 0, len = objs.length; i < len; i++) {
    obj = objs[i];
    for (var prop in obj) {
      src[prop] = obj[prop];
    }
  }

  return src;
};
}, {}],
26: [function(require, module, exports) {
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer
 * @license MIT
 * @module mdast:utilities
 * @fileoverview Collection of tiny helpers useful for
 *   both parsing and compiling markdown.
 */

'use strict';

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
    throw new Error('Invalid value `' + value + '` ' + 'for setting `' + name + '`');
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
    return String(value).replace(EXPRESSION_BOM, '').replace(EXPRESSION_LINE_BREAKS, '\n').replace(EXPRESSION_SYMBOL_FOR_NEW_LINE, '\n');
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
}, {"collapse-white-space":29}],
29: [function(require, module, exports) {
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
}, {}],
27: [function(require, module, exports) {
/* This file is generated by `script/build-expressions.js` */
'use strict';

module.exports = {
  'rules': {
    'newline': /^\n([ \t]*\n)*/,
    'code': /^((?: {4}|\t)[^\n]*\n?([ \t]*\n)*)+/,
    'horizontalRule': /^[ \t]*([-*_])( *\1){2,} *(?=\n|$)/,
    'heading': /^([ \t]*)(#{1,6})(?:([ \t]+)([^\n]+?))??(?:[ \t]+#+)?[ \t]*(?=\n|$)/,
    'lineHeading': /^(\ {0,3})([^\n]+?)[ \t]*\n\ {0,3}(=|-){1,}[ \t]*(?=\n|$)/,
    'definition': /^[ \t]*\[((?:[^\\](?:\\|\\(?:\\{2})+)\]|[^\]])+)\]:[ \t\n]*(<[^>\[\]]+>|[^\s\[\]]+)(?:[ \t\n]+['"(]((?:[^\n]|\n(?!\n))*?)['")])?[ \t]*(?=\n|$)/,
    'bullet': /(?:[*+-]|\d+\.)/,
    'indent': /^([ \t]*)((?:[*+-]|\d+\.))( {1,4}(?! )| |\t)/,
    'item': /([ \t]*)((?:[*+-]|\d+\.))( {1,4}(?! )| |\t)[^\n]*(?:\n(?!\1(?:[*+-]|\d+\.)[ \t])[^\n]*)*/gm,
    'list': /^([ \t]*)((?:[*+-]|\d+\.))[ \t][\s\S]+?(?:(?=\n+\1?(?:[-*_][ \t]*){3,}(?:\n|$))|(?=\n+[ \t]*\[((?:[^\\](?:\\|\\(?:\\{2})+)\]|[^\]])+)\]:[ \t\n]*(<[^>\[\]]+>|[^\s\[\]]+)(?:[ \t\n]+['"(]((?:[^\n]|\n(?!\n))*?)['")])?[ \t]*(?=\n|$))|\n{2,}(?![ \t])(?!\1(?:[*+-]|\d+\.)[ \t])|$)/,
    'blockquote': /^(?=[ \t]*>)(?:(?:(?:[ \t]*>[^\n]*\n)*(?:[ \t]*>[^\n]+(?=\n|$))|(?![ \t]*>)(?![ \t]*\[((?:[^\\](?:\\|\\(?:\\{2})+)\]|[^\]])+)\]:[ \t\n]*(<[^>\[\]]+>|[^\s\[\]]+)(?:[ \t\n]+['"(]((?:[^\n]|\n(?!\n))*?)['")])?[ \t]*(?=\n|$))[^\n]+)(?:\n|$))*(?:[ \t]*>[ \t]*(?:\n[ \t]*>[ \t]*)*)?/,
    'html': /^(?:[ \t]*(?:(?:(?:<(?:article|header|aside|hgroup|blockquote|hr|iframe|body|li|map|button|object|canvas|ol|caption|output|col|p|colgroup|pre|dd|progress|div|section|dl|table|td|dt|tbody|embed|textarea|fieldset|tfoot|figcaption|th|figure|thead|footer|tr|form|ul|h1|h2|h3|h4|h5|h6|video|script|style)(?:(?:\s+)(?:[a-zA-Z_:][a-zA-Z0-9_.:-]*)(?:(?:\s+)?=(?:\s+)?(?:[^"'=<>`]+|'[^']*'|"[^"]*"))?)*(?:\s+)?\/?>?)|(?:<\/(?:article|header|aside|hgroup|blockquote|hr|iframe|body|li|map|button|object|canvas|ol|caption|output|col|p|colgroup|pre|dd|progress|div|section|dl|table|td|dt|tbody|embed|textarea|fieldset|tfoot|figcaption|th|figure|thead|footer|tr|form|ul|h1|h2|h3|h4|h5|h6|video|script|style)(?:\s+)?>))|<!--[\s\S]*?-->|(?:<\?(?:[^\?]|\?(?!>))+\?>)|(?:<![a-zA-Z]+\s+[\s\S]+?>)|(?:<!\[CDATA\[[\s\S]+?\]\]>))[\s\S]*?[ \t]*?(?:\n{2,}|\s*$))/i,
    'paragraph': /^(?:(?:[^\n]+\n?(?![ \t]*([-*_])( *\1){2,} *(?=\n|$)|([ \t]*)(#{1,6})(?:([ \t]+)([^\n]+?))??(?:[ \t]+#+)?[ \t]*(?=\n|$)|(\ {0,3})([^\n]+?)[ \t]*\n\ {0,3}(=|-){1,}[ \t]*(?=\n|$)|[ \t]*\[((?:[^\\](?:\\|\\(?:\\{2})+)\]|[^\]])+)\]:[ \t\n]*(<[^>\[\]]+>|[^\s\[\]]+)(?:[ \t\n]+['"(]((?:[^\n]|\n(?!\n))*?)['")])?[ \t]*(?=\n|$)|(?=[ \t]*>)(?:(?:(?:[ \t]*>[^\n]*\n)*(?:[ \t]*>[^\n]+(?=\n|$))|(?![ \t]*>)(?![ \t]*\[((?:[^\\](?:\\|\\(?:\\{2})+)\]|[^\]])+)\]:[ \t\n]*(<[^>\[\]]+>|[^\s\[\]]+)(?:[ \t\n]+['"(]((?:[^\n]|\n(?!\n))*?)['")])?[ \t]*(?=\n|$))[^\n]+)(?:\n|$))*(?:[ \t]*>[ \t]*(?:\n[ \t]*>[ \t]*)*)?|<(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\b)(?!mailto:)\w+(?!:\/|[^\w\s@]*@)\b))+)/,
    'escape': /^\\([\\`*{}\[\]()#+\-.!_>])/,
    'autoLink': /^<([^ >]+(@|:\/)[^ >]+)>/,
    'tag': /^(?:(?:<(?:[a-zA-Z][a-zA-Z0-9]*)(?:(?:\s+)(?:[a-zA-Z_:][a-zA-Z0-9_.:-]*)(?:(?:\s+)?=(?:\s+)?(?:[^"'=<>`]+|'[^']*'|"[^"]*"))?)*(?:\s+)?\/?>)|(?:<\/(?:[a-zA-Z][a-zA-Z0-9]*)(?:\s+)?>)|<!--[\s\S]*?-->|(?:<\?(?:[^\?]|\?(?!>))+\?>)|(?:<![a-zA-Z]+\s+[\s\S]+?>)|(?:<!\[CDATA\[[\s\S]+?\]\]>))/,
    'strong': /^(_)_((?:\\[\s\S]|[^\\])+?)__(?!_)|^(\*)\*((?:\\[\s\S]|[^\\])+?)\*\*(?!\*)/,
    'emphasis': /^\b(_)((?:__|\\[\s\S]|[^\\])+?)_\b|^(\*)((?:\*\*|\\[\s\S]|[^\\])+?)\*(?!\*)/,
    'inlineCode': /^(`+)((?!`)[\s\S]*?(?:`\s+|[^`]))?(\1)(?!`)/,
    'break': /^ {2,}\n(?!\s*$)/,
    'inlineText': /^[\s\S]+?(?=[\\<!\[_*`]| {2,}\n|$)/,
    'link': /^(!?\[)((?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*)\]\(\s*(?:(?!<)((?:\((?:\\[\s\S]|[^\)])*?\)|\\[\s\S]|[\s\S])*?)|<([\s\S]*?)>)(?:\s+['"]([\s\S]*?)['"])?\s*\)/,
    'shortcutReference': /^(!?\[)((?:\\[\s\S]|[^\[\]])+?)\]/,
    'reference': /^(!?\[)((?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*)\]\s*\[((?:\\[\s\S]|[^\[\]])*)\]/
  },
  'gfm': {
    'fences': /^( *)(([`~])\3{2,})[ \t]*([^\n`~]+)?[ \t]*(?:\n([\s\S]*?))??(?:\n\ {0,3}\2\3*[ \t]*(?=\n|$)|$)/,
    'paragraph': /^(?:(?:[^\n]+\n?(?![ \t]*([-*_])( *\1){2,} *(?=\n|$)|( *)(([`~])\5{2,})[ \t]*([^\n`~]+)?[ \t]*(?:\n([\s\S]*?))??(?:\n\ {0,3}\4\5*[ \t]*(?=\n|$)|$)|([ \t]*)((?:[*+-]|\d+\.))[ \t][\s\S]+?(?:(?=\n+\8?(?:[-*_][ \t]*){3,}(?:\n|$))|(?=\n+[ \t]*\[((?:[^\\](?:\\|\\(?:\\{2})+)\]|[^\]])+)\]:[ \t\n]*(<[^>\[\]]+>|[^\s\[\]]+)(?:[ \t\n]+['"(]((?:[^\n]|\n(?!\n))*?)['")])?[ \t]*(?=\n|$))|\n{2,}(?![ \t])(?!\8(?:[*+-]|\d+\.)[ \t])|$)|([ \t]*)(#{1,6})(?:([ \t]+)([^\n]+?))??(?:[ \t]+#+)?[ \t]*(?=\n|$)|(\ {0,3})([^\n]+?)[ \t]*\n\ {0,3}(=|-){1,}[ \t]*(?=\n|$)|[ \t]*\[((?:[^\\](?:\\|\\(?:\\{2})+)\]|[^\]])+)\]:[ \t\n]*(<[^>\[\]]+>|[^\s\[\]]+)(?:[ \t\n]+['"(]((?:[^\n]|\n(?!\n))*?)['")])?[ \t]*(?=\n|$)|(?=[ \t]*>)(?:(?:(?:[ \t]*>[^\n]*\n)*(?:[ \t]*>[^\n]+(?=\n|$))|(?![ \t]*>)(?![ \t]*\[((?:[^\\](?:\\|\\(?:\\{2})+)\]|[^\]])+)\]:[ \t\n]*(<[^>\[\]]+>|[^\s\[\]]+)(?:[ \t\n]+['"(]((?:[^\n]|\n(?!\n))*?)['")])?[ \t]*(?=\n|$))[^\n]+)(?:\n|$))*(?:[ \t]*>[ \t]*(?:\n[ \t]*>[ \t]*)*)?|<(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\b)(?!mailto:)\w+(?!:\/|[^\w\s@]*@)\b))+)/,
    'table': /^( *\|(.+))\n( *\|( *[-:]+[-| :]*)\n)((?: *\|.*(?:\n|$))*)/,
    'looseTable': /^( *(\S.*\|.*))\n( *([-:]+ *\|[-| :]*)\n)((?:.*\|.*(?:\n|$))*)/,
    'escape': /^\\([\\`*{}\[\]()#+\-.!_>~|])/,
    'url': /^https?:\/\/[^\s<]+[^<.,:;"')\]\s]/,
    'deletion': /^~~(?=\S)([\s\S]*?\S)~~/,
    'inlineText': /^[\s\S]+?(?=[\\<!\[_*`~]|https?:\/\/| {2,}\n|$)/
  },
  'footnotes': {
    'footnoteDefinition': /^( *\[\^([^\]]+)\]: *)([^\n]+(\n+ +[^\n]+)*)/
  },
  'yaml': {
    'yamlFrontMatter': /^-{3}\n([\s\S]+?\n)?-{3}/
  },
  'pedantic': {
    'heading': /^([ \t]*)(#{1,6})([ \t]*)([^\n]*?)[ \t]*#*[ \t]*(?=\n|$)/,
    'strong': /^(_)_(?=\S)([\s\S]*?\S)__(?!_)|^(\*)\*(?=\S)([\s\S]*?\S)\*\*(?!\*)/,
    'emphasis': /^(_)(?=\S)([\s\S]*?\S)_(?!_)|^(\*)(?=\S)([\s\S]*?\S)\*(?!\*)/
  },
  'commonmark': {
    'list': /^([ \t]*)((?:[*+-]|\d+[\.\)]))[ \t][\s\S]+?(?:(?=\n+\1?(?:[-*_][ \t]*){3,}(?:\n|$))|(?=\n+[ \t]*\[((?:[^\\](?:\\|\\(?:\\{2})+)\]|[^\]])+)\]:[ \t\n]*(<[^>\[\]]+>|[^\s\[\]]+)(?:[ \t\n]+['"(]((?:[^\n]|\n(?!\n))*?)['")])?[ \t]*(?=\n|$))|\n{2,}(?![ \t])(?!\1(?:[*+-]|\d+[\.\)])[ \t])|$)/,
    'item': /([ \t]*)((?:[*+-]|\d+[\.\)]))( {1,4}(?! )| |\t)[^\n]*(?:\n(?!\1(?:[*+-]|\d+[\.\)])[ \t])[^\n]*)*/gm,
    'bullet': /(?:[*+-]|\d+[\.\)])/,
    'indent': /^([ \t]*)((?:[*+-]|\d+[\.\)]))( {1,4}(?! )| |\t)/,
    'html': /^(?:[ \t]*(?:(?:(?:<(?:article|header|aside|hgroup|blockquote|hr|iframe|body|li|map|button|object|canvas|ol|caption|output|col|p|colgroup|pre|dd|progress|div|section|dl|table|td|dt|tbody|embed|textarea|fieldset|tfoot|figcaption|th|figure|thead|footer|tr|form|ul|h1|h2|h3|h4|h5|h6|video|script|style)(?:(?:\s+)(?:[a-zA-Z_:][a-zA-Z0-9_.:-]*)(?:(?:\s+)?=(?:\s+)?(?:[^"'=<>`]+|'[^']*'|"[^"]*"))?)*(?:\s+)?\/?>?)|(?:<\/(?:article|header|aside|hgroup|blockquote|hr|iframe|body|li|map|button|object|canvas|ol|caption|output|col|p|colgroup|pre|dd|progress|div|section|dl|table|td|dt|tbody|embed|textarea|fieldset|tfoot|figcaption|th|figure|thead|footer|tr|form|ul|h1|h2|h3|h4|h5|h6|video|script|style)(?:\s+)?>))|(?:<!--(?!-?>)(?:[^-]|-(?!-))*-->)|(?:<\?(?:[^\?]|\?(?!>))+\?>)|(?:<![a-zA-Z]+\s+[\s\S]+?>)|(?:<!\[CDATA\[[\s\S]+?\]\]>))[\s\S]*?[ \t]*?(?:\n{2,}|\s*$))/i,
    'tag': /^(?:(?:<(?:[a-zA-Z][a-zA-Z0-9]*)(?:(?:\s+)(?:[a-zA-Z_:][a-zA-Z0-9_.:-]*)(?:(?:\s+)?=(?:\s+)?(?:[^"'=<>`]+|'[^']*'|"[^"]*"))?)*(?:\s+)?\/?>)|(?:<\/(?:[a-zA-Z][a-zA-Z0-9]*)(?:\s+)?>)|(?:<!--(?!-?>)(?:[^-]|-(?!-))*-->)|(?:<\?(?:[^\?]|\?(?!>))+\?>)|(?:<![a-zA-Z]+\s+[\s\S]+?>)|(?:<!\[CDATA\[[\s\S]+?\]\]>))/,
    'link': /^(!?\[)((?:(?:\[(?:\[(?:\\[\s\S]|[^\[\]])*?\]|\\[\s\S]|[^\[\]])*?\])|\\[\s\S]|[^\[\]])*?)\]\(\s*(?:(?!<)((?:\((?:\\[\s\S]|[^\(\)\s])*?\)|\\[\s\S]|[^\(\)\s])*?)|<([^\n]*?)>)(?:\s+(?:\'((?:\\[\s\S]|[^\'])*?)\'|"((?:\\[\s\S]|[^"])*?)"|\(((?:\\[\s\S]|[^\)])*?)\)))?\s*\)/,
    'reference': /^(!?\[)((?:(?:\[(?:\[(?:\\[\s\S]|[^\[\]])*?\]|\\[\s\S]|[^\[\]])*?\])|\\[\s\S]|[^\[\]])*?)\]\s*\[((?:\\[\s\S]|[^\[\]])*)\]/,
    'paragraph': /^(?:(?:[^\n]+\n?(?!\ {0,3}([-*_])( *\1){2,} *(?=\n|$)|(\ {0,3})(#{1,6})(?:([ \t]+)([^\n]+?))??(?:[ \t]+#+)?\ {0,3}(?=\n|$)|(?=\ {0,3}>)(?:(?:(?:\ {0,3}>[^\n]*\n)*(?:\ {0,3}>[^\n]+(?=\n|$))|(?!\ {0,3}>)(?!\ {0,3}\[((?:[^\\](?:\\|\\(?:\\{2})+)\]|[^\]])+)\]:[ \t\n]*(<[^>\[\]]+>|[^\s\[\]]+)(?:[ \t\n]+['"(]((?:[^\n]|\n(?!\n))*?)['")])?\ {0,3}(?=\n|$))[^\n]+)(?:\n|$))*(?:\ {0,3}>\ {0,3}(?:\n\ {0,3}>\ {0,3})*)?|<(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\b)(?!mailto:)\w+(?!:\/|[^\w\s@]*@)\b))+)/,
    'blockquote': /^(?=[ \t]*>)(?:(?:(?:[ \t]*>[^\n]*\n)*(?:[ \t]*>[^\n]+(?=\n|$))|(?![ \t]*>)(?![ \t]*([-*_])( *\1){2,} *(?=\n|$)|([ \t]*)((?:[*+-]|\d+\.))[ \t][\s\S]+?(?:(?=\n+\3?(?:[-*_][ \t]*){3,}(?:\n|$))|(?=\n+[ \t]*\[((?:[^\\](?:\\|\\(?:\\{2})+)\]|[^\]])+)\]:[ \t\n]*(<[^>\[\]]+>|[^\s\[\]]+)(?:[ \t\n]+['"(]((?:[^\n]|\n(?!\n))*?)['")])?[ \t]*(?=\n|$))|\n{2,}(?![ \t])(?!\3(?:[*+-]|\d+\.)[ \t])|$)|( *)(([`~])\10{2,})[ \t]*([^\n`~]+)?[ \t]*(?:\n([\s\S]*?))??(?:\n\ {0,3}\9\10*[ \t]*(?=\n|$)|$)|((?: {4}|\t)[^\n]*\n?([ \t]*\n)*)+|[ \t]*\[((?:[^\\](?:\\|\\(?:\\{2})+)\]|[^\]])+)\]:[ \t\n]*(<[^>\[\]]+>|[^\s\[\]]+)(?:[ \t\n]+['"(]((?:[^\n]|\n(?!\n))*?)['")])?[ \t]*(?=\n|$))[^\n]+)(?:\n|$))*(?:[ \t]*>[ \t]*(?:\n[ \t]*>[ \t]*)*)?/,
    'escape': /^\\(\n|[\\`*{}\[\]()#+\-.!_>"$%&',\/:;<=?@^~|])/
  },
  'commonmarkGFM': {
    'paragraph': /^(?:(?:[^\n]+\n?(?!\ {0,3}([-*_])( *\1){2,} *(?=\n|$)|( *)(([`~])\5{2,})\ {0,3}([^\n`~]+)?\ {0,3}(?:\n([\s\S]*?))??(?:\n\ {0,3}\4\5*\ {0,3}(?=\n|$)|$)|(\ {0,3})((?:[*+-]|\d+\.))[ \t][\s\S]+?(?:(?=\n+\8?(?:[-*_]\ {0,3}){3,}(?:\n|$))|(?=\n+\ {0,3}\[((?:[^\\](?:\\|\\(?:\\{2})+)\]|[^\]])+)\]:[ \t\n]*(<[^>\[\]]+>|[^\s\[\]]+)(?:[ \t\n]+['"(]((?:[^\n]|\n(?!\n))*?)['")])?\ {0,3}(?=\n|$))|\n{2,}(?![ \t])(?!\8(?:[*+-]|\d+\.)[ \t])|$)|(\ {0,3})(#{1,6})(?:([ \t]+)([^\n]+?))??(?:[ \t]+#+)?\ {0,3}(?=\n|$)|(?=\ {0,3}>)(?:(?:(?:\ {0,3}>[^\n]*\n)*(?:\ {0,3}>[^\n]+(?=\n|$))|(?!\ {0,3}>)(?!\ {0,3}\[((?:[^\\](?:\\|\\(?:\\{2})+)\]|[^\]])+)\]:[ \t\n]*(<[^>\[\]]+>|[^\s\[\]]+)(?:[ \t\n]+['"(]((?:[^\n]|\n(?!\n))*?)['")])?\ {0,3}(?=\n|$))[^\n]+)(?:\n|$))*(?:\ {0,3}>\ {0,3}(?:\n\ {0,3}>\ {0,3})*)?|<(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\b)(?!mailto:)\w+(?!:\/|[^\w\s@]*@)\b))+)/
  },
  'breaks': {
    'break': /^ *\n(?!\s*$)/,
    'inlineText': /^[\s\S]+?(?=[\\<!\[_*`]| *\n|$)/
  },
  'breaksGFM': {
    'inlineText': /^[\s\S]+?(?=[\\<!\[_*`~]|https?:\/\/| *\n|$)/
  }
};
}, {}],
28: [function(require, module, exports) {
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer
 * @license MIT
 * @module mdast:defaults
 * @fileoverview Default values for parse and
 *  stringification settings.
 */

'use strict';

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
}, {}],
14: [function(require, module, exports) {
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer
 * @license MIT
 * @module mdast:stringify
 * @fileoverview Compile an abstract syntax tree into
 *   a markdown document.
 */

'use strict';

/*
 * Dependencies.
 */

var he = require('he');
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

/*
 * Constants.
 */

var INDENT = 4;
var MINIMUM_CODE_FENCE_LENGTH = 3;
var YAML_FENCE_LENGTH = 3;
var MINIMUM_RULE_LENGTH = 3;
var MAILTO = 'mailto:';

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
 * Characters.
 */

var ANGLE_BRACKET_CLOSE = '>';
var ANGLE_BRACKET_OPEN = '<';
var ASTERISK = '*';
var CARET = '^';
var COLON = ':';
var DASH = '-';
var DOT = '.';
var EMPTY = '';
var EQUALS = '=';
var EXCLAMATION_MARK = '!';
var HASH = '#';
var LINE = '\n';
var PARENTHESIS_OPEN = '(';
var PARENTHESIS_CLOSE = ')';
var PIPE = '|';
var PLUS = '+';
var QUOTE_DOUBLE = '"';
var QUOTE_SINGLE = '\'';
var SPACE = ' ';
var SQUARE_BRACKET_OPEN = '[';
var SQUARE_BRACKET_CLOSE = ']';
var TICK = '`';
var TILDE = '~';
var UNDERSCORE = '_';

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

ENTITY_OPTIONS['true'] = true;
ENTITY_OPTIONS['false'] = true;
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

ORDERED_MAP['true'] = 'visitOrderedItems';
ORDERED_MAP['false'] = 'visitUnorderedItems';

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

CHECKBOX_MAP['null'] = EMPTY;
CHECKBOX_MAP.undefined = EMPTY;
CHECKBOX_MAP['true'] = SQUARE_BRACKET_OPEN + 'x' + SQUARE_BRACKET_CLOSE + SPACE;
CHECKBOX_MAP['false'] = SQUARE_BRACKET_OPEN + SPACE + SQUARE_BRACKET_CLOSE + SPACE;

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
 * By default this should not throw errors, but he does
 * throw an error when in `strict` mode:
 *
 *     he.encode.options.strict = true;
 *     encodeFactory('true')('\x01') // throws
 *
 * These are thrown on the currently compiled `File`.
 *
 * @example
 *   var file = new File();
 *
 *   var encode = encodeFactory('false', file);
 *   encode('AT&T') // 'AT&T'
 *
 *   encode = encodeFactory('true', file);
 *   encode('AT&T') // 'AT&amp;T'
 *
 *   encode = encodeFactory('numbers', file);
 *   encode('AT&T') // 'ATT&#x26;T'
 *
 * @param {string} type - Either `'true'`, `'false'`, or
 *   `numbers`.
 * @param {File} file - Currently compiled virtual file.
 * @return {function(string): string} - Function which
 *   takes a value and returns its encoded version.
 */
function encodeFactory(type, file) {
    var options = {};
    var fn;

    if (type === 'false') {
        return encodeNoop;
    }

    if (type === 'true') {
        options.useNamedReferences = true;
    }

    fn = type === 'escape' ? 'escape' : 'encode';

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
     * @param {Object} node - Node which is compiled.
     * @return {string} - Encoded content.
     * @throws {Error} - When `file.quiet` is not `true`.
     *   However, by default `he` does not throw on
     *   parse errors, but when
     *   `he.encode.options.strict: true`, they occur on
     *   invalid HTML.
     */
    function encode(value, node) {
        try {
            return he[fn](value, options);
        } catch (exception) {
            file.fail(exception, node.position);
        }
    }

    return encode;
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
 * @param {string} uri
 * @param {boolean?} [always] - Force enclosing.
 * @return {boolean} - Properly enclosed `uri`.
 */
function encloseURI(uri, always) {
    if (always || !uri.length || EXPRESSIONS_WHITE_SPACE.test(uri) || ccount(uri, PARENTHESIS_OPEN) !== ccount(uri, PARENTHESIS_CLOSE)) {
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
        validate[typeof current[key]](options, key, current[key], maps[key]);
    }

    ruleRepetition = options.ruleRepetition;

    if (ruleRepetition && ruleRepetition < MINIMUM_RULE_LENGTH) {
        raise(ruleRepetition, 'options.ruleRepetition');
    }

    self.encode = encodeFactory(String(options.entities), self.file);

    self.options = options;

    return self;
};

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
        self.file.fail('Missing compiler for node of type `' + node.type + '`: `' + node + '`', node);
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
    var index = -1;
    var length = children.length;

    while (++index < length) {
        values[index] = self.visit(children[index], parent);
    }

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
            } else if (prev.type === 'list' && child.type === 'code' && !child.lang) {
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
        return content + LINE + repeat(depth === 1 ? EQUALS : DASH, content.length);
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
 * @return {string} - Raw markdown text.
 */
compilerPrototype.text = function (node) {
    return this.encode(node.value, node);
};

/**
 * Stringify escaped text.
 *
 * @example
 *   var compiler = new Compiler();
 *
 *   compiler.escape({
 *     type: 'escape',
 *     value: '\n'
 *   });
 *   // '\\\n'
 *
 * @param {Object} node - `escape` node.
 * @return {string} - Markdown escape.
 */
compilerPrototype.escape = function (node) {
    return '\\' + node.value;
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
    var indent = ANGLE_BRACKET_CLOSE + SPACE;

    return indent + this.block(node).split(LINE).join(LINE + indent);
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

    if (style === LIST_ITEM_ONE || style === LIST_ITEM_MIXED && value.indexOf(LINE) === -1) {
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
 * @return {string} - Markdown code block.
 */
compilerPrototype.code = function (node) {
    var value = node.value;
    var marker = this.options.fence;
    var language = this.encode(node.lang || EMPTY, node);
    var fence;

    /*
     * Probably pedantic.
     */

    if (!language && !this.options.fences && value) {
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
compilerPrototype['break'] = function () {
    return SPACE + SPACE + LINE;
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
compilerPrototype['delete'] = function (node) {
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
    var value = self.all(node).join(EMPTY);

    if (node.title === null && PROTOCOL.test(url) && (url === value || url === MAILTO + value)) {
        return encloseURI(url, true);
    }

    url = encloseURI(url);

    if (node.title) {
        url += SPACE + encloseTitle(self.encode(node.title, node));
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
    return SQUARE_BRACKET_OPEN + this.all(node).join(EMPTY) + SQUARE_BRACKET_CLOSE + label(node);
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
    var alt = this.encode(node.alt, node);

    return EXCLAMATION_MARK + SQUARE_BRACKET_OPEN + alt + SQUARE_BRACKET_CLOSE + label(node);
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
    return SQUARE_BRACKET_OPEN + CARET + node.identifier + SQUARE_BRACKET_CLOSE;
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
    var encode = this.encode;
    var url = encloseURI(encode(node.src, node));
    var value;

    if (node.title) {
        url += SPACE + encloseTitle(encode(node.title, node));
    }

    value = EXCLAMATION_MARK + SQUARE_BRACKET_OPEN + encode(node.alt || EMPTY, node) + SQUARE_BRACKET_CLOSE;

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
    return SQUARE_BRACKET_OPEN + CARET + this.all(node).join(EMPTY) + SQUARE_BRACKET_CLOSE;
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

    return SQUARE_BRACKET_OPEN + CARET + id + SQUARE_BRACKET_CLOSE + COLON + SPACE + this.all(node).join(BREAK + repeat(SPACE, INDENT));
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
    var result = [];
    var start;

    while (index--) {
        result[index] = self.all(rows[index]);
    }

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
 *   file.namespace('mdast').ast = {
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
    return this.visit(this.file.namespace('mdast').ast);
};

/*
 * Expose `stringify` on `module.exports`.
 */

module.exports = Compiler;
}, {"he":21,"markdown-table":30,"repeat-string":22,"extend.js":25,"ccount":31,"longest-streak":32,"./utilities.js":26,"./defaults.js":28}],
30: [function(require, module, exports) {
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

                size = sizes[index] + (EXPRESSION_DOT.test(value) ? 0 : 1) - (calculateStringLength(value) - position);

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
}, {}],
31: [function(require, module, exports) {
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
}, {}],
32: [function(require, module, exports) {
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
}, {}],
7: [function(require, module, exports) {
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer
 * @license MIT
 * @module mdast:util:to-nlcst
 * @fileoverview Create a Natural Language Concrete Syntax Tree from
 *   a Markdown Abstract Syntax Tree.
 */

'use strict';

/*
 * Dependencies.
 */

var range = require('mdast-range');
var Latin = require('parse-latin');
var toString = require('nlcst-to-string');

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

var NON_NEWLINE = /[^\n]/;

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

    while (++index < length) {
        child = one(children[index], index, parent, file, parser);

        if (child) {
            result = result.concat(child);
        }
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
    var siblings = parent && parent.children;
    var prev = siblings && siblings[index - 1];
    var pos = node.position;
    var start = pos.start;
    var end = pos.end;
    var final = prev && prev.position.end.offset;
    var replacement;
    var result;
    var space;

    space = final && file.toString().slice(final, start.offset);

    if (type in IGNORE) {
        return null;
    }

    if (node.children) {
        replacement = all(node, file, parser);
    } else if (type === 'image' || type === 'imageReference') {
        replacement = patch(parser.tokenize(node.alt), file, start.offset + 2);
    } else if (type === 'text' || type === 'escape') {
        replacement = patch(parser.tokenize(node.value), file, start.offset);
    } else if (node.type === 'break') {
        replacement = patch([parser.tokenizeWhiteSpace('\n')], file, start.offset);
    } else if (node.type === 'inlineCode') {
        replacement = patch([parser.tokenizeSource(file.toString().slice(start.offset, end.offset))], file, start.offset);
    }

    /**
     * There’s a difference between block-nodes with
     * lines between them. NLCST parsers need them to
     * differentiate between paragraphs.
     */

    if (replacement && space && !NON_NEWLINE.test(space)) {
        result = parser.tokenizeWhiteSpace(space);

        patch([result], file, final);

        replacement.unshift(result);
    }

    return replacement || null;
};

/**
 * Transform `ast` into `nlcst`.
 *
 * @param {File} file - Virtual file.
 * @param {Function?} [Parser] - Constructor of an nlcst
 *   parser. Defaults to `ParseLatin`.
 * @return {NLCSTNode} - NLCST.
 */
function toNLCST(file, Parser) {
    var ast;
    var parser;
    var cst;

    /*
     * Warn for invalid parameters.
     */

    if (!file || !file.messages) {
        throw new Error('mdast-util-to-nlcst expected file');
    }

    ast = file.namespace('mdast').ast;

    if (!ast || !ast.type) {
        throw new Error('mdast-util-to-nlcst expected node');
    }

    if (!ast.position || !ast.position.start || !ast.position.start.column || !ast.position.start.line) {
        throw new Error('mdast-util-to-nlcst expected position on nodes');
    }

    /*
     * Construct parser.
     */

    if (!Parser) {
        Parser = Latin;
    }

    if ('parse' in Parser) {
        parser = Parser;
        parser.position = true;
    } else {
        parser = new Parser({
            'position': true
        });
    }

    /*
     * Patch ranges.
     */

    range()(ast, file);

    /*
     * Transform mdast into NLCST tokens, and pass these
     * into `parser.parse` to insert sentences, paragraphs
     * where needed.
     */

    cst = parser.parse(one(ast, null, null, file, parser));

    file.namespace('retext').cst = cst;

    return cst;
}

/*
 * Expose.
 */

module.exports = toNLCST;
}, {"mdast-range":33,"parse-latin":34,"nlcst-to-string":35}],
33: [function(require, module, exports) {
'use strict';

/*
 * Dependencies.
 */

var visit = require('mdast-util-visit');

/**
 * Calculate offsets for `lines`.
 *
 * @param {Array.<string>} lines
 * @return {Array.<number>}
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
 * @param {Object} position
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
            return (offsets[line - 2] || 0) + column - 1 || 0;
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
                    'column': offset - (offsets[index - 1] || 0) + 1
                };
            }
        }

        return {};
    }

    return offsetToPosition;
}

/**
 * Add ranges for `doc` to `ast`.
 *
 * @param {Node} ast
 * @param {File} file
 */
function transformer(ast, file) {
    var contents = String(file).split('\n');
    var positionToOffset;

    /*
     * Invalid.
     */

    if (!file || typeof file.contents !== 'string') {
        throw new Error('Missing `file` for mdast-range');
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
}, {"mdast-util-visit":36}],
36: [function(require, module, exports) {
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer. All rights reserved.
 * @module mdast-util-visit
 * @fileoverview Utility to recursively walk over mdast nodes.
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
}, {}],
34: [function(require, module, exports) {
'use strict';

module.exports = require('./lib/parse-latin');
}, {"./lib/parse-latin":37}],
37: [function(require, module, exports) {
/*!
 * parse-latin
 *
 * Licensed under MIT.
 * Copyright (c) 2014 Titus Wormer <tituswormer@gmail.com>
 */

'use strict';

/*
 * Dependencies.
 */

var createParser, expressions, pluginFactory, modifierFactory;

createParser = require('./parser');
expressions = require('./expressions');
pluginFactory = require('./plugin');
modifierFactory = require('./modifier');

/*
 * == CLASSIFY ===============================================================
 */

/*
 * Constants.
 */

var EXPRESSION_TOKEN, EXPRESSION_WORD, EXPRESSION_PUNCTUATION, EXPRESSION_WHITE_SPACE;

/*
 * Match all tokens:
 * - One or more number, alphabetic, or
 *   combining characters;
 * - One or more white space characters;
 * - One or more astral plane characters;
 * - One or more of the same character;
 */

EXPRESSION_TOKEN = expressions.token;

/*
 * Match a word.
 */

EXPRESSION_WORD = expressions.word;

/*
 * Match a string containing ONLY punctuation.
 */

EXPRESSION_PUNCTUATION = expressions.punctuation;

/*
 * Match a string containing ONLY white space.
 */

EXPRESSION_WHITE_SPACE = expressions.whiteSpace;

/**
 * Classify a token.
 *
 * @param {string?} value
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
 * @param {ParseLatin} parser
 * @param {string?} value
 * @return {Array.<NLCSTNode>}
 */
function tokenize(parser, value) {
    var tokens, offset, line, column, match;

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

        throw new Error('Illegal invocation: \'' + value + '\'' + ' is not a valid argument for \'ParseLatin\'');
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
     * @param {Object} start
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
     * @param {string} subvalue
     */
    function update(subvalue) {
        var subvalueLength = subvalue.length,
            character = -1,
            lastIndex = -1;

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
 * @constructor {ParseLatin}
 */
function ParseLatin(options) {
    /*
     * TODO: This should later be removed (when this
     * change bubbles through to dependants).
     */

    if (!(this instanceof ParseLatin)) {
        return new ParseLatin(options);
    }

    this.position = Boolean(options && options.position);
}

/*
 * Quick access to the prototype.
 */

var parseLatinPrototype;

parseLatinPrototype = ParseLatin.prototype;

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
 * @param {string?} type
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
 * @param {string} key
 * @param {Array.<Node>} nodes
 * @return {Array.<Node>} - `nodes`.
 */
function run(key, nodes) {
    var wareKey, plugins, index;

    wareKey = key + 'Plugins';

    plugins = this[wareKey];

    if (plugins) {
        index = -1;

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
 * @param {Function} Constructor
 * @param {string} key
 * @param {function(*): undefined} callback
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
 * @param {function(Object, string, Array.<Function>)} callback
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
        var self, wareKey;

        self = this;

        /*
         * Throw if the method is not pluggable.
         */

        if (!(key in self)) {
            throw new Error('Illegal Invocation: Unsupported `key` for ' + '`use(key, plugins)`. Make sure `key` is a ' + 'supported function');
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
 * @param {string?} value
 * @return {NLCSTWordNode}
 */
pluggable(ParseLatin, 'tokenizeWord', function (value, eat) {
    var add, parent;

    add = (eat || noopEat)('');
    parent = {
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
 * Easy access to the document parser.
 *
 * @see ParseLatin#tokenizeRoot
 */
parseLatinPrototype.parse = function (value) {
    return this.tokenizeRoot(value);
};

/*
 * == PLUGINS ================================================================
 */

parseLatinPrototype.use('tokenizeSentence', [require('./plugin/merge-initial-word-symbol'), require('./plugin/merge-final-word-symbol'), require('./plugin/merge-inner-word-symbol'), require('./plugin/merge-initialisms'), require('./plugin/merge-words'), require('./plugin/patch-position')]);

parseLatinPrototype.use('tokenizeParagraph', [require('./plugin/merge-non-word-sentences'), require('./plugin/merge-affix-symbol'), require('./plugin/merge-initial-lower-case-letter-sentences'), require('./plugin/merge-prefix-exceptions'), require('./plugin/merge-affix-exceptions'), require('./plugin/merge-remaining-full-stops'), require('./plugin/make-initial-white-space-siblings'), require('./plugin/make-final-white-space-siblings'), require('./plugin/break-implicit-sentences'), require('./plugin/remove-empty-nodes'), require('./plugin/patch-position')]);

parseLatinPrototype.use('tokenizeRoot', [require('./plugin/make-initial-white-space-siblings'), require('./plugin/make-final-white-space-siblings'), require('./plugin/remove-empty-nodes'), require('./plugin/patch-position')]);

/*
 * == EXPORT =================================================================
 */

/*
 * Expose `ParseLatin`.
 */

module.exports = ParseLatin;

/*
 * Expose `pluginFactory` on `ParseLatin` as `plugin`.
 */

ParseLatin.plugin = pluginFactory;

/*
 * Expose `modifierFactory` on `ParseLatin` as `modifier`.
 */

ParseLatin.modifier = modifierFactory;
}, {"./parser":38,"./expressions":39,"./plugin":40,"./modifier":41,"./plugin/merge-initial-word-symbol":42,"./plugin/merge-final-word-symbol":43,"./plugin/merge-inner-word-symbol":44,"./plugin/merge-initialisms":45,"./plugin/merge-words":46,"./plugin/patch-position":47,"./plugin/merge-non-word-sentences":48,"./plugin/merge-affix-symbol":49,"./plugin/merge-initial-lower-case-letter-sentences":50,"./plugin/merge-prefix-exceptions":51,"./plugin/merge-affix-exceptions":52,"./plugin/merge-remaining-full-stops":53,"./plugin/make-initial-white-space-siblings":54,"./plugin/make-final-white-space-siblings":55,"./plugin/break-implicit-sentences":56,"./plugin/remove-empty-nodes":57}],
38: [function(require, module, exports) {
'use strict';

var tokenizer;

tokenizer = require('./tokenizer');

/**
 * Construct a parser based on `options`.
 *
 * @param {Object} options
 * @return {function(string): NLCSTNode}
 */
function parserFactory(options) {
    var type, delimiter, tokenizerProperty;

    type = options.type;
    tokenizerProperty = options.tokenizer;
    delimiter = options.delimiter;

    if (delimiter) {
        delimiter = tokenizer(options.delimiterType, options.delimiter);
    }

    return function (value) {
        var children;

        children = this[tokenizerProperty](value);

        return {
            'type': type,
            'children': delimiter ? delimiter(children) : children
        };
    };
}

module.exports = parserFactory;
}, {"./tokenizer":58}],
58: [function(require, module, exports) {
'use strict';

var nlcstToString;

nlcstToString = require('nlcst-to-string');

/**
 * Factory to create a tokenizer based on a given
 * `expression`.
 *
 * @param {string} childType
 * @param {RegExp} expression
 * @return {function(NLCSTParent): Array.<NLCSTChild>}
 */
function tokenizerFactory(childType, expression) {
    /**
     * A function which splits
     *
     * @param {NLCSTParent} node
     * @return {Array.<NLCSTChild>}
     */
    return function (node) {
        var children, tokens, type, length, index, lastIndex, start, parent, first, last;

        children = [];

        tokens = node.children;
        type = node.type;

        length = tokens.length;

        index = -1;

        lastIndex = length - 1;

        start = 0;

        while (++index < length) {
            if (index === lastIndex || tokens[index].type === childType && expression.test(nlcstToString(tokens[index]))) {
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

module.exports = tokenizerFactory;
}, {"nlcst-to-string":35}],
35: [function(require, module, exports) {
'use strict';

/**
 * Stringify an NLCST node.
 *
 * @param {NLCSTNode} nlcst
 * @return {string}
 */
function nlcstToString(nlcst) {
    var values, length, children;

    if (typeof nlcst.value === 'string') {
        return nlcst.value;
    }

    children = nlcst.children;
    length = children.length;

    /**
     * Shortcut: This is pretty common, and a small performance win.
     */

    if (length === 1 && 'value' in children[0]) {
        return children[0].value;
    }

    values = [];

    while (length--) {
        values[length] = nlcstToString(children[length]);
    }

    return values.join('');
}

/*
 * Expose `nlcstToString`.
 */

module.exports = nlcstToString;
}, {}],
39: [function(require, module, exports) {
'use strict';

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
}, {}],
40: [function(require, module, exports) {
'use strict';

/**
 * Turns `callback` into a ``plugin'' accepting a parent.
 *
 * @param {function(Object, number, Object)} callback
 * @return {function(NLCSTParent)}
 */
function pluginFactory(callback) {
    return function (parent) {
        var index, children;

        index = -1;
        children = parent.children;

        while (children[++index]) {
            callback(children[index], index, parent);
        }
    };
}

/*
 * Expose `pluginFactory`.
 */

module.exports = pluginFactory;
}, {}],
41: [function(require, module, exports) {
'use strict';

/*
 * Dependencies.
 */

var iterate;

iterate = require('array-iterate');

/**
 * Pass the context as the third argument to `callback`.
 *
 * @param {function(Object, number, Object): number|undefined} callback
 * @return {function(Object, number)}
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
 * @param {function(Object, number, Object): number|undefined} callback
 * @return {function(NLCSTParent)}
 */
function iteratorFactory(callback) {
  return function (parent) {
    return iterate(parent.children, callback, parent);
  };
}

/**
 * Turns `callback` into a ``iterator'' accepting a parent.
 *
 * see ``array-iterate'' for more info.
 *
 * @param {function(Object, number, Object): number|undefined} callback
 * @return {function(Object)}
 */
function modifierFactory(callback) {
  return iteratorFactory(wrapperFactory(callback));
}

/*
 * Expose `modifierFactory`.
 */

module.exports = modifierFactory;
}, {"array-iterate":59}],
59: [function(require, module, exports) {
'use strict';

/**
 * Cache `hasOwnProperty`.
 */

var has;

has = Object.prototype.hasOwnProperty;

/**
 * `Array#forEach()` with the possibility to change
 * the next position.
 *
 * @param {{length: number}} values
 * @param {function(*, number, {length: number}): number|undefined} callback
 * @param {*} context
 */

function iterate(values, callback, context) {
    var index, result;

    if (!values) {
        throw new Error('TypeError: Iterate requires that |this| ' + 'not be ' + values);
    }

    if (!has.call(values, 'length')) {
        throw new Error('TypeError: Iterate requires that |this| ' + 'has a `length`');
    }

    if (typeof callback !== 'function') {
        throw new Error('TypeError: callback must be a function');
    }

    index = -1;

    /**
     * The length might change, so we do not cache it.
     */

    while (++index < values.length) {
        /**
         * Skip missing values.
         */

        if (!(index in values)) {
            continue;
        }

        result = callback.call(context, values[index], index, values);

        /**
         * If `callback` returns a `number`, move `index` over to
         * `number`.
         */

        if (typeof result === 'number') {
            /**
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

/**
 * Expose `iterate`.
 */

module.exports = iterate;
}, {}],
42: [function(require, module, exports) {
'use strict';

/*
 * Dependencies.
 */

var nlcstToString, modifier;

nlcstToString = require('nlcst-to-string');
modifier = require('../modifier');

/**
 * Merge certain punctuation marks into their
 * following words.
 *
 * @param {NLCSTNode} child
 * @param {number} index
 * @param {NLCSTSentenceNode} parent
 * @return {undefined|number}
 */
function mergeInitialWordSymbol(child, index, parent) {
    var children, next;

    if (child.type !== 'SymbolNode' && child.type !== 'PunctuationNode' || nlcstToString(child) !== '&') {
        return;
    }

    children = parent.children;

    next = children[index + 1];

    /*
     * If either a previous word, or no following word,
     * exists, exit early.
     */

    if (index !== 0 && children[index - 1].type === 'WordNode' || !(next && next.type === 'WordNode')) {
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

module.exports = modifier(mergeInitialWordSymbol);
}, {"nlcst-to-string":35,"../modifier":41}],
43: [function(require, module, exports) {
'use strict';

/*
 * Dependencies.
 */

var nlcstToString, modifier;

nlcstToString = require('nlcst-to-string');
modifier = require('../modifier');

/**
 * Merge certain punctuation marks into their
 * preceding words.
 *
 * @param {NLCSTNode} child
 * @param {number} index
 * @param {NLCSTSentenceNode} parent
 * @return {undefined|number}
 */
function mergeFinalWordSymbol(child, index, parent) {
    var children, prev, next;

    if (index !== 0 && (child.type === 'SymbolNode' || child.type === 'PunctuationNode') && nlcstToString(child) === '-') {
        children = parent.children;

        prev = children[index - 1];
        next = children[index + 1];

        if ((!next || next.type !== 'WordNode') && (prev && prev.type === 'WordNode')) {
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

module.exports = modifier(mergeFinalWordSymbol);
}, {"nlcst-to-string":35,"../modifier":41}],
44: [function(require, module, exports) {
'use strict';

/*
 * Dependencies.
 */

var nlcstToString, modifier, expressions;

nlcstToString = require('nlcst-to-string');
modifier = require('../modifier');
expressions = require('../expressions');

/*
 * Constants.
 *
 * - Symbols part of surrounding words.
 */

var EXPRESSION_INNER_WORD_SYMBOL;

EXPRESSION_INNER_WORD_SYMBOL = expressions.wordSymbolInner;

/**
 * Merge two words surrounding certain punctuation marks.
 *
 * @param {NLCSTNode} child
 * @param {number} index
 * @param {NLCSTSentenceNode} parent
 * @return {undefined|number}
 */
function mergeInnerWordSymbol(child, index, parent) {
    var siblings, sibling, prev, last, position, tokens, queue;

    if (index !== 0 && (child.type === 'SymbolNode' || child.type === 'PunctuationNode')) {
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
                } else if ((sibling.type === 'SymbolNode' || sibling.type === 'PunctuationNode') && EXPRESSION_INNER_WORD_SYMBOL.test(nlcstToString(sibling))) {
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

module.exports = modifier(mergeInnerWordSymbol);
}, {"nlcst-to-string":35,"../modifier":41,"../expressions":39}],
45: [function(require, module, exports) {
'use strict';

/*
 * Dependencies.
 */

var nlcstToString, modifier, expressions;

nlcstToString = require('nlcst-to-string');
modifier = require('../modifier');
expressions = require('../expressions');

/*
 * Constants.
 *
 * - Numbers.
 */

var EXPRESSION_NUMERICAL;

EXPRESSION_NUMERICAL = expressions.numerical;

/**
 * Merge initialisms.
 *
 * @param {NLCSTNode} child
 * @param {number} index
 * @param {NLCSTSentenceNode} parent
 * @return {undefined|number}
 */
function mergeInitialisms(child, index, parent) {
    var siblings, prev, children, length, position, otherChild, isAllDigits, value;

    if (index !== 0 && nlcstToString(child) === '.') {
        siblings = parent.children;

        prev = siblings[index - 1];
        children = prev.children;

        length = children && children.length;

        if (prev.type === 'WordNode' && length !== 1 && length % 2 !== 0) {
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

module.exports = modifier(mergeInitialisms);
}, {"nlcst-to-string":35,"../modifier":41,"../expressions":39}],
46: [function(require, module, exports) {
'use strict';

/*
 * Dependencies.
 */

var modifier = require('../modifier');

/**
 * Merge multiple words. This merges the children of
 * adjacent words, something which should not occur
 * naturally by parse-latin, but might happen when
 * custom tokens were passed in.
 *
 * @param {NLCSTNode} child
 * @param {number} index
 * @param {NLCSTSentenceNode} parent
 * @return {undefined|number}
 */
function mergeFinalWordSymbol(child, index, parent) {
  var siblings = parent.children,
      next;

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

module.exports = modifier(mergeFinalWordSymbol);
}, {"../modifier":41}],
47: [function(require, module, exports) {
'use strict';

/*
 * Dependencies.
 */

var plugin = require('../plugin');

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
 * @param {NLCSTNode} child
 */
function patchPosition(child, index, node) {
    var siblings = node.children;

    if (!child.position) {
        return;
    }

    if (index === 0 && (!node.position || /* istanbul ignore next */!node.position.start)) {
        patch(node);
        node.position.start = child.position.start;
    }

    if (index === siblings.length - 1 && (!node.position || !node.position.end)) {
        patch(node);
        node.position.end = child.position.end;
    }
}

/*
 * Expose `patchPosition` as a plugin.
 */

module.exports = plugin(patchPosition);
}, {"../plugin":40}],
48: [function(require, module, exports) {
'use strict';

/*
 * Dependencies.
 */

var modifier;

modifier = require('../modifier');

/**
 * Merge a sentence into the following sentence, when
 * the sentence does not contain word tokens.
 *
 * @param {NLCSTNode} child
 * @param {number} index
 * @param {NLCSTParagraphNode} parent
 * @return {undefined|number}
 */
function mergeNonWordSentences(child, index, parent) {
  var children, position, prev, next;

  children = child.children;
  position = -1;

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

module.exports = modifier(mergeNonWordSentences);
}, {"../modifier":41}],
49: [function(require, module, exports) {
'use strict';

/*
 * Dependencies.
 */

var nlcstToString, modifier, expressions;

nlcstToString = require('nlcst-to-string');
modifier = require('../modifier');
expressions = require('../expressions');

/*
 * Constants.
 *
 * - Closing or final punctuation, or terminal markers
 *   that should still be included in the previous
 *   sentence, even though they follow the sentence's
 *   terminal marker.
 */

var EXPRESSION_AFFIX_SYMBOL;

EXPRESSION_AFFIX_SYMBOL = expressions.affixSymbol;

/**
 * Move certain punctuation following a terminal
 * marker (thus in the next sentence) to the
 * previous sentence.
 *
 * @param {NLCSTNode} child
 * @param {number} index
 * @param {NLCSTParagraphNode} parent
 * @return {undefined|number}
 */
function mergeAffixSymbol(child, index, parent) {
    var children, prev, first, second;

    children = child.children;

    if (children && children.length && index !== 0) {
        first = children[0];
        second = children[1];
        prev = parent.children[index - 1];

        if ((first.type === 'SymbolNode' || first.type === 'PunctuationNode') && EXPRESSION_AFFIX_SYMBOL.test(nlcstToString(first))) {
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

module.exports = modifier(mergeAffixSymbol);
}, {"nlcst-to-string":35,"../modifier":41,"../expressions":39}],
50: [function(require, module, exports) {
'use strict';

/*
 * Dependencies.
 */

var nlcstToString, modifier, expressions;

nlcstToString = require('nlcst-to-string');
modifier = require('../modifier');
expressions = require('../expressions');

/*
 * Constants.
 *
 * - Initial lowercase letter.
 */

var EXPRESSION_LOWER_INITIAL;

EXPRESSION_LOWER_INITIAL = expressions.lowerInitial;

/**
 * Merge a sentence into its previous sentence, when
 * the sentence starts with a lower case letter.
 *
 * @param {NLCSTNode} child
 * @param {number} index
 * @param {NLCSTParagraphNode} parent
 * @return {undefined|number}
 */
function mergeInitialLowerCaseLetterSentences(child, index, parent) {
    var siblings, children, position, node, prev;

    children = child.children;

    if (children && children.length && index !== 0) {
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

            if (node.type === 'SymbolNode' || node.type === 'PunctuationNode') {
                return;
            }
        }
    }
}

/*
 * Expose `mergeInitialLowerCaseLetterSentences` as a modifier.
 */

module.exports = modifier(mergeInitialLowerCaseLetterSentences);
}, {"nlcst-to-string":35,"../modifier":41,"../expressions":39}],
51: [function(require, module, exports) {
'use strict';

/*
 * Dependencies.
 */

var nlcstToString, modifier;

nlcstToString = require('nlcst-to-string');
modifier = require('../modifier');

/*
 * Constants.
 *
 * - Blacklist of full stop characters that should not
 *   be treated as terminal sentence markers: A
 *   case-insensitive abbreviation.
 */

var EXPRESSION_ABBREVIATION_PREFIX;

EXPRESSION_ABBREVIATION_PREFIX = new RegExp('^(' + '[0-9]+|' + '[a-z]|' +

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

'al|ca|cap|cca|cent|cf|cit|con|cp|cwt|ead|etc|ff|' + 'fl|ibid|id|nem|op|pro|seq|sic|stat|tem|viz' + ')$');

/**
 * Merge a sentence into its next sentence, when the
 * sentence ends with a certain word.
 *
 * @param {NLCSTNode} child
 * @param {number} index
 * @param {NLCSTParagraphNode} parent
 * @return {undefined|number}
 */
function mergePrefixExceptions(child, index, parent) {
    var children, node, next;

    children = child.children;

    if (children && children.length && index !== parent.children.length - 1) {
        node = children[children.length - 1];

        if (node && nlcstToString(node) === '.') {
            node = children[children.length - 2];

            if (node && node.type === 'WordNode' && EXPRESSION_ABBREVIATION_PREFIX.test(nlcstToString(node).toLowerCase())) {
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

module.exports = modifier(mergePrefixExceptions);
}, {"nlcst-to-string":35,"../modifier":41}],
52: [function(require, module, exports) {
'use strict';

/*
 * Dependencies.
 */

var nlcstToString, modifier;

nlcstToString = require('nlcst-to-string');
modifier = require('../modifier');

/**
 * Merge a sentence into its previous sentence, when
 * the sentence starts with a comma.
 *
 * @param {NLCSTNode} child
 * @param {number} index
 * @param {NLCSTParagraphNode} parent
 * @return {undefined|number}
 */
function mergeAffixExceptions(child, index, parent) {
    var children, node, position, previousChild, value;

    children = child.children;

    if (!children || !children.length || index === 0) {
        return;
    }

    position = -1;

    while (children[++position]) {
        node = children[position];

        if (node.type === 'WordNode') {
            return;
        }

        if (node.type === 'SymbolNode' || node.type === 'PunctuationNode') {
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

module.exports = modifier(mergeAffixExceptions);
}, {"nlcst-to-string":35,"../modifier":41}],
53: [function(require, module, exports) {
'use strict';

/*
 * Dependencies.
 */

var nlcstToString, plugin, expressions;

nlcstToString = require('nlcst-to-string');
plugin = require('../plugin');
expressions = require('../expressions');

/*
 * Constants.
 *
 * - Blacklist of full stop characters that should not
 *   be treated as terminal sentence markers: A
 *   case-insensitive abbreviation.
 */

var EXPRESSION_TERMINAL_MARKER;

EXPRESSION_TERMINAL_MARKER = expressions.terminalMarker;

/**
 * Merge non-terminal-marker full stops into
 * the previous word (if available), or the next
 * word (if available).
 *
 * @param {NLCSTNode} child
 */
function mergeRemainingFullStops(child) {
    var children, position, grandchild, prev, next, nextNext, hasFoundDelimiter;

    children = child.children;
    position = children.length;

    hasFoundDelimiter = false;

    while (children[--position]) {
        grandchild = children[position];

        if (grandchild.type !== 'SymbolNode' && grandchild.type !== 'PunctuationNode') {
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

            if (next && nextNext && next.type === 'WhiteSpaceNode' && nlcstToString(nextNext) === '.') {
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

module.exports = plugin(mergeRemainingFullStops);
}, {"nlcst-to-string":35,"../plugin":40,"../expressions":39}],
54: [function(require, module, exports) {
'use strict';

/*
 * Dependencies.
 */

var plugin;

plugin = require('../plugin');

/**
 * Move white space starting a sentence up, so they are
 * the siblings of sentences.
 *
 * @param {NLCSTNode} child
 * @param {number} index
 * @param {NLCSTParent} parent
 */
function makeInitialWhiteSpaceSiblings(child, index, parent) {
    var children, next;

    children = child.children;

    if (children && children.length !== 0 && children[0].type === 'WhiteSpaceNode') {
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

module.exports = plugin(makeInitialWhiteSpaceSiblings);
}, {"../plugin":40}],
55: [function(require, module, exports) {
'use strict';

/*
 * Dependencies.
 */

var modifier;

modifier = require('../modifier');

/**
 * Move white space ending a paragraph up, so they are
 * the siblings of paragraphs.
 *
 * @param {NLCSTNode} child
 * @param {number} index
 * @param {NLCSTParent} parent
 * @return {undefined|number}
 */
function makeFinalWhiteSpaceSiblings(child, index, parent) {
    var children, prev;

    children = child.children;

    if (children && children.length !== 0 && children[children.length - 1].type === 'WhiteSpaceNode') {
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

module.exports = modifier(makeFinalWhiteSpaceSiblings);
}, {"../modifier":41}],
56: [function(require, module, exports) {
'use strict';

/*
 * Dependencies.
 */

var nlcstToString, modifier, expressions;

nlcstToString = require('nlcst-to-string');
modifier = require('../modifier');
expressions = require('../expressions');

/*
 * Constants.
 *
 * - Two or more new line characters.
 */

var EXPRESSION_MULTI_NEW_LINE;

EXPRESSION_MULTI_NEW_LINE = expressions.newLineMulti;

/**
 * Break a sentence if a white space with more
 * than one new-line is found.
 *
 * @param {NLCSTNode} child
 * @param {number} index
 * @param {NLCSTParagraphNode} parent
 * @return {undefined}
 */
function breakImplicitSentences(child, index, parent) {
    var children, position, length, tail, head, end, insertion, node;

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

        if (node.type !== 'WhiteSpaceNode' || !EXPRESSION_MULTI_NEW_LINE.test(nlcstToString(node))) {
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

module.exports = modifier(breakImplicitSentences);
}, {"nlcst-to-string":35,"../modifier":41,"../expressions":39}],
57: [function(require, module, exports) {
'use strict';

/*
 * Dependencies.
 */

var modifier;

modifier = require('../modifier');

/**
 * Remove empty children.
 *
 * @param {NLCSTNode} child
 * @param {number} index
 * @param {NLCSTParagraphNode} parent
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

module.exports = modifier(removeEmptyNodes);
}, {"../modifier":41}],
8: [function(require, module, exports) {
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
  'type': 'cst',
  'Parser': Parser,
  'Compiler': Compiler
});
}, {"unified":12,"parse-latin":60,"./lib/compile.js":61}],
60: [function(require, module, exports) {
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
}, {"./lib/parse-latin":62}],
62: [function(require, module, exports) {
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

        throw new Error('Illegal invocation: \'' + value + '\'' + ' is not a valid argument for \'ParseLatin\'');
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
            throw new Error('Illegal Invocation: Unsupported `key` for ' + '`use(key, plugins)`. Make sure `key` is a ' + 'supported function');
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

parseLatinPrototype.use('tokenizeSentence', [require('./plugin/merge-initial-word-symbol'), require('./plugin/merge-final-word-symbol'), require('./plugin/merge-inner-word-symbol'), require('./plugin/merge-initialisms'), require('./plugin/merge-words'), require('./plugin/patch-position')]);

parseLatinPrototype.use('tokenizeParagraph', [require('./plugin/merge-non-word-sentences'), require('./plugin/merge-affix-symbol'), require('./plugin/merge-initial-lower-case-letter-sentences'), require('./plugin/merge-prefix-exceptions'), require('./plugin/merge-affix-exceptions'), require('./plugin/merge-remaining-full-stops'), require('./plugin/make-initial-white-space-siblings'), require('./plugin/make-final-white-space-siblings'), require('./plugin/break-implicit-sentences'), require('./plugin/remove-empty-nodes'), require('./plugin/patch-position')]);

parseLatinPrototype.use('tokenizeRoot', [require('./plugin/make-initial-white-space-siblings'), require('./plugin/make-final-white-space-siblings'), require('./plugin/remove-empty-nodes'), require('./plugin/patch-position')]);

/*
 * == EXPORT =================================================================
 */

/*
 * Expose.
 */

module.exports = ParseLatin;
}, {"./parser":63,"./expressions":64,"./plugin/merge-initial-word-symbol":65,"./plugin/merge-final-word-symbol":66,"./plugin/merge-inner-word-symbol":67,"./plugin/merge-initialisms":68,"./plugin/merge-words":69,"./plugin/patch-position":70,"./plugin/merge-non-word-sentences":71,"./plugin/merge-affix-symbol":72,"./plugin/merge-initial-lower-case-letter-sentences":73,"./plugin/merge-prefix-exceptions":74,"./plugin/merge-affix-exceptions":75,"./plugin/merge-remaining-full-stops":76,"./plugin/make-initial-white-space-siblings":77,"./plugin/make-final-white-space-siblings":78,"./plugin/break-implicit-sentences":79,"./plugin/remove-empty-nodes":80}],
63: [function(require, module, exports) {
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
}, {"./tokenizer":81}],
81: [function(require, module, exports) {
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
            if (index === lastIndex || tokens[index].type === childType && expression.test(nlcstToString(tokens[index]))) {
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
}, {"nlcst-to-string":82}],
82: [function(require, module, exports) {
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
 * @return {string} - Stringified `node`.
 */
function nlcstToString(node) {
  var values;
  var length;
  var children;

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
    values[length] = nlcstToString(children[length]);
  }

  return values.join('');
}

/*
 * Expose.
 */

module.exports = nlcstToString;
}, {}],
64: [function(require, module, exports) {
/* This module is generated by `script/build-expressions.js` */
'use strict';
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
}, {}],
65: [function(require, module, exports) {
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

  if (child.type !== 'SymbolNode' && child.type !== 'PunctuationNode' || nlcstToString(child) !== '&') {
    return;
  }

  children = parent.children;

  next = children[index + 1];

  /*
   * If either a previous word, or no following word,
   * exists, exit early.
   */

  if (index !== 0 && children[index - 1].type === 'WordNode' || !(next && next.type === 'WordNode')) {
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
}, {"nlcst-to-string":82,"unist-util-modify-children":83}],
83: [function(require, module, exports) {
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
}, {"array-iterate":84}],
84: [function(require, module, exports) {
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
        throw new Error('TypeError: Iterate requires that |this| ' + 'not be ' + values);
    }

    if (!has.call(values, 'length')) {
        throw new Error('TypeError: Iterate requires that |this| ' + 'has a `length`');
    }

    if (typeof callback !== 'function') {
        throw new Error('TypeError: callback must be a function');
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
}, {}],
66: [function(require, module, exports) {
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

    if (index !== 0 && (child.type === 'SymbolNode' || child.type === 'PunctuationNode') && nlcstToString(child) === '-') {
        children = parent.children;

        prev = children[index - 1];
        next = children[index + 1];

        if ((!next || next.type !== 'WordNode') && (prev && prev.type === 'WordNode')) {
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
}, {"nlcst-to-string":82,"unist-util-modify-children":83}],
67: [function(require, module, exports) {
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

    if (index !== 0 && (child.type === 'SymbolNode' || child.type === 'PunctuationNode')) {
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
                } else if ((sibling.type === 'SymbolNode' || sibling.type === 'PunctuationNode') && EXPRESSION_INNER_WORD_SYMBOL.test(nlcstToString(sibling))) {
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
}, {"nlcst-to-string":82,"unist-util-modify-children":83,"../expressions":64}],
68: [function(require, module, exports) {
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

    if (index !== 0 && nlcstToString(child) === '.') {
        siblings = parent.children;

        prev = siblings[index - 1];
        children = prev.children;

        length = children && children.length;

        if (prev.type === 'WordNode' && length !== 1 && length % 2 !== 0) {
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
}, {"nlcst-to-string":82,"unist-util-modify-children":83,"../expressions":64}],
69: [function(require, module, exports) {
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
}, {"unist-util-modify-children":83}],
70: [function(require, module, exports) {
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

    if (index === 0 && (!node.position || /* istanbul ignore next */!node.position.start)) {
        patch(node);
        node.position.start = child.position.start;
    }

    if (index === siblings.length - 1 && (!node.position || !node.position.end)) {
        patch(node);
        node.position.end = child.position.end;
    }
}

/*
 * Expose `patchPosition` as a plugin.
 */

module.exports = visitChildren(patchPosition);
}, {"unist-util-visit-children":85}],
85: [function(require, module, exports) {
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
}, {}],
71: [function(require, module, exports) {
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
}, {"unist-util-modify-children":83}],
72: [function(require, module, exports) {
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

    if (children && children.length && index !== 0) {
        first = children[0];
        second = children[1];
        prev = parent.children[index - 1];

        if ((first.type === 'SymbolNode' || first.type === 'PunctuationNode') && EXPRESSION_AFFIX_SYMBOL.test(nlcstToString(first))) {
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
}, {"nlcst-to-string":82,"unist-util-modify-children":83,"../expressions":64}],
73: [function(require, module, exports) {
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

    if (children && children.length && index !== 0) {
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

            if (node.type === 'SymbolNode' || node.type === 'PunctuationNode') {
                return;
            }
        }
    }
}

/*
 * Expose `mergeInitialLowerCaseLetterSentences` as a modifier.
 */

module.exports = modifyChildren(mergeInitialLowerCaseLetterSentences);
}, {"nlcst-to-string":82,"unist-util-modify-children":83,"../expressions":64}],
74: [function(require, module, exports) {
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

var EXPRESSION_ABBREVIATION_PREFIX = new RegExp('^(' + '[0-9]+|' + '[a-z]|' +

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

'al|ca|cap|cca|cent|cf|cit|con|cp|cwt|ead|etc|ff|' + 'fl|ibid|id|nem|op|pro|seq|sic|stat|tem|viz' + ')$');

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

    if (children && children.length && index !== parent.children.length - 1) {
        node = children[children.length - 1];

        if (node && nlcstToString(node) === '.') {
            node = children[children.length - 2];

            if (node && node.type === 'WordNode' && EXPRESSION_ABBREVIATION_PREFIX.test(nlcstToString(node).toLowerCase())) {
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
}, {"nlcst-to-string":82,"unist-util-modify-children":83}],
75: [function(require, module, exports) {
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

        if (node.type === 'SymbolNode' || node.type === 'PunctuationNode') {
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
}, {"nlcst-to-string":82,"unist-util-modify-children":83}],
76: [function(require, module, exports) {
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

    if (grandchild.type !== 'SymbolNode' && grandchild.type !== 'PunctuationNode') {
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

      if (next && nextNext && next.type === 'WhiteSpaceNode' && nlcstToString(nextNext) === '.') {
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
}, {"nlcst-to-string":82,"unist-util-visit-children":85,"../expressions":64}],
77: [function(require, module, exports) {
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

  if (children && children.length !== 0 && children[0].type === 'WhiteSpaceNode') {
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
}, {"unist-util-visit-children":85}],
78: [function(require, module, exports) {
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

  if (children && children.length !== 0 && children[children.length - 1].type === 'WhiteSpaceNode') {
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
}, {"unist-util-modify-children":83}],
79: [function(require, module, exports) {
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

        if (node.type !== 'WhiteSpaceNode' || !EXPRESSION_MULTI_NEW_LINE.test(nlcstToString(node))) {
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
}, {"nlcst-to-string":82,"unist-util-modify-children":83,"../expressions":64}],
80: [function(require, module, exports) {
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
}, {"unist-util-modify-children":83}],
61: [function(require, module, exports) {
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
  return toString(this.file.namespace('retext').cst);
}

/*
 * Expose `compile`.
 */

Compiler.prototype.compile = compile;

/*
 * Expose.
 */

module.exports = Compiler;
}, {"nlcst-to-string":82}],
9: [function(require, module, exports) {
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
}, {"parse-english":86}],
86: [function(require, module, exports) {
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

var EXPRESSION_ABBREVIATION_ENGLISH_PREFIX = new RegExp('^(' +
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

'bbls?|cu|doz|fl|ft|gal|gr|gro|in|kt|lbs?|mi|oz|pt|qt|sq|tbsp|' + 'tsp|yds?|' +

/*
 * Abbreviations of time references:
 *
 * seconds, minutes, hours, Monday, Tuesday, *, Wednesday,
 * Thursday, *, Friday, Saturday, Sunday, January, Februari, March,
 * April, June, July, August, September, *, October, November,
 * December.
 */

'sec|min|hr|mon|tue|tues|wed|thu|thurs|fri|sat|sun|jan|feb|mar|' + 'apr|jun|jul|aug|sep|sept|oct|nov|dec' + ')$'
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

var EXPRESSION_ABBREVIATION_ENGLISH_PREFIX_SENSITIVE = new RegExp('^(' +
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

'Ave|Blvd|Mt|Rd|Bldgs?|Nat|Natl|Rt|Rte|Co|Pk|Sq|Dr|Pt|St|' + 'Ft|Pen|Terr|Hwy|Fwy|Pkwy|' +

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

'Ala|Ariz|Ark|Cal|Calif|Col|Colo|Conn|Del|Fla|Ga|Ida|Id|Ill|Ind|' + 'Ia|Kan|Kans|Ken|Ky|La|Me|Md|Mass|Mich|Minn|Miss|Mo|Mont|Neb|' + 'Nebr|Nev|Mex|Dak|Okla|Ok|Ore|Penna|Penn|Pa|Tenn|Tex|Ut|Vt|Va|' + 'Wash|Wis|Wisc|Wyo|' +

/*
 * Canadian province abbreviations:
 *
 * Alberta, Manitoba, Ontario, Quebec, *, Saskatchewan,
 * Yukon Territory.
 */

'Alta|Man|Ont|Qué|Que|Sask|Yuk|' +

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

'Beds|Berks|Bucks|Cambs|Ches|Corn|Cumb|Derbys|Derbs|Dev|Dor|Dur|' + 'Glos|Hants|Here|Heref|Herts|Hunts|Lancs|Leics|Lincs|Mx|Middx|Mddx|' + 'Norf|Northants|Northumb|Northd|Notts|Oxon|Rut|Shrops|Salop|Som|' + 'Staffs|Staf|Suff|Sy|Sx|Ssx|Warks|War|Warw|Westm|Wilts|Worcs|Yorks' + ')$');

/*
 * Match a blacklisted word which when followed by
 * an apostrophe depicts elision.
 */

var EXPRESSION_ELISION_ENGLISH_PREFIX = new RegExp('^(' +
/*
 * Includes:
 *
 * - o' > of;
 * - ol' > old.
 */

'o|ol' + ')$');

/*
 * Match a blacklisted word which when preceded by
 * an apostrophe depicts elision.
 */

var EXPRESSION_ELISION_ENGLISH_AFFIX = new RegExp('^(' +
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

'\\d\\ds?' + ')$');

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

  if (children && children.length && index !== parent.children.length - 1) {
    prev = children[children.length - 2];
    node = children[children.length - 1];

    if (node && prev && prev.type === 'WordNode' && nlcstToString(node) === '.') {
      prevValue = nlcstToString(prev);

      if (EXPRESSION_ABBREVIATION_ENGLISH_PREFIX_SENSITIVE.test(prevValue) || EXPRESSION_ABBREVIATION_ENGLISH_PREFIX.test(prevValue.toLowerCase())) {
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

  if (child.type !== 'PunctuationNode' && child.type !== 'SymbolNode') {
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

    if (index > 2 && index < length - 1 && node.type === 'WordNode' && siblings[index - 2].type === 'WhiteSpaceNode' && siblings[index + 1].type === 'WhiteSpaceNode' && EXPRESSION_ELISION_ENGLISH_PREFIX.test(nlcstToString(node).toLowerCase())) {
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

    if (index !== length - 1 && siblings[index + 1].type === 'WordNode' && (index === 0 || siblings[index - 1].type !== 'WordNode')) {
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
      } else if (value === 'n' && index < length - 2 && EXPRESSION_APOSTROPHE.test(nlcstToString(siblings[index + 2]))) {
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
function ParserPrototype() {}

ParserPrototype.prototype = Parser.prototype;

parserPrototype = new ParserPrototype();

ParseEnglish.prototype = parserPrototype;

/*
 * Add modifiers to `parser`.
 */

parserPrototype.tokenizeSentencePlugins = [visitChildren(mergeEnglishElisionExceptions)].concat(parserPrototype.tokenizeSentencePlugins);

parserPrototype.tokenizeParagraphPlugins = [modifyChildren(mergeEnglishPrefixExceptions)].concat(parserPrototype.tokenizeParagraphPlugins);

/*
 * Expose `ParseEnglish`.
 */

module.exports = ParseEnglish;
}, {"parse-latin":60,"nlcst-to-string":82,"unist-util-visit-children":85,"unist-util-modify-children":83}],
10: [function(require, module, exports) {
'use strict';

module.exports = require('./lib/equality.js');
}, {"./lib/equality.js":87}],
87: [function(require, module, exports) {
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
    return quote(violation, joiner) + ' may be insensitive, use ' + quote(suggestion, joiner) + ' instead';
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
        result[index] = value[index].charAt(0).toUpperCase() + value[index].slice(1);
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
 * @param {NLCSTNode} node - Node which violates.
 */
function warn(file, violation, suggestion, node, joiner) {
    if (!('join' in suggestion)) {
        suggestion = keys(suggestion);
    }

    if (isCapitalized(violation)) {
        suggestion = capitalize(suggestion);
    }

    file.warn(message(violation, suggestion, joiner), node);
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

        warn(file, valueOf(siblings.slice(match.start, match.end + 1)), pattern.considerate, siblings[match.start]);
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
                warn(file, phrases, suggestions, first, '/');
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

        if (next && next.parent === match.parent && next.type !== match.type) {
            start = match.end;
            end = next.start;

            while (++start < end) {
                sibling = siblings[start];

                if (sibling.type === 'WhiteSpaceNode' || sibling.type === 'WordNode' && /(and|or)/.test(toString(sibling))) {
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

        warn(file, valueOf(siblings.slice(match.start, match.end + 1)), pattern.considerate, siblings[match.start]);
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

            value = toString(child).toLowerCase();
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
}, {"object-keys":88,"unist-util-visit":89,"nlcst-to-string":82,"nlcst-is-literal":90,"./patterns.json":91}],
88: [function(require, module, exports) {
'use strict';

// modified from https://github.com/es-shims/es5-shim
var has = Object.prototype.hasOwnProperty;
var toStr = Object.prototype.toString;
var slice = Array.prototype.slice;
var isArgs = require('./isArguments');
var hasDontEnumBug = !({ 'toString': null }).propertyIsEnumerable('toString');
var hasProtoEnumBug = (function () {}).propertyIsEnumerable('prototype');
var dontEnums = ['toString', 'toLocaleString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'constructor'];
var equalsConstructorPrototype = function equalsConstructorPrototype(o) {
	var ctor = o.constructor;
	return ctor && ctor.prototype === o;
};
var blacklistedKeys = {
	$window: true,
	$console: true,
	$parent: true,
	$self: true,
	$frames: true,
	$webkitIndexedDB: true,
	$webkitStorageInfo: true
};
var hasAutomationEqualityBug = (function () {
	/* global window */
	if (typeof window === 'undefined') {
		return false;
	}
	for (var k in window) {
		if (!blacklistedKeys['$' + k] && has.call(window, k) && window[k] !== null && typeof window[k] === 'object') {
			try {
				equalsConstructorPrototype(window[k]);
			} catch (e) {
				return true;
			}
		}
	}
	return false;
})();
var equalsConstructorPrototypeIfNotBuggy = function equalsConstructorPrototypeIfNotBuggy(o) {
	/* global window */
	if (typeof window === 'undefined' && !hasAutomationEqualityBug) {
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
	if (!Object.keys) {
		Object.keys = keysShim;
	} else {
		var keysWorksWithArguments = (function () {
			// Safari 5.0 bug
			return (Object.keys(arguments) || '').length === 2;
		})(1, 2);
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
	}
	return Object.keys || keysShim;
};

module.exports = keysShim;
}, {"./isArguments":92}],
92: [function(require, module, exports) {
'use strict';

var toStr = Object.prototype.toString;

module.exports = function isArguments(value) {
	var str = toStr.call(value);
	var isArgs = str === '[object Arguments]';
	if (!isArgs) {
		isArgs = str !== '[object Array]' && value !== null && typeof value === 'object' && typeof value.length === 'number' && value.length >= 0 && toStr.call(value.callee) === '[object Function]';
	}
	return isArgs;
};
}, {}],
89: [function(require, module, exports) {
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
}, {}],
90: [function(require, module, exports) {
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
};

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

    if (!hasWordsBefore(parent, index) && nextDelimiter(parent, index, single) || !hasWordsAfter(parent, index) && previousDelimiter(parent, index, single) || isWrapped(parent, index, pairs)) {
        return true;
    }

    return false;
}

/*
 * Expose.
 */

module.exports = isLiteral;
}, {"nlcst-to-string":82}],
91: [function(require, module, exports) {
module.exports = [
  {
    "type": "or",
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
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 0
  },
  {
    "type": "or",
    "considerate": {
      "they": "a",
      "it": "a"
    },
    "inconsiderate": {
      "she": "female",
      "he": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 1
  },
  {
    "type": "or",
    "considerate": {
      "themselves": "a",
      "theirself": "a",
      "self": "a"
    },
    "inconsiderate": {
      "herself": "female",
      "himself": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 2
  },
  {
    "type": "or",
    "considerate": {
      "kid": "a",
      "child": "a"
    },
    "inconsiderate": {
      "girl": "female",
      "boy": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 3
  },
  {
    "type": "or",
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
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 4
  },
  {
    "type": "or",
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
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 5
  },
  {
    "type": "or",
    "considerate": {
      "native land": "a"
    },
    "inconsiderate": {
      "motherland": "female",
      "fatherland": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 6
  },
  {
    "type": "or",
    "considerate": {
      "native tongue": "a",
      "native language": "a"
    },
    "inconsiderate": {
      "mother tongue": "female",
      "father tongue": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 7
  },
  {
    "type": "or",
    "considerate": {
      "first-year students": "a",
      "freshers": "a"
    },
    "inconsiderate": {
      "freshwomen": "female",
      "freshmen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 8
  },
  {
    "type": "or",
    "considerate": {
      "garbage collector": "a",
      "waste collector": "a",
      "trash collector": "a"
    },
    "inconsiderate": {
      "garbagewoman": "female",
      "garbageman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 9
  },
  {
    "type": "or",
    "considerate": {
      "garbage collectors": "a",
      "waste collectors": "a",
      "trash collectors": "a"
    },
    "inconsiderate": {
      "garbagewomen": "female",
      "garbagemen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 10
  },
  {
    "type": "or",
    "considerate": {
      "chair": "a",
      "chairperson": "a",
      "coordinator": "a"
    },
    "inconsiderate": {
      "chairwoman": "female",
      "chairman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 11
  },
  {
    "type": "or",
    "considerate": {
      "committee member": "a"
    },
    "inconsiderate": {
      "committee woman": "female",
      "committee man": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 12
  },
  {
    "type": "or",
    "considerate": {
      "cowhand": "a"
    },
    "inconsiderate": {
      "cowgirl": "female",
      "cowboy": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 13
  },
  {
    "type": "or",
    "considerate": {
      "cowhands": "a"
    },
    "inconsiderate": {
      "cowgirls": "female",
      "cowboys": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 14
  },
  {
    "type": "or",
    "considerate": {
      "cattle rancher": "a"
    },
    "inconsiderate": {
      "cattlewoman": "female",
      "cattleman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 15
  },
  {
    "type": "or",
    "considerate": {
      "cattle ranchers": "a"
    },
    "inconsiderate": {
      "cattlewomen": "female",
      "cattlemen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 16
  },
  {
    "type": "or",
    "considerate": {
      "chairs": "a",
      "chairpersons": "a",
      "coordinators": "a"
    },
    "inconsiderate": {
      "chairwomen": "female",
      "chairmen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 17
  },
  {
    "type": "or",
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
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 18
  },
  {
    "type": "or",
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
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 19
  },
  {
    "type": "or",
    "considerate": {
      "officer": "a",
      "police officer": "a"
    },
    "inconsiderate": {
      "policewoman": "female",
      "policeman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 20
  },
  {
    "type": "or",
    "considerate": {
      "officers": "a",
      "police officers": "a"
    },
    "inconsiderate": {
      "policewomen": "female",
      "policemen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 21
  },
  {
    "type": "or",
    "considerate": {
      "flight attendant": "a"
    },
    "inconsiderate": {
      "stewardess": "female",
      "steward": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 22
  },
  {
    "type": "or",
    "considerate": {
      "flight attendants": "a"
    },
    "inconsiderate": {
      "stewardesses": "female",
      "stewards": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 23
  },
  {
    "type": "or",
    "considerate": {
      "member of congress": "a",
      "congress person": "a",
      "legislator": "a",
      "representative": "a"
    },
    "inconsiderate": {
      "congresswoman": "female",
      "congressman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 24
  },
  {
    "type": "or",
    "considerate": {
      "member of congresss": "a",
      "congress persons": "a",
      "legislators": "a",
      "representatives": "a"
    },
    "inconsiderate": {
      "congresswomen": "female",
      "congressmen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 25
  },
  {
    "type": "or",
    "considerate": {
      "fire fighter": "a"
    },
    "inconsiderate": {
      "firewoman": "female",
      "fireman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 26
  },
  {
    "type": "or",
    "considerate": {
      "fire fighters": "a"
    },
    "inconsiderate": {
      "firewomen": "female",
      "firemen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 27
  },
  {
    "type": "or",
    "considerate": {
      "fisher": "a",
      "crew member": "a"
    },
    "inconsiderate": {
      "fisherwoman": "female",
      "fisherman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 28
  },
  {
    "type": "or",
    "considerate": {
      "fishers": "a"
    },
    "inconsiderate": {
      "fisherwomen": "female",
      "fishermen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 29
  },
  {
    "type": "or",
    "considerate": {
      "kinship": "a",
      "community": "a"
    },
    "inconsiderate": {
      "sisterhood": "female",
      "brotherhood": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 30
  },
  {
    "type": "or",
    "considerate": {
      "common person": "a",
      "average person": "a"
    },
    "inconsiderate": {
      "common girl": "female",
      "common man": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 31
  },
  {
    "type": "or",
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
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 32
  },
  {
    "type": "or",
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
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 33
  },
  {
    "type": "or",
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
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 34
  },
  {
    "type": "or",
    "considerate": {
      "cleaners": "a"
    },
    "inconsiderate": {
      "cleaning ladies": "female",
      "cleaning girls": "female",
      "janitresses": "female",
      "cleaning men": "male",
      "janitors": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 35
  },
  {
    "type": "or",
    "considerate": {
      "courier": "a",
      "messenger": "a"
    },
    "inconsiderate": {
      "delivery girl": "female",
      "delivery boy": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 36
  },
  {
    "type": "or",
    "considerate": {
      "supervisor": "a",
      "shift boss": "a"
    },
    "inconsiderate": {
      "forewoman": "female",
      "foreman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 37
  },
  {
    "type": "or",
    "considerate": {
      "lead": "a",
      "front": "a",
      "figurehead": "a"
    },
    "inconsiderate": {
      "frontwoman, front woman": "female",
      "frontman, front man": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 38
  },
  {
    "type": "or",
    "considerate": {
      "figureheads": "a"
    },
    "inconsiderate": {
      "front women, frontwomen": "female",
      "front men, frontmen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 39
  },
  {
    "type": "or",
    "considerate": {
      "supervisors": "a",
      "shift bosses": "a"
    },
    "inconsiderate": {
      "forewomen": "female",
      "foremen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 40
  },
  {
    "type": "or",
    "considerate": {
      "insurance agent": "a"
    },
    "inconsiderate": {
      "insurance woman": "female",
      "insurance man": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 41
  },
  {
    "type": "or",
    "considerate": {
      "insurance agents": "a"
    },
    "inconsiderate": {
      "insurance women": "female",
      "insurance men": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 42
  },
  {
    "type": "or",
    "considerate": {
      "proprietor": "a",
      "building manager": "a"
    },
    "inconsiderate": {
      "landlady": "female",
      "landlord": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 43
  },
  {
    "type": "or",
    "considerate": {
      "proprietors": "a",
      "building managers": "a"
    },
    "inconsiderate": {
      "landladies": "female",
      "landlords": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 44
  },
  {
    "type": "or",
    "considerate": {
      "graduate": "a"
    },
    "inconsiderate": {
      "alumna": "female",
      "alumnus": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 45
  },
  {
    "type": "or",
    "considerate": {
      "graduates": "a"
    },
    "inconsiderate": {
      "alumnae": "female",
      "alumni": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 46
  },
  {
    "type": "or",
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
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 47
  },
  {
    "type": "or",
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
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 48
  },
  {
    "type": "or",
    "considerate": {
      "repairer": "a",
      "technician": "a"
    },
    "inconsiderate": {
      "repairwoman": "female",
      "repairman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 49
  },
  {
    "type": "or",
    "considerate": {
      "technicians": "a"
    },
    "inconsiderate": {
      "repairwomen": "female",
      "repairmen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 50
  },
  {
    "type": "or",
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
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 51
  },
  {
    "type": "or",
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
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 52
  },
  {
    "type": "or",
    "considerate": {
      "soldier": "a",
      "service representative": "a"
    },
    "inconsiderate": {
      "servicewoman": "female",
      "serviceman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 53
  },
  {
    "type": "or",
    "considerate": {
      "soldiers": "a",
      "service representatives": "a"
    },
    "inconsiderate": {
      "servicewomen": "female",
      "servicemen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 54
  },
  {
    "type": "or",
    "considerate": {
      "server": "a"
    },
    "inconsiderate": {
      "waitress": "female",
      "waiter": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 55
  },
  {
    "type": "or",
    "considerate": {
      "servers": "a"
    },
    "inconsiderate": {
      "waitresses": "female",
      "waiters": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 56
  },
  {
    "type": "or",
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
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 57
  },
  {
    "type": "or",
    "considerate": {
      "workers": "a"
    },
    "inconsiderate": {
      "workwomen": "female",
      "workmen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 58
  },
  {
    "type": "or",
    "considerate": {
      "performer": "a",
      "star": "a",
      "artist": "a"
    },
    "inconsiderate": {
      "actress": "female",
      "actor": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 59
  },
  {
    "type": "or",
    "considerate": {
      "performers": "a",
      "stars": "a",
      "artists": "a"
    },
    "inconsiderate": {
      "actresses": "female",
      "actors": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 60
  },
  {
    "type": "or",
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
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 61
  },
  {
    "type": "or",
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
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 62
  },
  {
    "type": "or",
    "considerate": {
      "cabinet member": "a"
    },
    "inconsiderate": {
      "alderwoman": "female",
      "alderman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 63
  },
  {
    "type": "or",
    "considerate": {
      "cabinet": "a",
      "cabinet members": "a"
    },
    "inconsiderate": {
      "alderwomen": "female",
      "aldermen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 64
  },
  {
    "type": "or",
    "considerate": {
      "assembly person": "a",
      "assembly worker": "a"
    },
    "inconsiderate": {
      "assemblywoman": "female",
      "assemblyman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 65
  },
  {
    "type": "or",
    "considerate": {
      "relative": "a"
    },
    "inconsiderate": {
      "kinswoman": "female",
      "aunt": "female",
      "kinsman": "male",
      "uncle": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 66
  },
  {
    "type": "or",
    "considerate": {
      "relatives": "a"
    },
    "inconsiderate": {
      "kinswomen": "female",
      "aunts": "female",
      "kinsmen": "male",
      "uncles": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 67
  },
  {
    "type": "or",
    "considerate": {
      "klansperson": "a"
    },
    "inconsiderate": {
      "klanswoman": "female",
      "klansman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 68
  },
  {
    "type": "or",
    "considerate": {
      "clansperson": "a",
      "clan member": "a"
    },
    "inconsiderate": {
      "clanswoman": "female",
      "clansman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 69
  },
  {
    "type": "or",
    "considerate": {
      "klan": "a",
      "klanspersons": "a"
    },
    "inconsiderate": {
      "klanswomen": "female",
      "klansmen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 70
  },
  {
    "type": "or",
    "considerate": {
      "boogey": "a"
    },
    "inconsiderate": {
      "boogeywoman": "female",
      "boogeyman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 71
  },
  {
    "type": "or",
    "considerate": {
      "boogie": "a"
    },
    "inconsiderate": {
      "boogiewoman": "female",
      "boogieman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 72
  },
  {
    "type": "or",
    "considerate": {
      "bogey": "a"
    },
    "inconsiderate": {
      "bogeywoman": "female",
      "bogeyman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 73
  },
  {
    "type": "or",
    "considerate": {
      "bogie": "a"
    },
    "inconsiderate": {
      "bogiewoman": "female",
      "bogieman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 74
  },
  {
    "type": "or",
    "considerate": {
      "boogies": "a"
    },
    "inconsiderate": {
      "boogiewomen": "female",
      "boogiemen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 75
  },
  {
    "type": "or",
    "considerate": {
      "bogies": "a"
    },
    "inconsiderate": {
      "bogiewomen": "female",
      "bogiemen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 76
  },
  {
    "type": "or",
    "considerate": {
      "bonder": "a"
    },
    "inconsiderate": {
      "bondswoman": "female",
      "bondsman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 77
  },
  {
    "type": "or",
    "considerate": {
      "bonders": "a"
    },
    "inconsiderate": {
      "bondswomen": "female",
      "bondsmen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 78
  },
  {
    "type": "or",
    "considerate": {
      "partner": "a",
      "significant other": "a",
      "spouse": "a"
    },
    "inconsiderate": {
      "wife": "female",
      "husband": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 79
  },
  {
    "type": "or",
    "considerate": {
      "partners": "a",
      "significant others": "a",
      "spouses": "a"
    },
    "inconsiderate": {
      "wives": "female",
      "husbands": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 80
  },
  {
    "type": "or",
    "considerate": {
      "partner": "a",
      "friend": "a",
      "significant other": "a"
    },
    "inconsiderate": {
      "girlfriend": "female",
      "boyfriend": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 81
  },
  {
    "type": "or",
    "considerate": {
      "partners": "a",
      "friends": "a",
      "significant others": "a"
    },
    "inconsiderate": {
      "girlfriends": "female",
      "boyfriends": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 82
  },
  {
    "type": "or",
    "considerate": {
      "childhood": "a"
    },
    "inconsiderate": {
      "girlhood": "female",
      "boyhood": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 83
  },
  {
    "type": "or",
    "considerate": {
      "childish": "a"
    },
    "inconsiderate": {
      "girly": "female",
      "girlish": "female",
      "boyish": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 84
  },
  {
    "type": "or",
    "considerate": {
      "traveler": "a"
    },
    "inconsiderate": {
      "journeywoman": "female",
      "journeyman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 85
  },
  {
    "type": "or",
    "considerate": {
      "travelers": "a"
    },
    "inconsiderate": {
      "journeywomen": "female",
      "journeymen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 86
  },
  {
    "type": "or",
    "considerate": {
      "godparent": "a",
      "elder": "a",
      "patron": "a"
    },
    "inconsiderate": {
      "godmother": "female",
      "patroness": "female",
      "godfather": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 87
  },
  {
    "type": "or",
    "considerate": {
      "grandchild": "a"
    },
    "inconsiderate": {
      "granddaughter": "female",
      "grandson": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 88
  },
  {
    "type": "or",
    "considerate": {
      "grandchildred": "a"
    },
    "inconsiderate": {
      "granddaughters": "female",
      "grandsons": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 89
  },
  {
    "type": "or",
    "considerate": {
      "ancestor": "a"
    },
    "inconsiderate": {
      "foremother": "female",
      "forefather": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 90
  },
  {
    "type": "or",
    "considerate": {
      "ancestors": "a"
    },
    "inconsiderate": {
      "foremothers": "female",
      "forefathers": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 91
  },
  {
    "type": "or",
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
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 92
  },
  {
    "type": "or",
    "considerate": {
      "grandparents": "a",
      "ancestors": "a"
    },
    "inconsiderate": {
      "grandmothers": "female",
      "grandfathers": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 93
  },
  {
    "type": "or",
    "considerate": {
      "spouse": "a"
    },
    "inconsiderate": {
      "bride": "female",
      "groom": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 94
  },
  {
    "type": "or",
    "considerate": {
      "sibling": "a"
    },
    "inconsiderate": {
      "sister": "female",
      "brother": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 95
  },
  {
    "type": "or",
    "considerate": {
      "siblings": "a"
    },
    "inconsiderate": {
      "sisters": "female",
      "brothers": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 96
  },
  {
    "type": "or",
    "considerate": {
      "camera operator": "a",
      "camera person": "a"
    },
    "inconsiderate": {
      "camerawoman": "female",
      "cameraman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 97
  },
  {
    "type": "or",
    "considerate": {
      "camera operators": "a"
    },
    "inconsiderate": {
      "camerawomen": "female",
      "cameramen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 98
  },
  {
    "type": "or",
    "considerate": {
      "troglodyte": "a",
      "hominidae": "a"
    },
    "inconsiderate": {
      "cavewoman": "female",
      "caveman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 99
  },
  {
    "type": "or",
    "considerate": {
      "troglodytae": "a",
      "troglodyti": "a",
      "troglodytes": "a",
      "hominids": "a"
    },
    "inconsiderate": {
      "cavewomen": "female",
      "cavemen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 100
  },
  {
    "type": "or",
    "considerate": {
      "clergyperson": "a",
      "clergy": "a",
      "cleric": "a"
    },
    "inconsiderate": {
      "clergywomen": "female",
      "clergyman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 101
  },
  {
    "type": "or",
    "considerate": {
      "clergies": "a",
      "clerics": "a"
    },
    "inconsiderate": {
      "clergywomen": "female",
      "clergymen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 102
  },
  {
    "type": "or",
    "considerate": {
      "council member": "a"
    },
    "inconsiderate": {
      "councilwoman": "female",
      "councilman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 103
  },
  {
    "type": "or",
    "considerate": {
      "council members": "a"
    },
    "inconsiderate": {
      "councilwomen": "female",
      "councilmen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 104
  },
  {
    "type": "or",
    "considerate": {
      "country person": "a"
    },
    "inconsiderate": {
      "countrywoman": "female",
      "countryman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 105
  },
  {
    "type": "or",
    "considerate": {
      "country folk": "a"
    },
    "inconsiderate": {
      "countrywomen": "female",
      "countrymen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 106
  },
  {
    "type": "or",
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
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 107
  },
  {
    "type": "or",
    "considerate": {
      "presenter": "a"
    },
    "inconsiderate": {
      "hostess": "female",
      "host": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 108
  },
  {
    "type": "or",
    "considerate": {
      "presenters": "a"
    },
    "inconsiderate": {
      "hostesses": "female",
      "hosts": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 109
  },
  {
    "type": "or",
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
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 110
  },
  {
    "type": "or",
    "considerate": {
      "guillotine": "a"
    },
    "inconsiderate": {
      "hangwoman": "female",
      "hangman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 111
  },
  {
    "type": "or",
    "considerate": {
      "guillotines": "a"
    },
    "inconsiderate": {
      "hangwomen": "female",
      "hangmen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 112
  },
  {
    "type": "or",
    "considerate": {
      "sidekick": "a"
    },
    "inconsiderate": {
      "henchwoman": "female",
      "henchman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 113
  },
  {
    "type": "or",
    "considerate": {
      "sidekicks": "a"
    },
    "inconsiderate": {
      "henchwomen": "female",
      "henchmen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 114
  },
  {
    "type": "or",
    "considerate": {
      "role-model": "a"
    },
    "inconsiderate": {
      "heroine": "female",
      "hero": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 115
  },
  {
    "type": "or",
    "considerate": {
      "role-models": "a"
    },
    "inconsiderate": {
      "heroines": "female",
      "heroes": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 116
  },
  {
    "type": "or",
    "considerate": {
      "parental": "a",
      "warm": "a",
      "intimate": "a"
    },
    "inconsiderate": {
      "maternal": "female",
      "paternal": "male",
      "fraternal": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 117
  },
  {
    "type": "or",
    "considerate": {
      "parental": "a"
    },
    "inconsiderate": {
      "maternity": "female",
      "paternity": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 118
  },
  {
    "type": "or",
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
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 119
  },
  {
    "type": "or",
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
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 120
  },
  {
    "type": "or",
    "considerate": {
      "child": "a"
    },
    "inconsiderate": {
      "daughter": "female",
      "son": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 121
  },
  {
    "type": "or",
    "considerate": {
      "children": "a"
    },
    "inconsiderate": {
      "daughters": "female",
      "sons": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 122
  },
  {
    "type": "or",
    "considerate": {
      "convierge": "a"
    },
    "inconsiderate": {
      "doorwoman": "female",
      "doorman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 123
  },
  {
    "type": "or",
    "considerate": {
      "convierges": "a"
    },
    "inconsiderate": {
      "doorwomen": "female",
      "doormen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 124
  },
  {
    "type": "or",
    "considerate": {
      "humanly": "a",
      "mature": "a"
    },
    "inconsiderate": {
      "feminin": "female",
      "dudely": "male",
      "manly": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 125
  },
  {
    "type": "or",
    "considerate": {
      "humans": "a"
    },
    "inconsiderate": {
      "females": "female",
      "males": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 126
  },
  {
    "type": "or",
    "considerate": {
      "ruler": "a"
    },
    "inconsiderate": {
      "empress": "female",
      "queen": "female",
      "emperor": "male",
      "king": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 127
  },
  {
    "type": "or",
    "considerate": {
      "rulers": "a"
    },
    "inconsiderate": {
      "empresses": "female",
      "queens": "female",
      "emperors": "male",
      "kings": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 128
  },
  {
    "type": "or",
    "considerate": {
      "jumbo": "a",
      "gigantic": "a"
    },
    "inconsiderate": {
      "queen-size": "female",
      "king-size": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 129
  },
  {
    "type": "or",
    "considerate": {
      "power behind the throne": "a"
    },
    "inconsiderate": {
      "queenmaker": "female",
      "kingmaker": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 130
  },
  {
    "type": "or",
    "considerate": {
      "civilian": "a"
    },
    "inconsiderate": {
      "laywoman": "female",
      "layman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 131
  },
  {
    "type": "or",
    "considerate": {
      "civilians": "a"
    },
    "inconsiderate": {
      "laywomen": "female",
      "laymen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 132
  },
  {
    "type": "or",
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
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 133
  },
  {
    "type": "or",
    "considerate": {
      "officials": "a",
      "masters": "a",
      "chiefs": "a",
      "rulers": "a"
    },
    "inconsiderate": {
      "dames": "female",
      "lords": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 134
  },
  {
    "type": "or",
    "considerate": {
      "adulthood": "a",
      "personhood": "a"
    },
    "inconsiderate": {
      "girlhood": "female",
      "masculinity": "male",
      "manhood": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 135
  },
  {
    "type": "or",
    "considerate": {
      "humanity": "a"
    },
    "inconsiderate": {
      "femininity": "female",
      "manliness": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 136
  },
  {
    "type": "or",
    "considerate": {
      "shooter": "a"
    },
    "inconsiderate": {
      "markswoman": "female",
      "marksman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 137
  },
  {
    "type": "or",
    "considerate": {
      "shooters": "a"
    },
    "inconsiderate": {
      "markswomen": "female",
      "marksmen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 138
  },
  {
    "type": "or",
    "considerate": {
      "intermediary": "a",
      "go-between": "a"
    },
    "inconsiderate": {
      "middlewoman": "female",
      "middleman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 139
  },
  {
    "type": "or",
    "considerate": {
      "intermediaries": "a",
      "go-betweens": "a"
    },
    "inconsiderate": {
      "middlewomen": "female",
      "middlemen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 140
  },
  {
    "type": "or",
    "considerate": {
      "milk person": "a"
    },
    "inconsiderate": {
      "milkwoman": "female",
      "milkman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 141
  },
  {
    "type": "or",
    "considerate": {
      "milk people": "a"
    },
    "inconsiderate": {
      "milkwomen": "female",
      "milkmen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 142
  },
  {
    "type": "or",
    "considerate": {
      "nibling": "a",
      "sibling’s child": "a"
    },
    "inconsiderate": {
      "niece": "female",
      "nephew": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 143
  },
  {
    "type": "or",
    "considerate": {
      "niblings": "a",
      "sibling’s children": "a"
    },
    "inconsiderate": {
      "nieces": "female",
      "nephews": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 144
  },
  {
    "type": "or",
    "considerate": {
      "noble": "a"
    },
    "inconsiderate": {
      "noblewoman": "female",
      "nobleman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 145
  },
  {
    "type": "or",
    "considerate": {
      "nobles": "a"
    },
    "inconsiderate": {
      "noblewomen": "female",
      "noblemen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 146
  },
  {
    "type": "or",
    "considerate": {
      "notary": "a",
      "consumer advocate": "a",
      "trouble shooter": "a"
    },
    "inconsiderate": {
      "ombudswoman": "female",
      "ombudsman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 147
  },
  {
    "type": "or",
    "considerate": {
      "notaries": "a"
    },
    "inconsiderate": {
      "ombudswomen": "female",
      "ombudsmen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 148
  },
  {
    "type": "or",
    "considerate": {
      "heir": "a"
    },
    "inconsiderate": {
      "princess": "female",
      "prince": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 149
  },
  {
    "type": "or",
    "considerate": {
      "heirs": "a"
    },
    "inconsiderate": {
      "princesses": "female",
      "princes": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 150
  },
  {
    "type": "or",
    "considerate": {
      "fairy": "a"
    },
    "inconsiderate": {
      "sandwoman": "female",
      "sandman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 151
  },
  {
    "type": "or",
    "considerate": {
      "fairies": "a"
    },
    "inconsiderate": {
      "sandwomen": "female",
      "sandmen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 152
  },
  {
    "type": "or",
    "considerate": {
      "promoter": "a"
    },
    "inconsiderate": {
      "showwoman": "female",
      "showman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 153
  },
  {
    "type": "or",
    "considerate": {
      "promoters": "a"
    },
    "inconsiderate": {
      "showwomen": "female",
      "show women": "female",
      "showmen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 154
  },
  {
    "type": "or",
    "considerate": {
      "astronaut": "a"
    },
    "inconsiderate": {
      "spacewoman": "female",
      "spaceman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 155
  },
  {
    "type": "or",
    "considerate": {
      "astronauts": "a"
    },
    "inconsiderate": {
      "spacewomen": "female",
      "spacemen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 156
  },
  {
    "type": "or",
    "considerate": {
      "speaker": "a",
      "spokesperson": "a",
      "representative": "a"
    },
    "inconsiderate": {
      "spokeswoman": "female",
      "spokesman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 157
  },
  {
    "type": "or",
    "considerate": {
      "speakers": "a",
      "spokespersons": "a"
    },
    "inconsiderate": {
      "spokeswomen": "female",
      "spokesmen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 158
  },
  {
    "type": "or",
    "considerate": {
      "athlete": "a",
      "sports person": "a"
    },
    "inconsiderate": {
      "sportswoman": "female",
      "sportsman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 159
  },
  {
    "type": "or",
    "considerate": {
      "athletes": "a",
      "sports persons": "a"
    },
    "inconsiderate": {
      "sportswomen": "female",
      "sportsmen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 160
  },
  {
    "type": "or",
    "considerate": {
      "senator": "a"
    },
    "inconsiderate": {
      "stateswoman": "female",
      "statesman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 161
  },
  {
    "type": "or",
    "considerate": {
      "step-sibling": "a"
    },
    "inconsiderate": {
      "stepsister": "female",
      "stepbrother": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 162
  },
  {
    "type": "or",
    "considerate": {
      "step-siblings": "a"
    },
    "inconsiderate": {
      "stepsisters": "female",
      "stepbrothers": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 163
  },
  {
    "type": "or",
    "considerate": {
      "step-parent": "a"
    },
    "inconsiderate": {
      "stepmom": "female",
      "stepmother": "female",
      "stepdad": "male",
      "stepfather": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 164
  },
  {
    "type": "or",
    "considerate": {
      "step-parents": "a"
    },
    "inconsiderate": {
      "stepmothers": "female",
      "stepfathers": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 165
  },
  {
    "type": "or",
    "considerate": {
      "titan": "a"
    },
    "inconsiderate": {
      "superwoman": "female",
      "superman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 166
  },
  {
    "type": "or",
    "considerate": {
      "titans": "a"
    },
    "inconsiderate": {
      "superwomen": "female",
      "supermen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 167
  },
  {
    "type": "or",
    "considerate": {
      "inhumane": "a"
    },
    "inconsiderate": {
      "unwomanly": "female",
      "unwomenly": "female",
      "unmanly": "male",
      "unmenly": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 168
  },
  {
    "type": "or",
    "considerate": {
      "watcher": "a"
    },
    "inconsiderate": {
      "watchwoman": "female",
      "watchman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 169
  },
  {
    "type": "or",
    "considerate": {
      "watchers": "a"
    },
    "inconsiderate": {
      "watchwomen": "female",
      "watchmen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 170
  },
  {
    "type": "or",
    "considerate": {
      "weather forecaster": "a",
      "meteorologist": "a"
    },
    "inconsiderate": {
      "weatherwoman": "female",
      "weatherman": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 171
  },
  {
    "type": "or",
    "considerate": {
      "weather forecasters": "a",
      "meteorologists": "a"
    },
    "inconsiderate": {
      "weatherwomen": "female",
      "weathermen": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 172
  },
  {
    "type": "or",
    "considerate": {
      "bereaved": "a"
    },
    "inconsiderate": {
      "widow": "female",
      "widows": "female",
      "widower": "male",
      "widowers": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 173
  },
  {
    "type": "or",
    "considerate": {
      "own person": "a"
    },
    "inconsiderate": {
      "own woman": "female",
      "own man": "male"
    },
    "categories": [
      "female",
      "male"
    ],
    "id": 174
  },
  {
    "type": "simple",
    "considerate": {
      "french": "a"
    },
    "inconsiderate": {
      "frenchmen": "male"
    },
    "categories": [
      "male"
    ],
    "id": 175
  },
  {
    "type": "simple",
    "considerate": {
      "courteous": "a",
      "cultured": "a"
    },
    "inconsiderate": {
      "ladylike": "female"
    },
    "categories": [
      "female"
    ],
    "id": 176
  },
  {
    "type": "simple",
    "considerate": {
      "resolutely": "a",
      "bravely": "a"
    },
    "inconsiderate": {
      "like a man": "male"
    },
    "categories": [
      "male"
    ],
    "id": 177
  },
  {
    "type": "simple",
    "considerate": {
      "birth name": "a"
    },
    "inconsiderate": {
      "maiden name": "female"
    },
    "categories": [
      "female"
    ],
    "id": 178
  },
  {
    "type": "simple",
    "considerate": {
      "first voyage": "a"
    },
    "inconsiderate": {
      "maiden voyage": "female"
    },
    "categories": [
      "female"
    ],
    "id": 179
  },
  {
    "type": "simple",
    "considerate": {
      "strong enough": "a"
    },
    "inconsiderate": {
      "man enough": "male"
    },
    "categories": [
      "male"
    ],
    "id": 180
  },
  {
    "type": "simple",
    "considerate": {
      "upstaging": "a",
      "competitiveness": "a"
    },
    "inconsiderate": {
      "oneupmanship": "male"
    },
    "categories": [
      "male"
    ],
    "id": 181
  },
  {
    "type": "simple",
    "considerate": {
      "ms.": "a"
    },
    "inconsiderate": {
      "miss.": "female",
      "mrs.": "female"
    },
    "categories": [
      "female"
    ],
    "id": 182
  },
  {
    "type": "simple",
    "considerate": {
      "manufactured": "a",
      "artificial": "a",
      "synthetic": "a",
      "machine-made": "a"
    },
    "inconsiderate": {
      "manmade": "male"
    },
    "categories": [
      "male"
    ],
    "id": 183
  },
  {
    "type": "simple",
    "considerate": {
      "dynamo": "a"
    },
    "inconsiderate": {
      "man of action": "male"
    },
    "categories": [
      "male"
    ],
    "id": 184
  },
  {
    "type": "simple",
    "considerate": {
      "scholar": "a",
      "writer": "a",
      "literary figure": "a"
    },
    "inconsiderate": {
      "man of letters": "male"
    },
    "categories": [
      "male"
    ],
    "id": 185
  },
  {
    "type": "simple",
    "considerate": {
      "sophisticate": "a"
    },
    "inconsiderate": {
      "man of the world": "male"
    },
    "categories": [
      "male"
    ],
    "id": 186
  },
  {
    "type": "simple",
    "considerate": {
      "camaraderie": "a"
    },
    "inconsiderate": {
      "fellowship": "male"
    },
    "categories": [
      "male"
    ],
    "id": 187
  },
  {
    "type": "simple",
    "considerate": {
      "first-year student": "a",
      "fresher": "a"
    },
    "inconsiderate": {
      "freshman": "male",
      "freshwoman": "male"
    },
    "categories": [
      "male"
    ],
    "id": 188
  },
  {
    "type": "simple",
    "considerate": {
      "quality construction": "a",
      "expertise": "a"
    },
    "inconsiderate": {
      "workmanship": "male"
    },
    "categories": [
      "male"
    ],
    "id": 189
  },
  {
    "type": "simple",
    "considerate": {
      "homemaker": "a",
      "homeworker": "a"
    },
    "inconsiderate": {
      "housewife": "female"
    },
    "categories": [
      "female"
    ],
    "id": 190
  },
  {
    "type": "simple",
    "considerate": {
      "homemakers": "a",
      "homeworkers": "a"
    },
    "inconsiderate": {
      "housewifes": "female"
    },
    "categories": [
      "female"
    ],
    "id": 191
  },
  {
    "type": "simple",
    "considerate": {
      "loving": "a",
      "warm": "a",
      "nurturing": "a"
    },
    "inconsiderate": {
      "motherly": "female"
    },
    "categories": [
      "female"
    ],
    "id": 192
  },
  {
    "type": "simple",
    "considerate": {
      "human resources": "a"
    },
    "inconsiderate": {
      "manpower": "male"
    },
    "categories": [
      "male"
    ],
    "id": 193
  },
  {
    "type": "simple",
    "considerate": {
      "emcee": "a",
      "moderator": "a",
      "convenor": "a"
    },
    "inconsiderate": {
      "master of ceremonies": "male"
    },
    "categories": [
      "male"
    ],
    "id": 194
  },
  {
    "type": "simple",
    "considerate": {
      "skilled": "a",
      "authoritative": "a",
      "commanding": "a"
    },
    "inconsiderate": {
      "masterful": "male"
    },
    "categories": [
      "male"
    ],
    "id": 195
  },
  {
    "type": "simple",
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
    },
    "categories": [
      "male"
    ],
    "id": 196
  },
  {
    "type": "simple",
    "considerate": {
      "work of genius": "a",
      "chef d’oeuvre": "a"
    },
    "inconsiderate": {
      "masterpiece": "male"
    },
    "categories": [
      "male"
    ],
    "id": 197
  },
  {
    "type": "simple",
    "considerate": {
      "vision": "a",
      "comprehensive plan": "a"
    },
    "inconsiderate": {
      "masterplan": "male"
    },
    "categories": [
      "male"
    ],
    "id": 198
  },
  {
    "type": "simple",
    "considerate": {
      "trump card": "a",
      "stroke of genius": "a"
    },
    "inconsiderate": {
      "masterstroke": "male"
    },
    "categories": [
      "male"
    ],
    "id": 199
  },
  {
    "type": "simple",
    "considerate": {
      "sociopath": "a"
    },
    "inconsiderate": {
      "madman": "male",
      "mad man": "male"
    },
    "categories": [
      "male"
    ],
    "id": 200
  },
  {
    "type": "simple",
    "considerate": {
      "sociopaths": "a"
    },
    "inconsiderate": {
      "madmen": "male",
      "mad men": "male"
    },
    "categories": [
      "male"
    ],
    "id": 201
  },
  {
    "type": "simple",
    "considerate": {
      "humankind": "a"
    },
    "inconsiderate": {
      "mankind": "male"
    },
    "categories": [
      "male"
    ],
    "id": 202
  },
  {
    "type": "simple",
    "considerate": {
      "staff hours": "a",
      "hours of work": "a"
    },
    "inconsiderate": {
      "manhour": "male",
      "man hour": "male"
    },
    "categories": [
      "male"
    ],
    "id": 203
  },
  {
    "type": "simple",
    "considerate": {
      "staffed": "a",
      "crewed": "a",
      "pilotted": "a"
    },
    "inconsiderate": {
      "manned": "a"
    },
    "categories": [
      "a"
    ],
    "id": 204
  },
  {
    "type": "simple",
    "considerate": {
      "robotic": "a",
      "automated": "a"
    },
    "inconsiderate": {
      "unmanned": "a"
    },
    "categories": [
      "a"
    ],
    "id": 205
  },
  {
    "type": "simple",
    "considerate": {
      "whining": "a",
      "complaining": "a",
      "crying": "a"
    },
    "inconsiderate": {
      "bitching": "a",
      "moaning": "a"
    },
    "categories": [
      "a"
    ],
    "id": 206
  },
  {
    "type": "simple",
    "considerate": {
      "whine": "a",
      "complain": "a",
      "cry": "a"
    },
    "inconsiderate": {
      "bitch": "a",
      "moan": "a"
    },
    "categories": [
      "a"
    ],
    "id": 207
  },
  {
    "type": "simple",
    "considerate": {
      "person with learning disabilities": "a"
    },
    "inconsiderate": {
      "learning disabled": "a"
    },
    "categories": [
      "a"
    ],
    "id": 208
  },
  {
    "type": "simple",
    "considerate": {
      "person with disabilities": "a"
    },
    "inconsiderate": {
      "disabled": "a"
    },
    "categories": [
      "a"
    ],
    "id": 209
  },
  {
    "type": "simple",
    "considerate": {
      "person with mental illness": "a",
      "person with symptoms of mental illness": "a",
      "rude": "a",
      "mean": "a",
      "disgusting": "a",
      "vile": "a"
    },
    "inconsiderate": {
      "batshit": "a",
      "crazy": "a",
      "insane": "a",
      "loony": "a",
      "lunacy": "a",
      "lunatic": "a",
      "mentally ill": "a"
    },
    "categories": [
      "a"
    ],
    "id": 210
  },
  {
    "type": "simple",
    "considerate": {
      "person with schizophrenia": "a",
      "person with bi-polar disorder": "a",
      "fluctuating": "a"
    },
    "inconsiderate": {
      "bi-polar": "a",
      "schizophrenic": "a",
      "schizo": "a"
    },
    "categories": [
      "a"
    ],
    "id": 211
  },
  {
    "type": "simple",
    "considerate": {
      "person with physical handicaps": "a"
    },
    "inconsiderate": {
      "handicapped": "a"
    },
    "categories": [
      "a"
    ],
    "id": 212
  },
  {
    "type": "simple",
    "considerate": {
      "person with an amputation": "a"
    },
    "inconsiderate": {
      "amputee": "a"
    },
    "categories": [
      "a"
    ],
    "id": 213
  },
  {
    "type": "simple",
    "considerate": {
      "person with a limp": "a"
    },
    "inconsiderate": {
      "cripple": "a"
    },
    "categories": [
      "a"
    ],
    "id": 214
  },
  {
    "type": "simple",
    "considerate": {
      "person with Down’s Syndrome": "a"
    },
    "inconsiderate": {
      "mongoloid": "a"
    },
    "categories": [
      "a"
    ],
    "id": 215
  },
  {
    "type": "simple",
    "considerate": {
      "individual who has had a stroke": "a"
    },
    "inconsiderate": {
      "stroke victim": "a"
    },
    "categories": [
      "a"
    ],
    "id": 216
  },
  {
    "type": "simple",
    "considerate": {
      "person who has multiple sclerosis": "a"
    },
    "inconsiderate": {
      "suffering from multiple sclerosis": "a"
    },
    "categories": [
      "a"
    ],
    "id": 217
  },
  {
    "type": "simple",
    "considerate": {
      "with family support needs": "a"
    },
    "inconsiderate": {
      "family burden": "a"
    },
    "categories": [
      "a"
    ],
    "id": 218
  },
  {
    "type": "simple",
    "considerate": {
      "chaos": "a",
      "hectic": "a",
      "pandemonium": "a"
    },
    "inconsiderate": {
      "bedlam": "a",
      "madhouse": "a"
    },
    "categories": [
      "a"
    ],
    "id": 219
  },
  {
    "type": "simple",
    "considerate": {
      "Armenian person": "a",
      "Armenian American": "a"
    },
    "inconsiderate": {
      "armo": "a"
    },
    "categories": [
      "a"
    ],
    "id": 220
  },
  {
    "type": "simple",
    "considerate": {
      "Armenian people": "a",
      "Armenian Americans": "a"
    },
    "inconsiderate": {
      "armos": "a"
    },
    "categories": [
      "a"
    ],
    "id": 221
  },
  {
    "type": "simple",
    "considerate": {
      "Australian Aboriginal": "a",
      "people of the pacific islands": "a"
    },
    "inconsiderate": {
      "boongas": "a",
      "boongs": "a",
      "bungas": "a",
      "boonies": "a"
    },
    "categories": [
      "a"
    ],
    "id": 222
  },
  {
    "type": "simple",
    "considerate": {
      "Australian Aboriginal": "a",
      "pacific islander": "a"
    },
    "inconsiderate": {
      "boonga": "a",
      "boong": "a",
      "bong": "a",
      "bung": "a",
      "bunga": "a",
      "boonie": "a"
    },
    "categories": [
      "a"
    ],
    "id": 223
  },
  {
    "type": "simple",
    "considerate": {
      "Dutch person": "a"
    },
    "inconsiderate": {
      "cheesehead": "a"
    },
    "categories": [
      "a"
    ],
    "id": 224
  },
  {
    "type": "simple",
    "considerate": {
      "Dutch people": "a"
    },
    "inconsiderate": {
      "cheeseheads": "a"
    },
    "categories": [
      "a"
    ],
    "id": 225
  },
  {
    "type": "simple",
    "considerate": {
      "French person": "a"
    },
    "inconsiderate": {
      "cheeseeating surrender monkey": "a",
      "cheese eating surrender monkey": "a"
    },
    "categories": [
      "a"
    ],
    "id": 226
  },
  {
    "type": "simple",
    "considerate": {
      "French people": "a"
    },
    "inconsiderate": {
      "cheeseeating surrender monkies": "a",
      "cheese eating surrender monkies": "a"
    },
    "categories": [
      "a"
    ],
    "id": 227
  },
  {
    "type": "simple",
    "considerate": {
      "Finnish American": "a"
    },
    "inconsiderate": {
      "chinaswede": "a",
      "china swede": "a"
    },
    "categories": [
      "a"
    ],
    "id": 228
  },
  {
    "type": "simple",
    "considerate": {
      "Finnish Americans": "a"
    },
    "inconsiderate": {
      "chinaswedes": "a",
      "china swedes": "a"
    },
    "categories": [
      "a"
    ],
    "id": 229
  },
  {
    "type": "simple",
    "considerate": {
      "Chinese person": "a"
    },
    "inconsiderate": {
      "chinamen": "a"
    },
    "categories": [
      "a"
    ],
    "id": 230
  },
  {
    "type": "simple",
    "considerate": {
      "Chinese people": "a"
    },
    "inconsiderate": {
      "ching chong": "a",
      "chinaman": "a"
    },
    "categories": [
      "a"
    ],
    "id": 231
  },
  {
    "type": "simple",
    "considerate": {
      "Chinese person": "a",
      "Asian person": "a"
    },
    "inconsiderate": {
      "banana": "a",
      "ching chong": "a",
      "chink": "a"
    },
    "categories": [
      "a"
    ],
    "id": 232
  },
  {
    "type": "simple",
    "considerate": {
      "Chinese people": "a",
      "Asian people": "a"
    },
    "inconsiderate": {
      "bananas": "a",
      "ching chongs": "a",
      "chinks": "a"
    },
    "categories": [
      "a"
    ],
    "id": 233
  },
  {
    "type": "simple",
    "considerate": {
      "Chinese person": "a",
      "Korean person": "a"
    },
    "inconsiderate": {
      "chonky": "a",
      "chunky": "a",
      "chunger": "a"
    },
    "categories": [
      "a"
    ],
    "id": 234
  },
  {
    "type": "simple",
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
    },
    "categories": [
      "a"
    ],
    "id": 235
  },
  {
    "type": "simple",
    "considerate": {
      "Canadian Aboriginal": "a"
    },
    "inconsiderate": {
      "chug": "a"
    },
    "categories": [
      "a"
    ],
    "id": 236
  },
  {
    "type": "simple",
    "considerate": {
      "Canadian Aboriginals": "a"
    },
    "inconsiderate": {
      "chugs": "a"
    },
    "categories": [
      "a"
    ],
    "id": 237
  },
  {
    "type": "simple",
    "considerate": {
      "hispanic person": "a",
      "person of color": "a",
      "black person": "a"
    },
    "inconsiderate": {
      "coconut": "a",
      "oreo": "a"
    },
    "categories": [
      "a"
    ],
    "id": 238
  },
  {
    "type": "simple",
    "considerate": {
      "hispanic people": "a",
      "people of color": "a",
      "black people": "a"
    },
    "inconsiderate": {
      "coconuts": "a",
      "oreos": "a"
    },
    "categories": [
      "a"
    ],
    "id": 239
  },
  {
    "type": "simple",
    "considerate": {
      "Cajun": "a"
    },
    "inconsiderate": {
      "coonass": "a",
      "coon ass": "a"
    },
    "categories": [
      "a"
    ],
    "id": 240
  },
  {
    "type": "simple",
    "considerate": {
      "Cajun people": "a"
    },
    "inconsiderate": {
      "coonasses": "a",
      "coon asses": "a"
    },
    "categories": [
      "a"
    ],
    "id": 241
  },
  {
    "type": "simple",
    "considerate": {
      "Indian person": "a"
    },
    "inconsiderate": {
      "currymuncher": "a",
      "curry muncher": "a"
    },
    "categories": [
      "a"
    ],
    "id": 242
  },
  {
    "type": "simple",
    "considerate": {
      "Indian people": "a"
    },
    "inconsiderate": {
      "currymunchers": "a",
      "curry munchers": "a"
    },
    "categories": [
      "a"
    ],
    "id": 243
  },
  {
    "type": "simple",
    "considerate": {
      "Hindi person": "a"
    },
    "inconsiderate": {
      "Dotheads": "a",
      "Dot heads": "a"
    },
    "categories": [
      "a"
    ],
    "id": 244
  },
  {
    "type": "simple",
    "considerate": {
      "Hindi people": "a"
    },
    "inconsiderate": {
      "Dothead": "a",
      "Dot head": "a"
    },
    "categories": [
      "a"
    ],
    "id": 245
  },
  {
    "type": "simple",
    "considerate": {
      "caribbean people": "a"
    },
    "inconsiderate": {
      "golliwogs": "a"
    },
    "categories": [
      "a"
    ],
    "id": 246
  },
  {
    "type": "simple",
    "considerate": {
      "caribbean person": "a"
    },
    "inconsiderate": {
      "golliwog": "a"
    },
    "categories": [
      "a"
    ],
    "id": 247
  },
  {
    "type": "simple",
    "considerate": {
      "foreigners": "a"
    },
    "inconsiderate": {
      "guizi": "a"
    },
    "categories": [
      "a"
    ],
    "id": 248
  },
  {
    "type": "simple",
    "considerate": {
      "romani person": "a"
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
    },
    "categories": [
      "a"
    ],
    "id": 249
  },
  {
    "type": "simple",
    "considerate": {
      "romani people": "a"
    },
    "inconsiderate": {
      "gyppo": "a",
      "gippo": "a",
      "gypo": "a",
      "gyppie": "a",
      "gyppy": "a",
      "gipp": "a",
      "gypsy": "a"
    },
    "categories": [
      "a"
    ],
    "id": 250
  },
  {
    "type": "simple",
    "considerate": {
      "afrikaner": "a"
    },
    "inconsiderate": {
      "hairyback": "a"
    },
    "categories": [
      "a"
    ],
    "id": 251
  },
  {
    "type": "simple",
    "considerate": {
      "afrikaners": "a"
    },
    "inconsiderate": {
      "hairybacks": "a"
    },
    "categories": [
      "a"
    ],
    "id": 252
  },
  {
    "type": "simple",
    "considerate": {
      "Maori person": "a"
    },
    "inconsiderate": {
      "hori": "a"
    },
    "categories": [
      "a"
    ],
    "id": 253
  },
  {
    "type": "simple",
    "considerate": {
      "Maoris": "a"
    },
    "inconsiderate": {
      "horis": "a"
    },
    "categories": [
      "a"
    ],
    "id": 254
  },
  {
    "type": "simple",
    "considerate": {
      "Indonesian person": "a"
    },
    "inconsiderate": {
      "jap": "a"
    },
    "categories": [
      "a"
    ],
    "id": 255
  },
  {
    "type": "simple",
    "considerate": {
      "Indonesians": "a"
    },
    "inconsiderate": {
      "indons": "a"
    },
    "categories": [
      "a"
    ],
    "id": 256
  },
  {
    "type": "simple",
    "considerate": {
      "Japanese person": "a"
    },
    "inconsiderate": {
      "jap": "a"
    },
    "categories": [
      "a"
    ],
    "id": 257
  },
  {
    "type": "simple",
    "considerate": {
      "Japanese": "a"
    },
    "inconsiderate": {
      "japs": "a"
    },
    "categories": [
      "a"
    ],
    "id": 258
  },
  {
    "type": "simple",
    "considerate": {
      "Koreans": "a"
    },
    "inconsiderate": {
      "gyopos": "a",
      "kyopos": "a",
      "kimchis": "a"
    },
    "categories": [
      "a"
    ],
    "id": 259
  },
  {
    "type": "simple",
    "considerate": {
      "Korean person": "a"
    },
    "inconsiderate": {
      "gyopo": "a",
      "kyopo": "a",
      "kimchi": "a"
    },
    "categories": [
      "a"
    ],
    "id": 260
  },
  {
    "type": "simple",
    "considerate": {
      "lebanese": "a"
    },
    "inconsiderate": {
      "lebos": "a"
    },
    "categories": [
      "a"
    ],
    "id": 261
  },
  {
    "type": "simple",
    "considerate": {
      "lebanese person": "a"
    },
    "inconsiderate": {
      "lebo": "a"
    },
    "categories": [
      "a"
    ],
    "id": 262
  },
  {
    "type": "simple",
    "considerate": {
      "lithuanians": "a"
    },
    "inconsiderate": {
      "lugans": "a"
    },
    "categories": [
      "a"
    ],
    "id": 263
  },
  {
    "type": "simple",
    "considerate": {
      "lithuanian person": "a"
    },
    "inconsiderate": {
      "lugan": "a"
    },
    "categories": [
      "a"
    ],
    "id": 264
  },
  {
    "type": "simple",
    "considerate": {
      "russians": "a"
    },
    "inconsiderate": {
      "moskals": "a"
    },
    "categories": [
      "a"
    ],
    "id": 265
  },
  {
    "type": "simple",
    "considerate": {
      "russian person": "a"
    },
    "inconsiderate": {
      "moskal": "a"
    },
    "categories": [
      "a"
    ],
    "id": 266
  },
  {
    "type": "simple",
    "considerate": {
      "Poles": "a",
      "Slavs": "a"
    },
    "inconsiderate": {
      "polacks": "a",
      "pollocks": "a"
    },
    "categories": [
      "a"
    ],
    "id": 267
  },
  {
    "type": "simple",
    "considerate": {
      "Pole": "a",
      "Slav": "a",
      "Polish person": "a",
      "Slavic person": "a"
    },
    "inconsiderate": {
      "polack": "a",
      "pollock": "a"
    },
    "categories": [
      "a"
    ],
    "id": 268
  },
  {
    "type": "simple",
    "considerate": {
      "English": "a",
      "Brittish": "a"
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
    },
    "categories": [
      "a"
    ],
    "id": 269
  },
  {
    "type": "simple",
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
    },
    "categories": [
      "a"
    ],
    "id": 270
  },
  {
    "type": "simple",
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
    },
    "categories": [
      "a"
    ],
    "id": 271
  },
  {
    "type": "simple",
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
    },
    "categories": [
      "a"
    ],
    "id": 272
  },
  {
    "type": "simple",
    "considerate": {
      "female Australian Aboriginal": "a"
    },
    "inconsiderate": {
      "lubra": "a"
    },
    "categories": [
      "a"
    ],
    "id": 273
  },
  {
    "type": "simple",
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
    },
    "categories": [
      "a"
    ],
    "id": 274
  },
  {
    "type": "simple",
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
    },
    "categories": [
      "a"
    ],
    "id": 275
  },
  {
    "type": "simple",
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
    },
    "categories": [
      "a"
    ],
    "id": 276
  },
  {
    "type": "simple",
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
    },
    "categories": [
      "a"
    ],
    "id": 277
  },
  {
    "type": "simple",
    "considerate": {
      "african americans": "a",
      "south americans": "a",
      "caribbean people": "a",
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
    },
    "categories": [
      "a"
    ],
    "id": 278
  },
  {
    "type": "simple",
    "considerate": {
      "african american": "a",
      "south american": "a",
      "caribbean person": "a",
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
    },
    "categories": [
      "a"
    ],
    "id": 279
  },
  {
    "type": "simple",
    "considerate": {
      "Native Americans": "a"
    },
    "inconsiderate": {
      "injuns": "a",
      "prairie niggers": "a",
      "redskins": "a",
      "timber niggers": "a"
    },
    "categories": [
      "a"
    ],
    "id": 280
  },
  {
    "type": "simple",
    "considerate": {
      "Native American": "a"
    },
    "inconsiderate": {
      "injun": "a",
      "prairie nigger": "a",
      "redskin": "a",
      "timber nigger": "a"
    },
    "categories": [
      "a"
    ],
    "id": 281
  },
  {
    "type": "simple",
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
    },
    "categories": [
      "a"
    ],
    "id": 282
  },
  {
    "type": "simple",
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
    },
    "categories": [
      "a"
    ],
    "id": 283
  },
  {
    "type": "simple",
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
    },
    "categories": [
      "a"
    ],
    "id": 284
  },
  {
    "type": "simple",
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
    },
    "categories": [
      "a"
    ],
    "id": 285
  },
  {
    "type": "simple",
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
    },
    "categories": [
      "a"
    ],
    "id": 286
  },
  {
    "type": "simple",
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
    },
    "categories": [
      "a"
    ],
    "id": 287
  },
  {
    "type": "simple",
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
    },
    "categories": [
      "a"
    ],
    "id": 288
  },
  {
    "type": "simple",
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
      "write trash": "a"
    },
    "categories": [
      "a"
    ],
    "id": 289
  },
  {
    "type": "simple",
    "considerate": {
      "ukrainian": "a"
    },
    "inconsiderate": {
      "ukrop": "a",
      "khokhol": "a",
      "khokhols": "a",
      "katsap": "a",
      "kacap": "a",
      "kacapas": "a"
    },
    "categories": [
      "a"
    ],
    "id": 290
  },
  {
    "type": "simple",
    "considerate": {
      "african": "a"
    },
    "inconsiderate": {
      "uncle tom": "a"
    },
    "categories": [
      "a"
    ],
    "id": 291
  },
  {
    "type": "simple",
    "considerate": {
      "foreigner": "a",
      "asian": "a",
      "african": "a"
    },
    "inconsiderate": {
      "wog": "a"
    },
    "categories": [
      "a"
    ],
    "id": 292
  },
  {
    "type": "simple",
    "considerate": {
      "foreigners": "a",
      "asians": "a",
      "africans": "a"
    },
    "inconsiderate": {
      "wogs": "a"
    },
    "categories": [
      "a"
    ],
    "id": 293
  },
  {
    "type": "simple",
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
    },
    "categories": [
      "a"
    ],
    "id": 294
  },
  {
    "type": "simple",
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
    },
    "categories": [
      "a"
    ],
    "id": 295
  },
  {
    "type": "simple",
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
    },
    "categories": [
      "a"
    ],
    "id": 296
  },
  {
    "type": "simple",
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
    },
    "categories": [
      "a"
    ],
    "id": 297
  },
  {
    "type": "simple",
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
    },
    "categories": [
      "a"
    ],
    "id": 298
  },
  {
    "type": "simple",
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
    },
    "categories": [
      "a"
    ],
    "id": 299
  },
  {
    "type": "and",
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
    },
    "categories": [
      "a",
      "b"
    ],
    "id": 300
  }
]
;
}, {}],
11: [function(require, module, exports) {
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
}, {}],
3: [function(require, module, exports) {

/**
 * Module dependencies.
 */

'use strict';

var now = require('date-now');

/**
 * Returns a function, that, as long as it continues to be invoked, will not
 * be triggered. The function will be called after it stops being called for
 * N milliseconds. If `immediate` is passed, trigger the function on the
 * leading edge, instead of the trailing.
 *
 * @source underscore.js
 * @see http://unscriptable.com/2009/03/20/debouncing-javascript-methods/
 * @param {Function} function to wrap
 * @param {Number} timeout in ms (`100`)
 * @param {Boolean} whether to execute at the beginning (`false`)
 * @api public
 */

module.exports = function debounce(func, wait, immediate) {
  var timeout, args, context, timestamp, result;
  if (null == wait) wait = 100;

  function later() {
    var last = now() - timestamp;

    if (last < wait && last > 0) {
      timeout = setTimeout(later, wait - last);
    } else {
      timeout = null;
      if (!immediate) {
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      }
    }
  };

  return function debounced() {
    context = this;
    args = arguments;
    timestamp = now();
    var callNow = immediate && !timeout;
    if (!timeout) timeout = setTimeout(later, wait);
    if (callNow) {
      result = func.apply(context, args);
      context = args = null;
    }

    return result;
  };
};
}, {"date-now":93}],
93: [function(require, module, exports) {
"use strict";

module.exports = Date.now || now;

function now() {
    return new Date().getTime();
}
}, {}],
4: [function(require, module, exports) {
'use strict';

var bind = window.addEventListener ? 'addEventListener' : 'attachEvent',
    unbind = window.removeEventListener ? 'removeEventListener' : 'detachEvent',
    prefix = bind !== 'addEventListener' ? 'on' : '';

/**
 * Bind `el` event `type` to `fn`.
 *
 * @param {Element} el
 * @param {String} type
 * @param {Function} fn
 * @param {Boolean} capture
 * @return {Function}
 * @api public
 */

exports.bind = function (el, type, fn, capture) {
  el[bind](prefix + type, fn, capture || false);
  return fn;
};

/**
 * Unbind `el` event `type`'s callback `fn`.
 *
 * @param {Element} el
 * @param {String} type
 * @param {Function} fn
 * @param {Boolean} capture
 * @return {Function}
 * @api public
 */

exports.unbind = function (el, type, fn, capture) {
  el[unbind](prefix + type, fn, capture || false);
  return fn;
};
}, {}]}, {}, {"1":""})