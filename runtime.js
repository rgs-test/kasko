/* Мини-движок для артбордов *.dc.html: holes {{…}}, sc-if, sc-for, dc-import, props и state. */
(function () {
  'use strict';
  const BASE = 'project/';
  const defs = new Map();          // name -> {tpl: Element, cls, props, w, h}
  const injected = new Set();

  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(patch) {
      const p = typeof patch === 'function' ? patch(this.state, this.props) : patch;
      this.state = Object.assign({}, this.state, p);
      if (this.__inst) this.__inst.render();
    }
    renderVals() { return {}; }
  }

  function camel(s) { return s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()); }

  async function loadDef(name) {
    if (defs.has(name)) return defs.get(name);
    const res = await fetch(BASE + encodeURIComponent(name) + '.dc.html');
    if (!res.ok) throw new Error('Не найден компонент ' + name);
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const xdc = doc.querySelector('x-dc');
    const helmet = xdc.querySelector('helmet');
    if (helmet) {
      helmet.querySelectorAll('link[rel="stylesheet"]').forEach((l) => {
        const href = l.getAttribute('href');
        if (injected.has(href)) return;
        injected.add(href);
        const el = document.createElement('link'); el.rel = 'stylesheet'; el.href = href; document.head.appendChild(el);
      });
      helmet.querySelectorAll('style').forEach((s) => {
        const css = s.textContent.replace(/(^|\n)\s*(html,)?body\s*\{[^}]*\}/g, '');
        const key = name + ':' + css.length;
        if (!css.trim() || injected.has(key)) return;
        injected.add(key);
        const el = document.createElement('style'); el.textContent = css; document.head.appendChild(el);
      });
      helmet.remove();
    }
    const sc = doc.querySelector('script[data-dc-script]');
    let props = {}, cls = DCLogic;
    if (sc) {
      try { props = JSON.parse(sc.getAttribute('data-props') || '{}'); } catch (e) { props = {}; }
      cls = new Function('DCLogic', sc.textContent + '\n;return Component;')(DCLogic);
    }
    const prev = props.$preview || {};
    const def = { name, tpl: xdc, cls, props, w: prev.width, h: prev.height };
    defs.set(name, def);
    // заранее подгружаем вложенные компоненты
    await Promise.all([...xdc.querySelectorAll('dc-import')].map((d) => loadDef(d.getAttribute('name'))));
    return def;
  }

  function lookup(expr, scope) {
    const e = expr.trim();
    if (e === 'true') return true;
    if (e === 'false') return false;
    if (e === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(e)) return Number(e);
    const parts = e.split('.');
    let v;
    for (let i = scope.length - 1; i >= 0; i--) {
      if (scope[i] && Object.prototype.hasOwnProperty.call(scope[i], parts[0])) { v = scope[i][parts[0]]; break; }
    }
    for (let k = 1; k < parts.length && v != null; k++) v = v[parts[k]];
    return v;
  }
  const HOLE = /\{\{([^}]*)\}\}/g;
  const single = (s) => { const m = s.match(/^\s*\{\{([^}]*)\}\}\s*$/); return m ? m[1] : null; };
  function interp(s, scope) { return s.replace(HOLE, (_, e) => { const v = lookup(e, scope); return v == null || v === false ? '' : String(v); }); }
  function truthy(v) { return !(v === false || v === 'false' || v == null || v === '' || v === 0 || (Array.isArray(v) && !v.length)); }

  class Instance {
    constructor(def, props) {
      this.def = def; this.children = new Map();
      this.host = document.createElement('div'); this.host.style.display = 'contents';
      this.setProps(props, true);
    }
    setProps(props, first) {
      const full = {};
      for (const [k, cfg] of Object.entries(this.def.props)) if (k[0] !== '$' && cfg && 'default' in cfg) full[k] = cfg.default;
      Object.assign(full, props);
      if (first) { this.logic = new this.def.cls(full); this.logic.__inst = this; if (!this.logic.state) this.logic.state = {}; }
      this.logic.props = full;
    }
    render() {
      let vals;
      try { vals = this.logic.renderVals() || {}; } catch (e) { console.error(this.def.name, e); vals = {}; }
      this.counter = 0; this.used = new Set();
      const frag = document.createDocumentFragment();
      for (const n of this.def.tpl.childNodes) this.node(n, [vals], frag);
      for (const k of [...this.children.keys()]) if (!this.used.has(k)) this.children.delete(k);
      this.host.replaceChildren(frag);
      return this.host;
    }
    node(n, scope, out) {
      if (n.nodeType === 3) { out.appendChild(document.createTextNode(interp(n.nodeValue, scope))); return; }
      if (n.nodeType !== 1) return;
      const tag = n.localName;
      if (tag === 'sc-if') {
        if (truthy(lookup(single(n.getAttribute('value')) ?? 'false', scope))) for (const c of n.childNodes) this.node(c, scope, out);
        return;
      }
      if (tag === 'sc-for') {
        const list = lookup(single(n.getAttribute('list')) || '', scope) || [];
        const as = n.getAttribute('as') || 'item';
        list.forEach((item, i) => { const s = scope.concat([{ [as]: item, index: i }]); for (const c of n.childNodes) this.node(c, s, out); });
        return;
      }
      if (tag === 'dc-import') {
        const name = n.getAttribute('name');
        const props = {};
        for (const a of n.attributes) {
          if (a.name === 'name' || a.name.startsWith('hint-')) continue;
          const h = single(a.value);
          props[camel(a.name)] = h !== null ? lookup(h, scope) : a.value;
        }
        const key = name + '#' + (this.counter++);
        this.used.add(key);
        let child = this.children.get(key);
        if (!child) { child = new Instance(defs.get(name), props); this.children.set(key, child); }
        else child.setProps(props);
        out.appendChild(child.render());
        return;
      }
      const el = n.namespaceURI && n.namespaceURI !== 'http://www.w3.org/1999/xhtml'
        ? document.createElementNS(n.namespaceURI, n.tagName) : document.createElement(tag);
      for (const a of n.attributes) {
        const h = single(a.value);
        const name = a.name;
        if (/^on[a-z]+$/i.test(name)) {
          const fn = h !== null ? lookup(h, scope) : null;
          if (typeof fn === 'function') el.addEventListener(name.slice(2).toLowerCase(), fn);
          continue;
        }
        if (h !== null && (name === 'checked' || name === 'disabled' || name === 'selected' || name === 'readonly')) {
          const v = truthy(lookup(h, scope));
          if (name === 'checked') el.checked = v; else if (v) el.setAttribute(name, '');
          if (name === 'checked' && v) el.setAttribute('checked', '');
          continue;
        }
        if (name === 'value' && h !== null) { const v = lookup(h, scope); el.setAttribute('value', v == null ? '' : v); el.value = v == null ? '' : v; continue; }
        el.setAttribute(name, a.value.includes('{{') ? interp(a.value, scope) : a.value);
      }
      if (tag === 'input' && el.type === 'checkbox') {
        // визуально как в макете: клик управляет только через логику компонента
        el.addEventListener('click', (ev) => { if (!n.getAttribute('onchange')) ev.preventDefault(); });
      }
      for (const c of n.childNodes) this.node(c, scope, el);
      out.appendChild(el);
    }
  }

  async function mount(name, target, props) {
    const def = await loadDef(name);
    const inst = new Instance(def, props || {});
    target.replaceChildren(inst.render());
    return def;
  }

  window.DC = { mount, loadDef };
})();
