"""
Alipay face-to-face payment service (no SDK, uses pycryptodome for RSA2 signing).
"""
import base64
import json
import time

import requests
from Crypto.Hash import SHA256
from Crypto.PublicKey import RSA
from Crypto.Signature import pkcs1_15

from alipay_config import ALIPAY_CONFIG

ALIPAY_GATEWAY = "https://openapi.alipay.com/gateway.do"


def _build_private_key(raw: str) -> RSA.RsaKey:
    raw = raw.strip()
    if "BEGIN" not in raw:
        raw = f"-----BEGIN PRIVATE KEY-----\n{raw}\n-----END PRIVATE KEY-----"
    return RSA.import_key(raw)


def _build_public_key(raw: str) -> RSA.RsaKey:
    raw = raw.strip()
    if "BEGIN" not in raw:
        raw = f"-----BEGIN PUBLIC KEY-----\n{raw}\n-----END PUBLIC KEY-----"
    return RSA.import_key(raw)


def _sign(params: dict) -> str:
    sorted_str = "&".join(f"{k}={v}" for k, v in sorted(params.items()) if v)
    key = _build_private_key(ALIPAY_CONFIG["private_key"])
    h = SHA256.new(sorted_str.encode("utf-8"))
    signature = pkcs1_15.new(key).sign(h)
    return base64.b64encode(signature).decode("utf-8")


def _build_request(method: str, biz_content: dict) -> dict:
    params = {
        "app_id": ALIPAY_CONFIG["app_id"],
        "method": method,
        "format": "JSON",
        "charset": "utf-8",
        "sign_type": "RSA2",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "version": "1.0",
        "notify_url": ALIPAY_CONFIG["notify_url"],
        "biz_content": json.dumps(biz_content, ensure_ascii=False),
    }
    params["sign"] = _sign(params)
    return params


def create_payment(order_id: str, amount: str = "9.90", subject: str = "MirrorScore 深度面部分析建议") -> dict:
    """Create face-to-face precreate order, returns qr_code URL."""
    params = _build_request(
        "alipay.trade.precreate",
        {"out_trade_no": order_id, "total_amount": amount, "subject": subject},
    )
    resp = requests.post(ALIPAY_GATEWAY, data=params, timeout=15)
    result = resp.json().get("alipay_trade_precreate_response", {})
    return result


def verify_payment(data: dict) -> bool:
    """Verify Alipay async callback signature."""
    sign = data.pop("sign", None)
    data.pop("sign_type", None)
    if not sign:
        return False
    sorted_str = "&".join(f"{k}={v}" for k, v in sorted(data.items()) if v)
    try:
        key = _build_public_key(ALIPAY_CONFIG["alipay_public_key"])
        h = SHA256.new(sorted_str.encode("utf-8"))
        pkcs1_15.new(key).verify(h, base64.b64decode(sign))
        return True
    except Exception:
        return False


def query_payment(trade_no: str) -> dict:
    """Query order status from Alipay."""
    params = _build_request(
        "alipay.trade.query",
        {"out_trade_no": trade_no},
    )
    resp = requests.post(ALIPAY_GATEWAY, data=params, timeout=15)
    return resp.json().get("alipay_trade_query_response", {})
