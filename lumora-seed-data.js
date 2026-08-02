/**
 * Lumora 前台假資料 — 與 Airtable 完全一致
 *
 * 來源：Airtable base appOLY56Y7cNExxzs（2026-08-02 匯出）
 * 用途：取代 Vercel 前台目前寫死的舊假資料（Nina / Mia / ORD-1101~1105）
 *
 * 使用方式：
 *   import { ORDERS, CRM, PARTNERS, CUSTOMERS } from './lumora-seed-data';
 *
 * ⚠️ 注意事項
 * 1. 這是假資料，正式串接請改讀 Airtable API（PAT 必須放伺服器端，不能進前端）
 * 2. 欄位名稱已對齊新架構：付款欄位在 CRM，Orders 只有唯讀鏡像
 * 3. 舊的 Payment Method / Order Status 欄位已廢除，改用 Production Status
 */

// ═══════════════════════════════════════════════
// PARTNERS — 經銷商（總量制額度）
// ═══════════════════════════════════════════════

export const PARTNERS = [
  {
    partnerId: "Taiwan Studio",
    partnerCode: "PTN-001",
    brandName: "LUMINA Studio",
    owner: "Ivy Chen",
    email: "ivy@taiwanstudio.com",
    telegram: "@taiwan_studio",
    country: "Taiwan",
    onboardingStatus: "已完成",
    webhookStatus: "Active",
    // 方案與額度（ƒ / ∑ 為自動計算，前台唯讀）
    planLimit: 10,
    usedOrders: 1,           // ∑ 自動計算
    remainingOrders: 9,      // ƒ = planLimit − used
    planStatus: "Active 正常",
    renewalAlert: "",
    // 同步監控
    crmSubmitted: 1,         // ∑ 來自 Partner Submission Log
    crmReceived: 1,          // ∑ 官方實際收到
    transferDifference: 0,   // ƒ
    syncStatus: "正常",      // ƒ
    conversionRate: 100,     // ƒ %
    // 分潤
    commissionRate: 15,
    unpaidCommission: 48.0,
  },
  {
    partnerId: "Phnom Penh Studio",
    partnerCode: "PTN-002",
    brandName: "PP Image Lab",
    owner: "Sok Piseth",
    email: "piseth@ppimagelab.com",
    telegram: "@pp_studio",
    country: "Cambodia",
    onboardingStatus: "已完成",
    webhookStatus: "Error",
    planLimit: 10,
    usedOrders: 0,
    remainingOrders: 10,
    planStatus: "Active 正常",
    renewalAlert: "",
    crmSubmitted: 3,
    crmReceived: 2,
    transferDifference: 1,
    syncStatus: "⚠ 漏單 1 筆",   // ← 刻意保留的異常案例
    conversionRate: 0,
    commissionRate: 15,
    unpaidCommission: 222.0,
  },
  {
    partnerId: "Siem Reap Digital",
    partnerCode: "PTN-003",
    brandName: "Angkor Portrait",
    owner: "Chea Vibol",
    email: "vibol@angkorportrait.com",
    telegram: "@sr_digital",
    country: "Cambodia",
    onboardingStatus: "進行中",
    webhookStatus: "Active",
    planLimit: 20,
    usedOrders: 1,
    remainingOrders: 19,
    planStatus: "Active 正常",
    renewalAlert: "",
    crmSubmitted: 0,
    crmReceived: 0,
    transferDifference: 0,
    syncStatus: "尚無送件",
    conversionRate: null,
    commissionRate: 12,
    unpaidCommission: 37.2,
  },
];

// ═══════════════════════════════════════════════
// CUSTOMERS — 客戶永久錨點（唯一鍵是 Telegram User ID）
// ═══════════════════════════════════════════════

