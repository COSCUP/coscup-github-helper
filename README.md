# COSCUP GitHub Helper

這個應用程式用於處理 GitHub 專案的 webhook 事件，並將狀態變動通知發送到 Mattermost。

## 功能

- 監聽 GitHub 專案卡片的狀態變動
- 將變動通知發送到指定的 Mattermost 頻道
- 提供健康檢查端點

## 安裝

1. 安裝依賴：
```bash
npm install
```

2. 設定環境變數：
複製 `.env.example` 到 `.env` 並填入以下資訊：
- `GITHUB_APP_ID`：GitHub App 的 ID
- `GITHUB_PRIVATE_KEY`：GitHub App 的私鑰
- `GITHUB_WEBHOOK_SECRET`：GitHub webhook 的密鑰
- `MATTERMOST_WEBHOOK_URL`：Mattermost 的 webhook URL
- `PORT`：應用程式監聽的端口（預設：3000）

## 設定 GitHub App

1. 前往 [GitHub App 設定頁面](https://github.com/settings/apps)
2. 點擊 "New GitHub App"
3. 填寫基本資訊：
   - GitHub App name
   - Homepage URL
   - Webhook URL (例如：`https://your-domain.com/webhook`)
   - Webhook secret
4. 設定權限：
   - Repository permissions:
     - Projects: Read & write
5. 選擇要安裝的倉庫
6. 複製 App ID 和 Private Key 到 `.env` 檔案

## 使用

1. 啟動應用程式：
```bash
npm start
```

2. 在 GitHub 專案設定中設定 webhook：
   - Payload URL：`http://你的網域/webhook`
   - Content type：`application/json`
   - Secret：與 `.env` 中的 `GITHUB_WEBHOOK_SECRET` 相同
   - 選擇事件：`Project cards`

## 健康檢查

訪問 `/health` 端點來檢查應用程式是否正常運行：
```bash
curl http://localhost:3000/health
```

## 授權

MIT 
