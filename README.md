# 多元工作与收入探索

源码只在 Ciaoye/polywork 仓库维护。旧 polywork-income-conversation 仓库归档，旧 Pages 入口跳转到统一主页。

## 三个页面

- 常驻主页：https://ciaoye.github.io/polywork/ 。全部问题与完整阐述，支持手机和电脑；可填写、修改回答，不填写也能浏览全部回答。
- 本场参与端：https://ciaoye.github.io/polywork/1012/ 。仅本场选定问题，默认隐藏所有回答（包括自己的回答和历史回答）；主持人逐题揭晓后显示本场及可展开的历史，支持点赞投票。
- 本场主持端：http://localhost:3000/host/1012/ 。完整本场题目，默认隐藏回答；主持人揭晓、重新收起、逐条高亮。本场按确认顺序选取 8 题，主页保留全部 12 题。

## 本地主持启动

```powershell
npm install
npm run host
```

仅监听 127.0.0.1。需要本机 gh 已登录 Ciaoye、有 polywork 仓库写权限；HOST_KEY 放在忽略的 .env 中，由本机代理注入，不进入网页或仓库。腾讯云云函数必须配置相同 HOST_KEY。公开网址不开放主持控制。

## 数据与请求

- 打开页面：一次腾讯云 GET 读入全部题的回答和本场揭晓状态。
- 切题、展开历史：本地操作，不请求腾讯云。
- 提交/修改回答：一次 POST，直接返回最新快照，不追加 GET。提交仍要求 15 个字，常驻主页浏览无门槛。
- 点赞/取消：浏览器暂存，按参与者与场次隔离；点击本身不请求腾讯云。
- 主持人揭晓、收起或高亮：本机代理写入腾讯云并发布同一仓库 live-data 分支的静态快照。
- 主持人刷新：发布一次同步指令；在线参与端发现新指令后将暂存投票批量提交一次。主持端等待约 30 秒，再读取一次汇总并发布。离线、失败或 GitHub 缓存延迟的投票保留，后续刷新补齐；幂等写入防止重复计票。
- 参与端每 5 秒只检查 GitHub 上很小的 signal.json；发生变化才下载通知所指向的独立版本快照，不轮询腾讯云；页签恢复可见时也检查静态文件。没有新的主持刷新指令就不会提交投票。
- 场次回答键包含 sessionId，旧题复用保留 question.id。同一人跨场回答互不覆盖。
- 固定历史 JSON：public/polywork-history-before-1012.json，2026-10-11 从线上冻结 274 条记录。原始 polywork-events.json 保留；其他场次后续新增单独显示，不改动固定档案正文。
- 请求失败显示错误，现场条数标记未确认，不把失败视为 0 条。

## 检查

```powershell
npm run build:github
npm run lint
node --test tests/cloudbase-session.test.mjs
npm test
```

GitHub Pages 从唯一活动仓库 polywork 的 main 部署。常驻主页的问题库在 lib/questions.ts；10.12 选取其中 8 题，顺序由 cloudbase-functions/polywork-event-api/session-questions.json 与前后端共享；旧题稳定 ID 保留用于历史匹配。

部署云函数前先运行 `node scripts/prepare-cloudbase-config.mjs`，再使用生成的忽略文件 `work/cloudbase-deploy/cloudbaserc.json` 作为 CLI 的 --config-file，避免遗漏本地主持密钥。不要直接用不含密钥的公开配置覆盖云函数环境变量。
