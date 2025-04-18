class sr {
  constructor() {
    this.listeners = [], this.unexpectedErrorHandler = function(t) {
      setTimeout(() => {
        throw t.stack ? Qe.isErrorNoTelemetry(t) ? new Qe(t.message + `

` + t.stack) : new Error(t.message + `

` + t.stack) : t;
      }, 0);
    };
  }
  emit(t) {
    this.listeners.forEach((n) => {
      n(t);
    });
  }
  onUnexpectedError(t) {
    this.unexpectedErrorHandler(t), this.emit(t);
  }
  // For external errors, we don't want the listeners to be called
  onUnexpectedExternalError(t) {
    this.unexpectedErrorHandler(t);
  }
}
const rr = new sr();
function st(e) {
  ir(e) || rr.onUnexpectedError(e);
}
function F1(e) {
  if (e instanceof Error) {
    const { name: t, message: n } = e, s = e.stacktrace || e.stack;
    return {
      $isError: !0,
      name: t,
      message: n,
      stack: s,
      noTelemetry: Qe.isErrorNoTelemetry(e)
    };
  }
  return e;
}
const Kt = "Canceled";
function ir(e) {
  return e instanceof ar ? !0 : e instanceof Error && e.name === Kt && e.message === Kt;
}
class ar extends Error {
  constructor() {
    super(Kt), this.name = this.message;
  }
}
class Qe extends Error {
  constructor(t) {
    super(t), this.name = "CodeExpectedError";
  }
  static fromError(t) {
    if (t instanceof Qe)
      return t;
    const n = new Qe();
    return n.message = t.message, n.stack = t.stack, n;
  }
  static isErrorNoTelemetry(t) {
    return t.name === "CodeExpectedError";
  }
}
class ae extends Error {
  constructor(t) {
    super(t || "An unexpected bug occurred."), Object.setPrototypeOf(this, ae.prototype);
  }
}
function or(e, t) {
  const n = this;
  let s = !1, r;
  return function() {
    if (s)
      return r;
    if (s = !0, t)
      try {
        r = e.apply(n, arguments);
      } finally {
        t();
      }
    else
      r = e.apply(n, arguments);
    return r;
  };
}
var St;
(function(e) {
  function t(x) {
    return x && typeof x == "object" && typeof x[Symbol.iterator] == "function";
  }
  e.is = t;
  const n = Object.freeze([]);
  function s() {
    return n;
  }
  e.empty = s;
  function* r(x) {
    yield x;
  }
  e.single = r;
  function i(x) {
    return t(x) ? x : r(x);
  }
  e.wrap = i;
  function o(x) {
    return x || n;
  }
  e.from = o;
  function* l(x) {
    for (let p = x.length - 1; p >= 0; p--)
      yield x[p];
  }
  e.reverse = l;
  function u(x) {
    return !x || x[Symbol.iterator]().next().done === !0;
  }
  e.isEmpty = u;
  function c(x) {
    return x[Symbol.iterator]().next().value;
  }
  e.first = c;
  function f(x, p) {
    let L = 0;
    for (const A of x)
      if (p(A, L++))
        return !0;
    return !1;
  }
  e.some = f;
  function h(x, p) {
    for (const L of x)
      if (p(L))
        return L;
  }
  e.find = h;
  function* d(x, p) {
    for (const L of x)
      p(L) && (yield L);
  }
  e.filter = d;
  function* m(x, p) {
    let L = 0;
    for (const A of x)
      yield p(A, L++);
  }
  e.map = m;
  function* g(x, p) {
    let L = 0;
    for (const A of x)
      yield* p(A, L++);
  }
  e.flatMap = g;
  function* b(...x) {
    for (const p of x)
      yield* p;
  }
  e.concat = b;
  function _(x, p, L) {
    let A = L;
    for (const E of x)
      A = p(A, E);
    return A;
  }
  e.reduce = _;
  function* v(x, p, L = x.length) {
    for (p < 0 && (p += x.length), L < 0 ? L += x.length : L > x.length && (L = x.length); p < L; p++)
      yield x[p];
  }
  e.slice = v;
  function S(x, p = Number.POSITIVE_INFINITY) {
    const L = [];
    if (p === 0)
      return [L, x];
    const A = x[Symbol.iterator]();
    for (let E = 0; E < p; E++) {
      const B = A.next();
      if (B.done)
        return [L, e.empty()];
      L.push(B.value);
    }
    return [L, { [Symbol.iterator]() {
      return A;
    } }];
  }
  e.consume = S;
  async function N(x) {
    const p = [];
    for await (const L of x)
      p.push(L);
    return Promise.resolve(p);
  }
  e.asyncToArray = N;
})(St || (St = {}));
function ks(e) {
  if (St.is(e)) {
    const t = [];
    for (const n of e)
      if (n)
        try {
          n.dispose();
        } catch (s) {
          t.push(s);
        }
    if (t.length === 1)
      throw t[0];
    if (t.length > 1)
      throw new AggregateError(t, "Encountered errors while disposing of store");
    return Array.isArray(e) ? [] : e;
  } else if (e)
    return e.dispose(), e;
}
function lr(...e) {
  return Ct(() => ks(e));
}
function Ct(e) {
  return {
    dispose: or(() => {
      e();
    })
  };
}
const It = class It {
  constructor() {
    this._toDispose = /* @__PURE__ */ new Set(), this._isDisposed = !1;
  }
  /**
   * Dispose of all registered disposables and mark this object as disposed.
   *
   * Any future disposables added to this object will be disposed of on `add`.
   */
  dispose() {
    this._isDisposed || (this._isDisposed = !0, this.clear());
  }
  /**
   * @return `true` if this object has been disposed of.
   */
  get isDisposed() {
    return this._isDisposed;
  }
  /**
   * Dispose of all registered disposables but do not mark this object as disposed.
   */
  clear() {
    if (this._toDispose.size !== 0)
      try {
        ks(this._toDispose);
      } finally {
        this._toDispose.clear();
      }
  }
  /**
   * Add a new {@link IDisposable disposable} to the collection.
   */
  add(t) {
    if (!t)
      return t;
    if (t === this)
      throw new Error("Cannot register a disposable on itself!");
    return this._isDisposed ? It.DISABLE_DISPOSED_WARNING || console.warn(new Error("Trying to add a disposable to a DisposableStore that has already been disposed of. The added object will be leaked!").stack) : this._toDispose.add(t), t;
  }
  /**
   * Deletes the value from the store, but does not dispose it.
   */
  deleteAndLeak(t) {
    t && this._toDispose.has(t) && this._toDispose.delete(t);
  }
};
It.DISABLE_DISPOSED_WARNING = !1;
let ut = It;
const k1 = class k1 {
  constructor() {
    this._store = new ut(), this._store;
  }
  dispose() {
    this._store.dispose();
  }
  /**
   * Adds `o` to the collection of disposables managed by this object.
   */
  _register(t) {
    if (t === this)
      throw new Error("Cannot register a disposable on itself!");
    return this._store.add(t);
  }
};
k1.None = Object.freeze({ dispose() {
} });
let Ye = k1;
const $e = class $e {
  constructor(t) {
    this.element = t, this.next = $e.Undefined, this.prev = $e.Undefined;
  }
};
$e.Undefined = new $e(void 0);
let O = $e;
class ur {
  constructor() {
    this._first = O.Undefined, this._last = O.Undefined, this._size = 0;
  }
  get size() {
    return this._size;
  }
  isEmpty() {
    return this._first === O.Undefined;
  }
  clear() {
    let t = this._first;
    for (; t !== O.Undefined; ) {
      const n = t.next;
      t.prev = O.Undefined, t.next = O.Undefined, t = n;
    }
    this._first = O.Undefined, this._last = O.Undefined, this._size = 0;
  }
  unshift(t) {
    return this._insert(t, !1);
  }
  push(t) {
    return this._insert(t, !0);
  }
  _insert(t, n) {
    const s = new O(t);
    if (this._first === O.Undefined)
      this._first = s, this._last = s;
    else if (n) {
      const i = this._last;
      this._last = s, s.prev = i, i.next = s;
    } else {
      const i = this._first;
      this._first = s, s.next = i, i.prev = s;
    }
    this._size += 1;
    let r = !1;
    return () => {
      r || (r = !0, this._remove(s));
    };
  }
  shift() {
    if (this._first !== O.Undefined) {
      const t = this._first.element;
      return this._remove(this._first), t;
    }
  }
  pop() {
    if (this._last !== O.Undefined) {
      const t = this._last.element;
      return this._remove(this._last), t;
    }
  }
  _remove(t) {
    if (t.prev !== O.Undefined && t.next !== O.Undefined) {
      const n = t.prev;
      n.next = t.next, t.next.prev = n;
    } else
      t.prev === O.Undefined && t.next === O.Undefined ? (this._first = O.Undefined, this._last = O.Undefined) : t.next === O.Undefined ? (this._last = this._last.prev, this._last.next = O.Undefined) : t.prev === O.Undefined && (this._first = this._first.next, this._first.prev = O.Undefined);
    this._size -= 1;
  }
  *[Symbol.iterator]() {
    let t = this._first;
    for (; t !== O.Undefined; )
      yield t.element, t = t.next;
  }
}
const cr = globalThis.performance && typeof globalThis.performance.now == "function";
class Wt {
  static create(t) {
    return new Wt(t);
  }
  constructor(t) {
    this._now = cr && t === !1 ? Date.now : globalThis.performance.now.bind(globalThis.performance), this._startTime = this._now(), this._stopTime = -1;
  }
  stop() {
    this._stopTime = this._now();
  }
  reset() {
    this._startTime = this._now(), this._stopTime = -1;
  }
  elapsed() {
    return this._stopTime !== -1 ? this._stopTime - this._startTime : this._now() - this._startTime;
  }
}
var At;
(function(e) {
  e.None = () => Ye.None;
  function t(C, w) {
    return d(C, () => {
    }, 0, void 0, !0, void 0, w);
  }
  e.defer = t;
  function n(C) {
    return (w, y = null, R) => {
      let F = !1, I;
      return I = C((U) => {
        if (!F)
          return I ? I.dispose() : F = !0, w.call(y, U);
      }, null, R), F && I.dispose(), I;
    };
  }
  e.once = n;
  function s(C, w) {
    return e.once(e.filter(C, w));
  }
  e.onceIf = s;
  function r(C, w, y) {
    return f((R, F = null, I) => C((U) => R.call(F, w(U)), null, I), y);
  }
  e.map = r;
  function i(C, w, y) {
    return f((R, F = null, I) => C((U) => {
      w(U), R.call(F, U);
    }, null, I), y);
  }
  e.forEach = i;
  function o(C, w, y) {
    return f((R, F = null, I) => C((U) => w(U) && R.call(F, U), null, I), y);
  }
  e.filter = o;
  function l(C) {
    return C;
  }
  e.signal = l;
  function u(...C) {
    return (w, y = null, R) => {
      const F = lr(...C.map((I) => I((U) => w.call(y, U))));
      return h(F, R);
    };
  }
  e.any = u;
  function c(C, w, y, R) {
    let F = y;
    return r(C, (I) => (F = w(F, I), F), R);
  }
  e.reduce = c;
  function f(C, w) {
    let y;
    const R = {
      onWillAddFirstListener() {
        y = C(F.fire, F);
      },
      onDidRemoveLastListener() {
        y == null || y.dispose();
      }
    }, F = new le(R);
    return w == null || w.add(F), F.event;
  }
  function h(C, w) {
    return w instanceof Array ? w.push(C) : w && w.add(C), C;
  }
  function d(C, w, y = 100, R = !1, F = !1, I, U) {
    let Y, K, De, mt = 0, Me;
    const er = {
      leakWarningThreshold: I,
      onWillAddFirstListener() {
        Y = C((tr) => {
          mt++, K = w(K, tr), R && !De && (gt.fire(K), K = void 0), Me = () => {
            const nr = K;
            K = void 0, De = void 0, (!R || mt > 1) && gt.fire(nr), mt = 0;
          }, typeof y == "number" ? (clearTimeout(De), De = setTimeout(Me, y)) : De === void 0 && (De = 0, queueMicrotask(Me));
        });
      },
      onWillRemoveListener() {
        F && mt > 0 && (Me == null || Me());
      },
      onDidRemoveLastListener() {
        Me = void 0, Y.dispose();
      }
    }, gt = new le(er);
    return U == null || U.add(gt), gt.event;
  }
  e.debounce = d;
  function m(C, w = 0, y) {
    return e.debounce(C, (R, F) => R ? (R.push(F), R) : [F], w, void 0, !0, void 0, y);
  }
  e.accumulate = m;
  function g(C, w = (R, F) => R === F, y) {
    let R = !0, F;
    return o(C, (I) => {
      const U = R || !w(I, F);
      return R = !1, F = I, U;
    }, y);
  }
  e.latch = g;
  function b(C, w, y) {
    return [
      e.filter(C, w, y),
      e.filter(C, (R) => !w(R), y)
    ];
  }
  e.split = b;
  function _(C, w = !1, y = [], R) {
    let F = y.slice(), I = C((K) => {
      F ? F.push(K) : Y.fire(K);
    });
    R && R.add(I);
    const U = () => {
      F == null || F.forEach((K) => Y.fire(K)), F = null;
    }, Y = new le({
      onWillAddFirstListener() {
        I || (I = C((K) => Y.fire(K)), R && R.add(I));
      },
      onDidAddFirstListener() {
        F && (w ? setTimeout(U) : U());
      },
      onDidRemoveLastListener() {
        I && I.dispose(), I = null;
      }
    });
    return R && R.add(Y), Y.event;
  }
  e.buffer = _;
  function v(C, w) {
    return (R, F, I) => {
      const U = w(new N());
      return C(function(Y) {
        const K = U.evaluate(Y);
        K !== S && R.call(F, K);
      }, void 0, I);
    };
  }
  e.chain = v;
  const S = Symbol("HaltChainable");
  class N {
    constructor() {
      this.steps = [];
    }
    map(w) {
      return this.steps.push(w), this;
    }
    forEach(w) {
      return this.steps.push((y) => (w(y), y)), this;
    }
    filter(w) {
      return this.steps.push((y) => w(y) ? y : S), this;
    }
    reduce(w, y) {
      let R = y;
      return this.steps.push((F) => (R = w(R, F), R)), this;
    }
    latch(w = (y, R) => y === R) {
      let y = !0, R;
      return this.steps.push((F) => {
        const I = y || !w(F, R);
        return y = !1, R = F, I ? F : S;
      }), this;
    }
    evaluate(w) {
      for (const y of this.steps)
        if (w = y(w), w === S)
          break;
      return w;
    }
  }
  function x(C, w, y = (R) => R) {
    const R = (...Y) => U.fire(y(...Y)), F = () => C.on(w, R), I = () => C.removeListener(w, R), U = new le({ onWillAddFirstListener: F, onDidRemoveLastListener: I });
    return U.event;
  }
  e.fromNodeEventEmitter = x;
  function p(C, w, y = (R) => R) {
    const R = (...Y) => U.fire(y(...Y)), F = () => C.addEventListener(w, R), I = () => C.removeEventListener(w, R), U = new le({ onWillAddFirstListener: F, onDidRemoveLastListener: I });
    return U.event;
  }
  e.fromDOMEventEmitter = p;
  function L(C) {
    return new Promise((w) => n(C)(w));
  }
  e.toPromise = L;
  function A(C) {
    const w = new le();
    return C.then((y) => {
      w.fire(y);
    }, () => {
      w.fire(void 0);
    }).finally(() => {
      w.dispose();
    }), w.event;
  }
  e.fromPromise = A;
  function E(C, w) {
    return C((y) => w.fire(y));
  }
  e.forward = E;
  function B(C, w, y) {
    return w(y), C((R) => w(R));
  }
  e.runAndSubscribe = B;
  class X {
    constructor(w, y) {
      this._observable = w, this._counter = 0, this._hasChanged = !1;
      const R = {
        onWillAddFirstListener: () => {
          w.addObserver(this), this._observable.reportChanges();
        },
        onDidRemoveLastListener: () => {
          w.removeObserver(this);
        }
      };
      this.emitter = new le(R), y && y.add(this.emitter);
    }
    beginUpdate(w) {
      this._counter++;
    }
    handlePossibleChange(w) {
    }
    handleChange(w, y) {
      this._hasChanged = !0;
    }
    endUpdate(w) {
      this._counter--, this._counter === 0 && (this._observable.reportChanges(), this._hasChanged && (this._hasChanged = !1, this.emitter.fire(this._observable.get())));
    }
  }
  function q(C, w) {
    return new X(C, w).emitter.event;
  }
  e.fromObservable = q;
  function P(C) {
    return (w, y, R) => {
      let F = 0, I = !1;
      const U = {
        beginUpdate() {
          F++;
        },
        endUpdate() {
          F--, F === 0 && (C.reportChanges(), I && (I = !1, w.call(y)));
        },
        handlePossibleChange() {
        },
        handleChange() {
          I = !0;
        }
      };
      C.addObserver(U), C.reportChanges();
      const Y = {
        dispose() {
          C.removeObserver(U);
        }
      };
      return R instanceof ut ? R.add(Y) : Array.isArray(R) && R.push(Y), Y;
    };
  }
  e.fromObservableLight = P;
})(At || (At = {}));
const We = class We {
  constructor(t) {
    this.listenerCount = 0, this.invocationCount = 0, this.elapsedOverall = 0, this.durations = [], this.name = `${t}_${We._idPool++}`, We.all.add(this);
  }
  start(t) {
    this._stopWatch = new Wt(), this.listenerCount = t;
  }
  stop() {
    if (this._stopWatch) {
      const t = this._stopWatch.elapsed();
      this.durations.push(t), this.elapsedOverall += t, this.invocationCount += 1, this._stopWatch = void 0;
    }
  }
};
We.all = /* @__PURE__ */ new Set(), We._idPool = 0;
let e1 = We, hr = -1;
const Vt = class Vt {
  constructor(t, n, s = (Vt._idPool++).toString(16).padStart(3, "0")) {
    this._errorHandler = t, this.threshold = n, this.name = s, this._warnCountdown = 0;
  }
  dispose() {
    var t;
    (t = this._stacks) == null || t.clear();
  }
  check(t, n) {
    const s = this.threshold;
    if (s <= 0 || n < s)
      return;
    this._stacks || (this._stacks = /* @__PURE__ */ new Map());
    const r = this._stacks.get(t.value) || 0;
    if (this._stacks.set(t.value, r + 1), this._warnCountdown -= 1, this._warnCountdown <= 0) {
      this._warnCountdown = s * 0.5;
      const [i, o] = this.getMostFrequentStack(), l = `[${this.name}] potential listener LEAK detected, having ${n} listeners already. MOST frequent listener (${o}):`;
      console.warn(l), console.warn(i);
      const u = new fr(l, i);
      this._errorHandler(u);
    }
    return () => {
      const i = this._stacks.get(t.value) || 0;
      this._stacks.set(t.value, i - 1);
    };
  }
  getMostFrequentStack() {
    if (!this._stacks)
      return;
    let t, n = 0;
    for (const [s, r] of this._stacks)
      (!t || n < r) && (t = [s, r], n = r);
    return t;
  }
};
Vt._idPool = 1;
let t1 = Vt;
class C1 {
  static create() {
    const t = new Error();
    return new C1(t.stack ?? "");
  }
  constructor(t) {
    this.value = t;
  }
  print() {
    console.warn(this.value.split(`
`).slice(2).join(`
`));
  }
}
class fr extends Error {
  constructor(t, n) {
    super(t), this.name = "ListenerLeakError", this.stack = n;
  }
}
class dr extends Error {
  constructor(t, n) {
    super(t), this.name = "ListenerRefusalError", this.stack = n;
  }
}
class zt {
  constructor(t) {
    this.value = t;
  }
}
const mr = 2;
class le {
  constructor(t) {
    var n, s, r, i;
    this._size = 0, this._options = t, this._leakageMon = (n = this._options) != null && n.leakWarningThreshold ? new t1((t == null ? void 0 : t.onListenerError) ?? st, ((s = this._options) == null ? void 0 : s.leakWarningThreshold) ?? hr) : void 0, this._perfMon = (r = this._options) != null && r._profName ? new e1(this._options._profName) : void 0, this._deliveryQueue = (i = this._options) == null ? void 0 : i.deliveryQueue;
  }
  dispose() {
    var t, n, s, r;
    this._disposed || (this._disposed = !0, ((t = this._deliveryQueue) == null ? void 0 : t.current) === this && this._deliveryQueue.reset(), this._listeners && (this._listeners = void 0, this._size = 0), (s = (n = this._options) == null ? void 0 : n.onDidRemoveLastListener) == null || s.call(n), (r = this._leakageMon) == null || r.dispose());
  }
  /**
   * For the public to allow to subscribe
   * to events from this Emitter
   */
  get event() {
    return this._event ?? (this._event = (t, n, s) => {
      var l, u, c, f, h;
      if (this._leakageMon && this._size > this._leakageMon.threshold ** 2) {
        const d = `[${this._leakageMon.name}] REFUSES to accept new listeners because it exceeded its threshold by far (${this._size} vs ${this._leakageMon.threshold})`;
        console.warn(d);
        const m = this._leakageMon.getMostFrequentStack() ?? ["UNKNOWN stack", -1], g = new dr(`${d}. HINT: Stack shows most frequent listener (${m[1]}-times)`, m[0]);
        return (((l = this._options) == null ? void 0 : l.onListenerError) || st)(g), Ye.None;
      }
      if (this._disposed)
        return Ye.None;
      n && (t = t.bind(n));
      const r = new zt(t);
      let i;
      this._leakageMon && this._size >= Math.ceil(this._leakageMon.threshold * 0.2) && (r.stack = C1.create(), i = this._leakageMon.check(r.stack, this._size + 1)), this._listeners ? this._listeners instanceof zt ? (this._deliveryQueue ?? (this._deliveryQueue = new gr()), this._listeners = [this._listeners, r]) : this._listeners.push(r) : ((c = (u = this._options) == null ? void 0 : u.onWillAddFirstListener) == null || c.call(u, this), this._listeners = r, (h = (f = this._options) == null ? void 0 : f.onDidAddFirstListener) == null || h.call(f, this)), this._size++;
      const o = Ct(() => {
        i == null || i(), this._removeListener(r);
      });
      return s instanceof ut ? s.add(o) : Array.isArray(s) && s.push(o), o;
    }), this._event;
  }
  _removeListener(t) {
    var i, o, l, u;
    if ((o = (i = this._options) == null ? void 0 : i.onWillRemoveListener) == null || o.call(i, this), !this._listeners)
      return;
    if (this._size === 1) {
      this._listeners = void 0, (u = (l = this._options) == null ? void 0 : l.onDidRemoveLastListener) == null || u.call(l, this), this._size = 0;
      return;
    }
    const n = this._listeners, s = n.indexOf(t);
    if (s === -1)
      throw console.log("disposed?", this._disposed), console.log("size?", this._size), console.log("arr?", JSON.stringify(this._listeners)), new Error("Attempted to dispose unknown listener");
    this._size--, n[s] = void 0;
    const r = this._deliveryQueue.current === this;
    if (this._size * mr <= n.length) {
      let c = 0;
      for (let f = 0; f < n.length; f++)
        n[f] ? n[c++] = n[f] : r && (this._deliveryQueue.end--, c < this._deliveryQueue.i && this._deliveryQueue.i--);
      n.length = c;
    }
  }
  _deliver(t, n) {
    var r;
    if (!t)
      return;
    const s = ((r = this._options) == null ? void 0 : r.onListenerError) || st;
    if (!s) {
      t.value(n);
      return;
    }
    try {
      t.value(n);
    } catch (i) {
      s(i);
    }
  }
  /** Delivers items in the queue. Assumes the queue is ready to go. */
  _deliverQueue(t) {
    const n = t.current._listeners;
    for (; t.i < t.end; )
      this._deliver(n[t.i++], t.value);
    t.reset();
  }
  /**
   * To be kept private to fire an event to
   * subscribers
   */
  fire(t) {
    var n, s, r, i;
    if ((n = this._deliveryQueue) != null && n.current && (this._deliverQueue(this._deliveryQueue), (s = this._perfMon) == null || s.stop()), (r = this._perfMon) == null || r.start(this._size), this._listeners)
      if (this._listeners instanceof zt)
        this._deliver(this._listeners, t);
      else {
        const o = this._deliveryQueue;
        o.enqueue(this, t, this._listeners.length), this._deliverQueue(o);
      }
    (i = this._perfMon) == null || i.stop();
  }
  hasListeners() {
    return this._size > 0;
  }
}
class gr {
  constructor() {
    this.i = -1, this.end = 0;
  }
  enqueue(t, n, s) {
    this.i = 0, this.end = s, this.current = t, this.value = n;
  }
  reset() {
    this.i = this.end, this.current = void 0, this.value = void 0;
  }
}
function br() {
  return globalThis._VSCODE_NLS_MESSAGES;
}
function Fs() {
  return globalThis._VSCODE_NLS_LANGUAGE;
}
const pr = Fs() === "pseudo" || typeof document < "u" && document.location && document.location.hash.indexOf("pseudo=true") >= 0;
function P1(e, t) {
  let n;
  return t.length === 0 ? n = e : n = e.replace(/\{(\d+)\}/g, (s, r) => {
    const i = r[0], o = t[i];
    let l = s;
    return typeof o == "string" ? l = o : (typeof o == "number" || typeof o == "boolean" || o === void 0 || o === null) && (l = String(o)), l;
  }), pr && (n = "［" + n.replace(/[aouei]/g, "$&$&") + "］"), n;
}
function z(e, t, ...n) {
  return P1(typeof e == "number" ? xr(e, t) : t, n);
}
function xr(e, t) {
  var s;
  const n = (s = br()) == null ? void 0 : s[e];
  if (typeof n != "string") {
    if (typeof t == "string")
      return t;
    throw new Error(`!!! NLS MISSING: ${e} !!!`);
  }
  return n;
}
const Ue = "en";
let n1 = !1, s1 = !1, Ot = !1, Ps = !1, A1 = !1, bt, jt = Ue, D1 = Ue, _r, he;
const xe = globalThis;
let Z;
var Rs;
typeof xe.vscode < "u" && typeof xe.vscode.process < "u" ? Z = xe.vscode.process : typeof process < "u" && typeof ((Rs = process == null ? void 0 : process.versions) == null ? void 0 : Rs.node) == "string" && (Z = process);
var ys;
const wr = typeof ((ys = Z == null ? void 0 : Z.versions) == null ? void 0 : ys.electron) == "string", Lr = wr && (Z == null ? void 0 : Z.type) === "renderer";
var Es;
if (typeof Z == "object") {
  n1 = Z.platform === "win32", s1 = Z.platform === "darwin", Ot = Z.platform === "linux", Ot && Z.env.SNAP && Z.env.SNAP_REVISION, Z.env.CI || Z.env.BUILD_ARTIFACTSTAGINGDIRECTORY, bt = Ue, jt = Ue;
  const e = Z.env.VSCODE_NLS_CONFIG;
  if (e)
    try {
      const t = JSON.parse(e);
      bt = t.userLocale, D1 = t.osLocale, jt = t.resolvedLanguage || Ue, _r = (Es = t.languagePack) == null ? void 0 : Es.translationsConfigFile;
    } catch {
    }
  Ps = !0;
} else
  typeof navigator == "object" && !Lr ? (he = navigator.userAgent, n1 = he.indexOf("Windows") >= 0, s1 = he.indexOf("Macintosh") >= 0, (he.indexOf("Macintosh") >= 0 || he.indexOf("iPad") >= 0 || he.indexOf("iPhone") >= 0) && navigator.maxTouchPoints && navigator.maxTouchPoints > 0, Ot = he.indexOf("Linux") >= 0, (he == null ? void 0 : he.indexOf("Mobi")) >= 0, A1 = !0, jt = Fs() || Ue, bt = navigator.language.toLowerCase(), D1 = bt) : console.error("Unable to resolve platform.");
const ct = n1, vr = s1, Nr = Ps, Sr = A1, Cr = A1 && typeof xe.importScripts == "function", Ar = Cr ? xe.origin : void 0, be = he, Rr = typeof xe.postMessage == "function" && !xe.importScripts;
(() => {
  if (Rr) {
    const e = [];
    xe.addEventListener("message", (n) => {
      if (n.data && n.data.vscodeScheduleAsyncWork)
        for (let s = 0, r = e.length; s < r; s++) {
          const i = e[s];
          if (i.id === n.data.vscodeScheduleAsyncWork) {
            e.splice(s, 1), i.callback();
            return;
          }
        }
    });
    let t = 0;
    return (n) => {
      const s = ++t;
      e.push({
        id: s,
        callback: n
      }), xe.postMessage({ vscodeScheduleAsyncWork: s }, "*");
    };
  }
  return (e) => setTimeout(e);
})();
const yr = !!(be && be.indexOf("Chrome") >= 0);
be && be.indexOf("Firefox") >= 0;
!yr && be && be.indexOf("Safari") >= 0;
be && be.indexOf("Edg/") >= 0;
be && be.indexOf("Android") >= 0;
function Er(e) {
  return e;
}
class Mr {
  constructor(t, n) {
    this.lastCache = void 0, this.lastArgKey = void 0, typeof t == "function" ? (this._fn = t, this._computeKey = Er) : (this._fn = n, this._computeKey = t.getCacheKey);
  }
  get(t) {
    const n = this._computeKey(t);
    return this.lastArgKey !== n && (this.lastArgKey = n, this.lastCache = this._fn(t)), this.lastCache;
  }
}
class T1 {
  constructor(t) {
    this.executor = t, this._didRun = !1;
  }
  /**
   * Get the wrapped value.
   *
   * This will force evaluation of the lazy value if it has not been resolved yet. Lazy values are only
   * resolved once. `getValue` will re-throw exceptions that are hit while resolving the value
   */
  get value() {
    if (!this._didRun)
      try {
        this._value = this.executor();
      } catch (t) {
        this._error = t;
      } finally {
        this._didRun = !0;
      }
    if (this._error)
      throw this._error;
    return this._value;
  }
  /**
   * Get the wrapped value without forcing evaluation.
   */
  get rawValue() {
    return this._value;
  }
}
function kr(e) {
  return e.replace(/[\\\{\}\*\+\?\|\^\$\.\[\]\(\)]/g, "\\$&");
}
function Fr(e) {
  return e.split(/\r\n|\r|\n/);
}
function Pr(e) {
  for (let t = 0, n = e.length; t < n; t++) {
    const s = e.charCodeAt(t);
    if (s !== 32 && s !== 9)
      return t;
  }
  return -1;
}
function Dr(e, t = e.length - 1) {
  for (let n = t; n >= 0; n--) {
    const s = e.charCodeAt(n);
    if (s !== 32 && s !== 9)
      return n;
  }
  return -1;
}
function Ds(e) {
  return e >= 65 && e <= 90;
}
function Rt(e) {
  return 55296 <= e && e <= 56319;
}
function r1(e) {
  return 56320 <= e && e <= 57343;
}
function Ts(e, t) {
  return (e - 55296 << 10) + (t - 56320) + 65536;
}
function Tr(e, t, n) {
  const s = e.charCodeAt(n);
  if (Rt(s) && n + 1 < t) {
    const r = e.charCodeAt(n + 1);
    if (r1(r))
      return Ts(s, r);
  }
  return s;
}
const Ir = /^[\t\n\r\x20-\x7E]*$/;
function Vr(e) {
  return Ir.test(e);
}
const ke = class ke {
  static getInstance() {
    return ke._INSTANCE || (ke._INSTANCE = new ke()), ke._INSTANCE;
  }
  constructor() {
    this._data = Br();
  }
  getGraphemeBreakType(t) {
    if (t < 32)
      return t === 10 ? 3 : t === 13 ? 2 : 4;
    if (t < 127)
      return 0;
    const n = this._data, s = n.length / 3;
    let r = 1;
    for (; r <= s; )
      if (t < n[3 * r])
        r = 2 * r;
      else if (t > n[3 * r + 1])
        r = 2 * r + 1;
      else
        return n[3 * r + 2];
    return 0;
  }
};
ke._INSTANCE = null;
let I1 = ke;
function Br() {
  return JSON.parse("[0,0,0,51229,51255,12,44061,44087,12,127462,127487,6,7083,7085,5,47645,47671,12,54813,54839,12,128678,128678,14,3270,3270,5,9919,9923,14,45853,45879,12,49437,49463,12,53021,53047,12,71216,71218,7,128398,128399,14,129360,129374,14,2519,2519,5,4448,4519,9,9742,9742,14,12336,12336,14,44957,44983,12,46749,46775,12,48541,48567,12,50333,50359,12,52125,52151,12,53917,53943,12,69888,69890,5,73018,73018,5,127990,127990,14,128558,128559,14,128759,128760,14,129653,129655,14,2027,2035,5,2891,2892,7,3761,3761,5,6683,6683,5,8293,8293,4,9825,9826,14,9999,9999,14,43452,43453,5,44509,44535,12,45405,45431,12,46301,46327,12,47197,47223,12,48093,48119,12,48989,49015,12,49885,49911,12,50781,50807,12,51677,51703,12,52573,52599,12,53469,53495,12,54365,54391,12,65279,65279,4,70471,70472,7,72145,72147,7,119173,119179,5,127799,127818,14,128240,128244,14,128512,128512,14,128652,128652,14,128721,128722,14,129292,129292,14,129445,129450,14,129734,129743,14,1476,1477,5,2366,2368,7,2750,2752,7,3076,3076,5,3415,3415,5,4141,4144,5,6109,6109,5,6964,6964,5,7394,7400,5,9197,9198,14,9770,9770,14,9877,9877,14,9968,9969,14,10084,10084,14,43052,43052,5,43713,43713,5,44285,44311,12,44733,44759,12,45181,45207,12,45629,45655,12,46077,46103,12,46525,46551,12,46973,46999,12,47421,47447,12,47869,47895,12,48317,48343,12,48765,48791,12,49213,49239,12,49661,49687,12,50109,50135,12,50557,50583,12,51005,51031,12,51453,51479,12,51901,51927,12,52349,52375,12,52797,52823,12,53245,53271,12,53693,53719,12,54141,54167,12,54589,54615,12,55037,55063,12,69506,69509,5,70191,70193,5,70841,70841,7,71463,71467,5,72330,72342,5,94031,94031,5,123628,123631,5,127763,127765,14,127941,127941,14,128043,128062,14,128302,128317,14,128465,128467,14,128539,128539,14,128640,128640,14,128662,128662,14,128703,128703,14,128745,128745,14,129004,129007,14,129329,129330,14,129402,129402,14,129483,129483,14,129686,129704,14,130048,131069,14,173,173,4,1757,1757,1,2200,2207,5,2434,2435,7,2631,2632,5,2817,2817,5,3008,3008,5,3201,3201,5,3387,3388,5,3542,3542,5,3902,3903,7,4190,4192,5,6002,6003,5,6439,6440,5,6765,6770,7,7019,7027,5,7154,7155,7,8205,8205,13,8505,8505,14,9654,9654,14,9757,9757,14,9792,9792,14,9852,9853,14,9890,9894,14,9937,9937,14,9981,9981,14,10035,10036,14,11035,11036,14,42654,42655,5,43346,43347,7,43587,43587,5,44006,44007,7,44173,44199,12,44397,44423,12,44621,44647,12,44845,44871,12,45069,45095,12,45293,45319,12,45517,45543,12,45741,45767,12,45965,45991,12,46189,46215,12,46413,46439,12,46637,46663,12,46861,46887,12,47085,47111,12,47309,47335,12,47533,47559,12,47757,47783,12,47981,48007,12,48205,48231,12,48429,48455,12,48653,48679,12,48877,48903,12,49101,49127,12,49325,49351,12,49549,49575,12,49773,49799,12,49997,50023,12,50221,50247,12,50445,50471,12,50669,50695,12,50893,50919,12,51117,51143,12,51341,51367,12,51565,51591,12,51789,51815,12,52013,52039,12,52237,52263,12,52461,52487,12,52685,52711,12,52909,52935,12,53133,53159,12,53357,53383,12,53581,53607,12,53805,53831,12,54029,54055,12,54253,54279,12,54477,54503,12,54701,54727,12,54925,54951,12,55149,55175,12,68101,68102,5,69762,69762,7,70067,70069,7,70371,70378,5,70720,70721,7,71087,71087,5,71341,71341,5,71995,71996,5,72249,72249,7,72850,72871,5,73109,73109,5,118576,118598,5,121505,121519,5,127245,127247,14,127568,127569,14,127777,127777,14,127872,127891,14,127956,127967,14,128015,128016,14,128110,128172,14,128259,128259,14,128367,128368,14,128424,128424,14,128488,128488,14,128530,128532,14,128550,128551,14,128566,128566,14,128647,128647,14,128656,128656,14,128667,128673,14,128691,128693,14,128715,128715,14,128728,128732,14,128752,128752,14,128765,128767,14,129096,129103,14,129311,129311,14,129344,129349,14,129394,129394,14,129413,129425,14,129466,129471,14,129511,129535,14,129664,129666,14,129719,129722,14,129760,129767,14,917536,917631,5,13,13,2,1160,1161,5,1564,1564,4,1807,1807,1,2085,2087,5,2307,2307,7,2382,2383,7,2497,2500,5,2563,2563,7,2677,2677,5,2763,2764,7,2879,2879,5,2914,2915,5,3021,3021,5,3142,3144,5,3263,3263,5,3285,3286,5,3398,3400,7,3530,3530,5,3633,3633,5,3864,3865,5,3974,3975,5,4155,4156,7,4229,4230,5,5909,5909,7,6078,6085,7,6277,6278,5,6451,6456,7,6744,6750,5,6846,6846,5,6972,6972,5,7074,7077,5,7146,7148,7,7222,7223,5,7416,7417,5,8234,8238,4,8417,8417,5,9000,9000,14,9203,9203,14,9730,9731,14,9748,9749,14,9762,9763,14,9776,9783,14,9800,9811,14,9831,9831,14,9872,9873,14,9882,9882,14,9900,9903,14,9929,9933,14,9941,9960,14,9974,9974,14,9989,9989,14,10006,10006,14,10062,10062,14,10160,10160,14,11647,11647,5,12953,12953,14,43019,43019,5,43232,43249,5,43443,43443,5,43567,43568,7,43696,43696,5,43765,43765,7,44013,44013,5,44117,44143,12,44229,44255,12,44341,44367,12,44453,44479,12,44565,44591,12,44677,44703,12,44789,44815,12,44901,44927,12,45013,45039,12,45125,45151,12,45237,45263,12,45349,45375,12,45461,45487,12,45573,45599,12,45685,45711,12,45797,45823,12,45909,45935,12,46021,46047,12,46133,46159,12,46245,46271,12,46357,46383,12,46469,46495,12,46581,46607,12,46693,46719,12,46805,46831,12,46917,46943,12,47029,47055,12,47141,47167,12,47253,47279,12,47365,47391,12,47477,47503,12,47589,47615,12,47701,47727,12,47813,47839,12,47925,47951,12,48037,48063,12,48149,48175,12,48261,48287,12,48373,48399,12,48485,48511,12,48597,48623,12,48709,48735,12,48821,48847,12,48933,48959,12,49045,49071,12,49157,49183,12,49269,49295,12,49381,49407,12,49493,49519,12,49605,49631,12,49717,49743,12,49829,49855,12,49941,49967,12,50053,50079,12,50165,50191,12,50277,50303,12,50389,50415,12,50501,50527,12,50613,50639,12,50725,50751,12,50837,50863,12,50949,50975,12,51061,51087,12,51173,51199,12,51285,51311,12,51397,51423,12,51509,51535,12,51621,51647,12,51733,51759,12,51845,51871,12,51957,51983,12,52069,52095,12,52181,52207,12,52293,52319,12,52405,52431,12,52517,52543,12,52629,52655,12,52741,52767,12,52853,52879,12,52965,52991,12,53077,53103,12,53189,53215,12,53301,53327,12,53413,53439,12,53525,53551,12,53637,53663,12,53749,53775,12,53861,53887,12,53973,53999,12,54085,54111,12,54197,54223,12,54309,54335,12,54421,54447,12,54533,54559,12,54645,54671,12,54757,54783,12,54869,54895,12,54981,55007,12,55093,55119,12,55243,55291,10,66045,66045,5,68325,68326,5,69688,69702,5,69817,69818,5,69957,69958,7,70089,70092,5,70198,70199,5,70462,70462,5,70502,70508,5,70750,70750,5,70846,70846,7,71100,71101,5,71230,71230,7,71351,71351,5,71737,71738,5,72000,72000,7,72160,72160,5,72273,72278,5,72752,72758,5,72882,72883,5,73031,73031,5,73461,73462,7,94192,94193,7,119149,119149,7,121403,121452,5,122915,122916,5,126980,126980,14,127358,127359,14,127535,127535,14,127759,127759,14,127771,127771,14,127792,127793,14,127825,127867,14,127897,127899,14,127945,127945,14,127985,127986,14,128000,128007,14,128021,128021,14,128066,128100,14,128184,128235,14,128249,128252,14,128266,128276,14,128335,128335,14,128379,128390,14,128407,128419,14,128444,128444,14,128481,128481,14,128499,128499,14,128526,128526,14,128536,128536,14,128543,128543,14,128556,128556,14,128564,128564,14,128577,128580,14,128643,128645,14,128649,128649,14,128654,128654,14,128660,128660,14,128664,128664,14,128675,128675,14,128686,128689,14,128695,128696,14,128705,128709,14,128717,128719,14,128725,128725,14,128736,128741,14,128747,128748,14,128755,128755,14,128762,128762,14,128981,128991,14,129009,129023,14,129160,129167,14,129296,129304,14,129320,129327,14,129340,129342,14,129356,129356,14,129388,129392,14,129399,129400,14,129404,129407,14,129432,129442,14,129454,129455,14,129473,129474,14,129485,129487,14,129648,129651,14,129659,129660,14,129671,129679,14,129709,129711,14,129728,129730,14,129751,129753,14,129776,129782,14,917505,917505,4,917760,917999,5,10,10,3,127,159,4,768,879,5,1471,1471,5,1536,1541,1,1648,1648,5,1767,1768,5,1840,1866,5,2070,2073,5,2137,2139,5,2274,2274,1,2363,2363,7,2377,2380,7,2402,2403,5,2494,2494,5,2507,2508,7,2558,2558,5,2622,2624,7,2641,2641,5,2691,2691,7,2759,2760,5,2786,2787,5,2876,2876,5,2881,2884,5,2901,2902,5,3006,3006,5,3014,3016,7,3072,3072,5,3134,3136,5,3157,3158,5,3260,3260,5,3266,3266,5,3274,3275,7,3328,3329,5,3391,3392,7,3405,3405,5,3457,3457,5,3536,3537,7,3551,3551,5,3636,3642,5,3764,3772,5,3895,3895,5,3967,3967,7,3993,4028,5,4146,4151,5,4182,4183,7,4226,4226,5,4253,4253,5,4957,4959,5,5940,5940,7,6070,6070,7,6087,6088,7,6158,6158,4,6432,6434,5,6448,6449,7,6679,6680,5,6742,6742,5,6754,6754,5,6783,6783,5,6912,6915,5,6966,6970,5,6978,6978,5,7042,7042,7,7080,7081,5,7143,7143,7,7150,7150,7,7212,7219,5,7380,7392,5,7412,7412,5,8203,8203,4,8232,8232,4,8265,8265,14,8400,8412,5,8421,8432,5,8617,8618,14,9167,9167,14,9200,9200,14,9410,9410,14,9723,9726,14,9733,9733,14,9745,9745,14,9752,9752,14,9760,9760,14,9766,9766,14,9774,9774,14,9786,9786,14,9794,9794,14,9823,9823,14,9828,9828,14,9833,9850,14,9855,9855,14,9875,9875,14,9880,9880,14,9885,9887,14,9896,9897,14,9906,9916,14,9926,9927,14,9935,9935,14,9939,9939,14,9962,9962,14,9972,9972,14,9978,9978,14,9986,9986,14,9997,9997,14,10002,10002,14,10017,10017,14,10055,10055,14,10071,10071,14,10133,10135,14,10548,10549,14,11093,11093,14,12330,12333,5,12441,12442,5,42608,42610,5,43010,43010,5,43045,43046,5,43188,43203,7,43302,43309,5,43392,43394,5,43446,43449,5,43493,43493,5,43571,43572,7,43597,43597,7,43703,43704,5,43756,43757,5,44003,44004,7,44009,44010,7,44033,44059,12,44089,44115,12,44145,44171,12,44201,44227,12,44257,44283,12,44313,44339,12,44369,44395,12,44425,44451,12,44481,44507,12,44537,44563,12,44593,44619,12,44649,44675,12,44705,44731,12,44761,44787,12,44817,44843,12,44873,44899,12,44929,44955,12,44985,45011,12,45041,45067,12,45097,45123,12,45153,45179,12,45209,45235,12,45265,45291,12,45321,45347,12,45377,45403,12,45433,45459,12,45489,45515,12,45545,45571,12,45601,45627,12,45657,45683,12,45713,45739,12,45769,45795,12,45825,45851,12,45881,45907,12,45937,45963,12,45993,46019,12,46049,46075,12,46105,46131,12,46161,46187,12,46217,46243,12,46273,46299,12,46329,46355,12,46385,46411,12,46441,46467,12,46497,46523,12,46553,46579,12,46609,46635,12,46665,46691,12,46721,46747,12,46777,46803,12,46833,46859,12,46889,46915,12,46945,46971,12,47001,47027,12,47057,47083,12,47113,47139,12,47169,47195,12,47225,47251,12,47281,47307,12,47337,47363,12,47393,47419,12,47449,47475,12,47505,47531,12,47561,47587,12,47617,47643,12,47673,47699,12,47729,47755,12,47785,47811,12,47841,47867,12,47897,47923,12,47953,47979,12,48009,48035,12,48065,48091,12,48121,48147,12,48177,48203,12,48233,48259,12,48289,48315,12,48345,48371,12,48401,48427,12,48457,48483,12,48513,48539,12,48569,48595,12,48625,48651,12,48681,48707,12,48737,48763,12,48793,48819,12,48849,48875,12,48905,48931,12,48961,48987,12,49017,49043,12,49073,49099,12,49129,49155,12,49185,49211,12,49241,49267,12,49297,49323,12,49353,49379,12,49409,49435,12,49465,49491,12,49521,49547,12,49577,49603,12,49633,49659,12,49689,49715,12,49745,49771,12,49801,49827,12,49857,49883,12,49913,49939,12,49969,49995,12,50025,50051,12,50081,50107,12,50137,50163,12,50193,50219,12,50249,50275,12,50305,50331,12,50361,50387,12,50417,50443,12,50473,50499,12,50529,50555,12,50585,50611,12,50641,50667,12,50697,50723,12,50753,50779,12,50809,50835,12,50865,50891,12,50921,50947,12,50977,51003,12,51033,51059,12,51089,51115,12,51145,51171,12,51201,51227,12,51257,51283,12,51313,51339,12,51369,51395,12,51425,51451,12,51481,51507,12,51537,51563,12,51593,51619,12,51649,51675,12,51705,51731,12,51761,51787,12,51817,51843,12,51873,51899,12,51929,51955,12,51985,52011,12,52041,52067,12,52097,52123,12,52153,52179,12,52209,52235,12,52265,52291,12,52321,52347,12,52377,52403,12,52433,52459,12,52489,52515,12,52545,52571,12,52601,52627,12,52657,52683,12,52713,52739,12,52769,52795,12,52825,52851,12,52881,52907,12,52937,52963,12,52993,53019,12,53049,53075,12,53105,53131,12,53161,53187,12,53217,53243,12,53273,53299,12,53329,53355,12,53385,53411,12,53441,53467,12,53497,53523,12,53553,53579,12,53609,53635,12,53665,53691,12,53721,53747,12,53777,53803,12,53833,53859,12,53889,53915,12,53945,53971,12,54001,54027,12,54057,54083,12,54113,54139,12,54169,54195,12,54225,54251,12,54281,54307,12,54337,54363,12,54393,54419,12,54449,54475,12,54505,54531,12,54561,54587,12,54617,54643,12,54673,54699,12,54729,54755,12,54785,54811,12,54841,54867,12,54897,54923,12,54953,54979,12,55009,55035,12,55065,55091,12,55121,55147,12,55177,55203,12,65024,65039,5,65520,65528,4,66422,66426,5,68152,68154,5,69291,69292,5,69633,69633,5,69747,69748,5,69811,69814,5,69826,69826,5,69932,69932,7,70016,70017,5,70079,70080,7,70095,70095,5,70196,70196,5,70367,70367,5,70402,70403,7,70464,70464,5,70487,70487,5,70709,70711,7,70725,70725,7,70833,70834,7,70843,70844,7,70849,70849,7,71090,71093,5,71103,71104,5,71227,71228,7,71339,71339,5,71344,71349,5,71458,71461,5,71727,71735,5,71985,71989,7,71998,71998,5,72002,72002,7,72154,72155,5,72193,72202,5,72251,72254,5,72281,72283,5,72344,72345,5,72766,72766,7,72874,72880,5,72885,72886,5,73023,73029,5,73104,73105,5,73111,73111,5,92912,92916,5,94095,94098,5,113824,113827,4,119142,119142,7,119155,119162,4,119362,119364,5,121476,121476,5,122888,122904,5,123184,123190,5,125252,125258,5,127183,127183,14,127340,127343,14,127377,127386,14,127491,127503,14,127548,127551,14,127744,127756,14,127761,127761,14,127769,127769,14,127773,127774,14,127780,127788,14,127796,127797,14,127820,127823,14,127869,127869,14,127894,127895,14,127902,127903,14,127943,127943,14,127947,127950,14,127972,127972,14,127988,127988,14,127992,127994,14,128009,128011,14,128019,128019,14,128023,128041,14,128064,128064,14,128102,128107,14,128174,128181,14,128238,128238,14,128246,128247,14,128254,128254,14,128264,128264,14,128278,128299,14,128329,128330,14,128348,128359,14,128371,128377,14,128392,128393,14,128401,128404,14,128421,128421,14,128433,128434,14,128450,128452,14,128476,128478,14,128483,128483,14,128495,128495,14,128506,128506,14,128519,128520,14,128528,128528,14,128534,128534,14,128538,128538,14,128540,128542,14,128544,128549,14,128552,128555,14,128557,128557,14,128560,128563,14,128565,128565,14,128567,128576,14,128581,128591,14,128641,128642,14,128646,128646,14,128648,128648,14,128650,128651,14,128653,128653,14,128655,128655,14,128657,128659,14,128661,128661,14,128663,128663,14,128665,128666,14,128674,128674,14,128676,128677,14,128679,128685,14,128690,128690,14,128694,128694,14,128697,128702,14,128704,128704,14,128710,128714,14,128716,128716,14,128720,128720,14,128723,128724,14,128726,128727,14,128733,128735,14,128742,128744,14,128746,128746,14,128749,128751,14,128753,128754,14,128756,128758,14,128761,128761,14,128763,128764,14,128884,128895,14,128992,129003,14,129008,129008,14,129036,129039,14,129114,129119,14,129198,129279,14,129293,129295,14,129305,129310,14,129312,129319,14,129328,129328,14,129331,129338,14,129343,129343,14,129351,129355,14,129357,129359,14,129375,129387,14,129393,129393,14,129395,129398,14,129401,129401,14,129403,129403,14,129408,129412,14,129426,129431,14,129443,129444,14,129451,129453,14,129456,129465,14,129472,129472,14,129475,129482,14,129484,129484,14,129488,129510,14,129536,129647,14,129652,129652,14,129656,129658,14,129661,129663,14,129667,129670,14,129680,129685,14,129705,129708,14,129712,129718,14,129723,129727,14,129731,129733,14,129744,129750,14,129754,129759,14,129768,129775,14,129783,129791,14,917504,917504,4,917506,917535,4,917632,917759,4,918000,921599,4,0,9,4,11,12,4,14,31,4,169,169,14,174,174,14,1155,1159,5,1425,1469,5,1473,1474,5,1479,1479,5,1552,1562,5,1611,1631,5,1750,1756,5,1759,1764,5,1770,1773,5,1809,1809,5,1958,1968,5,2045,2045,5,2075,2083,5,2089,2093,5,2192,2193,1,2250,2273,5,2275,2306,5,2362,2362,5,2364,2364,5,2369,2376,5,2381,2381,5,2385,2391,5,2433,2433,5,2492,2492,5,2495,2496,7,2503,2504,7,2509,2509,5,2530,2531,5,2561,2562,5,2620,2620,5,2625,2626,5,2635,2637,5,2672,2673,5,2689,2690,5,2748,2748,5,2753,2757,5,2761,2761,7,2765,2765,5,2810,2815,5,2818,2819,7,2878,2878,5,2880,2880,7,2887,2888,7,2893,2893,5,2903,2903,5,2946,2946,5,3007,3007,7,3009,3010,7,3018,3020,7,3031,3031,5,3073,3075,7,3132,3132,5,3137,3140,7,3146,3149,5,3170,3171,5,3202,3203,7,3262,3262,7,3264,3265,7,3267,3268,7,3271,3272,7,3276,3277,5,3298,3299,5,3330,3331,7,3390,3390,5,3393,3396,5,3402,3404,7,3406,3406,1,3426,3427,5,3458,3459,7,3535,3535,5,3538,3540,5,3544,3550,7,3570,3571,7,3635,3635,7,3655,3662,5,3763,3763,7,3784,3789,5,3893,3893,5,3897,3897,5,3953,3966,5,3968,3972,5,3981,3991,5,4038,4038,5,4145,4145,7,4153,4154,5,4157,4158,5,4184,4185,5,4209,4212,5,4228,4228,7,4237,4237,5,4352,4447,8,4520,4607,10,5906,5908,5,5938,5939,5,5970,5971,5,6068,6069,5,6071,6077,5,6086,6086,5,6089,6099,5,6155,6157,5,6159,6159,5,6313,6313,5,6435,6438,7,6441,6443,7,6450,6450,5,6457,6459,5,6681,6682,7,6741,6741,7,6743,6743,7,6752,6752,5,6757,6764,5,6771,6780,5,6832,6845,5,6847,6862,5,6916,6916,7,6965,6965,5,6971,6971,7,6973,6977,7,6979,6980,7,7040,7041,5,7073,7073,7,7078,7079,7,7082,7082,7,7142,7142,5,7144,7145,5,7149,7149,5,7151,7153,5,7204,7211,7,7220,7221,7,7376,7378,5,7393,7393,7,7405,7405,5,7415,7415,7,7616,7679,5,8204,8204,5,8206,8207,4,8233,8233,4,8252,8252,14,8288,8292,4,8294,8303,4,8413,8416,5,8418,8420,5,8482,8482,14,8596,8601,14,8986,8987,14,9096,9096,14,9193,9196,14,9199,9199,14,9201,9202,14,9208,9210,14,9642,9643,14,9664,9664,14,9728,9729,14,9732,9732,14,9735,9741,14,9743,9744,14,9746,9746,14,9750,9751,14,9753,9756,14,9758,9759,14,9761,9761,14,9764,9765,14,9767,9769,14,9771,9773,14,9775,9775,14,9784,9785,14,9787,9791,14,9793,9793,14,9795,9799,14,9812,9822,14,9824,9824,14,9827,9827,14,9829,9830,14,9832,9832,14,9851,9851,14,9854,9854,14,9856,9861,14,9874,9874,14,9876,9876,14,9878,9879,14,9881,9881,14,9883,9884,14,9888,9889,14,9895,9895,14,9898,9899,14,9904,9905,14,9917,9918,14,9924,9925,14,9928,9928,14,9934,9934,14,9936,9936,14,9938,9938,14,9940,9940,14,9961,9961,14,9963,9967,14,9970,9971,14,9973,9973,14,9975,9977,14,9979,9980,14,9982,9985,14,9987,9988,14,9992,9996,14,9998,9998,14,10000,10001,14,10004,10004,14,10013,10013,14,10024,10024,14,10052,10052,14,10060,10060,14,10067,10069,14,10083,10083,14,10085,10087,14,10145,10145,14,10175,10175,14,11013,11015,14,11088,11088,14,11503,11505,5,11744,11775,5,12334,12335,5,12349,12349,14,12951,12951,14,42607,42607,5,42612,42621,5,42736,42737,5,43014,43014,5,43043,43044,7,43047,43047,7,43136,43137,7,43204,43205,5,43263,43263,5,43335,43345,5,43360,43388,8,43395,43395,7,43444,43445,7,43450,43451,7,43454,43456,7,43561,43566,5,43569,43570,5,43573,43574,5,43596,43596,5,43644,43644,5,43698,43700,5,43710,43711,5,43755,43755,7,43758,43759,7,43766,43766,5,44005,44005,5,44008,44008,5,44012,44012,7,44032,44032,11,44060,44060,11,44088,44088,11,44116,44116,11,44144,44144,11,44172,44172,11,44200,44200,11,44228,44228,11,44256,44256,11,44284,44284,11,44312,44312,11,44340,44340,11,44368,44368,11,44396,44396,11,44424,44424,11,44452,44452,11,44480,44480,11,44508,44508,11,44536,44536,11,44564,44564,11,44592,44592,11,44620,44620,11,44648,44648,11,44676,44676,11,44704,44704,11,44732,44732,11,44760,44760,11,44788,44788,11,44816,44816,11,44844,44844,11,44872,44872,11,44900,44900,11,44928,44928,11,44956,44956,11,44984,44984,11,45012,45012,11,45040,45040,11,45068,45068,11,45096,45096,11,45124,45124,11,45152,45152,11,45180,45180,11,45208,45208,11,45236,45236,11,45264,45264,11,45292,45292,11,45320,45320,11,45348,45348,11,45376,45376,11,45404,45404,11,45432,45432,11,45460,45460,11,45488,45488,11,45516,45516,11,45544,45544,11,45572,45572,11,45600,45600,11,45628,45628,11,45656,45656,11,45684,45684,11,45712,45712,11,45740,45740,11,45768,45768,11,45796,45796,11,45824,45824,11,45852,45852,11,45880,45880,11,45908,45908,11,45936,45936,11,45964,45964,11,45992,45992,11,46020,46020,11,46048,46048,11,46076,46076,11,46104,46104,11,46132,46132,11,46160,46160,11,46188,46188,11,46216,46216,11,46244,46244,11,46272,46272,11,46300,46300,11,46328,46328,11,46356,46356,11,46384,46384,11,46412,46412,11,46440,46440,11,46468,46468,11,46496,46496,11,46524,46524,11,46552,46552,11,46580,46580,11,46608,46608,11,46636,46636,11,46664,46664,11,46692,46692,11,46720,46720,11,46748,46748,11,46776,46776,11,46804,46804,11,46832,46832,11,46860,46860,11,46888,46888,11,46916,46916,11,46944,46944,11,46972,46972,11,47000,47000,11,47028,47028,11,47056,47056,11,47084,47084,11,47112,47112,11,47140,47140,11,47168,47168,11,47196,47196,11,47224,47224,11,47252,47252,11,47280,47280,11,47308,47308,11,47336,47336,11,47364,47364,11,47392,47392,11,47420,47420,11,47448,47448,11,47476,47476,11,47504,47504,11,47532,47532,11,47560,47560,11,47588,47588,11,47616,47616,11,47644,47644,11,47672,47672,11,47700,47700,11,47728,47728,11,47756,47756,11,47784,47784,11,47812,47812,11,47840,47840,11,47868,47868,11,47896,47896,11,47924,47924,11,47952,47952,11,47980,47980,11,48008,48008,11,48036,48036,11,48064,48064,11,48092,48092,11,48120,48120,11,48148,48148,11,48176,48176,11,48204,48204,11,48232,48232,11,48260,48260,11,48288,48288,11,48316,48316,11,48344,48344,11,48372,48372,11,48400,48400,11,48428,48428,11,48456,48456,11,48484,48484,11,48512,48512,11,48540,48540,11,48568,48568,11,48596,48596,11,48624,48624,11,48652,48652,11,48680,48680,11,48708,48708,11,48736,48736,11,48764,48764,11,48792,48792,11,48820,48820,11,48848,48848,11,48876,48876,11,48904,48904,11,48932,48932,11,48960,48960,11,48988,48988,11,49016,49016,11,49044,49044,11,49072,49072,11,49100,49100,11,49128,49128,11,49156,49156,11,49184,49184,11,49212,49212,11,49240,49240,11,49268,49268,11,49296,49296,11,49324,49324,11,49352,49352,11,49380,49380,11,49408,49408,11,49436,49436,11,49464,49464,11,49492,49492,11,49520,49520,11,49548,49548,11,49576,49576,11,49604,49604,11,49632,49632,11,49660,49660,11,49688,49688,11,49716,49716,11,49744,49744,11,49772,49772,11,49800,49800,11,49828,49828,11,49856,49856,11,49884,49884,11,49912,49912,11,49940,49940,11,49968,49968,11,49996,49996,11,50024,50024,11,50052,50052,11,50080,50080,11,50108,50108,11,50136,50136,11,50164,50164,11,50192,50192,11,50220,50220,11,50248,50248,11,50276,50276,11,50304,50304,11,50332,50332,11,50360,50360,11,50388,50388,11,50416,50416,11,50444,50444,11,50472,50472,11,50500,50500,11,50528,50528,11,50556,50556,11,50584,50584,11,50612,50612,11,50640,50640,11,50668,50668,11,50696,50696,11,50724,50724,11,50752,50752,11,50780,50780,11,50808,50808,11,50836,50836,11,50864,50864,11,50892,50892,11,50920,50920,11,50948,50948,11,50976,50976,11,51004,51004,11,51032,51032,11,51060,51060,11,51088,51088,11,51116,51116,11,51144,51144,11,51172,51172,11,51200,51200,11,51228,51228,11,51256,51256,11,51284,51284,11,51312,51312,11,51340,51340,11,51368,51368,11,51396,51396,11,51424,51424,11,51452,51452,11,51480,51480,11,51508,51508,11,51536,51536,11,51564,51564,11,51592,51592,11,51620,51620,11,51648,51648,11,51676,51676,11,51704,51704,11,51732,51732,11,51760,51760,11,51788,51788,11,51816,51816,11,51844,51844,11,51872,51872,11,51900,51900,11,51928,51928,11,51956,51956,11,51984,51984,11,52012,52012,11,52040,52040,11,52068,52068,11,52096,52096,11,52124,52124,11,52152,52152,11,52180,52180,11,52208,52208,11,52236,52236,11,52264,52264,11,52292,52292,11,52320,52320,11,52348,52348,11,52376,52376,11,52404,52404,11,52432,52432,11,52460,52460,11,52488,52488,11,52516,52516,11,52544,52544,11,52572,52572,11,52600,52600,11,52628,52628,11,52656,52656,11,52684,52684,11,52712,52712,11,52740,52740,11,52768,52768,11,52796,52796,11,52824,52824,11,52852,52852,11,52880,52880,11,52908,52908,11,52936,52936,11,52964,52964,11,52992,52992,11,53020,53020,11,53048,53048,11,53076,53076,11,53104,53104,11,53132,53132,11,53160,53160,11,53188,53188,11,53216,53216,11,53244,53244,11,53272,53272,11,53300,53300,11,53328,53328,11,53356,53356,11,53384,53384,11,53412,53412,11,53440,53440,11,53468,53468,11,53496,53496,11,53524,53524,11,53552,53552,11,53580,53580,11,53608,53608,11,53636,53636,11,53664,53664,11,53692,53692,11,53720,53720,11,53748,53748,11,53776,53776,11,53804,53804,11,53832,53832,11,53860,53860,11,53888,53888,11,53916,53916,11,53944,53944,11,53972,53972,11,54000,54000,11,54028,54028,11,54056,54056,11,54084,54084,11,54112,54112,11,54140,54140,11,54168,54168,11,54196,54196,11,54224,54224,11,54252,54252,11,54280,54280,11,54308,54308,11,54336,54336,11,54364,54364,11,54392,54392,11,54420,54420,11,54448,54448,11,54476,54476,11,54504,54504,11,54532,54532,11,54560,54560,11,54588,54588,11,54616,54616,11,54644,54644,11,54672,54672,11,54700,54700,11,54728,54728,11,54756,54756,11,54784,54784,11,54812,54812,11,54840,54840,11,54868,54868,11,54896,54896,11,54924,54924,11,54952,54952,11,54980,54980,11,55008,55008,11,55036,55036,11,55064,55064,11,55092,55092,11,55120,55120,11,55148,55148,11,55176,55176,11,55216,55238,9,64286,64286,5,65056,65071,5,65438,65439,5,65529,65531,4,66272,66272,5,68097,68099,5,68108,68111,5,68159,68159,5,68900,68903,5,69446,69456,5,69632,69632,7,69634,69634,7,69744,69744,5,69759,69761,5,69808,69810,7,69815,69816,7,69821,69821,1,69837,69837,1,69927,69931,5,69933,69940,5,70003,70003,5,70018,70018,7,70070,70078,5,70082,70083,1,70094,70094,7,70188,70190,7,70194,70195,7,70197,70197,7,70206,70206,5,70368,70370,7,70400,70401,5,70459,70460,5,70463,70463,7,70465,70468,7,70475,70477,7,70498,70499,7,70512,70516,5,70712,70719,5,70722,70724,5,70726,70726,5,70832,70832,5,70835,70840,5,70842,70842,5,70845,70845,5,70847,70848,5,70850,70851,5,71088,71089,7,71096,71099,7,71102,71102,7,71132,71133,5,71219,71226,5,71229,71229,5,71231,71232,5,71340,71340,7,71342,71343,7,71350,71350,7,71453,71455,5,71462,71462,7,71724,71726,7,71736,71736,7,71984,71984,5,71991,71992,7,71997,71997,7,71999,71999,1,72001,72001,1,72003,72003,5,72148,72151,5,72156,72159,7,72164,72164,7,72243,72248,5,72250,72250,1,72263,72263,5,72279,72280,7,72324,72329,1,72343,72343,7,72751,72751,7,72760,72765,5,72767,72767,5,72873,72873,7,72881,72881,7,72884,72884,7,73009,73014,5,73020,73021,5,73030,73030,1,73098,73102,7,73107,73108,7,73110,73110,7,73459,73460,5,78896,78904,4,92976,92982,5,94033,94087,7,94180,94180,5,113821,113822,5,118528,118573,5,119141,119141,5,119143,119145,5,119150,119154,5,119163,119170,5,119210,119213,5,121344,121398,5,121461,121461,5,121499,121503,5,122880,122886,5,122907,122913,5,122918,122922,5,123566,123566,5,125136,125142,5,126976,126979,14,126981,127182,14,127184,127231,14,127279,127279,14,127344,127345,14,127374,127374,14,127405,127461,14,127489,127490,14,127514,127514,14,127538,127546,14,127561,127567,14,127570,127743,14,127757,127758,14,127760,127760,14,127762,127762,14,127766,127768,14,127770,127770,14,127772,127772,14,127775,127776,14,127778,127779,14,127789,127791,14,127794,127795,14,127798,127798,14,127819,127819,14,127824,127824,14,127868,127868,14,127870,127871,14,127892,127893,14,127896,127896,14,127900,127901,14,127904,127940,14,127942,127942,14,127944,127944,14,127946,127946,14,127951,127955,14,127968,127971,14,127973,127984,14,127987,127987,14,127989,127989,14,127991,127991,14,127995,127999,5,128008,128008,14,128012,128014,14,128017,128018,14,128020,128020,14,128022,128022,14,128042,128042,14,128063,128063,14,128065,128065,14,128101,128101,14,128108,128109,14,128173,128173,14,128182,128183,14,128236,128237,14,128239,128239,14,128245,128245,14,128248,128248,14,128253,128253,14,128255,128258,14,128260,128263,14,128265,128265,14,128277,128277,14,128300,128301,14,128326,128328,14,128331,128334,14,128336,128347,14,128360,128366,14,128369,128370,14,128378,128378,14,128391,128391,14,128394,128397,14,128400,128400,14,128405,128406,14,128420,128420,14,128422,128423,14,128425,128432,14,128435,128443,14,128445,128449,14,128453,128464,14,128468,128475,14,128479,128480,14,128482,128482,14,128484,128487,14,128489,128494,14,128496,128498,14,128500,128505,14,128507,128511,14,128513,128518,14,128521,128525,14,128527,128527,14,128529,128529,14,128533,128533,14,128535,128535,14,128537,128537,14]");
}
const me = class me {
  static getInstance(t) {
    return me.cache.get(Array.from(t));
  }
  static getLocales() {
    return me._locales.value;
  }
  constructor(t) {
    this.confusableDictionary = t;
  }
  isAmbiguous(t) {
    return this.confusableDictionary.has(t);
  }
  /**
   * Returns the non basic ASCII code point that the given code point can be confused,
   * or undefined if such code point does note exist.
   */
  getPrimaryConfusable(t) {
    return this.confusableDictionary.get(t);
  }
  getConfusableCodePoints() {
    return new Set(this.confusableDictionary.keys());
  }
};
me.ambiguousCharacterData = new T1(() => JSON.parse('{"_common":[8232,32,8233,32,5760,32,8192,32,8193,32,8194,32,8195,32,8196,32,8197,32,8198,32,8200,32,8201,32,8202,32,8287,32,8199,32,8239,32,2042,95,65101,95,65102,95,65103,95,8208,45,8209,45,8210,45,65112,45,1748,45,8259,45,727,45,8722,45,10134,45,11450,45,1549,44,1643,44,8218,44,184,44,42233,44,894,59,2307,58,2691,58,1417,58,1795,58,1796,58,5868,58,65072,58,6147,58,6153,58,8282,58,1475,58,760,58,42889,58,8758,58,720,58,42237,58,451,33,11601,33,660,63,577,63,2429,63,5038,63,42731,63,119149,46,8228,46,1793,46,1794,46,42510,46,68176,46,1632,46,1776,46,42232,46,1373,96,65287,96,8219,96,8242,96,1370,96,1523,96,8175,96,65344,96,900,96,8189,96,8125,96,8127,96,8190,96,697,96,884,96,712,96,714,96,715,96,756,96,699,96,701,96,700,96,702,96,42892,96,1497,96,2036,96,2037,96,5194,96,5836,96,94033,96,94034,96,65339,91,10088,40,10098,40,12308,40,64830,40,65341,93,10089,41,10099,41,12309,41,64831,41,10100,123,119060,123,10101,125,65342,94,8270,42,1645,42,8727,42,66335,42,5941,47,8257,47,8725,47,8260,47,9585,47,10187,47,10744,47,119354,47,12755,47,12339,47,11462,47,20031,47,12035,47,65340,92,65128,92,8726,92,10189,92,10741,92,10745,92,119311,92,119355,92,12756,92,20022,92,12034,92,42872,38,708,94,710,94,5869,43,10133,43,66203,43,8249,60,10094,60,706,60,119350,60,5176,60,5810,60,5120,61,11840,61,12448,61,42239,61,8250,62,10095,62,707,62,119351,62,5171,62,94015,62,8275,126,732,126,8128,126,8764,126,65372,124,65293,45,120784,50,120794,50,120804,50,120814,50,120824,50,130034,50,42842,50,423,50,1000,50,42564,50,5311,50,42735,50,119302,51,120785,51,120795,51,120805,51,120815,51,120825,51,130035,51,42923,51,540,51,439,51,42858,51,11468,51,1248,51,94011,51,71882,51,120786,52,120796,52,120806,52,120816,52,120826,52,130036,52,5070,52,71855,52,120787,53,120797,53,120807,53,120817,53,120827,53,130037,53,444,53,71867,53,120788,54,120798,54,120808,54,120818,54,120828,54,130038,54,11474,54,5102,54,71893,54,119314,55,120789,55,120799,55,120809,55,120819,55,120829,55,130039,55,66770,55,71878,55,2819,56,2538,56,2666,56,125131,56,120790,56,120800,56,120810,56,120820,56,120830,56,130040,56,547,56,546,56,66330,56,2663,57,2920,57,2541,57,3437,57,120791,57,120801,57,120811,57,120821,57,120831,57,130041,57,42862,57,11466,57,71884,57,71852,57,71894,57,9082,97,65345,97,119834,97,119886,97,119938,97,119990,97,120042,97,120094,97,120146,97,120198,97,120250,97,120302,97,120354,97,120406,97,120458,97,593,97,945,97,120514,97,120572,97,120630,97,120688,97,120746,97,65313,65,119808,65,119860,65,119912,65,119964,65,120016,65,120068,65,120120,65,120172,65,120224,65,120276,65,120328,65,120380,65,120432,65,913,65,120488,65,120546,65,120604,65,120662,65,120720,65,5034,65,5573,65,42222,65,94016,65,66208,65,119835,98,119887,98,119939,98,119991,98,120043,98,120095,98,120147,98,120199,98,120251,98,120303,98,120355,98,120407,98,120459,98,388,98,5071,98,5234,98,5551,98,65314,66,8492,66,119809,66,119861,66,119913,66,120017,66,120069,66,120121,66,120173,66,120225,66,120277,66,120329,66,120381,66,120433,66,42932,66,914,66,120489,66,120547,66,120605,66,120663,66,120721,66,5108,66,5623,66,42192,66,66178,66,66209,66,66305,66,65347,99,8573,99,119836,99,119888,99,119940,99,119992,99,120044,99,120096,99,120148,99,120200,99,120252,99,120304,99,120356,99,120408,99,120460,99,7428,99,1010,99,11429,99,43951,99,66621,99,128844,67,71922,67,71913,67,65315,67,8557,67,8450,67,8493,67,119810,67,119862,67,119914,67,119966,67,120018,67,120174,67,120226,67,120278,67,120330,67,120382,67,120434,67,1017,67,11428,67,5087,67,42202,67,66210,67,66306,67,66581,67,66844,67,8574,100,8518,100,119837,100,119889,100,119941,100,119993,100,120045,100,120097,100,120149,100,120201,100,120253,100,120305,100,120357,100,120409,100,120461,100,1281,100,5095,100,5231,100,42194,100,8558,68,8517,68,119811,68,119863,68,119915,68,119967,68,120019,68,120071,68,120123,68,120175,68,120227,68,120279,68,120331,68,120383,68,120435,68,5024,68,5598,68,5610,68,42195,68,8494,101,65349,101,8495,101,8519,101,119838,101,119890,101,119942,101,120046,101,120098,101,120150,101,120202,101,120254,101,120306,101,120358,101,120410,101,120462,101,43826,101,1213,101,8959,69,65317,69,8496,69,119812,69,119864,69,119916,69,120020,69,120072,69,120124,69,120176,69,120228,69,120280,69,120332,69,120384,69,120436,69,917,69,120492,69,120550,69,120608,69,120666,69,120724,69,11577,69,5036,69,42224,69,71846,69,71854,69,66182,69,119839,102,119891,102,119943,102,119995,102,120047,102,120099,102,120151,102,120203,102,120255,102,120307,102,120359,102,120411,102,120463,102,43829,102,42905,102,383,102,7837,102,1412,102,119315,70,8497,70,119813,70,119865,70,119917,70,120021,70,120073,70,120125,70,120177,70,120229,70,120281,70,120333,70,120385,70,120437,70,42904,70,988,70,120778,70,5556,70,42205,70,71874,70,71842,70,66183,70,66213,70,66853,70,65351,103,8458,103,119840,103,119892,103,119944,103,120048,103,120100,103,120152,103,120204,103,120256,103,120308,103,120360,103,120412,103,120464,103,609,103,7555,103,397,103,1409,103,119814,71,119866,71,119918,71,119970,71,120022,71,120074,71,120126,71,120178,71,120230,71,120282,71,120334,71,120386,71,120438,71,1292,71,5056,71,5107,71,42198,71,65352,104,8462,104,119841,104,119945,104,119997,104,120049,104,120101,104,120153,104,120205,104,120257,104,120309,104,120361,104,120413,104,120465,104,1211,104,1392,104,5058,104,65320,72,8459,72,8460,72,8461,72,119815,72,119867,72,119919,72,120023,72,120179,72,120231,72,120283,72,120335,72,120387,72,120439,72,919,72,120494,72,120552,72,120610,72,120668,72,120726,72,11406,72,5051,72,5500,72,42215,72,66255,72,731,105,9075,105,65353,105,8560,105,8505,105,8520,105,119842,105,119894,105,119946,105,119998,105,120050,105,120102,105,120154,105,120206,105,120258,105,120310,105,120362,105,120414,105,120466,105,120484,105,618,105,617,105,953,105,8126,105,890,105,120522,105,120580,105,120638,105,120696,105,120754,105,1110,105,42567,105,1231,105,43893,105,5029,105,71875,105,65354,106,8521,106,119843,106,119895,106,119947,106,119999,106,120051,106,120103,106,120155,106,120207,106,120259,106,120311,106,120363,106,120415,106,120467,106,1011,106,1112,106,65322,74,119817,74,119869,74,119921,74,119973,74,120025,74,120077,74,120129,74,120181,74,120233,74,120285,74,120337,74,120389,74,120441,74,42930,74,895,74,1032,74,5035,74,5261,74,42201,74,119844,107,119896,107,119948,107,120000,107,120052,107,120104,107,120156,107,120208,107,120260,107,120312,107,120364,107,120416,107,120468,107,8490,75,65323,75,119818,75,119870,75,119922,75,119974,75,120026,75,120078,75,120130,75,120182,75,120234,75,120286,75,120338,75,120390,75,120442,75,922,75,120497,75,120555,75,120613,75,120671,75,120729,75,11412,75,5094,75,5845,75,42199,75,66840,75,1472,108,8739,73,9213,73,65512,73,1633,108,1777,73,66336,108,125127,108,120783,73,120793,73,120803,73,120813,73,120823,73,130033,73,65321,73,8544,73,8464,73,8465,73,119816,73,119868,73,119920,73,120024,73,120128,73,120180,73,120232,73,120284,73,120336,73,120388,73,120440,73,65356,108,8572,73,8467,108,119845,108,119897,108,119949,108,120001,108,120053,108,120105,73,120157,73,120209,73,120261,73,120313,73,120365,73,120417,73,120469,73,448,73,120496,73,120554,73,120612,73,120670,73,120728,73,11410,73,1030,73,1216,73,1493,108,1503,108,1575,108,126464,108,126592,108,65166,108,65165,108,1994,108,11599,73,5825,73,42226,73,93992,73,66186,124,66313,124,119338,76,8556,76,8466,76,119819,76,119871,76,119923,76,120027,76,120079,76,120131,76,120183,76,120235,76,120287,76,120339,76,120391,76,120443,76,11472,76,5086,76,5290,76,42209,76,93974,76,71843,76,71858,76,66587,76,66854,76,65325,77,8559,77,8499,77,119820,77,119872,77,119924,77,120028,77,120080,77,120132,77,120184,77,120236,77,120288,77,120340,77,120392,77,120444,77,924,77,120499,77,120557,77,120615,77,120673,77,120731,77,1018,77,11416,77,5047,77,5616,77,5846,77,42207,77,66224,77,66321,77,119847,110,119899,110,119951,110,120003,110,120055,110,120107,110,120159,110,120211,110,120263,110,120315,110,120367,110,120419,110,120471,110,1400,110,1404,110,65326,78,8469,78,119821,78,119873,78,119925,78,119977,78,120029,78,120081,78,120185,78,120237,78,120289,78,120341,78,120393,78,120445,78,925,78,120500,78,120558,78,120616,78,120674,78,120732,78,11418,78,42208,78,66835,78,3074,111,3202,111,3330,111,3458,111,2406,111,2662,111,2790,111,3046,111,3174,111,3302,111,3430,111,3664,111,3792,111,4160,111,1637,111,1781,111,65359,111,8500,111,119848,111,119900,111,119952,111,120056,111,120108,111,120160,111,120212,111,120264,111,120316,111,120368,111,120420,111,120472,111,7439,111,7441,111,43837,111,959,111,120528,111,120586,111,120644,111,120702,111,120760,111,963,111,120532,111,120590,111,120648,111,120706,111,120764,111,11423,111,4351,111,1413,111,1505,111,1607,111,126500,111,126564,111,126596,111,65259,111,65260,111,65258,111,65257,111,1726,111,64428,111,64429,111,64427,111,64426,111,1729,111,64424,111,64425,111,64423,111,64422,111,1749,111,3360,111,4125,111,66794,111,71880,111,71895,111,66604,111,1984,79,2534,79,2918,79,12295,79,70864,79,71904,79,120782,79,120792,79,120802,79,120812,79,120822,79,130032,79,65327,79,119822,79,119874,79,119926,79,119978,79,120030,79,120082,79,120134,79,120186,79,120238,79,120290,79,120342,79,120394,79,120446,79,927,79,120502,79,120560,79,120618,79,120676,79,120734,79,11422,79,1365,79,11604,79,4816,79,2848,79,66754,79,42227,79,71861,79,66194,79,66219,79,66564,79,66838,79,9076,112,65360,112,119849,112,119901,112,119953,112,120005,112,120057,112,120109,112,120161,112,120213,112,120265,112,120317,112,120369,112,120421,112,120473,112,961,112,120530,112,120544,112,120588,112,120602,112,120646,112,120660,112,120704,112,120718,112,120762,112,120776,112,11427,112,65328,80,8473,80,119823,80,119875,80,119927,80,119979,80,120031,80,120083,80,120187,80,120239,80,120291,80,120343,80,120395,80,120447,80,929,80,120504,80,120562,80,120620,80,120678,80,120736,80,11426,80,5090,80,5229,80,42193,80,66197,80,119850,113,119902,113,119954,113,120006,113,120058,113,120110,113,120162,113,120214,113,120266,113,120318,113,120370,113,120422,113,120474,113,1307,113,1379,113,1382,113,8474,81,119824,81,119876,81,119928,81,119980,81,120032,81,120084,81,120188,81,120240,81,120292,81,120344,81,120396,81,120448,81,11605,81,119851,114,119903,114,119955,114,120007,114,120059,114,120111,114,120163,114,120215,114,120267,114,120319,114,120371,114,120423,114,120475,114,43847,114,43848,114,7462,114,11397,114,43905,114,119318,82,8475,82,8476,82,8477,82,119825,82,119877,82,119929,82,120033,82,120189,82,120241,82,120293,82,120345,82,120397,82,120449,82,422,82,5025,82,5074,82,66740,82,5511,82,42211,82,94005,82,65363,115,119852,115,119904,115,119956,115,120008,115,120060,115,120112,115,120164,115,120216,115,120268,115,120320,115,120372,115,120424,115,120476,115,42801,115,445,115,1109,115,43946,115,71873,115,66632,115,65331,83,119826,83,119878,83,119930,83,119982,83,120034,83,120086,83,120138,83,120190,83,120242,83,120294,83,120346,83,120398,83,120450,83,1029,83,1359,83,5077,83,5082,83,42210,83,94010,83,66198,83,66592,83,119853,116,119905,116,119957,116,120009,116,120061,116,120113,116,120165,116,120217,116,120269,116,120321,116,120373,116,120425,116,120477,116,8868,84,10201,84,128872,84,65332,84,119827,84,119879,84,119931,84,119983,84,120035,84,120087,84,120139,84,120191,84,120243,84,120295,84,120347,84,120399,84,120451,84,932,84,120507,84,120565,84,120623,84,120681,84,120739,84,11430,84,5026,84,42196,84,93962,84,71868,84,66199,84,66225,84,66325,84,119854,117,119906,117,119958,117,120010,117,120062,117,120114,117,120166,117,120218,117,120270,117,120322,117,120374,117,120426,117,120478,117,42911,117,7452,117,43854,117,43858,117,651,117,965,117,120534,117,120592,117,120650,117,120708,117,120766,117,1405,117,66806,117,71896,117,8746,85,8899,85,119828,85,119880,85,119932,85,119984,85,120036,85,120088,85,120140,85,120192,85,120244,85,120296,85,120348,85,120400,85,120452,85,1357,85,4608,85,66766,85,5196,85,42228,85,94018,85,71864,85,8744,118,8897,118,65366,118,8564,118,119855,118,119907,118,119959,118,120011,118,120063,118,120115,118,120167,118,120219,118,120271,118,120323,118,120375,118,120427,118,120479,118,7456,118,957,118,120526,118,120584,118,120642,118,120700,118,120758,118,1141,118,1496,118,71430,118,43945,118,71872,118,119309,86,1639,86,1783,86,8548,86,119829,86,119881,86,119933,86,119985,86,120037,86,120089,86,120141,86,120193,86,120245,86,120297,86,120349,86,120401,86,120453,86,1140,86,11576,86,5081,86,5167,86,42719,86,42214,86,93960,86,71840,86,66845,86,623,119,119856,119,119908,119,119960,119,120012,119,120064,119,120116,119,120168,119,120220,119,120272,119,120324,119,120376,119,120428,119,120480,119,7457,119,1121,119,1309,119,1377,119,71434,119,71438,119,71439,119,43907,119,71919,87,71910,87,119830,87,119882,87,119934,87,119986,87,120038,87,120090,87,120142,87,120194,87,120246,87,120298,87,120350,87,120402,87,120454,87,1308,87,5043,87,5076,87,42218,87,5742,120,10539,120,10540,120,10799,120,65368,120,8569,120,119857,120,119909,120,119961,120,120013,120,120065,120,120117,120,120169,120,120221,120,120273,120,120325,120,120377,120,120429,120,120481,120,5441,120,5501,120,5741,88,9587,88,66338,88,71916,88,65336,88,8553,88,119831,88,119883,88,119935,88,119987,88,120039,88,120091,88,120143,88,120195,88,120247,88,120299,88,120351,88,120403,88,120455,88,42931,88,935,88,120510,88,120568,88,120626,88,120684,88,120742,88,11436,88,11613,88,5815,88,42219,88,66192,88,66228,88,66327,88,66855,88,611,121,7564,121,65369,121,119858,121,119910,121,119962,121,120014,121,120066,121,120118,121,120170,121,120222,121,120274,121,120326,121,120378,121,120430,121,120482,121,655,121,7935,121,43866,121,947,121,8509,121,120516,121,120574,121,120632,121,120690,121,120748,121,1199,121,4327,121,71900,121,65337,89,119832,89,119884,89,119936,89,119988,89,120040,89,120092,89,120144,89,120196,89,120248,89,120300,89,120352,89,120404,89,120456,89,933,89,978,89,120508,89,120566,89,120624,89,120682,89,120740,89,11432,89,1198,89,5033,89,5053,89,42220,89,94019,89,71844,89,66226,89,119859,122,119911,122,119963,122,120015,122,120067,122,120119,122,120171,122,120223,122,120275,122,120327,122,120379,122,120431,122,120483,122,7458,122,43923,122,71876,122,66293,90,71909,90,65338,90,8484,90,8488,90,119833,90,119885,90,119937,90,119989,90,120041,90,120197,90,120249,90,120301,90,120353,90,120405,90,120457,90,918,90,120493,90,120551,90,120609,90,120667,90,120725,90,5059,90,42204,90,71849,90,65282,34,65284,36,65285,37,65286,38,65290,42,65291,43,65294,46,65295,47,65296,48,65297,49,65298,50,65299,51,65300,52,65301,53,65302,54,65303,55,65304,56,65305,57,65308,60,65309,61,65310,62,65312,64,65316,68,65318,70,65319,71,65324,76,65329,81,65330,82,65333,85,65334,86,65335,87,65343,95,65346,98,65348,100,65350,102,65355,107,65357,109,65358,110,65361,113,65362,114,65364,116,65365,117,65367,119,65370,122,65371,123,65373,125,119846,109],"_default":[160,32,8211,45,65374,126,65306,58,65281,33,8216,96,8217,96,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],"cs":[65374,126,65306,58,65281,33,8216,96,8217,96,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],"de":[65374,126,65306,58,65281,33,8216,96,8217,96,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],"es":[8211,45,65374,126,65306,58,65281,33,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],"fr":[65374,126,65306,58,65281,33,8216,96,8245,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],"it":[160,32,8211,45,65374,126,65306,58,65281,33,8216,96,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],"ja":[8211,45,65306,58,65281,33,8216,96,8217,96,8245,96,180,96,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65292,44,65307,59],"ko":[8211,45,65374,126,65306,58,65281,33,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],"pl":[65374,126,65306,58,65281,33,8216,96,8217,96,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],"pt-BR":[65374,126,65306,58,65281,33,8216,96,8217,96,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],"qps-ploc":[160,32,8211,45,65374,126,65306,58,65281,33,8216,96,8217,96,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],"ru":[65374,126,65306,58,65281,33,8216,96,8217,96,8245,96,180,96,12494,47,305,105,921,73,1009,112,215,120,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],"tr":[160,32,8211,45,65374,126,65306,58,65281,33,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],"zh-hans":[65374,126,65306,58,65281,33,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65288,40,65289,41],"zh-hant":[8211,45,65374,126,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65307,59]}')), me.cache = new Mr({ getCacheKey: JSON.stringify }, (t) => {
  function n(f) {
    const h = /* @__PURE__ */ new Map();
    for (let d = 0; d < f.length; d += 2)
      h.set(f[d], f[d + 1]);
    return h;
  }
  function s(f, h) {
    const d = new Map(f);
    for (const [m, g] of h)
      d.set(m, g);
    return d;
  }
  function r(f, h) {
    if (!f)
      return h;
    const d = /* @__PURE__ */ new Map();
    for (const [m, g] of f)
      h.has(m) && d.set(m, g);
    return d;
  }
  const i = me.ambiguousCharacterData.value;
  let o = t.filter((f) => !f.startsWith("_") && f in i);
  o.length === 0 && (o = ["_default"]);
  let l;
  for (const f of o) {
    const h = n(i[f]);
    l = r(l, h);
  }
  const u = n(i._common), c = s(u, l);
  return new me(c);
}), me._locales = new T1(() => Object.keys(me.ambiguousCharacterData.value).filter((t) => !t.startsWith("_")));
let ht = me;
const ze = class ze {
  static getRawData() {
    return JSON.parse("[9,10,11,12,13,32,127,160,173,847,1564,4447,4448,6068,6069,6155,6156,6157,6158,7355,7356,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8203,8204,8205,8206,8207,8234,8235,8236,8237,8238,8239,8287,8288,8289,8290,8291,8292,8293,8294,8295,8296,8297,8298,8299,8300,8301,8302,8303,10240,12288,12644,65024,65025,65026,65027,65028,65029,65030,65031,65032,65033,65034,65035,65036,65037,65038,65039,65279,65440,65520,65521,65522,65523,65524,65525,65526,65527,65528,65532,78844,119155,119156,119157,119158,119159,119160,119161,119162,917504,917505,917506,917507,917508,917509,917510,917511,917512,917513,917514,917515,917516,917517,917518,917519,917520,917521,917522,917523,917524,917525,917526,917527,917528,917529,917530,917531,917532,917533,917534,917535,917536,917537,917538,917539,917540,917541,917542,917543,917544,917545,917546,917547,917548,917549,917550,917551,917552,917553,917554,917555,917556,917557,917558,917559,917560,917561,917562,917563,917564,917565,917566,917567,917568,917569,917570,917571,917572,917573,917574,917575,917576,917577,917578,917579,917580,917581,917582,917583,917584,917585,917586,917587,917588,917589,917590,917591,917592,917593,917594,917595,917596,917597,917598,917599,917600,917601,917602,917603,917604,917605,917606,917607,917608,917609,917610,917611,917612,917613,917614,917615,917616,917617,917618,917619,917620,917621,917622,917623,917624,917625,917626,917627,917628,917629,917630,917631,917760,917761,917762,917763,917764,917765,917766,917767,917768,917769,917770,917771,917772,917773,917774,917775,917776,917777,917778,917779,917780,917781,917782,917783,917784,917785,917786,917787,917788,917789,917790,917791,917792,917793,917794,917795,917796,917797,917798,917799,917800,917801,917802,917803,917804,917805,917806,917807,917808,917809,917810,917811,917812,917813,917814,917815,917816,917817,917818,917819,917820,917821,917822,917823,917824,917825,917826,917827,917828,917829,917830,917831,917832,917833,917834,917835,917836,917837,917838,917839,917840,917841,917842,917843,917844,917845,917846,917847,917848,917849,917850,917851,917852,917853,917854,917855,917856,917857,917858,917859,917860,917861,917862,917863,917864,917865,917866,917867,917868,917869,917870,917871,917872,917873,917874,917875,917876,917877,917878,917879,917880,917881,917882,917883,917884,917885,917886,917887,917888,917889,917890,917891,917892,917893,917894,917895,917896,917897,917898,917899,917900,917901,917902,917903,917904,917905,917906,917907,917908,917909,917910,917911,917912,917913,917914,917915,917916,917917,917918,917919,917920,917921,917922,917923,917924,917925,917926,917927,917928,917929,917930,917931,917932,917933,917934,917935,917936,917937,917938,917939,917940,917941,917942,917943,917944,917945,917946,917947,917948,917949,917950,917951,917952,917953,917954,917955,917956,917957,917958,917959,917960,917961,917962,917963,917964,917965,917966,917967,917968,917969,917970,917971,917972,917973,917974,917975,917976,917977,917978,917979,917980,917981,917982,917983,917984,917985,917986,917987,917988,917989,917990,917991,917992,917993,917994,917995,917996,917997,917998,917999]");
  }
  static getData() {
    return this._data || (this._data = new Set(ze.getRawData())), this._data;
  }
  static isInvisibleCharacter(t) {
    return ze.getData().has(t);
  }
  static get codePoints() {
    return ze.getData();
  }
};
ze._data = void 0;
let rt = ze, Ge;
const Gt = globalThis.vscode;
var Ms;
if (typeof Gt < "u" && typeof Gt.process < "u") {
  const e = Gt.process;
  Ge = {
    get platform() {
      return e.platform;
    },
    get arch() {
      return e.arch;
    },
    get env() {
      return e.env;
    },
    cwd() {
      return e.cwd();
    }
  };
} else
  typeof process < "u" && typeof ((Ms = process == null ? void 0 : process.versions) == null ? void 0 : Ms.node) == "string" ? Ge = {
    get platform() {
      return process.platform;
    },
    get arch() {
      return process.arch;
    },
    get env() {
      return process.env;
    },
    cwd() {
      return process.env.VSCODE_CWD || process.cwd();
    }
  } : Ge = {
    // Supported
    get platform() {
      return ct ? "win32" : vr ? "darwin" : "linux";
    },
    get arch() {
    },
    // Unsupported
    get env() {
      return {};
    },
    cwd() {
      return "/";
    }
  };
const yt = Ge.cwd, qr = Ge.env, Ur = Ge.platform, Hr = 65, $r = 97, Wr = 90, zr = 122, ye = 46, J = 47, se = 92, ve = 58, Or = 63;
class Is extends Error {
  constructor(t, n, s) {
    let r;
    typeof n == "string" && n.indexOf("not ") === 0 ? (r = "must not be", n = n.replace(/^not /, "")) : r = "must be";
    const i = t.indexOf(".") !== -1 ? "property" : "argument";
    let o = `The "${t}" ${i} ${r} of type ${n}`;
    o += `. Received type ${typeof s}`, super(o), this.code = "ERR_INVALID_ARG_TYPE";
  }
}
function jr(e, t) {
  if (e === null || typeof e != "object")
    throw new Is(t, "Object", e);
}
function G(e, t) {
  if (typeof e != "string")
    throw new Is(t, "string", e);
}
const Le = Ur === "win32";
function T(e) {
  return e === J || e === se;
}
function i1(e) {
  return e === J;
}
function Ne(e) {
  return e >= Hr && e <= Wr || e >= $r && e <= zr;
}
function Et(e, t, n, s) {
  let r = "", i = 0, o = -1, l = 0, u = 0;
  for (let c = 0; c <= e.length; ++c) {
    if (c < e.length)
      u = e.charCodeAt(c);
    else {
      if (s(u))
        break;
      u = J;
    }
    if (s(u)) {
      if (!(o === c - 1 || l === 1))
        if (l === 2) {
          if (r.length < 2 || i !== 2 || r.charCodeAt(r.length - 1) !== ye || r.charCodeAt(r.length - 2) !== ye) {
            if (r.length > 2) {
              const f = r.lastIndexOf(n);
              f === -1 ? (r = "", i = 0) : (r = r.slice(0, f), i = r.length - 1 - r.lastIndexOf(n)), o = c, l = 0;
              continue;
            } else if (r.length !== 0) {
              r = "", i = 0, o = c, l = 0;
              continue;
            }
          }
          t && (r += r.length > 0 ? `${n}..` : "..", i = 2);
        } else
          r.length > 0 ? r += `${n}${e.slice(o + 1, c)}` : r = e.slice(o + 1, c), i = c - o - 1;
      o = c, l = 0;
    } else
      u === ye && l !== -1 ? ++l : l = -1;
  }
  return r;
}
function Gr(e) {
  return e ? `${e[0] === "." ? "" : "."}${e}` : "";
}
function Vs(e, t) {
  jr(t, "pathObject");
  const n = t.dir || t.root, s = t.base || `${t.name || ""}${Gr(t.ext)}`;
  return n ? n === t.root ? `${n}${s}` : `${n}${e}${s}` : s;
}
const ee = {
  // path.resolve([from ...], to)
  resolve(...e) {
    let t = "", n = "", s = !1;
    for (let r = e.length - 1; r >= -1; r--) {
      let i;
      if (r >= 0) {
        if (i = e[r], G(i, `paths[${r}]`), i.length === 0)
          continue;
      } else
        t.length === 0 ? i = yt() : (i = qr[`=${t}`] || yt(), (i === void 0 || i.slice(0, 2).toLowerCase() !== t.toLowerCase() && i.charCodeAt(2) === se) && (i = `${t}\\`));
      const o = i.length;
      let l = 0, u = "", c = !1;
      const f = i.charCodeAt(0);
      if (o === 1)
        T(f) && (l = 1, c = !0);
      else if (T(f))
        if (c = !0, T(i.charCodeAt(1))) {
          let h = 2, d = h;
          for (; h < o && !T(i.charCodeAt(h)); )
            h++;
          if (h < o && h !== d) {
            const m = i.slice(d, h);
            for (d = h; h < o && T(i.charCodeAt(h)); )
              h++;
            if (h < o && h !== d) {
              for (d = h; h < o && !T(i.charCodeAt(h)); )
                h++;
              (h === o || h !== d) && (u = `\\\\${m}\\${i.slice(d, h)}`, l = h);
            }
          }
        } else
          l = 1;
      else
        Ne(f) && i.charCodeAt(1) === ve && (u = i.slice(0, 2), l = 2, o > 2 && T(i.charCodeAt(2)) && (c = !0, l = 3));
      if (u.length > 0)
        if (t.length > 0) {
          if (u.toLowerCase() !== t.toLowerCase())
            continue;
        } else
          t = u;
      if (s) {
        if (t.length > 0)
          break;
      } else if (n = `${i.slice(l)}\\${n}`, s = c, c && t.length > 0)
        break;
    }
    return n = Et(n, !s, "\\", T), s ? `${t}\\${n}` : `${t}${n}` || ".";
  },
  normalize(e) {
    G(e, "path");
    const t = e.length;
    if (t === 0)
      return ".";
    let n = 0, s, r = !1;
    const i = e.charCodeAt(0);
    if (t === 1)
      return i1(i) ? "\\" : e;
    if (T(i))
      if (r = !0, T(e.charCodeAt(1))) {
        let l = 2, u = l;
        for (; l < t && !T(e.charCodeAt(l)); )
          l++;
        if (l < t && l !== u) {
          const c = e.slice(u, l);
          for (u = l; l < t && T(e.charCodeAt(l)); )
            l++;
          if (l < t && l !== u) {
            for (u = l; l < t && !T(e.charCodeAt(l)); )
              l++;
            if (l === t)
              return `\\\\${c}\\${e.slice(u)}\\`;
            l !== u && (s = `\\\\${c}\\${e.slice(u, l)}`, n = l);
          }
        }
      } else
        n = 1;
    else
      Ne(i) && e.charCodeAt(1) === ve && (s = e.slice(0, 2), n = 2, t > 2 && T(e.charCodeAt(2)) && (r = !0, n = 3));
    let o = n < t ? Et(e.slice(n), !r, "\\", T) : "";
    return o.length === 0 && !r && (o = "."), o.length > 0 && T(e.charCodeAt(t - 1)) && (o += "\\"), s === void 0 ? r ? `\\${o}` : o : r ? `${s}\\${o}` : `${s}${o}`;
  },
  isAbsolute(e) {
    G(e, "path");
    const t = e.length;
    if (t === 0)
      return !1;
    const n = e.charCodeAt(0);
    return T(n) || // Possible device root
    t > 2 && Ne(n) && e.charCodeAt(1) === ve && T(e.charCodeAt(2));
  },
  join(...e) {
    if (e.length === 0)
      return ".";
    let t, n;
    for (let i = 0; i < e.length; ++i) {
      const o = e[i];
      G(o, "path"), o.length > 0 && (t === void 0 ? t = n = o : t += `\\${o}`);
    }
    if (t === void 0)
      return ".";
    let s = !0, r = 0;
    if (typeof n == "string" && T(n.charCodeAt(0))) {
      ++r;
      const i = n.length;
      i > 1 && T(n.charCodeAt(1)) && (++r, i > 2 && (T(n.charCodeAt(2)) ? ++r : s = !1));
    }
    if (s) {
      for (; r < t.length && T(t.charCodeAt(r)); )
        r++;
      r >= 2 && (t = `\\${t.slice(r)}`);
    }
    return ee.normalize(t);
  },
  // It will solve the relative path from `from` to `to`, for instance:
  //  from = 'C:\\orandea\\test\\aaa'
  //  to = 'C:\\orandea\\impl\\bbb'
  // The output of the function should be: '..\\..\\impl\\bbb'
  relative(e, t) {
    if (G(e, "from"), G(t, "to"), e === t)
      return "";
    const n = ee.resolve(e), s = ee.resolve(t);
    if (n === s || (e = n.toLowerCase(), t = s.toLowerCase(), e === t))
      return "";
    let r = 0;
    for (; r < e.length && e.charCodeAt(r) === se; )
      r++;
    let i = e.length;
    for (; i - 1 > r && e.charCodeAt(i - 1) === se; )
      i--;
    const o = i - r;
    let l = 0;
    for (; l < t.length && t.charCodeAt(l) === se; )
      l++;
    let u = t.length;
    for (; u - 1 > l && t.charCodeAt(u - 1) === se; )
      u--;
    const c = u - l, f = o < c ? o : c;
    let h = -1, d = 0;
    for (; d < f; d++) {
      const g = e.charCodeAt(r + d);
      if (g !== t.charCodeAt(l + d))
        break;
      g === se && (h = d);
    }
    if (d !== f) {
      if (h === -1)
        return s;
    } else {
      if (c > f) {
        if (t.charCodeAt(l + d) === se)
          return s.slice(l + d + 1);
        if (d === 2)
          return s.slice(l + d);
      }
      o > f && (e.charCodeAt(r + d) === se ? h = d : d === 2 && (h = 3)), h === -1 && (h = 0);
    }
    let m = "";
    for (d = r + h + 1; d <= i; ++d)
      (d === i || e.charCodeAt(d) === se) && (m += m.length === 0 ? ".." : "\\..");
    return l += h, m.length > 0 ? `${m}${s.slice(l, u)}` : (s.charCodeAt(l) === se && ++l, s.slice(l, u));
  },
  toNamespacedPath(e) {
    if (typeof e != "string" || e.length === 0)
      return e;
    const t = ee.resolve(e);
    if (t.length <= 2)
      return e;
    if (t.charCodeAt(0) === se) {
      if (t.charCodeAt(1) === se) {
        const n = t.charCodeAt(2);
        if (n !== Or && n !== ye)
          return `\\\\?\\UNC\\${t.slice(2)}`;
      }
    } else if (Ne(t.charCodeAt(0)) && t.charCodeAt(1) === ve && t.charCodeAt(2) === se)
      return `\\\\?\\${t}`;
    return e;
  },
  dirname(e) {
    G(e, "path");
    const t = e.length;
    if (t === 0)
      return ".";
    let n = -1, s = 0;
    const r = e.charCodeAt(0);
    if (t === 1)
      return T(r) ? e : ".";
    if (T(r)) {
      if (n = s = 1, T(e.charCodeAt(1))) {
        let l = 2, u = l;
        for (; l < t && !T(e.charCodeAt(l)); )
          l++;
        if (l < t && l !== u) {
          for (u = l; l < t && T(e.charCodeAt(l)); )
            l++;
          if (l < t && l !== u) {
            for (u = l; l < t && !T(e.charCodeAt(l)); )
              l++;
            if (l === t)
              return e;
            l !== u && (n = s = l + 1);
          }
        }
      }
    } else
      Ne(r) && e.charCodeAt(1) === ve && (n = t > 2 && T(e.charCodeAt(2)) ? 3 : 2, s = n);
    let i = -1, o = !0;
    for (let l = t - 1; l >= s; --l)
      if (T(e.charCodeAt(l))) {
        if (!o) {
          i = l;
          break;
        }
      } else
        o = !1;
    if (i === -1) {
      if (n === -1)
        return ".";
      i = n;
    }
    return e.slice(0, i);
  },
  basename(e, t) {
    t !== void 0 && G(t, "suffix"), G(e, "path");
    let n = 0, s = -1, r = !0, i;
    if (e.length >= 2 && Ne(e.charCodeAt(0)) && e.charCodeAt(1) === ve && (n = 2), t !== void 0 && t.length > 0 && t.length <= e.length) {
      if (t === e)
        return "";
      let o = t.length - 1, l = -1;
      for (i = e.length - 1; i >= n; --i) {
        const u = e.charCodeAt(i);
        if (T(u)) {
          if (!r) {
            n = i + 1;
            break;
          }
        } else
          l === -1 && (r = !1, l = i + 1), o >= 0 && (u === t.charCodeAt(o) ? --o === -1 && (s = i) : (o = -1, s = l));
      }
      return n === s ? s = l : s === -1 && (s = e.length), e.slice(n, s);
    }
    for (i = e.length - 1; i >= n; --i)
      if (T(e.charCodeAt(i))) {
        if (!r) {
          n = i + 1;
          break;
        }
      } else
        s === -1 && (r = !1, s = i + 1);
    return s === -1 ? "" : e.slice(n, s);
  },
  extname(e) {
    G(e, "path");
    let t = 0, n = -1, s = 0, r = -1, i = !0, o = 0;
    e.length >= 2 && e.charCodeAt(1) === ve && Ne(e.charCodeAt(0)) && (t = s = 2);
    for (let l = e.length - 1; l >= t; --l) {
      const u = e.charCodeAt(l);
      if (T(u)) {
        if (!i) {
          s = l + 1;
          break;
        }
        continue;
      }
      r === -1 && (i = !1, r = l + 1), u === ye ? n === -1 ? n = l : o !== 1 && (o = 1) : n !== -1 && (o = -1);
    }
    return n === -1 || r === -1 || // We saw a non-dot character immediately before the dot
    o === 0 || // The (right-most) trimmed path component is exactly '..'
    o === 1 && n === r - 1 && n === s + 1 ? "" : e.slice(n, r);
  },
  format: Vs.bind(null, "\\"),
  parse(e) {
    G(e, "path");
    const t = { root: "", dir: "", base: "", ext: "", name: "" };
    if (e.length === 0)
      return t;
    const n = e.length;
    let s = 0, r = e.charCodeAt(0);
    if (n === 1)
      return T(r) ? (t.root = t.dir = e, t) : (t.base = t.name = e, t);
    if (T(r)) {
      if (s = 1, T(e.charCodeAt(1))) {
        let h = 2, d = h;
        for (; h < n && !T(e.charCodeAt(h)); )
          h++;
        if (h < n && h !== d) {
          for (d = h; h < n && T(e.charCodeAt(h)); )
            h++;
          if (h < n && h !== d) {
            for (d = h; h < n && !T(e.charCodeAt(h)); )
              h++;
            h === n ? s = h : h !== d && (s = h + 1);
          }
        }
      }
    } else if (Ne(r) && e.charCodeAt(1) === ve) {
      if (n <= 2)
        return t.root = t.dir = e, t;
      if (s = 2, T(e.charCodeAt(2))) {
        if (n === 3)
          return t.root = t.dir = e, t;
        s = 3;
      }
    }
    s > 0 && (t.root = e.slice(0, s));
    let i = -1, o = s, l = -1, u = !0, c = e.length - 1, f = 0;
    for (; c >= s; --c) {
      if (r = e.charCodeAt(c), T(r)) {
        if (!u) {
          o = c + 1;
          break;
        }
        continue;
      }
      l === -1 && (u = !1, l = c + 1), r === ye ? i === -1 ? i = c : f !== 1 && (f = 1) : i !== -1 && (f = -1);
    }
    return l !== -1 && (i === -1 || // We saw a non-dot character immediately before the dot
    f === 0 || // The (right-most) trimmed path component is exactly '..'
    f === 1 && i === l - 1 && i === o + 1 ? t.base = t.name = e.slice(o, l) : (t.name = e.slice(o, i), t.base = e.slice(o, l), t.ext = e.slice(i, l))), o > 0 && o !== s ? t.dir = e.slice(0, o - 1) : t.dir = t.root, t;
  },
  sep: "\\",
  delimiter: ";",
  win32: null,
  posix: null
}, Xr = (() => {
  if (Le) {
    const e = /\\/g;
    return () => {
      const t = yt().replace(e, "/");
      return t.slice(t.indexOf("/"));
    };
  }
  return () => yt();
})(), te = {
  // path.resolve([from ...], to)
  resolve(...e) {
    let t = "", n = !1;
    for (let s = e.length - 1; s >= -1 && !n; s--) {
      const r = s >= 0 ? e[s] : Xr();
      G(r, `paths[${s}]`), r.length !== 0 && (t = `${r}/${t}`, n = r.charCodeAt(0) === J);
    }
    return t = Et(t, !n, "/", i1), n ? `/${t}` : t.length > 0 ? t : ".";
  },
  normalize(e) {
    if (G(e, "path"), e.length === 0)
      return ".";
    const t = e.charCodeAt(0) === J, n = e.charCodeAt(e.length - 1) === J;
    return e = Et(e, !t, "/", i1), e.length === 0 ? t ? "/" : n ? "./" : "." : (n && (e += "/"), t ? `/${e}` : e);
  },
  isAbsolute(e) {
    return G(e, "path"), e.length > 0 && e.charCodeAt(0) === J;
  },
  join(...e) {
    if (e.length === 0)
      return ".";
    let t;
    for (let n = 0; n < e.length; ++n) {
      const s = e[n];
      G(s, "path"), s.length > 0 && (t === void 0 ? t = s : t += `/${s}`);
    }
    return t === void 0 ? "." : te.normalize(t);
  },
  relative(e, t) {
    if (G(e, "from"), G(t, "to"), e === t || (e = te.resolve(e), t = te.resolve(t), e === t))
      return "";
    const n = 1, s = e.length, r = s - n, i = 1, o = t.length - i, l = r < o ? r : o;
    let u = -1, c = 0;
    for (; c < l; c++) {
      const h = e.charCodeAt(n + c);
      if (h !== t.charCodeAt(i + c))
        break;
      h === J && (u = c);
    }
    if (c === l)
      if (o > l) {
        if (t.charCodeAt(i + c) === J)
          return t.slice(i + c + 1);
        if (c === 0)
          return t.slice(i + c);
      } else
        r > l && (e.charCodeAt(n + c) === J ? u = c : c === 0 && (u = 0));
    let f = "";
    for (c = n + u + 1; c <= s; ++c)
      (c === s || e.charCodeAt(c) === J) && (f += f.length === 0 ? ".." : "/..");
    return `${f}${t.slice(i + u)}`;
  },
  toNamespacedPath(e) {
    return e;
  },
  dirname(e) {
    if (G(e, "path"), e.length === 0)
      return ".";
    const t = e.charCodeAt(0) === J;
    let n = -1, s = !0;
    for (let r = e.length - 1; r >= 1; --r)
      if (e.charCodeAt(r) === J) {
        if (!s) {
          n = r;
          break;
        }
      } else
        s = !1;
    return n === -1 ? t ? "/" : "." : t && n === 1 ? "//" : e.slice(0, n);
  },
  basename(e, t) {
    t !== void 0 && G(t, "ext"), G(e, "path");
    let n = 0, s = -1, r = !0, i;
    if (t !== void 0 && t.length > 0 && t.length <= e.length) {
      if (t === e)
        return "";
      let o = t.length - 1, l = -1;
      for (i = e.length - 1; i >= 0; --i) {
        const u = e.charCodeAt(i);
        if (u === J) {
          if (!r) {
            n = i + 1;
            break;
          }
        } else
          l === -1 && (r = !1, l = i + 1), o >= 0 && (u === t.charCodeAt(o) ? --o === -1 && (s = i) : (o = -1, s = l));
      }
      return n === s ? s = l : s === -1 && (s = e.length), e.slice(n, s);
    }
    for (i = e.length - 1; i >= 0; --i)
      if (e.charCodeAt(i) === J) {
        if (!r) {
          n = i + 1;
          break;
        }
      } else
        s === -1 && (r = !1, s = i + 1);
    return s === -1 ? "" : e.slice(n, s);
  },
  extname(e) {
    G(e, "path");
    let t = -1, n = 0, s = -1, r = !0, i = 0;
    for (let o = e.length - 1; o >= 0; --o) {
      const l = e.charCodeAt(o);
      if (l === J) {
        if (!r) {
          n = o + 1;
          break;
        }
        continue;
      }
      s === -1 && (r = !1, s = o + 1), l === ye ? t === -1 ? t = o : i !== 1 && (i = 1) : t !== -1 && (i = -1);
    }
    return t === -1 || s === -1 || // We saw a non-dot character immediately before the dot
    i === 0 || // The (right-most) trimmed path component is exactly '..'
    i === 1 && t === s - 1 && t === n + 1 ? "" : e.slice(t, s);
  },
  format: Vs.bind(null, "/"),
  parse(e) {
    G(e, "path");
    const t = { root: "", dir: "", base: "", ext: "", name: "" };
    if (e.length === 0)
      return t;
    const n = e.charCodeAt(0) === J;
    let s;
    n ? (t.root = "/", s = 1) : s = 0;
    let r = -1, i = 0, o = -1, l = !0, u = e.length - 1, c = 0;
    for (; u >= s; --u) {
      const f = e.charCodeAt(u);
      if (f === J) {
        if (!l) {
          i = u + 1;
          break;
        }
        continue;
      }
      o === -1 && (l = !1, o = u + 1), f === ye ? r === -1 ? r = u : c !== 1 && (c = 1) : r !== -1 && (c = -1);
    }
    if (o !== -1) {
      const f = i === 0 && n ? 1 : i;
      r === -1 || // We saw a non-dot character immediately before the dot
      c === 0 || // The (right-most) trimmed path component is exactly '..'
      c === 1 && r === o - 1 && r === i + 1 ? t.base = t.name = e.slice(f, o) : (t.name = e.slice(f, r), t.base = e.slice(f, o), t.ext = e.slice(r, o));
    }
    return i > 0 ? t.dir = e.slice(0, i - 1) : n && (t.dir = "/"), t;
  },
  sep: "/",
  delimiter: ":",
  win32: null,
  posix: null
};
te.win32 = ee.win32 = ee;
te.posix = ee.posix = te;
Le ? ee.normalize : te.normalize;
const Qr = Le ? ee.join : te.join;
Le ? ee.resolve : te.resolve;
Le ? ee.relative : te.relative;
Le ? ee.dirname : te.dirname;
Le ? ee.basename : te.basename;
Le ? ee.extname : te.extname;
Le ? ee.sep : te.sep;
const Yr = /^\w[\w\d+.-]*$/, Jr = /^\//, Zr = /^\/\//;
function Kr(e, t) {
  if (!e.scheme && t)
    throw new Error(`[UriError]: Scheme is missing: {scheme: "", authority: "${e.authority}", path: "${e.path}", query: "${e.query}", fragment: "${e.fragment}"}`);
  if (e.scheme && !Yr.test(e.scheme))
    throw new Error("[UriError]: Scheme contains illegal characters.");
  if (e.path) {
    if (e.authority) {
      if (!Jr.test(e.path))
        throw new Error('[UriError]: If a URI contains an authority component, then the path component must either be empty or begin with a slash ("/") character');
    } else if (Zr.test(e.path))
      throw new Error('[UriError]: If a URI does not contain an authority component, then the path cannot begin with two slash characters ("//")');
  }
}
function ei(e, t) {
  return !e && !t ? "file" : e;
}
function ti(e, t) {
  switch (e) {
    case "https":
    case "http":
    case "file":
      t ? t[0] !== fe && (t = fe + t) : t = fe;
      break;
  }
  return t;
}
const W = "", fe = "/", ni = /^(([^:/?#]+?):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/;
class re {
  static isUri(t) {
    return t instanceof re ? !0 : t ? typeof t.authority == "string" && typeof t.fragment == "string" && typeof t.path == "string" && typeof t.query == "string" && typeof t.scheme == "string" && typeof t.fsPath == "string" && typeof t.with == "function" && typeof t.toString == "function" : !1;
  }
  /**
   * @internal
   */
  constructor(t, n, s, r, i, o = !1) {
    typeof t == "object" ? (this.scheme = t.scheme || W, this.authority = t.authority || W, this.path = t.path || W, this.query = t.query || W, this.fragment = t.fragment || W) : (this.scheme = ei(t, o), this.authority = n || W, this.path = ti(this.scheme, s || W), this.query = r || W, this.fragment = i || W, Kr(this, o));
  }
  // ---- filesystem path -----------------------
  /**
   * Returns a string representing the corresponding file system path of this URI.
   * Will handle UNC paths, normalizes windows drive letters to lower-case, and uses the
   * platform specific path separator.
   *
   * * Will *not* validate the path for invalid characters and semantics.
   * * Will *not* look at the scheme of this URI.
   * * The result shall *not* be used for display purposes but for accessing a file on disk.
   *
   *
   * The *difference* to `URI#path` is the use of the platform specific separator and the handling
   * of UNC paths. See the below sample of a file-uri with an authority (UNC path).
   *
   * ```ts
      const u = URI.parse('file://server/c$/folder/file.txt')
      u.authority === 'server'
      u.path === '/shares/c$/file.txt'
      u.fsPath === '\\server\c$\folder\file.txt'
  ```
   *
   * Using `URI#path` to read a file (using fs-apis) would not be enough because parts of the path,
   * namely the server name, would be missing. Therefore `URI#fsPath` exists - it's sugar to ease working
   * with URIs that represent files on disk (`file` scheme).
   */
  get fsPath() {
    return a1(this, !1);
  }
  // ---- modify to new -------------------------
  with(t) {
    if (!t)
      return this;
    let { scheme: n, authority: s, path: r, query: i, fragment: o } = t;
    return n === void 0 ? n = this.scheme : n === null && (n = W), s === void 0 ? s = this.authority : s === null && (s = W), r === void 0 ? r = this.path : r === null && (r = W), i === void 0 ? i = this.query : i === null && (i = W), o === void 0 ? o = this.fragment : o === null && (o = W), n === this.scheme && s === this.authority && r === this.path && i === this.query && o === this.fragment ? this : new Te(n, s, r, i, o);
  }
  // ---- parse & validate ------------------------
  /**
   * Creates a new URI from a string, e.g. `http://www.example.com/some/path`,
   * `file:///usr/home`, or `scheme:with/path`.
   *
   * @param value A string which represents an URI (see `URI#toString`).
   */
  static parse(t, n = !1) {
    const s = ni.exec(t);
    return s ? new Te(s[2] || W, pt(s[4] || W), pt(s[5] || W), pt(s[7] || W), pt(s[9] || W), n) : new Te(W, W, W, W, W);
  }
  /**
   * Creates a new URI from a file system path, e.g. `c:\my\files`,
   * `/usr/home`, or `\\server\share\some\path`.
   *
   * The *difference* between `URI#parse` and `URI#file` is that the latter treats the argument
   * as path, not as stringified-uri. E.g. `URI.file(path)` is **not the same as**
   * `URI.parse('file://' + path)` because the path might contain characters that are
   * interpreted (# and ?). See the following sample:
   * ```ts
  const good = URI.file('/coding/c#/project1');
  good.scheme === 'file';
  good.path === '/coding/c#/project1';
  good.fragment === '';
  const bad = URI.parse('file://' + '/coding/c#/project1');
  bad.scheme === 'file';
  bad.path === '/coding/c'; // path is now broken
  bad.fragment === '/project1';
  ```
   *
   * @param path A file system path (see `URI#fsPath`)
   */
  static file(t) {
    let n = W;
    if (ct && (t = t.replace(/\\/g, fe)), t[0] === fe && t[1] === fe) {
      const s = t.indexOf(fe, 2);
      s === -1 ? (n = t.substring(2), t = fe) : (n = t.substring(2, s), t = t.substring(s) || fe);
    }
    return new Te("file", n, t, W, W);
  }
  /**
   * Creates new URI from uri components.
   *
   * Unless `strict` is `true` the scheme is defaults to be `file`. This function performs
   * validation and should be used for untrusted uri components retrieved from storage,
   * user input, command arguments etc
   */
  static from(t, n) {
    return new Te(t.scheme, t.authority, t.path, t.query, t.fragment, n);
  }
  /**
   * Join a URI path with path fragments and normalizes the resulting path.
   *
   * @param uri The input URI.
   * @param pathFragment The path fragment to add to the URI path.
   * @returns The resulting URI.
   */
  static joinPath(t, ...n) {
    if (!t.path)
      throw new Error("[UriError]: cannot call joinPath on URI without path");
    let s;
    return ct && t.scheme === "file" ? s = re.file(ee.join(a1(t, !0), ...n)).path : s = te.join(t.path, ...n), t.with({ path: s });
  }
  // ---- printing/externalize ---------------------------
  /**
   * Creates a string representation for this URI. It's guaranteed that calling
   * `URI.parse` with the result of this function creates an URI which is equal
   * to this URI.
   *
   * * The result shall *not* be used for display purposes but for externalization or transport.
   * * The result will be encoded using the percentage encoding and encoding happens mostly
   * ignore the scheme-specific encoding rules.
   *
   * @param skipEncoding Do not encode the result, default is `false`
   */
  toString(t = !1) {
    return o1(this, t);
  }
  toJSON() {
    return this;
  }
  static revive(t) {
    if (t) {
      if (t instanceof re)
        return t;
      {
        const n = new Te(t);
        return n._formatted = t.external ?? null, n._fsPath = t._sep === Bs ? t.fsPath ?? null : null, n;
      }
    } else
      return t;
  }
}
const Bs = ct ? 1 : void 0;
class Te extends re {
  constructor() {
    super(...arguments), this._formatted = null, this._fsPath = null;
  }
  get fsPath() {
    return this._fsPath || (this._fsPath = a1(this, !1)), this._fsPath;
  }
  toString(t = !1) {
    return t ? o1(this, !0) : (this._formatted || (this._formatted = o1(this, !1)), this._formatted);
  }
  toJSON() {
    const t = {
      $mid: 1
      /* MarshalledId.Uri */
    };
    return this._fsPath && (t.fsPath = this._fsPath, t._sep = Bs), this._formatted && (t.external = this._formatted), this.path && (t.path = this.path), this.scheme && (t.scheme = this.scheme), this.authority && (t.authority = this.authority), this.query && (t.query = this.query), this.fragment && (t.fragment = this.fragment), t;
  }
}
const qs = {
  58: "%3A",
  // gen-delims
  47: "%2F",
  63: "%3F",
  35: "%23",
  91: "%5B",
  93: "%5D",
  64: "%40",
  33: "%21",
  // sub-delims
  36: "%24",
  38: "%26",
  39: "%27",
  40: "%28",
  41: "%29",
  42: "%2A",
  43: "%2B",
  44: "%2C",
  59: "%3B",
  61: "%3D",
  32: "%20"
};
function V1(e, t, n) {
  let s, r = -1;
  for (let i = 0; i < e.length; i++) {
    const o = e.charCodeAt(i);
    if (o >= 97 && o <= 122 || o >= 65 && o <= 90 || o >= 48 && o <= 57 || o === 45 || o === 46 || o === 95 || o === 126 || t && o === 47 || n && o === 91 || n && o === 93 || n && o === 58)
      r !== -1 && (s += encodeURIComponent(e.substring(r, i)), r = -1), s !== void 0 && (s += e.charAt(i));
    else {
      s === void 0 && (s = e.substr(0, i));
      const l = qs[o];
      l !== void 0 ? (r !== -1 && (s += encodeURIComponent(e.substring(r, i)), r = -1), s += l) : r === -1 && (r = i);
    }
  }
  return r !== -1 && (s += encodeURIComponent(e.substring(r))), s !== void 0 ? s : e;
}
function si(e) {
  let t;
  for (let n = 0; n < e.length; n++) {
    const s = e.charCodeAt(n);
    s === 35 || s === 63 ? (t === void 0 && (t = e.substr(0, n)), t += qs[s]) : t !== void 0 && (t += e[n]);
  }
  return t !== void 0 ? t : e;
}
function a1(e, t) {
  let n;
  return e.authority && e.path.length > 1 && e.scheme === "file" ? n = `//${e.authority}${e.path}` : e.path.charCodeAt(0) === 47 && (e.path.charCodeAt(1) >= 65 && e.path.charCodeAt(1) <= 90 || e.path.charCodeAt(1) >= 97 && e.path.charCodeAt(1) <= 122) && e.path.charCodeAt(2) === 58 ? t ? n = e.path.substr(1) : n = e.path[1].toLowerCase() + e.path.substr(2) : n = e.path, ct && (n = n.replace(/\//g, "\\")), n;
}
function o1(e, t) {
  const n = t ? si : V1;
  let s = "", { scheme: r, authority: i, path: o, query: l, fragment: u } = e;
  if (r && (s += r, s += ":"), (i || r === "file") && (s += fe, s += fe), i) {
    let c = i.indexOf("@");
    if (c !== -1) {
      const f = i.substr(0, c);
      i = i.substr(c + 1), c = f.lastIndexOf(":"), c === -1 ? s += n(f, !1, !1) : (s += n(f.substr(0, c), !1, !1), s += ":", s += n(f.substr(c + 1), !1, !0)), s += "@";
    }
    i = i.toLowerCase(), c = i.lastIndexOf(":"), c === -1 ? s += n(i, !1, !0) : (s += n(i.substr(0, c), !1, !0), s += i.substr(c));
  }
  if (o) {
    if (o.length >= 3 && o.charCodeAt(0) === 47 && o.charCodeAt(2) === 58) {
      const c = o.charCodeAt(1);
      c >= 65 && c <= 90 && (o = `/${String.fromCharCode(c + 32)}:${o.substr(3)}`);
    } else if (o.length >= 2 && o.charCodeAt(1) === 58) {
      const c = o.charCodeAt(0);
      c >= 65 && c <= 90 && (o = `${String.fromCharCode(c + 32)}:${o.substr(2)}`);
    }
    s += n(o, !0, !1);
  }
  return l && (s += "?", s += n(l, !1, !1)), u && (s += "#", s += t ? u : V1(u, !1, !1)), s;
}
function Us(e) {
  try {
    return decodeURIComponent(e);
  } catch {
    return e.length > 3 ? e.substr(0, 3) + Us(e.substr(3)) : e;
  }
}
const B1 = /(%[0-9A-Za-z][0-9A-Za-z])+/g;
function pt(e) {
  return e.match(B1) ? e.replace(B1, (t) => Us(t)) : e;
}
var Re;
(function(e) {
  e.inMemory = "inmemory", e.vscode = "vscode", e.internal = "private", e.walkThrough = "walkThrough", e.walkThroughSnippet = "walkThroughSnippet", e.http = "http", e.https = "https", e.file = "file", e.mailto = "mailto", e.untitled = "untitled", e.data = "data", e.command = "command", e.vscodeRemote = "vscode-remote", e.vscodeRemoteResource = "vscode-remote-resource", e.vscodeManagedRemoteResource = "vscode-managed-remote-resource", e.vscodeUserData = "vscode-userdata", e.vscodeCustomEditor = "vscode-custom-editor", e.vscodeNotebookCell = "vscode-notebook-cell", e.vscodeNotebookCellMetadata = "vscode-notebook-cell-metadata", e.vscodeNotebookCellMetadataDiff = "vscode-notebook-cell-metadata-diff", e.vscodeNotebookCellOutput = "vscode-notebook-cell-output", e.vscodeNotebookCellOutputDiff = "vscode-notebook-cell-output-diff", e.vscodeNotebookMetadata = "vscode-notebook-metadata", e.vscodeInteractiveInput = "vscode-interactive-input", e.vscodeSettings = "vscode-settings", e.vscodeWorkspaceTrust = "vscode-workspace-trust", e.vscodeTerminal = "vscode-terminal", e.vscodeChatCodeBlock = "vscode-chat-code-block", e.vscodeChatCodeCompareBlock = "vscode-chat-code-compare-block", e.vscodeChatSesssion = "vscode-chat-editor", e.webviewPanel = "webview-panel", e.vscodeWebview = "vscode-webview", e.extension = "extension", e.vscodeFileResource = "vscode-file", e.tmp = "tmp", e.vsls = "vsls", e.vscodeSourceControl = "vscode-scm", e.commentsInput = "comment", e.codeSetting = "code-setting", e.outputChannel = "output";
})(Re || (Re = {}));
const ri = "tkn";
class ii {
  constructor() {
    this._hosts = /* @__PURE__ */ Object.create(null), this._ports = /* @__PURE__ */ Object.create(null), this._connectionTokens = /* @__PURE__ */ Object.create(null), this._preferredWebSchema = "http", this._delegate = null, this._serverRootPath = "/";
  }
  setPreferredWebSchema(t) {
    this._preferredWebSchema = t;
  }
  get _remoteResourcesPath() {
    return te.join(this._serverRootPath, Re.vscodeRemoteResource);
  }
  rewrite(t) {
    if (this._delegate)
      try {
        return this._delegate(t);
      } catch (l) {
        return st(l), t;
      }
    const n = t.authority;
    let s = this._hosts[n];
    s && s.indexOf(":") !== -1 && s.indexOf("[") === -1 && (s = `[${s}]`);
    const r = this._ports[n], i = this._connectionTokens[n];
    let o = `path=${encodeURIComponent(t.path)}`;
    return typeof i == "string" && (o += `&${ri}=${encodeURIComponent(i)}`), re.from({
      scheme: Sr ? this._preferredWebSchema : Re.vscodeRemoteResource,
      authority: `${s}:${r}`,
      path: this._remoteResourcesPath,
      query: o
    });
  }
}
const ai = new ii(), oi = "vscode-app", at = class at {
  /**
   * Returns a URI to use in contexts where the browser is responsible
   * for loading (e.g. fetch()) or when used within the DOM.
   *
   * **Note:** use `dom.ts#asCSSUrl` whenever the URL is to be used in CSS context.
   */
  asBrowserUri(t) {
    const n = this.toUri(t);
    return this.uriToBrowserUri(n);
  }
  /**
   * Returns a URI to use in contexts where the browser is responsible
   * for loading (e.g. fetch()) or when used within the DOM.
   *
   * **Note:** use `dom.ts#asCSSUrl` whenever the URL is to be used in CSS context.
   */
  uriToBrowserUri(t) {
    return t.scheme === Re.vscodeRemote ? ai.rewrite(t) : (
      // ...only ever for `file` resources
      t.scheme === Re.file && // ...and we run in native environments
      (Nr || // ...or web worker extensions on desktop
      Ar === `${Re.vscodeFileResource}://${at.FALLBACK_AUTHORITY}`) ? t.with({
        scheme: Re.vscodeFileResource,
        // We need to provide an authority here so that it can serve
        // as origin for network and loading matters in chromium.
        // If the URI is not coming with an authority already, we
        // add our own
        authority: t.authority || at.FALLBACK_AUTHORITY,
        query: null,
        fragment: null
      }) : t
    );
  }
  toUri(t, n) {
    if (re.isUri(t))
      return t;
    if (globalThis._VSCODE_FILE_ROOT) {
      const s = globalThis._VSCODE_FILE_ROOT;
      if (/^\w[\w\d+.-]*:\/\//.test(s))
        return re.joinPath(re.parse(s, !0), t);
      const r = Qr(s, t);
      return re.file(r);
    }
    return re.parse(n.toUrl(t));
  }
};
at.FALLBACK_AUTHORITY = oi;
let l1 = at;
const Hs = new l1();
var q1;
(function(e) {
  const t = /* @__PURE__ */ new Map([
    ["1", { "Cross-Origin-Opener-Policy": "same-origin" }],
    ["2", { "Cross-Origin-Embedder-Policy": "require-corp" }],
    ["3", { "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "require-corp" }]
  ]);
  e.CoopAndCoep = Object.freeze(t.get("3"));
  const n = "vscode-coi";
  function s(i) {
    let o;
    typeof i == "string" ? o = new URL(i).searchParams : i instanceof URL ? o = i.searchParams : re.isUri(i) && (o = new URL(i.toString(!0)).searchParams);
    const l = o == null ? void 0 : o.get(n);
    if (l)
      return t.get(l);
  }
  e.getHeadersFromQuery = s;
  function r(i, o, l) {
    if (!globalThis.crossOriginIsolated)
      return;
    const u = o && l ? "3" : l ? "2" : "1";
    i instanceof URLSearchParams ? i.set(n, u) : i[n] = u;
  }
  e.addSearchParam = r;
})(q1 || (q1 = {}));
const Xt = "default", li = "$initialize";
class ui {
  constructor(t, n, s, r, i) {
    this.vsWorker = t, this.req = n, this.channel = s, this.method = r, this.args = i, this.type = 0;
  }
}
class U1 {
  constructor(t, n, s, r) {
    this.vsWorker = t, this.seq = n, this.res = s, this.err = r, this.type = 1;
  }
}
class ci {
  constructor(t, n, s, r, i) {
    this.vsWorker = t, this.req = n, this.channel = s, this.eventName = r, this.arg = i, this.type = 2;
  }
}
class hi {
  constructor(t, n, s) {
    this.vsWorker = t, this.req = n, this.event = s, this.type = 3;
  }
}
class fi {
  constructor(t, n) {
    this.vsWorker = t, this.req = n, this.type = 4;
  }
}
class di {
  constructor(t) {
    this._workerId = -1, this._handler = t, this._lastSentReq = 0, this._pendingReplies = /* @__PURE__ */ Object.create(null), this._pendingEmitters = /* @__PURE__ */ new Map(), this._pendingEvents = /* @__PURE__ */ new Map();
  }
  setWorkerId(t) {
    this._workerId = t;
  }
  sendMessage(t, n, s) {
    const r = String(++this._lastSentReq);
    return new Promise((i, o) => {
      this._pendingReplies[r] = {
        resolve: i,
        reject: o
      }, this._send(new ui(this._workerId, r, t, n, s));
    });
  }
  listen(t, n, s) {
    let r = null;
    const i = new le({
      onWillAddFirstListener: () => {
        r = String(++this._lastSentReq), this._pendingEmitters.set(r, i), this._send(new ci(this._workerId, r, t, n, s));
      },
      onDidRemoveLastListener: () => {
        this._pendingEmitters.delete(r), this._send(new fi(this._workerId, r)), r = null;
      }
    });
    return i.event;
  }
  handleMessage(t) {
    !t || !t.vsWorker || this._workerId !== -1 && t.vsWorker !== this._workerId || this._handleMessage(t);
  }
  createProxyToRemoteChannel(t, n) {
    const s = {
      get: (r, i) => (typeof i == "string" && !r[i] && (Ws(i) ? r[i] = (o) => this.listen(t, i, o) : $s(i) ? r[i] = this.listen(t, i, void 0) : i.charCodeAt(0) === 36 && (r[i] = async (...o) => (await (n == null ? void 0 : n()), this.sendMessage(t, i, o)))), r[i])
    };
    return new Proxy(/* @__PURE__ */ Object.create(null), s);
  }
  _handleMessage(t) {
    switch (t.type) {
      case 1:
        return this._handleReplyMessage(t);
      case 0:
        return this._handleRequestMessage(t);
      case 2:
        return this._handleSubscribeEventMessage(t);
      case 3:
        return this._handleEventMessage(t);
      case 4:
        return this._handleUnsubscribeEventMessage(t);
    }
  }
  _handleReplyMessage(t) {
    if (!this._pendingReplies[t.seq]) {
      console.warn("Got reply to unknown seq");
      return;
    }
    const n = this._pendingReplies[t.seq];
    if (delete this._pendingReplies[t.seq], t.err) {
      let s = t.err;
      t.err.$isError && (s = new Error(), s.name = t.err.name, s.message = t.err.message, s.stack = t.err.stack), n.reject(s);
      return;
    }
    n.resolve(t.res);
  }
  _handleRequestMessage(t) {
    const n = t.req;
    this._handler.handleMessage(t.channel, t.method, t.args).then((r) => {
      this._send(new U1(this._workerId, n, r, void 0));
    }, (r) => {
      r.detail instanceof Error && (r.detail = F1(r.detail)), this._send(new U1(this._workerId, n, void 0, F1(r)));
    });
  }
  _handleSubscribeEventMessage(t) {
    const n = t.req, s = this._handler.handleEvent(t.channel, t.eventName, t.arg)((r) => {
      this._send(new hi(this._workerId, n, r));
    });
    this._pendingEvents.set(n, s);
  }
  _handleEventMessage(t) {
    if (!this._pendingEmitters.has(t.req)) {
      console.warn("Got event for unknown req");
      return;
    }
    this._pendingEmitters.get(t.req).fire(t.event);
  }
  _handleUnsubscribeEventMessage(t) {
    if (!this._pendingEvents.has(t.req)) {
      console.warn("Got unsubscribe for unknown req");
      return;
    }
    this._pendingEvents.get(t.req).dispose(), this._pendingEvents.delete(t.req);
  }
  _send(t) {
    const n = [];
    if (t.type === 0)
      for (let s = 0; s < t.args.length; s++)
        t.args[s] instanceof ArrayBuffer && n.push(t.args[s]);
    else
      t.type === 1 && t.res instanceof ArrayBuffer && n.push(t.res);
    this._handler.sendMessage(t, n);
  }
}
function $s(e) {
  return e[0] === "o" && e[1] === "n" && Ds(e.charCodeAt(2));
}
function Ws(e) {
  return /^onDynamic/.test(e) && Ds(e.charCodeAt(9));
}
class mi {
  constructor(t, n) {
    this._localChannels = /* @__PURE__ */ new Map(), this._remoteChannels = /* @__PURE__ */ new Map(), this._requestHandlerFactory = n, this._requestHandler = null, this._protocol = new di({
      sendMessage: (s, r) => {
        t(s, r);
      },
      handleMessage: (s, r, i) => this._handleMessage(s, r, i),
      handleEvent: (s, r, i) => this._handleEvent(s, r, i)
    });
  }
  onmessage(t) {
    this._protocol.handleMessage(t);
  }
  _handleMessage(t, n, s) {
    if (t === Xt && n === li)
      return this.initialize(s[0], s[1], s[2]);
    const r = t === Xt ? this._requestHandler : this._localChannels.get(t);
    if (!r)
      return Promise.reject(new Error(`Missing channel ${t} on worker thread`));
    if (typeof r[n] != "function")
      return Promise.reject(new Error(`Missing method ${n} on worker thread channel ${t}`));
    try {
      return Promise.resolve(r[n].apply(r, s));
    } catch (i) {
      return Promise.reject(i);
    }
  }
  _handleEvent(t, n, s) {
    const r = t === Xt ? this._requestHandler : this._localChannels.get(t);
    if (!r)
      throw new Error(`Missing channel ${t} on worker thread`);
    if (Ws(n)) {
      const i = r[n].call(r, s);
      if (typeof i != "function")
        throw new Error(`Missing dynamic event ${n} on request handler.`);
      return i;
    }
    if ($s(n)) {
      const i = r[n];
      if (typeof i != "function")
        throw new Error(`Missing event ${n} on request handler.`);
      return i;
    }
    throw new Error(`Malformed event name ${n}`);
  }
  getChannel(t) {
    if (!this._remoteChannels.has(t)) {
      const n = this._protocol.createProxyToRemoteChannel(t);
      this._remoteChannels.set(t, n);
    }
    return this._remoteChannels.get(t);
  }
  async initialize(t, n, s) {
    if (this._protocol.setWorkerId(t), this._requestHandlerFactory) {
      this._requestHandler = this._requestHandlerFactory(this);
      return;
    }
    return n && (typeof n.baseUrl < "u" && delete n.baseUrl, typeof n.paths < "u" && typeof n.paths.vs < "u" && delete n.paths.vs, typeof n.trustedTypesPolicy < "u" && delete n.trustedTypesPolicy, n.catchError = !0, globalThis.require.config(n)), import(`${Hs.asBrowserUri(`${s}.js`).toString(!0)}`).then((i) => {
      if (this._requestHandler = i.create(this), !this._requestHandler)
        throw new Error("No RequestHandler!");
    });
  }
}
class Se {
  /**
   * Constructs a new DiffChange with the given sequence information
   * and content.
   */
  constructor(t, n, s, r) {
    this.originalStart = t, this.originalLength = n, this.modifiedStart = s, this.modifiedLength = r;
  }
  /**
   * The end point (exclusive) of the change in the original sequence.
   */
  getOriginalEnd() {
    return this.originalStart + this.originalLength;
  }
  /**
   * The end point (exclusive) of the change in the modified sequence.
   */
  getModifiedEnd() {
    return this.modifiedStart + this.modifiedLength;
  }
}
function H1(e, t) {
  return (t << 5) - t + e | 0;
}
function gi(e, t) {
  t = H1(149417, t);
  for (let n = 0, s = e.length; n < s; n++)
    t = H1(e.charCodeAt(n), t);
  return t;
}
function Qt(e, t, n = 32) {
  const s = n - t, r = ~((1 << s) - 1);
  return (e << t | (r & e) >>> s) >>> 0;
}
function $1(e, t = 0, n = e.byteLength, s = 0) {
  for (let r = 0; r < n; r++)
    e[t + r] = s;
}
function bi(e, t, n = "0") {
  for (; e.length < t; )
    e = n + e;
  return e;
}
function Ke(e, t = 32) {
  return e instanceof ArrayBuffer ? Array.from(new Uint8Array(e)).map((n) => n.toString(16).padStart(2, "0")).join("") : bi((e >>> 0).toString(16), t / 4);
}
const Bt = class Bt {
  // 80 * 4 = 320
  constructor() {
    this._h0 = 1732584193, this._h1 = 4023233417, this._h2 = 2562383102, this._h3 = 271733878, this._h4 = 3285377520, this._buff = new Uint8Array(
      67
      /* to fit any utf-8 */
    ), this._buffDV = new DataView(this._buff.buffer), this._buffLen = 0, this._totalLen = 0, this._leftoverHighSurrogate = 0, this._finished = !1;
  }
  update(t) {
    const n = t.length;
    if (n === 0)
      return;
    const s = this._buff;
    let r = this._buffLen, i = this._leftoverHighSurrogate, o, l;
    for (i !== 0 ? (o = i, l = -1, i = 0) : (o = t.charCodeAt(0), l = 0); ; ) {
      let u = o;
      if (Rt(o))
        if (l + 1 < n) {
          const c = t.charCodeAt(l + 1);
          r1(c) ? (l++, u = Ts(o, c)) : u = 65533;
        } else {
          i = o;
          break;
        }
      else
        r1(o) && (u = 65533);
      if (r = this._push(s, r, u), l++, l < n)
        o = t.charCodeAt(l);
      else
        break;
    }
    this._buffLen = r, this._leftoverHighSurrogate = i;
  }
  _push(t, n, s) {
    return s < 128 ? t[n++] = s : s < 2048 ? (t[n++] = 192 | (s & 1984) >>> 6, t[n++] = 128 | (s & 63) >>> 0) : s < 65536 ? (t[n++] = 224 | (s & 61440) >>> 12, t[n++] = 128 | (s & 4032) >>> 6, t[n++] = 128 | (s & 63) >>> 0) : (t[n++] = 240 | (s & 1835008) >>> 18, t[n++] = 128 | (s & 258048) >>> 12, t[n++] = 128 | (s & 4032) >>> 6, t[n++] = 128 | (s & 63) >>> 0), n >= 64 && (this._step(), n -= 64, this._totalLen += 64, t[0] = t[64], t[1] = t[65], t[2] = t[66]), n;
  }
  digest() {
    return this._finished || (this._finished = !0, this._leftoverHighSurrogate && (this._leftoverHighSurrogate = 0, this._buffLen = this._push(
      this._buff,
      this._buffLen,
      65533
      /* SHA1Constant.UNICODE_REPLACEMENT */
    )), this._totalLen += this._buffLen, this._wrapUp()), Ke(this._h0) + Ke(this._h1) + Ke(this._h2) + Ke(this._h3) + Ke(this._h4);
  }
  _wrapUp() {
    this._buff[this._buffLen++] = 128, $1(this._buff, this._buffLen), this._buffLen > 56 && (this._step(), $1(this._buff));
    const t = 8 * this._totalLen;
    this._buffDV.setUint32(56, Math.floor(t / 4294967296), !1), this._buffDV.setUint32(60, t % 4294967296, !1), this._step();
  }
  _step() {
    const t = Bt._bigBlock32, n = this._buffDV;
    for (let h = 0; h < 64; h += 4)
      t.setUint32(h, n.getUint32(h, !1), !1);
    for (let h = 64; h < 320; h += 4)
      t.setUint32(h, Qt(t.getUint32(h - 12, !1) ^ t.getUint32(h - 32, !1) ^ t.getUint32(h - 56, !1) ^ t.getUint32(h - 64, !1), 1), !1);
    let s = this._h0, r = this._h1, i = this._h2, o = this._h3, l = this._h4, u, c, f;
    for (let h = 0; h < 80; h++)
      h < 20 ? (u = r & i | ~r & o, c = 1518500249) : h < 40 ? (u = r ^ i ^ o, c = 1859775393) : h < 60 ? (u = r & i | r & o | i & o, c = 2400959708) : (u = r ^ i ^ o, c = 3395469782), f = Qt(s, 5) + u + l + c + t.getUint32(h * 4, !1) & 4294967295, l = o, o = i, i = Qt(r, 30), r = s, s = f;
    this._h0 = this._h0 + s & 4294967295, this._h1 = this._h1 + r & 4294967295, this._h2 = this._h2 + i & 4294967295, this._h3 = this._h3 + o & 4294967295, this._h4 = this._h4 + l & 4294967295;
  }
};
Bt._bigBlock32 = new DataView(new ArrayBuffer(320));
let W1 = Bt;
class z1 {
  constructor(t) {
    this.source = t;
  }
  getElements() {
    const t = this.source, n = new Int32Array(t.length);
    for (let s = 0, r = t.length; s < r; s++)
      n[s] = t.charCodeAt(s);
    return n;
  }
}
function pi(e, t, n) {
  return new Ae(new z1(e), new z1(t)).ComputeDiff(n).changes;
}
class Ie {
  static Assert(t, n) {
    if (!t)
      throw new Error(n);
  }
}
class Ve {
  /**
   * Copies a range of elements from an Array starting at the specified source index and pastes
   * them to another Array starting at the specified destination index. The length and the indexes
   * are specified as 64-bit integers.
   * sourceArray:
   *		The Array that contains the data to copy.
   * sourceIndex:
   *		A 64-bit integer that represents the index in the sourceArray at which copying begins.
   * destinationArray:
   *		The Array that receives the data.
   * destinationIndex:
   *		A 64-bit integer that represents the index in the destinationArray at which storing begins.
   * length:
   *		A 64-bit integer that represents the number of elements to copy.
   */
  static Copy(t, n, s, r, i) {
    for (let o = 0; o < i; o++)
      s[r + o] = t[n + o];
  }
  static Copy2(t, n, s, r, i) {
    for (let o = 0; o < i; o++)
      s[r + o] = t[n + o];
  }
}
class O1 {
  /**
   * Constructs a new DiffChangeHelper for the given DiffSequences.
   */
  constructor() {
    this.m_changes = [], this.m_originalStart = 1073741824, this.m_modifiedStart = 1073741824, this.m_originalCount = 0, this.m_modifiedCount = 0;
  }
  /**
   * Marks the beginning of the next change in the set of differences.
   */
  MarkNextChange() {
    (this.m_originalCount > 0 || this.m_modifiedCount > 0) && this.m_changes.push(new Se(this.m_originalStart, this.m_originalCount, this.m_modifiedStart, this.m_modifiedCount)), this.m_originalCount = 0, this.m_modifiedCount = 0, this.m_originalStart = 1073741824, this.m_modifiedStart = 1073741824;
  }
  /**
   * Adds the original element at the given position to the elements
   * affected by the current change. The modified index gives context
   * to the change position with respect to the original sequence.
   * @param originalIndex The index of the original element to add.
   * @param modifiedIndex The index of the modified element that provides corresponding position in the modified sequence.
   */
  AddOriginalElement(t, n) {
    this.m_originalStart = Math.min(this.m_originalStart, t), this.m_modifiedStart = Math.min(this.m_modifiedStart, n), this.m_originalCount++;
  }
  /**
   * Adds the modified element at the given position to the elements
   * affected by the current change. The original index gives context
   * to the change position with respect to the modified sequence.
   * @param originalIndex The index of the original element that provides corresponding position in the original sequence.
   * @param modifiedIndex The index of the modified element to add.
   */
  AddModifiedElement(t, n) {
    this.m_originalStart = Math.min(this.m_originalStart, t), this.m_modifiedStart = Math.min(this.m_modifiedStart, n), this.m_modifiedCount++;
  }
  /**
   * Retrieves all of the changes marked by the class.
   */
  getChanges() {
    return (this.m_originalCount > 0 || this.m_modifiedCount > 0) && this.MarkNextChange(), this.m_changes;
  }
  /**
   * Retrieves all of the changes marked by the class in the reverse order
   */
  getReverseChanges() {
    return (this.m_originalCount > 0 || this.m_modifiedCount > 0) && this.MarkNextChange(), this.m_changes.reverse(), this.m_changes;
  }
}
class Ae {
  /**
   * Constructs the DiffFinder
   */
  constructor(t, n, s = null) {
    this.ContinueProcessingPredicate = s, this._originalSequence = t, this._modifiedSequence = n;
    const [r, i, o] = Ae._getElements(t), [l, u, c] = Ae._getElements(n);
    this._hasStrings = o && c, this._originalStringElements = r, this._originalElementsOrHash = i, this._modifiedStringElements = l, this._modifiedElementsOrHash = u, this.m_forwardHistory = [], this.m_reverseHistory = [];
  }
  static _isStringArray(t) {
    return t.length > 0 && typeof t[0] == "string";
  }
  static _getElements(t) {
    const n = t.getElements();
    if (Ae._isStringArray(n)) {
      const s = new Int32Array(n.length);
      for (let r = 0, i = n.length; r < i; r++)
        s[r] = gi(n[r], 0);
      return [n, s, !0];
    }
    return n instanceof Int32Array ? [[], n, !1] : [[], new Int32Array(n), !1];
  }
  ElementsAreEqual(t, n) {
    return this._originalElementsOrHash[t] !== this._modifiedElementsOrHash[n] ? !1 : this._hasStrings ? this._originalStringElements[t] === this._modifiedStringElements[n] : !0;
  }
  ElementsAreStrictEqual(t, n) {
    if (!this.ElementsAreEqual(t, n))
      return !1;
    const s = Ae._getStrictElement(this._originalSequence, t), r = Ae._getStrictElement(this._modifiedSequence, n);
    return s === r;
  }
  static _getStrictElement(t, n) {
    return typeof t.getStrictElement == "function" ? t.getStrictElement(n) : null;
  }
  OriginalElementsAreEqual(t, n) {
    return this._originalElementsOrHash[t] !== this._originalElementsOrHash[n] ? !1 : this._hasStrings ? this._originalStringElements[t] === this._originalStringElements[n] : !0;
  }
  ModifiedElementsAreEqual(t, n) {
    return this._modifiedElementsOrHash[t] !== this._modifiedElementsOrHash[n] ? !1 : this._hasStrings ? this._modifiedStringElements[t] === this._modifiedStringElements[n] : !0;
  }
  ComputeDiff(t) {
    return this._ComputeDiff(0, this._originalElementsOrHash.length - 1, 0, this._modifiedElementsOrHash.length - 1, t);
  }
  /**
   * Computes the differences between the original and modified input
   * sequences on the bounded range.
   * @returns An array of the differences between the two input sequences.
   */
  _ComputeDiff(t, n, s, r, i) {
    const o = [!1];
    let l = this.ComputeDiffRecursive(t, n, s, r, o);
    return i && (l = this.PrettifyChanges(l)), {
      quitEarly: o[0],
      changes: l
    };
  }
  /**
   * Private helper method which computes the differences on the bounded range
   * recursively.
   * @returns An array of the differences between the two input sequences.
   */
  ComputeDiffRecursive(t, n, s, r, i) {
    for (i[0] = !1; t <= n && s <= r && this.ElementsAreEqual(t, s); )
      t++, s++;
    for (; n >= t && r >= s && this.ElementsAreEqual(n, r); )
      n--, r--;
    if (t > n || s > r) {
      let h;
      return s <= r ? (Ie.Assert(t === n + 1, "originalStart should only be one more than originalEnd"), h = [
        new Se(t, 0, s, r - s + 1)
      ]) : t <= n ? (Ie.Assert(s === r + 1, "modifiedStart should only be one more than modifiedEnd"), h = [
        new Se(t, n - t + 1, s, 0)
      ]) : (Ie.Assert(t === n + 1, "originalStart should only be one more than originalEnd"), Ie.Assert(s === r + 1, "modifiedStart should only be one more than modifiedEnd"), h = []), h;
    }
    const o = [0], l = [0], u = this.ComputeRecursionPoint(t, n, s, r, o, l, i), c = o[0], f = l[0];
    if (u !== null)
      return u;
    if (!i[0]) {
      const h = this.ComputeDiffRecursive(t, c, s, f, i);
      let d = [];
      return i[0] ? d = [
        new Se(c + 1, n - (c + 1) + 1, f + 1, r - (f + 1) + 1)
      ] : d = this.ComputeDiffRecursive(c + 1, n, f + 1, r, i), this.ConcatenateChanges(h, d);
    }
    return [
      new Se(t, n - t + 1, s, r - s + 1)
    ];
  }
  WALKTRACE(t, n, s, r, i, o, l, u, c, f, h, d, m, g, b, _, v, S) {
    let N = null, x = null, p = new O1(), L = n, A = s, E = m[0] - _[0] - r, B = -1073741824, X = this.m_forwardHistory.length - 1;
    do {
      const q = E + t;
      q === L || q < A && c[q - 1] < c[q + 1] ? (h = c[q + 1], g = h - E - r, h < B && p.MarkNextChange(), B = h, p.AddModifiedElement(h + 1, g), E = q + 1 - t) : (h = c[q - 1] + 1, g = h - E - r, h < B && p.MarkNextChange(), B = h - 1, p.AddOriginalElement(h, g + 1), E = q - 1 - t), X >= 0 && (c = this.m_forwardHistory[X], t = c[0], L = 1, A = c.length - 1);
    } while (--X >= -1);
    if (N = p.getReverseChanges(), S[0]) {
      let q = m[0] + 1, P = _[0] + 1;
      if (N !== null && N.length > 0) {
        const C = N[N.length - 1];
        q = Math.max(q, C.getOriginalEnd()), P = Math.max(P, C.getModifiedEnd());
      }
      x = [
        new Se(q, d - q + 1, P, b - P + 1)
      ];
    } else {
      p = new O1(), L = o, A = l, E = m[0] - _[0] - u, B = 1073741824, X = v ? this.m_reverseHistory.length - 1 : this.m_reverseHistory.length - 2;
      do {
        const q = E + i;
        q === L || q < A && f[q - 1] >= f[q + 1] ? (h = f[q + 1] - 1, g = h - E - u, h > B && p.MarkNextChange(), B = h + 1, p.AddOriginalElement(h + 1, g + 1), E = q + 1 - i) : (h = f[q - 1], g = h - E - u, h > B && p.MarkNextChange(), B = h, p.AddModifiedElement(h + 1, g + 1), E = q - 1 - i), X >= 0 && (f = this.m_reverseHistory[X], i = f[0], L = 1, A = f.length - 1);
      } while (--X >= -1);
      x = p.getChanges();
    }
    return this.ConcatenateChanges(N, x);
  }
  /**
   * Given the range to compute the diff on, this method finds the point:
   * (midOriginal, midModified)
   * that exists in the middle of the LCS of the two sequences and
   * is the point at which the LCS problem may be broken down recursively.
   * This method will try to keep the LCS trace in memory. If the LCS recursion
   * point is calculated and the full trace is available in memory, then this method
   * will return the change list.
   * @param originalStart The start bound of the original sequence range
   * @param originalEnd The end bound of the original sequence range
   * @param modifiedStart The start bound of the modified sequence range
   * @param modifiedEnd The end bound of the modified sequence range
   * @param midOriginal The middle point of the original sequence range
   * @param midModified The middle point of the modified sequence range
   * @returns The diff changes, if available, otherwise null
   */
  ComputeRecursionPoint(t, n, s, r, i, o, l) {
    let u = 0, c = 0, f = 0, h = 0, d = 0, m = 0;
    t--, s--, i[0] = 0, o[0] = 0, this.m_forwardHistory = [], this.m_reverseHistory = [];
    const g = n - t + (r - s), b = g + 1, _ = new Int32Array(b), v = new Int32Array(b), S = r - s, N = n - t, x = t - s, p = n - r, A = (N - S) % 2 === 0;
    _[S] = t, v[N] = n, l[0] = !1;
    for (let E = 1; E <= g / 2 + 1; E++) {
      let B = 0, X = 0;
      f = this.ClipDiagonalBound(S - E, E, S, b), h = this.ClipDiagonalBound(S + E, E, S, b);
      for (let P = f; P <= h; P += 2) {
        P === f || P < h && _[P - 1] < _[P + 1] ? u = _[P + 1] : u = _[P - 1] + 1, c = u - (P - S) - x;
        const C = u;
        for (; u < n && c < r && this.ElementsAreEqual(u + 1, c + 1); )
          u++, c++;
        if (_[P] = u, u + c > B + X && (B = u, X = c), !A && Math.abs(P - N) <= E - 1 && u >= v[P])
          return i[0] = u, o[0] = c, C <= v[P] && 1447 > 0 && E <= 1448 ? this.WALKTRACE(S, f, h, x, N, d, m, p, _, v, u, n, i, c, r, o, A, l) : null;
      }
      const q = (B - t + (X - s) - E) / 2;
      if (this.ContinueProcessingPredicate !== null && !this.ContinueProcessingPredicate(B, q))
        return l[0] = !0, i[0] = B, o[0] = X, q > 0 && 1447 > 0 && E <= 1448 ? this.WALKTRACE(S, f, h, x, N, d, m, p, _, v, u, n, i, c, r, o, A, l) : (t++, s++, [
          new Se(t, n - t + 1, s, r - s + 1)
        ]);
      d = this.ClipDiagonalBound(N - E, E, N, b), m = this.ClipDiagonalBound(N + E, E, N, b);
      for (let P = d; P <= m; P += 2) {
        P === d || P < m && v[P - 1] >= v[P + 1] ? u = v[P + 1] - 1 : u = v[P - 1], c = u - (P - N) - p;
        const C = u;
        for (; u > t && c > s && this.ElementsAreEqual(u, c); )
          u--, c--;
        if (v[P] = u, A && Math.abs(P - S) <= E && u <= _[P])
          return i[0] = u, o[0] = c, C >= _[P] && 1447 > 0 && E <= 1448 ? this.WALKTRACE(S, f, h, x, N, d, m, p, _, v, u, n, i, c, r, o, A, l) : null;
      }
      if (E <= 1447) {
        let P = new Int32Array(h - f + 2);
        P[0] = S - f + 1, Ve.Copy2(_, f, P, 1, h - f + 1), this.m_forwardHistory.push(P), P = new Int32Array(m - d + 2), P[0] = N - d + 1, Ve.Copy2(v, d, P, 1, m - d + 1), this.m_reverseHistory.push(P);
      }
    }
    return this.WALKTRACE(S, f, h, x, N, d, m, p, _, v, u, n, i, c, r, o, A, l);
  }
  /**
   * Shifts the given changes to provide a more intuitive diff.
   * While the first element in a diff matches the first element after the diff,
   * we shift the diff down.
   *
   * @param changes The list of changes to shift
   * @returns The shifted changes
   */
  PrettifyChanges(t) {
    for (let n = 0; n < t.length; n++) {
      const s = t[n], r = n < t.length - 1 ? t[n + 1].originalStart : this._originalElementsOrHash.length, i = n < t.length - 1 ? t[n + 1].modifiedStart : this._modifiedElementsOrHash.length, o = s.originalLength > 0, l = s.modifiedLength > 0;
      for (; s.originalStart + s.originalLength < r && s.modifiedStart + s.modifiedLength < i && (!o || this.OriginalElementsAreEqual(s.originalStart, s.originalStart + s.originalLength)) && (!l || this.ModifiedElementsAreEqual(s.modifiedStart, s.modifiedStart + s.modifiedLength)); ) {
        const c = this.ElementsAreStrictEqual(s.originalStart, s.modifiedStart);
        if (this.ElementsAreStrictEqual(s.originalStart + s.originalLength, s.modifiedStart + s.modifiedLength) && !c)
          break;
        s.originalStart++, s.modifiedStart++;
      }
      const u = [null];
      if (n < t.length - 1 && this.ChangesOverlap(t[n], t[n + 1], u)) {
        t[n] = u[0], t.splice(n + 1, 1), n--;
        continue;
      }
    }
    for (let n = t.length - 1; n >= 0; n--) {
      const s = t[n];
      let r = 0, i = 0;
      if (n > 0) {
        const h = t[n - 1];
        r = h.originalStart + h.originalLength, i = h.modifiedStart + h.modifiedLength;
      }
      const o = s.originalLength > 0, l = s.modifiedLength > 0;
      let u = 0, c = this._boundaryScore(s.originalStart, s.originalLength, s.modifiedStart, s.modifiedLength);
      for (let h = 1; ; h++) {
        const d = s.originalStart - h, m = s.modifiedStart - h;
        if (d < r || m < i || o && !this.OriginalElementsAreEqual(d, d + s.originalLength) || l && !this.ModifiedElementsAreEqual(m, m + s.modifiedLength))
          break;
        const b = (d === r && m === i ? 5 : 0) + this._boundaryScore(d, s.originalLength, m, s.modifiedLength);
        b > c && (c = b, u = h);
      }
      s.originalStart -= u, s.modifiedStart -= u;
      const f = [null];
      if (n > 0 && this.ChangesOverlap(t[n - 1], t[n], f)) {
        t[n - 1] = f[0], t.splice(n, 1), n++;
        continue;
      }
    }
    if (this._hasStrings)
      for (let n = 1, s = t.length; n < s; n++) {
        const r = t[n - 1], i = t[n], o = i.originalStart - r.originalStart - r.originalLength, l = r.originalStart, u = i.originalStart + i.originalLength, c = u - l, f = r.modifiedStart, h = i.modifiedStart + i.modifiedLength, d = h - f;
        if (o < 5 && c < 20 && d < 20) {
          const m = this._findBetterContiguousSequence(l, c, f, d, o);
          if (m) {
            const [g, b] = m;
            (g !== r.originalStart + r.originalLength || b !== r.modifiedStart + r.modifiedLength) && (r.originalLength = g - r.originalStart, r.modifiedLength = b - r.modifiedStart, i.originalStart = g + o, i.modifiedStart = b + o, i.originalLength = u - i.originalStart, i.modifiedLength = h - i.modifiedStart);
          }
        }
      }
    return t;
  }
  _findBetterContiguousSequence(t, n, s, r, i) {
    if (n < i || r < i)
      return null;
    const o = t + n - i + 1, l = s + r - i + 1;
    let u = 0, c = 0, f = 0;
    for (let h = t; h < o; h++)
      for (let d = s; d < l; d++) {
        const m = this._contiguousSequenceScore(h, d, i);
        m > 0 && m > u && (u = m, c = h, f = d);
      }
    return u > 0 ? [c, f] : null;
  }
  _contiguousSequenceScore(t, n, s) {
    let r = 0;
    for (let i = 0; i < s; i++) {
      if (!this.ElementsAreEqual(t + i, n + i))
        return 0;
      r += this._originalStringElements[t + i].length;
    }
    return r;
  }
  _OriginalIsBoundary(t) {
    return t <= 0 || t >= this._originalElementsOrHash.length - 1 ? !0 : this._hasStrings && /^\s*$/.test(this._originalStringElements[t]);
  }
  _OriginalRegionIsBoundary(t, n) {
    if (this._OriginalIsBoundary(t) || this._OriginalIsBoundary(t - 1))
      return !0;
    if (n > 0) {
      const s = t + n;
      if (this._OriginalIsBoundary(s - 1) || this._OriginalIsBoundary(s))
        return !0;
    }
    return !1;
  }
  _ModifiedIsBoundary(t) {
    return t <= 0 || t >= this._modifiedElementsOrHash.length - 1 ? !0 : this._hasStrings && /^\s*$/.test(this._modifiedStringElements[t]);
  }
  _ModifiedRegionIsBoundary(t, n) {
    if (this._ModifiedIsBoundary(t) || this._ModifiedIsBoundary(t - 1))
      return !0;
    if (n > 0) {
      const s = t + n;
      if (this._ModifiedIsBoundary(s - 1) || this._ModifiedIsBoundary(s))
        return !0;
    }
    return !1;
  }
  _boundaryScore(t, n, s, r) {
    const i = this._OriginalRegionIsBoundary(t, n) ? 1 : 0, o = this._ModifiedRegionIsBoundary(s, r) ? 1 : 0;
    return i + o;
  }
  /**
   * Concatenates the two input DiffChange lists and returns the resulting
   * list.
   * @param The left changes
   * @param The right changes
   * @returns The concatenated list
   */
  ConcatenateChanges(t, n) {
    const s = [];
    if (t.length === 0 || n.length === 0)
      return n.length > 0 ? n : t;
    if (this.ChangesOverlap(t[t.length - 1], n[0], s)) {
      const r = new Array(t.length + n.length - 1);
      return Ve.Copy(t, 0, r, 0, t.length - 1), r[t.length - 1] = s[0], Ve.Copy(n, 1, r, t.length, n.length - 1), r;
    } else {
      const r = new Array(t.length + n.length);
      return Ve.Copy(t, 0, r, 0, t.length), Ve.Copy(n, 0, r, t.length, n.length), r;
    }
  }
  /**
   * Returns true if the two changes overlap and can be merged into a single
   * change
   * @param left The left change
   * @param right The right change
   * @param mergedChange The merged change if the two overlap, null otherwise
   * @returns True if the two changes overlap
   */
  ChangesOverlap(t, n, s) {
    if (Ie.Assert(t.originalStart <= n.originalStart, "Left change is not less than or equal to right change"), Ie.Assert(t.modifiedStart <= n.modifiedStart, "Left change is not less than or equal to right change"), t.originalStart + t.originalLength >= n.originalStart || t.modifiedStart + t.modifiedLength >= n.modifiedStart) {
      const r = t.originalStart;
      let i = t.originalLength;
      const o = t.modifiedStart;
      let l = t.modifiedLength;
      return t.originalStart + t.originalLength >= n.originalStart && (i = n.originalStart + n.originalLength - t.originalStart), t.modifiedStart + t.modifiedLength >= n.modifiedStart && (l = n.modifiedStart + n.modifiedLength - t.modifiedStart), s[0] = new Se(r, i, o, l), !0;
    } else
      return s[0] = null, !1;
  }
  /**
   * Helper method used to clip a diagonal index to the range of valid
   * diagonals. This also decides whether or not the diagonal index,
   * if it exceeds the boundary, should be clipped to the boundary or clipped
   * one inside the boundary depending on the Even/Odd status of the boundary
   * and numDifferences.
   * @param diagonal The index of the diagonal to clip.
   * @param numDifferences The current number of differences being iterated upon.
   * @param diagonalBaseIndex The base reference diagonal.
   * @param numDiagonals The total number of diagonals.
   * @returns The clipped diagonal index.
   */
  ClipDiagonalBound(t, n, s, r) {
    if (t >= 0 && t < r)
      return t;
    const i = s, o = r - s - 1, l = n % 2 === 0;
    if (t < 0) {
      const u = i % 2 === 0;
      return l === u ? 0 : 1;
    } else {
      const u = o % 2 === 0;
      return l === u ? r - 1 : r - 2;
    }
  }
}
class $ {
  constructor(t, n) {
    this.lineNumber = t, this.column = n;
  }
  /**
   * Create a new position from this position.
   *
   * @param newLineNumber new line number
   * @param newColumn new column
   */
  with(t = this.lineNumber, n = this.column) {
    return t === this.lineNumber && n === this.column ? this : new $(t, n);
  }
  /**
   * Derive a new position from this position.
   *
   * @param deltaLineNumber line number delta
   * @param deltaColumn column delta
   */
  delta(t = 0, n = 0) {
    return this.with(this.lineNumber + t, this.column + n);
  }
  /**
   * Test if this position equals other position
   */
  equals(t) {
    return $.equals(this, t);
  }
  /**
   * Test if position `a` equals position `b`
   */
  static equals(t, n) {
    return !t && !n ? !0 : !!t && !!n && t.lineNumber === n.lineNumber && t.column === n.column;
  }
  /**
   * Test if this position is before other position.
   * If the two positions are equal, the result will be false.
   */
  isBefore(t) {
    return $.isBefore(this, t);
  }
  /**
   * Test if position `a` is before position `b`.
   * If the two positions are equal, the result will be false.
   */
  static isBefore(t, n) {
    return t.lineNumber < n.lineNumber ? !0 : n.lineNumber < t.lineNumber ? !1 : t.column < n.column;
  }
  /**
   * Test if this position is before other position.
   * If the two positions are equal, the result will be true.
   */
  isBeforeOrEqual(t) {
    return $.isBeforeOrEqual(this, t);
  }
  /**
   * Test if position `a` is before position `b`.
   * If the two positions are equal, the result will be true.
   */
  static isBeforeOrEqual(t, n) {
    return t.lineNumber < n.lineNumber ? !0 : n.lineNumber < t.lineNumber ? !1 : t.column <= n.column;
  }
  /**
   * A function that compares positions, useful for sorting
   */
  static compare(t, n) {
    const s = t.lineNumber | 0, r = n.lineNumber | 0;
    if (s === r) {
      const i = t.column | 0, o = n.column | 0;
      return i - o;
    }
    return s - r;
  }
  /**
   * Clone this position.
   */
  clone() {
    return new $(this.lineNumber, this.column);
  }
  /**
   * Convert to a human-readable representation.
   */
  toString() {
    return "(" + this.lineNumber + "," + this.column + ")";
  }
  // ---
  /**
   * Create a `Position` from an `IPosition`.
   */
  static lift(t) {
    return new $(t.lineNumber, t.column);
  }
  /**
   * Test if `obj` is an `IPosition`.
   */
  static isIPosition(t) {
    return t && typeof t.lineNumber == "number" && typeof t.column == "number";
  }
  toJSON() {
    return {
      lineNumber: this.lineNumber,
      column: this.column
    };
  }
}
class k {
  constructor(t, n, s, r) {
    t > s || t === s && n > r ? (this.startLineNumber = s, this.startColumn = r, this.endLineNumber = t, this.endColumn = n) : (this.startLineNumber = t, this.startColumn = n, this.endLineNumber = s, this.endColumn = r);
  }
  /**
   * Test if this range is empty.
   */
  isEmpty() {
    return k.isEmpty(this);
  }
  /**
   * Test if `range` is empty.
   */
  static isEmpty(t) {
    return t.startLineNumber === t.endLineNumber && t.startColumn === t.endColumn;
  }
  /**
   * Test if position is in this range. If the position is at the edges, will return true.
   */
  containsPosition(t) {
    return k.containsPosition(this, t);
  }
  /**
   * Test if `position` is in `range`. If the position is at the edges, will return true.
   */
  static containsPosition(t, n) {
    return !(n.lineNumber < t.startLineNumber || n.lineNumber > t.endLineNumber || n.lineNumber === t.startLineNumber && n.column < t.startColumn || n.lineNumber === t.endLineNumber && n.column > t.endColumn);
  }
  /**
   * Test if `position` is in `range`. If the position is at the edges, will return false.
   * @internal
   */
  static strictContainsPosition(t, n) {
    return !(n.lineNumber < t.startLineNumber || n.lineNumber > t.endLineNumber || n.lineNumber === t.startLineNumber && n.column <= t.startColumn || n.lineNumber === t.endLineNumber && n.column >= t.endColumn);
  }
  /**
   * Test if range is in this range. If the range is equal to this range, will return true.
   */
  containsRange(t) {
    return k.containsRange(this, t);
  }
  /**
   * Test if `otherRange` is in `range`. If the ranges are equal, will return true.
   */
  static containsRange(t, n) {
    return !(n.startLineNumber < t.startLineNumber || n.endLineNumber < t.startLineNumber || n.startLineNumber > t.endLineNumber || n.endLineNumber > t.endLineNumber || n.startLineNumber === t.startLineNumber && n.startColumn < t.startColumn || n.endLineNumber === t.endLineNumber && n.endColumn > t.endColumn);
  }
  /**
   * Test if `range` is strictly in this range. `range` must start after and end before this range for the result to be true.
   */
  strictContainsRange(t) {
    return k.strictContainsRange(this, t);
  }
  /**
   * Test if `otherRange` is strictly in `range` (must start after, and end before). If the ranges are equal, will return false.
   */
  static strictContainsRange(t, n) {
    return !(n.startLineNumber < t.startLineNumber || n.endLineNumber < t.startLineNumber || n.startLineNumber > t.endLineNumber || n.endLineNumber > t.endLineNumber || n.startLineNumber === t.startLineNumber && n.startColumn <= t.startColumn || n.endLineNumber === t.endLineNumber && n.endColumn >= t.endColumn);
  }
  /**
   * A reunion of the two ranges.
   * The smallest position will be used as the start point, and the largest one as the end point.
   */
  plusRange(t) {
    return k.plusRange(this, t);
  }
  /**
   * A reunion of the two ranges.
   * The smallest position will be used as the start point, and the largest one as the end point.
   */
  static plusRange(t, n) {
    let s, r, i, o;
    return n.startLineNumber < t.startLineNumber ? (s = n.startLineNumber, r = n.startColumn) : n.startLineNumber === t.startLineNumber ? (s = n.startLineNumber, r = Math.min(n.startColumn, t.startColumn)) : (s = t.startLineNumber, r = t.startColumn), n.endLineNumber > t.endLineNumber ? (i = n.endLineNumber, o = n.endColumn) : n.endLineNumber === t.endLineNumber ? (i = n.endLineNumber, o = Math.max(n.endColumn, t.endColumn)) : (i = t.endLineNumber, o = t.endColumn), new k(s, r, i, o);
  }
  /**
   * A intersection of the two ranges.
   */
  intersectRanges(t) {
    return k.intersectRanges(this, t);
  }
  /**
   * A intersection of the two ranges.
   */
  static intersectRanges(t, n) {
    let s = t.startLineNumber, r = t.startColumn, i = t.endLineNumber, o = t.endColumn;
    const l = n.startLineNumber, u = n.startColumn, c = n.endLineNumber, f = n.endColumn;
    return s < l ? (s = l, r = u) : s === l && (r = Math.max(r, u)), i > c ? (i = c, o = f) : i === c && (o = Math.min(o, f)), s > i || s === i && r > o ? null : new k(s, r, i, o);
  }
  /**
   * Test if this range equals other.
   */
  equalsRange(t) {
    return k.equalsRange(this, t);
  }
  /**
   * Test if range `a` equals `b`.
   */
  static equalsRange(t, n) {
    return !t && !n ? !0 : !!t && !!n && t.startLineNumber === n.startLineNumber && t.startColumn === n.startColumn && t.endLineNumber === n.endLineNumber && t.endColumn === n.endColumn;
  }
  /**
   * Return the end position (which will be after or equal to the start position)
   */
  getEndPosition() {
    return k.getEndPosition(this);
  }
  /**
   * Return the end position (which will be after or equal to the start position)
   */
  static getEndPosition(t) {
    return new $(t.endLineNumber, t.endColumn);
  }
  /**
   * Return the start position (which will be before or equal to the end position)
   */
  getStartPosition() {
    return k.getStartPosition(this);
  }
  /**
   * Return the start position (which will be before or equal to the end position)
   */
  static getStartPosition(t) {
    return new $(t.startLineNumber, t.startColumn);
  }
  /**
   * Transform to a user presentable string representation.
   */
  toString() {
    return "[" + this.startLineNumber + "," + this.startColumn + " -> " + this.endLineNumber + "," + this.endColumn + "]";
  }
  /**
   * Create a new range using this range's start position, and using endLineNumber and endColumn as the end position.
   */
  setEndPosition(t, n) {
    return new k(this.startLineNumber, this.startColumn, t, n);
  }
  /**
   * Create a new range using this range's end position, and using startLineNumber and startColumn as the start position.
   */
  setStartPosition(t, n) {
    return new k(t, n, this.endLineNumber, this.endColumn);
  }
  /**
   * Create a new empty range using this range's start position.
   */
  collapseToStart() {
    return k.collapseToStart(this);
  }
  /**
   * Create a new empty range using this range's start position.
   */
  static collapseToStart(t) {
    return new k(t.startLineNumber, t.startColumn, t.startLineNumber, t.startColumn);
  }
  /**
   * Create a new empty range using this range's end position.
   */
  collapseToEnd() {
    return k.collapseToEnd(this);
  }
  /**
   * Create a new empty range using this range's end position.
   */
  static collapseToEnd(t) {
    return new k(t.endLineNumber, t.endColumn, t.endLineNumber, t.endColumn);
  }
  /**
   * Moves the range by the given amount of lines.
   */
  delta(t) {
    return new k(this.startLineNumber + t, this.startColumn, this.endLineNumber + t, this.endColumn);
  }
  // ---
  static fromPositions(t, n = t) {
    return new k(t.lineNumber, t.column, n.lineNumber, n.column);
  }
  static lift(t) {
    return t ? new k(t.startLineNumber, t.startColumn, t.endLineNumber, t.endColumn) : null;
  }
  /**
   * Test if `obj` is an `IRange`.
   */
  static isIRange(t) {
    return t && typeof t.startLineNumber == "number" && typeof t.startColumn == "number" && typeof t.endLineNumber == "number" && typeof t.endColumn == "number";
  }
  /**
   * Test if the two ranges are touching in any way.
   */
  static areIntersectingOrTouching(t, n) {
    return !(t.endLineNumber < n.startLineNumber || t.endLineNumber === n.startLineNumber && t.endColumn < n.startColumn || n.endLineNumber < t.startLineNumber || n.endLineNumber === t.startLineNumber && n.endColumn < t.startColumn);
  }
  /**
   * Test if the two ranges are intersecting. If the ranges are touching it returns true.
   */
  static areIntersecting(t, n) {
    return !(t.endLineNumber < n.startLineNumber || t.endLineNumber === n.startLineNumber && t.endColumn <= n.startColumn || n.endLineNumber < t.startLineNumber || n.endLineNumber === t.startLineNumber && n.endColumn <= t.startColumn);
  }
  /**
   * A function that compares ranges, useful for sorting ranges
   * It will first compare ranges on the startPosition and then on the endPosition
   */
  static compareRangesUsingStarts(t, n) {
    if (t && n) {
      const i = t.startLineNumber | 0, o = n.startLineNumber | 0;
      if (i === o) {
        const l = t.startColumn | 0, u = n.startColumn | 0;
        if (l === u) {
          const c = t.endLineNumber | 0, f = n.endLineNumber | 0;
          if (c === f) {
            const h = t.endColumn | 0, d = n.endColumn | 0;
            return h - d;
          }
          return c - f;
        }
        return l - u;
      }
      return i - o;
    }
    return (t ? 1 : 0) - (n ? 1 : 0);
  }
  /**
   * A function that compares ranges, useful for sorting ranges
   * It will first compare ranges on the endPosition and then on the startPosition
   */
  static compareRangesUsingEnds(t, n) {
    return t.endLineNumber === n.endLineNumber ? t.endColumn === n.endColumn ? t.startLineNumber === n.startLineNumber ? t.startColumn - n.startColumn : t.startLineNumber - n.startLineNumber : t.endColumn - n.endColumn : t.endLineNumber - n.endLineNumber;
  }
  /**
   * Test if the range spans multiple lines.
   */
  static spansMultipleLines(t) {
    return t.endLineNumber > t.startLineNumber;
  }
  toJSON() {
    return this;
  }
}
function j1(e) {
  return e < 0 ? 0 : e > 255 ? 255 : e | 0;
}
function Be(e) {
  return e < 0 ? 0 : e > 4294967295 ? 4294967295 : e | 0;
}
class R1 {
  constructor(t) {
    const n = j1(t);
    this._defaultValue = n, this._asciiMap = R1._createAsciiMap(n), this._map = /* @__PURE__ */ new Map();
  }
  static _createAsciiMap(t) {
    const n = new Uint8Array(256);
    return n.fill(t), n;
  }
  set(t, n) {
    const s = j1(n);
    t >= 0 && t < 256 ? this._asciiMap[t] = s : this._map.set(t, s);
  }
  get(t) {
    return t >= 0 && t < 256 ? this._asciiMap[t] : this._map.get(t) || this._defaultValue;
  }
  clear() {
    this._asciiMap.fill(this._defaultValue), this._map.clear();
  }
}
class xi {
  constructor(t, n, s) {
    const r = new Uint8Array(t * n);
    for (let i = 0, o = t * n; i < o; i++)
      r[i] = s;
    this._data = r, this.rows = t, this.cols = n;
  }
  get(t, n) {
    return this._data[t * this.cols + n];
  }
  set(t, n, s) {
    this._data[t * this.cols + n] = s;
  }
}
class _i {
  constructor(t) {
    let n = 0, s = 0;
    for (let i = 0, o = t.length; i < o; i++) {
      const [l, u, c] = t[i];
      u > n && (n = u), l > s && (s = l), c > s && (s = c);
    }
    n++, s++;
    const r = new xi(
      s,
      n,
      0
      /* State.Invalid */
    );
    for (let i = 0, o = t.length; i < o; i++) {
      const [l, u, c] = t[i];
      r.set(l, u, c);
    }
    this._states = r, this._maxCharCode = n;
  }
  nextState(t, n) {
    return n < 0 || n >= this._maxCharCode ? 0 : this._states.get(t, n);
  }
}
let Yt = null;
function wi() {
  return Yt === null && (Yt = new _i([
    [
      1,
      104,
      2
      /* State.H */
    ],
    [
      1,
      72,
      2
      /* State.H */
    ],
    [
      1,
      102,
      6
      /* State.F */
    ],
    [
      1,
      70,
      6
      /* State.F */
    ],
    [
      2,
      116,
      3
      /* State.HT */
    ],
    [
      2,
      84,
      3
      /* State.HT */
    ],
    [
      3,
      116,
      4
      /* State.HTT */
    ],
    [
      3,
      84,
      4
      /* State.HTT */
    ],
    [
      4,
      112,
      5
      /* State.HTTP */
    ],
    [
      4,
      80,
      5
      /* State.HTTP */
    ],
    [
      5,
      115,
      9
      /* State.BeforeColon */
    ],
    [
      5,
      83,
      9
      /* State.BeforeColon */
    ],
    [
      5,
      58,
      10
      /* State.AfterColon */
    ],
    [
      6,
      105,
      7
      /* State.FI */
    ],
    [
      6,
      73,
      7
      /* State.FI */
    ],
    [
      7,
      108,
      8
      /* State.FIL */
    ],
    [
      7,
      76,
      8
      /* State.FIL */
    ],
    [
      8,
      101,
      9
      /* State.BeforeColon */
    ],
    [
      8,
      69,
      9
      /* State.BeforeColon */
    ],
    [
      9,
      58,
      10
      /* State.AfterColon */
    ],
    [
      10,
      47,
      11
      /* State.AlmostThere */
    ],
    [
      11,
      47,
      12
      /* State.End */
    ]
  ])), Yt;
}
let et = null;
function Li() {
  if (et === null) {
    et = new R1(
      0
      /* CharacterClass.None */
    );
    const e = ` 	<>'"、。｡､，．：；‘〈「『〔（［｛｢｣｝］）〕』」〉’｀～…`;
    for (let n = 0; n < e.length; n++)
      et.set(
        e.charCodeAt(n),
        1
        /* CharacterClass.ForceTermination */
      );
    const t = ".,;:";
    for (let n = 0; n < t.length; n++)
      et.set(
        t.charCodeAt(n),
        2
        /* CharacterClass.CannotEndIn */
      );
  }
  return et;
}
class Mt {
  static _createLink(t, n, s, r, i) {
    let o = i - 1;
    do {
      const l = n.charCodeAt(o);
      if (t.get(l) !== 2)
        break;
      o--;
    } while (o > r);
    if (r > 0) {
      const l = n.charCodeAt(r - 1), u = n.charCodeAt(o);
      (l === 40 && u === 41 || l === 91 && u === 93 || l === 123 && u === 125) && o--;
    }
    return {
      range: {
        startLineNumber: s,
        startColumn: r + 1,
        endLineNumber: s,
        endColumn: o + 2
      },
      url: n.substring(r, o + 1)
    };
  }
  static computeLinks(t, n = wi()) {
    const s = Li(), r = [];
    for (let i = 1, o = t.getLineCount(); i <= o; i++) {
      const l = t.getLineContent(i), u = l.length;
      let c = 0, f = 0, h = 0, d = 1, m = !1, g = !1, b = !1, _ = !1;
      for (; c < u; ) {
        let v = !1;
        const S = l.charCodeAt(c);
        if (d === 13) {
          let N;
          switch (S) {
            case 40:
              m = !0, N = 0;
              break;
            case 41:
              N = m ? 0 : 1;
              break;
            case 91:
              b = !0, g = !0, N = 0;
              break;
            case 93:
              b = !1, N = g ? 0 : 1;
              break;
            case 123:
              _ = !0, N = 0;
              break;
            case 125:
              N = _ ? 0 : 1;
              break;
            case 39:
            case 34:
            case 96:
              h === S ? N = 1 : h === 39 || h === 34 || h === 96 ? N = 0 : N = 1;
              break;
            case 42:
              N = h === 42 ? 1 : 0;
              break;
            case 124:
              N = h === 124 ? 1 : 0;
              break;
            case 32:
              N = b ? 0 : 1;
              break;
            default:
              N = s.get(S);
          }
          N === 1 && (r.push(Mt._createLink(s, l, i, f, c)), v = !0);
        } else if (d === 12) {
          let N;
          S === 91 ? (g = !0, N = 0) : N = s.get(S), N === 1 ? v = !0 : d = 13;
        } else
          d = n.nextState(d, S), d === 0 && (v = !0);
        v && (d = 1, m = !1, g = !1, _ = !1, f = c + 1, h = S), c++;
      }
      d === 13 && r.push(Mt._createLink(s, l, i, f, u));
    }
    return r;
  }
}
function vi(e) {
  return !e || typeof e.getLineCount != "function" || typeof e.getLineContent != "function" ? [] : Mt.computeLinks(e);
}
const qt = class qt {
  constructor() {
    this._defaultValueSet = [
      ["true", "false"],
      ["True", "False"],
      ["Private", "Public", "Friend", "ReadOnly", "Partial", "Protected", "WriteOnly"],
      ["public", "protected", "private"]
    ];
  }
  navigateValueSet(t, n, s, r, i) {
    if (t && n) {
      const o = this.doNavigateValueSet(n, i);
      if (o)
        return {
          range: t,
          value: o
        };
    }
    if (s && r) {
      const o = this.doNavigateValueSet(r, i);
      if (o)
        return {
          range: s,
          value: o
        };
    }
    return null;
  }
  doNavigateValueSet(t, n) {
    const s = this.numberReplace(t, n);
    return s !== null ? s : this.textReplace(t, n);
  }
  numberReplace(t, n) {
    const s = Math.pow(10, t.length - (t.lastIndexOf(".") + 1));
    let r = Number(t);
    const i = parseFloat(t);
    return !isNaN(r) && !isNaN(i) && r === i ? r === 0 && !n ? null : (r = Math.floor(r * s), r += n ? s : -s, String(r / s)) : null;
  }
  textReplace(t, n) {
    return this.valueSetsReplace(this._defaultValueSet, t, n);
  }
  valueSetsReplace(t, n, s) {
    let r = null;
    for (let i = 0, o = t.length; r === null && i < o; i++)
      r = this.valueSetReplace(t[i], n, s);
    return r;
  }
  valueSetReplace(t, n, s) {
    let r = t.indexOf(n);
    return r >= 0 ? (r += s ? 1 : -1, r < 0 ? r = t.length - 1 : r %= t.length, t[r]) : null;
  }
};
qt.INSTANCE = new qt();
let u1 = qt;
const zs = Object.freeze(function(e, t) {
  const n = setTimeout(e.bind(t), 0);
  return { dispose() {
    clearTimeout(n);
  } };
});
var kt;
(function(e) {
  function t(n) {
    return n === e.None || n === e.Cancelled || n instanceof xt ? !0 : !n || typeof n != "object" ? !1 : typeof n.isCancellationRequested == "boolean" && typeof n.onCancellationRequested == "function";
  }
  e.isCancellationToken = t, e.None = Object.freeze({
    isCancellationRequested: !1,
    onCancellationRequested: At.None
  }), e.Cancelled = Object.freeze({
    isCancellationRequested: !0,
    onCancellationRequested: zs
  });
})(kt || (kt = {}));
class xt {
  constructor() {
    this._isCancelled = !1, this._emitter = null;
  }
  cancel() {
    this._isCancelled || (this._isCancelled = !0, this._emitter && (this._emitter.fire(void 0), this.dispose()));
  }
  get isCancellationRequested() {
    return this._isCancelled;
  }
  get onCancellationRequested() {
    return this._isCancelled ? zs : (this._emitter || (this._emitter = new le()), this._emitter.event);
  }
  dispose() {
    this._emitter && (this._emitter.dispose(), this._emitter = null);
  }
}
class Ni {
  constructor(t) {
    this._token = void 0, this._parentListener = void 0, this._parentListener = t && t.onCancellationRequested(this.cancel, this);
  }
  get token() {
    return this._token || (this._token = new xt()), this._token;
  }
  cancel() {
    this._token ? this._token instanceof xt && this._token.cancel() : this._token = kt.Cancelled;
  }
  dispose(t = !1) {
    var n;
    t && this.cancel(), (n = this._parentListener) == null || n.dispose(), this._token ? this._token instanceof xt && this._token.dispose() : this._token = kt.None;
  }
}
class y1 {
  constructor() {
    this._keyCodeToStr = [], this._strToKeyCode = /* @__PURE__ */ Object.create(null);
  }
  define(t, n) {
    this._keyCodeToStr[t] = n, this._strToKeyCode[n.toLowerCase()] = t;
  }
  keyCodeToStr(t) {
    return this._keyCodeToStr[t];
  }
  strToKeyCode(t) {
    return this._strToKeyCode[t.toLowerCase()] || 0;
  }
}
const _t = new y1(), c1 = new y1(), h1 = new y1(), Si = new Array(230), Ci = /* @__PURE__ */ Object.create(null), Ai = /* @__PURE__ */ Object.create(null);
(function() {
  const e = "", t = [
    // immutable, scanCode, scanCodeStr, keyCode, keyCodeStr, eventKeyCode, vkey, usUserSettingsLabel, generalUserSettingsLabel
    [1, 0, "None", 0, "unknown", 0, "VK_UNKNOWN", e, e],
    [1, 1, "Hyper", 0, e, 0, e, e, e],
    [1, 2, "Super", 0, e, 0, e, e, e],
    [1, 3, "Fn", 0, e, 0, e, e, e],
    [1, 4, "FnLock", 0, e, 0, e, e, e],
    [1, 5, "Suspend", 0, e, 0, e, e, e],
    [1, 6, "Resume", 0, e, 0, e, e, e],
    [1, 7, "Turbo", 0, e, 0, e, e, e],
    [1, 8, "Sleep", 0, e, 0, "VK_SLEEP", e, e],
    [1, 9, "WakeUp", 0, e, 0, e, e, e],
    [0, 10, "KeyA", 31, "A", 65, "VK_A", e, e],
    [0, 11, "KeyB", 32, "B", 66, "VK_B", e, e],
    [0, 12, "KeyC", 33, "C", 67, "VK_C", e, e],
    [0, 13, "KeyD", 34, "D", 68, "VK_D", e, e],
    [0, 14, "KeyE", 35, "E", 69, "VK_E", e, e],
    [0, 15, "KeyF", 36, "F", 70, "VK_F", e, e],
    [0, 16, "KeyG", 37, "G", 71, "VK_G", e, e],
    [0, 17, "KeyH", 38, "H", 72, "VK_H", e, e],
    [0, 18, "KeyI", 39, "I", 73, "VK_I", e, e],
    [0, 19, "KeyJ", 40, "J", 74, "VK_J", e, e],
    [0, 20, "KeyK", 41, "K", 75, "VK_K", e, e],
    [0, 21, "KeyL", 42, "L", 76, "VK_L", e, e],
    [0, 22, "KeyM", 43, "M", 77, "VK_M", e, e],
    [0, 23, "KeyN", 44, "N", 78, "VK_N", e, e],
    [0, 24, "KeyO", 45, "O", 79, "VK_O", e, e],
    [0, 25, "KeyP", 46, "P", 80, "VK_P", e, e],
    [0, 26, "KeyQ", 47, "Q", 81, "VK_Q", e, e],
    [0, 27, "KeyR", 48, "R", 82, "VK_R", e, e],
    [0, 28, "KeyS", 49, "S", 83, "VK_S", e, e],
    [0, 29, "KeyT", 50, "T", 84, "VK_T", e, e],
    [0, 30, "KeyU", 51, "U", 85, "VK_U", e, e],
    [0, 31, "KeyV", 52, "V", 86, "VK_V", e, e],
    [0, 32, "KeyW", 53, "W", 87, "VK_W", e, e],
    [0, 33, "KeyX", 54, "X", 88, "VK_X", e, e],
    [0, 34, "KeyY", 55, "Y", 89, "VK_Y", e, e],
    [0, 35, "KeyZ", 56, "Z", 90, "VK_Z", e, e],
    [0, 36, "Digit1", 22, "1", 49, "VK_1", e, e],
    [0, 37, "Digit2", 23, "2", 50, "VK_2", e, e],
    [0, 38, "Digit3", 24, "3", 51, "VK_3", e, e],
    [0, 39, "Digit4", 25, "4", 52, "VK_4", e, e],
    [0, 40, "Digit5", 26, "5", 53, "VK_5", e, e],
    [0, 41, "Digit6", 27, "6", 54, "VK_6", e, e],
    [0, 42, "Digit7", 28, "7", 55, "VK_7", e, e],
    [0, 43, "Digit8", 29, "8", 56, "VK_8", e, e],
    [0, 44, "Digit9", 30, "9", 57, "VK_9", e, e],
    [0, 45, "Digit0", 21, "0", 48, "VK_0", e, e],
    [1, 46, "Enter", 3, "Enter", 13, "VK_RETURN", e, e],
    [1, 47, "Escape", 9, "Escape", 27, "VK_ESCAPE", e, e],
    [1, 48, "Backspace", 1, "Backspace", 8, "VK_BACK", e, e],
    [1, 49, "Tab", 2, "Tab", 9, "VK_TAB", e, e],
    [1, 50, "Space", 10, "Space", 32, "VK_SPACE", e, e],
    [0, 51, "Minus", 88, "-", 189, "VK_OEM_MINUS", "-", "OEM_MINUS"],
    [0, 52, "Equal", 86, "=", 187, "VK_OEM_PLUS", "=", "OEM_PLUS"],
    [0, 53, "BracketLeft", 92, "[", 219, "VK_OEM_4", "[", "OEM_4"],
    [0, 54, "BracketRight", 94, "]", 221, "VK_OEM_6", "]", "OEM_6"],
    [0, 55, "Backslash", 93, "\\", 220, "VK_OEM_5", "\\", "OEM_5"],
    [0, 56, "IntlHash", 0, e, 0, e, e, e],
    // has been dropped from the w3c spec
    [0, 57, "Semicolon", 85, ";", 186, "VK_OEM_1", ";", "OEM_1"],
    [0, 58, "Quote", 95, "'", 222, "VK_OEM_7", "'", "OEM_7"],
    [0, 59, "Backquote", 91, "`", 192, "VK_OEM_3", "`", "OEM_3"],
    [0, 60, "Comma", 87, ",", 188, "VK_OEM_COMMA", ",", "OEM_COMMA"],
    [0, 61, "Period", 89, ".", 190, "VK_OEM_PERIOD", ".", "OEM_PERIOD"],
    [0, 62, "Slash", 90, "/", 191, "VK_OEM_2", "/", "OEM_2"],
    [1, 63, "CapsLock", 8, "CapsLock", 20, "VK_CAPITAL", e, e],
    [1, 64, "F1", 59, "F1", 112, "VK_F1", e, e],
    [1, 65, "F2", 60, "F2", 113, "VK_F2", e, e],
    [1, 66, "F3", 61, "F3", 114, "VK_F3", e, e],
    [1, 67, "F4", 62, "F4", 115, "VK_F4", e, e],
    [1, 68, "F5", 63, "F5", 116, "VK_F5", e, e],
    [1, 69, "F6", 64, "F6", 117, "VK_F6", e, e],
    [1, 70, "F7", 65, "F7", 118, "VK_F7", e, e],
    [1, 71, "F8", 66, "F8", 119, "VK_F8", e, e],
    [1, 72, "F9", 67, "F9", 120, "VK_F9", e, e],
    [1, 73, "F10", 68, "F10", 121, "VK_F10", e, e],
    [1, 74, "F11", 69, "F11", 122, "VK_F11", e, e],
    [1, 75, "F12", 70, "F12", 123, "VK_F12", e, e],
    [1, 76, "PrintScreen", 0, e, 0, e, e, e],
    [1, 77, "ScrollLock", 84, "ScrollLock", 145, "VK_SCROLL", e, e],
    [1, 78, "Pause", 7, "PauseBreak", 19, "VK_PAUSE", e, e],
    [1, 79, "Insert", 19, "Insert", 45, "VK_INSERT", e, e],
    [1, 80, "Home", 14, "Home", 36, "VK_HOME", e, e],
    [1, 81, "PageUp", 11, "PageUp", 33, "VK_PRIOR", e, e],
    [1, 82, "Delete", 20, "Delete", 46, "VK_DELETE", e, e],
    [1, 83, "End", 13, "End", 35, "VK_END", e, e],
    [1, 84, "PageDown", 12, "PageDown", 34, "VK_NEXT", e, e],
    [1, 85, "ArrowRight", 17, "RightArrow", 39, "VK_RIGHT", "Right", e],
    [1, 86, "ArrowLeft", 15, "LeftArrow", 37, "VK_LEFT", "Left", e],
    [1, 87, "ArrowDown", 18, "DownArrow", 40, "VK_DOWN", "Down", e],
    [1, 88, "ArrowUp", 16, "UpArrow", 38, "VK_UP", "Up", e],
    [1, 89, "NumLock", 83, "NumLock", 144, "VK_NUMLOCK", e, e],
    [1, 90, "NumpadDivide", 113, "NumPad_Divide", 111, "VK_DIVIDE", e, e],
    [1, 91, "NumpadMultiply", 108, "NumPad_Multiply", 106, "VK_MULTIPLY", e, e],
    [1, 92, "NumpadSubtract", 111, "NumPad_Subtract", 109, "VK_SUBTRACT", e, e],
    [1, 93, "NumpadAdd", 109, "NumPad_Add", 107, "VK_ADD", e, e],
    [1, 94, "NumpadEnter", 3, e, 0, e, e, e],
    [1, 95, "Numpad1", 99, "NumPad1", 97, "VK_NUMPAD1", e, e],
    [1, 96, "Numpad2", 100, "NumPad2", 98, "VK_NUMPAD2", e, e],
    [1, 97, "Numpad3", 101, "NumPad3", 99, "VK_NUMPAD3", e, e],
    [1, 98, "Numpad4", 102, "NumPad4", 100, "VK_NUMPAD4", e, e],
    [1, 99, "Numpad5", 103, "NumPad5", 101, "VK_NUMPAD5", e, e],
    [1, 100, "Numpad6", 104, "NumPad6", 102, "VK_NUMPAD6", e, e],
    [1, 101, "Numpad7", 105, "NumPad7", 103, "VK_NUMPAD7", e, e],
    [1, 102, "Numpad8", 106, "NumPad8", 104, "VK_NUMPAD8", e, e],
    [1, 103, "Numpad9", 107, "NumPad9", 105, "VK_NUMPAD9", e, e],
    [1, 104, "Numpad0", 98, "NumPad0", 96, "VK_NUMPAD0", e, e],
    [1, 105, "NumpadDecimal", 112, "NumPad_Decimal", 110, "VK_DECIMAL", e, e],
    [0, 106, "IntlBackslash", 97, "OEM_102", 226, "VK_OEM_102", e, e],
    [1, 107, "ContextMenu", 58, "ContextMenu", 93, e, e, e],
    [1, 108, "Power", 0, e, 0, e, e, e],
    [1, 109, "NumpadEqual", 0, e, 0, e, e, e],
    [1, 110, "F13", 71, "F13", 124, "VK_F13", e, e],
    [1, 111, "F14", 72, "F14", 125, "VK_F14", e, e],
    [1, 112, "F15", 73, "F15", 126, "VK_F15", e, e],
    [1, 113, "F16", 74, "F16", 127, "VK_F16", e, e],
    [1, 114, "F17", 75, "F17", 128, "VK_F17", e, e],
    [1, 115, "F18", 76, "F18", 129, "VK_F18", e, e],
    [1, 116, "F19", 77, "F19", 130, "VK_F19", e, e],
    [1, 117, "F20", 78, "F20", 131, "VK_F20", e, e],
    [1, 118, "F21", 79, "F21", 132, "VK_F21", e, e],
    [1, 119, "F22", 80, "F22", 133, "VK_F22", e, e],
    [1, 120, "F23", 81, "F23", 134, "VK_F23", e, e],
    [1, 121, "F24", 82, "F24", 135, "VK_F24", e, e],
    [1, 122, "Open", 0, e, 0, e, e, e],
    [1, 123, "Help", 0, e, 0, e, e, e],
    [1, 124, "Select", 0, e, 0, e, e, e],
    [1, 125, "Again", 0, e, 0, e, e, e],
    [1, 126, "Undo", 0, e, 0, e, e, e],
    [1, 127, "Cut", 0, e, 0, e, e, e],
    [1, 128, "Copy", 0, e, 0, e, e, e],
    [1, 129, "Paste", 0, e, 0, e, e, e],
    [1, 130, "Find", 0, e, 0, e, e, e],
    [1, 131, "AudioVolumeMute", 117, "AudioVolumeMute", 173, "VK_VOLUME_MUTE", e, e],
    [1, 132, "AudioVolumeUp", 118, "AudioVolumeUp", 175, "VK_VOLUME_UP", e, e],
    [1, 133, "AudioVolumeDown", 119, "AudioVolumeDown", 174, "VK_VOLUME_DOWN", e, e],
    [1, 134, "NumpadComma", 110, "NumPad_Separator", 108, "VK_SEPARATOR", e, e],
    [0, 135, "IntlRo", 115, "ABNT_C1", 193, "VK_ABNT_C1", e, e],
    [1, 136, "KanaMode", 0, e, 0, e, e, e],
    [0, 137, "IntlYen", 0, e, 0, e, e, e],
    [1, 138, "Convert", 0, e, 0, e, e, e],
    [1, 139, "NonConvert", 0, e, 0, e, e, e],
    [1, 140, "Lang1", 0, e, 0, e, e, e],
    [1, 141, "Lang2", 0, e, 0, e, e, e],
    [1, 142, "Lang3", 0, e, 0, e, e, e],
    [1, 143, "Lang4", 0, e, 0, e, e, e],
    [1, 144, "Lang5", 0, e, 0, e, e, e],
    [1, 145, "Abort", 0, e, 0, e, e, e],
    [1, 146, "Props", 0, e, 0, e, e, e],
    [1, 147, "NumpadParenLeft", 0, e, 0, e, e, e],
    [1, 148, "NumpadParenRight", 0, e, 0, e, e, e],
    [1, 149, "NumpadBackspace", 0, e, 0, e, e, e],
    [1, 150, "NumpadMemoryStore", 0, e, 0, e, e, e],
    [1, 151, "NumpadMemoryRecall", 0, e, 0, e, e, e],
    [1, 152, "NumpadMemoryClear", 0, e, 0, e, e, e],
    [1, 153, "NumpadMemoryAdd", 0, e, 0, e, e, e],
    [1, 154, "NumpadMemorySubtract", 0, e, 0, e, e, e],
    [1, 155, "NumpadClear", 131, "Clear", 12, "VK_CLEAR", e, e],
    [1, 156, "NumpadClearEntry", 0, e, 0, e, e, e],
    [1, 0, e, 5, "Ctrl", 17, "VK_CONTROL", e, e],
    [1, 0, e, 4, "Shift", 16, "VK_SHIFT", e, e],
    [1, 0, e, 6, "Alt", 18, "VK_MENU", e, e],
    [1, 0, e, 57, "Meta", 91, "VK_COMMAND", e, e],
    [1, 157, "ControlLeft", 5, e, 0, "VK_LCONTROL", e, e],
    [1, 158, "ShiftLeft", 4, e, 0, "VK_LSHIFT", e, e],
    [1, 159, "AltLeft", 6, e, 0, "VK_LMENU", e, e],
    [1, 160, "MetaLeft", 57, e, 0, "VK_LWIN", e, e],
    [1, 161, "ControlRight", 5, e, 0, "VK_RCONTROL", e, e],
    [1, 162, "ShiftRight", 4, e, 0, "VK_RSHIFT", e, e],
    [1, 163, "AltRight", 6, e, 0, "VK_RMENU", e, e],
    [1, 164, "MetaRight", 57, e, 0, "VK_RWIN", e, e],
    [1, 165, "BrightnessUp", 0, e, 0, e, e, e],
    [1, 166, "BrightnessDown", 0, e, 0, e, e, e],
    [1, 167, "MediaPlay", 0, e, 0, e, e, e],
    [1, 168, "MediaRecord", 0, e, 0, e, e, e],
    [1, 169, "MediaFastForward", 0, e, 0, e, e, e],
    [1, 170, "MediaRewind", 0, e, 0, e, e, e],
    [1, 171, "MediaTrackNext", 124, "MediaTrackNext", 176, "VK_MEDIA_NEXT_TRACK", e, e],
    [1, 172, "MediaTrackPrevious", 125, "MediaTrackPrevious", 177, "VK_MEDIA_PREV_TRACK", e, e],
    [1, 173, "MediaStop", 126, "MediaStop", 178, "VK_MEDIA_STOP", e, e],
    [1, 174, "Eject", 0, e, 0, e, e, e],
    [1, 175, "MediaPlayPause", 127, "MediaPlayPause", 179, "VK_MEDIA_PLAY_PAUSE", e, e],
    [1, 176, "MediaSelect", 128, "LaunchMediaPlayer", 181, "VK_MEDIA_LAUNCH_MEDIA_SELECT", e, e],
    [1, 177, "LaunchMail", 129, "LaunchMail", 180, "VK_MEDIA_LAUNCH_MAIL", e, e],
    [1, 178, "LaunchApp2", 130, "LaunchApp2", 183, "VK_MEDIA_LAUNCH_APP2", e, e],
    [1, 179, "LaunchApp1", 0, e, 0, "VK_MEDIA_LAUNCH_APP1", e, e],
    [1, 180, "SelectTask", 0, e, 0, e, e, e],
    [1, 181, "LaunchScreenSaver", 0, e, 0, e, e, e],
    [1, 182, "BrowserSearch", 120, "BrowserSearch", 170, "VK_BROWSER_SEARCH", e, e],
    [1, 183, "BrowserHome", 121, "BrowserHome", 172, "VK_BROWSER_HOME", e, e],
    [1, 184, "BrowserBack", 122, "BrowserBack", 166, "VK_BROWSER_BACK", e, e],
    [1, 185, "BrowserForward", 123, "BrowserForward", 167, "VK_BROWSER_FORWARD", e, e],
    [1, 186, "BrowserStop", 0, e, 0, "VK_BROWSER_STOP", e, e],
    [1, 187, "BrowserRefresh", 0, e, 0, "VK_BROWSER_REFRESH", e, e],
    [1, 188, "BrowserFavorites", 0, e, 0, "VK_BROWSER_FAVORITES", e, e],
    [1, 189, "ZoomToggle", 0, e, 0, e, e, e],
    [1, 190, "MailReply", 0, e, 0, e, e, e],
    [1, 191, "MailForward", 0, e, 0, e, e, e],
    [1, 192, "MailSend", 0, e, 0, e, e, e],
    // See https://lists.w3.org/Archives/Public/www-dom/2010JulSep/att-0182/keyCode-spec.html
    // If an Input Method Editor is processing key input and the event is keydown, return 229.
    [1, 0, e, 114, "KeyInComposition", 229, e, e, e],
    [1, 0, e, 116, "ABNT_C2", 194, "VK_ABNT_C2", e, e],
    [1, 0, e, 96, "OEM_8", 223, "VK_OEM_8", e, e],
    [1, 0, e, 0, e, 0, "VK_KANA", e, e],
    [1, 0, e, 0, e, 0, "VK_HANGUL", e, e],
    [1, 0, e, 0, e, 0, "VK_JUNJA", e, e],
    [1, 0, e, 0, e, 0, "VK_FINAL", e, e],
    [1, 0, e, 0, e, 0, "VK_HANJA", e, e],
    [1, 0, e, 0, e, 0, "VK_KANJI", e, e],
    [1, 0, e, 0, e, 0, "VK_CONVERT", e, e],
    [1, 0, e, 0, e, 0, "VK_NONCONVERT", e, e],
    [1, 0, e, 0, e, 0, "VK_ACCEPT", e, e],
    [1, 0, e, 0, e, 0, "VK_MODECHANGE", e, e],
    [1, 0, e, 0, e, 0, "VK_SELECT", e, e],
    [1, 0, e, 0, e, 0, "VK_PRINT", e, e],
    [1, 0, e, 0, e, 0, "VK_EXECUTE", e, e],
    [1, 0, e, 0, e, 0, "VK_SNAPSHOT", e, e],
    [1, 0, e, 0, e, 0, "VK_HELP", e, e],
    [1, 0, e, 0, e, 0, "VK_APPS", e, e],
    [1, 0, e, 0, e, 0, "VK_PROCESSKEY", e, e],
    [1, 0, e, 0, e, 0, "VK_PACKET", e, e],
    [1, 0, e, 0, e, 0, "VK_DBE_SBCSCHAR", e, e],
    [1, 0, e, 0, e, 0, "VK_DBE_DBCSCHAR", e, e],
    [1, 0, e, 0, e, 0, "VK_ATTN", e, e],
    [1, 0, e, 0, e, 0, "VK_CRSEL", e, e],
    [1, 0, e, 0, e, 0, "VK_EXSEL", e, e],
    [1, 0, e, 0, e, 0, "VK_EREOF", e, e],
    [1, 0, e, 0, e, 0, "VK_PLAY", e, e],
    [1, 0, e, 0, e, 0, "VK_ZOOM", e, e],
    [1, 0, e, 0, e, 0, "VK_NONAME", e, e],
    [1, 0, e, 0, e, 0, "VK_PA1", e, e],
    [1, 0, e, 0, e, 0, "VK_OEM_CLEAR", e, e]
  ], n = [], s = [];
  for (const r of t) {
    const [i, o, l, u, c, f, h, d, m] = r;
    if (s[o] || (s[o] = !0, Ci[l] = o, Ai[l.toLowerCase()] = o), !n[u]) {
      if (n[u] = !0, !c)
        throw new Error(`String representation missing for key code ${u} around scan code ${l}`);
      _t.define(u, c), c1.define(u, d || c), h1.define(u, m || d || c);
    }
    f && (Si[f] = u);
  }
})();
var G1;
(function(e) {
  function t(l) {
    return _t.keyCodeToStr(l);
  }
  e.toString = t;
  function n(l) {
    return _t.strToKeyCode(l);
  }
  e.fromString = n;
  function s(l) {
    return c1.keyCodeToStr(l);
  }
  e.toUserSettingsUS = s;
  function r(l) {
    return h1.keyCodeToStr(l);
  }
  e.toUserSettingsGeneral = r;
  function i(l) {
    return c1.strToKeyCode(l) || h1.strToKeyCode(l);
  }
  e.fromUserSettings = i;
  function o(l) {
    if (l >= 98 && l <= 113)
      return null;
    switch (l) {
      case 16:
        return "Up";
      case 18:
        return "Down";
      case 15:
        return "Left";
      case 17:
        return "Right";
    }
    return _t.keyCodeToStr(l);
  }
  e.toElectronAccelerator = o;
})(G1 || (G1 = {}));
function Ri(e, t) {
  const n = (t & 65535) << 16 >>> 0;
  return (e | n) >>> 0;
}
class ie extends k {
  constructor(t, n, s, r) {
    super(t, n, s, r), this.selectionStartLineNumber = t, this.selectionStartColumn = n, this.positionLineNumber = s, this.positionColumn = r;
  }
  /**
   * Transform to a human-readable representation.
   */
  toString() {
    return "[" + this.selectionStartLineNumber + "," + this.selectionStartColumn + " -> " + this.positionLineNumber + "," + this.positionColumn + "]";
  }
  /**
   * Test if equals other selection.
   */
  equalsSelection(t) {
    return ie.selectionsEqual(this, t);
  }
  /**
   * Test if the two selections are equal.
   */
  static selectionsEqual(t, n) {
    return t.selectionStartLineNumber === n.selectionStartLineNumber && t.selectionStartColumn === n.selectionStartColumn && t.positionLineNumber === n.positionLineNumber && t.positionColumn === n.positionColumn;
  }
  /**
   * Get directions (LTR or RTL).
   */
  getDirection() {
    return this.selectionStartLineNumber === this.startLineNumber && this.selectionStartColumn === this.startColumn ? 0 : 1;
  }
  /**
   * Create a new selection with a different `positionLineNumber` and `positionColumn`.
   */
  setEndPosition(t, n) {
    return this.getDirection() === 0 ? new ie(this.startLineNumber, this.startColumn, t, n) : new ie(t, n, this.startLineNumber, this.startColumn);
  }
  /**
   * Get the position at `positionLineNumber` and `positionColumn`.
   */
  getPosition() {
    return new $(this.positionLineNumber, this.positionColumn);
  }
  /**
   * Get the position at the start of the selection.
  */
  getSelectionStart() {
    return new $(this.selectionStartLineNumber, this.selectionStartColumn);
  }
  /**
   * Create a new selection with a different `selectionStartLineNumber` and `selectionStartColumn`.
   */
  setStartPosition(t, n) {
    return this.getDirection() === 0 ? new ie(t, n, this.endLineNumber, this.endColumn) : new ie(this.endLineNumber, this.endColumn, t, n);
  }
  // ----
  /**
   * Create a `Selection` from one or two positions
   */
  static fromPositions(t, n = t) {
    return new ie(t.lineNumber, t.column, n.lineNumber, n.column);
  }
  /**
   * Creates a `Selection` from a range, given a direction.
   */
  static fromRange(t, n) {
    return n === 0 ? new ie(t.startLineNumber, t.startColumn, t.endLineNumber, t.endColumn) : new ie(t.endLineNumber, t.endColumn, t.startLineNumber, t.startColumn);
  }
  /**
   * Create a `Selection` from an `ISelection`.
   */
  static liftSelection(t) {
    return new ie(t.selectionStartLineNumber, t.selectionStartColumn, t.positionLineNumber, t.positionColumn);
  }
  /**
   * `a` equals `b`.
   */
  static selectionsArrEqual(t, n) {
    if (t && !n || !t && n)
      return !1;
    if (!t && !n)
      return !0;
    if (t.length !== n.length)
      return !1;
    for (let s = 0, r = t.length; s < r; s++)
      if (!this.selectionsEqual(t[s], n[s]))
        return !1;
    return !0;
  }
  /**
   * Test if `obj` is an `ISelection`.
   */
  static isISelection(t) {
    return t && typeof t.selectionStartLineNumber == "number" && typeof t.selectionStartColumn == "number" && typeof t.positionLineNumber == "number" && typeof t.positionColumn == "number";
  }
  /**
   * Create with a direction.
   */
  static createWithDirection(t, n, s, r, i) {
    return i === 0 ? new ie(t, n, s, r) : new ie(s, r, t, n);
  }
}
function yi(e) {
  return typeof e == "string";
}
const X1 = /* @__PURE__ */ Object.create(null);
function a(e, t) {
  if (yi(t)) {
    const n = X1[t];
    if (n === void 0)
      throw new Error(`${e} references an unknown codicon: ${t}`);
    t = n;
  }
  return X1[e] = t, { id: e };
}
const Ei = {
  add: a("add", 6e4),
  plus: a("plus", 6e4),
  gistNew: a("gist-new", 6e4),
  repoCreate: a("repo-create", 6e4),
  lightbulb: a("lightbulb", 60001),
  lightBulb: a("light-bulb", 60001),
  repo: a("repo", 60002),
  repoDelete: a("repo-delete", 60002),
  gistFork: a("gist-fork", 60003),
  repoForked: a("repo-forked", 60003),
  gitPullRequest: a("git-pull-request", 60004),
  gitPullRequestAbandoned: a("git-pull-request-abandoned", 60004),
  recordKeys: a("record-keys", 60005),
  keyboard: a("keyboard", 60005),
  tag: a("tag", 60006),
  gitPullRequestLabel: a("git-pull-request-label", 60006),
  tagAdd: a("tag-add", 60006),
  tagRemove: a("tag-remove", 60006),
  person: a("person", 60007),
  personFollow: a("person-follow", 60007),
  personOutline: a("person-outline", 60007),
  personFilled: a("person-filled", 60007),
  gitBranch: a("git-branch", 60008),
  gitBranchCreate: a("git-branch-create", 60008),
  gitBranchDelete: a("git-branch-delete", 60008),
  sourceControl: a("source-control", 60008),
  mirror: a("mirror", 60009),
  mirrorPublic: a("mirror-public", 60009),
  star: a("star", 60010),
  starAdd: a("star-add", 60010),
  starDelete: a("star-delete", 60010),
  starEmpty: a("star-empty", 60010),
  comment: a("comment", 60011),
  commentAdd: a("comment-add", 60011),
  alert: a("alert", 60012),
  warning: a("warning", 60012),
  search: a("search", 60013),
  searchSave: a("search-save", 60013),
  logOut: a("log-out", 60014),
  signOut: a("sign-out", 60014),
  logIn: a("log-in", 60015),
  signIn: a("sign-in", 60015),
  eye: a("eye", 60016),
  eyeUnwatch: a("eye-unwatch", 60016),
  eyeWatch: a("eye-watch", 60016),
  circleFilled: a("circle-filled", 60017),
  primitiveDot: a("primitive-dot", 60017),
  closeDirty: a("close-dirty", 60017),
  debugBreakpoint: a("debug-breakpoint", 60017),
  debugBreakpointDisabled: a("debug-breakpoint-disabled", 60017),
  debugHint: a("debug-hint", 60017),
  terminalDecorationSuccess: a("terminal-decoration-success", 60017),
  primitiveSquare: a("primitive-square", 60018),
  edit: a("edit", 60019),
  pencil: a("pencil", 60019),
  info: a("info", 60020),
  issueOpened: a("issue-opened", 60020),
  gistPrivate: a("gist-private", 60021),
  gitForkPrivate: a("git-fork-private", 60021),
  lock: a("lock", 60021),
  mirrorPrivate: a("mirror-private", 60021),
  close: a("close", 60022),
  removeClose: a("remove-close", 60022),
  x: a("x", 60022),
  repoSync: a("repo-sync", 60023),
  sync: a("sync", 60023),
  clone: a("clone", 60024),
  desktopDownload: a("desktop-download", 60024),
  beaker: a("beaker", 60025),
  microscope: a("microscope", 60025),
  vm: a("vm", 60026),
  deviceDesktop: a("device-desktop", 60026),
  file: a("file", 60027),
  fileText: a("file-text", 60027),
  more: a("more", 60028),
  ellipsis: a("ellipsis", 60028),
  kebabHorizontal: a("kebab-horizontal", 60028),
  mailReply: a("mail-reply", 60029),
  reply: a("reply", 60029),
  organization: a("organization", 60030),
  organizationFilled: a("organization-filled", 60030),
  organizationOutline: a("organization-outline", 60030),
  newFile: a("new-file", 60031),
  fileAdd: a("file-add", 60031),
  newFolder: a("new-folder", 60032),
  fileDirectoryCreate: a("file-directory-create", 60032),
  trash: a("trash", 60033),
  trashcan: a("trashcan", 60033),
  history: a("history", 60034),
  clock: a("clock", 60034),
  folder: a("folder", 60035),
  fileDirectory: a("file-directory", 60035),
  symbolFolder: a("symbol-folder", 60035),
  logoGithub: a("logo-github", 60036),
  markGithub: a("mark-github", 60036),
  github: a("github", 60036),
  terminal: a("terminal", 60037),
  console: a("console", 60037),
  repl: a("repl", 60037),
  zap: a("zap", 60038),
  symbolEvent: a("symbol-event", 60038),
  error: a("error", 60039),
  stop: a("stop", 60039),
  variable: a("variable", 60040),
  symbolVariable: a("symbol-variable", 60040),
  array: a("array", 60042),
  symbolArray: a("symbol-array", 60042),
  symbolModule: a("symbol-module", 60043),
  symbolPackage: a("symbol-package", 60043),
  symbolNamespace: a("symbol-namespace", 60043),
  symbolObject: a("symbol-object", 60043),
  symbolMethod: a("symbol-method", 60044),
  symbolFunction: a("symbol-function", 60044),
  symbolConstructor: a("symbol-constructor", 60044),
  symbolBoolean: a("symbol-boolean", 60047),
  symbolNull: a("symbol-null", 60047),
  symbolNumeric: a("symbol-numeric", 60048),
  symbolNumber: a("symbol-number", 60048),
  symbolStructure: a("symbol-structure", 60049),
  symbolStruct: a("symbol-struct", 60049),
  symbolParameter: a("symbol-parameter", 60050),
  symbolTypeParameter: a("symbol-type-parameter", 60050),
  symbolKey: a("symbol-key", 60051),
  symbolText: a("symbol-text", 60051),
  symbolReference: a("symbol-reference", 60052),
  goToFile: a("go-to-file", 60052),
  symbolEnum: a("symbol-enum", 60053),
  symbolValue: a("symbol-value", 60053),
  symbolRuler: a("symbol-ruler", 60054),
  symbolUnit: a("symbol-unit", 60054),
  activateBreakpoints: a("activate-breakpoints", 60055),
  archive: a("archive", 60056),
  arrowBoth: a("arrow-both", 60057),
  arrowDown: a("arrow-down", 60058),
  arrowLeft: a("arrow-left", 60059),
  arrowRight: a("arrow-right", 60060),
  arrowSmallDown: a("arrow-small-down", 60061),
  arrowSmallLeft: a("arrow-small-left", 60062),
  arrowSmallRight: a("arrow-small-right", 60063),
  arrowSmallUp: a("arrow-small-up", 60064),
  arrowUp: a("arrow-up", 60065),
  bell: a("bell", 60066),
  bold: a("bold", 60067),
  book: a("book", 60068),
  bookmark: a("bookmark", 60069),
  debugBreakpointConditionalUnverified: a("debug-breakpoint-conditional-unverified", 60070),
  debugBreakpointConditional: a("debug-breakpoint-conditional", 60071),
  debugBreakpointConditionalDisabled: a("debug-breakpoint-conditional-disabled", 60071),
  debugBreakpointDataUnverified: a("debug-breakpoint-data-unverified", 60072),
  debugBreakpointData: a("debug-breakpoint-data", 60073),
  debugBreakpointDataDisabled: a("debug-breakpoint-data-disabled", 60073),
  debugBreakpointLogUnverified: a("debug-breakpoint-log-unverified", 60074),
  debugBreakpointLog: a("debug-breakpoint-log", 60075),
  debugBreakpointLogDisabled: a("debug-breakpoint-log-disabled", 60075),
  briefcase: a("briefcase", 60076),
  broadcast: a("broadcast", 60077),
  browser: a("browser", 60078),
  bug: a("bug", 60079),
  calendar: a("calendar", 60080),
  caseSensitive: a("case-sensitive", 60081),
  check: a("check", 60082),
  checklist: a("checklist", 60083),
  chevronDown: a("chevron-down", 60084),
  chevronLeft: a("chevron-left", 60085),
  chevronRight: a("chevron-right", 60086),
  chevronUp: a("chevron-up", 60087),
  chromeClose: a("chrome-close", 60088),
  chromeMaximize: a("chrome-maximize", 60089),
  chromeMinimize: a("chrome-minimize", 60090),
  chromeRestore: a("chrome-restore", 60091),
  circleOutline: a("circle-outline", 60092),
  circle: a("circle", 60092),
  debugBreakpointUnverified: a("debug-breakpoint-unverified", 60092),
  terminalDecorationIncomplete: a("terminal-decoration-incomplete", 60092),
  circleSlash: a("circle-slash", 60093),
  circuitBoard: a("circuit-board", 60094),
  clearAll: a("clear-all", 60095),
  clippy: a("clippy", 60096),
  closeAll: a("close-all", 60097),
  cloudDownload: a("cloud-download", 60098),
  cloudUpload: a("cloud-upload", 60099),
  code: a("code", 60100),
  collapseAll: a("collapse-all", 60101),
  colorMode: a("color-mode", 60102),
  commentDiscussion: a("comment-discussion", 60103),
  creditCard: a("credit-card", 60105),
  dash: a("dash", 60108),
  dashboard: a("dashboard", 60109),
  database: a("database", 60110),
  debugContinue: a("debug-continue", 60111),
  debugDisconnect: a("debug-disconnect", 60112),
  debugPause: a("debug-pause", 60113),
  debugRestart: a("debug-restart", 60114),
  debugStart: a("debug-start", 60115),
  debugStepInto: a("debug-step-into", 60116),
  debugStepOut: a("debug-step-out", 60117),
  debugStepOver: a("debug-step-over", 60118),
  debugStop: a("debug-stop", 60119),
  debug: a("debug", 60120),
  deviceCameraVideo: a("device-camera-video", 60121),
  deviceCamera: a("device-camera", 60122),
  deviceMobile: a("device-mobile", 60123),
  diffAdded: a("diff-added", 60124),
  diffIgnored: a("diff-ignored", 60125),
  diffModified: a("diff-modified", 60126),
  diffRemoved: a("diff-removed", 60127),
  diffRenamed: a("diff-renamed", 60128),
  diff: a("diff", 60129),
  diffSidebyside: a("diff-sidebyside", 60129),
  discard: a("discard", 60130),
  editorLayout: a("editor-layout", 60131),
  emptyWindow: a("empty-window", 60132),
  exclude: a("exclude", 60133),
  extensions: a("extensions", 60134),
  eyeClosed: a("eye-closed", 60135),
  fileBinary: a("file-binary", 60136),
  fileCode: a("file-code", 60137),
  fileMedia: a("file-media", 60138),
  filePdf: a("file-pdf", 60139),
  fileSubmodule: a("file-submodule", 60140),
  fileSymlinkDirectory: a("file-symlink-directory", 60141),
  fileSymlinkFile: a("file-symlink-file", 60142),
  fileZip: a("file-zip", 60143),
  files: a("files", 60144),
  filter: a("filter", 60145),
  flame: a("flame", 60146),
  foldDown: a("fold-down", 60147),
  foldUp: a("fold-up", 60148),
  fold: a("fold", 60149),
  folderActive: a("folder-active", 60150),
  folderOpened: a("folder-opened", 60151),
  gear: a("gear", 60152),
  gift: a("gift", 60153),
  gistSecret: a("gist-secret", 60154),
  gist: a("gist", 60155),
  gitCommit: a("git-commit", 60156),
  gitCompare: a("git-compare", 60157),
  compareChanges: a("compare-changes", 60157),
  gitMerge: a("git-merge", 60158),
  githubAction: a("github-action", 60159),
  githubAlt: a("github-alt", 60160),
  globe: a("globe", 60161),
  grabber: a("grabber", 60162),
  graph: a("graph", 60163),
  gripper: a("gripper", 60164),
  heart: a("heart", 60165),
  home: a("home", 60166),
  horizontalRule: a("horizontal-rule", 60167),
  hubot: a("hubot", 60168),
  inbox: a("inbox", 60169),
  issueReopened: a("issue-reopened", 60171),
  issues: a("issues", 60172),
  italic: a("italic", 60173),
  jersey: a("jersey", 60174),
  json: a("json", 60175),
  kebabVertical: a("kebab-vertical", 60176),
  key: a("key", 60177),
  law: a("law", 60178),
  lightbulbAutofix: a("lightbulb-autofix", 60179),
  linkExternal: a("link-external", 60180),
  link: a("link", 60181),
  listOrdered: a("list-ordered", 60182),
  listUnordered: a("list-unordered", 60183),
  liveShare: a("live-share", 60184),
  loading: a("loading", 60185),
  location: a("location", 60186),
  mailRead: a("mail-read", 60187),
  mail: a("mail", 60188),
  markdown: a("markdown", 60189),
  megaphone: a("megaphone", 60190),
  mention: a("mention", 60191),
  milestone: a("milestone", 60192),
  gitPullRequestMilestone: a("git-pull-request-milestone", 60192),
  mortarBoard: a("mortar-board", 60193),
  move: a("move", 60194),
  multipleWindows: a("multiple-windows", 60195),
  mute: a("mute", 60196),
  noNewline: a("no-newline", 60197),
  note: a("note", 60198),
  octoface: a("octoface", 60199),
  openPreview: a("open-preview", 60200),
  package: a("package", 60201),
  paintcan: a("paintcan", 60202),
  pin: a("pin", 60203),
  play: a("play", 60204),
  run: a("run", 60204),
  plug: a("plug", 60205),
  preserveCase: a("preserve-case", 60206),
  preview: a("preview", 60207),
  project: a("project", 60208),
  pulse: a("pulse", 60209),
  question: a("question", 60210),
  quote: a("quote", 60211),
  radioTower: a("radio-tower", 60212),
  reactions: a("reactions", 60213),
  references: a("references", 60214),
  refresh: a("refresh", 60215),
  regex: a("regex", 60216),
  remoteExplorer: a("remote-explorer", 60217),
  remote: a("remote", 60218),
  remove: a("remove", 60219),
  replaceAll: a("replace-all", 60220),
  replace: a("replace", 60221),
  repoClone: a("repo-clone", 60222),
  repoForcePush: a("repo-force-push", 60223),
  repoPull: a("repo-pull", 60224),
  repoPush: a("repo-push", 60225),
  report: a("report", 60226),
  requestChanges: a("request-changes", 60227),
  rocket: a("rocket", 60228),
  rootFolderOpened: a("root-folder-opened", 60229),
  rootFolder: a("root-folder", 60230),
  rss: a("rss", 60231),
  ruby: a("ruby", 60232),
  saveAll: a("save-all", 60233),
  saveAs: a("save-as", 60234),
  save: a("save", 60235),
  screenFull: a("screen-full", 60236),
  screenNormal: a("screen-normal", 60237),
  searchStop: a("search-stop", 60238),
  server: a("server", 60240),
  settingsGear: a("settings-gear", 60241),
  settings: a("settings", 60242),
  shield: a("shield", 60243),
  smiley: a("smiley", 60244),
  sortPrecedence: a("sort-precedence", 60245),
  splitHorizontal: a("split-horizontal", 60246),
  splitVertical: a("split-vertical", 60247),
  squirrel: a("squirrel", 60248),
  starFull: a("star-full", 60249),
  starHalf: a("star-half", 60250),
  symbolClass: a("symbol-class", 60251),
  symbolColor: a("symbol-color", 60252),
  symbolConstant: a("symbol-constant", 60253),
  symbolEnumMember: a("symbol-enum-member", 60254),
  symbolField: a("symbol-field", 60255),
  symbolFile: a("symbol-file", 60256),
  symbolInterface: a("symbol-interface", 60257),
  symbolKeyword: a("symbol-keyword", 60258),
  symbolMisc: a("symbol-misc", 60259),
  symbolOperator: a("symbol-operator", 60260),
  symbolProperty: a("symbol-property", 60261),
  wrench: a("wrench", 60261),
  wrenchSubaction: a("wrench-subaction", 60261),
  symbolSnippet: a("symbol-snippet", 60262),
  tasklist: a("tasklist", 60263),
  telescope: a("telescope", 60264),
  textSize: a("text-size", 60265),
  threeBars: a("three-bars", 60266),
  thumbsdown: a("thumbsdown", 60267),
  thumbsup: a("thumbsup", 60268),
  tools: a("tools", 60269),
  triangleDown: a("triangle-down", 60270),
  triangleLeft: a("triangle-left", 60271),
  triangleRight: a("triangle-right", 60272),
  triangleUp: a("triangle-up", 60273),
  twitter: a("twitter", 60274),
  unfold: a("unfold", 60275),
  unlock: a("unlock", 60276),
  unmute: a("unmute", 60277),
  unverified: a("unverified", 60278),
  verified: a("verified", 60279),
  versions: a("versions", 60280),
  vmActive: a("vm-active", 60281),
  vmOutline: a("vm-outline", 60282),
  vmRunning: a("vm-running", 60283),
  watch: a("watch", 60284),
  whitespace: a("whitespace", 60285),
  wholeWord: a("whole-word", 60286),
  window: a("window", 60287),
  wordWrap: a("word-wrap", 60288),
  zoomIn: a("zoom-in", 60289),
  zoomOut: a("zoom-out", 60290),
  listFilter: a("list-filter", 60291),
  listFlat: a("list-flat", 60292),
  listSelection: a("list-selection", 60293),
  selection: a("selection", 60293),
  listTree: a("list-tree", 60294),
  debugBreakpointFunctionUnverified: a("debug-breakpoint-function-unverified", 60295),
  debugBreakpointFunction: a("debug-breakpoint-function", 60296),
  debugBreakpointFunctionDisabled: a("debug-breakpoint-function-disabled", 60296),
  debugStackframeActive: a("debug-stackframe-active", 60297),
  circleSmallFilled: a("circle-small-filled", 60298),
  debugStackframeDot: a("debug-stackframe-dot", 60298),
  terminalDecorationMark: a("terminal-decoration-mark", 60298),
  debugStackframe: a("debug-stackframe", 60299),
  debugStackframeFocused: a("debug-stackframe-focused", 60299),
  debugBreakpointUnsupported: a("debug-breakpoint-unsupported", 60300),
  symbolString: a("symbol-string", 60301),
  debugReverseContinue: a("debug-reverse-continue", 60302),
  debugStepBack: a("debug-step-back", 60303),
  debugRestartFrame: a("debug-restart-frame", 60304),
  debugAlt: a("debug-alt", 60305),
  callIncoming: a("call-incoming", 60306),
  callOutgoing: a("call-outgoing", 60307),
  menu: a("menu", 60308),
  expandAll: a("expand-all", 60309),
  feedback: a("feedback", 60310),
  gitPullRequestReviewer: a("git-pull-request-reviewer", 60310),
  groupByRefType: a("group-by-ref-type", 60311),
  ungroupByRefType: a("ungroup-by-ref-type", 60312),
  account: a("account", 60313),
  gitPullRequestAssignee: a("git-pull-request-assignee", 60313),
  bellDot: a("bell-dot", 60314),
  debugConsole: a("debug-console", 60315),
  library: a("library", 60316),
  output: a("output", 60317),
  runAll: a("run-all", 60318),
  syncIgnored: a("sync-ignored", 60319),
  pinned: a("pinned", 60320),
  githubInverted: a("github-inverted", 60321),
  serverProcess: a("server-process", 60322),
  serverEnvironment: a("server-environment", 60323),
  pass: a("pass", 60324),
  issueClosed: a("issue-closed", 60324),
  stopCircle: a("stop-circle", 60325),
  playCircle: a("play-circle", 60326),
  record: a("record", 60327),
  debugAltSmall: a("debug-alt-small", 60328),
  vmConnect: a("vm-connect", 60329),
  cloud: a("cloud", 60330),
  merge: a("merge", 60331),
  export: a("export", 60332),
  graphLeft: a("graph-left", 60333),
  magnet: a("magnet", 60334),
  notebook: a("notebook", 60335),
  redo: a("redo", 60336),
  checkAll: a("check-all", 60337),
  pinnedDirty: a("pinned-dirty", 60338),
  passFilled: a("pass-filled", 60339),
  circleLargeFilled: a("circle-large-filled", 60340),
  circleLarge: a("circle-large", 60341),
  circleLargeOutline: a("circle-large-outline", 60341),
  combine: a("combine", 60342),
  gather: a("gather", 60342),
  table: a("table", 60343),
  variableGroup: a("variable-group", 60344),
  typeHierarchy: a("type-hierarchy", 60345),
  typeHierarchySub: a("type-hierarchy-sub", 60346),
  typeHierarchySuper: a("type-hierarchy-super", 60347),
  gitPullRequestCreate: a("git-pull-request-create", 60348),
  runAbove: a("run-above", 60349),
  runBelow: a("run-below", 60350),
  notebookTemplate: a("notebook-template", 60351),
  debugRerun: a("debug-rerun", 60352),
  workspaceTrusted: a("workspace-trusted", 60353),
  workspaceUntrusted: a("workspace-untrusted", 60354),
  workspaceUnknown: a("workspace-unknown", 60355),
  terminalCmd: a("terminal-cmd", 60356),
  terminalDebian: a("terminal-debian", 60357),
  terminalLinux: a("terminal-linux", 60358),
  terminalPowershell: a("terminal-powershell", 60359),
  terminalTmux: a("terminal-tmux", 60360),
  terminalUbuntu: a("terminal-ubuntu", 60361),
  terminalBash: a("terminal-bash", 60362),
  arrowSwap: a("arrow-swap", 60363),
  copy: a("copy", 60364),
  personAdd: a("person-add", 60365),
  filterFilled: a("filter-filled", 60366),
  wand: a("wand", 60367),
  debugLineByLine: a("debug-line-by-line", 60368),
  inspect: a("inspect", 60369),
  layers: a("layers", 60370),
  layersDot: a("layers-dot", 60371),
  layersActive: a("layers-active", 60372),
  compass: a("compass", 60373),
  compassDot: a("compass-dot", 60374),
  compassActive: a("compass-active", 60375),
  azure: a("azure", 60376),
  issueDraft: a("issue-draft", 60377),
  gitPullRequestClosed: a("git-pull-request-closed", 60378),
  gitPullRequestDraft: a("git-pull-request-draft", 60379),
  debugAll: a("debug-all", 60380),
  debugCoverage: a("debug-coverage", 60381),
  runErrors: a("run-errors", 60382),
  folderLibrary: a("folder-library", 60383),
  debugContinueSmall: a("debug-continue-small", 60384),
  beakerStop: a("beaker-stop", 60385),
  graphLine: a("graph-line", 60386),
  graphScatter: a("graph-scatter", 60387),
  pieChart: a("pie-chart", 60388),
  bracket: a("bracket", 60175),
  bracketDot: a("bracket-dot", 60389),
  bracketError: a("bracket-error", 60390),
  lockSmall: a("lock-small", 60391),
  azureDevops: a("azure-devops", 60392),
  verifiedFilled: a("verified-filled", 60393),
  newline: a("newline", 60394),
  layout: a("layout", 60395),
  layoutActivitybarLeft: a("layout-activitybar-left", 60396),
  layoutActivitybarRight: a("layout-activitybar-right", 60397),
  layoutPanelLeft: a("layout-panel-left", 60398),
  layoutPanelCenter: a("layout-panel-center", 60399),
  layoutPanelJustify: a("layout-panel-justify", 60400),
  layoutPanelRight: a("layout-panel-right", 60401),
  layoutPanel: a("layout-panel", 60402),
  layoutSidebarLeft: a("layout-sidebar-left", 60403),
  layoutSidebarRight: a("layout-sidebar-right", 60404),
  layoutStatusbar: a("layout-statusbar", 60405),
  layoutMenubar: a("layout-menubar", 60406),
  layoutCentered: a("layout-centered", 60407),
  target: a("target", 60408),
  indent: a("indent", 60409),
  recordSmall: a("record-small", 60410),
  errorSmall: a("error-small", 60411),
  terminalDecorationError: a("terminal-decoration-error", 60411),
  arrowCircleDown: a("arrow-circle-down", 60412),
  arrowCircleLeft: a("arrow-circle-left", 60413),
  arrowCircleRight: a("arrow-circle-right", 60414),
  arrowCircleUp: a("arrow-circle-up", 60415),
  layoutSidebarRightOff: a("layout-sidebar-right-off", 60416),
  layoutPanelOff: a("layout-panel-off", 60417),
  layoutSidebarLeftOff: a("layout-sidebar-left-off", 60418),
  blank: a("blank", 60419),
  heartFilled: a("heart-filled", 60420),
  map: a("map", 60421),
  mapHorizontal: a("map-horizontal", 60421),
  foldHorizontal: a("fold-horizontal", 60421),
  mapFilled: a("map-filled", 60422),
  mapHorizontalFilled: a("map-horizontal-filled", 60422),
  foldHorizontalFilled: a("fold-horizontal-filled", 60422),
  circleSmall: a("circle-small", 60423),
  bellSlash: a("bell-slash", 60424),
  bellSlashDot: a("bell-slash-dot", 60425),
  commentUnresolved: a("comment-unresolved", 60426),
  gitPullRequestGoToChanges: a("git-pull-request-go-to-changes", 60427),
  gitPullRequestNewChanges: a("git-pull-request-new-changes", 60428),
  searchFuzzy: a("search-fuzzy", 60429),
  commentDraft: a("comment-draft", 60430),
  send: a("send", 60431),
  sparkle: a("sparkle", 60432),
  insert: a("insert", 60433),
  mic: a("mic", 60434),
  thumbsdownFilled: a("thumbsdown-filled", 60435),
  thumbsupFilled: a("thumbsup-filled", 60436),
  coffee: a("coffee", 60437),
  snake: a("snake", 60438),
  game: a("game", 60439),
  vr: a("vr", 60440),
  chip: a("chip", 60441),
  piano: a("piano", 60442),
  music: a("music", 60443),
  micFilled: a("mic-filled", 60444),
  repoFetch: a("repo-fetch", 60445),
  copilot: a("copilot", 60446),
  lightbulbSparkle: a("lightbulb-sparkle", 60447),
  robot: a("robot", 60448),
  sparkleFilled: a("sparkle-filled", 60449),
  diffSingle: a("diff-single", 60450),
  diffMultiple: a("diff-multiple", 60451),
  surroundWith: a("surround-with", 60452),
  share: a("share", 60453),
  gitStash: a("git-stash", 60454),
  gitStashApply: a("git-stash-apply", 60455),
  gitStashPop: a("git-stash-pop", 60456),
  vscode: a("vscode", 60457),
  vscodeInsiders: a("vscode-insiders", 60458),
  codeOss: a("code-oss", 60459),
  runCoverage: a("run-coverage", 60460),
  runAllCoverage: a("run-all-coverage", 60461),
  coverage: a("coverage", 60462),
  githubProject: a("github-project", 60463),
  mapVertical: a("map-vertical", 60464),
  foldVertical: a("fold-vertical", 60464),
  mapVerticalFilled: a("map-vertical-filled", 60465),
  foldVerticalFilled: a("fold-vertical-filled", 60465),
  goToSearch: a("go-to-search", 60466),
  percentage: a("percentage", 60467),
  sortPercentage: a("sort-percentage", 60467),
  attach: a("attach", 60468)
}, Mi = {
  dialogError: a("dialog-error", "error"),
  dialogWarning: a("dialog-warning", "warning"),
  dialogInfo: a("dialog-info", "info"),
  dialogClose: a("dialog-close", "close"),
  treeItemExpanded: a("tree-item-expanded", "chevron-down"),
  // collapsed is done with rotation
  treeFilterOnTypeOn: a("tree-filter-on-type-on", "list-filter"),
  treeFilterOnTypeOff: a("tree-filter-on-type-off", "list-selection"),
  treeFilterClear: a("tree-filter-clear", "close"),
  treeItemLoading: a("tree-item-loading", "loading"),
  menuSelection: a("menu-selection", "check"),
  menuSubmenu: a("menu-submenu", "chevron-right"),
  menuBarMore: a("menubar-more", "more"),
  scrollbarButtonLeft: a("scrollbar-button-left", "triangle-left"),
  scrollbarButtonRight: a("scrollbar-button-right", "triangle-right"),
  scrollbarButtonUp: a("scrollbar-button-up", "triangle-up"),
  scrollbarButtonDown: a("scrollbar-button-down", "triangle-down"),
  toolBarMore: a("toolbar-more", "more"),
  quickInputBack: a("quick-input-back", "arrow-left"),
  dropDownButton: a("drop-down-button", 60084),
  symbolCustomColor: a("symbol-customcolor", 60252),
  exportIcon: a("export", 60332),
  workspaceUnspecified: a("workspace-unspecified", 60355),
  newLine: a("newline", 60394),
  thumbsDownFilled: a("thumbsdown-filled", 60435),
  thumbsUpFilled: a("thumbsup-filled", 60436),
  gitFetch: a("git-fetch", 60445),
  lightbulbSparkleAutofix: a("lightbulb-sparkle-autofix", 60447),
  debugBreakpointPending: a("debug-breakpoint-pending", 60377)
}, M = {
  ...Ei,
  ...Mi
};
class Os {
  constructor() {
    this._tokenizationSupports = /* @__PURE__ */ new Map(), this._factories = /* @__PURE__ */ new Map(), this._onDidChange = new le(), this.onDidChange = this._onDidChange.event, this._colorMap = null;
  }
  handleChange(t) {
    this._onDidChange.fire({
      changedLanguages: t,
      changedColorMap: !1
    });
  }
  register(t, n) {
    return this._tokenizationSupports.set(t, n), this.handleChange([t]), Ct(() => {
      this._tokenizationSupports.get(t) === n && (this._tokenizationSupports.delete(t), this.handleChange([t]));
    });
  }
  get(t) {
    return this._tokenizationSupports.get(t) || null;
  }
  registerFactory(t, n) {
    var r;
    (r = this._factories.get(t)) == null || r.dispose();
    const s = new ki(this, t, n);
    return this._factories.set(t, s), Ct(() => {
      const i = this._factories.get(t);
      !i || i !== s || (this._factories.delete(t), i.dispose());
    });
  }
  async getOrCreate(t) {
    const n = this.get(t);
    if (n)
      return n;
    const s = this._factories.get(t);
    return !s || s.isResolved ? null : (await s.resolve(), this.get(t));
  }
  isResolved(t) {
    if (this.get(t))
      return !0;
    const s = this._factories.get(t);
    return !!(!s || s.isResolved);
  }
  setColorMap(t) {
    this._colorMap = t, this._onDidChange.fire({
      changedLanguages: Array.from(this._tokenizationSupports.keys()),
      changedColorMap: !0
    });
  }
  getColorMap() {
    return this._colorMap;
  }
  getDefaultBackground() {
    return this._colorMap && this._colorMap.length > 2 ? this._colorMap[
      2
      /* ColorId.DefaultBackground */
    ] : null;
  }
}
class ki extends Ye {
  get isResolved() {
    return this._isResolved;
  }
  constructor(t, n, s) {
    super(), this._registry = t, this._languageId = n, this._factory = s, this._isDisposed = !1, this._resolvePromise = null, this._isResolved = !1;
  }
  dispose() {
    this._isDisposed = !0, super.dispose();
  }
  async resolve() {
    return this._resolvePromise || (this._resolvePromise = this._create()), this._resolvePromise;
  }
  async _create() {
    const t = await this._factory.tokenizationSupport;
    this._isResolved = !0, t && !this._isDisposed && this._register(this._registry.register(this._languageId, t));
  }
}
class Fi {
  constructor(t, n, s) {
    this.offset = t, this.type = n, this.language = s, this._tokenBrand = void 0;
  }
  toString() {
    return "(" + this.offset + ", " + this.type + ")";
  }
}
var Q1;
(function(e) {
  e[e.Increase = 0] = "Increase", e[e.Decrease = 1] = "Decrease";
})(Q1 || (Q1 = {}));
var Y1;
(function(e) {
  const t = /* @__PURE__ */ new Map();
  t.set(0, M.symbolMethod), t.set(1, M.symbolFunction), t.set(2, M.symbolConstructor), t.set(3, M.symbolField), t.set(4, M.symbolVariable), t.set(5, M.symbolClass), t.set(6, M.symbolStruct), t.set(7, M.symbolInterface), t.set(8, M.symbolModule), t.set(9, M.symbolProperty), t.set(10, M.symbolEvent), t.set(11, M.symbolOperator), t.set(12, M.symbolUnit), t.set(13, M.symbolValue), t.set(15, M.symbolEnum), t.set(14, M.symbolConstant), t.set(15, M.symbolEnum), t.set(16, M.symbolEnumMember), t.set(17, M.symbolKeyword), t.set(27, M.symbolSnippet), t.set(18, M.symbolText), t.set(19, M.symbolColor), t.set(20, M.symbolFile), t.set(21, M.symbolReference), t.set(22, M.symbolCustomColor), t.set(23, M.symbolFolder), t.set(24, M.symbolTypeParameter), t.set(25, M.account), t.set(26, M.issues);
  function n(i) {
    let o = t.get(i);
    return o || (console.info("No codicon found for CompletionItemKind " + i), o = M.symbolProperty), o;
  }
  e.toIcon = n;
  const s = /* @__PURE__ */ new Map();
  s.set(
    "method",
    0
    /* CompletionItemKind.Method */
  ), s.set(
    "function",
    1
    /* CompletionItemKind.Function */
  ), s.set(
    "constructor",
    2
    /* CompletionItemKind.Constructor */
  ), s.set(
    "field",
    3
    /* CompletionItemKind.Field */
  ), s.set(
    "variable",
    4
    /* CompletionItemKind.Variable */
  ), s.set(
    "class",
    5
    /* CompletionItemKind.Class */
  ), s.set(
    "struct",
    6
    /* CompletionItemKind.Struct */
  ), s.set(
    "interface",
    7
    /* CompletionItemKind.Interface */
  ), s.set(
    "module",
    8
    /* CompletionItemKind.Module */
  ), s.set(
    "property",
    9
    /* CompletionItemKind.Property */
  ), s.set(
    "event",
    10
    /* CompletionItemKind.Event */
  ), s.set(
    "operator",
    11
    /* CompletionItemKind.Operator */
  ), s.set(
    "unit",
    12
    /* CompletionItemKind.Unit */
  ), s.set(
    "value",
    13
    /* CompletionItemKind.Value */
  ), s.set(
    "constant",
    14
    /* CompletionItemKind.Constant */
  ), s.set(
    "enum",
    15
    /* CompletionItemKind.Enum */
  ), s.set(
    "enum-member",
    16
    /* CompletionItemKind.EnumMember */
  ), s.set(
    "enumMember",
    16
    /* CompletionItemKind.EnumMember */
  ), s.set(
    "keyword",
    17
    /* CompletionItemKind.Keyword */
  ), s.set(
    "snippet",
    27
    /* CompletionItemKind.Snippet */
  ), s.set(
    "text",
    18
    /* CompletionItemKind.Text */
  ), s.set(
    "color",
    19
    /* CompletionItemKind.Color */
  ), s.set(
    "file",
    20
    /* CompletionItemKind.File */
  ), s.set(
    "reference",
    21
    /* CompletionItemKind.Reference */
  ), s.set(
    "customcolor",
    22
    /* CompletionItemKind.Customcolor */
  ), s.set(
    "folder",
    23
    /* CompletionItemKind.Folder */
  ), s.set(
    "type-parameter",
    24
    /* CompletionItemKind.TypeParameter */
  ), s.set(
    "typeParameter",
    24
    /* CompletionItemKind.TypeParameter */
  ), s.set(
    "account",
    25
    /* CompletionItemKind.User */
  ), s.set(
    "issue",
    26
    /* CompletionItemKind.Issue */
  );
  function r(i, o) {
    let l = s.get(i);
    return typeof l > "u" && !o && (l = 9), l;
  }
  e.fromString = r;
})(Y1 || (Y1 = {}));
var J1;
(function(e) {
  e[e.Automatic = 0] = "Automatic", e[e.Explicit = 1] = "Explicit";
})(J1 || (J1 = {}));
var Z1;
(function(e) {
  e[e.Automatic = 0] = "Automatic", e[e.PasteAs = 1] = "PasteAs";
})(Z1 || (Z1 = {}));
var K1;
(function(e) {
  e[e.Invoke = 1] = "Invoke", e[e.TriggerCharacter = 2] = "TriggerCharacter", e[e.ContentChange = 3] = "ContentChange";
})(K1 || (K1 = {}));
var en;
(function(e) {
  e[e.Text = 0] = "Text", e[e.Read = 1] = "Read", e[e.Write = 2] = "Write";
})(en || (en = {}));
z("Array", "array"), z("Boolean", "boolean"), z("Class", "class"), z("Constant", "constant"), z("Constructor", "constructor"), z("Enum", "enumeration"), z("EnumMember", "enumeration member"), z("Event", "event"), z("Field", "field"), z("File", "file"), z("Function", "function"), z("Interface", "interface"), z("Key", "key"), z("Method", "method"), z("Module", "module"), z("Namespace", "namespace"), z("Null", "null"), z("Number", "number"), z("Object", "object"), z("Operator", "operator"), z("Package", "package"), z("Property", "property"), z("String", "string"), z("Struct", "struct"), z("TypeParameter", "type parameter"), z("Variable", "variable");
var tn;
(function(e) {
  const t = /* @__PURE__ */ new Map();
  t.set(0, M.symbolFile), t.set(1, M.symbolModule), t.set(2, M.symbolNamespace), t.set(3, M.symbolPackage), t.set(4, M.symbolClass), t.set(5, M.symbolMethod), t.set(6, M.symbolProperty), t.set(7, M.symbolField), t.set(8, M.symbolConstructor), t.set(9, M.symbolEnum), t.set(10, M.symbolInterface), t.set(11, M.symbolFunction), t.set(12, M.symbolVariable), t.set(13, M.symbolConstant), t.set(14, M.symbolString), t.set(15, M.symbolNumber), t.set(16, M.symbolBoolean), t.set(17, M.symbolArray), t.set(18, M.symbolObject), t.set(19, M.symbolKey), t.set(20, M.symbolNull), t.set(21, M.symbolEnumMember), t.set(22, M.symbolStruct), t.set(23, M.symbolEvent), t.set(24, M.symbolOperator), t.set(25, M.symbolTypeParameter);
  function n(s) {
    let r = t.get(s);
    return r || (console.info("No codicon found for SymbolKind " + s), r = M.symbolProperty), r;
  }
  e.toIcon = n;
})(tn || (tn = {}));
const oe = class oe {
  /**
   * Returns a {@link FoldingRangeKind} for the given value.
   *
   * @param value of the kind.
   */
  static fromValue(t) {
    switch (t) {
      case "comment":
        return oe.Comment;
      case "imports":
        return oe.Imports;
      case "region":
        return oe.Region;
    }
    return new oe(t);
  }
  /**
   * Creates a new {@link FoldingRangeKind}.
   *
   * @param value of the kind.
   */
  constructor(t) {
    this.value = t;
  }
};
oe.Comment = new oe("comment"), oe.Imports = new oe("imports"), oe.Region = new oe("region");
let nn = oe;
var sn;
(function(e) {
  e[e.AIGenerated = 1] = "AIGenerated";
})(sn || (sn = {}));
var rn;
(function(e) {
  e[e.Invoke = 0] = "Invoke", e[e.Automatic = 1] = "Automatic";
})(rn || (rn = {}));
var an;
(function(e) {
  function t(n) {
    return !n || typeof n != "object" ? !1 : typeof n.id == "string" && typeof n.title == "string";
  }
  e.is = t;
})(an || (an = {}));
var on;
(function(e) {
  e[e.Type = 1] = "Type", e[e.Parameter = 2] = "Parameter";
})(on || (on = {}));
new Os();
new Os();
var ln;
(function(e) {
  e[e.Invoke = 0] = "Invoke", e[e.Automatic = 1] = "Automatic";
})(ln || (ln = {}));
var un;
(function(e) {
  e[e.Unknown = 0] = "Unknown", e[e.Disabled = 1] = "Disabled", e[e.Enabled = 2] = "Enabled";
})(un || (un = {}));
var cn;
(function(e) {
  e[e.Invoke = 1] = "Invoke", e[e.Auto = 2] = "Auto";
})(cn || (cn = {}));
var hn;
(function(e) {
  e[e.None = 0] = "None", e[e.KeepWhitespace = 1] = "KeepWhitespace", e[e.InsertAsSnippet = 4] = "InsertAsSnippet";
})(hn || (hn = {}));
var fn;
(function(e) {
  e[e.Method = 0] = "Method", e[e.Function = 1] = "Function", e[e.Constructor = 2] = "Constructor", e[e.Field = 3] = "Field", e[e.Variable = 4] = "Variable", e[e.Class = 5] = "Class", e[e.Struct = 6] = "Struct", e[e.Interface = 7] = "Interface", e[e.Module = 8] = "Module", e[e.Property = 9] = "Property", e[e.Event = 10] = "Event", e[e.Operator = 11] = "Operator", e[e.Unit = 12] = "Unit", e[e.Value = 13] = "Value", e[e.Constant = 14] = "Constant", e[e.Enum = 15] = "Enum", e[e.EnumMember = 16] = "EnumMember", e[e.Keyword = 17] = "Keyword", e[e.Text = 18] = "Text", e[e.Color = 19] = "Color", e[e.File = 20] = "File", e[e.Reference = 21] = "Reference", e[e.Customcolor = 22] = "Customcolor", e[e.Folder = 23] = "Folder", e[e.TypeParameter = 24] = "TypeParameter", e[e.User = 25] = "User", e[e.Issue = 26] = "Issue", e[e.Snippet = 27] = "Snippet";
})(fn || (fn = {}));
var dn;
(function(e) {
  e[e.Deprecated = 1] = "Deprecated";
})(dn || (dn = {}));
var mn;
(function(e) {
  e[e.Invoke = 0] = "Invoke", e[e.TriggerCharacter = 1] = "TriggerCharacter", e[e.TriggerForIncompleteCompletions = 2] = "TriggerForIncompleteCompletions";
})(mn || (mn = {}));
var gn;
(function(e) {
  e[e.EXACT = 0] = "EXACT", e[e.ABOVE = 1] = "ABOVE", e[e.BELOW = 2] = "BELOW";
})(gn || (gn = {}));
var bn;
(function(e) {
  e[e.NotSet = 0] = "NotSet", e[e.ContentFlush = 1] = "ContentFlush", e[e.RecoverFromMarkers = 2] = "RecoverFromMarkers", e[e.Explicit = 3] = "Explicit", e[e.Paste = 4] = "Paste", e[e.Undo = 5] = "Undo", e[e.Redo = 6] = "Redo";
})(bn || (bn = {}));
var pn;
(function(e) {
  e[e.LF = 1] = "LF", e[e.CRLF = 2] = "CRLF";
})(pn || (pn = {}));
var xn;
(function(e) {
  e[e.Text = 0] = "Text", e[e.Read = 1] = "Read", e[e.Write = 2] = "Write";
})(xn || (xn = {}));
var _n;
(function(e) {
  e[e.None = 0] = "None", e[e.Keep = 1] = "Keep", e[e.Brackets = 2] = "Brackets", e[e.Advanced = 3] = "Advanced", e[e.Full = 4] = "Full";
})(_n || (_n = {}));
var wn;
(function(e) {
  e[e.acceptSuggestionOnCommitCharacter = 0] = "acceptSuggestionOnCommitCharacter", e[e.acceptSuggestionOnEnter = 1] = "acceptSuggestionOnEnter", e[e.accessibilitySupport = 2] = "accessibilitySupport", e[e.accessibilityPageSize = 3] = "accessibilityPageSize", e[e.ariaLabel = 4] = "ariaLabel", e[e.ariaRequired = 5] = "ariaRequired", e[e.autoClosingBrackets = 6] = "autoClosingBrackets", e[e.autoClosingComments = 7] = "autoClosingComments", e[e.screenReaderAnnounceInlineSuggestion = 8] = "screenReaderAnnounceInlineSuggestion", e[e.autoClosingDelete = 9] = "autoClosingDelete", e[e.autoClosingOvertype = 10] = "autoClosingOvertype", e[e.autoClosingQuotes = 11] = "autoClosingQuotes", e[e.autoIndent = 12] = "autoIndent", e[e.automaticLayout = 13] = "automaticLayout", e[e.autoSurround = 14] = "autoSurround", e[e.bracketPairColorization = 15] = "bracketPairColorization", e[e.guides = 16] = "guides", e[e.codeLens = 17] = "codeLens", e[e.codeLensFontFamily = 18] = "codeLensFontFamily", e[e.codeLensFontSize = 19] = "codeLensFontSize", e[e.colorDecorators = 20] = "colorDecorators", e[e.colorDecoratorsLimit = 21] = "colorDecoratorsLimit", e[e.columnSelection = 22] = "columnSelection", e[e.comments = 23] = "comments", e[e.contextmenu = 24] = "contextmenu", e[e.copyWithSyntaxHighlighting = 25] = "copyWithSyntaxHighlighting", e[e.cursorBlinking = 26] = "cursorBlinking", e[e.cursorSmoothCaretAnimation = 27] = "cursorSmoothCaretAnimation", e[e.cursorStyle = 28] = "cursorStyle", e[e.cursorSurroundingLines = 29] = "cursorSurroundingLines", e[e.cursorSurroundingLinesStyle = 30] = "cursorSurroundingLinesStyle", e[e.cursorWidth = 31] = "cursorWidth", e[e.disableLayerHinting = 32] = "disableLayerHinting", e[e.disableMonospaceOptimizations = 33] = "disableMonospaceOptimizations", e[e.domReadOnly = 34] = "domReadOnly", e[e.dragAndDrop = 35] = "dragAndDrop", e[e.dropIntoEditor = 36] = "dropIntoEditor", e[e.emptySelectionClipboard = 37] = "emptySelectionClipboard", e[e.experimentalWhitespaceRendering = 38] = "experimentalWhitespaceRendering", e[e.extraEditorClassName = 39] = "extraEditorClassName", e[e.fastScrollSensitivity = 40] = "fastScrollSensitivity", e[e.find = 41] = "find", e[e.fixedOverflowWidgets = 42] = "fixedOverflowWidgets", e[e.folding = 43] = "folding", e[e.foldingStrategy = 44] = "foldingStrategy", e[e.foldingHighlight = 45] = "foldingHighlight", e[e.foldingImportsByDefault = 46] = "foldingImportsByDefault", e[e.foldingMaximumRegions = 47] = "foldingMaximumRegions", e[e.unfoldOnClickAfterEndOfLine = 48] = "unfoldOnClickAfterEndOfLine", e[e.fontFamily = 49] = "fontFamily", e[e.fontInfo = 50] = "fontInfo", e[e.fontLigatures = 51] = "fontLigatures", e[e.fontSize = 52] = "fontSize", e[e.fontWeight = 53] = "fontWeight", e[e.fontVariations = 54] = "fontVariations", e[e.formatOnPaste = 55] = "formatOnPaste", e[e.formatOnType = 56] = "formatOnType", e[e.glyphMargin = 57] = "glyphMargin", e[e.gotoLocation = 58] = "gotoLocation", e[e.hideCursorInOverviewRuler = 59] = "hideCursorInOverviewRuler", e[e.hover = 60] = "hover", e[e.inDiffEditor = 61] = "inDiffEditor", e[e.inlineSuggest = 62] = "inlineSuggest", e[e.inlineEdit = 63] = "inlineEdit", e[e.letterSpacing = 64] = "letterSpacing", e[e.lightbulb = 65] = "lightbulb", e[e.lineDecorationsWidth = 66] = "lineDecorationsWidth", e[e.lineHeight = 67] = "lineHeight", e[e.lineNumbers = 68] = "lineNumbers", e[e.lineNumbersMinChars = 69] = "lineNumbersMinChars", e[e.linkedEditing = 70] = "linkedEditing", e[e.links = 71] = "links", e[e.matchBrackets = 72] = "matchBrackets", e[e.minimap = 73] = "minimap", e[e.mouseStyle = 74] = "mouseStyle", e[e.mouseWheelScrollSensitivity = 75] = "mouseWheelScrollSensitivity", e[e.mouseWheelZoom = 76] = "mouseWheelZoom", e[e.multiCursorMergeOverlapping = 77] = "multiCursorMergeOverlapping", e[e.multiCursorModifier = 78] = "multiCursorModifier", e[e.multiCursorPaste = 79] = "multiCursorPaste", e[e.multiCursorLimit = 80] = "multiCursorLimit", e[e.occurrencesHighlight = 81] = "occurrencesHighlight", e[e.overviewRulerBorder = 82] = "overviewRulerBorder", e[e.overviewRulerLanes = 83] = "overviewRulerLanes", e[e.padding = 84] = "padding", e[e.pasteAs = 85] = "pasteAs", e[e.parameterHints = 86] = "parameterHints", e[e.peekWidgetDefaultFocus = 87] = "peekWidgetDefaultFocus", e[e.placeholder = 88] = "placeholder", e[e.definitionLinkOpensInPeek = 89] = "definitionLinkOpensInPeek", e[e.quickSuggestions = 90] = "quickSuggestions", e[e.quickSuggestionsDelay = 91] = "quickSuggestionsDelay", e[e.readOnly = 92] = "readOnly", e[e.readOnlyMessage = 93] = "readOnlyMessage", e[e.renameOnType = 94] = "renameOnType", e[e.renderControlCharacters = 95] = "renderControlCharacters", e[e.renderFinalNewline = 96] = "renderFinalNewline", e[e.renderLineHighlight = 97] = "renderLineHighlight", e[e.renderLineHighlightOnlyWhenFocus = 98] = "renderLineHighlightOnlyWhenFocus", e[e.renderValidationDecorations = 99] = "renderValidationDecorations", e[e.renderWhitespace = 100] = "renderWhitespace", e[e.revealHorizontalRightPadding = 101] = "revealHorizontalRightPadding", e[e.roundedSelection = 102] = "roundedSelection", e[e.rulers = 103] = "rulers", e[e.scrollbar = 104] = "scrollbar", e[e.scrollBeyondLastColumn = 105] = "scrollBeyondLastColumn", e[e.scrollBeyondLastLine = 106] = "scrollBeyondLastLine", e[e.scrollPredominantAxis = 107] = "scrollPredominantAxis", e[e.selectionClipboard = 108] = "selectionClipboard", e[e.selectionHighlight = 109] = "selectionHighlight", e[e.selectOnLineNumbers = 110] = "selectOnLineNumbers", e[e.showFoldingControls = 111] = "showFoldingControls", e[e.showUnused = 112] = "showUnused", e[e.snippetSuggestions = 113] = "snippetSuggestions", e[e.smartSelect = 114] = "smartSelect", e[e.smoothScrolling = 115] = "smoothScrolling", e[e.stickyScroll = 116] = "stickyScroll", e[e.stickyTabStops = 117] = "stickyTabStops", e[e.stopRenderingLineAfter = 118] = "stopRenderingLineAfter", e[e.suggest = 119] = "suggest", e[e.suggestFontSize = 120] = "suggestFontSize", e[e.suggestLineHeight = 121] = "suggestLineHeight", e[e.suggestOnTriggerCharacters = 122] = "suggestOnTriggerCharacters", e[e.suggestSelection = 123] = "suggestSelection", e[e.tabCompletion = 124] = "tabCompletion", e[e.tabIndex = 125] = "tabIndex", e[e.unicodeHighlighting = 126] = "unicodeHighlighting", e[e.unusualLineTerminators = 127] = "unusualLineTerminators", e[e.useShadowDOM = 128] = "useShadowDOM", e[e.useTabStops = 129] = "useTabStops", e[e.wordBreak = 130] = "wordBreak", e[e.wordSegmenterLocales = 131] = "wordSegmenterLocales", e[e.wordSeparators = 132] = "wordSeparators", e[e.wordWrap = 133] = "wordWrap", e[e.wordWrapBreakAfterCharacters = 134] = "wordWrapBreakAfterCharacters", e[e.wordWrapBreakBeforeCharacters = 135] = "wordWrapBreakBeforeCharacters", e[e.wordWrapColumn = 136] = "wordWrapColumn", e[e.wordWrapOverride1 = 137] = "wordWrapOverride1", e[e.wordWrapOverride2 = 138] = "wordWrapOverride2", e[e.wrappingIndent = 139] = "wrappingIndent", e[e.wrappingStrategy = 140] = "wrappingStrategy", e[e.showDeprecated = 141] = "showDeprecated", e[e.inlayHints = 142] = "inlayHints", e[e.editorClassName = 143] = "editorClassName", e[e.pixelRatio = 144] = "pixelRatio", e[e.tabFocusMode = 145] = "tabFocusMode", e[e.layoutInfo = 146] = "layoutInfo", e[e.wrappingInfo = 147] = "wrappingInfo", e[e.defaultColorDecorators = 148] = "defaultColorDecorators", e[e.colorDecoratorsActivatedOn = 149] = "colorDecoratorsActivatedOn", e[e.inlineCompletionsAccessibilityVerbose = 150] = "inlineCompletionsAccessibilityVerbose";
})(wn || (wn = {}));
var Ln;
(function(e) {
  e[e.TextDefined = 0] = "TextDefined", e[e.LF = 1] = "LF", e[e.CRLF = 2] = "CRLF";
})(Ln || (Ln = {}));
var vn;
(function(e) {
  e[e.LF = 0] = "LF", e[e.CRLF = 1] = "CRLF";
})(vn || (vn = {}));
var Nn;
(function(e) {
  e[e.Left = 1] = "Left", e[e.Center = 2] = "Center", e[e.Right = 3] = "Right";
})(Nn || (Nn = {}));
var Sn;
(function(e) {
  e[e.Increase = 0] = "Increase", e[e.Decrease = 1] = "Decrease";
})(Sn || (Sn = {}));
var Cn;
(function(e) {
  e[e.None = 0] = "None", e[e.Indent = 1] = "Indent", e[e.IndentOutdent = 2] = "IndentOutdent", e[e.Outdent = 3] = "Outdent";
})(Cn || (Cn = {}));
var An;
(function(e) {
  e[e.Both = 0] = "Both", e[e.Right = 1] = "Right", e[e.Left = 2] = "Left", e[e.None = 3] = "None";
})(An || (An = {}));
var Rn;
(function(e) {
  e[e.Type = 1] = "Type", e[e.Parameter = 2] = "Parameter";
})(Rn || (Rn = {}));
var yn;
(function(e) {
  e[e.Automatic = 0] = "Automatic", e[e.Explicit = 1] = "Explicit";
})(yn || (yn = {}));
var En;
(function(e) {
  e[e.Invoke = 0] = "Invoke", e[e.Automatic = 1] = "Automatic";
})(En || (En = {}));
var f1;
(function(e) {
  e[e.DependsOnKbLayout = -1] = "DependsOnKbLayout", e[e.Unknown = 0] = "Unknown", e[e.Backspace = 1] = "Backspace", e[e.Tab = 2] = "Tab", e[e.Enter = 3] = "Enter", e[e.Shift = 4] = "Shift", e[e.Ctrl = 5] = "Ctrl", e[e.Alt = 6] = "Alt", e[e.PauseBreak = 7] = "PauseBreak", e[e.CapsLock = 8] = "CapsLock", e[e.Escape = 9] = "Escape", e[e.Space = 10] = "Space", e[e.PageUp = 11] = "PageUp", e[e.PageDown = 12] = "PageDown", e[e.End = 13] = "End", e[e.Home = 14] = "Home", e[e.LeftArrow = 15] = "LeftArrow", e[e.UpArrow = 16] = "UpArrow", e[e.RightArrow = 17] = "RightArrow", e[e.DownArrow = 18] = "DownArrow", e[e.Insert = 19] = "Insert", e[e.Delete = 20] = "Delete", e[e.Digit0 = 21] = "Digit0", e[e.Digit1 = 22] = "Digit1", e[e.Digit2 = 23] = "Digit2", e[e.Digit3 = 24] = "Digit3", e[e.Digit4 = 25] = "Digit4", e[e.Digit5 = 26] = "Digit5", e[e.Digit6 = 27] = "Digit6", e[e.Digit7 = 28] = "Digit7", e[e.Digit8 = 29] = "Digit8", e[e.Digit9 = 30] = "Digit9", e[e.KeyA = 31] = "KeyA", e[e.KeyB = 32] = "KeyB", e[e.KeyC = 33] = "KeyC", e[e.KeyD = 34] = "KeyD", e[e.KeyE = 35] = "KeyE", e[e.KeyF = 36] = "KeyF", e[e.KeyG = 37] = "KeyG", e[e.KeyH = 38] = "KeyH", e[e.KeyI = 39] = "KeyI", e[e.KeyJ = 40] = "KeyJ", e[e.KeyK = 41] = "KeyK", e[e.KeyL = 42] = "KeyL", e[e.KeyM = 43] = "KeyM", e[e.KeyN = 44] = "KeyN", e[e.KeyO = 45] = "KeyO", e[e.KeyP = 46] = "KeyP", e[e.KeyQ = 47] = "KeyQ", e[e.KeyR = 48] = "KeyR", e[e.KeyS = 49] = "KeyS", e[e.KeyT = 50] = "KeyT", e[e.KeyU = 51] = "KeyU", e[e.KeyV = 52] = "KeyV", e[e.KeyW = 53] = "KeyW", e[e.KeyX = 54] = "KeyX", e[e.KeyY = 55] = "KeyY", e[e.KeyZ = 56] = "KeyZ", e[e.Meta = 57] = "Meta", e[e.ContextMenu = 58] = "ContextMenu", e[e.F1 = 59] = "F1", e[e.F2 = 60] = "F2", e[e.F3 = 61] = "F3", e[e.F4 = 62] = "F4", e[e.F5 = 63] = "F5", e[e.F6 = 64] = "F6", e[e.F7 = 65] = "F7", e[e.F8 = 66] = "F8", e[e.F9 = 67] = "F9", e[e.F10 = 68] = "F10", e[e.F11 = 69] = "F11", e[e.F12 = 70] = "F12", e[e.F13 = 71] = "F13", e[e.F14 = 72] = "F14", e[e.F15 = 73] = "F15", e[e.F16 = 74] = "F16", e[e.F17 = 75] = "F17", e[e.F18 = 76] = "F18", e[e.F19 = 77] = "F19", e[e.F20 = 78] = "F20", e[e.F21 = 79] = "F21", e[e.F22 = 80] = "F22", e[e.F23 = 81] = "F23", e[e.F24 = 82] = "F24", e[e.NumLock = 83] = "NumLock", e[e.ScrollLock = 84] = "ScrollLock", e[e.Semicolon = 85] = "Semicolon", e[e.Equal = 86] = "Equal", e[e.Comma = 87] = "Comma", e[e.Minus = 88] = "Minus", e[e.Period = 89] = "Period", e[e.Slash = 90] = "Slash", e[e.Backquote = 91] = "Backquote", e[e.BracketLeft = 92] = "BracketLeft", e[e.Backslash = 93] = "Backslash", e[e.BracketRight = 94] = "BracketRight", e[e.Quote = 95] = "Quote", e[e.OEM_8 = 96] = "OEM_8", e[e.IntlBackslash = 97] = "IntlBackslash", e[e.Numpad0 = 98] = "Numpad0", e[e.Numpad1 = 99] = "Numpad1", e[e.Numpad2 = 100] = "Numpad2", e[e.Numpad3 = 101] = "Numpad3", e[e.Numpad4 = 102] = "Numpad4", e[e.Numpad5 = 103] = "Numpad5", e[e.Numpad6 = 104] = "Numpad6", e[e.Numpad7 = 105] = "Numpad7", e[e.Numpad8 = 106] = "Numpad8", e[e.Numpad9 = 107] = "Numpad9", e[e.NumpadMultiply = 108] = "NumpadMultiply", e[e.NumpadAdd = 109] = "NumpadAdd", e[e.NUMPAD_SEPARATOR = 110] = "NUMPAD_SEPARATOR", e[e.NumpadSubtract = 111] = "NumpadSubtract", e[e.NumpadDecimal = 112] = "NumpadDecimal", e[e.NumpadDivide = 113] = "NumpadDivide", e[e.KEY_IN_COMPOSITION = 114] = "KEY_IN_COMPOSITION", e[e.ABNT_C1 = 115] = "ABNT_C1", e[e.ABNT_C2 = 116] = "ABNT_C2", e[e.AudioVolumeMute = 117] = "AudioVolumeMute", e[e.AudioVolumeUp = 118] = "AudioVolumeUp", e[e.AudioVolumeDown = 119] = "AudioVolumeDown", e[e.BrowserSearch = 120] = "BrowserSearch", e[e.BrowserHome = 121] = "BrowserHome", e[e.BrowserBack = 122] = "BrowserBack", e[e.BrowserForward = 123] = "BrowserForward", e[e.MediaTrackNext = 124] = "MediaTrackNext", e[e.MediaTrackPrevious = 125] = "MediaTrackPrevious", e[e.MediaStop = 126] = "MediaStop", e[e.MediaPlayPause = 127] = "MediaPlayPause", e[e.LaunchMediaPlayer = 128] = "LaunchMediaPlayer", e[e.LaunchMail = 129] = "LaunchMail", e[e.LaunchApp2 = 130] = "LaunchApp2", e[e.Clear = 131] = "Clear", e[e.MAX_VALUE = 132] = "MAX_VALUE";
})(f1 || (f1 = {}));
var d1;
(function(e) {
  e[e.Hint = 1] = "Hint", e[e.Info = 2] = "Info", e[e.Warning = 4] = "Warning", e[e.Error = 8] = "Error";
})(d1 || (d1 = {}));
var m1;
(function(e) {
  e[e.Unnecessary = 1] = "Unnecessary", e[e.Deprecated = 2] = "Deprecated";
})(m1 || (m1 = {}));
var Mn;
(function(e) {
  e[e.Inline = 1] = "Inline", e[e.Gutter = 2] = "Gutter";
})(Mn || (Mn = {}));
var kn;
(function(e) {
  e[e.Normal = 1] = "Normal", e[e.Underlined = 2] = "Underlined";
})(kn || (kn = {}));
var Fn;
(function(e) {
  e[e.UNKNOWN = 0] = "UNKNOWN", e[e.TEXTAREA = 1] = "TEXTAREA", e[e.GUTTER_GLYPH_MARGIN = 2] = "GUTTER_GLYPH_MARGIN", e[e.GUTTER_LINE_NUMBERS = 3] = "GUTTER_LINE_NUMBERS", e[e.GUTTER_LINE_DECORATIONS = 4] = "GUTTER_LINE_DECORATIONS", e[e.GUTTER_VIEW_ZONE = 5] = "GUTTER_VIEW_ZONE", e[e.CONTENT_TEXT = 6] = "CONTENT_TEXT", e[e.CONTENT_EMPTY = 7] = "CONTENT_EMPTY", e[e.CONTENT_VIEW_ZONE = 8] = "CONTENT_VIEW_ZONE", e[e.CONTENT_WIDGET = 9] = "CONTENT_WIDGET", e[e.OVERVIEW_RULER = 10] = "OVERVIEW_RULER", e[e.SCROLLBAR = 11] = "SCROLLBAR", e[e.OVERLAY_WIDGET = 12] = "OVERLAY_WIDGET", e[e.OUTSIDE_EDITOR = 13] = "OUTSIDE_EDITOR";
})(Fn || (Fn = {}));
var Pn;
(function(e) {
  e[e.AIGenerated = 1] = "AIGenerated";
})(Pn || (Pn = {}));
var Dn;
(function(e) {
  e[e.Invoke = 0] = "Invoke", e[e.Automatic = 1] = "Automatic";
})(Dn || (Dn = {}));
var Tn;
(function(e) {
  e[e.TOP_RIGHT_CORNER = 0] = "TOP_RIGHT_CORNER", e[e.BOTTOM_RIGHT_CORNER = 1] = "BOTTOM_RIGHT_CORNER", e[e.TOP_CENTER = 2] = "TOP_CENTER";
})(Tn || (Tn = {}));
var In;
(function(e) {
  e[e.Left = 1] = "Left", e[e.Center = 2] = "Center", e[e.Right = 4] = "Right", e[e.Full = 7] = "Full";
})(In || (In = {}));
var Vn;
(function(e) {
  e[e.Word = 0] = "Word", e[e.Line = 1] = "Line", e[e.Suggest = 2] = "Suggest";
})(Vn || (Vn = {}));
var Bn;
(function(e) {
  e[e.Left = 0] = "Left", e[e.Right = 1] = "Right", e[e.None = 2] = "None", e[e.LeftOfInjectedText = 3] = "LeftOfInjectedText", e[e.RightOfInjectedText = 4] = "RightOfInjectedText";
})(Bn || (Bn = {}));
var qn;
(function(e) {
  e[e.Off = 0] = "Off", e[e.On = 1] = "On", e[e.Relative = 2] = "Relative", e[e.Interval = 3] = "Interval", e[e.Custom = 4] = "Custom";
})(qn || (qn = {}));
var Un;
(function(e) {
  e[e.None = 0] = "None", e[e.Text = 1] = "Text", e[e.Blocks = 2] = "Blocks";
})(Un || (Un = {}));
var Hn;
(function(e) {
  e[e.Smooth = 0] = "Smooth", e[e.Immediate = 1] = "Immediate";
})(Hn || (Hn = {}));
var $n;
(function(e) {
  e[e.Auto = 1] = "Auto", e[e.Hidden = 2] = "Hidden", e[e.Visible = 3] = "Visible";
})($n || ($n = {}));
var g1;
(function(e) {
  e[e.LTR = 0] = "LTR", e[e.RTL = 1] = "RTL";
})(g1 || (g1 = {}));
var Wn;
(function(e) {
  e.Off = "off", e.OnCode = "onCode", e.On = "on";
})(Wn || (Wn = {}));
var zn;
(function(e) {
  e[e.Invoke = 1] = "Invoke", e[e.TriggerCharacter = 2] = "TriggerCharacter", e[e.ContentChange = 3] = "ContentChange";
})(zn || (zn = {}));
var On;
(function(e) {
  e[e.File = 0] = "File", e[e.Module = 1] = "Module", e[e.Namespace = 2] = "Namespace", e[e.Package = 3] = "Package", e[e.Class = 4] = "Class", e[e.Method = 5] = "Method", e[e.Property = 6] = "Property", e[e.Field = 7] = "Field", e[e.Constructor = 8] = "Constructor", e[e.Enum = 9] = "Enum", e[e.Interface = 10] = "Interface", e[e.Function = 11] = "Function", e[e.Variable = 12] = "Variable", e[e.Constant = 13] = "Constant", e[e.String = 14] = "String", e[e.Number = 15] = "Number", e[e.Boolean = 16] = "Boolean", e[e.Array = 17] = "Array", e[e.Object = 18] = "Object", e[e.Key = 19] = "Key", e[e.Null = 20] = "Null", e[e.EnumMember = 21] = "EnumMember", e[e.Struct = 22] = "Struct", e[e.Event = 23] = "Event", e[e.Operator = 24] = "Operator", e[e.TypeParameter = 25] = "TypeParameter";
})(On || (On = {}));
var jn;
(function(e) {
  e[e.Deprecated = 1] = "Deprecated";
})(jn || (jn = {}));
var Gn;
(function(e) {
  e[e.Hidden = 0] = "Hidden", e[e.Blink = 1] = "Blink", e[e.Smooth = 2] = "Smooth", e[e.Phase = 3] = "Phase", e[e.Expand = 4] = "Expand", e[e.Solid = 5] = "Solid";
})(Gn || (Gn = {}));
var Xn;
(function(e) {
  e[e.Line = 1] = "Line", e[e.Block = 2] = "Block", e[e.Underline = 3] = "Underline", e[e.LineThin = 4] = "LineThin", e[e.BlockOutline = 5] = "BlockOutline", e[e.UnderlineThin = 6] = "UnderlineThin";
})(Xn || (Xn = {}));
var Qn;
(function(e) {
  e[e.AlwaysGrowsWhenTypingAtEdges = 0] = "AlwaysGrowsWhenTypingAtEdges", e[e.NeverGrowsWhenTypingAtEdges = 1] = "NeverGrowsWhenTypingAtEdges", e[e.GrowsOnlyWhenTypingBefore = 2] = "GrowsOnlyWhenTypingBefore", e[e.GrowsOnlyWhenTypingAfter = 3] = "GrowsOnlyWhenTypingAfter";
})(Qn || (Qn = {}));
var Yn;
(function(e) {
  e[e.None = 0] = "None", e[e.Same = 1] = "Same", e[e.Indent = 2] = "Indent", e[e.DeepIndent = 3] = "DeepIndent";
})(Yn || (Yn = {}));
const Oe = class Oe {
  static chord(t, n) {
    return Ri(t, n);
  }
};
Oe.CtrlCmd = 2048, Oe.Shift = 1024, Oe.Alt = 512, Oe.WinCtrl = 256;
let b1 = Oe;
function Pi() {
  return {
    editor: void 0,
    // undefined override expected here
    languages: void 0,
    // undefined override expected here
    CancellationTokenSource: Ni,
    Emitter: le,
    KeyCode: f1,
    KeyMod: b1,
    Position: $,
    Range: k,
    Selection: ie,
    SelectionDirection: g1,
    MarkerSeverity: d1,
    MarkerTag: m1,
    Uri: re,
    Token: Fi
  };
}
const ot = class ot {
  static getChannel(t) {
    return t.getChannel(ot.CHANNEL_NAME);
  }
  static setChannel(t, n) {
    t.setChannel(ot.CHANNEL_NAME, n);
  }
};
ot.CHANNEL_NAME = "editorWorkerHost";
let p1 = ot;
var Jn, Zn;
class Di {
  constructor(t, n) {
    this.uri = t, this.value = n;
  }
}
function Ti(e) {
  return Array.isArray(e);
}
const Fe = class Fe {
  constructor(t, n) {
    if (this[Jn] = "ResourceMap", t instanceof Fe)
      this.map = new Map(t.map), this.toKey = n ?? Fe.defaultToKey;
    else if (Ti(t)) {
      this.map = /* @__PURE__ */ new Map(), this.toKey = n ?? Fe.defaultToKey;
      for (const [s, r] of t)
        this.set(s, r);
    } else
      this.map = /* @__PURE__ */ new Map(), this.toKey = t ?? Fe.defaultToKey;
  }
  set(t, n) {
    return this.map.set(this.toKey(t), new Di(t, n)), this;
  }
  get(t) {
    var n;
    return (n = this.map.get(this.toKey(t))) == null ? void 0 : n.value;
  }
  has(t) {
    return this.map.has(this.toKey(t));
  }
  get size() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  delete(t) {
    return this.map.delete(this.toKey(t));
  }
  forEach(t, n) {
    typeof n < "u" && (t = t.bind(n));
    for (const [s, r] of this.map)
      t(r.value, r.uri, this);
  }
  *values() {
    for (const t of this.map.values())
      yield t.value;
  }
  *keys() {
    for (const t of this.map.values())
      yield t.uri;
  }
  *entries() {
    for (const t of this.map.values())
      yield [t.uri, t.value];
  }
  *[(Jn = Symbol.toStringTag, Symbol.iterator)]() {
    for (const [, t] of this.map)
      yield [t.uri, t.value];
  }
};
Fe.defaultToKey = (t) => t.toString();
let Kn = Fe;
class Ii {
  constructor() {
    this[Zn] = "LinkedMap", this._map = /* @__PURE__ */ new Map(), this._head = void 0, this._tail = void 0, this._size = 0, this._state = 0;
  }
  clear() {
    this._map.clear(), this._head = void 0, this._tail = void 0, this._size = 0, this._state++;
  }
  isEmpty() {
    return !this._head && !this._tail;
  }
  get size() {
    return this._size;
  }
  get first() {
    var t;
    return (t = this._head) == null ? void 0 : t.value;
  }
  get last() {
    var t;
    return (t = this._tail) == null ? void 0 : t.value;
  }
  has(t) {
    return this._map.has(t);
  }
  get(t, n = 0) {
    const s = this._map.get(t);
    if (s)
      return n !== 0 && this.touch(s, n), s.value;
  }
  set(t, n, s = 0) {
    let r = this._map.get(t);
    if (r)
      r.value = n, s !== 0 && this.touch(r, s);
    else {
      switch (r = { key: t, value: n, next: void 0, previous: void 0 }, s) {
        case 0:
          this.addItemLast(r);
          break;
        case 1:
          this.addItemFirst(r);
          break;
        case 2:
          this.addItemLast(r);
          break;
        default:
          this.addItemLast(r);
          break;
      }
      this._map.set(t, r), this._size++;
    }
    return this;
  }
  delete(t) {
    return !!this.remove(t);
  }
  remove(t) {
    const n = this._map.get(t);
    if (n)
      return this._map.delete(t), this.removeItem(n), this._size--, n.value;
  }
  shift() {
    if (!this._head && !this._tail)
      return;
    if (!this._head || !this._tail)
      throw new Error("Invalid list");
    const t = this._head;
    return this._map.delete(t.key), this.removeItem(t), this._size--, t.value;
  }
  forEach(t, n) {
    const s = this._state;
    let r = this._head;
    for (; r; ) {
      if (n ? t.bind(n)(r.value, r.key, this) : t(r.value, r.key, this), this._state !== s)
        throw new Error("LinkedMap got modified during iteration.");
      r = r.next;
    }
  }
  keys() {
    const t = this, n = this._state;
    let s = this._head;
    const r = {
      [Symbol.iterator]() {
        return r;
      },
      next() {
        if (t._state !== n)
          throw new Error("LinkedMap got modified during iteration.");
        if (s) {
          const i = { value: s.key, done: !1 };
          return s = s.next, i;
        } else
          return { value: void 0, done: !0 };
      }
    };
    return r;
  }
  values() {
    const t = this, n = this._state;
    let s = this._head;
    const r = {
      [Symbol.iterator]() {
        return r;
      },
      next() {
        if (t._state !== n)
          throw new Error("LinkedMap got modified during iteration.");
        if (s) {
          const i = { value: s.value, done: !1 };
          return s = s.next, i;
        } else
          return { value: void 0, done: !0 };
      }
    };
    return r;
  }
  entries() {
    const t = this, n = this._state;
    let s = this._head;
    const r = {
      [Symbol.iterator]() {
        return r;
      },
      next() {
        if (t._state !== n)
          throw new Error("LinkedMap got modified during iteration.");
        if (s) {
          const i = { value: [s.key, s.value], done: !1 };
          return s = s.next, i;
        } else
          return { value: void 0, done: !0 };
      }
    };
    return r;
  }
  [(Zn = Symbol.toStringTag, Symbol.iterator)]() {
    return this.entries();
  }
  trimOld(t) {
    if (t >= this.size)
      return;
    if (t === 0) {
      this.clear();
      return;
    }
    let n = this._head, s = this.size;
    for (; n && s > t; )
      this._map.delete(n.key), n = n.next, s--;
    this._head = n, this._size = s, n && (n.previous = void 0), this._state++;
  }
  trimNew(t) {
    if (t >= this.size)
      return;
    if (t === 0) {
      this.clear();
      return;
    }
    let n = this._tail, s = this.size;
    for (; n && s > t; )
      this._map.delete(n.key), n = n.previous, s--;
    this._tail = n, this._size = s, n && (n.next = void 0), this._state++;
  }
  addItemFirst(t) {
    if (!this._head && !this._tail)
      this._tail = t;
    else if (this._head)
      t.next = this._head, this._head.previous = t;
    else
      throw new Error("Invalid list");
    this._head = t, this._state++;
  }
  addItemLast(t) {
    if (!this._head && !this._tail)
      this._head = t;
    else if (this._tail)
      t.previous = this._tail, this._tail.next = t;
    else
      throw new Error("Invalid list");
    this._tail = t, this._state++;
  }
  removeItem(t) {
    if (t === this._head && t === this._tail)
      this._head = void 0, this._tail = void 0;
    else if (t === this._head) {
      if (!t.next)
        throw new Error("Invalid list");
      t.next.previous = void 0, this._head = t.next;
    } else if (t === this._tail) {
      if (!t.previous)
        throw new Error("Invalid list");
      t.previous.next = void 0, this._tail = t.previous;
    } else {
      const n = t.next, s = t.previous;
      if (!n || !s)
        throw new Error("Invalid list");
      n.previous = s, s.next = n;
    }
    t.next = void 0, t.previous = void 0, this._state++;
  }
  touch(t, n) {
    if (!this._head || !this._tail)
      throw new Error("Invalid list");
    if (!(n !== 1 && n !== 2)) {
      if (n === 1) {
        if (t === this._head)
          return;
        const s = t.next, r = t.previous;
        t === this._tail ? (r.next = void 0, this._tail = r) : (s.previous = r, r.next = s), t.previous = void 0, t.next = this._head, this._head.previous = t, this._head = t, this._state++;
      } else if (n === 2) {
        if (t === this._tail)
          return;
        const s = t.next, r = t.previous;
        t === this._head ? (s.previous = void 0, this._head = s) : (s.previous = r, r.next = s), t.next = void 0, t.previous = this._tail, this._tail.next = t, this._tail = t, this._state++;
      }
    }
  }
  toJSON() {
    const t = [];
    return this.forEach((n, s) => {
      t.push([s, n]);
    }), t;
  }
  fromJSON(t) {
    this.clear();
    for (const [n, s] of t)
      this.set(n, s);
  }
}
class Vi extends Ii {
  constructor(t, n = 1) {
    super(), this._limit = t, this._ratio = Math.min(Math.max(0, n), 1);
  }
  get limit() {
    return this._limit;
  }
  set limit(t) {
    this._limit = t, this.checkTrim();
  }
  get(t, n = 2) {
    return super.get(t, n);
  }
  peek(t) {
    return super.get(
      t,
      0
      /* Touch.None */
    );
  }
  set(t, n) {
    return super.set(
      t,
      n,
      2
      /* Touch.AsNew */
    ), this;
  }
  checkTrim() {
    this.size > this._limit && this.trim(Math.round(this._limit * this._ratio));
  }
}
class Bi extends Vi {
  constructor(t, n = 1) {
    super(t, n);
  }
  trim(t) {
    this.trimOld(t);
  }
  set(t, n) {
    return super.set(t, n), this.checkTrim(), this;
  }
}
class qi {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(t, n) {
    let s = this.map.get(t);
    s || (s = /* @__PURE__ */ new Set(), this.map.set(t, s)), s.add(n);
  }
  delete(t, n) {
    const s = this.map.get(t);
    s && (s.delete(n), s.size === 0 && this.map.delete(t));
  }
  forEach(t, n) {
    const s = this.map.get(t);
    s && s.forEach(n);
  }
  get(t) {
    const n = this.map.get(t);
    return n || /* @__PURE__ */ new Set();
  }
}
new Bi(10);
function Ui(e) {
  let t = [];
  for (; Object.prototype !== e; )
    t = t.concat(Object.getOwnPropertyNames(e)), e = Object.getPrototypeOf(e);
  return t;
}
function es(e) {
  const t = [];
  for (const n of Ui(e))
    typeof e[n] == "function" && t.push(n);
  return t;
}
function Hi(e, t) {
  const n = (r) => function() {
    const i = Array.prototype.slice.call(arguments, 0);
    return t(r, i);
  }, s = {};
  for (const r of e)
    s[r] = n(r);
  return s;
}
var ts;
(function(e) {
  e[e.Left = 1] = "Left", e[e.Center = 2] = "Center", e[e.Right = 4] = "Right", e[e.Full = 7] = "Full";
})(ts || (ts = {}));
var ns;
(function(e) {
  e[e.Left = 1] = "Left", e[e.Center = 2] = "Center", e[e.Right = 3] = "Right";
})(ns || (ns = {}));
var ss;
(function(e) {
  e[e.Both = 0] = "Both", e[e.Right = 1] = "Right", e[e.Left = 2] = "Left", e[e.None = 3] = "None";
})(ss || (ss = {}));
function $i(e, t, n, s, r) {
  if (s === 0)
    return !0;
  const i = t.charCodeAt(s - 1);
  if (e.get(i) !== 0 || i === 13 || i === 10)
    return !0;
  if (r > 0) {
    const o = t.charCodeAt(s);
    if (e.get(o) !== 0)
      return !0;
  }
  return !1;
}
function Wi(e, t, n, s, r) {
  if (s + r === n)
    return !0;
  const i = t.charCodeAt(s + r);
  if (e.get(i) !== 0 || i === 13 || i === 10)
    return !0;
  if (r > 0) {
    const o = t.charCodeAt(s + r - 1);
    if (e.get(o) !== 0)
      return !0;
  }
  return !1;
}
function zi(e, t, n, s, r) {
  return $i(e, t, n, s, r) && Wi(e, t, n, s, r);
}
class Oi {
  constructor(t, n) {
    this._wordSeparators = t, this._searchRegex = n, this._prevMatchStartIndex = -1, this._prevMatchLength = 0;
  }
  reset(t) {
    this._searchRegex.lastIndex = t, this._prevMatchStartIndex = -1, this._prevMatchLength = 0;
  }
  next(t) {
    const n = t.length;
    let s;
    do {
      if (this._prevMatchStartIndex + this._prevMatchLength === n || (s = this._searchRegex.exec(t), !s))
        return null;
      const r = s.index, i = s[0].length;
      if (r === this._prevMatchStartIndex && i === this._prevMatchLength) {
        if (i === 0) {
          Tr(t, n, this._searchRegex.lastIndex) > 65535 ? this._searchRegex.lastIndex += 2 : this._searchRegex.lastIndex += 1;
          continue;
        }
        return null;
      }
      if (this._prevMatchStartIndex = r, this._prevMatchLength = i, !this._wordSeparators || zi(this._wordSeparators, t, n, r, i))
        return s;
    } while (s);
    return null;
  }
}
function ji(e, t = "Unreachable") {
  throw new Error(t);
}
function Ft(e) {
  if (!e()) {
    debugger;
    e(), st(new ae("Assertion Failed"));
  }
}
function js(e, t) {
  let n = 0;
  for (; n < e.length - 1; ) {
    const s = e[n], r = e[n + 1];
    if (!t(s, r))
      return !1;
    n++;
  }
  return !0;
}
const Gi = "`~!@#$%^&*()-=+[{]}\\|;:'\",.<>/?";
function Xi(e = "") {
  let t = "(-?\\d*\\.\\d\\w*)|([^";
  for (const n of Gi)
    e.indexOf(n) >= 0 || (t += "\\" + n);
  return t += "\\s]+)", new RegExp(t, "g");
}
const Gs = Xi();
function Xs(e) {
  let t = Gs;
  if (e && e instanceof RegExp)
    if (e.global)
      t = e;
    else {
      let n = "g";
      e.ignoreCase && (n += "i"), e.multiline && (n += "m"), e.unicode && (n += "u"), t = new RegExp(e.source, n);
    }
  return t.lastIndex = 0, t;
}
const Qs = new ur();
Qs.unshift({
  maxLen: 1e3,
  windowSize: 15,
  timeBudget: 150
});
function E1(e, t, n, s, r) {
  if (t = Xs(t), r || (r = St.first(Qs)), n.length > r.maxLen) {
    let c = e - r.maxLen / 2;
    return c < 0 ? c = 0 : s += c, n = n.substring(c, e + r.maxLen / 2), E1(e, t, n, s, r);
  }
  const i = Date.now(), o = e - 1 - s;
  let l = -1, u = null;
  for (let c = 1; !(Date.now() - i >= r.timeBudget); c++) {
    const f = o - r.windowSize * c;
    t.lastIndex = Math.max(0, f);
    const h = Qi(t, n, o, l);
    if (!h && u || (u = h, f <= 0))
      break;
    l = f;
  }
  if (u) {
    const c = {
      word: u[0],
      startColumn: s + 1 + u.index,
      endColumn: s + 1 + u.index + u[0].length
    };
    return t.lastIndex = 0, c;
  }
  return null;
}
function Qi(e, t, n, s) {
  let r;
  for (; r = e.exec(t); ) {
    const i = r.index || 0;
    if (i <= n && e.lastIndex >= n)
      return r;
    if (s > 0 && i > s)
      return null;
  }
  return null;
}
class Yi {
  static computeUnicodeHighlights(t, n, s) {
    const r = s ? s.startLineNumber : 1, i = s ? s.endLineNumber : t.getLineCount(), o = new rs(n), l = o.getCandidateCodePoints();
    let u;
    l === "allNonBasicAscii" ? u = new RegExp("[^\\t\\n\\r\\x20-\\x7E]", "g") : u = new RegExp(`${Ji(Array.from(l))}`, "g");
    const c = new Oi(null, u), f = [];
    let h = !1, d, m = 0, g = 0, b = 0;
    e:
      for (let _ = r, v = i; _ <= v; _++) {
        const S = t.getLineContent(_), N = S.length;
        c.reset(0);
        do
          if (d = c.next(S), d) {
            let x = d.index, p = d.index + d[0].length;
            if (x > 0) {
              const B = S.charCodeAt(x - 1);
              Rt(B) && x--;
            }
            if (p + 1 < N) {
              const B = S.charCodeAt(p - 1);
              Rt(B) && p++;
            }
            const L = S.substring(x, p);
            let A = E1(x + 1, Gs, S, 0);
            A && A.endColumn <= x + 1 && (A = null);
            const E = o.shouldHighlightNonBasicASCII(L, A ? A.word : null);
            if (E !== 0) {
              if (E === 3 ? m++ : E === 2 ? g++ : E === 1 ? b++ : ji(), f.length >= 1e3) {
                h = !0;
                break e;
              }
              f.push(new k(_, x + 1, _, p + 1));
            }
          }
        while (d);
      }
    return {
      ranges: f,
      hasMore: h,
      ambiguousCharacterCount: m,
      invisibleCharacterCount: g,
      nonBasicAsciiCharacterCount: b
    };
  }
  static computeUnicodeHighlightReason(t, n) {
    const s = new rs(n);
    switch (s.shouldHighlightNonBasicASCII(t, null)) {
      case 0:
        return null;
      case 2:
        return {
          kind: 1
          /* UnicodeHighlighterReasonKind.Invisible */
        };
      case 3: {
        const i = t.codePointAt(0), o = s.ambiguousCharacters.getPrimaryConfusable(i), l = ht.getLocales().filter((u) => !ht.getInstance(/* @__PURE__ */ new Set([...n.allowedLocales, u])).isAmbiguous(i));
        return { kind: 0, confusableWith: String.fromCodePoint(o), notAmbiguousInLocales: l };
      }
      case 1:
        return {
          kind: 2
          /* UnicodeHighlighterReasonKind.NonBasicAscii */
        };
    }
  }
}
function Ji(e, t) {
  return `[${kr(e.map((s) => String.fromCodePoint(s)).join(""))}]`;
}
class rs {
  constructor(t) {
    this.options = t, this.allowedCodePoints = new Set(t.allowedCodePoints), this.ambiguousCharacters = ht.getInstance(new Set(t.allowedLocales));
  }
  getCandidateCodePoints() {
    if (this.options.nonBasicASCII)
      return "allNonBasicAscii";
    const t = /* @__PURE__ */ new Set();
    if (this.options.invisibleCharacters)
      for (const n of rt.codePoints)
        is(String.fromCodePoint(n)) || t.add(n);
    if (this.options.ambiguousCharacters)
      for (const n of this.ambiguousCharacters.getConfusableCodePoints())
        t.add(n);
    for (const n of this.allowedCodePoints)
      t.delete(n);
    return t;
  }
  shouldHighlightNonBasicASCII(t, n) {
    const s = t.codePointAt(0);
    if (this.allowedCodePoints.has(s))
      return 0;
    if (this.options.nonBasicASCII)
      return 1;
    let r = !1, i = !1;
    if (n)
      for (const o of n) {
        const l = o.codePointAt(0), u = Vr(o);
        r = r || u, !u && !this.ambiguousCharacters.isAmbiguous(l) && !rt.isInvisibleCharacter(l) && (i = !0);
      }
    return (
      /* Don't allow mixing weird looking characters with ASCII */
      !r && /* Is there an obviously weird looking character? */
      i ? 0 : this.options.invisibleCharacters && !is(t) && rt.isInvisibleCharacter(s) ? 2 : this.options.ambiguousCharacters && this.ambiguousCharacters.isAmbiguous(s) ? 3 : 0
    );
  }
}
function is(e) {
  return e === " " || e === `
` || e === "	";
}
class wt {
  constructor(t, n, s) {
    this.changes = t, this.moves = n, this.hitTimeout = s;
  }
}
class Zi {
  constructor(t, n) {
    this.lineRangeMapping = t, this.changes = n;
  }
}
class V {
  static addRange(t, n) {
    let s = 0;
    for (; s < n.length && n[s].endExclusive < t.start; )
      s++;
    let r = s;
    for (; r < n.length && n[r].start <= t.endExclusive; )
      r++;
    if (s === r)
      n.splice(s, 0, t);
    else {
      const i = Math.min(t.start, n[s].start), o = Math.max(t.endExclusive, n[r - 1].endExclusive);
      n.splice(s, r - s, new V(i, o));
    }
  }
  static tryCreate(t, n) {
    if (!(t > n))
      return new V(t, n);
  }
  static ofLength(t) {
    return new V(0, t);
  }
  static ofStartAndLength(t, n) {
    return new V(t, t + n);
  }
  constructor(t, n) {
    if (this.start = t, this.endExclusive = n, t > n)
      throw new ae(`Invalid range: ${this.toString()}`);
  }
  get isEmpty() {
    return this.start === this.endExclusive;
  }
  delta(t) {
    return new V(this.start + t, this.endExclusive + t);
  }
  deltaStart(t) {
    return new V(this.start + t, this.endExclusive);
  }
  deltaEnd(t) {
    return new V(this.start, this.endExclusive + t);
  }
  get length() {
    return this.endExclusive - this.start;
  }
  toString() {
    return `[${this.start}, ${this.endExclusive})`;
  }
  contains(t) {
    return this.start <= t && t < this.endExclusive;
  }
  /**
   * for all numbers n: range1.contains(n) or range2.contains(n) => range1.join(range2).contains(n)
   * The joined range is the smallest range that contains both ranges.
   */
  join(t) {
    return new V(Math.min(this.start, t.start), Math.max(this.endExclusive, t.endExclusive));
  }
  /**
   * for all numbers n: range1.contains(n) and range2.contains(n) <=> range1.intersect(range2).contains(n)
   *
   * The resulting range is empty if the ranges do not intersect, but touch.
   * If the ranges don't even touch, the result is undefined.
   */
  intersect(t) {
    const n = Math.max(this.start, t.start), s = Math.min(this.endExclusive, t.endExclusive);
    if (n <= s)
      return new V(n, s);
  }
  intersects(t) {
    const n = Math.max(this.start, t.start), s = Math.min(this.endExclusive, t.endExclusive);
    return n < s;
  }
  isBefore(t) {
    return this.endExclusive <= t.start;
  }
  isAfter(t) {
    return this.start >= t.endExclusive;
  }
  slice(t) {
    return t.slice(this.start, this.endExclusive);
  }
  substring(t) {
    return t.substring(this.start, this.endExclusive);
  }
  /**
   * Returns the given value if it is contained in this instance, otherwise the closest value that is contained.
   * The range must not be empty.
   */
  clip(t) {
    if (this.isEmpty)
      throw new ae(`Invalid clipping range: ${this.toString()}`);
    return Math.max(this.start, Math.min(this.endExclusive - 1, t));
  }
  /**
   * Returns `r := value + k * length` such that `r` is contained in this range.
   * The range must not be empty.
   *
   * E.g. `[5, 10).clipCyclic(10) === 5`, `[5, 10).clipCyclic(11) === 6` and `[5, 10).clipCyclic(4) === 9`.
   */
  clipCyclic(t) {
    if (this.isEmpty)
      throw new ae(`Invalid clipping range: ${this.toString()}`);
    return t < this.start ? this.endExclusive - (this.start - t) % this.length : t >= this.endExclusive ? this.start + (t - this.start) % this.length : t;
  }
  forEach(t) {
    for (let n = this.start; n < this.endExclusive; n++)
      t(n);
  }
}
function Je(e, t) {
  const n = ft(e, t);
  return n === -1 ? void 0 : e[n];
}
function ft(e, t, n = 0, s = e.length) {
  let r = n, i = s;
  for (; r < i; ) {
    const o = Math.floor((r + i) / 2);
    t(e[o]) ? r = o + 1 : i = o;
  }
  return r - 1;
}
function Ki(e, t) {
  const n = x1(e, t);
  return n === e.length ? void 0 : e[n];
}
function x1(e, t, n = 0, s = e.length) {
  let r = n, i = s;
  for (; r < i; ) {
    const o = Math.floor((r + i) / 2);
    t(e[o]) ? i = o : r = o + 1;
  }
  return r;
}
const Ut = class Ut {
  constructor(t) {
    this._array = t, this._findLastMonotonousLastIdx = 0;
  }
  /**
   * The predicate must be monotonous, i.e. `arr.map(predicate)` must be like `[true, ..., true, false, ..., false]`!
   * For subsequent calls, current predicate must be weaker than (or equal to) the previous predicate, i.e. more entries must be `true`.
   */
  findLastMonotonous(t) {
    if (Ut.assertInvariants) {
      if (this._prevFindLastPredicate) {
        for (const s of this._array)
          if (this._prevFindLastPredicate(s) && !t(s))
            throw new Error("MonotonousArray: current predicate must be weaker than (or equal to) the previous predicate.");
      }
      this._prevFindLastPredicate = t;
    }
    const n = ft(this._array, t, this._findLastMonotonousLastIdx);
    return this._findLastMonotonousLastIdx = n + 1, n === -1 ? void 0 : this._array[n];
  }
};
Ut.assertInvariants = !1;
let Pt = Ut;
class D {
  static fromRangeInclusive(t) {
    return new D(t.startLineNumber, t.endLineNumber + 1);
  }
  /**
   * @param lineRanges An array of sorted line ranges.
   */
  static joinMany(t) {
    if (t.length === 0)
      return [];
    let n = new ge(t[0].slice());
    for (let s = 1; s < t.length; s++)
      n = n.getUnion(new ge(t[s].slice()));
    return n.ranges;
  }
  static join(t) {
    if (t.length === 0)
      throw new ae("lineRanges cannot be empty");
    let n = t[0].startLineNumber, s = t[0].endLineNumberExclusive;
    for (let r = 1; r < t.length; r++)
      n = Math.min(n, t[r].startLineNumber), s = Math.max(s, t[r].endLineNumberExclusive);
    return new D(n, s);
  }
  static ofLength(t, n) {
    return new D(t, t + n);
  }
  /**
   * @internal
   */
  static deserialize(t) {
    return new D(t[0], t[1]);
  }
  constructor(t, n) {
    if (t > n)
      throw new ae(`startLineNumber ${t} cannot be after endLineNumberExclusive ${n}`);
    this.startLineNumber = t, this.endLineNumberExclusive = n;
  }
  /**
   * Indicates if this line range contains the given line number.
   */
  contains(t) {
    return this.startLineNumber <= t && t < this.endLineNumberExclusive;
  }
  /**
   * Indicates if this line range is empty.
   */
  get isEmpty() {
    return this.startLineNumber === this.endLineNumberExclusive;
  }
  /**
   * Moves this line range by the given offset of line numbers.
   */
  delta(t) {
    return new D(this.startLineNumber + t, this.endLineNumberExclusive + t);
  }
  deltaLength(t) {
    return new D(this.startLineNumber, this.endLineNumberExclusive + t);
  }
  /**
   * The number of lines this line range spans.
   */
  get length() {
    return this.endLineNumberExclusive - this.startLineNumber;
  }
  /**
   * Creates a line range that combines this and the given line range.
   */
  join(t) {
    return new D(Math.min(this.startLineNumber, t.startLineNumber), Math.max(this.endLineNumberExclusive, t.endLineNumberExclusive));
  }
  toString() {
    return `[${this.startLineNumber},${this.endLineNumberExclusive})`;
  }
  /**
   * The resulting range is empty if the ranges do not intersect, but touch.
   * If the ranges don't even touch, the result is undefined.
   */
  intersect(t) {
    const n = Math.max(this.startLineNumber, t.startLineNumber), s = Math.min(this.endLineNumberExclusive, t.endLineNumberExclusive);
    if (n <= s)
      return new D(n, s);
  }
  intersectsStrict(t) {
    return this.startLineNumber < t.endLineNumberExclusive && t.startLineNumber < this.endLineNumberExclusive;
  }
  overlapOrTouch(t) {
    return this.startLineNumber <= t.endLineNumberExclusive && t.startLineNumber <= this.endLineNumberExclusive;
  }
  equals(t) {
    return this.startLineNumber === t.startLineNumber && this.endLineNumberExclusive === t.endLineNumberExclusive;
  }
  toInclusiveRange() {
    return this.isEmpty ? null : new k(this.startLineNumber, 1, this.endLineNumberExclusive - 1, Number.MAX_SAFE_INTEGER);
  }
  /**
   * @deprecated Using this function is discouraged because it might lead to bugs: The end position is not guaranteed to be a valid position!
  */
  toExclusiveRange() {
    return new k(this.startLineNumber, 1, this.endLineNumberExclusive, 1);
  }
  mapToLineArray(t) {
    const n = [];
    for (let s = this.startLineNumber; s < this.endLineNumberExclusive; s++)
      n.push(t(s));
    return n;
  }
  forEach(t) {
    for (let n = this.startLineNumber; n < this.endLineNumberExclusive; n++)
      t(n);
  }
  /**
   * @internal
   */
  serialize() {
    return [this.startLineNumber, this.endLineNumberExclusive];
  }
  includes(t) {
    return this.startLineNumber <= t && t < this.endLineNumberExclusive;
  }
  /**
   * Converts this 1-based line range to a 0-based offset range (subtracts 1!).
   * @internal
   */
  toOffsetRange() {
    return new V(this.startLineNumber - 1, this.endLineNumberExclusive - 1);
  }
}
class ge {
  constructor(t = []) {
    this._normalizedRanges = t;
  }
  get ranges() {
    return this._normalizedRanges;
  }
  addRange(t) {
    if (t.length === 0)
      return;
    const n = x1(this._normalizedRanges, (r) => r.endLineNumberExclusive >= t.startLineNumber), s = ft(this._normalizedRanges, (r) => r.startLineNumber <= t.endLineNumberExclusive) + 1;
    if (n === s)
      this._normalizedRanges.splice(n, 0, t);
    else if (n === s - 1) {
      const r = this._normalizedRanges[n];
      this._normalizedRanges[n] = r.join(t);
    } else {
      const r = this._normalizedRanges[n].join(this._normalizedRanges[s - 1]).join(t);
      this._normalizedRanges.splice(n, s - n, r);
    }
  }
  contains(t) {
    const n = Je(this._normalizedRanges, (s) => s.startLineNumber <= t);
    return !!n && n.endLineNumberExclusive > t;
  }
  intersects(t) {
    const n = Je(this._normalizedRanges, (s) => s.startLineNumber < t.endLineNumberExclusive);
    return !!n && n.endLineNumberExclusive > t.startLineNumber;
  }
  getUnion(t) {
    if (this._normalizedRanges.length === 0)
      return t;
    if (t._normalizedRanges.length === 0)
      return this;
    const n = [];
    let s = 0, r = 0, i = null;
    for (; s < this._normalizedRanges.length || r < t._normalizedRanges.length; ) {
      let o = null;
      if (s < this._normalizedRanges.length && r < t._normalizedRanges.length) {
        const l = this._normalizedRanges[s], u = t._normalizedRanges[r];
        l.startLineNumber < u.startLineNumber ? (o = l, s++) : (o = u, r++);
      } else
        s < this._normalizedRanges.length ? (o = this._normalizedRanges[s], s++) : (o = t._normalizedRanges[r], r++);
      i === null ? i = o : i.endLineNumberExclusive >= o.startLineNumber ? i = new D(i.startLineNumber, Math.max(i.endLineNumberExclusive, o.endLineNumberExclusive)) : (n.push(i), i = o);
    }
    return i !== null && n.push(i), new ge(n);
  }
  /**
   * Subtracts all ranges in this set from `range` and returns the result.
   */
  subtractFrom(t) {
    const n = x1(this._normalizedRanges, (o) => o.endLineNumberExclusive >= t.startLineNumber), s = ft(this._normalizedRanges, (o) => o.startLineNumber <= t.endLineNumberExclusive) + 1;
    if (n === s)
      return new ge([t]);
    const r = [];
    let i = t.startLineNumber;
    for (let o = n; o < s; o++) {
      const l = this._normalizedRanges[o];
      l.startLineNumber > i && r.push(new D(i, l.startLineNumber)), i = l.endLineNumberExclusive;
    }
    return i < t.endLineNumberExclusive && r.push(new D(i, t.endLineNumberExclusive)), new ge(r);
  }
  toString() {
    return this._normalizedRanges.map((t) => t.toString()).join(", ");
  }
  getIntersection(t) {
    const n = [];
    let s = 0, r = 0;
    for (; s < this._normalizedRanges.length && r < t._normalizedRanges.length; ) {
      const i = this._normalizedRanges[s], o = t._normalizedRanges[r], l = i.intersect(o);
      l && !l.isEmpty && n.push(l), i.endLineNumberExclusive < o.endLineNumberExclusive ? s++ : r++;
    }
    return new ge(n);
  }
  getWithDelta(t) {
    return new ge(this._normalizedRanges.map((n) => n.delta(t)));
  }
}
const Ce = class Ce {
  static betweenPositions(t, n) {
    return t.lineNumber === n.lineNumber ? new Ce(0, n.column - t.column) : new Ce(n.lineNumber - t.lineNumber, n.column - 1);
  }
  static ofRange(t) {
    return Ce.betweenPositions(t.getStartPosition(), t.getEndPosition());
  }
  static ofText(t) {
    let n = 0, s = 0;
    for (const r of t)
      r === `
` ? (n++, s = 0) : s++;
    return new Ce(n, s);
  }
  constructor(t, n) {
    this.lineCount = t, this.columnCount = n;
  }
  isGreaterThanOrEqualTo(t) {
    return this.lineCount !== t.lineCount ? this.lineCount > t.lineCount : this.columnCount >= t.columnCount;
  }
  createRange(t) {
    return this.lineCount === 0 ? new k(t.lineNumber, t.column, t.lineNumber, t.column + this.columnCount) : new k(t.lineNumber, t.column, t.lineNumber + this.lineCount, this.columnCount + 1);
  }
  addToPosition(t) {
    return this.lineCount === 0 ? new $(t.lineNumber, t.column + this.columnCount) : new $(t.lineNumber + this.lineCount, this.columnCount + 1);
  }
  toString() {
    return `${this.lineCount},${this.columnCount}`;
  }
};
Ce.zero = new Ce(0, 0);
let as = Ce;
class ea {
  constructor(t, n) {
    this.range = t, this.text = n;
  }
  toSingleEditOperation() {
    return {
      range: this.range,
      text: this.text
    };
  }
}
class ce {
  static inverse(t, n, s) {
    const r = [];
    let i = 1, o = 1;
    for (const u of t) {
      const c = new ce(new D(i, u.original.startLineNumber), new D(o, u.modified.startLineNumber));
      c.modified.isEmpty || r.push(c), i = u.original.endLineNumberExclusive, o = u.modified.endLineNumberExclusive;
    }
    const l = new ce(new D(i, n + 1), new D(o, s + 1));
    return l.modified.isEmpty || r.push(l), r;
  }
  static clip(t, n, s) {
    const r = [];
    for (const i of t) {
      const o = i.original.intersect(n), l = i.modified.intersect(s);
      o && !o.isEmpty && l && !l.isEmpty && r.push(new ce(o, l));
    }
    return r;
  }
  constructor(t, n) {
    this.original = t, this.modified = n;
  }
  toString() {
    return `{${this.original.toString()}->${this.modified.toString()}}`;
  }
  flip() {
    return new ce(this.modified, this.original);
  }
  join(t) {
    return new ce(this.original.join(t.original), this.modified.join(t.modified));
  }
  /**
   * This method assumes that the LineRangeMapping describes a valid diff!
   * I.e. if one range is empty, the other range cannot be the entire document.
   * It avoids various problems when the line range points to non-existing line-numbers.
  */
  toRangeMapping() {
    const t = this.original.toInclusiveRange(), n = this.modified.toInclusiveRange();
    if (t && n)
      return new de(t, n);
    if (this.original.startLineNumber === 1 || this.modified.startLineNumber === 1) {
      if (!(this.modified.startLineNumber === 1 && this.original.startLineNumber === 1))
        throw new ae("not a valid diff");
      return new de(new k(this.original.startLineNumber, 1, this.original.endLineNumberExclusive, 1), new k(this.modified.startLineNumber, 1, this.modified.endLineNumberExclusive, 1));
    } else
      return new de(new k(this.original.startLineNumber - 1, Number.MAX_SAFE_INTEGER, this.original.endLineNumberExclusive - 1, Number.MAX_SAFE_INTEGER), new k(this.modified.startLineNumber - 1, Number.MAX_SAFE_INTEGER, this.modified.endLineNumberExclusive - 1, Number.MAX_SAFE_INTEGER));
  }
  /**
   * This method assumes that the LineRangeMapping describes a valid diff!
   * I.e. if one range is empty, the other range cannot be the entire document.
   * It avoids various problems when the line range points to non-existing line-numbers.
  */
  toRangeMapping2(t, n) {
    if (os(this.original.endLineNumberExclusive, t) && os(this.modified.endLineNumberExclusive, n))
      return new de(new k(this.original.startLineNumber, 1, this.original.endLineNumberExclusive, 1), new k(this.modified.startLineNumber, 1, this.modified.endLineNumberExclusive, 1));
    if (!this.original.isEmpty && !this.modified.isEmpty)
      return new de(k.fromPositions(new $(this.original.startLineNumber, 1), qe(new $(this.original.endLineNumberExclusive - 1, Number.MAX_SAFE_INTEGER), t)), k.fromPositions(new $(this.modified.startLineNumber, 1), qe(new $(this.modified.endLineNumberExclusive - 1, Number.MAX_SAFE_INTEGER), n)));
    if (this.original.startLineNumber > 1 && this.modified.startLineNumber > 1)
      return new de(k.fromPositions(qe(new $(this.original.startLineNumber - 1, Number.MAX_SAFE_INTEGER), t), qe(new $(this.original.endLineNumberExclusive - 1, Number.MAX_SAFE_INTEGER), t)), k.fromPositions(qe(new $(this.modified.startLineNumber - 1, Number.MAX_SAFE_INTEGER), n), qe(new $(this.modified.endLineNumberExclusive - 1, Number.MAX_SAFE_INTEGER), n)));
    throw new ae();
  }
}
function qe(e, t) {
  if (e.lineNumber < 1)
    return new $(1, 1);
  if (e.lineNumber > t.length)
    return new $(t.length, t[t.length - 1].length + 1);
  const n = t[e.lineNumber - 1];
  return e.column > n.length + 1 ? new $(e.lineNumber, n.length + 1) : e;
}
function os(e, t) {
  return e >= 1 && e <= t.length;
}
class _e extends ce {
  static fromRangeMappings(t) {
    const n = D.join(t.map((r) => D.fromRangeInclusive(r.originalRange))), s = D.join(t.map((r) => D.fromRangeInclusive(r.modifiedRange)));
    return new _e(n, s, t);
  }
  constructor(t, n, s) {
    super(t, n), this.innerChanges = s;
  }
  flip() {
    var t;
    return new _e(this.modified, this.original, (t = this.innerChanges) == null ? void 0 : t.map((n) => n.flip()));
  }
  withInnerChangesFromLineRanges() {
    return new _e(this.original, this.modified, [this.toRangeMapping()]);
  }
}
class de {
  static assertSorted(t) {
    for (let n = 1; n < t.length; n++) {
      const s = t[n - 1], r = t[n];
      if (!(s.originalRange.getEndPosition().isBeforeOrEqual(r.originalRange.getStartPosition()) && s.modifiedRange.getEndPosition().isBeforeOrEqual(r.modifiedRange.getStartPosition())))
        throw new ae("Range mappings must be sorted");
    }
  }
  constructor(t, n) {
    this.originalRange = t, this.modifiedRange = n;
  }
  toString() {
    return `{${this.originalRange.toString()}->${this.modifiedRange.toString()}}`;
  }
  flip() {
    return new de(this.modifiedRange, this.originalRange);
  }
  /**
   * Creates a single text edit that describes the change from the original to the modified text.
  */
  toTextEdit(t) {
    const n = t.getValueOfRange(this.modifiedRange);
    return new ea(this.originalRange, n);
  }
}
const ta = 3;
class na {
  computeDiff(t, n, s) {
    var u;
    const i = new ia(t, n, {
      maxComputationTime: s.maxComputationTimeMs,
      shouldIgnoreTrimWhitespace: s.ignoreTrimWhitespace,
      shouldComputeCharChanges: !0,
      shouldMakePrettyDiff: !0,
      shouldPostProcessCharChanges: !0
    }).computeDiff(), o = [];
    let l = null;
    for (const c of i.changes) {
      let f;
      c.originalEndLineNumber === 0 ? f = new D(c.originalStartLineNumber + 1, c.originalStartLineNumber + 1) : f = new D(c.originalStartLineNumber, c.originalEndLineNumber + 1);
      let h;
      c.modifiedEndLineNumber === 0 ? h = new D(c.modifiedStartLineNumber + 1, c.modifiedStartLineNumber + 1) : h = new D(c.modifiedStartLineNumber, c.modifiedEndLineNumber + 1);
      let d = new _e(f, h, (u = c.charChanges) == null ? void 0 : u.map((m) => new de(new k(m.originalStartLineNumber, m.originalStartColumn, m.originalEndLineNumber, m.originalEndColumn), new k(m.modifiedStartLineNumber, m.modifiedStartColumn, m.modifiedEndLineNumber, m.modifiedEndColumn))));
      l && (l.modified.endLineNumberExclusive === d.modified.startLineNumber || l.original.endLineNumberExclusive === d.original.startLineNumber) && (d = new _e(l.original.join(d.original), l.modified.join(d.modified), l.innerChanges && d.innerChanges ? l.innerChanges.concat(d.innerChanges) : void 0), o.pop()), o.push(d), l = d;
    }
    return Ft(() => js(o, (c, f) => f.original.startLineNumber - c.original.endLineNumberExclusive === f.modified.startLineNumber - c.modified.endLineNumberExclusive && // There has to be an unchanged line in between (otherwise both diffs should have been joined)
    c.original.endLineNumberExclusive < f.original.startLineNumber && c.modified.endLineNumberExclusive < f.modified.startLineNumber)), new wt(o, [], i.quitEarly);
  }
}
function Ys(e, t, n, s) {
  return new Ae(e, t, n).ComputeDiff(s);
}
let ls = class {
  constructor(t) {
    const n = [], s = [];
    for (let r = 0, i = t.length; r < i; r++)
      n[r] = _1(t[r], 1), s[r] = w1(t[r], 1);
    this.lines = t, this._startColumns = n, this._endColumns = s;
  }
  getElements() {
    const t = [];
    for (let n = 0, s = this.lines.length; n < s; n++)
      t[n] = this.lines[n].substring(this._startColumns[n] - 1, this._endColumns[n] - 1);
    return t;
  }
  getStrictElement(t) {
    return this.lines[t];
  }
  getStartLineNumber(t) {
    return t + 1;
  }
  getEndLineNumber(t) {
    return t + 1;
  }
  createCharSequence(t, n, s) {
    const r = [], i = [], o = [];
    let l = 0;
    for (let u = n; u <= s; u++) {
      const c = this.lines[u], f = t ? this._startColumns[u] : 1, h = t ? this._endColumns[u] : c.length + 1;
      for (let d = f; d < h; d++)
        r[l] = c.charCodeAt(d - 1), i[l] = u + 1, o[l] = d, l++;
      !t && u < s && (r[l] = 10, i[l] = u + 1, o[l] = c.length + 1, l++);
    }
    return new sa(r, i, o);
  }
};
class sa {
  constructor(t, n, s) {
    this._charCodes = t, this._lineNumbers = n, this._columns = s;
  }
  toString() {
    return "[" + this._charCodes.map((t, n) => (t === 10 ? "\\n" : String.fromCharCode(t)) + `-(${this._lineNumbers[n]},${this._columns[n]})`).join(", ") + "]";
  }
  _assertIndex(t, n) {
    if (t < 0 || t >= n.length)
      throw new Error("Illegal index");
  }
  getElements() {
    return this._charCodes;
  }
  getStartLineNumber(t) {
    return t > 0 && t === this._lineNumbers.length ? this.getEndLineNumber(t - 1) : (this._assertIndex(t, this._lineNumbers), this._lineNumbers[t]);
  }
  getEndLineNumber(t) {
    return t === -1 ? this.getStartLineNumber(t + 1) : (this._assertIndex(t, this._lineNumbers), this._charCodes[t] === 10 ? this._lineNumbers[t] + 1 : this._lineNumbers[t]);
  }
  getStartColumn(t) {
    return t > 0 && t === this._columns.length ? this.getEndColumn(t - 1) : (this._assertIndex(t, this._columns), this._columns[t]);
  }
  getEndColumn(t) {
    return t === -1 ? this.getStartColumn(t + 1) : (this._assertIndex(t, this._columns), this._charCodes[t] === 10 ? 1 : this._columns[t] + 1);
  }
}
class Xe {
  constructor(t, n, s, r, i, o, l, u) {
    this.originalStartLineNumber = t, this.originalStartColumn = n, this.originalEndLineNumber = s, this.originalEndColumn = r, this.modifiedStartLineNumber = i, this.modifiedStartColumn = o, this.modifiedEndLineNumber = l, this.modifiedEndColumn = u;
  }
  static createFromDiffChange(t, n, s) {
    const r = n.getStartLineNumber(t.originalStart), i = n.getStartColumn(t.originalStart), o = n.getEndLineNumber(t.originalStart + t.originalLength - 1), l = n.getEndColumn(t.originalStart + t.originalLength - 1), u = s.getStartLineNumber(t.modifiedStart), c = s.getStartColumn(t.modifiedStart), f = s.getEndLineNumber(t.modifiedStart + t.modifiedLength - 1), h = s.getEndColumn(t.modifiedStart + t.modifiedLength - 1);
    return new Xe(r, i, o, l, u, c, f, h);
  }
}
function ra(e) {
  if (e.length <= 1)
    return e;
  const t = [e[0]];
  let n = t[0];
  for (let s = 1, r = e.length; s < r; s++) {
    const i = e[s], o = i.originalStart - (n.originalStart + n.originalLength), l = i.modifiedStart - (n.modifiedStart + n.modifiedLength);
    Math.min(o, l) < ta ? (n.originalLength = i.originalStart + i.originalLength - n.originalStart, n.modifiedLength = i.modifiedStart + i.modifiedLength - n.modifiedStart) : (t.push(i), n = i);
  }
  return t;
}
class it {
  constructor(t, n, s, r, i) {
    this.originalStartLineNumber = t, this.originalEndLineNumber = n, this.modifiedStartLineNumber = s, this.modifiedEndLineNumber = r, this.charChanges = i;
  }
  static createFromDiffResult(t, n, s, r, i, o, l) {
    let u, c, f, h, d;
    if (n.originalLength === 0 ? (u = s.getStartLineNumber(n.originalStart) - 1, c = 0) : (u = s.getStartLineNumber(n.originalStart), c = s.getEndLineNumber(n.originalStart + n.originalLength - 1)), n.modifiedLength === 0 ? (f = r.getStartLineNumber(n.modifiedStart) - 1, h = 0) : (f = r.getStartLineNumber(n.modifiedStart), h = r.getEndLineNumber(n.modifiedStart + n.modifiedLength - 1)), o && n.originalLength > 0 && n.originalLength < 20 && n.modifiedLength > 0 && n.modifiedLength < 20 && i()) {
      const m = s.createCharSequence(t, n.originalStart, n.originalStart + n.originalLength - 1), g = r.createCharSequence(t, n.modifiedStart, n.modifiedStart + n.modifiedLength - 1);
      if (m.getElements().length > 0 && g.getElements().length > 0) {
        let b = Ys(m, g, i, !0).changes;
        l && (b = ra(b)), d = [];
        for (let _ = 0, v = b.length; _ < v; _++)
          d.push(Xe.createFromDiffChange(b[_], m, g));
      }
    }
    return new it(u, c, f, h, d);
  }
}
class ia {
  constructor(t, n, s) {
    this.shouldComputeCharChanges = s.shouldComputeCharChanges, this.shouldPostProcessCharChanges = s.shouldPostProcessCharChanges, this.shouldIgnoreTrimWhitespace = s.shouldIgnoreTrimWhitespace, this.shouldMakePrettyDiff = s.shouldMakePrettyDiff, this.originalLines = t, this.modifiedLines = n, this.original = new ls(t), this.modified = new ls(n), this.continueLineDiff = us(s.maxComputationTime), this.continueCharDiff = us(s.maxComputationTime === 0 ? 0 : Math.min(s.maxComputationTime, 5e3));
  }
  computeDiff() {
    if (this.original.lines.length === 1 && this.original.lines[0].length === 0)
      return this.modified.lines.length === 1 && this.modified.lines[0].length === 0 ? {
        quitEarly: !1,
        changes: []
      } : {
        quitEarly: !1,
        changes: [{
          originalStartLineNumber: 1,
          originalEndLineNumber: 1,
          modifiedStartLineNumber: 1,
          modifiedEndLineNumber: this.modified.lines.length,
          charChanges: void 0
        }]
      };
    if (this.modified.lines.length === 1 && this.modified.lines[0].length === 0)
      return {
        quitEarly: !1,
        changes: [{
          originalStartLineNumber: 1,
          originalEndLineNumber: this.original.lines.length,
          modifiedStartLineNumber: 1,
          modifiedEndLineNumber: 1,
          charChanges: void 0
        }]
      };
    const t = Ys(this.original, this.modified, this.continueLineDiff, this.shouldMakePrettyDiff), n = t.changes, s = t.quitEarly;
    if (this.shouldIgnoreTrimWhitespace) {
      const l = [];
      for (let u = 0, c = n.length; u < c; u++)
        l.push(it.createFromDiffResult(this.shouldIgnoreTrimWhitespace, n[u], this.original, this.modified, this.continueCharDiff, this.shouldComputeCharChanges, this.shouldPostProcessCharChanges));
      return {
        quitEarly: s,
        changes: l
      };
    }
    const r = [];
    let i = 0, o = 0;
    for (let l = -1, u = n.length; l < u; l++) {
      const c = l + 1 < u ? n[l + 1] : null, f = c ? c.originalStart : this.originalLines.length, h = c ? c.modifiedStart : this.modifiedLines.length;
      for (; i < f && o < h; ) {
        const d = this.originalLines[i], m = this.modifiedLines[o];
        if (d !== m) {
          {
            let g = _1(d, 1), b = _1(m, 1);
            for (; g > 1 && b > 1; ) {
              const _ = d.charCodeAt(g - 2), v = m.charCodeAt(b - 2);
              if (_ !== v)
                break;
              g--, b--;
            }
            (g > 1 || b > 1) && this._pushTrimWhitespaceCharChange(r, i + 1, 1, g, o + 1, 1, b);
          }
          {
            let g = w1(d, 1), b = w1(m, 1);
            const _ = d.length + 1, v = m.length + 1;
            for (; g < _ && b < v; ) {
              const S = d.charCodeAt(g - 1), N = d.charCodeAt(b - 1);
              if (S !== N)
                break;
              g++, b++;
            }
            (g < _ || b < v) && this._pushTrimWhitespaceCharChange(r, i + 1, g, _, o + 1, b, v);
          }
        }
        i++, o++;
      }
      c && (r.push(it.createFromDiffResult(this.shouldIgnoreTrimWhitespace, c, this.original, this.modified, this.continueCharDiff, this.shouldComputeCharChanges, this.shouldPostProcessCharChanges)), i += c.originalLength, o += c.modifiedLength);
    }
    return {
      quitEarly: s,
      changes: r
    };
  }
  _pushTrimWhitespaceCharChange(t, n, s, r, i, o, l) {
    if (this._mergeTrimWhitespaceCharChange(t, n, s, r, i, o, l))
      return;
    let u;
    this.shouldComputeCharChanges && (u = [new Xe(n, s, n, r, i, o, i, l)]), t.push(new it(n, n, i, i, u));
  }
  _mergeTrimWhitespaceCharChange(t, n, s, r, i, o, l) {
    const u = t.length;
    if (u === 0)
      return !1;
    const c = t[u - 1];
    return c.originalEndLineNumber === 0 || c.modifiedEndLineNumber === 0 ? !1 : c.originalEndLineNumber === n && c.modifiedEndLineNumber === i ? (this.shouldComputeCharChanges && c.charChanges && c.charChanges.push(new Xe(n, s, n, r, i, o, i, l)), !0) : c.originalEndLineNumber + 1 === n && c.modifiedEndLineNumber + 1 === i ? (c.originalEndLineNumber = n, c.modifiedEndLineNumber = i, this.shouldComputeCharChanges && c.charChanges && c.charChanges.push(new Xe(n, s, n, r, i, o, i, l)), !0) : !1;
  }
}
function _1(e, t) {
  const n = Pr(e);
  return n === -1 ? t : n + 1;
}
function w1(e, t) {
  const n = Dr(e);
  return n === -1 ? t : n + 2;
}
function us(e) {
  if (e === 0)
    return () => !0;
  const t = Date.now();
  return () => Date.now() - t < e;
}
function aa(e, t, n = (s, r) => s === r) {
  if (e === t)
    return !0;
  if (!e || !t || e.length !== t.length)
    return !1;
  for (let s = 0, r = e.length; s < r; s++)
    if (!n(e[s], t[s]))
      return !1;
  return !0;
}
function* oa(e, t) {
  let n, s;
  for (const r of e)
    s !== void 0 && t(s, r) ? n.push(r) : (n && (yield n), n = [r]), s = r;
  n && (yield n);
}
function la(e, t) {
  for (let n = 0; n <= e.length; n++)
    t(n === 0 ? void 0 : e[n - 1], n === e.length ? void 0 : e[n]);
}
function ua(e, t) {
  for (let n = 0; n < e.length; n++)
    t(n === 0 ? void 0 : e[n - 1], e[n], n + 1 === e.length ? void 0 : e[n + 1]);
}
function ca(e, t) {
  for (const n of t)
    e.push(n);
}
var L1;
(function(e) {
  function t(i) {
    return i < 0;
  }
  e.isLessThan = t;
  function n(i) {
    return i <= 0;
  }
  e.isLessThanOrEqual = n;
  function s(i) {
    return i > 0;
  }
  e.isGreaterThan = s;
  function r(i) {
    return i === 0;
  }
  e.isNeitherLessOrGreaterThan = r, e.greaterThan = 1, e.lessThan = -1, e.neitherLessOrGreaterThan = 0;
})(L1 || (L1 = {}));
function Lt(e, t) {
  return (n, s) => t(e(n), e(s));
}
const vt = (e, t) => e - t;
function ha(e) {
  return (t, n) => -e(t, n);
}
const je = class je {
  constructor(t) {
    this.iterate = t;
  }
  toArray() {
    const t = [];
    return this.iterate((n) => (t.push(n), !0)), t;
  }
  filter(t) {
    return new je((n) => this.iterate((s) => t(s) ? n(s) : !0));
  }
  map(t) {
    return new je((n) => this.iterate((s) => n(t(s))));
  }
  findLast(t) {
    let n;
    return this.iterate((s) => (t(s) && (n = s), !0)), n;
  }
  findLastMaxBy(t) {
    let n, s = !0;
    return this.iterate((r) => ((s || L1.isGreaterThan(t(r, n))) && (s = !1, n = r), !0)), n;
  }
};
je.empty = new je((t) => {
});
let cs = je;
class we {
  static trivial(t, n) {
    return new we([new j(V.ofLength(t.length), V.ofLength(n.length))], !1);
  }
  static trivialTimedOut(t, n) {
    return new we([new j(V.ofLength(t.length), V.ofLength(n.length))], !0);
  }
  constructor(t, n) {
    this.diffs = t, this.hitTimeout = n;
  }
}
class j {
  static invert(t, n) {
    const s = [];
    return la(t, (r, i) => {
      s.push(j.fromOffsetPairs(r ? r.getEndExclusives() : pe.zero, i ? i.getStarts() : new pe(n, (r ? r.seq2Range.endExclusive - r.seq1Range.endExclusive : 0) + n)));
    }), s;
  }
  static fromOffsetPairs(t, n) {
    return new j(new V(t.offset1, n.offset1), new V(t.offset2, n.offset2));
  }
  static assertSorted(t) {
    let n;
    for (const s of t) {
      if (n && !(n.seq1Range.endExclusive <= s.seq1Range.start && n.seq2Range.endExclusive <= s.seq2Range.start))
        throw new ae("Sequence diffs must be sorted");
      n = s;
    }
  }
  constructor(t, n) {
    this.seq1Range = t, this.seq2Range = n;
  }
  swap() {
    return new j(this.seq2Range, this.seq1Range);
  }
  toString() {
    return `${this.seq1Range} <-> ${this.seq2Range}`;
  }
  join(t) {
    return new j(this.seq1Range.join(t.seq1Range), this.seq2Range.join(t.seq2Range));
  }
  delta(t) {
    return t === 0 ? this : new j(this.seq1Range.delta(t), this.seq2Range.delta(t));
  }
  deltaStart(t) {
    return t === 0 ? this : new j(this.seq1Range.deltaStart(t), this.seq2Range.deltaStart(t));
  }
  deltaEnd(t) {
    return t === 0 ? this : new j(this.seq1Range.deltaEnd(t), this.seq2Range.deltaEnd(t));
  }
  intersect(t) {
    const n = this.seq1Range.intersect(t.seq1Range), s = this.seq2Range.intersect(t.seq2Range);
    if (!(!n || !s))
      return new j(n, s);
  }
  getStarts() {
    return new pe(this.seq1Range.start, this.seq2Range.start);
  }
  getEndExclusives() {
    return new pe(this.seq1Range.endExclusive, this.seq2Range.endExclusive);
  }
}
const Pe = class Pe {
  constructor(t, n) {
    this.offset1 = t, this.offset2 = n;
  }
  toString() {
    return `${this.offset1} <-> ${this.offset2}`;
  }
  delta(t) {
    return t === 0 ? this : new Pe(this.offset1 + t, this.offset2 + t);
  }
  equals(t) {
    return this.offset1 === t.offset1 && this.offset2 === t.offset2;
  }
};
Pe.zero = new Pe(0, 0), Pe.max = new Pe(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
let pe = Pe;
const Ht = class Ht {
  isValid() {
    return !0;
  }
};
Ht.instance = new Ht();
let dt = Ht;
class fa {
  constructor(t) {
    if (this.timeout = t, this.startTime = Date.now(), this.valid = !0, t <= 0)
      throw new ae("timeout must be positive");
  }
  // Recommendation: Set a log-point `{this.disable()}` in the body
  isValid() {
    if (!(Date.now() - this.startTime < this.timeout) && this.valid) {
      this.valid = !1;
      debugger;
    }
    return this.valid;
  }
}
class Jt {
  constructor(t, n) {
    this.width = t, this.height = n, this.array = [], this.array = new Array(t * n);
  }
  get(t, n) {
    return this.array[t + n * this.width];
  }
  set(t, n, s) {
    this.array[t + n * this.width] = s;
  }
}
function v1(e) {
  return e === 32 || e === 9;
}
const lt = class lt {
  static getKey(t) {
    let n = this.chrKeys.get(t);
    return n === void 0 && (n = this.chrKeys.size, this.chrKeys.set(t, n)), n;
  }
  constructor(t, n, s) {
    this.range = t, this.lines = n, this.source = s, this.histogram = [];
    let r = 0;
    for (let i = t.startLineNumber - 1; i < t.endLineNumberExclusive - 1; i++) {
      const o = n[i];
      for (let u = 0; u < o.length; u++) {
        r++;
        const c = o[u], f = lt.getKey(c);
        this.histogram[f] = (this.histogram[f] || 0) + 1;
      }
      r++;
      const l = lt.getKey(`
`);
      this.histogram[l] = (this.histogram[l] || 0) + 1;
    }
    this.totalCount = r;
  }
  computeSimilarity(t) {
    let n = 0;
    const s = Math.max(this.histogram.length, t.histogram.length);
    for (let r = 0; r < s; r++)
      n += Math.abs((this.histogram[r] ?? 0) - (t.histogram[r] ?? 0));
    return 1 - n / (this.totalCount + t.totalCount);
  }
};
lt.chrKeys = /* @__PURE__ */ new Map();
let Dt = lt;
class da {
  compute(t, n, s = dt.instance, r) {
    if (t.length === 0 || n.length === 0)
      return we.trivial(t, n);
    const i = new Jt(t.length, n.length), o = new Jt(t.length, n.length), l = new Jt(t.length, n.length);
    for (let g = 0; g < t.length; g++)
      for (let b = 0; b < n.length; b++) {
        if (!s.isValid())
          return we.trivialTimedOut(t, n);
        const _ = g === 0 ? 0 : i.get(g - 1, b), v = b === 0 ? 0 : i.get(g, b - 1);
        let S;
        t.getElement(g) === n.getElement(b) ? (g === 0 || b === 0 ? S = 0 : S = i.get(g - 1, b - 1), g > 0 && b > 0 && o.get(g - 1, b - 1) === 3 && (S += l.get(g - 1, b - 1)), S += r ? r(g, b) : 1) : S = -1;
        const N = Math.max(_, v, S);
        if (N === S) {
          const x = g > 0 && b > 0 ? l.get(g - 1, b - 1) : 0;
          l.set(g, b, x + 1), o.set(g, b, 3);
        } else
          N === _ ? (l.set(g, b, 0), o.set(g, b, 1)) : N === v && (l.set(g, b, 0), o.set(g, b, 2));
        i.set(g, b, N);
      }
    const u = [];
    let c = t.length, f = n.length;
    function h(g, b) {
      (g + 1 !== c || b + 1 !== f) && u.push(new j(new V(g + 1, c), new V(b + 1, f))), c = g, f = b;
    }
    let d = t.length - 1, m = n.length - 1;
    for (; d >= 0 && m >= 0; )
      o.get(d, m) === 3 ? (h(d, m), d--, m--) : o.get(d, m) === 1 ? d-- : m--;
    return h(-1, -1), u.reverse(), new we(u, !1);
  }
}
class Js {
  compute(t, n, s = dt.instance) {
    if (t.length === 0 || n.length === 0)
      return we.trivial(t, n);
    const r = t, i = n;
    function o(b, _) {
      for (; b < r.length && _ < i.length && r.getElement(b) === i.getElement(_); )
        b++, _++;
      return b;
    }
    let l = 0;
    const u = new ma();
    u.set(0, o(0, 0));
    const c = new ga();
    c.set(0, u.get(0) === 0 ? null : new hs(null, 0, 0, u.get(0)));
    let f = 0;
    e:
      for (; ; ) {
        if (l++, !s.isValid())
          return we.trivialTimedOut(r, i);
        const b = -Math.min(l, i.length + l % 2), _ = Math.min(l, r.length + l % 2);
        for (f = b; f <= _; f += 2) {
          const v = f === _ ? -1 : u.get(f + 1), S = f === b ? -1 : u.get(f - 1) + 1, N = Math.min(Math.max(v, S), r.length), x = N - f;
          if (N > r.length || x > i.length)
            continue;
          const p = o(N, x);
          u.set(f, p);
          const L = N === v ? c.get(f + 1) : c.get(f - 1);
          if (c.set(f, p !== N ? new hs(L, N, x, p - N) : L), u.get(f) === r.length && u.get(f) - f === i.length)
            break e;
        }
      }
    let h = c.get(f);
    const d = [];
    let m = r.length, g = i.length;
    for (; ; ) {
      const b = h ? h.x + h.length : 0, _ = h ? h.y + h.length : 0;
      if ((b !== m || _ !== g) && d.push(new j(new V(b, m), new V(_, g))), !h)
        break;
      m = h.x, g = h.y, h = h.prev;
    }
    return d.reverse(), new we(d, !1);
  }
}
class hs {
  constructor(t, n, s, r) {
    this.prev = t, this.x = n, this.y = s, this.length = r;
  }
}
class ma {
  constructor() {
    this.positiveArr = new Int32Array(10), this.negativeArr = new Int32Array(10);
  }
  get(t) {
    return t < 0 ? (t = -t - 1, this.negativeArr[t]) : this.positiveArr[t];
  }
  set(t, n) {
    if (t < 0) {
      if (t = -t - 1, t >= this.negativeArr.length) {
        const s = this.negativeArr;
        this.negativeArr = new Int32Array(s.length * 2), this.negativeArr.set(s);
      }
      this.negativeArr[t] = n;
    } else {
      if (t >= this.positiveArr.length) {
        const s = this.positiveArr;
        this.positiveArr = new Int32Array(s.length * 2), this.positiveArr.set(s);
      }
      this.positiveArr[t] = n;
    }
  }
}
class ga {
  constructor() {
    this.positiveArr = [], this.negativeArr = [];
  }
  get(t) {
    return t < 0 ? (t = -t - 1, this.negativeArr[t]) : this.positiveArr[t];
  }
  set(t, n) {
    t < 0 ? (t = -t - 1, this.negativeArr[t] = n) : this.positiveArr[t] = n;
  }
}
class Tt {
  constructor(t, n, s) {
    this.lines = t, this.range = n, this.considerWhitespaceChanges = s, this.elements = [], this.firstElementOffsetByLineIdx = [], this.lineStartOffsets = [], this.trimmedWsLengthsByLineIdx = [], this.firstElementOffsetByLineIdx.push(0);
    for (let r = this.range.startLineNumber; r <= this.range.endLineNumber; r++) {
      let i = t[r - 1], o = 0;
      r === this.range.startLineNumber && this.range.startColumn > 1 && (o = this.range.startColumn - 1, i = i.substring(o)), this.lineStartOffsets.push(o);
      let l = 0;
      if (!s) {
        const c = i.trimStart();
        l = i.length - c.length, i = c.trimEnd();
      }
      this.trimmedWsLengthsByLineIdx.push(l);
      const u = r === this.range.endLineNumber ? Math.min(this.range.endColumn - 1 - o - l, i.length) : i.length;
      for (let c = 0; c < u; c++)
        this.elements.push(i.charCodeAt(c));
      r < this.range.endLineNumber && (this.elements.push(10), this.firstElementOffsetByLineIdx.push(this.elements.length));
    }
  }
  toString() {
    return `Slice: "${this.text}"`;
  }
  get text() {
    return this.getText(new V(0, this.length));
  }
  getText(t) {
    return this.elements.slice(t.start, t.endExclusive).map((n) => String.fromCharCode(n)).join("");
  }
  getElement(t) {
    return this.elements[t];
  }
  get length() {
    return this.elements.length;
  }
  getBoundaryScore(t) {
    const n = ds(t > 0 ? this.elements[t - 1] : -1), s = ds(t < this.elements.length ? this.elements[t] : -1);
    if (n === 7 && s === 8)
      return 0;
    if (n === 8)
      return 150;
    let r = 0;
    return n !== s && (r += 10, n === 0 && s === 1 && (r += 1)), r += fs(n), r += fs(s), r;
  }
  translateOffset(t, n = "right") {
    const s = ft(this.firstElementOffsetByLineIdx, (i) => i <= t), r = t - this.firstElementOffsetByLineIdx[s];
    return new $(this.range.startLineNumber + s, 1 + this.lineStartOffsets[s] + r + (r === 0 && n === "left" ? 0 : this.trimmedWsLengthsByLineIdx[s]));
  }
  translateRange(t) {
    const n = this.translateOffset(t.start, "right"), s = this.translateOffset(t.endExclusive, "left");
    return s.isBefore(n) ? k.fromPositions(s, s) : k.fromPositions(n, s);
  }
  /**
   * Finds the word that contains the character at the given offset
   */
  findWordContaining(t) {
    if (t < 0 || t >= this.elements.length || !Zt(this.elements[t]))
      return;
    let n = t;
    for (; n > 0 && Zt(this.elements[n - 1]); )
      n--;
    let s = t;
    for (; s < this.elements.length && Zt(this.elements[s]); )
      s++;
    return new V(n, s);
  }
  countLinesIn(t) {
    return this.translateOffset(t.endExclusive).lineNumber - this.translateOffset(t.start).lineNumber;
  }
  isStronglyEqual(t, n) {
    return this.elements[t] === this.elements[n];
  }
  extendToFullLines(t) {
    const n = Je(this.firstElementOffsetByLineIdx, (r) => r <= t.start) ?? 0, s = Ki(this.firstElementOffsetByLineIdx, (r) => t.endExclusive <= r) ?? this.elements.length;
    return new V(n, s);
  }
}
function Zt(e) {
  return e >= 97 && e <= 122 || e >= 65 && e <= 90 || e >= 48 && e <= 57;
}
const ba = {
  0: 0,
  1: 0,
  2: 0,
  3: 10,
  4: 2,
  5: 30,
  6: 3,
  7: 10,
  8: 10
};
function fs(e) {
  return ba[e];
}
function ds(e) {
  return e === 10 ? 8 : e === 13 ? 7 : v1(e) ? 6 : e >= 97 && e <= 122 ? 0 : e >= 65 && e <= 90 ? 1 : e >= 48 && e <= 57 ? 2 : e === -1 ? 3 : e === 44 || e === 59 ? 5 : 4;
}
function pa(e, t, n, s, r, i) {
  let { moves: o, excludedChanges: l } = _a(e, t, n, i);
  if (!i.isValid())
    return [];
  const u = e.filter((f) => !l.has(f)), c = wa(u, s, r, t, n, i);
  return ca(o, c), o = La(o), o = o.filter((f) => {
    const h = f.original.toOffsetRange().slice(t).map((m) => m.trim());
    return h.join(`
`).length >= 15 && xa(h, (m) => m.length >= 2) >= 2;
  }), o = va(e, o), o;
}
function xa(e, t) {
  let n = 0;
  for (const s of e)
    t(s) && n++;
  return n;
}
function _a(e, t, n, s) {
  const r = [], i = e.filter((u) => u.modified.isEmpty && u.original.length >= 3).map((u) => new Dt(u.original, t, u)), o = new Set(e.filter((u) => u.original.isEmpty && u.modified.length >= 3).map((u) => new Dt(u.modified, n, u))), l = /* @__PURE__ */ new Set();
  for (const u of i) {
    let c = -1, f;
    for (const h of o) {
      const d = u.computeSimilarity(h);
      d > c && (c = d, f = h);
    }
    if (c > 0.9 && f && (o.delete(f), r.push(new ce(u.range, f.range)), l.add(u.source), l.add(f.source)), !s.isValid())
      return { moves: r, excludedChanges: l };
  }
  return { moves: r, excludedChanges: l };
}
function wa(e, t, n, s, r, i) {
  const o = [], l = new qi();
  for (const d of e)
    for (let m = d.original.startLineNumber; m < d.original.endLineNumberExclusive - 2; m++) {
      const g = `${t[m - 1]}:${t[m + 1 - 1]}:${t[m + 2 - 1]}`;
      l.add(g, { range: new D(m, m + 3) });
    }
  const u = [];
  e.sort(Lt((d) => d.modified.startLineNumber, vt));
  for (const d of e) {
    let m = [];
    for (let g = d.modified.startLineNumber; g < d.modified.endLineNumberExclusive - 2; g++) {
      const b = `${n[g - 1]}:${n[g + 1 - 1]}:${n[g + 2 - 1]}`, _ = new D(g, g + 3), v = [];
      l.forEach(b, ({ range: S }) => {
        for (const x of m)
          if (x.originalLineRange.endLineNumberExclusive + 1 === S.endLineNumberExclusive && x.modifiedLineRange.endLineNumberExclusive + 1 === _.endLineNumberExclusive) {
            x.originalLineRange = new D(x.originalLineRange.startLineNumber, S.endLineNumberExclusive), x.modifiedLineRange = new D(x.modifiedLineRange.startLineNumber, _.endLineNumberExclusive), v.push(x);
            return;
          }
        const N = {
          modifiedLineRange: _,
          originalLineRange: S
        };
        u.push(N), v.push(N);
      }), m = v;
    }
    if (!i.isValid())
      return [];
  }
  u.sort(ha(Lt((d) => d.modifiedLineRange.length, vt)));
  const c = new ge(), f = new ge();
  for (const d of u) {
    const m = d.modifiedLineRange.startLineNumber - d.originalLineRange.startLineNumber, g = c.subtractFrom(d.modifiedLineRange), b = f.subtractFrom(d.originalLineRange).getWithDelta(m), _ = g.getIntersection(b);
    for (const v of _.ranges) {
      if (v.length < 3)
        continue;
      const S = v, N = v.delta(-m);
      o.push(new ce(N, S)), c.addRange(S), f.addRange(N);
    }
  }
  o.sort(Lt((d) => d.original.startLineNumber, vt));
  const h = new Pt(e);
  for (let d = 0; d < o.length; d++) {
    const m = o[d], g = h.findLastMonotonous((L) => L.original.startLineNumber <= m.original.startLineNumber), b = Je(e, (L) => L.modified.startLineNumber <= m.modified.startLineNumber), _ = Math.max(m.original.startLineNumber - g.original.startLineNumber, m.modified.startLineNumber - b.modified.startLineNumber), v = h.findLastMonotonous((L) => L.original.startLineNumber < m.original.endLineNumberExclusive), S = Je(e, (L) => L.modified.startLineNumber < m.modified.endLineNumberExclusive), N = Math.max(v.original.endLineNumberExclusive - m.original.endLineNumberExclusive, S.modified.endLineNumberExclusive - m.modified.endLineNumberExclusive);
    let x;
    for (x = 0; x < _; x++) {
      const L = m.original.startLineNumber - x - 1, A = m.modified.startLineNumber - x - 1;
      if (L > s.length || A > r.length || c.contains(A) || f.contains(L) || !ms(s[L - 1], r[A - 1], i))
        break;
    }
    x > 0 && (f.addRange(new D(m.original.startLineNumber - x, m.original.startLineNumber)), c.addRange(new D(m.modified.startLineNumber - x, m.modified.startLineNumber)));
    let p;
    for (p = 0; p < N; p++) {
      const L = m.original.endLineNumberExclusive + p, A = m.modified.endLineNumberExclusive + p;
      if (L > s.length || A > r.length || c.contains(A) || f.contains(L) || !ms(s[L - 1], r[A - 1], i))
        break;
    }
    p > 0 && (f.addRange(new D(m.original.endLineNumberExclusive, m.original.endLineNumberExclusive + p)), c.addRange(new D(m.modified.endLineNumberExclusive, m.modified.endLineNumberExclusive + p))), (x > 0 || p > 0) && (o[d] = new ce(new D(m.original.startLineNumber - x, m.original.endLineNumberExclusive + p), new D(m.modified.startLineNumber - x, m.modified.endLineNumberExclusive + p)));
  }
  return o;
}
function ms(e, t, n) {
  if (e.trim() === t.trim())
    return !0;
  if (e.length > 300 && t.length > 300)
    return !1;
  const r = new Js().compute(new Tt([e], new k(1, 1, 1, e.length), !1), new Tt([t], new k(1, 1, 1, t.length), !1), n);
  let i = 0;
  const o = j.invert(r.diffs, e.length);
  for (const f of o)
    f.seq1Range.forEach((h) => {
      v1(e.charCodeAt(h)) || i++;
    });
  function l(f) {
    let h = 0;
    for (let d = 0; d < e.length; d++)
      v1(f.charCodeAt(d)) || h++;
    return h;
  }
  const u = l(e.length > t.length ? e : t);
  return i / u > 0.6 && u > 10;
}
function La(e) {
  if (e.length === 0)
    return e;
  e.sort(Lt((n) => n.original.startLineNumber, vt));
  const t = [e[0]];
  for (let n = 1; n < e.length; n++) {
    const s = t[t.length - 1], r = e[n], i = r.original.startLineNumber - s.original.endLineNumberExclusive, o = r.modified.startLineNumber - s.modified.endLineNumberExclusive;
    if (i >= 0 && o >= 0 && i + o <= 2) {
      t[t.length - 1] = s.join(r);
      continue;
    }
    t.push(r);
  }
  return t;
}
function va(e, t) {
  const n = new Pt(e);
  return t = t.filter((s) => {
    const r = n.findLastMonotonous((l) => l.original.startLineNumber < s.original.endLineNumberExclusive) || new ce(new D(1, 1), new D(1, 1)), i = Je(e, (l) => l.modified.startLineNumber < s.modified.endLineNumberExclusive);
    return r !== i;
  }), t;
}
function gs(e, t, n) {
  let s = n;
  return s = bs(e, t, s), s = bs(e, t, s), s = Na(e, t, s), s;
}
function bs(e, t, n) {
  if (n.length === 0)
    return n;
  const s = [];
  s.push(n[0]);
  for (let i = 1; i < n.length; i++) {
    const o = s[s.length - 1];
    let l = n[i];
    if (l.seq1Range.isEmpty || l.seq2Range.isEmpty) {
      const u = l.seq1Range.start - o.seq1Range.endExclusive;
      let c;
      for (c = 1; c <= u && !(e.getElement(l.seq1Range.start - c) !== e.getElement(l.seq1Range.endExclusive - c) || t.getElement(l.seq2Range.start - c) !== t.getElement(l.seq2Range.endExclusive - c)); c++)
        ;
      if (c--, c === u) {
        s[s.length - 1] = new j(new V(o.seq1Range.start, l.seq1Range.endExclusive - u), new V(o.seq2Range.start, l.seq2Range.endExclusive - u));
        continue;
      }
      l = l.delta(-c);
    }
    s.push(l);
  }
  const r = [];
  for (let i = 0; i < s.length - 1; i++) {
    const o = s[i + 1];
    let l = s[i];
    if (l.seq1Range.isEmpty || l.seq2Range.isEmpty) {
      const u = o.seq1Range.start - l.seq1Range.endExclusive;
      let c;
      for (c = 0; c < u && !(!e.isStronglyEqual(l.seq1Range.start + c, l.seq1Range.endExclusive + c) || !t.isStronglyEqual(l.seq2Range.start + c, l.seq2Range.endExclusive + c)); c++)
        ;
      if (c === u) {
        s[i + 1] = new j(new V(l.seq1Range.start + u, o.seq1Range.endExclusive), new V(l.seq2Range.start + u, o.seq2Range.endExclusive));
        continue;
      }
      c > 0 && (l = l.delta(c));
    }
    r.push(l);
  }
  return s.length > 0 && r.push(s[s.length - 1]), r;
}
function Na(e, t, n) {
  if (!e.getBoundaryScore || !t.getBoundaryScore)
    return n;
  for (let s = 0; s < n.length; s++) {
    const r = s > 0 ? n[s - 1] : void 0, i = n[s], o = s + 1 < n.length ? n[s + 1] : void 0, l = new V(r ? r.seq1Range.endExclusive + 1 : 0, o ? o.seq1Range.start - 1 : e.length), u = new V(r ? r.seq2Range.endExclusive + 1 : 0, o ? o.seq2Range.start - 1 : t.length);
    i.seq1Range.isEmpty ? n[s] = ps(i, e, t, l, u) : i.seq2Range.isEmpty && (n[s] = ps(i.swap(), t, e, u, l).swap());
  }
  return n;
}
function ps(e, t, n, s, r) {
  let o = 1;
  for (; e.seq1Range.start - o >= s.start && e.seq2Range.start - o >= r.start && n.isStronglyEqual(e.seq2Range.start - o, e.seq2Range.endExclusive - o) && o < 100; )
    o++;
  o--;
  let l = 0;
  for (; e.seq1Range.start + l < s.endExclusive && e.seq2Range.endExclusive + l < r.endExclusive && n.isStronglyEqual(e.seq2Range.start + l, e.seq2Range.endExclusive + l) && l < 100; )
    l++;
  if (o === 0 && l === 0)
    return e;
  let u = 0, c = -1;
  for (let f = -o; f <= l; f++) {
    const h = e.seq2Range.start + f, d = e.seq2Range.endExclusive + f, m = e.seq1Range.start + f, g = t.getBoundaryScore(m) + n.getBoundaryScore(h) + n.getBoundaryScore(d);
    g > c && (c = g, u = f);
  }
  return e.delta(u);
}
function Sa(e, t, n) {
  const s = [];
  for (const r of n) {
    const i = s[s.length - 1];
    if (!i) {
      s.push(r);
      continue;
    }
    r.seq1Range.start - i.seq1Range.endExclusive <= 2 || r.seq2Range.start - i.seq2Range.endExclusive <= 2 ? s[s.length - 1] = new j(i.seq1Range.join(r.seq1Range), i.seq2Range.join(r.seq2Range)) : s.push(r);
  }
  return s;
}
function Ca(e, t, n) {
  const s = j.invert(n, e.length), r = [];
  let i = new pe(0, 0);
  function o(u, c) {
    if (u.offset1 < i.offset1 || u.offset2 < i.offset2)
      return;
    const f = e.findWordContaining(u.offset1), h = t.findWordContaining(u.offset2);
    if (!f || !h)
      return;
    let d = new j(f, h);
    const m = d.intersect(c);
    let g = m.seq1Range.length, b = m.seq2Range.length;
    for (; s.length > 0; ) {
      const _ = s[0];
      if (!(_.seq1Range.intersects(d.seq1Range) || _.seq2Range.intersects(d.seq2Range)))
        break;
      const S = e.findWordContaining(_.seq1Range.start), N = t.findWordContaining(_.seq2Range.start), x = new j(S, N), p = x.intersect(_);
      if (g += p.seq1Range.length, b += p.seq2Range.length, d = d.join(x), d.seq1Range.endExclusive >= _.seq1Range.endExclusive)
        s.shift();
      else
        break;
    }
    g + b < (d.seq1Range.length + d.seq2Range.length) * 2 / 3 && r.push(d), i = d.getEndExclusives();
  }
  for (; s.length > 0; ) {
    const u = s.shift();
    u.seq1Range.isEmpty || (o(u.getStarts(), u), o(u.getEndExclusives().delta(-1), u));
  }
  return Aa(n, r);
}
function Aa(e, t) {
  const n = [];
  for (; e.length > 0 || t.length > 0; ) {
    const s = e[0], r = t[0];
    let i;
    s && (!r || s.seq1Range.start < r.seq1Range.start) ? i = e.shift() : i = t.shift(), n.length > 0 && n[n.length - 1].seq1Range.endExclusive >= i.seq1Range.start ? n[n.length - 1] = n[n.length - 1].join(i) : n.push(i);
  }
  return n;
}
function Ra(e, t, n) {
  let s = n;
  if (s.length === 0)
    return s;
  let r = 0, i;
  do {
    i = !1;
    const o = [
      s[0]
    ];
    for (let l = 1; l < s.length; l++) {
      let f = function(d, m) {
        const g = new V(c.seq1Range.endExclusive, u.seq1Range.start);
        return e.getText(g).replace(/\s/g, "").length <= 4 && (d.seq1Range.length + d.seq2Range.length > 5 || m.seq1Range.length + m.seq2Range.length > 5);
      };
      const u = s[l], c = o[o.length - 1];
      f(c, u) ? (i = !0, o[o.length - 1] = o[o.length - 1].join(u)) : o.push(u);
    }
    s = o;
  } while (r++ < 10 && i);
  return s;
}
function ya(e, t, n) {
  let s = n;
  if (s.length === 0)
    return s;
  let r = 0, i;
  do {
    i = !1;
    const l = [
      s[0]
    ];
    for (let u = 1; u < s.length; u++) {
      let h = function(m, g) {
        const b = new V(f.seq1Range.endExclusive, c.seq1Range.start);
        if (e.countLinesIn(b) > 5 || b.length > 500)
          return !1;
        const v = e.getText(b).trim();
        if (v.length > 20 || v.split(/\r\n|\r|\n/).length > 1)
          return !1;
        const S = e.countLinesIn(m.seq1Range), N = m.seq1Range.length, x = t.countLinesIn(m.seq2Range), p = m.seq2Range.length, L = e.countLinesIn(g.seq1Range), A = g.seq1Range.length, E = t.countLinesIn(g.seq2Range), B = g.seq2Range.length, X = 2 * 40 + 50;
        function q(P) {
          return Math.min(P, X);
        }
        return Math.pow(Math.pow(q(S * 40 + N), 1.5) + Math.pow(q(x * 40 + p), 1.5), 1.5) + Math.pow(Math.pow(q(L * 40 + A), 1.5) + Math.pow(q(E * 40 + B), 1.5), 1.5) > (X ** 1.5) ** 1.5 * 1.3;
      };
      const c = s[u], f = l[l.length - 1];
      h(f, c) ? (i = !0, l[l.length - 1] = l[l.length - 1].join(c)) : l.push(c);
    }
    s = l;
  } while (r++ < 10 && i);
  const o = [];
  return ua(s, (l, u, c) => {
    let f = u;
    function h(v) {
      return v.length > 0 && v.trim().length <= 3 && u.seq1Range.length + u.seq2Range.length > 100;
    }
    const d = e.extendToFullLines(u.seq1Range), m = e.getText(new V(d.start, u.seq1Range.start));
    h(m) && (f = f.deltaStart(-m.length));
    const g = e.getText(new V(u.seq1Range.endExclusive, d.endExclusive));
    h(g) && (f = f.deltaEnd(g.length));
    const b = j.fromOffsetPairs(l ? l.getEndExclusives() : pe.zero, c ? c.getStarts() : pe.max), _ = f.intersect(b);
    o.length > 0 && _.getStarts().equals(o[o.length - 1].getEndExclusives()) ? o[o.length - 1] = o[o.length - 1].join(_) : o.push(_);
  }), o;
}
class xs {
  constructor(t, n) {
    this.trimmedHash = t, this.lines = n;
  }
  getElement(t) {
    return this.trimmedHash[t];
  }
  get length() {
    return this.trimmedHash.length;
  }
  getBoundaryScore(t) {
    const n = t === 0 ? 0 : _s(this.lines[t - 1]), s = t === this.lines.length ? 0 : _s(this.lines[t]);
    return 1e3 - (n + s);
  }
  getText(t) {
    return this.lines.slice(t.start, t.endExclusive).join(`
`);
  }
  isStronglyEqual(t, n) {
    return this.lines[t] === this.lines[n];
  }
}
function _s(e) {
  let t = 0;
  for (; t < e.length && (e.charCodeAt(t) === 32 || e.charCodeAt(t) === 9); )
    t++;
  return t;
}
class Ea {
  constructor() {
    this.dynamicProgrammingDiffing = new da(), this.myersDiffingAlgorithm = new Js();
  }
  computeDiff(t, n, s) {
    if (t.length <= 1 && aa(t, n, (p, L) => p === L))
      return new wt([], [], !1);
    if (t.length === 1 && t[0].length === 0 || n.length === 1 && n[0].length === 0)
      return new wt([
        new _e(new D(1, t.length + 1), new D(1, n.length + 1), [
          new de(new k(1, 1, t.length, t[t.length - 1].length + 1), new k(1, 1, n.length, n[n.length - 1].length + 1))
        ])
      ], [], !1);
    const r = s.maxComputationTimeMs === 0 ? dt.instance : new fa(s.maxComputationTimeMs), i = !s.ignoreTrimWhitespace, o = /* @__PURE__ */ new Map();
    function l(p) {
      let L = o.get(p);
      return L === void 0 && (L = o.size, o.set(p, L)), L;
    }
    const u = t.map((p) => l(p.trim())), c = n.map((p) => l(p.trim())), f = new xs(u, t), h = new xs(c, n), d = f.length + h.length < 1700 ? this.dynamicProgrammingDiffing.compute(f, h, r, (p, L) => t[p] === n[L] ? n[L].length === 0 ? 0.1 : 1 + Math.log(1 + n[L].length) : 0.99) : this.myersDiffingAlgorithm.compute(f, h, r);
    let m = d.diffs, g = d.hitTimeout;
    m = gs(f, h, m), m = Ra(f, h, m);
    const b = [], _ = (p) => {
      if (i)
        for (let L = 0; L < p; L++) {
          const A = v + L, E = S + L;
          if (t[A] !== n[E]) {
            const B = this.refineDiff(t, n, new j(new V(A, A + 1), new V(E, E + 1)), r, i);
            for (const X of B.mappings)
              b.push(X);
            B.hitTimeout && (g = !0);
          }
        }
    };
    let v = 0, S = 0;
    for (const p of m) {
      Ft(() => p.seq1Range.start - v === p.seq2Range.start - S);
      const L = p.seq1Range.start - v;
      _(L), v = p.seq1Range.endExclusive, S = p.seq2Range.endExclusive;
      const A = this.refineDiff(t, n, p, r, i);
      A.hitTimeout && (g = !0);
      for (const E of A.mappings)
        b.push(E);
    }
    _(t.length - v);
    const N = ws(b, t, n);
    let x = [];
    return s.computeMoves && (x = this.computeMoves(N, t, n, u, c, r, i)), Ft(() => {
      function p(A, E) {
        if (A.lineNumber < 1 || A.lineNumber > E.length)
          return !1;
        const B = E[A.lineNumber - 1];
        return !(A.column < 1 || A.column > B.length + 1);
      }
      function L(A, E) {
        return !(A.startLineNumber < 1 || A.startLineNumber > E.length + 1 || A.endLineNumberExclusive < 1 || A.endLineNumberExclusive > E.length + 1);
      }
      for (const A of N) {
        if (!A.innerChanges)
          return !1;
        for (const E of A.innerChanges)
          if (!(p(E.modifiedRange.getStartPosition(), n) && p(E.modifiedRange.getEndPosition(), n) && p(E.originalRange.getStartPosition(), t) && p(E.originalRange.getEndPosition(), t)))
            return !1;
        if (!L(A.modified, n) || !L(A.original, t))
          return !1;
      }
      return !0;
    }), new wt(N, x, g);
  }
  computeMoves(t, n, s, r, i, o, l) {
    return pa(t, n, s, r, i, o).map((f) => {
      const h = this.refineDiff(n, s, new j(f.original.toOffsetRange(), f.modified.toOffsetRange()), o, l), d = ws(h.mappings, n, s, !0);
      return new Zi(f, d);
    });
  }
  refineDiff(t, n, s, r, i) {
    const l = ka(s).toRangeMapping2(t, n), u = new Tt(t, l.originalRange, i), c = new Tt(n, l.modifiedRange, i), f = u.length + c.length < 500 ? this.dynamicProgrammingDiffing.compute(u, c, r) : this.myersDiffingAlgorithm.compute(u, c, r);
    let h = f.diffs;
    return h = gs(u, c, h), h = Ca(u, c, h), h = Sa(u, c, h), h = ya(u, c, h), {
      mappings: h.map((m) => new de(u.translateRange(m.seq1Range), c.translateRange(m.seq2Range))),
      hitTimeout: f.hitTimeout
    };
  }
}
function ws(e, t, n, s = !1) {
  const r = [];
  for (const i of oa(e.map((o) => Ma(o, t, n)), (o, l) => o.original.overlapOrTouch(l.original) || o.modified.overlapOrTouch(l.modified))) {
    const o = i[0], l = i[i.length - 1];
    r.push(new _e(o.original.join(l.original), o.modified.join(l.modified), i.map((u) => u.innerChanges[0])));
  }
  return Ft(() => !s && r.length > 0 && (r[0].modified.startLineNumber !== r[0].original.startLineNumber || n.length - r[r.length - 1].modified.endLineNumberExclusive !== t.length - r[r.length - 1].original.endLineNumberExclusive) ? !1 : js(r, (i, o) => o.original.startLineNumber - i.original.endLineNumberExclusive === o.modified.startLineNumber - i.modified.endLineNumberExclusive && // There has to be an unchanged line in between (otherwise both diffs should have been joined)
  i.original.endLineNumberExclusive < o.original.startLineNumber && i.modified.endLineNumberExclusive < o.modified.startLineNumber)), r;
}
function Ma(e, t, n) {
  let s = 0, r = 0;
  e.modifiedRange.endColumn === 1 && e.originalRange.endColumn === 1 && e.originalRange.startLineNumber + s <= e.originalRange.endLineNumber && e.modifiedRange.startLineNumber + s <= e.modifiedRange.endLineNumber && (r = -1), e.modifiedRange.startColumn - 1 >= n[e.modifiedRange.startLineNumber - 1].length && e.originalRange.startColumn - 1 >= t[e.originalRange.startLineNumber - 1].length && e.originalRange.startLineNumber <= e.originalRange.endLineNumber + r && e.modifiedRange.startLineNumber <= e.modifiedRange.endLineNumber + r && (s = 1);
  const i = new D(e.originalRange.startLineNumber + s, e.originalRange.endLineNumber + 1 + r), o = new D(e.modifiedRange.startLineNumber + s, e.modifiedRange.endLineNumber + 1 + r);
  return new _e(i, o, [e]);
}
function ka(e) {
  return new ce(new D(e.seq1Range.start + 1, e.seq1Range.endExclusive + 1), new D(e.seq2Range.start + 1, e.seq2Range.endExclusive + 1));
}
const Ls = {
  getLegacy: () => new na(),
  getDefault: () => new Ea()
};
function Ee(e, t) {
  const n = Math.pow(10, t);
  return Math.round(e * n) / n;
}
class Q {
  constructor(t, n, s, r = 1) {
    this._rgbaBrand = void 0, this.r = Math.min(255, Math.max(0, t)) | 0, this.g = Math.min(255, Math.max(0, n)) | 0, this.b = Math.min(255, Math.max(0, s)) | 0, this.a = Ee(Math.max(Math.min(1, r), 0), 3);
  }
  static equals(t, n) {
    return t.r === n.r && t.g === n.g && t.b === n.b && t.a === n.a;
  }
}
class ue {
  constructor(t, n, s, r) {
    this._hslaBrand = void 0, this.h = Math.max(Math.min(360, t), 0) | 0, this.s = Ee(Math.max(Math.min(1, n), 0), 3), this.l = Ee(Math.max(Math.min(1, s), 0), 3), this.a = Ee(Math.max(Math.min(1, r), 0), 3);
  }
  static equals(t, n) {
    return t.h === n.h && t.s === n.s && t.l === n.l && t.a === n.a;
  }
  /**
   * Converts an RGB color value to HSL. Conversion formula
   * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
   * Assumes r, g, and b are contained in the set [0, 255] and
   * returns h in the set [0, 360], s, and l in the set [0, 1].
   */
  static fromRGBA(t) {
    const n = t.r / 255, s = t.g / 255, r = t.b / 255, i = t.a, o = Math.max(n, s, r), l = Math.min(n, s, r);
    let u = 0, c = 0;
    const f = (l + o) / 2, h = o - l;
    if (h > 0) {
      switch (c = Math.min(f <= 0.5 ? h / (2 * f) : h / (2 - 2 * f), 1), o) {
        case n:
          u = (s - r) / h + (s < r ? 6 : 0);
          break;
        case s:
          u = (r - n) / h + 2;
          break;
        case r:
          u = (n - s) / h + 4;
          break;
      }
      u *= 60, u = Math.round(u);
    }
    return new ue(u, c, f, i);
  }
  static _hue2rgb(t, n, s) {
    return s < 0 && (s += 1), s > 1 && (s -= 1), s < 1 / 6 ? t + (n - t) * 6 * s : s < 1 / 2 ? n : s < 2 / 3 ? t + (n - t) * (2 / 3 - s) * 6 : t;
  }
  /**
   * Converts an HSL color value to RGB. Conversion formula
   * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
   * Assumes h in the set [0, 360] s, and l are contained in the set [0, 1] and
   * returns r, g, and b in the set [0, 255].
   */
  static toRGBA(t) {
    const n = t.h / 360, { s, l: r, a: i } = t;
    let o, l, u;
    if (s === 0)
      o = l = u = r;
    else {
      const c = r < 0.5 ? r * (1 + s) : r + s - r * s, f = 2 * r - c;
      o = ue._hue2rgb(f, c, n + 1 / 3), l = ue._hue2rgb(f, c, n), u = ue._hue2rgb(f, c, n - 1 / 3);
    }
    return new Q(Math.round(o * 255), Math.round(l * 255), Math.round(u * 255), i);
  }
}
class He {
  constructor(t, n, s, r) {
    this._hsvaBrand = void 0, this.h = Math.max(Math.min(360, t), 0) | 0, this.s = Ee(Math.max(Math.min(1, n), 0), 3), this.v = Ee(Math.max(Math.min(1, s), 0), 3), this.a = Ee(Math.max(Math.min(1, r), 0), 3);
  }
  static equals(t, n) {
    return t.h === n.h && t.s === n.s && t.v === n.v && t.a === n.a;
  }
  // from http://www.rapidtables.com/convert/color/rgb-to-hsv.htm
  static fromRGBA(t) {
    const n = t.r / 255, s = t.g / 255, r = t.b / 255, i = Math.max(n, s, r), o = Math.min(n, s, r), l = i - o, u = i === 0 ? 0 : l / i;
    let c;
    return l === 0 ? c = 0 : i === n ? c = ((s - r) / l % 6 + 6) % 6 : i === s ? c = (r - n) / l + 2 : c = (n - s) / l + 4, new He(Math.round(c * 60), u, i, t.a);
  }
  // from http://www.rapidtables.com/convert/color/hsv-to-rgb.htm
  static toRGBA(t) {
    const { h: n, s, v: r, a: i } = t, o = r * s, l = o * (1 - Math.abs(n / 60 % 2 - 1)), u = r - o;
    let [c, f, h] = [0, 0, 0];
    return n < 60 ? (c = o, f = l) : n < 120 ? (c = l, f = o) : n < 180 ? (f = o, h = l) : n < 240 ? (f = l, h = o) : n < 300 ? (c = l, h = o) : n <= 360 && (c = o, h = l), c = Math.round((c + u) * 255), f = Math.round((f + u) * 255), h = Math.round((h + u) * 255), new Q(c, f, h, i);
  }
}
const H = class H {
  static fromHex(t) {
    return H.Format.CSS.parseHex(t) || H.red;
  }
  static equals(t, n) {
    return !t && !n ? !0 : !t || !n ? !1 : t.equals(n);
  }
  get hsla() {
    return this._hsla ? this._hsla : ue.fromRGBA(this.rgba);
  }
  get hsva() {
    return this._hsva ? this._hsva : He.fromRGBA(this.rgba);
  }
  constructor(t) {
    if (t)
      if (t instanceof Q)
        this.rgba = t;
      else if (t instanceof ue)
        this._hsla = t, this.rgba = ue.toRGBA(t);
      else if (t instanceof He)
        this._hsva = t, this.rgba = He.toRGBA(t);
      else
        throw new Error("Invalid color ctor argument");
    else
      throw new Error("Color needs a value");
  }
  equals(t) {
    return !!t && Q.equals(this.rgba, t.rgba) && ue.equals(this.hsla, t.hsla) && He.equals(this.hsva, t.hsva);
  }
  /**
   * http://www.w3.org/TR/WCAG20/#relativeluminancedef
   * Returns the number in the set [0, 1]. O => Darkest Black. 1 => Lightest white.
   */
  getRelativeLuminance() {
    const t = H._relativeLuminanceForComponent(this.rgba.r), n = H._relativeLuminanceForComponent(this.rgba.g), s = H._relativeLuminanceForComponent(this.rgba.b), r = 0.2126 * t + 0.7152 * n + 0.0722 * s;
    return Ee(r, 4);
  }
  static _relativeLuminanceForComponent(t) {
    const n = t / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  }
  /**
   *	http://24ways.org/2010/calculating-color-contrast
   *  Return 'true' if lighter color otherwise 'false'
   */
  isLighter() {
    return (this.rgba.r * 299 + this.rgba.g * 587 + this.rgba.b * 114) / 1e3 >= 128;
  }
  isLighterThan(t) {
    const n = this.getRelativeLuminance(), s = t.getRelativeLuminance();
    return n > s;
  }
  isDarkerThan(t) {
    const n = this.getRelativeLuminance(), s = t.getRelativeLuminance();
    return n < s;
  }
  lighten(t) {
    return new H(new ue(this.hsla.h, this.hsla.s, this.hsla.l + this.hsla.l * t, this.hsla.a));
  }
  darken(t) {
    return new H(new ue(this.hsla.h, this.hsla.s, this.hsla.l - this.hsla.l * t, this.hsla.a));
  }
  transparent(t) {
    const { r: n, g: s, b: r, a: i } = this.rgba;
    return new H(new Q(n, s, r, i * t));
  }
  isTransparent() {
    return this.rgba.a === 0;
  }
  isOpaque() {
    return this.rgba.a === 1;
  }
  opposite() {
    return new H(new Q(255 - this.rgba.r, 255 - this.rgba.g, 255 - this.rgba.b, this.rgba.a));
  }
  makeOpaque(t) {
    if (this.isOpaque() || t.rgba.a !== 1)
      return this;
    const { r: n, g: s, b: r, a: i } = this.rgba;
    return new H(new Q(t.rgba.r - i * (t.rgba.r - n), t.rgba.g - i * (t.rgba.g - s), t.rgba.b - i * (t.rgba.b - r), 1));
  }
  toString() {
    return this._toString || (this._toString = H.Format.CSS.format(this)), this._toString;
  }
  static getLighterColor(t, n, s) {
    if (t.isLighterThan(n))
      return t;
    s = s || 0.5;
    const r = t.getRelativeLuminance(), i = n.getRelativeLuminance();
    return s = s * (i - r) / i, t.lighten(s);
  }
  static getDarkerColor(t, n, s) {
    if (t.isDarkerThan(n))
      return t;
    s = s || 0.5;
    const r = t.getRelativeLuminance(), i = n.getRelativeLuminance();
    return s = s * (r - i) / r, t.darken(s);
  }
};
H.white = new H(new Q(255, 255, 255, 1)), H.black = new H(new Q(0, 0, 0, 1)), H.red = new H(new Q(255, 0, 0, 1)), H.blue = new H(new Q(0, 0, 255, 1)), H.green = new H(new Q(0, 255, 0, 1)), H.cyan = new H(new Q(0, 255, 255, 1)), H.lightgrey = new H(new Q(211, 211, 211, 1)), H.transparent = new H(new Q(0, 0, 0, 0));
let Ze = H;
(function(e) {
  (function(t) {
    (function(n) {
      function s(m) {
        return m.rgba.a === 1 ? `rgb(${m.rgba.r}, ${m.rgba.g}, ${m.rgba.b})` : e.Format.CSS.formatRGBA(m);
      }
      n.formatRGB = s;
      function r(m) {
        return `rgba(${m.rgba.r}, ${m.rgba.g}, ${m.rgba.b}, ${+m.rgba.a.toFixed(2)})`;
      }
      n.formatRGBA = r;
      function i(m) {
        return m.hsla.a === 1 ? `hsl(${m.hsla.h}, ${(m.hsla.s * 100).toFixed(2)}%, ${(m.hsla.l * 100).toFixed(2)}%)` : e.Format.CSS.formatHSLA(m);
      }
      n.formatHSL = i;
      function o(m) {
        return `hsla(${m.hsla.h}, ${(m.hsla.s * 100).toFixed(2)}%, ${(m.hsla.l * 100).toFixed(2)}%, ${m.hsla.a.toFixed(2)})`;
      }
      n.formatHSLA = o;
      function l(m) {
        const g = m.toString(16);
        return g.length !== 2 ? "0" + g : g;
      }
      function u(m) {
        return `#${l(m.rgba.r)}${l(m.rgba.g)}${l(m.rgba.b)}`;
      }
      n.formatHex = u;
      function c(m, g = !1) {
        return g && m.rgba.a === 1 ? e.Format.CSS.formatHex(m) : `#${l(m.rgba.r)}${l(m.rgba.g)}${l(m.rgba.b)}${l(Math.round(m.rgba.a * 255))}`;
      }
      n.formatHexA = c;
      function f(m) {
        return m.isOpaque() ? e.Format.CSS.formatHex(m) : e.Format.CSS.formatRGBA(m);
      }
      n.format = f;
      function h(m) {
        const g = m.length;
        if (g === 0 || m.charCodeAt(0) !== 35)
          return null;
        if (g === 7) {
          const b = 16 * d(m.charCodeAt(1)) + d(m.charCodeAt(2)), _ = 16 * d(m.charCodeAt(3)) + d(m.charCodeAt(4)), v = 16 * d(m.charCodeAt(5)) + d(m.charCodeAt(6));
          return new e(new Q(b, _, v, 1));
        }
        if (g === 9) {
          const b = 16 * d(m.charCodeAt(1)) + d(m.charCodeAt(2)), _ = 16 * d(m.charCodeAt(3)) + d(m.charCodeAt(4)), v = 16 * d(m.charCodeAt(5)) + d(m.charCodeAt(6)), S = 16 * d(m.charCodeAt(7)) + d(m.charCodeAt(8));
          return new e(new Q(b, _, v, S / 255));
        }
        if (g === 4) {
          const b = d(m.charCodeAt(1)), _ = d(m.charCodeAt(2)), v = d(m.charCodeAt(3));
          return new e(new Q(16 * b + b, 16 * _ + _, 16 * v + v));
        }
        if (g === 5) {
          const b = d(m.charCodeAt(1)), _ = d(m.charCodeAt(2)), v = d(m.charCodeAt(3)), S = d(m.charCodeAt(4));
          return new e(new Q(16 * b + b, 16 * _ + _, 16 * v + v, (16 * S + S) / 255));
        }
        return null;
      }
      n.parseHex = h;
      function d(m) {
        switch (m) {
          case 48:
            return 0;
          case 49:
            return 1;
          case 50:
            return 2;
          case 51:
            return 3;
          case 52:
            return 4;
          case 53:
            return 5;
          case 54:
            return 6;
          case 55:
            return 7;
          case 56:
            return 8;
          case 57:
            return 9;
          case 97:
            return 10;
          case 65:
            return 10;
          case 98:
            return 11;
          case 66:
            return 11;
          case 99:
            return 12;
          case 67:
            return 12;
          case 100:
            return 13;
          case 68:
            return 13;
          case 101:
            return 14;
          case 69:
            return 14;
          case 102:
            return 15;
          case 70:
            return 15;
        }
        return 0;
      }
    })(t.CSS || (t.CSS = {}));
  })(e.Format || (e.Format = {}));
})(Ze || (Ze = {}));
function Zs(e) {
  const t = [];
  for (const n of e) {
    const s = Number(n);
    (s || s === 0 && n.replace(/\s/g, "") !== "") && t.push(s);
  }
  return t;
}
function M1(e, t, n, s) {
  return {
    red: e / 255,
    blue: n / 255,
    green: t / 255,
    alpha: s
  };
}
function tt(e, t) {
  const n = t.index, s = t[0].length;
  if (!n)
    return;
  const r = e.positionAt(n);
  return {
    startLineNumber: r.lineNumber,
    startColumn: r.column,
    endLineNumber: r.lineNumber,
    endColumn: r.column + s
  };
}
function Fa(e, t) {
  if (!e)
    return;
  const n = Ze.Format.CSS.parseHex(t);
  if (n)
    return {
      range: e,
      color: M1(n.rgba.r, n.rgba.g, n.rgba.b, n.rgba.a)
    };
}
function vs(e, t, n) {
  if (!e || t.length !== 1)
    return;
  const r = t[0].values(), i = Zs(r);
  return {
    range: e,
    color: M1(i[0], i[1], i[2], n ? i[3] : 1)
  };
}
function Ns(e, t, n) {
  if (!e || t.length !== 1)
    return;
  const r = t[0].values(), i = Zs(r), o = new Ze(new ue(i[0], i[1] / 100, i[2] / 100, n ? i[3] : 1));
  return {
    range: e,
    color: M1(o.rgba.r, o.rgba.g, o.rgba.b, o.rgba.a)
  };
}
function nt(e, t) {
  return typeof e == "string" ? [...e.matchAll(t)] : e.findMatches(t);
}
function Pa(e) {
  const t = [], s = nt(e, /\b(rgb|rgba|hsl|hsla)(\([0-9\s,.\%]*\))|(#)([A-Fa-f0-9]{3})\b|(#)([A-Fa-f0-9]{4})\b|(#)([A-Fa-f0-9]{6})\b|(#)([A-Fa-f0-9]{8})\b/gm);
  if (s.length > 0)
    for (const r of s) {
      const i = r.filter((c) => c !== void 0), o = i[1], l = i[2];
      if (!l)
        continue;
      let u;
      if (o === "rgb") {
        const c = /^\(\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*,\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*,\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*\)$/gm;
        u = vs(tt(e, r), nt(l, c), !1);
      } else if (o === "rgba") {
        const c = /^\(\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*,\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*,\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*,\s*(0[.][0-9]+|[.][0-9]+|[01][.]|[01])\s*\)$/gm;
        u = vs(tt(e, r), nt(l, c), !0);
      } else if (o === "hsl") {
        const c = /^\(\s*(36[0]|3[0-5][0-9]|[12][0-9][0-9]|[1-9]?[0-9])\s*,\s*(100|\d{1,2}[.]\d*|\d{1,2})%\s*,\s*(100|\d{1,2}[.]\d*|\d{1,2})%\s*\)$/gm;
        u = Ns(tt(e, r), nt(l, c), !1);
      } else if (o === "hsla") {
        const c = /^\(\s*(36[0]|3[0-5][0-9]|[12][0-9][0-9]|[1-9]?[0-9])\s*,\s*(100|\d{1,2}[.]\d*|\d{1,2})%\s*,\s*(100|\d{1,2}[.]\d*|\d{1,2})%\s*,\s*(0[.][0-9]+|[.][0-9]+|[01][.]|[01])\s*\)$/gm;
        u = Ns(tt(e, r), nt(l, c), !0);
      } else
        o === "#" && (u = Fa(tt(e, r), o + l));
      u && t.push(u);
    }
  return t;
}
function Da(e) {
  return !e || typeof e.getValue != "function" || typeof e.positionAt != "function" ? [] : Pa(e);
}
const Ss = new RegExp("\\bMARK:\\s*(.*)$", "d"), Ta = /^-+|-+$/g;
function Ia(e, t) {
  var s;
  let n = [];
  if (t.findRegionSectionHeaders && ((s = t.foldingRules) != null && s.markers)) {
    const r = Va(e, t);
    n = n.concat(r);
  }
  if (t.findMarkSectionHeaders) {
    const r = Ba(e);
    n = n.concat(r);
  }
  return n;
}
function Va(e, t) {
  const n = [], s = e.getLineCount();
  for (let r = 1; r <= s; r++) {
    const i = e.getLineContent(r), o = i.match(t.foldingRules.markers.start);
    if (o) {
      const l = { startLineNumber: r, startColumn: o[0].length + 1, endLineNumber: r, endColumn: i.length + 1 };
      if (l.endColumn > l.startColumn) {
        const u = {
          range: l,
          ...Ks(i.substring(o[0].length)),
          shouldBeInComments: !1
        };
        (u.text || u.hasSeparatorLine) && n.push(u);
      }
    }
  }
  return n;
}
function Ba(e) {
  const t = [], n = e.getLineCount();
  for (let s = 1; s <= n; s++) {
    const r = e.getLineContent(s);
    qa(r, s, t);
  }
  return t;
}
function qa(e, t, n) {
  Ss.lastIndex = 0;
  const s = Ss.exec(e);
  if (s) {
    const r = s.indices[1][0] + 1, i = s.indices[1][1] + 1, o = { startLineNumber: t, startColumn: r, endLineNumber: t, endColumn: i };
    if (o.endColumn > o.startColumn) {
      const l = {
        range: o,
        ...Ks(s[1]),
        shouldBeInComments: !0
      };
      (l.text || l.hasSeparatorLine) && n.push(l);
    }
  }
}
function Ks(e) {
  e = e.trim();
  const t = e.startsWith("-");
  return e = e.replace(Ta, ""), { text: e, hasSeparatorLine: t };
}
var Cs;
(function(e) {
  async function t(s) {
    let r;
    const i = await Promise.all(s.map((o) => o.then((l) => l, (l) => {
      r || (r = l);
    })));
    if (typeof r < "u")
      throw r;
    return i;
  }
  e.settled = t;
  function n(s) {
    return new Promise(async (r, i) => {
      try {
        await s(r, i);
      } catch (o) {
        i(o);
      }
    });
  }
  e.withAsyncBody = n;
})(Cs || (Cs = {}));
const ne = class ne {
  static fromArray(t) {
    return new ne((n) => {
      n.emitMany(t);
    });
  }
  static fromPromise(t) {
    return new ne(async (n) => {
      n.emitMany(await t);
    });
  }
  static fromPromises(t) {
    return new ne(async (n) => {
      await Promise.all(t.map(async (s) => n.emitOne(await s)));
    });
  }
  static merge(t) {
    return new ne(async (n) => {
      await Promise.all(t.map(async (s) => {
        for await (const r of s)
          n.emitOne(r);
      }));
    });
  }
  constructor(t, n) {
    this._state = 0, this._results = [], this._error = null, this._onReturn = n, this._onStateChanged = new le(), queueMicrotask(async () => {
      const s = {
        emitOne: (r) => this.emitOne(r),
        emitMany: (r) => this.emitMany(r),
        reject: (r) => this.reject(r)
      };
      try {
        await Promise.resolve(t(s)), this.resolve();
      } catch (r) {
        this.reject(r);
      } finally {
        s.emitOne = void 0, s.emitMany = void 0, s.reject = void 0;
      }
    });
  }
  [Symbol.asyncIterator]() {
    let t = 0;
    return {
      next: async () => {
        do {
          if (this._state === 2)
            throw this._error;
          if (t < this._results.length)
            return { done: !1, value: this._results[t++] };
          if (this._state === 1)
            return { done: !0, value: void 0 };
          await At.toPromise(this._onStateChanged.event);
        } while (!0);
      },
      return: async () => {
        var n;
        return (n = this._onReturn) == null || n.call(this), { done: !0, value: void 0 };
      }
    };
  }
  static map(t, n) {
    return new ne(async (s) => {
      for await (const r of t)
        s.emitOne(n(r));
    });
  }
  map(t) {
    return ne.map(this, t);
  }
  static filter(t, n) {
    return new ne(async (s) => {
      for await (const r of t)
        n(r) && s.emitOne(r);
    });
  }
  filter(t) {
    return ne.filter(this, t);
  }
  static coalesce(t) {
    return ne.filter(t, (n) => !!n);
  }
  coalesce() {
    return ne.coalesce(this);
  }
  static async toPromise(t) {
    const n = [];
    for await (const s of t)
      n.push(s);
    return n;
  }
  toPromise() {
    return ne.toPromise(this);
  }
  /**
   * The value will be appended at the end.
   *
   * **NOTE** If `resolve()` or `reject()` have already been called, this method has no effect.
   */
  emitOne(t) {
    this._state === 0 && (this._results.push(t), this._onStateChanged.fire());
  }
  /**
   * The values will be appended at the end.
   *
   * **NOTE** If `resolve()` or `reject()` have already been called, this method has no effect.
   */
  emitMany(t) {
    this._state === 0 && (this._results = this._results.concat(t), this._onStateChanged.fire());
  }
  /**
   * Calling `resolve()` will mark the result array as complete.
   *
   * **NOTE** `resolve()` must be called, otherwise all consumers of this iterable will hang indefinitely, similar to a non-resolved promise.
   * **NOTE** If `resolve()` or `reject()` have already been called, this method has no effect.
   */
  resolve() {
    this._state === 0 && (this._state = 1, this._onStateChanged.fire());
  }
  /**
   * Writing an error will permanently invalidate this iterable.
   * The current users will receive an error thrown, as will all future users.
   *
   * **NOTE** If `resolve()` or `reject()` have already been called, this method has no effect.
   */
  reject(t) {
    this._state === 0 && (this._state = 2, this._error = t, this._onStateChanged.fire());
  }
};
ne.EMPTY = ne.fromArray([]);
let As = ne;
class Ua {
  constructor(t) {
    this.values = t, this.prefixSum = new Uint32Array(t.length), this.prefixSumValidIndex = new Int32Array(1), this.prefixSumValidIndex[0] = -1;
  }
  insertValues(t, n) {
    t = Be(t);
    const s = this.values, r = this.prefixSum, i = n.length;
    return i === 0 ? !1 : (this.values = new Uint32Array(s.length + i), this.values.set(s.subarray(0, t), 0), this.values.set(s.subarray(t), t + i), this.values.set(n, t), t - 1 < this.prefixSumValidIndex[0] && (this.prefixSumValidIndex[0] = t - 1), this.prefixSum = new Uint32Array(this.values.length), this.prefixSumValidIndex[0] >= 0 && this.prefixSum.set(r.subarray(0, this.prefixSumValidIndex[0] + 1)), !0);
  }
  setValue(t, n) {
    return t = Be(t), n = Be(n), this.values[t] === n ? !1 : (this.values[t] = n, t - 1 < this.prefixSumValidIndex[0] && (this.prefixSumValidIndex[0] = t - 1), !0);
  }
  removeValues(t, n) {
    t = Be(t), n = Be(n);
    const s = this.values, r = this.prefixSum;
    if (t >= s.length)
      return !1;
    const i = s.length - t;
    return n >= i && (n = i), n === 0 ? !1 : (this.values = new Uint32Array(s.length - n), this.values.set(s.subarray(0, t), 0), this.values.set(s.subarray(t + n), t), this.prefixSum = new Uint32Array(this.values.length), t - 1 < this.prefixSumValidIndex[0] && (this.prefixSumValidIndex[0] = t - 1), this.prefixSumValidIndex[0] >= 0 && this.prefixSum.set(r.subarray(0, this.prefixSumValidIndex[0] + 1)), !0);
  }
  getTotalSum() {
    return this.values.length === 0 ? 0 : this._getPrefixSum(this.values.length - 1);
  }
  /**
   * Returns the sum of the first `index + 1` many items.
   * @returns `SUM(0 <= j <= index, values[j])`.
   */
  getPrefixSum(t) {
    return t < 0 ? 0 : (t = Be(t), this._getPrefixSum(t));
  }
  _getPrefixSum(t) {
    if (t <= this.prefixSumValidIndex[0])
      return this.prefixSum[t];
    let n = this.prefixSumValidIndex[0] + 1;
    n === 0 && (this.prefixSum[0] = this.values[0], n++), t >= this.values.length && (t = this.values.length - 1);
    for (let s = n; s <= t; s++)
      this.prefixSum[s] = this.prefixSum[s - 1] + this.values[s];
    return this.prefixSumValidIndex[0] = Math.max(this.prefixSumValidIndex[0], t), this.prefixSum[t];
  }
  getIndexOf(t) {
    t = Math.floor(t), this.getTotalSum();
    let n = 0, s = this.values.length - 1, r = 0, i = 0, o = 0;
    for (; n <= s; )
      if (r = n + (s - n) / 2 | 0, i = this.prefixSum[r], o = i - this.values[r], t < o)
        s = r - 1;
      else if (t >= i)
        n = r + 1;
      else
        break;
    return new Ha(r, t - o);
  }
}
class Ha {
  constructor(t, n) {
    this.index = t, this.remainder = n, this._prefixSumIndexOfResultBrand = void 0, this.index = t, this.remainder = n;
  }
}
class $a {
  constructor(t, n, s, r) {
    this._uri = t, this._lines = n, this._eol = s, this._versionId = r, this._lineStarts = null, this._cachedTextValue = null;
  }
  dispose() {
    this._lines.length = 0;
  }
  get version() {
    return this._versionId;
  }
  getText() {
    return this._cachedTextValue === null && (this._cachedTextValue = this._lines.join(this._eol)), this._cachedTextValue;
  }
  onEvents(t) {
    t.eol && t.eol !== this._eol && (this._eol = t.eol, this._lineStarts = null);
    const n = t.changes;
    for (const s of n)
      this._acceptDeleteRange(s.range), this._acceptInsertText(new $(s.range.startLineNumber, s.range.startColumn), s.text);
    this._versionId = t.versionId, this._cachedTextValue = null;
  }
  _ensureLineStarts() {
    if (!this._lineStarts) {
      const t = this._eol.length, n = this._lines.length, s = new Uint32Array(n);
      for (let r = 0; r < n; r++)
        s[r] = this._lines[r].length + t;
      this._lineStarts = new Ua(s);
    }
  }
  /**
   * All changes to a line's text go through this method
   */
  _setLineText(t, n) {
    this._lines[t] = n, this._lineStarts && this._lineStarts.setValue(t, this._lines[t].length + this._eol.length);
  }
  _acceptDeleteRange(t) {
    if (t.startLineNumber === t.endLineNumber) {
      if (t.startColumn === t.endColumn)
        return;
      this._setLineText(t.startLineNumber - 1, this._lines[t.startLineNumber - 1].substring(0, t.startColumn - 1) + this._lines[t.startLineNumber - 1].substring(t.endColumn - 1));
      return;
    }
    this._setLineText(t.startLineNumber - 1, this._lines[t.startLineNumber - 1].substring(0, t.startColumn - 1) + this._lines[t.endLineNumber - 1].substring(t.endColumn - 1)), this._lines.splice(t.startLineNumber, t.endLineNumber - t.startLineNumber), this._lineStarts && this._lineStarts.removeValues(t.startLineNumber, t.endLineNumber - t.startLineNumber);
  }
  _acceptInsertText(t, n) {
    if (n.length === 0)
      return;
    const s = Fr(n);
    if (s.length === 1) {
      this._setLineText(t.lineNumber - 1, this._lines[t.lineNumber - 1].substring(0, t.column - 1) + s[0] + this._lines[t.lineNumber - 1].substring(t.column - 1));
      return;
    }
    s[s.length - 1] += this._lines[t.lineNumber - 1].substring(t.column - 1), this._setLineText(t.lineNumber - 1, this._lines[t.lineNumber - 1].substring(0, t.column - 1) + s[0]);
    const r = new Uint32Array(s.length - 1);
    for (let i = 1; i < s.length; i++)
      this._lines.splice(t.lineNumber + i - 1, 0, s[i]), r[i - 1] = s[i].length + this._eol.length;
    this._lineStarts && this._lineStarts.insertValues(t.lineNumber, r);
  }
}
class Wa {
  constructor() {
    this._models = /* @__PURE__ */ Object.create(null);
  }
  getModel(t) {
    return this._models[t];
  }
  getModels() {
    const t = [];
    return Object.keys(this._models).forEach((n) => t.push(this._models[n])), t;
  }
  $acceptNewModel(t) {
    this._models[t.url] = new za(re.parse(t.url), t.lines, t.EOL, t.versionId);
  }
  $acceptModelChanged(t, n) {
    if (!this._models[t])
      return;
    this._models[t].onEvents(n);
  }
  $acceptRemovedModel(t) {
    this._models[t] && delete this._models[t];
  }
}
class za extends $a {
  get uri() {
    return this._uri;
  }
  get eol() {
    return this._eol;
  }
  getValue() {
    return this.getText();
  }
  findMatches(t) {
    const n = [];
    for (let s = 0; s < this._lines.length; s++) {
      const r = this._lines[s], i = this.offsetAt(new $(s + 1, 1)), o = r.matchAll(t);
      for (const l of o)
        (l.index || l.index === 0) && (l.index = l.index + i), n.push(l);
    }
    return n;
  }
  getLinesContent() {
    return this._lines.slice(0);
  }
  getLineCount() {
    return this._lines.length;
  }
  getLineContent(t) {
    return this._lines[t - 1];
  }
  getWordAtPosition(t, n) {
    const s = E1(t.column, Xs(n), this._lines[t.lineNumber - 1], 0);
    return s ? new k(t.lineNumber, s.startColumn, t.lineNumber, s.endColumn) : null;
  }
  words(t) {
    const n = this._lines, s = this._wordenize.bind(this);
    let r = 0, i = "", o = 0, l = [];
    return {
      *[Symbol.iterator]() {
        for (; ; )
          if (o < l.length) {
            const u = i.substring(l[o].start, l[o].end);
            o += 1, yield u;
          } else if (r < n.length)
            i = n[r], l = s(i, t), o = 0, r += 1;
          else
            break;
      }
    };
  }
  getLineWords(t, n) {
    const s = this._lines[t - 1], r = this._wordenize(s, n), i = [];
    for (const o of r)
      i.push({
        word: s.substring(o.start, o.end),
        startColumn: o.start + 1,
        endColumn: o.end + 1
      });
    return i;
  }
  _wordenize(t, n) {
    const s = [];
    let r;
    for (n.lastIndex = 0; (r = n.exec(t)) && r[0].length !== 0; )
      s.push({ start: r.index, end: r.index + r[0].length });
    return s;
  }
  getValueInRange(t) {
    if (t = this._validateRange(t), t.startLineNumber === t.endLineNumber)
      return this._lines[t.startLineNumber - 1].substring(t.startColumn - 1, t.endColumn - 1);
    const n = this._eol, s = t.startLineNumber - 1, r = t.endLineNumber - 1, i = [];
    i.push(this._lines[s].substring(t.startColumn - 1));
    for (let o = s + 1; o < r; o++)
      i.push(this._lines[o]);
    return i.push(this._lines[r].substring(0, t.endColumn - 1)), i.join(n);
  }
  offsetAt(t) {
    return t = this._validatePosition(t), this._ensureLineStarts(), this._lineStarts.getPrefixSum(t.lineNumber - 2) + (t.column - 1);
  }
  positionAt(t) {
    t = Math.floor(t), t = Math.max(0, t), this._ensureLineStarts();
    const n = this._lineStarts.getIndexOf(t), s = this._lines[n.index].length;
    return {
      lineNumber: 1 + n.index,
      column: 1 + Math.min(n.remainder, s)
    };
  }
  _validateRange(t) {
    const n = this._validatePosition({ lineNumber: t.startLineNumber, column: t.startColumn }), s = this._validatePosition({ lineNumber: t.endLineNumber, column: t.endColumn });
    return n.lineNumber !== t.startLineNumber || n.column !== t.startColumn || s.lineNumber !== t.endLineNumber || s.column !== t.endColumn ? {
      startLineNumber: n.lineNumber,
      startColumn: n.column,
      endLineNumber: s.lineNumber,
      endColumn: s.column
    } : t;
  }
  _validatePosition(t) {
    if (!$.isIPosition(t))
      throw new Error("bad position");
    let { lineNumber: n, column: s } = t, r = !1;
    if (n < 1)
      n = 1, s = 1, r = !0;
    else if (n > this._lines.length)
      n = this._lines.length, s = this._lines[n - 1].length + 1, r = !0;
    else {
      const i = this._lines[n - 1].length + 1;
      s < 1 ? (s = 1, r = !0) : s > i && (s = i, r = !0);
    }
    return r ? { lineNumber: n, column: s } : t;
  }
}
const $t = class $t {
  constructor() {
    this._workerTextModelSyncServer = new Wa();
  }
  dispose() {
  }
  _getModel(t) {
    return this._workerTextModelSyncServer.getModel(t);
  }
  _getModels() {
    return this._workerTextModelSyncServer.getModels();
  }
  $acceptNewModel(t) {
    this._workerTextModelSyncServer.$acceptNewModel(t);
  }
  $acceptModelChanged(t, n) {
    this._workerTextModelSyncServer.$acceptModelChanged(t, n);
  }
  $acceptRemovedModel(t) {
    this._workerTextModelSyncServer.$acceptRemovedModel(t);
  }
  async $computeUnicodeHighlights(t, n, s) {
    const r = this._getModel(t);
    return r ? Yi.computeUnicodeHighlights(r, n, s) : { ranges: [], hasMore: !1, ambiguousCharacterCount: 0, invisibleCharacterCount: 0, nonBasicAsciiCharacterCount: 0 };
  }
  async $findSectionHeaders(t, n) {
    const s = this._getModel(t);
    return s ? Ia(s, n) : [];
  }
  // ---- BEGIN diff --------------------------------------------------------------------------
  async $computeDiff(t, n, s, r) {
    const i = this._getModel(t), o = this._getModel(n);
    return !i || !o ? null : Nt.computeDiff(i, o, s, r);
  }
  static computeDiff(t, n, s, r) {
    const i = r === "advanced" ? Ls.getDefault() : Ls.getLegacy(), o = t.getLinesContent(), l = n.getLinesContent(), u = i.computeDiff(o, l, s), c = u.changes.length > 0 ? !1 : this._modelsAreIdentical(t, n);
    function f(h) {
      return h.map((d) => {
        var m;
        return [d.original.startLineNumber, d.original.endLineNumberExclusive, d.modified.startLineNumber, d.modified.endLineNumberExclusive, (m = d.innerChanges) == null ? void 0 : m.map((g) => [
          g.originalRange.startLineNumber,
          g.originalRange.startColumn,
          g.originalRange.endLineNumber,
          g.originalRange.endColumn,
          g.modifiedRange.startLineNumber,
          g.modifiedRange.startColumn,
          g.modifiedRange.endLineNumber,
          g.modifiedRange.endColumn
        ])];
      });
    }
    return {
      identical: c,
      quitEarly: u.hitTimeout,
      changes: f(u.changes),
      moves: u.moves.map((h) => [
        h.lineRangeMapping.original.startLineNumber,
        h.lineRangeMapping.original.endLineNumberExclusive,
        h.lineRangeMapping.modified.startLineNumber,
        h.lineRangeMapping.modified.endLineNumberExclusive,
        f(h.changes)
      ])
    };
  }
  static _modelsAreIdentical(t, n) {
    const s = t.getLineCount(), r = n.getLineCount();
    if (s !== r)
      return !1;
    for (let i = 1; i <= s; i++) {
      const o = t.getLineContent(i), l = n.getLineContent(i);
      if (o !== l)
        return !1;
    }
    return !0;
  }
  async $computeMoreMinimalEdits(t, n, s) {
    const r = this._getModel(t);
    if (!r)
      return n;
    const i = [];
    let o;
    n = n.slice(0).sort((u, c) => {
      if (u.range && c.range)
        return k.compareRangesUsingStarts(u.range, c.range);
      const f = u.range ? 0 : 1, h = c.range ? 0 : 1;
      return f - h;
    });
    let l = 0;
    for (let u = 1; u < n.length; u++)
      k.getEndPosition(n[l].range).equals(k.getStartPosition(n[u].range)) ? (n[l].range = k.fromPositions(k.getStartPosition(n[l].range), k.getEndPosition(n[u].range)), n[l].text += n[u].text) : (l++, n[l] = n[u]);
    n.length = l + 1;
    for (let { range: u, text: c, eol: f } of n) {
      if (typeof f == "number" && (o = f), k.isEmpty(u) && !c)
        continue;
      const h = r.getValueInRange(u);
      if (c = c.replace(/\r\n|\n|\r/g, r.eol), h === c)
        continue;
      if (Math.max(c.length, h.length) > Nt._diffLimit) {
        i.push({ range: u, text: c });
        continue;
      }
      const d = pi(h, c, s), m = r.offsetAt(k.lift(u).getStartPosition());
      for (const g of d) {
        const b = r.positionAt(m + g.originalStart), _ = r.positionAt(m + g.originalStart + g.originalLength), v = {
          text: c.substr(g.modifiedStart, g.modifiedLength),
          range: { startLineNumber: b.lineNumber, startColumn: b.column, endLineNumber: _.lineNumber, endColumn: _.column }
        };
        r.getValueInRange(v.range) !== v.text && i.push(v);
      }
    }
    return typeof o == "number" && i.push({ eol: o, text: "", range: { startLineNumber: 0, startColumn: 0, endLineNumber: 0, endColumn: 0 } }), i;
  }
  // ---- END minimal edits ---------------------------------------------------------------
  async $computeLinks(t) {
    const n = this._getModel(t);
    return n ? vi(n) : null;
  }
  // --- BEGIN default document colors -----------------------------------------------------------
  async $computeDefaultDocumentColors(t) {
    const n = this._getModel(t);
    return n ? Da(n) : null;
  }
  async $textualSuggest(t, n, s, r) {
    const i = new Wt(), o = new RegExp(s, r), l = /* @__PURE__ */ new Set();
    e:
      for (const u of t) {
        const c = this._getModel(u);
        if (c) {
          for (const f of c.words(o))
            if (!(f === n || !isNaN(Number(f))) && (l.add(f), l.size > Nt._suggestionsLimit))
              break e;
        }
      }
    return { words: Array.from(l), duration: i.elapsed() };
  }
  // ---- END suggest --------------------------------------------------------------------------
  //#region -- word ranges --
  async $computeWordRanges(t, n, s, r) {
    const i = this._getModel(t);
    if (!i)
      return /* @__PURE__ */ Object.create(null);
    const o = new RegExp(s, r), l = /* @__PURE__ */ Object.create(null);
    for (let u = n.startLineNumber; u < n.endLineNumber; u++) {
      const c = i.getLineWords(u, o);
      for (const f of c) {
        if (!isNaN(Number(f.word)))
          continue;
        let h = l[f.word];
        h || (h = [], l[f.word] = h), h.push({
          startLineNumber: u,
          startColumn: f.startColumn,
          endLineNumber: u,
          endColumn: f.endColumn
        });
      }
    }
    return l;
  }
  //#endregion
  async $navigateValueSet(t, n, s, r, i) {
    const o = this._getModel(t);
    if (!o)
      return null;
    const l = new RegExp(r, i);
    n.startColumn === n.endColumn && (n = {
      startLineNumber: n.startLineNumber,
      startColumn: n.startColumn,
      endLineNumber: n.endLineNumber,
      endColumn: n.endColumn + 1
    });
    const u = o.getValueInRange(n), c = o.getWordAtPosition({ lineNumber: n.startLineNumber, column: n.startColumn }, l);
    if (!c)
      return null;
    const f = o.getValueInRange(c);
    return u1.INSTANCE.navigateValueSet(n, u, c, f, s);
  }
};
$t._diffLimit = 1e5, $t._suggestionsLimit = 1e4;
let N1 = $t;
class Nt extends N1 {
  constructor(t, n) {
    super(), this._host = t, this._foreignModuleFactory = n, this._foreignModule = null;
  }
  async $ping() {
    return "pong";
  }
  // ---- BEGIN foreign module support --------------------------------------------------------------------------
  $loadForeignModule(t, n, s) {
    const o = {
      host: Hi(s, (l, u) => this._host.$fhr(l, u)),
      getMirrorModels: () => this._getModels()
    };
    return this._foreignModuleFactory ? (this._foreignModule = this._foreignModuleFactory(o, n), Promise.resolve(es(this._foreignModule))) : new Promise((l, u) => {
      const c = (f) => {
        this._foreignModule = f.create(o, n), l(es(this._foreignModule));
      };
      import(`${Hs.asBrowserUri(`${t}.js`).toString(!0)}`).then(c).catch(u);
    });
  }
  // foreign method request
  $fmr(t, n) {
    if (!this._foreignModule || typeof this._foreignModule[t] != "function")
      return Promise.reject(new Error("Missing requestHandler or method: " + t));
    try {
      return Promise.resolve(this._foreignModule[t].apply(this._foreignModule, n));
    } catch (s) {
      return Promise.reject(s);
    }
  }
}
typeof importScripts == "function" && (globalThis.monaco = Pi());
let S1 = !1;
function Oa(e) {
  if (S1)
    return;
  S1 = !0;
  const t = new mi((n) => {
    globalThis.postMessage(n);
  }, (n) => new Nt(p1.getChannel(n), e));
  globalThis.onmessage = (n) => {
    t.onmessage(n.data);
  };
}
globalThis.onmessage = (e) => {
  S1 || Oa(null);
};
export {
  Oa as initialize
};
