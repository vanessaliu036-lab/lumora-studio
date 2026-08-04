"""
Lumora TG 單一流程 Bot — 三段自動化

做什麼：
    同一支 Bot 負責完整三段流程：
    ① 進件：蒐集需求 → 寫入 Airtable CRM → 通知客服
    ② 付款／製作：付款確認後通知客戶 → 進入製作
    ③ 交付／結案：成品交付 → 客戶確認收貨 → 結案

核心：客戶的 Telegram User ID 和 username 是「自動抓」的，不是問來的。
      這兩個是辨識回頭客的主鍵，客戶自己填一定會錯。

只問五件事（其餘由客服後續追問）：
    1. 姓名
    2. Personal 還是 Brand
    3. 需求簡述
    4. 參考照片（可略過）
    5. 其他聯絡方式（可略過）
    + Partner Code 由 Bot 依進入管道自動寫入

執行：
    pip install 'python-telegram-bot[job-queue]' requests
    # ↑ 必須加 [job-queue]，否則轉單通知輪詢不會啟動（app.job_queue 會是 None）
    export TELEGRAM_BOT_TOKEN=xxx
    export AIRTABLE_PAT=patXXXX
    export STAFF_CHAT_ID=你的TG數字ID        # 客服通知用，可留空
    export PARTNER_CODE=PTN-001              # 這支 Bot 的經銷商，官方直客留空
    python bot_crm.py

不要同時啟動其他 bot_crm.py 副本；所有三段都由這個 process 處理。
"""
from __future__ import annotations

import logging
import os
import re
from datetime import datetime, timezone
from typing import Any

import requests
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import (Application, CallbackQueryHandler, CommandHandler,
                          ContextTypes, MessageHandler, filters)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("crm_bot")

TG_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
PAT = os.getenv("AIRTABLE_PAT", "")
STAFF_CHAT_ID = os.getenv("STAFF_CHAT_ID", "")
PARTNER_CODE = os.getenv("PARTNER_CODE", "")

BASE = "appOLY56Y7cNExxzs"
API = f"https://api.airtable.com/v0/{BASE}"
H = {"Authorization": f"Bearer {PAT}", "Content-Type": "application/json"}

T_CRM = "tblWtB7qlAQQTYS9v"
T_CUSTOMERS = "tblAmgyZ0iN8Ka00a"
T_PARTNERS = "tblF3paIolcwlzu6v"
T_LOG = "tblKj7lmjnjISSK6W"
T_ORDERS = "tblJix6eujPrblpIv"

# ── CRM 欄位 ──
F = {
    "crm_id":      "fldPiAqxvcqUAVlOt",
    "inquiry_at":  "fldQFvnAuDeTvqgNw",
    "name":        "fld4fR3xZsnnz4SPX",
    "customer":    "fldDnWyoCddWT2fXN",
    "tg_id":       "fldUhH1eg1NYcYP0p",
    "tg_user":     "fldgp0Nlk2qGe7OCw",
    "contact":     "fld2zuVhs13gBUIlX",
    "partner":     "fld3xtxARLqjNFMuz",
    "source":      "fld7E70faxHftu005",
    "service":     "fld9IzsI7l3HFsR5u",
    "lang":        "fldrJhngpbkd3SbHj",
    "returning":   "fldEPjyN5pdK6lJ9V",
    "summary":     "fldAW7LjXkOFy47tx",
    "files":       "fldmTkmz4I03b6prq",
    "has_files":   "fldJMVOtFJ0jiltDQ",
    "priority":    "fldhOSwS1KKHPuC3s",
    "status":      "fld1gcw6wKzGgGa4H",
    "touch":       "fldAm5DU4IGn56W9c",
    "bot_msg":     "fldsbm4Jbw3hBtlvJ",
    "bot_sync":    "fldLjgcaLMtLH8nV0",
    "created_by":  "fldKI1RvfNFuZ5s99",
    "updated":     "fldXmAIhHGFAoDNCK",
    "notes":       "fldwz2iwEkComdXQx",
    "package":     "fldNogxPnzdDvNBrJ",
    "quoted":      "fld5p7W94JMn5iApr",
}
C = {  # Customers
    "name": "fldejtWqrzvEL7Khl", "tg_handle": "fldl7aAsp0edkrcdg",
    "tg_id": "fld7l2eljs9om9dgn", "partner": "fldiAXuQhLvvwpK4k",
    "status": "fldFDn2DTJlGI3pe8",
}
L = {  # Partner Submission Log
    "log_id": "flddyaGJGSWolWefE", "at": "fld4W8iBNHpGASwx3",
    "partner": "fldBwRMJhQrYhoy5Y", "code": "fldU15L9X9LErBlI9",
    "tg_id": "fldW3s9rmu8T4hmpj", "name": "flduqLiOpvGAPvLNt",
    "bot_msg": "fldRAPkCaJjqTR5uk", "payload": "fldy4zaXI8K6oztqu",
    "crm": "fld3ieNfSl4x5b853", "result": "fldy6PbDUqdSr4V9H",
    "http": "fldnRP5LDlpZxBjUN",
}

