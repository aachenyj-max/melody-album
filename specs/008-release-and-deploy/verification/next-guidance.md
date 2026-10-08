# 当前 Next.js 指南核对

检查时间：2026-10-07 23:18 CST。状态：`pass`（代码实施前文档核对）。

本机安装版本的指南位于 `node_modules/next/dist/docs/`：

| 文件 | 对 SDD-07 的约束 |
| --- | --- |
| `01-app/01-getting-started/15-route-handlers.md` | App Router 在 `app/**/route.ts` 定义 Route Handler；GET 默认不缓存，访问请求头/数据库为请求时执行；POST 不缓存。新相册入口仍显式返回 `private, no-store`。 |
| `01-app/02-guides/environment-variables.md` | 只有 `NEXT_PUBLIC_` 环境变量会构建期写入浏览器 bundle；密钥只在服务端读取。公开值变更后需重新构建。 |
| `01-app/01-getting-started/17-deploying.md` | App Router 的服务端能力需目标平台支持；不能用静态导出代替本项目的 Route Handler。 |
| `01-app/01-getting-started/08-caching.md` | 该文档主要描述开启 Cache Components 后的模型；本项目相册读写按请求身份处理，不给私有结果加 `use cache`。 |

实现时如修改动态路由参数或代理，继续查同版本对应 API 指南；不以旧版训练记忆推断签名或缓存行为。
