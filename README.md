# 风过雪庭 · Winter Wind Snow

一个会回应鼠标的冬夜落雪网页，也是可继续扩展为个人主页的开场页面。移动鼠标会形成风场，速度越快影响范围和风力越强；按住并松开时，雪会缓慢向外荡开。

在线体验：https://hanzichuan5-ctrl.github.io/winter-wind-snow/

## 互动方式

- 移动鼠标：推动附近的雪花；快速划过会留下约半秒的无雪风痕
- 按住再松开：雪会聚拢后缓慢向外荡开，不显示额外光圈
- 雪量按钮：在舒缓、漫天和暴雪之间切换
- 向下滚动：穿过雪幕进入作品集
- 作品卡片：用鼠标擦开覆雪查看内容；离开后，雪会从上方慢慢覆盖回来

## 本地运行

```powershell
npm install
npm run dev
```

## 构建

```powershell
npm run build
```

技术栈：原生 Canvas 2D、Vite。

GitHub Pages 直接发布 `docs` 目录中的生产构建。
