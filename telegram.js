// ==============================================================================================
//    AI MR. CHOD BUTLER SYSTEM - TELEGRAM INTEGRATION MODULE (COMPLETED PRODUCTION EDITION - REVISED)
//    * คุณลักษณะพิเศษ: ป้องกัน Race Polling, HTML Auto-Escaper, รองรับ Web App และการค้นหาตารางเวลา *
//    * อัปเดตแก้ไขบัค: ป้องกันสภาวะ Race Condition, รองรับระบบสัมผัส, เพิ่มระบบวิเคราะห์เวลา และปรับปรุงความปลอดภัย *
//    * อัปเกรดโมดูล: ระบบคลังตารางเวลาอัจฉริยะ (Smart Schedule Parser) รองรับหลายเงื่อนไข/หลายวัน และซ้อนทับ *
//    * เพิ่มระบบ: ตารางเวลาความจำถาวร (น้ำบ่อปลา เปิด 07:00 / ปิด 18:00 ถาวร) บนโครงสร้าง Smart Multi-rule *
//    * แก้ไขฉุกเฉิน: ปลดล็อกระบบ Event Handle และ CSS เพื่อให้ปุ่มย่อ/ขยาย ปุ่มบันทึก และช่องกรอกข้อมูล ทำงานได้สมบูรณ์ *
//    * เพิ่มประสิทธิภาพ Mobile: รองรับหน้าจอสัมผัสสมาร์ทโฟนแนวตั้ง (เช่น 1080 x 1920 พิกเซล) ด้วย Responsive CSS *
//    * ฉบับปรับปรุงเพิ่มเติม: แก้ไขข้อขัดแย้งโครงสร้างตารางเวลาหลัก, บัก UI ลากวางเต็มจอ และเพิ่มระบบ Self-recovery เมื่อเน็ตหลุด *
// ==============================================================================================

