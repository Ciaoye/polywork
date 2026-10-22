# 瓶行宇宙三张问题墙

发布地址：https://ciaoye.github.io/polywork/bottledream/

入口：01 档案、02 生活、03 劳动保障。手机优先，480px 以下回答单列，输入字号 16px，支持匿名公开回答；每题提交后查看该题回答，无登录、投票。

后端 `previous-answers.json` 为三份打印 HTML 的 93 条回答原文，标注此前回答及原来源。现场新回答独立存入 CloudBase 集合 `bottledream_answers`，接口为 `bottledream-api`，复用原 CloudBase 环境，不与 polywork_events 混用。重复请求通过 requestId 去重。

构建：`npm run build:github`。推送 main 自动触发 GitHub Pages。后端：`npx --package @cloudbase/cli tcb fn deploy bottledream-api --dir cloudbase-functions/bottledream-api --force --install-dependency true`。

验证：构建成功；云端 POST、GET 持久化成功，已清除测试记录；浏览器核对切题和窄屏布局。真机微信内浏览器尚待现场确认。

2026-10-22：移除顶部介绍和表单宣传文案；表单置于问题下方。每题提交后独立解锁，浏览器保存提交凭据；接口验证凭据后才返回该题现场回答和此前回答。
