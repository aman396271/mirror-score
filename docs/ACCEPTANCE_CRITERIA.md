# ACCEPTANCE CRITERIA

> 每个任务的验收标准。Codex 提交前必须自检，Claude 按此判定。
> 完成度分级详见 DELIVERY_STANDARD.md

---

## 全局约束

- 代码必须可在本地运行，不依赖未声明的环境变量
- 不允许提交含有硬编码密钥、token、API Key 的文件
- 提交内容必须与任务范围一致，不允许擅自扩展
- 修改范围外的文件不得改动
- 每次提交必须附带验证命令输出和修改文件列表

---

## TASK-001：初始化前后端项目骨架

### 前端（Next.js）
- [ ] frontend/ 存在，Next.js 14+ App Router + TypeScript + Tailwind
- [ ] 首页 / 可访问，显示项目名称和描述
- [ ] npm run dev 无报错（端口 3000）
- [ ] npm run build 通过
- [ ] npm run lint 无错误

### 后端（FastAPI）
- [ ] backend/ 存在，含 requirements.txt 和 main.py
- [ ] GET / → {"status":"ok","service":"MirrorScore API"}
- [ ] GET /health → {"status":"healthy"}
- [ ] uvicorn main:app --reload 无报错（端口 8000）

### 根目录
- [ ] README.md 说明如何分别启动前后端
- [ ] .gitignore 覆盖 node_modules、.next、__pycache__、.env 等

### 回传证据
1. npm run build 输出（最后几行）
2. npm run lint 输出
3. GET / 和 GET /health 实际返回
4. 项目目录树
5. 修改文件列表

---

## TASK-002：前端图片上传页面
- [ ] 支持 jpg/png/webp，文件大小限制可用
- [ ] 上传前后状态清晰，预览图可用
- [ ] 错误提示清晰
- [ ] 移动端可用

## TASK-003：后端 /analyze mock 接口
- [ ] POST /analyze 可接收请求
- [ ] 返回：scoreTotal, ageRange, subScores, freeSummary, isLocked
- [ ] 输入验证和错误处理完整

## TASK-004：前端结果展示页
- [ ] 总分卡片、年龄区间、五维分项、免费建议、锁定提示、解锁按钮
- [ ] mock 数据可稳定渲染

## TASK-005：前后端联调
- [ ] 上传→分析→结果全流程跑通
- [ ] 错误处理正常

## TASK-006：付费解锁 UI（mock）
- [ ] 免费/锁定/解锁层级清楚
- [ ] 不接真实支付，但具备演示能力
