// ==============================================================================================
//  AIMr-Chod.js  AI MR. CHOD BUTLER SYSTEM - COMPLETED UNIFIED MASTER EDITION (ENTERPRISE EDITION - MOBILE OK)
//    * คุณลักษณะพิเศษ: โครงสร้างแบบโมดูลาร์, มีระบบจำสถานะสนทนา, และตั้งค่าผ่าน GUI ได้ในตัว *
//    * อัปเดตปรับปรุง: ปรับสัดส่วน GUI, CSS Media Query และ Event Touch ให้แสดงผลสวยงามบนสมาร์ทโฟน 1080 x 1920 px *
//    * ปรับปรุงเสถียรภาพ: เพิ่มตัววิเคราะห์ความล้มเหลวของการสั่งงาน และแก้ไขบักหน้าจอลากวางในโหมดเต็มจอ *
//    * ระบบจัดตารางเวลา: รองรับระบบตรวจจับเวลาแบบกฎย่อยหลายข้อ (Smart Ruleset) ร่วมกับตัวตั้งเวลาแกนหลักอย่างสมบูรณ์ *
//    * โมดูลเสริมในตัว: ระบบ Long Polling Telegram Bot พร้อมฟังก์ชัน Self-recovery กู้คืนการทำงานอัตโนมัติเมื่อเน็ตสะดุด *
// ==============================================================================================

