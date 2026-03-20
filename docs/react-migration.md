# React Frontend Migration

这个仓库已经新增了一套 `Vite + React + Tailwind CSS` 前端骨架，用于逐步替换当前 `public/html + public/js + public/css` 的旧前端。

## 目录

- `frontend/`
  - `index.html`
  - `src/`
    - `App.jsx`
    - `components/`
    - `pages/`
    - `styles.css`
- `package.json`
- `vite.config.js`
- `tailwind.config.js`
- `postcss.config.js`

## 当前已完成

- 新前端构建链
- 设计系统基础组件
- React 路由壳子
- 登录页 React 版本
- Admin Dashboard React 版本
- Mailboxes / Inbox 迁移预览页

## 运行

先安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

默认地址通常是：

```text
http://localhost:5173/react/
```

## 构建

```bash
npm run build
```

构建产物会输出到：

```text
public/react
```

这样后续可以直接让 Cloudflare Workers 的静态资源继续托管新前端产物。

## 下一步建议

1. 把登录页接入现有 `/api/login`
2. 把 Admin 页面接入 `/api/users` 和 `/api/users/:id/mailboxes`
3. 迁移 Mailboxes 和 Mailbox 页面逻辑
4. 最后移除旧的 `public/html/*.html` 页面入口