LANG_MAP = {"zh": "ZH", "zh-hans": "ZH", "zh-hant": "ZH", "km": "KH", "en": "EN"}

# ── 方案表 ──
# key 必須與 Airtable「Package」欄位的選項名稱完全一致（typecast 已關，打錯會直接報錯）
# 改價只改這裡，Bot 選單和報價金額會同步更新
PACKAGES = {
    "Personal Identity": [
        {"key": "Style Portrait — $5",  "label": "Style Portrait $5",  "price": 5,  "desc": "單一風格 6 張"},
        {"key": "Single Template — $6", "label": "單模板組 $6",        "price": 6,  "desc": "1 模板 6 張"},
        {"key": "Dual Template — $10",  "label": "雙模板組 $10",       "price": 10, "desc": "2 模板 12 張"},
        {"key": "15s Video — $5",       "label": "15 秒影片 $5",       "price": 5,  "desc": "動態短片 1 支"},
        {"key": "All Access — $15",     "label": "全模板暢享 $15",     "price": 15, "desc": "24 小時不限次數"},
    ],
    "Brand Campaign": [
        {"key": "Brand Campaign — $320", "label": "品牌企劃 $320",     "price": 320, "desc": "完整企劃 10 支素材"},
        {"key": "Custom 客製報價",        "label": "客製報價",          "price": None, "desc": "由專員評估"},
    ],
}


def tg_file_url(file_path: str) -> str:
    """
    把 Telegram 的 file_path 轉成 Airtable 抓得到的完整 URL。

    python-telegram-bot 多數情況下已經幫你補上 base_file_url，
    但這不是契約保證 —— 拿到相對路徑（photos/file_123.jpg）時
    Airtable 會直接抓不到，附件寫入靜默失敗。這裡自己判斷比較保險。

    ⚠️ 注意：完整 URL 內含 bot token，Airtable 會把它記在附件來源。
       正式上線建議改成「下載後上傳到自己的儲存空間」再給 Airtable，
       另外這個 URL 約 1 小時後失效，Airtable 必須立即抓取。
    """
    if not file_path:
        return ""
    if file_path.startswith(("http://", "https://")):
        return file_path
    return f"https://api.telegram.org/file/bot{TG_TOKEN}/{file_path.lstrip('/')}"


def pkg_by_key(key: str) -> dict | None:
    for items in PACKAGES.values():
        for p in items:
            if p["key"] == key:
                return p
    return None


# ═══════════════════════════════════════════════════
# Airtable 存取
# ═══════════════════════════════════════════════════

def at_list(table: str, formula: str = "", size: int = 5) -> list[dict]:
    params: dict[str, Any] = {"pageSize": size}
    if formula:
        params["filterByFormula"] = formula
    r = requests.get(f"{API}/{table}", headers=H, params=params, timeout=20)
    r.raise_for_status()
    return r.json().get("records", [])


def at_create(table: str, fields: dict) -> dict:
    """
    ⚠️ typecast 一律關閉。

    typecast=True 會讓 Airtable「自動新增不存在的選項」——
    打錯一個字就默默多一個選項，不報錯，而自動化只認正確的那個，
    結果就是流程無聲失效。寧可讓它直接報錯。
    """
    r = requests.post(f"{API}/{table}", headers=H,
                      json={"fields": fields, "typecast": False}, timeout=20)
    r.raise_for_status()
    return r.json()


def next_crm_id() -> str:
    """CRM-YYYYMMDD-NNN，依當日既有筆數編號。"""
    today = datetime.now().strftime("%Y%m%d")
    try:
        rows = at_list(T_CRM, f"FIND('CRM-{today}', {{CRM ID}}) > 0", 100)
        return f"CRM-{today}-{len(rows) + 1:03d}"
    except Exception:
        return f"CRM-{today}-001"


