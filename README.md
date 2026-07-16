# 风过雪庭 · Winter Wind Snow

一个会回应鼠标的冬夜落雪网页。移动鼠标会形成风场，点击画面会产生一圈雪浪；还可以使用 html2canvas 将当前画面保存为 PNG。

在线体验：https://hanzichuan5-ctrl.github.io/winter-wind-snow/

## 互动方式

- 移动鼠标：推动附近的雪花，移动越快风越强
- 点击画面：产生一圈向外扩散的雪浪
- 雪量按钮：在舒缓、漫天和暴雪之间切换
- 保存这一刻：使用 html2canvas 下载当前静态画面

## 本地运行

```powershell
npm install
npm run dev
```

## 构建

```powershell
npm run build
```

技术栈：原生 Canvas 2D、Vite、html2canvas。

GitHub Pages 直接发布 `docs` 目录中的生产构建。
