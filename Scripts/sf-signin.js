/***************************************************************
 * 顺丰速运 · 会员签到【定时自动签到】
 * 类型: Surge cron 脚本 (type=cron)
 *
 * 原理:
 *   用捕获的长期原生 token 调 universalSign 换取一次性 H5 登录令牌
 *   -> activityRedirect 换取全新的 H5 sessionId (绕开 H5 会话约 20 分钟过期的限制)
 *   -> 调会员中心签到接口完成签到。
 *   全程无需打开 App；凭证由 sf-capture.js 在打开 App 签到页时自动刷新。
 ***************************************************************/

var BASE = 'https://mcs-mimp-web.sf-express.com';
var U_UNIVERSAL = 'https://ccsp-egmas.sf-express.com/cx-app-member/member/app/user/universalSign';
var U_REDIRECT = BASE + '/mcs-mimp/share/app/activityRedirect';
var U_SIGN = BASE + '/mcs-mimp/commonPost/~memberNonactivity~integralSignV2Service~sign';
var H5_UA = 'Mozilla/5.0 (iPad; CPU OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 mediaCode=SFEXPRESSAPP-iOS-ML';

var K_NATIVE = 'sf_express_native';        // {headers:{...}, body:'...', ts}
var K_SIGN_DATE = 'sf_express_sign_date';  // 已完成签到的日期 YYYY-MM-DD
var K_NOTIFY_FAIL = 'sf_express_notify_fail'; // 失败通知日期（每天最多提醒一次）

/* ============================ 工具 ============================ */
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

function readStore(key) { try { return $persistentStore.read(key); } catch (e) { return null; } }
function writeStore(key, value) { try { return $persistentStore.write(String(value), key); } catch (e) { return false; } }
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
function notifyFailOnce(subtitle, body) {
  var today = localDateStr();
  if (readStore(K_NOTIFY_FAIL) === today) {
    console.log('[SF:定时] 今日已提醒过失败(' + subtitle + ')，跳过重复通知');
    return;
  }
  writeStore(K_NOTIFY_FAIL, today);
  $notification.post('顺丰速运 · 签到失败', subtitle, body);
}
function parseJSON(data) {
  try { return JSON.parse(data); } catch (e) { return null; }
}
function getHeader(headers, name) {
  if (!headers) return '';
  for (var k in headers) {
    if (k.toLowerCase() === name) return headers[k];
  }
  return '';
}

/* ============================ 签到链路 ============================ */
// 1) 原生 universalSign -> 一次性 H5 登录令牌
function getLoginToken(native, cb) {
  $httpClient.post({
    url: U_UNIVERSAL,
    headers: native.headers,
    body: native.body,
    timeout: 20
  }, function (err, resp, data) {
    if (err) { cb({ step: 'universalSign', netError: String(err) }); return; }
    var j = parseJSON(data);
    if (!j) { cb({ step: 'universalSign', netError: 'HTTP ' + (resp && resp.status) + ' 响应异常' }); return; }
    if (!j.success || !j.obj || !j.obj.sign) {
      cb({ step: 'universalSign', code: j.errorCode, message: j.errorMessage || '获取登录令牌失败' });
      return;
    }
    cb(null, j.obj.sign);
  });
}

// 2) activityRedirect -> 全新的 H5 sessionId
function fetchSession(loginToken, cb) {
  var biz = JSON.stringify({ path: '/up-member/newHome', autoSignIn: '1', supportShare: 'YES', tab: '2', from: 'autoappicon' });
  var url = U_REDIRECT + '?sign=' + encodeURIComponent(loginToken) +
    '&source=SFAPP&bizCode=' + encodeURIComponent(biz) +
    '&citycode=553&cityname=' + encodeURIComponent('芜湖');
  $httpClient.get({
    url: url,
    headers: {
      'User-Agent': H5_UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh-Hans;q=0.9'
    },
    timeout: 20
  }, function (err, resp, data) {
    if (err) { cb({ step: 'activityRedirect', netError: String(err) }); return; }
    var sc = getHeader(resp && resp.headers, 'set-cookie');
    if (Array.isArray(sc)) sc = sc.join('\n');
    var m = /sessionId=([0-9a-fA-F]+)/.exec(String(sc || ''));
    if (!m) { cb({ step: 'activityRedirect', netError: '未获取到会话(Set-Cookie), HTTP ' + (resp && resp.status) }); return; }
    cb(null, m[1]);
  });
}

