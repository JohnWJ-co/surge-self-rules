/***************************************************************
 * 顺丰速运 · 会员签到【账号参数自动捕获】
 * 类型: Surge http-request 脚本 (MITM: *.sf-express.com)
 * 拦截: App 内置会员中心 H5 (mcs-mimp-web.sf-express.com) 的请求
 *
 * 作用:
 *   自动保存 H5 登录态 (sessionId / _login_user_id_ 等 Cookie) 与 deviceid
 *   —— 每次打开顺丰速运 App 即自动刷新，无需手动填账号。
 *   本脚本只负责捕获参数；签到由 sf-signin.js 定时执行。
 ***************************************************************/

var AUTO_SIGN_ON_OPEN = false;             // 打开 App 时是否顺手补签（纯定时签到请保持 false）
var TRY_THROTTLE_MS = 5 * 60 * 1000;       // 触发节流：5 分钟内最多尝试一次

var BASE = 'https://mcs-mimp-web.sf-express.com';
var API_GET_TODAY = BASE + '/mcs-mimp/commonPost/~memberNonactivity~integralSignV2Service~getTodaySign';
var API_SIGN = BASE + '/mcs-mimp/commonPost/~memberNonactivity~integralSignV2Service~sign';

var K_SESSION = 'sf_express_session';      // JSON: {cookie, deviceid, mobile, userId, ts}
var K_SIGN_DATE = 'sf_express_sign_date';  // 已完成签到的服务器日期 YYYY-MM-DD
var K_LAST_TRY = 'sf_express_last_try';    // 上次触发时间戳(ms)

/* ============================ 公共核心 ============================ */
function md5(input) {
  function add32(a, b) { return (a + b) & 0xFFFFFFFF; }
  function cmn(q, a, b, x, s, t) { a = add32(add32(a, q), add32(x, t)); return add32((a << s) | (a >>> (32 - s)), b); }
  function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
  function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
  function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
  function cycle(x, k) {
    var a = x[0], b = x[1], c = x[2], d = x[3];
    a = ff(a, b, c, d, k[0], 7, -680876936); d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819); b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897); d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341); b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416); d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063); b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682); d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290); b = ff(b, c, d, a, k[15], 22, 1236535329);
    a = gg(a, b, c, d, k[1], 5, -165796510); d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713); b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691); d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335); b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438); d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961); b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467); d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473); b = gg(b, c, d, a, k[12], 20, -1926607734);
    a = hh(a, b, c, d, k[5], 4, -378558); d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562); b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060); d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632); b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174); d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979); b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487); d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520); b = hh(b, c, d, a, k[2], 23, -995338651);
    a = ii(a, b, c, d, k[0], 6, -198630844); d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905); b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571); d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523); b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359); d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380); b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070); d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259); b = ii(b, c, d, a, k[9], 21, -343485551);
    x[0] = add32(a, x[0]); x[1] = add32(b, x[1]); x[2] = add32(c, x[2]); x[3] = add32(d, x[3]);
  }
  function blk(s) {
    var blks = [], i;
    for (i = 0; i < 64; i += 4) blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
    return blks;
  }
  function main(s) {
    var n = s.length, state = [1732584193, -271733879, -1732584194, 271733878], i;
    for (i = 64; i <= n; i += 64) cycle(state, blk(s.substring(i - 64, i)));
    s = s.substring(i - 64);
    var tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
    tail[i >> 2] |= 0x80 << ((i % 4) << 3);
    if (i > 55) { cycle(state, tail); for (i = 0; i < 16; i++) tail[i] = 0; }
    tail[14] = n * 8;
    cycle(state, tail);
    return state;
  }
  function rhex(v) { var s = '', j; for (j = 0; j < 4; j++) s += ('0' + ((v >> (j * 8)) & 0xFF).toString(16)).slice(-2); return s; }
  var str = unescape(encodeURIComponent(input));
  var x = main(str), out = '', i;
  for (i = 0; i < x.length; i++) out += rhex(x[i]);
  return out;
}

function makeSignature(ts) {
  return md5('token=wwesldfs29aniversaryvdld29&timestamp=' + ts + '&sysCode=MCS-MIMP-CORE');
}

