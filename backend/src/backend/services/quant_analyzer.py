from typing import Dict, Any, Optional
from .. import models

def calculate_heuristic_fair_price(stock: models.Stock) -> Dict[str, Any]:
    """
    정밀화된 혼합형 휴리스틱 모델을 사용하여 적정가를 산출합니다.
    - Min: 재무적 지지선 (PBR 1.0 혹은 20일 이평선 수준, 현재가의 -7% 하한)
    - Max: 기술적 저항선 (20일 이평선 상단 혹은 현재가의 +10% 상한)
    """
    current_price = stock.current_price
    if not current_price:
        return {}

    # 1. 하한가 (Min) 계산: 가치 + 단기 이평선 기준
    # PBR 1.0 수준과 20일 이평선 중 높은 값을 참조하되, 현재가의 -7% 보다는 높게 설정
    avg_20d = stock.close_avg_20d or current_price
    pbr_support = (current_price / stock.pbr) if (stock.pbr and stock.pbr > 0) else (current_price * 0.93)
    
    min_price = max(pbr_support, avg_20d * 0.98, current_price * 0.93)

    # 2. 상한가 (Max) 계산: 단기 모멘텀 기준
    # 20일 이평선 대비 +5% 혹은 현재가 대비 +10% 중 보수적인 값 선택
    max_price = min(avg_20d * 1.1, current_price * 1.1)
    
    # 만약 현재가가 이미 저평가 상태라면 상한가를 조금 더 열어줌
    if current_price < min_price:
        max_price = max(max_price, current_price * 1.05)

    # 수치 정제 (10원 단위 반올림)
    min_price = round(min_price, -1)
    max_price = round(max_price, -1)

    # 범위가 너무 좁아지는 경우 최소 3% 차이 유지
    if max_price <= min_price:
        max_price = round(min_price * 1.05, -1)

    reason = f"단기 이평선({round(avg_20d)}원)과 PBR 지표를 결합하여 산출한 정밀 밴드입니다. 과도한 변동성을 배제한 현실적 매수 구간을 제시합니다."

    return {
        "min": min_price,
        "max": max_price,
        "reason": reason
    }