export const CUSTOMERS = [
  {
    name: "Vanessa Liu",
    telegramUserId: "552104883",
    telegramHandle: "@vanessa_liu",
    email: "vanessa@occ.example",
    partnerCode: "PTN-001",
    status: "Active",
    lastStyle: "Luxury Portrait",
    totalOrders: 1,          // ∑
    totalInquiries: 1,       // ∑
    lifetimeValue: 320.0,    // ∑ 從 Orders 加總
  },
  {
    name: "Sreymom Chan",
    telegramUserId: "814255310",
    telegramHandle: "@sreymom_c",
    email: null,
    partnerCode: "PTN-002",
    status: "Active",
    lastStyle: null,
    totalOrders: 0,
    totalInquiries: 1,
    lifetimeValue: 0,
  },
  {
    name: "Sophea Kim",
    telegramUserId: "640228719",
    telegramHandle: "@sophea_k",
    email: null,
    partnerCode: "PTN-003",
    status: "Active",
    lastStyle: "韓系電梯閃燈",
    totalOrders: 1,
    totalInquiries: 0,
    lifetimeValue: 28.0,
  },
  {
    name: "Mealea Vann",
    telegramUserId: "771204558",
    telegramHandle: "@mealea_v",
    email: null,
    partnerCode: null,       // 官方直客
    status: "Active",
    lastStyle: null,
    totalOrders: 1,
    totalInquiries: 0,
    lifetimeValue: 45.0,
  },
  {
    name: "Dara Ponlok",
    telegramUserId: "733901255",
    telegramHandle: "@daraponlok",
    email: null,
    partnerCode: null,
    status: "Active",
    lastStyle: null,
    totalOrders: 0,
    totalInquiries: 1,
    lifetimeValue: 0,
  },
  {
    name: "Kanha Sok",
    telegramUserId: "690183422",
    telegramHandle: "@kanha_s",
    email: null,
    partnerCode: "PTN-002",
    status: null,
    lastStyle: null,
    totalOrders: 0,
    totalInquiries: 1,
    lifetimeValue: 0,
  },
];

// ═══════════════════════════════════════════════
// CRM — 詢問漏斗（付款驗證在這裡，不在 Orders）
// ═══════════════════════════════════════════════

