# -*- coding: utf-8 -*-
import base64
import json
import os
import time
import uuid

from alipay_service import create_payment, query_payment, verify_payment
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
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
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
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
- 严禁所有项目都给 7-8 分的"和稀泥"评分
- 每个人至少要有 2 个项目低于 6 分，至少 1 个项目高于 8 分，除非确实整体非常平均
- totalScore 必须是各项真实加权平均，不要手动拉高

你必须严格按以下 JSON 格式返回，不要返回任何其他内容，不要使用 markdown 代码块：
{
  "totalScore": 5.83,
  "ageRange": "24-28",
  "gender": "female",
  "details": {
    "eyes": {"score": 7.2, "label": "眼睛", "comment": "具体描述眼型、大小、双眼皮或单眼皮、神采，必须同时说明优点和缺点"},
    "eyeDistance": {"score": 5.5, "label": "眼距", "comment": "精准分析眼距与脸宽比例，是偏宽、偏窄还是标准，以及对整体观感的影响"},
    "nose": {"score": 4.8, "label": "鼻子", "comment": "分析鼻梁高度、鼻翼宽度、鼻尖形态，以及与面部整体的协调性"},
    "mouth": {"score": 6.3, "label": "嘴唇", "comment": "分析唇形、厚薄、比例和与下巴的关系"},
    "faceShape": {"score": 5.9, "label": "脸型", "comment": "判断脸型类别并分析下颌线、颧骨、太阳穴等结构特点"},
    "skinTone": {"score": 6.8, "label": "肤色与肤质", "comment": "分析肤色均匀度、光泽感、是否有明显瑕疵、暗沉或色斑"},
    "proportion": {"score": 5.2, "label": "五官比例", "comment": "用三庭五眼等标准分析比例，明确指出偏离项和偏离程度"},
    "hairStyle": {"score": 6.0, "label": "发型适配", "comment": "分析当前发型与脸型的匹配度，是否扬长避短"}
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

# 亮点/短板模糊描述模板
STRONG_TEMPLATES = {
    "eyes": "你的眼睛是一大亮点，眼型条件出众",
    "eyeDistance": "你的眼距比例协调，五官平衡感好",
    "nose": "你的鼻子条件不错，与面部协调度高",
    "mouth": "你的唇形自然好看，是加分项",
    "faceShape": "你的脸型轮廓有优势，线条流畅",
    "skinTone": "你的肤色和肤质状态是明显优势",
    "proportion": "你的五官比例协调，整体感好",
    "hairStyle": "你目前的发型很适合脸型",
}

WEAK_TEMPLATES = {
    "eyes": "眼部细节还有优化空间，影响整体精神感",
    "eyeDistance": "眼距比例略有失衡，拉低了五官协调度",
    "nose": "鼻部条件有明显提升空间，是关键短板",
    "mouth": "唇形比例需要调整，影响下半脸的协调感",
    "faceShape": "脸型轮廓存在可改善的地方，影响整体印象",
    "skinTone": "肤色肤质问题较为明显，拉低整体颜值",
    "proportion": "五官比例存在偏差，是整体减分项",
    "hairStyle": "现有发型与脸型匹配度不足，错失了扬长避短的机会",
}


def get_score_level(score: float) -> dict:
    if score >= 8.0:
        return {"scoreLevel": "excellent", "levelColor": "#9C27B0", "levelLabel": "卓越", "levelDescription": "你的外貌条件非常出众，属于人群中的佼佼者"}
    elif score >= 7.0:
        return {"scoreLevel": "high", "levelColor": "#4CAF50", "levelLabel": "优秀", "levelDescription": "你的综合表现优于大多数人，但仍有明显的提升空间"}
    elif score >= 5.5:
        return {"scoreLevel": "medium", "levelColor": "#FF9800", "levelLabel": "中等偏上", "levelDescription": "你的底子不差，通过针对性调整可以有显著提升"}
    elif score >= 4.0:
        return {"scoreLevel": "average", "levelColor": "#2196F3", "levelLabel": "普通", "levelDescription": "你有不少可以优化的方面，改善后提升会很明显"}
    else:
        return {"scoreLevel": "low", "levelColor": "#F44336", "levelLabel": "需要改善", "levelDescription": "不用担心，每个人都有变美的潜力，关键是找到方向"}


def build_teaser(result: dict) -> dict:
    details = result.get("details", {})
    sorted_items = sorted(details.items(), key=lambda x: x[1].get("score", 0), reverse=True)
    strong_keys = [k for k, _ in sorted_items[:2]]
    weak_keys = [k for k, _ in sorted_items[-2:]]
    strong_points = [STRONG_TEMPLATES.get(k, f"你的{details[k]['label']}条件较好") for k in strong_keys]
    weak_points = [WEAK_TEMPLATES.get(k, f"你的{details[k]['label']}还有提升空间") for k in weak_keys]
    free_tips = result.get("freeTips", [])
    one_free_tip = free_tips[0] if free_tips else "尝试调整拍照角度，可以让你的优势更突出"
    return {"strongPoints": strong_points, "weakPoints": weak_points, "oneFreeTip": one_free_tip}


def build_full_result(order_id: str) -> dict:
    full = analysis_store[order_id]["result"]
    return {
        "isPaid": True,
        "totalScore": full.get("totalScore"),
        "details": full.get("details", {}),
        "freeTips": full.get("freeTips", []),
        "lockedTips": full.get("lockedTips", []),
    }


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
            messages=[{"role": "user", "content": [
                {"type": "image_url", "image_url": {"url": f"data:{file.content_type};base64,{base64_image}"}},
                {"type": "text", "text": ANALYSIS_PROMPT},
            ]}],
            max_tokens=2000,
        )

        result_text = response.choices[0].message.content.strip()
        if result_text.startswith("```"):
            result_text = result_text.split("\n", 1)[1]
            result_text = result_text.rsplit("```", 1)[0]
        result_text = result_text.strip()

        result = json.loads(result_text)
        order_id = str(uuid.uuid4())[:8]
        analysis_store[order_id] = {"result": result, "isPaid": False, "created": time.time()}

        # 返回安全结果（隐藏分数）
        level_info = get_score_level(result.get("totalScore", 5.0))
        teaser = build_teaser(result)
        details = result.get("details", {})
        locked_tips = result.get("lockedTips", [])

        safe_result = {
            "orderId": order_id,
            "isPaid": False,
            "ageRange": result.get("ageRange", "--"),
            "gender": result.get("gender", "--"),
            "teaser": teaser,
            "lockedContent": {
                "itemCount": len(details),
                "tipCount": len(result.get("freeTips", [])) + len(locked_tips),
                "message": f"解锁后可查看：精确分数 + {len(details)}项逐维打分 + {len(locked_tips)}条深度优化建议",
            },
        }
        safe_result.update(level_info)
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
    return {"success": True, **build_full_result(order_id)}


@app.get("/payment-status/{order_id}")
async def payment_status(order_id: str):
    if order_id not in analysis_store:
        raise HTTPException(status_code=404, detail="订单不存在")
    return {"isPaid": analysis_store[order_id]["isPaid"]}


@app.post("/create-order")
async def create_order(request: Request):
    body = await request.json()
    order_id = body.get("orderId", "")
    if order_id not in analysis_store:
        raise HTTPException(status_code=404, detail="分析结果不存在或已过期")
    if analysis_store[order_id]["isPaid"]:
        return {"success": True, **build_full_result(order_id)}

    trade_no = f"MS{order_id}{int(time.time())}"
    analysis_store[order_id]["tradeNo"] = trade_no
    result = create_payment(order_id=trade_no, amount="9.9", subject="MirrorScore 深度面部分析报告")
    if result.get("qr_code"):
        return {"success": True, "qrCode": result["qr_code"], "tradeNo": trade_no}
    raise HTTPException(status_code=500, detail=f"创建订单失败：{result.get('msg', '未知错误')}")


@app.post("/alipay/notify")
async def alipay_notify(request: Request):
    form_data = await request.form()
    data = dict(form_data)
    if not verify_payment(data):
        return PlainTextResponse("fail")
    trade_status = data.get("trade_status", "")
    out_trade_no = data.get("out_trade_no", "")
    if trade_status in ("TRADE_SUCCESS", "TRADE_FINISHED"):
        for order_id, store in analysis_store.items():
            if store.get("tradeNo") == out_trade_no:
                store["isPaid"] = True
                break
    return PlainTextResponse("success")


@app.get("/check-payment/{order_id}")
async def check_payment(order_id: str):
    if order_id not in analysis_store:
        raise HTTPException(status_code=404, detail="订单不存在")
    store = analysis_store[order_id]

    if store["isPaid"]:
        return build_full_result(order_id)

    trade_no = store.get("tradeNo", "")
    if trade_no:
        qr = query_payment(trade_no)
        if qr.get("trade_status") in ("TRADE_SUCCESS", "TRADE_FINISHED"):
            store["isPaid"] = True
            return build_full_result(order_id)

    return {"isPaid": False}


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
