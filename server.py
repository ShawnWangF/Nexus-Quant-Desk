import json
import math
import threading
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from futu import KLType, OpenQuoteContext, SubType

HOST = "127.0.0.1"
PORT = 8787
OPEND_HOST = "127.0.0.1"
OPEND_PORT = 11111
DEFAULT_SYMBOL = "HK.00981"
WATCHLIST = ["HK.03690", "HK.09992", "HK.01810", "HK.00981", "HK.07200", "HK.00700", "HK.00005", "HK.02800", "HK.800000", "HK.800100", "HK.800700"]
EASTMONEY_NAMES = {"00700": "腾讯控股", "00005": "汇丰控股", "02800": "盈富基金", "03690": "美团-W", "09992": "泡泡玛特", "01810": "小米集团-W", "00981": "中芯国际", "07200": "南方两倍做多恒指"}
QUOTE_CTX = None
QUOTE_LOCK = threading.Lock()


def clean_number(value):
    return value if isinstance(value, (int, float)) and math.isfinite(value) else None


def with_quote_context(callback):
    global QUOTE_CTX
    with QUOTE_LOCK:
        if QUOTE_CTX is None:
            QUOTE_CTX = OpenQuoteContext(host=OPEND_HOST, port=OPEND_PORT)
        try:
            return callback(QUOTE_CTX)
        except Exception:
            try:
                QUOTE_CTX.close()
            except Exception:
                pass
            QUOTE_CTX = OpenQuoteContext(host=OPEND_HOST, port=OPEND_PORT)
            return callback(QUOTE_CTX)


def quote_payload(symbols):
    def read(ctx):
        ctx.subscribe(symbols, [SubType.QUOTE], subscribe_push=False)
        ret, frame = ctx.get_market_snapshot(symbols)
        if ret != 0:
            raise RuntimeError(str(frame))
        rows = []
        for item in frame.to_dict("records"):
            previous = clean_number(item.get("prev_close_price"))
            last = clean_number(item.get("last_price"))
            change = (last - previous) / previous * 100 if last is not None and previous else None
            rows.append({
                "symbol": item.get("code"),
                "name": item.get("name"),
                "price": last,
                "change": change,
                "update_time": item.get("update_time"),
                "volume": clean_number(item.get("volume")),
                "bid": clean_number(item.get("bid_price")),
                "ask": clean_number(item.get("ask_price")),
            })
        return rows

    return with_quote_context(read)


def eastmoney_payload(symbols):
    # Eastmoney's public quote endpoint uses 116 for Hong Kong equities.
    secids = ",".join(f"116.{symbol.split('.')[-1]}" for symbol in symbols if symbol.startswith("HK."))
    url = "https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=f12,f14,f2,f3,f5,f6,f18&secids=" + urllib.parse.quote(secids)
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=8) as response:
        payload = json.loads(response.read().decode("utf-8"))
    rows = []
    for item in (payload.get("data") or {}).get("diff", []) or []:
        price = clean_number(item.get("f2"))
        previous = clean_number(item.get("f18"))
        rows.append({
            "symbol": f"HK.{item.get('f12')}", "name": EASTMONEY_NAMES.get(item.get("f12"), item.get("f14")), "price": price,
            "change": clean_number(item.get("f3")) if item.get("f3") is not None else ((price - previous) / previous * 100) if price is not None and previous else None,
            "update_time": "东方财富实时接口", "volume": clean_number(item.get("f5")),
            "bid": None, "ask": None,
        })
    return rows


def market_payload(symbols, source):
    if source == "eastmoney":
        return eastmoney_payload(symbols)
    if source == "ths":
        raise RuntimeError("同花顺接口需要配置本地授权地址或 Token，当前未启用")
    return quote_payload(symbols)


def eastmoney_kline_payload(symbol, count=80, period="1m"):
    code = symbol.split(".")[-1]
    klt = {"1m": 1, "week": 101, "month": 103}.get(period, 1)
    url = f"https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=116.{code}&klt={klt}&fqt=1&end=20500000&lmt={min(count, 240)}"
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=8) as response:
        payload = json.loads(response.read().decode("utf-8"))
    rows = []
    for record in (payload.get("data") or {}).get("klines", []) or []:
        values = record.split(",")
        if len(values) < 6:
            continue
        rows.append({"time": values[0], "open": clean_number(float(values[1])), "close": clean_number(float(values[2])), "high": clean_number(float(values[3])), "low": clean_number(float(values[4])), "volume": clean_number(float(values[5]))})
    return rows


def kline_payload(symbol, count=80, period="1m"):
    def read(ctx):
        kline_type = {"1m": KLType.K_1M, "week": KLType.K_WEEK, "month": KLType.K_MON}.get(period, KLType.K_1M)
        subtype = {"1m": SubType.K_1M, "week": SubType.K_WEEK, "month": SubType.K_MON}.get(period, SubType.K_1M)
        ctx.subscribe([symbol], [subtype], subscribe_push=False)
        ret, frame = ctx.get_cur_kline(symbol, count, ktype=kline_type, autype="qfq")
        if ret != 0:
            raise RuntimeError(str(frame))
        rows = []
        for item in frame.to_dict("records"):
            rows.append({
                "time": item.get("time_key"),
                "open": clean_number(item.get("open")),
                "high": clean_number(item.get("high")),
                "low": clean_number(item.get("low")),
                "close": clean_number(item.get("close")),
                "volume": clean_number(item.get("volume")),
            })
        return rows

    return with_quote_context(read)


class Handler(BaseHTTPRequestHandler):
    def _send(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "http://localhost:5173")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "http://localhost:5173")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        try:
            if parsed.path == "/api/health":
                self._send(200, {"ok": True, "source": "Futu OpenD", "opend": f"{OPEND_HOST}:{OPEND_PORT}"})
            elif parsed.path == "/api/quotes":
                query = parse_qs(parsed.query).get("symbols", [",".join(WATCHLIST)])[0]
                symbols = [item for item in query.split(",") if item]
                source = parse_qs(parsed.query).get("source", ["futu"])[0]
                labels = {"futu": "Futu OpenD", "eastmoney": "东方财富", "ths": "同花顺"}
                self._send(200, {"ok": True, "source": labels.get(source, source), "source_id": source, "rows": market_payload(symbols, source)})
            elif parsed.path == "/api/kline":
                symbol = parse_qs(parsed.query).get("symbol", [DEFAULT_SYMBOL])[0]
                count = min(int(parse_qs(parsed.query).get("count", [80])[0]), 240)
                period = parse_qs(parsed.query).get("period", ["1m"])[0]
                source = parse_qs(parsed.query).get("source", ["futu"])[0]
                labels = {"futu": "Futu OpenD", "eastmoney": "东方财富", "ths": "同花顺"}
                rows = eastmoney_kline_payload(symbol, count, period) if source == "eastmoney" else kline_payload(symbol, count, period)
                if source == "ths":
                    raise RuntimeError("同花顺接口需要配置本地授权地址或 Token，当前未启用")
                self._send(200, {"ok": True, "source": labels.get(source, source), "source_id": source, "symbol": symbol, "period": period, "rows": rows})
            else:
                self._send(404, {"ok": False, "error": "not_found"})
        except Exception as error:
            self._send(503, {"ok": False, "source": "Futu OpenD", "error": str(error)})

    def log_message(self, *_args):
        return


if __name__ == "__main__":
    print(f"Futu market bridge listening on http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
