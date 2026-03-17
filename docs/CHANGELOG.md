# CHANGELOG

> 记录每次重要变更。格式：`[日期] [类型] 描述`
> 类型：INIT / FEAT / FIX / REFACTOR / DOCS / TASK

---

## [2026-03-17] INIT — 项目启动

- DOCS：创建 `docs/PROJECT_OVERVIEW.md`
- DOCS：创建 `docs/TASK_BOARD.md`
- DOCS：创建 `docs/ACCEPTANCE_CRITERIA.md`
- DOCS：创建 `docs/CHANGELOG.md`
- TASK：派发 TASK-001（初始化前后端项目骨架）给 Codex

---

## [2026-03-17] DOCS — 项目标准升级

- DOCS：创建 `docs/DELIVERY_STANDARD.md`（工程交付标准）
- DOCS：更新 `docs/PROJECT_OVERVIEW.md`（补充商业模式、完成度目标、角色分工）
- DOCS：更新 `docs/ACCEPTANCE_CRITERIA.md`（补充全部任务验收标准、完成度分级）
- DOCS：更新 `docs/TASK_BOARD.md`（补充大节点定义、完成度列）
- FIX：修复 Codex 通信方式（CCB_CALLER=manual 同步模式）
- TASK：重新派发 TASK-001

---

## [2026-03-17] TASK-001 — 前后端骨架完成（节点 B+C ACCEPTED）

- FEAT：创建 `frontend/`（Next.js 14+ App Router + TypeScript + Tailwind）
- FEAT：创建 `backend/`（FastAPI，GET / + GET /health）
- FEAT：更新根目录 `README.md` 和 `.gitignore`
- 验证：npm run build ✅ / npm run lint ✅ / GET / ✅ / GET /health ✅

---

## [2026-03-17] TASK-003 — 后端 /analyze mock 接口完成（节点 F ACCEPTED）

- FEAT：`backend/main.py` 新增 `POST /analyze` mock 接口
- FEAT：新增 `AnalyzeRequest` / `AnalyzeResponse` / `SubScore` Pydantic 模型
- FEAT：新增 CORS 中间件，允许 localhost:3000 跨域
- 验证：POST /analyze 返回 200，结构完整，freeSummary 中文 ✅

---

## [2026-03-17] TASK-002 — 前端图片上传页面完成（节点 E ACCEPTED）

- FEAT：`frontend/app/page.tsx` 实现上传页（点击/拖拽、预览、base64 转换、POST /analyze）
- FEAT：加载状态、文件类型/大小校验、错误提示
- 验证：npm run build ✅ / npm run lint ✅

---

## [2026-03-17] TASK-004 — 前端结果展示页完成（节点 G ACCEPTED）

- FEAT：新建 `frontend/app/result/page.tsx`（总分卡片、年龄区间、五维进度条、免费建议、付费锁定区）
- FEAT：`page.tsx` 分析成功后跳转 `/result?data=...`
- 验证：npm run build ✅ / npm run lint ✅

---

## [2026-03-17] TASK-005 + TASK-006 — 联调通过 + 付费解锁 UI 完成（节点 H+I ACCEPTED）

- VERIFIED：上传→分析→结果全流程跑通（用户本地验证）
- FEAT：结果页付费解锁区升级（¥9.9 定价、amber 渐变、模糊预告、永久查看说明）
- FEAT：五维分项 + 免费建议区添加「免费预览」badge
- 验证：npm run build ✅ / npm run lint ✅

---

<!-- 后续条目追加在此 -->