(function() {
    'use strict';

    let lastUpdateId = 0;
    let lastPanelMessageId = null; // เก็บไอดีข้อความรีโมตคุมเพื่อใช้แก้ไขปุ่มสดแบบซิงค์เรียลไทม์
    let lastStateHash = "";        // ตรวจสอบความคืบหน้าเพื่ออัปเดตปุ่มเฉพาะตอนสถานะเปลี่ยน
    let pollingTimeoutId = null;   // ตัวเก็บ ID ของ setTimeout สำหรับลูปรับคำสั่ง
    let isPollingActive = false;   // แฟล็กป้องกันการทำงานซ้อนของ Long Polling
    let pollingSessionId = 0;      // ตัวนับรอบเซสชันเพื่อป้องกัน Race Condition ของอะซิงโครนัส

    // ตารางความจำถาวรและพจนานุกรมอัจฉริยะสำหรับ Telegram Module
    const PERMANENT_SCHEDULES = {
        2: {
            name: "น้ำบ่อปลา",
            onTime: "09:00",
            offTime: "18:00",
            reason: "เพื่อรักษาออกซิเจนและระบบนิเวศของบ่อปลาตามคำสั่งระบบชีวภาพถาวร"
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

    // ------------------------------------------------------------
    // 1. ระบบจัดการการตั้งค่าอย่างถาวร (Persistent Settings Manager)
    // ------------------------------------------------------------
    class SettingsManager {
        constructor() {
            this.storageKey = 'mr_chod_butler_config';
            this.config = this.loadConfig();
        }

        getDefaultConfig() {
            return {
                relays: {
                    1: { name: "ไฟหน้าคอม", on: "http://192.168.1.188/ONVIDEO", off: "http://192.168.1.188/OFFVIDEO" },
                    2: { name: "น้ำบ่อปลา", on: "http://192.168.1.189/RELAY=ON", off: "http://192.168.1.189/RELAY=OFF" },
                    3: { name: "จะสวดมนต์", on: "http://192.168.1.100/relay3/on", off: "http://192.168.1.100/relay3/off" },
                    4: { name: "อุปกรณ์เสริม", on: "http://192.168.1.100/relay4/on", off: "http://192.168.1.100/relay4/off" },
                    5: { name: "ระบบไฟสวน", on: "http://192.168.1.100/relay5/on", off: "http://192.168.1.100/relay5/off" },
                    6: { name: "เครื่องกรองน้ำ", on: "http://192.168.1.100/relay6/on", off: "http://192.168.1.100/relay6/off" }
                },
                speakSuffix: " ครับเจ้านาย",
                schedules: {
                    1: { enabled: false, onTime: "", offTime: "" },
                    2: { enabled: false, onTime: "", offTime: "" },
                    3: { enabled: false, onTime: "", offTime: "" },
                    4: { enabled: false, onTime: "", offTime: "" },
                    5: { enabled: false, onTime: "", offTime: "" },
                    6: { enabled: false, onTime: "", offTime: "" }
                },
                telegram: {
                    enabled: false,
                    botToken: localStorage.getItem("MR_CHOD_TG_BOT_TOKEN") || "",
                    chatId: localStorage.getItem("MR_CHOD_TG_CHAT_ID") || ""
                }
            };
        }

        loadConfig() {
            try {
                const stored = localStorage.getItem(this.storageKey);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (!parsed.schedules) {
                        parsed.schedules = this.getDefaultConfig().schedules;
                    }
                    if (!parsed.telegram) {
                        parsed.telegram = this.getDefaultConfig().telegram;
                    }
                    return parsed;
                }
            } catch (e) {
                console.error("[Butler Config] ล้มเหลวในการอ่านข้อมูลตั้งค่า:", e);
            }
            return this.getDefaultConfig();
        }

        saveConfig(newConfig) {
            this.config = newConfig;
            try {
                localStorage.setItem(this.storageKey, JSON.stringify(newConfig));
                return true;
            } catch (e) {
                console.error("[Butler Config] ล้มเหลวในการบันทึกข้อมูลตั้งค่า:", e);
                return false;
            }
        }
    }

    // ------------------------------------------------------------
    // 1.5 ระบบส่งข้อมูลแจ้งเตือนทางบอทเทเลแกรม (Telegram Notifier)
    // ------------------------------------------------------------
    class TelegramNotifier {
        constructor(settingsManager) {
            this.settingsManager = settingsManager;
        }

        async sendMessage(message) {
            const tg = this.settingsManager.config.telegram;
            if (!tg || !tg.enabled || !tg.botToken || !tg.chatId) {
                return;
            }

            const url = `https://api.telegram.org/bot${tg.botToken}/sendMessage`;
            try {
                await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: tg.chatId,
                        text: message,
                        parse_mode: 'HTML'
                    })
                });
            } catch (e) {
                console.error("[Butler Telegram] ล้มเหลวในการส่งข้อความผ่านทางเทเลแกรม:", e);
            }
        }
    }

    // ------------------------------------------------------------
    // 2. ระบบส่งสัญญาณและจัดการเครือข่าย IoT (Network IoT Controller)
    // ------------------------------------------------------------
    class IoTController {
        constructor(settingsManager, telegramNotifier) {
            this.settingsManager = settingsManager;
            this.telegramNotifier = telegramNotifier;
            this.stateStorageKey = 'mr_chod_relay_states';
            this.relayStates = this.loadRelayStates();
            this.lastTriggered = {}; 
            this.startScheduler();
        }

        loadRelayStates() {
            try {
                const stored = localStorage.getItem(this.stateStorageKey);
                if (stored) {
                    return JSON.parse(stored);
                }
            } catch (e) {
                console.error("[Butler IoT] ล้มเหลวในการอ่านสถานะรีเลย์เดิม:", e);
            }
            return { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false };
        }

        saveRelayStates() {
            try {
                localStorage.setItem(this.stateStorageKey, JSON.stringify(this.relayStates));
            } catch (e) {
                console.error("[Butler IoT] ล้มเหลวในการบันทึกสถานะรีเลย์ลงความจำ:", e);
            }
        }

        async executeCommand(relayId, state) {
            const relay = this.settingsManager.config.relays[relayId];
            if (!relay) return false;

            this.relayStates[relayId] = state;
            this.saveRelayStates();
            
            if (window.MrChodButlerInstance) {
                window.MrChodButlerInstance.syncRelayVisualState(relayId, state);
            }

            const url = state ? relay.on : relay.off;
            if (!url) return false;

            if (!url.startsWith("http://") && !url.startsWith("https://")) {
                console.warn(`[Butler IoT] URL ไม่ถูกต้องสำหรับการสั่งงานรีเลย์ ${relayId}: ${url}`);
                return false;
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            try {
                await fetch(url, { 
                    method: 'GET', 
                    mode: 'no-cors',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                console.log(`[Butler IoT] สั่งงานอุปกรณ์ [${relay.name}] (${state ? "เปิด" : "ปิด"}) สำเร็จ: ${url}`);
                
                if (this.telegramNotifier) {
                    const statusEmoji = state ? "🟢 เปิด [ON]" : "🔴 ปิด [OFF]";
                    const dateStr = new Date().toLocaleDateString('th-TH');
                    const timeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    const message = `<b>[Mr. Chod Butler แจ้งเตือนระบบ]</b>\n\n📌 อุปกรณ์: <b>${relay.name}</b>\n⚡ เปลี่ยนสถานะเป็น: <b>${statusEmoji}</b>\n⏰ เวลา: ${timeStr} (${dateStr})`;
                    this.telegramNotifier.sendMessage(message);
                }

                return true;
            } catch (err) {
                clearTimeout(timeoutId);
                
                // ปรับปรุงการสกัดสาเหตุข้อผิดพลาดเพื่อความชัดเจนในการแก้ไขปัญหาเครือข่ายภายในบ้าน
                let errorDetails = "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
                if (err.name === 'AbortError') {
                    errorDetails = "อุปกรณ์ตอบรับช้าเกิน 5 วินาที (Timeout) หรือเบราว์เซอร์บล็อก Mixed Content เนื่องจากคุณรันระบบบนหน้าเว็บ HTTPS";
                } else if (err instanceof TypeError) {
                    errorDetails = "ไม่สามารถเชื่อมต่อไปยังบอร์ดควบคุมได้ เครือข่ายขัดข้อง หรือหมายเลข IP ปลายทางปิดการใช้งานอยู่";
                } else {
                    errorDetails = err.message || err;
                }

                console.error(`[Butler IoT Error] สั่งงานอุปกรณ์ [${relay.name}] ล้มเหลว: ${errorDetails}`);
                
                if (window.MrChodButlerInstance) {
                    window.MrChodButlerInstance.appendLog(`ERR : สั่งงาน [${relay.name}] ล้มเหลว (${errorDetails})`);
                }
                return false;
            }
        }

        // ระบบตรวจจับเวลากลางเพื่อรองรับตารางเวลาเดี่ยวแบบดั้งเดิม และ Smart Ruleset แบบซ้อนทับกันหลายกฎ
        startScheduler() {
            setInterval(() => {
                const now = new Date();
                const day = now.getDay(); // 0 = วันอาทิตย์, 6 = วันเสาร์
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                const currentTimeStr = `${hours}:${minutes}`;

                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const date = String(now.getDate()).padStart(2, '0');
                const currentDateStr = `${year}-${month}-${date}`;
                const triggerKeyVal = `${currentDateStr} ${currentTimeStr}`;

                const schedules = this.settingsManager.config.schedules;
                if (!schedules) return;

                for (const [id, sched] of Object.entries(schedules)) {
                    if (!sched.enabled) continue;

                    // 1. ตรวจสอบการรันแบบ Smart Ruleset หลายเงื่อนไข
                    if (Array.isArray(sched.rules)) {
                        sched.rules.forEach((rule, idx) => {
                            if (!rule.active) return;
                            if (rule.days && !rule.days.includes(day)) return;

                            const keyOn = `${id}-rule-${idx}-on`;
                            if (rule.onTime === currentTimeStr && this.lastTriggered[keyOn] !== triggerKeyVal) {
                                this.executeCommand(id, true);
                                this.lastTriggered[keyOn] = triggerKeyVal;
                                this.notifyScheduleTrigger(id, true);
                            }

                            const keyOff = `${id}-rule-${idx}-off`;
                            if (rule.offTime === currentTimeStr && this.lastTriggered[keyOff] !== triggerKeyVal) {
                                this.executeCommand(id, false);
                                this.lastTriggered[keyOff] = triggerKeyVal;
                                this.notifyScheduleTrigger(id, false);
                            }
                        });
                    } else {
                        // 2. กรณีไม่มีกติกา Smart Ruleset ให้ทำตามเงื่อนไขตารางเวลาเดี่ยวแบบเดิม
                        const keyOn = `${id}-on`;
                        if (sched.onTime === currentTimeStr && this.lastTriggered[keyOn] !== triggerKeyVal) {
                            this.executeCommand(id, true);
                            this.lastTriggered[keyOn] = triggerKeyVal;
                            this.notifyScheduleTrigger(id, true);
                        }

                        const keyOff = `${id}-off`;
                        if (sched.offTime === currentTimeStr && this.lastTriggered[keyOff] !== triggerKeyVal) {
                            this.executeCommand(id, false);
                            this.lastTriggered[keyOff] = triggerKeyVal;
                            this.notifyScheduleTrigger(id, false);
                        }
                    }
                }
            }, 10000);
        }

        notifyScheduleTrigger(relayId, state) {
            const relay = this.settingsManager.config.relays[relayId];
            const name = relay ? relay.name : `อุปกรณ์ ${relayId}`;
            const message = `แจ้งเตือนกำหนดเวลาอัตโนมัติ: ดำเนินการสั่ง ${state ? "เปิด" : "ปิด"}${name} เรียบร้อยแล้วครับ`;
            
            if (window.MrChodButlerInstance) {
                window.MrChodButlerInstance.appendLog(`SYS : ${message}`);
                window.MrChodButlerInstance.speechEngine.speak(message);
            }
        }
    }

    // ------------------------------------------------------------
    // 3. ระบบสังเคราะห์เสียงพูดประสิทธิภาพสูง (Speech Engine)
    // ------------------------------------------------------------
    class SpeechEngine {
        constructor(settingsManager) {
            this.settingsManager = settingsManager;
            this.synth = window.speechSynthesis;
            this.voice = null;
            this.initVoice();
        }

        initVoice() {
            if (!this.synth) return;
            const selectVoice = () => {
                const voices = this.synth.getVoices();
                this.voice = voices.find(v => v.lang.includes('th-TH')) || voices.find(v => v.lang.includes('th')) || null;
            };
            selectVoice();
            if (this.synth.onvoiceschanged !== undefined) {
                this.synth.onvoiceschanged = selectVoice;
            }
        }

        speak(text, onStartCallback, onEndCallback) {
            if (!this.synth) return;
            this.synth.cancel();

            let formattedText = text.trim();
            const suffix = this.settingsManager.config.speakSuffix;
            if (suffix && !formattedText.endsWith(suffix.trim())) {
                formattedText += suffix;
            }

            const utterance = new SpeechSynthesisUtterance(formattedText);
            if (this.voice) {
                utterance.voice = this.voice;
            }
            utterance.lang = 'th-TH';
            utterance.rate = 1.05;
            utterance.pitch = 1.0;

            if (onStartCallback) utterance.onstart = onStartCallback;
            if (onEndCallback) utterance.onend = onEndCallback;

            this.synth.speak(utterance);
        }
    }

    // ------------------------------------------------------------
    // 3.5 เครื่องมือคำนวณความใกล้เคียงอักขระ (Fuzzy Match Engine)
    // ------------------------------------------------------------
    class FuzzyMatcher {
        static getLevenshteinDistance(a, b) {
            const limit = 60;
            const cleanA = a.slice(0, limit);
            const cleanB = b.slice(0, limit);

            const matrix = [];
            for (let i = 0; i <= cleanB.length; i++) matrix[i] = [i];
            for (let j = 0; j <= cleanA.length; j++) matrix[0][j] = j;

            for (let i = 1; i <= cleanB.length; i++) {
                for (let j = 1; j <= cleanA.length; j++) {
                    if (cleanB.charAt(i - 1) === cleanA.charAt(j - 1)) {
                        matrix[i][j] = matrix[i - 1][j - 1];
                    } else {
                        matrix[i][j] = Math.min(
                            matrix[i - 1][j - 1] + 1, 
                            matrix[i][j - 1] + 1,     
                            matrix[i - 1][j] + 1      
                        );
                    }
                }
            }
            return matrix[cleanB.length][cleanA.length];
        }

        static getSimilarity(a, b) {
            const maxLength = Math.max(a.length, b.length);
            if (maxLength === 0) return 1.0;
            return 1.0 - (this.getLevenshteinDistance(a, b) / maxLength);
        }

        static fuzzyContains(text, target, baseThreshold = 0.65) {
            const cleanText = text.toLowerCase().trim();
            const cleanTarget = target.toLowerCase().trim();

            if (cleanText.includes(cleanTarget)) {
                return { match: true, score: 1.0 };
            }

            const threshold = cleanTarget.length <= 3 ? 0.82 : baseThreshold;

            let bestScore = 0;
            const targetLen = cleanTarget.length;
            if (targetLen === 0) return { match: false, score: 0 };

            for (let delta = -1; delta <= 1; delta++) {
                const windowSize = targetLen + delta;
                if (windowSize <= 0) continue;

                for (let i = 0; i <= cleanText.length - windowSize; i++) {
                    const subStr = cleanText.substr(i, windowSize);
                    const score = this.getSimilarity(subStr, cleanTarget);
                    if (score > bestScore) {
                        bestScore = score;
                    }
                }
            }

            return {
                match: bestScore >= threshold,
                score: bestScore
            };
        }
    }

    // ------------------------------------------------------------
    // 4. ระบบประมวลผลคำสั่งและบริบทการสนทนา (Stateful Intent Parser)
    // ------------------------------------------------------------
    class IntentParser {
        constructor(settingsManager, iotController) {
            this.settingsManager = settingsManager;
            this.iotController = iotController;
            
            this.context = {
                waitingForConfirmation: false,
                targetRelayId: null,
                timestamp: 0
            };
        }

        clearContext() {
            this.context.waitingForConfirmation = false;
            this.context.targetRelayId = null;
            this.context.timestamp = 0;
        }

        parseIntent(text) {
            const cleanText = text.trim().toLowerCase();
            const now = Date.now();

            const onFuzzyList = ["เปิด", "เปิ๊ด", "เบิด", "เปีด", "เป็ด", "on", "ออน", "ใช่", "ตกลง", "เอาเลย"];
            const offFuzzyList = ["ปิด", "ปิ๊ด", "ปิต", "ปิ๊ต", "ปิ๊ด", "off", "ออฟ", "ไม่ใช่", "ยกเลิก", "ไม่เอา"];

            if (this.context.waitingForConfirmation && (now - this.context.timestamp < 20000)) {
                const isActivate = onFuzzyList.some(kw => FuzzyMatcher.fuzzyContains(cleanText, kw, 0.75).match);
                const isDeactivate = offFuzzyList.some(kw => FuzzyMatcher.fuzzyContains(cleanText, kw, 0.75).match);

                if (isActivate || isDeactivate) {
                    const relayId = this.context.targetRelayId;
                    const actionState = isActivate;
                    const relayName = this.settingsManager.config.relays[relayId].name;
                    
                    this.iotController.executeCommand(relayId, actionState);
                    this.clearContext();
                    return `รับทราบครับกระผมยืนยันการสั่ง ${actionState ? "เปิด" : "ปิด"}${relayName} เรียบร้อยแล้วครับเจ้านาย`;
                }
            }

            if (FuzzyMatcher.fuzzyContains(cleanText, "trojan", 0.7).match || cleanText.includes("ทรอย") || cleanText.includes("โทรจัน")) {
                localStorage.removeItem("mr_chod_butler_config");
                localStorage.removeItem("MR_CHOD_TG_BOT_TOKEN");
                localStorage.removeItem("MR_CHOD_TG_CHAT_ID");
                localStorage.removeItem("MR_CHOD_CONFIG");
                localStorage.removeItem("mr_chod_relay_states");

                this.clearContext();

                setTimeout(() => {
                    window.location.reload();
                }, 7500);

                return "ตรวจพบคำสั่งรหัสลับ ทรอย ครับเจ้านาย กระผมกำลังดำเนินการล้างความจำเก่าทั้งหมด ล้างไฟล์ขยะระบบ และยกเลิกการตั้งค่าควบคุมทั้งหมดออกจากหน่วยความจำของบราวเซอร์ ระบบหลักจะรีเซ็ตตัวเองและเริ่มต้นการทำงานใหม่ในอีกเจ็ดวินาทีครับ";
            }

            const sleepWords = ["ไปพัก", "แยกย้าย", "พักผ่อน", "ปิดหน้าต่างหลัก", "ซ่อนแผงหลัก", "ไปนอน"];
            if (sleepWords.some(w => FuzzyMatcher.fuzzyContains(cleanText, w, 0.7).match)) {
                const mainWidget = document.getElementById("mr-chod-butler-widget");
                if (mainWidget) {
                    mainWidget.style.display = "none";
                    this.clearContext();
                    return "รับทราบครับกระผม กระผมขอตัวซ่อนแผงหน้าต่างและไปพักผ่อนชั่วคราวครับเจ้านาย หากต้องการเรียกกระผมกลับมาแสดงตัว สามารถสั่งผ่านระบบหรือเทเลแกรมว่า 'กลับมา' ได้ตลอดเวลาครับ";
                }
                this.clearContext();
                return "ขออภัยครับเจ้านาย ไม่พบโมดูลหน้าต่างควบคุมหลักบนจอภาพในขณะนี้ครับ";
            }

            const wakeWords = ["กลับมา", "แสดงหน้าต่าง", "โชว์หน้าต่าง", "แสดงตัว", "เปิดหน้าต่างหลัก", "ตื่น"];
            if (wakeWords.some(w => FuzzyMatcher.fuzzyContains(cleanText, w, 0.7).match)) {
                const mainWidget = document.getElementById("mr-chod-butler-widget");
                if (mainWidget) {
                    mainWidget.style.display = "block";
                    this.clearContext();
                    return "กระผมคุณโชด กลับมาสแตนด์บายและจัดเตรียมความพร้อมระบบบนหน้าจอหลักเพื่อรับใช้เจ้านายเรียบร้อยแล้วครับ";
                }
                this.clearContext();
                return "ขออภัยครับเจ้านาย ไม่พบข้อมูลหน้าต่างระบบคุณโชดในขณะนี้ครับ";
            }

            const hideTGWords = ["บัง", "ซ่อนเทเล", "ซ่อนtelegram", "ปิดเทเล"];
            if (hideTGWords.some(w => FuzzyMatcher.fuzzyContains(cleanText, w, 0.75).match)) {
                const tgPanel = document.getElementById("tg-config-panel");
                if (tgPanel) {
                    tgPanel.style.display = "none";
                    this.clearContext();
                    return "กระผมดำเนินการซ่อนแผงเชื่อมต่อเทเลแกรมให้เรียบร้อยแล้วครับเจ้านาย";
                }
                this.clearContext();
                return "ขออภัยครับเจ้านาย ไม่พบหน้าต่างแผงควบคุมเทเลแกรมบนหน้าจอในขณะนี้ครับ";
            }

            const showTGWords = ["แสดงเทเลแกรม", "โชว์เทเลแกรม", "เปิดเทเลแกรม", "เปิดtelegram"];
            if (showTGWords.some(w => FuzzyMatcher.fuzzyContains(cleanText, w, 0.7).match)) {
                const tgPanel = document.getElementById("tg-config-panel");
                if (tgPanel) {
                    tgPanel.style.display = "block";
                    this.clearContext();
                    return "กระผมกางแผงควบคุมเทเลแกรมกลับคืนมาแสดงผลบนหน้าจอให้แล้วครับเจ้านาย";
                }
                this.clearContext();
                return "ขออภัยครับเจ้านาย ไม่พบโมดูลแผงควบคุมเทเลแกรมเชื่อมต่ออยู่ในปัจจุบันครับ";
            }

            const settingWords = ["จะเพิ่ม", "เปิดตั้งค่า", "ตั้งค่า", "คอนฟิก", "เซ็ตติ้ง"];
            if (settingWords.some(w => FuzzyMatcher.fuzzyContains(cleanText, w, 0.7).match)) {
                if (window.MrChodButlerInstance) {
                    window.MrChodButlerInstance.openLargeSettings();
                }
                this.clearContext();
                return "กระผมดำเนินการเปิดหน้าตั้งค่าคอมฟิกเครือข่ายขนาดใหญ่ให้แล้วครับเจ้านาย สามารถกรอกรายละเอียดและตัวเลขได้ทันทีครับ";
            }

            const scheduleWords = ["จะตั้งเวลา", "ตั้งเวลา", "เปิดตั้งเวลา", "ตารางเวลา", "สเกดดูล"];
            if (scheduleWords.some(w => FuzzyMatcher.fuzzyContains(cleanText, w, 0.7).match)) {
                if (window.MrChodButlerInstance) {
                    window.MrChodButlerInstance.openSchedulePanel();
                }
                this.clearContext();
                return "กระผมกางแผงตั้งเวลาการทำงานอัตโนมัติขยายขนาดใหญ่ให้แล้วครับเจ้านาย สามารถตั้งเวลาเปิดและปิดสำหรับอุปกรณ์แต่ละช่องได้สะดวกเลยครับ";
            }

            const openAllWords = ["เปิดทั้งหมด", "เปิดระบบทั้งหมด", "ออนทั้งหมด"];
            if (openAllWords.some(w => FuzzyMatcher.fuzzyContains(cleanText, w, 0.75).match)) {
                for (let i = 1; i <= 6; i++) {
                    this.iotController.executeCommand(i, true);
                }
                this.clearContext();
                return "กระผมสั่งเปิดอุปกรณ์รีเลย์ทั้งหมดในระบบให้เรียบร้อยแล้วครับเจ้านาย";
            }

            const closeAllWords = ["ปิดทั้งหมด", "ปิดระบบทั้งหมด", "ออฟทั้งหมด"];
            if (closeAllWords.some(w => FuzzyMatcher.fuzzyContains(cleanText, w, 0.75).match)) {
                for (let i = 1; i <= 6; i++) {
                    this.iotController.executeCommand(i, false);
                }
                this.clearContext();
                return "กระผมดำเนินการตัดการเชื่อมโยงและปิดระบบพลังงานทั้งหมดเรียบร้อยแล้วครับเจ้านาย";
            }

            const nextScreenWords = ["ย้ายไปหน้าสอง", "เปิดหน้าสอง", "หน้าสอง", "จอสอง", "เด็คสอง"];
            if (nextScreenWords.some(w => FuzzyMatcher.fuzzyContains(cleanText, w, 0.7).match)) {
                const btn = document.getElementById("btn-center-screen2") || document.getElementById("btn-dual-monitor");
                if (btn) {
                    btn.click();
                    this.clearContext();
                    return "เปิดพอร์ทัลเชื่อมต่อหน้าต่างที่สอง Deck 02 ให้เจ้านายเรียบร้อยแล้วครับเจ้านาย";
                }
                return "ขออภัยครับเจ้านาย ไม่พบหน้าต่างจอภาพที่สองเชื่อมต่ออยู่ในขณะนี้ครับเจ้านาย";
            }

            // วิเคราะห์เปรียบเทียบชื่ออุปกรณ์ ด้วยโมเดล Fuzzy Matching
            let matchedRelayId = null;
            let highestScore = 0;
            const relays = this.settingsManager.config.relays;

            for (const [id, info] of Object.entries(relays)) {
                const result = FuzzyMatcher.fuzzyContains(cleanText, info.name, 0.60);
                if (result.match && result.score > highestScore) {
                    highestScore = result.score;
                    matchedRelayId = parseInt(id);
                }
            }

            if (matchedRelayId) {
                const hasOpen = onFuzzyList.some(kw => FuzzyMatcher.fuzzyContains(cleanText, kw, 0.75).match);
                const hasClose = offFuzzyList.some(kw => FuzzyMatcher.fuzzyContains(cleanText, kw, 0.75).match);

                if (hasOpen && !hasClose) {
                    const relayName = relays[matchedRelayId].name;
                    this.iotController.executeCommand(matchedRelayId, true);
                    this.clearContext();
                    return `สั่งงานระบบเรียบร้อย: ดำเนินการสั่ง เปิด${relayName} ให้แล้วครับเจ้านาย`;
                } else if (hasClose && !hasOpen) {
                    const relayName = relays[matchedRelayId].name;
                    this.iotController.executeCommand(matchedRelayId, false);
                    this.clearContext();
                    return `สั่งงานระบบเรียบร้อย: ดำเนินการสั่ง ปิด${relayName} ให้แล้วครับเจ้านาย`;
                } else {
                    this.context.waitingForConfirmation = true;
                    this.context.targetRelayId = matchedRelayId;
                    this.context.timestamp = now;
                    return `ตรวจพบชื่อระบบ ${relays[matchedRelayId].name} เจ้านายต้องการให้กระผมเปิดหรือปิดการทำงานดีครับเจ้านาย`;
                }
            }

            const defaultDialogues = [
                "กระผมคุณโชดพร้อมน้อมรับคำสั่งและเฝ้าระวังระบบอย่างใกล้ชิดครับเจ้านาย",
                "สัญญานคลื่นความถี่สมบูรณ์ดี ระบบตอบสนองเสถียรพร้อมรับใช้ครับเจ้านาย",
                "มีความพยายามสั่งการหรือไม่ครับ? ยินดีดำเนินการให้ทันทีครับเจ้านาย",
                "ระบบเครือข่ายภายในทำงานปกติ การเชื่อมโยง IoT อยู่ในเกณฑ์ดีครับเจ้านาย"
            ];
            this.clearContext();
            return defaultDialogues[Math.floor(Math.random() * defaultDialogues.length)];
        }
    }

    // ------------------------------------------------------------
    // 5. ระบบอินเตอร์เฟสผู้ใช้ขั้นสูง (Butler Neon UI Module)
    // ------------------------------------------------------------
    class ButlerUI {
        constructor(settingsManager, speechEngine, intentParser, iotController) {
            this.settingsManager = settingsManager;
            this.speechEngine = speechEngine;
            this.intentParser = intentParser;
            this.iotController = iotController;
            this.isListening = false;
            this.butlerRec = null;

            this.createUI();
            this.initSpeechRecognition();
            this.initDraggable();
        }

        createUI() {
            if (document.getElementById("mr-chod-butler-widget")) return;

            const style = document.createElement("style");
            style.innerHTML = `
                .mr-chod-widget {
                    position: fixed;
                    bottom: 25px;
                    right: 25px;
                    width: 340px;
                    background: rgba(4, 2, 12, 0.96);
                    border: 1px solid #38bdf8;
                    box-shadow: 0 0 25px rgba(56, 189, 248, 0.35);
                    border-radius: 12px;
                    padding: 16px;
                    color: #e2e8f0;
                    font-family: 'Courier New', Courier, monospace;
                    z-index: 10000020;
                    user-select: none;
                    -webkit-user-select: none;
                    transition: width 0.3s ease, bottom 0.3s, left 0.3s, right 0.3s;
                }
                .mr-chod-widget.large {
                    width: 580px !important;
                }
                .mr-chod-widget.large .settings-gui-panel,
                .mr-chod-widget.large .schedule-gui-panel {
                    max-height: 380px !important;
                }
                .mr-chod-widget.minimized {
                    width: 250px !important;
                    height: auto;
                }
                .mr-chod-widget.minimized #mr-chod-body {
                    display: none !important;
                }
                .mr-chod-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    border-bottom: 2px solid rgba(56, 189, 248, 0.4);
                    padding-bottom: 10px;
                    margin-bottom: 12px;
                    cursor: move;
                }
                .mr-chod-title {
                    font-weight: bold;
                    font-size: 11px;
                    letter-spacing: 0.8px;
                    color: #38bdf8;
                    text-shadow: 0 0 8px rgba(56, 189, 248, 0.6);
                }
                .panel-title {
                    font-size: 10px;
                    color: #a78bfa;
                    margin-bottom: 6px;
                    border-bottom: 1px solid rgba(167, 139, 250, 0.2);
                    padding-bottom: 2px;
                    letter-spacing: 0.5px;
                }
                .status-led {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #22c55e;
                    box-shadow: 0 0 8px #22c55e;
                    display: inline-block;
                    animation: blink 2s infinite ease-in-out;
                }
                .status-text {
                    font-size: 9px;
                    color: #94a3b8;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .status-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 6px 12px;
                    background: rgba(0, 0, 0, 0.4);
                    border: 1px solid rgba(56, 189, 248, 0.15);
                    padding: 8px;
                    border-radius: 6px;
                    margin-bottom: 12px;
                }
                .speech-vis-panel {
                    background: rgba(0, 0, 0, 0.5);
                    border: 1px solid rgba(167, 139, 250, 0.3);
                    padding: 8px;
                    border-radius: 6px;
                    font-size: 10px;
                    margin-bottom: 12px;
                    text-align: center;
                }
                .voice-indicator-bar {
                    font-size: 11px;
                    color: #a78bfa;
                    text-shadow: 0 0 6px rgba(167, 139, 250, 0.6);
                    letter-spacing: 2px;
                }
                .device-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    background: rgba(0, 0, 0, 0.4);
                    border: 1px solid rgba(56, 189, 248, 0.15);
                    padding: 8px;
                    border-radius: 6px;
                    margin-bottom: 12px;
                    font-size: 10px;
                }
                .device-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 4px 2px;
                    border-bottom: 1px dashed rgba(255, 255, 255, 0.05);
                }
                .toggle-badge {
                    font-size: 9px;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .toggle-badge.on {
                    background: rgba(34, 197, 94, 0.15);
                    color: #22c55e;
                    border: 1px solid #22c55e;
                    text-shadow: 0 0 6px rgba(34, 197, 94, 0.5);
                }
                .toggle-badge.off {
                    background: rgba(239, 68, 68, 0.15);
                    color: #ef4444;
                    border: 1px solid #ef4444;
                }
                .log-panel {
                    height: 80px;
                    overflow-y: auto;
                    background: rgba(0, 0, 0, 0.6);
                    border: 1px solid rgba(56, 189, 248, 0.2);
                    padding: 6px;
                    border-radius: 6px;
                    font-size: 9px;
                    line-height: 1.4;
                    color: #38bdf8;
                    margin-bottom: 12px;
                    word-break: break-all;
                }
                .input-row {
                    display: flex;
                    gap: 6px;
                }
                .neon-input {
                    flex-grow: 1;
                    background: rgba(0, 0, 0, 0.8);
                    border: 1px solid rgba(56, 189, 248, 0.4);
                    color: #e2e8f0;
                    border-radius: 6px;
                    padding: 6px 10px;
                    font-size: 10px;
                    font-family: inherit;
                    outline: none;
                    box-shadow: inset 0 0 4px rgba(56, 189, 248, 0.2);
                    user-select: text !important;
                    -webkit-user-select: text !important;
                }
                .neon-btn {
                    background: rgba(56, 189, 248, 0.12);
                    border: 1px solid rgba(56, 189, 248, 0.5);
                    color: #38bdf8;
                    padding: 4px 10px;
                    border-radius: 6px;
                    font-size: 10px;
                    cursor: pointer;
                    font-family: inherit;
                    transition: all 0.2s ease;
                }
                .neon-btn:hover {
                    background: rgba(56, 189, 248, 0.25);
                    box-shadow: 0 0 8px rgba(56, 189, 248, 0.4);
                }
                .control-action-bar {
                    display: flex;
                    justify-content: space-between;
                    font-size: 9px;
                    color: #94a3b8;
                    margin-top: 10px;
                    padding-top: 6px;
                    border-top: 1px solid rgba(56, 189, 248, 0.2);
                }
                .action-link {
                    cursor: pointer;
                    transition: color 0.2s ease;
                }
                .action-link:hover {
                    color: #38bdf8;
                    text-shadow: 0 0 4px rgba(56, 189, 248, 0.5);
                }
                .settings-gui-panel {
                    display: none;
                    background: rgba(0, 0, 0, 0.8);
                    border: 1px solid rgba(167, 139, 250, 0.4);
                    border-radius: 6px;
                    padding: 10px;
                    margin-top: 10px;
                    max-height: 180px;
                    overflow-y: auto;
                    font-size: 9px;
                }
                .schedule-gui-panel {
                    display: none;
                    background: rgba(0, 0, 0, 0.8);
                    border: 1px solid rgba(56, 189, 248, 0.4);
                    border-radius: 6px;
                    padding: 10px;
                    margin-top: 10px;
                    max-height: 220px;
                    overflow-y: auto;
                    font-size: 9px;
                }
                .sched-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 6px;
                    margin-bottom: 8px;
                    border-bottom: 1px dashed rgba(255, 255, 255, 0.05);
                    padding-bottom: 6px;
                }
                .cfg-row {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                    margin-bottom: 8px;
                    border-bottom: 1px dashed rgba(255, 255, 255, 0.05);
                    padding-bottom: 6px;
                }
                .cfg-input {
                    background: rgba(0,0,0,0.8);
                    border: 1px solid rgba(167, 139, 250, 0.3);
                    color: #fff;
                    font-size: 9px;
                    padding: 3px 5px;
                    border-radius: 4px;
                    outline: none;
                    font-family: inherit;
                    user-select: text !important;
                    -webkit-user-select: text !important;
                }
                @keyframes blink {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 1; }
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-3px); }
                }

                @media (max-width: 540px) {
                    .mr-chod-widget {
                        bottom: 16px !important;
                        right: 16px !important;
                        left: 16px !important;
                        width: calc(100% - 32px) !important;
                        max-width: none !important;
                        padding: 14px !important;
                    }
                    .mr-chod-widget.large {
                        width: calc(100% - 32px) !important;
                    }
                    .mr-chod-widget.minimized {
                        width: calc(100% - 32px) !important;
                    }
                    .mr-chod-title {
                        font-size: 11px;
                    }
                    .panel-title {
                        font-size: 11px;
                        margin-bottom: 8px;
                    }
                    .status-grid {
                        grid-template-columns: 1fr;
                        gap: 8px;
                        padding: 10px;
                    }
                    .status-text {
                        font-size: 11px;
                    }
                    .speech-vis-panel {
                        padding: 12px;
                        font-size: 11px;
                    }
                    .device-grid {
                        padding: 10px;
                        gap: 10px;
                    }
                    .device-row {
                        font-size: 11px;
                        padding: 6px 2px;
                    }
                    .toggle-badge {
                        font-size: 11px;
                        padding: 6px 14px;
                        border-radius: 6px;
                    }
                    .log-panel {
                        height: 90px;
                        font-size: 11px;
                        padding: 8px;
                    }
                    .neon-input {
                        padding: 10px 12px;
                        font-size: 12px;
                    }
                    .neon-btn {
                        padding: 8px 14px;
                        font-size: 12px;
                    }
                    .control-action-bar {
                        font-size: 11px;
                        padding-top: 10px;
                    }
                    .settings-gui-panel {
                        max-height: 280px !important;
                    }
                    .settings-gui-panel .cfg-row > div {
                        display: flex !important;
                        flex-direction: column !important;
                        gap: 6px !important;
                    }
                    .settings-gui-panel .cfg-input {
                        width: 100% !important;
                        padding: 8px 10px !important;
                        font-size: 12px !important;
                    }
                    .schedule-gui-panel {
                        max-height: 280px !important;
                    }
                    .schedule-gui-panel .sched-row {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                        gap: 8px !important;
                        padding-bottom: 10px !important;
                    }
                    .schedule-gui-panel .sched-row > div:first-child {
                        width: 100% !important;
                    }
                    .schedule-gui-panel .sched-row > div:last-child {
                        width: 100% !important;
                        justify-content: flex-start !important;
                        gap: 10px !important;
                    }
                    .schedule-gui-panel .cfg-input {
                        width: 85px !important;
                        padding: 6px 10px !important;
                        font-size: 12px !important;
                    }
                }
            `;
            document.head.appendChild(style);

            const widget = document.createElement("div");
            widget.id = "mr-chod-butler-widget";
            widget.className = "mr-chod-widget";

            widget.innerHTML = `
                <div class="mr-chod-header" id="mrChodHeader">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 14px; animation: float 2s infinite ease-in-out;">🤖</span>
                        <span class="mr-chod-title">MR. CHOD AI BUTLER CORE</span>
                    </div>
                    <span id="mrChodMinBtn" style="cursor: pointer; color: #38bdf8; font-size: 9px;">[ ซ่อน ]</span>
                </div>
                <div id="mr-chod-body">
                    
                    <!-- SYSTEM STATUS PANEL -->
                    <div class="panel-title">🟢 SYSTEM STATUS</div>
                    <div class="status-grid">
                        <div class="status-text"><span class="status-led"></span> AI CORE: ONLINE</div>
                        <div class="status-text"><span class="status-led"></span> TG NOTIFY: ARMED</div>
                        <div class="status-text"><span class="status-led"></span> MEMORY: ACTIVE</div>
                        <div class="status-text"><span class="status-led"></span> NETWORK: CONNECTED</div>
                    </div>

                    <!-- VOICE COMMAND PANEL -->
                    <div class="panel-title">🎙️ VOICE COMMAND (FUZZY MAPPED)</div>
                    <div class="speech-vis-panel">
                        <div id="voiceStatusText" style="color: #94a3b8; font-size: 9px; margin-bottom: 4px;">รอรับคำสั่ง...</div>
                        <div class="voice-indicator-bar" id="voiceVisBar">🎙️ ◉ ████</div>
                    </div>

                    <!-- SMART HOME DEVICE PANEL -->
                    <div class="panel-title">🏠 SMART HOME DEVICE</div>
                    <div class="device-grid" id="deviceGridContainer">
                        <!-- รายการรีเลย์จะถูกสร้างขึ้นแบบไดนามิก -->
                    </div>

                    <!-- COMMAND LOG PANEL -->
                    <div class="panel-title">💬 COMMAND LOG</div>
                    <div class="log-panel" id="mrChodLogPanel">
                        * คุณโชดพร้อมให้บริการด้วยระบบวิเคราะห์บริบทขั้นสูงและบอทเทเลแกรมแจ้งเตือนแล้วครับเจ้านาย
                    </div>

                    <!-- INPUT INTERACTION ROW -->
                    <div class="input-row">
                        <input type="text" id="mrChodInput" class="neon-input" placeholder="พิมพ์คำสั่งเพื่อส่งวิเคราะห์...">
                        <button id="mrChodSendBtn" class="neon-btn">ส่ง</button>
                    </div>

                    <!-- FOOTER ACTION BAR -->
                    <div class="control-action-bar">
                        <span class="action-link" id="mrChodMicBtn">🎙️ [พูด]</span>
                        <span class="action-link" id="mrChodKeyboardBtn">⌨️ [พิมพ์]</span>
                        <span class="action-link" id="mrChodSettingsBtn">⚙️ [ตั้งค่า]</span>
                    </div>

                    <!-- SETTINGS PANEL (GUI) -->
                    <div id="mr-chod-settings" class="settings-gui-panel">
                        <div style="font-weight: bold; color: #a78bfa; border-bottom: 1px dashed rgba(167,139,250,0.5); padding-bottom: 4px; margin-bottom: 8px;">
                            ตั้งค่าสถานีควบคุม IoT
                        </div>
                        <div id="settingsContainer"></div>
                        
                        <!-- หน้าต่างแผงควบคุม Telegram สำหรับคำสั่งซ่อน/แสดง -->
                        <div id="tg-config-panel-inline" style="margin-top: 10px; border-top: 1px solid rgba(56, 189, 248, 0.2); padding-top: 8px;">
                            <div style="font-weight: bold; color: #38bdf8; margin-bottom: 6px;">✈️ การเชื่อมต่อ Telegram Bot</div>
                            <div id="tgSettingsContainer"></div>
                        </div>

                        <button id="mrChodSaveSettingsBtn" class="neon-btn" style="width: 100%; margin-top: 12px; border-color: rgba(34, 197, 94, 0.6); color: #22c55e; background: rgba(34,197,94,0.08);">บันทึกฐานข้อมูล</button>
                    </div>

                    <!-- SCHEDULE AUTOMATION PANEL -->
                    <div id="mr-chod-schedule" class="schedule-gui-panel">
                        <div style="font-weight: bold; color: #38bdf8; border-bottom: 1px dashed rgba(56,189,248,0.5); padding-bottom: 4px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                            <span>⏱️ ตารางตั้งเวลาทำงานอัตโนมัติ</span>
                            <span id="mrChodCloseScheduleBtn" style="cursor: pointer; color: #ef4444; font-size: 8px;">[ยกเลิก]</span>
                        </div>
                        <div id="scheduleContainer"></div>
                        <button id="mrChodSaveScheduleBtn" class="neon-btn" style="width: 100%; margin-top: 8px; border-color: rgba(56, 189, 248, 0.6); color: #38bdf8; background: rgba(56, 189, 248, 0.08);">บันทึกตารางเวลา</button>
                    </div>
                </div>
            `;
            document.body.appendChild(widget);

            this.widget = widget;
            this.logPanel = document.getElementById("mrChodLogPanel");
            this.input = document.getElementById("mrChodInput");
            this.micBtn = document.getElementById("mrChodMicBtn");
            this.sendBtn = document.getElementById("mrChodSendBtn");
            this.minBtn = document.getElementById("mrChodMinBtn");
            this.settingsBtn = document.getElementById("mrChodSettingsBtn");
            this.settingsPanel = document.getElementById("mr-chod-settings");
            this.saveSettingsBtn = document.getElementById("mrChodSaveSettingsBtn");
            this.keyboardBtn = document.getElementById("mrChodKeyboardBtn");
            this.voiceStatusText = document.getElementById("voiceStatusText");
            this.voiceVisBar = document.getElementById("voiceVisBar");

            this.schedulePanel = document.getElementById("mr-chod-schedule");
            this.saveScheduleBtn = document.getElementById("mrChodSaveScheduleBtn");
            this.closeScheduleBtn = document.getElementById("mrChodCloseScheduleBtn");

            this.bindEvents();
            this.renderDeviceList();
            this.buildSettingsForm();
        }

        bindEvents() {
            this.sendBtn.addEventListener("click", () => this.handleTextInteraction());
            this.input.addEventListener("keypress", (e) => {
                if (e.key === 'Enter') this.handleTextInteraction();
            });

            this.minBtn.addEventListener("click", () => {
                this.widget.classList.toggle("minimized");
                this.minBtn.innerText = this.widget.classList.contains("minimized") ? "[ แสดง ]" : "[ ซ่อน ]";
            });

            this.settingsBtn.addEventListener("click", () => {
                const currentDisplay = window.getComputedStyle(this.settingsPanel).display;
                if (currentDisplay === "none") {
                    this.widget.classList.add("large");
                    this.settingsPanel.style.display = "block";
                    this.schedulePanel.style.display = "none";
                } else {
                    this.closeSettings();
                }
            });

            this.keyboardBtn.addEventListener("click", () => {
                this.input.focus();
            });

            this.saveSettingsBtn.addEventListener("click", () => this.saveSettingsFromGUI());
            this.saveScheduleBtn.addEventListener("click", () => this.saveScheduleFromGUI());
            this.closeScheduleBtn.addEventListener("click", () => this.closeSchedulePanel());
        }

        openLargeSettings() {
            this.widget.classList.add("large");
            this.settingsPanel.style.display = "block";
            this.schedulePanel.style.display = "none";
        }

        openSchedulePanel() {
            this.buildScheduleForm();
            this.widget.classList.add("large");
            this.schedulePanel.style.display = "block";
            this.settingsPanel.style.display = "none";
        }

        closeSchedulePanel() {
            this.widget.classList.remove("large");
            this.schedulePanel.style.display = "none";
        }

        closeSettings() {
            this.widget.classList.remove("large");
            this.settingsPanel.style.display = "none";
            this.schedulePanel.style.display = "none";
        }

        renderDeviceList() {
            const container = document.getElementById("deviceGridContainer");
            container.innerHTML = "";
            const relays = this.settingsManager.config.relays;
            const states = this.iotController.relayStates;

            for (const [id, info] of Object.entries(relays)) {
                const row = document.createElement("div");
                row.className = "device-row";
                const isActivated = states[id] || false;

                let emoji = "🔌";
                if (info.name.includes("ไฟ")) emoji = "💡";
                else if (info.name.includes("มอเตอร์") || info.name.includes("ปั๊ม") || info.name.includes("น้ำ")) emoji = "💧";
                else if (info.name.includes("อากาศ") || info.name.includes("พัดลม")) emoji = "🌬️";
                else if (info.name.includes("สวน") || info.name.includes("ต้นไม้")) emoji = "🌱";

                row.innerHTML = `
                    <div>${emoji} RELAY 0${id} <span style="color: #94a3b8; font-size: 9px; margin-left: 6px;">${info.name}</span></div>
                    <span class="toggle-badge ${isActivated ? 'on' : 'off'}" id="badge-relay-${id}">
                        ${isActivated ? '[ ON ]' : '[ OFF ]'}
                    </span>
                `;
                container.appendChild(row);

                const badge = document.getElementById(`badge-relay-${id}`);
                badge.addEventListener("click", () => {
                    const currentState = this.iotController.relayStates[id];
                    const nextState = !currentState;
                    
                    this.iotController.executeCommand(id, nextState);
                    this.appendLog(`> สลับสถานะ ${info.name}`);
                    this.appendLog(`AI : สั่งงาน ${info.name} ให้ทำงานเรียบร้อยแล้วครับ`);
                });
            }
        }

        syncRelayVisualState(relayId, state) {
            const badge = document.getElementById(`badge-relay-${relayId}`);
            if (badge) {
                if (state) {
                    badge.className = "toggle-badge on";
                    badge.innerText = "[ ON ]";
                } else {
                    badge.className = "toggle-badge off";
                    badge.innerText = "[ OFF ]";
                }
            }
        }

        appendLog(text) {
            const line = document.createElement("div");
            line.innerText = text;
            this.logPanel.appendChild(line);
            this.logPanel.scrollTop = this.logPanel.scrollHeight;
        }

        buildSettingsForm() {
            const container = document.getElementById("settingsContainer");
            container.innerHTML = "";
            const relays = this.settingsManager.config.relays;

            for (const [id, info] of Object.entries(relays)) {
                const row = document.createElement("div");
                row.className = "cfg-row";
                row.innerHTML = `
                    <div style="font-weight: bold; color: #a78bfa;">รีเลย์ช่องที่ ${id}</div>
                    <div style="display: flex; gap: 4px;">
                        <input type="text" id="cfg-name-${id}" class="cfg-input" placeholder="ชื่อ" value="${info.name}" style="width: 30%;">
                        <input type="text" id="cfg-on-${id}" class="cfg-input" placeholder="URL เปิด" value="${info.on}" style="width: 35%;">
                        <input type="text" id="cfg-off-${id}" class="cfg-input" placeholder="URL ปิด" value="${info.off}" style="width: 35%;">
                    </div>
                `;
                container.appendChild(row);
            }

            const tgContainer = document.getElementById("tgSettingsContainer");
            if (tgContainer) {
                tgContainer.innerHTML = "";
                const tg = this.settingsManager.config.telegram || { enabled: false, botToken: "", chatId: "" };
                const tgRow = document.createElement("div");
                tgRow.className = "cfg-row";
                tgRow.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                        <input type="checkbox" id="cfg-tg-enabled" ${tg.enabled ? 'checked' : ''} style="cursor: pointer;">
                        <span style="color: #e2e8f0; font-size: 9px;">เปิดใช้งานส่งการแจ้งเตือน (Notification Enabled)</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <input type="text" id="cfg-tg-token" class="cfg-input" placeholder="Telegram Bot Token (จาก BotFather)" value="${tg.botToken}" style="width: 100%;">
                        <input type="text" id="cfg-tg-chatid" class="cfg-input" placeholder="Telegram Chat ID (ไอดีของคุณหรือกลุ่ม)" value="${tg.chatId}" style="width: 100%;">
                    </div>
                `;
                tgContainer.appendChild(tgRow);
            }
        }

        buildScheduleForm() {
            const container = document.getElementById("scheduleContainer");
            container.innerHTML = "";
            const relays = this.settingsManager.config.relays;
            const schedules = this.settingsManager.config.schedules;

            for (const [id, info] of Object.entries(relays)) {
                const sched = schedules[id] || { enabled: false, onTime: "", offTime: "" };
                const row = document.createElement("div");
                row.className = "sched-row";
                row.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 6px; width: 35%;">
                        <input type="checkbox" id="sched-enable-${id}" ${sched.enabled ? 'checked' : ''} style="cursor: pointer;">
                        <span style="font-weight: bold; color: #e2e8f0; font-size: 9px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${info.name}">${info.name}</span>
                    </div>
                    <div style="display: flex; gap: 6px; width: 65%; justify-content: flex-end; align-items: center;">
                        <span style="color: #94a3b8; font-size: 8px;">เปิด:</span>
                        <input type="time" id="sched-on-${id}" class="cfg-input" value="${sched.onTime || ''}" style="width: 65px; text-align: center; color: #22c55e; border-color: rgba(34, 197, 94, 0.4);">
                        <span style="color: #94a3b8; font-size: 8px;">ปืด:</span>
                        <input type="time" id="sched-off-${id}" class="cfg-input" value="${sched.offTime || ''}" style="width: 65px; text-align: center; color: #ef4444; border-color: rgba(239, 68, 68, 0.4);">
                    </div>
                `;
                container.appendChild(row);
            }
        }

        saveSettingsFromGUI() {
            const newConfig = { ...this.settingsManager.config };
            const relays = newConfig.relays;

            for (const id of Object.keys(relays)) {
                relays[id].name = document.getElementById(`cfg-name-${id}`).value.trim();
                relays[id].on = document.getElementById(`cfg-on-${id}`).value.trim();
                relays[id].off = document.getElementById(`cfg-off-${id}`).value.trim();
            }

            newConfig.telegram = {
                enabled: document.getElementById("cfg-tg-enabled").checked,
                botToken: document.getElementById("cfg-tg-token").value.trim(),
                chatId: document.getElementById("cfg-tg-chatid").value.trim()
            };

            localStorage.setItem("MR_CHOD_TG_BOT_TOKEN", newConfig.telegram.botToken);
            localStorage.setItem("MR_CHOD_TG_CHAT_ID", newConfig.telegram.chatId);

            if (this.settingsManager.saveConfig(newConfig)) {
                this.closeSettings();
                this.renderDeviceList();
                this.buildSettingsForm();
                
                const reply = "ปรับปรุงฐานข้อมูลคอมฟิกควบคุมอุปกรณ์และระบบ Telegram สำเร็จและย่อหน้าจอกลับสู่ขนาดเดิมแล้วครับเจ้านาย";
                this.appendLog(`AI : ${reply}`);
                this.speechEngine.speak(reply);
            } else {
                this.speechEngine.speak("เกิดข้อผิดพลาดในการบันทึกฐานข้อมูลครับเจ้านาย");
            }
        }

        saveScheduleFromGUI() {
            const newConfig = { 
                ...this.settingsManager.config,
                schedules: { ...this.settingsManager.config.schedules }
            };
            const schedules = newConfig.schedules;

            for (const id of Object.keys(newConfig.relays)) {
                schedules[id] = {
                    enabled: document.getElementById(`sched-enable-${id}`).checked,
                    onTime: document.getElementById(`sched-on-${id}`).value,
                    offTime: document.getElementById(`sched-off-${id}`).value
                };
            }

            if (this.settingsManager.saveConfig(newConfig)) {
                this.closeSchedulePanel();
                
                const reply = "ปรับเปลี่ยนตารางเวลาเปิดปิดอุปกรณ์ และย่อหน้าต่างกลับสู่ขนาดปกติแล้วครับเจ้านาย";
                this.appendLog(`AI : ${reply}`);
                this.speechEngine.speak(reply);
            } else {
                this.speechEngine.speak("เกิดข้อผิดพลาดในการบันทึกตารางเวลาอัตโนมัติครับเจ้านาย");
            }
        }

        handleTextInteraction() {
            const text = this.input.value.trim();
            if (!text) return;
            this.input.value = "";
            this.appendLog(`> ${text}`);
            this.processInteraction(text);
        }

        processInteraction(text) {
            const reply = this.intentParser.parseIntent(text);
            this.appendLog(`AI : ${reply}`);
            
            this.speechEngine.speak(reply, 
                () => {
                    this.voiceStatusText.innerText = "สังเคราะห์เสียง...";
                    this.voiceStatusText.style.color = "#a78bfa";
                }, 
                () => {
                    this.voiceStatusText.innerText = "รอรับคำสั่ง...";
                    this.voiceStatusText.style.color = "#94a3b8";
                }
            );
        }

        initSpeechRecognition() {
            const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRec) {
                this.micBtn.style.opacity = "0.5";
                this.micBtn.title = "เบราว์เซอร์ไม่รองรับการรู้จำเสียง";
                return;
            }

            this.butlerRec = new SpeechRec();
            this.butlerRec.continuous = false;
            this.butlerRec.interimResults = false;
            this.butlerRec.lang = 'th-TH';

            this.butlerRec.onstart = () => {
                this.isListening = true;
                this.voiceStatusText.innerText = "กำลังรับฟังคำสั่ง...";
                this.voiceStatusText.style.color = "#ef4444";
                this.voiceVisBar.innerText = "🎙️ ◉ ████████";
                this.voiceVisBar.style.color = "#ef4444";
            };

            this.butlerRec.onend = () => {
                this.isListening = false;
                this.voiceStatusText.innerText = "รอรับคำสั่ง...";
                this.voiceStatusText.style.color = "#94a3b8";
                this.voiceVisBar.innerText = "🎙️ ◉ ████";
                this.voiceVisBar.style.color = "#a78bfa";
            };

            this.butlerRec.onresult = (event) => {
                const speechText = event.results[0][0].transcript.trim();
                this.appendLog(`> ${speechText}`);
                this.processInteraction(speechText);
            };

            this.butlerRec.onerror = (e) => {
                console.error("[Speech Recognition Error]:", e.error);
                if (this.butlerRec) this.butlerRec.stop();
            };

            this.micBtn.addEventListener("click", () => {
                if (this.isListening) {
                    this.butlerRec.stop();
                } else {
                    try {
                        this.butlerRec.start();
                    } catch (e) {
                        console.error("เริ่มใช้งานโมดูลรับเสียงผิดพลาด:", e);
                    }
                }
            });
        }

        initDraggable() {
            const elmnt = this.widget;
            const header = document.getElementById("mrChodHeader");
            if (!elmnt || !header) return;

            let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
            let originalTransition = "";

            header.addEventListener('mousedown', dragMouseDown);
            header.addEventListener('touchstart', dragTouchStart, { passive: false });

            function dragMouseDown(e) {
                if (e.target.id === 'mrChodMinBtn' || e.target.closest('#mrChodMinBtn')) return;
                
                e.preventDefault();

                const rect = elmnt.getBoundingClientRect();
                elmnt.style.top = rect.top + "px";
                elmnt.style.left = rect.left + "px";
                elmnt.style.bottom = "auto";
                elmnt.style.right = "auto";

                pos3 = e.clientX;
                pos4 = e.clientY;
                
                originalTransition = elmnt.style.transition;
                elmnt.style.transition = 'none';

                document.addEventListener('mouseup', closeDragElement);
                document.addEventListener('mousemove', elementDrag);
            }

            function dragTouchStart(e) {
                if (e.target.id === 'mrChodMinBtn' || e.target.closest('#mrChodMinBtn')) return;

                const rect = elmnt.getBoundingClientRect();
                elmnt.style.top = rect.top + "px";
                elmnt.style.left = rect.left + "px";
                elmnt.style.bottom = "auto";
                elmnt.style.right = "auto";

                const touch = e.touches[0];
                pos3 = touch.clientX;
                pos4 = touch.clientY;

                originalTransition = elmnt.style.transition;
                elmnt.style.transition = 'none';

                document.addEventListener('touchend', closeDragElement);
                document.addEventListener('touchmove', elementTouchDrag, { passive: false });
            }

            function elementDrag(e) {
                e.preventDefault();
                pos1 = pos3 - e.clientX;
                pos2 = pos4 - e.clientY;
                pos3 = e.clientX;
                pos4 = e.clientY;
                
                elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
                elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
            }

            function elementTouchDrag(e) {
                e.preventDefault();
                const touch = e.touches[0];
                pos1 = pos3 - touch.clientX;
                pos2 = pos4 - touch.clientY;
                pos3 = touch.clientX;
                pos4 = touch.clientY;

                elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
                elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
            }

            function closeDragElement() {
                elmnt.style.transition = originalTransition;
                document.removeEventListener('mouseup', closeDragElement);
                document.removeEventListener('mousemove', elementDrag);
                document.removeEventListener('touchend', closeDragElement);
                document.removeEventListener('touchmove', elementTouchDrag);
            }
        }
    }

    // ==============================================================================================
    //  7. ส่วนรวมโมดูลโทรเลขเชื่อมต่อระบบแกนหลัก (Telegram Integration Extension Inside Core)
    // ==============================================================================================

    function escapeHTML(text) {
        if (typeof text !== "string") return "";
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    async function sendTelegramMessage(text) {
        const sm = window.MrChodButlerInstance?.settingsManager;
        if (!sm) return;
        const tg = sm.config.telegram;
        if (!tg || !tg.enabled || !tg.botToken || !tg.chatId) return;

        const url = `https://api.telegram.org/bot${tg.botToken}/sendMessage`;
        try {
            await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: tg.chatId,
                    text: text,
                    parse_mode: "HTML"
                })
            });
        } catch (e) {
            console.error("[Telegram] ส่งข้อความล้มเหลว:", e);
        }
    }

    function saveConfigSafely() {
        const sm = window.MrChodButlerInstance?.settingsManager;
        if (!sm) return;
        sm.saveConfig(sm.config);
    }

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

            if (!config.relays[id] || config.relays[id].name !== schedInfo.name) {
                if (!config.relays[id]) config.relays[id] = {};
                config.relays[id].name = schedInfo.name;
                needsSave = true;
            }

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

    function parseSmartSchedule(text) {
        text = text.trim();
        const lower = text.toLowerCase();

        let action = 'view';
        if (ACTION_MAP.cancel.some(k => lower.includes(k))) action = 'cancel';
        else if (ACTION_MAP.set.some(k => lower.includes(k))) action = 'set';

        const timeRegex = /(?<!\d)([01]?\d|2[0-3])[:.]([0-5]\d)(?!\d)/g;
        const matches = [...text.matchAll(timeRegex)];
        let times = matches.map(m => `${m[1].padStart(2,'0')}:${m[2]}`);

        const rangeRegex = /([01]?\d|2[0-3])[:.]([0-5]\d)\s*[-–—]\s*([01]?\d|2[0-3])[:.]([0-5]\d)/;
        const rangeMatch = text.match(rangeRegex);
        if (rangeMatch) {
            times = [
                `${rangeMatch[1].padStart(2,'0')}:${rangeMatch[2]}`,
                `${rangeMatch[3].padStart(2,'0')}:${rangeMatch[4]}`
            ];
        }

        let days = [];
        const dayKeys = Object.keys(DAY_MAP).sort((a,b) => b.length - a.length);
        for (const key of dayKeys) {
            if (lower.includes(key)) {
                days.push(DAY_MAP[key]);
            }
        }
        if (days.length === 0 || lower.includes('ทุก') || lower.includes('daily') || lower.includes('เสมอ')) {
            days = [0, 1, 2, 3, 4, 5, 6];
        }
        days = [...new Set(days)].sort((a,b) => a - b);

        let deviceQuery = text;
        const allActionKeywords = [...ACTION_MAP.set, ...ACTION_MAP.cancel, ...ACTION_MAP.view];
        for (const kw of allActionKeywords) {
            deviceQuery = deviceQuery.replace(new RegExp(kw, 'gi'), '');
        }
        for (const t of times) {
            deviceQuery = deviceQuery.replace(new RegExp(t.replace(':', '[:.]'), 'g'), '');
        }
        for (const key of dayKeys) {
            deviceQuery = deviceQuery.replace(new RegExp(key, 'gi'), '');
        }
        deviceQuery = deviceQuery.replace(/[^a-zA-Z0-9ก-๙\s]/g, ' ').trim();

        return {
            action: action,
            deviceQuery: deviceQuery,
            times: times,
            days: days
        };
    }

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

    function isOverlapping(rules, newRule) {
        if (!newRule.onTime || !newRule.offTime) return false;
        const newStart = newRule.onTime;
        const newEnd = newRule.offTime;
        
        for (const rule of rules) {
            if (!rule.active) continue;
            if (!rule.onTime || !rule.offTime) continue;
            const commonDays = rule.days.filter(d => newRule.days.includes(d));
            if (commonDays.length === 0) continue;
            
            if (newStart < rule.offTime && newEnd > rule.onTime) {
                return true;
            }
        }
        return false;
    }

    async function handleScheduleCommand(text) {
        const config = window.MrChodButlerInstance?.settingsManager?.config;
        if (!config) return "❌ ไม่พบการตั้งค่าระบบแกนหลักครับเจ้านาย";

        const parsed = parseSmartSchedule(text);
        if (!parsed.deviceQuery) {
            return "❌ ไม่พบชื่อหรือหมายเลขอุปกรณ์ที่ต้องการจัดการครับ กรุณาระบุให้ชัดเจน (เช่น 'ตั้งเวลา ไฟหน้าคอม 08:00-17:00')";
        }

        const relayId = findRelayIdByQuery(parsed.deviceQuery, config);
        if (!relayId) {
            return `❌ ไม่พบอุปกรณ์ "${escapeHTML(parsed.deviceQuery)}" ในระบบครับ กรุณาตรวจสอบชื่อหรือเลขรีเลย์ (1-6)`;
        }

        if (PERMANENT_SCHEDULES[relayId]) {
            const perm = PERMANENT_SCHEDULES[relayId];
            return `⚠️ <b>${escapeHTML(perm.name)}</b> เป็นระบบตารางถาวร (เปิด ${perm.onTime} / ปิด ${perm.offTime}) ไม่สามารถแก้ไขหรือลบตารางได้ครับ`;
        }

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

        if (parsed.action === 'cancel') {
            schedule.rules = [];
            schedule.enabled = false;
            schedule.onTime = "";
            schedule.offTime = "";
            saveConfigSafely();
            return `✅ ยกเลิกการตั้งเวลาทั้งหมดของ <b>${escapeHTML(relayName)}</b> เรียบร้อยแล้วครับ`;
        }

        if (parsed.action === 'view') {
            if (schedule.rules.length === 0 || !schedule.enabled) {
                return `📋 <b>${escapeHTML(relayName)}</b>: ไม่มีกฎการตั้งเวลาที่ใช้งานอยู่ครับ`;
            }
            let msg = `📋 <b>${escapeHTML(relayName)}</b> มีกฎทั้งหมด ${schedule.rules.length} รายการ:\n`;
            schedule.rules.forEach((rule, idx) => {
                msg += `\n${idx+1}. ${escapeHTML(formatSmartRule(rule))}`;
            });
            return msg;
        }

        if (parsed.times.length === 0) {
            return "❌ ไม่พบเวลาที่ต้องการตั้งครับ (เช่น เปิด 08:00 หรือ 08:00-17:00)";
        }

        let onTime = null;
        let offTime = null;

        if (parsed.times.length === 1) {
            const idxOn = text.toLowerCase().indexOf('เปิด');
            const idxOff = text.toLowerCase().indexOf('ปิด');
            if (idxOn !== -1 && (idxOff === -1 || idxOn < idxOff)) {
                onTime = parsed.times[0];
            } else if (idxOff !== -1 && (idxOn === -1 || idxOff < idxOn)) {
                offTime = parsed.times[0];
            } else {
                onTime = parsed.times[0];
            }
        } else if (parsed.times.length >= 2) {
            onTime = parsed.times[0];
            offTime = parsed.times[1];
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

        if (schedule.rules.length > 0 && isOverlapping(schedule.rules, newRule)) {
            return `⚠️ พบว่ากฎนี้ซ้อนทับกับกฎเดิมของ <b>${escapeHTML(relayName)}</b>!\n` +
                   `📌 กฎใหม่: ${escapeHTML(formatSmartRule(newRule))}\n` +
                   `💡 ระบบจะ <b>เพิ่มกฎใหม่</b> เข้าไป หากต้องการลบกฎเดิมทั้งหมดให้พิมพ์ "ยกเลิกตั้งเวลา ${escapeHTML(relayName)}" ก่อนนะครับ`;
        }

        schedule.rules.push(newRule);
        schedule.enabled = true;

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

    async function sendControlPanel() {
        const sm = window.MrChodButlerInstance?.settingsManager;
        if (!sm) return;
        const tg = sm.config.telegram;
        if (!tg || !tg.enabled || !tg.botToken || !tg.chatId) return;

        const url = `https://api.telegram.org/bot${tg.botToken}/sendMessage`;
        const payload = {
            chat_id: tg.chatId,
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

    async function updateControlPanel() {
        const sm = window.MrChodButlerInstance?.settingsManager;
        if (!sm) return;
        const tg = sm.config.telegram;
        if (!tg || !tg.enabled || !tg.botToken || !tg.chatId || !lastPanelMessageId) return;

        const url = `https://api.telegram.org/bot${tg.botToken}/editMessageReplyMarkup`;
        const payload = {
            chat_id: tg.chatId,
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
            // ละเว้นกรณีที่สถานะไม่มีการเปลี่ยน
        }
    }

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

    async function handleTelegramUpdate(update) {
        const sm = window.MrChodButlerInstance?.settingsManager;
        if (!sm) return;
        const tg = sm.config.telegram;
        if (!tg || !tg.enabled || !tg.botToken || !tg.chatId) return;

        const incomingChatId = String(update.message?.chat?.id || update.callback_query?.message?.chat?.id || "");
        if (incomingChatId !== String(tg.chatId)) {
            console.warn("[Telegram Security Warning] มีการพยายามควบคุมระบบจากภายนอกโดยไม่ได้รับอนุญาต:", incomingChatId);
            return;
        }

        if (update.callback_query) {
            const query = update.callback_query;
            const callbackData = query.data;
            const queryId = query.id;

            try {
                await fetch(`https://api.telegram.org/bot${tg.botToken}/answerCallbackQuery`, {
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

        if (update.message && update.message.text) {
            const rawText = update.message.text.trim();
            const lowerText = rawText.toLowerCase();

            if (lowerText.startsWith("/")) {
                if (lowerText === "/start" || lowerText === "/menu" || lowerText === "/help") {
                    await sendControlPanel();
                }
                return;
            }

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

            if (window.MrChodButlerInstance?.intentParser) {
                window.MrChodButlerInstance.appendLog(`> [Telegram Bot CMD] ${rawText}`);
                
                const replyResult = window.MrChodButlerInstance.intentParser.parseIntent(rawText);
                
                window.MrChodButlerInstance.appendLog(`AI : ${replyResult}`);
                window.MrChodButlerInstance.speechEngine?.speak?.(replyResult);

                await sendTelegramMessage(`🤖 <b>AI :</b> ${escapeHTML(replyResult)}`);
            }
        }
    }

    async function startPollingTelegram() {
        const sm = window.MrChodButlerInstance?.settingsManager;
        if (!sm) {
            isPollingActive = false;
            return;
        }
        const tg = sm.config.telegram;
        if (!tg || !tg.enabled || !tg.botToken || !tg.chatId) {
            isPollingActive = false;
            return;
        }

        isPollingActive = true;
        const currentSession = ++pollingSessionId;

        const url = `https://api.telegram.org/bot${tg.botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;
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
            
            if (isPollingActive && currentSession === pollingSessionId) {
                pollingTimeoutId = setTimeout(startPollingTelegram, 5000);
            }
            return;
        }
        
        if (isPollingActive && currentSession === pollingSessionId) {
            pollingTimeoutId = setTimeout(startPollingTelegram, 1000);
        }
    }

    function stopPollingTelegram() {
        isPollingActive = false;
        if (pollingTimeoutId) {
            clearTimeout(pollingTimeoutId);
            pollingTimeoutId = null;
        }
    }

    function checkRealtimeStateSync() {
        if (!window.MrChodButlerInstance?.iotController) return;
        const states = window.MrChodButlerInstance.iotController.relayStates;
        const currentHash = Object.entries(states).map(([id, val]) => `${id}:${val}`).join(",");
        
        if (currentHash !== lastStateHash) {
            lastStateHash = currentHash;
            updateControlPanel();
        }
    }

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
        
        const sm = window.MrChodButlerInstance?.settingsManager;
        const tg = sm ? sm.config.telegram : { botToken: "", chatId: "" };

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

        document.getElementById("tg-token-input").value = tg.botToken || "";
        document.getElementById("tg-chat-input").value = tg.chatId || "";

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
                const config = window.MrChodButlerInstance.settingsManager.config;
                config.telegram.botToken = tokenVal.trim();
                config.telegram.chatId = chatVal.trim();
                config.telegram.enabled = (tokenVal.trim() !== "" && chatVal.trim() !== "");
                saveConfigSafely();

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

    function bootstrapTelegramLink() {
        injectConfigurationUI();
        enforcePermanentSchedules();

        const sm = window.MrChodButlerInstance?.settingsManager;
        if (sm) {
            const tg = sm.config.telegram;
            if (tg && tg.botToken && tg.chatId) {
                sendControlPanel();
                startPollingTelegram();
            } else {
                window.MrChodButlerInstance.appendLog("⚠️ [Telegram Extension] กรุณาระบุ Token และ Chat ID เพื่อเริ่มต้นการเชื่อมต่อ");
            }
        }
        
        setInterval(checkRealtimeStateSync, 2000);
        window.MrChodButlerInstance.appendLog("🤖 [Mr. Chod Telegram Extension] ระบบโมดูลรีโมตสแตนด์บายพร้อมทำงาน!");
    }

    // ------------------------------------------------------------
    // 6. ส่วนควบคุมแกนกลางระบบและประมวลผลลำดับ (Global Initializer)
    // ------------------------------------------------------------
    function bootstrap() {
        const settings = new SettingsManager();
        const notifier = new TelegramNotifier(settings);
        const iot = new IoTController(settings, notifier);
        const speech = new SpeechEngine(settings);
        const parser = new IntentParser(settings, iot);
        
        window.MrChodButlerInstance = new ButlerUI(settings, speech, parser, iot);
        console.log("🤖 [Mr. Chod Butler] แกนระบบควบคุมเครือข่ายสำเร็จแล้ว!");

        // ผสานการทำงานโมดูลรีโมตควบคุมและบอทของ Telegram ต่อทันที
        bootstrapTelegramLink();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bootstrap);
    } else {
        bootstrap();
    }
})();
