import os

ALIPAY_CONFIG = {
    "app_id": os.getenv("ALIPAY_APP_ID", "2021006137621793"),
    "private_key": os.getenv("ALIPAY_PRIVATE_KEY", ""),
    "alipay_public_key": os.getenv("ALIPAY_PUBLIC_KEY", ""),
    "notify_url": os.getenv("ALIPAY_NOTIFY_URL", "http://47.111.24.34/api/alipay/notify"),
    "sign_type": "RSA2",
}