function readStore(key) {
  try { return $persistentStore.read(key); } catch (e) { return null; }
}
function writeStore(key, value) {
  try { return $persistentStore.write(String(value), key); } catch (e) { return false; }
}
function readJSON(key) {
  var raw = readStore(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}
function localDateStr() {
  var d = new Date();
  var m = d.getMonth() + 1, day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
}
function timeStr() {
  var d = new Date();
  var h = d.getHours(), m = d.getMinutes();
  return (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m);
}

function buildHeaders(cookie, deviceid, ts) {
  var h = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'Origin': BASE,
    'Referer': BASE + '/up-member/newHome',
    'User-Agent': 'Mozilla/5.0 (iPad; CPU OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 mediaCode=SFEXPRESSAPP-iOS-ML',
    'channel': 'autoappicon',
    'syscode': 'MCS-MIMP-CORE',
    'platform': 'SFAPP',
    'timestamp': String(ts),
    'signature': makeSignature(ts),
    'accept-language': 'zh-CN,zh-Hans;q=0.9',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-mode': 'cors',
    'sec-fetch-dest': 'empty',
    'Cookie': cookie
  };
  if (deviceid) h['deviceid'] = deviceid;
  return h;
}

function postJSON(url, cookie, deviceid, cb) {
  var ts = Date.now();
  $httpClient.post({
    url: url,
    headers: buildHeaders(cookie, deviceid, ts),
    body: '{}',
    timeout: 20
  }, function (err, resp, data) {
    if (err) {
      cb({ netError: String(err) }, null);
      return;
    }
    var status = resp && resp.status ? resp.status : 0;
    var obj = null;
    try { obj = JSON.parse(data); } catch (e) { obj = null; }
    if (!obj) {
      cb({ netError: 'HTTP ' + status + ' 响应异常' }, null);
      return;
    }
    cb(null, obj);
  });
}

function extractAwardNum(obj) {
  try {
    if (obj.award && obj.award.productDTOList && obj.award.productDTOList.length) {
      return obj.award.productDTOList[0].amount || 0;
    }
  } catch (e) {}
  var keys = ['awardNum', 'awardPoint', 'awardIntegral', 'integralNum', 'points'];
  for (var i = 0; i < keys.length; i++) {
    if (obj[keys[i]] !== undefined && obj[keys[i]] !== null) return obj[keys[i]];
  }
  return null;
}

function serverDate(respDate) {
  if (respDate && typeof respDate === 'string' && respDate.length >= 10) return respDate.substring(0, 10);
  return localDateStr();
}

/* 检查并签到; opts: {notify: true/false, tag: '打开App' | '定时任务'} */
function checkAndSign(session, opts, cb) {
  var cookie = session.cookie, deviceid = session.deviceid;
  postJSON(API_GET_TODAY, cookie, deviceid, function (err, today) {
    if (err) {
      console.log('[SF:' + opts.tag + '] 状态查询失败: ' + err.netError);
      if (opts.notify) $notification.post('顺丰速运 · 签到失败', '查询签到状态失败', err.netError);
      cb(false);
      return;
    }
    if (today.success && today.obj && today.obj.signed === true) {
      var d1 = serverDate(today.date);
      var prev = readStore(K_SIGN_DATE);
      writeStore(K_SIGN_DATE, d1);
      var days1 = today.obj.dayCount || 0;
      console.log('[SF:' + opts.tag + '] 今日已签到 连签' + days1 + '天');
      if (opts.notify && prev !== d1) {
        $notification.post('顺丰速运 · 签到', '今日已签到', '连签 ' + days1 + ' 天 · ' + timeStr());
      }
      cb(true);
      return;
    }
    if (today.errorCode === '100111' || today.errorCode === 100111) {
      console.log('[SF:' + opts.tag + '] 登录态失效: ' + today.errorMessage);
      if (opts.notify) $notification.post('顺丰速运 · 签到失败', '登录态已失效', '请打开一次顺丰速运 App 自动刷新参数');
      cb(false);
      return;
    }
    // 未签到 -> 执行签到
    postJSON(API_SIGN, cookie, deviceid, function (err2, res) {
      if (err2) {
        console.log('[SF:' + opts.tag + '] 签到请求失败: ' + err2.netError);
        if (opts.notify) $notification.post('顺丰速运 · 签到失败', '网络请求失败', err2.netError);
        cb(false);
        return;
      }
      if (res.success) {
        var award = extractAwardNum(res.obj || {});
        var days = (res.obj && res.obj.dayCount) ? res.obj.dayCount : (today.obj && today.obj.dayCount ? today.obj.dayCount : 0);
        writeStore(K_SIGN_DATE, serverDate(res.date));
        var msg = (award !== null && award !== undefined) ? ('积分 +' + award) : '签到成功';
        console.log('[SF:' + opts.tag + '] 签到成功 ' + msg + ' 连签' + days + '天');
        if (opts.notify) $notification.post('顺丰速运 · 签到成功', msg, '连签 ' + days + ' 天 · ' + timeStr());
        cb(true);
        return;
      }
      if (String(res.errorCode) === '3400002') {
        writeStore(K_SIGN_DATE, serverDate(res.date));
        console.log('[SF:' + opts.tag + '] 今日已签到(接口返回): ' + res.errorMessage);
        if (opts.notify) $notification.post('顺丰速运 · 签到', '今日已签到', String(res.errorMessage || ''));
        cb(true);
        return;
      }
      console.log('[SF:' + opts.tag + '] 签到失败: ' + res.errorCode + ' ' + res.errorMessage);
      if (opts.notify) $notification.post('顺丰速运 · 签到失败', String(res.errorMessage || '未知错误'), '错误码 ' + res.errorCode);
      cb(false);
    });
  });
}

