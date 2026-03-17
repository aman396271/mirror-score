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
```bash
git pull
docker-compose up -d --build
```
