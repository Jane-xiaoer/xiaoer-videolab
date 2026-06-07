<div align="center">

# 🎬 Xiaoer VideoLab · 小耳抓视频

### 一键。任意视频。全在本地。

工具栏点一下，当前页面的视频就落进你的 `~/Downloads`。
底层是一个超小的本地 [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) 守护进程 —— 开箱即通 **1800+ 网站**
（YouTube · B站 · X/Twitter · TikTok · Vimeo · Twitch · 微博 …）。

[![CI](https://github.com/Jane-xiaoer/xiaoer-videolab/actions/workflows/ci.yml/badge.svg)](https://github.com/Jane-xiaoer/xiaoer-videolab/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)
![Platform](https://img.shields.io/badge/平台-macOS%20%7C%20Windows-lightgrey)
![Manifest V3](https://img.shields.io/badge/Chrome-MV3-4285F4?logo=googlechrome&logoColor=white)
![Python stdlib only](https://img.shields.io/badge/Python-仅标准库-3776AB?logo=python&logoColor=white)
![localhost only](https://img.shields.io/badge/网络-仅本机-27ae60)

[![English](https://img.shields.io/badge/lang-English-lightgrey)](README.md)&nbsp;
[![简体中文](https://img.shields.io/badge/lang-简体中文-2563eb)](README.zh-CN.md)

</div>

---

## 🙏 致谢贡献者

**本项目因为他们而更好,衷心感谢!**

- [**@ttmouse**](https://github.com/ttmouse) —— 弹出历史面板、**取消卡住的下载**、播放 / 打开文件夹、一键启动服务（[#4](https://github.com/Jane-xiaoer/xiaoer-videolab/pull/4)）
- [**@jzq1212（林以恒）**](https://github.com/jzq1212) —— **Windows 支持**:跨平台 daemon + PowerShell 安装脚本（[#1](https://github.com/Jane-xiaoer/xiaoer-videolab/pull/1)）
- [**@alick-zhang**](https://github.com/alick-zhang) —— 提出 Windows 需求,促成了上面的 Windows 支持（[#3](https://github.com/Jane-xiaoer/xiaoer-videolab/issues/3)）

> 欢迎提 issue 和 PR,你的名字也会出现在这里。

---

## 为什么做它

浏览器里的视频下载插件大多是个泥潭：动不动要「读取你在所有网站上的全部数据」权限，还偷偷回传。
Xiaoer VideoLab 反着来：

- **扩展几乎什么都不做。** 你点它的时候，它只读*当前标签页的 URL* 这一个字符串，POST 给 `127.0.0.1`。
  不抓页面、无 content script、不连任何远程服务器。
- **下载在本地完成。** 一个小小的 Python 守护进程把 URL 交给久经考验的开源工具 `yt-dlp`，
  所有「聪明活」都在一个你能亲自审计的工具里。
- **除了 `yt-dlp` 去取你要的那个视频，没有任何东西离开你的电脑。**

## 工作原理

```
 ┌─────────────────────┐   点击     ┌──────────────────────────┐         ┌──────────┐
 │  浏览器工具栏按钮     │ ─────────► │  daemon @ 127.0.0.1:7788 │ ──────► │  yt-dlp  │ ──► ~/Downloads
 │  (Chrome MV3 扩展)   │  POST url  │  (Python 标准库, launchd)│  调用   └──────────┘        │
 └─────────────────────┘            └──────────────────────────┘                              ▼
        ▲   角标: … ✓ ✕ !                       │                                     macOS 系统通知
        └───────────────────────────────────────┘                                      "✅ <文件名>"
```

- **daemon** —— Python 标准库 `http.server`，监听 `127.0.0.1:7788`，由 `launchd` 开机自启。
- **extension** —— Chrome MV3，一个工具栏按钮，取 `tab.url` POST 给 daemon。
- **产物** —— `~/Downloads/<平台>_<标题>_<日期>.mp4`（默认 ≤1080p mp4，可配置）。
- **日志** —— `~/Library/Logs/xiaoer-videolab.log`

## ✅ 能下载哪些网站

底层是 yt-dlp 的 **1872 个提取器**,绝大多数视频站都能下。实用对照表:

| | 网站 |
|---|---|
| **✅ 已实测确认** | **YouTube · Vimeo · B站 · 抖音 · 小红书** |
| **✅ 支持**(yt-dlp 有提取器,同一条路) | X/Twitter · 西瓜视频 · Instagram · Reddit · Dailymotion · Facebook · TikTok\* · …还有约 1860 个 |
| **⚠️ 仅免费内容** | 优酷 · 爱奇艺 —— VIP / DRM 付费剧集下不了 |
| **🚫 不推荐** | **微博 · 知乎** —— 见下方说明 |
| **❌ 不支持** | 快手、腾讯视频 —— 无提取器;**视频号** —— 微信 App 内 + 加密 |

> 🚫 **微博 / 知乎 —— 不推荐。** 它们的网页是**综合信息流**(很像 TikTok):视频只是一大张页面里的一小块,你**没法单独打开一个视频、拿到它自己的网址**。没有干净的"单条视频地址"可抓,按钮就无从下手——所以建议跳过。
>
> \* **TikTok / 海外站**需要能正常访问它们的网络(国内需代理;注意部分机房 IP 会被 TikTok 的 API 拦截)。
>
> 🎯 **想下视频号 / 快手 / 小程序 / 直播流?** 这些藏在 App 里、要靠抓包,推荐用 [**res-downloader**](https://github.com/putyy/res-downloader)。本工具专注 yt-dlp 这一大类。

> **抖音和小红书**用的是专门的「页面抠真链」(yt-dlp 读不到它们),所以请在视频**打开/播放着**的时候点按钮。

说明:文件名里的**平台**和**标题**会自动识别,**日期**是下载当天。

## 急速版（装过同类工具的人）

```bash
brew install yt-dlp ffmpeg
git clone https://github.com/Jane-xiaoer/xiaoer-videolab.git
cd xiaoer-videolab && ./scripts/install.sh
# 然后到 chrome://extensions/ 把 extension/ 作为「已解压扩展」加载
```

---

## 安装 —— 手把手详细版

第一次用？把下面每一步都跟着做。大约 5 分钟，而且**只装这一次**。

### 你需要什么

- **macOS**（后台服务用 `launchd`）**或 Windows 10/11**（用任务计划程序）。
- 任意 Chromium 内核浏览器 —— Chrome / Arc / Edge / Brave / Dia。
- 大约 5 分钟。

**你不需要会编程**，只是复制粘贴几条命令而已。

> **用 Windows？** 下面第一、二部分是 macOS 的。请跳到 **[🪟 Windows 安装](#-windows-安装替代第一二部分)**，装完再回来看第三部分。

### 第一部分 · 装「下载引擎」（只装一次）

这个工具本质是给开源下载器 [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) 套了个友好的按钮，真正干活的是它。所以先把它装上。

**A1.** 打开 **「终端」**（Terminal）App。（按 `⌘ 空格`，输入「终端」或 `Terminal`，回车。）

<!-- 截图位: docs/images/01-terminal.png -->

**A2.** 安装 **Homebrew**（Mac 上的软件包管理器）。如果你已经有了，跳到 A3。
把下面这行粘进终端、回车，按它的提示走：

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**A3.** 安装 `yt-dlp` 和 `ffmpeg`：

```bash
brew install yt-dlp ffmpeg
```

> `ffmpeg` 很重要 —— 没它的话，有些网站只能给你纯音频或低画质，因为视频和音频是**分开的两条流**，要靠 `ffmpeg` 合回去。

### 第二部分 · 装小耳抓视频

**B1.** 还在终端里，把这三行粘进去：

```bash
git clone https://github.com/Jane-xiaoer/xiaoer-videolab.git
cd xiaoer-videolab
./scripts/install.sh
```

**B2.** 成功的话，你会在最后看到这样几行：

```
✓ Daemon running at http://127.0.0.1:7788
  Log: ~/Library/Logs/xiaoer-videolab.log

Next: load the browser extension
  1. Open chrome://extensions/
  ...
```

<!-- 截图位: docs/images/02-install-success.png -->

这说明后台下载服务装好了，以后**每次开机自动启动**，你再也不用碰终端。

### 🪟 Windows 安装（替代第一、二部分）

浏览器那两步（第三、四部分）所有系统都一样，**只有引擎 + 服务的装法不同**。

**W1.** 装引擎。打开 **PowerShell**，运行（用 Win10/11 自带的 [winget](https://aka.ms/getwinget)）：

```powershell
winget install Python.Python.3.11 yt-dlp.yt-dlp ffmpeg
```

**W2.** 装小耳抓视频。可以点 GitHub 绿色的 **Code → Download ZIP** 下载解压，或在 PowerShell 里：

```powershell
git clone https://github.com/Jane-xiaoer/xiaoer-videolab.git
cd xiaoer-videolab
powershell -ExecutionPolicy Bypass -File scripts\install.ps1
```

安装脚本会注册一个**开机自启任务**，并问你从哪个浏览器取 cookie（`edge`/`chrome`）。
以后想卸载：`powershell -ExecutionPolicy Bypass -File scripts\uninstall.ps1`。

装完接着看下面的**第三部分** —— 加工具栏按钮所有系统都一样。

### 第三部分 · 加上工具栏按钮

浏览器按钮还没上 Chrome 应用商店，所以要手动加载。这是正常且安全的。

> 下面这张图把这一部分的四步都标好了，对照红字操作最直观：

![加载扩展的四个步骤：打开地址 → 开启开发者模式 → 加载已解压 → 打开开关](docs/images/load-extension-steps.png)

**C1.** 新开一个标签页，地址栏输入：`chrome://extensions/`
（Edge 是 `edge://extensions/`，Arc / Brave 同样是 `chrome://extensions/`。）

**C2.** 打开 **「开发者模式」** —— 在页面**右上角**的开关。

<!-- 截图位: docs/images/03-developer-mode.png -->

**C3.** 点左上角的 **「加载已解压的扩展程序」**，会弹出一个文件夹选择框。

<!-- 截图位: docs/images/04-load-unpacked.png -->

**C4.** 找到你刚才 clone 下来的仓库，选中里面的 **`extension`** 文件夹
（比如 `xiaoer-videolab/extension`），点「选择」。

扩展列表里就会出现一张 **Xiaoer VideoLab** 的卡片。

<!-- 截图位: docs/images/05-extension-card.png -->

**C5.** 点工具栏上的 **拼图图标**，找到 **Xiaoer VideoLab**，点 **图钉** 把它固定到工具栏上。

<!-- 截图位: docs/images/06-pin-toolbar.png -->

### 第四部分 · 下你的第一个视频

**D1.** 打开任意视频页（YouTube / B站 / X / TikTok …）。

**D2.** 点工具栏上的 **Xiaoer VideoLab** 图标。

<!-- 截图位: docs/images/07-click-button.png -->

**D3.** 会弹「开始下载」通知，下完弹「✅ &lt;文件名&gt;」通知。图标上还会有个小角标：

| 角标 | 含义 |
|:---:|---|
| `…` | 请求已发，正在下 |
| `✓` | daemon 接单了（下载在后台继续） |
| `✕` | 连不上 daemon |
| `!` | daemon 报错（看通知 / 日志） |

<!-- 截图位: docs/images/08-notification.png -->

**D4.** 到 **`~/Downloads`（下载）文件夹**里找你的视频。🎉

<!-- 截图位: docs/images/09-downloads-folder.png -->

搞定 —— 以后就是 **打开视频 → 点一下按钮**，没了。

## 配置

全部可选 —— 设好后重新跑 `./scripts/install.sh` 即可写进服务：

| 变量 | 默认 | 作用 |
|---|---|---|
| `VIDEOLAB_PORT` | `7788` | daemon 端口 —— ⚠️ 改了它，必须**同时**改 `extension/background.js`（`DAEMON`）和 `extension/manifest.json`（`host_permissions`）成同一个端口，否则按钮连不上 daemon |
| `VIDEOLAB_DOWNLOADS` | `~/Downloads` | 下载目录 |
| `VIDEOLAB_YT_DLP` | 自动探测 | `yt-dlp` 二进制路径（自动探测会优先用已安装的 `yt-dlp-nightly`——见常见问题里的 `HTTP Error 412`）|
| `VIDEOLAB_PREFIX` | _（无）_ | 文件名前缀，比如 `小耳-` |
| `VIDEOLAB_MAX_HEIGHT` | `1080` | 最大画质高度（要 4K 填 `2160`） |
| `VIDEOLAB_COOKIES_BROWSER` | _（关）_ | 从某浏览器取 cookie（`chrome`/`brave`/`firefox`/`edge`/`safari`），用于**登录态 / 私域**视频 |
| `VIDEOLAB_APP_NAME` | `Xiaoer VideoLab` | 通知里显示的名字 |

```bash
# 例：4K + 从 Chrome 取登录 cookie + 文件名带「小耳-」前缀
VIDEOLAB_MAX_HEIGHT=2160 VIDEOLAB_COOKIES_BROWSER=chrome VIDEOLAB_PREFIX="小耳-" ./scripts/install.sh
```

## 常用命令

```bash
# daemon 还活着吗
curl http://127.0.0.1:7788/health

# 看日志
tail -f ~/Library/Logs/xiaoer-videolab.log

# 重启 daemon
launchctl unload ~/Library/LaunchAgents/com.xiaoer.videolab.plist
launchctl load   ~/Library/LaunchAgents/com.xiaoer.videolab.plist

# 不用扩展，直接命令行下载
curl -X POST http://127.0.0.1:7788/download \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'

# 一键更新（拉最新代码 + 升级 yt-dlp 内核），自动保留你的设置
./scripts/update.sh

# 卸载服务
./scripts/uninstall.sh
```

> 🔄 **yt-dlp 内核每周自动更新**(launchd 定时任务,每周日凌晨 4 点;日志 `~/Library/Logs/xiaoer-videolab-ytdlp-update.log`),网站改版了也能跟上,你什么都不用做。想立刻更新:`bash scripts/auto-update-ytdlp.sh`。(VideoLab 自身的代码更新仍是手动 `./scripts/update.sh`。)

## 安全

- daemon 只绑定 `127.0.0.1`，外网打不到。
- **杜绝偷偷下载（drive-by download）**：`/download` 会拒绝任何带 `http(s)` `Origin` 头的请求，
  所以你访问的恶意网页的 JavaScript **没法背着你让 daemon 下文件**。扩展（`chrome-extension://`）
  和命令行调用（无 Origin）正常放行。
- 扩展唯一的主机权限是 `http://127.0.0.1:7788/*`，点击时只读当前标签页的网址——不读页面内容、无 content script。
- 如果还想挡*同机其他进程*，在 `daemon/server.py` 里加一个共享 `X-Token` 校验即可。

## 常见问题

**提示「连不上 daemon」（`✕`）。** 跑 `curl http://127.0.0.1:7788/health`，失败就看
`tail ~/Library/Logs/xiaoer-videolab.err.log`，并确认 `yt-dlp` 已安装。

**下下来画质很低 / 只有声音。** 有些站把视频和音频拆开了，装上 `ffmpeg` 让 `yt-dlp` 能合流。

**私有 / 会员视频下不了。** 把 `VIDEOLAB_COOKIES_BROWSER` 设成你登录的那个浏览器，再重装一次。

**以前能下的站突然挂了 —— B 站报 `HTTP Error 412`，或某站报提取器错误。** 站点升级了反爬，而你的
`yt-dlp` 比修复版旧。先升级（`yt-dlp --update` 或 `brew upgrade yt-dlp`）。stable 版对 B 站这类
反爬快的站点常滞后几天到几周——升 stable 还不行就装 **nightly** 版，VideoLab 会自动探测并优先用它：

```bash
# macOS 独立 nightly 二进制 —— VideoLab 自动识别，无需任何配置
mkdir -p ~/.local/bin
curl -L -o ~/.local/bin/yt-dlp-nightly \
  https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp_macos
chmod +x ~/.local/bin/yt-dlp-nightly
# 以后再滞后了，随时自更新：
~/.local/bin/yt-dlp-nightly --update-to nightly
```

**不是 macOS？** 扩展跨平台，只有*安装脚本*是 macOS 专属。Linux/Windows 自己跑
`python3 daemon/server.py` 即可（任何进程管理器都行）。

## 参与贡献

欢迎 Issue 和 PR。整个项目约 400 行标准库 Python + 原生 JS，好读好 fork。
如果你加了在意的能力（新的格式档位、Firefox manifest、Linux 服务文件），发过来。

## 作者

**Jane** · 小耳 / Xiaoer —— *一组会听、会读、会找、会帮你整理信息的小工具。*

- GitHub：[@Jane-xiaoer](https://github.com/Jane-xiaoer)
- 邮箱：xiaoerzhan@gmail.com

它是 **小耳** 工具箱的一员，同门还有
[小耳 Ask](https://github.com/Jane-xiaoer/xiaoer-ask) 和
[小耳一键改名 Smart Rename](https://github.com/Jane-xiaoer/smart-rename)。

## 📱 关注作者 / Follow Me

如果这个仓库对你有帮助，欢迎关注我。后面我会持续更新更多 AI Skill、做网站、自动化工作流和创意项目。

If this repo helped you, follow me for more AI skills, website building, automation workflows, and creative projects.

- X (Twitter): [@xiaoerzhan](https://x.com/xiaoerzhan)
- 微信公众号 / WeChat Official Account: 扫码关注 / Scan to follow

<p align="center">
  <img src="./follow-wechat-qrcode.jpg" alt="Jane WeChat Official Account QR code" width="300" />
</p>

<p align="center"><strong>中文：</strong>欢迎关注我的公众号，一起研究 AI Skill、网站搭建、自动化流程和创意实验。</p>

<p align="center"><strong>English:</strong> Follow my WeChat Official Account for more AI skills, website building, automation workflows, and creative experiments.</p>

## 致谢

完全站在 [**yt-dlp**](https://github.com/yt-dlp/yt-dlp) 的肩膀上 —— 本项目只是给它套了个友好的一键按钮。
请支持并尊重 yt-dlp 项目。

## 许可证

[MIT](LICENSE) © 2026 Jane（小耳 / Xiaoer）

> 只下载你有权下载的内容。请自行遵守你使用本工具的网站的服务条款与适用的版权法律。