export const CRM = [
  {
    crmId: "CRM-20260801-003",
    inquiryDate: "2026-08-01T09:12:00Z",
    customerName: "Sreymom Chan",
    telegramUserId: "814255310",
    telegramUsername: "@sreymom_c",
    contact: "+855 12 445 810",
    partnerCode: "PTN-002",
    source: "Partner Bot",
    serviceType: "Personal Identity",
    language: "KH",
    isReturning: false,
    inquirySummary:
      "想拍一組韓系形象照放在交友軟體，希望看起來自然不要太假。有先問可不可以看樣本。",
    hasReferenceFiles: true,
    budgetRange: "$20-50",
    priority: "High",
    // 客服追蹤
    crmStatus: "Closed Won",
    lastContact: "2026-08-01T18:40:00Z",
    nextFollowUp: "2026-08-02T10:00:00Z",
    firstResponseHours: 1.4,
    touchCount: 4,
    followUpNote:
      "客戶已匯款 $28，提供帳號後五碼 41882。等帳務比對 ABA 入帳。注意：核准人必須與填寫人不同。",
    // 付款驗證 ← 關鍵閘門
    paymentStatus: "Pending Verification",
    quotedAmount: 28.0,
    paymentMethod: "ABA",
    accountLast5: "41882",
    last5Valid: true,
    transferDate: "2026-08-01",
    submittedBy: "Nita（客服）",
    submittedAt: "2026-08-01T18:42:00Z",
    verifiedBy: null,
    verifiedAt: null,
    paymentLocked: false,
    readyToConvert: false,
    // 結案
    closeResult: null,
    convertedOrder: null,
    statusHistory: [
      { at: "08-01 09:12", event: "新進件（TG Bot）" },
      { at: "08-01 10:36", event: "已聯絡（首次回應 1.4 小時）" },
      { at: "08-01 14:20", event: "洽談中・報價 $28" },
      { at: "08-01 18:20", event: "客戶同意成交" },
      { at: "08-01 18:42", event: "待帳務確認・已填後五碼 41882", current: true },
    ],
  },
  {
    crmId: "CRM-20260801-002",
    inquiryDate: "2026-07-31T11:05:00Z",
    customerName: "Vanessa Liu",
    telegramUserId: "552104883",
    telegramUsername: "@vanessa_liu",
    contact: null,
    partnerCode: "PTN-001",
    source: "Official Bot",
    serviceType: "Brand Campaign",
    language: "ZH",
    isReturning: true,
    inquirySummary:
      "睫毛保養液新品要拍一組 IG Reels 素材，9:16，要 TK 手機紀錄感，不能有 AI 感。",
    hasReferenceFiles: true,
    budgetRange: "$200-500",
    priority: "Normal",
    crmStatus: "Converted",
    lastContact: "2026-07-31T16:20:00Z",
    nextFollowUp: null,
    firstResponseHours: 0.6,
    touchCount: 3,
    followUpNote: "老客戶，第 8 次下單。付款驗證完成，Order 已自動建立。",
    paymentStatus: "Confirmed",
    quotedAmount: 320.0,
    paymentMethod: "Bank",
    accountLast5: "70934",
    last5Valid: true,
    transferDate: "2026-07-31",
    submittedBy: "Nita（客服）",
    submittedAt: "2026-07-31T15:50:00Z",
    verifiedBy: "Rithy（帳務）",
    verifiedAt: "2026-07-31T16:18:00Z",
    paymentLocked: true,
    readyToConvert: true,
    verificationNote: "ABA 入帳金額相符",
    closeResult: "Won",
    closedAt: "2026-07-31T16:20:00Z",
    convertedOrder: "ORD-20260731-004",
    statusHistory: [
      { at: "07-31 11:05", event: "新進件（TG Bot）" },
      { at: "07-31 11:41", event: "已聯絡（首次回應 0.6 小時）" },
      { at: "07-31 15:30", event: "成交・報價 $320" },
      { at: "07-31 15:50", event: "待帳務確認・後五碼 70934" },
      { at: "07-31 16:18", event: "付款已確認並鎖定（Rithy 帳務）🔒" },
      { at: "07-31 16:20", event: "已轉單・Order 自動建立・Partner 額度 +1" },
    ],
  },
  {
    crmId: "CRM-20260801-004",
    inquiryDate: "2026-07-29T20:41:00Z",
    customerName: "Dara Ponlok",
    telegramUserId: "733901255",
    telegramUsername: "@daraponlok",
    contact: null,
    partnerCode: null,
    source: "IG",
    serviceType: "Personal Identity",
    language: "EN",
    isReturning: false,
    inquirySummary: "只問價格，沒說用途，也沒傳照片。",
    hasReferenceFiles: false,
    budgetRange: "未提供",
    priority: "Low",
    crmStatus: "Waiting Customer",
    lastContact: "2026-07-30T11:02:00Z",
    nextFollowUp: "2026-08-05T14:00:00Z",
    firstResponseHours: 14.2,     // ⚠ 首次回應過慢
    touchCount: 2,
    followUpNote: "已回報價區間，客戶讀了沒回。08-05 再追一次，沒回就結案。",
    paymentStatus: "Awaiting Payment",
    quotedAmount: null,
    paymentMethod: null,
    accountLast5: null,
    last5Valid: null,
    paymentLocked: false,
    readyToConvert: false,
    closeResult: null,
    convertedOrder: null,
    statusHistory: [
      { at: "07-29 20:41", event: "新進件（IG 私訊轉入）" },
      { at: "07-30 10:52", event: "已聯絡（首次回應 14.2 小時 ⚠）" },
      { at: "07-30 11:02", event: "等客戶回覆・已讀未回", current: true },
    ],
  },
  {
    crmId: "CRM-20260731-001",
    inquiryDate: "2026-07-28T15:30:00Z",
    customerName: "Kanha Sok",
    telegramUserId: "690183422",
    telegramUsername: "@kanha_s",
    contact: null,
    partnerCode: "PTN-002",
    source: "Partner Bot",
    serviceType: "Personal Identity",
    language: "KH",
    isReturning: false,
    inquirySummary: "想要婚紗風格照片，但預算只有 $10。",
    hasReferenceFiles: true,
    budgetRange: "< $20",
    priority: "Normal",
    crmStatus: "Closed Lost",
    lastContact: "2026-07-30T09:15:00Z",
    nextFollowUp: null,
    firstResponseHours: 2.1,
    touchCount: 5,
    followUpNote: "預算差距太大，已婉拒並說明最低方案。",
    paymentStatus: "Awaiting Payment",
    quotedAmount: 25.0,
    paymentLocked: false,
    readyToConvert: false,
    closeResult: "Lost",
    closedAt: "2026-07-30T09:15:00Z",
    lostReason: "預算不符",
    convertedOrder: null,
    statusHistory: [
      { at: "07-28 15:30", event: "新進件（TG Bot）" },
      { at: "07-28 17:36", event: "已聯絡" },
      { at: "07-29 10:20", event: "洽談中・報價 $25" },
      { at: "07-30 09:15", event: "未成交・預算不符" },
    ],
  },
];

