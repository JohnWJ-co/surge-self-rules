/***************************************************************
 * 顺丰速运 · 会员签到【登录凭证自动捕获】
 * 类型: Surge http-request 脚本 (MITM: *.sf-express.com)
 * 拦截:
 *   1) POST ccsp-egmas.sf-express.com/.../user/universalSign  (requires-body=true)
 *      —— 保存长期有效的原生 token/requestsign/timeinterval 等，供"换取签到登录令牌"使用
 *   2) mcs-mimp-web.sf-express.com 的任意请求
 *      —— 保存 H5 会话(备用)；顺丰 H5 会话约 20 分钟过期，仅作兜底
 *
 * 说明:
 *   · 打开顺丰 App 的「签到 / 会员中心」页面即可刷新全部凭证，全程无需手动填账号
 *   · 签到由 sf-signin.js 定时执行（脚本会用原生 token 自动换取新会话，无需打开 App）
 ***************************************************************/

var H5_HOST = 'https://mcs-mimp-web.sf-express.com';
var K_NATIVE = 'sf_express_native';    // JSON: {headers:{...}, body:'...', ts}
var K_SESSION = 'sf_express_session';  // JSON: {cookie, deviceid, mobile, userId, ts} (兜底)

var KEEP_HEADERS = [
  'token', 'syttoken', 'memberid', 'requestsign', 'timeinterval',
  'deviceid', 'srcdeviceguid', 'clientversion', 'jsbundle',
  'user-agent', 'languagecode', 'mediacode', 'systemversion',
  'regioncode', 'carrier', 'model', 'screensize', 'cxgw-appid',
  'content-type', 'cookie'
];

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

(function () {
  var url = ($request && $request.url) ? $request.url : '';
  var headers = ($request && $request.headers) ? $request.headers : {};
  function getH(name) {
    for (var k in headers) {
      if (k.toLowerCase() === name) return headers[k];
    }
    return '';
  }

  // ---------- 1) 捕获 universalSign：长期登录凭证 ----------
  if (url.indexOf('universalSign') !== -1) {
    var body = ($request && $request.body) ? $request.body : '';
    var token = getH('token');
    console.log('[SF:凭证] 命中 universalSign, body长度=' + body.length + ', token=' + (token ? '有' : '无'));
    if (body && token && body.indexOf('mcs-mimp-web') !== -1) {
      var kept = {};
      for (var i = 0; i < KEEP_HEADERS.length; i++) {
        var v = getH(KEEP_HEADERS[i]);
        if (v) kept[KEEP_HEADERS[i]] = v;
      }
      var oldN = readStore(K_NATIVE);
      var newN = JSON.stringify({ headers: kept, body: body, ts: Date.now() });
      if (oldN !== newN) {
        writeStore(K_NATIVE, newN);
        console.log('[SF:凭证] 原生登录令牌已更新 设备:' + (kept.deviceid || '') + ' token:' + token.substring(0, 8) + '... body长度:' + body.length);
      } else {
        console.log('[SF:凭证] 凭证无变化，跳过保存');
      }
    } else {
      console.log('[SF:凭证] 未保存: body/token 缺失或目标不匹配');
    }
    $done({});
    return;
  }

  // ---------- 2) 捕获 H5 会话（兜底用） ----------
  var cookie = getH('cookie');
  var deviceid = getH('deviceid');
  if (cookie && /(?:^|;\s*)sessionId=[^;]+/.test(cookie)) {
    var keptCookies = cookie.split(/;\s*/).filter(function (c) {
      var n = c.split('=')[0];
      if (/^(sensorsdata|sa_jssdk|sajssdk)/.test(n)) return false;
      if (n === 'HWWAFSESID' || n === 'HWWAFSESTIME') return false;
      return true;
    }).join('; ');
    var mobile = (cookie.match(/_login_mobile_=([^;]+)/) || [])[1] || '';
    var userId = (cookie.match(/_login_user_id_=([^;]+)/) || [])[1] || '';
    var old = readJSON(K_SESSION) || {};
    if (old.cookie !== keptCookies || (deviceid && old.deviceid !== deviceid)) {
      writeStore(K_SESSION, JSON.stringify({
        cookie: keptCookies,
        deviceid: deviceid || old.deviceid || '',
        mobile: mobile || old.mobile || '',
        userId: userId || old.userId || '',
        ts: Date.now()
      }));
      console.log('[SF:H5] 会话参数已更新' + (mobile ? ' (' + mobile + ')' : ''));
    }
  }

  $done({});
})();