def find_partner(code: str) -> str | None:
    if not code:
        return None
    try:
        rows = at_list(T_PARTNERS, f"{{Partner Code}} = '{code}'", 1)
        return rows[0]["id"] if rows else None
    except Exception as e:
        log.warning("查經銷商失敗 %s: %s", code, e)
        return None


def find_or_create_customer(tg_id: str, name: str, username: str,
                            partner_rec: str | None) -> tuple[str | None, bool]:
    """
    回傳 (customer_record_id, 是否為回頭客)。
    以 Telegram User ID 為唯一鍵 —— 這是辨識回頭客唯一可靠的依據，
    姓名會重複、會改，TG ID 不會。
    """
    try:
        rows = at_list(T_CUSTOMERS, f"{{🤖 Telegram User ID}} = '{tg_id}'", 1)
        if rows:
            return rows[0]["id"], True

        fields = {C["name"]: name, C["tg_id"]: tg_id, C["status"]: "Active"}
        if username:
            fields[C["tg_handle"]] = f"@{username}"
        if partner_rec:
            fields[C["partner"]] = [partner_rec]
        return at_create(T_CUSTOMERS, fields)["id"], False
    except Exception as e:
        log.warning("客戶主檔處理失敗: %s", e)
        return None, False


# ═══════════════════════════════════════════════════
# 對話狀態
# ═══════════════════════════════════════════════════

ASK_NAME, ASK_SERVICE, ASK_PACKAGE, ASK_SUMMARY, ASK_PHOTOS, ASK_CONTACT, DONE = range(7)
ASK_PAYMENT, ASK_STYLE = range(7, 9)


def S(ctx) -> dict:
    return ctx.chat_data.setdefault("intake", {"step": ASK_NAME, "photos": []})


SERVICE_KB = InlineKeyboardMarkup([[
    InlineKeyboardButton("個人形象照", callback_data="svc:Personal Identity"),
    InlineKeyboardButton("品牌企劃", callback_data="svc:Brand Campaign"),
]])

SKIP_KB = InlineKeyboardMarkup([[InlineKeyboardButton("略過", callback_data="skip")]])

STYLE_KB = InlineKeyboardMarkup([
    [InlineKeyboardButton("1️⃣ Style 1", callback_data="style:Style 1"),
     InlineKeyboardButton("2️⃣ Style 2", callback_data="style:Style 2")],
    [InlineKeyboardButton("3️⃣ Style 3", callback_data="style:Style 3"),
     InlineKeyboardButton("4️⃣ Style 4", callback_data="style:Style 4")],
])


# ═══════════════════════════════════════════════════
# Handlers
# ═══════════════════════════════════════════════════

async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    u = update.effective_user
    start_payload = (ctx.args[0] if ctx.args else "").strip()
    order_service = "Personal Identity"
    order_package = "Style Portrait — $5"
    order_quoted = 5
    order_crm_id = ""
    match = re.fullmatch(r"order_(CRM-\d{8}-\d{3})_(portrait|motion|template|custom)_(\d+|custom)", start_payload)
    if match:
        order_crm_id = match.group(1)
        key = match.group(2)
        order_quoted = None if match.group(3) == "custom" else int(match.group(3))
        order_service = "Personal Identity" if key in ("portrait", "motion") else "Brand Campaign"
        order_package = {
            "portrait": "Style Portrait — $5",
            "motion": "Style to Motion — $12",
            "template": "Template Video — $15",
            "custom": "Custom Brand Style",
        }[key]
    ctx.chat_data["intake"] = {
        "step": ASK_PAYMENT,
        "photos": [],
        "flow": "personal_identity_v1",
        "name": (u.full_name or u.username or "Lumora 客戶").strip(),
        "service": order_service,
        "package": order_package,
        "quoted": order_quoted,
        "crm_id": order_crm_id,
    }

    # 這裡就抓到身分了，不用問客戶
    log.info("進件開始 tg_id=%s username=@%s lang=%s", u.id, u.username, u.language_code)

    await update.message.reply_text(
        "你好，歡迎聯繫 Lumora ✨\n\n"
        f"你目前選擇的是：\n\n{order_package}\n"
        f"USD ${order_quoted if order_quoted is not None else '待報價'}\n\n"
        "💳 付款資訊\n\n"
        f"方案：{order_package}\n"
        f"金額：USD ${order_quoted if order_quoted is not None else '待報價'}\n"
        "收款帳號：000-303-520\n\n"
        "完成付款後，請直接回覆：\n\n"
        "帳號後五碼\n\n"
        "例如：12345\n\n"
        "客服會盡快為您人工確認付款。"
    )


