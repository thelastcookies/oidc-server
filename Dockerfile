# 使用官方 Node.js 运行时作为基础镜像
FROM node:23-alpine

ENV TZ=Asia/Shanghai

LABEL authors="thelastcookies"

# 设置工作目录
WORKDIR /app

# 复制构建后的代码到容器
COPY dist/ /app/
COPY .env/.env .env/.env.production /app/.env/

# 端口暴露
EXPOSE 8190

# 设置容器启动时的固定命令
ENTRYPOINT ["node", "app.js"]
