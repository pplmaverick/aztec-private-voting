# Aztec Private Voting — 開發者筆記

## 每次開 session 必做

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
export PATH="/opt/homebrew/bin:$HOME/.aztec/current/bin:$HOME/.aztec/current/node_modules/.bin:$HOME/.aztec/bin:$PATH"
```

## 跑測試（不需要 sandbox）

```bash
cd ~/aztec-private-voting && aztec test
```

## 啟動 local network（M2 部署時才需要）

```bash
aztec start --local-network
# 等出現 "Aztec Server listening on port 8080"
```

## 里程碑

- **M1 完成**（2026-06-24）：Noir 合約 + 11/11 測試，已 push GitHub
- **M2 待做**：TypeScript e2e + 部署到 Aztec testnet（等 V5 上線後）
- **M3 待做**：Grant 申請 + mainnet 部署

## 已知陷阱

- Noir 註解不能有非 ASCII 字元（em dash、中文會報錯）
- Noir package name 不能有連字符，用底線
- macOS 預設 Bash 3.2 不夠新，aztec 需要 Homebrew bash 5（`/opt/homebrew/bin/bash`）
- 安裝腳本要用 `curl -sL`，`curl -s` 不跟隨 redirect

## 版本

- aztec：4.3.1
- Noir：1.0.0-beta.21
- Node.js：24.12.0（nvm）
- Bash：5.3.15（Homebrew）