async def on_text(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    s = S(ctx)
    text = (update.message.text or "").strip()

    if s["step"] == ASK_PAYMENT and s.get("flow") == "personal_identity_v1":
        digits = "".join(c for c in text if c.isdigit())
        if len(digits) != 5:
            await update.message.reply_text("請直接回覆匯款帳號後五碼（例如：12345）。")
            return
        s["last5"] = digits
        # 付款確認後先固定本次案件編號，後續生活照與真人客服都沿用同一編號。
        s["crm_id"] = next_crm_id()
        s["step"] = ASK_STYLE
        await update.message.reply_text(
            "✅ 已收到您的付款！\n\n"
            "您的付款已完成確認。\n\n"
            f"訂單編號：{s['crm_id']}\n\n"
            "接下來請依照流程選擇您想生成的模板風格，"
            "我們將開始為您建立 AI 個人形象。\n\n"
            "請挑選您想生成的模板風格：\n\n"
            "1️⃣ Style 1\n"
            "2️⃣ Style 2\n"
            "3️⃣ Style 3\n"
            "4️⃣ Style 4\n\n"
            "請直接回覆數字即可。\n\n"
            "如需查詢目前製作進度，隨時輸入 /status。",
            reply_markup=STYLE_KB,
        )
        return

    if s["step"] == ASK_STYLE and s.get("flow") == "personal_identity_v1":
        style_map = {"1": "Style 1", "2": "Style 2", "3": "Style 3", "4": "Style 4"}
        style = style_map.get(text)
        if not style:
            await update.message.reply_text("請回覆 1、2、3 或 4，選擇模板風格。", reply_markup=STYLE_KB)
            return
        s["style"] = style
        s["step"] = ASK_PHOTOS
        await update.message.reply_text(
            f"✅ 已收到您的風格選擇：{style}\n\n"
            "由於 AI 圖像生成平台的限制，真人照片無法直接進行風格轉換。\n\n"
            "請上傳至少 5 張生活照作為 AI 人物建模素材。\n\n"
            "建議照片包含：正面、左側臉、右側臉、半身、全身。\n\n"
            "照片越自然、角度越完整，最終生成效果會越穩定。\n"
            "傳完後請按「下一步」。",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("下一步", callback_data="next"),
            ]]),
        )
        return

    if s["step"] == ASK_NAME:
        s["name"] = text
        s["step"] = ASK_SERVICE
        await update.message.reply_text(
            f"你好，{text} 🙂\n\n這次想做的是哪一種？", reply_markup=SERVICE_KB)

    elif s["step"] == ASK_SUMMARY:
        s["summary"] = text
        s["step"] = ASK_PHOTOS
        await update.message.reply_text(
            "收到！如果有參考照片或商品圖，可以直接傳給我（最多 5 張）。\n"
            "傳完請按「下一步」，沒有的話按「略過」。",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("下一步", callback_data="next"),
                InlineKeyboardButton("略過", callback_data="skip"),
            ]]))

    elif s["step"] == ASK_CONTACT:
        s["contact"] = text
        await submit(update, ctx)

    else:
        await update.message.reply_text("請先用 /start 開始登記 🙂")


