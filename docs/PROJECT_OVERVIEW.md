# PROJECT OVERVIEW

## 项目名称
MirrorScore — 自拍上镜表现分析与优化建议平台

## 产品定位
帮助用户了解自拍上镜表现并获得优化建议的付费工具网站。
- **不是**身份识别工具
- **不是**社会价值评判工具
- **是**导向用户付费的分析建议产品

## 核心输出（最终目标）
用户上传单人自拍后，系统输出：
1. 上镜表现分（0.00-10.00，保留两位小数）
2. 视觉年龄区间（例如：24-28 岁）
3. 五维分析：图像质量、脸部姿态、表情状态、轮廓清晰度、风格完成度
4. 免费建议 3 条
5. 付费解锁完整建议（MVP 阶段 mock）

## 商业模式
- 免费用户：看到总分 + 3 条基础建议
- 付费用户：解锁完整五维详细分析 + 全部优化建议
- MVP 阶段不接真实支付，用 mock 状态模拟

## 技术栈
| 层级 | 技术 |
|------|------|
| 前端 | Next.js 14+ App Router + TypeScript + Tailwind CSS |
| 后端 | FastAPI (Python) |
| 图像分析 | MVP 阶段 mock 数据 |
| 支付 | MVP 阶段 mock |
| 认证 | MVP 阶段不做 |

## 项目本质
当前是**产品工程项目**，不是 AI 模型研发项目。优先级固定为：
1. 项目骨架可运行
2. 页面流程可演示
3. 前后端接口可联调
4. mock 数据驱动完整用户流程
5. 再考虑真实图像分析
6. 最后才是商业化与支付

## 完成度目标
| Level | 定义 | 当前目标 |
|-------|------|----------|
| Level 0 | 文档地基完成 | ✅ 进行中 |
| Level 1 | 工程骨架完成（前后端可启动） | ⬅️ 当前推进目标 |
| Level 2 | MVP 流程完成（上传→分析→结果跑通） | 下一阶段 |
| Level 3 | 商业展示完成（mock 付费解锁） | 再下一阶段 |
| Level 4 | 真实能力接入 | 远期 |

## 角色分工
| 角色 | 负责人 | 职责 |
|------|--------|------|
| 项目经理 / 技术经理 / 验收负责人 | Claude | 管理、拆任务、验收、返工、遇到问题联网搜索解决 |
| 执行开发工程师 | Codex | 写代码、运行验证、回传证据 |
| 最终验收人 | 用户 | 仅在大节点介入验收 |

## 项目边界
详见 `docs/DELIVERY_STANDARD.md`

## Claude → Codex 任务派发规范

```bash
# ✅ 正确：同步前台阻塞等待结果
CCB_CALLER=manual ask codex "指令内容"

# ✅ 长指令
cat .ccb/task-xxx.txt | CCB_CALLER=manual ask codex

# ✅ 查看历史回复
pend codex        # 最近1条
pend codex 3      # 最近3条

# ✅ 连通性验证
CCB_CALLER=manual ask codex "回复OK"

# ❌ 禁止：后台异步
ask codex "..."                          # 不带 CCB_CALLER
echo "..." | ask codex &                 # 后台 &
Start-Process -FilePath "ask" ...        # PowerShell 后台
```

> 超时处理：60s 无返回时 Ctrl+C，再用 `pend codex` 或 `wezterm cli get-text --pane-id 0 | tail -30` 查看状态。

## 最后更新
2026-03-17
