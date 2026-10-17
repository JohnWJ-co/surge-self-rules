# 顺丰速运 会员签到（Surge 脚本）

每天定时自动完成顺丰速运会员签到，无需打开 App。

> 顺丰会员中心的 H5 登录态（sessionId）只有约 20 分钟有效期，社区脚本普遍只能"打开 App 时顺手签"。
> 本方案利用 App 的原生登录凭证（长期有效）在每次定时运行时**现签发现新的 H5 登录令牌**，
> 换取全新会话后再签到，因此可以真正做到无人值守的定时签到。

## 文件说明

| 文件 | 类型 | 作用 |
| --- | --- | --- |
| `sf-capture.js` | http-request | ① 捕获 `universalSign` 请求（原生长期凭证 token 等）② 捕获会员中心 H5 会话（备用） |
| `sf-signin.js` | cron | 原生凭证 → 换取 H5 登录令牌 → 换取新会话 → 调用签到接口 → 通知结果 |

## Surge 配置（Mac / iOS 通用）

**1. MITM 域名**（`[MITM]` 段，与已有 hostname 合并）：

```text
hostname = *.sf-express.com, *.sf-express.com.cn
```

确保 Surge 证书已安装并信任（Mac：钥匙串；iOS：安装描述文件后在「关于本机-证书信任设置」开启）。

**2. 脚本注册**（`[Script]` 段）：

```text
顺丰速运·登录凭证捕获 = type=http-request,pattern=^https?://ccsp-egmas\.sf-express\.com/cx-app-member/member/app/user/universalSign,script-path=https://raw.githubusercontent.com/JohnWJ-co/surge-self-rules/refs/heads/main/Scripts/sf-capture.js,requires-body=true,timeout=30
顺丰速运·H5参数捕获 = type=http-request,pattern=^https?://mcs-mimp-web\.sf-express\.com/,script-path=https://raw.githubusercontent.com/JohnWJ-co/surge-self-rules/refs/heads/main/Scripts/sf-capture.js,timeout=30
顺丰速运·每日签到 = type=cron,cronexp=5 8 * * *,wake-system=1,timeout=60,script-path=https://raw.githubusercontent.com/JohnWJ-co/surge-self-rules/refs/heads/main/Scripts/sf-signin.js
顺丰速运·补签重试 = type=cron,cronexp=5 12 * * *,wake-system=1,timeout=60,script-path=https://raw.githubusercontent.com/JohnWJ-co/surge-self-rules/refs/heads/main/Scripts/sf-signin.js
顺丰速运·补签重试2 = type=cron,cronexp=5 18 * * *,wake-system=1,timeout=60,script-path=https://raw.githubusercontent.com/JohnWJ-co/surge-self-rules/refs/heads/main/Scripts/sf-signin.js
```

**3. 首次使用**：打开一次顺丰速运 App 的「签到」或「会员中心」页面（几秒钟即可），
脚本会自动捕获登录凭证。之后每天的签到全自动完成，无需再打开 App。

## 工作方式

- **定时签到**：每天 08:05 自动签到，失败时 12:05 / 18:05 自动重试。
- **通知**：签到成功推送「积分 +N，连签 N 天」；当天已签到会提示「今日已签到」；失败每天最多提醒一次。
- **凭证刷新**：原生凭证长期有效（实测多日可重放）；平时无需维护。若长期不用导致凭证失效，通知会提示你打开一次 App 签到页即可。

## 常见问题

- **提示「尚未获取登录凭证」**：打开一次顺丰速运 App 的「签到 / 会员中心」页面。
- **提示「登录凭证已失效」**：同上，打开一次 App 即可自动刷新。
- **调整签到时间**：修改 `cronexp`（分 时 日 月 周），或增删重试条目。
- **多设备使用**：每台设备各自捕获凭证、各自定时；先签到者成功，后到者提示「今日已签到」。只想一台定时的话，在另一台删除三条 cron 条目、保留两条捕获条目即可。