async def on_button(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()
    s = S(ctx)
    data = q.data or ""

    if data.startswith("delivery:confirm:"):
        await q.answer()
        await confirm_delivery(update, ctx, data.rsplit(":", 1)[-1])
        return

    if data.startswith("style:") and s.get("flow") == "personal_identity_v1":
        style = data.split(":", 1)[1]
        s["style"] = style
        s["step"] = ASK_PHOTOS
        await q.edit_message_text(f"✅ 已選擇：{style}")
        await ctx.bot.send_message(
            q.message.chat_id,
            "由於 AI 圖像生成平台的限制，真人照片無法直接進行風格轉換。\n\n"
            "請先上傳至少 5 張生活照，作為 AI 人物建模素材。\n\n"
            "建議照片包含：\n"
            "・正面\n・左側臉\n・右側臉\n・半身\n・全身\n\n"
            "照片越自然、角度越完整，最終生成效果會越穩定。\n\n"
            "傳完照片後，請按「下一步」。",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("下一步", callback_data="next"),
            ]]),
        )
        return

    if data.startswith("svc:"):
        s["service"] = data.split(":", 1)[1]
        s["step"] = ASK_PACKAGE
        label = "個人形象照" if "Personal" in s["service"] else "品牌企劃"
        await q.edit_message_text(f"已選擇：{label} ✅")

        items = PACKAGES.get(s["service"], [])
        kb = InlineKeyboardMarkup(
            [[InlineKeyboardButton(f"{p['label']}　{p['desc']}", callback_data=f"pkg:{i}")]
             for i, p in enumerate(items)]
            + [[InlineKeyboardButton("先不確定，請專員建議", callback_data="pkg:-1")]])
        await ctx.bot.send_message(q.message.chat_id, "想選哪個方案？", reply_markup=kb)

    elif data.startswith("pkg:"):
        idx = int(data.split(":", 1)[1])
        items = PACKAGES.get(s.get("service", ""), [])
        if 0 <= idx < len(items):
            p = items[idx]
            s["package"] = p["key"]
            s["quoted"] = p["price"]
            await q.edit_message_text(f"已選擇：{p['label']} ✅")
        else:
            s["package"] = None
            s["quoted"] = None
            await q.edit_message_text("好的，由專員依你的需求建議方案 ✅")

        s["step"] = ASK_SUMMARY
        await ctx.bot.send_message(
            q.message.chat_id,
            "請簡單描述你的需求，例如：\n"
            "「想要韓系形象照放在交友軟體，希望自然一點」\n"
            "「新品要拍 IG Reels 素材，9:16，不要有 AI 感」")

    elif data in ("next", "skip") and s["step"] == ASK_PHOTOS:
        if s.get("flow") == "personal_identity_v1":
            if data == "next" and len(s["photos"]) < 5:
                await q.answer("請至少上傳 5 張生活照", show_alert=True)
                return
            await q.edit_message_text(f"✅ 已收到您的照片（{len(s['photos'])} 張）。")
            await ctx.bot.send_message(
                q.message.chat_id,
                "✅ 已收到您的生活照。\n\n"
                "下一步：\n\n"
                "我們會先使用您提供的生活照建立 AI 人物基準（第一階段）。\n\n"
                "完成後，我們會將基準人物圖傳給您挑選與確認。\n"
                "接下來由真人客服接手協助您完成後續製作。\n\n"
                "任何時間都可以輸入 /status，即可查詢目前製作進度。",
            )
            await submit(update, ctx, from_button=True)
            return
        s["step"] = ASK_CONTACT
        await q.edit_message_text(f"照片：{len(s['photos'])} 張")
        await ctx.bot.send_message(
            q.message.chat_id,
            "最後一步：方便留一個其他聯絡方式嗎？（電話或 Email）\n"
            "沒有也沒關係，我們會直接在 Telegram 聯繫你。",
            reply_markup=SKIP_KB)

    elif data == "skip" and s["step"] == ASK_CONTACT:
        await q.edit_message_text("好的，我們直接在 Telegram 聯繫你。")
        await submit(update, ctx, from_button=True)


