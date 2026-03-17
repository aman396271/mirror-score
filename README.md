# MirrorScore

## 在线访问
- 网站：http://47.111.24.34
- 健康检查：http://47.111.24.34/health
- 部署方式：阿里云 ECS + Docker Compose

## 本地开发

Frontend:
```bash
cd frontend
npm run dev
```

Backend:
```bash
cd backend
python -m uvicorn main:app --reload
```

## 服务器部署（Docker Compose）

> ⚠️ 国内服务器（阿里云等）访问 GitHub 不稳定，所有 git 操作统一使用 gitclone.com 镜像。

### 首次部署（克隆代码）
```bash
# 使用镜像克隆，不要直接用 github.com
git clone https://gitclone.com/github.com/aman396271/mirror-score.git
cd mirror-score
```

### 切换已有仓库到镜像源
```bash
# 如果已经 clone 过，执行此命令切换 remote
git remote set-url origin https://gitclone.com/github.com/aman396271/mirror-score.git
```

### 更新代码并重新部署
```bash
cd /opt/mirror-score
git pull
docker compose up -d --build
```

### 仅重建某个服务
```bash
docker compose up -d --build backend   # 只重建后端
docker compose up -d --build frontend  # 只重建前端
```
