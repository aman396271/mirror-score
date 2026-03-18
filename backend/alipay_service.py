from alipay import AliPay

from alipay_config import ALIPAY_CONFIG


def create_alipay_client():
    return AliPay(
        appid=ALIPAY_CONFIG["app_id"],
        app_notify_url=ALIPAY_CONFIG["notify_url"],
        app_private_key_string=ALIPAY_CONFIG["private_key"],
        alipay_public_key_string=ALIPAY_CONFIG["alipay_public_key"],
        sign_type=ALIPAY_CONFIG["sign_type"],
        debug=False,
    )


def create_payment(
    order_id: str,
    amount: str = "9.90",
    subject: str = "MirrorScore 深度面部分析建议",
):
    client = create_alipay_client()
    result = client.api_alipay_trade_precreate(
        out_trade_no=order_id,
        total_amount=amount,
        subject=subject,
    )
    return result


def verify_payment(data: dict) -> bool:
    client = create_alipay_client()
    sign = data.pop("sign", None)
    data.pop("sign_type", None)
    return client.verify(data, sign)


def query_payment(order_id: str) -> dict:
    client = create_alipay_client()
    return client.api_alipay_trade_query(out_trade_no=order_id)