(function() {
    'use strict';

    let lastUpdateId = 0;
    let lastPanelMessageId = null; // เก็บไอดีข้อความรีโมตคุมเพื่อใช้แก้ไขปุ่มสดแบบซิงค์เรียลไทม์
    let lastStateHash = "";        // ตรวจสอบความคืบหน้าเพื่ออัปเดตปุ่มเฉพาะตอนสถานะเปลี่ยน
    let pollingTimeoutId = null;   // ตัวเก็บ ID ของ setTimeout สำหรับลูปรับคำสั่ง
    let isPollingActive = false;   // แฟล็กป้องกันการทำงานซ้อนของ Long Polling
    let pollingSessionId = 0;      // ตัวนับรอบเซสชันเพื่อป้องกัน Race Condition ของอะซิงโครนัส

    // ---- [1] ตารางความจำถาวรและพจนานุกรมอัจฉริยะ (Synonym & Day Mapping) ----
    const PERMANENT_SCHEDULES = {
        2: {
            name: "น้ำบ่อปลา",
            onTime: "09:00",
            offTime: "18:00",
            reason: "เพื่อรักษาออกซิเจนและระบบนิเวศของบ่อปลาตามคำสั่งระบบชีวภาพถาวรครับเจ้านาย"
        }
    };

    const DAY_MAP = {
        'จันทร์': 1, 'จัน': 1, 'mon': 1, 'monday': 1,
        'อังคาร': 2, 'อัง': 2, 'tue': 2, 'tuesday': 2,
        'พุธ': 3, 'พ': 3, 'wed': 3, 'wednesday': 3,
        'พฤหัส': 4, 'พฤ': 4, 'thu': 4, 'thursday': 4,
        'ศุกร์': 5, 'ศ': 5, 'fri': 5, 'friday': 5,
        'เสาร์': 6, 'ส': 6, 'sat': 6, 'saturday': 6,
        'อาทิตย์': 0, 'อา': 0, 'sun': 0, 'sunday': 0
    };

    const ACTION_MAP = {
        'set': ['ตั้งเวลา', 'ตั้ง', 'เพิ่มเวลา', 'กำหนด', 'set', 'add'],
        'cancel': ['ยกเลิก', 'ลบ', 'ปิดใช้งาน', 'หยุด', 'clear', 'remove', 'delete'],
        'view': ['ดู', 'แสดง', 'รายงาน', 'เช็ค', 'มีอะไร', 'view', 'show', 'list']
    };

    // ฟังก์ชันดึงข้อมูลยืนยันตัวตนจาก LocalStorage
    function getTelegramCredentials() {
        return {
            token: localStorage.getItem("MR_CHOD_TG_BOT_TOKEN") || "",
            chatId: localStorage.getItem("MR_CHOD_TG_CHAT_ID") || ""
        };
    }

    // ฟังก์ชันบันทึกข้อมูลยืนยันตัวตนลง LocalStorage พร้อมดักจับค่าว่างป้องกันข้อผิดพลาด
    function saveTelegramCredentials(token, chatId) {
        const safeToken = (token || "").trim();
        const safeChatId = (chatId || "").trim();
        localStorage.setItem("MR_CHOD_TG_BOT_TOKEN", safeToken);
        localStorage.setItem("MR_CHOD_TG_CHAT_ID", safeChatId);
    }

    // ฟังก์ชันจัดระเบียบอักขระพิเศษสำหรับระบบ HTML ของ Telegram เพื่อป้องกันการประมวลผลล่ม
    function escapeHTML(text) {
        if (typeof text !== "string") return "";
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    // ฟังก์ชันส่งข้อความทั่วไปเข้าแชท (ปรับปรุงเป็นระบบ HTML เพื่อเสถียรภาพสูงสุด)
    async function sendTelegramMessage(text) {
        const { token, chatId } = getTelegramCredentials();
        if (!token || !chatId) return;

        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        try {
            await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: text,
                    parse_mode: "HTML"
                })
            });
        } catch (e) {
            console.error("[Telegram] ส่งข้อความล้มเหลว:", e);
        }
    }

    // ฟังก์ชันบันทึกข้อมูลการตั้งค่า Config ลงในระบบแกนหลักอย่างปลอดภัย
    function saveConfigSafely() {
        const sm = window.MrChodButlerInstance?.settingsManager;
        if (!sm) return;

        if (typeof sm.saveConfig === "function") {
            sm.saveConfig(sm.config);
        } else if (typeof sm.save === "function") {
            sm.save();
        } else if (typeof sm.saveSettings === "function") {
            sm.saveSettings();
        } else {
            localStorage.setItem("MR_CHOD_CONFIG", JSON.stringify(sm.config));
        }
    }

    // ฟังก์ชันตรวจสอบและบังคับใช้ตารางเวลาคงที่ถาวร พร้อมเขียนค่ากลับไปยังตัวแปรเดี่ยวของระบบหลัก (Core System Compatible)
    function enforcePermanentSchedules() {
        const config = window.MrChodButlerInstance?.settingsManager?.config;
        if (!config) return;

        let needsSave = false;
        if (!config.schedules) {
            config.schedules = {};
            needsSave = true;
        }
        if (!config.relays) {
            config.relays = {};
            needsSave = true;
        }

        for (const [relayId, schedInfo] of Object.entries(PERMANENT_SCHEDULES)) {
            const id = parseInt(relayId);

            // บังคับเปลี่ยนชื่อรีเลย์ให้ตรงตามเงื่อนไขหากถูกดัดแปลง
            if (!config.relays[id] || config.relays[id].name !== schedInfo.name) {
                if (!config.relays[id]) config.relays[id] = {};
                config.relays[id].name = schedInfo.name;
                needsSave = true;
            }

            // ตรวจสอบและบังคับเปลี่ยนโครงสร้างตารางเวลาให้เป็น Smart rules
            if (!config.schedules[id] || !Array.isArray(config.schedules[id].rules)) {
                config.schedules[id] = {
                    enabled: true,
                    rules: []
                };
                needsSave = true;
            }

            const sched = config.schedules[id];
            if (!sched.enabled) {
                sched.enabled = true;
                needsSave = true;
            }

            // ตรวจสอบกฎถาวร (เปิด 07:00 / ปิด 18:00 ทุกวัน)
            let hasValidPermRule = false;
            if (sched.rules.length === 1) {
                const r = sched.rules[0];
                if (r.active && r.onTime === schedInfo.onTime && r.offTime === schedInfo.offTime && r.days.length === 7) {
                    hasValidPermRule = true;
                }
            }

            if (!hasValidPermRule) {
                sched.rules = [{
                    days: [0, 1, 2, 3, 4, 5, 6],
                    onTime: schedInfo.onTime,
                    offTime: schedInfo.offTime,
                    active: true
                }];
                needsSave = true;
            }

            // Fallback Sync: คัดลอกค่าเดี่ยวกลับคืนระบบหลักเพื่อให้ IoTController.startScheduler() ทำงานได้อย่างสมบูรณ์
            if (sched.onTime !== schedInfo.onTime || sched.offTime !== schedInfo.offTime) {
                sched.onTime = schedInfo.onTime;
                sched.offTime = schedInfo.offTime;
                needsSave = true;
            }
        }

        if (needsSave) {
            saveConfigSafely();
            if (window.MrChodButlerInstance) {
                window.MrChodButlerInstance.appendLog("⚙️ [System Memory] บังคับรักษาตารางเวลาถาวร (น้ำบ่อปลา: เปิด 07:00 / ปิด 18:00)");
            }
        }
    }

    // ค้นหาตำแหน่งดัชนี Relay ID จากการพิมพ์ค้นหาของผู้ใช้
    function findRelayIdByQuery(query, config) {
        if (!config) return null;
        query = query.trim().toLowerCase();
        if (!query) return null;

        const matchNum = query.match(/(?:รีเลย์|relay)\s*0*([1-6])/i) || query.match(/(?<!\w)0*([1-6])(?!\w)/);
        if (matchNum) {
            return parseInt(matchNum[1]);
        }

        if (config.relays) {
            for (let i = 1; i <= 6; i++) {
                const rName = config.relays[i]?.name?.toLowerCase();
                if (rName && (query.includes(rName) || rName.includes(query))) {
                    return i;
                }
            }
        }
        return null;
    }

    // ---- [2] ฟังก์ชันแยกวิเคราะห์ขั้นสูง (NLP Heuristic Parser) ----
    function parseSmartSchedule(text) {
        text = text.trim();
        const lower = text.toLowerCase();

        // 1. ตรวจจับ Action
        let action = 'view'; // default
        if (ACTION_MAP.cancel.some(k => lower.includes(k))) action = 'cancel';
        else if (ACTION_MAP.set.some(k => lower.includes(k))) action = 'set';

        // 2. ดึงเวลาทั้งหมด (รองรับ HH:MM, HH.MM และช่วงเวลาเช่น 08:00-17:00)
        const timeRegex = /(?<!\d)([01]?\d|2[0-3])[:.]([0-5]\d)(?!\d)/g;
        const matches = [...text.matchAll(timeRegex)];
        let times = matches.map(m => `${m[1].padStart(2,'0')}:${m[2]}`);

        // กรณีพิเศษ: ช่วงเวลาแบบ "08:00-17:00"
        const rangeRegex = /([01]?\d|2[0-3])[:.]([0-5]\d)\s*[-–—]\s*([01]?\d|2[0-3])[:.]([0-5]\d)/;
        const rangeMatch = text.match(rangeRegex);
        if (rangeMatch) {
            times = [
                `${rangeMatch[1].padStart(2,'0')}:${rangeMatch[2]}`,
                `${rangeMatch[3].padStart(2,'0')}:${rangeMatch[4]}`
            ];
        }

        // 3. ตรวจจับวันในสัปดาห์
        let days = [];
        const dayKeys = Object.keys(DAY_MAP).sort((a,b) => b.length - a.length); // เรียงยาวสุดก่อน
        for (const key of dayKeys) {
            if (lower.includes(key)) {
                days.push(DAY_MAP[key]);
            }
        }
        // ถ้าพบ "ทุกวัน" หรือ "daily" หรือไม่พบวันเลย ให้กำหนดเป็นทุกวัน
        if (days.length === 0 || lower.includes('ทุก') || lower.includes('daily') || lower.includes('เสมอ')) {
            days = [0, 1, 2, 3, 4, 5, 6];
        }
        // จัดเรียงและตัดซ้ำ
        days = [...new Set(days)].sort((a,b) => a - b);

        // 4. ดึงชื่ออุปกรณ์ (ดึงข้อความส่วนที่เหลือหลังจากตัดคำสั่งและเวลาทิ้ง)
        let deviceQuery = text;
        // ตัดคำสั่ง
        const allActionKeywords = [...ACTION_MAP.set, ...ACTION_MAP.cancel, ...ACTION_MAP.view];
        for (const kw of allActionKeywords) {
            deviceQuery = deviceQuery.replace(new RegExp(kw, 'gi'), '');
        }
        // ตัดเวลา
        for (const t of times) {
            deviceQuery = deviceQuery.replace(new RegExp(t.replace(':', '[:.]'), 'g'), '');
        }
        // ตัดวันที่
        for (const key of dayKeys) {
            deviceQuery = deviceQuery.replace(new RegExp(key, 'gi'), '');
        }
        // ล้างอักขระพิเศษ
        deviceQuery = deviceQuery.replace(/[^a-zA-Z0-9ก-๙\s]/g, ' ').trim();

        return {
            action: action,
            deviceQuery: deviceQuery,
            times: times,        // array ของเวลา (ถ้า 1 ตัว แปลว่า เปิด หรือ ปิด อย่างเดียว)
            days: days
        };
    }

    // ---- [3] ฟังก์ชันแปลงเป็นข้อความสวยงาม ----
    function formatSmartRule(rule) {
        const dayNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
        let dayStr = '';
        if (rule.days.length === 7) dayStr = 'ทุกวัน';
        else if (rule.days.length === 0) dayStr = 'ไม่ระบุวัน';
        else dayStr = rule.days.map(d => dayNames[d]).join(', ');
        
        let timeStr = '';
        if (rule.onTime && rule.offTime) timeStr = `🟢 ${rule.onTime} - 🔴 ${rule.offTime}`;
        else if (rule.onTime) timeStr = `🟢 เปิด ${rule.onTime}`;
        else if (rule.offTime) timeStr = `🔴 ปิด ${rule.offTime}`;
        else timeStr = '⏳ ไม่ระบุเวลา';

        return `${dayStr} | ${timeStr} ${rule.active ? '✅' : '⛔'}`;
    }

    // ---- [4] ตรวจจับความขัดแย้งของเวลา (Overlap Check) ----
    function isOverlapping(rules, newRule) {
        if (!newRule.onTime || !newRule.offTime) return false;
        const newStart = newRule.onTime;
        const newEnd = newRule.offTime;
        
        for (const rule of rules) {
            if (!rule.active) continue;
            if (!rule.onTime || !rule.offTime) continue;
            // ถ้ามีวันซ้อนกัน
            const commonDays = rule.days.filter(d => newRule.days.includes(d));
            if (commonDays.length === 0) continue;
            
            // ตรวจสอบช่วงเวลาซ้อน (สมมติว่าเวลาไม่ข้ามวัน)
            if (newStart < rule.offTime && newEnd > rule.onTime) {
                return true;
            }
        }
        return false;
    }

    // ---- [5] ฟังก์ชันหลัก SMART HANDLER (เชื่อมต่อและซิงค์ข้อมูลกับระบบแกนหลัก) ----
    async function handleScheduleCommand(text) {
        const config = window.MrChodButlerInstance?.settingsManager?.config;
        if (!config) return "❌ ไม่พบการตั้งค่าระบบแกนหลักครับเจ้านาย";

        // 1. ใช้ Smart Parser
        const parsed = parseSmartSchedule(text);
        if (!parsed.deviceQuery) {
            return "❌ ไม่พบชื่อหรือหมายเลขอุปกรณ์ที่ต้องการจัดการครับ กรุณาระบุให้ชัดเจน (เช่น 'ตั้งเวลา ไฟหน้าคอม 08:00-17:00')";
        }

        // 2. หา Relay ID จากชื่อที่กรองแล้ว
        const relayId = findRelayIdByQuery(parsed.deviceQuery, config);
        if (!relayId) {
            return `❌ ไม่พบอุปกรณ์ "${escapeHTML(parsed.deviceQuery)}" ในระบบครับ กรุณาตรวจสอบชื่อหรือเลขรีเลย์ (1-6)`;
        }

        // 3. ป้องกันตารางถาวร (น้ำบ่อปลา)
        if (PERMANENT_SCHEDULES[relayId]) {
            const perm = PERMANENT_SCHEDULES[relayId];
            return `⚠️ <b>${escapeHTML(perm.name)}</b> เป็นระบบตารางถาวร (เปิด ${perm.onTime} / ปิด ${perm.offTime}) ไม่สามารถแก้ไขหรือลบตารางได้ครับ`;
        }

        // 4. เตรียมโครงสร้างข้อมูลแบบหลายกฎ (ถ้ายังเป็นแบบเก่า ให้แปลงเป็น Ruleset อัตโนมัติ)
        if (!config.schedules) config.schedules = {};
        if (!config.schedules[relayId] || !Array.isArray(config.schedules[relayId].rules)) {
            const old = config.schedules[relayId] || {};
            config.schedules[relayId] = {
                enabled: old.enabled !== undefined ? old.enabled : true,
                rules: []
            };
            if (old.onTime || old.offTime) {
                config.schedules[relayId].rules.push({
                    days: [0,1,2,3,4,5,6],
                    onTime: old.onTime || null,
                    offTime: old.offTime || null,
                    active: old.enabled !== false
                });
            }
        }

        const schedule = config.schedules[relayId];
        const relayName = config.relays?.[relayId]?.name || `รีเลย์ ${relayId}`;

        // 5. จัดการตาม Action
        if (parsed.action === 'cancel') {
            // ยกเลิกทุกกฎของอุปกรณ์นี้
            schedule.rules = [];
            schedule.enabled = false;
            // ล้างค่า Fallback
            schedule.onTime = "";
            schedule.offTime = "";
            saveConfigSafely();
            return `✅ ยกเลิกการตั้งเวลาทั้งหมดของ <b>${escapeHTML(relayName)}</b> เรียบร้อยแล้วครับ`;
        }

        if (parsed.action === 'view') {
            // แสดงรายละเอียดกฎทั้งหมด
            if (schedule.rules.length === 0 || !schedule.enabled) {
                return `📋 <b>${escapeHTML(relayName)}</b>: ไม่มีกฎการตั้งเวลาที่ใช้งานอยู่ครับ`;
            }
            let msg = `📋 <b>${escapeHTML(relayName)}</b> มีกฎทั้งหมด ${schedule.rules.length} รายการ:\n`;
            schedule.rules.forEach((rule, idx) => {
                msg += `\n${idx+1}. ${escapeHTML(formatSmartRule(rule))}`;
            });
            return msg;
        }

        // 6. Action = 'set' : สร้างกฎใหม่
        if (parsed.times.length === 0) {
            return "❌ ไม่พบเวลาที่ต้องการตั้งครับ (เช่น เปิด 08:00 หรือ 08:00-17:00)";
        }

        let onTime = null;
        let offTime = null;

        // วิเคราะห์ว่าเวลาที่ได้คือ เปิด หรือ ปิด
        if (parsed.times.length === 1) {
            // ถ้ามีแค่เวลาเดียว ให้ดูบริบทว่ามีคำว่า "เปิด" หรือ "ปิด" ใกล้เคียงไหม
            const idxOn = text.toLowerCase().indexOf('เปิด');
            const idxOff = text.toLowerCase().indexOf('ปิด');
            if (idxOn !== -1 && (idxOff === -1 || idxOn < idxOff)) {
                onTime = parsed.times[0];
            } else if (idxOff !== -1 && (idxOn === -1 || idxOff < idxOn)) {
                offTime = parsed.times[0];
            } else {
                // ถ้าไม่แน่ใจ ให้ถือว่าเป็นเวลาเปิด
                onTime = parsed.times[0];
            }
        } else if (parsed.times.length >= 2) {
            onTime = parsed.times[0];
            offTime = parsed.times[1];
            // ปรับลำดับถ้าผู้ใช้พิมพ์ ปิดก่อนเปิด
            const idxOn = text.toLowerCase().indexOf('เปิด');
            const idxOff = text.toLowerCase().indexOf('ปิด');
            if (idxOff !== -1 && idxOn !== -1 && idxOff < idxOn) {
                [onTime, offTime] = [offTime, onTime];
            }
        }

        if (!onTime && !offTime) {
            return "❌ รูปแบบเวลาไม่ถูกต้อง กรุณาใช้ HH:MM เช่น 08:00 หรือ 08:00-17:00 ครับ";
        }

        const newRule = {
            days: parsed.days,
            onTime: onTime,
            offTime: offTime,
            active: true
        };

        // 7. ตรวจสอบความขัดแย้งกับกฎเดิม
        if (schedule.rules.length > 0 && isOverlapping(schedule.rules, newRule)) {
            return `⚠️ พบว่ากฎนี้ซ้อนทับกับกฎเดิมของ <b>${escapeHTML(relayName)}</b>!\n` +
                   `📌 กฎใหม่: ${escapeHTML(formatSmartRule(newRule))}\n` +
                   `💡 ระบบจะ <b>เพิ่มกฎใหม่</b> เข้าไป หากต้องการลบกฎเดิมทั้งหมดให้พิมพ์ "ยกเลิกตั้งเวลา ${escapeHTML(relayName)}" ก่อนนะครับ`;
        }

        // 8. บันทึกกฎใหม่
        schedule.rules.push(newRule);
        schedule.enabled = true;

        // Fallback Sync: เก็บค่าลงตัวแปรหลักเพื่อคงขีดความสามารถการรันจากตัวตรวจสอบหลัก (Core Engine Compatibility)
        schedule.onTime = onTime || "";
        schedule.offTime = offTime || "";

        saveConfigSafely();

        const dayNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
        let dayStr = newRule.days.length === 7 ? 'ทุกวัน' : newRule.days.map(d => dayNames[d]).join(', ');
        
        return `✅ ตั้งเวลาสำเร็จสำหรับ <b>${escapeHTML(relayName)}</b>:\n` +
               `   📅 ${escapeHTML(dayStr)}\n` +
               `   🕒 ${onTime ? '🟢 เปิด ' + onTime : ''} ${offTime ? '🔴 ปิด ' + offTime : ''}\n` +
               `   📊 ขณะนี้มีกฎทั้งหมด ${schedule.rules.length} รายการ (ใช้คำสั่ง "ดูตาราง ${escapeHTML(relayName)}" เพื่อเช็คทั้งหมด)`;
    }

    // ---- [6] แก้ไขฟังก์ชัน getScheduleReport ให้โชว์ข้อมูลหลายกฎแบบ Smart ----
    function getScheduleReport() {
        enforcePermanentSchedules();
        const config = window.MrChodButlerInstance?.settingsManager?.config;
        if (!config || !config.schedules) {
            return "❌ ไม่พบข้อมูลตารางตั้งเวลาของระบบในขณะนี้ครับเจ้านาย";
        }

        let report = "⏱️ <b>รายงานตารางเวลาทำงานอัตโนมัติ (Smart)</b> ⚡\n\n";
        let hasActive = false;
        const dayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

        for (let i = 1; i <= 6; i++) {
            const relay = config.relays?.[i];
            const sched = config.schedules?.[i];
            if (!sched || !sched.enabled || sched.rules?.length === 0) continue;
            
            hasActive = true;
            const isPerm = !!PERMANENT_SCHEDULES[i];
            const relayName = escapeHTML(relay ? relay.name : `รีเลย์ ${i}`);
            report += `• <b>${relayName}</b> (R${i}) ${isPerm ? '🛡️' : ''}:\n`;
            
            sched.rules.forEach((rule, idx) => {
                if (!rule.active) return;
                let daysStr = rule.days.length === 7 ? 'ทุกวัน' : rule.days.map(d => dayNames[d]).join('');
                let timeStr = '';
                if (rule.onTime && rule.offTime) timeStr = `${rule.onTime}–${rule.offTime}`;
                else if (rule.onTime) timeStr = `เปิด ${rule.onTime}`;
                else if (rule.offTime) timeStr = `ปิด ${rule.offTime}`;
                report += `  └─ [${idx+1}] ${escapeHTML(daysStr)} ${escapeHTML(timeStr)}\n`;
            });
        }

        if (!hasActive) {
            return "⏱️ <b>ตารางเวลาทำงานอัตโนมัติ</b>\nขณะนี้ <b>ไม่มี</b> อุปกรณ์ใดเปิดใช้งานระบบทำงานอัตโนมัติครับเจ้านาย";
        }
        return report;
    }

    // ฟังก์ชันสร้างหน้าตาปุ่ม Inline Keyboard
    function buildInlineKeyboard() {
        enforcePermanentSchedules();

        const states = window.MrChodButlerInstance?.iotController?.relayStates || {};
        const config = window.MrChodButlerInstance?.settingsManager?.config || null;

        const getRelayLabel = (id, defaultName) => {
            const name = (config?.relays?.[id]) ? config.relays[id].name : defaultName;
            const activeSymbol = states[id] ? "🟢" : "🔴";
            const stateText = states[id] ? "ON" : "OFF";
            const isPerm = !!PERMANENT_SCHEDULES[id];
            return `${activeSymbol} R${id}: ${name} [${stateText}]${isPerm ? " 🛡️" : ""}`;
        };

        const currentUrl = window.location.href;
        const isHttps = window.location.protocol === "https:";
        if (!isHttps) {
            console.warn("[Telegram WebApp] เนื่องจากหน้าเว็บปัจจุบันไม่ได้ใช้โปรโตคอล HTTPS ระบบจะแปลงลิงก์สั่งงานปุ่ม Web App ให้เป็นลิงก์เบราว์เซอร์ปกติ");
        }

        const webAppButton = isHttps 
            ? { text: "📱 เปิดหน้าสั่งงานเต็มจอ (Web App)", web_app: { url: currentUrl } }
            : { text: "🌐 เปิดหน้าเว็บ (Browser)", url: currentUrl };

        return [
            [
                { text: getRelayLabel(1, "ไฟหน้าคอม"), callback_data: "toggle_1" },
                { text: getRelayLabel(2, "น้ำบ่อปลา"), callback_data: "toggle_2" }
            ],
            [
                { text: getRelayLabel(3, "จะสวดมนต์"), callback_data: "toggle_3" },
                { text: getRelayLabel(4, "อุปกรณ์เสริม"), callback_data: "toggle_4" }
            ],
            [
                { text: getRelayLabel(5, "ระบบไฟสวน"), callback_data: "toggle_5" },
                { text: getRelayLabel(6, "เครื่องกรองน้ำ"), callback_data: "toggle_6" }
            ],
            [
                { text: "☕ Caffeine (คึกคัก)", callback_data: "drug_caffeine" },
                { text: "💊 Sedative (สงบ)", callback_data: "drug_sedative" }
            ],
            [
                { text: "🌀 Psychedelic (หลอน)", callback_data: "drug_psychedelic" },
                { text: "🔄 Reset สารเคมี", callback_data: "drug_reset" }
            ],
            [
                webAppButton
            ],
            [
                { text: "📊 รายงานสถานะเครื่อง", callback_data: "get_status" },
                { text: "📱 ส่งรีโมตตัวใหม่", callback_data: "resend_panel" }
            ]
        ];
    }

    // ฟังก์ชันส่งรีโมตชุดคำสั่งหลักแบบเรืองแสง (Inline Dashboard Panel)
    async function sendControlPanel() {
        const { token, chatId } = getTelegramCredentials();
        if (!token || !chatId) return;

        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const payload = {
            chat_id: chatId,
            text: "🤖 <b>MR. CHOD COGNITIVE CONTROLLER</b> ⚡\nยินดีต้อนรับสู่สะพานบัญชาการสำรองของระบบชีวภาพและ IoT บรรจุระบบตรวจจับประจุ สั่งงานได้ผ่านปุ่มตรงล่างนี้ครับเจ้านาย:",
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: buildInlineKeyboard()
            }
        };

        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                console.error("[Telegram] บอทไม่สามารถส่งแผงควบคุมได้:", res.status, errData.description);
                return;
            }
            const data = await res.json();
            if (data.ok) {
                lastPanelMessageId = data.result.message_id;
            }
        } catch (e) {
            console.error("[Telegram] ส่งแผงรีโมตล้มเหลว:", e);
        }
    }

    // แก้ไขสถานะปุ่ม Inline คีย์บอร์ดบนโทรเลขเดิมเรียลไทม์โดยไม่มีข้อความรบกวนเพิ่มเติม (Smooth Updates)
    async function updateControlPanel() {
        const { token, chatId } = getTelegramCredentials();
        if (!token || !chatId || !lastPanelMessageId) return;

        const url = `https://api.telegram.org/bot${token}/editMessageReplyMarkup`;
        const payload = {
            chat_id: chatId,
            message_id: lastPanelMessageId,
            reply_markup: {
                inline_keyboard: buildInlineKeyboard()
            }
        };

        try {
            await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        } catch (e) {
            // ละเว้นกรณีที่สถานะไม่มีการเปลี่ยนเพื่อไม่ให้เกิด Error
        }
    }

    // รายงานข้อมูลสารสื่อประสาท ChodBrain และบอร์ด IoT ปัจจุบัน
    async function sendStatusReport() {
        const states = window.MrChodButlerInstance?.iotController?.relayStates || {};
        const config = window.MrChodButlerInstance?.settingsManager?.config || null;
        
        let relayStatusText = "";
        for (let i = 1; i <= 6; i++) {
            const name = (config?.relays?.[i]) ? config.relays[i].name : `รีเลย์ ${i}`;
            const active = states[i] ? "🟢 ON" : "🔴 OFF";
            const isPerm = !!PERMANENT_SCHEDULES[i];
            relayStatusText += `• ${escapeHTML(name)}${isPerm ? " 🛡️" : ""}: <b>${active}</b>\n`;
        }

        let brainText = "• ไม่พบข้อมูลเชื่อมต่อ ChodBrain 3D Map";
        if (window.ChodBrain && window.ChodBrain.neurotransmitters) {
            const nt = window.ChodBrain.neurotransmitters;
            brainText = `• โดพามีน (DOP): <b>${(nt.dopamine || 0).toFixed(3)}</b>\n` +
                        `• เซโรโทนิน (5-HT): <b>${(nt.serotonin || 0).toFixed(3)}</b>\n` +
                        `• อะดรีนาลีน (EPI): <b>${(nt.adrenaline || 0).toFixed(3)}</b>\n` +
                        `• ดัชนีโมเลกุลรบกวน (Frustration): <b>${(window.ChodBrain.frustrationScore || 0).toFixed(3)}</b>`;
        }

        const report = `📊 <b>รายงานดัชนีตรวจวัดประสาทและ IoT</b> ⚡\n\n` +
                       `🔌 <b>สวิตช์สถานะอุปกรณ์รีเลย์:</b>\n${relayStatusText}\n` +
                       `🧠 <b>โครงข่ายชีวภาพ ChodBrain:</b>\n${brainText}\n\n` +
                       `📅 ซิงค์เมื่อเวลา: ${new Date().toLocaleTimeString()}`;

        await sendTelegramMessage(report);
    }

    // จัดการข้อสั่งการเมื่อผู้ใช้พิมพ์หรือกดปุ่มบนแชท Telegram
    async function handleTelegramUpdate(update) {
        const { token, chatId } = getTelegramCredentials();
        if (!token || !chatId) return;

        // ยืนยันตัวตน Chat ID ผู้ส่งคำสั่งเพื่อสิทธิ์ความปลอดภัยสูงสุด
        const incomingChatId = String(update.message?.chat?.id || update.callback_query?.message?.chat?.id || "");
        if (incomingChatId !== String(chatId)) {
            console.warn("[Telegram Security Warning] มีการพยายามควบคุมระบบจากภายนอกโดยไม่ได้รับอนุญาต:", incomingChatId);
            return;
        }

        // 1. ตรวจจับการกดปุ่ม Callback (Inline Keyboard)
        if (update.callback_query) {
            const query = update.callback_query;
            const callbackData = query.data;
            const queryId = query.id;

            try {
                await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ callback_query_id: queryId, text: "คุณโชดรับคำสั่งแล้วครับ" })
                });
            } catch (err) {
                console.error("[Telegram] answerCallbackQuery ล้มเหลว:", err);
            }

            if (callbackData.startsWith("toggle_")) {
                const id = parseInt(callbackData.split("_")[1]);
                if (window.MrChodButlerInstance?.iotController) {
                    const currentState = window.MrChodButlerInstance.iotController.relayStates[id];
                    await window.MrChodButlerInstance.iotController.executeCommand(id, !currentState);
                    window.MrChodButlerInstance.appendLog(`SYS: [Telegram Bot] สลับสถานะสวิตช์ Relay ${id}`);
                }
            } else if (callbackData.startsWith("drug_")) {
                const type = callbackData.split("_")[1];
                const drugFn = window.setDrug || (typeof setDrug === "function" ? setDrug : null);
                if (drugFn) {
                    drugFn(type === "reset" ? null : type);
                    if (window.MrChodButlerInstance) {
                        window.MrChodButlerInstance.appendLog(`SYS: [Telegram Bot] ปล่อยสารเคมีเสมือน: ${type.toUpperCase()}`);
                    }
                }
            } else if (callbackData === "get_status") {
                await sendStatusReport();
            } else if (callbackData === "resend_panel") {
                await sendControlPanel();
            }
            return;
        }

        // 2. ตรวจจับการส่งข้อความพิมพ์ปกติ
        if (update.message && update.message.text) {
            const rawText = update.message.text.trim();
            const lowerText = rawText.toLowerCase();

            if (lowerText.startsWith("/")) {
                if (lowerText === "/start" || lowerText === "/menu" || lowerText === "/help") {
                    await sendControlPanel();
                }
                return;
            }

            // ตรวจจับคำสั่งเกี่ยวกับระบบตารางเวลา
            const isScheduleRelated = lowerText.includes("ตั้งเวลา") || lowerText.includes("ตั่งเวลา") || lowerText.includes("ตารางเวลา") || lowerText.includes("สเกดูล");
            
            if (isScheduleRelated) {
                const isCancel = /(ยกเลิก|ลบ|ปิดระบบ|ปิดตาราง|ปิดสเกดูล|ปิดใช้งาน)/.test(lowerText);
                const hasTime = /(?<!\d)(?:[01]?\d|2[0-3])[:.][0-5]\d(?!\d)/.test(lowerText);

                if (isCancel || hasTime) {
                    const scheduleResponse = await handleScheduleCommand(rawText);
                    await sendTelegramMessage(scheduleResponse);

                    if (window.MrChodButlerInstance) {
                        window.MrChodButlerInstance.appendLog(`> [Telegram Bot CMD] จัดการเวลา: ${rawText}`);
                        window.MrChodButlerInstance.appendLog(`AI : ${scheduleResponse.replace(/<[^>]*>/g, "")}`);
                    }
                    return;
                } else {
                    const schedReport = getScheduleReport();
                    await sendTelegramMessage(schedReport);
                    
                    if (window.MrChodButlerInstance) {
                        window.MrChodButlerInstance.appendLog(`> [Telegram Bot CMD] ตรวจสอบตารางเวลา`);
                        window.MrChodButlerInstance.appendLog(`AI : ดำเนินการสรุปตารางเวลาส่งกลับโทรเลขเรียบร้อยแล้วครับ`);
                    }
                    return;
                }
            }

            // ข้อความประมวลผลทั่วไป
            if (window.MrChodButlerInstance?.intentParser) {
                window.MrChodButlerInstance.appendLog(`> [Telegram Bot CMD] ${rawText}`);
                
                const replyResult = window.MrChodButlerInstance.intentParser.parseIntent(rawText);
                
                window.MrChodButlerInstance.appendLog(`AI : ${replyResult}`);
                window.MrChodButlerInstance.speechEngine?.speak?.(replyResult);

                await sendTelegramMessage(`🤖 <b>AI :</b> ${escapeHTML(replyResult)}`);
            }
        }
    }

    // ลูปหลัก Long Polling (ปรับปรุงระบบกู้คืนตัวเองอัตโนมัติเมื่อเกิดการสูญเสียเครือข่าย)
    async function startPollingTelegram() {
        const { token, chatId } = getTelegramCredentials();
        if (!token || !chatId) {
            isPollingActive = false;
            return;
        }

        isPollingActive = true;
        const currentSession = ++pollingSessionId;

        const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;
        try {
            const res = await fetch(url);
            
            if (!isPollingActive || currentSession !== pollingSessionId) return;

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                console.error("[Telegram] API Error:", res.status, errData.description);
                
                if (res.status === 401 || res.status === 403) {
                    console.warn("[Telegram] การตรวจสอบสิทธิ์ล้มเหลว ระงับการทำงาน");
                    stopPollingTelegram();
                    return;
                }
                
                pollingTimeoutId = setTimeout(startPollingTelegram, 5000);
                return;
            }

            const data = await res.json();
            if (data.ok && data.result.length > 0) {
                for (const update of data.result) {
                    lastUpdateId = update.update_id;
                    await handleTelegramUpdate(update);
                }
            }
        } catch (e) {
            console.error("[Telegram] เกิดข้อผิดพลาดในลูปรับคำสั่ง:", e);
            
            // เพิ่มระบบ Self-recovery: หากเกิด Network Error รอกู้คืน 5 วินาทีแล้วเริ่มรันใหม่แทนการหยุดเงียบ
            if (isPollingActive && currentSession === pollingSessionId) {
                pollingTimeoutId = setTimeout(startPollingTelegram, 5000);
            }
            return;
        }
        
        if (isPollingActive && currentSession === pollingSessionId) {
            pollingTimeoutId = setTimeout(startPollingTelegram, 1000);
        }
    }

    // หยุดลูป Polling เดิม
    function stopPollingTelegram() {
        isPollingActive = false;
        if (pollingTimeoutId) {
            clearTimeout(pollingTimeoutId);
            pollingTimeoutId = null;
        }
    }

    // ฟังก์ชันซิงค์ปุ่มเรืองแสงบนโทรเลขแบบเรียลไทม์
    function checkRealtimeStateSync() {
        if (!window.MrChodButlerInstance?.iotController) return;
        const states = window.MrChodButlerInstance.iotController.relayStates;
        const currentHash = Object.entries(states).map(([id, val]) => `${id}:${val}`).join(",");
        
        if (currentHash !== lastStateHash) {
            lastStateHash = currentHash;
            updateControlPanel();
        }
    }

    // ฟังก์ชันสร้างและฝังหน้าต่างสำหรับตั้งค่าและล็อกอินหน้าเว็บ
    function injectConfigurationUI() {
        if (document.getElementById("tg-config-panel")) return;

        const style = document.createElement("style");
        style.textContent = `
            #tg-config-panel {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #18181b;
                border: 1px solid #3f3f46;
                border-radius: 8px;
                padding: 12px;
                width: 270px;
                color: #e4e4e7;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 13px;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
                z-index: 10000030;
                transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), bottom 0.3s, left 0.3s, right 0.3s, width 0.3s;
                box-sizing: border-box;
                cursor: grab;
                user-select: none;
                -webkit-user-select: none;
            }
            #tg-config-panel:active {
                cursor: grabbing;
            }
            #tg-config-panel.minimized {
                transform: translateY(calc(100% - 35px));
            }
            
            /* แก้ไข CSS UI Specificity: เพิ่มกฎ !important เพื่อให้สามารถปรับขยายหน้าจอได้สมบูรณ์แม้อยู่หลังการ Drag */
            #tg-config-panel.fullscreen {
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                border-radius: 0 !important;
                border: none !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: center !important;
                align-items: center !important;
                background: rgba(24, 24, 27, 0.98) !important;
                backdrop-filter: blur(8px) !important;
                cursor: default !important;
            }
            #tg-config-panel h4 {
                margin: 0 0 8px 0;
                font-size: 14px;
                color: #f4f4f5;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            #tg-config-panel .tg-controls-wrapper {
                display: flex;
                gap: 8px;
                font-size: 11px;
            }
            #tg-config-panel .tg-btn-link {
                cursor: pointer;
                padding: 2px 6px;
                border-radius: 4px;
                background: #27272a;
                border: 1px solid #3f3f46;
                transition: background 0.2s;
                user-select: none;
                -webkit-user-select: none;
            }
            #tg-config-panel .tg-btn-link:hover {
                background: #3f3f46;
                color: #fff;
            }
            #tg-config-panel #tg-panel-body {
                transition: opacity 0.2s;
            }
            #tg-config-panel.minimized #tg-panel-body {
                opacity: 0;
                pointer-events: none;
            }
            #tg-config-panel.fullscreen #tg-panel-body {
                width: 100% !important;
                max-width: 420px !important;
                background: #202023 !important;
                padding: 24px !important;
                border-radius: 8px !important;
                border: 1px solid #3f3f46 !important;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.7) !important;
            }
            #tg-config-panel label {
                display: block;
                margin-top: 8px;
                color: #a1a1aa;
                font-size: 11px;
                user-select: none;
                -webkit-user-select: none;
            }
            #tg-config-panel input {
                width: 100%;
                box-sizing: border-box;
                background: #27272a;
                border: 1px solid #52525b;
                color: #fff;
                padding: 6px 10px;
                border-radius: 4px;
                margin-top: 4px;
                font-size: 12px;
                cursor: text;
                user-select: text !important;
                -webkit-user-select: text !important;
            }
            #tg-config-panel button {
                width: 100%;
                background: #2563eb;
                color: #fff;
                border: none;
                padding: 8px;
                border-radius: 4px;
                margin-top: 12px;
                cursor: pointer;
                font-weight: bold;
                transition: background 0.2s;
                user-select: none;
                -webkit-user-select: none;
            }
            #tg-config-panel button:hover {
                background: #1d4ed8;
            }

            @media (max-width: 540px) {
                #tg-config-panel:not(.fullscreen) {
                    bottom: 16px;
                    right: 16px;
                    left: 16px;
                    width: calc(100% - 32px) !important;
                    max-width: none;
                    padding: 16px;
                }
                #tg-config-panel.minimized {
                    transform: translateY(calc(100% - 40px));
                }
                #tg-config-panel h4 {
                    font-size: 15px;
                    margin-bottom: 12px;
                }
                #tg-config-panel .tg-btn-link {
                    padding: 4px 8px;
                    font-size: 12px;
                }
                #tg-config-panel .tg-controls-wrapper {
                    gap: 12px;
                }
                #tg-config-panel label {
                    font-size: 12px;
                    margin-top: 12px;
                }
                #tg-config-panel input {
                    padding: 10px 12px;
                    font-size: 14px;
                    margin-top: 6px;
                }
                #tg-config-panel button {
                    padding: 12px;
                    font-size: 14px;
                    margin-top: 16px;
                }
                #tg-config-panel.fullscreen #tg-panel-body {
                    width: calc(100% - 32px);
                    margin: 16px;
                    padding: 20px;
                }
            }
        `;
        document.head.appendChild(style);

        const container = document.createElement("div");
        container.id = "tg-config-panel";
        
        const credentials = getTelegramCredentials();

        // โครงสร้างเมนู UI ควบคุมหลัก
        container.innerHTML = `
            <h4>
                <span>🤖 Telegram Config</span>
                <div class="tg-controls-wrapper">
                    <span id="tg-minimize-btn" class="tg-btn-link" style="color:#3b82f6;">ย่อ/ขยาย</span>
                    <span id="tg-fullscreen-btn" class="tg-btn-link" style="color:#10b981;">เต็มจอ</span>
                </div>
            </h4>
            <div id="tg-panel-body">
                <label>Telegram Bot Token:</label>
                <input type="password" id="tg-token-input" placeholder="กรอก Bot Token...">
                
                <label>Telegram Chat ID:</label>
                <input type="text" id="tg-chat-input" placeholder="กรอก Chat ID...">
                
                <button id="tg-save-btn">บันทึกและเชื่อมต่อ</button>
            </div>
        `;

        document.body.appendChild(container);

        document.getElementById("tg-token-input").value = credentials.token;
        document.getElementById("tg-chat-input").value = credentials.chatId;

        // ==========================================================
        //  ระบบลากวาง (Drag & Drop) เมาส์ซ้าย & ระบบทัชสกรีนบนมือถือ
        // ==========================================================
        let isDragging = false;
        let startX, startY;

        container.addEventListener("mousedown", (e) => {
            if (e.button !== 0) return;

            const target = e.target;
            const tag = target.tagName;
            if (
                tag === "INPUT" || 
                tag === "BUTTON" || 
                tag === "A" || 
                target.classList.contains("tg-btn-link") ||
                target.closest(".tg-controls-wrapper")
            ) {
                return;
            }

            if (container.classList.contains("fullscreen")) return;

            isDragging = true;
            const rect = container.getBoundingClientRect();
            startX = e.clientX - rect.left;
            startY = e.clientY - rect.top;

            container.style.bottom = "auto";
            container.style.right = "auto";
            container.style.left = `${rect.left}px`;
            container.style.top = `${rect.top}px`;

            e.preventDefault();
        });

        document.addEventListener("mousemove", (e) => {
            if (!isDragging) return;

            let newLeft = e.clientX - startX;
            let newTop = e.clientY - startY;

            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const panelWidth = container.offsetWidth;
            const panelHeight = container.offsetHeight;

            if (newLeft < 0) newLeft = 0;
            if (newTop < 0) newTop = 0;
            if (newLeft + panelWidth > viewportWidth) newLeft = viewportWidth - panelWidth;
            if (newTop + panelHeight > viewportHeight) newTop = viewportHeight - panelHeight;

            container.style.left = `${newLeft}px`;
            container.style.top = `${newTop}px`;
        });

        document.addEventListener("mouseup", () => {
            isDragging = false;
        });

        container.addEventListener("touchstart", (e) => {
            const target = e.target;
            const tag = target.tagName;
            if (
                tag === "INPUT" || 
                tag === "BUTTON" || 
                tag === "A" || 
                target.classList.contains("tg-btn-link") ||
                target.closest(".tg-controls-wrapper")
            ) {
                return;
            }

            if (container.classList.contains("fullscreen")) return;

            isDragging = true;
            const touch = e.touches[0];
            const rect = container.getBoundingClientRect();
            startX = touch.clientX - rect.left;
            startY = touch.clientY - rect.top;

            container.style.bottom = "auto";
            container.style.right = "auto";
            container.style.left = `${rect.left}px`;
            container.style.top = `${rect.top}px`;
        }, { passive: true });

        document.addEventListener("touchmove", (e) => {
            if (!isDragging) return;
            const touch = e.touches[0];
            
            let newLeft = touch.clientX - startX;
            let newTop = touch.clientY - startY;

            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const panelWidth = container.offsetWidth;
            const panelHeight = container.offsetHeight;

            if (newLeft < 0) newLeft = 0;
            if (newTop < 0) newTop = 0;
            if (newLeft + panelWidth > viewportWidth) newLeft = viewportWidth - panelWidth;
            if (newTop + panelHeight > viewportHeight) newTop = viewportHeight - panelHeight;

            container.style.left = `${newLeft}px`;
            container.style.top = `${newTop}px`;
            
            if (e.cancelable) {
                e.preventDefault();
            }
        }, { passive: false });

        document.addEventListener("touchend", () => {
            isDragging = false;
        });

        const minimizeBtn = document.getElementById("tg-minimize-btn");
        const fullscreenBtn = document.getElementById("tg-fullscreen-btn");

        minimizeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (container.classList.contains("fullscreen")) {
                container.classList.remove("fullscreen");
            }
            container.classList.toggle("minimized");
        });

        fullscreenBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (container.classList.contains("minimized")) {
                container.classList.remove("minimized");
            }
            container.classList.toggle("fullscreen");
        });

        const saveBtn = document.getElementById("tg-save-btn");
        saveBtn.addEventListener("click", async () => {
            const tokenVal = document.getElementById("tg-token-input").value;
            const chatVal = document.getElementById("tg-chat-input").value;

            saveTelegramCredentials(tokenVal, chatVal);
            
            if (window.MrChodButlerInstance) {
                window.MrChodButlerInstance.appendLog("🤖 [Telegram] ทำการบันทึกการตั้งค่า Token และ Chat ID ใหม่เรียบร้อย!");
            }

            stopPollingTelegram();
            lastPanelMessageId = null;
            lastStateHash = "";

            if (tokenVal && chatVal) {
                await sendControlPanel();
                startPollingTelegram();
                
                container.classList.remove("fullscreen");
                container.classList.add("minimized");
            }
        });
    }

    // ตรวจสอบและประสานการทำงานเข้ากับอ็อบเจกต์หลักของระบบ
    function bootstrapTelegramLink() {
        if (!window.MrChodButlerInstance) {
            setTimeout(bootstrapTelegramLink, 100);
            return;
        }

        injectConfigurationUI();
        enforcePermanentSchedules();

        const creds = getTelegramCredentials();
        if (creds.token && creds.chatId) {
            sendControlPanel();
            startPollingTelegram();
        } else {
            window.MrChodButlerInstance.appendLog("⚠️ [Telegram Extension] กรุณาระบุ Token และ Chat ID ในแผงควบคุมมุมล่างขวาเพื่อเริ่มต้นการเชื่อมต่อ");
        }
        
        setInterval(checkRealtimeStateSync, 2000);
        window.MrChodButlerInstance.appendLog("🤖 [Mr. Chod Telegram Extension] ระบบโมดูลรีโมตสแตนด์บายพร้อมทำงาน!");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bootstrapTelegramLink);
    } else {
        bootstrapTelegramLink();
    }
})();