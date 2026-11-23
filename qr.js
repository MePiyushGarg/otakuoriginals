/* =====================================================================
   qr.js — tiny offline QR code generator (byte mode, error-correction M,
   versions 1-10, up to ~213 characters). No internet or libraries needed.
   Usage:  OOQR.svg("upi://pay?pa=name@bank&am=100", { size: 240 })  ->  "<svg ...>"
   Based on the public QR Code specification (ISO/IEC 18004).
   ===================================================================== */
(function (root) {
  "use strict";

  // Level M tables for versions 1..10 (index = version)
  var ECC_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
  var NUM_BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];

  function bit(x, i) { return ((x >>> i) & 1) !== 0; }

  function rawModules(ver) {
    var r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      var n = Math.floor(ver / 7) + 2;
      r -= (25 * n - 10) * n - 55;
      if (ver >= 7) r -= 36;
    }
    return r;
  }
  function dataCodewords(ver) {
    return Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver];
  }

  /* ---------- Reed-Solomon over GF(256) ---------- */
  function gfMul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
    return z;
  }
  function rsDivisor(degree) {
    var res = [], i, j;
    for (i = 0; i < degree - 1; i++) res.push(0);
    res.push(1);
    var root = 1;
    for (i = 0; i < degree; i++) {
      for (j = 0; j < degree; j++) {
        res[j] = gfMul(res[j], root);
        if (j + 1 < degree) res[j] ^= res[j + 1];
      }
      root = gfMul(root, 2);
    }
    return res;
  }
  function rsRemainder(data, divisor) {
    var res = divisor.map(function () { return 0; });
    data.forEach(function (b) {
      var factor = b ^ res.shift();
      res.push(0);
      divisor.forEach(function (coef, i) { res[i] ^= gfMul(coef, factor); });
    });
    return res;
  }

  /* ---------- text -> UTF-8 bytes ---------- */
  function utf8(str) {
    var s = unescape(encodeURIComponent(str)), out = [];
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }

  /* ---------- build codewords (data + ecc, interleaved) ---------- */
  function buildCodewords(bytes, ver) {
    var capBits = dataCodewords(ver) * 8, bits = [];
    function push(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    push(4, 4);                                   // byte mode
    push(bytes.length, ver < 10 ? 8 : 16);        // char count
    bytes.forEach(function (b) { push(b, 8); });
    push(0, Math.min(4, capBits - bits.length));  // terminator
    while (bits.length % 8) bits.push(0);
    for (var pad = 0xEC; bits.length < capBits; pad ^= 0xEC ^ 0x11) push(pad, 8);
    var data = [];
    for (var i = 0; i < bits.length; i += 8) {
      var v = 0; for (var k = 0; k < 8; k++) v = (v << 1) | bits[i + k]; data.push(v);
    }
    var nb = NUM_BLOCKS[ver], eccLen = ECC_PER_BLOCK[ver];
    var raw = Math.floor(rawModules(ver) / 8);
    var numShort = nb - (raw % nb), shortLen = Math.floor(raw / nb);
    var blocks = [], div = rsDivisor(eccLen), off = 0;
    for (var b = 0; b < nb; b++) {
      var len = shortLen - eccLen + (b < numShort ? 0 : 1);
      var dat = data.slice(off, off + len); off += len;
      var ecc = rsRemainder(dat, div);
      if (b < numShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    var out = [];
    for (var x = 0; x < blocks[0].length; x++) {
      for (var j = 0; j < nb; j++) {
        if (x !== shortLen - eccLen || j >= numShort) out.push(blocks[j][x]);
      }
    }
    return out;
  }

  /* ---------- draw the symbol ---------- */
  function makeMatrix(ver, codewords, forceMask) {
    var size = ver * 4 + 17, m = [], fn = [], y, x;
    for (y = 0; y < size; y++) { m.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    function setFn(px, py, dark) { m[py][px] = dark; fn[py][px] = true; }

    for (var i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
    function finder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var d = Math.max(Math.abs(dx), Math.abs(dy)), xx = cx + dx, yy = cy + dy;
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) setFn(xx, yy, d !== 2 && d !== 4);
      }
    }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);

    var pos = [];
    if (ver > 1) {
      var n = Math.floor(ver / 7) + 2;
      var step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
      pos = [6];
      for (var p = size - 7; pos.length < n; p -= step) pos.splice(1, 0, p);
    }
    for (var a = 0; a < pos.length; a++) for (var c = 0; c < pos.length; c++) {
      if ((a === 0 && c === 0) || (a === 0 && c === pos.length - 1) || (a === pos.length - 1 && c === 0)) continue;
      for (var dy2 = -2; dy2 <= 2; dy2++) for (var dx2 = -2; dx2 <= 2; dx2++)
        setFn(pos[a] + dx2, pos[c] + dy2, Math.max(Math.abs(dx2), Math.abs(dy2)) !== 1);
    }

    function formatBits(mask) {
      var data = (0 << 3) | mask, rem = data;                   // 0 = error level M
      for (var k = 0; k < 10; k++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var bits = ((data << 10) | rem) ^ 0x5412, k2;
      for (k2 = 0; k2 <= 5; k2++) setFn(8, k2, bit(bits, k2));
      setFn(8, 7, bit(bits, 6)); setFn(8, 8, bit(bits, 7)); setFn(7, 8, bit(bits, 8));
      for (k2 = 9; k2 < 15; k2++) setFn(14 - k2, 8, bit(bits, k2));
      for (k2 = 0; k2 < 8; k2++) setFn(size - 1 - k2, 8, bit(bits, k2));
      for (k2 = 8; k2 < 15; k2++) setFn(8, size - 15 + k2, bit(bits, k2));
      setFn(8, size - 8, true);
    }
    formatBits(0);                                              // reserve the area
    if (ver >= 7) {
      var rem = ver;
      for (var q = 0; q < 12; q++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      var vb = (ver << 12) | rem;
      for (var t = 0; t < 18; t++) {
        var av = size - 11 + (t % 3), bv = Math.floor(t / 3);
        setFn(av, bv, bit(vb, t)); setFn(bv, av, bit(vb, t));
      }
    }

    // place data bits in the zig-zag order
    var idx = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var j = 0; j < 2; j++) {
          var px = right - j, upward = ((right + 1) & 2) === 0, py = upward ? size - 1 - vert : vert;
          if (!fn[py][px] && idx < codewords.length * 8) {
            m[py][px] = bit(codewords[idx >>> 3], 7 - (idx & 7)); idx++;
          }
        }
      }
    }

    function applyMask(mask) {
      for (var yy = 0; yy < size; yy++) for (var xx = 0; xx < size; xx++) {
        var inv;
        switch (mask) {
          case 0: inv = (xx + yy) % 2 === 0; break;
          case 1: inv = yy % 2 === 0; break;
          case 2: inv = xx % 3 === 0; break;
          case 3: inv = (xx + yy) % 3 === 0; break;
          case 4: inv = (Math.floor(xx / 3) + Math.floor(yy / 2)) % 2 === 0; break;
          case 5: inv = (xx * yy) % 2 + (xx * yy) % 3 === 0; break;
          case 6: inv = ((xx * yy) % 2 + (xx * yy) % 3) % 2 === 0; break;
          default: inv = ((xx + yy) % 2 + (xx * yy) % 3) % 2 === 0;
        }
        if (!fn[yy][xx] && inv) m[yy][xx] = !m[yy][xx];
      }
    }
    function penalty() {
      var score = 0, r, c, run, dark = 0;
      for (r = 0; r < size; r++) {
        run = 1;
        for (c = 1; c < size; c++) { if (m[r][c] === m[r][c - 1]) { run++; if (run === 5) score += 3; else if (run > 5) score++; } else run = 1; }
      }
      for (c = 0; c < size; c++) {
        run = 1;
        for (r = 1; r < size; r++) { if (m[r][c] === m[r - 1][c]) { run++; if (run === 5) score += 3; else if (run > 5) score++; } else run = 1; }
      }
      for (r = 0; r < size - 1; r++) for (c = 0; c < size - 1; c++) {
        var v = m[r][c]; if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
      }
      for (r = 0; r < size; r++) for (c = 0; c < size; c++) if (m[r][c]) dark++;
      score += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
      return score;
    }
    var best = 0, bestScore = Infinity;
    for (var mk = 0; mk < 8; mk++) {
      applyMask(mk); formatBits(mk);
      var sc = penalty(); if (sc < bestScore) { bestScore = sc; best = mk; }
      applyMask(mk);
    }
    if (forceMask !== undefined) best = forceMask;
    applyMask(best); formatBits(best);
    return m;
  }

  function matrix(text, forceMask) {
    var bytes = utf8(String(text)), ver;
    for (ver = 1; ver <= 10; ver++) {
      var bitsNeeded = 4 + (ver < 10 ? 8 : 16) + bytes.length * 8;
      if (bitsNeeded <= dataCodewords(ver) * 8) break;
    }
    if (ver > 10) throw new Error("Text too long for QR");
    return makeMatrix(ver, buildCodewords(bytes, ver), forceMask);
  }

  function svg(text, opts) {
    opts = opts || {};
    var m = matrix(text), n = m.length, quiet = 4, total = n + quiet * 2, d = "";
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (m[y][x]) d += "M" + (x + quiet) + "," + (y + quiet) + "h1v1h-1z";
    var size = opts.size || 240;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + " " + total + '" width="' + size + '" height="' + size +
      '" shape-rendering="crispEdges" role="img" aria-label="' + (opts.label || "QR code") + '"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#111"/></svg>';
  }

  var api = { svg: svg, matrix: matrix };
  root.OOQR = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
