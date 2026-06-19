# 视频语料标注 Demo · 现场分发包

## 启动方式

### macOS / Linux
双击 `start.sh`。如果双击不工作（系统不识别 .sh 为可执行）：

```bash
chmod +x start.sh
./start.sh
```

### Windows
双击 `start.bat`。

## 系统要求

- **Python 3**：macOS / 大部分 Linux 自带；Windows 需手动安装。
  - macOS: `brew install python`（如果没装 Homebrew，访问 https://brew.sh）
  - Windows: Microsoft Store 搜索 "Python 3"，或访问 https://www.python.org/downloads/
- **浏览器**：Chrome 或 Edge **最新两个稳定版本**
- **屏幕分辨率**：≥ 1280 × 720（建议按 F11 全屏）

## 启动后

浏览器自动打开 `http://localhost:8080`（端口被占用会自动 +1）。

## 使用流程

1. 选择「城市道路」样例（或其他）
2. ▶ 自动演示，或手动点 "下一步" 推进
3. ④ 审核步骤可亲自接受 / 否决 / 拖框纠正
4. ⑤ 导出步骤下载 zip 包

## 故障排除

- **端口被占用**：脚本会自动找下一个空闲端口
- **浏览器没自动打开**：手动访问终端显示的 URL
- **找不到 Python**：见上方系统要求
- **关闭演示**：终端按 Ctrl+C；浏览器关闭页面即可

## 关于这个包

这是**纯前端演示**，所有数据是预置 Mock。不连接任何服务器，不上传任何文件。