async def on_photo(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    s = S(ctx)
    if s["step"] != ASK_PHOTOS:
        await update.message.reply_text("先描述一下需求，我再收照片 🙂")
        return
    if len(s["photos"]) >= 5:
        await update.message.reply_text("照片夠了，按「下一步」繼續")
        return

    photo = update.message.photo[-1]
    f = await photo.get_file()
    s["photos"].append(tg_file_url(f.file_path))
    await update.message.reply_text(f"收到 ({len(s['photos'])}/5) 📸")


# ═══════════════════════════════════════════════════
# 寫入 Airtable
# ═══════════════════════════════════════════════════

async def submit(update: Update, ctx: ContextTypes.DEFAULT_TYPE, from_button: bool = False):
    s = S(ctx)
    u = update.effective_user
    chat_id = update.effective_chat.id
    msg_id = str(update.effective_message.message_id)

    await ctx.bot.send_message(chat_id, "登記中…")

    tg_id = str(u.id)
    username = u.username or ""
    lang = LANG_MAP.get((u.language_code or "").lower(), "Other")
    partner_rec = find_partner(PARTNER_CODE)

    customer_rec, returning = find_or_create_customer(
        tg_id, s.get("name", ""), username, partner_rec)

    crm_id = s.get("crm_id") or next_crm_id()
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")

    fields: dict[str, Any] = {
        F["crm_id"]:     crm_id,
        F["inquiry_at"]: now,
        F["name"]:       s.get("name", ""),
        F["tg_id"]:      tg_id,
        F["tg_user"]:    f"@{username}" if username else "",
        F["service"]:    s.get("service", "Personal Identity"),
        F["summary"]:    s.get("summary", ""),
        F["lang"]:       lang,
        F["returning"]:  returning,
        F["has_files"]:  bool(s["photos"]),
        F["status"]:     "New",
        F["priority"]:   "High" if returning else "Normal",
        F["touch"]:      0,
        F["source"]:     "Partner Bot" if PARTNER_CODE else "Official Bot",
        F["bot_msg"]:    msg_id,
        F["bot_sync"]:   "Received",
        F["created_by"]: "TG Bot",
        F["updated"]:    now,
    }
    if s.get("package"):
        fields[F["package"]] = s["package"]
    if s.get("quoted") is not None:
        fields[F["quoted"]] = s["quoted"]
    if s.get("contact"):
        fields[F["contact"]] = s["contact"]
    if customer_rec:
        fields[F["customer"]] = [customer_rec]
    if partner_rec:
        fields[F["partner"]] = [partner_rec]
    if s["photos"]:
        fields[F["files"]] = [{"url": p} for p in s["photos"]]

    # Partner 端先寫 log（漏單偵測的前提）
    log_rec = None
    if PARTNER_CODE:
        try:
            log_rec = at_create(T_LOG, {
                L["log_id"]: f"{PARTNER_CODE}-{datetime.now().strftime('%Y%m%d')}-{msg_id}",
                L["at"]: now, L["code"]: PARTNER_CODE, L["tg_id"]: tg_id,
                L["name"]: s.get("name", ""), L["bot_msg"]: msg_id,
                L["payload"]: s.get("summary", "")[:500],
                **({L["partner"]: [partner_rec]} if partner_rec else {}),
            })
        except Exception as e:
            log.warning("送件 log 寫入失敗: %s", e)

    try:
        existing = at_list(T_CRM, f"{{CRM ID}} = '{crm_id}'", 1) if s.get("crm_id") else []
        if existing:
            rec = existing[0]
            requests.patch(
                f"{API}/{T_CRM}/{rec['id']}", headers=H,
                json={"fields": fields, "typecast": False}, timeout=20,
            ).raise_for_status()
        else:
            rec = at_create(T_CRM, fields)
    except Exception as e:
        log.exception("CRM 寫入失敗")
        await ctx.bot.send_message(
            chat_id, "登記時遇到問題，專員會直接與你聯繫，抱歉 🙏")
        if STAFF_CHAT_ID:
            await ctx.bot.send_message(
                STAFF_CHAT_ID,
                f"⚠️ CRM 寫入失敗\n{s.get('name')} (@{username}, {tg_id})\n{e}")
        return

    # log 回填 CRM 連結 → 對得上的才不是漏單
    if log_rec:
        try:
            requests.patch(f"{API}/{T_LOG}/{log_rec['id']}", headers=H,
                           json={"fields": {L["crm"]: [rec["id"]],
                                            L["result"]: "Received",
                                            L["http"]: 200},
                                 "typecast": False}, timeout=20)
        except Exception as e:
            log.warning("log 回填失敗: %s", e)

    s["step"] = DONE
    welcome_back = "很高興再次見到你 🙌\n" if returning else ""
    await ctx.bot.send_message(
        chat_id,
        f"{welcome_back}✅ 已收到你的需求\n\n"
        f"編號：{crm_id}\n"
        f"專員會盡快與你聯繫，通常在數小時內。\n\n"
        f"隨時可以輸入 /status 查詢進度。")

    if STAFF_CHAT_ID:
        tag = "🔁 回頭客" if returning else "🆕 新客"
        if s.get("package"):
            q = s.get("quoted")
            pkg_label = s["package"] + (f"　${q}" if q is not None else "")
        else:
            pkg_label = "未選（待專員報價）"
        await ctx.bot.send_message(
            STAFF_CHAT_ID,
            f"{tag} 新詢問\n\n"
            f"編號：{crm_id}\n"
            f"客戶：{s.get('name')}（@{username or '無'}）\n"
            f"TG ID：{tg_id}\n"
            f"服務：{s.get('service')}\n"
            f"方案：{pkg_label}\n"
            f"來源：{PARTNER_CODE or '官方直客'}\n"
            f"照片：{len(s['photos'])} 張\n\n"
            f"需求：{s.get('summary', '')[:200]}\n\n"
            f"{rec.get('url', '')}")


async def status(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    tg_id = str(update.effective_user.id)
    try:
        rows = at_list(T_CRM, f"{{Telegram User ID}} = '{tg_id}'", 5)
    except Exception:
        await update.message.reply_text("查詢時遇到問題，請稍後再試。")
        return
    if not rows:
        await update.message.reply_text("目前沒有登記中的需求，輸入 /start 開始。")
        return
    lines = []
    for r in rows:
        fields = r.get("fields", {})
        status_value = fields.get("CRM Status", "處理中")
        stage = STAGE_LABELS.get(status_value, status_value)
        lines.append(f"{fields.get('CRM ID', '?')}　{stage}")
    await update.message.reply_text("你的詢問：\n" + "\n".join(lines))


async def whoami(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """測試用：確認 Bot 抓到的身分資訊，也方便你取得 STAFF_CHAT_ID。"""
    u = update.effective_user
    await update.message.reply_text(
        f"Bot 抓到的身分：\n"
        f"TG User ID：{u.id}\n"
        f"Username：@{u.username or '（未設定）'}\n"
        f"名稱：{u.full_name}\n"
        f"語言：{u.language_code}\n"
        f"Chat ID：{update.effective_chat.id}")



# ═══════════════════════════════════════════════════
# 轉單通知輪詢
#
# Airtable 原生沒有 Telegram 動作，而把 bot token 貼進 Airtable 腳本
# 等於把鑰匙留在別人家。改用 bot 主動輪詢：
#   每 60 秒查一次「已轉單但尚未通知」的 CRM → 發 TG → 寫回後台標記已通知
# token 全程留在環境變數，不進 Airtable。
# ═══════════════════════════════════════════════════

NOTIFY_INTERVAL = 60  # 秒

STAGE_LABELS = {
    "New": "第 1 段｜已收到需求",
    "Converted": "第 2 段｜已付款／製作中",
    "Ready to Deliver": "第 3 段｜待交付",
    "Closed": "已結案",
}


async def poll_converted(ctx: ContextTypes.DEFAULT_TYPE):
    """第二段：已轉單但還沒通知客戶的 CRM → 發 TG → 回寫後台。"""
    if not PAT:
        return
    try:
        rows = at_list(
            T_CRM,
            "AND({CRM Status} = 'Converted', {Bot Sync Status} != 'Synced')",
            20,
        )
    except Exception as e:
        log.warning("轉單輪詢失敗: %s", e)
        return

    for r in rows:
        f = r.get("fields", {})
        tg_id = f.get("Telegram User ID")
        crm_id = f.get("CRM ID", "")
        if not tg_id:
            continue

        order = f.get("Converted Order")
        order_txt = f"\n訂單編號：{order[0]}" if isinstance(order, list) and order else ""

        try:
            await ctx.bot.send_message(
                int(tg_id),
                f"✅ 付款已確認，訂單成立\n\n"
                f"詢問編號：{crm_id}{order_txt}\n\n"
                f"接下來會請你提供製作所需的素材，\n"
                f"專員稍後會與你聯繫。感謝你的信任 🙏"
            )
            sync, note = "Synced", "已於 TG 通知客戶轉單成功"
        except Exception as e:
            log.warning("TG 通知失敗 crm=%s: %s", crm_id, e)
            sync, note = "Error", f"TG 通知失敗：{e}"

        # 回寫後台 —— 通知有沒有送到，後台看得到
        try:
            requests.patch(
                f"{API}/{T_CRM}/{r['id']}",
                headers=H,
                json={"fields": {
                    F["bot_sync"]: sync,
                    F["updated"]: datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    F["notes"]: note,
                }, "typecast": False},
                timeout=20,
            )
        except Exception as e:
            log.warning("回寫通知狀態失敗: %s", e)

        if STAFF_CHAT_ID and sync == "Synced":
            await ctx.bot.send_message(
                STAFF_CHAT_ID,
                f"💰 轉單完成\n{crm_id}　{f.get('Customer Name', '')}{order_txt}\n"
                f"已通知客戶，Partner 額度自動 +1"
            )


async def poll_ready_to_deliver(ctx: ContextTypes.DEFAULT_TYPE):
    """第三段：後台標記可交付 → 同一支 Bot 通知客戶並等待收貨確認。"""
    if not PAT:
        return
    try:
        rows = at_list(
            T_CRM,
            "AND({CRM Status} = 'Ready to Deliver', {Bot Sync Status} != 'Delivered Notified')",
            20,
        )
    except Exception as e:
        log.warning("交付輪詢失敗: %s", e)
        return

    for r in rows:
        fields = r.get("fields", {})
        tg_id = fields.get("Telegram User ID")
        crm_id = fields.get("CRM ID", "")
        if not tg_id:
            continue
        try:
            await ctx.bot.send_message(
                int(tg_id),
                f"📦 成品已完成，編號：{crm_id}\n\n"
                "請確認是否已收到成品；若需要調整，也可以直接回覆客服。",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("✓ 已收到，結案", callback_data=f"delivery:confirm:{r['id']}"),
                ]]),
            )
            requests.patch(
                f"{API}/{T_CRM}/{r['id']}", headers=H,
                json={"fields": {
                    F["bot_sync"]: "Delivered Notified",
                    F["updated"]: datetime.now(timezone.utc).isoformat(timespec="seconds"),
                }, "typecast": False}, timeout=20,
            ).raise_for_status()
        except Exception as e:
            log.warning("交付通知失敗 crm=%s: %s", crm_id, e)