// ═══════════════════════════════════════════════
// ORDERS — 專案（付款欄位為唯讀鏡像，改不動）
// ═══════════════════════════════════════════════

export const ORDERS = [
  {
    orderId: "ORD-20260731-004",
    createdAt: "2026-07-31T16:20:00Z",
    crmId: "CRM-20260801-002",
    customerName: "Vanessa Liu",
    telegramUserId: "552104883",
    partnerCode: "PTN-001",
    serviceType: "Brand Campaign",
    amount: 320.0,
    currency: "USD",
    // ↑ 從 CRM lookup，前台唯讀
    paymentStatus: "Confirmed",
    accountLast5: "70934",
    paymentVerifiedAt: "2026-07-31T16:18:00Z",
    // 成本與毛利（∑ / ƒ 自動計算）
    actualCost: 18.4,        // ∑ 從 Generation Runs 加總（12.6 + 5.8）
    partnerCommission: 48.0,
    grossMargin: 253.6,      // ƒ = 320 − 18.4 − 48
    // 製作
    productionStatus: "Generating 生成中",
    assetStatus: "Complete 齊全",
    missingAssetsNote: null,
    revision: 1,
    freeRevisionLimit: 2,
    consultant: "Nita",
    aiModel: "kling",
    identityModel: "IP-Adapter / InstantID",
    uploadPhotos: 5,
    // 交付
    promisedDate: "2026-08-03",
    daysLate: 0,             // ƒ
    completedAt: null,
    // 合規
    consentObtained: true,
    photoRetentionUntil: "2026-08-30",
    photosPurged: false,
  },
  {
    orderId: "ORD-20260730-003",
    createdAt: "2026-07-30T14:02:00Z",
    crmId: null,
    customerName: "Mealea Vann",
    telegramUserId: "771204558",
    partnerCode: null,
    serviceType: "Personal Identity",
    amount: 45.0,
    currency: "USD",
    paymentStatus: "Confirmed",
    accountLast5: "22507",
    paymentVerifiedAt: "2026-07-30T13:58:00Z",
    actualCost: 0,
    partnerCommission: 0,
    grossMargin: 45.0,
    productionStatus: "Waiting Assets 等素材",
    assetStatus: "Partial 不齊全",
    missingAssetsNote: "只收到 3 張，還缺 2 張正面照。已於 08-01 提醒一次。",
    revision: 0,
    freeRevisionLimit: 2,
    consultant: "Sok",
    aiModel: "gpt_image",
    identityModel: "參考圖條件式 (Kontext)",
    uploadPhotos: 3,
    promisedDate: "2026-08-02",
    daysLate: 0,
    completedAt: null,
    consentObtained: true,
    photoRetentionUntil: "2026-08-29",
    photosPurged: false,
  },
  {
    orderId: "ORD-20260728-002",
    createdAt: "2026-07-28T10:15:00Z",
    crmId: null,
    customerName: "Sophea Kim",
    telegramUserId: "640228719",
    partnerCode: "PTN-003",
    serviceType: "Personal Identity",
    amount: 28.0,
    currency: "USD",
    paymentStatus: "Confirmed",
    accountLast5: "81340",
    paymentVerifiedAt: "2026-07-28T10:11:00Z",
    actualCost: 5.7,         // ∑（3.2 + 2.5）
    partnerCommission: 4.2,
    grossMargin: 18.1,       // ƒ = 28 − 5.7 − 4.2
    productionStatus: "Review 審核中",
    assetStatus: "Complete 齊全",
    missingAssetsNote: null,
    revision: 2,
    freeRevisionLimit: 2,    // ← 已用滿
    consultant: "Bora",
    aiModel: "flux_kontext",
    identityModel: "IP-Adapter / InstantID",
    uploadPhotos: 4,
    promisedDate: "2026-08-01",
    daysLate: 1,             // ⚠ 已逾期
    completedAt: null,
    consentObtained: true,
    photoRetentionUntil: "2026-08-27",
    photosPurged: false,
  },
];

