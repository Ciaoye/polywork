# 多元工作与收入探索

统一公开入口：https://ciaoye.github.io/polywork/ 。无需填写即可看历史回答，也可以匿名提交新回答。

10.12 参与端：https://ciaoye.github.io/polywork/1012/ 。默认显示本场，点击「展开历史回答」查看活动开始前冻结的记录。10.12 问题与排序待确定，目前暂列旧题。

## 本地主持端

```powershell
npm install
npm run host
```

打开 http://localhost:3000/host/1012/ 。仅监听本机 127.0.0.1，不对外开放主持控制。
需要本机 `gh` 已登录 Ciaoye 并能写入 polywork 仓库，用于发布静态快照；不需要腾讯云 CLI 常驻或密钥写入页面。

## 数据与刷新

- 打开页面：一次腾讯云请求读入所有题的回答；在页面里切题、展开历史不请求腾讯云。
- 提交或修改回答：一次 POST 写入并返回所有题的最新回答，不追加 GET。
- 主持人「刷新并同步参与端」：一次 GET 读取腾讯云，再将公开回答发布到同一仓库 `live-data` 分支的 snapshot.json。
- 参与端打开时及可见期间每 30 秒检查 GitHub 静态快照，不轮询腾讯云。GitHub 缓存可能带来额外同步延迟，界面不承诺秒级同步。
- 本场回答用 sessionId=2026-10-12；通用入口新回答用 open；旧回答归 legacy。同一个人跨场回答不覆盖旧记录。
- 历史固定文件：public/polywork-history-before-1012.json，2026-10-11 从线上读取冻结，共 274 条记录。原始 public/polywork-events.json 保留。
- 「想听展开」暂不发送实时投票，以遵守只在打开、提交和主持刷新时调用腾讯云的限制。主持端高亮/收起仅影响当前本地展示。
- 请求失败显示错误与已保存的历史，现场条数标记未确认；不会把请求失败当成 0 条。提交仍要求至少 15 个字，浏览没有门槛。

## 开发与检查

`npm run dev` 保留原开发服务器。现场主持请使用 `npm run host`，该命令包含本地静态快照发布接口。

```powershell
npm run build:github
npm run lint
node --test tests/cloudbase-session.test.mjs
npm test
```

GitHub Pages 从 polywork 仓库 main 部署。历史题复用必须保留 question.id；新题及场次排序收到文案后统一配置。
