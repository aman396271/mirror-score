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

ANALYSIS_PROMPT = """你是一位专业的面部美学分析师。请仔细分析这张人脸照片，给出详细的评估。

你必须严格按照以下 JSON 格式返回，不要返回任何其他内容，不要用 markdown 包裹：

{
  "totalScore": 7.50,
  "ageRange": "24-28",
  "gender": "female",
  "details": {
    "eyes": {"score": 8.0, "label": "眼睛", "comment": "具体分析"},
    "eyeDistance": {"score": 7.5, "label": "眼距", "comment": "具体分析"},
    "nose": {"score": 7.0, "label": "鼻子", "comment": "具体分析"},
    "mouth": {"score": 7.5, "label": "嘴唇", "comment": "具体分析"},
    "faceShape": {"score": 7.8, "label": "脸型", "comment": "具体分析"},
    "skinTone": {"score": 8.0, "label": "肤色", "comment": "具体分析"},
    "proportion": {"score": 7.5, "label": "五官比例", "comment": "具体分析"},
    "hairStyle": {"score": 7.0, "label": "发型适配", "comment": "具体分析"}
  },
  "freeTips": ["具体建议1", "具体建议2", "具体建议3"],
  "lockedTips": ["付费建议1", "付费建议2", "付费建议3", "付费建议4", "付费建议5"]
}

评分规则：
- 所有分数 0.00-10.00，保留两位小数
- totalScore 是各项加权平均
- 评价客观、具体、有建设性
- freeTips 3条免费实用建议
- lockedTips 5条深度付费建议
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