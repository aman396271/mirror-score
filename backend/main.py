# -*- coding: utf-8 -*-
import os
import base64
import json
import uuid
import time
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 内存存储：分析结果 + 支付状态（重启清空，MVP 够用）
analysis_store = {}

client = OpenAI(
    api_key=os.getenv("DASHSCOPE_API_KEY", ""),
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
)

ANALYSIS_PROMPT = """你是一位拥有20年经验的面部美学分析师，以直言不讳和精准判断著称。你的评分必须绝对客观、有区分度，严禁礼貌性打分。
核心评分规则（必须严格遵守）：
- 评分范围 0.00-10.00，正常分布，大多数人在 4.0-6.5 之间
- 9.0+：极其罕见，仅限专业模特、明星级别的突出五官和整体协调度
- 8.0-8.9：明显优于常人，有多个突出的外形优势
- 7.0-7.9：略好于平均，存在一定亮点
- 5.0-6.9：普通水平，大多数人落在这个区间
- 4.0-4.9：略低于平均，有明显改进空间
- 3.0-3.9：明显不足，需要重点改善
- 3.0 以下：严重不足
- 严禁所有项目都给 7-8 分的“和稀泥”评分
- 每个人至少要有 2 个项目低于 6 分，至少 1 个项目高于 8 分，除非确实整体非常平均
- totalScore 必须是各项真实加权平均，不要手动拉高

你必须严格按以下 JSON 格式返回，不要返回任何其他内容，不要使用 markdown 代码块：
{
  "totalScore": 5.83,
  "ageRange": "24-28",
  "gender": "female",
  "details": {
    "eyes": {
      "score": 7.2,
      "label": "眼睛",
      "comment": "具体描述眼型、大小、双眼皮或单眼皮、神采，必须同时说明优点和缺点"
    },
    "eyeDistance": {
      "score": 5.5,
      "label": "眼距",
      "comment": "精准分析眼距与脸宽比例，是偏宽、偏窄还是标准，以及对整体观感的影响"
    },
    "nose": {
      "score": 4.8,
      "label": "鼻子",
      "comment": "分析鼻梁高度、鼻翼宽度、鼻尖形态，以及与面部整体的协调性"
    },
    "mouth": {
      "score": 6.3,
      "label": "嘴唇",
      "comment": "分析唇形、厚薄、比例和与下巴的关系"
    },
    "faceShape": {
      "score": 5.9,
      "label": "脸型",
      "comment": "判断脸型类别并分析下颌线、颧骨、太阳穴等结构特点"
    },
    "skinTone": {
      "score": 6.8,
      "label": "肤色与肤质",
      "comment": "分析肤色均匀度、光泽感、是否有明显瑕疵、暗沉或色斑"
    },
    "proportion": {
      "score": 5.2,
      "label": "五官比例",
      "comment": "用三庭五眼等标准分析比例，明确指出偏离项和偏离程度"
    },
    "hairStyle": {
      "score": 6.0,
      "label": "发型适配",
      "comment": "分析当前发型与脸型的匹配度，是否扬长避短"
    }
  },
  "freeTips": [
    "第一条建议：必须具体可执行，例如直接指出应调整的发型、刘海、修容或拍照方式",
    "第二条建议：针对最低分项目给出明确改善方案和原因",
    "第三条建议：针对拍照、表情、光线或姿态给出立刻可实践的技巧"
  ],
  "lockedTips": [
    {"title": "发型改造方案", "content": "根据脸型推荐2-3个具体发型名称及效果，指出要避免的发型及原因"},
    {"title": "妆容优化指南", "content": "眉形、眼妆、腮红位置、口红色号具体建议，整体风格方向"},
    {"title": "最佳拍照方案", "content": "最佳角度（左/右脸x度）、光线方向、表情幅度、手机高度建议"},
    {"title": "穿搭与配色建议", "content": "根据肤色推荐颜色、领口形状、配饰建议，以及要避免的颜色"},
    {"title": "综合提升路线", "content": "短期（1周）、中期（1-3个月）、长期习惯，预计从x.x分提升到x.x分"}
  ]
}

再次强调：
- 你不是在讨好用户，你是在做专业分析，必须说真话
- 分数要有明显高低差异，不同人的总分应落在 3.5-8.5 的大范围内
- 评语必须同时包含优点和缺点，不要只说好话
- 每条建议都必须具体到可以立刻执行，禁止空泛表达
- 每条 lockedTip 的 content 必须写成不少于50字的具体建议，必须给出明确方法、原因或预期效果
- 请用中文回答"""


@app.post("/analyze")
async def analyze_face(file: UploadFile = File(...)):
    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400, detail="仅支持 JPG、PNG、WebP 格式")

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="文件大小不能超过 10MB")

    if not os.getenv("DASHSCOPE_API_KEY"):
        raise HTTPException(status_code=500, detail="AI 服务未配置，请联系管理员")

    base64_image = base64.b64encode(contents).decode("utf-8")

    try:
        response = client.chat.completions.create(
            model="qwen-vl-max",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{file.content_type};base64,{base64_image}"}},
                    {"type": "text", "text": ANALYSIS_PROMPT}
                ]
            }],
            max_tokens=2000
        )

        result_text = response.choices[0].message.content.strip()
        if result_text.startswith("```"):
            result_text = result_text.split("\n", 1)[1]
            result_text = result_text.rsplit("```", 1)[0]
        result_text = result_text.strip()

        result = json.loads(result_text)
        order_id = str(uuid.uuid4())[:8]
        result["orderId"] = order_id
        result["isPaid"] = False
        analysis_store[order_id] = {
            "result": result.copy(),
            "isPaid": False,
            "created": time.time()
        }
        safe_result = dict(result)
        safe_result["lockedTips"] = [{"title": tip.get("title", f"付费建议 {i+1}"), "content": ""} for i, tip in enumerate(result.get("lockedTips", []))]
        return safe_result

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI 返回格式异常，请重试")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分析失败：{str(e)}")


@app.post("/confirm-payment")
async def confirm_payment(request: Request):
    body = await request.json()
    order_id = body.get("orderId", "")
    if order_id not in analysis_store:
        raise HTTPException(status_code=404, detail="订单不存在或已过期")
    analysis_store[order_id]["isPaid"] = True
    return {"success": True, "lockedTips": analysis_store[order_id]["result"].get("lockedTips", [])}


@app.get("/payment-status/{order_id}")
async def payment_status(order_id: str):
    if order_id not in analysis_store:
        raise HTTPException(status_code=404, detail="订单不存在")
    return {"isPaid": analysis_store[order_id]["isPaid"]}


@app.get("/")
async def root():
    return {"status": "ok", "service": "MirrorScore API"}


@app.get("/health")
async def health():
    has_key = bool(os.getenv("DASHSCOPE_API_KEY"))
    return {"status": "healthy", "ai_configured": has_key}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
