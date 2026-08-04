// ==============================================================================================
//    AI MR. CHOD BUTLER SYSTEM - TELEGRAM INTEGRATION MODULE (COMPLETED PRODUCTION EDITION)
//    * คุณลักษณะพิเศษ: ป้องกัน Race Polling, Markdown Auto-Escaper, รองรับ Web App และการค้นหาตารางเวลา *
//    * อัปเดตแก้ไขบัค: ป้องกันสภาวะ Race Condition, รองรับระบบสัมผัส และเพิ่มระบบวิเคราะห์เวลาอัจฉริยะ *
// ==============================================================================================

(function() {
    'use strict';

    let lastUpdateId = 0;
    let lastPanelMessageId = null; // เก็บไอดีข้อความรีโมตคุมเพื่อใช้แก้ไขปุ่มสดแบบซิงค์เรียลไทม์
    let lastStateHash = "";        // ตรวจสอบความคืบหน้าเพื่ออัปเดตปุ่มเฉพาะตอนสถานะเปลี่ยน
    let pollingTimeoutId = null;   // ตัวเก็บ ID ของ setTimeout สำหรับลูปรับคำสั่ง
    let isPollingActive = false;   // แฟล็กป้องกันการทำงานซ้อนของ Long Polling
    let pollingSessionId = 0;      // ตัวนับรอบเซสชันเพื่อป้องกัน Race Condition ของอะซิงโครนัส

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

    // ฟังก์ชันช่วยจัดระเบียบอักขระพิเศษสำหรับระบบ Markdown ของ Telegram ป้องกัน API ล่ม
    function escapeMarkdown(text) {
        if (typeof text !== "string") return "";
        return text.replace(/([_*`\[])/g, '\\$1');
    }

    // ฟังก์ชันส่งข้อความทั่วไปเข้าแชท
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
                    parse_mode: "Markdown"
                })
            });
        } catch (e) {
            console.error("[Telegram] ส่งข้อความล้มเหลว:", e);
        }
    }

    // ฟังก์ชันดึงตารางเวลาเปิด-ปิดอัตโนมัติที่ตั้งค่าไว้และสรุปเป็นข้อความรายงาน
    function getScheduleReport() {
        const config = window.MrChodButlerInstance?.settingsManager?.config;
        if (!config || !config.schedules) {
            return "❌ ไม่พบข้อมูลตารางตั้งเวลาของระบบในขณะนี้ครับเจ้านาย";
        }

        let report = "⏱️ *รายงานตารางเวลาทำงานอัตโนมัติ* ⚡\n\n";
        let hasActiveSchedule = false;

        for (let i = 1; i <= 6; i++) {
            const relay = config.relays?.[i];
            const sched = config.schedules?.[i];
            
            if (sched && sched.enabled) {
                hasActiveSchedule = true;
                const relayName = escapeMarkdown(relay ? relay.name : `รีเลย์ ${i}`);
                const onTime = sched.onTime ? `🟢 เปิด: *${sched.onTime}*` : "🟢 เปิด: ไม่ได้ระบุ";
                const offTime = sched.offTime ? `🔴 ปิด: *${sched.offTime}*` : "🔴 ปิด: ไม่ได้ระบุ";
                report += `• *${relayName}* (Relay 0${i}):\n  └─ ${onTime} | ${offTime}\n`;
            }
        }

        if (!hasActiveSchedule) {
            return "⏱️ *ตารางเวลาทำงานอัตโนมัติ*\nขณะนี้ *ไม่มี* อุปกรณ์ใดเปิดใช้งานระบบทำงานอัตโนมัติครับเจ้านาย";
        }

        return report;
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

    // จัดรูปแบบเวลาให้อยู่ในมาตรฐาน HH:MM เช่น "8:5" -> "08:05"
    function formatTime(timeStr) {
        const parts = timeStr.split(":");
        let hh = parts[0].padStart(2, "0");
        let mm = parts[1].padStart(2, "0");
        return `${hh}:${mm}`;
    }

    // ค้นหาตำแหน่งดัชนี Relay ID จากการพิมพ์ค้นหาของผู้ใช้
    function findRelayIdByQuery(query, config) {
        if (!config) return null;
        query = query.trim().toLowerCase();
        if (!query) return null;

        // 1. ค้นหาผ่านตัวเลขสัญลักษณ์ตรง ๆ (เช่น รีเลย์ 1, relay 2, 3)
        const matchNum = query.match(/(?:รีเลย์|relay)?\s*0*([1-6])/i);
        if (matchNum) {
            return parseInt(matchNum[1]);
        }

        // 2. ค้นหาเปรียบเทียบชื่อในค่า Config ที่ตั้งไว้
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

    // ฟังก์ชันหลักในการแกะกล่องข้อความเพื่อบันทึกตารางเวลาผ่านแชท Telegram (วิเคราะห์แบบ Heuristic)
    async function handleScheduleCommand(text) {
        const config = window.MrChodButlerInstance?.settingsManager?.config;
        if (!config) {
            return "❌ ไม่พบการตั้งค่าระบบแกนหลักในขณะนี้ครับเจ้านาย";
        }

        const lowerText = text.toLowerCase();
        const isCancelKeyword = /(ยกเลิก|ลบ|ปิดใช้งาน|ปิดระบบตั้งเวลา|ปิดตารางเวลา)/.test(lowerText);

        // กรณี ยกเลิก/ปิด การตั้งเวลา
        if (isCancelKeyword) {
            let cleanQuery = lowerText.replace(/(ยกเลิก|ลบ|ปิดใช้งาน|ปิดระบบตั้งเวลา|ปิดตารางเวลา|ตั้งเวลา|ตารางเวลา|สเกดูล)/g, "").trim();
            const relayId = findRelayIdByQuery(cleanQuery, config);

            if (!relayId) {
                return "❌ ไม่สามารถระบุอุปกรณ์ที่ต้องการยกเลิกตารางเวลาได้ครับเจ้านาย กรุณาระบุชื่อหรือหมายเลขรีเลย์ให้ชัดเจน (เช่น 'ยกเลิกตั้งเวลา รีเลย์ 1')";
            }

            if (!config.schedules) config.schedules = {};
            if (!config.schedules[relayId]) {
                config.schedules[relayId] = { enabled: false, onTime: "", offTime: "" };
            }

            config.schedules[relayId].enabled = false;
            saveConfigSafely();

            const relayName = config.relays?.[relayId]?.name || `รีเลย์ ${relayId}`;
            return `✅ ยกเลิกการตั้งเวลาของ *${escapeMarkdown(relayName)}* เรียบร้อยแล้วครับเจ้านาย`;
        }

        // กรณีการ ตั้งค่าตารางเวลา ใหม่ (ปรับนิพจน์ Regex กั้นขอบเขตตัวเลขเพื่อไม่ให้ชนกับระบบไอพีแอดเดรสของบอร์ด)
        const timePattern = /(?<!\d)[0-2]?\d[:.][0-5]\d(?!\d)/g;
        const foundTimes = text.match(timePattern);
        let onTime = null;
        let offTime = null;

        if (foundTimes && foundTimes.length > 0) {
            if (foundTimes.length === 1) {
                const normalizedTime = foundTimes[0].replace(".", ":");
                const hasOpen = /(เปิด|on)/i.test(lowerText);
                const hasClose = /(ปิด|off)/i.test(lowerText);
                if (hasOpen && !hasClose) {
                    onTime = normalizedTime;
                } else if (hasClose && !hasOpen) {
                    offTime = normalizedTime;
                } else {
                    onTime = normalizedTime; // ค่าเริ่มต้นหากก้ำกึ่งระบุเจตจำนงไม่ได้ชัดเจน
                }
            } else if (foundTimes.length >= 2) {
                const time1 = foundTimes[0].replace(".", ":");
                const time2 = foundTimes[1].replace(".", ":");
                const openIdx = lowerText.indexOf("เปิด");
                const closeIdx = lowerText.indexOf("ปิด");

                if (openIdx !== -1 && closeIdx !== -1) {
                    if (openIdx < closeIdx) {
                        onTime = time1;
                        offTime = time2;
                    } else {
                        onTime = time2;
                        offTime = time1;
                    }
                } else {
                    onTime = time1;
                    offTime = time2;
                }
            }
        }

        if (!onTime && !offTime) {
            return "❌ รูปแบบคำสั่งตั้งเวลาไม่ถูกต้องครับเจ้านาย กรุณาระบุเวลาให้ชัดเจน เช่น:\n`ตั้งเวลา [ชื่ออุปกรณ์] เปิด 08:00 ปิด 17:00` หรือ `ตั้งเวลา [ชื่ออุปกรณ์] เปิด 06:30` เป็นต้นครับ";
        }

        // ถอดหาชื่ออุปกรณ์ด้วยระบบกรอง Pipeline ขจัดคำสั่ง เวลา ตัวเลข และลิงก์ URL ส่วนเกินออกทั้งหมด
        let cleanDeviceQuery = text;
        
        // 1. กำจัด URL / ลิงก์ที่อาจคัดลอกพ่วงท้ายติดมา
        cleanDeviceQuery = cleanDeviceQuery.replace(/https?:\/\/\S+/gi, "");
        
        // 2. กำจัดคำสั่งหลักในระบบ
        cleanDeviceQuery = cleanDeviceQuery.replace(/(ตั้งเวลา|ตารางเวลา|สเกดูล)/gi, "");
        
        // 3. กำจัดตัวเลขเวลาที่สกัดได้จริง
        if (foundTimes) {
            foundTimes.forEach(t => {
                cleanDeviceQuery = cleanDeviceQuery.replace(t, "");
            });
        }
        
        // 4. กำจัดคำกริยาทั่วไป
        cleanDeviceQuery = cleanDeviceQuery.replace(/(เปิด|ปิด|on|off|เวลา)/gi, "");
        
        // 5. ล้างอักขระพิเศษ เครื่องหมาย จุดทศนิยมที่อยู่นอกนิพจน์ เพื่อไม่ให้กวนการเทียบตัวอักษร
        cleanDeviceQuery = cleanDeviceQuery.replace(/[^a-zA-Z0-9ก-๙\s]/g, " ");
        
        cleanDeviceQuery = cleanDeviceQuery.trim();

        const relayId = findRelayIdByQuery(cleanDeviceQuery, config);
        if (!relayId) {
            return "❌ ไม่พบอุปกรณ์ที่ท่านระบุในระบบครับเจ้านาย กรุณาระบุเลขรีเลย์ (1-6) หรือชื่ออุปกรณ์ที่ตั้งค่าไว้ให้ถูกต้อง";
        }

        if (!config.schedules) config.schedules = {};
        if (!config.schedules[relayId]) {
            config.schedules[relayId] = { enabled: false, onTime: "", offTime: "" };
        }

        const targetSched = config.schedules[relayId];
        targetSched.enabled = true;
        if (onTime) targetSched.onTime = formatTime(onTime);
        if (offTime) targetSched.offTime = formatTime(offTime);

        saveConfigSafely();

        const relayName = config.relays?.[relayId]?.name || `รีเลย์ ${relayId}`;
        let successMsg = `✅ ตั้งตารางเวลาสำหรับ *${escapeMarkdown(relayName)}* สำเร็จแล้วครับเจ้านาย:\n`;
        if (targetSched.onTime) successMsg += ` └─ 🟢 เปิดทำงาน: *${targetSched.onTime}*\n`;
        if (targetSched.offTime) successMsg += ` └─ 🔴 ปิดทำงาน: *${targetSched.offTime}*`;
        
        return successMsg;
    }

    // ฟังก์ชันสร้างหน้าตาปุ่ม Inline Keyboard (ปรับแต่ง fallbacks ชื่อช่องให้ตรงกับดีฟอลต์ล่าสุดในสคริปต์หลัก)
    function buildInlineKeyboard() {
        const states = window.MrChodButlerInstance?.iotController?.relayStates || {};
        const config = window.MrChodButlerInstance?.settingsManager?.config || null;

        const getRelayLabel = (id, defaultName) => {
            const name = (config?.relays?.[id]) ? config.relays[id].name : defaultName;
            const activeSymbol = states[id] ? "🟢" : "🔴";
            const stateText = states[id] ? "ON" : "OFF";
            return `${activeSymbol} R${id}: ${name} [${stateText}]`;
        };

        const currentUrl = window.location.href;
        if (window.location.protocol !== "https:") {
            console.warn("[Telegram WebApp] ฟีเจอร์แสดงผลเว็บในแชทอาจไม่ทำงานในหน้าต่าง localhost นอกโปรโตคอล HTTPS");
        }

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
                { text: "📱 เปิดหน้าสั่งงานเต็มจอ (Web App)", web_app: { url: currentUrl } }
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
            text: "🤖 *MR. CHOD COGNITIVE CONTROLLER* ⚡\nยินดีต้อนรับสู่สะพานบัญชาการสำรองของระบบชีวภาพและ IoT บรรจุระบบตรวจจับประจุ สั่งงานได้ผ่านปุ่มตรงล่างนี้ครับเจ้านาย:",
            parse_mode: "Markdown",
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
            relayStatusText += `• ${name}: *${active}*\n`;
        }

        let brainText = "• ไม่พบข้อมูลเชื่อมต่อ ChodBrain 3D Map";
        if (window.ChodBrain && window.ChodBrain.neurotransmitters) {
            const nt = window.ChodBrain.neurotransmitters;
            brainText = `• โดพามีน (DOP): *${(nt.dopamine || 0).toFixed(3)}*\n` +
                        `• เซโรโทนิน (5-HT): *${(nt.serotonin || 0).toFixed(3)}*\n` +
                        `• อะดรีนาลีน (EPI): *${(nt.adrenaline || 0).toFixed(3)}*\n` +
                        `• ดัชนีโมเลกุลรบกวน (Frustration): *${(window.ChodBrain.frustrationScore || 0).toFixed(3)}*`;
        }

        const report = `📊 *รายงานดัชนีตรวจวัดประสาทและ IoT* ⚡\n\n` +
                       `🔌 *สวิตช์สถานะอุปกรณ์รีเลย์:*\n${relayStatusText}\n` +
                       `🧠 *โครงข่ายชีวภาพ ChodBrain:*\n${brainText}\n\n` +
                       `📅 ซิงค์เมื่อเวลา: ${new Date().toLocaleTimeString()}`;

        await sendTelegramMessage(report);
    }

    // จัดการข้อสั่งการเมื่อผู้ใช้พิมพ์หรือกดปุ่มบนแชท Telegram
    async function handleTelegramUpdate(update) {
        const { token } = getTelegramCredentials();
        if (!token) return;

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
                if (typeof setDrug === "function") {
                    setDrug(type === "reset" ? null : type);
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

        // 2. ตรวจจับการส่งข้อความพิมพ์พูดคุยปกติ
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
                const hasTime = /(?<!\d)[0-2]?\d[:.][0-5]\d(?!\d)/.test(lowerText);

                if (isCancel || hasTime) {
                    // ดำเนินการ ตั้งเวลาใหม่ หรือ ยกเลิกตารางเวลา
                    const scheduleResponse = await handleScheduleCommand(rawText);
                    await sendTelegramMessage(scheduleResponse);

                    if (window.MrChodButlerInstance) {
                        window.MrChodButlerInstance.appendLog(`> [Telegram Bot CMD] จัดการเวลา: ${rawText}`);
                        window.MrChodButlerInstance.appendLog(`AI : ${scheduleResponse.replace(/\*/g, "")}`);
                    }
                    return;
                } else {
                    // หากไม่ได้ระบุเวลาหรือสั่งยกเลิก ให้ถือว่าต้องการตรวจรายงานสรุปตารางเวลาปัจจุบัน
                    const schedReport = getScheduleReport();
                    await sendTelegramMessage(schedReport);
                    
                    if (window.MrChodButlerInstance) {
                        window.MrChodButlerInstance.appendLog(`> [Telegram Bot CMD] ตรวจสอบตารางเวลา`);
                        window.MrChodButlerInstance.appendLog(`AI : ดำเนินการสรุปตารางเวลาส่งกลับโทรเลขเรียบร้อยแล้วครับ`);
                    }
                    return;
                }
            }

            // หากเป็นข้อความคำสั่งสั่งงานทั่วไป ให้ทำการป้อนเข้า Intent Parser ของ AI Butler โดยตรง
            if (window.MrChodButlerInstance?.intentParser) {
                window.MrChodButlerInstance.appendLog(`> [Telegram Bot CMD] ${rawText}`);
                
                const replyResult = window.MrChodButlerInstance.intentParser.parseIntent(rawText);
                
                window.MrChodButlerInstance.appendLog(`AI : ${replyResult}`);
                window.MrChodButlerInstance.speechEngine.speak(replyResult);

                await sendTelegramMessage(`🤖 AI : ${escapeMarkdown(replyResult)}`);
            }
        }
    }

    // ลูปหลักคอยสแกนตรวจสอบคำสั่งผ่านโทรเลขเบื้องหลัง (Long Polling Loop - ป้องกันซ้อนด้วย Session ID)
    async function startPollingTelegram() {
        const { token, chatId } = getTelegramCredentials();
        if (!token || !chatId) {
            isPollingActive = false;
            return;
        }

        isPollingActive = true;
        const currentSession = ++pollingSessionId; // ระบุรอบเซสชันแบบเฉพาะเจาะจง

        const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;
        try {
            const res = await fetch(url);
            
            // หากระบบสั่งปิดการใช้งาน หรือเปิดรันเซสชันอื่นไปเรียบร้อยแล้ว ให้ปล่อยคำร้องขอเก่านี้ทิ้งไป
            if (!isPollingActive || currentSession !== pollingSessionId) return;

            const data = await res.json();
            if (data.ok && data.result.length > 0) {
                for (const update of data.result) {
                    lastUpdateId = update.update_id;
                    await handleTelegramUpdate(update);
                }
            }
        } catch (e) {
            console.error("[Telegram] เกิดข้อผิดพลาดในลูปรับคำสั่ง:", e);
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

    // ฟังก์ชันสร้างและฝังหน้าต่างสำหรับตั้งค่าและล็อกอินหน้าเว็บ (Dynamic Setup UI Component)
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
                transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                box-sizing: border-box;
                cursor: grab;
                user-select: none;
            }
            #tg-config-panel:active {
                cursor: grabbing;
            }
            #tg-config-panel.minimized {
                transform: translateY(calc(100% - 35px));
            }
            #tg-config-panel.fullscreen {
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                width: 100vw;
                height: 100vh;
                border-radius: 0;
                border: none;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                background: rgba(24, 24, 27, 0.98);
                backdrop-filter: blur(8px);
                cursor: default;
            }
            #tg-config-panel h4 {
                margin: 0 0 8px 0;
                font-size: 14px;
                color: #f4f4f5;
                display: flex;
                justify-content: space-between;
                align-items: center;
                pointer-events: none;
            }
            #tg-config-panel .tg-controls-wrapper {
                display: flex;
                gap: 8px;
                font-size: 11px;
                pointer-events: auto;
            }
            #tg-config-panel .tg-btn-link {
                cursor: pointer;
                padding: 2px 6px;
                border-radius: 4px;
                background: #27272a;
                border: 1px solid #3f3f46;
                transition: background 0.2s;
            }
            #tg-config-panel .tg-btn-link:hover {
                background: #3f3f46;
                color: #fff;
            }
            #tg-config-panel #tg-panel-body {
                transition: opacity 0.2s;
                pointer-events: auto;
            }
            #tg-config-panel.minimized #tg-panel-body {
                opacity: 0;
                pointer-events: none;
            }
            #tg-config-panel.fullscreen #tg-panel-body {
                width: 100%;
                max-width: 420px;
                background: #202023;
                padding: 24px;
                border-radius: 8px;
                border: 1px solid #3f3f46;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.7);
            }
            #tg-config-panel label {
                display: block;
                margin-top: 8px;
                color: #a1a1aa;
                font-size: 11px;
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
                user-select: auto;
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
            }
            #tg-config-panel button:hover {
                background: #1d4ed8;
            }
        `;
        document.head.appendChild(style);

        const container = document.createElement("div");
        container.id = "tg-config-panel";
        
        const credentials = getTelegramCredentials();

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
                <input type="password" id="tg-token-input" placeholder="กรอก Bot Token..." value="${credentials.token}">
                
                <label>Telegram Chat ID:</label>
                <input type="text" id="tg-chat-input" placeholder="กรอก Chat ID..." value="${credentials.chatId}">
                
                <button id="tg-save-btn">บันทึกและเชื่อมต่อ</button>
            </div>
        `;

        document.body.appendChild(container);

        // ==========================================
        //  ระบบลากวาง (Drag & Drop) เมาส์ซ้าย & ระบบทัชสกรีนบนมือถือ
        // ==========================================
        let isDragging = false;
        let startX, startY;

        // ฟังก์ชันเริ่มกระบวนการลากแผง
        const startDrag = (clientX, clientY, target) => {
            const tag = target.tagName;
            if (tag === "INPUT" || tag === "BUTTON" || tag === "A" || target.classList.contains("tg-btn-link")) {
                return;
            }
            if (container.classList.contains("fullscreen")) return;

            isDragging = true;
            const rect = container.getBoundingClientRect();
            startX = clientX - rect.left;
            startY = clientY - rect.top;

            container.style.bottom = "auto";
            container.style.right = "auto";
            container.style.left = `${rect.left}px`;
            container.style.top = `${rect.top}px`;
        };

        // ฟังก์ชันอัปเดตพิกัดพิกเซลใหม่ของแผงลาก
        const moveDrag = (clientX, clientY) => {
            if (!isDragging) return;

            let newLeft = clientX - startX;
            let newTop = clientY - startY;

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
        };

        // เหตุการณ์สำหรับเมาส์ (Desktop)
        container.addEventListener("mousedown", (e) => {
            if (e.button !== 0) return;
            startDrag(e.clientX, e.clientY, e.target);
            e.preventDefault();
        });

        document.addEventListener("mousemove", (e) => {
            moveDrag(e.clientX, e.clientY);
        });

        document.addEventListener("mouseup", () => {
            isDragging = false;
        });

        // เหตุการณ์สำหรับระบบทัชสกรีน (Mobile Web App)
        container.addEventListener("touchstart", (e) => {
            const touch = e.touches[0];
            startDrag(touch.clientX, touch.clientY, e.target);
        }, { passive: true });

        document.addEventListener("touchmove", (e) => {
            if (!isDragging) return;
            const touch = e.touches[0];
            moveDrag(touch.clientX, touch.clientY);
        }, { passive: true });

        document.addEventListener("touchend", () => {
            isDragging = false;
        });

        const minimizeBtn = document.getElementById("tg-minimize-btn");
        const fullscreenBtn = document.getElementById("tg-fullscreen-btn");

        // ปุ่มย่อ/ขยาย
        minimizeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (container.classList.contains("fullscreen")) {
                container.classList.remove("fullscreen");
            }
            container.classList.toggle("minimized");
        });

        // ปุ่มปรับขยายแสดงผลเต็มหน้าจอ
        fullscreenBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (container.classList.contains("minimized")) {
                container.classList.remove("minimized");
            }
            container.classList.toggle("fullscreen");
        });

        // จัดการคลิกบันทึกข้อมูล
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