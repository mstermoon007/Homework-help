/**
 * shared/presentation/svg-registry.js — M7-R03 SVG 生成器注册表
 *
 * 原则（R03）：
 *   - SVG 只由 Renderer 产出；Generator/Plugin 不再直接调用 SVG 拼图、也不再向
 *     SemanticQuestion 写入最终 <svg> 字符串；
 *   - 注册入口：App.SVGGenerators.register(type, generator)
 *                 App.SVGGenerators.register(type, subtype, generator)
 *   - 渲染入口：SVGRenderer.render(graphic, options) → <svg> 字符串（无图返回 ''）；
 *   - 兼容旧链：沿用 shared/svg-*.js 挂载的 global.SVGGenerators.{core,math,cn,en}
 *     （数学竖式/几何/凑十法、语文、英语），启动时自动扫进注册表（shape-name 别名）。
 */
(function (global) {
  'use strict';

  // entries: { type: { subtype: fn, '::default': fn } , 'shape:ns.name.sub': fn }
  var byType = {};        // type -> { subtype -> fn, '::default' -> fn }
  var byShape = {};       // 'ns.key' / 'ns.sub.key' -> fn
  var seededOnce = false;

  function ensureSeeded() {
    if (seededOnce) return;
    seedFromGlobal();
    seededOnce = true;
  }

  function ensureType(type) {
    if (!byType[type]) byType[type] = { '::default': null };
    return byType[type];
  }

  function getSVGUtil() {
    return (global.SVGUtil && typeof global.SVGUtil.svgWrap === 'function')
      ? global.SVGUtil
      : (typeof require !== 'undefined' ? require('../svg-core.js') : null);
  }

  /**
   * 注册生成器。
   * 签名：
   *   register('geometry', square)             —— 默认生成器（无 subtype）
   *   register('geometry', 'square', square)   —— 指定 subtype
   *   register({ type:'math', sub:'calculation', shape:'math.calculation' }, fn)
   * 附加：fn.shapeName 可挂 shape 别名（如 'math.calculation'）。
   */
  function register(type, subtype, generator) {
    if (typeof subtype === 'function') {
      generator = subtype;
      subtype = null;
    }
    if (!type || typeof generator !== 'function') {
      throw new Error('SVGGenerators.register(type, fn) 参数不合法: ' + type);
    }
    if (subtype == null) {
      ensureType(type)['::default'] = generator;
    } else {
      ensureType(type)[subtype] = generator;
    }
    if (typeof generator.shapeName === 'string' && generator.shapeName) {
      byShape[generator.shapeName] = generator;
    }
    return generator;
  }

  /**
   * 扫描 shared/svg-*.js 已挂载的科目生成器，注册为 shape 别名与 descriptor 映射。
   * 浏览器环境每文件注册一次；Node 下可重复调用（幂等）。
   * 数学科目能对应该语义图形类型（geometry / calculation / makeTen）——
   *    geometry.square → 描述符 { type:'geometry', subtype:'square' }
   *    calculation.add → { type:'calculation', subtype:'add' }
   * 语文/英语科目仅挂 shape 别名（供旧接口引用）。
   * 形如 { type:'geometry', subtype:'square', params: boxAttrs }。
   */
  function seedFromGlobal() {
    var root = global.SVGGenerators;
    if (!root) return { seeded: 0 };
    var namespaces = ['math', 'cn', 'en'];
    // P6-R02: 新增 SVG 生成器命名空间
    var additionalNamespaces = {
      math: ['clock', 'area', 'fraction', 'dataStats', 'draw', 'competition']
    };
    var seeded = 0;
    var SUBJECT_TO_TYPE = { geometry: 'geometry', calculation: 'calculation', makeTen: 'makeTen', clock: 'clock', area: 'area', fraction: 'fraction', dataStats: 'dataStats', draw: 'draw', competition: 'competition' };
    // make-ten（kebab）是 M4 graphic-renderer 的语义类型名，与 makeTen 同源
    function registerWithAlias(type, subtype, fn) {
      register(type, subtype, fn);
      if (type === 'makeTen') {
        register('make-ten', subtype, fn);
        // kebab 别名提供默认渲染器（映射到 makeTen 子生成器）
        if (subtype === 'makeTen' || subtype === 'make-ten') {
          register('make-ten', null, fn);
        }
      }
    }
    for (var i = 0; i < namespaces.length; i++) {
      var ns = root[namespaces[i]];
      if (!ns || typeof ns !== 'object') continue;
      var keys = Object.keys(ns);
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        var val = ns[key];
        if (key === 'ready') continue;
        if (typeof val === 'function') {
          var shapeFn = val;
          shapeFn.shapeName = namespaces[i] + '.' + key;
          register(namespaces[i] + '.' + key, shapeFn);
          seeded++;
        } else if (typeof val === 'object' && val !== null) {
          var subKeys = Object.keys(val);
          for (var s = 0; s < subKeys.length; s++) {
            var sub = val[subKeys[s]];
            if (!subKeys[s] || typeof sub !== 'function' || subKeys[s].charAt(0) === '_') continue;
            var rootNs = namespaces[i];
            var shapeSubKey = rootNs + '.' + key + '.' + subKeys[s];
            var descriptorType = SUBJECT_TO_TYPE[key];
            if (rootNs === 'math' && descriptorType) {
              // 描述符索引（供 SemanticQuestion.graphic 直接渲染）
              if (key === 'calculation') {
                // 竖式函数签名不一（add/sub 收数组或 (a,b)，mul/div 收两个数，
                // dec 收 (a,b,op)，frac 收 (a,b,c,d,op)），按参数形态适配
                registerWithAlias(descriptorType, subKeys[s], (function (orig) {
                  return function (p) {
                    if (Array.isArray(p)) return orig(p.slice(), {});
                    if (p && Array.isArray(p.values)) return orig(p.values.slice(), (p.options || p.opts) || {});
                    if (p && p.a != null && p.b != null && p.c != null && p.d != null)
                      return orig(p.a, p.b, p.c, p.d, p.op || '+', (p.options || p.opts) || {});
                    if (p && p.a != null && p.b != null && p.op)
                      return orig(p.a, p.b, p.op, (p.options || p.opts) || {});
                    if (p && p.a != null && p.b != null) return orig(p.a, p.b, (p.options || p.opts) || {});
                    return orig(p);
                  };
                })(sub));
              } else if (key === 'makeTen') {
                // 凑十法生成器为位置参数 makeTen(a, b[, opts])，按 {num,add} 描述符形态适配
                registerWithAlias('makeTen', subKeys[s], (function (orig) {
                  return function (p) {
                    if (Array.isArray(p)) return orig(p[0], p[1]);
                    if (p && p.num != null && p.add != null) return orig(p.num, p.add);
                    if (p && p.a != null && p.b != null) return orig(p.a, p.b);
                    if (p && p.num != null) return orig(p.num, p.num);
                    return orig(p);
                  };
                })(sub));
              } else {
                registerWithAlias(descriptorType, subKeys[s], sub);
              }
              seeded++;
            } else {
              // 仅 shape 别名
              byShape[shapeSubKey] = sub;
              seeded++;
}
    }
    }
    // P6-R02: 处理额外的 math 子命名空间
    var mathNs = root.math;
    if (mathNs) {
      var additionalKeys = ['clock', 'area', 'fraction', 'dataStats', 'draw', 'competition'];
      for (var a = 0; a < additionalKeys.length; a++) {
        var key = additionalKeys[a];
        var val = mathNs[key];
        if (!val || typeof val !== 'object' || val === null) continue;
        var descriptorType = SUBJECT_TO_TYPE[key];
        if (!descriptorType) continue;
        var subKeys = Object.keys(val);
        for (var s = 0; s < subKeys.length; s++) {
          var sub = val[subKeys[s]];
          if (!subKeys[s] || typeof sub !== 'function' || subKeys[s].charAt(0) === '_') continue;
          registerWithAlias(descriptorType, subKeys[s], sub);
          seeded++;
        }
      }
    }
}
    }
    return { seeded: seeded };
  }

  function resolve(graphic) {
    ensureSeeded();
    if (!graphic || typeof graphic !== 'object') return null;
    var type = graphic.type;
    var subtype = graphic.subtype != null ? graphic.subtype : null;
    if (!type) {
      // 退化为 shape-name 解析（无 type 时用 params.shape）
      var shapeOnly = graphic.params && graphic.params.shape;
      if (shapeOnly && byShape[shapeOnly]) return byShape[shapeOnly];
      return null;
    }
    // 1) descriptor 精确索引
    var bucket = byType[type];
    if (bucket) {
      if (subtype && typeof bucket[subtype] === 'function') return bucket[subtype];
      if (typeof bucket['::default'] === 'function') return bucket['::default'];
    }
    // 2) shape-name 别名（type.subtype / type）
    if (subtype && byShape[type + '.' + subtype]) return byShape[type + '.' + subtype];
    if (byShape[type]) return byShape[type];
    return null;
  }

  /**
   * 渲染到一个 <svg> 字符串；无注册生成器或非图片题时返回 ''。
   * @param {Object} graphic graphic 描述符 {type,subtype,params}
   * @param {Object} [options] renderOptions（可含 density 等微调，默认不处理）
   * @returns {string}
   */
  function renderFor(graphic, options) {
    if (!graphic || typeof graphic !== 'object') return '';
    // custom：直接承载既成 SVG（legacy q.svg 适配路径）
    if (graphic.type === 'custom' || graphic.type === 'illustration') {
      var raw = graphic.params && graphic.params.rawSvg;
      if (typeof raw === 'string' && raw.trim().length > 0) {
        return raw.trim().indexOf('<svg') === 0 ? raw.trim() : '<svg xmlns="http://www.w3.org/2000/svg">' + raw + '</svg>';
      }
      return '';
    }
    var fn = resolve(graphic);
    if (typeof fn !== 'function') return '';
    var args = graphic.params || {};
    var svg;
    try {
      svg = fn(args);
    } catch (e) {
      return '';
    }
    if (typeof svg === 'string' && svg.trim().length > 0) return svg.trim();
    return '';
  }

  function render(graphic, options) {
    var svg = renderFor(graphic, options);
    if (svg === '') return '';
    var U = getSVGUtil();
    if (U && typeof U.svgWrap === 'function' && svg.indexOf('<svg') !== 0) {
      return U.svgWrap(svg, { padding: 8 });
    }
    return svg;
  }

  var SVGRegistry = {
    register: register,
    seedFromGlobal: seedFromGlobal,
    resolve: resolve,
    render: render
  };

  // 挂到既有全局命名空间（与 shared/svg-*.js 的挂载共存），提供正式 API
  global.SVGGenerators = global.SVGGenerators || {};
  global.SVGGenerators.register = register;

  global.SVGRenderer = { render: render, resolve: resolve, register: register };
  if (typeof module !== 'undefined' && module.exports) module.exports = SVGRegistry;
  return SVGRegistry;
})(typeof window !== 'undefined' ? window : global);