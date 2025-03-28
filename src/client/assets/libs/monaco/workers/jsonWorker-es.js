var so = Object.defineProperty;
var ao = (e, t, n) => t in e ? so(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var He = (e, t, n) => (ao(e, typeof t != "symbol" ? t + "" : t, n), n);
class oo {
  constructor() {
    this.listeners = [], this.unexpectedErrorHandler = function(t) {
      setTimeout(() => {
        throw t.stack ? Ct.isErrorNoTelemetry(t) ? new Ct(t.message + `

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
const lo = new oo();
function Ht(e) {
  uo(e) || lo.onUnexpectedError(e);
}
function ui(e) {
  if (e instanceof Error) {
    const { name: t, message: n } = e, r = e.stacktrace || e.stack;
    return {
      $isError: !0,
      name: t,
      message: n,
      stack: r,
      noTelemetry: Ct.isErrorNoTelemetry(e)
    };
  }
  return e;
}
const or = "Canceled";
function uo(e) {
  return e instanceof co ? !0 : e instanceof Error && e.name === or && e.message === or;
}
class co extends Error {
  constructor() {
    super(or), this.name = this.message;
  }
}
class Ct extends Error {
  constructor(t) {
    super(t), this.name = "CodeExpectedError";
  }
  static fromError(t) {
    if (t instanceof Ct)
      return t;
    const n = new Ct();
    return n.message = t.message, n.stack = t.stack, n;
  }
  static isErrorNoTelemetry(t) {
    return t.name === "CodeExpectedError";
  }
}
class we extends Error {
  constructor(t) {
    super(t || "An unexpected bug occurred."), Object.setPrototypeOf(this, we.prototype);
  }
}
function fo(e, t) {
  const n = this;
  let r = !1, i;
  return function() {
    if (r)
      return i;
    if (r = !0, t)
      try {
        i = e.apply(n, arguments);
      } finally {
        t();
      }
    else
      i = e.apply(n, arguments);
    return i;
  };
}
var wn;
(function(e) {
  function t(y) {
    return y && typeof y == "object" && typeof y[Symbol.iterator] == "function";
  }
  e.is = t;
  const n = Object.freeze([]);
  function r() {
    return n;
  }
  e.empty = r;
  function* i(y) {
    yield y;
  }
  e.single = i;
  function s(y) {
    return t(y) ? y : i(y);
  }
  e.wrap = s;
  function a(y) {
    return y || n;
  }
  e.from = a;
  function* l(y) {
    for (let b = y.length - 1; b >= 0; b--)
      yield y[b];
  }
  e.reverse = l;
  function o(y) {
    return !y || y[Symbol.iterator]().next().done === !0;
  }
  e.isEmpty = o;
  function u(y) {
    return y[Symbol.iterator]().next().value;
  }
  e.first = u;
  function h(y, b) {
    let _ = 0;
    for (const k of y)
      if (b(k, _++))
        return !0;
    return !1;
  }
  e.some = h;
  function c(y, b) {
    for (const _ of y)
      if (b(_))
        return _;
  }
  e.find = c;
  function* d(y, b) {
    for (const _ of y)
      b(_) && (yield _);
  }
  e.filter = d;
  function* m(y, b) {
    let _ = 0;
    for (const k of y)
      yield b(k, _++);
  }
  e.map = m;
  function* g(y, b) {
    let _ = 0;
    for (const k of y)
      yield* b(k, _++);
  }
  e.flatMap = g;
  function* p(...y) {
    for (const b of y)
      yield* b;
  }
  e.concat = p;
  function x(y, b, _) {
    let k = _;
    for (const C of y)
      k = b(k, C);
    return k;
  }
  e.reduce = x;
  function* w(y, b, _ = y.length) {
    for (b < 0 && (b += y.length), _ < 0 ? _ += y.length : _ > y.length && (_ = y.length); b < _; b++)
      yield y[b];
  }
  e.slice = w;
  function L(y, b = Number.POSITIVE_INFINITY) {
    const _ = [];
    if (b === 0)
      return [_, y];
    const k = y[Symbol.iterator]();
    for (let C = 0; C < b; C++) {
      const F = k.next();
      if (F.done)
        return [_, e.empty()];
      _.push(F.value);
    }
    return [_, { [Symbol.iterator]() {
      return k;
    } }];
  }
  e.consume = L;
  async function v(y) {
    const b = [];
    for await (const _ of y)
      b.push(_);
    return Promise.resolve(b);
  }
  e.asyncToArray = v;
})(wn || (wn = {}));
function ba(e) {
  if (wn.is(e)) {
    const t = [];
    for (const n of e)
      if (n)
        try {
          n.dispose();
        } catch (r) {
          t.push(r);
        }
    if (t.length === 1)
      throw t[0];
    if (t.length > 1)
      throw new AggregateError(t, "Encountered errors while disposing of store");
    return Array.isArray(e) ? [] : e;
  } else if (e)
    return e.dispose(), e;
}
function ho(...e) {
  return _n(() => ba(e));
}
function _n(e) {
  return {
    dispose: fo(() => {
      e();
    })
  };
}
const Un = class Un {
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
        ba(this._toDispose);
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
    return this._isDisposed ? Un.DISABLE_DISPOSED_WARNING || console.warn(new Error("Trying to add a disposable to a DisposableStore that has already been disposed of. The added object will be leaked!").stack) : this._toDispose.add(t), t;
  }
  /**
   * Deletes the value from the store, but does not dispose it.
   */
  deleteAndLeak(t) {
    t && this._toDispose.has(t) && this._toDispose.delete(t);
  }
};
Un.DISABLE_DISPOSED_WARNING = !1;
let Zt = Un;
const li = class li {
  constructor() {
    this._store = new Zt(), this._store;
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
li.None = Object.freeze({ dispose() {
} });
let Tt = li;
const Lt = class Lt {
  constructor(t) {
    this.element = t, this.next = Lt.Undefined, this.prev = Lt.Undefined;
  }
};
Lt.Undefined = new Lt(void 0);
let Q = Lt;
class mo {
  constructor() {
    this._first = Q.Undefined, this._last = Q.Undefined, this._size = 0;
  }
  get size() {
    return this._size;
  }
  isEmpty() {
    return this._first === Q.Undefined;
  }
  clear() {
    let t = this._first;
    for (; t !== Q.Undefined; ) {
      const n = t.next;
      t.prev = Q.Undefined, t.next = Q.Undefined, t = n;
    }
    this._first = Q.Undefined, this._last = Q.Undefined, this._size = 0;
  }
  unshift(t) {
    return this._insert(t, !1);
  }
  push(t) {
    return this._insert(t, !0);
  }
  _insert(t, n) {
    const r = new Q(t);
    if (this._first === Q.Undefined)
      this._first = r, this._last = r;
    else if (n) {
      const s = this._last;
      this._last = r, r.prev = s, s.next = r;
    } else {
      const s = this._first;
      this._first = r, r.next = s, s.prev = r;
    }
    this._size += 1;
    let i = !1;
    return () => {
      i || (i = !0, this._remove(r));
    };
  }
  shift() {
    if (this._first !== Q.Undefined) {
      const t = this._first.element;
      return this._remove(this._first), t;
    }
  }
  pop() {
    if (this._last !== Q.Undefined) {
      const t = this._last.element;
      return this._remove(this._last), t;
    }
  }
  _remove(t) {
    if (t.prev !== Q.Undefined && t.next !== Q.Undefined) {
      const n = t.prev;
      n.next = t.next, t.next.prev = n;
    } else
      t.prev === Q.Undefined && t.next === Q.Undefined ? (this._first = Q.Undefined, this._last = Q.Undefined) : t.next === Q.Undefined ? (this._last = this._last.prev, this._last.next = Q.Undefined) : t.prev === Q.Undefined && (this._first = this._first.next, this._first.prev = Q.Undefined);
    this._size -= 1;
  }
  *[Symbol.iterator]() {
    let t = this._first;
    for (; t !== Q.Undefined; )
      yield t.element, t = t.next;
  }
}
const go = globalThis.performance && typeof globalThis.performance.now == "function";
class Gn {
  static create(t) {
    return new Gn(t);
  }
  constructor(t) {
    this._now = go && t === !1 ? Date.now : globalThis.performance.now.bind(globalThis.performance), this._startTime = this._now(), this._stopTime = -1;
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
var Ln;
(function(e) {
  e.None = () => Tt.None;
  function t(S, R) {
    return d(S, () => {
    }, 0, void 0, !0, void 0, R);
  }
  e.defer = t;
  function n(S) {
    return (R, I = null, T) => {
      let P = !1, D;
      return D = S(($) => {
        if (!P)
          return D ? D.dispose() : P = !0, R.call(I, $);
      }, null, T), P && D.dispose(), D;
    };
  }
  e.once = n;
  function r(S, R) {
    return e.once(e.filter(S, R));
  }
  e.onceIf = r;
  function i(S, R, I) {
    return h((T, P = null, D) => S(($) => T.call(P, R($)), null, D), I);
  }
  e.map = i;
  function s(S, R, I) {
    return h((T, P = null, D) => S(($) => {
      R($), T.call(P, $);
    }, null, D), I);
  }
  e.forEach = s;
  function a(S, R, I) {
    return h((T, P = null, D) => S(($) => R($) && T.call(P, $), null, D), I);
  }
  e.filter = a;
  function l(S) {
    return S;
  }
  e.signal = l;
  function o(...S) {
    return (R, I = null, T) => {
      const P = ho(...S.map((D) => D(($) => R.call(I, $))));
      return c(P, T);
    };
  }
  e.any = o;
  function u(S, R, I, T) {
    let P = I;
    return i(S, (D) => (P = R(P, D), P), T);
  }
  e.reduce = u;
  function h(S, R) {
    let I;
    const T = {
      onWillAddFirstListener() {
        I = S(P.fire, P);
      },
      onDidRemoveLastListener() {
        I == null || I.dispose();
      }
    }, P = new Le(T);
    return R == null || R.add(P), P.event;
  }
  function c(S, R) {
    return R instanceof Array ? R.push(S) : R && R.add(S), S;
  }
  function d(S, R, I = 100, T = !1, P = !1, D, $) {
    let j, te, ht, on = 0, rt;
    const no = {
      leakWarningThreshold: D,
      onWillAddFirstListener() {
        j = S((ro) => {
          on++, te = R(te, ro), T && !ht && (ln.fire(te), te = void 0), rt = () => {
            const io = te;
            te = void 0, ht = void 0, (!T || on > 1) && ln.fire(io), on = 0;
          }, typeof I == "number" ? (clearTimeout(ht), ht = setTimeout(rt, I)) : ht === void 0 && (ht = 0, queueMicrotask(rt));
        });
      },
      onWillRemoveListener() {
        P && on > 0 && (rt == null || rt());
      },
      onDidRemoveLastListener() {
        rt = void 0, j.dispose();
      }
    }, ln = new Le(no);
    return $ == null || $.add(ln), ln.event;
  }
  e.debounce = d;
  function m(S, R = 0, I) {
    return e.debounce(S, (T, P) => T ? (T.push(P), T) : [P], R, void 0, !0, void 0, I);
  }
  e.accumulate = m;
  function g(S, R = (T, P) => T === P, I) {
    let T = !0, P;
    return a(S, (D) => {
      const $ = T || !R(D, P);
      return T = !1, P = D, $;
    }, I);
  }
  e.latch = g;
  function p(S, R, I) {
    return [
      e.filter(S, R, I),
      e.filter(S, (T) => !R(T), I)
    ];
  }
  e.split = p;
  function x(S, R = !1, I = [], T) {
    let P = I.slice(), D = S((te) => {
      P ? P.push(te) : j.fire(te);
    });
    T && T.add(D);
    const $ = () => {
      P == null || P.forEach((te) => j.fire(te)), P = null;
    }, j = new Le({
      onWillAddFirstListener() {
        D || (D = S((te) => j.fire(te)), T && T.add(D));
      },
      onDidAddFirstListener() {
        P && (R ? setTimeout($) : $());
      },
      onDidRemoveLastListener() {
        D && D.dispose(), D = null;
      }
    });
    return T && T.add(j), j.event;
  }
  e.buffer = x;
  function w(S, R) {
    return (T, P, D) => {
      const $ = R(new v());
      return S(function(j) {
        const te = $.evaluate(j);
        te !== L && T.call(P, te);
      }, void 0, D);
    };
  }
  e.chain = w;
  const L = Symbol("HaltChainable");
  class v {
    constructor() {
      this.steps = [];
    }
    map(R) {
      return this.steps.push(R), this;
    }
    forEach(R) {
      return this.steps.push((I) => (R(I), I)), this;
    }
    filter(R) {
      return this.steps.push((I) => R(I) ? I : L), this;
    }
    reduce(R, I) {
      let T = I;
      return this.steps.push((P) => (T = R(T, P), T)), this;
    }
    latch(R = (I, T) => I === T) {
      let I = !0, T;
      return this.steps.push((P) => {
        const D = I || !R(P, T);
        return I = !1, T = P, D ? P : L;
      }), this;
    }
    evaluate(R) {
      for (const I of this.steps)
        if (R = I(R), R === L)
          break;
      return R;
    }
  }
  function y(S, R, I = (T) => T) {
    const T = (...j) => $.fire(I(...j)), P = () => S.on(R, T), D = () => S.removeListener(R, T), $ = new Le({ onWillAddFirstListener: P, onDidRemoveLastListener: D });
    return $.event;
  }
  e.fromNodeEventEmitter = y;
  function b(S, R, I = (T) => T) {
    const T = (...j) => $.fire(I(...j)), P = () => S.addEventListener(R, T), D = () => S.removeEventListener(R, T), $ = new Le({ onWillAddFirstListener: P, onDidRemoveLastListener: D });
    return $.event;
  }
  e.fromDOMEventEmitter = b;
  function _(S) {
    return new Promise((R) => n(S)(R));
  }
  e.toPromise = _;
  function k(S) {
    const R = new Le();
    return S.then((I) => {
      R.fire(I);
    }, () => {
      R.fire(void 0);
    }).finally(() => {
      R.dispose();
    }), R.event;
  }
  e.fromPromise = k;
  function C(S, R) {
    return S((I) => R.fire(I));
  }
  e.forward = C;
  function F(S, R, I) {
    return R(I), S((T) => R(T));
  }
  e.runAndSubscribe = F;
  class O {
    constructor(R, I) {
      this._observable = R, this._counter = 0, this._hasChanged = !1;
      const T = {
        onWillAddFirstListener: () => {
          R.addObserver(this), this._observable.reportChanges();
        },
        onDidRemoveLastListener: () => {
          R.removeObserver(this);
        }
      };
      this.emitter = new Le(T), I && I.add(this.emitter);
    }
    beginUpdate(R) {
      this._counter++;
    }
    handlePossibleChange(R) {
    }
    handleChange(R, I) {
      this._hasChanged = !0;
    }
    endUpdate(R) {
      this._counter--, this._counter === 0 && (this._observable.reportChanges(), this._hasChanged && (this._hasChanged = !1, this.emitter.fire(this._observable.get())));
    }
  }
  function M(S, R) {
    return new O(S, R).emitter.event;
  }
  e.fromObservable = M;
  function N(S) {
    return (R, I, T) => {
      let P = 0, D = !1;
      const $ = {
        beginUpdate() {
          P++;
        },
        endUpdate() {
          P--, P === 0 && (S.reportChanges(), D && (D = !1, R.call(I)));
        },
        handlePossibleChange() {
        },
        handleChange() {
          D = !0;
        }
      };
      S.addObserver($), S.reportChanges();
      const j = {
        dispose() {
          S.removeObserver($);
        }
      };
      return T instanceof Zt ? T.add(j) : Array.isArray(T) && T.push(j), j;
    };
  }
  e.fromObservableLight = N;
})(Ln || (Ln = {}));
const Nt = class Nt {
  constructor(t) {
    this.listenerCount = 0, this.invocationCount = 0, this.elapsedOverall = 0, this.durations = [], this.name = `${t}_${Nt._idPool++}`, Nt.all.add(this);
  }
  start(t) {
    this._stopWatch = new Gn(), this.listenerCount = t;
  }
  stop() {
    if (this._stopWatch) {
      const t = this._stopWatch.elapsed();
      this.durations.push(t), this.elapsedOverall += t, this.invocationCount += 1, this._stopWatch = void 0;
    }
  }
};
Nt.all = /* @__PURE__ */ new Set(), Nt._idPool = 0;
let lr = Nt, po = -1;
const Bn = class Bn {
  constructor(t, n, r = (Bn._idPool++).toString(16).padStart(3, "0")) {
    this._errorHandler = t, this.threshold = n, this.name = r, this._warnCountdown = 0;
  }
  dispose() {
    var t;
    (t = this._stacks) == null || t.clear();
  }
  check(t, n) {
    const r = this.threshold;
    if (r <= 0 || n < r)
      return;
    this._stacks || (this._stacks = /* @__PURE__ */ new Map());
    const i = this._stacks.get(t.value) || 0;
    if (this._stacks.set(t.value, i + 1), this._warnCountdown -= 1, this._warnCountdown <= 0) {
      this._warnCountdown = r * 0.5;
      const [s, a] = this.getMostFrequentStack(), l = `[${this.name}] potential listener LEAK detected, having ${n} listeners already. MOST frequent listener (${a}):`;
      console.warn(l), console.warn(s);
      const o = new bo(l, s);
      this._errorHandler(o);
    }
    return () => {
      const s = this._stacks.get(t.value) || 0;
      this._stacks.set(t.value, s - 1);
    };
  }
  getMostFrequentStack() {
    if (!this._stacks)
      return;
    let t, n = 0;
    for (const [r, i] of this._stacks)
      (!t || n < i) && (t = [r, i], n = i);
    return t;
  }
};
Bn._idPool = 1;
let ur = Bn;
class ti {
  static create() {
    const t = new Error();
    return new ti(t.stack ?? "");
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
class bo extends Error {
  constructor(t, n) {
    super(t), this.name = "ListenerLeakError", this.stack = n;
  }
}
class vo extends Error {
  constructor(t, n) {
    super(t), this.name = "ListenerRefusalError", this.stack = n;
  }
}
class Jn {
  constructor(t) {
    this.value = t;
  }
}
const xo = 2;
class Le {
  constructor(t) {
    var n, r, i, s;
    this._size = 0, this._options = t, this._leakageMon = (n = this._options) != null && n.leakWarningThreshold ? new ur((t == null ? void 0 : t.onListenerError) ?? Ht, ((r = this._options) == null ? void 0 : r.leakWarningThreshold) ?? po) : void 0, this._perfMon = (i = this._options) != null && i._profName ? new lr(this._options._profName) : void 0, this._deliveryQueue = (s = this._options) == null ? void 0 : s.deliveryQueue;
  }
  dispose() {
    var t, n, r, i;
    this._disposed || (this._disposed = !0, ((t = this._deliveryQueue) == null ? void 0 : t.current) === this && this._deliveryQueue.reset(), this._listeners && (this._listeners = void 0, this._size = 0), (r = (n = this._options) == null ? void 0 : n.onDidRemoveLastListener) == null || r.call(n), (i = this._leakageMon) == null || i.dispose());
  }
  /**
   * For the public to allow to subscribe
   * to events from this Emitter
   */
  get event() {
    return this._event ?? (this._event = (t, n, r) => {
      var l, o, u, h, c;
      if (this._leakageMon && this._size > this._leakageMon.threshold ** 2) {
        const d = `[${this._leakageMon.name}] REFUSES to accept new listeners because it exceeded its threshold by far (${this._size} vs ${this._leakageMon.threshold})`;
        console.warn(d);
        const m = this._leakageMon.getMostFrequentStack() ?? ["UNKNOWN stack", -1], g = new vo(`${d}. HINT: Stack shows most frequent listener (${m[1]}-times)`, m[0]);
        return (((l = this._options) == null ? void 0 : l.onListenerError) || Ht)(g), Tt.None;
      }
      if (this._disposed)
        return Tt.None;
      n && (t = t.bind(n));
      const i = new Jn(t);
      let s;
      this._leakageMon && this._size >= Math.ceil(this._leakageMon.threshold * 0.2) && (i.stack = ti.create(), s = this._leakageMon.check(i.stack, this._size + 1)), this._listeners ? this._listeners instanceof Jn ? (this._deliveryQueue ?? (this._deliveryQueue = new yo()), this._listeners = [this._listeners, i]) : this._listeners.push(i) : ((u = (o = this._options) == null ? void 0 : o.onWillAddFirstListener) == null || u.call(o, this), this._listeners = i, (c = (h = this._options) == null ? void 0 : h.onDidAddFirstListener) == null || c.call(h, this)), this._size++;
      const a = _n(() => {
        s == null || s(), this._removeListener(i);
      });
      return r instanceof Zt ? r.add(a) : Array.isArray(r) && r.push(a), a;
    }), this._event;
  }
  _removeListener(t) {
    var s, a, l, o;
    if ((a = (s = this._options) == null ? void 0 : s.onWillRemoveListener) == null || a.call(s, this), !this._listeners)
      return;
    if (this._size === 1) {
      this._listeners = void 0, (o = (l = this._options) == null ? void 0 : l.onDidRemoveLastListener) == null || o.call(l, this), this._size = 0;
      return;
    }
    const n = this._listeners, r = n.indexOf(t);
    if (r === -1)
      throw console.log("disposed?", this._disposed), console.log("size?", this._size), console.log("arr?", JSON.stringify(this._listeners)), new Error("Attempted to dispose unknown listener");
    this._size--, n[r] = void 0;
    const i = this._deliveryQueue.current === this;
    if (this._size * xo <= n.length) {
      let u = 0;
      for (let h = 0; h < n.length; h++)
        n[h] ? n[u++] = n[h] : i && (this._deliveryQueue.end--, u < this._deliveryQueue.i && this._deliveryQueue.i--);
      n.length = u;
    }
  }
  _deliver(t, n) {
    var i;
    if (!t)
      return;
    const r = ((i = this._options) == null ? void 0 : i.onListenerError) || Ht;
    if (!r) {
      t.value(n);
      return;
    }
    try {
      t.value(n);
    } catch (s) {
      r(s);
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
    var n, r, i, s;
    if ((n = this._deliveryQueue) != null && n.current && (this._deliverQueue(this._deliveryQueue), (r = this._perfMon) == null || r.stop()), (i = this._perfMon) == null || i.start(this._size), this._listeners)
      if (this._listeners instanceof Jn)
        this._deliver(this._listeners, t);
      else {
        const a = this._deliveryQueue;
        a.enqueue(this, t, this._listeners.length), this._deliverQueue(a);
      }
    (s = this._perfMon) == null || s.stop();
  }
  hasListeners() {
    return this._size > 0;
  }
}
class yo {
  constructor() {
    this.i = -1, this.end = 0;
  }
  enqueue(t, n, r) {
    this.i = 0, this.end = r, this.current = t, this.value = n;
  }
  reset() {
    this.i = this.end, this.current = void 0, this.value = void 0;
  }
}
function wo() {
  return globalThis._VSCODE_NLS_MESSAGES;
}
function va() {
  return globalThis._VSCODE_NLS_LANGUAGE;
}
const _o = va() === "pseudo" || typeof document < "u" && document.location && document.location.hash.indexOf("pseudo=true") >= 0;
function ci(e, t) {
  let n;
  return t.length === 0 ? n = e : n = e.replace(/\{(\d+)\}/g, (r, i) => {
    const s = i[0], a = t[s];
    let l = r;
    return typeof a == "string" ? l = a : (typeof a == "number" || typeof a == "boolean" || a === void 0 || a === null) && (l = String(a)), l;
  }), _o && (n = "［" + n.replace(/[aouei]/g, "$&$&") + "］"), n;
}
function X(e, t, ...n) {
  return ci(typeof e == "number" ? Lo(e, t) : t, n);
}
function Lo(e, t) {
  var r;
  const n = (r = wo()) == null ? void 0 : r[e];
  if (typeof n != "string") {
    if (typeof t == "string")
      return t;
    throw new Error(`!!! NLS MISSING: ${e} !!!`);
  }
  return n;
}
const wt = "en";
let cr = !1, fr = !1, Xn = !1, xa = !1, ni = !1, un, Qn = wt, fi = wt, No, Ae;
const Ue = globalThis;
let ue;
var da;
typeof Ue.vscode < "u" && typeof Ue.vscode.process < "u" ? ue = Ue.vscode.process : typeof process < "u" && typeof ((da = process == null ? void 0 : process.versions) == null ? void 0 : da.node) == "string" && (ue = process);
var ma;
const So = typeof ((ma = ue == null ? void 0 : ue.versions) == null ? void 0 : ma.electron) == "string", Ao = So && (ue == null ? void 0 : ue.type) === "renderer";
var ga;
if (typeof ue == "object") {
  cr = ue.platform === "win32", fr = ue.platform === "darwin", Xn = ue.platform === "linux", Xn && ue.env.SNAP && ue.env.SNAP_REVISION, ue.env.CI || ue.env.BUILD_ARTIFACTSTAGINGDIRECTORY, un = wt, Qn = wt;
  const e = ue.env.VSCODE_NLS_CONFIG;
  if (e)
    try {
      const t = JSON.parse(e);
      un = t.userLocale, fi = t.osLocale, Qn = t.resolvedLanguage || wt, No = (ga = t.languagePack) == null ? void 0 : ga.translationsConfigFile;
    } catch {
    }
  xa = !0;
} else
  typeof navigator == "object" && !Ao ? (Ae = navigator.userAgent, cr = Ae.indexOf("Windows") >= 0, fr = Ae.indexOf("Macintosh") >= 0, (Ae.indexOf("Macintosh") >= 0 || Ae.indexOf("iPad") >= 0 || Ae.indexOf("iPhone") >= 0) && navigator.maxTouchPoints && navigator.maxTouchPoints > 0, Xn = Ae.indexOf("Linux") >= 0, (Ae == null ? void 0 : Ae.indexOf("Mobi")) >= 0, ni = !0, Qn = va() || wt, un = navigator.language.toLowerCase(), fi = un) : console.error("Unable to resolve platform.");
const Kt = cr, ko = fr, Ro = xa, Eo = ni, Mo = ni && typeof Ue.importScripts == "function", Co = Mo ? Ue.origin : void 0, De = Ae, To = typeof Ue.postMessage == "function" && !Ue.importScripts;
(() => {
  if (To) {
    const e = [];
    Ue.addEventListener("message", (n) => {
      if (n.data && n.data.vscodeScheduleAsyncWork)
        for (let r = 0, i = e.length; r < i; r++) {
          const s = e[r];
          if (s.id === n.data.vscodeScheduleAsyncWork) {
            e.splice(r, 1), s.callback();
            return;
          }
        }
    });
    let t = 0;
    return (n) => {
      const r = ++t;
      e.push({
        id: r,
        callback: n
      }), Ue.postMessage({ vscodeScheduleAsyncWork: r }, "*");
    };
  }
  return (e) => setTimeout(e);
})();
const Po = !!(De && De.indexOf("Chrome") >= 0);
De && De.indexOf("Firefox") >= 0;
!Po && De && De.indexOf("Safari") >= 0;
De && De.indexOf("Edg/") >= 0;
De && De.indexOf("Android") >= 0;
function Io(e) {
  return e;
}
class Fo {
  constructor(t, n) {
    this.lastCache = void 0, this.lastArgKey = void 0, typeof t == "function" ? (this._fn = t, this._computeKey = Io) : (this._fn = n, this._computeKey = t.getCacheKey);
  }
  get(t) {
    const n = this._computeKey(t);
    return this.lastArgKey !== n && (this.lastArgKey = n, this.lastCache = this._fn(t)), this.lastCache;
  }
}
class hi {
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
function Vo(e) {
  return e.replace(/[\\\{\}\*\+\?\|\^\$\.\[\]\(\)]/g, "\\$&");
}
function Do(e) {
  return e.split(/\r\n|\r|\n/);
}
function Oo(e) {
  for (let t = 0, n = e.length; t < n; t++) {
    const r = e.charCodeAt(t);
    if (r !== 32 && r !== 9)
      return t;
  }
  return -1;
}
function $o(e, t = e.length - 1) {
  for (let n = t; n >= 0; n--) {
    const r = e.charCodeAt(n);
    if (r !== 32 && r !== 9)
      return n;
  }
  return -1;
}
function ya(e) {
  return e >= 65 && e <= 90;
}
function Nn(e) {
  return 55296 <= e && e <= 56319;
}
function hr(e) {
  return 56320 <= e && e <= 57343;
}
function wa(e, t) {
  return (e - 55296 << 10) + (t - 56320) + 65536;
}
function Uo(e, t, n) {
  const r = e.charCodeAt(n);
  if (Nn(r) && n + 1 < t) {
    const i = e.charCodeAt(n + 1);
    if (hr(i))
      return wa(r, i);
  }
  return r;
}
const Bo = /^[\t\n\r\x20-\x7E]*$/;
function qo(e) {
  return Bo.test(e);
}
const st = class st {
  static getInstance() {
    return st._INSTANCE || (st._INSTANCE = new st()), st._INSTANCE;
  }
  constructor() {
    this._data = jo();
  }
  getGraphemeBreakType(t) {
    if (t < 32)
      return t === 10 ? 3 : t === 13 ? 2 : 4;
    if (t < 127)
      return 0;
    const n = this._data, r = n.length / 3;
    let i = 1;
    for (; i <= r; )
      if (t < n[3 * i])
        i = 2 * i;
      else if (t > n[3 * i + 1])
        i = 2 * i + 1;
      else
        return n[3 * i + 2];
    return 0;
  }
};
st._INSTANCE = null;
let di = st;
function jo() {
  return JSON.parse("[0,0,0,51229,51255,12,44061,44087,12,127462,127487,6,7083,7085,5,47645,47671,12,54813,54839,12,128678,128678,14,3270,3270,5,9919,9923,14,45853,45879,12,49437,49463,12,53021,53047,12,71216,71218,7,128398,128399,14,129360,129374,14,2519,2519,5,4448,4519,9,9742,9742,14,12336,12336,14,44957,44983,12,46749,46775,12,48541,48567,12,50333,50359,12,52125,52151,12,53917,53943,12,69888,69890,5,73018,73018,5,127990,127990,14,128558,128559,14,128759,128760,14,129653,129655,14,2027,2035,5,2891,2892,7,3761,3761,5,6683,6683,5,8293,8293,4,9825,9826,14,9999,9999,14,43452,43453,5,44509,44535,12,45405,45431,12,46301,46327,12,47197,47223,12,48093,48119,12,48989,49015,12,49885,49911,12,50781,50807,12,51677,51703,12,52573,52599,12,53469,53495,12,54365,54391,12,65279,65279,4,70471,70472,7,72145,72147,7,119173,119179,5,127799,127818,14,128240,128244,14,128512,128512,14,128652,128652,14,128721,128722,14,129292,129292,14,129445,129450,14,129734,129743,14,1476,1477,5,2366,2368,7,2750,2752,7,3076,3076,5,3415,3415,5,4141,4144,5,6109,6109,5,6964,6964,5,7394,7400,5,9197,9198,14,9770,9770,14,9877,9877,14,9968,9969,14,10084,10084,14,43052,43052,5,43713,43713,5,44285,44311,12,44733,44759,12,45181,45207,12,45629,45655,12,46077,46103,12,46525,46551,12,46973,46999,12,47421,47447,12,47869,47895,12,48317,48343,12,48765,48791,12,49213,49239,12,49661,49687,12,50109,50135,12,50557,50583,12,51005,51031,12,51453,51479,12,51901,51927,12,52349,52375,12,52797,52823,12,53245,53271,12,53693,53719,12,54141,54167,12,54589,54615,12,55037,55063,12,69506,69509,5,70191,70193,5,70841,70841,7,71463,71467,5,72330,72342,5,94031,94031,5,123628,123631,5,127763,127765,14,127941,127941,14,128043,128062,14,128302,128317,14,128465,128467,14,128539,128539,14,128640,128640,14,128662,128662,14,128703,128703,14,128745,128745,14,129004,129007,14,129329,129330,14,129402,129402,14,129483,129483,14,129686,129704,14,130048,131069,14,173,173,4,1757,1757,1,2200,2207,5,2434,2435,7,2631,2632,5,2817,2817,5,3008,3008,5,3201,3201,5,3387,3388,5,3542,3542,5,3902,3903,7,4190,4192,5,6002,6003,5,6439,6440,5,6765,6770,7,7019,7027,5,7154,7155,7,8205,8205,13,8505,8505,14,9654,9654,14,9757,9757,14,9792,9792,14,9852,9853,14,9890,9894,14,9937,9937,14,9981,9981,14,10035,10036,14,11035,11036,14,42654,42655,5,43346,43347,7,43587,43587,5,44006,44007,7,44173,44199,12,44397,44423,12,44621,44647,12,44845,44871,12,45069,45095,12,45293,45319,12,45517,45543,12,45741,45767,12,45965,45991,12,46189,46215,12,46413,46439,12,46637,46663,12,46861,46887,12,47085,47111,12,47309,47335,12,47533,47559,12,47757,47783,12,47981,48007,12,48205,48231,12,48429,48455,12,48653,48679,12,48877,48903,12,49101,49127,12,49325,49351,12,49549,49575,12,49773,49799,12,49997,50023,12,50221,50247,12,50445,50471,12,50669,50695,12,50893,50919,12,51117,51143,12,51341,51367,12,51565,51591,12,51789,51815,12,52013,52039,12,52237,52263,12,52461,52487,12,52685,52711,12,52909,52935,12,53133,53159,12,53357,53383,12,53581,53607,12,53805,53831,12,54029,54055,12,54253,54279,12,54477,54503,12,54701,54727,12,54925,54951,12,55149,55175,12,68101,68102,5,69762,69762,7,70067,70069,7,70371,70378,5,70720,70721,7,71087,71087,5,71341,71341,5,71995,71996,5,72249,72249,7,72850,72871,5,73109,73109,5,118576,118598,5,121505,121519,5,127245,127247,14,127568,127569,14,127777,127777,14,127872,127891,14,127956,127967,14,128015,128016,14,128110,128172,14,128259,128259,14,128367,128368,14,128424,128424,14,128488,128488,14,128530,128532,14,128550,128551,14,128566,128566,14,128647,128647,14,128656,128656,14,128667,128673,14,128691,128693,14,128715,128715,14,128728,128732,14,128752,128752,14,128765,128767,14,129096,129103,14,129311,129311,14,129344,129349,14,129394,129394,14,129413,129425,14,129466,129471,14,129511,129535,14,129664,129666,14,129719,129722,14,129760,129767,14,917536,917631,5,13,13,2,1160,1161,5,1564,1564,4,1807,1807,1,2085,2087,5,2307,2307,7,2382,2383,7,2497,2500,5,2563,2563,7,2677,2677,5,2763,2764,7,2879,2879,5,2914,2915,5,3021,3021,5,3142,3144,5,3263,3263,5,3285,3286,5,3398,3400,7,3530,3530,5,3633,3633,5,3864,3865,5,3974,3975,5,4155,4156,7,4229,4230,5,5909,5909,7,6078,6085,7,6277,6278,5,6451,6456,7,6744,6750,5,6846,6846,5,6972,6972,5,7074,7077,5,7146,7148,7,7222,7223,5,7416,7417,5,8234,8238,4,8417,8417,5,9000,9000,14,9203,9203,14,9730,9731,14,9748,9749,14,9762,9763,14,9776,9783,14,9800,9811,14,9831,9831,14,9872,9873,14,9882,9882,14,9900,9903,14,9929,9933,14,9941,9960,14,9974,9974,14,9989,9989,14,10006,10006,14,10062,10062,14,10160,10160,14,11647,11647,5,12953,12953,14,43019,43019,5,43232,43249,5,43443,43443,5,43567,43568,7,43696,43696,5,43765,43765,7,44013,44013,5,44117,44143,12,44229,44255,12,44341,44367,12,44453,44479,12,44565,44591,12,44677,44703,12,44789,44815,12,44901,44927,12,45013,45039,12,45125,45151,12,45237,45263,12,45349,45375,12,45461,45487,12,45573,45599,12,45685,45711,12,45797,45823,12,45909,45935,12,46021,46047,12,46133,46159,12,46245,46271,12,46357,46383,12,46469,46495,12,46581,46607,12,46693,46719,12,46805,46831,12,46917,46943,12,47029,47055,12,47141,47167,12,47253,47279,12,47365,47391,12,47477,47503,12,47589,47615,12,47701,47727,12,47813,47839,12,47925,47951,12,48037,48063,12,48149,48175,12,48261,48287,12,48373,48399,12,48485,48511,12,48597,48623,12,48709,48735,12,48821,48847,12,48933,48959,12,49045,49071,12,49157,49183,12,49269,49295,12,49381,49407,12,49493,49519,12,49605,49631,12,49717,49743,12,49829,49855,12,49941,49967,12,50053,50079,12,50165,50191,12,50277,50303,12,50389,50415,12,50501,50527,12,50613,50639,12,50725,50751,12,50837,50863,12,50949,50975,12,51061,51087,12,51173,51199,12,51285,51311,12,51397,51423,12,51509,51535,12,51621,51647,12,51733,51759,12,51845,51871,12,51957,51983,12,52069,52095,12,52181,52207,12,52293,52319,12,52405,52431,12,52517,52543,12,52629,52655,12,52741,52767,12,52853,52879,12,52965,52991,12,53077,53103,12,53189,53215,12,53301,53327,12,53413,53439,12,53525,53551,12,53637,53663,12,53749,53775,12,53861,53887,12,53973,53999,12,54085,54111,12,54197,54223,12,54309,54335,12,54421,54447,12,54533,54559,12,54645,54671,12,54757,54783,12,54869,54895,12,54981,55007,12,55093,55119,12,55243,55291,10,66045,66045,5,68325,68326,5,69688,69702,5,69817,69818,5,69957,69958,7,70089,70092,5,70198,70199,5,70462,70462,5,70502,70508,5,70750,70750,5,70846,70846,7,71100,71101,5,71230,71230,7,71351,71351,5,71737,71738,5,72000,72000,7,72160,72160,5,72273,72278,5,72752,72758,5,72882,72883,5,73031,73031,5,73461,73462,7,94192,94193,7,119149,119149,7,121403,121452,5,122915,122916,5,126980,126980,14,127358,127359,14,127535,127535,14,127759,127759,14,127771,127771,14,127792,127793,14,127825,127867,14,127897,127899,14,127945,127945,14,127985,127986,14,128000,128007,14,128021,128021,14,128066,128100,14,128184,128235,14,128249,128252,14,128266,128276,14,128335,128335,14,128379,128390,14,128407,128419,14,128444,128444,14,128481,128481,14,128499,128499,14,128526,128526,14,128536,128536,14,128543,128543,14,128556,128556,14,128564,128564,14,128577,128580,14,128643,128645,14,128649,128649,14,128654,128654,14,128660,128660,14,128664,128664,14,128675,128675,14,128686,128689,14,128695,128696,14,128705,128709,14,128717,128719,14,128725,128725,14,128736,128741,14,128747,128748,14,128755,128755,14,128762,128762,14,128981,128991,14,129009,129023,14,129160,129167,14,129296,129304,14,129320,129327,14,129340,129342,14,129356,129356,14,129388,129392,14,129399,129400,14,129404,129407,14,129432,129442,14,129454,129455,14,129473,129474,14,129485,129487,14,129648,129651,14,129659,129660,14,129671,129679,14,129709,129711,14,129728,129730,14,129751,129753,14,129776,129782,14,917505,917505,4,917760,917999,5,10,10,3,127,159,4,768,879,5,1471,1471,5,1536,1541,1,1648,1648,5,1767,1768,5,1840,1866,5,2070,2073,5,2137,2139,5,2274,2274,1,2363,2363,7,2377,2380,7,2402,2403,5,2494,2494,5,2507,2508,7,2558,2558,5,2622,2624,7,2641,2641,5,2691,2691,7,2759,2760,5,2786,2787,5,2876,2876,5,2881,2884,5,2901,2902,5,3006,3006,5,3014,3016,7,3072,3072,5,3134,3136,5,3157,3158,5,3260,3260,5,3266,3266,5,3274,3275,7,3328,3329,5,3391,3392,7,3405,3405,5,3457,3457,5,3536,3537,7,3551,3551,5,3636,3642,5,3764,3772,5,3895,3895,5,3967,3967,7,3993,4028,5,4146,4151,5,4182,4183,7,4226,4226,5,4253,4253,5,4957,4959,5,5940,5940,7,6070,6070,7,6087,6088,7,6158,6158,4,6432,6434,5,6448,6449,7,6679,6680,5,6742,6742,5,6754,6754,5,6783,6783,5,6912,6915,5,6966,6970,5,6978,6978,5,7042,7042,7,7080,7081,5,7143,7143,7,7150,7150,7,7212,7219,5,7380,7392,5,7412,7412,5,8203,8203,4,8232,8232,4,8265,8265,14,8400,8412,5,8421,8432,5,8617,8618,14,9167,9167,14,9200,9200,14,9410,9410,14,9723,9726,14,9733,9733,14,9745,9745,14,9752,9752,14,9760,9760,14,9766,9766,14,9774,9774,14,9786,9786,14,9794,9794,14,9823,9823,14,9828,9828,14,9833,9850,14,9855,9855,14,9875,9875,14,9880,9880,14,9885,9887,14,9896,9897,14,9906,9916,14,9926,9927,14,9935,9935,14,9939,9939,14,9962,9962,14,9972,9972,14,9978,9978,14,9986,9986,14,9997,9997,14,10002,10002,14,10017,10017,14,10055,10055,14,10071,10071,14,10133,10135,14,10548,10549,14,11093,11093,14,12330,12333,5,12441,12442,5,42608,42610,5,43010,43010,5,43045,43046,5,43188,43203,7,43302,43309,5,43392,43394,5,43446,43449,5,43493,43493,5,43571,43572,7,43597,43597,7,43703,43704,5,43756,43757,5,44003,44004,7,44009,44010,7,44033,44059,12,44089,44115,12,44145,44171,12,44201,44227,12,44257,44283,12,44313,44339,12,44369,44395,12,44425,44451,12,44481,44507,12,44537,44563,12,44593,44619,12,44649,44675,12,44705,44731,12,44761,44787,12,44817,44843,12,44873,44899,12,44929,44955,12,44985,45011,12,45041,45067,12,45097,45123,12,45153,45179,12,45209,45235,12,45265,45291,12,45321,45347,12,45377,45403,12,45433,45459,12,45489,45515,12,45545,45571,12,45601,45627,12,45657,45683,12,45713,45739,12,45769,45795,12,45825,45851,12,45881,45907,12,45937,45963,12,45993,46019,12,46049,46075,12,46105,46131,12,46161,46187,12,46217,46243,12,46273,46299,12,46329,46355,12,46385,46411,12,46441,46467,12,46497,46523,12,46553,46579,12,46609,46635,12,46665,46691,12,46721,46747,12,46777,46803,12,46833,46859,12,46889,46915,12,46945,46971,12,47001,47027,12,47057,47083,12,47113,47139,12,47169,47195,12,47225,47251,12,47281,47307,12,47337,47363,12,47393,47419,12,47449,47475,12,47505,47531,12,47561,47587,12,47617,47643,12,47673,47699,12,47729,47755,12,47785,47811,12,47841,47867,12,47897,47923,12,47953,47979,12,48009,48035,12,48065,48091,12,48121,48147,12,48177,48203,12,48233,48259,12,48289,48315,12,48345,48371,12,48401,48427,12,48457,48483,12,48513,48539,12,48569,48595,12,48625,48651,12,48681,48707,12,48737,48763,12,48793,48819,12,48849,48875,12,48905,48931,12,48961,48987,12,49017,49043,12,49073,49099,12,49129,49155,12,49185,49211,12,49241,49267,12,49297,49323,12,49353,49379,12,49409,49435,12,49465,49491,12,49521,49547,12,49577,49603,12,49633,49659,12,49689,49715,12,49745,49771,12,49801,49827,12,49857,49883,12,49913,49939,12,49969,49995,12,50025,50051,12,50081,50107,12,50137,50163,12,50193,50219,12,50249,50275,12,50305,50331,12,50361,50387,12,50417,50443,12,50473,50499,12,50529,50555,12,50585,50611,12,50641,50667,12,50697,50723,12,50753,50779,12,50809,50835,12,50865,50891,12,50921,50947,12,50977,51003,12,51033,51059,12,51089,51115,12,51145,51171,12,51201,51227,12,51257,51283,12,51313,51339,12,51369,51395,12,51425,51451,12,51481,51507,12,51537,51563,12,51593,51619,12,51649,51675,12,51705,51731,12,51761,51787,12,51817,51843,12,51873,51899,12,51929,51955,12,51985,52011,12,52041,52067,12,52097,52123,12,52153,52179,12,52209,52235,12,52265,52291,12,52321,52347,12,52377,52403,12,52433,52459,12,52489,52515,12,52545,52571,12,52601,52627,12,52657,52683,12,52713,52739,12,52769,52795,12,52825,52851,12,52881,52907,12,52937,52963,12,52993,53019,12,53049,53075,12,53105,53131,12,53161,53187,12,53217,53243,12,53273,53299,12,53329,53355,12,53385,53411,12,53441,53467,12,53497,53523,12,53553,53579,12,53609,53635,12,53665,53691,12,53721,53747,12,53777,53803,12,53833,53859,12,53889,53915,12,53945,53971,12,54001,54027,12,54057,54083,12,54113,54139,12,54169,54195,12,54225,54251,12,54281,54307,12,54337,54363,12,54393,54419,12,54449,54475,12,54505,54531,12,54561,54587,12,54617,54643,12,54673,54699,12,54729,54755,12,54785,54811,12,54841,54867,12,54897,54923,12,54953,54979,12,55009,55035,12,55065,55091,12,55121,55147,12,55177,55203,12,65024,65039,5,65520,65528,4,66422,66426,5,68152,68154,5,69291,69292,5,69633,69633,5,69747,69748,5,69811,69814,5,69826,69826,5,69932,69932,7,70016,70017,5,70079,70080,7,70095,70095,5,70196,70196,5,70367,70367,5,70402,70403,7,70464,70464,5,70487,70487,5,70709,70711,7,70725,70725,7,70833,70834,7,70843,70844,7,70849,70849,7,71090,71093,5,71103,71104,5,71227,71228,7,71339,71339,5,71344,71349,5,71458,71461,5,71727,71735,5,71985,71989,7,71998,71998,5,72002,72002,7,72154,72155,5,72193,72202,5,72251,72254,5,72281,72283,5,72344,72345,5,72766,72766,7,72874,72880,5,72885,72886,5,73023,73029,5,73104,73105,5,73111,73111,5,92912,92916,5,94095,94098,5,113824,113827,4,119142,119142,7,119155,119162,4,119362,119364,5,121476,121476,5,122888,122904,5,123184,123190,5,125252,125258,5,127183,127183,14,127340,127343,14,127377,127386,14,127491,127503,14,127548,127551,14,127744,127756,14,127761,127761,14,127769,127769,14,127773,127774,14,127780,127788,14,127796,127797,14,127820,127823,14,127869,127869,14,127894,127895,14,127902,127903,14,127943,127943,14,127947,127950,14,127972,127972,14,127988,127988,14,127992,127994,14,128009,128011,14,128019,128019,14,128023,128041,14,128064,128064,14,128102,128107,14,128174,128181,14,128238,128238,14,128246,128247,14,128254,128254,14,128264,128264,14,128278,128299,14,128329,128330,14,128348,128359,14,128371,128377,14,128392,128393,14,128401,128404,14,128421,128421,14,128433,128434,14,128450,128452,14,128476,128478,14,128483,128483,14,128495,128495,14,128506,128506,14,128519,128520,14,128528,128528,14,128534,128534,14,128538,128538,14,128540,128542,14,128544,128549,14,128552,128555,14,128557,128557,14,128560,128563,14,128565,128565,14,128567,128576,14,128581,128591,14,128641,128642,14,128646,128646,14,128648,128648,14,128650,128651,14,128653,128653,14,128655,128655,14,128657,128659,14,128661,128661,14,128663,128663,14,128665,128666,14,128674,128674,14,128676,128677,14,128679,128685,14,128690,128690,14,128694,128694,14,128697,128702,14,128704,128704,14,128710,128714,14,128716,128716,14,128720,128720,14,128723,128724,14,128726,128727,14,128733,128735,14,128742,128744,14,128746,128746,14,128749,128751,14,128753,128754,14,128756,128758,14,128761,128761,14,128763,128764,14,128884,128895,14,128992,129003,14,129008,129008,14,129036,129039,14,129114,129119,14,129198,129279,14,129293,129295,14,129305,129310,14,129312,129319,14,129328,129328,14,129331,129338,14,129343,129343,14,129351,129355,14,129357,129359,14,129375,129387,14,129393,129393,14,129395,129398,14,129401,129401,14,129403,129403,14,129408,129412,14,129426,129431,14,129443,129444,14,129451,129453,14,129456,129465,14,129472,129472,14,129475,129482,14,129484,129484,14,129488,129510,14,129536,129647,14,129652,129652,14,129656,129658,14,129661,129663,14,129667,129670,14,129680,129685,14,129705,129708,14,129712,129718,14,129723,129727,14,129731,129733,14,129744,129750,14,129754,129759,14,129768,129775,14,129783,129791,14,917504,917504,4,917506,917535,4,917632,917759,4,918000,921599,4,0,9,4,11,12,4,14,31,4,169,169,14,174,174,14,1155,1159,5,1425,1469,5,1473,1474,5,1479,1479,5,1552,1562,5,1611,1631,5,1750,1756,5,1759,1764,5,1770,1773,5,1809,1809,5,1958,1968,5,2045,2045,5,2075,2083,5,2089,2093,5,2192,2193,1,2250,2273,5,2275,2306,5,2362,2362,5,2364,2364,5,2369,2376,5,2381,2381,5,2385,2391,5,2433,2433,5,2492,2492,5,2495,2496,7,2503,2504,7,2509,2509,5,2530,2531,5,2561,2562,5,2620,2620,5,2625,2626,5,2635,2637,5,2672,2673,5,2689,2690,5,2748,2748,5,2753,2757,5,2761,2761,7,2765,2765,5,2810,2815,5,2818,2819,7,2878,2878,5,2880,2880,7,2887,2888,7,2893,2893,5,2903,2903,5,2946,2946,5,3007,3007,7,3009,3010,7,3018,3020,7,3031,3031,5,3073,3075,7,3132,3132,5,3137,3140,7,3146,3149,5,3170,3171,5,3202,3203,7,3262,3262,7,3264,3265,7,3267,3268,7,3271,3272,7,3276,3277,5,3298,3299,5,3330,3331,7,3390,3390,5,3393,3396,5,3402,3404,7,3406,3406,1,3426,3427,5,3458,3459,7,3535,3535,5,3538,3540,5,3544,3550,7,3570,3571,7,3635,3635,7,3655,3662,5,3763,3763,7,3784,3789,5,3893,3893,5,3897,3897,5,3953,3966,5,3968,3972,5,3981,3991,5,4038,4038,5,4145,4145,7,4153,4154,5,4157,4158,5,4184,4185,5,4209,4212,5,4228,4228,7,4237,4237,5,4352,4447,8,4520,4607,10,5906,5908,5,5938,5939,5,5970,5971,5,6068,6069,5,6071,6077,5,6086,6086,5,6089,6099,5,6155,6157,5,6159,6159,5,6313,6313,5,6435,6438,7,6441,6443,7,6450,6450,5,6457,6459,5,6681,6682,7,6741,6741,7,6743,6743,7,6752,6752,5,6757,6764,5,6771,6780,5,6832,6845,5,6847,6862,5,6916,6916,7,6965,6965,5,6971,6971,7,6973,6977,7,6979,6980,7,7040,7041,5,7073,7073,7,7078,7079,7,7082,7082,7,7142,7142,5,7144,7145,5,7149,7149,5,7151,7153,5,7204,7211,7,7220,7221,7,7376,7378,5,7393,7393,7,7405,7405,5,7415,7415,7,7616,7679,5,8204,8204,5,8206,8207,4,8233,8233,4,8252,8252,14,8288,8292,4,8294,8303,4,8413,8416,5,8418,8420,5,8482,8482,14,8596,8601,14,8986,8987,14,9096,9096,14,9193,9196,14,9199,9199,14,9201,9202,14,9208,9210,14,9642,9643,14,9664,9664,14,9728,9729,14,9732,9732,14,9735,9741,14,9743,9744,14,9746,9746,14,9750,9751,14,9753,9756,14,9758,9759,14,9761,9761,14,9764,9765,14,9767,9769,14,9771,9773,14,9775,9775,14,9784,9785,14,9787,9791,14,9793,9793,14,9795,9799,14,9812,9822,14,9824,9824,14,9827,9827,14,9829,9830,14,9832,9832,14,9851,9851,14,9854,9854,14,9856,9861,14,9874,9874,14,9876,9876,14,9878,9879,14,9881,9881,14,9883,9884,14,9888,9889,14,9895,9895,14,9898,9899,14,9904,9905,14,9917,9918,14,9924,9925,14,9928,9928,14,9934,9934,14,9936,9936,14,9938,9938,14,9940,9940,14,9961,9961,14,9963,9967,14,9970,9971,14,9973,9973,14,9975,9977,14,9979,9980,14,9982,9985,14,9987,9988,14,9992,9996,14,9998,9998,14,10000,10001,14,10004,10004,14,10013,10013,14,10024,10024,14,10052,10052,14,10060,10060,14,10067,10069,14,10083,10083,14,10085,10087,14,10145,10145,14,10175,10175,14,11013,11015,14,11088,11088,14,11503,11505,5,11744,11775,5,12334,12335,5,12349,12349,14,12951,12951,14,42607,42607,5,42612,42621,5,42736,42737,5,43014,43014,5,43043,43044,7,43047,43047,7,43136,43137,7,43204,43205,5,43263,43263,5,43335,43345,5,43360,43388,8,43395,43395,7,43444,43445,7,43450,43451,7,43454,43456,7,43561,43566,5,43569,43570,5,43573,43574,5,43596,43596,5,43644,43644,5,43698,43700,5,43710,43711,5,43755,43755,7,43758,43759,7,43766,43766,5,44005,44005,5,44008,44008,5,44012,44012,7,44032,44032,11,44060,44060,11,44088,44088,11,44116,44116,11,44144,44144,11,44172,44172,11,44200,44200,11,44228,44228,11,44256,44256,11,44284,44284,11,44312,44312,11,44340,44340,11,44368,44368,11,44396,44396,11,44424,44424,11,44452,44452,11,44480,44480,11,44508,44508,11,44536,44536,11,44564,44564,11,44592,44592,11,44620,44620,11,44648,44648,11,44676,44676,11,44704,44704,11,44732,44732,11,44760,44760,11,44788,44788,11,44816,44816,11,44844,44844,11,44872,44872,11,44900,44900,11,44928,44928,11,44956,44956,11,44984,44984,11,45012,45012,11,45040,45040,11,45068,45068,11,45096,45096,11,45124,45124,11,45152,45152,11,45180,45180,11,45208,45208,11,45236,45236,11,45264,45264,11,45292,45292,11,45320,45320,11,45348,45348,11,45376,45376,11,45404,45404,11,45432,45432,11,45460,45460,11,45488,45488,11,45516,45516,11,45544,45544,11,45572,45572,11,45600,45600,11,45628,45628,11,45656,45656,11,45684,45684,11,45712,45712,11,45740,45740,11,45768,45768,11,45796,45796,11,45824,45824,11,45852,45852,11,45880,45880,11,45908,45908,11,45936,45936,11,45964,45964,11,45992,45992,11,46020,46020,11,46048,46048,11,46076,46076,11,46104,46104,11,46132,46132,11,46160,46160,11,46188,46188,11,46216,46216,11,46244,46244,11,46272,46272,11,46300,46300,11,46328,46328,11,46356,46356,11,46384,46384,11,46412,46412,11,46440,46440,11,46468,46468,11,46496,46496,11,46524,46524,11,46552,46552,11,46580,46580,11,46608,46608,11,46636,46636,11,46664,46664,11,46692,46692,11,46720,46720,11,46748,46748,11,46776,46776,11,46804,46804,11,46832,46832,11,46860,46860,11,46888,46888,11,46916,46916,11,46944,46944,11,46972,46972,11,47000,47000,11,47028,47028,11,47056,47056,11,47084,47084,11,47112,47112,11,47140,47140,11,47168,47168,11,47196,47196,11,47224,47224,11,47252,47252,11,47280,47280,11,47308,47308,11,47336,47336,11,47364,47364,11,47392,47392,11,47420,47420,11,47448,47448,11,47476,47476,11,47504,47504,11,47532,47532,11,47560,47560,11,47588,47588,11,47616,47616,11,47644,47644,11,47672,47672,11,47700,47700,11,47728,47728,11,47756,47756,11,47784,47784,11,47812,47812,11,47840,47840,11,47868,47868,11,47896,47896,11,47924,47924,11,47952,47952,11,47980,47980,11,48008,48008,11,48036,48036,11,48064,48064,11,48092,48092,11,48120,48120,11,48148,48148,11,48176,48176,11,48204,48204,11,48232,48232,11,48260,48260,11,48288,48288,11,48316,48316,11,48344,48344,11,48372,48372,11,48400,48400,11,48428,48428,11,48456,48456,11,48484,48484,11,48512,48512,11,48540,48540,11,48568,48568,11,48596,48596,11,48624,48624,11,48652,48652,11,48680,48680,11,48708,48708,11,48736,48736,11,48764,48764,11,48792,48792,11,48820,48820,11,48848,48848,11,48876,48876,11,48904,48904,11,48932,48932,11,48960,48960,11,48988,48988,11,49016,49016,11,49044,49044,11,49072,49072,11,49100,49100,11,49128,49128,11,49156,49156,11,49184,49184,11,49212,49212,11,49240,49240,11,49268,49268,11,49296,49296,11,49324,49324,11,49352,49352,11,49380,49380,11,49408,49408,11,49436,49436,11,49464,49464,11,49492,49492,11,49520,49520,11,49548,49548,11,49576,49576,11,49604,49604,11,49632,49632,11,49660,49660,11,49688,49688,11,49716,49716,11,49744,49744,11,49772,49772,11,49800,49800,11,49828,49828,11,49856,49856,11,49884,49884,11,49912,49912,11,49940,49940,11,49968,49968,11,49996,49996,11,50024,50024,11,50052,50052,11,50080,50080,11,50108,50108,11,50136,50136,11,50164,50164,11,50192,50192,11,50220,50220,11,50248,50248,11,50276,50276,11,50304,50304,11,50332,50332,11,50360,50360,11,50388,50388,11,50416,50416,11,50444,50444,11,50472,50472,11,50500,50500,11,50528,50528,11,50556,50556,11,50584,50584,11,50612,50612,11,50640,50640,11,50668,50668,11,50696,50696,11,50724,50724,11,50752,50752,11,50780,50780,11,50808,50808,11,50836,50836,11,50864,50864,11,50892,50892,11,50920,50920,11,50948,50948,11,50976,50976,11,51004,51004,11,51032,51032,11,51060,51060,11,51088,51088,11,51116,51116,11,51144,51144,11,51172,51172,11,51200,51200,11,51228,51228,11,51256,51256,11,51284,51284,11,51312,51312,11,51340,51340,11,51368,51368,11,51396,51396,11,51424,51424,11,51452,51452,11,51480,51480,11,51508,51508,11,51536,51536,11,51564,51564,11,51592,51592,11,51620,51620,11,51648,51648,11,51676,51676,11,51704,51704,11,51732,51732,11,51760,51760,11,51788,51788,11,51816,51816,11,51844,51844,11,51872,51872,11,51900,51900,11,51928,51928,11,51956,51956,11,51984,51984,11,52012,52012,11,52040,52040,11,52068,52068,11,52096,52096,11,52124,52124,11,52152,52152,11,52180,52180,11,52208,52208,11,52236,52236,11,52264,52264,11,52292,52292,11,52320,52320,11,52348,52348,11,52376,52376,11,52404,52404,11,52432,52432,11,52460,52460,11,52488,52488,11,52516,52516,11,52544,52544,11,52572,52572,11,52600,52600,11,52628,52628,11,52656,52656,11,52684,52684,11,52712,52712,11,52740,52740,11,52768,52768,11,52796,52796,11,52824,52824,11,52852,52852,11,52880,52880,11,52908,52908,11,52936,52936,11,52964,52964,11,52992,52992,11,53020,53020,11,53048,53048,11,53076,53076,11,53104,53104,11,53132,53132,11,53160,53160,11,53188,53188,11,53216,53216,11,53244,53244,11,53272,53272,11,53300,53300,11,53328,53328,11,53356,53356,11,53384,53384,11,53412,53412,11,53440,53440,11,53468,53468,11,53496,53496,11,53524,53524,11,53552,53552,11,53580,53580,11,53608,53608,11,53636,53636,11,53664,53664,11,53692,53692,11,53720,53720,11,53748,53748,11,53776,53776,11,53804,53804,11,53832,53832,11,53860,53860,11,53888,53888,11,53916,53916,11,53944,53944,11,53972,53972,11,54000,54000,11,54028,54028,11,54056,54056,11,54084,54084,11,54112,54112,11,54140,54140,11,54168,54168,11,54196,54196,11,54224,54224,11,54252,54252,11,54280,54280,11,54308,54308,11,54336,54336,11,54364,54364,11,54392,54392,11,54420,54420,11,54448,54448,11,54476,54476,11,54504,54504,11,54532,54532,11,54560,54560,11,54588,54588,11,54616,54616,11,54644,54644,11,54672,54672,11,54700,54700,11,54728,54728,11,54756,54756,11,54784,54784,11,54812,54812,11,54840,54840,11,54868,54868,11,54896,54896,11,54924,54924,11,54952,54952,11,54980,54980,11,55008,55008,11,55036,55036,11,55064,55064,11,55092,55092,11,55120,55120,11,55148,55148,11,55176,55176,11,55216,55238,9,64286,64286,5,65056,65071,5,65438,65439,5,65529,65531,4,66272,66272,5,68097,68099,5,68108,68111,5,68159,68159,5,68900,68903,5,69446,69456,5,69632,69632,7,69634,69634,7,69744,69744,5,69759,69761,5,69808,69810,7,69815,69816,7,69821,69821,1,69837,69837,1,69927,69931,5,69933,69940,5,70003,70003,5,70018,70018,7,70070,70078,5,70082,70083,1,70094,70094,7,70188,70190,7,70194,70195,7,70197,70197,7,70206,70206,5,70368,70370,7,70400,70401,5,70459,70460,5,70463,70463,7,70465,70468,7,70475,70477,7,70498,70499,7,70512,70516,5,70712,70719,5,70722,70724,5,70726,70726,5,70832,70832,5,70835,70840,5,70842,70842,5,70845,70845,5,70847,70848,5,70850,70851,5,71088,71089,7,71096,71099,7,71102,71102,7,71132,71133,5,71219,71226,5,71229,71229,5,71231,71232,5,71340,71340,7,71342,71343,7,71350,71350,7,71453,71455,5,71462,71462,7,71724,71726,7,71736,71736,7,71984,71984,5,71991,71992,7,71997,71997,7,71999,71999,1,72001,72001,1,72003,72003,5,72148,72151,5,72156,72159,7,72164,72164,7,72243,72248,5,72250,72250,1,72263,72263,5,72279,72280,7,72324,72329,1,72343,72343,7,72751,72751,7,72760,72765,5,72767,72767,5,72873,72873,7,72881,72881,7,72884,72884,7,73009,73014,5,73020,73021,5,73030,73030,1,73098,73102,7,73107,73108,7,73110,73110,7,73459,73460,5,78896,78904,4,92976,92982,5,94033,94087,7,94180,94180,5,113821,113822,5,118528,118573,5,119141,119141,5,119143,119145,5,119150,119154,5,119163,119170,5,119210,119213,5,121344,121398,5,121461,121461,5,121499,121503,5,122880,122886,5,122907,122913,5,122918,122922,5,123566,123566,5,125136,125142,5,126976,126979,14,126981,127182,14,127184,127231,14,127279,127279,14,127344,127345,14,127374,127374,14,127405,127461,14,127489,127490,14,127514,127514,14,127538,127546,14,127561,127567,14,127570,127743,14,127757,127758,14,127760,127760,14,127762,127762,14,127766,127768,14,127770,127770,14,127772,127772,14,127775,127776,14,127778,127779,14,127789,127791,14,127794,127795,14,127798,127798,14,127819,127819,14,127824,127824,14,127868,127868,14,127870,127871,14,127892,127893,14,127896,127896,14,127900,127901,14,127904,127940,14,127942,127942,14,127944,127944,14,127946,127946,14,127951,127955,14,127968,127971,14,127973,127984,14,127987,127987,14,127989,127989,14,127991,127991,14,127995,127999,5,128008,128008,14,128012,128014,14,128017,128018,14,128020,128020,14,128022,128022,14,128042,128042,14,128063,128063,14,128065,128065,14,128101,128101,14,128108,128109,14,128173,128173,14,128182,128183,14,128236,128237,14,128239,128239,14,128245,128245,14,128248,128248,14,128253,128253,14,128255,128258,14,128260,128263,14,128265,128265,14,128277,128277,14,128300,128301,14,128326,128328,14,128331,128334,14,128336,128347,14,128360,128366,14,128369,128370,14,128378,128378,14,128391,128391,14,128394,128397,14,128400,128400,14,128405,128406,14,128420,128420,14,128422,128423,14,128425,128432,14,128435,128443,14,128445,128449,14,128453,128464,14,128468,128475,14,128479,128480,14,128482,128482,14,128484,128487,14,128489,128494,14,128496,128498,14,128500,128505,14,128507,128511,14,128513,128518,14,128521,128525,14,128527,128527,14,128529,128529,14,128533,128533,14,128535,128535,14,128537,128537,14]");
}
const Pe = class Pe {
  static getInstance(t) {
    return Pe.cache.get(Array.from(t));
  }
  static getLocales() {
    return Pe._locales.value;
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
Pe.ambiguousCharacterData = new hi(() => JSON.parse('{"_common":[8232,32,8233,32,5760,32,8192,32,8193,32,8194,32,8195,32,8196,32,8197,32,8198,32,8200,32,8201,32,8202,32,8287,32,8199,32,8239,32,2042,95,65101,95,65102,95,65103,95,8208,45,8209,45,8210,45,65112,45,1748,45,8259,45,727,45,8722,45,10134,45,11450,45,1549,44,1643,44,8218,44,184,44,42233,44,894,59,2307,58,2691,58,1417,58,1795,58,1796,58,5868,58,65072,58,6147,58,6153,58,8282,58,1475,58,760,58,42889,58,8758,58,720,58,42237,58,451,33,11601,33,660,63,577,63,2429,63,5038,63,42731,63,119149,46,8228,46,1793,46,1794,46,42510,46,68176,46,1632,46,1776,46,42232,46,1373,96,65287,96,8219,96,8242,96,1370,96,1523,96,8175,96,65344,96,900,96,8189,96,8125,96,8127,96,8190,96,697,96,884,96,712,96,714,96,715,96,756,96,699,96,701,96,700,96,702,96,42892,96,1497,96,2036,96,2037,96,5194,96,5836,96,94033,96,94034,96,65339,91,10088,40,10098,40,12308,40,64830,40,65341,93,10089,41,10099,41,12309,41,64831,41,10100,123,119060,123,10101,125,65342,94,8270,42,1645,42,8727,42,66335,42,5941,47,8257,47,8725,47,8260,47,9585,47,10187,47,10744,47,119354,47,12755,47,12339,47,11462,47,20031,47,12035,47,65340,92,65128,92,8726,92,10189,92,10741,92,10745,92,119311,92,119355,92,12756,92,20022,92,12034,92,42872,38,708,94,710,94,5869,43,10133,43,66203,43,8249,60,10094,60,706,60,119350,60,5176,60,5810,60,5120,61,11840,61,12448,61,42239,61,8250,62,10095,62,707,62,119351,62,5171,62,94015,62,8275,126,732,126,8128,126,8764,126,65372,124,65293,45,120784,50,120794,50,120804,50,120814,50,120824,50,130034,50,42842,50,423,50,1000,50,42564,50,5311,50,42735,50,119302,51,120785,51,120795,51,120805,51,120815,51,120825,51,130035,51,42923,51,540,51,439,51,42858,51,11468,51,1248,51,94011,51,71882,51,120786,52,120796,52,120806,52,120816,52,120826,52,130036,52,5070,52,71855,52,120787,53,120797,53,120807,53,120817,53,120827,53,130037,53,444,53,71867,53,120788,54,120798,54,120808,54,120818,54,120828,54,130038,54,11474,54,5102,54,71893,54,119314,55,120789,55,120799,55,120809,55,120819,55,120829,55,130039,55,66770,55,71878,55,2819,56,2538,56,2666,56,125131,56,120790,56,120800,56,120810,56,120820,56,120830,56,130040,56,547,56,546,56,66330,56,2663,57,2920,57,2541,57,3437,57,120791,57,120801,57,120811,57,120821,57,120831,57,130041,57,42862,57,11466,57,71884,57,71852,57,71894,57,9082,97,65345,97,119834,97,119886,97,119938,97,119990,97,120042,97,120094,97,120146,97,120198,97,120250,97,120302,97,120354,97,120406,97,120458,97,593,97,945,97,120514,97,120572,97,120630,97,120688,97,120746,97,65313,65,119808,65,119860,65,119912,65,119964,65,120016,65,120068,65,120120,65,120172,65,120224,65,120276,65,120328,65,120380,65,120432,65,913,65,120488,65,120546,65,120604,65,120662,65,120720,65,5034,65,5573,65,42222,65,94016,65,66208,65,119835,98,119887,98,119939,98,119991,98,120043,98,120095,98,120147,98,120199,98,120251,98,120303,98,120355,98,120407,98,120459,98,388,98,5071,98,5234,98,5551,98,65314,66,8492,66,119809,66,119861,66,119913,66,120017,66,120069,66,120121,66,120173,66,120225,66,120277,66,120329,66,120381,66,120433,66,42932,66,914,66,120489,66,120547,66,120605,66,120663,66,120721,66,5108,66,5623,66,42192,66,66178,66,66209,66,66305,66,65347,99,8573,99,119836,99,119888,99,119940,99,119992,99,120044,99,120096,99,120148,99,120200,99,120252,99,120304,99,120356,99,120408,99,120460,99,7428,99,1010,99,11429,99,43951,99,66621,99,128844,67,71922,67,71913,67,65315,67,8557,67,8450,67,8493,67,119810,67,119862,67,119914,67,119966,67,120018,67,120174,67,120226,67,120278,67,120330,67,120382,67,120434,67,1017,67,11428,67,5087,67,42202,67,66210,67,66306,67,66581,67,66844,67,8574,100,8518,100,119837,100,119889,100,119941,100,119993,100,120045,100,120097,100,120149,100,120201,100,120253,100,120305,100,120357,100,120409,100,120461,100,1281,100,5095,100,5231,100,42194,100,8558,68,8517,68,119811,68,119863,68,119915,68,119967,68,120019,68,120071,68,120123,68,120175,68,120227,68,120279,68,120331,68,120383,68,120435,68,5024,68,5598,68,5610,68,42195,68,8494,101,65349,101,8495,101,8519,101,119838,101,119890,101,119942,101,120046,101,120098,101,120150,101,120202,101,120254,101,120306,101,120358,101,120410,101,120462,101,43826,101,1213,101,8959,69,65317,69,8496,69,119812,69,119864,69,119916,69,120020,69,120072,69,120124,69,120176,69,120228,69,120280,69,120332,69,120384,69,120436,69,917,69,120492,69,120550,69,120608,69,120666,69,120724,69,11577,69,5036,69,42224,69,71846,69,71854,69,66182,69,119839,102,119891,102,119943,102,119995,102,120047,102,120099,102,120151,102,120203,102,120255,102,120307,102,120359,102,120411,102,120463,102,43829,102,42905,102,383,102,7837,102,1412,102,119315,70,8497,70,119813,70,119865,70,119917,70,120021,70,120073,70,120125,70,120177,70,120229,70,120281,70,120333,70,120385,70,120437,70,42904,70,988,70,120778,70,5556,70,42205,70,71874,70,71842,70,66183,70,66213,70,66853,70,65351,103,8458,103,119840,103,119892,103,119944,103,120048,103,120100,103,120152,103,120204,103,120256,103,120308,103,120360,103,120412,103,120464,103,609,103,7555,103,397,103,1409,103,119814,71,119866,71,119918,71,119970,71,120022,71,120074,71,120126,71,120178,71,120230,71,120282,71,120334,71,120386,71,120438,71,1292,71,5056,71,5107,71,42198,71,65352,104,8462,104,119841,104,119945,104,119997,104,120049,104,120101,104,120153,104,120205,104,120257,104,120309,104,120361,104,120413,104,120465,104,1211,104,1392,104,5058,104,65320,72,8459,72,8460,72,8461,72,119815,72,119867,72,119919,72,120023,72,120179,72,120231,72,120283,72,120335,72,120387,72,120439,72,919,72,120494,72,120552,72,120610,72,120668,72,120726,72,11406,72,5051,72,5500,72,42215,72,66255,72,731,105,9075,105,65353,105,8560,105,8505,105,8520,105,119842,105,119894,105,119946,105,119998,105,120050,105,120102,105,120154,105,120206,105,120258,105,120310,105,120362,105,120414,105,120466,105,120484,105,618,105,617,105,953,105,8126,105,890,105,120522,105,120580,105,120638,105,120696,105,120754,105,1110,105,42567,105,1231,105,43893,105,5029,105,71875,105,65354,106,8521,106,119843,106,119895,106,119947,106,119999,106,120051,106,120103,106,120155,106,120207,106,120259,106,120311,106,120363,106,120415,106,120467,106,1011,106,1112,106,65322,74,119817,74,119869,74,119921,74,119973,74,120025,74,120077,74,120129,74,120181,74,120233,74,120285,74,120337,74,120389,74,120441,74,42930,74,895,74,1032,74,5035,74,5261,74,42201,74,119844,107,119896,107,119948,107,120000,107,120052,107,120104,107,120156,107,120208,107,120260,107,120312,107,120364,107,120416,107,120468,107,8490,75,65323,75,119818,75,119870,75,119922,75,119974,75,120026,75,120078,75,120130,75,120182,75,120234,75,120286,75,120338,75,120390,75,120442,75,922,75,120497,75,120555,75,120613,75,120671,75,120729,75,11412,75,5094,75,5845,75,42199,75,66840,75,1472,108,8739,73,9213,73,65512,73,1633,108,1777,73,66336,108,125127,108,120783,73,120793,73,120803,73,120813,73,120823,73,130033,73,65321,73,8544,73,8464,73,8465,73,119816,73,119868,73,119920,73,120024,73,120128,73,120180,73,120232,73,120284,73,120336,73,120388,73,120440,73,65356,108,8572,73,8467,108,119845,108,119897,108,119949,108,120001,108,120053,108,120105,73,120157,73,120209,73,120261,73,120313,73,120365,73,120417,73,120469,73,448,73,120496,73,120554,73,120612,73,120670,73,120728,73,11410,73,1030,73,1216,73,1493,108,1503,108,1575,108,126464,108,126592,108,65166,108,65165,108,1994,108,11599,73,5825,73,42226,73,93992,73,66186,124,66313,124,119338,76,8556,76,8466,76,119819,76,119871,76,119923,76,120027,76,120079,76,120131,76,120183,76,120235,76,120287,76,120339,76,120391,76,120443,76,11472,76,5086,76,5290,76,42209,76,93974,76,71843,76,71858,76,66587,76,66854,76,65325,77,8559,77,8499,77,119820,77,119872,77,119924,77,120028,77,120080,77,120132,77,120184,77,120236,77,120288,77,120340,77,120392,77,120444,77,924,77,120499,77,120557,77,120615,77,120673,77,120731,77,1018,77,11416,77,5047,77,5616,77,5846,77,42207,77,66224,77,66321,77,119847,110,119899,110,119951,110,120003,110,120055,110,120107,110,120159,110,120211,110,120263,110,120315,110,120367,110,120419,110,120471,110,1400,110,1404,110,65326,78,8469,78,119821,78,119873,78,119925,78,119977,78,120029,78,120081,78,120185,78,120237,78,120289,78,120341,78,120393,78,120445,78,925,78,120500,78,120558,78,120616,78,120674,78,120732,78,11418,78,42208,78,66835,78,3074,111,3202,111,3330,111,3458,111,2406,111,2662,111,2790,111,3046,111,3174,111,3302,111,3430,111,3664,111,3792,111,4160,111,1637,111,1781,111,65359,111,8500,111,119848,111,119900,111,119952,111,120056,111,120108,111,120160,111,120212,111,120264,111,120316,111,120368,111,120420,111,120472,111,7439,111,7441,111,43837,111,959,111,120528,111,120586,111,120644,111,120702,111,120760,111,963,111,120532,111,120590,111,120648,111,120706,111,120764,111,11423,111,4351,111,1413,111,1505,111,1607,111,126500,111,126564,111,126596,111,65259,111,65260,111,65258,111,65257,111,1726,111,64428,111,64429,111,64427,111,64426,111,1729,111,64424,111,64425,111,64423,111,64422,111,1749,111,3360,111,4125,111,66794,111,71880,111,71895,111,66604,111,1984,79,2534,79,2918,79,12295,79,70864,79,71904,79,120782,79,120792,79,120802,79,120812,79,120822,79,130032,79,65327,79,119822,79,119874,79,119926,79,119978,79,120030,79,120082,79,120134,79,120186,79,120238,79,120290,79,120342,79,120394,79,120446,79,927,79,120502,79,120560,79,120618,79,120676,79,120734,79,11422,79,1365,79,11604,79,4816,79,2848,79,66754,79,42227,79,71861,79,66194,79,66219,79,66564,79,66838,79,9076,112,65360,112,119849,112,119901,112,119953,112,120005,112,120057,112,120109,112,120161,112,120213,112,120265,112,120317,112,120369,112,120421,112,120473,112,961,112,120530,112,120544,112,120588,112,120602,112,120646,112,120660,112,120704,112,120718,112,120762,112,120776,112,11427,112,65328,80,8473,80,119823,80,119875,80,119927,80,119979,80,120031,80,120083,80,120187,80,120239,80,120291,80,120343,80,120395,80,120447,80,929,80,120504,80,120562,80,120620,80,120678,80,120736,80,11426,80,5090,80,5229,80,42193,80,66197,80,119850,113,119902,113,119954,113,120006,113,120058,113,120110,113,120162,113,120214,113,120266,113,120318,113,120370,113,120422,113,120474,113,1307,113,1379,113,1382,113,8474,81,119824,81,119876,81,119928,81,119980,81,120032,81,120084,81,120188,81,120240,81,120292,81,120344,81,120396,81,120448,81,11605,81,119851,114,119903,114,119955,114,120007,114,120059,114,120111,114,120163,114,120215,114,120267,114,120319,114,120371,114,120423,114,120475,114,43847,114,43848,114,7462,114,11397,114,43905,114,119318,82,8475,82,8476,82,8477,82,119825,82,119877,82,119929,82,120033,82,120189,82,120241,82,120293,82,120345,82,120397,82,120449,82,422,82,5025,82,5074,82,66740,82,5511,82,42211,82,94005,82,65363,115,119852,115,119904,115,119956,115,120008,115,120060,115,120112,115,120164,115,120216,115,120268,115,120320,115,120372,115,120424,115,120476,115,42801,115,445,115,1109,115,43946,115,71873,115,66632,115,65331,83,119826,83,119878,83,119930,83,119982,83,120034,83,120086,83,120138,83,120190,83,120242,83,120294,83,120346,83,120398,83,120450,83,1029,83,1359,83,5077,83,5082,83,42210,83,94010,83,66198,83,66592,83,119853,116,119905,116,119957,116,120009,116,120061,116,120113,116,120165,116,120217,116,120269,116,120321,116,120373,116,120425,116,120477,116,8868,84,10201,84,128872,84,65332,84,119827,84,119879,84,119931,84,119983,84,120035,84,120087,84,120139,84,120191,84,120243,84,120295,84,120347,84,120399,84,120451,84,932,84,120507,84,120565,84,120623,84,120681,84,120739,84,11430,84,5026,84,42196,84,93962,84,71868,84,66199,84,66225,84,66325,84,119854,117,119906,117,119958,117,120010,117,120062,117,120114,117,120166,117,120218,117,120270,117,120322,117,120374,117,120426,117,120478,117,42911,117,7452,117,43854,117,43858,117,651,117,965,117,120534,117,120592,117,120650,117,120708,117,120766,117,1405,117,66806,117,71896,117,8746,85,8899,85,119828,85,119880,85,119932,85,119984,85,120036,85,120088,85,120140,85,120192,85,120244,85,120296,85,120348,85,120400,85,120452,85,1357,85,4608,85,66766,85,5196,85,42228,85,94018,85,71864,85,8744,118,8897,118,65366,118,8564,118,119855,118,119907,118,119959,118,120011,118,120063,118,120115,118,120167,118,120219,118,120271,118,120323,118,120375,118,120427,118,120479,118,7456,118,957,118,120526,118,120584,118,120642,118,120700,118,120758,118,1141,118,1496,118,71430,118,43945,118,71872,118,119309,86,1639,86,1783,86,8548,86,119829,86,119881,86,119933,86,119985,86,120037,86,120089,86,120141,86,120193,86,120245,86,120297,86,120349,86,120401,86,120453,86,1140,86,11576,86,5081,86,5167,86,42719,86,42214,86,93960,86,71840,86,66845,86,623,119,119856,119,119908,119,119960,119,120012,119,120064,119,120116,119,120168,119,120220,119,120272,119,120324,119,120376,119,120428,119,120480,119,7457,119,1121,119,1309,119,1377,119,71434,119,71438,119,71439,119,43907,119,71919,87,71910,87,119830,87,119882,87,119934,87,119986,87,120038,87,120090,87,120142,87,120194,87,120246,87,120298,87,120350,87,120402,87,120454,87,1308,87,5043,87,5076,87,42218,87,5742,120,10539,120,10540,120,10799,120,65368,120,8569,120,119857,120,119909,120,119961,120,120013,120,120065,120,120117,120,120169,120,120221,120,120273,120,120325,120,120377,120,120429,120,120481,120,5441,120,5501,120,5741,88,9587,88,66338,88,71916,88,65336,88,8553,88,119831,88,119883,88,119935,88,119987,88,120039,88,120091,88,120143,88,120195,88,120247,88,120299,88,120351,88,120403,88,120455,88,42931,88,935,88,120510,88,120568,88,120626,88,120684,88,120742,88,11436,88,11613,88,5815,88,42219,88,66192,88,66228,88,66327,88,66855,88,611,121,7564,121,65369,121,119858,121,119910,121,119962,121,120014,121,120066,121,120118,121,120170,121,120222,121,120274,121,120326,121,120378,121,120430,121,120482,121,655,121,7935,121,43866,121,947,121,8509,121,120516,121,120574,121,120632,121,120690,121,120748,121,1199,121,4327,121,71900,121,65337,89,119832,89,119884,89,119936,89,119988,89,120040,89,120092,89,120144,89,120196,89,120248,89,120300,89,120352,89,120404,89,120456,89,933,89,978,89,120508,89,120566,89,120624,89,120682,89,120740,89,11432,89,1198,89,5033,89,5053,89,42220,89,94019,89,71844,89,66226,89,119859,122,119911,122,119963,122,120015,122,120067,122,120119,122,120171,122,120223,122,120275,122,120327,122,120379,122,120431,122,120483,122,7458,122,43923,122,71876,122,66293,90,71909,90,65338,90,8484,90,8488,90,119833,90,119885,90,119937,90,119989,90,120041,90,120197,90,120249,90,120301,90,120353,90,120405,90,120457,90,918,90,120493,90,120551,90,120609,90,120667,90,120725,90,5059,90,42204,90,71849,90,65282,34,65284,36,65285,37,65286,38,65290,42,65291,43,65294,46,65295,47,65296,48,65297,49,65298,50,65299,51,65300,52,65301,53,65302,54,65303,55,65304,56,65305,57,65308,60,65309,61,65310,62,65312,64,65316,68,65318,70,65319,71,65324,76,65329,81,65330,82,65333,85,65334,86,65335,87,65343,95,65346,98,65348,100,65350,102,65355,107,65357,109,65358,110,65361,113,65362,114,65364,116,65365,117,65367,119,65370,122,65371,123,65373,125,119846,109],"_default":[160,32,8211,45,65374,126,65306,58,65281,33,8216,96,8217,96,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],"cs":[65374,126,65306,58,65281,33,8216,96,8217,96,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],"de":[65374,126,65306,58,65281,33,8216,96,8217,96,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],"es":[8211,45,65374,126,65306,58,65281,33,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],"fr":[65374,126,65306,58,65281,33,8216,96,8245,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],"it":[160,32,8211,45,65374,126,65306,58,65281,33,8216,96,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],"ja":[8211,45,65306,58,65281,33,8216,96,8217,96,8245,96,180,96,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65292,44,65307,59],"ko":[8211,45,65374,126,65306,58,65281,33,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],"pl":[65374,126,65306,58,65281,33,8216,96,8217,96,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],"pt-BR":[65374,126,65306,58,65281,33,8216,96,8217,96,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],"qps-ploc":[160,32,8211,45,65374,126,65306,58,65281,33,8216,96,8217,96,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],"ru":[65374,126,65306,58,65281,33,8216,96,8217,96,8245,96,180,96,12494,47,305,105,921,73,1009,112,215,120,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],"tr":[160,32,8211,45,65374,126,65306,58,65281,33,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65288,40,65289,41,65292,44,65307,59,65311,63],"zh-hans":[65374,126,65306,58,65281,33,8245,96,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65288,40,65289,41],"zh-hant":[8211,45,65374,126,180,96,12494,47,1047,51,1073,54,1072,97,1040,65,1068,98,1042,66,1089,99,1057,67,1077,101,1045,69,1053,72,305,105,1050,75,921,73,1052,77,1086,111,1054,79,1009,112,1088,112,1056,80,1075,114,1058,84,215,120,1093,120,1061,88,1091,121,1059,89,65283,35,65307,59]}')), Pe.cache = new Fo({ getCacheKey: JSON.stringify }, (t) => {
  function n(h) {
    const c = /* @__PURE__ */ new Map();
    for (let d = 0; d < h.length; d += 2)
      c.set(h[d], h[d + 1]);
    return c;
  }
  function r(h, c) {
    const d = new Map(h);
    for (const [m, g] of c)
      d.set(m, g);
    return d;
  }
  function i(h, c) {
    if (!h)
      return c;
    const d = /* @__PURE__ */ new Map();
    for (const [m, g] of h)
      c.has(m) && d.set(m, g);
    return d;
  }
  const s = Pe.ambiguousCharacterData.value;
  let a = t.filter((h) => !h.startsWith("_") && h in s);
  a.length === 0 && (a = ["_default"]);
  let l;
  for (const h of a) {
    const c = n(s[h]);
    l = i(l, c);
  }
  const o = n(s._common), u = r(o, l);
  return new Pe(u);
}), Pe._locales = new hi(() => Object.keys(Pe.ambiguousCharacterData.value).filter((t) => !t.startsWith("_")));
let en = Pe;
const St = class St {
  static getRawData() {
    return JSON.parse("[9,10,11,12,13,32,127,160,173,847,1564,4447,4448,6068,6069,6155,6156,6157,6158,7355,7356,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8203,8204,8205,8206,8207,8234,8235,8236,8237,8238,8239,8287,8288,8289,8290,8291,8292,8293,8294,8295,8296,8297,8298,8299,8300,8301,8302,8303,10240,12288,12644,65024,65025,65026,65027,65028,65029,65030,65031,65032,65033,65034,65035,65036,65037,65038,65039,65279,65440,65520,65521,65522,65523,65524,65525,65526,65527,65528,65532,78844,119155,119156,119157,119158,119159,119160,119161,119162,917504,917505,917506,917507,917508,917509,917510,917511,917512,917513,917514,917515,917516,917517,917518,917519,917520,917521,917522,917523,917524,917525,917526,917527,917528,917529,917530,917531,917532,917533,917534,917535,917536,917537,917538,917539,917540,917541,917542,917543,917544,917545,917546,917547,917548,917549,917550,917551,917552,917553,917554,917555,917556,917557,917558,917559,917560,917561,917562,917563,917564,917565,917566,917567,917568,917569,917570,917571,917572,917573,917574,917575,917576,917577,917578,917579,917580,917581,917582,917583,917584,917585,917586,917587,917588,917589,917590,917591,917592,917593,917594,917595,917596,917597,917598,917599,917600,917601,917602,917603,917604,917605,917606,917607,917608,917609,917610,917611,917612,917613,917614,917615,917616,917617,917618,917619,917620,917621,917622,917623,917624,917625,917626,917627,917628,917629,917630,917631,917760,917761,917762,917763,917764,917765,917766,917767,917768,917769,917770,917771,917772,917773,917774,917775,917776,917777,917778,917779,917780,917781,917782,917783,917784,917785,917786,917787,917788,917789,917790,917791,917792,917793,917794,917795,917796,917797,917798,917799,917800,917801,917802,917803,917804,917805,917806,917807,917808,917809,917810,917811,917812,917813,917814,917815,917816,917817,917818,917819,917820,917821,917822,917823,917824,917825,917826,917827,917828,917829,917830,917831,917832,917833,917834,917835,917836,917837,917838,917839,917840,917841,917842,917843,917844,917845,917846,917847,917848,917849,917850,917851,917852,917853,917854,917855,917856,917857,917858,917859,917860,917861,917862,917863,917864,917865,917866,917867,917868,917869,917870,917871,917872,917873,917874,917875,917876,917877,917878,917879,917880,917881,917882,917883,917884,917885,917886,917887,917888,917889,917890,917891,917892,917893,917894,917895,917896,917897,917898,917899,917900,917901,917902,917903,917904,917905,917906,917907,917908,917909,917910,917911,917912,917913,917914,917915,917916,917917,917918,917919,917920,917921,917922,917923,917924,917925,917926,917927,917928,917929,917930,917931,917932,917933,917934,917935,917936,917937,917938,917939,917940,917941,917942,917943,917944,917945,917946,917947,917948,917949,917950,917951,917952,917953,917954,917955,917956,917957,917958,917959,917960,917961,917962,917963,917964,917965,917966,917967,917968,917969,917970,917971,917972,917973,917974,917975,917976,917977,917978,917979,917980,917981,917982,917983,917984,917985,917986,917987,917988,917989,917990,917991,917992,917993,917994,917995,917996,917997,917998,917999]");
  }
  static getData() {
    return this._data || (this._data = new Set(St.getRawData())), this._data;
  }
  static isInvisibleCharacter(t) {
    return St.getData().has(t);
  }
  static get codePoints() {
    return St.getData();
  }
};
St._data = void 0;
let zt = St, Rt;
const Yn = globalThis.vscode;
var pa;
if (typeof Yn < "u" && typeof Yn.process < "u") {
  const e = Yn.process;
  Rt = {
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
  typeof process < "u" && typeof ((pa = process == null ? void 0 : process.versions) == null ? void 0 : pa.node) == "string" ? Rt = {
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
  } : Rt = {
    // Supported
    get platform() {
      return Kt ? "win32" : ko ? "darwin" : "linux";
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
const Sn = Rt.cwd, Wo = Rt.env, Ho = Rt.platform, zo = 65, Go = 97, Jo = 90, Xo = 122, tt = 46, le = 47, ge = 92, ze = 58, Qo = 63;
class _a extends Error {
  constructor(t, n, r) {
    let i;
    typeof n == "string" && n.indexOf("not ") === 0 ? (i = "must not be", n = n.replace(/^not /, "")) : i = "must be";
    const s = t.indexOf(".") !== -1 ? "property" : "argument";
    let a = `The "${t}" ${s} ${i} of type ${n}`;
    a += `. Received type ${typeof r}`, super(a), this.code = "ERR_INVALID_ARG_TYPE";
  }
}
function Yo(e, t) {
  if (e === null || typeof e != "object")
    throw new _a(t, "Object", e);
}
function K(e, t) {
  if (typeof e != "string")
    throw new _a(t, "string", e);
}
const We = Ho === "win32";
function B(e) {
  return e === le || e === ge;
}
function dr(e) {
  return e === le;
}
function Ge(e) {
  return e >= zo && e <= Jo || e >= Go && e <= Xo;
}
function An(e, t, n, r) {
  let i = "", s = 0, a = -1, l = 0, o = 0;
  for (let u = 0; u <= e.length; ++u) {
    if (u < e.length)
      o = e.charCodeAt(u);
    else {
      if (r(o))
        break;
      o = le;
    }
    if (r(o)) {
      if (!(a === u - 1 || l === 1))
        if (l === 2) {
          if (i.length < 2 || s !== 2 || i.charCodeAt(i.length - 1) !== tt || i.charCodeAt(i.length - 2) !== tt) {
            if (i.length > 2) {
              const h = i.lastIndexOf(n);
              h === -1 ? (i = "", s = 0) : (i = i.slice(0, h), s = i.length - 1 - i.lastIndexOf(n)), a = u, l = 0;
              continue;
            } else if (i.length !== 0) {
              i = "", s = 0, a = u, l = 0;
              continue;
            }
          }
          t && (i += i.length > 0 ? `${n}..` : "..", s = 2);
        } else
          i.length > 0 ? i += `${n}${e.slice(a + 1, u)}` : i = e.slice(a + 1, u), s = u - a - 1;
      a = u, l = 0;
    } else
      o === tt && l !== -1 ? ++l : l = -1;
  }
  return i;
}
function Zo(e) {
  return e ? `${e[0] === "." ? "" : "."}${e}` : "";
}
function La(e, t) {
  Yo(t, "pathObject");
  const n = t.dir || t.root, r = t.base || `${t.name || ""}${Zo(t.ext)}`;
  return n ? n === t.root ? `${n}${r}` : `${n}${e}${r}` : r;
}
const he = {
  // path.resolve([from ...], to)
  resolve(...e) {
    let t = "", n = "", r = !1;
    for (let i = e.length - 1; i >= -1; i--) {
      let s;
      if (i >= 0) {
        if (s = e[i], K(s, `paths[${i}]`), s.length === 0)
          continue;
      } else
        t.length === 0 ? s = Sn() : (s = Wo[`=${t}`] || Sn(), (s === void 0 || s.slice(0, 2).toLowerCase() !== t.toLowerCase() && s.charCodeAt(2) === ge) && (s = `${t}\\`));
      const a = s.length;
      let l = 0, o = "", u = !1;
      const h = s.charCodeAt(0);
      if (a === 1)
        B(h) && (l = 1, u = !0);
      else if (B(h))
        if (u = !0, B(s.charCodeAt(1))) {
          let c = 2, d = c;
          for (; c < a && !B(s.charCodeAt(c)); )
            c++;
          if (c < a && c !== d) {
            const m = s.slice(d, c);
            for (d = c; c < a && B(s.charCodeAt(c)); )
              c++;
            if (c < a && c !== d) {
              for (d = c; c < a && !B(s.charCodeAt(c)); )
                c++;
              (c === a || c !== d) && (o = `\\\\${m}\\${s.slice(d, c)}`, l = c);
            }
          }
        } else
          l = 1;
      else
        Ge(h) && s.charCodeAt(1) === ze && (o = s.slice(0, 2), l = 2, a > 2 && B(s.charCodeAt(2)) && (u = !0, l = 3));
      if (o.length > 0)
        if (t.length > 0) {
          if (o.toLowerCase() !== t.toLowerCase())
            continue;
        } else
          t = o;
      if (r) {
        if (t.length > 0)
          break;
      } else if (n = `${s.slice(l)}\\${n}`, r = u, u && t.length > 0)
        break;
    }
    return n = An(n, !r, "\\", B), r ? `${t}\\${n}` : `${t}${n}` || ".";
  },
  normalize(e) {
    K(e, "path");
    const t = e.length;
    if (t === 0)
      return ".";
    let n = 0, r, i = !1;
    const s = e.charCodeAt(0);
    if (t === 1)
      return dr(s) ? "\\" : e;
    if (B(s))
      if (i = !0, B(e.charCodeAt(1))) {
        let l = 2, o = l;
        for (; l < t && !B(e.charCodeAt(l)); )
          l++;
        if (l < t && l !== o) {
          const u = e.slice(o, l);
          for (o = l; l < t && B(e.charCodeAt(l)); )
            l++;
          if (l < t && l !== o) {
            for (o = l; l < t && !B(e.charCodeAt(l)); )
              l++;
            if (l === t)
              return `\\\\${u}\\${e.slice(o)}\\`;
            l !== o && (r = `\\\\${u}\\${e.slice(o, l)}`, n = l);
          }
        }
      } else
        n = 1;
    else
      Ge(s) && e.charCodeAt(1) === ze && (r = e.slice(0, 2), n = 2, t > 2 && B(e.charCodeAt(2)) && (i = !0, n = 3));
    let a = n < t ? An(e.slice(n), !i, "\\", B) : "";
    return a.length === 0 && !i && (a = "."), a.length > 0 && B(e.charCodeAt(t - 1)) && (a += "\\"), r === void 0 ? i ? `\\${a}` : a : i ? `${r}\\${a}` : `${r}${a}`;
  },
  isAbsolute(e) {
    K(e, "path");
    const t = e.length;
    if (t === 0)
      return !1;
    const n = e.charCodeAt(0);
    return B(n) || // Possible device root
    t > 2 && Ge(n) && e.charCodeAt(1) === ze && B(e.charCodeAt(2));
  },
  join(...e) {
    if (e.length === 0)
      return ".";
    let t, n;
    for (let s = 0; s < e.length; ++s) {
      const a = e[s];
      K(a, "path"), a.length > 0 && (t === void 0 ? t = n = a : t += `\\${a}`);
    }
    if (t === void 0)
      return ".";
    let r = !0, i = 0;
    if (typeof n == "string" && B(n.charCodeAt(0))) {
      ++i;
      const s = n.length;
      s > 1 && B(n.charCodeAt(1)) && (++i, s > 2 && (B(n.charCodeAt(2)) ? ++i : r = !1));
    }
    if (r) {
      for (; i < t.length && B(t.charCodeAt(i)); )
        i++;
      i >= 2 && (t = `\\${t.slice(i)}`);
    }
    return he.normalize(t);
  },
  // It will solve the relative path from `from` to `to`, for instance:
  //  from = 'C:\\orandea\\test\\aaa'
  //  to = 'C:\\orandea\\impl\\bbb'
  // The output of the function should be: '..\\..\\impl\\bbb'
  relative(e, t) {
    if (K(e, "from"), K(t, "to"), e === t)
      return "";
    const n = he.resolve(e), r = he.resolve(t);
    if (n === r || (e = n.toLowerCase(), t = r.toLowerCase(), e === t))
      return "";
    let i = 0;
    for (; i < e.length && e.charCodeAt(i) === ge; )
      i++;
    let s = e.length;
    for (; s - 1 > i && e.charCodeAt(s - 1) === ge; )
      s--;
    const a = s - i;
    let l = 0;
    for (; l < t.length && t.charCodeAt(l) === ge; )
      l++;
    let o = t.length;
    for (; o - 1 > l && t.charCodeAt(o - 1) === ge; )
      o--;
    const u = o - l, h = a < u ? a : u;
    let c = -1, d = 0;
    for (; d < h; d++) {
      const g = e.charCodeAt(i + d);
      if (g !== t.charCodeAt(l + d))
        break;
      g === ge && (c = d);
    }
    if (d !== h) {
      if (c === -1)
        return r;
    } else {
      if (u > h) {
        if (t.charCodeAt(l + d) === ge)
          return r.slice(l + d + 1);
        if (d === 2)
          return r.slice(l + d);
      }
      a > h && (e.charCodeAt(i + d) === ge ? c = d : d === 2 && (c = 3)), c === -1 && (c = 0);
    }
    let m = "";
    for (d = i + c + 1; d <= s; ++d)
      (d === s || e.charCodeAt(d) === ge) && (m += m.length === 0 ? ".." : "\\..");
    return l += c, m.length > 0 ? `${m}${r.slice(l, o)}` : (r.charCodeAt(l) === ge && ++l, r.slice(l, o));
  },
  toNamespacedPath(e) {
    if (typeof e != "string" || e.length === 0)
      return e;
    const t = he.resolve(e);
    if (t.length <= 2)
      return e;
    if (t.charCodeAt(0) === ge) {
      if (t.charCodeAt(1) === ge) {
        const n = t.charCodeAt(2);
        if (n !== Qo && n !== tt)
          return `\\\\?\\UNC\\${t.slice(2)}`;
      }
    } else if (Ge(t.charCodeAt(0)) && t.charCodeAt(1) === ze && t.charCodeAt(2) === ge)
      return `\\\\?\\${t}`;
    return e;
  },
  dirname(e) {
    K(e, "path");
    const t = e.length;
    if (t === 0)
      return ".";
    let n = -1, r = 0;
    const i = e.charCodeAt(0);
    if (t === 1)
      return B(i) ? e : ".";
    if (B(i)) {
      if (n = r = 1, B(e.charCodeAt(1))) {
        let l = 2, o = l;
        for (; l < t && !B(e.charCodeAt(l)); )
          l++;
        if (l < t && l !== o) {
          for (o = l; l < t && B(e.charCodeAt(l)); )
            l++;
          if (l < t && l !== o) {
            for (o = l; l < t && !B(e.charCodeAt(l)); )
              l++;
            if (l === t)
              return e;
            l !== o && (n = r = l + 1);
          }
        }
      }
    } else
      Ge(i) && e.charCodeAt(1) === ze && (n = t > 2 && B(e.charCodeAt(2)) ? 3 : 2, r = n);
    let s = -1, a = !0;
    for (let l = t - 1; l >= r; --l)
      if (B(e.charCodeAt(l))) {
        if (!a) {
          s = l;
          break;
        }
      } else
        a = !1;
    if (s === -1) {
      if (n === -1)
        return ".";
      s = n;
    }
    return e.slice(0, s);
  },
  basename(e, t) {
    t !== void 0 && K(t, "suffix"), K(e, "path");
    let n = 0, r = -1, i = !0, s;
    if (e.length >= 2 && Ge(e.charCodeAt(0)) && e.charCodeAt(1) === ze && (n = 2), t !== void 0 && t.length > 0 && t.length <= e.length) {
      if (t === e)
        return "";
      let a = t.length - 1, l = -1;
      for (s = e.length - 1; s >= n; --s) {
        const o = e.charCodeAt(s);
        if (B(o)) {
          if (!i) {
            n = s + 1;
            break;
          }
        } else
          l === -1 && (i = !1, l = s + 1), a >= 0 && (o === t.charCodeAt(a) ? --a === -1 && (r = s) : (a = -1, r = l));
      }
      return n === r ? r = l : r === -1 && (r = e.length), e.slice(n, r);
    }
    for (s = e.length - 1; s >= n; --s)
      if (B(e.charCodeAt(s))) {
        if (!i) {
          n = s + 1;
          break;
        }
      } else
        r === -1 && (i = !1, r = s + 1);
    return r === -1 ? "" : e.slice(n, r);
  },
  extname(e) {
    K(e, "path");
    let t = 0, n = -1, r = 0, i = -1, s = !0, a = 0;
    e.length >= 2 && e.charCodeAt(1) === ze && Ge(e.charCodeAt(0)) && (t = r = 2);
    for (let l = e.length - 1; l >= t; --l) {
      const o = e.charCodeAt(l);
      if (B(o)) {
        if (!s) {
          r = l + 1;
          break;
        }
        continue;
      }
      i === -1 && (s = !1, i = l + 1), o === tt ? n === -1 ? n = l : a !== 1 && (a = 1) : n !== -1 && (a = -1);
    }
    return n === -1 || i === -1 || // We saw a non-dot character immediately before the dot
    a === 0 || // The (right-most) trimmed path component is exactly '..'
    a === 1 && n === i - 1 && n === r + 1 ? "" : e.slice(n, i);
  },
  format: La.bind(null, "\\"),
  parse(e) {
    K(e, "path");
    const t = { root: "", dir: "", base: "", ext: "", name: "" };
    if (e.length === 0)
      return t;
    const n = e.length;
    let r = 0, i = e.charCodeAt(0);
    if (n === 1)
      return B(i) ? (t.root = t.dir = e, t) : (t.base = t.name = e, t);
    if (B(i)) {
      if (r = 1, B(e.charCodeAt(1))) {
        let c = 2, d = c;
        for (; c < n && !B(e.charCodeAt(c)); )
          c++;
        if (c < n && c !== d) {
          for (d = c; c < n && B(e.charCodeAt(c)); )
            c++;
          if (c < n && c !== d) {
            for (d = c; c < n && !B(e.charCodeAt(c)); )
              c++;
            c === n ? r = c : c !== d && (r = c + 1);
          }
        }
      }
    } else if (Ge(i) && e.charCodeAt(1) === ze) {
      if (n <= 2)
        return t.root = t.dir = e, t;
      if (r = 2, B(e.charCodeAt(2))) {
        if (n === 3)
          return t.root = t.dir = e, t;
        r = 3;
      }
    }
    r > 0 && (t.root = e.slice(0, r));
    let s = -1, a = r, l = -1, o = !0, u = e.length - 1, h = 0;
    for (; u >= r; --u) {
      if (i = e.charCodeAt(u), B(i)) {
        if (!o) {
          a = u + 1;
          break;
        }
        continue;
      }
      l === -1 && (o = !1, l = u + 1), i === tt ? s === -1 ? s = u : h !== 1 && (h = 1) : s !== -1 && (h = -1);
    }
    return l !== -1 && (s === -1 || // We saw a non-dot character immediately before the dot
    h === 0 || // The (right-most) trimmed path component is exactly '..'
    h === 1 && s === l - 1 && s === a + 1 ? t.base = t.name = e.slice(a, l) : (t.name = e.slice(a, s), t.base = e.slice(a, l), t.ext = e.slice(s, l))), a > 0 && a !== r ? t.dir = e.slice(0, a - 1) : t.dir = t.root, t;
  },
  sep: "\\",
  delimiter: ";",
  win32: null,
  posix: null
}, Ko = (() => {
  if (We) {
    const e = /\\/g;
    return () => {
      const t = Sn().replace(e, "/");
      return t.slice(t.indexOf("/"));
    };
  }
  return () => Sn();
})(), de = {
  // path.resolve([from ...], to)
  resolve(...e) {
    let t = "", n = !1;
    for (let r = e.length - 1; r >= -1 && !n; r--) {
      const i = r >= 0 ? e[r] : Ko();
      K(i, `paths[${r}]`), i.length !== 0 && (t = `${i}/${t}`, n = i.charCodeAt(0) === le);
    }
    return t = An(t, !n, "/", dr), n ? `/${t}` : t.length > 0 ? t : ".";
  },
  normalize(e) {
    if (K(e, "path"), e.length === 0)
      return ".";
    const t = e.charCodeAt(0) === le, n = e.charCodeAt(e.length - 1) === le;
    return e = An(e, !t, "/", dr), e.length === 0 ? t ? "/" : n ? "./" : "." : (n && (e += "/"), t ? `/${e}` : e);
  },
  isAbsolute(e) {
    return K(e, "path"), e.length > 0 && e.charCodeAt(0) === le;
  },
  join(...e) {
    if (e.length === 0)
      return ".";
    let t;
    for (let n = 0; n < e.length; ++n) {
      const r = e[n];
      K(r, "path"), r.length > 0 && (t === void 0 ? t = r : t += `/${r}`);
    }
    return t === void 0 ? "." : de.normalize(t);
  },
  relative(e, t) {
    if (K(e, "from"), K(t, "to"), e === t || (e = de.resolve(e), t = de.resolve(t), e === t))
      return "";
    const n = 1, r = e.length, i = r - n, s = 1, a = t.length - s, l = i < a ? i : a;
    let o = -1, u = 0;
    for (; u < l; u++) {
      const c = e.charCodeAt(n + u);
      if (c !== t.charCodeAt(s + u))
        break;
      c === le && (o = u);
    }
    if (u === l)
      if (a > l) {
        if (t.charCodeAt(s + u) === le)
          return t.slice(s + u + 1);
        if (u === 0)
          return t.slice(s + u);
      } else
        i > l && (e.charCodeAt(n + u) === le ? o = u : u === 0 && (o = 0));
    let h = "";
    for (u = n + o + 1; u <= r; ++u)
      (u === r || e.charCodeAt(u) === le) && (h += h.length === 0 ? ".." : "/..");
    return `${h}${t.slice(s + o)}`;
  },
  toNamespacedPath(e) {
    return e;
  },
  dirname(e) {
    if (K(e, "path"), e.length === 0)
      return ".";
    const t = e.charCodeAt(0) === le;
    let n = -1, r = !0;
    for (let i = e.length - 1; i >= 1; --i)
      if (e.charCodeAt(i) === le) {
        if (!r) {
          n = i;
          break;
        }
      } else
        r = !1;
    return n === -1 ? t ? "/" : "." : t && n === 1 ? "//" : e.slice(0, n);
  },
  basename(e, t) {
    t !== void 0 && K(t, "ext"), K(e, "path");
    let n = 0, r = -1, i = !0, s;
    if (t !== void 0 && t.length > 0 && t.length <= e.length) {
      if (t === e)
        return "";
      let a = t.length - 1, l = -1;
      for (s = e.length - 1; s >= 0; --s) {
        const o = e.charCodeAt(s);
        if (o === le) {
          if (!i) {
            n = s + 1;
            break;
          }
        } else
          l === -1 && (i = !1, l = s + 1), a >= 0 && (o === t.charCodeAt(a) ? --a === -1 && (r = s) : (a = -1, r = l));
      }
      return n === r ? r = l : r === -1 && (r = e.length), e.slice(n, r);
    }
    for (s = e.length - 1; s >= 0; --s)
      if (e.charCodeAt(s) === le) {
        if (!i) {
          n = s + 1;
          break;
        }
      } else
        r === -1 && (i = !1, r = s + 1);
    return r === -1 ? "" : e.slice(n, r);
  },
  extname(e) {
    K(e, "path");
    let t = -1, n = 0, r = -1, i = !0, s = 0;
    for (let a = e.length - 1; a >= 0; --a) {
      const l = e.charCodeAt(a);
      if (l === le) {
        if (!i) {
          n = a + 1;
          break;
        }
        continue;
      }
      r === -1 && (i = !1, r = a + 1), l === tt ? t === -1 ? t = a : s !== 1 && (s = 1) : t !== -1 && (s = -1);
    }
    return t === -1 || r === -1 || // We saw a non-dot character immediately before the dot
    s === 0 || // The (right-most) trimmed path component is exactly '..'
    s === 1 && t === r - 1 && t === n + 1 ? "" : e.slice(t, r);
  },
  format: La.bind(null, "/"),
  parse(e) {
    K(e, "path");
    const t = { root: "", dir: "", base: "", ext: "", name: "" };
    if (e.length === 0)
      return t;
    const n = e.charCodeAt(0) === le;
    let r;
    n ? (t.root = "/", r = 1) : r = 0;
    let i = -1, s = 0, a = -1, l = !0, o = e.length - 1, u = 0;
    for (; o >= r; --o) {
      const h = e.charCodeAt(o);
      if (h === le) {
        if (!l) {
          s = o + 1;
          break;
        }
        continue;
      }
      a === -1 && (l = !1, a = o + 1), h === tt ? i === -1 ? i = o : u !== 1 && (u = 1) : i !== -1 && (u = -1);
    }
    if (a !== -1) {
      const h = s === 0 && n ? 1 : s;
      i === -1 || // We saw a non-dot character immediately before the dot
      u === 0 || // The (right-most) trimmed path component is exactly '..'
      u === 1 && i === a - 1 && i === s + 1 ? t.base = t.name = e.slice(h, a) : (t.name = e.slice(h, i), t.base = e.slice(h, a), t.ext = e.slice(i, a));
    }
    return s > 0 ? t.dir = e.slice(0, s - 1) : n && (t.dir = "/"), t;
  },
  sep: "/",
  delimiter: ":",
  win32: null,
  posix: null
};
de.win32 = he.win32 = he;
de.posix = he.posix = de;
We ? he.normalize : de.normalize;
const el = We ? he.join : de.join;
We ? he.resolve : de.resolve;
We ? he.relative : de.relative;
We ? he.dirname : de.dirname;
We ? he.basename : de.basename;
We ? he.extname : de.extname;
We ? he.sep : de.sep;
const tl = /^\w[\w\d+.-]*$/, nl = /^\//, rl = /^\/\//;
function il(e, t) {
  if (!e.scheme && t)
    throw new Error(`[UriError]: Scheme is missing: {scheme: "", authority: "${e.authority}", path: "${e.path}", query: "${e.query}", fragment: "${e.fragment}"}`);
  if (e.scheme && !tl.test(e.scheme))
    throw new Error("[UriError]: Scheme contains illegal characters.");
  if (e.path) {
    if (e.authority) {
      if (!nl.test(e.path))
        throw new Error('[UriError]: If a URI contains an authority component, then the path component must either be empty or begin with a slash ("/") character');
    } else if (rl.test(e.path))
      throw new Error('[UriError]: If a URI does not contain an authority component, then the path cannot begin with two slash characters ("//")');
  }
}
function sl(e, t) {
  return !e && !t ? "file" : e;
}
function al(e, t) {
  switch (e) {
    case "https":
    case "http":
    case "file":
      t ? t[0] !== Re && (t = Re + t) : t = Re;
      break;
  }
  return t;
}
const J = "", Re = "/", ol = /^(([^:/?#]+?):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/;
let Ie = class mn {
  static isUri(t) {
    return t instanceof mn ? !0 : t ? typeof t.authority == "string" && typeof t.fragment == "string" && typeof t.path == "string" && typeof t.query == "string" && typeof t.scheme == "string" && typeof t.fsPath == "string" && typeof t.with == "function" && typeof t.toString == "function" : !1;
  }
  /**
   * @internal
   */
  constructor(t, n, r, i, s, a = !1) {
    typeof t == "object" ? (this.scheme = t.scheme || J, this.authority = t.authority || J, this.path = t.path || J, this.query = t.query || J, this.fragment = t.fragment || J) : (this.scheme = sl(t, a), this.authority = n || J, this.path = al(this.scheme, r || J), this.query = i || J, this.fragment = s || J, il(this, a));
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
    return mr(this, !1);
  }
  // ---- modify to new -------------------------
  with(t) {
    if (!t)
      return this;
    let { scheme: n, authority: r, path: i, query: s, fragment: a } = t;
    return n === void 0 ? n = this.scheme : n === null && (n = J), r === void 0 ? r = this.authority : r === null && (r = J), i === void 0 ? i = this.path : i === null && (i = J), s === void 0 ? s = this.query : s === null && (s = J), a === void 0 ? a = this.fragment : a === null && (a = J), n === this.scheme && r === this.authority && i === this.path && s === this.query && a === this.fragment ? this : new dt(n, r, i, s, a);
  }
  // ---- parse & validate ------------------------
  /**
   * Creates a new URI from a string, e.g. `http://www.example.com/some/path`,
   * `file:///usr/home`, or `scheme:with/path`.
   *
   * @param value A string which represents an URI (see `URI#toString`).
   */
  static parse(t, n = !1) {
    const r = ol.exec(t);
    return r ? new dt(r[2] || J, cn(r[4] || J), cn(r[5] || J), cn(r[7] || J), cn(r[9] || J), n) : new dt(J, J, J, J, J);
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
    let n = J;
    if (Kt && (t = t.replace(/\\/g, Re)), t[0] === Re && t[1] === Re) {
      const r = t.indexOf(Re, 2);
      r === -1 ? (n = t.substring(2), t = Re) : (n = t.substring(2, r), t = t.substring(r) || Re);
    }
    return new dt("file", n, t, J, J);
  }
  /**
   * Creates new URI from uri components.
   *
   * Unless `strict` is `true` the scheme is defaults to be `file`. This function performs
   * validation and should be used for untrusted uri components retrieved from storage,
   * user input, command arguments etc
   */
  static from(t, n) {
    return new dt(t.scheme, t.authority, t.path, t.query, t.fragment, n);
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
    let r;
    return Kt && t.scheme === "file" ? r = mn.file(he.join(mr(t, !0), ...n)).path : r = de.join(t.path, ...n), t.with({ path: r });
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
    return gr(this, t);
  }
  toJSON() {
    return this;
  }
  static revive(t) {
    if (t) {
      if (t instanceof mn)
        return t;
      {
        const n = new dt(t);
        return n._formatted = t.external ?? null, n._fsPath = t._sep === Na ? t.fsPath ?? null : null, n;
      }
    } else
      return t;
  }
};
const Na = Kt ? 1 : void 0;
class dt extends Ie {
  constructor() {
    super(...arguments), this._formatted = null, this._fsPath = null;
  }
  get fsPath() {
    return this._fsPath || (this._fsPath = mr(this, !1)), this._fsPath;
  }
  toString(t = !1) {
    return t ? gr(this, !0) : (this._formatted || (this._formatted = gr(this, !1)), this._formatted);
  }
  toJSON() {
    const t = {
      $mid: 1
      /* MarshalledId.Uri */
    };
    return this._fsPath && (t.fsPath = this._fsPath, t._sep = Na), this._formatted && (t.external = this._formatted), this.path && (t.path = this.path), this.scheme && (t.scheme = this.scheme), this.authority && (t.authority = this.authority), this.query && (t.query = this.query), this.fragment && (t.fragment = this.fragment), t;
  }
}
const Sa = {
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
function mi(e, t, n) {
  let r, i = -1;
  for (let s = 0; s < e.length; s++) {
    const a = e.charCodeAt(s);
    if (a >= 97 && a <= 122 || a >= 65 && a <= 90 || a >= 48 && a <= 57 || a === 45 || a === 46 || a === 95 || a === 126 || t && a === 47 || n && a === 91 || n && a === 93 || n && a === 58)
      i !== -1 && (r += encodeURIComponent(e.substring(i, s)), i = -1), r !== void 0 && (r += e.charAt(s));
    else {
      r === void 0 && (r = e.substr(0, s));
      const l = Sa[a];
      l !== void 0 ? (i !== -1 && (r += encodeURIComponent(e.substring(i, s)), i = -1), r += l) : i === -1 && (i = s);
    }
  }
  return i !== -1 && (r += encodeURIComponent(e.substring(i))), r !== void 0 ? r : e;
}
function ll(e) {
  let t;
  for (let n = 0; n < e.length; n++) {
    const r = e.charCodeAt(n);
    r === 35 || r === 63 ? (t === void 0 && (t = e.substr(0, n)), t += Sa[r]) : t !== void 0 && (t += e[n]);
  }
  return t !== void 0 ? t : e;
}
function mr(e, t) {
  let n;
  return e.authority && e.path.length > 1 && e.scheme === "file" ? n = `//${e.authority}${e.path}` : e.path.charCodeAt(0) === 47 && (e.path.charCodeAt(1) >= 65 && e.path.charCodeAt(1) <= 90 || e.path.charCodeAt(1) >= 97 && e.path.charCodeAt(1) <= 122) && e.path.charCodeAt(2) === 58 ? t ? n = e.path.substr(1) : n = e.path[1].toLowerCase() + e.path.substr(2) : n = e.path, Kt && (n = n.replace(/\//g, "\\")), n;
}
function gr(e, t) {
  const n = t ? ll : mi;
  let r = "", { scheme: i, authority: s, path: a, query: l, fragment: o } = e;
  if (i && (r += i, r += ":"), (s || i === "file") && (r += Re, r += Re), s) {
    let u = s.indexOf("@");
    if (u !== -1) {
      const h = s.substr(0, u);
      s = s.substr(u + 1), u = h.lastIndexOf(":"), u === -1 ? r += n(h, !1, !1) : (r += n(h.substr(0, u), !1, !1), r += ":", r += n(h.substr(u + 1), !1, !0)), r += "@";
    }
    s = s.toLowerCase(), u = s.lastIndexOf(":"), u === -1 ? r += n(s, !1, !0) : (r += n(s.substr(0, u), !1, !0), r += s.substr(u));
  }
  if (a) {
    if (a.length >= 3 && a.charCodeAt(0) === 47 && a.charCodeAt(2) === 58) {
      const u = a.charCodeAt(1);
      u >= 65 && u <= 90 && (a = `/${String.fromCharCode(u + 32)}:${a.substr(3)}`);
    } else if (a.length >= 2 && a.charCodeAt(1) === 58) {
      const u = a.charCodeAt(0);
      u >= 65 && u <= 90 && (a = `${String.fromCharCode(u + 32)}:${a.substr(2)}`);
    }
    r += n(a, !0, !1);
  }
  return l && (r += "?", r += n(l, !1, !1)), o && (r += "#", r += t ? o : mi(o, !1, !1)), r;
}
function Aa(e) {
  try {
    return decodeURIComponent(e);
  } catch {
    return e.length > 3 ? e.substr(0, 3) + Aa(e.substr(3)) : e;
  }
}
const gi = /(%[0-9A-Za-z][0-9A-Za-z])+/g;
function cn(e) {
  return e.match(gi) ? e.replace(gi, (t) => Aa(t)) : e;
}
var et;
(function(e) {
  e.inMemory = "inmemory", e.vscode = "vscode", e.internal = "private", e.walkThrough = "walkThrough", e.walkThroughSnippet = "walkThroughSnippet", e.http = "http", e.https = "https", e.file = "file", e.mailto = "mailto", e.untitled = "untitled", e.data = "data", e.command = "command", e.vscodeRemote = "vscode-remote", e.vscodeRemoteResource = "vscode-remote-resource", e.vscodeManagedRemoteResource = "vscode-managed-remote-resource", e.vscodeUserData = "vscode-userdata", e.vscodeCustomEditor = "vscode-custom-editor", e.vscodeNotebookCell = "vscode-notebook-cell", e.vscodeNotebookCellMetadata = "vscode-notebook-cell-metadata", e.vscodeNotebookCellMetadataDiff = "vscode-notebook-cell-metadata-diff", e.vscodeNotebookCellOutput = "vscode-notebook-cell-output", e.vscodeNotebookCellOutputDiff = "vscode-notebook-cell-output-diff", e.vscodeNotebookMetadata = "vscode-notebook-metadata", e.vscodeInteractiveInput = "vscode-interactive-input", e.vscodeSettings = "vscode-settings", e.vscodeWorkspaceTrust = "vscode-workspace-trust", e.vscodeTerminal = "vscode-terminal", e.vscodeChatCodeBlock = "vscode-chat-code-block", e.vscodeChatCodeCompareBlock = "vscode-chat-code-compare-block", e.vscodeChatSesssion = "vscode-chat-editor", e.webviewPanel = "webview-panel", e.vscodeWebview = "vscode-webview", e.extension = "extension", e.vscodeFileResource = "vscode-file", e.tmp = "tmp", e.vsls = "vsls", e.vscodeSourceControl = "vscode-scm", e.commentsInput = "comment", e.codeSetting = "code-setting", e.outputChannel = "output";
})(et || (et = {}));
const ul = "tkn";
class cl {
  constructor() {
    this._hosts = /* @__PURE__ */ Object.create(null), this._ports = /* @__PURE__ */ Object.create(null), this._connectionTokens = /* @__PURE__ */ Object.create(null), this._preferredWebSchema = "http", this._delegate = null, this._serverRootPath = "/";
  }
  setPreferredWebSchema(t) {
    this._preferredWebSchema = t;
  }
  get _remoteResourcesPath() {
    return de.join(this._serverRootPath, et.vscodeRemoteResource);
  }
  rewrite(t) {
    if (this._delegate)
      try {
        return this._delegate(t);
      } catch (l) {
        return Ht(l), t;
      }
    const n = t.authority;
    let r = this._hosts[n];
    r && r.indexOf(":") !== -1 && r.indexOf("[") === -1 && (r = `[${r}]`);
    const i = this._ports[n], s = this._connectionTokens[n];
    let a = `path=${encodeURIComponent(t.path)}`;
    return typeof s == "string" && (a += `&${ul}=${encodeURIComponent(s)}`), Ie.from({
      scheme: Eo ? this._preferredWebSchema : et.vscodeRemoteResource,
      authority: `${r}:${i}`,
      path: this._remoteResourcesPath,
      query: a
    });
  }
}
const fl = new cl(), hl = "vscode-app", Xt = class Xt {
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
    return t.scheme === et.vscodeRemote ? fl.rewrite(t) : (
      // ...only ever for `file` resources
      t.scheme === et.file && // ...and we run in native environments
      (Ro || // ...or web worker extensions on desktop
      Co === `${et.vscodeFileResource}://${Xt.FALLBACK_AUTHORITY}`) ? t.with({
        scheme: et.vscodeFileResource,
        // We need to provide an authority here so that it can serve
        // as origin for network and loading matters in chromium.
        // If the URI is not coming with an authority already, we
        // add our own
        authority: t.authority || Xt.FALLBACK_AUTHORITY,
        query: null,
        fragment: null
      }) : t
    );
  }
  toUri(t, n) {
    if (Ie.isUri(t))
      return t;
    if (globalThis._VSCODE_FILE_ROOT) {
      const r = globalThis._VSCODE_FILE_ROOT;
      if (/^\w[\w\d+.-]*:\/\//.test(r))
        return Ie.joinPath(Ie.parse(r, !0), t);
      const i = el(r, t);
      return Ie.file(i);
    }
    return Ie.parse(n.toUrl(t));
  }
};
Xt.FALLBACK_AUTHORITY = hl;
let pr = Xt;
const ka = new pr();
var pi;
(function(e) {
  const t = /* @__PURE__ */ new Map([
    ["1", { "Cross-Origin-Opener-Policy": "same-origin" }],
    ["2", { "Cross-Origin-Embedder-Policy": "require-corp" }],
    ["3", { "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "require-corp" }]
  ]);
  e.CoopAndCoep = Object.freeze(t.get("3"));
  const n = "vscode-coi";
  function r(s) {
    let a;
    typeof s == "string" ? a = new URL(s).searchParams : s instanceof URL ? a = s.searchParams : Ie.isUri(s) && (a = new URL(s.toString(!0)).searchParams);
    const l = a == null ? void 0 : a.get(n);
    if (l)
      return t.get(l);
  }
  e.getHeadersFromQuery = r;
  function i(s, a, l) {
    if (!globalThis.crossOriginIsolated)
      return;
    const o = a && l ? "3" : l ? "2" : "1";
    s instanceof URLSearchParams ? s.set(n, o) : s[n] = o;
  }
  e.addSearchParam = i;
})(pi || (pi = {}));
const Zn = "default", dl = "$initialize";
class ml {
  constructor(t, n, r, i, s) {
    this.vsWorker = t, this.req = n, this.channel = r, this.method = i, this.args = s, this.type = 0;
  }
}
class bi {
  constructor(t, n, r, i) {
    this.vsWorker = t, this.seq = n, this.res = r, this.err = i, this.type = 1;
  }
}
class gl {
  constructor(t, n, r, i, s) {
    this.vsWorker = t, this.req = n, this.channel = r, this.eventName = i, this.arg = s, this.type = 2;
  }
}
class pl {
  constructor(t, n, r) {
    this.vsWorker = t, this.req = n, this.event = r, this.type = 3;
  }
}
class bl {
  constructor(t, n) {
    this.vsWorker = t, this.req = n, this.type = 4;
  }
}
class vl {
  constructor(t) {
    this._workerId = -1, this._handler = t, this._lastSentReq = 0, this._pendingReplies = /* @__PURE__ */ Object.create(null), this._pendingEmitters = /* @__PURE__ */ new Map(), this._pendingEvents = /* @__PURE__ */ new Map();
  }
  setWorkerId(t) {
    this._workerId = t;
  }
  sendMessage(t, n, r) {
    const i = String(++this._lastSentReq);
    return new Promise((s, a) => {
      this._pendingReplies[i] = {
        resolve: s,
        reject: a
      }, this._send(new ml(this._workerId, i, t, n, r));
    });
  }
  listen(t, n, r) {
    let i = null;
    const s = new Le({
      onWillAddFirstListener: () => {
        i = String(++this._lastSentReq), this._pendingEmitters.set(i, s), this._send(new gl(this._workerId, i, t, n, r));
      },
      onDidRemoveLastListener: () => {
        this._pendingEmitters.delete(i), this._send(new bl(this._workerId, i)), i = null;
      }
    });
    return s.event;
  }
  handleMessage(t) {
    !t || !t.vsWorker || this._workerId !== -1 && t.vsWorker !== this._workerId || this._handleMessage(t);
  }
  createProxyToRemoteChannel(t, n) {
    const r = {
      get: (i, s) => (typeof s == "string" && !i[s] && (Ea(s) ? i[s] = (a) => this.listen(t, s, a) : Ra(s) ? i[s] = this.listen(t, s, void 0) : s.charCodeAt(0) === 36 && (i[s] = async (...a) => (await (n == null ? void 0 : n()), this.sendMessage(t, s, a)))), i[s])
    };
    return new Proxy(/* @__PURE__ */ Object.create(null), r);
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
      let r = t.err;
      t.err.$isError && (r = new Error(), r.name = t.err.name, r.message = t.err.message, r.stack = t.err.stack), n.reject(r);
      return;
    }
    n.resolve(t.res);
  }
  _handleRequestMessage(t) {
    const n = t.req;
    this._handler.handleMessage(t.channel, t.method, t.args).then((i) => {
      this._send(new bi(this._workerId, n, i, void 0));
    }, (i) => {
      i.detail instanceof Error && (i.detail = ui(i.detail)), this._send(new bi(this._workerId, n, void 0, ui(i)));
    });
  }
  _handleSubscribeEventMessage(t) {
    const n = t.req, r = this._handler.handleEvent(t.channel, t.eventName, t.arg)((i) => {
      this._send(new pl(this._workerId, n, i));
    });
    this._pendingEvents.set(n, r);
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
      for (let r = 0; r < t.args.length; r++)
        t.args[r] instanceof ArrayBuffer && n.push(t.args[r]);
    else
      t.type === 1 && t.res instanceof ArrayBuffer && n.push(t.res);
    this._handler.sendMessage(t, n);
  }
}
function Ra(e) {
  return e[0] === "o" && e[1] === "n" && ya(e.charCodeAt(2));
}
function Ea(e) {
  return /^onDynamic/.test(e) && ya(e.charCodeAt(9));
}
class xl {
  constructor(t, n) {
    this._localChannels = /* @__PURE__ */ new Map(), this._remoteChannels = /* @__PURE__ */ new Map(), this._requestHandlerFactory = n, this._requestHandler = null, this._protocol = new vl({
      sendMessage: (r, i) => {
        t(r, i);
      },
      handleMessage: (r, i, s) => this._handleMessage(r, i, s),
      handleEvent: (r, i, s) => this._handleEvent(r, i, s)
    });
  }
  onmessage(t) {
    this._protocol.handleMessage(t);
  }
  _handleMessage(t, n, r) {
    if (t === Zn && n === dl)
      return this.initialize(r[0], r[1], r[2]);
    const i = t === Zn ? this._requestHandler : this._localChannels.get(t);
    if (!i)
      return Promise.reject(new Error(`Missing channel ${t} on worker thread`));
    if (typeof i[n] != "function")
      return Promise.reject(new Error(`Missing method ${n} on worker thread channel ${t}`));
    try {
      return Promise.resolve(i[n].apply(i, r));
    } catch (s) {
      return Promise.reject(s);
    }
  }
  _handleEvent(t, n, r) {
    const i = t === Zn ? this._requestHandler : this._localChannels.get(t);
    if (!i)
      throw new Error(`Missing channel ${t} on worker thread`);
    if (Ea(n)) {
      const s = i[n].call(i, r);
      if (typeof s != "function")
        throw new Error(`Missing dynamic event ${n} on request handler.`);
      return s;
    }
    if (Ra(n)) {
      const s = i[n];
      if (typeof s != "function")
        throw new Error(`Missing event ${n} on request handler.`);
      return s;
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
  async initialize(t, n, r) {
    if (this._protocol.setWorkerId(t), this._requestHandlerFactory) {
      this._requestHandler = this._requestHandlerFactory(this);
      return;
    }
    return n && (typeof n.baseUrl < "u" && delete n.baseUrl, typeof n.paths < "u" && typeof n.paths.vs < "u" && delete n.paths.vs, typeof n.trustedTypesPolicy < "u" && delete n.trustedTypesPolicy, n.catchError = !0, globalThis.require.config(n)), import(`${ka.asBrowserUri(`${r}.js`).toString(!0)}`).then((s) => {
      if (this._requestHandler = s.create(this), !this._requestHandler)
        throw new Error("No RequestHandler!");
    });
  }
}
class Qe {
  /**
   * Constructs a new DiffChange with the given sequence information
   * and content.
   */
  constructor(t, n, r, i) {
    this.originalStart = t, this.originalLength = n, this.modifiedStart = r, this.modifiedLength = i;
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
function vi(e, t) {
  return (t << 5) - t + e | 0;
}
function yl(e, t) {
  t = vi(149417, t);
  for (let n = 0, r = e.length; n < r; n++)
    t = vi(e.charCodeAt(n), t);
  return t;
}
function Kn(e, t, n = 32) {
  const r = n - t, i = ~((1 << r) - 1);
  return (e << t | (i & e) >>> r) >>> 0;
}
function xi(e, t = 0, n = e.byteLength, r = 0) {
  for (let i = 0; i < n; i++)
    e[t + i] = r;
}
function wl(e, t, n = "0") {
  for (; e.length < t; )
    e = n + e;
  return e;
}
function Ot(e, t = 32) {
  return e instanceof ArrayBuffer ? Array.from(new Uint8Array(e)).map((n) => n.toString(16).padStart(2, "0")).join("") : wl((e >>> 0).toString(16), t / 4);
}
const qn = class qn {
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
    const r = this._buff;
    let i = this._buffLen, s = this._leftoverHighSurrogate, a, l;
    for (s !== 0 ? (a = s, l = -1, s = 0) : (a = t.charCodeAt(0), l = 0); ; ) {
      let o = a;
      if (Nn(a))
        if (l + 1 < n) {
          const u = t.charCodeAt(l + 1);
          hr(u) ? (l++, o = wa(a, u)) : o = 65533;
        } else {
          s = a;
          break;
        }
      else
        hr(a) && (o = 65533);
      if (i = this._push(r, i, o), l++, l < n)
        a = t.charCodeAt(l);
      else
        break;
    }
    this._buffLen = i, this._leftoverHighSurrogate = s;
  }
  _push(t, n, r) {
    return r < 128 ? t[n++] = r : r < 2048 ? (t[n++] = 192 | (r & 1984) >>> 6, t[n++] = 128 | (r & 63) >>> 0) : r < 65536 ? (t[n++] = 224 | (r & 61440) >>> 12, t[n++] = 128 | (r & 4032) >>> 6, t[n++] = 128 | (r & 63) >>> 0) : (t[n++] = 240 | (r & 1835008) >>> 18, t[n++] = 128 | (r & 258048) >>> 12, t[n++] = 128 | (r & 4032) >>> 6, t[n++] = 128 | (r & 63) >>> 0), n >= 64 && (this._step(), n -= 64, this._totalLen += 64, t[0] = t[64], t[1] = t[65], t[2] = t[66]), n;
  }
  digest() {
    return this._finished || (this._finished = !0, this._leftoverHighSurrogate && (this._leftoverHighSurrogate = 0, this._buffLen = this._push(
      this._buff,
      this._buffLen,
      65533
      /* SHA1Constant.UNICODE_REPLACEMENT */
    )), this._totalLen += this._buffLen, this._wrapUp()), Ot(this._h0) + Ot(this._h1) + Ot(this._h2) + Ot(this._h3) + Ot(this._h4);
  }
  _wrapUp() {
    this._buff[this._buffLen++] = 128, xi(this._buff, this._buffLen), this._buffLen > 56 && (this._step(), xi(this._buff));
    const t = 8 * this._totalLen;
    this._buffDV.setUint32(56, Math.floor(t / 4294967296), !1), this._buffDV.setUint32(60, t % 4294967296, !1), this._step();
  }
  _step() {
    const t = qn._bigBlock32, n = this._buffDV;
    for (let c = 0; c < 64; c += 4)
      t.setUint32(c, n.getUint32(c, !1), !1);
    for (let c = 64; c < 320; c += 4)
      t.setUint32(c, Kn(t.getUint32(c - 12, !1) ^ t.getUint32(c - 32, !1) ^ t.getUint32(c - 56, !1) ^ t.getUint32(c - 64, !1), 1), !1);
    let r = this._h0, i = this._h1, s = this._h2, a = this._h3, l = this._h4, o, u, h;
    for (let c = 0; c < 80; c++)
      c < 20 ? (o = i & s | ~i & a, u = 1518500249) : c < 40 ? (o = i ^ s ^ a, u = 1859775393) : c < 60 ? (o = i & s | i & a | s & a, u = 2400959708) : (o = i ^ s ^ a, u = 3395469782), h = Kn(r, 5) + o + l + u + t.getUint32(c * 4, !1) & 4294967295, l = a, a = s, s = Kn(i, 30), i = r, r = h;
    this._h0 = this._h0 + r & 4294967295, this._h1 = this._h1 + i & 4294967295, this._h2 = this._h2 + s & 4294967295, this._h3 = this._h3 + a & 4294967295, this._h4 = this._h4 + l & 4294967295;
  }
};
qn._bigBlock32 = new DataView(new ArrayBuffer(320));
let yi = qn;
class wi {
  constructor(t) {
    this.source = t;
  }
  getElements() {
    const t = this.source, n = new Int32Array(t.length);
    for (let r = 0, i = t.length; r < i; r++)
      n[r] = t.charCodeAt(r);
    return n;
  }
}
function _l(e, t, n) {
  return new Ke(new wi(e), new wi(t)).ComputeDiff(n).changes;
}
class mt {
  static Assert(t, n) {
    if (!t)
      throw new Error(n);
  }
}
class gt {
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
  static Copy(t, n, r, i, s) {
    for (let a = 0; a < s; a++)
      r[i + a] = t[n + a];
  }
  static Copy2(t, n, r, i, s) {
    for (let a = 0; a < s; a++)
      r[i + a] = t[n + a];
  }
}
class _i {
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
    (this.m_originalCount > 0 || this.m_modifiedCount > 0) && this.m_changes.push(new Qe(this.m_originalStart, this.m_originalCount, this.m_modifiedStart, this.m_modifiedCount)), this.m_originalCount = 0, this.m_modifiedCount = 0, this.m_originalStart = 1073741824, this.m_modifiedStart = 1073741824;
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
class Ke {
  /**
   * Constructs the DiffFinder
   */
  constructor(t, n, r = null) {
    this.ContinueProcessingPredicate = r, this._originalSequence = t, this._modifiedSequence = n;
    const [i, s, a] = Ke._getElements(t), [l, o, u] = Ke._getElements(n);
    this._hasStrings = a && u, this._originalStringElements = i, this._originalElementsOrHash = s, this._modifiedStringElements = l, this._modifiedElementsOrHash = o, this.m_forwardHistory = [], this.m_reverseHistory = [];
  }
  static _isStringArray(t) {
    return t.length > 0 && typeof t[0] == "string";
  }
  static _getElements(t) {
    const n = t.getElements();
    if (Ke._isStringArray(n)) {
      const r = new Int32Array(n.length);
      for (let i = 0, s = n.length; i < s; i++)
        r[i] = yl(n[i], 0);
      return [n, r, !0];
    }
    return n instanceof Int32Array ? [[], n, !1] : [[], new Int32Array(n), !1];
  }
  ElementsAreEqual(t, n) {
    return this._originalElementsOrHash[t] !== this._modifiedElementsOrHash[n] ? !1 : this._hasStrings ? this._originalStringElements[t] === this._modifiedStringElements[n] : !0;
  }
  ElementsAreStrictEqual(t, n) {
    if (!this.ElementsAreEqual(t, n))
      return !1;
    const r = Ke._getStrictElement(this._originalSequence, t), i = Ke._getStrictElement(this._modifiedSequence, n);
    return r === i;
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
  _ComputeDiff(t, n, r, i, s) {
    const a = [!1];
    let l = this.ComputeDiffRecursive(t, n, r, i, a);
    return s && (l = this.PrettifyChanges(l)), {
      quitEarly: a[0],
      changes: l
    };
  }
  /**
   * Private helper method which computes the differences on the bounded range
   * recursively.
   * @returns An array of the differences between the two input sequences.
   */
  ComputeDiffRecursive(t, n, r, i, s) {
    for (s[0] = !1; t <= n && r <= i && this.ElementsAreEqual(t, r); )
      t++, r++;
    for (; n >= t && i >= r && this.ElementsAreEqual(n, i); )
      n--, i--;
    if (t > n || r > i) {
      let c;
      return r <= i ? (mt.Assert(t === n + 1, "originalStart should only be one more than originalEnd"), c = [
        new Qe(t, 0, r, i - r + 1)
      ]) : t <= n ? (mt.Assert(r === i + 1, "modifiedStart should only be one more than modifiedEnd"), c = [
        new Qe(t, n - t + 1, r, 0)
      ]) : (mt.Assert(t === n + 1, "originalStart should only be one more than originalEnd"), mt.Assert(r === i + 1, "modifiedStart should only be one more than modifiedEnd"), c = []), c;
    }
    const a = [0], l = [0], o = this.ComputeRecursionPoint(t, n, r, i, a, l, s), u = a[0], h = l[0];
    if (o !== null)
      return o;
    if (!s[0]) {
      const c = this.ComputeDiffRecursive(t, u, r, h, s);
      let d = [];
      return s[0] ? d = [
        new Qe(u + 1, n - (u + 1) + 1, h + 1, i - (h + 1) + 1)
      ] : d = this.ComputeDiffRecursive(u + 1, n, h + 1, i, s), this.ConcatenateChanges(c, d);
    }
    return [
      new Qe(t, n - t + 1, r, i - r + 1)
    ];
  }
  WALKTRACE(t, n, r, i, s, a, l, o, u, h, c, d, m, g, p, x, w, L) {
    let v = null, y = null, b = new _i(), _ = n, k = r, C = m[0] - x[0] - i, F = -1073741824, O = this.m_forwardHistory.length - 1;
    do {
      const M = C + t;
      M === _ || M < k && u[M - 1] < u[M + 1] ? (c = u[M + 1], g = c - C - i, c < F && b.MarkNextChange(), F = c, b.AddModifiedElement(c + 1, g), C = M + 1 - t) : (c = u[M - 1] + 1, g = c - C - i, c < F && b.MarkNextChange(), F = c - 1, b.AddOriginalElement(c, g + 1), C = M - 1 - t), O >= 0 && (u = this.m_forwardHistory[O], t = u[0], _ = 1, k = u.length - 1);
    } while (--O >= -1);
    if (v = b.getReverseChanges(), L[0]) {
      let M = m[0] + 1, N = x[0] + 1;
      if (v !== null && v.length > 0) {
        const S = v[v.length - 1];
        M = Math.max(M, S.getOriginalEnd()), N = Math.max(N, S.getModifiedEnd());
      }
      y = [
        new Qe(M, d - M + 1, N, p - N + 1)
      ];
    } else {
      b = new _i(), _ = a, k = l, C = m[0] - x[0] - o, F = 1073741824, O = w ? this.m_reverseHistory.length - 1 : this.m_reverseHistory.length - 2;
      do {
        const M = C + s;
        M === _ || M < k && h[M - 1] >= h[M + 1] ? (c = h[M + 1] - 1, g = c - C - o, c > F && b.MarkNextChange(), F = c + 1, b.AddOriginalElement(c + 1, g + 1), C = M + 1 - s) : (c = h[M - 1], g = c - C - o, c > F && b.MarkNextChange(), F = c, b.AddModifiedElement(c + 1, g + 1), C = M - 1 - s), O >= 0 && (h = this.m_reverseHistory[O], s = h[0], _ = 1, k = h.length - 1);
      } while (--O >= -1);
      y = b.getChanges();
    }
    return this.ConcatenateChanges(v, y);
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
  ComputeRecursionPoint(t, n, r, i, s, a, l) {
    let o = 0, u = 0, h = 0, c = 0, d = 0, m = 0;
    t--, r--, s[0] = 0, a[0] = 0, this.m_forwardHistory = [], this.m_reverseHistory = [];
    const g = n - t + (i - r), p = g + 1, x = new Int32Array(p), w = new Int32Array(p), L = i - r, v = n - t, y = t - r, b = n - i, k = (v - L) % 2 === 0;
    x[L] = t, w[v] = n, l[0] = !1;
    for (let C = 1; C <= g / 2 + 1; C++) {
      let F = 0, O = 0;
      h = this.ClipDiagonalBound(L - C, C, L, p), c = this.ClipDiagonalBound(L + C, C, L, p);
      for (let N = h; N <= c; N += 2) {
        N === h || N < c && x[N - 1] < x[N + 1] ? o = x[N + 1] : o = x[N - 1] + 1, u = o - (N - L) - y;
        const S = o;
        for (; o < n && u < i && this.ElementsAreEqual(o + 1, u + 1); )
          o++, u++;
        if (x[N] = o, o + u > F + O && (F = o, O = u), !k && Math.abs(N - v) <= C - 1 && o >= w[N])
          return s[0] = o, a[0] = u, S <= w[N] && 1447 > 0 && C <= 1448 ? this.WALKTRACE(L, h, c, y, v, d, m, b, x, w, o, n, s, u, i, a, k, l) : null;
      }
      const M = (F - t + (O - r) - C) / 2;
      if (this.ContinueProcessingPredicate !== null && !this.ContinueProcessingPredicate(F, M))
        return l[0] = !0, s[0] = F, a[0] = O, M > 0 && 1447 > 0 && C <= 1448 ? this.WALKTRACE(L, h, c, y, v, d, m, b, x, w, o, n, s, u, i, a, k, l) : (t++, r++, [
          new Qe(t, n - t + 1, r, i - r + 1)
        ]);
      d = this.ClipDiagonalBound(v - C, C, v, p), m = this.ClipDiagonalBound(v + C, C, v, p);
      for (let N = d; N <= m; N += 2) {
        N === d || N < m && w[N - 1] >= w[N + 1] ? o = w[N + 1] - 1 : o = w[N - 1], u = o - (N - v) - b;
        const S = o;
        for (; o > t && u > r && this.ElementsAreEqual(o, u); )
          o--, u--;
        if (w[N] = o, k && Math.abs(N - L) <= C && o <= x[N])
          return s[0] = o, a[0] = u, S >= x[N] && 1447 > 0 && C <= 1448 ? this.WALKTRACE(L, h, c, y, v, d, m, b, x, w, o, n, s, u, i, a, k, l) : null;
      }
      if (C <= 1447) {
        let N = new Int32Array(c - h + 2);
        N[0] = L - h + 1, gt.Copy2(x, h, N, 1, c - h + 1), this.m_forwardHistory.push(N), N = new Int32Array(m - d + 2), N[0] = v - d + 1, gt.Copy2(w, d, N, 1, m - d + 1), this.m_reverseHistory.push(N);
      }
    }
    return this.WALKTRACE(L, h, c, y, v, d, m, b, x, w, o, n, s, u, i, a, k, l);
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
      const r = t[n], i = n < t.length - 1 ? t[n + 1].originalStart : this._originalElementsOrHash.length, s = n < t.length - 1 ? t[n + 1].modifiedStart : this._modifiedElementsOrHash.length, a = r.originalLength > 0, l = r.modifiedLength > 0;
      for (; r.originalStart + r.originalLength < i && r.modifiedStart + r.modifiedLength < s && (!a || this.OriginalElementsAreEqual(r.originalStart, r.originalStart + r.originalLength)) && (!l || this.ModifiedElementsAreEqual(r.modifiedStart, r.modifiedStart + r.modifiedLength)); ) {
        const u = this.ElementsAreStrictEqual(r.originalStart, r.modifiedStart);
        if (this.ElementsAreStrictEqual(r.originalStart + r.originalLength, r.modifiedStart + r.modifiedLength) && !u)
          break;
        r.originalStart++, r.modifiedStart++;
      }
      const o = [null];
      if (n < t.length - 1 && this.ChangesOverlap(t[n], t[n + 1], o)) {
        t[n] = o[0], t.splice(n + 1, 1), n--;
        continue;
      }
    }
    for (let n = t.length - 1; n >= 0; n--) {
      const r = t[n];
      let i = 0, s = 0;
      if (n > 0) {
        const c = t[n - 1];
        i = c.originalStart + c.originalLength, s = c.modifiedStart + c.modifiedLength;
      }
      const a = r.originalLength > 0, l = r.modifiedLength > 0;
      let o = 0, u = this._boundaryScore(r.originalStart, r.originalLength, r.modifiedStart, r.modifiedLength);
      for (let c = 1; ; c++) {
        const d = r.originalStart - c, m = r.modifiedStart - c;
        if (d < i || m < s || a && !this.OriginalElementsAreEqual(d, d + r.originalLength) || l && !this.ModifiedElementsAreEqual(m, m + r.modifiedLength))
          break;
        const p = (d === i && m === s ? 5 : 0) + this._boundaryScore(d, r.originalLength, m, r.modifiedLength);
        p > u && (u = p, o = c);
      }
      r.originalStart -= o, r.modifiedStart -= o;
      const h = [null];
      if (n > 0 && this.ChangesOverlap(t[n - 1], t[n], h)) {
        t[n - 1] = h[0], t.splice(n, 1), n++;
        continue;
      }
    }
    if (this._hasStrings)
      for (let n = 1, r = t.length; n < r; n++) {
        const i = t[n - 1], s = t[n], a = s.originalStart - i.originalStart - i.originalLength, l = i.originalStart, o = s.originalStart + s.originalLength, u = o - l, h = i.modifiedStart, c = s.modifiedStart + s.modifiedLength, d = c - h;
        if (a < 5 && u < 20 && d < 20) {
          const m = this._findBetterContiguousSequence(l, u, h, d, a);
          if (m) {
            const [g, p] = m;
            (g !== i.originalStart + i.originalLength || p !== i.modifiedStart + i.modifiedLength) && (i.originalLength = g - i.originalStart, i.modifiedLength = p - i.modifiedStart, s.originalStart = g + a, s.modifiedStart = p + a, s.originalLength = o - s.originalStart, s.modifiedLength = c - s.modifiedStart);
          }
        }
      }
    return t;
  }
  _findBetterContiguousSequence(t, n, r, i, s) {
    if (n < s || i < s)
      return null;
    const a = t + n - s + 1, l = r + i - s + 1;
    let o = 0, u = 0, h = 0;
    for (let c = t; c < a; c++)
      for (let d = r; d < l; d++) {
        const m = this._contiguousSequenceScore(c, d, s);
        m > 0 && m > o && (o = m, u = c, h = d);
      }
    return o > 0 ? [u, h] : null;
  }
  _contiguousSequenceScore(t, n, r) {
    let i = 0;
    for (let s = 0; s < r; s++) {
      if (!this.ElementsAreEqual(t + s, n + s))
        return 0;
      i += this._originalStringElements[t + s].length;
    }
    return i;
  }
  _OriginalIsBoundary(t) {
    return t <= 0 || t >= this._originalElementsOrHash.length - 1 ? !0 : this._hasStrings && /^\s*$/.test(this._originalStringElements[t]);
  }
  _OriginalRegionIsBoundary(t, n) {
    if (this._OriginalIsBoundary(t) || this._OriginalIsBoundary(t - 1))
      return !0;
    if (n > 0) {
      const r = t + n;
      if (this._OriginalIsBoundary(r - 1) || this._OriginalIsBoundary(r))
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
      const r = t + n;
      if (this._ModifiedIsBoundary(r - 1) || this._ModifiedIsBoundary(r))
        return !0;
    }
    return !1;
  }
  _boundaryScore(t, n, r, i) {
    const s = this._OriginalRegionIsBoundary(t, n) ? 1 : 0, a = this._ModifiedRegionIsBoundary(r, i) ? 1 : 0;
    return s + a;
  }
  /**
   * Concatenates the two input DiffChange lists and returns the resulting
   * list.
   * @param The left changes
   * @param The right changes
   * @returns The concatenated list
   */
  ConcatenateChanges(t, n) {
    const r = [];
    if (t.length === 0 || n.length === 0)
      return n.length > 0 ? n : t;
    if (this.ChangesOverlap(t[t.length - 1], n[0], r)) {
      const i = new Array(t.length + n.length - 1);
      return gt.Copy(t, 0, i, 0, t.length - 1), i[t.length - 1] = r[0], gt.Copy(n, 1, i, t.length, n.length - 1), i;
    } else {
      const i = new Array(t.length + n.length);
      return gt.Copy(t, 0, i, 0, t.length), gt.Copy(n, 0, i, t.length, n.length), i;
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
  ChangesOverlap(t, n, r) {
    if (mt.Assert(t.originalStart <= n.originalStart, "Left change is not less than or equal to right change"), mt.Assert(t.modifiedStart <= n.modifiedStart, "Left change is not less than or equal to right change"), t.originalStart + t.originalLength >= n.originalStart || t.modifiedStart + t.modifiedLength >= n.modifiedStart) {
      const i = t.originalStart;
      let s = t.originalLength;
      const a = t.modifiedStart;
      let l = t.modifiedLength;
      return t.originalStart + t.originalLength >= n.originalStart && (s = n.originalStart + n.originalLength - t.originalStart), t.modifiedStart + t.modifiedLength >= n.modifiedStart && (l = n.modifiedStart + n.modifiedLength - t.modifiedStart), r[0] = new Qe(i, s, a, l), !0;
    } else
      return r[0] = null, !1;
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
  ClipDiagonalBound(t, n, r, i) {
    if (t >= 0 && t < i)
      return t;
    const s = r, a = i - r - 1, l = n % 2 === 0;
    if (t < 0) {
      const o = s % 2 === 0;
      return l === o ? 0 : 1;
    } else {
      const o = a % 2 === 0;
      return l === o ? i - 1 : i - 2;
    }
  }
}
let ee = class it {
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
    return t === this.lineNumber && n === this.column ? this : new it(t, n);
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
    return it.equals(this, t);
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
    return it.isBefore(this, t);
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
    return it.isBeforeOrEqual(this, t);
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
    const r = t.lineNumber | 0, i = n.lineNumber | 0;
    if (r === i) {
      const s = t.column | 0, a = n.column | 0;
      return s - a;
    }
    return r - i;
  }
  /**
   * Clone this position.
   */
  clone() {
    return new it(this.lineNumber, this.column);
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
    return new it(t.lineNumber, t.column);
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
}, z = class re {
  constructor(t, n, r, i) {
    t > r || t === r && n > i ? (this.startLineNumber = r, this.startColumn = i, this.endLineNumber = t, this.endColumn = n) : (this.startLineNumber = t, this.startColumn = n, this.endLineNumber = r, this.endColumn = i);
  }
  /**
   * Test if this range is empty.
   */
  isEmpty() {
    return re.isEmpty(this);
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
    return re.containsPosition(this, t);
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
    return re.containsRange(this, t);
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
    return re.strictContainsRange(this, t);
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
    return re.plusRange(this, t);
  }
  /**
   * A reunion of the two ranges.
   * The smallest position will be used as the start point, and the largest one as the end point.
   */
  static plusRange(t, n) {
    let r, i, s, a;
    return n.startLineNumber < t.startLineNumber ? (r = n.startLineNumber, i = n.startColumn) : n.startLineNumber === t.startLineNumber ? (r = n.startLineNumber, i = Math.min(n.startColumn, t.startColumn)) : (r = t.startLineNumber, i = t.startColumn), n.endLineNumber > t.endLineNumber ? (s = n.endLineNumber, a = n.endColumn) : n.endLineNumber === t.endLineNumber ? (s = n.endLineNumber, a = Math.max(n.endColumn, t.endColumn)) : (s = t.endLineNumber, a = t.endColumn), new re(r, i, s, a);
  }
  /**
   * A intersection of the two ranges.
   */
  intersectRanges(t) {
    return re.intersectRanges(this, t);
  }
  /**
   * A intersection of the two ranges.
   */
  static intersectRanges(t, n) {
    let r = t.startLineNumber, i = t.startColumn, s = t.endLineNumber, a = t.endColumn;
    const l = n.startLineNumber, o = n.startColumn, u = n.endLineNumber, h = n.endColumn;
    return r < l ? (r = l, i = o) : r === l && (i = Math.max(i, o)), s > u ? (s = u, a = h) : s === u && (a = Math.min(a, h)), r > s || r === s && i > a ? null : new re(r, i, s, a);
  }
  /**
   * Test if this range equals other.
   */
  equalsRange(t) {
    return re.equalsRange(this, t);
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
    return re.getEndPosition(this);
  }
  /**
   * Return the end position (which will be after or equal to the start position)
   */
  static getEndPosition(t) {
    return new ee(t.endLineNumber, t.endColumn);
  }
  /**
   * Return the start position (which will be before or equal to the end position)
   */
  getStartPosition() {
    return re.getStartPosition(this);
  }
  /**
   * Return the start position (which will be before or equal to the end position)
   */
  static getStartPosition(t) {
    return new ee(t.startLineNumber, t.startColumn);
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
    return new re(this.startLineNumber, this.startColumn, t, n);
  }
  /**
   * Create a new range using this range's end position, and using startLineNumber and startColumn as the start position.
   */
  setStartPosition(t, n) {
    return new re(t, n, this.endLineNumber, this.endColumn);
  }
  /**
   * Create a new empty range using this range's start position.
   */
  collapseToStart() {
    return re.collapseToStart(this);
  }
  /**
   * Create a new empty range using this range's start position.
   */
  static collapseToStart(t) {
    return new re(t.startLineNumber, t.startColumn, t.startLineNumber, t.startColumn);
  }
  /**
   * Create a new empty range using this range's end position.
   */
  collapseToEnd() {
    return re.collapseToEnd(this);
  }
  /**
   * Create a new empty range using this range's end position.
   */
  static collapseToEnd(t) {
    return new re(t.endLineNumber, t.endColumn, t.endLineNumber, t.endColumn);
  }
  /**
   * Moves the range by the given amount of lines.
   */
  delta(t) {
    return new re(this.startLineNumber + t, this.startColumn, this.endLineNumber + t, this.endColumn);
  }
  // ---
  static fromPositions(t, n = t) {
    return new re(t.lineNumber, t.column, n.lineNumber, n.column);
  }
  static lift(t) {
    return t ? new re(t.startLineNumber, t.startColumn, t.endLineNumber, t.endColumn) : null;
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
      const s = t.startLineNumber | 0, a = n.startLineNumber | 0;
      if (s === a) {
        const l = t.startColumn | 0, o = n.startColumn | 0;
        if (l === o) {
          const u = t.endLineNumber | 0, h = n.endLineNumber | 0;
          if (u === h) {
            const c = t.endColumn | 0, d = n.endColumn | 0;
            return c - d;
          }
          return u - h;
        }
        return l - o;
      }
      return s - a;
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
};
function Li(e) {
  return e < 0 ? 0 : e > 255 ? 255 : e | 0;
}
function pt(e) {
  return e < 0 ? 0 : e > 4294967295 ? 4294967295 : e | 0;
}
class ri {
  constructor(t) {
    const n = Li(t);
    this._defaultValue = n, this._asciiMap = ri._createAsciiMap(n), this._map = /* @__PURE__ */ new Map();
  }
  static _createAsciiMap(t) {
    const n = new Uint8Array(256);
    return n.fill(t), n;
  }
  set(t, n) {
    const r = Li(n);
    t >= 0 && t < 256 ? this._asciiMap[t] = r : this._map.set(t, r);
  }
  get(t) {
    return t >= 0 && t < 256 ? this._asciiMap[t] : this._map.get(t) || this._defaultValue;
  }
  clear() {
    this._asciiMap.fill(this._defaultValue), this._map.clear();
  }
}
class Ll {
  constructor(t, n, r) {
    const i = new Uint8Array(t * n);
    for (let s = 0, a = t * n; s < a; s++)
      i[s] = r;
    this._data = i, this.rows = t, this.cols = n;
  }
  get(t, n) {
    return this._data[t * this.cols + n];
  }
  set(t, n, r) {
    this._data[t * this.cols + n] = r;
  }
}
class Nl {
  constructor(t) {
    let n = 0, r = 0;
    for (let s = 0, a = t.length; s < a; s++) {
      const [l, o, u] = t[s];
      o > n && (n = o), l > r && (r = l), u > r && (r = u);
    }
    n++, r++;
    const i = new Ll(
      r,
      n,
      0
      /* State.Invalid */
    );
    for (let s = 0, a = t.length; s < a; s++) {
      const [l, o, u] = t[s];
      i.set(l, o, u);
    }
    this._states = i, this._maxCharCode = n;
  }
  nextState(t, n) {
    return n < 0 || n >= this._maxCharCode ? 0 : this._states.get(t, n);
  }
}
let er = null;
function Sl() {
  return er === null && (er = new Nl([
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
  ])), er;
}
let $t = null;
function Al() {
  if ($t === null) {
    $t = new ri(
      0
      /* CharacterClass.None */
    );
    const e = ` 	<>'"、。｡､，．：；‘〈「『〔（［｛｢｣｝］）〕』」〉’｀～…`;
    for (let n = 0; n < e.length; n++)
      $t.set(
        e.charCodeAt(n),
        1
        /* CharacterClass.ForceTermination */
      );
    const t = ".,;:";
    for (let n = 0; n < t.length; n++)
      $t.set(
        t.charCodeAt(n),
        2
        /* CharacterClass.CannotEndIn */
      );
  }
  return $t;
}
class kn {
  static _createLink(t, n, r, i, s) {
    let a = s - 1;
    do {
      const l = n.charCodeAt(a);
      if (t.get(l) !== 2)
        break;
      a--;
    } while (a > i);
    if (i > 0) {
      const l = n.charCodeAt(i - 1), o = n.charCodeAt(a);
      (l === 40 && o === 41 || l === 91 && o === 93 || l === 123 && o === 125) && a--;
    }
    return {
      range: {
        startLineNumber: r,
        startColumn: i + 1,
        endLineNumber: r,
        endColumn: a + 2
      },
      url: n.substring(i, a + 1)
    };
  }
  static computeLinks(t, n = Sl()) {
    const r = Al(), i = [];
    for (let s = 1, a = t.getLineCount(); s <= a; s++) {
      const l = t.getLineContent(s), o = l.length;
      let u = 0, h = 0, c = 0, d = 1, m = !1, g = !1, p = !1, x = !1;
      for (; u < o; ) {
        let w = !1;
        const L = l.charCodeAt(u);
        if (d === 13) {
          let v;
          switch (L) {
            case 40:
              m = !0, v = 0;
              break;
            case 41:
              v = m ? 0 : 1;
              break;
            case 91:
              p = !0, g = !0, v = 0;
              break;
            case 93:
              p = !1, v = g ? 0 : 1;
              break;
            case 123:
              x = !0, v = 0;
              break;
            case 125:
              v = x ? 0 : 1;
              break;
            case 39:
            case 34:
            case 96:
              c === L ? v = 1 : c === 39 || c === 34 || c === 96 ? v = 0 : v = 1;
              break;
            case 42:
              v = c === 42 ? 1 : 0;
              break;
            case 124:
              v = c === 124 ? 1 : 0;
              break;
            case 32:
              v = p ? 0 : 1;
              break;
            default:
              v = r.get(L);
          }
          v === 1 && (i.push(kn._createLink(r, l, s, h, u)), w = !0);
        } else if (d === 12) {
          let v;
          L === 91 ? (g = !0, v = 0) : v = r.get(L), v === 1 ? w = !0 : d = 13;
        } else
          d = n.nextState(d, L), d === 0 && (w = !0);
        w && (d = 1, m = !1, g = !1, x = !1, h = u + 1, c = L), u++;
      }
      d === 13 && i.push(kn._createLink(r, l, s, h, o));
    }
    return i;
  }
}
function kl(e) {
  return !e || typeof e.getLineCount != "function" || typeof e.getLineContent != "function" ? [] : kn.computeLinks(e);
}
const jn = class jn {
  constructor() {
    this._defaultValueSet = [
      ["true", "false"],
      ["True", "False"],
      ["Private", "Public", "Friend", "ReadOnly", "Partial", "Protected", "WriteOnly"],
      ["public", "protected", "private"]
    ];
  }
  navigateValueSet(t, n, r, i, s) {
    if (t && n) {
      const a = this.doNavigateValueSet(n, s);
      if (a)
        return {
          range: t,
          value: a
        };
    }
    if (r && i) {
      const a = this.doNavigateValueSet(i, s);
      if (a)
        return {
          range: r,
          value: a
        };
    }
    return null;
  }
  doNavigateValueSet(t, n) {
    const r = this.numberReplace(t, n);
    return r !== null ? r : this.textReplace(t, n);
  }
  numberReplace(t, n) {
    const r = Math.pow(10, t.length - (t.lastIndexOf(".") + 1));
    let i = Number(t);
    const s = parseFloat(t);
    return !isNaN(i) && !isNaN(s) && i === s ? i === 0 && !n ? null : (i = Math.floor(i * r), i += n ? r : -r, String(i / r)) : null;
  }
  textReplace(t, n) {
    return this.valueSetsReplace(this._defaultValueSet, t, n);
  }
  valueSetsReplace(t, n, r) {
    let i = null;
    for (let s = 0, a = t.length; i === null && s < a; s++)
      i = this.valueSetReplace(t[s], n, r);
    return i;
  }
  valueSetReplace(t, n, r) {
    let i = t.indexOf(n);
    return i >= 0 ? (i += r ? 1 : -1, i < 0 ? i = t.length - 1 : i %= t.length, t[i]) : null;
  }
};
jn.INSTANCE = new jn();
let br = jn;
const Ma = Object.freeze(function(e, t) {
  const n = setTimeout(e.bind(t), 0);
  return { dispose() {
    clearTimeout(n);
  } };
});
var Rn;
(function(e) {
  function t(n) {
    return n === e.None || n === e.Cancelled || n instanceof gn ? !0 : !n || typeof n != "object" ? !1 : typeof n.isCancellationRequested == "boolean" && typeof n.onCancellationRequested == "function";
  }
  e.isCancellationToken = t, e.None = Object.freeze({
    isCancellationRequested: !1,
    onCancellationRequested: Ln.None
  }), e.Cancelled = Object.freeze({
    isCancellationRequested: !0,
    onCancellationRequested: Ma
  });
})(Rn || (Rn = {}));
class gn {
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
    return this._isCancelled ? Ma : (this._emitter || (this._emitter = new Le()), this._emitter.event);
  }
  dispose() {
    this._emitter && (this._emitter.dispose(), this._emitter = null);
  }
}
class Rl {
  constructor(t) {
    this._token = void 0, this._parentListener = void 0, this._parentListener = t && t.onCancellationRequested(this.cancel, this);
  }
  get token() {
    return this._token || (this._token = new gn()), this._token;
  }
  cancel() {
    this._token ? this._token instanceof gn && this._token.cancel() : this._token = Rn.Cancelled;
  }
  dispose(t = !1) {
    var n;
    t && this.cancel(), (n = this._parentListener) == null || n.dispose(), this._token ? this._token instanceof gn && this._token.dispose() : this._token = Rn.None;
  }
}
class ii {
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
const pn = new ii(), vr = new ii(), xr = new ii(), El = new Array(230), Ml = /* @__PURE__ */ Object.create(null), Cl = /* @__PURE__ */ Object.create(null);
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
  ], n = [], r = [];
  for (const i of t) {
    const [s, a, l, o, u, h, c, d, m] = i;
    if (r[a] || (r[a] = !0, Ml[l] = a, Cl[l.toLowerCase()] = a), !n[o]) {
      if (n[o] = !0, !u)
        throw new Error(`String representation missing for key code ${o} around scan code ${l}`);
      pn.define(o, u), vr.define(o, d || u), xr.define(o, m || d || u);
    }
    h && (El[h] = o);
  }
})();
var Ni;
(function(e) {
  function t(l) {
    return pn.keyCodeToStr(l);
  }
  e.toString = t;
  function n(l) {
    return pn.strToKeyCode(l);
  }
  e.fromString = n;
  function r(l) {
    return vr.keyCodeToStr(l);
  }
  e.toUserSettingsUS = r;
  function i(l) {
    return xr.keyCodeToStr(l);
  }
  e.toUserSettingsGeneral = i;
  function s(l) {
    return vr.strToKeyCode(l) || xr.strToKeyCode(l);
  }
  e.fromUserSettings = s;
  function a(l) {
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
    return pn.keyCodeToStr(l);
  }
  e.toElectronAccelerator = a;
})(Ni || (Ni = {}));
function Tl(e, t) {
  const n = (t & 65535) << 16 >>> 0;
  return (e | n) >>> 0;
}
class ve extends z {
  constructor(t, n, r, i) {
    super(t, n, r, i), this.selectionStartLineNumber = t, this.selectionStartColumn = n, this.positionLineNumber = r, this.positionColumn = i;
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
    return ve.selectionsEqual(this, t);
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
    return this.getDirection() === 0 ? new ve(this.startLineNumber, this.startColumn, t, n) : new ve(t, n, this.startLineNumber, this.startColumn);
  }
  /**
   * Get the position at `positionLineNumber` and `positionColumn`.
   */
  getPosition() {
    return new ee(this.positionLineNumber, this.positionColumn);
  }
  /**
   * Get the position at the start of the selection.
  */
  getSelectionStart() {
    return new ee(this.selectionStartLineNumber, this.selectionStartColumn);
  }
  /**
   * Create a new selection with a different `selectionStartLineNumber` and `selectionStartColumn`.
   */
  setStartPosition(t, n) {
    return this.getDirection() === 0 ? new ve(t, n, this.endLineNumber, this.endColumn) : new ve(this.endLineNumber, this.endColumn, t, n);
  }
  // ----
  /**
   * Create a `Selection` from one or two positions
   */
  static fromPositions(t, n = t) {
    return new ve(t.lineNumber, t.column, n.lineNumber, n.column);
  }
  /**
   * Creates a `Selection` from a range, given a direction.
   */
  static fromRange(t, n) {
    return n === 0 ? new ve(t.startLineNumber, t.startColumn, t.endLineNumber, t.endColumn) : new ve(t.endLineNumber, t.endColumn, t.startLineNumber, t.startColumn);
  }
  /**
   * Create a `Selection` from an `ISelection`.
   */
  static liftSelection(t) {
    return new ve(t.selectionStartLineNumber, t.selectionStartColumn, t.positionLineNumber, t.positionColumn);
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
    for (let r = 0, i = t.length; r < i; r++)
      if (!this.selectionsEqual(t[r], n[r]))
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
  static createWithDirection(t, n, r, i, s) {
    return s === 0 ? new ve(t, n, r, i) : new ve(r, i, t, n);
  }
}
function Pl(e) {
  return typeof e == "string";
}
const Si = /* @__PURE__ */ Object.create(null);
function f(e, t) {
  if (Pl(t)) {
    const n = Si[t];
    if (n === void 0)
      throw new Error(`${e} references an unknown codicon: ${t}`);
    t = n;
  }
  return Si[e] = t, { id: e };
}
const Il = {
  add: f("add", 6e4),
  plus: f("plus", 6e4),
  gistNew: f("gist-new", 6e4),
  repoCreate: f("repo-create", 6e4),
  lightbulb: f("lightbulb", 60001),
  lightBulb: f("light-bulb", 60001),
  repo: f("repo", 60002),
  repoDelete: f("repo-delete", 60002),
  gistFork: f("gist-fork", 60003),
  repoForked: f("repo-forked", 60003),
  gitPullRequest: f("git-pull-request", 60004),
  gitPullRequestAbandoned: f("git-pull-request-abandoned", 60004),
  recordKeys: f("record-keys", 60005),
  keyboard: f("keyboard", 60005),
  tag: f("tag", 60006),
  gitPullRequestLabel: f("git-pull-request-label", 60006),
  tagAdd: f("tag-add", 60006),
  tagRemove: f("tag-remove", 60006),
  person: f("person", 60007),
  personFollow: f("person-follow", 60007),
  personOutline: f("person-outline", 60007),
  personFilled: f("person-filled", 60007),
  gitBranch: f("git-branch", 60008),
  gitBranchCreate: f("git-branch-create", 60008),
  gitBranchDelete: f("git-branch-delete", 60008),
  sourceControl: f("source-control", 60008),
  mirror: f("mirror", 60009),
  mirrorPublic: f("mirror-public", 60009),
  star: f("star", 60010),
  starAdd: f("star-add", 60010),
  starDelete: f("star-delete", 60010),
  starEmpty: f("star-empty", 60010),
  comment: f("comment", 60011),
  commentAdd: f("comment-add", 60011),
  alert: f("alert", 60012),
  warning: f("warning", 60012),
  search: f("search", 60013),
  searchSave: f("search-save", 60013),
  logOut: f("log-out", 60014),
  signOut: f("sign-out", 60014),
  logIn: f("log-in", 60015),
  signIn: f("sign-in", 60015),
  eye: f("eye", 60016),
  eyeUnwatch: f("eye-unwatch", 60016),
  eyeWatch: f("eye-watch", 60016),
  circleFilled: f("circle-filled", 60017),
  primitiveDot: f("primitive-dot", 60017),
  closeDirty: f("close-dirty", 60017),
  debugBreakpoint: f("debug-breakpoint", 60017),
  debugBreakpointDisabled: f("debug-breakpoint-disabled", 60017),
  debugHint: f("debug-hint", 60017),
  terminalDecorationSuccess: f("terminal-decoration-success", 60017),
  primitiveSquare: f("primitive-square", 60018),
  edit: f("edit", 60019),
  pencil: f("pencil", 60019),
  info: f("info", 60020),
  issueOpened: f("issue-opened", 60020),
  gistPrivate: f("gist-private", 60021),
  gitForkPrivate: f("git-fork-private", 60021),
  lock: f("lock", 60021),
  mirrorPrivate: f("mirror-private", 60021),
  close: f("close", 60022),
  removeClose: f("remove-close", 60022),
  x: f("x", 60022),
  repoSync: f("repo-sync", 60023),
  sync: f("sync", 60023),
  clone: f("clone", 60024),
  desktopDownload: f("desktop-download", 60024),
  beaker: f("beaker", 60025),
  microscope: f("microscope", 60025),
  vm: f("vm", 60026),
  deviceDesktop: f("device-desktop", 60026),
  file: f("file", 60027),
  fileText: f("file-text", 60027),
  more: f("more", 60028),
  ellipsis: f("ellipsis", 60028),
  kebabHorizontal: f("kebab-horizontal", 60028),
  mailReply: f("mail-reply", 60029),
  reply: f("reply", 60029),
  organization: f("organization", 60030),
  organizationFilled: f("organization-filled", 60030),
  organizationOutline: f("organization-outline", 60030),
  newFile: f("new-file", 60031),
  fileAdd: f("file-add", 60031),
  newFolder: f("new-folder", 60032),
  fileDirectoryCreate: f("file-directory-create", 60032),
  trash: f("trash", 60033),
  trashcan: f("trashcan", 60033),
  history: f("history", 60034),
  clock: f("clock", 60034),
  folder: f("folder", 60035),
  fileDirectory: f("file-directory", 60035),
  symbolFolder: f("symbol-folder", 60035),
  logoGithub: f("logo-github", 60036),
  markGithub: f("mark-github", 60036),
  github: f("github", 60036),
  terminal: f("terminal", 60037),
  console: f("console", 60037),
  repl: f("repl", 60037),
  zap: f("zap", 60038),
  symbolEvent: f("symbol-event", 60038),
  error: f("error", 60039),
  stop: f("stop", 60039),
  variable: f("variable", 60040),
  symbolVariable: f("symbol-variable", 60040),
  array: f("array", 60042),
  symbolArray: f("symbol-array", 60042),
  symbolModule: f("symbol-module", 60043),
  symbolPackage: f("symbol-package", 60043),
  symbolNamespace: f("symbol-namespace", 60043),
  symbolObject: f("symbol-object", 60043),
  symbolMethod: f("symbol-method", 60044),
  symbolFunction: f("symbol-function", 60044),
  symbolConstructor: f("symbol-constructor", 60044),
  symbolBoolean: f("symbol-boolean", 60047),
  symbolNull: f("symbol-null", 60047),
  symbolNumeric: f("symbol-numeric", 60048),
  symbolNumber: f("symbol-number", 60048),
  symbolStructure: f("symbol-structure", 60049),
  symbolStruct: f("symbol-struct", 60049),
  symbolParameter: f("symbol-parameter", 60050),
  symbolTypeParameter: f("symbol-type-parameter", 60050),
  symbolKey: f("symbol-key", 60051),
  symbolText: f("symbol-text", 60051),
  symbolReference: f("symbol-reference", 60052),
  goToFile: f("go-to-file", 60052),
  symbolEnum: f("symbol-enum", 60053),
  symbolValue: f("symbol-value", 60053),
  symbolRuler: f("symbol-ruler", 60054),
  symbolUnit: f("symbol-unit", 60054),
  activateBreakpoints: f("activate-breakpoints", 60055),
  archive: f("archive", 60056),
  arrowBoth: f("arrow-both", 60057),
  arrowDown: f("arrow-down", 60058),
  arrowLeft: f("arrow-left", 60059),
  arrowRight: f("arrow-right", 60060),
  arrowSmallDown: f("arrow-small-down", 60061),
  arrowSmallLeft: f("arrow-small-left", 60062),
  arrowSmallRight: f("arrow-small-right", 60063),
  arrowSmallUp: f("arrow-small-up", 60064),
  arrowUp: f("arrow-up", 60065),
  bell: f("bell", 60066),
  bold: f("bold", 60067),
  book: f("book", 60068),
  bookmark: f("bookmark", 60069),
  debugBreakpointConditionalUnverified: f("debug-breakpoint-conditional-unverified", 60070),
  debugBreakpointConditional: f("debug-breakpoint-conditional", 60071),
  debugBreakpointConditionalDisabled: f("debug-breakpoint-conditional-disabled", 60071),
  debugBreakpointDataUnverified: f("debug-breakpoint-data-unverified", 60072),
  debugBreakpointData: f("debug-breakpoint-data", 60073),
  debugBreakpointDataDisabled: f("debug-breakpoint-data-disabled", 60073),
  debugBreakpointLogUnverified: f("debug-breakpoint-log-unverified", 60074),
  debugBreakpointLog: f("debug-breakpoint-log", 60075),
  debugBreakpointLogDisabled: f("debug-breakpoint-log-disabled", 60075),
  briefcase: f("briefcase", 60076),
  broadcast: f("broadcast", 60077),
  browser: f("browser", 60078),
  bug: f("bug", 60079),
  calendar: f("calendar", 60080),
  caseSensitive: f("case-sensitive", 60081),
  check: f("check", 60082),
  checklist: f("checklist", 60083),
  chevronDown: f("chevron-down", 60084),
  chevronLeft: f("chevron-left", 60085),
  chevronRight: f("chevron-right", 60086),
  chevronUp: f("chevron-up", 60087),
  chromeClose: f("chrome-close", 60088),
  chromeMaximize: f("chrome-maximize", 60089),
  chromeMinimize: f("chrome-minimize", 60090),
  chromeRestore: f("chrome-restore", 60091),
  circleOutline: f("circle-outline", 60092),
  circle: f("circle", 60092),
  debugBreakpointUnverified: f("debug-breakpoint-unverified", 60092),
  terminalDecorationIncomplete: f("terminal-decoration-incomplete", 60092),
  circleSlash: f("circle-slash", 60093),
  circuitBoard: f("circuit-board", 60094),
  clearAll: f("clear-all", 60095),
  clippy: f("clippy", 60096),
  closeAll: f("close-all", 60097),
  cloudDownload: f("cloud-download", 60098),
  cloudUpload: f("cloud-upload", 60099),
  code: f("code", 60100),
  collapseAll: f("collapse-all", 60101),
  colorMode: f("color-mode", 60102),
  commentDiscussion: f("comment-discussion", 60103),
  creditCard: f("credit-card", 60105),
  dash: f("dash", 60108),
  dashboard: f("dashboard", 60109),
  database: f("database", 60110),
  debugContinue: f("debug-continue", 60111),
  debugDisconnect: f("debug-disconnect", 60112),
  debugPause: f("debug-pause", 60113),
  debugRestart: f("debug-restart", 60114),
  debugStart: f("debug-start", 60115),
  debugStepInto: f("debug-step-into", 60116),
  debugStepOut: f("debug-step-out", 60117),
  debugStepOver: f("debug-step-over", 60118),
  debugStop: f("debug-stop", 60119),
  debug: f("debug", 60120),
  deviceCameraVideo: f("device-camera-video", 60121),
  deviceCamera: f("device-camera", 60122),
  deviceMobile: f("device-mobile", 60123),
  diffAdded: f("diff-added", 60124),
  diffIgnored: f("diff-ignored", 60125),
  diffModified: f("diff-modified", 60126),
  diffRemoved: f("diff-removed", 60127),
  diffRenamed: f("diff-renamed", 60128),
  diff: f("diff", 60129),
  diffSidebyside: f("diff-sidebyside", 60129),
  discard: f("discard", 60130),
  editorLayout: f("editor-layout", 60131),
  emptyWindow: f("empty-window", 60132),
  exclude: f("exclude", 60133),
  extensions: f("extensions", 60134),
  eyeClosed: f("eye-closed", 60135),
  fileBinary: f("file-binary", 60136),
  fileCode: f("file-code", 60137),
  fileMedia: f("file-media", 60138),
  filePdf: f("file-pdf", 60139),
  fileSubmodule: f("file-submodule", 60140),
  fileSymlinkDirectory: f("file-symlink-directory", 60141),
  fileSymlinkFile: f("file-symlink-file", 60142),
  fileZip: f("file-zip", 60143),
  files: f("files", 60144),
  filter: f("filter", 60145),
  flame: f("flame", 60146),
  foldDown: f("fold-down", 60147),
  foldUp: f("fold-up", 60148),
  fold: f("fold", 60149),
  folderActive: f("folder-active", 60150),
  folderOpened: f("folder-opened", 60151),
  gear: f("gear", 60152),
  gift: f("gift", 60153),
  gistSecret: f("gist-secret", 60154),
  gist: f("gist", 60155),
  gitCommit: f("git-commit", 60156),
  gitCompare: f("git-compare", 60157),
  compareChanges: f("compare-changes", 60157),
  gitMerge: f("git-merge", 60158),
  githubAction: f("github-action", 60159),
  githubAlt: f("github-alt", 60160),
  globe: f("globe", 60161),
  grabber: f("grabber", 60162),
  graph: f("graph", 60163),
  gripper: f("gripper", 60164),
  heart: f("heart", 60165),
  home: f("home", 60166),
  horizontalRule: f("horizontal-rule", 60167),
  hubot: f("hubot", 60168),
  inbox: f("inbox", 60169),
  issueReopened: f("issue-reopened", 60171),
  issues: f("issues", 60172),
  italic: f("italic", 60173),
  jersey: f("jersey", 60174),
  json: f("json", 60175),
  kebabVertical: f("kebab-vertical", 60176),
  key: f("key", 60177),
  law: f("law", 60178),
  lightbulbAutofix: f("lightbulb-autofix", 60179),
  linkExternal: f("link-external", 60180),
  link: f("link", 60181),
  listOrdered: f("list-ordered", 60182),
  listUnordered: f("list-unordered", 60183),
  liveShare: f("live-share", 60184),
  loading: f("loading", 60185),
  location: f("location", 60186),
  mailRead: f("mail-read", 60187),
  mail: f("mail", 60188),
  markdown: f("markdown", 60189),
  megaphone: f("megaphone", 60190),
  mention: f("mention", 60191),
  milestone: f("milestone", 60192),
  gitPullRequestMilestone: f("git-pull-request-milestone", 60192),
  mortarBoard: f("mortar-board", 60193),
  move: f("move", 60194),
  multipleWindows: f("multiple-windows", 60195),
  mute: f("mute", 60196),
  noNewline: f("no-newline", 60197),
  note: f("note", 60198),
  octoface: f("octoface", 60199),
  openPreview: f("open-preview", 60200),
  package: f("package", 60201),
  paintcan: f("paintcan", 60202),
  pin: f("pin", 60203),
  play: f("play", 60204),
  run: f("run", 60204),
  plug: f("plug", 60205),
  preserveCase: f("preserve-case", 60206),
  preview: f("preview", 60207),
  project: f("project", 60208),
  pulse: f("pulse", 60209),
  question: f("question", 60210),
  quote: f("quote", 60211),
  radioTower: f("radio-tower", 60212),
  reactions: f("reactions", 60213),
  references: f("references", 60214),
  refresh: f("refresh", 60215),
  regex: f("regex", 60216),
  remoteExplorer: f("remote-explorer", 60217),
  remote: f("remote", 60218),
  remove: f("remove", 60219),
  replaceAll: f("replace-all", 60220),
  replace: f("replace", 60221),
  repoClone: f("repo-clone", 60222),
  repoForcePush: f("repo-force-push", 60223),
  repoPull: f("repo-pull", 60224),
  repoPush: f("repo-push", 60225),
  report: f("report", 60226),
  requestChanges: f("request-changes", 60227),
  rocket: f("rocket", 60228),
  rootFolderOpened: f("root-folder-opened", 60229),
  rootFolder: f("root-folder", 60230),
  rss: f("rss", 60231),
  ruby: f("ruby", 60232),
  saveAll: f("save-all", 60233),
  saveAs: f("save-as", 60234),
  save: f("save", 60235),
  screenFull: f("screen-full", 60236),
  screenNormal: f("screen-normal", 60237),
  searchStop: f("search-stop", 60238),
  server: f("server", 60240),
  settingsGear: f("settings-gear", 60241),
  settings: f("settings", 60242),
  shield: f("shield", 60243),
  smiley: f("smiley", 60244),
  sortPrecedence: f("sort-precedence", 60245),
  splitHorizontal: f("split-horizontal", 60246),
  splitVertical: f("split-vertical", 60247),
  squirrel: f("squirrel", 60248),
  starFull: f("star-full", 60249),
  starHalf: f("star-half", 60250),
  symbolClass: f("symbol-class", 60251),
  symbolColor: f("symbol-color", 60252),
  symbolConstant: f("symbol-constant", 60253),
  symbolEnumMember: f("symbol-enum-member", 60254),
  symbolField: f("symbol-field", 60255),
  symbolFile: f("symbol-file", 60256),
  symbolInterface: f("symbol-interface", 60257),
  symbolKeyword: f("symbol-keyword", 60258),
  symbolMisc: f("symbol-misc", 60259),
  symbolOperator: f("symbol-operator", 60260),
  symbolProperty: f("symbol-property", 60261),
  wrench: f("wrench", 60261),
  wrenchSubaction: f("wrench-subaction", 60261),
  symbolSnippet: f("symbol-snippet", 60262),
  tasklist: f("tasklist", 60263),
  telescope: f("telescope", 60264),
  textSize: f("text-size", 60265),
  threeBars: f("three-bars", 60266),
  thumbsdown: f("thumbsdown", 60267),
  thumbsup: f("thumbsup", 60268),
  tools: f("tools", 60269),
  triangleDown: f("triangle-down", 60270),
  triangleLeft: f("triangle-left", 60271),
  triangleRight: f("triangle-right", 60272),
  triangleUp: f("triangle-up", 60273),
  twitter: f("twitter", 60274),
  unfold: f("unfold", 60275),
  unlock: f("unlock", 60276),
  unmute: f("unmute", 60277),
  unverified: f("unverified", 60278),
  verified: f("verified", 60279),
  versions: f("versions", 60280),
  vmActive: f("vm-active", 60281),
  vmOutline: f("vm-outline", 60282),
  vmRunning: f("vm-running", 60283),
  watch: f("watch", 60284),
  whitespace: f("whitespace", 60285),
  wholeWord: f("whole-word", 60286),
  window: f("window", 60287),
  wordWrap: f("word-wrap", 60288),
  zoomIn: f("zoom-in", 60289),
  zoomOut: f("zoom-out", 60290),
  listFilter: f("list-filter", 60291),
  listFlat: f("list-flat", 60292),
  listSelection: f("list-selection", 60293),
  selection: f("selection", 60293),
  listTree: f("list-tree", 60294),
  debugBreakpointFunctionUnverified: f("debug-breakpoint-function-unverified", 60295),
  debugBreakpointFunction: f("debug-breakpoint-function", 60296),
  debugBreakpointFunctionDisabled: f("debug-breakpoint-function-disabled", 60296),
  debugStackframeActive: f("debug-stackframe-active", 60297),
  circleSmallFilled: f("circle-small-filled", 60298),
  debugStackframeDot: f("debug-stackframe-dot", 60298),
  terminalDecorationMark: f("terminal-decoration-mark", 60298),
  debugStackframe: f("debug-stackframe", 60299),
  debugStackframeFocused: f("debug-stackframe-focused", 60299),
  debugBreakpointUnsupported: f("debug-breakpoint-unsupported", 60300),
  symbolString: f("symbol-string", 60301),
  debugReverseContinue: f("debug-reverse-continue", 60302),
  debugStepBack: f("debug-step-back", 60303),
  debugRestartFrame: f("debug-restart-frame", 60304),
  debugAlt: f("debug-alt", 60305),
  callIncoming: f("call-incoming", 60306),
  callOutgoing: f("call-outgoing", 60307),
  menu: f("menu", 60308),
  expandAll: f("expand-all", 60309),
  feedback: f("feedback", 60310),
  gitPullRequestReviewer: f("git-pull-request-reviewer", 60310),
  groupByRefType: f("group-by-ref-type", 60311),
  ungroupByRefType: f("ungroup-by-ref-type", 60312),
  account: f("account", 60313),
  gitPullRequestAssignee: f("git-pull-request-assignee", 60313),
  bellDot: f("bell-dot", 60314),
  debugConsole: f("debug-console", 60315),
  library: f("library", 60316),
  output: f("output", 60317),
  runAll: f("run-all", 60318),
  syncIgnored: f("sync-ignored", 60319),
  pinned: f("pinned", 60320),
  githubInverted: f("github-inverted", 60321),
  serverProcess: f("server-process", 60322),
  serverEnvironment: f("server-environment", 60323),
  pass: f("pass", 60324),
  issueClosed: f("issue-closed", 60324),
  stopCircle: f("stop-circle", 60325),
  playCircle: f("play-circle", 60326),
  record: f("record", 60327),
  debugAltSmall: f("debug-alt-small", 60328),
  vmConnect: f("vm-connect", 60329),
  cloud: f("cloud", 60330),
  merge: f("merge", 60331),
  export: f("export", 60332),
  graphLeft: f("graph-left", 60333),
  magnet: f("magnet", 60334),
  notebook: f("notebook", 60335),
  redo: f("redo", 60336),
  checkAll: f("check-all", 60337),
  pinnedDirty: f("pinned-dirty", 60338),
  passFilled: f("pass-filled", 60339),
  circleLargeFilled: f("circle-large-filled", 60340),
  circleLarge: f("circle-large", 60341),
  circleLargeOutline: f("circle-large-outline", 60341),
  combine: f("combine", 60342),
  gather: f("gather", 60342),
  table: f("table", 60343),
  variableGroup: f("variable-group", 60344),
  typeHierarchy: f("type-hierarchy", 60345),
  typeHierarchySub: f("type-hierarchy-sub", 60346),
  typeHierarchySuper: f("type-hierarchy-super", 60347),
  gitPullRequestCreate: f("git-pull-request-create", 60348),
  runAbove: f("run-above", 60349),
  runBelow: f("run-below", 60350),
  notebookTemplate: f("notebook-template", 60351),
  debugRerun: f("debug-rerun", 60352),
  workspaceTrusted: f("workspace-trusted", 60353),
  workspaceUntrusted: f("workspace-untrusted", 60354),
  workspaceUnknown: f("workspace-unknown", 60355),
  terminalCmd: f("terminal-cmd", 60356),
  terminalDebian: f("terminal-debian", 60357),
  terminalLinux: f("terminal-linux", 60358),
  terminalPowershell: f("terminal-powershell", 60359),
  terminalTmux: f("terminal-tmux", 60360),
  terminalUbuntu: f("terminal-ubuntu", 60361),
  terminalBash: f("terminal-bash", 60362),
  arrowSwap: f("arrow-swap", 60363),
  copy: f("copy", 60364),
  personAdd: f("person-add", 60365),
  filterFilled: f("filter-filled", 60366),
  wand: f("wand", 60367),
  debugLineByLine: f("debug-line-by-line", 60368),
  inspect: f("inspect", 60369),
  layers: f("layers", 60370),
  layersDot: f("layers-dot", 60371),
  layersActive: f("layers-active", 60372),
  compass: f("compass", 60373),
  compassDot: f("compass-dot", 60374),
  compassActive: f("compass-active", 60375),
  azure: f("azure", 60376),
  issueDraft: f("issue-draft", 60377),
  gitPullRequestClosed: f("git-pull-request-closed", 60378),
  gitPullRequestDraft: f("git-pull-request-draft", 60379),
  debugAll: f("debug-all", 60380),
  debugCoverage: f("debug-coverage", 60381),
  runErrors: f("run-errors", 60382),
  folderLibrary: f("folder-library", 60383),
  debugContinueSmall: f("debug-continue-small", 60384),
  beakerStop: f("beaker-stop", 60385),
  graphLine: f("graph-line", 60386),
  graphScatter: f("graph-scatter", 60387),
  pieChart: f("pie-chart", 60388),
  bracket: f("bracket", 60175),
  bracketDot: f("bracket-dot", 60389),
  bracketError: f("bracket-error", 60390),
  lockSmall: f("lock-small", 60391),
  azureDevops: f("azure-devops", 60392),
  verifiedFilled: f("verified-filled", 60393),
  newline: f("newline", 60394),
  layout: f("layout", 60395),
  layoutActivitybarLeft: f("layout-activitybar-left", 60396),
  layoutActivitybarRight: f("layout-activitybar-right", 60397),
  layoutPanelLeft: f("layout-panel-left", 60398),
  layoutPanelCenter: f("layout-panel-center", 60399),
  layoutPanelJustify: f("layout-panel-justify", 60400),
  layoutPanelRight: f("layout-panel-right", 60401),
  layoutPanel: f("layout-panel", 60402),
  layoutSidebarLeft: f("layout-sidebar-left", 60403),
  layoutSidebarRight: f("layout-sidebar-right", 60404),
  layoutStatusbar: f("layout-statusbar", 60405),
  layoutMenubar: f("layout-menubar", 60406),
  layoutCentered: f("layout-centered", 60407),
  target: f("target", 60408),
  indent: f("indent", 60409),
  recordSmall: f("record-small", 60410),
  errorSmall: f("error-small", 60411),
  terminalDecorationError: f("terminal-decoration-error", 60411),
  arrowCircleDown: f("arrow-circle-down", 60412),
  arrowCircleLeft: f("arrow-circle-left", 60413),
  arrowCircleRight: f("arrow-circle-right", 60414),
  arrowCircleUp: f("arrow-circle-up", 60415),
  layoutSidebarRightOff: f("layout-sidebar-right-off", 60416),
  layoutPanelOff: f("layout-panel-off", 60417),
  layoutSidebarLeftOff: f("layout-sidebar-left-off", 60418),
  blank: f("blank", 60419),
  heartFilled: f("heart-filled", 60420),
  map: f("map", 60421),
  mapHorizontal: f("map-horizontal", 60421),
  foldHorizontal: f("fold-horizontal", 60421),
  mapFilled: f("map-filled", 60422),
  mapHorizontalFilled: f("map-horizontal-filled", 60422),
  foldHorizontalFilled: f("fold-horizontal-filled", 60422),
  circleSmall: f("circle-small", 60423),
  bellSlash: f("bell-slash", 60424),
  bellSlashDot: f("bell-slash-dot", 60425),
  commentUnresolved: f("comment-unresolved", 60426),
  gitPullRequestGoToChanges: f("git-pull-request-go-to-changes", 60427),
  gitPullRequestNewChanges: f("git-pull-request-new-changes", 60428),
  searchFuzzy: f("search-fuzzy", 60429),
  commentDraft: f("comment-draft", 60430),
  send: f("send", 60431),
  sparkle: f("sparkle", 60432),
  insert: f("insert", 60433),
  mic: f("mic", 60434),
  thumbsdownFilled: f("thumbsdown-filled", 60435),
  thumbsupFilled: f("thumbsup-filled", 60436),
  coffee: f("coffee", 60437),
  snake: f("snake", 60438),
  game: f("game", 60439),
  vr: f("vr", 60440),
  chip: f("chip", 60441),
  piano: f("piano", 60442),
  music: f("music", 60443),
  micFilled: f("mic-filled", 60444),
  repoFetch: f("repo-fetch", 60445),
  copilot: f("copilot", 60446),
  lightbulbSparkle: f("lightbulb-sparkle", 60447),
  robot: f("robot", 60448),
  sparkleFilled: f("sparkle-filled", 60449),
  diffSingle: f("diff-single", 60450),
  diffMultiple: f("diff-multiple", 60451),
  surroundWith: f("surround-with", 60452),
  share: f("share", 60453),
  gitStash: f("git-stash", 60454),
  gitStashApply: f("git-stash-apply", 60455),
  gitStashPop: f("git-stash-pop", 60456),
  vscode: f("vscode", 60457),
  vscodeInsiders: f("vscode-insiders", 60458),
  codeOss: f("code-oss", 60459),
  runCoverage: f("run-coverage", 60460),
  runAllCoverage: f("run-all-coverage", 60461),
  coverage: f("coverage", 60462),
  githubProject: f("github-project", 60463),
  mapVertical: f("map-vertical", 60464),
  foldVertical: f("fold-vertical", 60464),
  mapVerticalFilled: f("map-vertical-filled", 60465),
  foldVerticalFilled: f("fold-vertical-filled", 60465),
  goToSearch: f("go-to-search", 60466),
  percentage: f("percentage", 60467),
  sortPercentage: f("sort-percentage", 60467),
  attach: f("attach", 60468)
}, Fl = {
  dialogError: f("dialog-error", "error"),
  dialogWarning: f("dialog-warning", "warning"),
  dialogInfo: f("dialog-info", "info"),
  dialogClose: f("dialog-close", "close"),
  treeItemExpanded: f("tree-item-expanded", "chevron-down"),
  // collapsed is done with rotation
  treeFilterOnTypeOn: f("tree-filter-on-type-on", "list-filter"),
  treeFilterOnTypeOff: f("tree-filter-on-type-off", "list-selection"),
  treeFilterClear: f("tree-filter-clear", "close"),
  treeItemLoading: f("tree-item-loading", "loading"),
  menuSelection: f("menu-selection", "check"),
  menuSubmenu: f("menu-submenu", "chevron-right"),
  menuBarMore: f("menubar-more", "more"),
  scrollbarButtonLeft: f("scrollbar-button-left", "triangle-left"),
  scrollbarButtonRight: f("scrollbar-button-right", "triangle-right"),
  scrollbarButtonUp: f("scrollbar-button-up", "triangle-up"),
  scrollbarButtonDown: f("scrollbar-button-down", "triangle-down"),
  toolBarMore: f("toolbar-more", "more"),
  quickInputBack: f("quick-input-back", "arrow-left"),
  dropDownButton: f("drop-down-button", 60084),
  symbolCustomColor: f("symbol-customcolor", 60252),
  exportIcon: f("export", 60332),
  workspaceUnspecified: f("workspace-unspecified", 60355),
  newLine: f("newline", 60394),
  thumbsDownFilled: f("thumbsdown-filled", 60435),
  thumbsUpFilled: f("thumbsup-filled", 60436),
  gitFetch: f("git-fetch", 60445),
  lightbulbSparkleAutofix: f("lightbulb-sparkle-autofix", 60447),
  debugBreakpointPending: f("debug-breakpoint-pending", 60377)
}, V = {
  ...Il,
  ...Fl
};
class Ca {
  constructor() {
    this._tokenizationSupports = /* @__PURE__ */ new Map(), this._factories = /* @__PURE__ */ new Map(), this._onDidChange = new Le(), this.onDidChange = this._onDidChange.event, this._colorMap = null;
  }
  handleChange(t) {
    this._onDidChange.fire({
      changedLanguages: t,
      changedColorMap: !1
    });
  }
  register(t, n) {
    return this._tokenizationSupports.set(t, n), this.handleChange([t]), _n(() => {
      this._tokenizationSupports.get(t) === n && (this._tokenizationSupports.delete(t), this.handleChange([t]));
    });
  }
  get(t) {
    return this._tokenizationSupports.get(t) || null;
  }
  registerFactory(t, n) {
    var i;
    (i = this._factories.get(t)) == null || i.dispose();
    const r = new Vl(this, t, n);
    return this._factories.set(t, r), _n(() => {
      const s = this._factories.get(t);
      !s || s !== r || (this._factories.delete(t), s.dispose());
    });
  }
  async getOrCreate(t) {
    const n = this.get(t);
    if (n)
      return n;
    const r = this._factories.get(t);
    return !r || r.isResolved ? null : (await r.resolve(), this.get(t));
  }
  isResolved(t) {
    if (this.get(t))
      return !0;
    const r = this._factories.get(t);
    return !!(!r || r.isResolved);
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
class Vl extends Tt {
  get isResolved() {
    return this._isResolved;
  }
  constructor(t, n, r) {
    super(), this._registry = t, this._languageId = n, this._factory = r, this._isDisposed = !1, this._resolvePromise = null, this._isResolved = !1;
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
class Dl {
  constructor(t, n, r) {
    this.offset = t, this.type = n, this.language = r, this._tokenBrand = void 0;
  }
  toString() {
    return "(" + this.offset + ", " + this.type + ")";
  }
}
var Ai;
(function(e) {
  e[e.Increase = 0] = "Increase", e[e.Decrease = 1] = "Decrease";
})(Ai || (Ai = {}));
var ki;
(function(e) {
  const t = /* @__PURE__ */ new Map();
  t.set(0, V.symbolMethod), t.set(1, V.symbolFunction), t.set(2, V.symbolConstructor), t.set(3, V.symbolField), t.set(4, V.symbolVariable), t.set(5, V.symbolClass), t.set(6, V.symbolStruct), t.set(7, V.symbolInterface), t.set(8, V.symbolModule), t.set(9, V.symbolProperty), t.set(10, V.symbolEvent), t.set(11, V.symbolOperator), t.set(12, V.symbolUnit), t.set(13, V.symbolValue), t.set(15, V.symbolEnum), t.set(14, V.symbolConstant), t.set(15, V.symbolEnum), t.set(16, V.symbolEnumMember), t.set(17, V.symbolKeyword), t.set(27, V.symbolSnippet), t.set(18, V.symbolText), t.set(19, V.symbolColor), t.set(20, V.symbolFile), t.set(21, V.symbolReference), t.set(22, V.symbolCustomColor), t.set(23, V.symbolFolder), t.set(24, V.symbolTypeParameter), t.set(25, V.account), t.set(26, V.issues);
  function n(s) {
    let a = t.get(s);
    return a || (console.info("No codicon found for CompletionItemKind " + s), a = V.symbolProperty), a;
  }
  e.toIcon = n;
  const r = /* @__PURE__ */ new Map();
  r.set(
    "method",
    0
    /* CompletionItemKind.Method */
  ), r.set(
    "function",
    1
    /* CompletionItemKind.Function */
  ), r.set(
    "constructor",
    2
    /* CompletionItemKind.Constructor */
  ), r.set(
    "field",
    3
    /* CompletionItemKind.Field */
  ), r.set(
    "variable",
    4
    /* CompletionItemKind.Variable */
  ), r.set(
    "class",
    5
    /* CompletionItemKind.Class */
  ), r.set(
    "struct",
    6
    /* CompletionItemKind.Struct */
  ), r.set(
    "interface",
    7
    /* CompletionItemKind.Interface */
  ), r.set(
    "module",
    8
    /* CompletionItemKind.Module */
  ), r.set(
    "property",
    9
    /* CompletionItemKind.Property */
  ), r.set(
    "event",
    10
    /* CompletionItemKind.Event */
  ), r.set(
    "operator",
    11
    /* CompletionItemKind.Operator */
  ), r.set(
    "unit",
    12
    /* CompletionItemKind.Unit */
  ), r.set(
    "value",
    13
    /* CompletionItemKind.Value */
  ), r.set(
    "constant",
    14
    /* CompletionItemKind.Constant */
  ), r.set(
    "enum",
    15
    /* CompletionItemKind.Enum */
  ), r.set(
    "enum-member",
    16
    /* CompletionItemKind.EnumMember */
  ), r.set(
    "enumMember",
    16
    /* CompletionItemKind.EnumMember */
  ), r.set(
    "keyword",
    17
    /* CompletionItemKind.Keyword */
  ), r.set(
    "snippet",
    27
    /* CompletionItemKind.Snippet */
  ), r.set(
    "text",
    18
    /* CompletionItemKind.Text */
  ), r.set(
    "color",
    19
    /* CompletionItemKind.Color */
  ), r.set(
    "file",
    20
    /* CompletionItemKind.File */
  ), r.set(
    "reference",
    21
    /* CompletionItemKind.Reference */
  ), r.set(
    "customcolor",
    22
    /* CompletionItemKind.Customcolor */
  ), r.set(
    "folder",
    23
    /* CompletionItemKind.Folder */
  ), r.set(
    "type-parameter",
    24
    /* CompletionItemKind.TypeParameter */
  ), r.set(
    "typeParameter",
    24
    /* CompletionItemKind.TypeParameter */
  ), r.set(
    "account",
    25
    /* CompletionItemKind.User */
  ), r.set(
    "issue",
    26
    /* CompletionItemKind.Issue */
  );
  function i(s, a) {
    let l = r.get(s);
    return typeof l > "u" && !a && (l = 9), l;
  }
  e.fromString = i;
})(ki || (ki = {}));
var Ri;
(function(e) {
  e[e.Automatic = 0] = "Automatic", e[e.Explicit = 1] = "Explicit";
})(Ri || (Ri = {}));
var Ei;
(function(e) {
  e[e.Automatic = 0] = "Automatic", e[e.PasteAs = 1] = "PasteAs";
})(Ei || (Ei = {}));
var Mi;
(function(e) {
  e[e.Invoke = 1] = "Invoke", e[e.TriggerCharacter = 2] = "TriggerCharacter", e[e.ContentChange = 3] = "ContentChange";
})(Mi || (Mi = {}));
var Ci;
(function(e) {
  e[e.Text = 0] = "Text", e[e.Read = 1] = "Read", e[e.Write = 2] = "Write";
})(Ci || (Ci = {}));
X("Array", "array"), X("Boolean", "boolean"), X("Class", "class"), X("Constant", "constant"), X("Constructor", "constructor"), X("Enum", "enumeration"), X("EnumMember", "enumeration member"), X("Event", "event"), X("Field", "field"), X("File", "file"), X("Function", "function"), X("Interface", "interface"), X("Key", "key"), X("Method", "method"), X("Module", "module"), X("Namespace", "namespace"), X("Null", "null"), X("Number", "number"), X("Object", "object"), X("Operator", "operator"), X("Package", "package"), X("Property", "property"), X("String", "string"), X("Struct", "struct"), X("TypeParameter", "type parameter"), X("Variable", "variable");
var Ti;
(function(e) {
  const t = /* @__PURE__ */ new Map();
  t.set(0, V.symbolFile), t.set(1, V.symbolModule), t.set(2, V.symbolNamespace), t.set(3, V.symbolPackage), t.set(4, V.symbolClass), t.set(5, V.symbolMethod), t.set(6, V.symbolProperty), t.set(7, V.symbolField), t.set(8, V.symbolConstructor), t.set(9, V.symbolEnum), t.set(10, V.symbolInterface), t.set(11, V.symbolFunction), t.set(12, V.symbolVariable), t.set(13, V.symbolConstant), t.set(14, V.symbolString), t.set(15, V.symbolNumber), t.set(16, V.symbolBoolean), t.set(17, V.symbolArray), t.set(18, V.symbolObject), t.set(19, V.symbolKey), t.set(20, V.symbolNull), t.set(21, V.symbolEnumMember), t.set(22, V.symbolStruct), t.set(23, V.symbolEvent), t.set(24, V.symbolOperator), t.set(25, V.symbolTypeParameter);
  function n(r) {
    let i = t.get(r);
    return i || (console.info("No codicon found for SymbolKind " + r), i = V.symbolProperty), i;
  }
  e.toIcon = n;
})(Ti || (Ti = {}));
var pe;
let a0 = (pe = class {
  /**
   * Returns a {@link FoldingRangeKind} for the given value.
   *
   * @param value of the kind.
   */
  static fromValue(t) {
    switch (t) {
      case "comment":
        return pe.Comment;
      case "imports":
        return pe.Imports;
      case "region":
        return pe.Region;
    }
    return new pe(t);
  }
  /**
   * Creates a new {@link FoldingRangeKind}.
   *
   * @param value of the kind.
   */
  constructor(t) {
    this.value = t;
  }
}, pe.Comment = new pe("comment"), pe.Imports = new pe("imports"), pe.Region = new pe("region"), pe);
var Pi;
(function(e) {
  e[e.AIGenerated = 1] = "AIGenerated";
})(Pi || (Pi = {}));
var Ii;
(function(e) {
  e[e.Invoke = 0] = "Invoke", e[e.Automatic = 1] = "Automatic";
})(Ii || (Ii = {}));
var Fi;
(function(e) {
  function t(n) {
    return !n || typeof n != "object" ? !1 : typeof n.id == "string" && typeof n.title == "string";
  }
  e.is = t;
})(Fi || (Fi = {}));
var Vi;
(function(e) {
  e[e.Type = 1] = "Type", e[e.Parameter = 2] = "Parameter";
})(Vi || (Vi = {}));
new Ca();
new Ca();
var Di;
(function(e) {
  e[e.Invoke = 0] = "Invoke", e[e.Automatic = 1] = "Automatic";
})(Di || (Di = {}));
var Oi;
(function(e) {
  e[e.Unknown = 0] = "Unknown", e[e.Disabled = 1] = "Disabled", e[e.Enabled = 2] = "Enabled";
})(Oi || (Oi = {}));
var $i;
(function(e) {
  e[e.Invoke = 1] = "Invoke", e[e.Auto = 2] = "Auto";
})($i || ($i = {}));
var Ui;
(function(e) {
  e[e.None = 0] = "None", e[e.KeepWhitespace = 1] = "KeepWhitespace", e[e.InsertAsSnippet = 4] = "InsertAsSnippet";
})(Ui || (Ui = {}));
var Bi;
(function(e) {
  e[e.Method = 0] = "Method", e[e.Function = 1] = "Function", e[e.Constructor = 2] = "Constructor", e[e.Field = 3] = "Field", e[e.Variable = 4] = "Variable", e[e.Class = 5] = "Class", e[e.Struct = 6] = "Struct", e[e.Interface = 7] = "Interface", e[e.Module = 8] = "Module", e[e.Property = 9] = "Property", e[e.Event = 10] = "Event", e[e.Operator = 11] = "Operator", e[e.Unit = 12] = "Unit", e[e.Value = 13] = "Value", e[e.Constant = 14] = "Constant", e[e.Enum = 15] = "Enum", e[e.EnumMember = 16] = "EnumMember", e[e.Keyword = 17] = "Keyword", e[e.Text = 18] = "Text", e[e.Color = 19] = "Color", e[e.File = 20] = "File", e[e.Reference = 21] = "Reference", e[e.Customcolor = 22] = "Customcolor", e[e.Folder = 23] = "Folder", e[e.TypeParameter = 24] = "TypeParameter", e[e.User = 25] = "User", e[e.Issue = 26] = "Issue", e[e.Snippet = 27] = "Snippet";
})(Bi || (Bi = {}));
var qi;
(function(e) {
  e[e.Deprecated = 1] = "Deprecated";
})(qi || (qi = {}));
var ji;
(function(e) {
  e[e.Invoke = 0] = "Invoke", e[e.TriggerCharacter = 1] = "TriggerCharacter", e[e.TriggerForIncompleteCompletions = 2] = "TriggerForIncompleteCompletions";
})(ji || (ji = {}));
var Wi;
(function(e) {
  e[e.EXACT = 0] = "EXACT", e[e.ABOVE = 1] = "ABOVE", e[e.BELOW = 2] = "BELOW";
})(Wi || (Wi = {}));
var Hi;
(function(e) {
  e[e.NotSet = 0] = "NotSet", e[e.ContentFlush = 1] = "ContentFlush", e[e.RecoverFromMarkers = 2] = "RecoverFromMarkers", e[e.Explicit = 3] = "Explicit", e[e.Paste = 4] = "Paste", e[e.Undo = 5] = "Undo", e[e.Redo = 6] = "Redo";
})(Hi || (Hi = {}));
var zi;
(function(e) {
  e[e.LF = 1] = "LF", e[e.CRLF = 2] = "CRLF";
})(zi || (zi = {}));
var Gi;
(function(e) {
  e[e.Text = 0] = "Text", e[e.Read = 1] = "Read", e[e.Write = 2] = "Write";
})(Gi || (Gi = {}));
var Ji;
(function(e) {
  e[e.None = 0] = "None", e[e.Keep = 1] = "Keep", e[e.Brackets = 2] = "Brackets", e[e.Advanced = 3] = "Advanced", e[e.Full = 4] = "Full";
})(Ji || (Ji = {}));
var Xi;
(function(e) {
  e[e.acceptSuggestionOnCommitCharacter = 0] = "acceptSuggestionOnCommitCharacter", e[e.acceptSuggestionOnEnter = 1] = "acceptSuggestionOnEnter", e[e.accessibilitySupport = 2] = "accessibilitySupport", e[e.accessibilityPageSize = 3] = "accessibilityPageSize", e[e.ariaLabel = 4] = "ariaLabel", e[e.ariaRequired = 5] = "ariaRequired", e[e.autoClosingBrackets = 6] = "autoClosingBrackets", e[e.autoClosingComments = 7] = "autoClosingComments", e[e.screenReaderAnnounceInlineSuggestion = 8] = "screenReaderAnnounceInlineSuggestion", e[e.autoClosingDelete = 9] = "autoClosingDelete", e[e.autoClosingOvertype = 10] = "autoClosingOvertype", e[e.autoClosingQuotes = 11] = "autoClosingQuotes", e[e.autoIndent = 12] = "autoIndent", e[e.automaticLayout = 13] = "automaticLayout", e[e.autoSurround = 14] = "autoSurround", e[e.bracketPairColorization = 15] = "bracketPairColorization", e[e.guides = 16] = "guides", e[e.codeLens = 17] = "codeLens", e[e.codeLensFontFamily = 18] = "codeLensFontFamily", e[e.codeLensFontSize = 19] = "codeLensFontSize", e[e.colorDecorators = 20] = "colorDecorators", e[e.colorDecoratorsLimit = 21] = "colorDecoratorsLimit", e[e.columnSelection = 22] = "columnSelection", e[e.comments = 23] = "comments", e[e.contextmenu = 24] = "contextmenu", e[e.copyWithSyntaxHighlighting = 25] = "copyWithSyntaxHighlighting", e[e.cursorBlinking = 26] = "cursorBlinking", e[e.cursorSmoothCaretAnimation = 27] = "cursorSmoothCaretAnimation", e[e.cursorStyle = 28] = "cursorStyle", e[e.cursorSurroundingLines = 29] = "cursorSurroundingLines", e[e.cursorSurroundingLinesStyle = 30] = "cursorSurroundingLinesStyle", e[e.cursorWidth = 31] = "cursorWidth", e[e.disableLayerHinting = 32] = "disableLayerHinting", e[e.disableMonospaceOptimizations = 33] = "disableMonospaceOptimizations", e[e.domReadOnly = 34] = "domReadOnly", e[e.dragAndDrop = 35] = "dragAndDrop", e[e.dropIntoEditor = 36] = "dropIntoEditor", e[e.emptySelectionClipboard = 37] = "emptySelectionClipboard", e[e.experimentalWhitespaceRendering = 38] = "experimentalWhitespaceRendering", e[e.extraEditorClassName = 39] = "extraEditorClassName", e[e.fastScrollSensitivity = 40] = "fastScrollSensitivity", e[e.find = 41] = "find", e[e.fixedOverflowWidgets = 42] = "fixedOverflowWidgets", e[e.folding = 43] = "folding", e[e.foldingStrategy = 44] = "foldingStrategy", e[e.foldingHighlight = 45] = "foldingHighlight", e[e.foldingImportsByDefault = 46] = "foldingImportsByDefault", e[e.foldingMaximumRegions = 47] = "foldingMaximumRegions", e[e.unfoldOnClickAfterEndOfLine = 48] = "unfoldOnClickAfterEndOfLine", e[e.fontFamily = 49] = "fontFamily", e[e.fontInfo = 50] = "fontInfo", e[e.fontLigatures = 51] = "fontLigatures", e[e.fontSize = 52] = "fontSize", e[e.fontWeight = 53] = "fontWeight", e[e.fontVariations = 54] = "fontVariations", e[e.formatOnPaste = 55] = "formatOnPaste", e[e.formatOnType = 56] = "formatOnType", e[e.glyphMargin = 57] = "glyphMargin", e[e.gotoLocation = 58] = "gotoLocation", e[e.hideCursorInOverviewRuler = 59] = "hideCursorInOverviewRuler", e[e.hover = 60] = "hover", e[e.inDiffEditor = 61] = "inDiffEditor", e[e.inlineSuggest = 62] = "inlineSuggest", e[e.inlineEdit = 63] = "inlineEdit", e[e.letterSpacing = 64] = "letterSpacing", e[e.lightbulb = 65] = "lightbulb", e[e.lineDecorationsWidth = 66] = "lineDecorationsWidth", e[e.lineHeight = 67] = "lineHeight", e[e.lineNumbers = 68] = "lineNumbers", e[e.lineNumbersMinChars = 69] = "lineNumbersMinChars", e[e.linkedEditing = 70] = "linkedEditing", e[e.links = 71] = "links", e[e.matchBrackets = 72] = "matchBrackets", e[e.minimap = 73] = "minimap", e[e.mouseStyle = 74] = "mouseStyle", e[e.mouseWheelScrollSensitivity = 75] = "mouseWheelScrollSensitivity", e[e.mouseWheelZoom = 76] = "mouseWheelZoom", e[e.multiCursorMergeOverlapping = 77] = "multiCursorMergeOverlapping", e[e.multiCursorModifier = 78] = "multiCursorModifier", e[e.multiCursorPaste = 79] = "multiCursorPaste", e[e.multiCursorLimit = 80] = "multiCursorLimit", e[e.occurrencesHighlight = 81] = "occurrencesHighlight", e[e.overviewRulerBorder = 82] = "overviewRulerBorder", e[e.overviewRulerLanes = 83] = "overviewRulerLanes", e[e.padding = 84] = "padding", e[e.pasteAs = 85] = "pasteAs", e[e.parameterHints = 86] = "parameterHints", e[e.peekWidgetDefaultFocus = 87] = "peekWidgetDefaultFocus", e[e.placeholder = 88] = "placeholder", e[e.definitionLinkOpensInPeek = 89] = "definitionLinkOpensInPeek", e[e.quickSuggestions = 90] = "quickSuggestions", e[e.quickSuggestionsDelay = 91] = "quickSuggestionsDelay", e[e.readOnly = 92] = "readOnly", e[e.readOnlyMessage = 93] = "readOnlyMessage", e[e.renameOnType = 94] = "renameOnType", e[e.renderControlCharacters = 95] = "renderControlCharacters", e[e.renderFinalNewline = 96] = "renderFinalNewline", e[e.renderLineHighlight = 97] = "renderLineHighlight", e[e.renderLineHighlightOnlyWhenFocus = 98] = "renderLineHighlightOnlyWhenFocus", e[e.renderValidationDecorations = 99] = "renderValidationDecorations", e[e.renderWhitespace = 100] = "renderWhitespace", e[e.revealHorizontalRightPadding = 101] = "revealHorizontalRightPadding", e[e.roundedSelection = 102] = "roundedSelection", e[e.rulers = 103] = "rulers", e[e.scrollbar = 104] = "scrollbar", e[e.scrollBeyondLastColumn = 105] = "scrollBeyondLastColumn", e[e.scrollBeyondLastLine = 106] = "scrollBeyondLastLine", e[e.scrollPredominantAxis = 107] = "scrollPredominantAxis", e[e.selectionClipboard = 108] = "selectionClipboard", e[e.selectionHighlight = 109] = "selectionHighlight", e[e.selectOnLineNumbers = 110] = "selectOnLineNumbers", e[e.showFoldingControls = 111] = "showFoldingControls", e[e.showUnused = 112] = "showUnused", e[e.snippetSuggestions = 113] = "snippetSuggestions", e[e.smartSelect = 114] = "smartSelect", e[e.smoothScrolling = 115] = "smoothScrolling", e[e.stickyScroll = 116] = "stickyScroll", e[e.stickyTabStops = 117] = "stickyTabStops", e[e.stopRenderingLineAfter = 118] = "stopRenderingLineAfter", e[e.suggest = 119] = "suggest", e[e.suggestFontSize = 120] = "suggestFontSize", e[e.suggestLineHeight = 121] = "suggestLineHeight", e[e.suggestOnTriggerCharacters = 122] = "suggestOnTriggerCharacters", e[e.suggestSelection = 123] = "suggestSelection", e[e.tabCompletion = 124] = "tabCompletion", e[e.tabIndex = 125] = "tabIndex", e[e.unicodeHighlighting = 126] = "unicodeHighlighting", e[e.unusualLineTerminators = 127] = "unusualLineTerminators", e[e.useShadowDOM = 128] = "useShadowDOM", e[e.useTabStops = 129] = "useTabStops", e[e.wordBreak = 130] = "wordBreak", e[e.wordSegmenterLocales = 131] = "wordSegmenterLocales", e[e.wordSeparators = 132] = "wordSeparators", e[e.wordWrap = 133] = "wordWrap", e[e.wordWrapBreakAfterCharacters = 134] = "wordWrapBreakAfterCharacters", e[e.wordWrapBreakBeforeCharacters = 135] = "wordWrapBreakBeforeCharacters", e[e.wordWrapColumn = 136] = "wordWrapColumn", e[e.wordWrapOverride1 = 137] = "wordWrapOverride1", e[e.wordWrapOverride2 = 138] = "wordWrapOverride2", e[e.wrappingIndent = 139] = "wrappingIndent", e[e.wrappingStrategy = 140] = "wrappingStrategy", e[e.showDeprecated = 141] = "showDeprecated", e[e.inlayHints = 142] = "inlayHints", e[e.editorClassName = 143] = "editorClassName", e[e.pixelRatio = 144] = "pixelRatio", e[e.tabFocusMode = 145] = "tabFocusMode", e[e.layoutInfo = 146] = "layoutInfo", e[e.wrappingInfo = 147] = "wrappingInfo", e[e.defaultColorDecorators = 148] = "defaultColorDecorators", e[e.colorDecoratorsActivatedOn = 149] = "colorDecoratorsActivatedOn", e[e.inlineCompletionsAccessibilityVerbose = 150] = "inlineCompletionsAccessibilityVerbose";
})(Xi || (Xi = {}));
var Qi;
(function(e) {
  e[e.TextDefined = 0] = "TextDefined", e[e.LF = 1] = "LF", e[e.CRLF = 2] = "CRLF";
})(Qi || (Qi = {}));
var Yi;
(function(e) {
  e[e.LF = 0] = "LF", e[e.CRLF = 1] = "CRLF";
})(Yi || (Yi = {}));
var Zi;
(function(e) {
  e[e.Left = 1] = "Left", e[e.Center = 2] = "Center", e[e.Right = 3] = "Right";
})(Zi || (Zi = {}));
var Ki;
(function(e) {
  e[e.Increase = 0] = "Increase", e[e.Decrease = 1] = "Decrease";
})(Ki || (Ki = {}));
var es;
(function(e) {
  e[e.None = 0] = "None", e[e.Indent = 1] = "Indent", e[e.IndentOutdent = 2] = "IndentOutdent", e[e.Outdent = 3] = "Outdent";
})(es || (es = {}));
var ts;
(function(e) {
  e[e.Both = 0] = "Both", e[e.Right = 1] = "Right", e[e.Left = 2] = "Left", e[e.None = 3] = "None";
})(ts || (ts = {}));
var ns;
(function(e) {
  e[e.Type = 1] = "Type", e[e.Parameter = 2] = "Parameter";
})(ns || (ns = {}));
var rs;
(function(e) {
  e[e.Automatic = 0] = "Automatic", e[e.Explicit = 1] = "Explicit";
})(rs || (rs = {}));
var is;
(function(e) {
  e[e.Invoke = 0] = "Invoke", e[e.Automatic = 1] = "Automatic";
})(is || (is = {}));
var yr;
(function(e) {
  e[e.DependsOnKbLayout = -1] = "DependsOnKbLayout", e[e.Unknown = 0] = "Unknown", e[e.Backspace = 1] = "Backspace", e[e.Tab = 2] = "Tab", e[e.Enter = 3] = "Enter", e[e.Shift = 4] = "Shift", e[e.Ctrl = 5] = "Ctrl", e[e.Alt = 6] = "Alt", e[e.PauseBreak = 7] = "PauseBreak", e[e.CapsLock = 8] = "CapsLock", e[e.Escape = 9] = "Escape", e[e.Space = 10] = "Space", e[e.PageUp = 11] = "PageUp", e[e.PageDown = 12] = "PageDown", e[e.End = 13] = "End", e[e.Home = 14] = "Home", e[e.LeftArrow = 15] = "LeftArrow", e[e.UpArrow = 16] = "UpArrow", e[e.RightArrow = 17] = "RightArrow", e[e.DownArrow = 18] = "DownArrow", e[e.Insert = 19] = "Insert", e[e.Delete = 20] = "Delete", e[e.Digit0 = 21] = "Digit0", e[e.Digit1 = 22] = "Digit1", e[e.Digit2 = 23] = "Digit2", e[e.Digit3 = 24] = "Digit3", e[e.Digit4 = 25] = "Digit4", e[e.Digit5 = 26] = "Digit5", e[e.Digit6 = 27] = "Digit6", e[e.Digit7 = 28] = "Digit7", e[e.Digit8 = 29] = "Digit8", e[e.Digit9 = 30] = "Digit9", e[e.KeyA = 31] = "KeyA", e[e.KeyB = 32] = "KeyB", e[e.KeyC = 33] = "KeyC", e[e.KeyD = 34] = "KeyD", e[e.KeyE = 35] = "KeyE", e[e.KeyF = 36] = "KeyF", e[e.KeyG = 37] = "KeyG", e[e.KeyH = 38] = "KeyH", e[e.KeyI = 39] = "KeyI", e[e.KeyJ = 40] = "KeyJ", e[e.KeyK = 41] = "KeyK", e[e.KeyL = 42] = "KeyL", e[e.KeyM = 43] = "KeyM", e[e.KeyN = 44] = "KeyN", e[e.KeyO = 45] = "KeyO", e[e.KeyP = 46] = "KeyP", e[e.KeyQ = 47] = "KeyQ", e[e.KeyR = 48] = "KeyR", e[e.KeyS = 49] = "KeyS", e[e.KeyT = 50] = "KeyT", e[e.KeyU = 51] = "KeyU", e[e.KeyV = 52] = "KeyV", e[e.KeyW = 53] = "KeyW", e[e.KeyX = 54] = "KeyX", e[e.KeyY = 55] = "KeyY", e[e.KeyZ = 56] = "KeyZ", e[e.Meta = 57] = "Meta", e[e.ContextMenu = 58] = "ContextMenu", e[e.F1 = 59] = "F1", e[e.F2 = 60] = "F2", e[e.F3 = 61] = "F3", e[e.F4 = 62] = "F4", e[e.F5 = 63] = "F5", e[e.F6 = 64] = "F6", e[e.F7 = 65] = "F7", e[e.F8 = 66] = "F8", e[e.F9 = 67] = "F9", e[e.F10 = 68] = "F10", e[e.F11 = 69] = "F11", e[e.F12 = 70] = "F12", e[e.F13 = 71] = "F13", e[e.F14 = 72] = "F14", e[e.F15 = 73] = "F15", e[e.F16 = 74] = "F16", e[e.F17 = 75] = "F17", e[e.F18 = 76] = "F18", e[e.F19 = 77] = "F19", e[e.F20 = 78] = "F20", e[e.F21 = 79] = "F21", e[e.F22 = 80] = "F22", e[e.F23 = 81] = "F23", e[e.F24 = 82] = "F24", e[e.NumLock = 83] = "NumLock", e[e.ScrollLock = 84] = "ScrollLock", e[e.Semicolon = 85] = "Semicolon", e[e.Equal = 86] = "Equal", e[e.Comma = 87] = "Comma", e[e.Minus = 88] = "Minus", e[e.Period = 89] = "Period", e[e.Slash = 90] = "Slash", e[e.Backquote = 91] = "Backquote", e[e.BracketLeft = 92] = "BracketLeft", e[e.Backslash = 93] = "Backslash", e[e.BracketRight = 94] = "BracketRight", e[e.Quote = 95] = "Quote", e[e.OEM_8 = 96] = "OEM_8", e[e.IntlBackslash = 97] = "IntlBackslash", e[e.Numpad0 = 98] = "Numpad0", e[e.Numpad1 = 99] = "Numpad1", e[e.Numpad2 = 100] = "Numpad2", e[e.Numpad3 = 101] = "Numpad3", e[e.Numpad4 = 102] = "Numpad4", e[e.Numpad5 = 103] = "Numpad5", e[e.Numpad6 = 104] = "Numpad6", e[e.Numpad7 = 105] = "Numpad7", e[e.Numpad8 = 106] = "Numpad8", e[e.Numpad9 = 107] = "Numpad9", e[e.NumpadMultiply = 108] = "NumpadMultiply", e[e.NumpadAdd = 109] = "NumpadAdd", e[e.NUMPAD_SEPARATOR = 110] = "NUMPAD_SEPARATOR", e[e.NumpadSubtract = 111] = "NumpadSubtract", e[e.NumpadDecimal = 112] = "NumpadDecimal", e[e.NumpadDivide = 113] = "NumpadDivide", e[e.KEY_IN_COMPOSITION = 114] = "KEY_IN_COMPOSITION", e[e.ABNT_C1 = 115] = "ABNT_C1", e[e.ABNT_C2 = 116] = "ABNT_C2", e[e.AudioVolumeMute = 117] = "AudioVolumeMute", e[e.AudioVolumeUp = 118] = "AudioVolumeUp", e[e.AudioVolumeDown = 119] = "AudioVolumeDown", e[e.BrowserSearch = 120] = "BrowserSearch", e[e.BrowserHome = 121] = "BrowserHome", e[e.BrowserBack = 122] = "BrowserBack", e[e.BrowserForward = 123] = "BrowserForward", e[e.MediaTrackNext = 124] = "MediaTrackNext", e[e.MediaTrackPrevious = 125] = "MediaTrackPrevious", e[e.MediaStop = 126] = "MediaStop", e[e.MediaPlayPause = 127] = "MediaPlayPause", e[e.LaunchMediaPlayer = 128] = "LaunchMediaPlayer", e[e.LaunchMail = 129] = "LaunchMail", e[e.LaunchApp2 = 130] = "LaunchApp2", e[e.Clear = 131] = "Clear", e[e.MAX_VALUE = 132] = "MAX_VALUE";
})(yr || (yr = {}));
var wr;
(function(e) {
  e[e.Hint = 1] = "Hint", e[e.Info = 2] = "Info", e[e.Warning = 4] = "Warning", e[e.Error = 8] = "Error";
})(wr || (wr = {}));
var _r;
(function(e) {
  e[e.Unnecessary = 1] = "Unnecessary", e[e.Deprecated = 2] = "Deprecated";
})(_r || (_r = {}));
var ss;
(function(e) {
  e[e.Inline = 1] = "Inline", e[e.Gutter = 2] = "Gutter";
})(ss || (ss = {}));
var as;
(function(e) {
  e[e.Normal = 1] = "Normal", e[e.Underlined = 2] = "Underlined";
})(as || (as = {}));
var os;
(function(e) {
  e[e.UNKNOWN = 0] = "UNKNOWN", e[e.TEXTAREA = 1] = "TEXTAREA", e[e.GUTTER_GLYPH_MARGIN = 2] = "GUTTER_GLYPH_MARGIN", e[e.GUTTER_LINE_NUMBERS = 3] = "GUTTER_LINE_NUMBERS", e[e.GUTTER_LINE_DECORATIONS = 4] = "GUTTER_LINE_DECORATIONS", e[e.GUTTER_VIEW_ZONE = 5] = "GUTTER_VIEW_ZONE", e[e.CONTENT_TEXT = 6] = "CONTENT_TEXT", e[e.CONTENT_EMPTY = 7] = "CONTENT_EMPTY", e[e.CONTENT_VIEW_ZONE = 8] = "CONTENT_VIEW_ZONE", e[e.CONTENT_WIDGET = 9] = "CONTENT_WIDGET", e[e.OVERVIEW_RULER = 10] = "OVERVIEW_RULER", e[e.SCROLLBAR = 11] = "SCROLLBAR", e[e.OVERLAY_WIDGET = 12] = "OVERLAY_WIDGET", e[e.OUTSIDE_EDITOR = 13] = "OUTSIDE_EDITOR";
})(os || (os = {}));
var ls;
(function(e) {
  e[e.AIGenerated = 1] = "AIGenerated";
})(ls || (ls = {}));
var us;
(function(e) {
  e[e.Invoke = 0] = "Invoke", e[e.Automatic = 1] = "Automatic";
})(us || (us = {}));
var cs;
(function(e) {
  e[e.TOP_RIGHT_CORNER = 0] = "TOP_RIGHT_CORNER", e[e.BOTTOM_RIGHT_CORNER = 1] = "BOTTOM_RIGHT_CORNER", e[e.TOP_CENTER = 2] = "TOP_CENTER";
})(cs || (cs = {}));
var fs;
(function(e) {
  e[e.Left = 1] = "Left", e[e.Center = 2] = "Center", e[e.Right = 4] = "Right", e[e.Full = 7] = "Full";
})(fs || (fs = {}));
var hs;
(function(e) {
  e[e.Word = 0] = "Word", e[e.Line = 1] = "Line", e[e.Suggest = 2] = "Suggest";
})(hs || (hs = {}));
var ds;
(function(e) {
  e[e.Left = 0] = "Left", e[e.Right = 1] = "Right", e[e.None = 2] = "None", e[e.LeftOfInjectedText = 3] = "LeftOfInjectedText", e[e.RightOfInjectedText = 4] = "RightOfInjectedText";
})(ds || (ds = {}));
var ms;
(function(e) {
  e[e.Off = 0] = "Off", e[e.On = 1] = "On", e[e.Relative = 2] = "Relative", e[e.Interval = 3] = "Interval", e[e.Custom = 4] = "Custom";
})(ms || (ms = {}));
var gs;
(function(e) {
  e[e.None = 0] = "None", e[e.Text = 1] = "Text", e[e.Blocks = 2] = "Blocks";
})(gs || (gs = {}));
var ps;
(function(e) {
  e[e.Smooth = 0] = "Smooth", e[e.Immediate = 1] = "Immediate";
})(ps || (ps = {}));
var bs;
(function(e) {
  e[e.Auto = 1] = "Auto", e[e.Hidden = 2] = "Hidden", e[e.Visible = 3] = "Visible";
})(bs || (bs = {}));
var Lr;
(function(e) {
  e[e.LTR = 0] = "LTR", e[e.RTL = 1] = "RTL";
})(Lr || (Lr = {}));
var vs;
(function(e) {
  e.Off = "off", e.OnCode = "onCode", e.On = "on";
})(vs || (vs = {}));
var xs;
(function(e) {
  e[e.Invoke = 1] = "Invoke", e[e.TriggerCharacter = 2] = "TriggerCharacter", e[e.ContentChange = 3] = "ContentChange";
})(xs || (xs = {}));
var ys;
(function(e) {
  e[e.File = 0] = "File", e[e.Module = 1] = "Module", e[e.Namespace = 2] = "Namespace", e[e.Package = 3] = "Package", e[e.Class = 4] = "Class", e[e.Method = 5] = "Method", e[e.Property = 6] = "Property", e[e.Field = 7] = "Field", e[e.Constructor = 8] = "Constructor", e[e.Enum = 9] = "Enum", e[e.Interface = 10] = "Interface", e[e.Function = 11] = "Function", e[e.Variable = 12] = "Variable", e[e.Constant = 13] = "Constant", e[e.String = 14] = "String", e[e.Number = 15] = "Number", e[e.Boolean = 16] = "Boolean", e[e.Array = 17] = "Array", e[e.Object = 18] = "Object", e[e.Key = 19] = "Key", e[e.Null = 20] = "Null", e[e.EnumMember = 21] = "EnumMember", e[e.Struct = 22] = "Struct", e[e.Event = 23] = "Event", e[e.Operator = 24] = "Operator", e[e.TypeParameter = 25] = "TypeParameter";
})(ys || (ys = {}));
var ws;
(function(e) {
  e[e.Deprecated = 1] = "Deprecated";
})(ws || (ws = {}));
var _s;
(function(e) {
  e[e.Hidden = 0] = "Hidden", e[e.Blink = 1] = "Blink", e[e.Smooth = 2] = "Smooth", e[e.Phase = 3] = "Phase", e[e.Expand = 4] = "Expand", e[e.Solid = 5] = "Solid";
})(_s || (_s = {}));
var Ls;
(function(e) {
  e[e.Line = 1] = "Line", e[e.Block = 2] = "Block", e[e.Underline = 3] = "Underline", e[e.LineThin = 4] = "LineThin", e[e.BlockOutline = 5] = "BlockOutline", e[e.UnderlineThin = 6] = "UnderlineThin";
})(Ls || (Ls = {}));
var Ns;
(function(e) {
  e[e.AlwaysGrowsWhenTypingAtEdges = 0] = "AlwaysGrowsWhenTypingAtEdges", e[e.NeverGrowsWhenTypingAtEdges = 1] = "NeverGrowsWhenTypingAtEdges", e[e.GrowsOnlyWhenTypingBefore = 2] = "GrowsOnlyWhenTypingBefore", e[e.GrowsOnlyWhenTypingAfter = 3] = "GrowsOnlyWhenTypingAfter";
})(Ns || (Ns = {}));
var Ss;
(function(e) {
  e[e.None = 0] = "None", e[e.Same = 1] = "Same", e[e.Indent = 2] = "Indent", e[e.DeepIndent = 3] = "DeepIndent";
})(Ss || (Ss = {}));
const At = class At {
  static chord(t, n) {
    return Tl(t, n);
  }
};
At.CtrlCmd = 2048, At.Shift = 1024, At.Alt = 512, At.WinCtrl = 256;
let Nr = At;
function Ol() {
  return {
    editor: void 0,
    // undefined override expected here
    languages: void 0,
    // undefined override expected here
    CancellationTokenSource: Rl,
    Emitter: Le,
    KeyCode: yr,
    KeyMod: Nr,
    Position: ee,
    Range: z,
    Selection: ve,
    SelectionDirection: Lr,
    MarkerSeverity: wr,
    MarkerTag: _r,
    Uri: Ie,
    Token: Dl
  };
}
const Qt = class Qt {
  static getChannel(t) {
    return t.getChannel(Qt.CHANNEL_NAME);
  }
  static setChannel(t, n) {
    t.setChannel(Qt.CHANNEL_NAME, n);
  }
};
Qt.CHANNEL_NAME = "editorWorkerHost";
let Sr = Qt;
var As, ks;
class $l {
  constructor(t, n) {
    this.uri = t, this.value = n;
  }
}
function Ul(e) {
  return Array.isArray(e);
}
const at = class at {
  constructor(t, n) {
    if (this[As] = "ResourceMap", t instanceof at)
      this.map = new Map(t.map), this.toKey = n ?? at.defaultToKey;
    else if (Ul(t)) {
      this.map = /* @__PURE__ */ new Map(), this.toKey = n ?? at.defaultToKey;
      for (const [r, i] of t)
        this.set(r, i);
    } else
      this.map = /* @__PURE__ */ new Map(), this.toKey = t ?? at.defaultToKey;
  }
  set(t, n) {
    return this.map.set(this.toKey(t), new $l(t, n)), this;
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
    for (const [r, i] of this.map)
      t(i.value, i.uri, this);
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
  *[(As = Symbol.toStringTag, Symbol.iterator)]() {
    for (const [, t] of this.map)
      yield [t.uri, t.value];
  }
};
at.defaultToKey = (t) => t.toString();
let Rs = at;
class Bl {
  constructor() {
    this[ks] = "LinkedMap", this._map = /* @__PURE__ */ new Map(), this._head = void 0, this._tail = void 0, this._size = 0, this._state = 0;
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
    const r = this._map.get(t);
    if (r)
      return n !== 0 && this.touch(r, n), r.value;
  }
  set(t, n, r = 0) {
    let i = this._map.get(t);
    if (i)
      i.value = n, r !== 0 && this.touch(i, r);
    else {
      switch (i = { key: t, value: n, next: void 0, previous: void 0 }, r) {
        case 0:
          this.addItemLast(i);
          break;
        case 1:
          this.addItemFirst(i);
          break;
        case 2:
          this.addItemLast(i);
          break;
        default:
          this.addItemLast(i);
          break;
      }
      this._map.set(t, i), this._size++;
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
    const r = this._state;
    let i = this._head;
    for (; i; ) {
      if (n ? t.bind(n)(i.value, i.key, this) : t(i.value, i.key, this), this._state !== r)
        throw new Error("LinkedMap got modified during iteration.");
      i = i.next;
    }
  }
  keys() {
    const t = this, n = this._state;
    let r = this._head;
    const i = {
      [Symbol.iterator]() {
        return i;
      },
      next() {
        if (t._state !== n)
          throw new Error("LinkedMap got modified during iteration.");
        if (r) {
          const s = { value: r.key, done: !1 };
          return r = r.next, s;
        } else
          return { value: void 0, done: !0 };
      }
    };
    return i;
  }
  values() {
    const t = this, n = this._state;
    let r = this._head;
    const i = {
      [Symbol.iterator]() {
        return i;
      },
      next() {
        if (t._state !== n)
          throw new Error("LinkedMap got modified during iteration.");
        if (r) {
          const s = { value: r.value, done: !1 };
          return r = r.next, s;
        } else
          return { value: void 0, done: !0 };
      }
    };
    return i;
  }
  entries() {
    const t = this, n = this._state;
    let r = this._head;
    const i = {
      [Symbol.iterator]() {
        return i;
      },
      next() {
        if (t._state !== n)
          throw new Error("LinkedMap got modified during iteration.");
        if (r) {
          const s = { value: [r.key, r.value], done: !1 };
          return r = r.next, s;
        } else
          return { value: void 0, done: !0 };
      }
    };
    return i;
  }
  [(ks = Symbol.toStringTag, Symbol.iterator)]() {
    return this.entries();
  }
  trimOld(t) {
    if (t >= this.size)
      return;
    if (t === 0) {
      this.clear();
      return;
    }
    let n = this._head, r = this.size;
    for (; n && r > t; )
      this._map.delete(n.key), n = n.next, r--;
    this._head = n, this._size = r, n && (n.previous = void 0), this._state++;
  }
  trimNew(t) {
    if (t >= this.size)
      return;
    if (t === 0) {
      this.clear();
      return;
    }
    let n = this._tail, r = this.size;
    for (; n && r > t; )
      this._map.delete(n.key), n = n.previous, r--;
    this._tail = n, this._size = r, n && (n.next = void 0), this._state++;
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
      const n = t.next, r = t.previous;
      if (!n || !r)
        throw new Error("Invalid list");
      n.previous = r, r.next = n;
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
        const r = t.next, i = t.previous;
        t === this._tail ? (i.next = void 0, this._tail = i) : (r.previous = i, i.next = r), t.previous = void 0, t.next = this._head, this._head.previous = t, this._head = t, this._state++;
      } else if (n === 2) {
        if (t === this._tail)
          return;
        const r = t.next, i = t.previous;
        t === this._head ? (r.previous = void 0, this._head = r) : (r.previous = i, i.next = r), t.next = void 0, t.previous = this._tail, this._tail.next = t, this._tail = t, this._state++;
      }
    }
  }
  toJSON() {
    const t = [];
    return this.forEach((n, r) => {
      t.push([r, n]);
    }), t;
  }
  fromJSON(t) {
    this.clear();
    for (const [n, r] of t)
      this.set(n, r);
  }
}
class ql extends Bl {
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
class jl extends ql {
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
class Wl {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(t, n) {
    let r = this.map.get(t);
    r || (r = /* @__PURE__ */ new Set(), this.map.set(t, r)), r.add(n);
  }
  delete(t, n) {
    const r = this.map.get(t);
    r && (r.delete(n), r.size === 0 && this.map.delete(t));
  }
  forEach(t, n) {
    const r = this.map.get(t);
    r && r.forEach(n);
  }
  get(t) {
    const n = this.map.get(t);
    return n || /* @__PURE__ */ new Set();
  }
}
new jl(10);
function Hl(e) {
  let t = [];
  for (; Object.prototype !== e; )
    t = t.concat(Object.getOwnPropertyNames(e)), e = Object.getPrototypeOf(e);
  return t;
}
function Es(e) {
  const t = [];
  for (const n of Hl(e))
    typeof e[n] == "function" && t.push(n);
  return t;
}
function zl(e, t) {
  const n = (i) => function() {
    const s = Array.prototype.slice.call(arguments, 0);
    return t(i, s);
  }, r = {};
  for (const i of e)
    r[i] = n(i);
  return r;
}
var Ms;
(function(e) {
  e[e.Left = 1] = "Left", e[e.Center = 2] = "Center", e[e.Right = 4] = "Right", e[e.Full = 7] = "Full";
})(Ms || (Ms = {}));
var Cs;
(function(e) {
  e[e.Left = 1] = "Left", e[e.Center = 2] = "Center", e[e.Right = 3] = "Right";
})(Cs || (Cs = {}));
var Ts;
(function(e) {
  e[e.Both = 0] = "Both", e[e.Right = 1] = "Right", e[e.Left = 2] = "Left", e[e.None = 3] = "None";
})(Ts || (Ts = {}));
function Gl(e, t, n, r, i) {
  if (r === 0)
    return !0;
  const s = t.charCodeAt(r - 1);
  if (e.get(s) !== 0 || s === 13 || s === 10)
    return !0;
  if (i > 0) {
    const a = t.charCodeAt(r);
    if (e.get(a) !== 0)
      return !0;
  }
  return !1;
}
function Jl(e, t, n, r, i) {
  if (r + i === n)
    return !0;
  const s = t.charCodeAt(r + i);
  if (e.get(s) !== 0 || s === 13 || s === 10)
    return !0;
  if (i > 0) {
    const a = t.charCodeAt(r + i - 1);
    if (e.get(a) !== 0)
      return !0;
  }
  return !1;
}
function Xl(e, t, n, r, i) {
  return Gl(e, t, n, r, i) && Jl(e, t, n, r, i);
}
class Ql {
  constructor(t, n) {
    this._wordSeparators = t, this._searchRegex = n, this._prevMatchStartIndex = -1, this._prevMatchLength = 0;
  }
  reset(t) {
    this._searchRegex.lastIndex = t, this._prevMatchStartIndex = -1, this._prevMatchLength = 0;
  }
  next(t) {
    const n = t.length;
    let r;
    do {
      if (this._prevMatchStartIndex + this._prevMatchLength === n || (r = this._searchRegex.exec(t), !r))
        return null;
      const i = r.index, s = r[0].length;
      if (i === this._prevMatchStartIndex && s === this._prevMatchLength) {
        if (s === 0) {
          Uo(t, n, this._searchRegex.lastIndex) > 65535 ? this._searchRegex.lastIndex += 2 : this._searchRegex.lastIndex += 1;
          continue;
        }
        return null;
      }
      if (this._prevMatchStartIndex = i, this._prevMatchLength = s, !this._wordSeparators || Xl(this._wordSeparators, t, n, i, s))
        return r;
    } while (r);
    return null;
  }
}
function Yl(e, t = "Unreachable") {
  throw new Error(t);
}
function En(e) {
  if (!e()) {
    debugger;
    e(), Ht(new we("Assertion Failed"));
  }
}
function Ta(e, t) {
  let n = 0;
  for (; n < e.length - 1; ) {
    const r = e[n], i = e[n + 1];
    if (!t(r, i))
      return !1;
    n++;
  }
  return !0;
}
const Zl = "`~!@#$%^&*()-=+[{]}\\|;:'\",.<>/?";
function Kl(e = "") {
  let t = "(-?\\d*\\.\\d\\w*)|([^";
  for (const n of Zl)
    e.indexOf(n) >= 0 || (t += "\\" + n);
  return t += "\\s]+)", new RegExp(t, "g");
}
const Pa = Kl();
function Ia(e) {
  let t = Pa;
  if (e && e instanceof RegExp)
    if (e.global)
      t = e;
    else {
      let n = "g";
      e.ignoreCase && (n += "i"), e.multiline && (n += "m"), e.unicode && (n += "u"), t = new RegExp(e.source, n);
    }
  return t.lastIndex = 0, t;
}
const Fa = new mo();
Fa.unshift({
  maxLen: 1e3,
  windowSize: 15,
  timeBudget: 150
});
function si(e, t, n, r, i) {
  if (t = Ia(t), i || (i = wn.first(Fa)), n.length > i.maxLen) {
    let u = e - i.maxLen / 2;
    return u < 0 ? u = 0 : r += u, n = n.substring(u, e + i.maxLen / 2), si(e, t, n, r, i);
  }
  const s = Date.now(), a = e - 1 - r;
  let l = -1, o = null;
  for (let u = 1; !(Date.now() - s >= i.timeBudget); u++) {
    const h = a - i.windowSize * u;
    t.lastIndex = Math.max(0, h);
    const c = eu(t, n, a, l);
    if (!c && o || (o = c, h <= 0))
      break;
    l = h;
  }
  if (o) {
    const u = {
      word: o[0],
      startColumn: r + 1 + o.index,
      endColumn: r + 1 + o.index + o[0].length
    };
    return t.lastIndex = 0, u;
  }
  return null;
}
function eu(e, t, n, r) {
  let i;
  for (; i = e.exec(t); ) {
    const s = i.index || 0;
    if (s <= n && e.lastIndex >= n)
      return i;
    if (r > 0 && s > r)
      return null;
  }
  return null;
}
class tu {
  static computeUnicodeHighlights(t, n, r) {
    const i = r ? r.startLineNumber : 1, s = r ? r.endLineNumber : t.getLineCount(), a = new Ps(n), l = a.getCandidateCodePoints();
    let o;
    l === "allNonBasicAscii" ? o = new RegExp("[^\\t\\n\\r\\x20-\\x7E]", "g") : o = new RegExp(`${nu(Array.from(l))}`, "g");
    const u = new Ql(null, o), h = [];
    let c = !1, d, m = 0, g = 0, p = 0;
    e:
      for (let x = i, w = s; x <= w; x++) {
        const L = t.getLineContent(x), v = L.length;
        u.reset(0);
        do
          if (d = u.next(L), d) {
            let y = d.index, b = d.index + d[0].length;
            if (y > 0) {
              const F = L.charCodeAt(y - 1);
              Nn(F) && y--;
            }
            if (b + 1 < v) {
              const F = L.charCodeAt(b - 1);
              Nn(F) && b++;
            }
            const _ = L.substring(y, b);
            let k = si(y + 1, Pa, L, 0);
            k && k.endColumn <= y + 1 && (k = null);
            const C = a.shouldHighlightNonBasicASCII(_, k ? k.word : null);
            if (C !== 0) {
              if (C === 3 ? m++ : C === 2 ? g++ : C === 1 ? p++ : Yl(), h.length >= 1e3) {
                c = !0;
                break e;
              }
              h.push(new z(x, y + 1, x, b + 1));
            }
          }
        while (d);
      }
    return {
      ranges: h,
      hasMore: c,
      ambiguousCharacterCount: m,
      invisibleCharacterCount: g,
      nonBasicAsciiCharacterCount: p
    };
  }
  static computeUnicodeHighlightReason(t, n) {
    const r = new Ps(n);
    switch (r.shouldHighlightNonBasicASCII(t, null)) {
      case 0:
        return null;
      case 2:
        return {
          kind: 1
          /* UnicodeHighlighterReasonKind.Invisible */
        };
      case 3: {
        const s = t.codePointAt(0), a = r.ambiguousCharacters.getPrimaryConfusable(s), l = en.getLocales().filter((o) => !en.getInstance(/* @__PURE__ */ new Set([...n.allowedLocales, o])).isAmbiguous(s));
        return { kind: 0, confusableWith: String.fromCodePoint(a), notAmbiguousInLocales: l };
      }
      case 1:
        return {
          kind: 2
          /* UnicodeHighlighterReasonKind.NonBasicAscii */
        };
    }
  }
}
function nu(e, t) {
  return `[${Vo(e.map((r) => String.fromCodePoint(r)).join(""))}]`;
}
class Ps {
  constructor(t) {
    this.options = t, this.allowedCodePoints = new Set(t.allowedCodePoints), this.ambiguousCharacters = en.getInstance(new Set(t.allowedLocales));
  }
  getCandidateCodePoints() {
    if (this.options.nonBasicASCII)
      return "allNonBasicAscii";
    const t = /* @__PURE__ */ new Set();
    if (this.options.invisibleCharacters)
      for (const n of zt.codePoints)
        Is(String.fromCodePoint(n)) || t.add(n);
    if (this.options.ambiguousCharacters)
      for (const n of this.ambiguousCharacters.getConfusableCodePoints())
        t.add(n);
    for (const n of this.allowedCodePoints)
      t.delete(n);
    return t;
  }
  shouldHighlightNonBasicASCII(t, n) {
    const r = t.codePointAt(0);
    if (this.allowedCodePoints.has(r))
      return 0;
    if (this.options.nonBasicASCII)
      return 1;
    let i = !1, s = !1;
    if (n)
      for (const a of n) {
        const l = a.codePointAt(0), o = qo(a);
        i = i || o, !o && !this.ambiguousCharacters.isAmbiguous(l) && !zt.isInvisibleCharacter(l) && (s = !0);
      }
    return (
      /* Don't allow mixing weird looking characters with ASCII */
      !i && /* Is there an obviously weird looking character? */
      s ? 0 : this.options.invisibleCharacters && !Is(t) && zt.isInvisibleCharacter(r) ? 2 : this.options.ambiguousCharacters && this.ambiguousCharacters.isAmbiguous(r) ? 3 : 0
    );
  }
}
function Is(e) {
  return e === " " || e === `
` || e === "	";
}
class bn {
  constructor(t, n, r) {
    this.changes = t, this.moves = n, this.hitTimeout = r;
  }
}
class ru {
  constructor(t, n) {
    this.lineRangeMapping = t, this.changes = n;
  }
}
class W {
  static addRange(t, n) {
    let r = 0;
    for (; r < n.length && n[r].endExclusive < t.start; )
      r++;
    let i = r;
    for (; i < n.length && n[i].start <= t.endExclusive; )
      i++;
    if (r === i)
      n.splice(r, 0, t);
    else {
      const s = Math.min(t.start, n[r].start), a = Math.max(t.endExclusive, n[i - 1].endExclusive);
      n.splice(r, i - r, new W(s, a));
    }
  }
  static tryCreate(t, n) {
    if (!(t > n))
      return new W(t, n);
  }
  static ofLength(t) {
    return new W(0, t);
  }
  static ofStartAndLength(t, n) {
    return new W(t, t + n);
  }
  constructor(t, n) {
    if (this.start = t, this.endExclusive = n, t > n)
      throw new we(`Invalid range: ${this.toString()}`);
  }
  get isEmpty() {
    return this.start === this.endExclusive;
  }
  delta(t) {
    return new W(this.start + t, this.endExclusive + t);
  }
  deltaStart(t) {
    return new W(this.start + t, this.endExclusive);
  }
  deltaEnd(t) {
    return new W(this.start, this.endExclusive + t);
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
    return new W(Math.min(this.start, t.start), Math.max(this.endExclusive, t.endExclusive));
  }
  /**
   * for all numbers n: range1.contains(n) and range2.contains(n) <=> range1.intersect(range2).contains(n)
   *
   * The resulting range is empty if the ranges do not intersect, but touch.
   * If the ranges don't even touch, the result is undefined.
   */
  intersect(t) {
    const n = Math.max(this.start, t.start), r = Math.min(this.endExclusive, t.endExclusive);
    if (n <= r)
      return new W(n, r);
  }
  intersects(t) {
    const n = Math.max(this.start, t.start), r = Math.min(this.endExclusive, t.endExclusive);
    return n < r;
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
      throw new we(`Invalid clipping range: ${this.toString()}`);
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
      throw new we(`Invalid clipping range: ${this.toString()}`);
    return t < this.start ? this.endExclusive - (this.start - t) % this.length : t >= this.endExclusive ? this.start + (t - this.start) % this.length : t;
  }
  forEach(t) {
    for (let n = this.start; n < this.endExclusive; n++)
      t(n);
  }
}
function Pt(e, t) {
  const n = tn(e, t);
  return n === -1 ? void 0 : e[n];
}
function tn(e, t, n = 0, r = e.length) {
  let i = n, s = r;
  for (; i < s; ) {
    const a = Math.floor((i + s) / 2);
    t(e[a]) ? i = a + 1 : s = a;
  }
  return i - 1;
}
function iu(e, t) {
  const n = Ar(e, t);
  return n === e.length ? void 0 : e[n];
}
function Ar(e, t, n = 0, r = e.length) {
  let i = n, s = r;
  for (; i < s; ) {
    const a = Math.floor((i + s) / 2);
    t(e[a]) ? s = a : i = a + 1;
  }
  return i;
}
const Wn = class Wn {
  constructor(t) {
    this._array = t, this._findLastMonotonousLastIdx = 0;
  }
  /**
   * The predicate must be monotonous, i.e. `arr.map(predicate)` must be like `[true, ..., true, false, ..., false]`!
   * For subsequent calls, current predicate must be weaker than (or equal to) the previous predicate, i.e. more entries must be `true`.
   */
  findLastMonotonous(t) {
    if (Wn.assertInvariants) {
      if (this._prevFindLastPredicate) {
        for (const r of this._array)
          if (this._prevFindLastPredicate(r) && !t(r))
            throw new Error("MonotonousArray: current predicate must be weaker than (or equal to) the previous predicate.");
      }
      this._prevFindLastPredicate = t;
    }
    const n = tn(this._array, t, this._findLastMonotonousLastIdx);
    return this._findLastMonotonousLastIdx = n + 1, n === -1 ? void 0 : this._array[n];
  }
};
Wn.assertInvariants = !1;
let Mn = Wn;
class U {
  static fromRangeInclusive(t) {
    return new U(t.startLineNumber, t.endLineNumber + 1);
  }
  /**
   * @param lineRanges An array of sorted line ranges.
   */
  static joinMany(t) {
    if (t.length === 0)
      return [];
    let n = new Fe(t[0].slice());
    for (let r = 1; r < t.length; r++)
      n = n.getUnion(new Fe(t[r].slice()));
    return n.ranges;
  }
  static join(t) {
    if (t.length === 0)
      throw new we("lineRanges cannot be empty");
    let n = t[0].startLineNumber, r = t[0].endLineNumberExclusive;
    for (let i = 1; i < t.length; i++)
      n = Math.min(n, t[i].startLineNumber), r = Math.max(r, t[i].endLineNumberExclusive);
    return new U(n, r);
  }
  static ofLength(t, n) {
    return new U(t, t + n);
  }
  /**
   * @internal
   */
  static deserialize(t) {
    return new U(t[0], t[1]);
  }
  constructor(t, n) {
    if (t > n)
      throw new we(`startLineNumber ${t} cannot be after endLineNumberExclusive ${n}`);
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
    return new U(this.startLineNumber + t, this.endLineNumberExclusive + t);
  }
  deltaLength(t) {
    return new U(this.startLineNumber, this.endLineNumberExclusive + t);
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
    return new U(Math.min(this.startLineNumber, t.startLineNumber), Math.max(this.endLineNumberExclusive, t.endLineNumberExclusive));
  }
  toString() {
    return `[${this.startLineNumber},${this.endLineNumberExclusive})`;
  }
  /**
   * The resulting range is empty if the ranges do not intersect, but touch.
   * If the ranges don't even touch, the result is undefined.
   */
  intersect(t) {
    const n = Math.max(this.startLineNumber, t.startLineNumber), r = Math.min(this.endLineNumberExclusive, t.endLineNumberExclusive);
    if (n <= r)
      return new U(n, r);
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
    return this.isEmpty ? null : new z(this.startLineNumber, 1, this.endLineNumberExclusive - 1, Number.MAX_SAFE_INTEGER);
  }
  /**
   * @deprecated Using this function is discouraged because it might lead to bugs: The end position is not guaranteed to be a valid position!
  */
  toExclusiveRange() {
    return new z(this.startLineNumber, 1, this.endLineNumberExclusive, 1);
  }
  mapToLineArray(t) {
    const n = [];
    for (let r = this.startLineNumber; r < this.endLineNumberExclusive; r++)
      n.push(t(r));
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
    return new W(this.startLineNumber - 1, this.endLineNumberExclusive - 1);
  }
}
class Fe {
  constructor(t = []) {
    this._normalizedRanges = t;
  }
  get ranges() {
    return this._normalizedRanges;
  }
  addRange(t) {
    if (t.length === 0)
      return;
    const n = Ar(this._normalizedRanges, (i) => i.endLineNumberExclusive >= t.startLineNumber), r = tn(this._normalizedRanges, (i) => i.startLineNumber <= t.endLineNumberExclusive) + 1;
    if (n === r)
      this._normalizedRanges.splice(n, 0, t);
    else if (n === r - 1) {
      const i = this._normalizedRanges[n];
      this._normalizedRanges[n] = i.join(t);
    } else {
      const i = this._normalizedRanges[n].join(this._normalizedRanges[r - 1]).join(t);
      this._normalizedRanges.splice(n, r - n, i);
    }
  }
  contains(t) {
    const n = Pt(this._normalizedRanges, (r) => r.startLineNumber <= t);
    return !!n && n.endLineNumberExclusive > t;
  }
  intersects(t) {
    const n = Pt(this._normalizedRanges, (r) => r.startLineNumber < t.endLineNumberExclusive);
    return !!n && n.endLineNumberExclusive > t.startLineNumber;
  }
  getUnion(t) {
    if (this._normalizedRanges.length === 0)
      return t;
    if (t._normalizedRanges.length === 0)
      return this;
    const n = [];
    let r = 0, i = 0, s = null;
    for (; r < this._normalizedRanges.length || i < t._normalizedRanges.length; ) {
      let a = null;
      if (r < this._normalizedRanges.length && i < t._normalizedRanges.length) {
        const l = this._normalizedRanges[r], o = t._normalizedRanges[i];
        l.startLineNumber < o.startLineNumber ? (a = l, r++) : (a = o, i++);
      } else
        r < this._normalizedRanges.length ? (a = this._normalizedRanges[r], r++) : (a = t._normalizedRanges[i], i++);
      s === null ? s = a : s.endLineNumberExclusive >= a.startLineNumber ? s = new U(s.startLineNumber, Math.max(s.endLineNumberExclusive, a.endLineNumberExclusive)) : (n.push(s), s = a);
    }
    return s !== null && n.push(s), new Fe(n);
  }
  /**
   * Subtracts all ranges in this set from `range` and returns the result.
   */
  subtractFrom(t) {
    const n = Ar(this._normalizedRanges, (a) => a.endLineNumberExclusive >= t.startLineNumber), r = tn(this._normalizedRanges, (a) => a.startLineNumber <= t.endLineNumberExclusive) + 1;
    if (n === r)
      return new Fe([t]);
    const i = [];
    let s = t.startLineNumber;
    for (let a = n; a < r; a++) {
      const l = this._normalizedRanges[a];
      l.startLineNumber > s && i.push(new U(s, l.startLineNumber)), s = l.endLineNumberExclusive;
    }
    return s < t.endLineNumberExclusive && i.push(new U(s, t.endLineNumberExclusive)), new Fe(i);
  }
  toString() {
    return this._normalizedRanges.map((t) => t.toString()).join(", ");
  }
  getIntersection(t) {
    const n = [];
    let r = 0, i = 0;
    for (; r < this._normalizedRanges.length && i < t._normalizedRanges.length; ) {
      const s = this._normalizedRanges[r], a = t._normalizedRanges[i], l = s.intersect(a);
      l && !l.isEmpty && n.push(l), s.endLineNumberExclusive < a.endLineNumberExclusive ? r++ : i++;
    }
    return new Fe(n);
  }
  getWithDelta(t) {
    return new Fe(this._normalizedRanges.map((n) => n.delta(t)));
  }
}
const Ze = class Ze {
  static betweenPositions(t, n) {
    return t.lineNumber === n.lineNumber ? new Ze(0, n.column - t.column) : new Ze(n.lineNumber - t.lineNumber, n.column - 1);
  }
  static ofRange(t) {
    return Ze.betweenPositions(t.getStartPosition(), t.getEndPosition());
  }
  static ofText(t) {
    let n = 0, r = 0;
    for (const i of t)
      i === `
` ? (n++, r = 0) : r++;
    return new Ze(n, r);
  }
  constructor(t, n) {
    this.lineCount = t, this.columnCount = n;
  }
  isGreaterThanOrEqualTo(t) {
    return this.lineCount !== t.lineCount ? this.lineCount > t.lineCount : this.columnCount >= t.columnCount;
  }
  createRange(t) {
    return this.lineCount === 0 ? new z(t.lineNumber, t.column, t.lineNumber, t.column + this.columnCount) : new z(t.lineNumber, t.column, t.lineNumber + this.lineCount, this.columnCount + 1);
  }
  addToPosition(t) {
    return this.lineCount === 0 ? new ee(t.lineNumber, t.column + this.columnCount) : new ee(t.lineNumber + this.lineCount, this.columnCount + 1);
  }
  toString() {
    return `${this.lineCount},${this.columnCount}`;
  }
};
Ze.zero = new Ze(0, 0);
let Fs = Ze;
class su {
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
class Se {
  static inverse(t, n, r) {
    const i = [];
    let s = 1, a = 1;
    for (const o of t) {
      const u = new Se(new U(s, o.original.startLineNumber), new U(a, o.modified.startLineNumber));
      u.modified.isEmpty || i.push(u), s = o.original.endLineNumberExclusive, a = o.modified.endLineNumberExclusive;
    }
    const l = new Se(new U(s, n + 1), new U(a, r + 1));
    return l.modified.isEmpty || i.push(l), i;
  }
  static clip(t, n, r) {
    const i = [];
    for (const s of t) {
      const a = s.original.intersect(n), l = s.modified.intersect(r);
      a && !a.isEmpty && l && !l.isEmpty && i.push(new Se(a, l));
    }
    return i;
  }
  constructor(t, n) {
    this.original = t, this.modified = n;
  }
  toString() {
    return `{${this.original.toString()}->${this.modified.toString()}}`;
  }
  flip() {
    return new Se(this.modified, this.original);
  }
  join(t) {
    return new Se(this.original.join(t.original), this.modified.join(t.modified));
  }
  /**
   * This method assumes that the LineRangeMapping describes a valid diff!
   * I.e. if one range is empty, the other range cannot be the entire document.
   * It avoids various problems when the line range points to non-existing line-numbers.
  */
  toRangeMapping() {
    const t = this.original.toInclusiveRange(), n = this.modified.toInclusiveRange();
    if (t && n)
      return new Ee(t, n);
    if (this.original.startLineNumber === 1 || this.modified.startLineNumber === 1) {
      if (!(this.modified.startLineNumber === 1 && this.original.startLineNumber === 1))
        throw new we("not a valid diff");
      return new Ee(new z(this.original.startLineNumber, 1, this.original.endLineNumberExclusive, 1), new z(this.modified.startLineNumber, 1, this.modified.endLineNumberExclusive, 1));
    } else
      return new Ee(new z(this.original.startLineNumber - 1, Number.MAX_SAFE_INTEGER, this.original.endLineNumberExclusive - 1, Number.MAX_SAFE_INTEGER), new z(this.modified.startLineNumber - 1, Number.MAX_SAFE_INTEGER, this.modified.endLineNumberExclusive - 1, Number.MAX_SAFE_INTEGER));
  }
  /**
   * This method assumes that the LineRangeMapping describes a valid diff!
   * I.e. if one range is empty, the other range cannot be the entire document.
   * It avoids various problems when the line range points to non-existing line-numbers.
  */
  toRangeMapping2(t, n) {
    if (Vs(this.original.endLineNumberExclusive, t) && Vs(this.modified.endLineNumberExclusive, n))
      return new Ee(new z(this.original.startLineNumber, 1, this.original.endLineNumberExclusive, 1), new z(this.modified.startLineNumber, 1, this.modified.endLineNumberExclusive, 1));
    if (!this.original.isEmpty && !this.modified.isEmpty)
      return new Ee(z.fromPositions(new ee(this.original.startLineNumber, 1), bt(new ee(this.original.endLineNumberExclusive - 1, Number.MAX_SAFE_INTEGER), t)), z.fromPositions(new ee(this.modified.startLineNumber, 1), bt(new ee(this.modified.endLineNumberExclusive - 1, Number.MAX_SAFE_INTEGER), n)));
    if (this.original.startLineNumber > 1 && this.modified.startLineNumber > 1)
      return new Ee(z.fromPositions(bt(new ee(this.original.startLineNumber - 1, Number.MAX_SAFE_INTEGER), t), bt(new ee(this.original.endLineNumberExclusive - 1, Number.MAX_SAFE_INTEGER), t)), z.fromPositions(bt(new ee(this.modified.startLineNumber - 1, Number.MAX_SAFE_INTEGER), n), bt(new ee(this.modified.endLineNumberExclusive - 1, Number.MAX_SAFE_INTEGER), n)));
    throw new we();
  }
}
function bt(e, t) {
  if (e.lineNumber < 1)
    return new ee(1, 1);
  if (e.lineNumber > t.length)
    return new ee(t.length, t[t.length - 1].length + 1);
  const n = t[e.lineNumber - 1];
  return e.column > n.length + 1 ? new ee(e.lineNumber, n.length + 1) : e;
}
function Vs(e, t) {
  return e >= 1 && e <= t.length;
}
class Be extends Se {
  static fromRangeMappings(t) {
    const n = U.join(t.map((i) => U.fromRangeInclusive(i.originalRange))), r = U.join(t.map((i) => U.fromRangeInclusive(i.modifiedRange)));
    return new Be(n, r, t);
  }
  constructor(t, n, r) {
    super(t, n), this.innerChanges = r;
  }
  flip() {
    var t;
    return new Be(this.modified, this.original, (t = this.innerChanges) == null ? void 0 : t.map((n) => n.flip()));
  }
  withInnerChangesFromLineRanges() {
    return new Be(this.original, this.modified, [this.toRangeMapping()]);
  }
}
class Ee {
  static assertSorted(t) {
    for (let n = 1; n < t.length; n++) {
      const r = t[n - 1], i = t[n];
      if (!(r.originalRange.getEndPosition().isBeforeOrEqual(i.originalRange.getStartPosition()) && r.modifiedRange.getEndPosition().isBeforeOrEqual(i.modifiedRange.getStartPosition())))
        throw new we("Range mappings must be sorted");
    }
  }
  constructor(t, n) {
    this.originalRange = t, this.modifiedRange = n;
  }
  toString() {
    return `{${this.originalRange.toString()}->${this.modifiedRange.toString()}}`;
  }
  flip() {
    return new Ee(this.modifiedRange, this.originalRange);
  }
  /**
   * Creates a single text edit that describes the change from the original to the modified text.
  */
  toTextEdit(t) {
    const n = t.getValueOfRange(this.modifiedRange);
    return new su(this.originalRange, n);
  }
}
const au = 3;
class ou {
  computeDiff(t, n, r) {
    var o;
    const s = new cu(t, n, {
      maxComputationTime: r.maxComputationTimeMs,
      shouldIgnoreTrimWhitespace: r.ignoreTrimWhitespace,
      shouldComputeCharChanges: !0,
      shouldMakePrettyDiff: !0,
      shouldPostProcessCharChanges: !0
    }).computeDiff(), a = [];
    let l = null;
    for (const u of s.changes) {
      let h;
      u.originalEndLineNumber === 0 ? h = new U(u.originalStartLineNumber + 1, u.originalStartLineNumber + 1) : h = new U(u.originalStartLineNumber, u.originalEndLineNumber + 1);
      let c;
      u.modifiedEndLineNumber === 0 ? c = new U(u.modifiedStartLineNumber + 1, u.modifiedStartLineNumber + 1) : c = new U(u.modifiedStartLineNumber, u.modifiedEndLineNumber + 1);
      let d = new Be(h, c, (o = u.charChanges) == null ? void 0 : o.map((m) => new Ee(new z(m.originalStartLineNumber, m.originalStartColumn, m.originalEndLineNumber, m.originalEndColumn), new z(m.modifiedStartLineNumber, m.modifiedStartColumn, m.modifiedEndLineNumber, m.modifiedEndColumn))));
      l && (l.modified.endLineNumberExclusive === d.modified.startLineNumber || l.original.endLineNumberExclusive === d.original.startLineNumber) && (d = new Be(l.original.join(d.original), l.modified.join(d.modified), l.innerChanges && d.innerChanges ? l.innerChanges.concat(d.innerChanges) : void 0), a.pop()), a.push(d), l = d;
    }
    return En(() => Ta(a, (u, h) => h.original.startLineNumber - u.original.endLineNumberExclusive === h.modified.startLineNumber - u.modified.endLineNumberExclusive && // There has to be an unchanged line in between (otherwise both diffs should have been joined)
    u.original.endLineNumberExclusive < h.original.startLineNumber && u.modified.endLineNumberExclusive < h.modified.startLineNumber)), new bn(a, [], s.quitEarly);
  }
}
function Va(e, t, n, r) {
  return new Ke(e, t, n).ComputeDiff(r);
}
let Ds = class {
  constructor(t) {
    const n = [], r = [];
    for (let i = 0, s = t.length; i < s; i++)
      n[i] = kr(t[i], 1), r[i] = Rr(t[i], 1);
    this.lines = t, this._startColumns = n, this._endColumns = r;
  }
  getElements() {
    const t = [];
    for (let n = 0, r = this.lines.length; n < r; n++)
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
  createCharSequence(t, n, r) {
    const i = [], s = [], a = [];
    let l = 0;
    for (let o = n; o <= r; o++) {
      const u = this.lines[o], h = t ? this._startColumns[o] : 1, c = t ? this._endColumns[o] : u.length + 1;
      for (let d = h; d < c; d++)
        i[l] = u.charCodeAt(d - 1), s[l] = o + 1, a[l] = d, l++;
      !t && o < r && (i[l] = 10, s[l] = o + 1, a[l] = u.length + 1, l++);
    }
    return new lu(i, s, a);
  }
};
class lu {
  constructor(t, n, r) {
    this._charCodes = t, this._lineNumbers = n, this._columns = r;
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
class Et {
  constructor(t, n, r, i, s, a, l, o) {
    this.originalStartLineNumber = t, this.originalStartColumn = n, this.originalEndLineNumber = r, this.originalEndColumn = i, this.modifiedStartLineNumber = s, this.modifiedStartColumn = a, this.modifiedEndLineNumber = l, this.modifiedEndColumn = o;
  }
  static createFromDiffChange(t, n, r) {
    const i = n.getStartLineNumber(t.originalStart), s = n.getStartColumn(t.originalStart), a = n.getEndLineNumber(t.originalStart + t.originalLength - 1), l = n.getEndColumn(t.originalStart + t.originalLength - 1), o = r.getStartLineNumber(t.modifiedStart), u = r.getStartColumn(t.modifiedStart), h = r.getEndLineNumber(t.modifiedStart + t.modifiedLength - 1), c = r.getEndColumn(t.modifiedStart + t.modifiedLength - 1);
    return new Et(i, s, a, l, o, u, h, c);
  }
}
function uu(e) {
  if (e.length <= 1)
    return e;
  const t = [e[0]];
  let n = t[0];
  for (let r = 1, i = e.length; r < i; r++) {
    const s = e[r], a = s.originalStart - (n.originalStart + n.originalLength), l = s.modifiedStart - (n.modifiedStart + n.modifiedLength);
    Math.min(a, l) < au ? (n.originalLength = s.originalStart + s.originalLength - n.originalStart, n.modifiedLength = s.modifiedStart + s.modifiedLength - n.modifiedStart) : (t.push(s), n = s);
  }
  return t;
}
class Gt {
  constructor(t, n, r, i, s) {
    this.originalStartLineNumber = t, this.originalEndLineNumber = n, this.modifiedStartLineNumber = r, this.modifiedEndLineNumber = i, this.charChanges = s;
  }
  static createFromDiffResult(t, n, r, i, s, a, l) {
    let o, u, h, c, d;
    if (n.originalLength === 0 ? (o = r.getStartLineNumber(n.originalStart) - 1, u = 0) : (o = r.getStartLineNumber(n.originalStart), u = r.getEndLineNumber(n.originalStart + n.originalLength - 1)), n.modifiedLength === 0 ? (h = i.getStartLineNumber(n.modifiedStart) - 1, c = 0) : (h = i.getStartLineNumber(n.modifiedStart), c = i.getEndLineNumber(n.modifiedStart + n.modifiedLength - 1)), a && n.originalLength > 0 && n.originalLength < 20 && n.modifiedLength > 0 && n.modifiedLength < 20 && s()) {
      const m = r.createCharSequence(t, n.originalStart, n.originalStart + n.originalLength - 1), g = i.createCharSequence(t, n.modifiedStart, n.modifiedStart + n.modifiedLength - 1);
      if (m.getElements().length > 0 && g.getElements().length > 0) {
        let p = Va(m, g, s, !0).changes;
        l && (p = uu(p)), d = [];
        for (let x = 0, w = p.length; x < w; x++)
          d.push(Et.createFromDiffChange(p[x], m, g));
      }
    }
    return new Gt(o, u, h, c, d);
  }
}
class cu {
  constructor(t, n, r) {
    this.shouldComputeCharChanges = r.shouldComputeCharChanges, this.shouldPostProcessCharChanges = r.shouldPostProcessCharChanges, this.shouldIgnoreTrimWhitespace = r.shouldIgnoreTrimWhitespace, this.shouldMakePrettyDiff = r.shouldMakePrettyDiff, this.originalLines = t, this.modifiedLines = n, this.original = new Ds(t), this.modified = new Ds(n), this.continueLineDiff = Os(r.maxComputationTime), this.continueCharDiff = Os(r.maxComputationTime === 0 ? 0 : Math.min(r.maxComputationTime, 5e3));
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
    const t = Va(this.original, this.modified, this.continueLineDiff, this.shouldMakePrettyDiff), n = t.changes, r = t.quitEarly;
    if (this.shouldIgnoreTrimWhitespace) {
      const l = [];
      for (let o = 0, u = n.length; o < u; o++)
        l.push(Gt.createFromDiffResult(this.shouldIgnoreTrimWhitespace, n[o], this.original, this.modified, this.continueCharDiff, this.shouldComputeCharChanges, this.shouldPostProcessCharChanges));
      return {
        quitEarly: r,
        changes: l
      };
    }
    const i = [];
    let s = 0, a = 0;
    for (let l = -1, o = n.length; l < o; l++) {
      const u = l + 1 < o ? n[l + 1] : null, h = u ? u.originalStart : this.originalLines.length, c = u ? u.modifiedStart : this.modifiedLines.length;
      for (; s < h && a < c; ) {
        const d = this.originalLines[s], m = this.modifiedLines[a];
        if (d !== m) {
          {
            let g = kr(d, 1), p = kr(m, 1);
            for (; g > 1 && p > 1; ) {
              const x = d.charCodeAt(g - 2), w = m.charCodeAt(p - 2);
              if (x !== w)
                break;
              g--, p--;
            }
            (g > 1 || p > 1) && this._pushTrimWhitespaceCharChange(i, s + 1, 1, g, a + 1, 1, p);
          }
          {
            let g = Rr(d, 1), p = Rr(m, 1);
            const x = d.length + 1, w = m.length + 1;
            for (; g < x && p < w; ) {
              const L = d.charCodeAt(g - 1), v = d.charCodeAt(p - 1);
              if (L !== v)
                break;
              g++, p++;
            }
            (g < x || p < w) && this._pushTrimWhitespaceCharChange(i, s + 1, g, x, a + 1, p, w);
          }
        }
        s++, a++;
      }
      u && (i.push(Gt.createFromDiffResult(this.shouldIgnoreTrimWhitespace, u, this.original, this.modified, this.continueCharDiff, this.shouldComputeCharChanges, this.shouldPostProcessCharChanges)), s += u.originalLength, a += u.modifiedLength);
    }
    return {
      quitEarly: r,
      changes: i
    };
  }
  _pushTrimWhitespaceCharChange(t, n, r, i, s, a, l) {
    if (this._mergeTrimWhitespaceCharChange(t, n, r, i, s, a, l))
      return;
    let o;
    this.shouldComputeCharChanges && (o = [new Et(n, r, n, i, s, a, s, l)]), t.push(new Gt(n, n, s, s, o));
  }
  _mergeTrimWhitespaceCharChange(t, n, r, i, s, a, l) {
    const o = t.length;
    if (o === 0)
      return !1;
    const u = t[o - 1];
    return u.originalEndLineNumber === 0 || u.modifiedEndLineNumber === 0 ? !1 : u.originalEndLineNumber === n && u.modifiedEndLineNumber === s ? (this.shouldComputeCharChanges && u.charChanges && u.charChanges.push(new Et(n, r, n, i, s, a, s, l)), !0) : u.originalEndLineNumber + 1 === n && u.modifiedEndLineNumber + 1 === s ? (u.originalEndLineNumber = n, u.modifiedEndLineNumber = s, this.shouldComputeCharChanges && u.charChanges && u.charChanges.push(new Et(n, r, n, i, s, a, s, l)), !0) : !1;
  }
}
function kr(e, t) {
  const n = Oo(e);
  return n === -1 ? t : n + 1;
}
function Rr(e, t) {
  const n = $o(e);
  return n === -1 ? t : n + 2;
}
function Os(e) {
  if (e === 0)
    return () => !0;
  const t = Date.now();
  return () => Date.now() - t < e;
}
function fu(e, t, n = (r, i) => r === i) {
  if (e === t)
    return !0;
  if (!e || !t || e.length !== t.length)
    return !1;
  for (let r = 0, i = e.length; r < i; r++)
    if (!n(e[r], t[r]))
      return !1;
  return !0;
}
function* hu(e, t) {
  let n, r;
  for (const i of e)
    r !== void 0 && t(r, i) ? n.push(i) : (n && (yield n), n = [i]), r = i;
  n && (yield n);
}
function du(e, t) {
  for (let n = 0; n <= e.length; n++)
    t(n === 0 ? void 0 : e[n - 1], n === e.length ? void 0 : e[n]);
}
function mu(e, t) {
  for (let n = 0; n < e.length; n++)
    t(n === 0 ? void 0 : e[n - 1], e[n], n + 1 === e.length ? void 0 : e[n + 1]);
}
function gu(e, t) {
  for (const n of t)
    e.push(n);
}
var Er;
(function(e) {
  function t(s) {
    return s < 0;
  }
  e.isLessThan = t;
  function n(s) {
    return s <= 0;
  }
  e.isLessThanOrEqual = n;
  function r(s) {
    return s > 0;
  }
  e.isGreaterThan = r;
  function i(s) {
    return s === 0;
  }
  e.isNeitherLessOrGreaterThan = i, e.greaterThan = 1, e.lessThan = -1, e.neitherLessOrGreaterThan = 0;
})(Er || (Er = {}));
function vn(e, t) {
  return (n, r) => t(e(n), e(r));
}
const xn = (e, t) => e - t;
function pu(e) {
  return (t, n) => -e(t, n);
}
const kt = class kt {
  constructor(t) {
    this.iterate = t;
  }
  toArray() {
    const t = [];
    return this.iterate((n) => (t.push(n), !0)), t;
  }
  filter(t) {
    return new kt((n) => this.iterate((r) => t(r) ? n(r) : !0));
  }
  map(t) {
    return new kt((n) => this.iterate((r) => n(t(r))));
  }
  findLast(t) {
    let n;
    return this.iterate((r) => (t(r) && (n = r), !0)), n;
  }
  findLastMaxBy(t) {
    let n, r = !0;
    return this.iterate((i) => ((r || Er.isGreaterThan(t(i, n))) && (r = !1, n = i), !0)), n;
  }
};
kt.empty = new kt((t) => {
});
let $s = kt;
class qe {
  static trivial(t, n) {
    return new qe([new Y(W.ofLength(t.length), W.ofLength(n.length))], !1);
  }
  static trivialTimedOut(t, n) {
    return new qe([new Y(W.ofLength(t.length), W.ofLength(n.length))], !0);
  }
  constructor(t, n) {
    this.diffs = t, this.hitTimeout = n;
  }
}
class Y {
  static invert(t, n) {
    const r = [];
    return du(t, (i, s) => {
      r.push(Y.fromOffsetPairs(i ? i.getEndExclusives() : $e.zero, s ? s.getStarts() : new $e(n, (i ? i.seq2Range.endExclusive - i.seq1Range.endExclusive : 0) + n)));
    }), r;
  }
  static fromOffsetPairs(t, n) {
    return new Y(new W(t.offset1, n.offset1), new W(t.offset2, n.offset2));
  }
  static assertSorted(t) {
    let n;
    for (const r of t) {
      if (n && !(n.seq1Range.endExclusive <= r.seq1Range.start && n.seq2Range.endExclusive <= r.seq2Range.start))
        throw new we("Sequence diffs must be sorted");
      n = r;
    }
  }
  constructor(t, n) {
    this.seq1Range = t, this.seq2Range = n;
  }
  swap() {
    return new Y(this.seq2Range, this.seq1Range);
  }
  toString() {
    return `${this.seq1Range} <-> ${this.seq2Range}`;
  }
  join(t) {
    return new Y(this.seq1Range.join(t.seq1Range), this.seq2Range.join(t.seq2Range));
  }
  delta(t) {
    return t === 0 ? this : new Y(this.seq1Range.delta(t), this.seq2Range.delta(t));
  }
  deltaStart(t) {
    return t === 0 ? this : new Y(this.seq1Range.deltaStart(t), this.seq2Range.deltaStart(t));
  }
  deltaEnd(t) {
    return t === 0 ? this : new Y(this.seq1Range.deltaEnd(t), this.seq2Range.deltaEnd(t));
  }
  intersect(t) {
    const n = this.seq1Range.intersect(t.seq1Range), r = this.seq2Range.intersect(t.seq2Range);
    if (!(!n || !r))
      return new Y(n, r);
  }
  getStarts() {
    return new $e(this.seq1Range.start, this.seq2Range.start);
  }
  getEndExclusives() {
    return new $e(this.seq1Range.endExclusive, this.seq2Range.endExclusive);
  }
}
const ot = class ot {
  constructor(t, n) {
    this.offset1 = t, this.offset2 = n;
  }
  toString() {
    return `${this.offset1} <-> ${this.offset2}`;
  }
  delta(t) {
    return t === 0 ? this : new ot(this.offset1 + t, this.offset2 + t);
  }
  equals(t) {
    return this.offset1 === t.offset1 && this.offset2 === t.offset2;
  }
};
ot.zero = new ot(0, 0), ot.max = new ot(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
let $e = ot;
const Hn = class Hn {
  isValid() {
    return !0;
  }
};
Hn.instance = new Hn();
let nn = Hn;
class bu {
  constructor(t) {
    if (this.timeout = t, this.startTime = Date.now(), this.valid = !0, t <= 0)
      throw new we("timeout must be positive");
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
class tr {
  constructor(t, n) {
    this.width = t, this.height = n, this.array = [], this.array = new Array(t * n);
  }
  get(t, n) {
    return this.array[t + n * this.width];
  }
  set(t, n, r) {
    this.array[t + n * this.width] = r;
  }
}
function Mr(e) {
  return e === 32 || e === 9;
}
const Yt = class Yt {
  static getKey(t) {
    let n = this.chrKeys.get(t);
    return n === void 0 && (n = this.chrKeys.size, this.chrKeys.set(t, n)), n;
  }
  constructor(t, n, r) {
    this.range = t, this.lines = n, this.source = r, this.histogram = [];
    let i = 0;
    for (let s = t.startLineNumber - 1; s < t.endLineNumberExclusive - 1; s++) {
      const a = n[s];
      for (let o = 0; o < a.length; o++) {
        i++;
        const u = a[o], h = Yt.getKey(u);
        this.histogram[h] = (this.histogram[h] || 0) + 1;
      }
      i++;
      const l = Yt.getKey(`
`);
      this.histogram[l] = (this.histogram[l] || 0) + 1;
    }
    this.totalCount = i;
  }
  computeSimilarity(t) {
    let n = 0;
    const r = Math.max(this.histogram.length, t.histogram.length);
    for (let i = 0; i < r; i++)
      n += Math.abs((this.histogram[i] ?? 0) - (t.histogram[i] ?? 0));
    return 1 - n / (this.totalCount + t.totalCount);
  }
};
Yt.chrKeys = /* @__PURE__ */ new Map();
let Cn = Yt;
class vu {
  compute(t, n, r = nn.instance, i) {
    if (t.length === 0 || n.length === 0)
      return qe.trivial(t, n);
    const s = new tr(t.length, n.length), a = new tr(t.length, n.length), l = new tr(t.length, n.length);
    for (let g = 0; g < t.length; g++)
      for (let p = 0; p < n.length; p++) {
        if (!r.isValid())
          return qe.trivialTimedOut(t, n);
        const x = g === 0 ? 0 : s.get(g - 1, p), w = p === 0 ? 0 : s.get(g, p - 1);
        let L;
        t.getElement(g) === n.getElement(p) ? (g === 0 || p === 0 ? L = 0 : L = s.get(g - 1, p - 1), g > 0 && p > 0 && a.get(g - 1, p - 1) === 3 && (L += l.get(g - 1, p - 1)), L += i ? i(g, p) : 1) : L = -1;
        const v = Math.max(x, w, L);
        if (v === L) {
          const y = g > 0 && p > 0 ? l.get(g - 1, p - 1) : 0;
          l.set(g, p, y + 1), a.set(g, p, 3);
        } else
          v === x ? (l.set(g, p, 0), a.set(g, p, 1)) : v === w && (l.set(g, p, 0), a.set(g, p, 2));
        s.set(g, p, v);
      }
    const o = [];
    let u = t.length, h = n.length;
    function c(g, p) {
      (g + 1 !== u || p + 1 !== h) && o.push(new Y(new W(g + 1, u), new W(p + 1, h))), u = g, h = p;
    }
    let d = t.length - 1, m = n.length - 1;
    for (; d >= 0 && m >= 0; )
      a.get(d, m) === 3 ? (c(d, m), d--, m--) : a.get(d, m) === 1 ? d-- : m--;
    return c(-1, -1), o.reverse(), new qe(o, !1);
  }
}
class Da {
  compute(t, n, r = nn.instance) {
    if (t.length === 0 || n.length === 0)
      return qe.trivial(t, n);
    const i = t, s = n;
    function a(p, x) {
      for (; p < i.length && x < s.length && i.getElement(p) === s.getElement(x); )
        p++, x++;
      return p;
    }
    let l = 0;
    const o = new xu();
    o.set(0, a(0, 0));
    const u = new yu();
    u.set(0, o.get(0) === 0 ? null : new Us(null, 0, 0, o.get(0)));
    let h = 0;
    e:
      for (; ; ) {
        if (l++, !r.isValid())
          return qe.trivialTimedOut(i, s);
        const p = -Math.min(l, s.length + l % 2), x = Math.min(l, i.length + l % 2);
        for (h = p; h <= x; h += 2) {
          const w = h === x ? -1 : o.get(h + 1), L = h === p ? -1 : o.get(h - 1) + 1, v = Math.min(Math.max(w, L), i.length), y = v - h;
          if (v > i.length || y > s.length)
            continue;
          const b = a(v, y);
          o.set(h, b);
          const _ = v === w ? u.get(h + 1) : u.get(h - 1);
          if (u.set(h, b !== v ? new Us(_, v, y, b - v) : _), o.get(h) === i.length && o.get(h) - h === s.length)
            break e;
        }
      }
    let c = u.get(h);
    const d = [];
    let m = i.length, g = s.length;
    for (; ; ) {
      const p = c ? c.x + c.length : 0, x = c ? c.y + c.length : 0;
      if ((p !== m || x !== g) && d.push(new Y(new W(p, m), new W(x, g))), !c)
        break;
      m = c.x, g = c.y, c = c.prev;
    }
    return d.reverse(), new qe(d, !1);
  }
}
class Us {
  constructor(t, n, r, i) {
    this.prev = t, this.x = n, this.y = r, this.length = i;
  }
}
class xu {
  constructor() {
    this.positiveArr = new Int32Array(10), this.negativeArr = new Int32Array(10);
  }
  get(t) {
    return t < 0 ? (t = -t - 1, this.negativeArr[t]) : this.positiveArr[t];
  }
  set(t, n) {
    if (t < 0) {
      if (t = -t - 1, t >= this.negativeArr.length) {
        const r = this.negativeArr;
        this.negativeArr = new Int32Array(r.length * 2), this.negativeArr.set(r);
      }
      this.negativeArr[t] = n;
    } else {
      if (t >= this.positiveArr.length) {
        const r = this.positiveArr;
        this.positiveArr = new Int32Array(r.length * 2), this.positiveArr.set(r);
      }
      this.positiveArr[t] = n;
    }
  }
}
class yu {
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
class Tn {
  constructor(t, n, r) {
    this.lines = t, this.range = n, this.considerWhitespaceChanges = r, this.elements = [], this.firstElementOffsetByLineIdx = [], this.lineStartOffsets = [], this.trimmedWsLengthsByLineIdx = [], this.firstElementOffsetByLineIdx.push(0);
    for (let i = this.range.startLineNumber; i <= this.range.endLineNumber; i++) {
      let s = t[i - 1], a = 0;
      i === this.range.startLineNumber && this.range.startColumn > 1 && (a = this.range.startColumn - 1, s = s.substring(a)), this.lineStartOffsets.push(a);
      let l = 0;
      if (!r) {
        const u = s.trimStart();
        l = s.length - u.length, s = u.trimEnd();
      }
      this.trimmedWsLengthsByLineIdx.push(l);
      const o = i === this.range.endLineNumber ? Math.min(this.range.endColumn - 1 - a - l, s.length) : s.length;
      for (let u = 0; u < o; u++)
        this.elements.push(s.charCodeAt(u));
      i < this.range.endLineNumber && (this.elements.push(10), this.firstElementOffsetByLineIdx.push(this.elements.length));
    }
  }
  toString() {
    return `Slice: "${this.text}"`;
  }
  get text() {
    return this.getText(new W(0, this.length));
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
    const n = qs(t > 0 ? this.elements[t - 1] : -1), r = qs(t < this.elements.length ? this.elements[t] : -1);
    if (n === 7 && r === 8)
      return 0;
    if (n === 8)
      return 150;
    let i = 0;
    return n !== r && (i += 10, n === 0 && r === 1 && (i += 1)), i += Bs(n), i += Bs(r), i;
  }
  translateOffset(t, n = "right") {
    const r = tn(this.firstElementOffsetByLineIdx, (s) => s <= t), i = t - this.firstElementOffsetByLineIdx[r];
    return new ee(this.range.startLineNumber + r, 1 + this.lineStartOffsets[r] + i + (i === 0 && n === "left" ? 0 : this.trimmedWsLengthsByLineIdx[r]));
  }
  translateRange(t) {
    const n = this.translateOffset(t.start, "right"), r = this.translateOffset(t.endExclusive, "left");
    return r.isBefore(n) ? z.fromPositions(r, r) : z.fromPositions(n, r);
  }
  /**
   * Finds the word that contains the character at the given offset
   */
  findWordContaining(t) {
    if (t < 0 || t >= this.elements.length || !nr(this.elements[t]))
      return;
    let n = t;
    for (; n > 0 && nr(this.elements[n - 1]); )
      n--;
    let r = t;
    for (; r < this.elements.length && nr(this.elements[r]); )
      r++;
    return new W(n, r);
  }
  countLinesIn(t) {
    return this.translateOffset(t.endExclusive).lineNumber - this.translateOffset(t.start).lineNumber;
  }
  isStronglyEqual(t, n) {
    return this.elements[t] === this.elements[n];
  }
  extendToFullLines(t) {
    const n = Pt(this.firstElementOffsetByLineIdx, (i) => i <= t.start) ?? 0, r = iu(this.firstElementOffsetByLineIdx, (i) => t.endExclusive <= i) ?? this.elements.length;
    return new W(n, r);
  }
}
function nr(e) {
  return e >= 97 && e <= 122 || e >= 65 && e <= 90 || e >= 48 && e <= 57;
}
const wu = {
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
function Bs(e) {
  return wu[e];
}
function qs(e) {
  return e === 10 ? 8 : e === 13 ? 7 : Mr(e) ? 6 : e >= 97 && e <= 122 ? 0 : e >= 65 && e <= 90 ? 1 : e >= 48 && e <= 57 ? 2 : e === -1 ? 3 : e === 44 || e === 59 ? 5 : 4;
}
function _u(e, t, n, r, i, s) {
  let { moves: a, excludedChanges: l } = Nu(e, t, n, s);
  if (!s.isValid())
    return [];
  const o = e.filter((h) => !l.has(h)), u = Su(o, r, i, t, n, s);
  return gu(a, u), a = Au(a), a = a.filter((h) => {
    const c = h.original.toOffsetRange().slice(t).map((m) => m.trim());
    return c.join(`
`).length >= 15 && Lu(c, (m) => m.length >= 2) >= 2;
  }), a = ku(e, a), a;
}
function Lu(e, t) {
  let n = 0;
  for (const r of e)
    t(r) && n++;
  return n;
}
function Nu(e, t, n, r) {
  const i = [], s = e.filter((o) => o.modified.isEmpty && o.original.length >= 3).map((o) => new Cn(o.original, t, o)), a = new Set(e.filter((o) => o.original.isEmpty && o.modified.length >= 3).map((o) => new Cn(o.modified, n, o))), l = /* @__PURE__ */ new Set();
  for (const o of s) {
    let u = -1, h;
    for (const c of a) {
      const d = o.computeSimilarity(c);
      d > u && (u = d, h = c);
    }
    if (u > 0.9 && h && (a.delete(h), i.push(new Se(o.range, h.range)), l.add(o.source), l.add(h.source)), !r.isValid())
      return { moves: i, excludedChanges: l };
  }
  return { moves: i, excludedChanges: l };
}
function Su(e, t, n, r, i, s) {
  const a = [], l = new Wl();
  for (const d of e)
    for (let m = d.original.startLineNumber; m < d.original.endLineNumberExclusive - 2; m++) {
      const g = `${t[m - 1]}:${t[m + 1 - 1]}:${t[m + 2 - 1]}`;
      l.add(g, { range: new U(m, m + 3) });
    }
  const o = [];
  e.sort(vn((d) => d.modified.startLineNumber, xn));
  for (const d of e) {
    let m = [];
    for (let g = d.modified.startLineNumber; g < d.modified.endLineNumberExclusive - 2; g++) {
      const p = `${n[g - 1]}:${n[g + 1 - 1]}:${n[g + 2 - 1]}`, x = new U(g, g + 3), w = [];
      l.forEach(p, ({ range: L }) => {
        for (const y of m)
          if (y.originalLineRange.endLineNumberExclusive + 1 === L.endLineNumberExclusive && y.modifiedLineRange.endLineNumberExclusive + 1 === x.endLineNumberExclusive) {
            y.originalLineRange = new U(y.originalLineRange.startLineNumber, L.endLineNumberExclusive), y.modifiedLineRange = new U(y.modifiedLineRange.startLineNumber, x.endLineNumberExclusive), w.push(y);
            return;
          }
        const v = {
          modifiedLineRange: x,
          originalLineRange: L
        };
        o.push(v), w.push(v);
      }), m = w;
    }
    if (!s.isValid())
      return [];
  }
  o.sort(pu(vn((d) => d.modifiedLineRange.length, xn)));
  const u = new Fe(), h = new Fe();
  for (const d of o) {
    const m = d.modifiedLineRange.startLineNumber - d.originalLineRange.startLineNumber, g = u.subtractFrom(d.modifiedLineRange), p = h.subtractFrom(d.originalLineRange).getWithDelta(m), x = g.getIntersection(p);
    for (const w of x.ranges) {
      if (w.length < 3)
        continue;
      const L = w, v = w.delta(-m);
      a.push(new Se(v, L)), u.addRange(L), h.addRange(v);
    }
  }
  a.sort(vn((d) => d.original.startLineNumber, xn));
  const c = new Mn(e);
  for (let d = 0; d < a.length; d++) {
    const m = a[d], g = c.findLastMonotonous((_) => _.original.startLineNumber <= m.original.startLineNumber), p = Pt(e, (_) => _.modified.startLineNumber <= m.modified.startLineNumber), x = Math.max(m.original.startLineNumber - g.original.startLineNumber, m.modified.startLineNumber - p.modified.startLineNumber), w = c.findLastMonotonous((_) => _.original.startLineNumber < m.original.endLineNumberExclusive), L = Pt(e, (_) => _.modified.startLineNumber < m.modified.endLineNumberExclusive), v = Math.max(w.original.endLineNumberExclusive - m.original.endLineNumberExclusive, L.modified.endLineNumberExclusive - m.modified.endLineNumberExclusive);
    let y;
    for (y = 0; y < x; y++) {
      const _ = m.original.startLineNumber - y - 1, k = m.modified.startLineNumber - y - 1;
      if (_ > r.length || k > i.length || u.contains(k) || h.contains(_) || !js(r[_ - 1], i[k - 1], s))
        break;
    }
    y > 0 && (h.addRange(new U(m.original.startLineNumber - y, m.original.startLineNumber)), u.addRange(new U(m.modified.startLineNumber - y, m.modified.startLineNumber)));
    let b;
    for (b = 0; b < v; b++) {
      const _ = m.original.endLineNumberExclusive + b, k = m.modified.endLineNumberExclusive + b;
      if (_ > r.length || k > i.length || u.contains(k) || h.contains(_) || !js(r[_ - 1], i[k - 1], s))
        break;
    }
    b > 0 && (h.addRange(new U(m.original.endLineNumberExclusive, m.original.endLineNumberExclusive + b)), u.addRange(new U(m.modified.endLineNumberExclusive, m.modified.endLineNumberExclusive + b))), (y > 0 || b > 0) && (a[d] = new Se(new U(m.original.startLineNumber - y, m.original.endLineNumberExclusive + b), new U(m.modified.startLineNumber - y, m.modified.endLineNumberExclusive + b)));
  }
  return a;
}
function js(e, t, n) {
  if (e.trim() === t.trim())
    return !0;
  if (e.length > 300 && t.length > 300)
    return !1;
  const i = new Da().compute(new Tn([e], new z(1, 1, 1, e.length), !1), new Tn([t], new z(1, 1, 1, t.length), !1), n);
  let s = 0;
  const a = Y.invert(i.diffs, e.length);
  for (const h of a)
    h.seq1Range.forEach((c) => {
      Mr(e.charCodeAt(c)) || s++;
    });
  function l(h) {
    let c = 0;
    for (let d = 0; d < e.length; d++)
      Mr(h.charCodeAt(d)) || c++;
    return c;
  }
  const o = l(e.length > t.length ? e : t);
  return s / o > 0.6 && o > 10;
}
function Au(e) {
  if (e.length === 0)
    return e;
  e.sort(vn((n) => n.original.startLineNumber, xn));
  const t = [e[0]];
  for (let n = 1; n < e.length; n++) {
    const r = t[t.length - 1], i = e[n], s = i.original.startLineNumber - r.original.endLineNumberExclusive, a = i.modified.startLineNumber - r.modified.endLineNumberExclusive;
    if (s >= 0 && a >= 0 && s + a <= 2) {
      t[t.length - 1] = r.join(i);
      continue;
    }
    t.push(i);
  }
  return t;
}
function ku(e, t) {
  const n = new Mn(e);
  return t = t.filter((r) => {
    const i = n.findLastMonotonous((l) => l.original.startLineNumber < r.original.endLineNumberExclusive) || new Se(new U(1, 1), new U(1, 1)), s = Pt(e, (l) => l.modified.startLineNumber < r.modified.endLineNumberExclusive);
    return i !== s;
  }), t;
}
function Ws(e, t, n) {
  let r = n;
  return r = Hs(e, t, r), r = Hs(e, t, r), r = Ru(e, t, r), r;
}
function Hs(e, t, n) {
  if (n.length === 0)
    return n;
  const r = [];
  r.push(n[0]);
  for (let s = 1; s < n.length; s++) {
    const a = r[r.length - 1];
    let l = n[s];
    if (l.seq1Range.isEmpty || l.seq2Range.isEmpty) {
      const o = l.seq1Range.start - a.seq1Range.endExclusive;
      let u;
      for (u = 1; u <= o && !(e.getElement(l.seq1Range.start - u) !== e.getElement(l.seq1Range.endExclusive - u) || t.getElement(l.seq2Range.start - u) !== t.getElement(l.seq2Range.endExclusive - u)); u++)
        ;
      if (u--, u === o) {
        r[r.length - 1] = new Y(new W(a.seq1Range.start, l.seq1Range.endExclusive - o), new W(a.seq2Range.start, l.seq2Range.endExclusive - o));
        continue;
      }
      l = l.delta(-u);
    }
    r.push(l);
  }
  const i = [];
  for (let s = 0; s < r.length - 1; s++) {
    const a = r[s + 1];
    let l = r[s];
    if (l.seq1Range.isEmpty || l.seq2Range.isEmpty) {
      const o = a.seq1Range.start - l.seq1Range.endExclusive;
      let u;
      for (u = 0; u < o && !(!e.isStronglyEqual(l.seq1Range.start + u, l.seq1Range.endExclusive + u) || !t.isStronglyEqual(l.seq2Range.start + u, l.seq2Range.endExclusive + u)); u++)
        ;
      if (u === o) {
        r[s + 1] = new Y(new W(l.seq1Range.start + o, a.seq1Range.endExclusive), new W(l.seq2Range.start + o, a.seq2Range.endExclusive));
        continue;
      }
      u > 0 && (l = l.delta(u));
    }
    i.push(l);
  }
  return r.length > 0 && i.push(r[r.length - 1]), i;
}
function Ru(e, t, n) {
  if (!e.getBoundaryScore || !t.getBoundaryScore)
    return n;
  for (let r = 0; r < n.length; r++) {
    const i = r > 0 ? n[r - 1] : void 0, s = n[r], a = r + 1 < n.length ? n[r + 1] : void 0, l = new W(i ? i.seq1Range.endExclusive + 1 : 0, a ? a.seq1Range.start - 1 : e.length), o = new W(i ? i.seq2Range.endExclusive + 1 : 0, a ? a.seq2Range.start - 1 : t.length);
    s.seq1Range.isEmpty ? n[r] = zs(s, e, t, l, o) : s.seq2Range.isEmpty && (n[r] = zs(s.swap(), t, e, o, l).swap());
  }
  return n;
}
function zs(e, t, n, r, i) {
  let a = 1;
  for (; e.seq1Range.start - a >= r.start && e.seq2Range.start - a >= i.start && n.isStronglyEqual(e.seq2Range.start - a, e.seq2Range.endExclusive - a) && a < 100; )
    a++;
  a--;
  let l = 0;
  for (; e.seq1Range.start + l < r.endExclusive && e.seq2Range.endExclusive + l < i.endExclusive && n.isStronglyEqual(e.seq2Range.start + l, e.seq2Range.endExclusive + l) && l < 100; )
    l++;
  if (a === 0 && l === 0)
    return e;
  let o = 0, u = -1;
  for (let h = -a; h <= l; h++) {
    const c = e.seq2Range.start + h, d = e.seq2Range.endExclusive + h, m = e.seq1Range.start + h, g = t.getBoundaryScore(m) + n.getBoundaryScore(c) + n.getBoundaryScore(d);
    g > u && (u = g, o = h);
  }
  return e.delta(o);
}
function Eu(e, t, n) {
  const r = [];
  for (const i of n) {
    const s = r[r.length - 1];
    if (!s) {
      r.push(i);
      continue;
    }
    i.seq1Range.start - s.seq1Range.endExclusive <= 2 || i.seq2Range.start - s.seq2Range.endExclusive <= 2 ? r[r.length - 1] = new Y(s.seq1Range.join(i.seq1Range), s.seq2Range.join(i.seq2Range)) : r.push(i);
  }
  return r;
}
function Mu(e, t, n) {
  const r = Y.invert(n, e.length), i = [];
  let s = new $e(0, 0);
  function a(o, u) {
    if (o.offset1 < s.offset1 || o.offset2 < s.offset2)
      return;
    const h = e.findWordContaining(o.offset1), c = t.findWordContaining(o.offset2);
    if (!h || !c)
      return;
    let d = new Y(h, c);
    const m = d.intersect(u);
    let g = m.seq1Range.length, p = m.seq2Range.length;
    for (; r.length > 0; ) {
      const x = r[0];
      if (!(x.seq1Range.intersects(d.seq1Range) || x.seq2Range.intersects(d.seq2Range)))
        break;
      const L = e.findWordContaining(x.seq1Range.start), v = t.findWordContaining(x.seq2Range.start), y = new Y(L, v), b = y.intersect(x);
      if (g += b.seq1Range.length, p += b.seq2Range.length, d = d.join(y), d.seq1Range.endExclusive >= x.seq1Range.endExclusive)
        r.shift();
      else
        break;
    }
    g + p < (d.seq1Range.length + d.seq2Range.length) * 2 / 3 && i.push(d), s = d.getEndExclusives();
  }
  for (; r.length > 0; ) {
    const o = r.shift();
    o.seq1Range.isEmpty || (a(o.getStarts(), o), a(o.getEndExclusives().delta(-1), o));
  }
  return Cu(n, i);
}
function Cu(e, t) {
  const n = [];
  for (; e.length > 0 || t.length > 0; ) {
    const r = e[0], i = t[0];
    let s;
    r && (!i || r.seq1Range.start < i.seq1Range.start) ? s = e.shift() : s = t.shift(), n.length > 0 && n[n.length - 1].seq1Range.endExclusive >= s.seq1Range.start ? n[n.length - 1] = n[n.length - 1].join(s) : n.push(s);
  }
  return n;
}
function Tu(e, t, n) {
  let r = n;
  if (r.length === 0)
    return r;
  let i = 0, s;
  do {
    s = !1;
    const l = [
      r[0]
    ];
    for (let o = 1; o < r.length; o++) {
      let c = function(m, g) {
        const p = new W(h.seq1Range.endExclusive, u.seq1Range.start);
        return e.getText(p).replace(/\s/g, "").length <= 4 && (m.seq1Range.length + m.seq2Range.length > 5 || g.seq1Range.length + g.seq2Range.length > 5);
      };
      var a = c;
      const u = r[o], h = l[l.length - 1];
      c(h, u) ? (s = !0, l[l.length - 1] = l[l.length - 1].join(u)) : l.push(u);
    }
    r = l;
  } while (i++ < 10 && s);
  return r;
}
function Pu(e, t, n) {
  let r = n;
  if (r.length === 0)
    return r;
  let i = 0, s;
  do {
    s = !1;
    const o = [
      r[0]
    ];
    for (let u = 1; u < r.length; u++) {
      let d = function(g, p) {
        const x = new W(c.seq1Range.endExclusive, h.seq1Range.start);
        if (e.countLinesIn(x) > 5 || x.length > 500)
          return !1;
        const L = e.getText(x).trim();
        if (L.length > 20 || L.split(/\r\n|\r|\n/).length > 1)
          return !1;
        const v = e.countLinesIn(g.seq1Range), y = g.seq1Range.length, b = t.countLinesIn(g.seq2Range), _ = g.seq2Range.length, k = e.countLinesIn(p.seq1Range), C = p.seq1Range.length, F = t.countLinesIn(p.seq2Range), O = p.seq2Range.length, M = 2 * 40 + 50;
        function N(S) {
          return Math.min(S, M);
        }
        return Math.pow(Math.pow(N(v * 40 + y), 1.5) + Math.pow(N(b * 40 + _), 1.5), 1.5) + Math.pow(Math.pow(N(k * 40 + C), 1.5) + Math.pow(N(F * 40 + O), 1.5), 1.5) > (M ** 1.5) ** 1.5 * 1.3;
      };
      var l = d;
      const h = r[u], c = o[o.length - 1];
      d(c, h) ? (s = !0, o[o.length - 1] = o[o.length - 1].join(h)) : o.push(h);
    }
    r = o;
  } while (i++ < 10 && s);
  const a = [];
  return mu(r, (o, u, h) => {
    let c = u;
    function d(L) {
      return L.length > 0 && L.trim().length <= 3 && u.seq1Range.length + u.seq2Range.length > 100;
    }
    const m = e.extendToFullLines(u.seq1Range), g = e.getText(new W(m.start, u.seq1Range.start));
    d(g) && (c = c.deltaStart(-g.length));
    const p = e.getText(new W(u.seq1Range.endExclusive, m.endExclusive));
    d(p) && (c = c.deltaEnd(p.length));
    const x = Y.fromOffsetPairs(o ? o.getEndExclusives() : $e.zero, h ? h.getStarts() : $e.max), w = c.intersect(x);
    a.length > 0 && w.getStarts().equals(a[a.length - 1].getEndExclusives()) ? a[a.length - 1] = a[a.length - 1].join(w) : a.push(w);
  }), a;
}
class Gs {
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
    const n = t === 0 ? 0 : Js(this.lines[t - 1]), r = t === this.lines.length ? 0 : Js(this.lines[t]);
    return 1e3 - (n + r);
  }
  getText(t) {
    return this.lines.slice(t.start, t.endExclusive).join(`
`);
  }
  isStronglyEqual(t, n) {
    return this.lines[t] === this.lines[n];
  }
}
function Js(e) {
  let t = 0;
  for (; t < e.length && (e.charCodeAt(t) === 32 || e.charCodeAt(t) === 9); )
    t++;
  return t;
}
class Iu {
  constructor() {
    this.dynamicProgrammingDiffing = new vu(), this.myersDiffingAlgorithm = new Da();
  }
  computeDiff(t, n, r) {
    if (t.length <= 1 && fu(t, n, (b, _) => b === _))
      return new bn([], [], !1);
    if (t.length === 1 && t[0].length === 0 || n.length === 1 && n[0].length === 0)
      return new bn([
        new Be(new U(1, t.length + 1), new U(1, n.length + 1), [
          new Ee(new z(1, 1, t.length, t[t.length - 1].length + 1), new z(1, 1, n.length, n[n.length - 1].length + 1))
        ])
      ], [], !1);
    const i = r.maxComputationTimeMs === 0 ? nn.instance : new bu(r.maxComputationTimeMs), s = !r.ignoreTrimWhitespace, a = /* @__PURE__ */ new Map();
    function l(b) {
      let _ = a.get(b);
      return _ === void 0 && (_ = a.size, a.set(b, _)), _;
    }
    const o = t.map((b) => l(b.trim())), u = n.map((b) => l(b.trim())), h = new Gs(o, t), c = new Gs(u, n), d = h.length + c.length < 1700 ? this.dynamicProgrammingDiffing.compute(h, c, i, (b, _) => t[b] === n[_] ? n[_].length === 0 ? 0.1 : 1 + Math.log(1 + n[_].length) : 0.99) : this.myersDiffingAlgorithm.compute(h, c, i);
    let m = d.diffs, g = d.hitTimeout;
    m = Ws(h, c, m), m = Tu(h, c, m);
    const p = [], x = (b) => {
      if (s)
        for (let _ = 0; _ < b; _++) {
          const k = w + _, C = L + _;
          if (t[k] !== n[C]) {
            const F = this.refineDiff(t, n, new Y(new W(k, k + 1), new W(C, C + 1)), i, s);
            for (const O of F.mappings)
              p.push(O);
            F.hitTimeout && (g = !0);
          }
        }
    };
    let w = 0, L = 0;
    for (const b of m) {
      En(() => b.seq1Range.start - w === b.seq2Range.start - L);
      const _ = b.seq1Range.start - w;
      x(_), w = b.seq1Range.endExclusive, L = b.seq2Range.endExclusive;
      const k = this.refineDiff(t, n, b, i, s);
      k.hitTimeout && (g = !0);
      for (const C of k.mappings)
        p.push(C);
    }
    x(t.length - w);
    const v = Xs(p, t, n);
    let y = [];
    return r.computeMoves && (y = this.computeMoves(v, t, n, o, u, i, s)), En(() => {
      function b(k, C) {
        if (k.lineNumber < 1 || k.lineNumber > C.length)
          return !1;
        const F = C[k.lineNumber - 1];
        return !(k.column < 1 || k.column > F.length + 1);
      }
      function _(k, C) {
        return !(k.startLineNumber < 1 || k.startLineNumber > C.length + 1 || k.endLineNumberExclusive < 1 || k.endLineNumberExclusive > C.length + 1);
      }
      for (const k of v) {
        if (!k.innerChanges)
          return !1;
        for (const C of k.innerChanges)
          if (!(b(C.modifiedRange.getStartPosition(), n) && b(C.modifiedRange.getEndPosition(), n) && b(C.originalRange.getStartPosition(), t) && b(C.originalRange.getEndPosition(), t)))
            return !1;
        if (!_(k.modified, n) || !_(k.original, t))
          return !1;
      }
      return !0;
    }), new bn(v, y, g);
  }
  computeMoves(t, n, r, i, s, a, l) {
    return _u(t, n, r, i, s, a).map((h) => {
      const c = this.refineDiff(n, r, new Y(h.original.toOffsetRange(), h.modified.toOffsetRange()), a, l), d = Xs(c.mappings, n, r, !0);
      return new ru(h, d);
    });
  }
  refineDiff(t, n, r, i, s) {
    const l = Vu(r).toRangeMapping2(t, n), o = new Tn(t, l.originalRange, s), u = new Tn(n, l.modifiedRange, s), h = o.length + u.length < 500 ? this.dynamicProgrammingDiffing.compute(o, u, i) : this.myersDiffingAlgorithm.compute(o, u, i);
    let c = h.diffs;
    return c = Ws(o, u, c), c = Mu(o, u, c), c = Eu(o, u, c), c = Pu(o, u, c), {
      mappings: c.map((m) => new Ee(o.translateRange(m.seq1Range), u.translateRange(m.seq2Range))),
      hitTimeout: h.hitTimeout
    };
  }
}
function Xs(e, t, n, r = !1) {
  const i = [];
  for (const s of hu(e.map((a) => Fu(a, t, n)), (a, l) => a.original.overlapOrTouch(l.original) || a.modified.overlapOrTouch(l.modified))) {
    const a = s[0], l = s[s.length - 1];
    i.push(new Be(a.original.join(l.original), a.modified.join(l.modified), s.map((o) => o.innerChanges[0])));
  }
  return En(() => !r && i.length > 0 && (i[0].modified.startLineNumber !== i[0].original.startLineNumber || n.length - i[i.length - 1].modified.endLineNumberExclusive !== t.length - i[i.length - 1].original.endLineNumberExclusive) ? !1 : Ta(i, (s, a) => a.original.startLineNumber - s.original.endLineNumberExclusive === a.modified.startLineNumber - s.modified.endLineNumberExclusive && // There has to be an unchanged line in between (otherwise both diffs should have been joined)
  s.original.endLineNumberExclusive < a.original.startLineNumber && s.modified.endLineNumberExclusive < a.modified.startLineNumber)), i;
}
function Fu(e, t, n) {
  let r = 0, i = 0;
  e.modifiedRange.endColumn === 1 && e.originalRange.endColumn === 1 && e.originalRange.startLineNumber + r <= e.originalRange.endLineNumber && e.modifiedRange.startLineNumber + r <= e.modifiedRange.endLineNumber && (i = -1), e.modifiedRange.startColumn - 1 >= n[e.modifiedRange.startLineNumber - 1].length && e.originalRange.startColumn - 1 >= t[e.originalRange.startLineNumber - 1].length && e.originalRange.startLineNumber <= e.originalRange.endLineNumber + i && e.modifiedRange.startLineNumber <= e.modifiedRange.endLineNumber + i && (r = 1);
  const s = new U(e.originalRange.startLineNumber + r, e.originalRange.endLineNumber + 1 + i), a = new U(e.modifiedRange.startLineNumber + r, e.modifiedRange.endLineNumber + 1 + i);
  return new Be(s, a, [e]);
}
function Vu(e) {
  return new Se(new U(e.seq1Range.start + 1, e.seq1Range.endExclusive + 1), new U(e.seq2Range.start + 1, e.seq2Range.endExclusive + 1));
}
const Qs = {
  getLegacy: () => new ou(),
  getDefault: () => new Iu()
};
function nt(e, t) {
  const n = Math.pow(10, t);
  return Math.round(e * n) / n;
}
class ae {
  constructor(t, n, r, i = 1) {
    this._rgbaBrand = void 0, this.r = Math.min(255, Math.max(0, t)) | 0, this.g = Math.min(255, Math.max(0, n)) | 0, this.b = Math.min(255, Math.max(0, r)) | 0, this.a = nt(Math.max(Math.min(1, i), 0), 3);
  }
  static equals(t, n) {
    return t.r === n.r && t.g === n.g && t.b === n.b && t.a === n.a;
  }
}
class Ne {
  constructor(t, n, r, i) {
    this._hslaBrand = void 0, this.h = Math.max(Math.min(360, t), 0) | 0, this.s = nt(Math.max(Math.min(1, n), 0), 3), this.l = nt(Math.max(Math.min(1, r), 0), 3), this.a = nt(Math.max(Math.min(1, i), 0), 3);
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
    const n = t.r / 255, r = t.g / 255, i = t.b / 255, s = t.a, a = Math.max(n, r, i), l = Math.min(n, r, i);
    let o = 0, u = 0;
    const h = (l + a) / 2, c = a - l;
    if (c > 0) {
      switch (u = Math.min(h <= 0.5 ? c / (2 * h) : c / (2 - 2 * h), 1), a) {
        case n:
          o = (r - i) / c + (r < i ? 6 : 0);
          break;
        case r:
          o = (i - n) / c + 2;
          break;
        case i:
          o = (n - r) / c + 4;
          break;
      }
      o *= 60, o = Math.round(o);
    }
    return new Ne(o, u, h, s);
  }
  static _hue2rgb(t, n, r) {
    return r < 0 && (r += 1), r > 1 && (r -= 1), r < 1 / 6 ? t + (n - t) * 6 * r : r < 1 / 2 ? n : r < 2 / 3 ? t + (n - t) * (2 / 3 - r) * 6 : t;
  }
  /**
   * Converts an HSL color value to RGB. Conversion formula
   * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
   * Assumes h in the set [0, 360] s, and l are contained in the set [0, 1] and
   * returns r, g, and b in the set [0, 255].
   */
  static toRGBA(t) {
    const n = t.h / 360, { s: r, l: i, a: s } = t;
    let a, l, o;
    if (r === 0)
      a = l = o = i;
    else {
      const u = i < 0.5 ? i * (1 + r) : i + r - i * r, h = 2 * i - u;
      a = Ne._hue2rgb(h, u, n + 1 / 3), l = Ne._hue2rgb(h, u, n), o = Ne._hue2rgb(h, u, n - 1 / 3);
    }
    return new ae(Math.round(a * 255), Math.round(l * 255), Math.round(o * 255), s);
  }
}
class _t {
  constructor(t, n, r, i) {
    this._hsvaBrand = void 0, this.h = Math.max(Math.min(360, t), 0) | 0, this.s = nt(Math.max(Math.min(1, n), 0), 3), this.v = nt(Math.max(Math.min(1, r), 0), 3), this.a = nt(Math.max(Math.min(1, i), 0), 3);
  }
  static equals(t, n) {
    return t.h === n.h && t.s === n.s && t.v === n.v && t.a === n.a;
  }
  // from http://www.rapidtables.com/convert/color/rgb-to-hsv.htm
  static fromRGBA(t) {
    const n = t.r / 255, r = t.g / 255, i = t.b / 255, s = Math.max(n, r, i), a = Math.min(n, r, i), l = s - a, o = s === 0 ? 0 : l / s;
    let u;
    return l === 0 ? u = 0 : s === n ? u = ((r - i) / l % 6 + 6) % 6 : s === r ? u = (i - n) / l + 2 : u = (n - r) / l + 4, new _t(Math.round(u * 60), o, s, t.a);
  }
  // from http://www.rapidtables.com/convert/color/hsv-to-rgb.htm
  static toRGBA(t) {
    const { h: n, s: r, v: i, a: s } = t, a = i * r, l = a * (1 - Math.abs(n / 60 % 2 - 1)), o = i - a;
    let [u, h, c] = [0, 0, 0];
    return n < 60 ? (u = a, h = l) : n < 120 ? (u = l, h = a) : n < 180 ? (h = a, c = l) : n < 240 ? (h = l, c = a) : n < 300 ? (u = l, c = a) : n <= 360 && (u = a, c = l), u = Math.round((u + o) * 255), h = Math.round((h + o) * 255), c = Math.round((c + o) * 255), new ae(u, h, c, s);
  }
}
var G;
let Pn = (G = class {
  static fromHex(t) {
    return G.Format.CSS.parseHex(t) || G.red;
  }
  static equals(t, n) {
    return !t && !n ? !0 : !t || !n ? !1 : t.equals(n);
  }
  get hsla() {
    return this._hsla ? this._hsla : Ne.fromRGBA(this.rgba);
  }
  get hsva() {
    return this._hsva ? this._hsva : _t.fromRGBA(this.rgba);
  }
  constructor(t) {
    if (t)
      if (t instanceof ae)
        this.rgba = t;
      else if (t instanceof Ne)
        this._hsla = t, this.rgba = Ne.toRGBA(t);
      else if (t instanceof _t)
        this._hsva = t, this.rgba = _t.toRGBA(t);
      else
        throw new Error("Invalid color ctor argument");
    else
      throw new Error("Color needs a value");
  }
  equals(t) {
    return !!t && ae.equals(this.rgba, t.rgba) && Ne.equals(this.hsla, t.hsla) && _t.equals(this.hsva, t.hsva);
  }
  /**
   * http://www.w3.org/TR/WCAG20/#relativeluminancedef
   * Returns the number in the set [0, 1]. O => Darkest Black. 1 => Lightest white.
   */
  getRelativeLuminance() {
    const t = G._relativeLuminanceForComponent(this.rgba.r), n = G._relativeLuminanceForComponent(this.rgba.g), r = G._relativeLuminanceForComponent(this.rgba.b), i = 0.2126 * t + 0.7152 * n + 0.0722 * r;
    return nt(i, 4);
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
    const n = this.getRelativeLuminance(), r = t.getRelativeLuminance();
    return n > r;
  }
  isDarkerThan(t) {
    const n = this.getRelativeLuminance(), r = t.getRelativeLuminance();
    return n < r;
  }
  lighten(t) {
    return new G(new Ne(this.hsla.h, this.hsla.s, this.hsla.l + this.hsla.l * t, this.hsla.a));
  }
  darken(t) {
    return new G(new Ne(this.hsla.h, this.hsla.s, this.hsla.l - this.hsla.l * t, this.hsla.a));
  }
  transparent(t) {
    const { r: n, g: r, b: i, a: s } = this.rgba;
    return new G(new ae(n, r, i, s * t));
  }
  isTransparent() {
    return this.rgba.a === 0;
  }
  isOpaque() {
    return this.rgba.a === 1;
  }
  opposite() {
    return new G(new ae(255 - this.rgba.r, 255 - this.rgba.g, 255 - this.rgba.b, this.rgba.a));
  }
  makeOpaque(t) {
    if (this.isOpaque() || t.rgba.a !== 1)
      return this;
    const { r: n, g: r, b: i, a: s } = this.rgba;
    return new G(new ae(t.rgba.r - s * (t.rgba.r - n), t.rgba.g - s * (t.rgba.g - r), t.rgba.b - s * (t.rgba.b - i), 1));
  }
  toString() {
    return this._toString || (this._toString = G.Format.CSS.format(this)), this._toString;
  }
  static getLighterColor(t, n, r) {
    if (t.isLighterThan(n))
      return t;
    r = r || 0.5;
    const i = t.getRelativeLuminance(), s = n.getRelativeLuminance();
    return r = r * (s - i) / s, t.lighten(r);
  }
  static getDarkerColor(t, n, r) {
    if (t.isDarkerThan(n))
      return t;
    r = r || 0.5;
    const i = t.getRelativeLuminance(), s = n.getRelativeLuminance();
    return r = r * (i - s) / i, t.darken(r);
  }
}, G.white = new G(new ae(255, 255, 255, 1)), G.black = new G(new ae(0, 0, 0, 1)), G.red = new G(new ae(255, 0, 0, 1)), G.blue = new G(new ae(0, 0, 255, 1)), G.green = new G(new ae(0, 255, 0, 1)), G.cyan = new G(new ae(0, 255, 255, 1)), G.lightgrey = new G(new ae(211, 211, 211, 1)), G.transparent = new G(new ae(0, 0, 0, 0)), G);
(function(e) {
  (function(t) {
    (function(n) {
      function r(m) {
        return m.rgba.a === 1 ? `rgb(${m.rgba.r}, ${m.rgba.g}, ${m.rgba.b})` : e.Format.CSS.formatRGBA(m);
      }
      n.formatRGB = r;
      function i(m) {
        return `rgba(${m.rgba.r}, ${m.rgba.g}, ${m.rgba.b}, ${+m.rgba.a.toFixed(2)})`;
      }
      n.formatRGBA = i;
      function s(m) {
        return m.hsla.a === 1 ? `hsl(${m.hsla.h}, ${(m.hsla.s * 100).toFixed(2)}%, ${(m.hsla.l * 100).toFixed(2)}%)` : e.Format.CSS.formatHSLA(m);
      }
      n.formatHSL = s;
      function a(m) {
        return `hsla(${m.hsla.h}, ${(m.hsla.s * 100).toFixed(2)}%, ${(m.hsla.l * 100).toFixed(2)}%, ${m.hsla.a.toFixed(2)})`;
      }
      n.formatHSLA = a;
      function l(m) {
        const g = m.toString(16);
        return g.length !== 2 ? "0" + g : g;
      }
      function o(m) {
        return `#${l(m.rgba.r)}${l(m.rgba.g)}${l(m.rgba.b)}`;
      }
      n.formatHex = o;
      function u(m, g = !1) {
        return g && m.rgba.a === 1 ? e.Format.CSS.formatHex(m) : `#${l(m.rgba.r)}${l(m.rgba.g)}${l(m.rgba.b)}${l(Math.round(m.rgba.a * 255))}`;
      }
      n.formatHexA = u;
      function h(m) {
        return m.isOpaque() ? e.Format.CSS.formatHex(m) : e.Format.CSS.formatRGBA(m);
      }
      n.format = h;
      function c(m) {
        const g = m.length;
        if (g === 0 || m.charCodeAt(0) !== 35)
          return null;
        if (g === 7) {
          const p = 16 * d(m.charCodeAt(1)) + d(m.charCodeAt(2)), x = 16 * d(m.charCodeAt(3)) + d(m.charCodeAt(4)), w = 16 * d(m.charCodeAt(5)) + d(m.charCodeAt(6));
          return new e(new ae(p, x, w, 1));
        }
        if (g === 9) {
          const p = 16 * d(m.charCodeAt(1)) + d(m.charCodeAt(2)), x = 16 * d(m.charCodeAt(3)) + d(m.charCodeAt(4)), w = 16 * d(m.charCodeAt(5)) + d(m.charCodeAt(6)), L = 16 * d(m.charCodeAt(7)) + d(m.charCodeAt(8));
          return new e(new ae(p, x, w, L / 255));
        }
        if (g === 4) {
          const p = d(m.charCodeAt(1)), x = d(m.charCodeAt(2)), w = d(m.charCodeAt(3));
          return new e(new ae(16 * p + p, 16 * x + x, 16 * w + w));
        }
        if (g === 5) {
          const p = d(m.charCodeAt(1)), x = d(m.charCodeAt(2)), w = d(m.charCodeAt(3)), L = d(m.charCodeAt(4));
          return new e(new ae(16 * p + p, 16 * x + x, 16 * w + w, (16 * L + L) / 255));
        }
        return null;
      }
      n.parseHex = c;
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
})(Pn || (Pn = {}));
function Oa(e) {
  const t = [];
  for (const n of e) {
    const r = Number(n);
    (r || r === 0 && n.replace(/\s/g, "") !== "") && t.push(r);
  }
  return t;
}
function ai(e, t, n, r) {
  return {
    red: e / 255,
    blue: n / 255,
    green: t / 255,
    alpha: r
  };
}
function Ut(e, t) {
  const n = t.index, r = t[0].length;
  if (!n)
    return;
  const i = e.positionAt(n);
  return {
    startLineNumber: i.lineNumber,
    startColumn: i.column,
    endLineNumber: i.lineNumber,
    endColumn: i.column + r
  };
}
function Du(e, t) {
  if (!e)
    return;
  const n = Pn.Format.CSS.parseHex(t);
  if (n)
    return {
      range: e,
      color: ai(n.rgba.r, n.rgba.g, n.rgba.b, n.rgba.a)
    };
}
function Ys(e, t, n) {
  if (!e || t.length !== 1)
    return;
  const i = t[0].values(), s = Oa(i);
  return {
    range: e,
    color: ai(s[0], s[1], s[2], n ? s[3] : 1)
  };
}
function Zs(e, t, n) {
  if (!e || t.length !== 1)
    return;
  const i = t[0].values(), s = Oa(i), a = new Pn(new Ne(s[0], s[1] / 100, s[2] / 100, n ? s[3] : 1));
  return {
    range: e,
    color: ai(a.rgba.r, a.rgba.g, a.rgba.b, a.rgba.a)
  };
}
function Bt(e, t) {
  return typeof e == "string" ? [...e.matchAll(t)] : e.findMatches(t);
}
function Ou(e) {
  const t = [], r = Bt(e, /\b(rgb|rgba|hsl|hsla)(\([0-9\s,.\%]*\))|(#)([A-Fa-f0-9]{3})\b|(#)([A-Fa-f0-9]{4})\b|(#)([A-Fa-f0-9]{6})\b|(#)([A-Fa-f0-9]{8})\b/gm);
  if (r.length > 0)
    for (const i of r) {
      const s = i.filter((u) => u !== void 0), a = s[1], l = s[2];
      if (!l)
        continue;
      let o;
      if (a === "rgb") {
        const u = /^\(\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*,\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*,\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*\)$/gm;
        o = Ys(Ut(e, i), Bt(l, u), !1);
      } else if (a === "rgba") {
        const u = /^\(\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*,\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*,\s*(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\s*,\s*(0[.][0-9]+|[.][0-9]+|[01][.]|[01])\s*\)$/gm;
        o = Ys(Ut(e, i), Bt(l, u), !0);
      } else if (a === "hsl") {
        const u = /^\(\s*(36[0]|3[0-5][0-9]|[12][0-9][0-9]|[1-9]?[0-9])\s*,\s*(100|\d{1,2}[.]\d*|\d{1,2})%\s*,\s*(100|\d{1,2}[.]\d*|\d{1,2})%\s*\)$/gm;
        o = Zs(Ut(e, i), Bt(l, u), !1);
      } else if (a === "hsla") {
        const u = /^\(\s*(36[0]|3[0-5][0-9]|[12][0-9][0-9]|[1-9]?[0-9])\s*,\s*(100|\d{1,2}[.]\d*|\d{1,2})%\s*,\s*(100|\d{1,2}[.]\d*|\d{1,2})%\s*,\s*(0[.][0-9]+|[.][0-9]+|[01][.]|[01])\s*\)$/gm;
        o = Zs(Ut(e, i), Bt(l, u), !0);
      } else
        a === "#" && (o = Du(Ut(e, i), a + l));
      o && t.push(o);
    }
  return t;
}
function $u(e) {
  return !e || typeof e.getValue != "function" || typeof e.positionAt != "function" ? [] : Ou(e);
}
const Ks = new RegExp("\\bMARK:\\s*(.*)$", "d"), Uu = /^-+|-+$/g;
function Bu(e, t) {
  var r;
  let n = [];
  if (t.findRegionSectionHeaders && ((r = t.foldingRules) != null && r.markers)) {
    const i = qu(e, t);
    n = n.concat(i);
  }
  if (t.findMarkSectionHeaders) {
    const i = ju(e);
    n = n.concat(i);
  }
  return n;
}
function qu(e, t) {
  const n = [], r = e.getLineCount();
  for (let i = 1; i <= r; i++) {
    const s = e.getLineContent(i), a = s.match(t.foldingRules.markers.start);
    if (a) {
      const l = { startLineNumber: i, startColumn: a[0].length + 1, endLineNumber: i, endColumn: s.length + 1 };
      if (l.endColumn > l.startColumn) {
        const o = {
          range: l,
          ...$a(s.substring(a[0].length)),
          shouldBeInComments: !1
        };
        (o.text || o.hasSeparatorLine) && n.push(o);
      }
    }
  }
  return n;
}
function ju(e) {
  const t = [], n = e.getLineCount();
  for (let r = 1; r <= n; r++) {
    const i = e.getLineContent(r);
    Wu(i, r, t);
  }
  return t;
}
function Wu(e, t, n) {
  Ks.lastIndex = 0;
  const r = Ks.exec(e);
  if (r) {
    const i = r.indices[1][0] + 1, s = r.indices[1][1] + 1, a = { startLineNumber: t, startColumn: i, endLineNumber: t, endColumn: s };
    if (a.endColumn > a.startColumn) {
      const l = {
        range: a,
        ...$a(r[1]),
        shouldBeInComments: !0
      };
      (l.text || l.hasSeparatorLine) && n.push(l);
    }
  }
}
function $a(e) {
  e = e.trim();
  const t = e.startsWith("-");
  return e = e.replace(Uu, ""), { text: e, hasSeparatorLine: t };
}
var e1;
(function(e) {
  async function t(r) {
    let i;
    const s = await Promise.all(r.map((a) => a.then((l) => l, (l) => {
      i || (i = l);
    })));
    if (typeof i < "u")
      throw i;
    return s;
  }
  e.settled = t;
  function n(r) {
    return new Promise(async (i, s) => {
      try {
        await r(i, s);
      } catch (a) {
        s(a);
      }
    });
  }
  e.withAsyncBody = n;
})(e1 || (e1 = {}));
const me = class me {
  static fromArray(t) {
    return new me((n) => {
      n.emitMany(t);
    });
  }
  static fromPromise(t) {
    return new me(async (n) => {
      n.emitMany(await t);
    });
  }
  static fromPromises(t) {
    return new me(async (n) => {
      await Promise.all(t.map(async (r) => n.emitOne(await r)));
    });
  }
  static merge(t) {
    return new me(async (n) => {
      await Promise.all(t.map(async (r) => {
        for await (const i of r)
          n.emitOne(i);
      }));
    });
  }
  constructor(t, n) {
    this._state = 0, this._results = [], this._error = null, this._onReturn = n, this._onStateChanged = new Le(), queueMicrotask(async () => {
      const r = {
        emitOne: (i) => this.emitOne(i),
        emitMany: (i) => this.emitMany(i),
        reject: (i) => this.reject(i)
      };
      try {
        await Promise.resolve(t(r)), this.resolve();
      } catch (i) {
        this.reject(i);
      } finally {
        r.emitOne = void 0, r.emitMany = void 0, r.reject = void 0;
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
          await Ln.toPromise(this._onStateChanged.event);
        } while (!0);
      },
      return: async () => {
        var n;
        return (n = this._onReturn) == null || n.call(this), { done: !0, value: void 0 };
      }
    };
  }
  static map(t, n) {
    return new me(async (r) => {
      for await (const i of t)
        r.emitOne(n(i));
    });
  }
  map(t) {
    return me.map(this, t);
  }
  static filter(t, n) {
    return new me(async (r) => {
      for await (const i of t)
        n(i) && r.emitOne(i);
    });
  }
  filter(t) {
    return me.filter(this, t);
  }
  static coalesce(t) {
    return me.filter(t, (n) => !!n);
  }
  coalesce() {
    return me.coalesce(this);
  }
  static async toPromise(t) {
    const n = [];
    for await (const r of t)
      n.push(r);
    return n;
  }
  toPromise() {
    return me.toPromise(this);
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
me.EMPTY = me.fromArray([]);
let t1 = me;
class Hu {
  constructor(t) {
    this.values = t, this.prefixSum = new Uint32Array(t.length), this.prefixSumValidIndex = new Int32Array(1), this.prefixSumValidIndex[0] = -1;
  }
  insertValues(t, n) {
    t = pt(t);
    const r = this.values, i = this.prefixSum, s = n.length;
    return s === 0 ? !1 : (this.values = new Uint32Array(r.length + s), this.values.set(r.subarray(0, t), 0), this.values.set(r.subarray(t), t + s), this.values.set(n, t), t - 1 < this.prefixSumValidIndex[0] && (this.prefixSumValidIndex[0] = t - 1), this.prefixSum = new Uint32Array(this.values.length), this.prefixSumValidIndex[0] >= 0 && this.prefixSum.set(i.subarray(0, this.prefixSumValidIndex[0] + 1)), !0);
  }
  setValue(t, n) {
    return t = pt(t), n = pt(n), this.values[t] === n ? !1 : (this.values[t] = n, t - 1 < this.prefixSumValidIndex[0] && (this.prefixSumValidIndex[0] = t - 1), !0);
  }
  removeValues(t, n) {
    t = pt(t), n = pt(n);
    const r = this.values, i = this.prefixSum;
    if (t >= r.length)
      return !1;
    const s = r.length - t;
    return n >= s && (n = s), n === 0 ? !1 : (this.values = new Uint32Array(r.length - n), this.values.set(r.subarray(0, t), 0), this.values.set(r.subarray(t + n), t), this.prefixSum = new Uint32Array(this.values.length), t - 1 < this.prefixSumValidIndex[0] && (this.prefixSumValidIndex[0] = t - 1), this.prefixSumValidIndex[0] >= 0 && this.prefixSum.set(i.subarray(0, this.prefixSumValidIndex[0] + 1)), !0);
  }
  getTotalSum() {
    return this.values.length === 0 ? 0 : this._getPrefixSum(this.values.length - 1);
  }
  /**
   * Returns the sum of the first `index + 1` many items.
   * @returns `SUM(0 <= j <= index, values[j])`.
   */
  getPrefixSum(t) {
    return t < 0 ? 0 : (t = pt(t), this._getPrefixSum(t));
  }
  _getPrefixSum(t) {
    if (t <= this.prefixSumValidIndex[0])
      return this.prefixSum[t];
    let n = this.prefixSumValidIndex[0] + 1;
    n === 0 && (this.prefixSum[0] = this.values[0], n++), t >= this.values.length && (t = this.values.length - 1);
    for (let r = n; r <= t; r++)
      this.prefixSum[r] = this.prefixSum[r - 1] + this.values[r];
    return this.prefixSumValidIndex[0] = Math.max(this.prefixSumValidIndex[0], t), this.prefixSum[t];
  }
  getIndexOf(t) {
    t = Math.floor(t), this.getTotalSum();
    let n = 0, r = this.values.length - 1, i = 0, s = 0, a = 0;
    for (; n <= r; )
      if (i = n + (r - n) / 2 | 0, s = this.prefixSum[i], a = s - this.values[i], t < a)
        r = i - 1;
      else if (t >= s)
        n = i + 1;
      else
        break;
    return new zu(i, t - a);
  }
}
class zu {
  constructor(t, n) {
    this.index = t, this.remainder = n, this._prefixSumIndexOfResultBrand = void 0, this.index = t, this.remainder = n;
  }
}
class Gu {
  constructor(t, n, r, i) {
    this._uri = t, this._lines = n, this._eol = r, this._versionId = i, this._lineStarts = null, this._cachedTextValue = null;
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
    for (const r of n)
      this._acceptDeleteRange(r.range), this._acceptInsertText(new ee(r.range.startLineNumber, r.range.startColumn), r.text);
    this._versionId = t.versionId, this._cachedTextValue = null;
  }
  _ensureLineStarts() {
    if (!this._lineStarts) {
      const t = this._eol.length, n = this._lines.length, r = new Uint32Array(n);
      for (let i = 0; i < n; i++)
        r[i] = this._lines[i].length + t;
      this._lineStarts = new Hu(r);
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
    const r = Do(n);
    if (r.length === 1) {
      this._setLineText(t.lineNumber - 1, this._lines[t.lineNumber - 1].substring(0, t.column - 1) + r[0] + this._lines[t.lineNumber - 1].substring(t.column - 1));
      return;
    }
    r[r.length - 1] += this._lines[t.lineNumber - 1].substring(t.column - 1), this._setLineText(t.lineNumber - 1, this._lines[t.lineNumber - 1].substring(0, t.column - 1) + r[0]);
    const i = new Uint32Array(r.length - 1);
    for (let s = 1; s < r.length; s++)
      this._lines.splice(t.lineNumber + s - 1, 0, r[s]), i[s - 1] = r[s].length + this._eol.length;
    this._lineStarts && this._lineStarts.insertValues(t.lineNumber, i);
  }
}
class Ju {
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
    this._models[t.url] = new Xu(Ie.parse(t.url), t.lines, t.EOL, t.versionId);
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
class Xu extends Gu {
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
    for (let r = 0; r < this._lines.length; r++) {
      const i = this._lines[r], s = this.offsetAt(new ee(r + 1, 1)), a = i.matchAll(t);
      for (const l of a)
        (l.index || l.index === 0) && (l.index = l.index + s), n.push(l);
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
    const r = si(t.column, Ia(n), this._lines[t.lineNumber - 1], 0);
    return r ? new z(t.lineNumber, r.startColumn, t.lineNumber, r.endColumn) : null;
  }
  words(t) {
    const n = this._lines, r = this._wordenize.bind(this);
    let i = 0, s = "", a = 0, l = [];
    return {
      *[Symbol.iterator]() {
        for (; ; )
          if (a < l.length) {
            const o = s.substring(l[a].start, l[a].end);
            a += 1, yield o;
          } else if (i < n.length)
            s = n[i], l = r(s, t), a = 0, i += 1;
          else
            break;
      }
    };
  }
  getLineWords(t, n) {
    const r = this._lines[t - 1], i = this._wordenize(r, n), s = [];
    for (const a of i)
      s.push({
        word: r.substring(a.start, a.end),
        startColumn: a.start + 1,
        endColumn: a.end + 1
      });
    return s;
  }
  _wordenize(t, n) {
    const r = [];
    let i;
    for (n.lastIndex = 0; (i = n.exec(t)) && i[0].length !== 0; )
      r.push({ start: i.index, end: i.index + i[0].length });
    return r;
  }
  getValueInRange(t) {
    if (t = this._validateRange(t), t.startLineNumber === t.endLineNumber)
      return this._lines[t.startLineNumber - 1].substring(t.startColumn - 1, t.endColumn - 1);
    const n = this._eol, r = t.startLineNumber - 1, i = t.endLineNumber - 1, s = [];
    s.push(this._lines[r].substring(t.startColumn - 1));
    for (let a = r + 1; a < i; a++)
      s.push(this._lines[a]);
    return s.push(this._lines[i].substring(0, t.endColumn - 1)), s.join(n);
  }
  offsetAt(t) {
    return t = this._validatePosition(t), this._ensureLineStarts(), this._lineStarts.getPrefixSum(t.lineNumber - 2) + (t.column - 1);
  }
  positionAt(t) {
    t = Math.floor(t), t = Math.max(0, t), this._ensureLineStarts();
    const n = this._lineStarts.getIndexOf(t), r = this._lines[n.index].length;
    return {
      lineNumber: 1 + n.index,
      column: 1 + Math.min(n.remainder, r)
    };
  }
  _validateRange(t) {
    const n = this._validatePosition({ lineNumber: t.startLineNumber, column: t.startColumn }), r = this._validatePosition({ lineNumber: t.endLineNumber, column: t.endColumn });
    return n.lineNumber !== t.startLineNumber || n.column !== t.startColumn || r.lineNumber !== t.endLineNumber || r.column !== t.endColumn ? {
      startLineNumber: n.lineNumber,
      startColumn: n.column,
      endLineNumber: r.lineNumber,
      endColumn: r.column
    } : t;
  }
  _validatePosition(t) {
    if (!ee.isIPosition(t))
      throw new Error("bad position");
    let { lineNumber: n, column: r } = t, i = !1;
    if (n < 1)
      n = 1, r = 1, i = !0;
    else if (n > this._lines.length)
      n = this._lines.length, r = this._lines[n - 1].length + 1, i = !0;
    else {
      const s = this._lines[n - 1].length + 1;
      r < 1 ? (r = 1, i = !0) : r > s && (r = s, i = !0);
    }
    return i ? { lineNumber: n, column: r } : t;
  }
}
const zn = class zn {
  constructor() {
    this._workerTextModelSyncServer = new Ju();
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
  async $computeUnicodeHighlights(t, n, r) {
    const i = this._getModel(t);
    return i ? tu.computeUnicodeHighlights(i, n, r) : { ranges: [], hasMore: !1, ambiguousCharacterCount: 0, invisibleCharacterCount: 0, nonBasicAsciiCharacterCount: 0 };
  }
  async $findSectionHeaders(t, n) {
    const r = this._getModel(t);
    return r ? Bu(r, n) : [];
  }
  // ---- BEGIN diff --------------------------------------------------------------------------
  async $computeDiff(t, n, r, i) {
    const s = this._getModel(t), a = this._getModel(n);
    return !s || !a ? null : yn.computeDiff(s, a, r, i);
  }
  static computeDiff(t, n, r, i) {
    const s = i === "advanced" ? Qs.getDefault() : Qs.getLegacy(), a = t.getLinesContent(), l = n.getLinesContent(), o = s.computeDiff(a, l, r), u = o.changes.length > 0 ? !1 : this._modelsAreIdentical(t, n);
    function h(c) {
      return c.map((d) => {
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
      identical: u,
      quitEarly: o.hitTimeout,
      changes: h(o.changes),
      moves: o.moves.map((c) => [
        c.lineRangeMapping.original.startLineNumber,
        c.lineRangeMapping.original.endLineNumberExclusive,
        c.lineRangeMapping.modified.startLineNumber,
        c.lineRangeMapping.modified.endLineNumberExclusive,
        h(c.changes)
      ])
    };
  }
  static _modelsAreIdentical(t, n) {
    const r = t.getLineCount(), i = n.getLineCount();
    if (r !== i)
      return !1;
    for (let s = 1; s <= r; s++) {
      const a = t.getLineContent(s), l = n.getLineContent(s);
      if (a !== l)
        return !1;
    }
    return !0;
  }
  async $computeMoreMinimalEdits(t, n, r) {
    const i = this._getModel(t);
    if (!i)
      return n;
    const s = [];
    let a;
    n = n.slice(0).sort((o, u) => {
      if (o.range && u.range)
        return z.compareRangesUsingStarts(o.range, u.range);
      const h = o.range ? 0 : 1, c = u.range ? 0 : 1;
      return h - c;
    });
    let l = 0;
    for (let o = 1; o < n.length; o++)
      z.getEndPosition(n[l].range).equals(z.getStartPosition(n[o].range)) ? (n[l].range = z.fromPositions(z.getStartPosition(n[l].range), z.getEndPosition(n[o].range)), n[l].text += n[o].text) : (l++, n[l] = n[o]);
    n.length = l + 1;
    for (let { range: o, text: u, eol: h } of n) {
      if (typeof h == "number" && (a = h), z.isEmpty(o) && !u)
        continue;
      const c = i.getValueInRange(o);
      if (u = u.replace(/\r\n|\n|\r/g, i.eol), c === u)
        continue;
      if (Math.max(u.length, c.length) > yn._diffLimit) {
        s.push({ range: o, text: u });
        continue;
      }
      const d = _l(c, u, r), m = i.offsetAt(z.lift(o).getStartPosition());
      for (const g of d) {
        const p = i.positionAt(m + g.originalStart), x = i.positionAt(m + g.originalStart + g.originalLength), w = {
          text: u.substr(g.modifiedStart, g.modifiedLength),
          range: { startLineNumber: p.lineNumber, startColumn: p.column, endLineNumber: x.lineNumber, endColumn: x.column }
        };
        i.getValueInRange(w.range) !== w.text && s.push(w);
      }
    }
    return typeof a == "number" && s.push({ eol: a, text: "", range: { startLineNumber: 0, startColumn: 0, endLineNumber: 0, endColumn: 0 } }), s;
  }
  // ---- END minimal edits ---------------------------------------------------------------
  async $computeLinks(t) {
    const n = this._getModel(t);
    return n ? kl(n) : null;
  }
  // --- BEGIN default document colors -----------------------------------------------------------
  async $computeDefaultDocumentColors(t) {
    const n = this._getModel(t);
    return n ? $u(n) : null;
  }
  async $textualSuggest(t, n, r, i) {
    const s = new Gn(), a = new RegExp(r, i), l = /* @__PURE__ */ new Set();
    e:
      for (const o of t) {
        const u = this._getModel(o);
        if (u) {
          for (const h of u.words(a))
            if (!(h === n || !isNaN(Number(h))) && (l.add(h), l.size > yn._suggestionsLimit))
              break e;
        }
      }
    return { words: Array.from(l), duration: s.elapsed() };
  }
  // ---- END suggest --------------------------------------------------------------------------
  //#region -- word ranges --
  async $computeWordRanges(t, n, r, i) {
    const s = this._getModel(t);
    if (!s)
      return /* @__PURE__ */ Object.create(null);
    const a = new RegExp(r, i), l = /* @__PURE__ */ Object.create(null);
    for (let o = n.startLineNumber; o < n.endLineNumber; o++) {
      const u = s.getLineWords(o, a);
      for (const h of u) {
        if (!isNaN(Number(h.word)))
          continue;
        let c = l[h.word];
        c || (c = [], l[h.word] = c), c.push({
          startLineNumber: o,
          startColumn: h.startColumn,
          endLineNumber: o,
          endColumn: h.endColumn
        });
      }
    }
    return l;
  }
  //#endregion
  async $navigateValueSet(t, n, r, i, s) {
    const a = this._getModel(t);
    if (!a)
      return null;
    const l = new RegExp(i, s);
    n.startColumn === n.endColumn && (n = {
      startLineNumber: n.startLineNumber,
      startColumn: n.startColumn,
      endLineNumber: n.endLineNumber,
      endColumn: n.endColumn + 1
    });
    const o = a.getValueInRange(n), u = a.getWordAtPosition({ lineNumber: n.startLineNumber, column: n.startColumn }, l);
    if (!u)
      return null;
    const h = a.getValueInRange(u);
    return br.INSTANCE.navigateValueSet(n, o, u, h, r);
  }
};
zn._diffLimit = 1e5, zn._suggestionsLimit = 1e4;
let Cr = zn;
class yn extends Cr {
  constructor(t, n) {
    super(), this._host = t, this._foreignModuleFactory = n, this._foreignModule = null;
  }
  async $ping() {
    return "pong";
  }
  // ---- BEGIN foreign module support --------------------------------------------------------------------------
  $loadForeignModule(t, n, r) {
    const a = {
      host: zl(r, (l, o) => this._host.$fhr(l, o)),
      getMirrorModels: () => this._getModels()
    };
    return this._foreignModuleFactory ? (this._foreignModule = this._foreignModuleFactory(a, n), Promise.resolve(Es(this._foreignModule))) : new Promise((l, o) => {
      const u = (h) => {
        this._foreignModule = h.create(a, n), l(Es(this._foreignModule));
      };
      import(`${ka.asBrowserUri(`${t}.js`).toString(!0)}`).then(u).catch(o);
    });
  }
  // foreign method request
  $fmr(t, n) {
    if (!this._foreignModule || typeof this._foreignModule[t] != "function")
      return Promise.reject(new Error("Missing requestHandler or method: " + t));
    try {
      return Promise.resolve(this._foreignModule[t].apply(this._foreignModule, n));
    } catch (r) {
      return Promise.reject(r);
    }
  }
}
typeof importScripts == "function" && (globalThis.monaco = Ol());
let Tr = !1;
function Ua(e) {
  if (Tr)
    return;
  Tr = !0;
  const t = new xl((n) => {
    globalThis.postMessage(n);
  }, (n) => new yn(Sr.getChannel(n), e));
  globalThis.onmessage = (n) => {
    t.onmessage(n.data);
  };
}
globalThis.onmessage = (e) => {
  Tr || Ua(null);
};
/*!-----------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Version: 0.52.0(f6dc0eb8fce67e57f6036f4769d92c1666cdf546)
 * Released under the MIT license
 * https://github.com/microsoft/monaco-editor/blob/main/LICENSE.txt
 *-----------------------------------------------------------------------------*/
function oi(e, t = !1) {
  const n = e.length;
  let r = 0, i = "", s = 0, a = 16, l = 0, o = 0, u = 0, h = 0, c = 0;
  function d(v, y) {
    let b = 0, _ = 0;
    for (; b < v || !y; ) {
      let k = e.charCodeAt(r);
      if (k >= 48 && k <= 57)
        _ = _ * 16 + k - 48;
      else if (k >= 65 && k <= 70)
        _ = _ * 16 + k - 65 + 10;
      else if (k >= 97 && k <= 102)
        _ = _ * 16 + k - 97 + 10;
      else
        break;
      r++, b++;
    }
    return b < v && (_ = -1), _;
  }
  function m(v) {
    r = v, i = "", s = 0, a = 16, c = 0;
  }
  function g() {
    let v = r;
    if (e.charCodeAt(r) === 48)
      r++;
    else
      for (r++; r < e.length && vt(e.charCodeAt(r)); )
        r++;
    if (r < e.length && e.charCodeAt(r) === 46)
      if (r++, r < e.length && vt(e.charCodeAt(r)))
        for (r++; r < e.length && vt(e.charCodeAt(r)); )
          r++;
      else
        return c = 3, e.substring(v, r);
    let y = r;
    if (r < e.length && (e.charCodeAt(r) === 69 || e.charCodeAt(r) === 101))
      if (r++, (r < e.length && e.charCodeAt(r) === 43 || e.charCodeAt(r) === 45) && r++, r < e.length && vt(e.charCodeAt(r))) {
        for (r++; r < e.length && vt(e.charCodeAt(r)); )
          r++;
        y = r;
      } else
        c = 3;
    return e.substring(v, y);
  }
  function p() {
    let v = "", y = r;
    for (; ; ) {
      if (r >= n) {
        v += e.substring(y, r), c = 2;
        break;
      }
      const b = e.charCodeAt(r);
      if (b === 34) {
        v += e.substring(y, r), r++;
        break;
      }
      if (b === 92) {
        if (v += e.substring(y, r), r++, r >= n) {
          c = 2;
          break;
        }
        switch (e.charCodeAt(r++)) {
          case 34:
            v += '"';
            break;
          case 92:
            v += "\\";
            break;
          case 47:
            v += "/";
            break;
          case 98:
            v += "\b";
            break;
          case 102:
            v += "\f";
            break;
          case 110:
            v += `
`;
            break;
          case 114:
            v += "\r";
            break;
          case 116:
            v += "	";
            break;
          case 117:
            const k = d(4, !0);
            k >= 0 ? v += String.fromCharCode(k) : c = 4;
            break;
          default:
            c = 5;
        }
        y = r;
        continue;
      }
      if (b >= 0 && b <= 31)
        if (qt(b)) {
          v += e.substring(y, r), c = 2;
          break;
        } else
          c = 6;
      r++;
    }
    return v;
  }
  function x() {
    if (i = "", c = 0, s = r, o = l, h = u, r >= n)
      return s = n, a = 17;
    let v = e.charCodeAt(r);
    if (rr(v)) {
      do
        r++, i += String.fromCharCode(v), v = e.charCodeAt(r);
      while (rr(v));
      return a = 15;
    }
    if (qt(v))
      return r++, i += String.fromCharCode(v), v === 13 && e.charCodeAt(r) === 10 && (r++, i += `
`), l++, u = r, a = 14;
    switch (v) {
      case 123:
        return r++, a = 1;
      case 125:
        return r++, a = 2;
      case 91:
        return r++, a = 3;
      case 93:
        return r++, a = 4;
      case 58:
        return r++, a = 6;
      case 44:
        return r++, a = 5;
      case 34:
        return r++, i = p(), a = 10;
      case 47:
        const y = r - 1;
        if (e.charCodeAt(r + 1) === 47) {
          for (r += 2; r < n && !qt(e.charCodeAt(r)); )
            r++;
          return i = e.substring(y, r), a = 12;
        }
        if (e.charCodeAt(r + 1) === 42) {
          r += 2;
          const b = n - 1;
          let _ = !1;
          for (; r < b; ) {
            const k = e.charCodeAt(r);
            if (k === 42 && e.charCodeAt(r + 1) === 47) {
              r += 2, _ = !0;
              break;
            }
            r++, qt(k) && (k === 13 && e.charCodeAt(r) === 10 && r++, l++, u = r);
          }
          return _ || (r++, c = 1), i = e.substring(y, r), a = 13;
        }
        return i += String.fromCharCode(v), r++, a = 16;
      case 45:
        if (i += String.fromCharCode(v), r++, r === n || !vt(e.charCodeAt(r)))
          return a = 16;
      case 48:
      case 49:
      case 50:
      case 51:
      case 52:
      case 53:
      case 54:
      case 55:
      case 56:
      case 57:
        return i += g(), a = 11;
      default:
        for (; r < n && w(v); )
          r++, v = e.charCodeAt(r);
        if (s !== r) {
          switch (i = e.substring(s, r), i) {
            case "true":
              return a = 8;
            case "false":
              return a = 9;
            case "null":
              return a = 7;
          }
          return a = 16;
        }
        return i += String.fromCharCode(v), r++, a = 16;
    }
  }
  function w(v) {
    if (rr(v) || qt(v))
      return !1;
    switch (v) {
      case 125:
      case 93:
      case 123:
      case 91:
      case 34:
      case 58:
      case 44:
      case 47:
        return !1;
    }
    return !0;
  }
  function L() {
    let v;
    do
      v = x();
    while (v >= 12 && v <= 15);
    return v;
  }
  return {
    setPosition: m,
    getPosition: () => r,
    scan: t ? L : x,
    getToken: () => a,
    getTokenValue: () => i,
    getTokenOffset: () => s,
    getTokenLength: () => r - s,
    getTokenStartLine: () => o,
    getTokenStartCharacter: () => s - h,
    getTokenError: () => c
  };
}
function rr(e) {
  return e === 32 || e === 9;
}
function qt(e) {
  return e === 10 || e === 13;
}
function vt(e) {
  return e >= 48 && e <= 57;
}
var n1;
(function(e) {
  e[e.lineFeed = 10] = "lineFeed", e[e.carriageReturn = 13] = "carriageReturn", e[e.space = 32] = "space", e[e._0 = 48] = "_0", e[e._1 = 49] = "_1", e[e._2 = 50] = "_2", e[e._3 = 51] = "_3", e[e._4 = 52] = "_4", e[e._5 = 53] = "_5", e[e._6 = 54] = "_6", e[e._7 = 55] = "_7", e[e._8 = 56] = "_8", e[e._9 = 57] = "_9", e[e.a = 97] = "a", e[e.b = 98] = "b", e[e.c = 99] = "c", e[e.d = 100] = "d", e[e.e = 101] = "e", e[e.f = 102] = "f", e[e.g = 103] = "g", e[e.h = 104] = "h", e[e.i = 105] = "i", e[e.j = 106] = "j", e[e.k = 107] = "k", e[e.l = 108] = "l", e[e.m = 109] = "m", e[e.n = 110] = "n", e[e.o = 111] = "o", e[e.p = 112] = "p", e[e.q = 113] = "q", e[e.r = 114] = "r", e[e.s = 115] = "s", e[e.t = 116] = "t", e[e.u = 117] = "u", e[e.v = 118] = "v", e[e.w = 119] = "w", e[e.x = 120] = "x", e[e.y = 121] = "y", e[e.z = 122] = "z", e[e.A = 65] = "A", e[e.B = 66] = "B", e[e.C = 67] = "C", e[e.D = 68] = "D", e[e.E = 69] = "E", e[e.F = 70] = "F", e[e.G = 71] = "G", e[e.H = 72] = "H", e[e.I = 73] = "I", e[e.J = 74] = "J", e[e.K = 75] = "K", e[e.L = 76] = "L", e[e.M = 77] = "M", e[e.N = 78] = "N", e[e.O = 79] = "O", e[e.P = 80] = "P", e[e.Q = 81] = "Q", e[e.R = 82] = "R", e[e.S = 83] = "S", e[e.T = 84] = "T", e[e.U = 85] = "U", e[e.V = 86] = "V", e[e.W = 87] = "W", e[e.X = 88] = "X", e[e.Y = 89] = "Y", e[e.Z = 90] = "Z", e[e.asterisk = 42] = "asterisk", e[e.backslash = 92] = "backslash", e[e.closeBrace = 125] = "closeBrace", e[e.closeBracket = 93] = "closeBracket", e[e.colon = 58] = "colon", e[e.comma = 44] = "comma", e[e.dot = 46] = "dot", e[e.doubleQuote = 34] = "doubleQuote", e[e.minus = 45] = "minus", e[e.openBrace = 123] = "openBrace", e[e.openBracket = 91] = "openBracket", e[e.plus = 43] = "plus", e[e.slash = 47] = "slash", e[e.formFeed = 12] = "formFeed", e[e.tab = 9] = "tab";
})(n1 || (n1 = {}));
var _e = new Array(20).fill(0).map((e, t) => " ".repeat(t)), xt = 200, r1 = {
  " ": {
    "\n": new Array(xt).fill(0).map((e, t) => `
` + " ".repeat(t)),
    "\r": new Array(xt).fill(0).map((e, t) => "\r" + " ".repeat(t)),
    "\r\n": new Array(xt).fill(0).map((e, t) => `\r
` + " ".repeat(t))
  },
  "	": {
    "\n": new Array(xt).fill(0).map((e, t) => `
` + "	".repeat(t)),
    "\r": new Array(xt).fill(0).map((e, t) => "\r" + "	".repeat(t)),
    "\r\n": new Array(xt).fill(0).map((e, t) => `\r
` + "	".repeat(t))
  }
}, Qu = [`
`, "\r", `\r
`];
function Yu(e, t, n) {
  let r, i, s, a, l;
  if (t) {
    for (a = t.offset, l = a + t.length, s = a; s > 0 && !i1(e, s - 1); )
      s--;
    let b = l;
    for (; b < e.length && !i1(e, b); )
      b++;
    i = e.substring(s, b), r = Zu(i, n);
  } else
    i = e, r = 0, s = 0, a = 0, l = e.length;
  const o = Ku(n, e), u = Qu.includes(o);
  let h = 0, c = 0, d;
  n.insertSpaces ? d = _e[n.tabSize || 4] ?? yt(_e[1], n.tabSize || 4) : d = "	";
  const m = d === "	" ? "	" : " ";
  let g = oi(i, !1), p = !1;
  function x() {
    if (h > 1)
      return yt(o, h) + yt(d, r + c);
    const b = d.length * (r + c);
    return !u || b > r1[m][o].length ? o + yt(d, r + c) : b <= 0 ? o : r1[m][o][b];
  }
  function w() {
    let b = g.scan();
    for (h = 0; b === 15 || b === 14; )
      b === 14 && n.keepLines ? h += 1 : b === 14 && (h = 1), b = g.scan();
    return p = b === 16 || g.getTokenError() !== 0, b;
  }
  const L = [];
  function v(b, _, k) {
    !p && (!t || _ < l && k > a) && e.substring(_, k) !== b && L.push({ offset: _, length: k - _, content: b });
  }
  let y = w();
  if (n.keepLines && h > 0 && v(yt(o, h), 0, 0), y !== 17) {
    let b = g.getTokenOffset() + s, _ = d.length * r < 20 && n.insertSpaces ? _e[d.length * r] : yt(d, r);
    v(_, s, b);
  }
  for (; y !== 17; ) {
    let b = g.getTokenOffset() + g.getTokenLength() + s, _ = w(), k = "", C = !1;
    for (; h === 0 && (_ === 12 || _ === 13); ) {
      let O = g.getTokenOffset() + s;
      v(_e[1], b, O), b = g.getTokenOffset() + g.getTokenLength() + s, C = _ === 12, k = C ? x() : "", _ = w();
    }
    if (_ === 2)
      y !== 1 && c--, n.keepLines && h > 0 || !n.keepLines && y !== 1 ? k = x() : n.keepLines && (k = _e[1]);
    else if (_ === 4)
      y !== 3 && c--, n.keepLines && h > 0 || !n.keepLines && y !== 3 ? k = x() : n.keepLines && (k = _e[1]);
    else {
      switch (y) {
        case 3:
        case 1:
          c++, n.keepLines && h > 0 || !n.keepLines ? k = x() : k = _e[1];
          break;
        case 5:
          n.keepLines && h > 0 || !n.keepLines ? k = x() : k = _e[1];
          break;
        case 12:
          k = x();
          break;
        case 13:
          h > 0 ? k = x() : C || (k = _e[1]);
          break;
        case 6:
          n.keepLines && h > 0 ? k = x() : C || (k = _e[1]);
          break;
        case 10:
          n.keepLines && h > 0 ? k = x() : _ === 6 && !C && (k = "");
          break;
        case 7:
        case 8:
        case 9:
        case 11:
        case 2:
        case 4:
          n.keepLines && h > 0 ? k = x() : (_ === 12 || _ === 13) && !C ? k = _e[1] : _ !== 5 && _ !== 17 && (p = !0);
          break;
        case 16:
          p = !0;
          break;
      }
      h > 0 && (_ === 12 || _ === 13) && (k = x());
    }
    _ === 17 && (n.keepLines && h > 0 ? k = x() : k = n.insertFinalNewline ? o : "");
    const F = g.getTokenOffset() + s;
    v(k, b, F), y = _;
  }
  return L;
}
function yt(e, t) {
  let n = "";
  for (let r = 0; r < t; r++)
    n += e;
  return n;
}
function Zu(e, t) {
  let n = 0, r = 0;
  const i = t.tabSize || 4;
  for (; n < e.length; ) {
    let s = e.charAt(n);
    if (s === _e[1])
      r++;
    else if (s === "	")
      r += i;
    else
      break;
    n++;
  }
  return Math.floor(r / i);
}
function Ku(e, t) {
  for (let n = 0; n < t.length; n++) {
    const r = t.charAt(n);
    if (r === "\r")
      return n + 1 < t.length && t.charAt(n + 1) === `
` ? `\r
` : "\r";
    if (r === `
`)
      return `
`;
  }
  return e && e.eol || `
`;
}
function i1(e, t) {
  return `\r
`.indexOf(e.charAt(t)) !== -1;
}
var In;
(function(e) {
  e.DEFAULT = {
    allowTrailingComma: !1
  };
})(In || (In = {}));
function ec(e, t = [], n = In.DEFAULT) {
  let r = null, i = [];
  const s = [];
  function a(o) {
    Array.isArray(i) ? i.push(o) : r !== null && (i[r] = o);
  }
  return nc(e, {
    onObjectBegin: () => {
      const o = {};
      a(o), s.push(i), i = o, r = null;
    },
    onObjectProperty: (o) => {
      r = o;
    },
    onObjectEnd: () => {
      i = s.pop();
    },
    onArrayBegin: () => {
      const o = [];
      a(o), s.push(i), i = o, r = null;
    },
    onArrayEnd: () => {
      i = s.pop();
    },
    onLiteralValue: a,
    onError: (o, u, h) => {
      t.push({ error: o, offset: u, length: h });
    }
  }, n), i[0];
}
function Ba(e) {
  if (!e.parent || !e.parent.children)
    return [];
  const t = Ba(e.parent);
  if (e.parent.type === "property") {
    const n = e.parent.children[0].value;
    t.push(n);
  } else if (e.parent.type === "array") {
    const n = e.parent.children.indexOf(e);
    n !== -1 && t.push(n);
  }
  return t;
}
function Pr(e) {
  switch (e.type) {
    case "array":
      return e.children.map(Pr);
    case "object":
      const t = /* @__PURE__ */ Object.create(null);
      for (let n of e.children) {
        const r = n.children[1];
        r && (t[n.children[0].value] = Pr(r));
      }
      return t;
    case "null":
    case "string":
    case "number":
    case "boolean":
      return e.value;
    default:
      return;
  }
}
function tc(e, t, n = !1) {
  return t >= e.offset && t < e.offset + e.length || n && t === e.offset + e.length;
}
function qa(e, t, n = !1) {
  if (tc(e, t, n)) {
    const r = e.children;
    if (Array.isArray(r))
      for (let i = 0; i < r.length && r[i].offset <= t; i++) {
        const s = qa(r[i], t, n);
        if (s)
          return s;
      }
    return e;
  }
}
function nc(e, t, n = In.DEFAULT) {
  const r = oi(e, !1), i = [];
  function s(N) {
    return N ? () => N(r.getTokenOffset(), r.getTokenLength(), r.getTokenStartLine(), r.getTokenStartCharacter()) : () => !0;
  }
  function a(N) {
    return N ? () => N(r.getTokenOffset(), r.getTokenLength(), r.getTokenStartLine(), r.getTokenStartCharacter(), () => i.slice()) : () => !0;
  }
  function l(N) {
    return N ? (S) => N(S, r.getTokenOffset(), r.getTokenLength(), r.getTokenStartLine(), r.getTokenStartCharacter()) : () => !0;
  }
  function o(N) {
    return N ? (S) => N(S, r.getTokenOffset(), r.getTokenLength(), r.getTokenStartLine(), r.getTokenStartCharacter(), () => i.slice()) : () => !0;
  }
  const u = a(t.onObjectBegin), h = o(t.onObjectProperty), c = s(t.onObjectEnd), d = a(t.onArrayBegin), m = s(t.onArrayEnd), g = o(t.onLiteralValue), p = l(t.onSeparator), x = s(t.onComment), w = l(t.onError), L = n && n.disallowComments, v = n && n.allowTrailingComma;
  function y() {
    for (; ; ) {
      const N = r.scan();
      switch (r.getTokenError()) {
        case 4:
          b(
            14
            /* ParseErrorCode.InvalidUnicode */
          );
          break;
        case 5:
          b(
            15
            /* ParseErrorCode.InvalidEscapeCharacter */
          );
          break;
        case 3:
          b(
            13
            /* ParseErrorCode.UnexpectedEndOfNumber */
          );
          break;
        case 1:
          L || b(
            11
            /* ParseErrorCode.UnexpectedEndOfComment */
          );
          break;
        case 2:
          b(
            12
            /* ParseErrorCode.UnexpectedEndOfString */
          );
          break;
        case 6:
          b(
            16
            /* ParseErrorCode.InvalidCharacter */
          );
          break;
      }
      switch (N) {
        case 12:
        case 13:
          L ? b(
            10
            /* ParseErrorCode.InvalidCommentToken */
          ) : x();
          break;
        case 16:
          b(
            1
            /* ParseErrorCode.InvalidSymbol */
          );
          break;
        case 15:
        case 14:
          break;
        default:
          return N;
      }
    }
  }
  function b(N, S = [], R = []) {
    if (w(N), S.length + R.length > 0) {
      let I = r.getToken();
      for (; I !== 17; ) {
        if (S.indexOf(I) !== -1) {
          y();
          break;
        } else if (R.indexOf(I) !== -1)
          break;
        I = y();
      }
    }
  }
  function _(N) {
    const S = r.getTokenValue();
    return N ? g(S) : (h(S), i.push(S)), y(), !0;
  }
  function k() {
    switch (r.getToken()) {
      case 11:
        const N = r.getTokenValue();
        let S = Number(N);
        isNaN(S) && (b(
          2
          /* ParseErrorCode.InvalidNumberFormat */
        ), S = 0), g(S);
        break;
      case 7:
        g(null);
        break;
      case 8:
        g(!0);
        break;
      case 9:
        g(!1);
        break;
      default:
        return !1;
    }
    return y(), !0;
  }
  function C() {
    return r.getToken() !== 10 ? (b(3, [], [
      2,
      5
      /* SyntaxKind.CommaToken */
    ]), !1) : (_(!1), r.getToken() === 6 ? (p(":"), y(), M() || b(4, [], [
      2,
      5
      /* SyntaxKind.CommaToken */
    ])) : b(5, [], [
      2,
      5
      /* SyntaxKind.CommaToken */
    ]), i.pop(), !0);
  }
  function F() {
    u(), y();
    let N = !1;
    for (; r.getToken() !== 2 && r.getToken() !== 17; ) {
      if (r.getToken() === 5) {
        if (N || b(4, [], []), p(","), y(), r.getToken() === 2 && v)
          break;
      } else
        N && b(6, [], []);
      C() || b(4, [], [
        2,
        5
        /* SyntaxKind.CommaToken */
      ]), N = !0;
    }
    return c(), r.getToken() !== 2 ? b(7, [
      2
      /* SyntaxKind.CloseBraceToken */
    ], []) : y(), !0;
  }
  function O() {
    d(), y();
    let N = !0, S = !1;
    for (; r.getToken() !== 4 && r.getToken() !== 17; ) {
      if (r.getToken() === 5) {
        if (S || b(4, [], []), p(","), y(), r.getToken() === 4 && v)
          break;
      } else
        S && b(6, [], []);
      N ? (i.push(0), N = !1) : i[i.length - 1]++, M() || b(4, [], [
        4,
        5
        /* SyntaxKind.CommaToken */
      ]), S = !0;
    }
    return m(), N || i.pop(), r.getToken() !== 4 ? b(8, [
      4
      /* SyntaxKind.CloseBracketToken */
    ], []) : y(), !0;
  }
  function M() {
    switch (r.getToken()) {
      case 3:
        return O();
      case 1:
        return F();
      case 10:
        return _(!0);
      default:
        return k();
    }
  }
  return y(), r.getToken() === 17 ? n.allowEmptyContent ? !0 : (b(4, [], []), !1) : M() ? (r.getToken() !== 17 && b(9, [], []), !0) : (b(4, [], []), !1);
}
var lt = oi, s1;
(function(e) {
  e[e.None = 0] = "None", e[e.UnexpectedEndOfComment = 1] = "UnexpectedEndOfComment", e[e.UnexpectedEndOfString = 2] = "UnexpectedEndOfString", e[e.UnexpectedEndOfNumber = 3] = "UnexpectedEndOfNumber", e[e.InvalidUnicode = 4] = "InvalidUnicode", e[e.InvalidEscapeCharacter = 5] = "InvalidEscapeCharacter", e[e.InvalidCharacter = 6] = "InvalidCharacter";
})(s1 || (s1 = {}));
var a1;
(function(e) {
  e[e.OpenBraceToken = 1] = "OpenBraceToken", e[e.CloseBraceToken = 2] = "CloseBraceToken", e[e.OpenBracketToken = 3] = "OpenBracketToken", e[e.CloseBracketToken = 4] = "CloseBracketToken", e[e.CommaToken = 5] = "CommaToken", e[e.ColonToken = 6] = "ColonToken", e[e.NullKeyword = 7] = "NullKeyword", e[e.TrueKeyword = 8] = "TrueKeyword", e[e.FalseKeyword = 9] = "FalseKeyword", e[e.StringLiteral = 10] = "StringLiteral", e[e.NumericLiteral = 11] = "NumericLiteral", e[e.LineCommentTrivia = 12] = "LineCommentTrivia", e[e.BlockCommentTrivia = 13] = "BlockCommentTrivia", e[e.LineBreakTrivia = 14] = "LineBreakTrivia", e[e.Trivia = 15] = "Trivia", e[e.Unknown = 16] = "Unknown", e[e.EOF = 17] = "EOF";
})(a1 || (a1 = {}));
var rc = ec, ic = qa, sc = Ba, ac = Pr, o1;
(function(e) {
  e[e.InvalidSymbol = 1] = "InvalidSymbol", e[e.InvalidNumberFormat = 2] = "InvalidNumberFormat", e[e.PropertyNameExpected = 3] = "PropertyNameExpected", e[e.ValueExpected = 4] = "ValueExpected", e[e.ColonExpected = 5] = "ColonExpected", e[e.CommaExpected = 6] = "CommaExpected", e[e.CloseBraceExpected = 7] = "CloseBraceExpected", e[e.CloseBracketExpected = 8] = "CloseBracketExpected", e[e.EndOfFileExpected = 9] = "EndOfFileExpected", e[e.InvalidCommentToken = 10] = "InvalidCommentToken", e[e.UnexpectedEndOfComment = 11] = "UnexpectedEndOfComment", e[e.UnexpectedEndOfString = 12] = "UnexpectedEndOfString", e[e.UnexpectedEndOfNumber = 13] = "UnexpectedEndOfNumber", e[e.InvalidUnicode = 14] = "InvalidUnicode", e[e.InvalidEscapeCharacter = 15] = "InvalidEscapeCharacter", e[e.InvalidCharacter = 16] = "InvalidCharacter";
})(o1 || (o1 = {}));
function oc(e, t, n) {
  return Yu(e, t, n);
}
function Mt(e, t) {
  if (e === t)
    return !0;
  if (e == null || t === null || t === void 0 || typeof e != typeof t || typeof e != "object" || Array.isArray(e) !== Array.isArray(t))
    return !1;
  let n, r;
  if (Array.isArray(e)) {
    if (e.length !== t.length)
      return !1;
    for (n = 0; n < e.length; n++)
      if (!Mt(e[n], t[n]))
        return !1;
  } else {
    const i = [];
    for (r in e)
      i.push(r);
    i.sort();
    const s = [];
    for (r in t)
      s.push(r);
    if (s.sort(), !Mt(i, s))
      return !1;
    for (n = 0; n < i.length; n++)
      if (!Mt(e[i[n]], t[i[n]]))
        return !1;
  }
  return !0;
}
function ce(e) {
  return typeof e == "number";
}
function ke(e) {
  return typeof e < "u";
}
function Ve(e) {
  return typeof e == "boolean";
}
function ja(e) {
  return typeof e == "string";
}
function Ye(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function lc(e, t) {
  if (e.length < t.length)
    return !1;
  for (let n = 0; n < t.length; n++)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function rn(e, t) {
  const n = e.length - t.length;
  return n > 0 ? e.lastIndexOf(t) === n : n === 0 ? e === t : !1;
}
function Fn(e) {
  let t = "";
  lc(e, "(?i)") && (e = e.substring(4), t = "i");
  try {
    return new RegExp(e, t + "u");
  } catch {
    try {
      return new RegExp(e, t);
    } catch {
      return;
    }
  }
}
function l1(e) {
  let t = 0;
  for (let n = 0; n < e.length; n++) {
    t++;
    const r = e.charCodeAt(n);
    55296 <= r && r <= 56319 && n++;
  }
  return t;
}
var u1;
(function(e) {
  function t(n) {
    return typeof n == "string";
  }
  e.is = t;
})(u1 || (u1 = {}));
var Ir;
(function(e) {
  function t(n) {
    return typeof n == "string";
  }
  e.is = t;
})(Ir || (Ir = {}));
var c1;
(function(e) {
  e.MIN_VALUE = -2147483648, e.MAX_VALUE = 2147483647;
  function t(n) {
    return typeof n == "number" && e.MIN_VALUE <= n && n <= e.MAX_VALUE;
  }
  e.is = t;
})(c1 || (c1 = {}));
var Vn;
(function(e) {
  e.MIN_VALUE = 0, e.MAX_VALUE = 2147483647;
  function t(n) {
    return typeof n == "number" && e.MIN_VALUE <= n && n <= e.MAX_VALUE;
  }
  e.is = t;
})(Vn || (Vn = {}));
var Z;
(function(e) {
  function t(r, i) {
    return r === Number.MAX_VALUE && (r = Vn.MAX_VALUE), i === Number.MAX_VALUE && (i = Vn.MAX_VALUE), { line: r, character: i };
  }
  e.create = t;
  function n(r) {
    let i = r;
    return A.objectLiteral(i) && A.uinteger(i.line) && A.uinteger(i.character);
  }
  e.is = n;
})(Z || (Z = {}));
var q;
(function(e) {
  function t(r, i, s, a) {
    if (A.uinteger(r) && A.uinteger(i) && A.uinteger(s) && A.uinteger(a))
      return { start: Z.create(r, i), end: Z.create(s, a) };
    if (Z.is(r) && Z.is(i))
      return { start: r, end: i };
    throw new Error(`Range#create called with invalid arguments[${r}, ${i}, ${s}, ${a}]`);
  }
  e.create = t;
  function n(r) {
    let i = r;
    return A.objectLiteral(i) && Z.is(i.start) && Z.is(i.end);
  }
  e.is = n;
})(q || (q = {}));
var It;
(function(e) {
  function t(r, i) {
    return { uri: r, range: i };
  }
  e.create = t;
  function n(r) {
    let i = r;
    return A.objectLiteral(i) && q.is(i.range) && (A.string(i.uri) || A.undefined(i.uri));
  }
  e.is = n;
})(It || (It = {}));
var f1;
(function(e) {
  function t(r, i, s, a) {
    return { targetUri: r, targetRange: i, targetSelectionRange: s, originSelectionRange: a };
  }
  e.create = t;
  function n(r) {
    let i = r;
    return A.objectLiteral(i) && q.is(i.targetRange) && A.string(i.targetUri) && q.is(i.targetSelectionRange) && (q.is(i.originSelectionRange) || A.undefined(i.originSelectionRange));
  }
  e.is = n;
})(f1 || (f1 = {}));
var Fr;
(function(e) {
  function t(r, i, s, a) {
    return {
      red: r,
      green: i,
      blue: s,
      alpha: a
    };
  }
  e.create = t;
  function n(r) {
    const i = r;
    return A.objectLiteral(i) && A.numberRange(i.red, 0, 1) && A.numberRange(i.green, 0, 1) && A.numberRange(i.blue, 0, 1) && A.numberRange(i.alpha, 0, 1);
  }
  e.is = n;
})(Fr || (Fr = {}));
var h1;
(function(e) {
  function t(r, i) {
    return {
      range: r,
      color: i
    };
  }
  e.create = t;
  function n(r) {
    const i = r;
    return A.objectLiteral(i) && q.is(i.range) && Fr.is(i.color);
  }
  e.is = n;
})(h1 || (h1 = {}));
var d1;
(function(e) {
  function t(r, i, s) {
    return {
      label: r,
      textEdit: i,
      additionalTextEdits: s
    };
  }
  e.create = t;
  function n(r) {
    const i = r;
    return A.objectLiteral(i) && A.string(i.label) && (A.undefined(i.textEdit) || Oe.is(i)) && (A.undefined(i.additionalTextEdits) || A.typedArray(i.additionalTextEdits, Oe.is));
  }
  e.is = n;
})(d1 || (d1 = {}));
var Jt;
(function(e) {
  e.Comment = "comment", e.Imports = "imports", e.Region = "region";
})(Jt || (Jt = {}));
var m1;
(function(e) {
  function t(r, i, s, a, l, o) {
    const u = {
      startLine: r,
      endLine: i
    };
    return A.defined(s) && (u.startCharacter = s), A.defined(a) && (u.endCharacter = a), A.defined(l) && (u.kind = l), A.defined(o) && (u.collapsedText = o), u;
  }
  e.create = t;
  function n(r) {
    const i = r;
    return A.objectLiteral(i) && A.uinteger(i.startLine) && A.uinteger(i.startLine) && (A.undefined(i.startCharacter) || A.uinteger(i.startCharacter)) && (A.undefined(i.endCharacter) || A.uinteger(i.endCharacter)) && (A.undefined(i.kind) || A.string(i.kind));
  }
  e.is = n;
})(m1 || (m1 = {}));
var Vr;
(function(e) {
  function t(r, i) {
    return {
      location: r,
      message: i
    };
  }
  e.create = t;
  function n(r) {
    let i = r;
    return A.defined(i) && It.is(i.location) && A.string(i.message);
  }
  e.is = n;
})(Vr || (Vr = {}));
var ye;
(function(e) {
  e.Error = 1, e.Warning = 2, e.Information = 3, e.Hint = 4;
})(ye || (ye = {}));
var g1;
(function(e) {
  e.Unnecessary = 1, e.Deprecated = 2;
})(g1 || (g1 = {}));
var p1;
(function(e) {
  function t(n) {
    const r = n;
    return A.objectLiteral(r) && A.string(r.href);
  }
  e.is = t;
})(p1 || (p1 = {}));
var je;
(function(e) {
  function t(r, i, s, a, l, o) {
    let u = { range: r, message: i };
    return A.defined(s) && (u.severity = s), A.defined(a) && (u.code = a), A.defined(l) && (u.source = l), A.defined(o) && (u.relatedInformation = o), u;
  }
  e.create = t;
  function n(r) {
    var i;
    let s = r;
    return A.defined(s) && q.is(s.range) && A.string(s.message) && (A.number(s.severity) || A.undefined(s.severity)) && (A.integer(s.code) || A.string(s.code) || A.undefined(s.code)) && (A.undefined(s.codeDescription) || A.string((i = s.codeDescription) === null || i === void 0 ? void 0 : i.href)) && (A.string(s.source) || A.undefined(s.source)) && (A.undefined(s.relatedInformation) || A.typedArray(s.relatedInformation, Vr.is));
  }
  e.is = n;
})(je || (je = {}));
var Ft;
(function(e) {
  function t(r, i, ...s) {
    let a = { title: r, command: i };
    return A.defined(s) && s.length > 0 && (a.arguments = s), a;
  }
  e.create = t;
  function n(r) {
    let i = r;
    return A.defined(i) && A.string(i.title) && A.string(i.command);
  }
  e.is = n;
})(Ft || (Ft = {}));
var Oe;
(function(e) {
  function t(s, a) {
    return { range: s, newText: a };
  }
  e.replace = t;
  function n(s, a) {
    return { range: { start: s, end: s }, newText: a };
  }
  e.insert = n;
  function r(s) {
    return { range: s, newText: "" };
  }
  e.del = r;
  function i(s) {
    const a = s;
    return A.objectLiteral(a) && A.string(a.newText) && q.is(a.range);
  }
  e.is = i;
})(Oe || (Oe = {}));
var Dr;
(function(e) {
  function t(r, i, s) {
    const a = { label: r };
    return i !== void 0 && (a.needsConfirmation = i), s !== void 0 && (a.description = s), a;
  }
  e.create = t;
  function n(r) {
    const i = r;
    return A.objectLiteral(i) && A.string(i.label) && (A.boolean(i.needsConfirmation) || i.needsConfirmation === void 0) && (A.string(i.description) || i.description === void 0);
  }
  e.is = n;
})(Dr || (Dr = {}));
var Vt;
(function(e) {
  function t(n) {
    const r = n;
    return A.string(r);
  }
  e.is = t;
})(Vt || (Vt = {}));
var b1;
(function(e) {
  function t(s, a, l) {
    return { range: s, newText: a, annotationId: l };
  }
  e.replace = t;
  function n(s, a, l) {
    return { range: { start: s, end: s }, newText: a, annotationId: l };
  }
  e.insert = n;
  function r(s, a) {
    return { range: s, newText: "", annotationId: a };
  }
  e.del = r;
  function i(s) {
    const a = s;
    return Oe.is(a) && (Dr.is(a.annotationId) || Vt.is(a.annotationId));
  }
  e.is = i;
})(b1 || (b1 = {}));
var Or;
(function(e) {
  function t(r, i) {
    return { textDocument: r, edits: i };
  }
  e.create = t;
  function n(r) {
    let i = r;
    return A.defined(i) && jr.is(i.textDocument) && Array.isArray(i.edits);
  }
  e.is = n;
})(Or || (Or = {}));
var $r;
(function(e) {
  function t(r, i, s) {
    let a = {
      kind: "create",
      uri: r
    };
    return i !== void 0 && (i.overwrite !== void 0 || i.ignoreIfExists !== void 0) && (a.options = i), s !== void 0 && (a.annotationId = s), a;
  }
  e.create = t;
  function n(r) {
    let i = r;
    return i && i.kind === "create" && A.string(i.uri) && (i.options === void 0 || (i.options.overwrite === void 0 || A.boolean(i.options.overwrite)) && (i.options.ignoreIfExists === void 0 || A.boolean(i.options.ignoreIfExists))) && (i.annotationId === void 0 || Vt.is(i.annotationId));
  }
  e.is = n;
})($r || ($r = {}));
var Ur;
(function(e) {
  function t(r, i, s, a) {
    let l = {
      kind: "rename",
      oldUri: r,
      newUri: i
    };
    return s !== void 0 && (s.overwrite !== void 0 || s.ignoreIfExists !== void 0) && (l.options = s), a !== void 0 && (l.annotationId = a), l;
  }
  e.create = t;
  function n(r) {
    let i = r;
    return i && i.kind === "rename" && A.string(i.oldUri) && A.string(i.newUri) && (i.options === void 0 || (i.options.overwrite === void 0 || A.boolean(i.options.overwrite)) && (i.options.ignoreIfExists === void 0 || A.boolean(i.options.ignoreIfExists))) && (i.annotationId === void 0 || Vt.is(i.annotationId));
  }
  e.is = n;
})(Ur || (Ur = {}));
var Br;
(function(e) {
  function t(r, i, s) {
    let a = {
      kind: "delete",
      uri: r
    };
    return i !== void 0 && (i.recursive !== void 0 || i.ignoreIfNotExists !== void 0) && (a.options = i), s !== void 0 && (a.annotationId = s), a;
  }
  e.create = t;
  function n(r) {
    let i = r;
    return i && i.kind === "delete" && A.string(i.uri) && (i.options === void 0 || (i.options.recursive === void 0 || A.boolean(i.options.recursive)) && (i.options.ignoreIfNotExists === void 0 || A.boolean(i.options.ignoreIfNotExists))) && (i.annotationId === void 0 || Vt.is(i.annotationId));
  }
  e.is = n;
})(Br || (Br = {}));
var qr;
(function(e) {
  function t(n) {
    let r = n;
    return r && (r.changes !== void 0 || r.documentChanges !== void 0) && (r.documentChanges === void 0 || r.documentChanges.every((i) => A.string(i.kind) ? $r.is(i) || Ur.is(i) || Br.is(i) : Or.is(i)));
  }
  e.is = t;
})(qr || (qr = {}));
var v1;
(function(e) {
  function t(r) {
    return { uri: r };
  }
  e.create = t;
  function n(r) {
    let i = r;
    return A.defined(i) && A.string(i.uri);
  }
  e.is = n;
})(v1 || (v1 = {}));
var x1;
(function(e) {
  function t(r, i) {
    return { uri: r, version: i };
  }
  e.create = t;
  function n(r) {
    let i = r;
    return A.defined(i) && A.string(i.uri) && A.integer(i.version);
  }
  e.is = n;
})(x1 || (x1 = {}));
var jr;
(function(e) {
  function t(r, i) {
    return { uri: r, version: i };
  }
  e.create = t;
  function n(r) {
    let i = r;
    return A.defined(i) && A.string(i.uri) && (i.version === null || A.integer(i.version));
  }
  e.is = n;
})(jr || (jr = {}));
var y1;
(function(e) {
  function t(r, i, s, a) {
    return { uri: r, languageId: i, version: s, text: a };
  }
  e.create = t;
  function n(r) {
    let i = r;
    return A.defined(i) && A.string(i.uri) && A.string(i.languageId) && A.integer(i.version) && A.string(i.text);
  }
  e.is = n;
})(y1 || (y1 = {}));
var ct;
(function(e) {
  e.PlainText = "plaintext", e.Markdown = "markdown";
  function t(n) {
    const r = n;
    return r === e.PlainText || r === e.Markdown;
  }
  e.is = t;
})(ct || (ct = {}));
var sn;
(function(e) {
  function t(n) {
    const r = n;
    return A.objectLiteral(n) && ct.is(r.kind) && A.string(r.value);
  }
  e.is = t;
})(sn || (sn = {}));
var xe;
(function(e) {
  e.Text = 1, e.Method = 2, e.Function = 3, e.Constructor = 4, e.Field = 5, e.Variable = 6, e.Class = 7, e.Interface = 8, e.Module = 9, e.Property = 10, e.Unit = 11, e.Value = 12, e.Enum = 13, e.Keyword = 14, e.Snippet = 15, e.Color = 16, e.File = 17, e.Reference = 18, e.Folder = 19, e.EnumMember = 20, e.Constant = 21, e.Struct = 22, e.Event = 23, e.Operator = 24, e.TypeParameter = 25;
})(xe || (xe = {}));
var ie;
(function(e) {
  e.PlainText = 1, e.Snippet = 2;
})(ie || (ie = {}));
var w1;
(function(e) {
  e.Deprecated = 1;
})(w1 || (w1 = {}));
var _1;
(function(e) {
  function t(r, i, s) {
    return { newText: r, insert: i, replace: s };
  }
  e.create = t;
  function n(r) {
    const i = r;
    return i && A.string(i.newText) && q.is(i.insert) && q.is(i.replace);
  }
  e.is = n;
})(_1 || (_1 = {}));
var L1;
(function(e) {
  e.asIs = 1, e.adjustIndentation = 2;
})(L1 || (L1 = {}));
var N1;
(function(e) {
  function t(n) {
    const r = n;
    return r && (A.string(r.detail) || r.detail === void 0) && (A.string(r.description) || r.description === void 0);
  }
  e.is = t;
})(N1 || (N1 = {}));
var Wr;
(function(e) {
  function t(n) {
    return { label: n };
  }
  e.create = t;
})(Wr || (Wr = {}));
var S1;
(function(e) {
  function t(n, r) {
    return { items: n || [], isIncomplete: !!r };
  }
  e.create = t;
})(S1 || (S1 = {}));
var Dn;
(function(e) {
  function t(r) {
    return r.replace(/[\\`*_{}[\]()#+\-.!]/g, "\\$&");
  }
  e.fromPlainText = t;
  function n(r) {
    const i = r;
    return A.string(i) || A.objectLiteral(i) && A.string(i.language) && A.string(i.value);
  }
  e.is = n;
})(Dn || (Dn = {}));
var A1;
(function(e) {
  function t(n) {
    let r = n;
    return !!r && A.objectLiteral(r) && (sn.is(r.contents) || Dn.is(r.contents) || A.typedArray(r.contents, Dn.is)) && (n.range === void 0 || q.is(n.range));
  }
  e.is = t;
})(A1 || (A1 = {}));
var k1;
(function(e) {
  function t(n, r) {
    return r ? { label: n, documentation: r } : { label: n };
  }
  e.create = t;
})(k1 || (k1 = {}));
var R1;
(function(e) {
  function t(n, r, ...i) {
    let s = { label: n };
    return A.defined(r) && (s.documentation = r), A.defined(i) ? s.parameters = i : s.parameters = [], s;
  }
  e.create = t;
})(R1 || (R1 = {}));
var E1;
(function(e) {
  e.Text = 1, e.Read = 2, e.Write = 3;
})(E1 || (E1 = {}));
var M1;
(function(e) {
  function t(n, r) {
    let i = { range: n };
    return A.number(r) && (i.kind = r), i;
  }
  e.create = t;
})(M1 || (M1 = {}));
var Te;
(function(e) {
  e.File = 1, e.Module = 2, e.Namespace = 3, e.Package = 4, e.Class = 5, e.Method = 6, e.Property = 7, e.Field = 8, e.Constructor = 9, e.Enum = 10, e.Interface = 11, e.Function = 12, e.Variable = 13, e.Constant = 14, e.String = 15, e.Number = 16, e.Boolean = 17, e.Array = 18, e.Object = 19, e.Key = 20, e.Null = 21, e.EnumMember = 22, e.Struct = 23, e.Event = 24, e.Operator = 25, e.TypeParameter = 26;
})(Te || (Te = {}));
var C1;
(function(e) {
  e.Deprecated = 1;
})(C1 || (C1 = {}));
var T1;
(function(e) {
  function t(n, r, i, s, a) {
    let l = {
      name: n,
      kind: r,
      location: { uri: s, range: i }
    };
    return a && (l.containerName = a), l;
  }
  e.create = t;
})(T1 || (T1 = {}));
var P1;
(function(e) {
  function t(n, r, i, s) {
    return s !== void 0 ? { name: n, kind: r, location: { uri: i, range: s } } : { name: n, kind: r, location: { uri: i } };
  }
  e.create = t;
})(P1 || (P1 = {}));
var I1;
(function(e) {
  function t(r, i, s, a, l, o) {
    let u = {
      name: r,
      detail: i,
      kind: s,
      range: a,
      selectionRange: l
    };
    return o !== void 0 && (u.children = o), u;
  }
  e.create = t;
  function n(r) {
    let i = r;
    return i && A.string(i.name) && A.number(i.kind) && q.is(i.range) && q.is(i.selectionRange) && (i.detail === void 0 || A.string(i.detail)) && (i.deprecated === void 0 || A.boolean(i.deprecated)) && (i.children === void 0 || Array.isArray(i.children)) && (i.tags === void 0 || Array.isArray(i.tags));
  }
  e.is = n;
})(I1 || (I1 = {}));
var F1;
(function(e) {
  e.Empty = "", e.QuickFix = "quickfix", e.Refactor = "refactor", e.RefactorExtract = "refactor.extract", e.RefactorInline = "refactor.inline", e.RefactorRewrite = "refactor.rewrite", e.Source = "source", e.SourceOrganizeImports = "source.organizeImports", e.SourceFixAll = "source.fixAll";
})(F1 || (F1 = {}));
var On;
(function(e) {
  e.Invoked = 1, e.Automatic = 2;
})(On || (On = {}));
var V1;
(function(e) {
  function t(r, i, s) {
    let a = { diagnostics: r };
    return i != null && (a.only = i), s != null && (a.triggerKind = s), a;
  }
  e.create = t;
  function n(r) {
    let i = r;
    return A.defined(i) && A.typedArray(i.diagnostics, je.is) && (i.only === void 0 || A.typedArray(i.only, A.string)) && (i.triggerKind === void 0 || i.triggerKind === On.Invoked || i.triggerKind === On.Automatic);
  }
  e.is = n;
})(V1 || (V1 = {}));
var D1;
(function(e) {
  function t(r, i, s) {
    let a = { title: r }, l = !0;
    return typeof i == "string" ? (l = !1, a.kind = i) : Ft.is(i) ? a.command = i : a.edit = i, l && s !== void 0 && (a.kind = s), a;
  }
  e.create = t;
  function n(r) {
    let i = r;
    return i && A.string(i.title) && (i.diagnostics === void 0 || A.typedArray(i.diagnostics, je.is)) && (i.kind === void 0 || A.string(i.kind)) && (i.edit !== void 0 || i.command !== void 0) && (i.command === void 0 || Ft.is(i.command)) && (i.isPreferred === void 0 || A.boolean(i.isPreferred)) && (i.edit === void 0 || qr.is(i.edit));
  }
  e.is = n;
})(D1 || (D1 = {}));
var O1;
(function(e) {
  function t(r, i) {
    let s = { range: r };
    return A.defined(i) && (s.data = i), s;
  }
  e.create = t;
  function n(r) {
    let i = r;
    return A.defined(i) && q.is(i.range) && (A.undefined(i.command) || Ft.is(i.command));
  }
  e.is = n;
})(O1 || (O1 = {}));
var $1;
(function(e) {
  function t(r, i) {
    return { tabSize: r, insertSpaces: i };
  }
  e.create = t;
  function n(r) {
    let i = r;
    return A.defined(i) && A.uinteger(i.tabSize) && A.boolean(i.insertSpaces);
  }
  e.is = n;
})($1 || ($1 = {}));
var U1;
(function(e) {
  function t(r, i, s) {
    return { range: r, target: i, data: s };
  }
  e.create = t;
  function n(r) {
    let i = r;
    return A.defined(i) && q.is(i.range) && (A.undefined(i.target) || A.string(i.target));
  }
  e.is = n;
})(U1 || (U1 = {}));
var $n;
(function(e) {
  function t(r, i) {
    return { range: r, parent: i };
  }
  e.create = t;
  function n(r) {
    let i = r;
    return A.objectLiteral(i) && q.is(i.range) && (i.parent === void 0 || e.is(i.parent));
  }
  e.is = n;
})($n || ($n = {}));
var B1;
(function(e) {
  e.namespace = "namespace", e.type = "type", e.class = "class", e.enum = "enum", e.interface = "interface", e.struct = "struct", e.typeParameter = "typeParameter", e.parameter = "parameter", e.variable = "variable", e.property = "property", e.enumMember = "enumMember", e.event = "event", e.function = "function", e.method = "method", e.macro = "macro", e.keyword = "keyword", e.modifier = "modifier", e.comment = "comment", e.string = "string", e.number = "number", e.regexp = "regexp", e.operator = "operator", e.decorator = "decorator";
})(B1 || (B1 = {}));
var q1;
(function(e) {
  e.declaration = "declaration", e.definition = "definition", e.readonly = "readonly", e.static = "static", e.deprecated = "deprecated", e.abstract = "abstract", e.async = "async", e.modification = "modification", e.documentation = "documentation", e.defaultLibrary = "defaultLibrary";
})(q1 || (q1 = {}));
var j1;
(function(e) {
  function t(n) {
    const r = n;
    return A.objectLiteral(r) && (r.resultId === void 0 || typeof r.resultId == "string") && Array.isArray(r.data) && (r.data.length === 0 || typeof r.data[0] == "number");
  }
  e.is = t;
})(j1 || (j1 = {}));
var W1;
(function(e) {
  function t(r, i) {
    return { range: r, text: i };
  }
  e.create = t;
  function n(r) {
    const i = r;
    return i != null && q.is(i.range) && A.string(i.text);
  }
  e.is = n;
})(W1 || (W1 = {}));
var H1;
(function(e) {
  function t(r, i, s) {
    return { range: r, variableName: i, caseSensitiveLookup: s };
  }
  e.create = t;
  function n(r) {
    const i = r;
    return i != null && q.is(i.range) && A.boolean(i.caseSensitiveLookup) && (A.string(i.variableName) || i.variableName === void 0);
  }
  e.is = n;
})(H1 || (H1 = {}));
var z1;
(function(e) {
  function t(r, i) {
    return { range: r, expression: i };
  }
  e.create = t;
  function n(r) {
    const i = r;
    return i != null && q.is(i.range) && (A.string(i.expression) || i.expression === void 0);
  }
  e.is = n;
})(z1 || (z1 = {}));
var G1;
(function(e) {
  function t(r, i) {
    return { frameId: r, stoppedLocation: i };
  }
  e.create = t;
  function n(r) {
    const i = r;
    return A.defined(i) && q.is(r.stoppedLocation);
  }
  e.is = n;
})(G1 || (G1 = {}));
var Hr;
(function(e) {
  e.Type = 1, e.Parameter = 2;
  function t(n) {
    return n === 1 || n === 2;
  }
  e.is = t;
})(Hr || (Hr = {}));
var zr;
(function(e) {
  function t(r) {
    return { value: r };
  }
  e.create = t;
  function n(r) {
    const i = r;
    return A.objectLiteral(i) && (i.tooltip === void 0 || A.string(i.tooltip) || sn.is(i.tooltip)) && (i.location === void 0 || It.is(i.location)) && (i.command === void 0 || Ft.is(i.command));
  }
  e.is = n;
})(zr || (zr = {}));
var J1;
(function(e) {
  function t(r, i, s) {
    const a = { position: r, label: i };
    return s !== void 0 && (a.kind = s), a;
  }
  e.create = t;
  function n(r) {
    const i = r;
    return A.objectLiteral(i) && Z.is(i.position) && (A.string(i.label) || A.typedArray(i.label, zr.is)) && (i.kind === void 0 || Hr.is(i.kind)) && i.textEdits === void 0 || A.typedArray(i.textEdits, Oe.is) && (i.tooltip === void 0 || A.string(i.tooltip) || sn.is(i.tooltip)) && (i.paddingLeft === void 0 || A.boolean(i.paddingLeft)) && (i.paddingRight === void 0 || A.boolean(i.paddingRight));
  }
  e.is = n;
})(J1 || (J1 = {}));
var X1;
(function(e) {
  function t(n) {
    return { kind: "snippet", value: n };
  }
  e.createSnippet = t;
})(X1 || (X1 = {}));
var Q1;
(function(e) {
  function t(n, r, i, s) {
    return { insertText: n, filterText: r, range: i, command: s };
  }
  e.create = t;
})(Q1 || (Q1 = {}));
var Y1;
(function(e) {
  function t(n) {
    return { items: n };
  }
  e.create = t;
})(Y1 || (Y1 = {}));
var Z1;
(function(e) {
  e.Invoked = 0, e.Automatic = 1;
})(Z1 || (Z1 = {}));
var K1;
(function(e) {
  function t(n, r) {
    return { range: n, text: r };
  }
  e.create = t;
})(K1 || (K1 = {}));
var ea;
(function(e) {
  function t(n, r) {
    return { triggerKind: n, selectedCompletionInfo: r };
  }
  e.create = t;
})(ea || (ea = {}));
var ta;
(function(e) {
  function t(n) {
    const r = n;
    return A.objectLiteral(r) && Ir.is(r.uri) && A.string(r.name);
  }
  e.is = t;
})(ta || (ta = {}));
var na;
(function(e) {
  function t(s, a, l, o) {
    return new uc(s, a, l, o);
  }
  e.create = t;
  function n(s) {
    let a = s;
    return !!(A.defined(a) && A.string(a.uri) && (A.undefined(a.languageId) || A.string(a.languageId)) && A.uinteger(a.lineCount) && A.func(a.getText) && A.func(a.positionAt) && A.func(a.offsetAt));
  }
  e.is = n;
  function r(s, a) {
    let l = s.getText(), o = i(a, (h, c) => {
      let d = h.range.start.line - c.range.start.line;
      return d === 0 ? h.range.start.character - c.range.start.character : d;
    }), u = l.length;
    for (let h = o.length - 1; h >= 0; h--) {
      let c = o[h], d = s.offsetAt(c.range.start), m = s.offsetAt(c.range.end);
      if (m <= u)
        l = l.substring(0, d) + c.newText + l.substring(m, l.length);
      else
        throw new Error("Overlapping edit");
      u = d;
    }
    return l;
  }
  e.applyEdits = r;
  function i(s, a) {
    if (s.length <= 1)
      return s;
    const l = s.length / 2 | 0, o = s.slice(0, l), u = s.slice(l);
    i(o, a), i(u, a);
    let h = 0, c = 0, d = 0;
    for (; h < o.length && c < u.length; )
      a(o[h], u[c]) <= 0 ? s[d++] = o[h++] : s[d++] = u[c++];
    for (; h < o.length; )
      s[d++] = o[h++];
    for (; c < u.length; )
      s[d++] = u[c++];
    return s;
  }
})(na || (na = {}));
var uc = class {
  constructor(e, t, n, r) {
    this._uri = e, this._languageId = t, this._version = n, this._content = r, this._lineOffsets = void 0;
  }
  get uri() {
    return this._uri;
  }
  get languageId() {
    return this._languageId;
  }
  get version() {
    return this._version;
  }
  getText(e) {
    if (e) {
      let t = this.offsetAt(e.start), n = this.offsetAt(e.end);
      return this._content.substring(t, n);
    }
    return this._content;
  }
  update(e, t) {
    this._content = e.text, this._version = t, this._lineOffsets = void 0;
  }
  getLineOffsets() {
    if (this._lineOffsets === void 0) {
      let e = [], t = this._content, n = !0;
      for (let r = 0; r < t.length; r++) {
        n && (e.push(r), n = !1);
        let i = t.charAt(r);
        n = i === "\r" || i === `
`, i === "\r" && r + 1 < t.length && t.charAt(r + 1) === `
` && r++;
      }
      n && t.length > 0 && e.push(t.length), this._lineOffsets = e;
    }
    return this._lineOffsets;
  }
  positionAt(e) {
    e = Math.max(Math.min(e, this._content.length), 0);
    let t = this.getLineOffsets(), n = 0, r = t.length;
    if (r === 0)
      return Z.create(0, e);
    for (; n < r; ) {
      let s = Math.floor((n + r) / 2);
      t[s] > e ? r = s : n = s + 1;
    }
    let i = n - 1;
    return Z.create(i, e - t[i]);
  }
  offsetAt(e) {
    let t = this.getLineOffsets();
    if (e.line >= t.length)
      return this._content.length;
    if (e.line < 0)
      return 0;
    let n = t[e.line], r = e.line + 1 < t.length ? t[e.line + 1] : this._content.length;
    return Math.max(Math.min(n + e.character, r), n);
  }
  get lineCount() {
    return this.getLineOffsets().length;
  }
}, A;
(function(e) {
  const t = Object.prototype.toString;
  function n(m) {
    return typeof m < "u";
  }
  e.defined = n;
  function r(m) {
    return typeof m > "u";
  }
  e.undefined = r;
  function i(m) {
    return m === !0 || m === !1;
  }
  e.boolean = i;
  function s(m) {
    return t.call(m) === "[object String]";
  }
  e.string = s;
  function a(m) {
    return t.call(m) === "[object Number]";
  }
  e.number = a;
  function l(m, g, p) {
    return t.call(m) === "[object Number]" && g <= m && m <= p;
  }
  e.numberRange = l;
  function o(m) {
    return t.call(m) === "[object Number]" && -2147483648 <= m && m <= 2147483647;
  }
  e.integer = o;
  function u(m) {
    return t.call(m) === "[object Number]" && 0 <= m && m <= 2147483647;
  }
  e.uinteger = u;
  function h(m) {
    return t.call(m) === "[object Function]";
  }
  e.func = h;
  function c(m) {
    return m !== null && typeof m == "object";
  }
  e.objectLiteral = c;
  function d(m, g) {
    return Array.isArray(m) && m.every(g);
  }
  e.typedArray = d;
})(A || (A = {}));
var ra = class Gr {
  constructor(t, n, r, i) {
    this._uri = t, this._languageId = n, this._version = r, this._content = i, this._lineOffsets = void 0;
  }
  get uri() {
    return this._uri;
  }
  get languageId() {
    return this._languageId;
  }
  get version() {
    return this._version;
  }
  getText(t) {
    if (t) {
      const n = this.offsetAt(t.start), r = this.offsetAt(t.end);
      return this._content.substring(n, r);
    }
    return this._content;
  }
  update(t, n) {
    for (let r of t)
      if (Gr.isIncremental(r)) {
        const i = Wa(r.range), s = this.offsetAt(i.start), a = this.offsetAt(i.end);
        this._content = this._content.substring(0, s) + r.text + this._content.substring(a, this._content.length);
        const l = Math.max(i.start.line, 0), o = Math.max(i.end.line, 0);
        let u = this._lineOffsets;
        const h = ia(r.text, !1, s);
        if (o - l === h.length)
          for (let d = 0, m = h.length; d < m; d++)
            u[d + l + 1] = h[d];
        else
          h.length < 1e4 ? u.splice(l + 1, o - l, ...h) : this._lineOffsets = u = u.slice(0, l + 1).concat(h, u.slice(o + 1));
        const c = r.text.length - (a - s);
        if (c !== 0)
          for (let d = l + 1 + h.length, m = u.length; d < m; d++)
            u[d] = u[d] + c;
      } else if (Gr.isFull(r))
        this._content = r.text, this._lineOffsets = void 0;
      else
        throw new Error("Unknown change event received");
    this._version = n;
  }
  getLineOffsets() {
    return this._lineOffsets === void 0 && (this._lineOffsets = ia(this._content, !0)), this._lineOffsets;
  }
  positionAt(t) {
    t = Math.max(Math.min(t, this._content.length), 0);
    let n = this.getLineOffsets(), r = 0, i = n.length;
    if (i === 0)
      return { line: 0, character: t };
    for (; r < i; ) {
      let a = Math.floor((r + i) / 2);
      n[a] > t ? i = a : r = a + 1;
    }
    let s = r - 1;
    return { line: s, character: t - n[s] };
  }
  offsetAt(t) {
    let n = this.getLineOffsets();
    if (t.line >= n.length)
      return this._content.length;
    if (t.line < 0)
      return 0;
    let r = n[t.line], i = t.line + 1 < n.length ? n[t.line + 1] : this._content.length;
    return Math.max(Math.min(r + t.character, i), r);
  }
  get lineCount() {
    return this.getLineOffsets().length;
  }
  static isIncremental(t) {
    let n = t;
    return n != null && typeof n.text == "string" && n.range !== void 0 && (n.rangeLength === void 0 || typeof n.rangeLength == "number");
  }
  static isFull(t) {
    let n = t;
    return n != null && typeof n.text == "string" && n.range === void 0 && n.rangeLength === void 0;
  }
}, Ce;
(function(e) {
  function t(i, s, a, l) {
    return new ra(i, s, a, l);
  }
  e.create = t;
  function n(i, s, a) {
    if (i instanceof ra)
      return i.update(s, a), i;
    throw new Error("TextDocument.update: document must be created by TextDocument.create");
  }
  e.update = n;
  function r(i, s) {
    let a = i.getText(), l = Jr(s.map(cc), (h, c) => {
      let d = h.range.start.line - c.range.start.line;
      return d === 0 ? h.range.start.character - c.range.start.character : d;
    }), o = 0;
    const u = [];
    for (const h of l) {
      let c = i.offsetAt(h.range.start);
      if (c < o)
        throw new Error("Overlapping edit");
      c > o && u.push(a.substring(o, c)), h.newText.length && u.push(h.newText), o = i.offsetAt(h.range.end);
    }
    return u.push(a.substr(o)), u.join("");
  }
  e.applyEdits = r;
})(Ce || (Ce = {}));
function Jr(e, t) {
  if (e.length <= 1)
    return e;
  const n = e.length / 2 | 0, r = e.slice(0, n), i = e.slice(n);
  Jr(r, t), Jr(i, t);
  let s = 0, a = 0, l = 0;
  for (; s < r.length && a < i.length; )
    t(r[s], i[a]) <= 0 ? e[l++] = r[s++] : e[l++] = i[a++];
  for (; s < r.length; )
    e[l++] = r[s++];
  for (; a < i.length; )
    e[l++] = i[a++];
  return e;
}
function ia(e, t, n = 0) {
  const r = t ? [n] : [];
  for (let i = 0; i < e.length; i++) {
    let s = e.charCodeAt(i);
    (s === 13 || s === 10) && (s === 13 && i + 1 < e.length && e.charCodeAt(i + 1) === 10 && i++, r.push(n + i + 1));
  }
  return r;
}
function Wa(e) {
  const t = e.start, n = e.end;
  return t.line > n.line || t.line === n.line && t.character > n.character ? { start: n, end: t } : e;
}
function cc(e) {
  const t = Wa(e.range);
  return t !== e.range ? { newText: e.newText, range: t } : e;
}
var H;
(function(e) {
  e[e.Undefined = 0] = "Undefined", e[e.EnumValueMismatch = 1] = "EnumValueMismatch", e[e.Deprecated = 2] = "Deprecated", e[e.UnexpectedEndOfComment = 257] = "UnexpectedEndOfComment", e[e.UnexpectedEndOfString = 258] = "UnexpectedEndOfString", e[e.UnexpectedEndOfNumber = 259] = "UnexpectedEndOfNumber", e[e.InvalidUnicode = 260] = "InvalidUnicode", e[e.InvalidEscapeCharacter = 261] = "InvalidEscapeCharacter", e[e.InvalidCharacter = 262] = "InvalidCharacter", e[e.PropertyExpected = 513] = "PropertyExpected", e[e.CommaExpected = 514] = "CommaExpected", e[e.ColonExpected = 515] = "ColonExpected", e[e.ValueExpected = 516] = "ValueExpected", e[e.CommaOrCloseBacketExpected = 517] = "CommaOrCloseBacketExpected", e[e.CommaOrCloseBraceExpected = 518] = "CommaOrCloseBraceExpected", e[e.TrailingComma = 519] = "TrailingComma", e[e.DuplicateKey = 520] = "DuplicateKey", e[e.CommentNotPermitted = 521] = "CommentNotPermitted", e[e.PropertyKeysMustBeDoublequoted = 528] = "PropertyKeysMustBeDoublequoted", e[e.SchemaResolveError = 768] = "SchemaResolveError", e[e.SchemaUnsupportedFeature = 769] = "SchemaUnsupportedFeature";
})(H || (H = {}));
var Me;
(function(e) {
  e[e.v3 = 3] = "v3", e[e.v4 = 4] = "v4", e[e.v6 = 6] = "v6", e[e.v7 = 7] = "v7", e[e.v2019_09 = 19] = "v2019_09", e[e.v2020_12 = 20] = "v2020_12";
})(Me || (Me = {}));
var Xr;
(function(e) {
  e.LATEST = {
    textDocument: {
      completion: {
        completionItem: {
          documentationFormat: [ct.Markdown, ct.PlainText],
          commitCharactersSupport: !0,
          labelDetailsSupport: !0
        }
      }
    }
  };
})(Xr || (Xr = {}));
function E(...e) {
  const t = e[0];
  let n, r, i;
  if (typeof t == "string")
    n = t, r = t, e.splice(0, 1), i = !e || typeof e[0] != "object" ? e : e[0];
  else if (t instanceof Array) {
    const s = e.slice(1);
    if (t.length !== s.length + 1)
      throw new Error("expected a string as the first argument to l10n.t");
    let a = t[0];
    for (let l = 1; l < t.length; l++)
      a += `{${l - 1}}` + t[l];
    return E(a, ...s);
  } else
    r = t.message, n = r, t.comment && t.comment.length > 0 && (n += `/${Array.isArray(t.comment) ? t.comment.join("") : t.comment}`), i = t.args ?? {};
  return hc(r, i);
}
var fc = /{([^}]+)}/g;
function hc(e, t) {
  return Object.keys(t).length === 0 ? e : e.replace(fc, (n, r) => t[r] ?? n);
}
var dc = {
  "color-hex": { errorMessage: E("Invalid color format. Use #RGB, #RGBA, #RRGGBB or #RRGGBBAA."), pattern: /^#([0-9A-Fa-f]{3,4}|([0-9A-Fa-f]{2}){3,4})$/ },
  "date-time": { errorMessage: E("String is not a RFC3339 date-time."), pattern: /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9]|60)(\.[0-9]+)?(Z|(\+|-)([01][0-9]|2[0-3]):([0-5][0-9]))$/i },
  date: { errorMessage: E("String is not a RFC3339 date."), pattern: /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/i },
  time: { errorMessage: E("String is not a RFC3339 time."), pattern: /^([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9]|60)(\.[0-9]+)?(Z|(\+|-)([01][0-9]|2[0-3]):([0-5][0-9]))$/i },
  email: { errorMessage: E("String is not an e-mail address."), pattern: /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}))$/ },
  hostname: { errorMessage: E("String is not a hostname."), pattern: /^(?=.{1,253}\.?$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[-0-9a-z]{0,61}[0-9a-z])?)*\.?$/i },
  ipv4: { errorMessage: E("String is not an IPv4 address."), pattern: /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/ },
  ipv6: { errorMessage: E("String is not an IPv6 address."), pattern: /^((([0-9a-f]{1,4}:){7}([0-9a-f]{1,4}|:))|(([0-9a-f]{1,4}:){6}(:[0-9a-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){5}(((:[0-9a-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){4}(((:[0-9a-f]{1,4}){1,3})|((:[0-9a-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){3}(((:[0-9a-f]{1,4}){1,4})|((:[0-9a-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){2}(((:[0-9a-f]{1,4}){1,5})|((:[0-9a-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){1}(((:[0-9a-f]{1,4}){1,6})|((:[0-9a-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9a-f]{1,4}){1,7})|((:[0-9a-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))$/i }
}, ft = class {
  constructor(e, t, n = 0) {
    this.offset = t, this.length = n, this.parent = e;
  }
  get children() {
    return [];
  }
  toString() {
    return "type: " + this.type + " (" + this.offset + "/" + this.length + ")" + (this.parent ? " parent: {" + this.parent.toString() + "}" : "");
  }
}, mc = class extends ft {
  constructor(e, t) {
    super(e, t), this.type = "null", this.value = null;
  }
}, sa = class extends ft {
  constructor(e, t, n) {
    super(e, n), this.type = "boolean", this.value = t;
  }
}, gc = class extends ft {
  constructor(e, t) {
    super(e, t), this.type = "array", this.items = [];
  }
  get children() {
    return this.items;
  }
}, pc = class extends ft {
  constructor(e, t) {
    super(e, t), this.type = "number", this.isInteger = !0, this.value = Number.NaN;
  }
}, ir = class extends ft {
  constructor(e, t, n) {
    super(e, t, n), this.type = "string", this.value = "";
  }
}, bc = class extends ft {
  constructor(e, t, n) {
    super(e, t), this.type = "property", this.colonOffset = -1, this.keyNode = n;
  }
  get children() {
    return this.valueNode ? [this.keyNode, this.valueNode] : [this.keyNode];
  }
}, vc = class extends ft {
  constructor(e, t) {
    super(e, t), this.type = "object", this.properties = [];
  }
  get children() {
    return this.properties;
  }
};
function be(e) {
  return Ve(e) ? e ? {} : { not: {} } : e;
}
var aa;
(function(e) {
  e[e.Key = 0] = "Key", e[e.Enum = 1] = "Enum";
})(aa || (aa = {}));
var xc = {
  "http://json-schema.org/draft-03/schema#": Me.v3,
  "http://json-schema.org/draft-04/schema#": Me.v4,
  "http://json-schema.org/draft-06/schema#": Me.v6,
  "http://json-schema.org/draft-07/schema#": Me.v7,
  "https://json-schema.org/draft/2019-09/schema": Me.v2019_09,
  "https://json-schema.org/draft/2020-12/schema": Me.v2020_12
}, oa = class {
  constructor(e) {
    this.schemaDraft = e;
  }
}, yc = class Ha {
  constructor(t = -1, n) {
    this.focusOffset = t, this.exclude = n, this.schemas = [];
  }
  add(t) {
    this.schemas.push(t);
  }
  merge(t) {
    Array.prototype.push.apply(this.schemas, t.schemas);
  }
  include(t) {
    return (this.focusOffset === -1 || za(t, this.focusOffset)) && t !== this.exclude;
  }
  newSub() {
    return new Ha(-1, this.exclude);
  }
}, an = class {
  constructor() {
  }
  get schemas() {
    return [];
  }
  add(e) {
  }
  merge(e) {
  }
  include(e) {
    return !0;
  }
  newSub() {
    return this;
  }
};
an.instance = new an();
var fe = class {
  constructor() {
    this.problems = [], this.propertiesMatches = 0, this.processedProperties = /* @__PURE__ */ new Set(), this.propertiesValueMatches = 0, this.primaryValueMatches = 0, this.enumValueMatch = !1, this.enumValues = void 0;
  }
  hasProblems() {
    return !!this.problems.length;
  }
  merge(e) {
    this.problems = this.problems.concat(e.problems), this.propertiesMatches += e.propertiesMatches, this.propertiesValueMatches += e.propertiesValueMatches, this.mergeProcessedProperties(e);
  }
  mergeEnumValues(e) {
    if (!this.enumValueMatch && !e.enumValueMatch && this.enumValues && e.enumValues) {
      this.enumValues = this.enumValues.concat(e.enumValues);
      for (const t of this.problems)
        t.code === H.EnumValueMismatch && (t.message = E("Value is not accepted. Valid values: {0}.", this.enumValues.map((n) => JSON.stringify(n)).join(", ")));
    }
  }
  mergePropertyMatch(e) {
    this.problems = this.problems.concat(e.problems), this.propertiesMatches++, (e.enumValueMatch || !e.hasProblems() && e.propertiesMatches) && this.propertiesValueMatches++, e.enumValueMatch && e.enumValues && e.enumValues.length === 1 && this.primaryValueMatches++;
  }
  mergeProcessedProperties(e) {
    e.processedProperties.forEach((t) => this.processedProperties.add(t));
  }
  compare(e) {
    const t = this.hasProblems();
    return t !== e.hasProblems() ? t ? -1 : 1 : this.enumValueMatch !== e.enumValueMatch ? e.enumValueMatch ? -1 : 1 : this.primaryValueMatches !== e.primaryValueMatches ? this.primaryValueMatches - e.primaryValueMatches : this.propertiesValueMatches !== e.propertiesValueMatches ? this.propertiesValueMatches - e.propertiesValueMatches : this.propertiesMatches - e.propertiesMatches;
  }
};
function wc(e, t = []) {
  return new Ga(e, t, []);
}
function ut(e) {
  return ac(e);
}
function Qr(e) {
  return sc(e);
}
function za(e, t, n = !1) {
  return t >= e.offset && t < e.offset + e.length || n && t === e.offset + e.length;
}
var Ga = class {
  constructor(e, t = [], n = []) {
    this.root = e, this.syntaxErrors = t, this.comments = n;
  }
  getNodeFromOffset(e, t = !1) {
    if (this.root)
      return ic(this.root, e, t);
  }
  visit(e) {
    if (this.root) {
      const t = (n) => {
        let r = e(n);
        const i = n.children;
        if (Array.isArray(i))
          for (let s = 0; s < i.length && r; s++)
            r = t(i[s]);
        return r;
      };
      t(this.root);
    }
  }
  validate(e, t, n = ye.Warning, r) {
    if (this.root && t) {
      const i = new fe();
      return oe(this.root, t, i, an.instance, new oa(r ?? la(t))), i.problems.map((s) => {
        const a = q.create(e.positionAt(s.location.offset), e.positionAt(s.location.offset + s.location.length));
        return je.create(a, s.message, s.severity ?? n, s.code);
      });
    }
  }
  getMatchingSchemas(e, t = -1, n) {
    if (this.root && e) {
      const r = new yc(t, n), i = la(e), s = new oa(i);
      return oe(this.root, e, new fe(), r, s), r.schemas;
    }
    return [];
  }
};
function la(e, t = Me.v2020_12) {
  let n = e.$schema;
  return n ? xc[n] ?? t : t;
}
function oe(e, t, n, r, i) {
  if (!e || !r.include(e))
    return;
  if (e.type === "property")
    return oe(e.valueNode, t, n, r, i);
  const s = e;
  switch (a(), s.type) {
    case "object":
      h(s);
      break;
    case "array":
      u(s);
      break;
    case "string":
      o(s);
      break;
    case "number":
      l(s);
      break;
  }
  r.add({ node: s, schema: t });
  function a() {
    var L;
    function c(v) {
      return s.type === v || v === "integer" && s.type === "number" && s.isInteger;
    }
    if (Array.isArray(t.type) ? t.type.some(c) || n.problems.push({
      location: { offset: s.offset, length: s.length },
      message: t.errorMessage || E("Incorrect type. Expected one of {0}.", t.type.join(", "))
    }) : t.type && (c(t.type) || n.problems.push({
      location: { offset: s.offset, length: s.length },
      message: t.errorMessage || E('Incorrect type. Expected "{0}".', t.type)
    })), Array.isArray(t.allOf))
      for (const v of t.allOf) {
        const y = new fe(), b = r.newSub();
        oe(s, be(v), y, b, i), n.merge(y), r.merge(b);
      }
    const d = be(t.not);
    if (d) {
      const v = new fe(), y = r.newSub();
      oe(s, d, v, y, i), v.hasProblems() || n.problems.push({
        location: { offset: s.offset, length: s.length },
        message: t.errorMessage || E("Matches a schema that is not allowed.")
      });
      for (const b of y.schemas)
        b.inverted = !b.inverted, r.add(b);
    }
    const m = (v, y) => {
      const b = [];
      let _;
      for (const k of v) {
        const C = be(k), F = new fe(), O = r.newSub();
        if (oe(s, C, F, O, i), F.hasProblems() || b.push(C), !_)
          _ = { schema: C, validationResult: F, matchingSchemas: O };
        else if (!y && !F.hasProblems() && !_.validationResult.hasProblems())
          _.matchingSchemas.merge(O), _.validationResult.propertiesMatches += F.propertiesMatches, _.validationResult.propertiesValueMatches += F.propertiesValueMatches, _.validationResult.mergeProcessedProperties(F);
        else {
          const M = F.compare(_.validationResult);
          M > 0 ? _ = { schema: C, validationResult: F, matchingSchemas: O } : M === 0 && (_.matchingSchemas.merge(O), _.validationResult.mergeEnumValues(F));
        }
      }
      return b.length > 1 && y && n.problems.push({
        location: { offset: s.offset, length: 1 },
        message: E("Matches multiple schemas when only one must validate.")
      }), _ && (n.merge(_.validationResult), r.merge(_.matchingSchemas)), b.length;
    };
    Array.isArray(t.anyOf) && m(t.anyOf, !1), Array.isArray(t.oneOf) && m(t.oneOf, !0);
    const g = (v) => {
      const y = new fe(), b = r.newSub();
      oe(s, be(v), y, b, i), n.merge(y), r.merge(b);
    }, p = (v, y, b) => {
      const _ = be(v), k = new fe(), C = r.newSub();
      oe(s, _, k, C, i), r.merge(C), n.mergeProcessedProperties(k), k.hasProblems() ? b && g(b) : y && g(y);
    }, x = be(t.if);
    if (x && p(x, be(t.then), be(t.else)), Array.isArray(t.enum)) {
      const v = ut(s);
      let y = !1;
      for (const b of t.enum)
        if (Mt(v, b)) {
          y = !0;
          break;
        }
      n.enumValues = t.enum, n.enumValueMatch = y, y || n.problems.push({
        location: { offset: s.offset, length: s.length },
        code: H.EnumValueMismatch,
        message: t.errorMessage || E("Value is not accepted. Valid values: {0}.", t.enum.map((b) => JSON.stringify(b)).join(", "))
      });
    }
    if (ke(t.const)) {
      const v = ut(s);
      Mt(v, t.const) ? n.enumValueMatch = !0 : (n.problems.push({
        location: { offset: s.offset, length: s.length },
        code: H.EnumValueMismatch,
        message: t.errorMessage || E("Value must be {0}.", JSON.stringify(t.const))
      }), n.enumValueMatch = !1), n.enumValues = [t.const];
    }
    let w = t.deprecationMessage;
    if (w || t.deprecated) {
      w = w || E("Value is deprecated");
      let v = ((L = s.parent) == null ? void 0 : L.type) === "property" ? s.parent : s;
      n.problems.push({
        location: { offset: v.offset, length: v.length },
        severity: ye.Warning,
        message: w,
        code: H.Deprecated
      });
    }
  }
  function l(c) {
    const d = c.value;
    function m(y) {
      var _;
      const b = /^(-?\d+)(?:\.(\d+))?(?:e([-+]\d+))?$/.exec(y.toString());
      return b && {
        value: Number(b[1] + (b[2] || "")),
        multiplier: (((_ = b[2]) == null ? void 0 : _.length) || 0) - (parseInt(b[3]) || 0)
      };
    }
    if (ce(t.multipleOf)) {
      let y = -1;
      if (Number.isInteger(t.multipleOf))
        y = d % t.multipleOf;
      else {
        let b = m(t.multipleOf), _ = m(d);
        if (b && _) {
          const k = 10 ** Math.abs(_.multiplier - b.multiplier);
          _.multiplier < b.multiplier ? _.value *= k : b.value *= k, y = _.value % b.value;
        }
      }
      y !== 0 && n.problems.push({
        location: { offset: c.offset, length: c.length },
        message: E("Value is not divisible by {0}.", t.multipleOf)
      });
    }
    function g(y, b) {
      if (ce(b))
        return b;
      if (Ve(b) && b)
        return y;
    }
    function p(y, b) {
      if (!Ve(b) || !b)
        return y;
    }
    const x = g(t.minimum, t.exclusiveMinimum);
    ce(x) && d <= x && n.problems.push({
      location: { offset: c.offset, length: c.length },
      message: E("Value is below the exclusive minimum of {0}.", x)
    });
    const w = g(t.maximum, t.exclusiveMaximum);
    ce(w) && d >= w && n.problems.push({
      location: { offset: c.offset, length: c.length },
      message: E("Value is above the exclusive maximum of {0}.", w)
    });
    const L = p(t.minimum, t.exclusiveMinimum);
    ce(L) && d < L && n.problems.push({
      location: { offset: c.offset, length: c.length },
      message: E("Value is below the minimum of {0}.", L)
    });
    const v = p(t.maximum, t.exclusiveMaximum);
    ce(v) && d > v && n.problems.push({
      location: { offset: c.offset, length: c.length },
      message: E("Value is above the maximum of {0}.", v)
    });
  }
  function o(c) {
    if (ce(t.minLength) && l1(c.value) < t.minLength && n.problems.push({
      location: { offset: c.offset, length: c.length },
      message: E("String is shorter than the minimum length of {0}.", t.minLength)
    }), ce(t.maxLength) && l1(c.value) > t.maxLength && n.problems.push({
      location: { offset: c.offset, length: c.length },
      message: E("String is longer than the maximum length of {0}.", t.maxLength)
    }), ja(t.pattern)) {
      const d = Fn(t.pattern);
      d != null && d.test(c.value) || n.problems.push({
        location: { offset: c.offset, length: c.length },
        message: t.patternErrorMessage || t.errorMessage || E('String does not match the pattern of "{0}".', t.pattern)
      });
    }
    if (t.format)
      switch (t.format) {
        case "uri":
        case "uri-reference":
          {
            let m;
            if (!c.value)
              m = E("URI expected.");
            else {
              const g = /^(([^:/?#]+?):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/.exec(c.value);
              g ? !g[2] && t.format === "uri" && (m = E("URI with a scheme is expected.")) : m = E("URI is expected.");
            }
            m && n.problems.push({
              location: { offset: c.offset, length: c.length },
              message: t.patternErrorMessage || t.errorMessage || E("String is not a URI: {0}", m)
            });
          }
          break;
        case "color-hex":
        case "date-time":
        case "date":
        case "time":
        case "email":
        case "hostname":
        case "ipv4":
        case "ipv6":
          const d = dc[t.format];
          (!c.value || !d.pattern.exec(c.value)) && n.problems.push({
            location: { offset: c.offset, length: c.length },
            message: t.patternErrorMessage || t.errorMessage || d.errorMessage
          });
      }
  }
  function u(c) {
    let d, m;
    i.schemaDraft >= Me.v2020_12 ? (d = t.prefixItems, m = Array.isArray(t.items) ? void 0 : t.items) : (d = Array.isArray(t.items) ? t.items : void 0, m = Array.isArray(t.items) ? t.additionalItems : t.items);
    let g = 0;
    if (d !== void 0) {
      const w = Math.min(d.length, c.items.length);
      for (; g < w; g++) {
        const L = d[g], v = be(L), y = new fe(), b = c.items[g];
        b && (oe(b, v, y, r, i), n.mergePropertyMatch(y)), n.processedProperties.add(String(g));
      }
    }
    if (m !== void 0 && g < c.items.length)
      if (typeof m == "boolean")
        for (m === !1 && n.problems.push({
          location: { offset: c.offset, length: c.length },
          message: E("Array has too many items according to schema. Expected {0} or fewer.", g)
        }); g < c.items.length; g++)
          n.processedProperties.add(String(g)), n.propertiesValueMatches++;
      else
        for (; g < c.items.length; g++) {
          const w = new fe();
          oe(c.items[g], m, w, r, i), n.mergePropertyMatch(w), n.processedProperties.add(String(g));
        }
    const p = be(t.contains);
    if (p) {
      let w = 0;
      for (let L = 0; L < c.items.length; L++) {
        const v = c.items[L], y = new fe();
        oe(v, p, y, an.instance, i), y.hasProblems() || (w++, i.schemaDraft >= Me.v2020_12 && n.processedProperties.add(String(L)));
      }
      w === 0 && !ce(t.minContains) && n.problems.push({
        location: { offset: c.offset, length: c.length },
        message: t.errorMessage || E("Array does not contain required item.")
      }), ce(t.minContains) && w < t.minContains && n.problems.push({
        location: { offset: c.offset, length: c.length },
        message: t.errorMessage || E("Array has too few items that match the contains contraint. Expected {0} or more.", t.minContains)
      }), ce(t.maxContains) && w > t.maxContains && n.problems.push({
        location: { offset: c.offset, length: c.length },
        message: t.errorMessage || E("Array has too many items that match the contains contraint. Expected {0} or less.", t.maxContains)
      });
    }
    const x = t.unevaluatedItems;
    if (x !== void 0)
      for (let w = 0; w < c.items.length; w++) {
        if (!n.processedProperties.has(String(w)))
          if (x === !1)
            n.problems.push({
              location: { offset: c.offset, length: c.length },
              message: E("Item does not match any validation rule from the array.")
            });
          else {
            const L = new fe();
            oe(c.items[w], t.unevaluatedItems, L, r, i), n.mergePropertyMatch(L);
          }
        n.processedProperties.add(String(w)), n.propertiesValueMatches++;
      }
    if (ce(t.minItems) && c.items.length < t.minItems && n.problems.push({
      location: { offset: c.offset, length: c.length },
      message: E("Array has too few items. Expected {0} or more.", t.minItems)
    }), ce(t.maxItems) && c.items.length > t.maxItems && n.problems.push({
      location: { offset: c.offset, length: c.length },
      message: E("Array has too many items. Expected {0} or fewer.", t.maxItems)
    }), t.uniqueItems === !0) {
      let w = function() {
        for (let v = 0; v < L.length - 1; v++) {
          const y = L[v];
          for (let b = v + 1; b < L.length; b++)
            if (Mt(y, L[b]))
              return !0;
        }
        return !1;
      };
      const L = ut(c);
      w() && n.problems.push({
        location: { offset: c.offset, length: c.length },
        message: E("Array has duplicate items.")
      });
    }
  }
  function h(c) {
    const d = /* @__PURE__ */ Object.create(null), m = /* @__PURE__ */ new Set();
    for (const v of c.properties) {
      const y = v.keyNode.value;
      d[y] = v.valueNode, m.add(y);
    }
    if (Array.isArray(t.required)) {
      for (const v of t.required)
        if (!d[v]) {
          const y = c.parent && c.parent.type === "property" && c.parent.keyNode, b = y ? { offset: y.offset, length: y.length } : { offset: c.offset, length: 1 };
          n.problems.push({
            location: b,
            message: E('Missing property "{0}".', v)
          });
        }
    }
    const g = (v) => {
      m.delete(v), n.processedProperties.add(v);
    };
    if (t.properties)
      for (const v of Object.keys(t.properties)) {
        g(v);
        const y = t.properties[v], b = d[v];
        if (b)
          if (Ve(y))
            if (y)
              n.propertiesMatches++, n.propertiesValueMatches++;
            else {
              const _ = b.parent;
              n.problems.push({
                location: { offset: _.keyNode.offset, length: _.keyNode.length },
                message: t.errorMessage || E("Property {0} is not allowed.", v)
              });
            }
          else {
            const _ = new fe();
            oe(b, y, _, r, i), n.mergePropertyMatch(_);
          }
      }
    if (t.patternProperties)
      for (const v of Object.keys(t.patternProperties)) {
        const y = Fn(v);
        if (y) {
          const b = [];
          for (const _ of m)
            if (y.test(_)) {
              b.push(_);
              const k = d[_];
              if (k) {
                const C = t.patternProperties[v];
                if (Ve(C))
                  if (C)
                    n.propertiesMatches++, n.propertiesValueMatches++;
                  else {
                    const F = k.parent;
                    n.problems.push({
                      location: { offset: F.keyNode.offset, length: F.keyNode.length },
                      message: t.errorMessage || E("Property {0} is not allowed.", _)
                    });
                  }
                else {
                  const F = new fe();
                  oe(k, C, F, r, i), n.mergePropertyMatch(F);
                }
              }
            }
          b.forEach(g);
        }
      }
    const p = t.additionalProperties;
    if (p !== void 0)
      for (const v of m) {
        g(v);
        const y = d[v];
        if (y) {
          if (p === !1) {
            const b = y.parent;
            n.problems.push({
              location: { offset: b.keyNode.offset, length: b.keyNode.length },
              message: t.errorMessage || E("Property {0} is not allowed.", v)
            });
          } else if (p !== !0) {
            const b = new fe();
            oe(y, p, b, r, i), n.mergePropertyMatch(b);
          }
        }
      }
    const x = t.unevaluatedProperties;
    if (x !== void 0) {
      const v = [];
      for (const y of m)
        if (!n.processedProperties.has(y)) {
          v.push(y);
          const b = d[y];
          if (b) {
            if (x === !1) {
              const _ = b.parent;
              n.problems.push({
                location: { offset: _.keyNode.offset, length: _.keyNode.length },
                message: t.errorMessage || E("Property {0} is not allowed.", y)
              });
            } else if (x !== !0) {
              const _ = new fe();
              oe(b, x, _, r, i), n.mergePropertyMatch(_);
            }
          }
        }
      v.forEach(g);
    }
    if (ce(t.maxProperties) && c.properties.length > t.maxProperties && n.problems.push({
      location: { offset: c.offset, length: c.length },
      message: E("Object has more properties than limit of {0}.", t.maxProperties)
    }), ce(t.minProperties) && c.properties.length < t.minProperties && n.problems.push({
      location: { offset: c.offset, length: c.length },
      message: E("Object has fewer properties than the required number of {0}", t.minProperties)
    }), t.dependentRequired)
      for (const v in t.dependentRequired) {
        const y = d[v], b = t.dependentRequired[v];
        y && Array.isArray(b) && L(v, b);
      }
    if (t.dependentSchemas)
      for (const v in t.dependentSchemas) {
        const y = d[v], b = t.dependentSchemas[v];
        y && Ye(b) && L(v, b);
      }
    if (t.dependencies)
      for (const v in t.dependencies)
        d[v] && L(v, t.dependencies[v]);
    const w = be(t.propertyNames);
    if (w)
      for (const v of c.properties) {
        const y = v.keyNode;
        y && oe(y, w, n, an.instance, i);
      }
    function L(v, y) {
      if (Array.isArray(y))
        for (const b of y)
          d[b] ? n.propertiesValueMatches++ : n.problems.push({
            location: { offset: c.offset, length: c.length },
            message: E("Object is missing property {0} required by property {1}.", b, v)
          });
      else {
        const b = be(y);
        if (b) {
          const _ = new fe();
          oe(c, b, _, r, i), n.mergePropertyMatch(_);
        }
      }
    }
  }
}
function _c(e, t) {
  const n = [];
  let r = -1;
  const i = e.getText(), s = lt(i, !1), a = t && t.collectComments ? [] : void 0;
  function l() {
    for (; ; ) {
      const _ = s.scan();
      switch (h(), _) {
        case 12:
        case 13:
          Array.isArray(a) && a.push(q.create(e.positionAt(s.getTokenOffset()), e.positionAt(s.getTokenOffset() + s.getTokenLength())));
          break;
        case 15:
        case 14:
          break;
        default:
          return _;
      }
    }
  }
  function o(_, k, C, F, O = ye.Error) {
    if (n.length === 0 || C !== r) {
      const M = q.create(e.positionAt(C), e.positionAt(F));
      n.push(je.create(M, _, O, k, e.languageId)), r = C;
    }
  }
  function u(_, k, C = void 0, F = [], O = []) {
    let M = s.getTokenOffset(), N = s.getTokenOffset() + s.getTokenLength();
    if (M === N && M > 0) {
      for (M--; M > 0 && /\s/.test(i.charAt(M)); )
        M--;
      N = M + 1;
    }
    if (o(_, k, M, N), C && c(C, !1), F.length + O.length > 0) {
      let S = s.getToken();
      for (; S !== 17; ) {
        if (F.indexOf(S) !== -1) {
          l();
          break;
        } else if (O.indexOf(S) !== -1)
          break;
        S = l();
      }
    }
    return C;
  }
  function h() {
    switch (s.getTokenError()) {
      case 4:
        return u(E("Invalid unicode sequence in string."), H.InvalidUnicode), !0;
      case 5:
        return u(E("Invalid escape character in string."), H.InvalidEscapeCharacter), !0;
      case 3:
        return u(E("Unexpected end of number."), H.UnexpectedEndOfNumber), !0;
      case 1:
        return u(E("Unexpected end of comment."), H.UnexpectedEndOfComment), !0;
      case 2:
        return u(E("Unexpected end of string."), H.UnexpectedEndOfString), !0;
      case 6:
        return u(E("Invalid characters in string. Control characters must be escaped."), H.InvalidCharacter), !0;
    }
    return !1;
  }
  function c(_, k) {
    return _.length = s.getTokenOffset() + s.getTokenLength() - _.offset, k && l(), _;
  }
  function d(_) {
    if (s.getToken() !== 3)
      return;
    const k = new gc(_, s.getTokenOffset());
    l();
    let C = !1;
    for (; s.getToken() !== 4 && s.getToken() !== 17; ) {
      if (s.getToken() === 5) {
        C || u(E("Value expected"), H.ValueExpected);
        const O = s.getTokenOffset();
        if (l(), s.getToken() === 4) {
          C && o(E("Trailing comma"), H.TrailingComma, O, O + 1);
          continue;
        }
      } else
        C && u(E("Expected comma"), H.CommaExpected);
      const F = v(k);
      F ? k.items.push(F) : u(E("Value expected"), H.ValueExpected, void 0, [], [
        4,
        5
        /* Json.SyntaxKind.CommaToken */
      ]), C = !0;
    }
    return s.getToken() !== 4 ? u(E("Expected comma or closing bracket"), H.CommaOrCloseBacketExpected, k) : c(k, !0);
  }
  const m = new ir(void 0, 0, 0);
  function g(_, k) {
    const C = new bc(_, s.getTokenOffset(), m);
    let F = x(C);
    if (!F)
      if (s.getToken() === 16) {
        u(E("Property keys must be doublequoted"), H.PropertyKeysMustBeDoublequoted);
        const M = new ir(C, s.getTokenOffset(), s.getTokenLength());
        M.value = s.getTokenValue(), F = M, l();
      } else
        return;
    if (C.keyNode = F, F.value !== "//") {
      const M = k[F.value];
      M ? (o(E("Duplicate object key"), H.DuplicateKey, C.keyNode.offset, C.keyNode.offset + C.keyNode.length, ye.Warning), Ye(M) && o(E("Duplicate object key"), H.DuplicateKey, M.keyNode.offset, M.keyNode.offset + M.keyNode.length, ye.Warning), k[F.value] = !0) : k[F.value] = C;
    }
    if (s.getToken() === 6)
      C.colonOffset = s.getTokenOffset(), l();
    else if (u(E("Colon expected"), H.ColonExpected), s.getToken() === 10 && e.positionAt(F.offset + F.length).line < e.positionAt(s.getTokenOffset()).line)
      return C.length = F.length, C;
    const O = v(C);
    return O ? (C.valueNode = O, C.length = O.offset + O.length - C.offset, C) : u(E("Value expected"), H.ValueExpected, C, [], [
      2,
      5
      /* Json.SyntaxKind.CommaToken */
    ]);
  }
  function p(_) {
    if (s.getToken() !== 1)
      return;
    const k = new vc(_, s.getTokenOffset()), C = /* @__PURE__ */ Object.create(null);
    l();
    let F = !1;
    for (; s.getToken() !== 2 && s.getToken() !== 17; ) {
      if (s.getToken() === 5) {
        F || u(E("Property expected"), H.PropertyExpected);
        const M = s.getTokenOffset();
        if (l(), s.getToken() === 2) {
          F && o(E("Trailing comma"), H.TrailingComma, M, M + 1);
          continue;
        }
      } else
        F && u(E("Expected comma"), H.CommaExpected);
      const O = g(k, C);
      O ? k.properties.push(O) : u(E("Property expected"), H.PropertyExpected, void 0, [], [
        2,
        5
        /* Json.SyntaxKind.CommaToken */
      ]), F = !0;
    }
    return s.getToken() !== 2 ? u(E("Expected comma or closing brace"), H.CommaOrCloseBraceExpected, k) : c(k, !0);
  }
  function x(_) {
    if (s.getToken() !== 10)
      return;
    const k = new ir(_, s.getTokenOffset());
    return k.value = s.getTokenValue(), c(k, !0);
  }
  function w(_) {
    if (s.getToken() !== 11)
      return;
    const k = new pc(_, s.getTokenOffset());
    if (s.getTokenError() === 0) {
      const C = s.getTokenValue();
      try {
        const F = JSON.parse(C);
        if (!ce(F))
          return u(E("Invalid number format."), H.Undefined, k);
        k.value = F;
      } catch {
        return u(E("Invalid number format."), H.Undefined, k);
      }
      k.isInteger = C.indexOf(".") === -1;
    }
    return c(k, !0);
  }
  function L(_) {
    switch (s.getToken()) {
      case 7:
        return c(new mc(_, s.getTokenOffset()), !0);
      case 8:
        return c(new sa(_, !0, s.getTokenOffset()), !0);
      case 9:
        return c(new sa(_, !1, s.getTokenOffset()), !0);
      default:
        return;
    }
  }
  function v(_) {
    return d(_) || p(_) || x(_) || w(_) || L(_);
  }
  let y;
  return l() !== 17 && (y = v(y), y ? s.getToken() !== 17 && u(E("End of file expected."), H.Undefined) : u(E("Expected a JSON object, array or literal."), H.Undefined)), new Ga(y, n, a);
}
function Yr(e, t, n) {
  if (e !== null && typeof e == "object") {
    const r = t + "	";
    if (Array.isArray(e)) {
      if (e.length === 0)
        return "[]";
      let i = `[
`;
      for (let s = 0; s < e.length; s++)
        i += r + Yr(e[s], r, n), s < e.length - 1 && (i += ","), i += `
`;
      return i += t + "]", i;
    } else {
      const i = Object.keys(e);
      if (i.length === 0)
        return "{}";
      let s = `{
`;
      for (let a = 0; a < i.length; a++) {
        const l = i[a];
        s += r + JSON.stringify(l) + ": " + Yr(e[l], r, n), a < i.length - 1 && (s += ","), s += `
`;
      }
      return s += t + "}", s;
    }
  }
  return n(e);
}
var Lc = class {
  constructor(e, t = [], n = Promise, r = {}) {
    this.schemaService = e, this.contributions = t, this.promiseConstructor = n, this.clientCapabilities = r;
  }
  doResolve(e) {
    for (let t = this.contributions.length - 1; t >= 0; t--) {
      const n = this.contributions[t].resolveCompletion;
      if (n) {
        const r = n(e);
        if (r)
          return r;
      }
    }
    return this.promiseConstructor.resolve(e);
  }
  doComplete(e, t, n) {
    const r = {
      items: [],
      isIncomplete: !1
    }, i = e.getText(), s = e.offsetAt(t);
    let a = n.getNodeFromOffset(s, !0);
    if (this.isInComment(e, a ? a.offset : 0, s))
      return Promise.resolve(r);
    if (a && s === a.offset + a.length && s > 0) {
      const c = i[s - 1];
      (a.type === "object" && c === "}" || a.type === "array" && c === "]") && (a = a.parent);
    }
    const l = this.getCurrentWord(e, s);
    let o;
    if (a && (a.type === "string" || a.type === "number" || a.type === "boolean" || a.type === "null"))
      o = q.create(e.positionAt(a.offset), e.positionAt(a.offset + a.length));
    else {
      let c = s - l.length;
      c > 0 && i[c - 1] === '"' && c--, o = q.create(e.positionAt(c), t);
    }
    const u = /* @__PURE__ */ new Map(), h = {
      add: (c) => {
        let d = c.label;
        const m = u.get(d);
        if (m)
          m.documentation || (m.documentation = c.documentation), m.detail || (m.detail = c.detail), m.labelDetails || (m.labelDetails = c.labelDetails);
        else {
          if (d = d.replace(/[\n]/g, "↵"), d.length > 60) {
            const g = d.substr(0, 57).trim() + "...";
            u.has(g) || (d = g);
          }
          c.textEdit = Oe.replace(o, c.insertText), c.label = d, u.set(d, c), r.items.push(c);
        }
      },
      setAsIncomplete: () => {
        r.isIncomplete = !0;
      },
      error: (c) => {
        console.error(c);
      },
      getNumberOfProposals: () => r.items.length
    };
    return this.schemaService.getSchemaForResource(e.uri, n).then((c) => {
      const d = [];
      let m = !0, g = "", p;
      if (a && a.type === "string") {
        const w = a.parent;
        w && w.type === "property" && w.keyNode === a && (m = !w.valueNode, p = w, g = i.substr(a.offset + 1, a.length - 2), w && (a = w.parent));
      }
      if (a && a.type === "object") {
        if (a.offset === s)
          return r;
        a.properties.forEach((y) => {
          (!p || p !== y) && u.set(y.keyNode.value, Wr.create("__"));
        });
        let L = "";
        m && (L = this.evaluateSeparatorAfter(e, e.offsetAt(o.end))), c ? this.getPropertyCompletions(c, n, a, m, L, h) : this.getSchemaLessPropertyCompletions(n, a, g, h);
        const v = Qr(a);
        this.contributions.forEach((y) => {
          const b = y.collectPropertyCompletions(e.uri, v, l, m, L === "", h);
          b && d.push(b);
        }), !c && l.length > 0 && i.charAt(s - l.length - 1) !== '"' && (h.add({
          kind: xe.Property,
          label: this.getLabelForValue(l),
          insertText: this.getInsertTextForProperty(l, void 0, !1, L),
          insertTextFormat: ie.Snippet,
          documentation: ""
        }), h.setAsIncomplete());
      }
      const x = {};
      return c ? this.getValueCompletions(c, n, a, s, e, h, x) : this.getSchemaLessValueCompletions(n, a, s, e, h), this.contributions.length > 0 && this.getContributedValueCompletions(n, a, s, e, h, d), this.promiseConstructor.all(d).then(() => {
        if (h.getNumberOfProposals() === 0) {
          let w = s;
          a && (a.type === "string" || a.type === "number" || a.type === "boolean" || a.type === "null") && (w = a.offset + a.length);
          const L = this.evaluateSeparatorAfter(e, w);
          this.addFillerValueCompletions(x, L, h);
        }
        return r;
      });
    });
  }
  getPropertyCompletions(e, t, n, r, i, s) {
    t.getMatchingSchemas(e.schema, n.offset).forEach((l) => {
      if (l.node === n && !l.inverted) {
        const o = l.schema.properties;
        o && Object.keys(o).forEach((h) => {
          const c = o[h];
          if (typeof c == "object" && !c.deprecationMessage && !c.doNotSuggest) {
            const d = {
              kind: xe.Property,
              label: h,
              insertText: this.getInsertTextForProperty(h, c, r, i),
              insertTextFormat: ie.Snippet,
              filterText: this.getFilterTextForValue(h),
              documentation: this.fromMarkup(c.markdownDescription) || c.description || ""
            };
            c.suggestSortText !== void 0 && (d.sortText = c.suggestSortText), d.insertText && rn(d.insertText, `$1${i}`) && (d.command = {
              title: "Suggest",
              command: "editor.action.triggerSuggest"
            }), s.add(d);
          }
        });
        const u = l.schema.propertyNames;
        if (typeof u == "object" && !u.deprecationMessage && !u.doNotSuggest) {
          const h = (c, d = void 0) => {
            const m = {
              kind: xe.Property,
              label: c,
              insertText: this.getInsertTextForProperty(c, void 0, r, i),
              insertTextFormat: ie.Snippet,
              filterText: this.getFilterTextForValue(c),
              documentation: d || this.fromMarkup(u.markdownDescription) || u.description || ""
            };
            u.suggestSortText !== void 0 && (m.sortText = u.suggestSortText), m.insertText && rn(m.insertText, `$1${i}`) && (m.command = {
              title: "Suggest",
              command: "editor.action.triggerSuggest"
            }), s.add(m);
          };
          if (u.enum)
            for (let c = 0; c < u.enum.length; c++) {
              let d;
              u.markdownEnumDescriptions && c < u.markdownEnumDescriptions.length ? d = this.fromMarkup(u.markdownEnumDescriptions[c]) : u.enumDescriptions && c < u.enumDescriptions.length && (d = u.enumDescriptions[c]), h(u.enum[c], d);
            }
          u.const && h(u.const);
        }
      }
    });
  }
  getSchemaLessPropertyCompletions(e, t, n, r) {
    const i = (s) => {
      s.properties.forEach((a) => {
        const l = a.keyNode.value;
        r.add({
          kind: xe.Property,
          label: l,
          insertText: this.getInsertTextForValue(l, ""),
          insertTextFormat: ie.Snippet,
          filterText: this.getFilterTextForValue(l),
          documentation: ""
        });
      });
    };
    if (t.parent)
      if (t.parent.type === "property") {
        const s = t.parent.keyNode.value;
        e.visit((a) => (a.type === "property" && a !== t.parent && a.keyNode.value === s && a.valueNode && a.valueNode.type === "object" && i(a.valueNode), !0));
      } else
        t.parent.type === "array" && t.parent.items.forEach((s) => {
          s.type === "object" && s !== t && i(s);
        });
    else
      t.type === "object" && r.add({
        kind: xe.Property,
        label: "$schema",
        insertText: this.getInsertTextForProperty("$schema", void 0, !0, ""),
        insertTextFormat: ie.Snippet,
        documentation: "",
        filterText: this.getFilterTextForValue("$schema")
      });
  }
  getSchemaLessValueCompletions(e, t, n, r, i) {
    let s = n;
    if (t && (t.type === "string" || t.type === "number" || t.type === "boolean" || t.type === "null") && (s = t.offset + t.length, t = t.parent), !t) {
      i.add({
        kind: this.getSuggestionKind("object"),
        label: "Empty object",
        insertText: this.getInsertTextForValue({}, ""),
        insertTextFormat: ie.Snippet,
        documentation: ""
      }), i.add({
        kind: this.getSuggestionKind("array"),
        label: "Empty array",
        insertText: this.getInsertTextForValue([], ""),
        insertTextFormat: ie.Snippet,
        documentation: ""
      });
      return;
    }
    const a = this.evaluateSeparatorAfter(r, s), l = (o) => {
      o.parent && !za(o.parent, n, !0) && i.add({
        kind: this.getSuggestionKind(o.type),
        label: this.getLabelTextForMatchingNode(o, r),
        insertText: this.getInsertTextForMatchingNode(o, r, a),
        insertTextFormat: ie.Snippet,
        documentation: ""
      }), o.type === "boolean" && this.addBooleanValueCompletion(!o.value, a, i);
    };
    if (t.type === "property" && n > (t.colonOffset || 0)) {
      const o = t.valueNode;
      if (o && (n > o.offset + o.length || o.type === "object" || o.type === "array"))
        return;
      const u = t.keyNode.value;
      e.visit((h) => (h.type === "property" && h.keyNode.value === u && h.valueNode && l(h.valueNode), !0)), u === "$schema" && t.parent && !t.parent.parent && this.addDollarSchemaCompletions(a, i);
    }
    if (t.type === "array")
      if (t.parent && t.parent.type === "property") {
        const o = t.parent.keyNode.value;
        e.visit((u) => (u.type === "property" && u.keyNode.value === o && u.valueNode && u.valueNode.type === "array" && u.valueNode.items.forEach(l), !0));
      } else
        t.items.forEach(l);
  }
  getValueCompletions(e, t, n, r, i, s, a) {
    let l = r, o, u;
    if (n && (n.type === "string" || n.type === "number" || n.type === "boolean" || n.type === "null") && (l = n.offset + n.length, u = n, n = n.parent), !n) {
      this.addSchemaValueCompletions(e.schema, "", s, a);
      return;
    }
    if (n.type === "property" && r > (n.colonOffset || 0)) {
      const h = n.valueNode;
      if (h && r > h.offset + h.length)
        return;
      o = n.keyNode.value, n = n.parent;
    }
    if (n && (o !== void 0 || n.type === "array")) {
      const h = this.evaluateSeparatorAfter(i, l), c = t.getMatchingSchemas(e.schema, n.offset, u);
      for (const d of c)
        if (d.node === n && !d.inverted && d.schema) {
          if (n.type === "array" && d.schema.items) {
            let m = s;
            if (d.schema.uniqueItems) {
              const g = /* @__PURE__ */ new Set();
              n.children.forEach((p) => {
                p.type !== "array" && p.type !== "object" && g.add(this.getLabelForValue(ut(p)));
              }), m = {
                ...s,
                add(p) {
                  g.has(p.label) || s.add(p);
                }
              };
            }
            if (Array.isArray(d.schema.items)) {
              const g = this.findItemAtOffset(n, i, r);
              g < d.schema.items.length && this.addSchemaValueCompletions(d.schema.items[g], h, m, a);
            } else
              this.addSchemaValueCompletions(d.schema.items, h, m, a);
          }
          if (o !== void 0) {
            let m = !1;
            if (d.schema.properties) {
              const g = d.schema.properties[o];
              g && (m = !0, this.addSchemaValueCompletions(g, h, s, a));
            }
            if (d.schema.patternProperties && !m)
              for (const g of Object.keys(d.schema.patternProperties)) {
                const p = Fn(g);
                if (p != null && p.test(o)) {
                  m = !0;
                  const x = d.schema.patternProperties[g];
                  this.addSchemaValueCompletions(x, h, s, a);
                }
              }
            if (d.schema.additionalProperties && !m) {
              const g = d.schema.additionalProperties;
              this.addSchemaValueCompletions(g, h, s, a);
            }
          }
        }
      o === "$schema" && !n.parent && this.addDollarSchemaCompletions(h, s), a.boolean && (this.addBooleanValueCompletion(!0, h, s), this.addBooleanValueCompletion(!1, h, s)), a.null && this.addNullValueCompletion(h, s);
    }
  }
  getContributedValueCompletions(e, t, n, r, i, s) {
    if (!t)
      this.contributions.forEach((a) => {
        const l = a.collectDefaultCompletions(r.uri, i);
        l && s.push(l);
      });
    else if ((t.type === "string" || t.type === "number" || t.type === "boolean" || t.type === "null") && (t = t.parent), t && t.type === "property" && n > (t.colonOffset || 0)) {
      const a = t.keyNode.value, l = t.valueNode;
      if ((!l || n <= l.offset + l.length) && t.parent) {
        const o = Qr(t.parent);
        this.contributions.forEach((u) => {
          const h = u.collectValueCompletions(r.uri, o, a, i);
          h && s.push(h);
        });
      }
    }
  }
  addSchemaValueCompletions(e, t, n, r) {
    typeof e == "object" && (this.addEnumValueCompletions(e, t, n), this.addDefaultValueCompletions(e, t, n), this.collectTypes(e, r), Array.isArray(e.allOf) && e.allOf.forEach((i) => this.addSchemaValueCompletions(i, t, n, r)), Array.isArray(e.anyOf) && e.anyOf.forEach((i) => this.addSchemaValueCompletions(i, t, n, r)), Array.isArray(e.oneOf) && e.oneOf.forEach((i) => this.addSchemaValueCompletions(i, t, n, r)));
  }
  addDefaultValueCompletions(e, t, n, r = 0) {
    let i = !1;
    if (ke(e.default)) {
      let s = e.type, a = e.default;
      for (let o = r; o > 0; o--)
        a = [a], s = "array";
      const l = {
        kind: this.getSuggestionKind(s),
        label: this.getLabelForValue(a),
        insertText: this.getInsertTextForValue(a, t),
        insertTextFormat: ie.Snippet
      };
      this.doesSupportsLabelDetails() ? l.labelDetails = { description: E("Default value") } : l.detail = E("Default value"), n.add(l), i = !0;
    }
    Array.isArray(e.examples) && e.examples.forEach((s) => {
      let a = e.type, l = s;
      for (let o = r; o > 0; o--)
        l = [l], a = "array";
      n.add({
        kind: this.getSuggestionKind(a),
        label: this.getLabelForValue(l),
        insertText: this.getInsertTextForValue(l, t),
        insertTextFormat: ie.Snippet
      }), i = !0;
    }), Array.isArray(e.defaultSnippets) && e.defaultSnippets.forEach((s) => {
      let a = e.type, l = s.body, o = s.label, u, h;
      if (ke(l)) {
        e.type;
        for (let c = r; c > 0; c--)
          l = [l];
        u = this.getInsertTextForSnippetValue(l, t), h = this.getFilterTextForSnippetValue(l), o = o || this.getLabelForSnippetValue(l);
      } else if (typeof s.bodyText == "string") {
        let c = "", d = "", m = "";
        for (let g = r; g > 0; g--)
          c = c + m + `[
`, d = d + `
` + m + "]", m += "	", a = "array";
        u = c + m + s.bodyText.split(`
`).join(`
` + m) + d + t, o = o || u, h = u.replace(/[\n]/g, "");
      } else
        return;
      n.add({
        kind: this.getSuggestionKind(a),
        label: o,
        documentation: this.fromMarkup(s.markdownDescription) || s.description,
        insertText: u,
        insertTextFormat: ie.Snippet,
        filterText: h
      }), i = !0;
    }), !i && typeof e.items == "object" && !Array.isArray(e.items) && r < 5 && this.addDefaultValueCompletions(e.items, t, n, r + 1);
  }
  addEnumValueCompletions(e, t, n) {
    if (ke(e.const) && n.add({
      kind: this.getSuggestionKind(e.type),
      label: this.getLabelForValue(e.const),
      insertText: this.getInsertTextForValue(e.const, t),
      insertTextFormat: ie.Snippet,
      documentation: this.fromMarkup(e.markdownDescription) || e.description
    }), Array.isArray(e.enum))
      for (let r = 0, i = e.enum.length; r < i; r++) {
        const s = e.enum[r];
        let a = this.fromMarkup(e.markdownDescription) || e.description;
        e.markdownEnumDescriptions && r < e.markdownEnumDescriptions.length && this.doesSupportMarkdown() ? a = this.fromMarkup(e.markdownEnumDescriptions[r]) : e.enumDescriptions && r < e.enumDescriptions.length && (a = e.enumDescriptions[r]), n.add({
          kind: this.getSuggestionKind(e.type),
          label: this.getLabelForValue(s),
          insertText: this.getInsertTextForValue(s, t),
          insertTextFormat: ie.Snippet,
          documentation: a
        });
      }
  }
  collectTypes(e, t) {
    if (Array.isArray(e.enum) || ke(e.const))
      return;
    const n = e.type;
    Array.isArray(n) ? n.forEach((r) => t[r] = !0) : n && (t[n] = !0);
  }
  addFillerValueCompletions(e, t, n) {
    e.object && n.add({
      kind: this.getSuggestionKind("object"),
      label: "{}",
      insertText: this.getInsertTextForGuessedValue({}, t),
      insertTextFormat: ie.Snippet,
      detail: E("New object"),
      documentation: ""
    }), e.array && n.add({
      kind: this.getSuggestionKind("array"),
      label: "[]",
      insertText: this.getInsertTextForGuessedValue([], t),
      insertTextFormat: ie.Snippet,
      detail: E("New array"),
      documentation: ""
    });
  }
  addBooleanValueCompletion(e, t, n) {
    n.add({
      kind: this.getSuggestionKind("boolean"),
      label: e ? "true" : "false",
      insertText: this.getInsertTextForValue(e, t),
      insertTextFormat: ie.Snippet,
      documentation: ""
    });
  }
  addNullValueCompletion(e, t) {
    t.add({
      kind: this.getSuggestionKind("null"),
      label: "null",
      insertText: "null" + e,
      insertTextFormat: ie.Snippet,
      documentation: ""
    });
  }
  addDollarSchemaCompletions(e, t) {
    this.schemaService.getRegisteredSchemaIds((r) => r === "http" || r === "https").forEach((r) => {
      r.startsWith("http://json-schema.org/draft-") && (r = r + "#"), t.add({
        kind: xe.Module,
        label: this.getLabelForValue(r),
        filterText: this.getFilterTextForValue(r),
        insertText: this.getInsertTextForValue(r, e),
        insertTextFormat: ie.Snippet,
        documentation: ""
      });
    });
  }
  getLabelForValue(e) {
    return JSON.stringify(e);
  }
  getValueFromLabel(e) {
    return JSON.parse(e);
  }
  getFilterTextForValue(e) {
    return JSON.stringify(e);
  }
  getFilterTextForSnippetValue(e) {
    return JSON.stringify(e).replace(/\$\{\d+:([^}]+)\}|\$\d+/g, "$1");
  }
  getLabelForSnippetValue(e) {
    return JSON.stringify(e).replace(/\$\{\d+:([^}]+)\}|\$\d+/g, "$1");
  }
  getInsertTextForPlainText(e) {
    return e.replace(/[\\\$\}]/g, "\\$&");
  }
  getInsertTextForValue(e, t) {
    const n = JSON.stringify(e, null, "	");
    return n === "{}" ? "{$1}" + t : n === "[]" ? "[$1]" + t : this.getInsertTextForPlainText(n + t);
  }
  getInsertTextForSnippetValue(e, t) {
    return Yr(e, "", (r) => typeof r == "string" && r[0] === "^" ? r.substr(1) : JSON.stringify(r)) + t;
  }
  getInsertTextForGuessedValue(e, t) {
    switch (typeof e) {
      case "object":
        return e === null ? "${1:null}" + t : this.getInsertTextForValue(e, t);
      case "string":
        let n = JSON.stringify(e);
        return n = n.substr(1, n.length - 2), n = this.getInsertTextForPlainText(n), '"${1:' + n + '}"' + t;
      case "number":
      case "boolean":
        return "${1:" + JSON.stringify(e) + "}" + t;
    }
    return this.getInsertTextForValue(e, t);
  }
  getSuggestionKind(e) {
    if (Array.isArray(e)) {
      const t = e;
      e = t.length > 0 ? t[0] : void 0;
    }
    if (!e)
      return xe.Value;
    switch (e) {
      case "string":
        return xe.Value;
      case "object":
        return xe.Module;
      case "property":
        return xe.Property;
      default:
        return xe.Value;
    }
  }
  getLabelTextForMatchingNode(e, t) {
    switch (e.type) {
      case "array":
        return "[]";
      case "object":
        return "{}";
      default:
        return t.getText().substr(e.offset, e.length);
    }
  }
  getInsertTextForMatchingNode(e, t, n) {
    switch (e.type) {
      case "array":
        return this.getInsertTextForValue([], n);
      case "object":
        return this.getInsertTextForValue({}, n);
      default:
        const r = t.getText().substr(e.offset, e.length) + n;
        return this.getInsertTextForPlainText(r);
    }
  }
  getInsertTextForProperty(e, t, n, r) {
    const i = this.getInsertTextForValue(e, "");
    if (!n)
      return i;
    const s = i + ": ";
    let a, l = 0;
    if (t) {
      if (Array.isArray(t.defaultSnippets)) {
        if (t.defaultSnippets.length === 1) {
          const o = t.defaultSnippets[0].body;
          ke(o) && (a = this.getInsertTextForSnippetValue(o, ""));
        }
        l += t.defaultSnippets.length;
      }
      if (t.enum && (!a && t.enum.length === 1 && (a = this.getInsertTextForGuessedValue(t.enum[0], "")), l += t.enum.length), ke(t.const) && (a || (a = this.getInsertTextForGuessedValue(t.const, "")), l++), ke(t.default) && (a || (a = this.getInsertTextForGuessedValue(t.default, "")), l++), Array.isArray(t.examples) && t.examples.length && (a || (a = this.getInsertTextForGuessedValue(t.examples[0], "")), l += t.examples.length), l === 0) {
        let o = Array.isArray(t.type) ? t.type[0] : t.type;
        switch (o || (t.properties ? o = "object" : t.items && (o = "array")), o) {
          case "boolean":
            a = "$1";
            break;
          case "string":
            a = '"$1"';
            break;
          case "object":
            a = "{$1}";
            break;
          case "array":
            a = "[$1]";
            break;
          case "number":
          case "integer":
            a = "${1:0}";
            break;
          case "null":
            a = "${1:null}";
            break;
          default:
            return i;
        }
      }
    }
    return (!a || l > 1) && (a = "$1"), s + a + r;
  }
  getCurrentWord(e, t) {
    let n = t - 1;
    const r = e.getText();
    for (; n >= 0 && ` 	
\r\v":{[,]}`.indexOf(r.charAt(n)) === -1; )
      n--;
    return r.substring(n + 1, t);
  }
  evaluateSeparatorAfter(e, t) {
    const n = lt(e.getText(), !0);
    switch (n.setPosition(t), n.scan()) {
      case 5:
      case 2:
      case 4:
      case 17:
        return "";
      default:
        return ",";
    }
  }
  findItemAtOffset(e, t, n) {
    const r = lt(t.getText(), !0), i = e.items;
    for (let s = i.length - 1; s >= 0; s--) {
      const a = i[s];
      if (n > a.offset + a.length)
        return r.setPosition(a.offset + a.length), r.scan() === 5 && n >= r.getTokenOffset() + r.getTokenLength() ? s + 1 : s;
      if (n >= a.offset)
        return s;
    }
    return 0;
  }
  isInComment(e, t, n) {
    const r = lt(e.getText(), !1);
    r.setPosition(t);
    let i = r.scan();
    for (; i !== 17 && r.getTokenOffset() + r.getTokenLength() < n; )
      i = r.scan();
    return (i === 12 || i === 13) && r.getTokenOffset() <= n;
  }
  fromMarkup(e) {
    if (e && this.doesSupportMarkdown())
      return {
        kind: ct.Markdown,
        value: e
      };
  }
  doesSupportMarkdown() {
    var e, t, n;
    if (!ke(this.supportsMarkdown)) {
      const r = (n = (t = (e = this.clientCapabilities.textDocument) == null ? void 0 : e.completion) == null ? void 0 : t.completionItem) == null ? void 0 : n.documentationFormat;
      this.supportsMarkdown = Array.isArray(r) && r.indexOf(ct.Markdown) !== -1;
    }
    return this.supportsMarkdown;
  }
  doesSupportsCommitCharacters() {
    var e, t, n;
    return ke(this.supportsCommitCharacters) || (this.labelDetailsSupport = (n = (t = (e = this.clientCapabilities.textDocument) == null ? void 0 : e.completion) == null ? void 0 : t.completionItem) == null ? void 0 : n.commitCharactersSupport), this.supportsCommitCharacters;
  }
  doesSupportsLabelDetails() {
    var e, t, n;
    return ke(this.labelDetailsSupport) || (this.labelDetailsSupport = (n = (t = (e = this.clientCapabilities.textDocument) == null ? void 0 : e.completion) == null ? void 0 : t.completionItem) == null ? void 0 : n.labelDetailsSupport), this.labelDetailsSupport;
  }
}, Nc = class {
  constructor(e, t = [], n) {
    this.schemaService = e, this.contributions = t, this.promise = n || Promise;
  }
  doHover(e, t, n) {
    const r = e.offsetAt(t);
    let i = n.getNodeFromOffset(r);
    if (!i || (i.type === "object" || i.type === "array") && r > i.offset + 1 && r < i.offset + i.length - 1)
      return this.promise.resolve(null);
    const s = i;
    if (i.type === "string") {
      const u = i.parent;
      if (u && u.type === "property" && u.keyNode === i && (i = u.valueNode, !i))
        return this.promise.resolve(null);
    }
    const a = q.create(e.positionAt(s.offset), e.positionAt(s.offset + s.length)), l = (u) => ({
      contents: u,
      range: a
    }), o = Qr(i);
    for (let u = this.contributions.length - 1; u >= 0; u--) {
      const c = this.contributions[u].getInfoContribution(e.uri, o);
      if (c)
        return c.then((d) => l(d));
    }
    return this.schemaService.getSchemaForResource(e.uri, n).then((u) => {
      if (u && i) {
        const h = n.getMatchingSchemas(u.schema, i.offset);
        let c, d, m, g;
        h.every((x) => {
          if (x.node === i && !x.inverted && x.schema && (c = c || x.schema.title, d = d || x.schema.markdownDescription || sr(x.schema.description), x.schema.enum)) {
            const w = x.schema.enum.indexOf(ut(i));
            x.schema.markdownEnumDescriptions ? m = x.schema.markdownEnumDescriptions[w] : x.schema.enumDescriptions && (m = sr(x.schema.enumDescriptions[w])), m && (g = x.schema.enum[w], typeof g != "string" && (g = JSON.stringify(g)));
          }
          return !0;
        });
        let p = "";
        return c && (p = sr(c)), d && (p.length > 0 && (p += `

`), p += d), m && (p.length > 0 && (p += `

`), p += `\`${Sc(g)}\`: ${m}`), l([p]);
      }
      return null;
    });
  }
};
function sr(e) {
  if (e)
    return e.replace(/([^\n\r])(\r?\n)([^\n\r])/gm, `$1

$3`).replace(/[\\`*_{}[\]()#+\-.!]/g, "\\$&");
}
function Sc(e) {
  return e.indexOf("`") !== -1 ? "`` " + e + " ``" : e;
}
var Ac = class {
  constructor(e, t) {
    this.jsonSchemaService = e, this.promise = t, this.validationEnabled = !0;
  }
  configure(e) {
    e && (this.validationEnabled = e.validate !== !1, this.commentSeverity = e.allowComments ? void 0 : ye.Error);
  }
  doValidation(e, t, n, r) {
    if (!this.validationEnabled)
      return this.promise.resolve([]);
    const i = [], s = {}, a = (o) => {
      const u = o.range.start.line + " " + o.range.start.character + " " + o.message;
      s[u] || (s[u] = !0, i.push(o));
    }, l = (o) => {
      let u = n != null && n.trailingCommas ? fn(n.trailingCommas) : ye.Error, h = n != null && n.comments ? fn(n.comments) : this.commentSeverity, c = n != null && n.schemaValidation ? fn(n.schemaValidation) : ye.Warning, d = n != null && n.schemaRequest ? fn(n.schemaRequest) : ye.Warning;
      if (o) {
        const m = (g, p) => {
          if (t.root && d) {
            const x = t.root, w = x.type === "object" ? x.properties[0] : void 0;
            if (w && w.keyNode.value === "$schema") {
              const L = w.valueNode || w, v = q.create(e.positionAt(L.offset), e.positionAt(L.offset + L.length));
              a(je.create(v, g, d, p));
            } else {
              const L = q.create(e.positionAt(x.offset), e.positionAt(x.offset + 1));
              a(je.create(L, g, d, p));
            }
          }
        };
        if (o.errors.length)
          m(o.errors[0], H.SchemaResolveError);
        else if (c) {
          for (const p of o.warnings)
            m(p, H.SchemaUnsupportedFeature);
          const g = t.validate(e, o.schema, c, n == null ? void 0 : n.schemaDraft);
          g && g.forEach(a);
        }
        Ja(o.schema) && (h = void 0), Xa(o.schema) && (u = void 0);
      }
      for (const m of t.syntaxErrors) {
        if (m.code === H.TrailingComma) {
          if (typeof u != "number")
            continue;
          m.severity = u;
        }
        a(m);
      }
      if (typeof h == "number") {
        const m = E("Comments are not permitted in JSON.");
        t.comments.forEach((g) => {
          a(je.create(g, m, h, H.CommentNotPermitted));
        });
      }
      return i;
    };
    if (r) {
      const o = r.id || "schemaservice://untitled/" + kc++;
      return this.jsonSchemaService.registerExternalSchema({ uri: o, schema: r }).getResolvedSchema().then((h) => l(h));
    }
    return this.jsonSchemaService.getSchemaForResource(e.uri, t).then((o) => l(o));
  }
  getLanguageStatus(e, t) {
    return { schemas: this.jsonSchemaService.getSchemaURIsForResource(e.uri, t) };
  }
}, kc = 0;
function Ja(e) {
  if (e && typeof e == "object") {
    if (Ve(e.allowComments))
      return e.allowComments;
    if (e.allOf)
      for (const t of e.allOf) {
        const n = Ja(t);
        if (Ve(n))
          return n;
      }
  }
}
function Xa(e) {
  if (e && typeof e == "object") {
    if (Ve(e.allowTrailingCommas))
      return e.allowTrailingCommas;
    const t = e;
    if (Ve(t.allowsTrailingCommas))
      return t.allowsTrailingCommas;
    if (e.allOf)
      for (const n of e.allOf) {
        const r = Xa(n);
        if (Ve(r))
          return r;
      }
  }
}
function fn(e) {
  switch (e) {
    case "error":
      return ye.Error;
    case "warning":
      return ye.Warning;
    case "ignore":
      return;
  }
}
var ua = 48, Rc = 57, Ec = 65, hn = 97, Mc = 102;
function ne(e) {
  return e < ua ? 0 : e <= Rc ? e - ua : (e < hn && (e += hn - Ec), e >= hn && e <= Mc ? e - hn + 10 : 0);
}
function Cc(e) {
  if (e[0] === "#")
    switch (e.length) {
      case 4:
        return {
          red: ne(e.charCodeAt(1)) * 17 / 255,
          green: ne(e.charCodeAt(2)) * 17 / 255,
          blue: ne(e.charCodeAt(3)) * 17 / 255,
          alpha: 1
        };
      case 5:
        return {
          red: ne(e.charCodeAt(1)) * 17 / 255,
          green: ne(e.charCodeAt(2)) * 17 / 255,
          blue: ne(e.charCodeAt(3)) * 17 / 255,
          alpha: ne(e.charCodeAt(4)) * 17 / 255
        };
      case 7:
        return {
          red: (ne(e.charCodeAt(1)) * 16 + ne(e.charCodeAt(2))) / 255,
          green: (ne(e.charCodeAt(3)) * 16 + ne(e.charCodeAt(4))) / 255,
          blue: (ne(e.charCodeAt(5)) * 16 + ne(e.charCodeAt(6))) / 255,
          alpha: 1
        };
      case 9:
        return {
          red: (ne(e.charCodeAt(1)) * 16 + ne(e.charCodeAt(2))) / 255,
          green: (ne(e.charCodeAt(3)) * 16 + ne(e.charCodeAt(4))) / 255,
          blue: (ne(e.charCodeAt(5)) * 16 + ne(e.charCodeAt(6))) / 255,
          alpha: (ne(e.charCodeAt(7)) * 16 + ne(e.charCodeAt(8))) / 255
        };
    }
}
var Tc = class {
  constructor(e) {
    this.schemaService = e;
  }
  findDocumentSymbols(e, t, n = { resultLimit: Number.MAX_VALUE }) {
    const r = t.root;
    if (!r)
      return [];
    let i = n.resultLimit || Number.MAX_VALUE;
    const s = e.uri;
    if ((s === "vscode://defaultsettings/keybindings.json" || rn(s.toLowerCase(), "/user/keybindings.json")) && r.type === "array") {
      const c = [];
      for (const d of r.items)
        if (d.type === "object") {
          for (const m of d.properties)
            if (m.keyNode.value === "key" && m.valueNode) {
              const g = It.create(e.uri, Je(e, d));
              if (c.push({ name: ca(m.valueNode), kind: Te.Function, location: g }), i--, i <= 0)
                return n && n.onResultLimitExceeded && n.onResultLimitExceeded(s), c;
            }
        }
      return c;
    }
    const a = [
      { node: r, containerName: "" }
    ];
    let l = 0, o = !1;
    const u = [], h = (c, d) => {
      c.type === "array" ? c.items.forEach((m) => {
        m && a.push({ node: m, containerName: d });
      }) : c.type === "object" && c.properties.forEach((m) => {
        const g = m.valueNode;
        if (g)
          if (i > 0) {
            i--;
            const p = It.create(e.uri, Je(e, m)), x = d ? d + "." + m.keyNode.value : m.keyNode.value;
            u.push({ name: this.getKeyLabel(m), kind: this.getSymbolKind(g.type), location: p, containerName: d }), a.push({ node: g, containerName: x });
          } else
            o = !0;
      });
    };
    for (; l < a.length; ) {
      const c = a[l++];
      h(c.node, c.containerName);
    }
    return o && n && n.onResultLimitExceeded && n.onResultLimitExceeded(s), u;
  }
  findDocumentSymbols2(e, t, n = { resultLimit: Number.MAX_VALUE }) {
    const r = t.root;
    if (!r)
      return [];
    let i = n.resultLimit || Number.MAX_VALUE;
    const s = e.uri;
    if ((s === "vscode://defaultsettings/keybindings.json" || rn(s.toLowerCase(), "/user/keybindings.json")) && r.type === "array") {
      const c = [];
      for (const d of r.items)
        if (d.type === "object") {
          for (const m of d.properties)
            if (m.keyNode.value === "key" && m.valueNode) {
              const g = Je(e, d), p = Je(e, m.keyNode);
              if (c.push({ name: ca(m.valueNode), kind: Te.Function, range: g, selectionRange: p }), i--, i <= 0)
                return n && n.onResultLimitExceeded && n.onResultLimitExceeded(s), c;
            }
        }
      return c;
    }
    const a = [], l = [
      { node: r, result: a }
    ];
    let o = 0, u = !1;
    const h = (c, d) => {
      c.type === "array" ? c.items.forEach((m, g) => {
        if (m)
          if (i > 0) {
            i--;
            const p = Je(e, m), x = p, L = { name: String(g), kind: this.getSymbolKind(m.type), range: p, selectionRange: x, children: [] };
            d.push(L), l.push({ result: L.children, node: m });
          } else
            u = !0;
      }) : c.type === "object" && c.properties.forEach((m) => {
        const g = m.valueNode;
        if (g)
          if (i > 0) {
            i--;
            const p = Je(e, m), x = Je(e, m.keyNode), w = [], L = { name: this.getKeyLabel(m), kind: this.getSymbolKind(g.type), range: p, selectionRange: x, children: w, detail: this.getDetail(g) };
            d.push(L), l.push({ result: w, node: g });
          } else
            u = !0;
      });
    };
    for (; o < l.length; ) {
      const c = l[o++];
      h(c.node, c.result);
    }
    return u && n && n.onResultLimitExceeded && n.onResultLimitExceeded(s), a;
  }
  getSymbolKind(e) {
    switch (e) {
      case "object":
        return Te.Module;
      case "string":
        return Te.String;
      case "number":
        return Te.Number;
      case "array":
        return Te.Array;
      case "boolean":
        return Te.Boolean;
      default:
        return Te.Variable;
    }
  }
  getKeyLabel(e) {
    let t = e.keyNode.value;
    return t && (t = t.replace(/[\n]/g, "↵")), t && t.trim() ? t : `"${t}"`;
  }
  getDetail(e) {
    if (e) {
      if (e.type === "boolean" || e.type === "number" || e.type === "null" || e.type === "string")
        return String(e.value);
      if (e.type === "array")
        return e.children.length ? void 0 : "[]";
      if (e.type === "object")
        return e.children.length ? void 0 : "{}";
    }
  }
  findDocumentColors(e, t, n) {
    return this.schemaService.getSchemaForResource(e.uri, t).then((r) => {
      const i = [];
      if (r) {
        let s = n && typeof n.resultLimit == "number" ? n.resultLimit : Number.MAX_VALUE;
        const a = t.getMatchingSchemas(r.schema), l = {};
        for (const o of a)
          if (!o.inverted && o.schema && (o.schema.format === "color" || o.schema.format === "color-hex") && o.node && o.node.type === "string") {
            const u = String(o.node.offset);
            if (!l[u]) {
              const h = Cc(ut(o.node));
              if (h) {
                const c = Je(e, o.node);
                i.push({ color: h, range: c });
              }
              if (l[u] = !0, s--, s <= 0)
                return n && n.onResultLimitExceeded && n.onResultLimitExceeded(e.uri), i;
            }
          }
      }
      return i;
    });
  }
  getColorPresentations(e, t, n, r) {
    const i = [], s = Math.round(n.red * 255), a = Math.round(n.green * 255), l = Math.round(n.blue * 255);
    function o(h) {
      const c = h.toString(16);
      return c.length !== 2 ? "0" + c : c;
    }
    let u;
    return n.alpha === 1 ? u = `#${o(s)}${o(a)}${o(l)}` : u = `#${o(s)}${o(a)}${o(l)}${o(Math.round(n.alpha * 255))}`, i.push({ label: u, textEdit: Oe.replace(r, JSON.stringify(u)) }), i;
  }
};
function Je(e, t) {
  return q.create(e.positionAt(t.offset), e.positionAt(t.offset + t.length));
}
function ca(e) {
  return ut(e) || E("<empty>");
}
var Zr = {
  schemaAssociations: [],
  schemas: {
    // bundle the schema-schema to include (localized) descriptions
    "http://json-schema.org/draft-04/schema#": {
      $schema: "http://json-schema.org/draft-04/schema#",
      definitions: {
        schemaArray: {
          type: "array",
          minItems: 1,
          items: {
            $ref: "#"
          }
        },
        positiveInteger: {
          type: "integer",
          minimum: 0
        },
        positiveIntegerDefault0: {
          allOf: [
            {
              $ref: "#/definitions/positiveInteger"
            },
            {
              default: 0
            }
          ]
        },
        simpleTypes: {
          type: "string",
          enum: [
            "array",
            "boolean",
            "integer",
            "null",
            "number",
            "object",
            "string"
          ]
        },
        stringArray: {
          type: "array",
          items: {
            type: "string"
          },
          minItems: 1,
          uniqueItems: !0
        }
      },
      type: "object",
      properties: {
        id: {
          type: "string",
          format: "uri"
        },
        $schema: {
          type: "string",
          format: "uri"
        },
        title: {
          type: "string"
        },
        description: {
          type: "string"
        },
        default: {},
        multipleOf: {
          type: "number",
          minimum: 0,
          exclusiveMinimum: !0
        },
        maximum: {
          type: "number"
        },
        exclusiveMaximum: {
          type: "boolean",
          default: !1
        },
        minimum: {
          type: "number"
        },
        exclusiveMinimum: {
          type: "boolean",
          default: !1
        },
        maxLength: {
          allOf: [
            {
              $ref: "#/definitions/positiveInteger"
            }
          ]
        },
        minLength: {
          allOf: [
            {
              $ref: "#/definitions/positiveIntegerDefault0"
            }
          ]
        },
        pattern: {
          type: "string",
          format: "regex"
        },
        additionalItems: {
          anyOf: [
            {
              type: "boolean"
            },
            {
              $ref: "#"
            }
          ],
          default: {}
        },
        items: {
          anyOf: [
            {
              $ref: "#"
            },
            {
              $ref: "#/definitions/schemaArray"
            }
          ],
          default: {}
        },
        maxItems: {
          allOf: [
            {
              $ref: "#/definitions/positiveInteger"
            }
          ]
        },
        minItems: {
          allOf: [
            {
              $ref: "#/definitions/positiveIntegerDefault0"
            }
          ]
        },
        uniqueItems: {
          type: "boolean",
          default: !1
        },
        maxProperties: {
          allOf: [
            {
              $ref: "#/definitions/positiveInteger"
            }
          ]
        },
        minProperties: {
          allOf: [
            {
              $ref: "#/definitions/positiveIntegerDefault0"
            }
          ]
        },
        required: {
          allOf: [
            {
              $ref: "#/definitions/stringArray"
            }
          ]
        },
        additionalProperties: {
          anyOf: [
            {
              type: "boolean"
            },
            {
              $ref: "#"
            }
          ],
          default: {}
        },
        definitions: {
          type: "object",
          additionalProperties: {
            $ref: "#"
          },
          default: {}
        },
        properties: {
          type: "object",
          additionalProperties: {
            $ref: "#"
          },
          default: {}
        },
        patternProperties: {
          type: "object",
          additionalProperties: {
            $ref: "#"
          },
          default: {}
        },
        dependencies: {
          type: "object",
          additionalProperties: {
            anyOf: [
              {
                $ref: "#"
              },
              {
                $ref: "#/definitions/stringArray"
              }
            ]
          }
        },
        enum: {
          type: "array",
          minItems: 1,
          uniqueItems: !0
        },
        type: {
          anyOf: [
            {
              $ref: "#/definitions/simpleTypes"
            },
            {
              type: "array",
              items: {
                $ref: "#/definitions/simpleTypes"
              },
              minItems: 1,
              uniqueItems: !0
            }
          ]
        },
        format: {
          anyOf: [
            {
              type: "string",
              enum: [
                "date-time",
                "uri",
                "email",
                "hostname",
                "ipv4",
                "ipv6",
                "regex"
              ]
            },
            {
              type: "string"
            }
          ]
        },
        allOf: {
          allOf: [
            {
              $ref: "#/definitions/schemaArray"
            }
          ]
        },
        anyOf: {
          allOf: [
            {
              $ref: "#/definitions/schemaArray"
            }
          ]
        },
        oneOf: {
          allOf: [
            {
              $ref: "#/definitions/schemaArray"
            }
          ]
        },
        not: {
          allOf: [
            {
              $ref: "#"
            }
          ]
        }
      },
      dependencies: {
        exclusiveMaximum: [
          "maximum"
        ],
        exclusiveMinimum: [
          "minimum"
        ]
      },
      default: {}
    },
    "http://json-schema.org/draft-07/schema#": {
      definitions: {
        schemaArray: {
          type: "array",
          minItems: 1,
          items: { $ref: "#" }
        },
        nonNegativeInteger: {
          type: "integer",
          minimum: 0
        },
        nonNegativeIntegerDefault0: {
          allOf: [
            { $ref: "#/definitions/nonNegativeInteger" },
            { default: 0 }
          ]
        },
        simpleTypes: {
          enum: [
            "array",
            "boolean",
            "integer",
            "null",
            "number",
            "object",
            "string"
          ]
        },
        stringArray: {
          type: "array",
          items: { type: "string" },
          uniqueItems: !0,
          default: []
        }
      },
      type: ["object", "boolean"],
      properties: {
        $id: {
          type: "string",
          format: "uri-reference"
        },
        $schema: {
          type: "string",
          format: "uri"
        },
        $ref: {
          type: "string",
          format: "uri-reference"
        },
        $comment: {
          type: "string"
        },
        title: {
          type: "string"
        },
        description: {
          type: "string"
        },
        default: !0,
        readOnly: {
          type: "boolean",
          default: !1
        },
        examples: {
          type: "array",
          items: !0
        },
        multipleOf: {
          type: "number",
          exclusiveMinimum: 0
        },
        maximum: {
          type: "number"
        },
        exclusiveMaximum: {
          type: "number"
        },
        minimum: {
          type: "number"
        },
        exclusiveMinimum: {
          type: "number"
        },
        maxLength: { $ref: "#/definitions/nonNegativeInteger" },
        minLength: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
        pattern: {
          type: "string",
          format: "regex"
        },
        additionalItems: { $ref: "#" },
        items: {
          anyOf: [
            { $ref: "#" },
            { $ref: "#/definitions/schemaArray" }
          ],
          default: !0
        },
        maxItems: { $ref: "#/definitions/nonNegativeInteger" },
        minItems: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
        uniqueItems: {
          type: "boolean",
          default: !1
        },
        contains: { $ref: "#" },
        maxProperties: { $ref: "#/definitions/nonNegativeInteger" },
        minProperties: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
        required: { $ref: "#/definitions/stringArray" },
        additionalProperties: { $ref: "#" },
        definitions: {
          type: "object",
          additionalProperties: { $ref: "#" },
          default: {}
        },
        properties: {
          type: "object",
          additionalProperties: { $ref: "#" },
          default: {}
        },
        patternProperties: {
          type: "object",
          additionalProperties: { $ref: "#" },
          propertyNames: { format: "regex" },
          default: {}
        },
        dependencies: {
          type: "object",
          additionalProperties: {
            anyOf: [
              { $ref: "#" },
              { $ref: "#/definitions/stringArray" }
            ]
          }
        },
        propertyNames: { $ref: "#" },
        const: !0,
        enum: {
          type: "array",
          items: !0,
          minItems: 1,
          uniqueItems: !0
        },
        type: {
          anyOf: [
            { $ref: "#/definitions/simpleTypes" },
            {
              type: "array",
              items: { $ref: "#/definitions/simpleTypes" },
              minItems: 1,
              uniqueItems: !0
            }
          ]
        },
        format: { type: "string" },
        contentMediaType: { type: "string" },
        contentEncoding: { type: "string" },
        if: { $ref: "#" },
        then: { $ref: "#" },
        else: { $ref: "#" },
        allOf: { $ref: "#/definitions/schemaArray" },
        anyOf: { $ref: "#/definitions/schemaArray" },
        oneOf: { $ref: "#/definitions/schemaArray" },
        not: { $ref: "#" }
      },
      default: !0
    }
  }
}, Pc = {
  id: E("A unique identifier for the schema."),
  $schema: E("The schema to verify this document against."),
  title: E("A descriptive title of the element."),
  description: E("A long description of the element. Used in hover menus and suggestions."),
  default: E("A default value. Used by suggestions."),
  multipleOf: E("A number that should cleanly divide the current value (i.e. have no remainder)."),
  maximum: E("The maximum numerical value, inclusive by default."),
  exclusiveMaximum: E("Makes the maximum property exclusive."),
  minimum: E("The minimum numerical value, inclusive by default."),
  exclusiveMinimum: E("Makes the minimum property exclusive."),
  maxLength: E("The maximum length of a string."),
  minLength: E("The minimum length of a string."),
  pattern: E("A regular expression to match the string against. It is not implicitly anchored."),
  additionalItems: E("For arrays, only when items is set as an array. If it is a schema, then this schema validates items after the ones specified by the items array. If it is false, then additional items will cause validation to fail."),
  items: E("For arrays. Can either be a schema to validate every element against or an array of schemas to validate each item against in order (the first schema will validate the first element, the second schema will validate the second element, and so on."),
  maxItems: E("The maximum number of items that can be inside an array. Inclusive."),
  minItems: E("The minimum number of items that can be inside an array. Inclusive."),
  uniqueItems: E("If all of the items in the array must be unique. Defaults to false."),
  maxProperties: E("The maximum number of properties an object can have. Inclusive."),
  minProperties: E("The minimum number of properties an object can have. Inclusive."),
  required: E("An array of strings that lists the names of all properties required on this object."),
  additionalProperties: E("Either a schema or a boolean. If a schema, then used to validate all properties not matched by 'properties' or 'patternProperties'. If false, then any properties not matched by either will cause this schema to fail."),
  definitions: E("Not used for validation. Place subschemas here that you wish to reference inline with $ref."),
  properties: E("A map of property names to schemas for each property."),
  patternProperties: E("A map of regular expressions on property names to schemas for matching properties."),
  dependencies: E("A map of property names to either an array of property names or a schema. An array of property names means the property named in the key depends on the properties in the array being present in the object in order to be valid. If the value is a schema, then the schema is only applied to the object if the property in the key exists on the object."),
  enum: E("The set of literal values that are valid."),
  type: E("Either a string of one of the basic schema types (number, integer, null, array, object, boolean, string) or an array of strings specifying a subset of those types."),
  format: E("Describes the format expected for the value."),
  allOf: E("An array of schemas, all of which must match."),
  anyOf: E("An array of schemas, where at least one must match."),
  oneOf: E("An array of schemas, exactly one of which must match."),
  not: E("A schema which must not match."),
  $id: E("A unique identifier for the schema."),
  $ref: E("Reference a definition hosted on any location."),
  $comment: E("Comments from schema authors to readers or maintainers of the schema."),
  readOnly: E("Indicates that the value of the instance is managed exclusively by the owning authority."),
  examples: E("Sample JSON values associated with a particular schema, for the purpose of illustrating usage."),
  contains: E('An array instance is valid against "contains" if at least one of its elements is valid against the given schema.'),
  propertyNames: E("If the instance is an object, this keyword validates if every property name in the instance validates against the provided schema."),
  const: E("An instance validates successfully against this keyword if its value is equal to the value of the keyword."),
  contentMediaType: E("Describes the media type of a string property."),
  contentEncoding: E("Describes the content encoding of a string property."),
  if: E('The validation outcome of the "if" subschema controls which of the "then" or "else" keywords are evaluated.'),
  then: E('The "if" subschema is used for validation when the "if" subschema succeeds.'),
  else: E('The "else" subschema is used for validation when the "if" subschema fails.')
};
for (const e in Zr.schemas) {
  const t = Zr.schemas[e];
  for (const n in t.properties) {
    let r = t.properties[n];
    typeof r == "boolean" && (r = t.properties[n] = {});
    const i = Pc[n];
    i && (r.description = i);
  }
}
var Qa;
(() => {
  var e = { 470: (i) => {
    function s(o) {
      if (typeof o != "string")
        throw new TypeError("Path must be a string. Received " + JSON.stringify(o));
    }
    function a(o, u) {
      for (var h, c = "", d = 0, m = -1, g = 0, p = 0; p <= o.length; ++p) {
        if (p < o.length)
          h = o.charCodeAt(p);
        else {
          if (h === 47)
            break;
          h = 47;
        }
        if (h === 47) {
          if (!(m === p - 1 || g === 1))
            if (m !== p - 1 && g === 2) {
              if (c.length < 2 || d !== 2 || c.charCodeAt(c.length - 1) !== 46 || c.charCodeAt(c.length - 2) !== 46) {
                if (c.length > 2) {
                  var x = c.lastIndexOf("/");
                  if (x !== c.length - 1) {
                    x === -1 ? (c = "", d = 0) : d = (c = c.slice(0, x)).length - 1 - c.lastIndexOf("/"), m = p, g = 0;
                    continue;
                  }
                } else if (c.length === 2 || c.length === 1) {
                  c = "", d = 0, m = p, g = 0;
                  continue;
                }
              }
              u && (c.length > 0 ? c += "/.." : c = "..", d = 2);
            } else
              c.length > 0 ? c += "/" + o.slice(m + 1, p) : c = o.slice(m + 1, p), d = p - m - 1;
          m = p, g = 0;
        } else
          h === 46 && g !== -1 ? ++g : g = -1;
      }
      return c;
    }
    var l = { resolve: function() {
      for (var o, u = "", h = !1, c = arguments.length - 1; c >= -1 && !h; c--) {
        var d;
        c >= 0 ? d = arguments[c] : (o === void 0 && (o = process.cwd()), d = o), s(d), d.length !== 0 && (u = d + "/" + u, h = d.charCodeAt(0) === 47);
      }
      return u = a(u, !h), h ? u.length > 0 ? "/" + u : "/" : u.length > 0 ? u : ".";
    }, normalize: function(o) {
      if (s(o), o.length === 0)
        return ".";
      var u = o.charCodeAt(0) === 47, h = o.charCodeAt(o.length - 1) === 47;
      return (o = a(o, !u)).length !== 0 || u || (o = "."), o.length > 0 && h && (o += "/"), u ? "/" + o : o;
    }, isAbsolute: function(o) {
      return s(o), o.length > 0 && o.charCodeAt(0) === 47;
    }, join: function() {
      if (arguments.length === 0)
        return ".";
      for (var o, u = 0; u < arguments.length; ++u) {
        var h = arguments[u];
        s(h), h.length > 0 && (o === void 0 ? o = h : o += "/" + h);
      }
      return o === void 0 ? "." : l.normalize(o);
    }, relative: function(o, u) {
      if (s(o), s(u), o === u || (o = l.resolve(o)) === (u = l.resolve(u)))
        return "";
      for (var h = 1; h < o.length && o.charCodeAt(h) === 47; ++h)
        ;
      for (var c = o.length, d = c - h, m = 1; m < u.length && u.charCodeAt(m) === 47; ++m)
        ;
      for (var g = u.length - m, p = d < g ? d : g, x = -1, w = 0; w <= p; ++w) {
        if (w === p) {
          if (g > p) {
            if (u.charCodeAt(m + w) === 47)
              return u.slice(m + w + 1);
            if (w === 0)
              return u.slice(m + w);
          } else
            d > p && (o.charCodeAt(h + w) === 47 ? x = w : w === 0 && (x = 0));
          break;
        }
        var L = o.charCodeAt(h + w);
        if (L !== u.charCodeAt(m + w))
          break;
        L === 47 && (x = w);
      }
      var v = "";
      for (w = h + x + 1; w <= c; ++w)
        w !== c && o.charCodeAt(w) !== 47 || (v.length === 0 ? v += ".." : v += "/..");
      return v.length > 0 ? v + u.slice(m + x) : (m += x, u.charCodeAt(m) === 47 && ++m, u.slice(m));
    }, _makeLong: function(o) {
      return o;
    }, dirname: function(o) {
      if (s(o), o.length === 0)
        return ".";
      for (var u = o.charCodeAt(0), h = u === 47, c = -1, d = !0, m = o.length - 1; m >= 1; --m)
        if ((u = o.charCodeAt(m)) === 47) {
          if (!d) {
            c = m;
            break;
          }
        } else
          d = !1;
      return c === -1 ? h ? "/" : "." : h && c === 1 ? "//" : o.slice(0, c);
    }, basename: function(o, u) {
      if (u !== void 0 && typeof u != "string")
        throw new TypeError('"ext" argument must be a string');
      s(o);
      var h, c = 0, d = -1, m = !0;
      if (u !== void 0 && u.length > 0 && u.length <= o.length) {
        if (u.length === o.length && u === o)
          return "";
        var g = u.length - 1, p = -1;
        for (h = o.length - 1; h >= 0; --h) {
          var x = o.charCodeAt(h);
          if (x === 47) {
            if (!m) {
              c = h + 1;
              break;
            }
          } else
            p === -1 && (m = !1, p = h + 1), g >= 0 && (x === u.charCodeAt(g) ? --g == -1 && (d = h) : (g = -1, d = p));
        }
        return c === d ? d = p : d === -1 && (d = o.length), o.slice(c, d);
      }
      for (h = o.length - 1; h >= 0; --h)
        if (o.charCodeAt(h) === 47) {
          if (!m) {
            c = h + 1;
            break;
          }
        } else
          d === -1 && (m = !1, d = h + 1);
      return d === -1 ? "" : o.slice(c, d);
    }, extname: function(o) {
      s(o);
      for (var u = -1, h = 0, c = -1, d = !0, m = 0, g = o.length - 1; g >= 0; --g) {
        var p = o.charCodeAt(g);
        if (p !== 47)
          c === -1 && (d = !1, c = g + 1), p === 46 ? u === -1 ? u = g : m !== 1 && (m = 1) : u !== -1 && (m = -1);
        else if (!d) {
          h = g + 1;
          break;
        }
      }
      return u === -1 || c === -1 || m === 0 || m === 1 && u === c - 1 && u === h + 1 ? "" : o.slice(u, c);
    }, format: function(o) {
      if (o === null || typeof o != "object")
        throw new TypeError('The "pathObject" argument must be of type Object. Received type ' + typeof o);
      return function(u, h) {
        var c = h.dir || h.root, d = h.base || (h.name || "") + (h.ext || "");
        return c ? c === h.root ? c + d : c + "/" + d : d;
      }(0, o);
    }, parse: function(o) {
      s(o);
      var u = { root: "", dir: "", base: "", ext: "", name: "" };
      if (o.length === 0)
        return u;
      var h, c = o.charCodeAt(0), d = c === 47;
      d ? (u.root = "/", h = 1) : h = 0;
      for (var m = -1, g = 0, p = -1, x = !0, w = o.length - 1, L = 0; w >= h; --w)
        if ((c = o.charCodeAt(w)) !== 47)
          p === -1 && (x = !1, p = w + 1), c === 46 ? m === -1 ? m = w : L !== 1 && (L = 1) : m !== -1 && (L = -1);
        else if (!x) {
          g = w + 1;
          break;
        }
      return m === -1 || p === -1 || L === 0 || L === 1 && m === p - 1 && m === g + 1 ? p !== -1 && (u.base = u.name = g === 0 && d ? o.slice(1, p) : o.slice(g, p)) : (g === 0 && d ? (u.name = o.slice(1, m), u.base = o.slice(1, p)) : (u.name = o.slice(g, m), u.base = o.slice(g, p)), u.ext = o.slice(m, p)), g > 0 ? u.dir = o.slice(0, g - 1) : d && (u.dir = "/"), u;
    }, sep: "/", delimiter: ":", win32: null, posix: null };
    l.posix = l, i.exports = l;
  } }, t = {};
  function n(i) {
    var s = t[i];
    if (s !== void 0)
      return s.exports;
    var a = t[i] = { exports: {} };
    return e[i](a, a.exports, n), a.exports;
  }
  n.d = (i, s) => {
    for (var a in s)
      n.o(s, a) && !n.o(i, a) && Object.defineProperty(i, a, { enumerable: !0, get: s[a] });
  }, n.o = (i, s) => Object.prototype.hasOwnProperty.call(i, s), n.r = (i) => {
    typeof Symbol < "u" && Symbol.toStringTag && Object.defineProperty(i, Symbol.toStringTag, { value: "Module" }), Object.defineProperty(i, "__esModule", { value: !0 });
  };
  var r = {};
  (() => {
    let i;
    n.r(r), n.d(r, { URI: () => d, Utils: () => O }), typeof process == "object" ? i = process.platform === "win32" : typeof navigator == "object" && (i = navigator.userAgent.indexOf("Windows") >= 0);
    const s = /^\w[\w\d+.-]*$/, a = /^\//, l = /^\/\//;
    function o(M, N) {
      if (!M.scheme && N)
        throw new Error(`[UriError]: Scheme is missing: {scheme: "", authority: "${M.authority}", path: "${M.path}", query: "${M.query}", fragment: "${M.fragment}"}`);
      if (M.scheme && !s.test(M.scheme))
        throw new Error("[UriError]: Scheme contains illegal characters.");
      if (M.path) {
        if (M.authority) {
          if (!a.test(M.path))
            throw new Error('[UriError]: If a URI contains an authority component, then the path component must either be empty or begin with a slash ("/") character');
        } else if (l.test(M.path))
          throw new Error('[UriError]: If a URI does not contain an authority component, then the path cannot begin with two slash characters ("//")');
      }
    }
    const u = "", h = "/", c = /^(([^:/?#]+?):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/;
    class d {
      constructor(N, S, R, I, T, P = !1) {
        He(this, "scheme");
        He(this, "authority");
        He(this, "path");
        He(this, "query");
        He(this, "fragment");
        typeof N == "object" ? (this.scheme = N.scheme || u, this.authority = N.authority || u, this.path = N.path || u, this.query = N.query || u, this.fragment = N.fragment || u) : (this.scheme = /* @__PURE__ */ function(D, $) {
          return D || $ ? D : "file";
        }(N, P), this.authority = S || u, this.path = function(D, $) {
          switch (D) {
            case "https":
            case "http":
            case "file":
              $ ? $[0] !== h && ($ = h + $) : $ = h;
          }
          return $;
        }(this.scheme, R || u), this.query = I || u, this.fragment = T || u, o(this, P));
      }
      static isUri(N) {
        return N instanceof d || !!N && typeof N.authority == "string" && typeof N.fragment == "string" && typeof N.path == "string" && typeof N.query == "string" && typeof N.scheme == "string" && typeof N.fsPath == "string" && typeof N.with == "function" && typeof N.toString == "function";
      }
      get fsPath() {
        return L(this, !1);
      }
      with(N) {
        if (!N)
          return this;
        let { scheme: S, authority: R, path: I, query: T, fragment: P } = N;
        return S === void 0 ? S = this.scheme : S === null && (S = u), R === void 0 ? R = this.authority : R === null && (R = u), I === void 0 ? I = this.path : I === null && (I = u), T === void 0 ? T = this.query : T === null && (T = u), P === void 0 ? P = this.fragment : P === null && (P = u), S === this.scheme && R === this.authority && I === this.path && T === this.query && P === this.fragment ? this : new g(S, R, I, T, P);
      }
      static parse(N, S = !1) {
        const R = c.exec(N);
        return R ? new g(R[2] || u, _(R[4] || u), _(R[5] || u), _(R[7] || u), _(R[9] || u), S) : new g(u, u, u, u, u);
      }
      static file(N) {
        let S = u;
        if (i && (N = N.replace(/\\/g, h)), N[0] === h && N[1] === h) {
          const R = N.indexOf(h, 2);
          R === -1 ? (S = N.substring(2), N = h) : (S = N.substring(2, R), N = N.substring(R) || h);
        }
        return new g("file", S, N, u, u);
      }
      static from(N) {
        const S = new g(N.scheme, N.authority, N.path, N.query, N.fragment);
        return o(S, !0), S;
      }
      toString(N = !1) {
        return v(this, N);
      }
      toJSON() {
        return this;
      }
      static revive(N) {
        if (N) {
          if (N instanceof d)
            return N;
          {
            const S = new g(N);
            return S._formatted = N.external, S._fsPath = N._sep === m ? N.fsPath : null, S;
          }
        }
        return N;
      }
    }
    const m = i ? 1 : void 0;
    class g extends d {
      constructor() {
        super(...arguments);
        He(this, "_formatted", null);
        He(this, "_fsPath", null);
      }
      get fsPath() {
        return this._fsPath || (this._fsPath = L(this, !1)), this._fsPath;
      }
      toString(S = !1) {
        return S ? v(this, !0) : (this._formatted || (this._formatted = v(this, !1)), this._formatted);
      }
      toJSON() {
        const S = { $mid: 1 };
        return this._fsPath && (S.fsPath = this._fsPath, S._sep = m), this._formatted && (S.external = this._formatted), this.path && (S.path = this.path), this.scheme && (S.scheme = this.scheme), this.authority && (S.authority = this.authority), this.query && (S.query = this.query), this.fragment && (S.fragment = this.fragment), S;
      }
    }
    const p = { 58: "%3A", 47: "%2F", 63: "%3F", 35: "%23", 91: "%5B", 93: "%5D", 64: "%40", 33: "%21", 36: "%24", 38: "%26", 39: "%27", 40: "%28", 41: "%29", 42: "%2A", 43: "%2B", 44: "%2C", 59: "%3B", 61: "%3D", 32: "%20" };
    function x(M, N, S) {
      let R, I = -1;
      for (let T = 0; T < M.length; T++) {
        const P = M.charCodeAt(T);
        if (P >= 97 && P <= 122 || P >= 65 && P <= 90 || P >= 48 && P <= 57 || P === 45 || P === 46 || P === 95 || P === 126 || N && P === 47 || S && P === 91 || S && P === 93 || S && P === 58)
          I !== -1 && (R += encodeURIComponent(M.substring(I, T)), I = -1), R !== void 0 && (R += M.charAt(T));
        else {
          R === void 0 && (R = M.substr(0, T));
          const D = p[P];
          D !== void 0 ? (I !== -1 && (R += encodeURIComponent(M.substring(I, T)), I = -1), R += D) : I === -1 && (I = T);
        }
      }
      return I !== -1 && (R += encodeURIComponent(M.substring(I))), R !== void 0 ? R : M;
    }
    function w(M) {
      let N;
      for (let S = 0; S < M.length; S++) {
        const R = M.charCodeAt(S);
        R === 35 || R === 63 ? (N === void 0 && (N = M.substr(0, S)), N += p[R]) : N !== void 0 && (N += M[S]);
      }
      return N !== void 0 ? N : M;
    }
    function L(M, N) {
      let S;
      return S = M.authority && M.path.length > 1 && M.scheme === "file" ? `//${M.authority}${M.path}` : M.path.charCodeAt(0) === 47 && (M.path.charCodeAt(1) >= 65 && M.path.charCodeAt(1) <= 90 || M.path.charCodeAt(1) >= 97 && M.path.charCodeAt(1) <= 122) && M.path.charCodeAt(2) === 58 ? N ? M.path.substr(1) : M.path[1].toLowerCase() + M.path.substr(2) : M.path, i && (S = S.replace(/\//g, "\\")), S;
    }
    function v(M, N) {
      const S = N ? w : x;
      let R = "", { scheme: I, authority: T, path: P, query: D, fragment: $ } = M;
      if (I && (R += I, R += ":"), (T || I === "file") && (R += h, R += h), T) {
        let j = T.indexOf("@");
        if (j !== -1) {
          const te = T.substr(0, j);
          T = T.substr(j + 1), j = te.lastIndexOf(":"), j === -1 ? R += S(te, !1, !1) : (R += S(te.substr(0, j), !1, !1), R += ":", R += S(te.substr(j + 1), !1, !0)), R += "@";
        }
        T = T.toLowerCase(), j = T.lastIndexOf(":"), j === -1 ? R += S(T, !1, !0) : (R += S(T.substr(0, j), !1, !0), R += T.substr(j));
      }
      if (P) {
        if (P.length >= 3 && P.charCodeAt(0) === 47 && P.charCodeAt(2) === 58) {
          const j = P.charCodeAt(1);
          j >= 65 && j <= 90 && (P = `/${String.fromCharCode(j + 32)}:${P.substr(3)}`);
        } else if (P.length >= 2 && P.charCodeAt(1) === 58) {
          const j = P.charCodeAt(0);
          j >= 65 && j <= 90 && (P = `${String.fromCharCode(j + 32)}:${P.substr(2)}`);
        }
        R += S(P, !0, !1);
      }
      return D && (R += "?", R += S(D, !1, !1)), $ && (R += "#", R += N ? $ : x($, !1, !1)), R;
    }
    function y(M) {
      try {
        return decodeURIComponent(M);
      } catch {
        return M.length > 3 ? M.substr(0, 3) + y(M.substr(3)) : M;
      }
    }
    const b = /(%[0-9A-Za-z][0-9A-Za-z])+/g;
    function _(M) {
      return M.match(b) ? M.replace(b, (N) => y(N)) : M;
    }
    var k = n(470);
    const C = k.posix || k, F = "/";
    var O;
    (function(M) {
      M.joinPath = function(N, ...S) {
        return N.with({ path: C.join(N.path, ...S) });
      }, M.resolvePath = function(N, ...S) {
        let R = N.path, I = !1;
        R[0] !== F && (R = F + R, I = !0);
        let T = C.resolve(R, ...S);
        return I && T[0] === F && !N.authority && (T = T.substring(1)), N.with({ path: T });
      }, M.dirname = function(N) {
        if (N.path.length === 0 || N.path === F)
          return N;
        let S = C.dirname(N.path);
        return S.length === 1 && S.charCodeAt(0) === 46 && (S = ""), N.with({ path: S });
      }, M.basename = function(N) {
        return C.basename(N.path);
      }, M.extname = function(N) {
        return C.extname(N.path);
      };
    })(O || (O = {}));
  })(), Qa = r;
})();
var { URI: Dt, Utils: l0 } = Qa;
function Ic(e, t) {
  if (typeof e != "string")
    throw new TypeError("Expected a string");
  const n = String(e);
  let r = "";
  const i = t ? !!t.extended : !1, s = t ? !!t.globstar : !1;
  let a = !1;
  const l = t && typeof t.flags == "string" ? t.flags : "";
  let o;
  for (let u = 0, h = n.length; u < h; u++)
    switch (o = n[u], o) {
      case "/":
      case "$":
      case "^":
      case "+":
      case ".":
      case "(":
      case ")":
      case "=":
      case "!":
      case "|":
        r += "\\" + o;
        break;
      case "?":
        if (i) {
          r += ".";
          break;
        }
      case "[":
      case "]":
        if (i) {
          r += o;
          break;
        }
      case "{":
        if (i) {
          a = !0, r += "(";
          break;
        }
      case "}":
        if (i) {
          a = !1, r += ")";
          break;
        }
      case ",":
        if (a) {
          r += "|";
          break;
        }
        r += "\\" + o;
        break;
      case "*":
        const c = n[u - 1];
        let d = 1;
        for (; n[u + 1] === "*"; )
          d++, u++;
        const m = n[u + 1];
        s ? d > 1 && (c === "/" || c === void 0 || c === "{" || c === ",") && (m === "/" || m === void 0 || m === "," || m === "}") ? (m === "/" ? u++ : c === "/" && r.endsWith("\\/") && (r = r.substr(0, r.length - 2)), r += "((?:[^/]*(?:/|$))*)") : r += "([^/]*)" : r += ".*";
        break;
      default:
        r += o;
    }
  return (!l || !~l.indexOf("g")) && (r = "^" + r + "$"), new RegExp(r, l);
}
var Fc = "!", Vc = "/", Dc = class {
  constructor(e, t, n) {
    this.folderUri = t, this.uris = n, this.globWrappers = [];
    try {
      for (let r of e) {
        const i = r[0] !== Fc;
        i || (r = r.substring(1)), r.length > 0 && (r[0] === Vc && (r = r.substring(1)), this.globWrappers.push({
          regexp: Ic("**/" + r, { extended: !0, globstar: !0 }),
          include: i
        }));
      }
      t && (t = Ya(t), t.endsWith("/") || (t = t + "/"), this.folderUri = t);
    } catch {
      this.globWrappers.length = 0, this.uris = [];
    }
  }
  matchesPattern(e) {
    if (this.folderUri && !e.startsWith(this.folderUri))
      return !1;
    let t = !1;
    for (const { regexp: n, include: r } of this.globWrappers)
      n.test(e) && (t = r);
    return t;
  }
  getURIs() {
    return this.uris;
  }
}, Oc = class {
  constructor(e, t, n) {
    this.service = e, this.uri = t, this.dependencies = /* @__PURE__ */ new Set(), this.anchors = void 0, n && (this.unresolvedSchema = this.service.promise.resolve(new Wt(n)));
  }
  getUnresolvedSchema() {
    return this.unresolvedSchema || (this.unresolvedSchema = this.service.loadSchema(this.uri)), this.unresolvedSchema;
  }
  getResolvedSchema() {
    return this.resolvedSchema || (this.resolvedSchema = this.getUnresolvedSchema().then((e) => this.service.resolveSchemaContent(e, this))), this.resolvedSchema;
  }
  clearSchema() {
    const e = !!this.unresolvedSchema;
    return this.resolvedSchema = void 0, this.unresolvedSchema = void 0, this.dependencies.clear(), this.anchors = void 0, e;
  }
}, Wt = class {
  constructor(e, t = []) {
    this.schema = e, this.errors = t;
  }
}, fa = class {
  constructor(e, t = [], n = [], r) {
    this.schema = e, this.errors = t, this.warnings = n, this.schemaDraft = r;
  }
  getSection(e) {
    const t = this.getSectionRecursive(e, this.schema);
    if (t)
      return be(t);
  }
  getSectionRecursive(e, t) {
    if (!t || typeof t == "boolean" || e.length === 0)
      return t;
    const n = e.shift();
    if (t.properties && typeof t.properties[n])
      return this.getSectionRecursive(e, t.properties[n]);
    if (t.patternProperties)
      for (const r of Object.keys(t.patternProperties)) {
        const i = Fn(r);
        if (i != null && i.test(n))
          return this.getSectionRecursive(e, t.patternProperties[r]);
      }
    else {
      if (typeof t.additionalProperties == "object")
        return this.getSectionRecursive(e, t.additionalProperties);
      if (n.match("[0-9]+")) {
        if (Array.isArray(t.items)) {
          const r = parseInt(n, 10);
          if (!isNaN(r) && t.items[r])
            return this.getSectionRecursive(e, t.items[r]);
        } else if (t.items)
          return this.getSectionRecursive(e, t.items);
      }
    }
  }
}, $c = class {
  constructor(e, t, n) {
    this.contextService = t, this.requestService = e, this.promiseConstructor = n || Promise, this.callOnDispose = [], this.contributionSchemas = {}, this.contributionAssociations = [], this.schemasById = {}, this.filePatternAssociations = [], this.registeredSchemasIds = {};
  }
  getRegisteredSchemaIds(e) {
    return Object.keys(this.registeredSchemasIds).filter((t) => {
      const n = Dt.parse(t).scheme;
      return n !== "schemaservice" && (!e || e(n));
    });
  }
  get promise() {
    return this.promiseConstructor;
  }
  dispose() {
    for (; this.callOnDispose.length > 0; )
      this.callOnDispose.pop()();
  }
  onResourceChange(e) {
    this.cachedSchemaForResource = void 0;
    let t = !1;
    e = Xe(e);
    const n = [e], r = Object.keys(this.schemasById).map((i) => this.schemasById[i]);
    for (; n.length; ) {
      const i = n.pop();
      for (let s = 0; s < r.length; s++) {
        const a = r[s];
        a && (a.uri === i || a.dependencies.has(i)) && (a.uri !== i && n.push(a.uri), a.clearSchema() && (t = !0), r[s] = void 0);
      }
    }
    return t;
  }
  setSchemaContributions(e) {
    if (e.schemas) {
      const t = e.schemas;
      for (const n in t) {
        const r = Xe(n);
        this.contributionSchemas[r] = this.addSchemaHandle(r, t[n]);
      }
    }
    if (Array.isArray(e.schemaAssociations)) {
      const t = e.schemaAssociations;
      for (let n of t) {
        const r = n.uris.map(Xe), i = this.addFilePatternAssociation(n.pattern, n.folderUri, r);
        this.contributionAssociations.push(i);
      }
    }
  }
  addSchemaHandle(e, t) {
    const n = new Oc(this, e, t);
    return this.schemasById[e] = n, n;
  }
  getOrAddSchemaHandle(e, t) {
    return this.schemasById[e] || this.addSchemaHandle(e, t);
  }
  addFilePatternAssociation(e, t, n) {
    const r = new Dc(e, t, n);
    return this.filePatternAssociations.push(r), r;
  }
  registerExternalSchema(e) {
    const t = Xe(e.uri);
    return this.registeredSchemasIds[t] = !0, this.cachedSchemaForResource = void 0, e.fileMatch && e.fileMatch.length && this.addFilePatternAssociation(e.fileMatch, e.folderUri, [t]), e.schema ? this.addSchemaHandle(t, e.schema) : this.getOrAddSchemaHandle(t);
  }
  clearExternalSchemas() {
    this.schemasById = {}, this.filePatternAssociations = [], this.registeredSchemasIds = {}, this.cachedSchemaForResource = void 0;
    for (const e in this.contributionSchemas)
      this.schemasById[e] = this.contributionSchemas[e], this.registeredSchemasIds[e] = !0;
    for (const e of this.contributionAssociations)
      this.filePatternAssociations.push(e);
  }
  getResolvedSchema(e) {
    const t = Xe(e), n = this.schemasById[t];
    return n ? n.getResolvedSchema() : this.promise.resolve(void 0);
  }
  loadSchema(e) {
    if (!this.requestService) {
      const t = E("Unable to load schema from '{0}'. No schema request service available", jt(e));
      return this.promise.resolve(new Wt({}, [t]));
    }
    return e.startsWith("http://json-schema.org/") && (e = "https" + e.substring(4)), this.requestService(e).then((t) => {
      if (!t) {
        const s = E("Unable to load schema from '{0}': No content.", jt(e));
        return new Wt({}, [s]);
      }
      const n = [];
      t.charCodeAt(0) === 65279 && (n.push(E("Problem reading content from '{0}': UTF-8 with BOM detected, only UTF 8 is allowed.", jt(e))), t = t.trimStart());
      let r = {};
      const i = [];
      return r = rc(t, i), i.length && n.push(E("Unable to parse content from '{0}': Parse error at offset {1}.", jt(e), i[0].offset)), new Wt(r, n);
    }, (t) => {
      let n = t.toString();
      const r = t.toString().split("Error: ");
      return r.length > 1 && (n = r[1]), rn(n, ".") && (n = n.substr(0, n.length - 1)), new Wt({}, [E("Unable to load schema from '{0}': {1}.", jt(e), n)]);
    });
  }
  resolveSchemaContent(e, t) {
    const n = e.errors.slice(0), r = e.schema;
    let i = r.$schema ? Xe(r.$schema) : void 0;
    if (i === "http://json-schema.org/draft-03/schema")
      return this.promise.resolve(new fa({}, [E("Draft-03 schemas are not supported.")], [], i));
    let s = /* @__PURE__ */ new Set();
    const a = this.contextService, l = (g, p) => {
      p = decodeURIComponent(p);
      let x = g;
      return p[0] === "/" && (p = p.substring(1)), p.split("/").some((w) => (w = w.replace(/~1/g, "/").replace(/~0/g, "~"), x = x[w], !x)), x;
    }, o = (g, p, x) => (p.anchors || (p.anchors = m(g)), p.anchors.get(x)), u = (g, p) => {
      for (const x in p)
        p.hasOwnProperty(x) && x !== "id" && x !== "$id" && (g[x] = p[x]);
    }, h = (g, p, x, w) => {
      let L;
      w === void 0 || w.length === 0 ? L = p : w.charAt(0) === "/" ? L = l(p, w) : L = o(p, x, w), L ? u(g, L) : n.push(E("$ref '{0}' in '{1}' can not be resolved.", w || "", x.uri));
    }, c = (g, p, x, w) => {
      a && !/^[A-Za-z][A-Za-z0-9+\-.+]*:\/\/.*/.test(p) && (p = a.resolveRelativePath(p, w.uri)), p = Xe(p);
      const L = this.getOrAddSchemaHandle(p);
      return L.getUnresolvedSchema().then((v) => {
        if (w.dependencies.add(p), v.errors.length) {
          const y = x ? p + "#" + x : p;
          n.push(E("Problems loading reference '{0}': {1}", y, v.errors[0]));
        }
        return h(g, v.schema, L, x), d(g, v.schema, L);
      });
    }, d = (g, p, x) => {
      const w = [];
      return this.traverseNodes(g, (L) => {
        const v = /* @__PURE__ */ new Set();
        for (; L.$ref; ) {
          const y = L.$ref, b = y.split("#", 2);
          if (delete L.$ref, b[0].length > 0) {
            w.push(c(L, b[0], b[1], x));
            return;
          } else if (!v.has(y)) {
            const _ = b[1];
            h(L, p, x, _), v.add(y);
          }
        }
        L.$recursiveRef && s.add("$recursiveRef"), L.$dynamicRef && s.add("$dynamicRef");
      }), this.promise.all(w);
    }, m = (g) => {
      const p = /* @__PURE__ */ new Map();
      return this.traverseNodes(g, (x) => {
        const w = x.$id || x.id, L = ja(w) && w.charAt(0) === "#" ? w.substring(1) : x.$anchor;
        L && (p.has(L) ? n.push(E("Duplicate anchor declaration: '{0}'", L)) : p.set(L, x)), x.$recursiveAnchor && s.add("$recursiveAnchor"), x.$dynamicAnchor && s.add("$dynamicAnchor");
      }), p;
    };
    return d(r, r, t).then((g) => {
      let p = [];
      return s.size && p.push(E("The schema uses meta-schema features ({0}) that are not yet supported by the validator.", Array.from(s.keys()).join(", "))), new fa(r, n, p, i);
    });
  }
  traverseNodes(e, t) {
    if (!e || typeof e != "object")
      return Promise.resolve(null);
    const n = /* @__PURE__ */ new Set(), r = (...u) => {
      for (const h of u)
        Ye(h) && l.push(h);
    }, i = (...u) => {
      for (const h of u)
        if (Ye(h))
          for (const c in h) {
            const m = h[c];
            Ye(m) && l.push(m);
          }
    }, s = (...u) => {
      for (const h of u)
        if (Array.isArray(h))
          for (const c of h)
            Ye(c) && l.push(c);
    }, a = (u) => {
      if (Array.isArray(u))
        for (const h of u)
          Ye(h) && l.push(h);
      else
        Ye(u) && l.push(u);
    }, l = [e];
    let o = l.pop();
    for (; o; )
      n.has(o) || (n.add(o), t(o), r(o.additionalItems, o.additionalProperties, o.not, o.contains, o.propertyNames, o.if, o.then, o.else, o.unevaluatedItems, o.unevaluatedProperties), i(o.definitions, o.$defs, o.properties, o.patternProperties, o.dependencies, o.dependentSchemas), s(o.anyOf, o.allOf, o.oneOf, o.prefixItems), a(o.items)), o = l.pop();
  }
  getSchemaFromProperty(e, t) {
    var n, r;
    if (((n = t.root) == null ? void 0 : n.type) === "object") {
      for (const i of t.root.properties)
        if (i.keyNode.value === "$schema" && ((r = i.valueNode) == null ? void 0 : r.type) === "string") {
          let s = i.valueNode.value;
          return this.contextService && !/^\w[\w\d+.-]*:/.test(s) && (s = this.contextService.resolveRelativePath(s, e)), s;
        }
    }
  }
  getAssociatedSchemas(e) {
    const t = /* @__PURE__ */ Object.create(null), n = [], r = Ya(e);
    for (const i of this.filePatternAssociations)
      if (i.matchesPattern(r))
        for (const s of i.getURIs())
          t[s] || (n.push(s), t[s] = !0);
    return n;
  }
  getSchemaURIsForResource(e, t) {
    let n = t && this.getSchemaFromProperty(e, t);
    return n ? [n] : this.getAssociatedSchemas(e);
  }
  getSchemaForResource(e, t) {
    if (t) {
      let i = this.getSchemaFromProperty(e, t);
      if (i) {
        const s = Xe(i);
        return this.getOrAddSchemaHandle(s).getResolvedSchema();
      }
    }
    if (this.cachedSchemaForResource && this.cachedSchemaForResource.resource === e)
      return this.cachedSchemaForResource.resolvedSchema;
    const n = this.getAssociatedSchemas(e), r = n.length > 0 ? this.createCombinedSchema(e, n).getResolvedSchema() : this.promise.resolve(void 0);
    return this.cachedSchemaForResource = { resource: e, resolvedSchema: r }, r;
  }
  createCombinedSchema(e, t) {
    if (t.length === 1)
      return this.getOrAddSchemaHandle(t[0]);
    {
      const n = "schemaservice://combinedSchema/" + encodeURIComponent(e), r = {
        allOf: t.map((i) => ({ $ref: i }))
      };
      return this.addSchemaHandle(n, r);
    }
  }
  getMatchingSchemas(e, t, n) {
    if (n) {
      const r = n.id || "schemaservice://untitled/matchingSchemas/" + Uc++;
      return this.addSchemaHandle(r, n).getResolvedSchema().then((s) => t.getMatchingSchemas(s.schema).filter((a) => !a.inverted));
    }
    return this.getSchemaForResource(e.uri, t).then((r) => r ? t.getMatchingSchemas(r.schema).filter((i) => !i.inverted) : []);
  }
}, Uc = 0;
function Xe(e) {
  try {
    return Dt.parse(e).toString(!0);
  } catch {
    return e;
  }
}
function Ya(e) {
  try {
    return Dt.parse(e).with({ fragment: null, query: null }).toString(!0);
  } catch {
    return e;
  }
}
function jt(e) {
  try {
    const t = Dt.parse(e);
    if (t.scheme === "file")
      return t.fsPath;
  } catch {
  }
  return e;
}
function Bc(e, t) {
  const n = [], r = [], i = [];
  let s = -1;
  const a = lt(e.getText(), !1);
  let l = a.scan();
  function o(g) {
    n.push(g), r.push(i.length);
  }
  for (; l !== 17; ) {
    switch (l) {
      case 1:
      case 3: {
        const g = e.positionAt(a.getTokenOffset()).line, p = { startLine: g, endLine: g, kind: l === 1 ? "object" : "array" };
        i.push(p);
        break;
      }
      case 2:
      case 4: {
        const g = l === 2 ? "object" : "array";
        if (i.length > 0 && i[i.length - 1].kind === g) {
          const p = i.pop(), x = e.positionAt(a.getTokenOffset()).line;
          p && x > p.startLine + 1 && s !== p.startLine && (p.endLine = x - 1, o(p), s = p.startLine);
        }
        break;
      }
      case 13: {
        const g = e.positionAt(a.getTokenOffset()).line, p = e.positionAt(a.getTokenOffset() + a.getTokenLength()).line;
        a.getTokenError() === 1 && g + 1 < e.lineCount ? a.setPosition(e.offsetAt(Z.create(g + 1, 0))) : g < p && (o({ startLine: g, endLine: p, kind: Jt.Comment }), s = g);
        break;
      }
      case 12: {
        const p = e.getText().substr(a.getTokenOffset(), a.getTokenLength()).match(/^\/\/\s*#(region\b)|(endregion\b)/);
        if (p) {
          const x = e.positionAt(a.getTokenOffset()).line;
          if (p[1]) {
            const w = { startLine: x, endLine: x, kind: Jt.Region };
            i.push(w);
          } else {
            let w = i.length - 1;
            for (; w >= 0 && i[w].kind !== Jt.Region; )
              w--;
            if (w >= 0) {
              const L = i[w];
              i.length = w, x > L.startLine && s !== L.startLine && (L.endLine = x, o(L), s = L.startLine);
            }
          }
        }
        break;
      }
    }
    l = a.scan();
  }
  const u = t && t.rangeLimit;
  if (typeof u != "number" || n.length <= u)
    return n;
  t && t.onRangeLimitExceeded && t.onRangeLimitExceeded(e.uri);
  const h = [];
  for (let g of r)
    g < 30 && (h[g] = (h[g] || 0) + 1);
  let c = 0, d = 0;
  for (let g = 0; g < h.length; g++) {
    const p = h[g];
    if (p) {
      if (p + c > u) {
        d = g;
        break;
      }
      c += p;
    }
  }
  const m = [];
  for (let g = 0; g < n.length; g++) {
    const p = r[g];
    typeof p == "number" && (p < d || p === d && c++ < u) && m.push(n[g]);
  }
  return m;
}
function qc(e, t, n) {
  function r(l) {
    let o = e.offsetAt(l), u = n.getNodeFromOffset(o, !0);
    const h = [];
    for (; u; ) {
      switch (u.type) {
        case "string":
        case "object":
        case "array":
          const d = u.offset + 1, m = u.offset + u.length - 1;
          d < m && o >= d && o <= m && h.push(i(d, m)), h.push(i(u.offset, u.offset + u.length));
          break;
        case "number":
        case "boolean":
        case "null":
        case "property":
          h.push(i(u.offset, u.offset + u.length));
          break;
      }
      if (u.type === "property" || u.parent && u.parent.type === "array") {
        const d = a(
          u.offset + u.length,
          5
          /* SyntaxKind.CommaToken */
        );
        d !== -1 && h.push(i(u.offset, d));
      }
      u = u.parent;
    }
    let c;
    for (let d = h.length - 1; d >= 0; d--)
      c = $n.create(h[d], c);
    return c || (c = $n.create(q.create(l, l))), c;
  }
  function i(l, o) {
    return q.create(e.positionAt(l), e.positionAt(o));
  }
  const s = lt(e.getText(), !0);
  function a(l, o) {
    return s.setPosition(l), s.scan() === o ? s.getTokenOffset() + s.getTokenLength() : -1;
  }
  return t.map(r);
}
function Kr(e, t, n) {
  let r;
  if (n) {
    const s = e.offsetAt(n.start), a = e.offsetAt(n.end) - s;
    r = { offset: s, length: a };
  }
  const i = {
    tabSize: t ? t.tabSize : 4,
    insertSpaces: (t == null ? void 0 : t.insertSpaces) === !0,
    insertFinalNewline: (t == null ? void 0 : t.insertFinalNewline) === !0,
    eol: `
`,
    keepLines: (t == null ? void 0 : t.keepLines) === !0
  };
  return oc(e.getText(), r, i).map((s) => Oe.replace(q.create(e.positionAt(s.offset), e.positionAt(s.offset + s.length)), s.content));
}
var se;
(function(e) {
  e[e.Object = 0] = "Object", e[e.Array = 1] = "Array";
})(se || (se = {}));
var dn = class {
  constructor(e, t) {
    this.propertyName = e ?? "", this.beginningLineNumber = t, this.childrenProperties = [], this.lastProperty = !1, this.noKeyName = !1;
  }
  addChildProperty(e) {
    if (e.parent = this, this.childrenProperties.length > 0) {
      let t = 0;
      e.noKeyName ? t = this.childrenProperties.length : t = Wc(this.childrenProperties, e, jc), t < 0 && (t = t * -1 - 1), this.childrenProperties.splice(t, 0, e);
    } else
      this.childrenProperties.push(e);
    return e;
  }
};
function jc(e, t) {
  const n = e.propertyName.toLowerCase(), r = t.propertyName.toLowerCase();
  return n < r ? -1 : n > r ? 1 : 0;
}
function Wc(e, t, n) {
  const r = t.propertyName.toLowerCase(), i = e[0].propertyName.toLowerCase(), s = e[e.length - 1].propertyName.toLowerCase();
  if (r < i)
    return 0;
  if (r > s)
    return e.length;
  let a = 0, l = e.length - 1;
  for (; a <= l; ) {
    let o = l + a >> 1, u = n(t, e[o]);
    if (u > 0)
      a = o + 1;
    else if (u < 0)
      l = o - 1;
    else
      return o;
  }
  return -a - 1;
}
function Hc(e, t) {
  const n = {
    ...t,
    keepLines: !1
    // keepLines must be false so that the properties are on separate lines for the sorting
  }, r = Ce.applyEdits(e, Kr(e, n, void 0)), i = Ce.create("test://test.json", "json", 0, r), s = zc(i), a = Gc(i, s), l = Kr(a, n, void 0), o = Ce.applyEdits(a, l);
  return [Oe.replace(q.create(Z.create(0, 0), e.positionAt(e.getText().length)), o)];
}
function zc(e) {
  const t = e.getText(), n = lt(t, !1);
  let r = new dn(), i = r, s = r, a = r, l, o = 0, u = 0, h, c, d = -1, m = -1, g = 0, p = 0, x = [], w = !1, L = !1;
  for (; (l = n.scan()) !== 17; ) {
    if (w === !0 && l !== 14 && l !== 15 && l !== 12 && l !== 13 && s.endLineNumber === void 0) {
      let v = n.getTokenStartLine();
      c === 2 || c === 4 ? a.endLineNumber = v - 1 : s.endLineNumber = v - 1, g = v, w = !1;
    }
    if (L === !0 && l !== 14 && l !== 15 && l !== 12 && l !== 13 && (g = n.getTokenStartLine(), L = !1), n.getTokenStartLine() !== o) {
      for (let v = o; v < n.getTokenStartLine(); v++) {
        const y = e.getText(q.create(Z.create(v, 0), Z.create(v + 1, 0))).length;
        u = u + y;
      }
      o = n.getTokenStartLine();
    }
    switch (l) {
      case 10: {
        if (h === void 0 || h === 1 || h === 5 && x[x.length - 1] === se.Object) {
          const v = new dn(n.getTokenValue(), g);
          a = s, s = i.addChildProperty(v);
        }
        break;
      }
      case 3: {
        if (r.beginningLineNumber === void 0 && (r.beginningLineNumber = n.getTokenStartLine()), x[x.length - 1] === se.Object)
          i = s;
        else if (x[x.length - 1] === se.Array) {
          const v = new dn(n.getTokenValue(), g);
          v.noKeyName = !0, a = s, s = i.addChildProperty(v), i = s;
        }
        x.push(se.Array), s.type = se.Array, g = n.getTokenStartLine(), g++;
        break;
      }
      case 1: {
        if (r.beginningLineNumber === void 0)
          r.beginningLineNumber = n.getTokenStartLine();
        else if (x[x.length - 1] === se.Array) {
          const v = new dn(n.getTokenValue(), g);
          v.noKeyName = !0, a = s, s = i.addChildProperty(v);
        }
        s.type = se.Object, x.push(se.Object), i = s, g = n.getTokenStartLine(), g++;
        break;
      }
      case 4: {
        p = n.getTokenStartLine(), x.pop(), s.endLineNumber === void 0 && (h === 2 || h === 4) && (s.endLineNumber = p - 1, s.lastProperty = !0, s.lineWhereToAddComma = d, s.indexWhereToAddComa = m, a = s, s = s ? s.parent : void 0, i = s), r.endLineNumber = p, g = p + 1;
        break;
      }
      case 2: {
        p = n.getTokenStartLine(), x.pop(), h !== 1 && (s.endLineNumber === void 0 && (s.endLineNumber = p - 1, s.lastProperty = !0, s.lineWhereToAddComma = d, s.indexWhereToAddComa = m), a = s, s = s ? s.parent : void 0, i = s), r.endLineNumber = n.getTokenStartLine(), g = p + 1;
        break;
      }
      case 5: {
        p = n.getTokenStartLine(), s.endLineNumber === void 0 && (x[x.length - 1] === se.Object || x[x.length - 1] === se.Array && (h === 2 || h === 4)) && (s.endLineNumber = p, s.commaIndex = n.getTokenOffset() - u, s.commaLine = p), (h === 2 || h === 4) && (a = s, s = s ? s.parent : void 0, i = s), g = p + 1;
        break;
      }
      case 13: {
        h === 5 && d === n.getTokenStartLine() && (x[x.length - 1] === se.Array && (c === 2 || c === 4) || x[x.length - 1] === se.Object) && (x[x.length - 1] === se.Array && (c === 2 || c === 4) || x[x.length - 1] === se.Object) && (s.endLineNumber = void 0, w = !0), (h === 1 || h === 3) && d === n.getTokenStartLine() && (L = !0);
        break;
      }
    }
    l !== 14 && l !== 13 && l !== 12 && l !== 15 && (c = h, h = l, d = n.getTokenStartLine(), m = n.getTokenOffset() + n.getTokenLength() - u);
  }
  return r;
}
function Gc(e, t) {
  if (t.childrenProperties.length === 0)
    return e;
  const n = Ce.create("test://test.json", "json", 0, e.getText()), r = [];
  for (ha(r, t, t.beginningLineNumber); r.length > 0; ) {
    const i = r.shift(), s = i.propertyTreeArray;
    let a = i.beginningLineNumber;
    for (let l = 0; l < s.length; l++) {
      const o = s[l], u = q.create(Z.create(o.beginningLineNumber, 0), Z.create(o.endLineNumber + 1, 0)), h = e.getText(u), c = Ce.create("test://test.json", "json", 0, h);
      if (o.lastProperty === !0 && l !== s.length - 1) {
        const g = o.lineWhereToAddComma - o.beginningLineNumber, p = o.indexWhereToAddComa, x = {
          range: q.create(Z.create(g, p), Z.create(g, p)),
          text: ","
        };
        Ce.update(c, [x], 1);
      } else if (o.lastProperty === !1 && l === s.length - 1) {
        const g = o.commaIndex, x = o.commaLine - o.beginningLineNumber, w = {
          range: q.create(Z.create(x, g), Z.create(x, g + 1)),
          text: ""
        };
        Ce.update(c, [w], 1);
      }
      const d = o.endLineNumber - o.beginningLineNumber + 1, m = {
        range: q.create(Z.create(a, 0), Z.create(a + d, 0)),
        text: c.getText()
      };
      Ce.update(n, [m], 1), ha(r, o, a), a = a + d;
    }
  }
  return n;
}
function ha(e, t, n) {
  if (t.childrenProperties.length !== 0)
    if (t.type === se.Object) {
      let r = 1 / 0;
      for (const s of t.childrenProperties)
        s.beginningLineNumber < r && (r = s.beginningLineNumber);
      const i = r - t.beginningLineNumber;
      n = n + i, e.push(new Ka(n, t.childrenProperties));
    } else
      t.type === se.Array && Za(e, t, n);
}
function Za(e, t, n) {
  for (const r of t.childrenProperties) {
    if (r.type === se.Object) {
      let i = 1 / 0;
      for (const a of r.childrenProperties)
        a.beginningLineNumber < i && (i = a.beginningLineNumber);
      const s = i - r.beginningLineNumber;
      e.push(new Ka(n + r.beginningLineNumber - t.beginningLineNumber + s, r.childrenProperties));
    }
    r.type === se.Array && Za(e, r, n + r.beginningLineNumber - t.beginningLineNumber);
  }
}
var Ka = class {
  constructor(e, t) {
    this.beginningLineNumber = e, this.propertyTreeArray = t;
  }
};
function Jc(e, t) {
  const n = [];
  return t.visit((r) => {
    var i;
    if (r.type === "property" && r.keyNode.value === "$ref" && ((i = r.valueNode) == null ? void 0 : i.type) === "string") {
      const s = r.valueNode.value, a = Qc(t, s);
      if (a) {
        const l = e.positionAt(a.offset);
        n.push({
          target: `${e.uri}#${l.line + 1},${l.character + 1}`,
          range: Xc(e, r.valueNode)
        });
      }
    }
    return !0;
  }), Promise.resolve(n);
}
function Xc(e, t) {
  return q.create(e.positionAt(t.offset + 1), e.positionAt(t.offset + t.length - 1));
}
function Qc(e, t) {
  const n = Yc(t);
  return n ? ei(n, e.root) : null;
}
function ei(e, t) {
  if (!t)
    return null;
  if (e.length === 0)
    return t;
  const n = e.shift();
  if (t && t.type === "object") {
    const r = t.properties.find((i) => i.keyNode.value === n);
    return r ? ei(e, r.valueNode) : null;
  } else if (t && t.type === "array" && n.match(/^(0|[1-9][0-9]*)$/)) {
    const r = Number.parseInt(n), i = t.items[r];
    return i ? ei(e, i) : null;
  }
  return null;
}
function Yc(e) {
  return e === "#" ? [] : e[0] !== "#" || e[1] !== "/" ? null : e.substring(2).split(/\//).map(Zc);
}
function Zc(e) {
  return e.replace(/~1/g, "/").replace(/~0/g, "~");
}
function Kc(e) {
  const t = e.promiseConstructor || Promise, n = new $c(e.schemaRequestService, e.workspaceContext, t);
  n.setSchemaContributions(Zr);
  const r = new Lc(n, e.contributions, t, e.clientCapabilities), i = new Nc(n, e.contributions, t), s = new Tc(n), a = new Ac(n, t);
  return {
    configure: (l) => {
      var o;
      n.clearExternalSchemas(), (o = l.schemas) == null || o.forEach(n.registerExternalSchema.bind(n)), a.configure(l);
    },
    resetSchema: (l) => n.onResourceChange(l),
    doValidation: a.doValidation.bind(a),
    getLanguageStatus: a.getLanguageStatus.bind(a),
    parseJSONDocument: (l) => _c(l, { collectComments: !0 }),
    newJSONDocument: (l, o) => wc(l, o),
    getMatchingSchemas: n.getMatchingSchemas.bind(n),
    doResolve: r.doResolve.bind(r),
    doComplete: r.doComplete.bind(r),
    findDocumentSymbols: s.findDocumentSymbols.bind(s),
    findDocumentSymbols2: s.findDocumentSymbols2.bind(s),
    findDocumentColors: s.findDocumentColors.bind(s),
    getColorPresentations: s.getColorPresentations.bind(s),
    doHover: i.doHover.bind(i),
    getFoldingRanges: Bc,
    getSelectionRanges: qc,
    findDefinition: () => Promise.resolve([]),
    findLinks: Jc,
    format: (l, o, u) => Kr(l, u, o),
    sort: (l, o) => Hc(l, o)
  };
}
var eo;
typeof fetch < "u" && (eo = function(e) {
  return fetch(e).then((t) => t.text());
});
var e0 = class {
  constructor(e, t) {
    this._ctx = e, this._languageSettings = t.languageSettings, this._languageId = t.languageId, this._languageService = Kc({
      workspaceContext: {
        resolveRelativePath: (n, r) => {
          const i = r.substr(0, r.lastIndexOf("/") + 1);
          return r0(i, n);
        }
      },
      schemaRequestService: t.enableSchemaRequest ? eo : void 0,
      clientCapabilities: Xr.LATEST
    }), this._languageService.configure(this._languageSettings);
  }
  async doValidation(e) {
    let t = this._getTextDocument(e);
    if (t) {
      let n = this._languageService.parseJSONDocument(t);
      return this._languageService.doValidation(t, n, this._languageSettings);
    }
    return Promise.resolve([]);
  }
  async doComplete(e, t) {
    let n = this._getTextDocument(e);
    if (!n)
      return null;
    let r = this._languageService.parseJSONDocument(n);
    return this._languageService.doComplete(n, t, r);
  }
  async doResolve(e) {
    return this._languageService.doResolve(e);
  }
  async doHover(e, t) {
    let n = this._getTextDocument(e);
    if (!n)
      return null;
    let r = this._languageService.parseJSONDocument(n);
    return this._languageService.doHover(n, t, r);
  }
  async format(e, t, n) {
    let r = this._getTextDocument(e);
    if (!r)
      return [];
    let i = this._languageService.format(r, t, n);
    return Promise.resolve(i);
  }
  async resetSchema(e) {
    return Promise.resolve(this._languageService.resetSchema(e));
  }
  async findDocumentSymbols(e) {
    let t = this._getTextDocument(e);
    if (!t)
      return [];
    let n = this._languageService.parseJSONDocument(t), r = this._languageService.findDocumentSymbols2(t, n);
    return Promise.resolve(r);
  }
  async findDocumentColors(e) {
    let t = this._getTextDocument(e);
    if (!t)
      return [];
    let n = this._languageService.parseJSONDocument(t), r = this._languageService.findDocumentColors(t, n);
    return Promise.resolve(r);
  }
  async getColorPresentations(e, t, n) {
    let r = this._getTextDocument(e);
    if (!r)
      return [];
    let i = this._languageService.parseJSONDocument(r), s = this._languageService.getColorPresentations(
      r,
      i,
      t,
      n
    );
    return Promise.resolve(s);
  }
  async getFoldingRanges(e, t) {
    let n = this._getTextDocument(e);
    if (!n)
      return [];
    let r = this._languageService.getFoldingRanges(n, t);
    return Promise.resolve(r);
  }
  async getSelectionRanges(e, t) {
    let n = this._getTextDocument(e);
    if (!n)
      return [];
    let r = this._languageService.parseJSONDocument(n), i = this._languageService.getSelectionRanges(n, t, r);
    return Promise.resolve(i);
  }
  async parseJSONDocument(e) {
    let t = this._getTextDocument(e);
    if (!t)
      return null;
    let n = this._languageService.parseJSONDocument(t);
    return Promise.resolve(n);
  }
  async getMatchingSchemas(e) {
    let t = this._getTextDocument(e);
    if (!t)
      return [];
    let n = this._languageService.parseJSONDocument(t);
    return Promise.resolve(this._languageService.getMatchingSchemas(t, n));
  }
  _getTextDocument(e) {
    let t = this._ctx.getMirrorModels();
    for (let n of t)
      if (n.uri.toString() === e)
        return Ce.create(
          e,
          this._languageId,
          n.version,
          n.getValue()
        );
    return null;
  }
}, t0 = 47, ar = 46;
function n0(e) {
  return e.charCodeAt(0) === t0;
}
function r0(e, t) {
  if (n0(t)) {
    const n = Dt.parse(e), r = t.split("/");
    return n.with({ path: to(r) }).toString();
  }
  return i0(e, t);
}
function to(e) {
  const t = [];
  for (const r of e)
    r.length === 0 || r.length === 1 && r.charCodeAt(0) === ar || (r.length === 2 && r.charCodeAt(0) === ar && r.charCodeAt(1) === ar ? t.pop() : t.push(r));
  e.length > 1 && e[e.length - 1].length === 0 && t.push("");
  let n = t.join("/");
  return e[0].length === 0 && (n = "/" + n), n;
}
function i0(e, ...t) {
  const n = Dt.parse(e), r = n.path.split("/");
  for (let i of t)
    r.push(...i.split("/"));
  return n.with({ path: to(r) }).toString();
}
self.onmessage = () => {
  Ua((e, t) => new e0(e, t));
};