async def confirm_delivery(update: Update, ctx: ContextTypes.DEFAULT_TYPE, crm_rec: str):
    """客戶確認收貨：第三段完成，CRM 留下結案狀態。"""
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    try:
        requests.patch(
            f"{API}/{T_CRM}/{crm_rec}", headers=H,
            json={"fields": {
                F["status"]: "Closed",
                F["bot_sync"]: "Closed",
                F["updated"]: now,
            }, "typecast": False}, timeout=20,
        ).raise_for_status()

        # 同步找到關聯 Order，讓後台在客戶按下 TG 確認後立即結案。
        orders = at_list(T_ORDERS, size=100)
        for order in orders:
            links = order.get("fields", {}).get("CRM", [])
            if isinstance(links, list) and crm_rec in links:
                requests.patch(
                    f"{API}/{T_ORDERS}/{order['id']}", headers=H,
                    json={"fields": {
                        "Production Status": "生產結案",
                        "Order Status": "已結案",
                        "Completed At": now,
                    }, "typecast": True}, timeout=20,
                ).raise_for_status()
                break
    except Exception as e:
        log.warning("結案回寫失敗 crm=%s: %s", crm_rec, e)
        await update.callback_query.answer("結案回寫失敗，請聯絡客服", show_alert=True)
        return

    await update.callback_query.edit_message_text(
        "哇，你看起來超美的！✨\n\n"
        "感謝你使用我們的服務，\n"
        "希望再次遇到你 💜\n\n"
        "✅ 訂單已完成並結案。"
    )
    if STAFF_CHAT_ID:
        await ctx.bot.send_message(
            STAFF_CHAT_ID,
            f"📦 客戶已確認收貨，訂單結案\nCRM record：{crm_rec}",
        )


def main():
    if not TG_TOKEN:
        raise SystemExit("請設定 TELEGRAM_BOT_TOKEN")
    if not PAT:
        log.warning("未設定 AIRTABLE_PAT，寫入會失敗")

    app = Application.builder().token(TG_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("status", status))
    app.add_handler(CommandHandler("whoami", whoami))
    app.add_handler(CallbackQueryHandler(on_button))
    app.add_handler(MessageHandler(filters.PHOTO, on_photo))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_text))

    # 同一支 Bot 的第二、三段輪詢：付款／製作 → 交付／結案
    if app.job_queue:
        app.job_queue.run_repeating(poll_converted, interval=NOTIFY_INTERVAL, first=10)
        app.job_queue.run_repeating(poll_ready_to_deliver, interval=NOTIFY_INTERVAL, first=20)
        log.info("三段流程輪詢已啟動（每 %s 秒）", NOTIFY_INTERVAL)
    else:
        log.warning("job_queue 不可用，第二、三段通知不會發送："
                    "pip install 'python-telegram-bot[job-queue]'")

    log.info("單一 Bot 啟動｜三段流程｜Partner=%s", PARTNER_CODE or "官方直客")
    app.run_polling()


if __name__ == "__main__":
    main()
