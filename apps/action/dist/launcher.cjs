var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: __accessProp.bind(mod, key),
        enumerable: true
      });
  if (canCache)
    cache.set(mod, to);
  return to;
};
var __toCommonJS = (from) => {
  var entry = (__moduleCache ??= new WeakMap).get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function") {
    for (var key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(entry, key))
        __defProp(entry, key, {
          get: __accessProp.bind(from, key),
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
        });
  }
  __moduleCache.set(from, entry);
  return entry;
};
var __moduleCache;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};

// apps/action/src/launcher.ts
var exports_launcher = {};
__export(exports_launcher, {
  runActionEnvironment: () => runActionEnvironment,
  runAction: () => runAction
});
module.exports = __toCommonJS(exports_launcher);
var import_promises = require("node:fs/promises");
var import_node_path2 = require("node:path");

// node_modules/effect/dist/Effect.js
var exports_Effect = {};
__export(exports_Effect, {
  zipWith: () => zipWith2,
  zip: () => zip2,
  yieldNowWith: () => yieldNowWith2,
  yieldNow: () => yieldNow2,
  withTracerTiming: () => withTracerTiming2,
  withTracerEnabled: () => withTracerEnabled2,
  withTracer: () => withTracer2,
  withSpanScoped: () => withSpanScoped2,
  withSpan: () => withSpan2,
  withParentSpan: () => withParentSpan2,
  withLogger: () => withLogger,
  withLogSpan: () => withLogSpan,
  withFiber: () => withFiber2,
  withExecutionPlan: () => withExecutionPlan2,
  withErrorReporting: () => withErrorReporting2,
  whileLoop: () => whileLoop2,
  when: () => when2,
  void: () => void_3,
  validate: () => validate2,
  useSpan: () => useSpan2,
  updateServiceScoped: () => updateServiceScoped2,
  updateService: () => updateService2,
  updateContext: () => updateContext2,
  unwrapReason: () => unwrapReason2,
  uninterruptibleMask: () => uninterruptibleMask2,
  uninterruptible: () => uninterruptible2,
  undefined: () => undefined_2,
  txRetry: () => txRetry,
  tx: () => tx,
  tryPromise: () => tryPromise2,
  try: () => try_3,
  transposeOption: () => transposeOption2,
  trackSuccesses: () => trackSuccesses,
  trackErrors: () => trackErrors,
  trackDuration: () => trackDuration,
  trackDefects: () => trackDefects,
  track: () => track,
  tracer: () => tracer2,
  timeoutOrElse: () => timeoutOrElse2,
  timeoutOption: () => timeoutOption2,
  timeout: () => timeout2,
  timed: () => timed2,
  tapErrorTag: () => tapErrorTag2,
  tapError: () => tapError2,
  tapDefect: () => tapDefect2,
  tapCauseIf: () => tapCauseIf2,
  tapCauseFilter: () => tapCauseFilter2,
  tapCause: () => tapCause2,
  tap: () => tap2,
  sync: () => sync2,
  suspend: () => suspend2,
  succeedSome: () => succeedSome2,
  succeedNone: () => succeedNone2,
  succeed: () => succeed6,
  spanLinks: () => spanLinks2,
  spanAnnotations: () => spanAnnotations2,
  sleep: () => sleep2,
  setContext: () => setContext2,
  serviceOption: () => serviceOption2,
  service: () => service2,
  scopedWith: () => scopedWith2,
  scoped: () => scoped2,
  scope: () => scope2,
  scheduleFrom: () => scheduleFrom2,
  schedule: () => schedule,
  satisfiesSuccessType: () => satisfiesSuccessType,
  satisfiesServicesType: () => satisfiesServicesType,
  satisfiesErrorType: () => satisfiesErrorType,
  sandbox: () => sandbox2,
  runSyncWith: () => runSyncWith2,
  runSyncExitWith: () => runSyncExitWith2,
  runSyncExit: () => runSyncExit2,
  runSync: () => runSync2,
  runPromiseWith: () => runPromiseWith2,
  runPromiseExitWith: () => runPromiseExitWith2,
  runPromiseExit: () => runPromiseExit2,
  runPromise: () => runPromise2,
  runForkWith: () => runForkWith2,
  runFork: () => runFork2,
  runCallbackWith: () => runCallbackWith2,
  runCallback: () => runCallback2,
  retryOrElse: () => retryOrElse2,
  retry: () => retry2,
  result: () => result2,
  requestUnsafe: () => requestUnsafe2,
  request: () => request2,
  replicateEffect: () => replicateEffect2,
  replicate: () => replicate2,
  repeatOrElse: () => repeatOrElse2,
  repeat: () => repeat2,
  reduce: () => reduce2,
  raceFirst: () => raceFirst2,
  raceAllFirst: () => raceAllFirst2,
  raceAll: () => raceAll2,
  race: () => race2,
  provideServiceEffect: () => provideServiceEffect2,
  provideService: () => provideService2,
  provideContext: () => provideContext2,
  provide: () => provide4,
  promise: () => promise2,
  partition: () => partition3,
  orElseSucceed: () => orElseSucceed2,
  orDie: () => orDie2,
  option: () => option2,
  onInterrupt: () => onInterrupt2,
  onExitPrimitive: () => onExitPrimitive2,
  onExitIf: () => onExitIf2,
  onExitFilter: () => onExitFilter2,
  onExit: () => onExit2,
  onErrorIf: () => onErrorIf2,
  onErrorFilter: () => onErrorFilter2,
  onError: () => onError2,
  never: () => never2,
  matchEffect: () => matchEffect3,
  matchEager: () => matchEager2,
  matchCauseEffectEager: () => matchCauseEffectEager2,
  matchCauseEffect: () => matchCauseEffect2,
  matchCauseEager: () => matchCauseEager2,
  matchCause: () => matchCause2,
  match: () => match5,
  mapErrorEager: () => mapErrorEager2,
  mapError: () => mapError3,
  mapEager: () => mapEager2,
  mapBothEager: () => mapBothEager2,
  mapBoth: () => mapBoth2,
  map: () => map7,
  makeSpanScoped: () => makeSpanScoped2,
  makeSpan: () => makeSpan2,
  logWithLevel: () => logWithLevel2,
  logWarning: () => logWarning,
  logTrace: () => logTrace,
  logInfo: () => logInfo,
  logFatal: () => logFatal,
  logError: () => logError,
  logDebug: () => logDebug,
  log: () => log,
  linkSpans: () => linkSpans2,
  let: () => let_3,
  isSuccess: () => isSuccess5,
  isFailure: () => isFailure5,
  isEffect: () => isEffect2,
  interruptibleMask: () => interruptibleMask2,
  interruptible: () => interruptible2,
  interrupt: () => interrupt2,
  ignoreCause: () => ignoreCause2,
  ignore: () => ignore2,
  gen: () => gen2,
  fromResult: () => fromResult2,
  fromOption: () => fromOption3,
  fromNullishOr: () => fromNullishOr3,
  forkScoped: () => forkScoped2,
  forkIn: () => forkIn2,
  forkDetach: () => forkDetach2,
  forkChild: () => forkChild2,
  forever: () => forever3,
  forEach: () => forEach2,
  fnUntracedEager: () => fnUntracedEager2,
  fnUntraced: () => fnUntraced2,
  fn: () => fn2,
  flip: () => flip2,
  flatten: () => flatten4,
  flatMapEager: () => flatMapEager2,
  flatMap: () => flatMap4,
  firstSuccessOf: () => firstSuccessOf2,
  findFirstFilter: () => findFirstFilter2,
  findFirst: () => findFirst2,
  filterOrFail: () => filterOrFail2,
  filterOrElse: () => filterOrElse2,
  filterMapOrFail: () => filterMapOrFail2,
  filterMapOrElse: () => filterMapOrElse2,
  filterMapEffect: () => filterMapEffect2,
  filterMap: () => filterMap2,
  filter: () => filter5,
  fiberId: () => fiberId2,
  fiber: () => fiber2,
  failSync: () => failSync2,
  failCauseSync: () => failCauseSync2,
  failCause: () => failCause3,
  fail: () => fail5,
  exit: () => exit2,
  eventually: () => eventually2,
  ensuring: () => ensuring2,
  effectify: () => effectify,
  die: () => die2,
  delay: () => delay2,
  currentSpan: () => currentSpan2,
  currentParentSpan: () => currentParentSpan2,
  contextWith: () => contextWith2,
  context: () => context2,
  clockWith: () => clockWith2,
  catchTags: () => catchTags2,
  catchTag: () => catchTag2,
  catchReasons: () => catchReasons2,
  catchReason: () => catchReason2,
  catchNoSuchElement: () => catchNoSuchElement2,
  catchIf: () => catchIf2,
  catchFilter: () => catchFilter2,
  catchEager: () => catchEager2,
  catchDefect: () => catchDefect2,
  catchCauseIf: () => catchCauseIf2,
  catchCauseFilter: () => catchCauseFilter2,
  catchCause: () => catchCause2,
  catch: () => catch_2,
  callback: () => callback2,
  cachedWithTTL: () => cachedWithTTL2,
  cachedInvalidateWithTTL: () => cachedInvalidateWithTTL2,
  cached: () => cached2,
  bindTo: () => bindTo3,
  bind: () => bind3,
  awaitAllChildren: () => awaitAllChildren2,
  asVoid: () => asVoid2,
  asSome: () => asSome2,
  as: () => as2,
  annotateSpans: () => annotateSpans2,
  annotateLogsScoped: () => annotateLogsScoped2,
  annotateLogs: () => annotateLogs,
  annotateCurrentSpan: () => annotateCurrentSpan2,
  andThen: () => andThen2,
  all: () => all2,
  addFinalizer: () => addFinalizer2,
  acquireUseRelease: () => acquireUseRelease2,
  acquireRelease: () => acquireRelease2,
  acquireDisposable: () => acquireDisposable2,
  abortSignal: () => abortSignal2,
  TypeId: () => TypeId12,
  Transaction: () => Transaction,
  Do: () => Do2
});

// node_modules/effect/dist/Pipeable.js
var pipeArguments = (self, args) => {
  switch (args.length) {
    case 0:
      return self;
    case 1:
      return args[0](self);
    case 2:
      return args[1](args[0](self));
    case 3:
      return args[2](args[1](args[0](self)));
    case 4:
      return args[3](args[2](args[1](args[0](self))));
    case 5:
      return args[4](args[3](args[2](args[1](args[0](self)))));
    case 6:
      return args[5](args[4](args[3](args[2](args[1](args[0](self))))));
    case 7:
      return args[6](args[5](args[4](args[3](args[2](args[1](args[0](self)))))));
    case 8:
      return args[7](args[6](args[5](args[4](args[3](args[2](args[1](args[0](self))))))));
    case 9:
      return args[8](args[7](args[6](args[5](args[4](args[3](args[2](args[1](args[0](self)))))))));
    default: {
      let ret = self;
      for (let i = 0, len = args.length;i < len; i++) {
        ret = args[i](ret);
      }
      return ret;
    }
  }
};
var Prototype = {
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var Class = /* @__PURE__ */ function() {
  function PipeableBase() {}
  PipeableBase.prototype = Prototype;
  return PipeableBase;
}();

// node_modules/effect/dist/Function.js
var dual = function(arity, body) {
  if (typeof arity === "function") {
    return function() {
      return arity(arguments) ? body.apply(this, arguments) : (self) => body(self, ...arguments);
    };
  }
  switch (arity) {
    case 0:
    case 1:
      throw new RangeError(`Invalid arity ${arity}`);
    case 2:
      return function(a, b) {
        if (arguments.length >= 2) {
          return body(a, b);
        }
        return function(self) {
          return body(self, a);
        };
      };
    case 3:
      return function(a, b, c) {
        if (arguments.length >= 3) {
          return body(a, b, c);
        }
        return function(self) {
          return body(self, a, b);
        };
      };
    default:
      return function() {
        if (arguments.length >= arity) {
          return body.apply(this, arguments);
        }
        const args = arguments;
        return function(self) {
          return body(self, ...args);
        };
      };
  }
};
var identity = (a) => a;
var constant = (value) => () => value;
var constTrue = /* @__PURE__ */ constant(true);
var constFalse = /* @__PURE__ */ constant(false);
var constNull = /* @__PURE__ */ constant(null);
var constUndefined = /* @__PURE__ */ constant(undefined);
var constVoid = constUndefined;
function pipe(a, ...args) {
  return pipeArguments(a, args);
}
function memoize(f) {
  const cache = new WeakMap;
  return (a) => {
    const cached = cache.get(a);
    if (cached !== undefined)
      return cached;
    const result = f(a);
    cache.set(a, result);
    return result;
  };
}
function memoizeIdempotent(f) {
  const cache = new WeakMap;
  return (a) => {
    const cached = cache.get(a);
    if (cached !== undefined)
      return cached;
    const result = f(a);
    cache.set(a, result);
    cache.set(result, result);
    return result;
  };
}

// node_modules/effect/dist/internal/equal.js
var getAllObjectKeys = (obj) => {
  const keys = new Set(Reflect.ownKeys(obj));
  if (obj.constructor === Object)
    return keys;
  if (obj instanceof Error) {
    keys.delete("stack");
  }
  const proto = Object.getPrototypeOf(obj);
  let current = proto;
  while (current !== null && current !== Object.prototype) {
    const ownKeys = Reflect.ownKeys(current);
    for (let i = 0;i < ownKeys.length; i++) {
      keys.add(ownKeys[i]);
    }
    current = Object.getPrototypeOf(current);
  }
  if (keys.has("constructor") && typeof obj.constructor === "function" && proto === obj.constructor.prototype) {
    keys.delete("constructor");
  }
  return keys;
};
var byReferenceInstances = /* @__PURE__ */ new WeakSet;

// node_modules/effect/dist/Predicate.js
function isString(input) {
  return typeof input === "string";
}
function isNumber(input) {
  return typeof input === "number";
}
function isBoolean(input) {
  return typeof input === "boolean";
}
function isBigInt(input) {
  return typeof input === "bigint";
}
function isSymbol(input) {
  return typeof input === "symbol";
}
function isPropertyKey(u) {
  return isString(u) || isNumber(u) || isSymbol(u);
}
function isFunction(input) {
  return typeof input === "function";
}
function isUndefined(input) {
  return input === undefined;
}
function isNotUndefined(input) {
  return input !== undefined;
}
function isNotNullish(input) {
  return input != null;
}
function isNever(_) {
  return false;
}
function isUnknown(_) {
  return true;
}
function isObject(input) {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}
function isObjectKeyword(input) {
  return typeof input === "object" && input !== null || isFunction(input);
}
var hasProperty = /* @__PURE__ */ dual(2, (self, property) => isObjectKeyword(self) && (property in self));
var isTagged = /* @__PURE__ */ dual(2, (self, tag) => hasProperty(self, "_tag") && self["_tag"] === tag);
function isError(input) {
  return input instanceof Error;
}
function isIterable(input) {
  return hasProperty(input, Symbol.iterator) || isString(input);
}

// node_modules/effect/dist/Hash.js
var symbol = "~effect/interfaces/Hash";
var hash = (self) => {
  switch (typeof self) {
    case "number":
      return number(self);
    case "bigint":
      return string(self.toString(10));
    case "boolean":
      return string(String(self));
    case "symbol":
      return string(String(self));
    case "string":
      return string(self);
    case "undefined":
      return string("undefined");
    case "function":
    case "object": {
      if (self === null) {
        return string("null");
      } else if (self instanceof Date) {
        if (Number.isNaN(self.getTime())) {
          return string("Invalid Date");
        }
        return string(self.toISOString());
      } else if (self instanceof RegExp) {
        return string(self.toString());
      } else {
        if (byReferenceInstances.has(self)) {
          return random(self);
        }
        if (hashCache.has(self)) {
          return hashCache.get(self);
        }
        const h = withVisitedTracking(self, () => {
          if (isHash(self)) {
            return self[symbol]();
          } else if (typeof self === "function") {
            return random(self);
          } else if (self instanceof DataView) {
            return array(new Uint8Array(self.buffer, self.byteOffset, self.byteLength));
          } else if (Array.isArray(self) || ArrayBuffer.isView(self)) {
            return array(self);
          } else if (self instanceof Map) {
            return hashMap(self);
          } else if (self instanceof Set) {
            return hashSet(self);
          }
          return structure(self);
        });
        hashCache.set(self, h);
        return h;
      }
    }
    default:
      throw new Error(`BUG: unhandled typeof ${typeof self} - please report an issue at https://github.com/Effect-TS/effect/issues`);
  }
};
var random = (self) => {
  if (!randomHashCache.has(self)) {
    randomHashCache.set(self, number(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)));
  }
  return randomHashCache.get(self);
};
var combine = /* @__PURE__ */ dual(2, (self, b) => self * 53 ^ b);
var optimize = (n) => n & 3221225471 | n >>> 1 & 1073741824;
var isHash = (u) => hasProperty(u, symbol);
var number = (n) => {
  if (n !== n) {
    return string("NaN");
  }
  if (n === Infinity) {
    return string("Infinity");
  }
  if (n === -Infinity) {
    return string("-Infinity");
  }
  let h = n | 0;
  if (h !== n) {
    h ^= n * 4294967295;
  }
  while (n > 4294967295) {
    h ^= n /= 4294967295;
  }
  return optimize(h);
};
var string = (str) => {
  let h = 5381, i = str.length;
  while (i) {
    h = h * 33 ^ str.charCodeAt(--i);
  }
  return optimize(h);
};
var structureKeys = (o, keys) => {
  let h = 12289;
  for (const key of keys) {
    h ^= combine(hash(key), hash(o[key]));
  }
  return optimize(h);
};
var structure = (o) => structureKeys(o, getAllObjectKeys(o));
var iterableWith = (seed, f) => (iter) => {
  let h = seed;
  for (const element of iter) {
    h ^= f(element);
  }
  return optimize(h);
};
var array = /* @__PURE__ */ iterableWith(6151, hash);
var hashMap = /* @__PURE__ */ iterableWith(/* @__PURE__ */ string("Map"), ([k, v]) => combine(hash(k), hash(v)));
var hashSet = /* @__PURE__ */ iterableWith(/* @__PURE__ */ string("Set"), hash);
var randomHashCache = /* @__PURE__ */ new WeakMap;
var hashCache = /* @__PURE__ */ new WeakMap;
var visitedObjects = /* @__PURE__ */ new WeakSet;
function withVisitedTracking(obj, fn) {
  if (visitedObjects.has(obj)) {
    return string("[Circular]");
  }
  visitedObjects.add(obj);
  const result = fn();
  visitedObjects.delete(obj);
  return result;
}

// node_modules/effect/dist/Equal.js
var symbol2 = "~effect/interfaces/Equal";
function equals() {
  if (arguments.length === 1) {
    return (self) => compareBoth(self, arguments[0]);
  }
  return compareBoth(arguments[0], arguments[1]);
}
function compareBoth(self, that) {
  if (self === that)
    return true;
  if (self == null || that == null)
    return false;
  const selfType = typeof self;
  if (selfType !== typeof that) {
    return false;
  }
  if (selfType === "number" && self !== self && that !== that) {
    return true;
  }
  if (selfType !== "object" && selfType !== "function") {
    return false;
  }
  if (byReferenceInstances.has(self) || byReferenceInstances.has(that)) {
    return false;
  }
  return withCache(self, that, compareObjects);
}
function withVisitedTracking2(self, that, fn) {
  const hasLeft = visitedLeft.has(self);
  const hasRight = visitedRight.has(that);
  if (hasLeft && hasRight) {
    return true;
  }
  if (hasLeft || hasRight) {
    return false;
  }
  visitedLeft.add(self);
  visitedRight.add(that);
  const result = fn();
  visitedLeft.delete(self);
  visitedRight.delete(that);
  return result;
}
var visitedLeft = /* @__PURE__ */ new WeakSet;
var visitedRight = /* @__PURE__ */ new WeakSet;
function compareObjects(self, that) {
  if (hash(self) !== hash(that)) {
    return false;
  } else if (self instanceof Date) {
    if (!(that instanceof Date))
      return false;
    const selfTime = self.getTime();
    const thatTime = that.getTime();
    return selfTime === thatTime || Number.isNaN(selfTime) && Number.isNaN(thatTime);
  } else if (self instanceof RegExp) {
    if (!(that instanceof RegExp))
      return false;
    return self.toString() === that.toString();
  }
  const selfIsEqual = isEqual(self);
  const thatIsEqual = isEqual(that);
  if (selfIsEqual !== thatIsEqual)
    return false;
  const bothEquals = selfIsEqual && thatIsEqual;
  if (typeof self === "function" && !bothEquals) {
    return false;
  }
  return withVisitedTracking2(self, that, () => {
    if (bothEquals) {
      return self[symbol2](that);
    } else if (Array.isArray(self)) {
      if (!Array.isArray(that) || self.length !== that.length) {
        return false;
      }
      return compareArrays(self, that);
    } else if (ArrayBuffer.isView(self)) {
      const selfIsDataView = self instanceof DataView;
      if (!ArrayBuffer.isView(that) || self.byteLength !== that.byteLength || selfIsDataView !== that instanceof DataView) {
        return false;
      }
      if (selfIsDataView) {
        const thatDataView = that;
        return compareTypedArrays(new Uint8Array(self.buffer, self.byteOffset, self.byteLength), new Uint8Array(thatDataView.buffer, thatDataView.byteOffset, thatDataView.byteLength));
      }
      return compareTypedArrays(self, that);
    } else if (self instanceof Map) {
      if (!(that instanceof Map) || self.size !== that.size) {
        return false;
      }
      return compareMaps(self, that);
    } else if (self instanceof Set) {
      if (!(that instanceof Set) || self.size !== that.size) {
        return false;
      }
      return compareSets(self, that);
    }
    return compareRecords(self, that);
  });
}
function withCache(self, that, f) {
  let selfMap = equalityCache.get(self);
  if (!selfMap) {
    selfMap = new WeakMap;
    equalityCache.set(self, selfMap);
  } else if (selfMap.has(that)) {
    return selfMap.get(that);
  }
  const result = f(self, that);
  selfMap.set(that, result);
  let thatMap = equalityCache.get(that);
  if (!thatMap) {
    thatMap = new WeakMap;
    equalityCache.set(that, thatMap);
  }
  thatMap.set(self, result);
  return result;
}
var equalityCache = /* @__PURE__ */ new WeakMap;
function compareArrays(self, that) {
  for (let i = 0;i < self.length; i++) {
    if (!compareBoth(self[i], that[i])) {
      return false;
    }
  }
  return true;
}
function compareTypedArrays(self, that) {
  if (self.length !== that.length) {
    return false;
  }
  for (let i = 0;i < self.length; i++) {
    if (self[i] !== that[i]) {
      return false;
    }
  }
  return true;
}
function compareRecords(self, that) {
  const selfKeys = getAllObjectKeys(self);
  const thatKeys = getAllObjectKeys(that);
  if (selfKeys.size !== thatKeys.size) {
    return false;
  }
  for (const key of selfKeys) {
    if (!thatKeys.has(key) || !compareBoth(self[key], that[key])) {
      return false;
    }
  }
  return true;
}
function makeCompareMap(keyEquivalence, valueEquivalence) {
  return function compareMaps(self, that) {
    const thatEntries = Array.from(that);
    for (const [selfKey, selfValue] of self) {
      let found = false;
      for (let i = 0;i < thatEntries.length; i++) {
        const [thatKey, thatValue] = thatEntries[i];
        if (keyEquivalence(selfKey, thatKey) && valueEquivalence(selfValue, thatValue)) {
          thatEntries[i] = thatEntries[thatEntries.length - 1];
          thatEntries.pop();
          found = true;
          break;
        }
      }
      if (!found) {
        return false;
      }
    }
    return true;
  };
}
var compareMaps = /* @__PURE__ */ makeCompareMap(compareBoth, compareBoth);
function makeCompareSet(equivalence) {
  return function compareSets(self, that) {
    const thatValues = Array.from(that);
    for (const selfValue of self) {
      let found = false;
      for (let i = 0;i < thatValues.length; i++) {
        const thatValue = thatValues[i];
        if (equivalence(selfValue, thatValue)) {
          thatValues[i] = thatValues[thatValues.length - 1];
          thatValues.pop();
          found = true;
          break;
        }
      }
      if (!found) {
        return false;
      }
    }
    return true;
  };
}
var compareSets = /* @__PURE__ */ makeCompareSet(compareBoth);
var isEqual = (u) => hasProperty(u, symbol2);
var byReferenceUnsafe = (obj) => {
  byReferenceInstances.add(obj);
  return obj;
};

// node_modules/effect/dist/Redactable.js
var symbolRedactable = /* @__PURE__ */ Symbol.for("~effect/Redactable");
var isRedactable = (u) => hasProperty(u, symbolRedactable);
function redact(u) {
  if (isRedactable(u))
    return getRedacted(u);
  return u;
}
function getRedacted(redactable) {
  return redactable[symbolRedactable](globalThis[currentFiberTypeId]?.context ?? emptyContext);
}
var currentFiberTypeId = "~effect/Fiber/currentFiber";
var emptyMap = /* @__PURE__ */ new Map;
var emptyContext = {
  "~effect/Context": {},
  base: emptyMap,
  depth: 0,
  mapUnsafe: emptyMap,
  pipe() {
    return pipeArguments(this, arguments);
  }
};

// node_modules/effect/dist/Formatter.js
function format(input, options) {
  const space = options?.space ?? 0;
  const ancestors = new WeakSet;
  const gap = !space ? "" : typeof space === "number" ? " ".repeat(space) : space;
  const ind = (d) => gap.repeat(d);
  const wrap = (v, body) => {
    const ctor = v?.constructor;
    return ctor && ctor !== Object.prototype.constructor && ctor.name ? `${ctor.name}(${body})` : body;
  };
  const ownKeys = (o) => {
    try {
      return Reflect.ownKeys(o);
    } catch {
      return ["[ownKeys threw]"];
    }
  };
  function recur(v, d = 0) {
    if (Array.isArray(v)) {
      if (ancestors.has(v))
        return CIRCULAR;
      ancestors.add(v);
      const output = !gap || v.length <= 1 ? `[${v.map((x) => recur(x, d)).join(",")}]` : `[
${ind(d + 1)}${v.map((x) => recur(x, d + 1)).join(`,
` + ind(d + 1))}
${ind(d)}]`;
      ancestors.delete(v);
      return output;
    }
    if (v instanceof Date)
      return formatDate(v);
    if (!options?.ignoreToString && hasProperty(v, "toString") && typeof v["toString"] === "function" && v["toString"] !== Object.prototype.toString && v["toString"] !== Array.prototype.toString) {
      const s = safeToString(v);
      if (v instanceof Error && v.cause) {
        return `${s} (cause: ${recur(v.cause, d)})`;
      }
      return s;
    }
    if (typeof v === "string")
      return JSON.stringify(v);
    if (typeof v === "number" || v == null || typeof v === "boolean" || typeof v === "symbol")
      return String(v);
    if (typeof v === "bigint")
      return String(v) + "n";
    if (typeof v === "object" || typeof v === "function") {
      if (ancestors.has(v))
        return CIRCULAR;
      ancestors.add(v);
      let output;
      if (symbolRedactable in v) {
        output = format(getRedacted(v));
      } else if (Symbol.iterator in v) {
        output = `${v.constructor.name}(${recur(Array.from(v), d)})`;
      } else {
        const keys = ownKeys(v);
        if (!gap || keys.length <= 1) {
          const body = `{${keys.map((k) => `${formatPropertyKey(k)}:${recur(v[k], d)}`).join(",")}}`;
          output = wrap(v, body);
        } else {
          const body = `{
${keys.map((k) => `${ind(d + 1)}${formatPropertyKey(k)}: ${recur(v[k], d + 1)}`).join(`,
`)}
${ind(d)}}`;
          output = wrap(v, body);
        }
      }
      ancestors.delete(v);
      return output;
    }
    return String(v);
  }
  return recur(input, 0);
}
var CIRCULAR = "[Circular]";
function formatPropertyKey(name) {
  return typeof name === "string" ? JSON.stringify(name) : String(name);
}
function formatPath(path) {
  return path.map((key) => `[${formatPropertyKey(key)}]`).join("");
}
function formatDate(date) {
  try {
    return date.toISOString();
  } catch {
    return "Invalid Date";
  }
}
function safeToString(input) {
  try {
    const s = input.toString();
    return typeof s === "string" ? s : String(s);
  } catch {
    return "[toString threw]";
  }
}
function formatJson(input, options) {
  const ancestors = [];
  return JSON.stringify(input, function(_key, value) {
    const redacted = redact(value);
    if (typeof redacted !== "object" || redacted === null) {
      return redacted;
    }
    while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) {
      ancestors.pop();
    }
    if (ancestors.includes(redacted)) {
      return;
    }
    ancestors.push(redacted);
    return redacted;
  }, options?.space) ?? "null";
}

// node_modules/effect/dist/Inspectable.js
var NodeInspectSymbol = /* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom");
var toJson = (input) => {
  try {
    if (hasProperty(input, "toJSON") && isFunction(input["toJSON"]) && input["toJSON"].length === 0) {
      return input.toJSON();
    } else if (Array.isArray(input)) {
      return input.map(toJson);
    }
  } catch {
    return "[toJSON threw]";
  }
  return redact(input);
};
var toStringUnknown = (u, whitespace = 2) => {
  if (typeof u === "string") {
    return u;
  }
  try {
    return typeof u === "object" ? formatJson(u, {
      space: whitespace
    }) : String(u);
  } catch {
    return String(u);
  }
};
var BaseProto = {
  toJSON() {
    return toJson(this);
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  toString() {
    return format(this.toJSON());
  }
};

// node_modules/effect/dist/Utils.js
class SingleShotGen {
  called = false;
  self;
  constructor(self) {
    this.self = self;
  }
  next(a) {
    return this.called ? {
      value: a,
      done: true
    } : (this.called = true, {
      value: this.self,
      done: false
    });
  }
  [Symbol.iterator]() {
    return new SingleShotGen(this.self);
  }
}
var pickInternalCall = () => {
  const InternalTypeId = "~effect/Utils/internal";
  const standard = {
    [InternalTypeId]: (body) => {
      return body();
    }
  };
  const forced = {
    [InternalTypeId]: (body) => {
      try {
        return body();
      } finally {}
    }
  };
  const isNotOptimizedAway = standard[InternalTypeId](() => new Error().stack)?.includes(InternalTypeId) === true;
  return isNotOptimizedAway ? standard[InternalTypeId] : forced[InternalTypeId];
};
var internalCall = /* @__PURE__ */ pickInternalCall();

// node_modules/effect/dist/internal/record.js
function assignProperty(self, key, value) {
  if (key === "__proto__") {
    Object.defineProperty(self, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true
    });
  } else {
    self[key] = value;
  }
}
function assignProperties(self, source) {
  for (const key of Reflect.ownKeys(source)) {
    if (Object.prototype.propertyIsEnumerable.call(source, key)) {
      assignProperty(self, key, source[key]);
    }
  }
}

// node_modules/effect/dist/internal/core.js
var EffectTypeId = `~effect/Effect`;
var ExitTypeId = `~effect/Exit`;
var effectVariance = {
  _A: identity,
  _E: identity,
  _R: identity
};
var identifier = `${EffectTypeId}/identifier`;
var args = `${EffectTypeId}/args`;
var evaluate = `${EffectTypeId}/evaluate`;
var contA = `${EffectTypeId}/successCont`;
var contE = `${EffectTypeId}/failureCont`;
var contAll = `${EffectTypeId}/ensureCont`;
var Yield = /* @__PURE__ */ Symbol.for("effect/Effect/Yield");
var PipeInspectableProto = {
  pipe() {
    return pipeArguments(this, arguments);
  },
  toJSON() {
    return {
      ...this
    };
  },
  toString() {
    return format(this.toJSON(), {
      ignoreToString: true,
      space: 2
    });
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  }
};
var StructuralProto = {
  [symbol]() {
    return structureKeys(this, Object.keys(this));
  },
  [symbol2](that) {
    const selfKeys = Object.keys(this);
    const thatKeys = Object.keys(that);
    if (selfKeys.length !== thatKeys.length)
      return false;
    for (let i = 0;i < selfKeys.length; i++) {
      if (selfKeys[i] !== thatKeys[i] || !equals(this[selfKeys[i]], that[selfKeys[i]])) {
        return false;
      }
    }
    return true;
  }
};
var EffectProto = {
  [EffectTypeId]: effectVariance,
  ...PipeInspectableProto,
  [Symbol.iterator]() {
    return new SingleShotGen(this);
  },
  toJSON() {
    return {
      _id: "Effect",
      op: this[identifier],
      ...args in this ? {
        args: this[args]
      } : undefined
    };
  }
};
var isEffect = (u) => hasProperty(u, EffectTypeId);
var isExit = (u) => hasProperty(u, ExitTypeId);
var CauseTypeId = "~effect/Cause";
var CauseReasonTypeId = "~effect/Cause/Reason";
var isCause = (self) => hasProperty(self, CauseTypeId);
var isCauseReason = (self) => hasProperty(self, CauseReasonTypeId);

class CauseImpl {
  [CauseTypeId];
  reasons;
  constructor(failures) {
    this[CauseTypeId] = CauseTypeId;
    this.reasons = failures;
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
  toJSON() {
    return {
      _id: "Cause",
      failures: this.reasons.map((f) => f.toJSON())
    };
  }
  toString() {
    return `Cause(${format(this.reasons)})`;
  }
  [NodeInspectSymbol]() {
    return this.toJSON();
  }
  [symbol2](that) {
    return isCause(that) && this.reasons.length === that.reasons.length && this.reasons.every((e, i) => equals(e, that.reasons[i]));
  }
  [symbol]() {
    return array(this.reasons);
  }
}
var annotationsMap = /* @__PURE__ */ new WeakMap;

class ReasonBase {
  [CauseReasonTypeId];
  annotations;
  _tag;
  constructor(_tag, annotations, originalError) {
    this[CauseReasonTypeId] = CauseReasonTypeId;
    this._tag = _tag;
    if (annotations !== constEmptyAnnotations && typeof originalError === "object" && originalError !== null && annotations.size > 0) {
      const prevAnnotations = annotationsMap.get(originalError);
      if (prevAnnotations) {
        annotations = new Map([...prevAnnotations, ...annotations]);
      }
      annotationsMap.set(originalError, annotations);
    }
    this.annotations = annotations;
  }
  annotate(annotations, options) {
    if (annotations.mapUnsafe.size === 0)
      return this;
    const newAnnotations = new Map(this.annotations);
    annotations.mapUnsafe.forEach((value, key) => {
      if (options?.overwrite !== true && newAnnotations.has(key))
        return;
      newAnnotations.set(key, value);
    });
    const self = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    self.annotations = newAnnotations;
    return self;
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
  toString() {
    return format(this);
  }
  [NodeInspectSymbol]() {
    return this.toString();
  }
}
var constEmptyAnnotations = /* @__PURE__ */ new Map;

class Fail extends ReasonBase {
  error;
  constructor(error, annotations = constEmptyAnnotations) {
    super("Fail", annotations, error);
    this.error = error;
  }
  toString() {
    return `Fail(${format(this.error)})`;
  }
  toJSON() {
    return {
      _tag: "Fail",
      error: this.error
    };
  }
  [symbol2](that) {
    return isFailReason(that) && equals(this.error, that.error) && equals(this.annotations, that.annotations);
  }
  [symbol]() {
    return combine(string(this._tag))(combine(hash(this.error))(hash(this.annotations)));
  }
}
var causeFromReasons = (reasons) => new CauseImpl(reasons);
var causeEmpty = /* @__PURE__ */ new CauseImpl([]);
var causeFail = (error) => new CauseImpl([new Fail(error)]);

class Die extends ReasonBase {
  defect;
  constructor(defect, annotations = constEmptyAnnotations) {
    super("Die", annotations, defect);
    this.defect = defect;
  }
  toString() {
    return `Die(${format(this.defect)})`;
  }
  toJSON() {
    return {
      _tag: "Die",
      defect: this.defect
    };
  }
  [symbol2](that) {
    return isDieReason(that) && equals(this.defect, that.defect) && equals(this.annotations, that.annotations);
  }
  [symbol]() {
    return combine(string(this._tag))(combine(hash(this.defect))(hash(this.annotations)));
  }
}
var causeDie = (defect) => new CauseImpl([new Die(defect)]);
var causeAnnotate = /* @__PURE__ */ dual((args2) => isCause(args2[0]), (self, annotations, options) => {
  if (annotations.mapUnsafe.size === 0)
    return self;
  return new CauseImpl(self.reasons.map((f) => f.annotate(annotations, options)));
});
var isFailReason = (self) => self._tag === "Fail";
var isDieReason = (self) => self._tag === "Die";
var isInterruptReason = (self) => self._tag === "Interrupt";
function defaultEvaluate(_fiber) {
  return exitDie(`Effect.evaluate: Not implemented`);
}
var makePrimitiveProto = (options) => ({
  ...EffectProto,
  [identifier]: options.op,
  [evaluate]: options[evaluate] ?? defaultEvaluate,
  [contA]: options[contA],
  [contE]: options[contE],
  [contAll]: options[contAll]
});
var makePrimitive = (options) => {
  const Proto = makePrimitiveProto(options);
  return function() {
    const self = Object.create(Proto);
    self[args] = options.single === false ? arguments : arguments[0];
    return self;
  };
};
var makeExit = (options) => {
  const Proto = {
    [ExitTypeId]: ExitTypeId,
    _tag: options.op,
    get [options.prop]() {
      return this[args];
    },
    ...makePrimitiveProto(options),
    toString() {
      return `${options.op}(${format(this[args])})`;
    },
    toJSON() {
      return {
        _id: "Exit",
        _tag: options.op,
        [options.prop]: this[args]
      };
    },
    [symbol2](that) {
      return isExit(that) && that._tag === this._tag && equals(this[args], that[args]);
    },
    [symbol]() {
      return combine(string(options.op), hash(this[args]));
    }
  };
  return function(value) {
    const self = Object.create(Proto);
    self[args] = value;
    return self;
  };
};
var exitSucceed = /* @__PURE__ */ makeExit({
  op: "Success",
  prop: "value",
  [evaluate](fiber) {
    const cont = fiber.getCont(contA);
    return cont ? cont[contA](this[args], fiber, this) : fiber.yieldWith(this);
  }
});
var StackTraceKey = {
  key: "effect/Cause/StackTrace"
};
var InterruptorStackTrace = {
  key: "effect/Cause/InterruptorStackTrace"
};
var exitFailCause = /* @__PURE__ */ makeExit({
  op: "Failure",
  prop: "cause",
  [evaluate](fiber) {
    let cause = this[args];
    let annotated = false;
    if (fiber.currentStackFrame) {
      cause = causeAnnotate(cause, {
        mapUnsafe: new Map([[StackTraceKey.key, fiber.currentStackFrame]])
      });
      annotated = true;
    }
    let cont = fiber.getCont(contE);
    while (fiber.interruptible && fiber._interruptedCause && cont) {
      cont = fiber.getCont(contE);
    }
    return cont ? cont[contE](cause, fiber, annotated ? undefined : this) : fiber.yieldWith(annotated ? exitFailCause(cause) : this);
  }
});
var exitFail = (e) => exitFailCause(causeFail(e));
var exitDie = (defect) => exitFailCause(causeDie(defect));
var withFiber = /* @__PURE__ */ makePrimitive({
  op: "WithFiber",
  [evaluate](fiber) {
    return this[args](fiber);
  }
});
var YieldableError = /* @__PURE__ */ function() {

  class YieldableError2 extends globalThis.Error {
  }
  const proto = /* @__PURE__ */ makePrimitiveProto({
    op: "YieldableError",
    [evaluate]() {
      return exitFail(this);
    }
  });
  delete proto.toString;
  Object.assign(YieldableError2.prototype, proto);
  return YieldableError2;
}();
var Error2 = /* @__PURE__ */ function() {
  const plainArgsSymbol = /* @__PURE__ */ Symbol.for("effect/Data/Error/plainArgs");
  return class Base extends YieldableError {
    constructor(args2) {
      super(args2?.message, args2?.cause ? {
        cause: args2.cause
      } : undefined);
      if (args2) {
        assignProperties(this, args2);
        Object.defineProperty(this, plainArgsSymbol, {
          value: args2,
          enumerable: false
        });
      }
    }
    toJSON() {
      return {
        ...this[plainArgsSymbol],
        ...this
      };
    }
  };
}();
var TaggedError = (tag) => {

  class Base extends Error2 {
    _tag = tag;
  }
  Base.prototype.name = tag;
  return Base;
};
var NoSuchElementErrorTypeId = "~effect/Cause/NoSuchElementError";
var isNoSuchElementError = (u) => hasProperty(u, NoSuchElementErrorTypeId);

class NoSuchElementError extends (/* @__PURE__ */ TaggedError("NoSuchElementError")) {
  [NoSuchElementErrorTypeId] = NoSuchElementErrorTypeId;
  constructor(message) {
    super({
      message
    });
  }
}
var DoneTypeId = "~effect/Cause/Done";
var isDone = (u) => hasProperty(u, DoneTypeId);
var DoneVoid = {
  [DoneTypeId]: DoneTypeId,
  _tag: "Done",
  value: undefined
};
var Done = (value) => {
  if (value === undefined)
    return DoneVoid;
  return {
    [DoneTypeId]: DoneTypeId,
    _tag: "Done",
    value
  };
};
var doneVoid = /* @__PURE__ */ exitFail(DoneVoid);
var done = (value) => {
  if (value === undefined)
    return doneVoid;
  return exitFail(Done(value));
};

// node_modules/effect/dist/Effectable.js
var Prototype2 = (options) => makePrimitiveProto({
  op: options.label,
  [evaluate]: options.evaluate
});

// node_modules/effect/dist/Combiner.js
function make(combine2) {
  return {
    combine: combine2
  };
}

// node_modules/effect/dist/Reducer.js
function make2(combine2, initialValue, combineAll) {
  return {
    combine: combine2,
    initialValue,
    combineAll: combineAll ?? ((collection) => {
      let out = initialValue;
      for (const value of collection) {
        out = combine2(out, value);
      }
      return out;
    })
  };
}

// node_modules/effect/dist/Equivalence.js
var make3 = (isEquivalent) => (self, that) => self === that || isEquivalent(self, that);
var isStrictEquivalent = (x, y) => x === y;
var strictEqual = () => isStrictEquivalent;
function Array_(item) {
  return make3((self, that) => {
    if (self.length !== that.length)
      return false;
    for (let i = 0;i < self.length; i++) {
      if (!item(self[i], that[i]))
        return false;
    }
    return true;
  });
}

// node_modules/effect/dist/internal/doNotation.js
var let_ = (map) => dual(3, (self, name, f) => map(self, (a) => ({
  ...a,
  [name]: f(a)
})));
var bindTo = (map) => dual(2, (self, name) => map(self, (a) => ({
  [name]: a
})));
var bind = (map, flatMap) => dual(3, (self, name, f) => flatMap(self, (a) => map(f(a), (b) => ({
  ...a,
  [name]: b
}))));

// node_modules/effect/dist/internal/option.js
var TypeId = "~effect/data/Option";
var CommonProto = {
  [TypeId]: {
    _A: (_) => _
  },
  ...PipeInspectableProto,
  [Symbol.iterator]() {
    return new SingleShotGen(this);
  }
};
var SomeProto = /* @__PURE__ */ Object.defineProperty(/* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(CommonProto), {
  _tag: "Some",
  _op: "Some",
  [symbol2](that) {
    return isOption(that) && isSome(that) && equals(this.value, that.value);
  },
  [symbol]() {
    return combine(hash(this._tag))(hash(this.value));
  },
  toString() {
    return `some(${format(this.value)})`;
  },
  toJSON() {
    return {
      _id: "Option",
      _tag: this._tag,
      value: toJson(this.value)
    };
  }
}), "valueOrUndefined", {
  get() {
    return this.value;
  }
});
var NoneHash = /* @__PURE__ */ hash("None");
var NoneProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(CommonProto), {
  _tag: "None",
  _op: "None",
  valueOrUndefined: undefined,
  [symbol2](that) {
    return isOption(that) && isNone(that);
  },
  [symbol]() {
    return NoneHash;
  },
  toString() {
    return `none()`;
  },
  toJSON() {
    return {
      _id: "Option",
      _tag: this._tag
    };
  }
});
var isOption = (input) => hasProperty(input, TypeId);
var isNone = (fa) => fa._tag === "None";
var isSome = (fa) => fa._tag === "Some";
var none = /* @__PURE__ */ Object.create(NoneProto);
var some = (value) => {
  const a = Object.create(SomeProto);
  a.value = value;
  return a;
};

// node_modules/effect/dist/internal/result.js
var TypeId2 = "~effect/data/Result";
var CommonProto2 = {
  [TypeId2]: {
    _A: (_) => _,
    _E: (_) => _
  },
  ...PipeInspectableProto,
  [Symbol.iterator]() {
    return new SingleShotGen(this);
  }
};
var SuccessProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(CommonProto2), {
  _tag: "Success",
  _op: "Success",
  [symbol2](that) {
    return isResult(that) && isSuccess(that) && equals(this.success, that.success);
  },
  [symbol]() {
    return combine(hash(this._tag))(hash(this.success));
  },
  toString() {
    return `success(${format(this.success)})`;
  },
  toJSON() {
    return {
      _id: "Result",
      _tag: this._tag,
      value: toJson(this.success)
    };
  }
});
var FailureProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(CommonProto2), {
  _tag: "Failure",
  _op: "Failure",
  [symbol2](that) {
    return isResult(that) && isFailure(that) && equals(this.failure, that.failure);
  },
  [symbol]() {
    return combine(hash(this._tag))(hash(this.failure));
  },
  toString() {
    return `failure(${format(this.failure)})`;
  },
  toJSON() {
    return {
      _id: "Result",
      _tag: this._tag,
      failure: toJson(this.failure)
    };
  }
});
var isResult = (input) => hasProperty(input, TypeId2);
var isFailure = (result) => result._tag === "Failure";
var isSuccess = (result) => result._tag === "Success";
var fail = (failure) => {
  const a = Object.create(FailureProto);
  a.failure = failure;
  return a;
};
var succeed = (success) => {
  const a = Object.create(SuccessProto);
  a.success = success;
  return a;
};

// node_modules/effect/dist/Order.js
function make4(compare) {
  return (self, that) => self === that ? 0 : compare(self, that);
}
var Number2 = /* @__PURE__ */ make4((self, that) => {
  if (globalThis.Number.isNaN(self) && globalThis.Number.isNaN(that))
    return 0;
  if (globalThis.Number.isNaN(self))
    return -1;
  if (globalThis.Number.isNaN(that))
    return 1;
  return self < that ? -1 : 1;
});
var BigInt2 = /* @__PURE__ */ make4((self, that) => self < that ? -1 : 1);
var mapInput = /* @__PURE__ */ dual(2, (self, f) => make4((b1, b2) => self(f(b1), f(b2))));
var Date2 = /* @__PURE__ */ mapInput(Number2, (date) => date.getTime());
var isLessThan = (O) => dual(2, (self, that) => O(self, that) === -1);
var isGreaterThan = (O) => dual(2, (self, that) => O(self, that) === 1);
var isLessThanOrEqualTo = (O) => dual(2, (self, that) => O(self, that) !== 1);
var isGreaterThanOrEqualTo = (O) => dual(2, (self, that) => O(self, that) !== -1);

// node_modules/effect/dist/Option.js
var none2 = () => none;
var some2 = some;
var isOption2 = isOption;
var isNone2 = isNone;
var isSome2 = isSome;
var match = /* @__PURE__ */ dual(2, (self, {
  onNone,
  onSome
}) => isNone2(self) ? onNone() : onSome(self.value));
var getOrElse = /* @__PURE__ */ dual(2, (self, onNone) => isNone2(self) ? onNone() : self.value);
var fromNullishOr = (a) => a == null ? none2() : some2(a);
var fromUndefinedOr = (a) => a === undefined ? none2() : some2(a);
var fromNullOr = (a) => a === null ? none2() : some2(a);
var getOrNull = /* @__PURE__ */ getOrElse(constNull);
var getOrUndefined = /* @__PURE__ */ getOrElse(constUndefined);
var liftThrowable = (f) => (...a) => {
  try {
    return some2(f(...a));
  } catch {
    return none2();
  }
};
var map = /* @__PURE__ */ dual(2, (self, f) => isNone2(self) ? none2() : some2(f(self.value)));
var flatMap = /* @__PURE__ */ dual(2, (self, f) => isNone2(self) ? none2() : f(self.value));
var flatten = /* @__PURE__ */ flatMap(identity);
var filter = /* @__PURE__ */ dual(2, (self, predicate) => isNone2(self) ? none2() : predicate(self.value) ? some2(self.value) : none2());
var makeEquivalence = (isEquivalent) => make3((x, y) => isNone2(x) ? isNone2(y) : isNone2(y) ? false : isEquivalent(x.value, y.value));

// node_modules/effect/dist/Context.js
var ServiceTypeId = "~effect/Context/Service";
var Service = function() {
  function KeyClass() {}
  const self = KeyClass;
  Object.setPrototypeOf(self, ServiceProto);
  const init = (key, options) => {
    self.key = key;
    if (options?.defaultValue) {
      self[ReferenceTypeId] = ReferenceTypeId;
      self.defaultValue = options.defaultValue;
    }
    if (options?.make) {
      self.make = options.make;
    }
    if (options?.fiberCached) {
      cacheKeys.add(key);
    }
    return self;
  };
  return arguments.length > 0 ? init(arguments[0], arguments[1]) : init;
};
var ServiceProto = {
  [ServiceTypeId]: ServiceTypeId,
  .../* @__PURE__ */ Prototype2({
    label: "Service",
    evaluate(fiber) {
      return exitSucceed(get(fiber.context, this));
    }
  }),
  toJSON() {
    return {
      _id: "Service",
      key: this.key
    };
  },
  of(self) {
    return self;
  },
  context(self) {
    return make5(this, self);
  },
  use(f) {
    return withFiber((fiber) => f(get(fiber.context, this)));
  },
  useSync(f) {
    return withFiber((fiber) => exitSucceed(f(get(fiber.context, this))));
  }
};
var cacheKeys = /* @__PURE__ */ new Set;
var ReferenceTypeId = "~effect/Context/Reference";
var TypeId3 = "~effect/Context";
var MaxDepth = 8;
var FlattenAfterBaseHits = 8;
var makeImpl = (cacheRoot, base, overlay, depth) => {
  const self = Object.create(Proto);
  self.cacheRoot = cacheRoot ?? self;
  self.base = base;
  self.overlay = overlay;
  self.depth = depth;
  self._flat = undefined;
  self.baseHits = 0;
  return self;
};
var applyOverlays = (map2, overlay) => {
  if (!overlay)
    return;
  applyOverlays(map2, overlay.parent);
  map2.set(overlay.key, overlay.value);
};
var flatten2 = (self) => {
  if (self._flat)
    return self._flat;
  if (!self.overlay)
    return self._flat = self.base;
  const map2 = new Map(self.base);
  applyOverlays(map2, self.overlay);
  return self._flat = map2;
};
var withFlat = (self, f) => {
  const map2 = new Map(self.mapUnsafe);
  f(map2);
  return makeUnsafe(map2);
};
var notFound = /* @__PURE__ */ Symbol();
var lookup = (self, key) => {
  const impl = self;
  for (let overlay = impl.overlay;overlay; overlay = overlay.parent) {
    if (overlay.key === key)
      return overlay.value;
  }
  const value = impl.base.get(key);
  if (value === undefined && !impl.base.has(key))
    return notFound;
  if (impl.overlay && ++impl.baseHits >= FlattenAfterBaseHits) {
    impl.base = flatten2(impl);
    impl.overlay = undefined;
    impl.depth = 0;
  }
  return value;
};
var makeUnsafe = (mapUnsafe) => makeImpl(undefined, mapUnsafe, undefined, 0);
var Proto = {
  ...PipeInspectableProto,
  [TypeId3]: {
    _Services: (_) => _
  },
  get mapUnsafe() {
    return flatten2(this);
  },
  toJSON() {
    return {
      _id: "Context",
      services: Array.from(this.mapUnsafe).map(([key, value]) => ({
        key,
        value
      }))
    };
  },
  [symbol2](that) {
    if (!isContext(that))
      return false;
    const self = this.mapUnsafe;
    const other = that.mapUnsafe;
    if (self.size !== other.size)
      return false;
    for (const [key, value] of self) {
      if (!other.has(key) || !equals(value, other.get(key)))
        return false;
    }
    return true;
  },
  [symbol]() {
    return number(this.mapUnsafe.size);
  }
};
var hasSameCache = (self, that) => self.cacheRoot === that.cacheRoot;
var isContext = (u) => hasProperty(u, TypeId3);
var isReference = (u) => !!u[ReferenceTypeId];
var empty = () => emptyContext2;
var emptyContext2 = /* @__PURE__ */ makeUnsafe(/* @__PURE__ */ new Map);
var make5 = (key, service) => makeUnsafe(new Map([[key.key, service]]));
var add = /* @__PURE__ */ dual(3, (self, key, service) => {
  const impl = self;
  const cacheRoot = cacheKeys.has(key.key) ? undefined : impl.cacheRoot;
  if (impl.depth >= MaxDepth) {
    const map2 = new Map(impl.mapUnsafe);
    map2.set(key.key, service);
    return makeImpl(cacheRoot, map2, undefined, 0);
  }
  return makeImpl(cacheRoot, impl.base, {
    key: key.key,
    value: service,
    parent: impl.overlay
  }, impl.depth + 1);
});
var getOrUndefined2 = /* @__PURE__ */ dual(2, (self, key) => getOrUndefinedUnsafe(self, key.key));
var getOrUndefinedUnsafe = (self, key) => {
  const value = lookup(self, key);
  return value === notFound ? undefined : value;
};
var getUnsafe = /* @__PURE__ */ dual(2, (self, service) => {
  const value = lookup(self, service.key);
  if (value === notFound) {
    if (isReference(service))
      return getDefaultValue(service);
    throw serviceNotFoundError(service);
  }
  return value;
});
var get = getUnsafe;
var defaultValueCacheKey = "~effect/Context/defaultValue";
var getDefaultValue = (ref) => {
  if (defaultValueCacheKey in ref) {
    return ref[defaultValueCacheKey];
  }
  return ref[defaultValueCacheKey] = ref.defaultValue();
};
var serviceNotFoundError = (service) => {
  const error = new Error(`Service not found${service.key ? `: ${String(service.key)}` : ""}`);
  if (error.stack) {
    const lines = error.stack.split(`
`);
    lines.splice(1, 3);
    error.stack = lines.join(`
`);
  }
  return error;
};
var getOption = /* @__PURE__ */ dual(2, (self, service) => {
  const value = lookup(self, service.key);
  if (value !== notFound)
    return some2(value);
  return isReference(service) ? some2(getDefaultValue(service)) : none2();
});
var merge = /* @__PURE__ */ dual(2, (self, that) => {
  if (self.mapUnsafe.size === 0)
    return that;
  if (that.mapUnsafe.size === 0)
    return self;
  return withFlat(self, (map2) => that.mapUnsafe.forEach((value, key) => map2.set(key, value)));
});
var mergeAll = (...ctxs) => {
  const map2 = new Map;
  for (let i = 0;i < ctxs.length; i++) {
    ctxs[i].mapUnsafe.forEach((value, key) => {
      map2.set(key, value);
    });
  }
  return makeUnsafe(map2);
};
var Reference = Service;

// node_modules/effect/dist/Duration.js
var TypeId4 = "~effect/time/Duration";
var bigint0 = /* @__PURE__ */ BigInt(0);
var bigint1 = /* @__PURE__ */ BigInt(1);
var bigint2 = /* @__PURE__ */ BigInt(2);
var bigint10 = /* @__PURE__ */ BigInt(10);
var bigint1e3 = /* @__PURE__ */ BigInt(1000);
var roundTiesAwayFromZero = (input) => BigInt(input < 0 ? Math.ceil(input - 0.5) : Math.floor(input + 0.5));
var roundMillisToNanos = (millis) => roundTiesAwayFromZero(millis * 1e6);
var parseNanos = (input, scale) => {
  const decimalIndex = input.indexOf(".");
  if (decimalIndex === -1)
    return BigInt(input) * scale;
  const isNegative = input[0] === "-";
  const fractional = input.slice(decimalIndex + 1);
  const fractionalScale = bigint10 ** BigInt(fractional.length);
  const scaled = (BigInt(input.slice(isNegative ? 1 : 0, decimalIndex)) * fractionalScale + BigInt(fractional)) * scale;
  const rounded = scaled / fractionalScale + (scaled % fractionalScale * bigint2 >= fractionalScale ? bigint1 : bigint0);
  return isNegative ? -rounded : rounded;
};
var DURATION_REGEXP = /^(-?\d+(?:\.\d+)?)\s+(nanos?|micros?|millis?|seconds?|minutes?|hours?|days?|weeks?)$/;
var fromInputUnsafe = (input) => {
  switch (typeof input) {
    case "number":
      return millis(input);
    case "bigint":
      return nanos(input);
    case "string": {
      if (input === "Infinity") {
        return infinity;
      }
      if (input === "-Infinity") {
        return negativeInfinity;
      }
      const match2 = DURATION_REGEXP.exec(input);
      if (!match2)
        break;
      const [_, valueStr, unit] = match2;
      if (unit === "nano" || unit === "nanos") {
        return nanos(parseNanos(valueStr, bigint1));
      }
      if (unit === "micro" || unit === "micros") {
        return nanos(parseNanos(valueStr, bigint1e3));
      }
      const value = Number(valueStr);
      switch (unit) {
        case "milli":
        case "millis":
          return millis(value);
        case "second":
        case "seconds":
          return seconds(value);
        case "minute":
        case "minutes":
          return minutes(value);
        case "hour":
        case "hours":
          return hours(value);
        case "day":
        case "days":
          return days(value);
        case "week":
        case "weeks":
          return weeks(value);
      }
      break;
    }
    case "object": {
      if (input === null)
        break;
      if (TypeId4 in input)
        return input;
      if (Array.isArray(input)) {
        if (input.length !== 2 || !input.every(isNumber)) {
          return invalid(input);
        }
        if (Number.isNaN(input[0]) || Number.isNaN(input[1])) {
          return zero;
        }
        if (input[0] === -Infinity || input[1] === -Infinity) {
          return negativeInfinity;
        }
        if (input[0] === Infinity || input[1] === Infinity) {
          return infinity;
        }
        return make6(roundTiesAwayFromZero(input[0] * 1e9 + input[1]));
      }
      const obj = input;
      let millis = 0;
      if (obj.weeks)
        millis += obj.weeks * 604800000;
      if (obj.days)
        millis += obj.days * 86400000;
      if (obj.hours)
        millis += obj.hours * 3600000;
      if (obj.minutes)
        millis += obj.minutes * 60000;
      if (obj.seconds)
        millis += obj.seconds * 1000;
      if (obj.milliseconds)
        millis += obj.milliseconds;
      if (!obj.microseconds && !obj.nanoseconds)
        return make6(millis);
      return make6(roundTiesAwayFromZero(millis * 1e6 + (obj.microseconds ?? 0) * 1000 + (obj.nanoseconds ?? 0)));
    }
  }
  return invalid(input);
};
var invalid = (input) => {
  throw new Error(`Invalid Input: ${input}`);
};
var fromInput = /* @__PURE__ */ liftThrowable(fromInputUnsafe);
var zeroDurationValue = {
  _tag: "Millis",
  millis: 0
};
var infinityDurationValue = {
  _tag: "Infinity"
};
var negativeInfinityDurationValue = {
  _tag: "NegativeInfinity"
};
var DurationProto = {
  [TypeId4]: TypeId4,
  [symbol]() {
    switch (this.value._tag) {
      case "Millis": {
        const nanos = this.value.millis * 1e6;
        return Number.isFinite(nanos) ? hash(roundTiesAwayFromZero(nanos)) : number(this.value.millis);
      }
      case "Nanos":
        return hash(this.value.nanos);
      default:
        return structure(this.value);
    }
  },
  [symbol2](that) {
    return isDuration(that) && equals2(this, that);
  },
  toString() {
    switch (this.value._tag) {
      case "Infinity":
        return "Infinity";
      case "NegativeInfinity":
        return "-Infinity";
      case "Nanos":
        return `${this.value.nanos} nanos`;
      case "Millis":
        return `${this.value.millis} millis`;
    }
  },
  toJSON() {
    switch (this.value._tag) {
      case "Millis":
        return {
          _id: "Duration",
          _tag: "Millis",
          millis: this.value.millis
        };
      case "Nanos":
        return {
          _id: "Duration",
          _tag: "Nanos",
          nanos: String(this.value.nanos)
        };
      case "Infinity":
        return {
          _id: "Duration",
          _tag: "Infinity"
        };
      case "NegativeInfinity":
        return {
          _id: "Duration",
          _tag: "NegativeInfinity"
        };
    }
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var make6 = (input) => {
  const duration = Object.create(DurationProto);
  if (typeof input === "number") {
    if (isNaN(input) || input === 0 || Object.is(input, -0)) {
      duration.value = zeroDurationValue;
    } else if (!Number.isFinite(input)) {
      duration.value = input > 0 ? infinityDurationValue : negativeInfinityDurationValue;
    } else if (!Number.isInteger(input)) {
      duration.value = {
        _tag: "Nanos",
        nanos: roundMillisToNanos(input)
      };
    } else {
      duration.value = {
        _tag: "Millis",
        millis: input
      };
    }
  } else if (input === bigint0) {
    duration.value = zeroDurationValue;
  } else {
    duration.value = {
      _tag: "Nanos",
      nanos: input
    };
  }
  return duration;
};
var isDuration = (u) => hasProperty(u, TypeId4);
var zero = /* @__PURE__ */ make6(0);
var infinity = /* @__PURE__ */ make6(Infinity);
var negativeInfinity = /* @__PURE__ */ make6(-Infinity);
var nanos = (nanos2) => make6(nanos2);
var millis = (millis2) => make6(millis2);
var seconds = (seconds2) => make6(seconds2 * 1000);
var minutes = (minutes2) => make6(minutes2 * 60000);
var hours = (hours2) => make6(hours2 * 3600000);
var days = (days2) => make6(days2 * 86400000);
var weeks = (weeks2) => make6(weeks2 * 604800000);
var toMillis = (self) => match2(fromInputUnsafe(self), {
  onMillis: identity,
  onNanos: (nanos2) => Number(nanos2) / 1e6,
  onInfinity: () => Infinity,
  onNegativeInfinity: () => -Infinity
});
var toNanosUnsafe = (input) => {
  const self = fromInputUnsafe(input);
  switch (self.value._tag) {
    case "Infinity":
    case "NegativeInfinity":
      throw new Error("Cannot convert infinite duration to nanos");
    case "Nanos":
      return self.value.nanos;
    case "Millis":
      return roundMillisToNanos(self.value.millis);
  }
};
var toNanos = /* @__PURE__ */ liftThrowable(toNanosUnsafe);
var match2 = /* @__PURE__ */ dual(2, (self, options) => {
  switch (self.value._tag) {
    case "Millis":
      return options.onMillis(self.value.millis);
    case "Nanos":
      return options.onNanos(self.value.nanos);
    case "Infinity":
      return options.onInfinity();
    case "NegativeInfinity":
      return (options.onNegativeInfinity ?? options.onInfinity)();
  }
});
var matchPair = /* @__PURE__ */ dual(3, (self, that, options) => {
  if (self.value._tag === "Infinity" || self.value._tag === "NegativeInfinity" || that.value._tag === "Infinity" || that.value._tag === "NegativeInfinity")
    return options.onInfinity(self, that);
  if (self.value._tag === "Millis") {
    return that.value._tag === "Millis" ? options.onMillis(self.value.millis, that.value.millis) : options.onNanos(toNanosUnsafe(self), that.value.nanos);
  } else {
    return options.onNanos(self.value.nanos, toNanosUnsafe(that));
  }
});
var Equivalence = (self, that) => matchPair(self, that, {
  onMillis: (self2, that2) => self2 === that2,
  onNanos: (self2, that2) => self2 === that2,
  onInfinity: (self2, that2) => self2.value._tag === that2.value._tag
});
var subtract = /* @__PURE__ */ dual(2, (self, that) => matchPair(self, that, {
  onMillis: (self2, that2) => make6(self2 - that2),
  onNanos: (self2, that2) => make6(self2 - that2),
  onInfinity: (self2, that2) => {
    const s = self2.value._tag;
    const t = that2.value._tag;
    if (s === "Infinity")
      return t === "Infinity" ? zero : infinity;
    if (s === "NegativeInfinity")
      return t === "NegativeInfinity" ? zero : negativeInfinity;
    return t === "Infinity" ? negativeInfinity : infinity;
  }
}));
var equals2 = /* @__PURE__ */ dual(2, (self, that) => Equivalence(self, that));

// node_modules/effect/dist/internal/array.js
var isArrayNonEmpty = (self) => self.length > 0;

// node_modules/effect/dist/Result.js
var succeed2 = succeed;
var fail2 = fail;
var try_ = (evaluate2) => {
  if (isFunction(evaluate2)) {
    try {
      return succeed2(evaluate2());
    } catch (e) {
      return fail2(e);
    }
  } else {
    try {
      return succeed2(evaluate2.try());
    } catch (e) {
      return fail2(evaluate2.catch(e));
    }
  }
};
var isResult2 = isResult;
var isFailure2 = isFailure;
var isSuccess2 = isSuccess;
var makeEquivalence2 = (success, failure) => make3((x, y) => isFailure2(x) ? isFailure2(y) && failure(x.failure, y.failure) : isSuccess2(y) && success(x.success, y.success));
var mapError = /* @__PURE__ */ dual(2, (self, f) => isFailure2(self) ? fail2(f(self.failure)) : self);
var map2 = /* @__PURE__ */ dual(2, (self, f) => isSuccess2(self) ? succeed2(f(self.success)) : self);
var match3 = /* @__PURE__ */ dual(2, (self, {
  onFailure,
  onSuccess
}) => isFailure2(self) ? onFailure(self.failure) : onSuccess(self.success));
var getOrElse2 = /* @__PURE__ */ dual(2, (self, onFailure) => isFailure2(self) ? onFailure(self.failure) : self.success);
var flatMap2 = /* @__PURE__ */ dual(2, (self, f) => isFailure2(self) ? fail2(self.failure) : f(self.success));

// node_modules/effect/dist/Iterable.js
var constEmpty = {
  [Symbol.iterator]() {
    return constEmptyIterator;
  }
};
var constEmptyIterator = {
  next() {
    return {
      done: true,
      value: undefined
    };
  }
};
var filter2 = /* @__PURE__ */ dual(2, (self, predicate) => ({
  [Symbol.iterator]() {
    const iterator = self[Symbol.iterator]();
    let i = 0;
    return {
      next() {
        let result = iterator.next();
        while (!result.done) {
          if (predicate(result.value, i++)) {
            return {
              done: false,
              value: result.value
            };
          }
          result = iterator.next();
        }
        return {
          done: true,
          value: undefined
        };
      }
    };
  }
}));

// node_modules/effect/dist/Record.js
var map3 = /* @__PURE__ */ dual(2, (self, f) => {
  const out = {
    ...self
  };
  for (const key of keys(self)) {
    assignProperty(out, key, f(self[key], key));
  }
  return out;
});
var keys = (self) => Object.keys(self);

// node_modules/effect/dist/Array.js
var Array2 = globalThis.Array;
var allocate = (n) => new Array2(n);
var fromIterable = (collection) => Array2.isArray(collection) ? collection : Array2.from(collection);
var ensure = (self) => Array2.isArray(self) ? self : [self];
var append = /* @__PURE__ */ dual(2, (self, last) => [...self, last]);
var appendAll = /* @__PURE__ */ dual(2, (self, that) => fromIterable(self).concat(fromIterable(that)));
var isArray = Array2.isArray;
var isArrayNonEmpty2 = isArrayNonEmpty;
var isReadonlyArrayNonEmpty = isArrayNonEmpty;
var takeWhile = /* @__PURE__ */ dual(2, (self, predicate) => {
  let i = 0;
  const out = [];
  for (const a of self) {
    if (!predicate(a, i)) {
      break;
    }
    out.push(a);
    i++;
  }
  return out;
});
var sort = /* @__PURE__ */ dual(2, (self, O) => {
  const out = Array2.from(self);
  out.sort(O);
  return out;
});
var hashBucketsAdd = (buckets, value) => {
  const hash2 = hash(value);
  const bucket = buckets.get(hash2);
  if (bucket === undefined) {
    buckets.set(hash2, [value]);
    return true;
  }
  for (const previous of bucket) {
    if (equals(previous, value)) {
      return false;
    }
  }
  bucket.push(value);
  return true;
};
var union = /* @__PURE__ */ dual(2, (self, that) => {
  const a = fromIterable(self);
  const b = fromIterable(that);
  if (isReadonlyArrayNonEmpty(a)) {
    return isReadonlyArrayNonEmpty(b) ? dedupe(appendAll(a, b)) : a;
  }
  return b;
});
var empty2 = () => [];
var map4 = /* @__PURE__ */ dual(2, (self, f) => self.map(f));
var getSomes = (self) => {
  const out = [];
  for (const a of self) {
    if (isSome2(a)) {
      out.push(a.value);
    }
  }
  return out;
};
var partition = /* @__PURE__ */ dual(2, (self, f) => {
  const excluded = [];
  const satisfying = [];
  let i = 0;
  for (const a of self) {
    const result = f(a, i++);
    if (isSuccess2(result)) {
      satisfying.push(result.success);
    } else {
      excluded.push(result.failure);
    }
  }
  return [excluded, satisfying];
});
var dedupe = (self) => {
  const input = fromIterable(self);
  if (input.length < 2) {
    return [...input];
  }
  const buckets = new Map;
  const out = [];
  for (const value of input) {
    if (hashBucketsAdd(buckets, value)) {
      out.push(value);
    }
  }
  return out;
};
var reducer = /* @__PURE__ */ make2((a, b) => a.concat(b), []);
function makeReducerConcat() {
  return reducer;
}

// node_modules/effect/dist/Filter.js
var composePassthrough = /* @__PURE__ */ dual(2, (left, right) => (input) => {
  const leftOut = left(input);
  if (isFailure2(leftOut))
    return fail2(input);
  const rightOut = right(leftOut.success);
  if (isFailure2(rightOut))
    return fail2(input);
  return rightOut;
});

// node_modules/effect/dist/Scheduler.js
var Scheduler = /* @__PURE__ */ Reference("effect/Scheduler", {
  fiberCached: true,
  defaultValue: () => new MixedScheduler
});
var setImmediate = "setImmediate" in globalThis ? (f) => {
  const timer = globalThis.setImmediate(f);
  return () => globalThis.clearImmediate(timer);
} : (f) => {
  const timer = setTimeout(f, 0);
  return () => clearTimeout(timer);
};
var setMicrotask = (f) => {
  let cancelled = false;
  queueMicrotask(() => {
    if (!cancelled)
      f();
  });
  return () => {
    cancelled = true;
  };
};

class PriorityBuckets {
  buckets = [];
  scheduleTask(task, priority) {
    const buckets = this.buckets;
    const len = buckets.length;
    let bucket;
    let index = 0;
    for (;index < len; index++) {
      if (buckets[index][0] > priority)
        break;
      bucket = buckets[index];
    }
    if (bucket && bucket[0] === priority) {
      bucket[1].push(task);
    } else if (index === len) {
      buckets.push([priority, [task]]);
    } else {
      buckets.splice(index, 0, [priority, [task]]);
    }
  }
  drain() {
    const buckets = this.buckets;
    this.buckets = [];
    return buckets;
  }
}

class MixedScheduler {
  executionMode;
  setImmediate;
  constructor(executionMode = "async", setImmediateFn) {
    this.executionMode = executionMode;
    this.setImmediate = setImmediateFn ?? (executionMode === "sync" ? setMicrotask : setImmediate);
  }
  shouldYield(fiber) {
    return fiber.currentOpCount >= fiber.maxOpsBeforeYield;
  }
  makeDispatcher() {
    return new MixedSchedulerDispatcher(this.setImmediate);
  }
}

class MixedSchedulerDispatcher {
  tasks = /* @__PURE__ */ new PriorityBuckets;
  running = undefined;
  setImmediate;
  constructor(setImmediateFn = setImmediate) {
    this.setImmediate = setImmediateFn;
  }
  scheduleTask(task, priority) {
    this.tasks.scheduleTask(task, priority);
    if (this.running === undefined) {
      this.running = this.setImmediate(this.afterScheduled);
    }
  }
  afterScheduled = () => {
    this.running = undefined;
    this.runTasks();
  };
  runTasks() {
    const buckets = this.tasks.drain();
    for (let i = 0;i < buckets.length; i++) {
      const toRun = buckets[i][1];
      for (let j = 0;j < toRun.length; j++) {
        toRun[j]();
      }
    }
  }
  flush() {
    while (this.tasks.buckets.length > 0) {
      if (this.running !== undefined) {
        this.running();
        this.running = undefined;
      }
      this.runTasks();
    }
  }
}
var MaxOpsBeforeYield = /* @__PURE__ */ Reference("effect/Scheduler/MaxOpsBeforeYield", {
  fiberCached: true,
  defaultValue: () => 2048
});
var PreventSchedulerYield = /* @__PURE__ */ Reference("effect/Scheduler/PreventSchedulerYield", {
  fiberCached: true,
  defaultValue: () => false
});

// node_modules/effect/dist/Tracer.js
var ParentSpanKey = "effect/Tracer/ParentSpan";

class ParentSpan extends (/* @__PURE__ */ Service()(ParentSpanKey, {
  fiberCached: true
})) {
}
var make7 = (options) => options;
var DisablePropagation = /* @__PURE__ */ Reference("effect/Tracer/DisablePropagation", {
  defaultValue: constFalse
});
var CurrentTraceLevel = /* @__PURE__ */ Reference("effect/Tracer/CurrentTraceLevel", {
  defaultValue: () => "Info"
});
var MinimumTraceLevel = /* @__PURE__ */ Reference("effect/Tracer/MinimumTraceLevel", {
  defaultValue: () => "All"
});
var TracerKey = "effect/Tracer";
var Tracer = /* @__PURE__ */ Reference(TracerKey, {
  fiberCached: true,
  defaultValue: () => make7({
    span: (options) => new NativeSpan(options)
  })
});

class NativeSpan {
  _tag = "Span";
  spanId;
  traceId = "native";
  sampled;
  name;
  parent;
  annotations;
  links;
  startTime;
  kind;
  status;
  attributes;
  events = [];
  constructor(options) {
    this.name = options.name;
    this.parent = options.parent;
    this.annotations = options.annotations;
    this.links = options.links;
    this.startTime = options.startTime;
    this.kind = options.kind;
    this.sampled = options.sampled;
    this.status = {
      _tag: "Started",
      startTime: options.startTime
    };
    this.attributes = new Map;
    this.traceId = getOrUndefined(options.parent)?.traceId ?? randomHexString(32);
    this.spanId = randomHexString(16);
  }
  end(endTime, exit) {
    this.status = {
      _tag: "Ended",
      endTime,
      exit,
      startTime: this.status.startTime
    };
  }
  attribute(key, value) {
    this.attributes.set(key, value);
  }
  event(name, startTime, attributes) {
    this.events.push([name, startTime, attributes ?? {}]);
  }
  addLinks(links) {
    this.links.push(...links);
  }
}
var randomHexString = /* @__PURE__ */ function() {
  const characters = "abcdef0123456789";
  const charactersLength = characters.length;
  return function(length) {
    let result = "";
    for (let i = 0;i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  };
}();

// node_modules/effect/dist/internal/metric.js
var FiberRuntimeMetricsKey = "effect/observability/Metric/FiberRuntimeMetricsKey";

// node_modules/effect/dist/internal/references.js
var CurrentErrorReporters = /* @__PURE__ */ Reference("effect/ErrorReporter/CurrentErrorReporters", {
  defaultValue: () => new Set
});
var CurrentStackFrame = /* @__PURE__ */ Reference("effect/References/CurrentStackFrame", {
  fiberCached: true,
  defaultValue: constUndefined
});
var TracerEnabled = /* @__PURE__ */ Reference("effect/References/TracerEnabled", {
  defaultValue: constTrue
});
var TracerTimingEnabled = /* @__PURE__ */ Reference("effect/References/TracerTimingEnabled", {
  defaultValue: constTrue
});
var TracerSpanAnnotations = /* @__PURE__ */ Reference("effect/References/TracerSpanAnnotations", {
  defaultValue: () => ({})
});
var TracerSpanLinks = /* @__PURE__ */ Reference("effect/References/TracerSpanLinks", {
  defaultValue: () => []
});
var CurrentLogAnnotations = /* @__PURE__ */ Reference("effect/References/CurrentLogAnnotations", {
  defaultValue: () => ({})
});
var CurrentLogLevel = /* @__PURE__ */ Reference("effect/References/CurrentLogLevel", {
  fiberCached: true,
  defaultValue: () => "Info"
});
var MinimumLogLevel = /* @__PURE__ */ Reference("effect/References/MinimumLogLevel", {
  fiberCached: true,
  defaultValue: () => "Info"
});
var CurrentLogSpans = /* @__PURE__ */ Reference("effect/References/CurrentLogSpans", {
  defaultValue: () => []
});

// node_modules/effect/dist/internal/stackTraceLimit.js
var isStackTraceLimitWritable = () => {
  const desc = Object.getOwnPropertyDescriptor(Error, "stackTraceLimit");
  if (desc === undefined) {
    return Object.isExtensible(Error);
  }
  return Object.hasOwn(desc, "writable") ? desc.writable === true : desc.set !== undefined;
};
var canWriteStackTraceLimit = /* @__PURE__ */ isStackTraceLimitWritable();
var getStackTraceLimit = () => Error.stackTraceLimit;
var setStackTraceLimit = (value) => {
  if (canWriteStackTraceLimit) {
    Error.stackTraceLimit = value;
  }
};

// node_modules/effect/dist/internal/tracer.js
var addSpanStackTrace = (options) => {
  if (options?.captureStackTrace === false) {
    return options;
  } else if (options?.captureStackTrace !== undefined && typeof options.captureStackTrace !== "boolean") {
    return options;
  }
  const limit = getStackTraceLimit();
  setStackTraceLimit(3);
  const traceError = new Error;
  setStackTraceLimit(limit);
  return {
    ...options,
    captureStackTrace: spanCleaner(() => traceError.stack)
  };
};
var makeStackCleaner = (line) => (stack) => {
  let cache;
  return () => {
    if (cache !== undefined)
      return cache;
    const trace = stack();
    if (!trace)
      return;
    const lines = trace.split(`
`);
    if (lines[line] !== undefined) {
      cache = lines[line].trim();
      return cache;
    }
  };
};
var spanCleaner = /* @__PURE__ */ makeStackCleaner(3);

// node_modules/effect/dist/internal/effect.js
class Interrupt extends ReasonBase {
  fiberId;
  constructor(fiberId, annotations = constEmptyAnnotations) {
    super("Interrupt", annotations, "Interrupted");
    this.fiberId = fiberId;
  }
  toString() {
    return `Interrupt(${this.fiberId})`;
  }
  toJSON() {
    return {
      _tag: "Interrupt",
      fiberId: this.fiberId
    };
  }
  [symbol2](that) {
    return isInterruptReason(that) && this.fiberId === that.fiberId && this.annotations === that.annotations;
  }
  [symbol]() {
    return combine(string(`${this._tag}:${this.fiberId}`))(random(this.annotations));
  }
}
var makeInterruptReason = (fiberId) => new Interrupt(fiberId);
var causeInterrupt = (fiberId) => new CauseImpl([new Interrupt(fiberId)]);
var findFail = (self) => {
  const reason = self.reasons.find(isFailReason);
  return reason ? succeed2(reason) : fail2(self);
};
var findError = (self) => {
  for (let i = 0;i < self.reasons.length; i++) {
    const reason = self.reasons[i];
    if (reason._tag === "Fail") {
      return succeed2(reason.error);
    }
  }
  return fail2(self);
};
var hasDies = (self) => self.reasons.some(isDieReason);
var findDefect = (self) => {
  const reason = self.reasons.find(isDieReason);
  return reason ? succeed2(reason.defect) : fail2(self);
};
var hasInterrupts = (self) => self.reasons.some(isInterruptReason);
var causeFilterInterruptors = (self) => {
  let interruptors;
  for (let i = 0;i < self.reasons.length; i++) {
    const f = self.reasons[i];
    if (f._tag !== "Interrupt")
      continue;
    interruptors ??= new Set;
    if (f.fiberId !== undefined) {
      interruptors.add(f.fiberId);
    }
  }
  return interruptors ? succeed2(interruptors) : fail2(self);
};
var causeCombine = /* @__PURE__ */ dual(2, (self, that) => {
  if (self.reasons.length === 0) {
    return that;
  } else if (that.reasons.length === 0) {
    return self;
  }
  const newCause = new CauseImpl(union(self.reasons, that.reasons));
  return equals(self, newCause) ? self : newCause;
});
var causeMap = /* @__PURE__ */ dual(2, (self, f) => {
  let hasFail = false;
  const failures = self.reasons.map((failure) => {
    if (isFailReason(failure)) {
      hasFail = true;
      return new Fail(f(failure.error), failure.annotations);
    }
    return failure;
  });
  return hasFail ? causeFromReasons(failures) : self;
});
var causePartition = (self) => {
  const obj = {
    Fail: [],
    Die: [],
    Interrupt: []
  };
  for (let i = 0;i < self.reasons.length; i++) {
    obj[self.reasons[i]._tag].push(self.reasons[i]);
  }
  return obj;
};
var causeSquash = (self) => {
  const partitioned = causePartition(self);
  if (partitioned.Fail.length > 0) {
    return partitioned.Fail[0].error;
  } else if (partitioned.Die.length > 0) {
    return partitioned.Die[0].defect;
  } else if (partitioned.Interrupt.length > 0) {
    return new globalThis.Error("All fibers interrupted without error");
  }
  return new globalThis.Error("Empty cause");
};
var causePrettyErrors = (self, options) => {
  const errors = [];
  const interrupts = [];
  if (self.reasons.length === 0)
    return errors;
  const prevStackLimit = getStackTraceLimit();
  setStackTraceLimit(1);
  for (const failure of self.reasons) {
    if (failure._tag === "Interrupt") {
      interrupts.push(failure);
      continue;
    }
    errors.push(causePrettyError(failure._tag === "Die" ? failure.defect : failure.error, failure.annotations, options));
  }
  if (errors.length === 0) {
    const cause = new Error("The fiber was interrupted by:");
    cause.name = "InterruptCause";
    cause.stack = interruptCauseStack(cause, interrupts);
    const error = new globalThis.Error("All fibers interrupted without error", {
      cause
    });
    error.name = "InterruptError";
    error.stack = `${error.name}: ${error.message}`;
    errors.push(causePrettyError(error, interrupts[0].annotations, options));
  }
  setStackTraceLimit(prevStackLimit);
  return errors;
};
var causePrettyError = (original, annotations, options) => {
  const kind = typeof original;
  let error;
  if (original && kind === "object") {
    error = new globalThis.Error(causePrettyMessage(original), {
      cause: original.cause ? causePrettyError(original.cause) : undefined
    });
    if (typeof original.name === "string") {
      error.name = original.name;
    }
    if (typeof original.stack === "string") {
      error.stack = cleanErrorStack(original.stack, error, annotations);
    } else {
      const stack = `${error.name}: ${error.message}`;
      error.stack = annotations ? addStackAnnotations(stack, annotations) : stack;
    }
    if (options?.includeCauseInStack) {
      error.stack = renderPrettyError(error);
    }
    for (const key of Object.keys(original)) {
      if (!(key in error)) {
        error[key] = original[key];
      }
    }
  } else {
    error = new globalThis.Error(!original ? `Unknown error: ${original}` : kind === "string" ? original : formatJson(original));
  }
  return error;
};
var causePrettyMessage = (u) => {
  if (typeof u.message === "string") {
    return u.message;
  } else if (typeof u.toString === "function" && u.toString !== Object.prototype.toString && u.toString !== Array.prototype.toString) {
    try {
      return u.toString();
    } catch {}
  }
  return formatJson(u);
};
var locationRegExp = /\((.*)\)/g;
var cleanErrorStack = (stack, error, annotations) => {
  const message = `${error.name}: ${error.message}`;
  const lines = (stack.startsWith(message) ? stack.slice(message.length) : stack).split(`
`);
  const out = [message];
  for (let i = 1;i < lines.length; i++) {
    if (/(?:Generator\.next|~effect\/Effect)/.test(lines[i])) {
      break;
    }
    out.push(lines[i]);
  }
  return annotations ? addStackAnnotations(out.join(`
`), annotations) : out.join(`
`);
};
var addStackAnnotations = (stack, annotations) => {
  const frame = annotations?.get(StackTraceKey.key);
  if (frame) {
    stack = `${stack}
${currentStackTrace(frame)}`;
  }
  return stack;
};
var interruptCauseStack = (error, interrupts) => {
  const out = [`${error.name}: ${error.message}`];
  for (const current of interrupts) {
    const fiberId = current.fiberId !== undefined ? `#${current.fiberId}` : "unknown";
    const frame = current.annotations.get(InterruptorStackTrace.key);
    out.push(`    at fiber (${fiberId})`);
    if (frame)
      out.push(currentStackTrace(frame));
  }
  return out.join(`
`);
};
var currentStackTrace = (frame) => {
  const out = [];
  let current = frame;
  let i = 0;
  while (current && i < 10) {
    const stack = current.stack();
    if (stack) {
      const locationMatchAll = stack.matchAll(locationRegExp);
      let match4 = false;
      for (const [, location] of locationMatchAll) {
        match4 = true;
        out.push(`    at ${current.name} (${location})`);
      }
      if (!match4) {
        out.push(`    at ${current.name} (${stack.replace(/^at /, "")})`);
      }
    } else {
      out.push(`    at ${current.name}`);
    }
    current = current.parent;
    i++;
  }
  return out.join(`
`);
};
var causePretty = (cause) => causePrettyErrors(cause).map(renderPrettyError).join(`
`);
var renderPrettyError = (e) => e.cause ? `${e.stack} {
${renderErrorCause(e.cause, "  ")}
}` : e.stack;
var renderErrorCause = (cause, prefix) => {
  const lines = cause.stack.split(`
`);
  let stack = `${prefix}[cause]: ${lines[0]}`;
  for (let i = 1, len = lines.length;i < len; i++) {
    stack += `
${prefix}${lines[i]}`;
  }
  if (cause.cause) {
    stack += ` {
${renderErrorCause(cause.cause, `${prefix}  `)}
${prefix}}`;
  }
  return stack;
};
var FiberTypeId = "~effect/Fiber";
var fiberVariance = {
  _A: identity,
  _E: identity
};
var fiberIdStore = {
  id: 0
};
var getCurrentFiber = () => globalThis[currentFiberTypeId];

class FiberImpl {
  constructor(context, interruptible = true) {
    this[FiberTypeId] = fiberVariance;
    this.setContext(context);
    this.id = ++fiberIdStore.id;
    this.currentOpCount = 0;
    this.interruptible = interruptible;
    this._stack = [];
    this._observers = [];
    this._exit = undefined;
    this._children = undefined;
    this._interruptedCause = undefined;
    this._yielded = undefined;
    this._running = false;
    this._deferredInterrupt = false;
    this.runtimeMetrics?.recordFiberStart(this.context);
  }
  [FiberTypeId];
  id;
  interruptible;
  currentOpCount;
  _stack;
  _observers;
  _exit;
  _children;
  _interruptedCause;
  _yielded;
  _running;
  _deferredInterrupt;
  context;
  currentScheduler;
  currentTracerContext;
  currentSpan;
  currentLogLevel;
  minimumLogLevel;
  currentStackFrame;
  runtimeMetrics;
  maxOpsBeforeYield;
  currentPreventYield;
  _dispatcher = undefined;
  get currentDispatcher() {
    return this._dispatcher ??= this.currentScheduler.makeDispatcher();
  }
  getRef(ref) {
    return get(this.context, ref);
  }
  addObserver(cb) {
    if (this._exit) {
      cb(this._exit);
      return constVoid;
    }
    this._observers.push(cb);
    return () => {
      const index = this._observers.indexOf(cb);
      if (index >= 0) {
        this._observers.splice(index, 1);
      }
    };
  }
  interruptUnsafe(fiberId, annotations) {
    if (this._exit) {
      return;
    }
    let cause = causeInterrupt(fiberId);
    if (this.currentStackFrame) {
      cause = causeAnnotate(cause, make5(StackTraceKey, this.currentStackFrame));
    }
    if (annotations) {
      cause = causeAnnotate(cause, annotations);
    }
    this._interruptedCause = this._interruptedCause ? causeCombine(this._interruptedCause, cause) : cause;
    if (this.interruptible) {
      if (this._running) {
        this._deferredInterrupt = true;
      } else {
        this.evaluate(failCause(this._interruptedCause));
      }
    }
  }
  pollUnsafe() {
    return this._exit;
  }
  evaluate(effect) {
    if (this._exit) {
      return;
    } else if (this._yielded !== undefined) {
      const yielded = this._yielded;
      this._yielded = undefined;
      yielded();
    }
    const exit = this.runLoop(effect);
    if (exit === Yield) {
      return;
    }
    const interruptChildren = fiberMiddleware.interruptChildren && fiberMiddleware.interruptChildren(this);
    if (interruptChildren !== undefined) {
      return this.evaluate(flatMap3(interruptChildren, () => exit));
    }
    this._exit = exit;
    this.runtimeMetrics?.recordFiberEnd(this.context, this._exit);
    for (let i = 0;i < this._observers.length; i++) {
      this._observers[i](exit);
    }
    this._observers.length = 0;
    this._stack.length = 0;
    this._children = undefined;
    this.context = empty();
  }
  runLoop(effect) {
    const prevFiber = globalThis[currentFiberTypeId];
    globalThis[currentFiberTypeId] = this;
    const prevRunning = this._running;
    this._running = true;
    let yielding = false;
    let current = effect;
    this.currentOpCount = 0;
    try {
      while (true) {
        if (this._deferredInterrupt) {
          this._deferredInterrupt = false;
          current = failCause(this._interruptedCause);
        }
        this.currentOpCount++;
        if (!yielding && !this.currentPreventYield && this.currentScheduler.shouldYield(this)) {
          yielding = true;
          const prev = current;
          current = flatMap3(yieldNow, () => prev);
        }
        current = this.currentTracerContext ? this.currentTracerContext(current, this) : current[evaluate](this);
        if (current === Yield) {
          const yielded = this._yielded;
          if (ExitTypeId in yielded) {
            this._deferredInterrupt = false;
            this._yielded = undefined;
            return yielded;
          } else if (this._deferredInterrupt) {
            this._yielded = undefined;
            yielded();
            continue;
          }
          return Yield;
        }
      }
    } catch (error) {
      if (!hasProperty(current, evaluate)) {
        return exitDie(`Fiber.runLoop: Not a valid effect: ${String(current)}`);
      }
      return this.runLoop(exitDie(error));
    } finally {
      this._running = prevRunning;
      globalThis[currentFiberTypeId] = prevFiber;
    }
  }
  getCont(symbol3) {
    if (this._deferredInterrupt) {
      this._deferredInterrupt = false;
      return deferredInterruptCont;
    }
    while (true) {
      const op = this._stack.pop();
      if (!op)
        return;
      const cont = op[contAll] && op[contAll](this);
      if (cont) {
        cont[symbol3] = cont;
        return cont;
      }
      if (op[symbol3])
        return op;
    }
  }
  yieldWith(value) {
    this._yielded = value;
    return Yield;
  }
  children() {
    return this._children ??= new Set;
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
  setContext(context) {
    const previous = this.context;
    this.context = context;
    if (previous !== undefined && hasSameCache(previous, context))
      return;
    const scheduler = this.getRef(Scheduler);
    if (scheduler !== this.currentScheduler) {
      this.currentScheduler = scheduler;
      this._dispatcher = undefined;
    }
    this.currentSpan = getOrUndefinedUnsafe(context, ParentSpanKey);
    this.currentLogLevel = this.getRef(CurrentLogLevel);
    this.minimumLogLevel = this.getRef(MinimumLogLevel);
    this.currentStackFrame = this.getRef(CurrentStackFrame);
    this.maxOpsBeforeYield = this.getRef(MaxOpsBeforeYield);
    this.currentPreventYield = this.getRef(PreventSchedulerYield);
    this.runtimeMetrics = getOrUndefinedUnsafe(context, FiberRuntimeMetricsKey);
    const currentTracer = getOrUndefinedUnsafe(context, TracerKey);
    this.currentTracerContext = currentTracer ? currentTracer["context"] : undefined;
  }
  get currentSpanLocal() {
    return this.currentSpan?._tag === "Span" ? this.currentSpan : undefined;
  }
}
var deferredInterruptCont = {
  [contA](_value, fiber) {
    return failCause(fiber._interruptedCause);
  },
  [contE](_cause, fiber) {
    return failCause(fiber._interruptedCause);
  }
};
var fiberMiddleware = {
  interruptChildren: undefined
};
var fiberStackAnnotations = (fiber) => {
  if (!fiber.currentStackFrame)
    return;
  const annotations = new Map;
  annotations.set(InterruptorStackTrace.key, fiber.currentStackFrame);
  return makeUnsafe(annotations);
};
var fiberInterruptChildren = (fiber) => {
  if (fiber._children === undefined || fiber._children.size === 0) {
    return;
  }
  return fiberInterruptAll(fiber._children);
};
var fiberAwait = (self) => {
  const impl = self;
  if (impl._exit)
    return succeed3(impl._exit);
  return callback((resume) => {
    if (impl._exit)
      return resume(succeed3(impl._exit));
    return sync(self.addObserver((exit) => resume(succeed3(exit))));
  });
};
var fiberAwaitAll = (self) => callback((resume) => {
  const iter = self[Symbol.iterator]();
  const exits = [];
  let cancel = undefined;
  function loop() {
    let result = iter.next();
    while (!result.done) {
      if (result.value._exit) {
        exits.push(result.value._exit);
        result = iter.next();
        continue;
      }
      cancel = result.value.addObserver((exit) => {
        exits.push(exit);
        loop();
      });
      return;
    }
    resume(succeed3(exits));
  }
  loop();
  return sync(() => cancel?.());
});
var fiberInterrupt = (self) => withFiber((fiber) => fiberInterruptAs(self, fiber.id));
var fiberInterruptAs = /* @__PURE__ */ dual((args2) => hasProperty(args2[0], FiberTypeId), (self, fiberId, annotations) => withFiber((parent) => {
  let ann = fiberStackAnnotations(parent);
  ann = ann && annotations ? merge(ann, annotations) : ann ?? annotations;
  self.interruptUnsafe(fiberId, ann);
  return asVoid(fiberAwait(self));
}));
var fiberInterruptAll = (fibers) => withFiber((parent) => {
  const annotations = fiberStackAnnotations(parent);
  let fiberArr = empty2();
  for (const fiber of fibers) {
    fiber.interruptUnsafe(parent.id, annotations);
    fiberArr.push(fiber);
  }
  return asVoid(fiberAwaitAll(fiberArr));
});
var succeed3 = exitSucceed;
var failCause = exitFailCause;
var fail3 = exitFail;
var sync = /* @__PURE__ */ makePrimitive({
  op: "Sync",
  [evaluate](fiber) {
    const value = this[args]();
    const cont = fiber.getCont(contA);
    return cont ? cont[contA](value, fiber) : fiber.yieldWith(exitSucceed(value));
  }
});
var suspend = /* @__PURE__ */ makePrimitive({
  op: "Suspend",
  [evaluate](_fiber) {
    return this[args]();
  }
});
var fromOption2 = /* @__PURE__ */ dual((args2) => args2.length >= 2 || isOption2(args2[0]), (option, onNone) => isNone2(option) ? fail3(onNone ? onNone() : new NoSuchElementError("Effect.fromOption: Option.none")) : succeed3(option.value));
var fromResult = /* @__PURE__ */ match3({
  onFailure: fail3,
  onSuccess: succeed3
});
var fromNullishOr2 = (value) => value == null ? fail3(new NoSuchElementError) : succeed3(value);
var yieldNowWith = /* @__PURE__ */ makePrimitive({
  op: "Yield",
  [evaluate](fiber) {
    let resumed = false;
    fiber.currentDispatcher.scheduleTask(() => {
      if (resumed)
        return;
      fiber.evaluate(exitVoid);
    }, this[args] ?? 0);
    return fiber.yieldWith(() => {
      resumed = true;
    });
  }
});
var yieldNow = /* @__PURE__ */ yieldNowWith(0);
var succeedSome = (a) => succeed3(some2(a));
var succeedNone = /* @__PURE__ */ succeed3(/* @__PURE__ */ none2());
var transposeOption = (self) => isNone2(self) ? succeedNone : map5(self.value, some2);
var failCauseSync = (evaluate2) => suspend(() => failCause(internalCall(evaluate2)));
var die = (defect) => exitDie(defect);
var failSync = (error) => suspend(() => fail3(internalCall(error)));
var void_ = /* @__PURE__ */ succeed3(undefined);
var try_2 = (options) => {
  const evaluate2 = typeof options === "function" ? options : options.try;
  const catcher = typeof options === "function" ? (cause) => new UnknownError(cause, "An error occurred in Effect.try") : options.catch;
  return suspend(() => {
    try {
      return succeed3(internalCall(evaluate2));
    } catch (err) {
      return fail3(internalCall(() => catcher(err)));
    }
  });
};
var promise = (evaluate2) => callbackOptions(function(resume, signal) {
  internalCall(() => evaluate2(signal)).then((a) => resume(succeed3(a)), (e) => resume(die(e)));
}, evaluate2.length !== 0);
var tryPromise = (options) => {
  const f = typeof options === "function" ? options : options.try;
  const catcher = typeof options === "function" ? (cause) => new UnknownError(cause, "An error occurred in Effect.tryPromise") : options.catch;
  return callbackOptions(function(resume, signal) {
    const failWithCatch = (cause) => {
      try {
        resume(fail3(internalCall(() => catcher(cause))));
      } catch (err) {
        resume(die(err));
      }
    };
    try {
      internalCall(() => f(signal)).then((a) => resume(succeed3(a)), failWithCatch);
    } catch (err) {
      failWithCatch(err);
    }
  }, f.length !== 0);
};
var withFiberId = (f) => withFiber((fiber) => f(fiber.id));
var fiber = /* @__PURE__ */ withFiber(succeed3);
var fiberId = /* @__PURE__ */ withFiberId(succeed3);
var callbackOptions = /* @__PURE__ */ makePrimitive({
  op: "Async",
  single: false,
  [evaluate](fiber2) {
    const register = internalCall(() => this[args][0].bind(fiber2.currentScheduler));
    let resumed = false;
    let yielded = false;
    const controller = this[args][1] ? new AbortController : undefined;
    const onCancel = register((effect) => {
      if (resumed)
        return;
      resumed = true;
      if (yielded) {
        fiber2.evaluate(effect);
      } else {
        yielded = effect;
      }
    }, controller?.signal);
    if (yielded !== false)
      return yielded;
    yielded = true;
    fiber2._yielded = () => {
      resumed = true;
    };
    if (controller === undefined && onCancel === undefined) {
      return Yield;
    }
    fiber2._stack.push(asyncFinalizer(() => {
      resumed = true;
      controller?.abort();
      return onCancel ?? exitVoid;
    }));
    return Yield;
  }
});
var asyncFinalizer = /* @__PURE__ */ makePrimitive({
  op: "AsyncFinalizer",
  [contAll](fiber2) {
    if (fiber2.interruptible) {
      fiber2.interruptible = false;
      fiber2._stack.push(setInterruptibleTrue);
    }
  },
  [contE](cause, _fiber) {
    return hasInterrupts(cause) ? flatMap3(this[args](), () => failCause(cause)) : failCause(cause);
  }
});
var callback = (register) => callbackOptions(register, register.length >= 2);
var never = /* @__PURE__ */ callback(constVoid);
var gen = (...args2) => suspend(() => fromIteratorUnsafe(args2.length === 1 ? args2[0]() : args2[1].call(args2[0].self)));
var fnUntraced = (body, ...pipeables) => {
  const fn = pipeables.length === 0 ? function() {
    return suspend(() => fromIteratorUnsafe(body.apply(this, arguments)));
  } : function() {
    let effect = suspend(() => fromIteratorUnsafe(body.apply(this, arguments)));
    for (let i = 0;i < pipeables.length; i++) {
      effect = pipeables[i](effect, ...arguments);
    }
    return effect;
  };
  return defineFunctionLength(body.length, fn);
};
var defineFunctionLength = (length, fn) => Object.defineProperty(fn, "length", {
  value: length,
  configurable: true
});
var fnStackCleaner = /* @__PURE__ */ makeStackCleaner(2);
var fn = function() {
  const nameFirst = typeof arguments[0] === "string";
  const name = nameFirst ? arguments[0] : "Effect.fn";
  const spanOptions = nameFirst ? arguments[1] : undefined;
  const prevLimit = getStackTraceLimit();
  setStackTraceLimit(2);
  const defError = new globalThis.Error;
  setStackTraceLimit(prevLimit);
  if (nameFirst) {
    return (body, ...pipeables) => makeFn(name, body, defError, pipeables, nameFirst, spanOptions);
  }
  return makeFn(name, arguments[0], defError, Array.prototype.slice.call(arguments, 1), nameFirst, spanOptions);
};
var makeFn = (name, bodyOrOptions, defError, pipeables, addSpan, spanOptions) => {
  const body = typeof bodyOrOptions === "function" ? bodyOrOptions : pipeables.pop().bind(bodyOrOptions.self);
  return defineFunctionLength(body.length, function(...args2) {
    let result = suspend(() => {
      const iter = body.apply(this, arguments);
      return isEffect(iter) ? iter : fromIteratorUnsafe(iter);
    });
    for (let i = 0;i < pipeables.length; i++) {
      result = pipeables[i](result, ...args2);
    }
    if (!isEffect(result)) {
      return result;
    }
    const prevLimit = getStackTraceLimit();
    setStackTraceLimit(2);
    const callError = new globalThis.Error;
    setStackTraceLimit(prevLimit);
    return updateService(addSpan ? useSpan(name, spanOptions, (span) => provideParentSpan(result, span)) : result, CurrentStackFrame, (prev) => ({
      name,
      stack: fnStackCleaner(() => callError.stack),
      parent: {
        name: `${name} (definition)`,
        stack: fnStackCleaner(() => defError.stack),
        parent: prev
      }
    }));
  });
};
var fnUntracedEager = (body, ...pipeables) => defineFunctionLength(body.length, pipeables.length === 0 ? function() {
  return fromIteratorEagerUnsafe(() => body.apply(this, arguments));
} : function() {
  let effect = fromIteratorEagerUnsafe(() => body.apply(this, arguments));
  for (const pipeable of pipeables) {
    effect = pipeable(effect);
  }
  return effect;
});
var fromIteratorEagerUnsafe = (evaluate2) => {
  try {
    const iterator = evaluate2();
    let value = undefined;
    while (true) {
      const state = iterator.next(value);
      if (state.done) {
        return succeed3(state.value);
      }
      const primitive = state.value;
      if (primitive && primitive._tag === "Success") {
        value = primitive.value;
        continue;
      } else if (primitive && primitive._tag === "Failure") {
        return state.value;
      } else {
        let isFirstExecution = true;
        return suspend(() => {
          if (isFirstExecution) {
            isFirstExecution = false;
            return flatMap3(state.value, (value2) => fromIteratorUnsafe(iterator, value2));
          } else {
            return suspend(() => fromIteratorUnsafe(evaluate2()));
          }
        });
      }
    }
  } catch (error) {
    return die(error);
  }
};
var fromIteratorUnsafe = /* @__PURE__ */ makePrimitive({
  op: "Iterator",
  single: false,
  [contA](value, fiber2) {
    const iter = this[args][0];
    while (true) {
      const state = iter.next(value);
      if (state.done)
        return succeed3(state.value);
      if (!effectIsExit(state.value)) {
        fiber2._stack.push(this);
        return state.value;
      } else if (state.value._tag === "Failure") {
        return state.value;
      }
      value = state.value.value;
    }
  },
  [evaluate](fiber2) {
    return this[contA](this[args][1], fiber2);
  }
});
var as = /* @__PURE__ */ dual(2, (self, value) => {
  const b = succeed3(value);
  return flatMap3(self, (_) => b);
});
var asSome = (self) => map5(self, some2);
var flip = (self) => matchEffect(self, {
  onFailure: succeed3,
  onSuccess: fail3
});
var andThen = /* @__PURE__ */ dual(2, (self, f) => flatMap3(self, (a) => isEffect(f) ? f : internalCall(() => f(a))));
var tap = /* @__PURE__ */ dual(2, (self, f) => flatMap3(self, (a) => as(isEffect(f) ? f : internalCall(() => f(a)), a)));
var asVoid = (self) => flatMap3(self, (_) => exitVoid);
var sandbox = (self) => catchCause(self, fail3);
var raceAll = (all, options) => withFiber((parent) => callback((resume) => {
  const effects = fromIterable(all);
  const len = effects.length;
  let doneCount = 0;
  let done2 = false;
  const fibers = new Set;
  const failures = [];
  const onExit = (exit, fiber2, i) => {
    doneCount++;
    if (exit._tag === "Failure") {
      failures.push(...exit.cause.reasons);
      if (doneCount >= len) {
        resume(failCause(causeFromReasons(failures)));
      }
      return;
    }
    const isWinner = !done2;
    done2 = true;
    resume(fibers.size === 0 ? exit : flatMap3(uninterruptible(fiberInterruptAll(fibers)), () => exit));
    if (isWinner && options?.onWinner) {
      options.onWinner({
        fiber: fiber2,
        index: i,
        parentFiber: parent
      });
    }
  };
  for (let i = 0;i < len; i++) {
    const fiber2 = forkUnsafe(parent, effects[i], true, true, false);
    fibers.add(fiber2);
    fiber2.addObserver((exit) => {
      fibers.delete(fiber2);
      onExit(exit, fiber2, i);
    });
    if (done2)
      break;
  }
  return fiberInterruptAll(fibers);
}));
var raceAllFirst = (all, options) => withFiber((parent) => callback((resume) => {
  let done2 = false;
  const fibers = new Set;
  const onExit = (exit) => {
    done2 = true;
    resume(fibers.size === 0 ? exit : flatMap3(uninterruptible(fiberInterruptAll(fibers)), () => exit));
  };
  let i = 0;
  for (const effect of all) {
    if (done2)
      break;
    const index = i++;
    const fiber2 = forkUnsafe(parent, effect, true, true, false);
    fibers.add(fiber2);
    fiber2.addObserver((exit) => {
      fibers.delete(fiber2);
      const isWinner = !done2;
      onExit(exit);
      if (isWinner && options?.onWinner) {
        options.onWinner({
          fiber: fiber2,
          index,
          parentFiber: parent
        });
      }
    });
  }
  return fiberInterruptAll(fibers);
}));
var race = /* @__PURE__ */ dual((args2) => isEffect(args2[1]), (self, that, options) => raceAll([self, that], options));
var raceFirst = /* @__PURE__ */ dual((args2) => isEffect(args2[1]), (self, that, options) => raceAllFirst([self, that], options));
var flatMap3 = /* @__PURE__ */ dual(2, (self, f) => {
  const onSuccess = Object.create(OnSuccessProto);
  onSuccess[args] = self;
  onSuccess[contA] = f.length !== 1 ? (a) => f(a) : f;
  return onSuccess;
});
var OnSuccessProto = /* @__PURE__ */ makePrimitiveProto({
  op: "OnSuccess",
  [evaluate](fiber2) {
    fiber2._stack.push(this);
    return this[args];
  }
});
var matchCauseEffectEager = /* @__PURE__ */ dual(2, (self, options) => {
  if (effectIsExit(self)) {
    return self._tag === "Success" ? options.onSuccess(self.value) : options.onFailure(self.cause);
  }
  return matchCauseEffect(self, options);
});
var effectIsExit = (effect) => (ExitTypeId in effect);
var flatMapEager = /* @__PURE__ */ dual(2, (self, f) => {
  if (effectIsExit(self)) {
    return self._tag === "Success" ? f(self.value) : self;
  }
  return flatMap3(self, f);
});
var flatten3 = (self) => flatMap3(self, identity);
var map5 = /* @__PURE__ */ dual(2, (self, f) => flatMap3(self, (a) => succeed3(internalCall(() => f(a)))));
var mapEager = /* @__PURE__ */ dual(2, (self, f) => effectIsExit(self) ? exitMap(self, f) : map5(self, f));
var mapErrorEager = /* @__PURE__ */ dual(2, (self, f) => effectIsExit(self) ? exitMapError(self, f) : mapError2(self, f));
var mapBothEager = /* @__PURE__ */ dual(2, (self, options) => effectIsExit(self) ? exitMapBoth(self, options) : mapBoth(self, options));
var catchEager = /* @__PURE__ */ dual(2, (self, f) => {
  if (effectIsExit(self)) {
    if (self._tag === "Success")
      return self;
    const error = findError(self.cause);
    if (isFailure2(error))
      return self;
    return f(error.success);
  }
  return catch_(self, f);
});
var exitIsSuccess = (self) => self._tag === "Success";
var exitIsFailure = (self) => self._tag === "Failure";
var exitFilterCause = (self) => self._tag === "Failure" ? succeed2(self.cause) : fail2(self);
var exitVoid = /* @__PURE__ */ exitSucceed(undefined);
var exitMap = /* @__PURE__ */ dual(2, (self, f) => self._tag === "Success" ? exitSucceed(f(self.value)) : self);
var exitMapError = /* @__PURE__ */ dual(2, (self, f) => {
  if (self._tag === "Success")
    return self;
  const error = findError(self.cause);
  if (isFailure2(error))
    return self;
  return exitFail(f(error.success));
});
var exitMapBoth = /* @__PURE__ */ dual(2, (self, options) => {
  if (self._tag === "Success")
    return exitSucceed(options.onSuccess(self.value));
  const error = findError(self.cause);
  if (isFailure2(error))
    return self;
  return exitFail(options.onFailure(error.success));
});
var exitAsVoidAll = (exits) => {
  const failures = [];
  for (const exit of exits) {
    if (exit._tag === "Failure") {
      failures.push(...exit.cause.reasons);
    }
  }
  return failures.length === 0 ? exitVoid : exitFailCause(causeFromReasons(failures));
};
var service = (service2) => service2;
var serviceOption = (service2) => withFiber((fiber2) => succeed3(getOption(fiber2.context, service2)));
var serviceOptional = (service2) => withFiber((fiber2) => fiber2.context.mapUnsafe.has(service2.key) ? succeed3(getUnsafe(fiber2.context, service2)) : fail3(new NoSuchElementError));
var updateContext = /* @__PURE__ */ dual(2, (self, f) => withFiber((fiber2) => {
  const prevContext = fiber2.context;
  const nextContext = f(prevContext);
  if (prevContext === nextContext)
    return self;
  fiber2.setContext(nextContext);
  return onExitPrimitive(self, () => {
    fiber2.setContext(prevContext);
    return;
  });
}));
var updateService = /* @__PURE__ */ dual(3, (self, service2, f) => updateContext(self, (s) => {
  const prev = getUnsafe(s, service2);
  const next = f(prev);
  if (prev === next)
    return s;
  return add(s, service2, next);
}));
var updateServiceScoped = (service2, update, options) => uninterruptible(withFiber((fiber2) => {
  const original = getUnsafe(fiber2.context, service2);
  const updated = update(original);
  fiber2.setContext(add(fiber2.context, service2, updated));
  return scopeAddFinalizerExit(getUnsafe(fiber2.context, scopeTag), (_) => {
    const current = getUnsafe(fiber2.context, service2);
    let next;
    if (options?.reset === undefined) {
      if (current !== updated)
        return void_;
      next = original;
    } else {
      next = options.reset(original, updated, current);
    }
    fiber2.setContext(add(fiber2.context, service2, next));
    return void_;
  });
}));
var context = () => getContext;
var getContext = /* @__PURE__ */ withFiber((fiber2) => succeed3(fiber2.context));
var contextWith = (f) => withFiber((fiber2) => f(fiber2.context));
var setContext = /* @__PURE__ */ dual(2, (self, context2) => updateContext(self, constant(context2)));
var provideContext = /* @__PURE__ */ dual(2, (self, context2) => {
  if (effectIsExit(self))
    return self;
  return updateContext(self, merge(context2));
});
var provideService = function() {
  if (arguments.length === 1) {
    return dual(2, (self, impl) => provideServiceImpl(self, arguments[0], impl));
  }
  return dual(3, (self, service2, impl) => provideServiceImpl(self, service2, impl)).apply(this, arguments);
};
var provideServiceImpl = (self, service2, implementation) => updateContext(self, (s) => {
  const prev = s.mapUnsafe.get(service2.key);
  if (prev === implementation)
    return s;
  return add(s, service2, implementation);
});
var provideServiceEffect = /* @__PURE__ */ dual(3, (self, service2, acquire) => flatMap3(acquire, (implementation) => provideService(self, service2, implementation)));
var zip = /* @__PURE__ */ dual((args2) => isEffect(args2[1]), (self, that, options) => zipWith(self, that, (a, a2) => [a, a2], options));
var zipWith = /* @__PURE__ */ dual((args2) => isEffect(args2[1]), (self, that, f, options) => options?.concurrent ? map5(all([self, that], {
  concurrency: 2
}), ([a, a2]) => internalCall(() => f(a, a2))) : flatMap3(self, (a) => map5(that, (a2) => internalCall(() => f(a, a2)))));
var filterOrFail = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, predicate, orFailWith) => filterOrElse(self, predicate, orFailWith ? (a) => fail3(orFailWith(a)) : () => fail3(new NoSuchElementError)));
var when = /* @__PURE__ */ dual(2, (self, condition) => flatMap3(condition, (pass) => pass ? asSome(self) : succeedNone));
var replicate = /* @__PURE__ */ dual(2, (self, n) => Array.from({
  length: n
}, () => self));
var replicateEffect = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, n, options) => all(replicate(self, n), options));
var forever = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, options) => whileLoop({
  while: constTrue,
  body: constant(options?.disableYield ? self : flatMap3(self, (_) => yieldNow)),
  step: constVoid
}));
var catchCause = /* @__PURE__ */ dual(2, (self, f) => {
  const onFailure = Object.create(OnFailureProto);
  onFailure[args] = self;
  onFailure[contE] = f.length !== 1 ? (cause) => f(cause) : f;
  return onFailure;
});
var OnFailureProto = /* @__PURE__ */ makePrimitiveProto({
  op: "OnFailure",
  [evaluate](fiber2) {
    fiber2._stack.push(this);
    return this[args];
  }
});
var catchCauseIf = /* @__PURE__ */ dual(3, (self, predicate, f) => catchCause(self, (cause) => {
  if (!predicate(cause)) {
    return failCause(cause);
  }
  return internalCall(() => f(cause));
}));
var catchCauseFilter = /* @__PURE__ */ dual(3, (self, filter3, f) => catchCause(self, (cause) => {
  const eb = filter3(cause);
  return isFailure2(eb) ? failCause(eb.failure) : internalCall(() => f(eb.success, cause));
}));
var catch_ = /* @__PURE__ */ dual(2, (self, f) => catchCauseFilter(self, findError, (e) => f(e)));
var catchNoSuchElement = (self) => matchEffect(self, {
  onFailure: (error) => isNoSuchElementError(error) ? succeedNone : fail3(error),
  onSuccess: succeedSome
});
var catchDefect = /* @__PURE__ */ dual(2, (self, f) => catchCauseFilter(self, findDefect, f));
var tapCause = /* @__PURE__ */ dual(2, (self, f) => catchCause(self, (cause) => andThen(internalCall(() => f(cause)), failCause(cause))));
var tapCauseIf = /* @__PURE__ */ dual(3, (self, predicate, f) => catchCauseIf(self, predicate, (cause) => andThen(internalCall(() => f(cause)), failCause(cause))));
var tapCauseFilter = /* @__PURE__ */ dual(3, (self, filter3, f) => catchCause(self, (cause) => {
  const result = filter3(cause);
  if (isFailure2(result)) {
    return failCause(cause);
  }
  return andThen(internalCall(() => f(result.success, cause)), failCause(cause));
}));
var tapError = /* @__PURE__ */ dual(2, (self, f) => tapCauseFilter(self, findError, (e) => f(e)));
var tapErrorTag = /* @__PURE__ */ dual(3, (self, k, f) => {
  const predicate = Array.isArray(k) ? (e) => hasProperty(e, "_tag") && k.includes(e._tag) : isTagged(k);
  return tapError(self, (error) => predicate(error) ? f(error) : void_);
});
var tapDefect = /* @__PURE__ */ dual(2, (self, f) => tapCauseFilter(self, findDefect, (_) => f(_)));
var catchIf = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, predicate, f, orElse) => catchCause(self, (cause) => {
  const error = findError(cause);
  if (isFailure2(error))
    return failCause(error.failure);
  if (!predicate(error.success)) {
    return orElse ? internalCall(() => orElse(error.success)) : failCause(cause);
  }
  return internalCall(() => f(error.success));
}));
var catchFilter = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, filter3, f, orElse) => catchCause(self, (cause) => {
  const error = findError(cause);
  if (isFailure2(error))
    return failCause(error.failure);
  const result = filter3(error.success);
  if (isFailure2(result)) {
    return orElse ? internalCall(() => orElse(result.failure)) : failCause(cause);
  }
  return internalCall(() => f(result.success));
}));
var catchTag = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, k, f, orElse) => {
  const pred = Array.isArray(k) ? (e) => hasProperty(e, "_tag") && k.includes(e._tag) : isTagged(k);
  return catchIf(self, pred, f, orElse);
});
var catchTags = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, cases, orElse) => {
  let keys2;
  return catchFilter(self, (e) => {
    keys2 ??= Object.keys(cases);
    return hasProperty(e, "_tag") && isString(e["_tag"]) && keys2.includes(e["_tag"]) ? succeed2(e) : fail2(e);
  }, (e) => internalCall(() => cases[e["_tag"]](e)), orElse);
});
var catchReason = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, errorTag, reasonTag, f, orElse) => catchIf(self, (e) => isTagged(e, errorTag) && hasProperty(e, "reason"), (e) => {
  const reason = e.reason;
  if (isTagged(reason, reasonTag))
    return f(reason, e);
  return orElse ? internalCall(() => orElse(reason, e)) : fail3(e);
}));
var catchReasons = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, errorTag, cases, orElse) => {
  let keys2;
  return catchIf(self, (e) => isTagged(e, errorTag) && hasProperty(e, "reason") && hasProperty(e.reason, "_tag") && isString(e.reason._tag), (e) => {
    const reason = e.reason;
    keys2 ??= Object.keys(cases);
    if (keys2.includes(reason._tag)) {
      return internalCall(() => cases[reason._tag](reason, e));
    }
    return orElse ? internalCall(() => orElse(reason, e)) : fail3(e);
  });
});
var unwrapReason = /* @__PURE__ */ dual(2, (self, errorTag) => catchFilter(self, (e) => {
  if (isTagged(e, errorTag) && hasProperty(e, "reason")) {
    return succeed2(e.reason);
  }
  return fail2(e);
}, fail3));
var mapError2 = /* @__PURE__ */ dual(2, (self, f) => catch_(self, (error) => failSync(() => f(error))));
var mapBoth = /* @__PURE__ */ dual(2, (self, options) => matchEffect(self, {
  onFailure: (e) => failSync(() => options.onFailure(e)),
  onSuccess: (a) => sync(() => options.onSuccess(a))
}));
var orDie = (self) => catch_(self, die);
var orElseSucceed = /* @__PURE__ */ dual(2, (self, f) => catch_(self, (_) => sync(f)));
var firstSuccessOf = (effects) => suspend(() => {
  const iterator = effects[Symbol.iterator]();
  let state = iterator.next();
  if (state.done) {
    return die(new Error("Received an empty collection of effects"));
  }
  function loop(current) {
    const next = iterator.next();
    if (next.done)
      return current.value;
    return catch_(current.value, (_) => loop(next));
  }
  return loop(state);
});
var eventually = (self) => catch_(self, (_) => flatMap3(yieldNow, () => eventually(self)));
var ignore = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, options) => {
  if (!options?.log) {
    return matchEffect(self, {
      onFailure: (_) => void_,
      onSuccess: (_) => void_
    });
  }
  const logEffect = logWithLevel(options.log === true ? undefined : options.log);
  return matchCauseEffect(self, {
    onFailure(cause) {
      const failure = findFail(cause);
      return isFailure2(failure) ? failCause(failure.failure) : options.message === undefined ? logEffect(cause) : logEffect(options.message, cause);
    },
    onSuccess: (_) => void_
  });
});
var ignoreCause = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, options) => {
  if (!options?.log) {
    return matchCauseEffect(self, {
      onFailure: (_) => void_,
      onSuccess: (_) => void_
    });
  }
  const logEffect = logWithLevel(options.log === true ? undefined : options.log);
  return matchCauseEffect(self, {
    onFailure: (cause) => options.message === undefined ? logEffect(cause) : logEffect(options.message, cause),
    onSuccess: (_) => void_
  });
});
var option = (self) => match4(self, {
  onFailure: none2,
  onSuccess: some2
});
var result = (self) => matchEager(self, {
  onFailure: fail2,
  onSuccess: succeed2
});
var matchCauseEffect = /* @__PURE__ */ dual(2, (self, options) => {
  const primitive = Object.create(OnSuccessAndFailureProto);
  primitive[args] = self;
  primitive[contA] = options.onSuccess.length !== 1 ? (a) => options.onSuccess(a) : options.onSuccess;
  primitive[contE] = options.onFailure.length !== 1 ? (cause) => options.onFailure(cause) : options.onFailure;
  return primitive;
});
var OnSuccessAndFailureProto = /* @__PURE__ */ makePrimitiveProto({
  op: "OnSuccessAndFailure",
  [evaluate](fiber2) {
    fiber2._stack.push(this);
    return this[args];
  }
});
var matchCause = /* @__PURE__ */ dual(2, (self, options) => matchCauseEffect(self, {
  onFailure: (cause) => sync(() => options.onFailure(cause)),
  onSuccess: (value) => sync(() => options.onSuccess(value))
}));
var matchEffect = /* @__PURE__ */ dual(2, (self, options) => matchCauseEffect(self, {
  onFailure: (cause) => {
    const fail4 = cause.reasons.find(isFailReason);
    return fail4 ? internalCall(() => options.onFailure(fail4.error)) : failCause(cause);
  },
  onSuccess: options.onSuccess
}));
var match4 = /* @__PURE__ */ dual(2, (self, options) => matchEffect(self, {
  onFailure: (error) => sync(() => options.onFailure(error)),
  onSuccess: (value) => sync(() => options.onSuccess(value))
}));
var matchEager = /* @__PURE__ */ dual(2, (self, options) => {
  if (effectIsExit(self)) {
    if (self._tag === "Success")
      return exitSucceed(options.onSuccess(self.value));
    const error = findError(self.cause);
    if (isFailure2(error))
      return self;
    return exitSucceed(options.onFailure(error.success));
  }
  return match4(self, options);
});
var matchCauseEager = /* @__PURE__ */ dual(2, (self, options) => {
  if (effectIsExit(self)) {
    if (self._tag === "Success")
      return exitSucceed(options.onSuccess(self.value));
    return exitSucceed(options.onFailure(self.cause));
  }
  return matchCause(self, options);
});
var exit = (self) => effectIsExit(self) ? exitSucceed(self) : exitPrimitive(self);
var exitPrimitive = /* @__PURE__ */ makePrimitive({
  op: "Exit",
  [evaluate](fiber2) {
    fiber2._stack.push(this);
    return this[args];
  },
  [contA](value, _, exit2) {
    return succeed3(exit2 ?? exitSucceed(value));
  },
  [contE](cause, _, exit2) {
    return succeed3(exit2 ?? exitFailCause(cause));
  }
});
var isFailure3 = /* @__PURE__ */ matchEager({
  onFailure: () => true,
  onSuccess: () => false
});
var isSuccess3 = /* @__PURE__ */ matchEager({
  onFailure: () => false,
  onSuccess: () => true
});
var delay = /* @__PURE__ */ dual(2, (self, duration) => andThen(sleep(duration), self));
var timeoutOrElse = /* @__PURE__ */ dual(2, (self, options) => raceFirst(self, flatMap3(sleep(options.duration), options.orElse)));
var timeout = /* @__PURE__ */ dual(2, (self, duration) => timeoutOrElse(self, {
  duration,
  orElse: () => fail3(new TimeoutError)
}));
var timeoutOption = /* @__PURE__ */ dual(2, (self, duration) => raceFirst(asSome(self), as(sleep(duration), none2())));
var timed = (self) => clockWith((clock) => {
  const start = clock.monotonicTimeNanosUnsafe();
  return map5(self, (a) => [nanos(clock.monotonicTimeNanosUnsafe() - start), a]);
});
var ScopeTypeId = "~effect/Scope";
var ScopeCloseableTypeId = "~effect/Scope/Closeable";
var scopeTag = /* @__PURE__ */ Service("effect/Scope");
var scopeClose = (self, exit_) => suspend(() => scopeCloseUnsafe(self, exit_) ?? void_);
var scopeCloseUnsafe = (self, exit_) => {
  if (self.state._tag === "Closed")
    return;
  const closed = {
    _tag: "Closed",
    exit: exit_
  };
  if (self.state._tag === "Empty") {
    self.state = closed;
    return;
  }
  const {
    finalizers
  } = self.state;
  self.state = closed;
  if (finalizers.size === 0) {
    return;
  } else if (finalizers.size === 1) {
    return finalizers.values().next().value(exit_);
  }
  return scopeCloseFinalizers(self, finalizers, exit_);
};
var scopeCloseFinalizers = /* @__PURE__ */ fnUntraced(function* (self, finalizers, exit_) {
  let exits = [];
  const fibers = [];
  const arr = Array.from(finalizers.values());
  const parent = getCurrentFiber();
  for (let i = arr.length - 1;i >= 0; i--) {
    const finalizer = arr[i];
    if (self.strategy === "sequential") {
      exits.push(yield* exit(finalizer(exit_)));
    } else {
      fibers.push(forkUnsafe(parent, finalizer(exit_), true, true, "inherit"));
    }
  }
  if (fibers.length > 0) {
    exits = yield* fiberAwaitAll(fibers);
  }
  return yield* exitAsVoidAll(exits);
});
var scopeForkUnsafe = (scope, finalizerStrategy) => {
  const newScope = scopeMakeUnsafe(finalizerStrategy);
  if (scope.state._tag === "Closed") {
    newScope.state = scope.state;
    return newScope;
  }
  const key = {};
  scopeAddFinalizerUnsafe(scope, key, (exit2) => scopeClose(newScope, exit2));
  scopeAddFinalizerUnsafe(newScope, key, (_) => sync(() => scopeRemoveFinalizerUnsafe(scope, key)));
  return newScope;
};
var scopeAddFinalizerExit = (scope, finalizer) => {
  return suspend(() => {
    if (scope.state._tag === "Closed") {
      return finalizer(scope.state.exit);
    }
    scopeAddFinalizerUnsafe(scope, {}, finalizer);
    return void_;
  });
};
var scopeAddFinalizerUnsafe = (scope, key, finalizer) => {
  if (scope.state._tag === "Empty") {
    scope.state = {
      _tag: "Open",
      finalizers: new Map([[key, finalizer]])
    };
  } else if (scope.state._tag === "Open") {
    scope.state.finalizers.set(key, finalizer);
  }
};
var scopeRemoveFinalizerUnsafe = (scope, key) => {
  if (scope.state._tag === "Open") {
    scope.state.finalizers.delete(key);
  }
};
var scopeMakeUnsafe = (finalizerStrategy = "sequential") => ({
  [ScopeCloseableTypeId]: ScopeCloseableTypeId,
  [ScopeTypeId]: ScopeTypeId,
  strategy: finalizerStrategy,
  state: constScopeEmpty
});
var constScopeEmpty = {
  _tag: "Empty"
};
var scope = scopeTag;
var scoped = (self) => withFiber((fiber2) => {
  const prev = fiber2.context;
  const scope2 = scopeMakeUnsafe();
  fiber2.setContext(add(fiber2.context, scopeTag, scope2));
  return onExitPrimitive(self, (exit2) => {
    fiber2.setContext(prev);
    return scopeCloseUnsafe(scope2, exit2);
  });
});
var scopedWith = (f) => suspend(() => {
  const scope2 = scopeMakeUnsafe();
  return onExit(f(scope2), (exit2) => suspend(() => scopeCloseUnsafe(scope2, exit2) ?? void_));
});
var acquireRelease = (acquire, release, options) => contextWith((context2) => uninterruptibleMask((restore) => flatMap3(scope, (scope2) => tap(options?.interruptible ? restore(acquire) : acquire, (a) => scopeAddFinalizerExit(scope2, (exit2) => provideContext(release(a, exit2), context2))))));
var addFinalizer = (finalizer) => flatMap3(scope, (scope2) => contextWith((context2) => scopeAddFinalizerExit(scope2, (exit2) => provideContext(finalizer(exit2), context2))));
var onExitPrimitive = /* @__PURE__ */ makePrimitive({
  op: "OnExit",
  single: false,
  [evaluate](fiber2) {
    fiber2._stack.push(this);
    return this[args][0];
  },
  [contAll](fiber2) {
    if (fiber2.interruptible && this[args][2] !== true) {
      fiber2._stack.push(setInterruptibleTrue);
      fiber2.interruptible = false;
    }
  },
  [contA](value, _, exit2) {
    exit2 ??= exitSucceed(value);
    const eff = this[args][1](exit2);
    return eff ? flatMap3(eff, (_2) => exit2) : exit2;
  },
  [contE](cause, _, exit2) {
    exit2 ??= exitFailCause(cause);
    const eff = this[args][1](exit2);
    return eff ? flatMap3(eff, (_2) => exit2) : exit2;
  }
});
var onExit = /* @__PURE__ */ dual(2, onExitPrimitive);
var ensuring = /* @__PURE__ */ dual(2, (self, finalizer) => onExit(self, (_) => finalizer));
var onExitIf = /* @__PURE__ */ dual(3, (self, predicate, f) => onExit(self, (exit2) => {
  if (!predicate(exit2)) {
    return void_;
  }
  return f(exit2);
}));
var onExitFilter = /* @__PURE__ */ dual(3, (self, filter3, f) => onExit(self, (exit2) => {
  const b = filter3(exit2);
  return isFailure2(b) ? void_ : f(b.success, exit2);
}));
var onError = /* @__PURE__ */ dual(2, (self, f) => onExitFilter(self, exitFilterCause, f));
var onErrorIf = /* @__PURE__ */ dual(3, (self, predicate, f) => onExitIf(self, (exit2) => {
  if (exit2._tag !== "Failure") {
    return false;
  }
  return predicate(exit2.cause);
}, (exit2) => f(exit2.cause)));
var onErrorFilter = /* @__PURE__ */ dual(3, (self, filter3, f) => onExit(self, (exit2) => {
  if (exit2._tag !== "Failure") {
    return void_;
  }
  const result2 = filter3(exit2.cause);
  return isFailure2(result2) ? void_ : f(result2.success, exit2.cause);
}));
var onInterrupt = /* @__PURE__ */ dual(2, (self, finalizer) => onErrorFilter(causeFilterInterruptors, finalizer)(self));
var acquireUseRelease = (acquire, use, release) => uninterruptibleMask((restore) => flatMap3(acquire, (a) => onExitPrimitive(restore(use(a)), (exit2) => release(a, exit2), true)));
var acquireDisposable = (acquire) => acquireRelease(acquire, (resource) => hasProperty(resource, Symbol.asyncDispose) ? promise(() => resource[Symbol.asyncDispose]()) : sync(() => resource[Symbol.dispose]()));
var cachedInvalidateWithTTL = /* @__PURE__ */ dual(2, (self, ttl) => sync(() => {
  const ttlMillis = toMillis(fromInputUnsafe(ttl));
  const isFinite = Number.isFinite(ttlMillis);
  const latch = makeLatchUnsafe(false);
  let expiresAt = 0;
  let running = false;
  let exit2;
  const wait = flatMap3(latch.await, () => exit2);
  return [withFiber((fiber2) => {
    const clock = fiber2.getRef(ClockRef);
    const now = isFinite ? clock.currentTimeMillisUnsafe() : 0;
    if (running || now < expiresAt)
      return exit2 ?? wait;
    running = true;
    latch.closeUnsafe();
    exit2 = undefined;
    return onExit(self, (exit_) => sync(() => {
      running = false;
      expiresAt = clock.currentTimeMillisUnsafe() + ttlMillis;
      exit2 = exit_;
      latch.openUnsafe();
    }));
  }), sync(() => {
    expiresAt = 0;
    latch.closeUnsafe();
    exit2 = undefined;
  })];
}));
var cachedWithTTL = /* @__PURE__ */ dual(2, (self, timeToLive) => map5(cachedInvalidateWithTTL(self, timeToLive), (tuple) => tuple[0]));
var cached = (self) => cachedWithTTL(self, infinity);
var interrupt = /* @__PURE__ */ withFiber((fiber2) => failCause(causeInterrupt(fiber2.id)));
var uninterruptible = (self) => withFiber((fiber2) => {
  if (!fiber2.interruptible)
    return self;
  fiber2.interruptible = false;
  fiber2._stack.push(setInterruptibleTrue);
  return self;
});
var setInterruptible = /* @__PURE__ */ makePrimitive({
  op: "SetInterruptible",
  [contAll](fiber2) {
    fiber2.interruptible = this[args];
    if (fiber2._interruptedCause && fiber2.interruptible) {
      return () => failCause(fiber2._interruptedCause);
    }
  }
});
var setInterruptibleTrue = /* @__PURE__ */ setInterruptible(true);
var setInterruptibleFalse = /* @__PURE__ */ setInterruptible(false);
var setFiberInterruptible = (fiber2) => {
  fiber2.interruptible = true;
  fiber2._stack.push(setInterruptibleFalse);
  if (fiber2._interruptedCause)
    return failCause(fiber2._interruptedCause);
};
var interruptible = (self) => withFiber((fiber2) => {
  if (fiber2.interruptible)
    return self;
  return setFiberInterruptible(fiber2) ?? self;
});
var uninterruptibleMask = (f) => withFiber((fiber2) => {
  if (!fiber2.interruptible)
    return f(identity);
  fiber2.interruptible = false;
  fiber2._stack.push(setInterruptibleTrue);
  return f(interruptible);
});
var interruptibleMask = (f) => withFiber((fiber2) => {
  if (fiber2.interruptible)
    return f(identity);
  const interrupted = setFiberInterruptible(fiber2);
  const effect = f(uninterruptible);
  return interrupted ?? effect;
});
var abortSignal = /* @__PURE__ */ map5(/* @__PURE__ */ acquireRelease(/* @__PURE__ */ sync(() => new AbortController), (controller) => sync(() => controller.abort())), (_) => _.signal);
var all = (arg, options) => {
  if (isIterable(arg)) {
    return options?.mode === "result" ? forEach(arg, result, options) : forEach(arg, identity, options);
  } else if (options?.discard) {
    return options.mode === "result" ? forEach(Object.values(arg), result, options) : forEach(Object.values(arg), identity, options);
  }
  return suspend(() => {
    const out = {};
    return as(forEach(Object.entries(arg), ([key, effect]) => map5(options?.mode === "result" ? result(effect) : effect, (value) => {
      assignProperty(out, key, value);
    }), {
      discard: true,
      concurrency: options?.concurrency
    }), out);
  });
};
var partition2 = /* @__PURE__ */ dual((args2) => isIterable(args2[0]) && !isEffect(args2[0]), (elements, f, options) => map5(forEach(elements, (a, i) => result(f(a, i)), options), (results) => partition(results, identity)));
var reduce = /* @__PURE__ */ dual(3, (elements, zero2, f) => {
  const arr = fromIterable(elements);
  if (arr.length === 0)
    return sync(zero2);
  return suspend(() => {
    let index = 0;
    let state = zero2();
    return map5(whileLoop({
      while: () => index < arr.length,
      body: () => f(state, arr[index], index),
      step(next) {
        state = next;
        index++;
      }
    }), () => state);
  });
});
var validate = /* @__PURE__ */ dual((args2) => isIterable(args2[0]) && !isEffect(args2[0]), (elements, f, options) => flatMap3(partition2(elements, f, {
  concurrency: options?.concurrency
}), ([excluded, satisfying]) => {
  if (isArrayNonEmpty2(excluded)) {
    return fail3(excluded);
  }
  return options?.discard ? void_ : succeed3(satisfying);
}));
var findFirst = /* @__PURE__ */ dual((args2) => isIterable(args2[0]) && !isEffect(args2[0]), (elements, predicate) => suspend(() => {
  const iterator = elements[Symbol.iterator]();
  const next = iterator.next();
  if (!next.done) {
    return findFirstLoop(iterator, 0, predicate, next.value);
  }
  return succeed3(none2());
}));
var findFirstLoop = (iterator, index, predicate, value) => flatMap3(predicate(value, index), (keep) => {
  if (keep) {
    return succeed3(some2(value));
  }
  const next = iterator.next();
  if (!next.done) {
    return findFirstLoop(iterator, index + 1, predicate, next.value);
  }
  return succeed3(none2());
});
var findFirstFilter = /* @__PURE__ */ dual((args2) => isIterable(args2[0]) && !isEffect(args2[0]), (elements, filter3) => suspend(() => {
  const iterator = elements[Symbol.iterator]();
  const next = iterator.next();
  if (!next.done) {
    return findFirstFilterLoop(iterator, 0, filter3, next.value);
  }
  return succeed3(none2());
}));
var findFirstFilterLoop = (iterator, index, filter3, value) => flatMap3(filter3(value, index), (result2) => {
  if (isSuccess2(result2)) {
    return succeed3(some2(result2.success));
  }
  const next = iterator.next();
  if (!next.done) {
    return findFirstFilterLoop(iterator, index + 1, filter3, next.value);
  }
  return succeed3(none2());
});
var whileLoop = /* @__PURE__ */ makePrimitive({
  op: "While",
  [contA](value, fiber2) {
    this[args].step(value);
    if (this[args].while()) {
      fiber2._stack.push(this);
      return this[args].body();
    }
    return exitVoid;
  },
  [evaluate](fiber2) {
    if (this[args].while()) {
      fiber2._stack.push(this);
      return this[args].body();
    }
    return exitVoid;
  }
});
var forEach = /* @__PURE__ */ dual((args2) => typeof args2[1] === "function", (iterable, f, options) => suspend(() => {
  const concurrencyOption = options?.concurrency ?? 1;
  const concurrency = concurrencyOption === "unbounded" ? Number.POSITIVE_INFINITY : Math.max(1, concurrencyOption);
  if (concurrency === 1) {
    return forEachSequential(iterable, f, options);
  }
  const items = fromIterable(iterable);
  let length = items.length;
  if (length === 0) {
    return options?.discard ? void_ : succeed3([]);
  }
  const out = options?.discard ? undefined : new Array(length);
  const eff = forEachConcurrent({
    f,
    out
  }, items, {
    concurrency
  });
  return eff ? as(eff, out) : succeed3(out);
}));
var forEachSequential = (iterable, f, options) => suspend(() => {
  const out = options?.discard ? undefined : [];
  const iterator = iterable[Symbol.iterator]();
  let state = iterator.next();
  let index = 0;
  return as(whileLoop({
    while: () => !state.done,
    body: () => f(state.value, index++),
    step: (b) => {
      if (out)
        out.push(b);
      state = iterator.next();
    }
  }), out);
});
var iterateEagerImpl = (options) => {
  const onItem = options.onItem;
  const step = options.step;
  const runSequential = (state, items, index, end) => {
    for (;index < end; index++) {
      const item = items[index];
      const effect = onItem(state, item, index);
      if (!effectIsExit(effect)) {
        return flatMap3(exit(effect), (itemExit) => step(state, item, itemExit, index) ?? runSequential(state, items, index + 1, end) ?? void_);
      }
      const terminal = step(state, item, effect, index);
      if (terminal)
        return terminal._tag === "Failure" ? terminal : undefined;
    }
  };
  return (state, items, opts) => {
    let index = 0;
    const end = opts?.end ?? items.length;
    const concurrency = opts?.concurrency ?? 1;
    if (concurrency === 1) {
      return runSequential(state, items, 0, end);
    }
    const orderedStep = opts?.orderedStep === true && concurrency > 1;
    let done2 = false;
    let parentFiber;
    let fibers;
    let resume;
    let interrupted = false;
    let terminal;
    let effect;
    let nextIndex = index;
    const exits = orderedStep ? new Array(end) : undefined;
    const failDefect = (error) => {
      const defect = exitDie(error);
      terminal = defect;
      done2 = true;
      interrupted = true;
      return fibers && fibers.size > 0 ? flatMap3(uninterruptible(fiberInterruptAll(Array.from(fibers))), () => defect) : defect;
    };
    const runStep = (item, exit2, currentIndex) => {
      if (!orderedStep)
        return step(state, item, exit2, currentIndex);
      if (terminal)
        return terminal;
      exits[currentIndex] = exit2;
      while (nextIndex < end) {
        const nextExit = exits[nextIndex];
        if (nextExit === undefined)
          return;
        exits[nextIndex] = undefined;
        const index2 = nextIndex++;
        const result2 = step(state, items[index2], nextExit, index2);
        if (result2)
          return result2;
      }
    };
    const go = () => {
      let paused = false;
      for (;!terminal && index < end; index++) {
        const item = items[index];
        const eff = effect ?? onItem(state, item, index);
        if (effectIsExit(eff)) {
          terminal = runStep(item, eff, index);
          if (terminal)
            break;
        } else if (!parentFiber) {
          return callback((cb) => {
            parentFiber = getCurrentFiber();
            fibers = new Set;
            effect = eff;
            resume = cb;
            let result2;
            try {
              result2 = go();
            } catch (error) {
              return cb(failDefect(error));
            }
            if (result2)
              return cb(result2);
            return suspend(() => {
              terminal = exitVoid;
              interrupted = true;
              return fibers ? fiberInterruptAll(fibers) : void_;
            });
          });
        } else {
          effect = undefined;
          const fiber2 = forkUnsafe(parentFiber, eff, true, true, "inherit");
          if (fiber2._exit) {
            terminal = runStep(item, fiber2._exit, index);
            if (terminal)
              break;
            continue;
          }
          fibers.add(fiber2);
          const currentIndex = index;
          fiber2.addObserver((exit2) => {
            fibers.delete(fiber2);
            try {
              if (terminal) {
                if (!interrupted && exit2._tag === "Failure") {
                  for (const reason of exit2.cause.reasons) {
                    if (reason._tag === "Interrupt")
                      continue;
                    else if (terminal._tag === "Failure") {
                      terminal.cause.reasons.push(reason);
                    } else {
                      terminal = exitFailCause(causeFromReasons([reason]));
                    }
                  }
                }
              } else {
                const result2 = runStep(item, exit2, currentIndex);
                if (result2) {
                  terminal = result2._tag === "Failure" ? exitFailCause(causeFromReasons(result2.cause.reasons.slice())) : result2;
                  go();
                }
              }
              if (paused) {
                const eff2 = go();
                if (eff2)
                  resume(eff2);
              } else if (done2 && fibers.size === 0) {
                resume(terminal ?? void_);
              }
            } catch (error) {
              resume(failDefect(error));
            }
          });
          if (fibers.size < concurrency)
            continue;
          paused = true;
          index++;
          return;
        }
      }
      done2 = true;
      if (terminal) {
        if (fibers && fibers.size > 0) {
          const annotations = fiberStackAnnotations(parentFiber);
          fibers.forEach((f) => f.interruptUnsafe(parentFiber.id, annotations));
          return;
        }
        if (resume || terminal._tag === "Failure") {
          return terminal;
        }
      } else if (resume) {
        if (!fibers) {
          return exitVoid;
        } else if (fibers.size === 0) {
          resume(void_);
        }
      }
    };
    return go();
  };
};
var iterateEager = () => iterateEagerImpl;
var forEachConcurrent = /* @__PURE__ */ iterateEagerImpl({
  onItem(state, item, index) {
    return state.f(item, index);
  },
  step(state, _, exit2, index) {
    if (exit2._tag === "Failure")
      return exit2;
    else if (state.out) {
      state.out[index] = exit2.value;
    }
  }
});
var filterOrElse = /* @__PURE__ */ dual(3, (self, predicate, orElse) => flatMap3(self, (a) => predicate(a) ? succeed3(a) : orElse(a)));
var filterMapOrElse = /* @__PURE__ */ dual(3, (self, filter3, orElse) => flatMap3(self, (a) => {
  const result2 = filter3(a);
  return isFailure2(result2) ? orElse(result2.failure) : succeed3(result2.success);
}));
var filterMapOrFail = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, filter3, orFailWith) => filterMapOrElse(self, filter3, orFailWith ? (x) => fail3(orFailWith(x)) : () => fail3(new NoSuchElementError)));
var filter3 = /* @__PURE__ */ dual((args2) => isIterable(args2[0]) && !isEffect(args2[0]), (elements, predicate, options) => suspend(() => {
  const out = [];
  return as(forEach(elements, (a, i) => {
    const result2 = predicate(a, i);
    if (typeof result2 === "boolean") {
      if (result2)
        out.push(a);
      return void_;
    }
    return map5(result2, (keep) => {
      if (keep) {
        out.push(a);
      }
    });
  }, {
    discard: true,
    concurrency: options?.concurrency
  }), out);
}));
var filterMap = /* @__PURE__ */ dual((args2) => isIterable(args2[0]) && !isEffect(args2[0]), (elements, filter4) => suspend(() => {
  const out = [];
  for (const a of elements) {
    const result2 = filter4(a);
    if (isSuccess2(result2)) {
      out.push(result2.success);
    }
  }
  return succeed3(out);
}));
var filterMapEffect = /* @__PURE__ */ dual((args2) => isIterable(args2[0]) && !isEffect(args2[0]), (elements, filter4, options) => suspend(() => {
  const out = [];
  return as(forEach(elements, (a) => map5(filter4(a), (result2) => {
    if (isSuccess2(result2)) {
      out.push(result2.success);
    }
  }), {
    discard: true,
    concurrency: options?.concurrency
  }), out);
}));
var Do = /* @__PURE__ */ succeed3({});
var bindTo2 = /* @__PURE__ */ bindTo(map5);
var bind2 = /* @__PURE__ */ bind(map5, flatMap3);
var let_2 = /* @__PURE__ */ let_(map5);
var forkChild = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, options) => withFiber((fiber2) => {
  interruptChildrenPatch();
  return succeed3(forkUnsafe(fiber2, self, options?.startImmediately, false, options?.uninterruptible ?? false));
}));
var forkUnsafe = (parent, effect, immediate = false, daemon = false, uninterruptible2 = false) => {
  const parentRuntime = parent;
  const interruptible2 = uninterruptible2 === "inherit" ? parentRuntime.interruptible : !uninterruptible2;
  const child = new FiberImpl(parentRuntime.context, interruptible2);
  if (immediate) {
    child.evaluate(effect);
  } else {
    parentRuntime.currentDispatcher.scheduleTask(() => child.evaluate(effect), 0);
  }
  if (!daemon && !child._exit) {
    parentRuntime.children().add(child);
    child.addObserver(() => parentRuntime._children.delete(child));
  }
  return child;
};
var forkDetach = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, options) => withFiber((fiber2) => succeed3(forkUnsafe(fiber2, self, options?.startImmediately, true, options?.uninterruptible))));
var awaitAllChildren = (self) => withFiber((fiber2) => {
  const initialChildren = fiber2._children && new Set(fiber2._children);
  return onExit(self, (_) => {
    let children = fiber2._children;
    if (children === undefined || children.size === 0) {
      return void_;
    } else if (initialChildren) {
      children = filter2(children, (child) => !initialChildren.has(child));
    }
    return asVoid(fiberAwaitAll(children));
  });
});
var forkIn = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, scope2, options) => withFiber((parent) => {
  const fiber2 = forkUnsafe(parent, self, options?.startImmediately, true, options?.uninterruptible);
  if (!fiber2._exit) {
    if (scope2.state._tag !== "Closed") {
      const key = {};
      const finalizer = () => withFiberId((interruptor) => interruptor === fiber2.id ? void_ : fiberInterrupt(fiber2));
      scopeAddFinalizerUnsafe(scope2, key, finalizer);
      fiber2.addObserver(() => scopeRemoveFinalizerUnsafe(scope2, key));
    } else {
      fiber2.interruptUnsafe(parent.id, fiberStackAnnotations(parent));
    }
  }
  return succeed3(fiber2);
}));
var forkScoped = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, options) => flatMap3(scope, (scope2) => forkIn(self, scope2, options)));
var runForkWith = (context2) => (effect, options) => {
  const fiber2 = new FiberImpl(options?.scheduler ? add(context2, Scheduler, options.scheduler) : context2, options?.uninterruptible !== true);
  fiber2.evaluate(effect);
  if (fiber2._exit)
    return fiber2;
  if (options?.signal) {
    if (options.signal.aborted) {
      fiber2.interruptUnsafe();
    } else {
      const abort = () => fiber2.interruptUnsafe();
      options.signal.addEventListener("abort", abort, {
        once: true
      });
      fiber2.addObserver(() => options.signal.removeEventListener("abort", abort));
    }
  }
  if (options?.onFiberStart) {
    options.onFiberStart(fiber2);
  }
  return fiber2;
};
var runFork = /* @__PURE__ */ runForkWith(/* @__PURE__ */ empty());
var runCallbackWith = (context2) => {
  const runFork2 = runForkWith(context2);
  return (effect, options) => {
    const fiber2 = runFork2(effect, options);
    if (options?.onExit) {
      fiber2.addObserver(options.onExit);
    }
    return (interruptor) => {
      return fiber2.interruptUnsafe(interruptor);
    };
  };
};
var runCallback = /* @__PURE__ */ runCallbackWith(/* @__PURE__ */ empty());
var runPromiseExitWith = (context2) => {
  const runFork2 = runForkWith(context2);
  return (effect, options) => {
    const fiber2 = runFork2(effect, options);
    return new Promise((resolve) => {
      fiber2.addObserver((exit2) => resolve(exit2));
    });
  };
};
var runPromiseExit = /* @__PURE__ */ runPromiseExitWith(/* @__PURE__ */ empty());
var runPromiseWith = (context2) => {
  const runPromiseExit2 = runPromiseExitWith(context2);
  return (effect, options) => runPromiseExit2(effect, options).then((exit2) => {
    if (exit2._tag === "Failure") {
      throw causeSquash(exit2.cause);
    }
    return exit2.value;
  });
};
var runPromise = /* @__PURE__ */ runPromiseWith(/* @__PURE__ */ empty());
var runSyncExitWith = (context2) => {
  const runFork2 = runForkWith(context2);
  return (effect) => {
    if (effectIsExit(effect))
      return effect;
    const scheduler = new MixedScheduler("sync");
    const fiber2 = runFork2(effect, {
      scheduler
    });
    fiber2._dispatcher?.flush();
    return fiber2._exit ?? exitDie(new AsyncFiberError(fiber2));
  };
};
var runSyncExit = /* @__PURE__ */ runSyncExitWith(/* @__PURE__ */ empty());
var runSyncWith = (context2) => {
  const runSyncExit2 = runSyncExitWith(context2);
  return (effect) => {
    const exit2 = runSyncExit2(effect);
    if (exit2._tag === "Failure")
      throw causeSquash(exit2.cause);
    return exit2.value;
  };
};
var runSync = /* @__PURE__ */ runSyncWith(/* @__PURE__ */ empty());
var succeedTrue = /* @__PURE__ */ succeed3(true);
var succeedFalse = /* @__PURE__ */ succeed3(false);

class Latch {
  waiters = [];
  scheduled = undefined;
  _isOpen;
  constructor(isOpen) {
    this._isOpen = isOpen;
  }
  scheduleUnsafe(fiber2) {
    if (this.waiters.length === 0) {
      return succeedTrue;
    }
    if (this.scheduled === undefined) {
      this.scheduled = this.waiters;
      fiber2.currentDispatcher.scheduleTask(this.flushScheduled, 0);
    } else {
      for (let i = 0;i < this.waiters.length; i++) {
        this.scheduled.push(this.waiters[i]);
      }
    }
    this.waiters = [];
    return succeedTrue;
  }
  flushScheduled = () => {
    if (this.scheduled === undefined)
      return;
    const waiters = this.scheduled;
    this.scheduled = undefined;
    for (let i = 0;i < waiters.length; i++) {
      waiters[i](exitVoid);
    }
  };
  flushWaiters() {
    const waiters = this.waiters;
    this.waiters = [];
    this.flushScheduled();
    for (let i = 0;i < waiters.length; i++) {
      waiters[i](exitVoid);
    }
  }
  open = /* @__PURE__ */ withFiber((fiber2) => {
    if (this._isOpen)
      return succeedFalse;
    this._isOpen = true;
    return this.scheduleUnsafe(fiber2);
  });
  release = /* @__PURE__ */ withFiber((fiber2) => this._isOpen ? succeedFalse : this.scheduleUnsafe(fiber2));
  openUnsafe() {
    if (this._isOpen)
      return false;
    this._isOpen = true;
    this.flushWaiters();
    return true;
  }
  await = /* @__PURE__ */ callback((resume) => {
    if (this._isOpen) {
      return resume(void_);
    }
    this.waiters.push(resume);
    return sync(() => {
      let index = this.waiters.indexOf(resume);
      if (index !== -1) {
        this.waiters.splice(index, 1);
      } else if (this.scheduled !== undefined) {
        index = this.scheduled.indexOf(resume);
        if (index !== -1) {
          this.scheduled.splice(index, 1);
        }
      }
    });
  });
  closeUnsafe() {
    if (!this._isOpen)
      return false;
    this._isOpen = false;
    return true;
  }
  close = /* @__PURE__ */ sync(() => this.closeUnsafe());
  whenOpen = (self) => flatMap3(this.await, () => self);
  isOpen() {
    return this._isOpen;
  }
}
var makeLatchUnsafe = (open) => new Latch(open ?? false);
var tracer = /* @__PURE__ */ withFiber((fiber2) => succeed3(fiber2.getRef(Tracer)));
var withTracer = /* @__PURE__ */ dual(2, (effect, tracer2) => provideService(effect, Tracer, tracer2));
var withTracerEnabled = /* @__PURE__ */ provideService(TracerEnabled);
var withTracerTiming = /* @__PURE__ */ provideService(TracerTimingEnabled);
var bigint02 = /* @__PURE__ */ BigInt(0);
var NoopSpanProto = {
  _tag: "Span",
  spanId: "noop",
  traceId: "noop",
  sampled: false,
  status: {
    _tag: "Ended",
    startTime: bigint02,
    endTime: bigint02,
    exit: exitVoid
  },
  attributes: /* @__PURE__ */ new Map,
  links: [],
  kind: "internal",
  attribute() {},
  event() {},
  end() {},
  addLinks() {}
};
var noopSpan = (options) => Object.assign(Object.create(NoopSpanProto), options);
var filterDisablePropagation = (span) => {
  if (!span)
    return none2();
  return get(span.annotations, DisablePropagation) ? span._tag === "Span" ? filterDisablePropagation(getOrUndefined(span.parent)) : none2() : some2(span);
};
var makeSpanUnsafe = (fiber2, name, options) => {
  const disablePropagation = !fiber2.getRef(TracerEnabled) || options?.annotations && get(options.annotations, DisablePropagation);
  const parent = options?.parent !== undefined ? some2(options.parent) : options?.root ? none2() : filterDisablePropagation(fiber2.currentSpan);
  let span;
  if (disablePropagation) {
    span = noopSpan({
      name,
      parent,
      annotations: add(options?.annotations ?? empty(), DisablePropagation, true)
    });
  } else {
    const tracer2 = fiber2.getRef(Tracer);
    const clock = fiber2.getRef(ClockRef);
    const timingEnabled = fiber2.getRef(TracerTimingEnabled);
    const annotationsFromEnv = fiber2.getRef(TracerSpanAnnotations);
    const linksFromEnv = fiber2.getRef(TracerSpanLinks);
    const level = options?.level ?? fiber2.getRef(CurrentTraceLevel);
    const links = options?.links !== undefined ? [...linksFromEnv, ...options.links] : linksFromEnv.slice();
    span = tracer2.span({
      name,
      parent,
      annotations: options?.annotations ?? empty(),
      links,
      startTime: timingEnabled ? clock.currentTimeNanosUnsafe() : BigInt(0),
      kind: options?.kind ?? "internal",
      root: options?.root ?? isNone2(parent),
      sampled: options?.sampled ?? (isSome2(parent) && parent.value.sampled === false ? false : !isLogLevelGreaterThan(fiber2.getRef(MinimumTraceLevel), level))
    });
    for (const [key, value] of Object.entries(annotationsFromEnv)) {
      span.attribute(key, value);
    }
    if (options?.attributes !== undefined) {
      for (const [key, value] of Object.entries(options.attributes)) {
        span.attribute(key, value);
      }
    }
  }
  return span;
};
var makeSpan = (name, options) => withFiber((fiber2) => succeed3(makeSpanUnsafe(fiber2, name, options)));
var makeSpanScoped = (name, options) => uninterruptible(withFiber((fiber2) => {
  const scope2 = getUnsafe(fiber2.context, scopeTag);
  const span = makeSpanUnsafe(fiber2, name, options ?? {});
  const clock = fiber2.getRef(ClockRef);
  const timingEnabled = fiber2.getRef(TracerTimingEnabled);
  return as(scopeAddFinalizerExit(scope2, (exit2) => endSpan(span, exit2, clock, timingEnabled)), span);
}));
var withSpanScoped = function() {
  const dataFirst = typeof arguments[0] !== "string";
  const name = dataFirst ? arguments[1] : arguments[0];
  const options = addSpanStackTrace(dataFirst ? arguments[2] : arguments[1]);
  if (dataFirst) {
    const self = arguments[0];
    return flatMap3(makeSpanScoped(name, options), (span) => withParentSpan(self, span, options));
  }
  return (self) => flatMap3(makeSpanScoped(name, options), (span) => withParentSpan(self, span, options));
};
var provideSpanStackFrame = (name, stack) => {
  stack = typeof stack === "function" ? stack : constUndefined;
  return updateService(CurrentStackFrame, (parent) => ({
    name,
    stack,
    parent
  }));
};
var spanAnnotations = TracerSpanAnnotations;
var spanLinks = TracerSpanLinks;
var linkSpans = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, span, attributes = {}) => {
  const spans = Array.isArray(span) ? span : [span];
  const links = spans.map((span2) => ({
    span: span2,
    attributes
  }));
  return updateService(self, TracerSpanLinks, (current) => [...current, ...links]);
});
var endSpan = (span, exit2, clock, timingEnabled) => sync(() => {
  if (span.status._tag === "Ended")
    return;
  span.end(timingEnabled ? clock.currentTimeNanosUnsafe() : bigint02, exit2);
});
var useSpan = (name, ...args2) => {
  const options = args2.length === 1 ? undefined : args2[0];
  const evaluate2 = args2[args2.length - 1];
  return withFiber((fiber2) => {
    const span = makeSpanUnsafe(fiber2, name, options);
    const clock = fiber2.getRef(ClockRef);
    const timingEnabled = fiber2.getRef(TracerTimingEnabled);
    return onExit(internalCall(() => evaluate2(span)), (exit2) => endSpan(span, exit2, clock, timingEnabled));
  });
};
var provideParentSpan = /* @__PURE__ */ provideService(ParentSpan);
var withParentSpan = function() {
  const dataFirst = isEffect(arguments[0]);
  const span = dataFirst ? arguments[1] : arguments[0];
  let options = dataFirst ? arguments[2] : arguments[1];
  let provideStackFrame = identity;
  if (span._tag === "Span") {
    options = addSpanStackTrace(options);
    provideStackFrame = provideSpanStackFrame(span.name, options?.captureStackTrace);
  }
  if (dataFirst) {
    return provideParentSpan(provideStackFrame(arguments[0]), span);
  }
  return (self) => provideParentSpan(provideStackFrame(self), span);
};
var withSpan = function() {
  const dataFirst = typeof arguments[0] !== "string";
  const name = dataFirst ? arguments[1] : arguments[0];
  const traceOptions = addSpanStackTrace(arguments[2]);
  if (dataFirst) {
    const self = arguments[0];
    return useSpan(name, arguments[2], (span) => withParentSpan(self, span, traceOptions));
  }
  const fnArg = typeof arguments[1] === "function" ? arguments[1] : undefined;
  const options = fnArg ? undefined : arguments[1];
  return (self, ...args2) => useSpan(name, fnArg ? fnArg(...args2) : options, (span) => withParentSpan(self, span, traceOptions));
};
var annotateSpans = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (effect, ...args2) => updateService(effect, TracerSpanAnnotations, (annotations) => {
  const newAnnotations = args2.length === 1 ? {
    ...annotations,
    ...args2[0]
  } : {
    ...annotations
  };
  if (args2.length === 1) {
    return newAnnotations;
  } else {
    assignProperty(newAnnotations, args2[0], args2[1]);
  }
  return newAnnotations;
}));
var annotateCurrentSpan = (...args2) => withFiber((fiber2) => {
  const span = fiber2.currentSpanLocal;
  if (span) {
    if (args2.length === 1) {
      for (const [key, value] of Object.entries(args2[0])) {
        span.attribute(key, value);
      }
    } else {
      span.attribute(args2[0], args2[1]);
    }
  }
  return void_;
});
var currentSpan = /* @__PURE__ */ withFiber((fiber2) => {
  const span = fiber2.currentSpanLocal;
  return span ? succeed3(span) : fail3(new NoSuchElementError);
});
var currentParentSpan = /* @__PURE__ */ serviceOptional(ParentSpan);
var ClockRef = /* @__PURE__ */ Reference("effect/Clock", {
  defaultValue: () => new ClockImpl
});
var MAX_TIMER_MILLIS = 2 ** 31 - 1;

class ClockImpl {
  currentTimeMillisUnsafe() {
    return Date.now();
  }
  currentTimeMillis = /* @__PURE__ */ sync(() => this.currentTimeMillisUnsafe());
  currentTimeNanosUnsafe() {
    return wallTimeNanos();
  }
  currentTimeNanos = /* @__PURE__ */ sync(() => this.currentTimeNanosUnsafe());
  monotonicTimeNanosUnsafe() {
    return monotonicNowNanos();
  }
  monotonicTimeNanos = /* @__PURE__ */ sync(() => this.monotonicTimeNanosUnsafe());
  sleep(duration) {
    return this.sleepMillis(toMillis(duration));
  }
  sleepMillis(millis2) {
    if (millis2 <= 0)
      return yieldNow;
    else if (!Number.isFinite(millis2))
      return never;
    return callback((resume) => {
      const continuation = millis2 > MAX_TIMER_MILLIS ? this.sleepMillis(millis2 - MAX_TIMER_MILLIS) : void_;
      const handle = setTimeout(() => resume(continuation), Math.min(millis2, MAX_TIMER_MILLIS));
      return sync(() => clearTimeout(handle));
    });
  }
}
var nanosPerMilli = /* @__PURE__ */ BigInt(1e6);
var monotonicNowNanos = /* @__PURE__ */ function() {
  const processHrtime = globalThis.process?.hrtime;
  if (typeof processHrtime?.bigint === "function") {
    return () => processHrtime.bigint();
  }
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return () => BigInt(Math.round(performance.now() * 1e6));
  }
  let previous = /* @__PURE__ */ BigInt(0);
  return () => {
    const current = BigInt(Date.now()) * nanosPerMilli;
    if (current > previous) {
      previous = current;
    }
    return previous;
  };
}();
var wallTimeNanos = /* @__PURE__ */ function() {
  const reanchorThresholdNanos = /* @__PURE__ */ BigInt(1e9);
  let origin;
  return () => {
    const monotonic = monotonicNowNanos();
    const wall = BigInt(Date.now()) * nanosPerMilli;
    if (origin === undefined) {
      origin = wall - monotonic;
    } else {
      const projected = origin + monotonic;
      const skew = wall > projected ? wall - projected : projected - wall;
      if (skew > reanchorThresholdNanos) {
        origin = wall - monotonic;
      }
    }
    return origin + monotonic;
  };
}();
var clockWith = (f) => withFiber((fiber2) => f(fiber2.getRef(ClockRef)));
var sleep = (duration) => clockWith((clock) => clock.sleep(fromInputUnsafe(duration)));
var currentTimeMillis = /* @__PURE__ */ clockWith((clock) => clock.currentTimeMillis);
var TimeoutErrorTypeId = "~effect/Cause/TimeoutError";
class TimeoutError extends (/* @__PURE__ */ TaggedError("TimeoutError")) {
  [TimeoutErrorTypeId] = TimeoutErrorTypeId;
  constructor(message) {
    super({
      message
    });
  }
}
var IllegalArgumentErrorTypeId = "~effect/Cause/IllegalArgumentError";
class IllegalArgumentError extends (/* @__PURE__ */ TaggedError("IllegalArgumentError")) {
  [IllegalArgumentErrorTypeId] = IllegalArgumentErrorTypeId;
  constructor(message) {
    super({
      message
    });
  }
}
var AsyncFiberErrorTypeId = "~effect/Cause/AsyncFiberError";
class AsyncFiberError extends (/* @__PURE__ */ TaggedError("AsyncFiberError")) {
  [AsyncFiberErrorTypeId] = AsyncFiberErrorTypeId;
  constructor(fiber2) {
    super({
      message: "An asynchronous Effect was executed with Effect.runSync",
      fiber: fiber2
    });
  }
}
var UnknownErrorTypeId = "~effect/Cause/UnknownError";
class UnknownError extends (/* @__PURE__ */ TaggedError("UnknownError")) {
  [UnknownErrorTypeId] = UnknownErrorTypeId;
  constructor(cause, message) {
    super({
      message,
      cause
    });
  }
}
var ConsoleRef = /* @__PURE__ */ Reference("effect/Console/CurrentConsole", {
  defaultValue: () => globalThis.console
});
var logLevelToOrder = (level) => {
  switch (level) {
    case "All":
      return Number.MIN_SAFE_INTEGER;
    case "Fatal":
      return 50000;
    case "Error":
      return 40000;
    case "Warn":
      return 30000;
    case "Info":
      return 20000;
    case "Debug":
      return 1e4;
    case "Trace":
      return 0;
    case "None":
      return Number.MAX_SAFE_INTEGER;
  }
};
var LogLevelOrder = /* @__PURE__ */ mapInput(Number2, logLevelToOrder);
var isLogLevelGreaterThan = /* @__PURE__ */ isGreaterThan(LogLevelOrder);
var CurrentLoggers = /* @__PURE__ */ Reference("effect/Loggers/CurrentLoggers", {
  defaultValue: () => new Set([defaultLogger, tracerLogger])
});
var LogToStderr = /* @__PURE__ */ Reference("effect/Logger/LogToStderr", {
  defaultValue: constFalse
});
var annotateLogsScoped = function() {
  const entries = typeof arguments[0] === "string" ? [[arguments[0], arguments[1]]] : Object.entries(arguments[0]);
  return uninterruptible(withFiber((fiber2) => {
    const prev = fiber2.getRef(CurrentLogAnnotations);
    const next = {
      ...prev
    };
    for (let i = 0;i < entries.length; i++) {
      const [key, value] = entries[i];
      assignProperty(next, key, value);
    }
    fiber2.setContext(add(fiber2.context, CurrentLogAnnotations, next));
    return scopeAddFinalizerExit(getUnsafe(fiber2.context, scopeTag), (_) => {
      const current = fiber2.getRef(CurrentLogAnnotations);
      const next2 = {
        ...current
      };
      for (let i = 0;i < entries.length; i++) {
        const [key, value] = entries[i];
        if (current[key] !== value)
          continue;
        if (Object.hasOwn(prev, key)) {
          assignProperty(next2, key, prev[key]);
        } else {
          delete next2[key];
        }
      }
      fiber2.setContext(add(fiber2.context, CurrentLogAnnotations, next2));
      return void_;
    });
  }));
};
var LoggerTypeId = "~effect/Logger";
var LoggerProto = {
  [LoggerTypeId]: {
    _Message: identity,
    _Output: identity
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var loggerMake = (log) => {
  const self = Object.create(LoggerProto);
  self.log = log;
  return self;
};
var formatLabel = (key) => key.replace(/[\s="]/g, "_");
var formatLogSpan = (self, now) => {
  const label = formatLabel(self[0]);
  return `${label}=${now - self[1]}ms`;
};
var logWithLevel = (level) => (...message) => {
  let cause = undefined;
  for (let i = 0, len = message.length;i < len; i++) {
    const msg = message[i];
    if (isCause(msg)) {
      if (cause) {
        message.splice(i, 1);
      } else {
        message = message.slice(0, i).concat(message.slice(i + 1));
      }
      cause = cause ? causeFromReasons(cause.reasons.concat(msg.reasons)) : msg;
      i--;
    }
  }
  if (cause === undefined) {
    cause = causeEmpty;
  }
  return withFiber((fiber2) => {
    const logLevel = level ?? fiber2.currentLogLevel;
    if (isLogLevelGreaterThan(fiber2.minimumLogLevel, logLevel)) {
      return void_;
    }
    const clock = fiber2.getRef(ClockRef);
    const loggers = fiber2.getRef(CurrentLoggers);
    if (loggers.size > 0) {
      const date = new Date(clock.currentTimeMillisUnsafe());
      for (const logger of loggers) {
        logger.log({
          cause,
          fiber: fiber2,
          date,
          logLevel,
          message
        });
      }
    }
    return void_;
  });
};
var colors = {
  bold: "1",
  red: "31",
  green: "32",
  yellow: "33",
  blue: "34",
  cyan: "36",
  white: "37",
  gray: "90",
  black: "30",
  bgBrightRed: "101"
};
var logLevelColors = {
  None: [],
  All: [],
  Trace: [colors.gray],
  Debug: [colors.blue],
  Info: [colors.green],
  Warn: [colors.yellow],
  Error: [colors.red],
  Fatal: [colors.bgBrightRed, colors.black]
};
var defaultDateFormat = (date) => `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}.${date.getMilliseconds().toString().padStart(3, "0")}`;
var defaultLogger = /* @__PURE__ */ loggerMake(({
  cause,
  date,
  fiber: fiber2,
  logLevel,
  message
}) => {
  const message_ = Array.isArray(message) ? message.slice() : [message];
  if (cause.reasons.length > 0) {
    message_.push(causePretty(cause));
  }
  const now = date.getTime();
  const spans = fiber2.getRef(CurrentLogSpans);
  let spanString = "";
  for (const span of spans) {
    spanString += ` ${formatLogSpan(span, now)}`;
  }
  const annotations = fiber2.getRef(CurrentLogAnnotations);
  if (Object.keys(annotations).length > 0) {
    message_.push(annotations);
  }
  const console = fiber2.getRef(ConsoleRef);
  const log = fiber2.getRef(LogToStderr) ? console.error : console.log;
  log(`[${defaultDateFormat(date)}] ${logLevel.toUpperCase()} (#${fiber2.id})${spanString}:`, ...message_);
});
var tracerLogger = /* @__PURE__ */ loggerMake(({
  cause,
  fiber: fiber2,
  logLevel,
  message
}) => {
  const clock = fiber2.getRef(ClockRef);
  const annotations = fiber2.getRef(CurrentLogAnnotations);
  const span = fiber2.currentSpan;
  if (span === undefined || span._tag === "ExternalSpan")
    return;
  const attributes = {};
  for (const [key, value] of Object.entries(annotations)) {
    assignProperty(attributes, key, value);
  }
  attributes["effect.fiberId"] = fiber2.id;
  attributes["effect.logLevel"] = logLevel.toUpperCase();
  if (cause.reasons.length > 0) {
    attributes["effect.cause"] = causePretty(cause);
  }
  span.event(toStringUnknown(Array.isArray(message) && message.length === 1 ? message[0] : message), clock.currentTimeNanosUnsafe(), attributes);
});
function interruptChildrenPatch() {
  fiberMiddleware.interruptChildren ??= fiberInterruptChildren;
}
var undefined_ = /* @__PURE__ */ succeed3(undefined);
var withErrorReporting = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, options) => onError(self, (cause) => withFiber((fiber2) => {
  reportCauseUnsafe(fiber2, cause, options?.defectsOnly);
  return void_;
})));
var reportCauseUnsafe = (fiber2, cause, defectsOnly) => {
  const reporters = fiber2.getRef(CurrentErrorReporters);
  if (reporters.size === 0)
    return;
  if (defectsOnly && !hasDies(cause))
    return;
  const opts = {
    cause,
    fiber: fiber2,
    timestamp: fiber2.getRef(ClockRef).currentTimeNanosUnsafe()
  };
  reporters.forEach((reporter) => reporter.report(opts));
};

// node_modules/effect/dist/Exit.js
var isExit2 = isExit;
var succeed4 = exitSucceed;
var failCause2 = exitFailCause;
var fail4 = exitFail;
var void_2 = exitVoid;
var isSuccess4 = exitIsSuccess;
var isFailure4 = exitIsFailure;

// node_modules/effect/dist/Deferred.js
var TypeId5 = "~effect/Deferred";
var DeferredProto = {
  [TypeId5]: {
    _A: identity,
    _E: identity
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var makeUnsafe2 = () => {
  const self = Object.create(DeferredProto);
  self.resumes = undefined;
  self.effect = undefined;
  return self;
};
var _await = (self) => callback((resume) => {
  if (self.effect)
    return resume(self.effect);
  self.resumes ??= [];
  self.resumes.push(resume);
  return sync(() => {
    const index = self.resumes.indexOf(resume);
    self.resumes.splice(index, 1);
  });
});
var completeWith = /* @__PURE__ */ dual(2, (self, effect) => sync(() => doneUnsafe(self, effect)));
var done2 = completeWith;
var doneUnsafe = (self, effect) => {
  if (self.effect)
    return false;
  self.effect = effect;
  if (self.resumes) {
    for (let i = 0;i < self.resumes.length; i++) {
      self.resumes[i](effect);
    }
    self.resumes = undefined;
  }
  return true;
};

// node_modules/effect/dist/References.js
var CurrentLogAnnotations2 = CurrentLogAnnotations;
var CurrentLogSpans2 = CurrentLogSpans;

// node_modules/effect/dist/Scope.js
var makeUnsafe3 = scopeMakeUnsafe;
var forkUnsafe2 = scopeForkUnsafe;
var close = scopeClose;

// node_modules/effect/dist/Layer.js
var TypeId6 = "~effect/Layer";
var MemoMapTypeId = "~effect/Layer/MemoMap";
var memoMapReuse = (entry, scope2) => {
  entry.observers++;
  return andThen(scopeAddFinalizerExit(scope2, (exit2) => entry.finalizer(exit2)), entry.effect);
};
var isLayer = (u) => hasProperty(u, TypeId6);
var LayerProto = {
  [TypeId6]: {
    _ROut: identity,
    _E: identity,
    _RIn: identity
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var fromBuildUnsafe = (build) => {
  const self = Object.create(LayerProto);
  self.build = build;
  return self;
};
var fromBuild = (build) => fromBuildUnsafe((memoMap, scope2) => {
  const layerScope = forkUnsafe2(scope2);
  return onExit(build(memoMap, layerScope), (exit2) => exit2._tag === "Failure" ? close(layerScope, exit2) : void_);
});
var memoMapBuild = (memoMap, layer, scope2, build) => {
  const layerScope = makeUnsafe3();
  const deferred = makeUnsafe2();
  const entry = {
    observers: 1,
    effect: _await(deferred),
    finalizer: (exit2) => suspend(() => {
      entry.observers--;
      if (entry.observers === 0) {
        memoMap.map.delete(layer);
        return close(layerScope, exit2);
      }
      return void_;
    })
  };
  memoMap.map.set(layer, entry);
  return scopeAddFinalizerExit(scope2, entry.finalizer).pipe(flatMap3(() => build(memoMap, layerScope)), onExit((exit2) => {
    entry.effect = exit2;
    return done2(deferred, exit2);
  }));
};

class MemoMapImpl {
  get [MemoMapTypeId]() {
    return MemoMapTypeId;
  }
  parent;
  constructor(parent) {
    this.parent = parent;
  }
  map = /* @__PURE__ */ new Map;
  get(layer, scope2) {
    const local = this.map.get(layer);
    if (local) {
      return memoMapReuse(local, scope2);
    }
    return this.parent?.get(layer, scope2);
  }
  getOrElseMemoize(layer, scope2, build) {
    return suspend(() => {
      const existing = this.get(layer, scope2);
      if (existing) {
        return existing;
      }
      return memoMapBuild(this, layer, scope2, build);
    });
  }
}
var makeMemoMapUnsafe = () => new MemoMapImpl;
var forkMemoMapUnsafe = (parent) => new MemoMapImpl(parent);
class CurrentMemoMap extends (/* @__PURE__ */ Service()("effect/Layer/CurrentMemoMap")) {
  static forkOrCreate(self) {
    const current = getOrUndefined2(self, CurrentMemoMap);
    return current ? forkMemoMapUnsafe(current) : makeMemoMapUnsafe();
  }
}
var buildWithMemoMap = /* @__PURE__ */ dual(3, (self, memoMap, scope2) => provideService(map5(self.build(memoMap, scope2), add(CurrentMemoMap, memoMap)), CurrentMemoMap, memoMap));
var buildWithScope = /* @__PURE__ */ dual(2, (self, scope2) => withFiber((fiber2) => buildWithMemoMap(self, CurrentMemoMap.forkOrCreate(fiber2.context), scope2)));
var succeed5 = function() {
  if (arguments.length === 1) {
    return (resource) => succeedContext(make5(arguments[0], resource));
  }
  return succeedContext(make5(arguments[0], arguments[1]));
};
var succeedContext = (context2) => fromBuildUnsafe(constant(succeed3(context2)));
var mergeAllEffect = (layers, memoMap, scope2) => {
  const parentScope = forkUnsafe2(scope2, "parallel");
  return forEach(layers, (layer) => layer.build(memoMap, forkUnsafe2(parentScope, "sequential")), {
    concurrency: layers.length
  }).pipe(map5((context2) => mergeAll(...context2)));
};
var mergeAll2 = (...layers) => fromBuild((memoMap, scope2) => mergeAllEffect(layers, memoMap, scope2));
var provideWith = (self, that, f) => fromBuild((memoMap, scope2) => flatMap3(Array.isArray(that) ? mergeAllEffect(that, memoMap, scope2) : that.build(memoMap, scope2), (context2) => self.build(memoMap, scope2).pipe(provideContext(context2), map5((merged) => f(merged, context2)))));
var provide2 = /* @__PURE__ */ dual(2, (self, that) => provideWith(self, that, identity));

// node_modules/effect/dist/ExecutionPlan.js
var TypeId7 = "~effect/ExecutionPlan";
var Proto2 = {
  [TypeId7]: TypeId7,
  get captureRequirements() {
    const self = this;
    return contextWith((context2) => succeed3(makeProto(self.steps.map((step) => ({
      ...step,
      provide: isLayer(step.provide) ? provide2(step.provide, succeedContext(context2)) : step.provide
    })))));
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var makeProto = (steps) => {
  const self = Object.create(Proto2);
  self.steps = steps;
  return self;
};
var CurrentMetadata = /* @__PURE__ */ Reference("effect/ExecutionPlan/CurrentMetadata", {
  defaultValue: /* @__PURE__ */ constant({
    attempt: 0,
    stepIndex: 0
  })
});

// node_modules/effect/dist/Cause.js
var isCause2 = isCause;
var isReason = isCauseReason;
var isFailReason2 = isFailReason;
var fromReasons = causeFromReasons;
var empty3 = causeEmpty;
var makeFailReason = (error) => new Fail(error);
var makeDieReason = (defect) => new Die(defect);
var makeInterruptReason2 = makeInterruptReason;
var map6 = causeMap;
var findError2 = findError;
var pretty = causePretty;
var isDone2 = isDone;
var done3 = done;
var IllegalArgumentError2 = IllegalArgumentError;

// node_modules/effect/dist/Data.js
var Class2 = class extends Class {
  constructor(props) {
    super();
    if (props) {
      assignProperties(this, props);
    }
  }
};
var TaggedError2 = TaggedError;

// node_modules/effect/dist/internal/dateTime.js
var TypeId8 = "~effect/time/DateTime";
var TimeZoneTypeId = "~effect/time/DateTime/TimeZone";
var Proto3 = {
  [TypeId8]: TypeId8,
  pipe() {
    return pipeArguments(this, arguments);
  },
  [NodeInspectSymbol]() {
    return this.toString();
  },
  toJSON() {
    return toDateUtc(this).toJSON();
  }
};
var ProtoUtc = {
  ...Proto3,
  _tag: "Utc",
  [symbol]() {
    return number(this.epochMilliseconds);
  },
  [symbol2](that) {
    return isDateTime(that) && that._tag === "Utc" && this.epochMilliseconds === that.epochMilliseconds;
  },
  toString() {
    return `DateTime.Utc(${toDateUtc(this).toJSON()})`;
  }
};
var ProtoZoned = {
  ...Proto3,
  _tag: "Zoned",
  [symbol]() {
    return combine(number(this.epochMilliseconds))(hash(this.zone));
  },
  [symbol2](that) {
    return isDateTime(that) && that._tag === "Zoned" && this.epochMilliseconds === that.epochMilliseconds && equals(this.zone, that.zone);
  },
  toString() {
    return `DateTime.Zoned(${formatIsoZoned(this)})`;
  }
};
var ProtoTimeZone = {
  [TimeZoneTypeId]: TimeZoneTypeId,
  [NodeInspectSymbol]() {
    return this.toString();
  }
};
var ProtoTimeZoneNamed = {
  ...ProtoTimeZone,
  _tag: "Named",
  [symbol]() {
    return string(`Named:${this.id}`);
  },
  [symbol2](that) {
    return isTimeZone(that) && that._tag === "Named" && this.id === that.id;
  },
  toString() {
    return `TimeZone.Named(${this.id})`;
  },
  toJSON() {
    return {
      _id: "TimeZone",
      _tag: "Named",
      id: this.id
    };
  }
};
var ProtoTimeZoneOffset = {
  ...ProtoTimeZone,
  _tag: "Offset",
  [symbol]() {
    return string(`Offset:${this.offset}`);
  },
  [symbol2](that) {
    return isTimeZone(that) && that._tag === "Offset" && this.offset === that.offset;
  },
  toString() {
    return `TimeZone.Offset(${offsetToString(this.offset)})`;
  },
  toJSON() {
    return {
      _id: "TimeZone",
      _tag: "Offset",
      offset: this.offset
    };
  }
};
var makeZonedProto = (epochMillis, zone, partsUtc) => {
  const self = Object.create(ProtoZoned);
  self.epochMilliseconds = epochMillis;
  self.zone = zone;
  Object.defineProperty(self, "partsUtc", {
    value: partsUtc,
    enumerable: false,
    writable: true
  });
  Object.defineProperty(self, "adjustedEpochMillis", {
    value: undefined,
    enumerable: false,
    writable: true
  });
  Object.defineProperty(self, "partsAdjusted", {
    value: undefined,
    enumerable: false,
    writable: true
  });
  return self;
};
var isDateTime = (u) => hasProperty(u, TypeId8);
var isTimeZone = (u) => hasProperty(u, TimeZoneTypeId);
var isTimeZoneOffset = (u) => isTimeZone(u) && u._tag === "Offset";
var isTimeZoneNamed = (u) => isTimeZone(u) && u._tag === "Named";
var isUtc = (self) => self._tag === "Utc";
var isZoned = (self) => self._tag === "Zoned";
var Equivalence2 = /* @__PURE__ */ make3((a, b) => a.epochMilliseconds === b.epochMilliseconds);
var Order = /* @__PURE__ */ make4((self, that) => self.epochMilliseconds < that.epochMilliseconds ? -1 : self.epochMilliseconds > that.epochMilliseconds ? 1 : 0);
var makeUtc = (epochMillis) => {
  const self = Object.create(ProtoUtc);
  self.epochMilliseconds = epochMillis;
  Object.defineProperty(self, "partsUtc", {
    value: undefined,
    enumerable: false,
    writable: true
  });
  return self;
};
var fromDateUnsafe = (date) => {
  const epochMillis = date.getTime();
  if (Number.isNaN(epochMillis)) {
    throw new IllegalArgumentError2("Invalid date");
  }
  return makeUtc(epochMillis);
};
var makeUnsafe4 = (input) => {
  if (isDateTime(input)) {
    return input;
  } else if (input instanceof Date) {
    return fromDateUnsafe(input);
  } else if (typeof input === "object") {
    if ("epochMilliseconds" in input) {
      return fromDateUnsafe(new Date(input.epochMilliseconds));
    }
    const date = new Date(0);
    setPartsDate(date, input);
    return fromDateUnsafe(date);
  } else if (typeof input === "string" && !hasZone(input)) {
    return fromDateUnsafe(new Date(input + "Z"));
  }
  return fromDateUnsafe(new Date(input));
};
var hasZone = (input) => /Z|GMT|[+-]\d{2}$|[+-]\d{2}:?\d{2}$|\]$/.test(input);
var minEpochMillis = -8640000000000000 + 12 * 60 * 60 * 1000;
var maxEpochMillis = 8640000000000000 - 14 * 60 * 60 * 1000;
var makeZonedUnsafe = (input, options) => {
  let timeZoneOption = options?.timeZone;
  if (timeZoneOption === undefined && isDateTime(input) && isZoned(input)) {
    return input;
  }
  const self = makeUnsafe4(input);
  if (self.epochMilliseconds < minEpochMillis || self.epochMilliseconds > maxEpochMillis) {
    throw new RangeError(`Epoch millis out of range: ${self.epochMilliseconds}`);
  }
  if (timeZoneOption === undefined && typeof input === "object" && "timeZoneId" in input) {
    timeZoneOption = input.timeZoneId;
  }
  let zone;
  if (timeZoneOption === undefined) {
    const offset = new Date(self.epochMilliseconds).getTimezoneOffset() * -60 * 1000;
    zone = zoneMakeOffset(offset);
  } else if (isTimeZone(timeZoneOption)) {
    zone = timeZoneOption;
  } else if (typeof timeZoneOption === "number") {
    zone = zoneMakeOffset(timeZoneOption);
  } else {
    const parsedZone = zoneFromString(timeZoneOption);
    if (isNone2(parsedZone)) {
      throw new IllegalArgumentError2(`Invalid time zone: ${timeZoneOption}`);
    }
    zone = parsedZone.value;
  }
  if (options?.adjustForTimeZone !== true) {
    return makeZonedProto(self.epochMilliseconds, zone, self.partsUtc);
  }
  return makeZonedFromAdjusted(self.epochMilliseconds, zone, options?.disambiguation ?? "compatible");
};
var makeZoned = /* @__PURE__ */ liftThrowable(makeZonedUnsafe);
var make8 = /* @__PURE__ */ liftThrowable(makeUnsafe4);
var zonedStringRegExp = /^(.{17,35})\[(.+)\]$/;
var makeZonedFromString = (input) => {
  const match5 = zonedStringRegExp.exec(input);
  if (match5 === null) {
    const offset = parseOffset(input);
    return offset !== null ? makeZoned(input, {
      timeZone: offset
    }) : none2();
  }
  const [, isoString, timeZone] = match5;
  return makeZoned(isoString, {
    timeZone
  });
};
var toUtc = (self) => makeUtc(self.epochMilliseconds);
var validZoneCache = /* @__PURE__ */ new Map;
var formatOptions = {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  timeZoneName: "longOffset",
  fractionalSecondDigits: 3,
  hourCycle: "h23"
};
var zoneMakeIntl = (format2) => {
  const zoneId = format2.resolvedOptions().timeZone;
  if (validZoneCache.has(zoneId)) {
    return validZoneCache.get(zoneId);
  }
  const zone = Object.create(ProtoTimeZoneNamed);
  zone.id = zoneId;
  zone.format = format2;
  validZoneCache.set(zoneId, zone);
  return zone;
};
var zoneMakeNamedUnsafe = (zoneId) => {
  if (validZoneCache.has(zoneId)) {
    return validZoneCache.get(zoneId);
  }
  try {
    return zoneMakeIntl(new Intl.DateTimeFormat("en-US", {
      ...formatOptions,
      timeZone: zoneId
    }));
  } catch {
    throw new IllegalArgumentError2(`Invalid time zone: ${zoneId}`);
  }
};
var zoneMakeOffset = (offset) => {
  const zone = Object.create(ProtoTimeZoneOffset);
  zone.offset = offset;
  return zone;
};
var zoneMakeNamed = /* @__PURE__ */ liftThrowable(zoneMakeNamedUnsafe);
var offsetZoneRegExp = /^(?:GMT|[+-])/;
var zoneFromString = (zone) => {
  if (offsetZoneRegExp.test(zone)) {
    const offset = parseOffset(zone);
    return offset === null ? none2() : some2(zoneMakeOffset(offset));
  }
  return zoneMakeNamed(zone);
};
var zoneToString = (self) => {
  if (self._tag === "Offset") {
    return offsetToString(self.offset);
  }
  return self.id;
};
var toDateUtc = (self) => new Date(self.epochMilliseconds);
var toDate = (self) => {
  if (self._tag === "Utc") {
    return new Date(self.epochMilliseconds);
  } else if (self.zone._tag === "Offset") {
    return new Date(self.epochMilliseconds + self.zone.offset);
  } else if (self.adjustedEpochMilliseconds !== undefined) {
    return new Date(self.adjustedEpochMilliseconds);
  }
  const parts = self.zone.format.formatToParts(self.epochMilliseconds).filter((_) => _.type !== "literal");
  const date = new Date(0);
  date.setUTCFullYear(Number(parts[2].value), Number(parts[0].value) - 1, Number(parts[1].value));
  date.setUTCHours(Number(parts[3].value), Number(parts[4].value), Number(parts[5].value), Number(parts[6].value));
  self.adjustedEpochMilliseconds = date.getTime();
  return date;
};
var zonedOffset = (self) => {
  const date = toDate(self);
  return date.getTime() - toEpochMillis(self);
};
var offsetToString = (offset) => {
  const abs = Math.abs(offset);
  let hours2 = Math.floor(abs / (60 * 60 * 1000));
  let minutes2 = Math.round(abs % (60 * 60 * 1000) / (60 * 1000));
  if (minutes2 === 60) {
    hours2 += 1;
    minutes2 = 0;
  }
  return `${offset < 0 ? "-" : "+"}${String(hours2).padStart(2, "0")}:${String(minutes2).padStart(2, "0")}`;
};
var zonedOffsetIso = (self) => offsetToString(zonedOffset(self));
var toEpochMillis = (self) => self.epochMilliseconds;
var setPartsDate = (date, parts) => {
  if (parts.year !== undefined) {
    date.setUTCFullYear(parts.year);
  }
  if (parts.month !== undefined) {
    date.setUTCMonth(parts.month - 1);
  }
  if (parts.day !== undefined) {
    date.setUTCDate(parts.day);
  }
  if (parts.weekDay !== undefined) {
    const diff = parts.weekDay - date.getUTCDay();
    date.setUTCDate(date.getUTCDate() + diff);
  }
  if (parts.hour !== undefined) {
    date.setUTCHours(parts.hour);
  }
  if (parts.minute !== undefined) {
    date.setUTCMinutes(parts.minute);
  }
  if (parts.second !== undefined) {
    date.setUTCSeconds(parts.second);
  }
  if (parts.millisecond !== undefined) {
    date.setUTCMilliseconds(parts.millisecond);
  }
};
var constDayMillis = 24 * 60 * 60 * 1000;
var makeZonedFromAdjusted = (adjustedMillis, zone, disambiguation) => {
  if (zone._tag === "Offset") {
    return makeZonedProto(adjustedMillis - zone.offset, zone);
  }
  const beforeOffset = calculateNamedOffset(adjustedMillis - constDayMillis, adjustedMillis, zone);
  const afterOffset = calculateNamedOffset(adjustedMillis + constDayMillis, adjustedMillis, zone);
  if (beforeOffset === afterOffset) {
    return makeZonedProto(adjustedMillis - beforeOffset, zone);
  }
  const isForwards = beforeOffset < afterOffset;
  const transitionMillis = beforeOffset - afterOffset;
  if (isForwards) {
    const currentAfterOffset = calculateNamedOffset(adjustedMillis - afterOffset, adjustedMillis, zone);
    if (currentAfterOffset === afterOffset) {
      return makeZonedProto(adjustedMillis - afterOffset, zone);
    }
    const before = makeZonedProto(adjustedMillis - beforeOffset, zone);
    const beforeAdjustedMillis = toDate(before).getTime();
    if (adjustedMillis !== beforeAdjustedMillis) {
      switch (disambiguation) {
        case "reject": {
          const formatted = new Date(adjustedMillis).toISOString();
          throw new RangeError(`Gap time: ${formatted} does not exist in time zone ${zone.id}`);
        }
        case "earlier":
          return makeZonedProto(adjustedMillis - afterOffset, zone);
        case "compatible":
        case "later":
          return before;
      }
    }
    return before;
  }
  const currentBeforeOffset = calculateNamedOffset(adjustedMillis - beforeOffset, adjustedMillis, zone);
  if (currentBeforeOffset === beforeOffset) {
    if (disambiguation === "earlier" || disambiguation === "compatible") {
      return makeZonedProto(adjustedMillis - beforeOffset, zone);
    }
    const laterOffset = calculateNamedOffset(adjustedMillis - beforeOffset + transitionMillis, adjustedMillis + transitionMillis, zone);
    if (laterOffset === beforeOffset) {
      return makeZonedProto(adjustedMillis - beforeOffset, zone);
    }
    if (disambiguation === "reject") {
      const formatted = new Date(adjustedMillis).toISOString();
      throw new RangeError(`Ambiguous time: ${formatted} occurs twice in time zone ${zone.id}`);
    }
  }
  return makeZonedProto(adjustedMillis - afterOffset, zone);
};
var offsetRegExp = /([+-])(\d{2}):(\d{2})$/;
var parseOffset = (offset) => {
  const match5 = offsetRegExp.exec(offset);
  if (match5 === null) {
    return null;
  }
  const [, sign, hours2, minutes2] = match5;
  return (sign === "+" ? 1 : -1) * (Number(hours2) * 60 + Number(minutes2)) * 60 * 1000;
};
var calculateNamedOffset = (utcMillis, adjustedMillis, zone) => {
  const offset = zone.format.formatToParts(utcMillis).find((_) => _.type === "timeZoneName")?.value ?? "";
  if (offset === "GMT") {
    return 0;
  }
  const result2 = parseOffset(offset);
  if (result2 === null) {
    return zonedOffset(makeZonedProto(adjustedMillis, zone));
  }
  return result2;
};
var formatIso = (self) => toDateUtc(self).toISOString();
var formatIsoOffset = (self) => {
  const date = toDate(self);
  return self._tag === "Utc" ? date.toISOString() : `${date.toISOString().slice(0, -1)}${zonedOffsetIso(self)}`;
};
var formatIsoZoned = (self) => self.zone._tag === "Offset" ? formatIsoOffset(self) : `${formatIsoOffset(self)}[${self.zone.id}]`;

// node_modules/effect/dist/Number.js
var Number3 = globalThis.Number;
var remainder = /* @__PURE__ */ dual(2, (self, divisor) => {
  const selfString = self.toString();
  const divisorString = divisor.toString();
  if (selfString.includes("e") || divisorString.includes("e")) {
    if (!globalThis.Number.isFinite(self) || !globalThis.Number.isFinite(divisor) || divisor === 0) {
      return NaN;
    }
    return remainderWithScientificNotation(self, divisor);
  }
  const selfDecCount = (selfString.split(".")[1] || "").length;
  const divisorDecCount = (divisorString.split(".")[1] || "").length;
  const decCount = selfDecCount > divisorDecCount ? selfDecCount : divisorDecCount;
  const selfInt = parseInt(self.toFixed(decCount).replace(".", ""));
  const divisorInt = parseInt(divisor.toFixed(decCount).replace(".", ""));
  return selfInt % divisorInt / Math.pow(10, decCount);
});
function remainderWithScientificNotation(self, divisor) {
  const [selfCoefficient, selfExponent] = toScientificInteger(self);
  const [divisorCoefficient, divisorExponent] = toScientificInteger(divisor);
  const exponent = Math.min(selfExponent, divisorExponent);
  const selfInteger = selfCoefficient * BigInt(10) ** BigInt(selfExponent - exponent);
  const divisorInteger = divisorCoefficient * BigInt(10) ** BigInt(divisorExponent - exponent);
  const out = selfInteger % divisorInteger;
  if (out === BigInt(0)) {
    return self < 0 || Object.is(self, -0) ? -0 : 0;
  }
  const remainder2 = globalThis.Number(`${out}e${exponent}`);
  return remainder2 === 0 ? Math.sign(self) * globalThis.Number.MIN_VALUE : remainder2;
}
function toScientificInteger(n) {
  const scientific = Math.abs(n).toExponential();
  const eIndex = scientific.indexOf("e");
  const digits = scientific.slice(0, eIndex).replace(".", "");
  const coefficient = BigInt(digits) * (n < 0 ? -BigInt(1) : BigInt(1));
  return [coefficient, globalThis.Number(scientific.slice(eIndex + 1)) - digits.length + 1];
}
var ReducerMax = /* @__PURE__ */ make2((a, b) => Math.max(a, b), -Infinity);
var ReducerMin = /* @__PURE__ */ make2((a, b) => Math.min(a, b), Infinity);

// node_modules/effect/dist/String.js
var String2 = globalThis.String;
var trim = (self) => self.trim();

// node_modules/effect/dist/Pull.js
var catchDone = /* @__PURE__ */ dual(2, (effect, f) => catchCauseFilter(effect, filterDoneLeftover, (l) => f(l)));
var filterDone = /* @__PURE__ */ composePassthrough(findError2, (e) => isDone2(e) ? succeed2(e) : fail2(e));
var filterDoneLeftover = /* @__PURE__ */ composePassthrough(findError2, (e) => isDone2(e) ? succeed2(e.value) : fail2(e));
var matchEffect2 = /* @__PURE__ */ dual(2, (self, options) => matchCauseEffect(self, {
  onSuccess: options.onSuccess,
  onFailure: (cause) => {
    const halt = filterDone(cause);
    return !isFailure2(halt) ? options.onDone(halt.success.value) : options.onFailure(halt.failure);
  }
}));

// node_modules/effect/dist/Schedule.js
var TypeId9 = "~effect/Schedule";
var CurrentMetadata2 = /* @__PURE__ */ Reference("effect/Schedule/CurrentMetadata", {
  defaultValue: /* @__PURE__ */ constant({
    input: undefined,
    output: undefined,
    duration: zero,
    attempt: 0,
    start: 0,
    now: 0,
    elapsed: 0,
    elapsedSincePrevious: 0
  })
});
var ScheduleProto = {
  [TypeId9]: {
    _Out: identity,
    _In: identity,
    _Env: identity
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var isSchedule = (u) => hasProperty(u, TypeId9);
var fromStep = (step) => {
  const self = Object.create(ScheduleProto);
  self.step = step;
  return self;
};
var metadataFn = () => {
  let n = 0;
  let previous;
  let start;
  return (now, input) => {
    if (start === undefined)
      start = now;
    const elapsed = now - start;
    const elapsedSincePrevious = previous === undefined ? 0 : now - previous;
    previous = now;
    return {
      input,
      attempt: ++n,
      start,
      now,
      elapsed,
      elapsedSincePrevious
    };
  };
};
var fromStepWithMetadata = (step) => fromStep(map5(step, (f) => {
  const meta = metadataFn();
  return (now, input) => f(meta(now, input));
}));
var toStep = (schedule) => catchCause(schedule.step, (cause) => succeed3(() => failCause(cause)));
var toStepWithMetadata = (schedule) => clockWith((clock) => map5(toStep(schedule), (step) => {
  const metaFn = metadataFn();
  return (input) => suspend(() => {
    const now = clock.currentTimeMillisUnsafe();
    return flatMap3(step(now, input), ([output, duration]) => {
      const meta = metaFn(now, input);
      meta.output = output;
      meta.duration = duration;
      return as(sleep(duration), meta);
    });
  });
}));
var passthrough = (self) => fromStep(map5(toStep(self), (step) => (now, input) => matchEffect2(step(now, input), {
  onSuccess: (result2) => succeed3([input, result2[1]]),
  onFailure: failCause,
  onDone: () => done3(input)
})));
var recurs = (times) => while_(forever2, ({
  attempt
}) => succeed3(attempt <= times));
var spaced = (duration) => {
  const decoded = fromInputUnsafe(duration);
  return fromStepWithMetadata(succeed3((meta) => succeed3([meta.attempt - 1, decoded])));
};
var while_ = /* @__PURE__ */ dual(2, (self, predicate) => fromStep(map5(toStep(self), (step) => {
  const meta = metadataFn();
  return (now, input) => flatMap3(step(now, input), (result2) => {
    const [output, duration] = result2;
    const eff = predicate({
      ...meta(now, input),
      output,
      duration
    });
    return flatMap3(isEffect(eff) ? eff : succeed3(eff), (check) => check ? succeed3(result2) : done3(output));
  });
})));
var forever2 = /* @__PURE__ */ spaced(zero);

// node_modules/effect/dist/internal/layer.js
var provideLayer = (self, layer, options) => scopedWith((scope2) => flatMap3(options?.local ? buildWithMemoMap(layer, makeMemoMapUnsafe(), scope2) : buildWithScope(layer, scope2), (context2) => provideContext(self, context2)));
var provide3 = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, source, options) => isContext(source) ? provideContext(self, source) : provideLayer(self, Array.isArray(source) ? mergeAll2(...source) : source, options));

// node_modules/effect/dist/internal/schedule.js
var repeatOrElse = /* @__PURE__ */ dual(3, (self, schedule, orElse) => flatMap3(toStepWithMetadata(schedule), (step) => {
  let meta = CurrentMetadata2.defaultValue();
  return catch_(forever(tap(flatMap3(suspend(() => provideService(self, CurrentMetadata2, meta)), step), (meta_) => sync(() => {
    meta = meta_;
  })), {
    disableYield: true
  }), (error) => isDone(error) ? succeed3(error.value) : orElse(error, meta.attempt === 0 ? none2() : some2(meta)));
}));
var retryOrElse = /* @__PURE__ */ dual(3, (self, policy, orElse) => flatMap3(toStepWithMetadata(policy), (step) => {
  let meta = CurrentMetadata2.defaultValue();
  let lastError;
  const loop = catch_(suspend(() => provideService(self, CurrentMetadata2, meta)), (error) => {
    lastError = error;
    return flatMap3(step(error), (meta_) => {
      meta = meta_;
      return loop;
    });
  });
  return catchDone(loop, (out) => internalCall(() => orElse(lastError, out)));
}));
var repeat = /* @__PURE__ */ dual(2, (self, options) => {
  const schedule = typeof options === "function" ? options(identity) : isSchedule(options) ? options : buildFromOptions(options);
  return repeatOrElse(self, schedule, fail3);
});
var retry = /* @__PURE__ */ dual(2, (self, options) => {
  const schedule = typeof options === "function" ? options(identity) : isSchedule(options) ? options : buildFromOptions(options);
  return retryOrElse(self, schedule, fail3);
});
var scheduleFrom = /* @__PURE__ */ dual(3, (self, initial, schedule) => flatMap3(toStepWithMetadata(schedule), (step) => {
  let meta = CurrentMetadata2.defaultValue();
  const selfWithMeta = suspend(() => provideService(self, CurrentMetadata2, meta));
  return catch_(flatMap3(step(initial), (meta_) => {
    meta = meta_;
    const body = constant(flatMap3(selfWithMeta, step));
    return whileLoop({
      while: constTrue,
      body,
      step(meta_2) {
        meta = meta_2;
      }
    });
  }), (error) => isDone(error) ? succeed3(error.value) : fail3(error));
}));
var passthroughForever = /* @__PURE__ */ passthrough(forever2);
var buildFromOptions = (options) => {
  let schedule = options.schedule ? passthrough(options.schedule) : passthroughForever;
  if (options.while) {
    schedule = while_(schedule, ({
      input
    }) => {
      const applied = options.while(input);
      return isEffect(applied) ? applied : succeed3(applied);
    });
  }
  if (options.until) {
    schedule = while_(schedule, ({
      input
    }) => {
      const applied = options.until(input);
      return isEffect(applied) ? map5(applied, (b) => !b) : succeed3(!applied);
    });
  }
  if (options.times !== undefined) {
    schedule = while_(schedule, ({
      attempt
    }) => succeed3(attempt <= options.times));
  }
  return schedule;
};

// node_modules/effect/dist/internal/executionPlan.js
var makeEventEmitter = (onEvent, currentMetadata) => {
  let lastStepIndex = -1;
  let stepAttempt = 0;
  const emit = (event) => ignoreCause(onEvent(event));
  return {
    begin: clockWith((clock) => suspend(() => {
      const meta = currentMetadata();
      if (meta.stepIndex !== lastStepIndex) {
        lastStepIndex = meta.stepIndex;
        stepAttempt = 0;
      }
      stepAttempt++;
      const state = {
        attempt: meta.attempt,
        stepAttempt,
        stepIndex: meta.stepIndex,
        startNanos: clock.monotonicTimeNanosUnsafe()
      };
      return as(emit({
        _tag: "AttemptStart",
        attempt: state.attempt,
        stepAttempt: state.stepAttempt,
        stepIndex: state.stepIndex
      }), state);
    })),
    end: (state, exit2) => clockWith((clock) => {
      const duration = nanos(clock.monotonicTimeNanosUnsafe() - state.startNanos);
      return emit(exit2._tag === "Success" ? {
        _tag: "AttemptSuccess",
        attempt: state.attempt,
        stepAttempt: state.stepAttempt,
        stepIndex: state.stepIndex,
        duration
      } : {
        _tag: "AttemptFailure",
        attempt: state.attempt,
        stepAttempt: state.stepAttempt,
        stepIndex: state.stepIndex,
        duration,
        cause: exit2.cause
      });
    })
  };
};
var withExecutionPlan = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, plan, options) => suspend(() => {
  let i = 0;
  let meta = {
    attempt: 0,
    stepIndex: 0
  };
  const provideMeta = provideServiceEffect(CurrentMetadata, sync(() => {
    meta = {
      attempt: meta.attempt + 1,
      stepIndex: i
    };
    return meta;
  }));
  const emitter = options?.onEvent === undefined ? undefined : makeEventEmitter(options.onEvent, () => meta);
  const instrument = emitter === undefined ? identity : (attempt) => uninterruptibleMask((restore) => flatMap3(emitter.begin, (state) => onExit(restore(attempt), (exit2) => emitter.end(state, exit2))));
  let result2;
  return flatMap3(whileLoop({
    while: () => i < plan.steps.length && (result2 === undefined || isFailure2(result2)),
    body() {
      const step = plan.steps[i];
      let nextEffect = provideMeta(instrument(provide3(self, step.provide)));
      if (result2) {
        let attempted = false;
        const wrapped = nextEffect;
        nextEffect = suspend(() => {
          if (attempted)
            return wrapped;
          attempted = true;
          return fromResult(result2);
        });
        nextEffect = retry(nextEffect, scheduleFromStep(step, false));
      } else {
        const schedule = scheduleFromStep(step, true);
        nextEffect = schedule ? retry(nextEffect, schedule) : nextEffect;
      }
      return result(nextEffect);
    },
    step(result_) {
      result2 = result_;
      i++;
    }
  }), () => fromResult(result2));
}));
var scheduleFromStep = (step, first) => {
  if (!first) {
    return buildFromOptions({
      schedule: step.schedule ? step.schedule : step.attempts ? undefined : scheduleOnce,
      times: step.attempts,
      while: step.while
    });
  } else if (step.attempts === 1 || !(step.schedule || step.attempts)) {
    return;
  }
  return buildFromOptions({
    schedule: step.schedule,
    while: step.while,
    times: step.attempts ? step.attempts - 1 : undefined
  });
};
var scheduleOnce = /* @__PURE__ */ recurs(1);

// node_modules/effect/dist/Request.js
var TypeId10 = "~effect/Request";
var requestVariance = /* @__PURE__ */ byReferenceUnsafe({
  _E: (_) => _,
  _A: (_) => _,
  _R: (_) => _
});
var RequestPrototype = {
  ...StructuralProto,
  [TypeId10]: requestVariance
};
var makeEntry = (options) => options;

// node_modules/effect/dist/internal/request.js
var request = /* @__PURE__ */ dual(2, (self, resolver) => {
  const withResolver = (resolver2) => callback((resume) => {
    const entry = addEntry(resolver2, self, resume, getCurrentFiber());
    return maybeRemoveEntry(resolver2, entry);
  });
  return isEffect(resolver) ? flatMap3(resolver, withResolver) : withResolver(resolver);
});
var requestUnsafe = (self, options) => {
  const entry = addEntry(options.resolver, self, options.onExit, {
    context: options.context,
    currentScheduler: get(options.context, Scheduler)
  });
  return () => removeEntryUnsafe(options.resolver, entry);
};
var batchPool = [];
var pendingBatches = /* @__PURE__ */ new WeakMap;
var addEntry = (resolver, request2, resume, fiber2) => {
  let batchMap = pendingBatches.get(resolver);
  if (!batchMap) {
    batchMap = new Map;
    pendingBatches.set(resolver, batchMap);
  }
  let batch;
  let completed = false;
  const entry = makeEntry({
    request: request2,
    context: fiber2.context,
    uninterruptible: false,
    completeUnsafe(effect) {
      if (completed)
        return;
      completed = true;
      resume(effect);
      batch?.entrySet.delete(entry);
    }
  });
  if (resolver.preCheck !== undefined && !resolver.preCheck(entry)) {
    return entry;
  }
  const key = resolver.batchKey(entry);
  batch = batchMap.get(key);
  if (!batch) {
    if (batchPool.length > 0) {
      batch = batchPool.pop();
      batch.key = key;
      batch.resolver = resolver;
      batch.map = batchMap;
    } else {
      const newBatch = {
        key,
        resolver,
        map: batchMap,
        entrySet: new Set,
        entries: new Set,
        delayEffect: flatMap3(suspend(() => newBatch.resolver.delay), (_) => runBatch(newBatch)),
        run: onExit(suspend(() => newBatch.resolver.runAll(Array.from(newBatch.entries), newBatch.key)), (exit2) => {
          for (const entry2 of newBatch.entrySet) {
            entry2.completeUnsafe(exit2._tag === "Success" ? exitDie(new Error("Effect.request: RequestResolver did not complete request", {
              cause: entry2.request
            })) : exit2);
          }
          newBatch.entries.clear();
          if (batchPool.length < 128) {
            newBatch.entrySet.clear();
            newBatch.key = undefined;
            newBatch.fiber = undefined;
            newBatch.resolver = undefined;
            newBatch.map = undefined;
            batchPool.push(newBatch);
          }
          return void_;
        })
      };
      batch = newBatch;
    }
    batchMap.set(key, batch);
    batch.fiber = runForkWith(fiber2.context)(batch.delayEffect, {
      scheduler: fiber2.currentScheduler
    });
  }
  batch.entrySet.add(entry);
  batch.entries.add(entry);
  if (batch.resolver.collectWhile(batch.entries))
    return entry;
  batch.fiber.interruptUnsafe(fiber2.id);
  batch.fiber = runForkWith(fiber2.context)(runBatch(batch), {
    scheduler: fiber2.currentScheduler
  });
  return entry;
};
var removeEntryUnsafe = (resolver, entry) => {
  if (entry.uninterruptible)
    return;
  const batchMap = pendingBatches.get(resolver);
  if (!batchMap)
    return;
  const key = resolver.batchKey(entry);
  const batch = batchMap.get(key);
  if (!batch)
    return;
  batch.entries.delete(entry);
  batch.entrySet.delete(entry);
  if (batch.entries.size === 0) {
    batchMap.delete(key);
    batch.fiber?.interruptUnsafe();
  }
};
var maybeRemoveEntry = (resolver, entry) => sync(() => removeEntryUnsafe(resolver, entry));
function runBatch(batch) {
  if (!batch.map.has(batch.key))
    return void_;
  batch.map.delete(batch.key);
  return batch.run;
}

// node_modules/effect/dist/Metric.js
var CurrentMetricAttributesKey = "effect/Metric/CurrentMetricAttributes";
var CurrentMetricAttributes = /* @__PURE__ */ Reference(CurrentMetricAttributesKey, {
  defaultValue: () => ({})
});
var MetricRegistryKey = "~effect/observability/Metric/MetricRegistryKey";
var MetricRegistry = /* @__PURE__ */ Reference(MetricRegistryKey, {
  defaultValue: () => new Map
});
var TypeId11 = "~effect/observability/Metric";

class Metric$ {
  [TypeId11] = TypeId11;
  #metadataCache = /* @__PURE__ */ new WeakMap;
  #metadata;
  id;
  description;
  attributes;
  constructor(id, description, attributes) {
    this.id = id;
    this.description = description;
    this.attributes = attributes;
  }
  valueUnsafe(context2) {
    return this.hook(context2).get(context2);
  }
  modifyUnsafe(input, context2) {
    return this.hook(context2).modify(input, context2);
  }
  updateUnsafe(input, context2) {
    return this.hook(context2).update(input, context2);
  }
  hook(context2) {
    const extraAttributes = get(context2, CurrentMetricAttributes);
    if (Object.keys(extraAttributes).length === 0) {
      if (isNotUndefined(this.#metadata)) {
        return this.#metadata.hooks;
      }
      this.#metadata = this.getOrCreate(context2, this.attributes);
      return this.#metadata.hooks;
    }
    const mergedAttributes = mergeAttributes(this.attributes, extraAttributes);
    let metadata = this.#metadataCache.get(mergedAttributes);
    if (isNotUndefined(metadata)) {
      return metadata.hooks;
    }
    metadata = this.getOrCreate(context2, mergedAttributes);
    this.#metadataCache.set(mergedAttributes, metadata);
    return metadata.hooks;
  }
  getOrCreate(context2, attributes) {
    const key = makeKey(this, attributes);
    const registry = get(context2, MetricRegistry);
    if (registry.has(key)) {
      return registry.get(key);
    }
    const hooks = this.createHooks();
    const meta = {
      id: this.id,
      type: this.type,
      description: this.description,
      attributes: attributesToRecord(attributes),
      hooks
    };
    registry.set(key, meta);
    return meta;
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
}
var bigint03 = /* @__PURE__ */ BigInt(0);

class CounterMetric extends Metric$ {
  type = "Counter";
  #bigint;
  #incremental;
  constructor(id, options) {
    super(id, options?.description, attributesToRecord(options?.attributes));
    this.#bigint = options?.bigint ?? false;
    this.#incremental = options?.incremental ?? false;
  }
  createHooks() {
    let count = this.#bigint ? bigint03 : 0;
    const canUpdate = this.#incremental ? this.#bigint ? (value) => value >= bigint03 : (value) => value >= 0 : (_value) => true;
    const update = (value) => {
      if (canUpdate(value)) {
        count = count + value;
      }
    };
    return makeHooks(() => ({
      count,
      incremental: this.#incremental
    }), update);
  }
}

class GaugeMetric extends Metric$ {
  type = "Gauge";
  #bigint;
  constructor(id, options) {
    super(id, options?.description, attributesToRecord(options?.attributes));
    this.#bigint = options?.bigint ?? false;
  }
  createHooks() {
    let value = this.#bigint ? BigInt(0) : 0;
    const update = (input) => {
      value = input;
    };
    const modify = (input) => {
      value = value + input;
    };
    return makeHooks(() => ({
      value
    }), update, modify);
  }
}

class FrequencyMetric extends Metric$ {
  type = "Frequency";
  #preregisteredWords;
  constructor(id, options) {
    super(id, options?.description, attributesToRecord(options?.attributes));
    this.#preregisteredWords = options?.preregisteredWords;
  }
  createHooks() {
    const occurrences = new Map;
    if (isNotUndefined(this.#preregisteredWords)) {
      for (const word of this.#preregisteredWords) {
        occurrences.set(word, 0);
      }
    }
    const update = (word) => {
      const count = occurrences.get(word) ?? 0;
      occurrences.set(word, count + 1);
    };
    return makeHooks(() => ({
      occurrences
    }), update);
  }
}

class HistogramMetric extends Metric$ {
  type = "Histogram";
  #boundaries;
  constructor(id, options) {
    super(id, options?.description, attributesToRecord(options?.attributes));
    this.#boundaries = options.boundaries;
  }
  createHooks() {
    const bounds = this.#boundaries;
    const size = bounds.length;
    const values = new Uint32Array(size + 1);
    const boundaries = new Float64Array(size);
    let count = 0;
    let sum2 = 0;
    let min3 = Number.MAX_VALUE;
    let max3 = -Number.MAX_VALUE;
    map4(sort(bounds, Number2), (n, i) => {
      boundaries[i] = n;
    });
    const update = (value) => {
      let from = 0;
      let to = size;
      while (from !== to) {
        const mid = Math.floor(from + (to - from) / 2);
        const boundary = boundaries[mid];
        if (value <= boundary) {
          to = mid;
        } else {
          from = mid;
        }
        if (to === from + 1) {
          if (value <= boundaries[from]) {
            to = from;
          } else {
            from = to;
          }
        }
      }
      values[from] = values[from] + 1;
      count = count + 1;
      sum2 = sum2 + value;
      if (value < min3) {
        min3 = value;
      }
      if (value > max3) {
        max3 = value;
      }
    };
    const getBuckets = () => {
      const builder = allocate(size);
      let cumulated = 0;
      for (let i = 0;i < size; i++) {
        const boundary = boundaries[i];
        const value = values[i];
        cumulated = cumulated + value;
        builder[i] = [boundary, cumulated];
      }
      return builder;
    };
    return makeHooks(() => ({
      buckets: getBuckets(),
      count,
      min: min3,
      max: max3,
      sum: sum2
    }), update);
  }
}

class SummaryMetric extends Metric$ {
  type = "Summary";
  #maxAge;
  #maxSize;
  #quantiles;
  constructor(id, options) {
    super(id, options?.description, attributesToRecord(options?.attributes));
    this.#maxAge = Math.max(toMillis(fromInputUnsafe(options.maxAge)), 0);
    this.#maxSize = options.maxSize;
    this.#quantiles = options.quantiles;
  }
  createHooks() {
    const sortedQuantiles = sort(this.#quantiles, Number2);
    const observations = allocate(this.#maxSize);
    for (const quantile of this.#quantiles) {
      if (quantile < 0 || quantile > 1) {
        throw new Error(`Quantile must be between 0 and 1, found: ${quantile}`);
      }
    }
    let head = 0;
    let count = 0;
    let sum2 = 0;
    let min3 = Number.MAX_VALUE;
    let max3 = -Number.MAX_VALUE;
    const snapshot = (now) => {
      const builder = [];
      let i = 0;
      while (i < this.#maxSize) {
        const observation = observations[i];
        if (isNotUndefined(observation)) {
          const [timestamp, value] = observation;
          const age = now - timestamp;
          if (age >= 0 && age <= this.#maxAge) {
            builder.push(value);
          }
        }
        i = i + 1;
      }
      const samples = sort(builder, Number2);
      const sampleSize = samples.length;
      if (sampleSize === 0) {
        return sortedQuantiles.map((q) => [q, undefined]);
      }
      return sortedQuantiles.map((q) => {
        if (q <= 0)
          return [q, samples[0]];
        if (q >= 1)
          return [q, samples[sampleSize - 1]];
        const index = Math.ceil(q * sampleSize) - 1;
        return [q, samples[index]];
      });
    };
    const observe = (value, timestamp) => {
      if (this.#maxSize > 0) {
        const target = head % this.#maxSize;
        observations[target] = [timestamp, value];
        head = head + 1;
      }
      count = count + 1;
      sum2 = sum2 + value;
      if (value < min3) {
        min3 = value;
      }
      if (value > max3) {
        max3 = value;
      }
    };
    const get2 = (context2) => {
      const clock = get(context2, ClockRef);
      const quantiles = snapshot(clock.currentTimeMillisUnsafe());
      return {
        quantiles,
        count,
        min: min3,
        max: max3,
        sum: sum2
      };
    };
    const update = ([value, timestamp]) => observe(value, timestamp);
    return makeHooks(get2, update);
  }
}
var update = /* @__PURE__ */ dual(2, (self, input) => contextWith((services) => sync(() => self.updateUnsafe(input, services))));
function makeKey(metric, attributes) {
  let key = `${metric.type}:${metric.id}`;
  if (isNotUndefined(metric.description)) {
    key += `:${metric.description}`;
  }
  if (isNotUndefined(attributes)) {
    key += `:${serializeAttributes(attributes)}`;
  }
  return key;
}
function makeHooks(get2, update2, modify) {
  return {
    get: get2,
    update: update2,
    modify: modify ?? update2
  };
}
function serializeAttributes(attributes) {
  return JSON.stringify(Array.isArray(attributes) ? attributes : Object.entries(attributes));
}
function mergeAttributes(self, other) {
  return {
    ...attributesToRecord(self),
    ...attributesToRecord(other)
  };
}
function attributesToRecord(attributes) {
  if (isNotUndefined(attributes) && Array.isArray(attributes)) {
    return attributes.reduce((acc, [key, value]) => {
      assignProperty(acc, key, value);
      return acc;
    }, {});
  }
  return attributes;
}

// node_modules/effect/dist/Effect.js
var TypeId12 = EffectTypeId;
var isEffect2 = isEffect;
var all2 = all;
var partition3 = partition2;
var reduce2 = reduce;
var validate2 = validate;
var findFirst2 = findFirst;
var findFirstFilter2 = findFirstFilter;
var forEach2 = forEach;
var whileLoop2 = whileLoop;
var promise2 = promise;
var tryPromise2 = tryPromise;
var succeed6 = succeed3;
var succeedNone2 = succeedNone;
var succeedSome2 = succeedSome;
var suspend2 = suspend;
var sync2 = sync;
var void_3 = void_;
var undefined_2 = undefined_;
var callback2 = callback;
var never2 = never;
var Do2 = Do;
var bindTo3 = bindTo2;
var let_3 = let_2;
var bind3 = bind2;
var gen2 = gen;
var fail5 = fail3;
var failSync2 = failSync;
var failCause3 = failCause;
var failCauseSync2 = failCauseSync;
var die2 = die;
var try_3 = try_2;
var yieldNow2 = yieldNow;
var yieldNowWith2 = yieldNowWith;
var withFiber2 = withFiber;
var fromResult2 = fromResult;
var fromOption3 = fromOption2;
var transposeOption2 = transposeOption;
var fromNullishOr3 = fromNullishOr2;
var flatMap4 = flatMap3;
var flatten4 = flatten3;
var andThen2 = andThen;
var tap2 = tap;
var result2 = result;
var option2 = option;
var exit2 = exit;
var map7 = map5;
var as2 = as;
var asSome2 = asSome;
var asVoid2 = asVoid;
var flip2 = flip;
var zip2 = zip;
var zipWith2 = zipWith;
var catch_2 = catch_;
var catchTag2 = catchTag;
var catchTags2 = catchTags;
var catchReason2 = catchReason;
var catchReasons2 = catchReasons;
var unwrapReason2 = unwrapReason;
var catchCause2 = catchCause;
var catchDefect2 = catchDefect;
var catchIf2 = catchIf;
var catchFilter2 = catchFilter;
var catchNoSuchElement2 = catchNoSuchElement;
var catchCauseIf2 = catchCauseIf;
var catchCauseFilter2 = catchCauseFilter;
var mapError3 = mapError2;
var mapBoth2 = mapBoth;
var orDie2 = orDie;
var tapError2 = tapError;
var tapErrorTag2 = tapErrorTag;
var tapCause2 = tapCause;
var tapCauseIf2 = tapCauseIf;
var tapCauseFilter2 = tapCauseFilter;
var tapDefect2 = tapDefect;
var eventually2 = eventually;
var retry2 = retry;
var retryOrElse2 = retryOrElse;
var sandbox2 = sandbox;
var ignore2 = ignore;
var ignoreCause2 = ignoreCause;
var withExecutionPlan2 = withExecutionPlan;
var withErrorReporting2 = withErrorReporting;
var orElseSucceed2 = orElseSucceed;
var firstSuccessOf2 = firstSuccessOf;
var timeout2 = timeout;
var timeoutOption2 = timeoutOption;
var timeoutOrElse2 = timeoutOrElse;
var delay2 = delay;
var sleep2 = sleep;
var timed2 = timed;
var raceAll2 = raceAll;
var raceAllFirst2 = raceAllFirst;
var race2 = race;
var raceFirst2 = raceFirst;
var filter5 = filter3;
var filterMap2 = filterMap;
var filterMapEffect2 = filterMapEffect;
var filterOrElse2 = filterOrElse;
var filterMapOrElse2 = filterMapOrElse;
var filterOrFail2 = filterOrFail;
var filterMapOrFail2 = filterMapOrFail;
var when2 = when;
var match5 = match4;
var matchEager2 = matchEager;
var matchCause2 = matchCause;
var matchCauseEager2 = matchCauseEager;
var matchCauseEffectEager2 = matchCauseEffectEager;
var matchCauseEffect2 = matchCauseEffect;
var matchEffect3 = matchEffect;
var isFailure5 = isFailure3;
var isSuccess5 = isSuccess3;
var context2 = context;
var contextWith2 = contextWith;
var provide4 = provide3;
var provideContext2 = provideContext;
var setContext2 = setContext;
var service2 = service;
var serviceOption2 = serviceOption;
var updateContext2 = updateContext;
var updateService2 = updateService;
var updateServiceScoped2 = updateServiceScoped;
var provideService2 = provideService;
var provideServiceEffect2 = provideServiceEffect;
var scope2 = scope;
var scoped2 = scoped;
var scopedWith2 = scopedWith;
var acquireRelease2 = acquireRelease;
var acquireDisposable2 = acquireDisposable;
var acquireUseRelease2 = acquireUseRelease;
var addFinalizer2 = addFinalizer;
var ensuring2 = ensuring;
var onError2 = onError;
var onErrorIf2 = onErrorIf;
var onErrorFilter2 = onErrorFilter;
var onExitPrimitive2 = onExitPrimitive;
var onExit2 = onExit;
var onExitIf2 = onExitIf;
var onExitFilter2 = onExitFilter;
var cached2 = cached;
var cachedWithTTL2 = cachedWithTTL;
var cachedInvalidateWithTTL2 = cachedInvalidateWithTTL;
var interrupt2 = interrupt;
var interruptible2 = interruptible;
var onInterrupt2 = onInterrupt;
var uninterruptible2 = uninterruptible;
var uninterruptibleMask2 = uninterruptibleMask;
var interruptibleMask2 = interruptibleMask;
var abortSignal2 = abortSignal;
var forever3 = forever;
var repeat2 = repeat;
var repeatOrElse2 = repeatOrElse;
var replicate2 = replicate;
var replicateEffect2 = replicateEffect;
var schedule = /* @__PURE__ */ dual(2, (self, schedule2) => scheduleFrom2(self, undefined, schedule2));
var scheduleFrom2 = scheduleFrom;
var tracer2 = tracer;
var withTracer2 = withTracer;
var withTracerEnabled2 = withTracerEnabled;
var withTracerTiming2 = withTracerTiming;
var annotateSpans2 = annotateSpans;
var annotateCurrentSpan2 = annotateCurrentSpan;
var currentSpan2 = currentSpan;
var currentParentSpan2 = currentParentSpan;
var spanAnnotations2 = spanAnnotations;
var spanLinks2 = spanLinks;
var linkSpans2 = linkSpans;
var makeSpan2 = makeSpan;
var makeSpanScoped2 = makeSpanScoped;
var useSpan2 = useSpan;
var withSpan2 = withSpan;
var withSpanScoped2 = withSpanScoped;
var withParentSpan2 = withParentSpan;
var request2 = request;
var requestUnsafe2 = requestUnsafe;
var forkChild2 = forkChild;
var forkIn2 = forkIn;
var forkScoped2 = forkScoped;
var forkDetach2 = forkDetach;
var awaitAllChildren2 = awaitAllChildren;
var fiber2 = fiber;
var fiberId2 = fiberId;
var runFork2 = runFork;
var runForkWith2 = runForkWith;
var runCallbackWith2 = runCallbackWith;
var runCallback2 = runCallback;
var runPromise2 = runPromise;
var runPromiseWith2 = runPromiseWith;
var runPromiseExit2 = runPromiseExit;
var runPromiseExitWith2 = runPromiseExitWith;
var runSync2 = runSync;
var runSyncWith2 = runSyncWith;
var runSyncExit2 = runSyncExit;
var runSyncExitWith2 = runSyncExitWith;
var fnUntraced2 = fnUntraced;
var fn2 = fn;
var clockWith2 = clockWith;
var logWithLevel2 = logWithLevel;
var log = /* @__PURE__ */ logWithLevel();
var logFatal = /* @__PURE__ */ logWithLevel("Fatal");
var logWarning = /* @__PURE__ */ logWithLevel("Warn");
var logError = /* @__PURE__ */ logWithLevel("Error");
var logInfo = /* @__PURE__ */ logWithLevel("Info");
var logDebug = /* @__PURE__ */ logWithLevel("Debug");
var logTrace = /* @__PURE__ */ logWithLevel("Trace");
var withLogger = /* @__PURE__ */ dual(2, (effect, logger) => updateService(effect, CurrentLoggers, (loggers) => new Set([...loggers, logger])));
var annotateLogs = /* @__PURE__ */ dual((args2) => isEffect2(args2[0]), (effect, ...args2) => updateService(effect, CurrentLogAnnotations2, (annotations) => {
  const newAnnotations = args2.length === 1 ? {
    ...annotations,
    ...args2[0]
  } : {
    ...annotations
  };
  if (args2.length === 1) {
    return newAnnotations;
  } else {
    assignProperty(newAnnotations, args2[0], args2[1]);
  }
  return newAnnotations;
}));
var annotateLogsScoped2 = annotateLogsScoped;
var withLogSpan = /* @__PURE__ */ dual(2, (effect, label) => flatMap3(currentTimeMillis, (now) => updateService(effect, CurrentLogSpans2, (spans) => {
  const span = [label, now];
  return [span, ...spans];
})));
var track = /* @__PURE__ */ dual((args2) => isEffect2(args2[0]), (self, metric, f) => onExit2(self, (exit3) => {
  const input = f === undefined ? exit3 : internalCall(() => f(exit3));
  return update(metric, input);
}));
var trackSuccesses = /* @__PURE__ */ dual((args2) => isEffect2(args2[0]), (self, metric, f) => tap2(self, (value) => {
  const input = f === undefined ? value : f(value);
  return update(metric, input);
}));
var trackErrors = /* @__PURE__ */ dual((args2) => isEffect2(args2[0]), (self, metric, f) => tapError2(self, (error) => {
  const input = f === undefined ? error : internalCall(() => f(error));
  return update(metric, input);
}));
var trackDefects = /* @__PURE__ */ dual((args2) => isEffect2(args2[0]), (self, metric, f) => tapDefect2(self, (defect) => {
  const input = f === undefined ? defect : internalCall(() => f(defect));
  return update(metric, input);
}));
var trackDuration = /* @__PURE__ */ dual((args2) => isEffect2(args2[0]), (self, metric, f) => clockWith2((clock) => {
  const startTime = clock.monotonicTimeNanosUnsafe();
  return onExit2(self, () => {
    const endTime = clock.monotonicTimeNanosUnsafe();
    const duration = subtract(fromInputUnsafe(endTime), fromInputUnsafe(startTime));
    const input = f === undefined ? duration : internalCall(() => f(duration));
    return update(metric, input);
  });
}));

class Transaction extends (/* @__PURE__ */ Service()("effect/Effect/Transaction")) {
}
var tx = (effect) => withFiber2((fiber3) => {
  if (fiber3.context.mapUnsafe.has(Transaction.key)) {
    return effect;
  }
  const state = {
    journal: new Map,
    retry: false
  };
  let result3;
  return uninterruptibleMask2((restore) => flatMap4(whileLoop2({
    while: () => !result3,
    body: constant(restore(effect).pipe(provideService2(Transaction, state), tapCause2(() => {
      if (!state.retry)
        return void_3;
      return restore(awaitPendingTransaction(state));
    }), exit2)),
    step(exit3) {
      if (state.retry || !isTransactionConsistent(state)) {
        return clearTransaction(state);
      }
      if (isSuccess4(exit3)) {
        commitTransaction(fiber3, state);
      } else {
        clearTransaction(state);
      }
      result3 = exit3;
    }
  }), () => result3));
});
var isTransactionConsistent = (state) => {
  for (const [ref, {
    version
  }] of state.journal) {
    if (ref.version !== version) {
      return false;
    }
  }
  return true;
};
var awaitPendingTransaction = (state) => suspend2(() => {
  const key = {};
  const refs = Array.from(state.journal.keys());
  const clearPending = () => {
    for (const clear of refs) {
      clear.pending.delete(key);
    }
  };
  return callback2((resume) => {
    const onCall = () => {
      clearPending();
      resume(void_3);
    };
    for (const ref of refs) {
      ref.pending.set(key, onCall);
    }
    return sync2(clearPending);
  });
});
function commitTransaction(fiber3, state) {
  for (const [ref, {
    value
  }] of state.journal) {
    if (value !== ref.value) {
      ref.version = ref.version + 1;
      ref.value = value;
    }
    for (const pending of ref.pending.values()) {
      fiber3.currentDispatcher.scheduleTask(pending, 0);
    }
    ref.pending.clear();
  }
}
function clearTransaction(state) {
  state.retry = false;
  state.journal.clear();
}
var txRetry = /* @__PURE__ */ flatMap4(Transaction, (state) => {
  state.retry = true;
  return interrupt2;
});
var effectify = (fn3, onError3, onSyncError) => (...args2) => callback2((resume) => {
  try {
    fn3(...args2, (err, result3) => {
      if (err) {
        resume(fail5(onError3 ? onError3(err, args2) : err));
      } else {
        resume(succeed6(result3));
      }
    });
  } catch (err) {
    resume(onSyncError ? fail5(onSyncError(err, args2)) : die2(err));
  }
});
var satisfiesSuccessType = () => (effect) => effect;
var satisfiesErrorType = () => (effect) => effect;
var satisfiesServicesType = () => (effect) => effect;
var mapEager2 = mapEager;
var mapErrorEager2 = mapErrorEager;
var mapBothEager2 = mapBothEager;
var flatMapEager2 = flatMapEager;
var catchEager2 = catchEager;
var fnUntracedEager2 = fnUntracedEager;
// node_modules/effect/dist/internal/redacted.js
var redactedRegistry = /* @__PURE__ */ new WeakMap;
var value = (self) => {
  if (redactedRegistry.has(self)) {
    return redactedRegistry.get(self);
  } else {
    throw new Error("Unable to get redacted value" + (self.label ? ` with label: "${self.label}"` : ""));
  }
};

// node_modules/effect/dist/Redacted.js
var TypeId13 = "~effect/data/Redacted";
var isRedacted = (u) => hasProperty(u, TypeId13);
var make9 = (value2, options) => {
  const self = Object.create(Proto4);
  if (options?.label) {
    self.label = options.label;
  }
  redactedRegistry.set(self, value2);
  return self;
};
var Proto4 = {
  [TypeId13]: {
    _A: (_) => _
  },
  label: undefined,
  ...PipeInspectableProto,
  toJSON() {
    return this.toString();
  },
  toString() {
    return `<redacted${isString(this.label) ? ":" + this.label : ""}>`;
  },
  [symbol]() {
    return hash(redactedRegistry.get(this));
  },
  [symbol2](that) {
    return isRedacted(that) && equals(redactedRegistry.get(this), redactedRegistry.get(that));
  }
};
var value2 = value;
var makeEquivalence3 = (isEquivalent) => make3((x, y) => isEquivalent(value2(x), value2(y)));
// node_modules/effect/dist/Schema.js
var exports_Schema = {};
__export(exports_Schema, {
  withDecodingDefaultTypeKey: () => withDecodingDefaultTypeKey,
  withDecodingDefaultType: () => withDecodingDefaultType,
  withDecodingDefaultKey: () => withDecodingDefaultKey,
  withDecodingDefault: () => withDecodingDefault,
  withConstructorDefault: () => withConstructorDefault2,
  toType: () => toType2,
  toTaggedUnion: () => toTaggedUnion,
  toStandardSchemaV1: () => toStandardSchemaV1,
  toStandardJSONSchemaV1: () => toStandardJSONSchemaV1,
  toRepresentation: () => toRepresentation2,
  toJsonSchemaDocument: () => toJsonSchemaDocument2,
  toIsoSource: () => toIsoSource,
  toIsoFocus: () => toIsoFocus,
  toIso: () => toIso,
  toFormatter: () => toFormatter,
  toEquivalence: () => toEquivalence2,
  toEncoderXml: () => toEncoderXml,
  toEncoded: () => toEncoded2,
  toDifferJsonPatch: () => toDifferJsonPatch,
  toCodecStringTree: () => toCodecStringTree,
  toCodecJsonAST: () => toCodecJsonAST,
  toCodecJson: () => toCodecJson,
  toCodecIso: () => toCodecIso,
  toCodecArrayFromSingle: () => toCodecArrayFromSingle,
  toArbitrary: () => toArbitrary,
  tagDefaultOmit: () => tagDefaultOmit,
  tag: () => tag,
  suspend: () => suspend3,
  revealCodec: () => revealCodec,
  revealBottom: () => revealBottom,
  resolveAnnotationsKey: () => resolveAnnotationsKey,
  resolveAnnotations: () => resolveAnnotations,
  requiredKey: () => requiredKey,
  required: () => required,
  refine: () => refine,
  readonlyKey: () => readonlyKey,
  overrideToFormatter: () => overrideToFormatter,
  overrideToEquivalence: () => overrideToEquivalence,
  overrideToCodecIso: () => overrideToCodecIso,
  optionalKey: () => optionalKey2,
  optional: () => optional2,
  mutableKey: () => mutableKey2,
  mutable: () => mutable,
  middlewareEncoding: () => middlewareEncoding2,
  middlewareDecoding: () => middlewareDecoding2,
  makeIsMultipleOf: () => makeIsMultipleOf,
  makeIsLessThanOrEqualTo: () => makeIsLessThanOrEqualTo,
  makeIsLessThan: () => makeIsLessThan,
  makeIsGreaterThanOrEqualTo: () => makeIsGreaterThanOrEqualTo,
  makeIsGreaterThan: () => makeIsGreaterThan,
  makeIsBetween: () => makeIsBetween,
  makeFilterGroup: () => makeFilterGroup,
  makeFilter: () => makeFilter2,
  make: () => make18,
  link: () => link,
  isUppercasedReviver: () => isUppercasedReviver,
  isUppercased: () => isUppercased,
  isUniqueReviver: () => isUniqueReviver,
  isUnique: () => isUnique,
  isUncapitalizedReviver: () => isUncapitalizedReviver,
  isUncapitalized: () => isUncapitalized,
  isUint32: () => isUint32,
  isUUIDReviver: () => isUUIDReviver,
  isUUID: () => isUUID,
  isULIDReviver: () => isULIDReviver,
  isULID: () => isULID,
  isTrimmedReviver: () => isTrimmedReviver,
  isTrimmed: () => isTrimmed,
  isStringSymbolReviver: () => isStringSymbolReviver,
  isStringSymbol: () => isStringSymbol2,
  isStringFiniteReviver: () => isStringFiniteReviver,
  isStringFinite: () => isStringFinite2,
  isStringBigIntReviver: () => isStringBigIntReviver,
  isStringBigInt: () => isStringBigInt2,
  isStartsWithReviver: () => isStartsWithReviver,
  isStartsWith: () => isStartsWith,
  isSizeBetweenReviver: () => isSizeBetweenReviver,
  isSizeBetween: () => isSizeBetween,
  isSchemaError: () => isSchemaError,
  isSchema: () => isSchema,
  isPropertyNamesReviver: () => isPropertyNamesReviver,
  isPropertyNames: () => isPropertyNames,
  isPropertiesLengthBetweenReviver: () => isPropertiesLengthBetweenReviver,
  isPropertiesLengthBetween: () => isPropertiesLengthBetween,
  isPatternReviver: () => isPatternReviver,
  isPattern: () => isPattern2,
  isNonEmpty: () => isNonEmpty,
  isMultipleOfReviver: () => isMultipleOfReviver,
  isMultipleOf: () => isMultipleOf,
  isMinSizeReviver: () => isMinSizeReviver,
  isMinSize: () => isMinSize,
  isMinPropertiesReviver: () => isMinPropertiesReviver,
  isMinProperties: () => isMinProperties,
  isMinLengthReviver: () => isMinLengthReviver,
  isMinLength: () => isMinLength,
  isMaxSizeReviver: () => isMaxSizeReviver,
  isMaxSize: () => isMaxSize,
  isMaxPropertiesReviver: () => isMaxPropertiesReviver,
  isMaxProperties: () => isMaxProperties,
  isMaxLengthReviver: () => isMaxLengthReviver,
  isMaxLength: () => isMaxLength,
  isLowercasedReviver: () => isLowercasedReviver,
  isLowercased: () => isLowercased,
  isLessThanReviver: () => isLessThanReviver,
  isLessThanOrEqualToReviver: () => isLessThanOrEqualToReviver,
  isLessThanOrEqualToDateReviver: () => isLessThanOrEqualToDateReviver,
  isLessThanOrEqualToDate: () => isLessThanOrEqualToDate,
  isLessThanOrEqualToBigIntReviver: () => isLessThanOrEqualToBigIntReviver,
  isLessThanOrEqualToBigInt: () => isLessThanOrEqualToBigInt,
  isLessThanOrEqualToBigDecimal: () => isLessThanOrEqualToBigDecimal,
  isLessThanOrEqualTo: () => isLessThanOrEqualTo4,
  isLessThanDateReviver: () => isLessThanDateReviver,
  isLessThanDate: () => isLessThanDate,
  isLessThanBigIntReviver: () => isLessThanBigIntReviver,
  isLessThanBigInt: () => isLessThanBigInt,
  isLessThanBigDecimal: () => isLessThanBigDecimal,
  isLessThan: () => isLessThan4,
  isLengthBetweenReviver: () => isLengthBetweenReviver,
  isLengthBetween: () => isLengthBetween,
  isIntReviver: () => isIntReviver,
  isInt32: () => isInt32,
  isInt: () => isInt,
  isIncludesReviver: () => isIncludesReviver,
  isIncludes: () => isIncludes,
  isGreaterThanReviver: () => isGreaterThanReviver,
  isGreaterThanOrEqualToReviver: () => isGreaterThanOrEqualToReviver,
  isGreaterThanOrEqualToDateReviver: () => isGreaterThanOrEqualToDateReviver,
  isGreaterThanOrEqualToDate: () => isGreaterThanOrEqualToDate,
  isGreaterThanOrEqualToBigIntReviver: () => isGreaterThanOrEqualToBigIntReviver,
  isGreaterThanOrEqualToBigInt: () => isGreaterThanOrEqualToBigInt,
  isGreaterThanOrEqualToBigDecimal: () => isGreaterThanOrEqualToBigDecimal,
  isGreaterThanOrEqualTo: () => isGreaterThanOrEqualTo3,
  isGreaterThanDateReviver: () => isGreaterThanDateReviver,
  isGreaterThanDate: () => isGreaterThanDate,
  isGreaterThanBigIntReviver: () => isGreaterThanBigIntReviver,
  isGreaterThanBigInt: () => isGreaterThanBigInt,
  isGreaterThanBigDecimal: () => isGreaterThanBigDecimal,
  isGreaterThan: () => isGreaterThan4,
  isGUIDReviver: () => isGUIDReviver,
  isGUID: () => isGUID,
  isFiniteReviver: () => isFiniteReviver,
  isFinite: () => isFinite2,
  isEndsWithReviver: () => isEndsWithReviver,
  isEndsWith: () => isEndsWith,
  isCapitalizedReviver: () => isCapitalizedReviver,
  isCapitalized: () => isCapitalized,
  isBetweenReviver: () => isBetweenReviver,
  isBetweenDateReviver: () => isBetweenDateReviver,
  isBetweenDate: () => isBetweenDate,
  isBetweenBigIntReviver: () => isBetweenBigIntReviver,
  isBetweenBigInt: () => isBetweenBigInt,
  isBetweenBigDecimal: () => isBetweenBigDecimal,
  isBetween: () => isBetween2,
  isBase64UrlReviver: () => isBase64UrlReviver,
  isBase64Url: () => isBase64Url,
  isBase64Reviver: () => isBase64Reviver,
  isBase64: () => isBase64,
  is: () => is2,
  instanceOf: () => instanceOf,
  fromURLSearchParams: () => fromURLSearchParams2,
  fromJsonString: () => fromJsonString2,
  fromFormData: () => fromFormData2,
  fromBrand: () => fromBrand,
  flip: () => flip4,
  fieldsAssign: () => fieldsAssign,
  extendTo: () => extendTo,
  encodeUnknownSync: () => encodeUnknownSync2,
  encodeUnknownResult: () => encodeUnknownResult2,
  encodeUnknownPromise: () => encodeUnknownPromise,
  encodeUnknownOption: () => encodeUnknownOption2,
  encodeUnknownExit: () => encodeUnknownExit2,
  encodeUnknownEffect: () => encodeUnknownEffect2,
  encodeTo: () => encodeTo,
  encodeSync: () => encodeSync2,
  encodeResult: () => encodeResult,
  encodePromise: () => encodePromise,
  encodeOption: () => encodeOption2,
  encodeKeys: () => encodeKeys,
  encodeExit: () => encodeExit,
  encodeEffect: () => encodeEffect,
  encode: () => encode,
  decodeUnknownSync: () => decodeUnknownSync2,
  decodeUnknownResult: () => decodeUnknownResult2,
  decodeUnknownPromise: () => decodeUnknownPromise,
  decodeUnknownOption: () => decodeUnknownOption2,
  decodeUnknownExit: () => decodeUnknownExit2,
  decodeUnknownEffect: () => decodeUnknownEffect2,
  decodeTo: () => decodeTo2,
  decodeSync: () => decodeSync2,
  decodeResult: () => decodeResult,
  decodePromise: () => decodePromise,
  decodeOption: () => decodeOption2,
  decodeExit: () => decodeExit,
  decodeEffect: () => decodeEffect2,
  decode: () => decode,
  declareConstructor: () => declareConstructor,
  declare: () => declare,
  check: () => check,
  catchEncodingWithContext: () => catchEncodingWithContext,
  catchEncoding: () => catchEncoding,
  catchDecodingWithContext: () => catchDecodingWithContext,
  catchDecoding: () => catchDecoding,
  brand: () => brand2,
  asserts: () => asserts2,
  annotateKey: () => annotateKey2,
  annotateEncoded: () => annotateEncoded,
  annotate: () => annotate2,
  Void: () => Void2,
  UnknownFromJsonString: () => UnknownFromJsonString,
  Unknown: () => Unknown2,
  UniqueSymbol: () => UniqueSymbol2,
  UniqueArray: () => UniqueArray,
  Union: () => Union2,
  UndefinedOr: () => UndefinedOr,
  Undefined: () => Undefined2,
  Uint8ArrayReviver: () => Uint8ArrayReviver,
  Uint8ArrayFromHex: () => Uint8ArrayFromHex,
  Uint8ArrayFromBase64Url: () => Uint8ArrayFromBase64Url,
  Uint8ArrayFromBase64: () => Uint8ArrayFromBase64,
  Uint8Array: () => Uint8Array2,
  URLSearchParamsReviver: () => URLSearchParamsReviver,
  URLSearchParams: () => URLSearchParams2,
  URLReviver: () => URLReviver,
  URLFromString: () => URLFromString,
  URL: () => URL2,
  TupleWithRest: () => TupleWithRest,
  Tuple: () => Tuple,
  Trimmed: () => Trimmed,
  Trim: () => Trim,
  Tree: () => Tree,
  TimeZoneReviver: () => TimeZoneReviver,
  TimeZoneOffsetReviver: () => TimeZoneOffsetReviver,
  TimeZoneOffset: () => TimeZoneOffset,
  TimeZoneNamedReviver: () => TimeZoneNamedReviver,
  TimeZoneNamedFromString: () => TimeZoneNamedFromString,
  TimeZoneNamed: () => TimeZoneNamed,
  TimeZoneFromString: () => TimeZoneFromString,
  TimeZone: () => TimeZone,
  TemplateLiteralParser: () => TemplateLiteralParser,
  TemplateLiteral: () => TemplateLiteral2,
  TaggedUnion: () => TaggedUnion,
  TaggedStruct: () => TaggedStruct,
  TaggedError: () => TaggedError3,
  TaggedClass: () => TaggedClass,
  Symbol: () => Symbol3,
  StructWithRest: () => StructWithRest,
  Struct: () => Struct,
  StringFromUriComponent: () => StringFromUriComponent,
  StringFromHex: () => StringFromHex,
  StringFromBase64Url: () => StringFromBase64Url,
  StringFromBase64: () => StringFromBase64,
  String: () => String5,
  StandardSchemaV1FailureResult: () => StandardSchemaV1FailureResult,
  SchemaError: () => SchemaError,
  ResultReviver: () => ResultReviver,
  Result: () => Result,
  RegExpReviver: () => RegExpReviver,
  RegExp: () => RegExp3,
  RedactedReviver: () => RedactedReviver,
  RedactedFromValue: () => RedactedFromValue,
  Redacted: () => Redacted,
  Record: () => Record,
  ReadonlySetReviver: () => ReadonlySetReviver,
  ReadonlySet: () => ReadonlySet,
  ReadonlyMapReviver: () => ReadonlyMapReviver,
  ReadonlyMap: () => ReadonlyMap,
  PropertyKey: () => PropertyKey,
  OptionReviver: () => OptionReviver,
  OptionFromUndefinedOr: () => OptionFromUndefinedOr,
  OptionFromOptionalNullOr: () => OptionFromOptionalNullOr,
  OptionFromOptionalKey: () => OptionFromOptionalKey,
  OptionFromOptional: () => OptionFromOptional,
  OptionFromNullishOr: () => OptionFromNullishOr,
  OptionFromNullOr: () => OptionFromNullOr,
  Option: () => Option,
  Opaque: () => Opaque,
  ObjectKeyword: () => ObjectKeyword2,
  NumberFromString: () => NumberFromString,
  Number: () => Number6,
  NullishOr: () => NullishOr,
  NullOr: () => NullOr,
  Null: () => Null2,
  NonEmptyString: () => NonEmptyString,
  NonEmptyArray: () => NonEmptyArray,
  Never: () => Never2,
  Natural: () => Natural,
  MutableJsonReviver: () => MutableJsonReviver,
  MutableJson: () => MutableJson2,
  Literals: () => Literals,
  Literal: () => Literal2,
  JsonReviver: () => JsonReviver,
  Json: () => Json2,
  Int: () => Int,
  HashSetReviver: () => HashSetReviver,
  HashSet: () => HashSet,
  HashMapReviver: () => HashMapReviver,
  HashMap: () => HashMap,
  FormDataReviver: () => FormDataReviver,
  FormData: () => FormData2,
  FiniteFromString: () => FiniteFromString,
  Finite: () => Finite,
  FileReviver: () => FileReviver,
  File: () => File,
  ExitReviver: () => ExitReviver,
  Exit: () => Exit,
  ErrorInstanceReviver: () => ErrorInstanceReviver,
  ErrorInstance: () => ErrorInstance,
  Error: () => Error3,
  Enum: () => Enum2,
  DurationReviver: () => DurationReviver,
  DurationFromString: () => DurationFromString,
  DurationFromNanos: () => DurationFromNanos,
  DurationFromMillis: () => DurationFromMillis,
  Duration: () => Duration,
  Defect: () => Defect,
  DateTimeZonedReviver: () => DateTimeZonedReviver,
  DateTimeZonedFromString: () => DateTimeZonedFromString,
  DateTimeZoned: () => DateTimeZoned,
  DateTimeUtcReviver: () => DateTimeUtcReviver,
  DateTimeUtcFromString: () => DateTimeUtcFromString,
  DateTimeUtcFromMillis: () => DateTimeUtcFromMillis,
  DateTimeUtcFromDate: () => DateTimeUtcFromDate,
  DateTimeUtc: () => DateTimeUtc,
  DateReviver: () => DateReviver,
  DateFromString: () => DateFromString,
  DateFromMillis: () => DateFromMillis,
  Date: () => Date4,
  Class: () => Class3,
  ChunkReviver: () => ChunkReviver,
  Chunk: () => Chunk,
  Char: () => Char,
  CauseReviver: () => CauseReviver,
  CauseReasonReviver: () => CauseReasonReviver,
  CauseReason: () => CauseReason,
  Cause: () => Cause,
  BooleanFromBit: () => BooleanFromBit,
  Boolean: () => Boolean3,
  BigIntFromString: () => BigIntFromString,
  BigInt: () => BigInt5,
  BigDecimalReviver: () => BigDecimalReviver,
  BigDecimalFromString: () => BigDecimalFromString,
  BigDecimal: () => BigDecimal,
  ArrayEnsure: () => ArrayEnsure,
  Array: () => ArraySchema,
  Any: () => Any2
});

// node_modules/effect/dist/BigDecimal.js
var FINITE_INT_REGEXP = /^[+-]?\d+$/;
var TypeId14 = "~effect/BigDecimal";
var BigDecimalProto = {
  [TypeId14]: TypeId14,
  [symbol]() {
    const normalized = normalize(this);
    return combine(hash(normalized.value), number(normalized.scale));
  },
  [symbol2](that) {
    return isBigDecimal(that) && equals3(this, that);
  },
  toString() {
    return `BigDecimal(${format2(this)})`;
  },
  toJSON() {
    return {
      _id: "BigDecimal",
      value: String(this.value),
      scale: this.scale
    };
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var isBigDecimal = (u) => hasProperty(u, TypeId14);
var make10 = (value3, scale) => {
  const o = Object.create(BigDecimalProto);
  o.value = value3;
  o.scale = scale;
  return o;
};
var makeNormalizedUnsafe = (value3, scale) => {
  if (value3 !== bigint04 && value3 % bigint102 === bigint04) {
    throw new RangeError("Value must be normalized");
  }
  const o = make10(value3, scale);
  o.normalized = o;
  return o;
};
var bigint04 = /* @__PURE__ */ BigInt(0);
var bigint12 = /* @__PURE__ */ BigInt(1);
var bigint_1 = /* @__PURE__ */ BigInt(-1);
var bigint102 = /* @__PURE__ */ BigInt(10);
var zero2 = /* @__PURE__ */ makeNormalizedUnsafe(bigint04, 0);
var normalize = (self) => {
  if (self.normalized === undefined) {
    if (self.value === bigint04) {
      self.normalized = zero2;
    } else {
      const digits = `${self.value}`;
      let trail = 0;
      for (let i = digits.length - 1;i >= 0; i--) {
        if (digits[i] === "0") {
          trail++;
        } else {
          break;
        }
      }
      if (trail === 0) {
        self.normalized = self;
      }
      const value3 = BigInt(digits.substring(0, digits.length - trail));
      const scale = self.scale - trail;
      self.normalized = makeNormalizedUnsafe(value3, scale);
    }
  }
  return self.normalized;
};
var scale = /* @__PURE__ */ dual(2, (self, scale2) => {
  if (scale2 > self.scale) {
    return make10(self.value * bigint102 ** BigInt(scale2 - self.scale), scale2);
  }
  if (scale2 < self.scale) {
    return make10(self.value / bigint102 ** BigInt(self.scale - scale2), scale2);
  }
  return self;
});
var sum2 = /* @__PURE__ */ dual(2, (self, that) => {
  if (that.value === bigint04) {
    return self;
  }
  if (self.value === bigint04) {
    return that;
  }
  if (self.scale > that.scale) {
    return make10(scale(that, self.scale).value + self.value, self.scale);
  }
  if (self.scale < that.scale) {
    return make10(scale(self, that.scale).value + that.value, that.scale);
  }
  return make10(self.value + that.value, self.scale);
});
var Order2 = /* @__PURE__ */ make4((self, that) => {
  const scmp = Number2(sign(self), sign(that));
  if (scmp !== 0) {
    return scmp;
  }
  if (self.scale > that.scale) {
    return BigInt2(self.value, scale(that, self.scale).value);
  }
  if (self.scale < that.scale) {
    return BigInt2(scale(self, that.scale).value, that.value);
  }
  return BigInt2(self.value, that.value);
});
var isLessThan2 = /* @__PURE__ */ isLessThan(Order2);
var isGreaterThan2 = /* @__PURE__ */ isGreaterThan(Order2);
var sign = (n) => n.value === bigint04 ? 0 : n.value < bigint04 ? -1 : 1;
var abs = (n) => n.value < bigint04 ? make10(-n.value, n.scale) : n;
var Equivalence3 = /* @__PURE__ */ make3((self, that) => {
  if (self.scale > that.scale) {
    return scale(that, self.scale).value === self.value;
  }
  if (self.scale < that.scale) {
    return scale(self, that.scale).value === that.value;
  }
  return self.value === that.value;
});
var equals3 = /* @__PURE__ */ dual(2, (self, that) => Equivalence3(self, that));
var fromString = (s) => {
  if (s === "") {
    return some2(zero2);
  }
  let base;
  let exp;
  const seperator = s.search(/[eE]/);
  if (seperator !== -1) {
    const trail = s.slice(seperator + 1);
    base = s.slice(0, seperator);
    exp = Number(trail);
    if (base === "" || !Number.isSafeInteger(exp) || !FINITE_INT_REGEXP.test(trail)) {
      return none2();
    }
  } else {
    base = s;
    exp = 0;
  }
  let digits;
  let offset;
  const dot = base.search(/\./);
  if (dot !== -1) {
    const lead = base.slice(0, dot);
    const trail = base.slice(dot + 1);
    digits = `${lead}${trail}`;
    offset = trail.length;
  } else {
    digits = base;
    offset = 0;
  }
  if (!FINITE_INT_REGEXP.test(digits)) {
    return none2();
  }
  const scale2 = offset - exp;
  if (!Number.isSafeInteger(scale2)) {
    return none2();
  }
  return some2(make10(BigInt(digits), scale2));
};
var format2 = (n) => {
  const normalized = normalize(n);
  if (Math.abs(normalized.scale) >= 16) {
    return toExponential(normalized);
  }
  const negative = normalized.value < bigint04;
  const absolute = negative ? `${normalized.value}`.substring(1) : `${normalized.value}`;
  let before;
  let after;
  if (normalized.scale >= absolute.length) {
    before = "0";
    after = "0".repeat(normalized.scale - absolute.length) + absolute;
  } else {
    const location = absolute.length - normalized.scale;
    if (location > absolute.length) {
      const zeros = location - absolute.length;
      before = `${absolute}${"0".repeat(zeros)}`;
      after = "";
    } else {
      after = absolute.slice(location);
      before = absolute.slice(0, location);
    }
  }
  const complete = after === "" ? before : `${before}.${after}`;
  return negative ? `-${complete}` : complete;
};
var toExponential = (n) => {
  if (isZero(n)) {
    return "0e+0";
  }
  const normalized = normalize(n);
  const digits = `${abs(normalized).value}`;
  const head = digits.slice(0, 1);
  const tail = digits.slice(1);
  let output = `${isNegative(normalized) ? "-" : ""}${head}`;
  if (tail !== "") {
    output += `.${tail}`;
  }
  const exp = tail.length - normalized.scale;
  return `${output}e${exp >= 0 ? "+" : ""}${exp}`;
};
var isZero = (n) => n.value === bigint04;
var isNegative = (n) => n.value < bigint04;
var isPositive = (n) => n.value > bigint04;
var isBigDecimalArgs = (args2) => isBigDecimal(args2[0]);
var truncate = /* @__PURE__ */ dual(isBigDecimalArgs, (self, scale2 = 0) => {
  if (self.scale <= scale2) {
    return self;
  }
  return make10(self.value / bigint102 ** BigInt(self.scale - scale2), scale2);
});
var ceil = /* @__PURE__ */ dual(isBigDecimalArgs, (self, scale2 = 0) => {
  const truncated = truncate(self, scale2);
  if (isPositive(self) && isLessThan2(truncated, self)) {
    return sum2(truncated, make10(bigint12, scale2));
  }
  return truncated;
});
var floor = /* @__PURE__ */ dual(isBigDecimalArgs, (self, scale2 = 0) => {
  const truncated = truncate(self, scale2);
  if (isNegative(self) && isGreaterThan2(truncated, self)) {
    return sum2(truncated, make10(bigint_1, scale2));
  }
  return truncated;
});

// node_modules/effect/dist/Chunk.js
var TypeId15 = "~effect/collections/Chunk";
function copy(src, srcPos, dest, destPos, len) {
  for (let i = srcPos;i < Math.min(src.length, srcPos + len); i++) {
    dest[destPos + i - srcPos] = src[i];
  }
  return dest;
}
var emptyArray = [];
var makeEquivalence4 = (isEquivalent) => make3((self, that) => self.length === that.length && toReadonlyArray(self).every((value3, i) => isEquivalent(value3, getUnsafe2(that, i))));
var _equivalence = /* @__PURE__ */ makeEquivalence4(equals);
var ChunkProto = {
  [TypeId15]: {
    _A: (_) => _
  },
  toString() {
    return `Chunk(${format(toReadonlyArray(this))})`;
  },
  toJSON() {
    return {
      _id: "Chunk",
      values: toJson(toReadonlyArray(this))
    };
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  [symbol2](that) {
    return isChunk(that) && _equivalence(this, that);
  },
  [symbol]() {
    return array(toReadonlyArray(this));
  },
  [Symbol.iterator]() {
    switch (this.backing._tag) {
      case "IArray": {
        return this.backing.array[Symbol.iterator]();
      }
      case "IEmpty": {
        return emptyArray[Symbol.iterator]();
      }
      default: {
        return toReadonlyArray(this)[Symbol.iterator]();
      }
    }
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var makeChunk = (backing) => {
  const chunk = Object.create(ChunkProto);
  chunk.backing = backing;
  switch (backing._tag) {
    case "IEmpty": {
      chunk.length = 0;
      chunk.depth = 0;
      chunk.left = chunk;
      chunk.right = chunk;
      break;
    }
    case "IConcat": {
      chunk.length = backing.left.length + backing.right.length;
      chunk.depth = 1 + Math.max(backing.left.depth, backing.right.depth);
      chunk.left = backing.left;
      chunk.right = backing.right;
      break;
    }
    case "IArray": {
      chunk.length = backing.array.length;
      chunk.depth = 0;
      chunk.left = _empty;
      chunk.right = _empty;
      break;
    }
    case "ISingleton": {
      chunk.length = 1;
      chunk.depth = 0;
      chunk.left = _empty;
      chunk.right = _empty;
      break;
    }
    case "ISlice": {
      chunk.length = backing.length;
      chunk.depth = backing.chunk.depth + 1;
      chunk.left = _empty;
      chunk.right = _empty;
      break;
    }
  }
  return chunk;
};
var isChunk = (u) => hasProperty(u, TypeId15);
var _empty = /* @__PURE__ */ makeChunk({
  _tag: "IEmpty"
});
var empty4 = () => _empty;
var of = (a) => makeChunk({
  _tag: "ISingleton",
  a
});
var fromIterable2 = (self) => isChunk(self) ? self : fromArrayUnsafe(fromIterable(self));
var copyToArray = (self, array2, initial) => {
  switch (self.backing._tag) {
    case "IArray": {
      copy(self.backing.array, 0, array2, initial, self.length);
      break;
    }
    case "IConcat": {
      copyToArray(self.left, array2, initial);
      copyToArray(self.right, array2, initial + self.left.length);
      break;
    }
    case "ISingleton": {
      array2[initial] = self.backing.a;
      break;
    }
    case "ISlice": {
      let i = 0;
      let j = initial;
      while (i < self.length) {
        array2[j] = getUnsafe2(self, i);
        i += 1;
        j += 1;
      }
      break;
    }
  }
};
var toReadonlyArray_ = (self) => {
  switch (self.backing._tag) {
    case "IEmpty": {
      return emptyArray;
    }
    case "IArray": {
      return self.backing.array;
    }
    default: {
      const arr = new Array(self.length);
      copyToArray(self, arr, 0);
      self.backing = {
        _tag: "IArray",
        array: arr
      };
      self.left = _empty;
      self.right = _empty;
      self.depth = 0;
      return arr;
    }
  }
};
var toReadonlyArray = toReadonlyArray_;
var fromArrayUnsafe = (self) => self.length === 0 ? empty4() : self.length === 1 ? of(self[0]) : makeChunk({
  _tag: "IArray",
  array: self
});
var getUnsafe2 = /* @__PURE__ */ dual(2, (self, index) => {
  const i = Math.floor(index);
  switch (self.backing._tag) {
    case "IEmpty": {
      throw new Error(`Index out of bounds: ${i}`);
    }
    case "ISingleton": {
      if (index !== 0) {
        throw new Error(`Index out of bounds: ${i}`);
      }
      return self.backing.a;
    }
    case "IArray": {
      if (i >= self.length || i < 0) {
        throw new Error(`Index out of bounds: ${i}`);
      }
      return self.backing.array[i];
    }
    case "IConcat": {
      return i < self.left.length ? getUnsafe2(self.left, i) : getUnsafe2(self.right, i - self.left.length);
    }
    case "ISlice": {
      return getUnsafe2(self.backing.chunk, i + self.backing.offset);
    }
  }
});
var size = (self) => self.length;

// node_modules/effect/dist/DateTime.js
var isDateTime2 = isDateTime;
var isTimeZone2 = isTimeZone;
var isTimeZoneOffset2 = isTimeZoneOffset;
var isTimeZoneNamed2 = isTimeZoneNamed;
var isUtc2 = isUtc;
var isZoned2 = isZoned;
var Equivalence4 = Equivalence2;
var Order3 = Order;
var fromDateUnsafe2 = fromDateUnsafe;
var makeZonedUnsafe2 = makeZonedUnsafe;
var make11 = make8;
var makeZonedFromString2 = makeZonedFromString;
var toUtc2 = toUtc;
var zoneMakeNamedUnsafe2 = zoneMakeNamedUnsafe;
var zoneMakeOffset2 = zoneMakeOffset;
var zoneMakeNamed2 = zoneMakeNamed;
var zoneFromString2 = zoneFromString;
var zoneToString2 = zoneToString;
var toDateUtc2 = toDateUtc;
var toEpochMillis2 = toEpochMillis;
var formatIso2 = formatIso;
var formatIsoZoned2 = formatIsoZoned;

// node_modules/effect/dist/Encoding.js
var EncodingErrorTypeId = "~effect/encoding/EncodingError";

class EncodingError extends (/* @__PURE__ */ TaggedError2("EncodingError")) {
  [EncodingErrorTypeId] = EncodingErrorTypeId;
}
var encodeBase64 = (input) => typeof input === "string" ? base64EncodeUint8Array(encoder.encode(input)) : base64EncodeUint8Array(input);
var decodeBase64 = (str) => {
  const stripped = stripCrlf(str);
  const length = stripped.length;
  if (length % 4 !== 0) {
    return fail2(new EncodingError({
      kind: "Decode",
      module: "Base64",
      input: stripped,
      message: `Length must be a multiple of 4, but is ${length}`
    }));
  }
  const index = stripped.indexOf("=");
  if (index !== -1 && (index < length - 2 || index === length - 2 && stripped[length - 1] !== "=")) {
    return fail2(new EncodingError({
      kind: "Decode",
      module: "Base64",
      input: stripped,
      message: `Found a '=' character, but it is not at the end`
    }));
  }
  try {
    const missingOctets = stripped.endsWith("==") ? 2 : stripped.endsWith("=") ? 1 : 0;
    const result3 = new Uint8Array(3 * (length / 4) - missingOctets);
    for (let i = 0, j = 0;i < length; i += 4, j += 3) {
      const buffer = getBase64Code(stripped.charCodeAt(i)) << 18 | getBase64Code(stripped.charCodeAt(i + 1)) << 12 | getBase64Code(stripped.charCodeAt(i + 2)) << 6 | getBase64Code(stripped.charCodeAt(i + 3));
      result3[j] = buffer >> 16;
      result3[j + 1] = buffer >> 8 & 255;
      result3[j + 2] = buffer & 255;
    }
    return succeed2(result3);
  } catch (e) {
    return fail2(new EncodingError({
      kind: "Decode",
      module: "Base64",
      input: stripped,
      message: e instanceof Error ? e.message : "Invalid input"
    }));
  }
};
var decodeBase64String = (str) => map2(decodeBase64(str), (_) => decoder.decode(_));
var encodeBase64Url = (input) => typeof input === "string" ? base64UrlEncodeUint8Array(encoder.encode(input)) : base64UrlEncodeUint8Array(input);
var decodeBase64Url = (str) => {
  const stripped = stripCrlf(str);
  const length = stripped.length;
  if (length % 4 === 1) {
    return fail2(new EncodingError({
      module: "Base64Url",
      kind: "Decode",
      input: stripped,
      message: `Length should be a multiple of 4, but is ${length}`
    }));
  }
  if (!/^[-_A-Z0-9]*?={0,2}$/i.test(stripped)) {
    return fail2(new EncodingError({
      module: "Base64Url",
      kind: "Decode",
      input: stripped,
      message: "Invalid input"
    }));
  }
  let sanitized = length % 4 === 2 ? `${stripped}==` : length % 4 === 3 ? `${stripped}=` : stripped;
  sanitized = sanitized.replace(/-/g, "+").replace(/_/g, "/");
  return decodeBase64(sanitized);
};
var decodeBase64UrlString = (str) => map2(decodeBase64Url(str), (_) => decoder.decode(_));
var encodeHex = (input) => typeof input === "string" ? hexEncodeUint8Array(encoder.encode(input)) : hexEncodeUint8Array(input);
var decodeHex = (str) => {
  const bytes = new TextEncoder().encode(str);
  if (bytes.length % 2 !== 0) {
    return fail2(new EncodingError({
      module: "Hex",
      kind: "Decode",
      input: str,
      message: `Length must be a multiple of 2, but is ${bytes.length}`
    }));
  }
  try {
    const length = bytes.length / 2;
    const result3 = new Uint8Array(length);
    for (let i = 0;i < length; i++) {
      const a = fromHexChar(bytes[i * 2]);
      const b = fromHexChar(bytes[i * 2 + 1]);
      result3[i] = a << 4 | b;
    }
    return succeed2(result3);
  } catch (e) {
    return fail2(new EncodingError({
      module: "Hex",
      kind: "Decode",
      input: str,
      message: e instanceof Error ? e.message : "Invalid input"
    }));
  }
};
var decodeHexString = (str) => map2(decodeHex(str), (_) => decoder.decode(_));
var encoder = /* @__PURE__ */ new TextEncoder;
var decoder = /* @__PURE__ */ new TextDecoder;
var stripCrlf = (str) => str.replace(/[\n\r]/g, "");
var base64EncodeUint8Array = (bytes) => {
  const length = bytes.length;
  let result3 = "";
  let i;
  for (i = 2;i < length; i += 3) {
    result3 += base64abc[bytes[i - 2] >> 2];
    result3 += base64abc[(bytes[i - 2] & 3) << 4 | bytes[i - 1] >> 4];
    result3 += base64abc[(bytes[i - 1] & 15) << 2 | bytes[i] >> 6];
    result3 += base64abc[bytes[i] & 63];
  }
  if (i === length + 1) {
    result3 += base64abc[bytes[i - 2] >> 2];
    result3 += base64abc[(bytes[i - 2] & 3) << 4];
    result3 += "==";
  }
  if (i === length) {
    result3 += base64abc[bytes[i - 2] >> 2];
    result3 += base64abc[(bytes[i - 2] & 3) << 4 | bytes[i - 1] >> 4];
    result3 += base64abc[(bytes[i - 1] & 15) << 2];
    result3 += "=";
  }
  return result3;
};
function getBase64Code(charCode) {
  if (charCode >= base64codes.length) {
    throw new TypeError(`Invalid character ${String.fromCharCode(charCode)}`);
  }
  const code = base64codes[charCode];
  if (code === 255) {
    throw new TypeError(`Invalid character ${String.fromCharCode(charCode)}`);
  }
  return code;
}
var base64abc = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "/"];
var base64codes = [255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 62, 255, 255, 255, 63, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 255, 255, 255, 0, 255, 255, 255, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 255, 255, 255, 255, 255, 255, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51];
var base64UrlEncodeUint8Array = (data) => base64EncodeUint8Array(data).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
var hexEncodeUint8Array = (bytes) => {
  let result3 = "";
  for (let i = 0;i < bytes.length; ++i) {
    result3 += bytesToHex[bytes[i]];
  }
  return result3;
};
var fromHexChar = (byte) => {
  if (48 <= byte && byte <= 57) {
    return byte - 48;
  }
  if (97 <= byte && byte <= 102) {
    return byte - 97 + 10;
  }
  if (65 <= byte && byte <= 70) {
    return byte - 65 + 10;
  }
  throw new TypeError("Invalid input");
};
var bytesToHex = ["00", "01", "02", "03", "04", "05", "06", "07", "08", "09", "0a", "0b", "0c", "0d", "0e", "0f", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "1a", "1b", "1c", "1d", "1e", "1f", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "2a", "2b", "2c", "2d", "2e", "2f", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "3a", "3b", "3c", "3d", "3e", "3f", "40", "41", "42", "43", "44", "45", "46", "47", "48", "49", "4a", "4b", "4c", "4d", "4e", "4f", "50", "51", "52", "53", "54", "55", "56", "57", "58", "59", "5a", "5b", "5c", "5d", "5e", "5f", "60", "61", "62", "63", "64", "65", "66", "67", "68", "69", "6a", "6b", "6c", "6d", "6e", "6f", "70", "71", "72", "73", "74", "75", "76", "77", "78", "79", "7a", "7b", "7c", "7d", "7e", "7f", "80", "81", "82", "83", "84", "85", "86", "87", "88", "89", "8a", "8b", "8c", "8d", "8e", "8f", "90", "91", "92", "93", "94", "95", "96", "97", "98", "99", "9a", "9b", "9c", "9d", "9e", "9f", "a0", "a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9", "aa", "ab", "ac", "ad", "ae", "af", "b0", "b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8", "b9", "ba", "bb", "bc", "bd", "be", "bf", "c0", "c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9", "ca", "cb", "cc", "cd", "ce", "cf", "d0", "d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8", "d9", "da", "db", "dc", "dd", "de", "df", "e0", "e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8", "e9", "ea", "eb", "ec", "ed", "ee", "ef", "f0", "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "fa", "fb", "fc", "fd", "fe", "ff"];

// node_modules/effect/dist/internal/hashMap.js
var HashMapTypeId = "~effect/collections/HashMap";
var SHIFT = 5;
var BUCKET_SIZE = 1 << SHIFT;
var MIN_ARRAY_NODE = BUCKET_SIZE / 4;
var MAX_INDEX_NODE = BUCKET_SIZE / 2;
var BITMAP_INDEX_MASK = BUCKET_SIZE - 1;
var popcount = (n) => {
  n = n - (n >>> 1 & 1431655765);
  n = (n & 858993459) + (n >>> 2 & 858993459);
  return (n + (n >>> 4) & 252645135) * 16843009 >>> 24;
};
var mask = (hash2, shift) => hash2 >>> shift & BITMAP_INDEX_MASK;
var bitpos = (hash2, shift) => 1 << mask(hash2, shift);
var index = (bitmap, bit) => popcount(bitmap & bit - 1);
function mergeLeaves(edit, shift, hash1, node1, hash2, node2) {
  if (shift > 32) {
    throw new Error("HashMap: max depth exceeded");
  }
  const bit1 = bitpos(hash1, shift);
  const bit2 = bitpos(hash2, shift);
  if (bit1 === bit2) {
    const child = mergeLeaves(edit, shift + SHIFT, hash1, node1, hash2, node2);
    return new IndexedNode(edit, bit1, [child]);
  }
  const bitmap = bit1 | bit2;
  const children = bit1 >>> 0 < bit2 >>> 0 ? [node1, node2] : [node2, node1];
  return new IndexedNode(edit, bitmap, children);
}

class Node {
  canEdit(edit) {
    return this.edit === edit;
  }
}

class EmptyNode extends Node {
  _tag = "EmptyNode";
  edit = 0;
  get size() {
    return 0;
  }
  get(_shift, _hash, _key) {
    return none2();
  }
  has(_shift, _hash, _key) {
    return false;
  }
  set(edit, _shift, hash2, key, value3, added) {
    added.value = true;
    return new LeafNode(edit, hash2, key, value3);
  }
  remove(_edit, _shift, _hash, _key, _removed) {
    return this;
  }
  iterator() {
    return [][Symbol.iterator]();
  }
  [Symbol.iterator]() {
    return this.iterator();
  }
  canEdit(_edit) {
    return false;
  }
}

class LeafNode extends Node {
  _tag = "LeafNode";
  edit;
  hash;
  key;
  value;
  constructor(edit, hash2, key, value3) {
    super();
    this.edit = edit;
    this.hash = hash2;
    this.key = key;
    this.value = value3;
  }
  get size() {
    return 1;
  }
  get(_shift, hash2, key) {
    if (this.hash === hash2 && equals(this.key, key)) {
      return some2(this.value);
    }
    return none2();
  }
  has(_shift, hash2, key) {
    return this.hash === hash2 && equals(this.key, key);
  }
  set(edit, shift, hash2, key, value3, added) {
    if (this.hash === hash2 && equals(this.key, key)) {
      if (equals(this.value, value3)) {
        return this;
      }
      if (this.canEdit(edit)) {
        this.value = value3;
        return this;
      }
      return new LeafNode(edit, hash2, key, value3);
    }
    added.value = true;
    if (this.hash === hash2) {
      return new CollisionNode(edit, hash2, [[this.key, this.value], [key, value3]]);
    }
    const newBit = bitpos(hash2, shift);
    const existingBit = bitpos(this.hash, shift);
    if (newBit === existingBit) {
      return new IndexedNode(edit, newBit, [this.set(edit, shift + SHIFT, hash2, key, value3, added)]);
    }
    const bitmap = newBit | existingBit;
    const nodes = newBit >>> 0 < existingBit >>> 0 ? [new LeafNode(edit, hash2, key, value3), this] : [this, new LeafNode(edit, hash2, key, value3)];
    return new IndexedNode(edit, bitmap, nodes);
  }
  remove(_edit, _shift, hash2, key, removed) {
    if (this.hash === hash2 && equals(this.key, key)) {
      removed.value = true;
      return;
    }
    return this;
  }
  iterator() {
    return [[this.key, this.value]][Symbol.iterator]();
  }
  [Symbol.iterator]() {
    return this.iterator();
  }
}

class CollisionNode extends Node {
  _tag = "CollisionNode";
  edit;
  hash;
  entries;
  constructor(edit, hash2, entries) {
    super();
    this.edit = edit;
    this.hash = hash2;
    this.entries = entries;
  }
  get size() {
    return this.entries.length;
  }
  get(_shift, hash2, key) {
    if (this.hash !== hash2) {
      return none2();
    }
    for (const [k, v] of this.entries) {
      if (equals(k, key)) {
        return some2(v);
      }
    }
    return none2();
  }
  has(_shift, hash2, key) {
    if (this.hash !== hash2) {
      return false;
    }
    for (const [k] of this.entries) {
      if (equals(k, key)) {
        return true;
      }
    }
    return false;
  }
  set(edit, shift, hash2, key, value3, added) {
    if (this.hash !== hash2) {
      added.value = true;
      return mergeLeaves(edit, shift, this.hash, this, hash2, new LeafNode(edit, hash2, key, value3));
    }
    for (let i = 0;i < this.entries.length; i++) {
      if (equals(this.entries[i][0], key)) {
        if (equals(this.entries[i][1], value3)) {
          return this;
        }
        if (this.canEdit(edit)) {
          this.entries[i] = [key, value3];
          return this;
        }
        const newEntries = [...this.entries];
        newEntries[i] = [key, value3];
        return new CollisionNode(edit, this.hash, newEntries);
      }
    }
    added.value = true;
    if (this.canEdit(edit)) {
      this.entries.push([key, value3]);
      return this;
    }
    return new CollisionNode(edit, this.hash, [...this.entries, [key, value3]]);
  }
  remove(edit, _shift, hash2, key, removed) {
    if (this.hash !== hash2) {
      return this;
    }
    const idx = this.entries.findIndex(([k]) => equals(k, key));
    if (idx === -1) {
      return this;
    }
    removed.value = true;
    if (this.entries.length === 1) {
      return;
    }
    if (this.entries.length === 2) {
      const remaining = this.entries[idx === 0 ? 1 : 0];
      return new LeafNode(edit, this.hash, remaining[0], remaining[1]);
    }
    if (this.canEdit(edit)) {
      this.entries.splice(idx, 1);
      return this;
    }
    const newEntries = [...this.entries];
    newEntries.splice(idx, 1);
    return new CollisionNode(edit, this.hash, newEntries);
  }
  iterator() {
    return this.entries[Symbol.iterator]();
  }
  [Symbol.iterator]() {
    return this.iterator();
  }
}

class IndexedNode extends Node {
  _tag = "IndexedNode";
  edit;
  _size;
  bitmap;
  children;
  constructor(edit, bitmap, children) {
    super();
    this.edit = edit;
    this.bitmap = bitmap;
    this.children = children;
  }
  get size() {
    if (this._size === undefined) {
      this._size = this.children.reduce((acc, child) => acc + child.size, 0);
    }
    return this._size;
  }
  get(shift, hash2, key) {
    const bit = bitpos(hash2, shift);
    if ((this.bitmap & bit) === 0) {
      return none2();
    }
    const idx = index(this.bitmap, bit);
    return this.children[idx].get(shift + SHIFT, hash2, key);
  }
  has(shift, hash2, key) {
    const bit = bitpos(hash2, shift);
    if ((this.bitmap & bit) === 0) {
      return false;
    }
    const idx = index(this.bitmap, bit);
    return this.children[idx].has(shift + SHIFT, hash2, key);
  }
  set(edit, shift, hash2, key, value3, added) {
    const bit = bitpos(hash2, shift);
    const idx = index(this.bitmap, bit);
    if ((this.bitmap & bit) !== 0) {
      const child = this.children[idx];
      const newChild = child.set(edit, shift + SHIFT, hash2, key, value3, added);
      if (child === newChild) {
        return this;
      }
      if (this.canEdit(edit)) {
        this.children[idx] = newChild;
        return this;
      }
      const newChildren = [...this.children];
      newChildren[idx] = newChild;
      return new IndexedNode(edit, this.bitmap, newChildren);
    } else {
      added.value = true;
      const newChild = new LeafNode(edit, hash2, key, value3);
      const newBitmap = this.bitmap | bit;
      if (this.canEdit(edit)) {
        this.children.splice(idx, 0, newChild);
        this.bitmap = newBitmap;
        this._size = undefined;
        if (this.children.length > MAX_INDEX_NODE) {
          return this.expand(edit, newBitmap, this.children);
        }
        return this;
      }
      const newChildren = [...this.children];
      newChildren.splice(idx, 0, newChild);
      if (newChildren.length > MAX_INDEX_NODE) {
        return this.expand(edit, newBitmap, newChildren);
      }
      return new IndexedNode(edit, newBitmap, newChildren);
    }
  }
  remove(edit, shift, hash2, key, removed) {
    const bit = bitpos(hash2, shift);
    if ((this.bitmap & bit) === 0) {
      return this;
    }
    const idx = index(this.bitmap, bit);
    const child = this.children[idx];
    const newChild = child.remove(edit, shift + SHIFT, hash2, key, removed);
    if (!removed.value) {
      return this;
    }
    if (newChild === undefined) {
      const newBitmap = this.bitmap ^ bit;
      if (newBitmap === 0) {
        return;
      }
      if (this.children.length === 2) {
        const remaining = this.children[idx === 0 ? 1 : 0];
        if (remaining._tag === "LeafNode") {
          return remaining;
        }
      }
      if (this.canEdit(edit)) {
        this.children.splice(idx, 1);
        this.bitmap = newBitmap;
        this._size = undefined;
        return this;
      }
      const newChildren2 = [...this.children];
      newChildren2.splice(idx, 1);
      return new IndexedNode(edit, newBitmap, newChildren2);
    }
    if (child === newChild) {
      return this;
    }
    if (this.canEdit(edit)) {
      this.children[idx] = newChild;
      return this;
    }
    const newChildren = [...this.children];
    newChildren[idx] = newChild;
    return new IndexedNode(edit, this.bitmap, newChildren);
  }
  expand(edit, bitmap, children) {
    const nodes = new globalThis.Array(BUCKET_SIZE);
    let j = 0;
    for (let i = 0;i < BUCKET_SIZE; i++) {
      if ((bitmap & 1 << i) !== 0) {
        nodes[i] = children[j++];
      }
    }
    return new ArrayNode(edit, children.length, nodes);
  }
  iterator() {
    let childIndex = 0;
    let currentIterator;
    return {
      next: () => {
        while (childIndex < this.children.length) {
          if (!currentIterator) {
            currentIterator = this.children[childIndex].iterator();
          }
          const result3 = currentIterator.next();
          if (!result3.done) {
            return result3;
          }
          currentIterator = undefined;
          childIndex++;
        }
        return {
          done: true,
          value: undefined
        };
      }
    };
  }
  [Symbol.iterator]() {
    return this.iterator();
  }
}

class ArrayNode extends Node {
  _tag = "ArrayNode";
  edit;
  _size;
  count;
  children;
  constructor(edit, count, children) {
    super();
    this.edit = edit;
    this.count = count;
    this.children = children;
  }
  get size() {
    if (this._size === undefined) {
      this._size = this.children.reduce((acc, child) => acc + (child?.size ?? 0), 0);
    }
    return this._size;
  }
  get(shift, hash2, key) {
    const idx = mask(hash2, shift);
    const child = this.children[idx];
    return child ? child.get(shift + SHIFT, hash2, key) : none2();
  }
  has(shift, hash2, key) {
    const idx = mask(hash2, shift);
    const child = this.children[idx];
    return child ? child.has(shift + SHIFT, hash2, key) : false;
  }
  set(edit, shift, hash2, key, value3, added) {
    const idx = mask(hash2, shift);
    const child = this.children[idx];
    if (child) {
      const newChild = child.set(edit, shift + SHIFT, hash2, key, value3, added);
      if (child === newChild) {
        return this;
      }
      if (this.canEdit(edit)) {
        this.children[idx] = newChild;
        return this;
      }
      const newChildren = [...this.children];
      newChildren[idx] = newChild;
      return new ArrayNode(edit, this.count, newChildren);
    } else {
      added.value = true;
      const newChild = new LeafNode(edit, hash2, key, value3);
      if (this.canEdit(edit)) {
        this.children[idx] = newChild;
        this.count++;
        this._size = undefined;
        return this;
      }
      const newChildren = [...this.children];
      newChildren[idx] = newChild;
      return new ArrayNode(edit, this.count + 1, newChildren);
    }
  }
  remove(edit, shift, hash2, key, removed) {
    const idx = mask(hash2, shift);
    const child = this.children[idx];
    if (!child) {
      return this;
    }
    const newChild = child.remove(edit, shift + SHIFT, hash2, key, removed);
    if (!removed.value) {
      return this;
    }
    const newCount = this.count - (newChild ? 0 : 1);
    if (newCount < MIN_ARRAY_NODE) {
      return this.pack(edit, idx, newChild);
    }
    if (child === newChild) {
      return this;
    }
    if (this.canEdit(edit)) {
      this.children[idx] = newChild;
      if (!newChild) {
        this.count = newCount;
      }
      this._size = undefined;
      return this;
    }
    const newChildren = [...this.children];
    newChildren[idx] = newChild;
    return new ArrayNode(edit, newCount, newChildren);
  }
  pack(edit, excludeIdx, newChild) {
    const children = [];
    let bitmap = 0;
    let bit = 1;
    for (let i = 0;i < this.children.length; i++) {
      const child = i === excludeIdx ? newChild : this.children[i];
      if (child) {
        children.push(child);
        bitmap |= bit;
      }
      bit <<= 1;
    }
    return new IndexedNode(edit, bitmap, children);
  }
  iterator() {
    let childIndex = 0;
    let currentIterator;
    return {
      next: () => {
        while (childIndex < this.children.length) {
          const child = this.children[childIndex];
          if (!child) {
            childIndex++;
            continue;
          }
          if (!currentIterator) {
            currentIterator = child.iterator();
          }
          const result3 = currentIterator.next();
          if (!result3.done) {
            return result3;
          }
          currentIterator = undefined;
          childIndex++;
        }
        return {
          done: true,
          value: undefined
        };
      }
    };
  }
  [Symbol.iterator]() {
    return this.iterator();
  }
}

class HashMapImpl {
  [HashMapTypeId] = HashMapTypeId;
  _editable;
  _edit;
  _root;
  _size;
  constructor(editable, edit, root, size2) {
    this._editable = editable;
    this._edit = edit;
    this._root = root;
    this._size = size2;
  }
  get size() {
    return this._size;
  }
  [Symbol.iterator]() {
    return this._root.iterator();
  }
  [symbol2](that) {
    if (isHashMap(that)) {
      const thatImpl = that;
      if (this.size !== thatImpl.size) {
        return false;
      }
      for (const [key, value3] of this) {
        const otherValue = pipe(that, get2(key));
        if (isNone2(otherValue) || !equals(value3, otherValue.value)) {
          return false;
        }
      }
      return true;
    }
    return false;
  }
  [symbol]() {
    let hash2 = string("HashMap");
    for (const [key, value3] of this) {
      hash2 = hash2 ^ hash(key) + hash(value3);
    }
    return hash2;
  }
  [NodeInspectSymbol]() {
    return toJson(this);
  }
  toString() {
    return `HashMap(${format(Array.from(this))})`;
  }
  toJSON() {
    return {
      _id: "HashMap",
      values: Array.from(this).map(([k, v]) => [toJson(k), toJson(v)])
    };
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
}
var emptyNode = /* @__PURE__ */ new EmptyNode;
var isHashMap = (u) => hasProperty(u, HashMapTypeId);
var empty5 = () => new HashMapImpl(false, 0, emptyNode, 0);
var fromIterable3 = (entries) => {
  let root = emptyNode;
  let size2 = 0;
  const added = {
    value: false
  };
  for (const [key, value3] of entries) {
    const hash2 = hash(key);
    added.value = false;
    root = root.set(NaN, 0, hash2, key, value3, added);
    if (added.value) {
      size2++;
    }
  }
  return new HashMapImpl(false, 0, root, size2);
};
var get2 = /* @__PURE__ */ dual(2, (self, key) => {
  const impl = self;
  return impl._root.get(0, hash(key), key);
});
var has = /* @__PURE__ */ dual(2, (self, key) => {
  const impl = self;
  return impl._root.has(0, hash(key), key);
});
var setHash = (self, key, hash2, value3) => {
  const impl = self;
  const added = {
    value: false
  };
  const edit = impl._editable ? impl._edit : NaN;
  const newRoot = impl._root.set(edit, 0, hash2, key, value3, added);
  if (impl._editable) {
    impl._root = newRoot;
    if (added.value) {
      impl._size++;
    }
    return self;
  }
  if (impl._root === newRoot) {
    return self;
  }
  return new HashMapImpl(false, impl._edit, newRoot, impl._size + (added.value ? 1 : 0));
};
var set = /* @__PURE__ */ dual(3, (self, key, value3) => {
  return setHash(self, key, hash(key), value3);
});
var keys2 = (self) => {
  const iterator = self[Symbol.iterator]();
  return {
    [Symbol.iterator]() {
      return this;
    },
    next() {
      const result3 = iterator.next();
      if (result3.done) {
        return {
          done: true,
          value: undefined
        };
      }
      return {
        done: false,
        value: result3.value[0]
      };
    }
  };
};
var entries = (self) => {
  const iterator = self[Symbol.iterator]();
  return {
    [Symbol.iterator]() {
      return this;
    },
    next() {
      return iterator.next();
    }
  };
};
var size2 = (self) => self.size;

// node_modules/effect/dist/HashMap.js
var isHashMap2 = isHashMap;
var fromIterable4 = fromIterable3;
var entries2 = entries;
var toEntries = (self) => Array.from(entries2(self));
var size3 = size2;

// node_modules/effect/dist/internal/hashSet.js
var HashSetTypeId = "~effect/collections/HashSet";
var HashSetProto = {
  [symbol]() {
    return hash(HashSetTypeId);
  },
  [symbol2](that) {
    return isHashSet(that) && size4(this) === size4(that) && every2(this, (value3) => has2(that, value3));
  },
  [Symbol.iterator]() {
    return keys2(keyMap(this));
  },
  toString() {
    return `HashSet(${format(Array.from(this))})`;
  },
  toJSON() {
    return {
      _id: "HashSet",
      values: toJson(Array.from(this))
    };
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var makeImpl2 = (keyMap) => {
  const set2 = Object.create(HashSetProto);
  set2[HashSetTypeId] = HashSetTypeId;
  set2.keyMap = keyMap;
  return set2;
};
var isHashSet = (u) => hasProperty(u, HashSetTypeId);
var keyMap = (self) => self.keyMap;
var fromIterable5 = (values2) => {
  let map9 = empty5();
  for (const value3 of values2) {
    map9 = set(map9, value3, true);
  }
  return makeImpl2(map9);
};
var has2 = (self, value3) => has(keyMap(self), value3);
var size4 = (self) => size2(keyMap(self));
var every2 = (self, predicate) => {
  for (const value3 of self) {
    if (!predicate(value3)) {
      return false;
    }
  }
  return true;
};

// node_modules/effect/dist/HashSet.js
var fromIterable6 = fromIterable5;
var isHashSet2 = isHashSet;
var size5 = size4;

// node_modules/effect/dist/internal/schema/annotations.js
function resolve(ast) {
  return ast.checks ? ast.checks[ast.checks.length - 1].annotations : ast.annotations;
}
function resolveAt(key) {
  return (ast) => resolve(ast)?.[key];
}
var STRUCTURAL_ANNOTATION_KEY = "~structural";
var IDENTIFIER_FALLBACK_KEY = "~identifier";
var SENTINELS_ANNOTATION_KEY = "~sentinels";
var CONSTRUCTOR_ANNOTATION_KEY = "~constructor";
var jsonSchemaAnnotationKeys = ["title", "description", "default", "examples", "readOnly", "writeOnly", "format", "contentEncoding", "contentMediaType", "contentSchema"];
var resolveIdentifier = /* @__PURE__ */ resolveAt("identifier");
var resolveIdentifierFallback = /* @__PURE__ */ resolveAt(IDENTIFIER_FALLBACK_KEY);
var resolveTitle = /* @__PURE__ */ resolveAt("title");
var resolveBrands = /* @__PURE__ */ resolveAt("brands");
var getExpected = /* @__PURE__ */ memoize((ast) => {
  const identifier2 = resolveIdentifier(ast);
  if (typeof identifier2 === "string")
    return identifier2;
  return ast.getExpected(getExpected);
});
var annotationExcludedKeys = /* @__PURE__ */ new Set([SENTINELS_ANNOTATION_KEY, STRUCTURAL_ANNOTATION_KEY, "representation", "arbitrary", "brands", "toJsonSchema", "toCode", "toArbitrary", "toEquivalence", "toFormatter", "toCodec", "toCodecJson", "toCodecStringTree", "toCodecIso"]);

// node_modules/effect/dist/internal/schema/parser.js
var missing = /* @__PURE__ */ Symbol();
var succeed7 = succeed4;
var missingExit = /* @__PURE__ */ succeed7(missing);
var sameExit = /* @__PURE__ */ succeed7(missing);
var toOption = (value3) => value3 === missing ? none2() : some2(value3);
var fromOptionExit = (option3) => option3._tag === "None" ? missingExit : succeed7(option3.value);

// node_modules/effect/dist/SchemaIssue.js
var TypeId16 = "~effect/SchemaIssue/Issue";
function isIssue(u) {
  return hasProperty(u, TypeId16) && u[TypeId16] === TypeId16;
}
function hasInput(issue) {
  return Object.hasOwn(issue, "input");
}

class Base {
  [TypeId16] = TypeId16;
  constructor(input, options) {
    if (options?.reportInput === true && input !== missing) {
      this.input = input;
    }
  }
}

class Filter extends Base {
  _tag = "Filter";
  filter;
  issue;
  constructor(filter8, issue, input, options) {
    super(input, options);
    this.filter = filter8;
    this.issue = issue;
  }
}

class Encoding extends Base {
  _tag = "Encoding";
  ast;
  issue;
  constructor(ast, issue, input, options) {
    super(input, options);
    this.ast = ast;
    this.issue = issue;
  }
}

class Pointer extends Base {
  _tag = "Pointer";
  path;
  issue;
  constructor(path, issue) {
    super();
    this.path = path;
    this.issue = issue;
  }
}

class MissingKey extends Base {
  _tag = "MissingKey";
  annotations;
  constructor(annotations) {
    super();
    this.annotations = annotations;
  }
}

class UnexpectedKey extends Base {
  _tag = "UnexpectedKey";
  ast;
  constructor(ast, input, options) {
    super(input, options);
    this.ast = ast;
  }
}

class Composite extends Base {
  _tag = "Composite";
  ast;
  issues;
  constructor(ast, issues, input, options) {
    super(input, options);
    this.ast = ast;
    this.issues = issues;
  }
}

class InvalidType extends Base {
  _tag = "InvalidType";
  ast;
  constructor(ast, input, options) {
    super(input, options);
    this.ast = ast;
  }
}

class InvalidValue extends Base {
  _tag = "InvalidValue";
  annotations;
  constructor(annotations, input, options) {
    super(input, options);
    this.annotations = annotations;
  }
}
function makeCompositeAtKey(compositeAst, pointerKey, pointerIssue, compositeInput, parseOptions) {
  return new Composite(compositeAst, [new Pointer([pointerKey], pointerIssue)], compositeInput, parseOptions);
}

class Forbidden extends Base {
  _tag = "Forbidden";
  annotations;
  constructor(annotations, input, options) {
    super(input, options);
    this.annotations = annotations;
  }
}

class AnyOf extends Base {
  _tag = "AnyOf";
  ast;
  issues;
  constructor(ast, issues, input, options) {
    super(input, options);
    this.ast = ast;
    this.issues = issues;
  }
}

class OneOf extends Base {
  _tag = "OneOf";
  ast;
  successes;
  constructor(ast, successes, input, options) {
    super(input, options);
    this.ast = ast;
    this.successes = successes;
  }
}
function makeFilterIssue(entry, input, options) {
  if (isIssue(entry)) {
    return entry;
  }
  if (typeof entry === "string") {
    return new InvalidValue({
      message: entry
    }, input, options);
  }
  const inner = typeof entry.issue === "string" ? new InvalidValue({
    message: entry.issue
  }, input, options) : entry.issue;
  return new Pointer(entry.path, inner);
}
function makeSingle(out, input, options) {
  if (out === undefined) {
    return;
  }
  if (typeof out === "boolean") {
    return out ? undefined : new InvalidValue(undefined, input, options);
  }
  return makeFilterIssue(out, input, options);
}
function normalizeFilterOutput(ast, out, input, options) {
  if (Array.isArray(out)) {
    if (!isReadonlyArrayNonEmpty(out)) {
      return;
    }
    return out.length === 1 ? makeFilterIssue(out[0], input, options) : new Composite(ast, map4(out, (entry) => makeFilterIssue(entry, input, options)), input, options);
  }
  return makeSingle(out, input, options);
}
var defaultLeafHook = (issue) => {
  const message = findMessage(issue);
  if (message !== undefined)
    return message;
  switch (issue._tag) {
    case "InvalidType":
      return getExpectedMessage(getExpected(issue.ast), issue);
    case "InvalidValue": {
      const expected = findExpected(issue);
      if (expected !== undefined)
        return getExpectedMessage(expected, issue);
      const input = formatInput(issue);
      return input === undefined ? "Expected a valid value" : `Invalid data ${input}`;
    }
    case "MissingKey":
      return "Missing key";
    case "UnexpectedKey": {
      const input = formatInput(issue);
      return input === undefined ? "Expected no excess property" : `Unexpected key with value ${input}`;
    }
    case "Forbidden":
      return "Forbidden operation";
    case "OneOf": {
      const input = formatInput(issue);
      return input === undefined ? "Expected exactly one member to match" : `Expected exactly one member to match the input ${input}`;
    }
  }
};
var defaultCheckHook = (issue) => findMessage(issue.issue) ?? findMessage(issue);
function makeFormatterStandardSchemaV1(options) {
  return (issue) => ({
    issues: toDefaultIssues(issue, [], options?.leafHook ?? defaultLeafHook, options?.checkHook ?? defaultCheckHook)
  });
}
function formatInput(issue) {
  return hasInput(issue) ? format(issue.input) : undefined;
}
function findExpected(issue) {
  const expected = issue.annotations?.expected;
  return typeof expected === "string" ? expected : undefined;
}
function getExpectedMessage(expected, issue) {
  const input = formatInput(issue);
  return input === undefined ? `Expected ${expected}` : `Expected ${expected}, got ${input}`;
}
function toDefaultIssues(issue, path, leafHook, checkHook) {
  switch (issue._tag) {
    case "Filter": {
      const message = checkHook(issue);
      if (message !== undefined) {
        return [{
          path,
          message
        }];
      }
      if (issue.issue._tag !== "InvalidValue") {
        return toDefaultIssues(issue.issue, path, leafHook, checkHook);
      }
      const expected = findExpected(issue.issue);
      return [{
        path,
        message: expected === undefined ? getExpectedMessage(formatCheck(issue.filter), issue) : getExpectedMessage(expected, issue.issue)
      }];
    }
    case "Encoding":
      return toDefaultIssues(issue.issue, path, leafHook, checkHook);
    case "Pointer":
      return toDefaultIssues(issue.issue, [...path, ...issue.path], leafHook, checkHook);
    case "Composite":
      return issue.issues.flatMap((issue2) => toDefaultIssues(issue2, path, leafHook, checkHook));
    case "AnyOf": {
      if (issue.issues.length === 0) {
        return [{
          path,
          message: findMessage(issue) ?? getExpectedMessage(getExpected(issue.ast), issue)
        }];
      }
      return issue.issues.flatMap((issue2) => toDefaultIssues(issue2, path, leafHook, checkHook));
    }
    default:
      return [{
        path,
        message: leafHook(issue)
      }];
  }
}
function formatCheck(check) {
  const expected = check.annotations?.expected;
  if (typeof expected === "string")
    return expected;
  switch (check._tag) {
    case "Filter":
      return "<filter>";
    case "FilterGroup":
      return check.checks.map((check2) => formatCheck(check2)).join(" & ");
  }
}
function makeFormatterDefault() {
  return (issue) => toDefaultIssues(issue, [], defaultLeafHook, defaultCheckHook).map(formatDefaultIssue).join(`
`);
}
var defaultFormatter = /* @__PURE__ */ makeFormatterDefault();
function formatDefaultIssue(issue) {
  let out = issue.message;
  if (issue.path && issue.path.length > 0) {
    const path = formatPath(issue.path);
    out += `
  at ${path}`;
  }
  return out;
}
function findMessage(issue) {
  switch (issue._tag) {
    case "InvalidType":
    case "OneOf":
    case "Composite":
    case "AnyOf":
      return getMessageAnnotation(issue.ast.annotations);
    case "InvalidValue":
    case "Forbidden":
      return getMessageAnnotation(issue.annotations);
    case "MissingKey":
      return getMessageAnnotation(issue.annotations, "messageMissingKey");
    case "UnexpectedKey":
      return getMessageAnnotation(issue.ast.annotations, "messageUnexpectedKey");
    case "Filter":
      return getMessageAnnotation(issue.filter.annotations);
    case "Encoding":
      return findMessage(issue.issue);
  }
}
function getMessageAnnotation(annotations, type = "message") {
  const message = annotations?.[type];
  if (typeof message === "string")
    return message;
}

// node_modules/effect/dist/internal/schema/cause.js
function getSchemaIssue(cause) {
  let issue;
  for (const reason of cause.reasons) {
    if (!isFailReason2(reason) || !isIssue(reason.error)) {
      return;
    }
    issue ??= reason.error;
  }
  return issue;
}
function getSchemaIssueOrThrow(cause, message) {
  const issue = getSchemaIssue(cause);
  if (issue === undefined) {
    throw new Error(message, {
      cause
    });
  }
  return issue;
}

// node_modules/effect/dist/SchemaGetter.js
class Getter extends Class {
  run;
  constructor(run) {
    super();
    this.run = run;
  }
  map(f) {
    return new Getter((oe, options) => this.run(oe, options).pipe(mapEager2(map(f))));
  }
  compose(other) {
    if (isPassthrough(this)) {
      return other;
    }
    if (isPassthrough(other)) {
      return this;
    }
    return new Getter((oe, options) => this.run(oe, options).pipe(flatMapEager2((ot) => other.run(ot, options))));
  }
}
function fail6(f) {
  return new Getter((oe, options) => fail5(f(oe, options)));
}
function forbidden(message) {
  return fail6((oe, options) => {
    const annotations = {
      message: message(oe)
    };
    return isSome2(oe) ? new Forbidden(annotations, oe.value, options) : new Forbidden(annotations);
  });
}
var passthrough_ = /* @__PURE__ */ new Getter(succeed6);
function isPassthrough(getter) {
  return getter.run === passthrough_.run;
}
function passthrough2() {
  return passthrough_;
}
function onSome(f) {
  return new Getter((oe, options) => isNone2(oe) ? succeedNone2 : f(oe.value, options));
}
function transform(f) {
  return transformOptional(map(f));
}
function transformOrFail(f) {
  return onSome((e, options) => f(e, options).pipe(mapEager2(some2)));
}
function transformOptional(f) {
  return new Getter((oe) => succeed6(f(oe)));
}
function omit() {
  return new Getter(() => succeedNone2);
}
function withDefault(defaultValue) {
  return new Getter((o) => {
    const filtered = filter(o, isNotUndefined);
    return isSome2(filtered) ? succeed6(filtered) : mapEager2(defaultValue, some2);
  });
}
function String3() {
  return transform(globalThis.String);
}
function Number4() {
  return transform(globalThis.Number);
}
function BigInt3() {
  return transform(globalThis.BigInt);
}
function Date3() {
  return transform((u) => new globalThis.Date(u));
}
function trim2() {
  return transform(trim);
}
function parseJson(options) {
  return onSome((input, parseOptions) => try_3({
    try: () => some2(JSON.parse(input, options?.reviver)),
    catch: () => new InvalidValue({
      expected: "a valid JSON string"
    }, input, parseOptions)
  }));
}
function stringifyJson(options) {
  return onSome((input, parseOptions) => try_3({
    try: () => {
      const output = JSON.stringify(input, options?.replacer, options?.space);
      if (output === undefined) {
        throw new TypeError("Value cannot be represented as JSON");
      }
      return some2(output);
    },
    catch: () => new InvalidValue({
      expected: "a JSON-serializable value"
    }, input, parseOptions)
  }));
}
function encodeBase642() {
  return transform(encodeBase64);
}
function encodeBase64Url2() {
  return transform(encodeBase64Url);
}
function encodeHex2() {
  return transform(encodeHex);
}
function decodeBase642() {
  return transformOrFail((input, options) => mapErrorEager2(fromResult2(decodeBase64(input)), () => new InvalidValue({
    expected: "a valid Base64 string"
  }, input, options)));
}
function decodeBase64String2() {
  return transformOrFail((input, options) => match3(decodeBase64String(input), {
    onFailure: () => fail5(new InvalidValue({
      expected: "a valid Base64 string"
    }, input, options)),
    onSuccess: succeed6
  }));
}
function decodeBase64Url2() {
  return transformOrFail((input, options) => match3(decodeBase64Url(input), {
    onFailure: () => fail5(new InvalidValue({
      expected: "a valid Base64Url string"
    }, input, options)),
    onSuccess: succeed6
  }));
}
function decodeBase64UrlString2() {
  return transformOrFail((input, options) => match3(decodeBase64UrlString(input), {
    onFailure: () => fail5(new InvalidValue({
      expected: "a valid Base64Url string"
    }, input, options)),
    onSuccess: succeed6
  }));
}
function decodeHex2() {
  return transformOrFail((input, options) => match3(decodeHex(input), {
    onFailure: () => fail5(new InvalidValue({
      expected: "a valid hexadecimal string"
    }, input, options)),
    onSuccess: succeed6
  }));
}
function decodeHexString2() {
  return transformOrFail((input, options) => match3(decodeHexString(input), {
    onFailure: () => fail5(new InvalidValue({
      expected: "a valid hexadecimal string"
    }, input, options)),
    onSuccess: succeed6
  }));
}
function encodeUriComponent() {
  return transform(encodeURIComponent);
}
function decodeUriComponent() {
  return transformOrFail((input, options) => {
    try {
      return succeed6(globalThis.decodeURIComponent(input));
    } catch {
      return fail5(new InvalidValue({
        expected: "a valid URI component"
      }, input, options));
    }
  });
}
function dateTimeUtcFromInput() {
  return transformOrFail((input, options) => {
    return match(make11(input), {
      onNone: () => fail5(new InvalidValue({
        message: "Invalid DateTime input"
      }, input, options)),
      onSome: (dt) => succeed6(toUtc2(dt))
    });
  });
}
function decodeFormData() {
  return transform((input) => makeTreeRecord(Array.from(input.entries())));
}
var collectFormDataEntries = /* @__PURE__ */ collectBracketPathEntries((value3) => typeof value3 === "string" || typeof Blob !== "undefined" && value3 instanceof Blob);
function encodeFormData() {
  return transform((input) => {
    const out = new FormData;
    if (typeof input === "object" && input !== null) {
      const entries3 = collectFormDataEntries(input);
      entries3.forEach(([key, value3]) => {
        out.append(key, value3);
      });
    }
    return out;
  });
}
function decodeURLSearchParams() {
  return transform((input) => makeTreeRecord(Array.from(input.entries())));
}
var collectURLSearchParamsEntries = /* @__PURE__ */ collectBracketPathEntries(isString);
function encodeURLSearchParams() {
  return transform((input) => {
    if (typeof input === "object" && input !== null) {
      return new URLSearchParams(collectURLSearchParamsEntries(input));
    }
    return new URLSearchParams;
  });
}
var INDEX_REGEXP = /^\d+$/;
function bracketPathToTokens(bracketPath) {
  if (bracketPath === "") {
    return [""];
  }
  const replaced = bracketPath.replace(/\[(.*?)\]/g, ".$1");
  const parts = replaced.split(".");
  const start = replaced.startsWith(".") ? 1 : 0;
  return parts.slice(start).map((part) => INDEX_REGEXP.test(part) ? globalThis.Number(part) : part);
}
function makeTreeRecord(bracketPathEntries) {
  const out = {};
  const containers = new WeakSet;
  function getOrCreateContainer(self, key, shouldBeArray) {
    const current = Object.hasOwn(self, key) ? self[key] : undefined;
    if (containers.has(current) && Array.isArray(current) === shouldBeArray) {
      return current;
    }
    const container = shouldBeArray ? [] : {};
    containers.add(container);
    assignProperty(self, key, container);
    return container;
  }
  bracketPathEntries.forEach(([key, value3]) => {
    const tokens = bracketPathToTokens(key);
    let cur = out;
    tokens.forEach((token, i) => {
      const isLast = i === tokens.length - 1;
      if (Array.isArray(cur) && token === "") {
        if (isLast) {
          cur.push(value3);
        } else {
          const next = tokens[i + 1];
          const shouldBeArray = typeof next === "number" || next === "";
          const index2 = cur.length;
          cur = getOrCreateContainer(cur, index2, shouldBeArray);
        }
      } else if (isLast) {
        const hasOwn = Object.hasOwn(cur, token);
        if (hasOwn && Array.isArray(cur[token])) {
          cur[token].push(value3);
        } else if (hasOwn) {
          assignProperty(cur, token, [cur[token], value3]);
        } else {
          assignProperty(cur, token, value3);
        }
      } else {
        const next = tokens[i + 1];
        const shouldBeArray = typeof next === "number" || next === "";
        cur = getOrCreateContainer(cur, token, shouldBeArray);
      }
    });
  });
  return out;
}
function collectBracketPathEntries(isLeaf) {
  return (input) => {
    const bracketPathEntries = [];
    function append2(key, value3) {
      if (isLeaf(value3)) {
        bracketPathEntries.push([key, value3]);
      } else if (Array.isArray(value3)) {
        const allLeaves = value3.every(isLeaf);
        if (allLeaves) {
          value3.forEach((v) => {
            bracketPathEntries.push([key, v]);
          });
        } else {
          value3.forEach((v, i) => {
            append2(`${key}[${i}]`, v);
          });
        }
      } else if (typeof value3 === "object" && value3 !== null) {
        for (const [k, v] of Object.entries(value3)) {
          append2(`${key}[${k}]`, v);
        }
      }
    }
    for (const [key, value3] of Object.entries(input)) {
      append2(key, value3);
    }
    return bracketPathEntries;
  };
}

// node_modules/effect/dist/SchemaTransformation.js
class Middleware {
  _tag = "Middleware";
  decode;
  encode;
  constructor(decode, encode) {
    this.decode = decode;
    this.encode = encode;
  }
  flip() {
    return new Middleware(this.encode, this.decode);
  }
}
var TypeId17 = "~effect/SchemaTransformation/Transformation";

class Transformation {
  [TypeId17] = TypeId17;
  _tag = "Transformation";
  decode;
  encode;
  constructor(decode, encode) {
    this.decode = decode;
    this.encode = encode;
  }
  flip() {
    return new Transformation(this.encode, this.decode);
  }
  compose(other) {
    return new Transformation(this.decode.compose(other.decode), other.encode.compose(this.encode));
  }
}
function isTransformation(u) {
  return hasProperty(u, TypeId17) && u[TypeId17] === TypeId17;
}
var make14 = (options) => {
  if (isTransformation(options)) {
    return options;
  }
  return new Transformation(options.decode, options.encode);
};
function transformOrFail2(options) {
  return new Transformation(transformOrFail(options.decode), transformOrFail(options.encode));
}
function transform2(options) {
  return new Transformation(transform(options.decode), transform(options.encode));
}
function transformOptional2(options) {
  return new Transformation(transformOptional(options.decode), transformOptional(options.encode));
}
function trim3() {
  return new Transformation(trim2(), passthrough2());
}
var passthrough_2 = /* @__PURE__ */ new Transformation(/* @__PURE__ */ passthrough2(), /* @__PURE__ */ passthrough2());
function passthrough3() {
  return passthrough_2;
}
var numberFromString = /* @__PURE__ */ new Transformation(/* @__PURE__ */ Number4(), /* @__PURE__ */ String3());
var bigintFromString = /* @__PURE__ */ new Transformation(/* @__PURE__ */ BigInt3(), /* @__PURE__ */ String3());
var dateFromString = /* @__PURE__ */ new Transformation(/* @__PURE__ */ Date3(), /* @__PURE__ */ transform(formatDate));
var dateFromMillis = /* @__PURE__ */ new Transformation(/* @__PURE__ */ Date3(), /* @__PURE__ */ transform((date) => date.getTime()));
var durationFromString = /* @__PURE__ */ transformOrFail2({
  decode: (s, options) => match(fromInput(s), {
    onNone: () => fail5(new InvalidValue({
      expected: "a valid Duration string"
    }, s, options)),
    onSome: succeed6
  }),
  encode: (duration) => succeed6(globalThis.String(duration))
});
var durationFromNanos = /* @__PURE__ */ transformOrFail2({
  decode: (i) => succeed6(nanos(i)),
  encode: (a, options) => match(toNanos(a), {
    onNone: () => fail5(new InvalidValue({
      expected: "a Duration representable as a bigint"
    }, a, options)),
    onSome: (nanos2) => succeed6(nanos2)
  })
});
var durationFromMillis = /* @__PURE__ */ transform2({
  decode: (i) => millis(i),
  encode: (a) => toMillis(a)
});
var isJsonError = (input) => isObject(input) && typeof input["message"] === "string";
var decodeJsonError = (input) => {
  const hasCause = Object.hasOwn(input, "cause");
  const err = hasCause ? new Error(input.message, {
    cause: decodeDefect(input.cause)
  }) : new Error(input.message);
  if (typeof input.name === "string" && input.name !== "Error")
    err.name = input.name;
  if (typeof input.stack === "string")
    err.stack = input.stack;
  return err;
};
var encodeUnknownAsJson = (input) => {
  try {
    const json = formatJson(input);
    return json === undefined ? format(input) : JSON.parse(json);
  } catch {
    return format(input);
  }
};
var encodeJsonError = (input, options, encodeDefect) => {
  const encoded = {
    name: input.name,
    message: typeof input.message === "string" ? input.message : ""
  };
  if (options?.includeStack && typeof input.stack === "string") {
    encoded.stack = input.stack;
  }
  if (!options?.excludeCause && input.cause !== undefined) {
    encoded.cause = encodeDefect(input.cause);
  }
  return encoded;
};
var makeEncodeDefect = (options) => {
  const seen = new WeakSet;
  const encode = (input) => {
    if (isError(input)) {
      if (seen.has(input)) {
        return "[Circular]";
      }
      seen.add(input);
      const encoded = encodeJsonError(input, options, encode);
      seen.delete(input);
      return encoded;
    }
    return encodeUnknownAsJson(input);
  };
  return encode;
};
var decodeDefect = (input) => isJsonError(input) ? decodeJsonError(input) : input;
var errorFromJsonError = (options) => transform2({
  decode: decodeJsonError,
  encode: (input) => makeEncodeDefect(options)(input)
});
var defectFromJson = (options) => transform2({
  decode: decodeDefect,
  encode: makeEncodeDefect(options)
});
function optionFromNullOr() {
  return transform2({
    decode: fromNullOr,
    encode: getOrNull
  });
}
function optionFromUndefinedOr() {
  return transform2({
    decode: fromUndefinedOr,
    encode: getOrUndefined
  });
}
function optionFromNullishOr(options) {
  return transform2({
    decode: fromNullishOr,
    encode: options?.onNoneEncoding === null ? getOrNull : getOrUndefined
  });
}
function optionFromOptionalKey() {
  return transformOptional2({
    decode: some2,
    encode: flatten
  });
}
function optionFromOptional() {
  return transformOptional2({
    decode: (ot) => ot.pipe(filter(isNotUndefined), some2),
    encode: flatten
  });
}
var urlFromString = /* @__PURE__ */ transformOrFail2({
  decode: (s, options) => URL.canParse(s) ? succeed6(new URL(s)) : fail5(new InvalidValue({
    expected: "a valid URL string"
  }, s, options)),
  encode: (url) => succeed6(url.href)
});
var bigDecimalFromString = /* @__PURE__ */ transformOrFail2({
  decode: (s, options) => {
    const result3 = fromString(s);
    return isNone2(result3) ? fail5(new InvalidValue({
      expected: "a valid BigDecimal string"
    }, s, options)) : succeed6(result3.value);
  },
  encode: (bd) => succeed6(format2(bd))
});
var uint8ArrayFromBase64String = /* @__PURE__ */ new Transformation(/* @__PURE__ */ decodeBase642(), /* @__PURE__ */ encodeBase642());
var stringFromBase64String = /* @__PURE__ */ new Transformation(/* @__PURE__ */ decodeBase64String2(), /* @__PURE__ */ encodeBase642());
var stringFromBase64UrlString = /* @__PURE__ */ new Transformation(/* @__PURE__ */ decodeBase64UrlString2(), /* @__PURE__ */ encodeBase64Url2());
var stringFromHexString = /* @__PURE__ */ new Transformation(/* @__PURE__ */ decodeHexString2(), /* @__PURE__ */ encodeHex2());
var stringFromUriComponent = /* @__PURE__ */ new Transformation(/* @__PURE__ */ decodeUriComponent(), /* @__PURE__ */ encodeUriComponent());
function fromJsonString(options) {
  return new Transformation(parseJson(options ?? {}), stringifyJson(options));
}
var fromFormData = /* @__PURE__ */ new Transformation(/* @__PURE__ */ decodeFormData(), /* @__PURE__ */ encodeFormData());
var fromURLSearchParams = /* @__PURE__ */ new Transformation(/* @__PURE__ */ decodeURLSearchParams(), /* @__PURE__ */ encodeURLSearchParams());
var timeZoneOffsetFromNumber = /* @__PURE__ */ transform2({
  decode: (n) => zoneMakeOffset2(n),
  encode: (tz) => tz.offset
});
var timeZoneNamedFromString = /* @__PURE__ */ transformOrFail2({
  decode: (s, options) => {
    return match(zoneMakeNamed2(s), {
      onNone: () => fail5(new InvalidValue({
        expected: "a valid IANA time zone"
      }, s, options)),
      onSome: succeed6
    });
  },
  encode: (tz) => succeed6(tz.id)
});
var timeZoneFromString = /* @__PURE__ */ transformOrFail2({
  decode: (s, options) => {
    return match(zoneFromString2(s), {
      onNone: () => fail5(new InvalidValue({
        expected: "a valid time zone"
      }, s, options)),
      onSome: succeed6
    });
  },
  encode: (tz) => succeed6(zoneToString2(tz))
});
var dateTimeUtcFromString = /* @__PURE__ */ transformOrFail2({
  decode: (s, options) => {
    return match(make11(s), {
      onNone: () => fail5(new InvalidValue({
        expected: "a valid UTC DateTime string"
      }, s, options)),
      onSome: (result3) => succeed6(toUtc2(result3))
    });
  },
  encode: (utc) => succeed6(formatIso2(utc))
});
var dateTimeZonedFromString = /* @__PURE__ */ transformOrFail2({
  decode: (s, options) => {
    return match(makeZonedFromString2(s), {
      onNone: () => fail5(new InvalidValue({
        expected: "a valid Zoned DateTime string"
      }, s, options)),
      onSome: succeed6
    });
  },
  encode: (zoned) => succeed6(formatIsoZoned2(zoned))
});

// node_modules/effect/dist/SchemaAST.js
function makeGuard(tag) {
  return (ast) => ast._tag === tag;
}
var isDeclaration = /* @__PURE__ */ makeGuard("Declaration");
var isNever2 = /* @__PURE__ */ makeGuard("Never");
var isLiteral = /* @__PURE__ */ makeGuard("Literal");
var isUniqueSymbol = /* @__PURE__ */ makeGuard("UniqueSymbol");
var isArrays = /* @__PURE__ */ makeGuard("Arrays");
var isObjects = /* @__PURE__ */ makeGuard("Objects");
var isUnion = /* @__PURE__ */ makeGuard("Union");
var isSuspend = /* @__PURE__ */ makeGuard("Suspend");

class Link {
  to;
  transformation;
  constructor(to, transformation) {
    this.to = to;
    this.transformation = transformation;
  }
}
var defaultParseOptions = {};

class Context {
  isOptional;
  isMutable;
  constructorDefault;
  annotations;
  constructor(isOptional, isMutable, constructorDefault = undefined, annotations = undefined) {
    this.isOptional = isOptional;
    this.isMutable = isMutable;
    this.constructorDefault = constructorDefault;
    this.annotations = annotations;
  }
}
var TypeId18 = "~effect/Schema";

class Base2 {
  [TypeId18] = TypeId18;
  annotations;
  checks;
  encoding;
  context;
  constructor(annotations = undefined, checks = undefined, encoding = undefined, context3 = undefined) {
    this.annotations = annotations;
    this.checks = checks;
    this.encoding = encoding;
    this.context = context3;
  }
  toString() {
    return `<${this._tag}>`;
  }
}

class Declaration extends Base2 {
  _tag = "Declaration";
  typeParameters;
  run;
  encodingChecks;
  constructor(typeParameters, run, annotations, checks, encoding, context3, encodingChecks) {
    super(annotations, checks, encoding, context3);
    this.typeParameters = typeParameters;
    this.run = run;
    this.encodingChecks = encodingChecks;
  }
  getParser() {
    let run;
    return (input, options) => {
      if (input === missing)
        return missingExit;
      return (run ??= this.run(this.typeParameters))(input, this, options);
    };
  }
  _rebuild(recur, checks, encodingChecks) {
    const tps = mapOrSame(this.typeParameters, recur);
    return tps === this.typeParameters && checks === this.checks && encodingChecks === this.encodingChecks ? this : new Declaration(tps, this.run, this.annotations, checks, undefined, this.context, encodingChecks);
  }
  recur(recur) {
    return this._rebuild(recur, this.checks, this.encodingChecks);
  }
  flip(recur) {
    return this._rebuild(recur, this.encodingChecks, this.checks);
  }
  getExpected() {
    const expected = this.annotations?.expected;
    if (typeof expected === "string")
      return expected;
    return "<Declaration>";
  }
}

class Null extends Base2 {
  _tag = "Null";
  getParser() {
    return fromConst(this, null);
  }
  getExpected() {
    return "null";
  }
}
var null_ = /* @__PURE__ */ new Null;
class Undefined extends Base2 {
  _tag = "Undefined";
  getParser() {
    return fromConst(this, undefined);
  }
  toCodecJson() {
    return replaceEncoding(this, [undefinedToNull]);
  }
  getExpected() {
    return "undefined";
  }
}
var undefinedToNull = /* @__PURE__ */ new Link(null_, /* @__PURE__ */ new Transformation(/* @__PURE__ */ transform(() => {
  return;
}), /* @__PURE__ */ transform(() => null)));
var undefined_3 = /* @__PURE__ */ new Undefined;
class Void extends Base2 {
  _tag = "Void";
  getParser() {
    const succeed8 = succeed7(undefined);
    return (input) => input === missing ? missingExit : succeed8;
  }
  toCodecJson() {
    return replaceEncoding(this, [undefinedToNull]);
  }
  getExpected() {
    return "void";
  }
}
var void_4 = /* @__PURE__ */ new Void;
class Never extends Base2 {
  _tag = "Never";
  getParser() {
    return fromRefinement(this, isNever);
  }
  getExpected() {
    return "never";
  }
}
var never3 = /* @__PURE__ */ new Never;

class Any extends Base2 {
  _tag = "Any";
  getParser() {
    return fromRefinement(this, isUnknown);
  }
  getExpected() {
    return "any";
  }
}
var any = /* @__PURE__ */ new Any;

class Unknown extends Base2 {
  _tag = "Unknown";
  getParser() {
    return fromRefinement(this, isUnknown);
  }
  getExpected() {
    return "unknown";
  }
}
var unknown = /* @__PURE__ */ new Unknown;

class ObjectKeyword extends Base2 {
  _tag = "ObjectKeyword";
  getParser() {
    return fromRefinement(this, isObjectKeyword);
  }
  getExpected() {
    return "object | array | function";
  }
}
var objectKeyword = /* @__PURE__ */ new ObjectKeyword;

class Enum extends Base2 {
  _tag = "Enum";
  enums;
  constructor(enums, annotations, checks, encoding, context3) {
    super(annotations, checks, encoding, context3);
    this.enums = enums;
  }
  getParser() {
    const values2 = new Set(this.enums.map(([, v]) => v));
    return fromRefinement(this, (input) => values2.has(input));
  }
  toCodecStringTree() {
    if (this.enums.some(([_, v]) => typeof v === "number")) {
      const coercions = Object.fromEntries(this.enums.map(([_, v]) => [globalThis.String(v), v]));
      return replaceEncoding(this, [new Link(new Union(Object.keys(coercions).map((k) => new Literal(k)), "anyOf"), new Transformation(transform((s) => coercions[s]), String3()))]);
    }
    return this;
  }
  getExpected() {
    return this.enums.map(([_, value3]) => JSON.stringify(value3)).join(" | ");
  }
}
function isTemplateLiteralPart(ast) {
  switch (ast._tag) {
    case "String":
    case "Number":
    case "BigInt":
      return true;
    case "Literal":
    case "TemplateLiteral":
      return !ast.checks;
    case "Union":
      return !ast.checks && ast.types.every(isTemplateLiteralPart);
    default:
      return false;
  }
}

class TemplateLiteral extends Base2 {
  _tag = "TemplateLiteral";
  parts;
  encodedParts;
  literals;
  suffixLengths;
  constructor(parts, annotations, checks, encoding, context3) {
    super(annotations, checks, encoding, context3);
    const encodedParts = [];
    const literals = [];
    for (const part of parts) {
      const encoded = toEncoded(part);
      if (isTemplateLiteralPart(encoded)) {
        encodedParts.push(encoded);
        literals.push(encoded._tag === "Literal" ? globalThis.String(encoded.literal) : undefined);
      } else {
        throw new Error(`Invalid TemplateLiteral part ${encoded._tag}`);
      }
    }
    const suffixLengths = new Array(encodedParts.length + 1);
    suffixLengths[encodedParts.length] = 0;
    for (let i = encodedParts.length - 1;i >= 0; i--) {
      suffixLengths[i] = suffixLengths[i + 1] + (literals[i]?.length ?? 0);
    }
    this.parts = parts;
    this.encodedParts = encodedParts;
    this.literals = literals;
    this.suffixLengths = suffixLengths;
  }
  getParser(compile) {
    const parser = compile(this.asTemplateLiteralParser());
    return (input, options) => {
      if (input === missing)
        return missingExit;
      const result3 = parser(input, options);
      if (result3._tag === "Success") {
        return sameExit;
      }
      return mapBothEager2(result3, {
        onSuccess: () => input,
        onFailure: (issue) => new Composite(this, [issue], input, options)
      });
    };
  }
  getExpected() {
    return "string";
  }
  matchPart(s, options) {
    return segmentTemplateLiteralParts(this, s, options) === undefined ? undefined : s;
  }
  asTemplateLiteralParser() {
    const tuple = new Arrays(false, this.parts.map(partFromString), []);
    return decodeTo(string2, tuple, new Transformation(transformOrFail((s, options) => {
      const segments = segmentTemplateLiteralParts(this, s, options);
      if (segments)
        return succeed6(segments);
      return fail5(new InvalidValue({
        expected: "a string matching template literal parts"
      }, s, options));
    }), transform((parts) => parts.join(""))));
  }
}

class UniqueSymbol extends Base2 {
  _tag = "UniqueSymbol";
  symbol;
  constructor(symbol3, annotations, checks, encoding, context3) {
    super(annotations, checks, encoding, context3);
    this.symbol = symbol3;
  }
  getParser() {
    return fromConst(this, this.symbol);
  }
  toCodecStringTree() {
    return replaceEncoding(this, [symbolToString]);
  }
  getExpected() {
    return globalThis.String(this.symbol);
  }
}

class Literal extends Base2 {
  _tag = "Literal";
  literal;
  constructor(literal, annotations, checks, encoding, context3) {
    super(annotations, checks, encoding, context3);
    if (typeof literal === "number" && !globalThis.Number.isFinite(literal)) {
      throw new Error(`A numeric literal must be finite, got ${format(literal)}`);
    }
    this.literal = literal;
  }
  getParser() {
    return fromConst(this, this.literal);
  }
  matchPart(s, _options) {
    return s === globalThis.String(this.literal) ? this.literal : undefined;
  }
  toCodecJson() {
    return typeof this.literal === "bigint" ? literalToString(this) : this;
  }
  toCodecStringTree() {
    return typeof this.literal === "string" ? this : literalToString(this);
  }
  getExpected() {
    return typeof this.literal === "string" ? JSON.stringify(this.literal) : globalThis.String(this.literal);
  }
}
function literalToString(ast) {
  const literalAsString = globalThis.String(ast.literal);
  return replaceEncoding(ast, [new Link(new Literal(literalAsString), new Transformation(transform(() => ast.literal), transform(() => literalAsString)))]);
}

class String4 extends Base2 {
  _tag = "String";
  getParser() {
    return fromRefinement(this, isString);
  }
  matchPart(s, options) {
    const checks = this.checks;
    return checks && !options.disableChecks && collectIssues(checks, s, undefined, this, options) ? undefined : s;
  }
  getExpected() {
    return "string";
  }
}
var string2 = /* @__PURE__ */ new String4;

class Number5 extends Base2 {
  _tag = "Number";
  getParser() {
    return fromRefinement(this, isNumber);
  }
  matchKey(s, options) {
    return this._match(isStringNumberRegExp, s, options);
  }
  matchPart(s, options) {
    return this._match(isStringFiniteRegExp, s, options);
  }
  _match(regexp, s, options) {
    if (!regexp.test(s))
      return;
    const value3 = globalThis.Number(s);
    if (options.disableChecks || !this.checks)
      return value3;
    return collectIssues(this.checks, value3, undefined, this, options) ? undefined : value3;
  }
  toCodecJson() {
    if (this.checks && (hasCheck(this.checks, "effect/schema/isFinite") || hasCheck(this.checks, "effect/schema/isInt"))) {
      return this;
    }
    return replaceEncoding(this, [numberToJson(this.checks)]);
  }
  toCodecStringTree() {
    if (this.toCodecJson() === this) {
      return replaceEncoding(this, [finiteToString]);
    }
    return replaceEncoding(this, [numberToString]);
  }
  getExpected() {
    return "number";
  }
}
function hasCheck(checks, id) {
  return checks.some((check) => check.annotations?.representation?.id === id || check._tag === "FilterGroup" && hasCheck(check.checks, id));
}
function numberToJson(checks) {
  const encodedFinite = !checks ? finite : appendChecks(finite, checks);
  return new Link(new Union([encodedFinite, nonFiniteLiterals], "anyOf"), new Transformation(Number4(), transform((n) => globalThis.Number.isFinite(n) ? n : globalThis.String(n))));
}
var number2 = /* @__PURE__ */ new Number5;

class Boolean extends Base2 {
  _tag = "Boolean";
  getParser() {
    return fromRefinement(this, isBoolean);
  }
  getExpected() {
    return "boolean";
  }
}
var boolean = /* @__PURE__ */ new Boolean;

class Symbol2 extends Base2 {
  _tag = "Symbol";
  getParser() {
    return fromRefinement(this, isSymbol);
  }
  matchKey(s, options) {
    if (options.disableChecks || !this.checks)
      return s;
    return collectIssues(this.checks, s, undefined, this, options) ? undefined : s;
  }
  toCodecStringTree() {
    return replaceEncoding(this, [symbolToString]);
  }
  getExpected() {
    return "symbol";
  }
}
var symbol3 = /* @__PURE__ */ new Symbol2;

class BigInt4 extends Base2 {
  _tag = "BigInt";
  getParser() {
    return fromRefinement(this, isBigInt);
  }
  matchPart(s, options) {
    if (!isStringBigIntRegExp.test(s))
      return;
    const value3 = globalThis.BigInt(s);
    if (options.disableChecks || !this.checks)
      return value3;
    return collectIssues(this.checks, value3, undefined, this, options) ? undefined : value3;
  }
  toCodecStringTree() {
    return replaceEncoding(this, [bigIntToString]);
  }
  getExpected() {
    return "bigint";
  }
}
var bigInt = /* @__PURE__ */ new BigInt4;

class Arrays extends Base2 {
  _tag = "Arrays";
  isMutable;
  elements;
  rest;
  encodingChecks;
  constructor(isMutable, elements, rest, annotations, checks, encoding, context3, encodingChecks) {
    super(annotations, checks, encoding, context3);
    this.isMutable = isMutable;
    this.elements = elements;
    this.rest = rest;
    this.encodingChecks = encodingChecks;
    let hasOptional = false;
    for (let i = 0;i < elements.length; i++) {
      if (isOptional(elements[i])) {
        hasOptional = true;
      } else if (hasOptional) {
        throw new Error("A required element cannot follow an optional element. ts(1257)");
      }
    }
    if (hasOptional && rest.length > 1) {
      throw new Error("A required element cannot follow an optional element. ts(1257)");
    }
    for (let i = 1;i < rest.length; i++) {
      if (isOptional(rest[i])) {
        throw new Error("An optional element cannot follow a rest element. ts(1266)");
      }
    }
  }
  getParser(compile, compileConstructorDefault = compile) {
    const ast = this;
    let elements;
    let rest;
    const elementLen = ast.elements.length;
    const tailLen = Math.max(0, ast.rest.length - 1);
    function getParser(tailThreshold, index2) {
      if (index2 < elementLen) {
        return elements[index2];
      } else if (index2 >= tailThreshold) {
        return rest[index2 - tailThreshold + 1];
      }
      return rest[0];
    }
    return fnUntracedEager2(function* (input, options) {
      if (input === missing) {
        return missing;
      }
      if (!Array.isArray(input)) {
        return yield* fail5(new InvalidType(ast, input, options));
      }
      if (!elements) {
        elements = ast.elements.map((ast2) => ({
          ast: ast2,
          parser: compileConstructorDefault(ast2)
        }));
        rest = ast.rest.map((ast2) => ({
          ast: ast2,
          parser: compileConstructorDefault(ast2)
        }));
      }
      const len = input.length;
      const state = {
        ast,
        getParser,
        input,
        len,
        tailThreshold: Math.max(elementLen, len - tailLen),
        output: new globalThis.Array(len),
        issues: undefined,
        options
      };
      const concurrency = resolveConcurrency(options?.concurrency);
      const eff = parseArray(state, input, {
        concurrency: concurrency?.concurrency,
        end: ast.rest.length === 0 ? elementLen : Math.max(len, elementLen + tailLen)
      });
      if (eff)
        yield* eff;
      if (ast.rest.length === 0 && len > elementLen) {
        for (let i = elementLen;i <= len - 1; i++) {
          const unexpected = new UnexpectedKey(ast, input[i], options);
          const issue = new Pointer([i], unexpected);
          if (options.errors === "all") {
            if (state.issues)
              state.issues.push(issue);
            else
              state.issues = [issue];
          } else {
            return yield* fail5(new Composite(ast, [issue], input, options));
          }
        }
      }
      if (state.issues) {
        return yield* fail5(new Composite(ast, state.issues, input, options));
      }
      return state.output;
    });
  }
  _rebuild(recur, checks, encodingChecks) {
    const elements = mapOrSame(this.elements, recur);
    const rest = mapOrSame(this.rest, recur);
    return elements === this.elements && rest === this.rest && checks === this.checks && encodingChecks === this.encodingChecks ? this : new Arrays(this.isMutable, elements, rest, this.annotations, checks, undefined, this.context, encodingChecks);
  }
  recur(recur) {
    return this._rebuild(recur, this.checks, this.encodingChecks);
  }
  flip(recur) {
    return this._rebuild(recur, this.encodingChecks, this.checks);
  }
  getExpected() {
    return "array";
  }
}
var parseArray = /* @__PURE__ */ iterateEager()({
  onItem(s, item, i) {
    const value3 = i < s.len ? item : missing;
    return s.getParser(s.tailThreshold, i).parser(value3, s.options);
  },
  step(s, item, exit3, i) {
    if (exit3._tag === "Failure") {
      return wrapPropertyKeyIssue(s, s.ast, i, exit3);
    }
    const value3 = exit3 === sameExit ? item : exit3[args];
    if (value3 !== missing) {
      s.output[i] = value3;
    } else {
      const p = s.getParser(s.tailThreshold, i);
      if (isOptional(p.ast))
        return;
      const issue = new Pointer([i], new MissingKey(p.ast.context?.annotations));
      if (s.options.errors === "all") {
        if (s.issues)
          s.issues.push(issue);
        else
          s.issues = [issue];
      } else {
        return fail4(new Composite(s.ast, [issue], s.input, s.options));
      }
    }
  }
});
var resolveConcurrency = (value3) => {
  value3 = value3 === "unbounded" ? Infinity : value3 ?? 1;
  return value3 > 1 ? {
    concurrency: value3
  } : undefined;
};
var wrapPropertyKeyIssue = (s, ast, key, exit3) => {
  if (exit3.cause.reasons.length === 0) {
    return exit3;
  }
  const issue = getSchemaIssue(exit3.cause);
  if (issue === undefined) {
    return failCause2(map6(exit3.cause, (issue2) => new Composite(ast, [new Pointer([key], issue2)], s.input, s.options)));
  }
  const pointer = new Pointer([key], issue);
  if (s.options.errors === "all") {
    if (s.issues)
      s.issues.push(pointer);
    else
      s.issues = [pointer];
  } else {
    return fail4(new Composite(ast, [pointer], s.input, s.options));
  }
};
var FINITE_PATTERN = "[+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?";
function getIndexSignatureKeys(input, parameter, options = defaultParseOptions) {
  let stringKeys;
  let symbolKeys;
  function go(parameter2) {
    switch (parameter2._tag) {
      case "String":
      case "TemplateLiteral":
        return (stringKeys ??= Object.keys(input)).filter((k) => parameter2.matchPart(k, options) !== undefined);
      case "Number":
        return (stringKeys ??= Object.keys(input)).filter((k) => parameter2.matchKey(k, options) !== undefined);
      case "Symbol":
        return (symbolKeys ??= Object.getOwnPropertySymbols(input)).filter((k) => parameter2.matchKey(k, options) !== undefined);
      case "Union":
        return [...new Set(parameter2.types.flatMap(go))];
      default:
        return [];
    }
  }
  return go(parameterFromPropertyKey(toEncoded(parameter)));
}

class PropertySignature {
  name;
  type;
  constructor(name, type) {
    this.name = name;
    this.type = type;
  }
}
function isIndexSignatureParameterSide(ast) {
  switch (ast._tag) {
    case "String":
    case "Number":
    case "Symbol":
    case "TemplateLiteral":
      return true;
    case "Union":
      return ast.types.every(isIndexSignatureParameterSide);
    default:
      return false;
  }
}
function isIndexSignatureParameter(ast) {
  return isIndexSignatureParameterSide(ast) && isIndexSignatureParameterSide(toEncoded(ast));
}

class IndexSignature {
  parameter;
  type;
  constructor(parameter, type) {
    if (!isIndexSignatureParameter(parameter)) {
      throw new Error(`Invalid index signature parameter ${parameter._tag}`);
    }
    this.parameter = parameter;
    this.type = type;
    if (isOptional(type) && !containsUndefined(type)) {
      throw new Error("Cannot use `Schema.optionalKey` with index signatures, use `Schema.optional` instead.");
    }
  }
}

class Objects extends Base2 {
  _tag = "Objects";
  propertySignatures;
  indexSignatures;
  encodingChecks;
  constructor(propertySignatures, indexSignatures, annotations, checks, encoding, context3, encodingChecks) {
    super(annotations, checks, encoding, context3);
    this.propertySignatures = propertySignatures;
    this.indexSignatures = indexSignatures;
    this.encodingChecks = encodingChecks;
    const duplicates = propertySignatures.map((ps) => ps.name).filter((name, i, arr) => arr.indexOf(name) !== i);
    if (duplicates.length > 0) {
      throw new Error(`Duplicate identifiers: ${JSON.stringify(duplicates)}. ts(2300)`);
    }
  }
  getParser(compile, compileConstructorDefault = compile) {
    const ast = this;
    const expectedKeys = [];
    for (const ps of ast.propertySignatures) {
      expectedKeys.push(ps.name);
    }
    const hasProperties = expectedKeys.length;
    const indexCount = ast.indexSignatures.length;
    let expectedKeysSet = hasProperties && indexCount ? new Set(expectedKeys) : undefined;
    if (!hasProperties && !indexCount) {
      return fromRefinement(ast, isNotNullish);
    }
    let properties;
    let indexes;
    const finishIndex = (s, key, k2, inputValue, exitValue) => {
      if (exitValue._tag === "Failure") {
        return wrapPropertyKeyIssue(s, ast, key, exitValue) ?? void_2;
      }
      const value3 = exitValue === sameExit ? inputValue : exitValue[args];
      if (k2 !== missing && value3 !== missing) {
        if (hasProperties && (expectedKeysSet.has(key) || expectedKeysSet.has(k2)))
          return void_2;
        assignProperty(s.out, k2, value3);
      }
      return void_2;
    };
    const parseIndex = (s, key, index2, exitKey) => {
      if (!exitKey) {
        const eff = index2.parserKey(key, s.options);
        if (!effectIsExit(eff)) {
          return flatMap4(exit2(eff), (exit3) => parseIndex(s, key, index2, exit3));
        }
        exitKey = eff;
      }
      if (exitKey._tag === "Failure") {
        return wrapPropertyKeyIssue(s, ast, key, exitKey) ?? void_2;
      }
      const k2 = exitKey === sameExit ? key : exitKey[args];
      const inputValue = s.input[key];
      const result3 = index2.parserValue(inputValue, s.options);
      return effectIsExit(result3) ? finishIndex(s, key, k2, inputValue, result3) : flatMap4(exit2(result3), (exit3) => finishIndex(s, key, k2, inputValue, exit3));
    };
    const parseStringIndex = (s, key, index2) => {
      const inputValue = s.input[key];
      const result3 = index2.parserValue(inputValue, s.options);
      return effectIsExit(result3) ? finishIndex(s, key, key, inputValue, result3) : flatMap4(exit2(result3), (exit3) => finishIndex(s, key, key, inputValue, exit3));
    };
    const parseIndexes = indexCount ? iterateEager()({
      onItem: (s, [key, index2]) => parseIndex(s, key, index2),
      step: (_s, _, exit3) => exit3._tag === "Failure" ? exit3 : undefined
    }) : undefined;
    return fnUntracedEager2(function* (input, options) {
      if (input === missing) {
        return missing;
      }
      if (!(typeof input === "object" && input !== null && !Array.isArray(input))) {
        return yield* fail5(new InvalidType(ast, input, options));
      }
      if (!properties) {
        properties = ast.propertySignatures.map((ps) => ({
          parser: compileConstructorDefault(ps.type),
          name: ps.name,
          type: ps.type
        }));
        indexes = indexCount ? ast.indexSignatures.map((is) => ({
          is,
          parserKey: compile(parameterFromPropertyKey(is.parameter)),
          parserValue: compileConstructorDefault(is.type)
        })) : undefined;
      }
      const record = input;
      const out = {};
      const state = {
        ast,
        input: record,
        out,
        issues: undefined,
        options
      };
      const errorsAllOption = options.errors === "all";
      const onExcessPropertyError = options.onExcessProperty === "error";
      const onExcessPropertyPreserve = options.onExcessProperty === "preserve";
      let inputKeys;
      if (!indexCount && (onExcessPropertyError || onExcessPropertyPreserve)) {
        expectedKeysSet ??= new Set(expectedKeys);
        inputKeys = Reflect.ownKeys(record);
        for (let i = 0;i < inputKeys.length; i++) {
          const key = inputKeys[i];
          if (!expectedKeysSet.has(key)) {
            if (onExcessPropertyError) {
              const unexpected = new UnexpectedKey(ast, record[key], options);
              const issue = new Pointer([key], unexpected);
              if (errorsAllOption) {
                if (state.issues) {
                  state.issues.push(issue);
                } else {
                  state.issues = [issue];
                }
                continue;
              } else {
                return yield* fail5(new Composite(ast, [issue], input, options));
              }
            } else {
              assignProperty(out, key, record[key]);
            }
          }
        }
      }
      const concurrency = resolveConcurrency(options?.concurrency);
      if (hasProperties) {
        const eff = parseProperties(state, properties, concurrency);
        if (eff)
          yield* eff;
      }
      if (indexCount && !concurrency) {
        for (let i = 0;i < indexCount; i++) {
          const index2 = indexes[i];
          const parse = index2.is.parameter === string2 ? parseStringIndex : parseIndex;
          const keys3 = index2.is.parameter === string2 ? Object.keys(record) : getIndexSignatureKeys(record, index2.is.parameter, options);
          for (let j = 0;j < keys3.length; j++) {
            const eff = parse(state, keys3[j], index2);
            if (!effectIsExit(eff))
              yield* eff;
            else if (eff._tag === "Failure")
              return yield* eff;
          }
        }
      } else if (parseIndexes) {
        const keyPairs = empty2();
        for (let i = 0;i < indexCount; i++) {
          const index2 = indexes[i];
          const keys3 = getIndexSignatureKeys(record, index2.is.parameter, options);
          for (let j = 0;j < keys3.length; j++) {
            keyPairs.push([keys3[j], index2]);
          }
        }
        const eff = parseIndexes(state, keyPairs, concurrency);
        if (eff)
          yield* eff;
      }
      if (state.issues) {
        return yield* fail5(new Composite(ast, state.issues, input, options));
      }
      if (options.propertyOrder === "original") {
        const keys3 = (inputKeys ?? Reflect.ownKeys(record)).concat(expectedKeys);
        const preserved = {};
        for (const key of keys3) {
          if (Object.hasOwn(out, key)) {
            assignProperty(preserved, key, out[key]);
          }
        }
        return preserved;
      }
      return out;
    });
  }
  _rebuild(recur, recurParameter, checks, encodingChecks) {
    const props = mapOrSame(this.propertySignatures, (ps) => {
      const t = recur(ps.type);
      return t === ps.type ? ps : new PropertySignature(ps.name, t);
    });
    const indexes = mapOrSame(this.indexSignatures, (is) => {
      const p = recurParameter(is.parameter);
      const t = recur(is.type);
      return p === is.parameter && t === is.type ? is : new IndexSignature(p, t);
    });
    return props === this.propertySignatures && indexes === this.indexSignatures && checks === this.checks && encodingChecks === this.encodingChecks ? this : new Objects(props, indexes, this.annotations, checks, undefined, this.context, encodingChecks);
  }
  flip(recur) {
    return this._rebuild(recur, recur, this.encodingChecks, this.checks);
  }
  recur(recur, recurParameter = recur) {
    return this._rebuild(recur, recurParameter, this.checks, this.encodingChecks);
  }
  getExpected() {
    if (this.propertySignatures.length === 0 && this.indexSignatures.length === 0)
      return "object | array";
    return "object";
  }
}
var parseProperties = /* @__PURE__ */ iterateEager()({
  onItem(s, p) {
    if (!Object.hasOwn(s.input, p.name)) {
      return p.parser(missing, s.options);
    }
    const value3 = s.input[p.name];
    assignProperty(s.out, p.name, value3);
    return p.parser(value3, s.options);
  },
  step(s, p, exit3) {
    if (exit3._tag === "Failure") {
      return wrapPropertyKeyIssue(s, s.ast, p.name, exit3);
    }
    if (exit3 === sameExit)
      return;
    const value3 = exit3[args];
    if (value3 !== missing) {
      assignProperty(s.out, p.name, value3);
      return;
    }
    delete s.out[p.name];
    if (!isOptional(p.type)) {
      const issue = new Pointer([p.name], new MissingKey(p.type.context?.annotations));
      if (s.options.errors === "all") {
        if (s.issues)
          s.issues.push(issue);
        else
          s.issues = [issue];
        return;
      } else {
        return fail4(new Composite(s.ast, [issue], s.input, s.options));
      }
    }
  }
});
function combineChecks(a, b) {
  if (!a)
    return b;
  if (!b)
    return a;
  return [...a, ...b];
}
function struct(fields, checks, annotations) {
  return new Objects(Reflect.ownKeys(fields).map((key) => {
    return new PropertySignature(key, fields[key].ast);
  }), [], annotations, checks);
}
function getAST(self) {
  return self.ast;
}
function tuple(elements, checks = undefined) {
  return new Arrays(false, elements.map((e) => e.ast), [], undefined, checks);
}
function union4(members, mode, checks) {
  return new Union(members.map(getAST), mode, undefined, checks);
}
function structWithRest(ast, records) {
  if (ast.encoding || records.some((r) => r.encoding)) {
    throw new Error("StructWithRest does not support encodings");
  }
  let propertySignatures = ast.propertySignatures;
  let indexSignatures = ast.indexSignatures;
  let checks = ast.checks;
  for (const record of records) {
    propertySignatures = propertySignatures.concat(record.propertySignatures);
    indexSignatures = indexSignatures.concat(record.indexSignatures);
    checks = combineChecks(checks, record.checks);
  }
  return new Objects(propertySignatures, indexSignatures, undefined, checks);
}
function tupleWithRest(ast, rest) {
  if (ast.encoding) {
    throw new Error("TupleWithRest does not support encodings");
  }
  return new Arrays(ast.isMutable, ast.elements, rest, undefined, ast.checks);
}
var toCandidate = /* @__PURE__ */ memoizeIdempotent((ast) => {
  while (true) {
    if (isSuspend(ast))
      return unknown;
    const encoding = ast.encoding;
    if (!encoding) {
      return ast.recur?.(toCandidate, identity) ?? ast;
    }
    if (encoding.some((link) => link.transformation._tag === "Middleware" && link.transformation.decode !== identity))
      return unknown;
    ast = encoding[encoding.length - 1].to;
  }
});
function getCandidateTypes(ast) {
  switch (ast._tag) {
    case "Null":
      return ["null"];
    case "Undefined":
      return ["undefined"];
    case "String":
    case "TemplateLiteral":
      return ["string"];
    case "Number":
      return ["number"];
    case "Boolean":
      return ["boolean"];
    case "Symbol":
    case "UniqueSymbol":
      return ["symbol"];
    case "BigInt":
      return ["bigint"];
    case "Arrays":
      return ["array"];
    case "ObjectKeyword":
      return ["object", "array", "function"];
    case "Objects":
      return ast.propertySignatures.length || ast.indexSignatures.length ? ["object"] : ["string", "number", "boolean", "symbol", "bigint", "object", "array", "function"];
    case "Enum":
      return Array.from(new Set(ast.enums.map(([, v]) => typeof v)));
    case "Literal":
      return [typeof ast.literal];
    case "Union":
      return Array.from(new Set(ast.types.flatMap(getCandidateTypes)));
    default:
      return ["null", "undefined", "string", "number", "boolean", "symbol", "bigint", "object", "array", "function"];
  }
}
function collectSentinels(ast) {
  switch (ast._tag) {
    default:
      return [];
    case "Declaration": {
      const s = ast.annotations?.[SENTINELS_ANNOTATION_KEY];
      return Array.isArray(s) ? s : [];
    }
    case "Objects":
      return ast.propertySignatures.flatMap((ps) => {
        const type = ps.type;
        if (!isOptional(type)) {
          if (isLiteral(type)) {
            return [{
              key: ps.name,
              literal: type.literal
            }];
          }
          if (isUniqueSymbol(type)) {
            return [{
              key: ps.name,
              literal: type.symbol
            }];
          }
        }
        return [];
      });
    case "Arrays":
      return ast.elements.flatMap((e, i) => {
        if (!isOptional(e)) {
          if (isLiteral(e)) {
            return [{
              key: i,
              literal: e.literal
            }];
          }
          if (isUniqueSymbol(e)) {
            return [{
              key: i,
              literal: e.symbol
            }];
          }
        }
        return [];
      });
    case "Suspend":
      return collectSentinels(ast.thunk());
  }
}
var candidateIndexCache = /* @__PURE__ */ new WeakMap;
var emptyCandidates = /* @__PURE__ */ Object.freeze([]);
function getIndex(types) {
  let idx = candidateIndexCache.get(types);
  if (idx)
    return idx;
  idx = {};
  let literalCandidates;
  for (let i = 0;i < types.length; i++) {
    const a = types[i];
    const encoded = toCandidate(a);
    if (isNever2(encoded))
      continue;
    if (literalCandidates !== null) {
      if (isLiteral(encoded) || isUniqueSymbol(encoded)) {
        literalCandidates ??= new Map;
        const literal = isLiteral(encoded) ? encoded.literal : encoded.symbol;
        let arr = literalCandidates.get(literal);
        if (!arr)
          literalCandidates.set(literal, arr = []);
        arr.push(a);
      } else {
        literalCandidates = null;
      }
    }
    const sentinels = collectSentinels(encoded);
    if (sentinels.length) {
      idx.bySentinel ??= new Map;
      for (const {
        key,
        literal
      } of sentinels) {
        let m = idx.bySentinel.get(key);
        if (!m)
          idx.bySentinel.set(key, m = new Map);
        let arr = m.get(literal);
        if (!arr)
          m.set(literal, arr = []);
        if (arr[arr.length - 1] !== i)
          arr.push(i);
      }
    } else {
      idx.otherwise ??= {};
      const candidateTypes = getCandidateTypes(encoded);
      for (const t of candidateTypes)
        (idx.otherwise[t] ??= []).push(i);
    }
  }
  if (literalCandidates) {
    literalCandidates.forEach(Object.freeze);
    idx = (input) => literalCandidates.get(input) ?? emptyCandidates;
  } else if (idx.bySentinel?.size === 1 && !idx.otherwise) {
    for (const [key, byValue] of idx.bySentinel) {
      const candidates = byValue;
      for (const [literal, indexes] of byValue) {
        candidates.set(literal, Object.freeze(indexes.map((index2) => types[index2])));
      }
      idx = (input, isConstructor) => {
        if (isObjectKeyword(input)) {
          const value3 = Object.hasOwn(input, key) ? input[key] : undefined;
          if (value3 !== undefined)
            return candidates.get(value3) ?? emptyCandidates;
          if (isConstructor)
            return types;
        }
        return emptyCandidates;
      };
    }
  }
  candidateIndexCache.set(types, idx);
  return idx;
}
function filterLiterals(input) {
  return (ast) => {
    const encoded = toCandidate(ast);
    return encoded._tag === "Literal" ? encoded.literal === input : encoded._tag === "UniqueSymbol" ? encoded.symbol === input : true;
  };
}
function getCandidates(input, types, isConstructor = false) {
  const idx = getIndex(types);
  if (typeof idx === "function")
    return idx(input, isConstructor);
  const runtimeType = input === null ? "null" : Array.isArray(input) ? "array" : typeof input;
  if (idx.bySentinel) {
    const base = idx.otherwise?.[runtimeType] ?? emptyCandidates;
    if (isObjectKeyword(input)) {
      const selected = new Set(base);
      for (const [k, m] of idx.bySentinel) {
        const value3 = Object.hasOwn(input, k) ? input[k] : undefined;
        if (value3 !== undefined) {
          const match7 = m.get(value3);
          if (match7) {
            for (const candidate of match7)
              selected.add(candidate);
          }
        } else if (isConstructor) {
          for (const indexes of m.values()) {
            for (const candidate of indexes)
              selected.add(candidate);
          }
        }
      }
      return Array.from(selected).sort((a, b) => a - b).map((i) => types[i]);
    }
    return base.map((i) => types[i]);
  }
  return (idx.otherwise?.[runtimeType] ?? emptyCandidates).map((i) => types[i]).filter(filterLiterals(input));
}

class Union extends Base2 {
  _tag = "Union";
  types;
  mode;
  encodingChecks;
  constructor(types, mode, annotations, checks, encoding, context3, encodingChecks) {
    super(annotations, checks, encoding, context3);
    this.types = types;
    this.mode = mode;
    this.encodingChecks = encodingChecks;
  }
  getParser(compile, compileConstructorDefault) {
    const ast = this;
    return (input, options) => {
      if (input === missing) {
        return missingExit;
      }
      const candidates = getCandidates(input, ast.types, compileConstructorDefault !== undefined);
      if (candidates.length === 1) {
        const result3 = compile(candidates[0])(input, options);
        if (result3._tag === "Success")
          return result3;
        return effectIsExit(result3) ? failSingleUnionCandidate(ast, result3.cause, input, options) : catchCause2(result3, (cause) => failSingleUnionCandidate(ast, cause, input, options));
      }
      const state = {
        ast,
        compile,
        input,
        out: undefined,
        successes: ast.mode === "oneOf" ? [] : undefined,
        issues: undefined,
        options
      };
      const concurrency = resolveConcurrency(options?.concurrency);
      const eff = parseUnion(state, candidates, concurrency ? {
        ...concurrency,
        orderedStep: true
      } : undefined);
      if (!eff) {
        if (state.out)
          return state.out;
        return fail5(new AnyOf(ast, state.issues ?? [], input, options));
      }
      return flatMapEager2(eff, (_) => {
        if (state.out === sameExit)
          return succeed6(input);
        if (state.out)
          return state.out;
        return fail5(new AnyOf(ast, state.issues ?? [], input, options));
      });
    };
  }
  _rebuild(recur, checks, encodingChecks) {
    const types = mapOrSame(this.types, recur);
    return types === this.types && checks === this.checks && encodingChecks === this.encodingChecks ? this : new Union(types, this.mode, this.annotations, checks, undefined, this.context, encodingChecks);
  }
  recur(recur) {
    return this._rebuild(recur, this.checks, this.encodingChecks);
  }
  flip(recur) {
    return this._rebuild(recur, this.encodingChecks, this.checks);
  }
  matchPart(s, options) {
    for (const type of this.types) {
      const out = type.matchPart(s, options);
      if (out !== undefined)
        return out;
    }
    return;
  }
  getExpected(getExpected2) {
    const expected = this.annotations?.expected;
    if (typeof expected === "string")
      return expected;
    if (this.types.length === 0)
      return "never";
    const types = this.types.map((type) => {
      const encoded = toEncoded(type);
      switch (encoded._tag) {
        case "Arrays": {
          const literals = encoded.elements.filter(isLiteral);
          if (literals.length > 0) {
            return `${formatIsMutable(encoded.isMutable)}[ ${literals.map((e) => getExpected2(e) + formatIsOptional(e.context?.isOptional)).join(", ")}, ... ]`;
          }
          break;
        }
        case "Objects": {
          const literals = encoded.propertySignatures.filter((ps) => isLiteral(ps.type));
          if (literals.length > 0) {
            return `{ ${literals.map((ps) => `${formatIsMutable(ps.type.context?.isMutable)}${formatPropertyKey(ps.name)}${formatIsOptional(ps.type.context?.isOptional)}: ${getExpected2(ps.type)}`).join(", ")}, ... }`;
          }
          break;
        }
      }
      return getExpected2(encoded);
    });
    return Array.from(new Set(types)).join(" | ");
  }
}
function failSingleUnionCandidate(ast, cause, input, options) {
  const issue = getSchemaIssue(cause);
  if (!issue)
    return failCause2(cause);
  return fail4(new AnyOf(ast, [issue], input, options));
}
var parseUnion = /* @__PURE__ */ iterateEager()({
  onItem(s, ast) {
    const parser = s.compile(ast);
    return parser(s.input, s.options);
  },
  step(s, candidate, exit3) {
    if (exit3._tag === "Failure") {
      const issue = getSchemaIssue(exit3.cause);
      if (issue === undefined) {
        return exit3;
      }
      if (s.issues)
        s.issues.push(issue);
      else
        s.issues = [issue];
    } else {
      if (s.out && s.successes) {
        s.successes.push(candidate);
        return fail4(new OneOf(s.ast, s.successes, s.input, s.options));
      }
      s.out = exit3;
      if (s.successes) {
        s.successes.push(candidate);
      } else {
        return void_2;
      }
    }
  }
});
var nonFiniteLiterals = /* @__PURE__ */ new Union([/* @__PURE__ */ new Literal("Infinity"), /* @__PURE__ */ new Literal("-Infinity"), /* @__PURE__ */ new Literal("NaN")], "anyOf");
function formatIsMutable(isMutable) {
  return isMutable ? "" : "readonly ";
}
function formatIsOptional(isOptional) {
  return isOptional ? "?" : "";
}
function memoizeThunk(f) {
  let done4 = false;
  let a;
  return () => {
    if (done4) {
      return a;
    }
    a = f();
    done4 = true;
    return a;
  };
}

class Suspend extends Base2 {
  _tag = "Suspend";
  thunk;
  constructor(thunk, annotations, checks, encoding, context3) {
    if (checks) {
      throw new Error("Cannot add checks to Suspend");
    }
    super(annotations, undefined, encoding, context3);
    this.thunk = memoizeThunk(thunk);
  }
  getParser(compile) {
    let parser;
    return (input, options) => (parser ??= compile(this.thunk()))(input, options);
  }
  recur(recur) {
    return new Suspend(() => recur(this.thunk()), this.annotations, undefined, undefined, this.context);
  }
  getExpected(getExpected2) {
    return getExpected2(this.thunk());
  }
}

class Filter2 extends Class {
  _tag = "Filter";
  run;
  annotations;
  aborted;
  constructor(run, annotations = undefined, aborted = false) {
    super();
    this.run = run;
    this.annotations = annotations;
    this.aborted = aborted;
  }
  annotate(annotations) {
    return new Filter2(this.run, {
      ...this.annotations,
      ...annotations
    }, this.aborted);
  }
  abort() {
    return new Filter2(this.run, this.annotations, true);
  }
  and(other, annotations) {
    return new FilterGroup([this, other], annotations);
  }
}

class FilterGroup extends Class {
  _tag = "FilterGroup";
  checks;
  annotations;
  constructor(checks, annotations = undefined) {
    super();
    this.checks = checks;
    this.annotations = annotations;
  }
  annotate(annotations) {
    return new FilterGroup(this.checks, {
      ...this.annotations,
      ...annotations
    });
  }
  and(other, annotations) {
    return new FilterGroup([this, other], annotations);
  }
}
function makeFilter(filter8, annotations, aborted = false) {
  return new Filter2((input, ast, options) => normalizeFilterOutput(ast, filter8(input, ast, options), input, options), annotations, aborted);
}
function makeFilterByGuard(is, annotations) {
  return new Filter2((input, _ast, options) => is(input) ? undefined : new InvalidValue(undefined, input, options), annotations, true);
}
function isFinite(annotations) {
  return makeFilter((n) => globalThis.Number.isFinite(n), {
    expected: "a finite number",
    representation: {
      id: "effect/schema/isFinite",
      payload: null
    },
    toJsonSchema: () => ({
      type: "number"
    }),
    toCode: () => ({
      runtime: "Schema.isFinite()"
    }),
    arbitrary: {
      constraint: {
        noInfinity: true,
        noNaN: true
      }
    },
    ...annotations
  });
}
var finite = /* @__PURE__ */ appendChecks(number2, [/* @__PURE__ */ isFinite()]);
function isPattern(regExp, annotations) {
  const source = regExp.source;
  const pattern = new globalThis.RegExp(source, regExp.flags);
  return makeFilter((s) => {
    pattern.lastIndex = 0;
    return pattern.test(s);
  }, {
    expected: `a string matching the RegExp ${source}`,
    representation: {
      id: "effect/schema/isPattern",
      payload: {
        source,
        flags: regExp.flags
      }
    },
    toJsonSchema: () => ({
      pattern: source
    }),
    arbitrary: {
      constraint: {
        patterns: [regExp.source]
      }
    },
    ...annotations
  });
}
function modifyOwnPropertyDescriptors(ast, f) {
  const d = Object.getOwnPropertyDescriptors(ast);
  f(d);
  return Object.create(Object.getPrototypeOf(ast), d);
}
var contextOwners = /* @__PURE__ */ new WeakMap;
function getContextOwner(ast) {
  return contextOwners.get(ast) ?? ast;
}
function replaceEncoding(ast, encoding) {
  if (ast.encoding === encoding) {
    return ast;
  }
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.encoding.value = encoding;
  });
}
function replaceContext(ast, context3) {
  if (ast.context === context3) {
    return ast;
  }
  const owner = getContextOwner(ast);
  if (owner.context === context3) {
    return owner;
  }
  const out = modifyOwnPropertyDescriptors(ast, (d) => {
    d.context.value = context3;
  });
  contextOwners.set(out, owner);
  return out;
}
function getLastEncoding(ast) {
  return ast.encoding ? getLastEncoding(ast.encoding[ast.encoding.length - 1].to) : ast;
}
function annotate(ast, annotations) {
  if (ast.checks) {
    const last = ast.checks[ast.checks.length - 1];
    return replaceChecks(ast, append(ast.checks.slice(0, -1), last.annotate(annotations)));
  }
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.annotations.value = {
      ...d.annotations.value,
      ...annotations
    };
  });
}
function replaceChecks(ast, checks) {
  if (ast._tag === "Suspend" && checks) {
    throw new Error("Cannot add checks to Suspend");
  }
  if (ast.checks === checks) {
    return ast;
  }
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.checks.value = checks;
  });
}
function appendChecks(ast, checks) {
  return replaceChecks(ast, combineChecks(ast.checks, checks));
}
function mapLink(link, f) {
  const to = f(link.to);
  return to === link.to ? link : new Link(to, link.transformation);
}
function updateLastLink(encoding, f) {
  const links = encoding;
  const last = links[links.length - 1];
  const out = mapLink(last, f);
  return out === last ? encoding : append(encoding.slice(0, encoding.length - 1), out);
}
function applyToLastLink(f) {
  return (ast) => ast.encoding ? replaceEncoding(ast, updateLastLink(ast.encoding, f)) : ast;
}
function replaceContextLastLink(ast, context3) {
  return applyToLastLink((ast2) => replaceContext(ast2, context3))(ast);
}
function applyToSelfOrLastLinkEncodingIdempotent(f, options) {
  function out(ast) {
    if (ast.encoding) {
      const last = ast.encoding[ast.encoding.length - 1];
      return options?.stopAt?.(last) ? ast : replaceEncoding(ast, updateLastLink(ast.encoding, out));
    }
    return f(ast);
  }
  return memoizeIdempotent(out);
}
function middlewareDecoding(ast, middleware) {
  return appendTransformation(ast, middleware, toType(ast));
}
function middlewareEncoding(ast, middleware) {
  return appendTransformation(toEncoded(ast), middleware, ast);
}
function appendTransformation(from, transformation, to) {
  const link = new Link(from, transformation);
  return replaceEncoding(to, to.encoding ? [...to.encoding, link] : [link]);
}
function brand(ast, brand2) {
  const existing = resolveBrands(ast);
  const brands = existing ? [...existing, brand2] : [brand2];
  return annotate(ast, {
    brands
  });
}
function mapOrSame(as3, f) {
  let changed = false;
  const out = new Array(as3.length);
  for (let i = 0;i < as3.length; i++) {
    const a = as3[i];
    const fa = f(a);
    if (fa !== a) {
      changed = true;
    }
    out[i] = fa;
  }
  return changed ? out : as3;
}
function annotateKey(ast, annotations) {
  const context3 = ast.context ? new Context(ast.context.isOptional, ast.context.isMutable, ast.context.constructorDefault, {
    ...ast.context.annotations,
    ...annotations
  }) : new Context(false, false, undefined, annotations);
  return replaceContext(ast, context3);
}
var optionalKey = /* @__PURE__ */ memoizeIdempotent((ast) => {
  const context3 = ast.context ? ast.context.isOptional === false ? new Context(true, ast.context.isMutable, ast.context.constructorDefault, ast.context.annotations) : ast.context : new Context(true, false);
  return optionalKeyLastLink(replaceContext(ast, context3));
});
var optionalKeyLastLink = /* @__PURE__ */ applyToLastLink(optionalKey);
var optional = /* @__PURE__ */ memoize((ast) => optionalKey(new Union([ast, undefined_3], "anyOf")));
var mutableKey = /* @__PURE__ */ memoizeIdempotent((ast) => {
  const context3 = ast.context ? ast.context.isMutable === false ? new Context(ast.context.isOptional, true, ast.context.constructorDefault, ast.context.annotations) : ast.context : new Context(false, true);
  return mutableKeyLastLink(replaceContext(ast, context3));
});
var mutableKeyLastLink = /* @__PURE__ */ applyToLastLink(mutableKey);
function withConstructorDefault(ast, defaultValue) {
  const transformation = new Transformation(withDefault(defaultValue), passthrough2());
  const constructorDefault = new Link(unknown, transformation);
  const context3 = ast.context ? new Context(ast.context.isOptional, ast.context.isMutable, constructorDefault, ast.context.annotations) : new Context(false, false, constructorDefault);
  return replaceContext(ast, context3);
}
function decodeTo(from, to, transformation) {
  return appendTransformation(from, transformation, to);
}
function parseParameter(ast) {
  const literals = [];
  const parameters = [];
  function go(ast2) {
    switch (ast2._tag) {
      case "Literal":
        if (isPropertyKey(ast2.literal)) {
          literals.push(ast2.literal);
        }
        return;
      case "UniqueSymbol":
        literals.push(ast2.symbol);
        return;
      case "Never":
        return;
      case "Union":
        for (let i = 0;i < ast2.types.length; i++) {
          go(ast2.types[i]);
        }
        return;
      default:
        parameters.push(ast2);
    }
  }
  go(ast);
  return {
    literals,
    parameters
  };
}
function record(key, value3) {
  const {
    literals,
    parameters: indexSignatures
  } = parseParameter(key);
  return new Objects(literals.map((literal) => new PropertySignature(literal, value3)), indexSignatures.map((parameter) => new IndexSignature(parameter, value3)));
}
function isOptional(ast) {
  return ast.context?.isOptional ?? false;
}
function isMutable(ast) {
  return ast.context?.isMutable ?? false;
}
function isStructuralCheck(check) {
  return check.annotations?.[STRUCTURAL_ANNOTATION_KEY] === true || check._tag === "FilterGroup" && check.checks.every(isStructuralCheck);
}
function extractStructuralChecks(checks) {
  function extract(check) {
    if (isStructuralCheck(check))
      return [check];
    return check._tag === "FilterGroup" ? check.checks.flatMap(extract) : [];
  }
  const out = checks.flatMap(extract);
  return isArrayNonEmpty2(out) ? out : undefined;
}
var toType = /* @__PURE__ */ memoizeIdempotent((ast) => {
  if (ast.encoding) {
    return toType(replaceEncoding(ast, undefined));
  }
  const out = ast;
  const type = out.recur?.(toType) ?? out;
  const encodingChecks = type.encodingChecks;
  if (encodingChecks) {
    const checks = type === ast ? encodingChecks : isArrays(type) || isObjects(type) || isDeclaration(type) && type.typeParameters.length > 0 ? extractStructuralChecks(encodingChecks) : undefined;
    return modifyOwnPropertyDescriptors(type, (d) => {
      d.encodingChecks.value = undefined;
      d.checks.value = combineChecks(type.checks, checks);
    });
  }
  return type;
});
var toEncoded = /* @__PURE__ */ memoizeIdempotent((ast) => {
  return toType(flip3(ast));
});
function flipEncoding(ast, encoding) {
  const links = encoding;
  const len = links.length;
  const last = links[len - 1];
  const ls = [new Link(flip3(replaceEncoding(ast, undefined)), links[0].transformation.flip())];
  for (let i = 1;i < len; i++) {
    ls.unshift(new Link(flip3(links[i - 1].to), links[i].transformation.flip()));
  }
  const to = flip3(last.to);
  if (to.encoding) {
    return replaceEncoding(to, [...to.encoding, ...ls]);
  } else {
    return replaceEncoding(to, ls);
  }
}
var flip3 = /* @__PURE__ */ memoize((ast) => {
  if (ast.encoding) {
    return flipEncoding(ast, ast.encoding);
  }
  const out = ast;
  return out.flip?.(flip3) ?? out.recur?.(flip3) ?? out;
});
function containsUndefined(ast) {
  switch (ast._tag) {
    case "Undefined":
      return true;
    case "Union":
      return ast.types.some(containsUndefined);
    default:
      return false;
  }
}
function fromConst(ast, value3) {
  const succeed8 = succeed7(value3);
  return (input, options) => {
    if (input === missing)
      return missingExit;
    if (input === value3)
      return succeed8;
    return fail5(new InvalidType(ast, input, options));
  };
}
function fromRefinement(ast, refinement) {
  return (input, options) => {
    if (input === missing)
      return missingExit;
    if (refinement(input))
      return sameExit;
    return fail5(new InvalidType(ast, input, options));
  };
}
function segmentTemplateLiteralParts(ast, input, options) {
  const parts = ast.encodedParts;
  const literals = ast.literals;
  const inputLength = input.length;
  for (let i = 0;i < literals.length; i++) {
    const literal = literals[i];
    if (literal && !input.includes(literal))
      return;
  }
  if (ast.suffixLengths[0] > inputLength)
    return;
  const out = new Array(parts.length);
  let failures;
  function go(i, pos) {
    if (i === parts.length)
      return pos === inputLength;
    if (failures?.has(i * (inputLength + 1) + pos))
      return false;
    const part = parts[i];
    if (i === parts.length - 1) {
      const s = input.slice(pos);
      if (part.matchPart(s, options) !== undefined) {
        out[i] = s;
        return true;
      }
    } else if (part._tag === "Literal") {
      const s = literals[i];
      if (input.startsWith(s, pos) && go(i + 1, pos + s.length)) {
        out[i] = s;
        return true;
      }
    } else {
      const maximumEnd = inputLength - ast.suffixLengths[i + 1];
      const anchor = literals[i + 1];
      let end = anchor === undefined ? maximumEnd : input.lastIndexOf(anchor, maximumEnd);
      while (end >= pos) {
        const s = input.slice(pos, end);
        if (part.matchPart(s, options) !== undefined && go(i + 1, end)) {
          out[i] = s;
          return true;
        }
        if (end === 0)
          break;
        end = anchor === undefined ? end - 1 : input.lastIndexOf(anchor, end - 1);
      }
    }
    failures ??= new Set;
    failures.add(i * (inputLength + 1) + pos);
    return false;
  }
  return go(0, 0) ? out : undefined;
}
var enumsToLiterals = /* @__PURE__ */ memoize((ast) => {
  return new Union(ast.enums.map((e) => new Literal(e[1], {
    title: e[0]
  })), "anyOf");
});
var parameterFromPropertyKey = /* @__PURE__ */ applyToSelfOrLastLinkEncodingIdempotent((ast) => {
  switch (ast._tag) {
    default:
      return ast;
    case "Number":
      return ast.toCodecStringTree();
    case "Union":
      return ast.recur(parameterFromPropertyKey);
  }
});
var parameterFromString = /* @__PURE__ */ applyToSelfOrLastLinkEncodingIdempotent((ast) => {
  switch (ast._tag) {
    default:
      return ast;
    case "Symbol":
    case "UniqueSymbol":
      return ast.toCodecStringTree();
    case "Union":
      return ast.recur(parameterFromString);
  }
});
var partFromString = /* @__PURE__ */ applyToSelfOrLastLinkEncodingIdempotent((ast) => {
  switch (ast._tag) {
    default:
      return ast;
    case "Number":
    case "Literal":
    case "BigInt":
      return ast.toCodecStringTree();
    case "Union":
      return ast.recur(partFromString);
  }
});
var STRING_PATTERN = "[\\s\\S]*?";
var isStringFiniteRegExp = /* @__PURE__ */ new globalThis.RegExp(`^${FINITE_PATTERN}$`);
var isStringNumberRegExp = /* @__PURE__ */ new globalThis.RegExp(`^(?:${FINITE_PATTERN}|Infinity|-Infinity|NaN)$`);
function isStringFinite(annotations) {
  return isPattern(isStringFiniteRegExp, {
    expected: "a string representing a finite number",
    representation: {
      id: "effect/schema/isStringFinite",
      payload: null
    },
    toJsonSchema: () => ({
      pattern: isStringFiniteRegExp.source
    }),
    ...annotations
  });
}
var finiteString = /* @__PURE__ */ appendChecks(string2, [/* @__PURE__ */ isStringFinite()]);
var finiteToString = /* @__PURE__ */ new Link(finiteString, numberFromString);
var numberToString = /* @__PURE__ */ new Link(/* @__PURE__ */ new Union([finiteString, nonFiniteLiterals], "anyOf"), numberFromString);
var BIGINT_PATTERN = "-?\\d+";
var isStringBigIntRegExp = /* @__PURE__ */ new globalThis.RegExp(`^${BIGINT_PATTERN}$`);
function isStringBigInt(annotations) {
  return isPattern(isStringBigIntRegExp, {
    expected: "a string representing a bigint",
    representation: {
      id: "effect/schema/isStringBigInt",
      payload: null
    },
    toJsonSchema: () => ({
      pattern: isStringBigIntRegExp.source
    }),
    ...annotations
  });
}
var bigIntString = /* @__PURE__ */ appendChecks(string2, [/* @__PURE__ */ isStringBigInt({
  expected: "a string representing a bigint"
})]);
var bigIntToString = /* @__PURE__ */ new Link(bigIntString, bigintFromString);
var REGEXP_PATTERN = "Symbol\\((.*)\\)";
var isStringSymbolRegExp = /* @__PURE__ */ new globalThis.RegExp(`^${REGEXP_PATTERN}$`);
var symbolString = /* @__PURE__ */ appendChecks(string2, [/* @__PURE__ */ isStringSymbol()]);
var symbolToString = /* @__PURE__ */ new Link(symbolString, /* @__PURE__ */ new Transformation(/* @__PURE__ */ transform((description) => globalThis.Symbol.for(isStringSymbolRegExp.exec(description)[1])), /* @__PURE__ */ transformOrFail((sym, options) => {
  const key = globalThis.Symbol.keyFor(sym);
  if (key !== undefined) {
    return succeed6(globalThis.String(sym));
  }
  return fail5(new Forbidden({
    message: "cannot serialize to string, Symbol is not registered"
  }, sym, options));
})));
function isStringSymbol(annotations) {
  return isPattern(isStringSymbolRegExp, {
    expected: "a string representing a symbol",
    representation: {
      id: "effect/schema/isStringSymbol",
      payload: null
    },
    toJsonSchema: () => ({
      pattern: isStringSymbolRegExp.source
    }),
    ...annotations
  });
}
function collectIssues(checks, value3, issues, ast, options) {
  for (let i = 0;i < checks.length; i++) {
    const check = checks[i];
    if (check._tag === "FilterGroup") {
      issues = collectIssues(check.checks, value3, issues, ast, options);
      if (issues && (options.errors !== "all" || issues[issues.length - 1].filter.aborted)) {
        return issues;
      }
    } else {
      const issue = check.run(value3, ast, options);
      if (issue) {
        const filter8 = new Filter(check, issue, value3, options);
        if (issues)
          issues.push(filter8);
        else
          issues = [filter8];
        if (options.errors !== "all" || check.aborted) {
          return issues;
        }
      }
    }
  }
  return issues;
}
function runChecks(checks, s) {
  const issues = collectIssues(checks, s, undefined, unknown, {
    errors: "all"
  });
  if (issues) {
    const issue = new Composite(unknown, issues);
    return fail2(issue);
  }
  return succeed2(s);
}
function getConstructorDescriptor(ast) {
  if (!isDeclaration(ast))
    return;
  const getDescriptor = ast.annotations?.[CONSTRUCTOR_ANNOTATION_KEY];
  return isFunction(getDescriptor) ? getDescriptor(ast.typeParameters) : undefined;
}
function isJsonLeaf(u) {
  return u === null || typeof u === "string" || typeof u === "boolean" || typeof u === "number" && globalThis.Number.isFinite(u);
}
function isStringTreeLeaf(u) {
  return u === undefined || typeof u === "string";
}
function isTree(u, isLeaf) {
  const cache = new WeakMap;
  const stack = [];
  outer:
    while (true) {
      if (typeof u !== "object" || u === null) {
        if (!isLeaf(u)) {
          return false;
        }
      } else {
        const value3 = u;
        const cached3 = cache.get(value3);
        if (cached3 === false) {
          return false;
        }
        if (cached3 === undefined) {
          const isArray2 = Array.isArray(value3);
          if (!isArray2) {
            const prototype = Object.getPrototypeOf(value3);
            if (prototype !== null && prototype !== Object.prototype && Object.getPrototypeOf(prototype) !== null) {
              return false;
            }
          }
          cache.set(value3, false);
          stack.push({
            value: value3,
            keys: isArray2 ? value3.length : Object.keys(value3),
            index: 0
          });
        }
      }
      while (stack.length > 0) {
        const frame = stack[stack.length - 1];
        const keys3 = frame.keys;
        if (typeof keys3 === "number") {
          if (frame.index < keys3) {
            u = frame.value[frame.index++];
            continue outer;
          }
        } else if (frame.index < keys3.length) {
          u = frame.value[keys3[frame.index++]];
          continue outer;
        }
        cache.set(frame.value, true);
        stack.pop();
      }
      return true;
    }
}
function isJson(u) {
  return isTree(u, isJsonLeaf);
}
var Json = /* @__PURE__ */ new Declaration([], () => (input, ast, options) => isJson(input) ? sameExit : fail5(new InvalidType(ast, input, options)), {
  representation: {
    id: "effect/schema/Json",
    payload: null
  },
  expected: "JSON value",
  toCodecJson: () => {
    return;
  },
  toCodecStringTree: () => unknownToStringTree,
  toArbitrary: () => (fc) => fc.jsonValue()
});
var MutableJson = /* @__PURE__ */ annotate(Json, {
  representation: {
    id: "effect/schema/MutableJson",
    payload: null
  }
});
var unknownToJson = /* @__PURE__ */ new Link(Json, /* @__PURE__ */ passthrough3());
var objectKeywordToJson = /* @__PURE__ */ new Link(/* @__PURE__ */ new Union([/* @__PURE__ */ new Arrays(false, [], [Json]), /* @__PURE__ */ new Objects([], [/* @__PURE__ */ new IndexSignature(string2, Json)])], "anyOf"), /* @__PURE__ */ passthrough3());
function isStringTree(u) {
  return isTree(u, isStringTreeLeaf);
}
var StringTree = /* @__PURE__ */ new Declaration([], () => (input, ast, options) => isStringTree(input) ? sameExit : fail5(new InvalidType(ast, input, options)), {
  expected: "StringTree",
  toCodecStringTree: () => {
    return;
  }
});
var unknownToStringTree = /* @__PURE__ */ new Link(StringTree, /* @__PURE__ */ passthrough3());

// node_modules/effect/dist/SchemaParser.js
function makeEffect(schema) {
  const parser = runWithCompiler(constructorCompiler, toType(schema.ast));
  return (input, options) => {
    return parser(input, options?.disableChecks ? options?.parseOptions ? {
      ...options.parseOptions,
      disableChecks: true
    } : {
      disableChecks: true
    } : options?.parseOptions);
  };
}
function makeOption(schema) {
  const parser = makeEffect(schema);
  return (input, options) => {
    const exit3 = runSyncExit2(parser(input, options));
    if (isSuccess4(exit3)) {
      return some2(exit3.value);
    }
    getSchemaIssueOrThrow(exit3.cause, "Option adapter can only return none for schema issues");
    return none2();
  };
}
function make15(schema) {
  const parser = makeEffect(schema);
  return (input, options) => {
    const exit3 = runSyncExit2(parser(input, options));
    if (isSuccess4(exit3)) {
      return exit3.value;
    }
    const issue = getSchemaIssueOrThrow(exit3.cause, "Constructor adapter can only throw schema issues");
    throw new Error("Schema validation failed", {
      cause: issue
    });
  };
}
function is(schema) {
  return _is(schema.ast);
}
function _is(ast) {
  const parser = asExit(run(toType(ast)));
  return (input) => {
    const exit3 = parser(input, defaultParseOptions);
    if (isSuccess4(exit3)) {
      return true;
    }
    getSchemaIssueOrThrow(exit3.cause, "Type guard adapter can only return false for schema issues");
    return false;
  };
}
function _issue(ast) {
  const parser = run(ast);
  return (input, options) => {
    const exit3 = runSyncExit2(parser(input, options));
    if (isSuccess4(exit3)) {
      return;
    }
    return getSchemaIssueOrThrow(exit3.cause, "Issue adapter can only return schema issues");
  };
}
function asserts(schema, input) {
  const parser = asExit(run(toType(schema.ast)));
  const exit3 = parser(input, defaultParseOptions);
  if (isFailure4(exit3)) {
    const issue = getSchemaIssueOrThrow(exit3.cause, "Assertion adapter can only throw schema issues");
    throw new Error("Schema validation failed", {
      cause: issue
    });
  }
}
function decodeUnknownEffect(schema, options) {
  const parser = run(schema.ast);
  return options === undefined ? parser : (input, overrideOptions) => parser(input, mergeParseOptions(options, overrideOptions));
}
var decodeEffect = decodeUnknownEffect;
function decodeUnknownExit(schema, options) {
  return asExit(decodeUnknownEffect(schema, options));
}
function decodeUnknownOption(schema, options) {
  return asOption(decodeUnknownEffect(schema, options));
}
var decodeOption = decodeUnknownOption;
function decodeUnknownResult(schema, options) {
  return asResult(decodeUnknownEffect(schema, options));
}
function decodeUnknownSync(schema, options) {
  return asSync(decodeUnknownEffect(schema, options));
}
var decodeSync = decodeUnknownSync;
function encodeUnknownEffect(schema, options) {
  const parser = run(flip3(schema.ast));
  return options === undefined ? parser : (input, overrideOptions) => parser(input, mergeParseOptions(options, overrideOptions));
}
function encodeUnknownExit(schema, options) {
  return asExit(encodeUnknownEffect(schema, options));
}
function encodeUnknownOption(schema, options) {
  return asOption(encodeUnknownEffect(schema, options));
}
var encodeOption = encodeUnknownOption;
function encodeUnknownResult(schema, options) {
  return asResult(encodeUnknownEffect(schema, options));
}
function encodeUnknownSync(schema, options) {
  return asSync(encodeUnknownEffect(schema, options));
}
var encodeSync = encodeUnknownSync;
var mergeParseOptions = (options, overrideOptions) => overrideOptions ? {
  ...options,
  ...overrideOptions
} : options;
var getValue = (value3) => {
  if (value3 === missing) {
    return fail5(new InvalidValue);
  }
  return succeed6(value3);
};
function run(ast) {
  return runWithCompiler(normalCompiler, ast);
}
function runWithCompiler(compiler, ast) {
  let parser;
  return (input, options) => {
    const result3 = (parser ??= compiler(ast))(input, options ?? defaultParseOptions);
    if (result3 === sameExit) {
      return succeed6(input);
    }
    if (!effectIsExit(result3)) {
      return flatMapEager2(result3, getValue);
    }
    return result3[args] === missing ? getValue(missing) : result3;
  };
}
function asExit(parser) {
  return (input, options) => runSyncExit2(parser(input, options));
}
function asOption(parser) {
  const parserExit = asExit(parser);
  return (input, options) => {
    const exit3 = parserExit(input, options);
    if (isSuccess4(exit3)) {
      return some2(exit3.value);
    }
    getSchemaIssueOrThrow(exit3.cause, "Option adapter can only return none for schema issues");
    return none2();
  };
}
function asResult(parser) {
  const parserExit = asExit(parser);
  return (input, options) => {
    const exit3 = parserExit(input, options);
    if (isSuccess4(exit3)) {
      return succeed2(exit3.value);
    }
    return fail2(getSchemaIssueOrThrow(exit3.cause, "Result adapter can only return schema issues"));
  };
}
function asSync(parser) {
  const parserExit = asExit(parser);
  return (input, options) => {
    const exit3 = parserExit(input, options);
    if (isSuccess4(exit3)) {
      return exit3.value;
    }
    const issue = getSchemaIssueOrThrow(exit3.cause, "Sync adapter can only throw schema issues");
    throw new Error("Schema validation failed", {
      cause: issue
    });
  };
}
var normalCompiler = /* @__PURE__ */ memoize((ast) => makeParser(ast, normalCompiler));
var constructorCompiler = /* @__PURE__ */ memoize((ast) => makeParser(ast, constructorCompiler, compileConstructorDefault));
var compileDefaulted = /* @__PURE__ */ memoize((ast) => makeParser(ast, constructorCompiler, compileConstructorDefault, ast.context?.constructorDefault));
function compileConstructorDefault(ast) {
  return ast.context?.constructorDefault ? compileDefaulted(ast) : constructorCompiler(ast);
}
function applyTransformation(result3, current, transformation, options) {
  let transformed;
  if (effectIsExit(result3) && result3._tag === "Success") {
    const optional2 = toOption(result3 === sameExit ? current : result3[args]);
    transformed = transformation._tag === "Transformation" ? transformation.decode.run(optional2, options) : transformation.decode(succeed7(optional2), options);
  } else if (transformation._tag === "Transformation") {
    transformed = flatMapEager2(result3, (value3) => transformation.decode.run(toOption(value3), options));
  } else {
    transformed = transformation.decode(mapEager2(result3, toOption), options);
  }
  return effectIsExit(transformed) && transformed._tag === "Success" ? fromOptionExit(transformed[args]) : flatMapEager2(transformed, fromOptionExit);
}
function makeConstructorParser(descriptor, compile) {
  let sourceParser;
  return (input, options) => {
    if (input === missing)
      return missingExit;
    if (descriptor.isConstructed(input))
      return sameExit;
    const result3 = (sourceParser ??= compile(descriptor.link.to))(input, options);
    return applyTransformation(result3, input, descriptor.link.transformation, options);
  };
}
function makeParser(ast, compile, compileConstructorDefault2, constructorDefault) {
  const descriptor = compileConstructorDefault2 ? getConstructorDescriptor(ast) : undefined;
  const parser = descriptor ? makeConstructorParser(descriptor, compile) : ast.getParser(compile, compileConstructorDefault2);
  const checks = ast.checks;
  const links = constructorDefault ? ast.encoding ? [...ast.encoding, constructorDefault] : [constructorDefault] : ast.encoding;
  const encodingChecks = ast.encodingChecks;
  const astOptions = (checks ? checks[checks.length - 1].annotations : ast.annotations)?.["parseOptions"];
  if (!links && !checks && !encodingChecks) {
    if (!astOptions) {
      return parser;
    }
    return (input, options) => parser(input, mergeParseOptions(options, astOptions));
  }
  let encodingParsers;
  const parseLocal = (input, options) => {
    let result3 = parser(input, options);
    if (encodingChecks && !options.disableChecks) {
      if (effectIsExit(result3)) {
        if (result3._tag === "Success") {
          const output = result3 === sameExit ? input : result3[args];
          if (input !== missing && output !== missing) {
            const issues = collectIssues(encodingChecks, input, undefined, ast, options);
            if (issues) {
              result3 = fail5(new Composite(ast, issues, input, options));
            }
          }
        }
      } else {
        result3 = flatMap4(result3, (value3) => {
          if (input !== missing && value3 !== missing) {
            const issues = collectIssues(encodingChecks, input, undefined, ast, options);
            if (issues) {
              return fail5(new Composite(ast, issues, input, options));
            }
          }
          return succeed6(value3);
        });
      }
    }
    if (checks && !options.disableChecks) {
      if (effectIsExit(result3)) {
        if (result3._tag === "Success") {
          const value3 = result3 === sameExit ? input : result3[args];
          if (value3 === missing)
            return result3;
          const issues = collectIssues(checks, value3, undefined, ast, options);
          if (issues) {
            result3 = fail5(new Composite(ast, issues, value3, options));
          }
        }
      } else {
        result3 = flatMap4(result3, (value3) => {
          if (value3 !== missing) {
            const issues = collectIssues(checks, value3, undefined, ast, options);
            if (issues) {
              return fail5(new Composite(ast, issues, value3, options));
            }
          }
          return succeed6(value3);
        });
      }
    }
    return result3;
  };
  if (!links) {
    return astOptions ? (input, options) => parseLocal(input, mergeParseOptions(options, astOptions)) : parseLocal;
  }
  return (input, options) => {
    if (astOptions) {
      options = mergeParseOptions(options, astOptions);
    }
    const parsers = encodingParsers ??= links.map((link) => compile(link.to));
    let current = input;
    let result3 = parsers[parsers.length - 1](input, options);
    for (let i = links.length - 1;i >= 0; i--) {
      result3 = applyTransformation(result3, current, links[i].transformation, options);
      if (i !== 0) {
        const next = parsers[i - 1];
        if (result3._tag === "Success") {
          current = result3[args];
          result3 = next(current, options);
        } else {
          result3 = flatMapEager2(result3, (value3) => {
            const nextResult = next(value3, options);
            return nextResult === sameExit ? succeed7(value3) : nextResult;
          });
        }
      }
    }
    if (result3._tag === "Success") {
      const value3 = result3[args];
      const local = parseLocal(value3, options);
      return local === sameExit ? result3 : local;
    }
    result3 = catchCause2(result3, (cause) => failCauseSync2(() => map6(cause, (issue) => new Encoding(ast, issue, input, options))));
    return flatMapEager2(result3, (value3) => {
      const local = parseLocal(value3, options);
      return local === sameExit ? succeed7(value3) : local;
    });
  };
}

// node_modules/effect/dist/internal/schema/schema.js
var TypeId19 = "~effect/Schema/Schema";
function makeDeclarationReviver(id, payloadSchema, revive) {
  return {
    id,
    payloadSchema,
    revive
  };
}
function makeFilterReviver(id, payloadSchema, revive) {
  return {
    id,
    payloadSchema,
    revive
  };
}
var SchemaProto = {
  [TypeId19]: TypeId19,
  pipe() {
    return pipeArguments(this, arguments);
  },
  annotate(annotations) {
    return this.rebuild(annotate(this.ast, annotations));
  },
  annotateKey(annotations) {
    return this.rebuild(annotateKey(this.ast, annotations));
  },
  check(...checks) {
    return this.rebuild(appendChecks(this.ast, checks));
  }
};
function make16(ast, options) {
  function Schema() {}
  const self = Object.defineProperties(Object.setPrototypeOf(Schema, SchemaProto), Object.getOwnPropertyDescriptors({
    ...options
  }));
  self.ast = ast;
  self.rebuild = (ast2) => make16(ast2, options);
  self.makeEffect = makeEffect(self);
  self.make = make15(self);
  self.makeOption = makeOption(self);
  return self;
}

// node_modules/effect/dist/Boolean.js
var Boolean2 = globalThis.Boolean;
var ReducerOr = /* @__PURE__ */ make2((a, b) => a || b, false);

// node_modules/effect/dist/Struct.js
var pick = /* @__PURE__ */ dual(2, (self, keys3) => {
  return buildStruct(self, (k, v) => keys3.includes(k) ? [k, v] : undefined);
});
var omit2 = /* @__PURE__ */ dual(2, (self, keys3) => {
  return buildStruct(self, (k, v) => !keys3.includes(k) ? [k, v] : undefined);
});
var assign = /* @__PURE__ */ dual(2, (self, that) => {
  return {
    ...self,
    ...that
  };
});
var renameKeys = /* @__PURE__ */ dual(2, (self, mapping) => {
  return buildStruct(self, (k, v) => [Object.hasOwn(mapping, k) ? mapping[k] : k, v]);
});
var lambda = (f) => f;
function buildStruct(source, f) {
  const out = {};
  for (const k of Reflect.ownKeys(source)) {
    if (!Object.prototype.propertyIsEnumerable.call(source, k))
      continue;
    const res = f(k, source[k]);
    if (res) {
      const [nk, nv] = res;
      assignProperty(out, nk, nv);
    }
  }
  return out;
}
function makeCombiner(combiners, options) {
  const omitKeyWhen = options?.omitKeyWhen ?? (() => false);
  return make((self, that) => {
    const keys3 = Reflect.ownKeys(combiners);
    const out = {};
    for (const key of keys3) {
      const merge2 = combiners[key].combine(self[key], that[key]);
      if (omitKeyWhen(merge2))
        continue;
      assignProperty(out, key, merge2);
    }
    return out;
  });
}

// node_modules/effect/dist/UndefinedOr.js
function makeReducer(combiner) {
  return make2((self, that) => {
    if (self === undefined)
      return that;
    if (that === undefined)
      return self;
    return combiner.combine(self, that);
  }, undefined);
}

// node_modules/effect/dist/internal/errors.js
function errorWithPath(message, path) {
  if (path.length > 0) {
    message += `
  at ${formatPath(path)}`;
  }
  return new Error(message);
}

// node_modules/effect/dist/internal/schema/toArbitrary.js
var arbitraryMemoMap = /* @__PURE__ */ new WeakMap;
var suspendDepthIdentifierMap = /* @__PURE__ */ new WeakMap;
var emptyRecursionStack = [];
function arbitraryError(what) {
  return new Error(`Unable to derive an arbitrary for ${what}`);
}
var entryComparator = ([a], [b]) => equals(a, b);
function applyChecks(ast, filters, arbitrary) {
  return filters.reduce((acc, filter8) => acc.filter((a) => filter8.run(a, ast, defaultParseOptions) === undefined), arbitrary);
}
function validateArrayConstraints(constraint, label) {
  if (constraint?.minLength !== undefined && constraint.maxLength !== undefined && constraint.minLength > constraint.maxLength) {
    throw arbitraryError(`${label} constraints`);
  }
}
function lengthToFastCheckConstraints(constraint) {
  return constraint === undefined || constraint.minLength === undefined && constraint.maxLength === undefined ? undefined : {
    ...constraint.minLength !== undefined ? {
      minLength: constraint.minLength
    } : {},
    ...constraint.maxLength !== undefined ? {
      maxLength: constraint.maxLength
    } : {}
  };
}
function arrayWithConstraints(fc, item, constraint, comparator) {
  return comparator ? fc.uniqueArray(item, {
    ...constraint,
    comparator
  }) : fc.array(item, constraint);
}
function array2(fc, ctx, item, terminal = false) {
  const constraint = ctx.constraint;
  const arrayConstraints = lengthToFastCheckConstraints(constraint);
  validateArrayConstraints(arrayConstraints, "array");
  return arrayWithConstraints(fc, item, terminal ? {
    ...arrayConstraints,
    maxLength: arrayConstraints?.minLength ?? 0
  } : arrayConstraints, constraint?.unique ? equals : undefined);
}
function appendArray(fc, out, len, rest) {
  return out.chain((as3) => as3.length < len ? fc.constant(as3) : rest.map((rest2) => [...as3, ...rest2]));
}
function appendObjectEntries(out, entries3) {
  return out.chain((o) => entries3.map((entries4) => ({
    ...Object.fromEntries(entries4),
    ...o
  })));
}
var max4 = /* @__PURE__ */ makeReducer(ReducerMax);
var min4 = /* @__PURE__ */ makeReducer(ReducerMin);
var or = /* @__PURE__ */ makeReducer(ReducerOr);
var concat = /* @__PURE__ */ makeReducer(/* @__PURE__ */ makeReducerConcat());
var combiner = /* @__PURE__ */ makeCombiner({
  integer: or,
  maxLength: min4,
  minLength: max4,
  noInfinity: or,
  noNaN: or,
  patterns: concat,
  unique: or
}, {
  omitKeyWhen: isUndefined
});
function mergeOrderedBound(order, self, selfExclusive, that, thatExclusive, takeComparison) {
  if (that === undefined || self === undefined) {
    return that === undefined ? [self, selfExclusive] : [that, thatExclusive];
  }
  const comparison = order(self, that);
  return comparison === takeComparison ? [that, thatExclusive] : comparison === 0 ? [self, selfExclusive || thatExclusive] : [self, selfExclusive];
}
function mergeOrderedConstraints(self, that) {
  if (self === undefined) {
    return that;
  }
  if (self.order !== that.order) {
    throw new Error("Cannot merge ordered arbitrary constraints with different Order instances");
  }
  const [minimum, exclusiveMinimum] = mergeOrderedBound(self.order, self.minimum, self.exclusiveMinimum, that.minimum, that.exclusiveMinimum, -1);
  const [maximum, exclusiveMaximum] = mergeOrderedBound(self.order, self.maximum, self.exclusiveMaximum, that.maximum, that.exclusiveMaximum, 1);
  return {
    order: self.order,
    ...minimum !== undefined ? {
      minimum
    } : {},
    ...exclusiveMinimum !== undefined ? {
      exclusiveMinimum
    } : {},
    ...maximum !== undefined ? {
      maximum
    } : {},
    ...exclusiveMaximum !== undefined ? {
      exclusiveMaximum
    } : {}
  };
}
function mergeConstraint(self, that) {
  const {
    ordered: selfOrdered,
    ...selfRest
  } = self ?? {};
  const {
    ordered: thatOrdered,
    ...thatRest
  } = that;
  const ordered = thatOrdered === undefined ? selfOrdered : mergeOrderedConstraints(selfOrdered, thatOrdered);
  const out = combiner.combine(selfRest, thatRest);
  return {
    ...out,
    ...ordered === undefined ? {} : {
      ordered
    }
  };
}
function collectChecks(checks) {
  const filters = [];
  const arbitraries = [];
  function visit(check) {
    if (check.annotations?.arbitrary) {
      arbitraries.push(check.annotations.arbitrary);
    }
    if (check._tag !== "Filter") {
      for (const child of check.checks) {
        visit(child);
      }
    } else {
      filters.push(check);
    }
  }
  checks?.forEach(visit);
  return {
    filters,
    arbitraries
  };
}
function constraintContext(arbitraries) {
  const constraintAnnotations = arbitraries.map(({
    constraint
  }) => constraint).filter(isNotUndefined);
  return (ctx) => {
    const constraint = constraintAnnotations.reduce((acc, c) => mergeConstraint(acc, c), ctx.constraint);
    return {
      ...ctx,
      constraint
    };
  };
}
function resetContext(ctx) {
  return {
    ...ctx,
    constraint: undefined
  };
}
function objectEntriesConstraints(ast, constraint, requiredKeys) {
  if (constraint === undefined || constraint.minLength === undefined && constraint.maxLength === undefined) {
    return;
  }
  if (constraint.minLength !== undefined && ast.indexSignatures.length === 0 && constraint.minLength > ast.propertySignatures.length) {
    throw arbitraryError("object property constraints");
  }
  const out = {};
  if (constraint.minLength !== undefined) {
    out.minLength = Math.max(0, constraint.minLength - requiredKeys);
  }
  if (constraint.maxLength !== undefined) {
    out.maxLength = constraint.maxLength - requiredKeys;
    if (out.maxLength < 0) {
      throw arbitraryError("object property constraints");
    }
  }
  validateArrayConstraints(out, "object property");
  return out;
}
function objectWithOptionalCount(fc, pss, orderedNames, requiredKeys, optionalNames, constraint) {
  const requiredCount = requiredKeys.length;
  if (constraint.maxLength !== undefined && constraint.maxLength < requiredCount) {
    throw arbitraryError("object property constraints");
  }
  const minOptional = constraint.minLength === undefined ? 0 : Math.max(0, constraint.minLength - requiredCount);
  const maxOptional = constraint.maxLength === undefined ? optionalNames.length : Math.min(optionalNames.length, constraint.maxLength - requiredCount);
  if (minOptional > maxOptional) {
    throw arbitraryError("object property constraints");
  }
  const full = fc.record(pss, {
    requiredKeys: [...requiredKeys, ...optionalNames]
  });
  const chosen = fc.shuffledSubarray([...optionalNames], {
    minLength: minOptional,
    maxLength: maxOptional
  });
  return fc.tuple(full, chosen).map(([base, names]) => {
    const keep = new Set([...requiredKeys, ...names]);
    const out = {};
    for (const name of orderedNames) {
      if (keep.has(name)) {
        assignProperty(out, name, base[name]);
      }
    }
    return out;
  });
}
function toRangeConstraints(ordered, min5, max5, error) {
  const out = {};
  if (ordered?.minimum !== undefined) {
    out.min = min5(ordered.minimum, ordered.exclusiveMinimum === true);
  }
  if (ordered?.maximum !== undefined) {
    out.max = max5(ordered.maximum, ordered.exclusiveMaximum === true);
  }
  if (out.min !== undefined && out.max !== undefined && out.min > out.max) {
    throw arbitraryError(error);
  }
  return out;
}
function toIntegerConstraints(ordered) {
  return toRangeConstraints(ordered, (minimum, excluded) => excluded ? Math.floor(minimum) + 1 : Math.ceil(minimum), (maximum, excluded) => excluded ? Math.ceil(maximum) - 1 : Math.floor(maximum), "integer constraints");
}
function toFloatConstraints(constraint, ordered) {
  const out = {
    ...constraint?.noInfinity ? {
      noDefaultInfinity: true
    } : {},
    ...constraint?.noNaN ? {
      noNaN: true
    } : {},
    ...ordered?.minimum !== undefined ? {
      min: ordered.minimum
    } : {},
    ...ordered?.exclusiveMinimum !== undefined ? {
      minExcluded: ordered.exclusiveMinimum
    } : {},
    ...ordered?.maximum !== undefined ? {
      max: ordered.maximum
    } : {},
    ...ordered?.exclusiveMaximum !== undefined ? {
      maxExcluded: ordered.exclusiveMaximum
    } : {}
  };
  if (out.min !== undefined && out.max !== undefined && (out.min > out.max || out.min === out.max && (out.minExcluded || out.maxExcluded))) {
    throw arbitraryError("number constraints");
  }
  return out;
}
function toBigIntConstraints(ordered) {
  return toRangeConstraints(ordered, (minimum, excluded) => excluded ? minimum + BigInt(1) : minimum, (maximum, excluded) => excluded ? maximum - BigInt(1) : maximum, "the ordered bigint constraints");
}
function makeLazy(normal, terminal) {
  const out = (fc, ctx, recursionStack = emptyRecursionStack) => normal(fc, ctx, recursionStack);
  out.terminal = (fc, ctx, recursionStack = emptyRecursionStack) => terminal(fc, ctx, recursionStack);
  return out;
}
function same(f) {
  return makeLazy(f, f);
}
function getSuspendRecursion(fc, ast) {
  const depthIdentifier = suspendDepthIdentifierMap.get(ast) ?? fc.createDepthIdentifier();
  suspendDepthIdentifierMap.set(ast, depthIdentifier);
  return {
    maxDepth: 2,
    depthIdentifier
  };
}
function oneOf(fc, arbitraries) {
  return arbitraries.length === 0 ? undefined : arbitraries.length === 1 ? arbitraries[0] : fc.oneof(...arbitraries);
}
var finiteNumberConstraint = {
  noInfinity: true,
  noNaN: true
};
function finiteNumberContext(ctx) {
  return {
    ...ctx,
    constraint: finiteNumberConstraint
  };
}
function applyCandidates(fc, ctx, arbitraries, base) {
  const weighted = base === undefined ? [] : [{
    arbitrary: base,
    weight: 1
  }];
  for (const {
    candidate
  } of arbitraries) {
    if (!candidate) {
      continue;
    }
    const arbitrary = candidate.make(fc, ctx);
    if (arbitrary === undefined) {
      continue;
    }
    const weight = candidate.weight ?? 1;
    if (!globalThis.Number.isInteger(weight) || weight <= 0) {
      throw arbitraryError("a candidate with an invalid weight");
    }
    weighted.push({
      arbitrary,
      weight
    });
  }
  return weighted.length === 0 ? undefined : weighted.length === 1 ? weighted[0].arbitrary : fc.oneof(...weighted);
}
function applyFilterLayer(ast, checks, fc, ctx, base) {
  const out = applyCandidates(fc, ctx, checks.arbitraries, base);
  return out === undefined ? undefined : applyChecks(ast, checks.filters, out);
}
function normalizeDerivation(output, hasTypeParameters) {
  if (!(typeof output === "object" && output !== null && ("arbitrary" in output))) {
    return {
      arbitrary: output,
      terminal: hasTypeParameters ? undefined : output
    };
  }
  const terminal = "terminal" in output ? output.terminal : hasTypeParameters ? undefined : output.arbitrary;
  return {
    arbitrary: output.arbitrary,
    terminal
  };
}
function makeTypeParameters(typeParameters, fc, ctx, recursionStack, lazyNormal) {
  return typeParameters.map((tp) => ({
    arbitrary: lazyNormal ? fc.constant(null).chain(() => tp(fc, ctx, recursionStack)) : tp(fc, ctx, recursionStack),
    terminal: tp.terminal(fc, ctx, recursionStack)
  }));
}
function filterLayer(ast, checks, normalBase, terminalBase) {
  const f = constraintContext(checks.arbitraries);
  return makeLazy((fc, ctx, recursionStack) => {
    const nextCtx = f(ctx);
    return applyFilterLayer(ast, checks, fc, nextCtx, normalBase(fc, ctx, nextCtx, recursionStack));
  }, (fc, ctx, recursionStack) => {
    const nextCtx = f(ctx);
    return applyFilterLayer(ast, checks, fc, nextCtx, terminalBase(fc, ctx, nextCtx, recursionStack));
  });
}
var memoized = /* @__PURE__ */ memoize((ast) => recur(ast, []));
function recur(ast, path) {
  const annotation = resolve(ast)?.toArbitrary;
  if (annotation) {
    const typeParameters = isDeclaration(ast) ? ast.typeParameters.map((tp) => recur(tp, path)) : [];
    const checks = collectChecks(ast.checks);
    const derive = (lazyNormal) => (fc, ctx, nextCtx, recursionStack) => normalizeDerivation(annotation(makeTypeParameters(typeParameters, fc, resetContext(ctx), recursionStack, lazyNormal))(fc, nextCtx), typeParameters.length > 0)[lazyNormal ? "terminal" : "arbitrary"];
    return filterLayer(ast, checks, derive(false), derive(true));
  }
  if (ast.checks) {
    const checks = collectChecks(ast.checks);
    const lawc = recur(replaceChecks(ast, undefined), path);
    return filterLayer(ast, checks, (fc, _ctx, nextCtx, recursionStack) => lawc(fc, nextCtx, recursionStack), (fc, _ctx, nextCtx, recursionStack) => lawc.terminal(fc, nextCtx, recursionStack));
  }
  return base(ast, path);
}
function base(ast, path) {
  switch (ast._tag) {
    case "Never":
    case "Declaration":
      throw errorWithPath(`Unsupported AST ${ast._tag}`, path);
    case "Null":
      return same((fc) => fc.constant(null));
    case "Void":
    case "Undefined":
      return same((fc) => fc.constant(undefined));
    case "Unknown":
    case "Any":
      return same((fc) => fc.anything());
    case "String":
      return same((fc, ctx) => {
        const constraint = ctx.constraint;
        const patterns = constraint?.patterns;
        return patterns ? fc.oneof(...patterns.map((pattern) => fc.stringMatching(new RegExp(pattern)))) : fc.string(lengthToFastCheckConstraints(constraint));
      });
    case "Number":
      return same((fc, ctx) => {
        const constraint = ctx.constraint;
        const ordered = constraint?.ordered?.order === Number2 ? constraint.ordered : undefined;
        return constraint?.integer ? fc.integer(toIntegerConstraints(ordered)) : fc.float(toFloatConstraints(constraint, ordered));
      });
    case "Boolean":
      return same((fc) => fc.boolean());
    case "BigInt":
      return same((fc, ctx) => {
        const ordered = ctx.constraint?.ordered?.order === BigInt2 ? ctx.constraint.ordered : undefined;
        return fc.bigInt(toBigIntConstraints(ordered));
      });
    case "Symbol":
      return same((fc) => fc.string().map(Symbol.for));
    case "Literal":
      return same((fc) => fc.constant(ast.literal));
    case "UniqueSymbol":
      return same((fc) => fc.constant(ast.symbol));
    case "ObjectKeyword":
      return same((fc) => fc.oneof(fc.object(), fc.array(fc.anything())));
    case "Enum":
      return recur(enumsToLiterals(ast), path);
    case "TemplateLiteral": {
      const parts = ast.parts.map((part, i) => recur(toEncoded(part), [...path, i]));
      return same((fc, ctx, recursionStack) => fc.tuple(...parts.map((part) => part(fc, finiteNumberContext(ctx), recursionStack))).map((segments) => segments.map((segment) => globalThis.String(segment)).join("")));
    }
    case "Arrays": {
      const elements = ast.elements.map((ast2, i) => ({
        ast: ast2,
        arbitrary: recur(ast2, [...path, i])
      }));
      const len = ast.elements.length;
      const rest = ast.rest.map((ast2, i) => ({
        ast: ast2,
        arbitrary: recur(ast2, [...path, len + i])
      }));
      const terminal = (fc, ctx, recursionStack) => {
        const reset = resetContext(ctx);
        const elementArbitraries = [];
        const optionals = [];
        let length = 0;
        for (const element of elements) {
          const out2 = element.arbitrary.terminal(fc, reset, recursionStack);
          if (isOptional(element.ast)) {
            optionals.push(out2);
            continue;
          }
          if (out2 === undefined) {
            return;
          }
          length++;
          elementArbitraries.push(out2.map(some2));
        }
        const minLength = ctx.constraint?.minLength ?? 0;
        const needsRest = isReadonlyArrayNonEmpty(rest) && minLength > length + optionals.length;
        const optionalTarget = needsRest ? optionals.length : Math.max(0, minLength - length);
        let includedOptionals = 0;
        for (const out2 of optionals) {
          if (includedOptionals >= optionalTarget || out2 === undefined) {
            elementArbitraries.push(fc.constant(none2()));
            continue;
          }
          includedOptionals++;
          length++;
          elementArbitraries.push(out2.map(some2));
        }
        if (includedOptionals < optionalTarget) {
          return;
        }
        let out = fc.tuple(...elementArbitraries).map(getSomes);
        if (isReadonlyArrayNonEmpty(rest)) {
          const [head, ...tail] = rest;
          const restCtx = ast.elements.length === 0 ? ctx : reset;
          const minRestLength = Math.max(0, minLength - length - tail.length);
          const headArbitrary = minRestLength === 0 ? undefined : head.arbitrary.terminal(fc, reset, recursionStack);
          if (minRestLength > 0 && headArbitrary === undefined) {
            return;
          }
          const restArbitrary = minRestLength === 0 ? fc.constant([]) : array2(fc, {
            ...restCtx,
            constraint: {
              ...restCtx.constraint,
              minLength: minRestLength
            }
          }, headArbitrary, true);
          out = appendArray(fc, out, len, restArbitrary);
          if (tail.length > 0) {
            const tailArbitraries = [];
            for (const element of tail) {
              const out2 = element.arbitrary.terminal(fc, reset, recursionStack);
              if (out2 === undefined) {
                return;
              }
              tailArbitraries.push(out2);
            }
            const t = fc.tuple(...tailArbitraries);
            out = appendArray(fc, out, len, t);
          }
        }
        return out;
      };
      return makeLazy((fc, ctx, recursionStack) => {
        const reset = resetContext(ctx);
        const elementArbitraries = elements.map(({
          ast: ast2,
          arbitrary
        }) => {
          const out2 = arbitrary(fc, reset, recursionStack);
          return isOptional(ast2) ? out2.chain((a) => fc.boolean().map((b) => b ? some2(a) : none2())) : out2.map(some2);
        });
        let out = fc.tuple(...elementArbitraries).map((elements2) => getSomes(takeWhile(elements2, isSome2)));
        if (isReadonlyArrayNonEmpty(rest)) {
          const [head, ...tail] = rest.map(({
            arbitrary
          }) => arbitrary(fc, reset, recursionStack));
          const restArbitrary = array2(fc, ast.elements.length === 0 ? ctx : reset, head);
          out = appendArray(fc, out, len, restArbitrary);
          if (tail.length > 0) {
            const t = fc.tuple(...tail);
            out = appendArray(fc, out, len, t);
          }
        }
        if (ctx.recursion) {
          const terminalOut = terminal(fc, ctx, recursionStack);
          if (terminalOut !== undefined) {
            return fc.oneof(ctx.recursion, terminalOut, out);
          }
        }
        return out;
      }, terminal);
    }
    case "Objects": {
      const propertySignatures = ast.propertySignatures.map((ps) => ({
        ps,
        arbitrary: recur(ps.type, [...path, ps.name])
      }));
      const indexSignatures = ast.indexSignatures.map((is2) => ({
        is: is2,
        parameter: recur(is2.parameter, path),
        type: recur(is2.type, path)
      }));
      const terminal = (fc, ctx, recursionStack) => {
        const reset = resetContext(ctx);
        const pss = {};
        const requiredKeys = [];
        const optionals = [];
        for (const {
          ps,
          arbitrary
        } of propertySignatures) {
          const name = ps.name;
          const out2 = arbitrary.terminal(fc, reset, recursionStack);
          if (isOptional(ps.type)) {
            if (out2 !== undefined) {
              optionals.push([name, out2]);
            }
            continue;
          }
          if (out2 === undefined) {
            return;
          }
          requiredKeys.push(name);
          assignProperty(pss, name, out2);
        }
        let optionalCount = Math.max(0, (ctx.constraint?.minLength ?? 0) - requiredKeys.length);
        for (const [name, out2] of optionals) {
          if (optionalCount === 0) {
            break;
          }
          optionalCount--;
          requiredKeys.push(name);
          assignProperty(pss, name, out2);
        }
        if (optionalCount > 0 && ast.indexSignatures.length === 0) {
          return;
        }
        let out = fc.record(pss, {
          requiredKeys
        });
        const entriesConstraints = objectEntriesConstraints(ast, ctx.constraint, requiredKeys.length);
        const minEntries = entriesConstraints?.minLength ?? 0;
        for (const {
          parameter,
          type
        } of indexSignatures) {
          let entries3;
          if (minEntries === 0) {
            entries3 = fc.constant([]);
          } else {
            const key = parameter.terminal(fc, reset, recursionStack);
            const value3 = type.terminal(fc, reset, recursionStack);
            if (key === undefined || value3 === undefined) {
              return;
            }
            entries3 = arrayWithConstraints(fc, fc.tuple(key, value3), {
              ...entriesConstraints,
              maxLength: minEntries
            }, entryComparator);
          }
          out = appendObjectEntries(out, entries3);
        }
        return out;
      };
      return makeLazy((fc, ctx, recursionStack) => {
        const reset = resetContext(ctx);
        const pss = {};
        const orderedNames = [];
        const requiredKeys = [];
        const optionalNames = [];
        for (const {
          ps,
          arbitrary
        } of propertySignatures) {
          const name = ps.name;
          orderedNames.push(name);
          if (isOptional(ps.type)) {
            optionalNames.push(name);
          } else {
            requiredKeys.push(name);
          }
          assignProperty(pss, name, arbitrary(fc, reset, recursionStack));
        }
        const constraint = ctx.constraint;
        if (optionalNames.length > 0 && indexSignatures.length === 0 && constraint !== undefined && (constraint.minLength !== undefined || constraint.maxLength !== undefined)) {
          return objectWithOptionalCount(fc, pss, orderedNames, requiredKeys, optionalNames, constraint);
        }
        let out = fc.record(pss, {
          requiredKeys
        });
        const entriesConstraints = objectEntriesConstraints(ast, ctx.constraint, requiredKeys.length);
        for (const {
          parameter,
          type
        } of indexSignatures) {
          const entry = fc.tuple(parameter(fc, reset, recursionStack), type(fc, reset, recursionStack));
          const entries3 = arrayWithConstraints(fc, entry, entriesConstraints, entryComparator);
          out = appendObjectEntries(out, entries3);
        }
        return out;
      }, terminal);
    }
    case "Union": {
      const types = ast.types.map((ast2) => recur(ast2, path));
      const terminal = (fc, ctx, recursionStack) => oneOf(fc, types.map((type) => type.terminal(fc, ctx, recursionStack)).filter(isNotUndefined));
      return makeLazy((fc, ctx, recursionStack) => {
        const arbitraries = types.map((type) => type(fc, ctx, recursionStack));
        if (ctx.recursion) {
          const terminalOut = terminal(fc, ctx, recursionStack);
          if (terminalOut !== undefined) {
            return fc.oneof(ctx.recursion, terminalOut, ...arbitraries);
          }
        }
        const out = oneOf(fc, arbitraries);
        if (out === undefined) {
          throw arbitraryError("a union with no members");
        }
        return out;
      }, terminal);
    }
    case "Suspend": {
      const memo = arbitraryMemoMap.get(ast);
      if (memo)
        return memo;
      const get3 = memoizeThunk(() => recur(ast.thunk(), path));
      const out = makeLazy((fc, ctx, recursionStack) => {
        const recursion = getSuspendRecursion(fc, ast);
        const nextCtx = {
          ...ctx,
          recursion
        };
        const nextStack = recursionStack.includes(ast) ? recursionStack : [...recursionStack, ast];
        const terminal = get3().terminal(fc, nextCtx, nextStack);
        if (terminal === undefined) {
          throw errorWithPath("Unable to derive an arbitrary for a recursive schema without a finite generation path", path);
        }
        return fc.oneof(recursion, terminal, fc.constant(null).chain(() => get3()(fc, nextCtx, nextStack)));
      }, (fc, ctx, recursionStack) => {
        if (recursionStack.includes(ast)) {
          return;
        }
        const recursion = getSuspendRecursion(fc, ast);
        return get3().terminal(fc, {
          ...ctx,
          recursion
        }, [...recursionStack, ast]);
      });
      arbitraryMemoMap.set(ast, out);
      return out;
    }
  }
}

// node_modules/effect/dist/internal/schema/toEquivalence.js
var toEquivalence = /* @__PURE__ */ memoize((ast) => {
  return recur2(ast, []);
});
function recur2(ast, path) {
  const annotation = resolve(ast)?.["toEquivalence"];
  if (annotation) {
    return annotation(isDeclaration(ast) ? ast.typeParameters.map((tp) => recur2(tp, path)) : []);
  }
  switch (ast._tag) {
    case "Never":
      return strictEqual();
    case "Declaration":
    case "Null":
    case "Undefined":
    case "Void":
    case "Unknown":
    case "Any":
    case "String":
    case "Number":
    case "Boolean":
    case "BigInt":
    case "Symbol":
    case "Literal":
    case "UniqueSymbol":
    case "ObjectKeyword":
    case "Enum":
    case "TemplateLiteral":
      return equals;
    case "Arrays": {
      const elements = ast.elements.map((e, i) => recur2(e, [...path, i]));
      const len = ast.elements.length;
      const rest = ast.rest.map((r, i) => recur2(r, [...path, len + i]));
      return make3((a, b) => {
        if (!Array.isArray(a) || !Array.isArray(b)) {
          return false;
        }
        const len2 = a.length;
        if (len2 !== b.length) {
          return false;
        }
        let i = 0;
        for (;i < Math.min(len2, ast.elements.length); i++) {
          if (!elements[i](a[i], b[i])) {
            return false;
          }
        }
        if (rest.length > 0) {
          const [head, ...tail] = rest;
          for (;i < len2 - tail.length; i++) {
            if (!head(a[i], b[i])) {
              return false;
            }
          }
          for (let j = 0;j < tail.length; j++) {
            if (!tail[j](a[i + j], b[i + j])) {
              return false;
            }
          }
        }
        return true;
      });
    }
    case "Objects": {
      if (ast.propertySignatures.length === 0 && ast.indexSignatures.length === 0) {
        return equals;
      }
      const propertySignatures = ast.propertySignatures.map((ps) => recur2(ps.type, [...path, ps.name]));
      const indexSignatures = ast.indexSignatures.map((is2) => recur2(is2.type, path));
      return make3((a, b) => {
        if (!isObject(a) || !isObject(b)) {
          return false;
        }
        for (let i = 0;i < propertySignatures.length; i++) {
          const ps = ast.propertySignatures[i];
          const name = ps.name;
          const aHas = Object.hasOwn(a, name);
          const bHas = Object.hasOwn(b, name);
          if (isOptional(ps.type)) {
            if (aHas !== bHas) {
              return false;
            }
          }
          if (aHas && bHas && !propertySignatures[i](a[name], b[name])) {
            return false;
          }
        }
        for (let i = 0;i < indexSignatures.length; i++) {
          const is2 = ast.indexSignatures[i];
          const aKeys = getIndexSignatureKeys(a, is2.parameter);
          const bKeys = getIndexSignatureKeys(b, is2.parameter);
          if (aKeys.length !== bKeys.length)
            return false;
          for (let j = 0;j < aKeys.length; j++) {
            const key = aKeys[j];
            if (!Object.hasOwn(b, key) || !indexSignatures[i](a[key], b[key])) {
              return false;
            }
          }
        }
        return true;
      });
    }
    case "Union": {
      const types = toType(ast).types;
      const compiled = new Map(types.map((candidate, i) => [candidate, [_is(candidate), recur2(ast.types[i], path)]]));
      return make3((a, b) => {
        const candidates = getCandidates(a, types);
        for (let i = 0;i < candidates.length; i++) {
          const [is2, equivalence] = compiled.get(candidates[i]);
          if (is2(a) && is2(b)) {
            return equivalence(a, b);
          }
        }
        return false;
      });
    }
    case "Suspend": {
      const get3 = memoizeThunk(() => recur2(ast.thunk(), path));
      return make3((a, b) => get3()(a, b));
    }
  }
}

// node_modules/effect/dist/JsonPointer.js
function escapeToken(token) {
  return token.replace(/~/g, "~0").replace(/\//g, "~1");
}
function unescapeToken(token) {
  return token.replace(/~1/g, "/").replace(/~0/g, "~");
}

// node_modules/effect/dist/JsonSchema.js
var RE_DEFS = /^#\/\$defs(?=\/|$)/;
var DRAFT_04_COPY_KEYWORDS = /* @__PURE__ */ new Set(["$ref", "type", "required", "enum", "title", "description", "default", "format", "pattern", "minLength", "maxLength", "minItems", "maxItems", "minProperties", "maxProperties", "multipleOf", "uniqueItems"]);
var DRAFT_07_COPY_KEYWORDS = /* @__PURE__ */ new Set([...DRAFT_04_COPY_KEYWORDS, "const", "examples", "readOnly", "writeOnly", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum"]);
var DRAFT_07_SINGLE_SUBSCHEMA_KEYWORDS = /* @__PURE__ */ new Set(["not", "additionalProperties", "propertyNames"]);
var MAP_SUBSCHEMA_KEYWORDS = /* @__PURE__ */ new Set(["properties", "patternProperties"]);
var ARRAY_SUBSCHEMA_KEYWORDS = /* @__PURE__ */ new Set(["allOf", "anyOf", "oneOf"]);
function toDocumentDraft07(document) {
  return {
    dialect: "draft-07",
    schema: toSchemaDraft07(document.schema),
    definitions: map3(document.definitions, toSchemaDraft07)
  };
}
function toSchemaDraft07(schema) {
  return transformSchema(schema, (src) => {
    rewriteSchemaRef(src, (ref) => ref.replace(RE_DEFS, "#/definitions"));
    const out = {};
    let prefixItems = undefined;
    let items = undefined;
    for (const k of Object.keys(src)) {
      const v = src[k];
      if (k === "required" && Array.isArray(v) && v.length === 0)
        continue;
      if (DRAFT_07_COPY_KEYWORDS.has(k)) {
        out[k] = v;
        continue;
      }
      if (MAP_SUBSCHEMA_KEYWORDS.has(k) || ARRAY_SUBSCHEMA_KEYWORDS.has(k) || DRAFT_07_SINGLE_SUBSCHEMA_KEYWORDS.has(k)) {
        out[k] = v;
        continue;
      }
      switch (k) {
        case "prefixItems":
          prefixItems = v;
          break;
        case "items":
          items = v;
          break;
        default:
          break;
      }
    }
    if (prefixItems !== undefined) {
      if (Array.isArray(prefixItems)) {
        out.items = prefixItems;
        if (items !== undefined)
          out.additionalItems = items;
      } else {
        out.items = prefixItems;
      }
    } else if (items !== undefined) {
      out.items = items;
    }
    const $ref = out.$ref;
    if (typeof $ref === "string" && Object.keys(out).length > 1) {
      delete out.$ref;
      out.allOf = [{
        $ref
      }, ...Array.isArray(out.allOf) ? out.allOf : []];
    }
    return out;
  });
}
function transformSchema(node, transform3) {
  return walk(node);
  function walk(node2) {
    if (!isObject(node2))
      return node2;
    const out = {};
    for (const key of Object.keys(node2)) {
      const value3 = node2[key];
      let transformed = value3;
      switch (key) {
        case "$defs":
        case "properties":
        case "patternProperties":
        case "dependentSchemas":
          transformed = mapObject(value3, walk) ?? value3;
          break;
        case "allOf":
        case "anyOf":
        case "oneOf":
        case "prefixItems":
          transformed = Array.isArray(value3) ? value3.map(walk) : value3;
          break;
        case "not":
        case "additionalProperties":
        case "propertyNames":
        case "unevaluatedProperties":
        case "items":
        case "contains":
        case "unevaluatedItems":
        case "if":
        case "then":
        case "else":
        case "contentSchema":
          transformed = walk(value3);
      }
      assignProperty(out, key, transformed);
    }
    return transform3(out);
  }
}
function rewriteRefs(schema, rewrite) {
  return transformSchema(schema, (schema2) => rewriteSchemaRef(schema2, rewrite));
}
function rewriteSchemaRef(schema, rewrite) {
  if (typeof schema.$ref === "string") {
    assignProperty(schema, "$ref", rewrite(schema.$ref));
  }
  return schema;
}
function mapObject(value3, f) {
  return isObject(value3) ? map3(value3, f) : undefined;
}

// node_modules/effect/dist/RegExp.js
var RegExp2 = globalThis.RegExp;
var escape = (string3) => string3.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&");

// node_modules/effect/dist/internal/schema/toJsonSchemaDocument.js
var jsonSchemaAnnotationExcludedKeys = /* @__PURE__ */ new Set([...annotationExcludedKeys, IDENTIFIER_FALLBACK_KEY, ...jsonSchemaAnnotationKeys]);
var toRepresentationOptions = {
  isAnonymousReferenceAllowed: (ast) => !isDeclaration(ast)
};
function collectJsonSchemaAnnotations(annotations, options) {
  if (annotations === undefined)
    return;
  const out = {};
  const title = annotations.title;
  if (typeof title === "string")
    out.title = title;
  const description = annotations.description;
  const expected = annotations.expected;
  if (typeof description === "string")
    out.description = description;
  else if (options?.generateDescriptions === true && typeof expected === "string")
    out.description = expected;
  const defaultValue = annotations.default;
  if (isJson(defaultValue))
    out.default = defaultValue;
  const examples = annotations.examples;
  if (Array.isArray(examples) && isJson(examples))
    out.examples = examples;
  const readOnly = annotations.readOnly;
  if (typeof readOnly === "boolean")
    out.readOnly = readOnly;
  const writeOnly = annotations.writeOnly;
  if (typeof writeOnly === "boolean")
    out.writeOnly = writeOnly;
  const format4 = annotations.format;
  if (typeof format4 === "string")
    out.format = format4;
  const contentEncoding = annotations.contentEncoding;
  if (typeof contentEncoding === "string")
    out.contentEncoding = contentEncoding;
  const contentMediaType = annotations.contentMediaType;
  if (typeof contentMediaType === "string")
    out.contentMediaType = contentMediaType;
  const contentSchema = annotations.contentSchema;
  if (isJson(contentSchema))
    out.contentSchema = contentSchema;
  if (options?.includeAnnotationKey !== undefined) {
    for (const [key, value3] of Object.entries(annotations)) {
      if (jsonSchemaAnnotationExcludedKeys.has(key) || !options.includeAnnotationKey(key)) {
        continue;
      }
      if (isJson(value3))
        assignProperty(out, key, value3);
    }
  }
  return Object.keys(out).length === 0 ? undefined : out;
}
function extractJsonSchemaNumberType(schema) {
  let type = schema.type === "number" || schema.type === "integer" ? schema.type : undefined;
  let out = schema;
  if (type !== undefined) {
    out = {
      ...schema
    };
    delete out.type;
  }
  if (Array.isArray(out.allOf)) {
    const members = [];
    let changed = false;
    for (const member of out.allOf) {
      const extracted = extractJsonSchemaNumberType(member);
      if (extracted.type !== undefined) {
        changed = true;
        if (type === undefined || extracted.type === "integer")
          type = extracted.type;
      }
      if (Object.keys(extracted.schema).length > 0)
        members.push(extracted.schema);
    }
    if (changed) {
      const {
        allOf: _,
        ...rest
      } = out;
      out = members.length === 0 ? rest : {
        ...rest,
        allOf: members
      };
    }
  }
  return {
    type,
    schema: out
  };
}
function isJsonSchemaNumberEncoding(schema) {
  return Array.isArray(schema.anyOf) && schema.anyOf.length === 4 && schema.anyOf[0]?.type === "number" && schema.anyOf.slice(1).every((member) => member.type === "string");
}
function appendJsonSchema(left, right) {
  if (Object.keys(left).length === 0)
    return right;
  const rightKeys = Object.keys(right);
  if (rightKeys.length === 0)
    return left;
  const leftType = left.type === "number" || left.type === "integer" ? left.type : undefined;
  const isNumberEncoding = isJsonSchemaNumberEncoding(left);
  if (leftType !== undefined || isNumberEncoding) {
    const extracted = extractJsonSchemaNumberType(right);
    if (extracted.type !== undefined) {
      const type = leftType === "integer" || extracted.type === "integer" ? "integer" : "number";
      const base2 = {
        ...left,
        type
      };
      if (isNumberEncoding)
        delete base2.anyOf;
      return Object.keys(extracted.schema).length === 0 ? base2 : appendJsonSchema(base2, extracted.schema);
    }
  }
  const members = Array.isArray(right.allOf) && rightKeys.length === 1 ? right.allOf : [right];
  if (Array.isArray(left.allOf)) {
    return {
      ...left,
      allOf: [...left.allOf, ...members]
    };
  }
  if (typeof left.$ref === "string") {
    return {
      allOf: [left, ...members]
    };
  }
  return {
    ...left,
    allOf: members
  };
}
function compileJsonSchema(representations, rootPaths, references, options) {
  const definitionStates = new Map;
  const compiledRepresentations = new WeakMap;
  const fallbackDefinitions = new Map;
  let hasAliases = false;
  const referenceKeys = Object.keys(references);
  for (const key of referenceKeys) {
    compileDefinition(key, ["references", key]);
  }
  const schemas = map4(representations, (representation, index2) => finalizeJsonSchema(recur3(representation, rootPaths[index2])));
  const definitions = {};
  for (const key of referenceKeys) {
    const compiled = definitionStates.get(key);
    if (typeof compiled !== "string") {
      assignProperty(definitions, key, finalizeJsonSchema(compiled));
    }
  }
  return {
    dialect: "draft-2020-12",
    schemas,
    definitions
  };
  function compileDefinition(key, path) {
    const compiled = definitionStates.get(key);
    if (compiled !== undefined)
      return typeof compiled === "string" ? compiled : key;
    if (!Object.hasOwn(references, key)) {
      throw errorWithPath(`Invalid reference ${key}`, [...path, "$ref"]);
    }
    definitionStates.set(key, null);
    const representation = references[key];
    const schema = recur3(representation, ["references", key]);
    const fallback = getIdentifierFallback(representation);
    if (fallback !== undefined) {
      const candidates = fallbackDefinitions.get(fallback);
      const match7 = candidates?.find((candidate) => equals(definitionStates.get(candidate), schema));
      if (match7 === undefined) {
        if (candidates === undefined)
          fallbackDefinitions.set(fallback, [key]);
        else
          candidates.push(key);
      } else {
        hasAliases = true;
        definitionStates.set(key, match7);
        return match7;
      }
    }
    definitionStates.set(key, schema);
    return key;
  }
  function finalizeJsonSchema(schema) {
    if (!hasAliases)
      return schema;
    return rewriteRefs(schema, ($ref) => $ref.replace(/^#\/\$defs\/([^/]*)/, (match7, token) => {
      const canonical = definitionStates.get(unescapeToken(token));
      return typeof canonical === "string" ? `#/$defs/${escapeToken(canonical)}` : match7;
    }));
  }
  function getIdentifierFallback(representation) {
    if (representation._tag === "Reference")
      return;
    const annotations = representation.checks.length === 0 ? representation.annotations : representation.checks[representation.checks.length - 1].annotations;
    return typeof annotations?.identifier !== "string" && typeof annotations?.[IDENTIFIER_FALLBACK_KEY] === "string" ? annotations[IDENTIFIER_FALLBACK_KEY] : undefined;
  }
  function annotationSchemas(representation, path) {
    return representation?.schemas?.map((schema, index2) => recur3(schema, [...path, "schemas", index2])) ?? [];
  }
  function compileCheck(check, type, path) {
    const annotations = check.annotations;
    const callback3 = annotations?.toJsonSchema;
    if (callback3 !== undefined) {
      const schemas2 = annotationSchemas(check.representation, [...path, "representation"]);
      const fragment = callback3({
        type,
        schemas: schemas2
      });
      const ordinary2 = collectJsonSchemaAnnotations(annotations, options);
      return ordinary2 === undefined ? fragment : {
        ...fragment,
        ...ordinary2
      };
    }
    if (check._tag === "Filter")
      return;
    const children = check.checks.map((child, index2) => compileCheck(child, type, [...path, "checks", index2])).filter((child) => child !== undefined);
    if (children.length === 0)
      return;
    const ordinary = collectJsonSchemaAnnotations(annotations, options);
    return ordinary === undefined ? {
      allOf: children
    } : {
      allOf: children,
      ...ordinary
    };
  }
  function recur3(representation, path) {
    if (representation._tag === "Reference") {
      const canonical = compileDefinition(representation.$ref, path);
      return {
        $ref: `#/$defs/${escapeToken(canonical)}`
      };
    }
    const cached3 = compiledRepresentations.get(representation);
    if (cached3 !== undefined)
      return cached3;
    let output = on(representation, path);
    const ordinary = collectJsonSchemaAnnotations(representation.annotations, options);
    if (ordinary !== undefined) {
      output = {
        ...output,
        ...ordinary
      };
    }
    for (let index2 = 0;index2 < representation.checks.length; index2++) {
      const type = typeof output.type === "string" && isJsonSchemaType(output.type) ? output.type : undefined;
      const check = compileCheck(representation.checks[index2], type, [...path, "checks", index2]);
      if (check !== undefined) {
        output = appendJsonSchema(output, check);
      }
    }
    compiledRepresentations.set(representation, output);
    return output;
  }
  function on(representation, path) {
    switch (representation._tag) {
      case "Any":
      case "Unknown":
        return {};
      case "ObjectKeyword":
        return {
          anyOf: [{
            type: "object"
          }, {
            type: "array"
          }]
        };
      case "Void":
      case "Undefined":
      case "Null":
        return {
          type: "null"
        };
      case "BigInt":
        return {
          type: "string",
          allOf: [{
            pattern: "^-?\\d+$"
          }]
        };
      case "Symbol":
      case "UniqueSymbol":
        return {
          type: "string",
          allOf: [{
            pattern: "^Symbol\\((.*)\\)$"
          }]
        };
      case "Declaration": {
        return {};
      }
      case "Suspend":
        return recur3(representation.thunk, [...path, "thunk"]);
      case "Never":
        return {
          not: {}
        };
      case "String":
        return {
          type: "string"
        };
      case "Number":
        return {
          anyOf: [{
            type: "number"
          }, {
            type: "string",
            enum: ["NaN"]
          }, {
            type: "string",
            enum: ["Infinity"]
          }, {
            type: "string",
            enum: ["-Infinity"]
          }]
        };
      case "Boolean":
        return {
          type: "boolean"
        };
      case "Literal": {
        const literal = representation.literal;
        return typeof literal === "bigint" ? {
          type: "string",
          enum: [globalThis.String(literal)]
        } : {
          type: typeof literal,
          enum: [literal]
        };
      }
      case "Enum": {
        const types = representation.enums.map(([title, literal]) => typeof literal === "number" && !globalThis.Number.isFinite(literal) ? {
          type: "string",
          enum: [globalThis.String(literal)],
          title
        } : {
          type: typeof literal,
          enum: [literal],
          title
        });
        return types.length === 0 ? {
          not: {}
        } : {
          anyOf: types
        };
      }
      case "TemplateLiteral":
        return {
          type: "string",
          pattern: `^${representation.parts.map(getPartPattern).join("")}$`
        };
      case "Arrays": {
        if (representation.rest.length > 1) {
          throw errorWithPath("Invalid schema representation document", [...path, "rest"]);
        }
        const out = {
          type: "array"
        };
        let minItems = representation.elements.length;
        const prefixItems = representation.elements.map((element, index2) => {
          if (element.isOptional)
            minItems--;
          const compiled = recur3(element.type, [...path, "elements", index2, "type"]);
          const annotations = collectJsonSchemaAnnotations(element.annotations, options);
          return annotations === undefined ? compiled : appendJsonSchema(compiled, annotations);
        });
        if (prefixItems.length > 0) {
          out.prefixItems = prefixItems;
          out.maxItems = representation.elements.length;
          if (minItems > 0)
            out.minItems = minItems;
        } else {
          out.items = false;
        }
        if (representation.rest.length === 1) {
          delete out.maxItems;
          const rest = recur3(representation.rest[0], [...path, "rest", 0]);
          if (Object.keys(rest).length > 0)
            out.items = rest;
          else
            delete out.items;
        }
        return out;
      }
      case "Objects": {
        if (representation.propertySignatures.length === 0 && representation.indexSignatures.length === 0) {
          return {
            anyOf: [{
              type: "object"
            }, {
              type: "array"
            }]
          };
        }
        const out = {
          type: "object"
        };
        const properties = {};
        const required = [];
        for (let index2 = 0;index2 < representation.propertySignatures.length; index2++) {
          const property = representation.propertySignatures[index2];
          if (typeof property.name !== "string") {
            throw errorWithPath("Invalid schema representation document", [...path, "propertySignatures", index2, "name"]);
          }
          const name = property.name;
          const compiled = recur3(property.type, [...path, "propertySignatures", index2, "type"]);
          const annotations = collectJsonSchemaAnnotations(property.annotations, options);
          assignProperty(properties, name, annotations === undefined ? compiled : appendJsonSchema(compiled, annotations));
          if (!property.isOptional)
            required.push(name);
        }
        if (representation.propertySignatures.length > 0)
          out.properties = properties;
        if (required.length > 0)
          out.required = required;
        out.additionalProperties = options?.additionalProperties ?? false;
        const patternProperties = {};
        for (let index2 = 0;index2 < representation.indexSignatures.length; index2++) {
          const signature = representation.indexSignatures[index2];
          let type = recur3(signature.type, [...path, "indexSignatures", index2, "type"]);
          if (Object.keys(type).length === 1 && "not" in type)
            type = false;
          const patterns = getParameterPatterns(signature.parameter, [...path, "indexSignatures", index2, "parameter"], new Set);
          if (patterns.length === 0) {
            out.additionalProperties = type;
          } else {
            for (const pattern of patterns)
              assignProperty(patternProperties, pattern, type);
          }
        }
        if (Object.keys(patternProperties).length > 0) {
          out.patternProperties = patternProperties;
          delete out.additionalProperties;
        }
        if (typeof out.additionalProperties === "object" && out.additionalProperties !== null && Object.keys(out.additionalProperties).length === 0) {
          delete out.additionalProperties;
        }
        return out;
      }
      case "Union": {
        const types = representation.types.map((type, index2) => recur3(type, [...path, "types", index2]));
        if (types.length === 0)
          return {
            not: {}
          };
        if (types.length > 1) {
          const compacted = compactEnums(types);
          if (compacted !== undefined)
            return compacted;
        }
        return representation.mode === "anyOf" ? {
          anyOf: types
        } : {
          oneOf: types
        };
      }
    }
  }
  function getParameterPatterns(parameter, path, seenReferences) {
    switch (parameter._tag) {
      case "Reference": {
        if (!Object.hasOwn(references, parameter.$ref)) {
          throw errorWithPath(`Invalid reference ${parameter.$ref}`, [...path, "$ref"]);
        }
        compileDefinition(parameter.$ref, path);
        if (seenReferences.has(parameter.$ref))
          return [];
        const next = new Set(seenReferences).add(parameter.$ref);
        return getParameterPatterns(references[parameter.$ref], ["references", parameter.$ref], next);
      }
      case "String":
        return collectPatterns(recur3(parameter, path));
      case "TemplateLiteral":
        return [`^${parameter.parts.map(getPartPattern).join("")}$`];
      case "Union":
        return parameter.types.flatMap((type, index2) => getParameterPatterns(type, [...path, "types", index2], seenReferences));
      default:
        throw errorWithPath("Invalid schema representation document", path);
    }
  }
}
function isJsonSchemaType(input) {
  return input === "string" || input === "number" || input === "boolean" || input === "array" || input === "object" || input === "null" || input === "integer";
}
function compactEnums(schemas) {
  let sharedType = undefined;
  const values2 = [];
  for (const schema of schemas) {
    const keys3 = Object.keys(schema);
    if (keys3.length !== 2 || schema.type === undefined || !Array.isArray(schema.enum) || schema.enum.length === 0) {
      return;
    }
    if (sharedType === undefined)
      sharedType = schema.type;
    else if (schema.type !== sharedType)
      return;
    values2.push(...schema.enum);
  }
  return {
    type: sharedType,
    enum: values2
  };
}
function collectPatterns(schema) {
  const patterns = [];
  if (typeof schema.pattern === "string")
    patterns.push(schema.pattern);
  for (const key of ["allOf", "anyOf", "oneOf"]) {
    const members = schema[key];
    if (Array.isArray(members)) {
      for (const member of members) {
        if (typeof member === "object" && member !== null && !Array.isArray(member)) {
          patterns.push(...collectPatterns(member));
        }
      }
    }
  }
  return patterns;
}
function getPartPattern(part) {
  switch (part._tag) {
    case "Literal":
      return escape(globalThis.String(part.literal));
    case "String":
      return STRING_PATTERN;
    case "Number":
      return FINITE_PATTERN;
    case "TemplateLiteral":
      return part.parts.map(getPartPattern).join("");
    case "Union":
      return part.types.map(getPartPattern).join("|");
    default:
      throw errorWithPath("Invalid schema representation document", []);
  }
}
function toJsonSchemaDocument(document, options) {
  const output = compileJsonSchema([document.representation], [["representation"]], document.references, options);
  return {
    dialect: output.dialect,
    schema: output.schemas[0],
    definitions: output.definitions
  };
}

// node_modules/effect/dist/internal/schema/toRepresentation.js
function toRepresentation(ast, options) {
  const {
    references,
    representations
  } = toRepresentations([ast], options);
  return {
    representation: representations[0],
    references
  };
}
function toRepresentations(asts, options) {
  return fromASTs(asts, options);
}
function annotationsField(annotations) {
  return annotations === undefined ? undefined : {
    annotations
  };
}
function hasShareableStructure(ast, isAnonymousReferenceAllowed) {
  if (isAnonymousReferenceAllowed?.(ast) === false)
    return false;
  switch (ast._tag) {
    case "Arrays":
    case "Objects":
    case "Suspend":
      return true;
    case "Declaration":
      return true;
    case "Union":
      return ast.types.some((ast2) => hasShareableStructure(ast2, isAnonymousReferenceAllowed));
    default:
      return false;
  }
}
function isWorthReferencing(bodyCost, occurrences) {
  return occurrences * bodyCost > bodyCost + occurrences + 1;
}
function isAnonymousReferenceEligible(ast, occurrences, isAnonymousReferenceAllowed) {
  if (isAnonymousReferenceAllowed?.(ast) === false)
    return false;
  if (hasShareableStructure(ast, isAnonymousReferenceAllowed))
    return true;
  switch (ast._tag) {
    case "Union":
      return isWorthReferencing(ast.types.length + 1, occurrences);
    case "Enum":
      return isWorthReferencing(ast.enums.length + 1, occurrences);
    case "TemplateLiteral":
      return isWorthReferencing(ast.parts.length + 1, occurrences);
    case "Literal":
      return typeof ast.literal === "string" && isWorthReferencing(ast.literal.length / 32 + 1, occurrences);
    default:
      return false;
  }
}
function resolveReferenceIdentifier(input, encoded) {
  const identifier2 = resolveIdentifier(encoded);
  if (identifier2 !== undefined)
    return {
      identifier: identifier2
    };
  const fallback = (encoded !== input ? resolveIdentifier(input) : undefined) ?? resolveIdentifierFallback(encoded);
  return fallback === undefined ? undefined : {
    identifier: `${fallback}Encoded`,
    fallback
  };
}
function fromASTs(asts, options) {
  const references = {};
  const anonymousReferences = new Map;
  const referenceOwners = new Map;
  const buildingReferences = new Set;
  const visiting = new Set;
  const occurrences = new Map;
  const shared = new Set;
  for (const ast of asts)
    visit(ast);
  const representations = map4(asts, (ast) => recur3(ast));
  return {
    representations,
    references
  };
  function getReference(prefix, owner, separator = "_") {
    let candidate = prefix;
    let suffix = 0;
    while (referenceOwners.has(candidate)) {
      if (referenceOwners.get(candidate) === owner)
        return candidate;
      candidate = `${prefix}${separator}${++suffix}`;
    }
    referenceOwners.set(candidate, owner);
    return candidate;
  }
  function annotateReference(ast, referenceIdentifier, reference) {
    const fallback = referenceIdentifier.fallback;
    if (fallback !== undefined) {
      return resolveIdentifierFallback(ast) === fallback ? ast : annotate(ast, {
        [IDENTIFIER_FALLBACK_KEY]: fallback
      });
    }
    return reference === referenceIdentifier.identifier ? ast : annotate(ast, {
      identifier: reference
    });
  }
  function makeReference(reference, ast) {
    if (!Object.hasOwn(references, reference) && !buildingReferences.has(reference)) {
      buildingReferences.add(reference);
      const representation = on(ast);
      buildingReferences.delete(reference);
      assignProperty(references, reference, representation);
    }
    return {
      _tag: "Reference",
      $ref: reference
    };
  }
  function visit(input) {
    const ast = getLastEncoding(input);
    const owner = getContextOwner(ast);
    const count = (occurrences.get(owner) ?? 0) + 1;
    occurrences.set(owner, count);
    if (count > 1) {
      if (!shared.has(owner) && isAnonymousReferenceEligible(owner, count, options?.isAnonymousReferenceAllowed))
        shared.add(owner);
      return;
    }
    visitChecks(ast.checks);
    switch (ast._tag) {
      case "Declaration":
      case "Arrays":
      case "Objects":
      case "Union":
        ast.recur((child) => {
          visit(child);
          return child;
        });
        break;
      case "TemplateLiteral":
        ast.parts.forEach(visit);
        break;
      case "Suspend":
        visit(ast.thunk());
        break;
    }
  }
  function visitChecks(checks) {
    checks?.forEach((check) => {
      check.annotations?.representation?.schemas?.forEach((schema) => visit(toType(schema)));
      if (check._tag === "FilterGroup")
        visitChecks(check.checks);
    });
  }
  function recur3(input) {
    const ast = getLastEncoding(input);
    const owner = getContextOwner(ast);
    const referenceIdentifier = resolveReferenceIdentifier(input, ast);
    if (referenceIdentifier !== undefined) {
      const reference2 = getReference(referenceIdentifier.identifier, owner);
      return makeReference(reference2, annotateReference(ast, referenceIdentifier, reference2));
    }
    const found = anonymousReferences.get(owner);
    if (found !== undefined) {
      return {
        _tag: "Reference",
        $ref: found
      };
    }
    const isShared = shared.has(owner);
    if (isShared || visiting.has(owner)) {
      const reference2 = getReference(`${ast._tag}_`, owner, "");
      anonymousReferences.set(owner, reference2);
      return isShared ? makeReference(reference2, ast) : {
        _tag: "Reference",
        $ref: reference2
      };
    }
    visiting.add(owner);
    const representation = on(ast);
    visiting.delete(owner);
    const reference = anonymousReferences.get(owner);
    if (reference !== undefined) {
      assignProperty(references, reference, representation);
      return {
        _tag: "Reference",
        $ref: reference
      };
    }
    return representation;
  }
  function on(ast) {
    const checks = fromChecks(ast.checks);
    switch (ast._tag) {
      case "Declaration":
        return {
          _tag: "Declaration",
          typeParameters: ast.typeParameters.map((ast2) => recur3(ast2)),
          checks,
          ...fromDeclarationAnnotations(ast.annotations)
        };
      case "Null":
      case "Undefined":
      case "Void":
      case "Never":
      case "Unknown":
      case "Any":
      case "String":
      case "Boolean":
      case "Number":
      case "BigInt":
      case "Symbol":
      case "ObjectKeyword":
        return {
          _tag: ast._tag,
          checks,
          ...annotationsField(ast.annotations)
        };
      case "Literal":
        return {
          _tag: "Literal",
          literal: ast.literal,
          checks,
          ...annotationsField(ast.annotations)
        };
      case "UniqueSymbol":
        return {
          _tag: "UniqueSymbol",
          symbol: ast.symbol,
          checks,
          ...annotationsField(ast.annotations)
        };
      case "Enum":
        return {
          _tag: "Enum",
          enums: ast.enums,
          checks,
          ...annotationsField(ast.annotations)
        };
      case "TemplateLiteral":
        return {
          _tag: "TemplateLiteral",
          parts: ast.parts.map((ast2) => recur3(ast2)),
          checks,
          ...annotationsField(ast.annotations)
        };
      case "Arrays":
        return {
          _tag: "Arrays",
          elements: ast.elements.map((element) => {
            const projected = getLastEncoding(element);
            const annotations = projected.context?.annotations;
            return {
              isOptional: isOptional(projected),
              type: recur3(element),
              ...annotationsField(annotations)
            };
          }),
          rest: ast.rest.map((ast2) => recur3(ast2)),
          checks,
          ...annotationsField(ast.annotations)
        };
      case "Objects":
        return {
          _tag: "Objects",
          propertySignatures: ast.propertySignatures.map((property) => {
            const projected = getLastEncoding(property.type);
            const annotations = projected.context?.annotations;
            return {
              name: property.name,
              type: recur3(property.type),
              isOptional: isOptional(projected),
              isMutable: isMutable(projected),
              ...annotationsField(annotations)
            };
          }),
          indexSignatures: ast.indexSignatures.map((index2) => ({
            parameter: recur3(index2.parameter),
            type: recur3(index2.type)
          })),
          checks,
          ...annotationsField(ast.annotations)
        };
      case "Union":
        return {
          _tag: "Union",
          types: ast.types.map((ast2) => recur3(ast2)),
          mode: ast.mode,
          checks,
          ...annotationsField(ast.annotations)
        };
      case "Suspend":
        return {
          _tag: "Suspend",
          checks: [],
          thunk: recur3(ast.thunk()),
          ...annotationsField(ast.annotations)
        };
    }
  }
  function fromChecks(checks) {
    return checks?.map(fromCheck) ?? [];
  }
  function fromCheck(check) {
    switch (check._tag) {
      case "Filter":
        return {
          _tag: "Filter",
          aborted: check.aborted,
          ...fromCheckAnnotations(check.annotations)
        };
      case "FilterGroup":
        return {
          _tag: "FilterGroup",
          checks: map4(check.checks, fromCheck),
          ...fromCheckAnnotations(check.annotations)
        };
    }
  }
  function fromDeclarationAnnotations(annotations) {
    if (annotations === undefined)
      return;
    const {
      representation,
      ...ordinary
    } = annotations;
    return {
      ...representation === undefined ? undefined : {
        representation
      },
      ...Object.keys(ordinary).length === 0 ? undefined : {
        annotations: ordinary
      }
    };
  }
  function fromCheckAnnotations(annotations) {
    if (annotations === undefined)
      return;
    const {
      representation,
      ...ordinary
    } = annotations;
    const projected = representation === undefined ? undefined : representation.schemas === undefined ? representation : {
      ...representation,
      schemas: representation.schemas.map((schema) => recur3(toType(schema)))
    };
    return {
      ...projected === undefined ? undefined : {
        representation: projected
      },
      ...Object.keys(ordinary).length === 0 ? undefined : {
        annotations: ordinary
      }
    };
  }
}

// node_modules/effect/dist/JsonPatch.js
function get3(oldValue, newValue) {
  const patches = [];
  getLoop(oldValue, newValue, "", patches);
  return patches;
}
function getLoop(oldValue, newValue, path, patches) {
  if (Object.is(oldValue, newValue))
    return;
  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    const len1 = oldValue.length;
    const len2 = newValue.length;
    const shared = Math.min(len1, len2);
    for (let i = 0;i < shared; i++) {
      getLoop(oldValue[i], newValue[i], `${path}/${i}`, patches);
    }
    for (let i = len1 - 1;i >= len2; i--) {
      patches.push({
        op: "remove",
        path: `${path}/${i}`
      });
    }
    for (let i = len1;i < len2; i++) {
      patches.push({
        op: "add",
        path: `${path}/${i}`,
        value: newValue[i]
      });
    }
    return;
  }
  if (isJsonObject(oldValue) && isJsonObject(newValue)) {
    const keys1 = Object.keys(oldValue);
    const keys22 = Object.keys(newValue);
    const allKeys = Array.from(new Set([...keys1, ...keys22])).sort();
    for (const key of allKeys) {
      const keyPath = `${path}/${escapeToken(key)}`;
      const hasKey1 = Object.hasOwn(oldValue, key);
      const hasKey2 = Object.hasOwn(newValue, key);
      if (hasKey1 && hasKey2) {
        getLoop(oldValue[key], newValue[key], keyPath, patches);
      } else if (!hasKey1 && hasKey2) {
        patches.push({
          op: "add",
          path: keyPath,
          value: newValue[key]
        });
      } else {
        patches.push({
          op: "remove",
          path: keyPath
        });
      }
    }
    return;
  }
  patches.push({
    op: "replace",
    path,
    value: newValue
  });
}
function apply(patch, oldValue) {
  let doc = oldValue;
  for (const op of patch) {
    doc = applyOperation(doc, op);
  }
  return doc;
}
function isJsonObject(value3) {
  return typeof value3 === "object" && value3 !== null && !Array.isArray(value3);
}
function tokenize(pointer) {
  if (pointer === "")
    return [];
  if (pointer.charCodeAt(0) !== 47) {
    throw new Error(`Invalid JSON Pointer, it must start with "/": ${JSON.stringify(pointer)}`);
  }
  return pointer.split("/").slice(1).map(unescapeToken);
}
function toIndex(token) {
  if (!/^(0|[1-9]\d*)$/.test(token)) {
    throw new Error(`Invalid array index: "${token}"`);
  }
  return Number(token);
}
function applyOperation(doc, op) {
  if (op.path === "") {
    if (op.op === "remove")
      throw new Error("Unsupported operation at the root");
    return op.value;
  }
  const resolved = resolveParent(doc, op.path);
  if (resolved === null) {
    throw new Error(`Cannot ${op.op} at "${op.path}" (parent not found or not a container).`);
  }
  const {
    lastToken,
    parent,
    stack
  } = resolved;
  if (Array.isArray(parent)) {
    if (lastToken === "-" && op.op !== "add") {
      throw new Error(`"-" is not valid for ${op.op} at "${op.path}".`);
    }
    const index2 = lastToken === "-" ? parent.length : toIndex(lastToken);
    const maxIndex = op.op === "add" ? parent.length : parent.length - 1;
    if (index2 > maxIndex)
      throw new Error(`Array index out of bounds at "${op.path}".`);
    const updated = parent.slice();
    if (op.op === "add")
      updated.splice(index2, 0, op.value);
    else if (op.op === "remove")
      updated.splice(index2, 1);
    else
      updated[index2] = op.value;
    return rebuildFromStack(stack, updated);
  }
  if (isJsonObject(parent)) {
    if (op.op !== "add" && !Object.hasOwn(parent, lastToken)) {
      throw new Error(`Property "${lastToken}" does not exist at "${op.path}".`);
    }
    const updated = {
      ...parent
    };
    if (op.op === "remove")
      delete updated[lastToken];
    else
      assignProperty(updated, lastToken, op.value);
    return rebuildFromStack(stack, updated);
  }
  throw new Error(`Cannot ${op.op} at "${op.path}" (parent not found or not a container).`);
}
function resolveParent(doc, pointer) {
  const tokens = tokenize(pointer);
  if (tokens.length === 0)
    return null;
  const lastToken = tokens[tokens.length - 1];
  const stack = [];
  let cur = doc;
  for (let i = 0;i < tokens.length - 1; i++) {
    const token = tokens[i];
    if (Array.isArray(cur)) {
      const idx = toIndex(token);
      if (idx >= cur.length)
        return null;
      stack.push({
        container: cur,
        token: idx
      });
      cur = cur[idx];
      continue;
    }
    if (isJsonObject(cur)) {
      if (!Object.hasOwn(cur, token))
        return null;
      stack.push({
        container: cur,
        token
      });
      cur = cur[token];
      continue;
    }
    return null;
  }
  return {
    stack,
    parent: cur,
    lastToken
  };
}
function rebuildFromStack(stack, newParent) {
  let acc = newParent;
  for (let i = stack.length - 1;i >= 0; i--) {
    const {
      container,
      token
    } = stack[i];
    if (Array.isArray(container)) {
      const copy2 = container.slice();
      copy2[token] = acc;
      acc = copy2;
    } else {
      const copy2 = {
        ...container
      };
      assignProperty(copy2, token, acc);
      acc = copy2;
    }
  }
  return acc;
}

// node_modules/effect/dist/Optic.js
function makeIso(get4, set2) {
  return make17(primitiveNode("Iso", get4, set2));
}
function makeLens(get4, replace) {
  return make17(primitiveNode("Lens", get4, replace));
}
function primitiveNode(kind, get4, set2) {
  return [{
    _tag: "PrimitiveNode",
    kind,
    get: get4,
    set: set2
  }];
}
var identityOperation = {
  kind: "Iso",
  get: identity,
  set: identity
};

class PathNode {
  _tag = "PathNode";
  kind = "Lens";
  path;
  get;
  set;
  constructor(path) {
    this.path = path;
    this.get = (s) => {
      let out = s;
      for (let i = 0;i < path.length; i++) {
        out = out[path[i]];
      }
      return out;
    };
    this.set = (a, s) => {
      const out = cloneShallow(s);
      let current = out;
      let i = 0;
      for (;i < path.length - 1; i++) {
        const key = path[i];
        assignProperty(current, key, cloneShallow(current[key]));
        current = current[key];
      }
      assignProperty(current, path[i], a);
      return out;
    };
  }
}

class CheckNode {
  _tag = "CheckNode";
  kind = "Prism";
  checks;
  get;
  set = identity;
  constructor(checks) {
    this.checks = checks;
    this.get = (s) => runChecks(checks, s);
  }
}
function compose(a, b) {
  if (a.length === 0)
    return b;
  if (b.length === 0)
    return a;
  const nodes = a.slice();
  for (let i = 0;i < b.length; i++) {
    const node = b[i];
    const last = nodes[nodes.length - 1];
    if (last._tag === "PathNode" && node._tag === "PathNode") {
      nodes[nodes.length - 1] = new PathNode([...last.path, ...node.path]);
    } else if (last._tag === "CheckNode" && node._tag === "CheckNode") {
      nodes[nodes.length - 1] = new CheckNode([...last.checks, ...node.checks]);
    } else {
      nodes.push(node);
    }
  }
  return nodes;
}
function makeOptional(getResult, set2) {
  return make17(primitiveNode("Optional", getResult, set2));
}

class OptionalImpl {
  node;
  getResult;
  replaceResult;
  constructor(node, getResult, replaceResult) {
    this.node = node;
    this.getResult = getResult;
    this.replaceResult = replaceResult;
  }
  replace(a, s) {
    return getOrElse2(this.replaceResult(a, s), () => s);
  }
  modify(f) {
    return (s) => getOrElse2(flatMap2(this.getResult(s), (a) => this.replaceResult(f(a), s)), () => s);
  }
  compose(that) {
    return make17(compose(this.node, that.node));
  }
  key(key) {
    return make17(compose(this.node, [new PathNode([key])]));
  }
  optionalKey(key) {
    return make17(compose(this.node, primitiveNode("Lens", (s) => s[key], (a, s) => {
      const copy2 = cloneShallow(s);
      if (a === undefined) {
        if (Array.isArray(copy2) && typeof key === "number") {
          copy2.splice(key, 1);
        } else {
          delete copy2[key];
        }
      } else {
        assignProperty(copy2, key, a);
      }
      return copy2;
    })));
  }
  check(...checks) {
    return make17(compose(this.node, [new CheckNode(checks)]));
  }
  refine(refinement, annotations) {
    return make17(compose(this.node, [new CheckNode([makeFilterByGuard(refinement, annotations)])]));
  }
  tag(tag) {
    const err = fail2(new InvalidValue({
      expected: `${JSON.stringify(tag)} tag`
    }));
    return make17(compose(this.node, primitiveNode("Prism", (s) => s._tag === tag ? succeed2(s) : err, identity)));
  }
  at(key, ..._rest) {
    const err = fail2(new Pointer([key], new MissingKey(undefined)));
    return make17(compose(this.node, primitiveNode("Optional", (s) => Object.hasOwn(s, key) ? succeed2(s[key]) : err, (a, s) => {
      if (Object.hasOwn(s, key)) {
        const copy2 = cloneShallow(s);
        assignProperty(copy2, key, a);
        return succeed2(copy2);
      } else {
        return err;
      }
    })));
  }
  pick(keys3) {
    return this.compose(makeLens(pick(keys3), (p, a) => ({
      ...a,
      ...p
    })));
  }
  omit(keys3) {
    return this.compose(makeLens(omit2(keys3), (o, a) => ({
      ...a,
      ...o
    })));
  }
  notUndefined() {
    return this.refine(isNotUndefined, {
      expected: "a value other than `undefined`"
    });
  }
  forEach(f) {
    const inner = f(id());
    return makeOptional((s) => map2(this.getResult(s), (as3) => {
      const bs = [];
      for (let i = 0;i < as3.length; i++) {
        const r = inner.getResult(as3[i]);
        if (isSuccess2(r))
          bs.push(r.success);
      }
      return bs;
    }), (bs, s) => flatMap2(this.getResult(s), (as3) => {
      const idxs = [];
      for (let i = 0;i < as3.length; i++) {
        if (isSuccess2(inner.getResult(as3[i])))
          idxs.push(i);
      }
      if (bs.length !== idxs.length) {
        return fail2(new InvalidValue({
          message: `each: replacement length mismatch: ${bs.length} !== ${idxs.length}`
        }));
      }
      const out = as3.slice();
      for (let k = 0;k < idxs.length; k++) {
        const i = idxs[k];
        const r = inner.replaceResult(bs[k], as3[i]);
        if (isFailure2(r)) {
          return fail2(new Pointer([i], r.failure));
        }
        out[i] = r.success;
      }
      return this.replaceResult(out, s);
    }));
  }
  modifyAll(f) {
    return (s) => getOrElse2(flatMap2(this.getResult(s), (as3) => this.replaceResult(as3.map(f), s)), () => s);
  }
}

class IsoImpl extends OptionalImpl {
  get;
  set;
  constructor(node, get4, set2) {
    super(node, (s) => succeed2(get4(s)), (a) => succeed2(set2(a)));
    this.get = get4;
    this.set = set2;
  }
  replace(a, _) {
    return this.set(a);
  }
  modify(f) {
    return (s) => this.set(f(this.get(s)));
  }
}

class LensImpl extends OptionalImpl {
  get;
  constructor(node, get4, replace) {
    super(node, (s) => succeed2(get4(s)), (a, s) => succeed2(replace(a, s)));
    this.get = get4;
    this.replace = replace;
  }
  modify(f) {
    return (s) => this.replace(f(this.get(s)), s);
  }
}

class PrismImpl extends OptionalImpl {
  set;
  constructor(node, getResult, set2) {
    super(node, getResult, (a, _) => succeed2(set2(a)));
    this.set = set2;
  }
  replace(a, _) {
    return this.set(a);
  }
  modify(f) {
    return (s) => getOrElse2(map2(this.getResult(s), (a) => this.set(f(a))), () => s);
  }
}
function make17(node) {
  let op = node[0] ?? identityOperation;
  if (node.length > 1) {
    const kind = node.reduce((kind2, step) => composeKind(kind2, step.kind), "Iso");
    op = {
      kind,
      get: compileGet(node, kind),
      set: compileSet(node, kind)
    };
  }
  switch (op.kind) {
    case "Iso":
      return new IsoImpl(node, op.get, op.set);
    case "Lens":
      return new LensImpl(node, op.get, op.set);
    case "Prism":
      return new PrismImpl(node, op.get, op.set);
    case "Optional":
      return new OptionalImpl(node, op.get, op.set);
  }
}
function cloneShallow(pojo) {
  if (Array.isArray(pojo))
    return pojo.slice();
  if (typeof pojo === "object" && pojo !== null) {
    const proto = Object.getPrototypeOf(pojo);
    if (proto !== Object.prototype && proto !== null) {
      throw new Error("Cannot clone object with non-Object constructor or null prototype");
    }
    return {
      ...pojo
    };
  }
  return pojo;
}
function compileGet(nodes, kind) {
  return (s) => {
    for (let i = 0;i < nodes.length; i++) {
      const op = nodes[i];
      const result3 = op.get(s);
      if (hasFailingGet(op.kind)) {
        if (isFailure2(result3)) {
          return result3;
        }
        s = result3.success;
      } else {
        s = result3;
      }
    }
    return hasFailingGet(kind) ? succeed2(s) : s;
  };
}
function compileSet(nodes, kind) {
  if (hasSourceFreeSet(kind)) {
    return (a) => {
      for (let i = nodes.length - 1;i >= 0; i--) {
        a = nodes[i].set(a);
      }
      return a;
    };
  }
  return (a, s) => {
    const len = nodes.length;
    const sources = new Array(len);
    for (let i = 0;i < len; i++) {
      sources[i] = s;
      const op = nodes[i];
      if (hasFailingGet(op.kind)) {
        const result3 = op.get(s);
        if (isFailure2(result3)) {
          return result3;
        }
        s = result3.success;
      } else {
        s = op.get(s);
      }
    }
    for (let i = len - 1;i >= 0; i--) {
      const op = nodes[i];
      if (hasSourceFreeSet(op.kind)) {
        a = op.set(a);
      } else if (op.kind === "Lens") {
        a = op.set(a, sources[i]);
      } else {
        const result3 = op.set(a, sources[i]);
        if (isFailure2(result3)) {
          return result3;
        }
        a = result3.success;
      }
    }
    return kind === "Optional" ? succeed2(a) : a;
  };
}
function hasFailingGet(kind) {
  return kind === "Prism" || kind === "Optional";
}
function hasSourceFreeSet(kind) {
  return kind === "Iso" || kind === "Prism";
}
function composeKind(a, b) {
  if (a === "Iso")
    return b;
  if (b === "Iso" || a === b)
    return a;
  return "Optional";
}
var identityIso = /* @__PURE__ */ make17([]);
function id() {
  return identityIso;
}

// node_modules/effect/dist/SchemaError.js
var TypeId20 = "~effect/SchemaError/SchemaError";

class SchemaError extends (/* @__PURE__ */ TaggedError2("SchemaError")) {
  [TypeId20] = TypeId20;
  constructor(issue) {
    super({
      issue
    });
  }
  get message() {
    return defaultFormatter(this.issue);
  }
  toString() {
    return `SchemaError(${this.message})`;
  }
}
function isSchemaError(u) {
  return hasProperty(u, TypeId20) && u[TypeId20] === TypeId20;
}

// node_modules/effect/dist/Schema.js
var TypeId21 = TypeId19;
function declareConstructor() {
  return (typeParameters, run2, annotations) => {
    return make18(new Declaration(typeParameters.map(getAST), (typeParameters2) => run2(typeParameters2.map((ast) => make18(ast))), annotations));
  };
}
function declare(is2, annotations) {
  return declareConstructor()([], () => (input, ast, options) => is2(input) ? succeed6(input) : fail5(new InvalidType(ast, input, options)), annotations);
}
function revealBottom(bottom) {
  return bottom;
}
function annotate2(annotations) {
  return (self) => self.annotate(annotations);
}
function annotateEncoded(annotations) {
  return (self) => flip4(flip4(self).annotate(annotations));
}
function annotateKey2(annotations) {
  return (self) => {
    return self.rebuild(annotateKey(self.ast, annotations));
  };
}
function revealCodec(codec) {
  return codec;
}
function makeStandardResult(exit3) {
  return isSuccess4(exit3) ? exit3.value : {
    issues: [{
      message: pretty(exit3.cause)
    }]
  };
}
function toStandardSchemaV1(self, options) {
  const decodeUnknownEffect2 = decodeUnknownEffect(self);
  const parseOptions = {
    errors: "all",
    ...options?.parseOptions
  };
  const formatter = makeFormatterStandardSchemaV1(options);
  const validate3 = (value3) => {
    const scheduler = new MixedScheduler("sync");
    const fiber3 = runFork2(match5(decodeUnknownEffect2(value3, parseOptions), {
      onFailure: formatter,
      onSuccess: (value4) => ({
        value: value4
      })
    }), {
      scheduler
    });
    fiber3.currentDispatcher?.flush();
    const exit3 = fiber3.pollUnsafe();
    if (exit3) {
      return makeStandardResult(exit3);
    }
    return new Promise((resolve2) => {
      fiber3.addObserver((exit4) => {
        resolve2(makeStandardResult(exit4));
      });
    });
  };
  if ("~standard" in self) {
    const out = self;
    if ("validate" in out["~standard"])
      return out;
    Object.assign(out["~standard"], {
      validate: validate3
    });
    return out;
  } else {
    return Object.assign(self, {
      "~standard": {
        version: 1,
        vendor: "effect",
        validate: validate3
      }
    });
  }
}
function toBaseStandardJSONSchemaV1(self, target) {
  const doc2020_12 = toJsonSchemaDocument2(self);
  if (target === "draft-2020-12") {
    const schema = doc2020_12.schema;
    if (Object.keys(doc2020_12.definitions).length > 0) {
      schema.$defs = doc2020_12.definitions;
    }
    return schema;
  } else if (target === "draft-07") {
    const doc07 = toDocumentDraft07(doc2020_12);
    const schema = doc07.schema;
    if (Object.keys(doc07.definitions).length > 0) {
      schema.definitions = doc07.definitions;
    }
    return schema;
  }
  throw new globalThis.Error(`Unsupported target: ${target}`);
}
function toStandardJSONSchemaV1(self) {
  const jsonSchema = {
    input(options) {
      return toBaseStandardJSONSchemaV1(self, options.target);
    },
    output(options) {
      return toBaseStandardJSONSchemaV1(toType2(self), options.target);
    }
  };
  if ("~standard" in self) {
    const out = self;
    if ("jsonSchema" in out["~standard"])
      return out;
    Object.assign(out["~standard"], {
      jsonSchema
    });
    return out;
  } else {
    return Object.assign(self, {
      "~standard": {
        version: 1,
        vendor: "effect",
        jsonSchema
      }
    });
  }
}
var is2 = is;
var asserts2 = asserts;
function decodeUnknownEffect2(schema, options) {
  const parser = decodeUnknownEffect(schema, options);
  return (input, options2) => {
    return fromIssueEffect(parser(input, options2));
  };
}
function fromIssueEffect(self) {
  return catchCause2(self, (cause) => failCauseSync2(() => map6(cause, (issue) => new SchemaError(issue))));
}
var decodeEffect2 = decodeUnknownEffect2;
function getSchemaErrorOrThrow(cause, message) {
  let schemaError;
  for (const reason of cause.reasons) {
    if (!isFailReason2(reason) || !isSchemaError(reason.error)) {
      throw new globalThis.Error(message, {
        cause
      });
    }
    schemaError ??= reason.error;
  }
  if (schemaError === undefined) {
    throw new globalThis.Error(message, {
      cause
    });
  }
  return schemaError;
}
function runSchemaErrorPromise(self) {
  return runPromiseExit2(self).then((exit3) => {
    if (isSuccess4(exit3)) {
      return exit3.value;
    }
    throw getSchemaErrorOrThrow(exit3.cause, "Promise adapter can only reject schema errors");
  });
}
function runSchemaErrorSync(self) {
  const exit3 = runSyncExit2(self);
  if (isSuccess4(exit3)) {
    return exit3.value;
  }
  throw getSchemaErrorOrThrow(exit3.cause, "Sync adapter can only throw schema errors");
}
function decodeUnknownExit2(schema, options) {
  const parser = decodeUnknownExit(schema, options);
  return (input, options2) => {
    return fromIssueExit(parser(input, options2));
  };
}
function fromIssueExit(exit3) {
  return isSuccess4(exit3) ? exit3 : failCause2(map6(exit3.cause, (issue) => new SchemaError(issue)));
}
var decodeExit = decodeUnknownExit2;
var decodeUnknownOption2 = decodeUnknownOption;
var decodeOption2 = decodeOption;
function decodeUnknownResult2(schema, options) {
  const parser = decodeUnknownResult(schema, options);
  return (input, options2) => {
    return mapError(parser(input, options2), (issue) => new SchemaError(issue));
  };
}
var decodeResult = decodeUnknownResult2;
function decodeUnknownPromise(schema, options) {
  const parser = decodeUnknownEffect2(schema, options);
  return (input, options2) => {
    return runSchemaErrorPromise(parser(input, options2));
  };
}
var decodePromise = decodeUnknownPromise;
function decodeUnknownSync2(schema, options) {
  const parser = decodeUnknownEffect2(schema, options);
  return (input, options2) => {
    return runSchemaErrorSync(parser(input, options2));
  };
}
var decodeSync2 = decodeUnknownSync2;
function encodeUnknownEffect2(schema, options) {
  const parser = encodeUnknownEffect(schema, options);
  return (input, options2) => {
    return fromIssueEffect(parser(input, options2));
  };
}
var encodeEffect = encodeUnknownEffect2;
function encodeUnknownExit2(schema, options) {
  const parser = encodeUnknownExit(schema, options);
  return (input, options2) => {
    return fromIssueExit(parser(input, options2));
  };
}
var encodeExit = encodeUnknownExit2;
var encodeUnknownOption2 = encodeUnknownOption;
var encodeOption2 = encodeOption;
function encodeUnknownResult2(schema, options) {
  const parser = encodeUnknownResult(schema, options);
  return (input, options2) => {
    return mapError(parser(input, options2), (issue) => new SchemaError(issue));
  };
}
var encodeResult = encodeUnknownResult2;
function encodeUnknownPromise(schema, options) {
  const parser = encodeUnknownEffect2(schema, options);
  return (input, options2) => {
    return runSchemaErrorPromise(parser(input, options2));
  };
}
var encodePromise = encodeUnknownPromise;
function encodeUnknownSync2(schema, options) {
  const parser = encodeUnknownEffect2(schema, options);
  return (input, options2) => {
    return runSchemaErrorSync(parser(input, options2));
  };
}
var encodeSync2 = encodeUnknownSync2;
var make18 = make16;
function isSchema(u) {
  return hasProperty(u, TypeId21) && u[TypeId21] === TypeId21;
}
var optionalKey2 = /* @__PURE__ */ lambda((schema) => make18(optionalKey(schema.ast), {
  schema
}));
var requiredKey = /* @__PURE__ */ lambda((self) => self.schema);
var optional2 = /* @__PURE__ */ lambda((self) => {
  const schema = UndefinedOr(self);
  return make18(optional(self.ast), {
    schema
  });
});
var required = /* @__PURE__ */ lambda((self) => self.schema.members[0]);
var mutableKey2 = /* @__PURE__ */ lambda((schema) => make18(mutableKey(schema.ast), {
  schema
}));
var readonlyKey = /* @__PURE__ */ lambda((self) => self.schema);
var toType2 = /* @__PURE__ */ lambda((schema) => make18(toType(schema.ast), {
  schema
}));
var toEncoded2 = /* @__PURE__ */ lambda((schema) => make18(toEncoded(schema.ast), {
  schema
}));
var FlipTypeId = "~effect/Schema/flip";
function isFlip$(schema) {
  return hasProperty(schema, FlipTypeId) && schema[FlipTypeId] === FlipTypeId;
}
function flip4(schema) {
  if (isFlip$(schema)) {
    return schema.schema.rebuild(flip3(schema.ast));
  }
  return make18(flip3(schema.ast), {
    [FlipTypeId]: FlipTypeId,
    schema
  });
}
function Literal2(literal) {
  const out = make18(new Literal(literal), {
    literal,
    transform(to) {
      return out.pipe(decodeTo2(Literal2(to), {
        decode: transform(() => to),
        encode: transform(() => literal)
      }));
    }
  });
  return out;
}
function templateLiteralFromParts(parts) {
  return new TemplateLiteral(parts.map((part) => isSchema(part) ? part.ast : new Literal(part)));
}
function TemplateLiteral2(parts) {
  return make18(templateLiteralFromParts(parts), {
    parts
  });
}
function TemplateLiteralParser(parts) {
  return make18(templateLiteralFromParts(parts).asTemplateLiteralParser(), {
    parts
  });
}
function Enum2(enums) {
  return make18(new Enum(Object.keys(enums).filter((key) => typeof enums[enums[key]] !== "number").map((key) => [key, enums[key]])), {
    enums
  });
}
var Never2 = /* @__PURE__ */ make18(never3);
var Any2 = /* @__PURE__ */ make18(any);
var Unknown2 = /* @__PURE__ */ make18(unknown);
var Null2 = /* @__PURE__ */ make18(null_);
var Undefined2 = /* @__PURE__ */ make18(undefined_3);
var String5 = /* @__PURE__ */ make18(string2);
var Number6 = /* @__PURE__ */ make18(number2);
var Boolean3 = /* @__PURE__ */ make18(boolean);
var Symbol3 = /* @__PURE__ */ make18(symbol3);
var BigInt5 = /* @__PURE__ */ make18(bigInt);
var Void2 = /* @__PURE__ */ make18(void_4);
var ObjectKeyword2 = /* @__PURE__ */ make18(objectKeyword);
function UniqueSymbol2(symbol4) {
  return make18(new UniqueSymbol(symbol4));
}
function makeStruct(ast, fields) {
  return make18(ast, {
    fields,
    mapFields(f, options) {
      const fields2 = f(this.fields);
      return makeStruct(struct(fields2, options?.unsafePreserveChecks ? this.ast.checks : undefined), fields2);
    }
  });
}
function Struct(fields) {
  return makeStruct(struct(fields, undefined), fields);
}
function fieldsAssign(fields) {
  return lambda((struct2) => struct2.mapFields(assign(fields)));
}
var canonicalPropertyKey = (key) => typeof key === "symbol" ? key : globalThis.String(key);
function encodeKeys(mapping) {
  return function(self) {
    const fields = {};
    const appliedMapping = Object.create(null);
    const reverseMapping = Object.create(null);
    const seenEncodedKeys = new Set;
    for (const k of Reflect.ownKeys(self.fields)) {
      const encoded = toEncoded2(self.fields[k]);
      const hasMapping = Object.hasOwn(mapping, k);
      const encodedKey = hasMapping ? mapping[k] : k;
      const canonical = canonicalPropertyKey(encodedKey);
      if (seenEncodedKeys.has(canonical)) {
        throw new globalThis.Error(`Duplicate encoded keys: ${formatPropertyKey(encodedKey)}`);
      }
      seenEncodedKeys.add(canonical);
      assignProperty(fields, encodedKey, encoded);
      if (hasMapping) {
        appliedMapping[k] = encodedKey;
        reverseMapping[encodedKey] = k;
      }
    }
    return Struct(fields).pipe(decodeTo2(self, transform2({
      decode: renameKeys(reverseMapping),
      encode: renameKeys(appliedMapping)
    })));
  };
}
function extendTo(fields, derive) {
  return (self) => {
    const f = map3(self.fields, toType2);
    const to = Struct({
      ...f,
      ...fields
    });
    return self.pipe(decodeTo2(to, transform2({
      decode: (input) => {
        const out = {
          ...input
        };
        for (const k in fields) {
          const f2 = derive[k];
          const o = f2(input);
          if (isSome2(o)) {
            assignProperty(out, k, o.value);
          }
        }
        return out;
      },
      encode: (input) => {
        const out = {
          ...input
        };
        for (const k in fields) {
          delete out[k];
        }
        return out;
      }
    })));
  };
}
function Record(key, value3) {
  return make18(record(key.ast, value3.ast), {
    key,
    value: value3
  });
}
function StructWithRest(schema, records) {
  return make18(structWithRest(schema.ast, records.map(getAST)), {
    schema,
    records
  });
}
function makeTuple(ast, elements) {
  return make18(ast, {
    elements,
    mapElements(f, options) {
      const elements2 = f(this.elements);
      return makeTuple(tuple(elements2, options?.unsafePreserveChecks ? this.ast.checks : undefined), elements2);
    }
  });
}
function Tuple(elements) {
  return makeTuple(tuple(elements), elements);
}
function TupleWithRest(schema, rest) {
  return make18(tupleWithRest(schema.ast, rest.map(getAST)), {
    schema,
    rest
  });
}
var ArraySchema = /* @__PURE__ */ lambda((schema) => make18(new Arrays(false, [], [schema.ast]), {
  value: schema
}));
var NonEmptyArray = /* @__PURE__ */ lambda((schema) => make18(new Arrays(false, [schema.ast], [schema.ast]), {
  value: schema
}));
function ArrayEnsure(schema) {
  return Union2([schema, ArraySchema(schema)]).pipe(decodeTo2(ArraySchema(toType2(schema)), transform2({
    decode: ensure,
    encode: (array3) => array3.length === 1 ? array3[0] : array3
  })));
}
function UniqueArray(item) {
  return ArraySchema(item).check(isUnique());
}
var mutable = /* @__PURE__ */ lambda((schema) => {
  return make18(new Arrays(true, schema.ast.elements, schema.ast.rest), {
    schema
  });
});
function makeUnion(ast, members) {
  return make18(ast, {
    members,
    mapMembers(f, options) {
      const members2 = f(this.members);
      return makeUnion(union4(members2, this.ast.mode, options?.unsafePreserveChecks ? this.ast.checks : undefined), members2);
    }
  });
}
function Union2(members, options) {
  return makeUnion(union4(members, options?.mode ?? "anyOf", undefined), members);
}
function Literals(literals) {
  const members = literals.map(Literal2);
  return make18(union4(members, "anyOf", undefined), {
    literals,
    members,
    mapMembers(f) {
      return Union2(f(this.members));
    },
    pick(literals2) {
      return Literals(literals2);
    },
    transform(to) {
      return Union2(members.map((member, index2) => member.transform(to[index2])));
    }
  });
}
var NullOr = /* @__PURE__ */ lambda((self) => Union2([self, Null2]));
var UndefinedOr = /* @__PURE__ */ lambda((self) => Union2([self, Undefined2]));
var NullishOr = /* @__PURE__ */ lambda((self) => Union2([self, Null2, Undefined2]));
function suspend3(f) {
  return make18(new Suspend(() => f().ast));
}
function check(...checks) {
  return (self) => self.check(...checks);
}
function refine(refinement, annotations) {
  return (schema) => make18(appendChecks(schema.ast, [makeFilterByGuard(refinement, annotations)]), {
    schema
  });
}
function brand2(identifier2) {
  return (schema) => make18(brand(schema.ast, identifier2), {
    schema,
    identifier: identifier2
  });
}
function fromBrand(identifier2, ctor) {
  return (self) => {
    return (ctor.checks ? self.check(...ctor.checks) : self).pipe(brand2(identifier2));
  };
}
function middlewareDecoding2(decode) {
  return (schema) => make18(middlewareDecoding(schema.ast, new Middleware(decode, identity)), {
    schema
  });
}
function middlewareEncoding2(encode) {
  return (schema) => make18(middlewareEncoding(schema.ast, new Middleware(identity, encode)), {
    schema
  });
}
function catchDecoding(f) {
  return catchDecodingWithContext(f);
}
function catchDecodingWithContext(f) {
  return (self) => middlewareDecoding2(catchEager2(f))(self);
}
function catchEncoding(f) {
  return catchEncodingWithContext(f);
}
function catchEncodingWithContext(f) {
  return (self) => middlewareEncoding2(catchEager2(f))(self);
}
function decodeTo2(to, transformation) {
  return (from) => {
    return make18(decodeTo(from.ast, to.ast, transformation ? make14(transformation) : passthrough3()), {
      from,
      to
    });
  };
}
function decode(transformation) {
  return (self) => {
    return decodeTo2(toType2(self), transformation)(self);
  };
}
function encodeTo(to, transformation) {
  return (from) => {
    return transformation ? decodeTo2(from, transformation)(to) : decodeTo2(from)(to);
  };
}
function encode(transformation) {
  return (self) => {
    return decodeTo2(self, transformation)(toEncoded2(self));
  };
}
function withConstructorDefault2(defaultValue) {
  return (schema) => make18(withConstructorDefault(schema.ast, defaultValue), {
    schema
  });
}
function toIssueEffect(self) {
  return catchCause2(self, (cause) => failCauseSync2(() => map6(cause, (error) => error.issue)));
}
function withDecodingDefaultKey(defaultValue, options) {
  const encode2 = options?.encodingStrategy === "omit" ? omit() : passthrough2();
  return (self) => {
    return optionalKey2(toEncoded2(self)).pipe(decodeTo2(self, {
      decode: withDefault(toIssueEffect(defaultValue)),
      encode: encode2
    }));
  };
}
function withDecodingDefaultTypeKey(defaultValue, options) {
  return (self) => {
    return toType2(self).pipe(withDecodingDefaultKey(defaultValue, options), encodeTo(optionalKey2(self)));
  };
}
function withDecodingDefault(defaultValue, options) {
  const encode2 = options?.encodingStrategy === "omit" ? omit() : passthrough2();
  return (self) => {
    return optional2(toEncoded2(self)).pipe(decodeTo2(self, {
      decode: withDefault(toIssueEffect(defaultValue)),
      encode: encode2
    }));
  };
}
function withDecodingDefaultType(defaultValue, options) {
  return (self) => {
    return toType2(self).pipe(withDecodingDefault(defaultValue, options), encodeTo(optional2(self)));
  };
}
function tag(literal) {
  return Literal2(literal).pipe(withConstructorDefault2(succeed6(literal)));
}
function tagDefaultOmit(literal) {
  return tag(literal).pipe(withDecodingDefaultKey(succeed6(literal), {
    encodingStrategy: "omit"
  }));
}
function TaggedStruct(value3, fields) {
  return Struct({
    _tag: tag(value3),
    ...fields
  });
}
function toTaggedUnion(tag2) {
  return (self) => {
    const cases = {};
    const discriminants = [];
    const discriminantKeys = new Set;
    const guards = {};
    const isAnyOf = (keys3) => (value3) => keys3.includes(value3[tag2]);
    walk(self);
    return Object.assign(self, {
      cases,
      discriminants,
      isAnyOf,
      guards,
      match: match7
    });
    function walk(schema) {
      const ast = schema.ast;
      if (isUnion(ast) && "members" in schema && globalThis.Array.isArray(schema.members) && schema.members.every(isSchema)) {
        return schema.members.forEach(walk);
      }
      const sentinels = collectSentinels(ast);
      if (sentinels.length > 0) {
        const literal = sentinels.find((s) => s.key === tag2)?.literal;
        if (isPropertyKey(literal)) {
          const key = typeof literal === "number" ? globalThis.String(literal) : literal;
          if (discriminantKeys.has(key)) {
            throw new globalThis.Error(`Duplicate discriminant: ${globalThis.String(literal)}`);
          }
          discriminantKeys.add(key);
          discriminants.push(literal);
          assignProperty(cases, literal, schema);
          assignProperty(guards, literal, is2(toType2(schema)));
          return;
        }
      }
      throw new globalThis.Error("No literal or unique symbol found");
    }
    function match7() {
      if (arguments.length === 1) {
        const cases3 = arguments[0];
        return function(value4) {
          const key2 = value4[tag2];
          const handler2 = Object.hasOwn(cases3, key2) ? cases3[key2] : undefined;
          return handler2(value4);
        };
      }
      const value3 = arguments[0];
      const cases2 = arguments[1];
      const key = value3[tag2];
      const handler = Object.hasOwn(cases2, key) ? cases2[key] : undefined;
      return handler(value3);
    }
  };
}
function TaggedUnion(casesByTag) {
  const cases = {};
  const members = [];
  for (const key of Object.keys(casesByTag)) {
    const member = TaggedStruct(key, casesByTag[key]);
    assignProperty(cases, key, member);
    members.push(member);
  }
  const union5 = Union2(members);
  const {
    guards,
    isAnyOf,
    match: match7
  } = toTaggedUnion("_tag")(union5);
  return make18(union5.ast, {
    cases,
    isAnyOf,
    guards,
    match: match7
  });
}
function Opaque() {
  return (schema) => {
    return schema;
  };
}
function instanceOf(constructor, annotations) {
  return declare((u) => u instanceof constructor, annotations);
}
function link() {
  return (encodeTo2, transformation) => {
    return new Link(encodeTo2.ast, make14(transformation));
  };
}
var makeFilter2 = makeFilter;
function makeFilterGroup(checks, annotations = undefined) {
  return new FilterGroup(checks, annotations);
}
function makeFixedDeclarationReviver(id2, schema) {
  return makeDeclarationReviver(id2, Null2, ({
    annotations
  }) => annotations === undefined ? schema : schema.annotate(annotations));
}
var TRIMMED_PATTERN = "^\\S[\\s\\S]*\\S$|^\\S$|^$";
function isTrimmed(annotations) {
  const regExp = new globalThis.RegExp(TRIMMED_PATTERN);
  return makeFilter2((s) => s.trim() === s, {
    expected: "a string with no leading or trailing whitespace",
    representation: {
      id: "effect/schema/isTrimmed",
      payload: null
    },
    toJsonSchema: () => ({
      pattern: regExp.source
    }),
    toCode: () => ({
      runtime: "Schema.isTrimmed()"
    }),
    arbitrary: {
      constraint: {
        patterns: [TRIMMED_PATTERN]
      }
    },
    ...annotations
  });
}
var isTrimmedReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isTrimmed", Null2, ({
  annotations
}) => isTrimmed(annotations));
function isPattern2(regExp, annotations) {
  const source = regExp.source;
  const flags = regExp.flags;
  const runtimeRegExp = flags === "" ? `new RegExp(${format(source)})` : `new RegExp(${format(source)}, ${format(flags)})`;
  return isPattern(regExp, {
    toCode: () => ({
      runtime: `Schema.isPattern(${runtimeRegExp})`
    }),
    ...annotations
  });
}
var IsPatternPayload = /* @__PURE__ */ Struct({
  source: String5,
  flags: String5
}).check(/* @__PURE__ */ makeFilter2((payload) => {
  const result3 = try_(() => new globalThis.RegExp(payload.source, payload.flags));
  return isSuccess2(result3) && result3.success.source === payload.source && result3.success.flags === payload.flags;
}));
var isPatternReviver = {
  id: "effect/schema/isPattern",
  payloadSchema: IsPatternPayload,
  revive: ({
    annotations,
    payload
  }) => isPattern2(new globalThis.RegExp(payload.source, payload.flags), annotations)
};
function isStringFinite2(annotations) {
  return isStringFinite({
    toCode: () => ({
      runtime: "Schema.isStringFinite()"
    }),
    ...annotations
  });
}
var isStringFiniteReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isStringFinite", Null2, ({
  annotations
}) => isStringFinite2(annotations));
function isStringBigInt2(annotations) {
  return isStringBigInt({
    toCode: () => ({
      runtime: "Schema.isStringBigInt()"
    }),
    ...annotations
  });
}
var isStringBigIntReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isStringBigInt", Null2, ({
  annotations
}) => isStringBigInt2(annotations));
function isStringSymbol2(annotations) {
  return isStringSymbol({
    toCode: () => ({
      runtime: "Schema.isStringSymbol()"
    }),
    ...annotations
  });
}
var isStringSymbolReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isStringSymbol", Null2, ({
  annotations
}) => isStringSymbol2(annotations));
var getUUIDRegExp = (version) => {
  if (version) {
    return new globalThis.RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
  }
  return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|[fF]{8}-[fF]{4}-[fF]{4}-[fF]{4}-[fF]{12})$/;
};
function isUUID(version, annotations) {
  const regExp = getUUIDRegExp(version);
  return isPattern2(regExp, {
    expected: version ? `a UUID v${version}` : "a UUID",
    representation: {
      id: "effect/schema/isUUID",
      payload: {
        version: version ?? null
      }
    },
    toJsonSchema: () => ({
      pattern: regExp.source,
      format: "uuid"
    }),
    toCode: () => ({
      runtime: version === undefined ? "Schema.isUUID()" : `Schema.isUUID(${version})`
    }),
    ...annotations
  });
}
var isUUIDReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isUUID", /* @__PURE__ */ Struct({
  version: /* @__PURE__ */ Union2([/* @__PURE__ */ Literals([1, 2, 3, 4, 5, 6, 7, 8]), Null2])
}), ({
  annotations,
  payload
}) => isUUID(payload.version ?? undefined, annotations));
var GUID_REGEXP = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
function isGUID(annotations) {
  return isPattern2(GUID_REGEXP, {
    expected: "a GUID",
    representation: {
      id: "effect/schema/isGUID",
      payload: null
    },
    toJsonSchema: () => ({
      pattern: GUID_REGEXP.source
    }),
    toCode: () => ({
      runtime: "Schema.isGUID()"
    }),
    ...annotations
  });
}
var isGUIDReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isGUID", Null2, ({
  annotations
}) => isGUID(annotations));
function isULID(annotations) {
  const regExp = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/;
  return isPattern2(regExp, {
    representation: {
      id: "effect/schema/isULID",
      payload: null
    },
    toJsonSchema: () => ({
      pattern: regExp.source
    }),
    toCode: () => ({
      runtime: "Schema.isULID()"
    }),
    ...annotations
  });
}
var isULIDReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isULID", Null2, ({
  annotations
}) => isULID(annotations));
function isBase64(annotations) {
  const regExp = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
  return isPattern2(regExp, {
    expected: "a base64 encoded string",
    representation: {
      id: "effect/schema/isBase64",
      payload: null
    },
    toJsonSchema: () => ({
      pattern: regExp.source
    }),
    toCode: () => ({
      runtime: "Schema.isBase64()"
    }),
    ...annotations
  });
}
var isBase64Reviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isBase64", Null2, ({
  annotations
}) => isBase64(annotations));
function isBase64Url(annotations) {
  const regExp = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
  return isPattern2(regExp, {
    expected: "a base64url encoded string",
    representation: {
      id: "effect/schema/isBase64Url",
      payload: null
    },
    toJsonSchema: () => ({
      pattern: regExp.source
    }),
    toCode: () => ({
      runtime: "Schema.isBase64Url()"
    }),
    ...annotations
  });
}
var isBase64UrlReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isBase64Url", Null2, ({
  annotations
}) => isBase64Url(annotations));
function isStartsWith(startsWith, annotations) {
  const formatted = JSON.stringify(startsWith);
  const regExp = new globalThis.RegExp(`^${escape(startsWith)}`);
  return makeFilter2((s) => s.startsWith(startsWith), {
    expected: `a string starting with ${formatted}`,
    representation: {
      id: "effect/schema/isStartsWith",
      payload: {
        startsWith
      }
    },
    toJsonSchema: () => ({
      pattern: regExp.source
    }),
    toCode: () => ({
      runtime: `Schema.isStartsWith(${format(startsWith)})`
    }),
    arbitrary: {
      constraint: {
        patterns: [regExp.source]
      }
    },
    ...annotations
  });
}
var isStartsWithReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isStartsWith", /* @__PURE__ */ Struct({
  startsWith: String5
}), ({
  annotations,
  payload
}) => isStartsWith(payload.startsWith, annotations));
function isEndsWith(endsWith, annotations) {
  const formatted = JSON.stringify(endsWith);
  const regExp = new globalThis.RegExp(`${escape(endsWith)}$`);
  return makeFilter2((s) => s.endsWith(endsWith), {
    expected: `a string ending with ${formatted}`,
    representation: {
      id: "effect/schema/isEndsWith",
      payload: {
        endsWith
      }
    },
    toJsonSchema: () => ({
      pattern: regExp.source
    }),
    toCode: () => ({
      runtime: `Schema.isEndsWith(${format(endsWith)})`
    }),
    arbitrary: {
      constraint: {
        patterns: [regExp.source]
      }
    },
    ...annotations
  });
}
var isEndsWithReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isEndsWith", /* @__PURE__ */ Struct({
  endsWith: String5
}), ({
  annotations,
  payload
}) => isEndsWith(payload.endsWith, annotations));
function isIncludes(includes, annotations) {
  const formatted = JSON.stringify(includes);
  const regExp = new globalThis.RegExp(escape(includes));
  return makeFilter2((s) => s.includes(includes), {
    expected: `a string including ${formatted}`,
    representation: {
      id: "effect/schema/isIncludes",
      payload: {
        includes
      }
    },
    toJsonSchema: () => ({
      pattern: regExp.source
    }),
    toCode: () => ({
      runtime: `Schema.isIncludes(${format(includes)})`
    }),
    arbitrary: {
      constraint: {
        patterns: [regExp.source]
      }
    },
    ...annotations
  });
}
var isIncludesReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isIncludes", /* @__PURE__ */ Struct({
  includes: String5
}), ({
  annotations,
  payload
}) => isIncludes(payload.includes, annotations));
var UPPERCASED_PATTERN = "^[^a-z]*$";
function isUppercased(annotations) {
  const regExp = new globalThis.RegExp(UPPERCASED_PATTERN);
  return makeFilter2((s) => s.toUpperCase() === s, {
    expected: "a string with all characters in uppercase",
    representation: {
      id: "effect/schema/isUppercased",
      payload: null
    },
    toJsonSchema: () => ({
      pattern: regExp.source
    }),
    toCode: () => ({
      runtime: "Schema.isUppercased()"
    }),
    arbitrary: {
      constraint: {
        patterns: [UPPERCASED_PATTERN]
      }
    },
    ...annotations
  });
}
var isUppercasedReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isUppercased", Null2, ({
  annotations
}) => isUppercased(annotations));
var LOWERCASED_PATTERN = "^[^A-Z]*$";
function isLowercased(annotations) {
  const regExp = new globalThis.RegExp(LOWERCASED_PATTERN);
  return makeFilter2((s) => s.toLowerCase() === s, {
    expected: "a string with all characters in lowercase",
    representation: {
      id: "effect/schema/isLowercased",
      payload: null
    },
    toJsonSchema: () => ({
      pattern: regExp.source
    }),
    toCode: () => ({
      runtime: "Schema.isLowercased()"
    }),
    arbitrary: {
      constraint: {
        patterns: [LOWERCASED_PATTERN]
      }
    },
    ...annotations
  });
}
var isLowercasedReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isLowercased", Null2, ({
  annotations
}) => isLowercased(annotations));
var CAPITALIZED_PATTERN = "^[^a-z]?.*$";
function isCapitalized(annotations) {
  const regExp = new globalThis.RegExp(CAPITALIZED_PATTERN);
  return makeFilter2((s) => s.charAt(0).toUpperCase() === s.charAt(0), {
    expected: "a string with the first character in uppercase",
    representation: {
      id: "effect/schema/isCapitalized",
      payload: null
    },
    toJsonSchema: () => ({
      pattern: regExp.source
    }),
    toCode: () => ({
      runtime: "Schema.isCapitalized()"
    }),
    arbitrary: {
      constraint: {
        patterns: [CAPITALIZED_PATTERN]
      }
    },
    ...annotations
  });
}
var isCapitalizedReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isCapitalized", Null2, ({
  annotations
}) => isCapitalized(annotations));
var UNCAPITALIZED_PATTERN = "^[^A-Z]?.*$";
function isUncapitalized(annotations) {
  const regExp = new globalThis.RegExp(UNCAPITALIZED_PATTERN);
  return makeFilter2((s) => s.charAt(0).toLowerCase() === s.charAt(0), {
    expected: "a string with the first character in lowercase",
    representation: {
      id: "effect/schema/isUncapitalized",
      payload: null
    },
    toJsonSchema: () => ({
      pattern: regExp.source
    }),
    toCode: () => ({
      runtime: "Schema.isUncapitalized()"
    }),
    arbitrary: {
      constraint: {
        patterns: [UNCAPITALIZED_PATTERN]
      }
    },
    ...annotations
  });
}
var isUncapitalizedReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isUncapitalized", Null2, ({
  annotations
}) => isUncapitalized(annotations));
var Finite = /* @__PURE__ */ make18(finite);
var isFinite2 = isFinite;
var isFiniteReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isFinite", Null2, ({
  annotations
}) => isFinite2(annotations));
function makeIsGreaterThan(options) {
  const gt = isGreaterThan(options.order);
  const formatter = options.formatter ?? format;
  return (exclusiveMinimum, annotations) => {
    return makeFilter2((input) => gt(input, exclusiveMinimum), {
      expected: `a value greater than ${formatter(exclusiveMinimum)}`,
      arbitrary: {
        constraint: {
          ordered: {
            order: options.order,
            minimum: exclusiveMinimum,
            exclusiveMinimum: true
          }
        }
      },
      ...options.annotate?.(exclusiveMinimum),
      ...annotations
    });
  };
}
function makeIsGreaterThanOrEqualTo(options) {
  const gte = isGreaterThanOrEqualTo(options.order);
  const formatter = options.formatter ?? format;
  return (minimum, annotations) => {
    return makeFilter2((input) => gte(input, minimum), {
      expected: `a value greater than or equal to ${formatter(minimum)}`,
      arbitrary: {
        constraint: {
          ordered: {
            order: options.order,
            minimum
          }
        }
      },
      ...options.annotate?.(minimum),
      ...annotations
    });
  };
}
function makeIsLessThan(options) {
  const lt = isLessThan(options.order);
  const formatter = options.formatter ?? format;
  return (exclusiveMaximum, annotations) => {
    return makeFilter2((input) => lt(input, exclusiveMaximum), {
      expected: `a value less than ${formatter(exclusiveMaximum)}`,
      arbitrary: {
        constraint: {
          ordered: {
            order: options.order,
            maximum: exclusiveMaximum,
            exclusiveMaximum: true
          }
        }
      },
      ...options.annotate?.(exclusiveMaximum),
      ...annotations
    });
  };
}
function makeIsLessThanOrEqualTo(options) {
  const lte = isLessThanOrEqualTo(options.order);
  const formatter = options.formatter ?? format;
  return (maximum, annotations) => {
    return makeFilter2((input) => lte(input, maximum), {
      expected: `a value less than or equal to ${formatter(maximum)}`,
      arbitrary: {
        constraint: {
          ordered: {
            order: options.order,
            maximum
          }
        }
      },
      ...options.annotate?.(maximum),
      ...annotations
    });
  };
}
function makeIsBetween(deriveOptions) {
  const greaterThanOrEqualTo = isGreaterThanOrEqualTo(deriveOptions.order);
  const greaterThan = isGreaterThan(deriveOptions.order);
  const lessThanOrEqualTo = isLessThanOrEqualTo(deriveOptions.order);
  const lessThan = isLessThan(deriveOptions.order);
  const formatter = deriveOptions.formatter ?? format;
  return (options, annotations) => {
    const gte = options.exclusiveMinimum ? greaterThan : greaterThanOrEqualTo;
    const lte = options.exclusiveMaximum ? lessThan : lessThanOrEqualTo;
    return makeFilter2((input) => gte(input, options.minimum) && lte(input, options.maximum), {
      expected: `a value between ${formatter(options.minimum)}${options.exclusiveMinimum ? " (excluded)" : ""} and ${formatter(options.maximum)}${options.exclusiveMaximum ? " (excluded)" : ""}`,
      arbitrary: {
        constraint: {
          ordered: {
            order: deriveOptions.order,
            minimum: options.minimum,
            maximum: options.maximum,
            ...options.exclusiveMinimum && {
              exclusiveMinimum: true
            },
            ...options.exclusiveMaximum && {
              exclusiveMaximum: true
            }
          }
        }
      },
      ...deriveOptions.annotate?.(options),
      ...annotations
    });
  };
}
function makeIsMultipleOf(options) {
  return (divisor, annotations) => {
    const formatter = options.formatter ?? format;
    return makeFilter2((input) => options.remainder(input, divisor) === options.zero, {
      expected: `a value that is a multiple of ${formatter(divisor)}`,
      ...options.annotate?.(divisor),
      ...annotations
    });
  };
}
function encodeNumberPayload(number3) {
  if (!globalThis.Number.isFinite(number3)) {
    throw new globalThis.RangeError(`Expected a finite number, got ${format(number3)}`);
  }
  return number3;
}
var isGreaterThan4 = /* @__PURE__ */ makeIsGreaterThan({
  order: Number2,
  annotate: (exclusiveMinimum) => ({
    representation: {
      id: "effect/schema/isGreaterThan",
      payload: {
        exclusiveMinimum: encodeNumberPayload(exclusiveMinimum)
      }
    },
    toJsonSchema: () => ({
      exclusiveMinimum
    }),
    toCode: () => ({
      runtime: `Schema.isGreaterThan(${format(exclusiveMinimum)})`
    })
  })
});
var isGreaterThanReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isGreaterThan", /* @__PURE__ */ Struct({
  exclusiveMinimum: Finite
}), ({
  annotations,
  payload
}) => isGreaterThan4(payload.exclusiveMinimum, annotations));
var isGreaterThanOrEqualTo3 = /* @__PURE__ */ makeIsGreaterThanOrEqualTo({
  order: Number2,
  annotate: (minimum) => ({
    representation: {
      id: "effect/schema/isGreaterThanOrEqualTo",
      payload: {
        minimum: encodeNumberPayload(minimum)
      }
    },
    toJsonSchema: () => ({
      minimum
    }),
    toCode: () => ({
      runtime: `Schema.isGreaterThanOrEqualTo(${format(minimum)})`
    })
  })
});
var isGreaterThanOrEqualToReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isGreaterThanOrEqualTo", /* @__PURE__ */ Struct({
  minimum: Finite
}), ({
  annotations,
  payload
}) => isGreaterThanOrEqualTo3(payload.minimum, annotations));
var isLessThan4 = /* @__PURE__ */ makeIsLessThan({
  order: Number2,
  annotate: (exclusiveMaximum) => ({
    representation: {
      id: "effect/schema/isLessThan",
      payload: {
        exclusiveMaximum: encodeNumberPayload(exclusiveMaximum)
      }
    },
    toJsonSchema: () => ({
      exclusiveMaximum
    }),
    toCode: () => ({
      runtime: `Schema.isLessThan(${format(exclusiveMaximum)})`
    })
  })
});
var isLessThanReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isLessThan", /* @__PURE__ */ Struct({
  exclusiveMaximum: Finite
}), ({
  annotations,
  payload
}) => isLessThan4(payload.exclusiveMaximum, annotations));
var isLessThanOrEqualTo4 = /* @__PURE__ */ makeIsLessThanOrEqualTo({
  order: Number2,
  annotate: (maximum) => ({
    representation: {
      id: "effect/schema/isLessThanOrEqualTo",
      payload: {
        maximum: encodeNumberPayload(maximum)
      }
    },
    toJsonSchema: () => ({
      maximum
    }),
    toCode: () => ({
      runtime: `Schema.isLessThanOrEqualTo(${format(maximum)})`
    })
  })
});
var isLessThanOrEqualToReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isLessThanOrEqualTo", /* @__PURE__ */ Struct({
  maximum: Finite
}), ({
  annotations,
  payload
}) => isLessThanOrEqualTo4(payload.maximum, annotations));
var isBetween2 = /* @__PURE__ */ makeIsBetween({
  order: Number2,
  annotate: (options) => {
    const exclusiveMinimum = options.exclusiveMinimum ? true : undefined;
    const exclusiveMaximum = options.exclusiveMaximum ? true : undefined;
    const payload = {
      minimum: encodeNumberPayload(options.minimum),
      maximum: encodeNumberPayload(options.maximum),
      ...exclusiveMinimum && {
        exclusiveMinimum
      },
      ...exclusiveMaximum && {
        exclusiveMaximum
      }
    };
    return {
      representation: {
        id: "effect/schema/isBetween",
        payload
      },
      toJsonSchema: () => ({
        [exclusiveMinimum ? "exclusiveMinimum" : "minimum"]: options.minimum,
        [exclusiveMaximum ? "exclusiveMaximum" : "maximum"]: options.maximum
      }),
      toCode: () => ({
        runtime: `Schema.isBetween({ minimum: ${format(options.minimum)}, maximum: ${format(options.maximum)}, exclusiveMinimum: ${format(exclusiveMinimum)}, exclusiveMaximum: ${format(exclusiveMaximum)} })`
      })
    };
  }
});
var isBetweenReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isBetween", /* @__PURE__ */ Struct({
  minimum: Finite,
  maximum: Finite,
  exclusiveMinimum: /* @__PURE__ */ optional2(/* @__PURE__ */ Literal2(true)),
  exclusiveMaximum: /* @__PURE__ */ optional2(/* @__PURE__ */ Literal2(true))
}), ({
  annotations,
  payload
}) => isBetween2(payload, annotations));
var isMultipleOf = /* @__PURE__ */ makeIsMultipleOf({
  remainder,
  zero: 0,
  annotate: (divisor) => ({
    expected: `a value that is a multiple of ${divisor}`,
    representation: {
      id: "effect/schema/isMultipleOf",
      payload: {
        divisor
      }
    },
    toJsonSchema: () => ({
      multipleOf: divisor
    }),
    toCode: () => ({
      runtime: `Schema.isMultipleOf(${format(divisor)})`
    })
  })
});
var isMultipleOfReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isMultipleOf", /* @__PURE__ */ Struct({
  divisor: Finite
}), ({
  annotations,
  payload
}) => isMultipleOf(payload.divisor, annotations));
function isInt(annotations) {
  return makeFilter2((n) => globalThis.Number.isSafeInteger(n), {
    expected: "an integer",
    representation: {
      id: "effect/schema/isInt",
      payload: null
    },
    toJsonSchema: () => ({
      type: "integer"
    }),
    toCode: () => ({
      runtime: "Schema.isInt()"
    }),
    arbitrary: {
      constraint: {
        integer: true
      }
    },
    ...annotations
  });
}
var isIntReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isInt", Null2, ({
  annotations
}) => isInt(annotations));
var Int = /* @__PURE__ */ Number6.check(/* @__PURE__ */ isInt());
var Natural = /* @__PURE__ */ Int.check(/* @__PURE__ */ isGreaterThanOrEqualTo3(0));
function isInt32(annotations) {
  return new FilterGroup([isInt(), isBetween2({
    minimum: -2147483648,
    maximum: 2147483647
  })], {
    expected: "a 32-bit integer",
    ...annotations
  });
}
function isUint32(annotations) {
  return new FilterGroup([isInt(), isBetween2({
    minimum: 0,
    maximum: 4294967295
  })], {
    expected: "a 32-bit unsigned integer",
    ...annotations
  });
}
function encodeDatePayload(date) {
  if (globalThis.Number.isNaN(date.getTime())) {
    throw new globalThis.RangeError(`Expected a valid Date, got ${format(date)}`);
  }
  return date.toISOString();
}
function formatDateRuntime(date) {
  return `new Date(${format(date.getTime())})`;
}
var isGreaterThanDate = /* @__PURE__ */ makeIsGreaterThan({
  order: Date2,
  annotate: (exclusiveMinimum) => {
    const encoded = encodeDatePayload(exclusiveMinimum);
    return {
      representation: {
        id: "effect/schema/isGreaterThanDate",
        payload: {
          exclusiveMinimum: encoded
        }
      },
      toJsonSchema: () => ({}),
      toCode: () => ({
        runtime: `Schema.isGreaterThanDate(${formatDateRuntime(exclusiveMinimum)})`
      })
    };
  }
});
var isGreaterThanOrEqualToDate = /* @__PURE__ */ makeIsGreaterThanOrEqualTo({
  order: Date2,
  annotate: (minimum) => {
    const encoded = encodeDatePayload(minimum);
    return {
      representation: {
        id: "effect/schema/isGreaterThanOrEqualToDate",
        payload: {
          minimum: encoded
        }
      },
      toJsonSchema: () => ({}),
      toCode: () => ({
        runtime: `Schema.isGreaterThanOrEqualToDate(${formatDateRuntime(minimum)})`
      })
    };
  }
});
var isLessThanDate = /* @__PURE__ */ makeIsLessThan({
  order: Date2,
  annotate: (exclusiveMaximum) => {
    const encoded = encodeDatePayload(exclusiveMaximum);
    return {
      representation: {
        id: "effect/schema/isLessThanDate",
        payload: {
          exclusiveMaximum: encoded
        }
      },
      toJsonSchema: () => ({}),
      toCode: () => ({
        runtime: `Schema.isLessThanDate(${formatDateRuntime(exclusiveMaximum)})`
      })
    };
  }
});
var isLessThanOrEqualToDate = /* @__PURE__ */ makeIsLessThanOrEqualTo({
  order: Date2,
  annotate: (maximum) => {
    const encoded = encodeDatePayload(maximum);
    return {
      representation: {
        id: "effect/schema/isLessThanOrEqualToDate",
        payload: {
          maximum: encoded
        }
      },
      toJsonSchema: () => ({}),
      toCode: () => ({
        runtime: `Schema.isLessThanOrEqualToDate(${formatDateRuntime(maximum)})`
      })
    };
  }
});
var isBetweenDate = /* @__PURE__ */ makeIsBetween({
  order: Date2,
  annotate: (options) => {
    const exclusiveMinimum = options.exclusiveMinimum ? true : undefined;
    const exclusiveMaximum = options.exclusiveMaximum ? true : undefined;
    const payload = {
      minimum: encodeDatePayload(options.minimum),
      maximum: encodeDatePayload(options.maximum),
      ...exclusiveMinimum && {
        exclusiveMinimum
      },
      ...exclusiveMaximum && {
        exclusiveMaximum
      }
    };
    return {
      representation: {
        id: "effect/schema/isBetweenDate",
        payload
      },
      toJsonSchema: () => ({}),
      toCode: () => ({
        runtime: `Schema.isBetweenDate({ minimum: ${formatDateRuntime(options.minimum)}, maximum: ${formatDateRuntime(options.maximum)}, exclusiveMinimum: ${format(exclusiveMinimum)}, exclusiveMaximum: ${format(exclusiveMaximum)} })`
      })
    };
  }
});
var isGreaterThanBigInt = /* @__PURE__ */ makeIsGreaterThan({
  order: BigInt2,
  annotate: (exclusiveMinimum) => {
    const encoded = exclusiveMinimum.toString(10);
    return {
      representation: {
        id: "effect/schema/isGreaterThanBigInt",
        payload: {
          exclusiveMinimum: encoded
        }
      },
      toJsonSchema: () => ({}),
      toCode: () => ({
        runtime: `Schema.isGreaterThanBigInt(${format(exclusiveMinimum)})`
      })
    };
  }
});
var isGreaterThanOrEqualToBigInt = /* @__PURE__ */ makeIsGreaterThanOrEqualTo({
  order: BigInt2,
  annotate: (minimum) => {
    const encoded = minimum.toString(10);
    return {
      representation: {
        id: "effect/schema/isGreaterThanOrEqualToBigInt",
        payload: {
          minimum: encoded
        }
      },
      toJsonSchema: () => ({}),
      toCode: () => ({
        runtime: `Schema.isGreaterThanOrEqualToBigInt(${format(minimum)})`
      })
    };
  }
});
var isLessThanBigInt = /* @__PURE__ */ makeIsLessThan({
  order: BigInt2,
  annotate: (exclusiveMaximum) => {
    const encoded = exclusiveMaximum.toString(10);
    return {
      representation: {
        id: "effect/schema/isLessThanBigInt",
        payload: {
          exclusiveMaximum: encoded
        }
      },
      toJsonSchema: () => ({}),
      toCode: () => ({
        runtime: `Schema.isLessThanBigInt(${format(exclusiveMaximum)})`
      })
    };
  }
});
var isLessThanOrEqualToBigInt = /* @__PURE__ */ makeIsLessThanOrEqualTo({
  order: BigInt2,
  annotate: (maximum) => {
    const encoded = maximum.toString(10);
    return {
      representation: {
        id: "effect/schema/isLessThanOrEqualToBigInt",
        payload: {
          maximum: encoded
        }
      },
      toJsonSchema: () => ({}),
      toCode: () => ({
        runtime: `Schema.isLessThanOrEqualToBigInt(${format(maximum)})`
      })
    };
  }
});
var isBetweenBigInt = /* @__PURE__ */ makeIsBetween({
  order: BigInt2,
  annotate: (options) => {
    const exclusiveMinimum = options.exclusiveMinimum ? true : undefined;
    const exclusiveMaximum = options.exclusiveMaximum ? true : undefined;
    const payload = {
      minimum: options.minimum.toString(10),
      maximum: options.maximum.toString(10),
      ...exclusiveMinimum && {
        exclusiveMinimum
      },
      ...exclusiveMaximum && {
        exclusiveMaximum
      }
    };
    return {
      representation: {
        id: "effect/schema/isBetweenBigInt",
        payload
      },
      toJsonSchema: () => ({}),
      toCode: () => ({
        runtime: `Schema.isBetweenBigInt({ minimum: ${format(options.minimum)}, maximum: ${format(options.maximum)}, exclusiveMinimum: ${format(exclusiveMinimum)}, exclusiveMaximum: ${format(exclusiveMaximum)} })`
      })
    };
  }
});
var isGreaterThanBigDecimal = /* @__PURE__ */ makeIsGreaterThan({
  order: Order2,
  formatter: (bd) => format2(bd)
});
var isGreaterThanOrEqualToBigDecimal = /* @__PURE__ */ makeIsGreaterThanOrEqualTo({
  order: Order2,
  formatter: (bd) => format2(bd)
});
var isLessThanBigDecimal = /* @__PURE__ */ makeIsLessThan({
  order: Order2,
  formatter: (bd) => format2(bd)
});
var isLessThanOrEqualToBigDecimal = /* @__PURE__ */ makeIsLessThanOrEqualTo({
  order: Order2,
  formatter: (bd) => format2(bd)
});
var isBetweenBigDecimal = /* @__PURE__ */ makeIsBetween({
  order: Order2,
  formatter: (bd) => format2(bd)
});
function isMinLength(minLength, annotations) {
  minLength = Math.max(0, Math.floor(minLength));
  return makeFilter2((input) => input.length >= minLength, {
    expected: `a value with a length of at least ${minLength}`,
    representation: {
      id: "effect/schema/isMinLength",
      payload: {
        minLength
      }
    },
    toJsonSchema: ({
      type
    }) => type === "array" ? {
      minItems: minLength
    } : {
      minLength
    },
    toCode: () => ({
      runtime: `Schema.isMinLength(${minLength})`
    }),
    [STRUCTURAL_ANNOTATION_KEY]: true,
    arbitrary: {
      constraint: {
        minLength
      }
    },
    ...annotations
  });
}
var isMinLengthReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isMinLength", /* @__PURE__ */ Struct({
  minLength: Natural
}), ({
  annotations,
  payload
}) => isMinLength(payload.minLength, annotations));
function isNonEmpty(annotations) {
  return isMinLength(1, annotations);
}
function isMaxLength(maxLength, annotations) {
  maxLength = Math.max(0, Math.floor(maxLength));
  return makeFilter2((input) => input.length <= maxLength, {
    expected: `a value with a length of at most ${maxLength}`,
    representation: {
      id: "effect/schema/isMaxLength",
      payload: {
        maxLength
      }
    },
    toJsonSchema: ({
      type
    }) => type === "array" ? {
      maxItems: maxLength
    } : {
      maxLength
    },
    toCode: () => ({
      runtime: `Schema.isMaxLength(${maxLength})`
    }),
    [STRUCTURAL_ANNOTATION_KEY]: true,
    arbitrary: {
      constraint: {
        maxLength
      }
    },
    ...annotations
  });
}
var isMaxLengthReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isMaxLength", /* @__PURE__ */ Struct({
  maxLength: Natural
}), ({
  annotations,
  payload
}) => isMaxLength(payload.maxLength, annotations));
function isLengthBetween(minimum, maximum, annotations) {
  minimum = Math.max(0, Math.floor(minimum));
  maximum = Math.max(0, Math.floor(maximum));
  return makeFilter2((input) => input.length >= minimum && input.length <= maximum, {
    expected: minimum === maximum ? `a value with a length of ${minimum}` : `a value with a length between ${minimum} and ${maximum}`,
    representation: {
      id: "effect/schema/isLengthBetween",
      payload: {
        minimum,
        maximum
      }
    },
    toJsonSchema: ({
      type
    }) => type === "array" ? {
      allOf: [{
        minItems: minimum
      }, {
        maxItems: maximum
      }]
    } : {
      allOf: [{
        minLength: minimum
      }, {
        maxLength: maximum
      }]
    },
    toCode: () => ({
      runtime: `Schema.isLengthBetween(${minimum}, ${maximum})`
    }),
    [STRUCTURAL_ANNOTATION_KEY]: true,
    arbitrary: {
      constraint: {
        minLength: minimum,
        maxLength: maximum
      }
    },
    ...annotations
  });
}
var isLengthBetweenReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isLengthBetween", /* @__PURE__ */ Struct({
  minimum: Natural,
  maximum: Natural
}), ({
  annotations,
  payload
}) => isLengthBetween(payload.minimum, payload.maximum, annotations));
function isMinSize(minSize, annotations) {
  minSize = Math.max(0, Math.floor(minSize));
  return makeFilter2((input) => input.size >= minSize, {
    expected: `a value with a size of at least ${minSize}`,
    representation: {
      id: "effect/schema/isMinSize",
      payload: {
        minSize
      }
    },
    toJsonSchema: () => ({}),
    toCode: () => ({
      runtime: `Schema.isMinSize(${minSize})`
    }),
    [STRUCTURAL_ANNOTATION_KEY]: true,
    arbitrary: {
      constraint: {
        minLength: minSize
      }
    },
    ...annotations
  });
}
var isMinSizeReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isMinSize", /* @__PURE__ */ Struct({
  minSize: Natural
}), ({
  annotations,
  payload
}) => isMinSize(payload.minSize, annotations));
function isMaxSize(maxSize, annotations) {
  maxSize = Math.max(0, Math.floor(maxSize));
  return makeFilter2((input) => input.size <= maxSize, {
    expected: `a value with a size of at most ${maxSize}`,
    representation: {
      id: "effect/schema/isMaxSize",
      payload: {
        maxSize
      }
    },
    toJsonSchema: () => ({}),
    toCode: () => ({
      runtime: `Schema.isMaxSize(${maxSize})`
    }),
    [STRUCTURAL_ANNOTATION_KEY]: true,
    arbitrary: {
      constraint: {
        maxLength: maxSize
      }
    },
    ...annotations
  });
}
var isMaxSizeReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isMaxSize", /* @__PURE__ */ Struct({
  maxSize: Natural
}), ({
  annotations,
  payload
}) => isMaxSize(payload.maxSize, annotations));
function isSizeBetween(minimum, maximum, annotations) {
  minimum = Math.max(0, Math.floor(minimum));
  maximum = Math.max(0, Math.floor(maximum));
  return makeFilter2((input) => input.size >= minimum && input.size <= maximum, {
    expected: minimum === maximum ? `a value with a size of ${minimum}` : `a value with a size between ${minimum} and ${maximum}`,
    representation: {
      id: "effect/schema/isSizeBetween",
      payload: {
        minimum,
        maximum
      }
    },
    toJsonSchema: () => ({}),
    toCode: () => ({
      runtime: `Schema.isSizeBetween(${minimum}, ${maximum})`
    }),
    [STRUCTURAL_ANNOTATION_KEY]: true,
    arbitrary: {
      constraint: {
        minLength: minimum,
        maxLength: maximum
      }
    },
    ...annotations
  });
}
var isSizeBetweenReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isSizeBetween", /* @__PURE__ */ Struct({
  minimum: Natural,
  maximum: Natural
}), ({
  annotations,
  payload
}) => isSizeBetween(payload.minimum, payload.maximum, annotations));
function isMinProperties(minProperties, annotations) {
  minProperties = Math.max(0, Math.floor(minProperties));
  return makeFilter2((input) => Reflect.ownKeys(input).length >= minProperties, {
    expected: `a value with at least ${minProperties === 1 ? "1 entry" : `${minProperties} entries`}`,
    representation: {
      id: "effect/schema/isMinProperties",
      payload: {
        minProperties
      }
    },
    toJsonSchema: () => ({
      minProperties
    }),
    toCode: () => ({
      runtime: `Schema.isMinProperties(${minProperties})`
    }),
    [STRUCTURAL_ANNOTATION_KEY]: true,
    arbitrary: {
      constraint: {
        minLength: minProperties
      }
    },
    ...annotations
  });
}
var isMinPropertiesReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isMinProperties", /* @__PURE__ */ Struct({
  minProperties: Natural
}), ({
  annotations,
  payload
}) => isMinProperties(payload.minProperties, annotations));
function isMaxProperties(maxProperties, annotations) {
  maxProperties = Math.max(0, Math.floor(maxProperties));
  return makeFilter2((input) => Reflect.ownKeys(input).length <= maxProperties, {
    expected: `a value with at most ${maxProperties === 1 ? "1 entry" : `${maxProperties} entries`}`,
    representation: {
      id: "effect/schema/isMaxProperties",
      payload: {
        maxProperties
      }
    },
    toJsonSchema: () => ({
      maxProperties
    }),
    toCode: () => ({
      runtime: `Schema.isMaxProperties(${maxProperties})`
    }),
    [STRUCTURAL_ANNOTATION_KEY]: true,
    arbitrary: {
      constraint: {
        maxLength: maxProperties
      }
    },
    ...annotations
  });
}
var isMaxPropertiesReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isMaxProperties", /* @__PURE__ */ Struct({
  maxProperties: Natural
}), ({
  annotations,
  payload
}) => isMaxProperties(payload.maxProperties, annotations));
function isPropertiesLengthBetween(minimum, maximum, annotations) {
  minimum = Math.max(0, Math.floor(minimum));
  maximum = Math.max(0, Math.floor(maximum));
  return makeFilter2((input) => Reflect.ownKeys(input).length >= minimum && Reflect.ownKeys(input).length <= maximum, {
    expected: minimum === maximum ? `a value with exactly ${minimum === 1 ? "1 entry" : `${minimum} entries`}` : `a value with between ${minimum} and ${maximum} entries`,
    representation: {
      id: "effect/schema/isPropertiesLengthBetween",
      payload: {
        minimum,
        maximum
      }
    },
    toJsonSchema: () => ({
      minProperties: minimum,
      maxProperties: maximum
    }),
    toCode: () => ({
      runtime: `Schema.isPropertiesLengthBetween(${minimum}, ${maximum})`
    }),
    [STRUCTURAL_ANNOTATION_KEY]: true,
    arbitrary: {
      constraint: {
        minLength: minimum,
        maxLength: maximum
      }
    },
    ...annotations
  });
}
var isPropertiesLengthBetweenReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isPropertiesLengthBetween", /* @__PURE__ */ Struct({
  minimum: Natural,
  maximum: Natural
}), ({
  annotations,
  payload
}) => isPropertiesLengthBetween(payload.minimum, payload.maximum, annotations));
function isPropertyNames(keySchema, annotations) {
  const propertyNames = toEncoded2(keySchema);
  const parser = _issue(propertyNames.ast);
  return makeFilter2((input, ast, options) => {
    const keys3 = Reflect.ownKeys(input);
    const issues = [];
    for (const key of keys3) {
      const issue = parser(key, options);
      if (issue !== undefined) {
        issues.push(new Pointer([key], issue));
        if (options.errors === "first")
          break;
      }
    }
    if (isArrayNonEmpty2(issues)) {
      return new Composite(ast, issues, input, options);
    }
    return true;
  }, {
    expected: "an object with property names matching the schema",
    representation: {
      id: "effect/schema/isPropertyNames",
      payload: null,
      schemas: [propertyNames.ast]
    },
    toJsonSchema: ({
      schemas
    }) => ({
      propertyNames: schemas[0]
    }),
    toCode: ({
      schemas
    }) => ({
      runtime: `Schema.isPropertyNames(${schemas[0].runtime})`
    }),
    [STRUCTURAL_ANNOTATION_KEY]: true,
    ...annotations
  });
}
var isPropertyNamesReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isPropertyNames", Null2, ({
  annotations,
  schemas
}) => isPropertyNames(schemas[0], annotations));
function isUnique(annotations) {
  return makeFilter2((input) => dedupe(input).length === input.length, {
    expected: "an array with unique items",
    representation: {
      id: "effect/schema/isUnique",
      payload: null
    },
    toJsonSchema: () => ({
      uniqueItems: true
    }),
    toCode: () => ({
      runtime: "Schema.isUnique()"
    }),
    arbitrary: {
      constraint: {
        unique: true
      }
    },
    ...annotations
  });
}
var isUniqueReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isUnique", Null2, ({
  annotations
}) => isUnique(annotations));
var NonEmptyString = /* @__PURE__ */ String5.check(/* @__PURE__ */ isNonEmpty());
var Char = /* @__PURE__ */ String5.check(/* @__PURE__ */ isLengthBetween(1, 1));
function Option(value3) {
  const schema = declareConstructor()([value3], ([value4]) => (input, ast, options) => {
    if (isOption2(input)) {
      if (isNone2(input)) {
        return succeedNone2;
      }
      return mapBothEager2(decodeUnknownEffect(value4)(input.value, options), {
        onSuccess: some2,
        onFailure: (issue) => makeCompositeAtKey(ast, "value", issue, input, options)
      });
    }
    return fail5(new InvalidType(ast, input, options));
  }, {
    representation: {
      id: "effect/schema/Option",
      payload: null
    },
    toCode: ({
      typeParameters
    }) => ({
      runtime: `Schema.Option(${typeParameters[0].runtime})`,
      Type: `Option.Option<${typeParameters[0].Type}>`,
      importDeclarations: [`import * as Option from "effect/Option"`]
    }),
    expected: "Option",
    toCodec: ([value4]) => link()(Union2([Struct({
      _tag: Literal2("Some"),
      value: value4
    }), Struct({
      _tag: Literal2("None")
    })]), transform2({
      decode: (e) => e._tag === "None" ? none2() : some2(e.value),
      encode: (o) => isSome2(o) ? {
        _tag: "Some",
        value: o.value
      } : {
        _tag: "None"
      }
    })),
    toArbitrary: ([value4]) => (fc, ctx) => {
      const terminal = fc.constant(none2());
      const arbitrary = fc.oneof(terminal, value4.arbitrary.map(some2));
      return withRecursion(fc, ctx, terminal, arbitrary);
    },
    toEquivalence: ([value4]) => makeEquivalence(value4),
    toFormatter: ([value4]) => match({
      onNone: () => "none()",
      onSome: (t) => `some(${value4(t)})`
    })
  });
  return make18(schema.ast, {
    value: value3
  });
}
var OptionReviver = /* @__PURE__ */ makeDeclarationReviver("effect/schema/Option", Null2, ({
  annotations,
  typeParameters
}) => {
  const schema = Option(typeParameters[0]);
  return annotations === undefined ? schema : schema.annotate(annotations);
});
function OptionFromNullOr(schema) {
  return NullOr(schema).pipe(decodeTo2(Option(toType2(schema)), optionFromNullOr()));
}
function OptionFromUndefinedOr(schema) {
  return UndefinedOr(schema).pipe(decodeTo2(Option(toType2(schema)), optionFromUndefinedOr()));
}
function OptionFromNullishOr(schema, options) {
  return NullishOr(schema).pipe(decodeTo2(Option(toType2(schema)), optionFromNullishOr(options)));
}
function OptionFromOptionalKey(schema) {
  return optionalKey2(schema).pipe(decodeTo2(Option(toType2(schema)), optionFromOptionalKey()));
}
function OptionFromOptional(schema) {
  return optional2(schema).pipe(decodeTo2(Option(toType2(schema)), optionFromOptional()));
}
function OptionFromOptionalNullOr(schema, options) {
  const onNoneEncoding = options === undefined ? "omit" : options.onNoneEncoding;
  const noneValue = onNoneEncoding === null ? null : undefined;
  return optional2(NullOr(schema)).pipe(decodeTo2(Option(toType2(schema)), transformOptional2({
    decode: (oe) => oe.pipe(filter(isNotNullish), some2),
    encode: onNoneEncoding === "omit" ? flatten : (ot) => some2(getOrElse(flatten(ot), () => noneValue))
  })));
}
function Result(success, failure) {
  const schema = declareConstructor()([success, failure], ([success2, failure2]) => (input, ast, options) => {
    if (!isResult2(input)) {
      return fail5(new InvalidType(ast, input, options));
    }
    switch (input._tag) {
      case "Success":
        return mapBothEager2(decodeEffect(success2)(input.success, options), {
          onSuccess: succeed2,
          onFailure: (issue) => makeCompositeAtKey(ast, "success", issue, input, options)
        });
      case "Failure":
        return mapBothEager2(decodeEffect(failure2)(input.failure, options), {
          onSuccess: fail2,
          onFailure: (issue) => makeCompositeAtKey(ast, "failure", issue, input, options)
        });
    }
  }, {
    representation: {
      id: "effect/schema/Result",
      payload: null
    },
    toCode: ({
      typeParameters
    }) => ({
      runtime: `Schema.Result(${typeParameters[0].runtime}, ${typeParameters[1].runtime})`,
      Type: `Result.Result<${typeParameters[0].Type}, ${typeParameters[1].Type}>`,
      importDeclarations: [`import * as Result from "effect/Result"`]
    }),
    expected: "Result",
    toCodec: ([success2, failure2]) => link()(Union2([Struct({
      _tag: Literal2("Success"),
      success: success2
    }), Struct({
      _tag: Literal2("Failure"),
      failure: failure2
    })]), transform2({
      decode: (e) => e._tag === "Success" ? succeed2(e.success) : fail2(e.failure),
      encode: (r) => isSuccess2(r) ? {
        _tag: "Success",
        success: r.success
      } : {
        _tag: "Failure",
        failure: r.failure
      }
    })),
    toArbitrary: ([success2, failure2]) => (fc, ctx) => {
      const terminal = oneOfArbitraries(fc, success2.terminal?.map((a) => succeed2(a)), failure2.terminal?.map((e) => fail2(e)));
      const arbitrary = fc.oneof(success2.arbitrary.map((a) => succeed2(a)), failure2.arbitrary.map((e) => fail2(e)));
      return withRecursion(fc, ctx, terminal, arbitrary);
    },
    toEquivalence: ([success2, failure2]) => makeEquivalence2(success2, failure2),
    toFormatter: ([success2, failure2]) => match3({
      onSuccess: (t) => `success(${success2(t)})`,
      onFailure: (t) => `failure(${failure2(t)})`
    })
  });
  return make18(schema.ast, {
    success,
    failure
  });
}
var ResultReviver = /* @__PURE__ */ makeDeclarationReviver("effect/schema/Result", Null2, ({
  annotations,
  typeParameters
}) => {
  const schema = Result(typeParameters[0], typeParameters[1]);
  return annotations === undefined ? schema : schema.annotate(annotations);
});
var RedactedOptionsPayload = /* @__PURE__ */ declare((input) => {
  if (!isObject(input)) {
    return false;
  }
  const keys3 = globalThis.Object.keys(input);
  return keys3.length > 0 && keys3.every((key) => {
    switch (key) {
      case "label":
        return typeof input[key] === "string";
      case "disallowJsonEncode":
        return input[key] === true;
      default:
        return false;
    }
  });
});
var RedactedRepresentationPayload = /* @__PURE__ */ Union2([Null2, RedactedOptionsPayload]);
function Redacted(value3, options) {
  const label = typeof options?.label === "string" ? options.label : undefined;
  const disallowJsonEncode = options?.disallowJsonEncode === true;
  const normalizedOptions = label !== undefined ? disallowJsonEncode ? {
    label,
    disallowJsonEncode: true
  } : {
    label
  } : disallowJsonEncode ? {
    disallowJsonEncode: true
  } : undefined;
  const decodeLabel = label !== undefined ? decodeUnknownEffect(Literal2(label)) : undefined;
  const schema = declareConstructor()([value3], ([value4]) => (input, ast, poptions) => {
    if (isRedacted(input)) {
      const label2 = decodeLabel !== undefined ? mapErrorEager2(decodeLabel(input.label, poptions), (issue) => new Pointer(["label"], issue)) : void_3;
      return flatMapEager2(label2, () => mapBothEager2(decodeUnknownEffect(value4)(value2(input), poptions), {
        onSuccess: () => input,
        onFailure: () => {
          return new Composite(ast, [new Pointer(["value"], new InvalidValue(undefined, input, poptions))], input, poptions);
        }
      }));
    }
    return fail5(new InvalidType(ast, input, poptions));
  }, {
    representation: {
      id: "effect/schema/Redacted",
      payload: normalizedOptions ?? null
    },
    toCode: ({
      typeParameters
    }) => ({
      runtime: normalizedOptions !== undefined ? `Schema.Redacted(${typeParameters[0].runtime}, ${format(normalizedOptions)})` : `Schema.Redacted(${typeParameters[0].runtime})`,
      Type: `Redacted.Redacted<${typeParameters[0].Type}>`,
      importDeclarations: [`import * as Redacted from "effect/Redacted"`]
    }),
    expected: "Redacted",
    toCodecJson: ([value4]) => link()(value4, {
      decode: transform((e) => make9(e, {
        label
      })),
      encode: disallowJsonEncode ? forbidden((oe) => "Cannot serialize Redacted" + (isSome2(oe) && typeof oe.value.label === "string" ? ` with label: "${oe.value.label}"` : "")) : transform(value2)
    }),
    toArbitrary: ([value4]) => () => ({
      arbitrary: value4.arbitrary.map((a) => make9(a, {
        label
      })),
      terminal: value4.terminal?.map((a) => make9(a, {
        label
      }))
    }),
    toFormatter: () => globalThis.String,
    toEquivalence: ([value4]) => makeEquivalence3(value4)
  });
  return make18(schema.ast, {
    value: value3
  });
}
var RedactedReviver = /* @__PURE__ */ makeDeclarationReviver("effect/schema/Redacted", RedactedRepresentationPayload, ({
  annotations,
  payload,
  typeParameters
}) => {
  const schema = Redacted(typeParameters[0], payload ?? undefined);
  return annotations === undefined ? schema : schema.annotate(annotations);
});
function RedactedFromValue(value3, options) {
  return decodeTo2(Redacted(toType2(value3), {
    label: options?.label,
    disallowJsonEncode: options?.disallowEncode
  }), {
    decode: transform((t) => make9(t, {
      label: options?.label
    })),
    encode: options?.disallowEncode ? forbidden((oe) => "Cannot encode Redacted" + (isSome2(oe) && typeof oe.value.label === "string" ? ` with label: "${oe.value.label}"` : "")) : transform(value2)
  })(value3);
}
function CauseReason(error, defect) {
  const schema = declareConstructor()([error, defect], ([error2, defect2]) => (input, ast, options) => {
    if (!isReason(input)) {
      return fail5(new InvalidType(ast, input, options));
    }
    switch (input._tag) {
      case "Fail":
        return mapBothEager2(decodeUnknownEffect(error2)(input.error, options), {
          onSuccess: makeFailReason,
          onFailure: (issue) => makeCompositeAtKey(ast, "error", issue, input, options)
        });
      case "Die":
        return mapBothEager2(decodeUnknownEffect(defect2)(input.defect, options), {
          onSuccess: makeDieReason,
          onFailure: (issue) => makeCompositeAtKey(ast, "defect", issue, input, options)
        });
      case "Interrupt":
        return succeed6(input);
    }
  }, {
    representation: {
      id: "effect/schema/CauseReason",
      payload: null
    },
    toCode: ({
      typeParameters
    }) => ({
      runtime: `Schema.CauseReason(${typeParameters[0].runtime}, ${typeParameters[1].runtime})`,
      Type: `Cause.Failure<${typeParameters[0].Type}, ${typeParameters[1].Type}>`,
      importDeclarations: [`import * as Cause from "effect/Cause"`]
    }),
    expected: "Cause.Failure",
    toCodec: ([error2, defect2]) => link()(Union2([Struct({
      _tag: Literal2("Fail"),
      error: error2
    }), Struct({
      _tag: Literal2("Die"),
      defect: defect2
    }), Struct({
      _tag: Literal2("Interrupt"),
      fiberId: UndefinedOr(Finite)
    })]), transform2({
      decode: (e) => {
        switch (e._tag) {
          case "Fail":
            return makeFailReason(e.error);
          case "Die":
            return makeDieReason(e.defect);
          case "Interrupt":
            return makeInterruptReason2(e.fiberId);
        }
      },
      encode: identity
    })),
    toArbitrary: ([error2, defect2]) => causeReasonToArbitrary(error2, defect2),
    toEquivalence: ([error2, defect2]) => causeReasonToEquivalence(error2, defect2),
    toFormatter: ([error2, defect2]) => causeReasonToFormatter(error2, defect2)
  });
  return make18(schema.ast, {
    error,
    defect
  });
}
var CauseReasonReviver = /* @__PURE__ */ makeDeclarationReviver("effect/schema/CauseReason", Null2, ({
  annotations,
  typeParameters
}) => {
  const schema = CauseReason(typeParameters[0], typeParameters[1]);
  return annotations === undefined ? schema : schema.annotate(annotations);
});
function causeReasonToArbitrary(error, defect) {
  return (fc, ctx) => {
    const terminal = fc.constant(makeInterruptReason2());
    const arbitrary = fc.oneof(terminal, fc.integer({
      min: 1
    }).map(makeInterruptReason2), error.arbitrary.map((e) => makeFailReason(e)), defect.arbitrary.map((d) => makeDieReason(d)));
    return withRecursion(fc, ctx, terminal, arbitrary);
  };
}
function causeReasonToEquivalence(error, defect) {
  return (a, b) => {
    if (a._tag !== b._tag)
      return false;
    switch (a._tag) {
      case "Fail":
        return error(a.error, b.error);
      case "Die":
        return defect(a.defect, b.defect);
      case "Interrupt":
        return a.fiberId === b.fiberId;
    }
  };
}
function causeReasonToFormatter(error, defect) {
  return (t) => {
    switch (t._tag) {
      case "Fail":
        return `Fail(${error(t.error)})`;
      case "Die":
        return `Die(${defect(t.defect)})`;
      case "Interrupt":
        return "Interrupt";
    }
  };
}
function Cause(error, defect) {
  const schema = declareConstructor()([error, defect], ([error2, defect2]) => {
    const failures = ArraySchema(CauseReason(error2, defect2));
    return (input, ast, options) => {
      if (!isCause2(input)) {
        return fail5(new InvalidType(ast, input, options));
      }
      return mapBothEager2(decodeUnknownEffect(failures)(input.reasons, options), {
        onSuccess: fromReasons,
        onFailure: (issue) => makeCompositeAtKey(ast, "failures", issue, input, options)
      });
    };
  }, {
    representation: {
      id: "effect/schema/Cause",
      payload: null
    },
    toCode: ({
      typeParameters
    }) => ({
      runtime: `Schema.Cause(${typeParameters[0].runtime}, ${typeParameters[1].runtime})`,
      Type: `Cause.Cause<${typeParameters[0].Type}, ${typeParameters[1].Type}>`,
      importDeclarations: [`import * as Cause from "effect/Cause"`]
    }),
    expected: "Cause",
    toCodec: ([error2, defect2]) => link()(ArraySchema(CauseReason(error2, defect2)), transform2({
      decode: fromReasons,
      encode: ({
        reasons: failures
      }) => failures
    })),
    toArbitrary: ([error2, defect2]) => causeToArbitrary(error2, defect2),
    toEquivalence: ([error2, defect2]) => causeToEquivalence(error2, defect2),
    toFormatter: ([error2, defect2]) => causeToFormatter(error2, defect2)
  });
  return make18(schema.ast, {
    error,
    defect
  });
}
var CauseReviver = /* @__PURE__ */ makeDeclarationReviver("effect/schema/Cause", Null2, ({
  annotations,
  typeParameters
}) => {
  const schema = Cause(typeParameters[0], typeParameters[1]);
  return annotations === undefined ? schema : schema.annotate(annotations);
});
function causeToArbitrary(error, defect) {
  return (fc, ctx) => {
    const reason = causeReasonToArbitrary(error, defect)(fc, ctx);
    const terminal = fc.constant(empty3);
    const arbitrary = fc.array(reason.arbitrary).map(fromReasons);
    return withRecursion(fc, ctx, terminal, arbitrary);
  };
}
function causeToEquivalence(error, defect) {
  const failures = Array_(causeReasonToEquivalence(error, defect));
  return (a, b) => failures(a.reasons, b.reasons);
}
function causeToFormatter(error, defect) {
  const causeReason = causeReasonToFormatter(error, defect);
  return (t) => `Cause([${t.reasons.map(causeReason).join(", ")}])`;
}
var ErrorOptionsPayload = /* @__PURE__ */ declare((input) => {
  if (!isObject(input)) {
    return false;
  }
  const keys3 = globalThis.Object.keys(input);
  return keys3.length > 0 && keys3.every((key) => (key === "includeStack" || key === "excludeCause") && input[key] === true);
});
var ErrorRepresentationPayload = /* @__PURE__ */ Union2([Null2, ErrorOptionsPayload]);
var getErrorOptionsKey = (options) => (options?.includeStack === true ? 1 : 0) | (options?.excludeCause === true ? 2 : 0);
var getErrorOptions = (key) => {
  switch (key) {
    case 0:
      return;
    case 1:
      return {
        includeStack: true
      };
    case 2:
      return {
        excludeCause: true
      };
    case 3:
      return {
        includeStack: true,
        excludeCause: true
      };
  }
};
var errorSchemaCache = [];
function ErrorInstance(options) {
  const key = getErrorOptionsKey(options);
  const cached3 = errorSchemaCache[key];
  if (cached3 !== undefined) {
    return cached3;
  }
  const normalizedOptions = getErrorOptions(key);
  const schema = instanceOf(globalThis.Error, {
    representation: {
      id: "effect/schema/Error",
      payload: normalizedOptions ?? null
    },
    toCode: () => ({
      runtime: normalizedOptions !== undefined ? `Schema.ErrorInstance(${format(normalizedOptions)})` : `Schema.ErrorInstance()`,
      Type: `globalThis.Error`
    }),
    expected: "Error",
    toCodecJson: () => link()(JsonError, errorFromJsonError(normalizedOptions)),
    toArbitrary: () => (fc) => fc.string().map((message) => new globalThis.Error(message))
  });
  errorSchemaCache[key] = schema;
  return schema;
}
var ErrorInstanceReviver = /* @__PURE__ */ makeDeclarationReviver("effect/schema/Error", ErrorRepresentationPayload, ({
  annotations,
  payload
}) => {
  const schema = ErrorInstance(payload ?? undefined);
  return annotations === undefined ? schema : schema.annotate(annotations);
});
var defectSchemaCache = [];
function Defect(options) {
  const key = getErrorOptionsKey(options);
  const cached3 = defectSchemaCache[key];
  if (cached3 !== undefined) {
    return cached3;
  }
  const schema = Json2.pipe(decodeTo2(Unknown2, defectFromJson(getErrorOptions(key))));
  defectSchemaCache[key] = schema;
  return schema;
}
function Exit(value3, error, defect) {
  const schema = declareConstructor()([value3, error, defect], ([value4, error2, defect2]) => {
    const cause = Cause(error2, defect2);
    return (input, ast, options) => {
      if (!isExit2(input)) {
        return fail5(new InvalidType(ast, input, options));
      }
      switch (input._tag) {
        case "Success":
          return mapBothEager2(decodeUnknownEffect(value4)(input.value, options), {
            onSuccess: succeed4,
            onFailure: (issue) => makeCompositeAtKey(ast, "value", issue, input, options)
          });
        case "Failure":
          return mapBothEager2(decodeUnknownEffect(cause)(input.cause, options), {
            onSuccess: failCause2,
            onFailure: (issue) => makeCompositeAtKey(ast, "cause", issue, input, options)
          });
      }
    };
  }, {
    representation: {
      id: "effect/schema/Exit",
      payload: null
    },
    toCode: ({
      typeParameters
    }) => ({
      runtime: `Schema.Exit(${typeParameters[0].runtime}, ${typeParameters[1].runtime}, ${typeParameters[2].runtime})`,
      Type: `Exit.Exit<${typeParameters[0].Type}, ${typeParameters[1].Type}, ${typeParameters[2].Type}>`,
      importDeclarations: [`import * as Exit from "effect/Exit"`]
    }),
    expected: "Exit",
    toCodec: ([value4, error2, defect2]) => link()(Union2([Struct({
      _tag: Literal2("Success"),
      value: value4
    }), Struct({
      _tag: Literal2("Failure"),
      cause: Cause(error2, defect2)
    })]), transform2({
      decode: (e) => e._tag === "Success" ? succeed4(e.value) : failCause2(e.cause),
      encode: (exit3) => isSuccess4(exit3) ? {
        _tag: "Success",
        value: exit3.value
      } : {
        _tag: "Failure",
        cause: exit3.cause
      }
    })),
    toArbitrary: ([value4, error2, defect2]) => (fc, ctx) => {
      const cause = causeToArbitrary(error2, defect2)(fc, ctx);
      const terminal = oneOfArbitraries(fc, value4.terminal?.map((v) => succeed4(v)), cause.terminal?.map((cause2) => failCause2(cause2)));
      const arbitrary = fc.oneof(value4.arbitrary.map((v) => succeed4(v)), cause.arbitrary.map((cause2) => failCause2(cause2)));
      return withRecursion(fc, ctx, terminal, arbitrary);
    },
    toEquivalence: ([value4, error2, defect2]) => {
      const cause = causeToEquivalence(error2, defect2);
      return (a, b) => {
        if (a._tag !== b._tag)
          return false;
        switch (a._tag) {
          case "Success":
            return value4(a.value, b.value);
          case "Failure":
            return cause(a.cause, b.cause);
        }
      };
    },
    toFormatter: ([value4, error2, defect2]) => {
      const cause = causeToFormatter(error2, defect2);
      return (t) => {
        switch (t._tag) {
          case "Success":
            return `Exit.Success(${value4(t.value)})`;
          case "Failure":
            return `Exit.Failure(${cause(t.cause)})`;
        }
      };
    }
  });
  return make18(schema.ast, {
    value: value3,
    error,
    defect
  });
}
var ExitReviver = /* @__PURE__ */ makeDeclarationReviver("effect/schema/Exit", Null2, ({
  annotations,
  typeParameters
}) => {
  const schema = Exit(typeParameters[0], typeParameters[1], typeParameters[2]);
  return annotations === undefined ? schema : schema.annotate(annotations);
});
function oneOfArbitraries(fc, a, b) {
  return a === undefined ? b : b === undefined ? a : fc.oneof(a, b);
}
function withRecursion(fc, ctx, terminal, arbitrary) {
  return {
    arbitrary: terminal === undefined || ctx.recursion === undefined ? arbitrary : fc.oneof(ctx.recursion, terminal, arbitrary),
    terminal
  };
}
function arrayFromItems(fc, item, constraints, comparator) {
  return comparator === undefined ? fc.array(item, constraints) : fc.uniqueArray(item, {
    ...constraints,
    comparator
  });
}
function collectionArbitrary(fc, ctx, item, terminalItem, fromIterable7, comparator) {
  const constraint = ctx.constraint;
  const constraints = constraint === undefined || constraint.minLength === undefined && constraint.maxLength === undefined ? undefined : {
    ...constraint.minLength !== undefined ? {
      minLength: constraint.minLength
    } : {},
    ...constraint.maxLength !== undefined ? {
      maxLength: constraint.maxLength
    } : {}
  };
  if (constraints?.minLength !== undefined && constraints.maxLength !== undefined && constraints.minLength > constraints.maxLength) {
    throw new globalThis.Error("Unable to derive an arbitrary for size constraints");
  }
  const minLength = constraints?.minLength ?? 0;
  const terminal = minLength === 0 ? fc.constant([]) : terminalItem === undefined ? undefined : arrayFromItems(fc, terminalItem, {
    ...constraints,
    maxLength: minLength
  }, comparator);
  const arrays = withRecursion(fc, ctx, terminal, arrayFromItems(fc, item, constraints, comparator));
  return {
    arbitrary: arrays.arbitrary.map(fromIterable7),
    terminal: arrays.terminal?.map(fromIterable7)
  };
}
function entriesArbitrary(fc, ctx, key, value3, fromIterable7) {
  return collectionArbitrary(fc, ctx, fc.tuple(key.arbitrary, value3.arbitrary), key.terminal === undefined || value3.terminal === undefined ? undefined : fc.tuple(key.terminal, value3.terminal), fromIterable7, ([a], [b]) => equals(a, b));
}
function ReadonlyMap(key, value3) {
  const schema = declareConstructor()([key, value3], ([key2, value4]) => {
    const array3 = ArraySchema(Tuple([key2, value4]));
    return (input, ast, options) => {
      if (input instanceof globalThis.Map) {
        return mapBothEager2(decodeUnknownEffect(array3)([...input], options), {
          onSuccess: (array4) => new globalThis.Map(array4),
          onFailure: (issue) => makeCompositeAtKey(ast, "entries", issue, input, options)
        });
      }
      return fail5(new InvalidType(ast, input, options));
    };
  }, {
    representation: {
      id: "effect/schema/ReadonlyMap",
      payload: null
    },
    toCode: ({
      typeParameters
    }) => ({
      runtime: `Schema.ReadonlyMap(${typeParameters[0].runtime}, ${typeParameters[1].runtime})`,
      Type: `globalThis.ReadonlyMap<${typeParameters[0].Type}, ${typeParameters[1].Type}>`
    }),
    expected: "ReadonlyMap",
    toCodec: ([key2, value4]) => link()(ArraySchema(Tuple([key2, value4])), transform2({
      decode: (e) => new globalThis.Map(e),
      encode: (map10) => [...map10.entries()]
    })),
    toArbitrary: ([key2, value4]) => (fc, ctx) => entriesArbitrary(fc, ctx, key2, value4, (as3) => new globalThis.Map(as3)),
    toEquivalence: ([key2, value4]) => makeCompareMap(key2, value4),
    toFormatter: ([key2, value4]) => (t) => {
      const size6 = t.size;
      if (size6 === 0) {
        return "ReadonlyMap(0) {}";
      }
      const entries3 = globalThis.Array.from(t.entries()).sort().map(([k, v]) => `${key2(k)} => ${value4(v)}`);
      return `ReadonlyMap(${size6}) { ${entries3.join(", ")} }`;
    }
  });
  return make18(schema.ast, {
    key,
    value: value3
  });
}
var ReadonlyMapReviver = /* @__PURE__ */ makeDeclarationReviver("effect/schema/ReadonlyMap", Null2, ({
  annotations,
  typeParameters
}) => {
  const schema = ReadonlyMap(typeParameters[0], typeParameters[1]);
  return annotations === undefined ? schema : schema.annotate(annotations);
});
function HashMap(key, value3) {
  const schema = declareConstructor()([key, value3], ([key2, value4]) => {
    const entries3 = ArraySchema(Tuple([key2, value4]));
    return (input, ast, options) => {
      if (isHashMap2(input)) {
        return mapBothEager2(decodeUnknownEffect(entries3)(toEntries(input), options), {
          onSuccess: fromIterable4,
          onFailure: (issue) => makeCompositeAtKey(ast, "entries", issue, input, options)
        });
      }
      return fail5(new InvalidType(ast, input, options));
    };
  }, {
    representation: {
      id: "effect/schema/HashMap",
      payload: null
    },
    toCode: ({
      typeParameters
    }) => ({
      runtime: `Schema.HashMap(${typeParameters[0].runtime}, ${typeParameters[1].runtime})`,
      Type: `HashMap.HashMap<${typeParameters[0].Type}, ${typeParameters[1].Type}>`,
      importDeclarations: [`import * as HashMap from "effect/HashMap"`]
    }),
    expected: "HashMap",
    toCodec: ([key2, value4]) => link()(ArraySchema(Tuple([key2, value4])), transform2({
      decode: fromIterable4,
      encode: toEntries
    })),
    toArbitrary: ([key2, value4]) => (fc, ctx) => entriesArbitrary(fc, ctx, key2, value4, fromIterable4),
    toEquivalence: ([key2, value4]) => makeCompareMap(key2, value4),
    toFormatter: ([key2, value4]) => (t) => {
      const size6 = size3(t);
      if (size6 === 0) {
        return "HashMap(0) {}";
      }
      const entries3 = toEntries(t).sort().map(([k, v]) => `${key2(k)} => ${value4(v)}`);
      return `HashMap(${size6}) { ${entries3.join(", ")} }`;
    }
  });
  return make18(schema.ast, {
    key,
    value: value3
  });
}
var HashMapReviver = /* @__PURE__ */ makeDeclarationReviver("effect/schema/HashMap", Null2, ({
  annotations,
  typeParameters
}) => {
  const schema = HashMap(typeParameters[0], typeParameters[1]);
  return annotations === undefined ? schema : schema.annotate(annotations);
});
function ReadonlySet(value3) {
  const schema = declareConstructor()([value3], ([value4]) => {
    const array3 = ArraySchema(value4);
    return (input, ast, options) => {
      if (input instanceof globalThis.Set) {
        return mapBothEager2(decodeUnknownEffect(array3)([...input], options), {
          onSuccess: (array4) => new globalThis.Set(array4),
          onFailure: (issue) => makeCompositeAtKey(ast, "values", issue, input, options)
        });
      }
      return fail5(new InvalidType(ast, input, options));
    };
  }, {
    representation: {
      id: "effect/schema/ReadonlySet",
      payload: null
    },
    toCode: ({
      typeParameters
    }) => ({
      runtime: `Schema.ReadonlySet(${typeParameters[0].runtime})`,
      Type: `globalThis.ReadonlySet<${typeParameters[0].Type}>`
    }),
    expected: "ReadonlySet",
    toCodec: ([value4]) => link()(ArraySchema(value4), transform2({
      decode: (e) => new globalThis.Set(e),
      encode: (set2) => [...set2.values()]
    })),
    toArbitrary: ([value4]) => (fc, ctx) => collectionArbitrary(fc, ctx, value4.arbitrary, value4.terminal, (as3) => new globalThis.Set(as3), equals),
    toEquivalence: ([value4]) => makeCompareSet(value4),
    toFormatter: ([value4]) => (t) => {
      const size6 = t.size;
      if (size6 === 0) {
        return "ReadonlySet(0) {}";
      }
      const values2 = globalThis.Array.from(t.values()).sort().map((v) => `${value4(v)}`);
      return `ReadonlySet(${size6}) { ${values2.join(", ")} }`;
    }
  });
  return make18(schema.ast, {
    value: value3
  });
}
var ReadonlySetReviver = /* @__PURE__ */ makeDeclarationReviver("effect/schema/ReadonlySet", Null2, ({
  annotations,
  typeParameters
}) => {
  const schema = ReadonlySet(typeParameters[0]);
  return annotations === undefined ? schema : schema.annotate(annotations);
});
function HashSet(value3) {
  const schema = declareConstructor()([value3], ([value4]) => {
    const values2 = ArraySchema(value4);
    return (input, ast, options) => {
      if (isHashSet2(input)) {
        return mapBothEager2(decodeUnknownEffect(values2)(fromIterable(input), options), {
          onSuccess: fromIterable6,
          onFailure: (issue) => makeCompositeAtKey(ast, "values", issue, input, options)
        });
      }
      return fail5(new InvalidType(ast, input, options));
    };
  }, {
    representation: {
      id: "effect/schema/HashSet",
      payload: null
    },
    toCode: ({
      typeParameters
    }) => ({
      runtime: `Schema.HashSet(${typeParameters[0].runtime})`,
      Type: `HashSet.HashSet<${typeParameters[0].Type}>`
    }),
    expected: "HashSet",
    toCodec: ([value4]) => link()(ArraySchema(value4), transform2({
      decode: fromIterable6,
      encode: fromIterable
    })),
    toArbitrary: ([value4]) => (fc, ctx) => collectionArbitrary(fc, ctx, value4.arbitrary, value4.terminal, fromIterable6, equals),
    toEquivalence: ([value4]) => makeCompareSet(value4),
    toFormatter: ([value4]) => (t) => {
      const size6 = size5(t);
      if (size6 === 0) {
        return "HashSet(0) {}";
      }
      const values2 = globalThis.Array.from(t).sort().map((v) => `${value4(v)}`);
      return `HashSet(${size6}) { ${values2.join(", ")} }`;
    }
  });
  return make18(schema.ast, {
    value: value3
  });
}
var HashSetReviver = /* @__PURE__ */ makeDeclarationReviver("effect/schema/HashSet", Null2, ({
  annotations,
  typeParameters
}) => {
  const schema = HashSet(typeParameters[0]);
  return annotations === undefined ? schema : schema.annotate(annotations);
});
function Chunk(value3) {
  const schema = declareConstructor()([value3], ([value4]) => {
    const values2 = ArraySchema(value4);
    return (input, ast, options) => {
      if (isChunk(input)) {
        return mapBothEager2(decodeUnknownEffect(values2)(fromIterable(input), options), {
          onSuccess: fromIterable2,
          onFailure: (issue) => makeCompositeAtKey(ast, "values", issue, input, options)
        });
      }
      return fail5(new InvalidType(ast, input, options));
    };
  }, {
    representation: {
      id: "effect/schema/Chunk",
      payload: null
    },
    toCode: ({
      typeParameters
    }) => ({
      runtime: `Schema.Chunk(${typeParameters[0].runtime})`,
      Type: `Chunk.Chunk<${typeParameters[0].Type}>`
    }),
    expected: "Chunk",
    toCodec: ([value4]) => link()(ArraySchema(value4), transform2({
      decode: fromIterable2,
      encode: fromIterable
    })),
    toArbitrary: ([value4]) => (fc, ctx) => collectionArbitrary(fc, ctx, value4.arbitrary, value4.terminal, fromIterable2),
    toEquivalence: ([value4]) => makeEquivalence4(value4),
    toFormatter: ([value4]) => (t) => {
      const size6 = size(t);
      if (size6 === 0) {
        return "Chunk(0) {}";
      }
      const values2 = globalThis.Array.from(t).sort().map((v) => `${value4(v)}`);
      return `Chunk(${size6}) { ${values2.join(", ")} }`;
    }
  });
  return make18(schema.ast, {
    value: value3
  });
}
var ChunkReviver = /* @__PURE__ */ makeDeclarationReviver("effect/schema/Chunk", Null2, ({
  annotations,
  typeParameters
}) => {
  const schema = Chunk(typeParameters[0]);
  return annotations === undefined ? schema : schema.annotate(annotations);
});
var RegExp3 = /* @__PURE__ */ instanceOf(globalThis.RegExp, {
  representation: {
    id: "effect/schema/RegExp",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.RegExp`,
    Type: `globalThis.RegExp`
  }),
  expected: "RegExp",
  toCodecJson: () => link()(Struct({
    source: String5,
    flags: String5
  }), transformOrFail2({
    decode: (e, options) => try_3({
      try: () => new globalThis.RegExp(e.source, e.flags),
      catch: () => new InvalidValue({
        expected: "valid RegExp source and flags"
      }, e, options)
    }),
    encode: (regExp) => succeed6({
      source: regExp.source,
      flags: regExp.flags
    })
  })),
  toArbitrary: () => (fc) => fc.tuple(fc.constantFrom(".", ".*", "\\d+", "\\w+", "[a-z]+", "[A-Z]+", "[0-9]+", "^[a-zA-Z0-9]+$", "^\\d{4}-\\d{2}-\\d{2}$"), fc.uniqueArray(fc.constantFrom("g", "i", "m", "s", "u", "y"), {
    minLength: 0,
    maxLength: 6
  }).map((flags) => flags.join(""))).map(([source, flags]) => new globalThis.RegExp(source, flags)),
  toEquivalence: () => (a, b) => a.source === b.source && a.flags === b.flags
});
var RegExpReviver = /* @__PURE__ */ makeFixedDeclarationReviver("effect/schema/RegExp", RegExp3);
var URLString = /* @__PURE__ */ String5.annotate({
  expected: "a string that will be decoded as a URL"
});
var URL2 = /* @__PURE__ */ instanceOf(globalThis.URL, {
  representation: {
    id: "effect/schema/URL",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.URL`,
    Type: `globalThis.URL`
  }),
  expected: "URL",
  toCodecJson: () => link()(URLString, urlFromString),
  toArbitrary: () => (fc) => fc.webUrl().map((s) => new globalThis.URL(s)),
  toEquivalence: () => (a, b) => a.toString() === b.toString()
});
var URLReviver = /* @__PURE__ */ makeFixedDeclarationReviver("effect/schema/URL", URL2);
var URLFromString = /* @__PURE__ */ URLString.pipe(/* @__PURE__ */ decodeTo2(URL2, urlFromString));
function dateArbitraryConstraints(ordered, base2, toDate2) {
  const out = {
    ...base2
  };
  if (ordered?.minimum !== undefined) {
    const minimum = toDate2 === undefined ? ordered.minimum : toDate2(ordered.minimum);
    const nextMin = ordered.exclusiveMinimum ? new globalThis.Date(minimum.getTime() + 1) : minimum;
    if (out.min === undefined || nextMin.getTime() > out.min.getTime()) {
      out.min = nextMin;
    }
  }
  if (ordered?.maximum !== undefined) {
    const maximum = toDate2 === undefined ? ordered.maximum : toDate2(ordered.maximum);
    const nextMax = ordered.exclusiveMaximum ? new globalThis.Date(maximum.getTime() - 1) : maximum;
    if (out.max === undefined || nextMax.getTime() < out.max.getTime()) {
      out.max = nextMax;
    }
  }
  return out;
}
var DateString = /* @__PURE__ */ String5.annotate({
  expected: "a string that will be decoded as a Date"
});
var Date4 = /* @__PURE__ */ declare((input) => input instanceof globalThis.Date && !globalThis.Number.isNaN(input.getTime()), {
  representation: {
    id: "effect/schema/Date",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.Date`,
    Type: `globalThis.Date`
  }),
  expected: "a valid Date",
  toCodecJson: () => link()(DateString, dateFromString),
  toArbitrary: () => (fc, ctx) => fc.date(dateArbitraryConstraints(ctx?.constraint?.ordered?.order === Date2 ? ctx.constraint.ordered : undefined, {
    noInvalidDate: true
  }))
});
var DateReviver = /* @__PURE__ */ makeFixedDeclarationReviver("effect/schema/Date", Date4);
var DateFromString = /* @__PURE__ */ DateString.pipe(/* @__PURE__ */ decodeTo2(Date4, dateFromString));
var DateFromMillis = /* @__PURE__ */ Int.pipe(/* @__PURE__ */ decodeTo2(Date4, dateFromMillis));
var Duration = /* @__PURE__ */ declare(isDuration, {
  representation: {
    id: "effect/schema/Duration",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.Duration`,
    Type: `Duration.Duration`,
    importDeclarations: [`import * as Duration from "effect/Duration"`]
  }),
  expected: "Duration",
  toCodecJson: () => link()(Union2([Struct({
    _tag: Literal2("Infinity")
  }), Struct({
    _tag: Literal2("NegativeInfinity")
  }), Struct({
    _tag: Literal2("Nanos"),
    value: BigInt5
  }), Struct({
    _tag: Literal2("Millis"),
    value: Int
  })]), transform2({
    decode: (e) => {
      switch (e._tag) {
        case "Infinity":
          return infinity;
        case "NegativeInfinity":
          return negativeInfinity;
        case "Nanos":
          return nanos(e.value);
        case "Millis":
          return millis(e.value);
      }
    },
    encode: (duration) => {
      switch (duration.value._tag) {
        case "Infinity":
          return {
            _tag: "Infinity"
          };
        case "NegativeInfinity":
          return {
            _tag: "NegativeInfinity"
          };
        case "Nanos":
          return {
            _tag: "Nanos",
            value: duration.value.nanos
          };
        case "Millis":
          return {
            _tag: "Millis",
            value: duration.value.millis
          };
      }
    }
  })),
  toArbitrary: () => (fc) => fc.oneof(fc.constant(infinity), fc.constant(negativeInfinity), fc.bigInt().map(nanos), fc.maxSafeInteger().map(millis)),
  toFormatter: () => globalThis.String,
  toEquivalence: () => Equivalence
});
var DurationReviver = /* @__PURE__ */ makeFixedDeclarationReviver("effect/schema/Duration", Duration);
var DurationString = /* @__PURE__ */ String5.annotate({
  expected: "a string that will be decoded as a Duration"
});
var DurationFromString = /* @__PURE__ */ DurationString.pipe(/* @__PURE__ */ decodeTo2(Duration, durationFromString));
var DurationFromNanos = /* @__PURE__ */ BigInt5.pipe(/* @__PURE__ */ decodeTo2(Duration, durationFromNanos));
var DurationFromMillis = /* @__PURE__ */ Number6.pipe(/* @__PURE__ */ decodeTo2(Duration, durationFromMillis));
var BigDecimalString = /* @__PURE__ */ String5.annotate({
  expected: "a string that will be decoded as a BigDecimal"
});
var bigDecimalDefaultMaxScale = 20;
var bigDecimalInvalidOrderedConstraintsError = "Unable to derive an arbitrary for the ordered BigDecimal constraints";
function bigDecimalScaleValueAtScale(bd, scale2) {
  return scale(bd, scale2).value;
}
function bigDecimalMinValueAtScale(minimum, scale2, excluded) {
  return excluded ? bigDecimalScaleValueAtScale(floor(minimum, scale2), scale2) + globalThis.BigInt(1) : bigDecimalScaleValueAtScale(ceil(minimum, scale2), scale2);
}
function bigDecimalMaxValueAtScale(maximum, scale2, excluded) {
  return excluded ? bigDecimalScaleValueAtScale(ceil(maximum, scale2), scale2) - globalThis.BigInt(1) : bigDecimalScaleValueAtScale(floor(maximum, scale2), scale2);
}
function bigDecimalMaxScale(ordered) {
  return Math.max(bigDecimalDefaultMaxScale, ordered.minimum?.scale ?? 0, ordered.maximum?.scale ?? 0, ordered.exclusiveMinimum && ordered.minimum !== undefined ? ordered.minimum.scale + 1 : 0, ordered.exclusiveMaximum && ordered.maximum !== undefined ? ordered.maximum.scale + 1 : 0);
}
function bigDecimalValueConstraintsAtScale(ordered, scale2) {
  const constraints = {};
  if (ordered.minimum !== undefined) {
    constraints.min = bigDecimalMinValueAtScale(ordered.minimum, scale2, ordered.exclusiveMinimum === true);
  }
  if (ordered.maximum !== undefined) {
    constraints.max = bigDecimalMaxValueAtScale(ordered.maximum, scale2, ordered.exclusiveMaximum === true);
  }
  if (constraints.min !== undefined && constraints.max !== undefined && constraints.min > constraints.max) {
    return;
  }
  return constraints;
}
function bigDecimalScaleConstraints(ordered) {
  const max5 = bigDecimalMaxScale(ordered);
  if (bigDecimalValueConstraintsAtScale(ordered, max5) === undefined) {
    throw new globalThis.Error(bigDecimalInvalidOrderedConstraintsError);
  }
  let min5 = 0;
  let high = max5;
  while (min5 < high) {
    const scale2 = min5 + Math.floor((high - min5) / 2);
    if (bigDecimalValueConstraintsAtScale(ordered, scale2) === undefined) {
      min5 = scale2 + 1;
    } else {
      high = scale2;
    }
  }
  return {
    min: min5,
    max: max5
  };
}
var BigDecimal = /* @__PURE__ */ declare(isBigDecimal, {
  representation: {
    id: "effect/schema/BigDecimal",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.BigDecimal`,
    Type: `BigDecimal.BigDecimal`,
    importDeclarations: [`import * as BigDecimal from "effect/BigDecimal"`]
  }),
  expected: "BigDecimal",
  toCodecJson: () => link()(BigDecimalString, bigDecimalFromString),
  toArbitrary: () => (fc, ctx) => {
    const ordered = ctx.constraint?.ordered?.order === Order2 ? ctx.constraint.ordered : undefined;
    if (ordered === undefined) {
      return fc.tuple(fc.bigInt(), fc.integer({
        min: 0,
        max: bigDecimalDefaultMaxScale
      })).map(([value3, scale2]) => make10(value3, scale2));
    }
    return fc.integer(bigDecimalScaleConstraints(ordered)).chain((scale2) => {
      const constraints = bigDecimalValueConstraintsAtScale(ordered, scale2);
      if (constraints === undefined) {
        throw new globalThis.Error(bigDecimalInvalidOrderedConstraintsError);
      }
      return fc.bigInt(constraints).map((value3) => make10(value3, scale2));
    });
  },
  toFormatter: () => (bd) => format2(bd),
  toEquivalence: () => Equivalence3
});
var BigDecimalReviver = /* @__PURE__ */ makeFixedDeclarationReviver("effect/schema/BigDecimal", BigDecimal);
var BigDecimalFromString = /* @__PURE__ */ BigDecimalString.pipe(/* @__PURE__ */ decodeTo2(BigDecimal, bigDecimalFromString));
var JsonString = /* @__PURE__ */ String5.annotate({
  expected: "a string that will be decoded as JSON",
  contentMediaType: "application/json"
});
function fromJsonString2(schema, options) {
  return JsonString.pipe(decodeTo2(schema, fromJsonString(options)));
}
var UnknownFromJsonString = /* @__PURE__ */ fromJsonString2(Unknown2);
var File = /* @__PURE__ */ instanceOf(globalThis.File, {
  representation: {
    id: "effect/schema/File",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.File`,
    Type: `globalThis.File`
  }),
  expected: "File",
  toCodecJson: () => link()(Struct({
    data: String5.check(isBase64()),
    type: String5,
    name: String5,
    lastModified: Int
  }), transformOrFail2({
    decode: (e, options) => match3(decodeBase64(e.data), {
      onFailure: () => fail5(new InvalidValue({
        expected: "a valid Base64 string"
      }, e.data, options)),
      onSuccess: (bytes) => {
        const buffer = new globalThis.Uint8Array(bytes);
        return succeed6(new globalThis.File([buffer], e.name, {
          type: e.type,
          lastModified: e.lastModified
        }));
      }
    }),
    encode: (file, options) => tryPromise2({
      try: async () => {
        const bytes = new globalThis.Uint8Array(await file.arrayBuffer());
        return {
          data: encodeBase64(bytes),
          type: file.type,
          name: file.name,
          lastModified: file.lastModified
        };
      },
      catch: () => new InvalidValue({
        expected: "a readable File"
      }, file, options)
    })
  }))
});
var FileReviver = /* @__PURE__ */ makeFixedDeclarationReviver("effect/schema/File", File);
var FormData2 = /* @__PURE__ */ instanceOf(globalThis.FormData, {
  representation: {
    id: "effect/schema/FormData",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.FormData`,
    Type: `globalThis.FormData`
  }),
  expected: "FormData",
  toCodecJson: () => link()(ArraySchema(Tuple([String5, Union2([Struct({
    _tag: tag("String"),
    value: String5
  }), Struct({
    _tag: tag("File"),
    value: File
  })])])), transformOrFail2({
    decode: (e) => {
      const out = new globalThis.FormData;
      for (const [key, entry] of e) {
        out.append(key, entry.value);
      }
      return succeed6(out);
    },
    encode: (formData) => {
      return succeed6(globalThis.Array.from(formData.entries()).map(([key, value3]) => {
        if (typeof value3 === "string") {
          return [key, {
            _tag: "String",
            value: value3
          }];
        } else {
          return [key, {
            _tag: "File",
            value: value3
          }];
        }
      }));
    }
  }))
});
var FormDataReviver = /* @__PURE__ */ makeFixedDeclarationReviver("effect/schema/FormData", FormData2);
function fromFormData2(schema) {
  return FormData2.pipe(decodeTo2(schema, fromFormData));
}
var URLSearchParams2 = /* @__PURE__ */ instanceOf(globalThis.URLSearchParams, {
  representation: {
    id: "effect/schema/URLSearchParams",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.URLSearchParams`,
    Type: `globalThis.URLSearchParams`
  }),
  expected: "URLSearchParams",
  toCodecJson: () => link()(String5.annotate({
    expected: "a query string that will be decoded as URLSearchParams"
  }), transform2({
    decode: (e) => new globalThis.URLSearchParams(e),
    encode: (params) => params.toString()
  }))
});
var URLSearchParamsReviver = /* @__PURE__ */ makeFixedDeclarationReviver("effect/schema/URLSearchParams", URLSearchParams2);
function fromURLSearchParams2(schema) {
  return URLSearchParams2.pipe(decodeTo2(schema, fromURLSearchParams));
}
var NumberFromString = /* @__PURE__ */ String5.annotate({
  expected: "a string that will be decoded as a number"
}).pipe(/* @__PURE__ */ decodeTo2(Number6, numberFromString));
var FiniteFromString = /* @__PURE__ */ String5.annotate({
  expected: "a string that will be decoded as a finite number"
}).pipe(/* @__PURE__ */ decodeTo2(Finite, numberFromString));
var BigIntFromString = /* @__PURE__ */ make18(bigIntString).pipe(/* @__PURE__ */ decodeTo2(BigInt5, bigintFromString));
var Trimmed = /* @__PURE__ */ String5.check(/* @__PURE__ */ isTrimmed());
var Trim = /* @__PURE__ */ String5.annotate({
  expected: "a string that will be decoded as a trimmed string"
}).pipe(/* @__PURE__ */ decodeTo2(Trimmed, /* @__PURE__ */ trim3()));
var StringFromBase64 = /* @__PURE__ */ String5.annotate({
  expected: "a base64 encoded string that will be decoded as a UTF-8 string"
}).pipe(/* @__PURE__ */ decodeTo2(String5, stringFromBase64String));
var StringFromBase64Url = /* @__PURE__ */ String5.annotate({
  expected: "a base64 (URL) encoded string that will be decoded as a UTF-8 string"
}).pipe(/* @__PURE__ */ decodeTo2(String5, stringFromBase64UrlString));
var StringFromHex = /* @__PURE__ */ String5.annotate({
  expected: "a hex encoded string that will be decoded as a UTF-8 string"
}).pipe(/* @__PURE__ */ decodeTo2(String5, stringFromHexString));
var StringFromUriComponent = /* @__PURE__ */ String5.annotate({
  expected: "a URI component encoded string that will be decoded as a UTF-8 string"
}).pipe(/* @__PURE__ */ decodeTo2(String5, stringFromUriComponent));
var PropertyKey = /* @__PURE__ */ Union2([Finite, Symbol3, String5]);
var StandardSchemaV1FailureResult = /* @__PURE__ */ Struct({
  issues: /* @__PURE__ */ ArraySchema(/* @__PURE__ */ Struct({
    message: String5,
    path: /* @__PURE__ */ optional2(/* @__PURE__ */ ArraySchema(/* @__PURE__ */ Union2([PropertyKey, /* @__PURE__ */ Struct({
      key: PropertyKey
    })])))
  }))
});
var BooleanFromBit = /* @__PURE__ */ Literals([0, 1]).pipe(/* @__PURE__ */ decodeTo2(Boolean3, /* @__PURE__ */ transform2({
  decode: (bit) => bit === 1,
  encode: (bool) => bool ? 1 : 0
})));
var Base64String = /* @__PURE__ */ String5.annotate({
  expected: "a base64 encoded string that will be decoded as Uint8Array",
  format: "byte",
  contentEncoding: "base64"
});
var Uint8Array2 = /* @__PURE__ */ instanceOf(globalThis.Uint8Array, {
  representation: {
    id: "effect/schema/Uint8Array",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.Uint8Array`,
    Type: `globalThis.Uint8Array`
  }),
  expected: "Uint8Array",
  toCodecJson: () => link()(Base64String, uint8ArrayFromBase64String),
  toArbitrary: () => (fc) => fc.uint8Array()
});
var Uint8ArrayReviver = /* @__PURE__ */ makeFixedDeclarationReviver("effect/schema/Uint8Array", Uint8Array2);
var Uint8ArrayFromBase64 = /* @__PURE__ */ Base64String.pipe(/* @__PURE__ */ decodeTo2(Uint8Array2, uint8ArrayFromBase64String));
var Uint8ArrayFromBase64Url = /* @__PURE__ */ String5.annotate({
  expected: "a base64 (URL) encoded string that will be decoded as a Uint8Array"
}).pipe(/* @__PURE__ */ decodeTo2(Uint8Array2, {
  decode: /* @__PURE__ */ decodeBase64Url2(),
  encode: /* @__PURE__ */ encodeBase64Url2()
}));
var Uint8ArrayFromHex = /* @__PURE__ */ String5.annotate({
  expected: "a hex encoded string that will be decoded as a Uint8Array"
}).pipe(/* @__PURE__ */ decodeTo2(Uint8Array2, {
  decode: /* @__PURE__ */ decodeHex2(),
  encode: /* @__PURE__ */ encodeHex2()
}));
var DateTimeUtc = /* @__PURE__ */ declare((u) => isDateTime2(u) && isUtc2(u), {
  representation: {
    id: "effect/schema/DateTimeUtc",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.DateTimeUtc`,
    Type: `DateTime.Utc`,
    importDeclarations: [`import * as DateTime from "effect/DateTime"`]
  }),
  expected: "DateTime.Utc",
  toCodecJson: () => link()(String5, dateTimeUtcFromString),
  toArbitrary: () => (fc, ctx) => fc.date(dateArbitraryConstraints(ctx?.constraint?.ordered?.order === Order3 ? ctx.constraint.ordered : undefined, {
    noInvalidDate: true
  }, toDateUtc2)).map((date) => fromDateUnsafe2(date)),
  toFormatter: () => (utc) => utc.toString(),
  toEquivalence: () => Equivalence4
});
var DateTimeUtcReviver = /* @__PURE__ */ makeFixedDeclarationReviver("effect/schema/DateTimeUtc", DateTimeUtc);
var DateTimeUtcFromDate = /* @__PURE__ */ Date4.pipe(/* @__PURE__ */ decodeTo2(DateTimeUtc, {
  decode: /* @__PURE__ */ dateTimeUtcFromInput(),
  encode: /* @__PURE__ */ transform(toDateUtc2)
}));
var DateTimeUtcFromString = /* @__PURE__ */ String5.annotate({
  expected: "a string that will be decoded as a DateTime.Utc"
}).pipe(/* @__PURE__ */ decodeTo2(DateTimeUtc, dateTimeUtcFromString));
var DateTimeUtcFromMillis = /* @__PURE__ */ Int.pipe(/* @__PURE__ */ decodeTo2(DateTimeUtc, {
  decode: /* @__PURE__ */ dateTimeUtcFromInput(),
  encode: /* @__PURE__ */ transform(toEpochMillis2)
}));
var TimeZoneOffset = /* @__PURE__ */ declare(isTimeZoneOffset2, {
  representation: {
    id: "effect/schema/TimeZoneOffset",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.TimeZoneOffset`,
    Type: `DateTime.TimeZone.Offset`,
    importDeclarations: [`import * as DateTime from "effect/DateTime"`]
  }),
  expected: "DateTime.TimeZone.Offset",
  toCodecJson: () => link()(Int, timeZoneOffsetFromNumber),
  toArbitrary: () => (fc) => fc.integer({
    min: -12 * 60 * 60 * 1000,
    max: 14 * 60 * 60 * 1000
  }).map((n) => zoneMakeOffset2(n)),
  toFormatter: () => (tz) => zoneToString2(tz),
  toEquivalence: () => (a, b) => a.offset === b.offset
});
var TimeZoneOffsetReviver = /* @__PURE__ */ makeFixedDeclarationReviver("effect/schema/TimeZoneOffset", TimeZoneOffset);
var TimeZoneNamedString = /* @__PURE__ */ String5.annotate({
  expected: "an IANA time zone identifier"
});
var TimeZoneNamed = /* @__PURE__ */ declare(isTimeZoneNamed2, {
  representation: {
    id: "effect/schema/TimeZoneNamed",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.TimeZoneNamed`,
    Type: `DateTime.TimeZone.Named`,
    importDeclarations: [`import * as DateTime from "effect/DateTime"`]
  }),
  expected: "DateTime.TimeZone.Named",
  toCodecJson: () => link()(TimeZoneNamedString, timeZoneNamedFromString),
  toArbitrary: () => (fc) => fc.constantFrom(...["UTC", "Europe/London", "America/New_York", "Asia/Tokyo", "Australia/Sydney"].map(zoneMakeNamedUnsafe2)),
  toFormatter: () => (tz) => zoneToString2(tz),
  toEquivalence: () => (a, b) => a.id === b.id
});
var TimeZoneNamedReviver = /* @__PURE__ */ makeFixedDeclarationReviver("effect/schema/TimeZoneNamed", TimeZoneNamed);
var TimeZoneNamedFromString = /* @__PURE__ */ TimeZoneNamedString.pipe(/* @__PURE__ */ decodeTo2(TimeZoneNamed, timeZoneNamedFromString));
var TimeZoneString = /* @__PURE__ */ String5.annotate({
  expected: "a time zone string (IANA identifier or offset like +03:00)"
});
var TimeZone = /* @__PURE__ */ declare(isTimeZone2, {
  representation: {
    id: "effect/schema/TimeZone",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.TimeZone`,
    Type: `DateTime.TimeZone`,
    importDeclarations: [`import * as DateTime from "effect/DateTime"`]
  }),
  expected: "DateTime.TimeZone",
  toCodecJson: () => link()(TimeZoneString, timeZoneFromString),
  toArbitrary: () => (fc) => fc.oneof(fc.integer({
    min: -12 * 60 * 60 * 1000,
    max: 14 * 60 * 60 * 1000
  }).map((n) => zoneMakeOffset2(n)), fc.constantFrom(...["UTC", "Europe/London", "America/New_York", "Asia/Tokyo", "Australia/Sydney"].map(zoneMakeNamedUnsafe2))),
  toFormatter: () => (tz) => zoneToString2(tz),
  toEquivalence: () => (a, b) => zoneToString2(a) === zoneToString2(b)
});
var TimeZoneReviver = /* @__PURE__ */ makeFixedDeclarationReviver("effect/schema/TimeZone", TimeZone);
var TimeZoneFromString = /* @__PURE__ */ TimeZoneString.pipe(/* @__PURE__ */ decodeTo2(TimeZone, timeZoneFromString));
var DateTimeZonedString = /* @__PURE__ */ String5.annotate({
  expected: "a zoned DateTime string (e.g. 2024-01-01T00:00:00.000+00:00[Europe/London])"
});
var DateTimeZoned = /* @__PURE__ */ declare((u) => isDateTime2(u) && isZoned2(u), {
  representation: {
    id: "effect/schema/DateTimeZoned",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.DateTimeZoned`,
    Type: `DateTime.Zoned`,
    importDeclarations: [`import * as DateTime from "effect/DateTime"`]
  }),
  expected: "DateTime.Zoned",
  toCodecJson: () => link()(DateTimeZonedString, dateTimeZonedFromString),
  toArbitrary: () => (fc, ctx) => fc.tuple(fc.date(dateArbitraryConstraints(ctx?.constraint?.ordered?.order === Order3 ? ctx.constraint.ordered : undefined, {
    max: new globalThis.Date(8640000000000000 - 14 * 60 * 60 * 1000),
    min: new globalThis.Date(-8640000000000000 + 14 * 60 * 60 * 1000),
    noInvalidDate: true
  }, toDateUtc2)), fc.constantFrom("UTC", "Europe/London", "America/New_York", "Asia/Tokyo", "Australia/Sydney")).map(([date, zone]) => makeZonedUnsafe2(date, {
    timeZone: zone
  })),
  toFormatter: () => (zoned) => formatIsoZoned2(zoned),
  toEquivalence: () => Equivalence4
});
var DateTimeZonedReviver = /* @__PURE__ */ makeFixedDeclarationReviver("effect/schema/DateTimeZoned", DateTimeZoned);
var DateTimeZonedFromString = /* @__PURE__ */ DateTimeZonedString.pipe(/* @__PURE__ */ decodeTo2(DateTimeZoned, dateTimeZonedFromString));
var immerable = /* @__PURE__ */ globalThis.Symbol.for("immer-draftable");
var payloadToken = {};
function makeClass(Inherited, identifier2, struct2, annotations, proto) {
  const getClassSchema = getClassSchemaFactory(struct2, identifier2, annotations);
  const ClassTypeId = getClassTypeId(identifier2);
  const out = class extends Inherited {
    constructor(...[input, options]) {
      const internalOptions = options;
      const payload = internalOptions?.["~payload"];
      const value3 = payload?.token === payloadToken ? payload.value : struct2.make(input ?? {}, options);
      super(value3, {
        ...options,
        disableChecks: true,
        "~payload": {
          token: payloadToken,
          value: value3
        }
      });
    }
    static [TypeId21] = TypeId21;
    get [ClassTypeId]() {
      return ClassTypeId;
    }
    static [immerable] = true;
    static identifier = identifier2;
    static fields = struct2.fields;
    static get ast() {
      return getClassSchema(this).ast;
    }
    static pipe() {
      return pipeArguments(this, arguments);
    }
    static rebuild(ast) {
      return getClassSchema(this).rebuild(ast);
    }
    static make(input, options) {
      return new this(input, options);
    }
    static makeOption(input, options) {
      return makeOption(getClassSchema(this))(input ?? {}, options);
    }
    static makeEffect(input, options) {
      return getClassSchema(this).makeEffect(input ?? {}, options);
    }
    static annotate(annotations2) {
      return this.rebuild(annotate(this.ast, annotations2));
    }
    static annotateKey(annotations2) {
      return this.rebuild(annotateKey(this.ast, annotations2));
    }
    static check(...checks) {
      return this.rebuild(appendChecks(this.ast, checks));
    }
    static extend(identifier3) {
      return (schema, annotations2) => {
        const extension = isStruct(schema) ? schema : Struct(schema);
        const fields = {
          ...struct2.fields,
          ...extension.fields
        };
        const ast = struct(fields, struct2.ast.checks, {
          identifier: identifier3
        });
        return makeClass(this, identifier3, makeStruct(appendChecks(ast, extension.ast.checks), fields), annotations2, proto);
      };
    }
    static mapFields(f, options) {
      return struct2.mapFields(f, options);
    }
  };
  if (proto !== undefined) {
    Object.assign(out.prototype, proto(identifier2));
  }
  return out;
}
function getClassTransformation(self) {
  return new Transformation(transform((input) => new self(input, {
    "~payload": {
      token: payloadToken,
      value: input
    }
  })), passthrough2());
}
function getClassTypeId(identifier2) {
  return `~effect/Schema/Class/${identifier2}`;
}
function getClassSchemaFactory(from, identifier2, annotations) {
  let memo;
  return (self) => {
    if (memo !== undefined) {
      return memo;
    }
    const ClassTypeId = getClassTypeId(identifier2);
    const isClassValue = (input) => input instanceof self || hasProperty(input, ClassTypeId);
    const transformation = getClassTransformation(self);
    const to = make18(new Declaration([from.ast], () => (input, ast, options) => {
      return isClassValue(input) ? succeed6(input) : fail5(new InvalidType(ast, input, options));
    }, {
      identifier: identifier2,
      [CONSTRUCTOR_ANNOTATION_KEY]: ([from2]) => ({
        isConstructed: isClassValue,
        link: new Link(from2, transformation)
      }),
      toCodec: ([from2]) => new Link(from2.ast, transformation),
      toArbitrary: ([from2]) => () => ({
        arbitrary: from2.arbitrary.map((args2) => new self(args2)),
        terminal: from2.terminal?.map((args2) => new self(args2))
      }),
      toFormatter: ([from2]) => (t) => `${self.identifier}(${from2(t)})`,
      [SENTINELS_ANNOTATION_KEY]: collectSentinels(from.ast),
      ...annotations
    }));
    return memo = decodeTo2(to, transformation)(from);
  };
}
function isStruct(schema) {
  return isSchema(schema);
}
var Class3 = (identifier2) => (schema, annotations) => {
  const struct2 = isStruct(schema) ? schema : Struct(schema);
  return makeClass(Class2, identifier2, struct2, annotations, (identifier3) => ({
    toString() {
      return `${identifier3}(${format({
        ...this
      })})`;
    }
  }));
};
var TaggedClass = (identifier2) => {
  return (tagValue, schema, annotations) => {
    const struct2 = isStruct(schema) ? schema.mapFields((fields) => ({
      _tag: tag(tagValue),
      ...fields
    }), {
      unsafePreserveChecks: true
    }) : TaggedStruct(tagValue, schema);
    return Class3(identifier2 ?? tagValue)(struct2, annotations);
  };
};
var Error3 = (identifier2) => (schema, annotations) => {
  const struct2 = isStruct(schema) ? schema : Struct(schema);
  const self = makeClass(Error2, identifier2, struct2, annotations, (identifier3) => ({
    name: identifier3
  }));
  return self;
};
var TaggedError3 = (identifier2) => {
  return (tagValue, schema, annotations) => {
    const struct2 = isStruct(schema) ? schema.mapFields((fields) => ({
      _tag: tag(tagValue),
      ...fields
    }), {
      unsafePreserveChecks: true
    }) : TaggedStruct(tagValue, schema);
    return Error3(identifier2 ?? tagValue)(struct2, annotations);
  };
};
function toArbitrary(schema) {
  const lawc = memoized(schema.ast);
  return (fc) => lawc(fc, {});
}
function overrideToFormatter(toFormatter) {
  return (self) => {
    return self.annotate({
      toFormatter
    });
  };
}
function toFormatter(schema, options) {
  return recur3(schema.ast);
  function recur3(ast) {
    const annotation = resolve(ast)?.["toFormatter"];
    if (typeof annotation === "function") {
      return annotation(isDeclaration(ast) ? ast.typeParameters.map(recur3) : []);
    }
    if (options?.onBefore) {
      const onBefore = options.onBefore(ast, recur3);
      if (onBefore !== undefined) {
        return onBefore;
      }
    }
    return on(ast);
  }
  function on(ast) {
    switch (ast._tag) {
      default:
        return format;
      case "Never":
        return () => "never";
      case "Void":
        return () => "void";
      case "Arrays": {
        const elements = ast.elements.map(recur3);
        const rest = ast.rest.map(recur3);
        return (t) => {
          const out = [];
          let i = 0;
          for (;i < elements.length; i++) {
            if (t.length < i + 1) {
              if (isOptional(ast.elements[i])) {
                continue;
              }
            } else {
              out.push(elements[i](t[i]));
            }
          }
          if (rest.length > 0) {
            const [head, ...tail] = rest;
            for (;i < t.length - tail.length; i++) {
              out.push(head(t[i]));
            }
            for (let j = 0;j < tail.length; j++) {
              out.push(tail[j](t[i + j]));
            }
          }
          return "[" + out.join(", ") + "]";
        };
      }
      case "Objects": {
        const propertySignatures = ast.propertySignatures.map((ps) => recur3(ps.type));
        const indexSignatures = ast.indexSignatures.map((is3) => recur3(is3.type));
        if (ast.propertySignatures.length === 0 && ast.indexSignatures.length === 0) {
          return format;
        }
        return (t) => {
          const out = [];
          const visited = new Set;
          for (let i = 0;i < propertySignatures.length; i++) {
            const ps = ast.propertySignatures[i];
            const name = ps.name;
            visited.add(name);
            if (isOptional(ps.type) && !Object.hasOwn(t, name)) {
              continue;
            }
            out.push(`${formatPropertyKey(name)}: ${propertySignatures[i](t[name])}`);
          }
          for (let i = 0;i < indexSignatures.length; i++) {
            const keys3 = getIndexSignatureKeys(t, ast.indexSignatures[i].parameter);
            for (const key of keys3) {
              if (visited.has(key)) {
                continue;
              }
              visited.add(key);
              out.push(`${formatPropertyKey(key)}: ${indexSignatures[i](t[key])}`);
            }
          }
          return out.length > 0 ? "{ " + out.join(", ") + " }" : "{}";
        };
      }
      case "Union": {
        const types = toType(ast).types;
        const getCandidates2 = (t) => getCandidates(t, types);
        const compiled = new Map(types.map((candidate, i) => [candidate, [_is(candidate), recur3(ast.types[i])]]));
        return (t) => {
          const candidates = getCandidates2(t);
          for (let i = 0;i < candidates.length; i++) {
            const [is3, formatter] = compiled.get(candidates[i]);
            if (is3(t)) {
              return formatter(t);
            }
          }
          return format(t);
        };
      }
      case "Suspend": {
        const get4 = memoizeThunk(() => recur3(ast.thunk()));
        return (t) => get4()(t);
      }
    }
  }
}
function overrideToEquivalence(toEquivalence2) {
  return (self) => self.annotate({
    toEquivalence: toEquivalence2
  });
}
function toEquivalence2(schema) {
  return toEquivalence(schema.ast);
}
function toRepresentation2(schema) {
  return toRepresentation(schema.ast);
}
function toJsonSchemaDocument2(schema, options) {
  const document = toRepresentation(toCodecJsonAST(schema.ast), toRepresentationOptions);
  return toJsonSchemaDocument(document, options);
}
function toCodecJson(schema) {
  return make18(toCodecJsonAST(schema.ast), {
    schema
  });
}
var toCodecJsonAST = /* @__PURE__ */ applyToSelfOrLastLinkEncodingIdempotent((ast) => {
  const out = toCodecJsonASTStep(ast, toCodecJsonAST);
  const context3 = ast.context;
  if (out === ast || context3 === undefined)
    return out;
  return replaceContextLastLink(out, withoutConstructorDefault(context3));
});
function withoutConstructorDefault(context3) {
  return context3.constructorDefault === undefined ? context3 : new Context(context3.isOptional, context3.isMutable, undefined, context3.annotations);
}
function validateCanonicalObjectPropertyNames(ast) {
  if (ast.propertySignatures.some((ps) => typeof ps.name !== "string")) {
    throw new globalThis.Error("Objects property names must be strings", {
      cause: ast
    });
  }
}
function makeReorder(getPriority) {
  return (types) => {
    const indexMap = new Map;
    for (let i = 0;i < types.length; i++) {
      indexMap.set(toEncoded(types[i]), i);
    }
    const sortedTypes = [...types].sort((a, b) => {
      a = toEncoded(a);
      b = toEncoded(b);
      const pa = getPriority(a);
      const pb = getPriority(b);
      if (pa !== pb)
        return pa - pb;
      return indexMap.get(a) - indexMap.get(b);
    });
    const orderChanged = sortedTypes.some((ast, index2) => ast !== types[index2]);
    if (!orderChanged)
      return types;
    return sortedTypes;
  };
}
var toCodecJsonReorder = /* @__PURE__ */ makeReorder((ast) => {
  switch (ast._tag) {
    case "BigInt":
    case "Symbol":
    case "UniqueSymbol":
      return 0;
    default:
      return 1;
  }
});
function toCodecJsonASTStep(ast, recur3) {
  switch (ast._tag) {
    case "Declaration": {
      const getLink = ast.annotations?.toCodecJson ?? ast.annotations?.toCodec;
      if (!isFunction(getLink)) {
        return replaceEncoding(ast, [unknownToJson]);
      }
      const typeParameters = ast.typeParameters.map((tp) => make16(toEncoded(tp)));
      const link2 = getLink(typeParameters);
      return link2 === undefined ? ast : replaceEncoding(ast, [mapLink(link2, recur3)]);
    }
    case "Unknown":
      return replaceEncoding(ast, [unknownToJson]);
    case "ObjectKeyword":
      return replaceEncoding(ast, [objectKeywordToJson]);
    case "Undefined":
    case "Void":
    case "Literal":
    case "Number":
      return ast.toCodecJson();
    case "UniqueSymbol":
    case "Symbol":
    case "BigInt":
      return ast.toCodecStringTree();
    case "Objects": {
      validateCanonicalObjectPropertyNames(ast);
      return ast.recur(recur3, parameterFromString);
    }
    case "Union": {
      const sortedTypes = toCodecJsonReorder(ast.types);
      if (sortedTypes !== ast.types) {
        return new Union(sortedTypes, ast.mode, ast.annotations, ast.checks, ast.encoding, ast.context, ast.encodingChecks).recur(recur3);
      }
      return ast.recur(recur3);
    }
    case "Arrays":
    case "Suspend":
      return ast.recur(recur3);
  }
  return ast;
}
function toCodecIso(schema) {
  return make18(toCodecIsoAST(toType(schema.ast)));
}
var toCodecIsoAST = /* @__PURE__ */ memoize((ast) => {
  const out = toCodecIsoASTStep(ast, toCodecIsoAST);
  return out !== ast && ast.context !== undefined ? replaceContextLastLink(out, withoutConstructorDefault(ast.context)) : out;
});
function toCodecIsoASTStep(ast, recur3) {
  switch (ast._tag) {
    case "Declaration": {
      const getLink = ast.annotations?.toCodecIso ?? ast.annotations?.toCodec;
      if (isFunction(getLink)) {
        const link2 = getLink(ast.typeParameters.map((tp) => make16(tp)));
        return replaceEncoding(ast, [mapLink(link2, recur3)]);
      }
      return ast;
    }
    case "Arrays":
    case "Objects":
    case "Union":
    case "Suspend":
      return ast.recur(recur3);
  }
  return ast;
}
function toCodecStringTree(schema) {
  return make18(toCodecStringTreeAST(schema.ast), {
    schema
  });
}
function toCodecArrayFromSingle(schema) {
  return make18(toCodecArrayFromSingleAST(schema.ast));
}
function toEncoderXml(codec, options) {
  const rootName = resolveIdentifier(codec.ast) ?? resolveTitle(codec.ast);
  const serialize = encodeEffect(toCodecStringTree(codec));
  return (t) => serialize(t).pipe(map7((stringTree) => stringTreeToXml(stringTree, {
    rootName,
    ...options
  })));
}
function stringTreeToXml(value3, options) {
  const rootName = options.rootName ?? "root";
  const arrayItemName = options.arrayItemName ?? "item";
  const pretty2 = options.pretty ?? true;
  const indent = options.indent ?? "  ";
  const sortKeys = options.sortKeys ?? true;
  const seen = new Set;
  const lines = [];
  recur3(rootName, value3, 0);
  return lines.join(pretty2 ? `
` : "");
  function push(depth, text) {
    lines.push(pretty2 ? indent.repeat(depth) + text : text);
  }
  function recur3(tagName, node, depth, originalNameForMeta) {
    const {
      attrs,
      safe
    } = xml.tagInfo(tagName, originalNameForMeta);
    if (node === undefined) {
      push(depth, `<${safe}${attrs}/>`);
    } else if (typeof node === "string") {
      push(depth, `<${safe}${attrs}>${xml.escapeText(node)}</${safe}>`);
    } else if (typeof node !== "object" || node === null) {
      push(depth, `<${safe}${attrs}>${xml.escapeText(format(node))}</${safe}>`);
    } else {
      if (seen.has(node))
        throw new globalThis.Error("Cycle detected while serializing to XML.", {
          cause: node
        });
      seen.add(node);
      try {
        if (globalThis.globalThis.Array.isArray(node)) {
          if (node.length === 0) {
            push(depth, `<${safe}${attrs}/>`);
            return;
          }
          push(depth, `<${safe}${attrs}>`);
          for (const item of node)
            recur3(arrayItemName, item, depth + 1);
          push(depth, `</${safe}>`);
          return;
        }
        const obj = node;
        const keys3 = Object.keys(obj);
        if (sortKeys)
          keys3.sort();
        if (keys3.length === 0) {
          push(depth, `<${safe}${attrs}/>`);
          return;
        }
        push(depth, `<${safe}${attrs}>`);
        for (const k of keys3) {
          recur3(xml.parseTagName(k).safe, obj[k], depth + 1, k);
        }
        push(depth, `</${safe}>`);
      } finally {
        seen.delete(node);
      }
    }
  }
}
var xml = {
  escapeText(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  },
  escapeAttribute(s) {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  },
  parseTagName(name) {
    const original = name;
    let safe = name;
    if (!/^[A-Za-z_]/.test(safe))
      safe = "_" + safe;
    safe = safe.replace(/[^A-Za-z0-9._-]/g, "_");
    if (/^xml/i.test(safe))
      safe = "_" + safe;
    return {
      safe,
      changed: safe !== original
    };
  },
  tagInfo(name, original) {
    const {
      changed,
      safe
    } = xml.parseTagName(name);
    const needsMeta = changed || original && original !== name;
    const attrs = needsMeta ? ` data-name="${xml.escapeAttribute(original ?? name)}"` : "";
    return {
      safe,
      attrs
    };
  }
};
var toStringTreeReorder = /* @__PURE__ */ makeReorder((ast) => {
  switch (ast._tag) {
    case "Null":
    case "Boolean":
    case "Number":
    case "BigInt":
    case "Symbol":
    case "UniqueSymbol":
      return 0;
    default:
      return 1;
  }
});
function toCodecStringTreeASTStep(ast, recur3, onMissingAnnotation) {
  switch (ast._tag) {
    case "Declaration": {
      const typeParameters = ast.typeParameters.map((tp) => make18(recur3(toEncoded(tp))));
      const getStringTreeLink = ast.annotations?.toCodecStringTree;
      if (isFunction(getStringTreeLink)) {
        const link3 = getStringTreeLink(typeParameters);
        if (link3 === undefined)
          return ast;
        return replaceEncoding(ast, [mapLink(link3, recur3)]);
      }
      const getJsonLink = ast.annotations?.toCodecJson;
      const jsonLink = isFunction(getJsonLink) ? getJsonLink(typeParameters) : undefined;
      const getLink = jsonLink === undefined ? ast.annotations?.toCodec : undefined;
      const link2 = jsonLink ?? (isFunction(getLink) ? getLink(typeParameters) : undefined);
      return link2 === undefined ? onMissingAnnotation(ast) : replaceEncoding(ast, [mapLink(link2, recur3)]);
    }
    case "Null":
      return replaceEncoding(ast, [nullToString]);
    case "Boolean":
      return replaceEncoding(ast, [booleanToString]);
    case "Unknown":
    case "ObjectKeyword":
      return replaceEncoding(ast, [unknownToStringTree]);
    case "Enum":
    case "Number":
    case "Literal":
    case "UniqueSymbol":
    case "Symbol":
    case "BigInt":
      return ast.toCodecStringTree();
    case "Objects": {
      validateCanonicalObjectPropertyNames(ast);
      return ast.recur(recur3, parameterFromString);
    }
    case "Union": {
      const sortedTypes = toStringTreeReorder(ast.types);
      if (sortedTypes !== ast.types) {
        return new Union(sortedTypes, ast.mode, ast.annotations, ast.checks, ast.encoding, ast.context, ast.encodingChecks).recur(recur3);
      }
      return ast.recur(recur3);
    }
    case "Arrays":
    case "Suspend":
      return ast.recur(recur3);
  }
  return ast;
}
var nullToString = /* @__PURE__ */ new Link(/* @__PURE__ */ new Literal("null"), /* @__PURE__ */ new Transformation(/* @__PURE__ */ transform(() => null), /* @__PURE__ */ transform(() => "null")));
var booleanToString = /* @__PURE__ */ new Link(/* @__PURE__ */ new Union([/* @__PURE__ */ new Literal("true"), /* @__PURE__ */ new Literal("false")], "anyOf"), /* @__PURE__ */ new Transformation(/* @__PURE__ */ transform((s) => s === "true"), /* @__PURE__ */ String3()));
var arrayFromSingleTransformation = /* @__PURE__ */ new Transformation(/* @__PURE__ */ transform((input) => typeof input === "string" ? [input] : input), /* @__PURE__ */ passthrough2());
var isCodecArrayFromSingleLink = (link2) => link2.transformation === arrayFromSingleTransformation;
var toCodecStringTreeAST = /* @__PURE__ */ applyToSelfOrLastLinkEncodingIdempotent((ast) => {
  const out = toCodecStringTreeASTStep(ast, toCodecStringTreeAST, (ast2) => {
    throw new globalThis.Error("Missing structural codec for StringTree", {
      cause: ast2
    });
  });
  if (out !== ast && ast.context !== undefined) {
    return replaceContextLastLink(out, withoutConstructorDefault(ast.context));
  }
  return out;
}, {
  stopAt: isCodecArrayFromSingleLink
});
var toArrayFromSingleInputElement = (ast) => isOptional(ast) ? optionalKey(unknown) : unknown;
var toCodecArrayFromSingleAST = /* @__PURE__ */ applyToSelfOrLastLinkEncodingIdempotent((ast) => {
  const out = toCodecArrayFromSingleASTStep(ast);
  if (isArrays(out)) {
    const ensure2 = decodeTo(new Union([new Arrays(out.isMutable, out.elements.map(toArrayFromSingleInputElement), out.rest.map(toArrayFromSingleInputElement)), string2], "anyOf"), out, arrayFromSingleTransformation);
    return isOptional(ast) ? optionalKey(ensure2) : ensure2;
  }
  return out;
}, {
  stopAt: isCodecArrayFromSingleLink
});
function toCodecArrayFromSingleASTStep(ast) {
  return ast._tag === "Declaration" || ast._tag === "Arrays" || ast._tag === "Objects" || ast._tag === "Union" || ast._tag === "Suspend" ? ast.recur(toCodecArrayFromSingleAST) : ast;
}
var isGreaterThanDateReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isGreaterThanDate", /* @__PURE__ */ Struct({
  exclusiveMinimum: Date4
}), ({
  annotations,
  payload
}) => isGreaterThanDate(payload.exclusiveMinimum, annotations));
var isGreaterThanOrEqualToDateReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isGreaterThanOrEqualToDate", /* @__PURE__ */ Struct({
  minimum: Date4
}), ({
  annotations,
  payload
}) => isGreaterThanOrEqualToDate(payload.minimum, annotations));
var isLessThanDateReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isLessThanDate", /* @__PURE__ */ Struct({
  exclusiveMaximum: Date4
}), ({
  annotations,
  payload
}) => isLessThanDate(payload.exclusiveMaximum, annotations));
var isLessThanOrEqualToDateReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isLessThanOrEqualToDate", /* @__PURE__ */ Struct({
  maximum: Date4
}), ({
  annotations,
  payload
}) => isLessThanOrEqualToDate(payload.maximum, annotations));
var isBetweenDateReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isBetweenDate", /* @__PURE__ */ Struct({
  minimum: Date4,
  maximum: Date4,
  exclusiveMinimum: /* @__PURE__ */ optional2(/* @__PURE__ */ Literal2(true)),
  exclusiveMaximum: /* @__PURE__ */ optional2(/* @__PURE__ */ Literal2(true))
}), ({
  annotations,
  payload
}) => isBetweenDate(payload, annotations));
var isGreaterThanBigIntReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isGreaterThanBigInt", /* @__PURE__ */ Struct({
  exclusiveMinimum: BigInt5
}), ({
  annotations,
  payload
}) => isGreaterThanBigInt(payload.exclusiveMinimum, annotations));
var isGreaterThanOrEqualToBigIntReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isGreaterThanOrEqualToBigInt", /* @__PURE__ */ Struct({
  minimum: BigInt5
}), ({
  annotations,
  payload
}) => isGreaterThanOrEqualToBigInt(payload.minimum, annotations));
var isLessThanBigIntReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isLessThanBigInt", /* @__PURE__ */ Struct({
  exclusiveMaximum: BigInt5
}), ({
  annotations,
  payload
}) => isLessThanBigInt(payload.exclusiveMaximum, annotations));
var isLessThanOrEqualToBigIntReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isLessThanOrEqualToBigInt", /* @__PURE__ */ Struct({
  maximum: BigInt5
}), ({
  annotations,
  payload
}) => isLessThanOrEqualToBigInt(payload.maximum, annotations));
var isBetweenBigIntReviver = /* @__PURE__ */ makeFilterReviver("effect/schema/isBetweenBigInt", /* @__PURE__ */ Struct({
  minimum: BigInt5,
  maximum: BigInt5,
  exclusiveMinimum: /* @__PURE__ */ optional2(/* @__PURE__ */ Literal2(true)),
  exclusiveMaximum: /* @__PURE__ */ optional2(/* @__PURE__ */ Literal2(true))
}), ({
  annotations,
  payload
}) => isBetweenBigInt(payload, annotations));
function toIso(schema) {
  const serializer = toCodecIso(schema);
  return makeIso(encodeSync(serializer), decodeSync(serializer));
}
function toIsoSource(_) {
  return id();
}
function toIsoFocus(_) {
  return id();
}
function overrideToCodecIso(to, transformation) {
  return (schema) => {
    return make18(annotate(schema.ast, {
      toCodecIso: () => new Link(to.ast, make14(transformation))
    }), {
      schema
    });
  };
}
function toDifferJsonPatch(schema) {
  const serializer = toCodecJson(schema);
  const get4 = encodeSync(serializer);
  const set2 = decodeSync(serializer);
  return {
    empty: [],
    diff: (oldValue, newValue) => get3(get4(oldValue), get4(newValue)),
    combine: (first, second) => [...first, ...second],
    patch: (oldValue, patch) => {
      const value3 = get4(oldValue);
      const patched = apply(patch, value3);
      return Object.is(patched, value3) ? oldValue : set2(patched);
    }
  };
}
function Tree(node) {
  const Tree$ref = suspend3(() => Tree2);
  const Tree2 = Union2([node, ArraySchema(Tree$ref), Record(String5, Tree$ref)]);
  return Tree2;
}
var Json2 = /* @__PURE__ */ make18(/* @__PURE__ */ annotate(Json, {
  toCode: () => ({
    runtime: "Schema.Json",
    Type: "Schema.Json"
  })
}));
var JsonReviver = /* @__PURE__ */ makeFixedDeclarationReviver("effect/schema/Json", Json2);
var JsonError = /* @__PURE__ */ Struct({
  message: String5,
  name: /* @__PURE__ */ optionalKey2(String5),
  stack: /* @__PURE__ */ optionalKey2(String5),
  cause: /* @__PURE__ */ optionalKey2(Json2)
});
var MutableJson2 = /* @__PURE__ */ make18(/* @__PURE__ */ annotate(MutableJson, {
  toCode: () => ({
    runtime: "Schema.MutableJson",
    Type: "Schema.MutableJson"
  })
}));
var MutableJsonReviver = /* @__PURE__ */ makeFixedDeclarationReviver("effect/schema/MutableJson", MutableJson2);
function resolveAnnotations(schema) {
  return resolve(schema.ast);
}
function resolveAnnotationsKey(schema) {
  return schema.ast.context?.annotations;
}
// packages/ts-release/dist/internal/Error.js
class ReleaseError extends exports_Schema.TaggedError()("ReleaseError", {
  code: exports_Schema.String,
  message: exports_Schema.String
}) {
}
function fail7(code, message) {
  throw new ReleaseError({ code, message });
}
var failure = (code, message) => new ReleaseError({ code, message });
var reject = (code, message) => exports_Effect.fail(failure(code, message));
var attempt = (body) => exports_Effect.try({
  try: body,
  catch: (error) => error instanceof ReleaseError ? error : new ReleaseError({ code: "invalid-data", message: "Value could not be admitted" })
});

// node_modules/effect-build/dist/SystemTarget.js
var OperatingSystem = exports_Schema.Literals(["macos", "linux", "windows"]);
var Architecture = exports_Schema.Literals(["x64", "aarch64"]);
var Abi = exports_Schema.Literals(["gnu", "musl"]);
var SystemTarget = exports_Schema.Literals([
  "macos-x64",
  "macos-aarch64",
  "linux-x64-gnu",
  "linux-x64-musl",
  "linux-aarch64-gnu",
  "linux-aarch64-musl",
  "windows-x64",
  "windows-aarch64"
]);
var descriptors = Object.freeze({
  "macos-x64": Object.freeze({
    target: "macos-x64",
    os: "macos",
    architecture: "x64",
    abi: null,
    executableSuffix: "",
    nativeFormat: "mach-o"
  }),
  "macos-aarch64": Object.freeze({
    target: "macos-aarch64",
    os: "macos",
    architecture: "aarch64",
    abi: null,
    executableSuffix: "",
    nativeFormat: "mach-o"
  }),
  "linux-x64-gnu": Object.freeze({
    target: "linux-x64-gnu",
    os: "linux",
    architecture: "x64",
    abi: "gnu",
    executableSuffix: "",
    nativeFormat: "elf"
  }),
  "linux-x64-musl": Object.freeze({
    target: "linux-x64-musl",
    os: "linux",
    architecture: "x64",
    abi: "musl",
    executableSuffix: "",
    nativeFormat: "elf"
  }),
  "linux-aarch64-gnu": Object.freeze({
    target: "linux-aarch64-gnu",
    os: "linux",
    architecture: "aarch64",
    abi: "gnu",
    executableSuffix: "",
    nativeFormat: "elf"
  }),
  "linux-aarch64-musl": Object.freeze({
    target: "linux-aarch64-musl",
    os: "linux",
    architecture: "aarch64",
    abi: "musl",
    executableSuffix: "",
    nativeFormat: "elf"
  }),
  "windows-x64": Object.freeze({
    target: "windows-x64",
    os: "windows",
    architecture: "x64",
    abi: null,
    executableSuffix: ".exe",
    nativeFormat: "pe"
  }),
  "windows-aarch64": Object.freeze({
    target: "windows-aarch64",
    os: "windows",
    architecture: "aarch64",
    abi: null,
    executableSuffix: ".exe",
    nativeFormat: "pe"
  })
});
var describe = (target) => descriptors[target];

// node_modules/effect-build/dist/Artifact.js
class ArtifactInvalid extends exports_Schema.TaggedError()("ArtifactInvalid", {
  path: exports_Schema.String,
  reason: exports_Schema.String
}) {
  get message() {
    return `invalid artifact at ${this.path}: ${this.reason}`;
  }
}
var isNormalizedSegment = (segment) => segment.length > 0 && segment !== "." && segment !== "..";
var hasNormalizedSegments = (value3, separator) => {
  const segments = value3.split(separator);
  const last = segments.at(-1);
  const body = last === "" ? segments.slice(0, -1) : segments;
  return body.length > 0 && body.every(isNormalizedSegment);
};
var isNormalizedPosixAbsolutePath = (value3) => {
  if (!value3.startsWith("/") || value3.startsWith("//"))
    return false;
  return value3 === "/" || hasNormalizedSegments(value3.slice(1), "/");
};
var isNormalizedWindowsDriveAbsolutePath = (value3) => {
  if (!/^[A-Za-z]:\\/.test(value3) || value3.includes("/"))
    return false;
  return value3.length === 3 || hasNormalizedSegments(value3.slice(3), "\\");
};
var windowsVolumeGuid = /^Volume\{[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}\\/u;
var isNormalizedWindowsVolumeAbsolutePath = (value3) => {
  if (value3.includes("/"))
    return false;
  const root = windowsVolumeGuid.exec(value3)?.[0];
  if (root === undefined)
    return false;
  const remainder2 = value3.slice(root.length);
  return remainder2.length === 0 || hasNormalizedSegments(remainder2, "\\");
};
var isNormalizedWindowsFilesystemNamespacePath = (value3) => isNormalizedWindowsDriveAbsolutePath(value3) || isNormalizedWindowsVolumeAbsolutePath(value3);
var isNormalizedWindowsShare = (value3, rootRequiresTrailingSeparator) => {
  if (value3.includes("/"))
    return false;
  const segments = value3.split("\\");
  const last = segments.at(-1);
  const body = last === "" ? segments.slice(0, -1) : segments;
  if (body.length < 2 || !body.every(isNormalizedSegment))
    return false;
  return !rootRequiresTrailingSeparator || body.length > 2 || last === "";
};
var isNormalizedWindowsUncAbsolutePath = (value3) => {
  if (value3.startsWith("\\\\?\\UNC\\"))
    return isNormalizedWindowsShare(value3.slice(8), false);
  if (value3.startsWith("\\\\?\\"))
    return isNormalizedWindowsFilesystemNamespacePath(value3.slice(4));
  if (value3.startsWith("\\\\.\\"))
    return isNormalizedWindowsFilesystemNamespacePath(value3.slice(4));
  return value3.startsWith("\\\\") && isNormalizedWindowsShare(value3.slice(2), true);
};
var isAbsolutePath = (value3) => value3.length > 0 && !value3.includes("\x00") && (isNormalizedPosixAbsolutePath(value3) || isNormalizedWindowsDriveAbsolutePath(value3) || isNormalizedWindowsUncAbsolutePath(value3));
var AbsolutePath = exports_Schema.String.pipe(exports_Schema.check(exports_Schema.makeFilter((value3) => isAbsolutePath(value3) ? true : "path must be absolute, normalized, non-empty, and contain no NUL")), exports_Schema.brand("effect-build/Artifact/AbsolutePath"));
var windowsReserved = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/iu;
var windowsForbidden = /[<>:"|?*]/u;
var isPortableRelativePath = (value3) => {
  if (value3.length === 0 || value3.normalize("NFC") !== value3 || value3.includes("\\") || value3.startsWith("/") || value3.endsWith("/") || value3.includes("\x00"))
    return false;
  return value3.split("/").every((component) => component.length > 0 && component !== "." && component !== ".." && !windowsForbidden.test(component) && !Array.from(component).some((character) => character.charCodeAt(0) <= 31) && !component.endsWith(".") && !component.endsWith(" ") && !windowsReserved.test(component));
};
var PortableRelativePath = exports_Schema.String.pipe(exports_Schema.check(exports_Schema.makeFilter((value3) => isPortableRelativePath(value3) ? true : "path is not portable and relative")), exports_Schema.brand("effect-build/Artifact/PortableRelativePath"));
var isRecord = (value3) => typeof value3 === "object" && value3 !== null && !Array.isArray(value3);
var isDecimalBytes = (value3) => typeof value3 === "string" && /^(?:0|[1-9][0-9]*)$/u.test(value3);
var isDigest = (value3) => isRecord(value3) && value3.algorithm === "sha256" && typeof value3.value === "string" && /^[0-9a-f]{64}$/u.test(value3.value);
var isAbsolute = exports_Schema.is(AbsolutePath);
var isPortable = exports_Schema.is(PortableRelativePath);
var isContentIdentity = (value3) => isRecord(value3) && isDecimalBytes(value3.bytes) && isDigest(value3.digest);
var isParticipantIdentity = (value3) => isRecord(value3) && [value3.role, value3.name, value3.version, value3.revision, value3.channel].every((field) => typeof field === "string" && field.length > 0 && !field.includes("\x00")) && isContentIdentity(value3.content);
var isCapabilityObservation = (value3) => {
  if (!isRecord(value3) || typeof value3.id !== "string" || value3.id.length === 0)
    return false;
  if (value3._tag === "Present")
    return typeof value3.evidence === "string";
  if (value3._tag === "Missing" || value3._tag === "Indeterminate")
    return typeof value3.reason === "string";
  return false;
};
var isToolObservation = (value3) => isRecord(value3) && typeof value3.name === "string" && value3.name.length > 0 && Array.isArray(value3.participants) && value3.participants.length > 0 && value3.participants.every(isParticipantIdentity) && Array.isArray(value3.capabilities) && value3.capabilities.every(isCapabilityObservation);
var isProvenance = (value3) => isToolObservation(value3) || isRecord(value3) && value3._tag === "IntrinsicProvenance" && typeof value3.producer === "string" && value3.producer.length > 0 && !value3.producer.includes("\x00");
var isDirectFilePublication = (value3) => isRecord(value3) && value3.scope === "file" && value3.commit === "same-parent-no-replace-link" && value3.committed === true;
var isTreePublication = (value3) => isRecord(value3) && value3.scope === "tree" && value3.commit === "same-parent-rename" && value3.committed === true;
var projectedFilePath = (root, relativePath) => {
  const separator = root.startsWith("/") ? "/" : "\\";
  return `${root.endsWith(separator) ? root : `${root}${separator}`}${relativePath.replaceAll("/", separator)}`;
};
var isTreeFileProjectionPublication = (value3, filePath) => isRecord(value3) && value3.scope === "tree-file-projection" && value3.commit === "same-parent-rename" && value3.committed === true && typeof value3.treeRoot === "string" && isAbsolute(value3.treeRoot) && typeof value3.relativePath === "string" && isPortable(value3.relativePath) && isDigest(value3.treeManifestDigest) && projectedFilePath(value3.treeRoot, value3.relativePath) === filePath;
var isUnhashedFileIdentity = (value3) => isRecord(value3) && typeof value3.path === "string" && isAbsolute(value3.path) && isDecimalBytes(value3.bytes);
var isHashedFileIdentity = (value3) => isRecord(value3) && isUnhashedFileIdentity(value3) && isDigest(value3.digest);
var isHashedFileObservation = (value3) => isRecord(value3) && isHashedFileIdentity(value3) && value3._tag === "HashedFileObservation" && value3.kind === "file";
var isHashedFile = (value3) => isRecord(value3) && isHashedFileIdentity(value3) && value3._tag === "HashedFile" && isProvenance(value3.provenance) && (isDirectFilePublication(value3.publication) || isTreeFileProjectionPublication(value3.publication, value3.path));
var isFileMode = (value3) => typeof value3 === "number" && Number.isInteger(value3) && value3 >= 0 && value3 <= 4095;
var FileModeSchema = exports_Schema.declare(isFileMode, { title: "FileMode" });
var pathEncoder = new TextEncoder;
var comparePortablePath = (left, right) => {
  const a = pathEncoder.encode(left);
  const b = pathEncoder.encode(right);
  const length = Math.min(a.byteLength, b.byteLength);
  for (let index2 = 0;index2 < length; index2++) {
    const difference3 = (a[index2] ?? 0) - (b[index2] ?? 0);
    if (difference3 !== 0)
      return difference3;
  }
  return a.byteLength - b.byteLength;
};
var isTreeEntry = (value3) => {
  if (!isRecord(value3) || typeof value3.relativePath !== "string" || !isPortable(value3.relativePath))
    return false;
  if (value3.kind === "directory")
    return isFileMode(value3.mode);
  if (value3.kind === "symbolic-link") {
    return typeof value3.target === "string" && value3.target.length > 0 && !value3.target.includes("\x00");
  }
  return value3.kind === "file" && isFileMode(value3.mode) && isDecimalBytes(value3.bytes) && isDigest(value3.digest);
};
var hasCanonicalTreeEntries = (entries3) => {
  let previous;
  const folded = new Set;
  for (const entry of entries3) {
    if (previous !== undefined && comparePortablePath(previous, entry.relativePath) >= 0)
      return false;
    previous = entry.relativePath;
    const key = entry.relativePath.toLowerCase();
    if (folded.has(key))
      return false;
    folded.add(key);
  }
  return true;
};
var isHashedTreeObservation = (value3) => {
  if (!isRecord(value3) || value3._tag !== "HashedTreeObservation" || typeof value3.root !== "string" || !isAbsolute(value3.root) || !isFileMode(value3.rootMode) || !Array.isArray(value3.entries) || !value3.entries.every(isTreeEntry) || !isDecimalBytes(value3.totalBytes) || !isDigest(value3.manifestDigest))
    return false;
  if (!hasCanonicalTreeEntries(value3.entries))
    return false;
  const observedTotal = value3.entries.reduce((total, entry) => entry.kind === "file" ? total + BigInt(entry.bytes) : total, 0n);
  return `${observedTotal}` === value3.totalBytes;
};
var isHashedTree = (value3) => isRecord(value3) && value3._tag === "HashedTree" && isHashedTreeObservation({ ...value3, _tag: "HashedTreeObservation" }) && isProvenance(value3.provenance) && isTreePublication(value3.publication);
var isHashedExecutable = (value3) => {
  if (!isRecord(value3) || value3._tag !== "HashedExecutable" || !isHashedFileIdentity(value3) || !isProvenance(value3.provenance) || !isDirectFilePublication(value3.publication) || value3.nativeFormat !== "elf" && value3.nativeFormat !== "mach-o" && value3.nativeFormat !== "pe" || !isRecord(value3.runtime) || typeof value3.runtime.name !== "string" || value3.runtime.name.length === 0 || typeof value3.runtime.version !== "string" || value3.runtime.version.length === 0 || typeof value3.target !== "string")
    return false;
  return exports_Schema.is(SystemTarget)(value3.target) && describe(value3.target).nativeFormat === value3.nativeFormat;
};
var DecimalBytesSchema = exports_Schema.declare(isDecimalBytes, { title: "DecimalBytes" });
var DigestSchema = exports_Schema.declare(isDigest, { title: "Sha256Digest" });
var ProvenanceSchema = exports_Schema.declare(isProvenance, { title: "ArtifactProvenance" });
var HashedFileObservationSchema = exports_Schema.declare(isHashedFileObservation, {
  title: "HashedFileObservation"
});
var HashedFileSchema = exports_Schema.declare(isHashedFile, { title: "HashedFile" });
var HashedTreeObservationSchema = exports_Schema.declare(isHashedTreeObservation, {
  title: "HashedTreeObservation"
});
var HashedTreeSchema = exports_Schema.declare(isHashedTree, { title: "HashedTree" });
var HashedExecutableSchema = exports_Schema.declare(isHashedExecutable, {
  title: "HashedExecutable"
});

// packages/ts-release/dist/internal/ArtifactModel.js
var Decimal = String5.check(isPattern2(/^(0|[1-9][0-9]*)$/));
var Sha256 = String5.check(isPattern2(/^[0-9a-f]{64}$/));

class AdoptionError extends TaggedError3()("AdoptionError", {
  reason: String5
}) {
  get message() {
    return this.reason;
  }
}

class Content extends Class3("ts-release/Content")({
  bytes: Decimal,
  sha256: Sha256
}) {
}

class OwnedFile extends TaggedClass()("OwnedFile", {
  logicalName: PortableRelativePath,
  content: Content,
  deliveryMode: FileModeSchema,
  executable: NullOr(Struct({
    nativeFormat: Literals(["elf", "mach-o", "pe"]),
    runtime: Struct({ name: NonEmptyString, version: NonEmptyString }),
    target: SystemTarget
  })),
  provenance: ProvenanceSchema
}) {
}

class TreeFile extends TaggedClass()("TreeFile", {
  relativePath: PortableRelativePath,
  mode: FileModeSchema,
  content: Content
}) {
}

class TreeDirectory extends TaggedClass()("TreeDirectory", {
  relativePath: PortableRelativePath,
  mode: FileModeSchema
}) {
}

class TreeLink extends TaggedClass()("TreeLink", {
  relativePath: PortableRelativePath,
  target: String5
}) {
}
var MAX_BUFFERED_TREE_BYTES = 512n * 1024n * 1024n;
var MAX_TREE_ENTRIES = 1e5;

class OwnedTree extends TaggedClass()("OwnedTree", {
  logicalName: PortableRelativePath,
  rootMode: FileModeSchema,
  totalBytes: Decimal,
  upstreamManifestSha256: Sha256,
  entries: ArraySchema(Union2([TreeFile, TreeDirectory, TreeLink])),
  provenance: ProvenanceSchema
}) {
}
var OwnedArtifact = Union2([OwnedFile, OwnedTree]);

class OwnedBundle extends Class3("ts-release/Bundle")({
  format: Literal2("ts-release/bundle/1"),
  artifacts: ArraySchema(OwnedArtifact)
}) {
}

// packages/ts-release/dist/internal/Identity.js
var compareText = (left, right) => {
  const a = [...left], b = [...right];
  for (let index2 = 0;index2 < Math.min(a.length, b.length); index2++) {
    const difference3 = a[index2].codePointAt(0) - b[index2].codePointAt(0);
    if (difference3)
      return difference3;
  }
  return a.length - b.length;
};
var canonical = (input) => {
  const active = new Set;
  const visit = (value3) => {
    if (value3 === null || typeof value3 === "boolean")
      return JSON.stringify(value3);
    if (typeof value3 === "string") {
      if (value3 !== value3.normalize("NFC"))
        fail7("noncanonical-string", "Strings must already be NFC");
      if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value3))
        fail7("invalid-string", "Unpaired surrogate");
      return JSON.stringify(value3);
    }
    if (typeof value3 === "number" && Number.isSafeInteger(value3) && !Object.is(value3, -0))
      return String(value3);
    if (typeof value3 !== "object" || value3 === null)
      return fail7("invalid-json", "Only canonical JSON values and safe integers are allowed");
    if (active.has(value3))
      fail7("cyclic-data", "Canonical data cannot contain cycles");
    active.add(value3);
    const array3 = Array.isArray(value3);
    const keys3 = Reflect.ownKeys(value3).filter((key) => !(array3 && key === "length"));
    for (const key of keys3) {
      const descriptor = Object.getOwnPropertyDescriptor(value3, key);
      if (typeof key !== "string" || !descriptor.enumerable || !("value" in descriptor))
        fail7("hidden-data", "Canonical data cannot contain symbols, hidden properties or accessors");
    }
    let encoded;
    if (array3) {
      if (keys3.length !== value3.length || keys3.some((key, index2) => key !== String(index2)))
        fail7("invalid-json-array", "Arrays must be dense and contain only indexed elements");
      encoded = `[${value3.map(visit).join(",")}]`;
    } else {
      const prototype = Object.getPrototypeOf(value3);
      const constructor = prototype && Object.getOwnPropertyDescriptor(prototype, "constructor")?.value;
      if (prototype !== null && prototype !== Object.prototype && !exports_Schema.isSchema(constructor))
        fail7("invalid-json-object", "Only plain records and Schema classes are canonical data");
      encoded = `{${keys3.sort().map((key) => `${visit(key)}:${visit(Object.getOwnPropertyDescriptor(value3, key).value)}`).join(",")}}`;
    }
    active.delete(value3);
    return encoded;
  };
  return visit(input);
};
var copyData = (input) => JSON.parse(canonical(input));
var freeze = (value3) => {
  if (value3 !== null && typeof value3 === "object") {
    Object.values(value3).forEach(freeze);
    Object.freeze(value3);
  }
  return value3;
};
var decodeOwned = (codec, input) => freeze(exports_Schema.decodeUnknownSync(codec, { onExcessProperty: "error" })(copyData(input)));
var sha256 = exports_Effect.fn("ts-release.sha256")(function* (bytes) {
  const digest = yield* exports_Effect.tryPromise({
    try: () => globalThis.crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
    catch: () => failure("digest-failed", "Host WebCrypto SHA-256 failed")
  });
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
});
var hashCanonical = exports_Effect.fn("ts-release.hashCanonical")(function* (domain, value3) {
  const encoded = yield* attempt(() => canonical(value3));
  const utf8 = new TextEncoder;
  const framed = `${utf8.encode(domain).length}:${domain}${utf8.encode(encoded).length}:${encoded}`;
  return yield* sha256(utf8.encode(framed));
});

// packages/ts-release/dist/internal/ReleaseModel.js
class Operation extends Class3("ReleaseOperation")({
  operationId: String5,
  definitionId: String5,
  intentVersion: String5,
  intent: Unknown2,
  dependsOn: ArraySchema(String5)
}) {
}

class Plan extends Class3("ReleasePlan")({
  format: Literal2("ts-release/plan/1"),
  planId: String5,
  journalId: String5,
  bundleId: String5,
  operations: ArraySchema(Operation)
}) {
}

class NoReplay extends TaggedClass()("None", {}) {
}

class GitCas extends TaggedClass()("GitCas", {
  ref: String5,
  expectedOld: String5,
  desiredNew: String5
}) {
}
var ReplayProtection = Union2([NoReplay, GitCas]);

class RequestFacts extends Class3("ReleaseRequestFacts")({
  transport: Literals(["core.http/1", "core.git/1", "opaque/1"]),
  endpoint: String5,
  method: String5,
  headers: ArraySchema(Tuple([String5, String5])),
  bodyDigest: String5,
  byteLength: String5,
  principal: String5,
  scope: String5,
  replay: ReplayProtection
}) {
}

class Initial extends TaggedClass()("Initial", {}) {
}

class NonCommit extends TaggedClass()("NonCommit", {
  dispatchIds: ArraySchema(String5)
}) {
}

class ProtectedReplay extends TaggedClass()("ProtectedReplay", {
  dispatchIds: ArraySchema(String5)
}) {
}

class AcceptedRisk extends TaggedClass()("AcceptedRisk", {
  decisionId: String5
}) {
}
var DispatchBasis = Union2([Initial, NonCommit, ProtectedReplay, AcceptedRisk]);

class DispatchStarted extends TaggedClass()("DispatchStarted", {
  operationId: String5,
  dispatchId: String5,
  request: RequestFacts,
  fingerprint: String5,
  startedAt: Number6,
  basis: DispatchBasis
}) {
}

class DispatchRejectedBeforeCommit extends TaggedClass()("DispatchRejectedBeforeCommit", {
  dispatchId: String5,
  proofVersion: String5,
  proof: Unknown2
}) {
}

class ReceiptAccepted extends TaggedClass()("ReceiptAccepted", {
  dispatchId: String5,
  receiptVersion: String5,
  status: Literals(["Satisfied", "Pending"]),
  receipt: Unknown2
}) {
}
var ObservationStatus = Literals([
  "Satisfied",
  "Conflict",
  "Pending",
  "Inconclusive",
  "Absent"
]);

class ObservationRecorded extends TaggedClass()("ObservationRecorded", {
  operationId: String5,
  evidenceKind: Literals(["Observation", "DispatchError"]),
  dispatchId: optionalKey2(String5),
  status: ObservationStatus,
  evidenceVersion: String5,
  evidence: Unknown2,
  observedAt: Number6
}) {
}

class RiskAccepted extends TaggedClass()("RiskAccepted", {
  operationId: String5,
  decisionId: String5,
  fingerprint: String5,
  priorDispatchIds: ArraySchema(String5),
  principal: String5,
  expiresAt: Number6
}) {
}

class PlanSuperseded extends TaggedClass()("PlanSuperseded", {
  reason: String5
}) {
}
var EventBody = Union2([
  DispatchStarted,
  DispatchRejectedBeforeCommit,
  ReceiptAccepted,
  ObservationRecorded,
  RiskAccepted,
  PlanSuperseded
]);

class JournalEvent extends Class3("ReleaseJournalEvent")({
  format: Literal2("ts-release/event/1"),
  eventId: String5,
  journalId: String5,
  planId: String5,
  body: EventBody
}) {
}

class CoreDispatchError extends Class3("CoreDispatchError")({
  code: Literals(["transport-error", "outcome-unknown", "unverified-noncommit"]),
  message: Literals([
    "Transport failed after dispatch began",
    "Transport did not provide a verifiable outcome",
    "Transport supplied no declared native proof of terminal noncommit"
  ])
}) {
}

class CoreUndecodableReceipt extends Class3("CoreUndecodableReceipt")({
  code: Literal2("undecodable-receipt"),
  message: Literal2("Committed response could not be admitted by the installed provider"),
  receiptSha256: NullOr(String5.check(isPattern2(/^[0-9a-f]{64}$/))),
  receiptBytes: NullOr(String5.check(isPattern2(/^(0|[1-9][0-9]*)$/), isMaxLength(20)))
}) {
}

// packages/ts-release/dist/Provider.js
var PROVIDER_CONTRACT = "ts-release/provider/1";
var evidenceContext = (plan, operation, history) => {
  const events = history.filter((event) => event.planId === plan.planId);
  const evidenceFor = (operation2) => {
    const starts = new Set(events.flatMap(({ body }) => body._tag === "DispatchStarted" && body.operationId === operation2.operationId ? [body.dispatchId] : []));
    return {
      operation: operation2,
      receipts: events.flatMap(({ body }) => body._tag === "ReceiptAccepted" && starts.has(body.dispatchId) ? [body.receipt] : []),
      observations: events.flatMap(({ body }) => body._tag === "ObservationRecorded" && body.operationId === operation2.operationId ? [{ status: body.status, evidence: body.evidence }] : [])
    };
  };
  return freeze({
    own: evidenceFor(operation),
    dependencies: operation.dependsOn.map((id2) => {
      const dependency = plan.operations.find((item) => item.operationId === id2);
      if (!dependency)
        fail7("missing-dependency", "Evidence dependency is not in this plan");
      return evidenceFor(dependency);
    })
  });
};
var assertRequestCorresponds = (provider, operation, request3, context3) => {
  if (provider.requestCorresponds && provider.requestCorresponds(operation, request3, context3) !== true)
    fail7("request-correspondence", "Request's preceding dependency differs from declared dependency");
};
var requestFingerprint = (facts) => hashCanonical("ts-release/request/1", facts);
var makeRequest = exports_Effect.fn("ts-release.makeRequest")(function* (input) {
  const { body, fields } = yield* attempt(() => {
    const { body: _, ...fields2 } = input;
    return { body: new Uint8Array(input.body), fields: copyData(fields2) };
  });
  const bodyDigest = yield* sha256(body);
  const facts = yield* attempt(() => decodeOwned(RequestFacts, { ...fields, bodyDigest, byteLength: String(body.byteLength) }));
  return { facts, body };
});
var verifyRequest = exports_Effect.fn("ts-release.verifyRequest")(function* (request3) {
  const { facts, body } = yield* attempt(() => ({
    facts: decodeOwned(RequestFacts, request3.facts),
    body: new Uint8Array(request3.body)
  }));
  if (facts.byteLength !== String(body.byteLength) || facts.bodyDigest !== (yield* sha256(body)))
    return yield* reject("request-bytes", "Prepared bytes do not match recorded facts");
  yield* attempt(() => {
    canonical(facts);
    if (facts.headers.some(([name]) => /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|x-auth-token)$/iu.test(name)))
      fail7("secret-header", "Authentication header bytes must remain in the host transport closure");
    if (facts.replay._tag === "GitCas" && (facts.transport !== "core.git/1" || facts.method !== "update-ref"))
      fail7("untrusted-replay", "Only core conditional Git updates can carry structural replay protection");
  });
  return { facts, body };
});
var CORE_ERROR_VERSIONS = new Set([
  "core-dispatch-error/1",
  "core-undecodable-receipt/1"
]);
var isCoreErrorVersion = (version) => CORE_ERROR_VERSIONS.has(version);
var isVersion = (value3) => typeof value3 === "string" && value3.length > 0;
var isFunction2 = (value3) => typeof value3 === "function";
var captureBoundary = (boundary) => {
  if (!boundary)
    return;
  if (!isVersion(boundary.version) || !exports_Schema.isSchema(boundary.codec) || !isFunction2(boundary.corresponds) || isCoreErrorVersion(boundary.version))
    fail7("failure-codec", "Native failure boundaries require a complete versioned codec");
  canonical(boundary.version);
  return Object.freeze({
    version: boundary.version,
    codec: boundary.codec,
    corresponds: boundary.corresponds.bind(boundary)
  });
};
var verifyDescriptor = (provider) => {
  if (![provider.definitionId, provider.intentVersion].every(isVersion) || !exports_Schema.isSchema(provider.intentCodec) || provider.validatePlan !== undefined && !isFunction2(provider.validatePlan))
    fail7("intent-codec", "Provider identity and intent codec are required");
  canonical([provider.definitionId, provider.intentVersion]);
};
var captureDescriptor = (provider) => {
  verifyDescriptor(provider);
  return Object.freeze({
    definitionId: provider.definitionId,
    intentVersion: provider.intentVersion,
    intentCodec: provider.intentCodec,
    ...provider.validatePlan && { validatePlan: provider.validatePlan.bind(provider) }
  });
};
var verifyProviderContracts = (providers) => {
  const captured = [];
  for (const provider of providers) {
    const dispatchError = captureBoundary(provider.dispatchError), rejection = captureBoundary(provider.rejection);
    if (provider.contract !== PROVIDER_CONTRACT)
      fail7("provider-contract", "Provider and kernel contract versions differ");
    const descriptor = captureDescriptor(provider);
    if (!isVersion(provider.receiptVersion) || !exports_Schema.isSchema(provider.receiptCodec) || ![provider.receiptCorresponds, provider.classifyReceipt, provider.prepare].every(isFunction2) || provider.requestCorresponds !== undefined && !isFunction2(provider.requestCorresponds))
      fail7("missing-receipt-codec", "Native receipt codec, classification, correspondence and prepare are mandatory");
    canonical(provider.receiptVersion);
    const observation = [
      provider.observe,
      provider.observationVersion,
      provider.observationCodec,
      provider.classifyObservation
    ];
    if (observation.some((value3) => value3 !== undefined) && (!isFunction2(provider.observe) || !isFunction2(provider.classifyObservation) || !isVersion(provider.observationVersion) || !exports_Schema.isSchema(provider.observationCodec)))
      fail7("missing-observation-codec", "Observation requires a complete callable operation, native codec and classifier");
    if (provider.observationVersion !== undefined)
      canonical(provider.observationVersion);
    captured.push(Object.freeze({
      contract: provider.contract,
      ...descriptor,
      ...provider.requestCorresponds && {
        requestCorresponds: provider.requestCorresponds.bind(provider)
      },
      receiptVersion: provider.receiptVersion,
      receiptCodec: provider.receiptCodec,
      receiptCorresponds: provider.receiptCorresponds.bind(provider),
      classifyReceipt: provider.classifyReceipt.bind(provider),
      prepare: provider.prepare.bind(provider),
      ...provider.observe && {
        observationVersion: provider.observationVersion,
        observationCodec: provider.observationCodec,
        classifyObservation: provider.classifyObservation.bind(provider),
        observe: provider.observe.bind(provider)
      },
      ...rejection && { rejection },
      ...dispatchError && { dispatchError }
    }));
  }
  return Object.freeze(captured);
};
var decodeObservationEvidence = (provider, body) => {
  if (body.evidenceKind === "DispatchError") {
    if (!body.dispatchId || body.status !== "Inconclusive")
      fail7("dispatch-error-shape", "Dispatch error must be inconclusive and identify its dispatch");
    const codec = body.evidenceVersion === "core-dispatch-error/1" ? CoreDispatchError : body.evidenceVersion === "core-undecodable-receipt/1" ? CoreUndecodableReceipt : provider.dispatchError?.version === body.evidenceVersion ? provider.dispatchError.codec : undefined;
    if (!codec)
      fail7("unknown-error-codec", "Native dispatch error version is unavailable");
    return nativeEvidence(codec, body.evidence);
  }
  if (body.dispatchId !== undefined)
    fail7("observation-shape", "Ordinary observation cannot assert a dispatch identity");
  if (!provider.observationCodec || !provider.classifyObservation || body.evidenceVersion !== provider.observationVersion)
    fail7("unknown-observation-codec", "Native observation version is unavailable");
  return nativeEvidence(provider.observationCodec, body.evidence);
};
var nativeEvidence = (codec, input) => {
  const value3 = exports_Schema.decodeUnknownSync(codec, { onExcessProperty: "error" })(input);
  const encoded = exports_Schema.encodeSync(codec)(value3);
  if (canonical(encoded) !== canonical(input))
    fail7("native-evidence-canonical", "Evidence must use its exact native encoding");
  return value3;
};

// packages/ts-release/dist/internal/GitAuthority.js
class GitReceipt extends exports_Schema.Class("ReleaseGitReceipt")({
  kind: exports_Schema.Literal("git-push"),
  ref: exports_Schema.String,
  desiredNew: exports_Schema.String,
  porcelain: exports_Schema.String
}) {
}
var validRef = (ref) => /^refs\/(?:heads|tags)\/[A-Za-z0-9][A-Za-z0-9/_.-]*$/u.test(ref) && !ref.includes("..") && !ref.split("/").some((part) => !part || part.startsWith(".") || part.endsWith(".") || part.endsWith(".lock"));
var authorityKey = (principal, scope3) => JSON.stringify([principal, scope3]);
var mechanisms = new WeakMap;
var captureTransport = (transport) => {
  if (mechanisms.has(transport))
    return transport;
  const { send, prepare } = transport;
  if (typeof send !== "function" || prepare !== undefined && typeof prepare !== "function")
    fail7("transport-capability", "Transport send and any declared preparation must be callable");
  return Object.freeze({
    send: send.bind(transport),
    ...prepare === undefined ? {} : { prepare: prepare.bind(transport) }
  });
};
var assertTransportBinding = (transport, facts) => {
  if (facts.replay._tag !== "GitCas")
    return;
  const bindings = mechanisms.get(transport);
  if (!bindings)
    fail7("untrusted-replay", "Conditional Git replay requires the captured core Git mechanism");
  if (!bindings.has(authorityKey(facts.principal, facts.scope)))
    fail7("transport-authority", "Request authority differs from the captured Git credentials");
  if (facts.transport !== "core.git/1" || facts.method !== "update-ref" || facts.byteLength !== "0" || facts.headers.length !== 0)
    fail7("git-request", "Git updates have only native ref arguments and no HTTP payload");
  const { ref, expectedOld, desiredNew } = facts.replay;
  if (!validRef(ref))
    fail7("git-ref", "Conditional Git request has an invalid ref");
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(expectedOld) || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(desiredNew) || expectedOld.length !== desiredNew.length || /^0+$/u.test(desiredNew))
    fail7("git-oid", "Conditional Git request requires full native object IDs");
  if (!facts.endpoint || facts.endpoint.startsWith("-") || /[\u0000-\u0020]/u.test(facts.endpoint))
    fail7("git-endpoint", "Git endpoint must be one literal argument");
};

// packages/ts-release/dist/Plan.js
var createOperation = exports_Effect.fn("ts-release.createOperation")(function* (provider, intent, dependsOn = []) {
  yield* attempt(() => verifyDescriptor(provider));
  const encoded = yield* attempt(() => {
    const decoded = exports_Schema.decodeUnknownSync(provider.intentCodec, { onExcessProperty: "error" })(copyData(intent));
    return copyData(exports_Schema.encodeSync(provider.intentCodec)(decoded));
  });
  const value3 = {
    definitionId: provider.definitionId,
    intentVersion: provider.intentVersion,
    intent: encoded
  };
  const operationId = yield* hashCanonical("ts-release/operation/1", value3);
  return freeze(new Operation({ operationId, ...value3, dependsOn: [...dependsOn].sort() }));
});
var validateDag = (operations) => {
  const index2 = new Map;
  for (const operation of operations) {
    if (index2.has(operation.operationId))
      fail7("duplicate-operation", "Operation IDs must be unique");
    if (operation.dependsOn.length !== new Set(operation.dependsOn).size)
      fail7("duplicate-dependency", "Dependencies must be unique");
    if (canonical(operation.dependsOn) !== canonical([...operation.dependsOn].sort()))
      fail7("dependency-order", "Dependencies must be sorted");
    index2.set(operation.operationId, operation);
  }
  const active = new Set;
  const done4 = new Set;
  const visit = (id2) => {
    if (active.has(id2))
      fail7("cyclic-plan", "Plan dependencies contain a cycle");
    if (done4.has(id2))
      return;
    const operation = index2.get(id2);
    if (!operation)
      fail7("missing-dependency", "Plan has a dangling dependency");
    active.add(id2);
    for (const dependency of operation.dependsOn)
      visit(dependency);
    active.delete(id2);
    done4.add(id2);
  };
  for (const id2 of index2.keys())
    visit(id2);
};
var planValue = (bundleId, operations) => ({
  format: "ts-release/plan/1",
  bundleId,
  operations: [...operations].sort((a, b) => a.operationId < b.operationId ? -1 : 1)
});
var createPlan = exports_Effect.fn("ts-release.createPlan")(function* (bundleId, operations, journalId) {
  operations = yield* attempt(() => decodeOwned(exports_Schema.Array(Operation), operations));
  yield* attempt(() => validateDag(operations));
  for (const operation of operations) {
    const expected = yield* hashCanonical("ts-release/operation/1", {
      definitionId: operation.definitionId,
      intentVersion: operation.intentVersion,
      intent: operation.intent
    });
    if (expected !== operation.operationId)
      return yield* reject("operation-identity", "Operation does not match its canonical intent");
  }
  const content = planValue(bundleId, operations);
  const value3 = {
    ...content,
    journalId: journalId ?? (yield* hashCanonical("ts-release/journal/1", content))
  };
  const planId = yield* hashCanonical("ts-release/plan/1", value3);
  return freeze(new Plan({ planId, ...value3 }));
});
var createPreparationScope = exports_Effect.fn("ts-release.createPreparationScope")(function* (provider, input, journalId) {
  const operation = yield* createOperation(provider, input);
  const plan = yield* createPlan(`preparation:${operation.operationId}`, [operation], journalId);
  return { _tag: "PreparationScope", plan };
});
var loadPlan = exports_Effect.fn("ts-release.loadPlan")(function* (input, providers) {
  const { plan, definitions } = yield* attempt(() => {
    const definitions2 = new Map;
    for (const provider of providers) {
      const captured = captureDescriptor(provider);
      if (definitions2.has(captured.definitionId))
        fail7("duplicate-provider", "Provider definition IDs must be unique");
      definitions2.set(captured.definitionId, captured);
    }
    const plan2 = decodeOwned(Plan, input);
    validateDag(plan2.operations);
    if (canonical(plan2.operations) !== canonical(planValue(plan2.bundleId, plan2.operations).operations))
      fail7("operation-order", "Operations must be sorted");
    return { plan: plan2, definitions: definitions2 };
  });
  for (const operation of plan.operations) {
    const provider = definitions.get(operation.definitionId);
    if (!provider || provider.intentVersion !== operation.intentVersion)
      return yield* reject("unknown-provider-codec", "Provider or intent version is unavailable");
    const rebuilt2 = yield* createOperation(provider, operation.intent, operation.dependsOn);
    if (rebuilt2.operationId !== operation.operationId)
      return yield* reject("operation-identity", "Operation does not match its canonical intent");
  }
  const rebuilt = yield* createPlan(plan.bundleId, plan.operations, plan.journalId);
  if (rebuilt.planId !== plan.planId)
    return yield* reject("plan-identity", "Plan ID mismatch");
  yield* attempt(() => {
    for (const provider of definitions.values()) {
      if (provider.validatePlan?.(rebuilt.operations) !== undefined)
        fail7("plan-validation", "Complete-plan admission must finish synchronously");
    }
  });
  return freeze(plan);
});

// node_modules/effect/dist/Logger.js
var LogToStderr2 = LogToStderr;

// packages/ts-release/dist/platform/Application.js
var import_node_path = require("node:path");
var import_node_url = require("node:url");

// packages/ts-release/dist/Journal.js
var verifyPreparationSelection = (events) => {
  const selected = new Map;
  const starts = new Map;
  for (const { body } of events) {
    if (body._tag === "DispatchStarted")
      starts.set(body.dispatchId, body.operationId);
    if (body._tag !== "ObservationRecorded" && body._tag !== "ReceiptAccepted" || body.status !== "Satisfied")
      continue;
    const operationId = body._tag === "ObservationRecorded" ? body.operationId : starts.get(body.dispatchId);
    if (operationId === undefined)
      fail7("unknown-dispatch", "Preparation output has no matching dispatch");
    const encoded = body._tag === "ObservationRecorded" ? canonical({
      kind: body.evidenceKind,
      version: body.evidenceVersion,
      value: body.evidence
    }) : canonical({ kind: "Receipt", version: body.receiptVersion, value: body.receipt });
    const prior = selected.get(operationId);
    if (prior !== undefined && prior !== encoded)
      fail7("preparation-selected", "This preparation already selected different satisfied evidence");
    selected.set(operationId, encoded);
  }
};
var verifyNativeEvidence = (plan, events, providers) => {
  const starts = new Map;
  const receipts = new Map;
  const definition = (operationId) => {
    const operation = plan.operations.find((item) => item.operationId === operationId);
    if (!operation)
      fail7("unknown-operation", "Evidence references an unknown operation");
    return {
      operation,
      provider: providers.find((item) => item.definitionId === operation.definitionId)
    };
  };
  const dispatched = (dispatchId, kind) => {
    const start = starts.get(dispatchId);
    if (!start)
      fail7(`unassociated-${kind}`, `${kind} has no preceding dispatch`);
    return { start, ...definition(start.operationId) };
  };
  for (let index2 = 0;index2 < events.length; index2++) {
    const { body } = events[index2];
    if (body._tag === "DispatchStarted") {
      const { operation, provider } = definition(body.operationId);
      assertRequestCorresponds(provider, operation, body.request, evidenceContext(plan, operation, events.slice(0, index2)));
      starts.set(body.dispatchId, body);
    }
    if (body._tag === "ReceiptAccepted") {
      const { start, operation, provider } = dispatched(body.dispatchId, "receipt");
      if (body.receiptVersion !== provider.receiptVersion)
        fail7("unknown-receipt-codec", "Native receipt version is unavailable");
      const receipt = nativeEvidence(provider.receiptCodec, body.receipt);
      if (!provider.receiptCorresponds(operation, start.request, receipt))
        fail7("receipt-correspondence", "Native receipt does not identify the exact dispatched request");
      if (provider.classifyReceipt(operation, start.request, receipt) !== body.status)
        fail7("receipt-classification", "Stored completion differs from native acceptance");
      receipts.set(operation.operationId, [...receipts.get(operation.operationId) ?? [], receipt]);
    }
    if (body._tag === "DispatchRejectedBeforeCommit") {
      const { start, operation, provider } = dispatched(body.dispatchId, "rejection");
      const boundary = provider.rejection;
      if (!boundary || boundary.version !== body.proofVersion)
        fail7("unknown-rejection-codec", "Native terminal noncommit proof version is unavailable");
      const proof = nativeEvidence(boundary.codec, body.proof);
      if (!boundary.corresponds(operation, start.request, proof))
        fail7("rejection-correspondence", "Terminal noncommit proof does not match the exact dispatch");
    }
    if (body._tag === "ObservationRecorded") {
      const { operation, provider } = definition(body.operationId);
      const evidence = decodeObservationEvidence(provider, body);
      if (body.evidenceKind === "DispatchError") {
        const start = starts.get(body.dispatchId);
        if (!start || start.operationId !== operation.operationId)
          fail7("error-correspondence", "Dispatch error does not identify a preceding dispatch for this operation");
        if (!isCoreErrorVersion(body.evidenceVersion) && !provider.dispatchError.corresponds(operation, start.request, evidence))
          fail7("error-correspondence", "Native dispatch error differs from the exact request");
      } else if (provider.classifyObservation(operation, evidence, receipts.get(operation.operationId) ?? [], evidenceContext(plan, operation, events.slice(0, index2))) !== body.status)
        fail7("observation-classification", "Stored classification differs from native evidence and associated receipts");
    }
  }
};

// packages/ts-release/dist/internal/Decision.js
var sameProtectedRequest = (recorded, candidate) => recorded.transport === "core.git/1" && recorded.method === "update-ref" && recorded.replay._tag === "GitCas" && canonical(recorded) === canonical(candidate);
var sameStrings = (left, right) => canonical([...left].sort()) === canonical([...right].sort());
var operationFacts = (events, operationId) => {
  const starts = [], dispatchIds = new Set, receipts = [], rejected = new Set, observations = [], risks = [], consumed = new Set;
  for (const { body } of events) {
    if (body._tag === "DispatchStarted" && body.operationId === operationId) {
      starts.push(body);
      dispatchIds.add(body.dispatchId);
      if (body.basis._tag === "AcceptedRisk")
        consumed.add(body.basis.decisionId);
    } else if (body._tag === "ReceiptAccepted" && dispatchIds.has(body.dispatchId))
      receipts.push(body);
    else if (body._tag === "DispatchRejectedBeforeCommit" && dispatchIds.has(body.dispatchId))
      rejected.add(body.dispatchId);
    else if (body._tag === "ObservationRecorded" && body.operationId === operationId)
      observations.push(body);
    else if (body._tag === "RiskAccepted" && body.operationId === operationId)
      risks.push(body);
  }
  return { starts, receipts, rejected, observations, risks, consumed };
};
var operationStatus = (events, operationId, scopeKind = "PublicationScope") => {
  if (events.some((event) => event.body._tag === "PlanSuperseded"))
    return "Superseded";
  const facts = operationFacts(events, operationId);
  if (scopeKind === "PreparationScope" && (facts.observations.some((event) => event.status === "Satisfied") || facts.receipts.some((receipt) => receipt.status === "Satisfied")))
    return "Satisfied";
  const latest = facts.observations.at(-1);
  if (latest && latest.status !== "Inconclusive" && latest.status !== "Absent")
    return latest.status;
  if (facts.receipts.some((receipt) => receipt.status === "Satisfied"))
    return "Satisfied";
  if (facts.receipts.length > 0)
    return "Pending";
  if (facts.starts.length === 0)
    return "Unattempted";
  if (facts.rejected.size === facts.starts.length)
    return "Rejected";
  return "Inconclusive";
};
var dispatchDecision = (plan, events, operationId, candidate, now2, scopeKind = "PublicationScope") => {
  const operation = plan.operations.find((item) => item.operationId === operationId);
  if (!operation)
    return fail7("unknown-operation", "Decision references an operation outside the plan");
  const status = operationStatus(events, operationId, scopeKind);
  if (["Superseded", "Satisfied", "Conflict", "Pending"].includes(status))
    return { _tag: "Finish", status };
  if (operation.dependsOn.some((dependency) => operationStatus(events, dependency, scopeKind) !== "Satisfied"))
    return { _tag: "Finish", status: "Pending" };
  if (candidate === null)
    return { _tag: "PrepareDispatch" };
  const facts = operationFacts(events, operationId);
  if (facts.receipts.length > 0)
    return { _tag: "Finish", status };
  if (facts.starts.length === 0)
    return { _tag: "AppendDispatch", basis: new Initial({}) };
  const unresolved = facts.starts.filter((start) => !facts.rejected.has(start.dispatchId));
  if (unresolved.length === 0)
    return {
      _tag: "AppendDispatch",
      basis: new NonCommit({ dispatchIds: facts.starts.map((start) => start.dispatchId).sort() })
    };
  if (unresolved.every((start) => sameProtectedRequest(start.request, candidate.facts)))
    return {
      _tag: "AppendDispatch",
      basis: new ProtectedReplay({
        dispatchIds: unresolved.map((start) => start.dispatchId).sort()
      })
    };
  const risk = facts.risks.find((decision) => !facts.consumed.has(decision.decisionId) && decision.expiresAt >= now2 && decision.fingerprint === candidate.fingerprint && sameStrings(decision.priorDispatchIds, facts.starts.map((start) => start.dispatchId)));
  return risk ? { _tag: "AppendDispatch", basis: new AcceptedRisk({ decisionId: risk.decisionId }) } : { _tag: "RequestRiskAcceptance" };
};
var assertJournalAppend = (plan, events, event, scopeKind = "PublicationScope") => {
  if (event.planId !== plan.planId || events.some((prior) => prior.eventId === event.eventId))
    fail7("journal-envelope", "Wrong plan or repeated event ID");
  const body = event.body;
  const operation = "operationId" in body ? plan.operations.find((item) => item.operationId === body.operationId) : undefined;
  if ("operationId" in body && !operation)
    fail7("unknown-operation", "Event references an operation outside the plan");
  switch (body._tag) {
    case "DispatchStarted": {
      if (!Number.isSafeInteger(body.startedAt) || body.startedAt < 0)
        fail7("dispatch-time", "Dispatch time is invalid");
      if (events.some((prior) => prior.body._tag === "DispatchStarted" && prior.body.dispatchId === body.dispatchId))
        fail7("duplicate-dispatch", "Dispatch identity is already used");
      const decision = dispatchDecision(plan, events, body.operationId, { facts: body.request, fingerprint: body.fingerprint }, body.startedAt, scopeKind);
      if (decision._tag !== "AppendDispatch" || canonical(decision.basis) !== canonical(body.basis))
        fail7("illegal-dispatch", "Historical dispatch lacks a lawful basis");
      break;
    }
    case "ReceiptAccepted":
    case "DispatchRejectedBeforeCommit": {
      const dispatch = events.flatMap(({ body: prior }) => ("dispatchId" in prior) && prior.dispatchId === body.dispatchId ? [prior] : []);
      if (!dispatch.some((prior) => prior._tag === "DispatchStarted"))
        fail7("unknown-dispatch", "Evidence has no matching dispatch");
      const opposite = body._tag === "ReceiptAccepted" ? "DispatchRejectedBeforeCommit" : "ReceiptAccepted";
      if (dispatch.some((prior) => prior._tag === opposite))
        fail7("contradictory-evidence", "Acceptance and terminal non-commit cannot describe one dispatch");
      if (dispatch.some((prior) => prior._tag === body._tag))
        fail7("duplicate-evidence", "A dispatch has one acceptance or rejection event");
      break;
    }
    case "RiskAccepted": {
      if (!Number.isSafeInteger(body.expiresAt) || body.expiresAt < 0)
        fail7("risk-time", "Risk expiry is invalid");
      if (operationStatus(events, body.operationId, scopeKind) === "Superseded")
        fail7("superseded-decision", "A superseded plan cannot accept a new risk decision");
      const facts = operationFacts(events, body.operationId);
      if (!body.principal || facts.starts.length === 0 || facts.receipts.length > 0 || !sameStrings(body.priorDispatchIds, facts.starts.map((start) => start.dispatchId)))
        fail7("risk-scope", "Risk decision must bind the complete prior attempt set");
      if (events.some((prior) => prior.body._tag === "RiskAccepted" && prior.body.decisionId === body.decisionId))
        fail7("duplicate-risk", "Decision identity is already used");
      break;
    }
    case "ObservationRecorded":
      if (!Number.isSafeInteger(body.observedAt) || body.observedAt < 0)
        fail7("observation-time", "Observation time is invalid");
      break;
    case "PlanSuperseded":
      if (events.some((prior) => prior.body._tag === "PlanSuperseded"))
        fail7("duplicate-supersession", "Plan is already superseded");
      break;
  }
};
var projectReport = (plan, events, scopeKind) => {
  return {
    planId: plan.planId,
    revision: events.length,
    superseded: events.some((event) => event.body._tag === "PlanSuperseded"),
    operations: plan.operations.map((operation) => {
      const facts = operationFacts(events, operation.operationId);
      return {
        operationId: operation.operationId,
        status: operationStatus(events, operation.operationId, scopeKind),
        dispatches: facts.starts.length,
        receipts: facts.receipts.length,
        observations: facts.observations.length
      };
    })
  };
};

class HistoryMachine {
  plan;
  events;
  scopeKind;
  constructor(plan, events, scopeKind = "PublicationScope") {
    this.plan = plan;
    this.events = events;
    this.scopeKind = scopeKind;
  }
  report() {
    return projectReport(this.plan, this.events, this.scopeKind);
  }
  next(operationId, candidate, now2) {
    return dispatchDecision(this.plan, this.events, operationId, candidate, now2, this.scopeKind);
  }
  append(event) {
    assertJournalAppend(this.plan, this.events, event, this.scopeKind);
    return new HistoryMachine(this.plan, [...this.events, event], this.scopeKind);
  }
}
var historyMachine = (plan, events, scopeKind = "PublicationScope") => events.reduce((machine, event) => machine.append(event), new HistoryMachine(plan, [], scopeKind));

// packages/ts-release/dist/internal/Host.js
class Host extends Service()("ts-release/Host") {
}
var captureHost = (input) => {
  return Object.freeze({
    store: Object.freeze({
      read: input.store.read.bind(input.store),
      append: input.store.append.bind(input.store)
    }),
    transport: captureTransport(input.transport),
    providers: verifyProviderContracts(input.providers),
    now: input.now.bind(input),
    uniqueId: input.uniqueId.bind(input),
    ...input.machine && { machine: input.machine.bind(input) },
    ...input.journal && {
      journal: Object.freeze({
        journalId: input.journal.journalId,
        scopes: Object.freeze(input.journal.scopes.map((scope3) => Object.freeze({
          _tag: scope3._tag,
          plan: decodeOwned(Plan, scope3.plan)
        })))
      })
    }
  });
};
var currentHost = exports_Effect.flatMap(Host, (host) => attempt(() => captureHost(host)));
var journalIdFor = (host, plan) => host.journal?.journalId ?? plan.journalId;
var scopeKind = (host, plan) => host.journal?.scopes.find((scope3) => scope3.plan.planId === plan.planId)?._tag ?? "PublicationScope";
var read = exports_Effect.fn("ts-release.readHistory")(function* (host, plan) {
  yield* attempt(() => {
    const now2 = host.now();
    if (!Number.isSafeInteger(now2) || now2 < 0)
      fail7("host-time", "Host time must be a nonnegative safe integer");
  });
  const journalId = journalIdFor(host, plan);
  if (journalId !== plan.journalId)
    return yield* reject("journal-binding", "Host cannot move a plan into another journal");
  const scopes = host.journal?.scopes ?? [{ _tag: "PublicationScope", plan }];
  if (scopes.filter((scope3) => scope3._tag === "PublicationScope").length > 1) {
    return yield* reject("publication-scope", "A journal admits at most one publication plan");
  }
  const registered = new Map;
  for (const scope3 of scopes) {
    if (scope3._tag !== "PreparationScope" && scope3._tag !== "PublicationScope")
      return yield* reject("scope-kind", "Unknown release scope kind");
    const admitted = yield* loadPlan(scope3.plan, host.providers);
    yield* attempt(() => {
      if (admitted.journalId !== journalId)
        fail7("journal-binding", "Every admitted scope must bind this physical journal");
      if (registered.has(admitted.planId))
        fail7("duplicate-scope", "A journal scope is registered twice");
      if (scope3._tag === "PreparationScope") {
        const operation = admitted.operations[0];
        if (admitted.operations.length !== 1 || !operation || operation.dependsOn.length !== 0 || admitted.bundleId !== `preparation:${operation.operationId}`)
          fail7("preparation-scope", "Preparation is exactly one input-bound operation without a future DAG");
      }
      registered.set(admitted.planId, admitted);
    });
  }
  if (!registered.has(plan.planId))
    return yield* reject("unregistered-scope", "Current plan is not admitted to this journal");
  const stored = yield* host.store.read(journalId);
  const snapshot = yield* attempt(() => decodeOwned(exports_Schema.Struct({ revision: exports_Schema.Number, events: exports_Schema.Array(JournalEvent) }), stored));
  yield* attempt(() => {
    if (snapshot.revision !== snapshot.events.length)
      fail7("journal-revision", "Snapshot revision does not match complete global history");
    const ids = new Set;
    for (const event of snapshot.events) {
      if (event.journalId !== journalId || !registered.has(event.planId) || ids.has(event.eventId))
        fail7("journal-envelope", "Journal contains an unknown scope, foreign root or duplicate event ID");
      ids.add(event.eventId);
    }
  });
  let selected;
  for (const admitted of registered.values()) {
    const kind = scopeKind(host, admitted);
    const scoped3 = Object.freeze(snapshot.events.filter((event) => event.planId === admitted.planId));
    for (const { body } of scoped3)
      if (body._tag === "DispatchStarted" && body.fingerprint !== (yield* requestFingerprint(body.request)))
        return yield* reject("request-fingerprint", "Historical request fingerprint mismatch");
    yield* attempt(() => verifyNativeEvidence(admitted, scoped3, host.providers));
    if (kind === "PreparationScope")
      yield* attempt(() => verifyPreparationSelection(scoped3));
    yield* attempt(() => {
      for (let index2 = 0;index2 < scoped3.length; index2++)
        assertJournalAppend(admitted, scoped3.slice(0, index2), scoped3[index2], kind);
    });
    if (admitted.planId === plan.planId)
      selected = yield* attempt(() => (host.machine ?? historyMachine)(admitted, scoped3, kind));
  }
  const events = snapshot.events;
  const machine = selected;
  return {
    plans: [...registered.values()],
    snapshot: { revision: snapshot.revision, events },
    machine,
    report: () => ({
      ...projectReport(plan, events.filter((event) => event.planId === plan.planId), scopeKind(host, plan)),
      revision: snapshot.revision
    })
  };
});

// packages/ts-release/dist/internal/TreeManifest.js
function invalid2(reason) {
  throw new AdoptionError({ reason });
}
var treeManifest = (tree) => {
  if (BigInt(tree.totalBytes) > MAX_BUFFERED_TREE_BYTES || tree.entries.length > MAX_TREE_ENTRIES)
    invalid2("Tree exceeds admitted snapshot capacity");
  const names = new Map;
  const folded = new Set;
  let previous = "", total = 0n;
  for (const entry of tree.entries) {
    if (compareText(entry.relativePath, previous) <= 0 || folded.has(entry.relativePath.toLowerCase()))
      invalid2("Tree paths are repeated, case-colliding or unsorted");
    previous = entry.relativePath;
    folded.add(entry.relativePath.toLowerCase());
    names.set(entry.relativePath, entry);
    if (entry._tag === "TreeFile")
      total += BigInt(entry.content.bytes);
  }
  if (String(total) !== tree.totalBytes)
    invalid2("Tree total differs from file identities");
  const resolve2 = (parts, base2, active) => {
    let current = [...base2];
    for (const part of parts) {
      if (current.length && names.get(current.join("/"))?._tag !== "TreeDirectory")
        invalid2("Symbolic link traverses a regular file");
      if (part === "" || part === ".")
        continue;
      if (part === "..") {
        if (!current.length)
          invalid2("Symbolic link escapes tree");
        current.pop();
        continue;
      }
      const name = [...current, part].join("/"), entry = names.get(name);
      if (!entry)
        invalid2("Symbolic link points to an absent entry");
      if (entry._tag !== "TreeLink") {
        current.push(part);
        continue;
      }
      if (active.has(name))
        invalid2("Symbolic link cycle");
      if (!entry.target || entry.target.startsWith("/") || entry.target.includes("\\") || entry.target.includes("\x00") || /^[A-Za-z]:/.test(entry.target))
        invalid2("Nonportable symbolic link");
      current = resolve2(entry.target.split("/"), current, new Set(active).add(name));
    }
    return current;
  };
  for (const entry of tree.entries) {
    const parent = entry.relativePath.split("/").slice(0, -1).join("/");
    if (parent && names.get(parent)?._tag !== "TreeDirectory")
      invalid2("Tree entry has no directory parent");
    if (entry._tag === "TreeLink")
      resolve2(entry.relativePath.split("/"), [], new Set);
  }
  const entries3 = tree.entries.map((entry) => entry._tag === "TreeFile" ? {
    kind: "file",
    relativePath: entry.relativePath,
    mode: entry.mode,
    bytes: entry.content.bytes,
    digest: { algorithm: "sha256", value: entry.content.sha256 }
  } : entry._tag === "TreeDirectory" ? { kind: "directory", relativePath: entry.relativePath, mode: entry.mode } : { kind: "symbolic-link", relativePath: entry.relativePath, target: entry.target });
  return JSON.stringify({ rootMode: tree.rootMode, totalBytes: tree.totalBytes, entries: entries3 });
};

// packages/ts-release/dist/internal/BundleFinalize.js
var adoptData = (body) => try_3({
  try: body,
  catch: (error) => error instanceof AdoptionError ? error : new AdoptionError({ reason: "Artifact data could not be admitted" })
});
var finalize = fn2("ts-release.finalizeBundle")(function* (artifacts) {
  const bundle = yield* adoptData(() => {
    const bundle2 = decodeOwned(OwnedBundle, { format: "ts-release/bundle/1", artifacts });
    const names = bundle2.artifacts.map((artifact) => artifact.logicalName.toLowerCase());
    if (new Set(names).size !== names.length)
      throw new AdoptionError({ reason: "Bundle logical names must be unique, including case" });
    return bundle2;
  });
  for (const artifact of bundle.artifacts) {
    if (artifact._tag !== "OwnedTree")
      continue;
    const manifest = yield* adoptData(() => treeManifest(artifact));
    const digest = yield* sha256(new TextEncoder().encode(manifest)).pipe(mapError3(() => new AdoptionError({ reason: "Host could not verify tree identity" })));
    if (digest !== artifact.upstreamManifestSha256)
      return yield* new AdoptionError({
        reason: "Durable tree manifest differs from upstream identity"
      });
  }
  return bundle;
});

// packages/ts-release/dist/internal/BundleCodec.js
var encodeBundle = (bundle) => new TextEncoder().encode(JSON.stringify(exports_Schema.encodeSync(OwnedBundle)(bundle)));
var loadBundle = exports_Effect.fn("ts-release.loadBundle")(function* (owner, bytes) {
  const decoded = yield* adoptData(() => {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const value3 = decodeOwned(OwnedBundle, JSON.parse(text));
    if (new TextDecoder().decode(encodeBundle(value3)) !== text)
      throw new AdoptionError({ reason: "Bundle encoding is not the exact canonical codec output" });
    return value3;
  });
  const bundle = yield* finalize(decoded.artifacts);
  for (const artifact of bundle.artifacts) {
    if (artifact._tag === "OwnedFile")
      yield* owner.verify(artifact.content);
    else
      for (const entry of artifact.entries)
        if (entry._tag === "TreeFile")
          yield* owner.verify(entry.content);
  }
  return bundle;
});

// packages/ts-release/dist/internal/FinalizedReport.js
class FinalizedReport extends exports_Schema.Class("ts-release/FinalizedReport")({
  format: exports_Schema.Literal("ts-release/report/1"),
  bundle: OwnedBundle,
  plan: Plan,
  preparations: exports_Schema.Array(Plan),
  journal: exports_Schema.Struct({
    journalId: exports_Schema.String,
    revision: exports_Schema.Number,
    events: exports_Schema.Array(JournalEvent)
  }),
  superseded: exports_Schema.Boolean,
  operations: exports_Schema.Array(exports_Schema.Struct({
    operationId: exports_Schema.String,
    status: exports_Schema.Literals([
      "Unattempted",
      "Satisfied",
      "Conflict",
      "Pending",
      "Inconclusive",
      "Rejected",
      "Superseded"
    ]),
    dispatches: exports_Schema.Number,
    receipts: exports_Schema.Number,
    observations: exports_Schema.Number
  }))
}) {
}
var reportFinalizedRelease = exports_Effect.fn("ts-release.reportFinalizedRelease")(function* (bundle, input) {
  const host = yield* currentHost;
  const admitted = yield* attempt(() => decodeOwned(OwnedBundle, bundle));
  const owned = yield* finalize(admitted.artifacts);
  const plan = yield* loadPlan(input, host.providers);
  if (plan.bundleId !== (yield* sha256(encodeBundle(owned))))
    return yield* reject("report-bundle", "Report Bundle differs from its immutable Plan");
  const current = yield* read(host, plan);
  const report = current.report();
  return yield* attempt(() => decodeOwned(FinalizedReport, {
    format: "ts-release/report/1",
    bundle: owned,
    plan,
    preparations: current.plans.filter((item) => item.planId !== plan.planId),
    journal: { journalId: plan.journalId, ...current.snapshot },
    superseded: report.superseded,
    operations: report.operations
  }));
});

// packages/ts-release/dist/Release.js
var eventFor = (host, plan, body, eventId = host.uniqueId()) => new JournalEvent({
  format: "ts-release/event/1",
  eventId,
  journalId: journalIdFor(host, plan),
  planId: plan.planId,
  body
});
var appendFact = fn2("ts-release.appendFact")(function* (host, plan, event) {
  event = yield* attempt(() => decodeOwned(JournalEvent, event));
  for (let retry3 = 0;retry3 < 8; retry3++) {
    const { snapshot, machine } = yield* read(host, plan);
    const existing = snapshot.events.find((item) => item.eventId === event.eventId);
    if (existing) {
      if (canonical(existing) !== canonical(event))
        return yield* reject("event-id-conflict", "Event ID already has different facts");
      return;
    }
    yield* attempt(() => {
      const scoped3 = [...snapshot.events.filter((item) => item.planId === plan.planId), event];
      verifyNativeEvidence(plan, scoped3, host.providers);
      if (scopeKind(host, plan) === "PreparationScope")
        verifyPreparationSelection(scoped3);
      assertJournalAppend(plan, scoped3.slice(0, -1), event, scopeKind(host, plan));
      machine.append(event);
    });
    const result3 = yield* host.store.append(journalIdFor(host, plan), snapshot.revision, event);
    if (result3._tag === "Appended" || result3._tag === "AlreadyRecorded")
      return;
  }
  return yield* reject("journal-contention", "Fact append could not be reconciled");
});
var appendBody = (host, plan, body) => appendFact(host, plan, eventFor(host, plan, body));
var appendObservation = (host, plan, body) => appendBody(host, plan, new ObservationRecorded(body));
var recordObservation = fn2("ts-release.recordObservation")(function* (host, plan, operation, provider, snapshot) {
  const observation = yield* provider.observe(operation, yield* attempt(() => evidenceContext(plan, operation, snapshot.events)));
  yield* appendObservation(host, plan, {
    operationId: operation.operationId,
    evidenceKind: "Observation",
    status: observation.status,
    evidence: observation.evidence,
    evidenceVersion: provider.observationVersion,
    observedAt: host.now()
  });
});
var reportRelease = fn2("ts-release.reportRelease")(function* (options) {
  const host = yield* currentHost;
  const plan = yield* loadPlan(options.plan, host.providers);
  return (yield* read(host, plan)).report();
});
var observeRelease = fn2("ts-release.observeRelease")(function* (options) {
  const host = yield* currentHost;
  const plan = yield* loadPlan(options.plan, host.providers);
  yield* read(host, plan);
  for (const operation of plan.operations) {
    const provider = host.providers.find((item) => item.definitionId === operation.definitionId);
    if (!provider.observe)
      continue;
    const prefix = yield* read(host, plan);
    yield* recordObservation(host, plan, operation, provider, prefix.snapshot);
  }
  return (yield* read(host, plan)).report();
});
var runRelease = fn2("ts-release.runRelease")(function* (input) {
  const options = { ...input };
  const host = yield* currentHost;
  if (typeof options.authorize !== "boolean" || options.observe !== undefined && typeof options.observe !== "boolean")
    return yield* reject("run-options", "Authorization and observation options must be booleans");
  if (options.maxDispatches !== undefined && (!Number.isSafeInteger(options.maxDispatches) || options.maxDispatches < 0))
    return yield* reject("dispatch-limit", "Dispatch limit must be a nonnegative safe integer");
  const plan = yield* loadPlan(options.plan, host.providers);
  yield* read(host, plan);
  const visited = new Set;
  let dispatches = 0;
  while (visited.size < plan.operations.length) {
    let progressed = false;
    for (const operation of plan.operations) {
      if (visited.has(operation.operationId))
        continue;
      let current = yield* read(host, plan);
      const reports = current.machine.report().operations;
      if (operation.dependsOn.some((id2) => reports.find((item) => item.operationId === id2)?.status !== "Satisfied"))
        continue;
      progressed = true;
      visited.add(operation.operationId);
      const provider = host.providers.find((item) => item.definitionId === operation.definitionId);
      if (options.observe !== false && provider.observe) {
        yield* recordObservation(host, plan, operation, provider, current.snapshot);
        current = yield* read(host, plan);
      }
      if (!options.authorize || dispatches >= (options.maxDispatches ?? plan.operations.length))
        continue;
      const first = yield* attempt(() => current.machine.next(operation.operationId, null, host.now()));
      if (first._tag !== "PrepareDispatch")
        continue;
      const context3 = yield* attempt(() => evidenceContext(plan, operation, current.snapshot.events));
      const request3 = yield* verifyRequest(yield* provider.prepare(operation, context3));
      yield* attempt(() => assertRequestCorresponds(provider, operation, request3.facts, context3));
      yield* attempt(() => assertTransportBinding(host.transport, request3.facts));
      const send = host.transport.prepare ? yield* host.transport.prepare(yield* verifyRequest(request3)) : host.transport.send;
      yield* attempt(() => {
        if (typeof send !== "function")
          fail7("transport-preparation", "Transport preparation did not return a callable send");
      });
      const fingerprint = yield* requestFingerprint(request3.facts);
      current = yield* read(host, plan);
      const startedAt = host.now();
      const next = yield* attempt(() => current.machine.next(operation.operationId, freeze({ facts: request3.facts, fingerprint }), startedAt));
      if (next._tag !== "AppendDispatch")
        continue;
      const eventId = host.uniqueId();
      const dispatchId = `${eventId}:dispatch`;
      const event = yield* attempt(() => eventFor(host, plan, new DispatchStarted({
        operationId: operation.operationId,
        dispatchId,
        request: request3.facts,
        fingerprint,
        startedAt,
        basis: next.basis
      }), eventId));
      yield* attempt(() => {
        verifyNativeEvidence(plan, [...current.snapshot.events.filter((item) => item.planId === plan.planId), event], host.providers);
        assertJournalAppend(plan, current.snapshot.events.filter((item) => item.planId === plan.planId), event, scopeKind(host, plan));
        current.machine.append(event);
      });
      const appended = yield* host.store.append(journalIdFor(host, plan), current.snapshot.revision, event);
      let owned = appended._tag === "Appended";
      if (appended._tag === "AmbiguousStorageOutcome") {
        const reconciled = yield* read(host, plan);
        const exact = reconciled.snapshot.events.find((item) => item.eventId === eventId);
        owned = exact !== undefined && canonical(exact) === canonical(event);
      }
      if (!owned)
        continue;
      const verified = yield* verifyRequest(request3);
      const result3 = yield* send(verified).pipe(catch_2((error) => succeed6({ _tag: "CoreError", error })));
      dispatches++;
      if (result3._tag === "Accepted") {
        const decoded = yield* attempt(() => ({
          _tag: "Decoded",
          status: provider.classifyReceipt(operation, request3.facts, nativeEvidence(provider.receiptCodec, result3.receipt))
        })).pipe(catch_2((error) => succeed6({ _tag: "Undecodable", error })));
        if (decoded._tag === "Decoded") {
          yield* appendBody(host, plan, new ReceiptAccepted({
            dispatchId,
            receiptVersion: provider.receiptVersion,
            status: decoded.status,
            receipt: result3.receipt
          }));
        } else {
          let diagnostic = null;
          try {
            diagnostic = new TextEncoder().encode(canonical(result3.receipt));
          } catch {}
          const evidence = new CoreUndecodableReceipt({
            code: "undecodable-receipt",
            message: "Committed response could not be admitted by the installed provider",
            receiptSha256: diagnostic && (yield* sha256(diagnostic)),
            receiptBytes: diagnostic && String(diagnostic.byteLength)
          });
          yield* appendObservation(host, plan, {
            operationId: operation.operationId,
            evidenceKind: "DispatchError",
            dispatchId,
            status: "Inconclusive",
            evidenceVersion: "core-undecodable-receipt/1",
            evidence,
            observedAt: host.now()
          });
        }
      } else if (result3._tag === "RejectedBeforeCommit" && provider.rejection) {
        yield* appendBody(host, plan, new DispatchRejectedBeforeCommit({
          dispatchId,
          proofVersion: provider.rejection.version,
          proof: result3.proof
        }));
      } else {
        const native = result3._tag === "Unknown" && result3.nativeError !== undefined;
        if (native && !provider.dispatchError)
          return yield* reject("unknown-error-codec", "Native dispatch error requires an installed versioned codec");
        const evidence = native ? result3.nativeError : result3._tag === "CoreError" ? new CoreDispatchError({
          code: "transport-error",
          message: "Transport failed after dispatch began"
        }) : new CoreDispatchError({
          code: result3._tag === "RejectedBeforeCommit" ? "unverified-noncommit" : "outcome-unknown",
          message: result3._tag === "RejectedBeforeCommit" ? "Transport supplied no declared native proof of terminal noncommit" : "Transport did not provide a verifiable outcome"
        });
        yield* appendObservation(host, plan, {
          operationId: operation.operationId,
          evidenceKind: "DispatchError",
          dispatchId,
          status: "Inconclusive",
          evidenceVersion: native ? provider.dispatchError.version : "core-dispatch-error/1",
          evidence,
          observedAt: host.now()
        });
      }
    }
    if (!progressed)
      break;
  }
  return (yield* read(host, plan)).report();
});
var supersedePlan = fn2("ts-release.supersedePlan")(function* (options) {
  const host = yield* currentHost;
  if (options.authorize !== true)
    return yield* reject("authority-required", "Supersession requires host authorization");
  const plan = yield* loadPlan(options.plan, host.providers);
  yield* appendBody(host, plan, new PlanSuperseded({ reason: options.reason }));
  return (yield* read(host, plan)).report();
});
var acceptRisk = fn2("ts-release.acceptRisk")(function* (options) {
  const host = yield* currentHost;
  if (options.authorize !== true)
    return yield* reject("authority-required", "Risk acceptance requires host authorization");
  const plan = yield* loadPlan(options.plan, host.providers);
  yield* appendBody(host, plan, options.decision);
  return (yield* read(host, plan)).report();
});

// packages/ts-release/dist/platform/Application.js
var runInterruptibleProcess = async (main) => {
  const controller = new AbortController, keepAlive = setInterval(() => {}, 2147483647);
  let code = 0;
  const stop = (exitCode) => {
    code ||= exitCode;
    controller.abort();
  }, signals = { SIGINT: () => stop(130), SIGTERM: () => stop(143) };
  for (const [signal, listener] of Object.entries(signals))
    process.on(signal, listener);
  try {
    return await main(controller.signal, () => code);
  } finally {
    clearInterval(keepAlive);
    for (const [signal, listener] of Object.entries(signals))
      process.off(signal, listener);
  }
};
var runApplication = (applicationPath, input, signal) => runPromise2(scoped2(gen2(function* () {
  const loaded = yield* tryPromise2({
    try: () => import(import_node_url.pathToFileURL(import_node_path.resolve(applicationPath)).href),
    catch: () => failure("application-load", "Application module could not be loaded")
  });
  const factory = yield* attempt(() => {
    if (typeof loaded !== "object" || loaded === null || !("createApplication" in loaded) || typeof loaded.createApplication !== "function")
      fail7("application-export", "Application must export createApplication(input)");
    const effect = loaded.createApplication(input);
    if (!isEffect2(effect))
      fail7("application-effect", "createApplication must return a scoped Effect");
    return effect;
  });
  const app = yield* factory;
  const options = { ...app.options };
  const host = yield* attempt(() => captureHost(app.host));
  return yield* gen2(function* () {
    const admitted = yield* reportFinalizedRelease(app.bundle, options.plan);
    yield* runRelease({ ...options, plan: admitted.plan });
    return yield* reportFinalizedRelease(admitted.bundle, admitted.plan);
  }).pipe(provide4(succeed5(Host, host)));
})).pipe(provideService2(LogToStderr2, true)), { signal });

// apps/action/src/launcher.ts
var runAction = async (input) => runApplication(input.application, input.input, input.signal);
var required2 = (environment, name) => {
  const value3 = environment[name]?.trim();
  if (!value3)
    throw new Error(`GitHub Action requires ${name}`);
  return value3;
};
var inside = (root, child) => {
  const path = import_node_path2.relative(root, child);
  return path !== ".." && !path.startsWith(`..${import_node_path2.sep}`) && !import_node_path2.isAbsolute(path);
};
var applicationPath = async (workspace, input) => {
  const candidate = import_node_path2.resolve(workspace, input);
  const actual = inside(workspace, candidate) ? await import_promises.realpath(candidate) : candidate;
  if (!inside(workspace, actual))
    throw new Error("Action application is outside GITHUB_WORKSPACE");
  return actual;
};
var runActionEnvironment = async (environment = process.env) => runInterruptibleProcess(async (signal, exitCode) => {
  try {
    const workspace = await import_promises.realpath(required2(environment, "GITHUB_WORKSPACE"));
    const application = await applicationPath(workspace, required2(environment, "INPUT_APPLICATION"));
    const input = JSON.parse(environment.INPUT_INPUT ?? "{}");
    const report = await runAction({ application, input, signal });
    const revision = String(report.journal.revision);
    if (!/^[a-f0-9]{64}$/u.test(report.plan.planId) || !/^\d+$/u.test(revision))
      throw new Error("Action report contains invalid output identities");
    await import_promises.appendFile(required2(environment, "GITHUB_OUTPUT"), `plan-id=${report.plan.planId}
journal-revision=${revision}
`, { encoding: "utf8" });
    process.stdout.write(`${JSON.stringify(report)}
`);
    return exitCode() || (report.operations.every((operation) => operation.status === "Satisfied") ? 0 : 2);
  } catch (cause) {
    if (exitCode())
      return exitCode();
    throw cause;
  }
});
if (process.env.GITHUB_ACTIONS === "true") {
  runActionEnvironment().then((code) => {
    process.exitCode = code;
  }, () => {
    process.stderr.write(`ts-release Action failed; inspect the configured durable journal before resuming.
`);
    process.exitCode = 1;
  });
}
