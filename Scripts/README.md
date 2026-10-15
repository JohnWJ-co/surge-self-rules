# 顺丰速运 会员签到（Surge 脚本）

打开顺丰速运 App 自动捕获登录参数，每天定时自动签到；参数失效时会通知，打开一次 App 即自动恢复。

## 文件说明

| 文件 | 类型 | 作用 |
| --- | --- | --- |
| `sf-capture.js` | http-request | 拦截会员中心 H5（`mcs-mimp-web.sf-express.com`）请求，自动保存 `sessionId` 等登录态与 `deviceid`，全程无需手动填账号 |
| `sf-signin.js` | cron | 读取已捕获参数，查询签到状态并完成签到，通知结果 |

## Surge 配置（Mac / iOS 通用）

**1. MITM 域名**（`[MITM]` 段，与已有 hostname 合并即可）：

```text
hostname = *.sf-express.com, *.sf-express.com.cn
```

并确保 Surge 的证书已安装并信任（Mac：系统钥匙串；iOS：设置-通用-VPN与设备管理-安装描述文件后，再到 关于本机-证书信任设置 开启信任）。

**2. 脚本注册**（`[Script]` 段）：

```text
顺丰速运·参数捕获 = type=http-request,pattern=^https?://mcs-mimp-web\.sf-express\.com/,script-path=https://raw.githubusercontent.com/JohnWJ-co/surge-self-rules/refs/heads/main/Scripts/sf-capture.js,timeout=30
顺丰速运·每日签到(08:05) = type=cron,cronexp=5 8 * * *,wake-system=1,timeout=60,script-path=https://raw.githubusercontent.com/JohnWJ-co/surge-self-rules/refs/heads/main/Scripts/sf-signin.js
顺丰速运·补签重试(12:05) = type=cron,cronexp=5 12 * * *,wake-system=1,timeout=60,script-path=https://raw.githubusercontent.com/JohnWJ-co/surge-self-rules/refs/heads/main/Scripts/sf-signin.js
顺丰速运·补签重试(18:05) = type=cron,cronexp=5 18 * * *,wake-system=1,timeout=60,script-path=https://raw.githubusercontent.com/JohnWJ-co/surge-self-rules/refs/heads/main/Scripts/sf-signin.js
```

## 工作方式

- **捕获**：每次打开顺丰速运 App，会员中心 H5 会发出请求，捕获脚本顺势把最新登录态存入 Surge 持久化存储（按设备各自存储）。
- **签到**：每天 08:05 自动签到；若失败（如登录态过期）会在 12:05 / 18:05 重试。
- **失效提醒**：登录态过期时通知一次「请打开顺丰速运 App」；打开 App 后参数自动刷新，下一次定时（或当天后续重试）自动完成签到。同一天最多提醒一次失败，不会重复打扰。
- **防重复**：脚本记录当天签到状态，当天成功后其余定时静默跳过；多个设备同时使用时会先签到者成功、后到者提示「今日已签到」。

## 常见问题

- **一直提示「尚未获取登录参数」**：先打开一次顺丰速运 App 并进入「我的 / 会员中心」页面，参数即被捕获。
- **提示「登录态已失效」**：同上，打开一次 App 即可自动恢复。
- **调整签到时间**：修改 `cronexp` 的时间（分 时 日 月 周），或增删重试条目。
- **想只让一台设备执行定时**：在另一台设备的配置里删除三条 cron 条目，仅保留「参数捕获」即可。