// 3) 用新会话签到
function doSign(sessionId, deviceid, cb) {
  var ts = Date.now();
  var sig = md5('token=wwesldfs29aniversaryvdld29&timestamp=' + ts + '&sysCode=MCS-MIMP-CORE');
  var headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'Origin': BASE,
    'Referer': BASE + '/up-member/newHome',
    'User-Agent': H5_UA,
    'channel': 'autoappicon',
    'syscode': 'MCS-MIMP-CORE',
    'platform': 'SFAPP',
    'timestamp': String(ts),
    'signature': sig,
    'accept-language': 'zh-CN,zh-Hans;q=0.9',
    'Cookie': 'sessionId=' + sessionId
  };
  if (deviceid) headers['deviceid'] = deviceid;
  $httpClient.post({
    url: U_SIGN,
    headers: headers,
    body: '{}',
    timeout: 20
  }, function (err, resp, data) {
    if (err) { cb({ step: 'sign', netError: String(err) }); return; }
    var j = parseJSON(data);
    if (!j) { cb({ step: 'sign', netError: 'HTTP ' + (resp && resp.status) + ' 响应异常' }); return; }
    cb(null, j);
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

/* ============================ 主流程 ============================ */
(function () {
  console.log('[SF:定时] ===== 顺丰速运定时签到 开始 =====');
  var today = localDateStr();
  if (readStore(K_SIGN_DATE) === today) {
    console.log('[SF:定时] 今日已签到(' + today + ')，跳过');
    $done();
    return;
  }

  var native = readJSON(K_NATIVE);
  if (!native || !native.headers || !native.headers.token || !native.body) {
    console.log('[SF:定时] 尚未捕获登录凭证');
    notifyFailOnce('尚未获取登录凭证', '请打开一次顺丰速运 App 的「签到/会员中心」页面（会自动捕获凭证）');
    $done();
    return;
  }
  console.log('[SF:定时] 凭证捕获时间: ' + new Date(parseInt(native.ts, 10) || 0).toLocaleString());

  getLoginToken(native, function (e1, loginToken) {
    if (e1) {
      console.log('[SF:定时] 换取登录令牌失败: ' + JSON.stringify(e1));
      notifyFailOnce('登录凭证已失效', '请打开一次顺丰速运 App 的「签到/会员中心」页面刷新凭证');
      $done();
      return;
    }
    console.log('[SF:定时] 登录令牌获取成功');

    fetchSession(loginToken, function (e2, sessionId) {
      if (e2) {
        console.log('[SF:定时] 换取 H5 会话失败: ' + JSON.stringify(e2));
        notifyFailOnce('登录会话获取失败', (e2.netError || (e2.message || '')) + ' · 请打开顺丰速运App签到页一次');
        $done();
        return;
      }
      console.log('[SF:定时] 已获取全新 H5 会话: ' + sessionId.substring(0, 8) + '...');

      var deviceid = native.headers.srcdeviceguid || '';
      doSign(sessionId, deviceid, function (e3, res) {
        if (e3) {
          console.log('[SF:定时] 签到请求失败: ' + JSON.stringify(e3));
          notifyFailOnce('签到请求失败', e3.netError || '网络异常');
          $done();
          return;
        }
        if (res.success) {
          var award = extractAwardNum(res.obj || {});
          var days = (res.obj && res.obj.dayCount) ? res.obj.dayCount : 0;
          writeStore(K_SIGN_DATE, today);
          var msg = (award !== null && award !== undefined) ? ('积分 +' + award) : '签到成功';
          console.log('[SF:定时] 签到成功 ' + msg + ' 连签' + days + '天');
          $notification.post('顺丰速运 · 签到成功', msg, '连签 ' + days + ' 天 · ' + timeStr());
          $done();
          return;
        }
        if (String(res.errorCode) === '3400002') {
          writeStore(K_SIGN_DATE, today);
          console.log('[SF:定时] 今日已签到(接口返回)');
          $notification.post('顺丰速运 · 签到', '今日已签到', String(res.errorMessage || ''));
          $done();
          return;
        }
        if (String(res.errorCode) === '100111') {
          console.log('[SF:定时] 会话异常: ' + res.errorMessage);
          notifyFailOnce('登录会话异常', '请打开一次顺丰速运 App 的「签到/会员中心」页面刷新凭证');
          $done();
          return;
        }
        console.log('[SF:定时] 签到失败: ' + res.errorCode + ' ' + res.errorMessage);
        notifyFailOnce(String(res.errorMessage || '未知错误'), '错误码 ' + res.errorCode);
        $done();
      });
    });
  });
})();