// ═══════════════════════════════════════════════
// GENERATION RUNS — 每次生成的實測記錄
// ═══════════════════════════════════════════════

export const GENERATION_RUNS = [
  {
    runId: "LS-20260731-004-v1-a1",
    runDate: "2026-07-31T17:05:00Z",
    orderId: "ORD-20260731-004",
    projectNo: "LS-20260731-004",
    version: 1,
    modelUsed: "kling",
    faceLockUsed: "IP-Adapter / InstantID",
    subjectType: "30s 女",
    attempts: 1,
    qcPassed: true,
    faceSimilarity: 0.81,
    brandTextOk: true,
    neededHuman: false,
    customerAccepted: true,
    cost: 12.6,
    elapsedSec: 168,
    failureReason: "無",
  },
  {
    runId: "LS-20260731-004-v2-a1",
    runDate: "2026-08-01T09:30:00Z",
    orderId: "ORD-20260731-004",
    projectNo: "LS-20260731-004",
    version: 2,
    modelUsed: "kling",
    faceLockUsed: "IP-Adapter / InstantID",
    subjectType: "30s 女",
    attempts: 2,
    qcPassed: false,
    faceSimilarity: 0.79,
    brandTextOk: false,
    neededHuman: false,
    customerAccepted: false,
    revisionCount: 1,
    cost: 5.8,
    elapsedSec: 154,
    failureReason: "品牌字錯誤",
    notes:
      "品牌字拼錯（LA SHAUNIE 少一個 N），OCR 檢出後自動重生。這就是可量化檢查才能自動重生的例子。",
  },
  {
    runId: "SK-20260728-002-v1-a1",
    runDate: "2026-07-28T11:02:00Z",
    orderId: "ORD-20260728-002",
    projectNo: "SK-20260728-002",
    version: 1,
    modelUsed: "flux_kontext",
    faceLockUsed: "IP-Adapter / InstantID",
    styleKey: "korean_elevator_flash",
    subjectType: "20s 女",
    attempts: 1,
    qcPassed: true,
    faceSimilarity: 0.74,
    customerAccepted: false,
    cost: 3.2,
    elapsedSec: 62,
    failureReason: "無",
  },
  {
    runId: "SK-20260728-002-v2-a3",
    runDate: "2026-08-01T14:20:00Z",
    orderId: "ORD-20260728-002",
    projectNo: "SK-20260728-002",
    version: 2,
    modelUsed: "flux_kontext",
    faceLockUsed: "IP-Adapter / InstantID",
    styleKey: "korean_elevator_flash",
    subjectType: "20s 女",
    attempts: 3,
    qcPassed: false,
    faceSimilarity: 0.68,        // ⚠ 低於門檻 0.72
    neededHuman: true,           // ← 轉真人
    customerAccepted: false,
    revisionCount: 2,
    cost: 2.5,
    elapsedSec: 58,
    failureReason: "臉不像",
    humanReason:
      "臉部相似度連續低於門檻，且免費修改已用滿，需真人判斷是否改模板或重新取得參考照。",
  },
];