/* ============================ 脚本主体 ============================ */
(function () {
  var url = ($request && $request.url) ? $request.url : '';
  var headers = ($request && $request.headers) ? $request.headers : {};
  function getH(name) {
    for (var k in headers) {
      if (k.toLowerCase() === name) return headers[k];
    }
    return '';
  }
  var cookie = getH('cookie');
  var deviceid = getH('deviceid');

  // 1) 保存登录态（仅当请求携带 sessionId 时，才视为有效的会员中心会话）
  var changed = false;
  if (cookie && /(?:^|;\s*)sessionId=[^;]+/.test(cookie)) {
    var kept = cookie.split(/;\s*/).filter(function (c) {
      var n = c.split('=')[0];
      if (/^(sensorsdata|sa_jssdk|sajssdk)/.test(n)) return false;
      if (n === 'HWWAFSESID' || n === 'HWWAFSESTIME') return false;
      return true;
    }).join('; ');
    var mobile = (cookie.match(/_login_mobile_=([^;]+)/) || [])[1] || '';
    var userId = (cookie.match(/_login_user_id_=([^;]+)/) || [])[1] || '';
    var old = readJSON(K_SESSION) || {};
    if (old.cookie !== kept || (deviceid && old.deviceid !== deviceid)) {
      writeStore(K_SESSION, JSON.stringify({
        cookie: kept,
        deviceid: deviceid || old.deviceid || '',
        mobile: mobile || old.mobile || '',
        userId: userId || old.userId || '',
        ts: Date.now()
      }));
      changed = true;
      console.log('[SF:捕获] 登录参数已更新' + (mobile ? ' (' + mobile + ')' : '') + ' 设备:' + (deviceid || old.deviceid || ''));
    }
  }

  // 2) 自动补签（当天未签到且到达触发点；必须已有可用会话）
  var TRIGGERS = ['integralSignV2Service~getTodaySign', '/preloadResource', '/up-member/'];
  var isTrigger = TRIGGERS.some(function (t) { return url.indexOf(t) !== -1; });
  var session = readJSON(K_SESSION);
  var doSign = false;
  if (AUTO_SIGN_ON_OPEN && isTrigger && session && session.cookie) {
    var guardDate = readStore(K_SIGN_DATE);
    var lastTry = parseInt(readStore(K_LAST_TRY) || '0', 10) || 0;
    var now = Date.now();
    if (guardDate !== localDateStr() && (now - lastTry) > TRY_THROTTLE_MS) {
      writeStore(K_LAST_TRY, String(now));
      doSign = true;
    }
  }

  if (!doSign) {
    $done({});
    return;
  }

  console.log('[SF:补签] 触发自动签到检查 (' + (changed ? '参数已刷新, ' : '') + url.substring(0, 80) + ')');
  checkAndSign(session, { notify: true, tag: '打开App' }, function () {
    $done({});
  });
})();
