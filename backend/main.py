# -*- coding: utf-8 -*-
import os
import base64
import json
from fastapi import FastAPI, UploadFile, File, HTTPException
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

client = OpenAI(
    api_key=os.getenv("DASHSCOPE_API_KEY", ""),
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
)

ANALYSIS_PROMPT = """你是一位拥有20年经验的面部美学分析师，以直言不讳和精准判断著称。
你的评分必须绝对客观、有区分度，严禁礼貌性打分。

核心评分规则（必须严格遵守）：
- 评分范围 0.00-10.00，正态分布，大多数人在 4.0-6.5 之间
- 9.0+ 分：极其罕见，仅限专业模特/明星级别的完美特征
- 8.0-8.9：明显优于常人，该特征是亮点
- 7.0-7.9：略好于平均，有一定优势
- 5.0-6.9：普通水平，大多数人在这个区间
- 4.0-4.9：略低于平均，有改善空间
- 3.0-3.9：明显不足，需要重点改善
- 3.0 以下：严重不足
- 绝对禁止所有项目都给 7-8 分的"和稀泥"评分
- 每个人至少要有 2 个项目低于 6 分，至少 1 个项目高于 8 分（除非真的全部平庸）
- totalScore 必须是各项的真实加权平均，不要手动拉高

你必须严格按照以下 JSON 格式返回，不要返回任何其他内容，不要用 markdown 包裹：

{
  "totalScore": 5.83,
  "ageRange": "24-28",
  "gender": "female",
  "details": {
    "eyes": {
      "score": 7.2,
      "label": "眼睛",
      "comment": "具体描述形状、大小、双眼皮/单眼皮、神采，必须说优点和缺点"
    },
    "eyeDistance": {
      "score": 5.5,
      "label": "眼距",
      "comment": "精确分析眼距与脸宽比例，是偏宽、偏窄还是标准，对整体观感的影响"
    },
    "nose": {
      "score": 4.8,
      "label": "鼻子",
      "comment": "分析鼻梁高度、鼻翼宽度、鼻尖形态，与脸部整体的协调性"
    },
    "mouth": {
      "score": 6.3,
      "label": "嘴唇",
      "comment": "分析唇形、厚薄、比例、与下巴的关系"
    },
    "faceShape": {
      "score": 5.9,
      "label": "脸型",
      "comment": "判断脸型类型（圆/方/长/鹅蛋/心形等），分析下颌线、颧骨、太阳穴"
    },
    "skinTone": {
      "score": 6.8,
      "label": "肤色与肤质",
      "comment": "分析肤色均匀度、光泽感、是否有明显瑕疵、暗沉或色斑"
    },
    "proportion": {
      "score": 5.2,
      "label": "五官比例",
      "comment": "用三庭五眼标准分析，精确指出哪个比例偏离标准、偏离多少"
    },
    "hairStyle": {
      "score": 6.0,
      "label": "发型适配",
      "comment": "分析当前发型与脸型的匹配度，是否扬长避短"
    }
  },
  "freeTips": [
    "第一条建议：必须具体可操作，比如'将刘海改为斜分可以缩短偏长的中庭'",
    "第二条建议：针对得分最低的维度给出改善方案",
    "第三条建议：针对拍照技巧，如角度、光线、表情调整"
  ],
  "lockedTips": [
    "发型改造完整方案：根据脸型推荐2-3个具体发型名称和效果预期",
    "妆容优化方案：针对五官弱项的具体化妆技巧",
    "最佳拍照角度：精确到度数的拍摄角度和光线方向建议",
    "穿搭配色建议：根据肤色和脸型推荐领口形状和配色",
    "表情管理建议：微笑幅度、眼神方向等细节调整"
  ]
}

再次强调：
- 你不是在讨好用户，你是专业分析师，必须说真话
- 分数要有明显的高低差异，不同人的总分应该在 3.5-8.5 的大范围内分布
- 评语必须同时包含优点和缺点，不要只说好话
- 每条建议必须具体到可以立即执行，禁止空泛建议如"可以换个发型"
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

        return json.loads(result_text)

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI 返回格式异常，请重试")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分析失败：{str(e)}")


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