// ═══════════════════════════════════════════════
// PARTNER SUBMISSION LOG — 漏單偵測依據
// ═══════════════════════════════════════════════

export const SUBMISSION_LOG = [
  {
    logId: "PTN-002-20260801-0011",
    submittedAt: "2026-08-01T09:12:00Z",
    partnerCode: "PTN-002",
    telegramUserId: "814255310",
    customerName: "Sreymom Chan",
    botMessageId: "98431",
    payloadSummary: "韓系形象照・交友軟體用・預算 $20-50",
    crmRecord: "CRM-20260801-003",
    syncResult: "Received",
    httpStatus: 200,
  },
  {
    logId: "PTN-002-20260728-0009",
    submittedAt: "2026-07-28T15:30:00Z",
    partnerCode: "PTN-002",
    telegramUserId: "690183422",
    customerName: "Kanha Sok",
    botMessageId: "98388",
    payloadSummary: "婚紗風格照片・預算 $10",
    crmRecord: "CRM-20260731-001",
    syncResult: "Received",
    httpStatus: 200,
  },
  {
    logId: "PTN-002-20260730-0010",
    submittedAt: "2026-07-30T21:48:00Z",
    partnerCode: "PTN-002",
    telegramUserId: "702884166",
    customerName: "Chantrea Meas",
    botMessageId: "98395",
    payloadSummary: "商品情境照・服飾品牌",
    crmRecord: null,              // ← 空白 = 漏單
    syncResult: "Missing",
    httpStatus: 502,
    errorMessage: "Webhook timeout after 30s — 官方 CRM 未建立記錄",
    reconcileNote:
      "這就是漏單。CRM Record 空白，Partners 的 ƒ Sync Status 會顯示「⚠ 漏單 1 筆」。需人工補建 CRM 記錄。",
  },
  {
    logId: "PTN-001-20260731-0014",
    submittedAt: "2026-07-31T11:05:00Z",
    partnerCode: "PTN-001",
    telegramUserId: "552104883",
    customerName: "Vanessa Liu",
    botMessageId: "98402",
    payloadSummary: "睫毛保養液 IG Reels・9:16・TK UGC 風",
    crmRecord: "CRM-20260801-002",
    syncResult: "Received",
    httpStatus: 200,
  },
];

// ═══════════════════════════════════════════════
// 選項值（前台下拉選單用，必須與 Airtable 完全一致）
// ═══════════════════════════════════════════════

export const OPTIONS = {
  crmStatus: [
    "New", "Contacted", "Discussing", "Waiting Customer",
    "Ready to Close", "Closed Won", "Converted", "Closed Lost",
  ],
  paymentStatus: [
    "Awaiting Payment", "Pending Verification", "Confirmed", "Failed", "Refunded",
  ],
  productionStatus: [
    "Waiting Assets 等素材", "Briefing 需求確認", "Generating 生成中",
    "Review 審核中", "Revision 修改中", "Ready to Deliver 待交付", "Completed 已完成",
  ],
  assetStatus: ["Missing 尚未收到", "Partial 不齊全", "Complete 齊全"],
  serviceType: ["Personal Identity", "Brand Campaign"],
  paymentMethod: ["Bank", "ABA", "Wing", "Wise", "Stripe", "Cash", "Other"],
  priority: ["High", "Normal", "Low"],
  source: ["Partner Bot", "Official Bot", "Website", "IG", "Manual"],
  language: ["KH", "EN", "ZH", "Other"],
  budgetRange: ["< $20", "$20-50", "$50-100", "$100-200", "$200-500", "$500+", "未提供"],
};

export default {
  PARTNERS, CUSTOMERS, CRM, ORDERS,
  GENERATION_RUNS, SUBMISSION_LOG, OPTIONS,
};
