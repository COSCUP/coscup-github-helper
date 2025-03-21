# 構建階段
FROM node:18-alpine AS builder

WORKDIR /app

# 安裝 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 複製 package.json 和 pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# 安裝依賴
RUN pnpm install --frozen-lockfile

# 複製源代碼
COPY . .

# 構建 TypeScript
RUN pnpm build

# 運行階段
FROM node:18-alpine

WORKDIR /app

# 安裝 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 複製 package.json 和 pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# 只安裝生產環境依賴
RUN pnpm install --frozen-lockfile --prod

# 從構建階段複製編譯後的代碼
COPY --from=builder /app/dist ./dist

# 暴露端口
EXPOSE 3000

# 啟動應用
CMD ["node", "dist/index.js"]
