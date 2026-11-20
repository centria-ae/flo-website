
/* Flo Creative · tiny orthographic 3D renderer for canvas (no dependencies).
   World: x right, y up, z towards viewer. Meters. */
(function (global) {
  'use strict';

  var L = norm([-0.45, 0.85, 0.55]);

  function norm(v) {
    var l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }

  function hex(h) {
    h = h.replace('#', '');
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16)
    ];
  }

  function circ(cx, cz, r, n) {
    var p = [];
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2;
      p.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
    return p;
  }

  function hull(pts) {
    pts = pts.slice().sort(function (a, b) {
      return a[0] - b[0] || a[1] - b[1];
    });

    var cr = function (o, a, b) {
      return (a[0] - o[0]) * (b[1] - o[1]) -
        (a[1] - o[1]) * (b[0] - o[0]);
    };

    var lo = [], up = [], i;

    for (i = 0; i < pts.length; i++) {
      while (lo.length >= 2 &&
        cr(lo[lo.length - 2], lo[lo.length - 1], pts[i]) <= 0) {
        lo.pop();
      }
      lo.push(pts[i]);
    }

    for (i = pts.length - 1; i >= 0; i--) {
      while (up.length >= 2 &&
        cr(up[up.length - 2], up[up.length - 1], pts[i]) <= 0) {
        up.pop();
      }
      up.push(pts[i]);
    }

    up.pop();
    lo.pop();
    return lo.concat(up);
  }

  function rgb(c, k, a) {
    var r = Math.min(255, Math.round(c[0] * k));
    var g = Math.min(255, Math.round(c[1] * k));
    var b = Math.min(255, Math.round(c[2] * k));

    return a == null
      ? 'rgb(' + r + ',' + g + ',' + b + ')'
      : 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  function Scene(canvas, o) {
    o = o || {};

    this.c = canvas;
    this.ctx = canvas.getContext('2d');

    this.yaw = o.yaw != null ? o.yaw : 0.7;
    this.pitch = o.pitch != null ? o.pitch : 0.62;

    this.scale = 20;
    this.cx = 0;
    this.cy = 0;
    this.focus = o.focus || [0, 0, 0];

    this.ground = [];
    this.objs = [];
    this.overlay = [];
    this.bg = o.bg || null;

    this.amb = o.amb != null ? o.amb : 0.6;
    this.dif = o.dif != null ? o.dif : 0.42;
    this.back = o.back || 0.62;

    this.dpr = Math.min(global.devicePixelRatio || 1, o.maxDpr || 2);

    this.edge = o.edge || null;
    this.shade = o.shadow || 0;
    this.sdir = o.sdir || [0.55, 0.38];
    this.shadows = [];

    this.fit = o.fit || 30;
    this.offset = o.offset || [0.5, 0.55];

    this.resize();
  }

  Scene.prototype.resize = function () {
    var r = this.c.getBoundingClientRect();
    var w = Math.max(1, r.width);
    var h = Math.max(1, r.height);

    this.w = w;
    this.h = h;

    this.c.width = Math.round(w * this.dpr);
    this.c.height = Math.round(h * this.dpr);

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.scale = Math.min(w, h * 1.6) / this.fit;
    this.cx = w * this.offset[0];
    this.cy = h * this.offset[1];
  };

  Scene.prototype.p = function (x, y, z) {
    var f = this.focus;

    x -= f[0];
    y -= f[1];
    z -= f[2];

    var c = Math.cos(this.yaw);
    var s = Math.sin(this.yaw);
    var cp = Math.cos(this.pitch);
    var sp = Math.sin(this.pitch);

    var xr = x * c - z * s;
    var zr = x * s + z * c;

    return [
      this.cx + xr * this.scale,
      this.cy + (-y * cp + zr * sp) * this.scale,
      zr * cp + y * sp
    ];
  };

  Scene.prototype.facing = function (n) {
    var s = Math.sin(this.yaw);
    var c = Math.cos(this.yaw);
    var nzr = n[0] * s + n[2] * c;

    return n[1] * Math.sin(this.pitch) +
      nzr * Math.cos(this.pitch);
  };

  Scene.prototype.clear = function () {
    this.ground = [];
    this.objs = [];
    this.overlay = [];
    this.shadows = [];
  };

  Scene.prototype.cast = function (foot, top) {
    if (this.shade) {
      this.shadows.push({ foot: foot, top: top });
    }
  };

  Scene.prototype.sphere = function (x, y, z, r, col, o) {
    o = o || {};

    this.objs.push({
      ball: [x, y, z],
      r: r,
      col: hex(col),
      at: [x, y, z],
      faces: [],
      k: o.k || 0
    });

    if (o.cast !== false) {
      this.cast(circ(x, z, r * 0.9, 10), y + r * 0.2);
    }
  };

  function quad(pts, n, col, o) {
    o = o || {};

    return {
      pts: pts,
      n: n,
      col: col,
      a: o.a,
      glow: o.glow,
      line: o.line,
      both: o.both
    };
  }

  Scene.prototype.box = function (x, y, z, w, h, d, col, o) {
    o = o || {};

    var C = typeof col === 'string' ? hex(col) : col;
    var T = o.top ? hex(o.top) : C;

    var x2 = x + w;
    var y2 = y + h;
    var z2 = z + d;
    var f = [];

    f.push(quad(
      [[x,y2,z],[x2,y2,z],[x2,y2,z2],[x,y2,z2]],
      [0,1,0], T, o
    ));

    f.push(quad(
      [[x,y,z2],[x2,y,z2],[x2,y2,z2],[x,y2,z2]],
      [0,0,1], o.front ? hex(o.front) : C, o
    ));

    f.push(quad(
      [[x2,y,z],[x,y,z],[x,y2,z],[x2,y2,z]],
      [0,0,-1], o.back ? hex(o.back) : C, o
    ));

    f.push(quad(
      [[x2,y,z2],[x2,y,z],[x2,y2,z],[x2,y2,z2]],
      [1,0,0], C, o
    ));

    f.push(quad(
      [[x,y,z],[x,y,z2],[x,y2,z2],[x,y2,z]],
      [-1,0,0], C, o
    ));

    this.objs.push({
      faces: f,
      at: [x+w/2,y+h/2,z+d/2],
      k: o.k || 0
    });

    if (o.cast !== false) {
      this.cast([[x,z],[x2,z],[x2,z2],[x,z2]], y2);
    }
  };

  Scene.prototype.cyl = function (cx, y, cz, r, h, col, o) {
    o = o || {};

    var n = o.seg || 22;
    var C = hex(col);
    var T = o.top ? hex(o.top) : C;

    var f = [];
    var top = [];

    for (var i = 0; i < n; i++) {
      var a1 = i / n * Math.PI * 2;
      var a2 = (i + 1) / n * Math.PI * 2;
      var am = (a1 + a2) / 2;

      var p1 = [
        cx + Math.cos(a1) * r,
        cz + Math.sin(a1) * r
      ];

      var p2 = [
        cx + Math.cos(a2) * r,
        cz + Math.sin(a2) * r
      ];

      var sideCol = o.band
        ? hex(o.band[i % o.band.length])
        : C;

      f.push(quad(
        [
          [p1[0],y,p1[1]],
          [p2[0],y,p2[1]],
          [p2[0],y+h,p2[1]],
          [p1[0],y+h,p1[1]]
        ],
        [Math.cos(am),0,Math.sin(am)],
        sideCol,
        { both: o.open, glow: o.glow, a: o.a }
      ));

      top.push([p1[0],y+h,p1[1]]);
    }

    if (!o.open) {
      f.push(quad(top, [0,1,0], T, { a: o.a }));
    }

    if (o.split) {
      this.objs.push({
        faces: f,
        at: [cx,y+h/2,cz],
        k: o.k - 2,
        noedge: o.noedge,
        side: 'back'
      });

      this.objs.push({
        faces: f,
        at: [cx,y+h/2,cz],
        k: o.k + 1,
        noedge: o.noedge,
        side: 'front'
      });
    } else {
      this.objs.push({
        faces: f,
        at: [cx,y+h/2,cz],
        k: o.k || 0,
        noedge: o.noedge
      });
    }

    if (o.cast !== false) {
      this.cast(circ(cx,cz,r,14), y+h);
    }
  };

  /* Foliage clump: a billboard of layered leaf masses (shadow, body, light, highlights)
     so crowns read as dense trees, not balls. Flat fills only: cheap to draw. */
  var LEAF = [[0,0,1],[-.42,.18,.62],[.44,.16,.6],[-.18,-.36,.58],[.26,-.32,.56],[0,.34,.6],[-.52,-.12,.48],[.54,-.08,.46]];
  Scene.prototype.foliage = function (x, y, z, r, o) {
    o = o || {};
    this.objs.push({ leaf: [x, y, z], r: r, seed: o.seed || 0, pal: o.pal || 0, at: [x, y, z], faces: [], k: o.k || 0 });
    if (o.cast !== false) this.cast(circ(x, z, r * 0.85, 10), y + r * 0.2);
  };
  var LEAFPAL = [
    ['#456F3F', '#5E9150', '#7DAE60', '#A6CB7E', '#D3E7AA'],
    ['#4A7642', '#659856', '#86B566', '#AFD186', '#DAEBB4'],
    ['#416B3D', '#5A8C4D', '#77A85C', '#9EC578', '#CCE2A2']
  ];

  /* Leaf clumps are painted once per (palette, variant, pixel radius) and reused as sprites. */
  var leafCache = {}, leafCount = 0;
  function leafSprite(pal, sd, lr, dpr) {
    var key = pal + '_' + sd + '_' + lr;
    if (leafCache[key]) return leafCache[key];
    if (leafCount > 500) { leafCache = {}; leafCount = 0; }
    var size = Math.ceil(lr * 2.6 * dpr), cv = document.createElement('canvas');
    cv.width = cv.height = size;
    var c = cv.getContext('2d'), P = LEAFPAL[pal], R = lr * dpr, cx = size / 2, cy = size / 2;
    var blob = function (dx, dy, rr, col) { c.fillStyle = col; c.beginPath(); c.arc(cx + dx * R, cy + dy * R, rr * R, 0, 6.2832); c.fill(); };
    blob(0.05, 0.3, 0.8, P[0]);
    for (var le = 0; le < 11; le++) { var ea = le / 11 * 6.2832 + sd; blob(Math.cos(ea) * 0.74, Math.sin(ea) * 0.6 + 0.1, 0.28 + (le % 3) * 0.05, le < 6 ? P[1] : P[0]); }
    for (var li = 0; li < LEAF.length; li++) { var q = LEAF[(li + sd) % LEAF.length]; blob(q[0] * 0.6, q[1] * 0.55 + 0.05, q[2] * 0.6, P[1]); }
    for (var lj = 0; lj < 8; lj++) { var q2 = LEAF[(lj * 3 + sd) % LEAF.length]; blob(q2[0] * 0.5 - 0.1, q2[1] * 0.44 - 0.2, q2[2] * 0.4, P[2]); }
    for (var lk = 0; lk < 6; lk++) { var q3 = LEAF[(lk * 5 + sd + 1) % LEAF.length]; blob(q3[0] * 0.42 - 0.2, q3[1] * 0.32 - 0.34, q3[2] * 0.24, P[3]); }
    for (var lm = 0; lm < 9; lm++) { var q4 = LEAF[(lm * 7 + sd + 2) % LEAF.length]; blob(q4[0] * 0.58 - 0.15 + (lm % 3) * 0.08, q4[1] * 0.42 - 0.42 + (lm % 2) * 0.06, 0.055, P[4]); }
    leafCache[key] = cv; leafCount++;
    return cv;
  }

  /* Curved counter / wall: part of a ring between radii r1 and r2, from angle a0 to a1 (radians). */
  Scene.prototype.arc = function (cx, y, cz, r1, r2, h, a0, a1, col, o) {
    o = o || {};
    var n = o.seg || 10, C = hex(col), T = o.top ? hex(o.top) : C, I = o.inner ? hex(o.inner) : C, f = [], outline = [];
    for (var i = 0; i < n; i++) {
      var t1 = a0 + (a1 - a0) * i / n, t2 = a0 + (a1 - a0) * (i + 1) / n, tm = (t1 + t2) / 2;
      var c1 = Math.cos(t1), s1 = Math.sin(t1), c2 = Math.cos(t2), s2 = Math.sin(t2);
      var bc = o.band ? hex(o.band[i % o.band.length]) : C;
      f.push(quad([[cx + c1 * r2, y, cz + s1 * r2], [cx + c2 * r2, y, cz + s2 * r2], [cx + c2 * r2, y + h, cz + s2 * r2], [cx + c1 * r2, y + h, cz + s1 * r2]], [Math.cos(tm), 0, Math.sin(tm)], bc));
      f.push(quad([[cx + c2 * r1, y, cz + s2 * r1], [cx + c1 * r1, y, cz + s1 * r1], [cx + c1 * r1, y + h, cz + s1 * r1], [cx + c2 * r1, y + h, cz + s2 * r1]], [-Math.cos(tm), 0, -Math.sin(tm)], I));
      f.push(quad([[cx + c1 * r1, y + h, cz + s1 * r1], [cx + c1 * r2, y + h, cz + s1 * r2], [cx + c2 * r2, y + h, cz + s2 * r2], [cx + c2 * r1, y + h, cz + s2 * r1]], [0, 1, 0], T));
      outline.push([cx + c1 * r2, cz + s1 * r2]); outline.push([cx + c1 * r1, cz + s1 * r1]);
      if (i === n - 1) { outline.push([cx + c2 * r2, cz + s2 * r2]); outline.push([cx + c2 * r1, cz + s2 * r1]); }
    }
    var ca = Math.cos(a0), sa = Math.sin(a0), cb = Math.cos(a1), sb = Math.sin(a1);
    f.push(quad([[cx + ca * r1, y, cz + sa * r1], [cx + ca * r2, y, cz + sa * r2], [cx + ca * r2, y + h, cz + sa * r2], [cx + ca * r1, y + h, cz + sa * r1]], [sa, 0, -ca], I));
    f.push(quad([[cx + cb * r2, y, cz + sb * r2], [cx + cb * r1, y, cz + sb * r1], [cx + cb * r1, y + h, cz + sb * r1], [cx + cb * r2, y + h, cz + sb * r2]], [-sb, 0, cb], I));
    var am = (a0 + a1) / 2;
    this.objs.push({ faces: f, at: [cx + Math.cos(am) * (r1 + r2) / 2, y + h / 2, cz + Math.sin(am) * (r1 + r2) / 2], k: o.k || 0, noedge: o.noedge });
    if (o.cast !== false) this.cast(outline, y + h);
  };

  /* Branch: tapered limb from A to B (radii r1 → r2), drawn as a shaded ribbon. */
  Scene.prototype.limb = function (A, B, r1, r2, col, o) {
    o = o || {};
    this.objs.push({ limb: [A, B], r1: r1, r2: r2, col: hex(col), at: [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2], faces: [], k: o.k || 0 });
  };

  /* Sprite: an image anchored to a floor point. ax/ay = anchor in image px, ppm = image px per metre. */
  Scene.prototype.sprite = function (img, x, z, o) {
    if (!img || !img.complete || !img.naturalWidth) return;
    this.objs.push({ sprite: img, x: x, z: z, ax: o.ax, ay: o.ay, ppm: o.ppm, bw: o.bw, at: [x, 0, z], faces: [], k: o.k || 0 });
  };

  Scene.prototype.person = function (x, z, col, h) {
    h = h || 1.75;

    var C = col || '#1E3347';

    this.cyl(x,0,z,0.15,h*0.8,C,{
      seg:10,
      top:C,
      noedge:1
    });

    this.objs.push({
      head: [x,h*0.9,z],
      r: 0.13,
      col: hex(C),
      at: [x,h*0.4,z],
      faces: [],
      k: 0.001
    });
  };

  Scene.prototype.floor = function (pts, col, o) {
    o = o || {};

    this.ground.push({
      pts: pts,
      col: hex(col),
      a: o.a,
      line: o.line
    });
  };

  Scene.prototype.rect = function (x,z,w,d,col,o) {
    this.floor([
      [x,(o && o.y)||0,z],
      [x+w,(o && o.y)||0,z],
      [x+w,(o && o.y)||0,z+d],
      [x,(o && o.y)||0,z+d]
    ],col,o);
  };

  Scene.prototype.disc = function (cx,cz,r,col,o) {
    var pts = [];
    var n = 40;
    var y = (o && o.y) || 0;

    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2;
      pts.push([
        cx + Math.cos(a)*r,
        y,
        cz + Math.sin(a)*r
      ]);
    }

    this.floor(pts,col,o);
  };

  Scene.prototype.glow = function (x,z,r,col,a) {
    this.ground.push({
      glow:true,
      at:[x,0,z],
      r:r,
      col:hex(col),
      a:a
    });
  };

  Scene.prototype.line = function (a,b,col,w,label,thin) {
    this.overlay.push({
      a:a,
      b:b,
      col:col,
      w:w||1,
      label:label,
      thin:thin
    });
  };

  Scene.prototype.text = function (at,str,col) {
    this.overlay.push({
      at:at,
      str:str,
      col:col
    });
  };

  Scene.prototype.draw = function () {
    var ctx = this.ctx;
    var self = this;

    ctx.clearRect(0,0,this.w,this.h);

    if (this.bg) {
      ctx.fillStyle = this.bg;
      ctx.fillRect(0,0,this.w,this.h);
    }

    function path(pts) {
      ctx.beginPath();

      for (var i = 0; i < pts.length; i++) {
        var q = self.p(pts[i][0],pts[i][1],pts[i][2]);

        if (i) {
          ctx.lineTo(q[0],q[1]);
        } else {
          ctx.moveTo(q[0],q[1]);
        }
      }

      ctx.closePath();
    }

    // Ground layer.
    this.ground.forEach(function (g) {
      if (g.glow) {
        var q = self.p(g.at[0],0,g.at[2]);
        var r = g.r*self.scale;

        ctx.save();
        ctx.translate(q[0],q[1]);
        ctx.scale(1,Math.sin(self.pitch));

        var gr = ctx.createRadialGradient(0,0,0,0,0,r);

        gr.addColorStop(0,rgb(g.col,1,g.a));
        gr.addColorStop(1,rgb(g.col,1,0));

        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(0,0,r,0,Math.PI*2);
        ctx.fill();
        ctx.restore();

        return;
      }

      path(g.pts);
      ctx.fillStyle = rgb(g.col,1,g.a);
      ctx.fill();

      if (g.line) {
        ctx.strokeStyle = g.line;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });

    // Soft cast shadows.
    if (this.shadows.length) {
      ctx.fillStyle = 'rgba(27,48,68,' + this.shade + ')';

      this.shadows.forEach(function (sh) {
        var pts = sh.foot.concat(
          sh.foot.map(function (q) {
            return [
              q[0] + sh.top*self.sdir[0],
              q[1] + sh.top*self.sdir[1]
            ];
          })
        );

        path(hull(pts).map(function (q) {
          return [q[0],0.01,q[1]];
        }));

        ctx.fill();
      });
    }

    // Objects back to front.
    var objs = this.objs.map(function (o) {
      return {
        o:o,
        d:self.p(o.at[0],o.at[1],o.at[2])[2]+o.k
      };
    });

    objs.sort(function (a,b) {
      return a.d-b.d;
    });

    objs.forEach(function (it) {
      var o = it.o;

      if (o.ball) {
        var b = self.p(o.ball[0],o.ball[1],o.ball[2]);
        var br = o.r*self.scale;

        var g = ctx.createRadialGradient(
          b[0]-br*0.35,
          b[1]-br*0.4,
          br*0.1,
          b[0],
          b[1],
          br
        );

        g.addColorStop(0,rgb(o.col,1.28));
        g.addColorStop(1,rgb(o.col,0.78));

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b[0],b[1],br,0,Math.PI*2);
        ctx.fill();

        return;
      }

      if (o.sprite) {
        var sp = self.p(o.x, 0, o.z), f = self.scale / o.ppm, iw = o.bw, ih = o.bw * o.sprite.naturalHeight / o.sprite.naturalWidth;
        ctx.drawImage(o.sprite, sp[0] - o.ax * f, sp[1] - o.ay * f, iw * f, ih * f);
        return;
      }

      if (o.limb) {
        var la = self.p(o.limb[0][0], o.limb[0][1], o.limb[0][2]), lb = self.p(o.limb[1][0], o.limb[1][1], o.limb[1][2]);
        var dx = lb[0] - la[0], dy = lb[1] - la[1], dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl;
        var w1 = o.r1 * self.scale, w2 = o.r2 * self.scale;
        ctx.fillStyle = rgb(o.col, 0.86);
        ctx.beginPath(); ctx.moveTo(la[0] + nx * w1, la[1] + ny * w1); ctx.lineTo(lb[0] + nx * w2, lb[1] + ny * w2);
        ctx.lineTo(lb[0] - nx * w2, lb[1] - ny * w2); ctx.lineTo(la[0] - nx * w1, la[1] - ny * w1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = rgb(o.col, 1.04);                                   // lit side
        var s1 = nx < 0 ? 1 : -1;
        ctx.beginPath(); ctx.moveTo(la[0] + s1 * nx * w1, la[1] + s1 * ny * w1); ctx.lineTo(lb[0] + s1 * nx * w2, lb[1] + s1 * ny * w2);
        ctx.lineTo(lb[0] + s1 * nx * w2 * 0.1, lb[1] + s1 * ny * w2 * 0.1); ctx.lineTo(la[0] + s1 * nx * w1 * 0.1, la[1] + s1 * ny * w1 * 0.1); ctx.closePath(); ctx.fill();
        return;
      }

      if (o.leaf) {
        var lc = self.p(o.leaf[0], o.leaf[1], o.leaf[2]), lr = Math.max(2, Math.round(o.r * self.scale));
        var spr = leafSprite(o.pal % 3, o.seed % 9, lr, self.dpr);
        ctx.drawImage(spr, lc[0] - lr * 1.3, lc[1] - lr * 1.3, lr * 2.6, lr * 2.6);
        return;
      }

      if (o.head) {
        var q = self.p(o.head[0],o.head[1],o.head[2]);

        ctx.fillStyle = rgb(o.col,1.15);
        ctx.beginPath();
        ctx.arc(q[0],q[1],o.r*self.scale,0,Math.PI*2);
        ctx.fill();

        return;
      }

      var fs = o.faces.map(function (f) {
        var s = 0;

        for (var i = 0; i < f.pts.length; i++) {
          s += self.p(
            f.pts[i][0],
            f.pts[i][1],
            f.pts[i][2]
          )[2];
        }

        return {
          f:f,
          d:s/f.pts.length,
          v:self.facing(f.n)
        };
      }).filter(function (x) {
        if (o.side === 'back') return x.v <= 0;
        if (o.side === 'front') return x.v > 0;
        return x.v > 0 || x.f.both;
      });

      fs.sort(function (a,b) {
        return a.d-b.d;
      });

      fs.forEach(function (x) {
        var f = x.f;
        var n = f.n;

        var lam = Math.max(
          0,
          n[0]*L[0]+n[1]*L[1]+n[2]*L[2]
        );

        var k = self.amb+self.dif*lam;

        if (x.v <= 0) k *= self.back;

        path(f.pts);

        ctx.fillStyle = rgb(f.col,f.glow ? 1.08 : k,f.a);
        ctx.fill();

        if (f.line) {
          ctx.strokeStyle = f.line;
          ctx.lineWidth = 1;
          ctx.stroke();
        } else if (self.edge && !f.glow && !o.noedge) {
          ctx.strokeStyle = self.edge;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        } else if (o.noedge && !f.glow) {
          ctx.strokeStyle = ctx.fillStyle;   // seal hairline seams between curved segments
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      });
    });

    // Overlay.
    ctx.font = '600 12px "Lato", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    this.overlay.forEach(function (ov) {
      if (ov.a) {
        var a = self.p(ov.a[0],ov.a[1],ov.a[2]);
        var b = self.p(ov.b[0],ov.b[1],ov.b[2]);

        ctx.strokeStyle = ov.col;
        ctx.lineWidth = ov.w;
        ctx.beginPath();
        ctx.moveTo(a[0],a[1]);
        ctx.lineTo(b[0],b[1]);
        ctx.stroke();

        if (!ov.thin) {
          [a,b].forEach(function (q) {
            ctx.beginPath();
            ctx.arc(q[0],q[1],2.5,0,Math.PI*2);
            ctx.fillStyle = ov.col;
            ctx.fill();
          });
        }

        if (ov.label) {
          var mx = (a[0]+b[0])/2;
          var my = (a[1]+b[1])/2;
          var tw = ctx.measureText(ov.label).width+14;

          ctx.fillStyle = ov.col;
          roundRect(ctx,mx-tw/2,my-11,tw,22,11);
          ctx.fill();

          ctx.fillStyle = '#fff';
          ctx.fillText(ov.label,mx,my+0.5);
        }
      } else if (ov.at) {
        var q = self.p(ov.at[0],ov.at[1],ov.at[2]);

        ctx.fillStyle = ov.col;
        ctx.fillText(ov.str,q[0],q[1]);
      }
    });
  };

  function roundRect(ctx,x,y,w,h,r) {
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }

  /* ------------------------------------------
     SHOW FLOOR
  ------------------------------------------ */

  var reduce = global.matchMedia &&
    global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function showFloor(canvas) {
    var narrow = function () {
      return canvas.getBoundingClientRect().width < 700;
    };

    var S = new Scene(canvas,{
      yaw:0.78,
      pitch:0.35,
      fit:30,
      offset:[0.5,0.5],
      amb:0.86,
      dif:0.16,
      back:0.9,
      edge:'rgba(27,48,68,.14)',
      shadow:0.06,
      maxDpr:2
    });

    var plots = [];

    for (var gx = -4; gx <= 4; gx++) {
      for (var gz = -3; gz <= 3; gz++) {
        if (Math.hypot(gx * 4, gz * 4) < 9.2) continue;   // open plaza around the Flo stand

        plots.push([
          gx*4-1.5,
          gz*4-1.5,
          (gx*7+gz*3)%3
        ]);
      }
    }

    function build(t) {
      S.clear();

      plots.forEach(function (p) {
        shell(S,p[0],p[1],p[2]);
      });

      floStand(S,t);

    }

    var spots = (function () {
      var r = [], D = Math.PI / 180;
      [[15,5.15],[45,5.3],[75,5.2],[100,5.35],[130,5.15],[160,5.3],
       [200,5.2],[235,5.35],[265,5.15],[295,5.3],[320,5.2],[345,5.35]].forEach(function (p) {
        r.push([Math.cos(p[0] * D) * p[1], Math.sin(p[0] * D) * p[1]]);
      });
      return r;
    })();

    // Each visitor walks in along the aisle on their side, then turns to their spot.
    var routes = spots.map(function (s,i) {
      if (Math.abs(s[0])>=Math.abs(s[1])) {
        return ['x', s[0]>=0 ? 1 : -1, (i%2 ? -2 : 2)];
      }
      return ['z', s[1]>=0 ? 1 : -1, (i%2 ? -2 : 2)];
    });

    var crowd = spots.map(function (s,i) {
      var r = routes[i];
      var far = 15+(i%3)*1.5;
      var near = 5.2;

      var a0 = r[0]==='x'
        ? [r[1]*far,r[2]]
        : [r[2],r[1]*far];

      var a1 = r[0]==='x'
        ? [r[1]*near,r[2]]
        : [r[2],r[1]*near];

      return {
        x:s[0],
        z:s[1],
        a0:a0,
        a1:a1,
        delay:250+i*190
      };
    });

    var last = 0;

    var t0 = performance.now();
    var px = 0, tx = 0, zm = 0, tz = 0;
    var visible = true, raf = 0, base = 30;

    function frame(now) {
      raf = 0;

      px += (tx-px)*0.05;
      zm += (tz-zm)*0.04;

      var t = now-t0;

      S.yaw = 0.78+Math.sin(t/14000)*0.06+px*0.08;
      S.fit = base/(1+zm*0.09);
      S.scale = Math.min(S.w,S.h*1.6)/S.fit;

      build(t);
      S.draw();

      if (visible && !reduce) {
        raf = requestAnimationFrame(frame);
      }
    }

    function kick() {
      if (!raf) raf = requestAnimationFrame(frame);
    }

    function layout() {
      base = S.fit = narrow() ? 25 : 39;
      S.offset = narrow() ? [0.5,0.6] : [document.dir === 'rtl' ? 0.4 : 0.6,0.6];
      S.resize();
    }

    canvas.parentElement.addEventListener('pointermove',function (e) {
      var r = canvas.getBoundingClientRect();

      tx = (e.clientX-r.left)/r.width-0.5;
      tz = 1;

      kick();
    },{passive:true});

    canvas.parentElement.addEventListener('pointerleave',function () {
      tz = 0;
      tx = 0;
      kick();
    });

    if ('IntersectionObserver' in global) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible) kick();
      },{threshold:0.01}).observe(canvas);
    }

    document.addEventListener('visibilitychange',function () {
      visible = !document.hidden;
      if (visible) kick();
    });

    var rz;

    global.addEventListener('resize',function () {
      clearTimeout(rz);

      rz = setTimeout(function () {
        layout();
        kick();
      },120);
    });

    layout();
    build(reduce ? 1e6 : 0);
    S.draw();
    kick();
  }

  /* ------------------------------------------
     STANDARD SHELL BOOTHS
  ------------------------------------------ */

  function shell(S,x,z,v) {
    var wall = '#FFFFFF';
    var top = '#D9E0DF';

    S.rect(x,z,3,3,'#E8ECEA',{y:0.005});

    S.box(x,0,z,3,2.5,0.08,wall,{
      top:top
    });

    if (v!==1) {
      S.box(
        v===0 ? x : x+2.92,
        0,z,
        0.08,2.5,3,
        wall,
        {top:top}
      );
    }

    if (v!==2) {
      S.box(
        x,2.2,z+2.92,
        3,0.3,0.06,
        '#EEF1F0',
        {
          front:'#E4E9E8',
          cast:false
        }
      );
    }

    S.box(
      x+0.9,0,z+1.9,
      1.2,1,0.5,
      '#EEF1F0',
      {top:'#E2E7E6'}
    );
  }

  /* ------------------------------------------
     FLO CREATIVE SIGNATURE STAND
     Tree of Life · Eurospine-inspired
  ------------------------------------------ */

  /* The Flo stand: a quiet 8 x 8 m island. One navy wall that turns through a coral curve into a short
     navy return, a pale platform, one curved counter and one table. Live detail: a slow pulse into the aisles. */
  function floStand(S, t) {
    var navy = '#2F4E6B', coral = '#E07D54', live = t > 0 && t < 1e6;
    var A = -4, Z = 8, H = 3.2, R = 2.2, T = 0.18, P = 0.12;

    S.glow(0, 0, 7, '#74B9B1', 0.12);
    if (live) {
      var ph = (t % 4800) / 4800;
      S.disc(0, 0, 5.6 + ph * 4, '#FFFFFF', { y: 0.02, a: 0, line: 'rgba(224,125,84,' + (0.35 * (1 - ph)).toFixed(3) + ')' });
    }

    S.box(A, 0, A, Z, P, Z, '#FFFFFF', { top: '#F1ECE4', front: '#ECEFEE', cast: false, k: -2 });

    S.box(A + R, P, A, Z - R, H, T, navy, { top: '#45657F', front: '#34567A', k: -1 });
    S.arc(A + R, P, A + R, R - T, R, H, Math.PI, Math.PI * 1.5, coral, { seg: 24, top: '#EA9471', inner: '#E3865F', k: -1, noedge: 1 });
    S.box(A, P, A + R, T, H, 2.6, navy, { top: '#45657F', k: -1 });

    S.box(0.6, P, 2.2, 2.6, 1.0, 0.6, '#FFFFFF', { top: coral });
    S.cyl(-0.6, P, -0.4, 0.6, 0.74, '#FFFFFF', { seg: 28, top: '#FAFAF8', noedge: 1 });
  }

  /* ------------------------------------------
     STAND CONFIGURATOR
  ------------------------------------------ */

  function standPlanner(canvas,state) {
    var S = new Scene(canvas,{
      yaw:0.62,
      pitch:0.6,
      fit:18,
      offset:[0.5,0.58],
      amb:0.7,
      dif:0.32,
      edge:'rgba(27,48,68,.16)',
      shadow:0.07
    });

    var dragging = false;
    var sx = 0;
    var sy0 = 0;
    var raf = 0;
    var label = state.labels || {};

    function build() {
      var W = state.w;
      var D = state.d;
      var H = state.h;
      var type = state.type;

      S.clear();

      var m = Math.max(W,D);

      S.fit = m*1.3+2.6;
      S.focus = [0,H*0.35,0];
      S.resize();

      var x0 = -W/2;
      var z0 = -D/2;

      S.rect(x0-2,z0-2,W+4,D+4,'#E4EAE7');
      S.rect(x0,z0,W,D,'#FFFFFF',{y:0.06});

      for (var gx=1;gx<W;gx++) {
        S.floor([
          [x0+gx,0.07,z0],
          [x0+gx+0.02,0.07,z0],
          [x0+gx+0.02,0.07,z0+D],
          [x0+gx,0.07,z0+D]
        ],'#E6ECEA');
      }

      for (var gz=1;gz<D;gz++) {
        S.floor([
          [x0,0.07,z0+gz],
          [x0+W,0.07,z0+gz],
          [x0+W,0.07,z0+gz+0.02],
          [x0,0.07,z0+gz+0.02]
        ],'#E6ECEA');
      }

      var navy = '#304F6C';
      var teal = '#F4F6F5';
      var t = 0.12;

      if (type!=='island') {
        S.box(x0,0,z0,W,H,t,navy,{
          top:'#4A6A86',
          front:'#3B6080',
          k:-1
        });
      }

      if (type==='inline'||type==='corner') {
        S.box(x0,0,z0,t,H,D,teal,{
          top:'#D9E0DF',
          k:-1
        });
      }

      if (type==='inline') {
        S.box(x0+W-t,0,z0,t,H,D,teal,{
          top:'#D9E0DF',
          k:-1
        });
      }

      if (type!=='island') {
        S.box(
          x0+W*0.15,
          H*0.55,
          z0+t,
          W*0.7,
          H*0.18,
          0.02,
          '#E07D54',
          {k:-0.5}
        );
      }

      S.box(
        -Math.min(1.2,W/4),
        0.06,
        z0+D*0.62,
        Math.min(2.4,W/2),
        1.05,
        0.6,
        '#F4F6F5',
        {
          top:'#D9C3A6',
          front:'#E07D54'
        }
      );

      // Feature: island / peninsula get a central display totem, others a back-wall screen.
      if (type==='island'||type==='peninsula') {
        var tw = Math.min(1.2, W / 5);
        S.box(-tw / 2, 0.06, -tw / 2, tw, Math.min(H, 3.2), tw, '#F4F6F5', { top: '#ffffff', front: '#304F6C' });
        S.box(-tw / 2 - 0.01, Math.min(H, 3.2) * 0.55, tw / 2, tw + 0.02, 0.14, 0.02, '#E07D54', { cast: false });
      } else {
        S.box(
          x0+W*0.3,
          1.1,
          z0+t+0.02,
          W*0.4,
          Math.min(1.6,H*0.45),
          0.05,
          '#1E3347',
          {k:-0.4}
        );
      }

      if (W*D>=30) {
        S.cyl(
          x0+W*0.78,
          0.06,
          z0+D*0.32,
          0.45,
          0.95,
          '#B98A5E',
          {
            seg:14,
            top:'#F2EEE8'
          }
        );
      }

      S.person(
        x0+W*0.22,
        z0+D*0.78,
        '#1E3347',
        1.75
      );

      var off = 0.9;

      S.line(
        [x0,0.08,z0+D+off],
        [x0+W,0.08,z0+D+off],
        '#E07D54',
        1.5,
        W+' m'
      );

      S.line(
        [x0+W+off,0.08,z0+D],
        [x0+W+off,0.08,z0],
        '#304F6C',
        1.5,
        D+' m'
      );

      S.line(
        [x0-off,0,z0],
        [x0-off,H,z0],
        '#5D7183',
        1.2,
        H+' m'
      );
    }

    function render() {
      raf = 0;
      build();
      S.draw();
    }

    function kick() {
      if (!raf) raf = requestAnimationFrame(render);
    }

    canvas.addEventListener('pointerdown',function (e) {
      dragging = true;
      sx = e.clientX;
      sy0 = S.yaw;
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove',function (e) {
      if (!dragging) return;

      S.yaw = sy0+(e.clientX-sx)*0.01;
      kick();
    });

    canvas.addEventListener('pointerup',function () {
      dragging = false;
    });

    canvas.addEventListener('keydown',function (e) {
      if (e.key==='ArrowLeft') {
        S.yaw -= 0.15;
        kick();
      }

      if (e.key==='ArrowRight') {
        S.yaw += 0.15;
        kick();
      }
    });

    var rz;

    global.addEventListener('resize',function () {
      clearTimeout(rz);
      rz = setTimeout(kick,120);
    });

    if ('ResizeObserver' in global) {
      new ResizeObserver(kick).observe(canvas);
    }

    kick();

    return {update:kick};
  }

  /* ------------------------------------------
     INTERIOR SPACE PLANNER
  ------------------------------------------ */

  function spacePlanner(canvas,state) {
    var S = new Scene(canvas,{
      yaw:0.62,
      pitch:0.62,
      fit:18,
      offset:[0.5,0.6],
      amb:0.72,
      dif:0.3,
      edge:'rgba(27,48,68,.14)',
      shadow:0.06
    });

    var raf = 0;
    var dragging = false;
    var sx = 0;
    var sy0 = 0;

    function build() {
      var A = state.area;
      var ratio = 1.4;

      var W = Math.round(Math.sqrt(A*ratio)*10)/10;
      var D = Math.round(A/W*10)/10;
      var H = 3.2;

      S.clear();

      S.fit = Math.max(W,D)*1.3+2.4;
      S.focus = [0,1,0];
      S.resize();

      var x0 = -W/2;
      var z0 = -D/2;

      S.rect(x0-1.5,z0-1.5,W+3,D+3,'#E4EAE7');

      S.rect(
        x0,z0,W,D,
        state.type==='fnb' ? '#EADFD2' : '#F7F7F4',
        {y:0.05}
      );

      S.box(
        x0,0,z0,W,H,0.15,
        '#F4F6F5',
        {
          top:'#CBD5D9',
          front:'#EEF1EF',
          k:-2
        }
      );

      S.box(
        x0,0,z0,0.15,H,D,
        '#E3E9E7',
        {
          top:'#CBD5D9',
          k:-2
        }
      );

      S.box(
        x0+0.15,H-0.5,z0+0.16,
        W-0.15,0.32,0.02,
        '#304F6C',
        {k:-1.5}
      );

      var n = Math.max(1,Math.min(14,Math.round(A/25)));
      var type = state.type;
      var rand = mulberry(3);

      if (type==='retail'||type==='showroom') {
        var shelves = Math.max(2,Math.floor((W-1)/1.6));

        for (var i=0;i<shelves;i++) {
          S.box(
            x0+0.5+i*1.6,
            0.05,
            z0+0.2,
            1.3,2.1,0.45,
            '#FFFFFF',
            {
              top:'#E07D54',
              k:-1
            }
          );
        }

        for (var j=0;j<Math.min(6,n);j++) {
          var px = x0+W*(0.3+0.4*((j%3)/2));
          var pz = z0+D*(0.35+0.3*Math.floor(j/3));

          if (type==='showroom') {
            S.cyl(
              px,0.05,pz,
              0.5,0.9,
              '#FFFFFF',
              {
                seg:16,
                top:'#74B9B1'
              }
            );
          } else {
            S.box(
              px-0.6,0.05,pz-0.4,
              1.2,0.9,0.8,
              '#B98A5E',
              {top:'#F2EEE8'}
            );
          }
        }
      } else if (type==='fnb') {
        S.box(
          x0+0.4,0.05,z0+0.6,
          Math.min(4,W*0.5),
          1.1,0.7,
          '#304F6C',
          {top:'#D9C3A6'}
        );

        for (var k=0;k<n+2;k++) {
          var tx = x0+1+rand()*(W-2);
          var tz = z0+2+rand()*(D-2.6);

          S.cyl(
            tx,0.05,tz,
            0.4,0.75,
            '#B98A5E',
            {
              seg:14,
              top:'#F2EEE8'
            }
          );

          S.cyl(
            tx+0.6,0.05,tz,
            0.2,0.45,
            '#74B9B1',
            {seg:10}
          );

          S.cyl(
            tx-0.6,0.05,tz,
            0.2,0.45,
            '#74B9B1',
            {seg:10}
          );
        }
      } else {
        S.cyl(
          0,0.05,0,
          Math.min(1.4,W/4),
          1.05,
          '#FFFFFF',
          {
            seg:24,
            top:'#E07D54'
          }
        );

        var kr = Math.min(1.4,W/4);
        S.cyl(0,0.05,0,0.12,2.2,'#304F6C',{seg:10});
        S.cyl(0,2.25,0,kr+0.3,0.12,'#F4F6F5',{seg:24,top:'#74B9B1'});
      }

      S.person(
        x0+W*0.7,
        z0+D*0.82,
        '#1E3347',
        1.75
      );

      S.line(
        [x0,0.06,z0+D+0.8],
        [x0+W,0.06,z0+D+0.8],
        '#E07D54',
        1.5,
        '\u2248 '+W+' m'
      );

      S.line(
        [x0+W+0.8,0.06,z0+D],
        [x0+W+0.8,0.06,z0],
        '#304F6C',
        1.5,
        '\u2248 '+D+' m'
      );
    }

    function render() {
      raf = 0;
      build();
      S.draw();
    }

    function kick() {
      if (!raf) raf = requestAnimationFrame(render);
    }

    canvas.addEventListener('pointerdown',function (e) {
      dragging = true;
      sx = e.clientX;
      sy0 = S.yaw;
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove',function (e) {
      if (!dragging) return;

      S.yaw = sy0+(e.clientX-sx)*0.01;
      kick();
    });

    canvas.addEventListener('pointerup',function () {
      dragging = false;
    });

    canvas.addEventListener('keydown',function (e) {
      if (e.key==='ArrowLeft') {
        S.yaw -= 0.15;
        kick();
      }

      if (e.key==='ArrowRight') {
        S.yaw += 0.15;
        kick();
      }
    });

    if ('ResizeObserver' in global) {
      new ResizeObserver(kick).observe(canvas);
    }

    kick();

    return {update:kick};
  }

  /* ------------------------------------------
     DETERMINISTIC RANDOM HELPER
  ------------------------------------------ */

  function mulberry(a) {
    return function () {
      a |= 0;
      a = a+0x6D2B79F5|0;

      var t = Math.imul(a^a>>>15,1|a);

      t = t+Math.imul(t^t>>>7,61|t)^t;

      return ((t^t>>>14)>>>0)/4294967296;
    };
  }

  // Public API.
  global.FloIso = {
    Scene:Scene,
    showFloor:showFloor,
    standPlanner:standPlanner,
    spacePlanner:spacePlanner
  };

})(window);
