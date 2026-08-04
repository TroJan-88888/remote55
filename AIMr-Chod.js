// ==============================================================================================
//    AI MR. CHOD BUTLER SYSTEM - HIGHLY COMPLEX MODULAR ENGINE (ENTERPRISE EDITION - MOBILE OK)
//    * คุณลักษณะพิเศษ: โครงสร้างแบบโมดูลาร์, มีระบบจำสถานะสนทนา, และตั้งค่าผ่าน GUI ได้ในตัว *
//    * อัปเดตปรับปรุง: ปรับสัดส่วน GUI, CSS Media Query และ Event Touch ให้แสดงผลสวยงามบนสมาร์ทโฟน 1080 x 1920 px *
//    * แก้ไขเพิ่มเติม: เปลี่ยนค่าเริ่มต้นอุปกรณ์รีเลย์ทั้งหมดเป็น OFF [false] พร้อมระบบจำสถานะผ่าน LocalStorage *
//    * ความสามารถใหม่: สั่ง "ไปพัก", "แยกย้าย", "พักผ่อน" เพื่อซ่อนหน้าต่างหลัก และสั่ง "กลับมา" เพื่อเรียกคืนแผงหน้าจอ *
//    * อัปเกรดระบบตรวจจับคำสั่ง: เพิ่มสถาปัตยกรรม Fuzzy Match ประมวลผลคำสั่งเสียงพูดผิด อักขระเพี้ยนก็สามารถทำงานได้ *
//    * ระบบเสริมล่าสุด: เพิ่มโมดูลแจ้งเตือนเข้า Telegram Bot อัตโนมัติ (Telegram Notifications) เมื่อสถานะอุปกรณ์เปลี่ยน *
//    * ฉบับปรับปรุงเพิ่มเติม: แก้ไขบักระบบตั้งเวลารายวัน, ป้องกันอาการกระตุกตอนคลิกลาก และจำกัดความยาวสายอักขระ Fuzzy Match *
// ==============================================================================================

(function() {
    'use strict';

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
                // ตารางตั้งเวลาเปิดปิดอัตโนมัติเริ่มต้นสำหรับทั้ง 6 รีเลย์
                schedules: {
                    1: { enabled: false, onTime: "", offTime: "" },
                    2: { enabled: false, onTime: "", offTime: "" },
                    3: { enabled: false, onTime: "", offTime: "" },
                    4: { enabled: false, onTime: "", offTime: "" },
                    5: { enabled: false, onTime: "", offTime: "" },
                    6: { enabled: false, onTime: "", offTime: "" }
                },
                // นำโครงสร้าง Telegram มารวบรวมจัดเก็บเพื่อให้ตั้งค่าง่ายขึ้น
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
                    // ตรวจเช็คเพื่อเติมโครงสร้างข้อมูลตารางเวลาและระบบเตือนหากยังไม่มี
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

        // จัดส่งข้อความไปยังช่องแชต/บอทตามพารามิเตอร์ที่เจ้านายตั้งค่าไว้
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
            // โหลดสถานะจำลองล่าสุดจากหน่วยความจำ หรือใช้ค่าเริ่มต้นปิดทั้งหมด [OFF]
            this.relayStates = this.loadRelayStates();
            this.lastTriggered = {}; // เก็บสถานะการถูกสั่งงานป้องกันการทำงานซ้ำในเวลาเดียวกัน
            this.startScheduler();
        }

        // ดึงความจำสถานะล่าสุดของอุปกรณ์
        loadRelayStates() {
            try {
                const stored = localStorage.getItem(this.stateStorageKey);
                if (stored) {
                    return JSON.parse(stored);
                }
            } catch (e) {
                console.error("[Butler IoT] ล้มเหลวในการอ่านสถานะรีเลย์เดิม:", e);
            }
            // ค่าเริ่มต้นปิดการเชื่อมต่อทั้งหมดเมื่อเริ่มใช้งานครั้งแรกสุด
            return { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false };
        }

        // บันทึกความจำสถานะของสวิตช์ลงหน่วยความจำบราวเซอร์
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

            // ปรับปรุงสถานะภายในและเก็บบันทึกลงหน่วยความจำถาวร
            this.relayStates[relayId] = state;
            this.saveRelayStates();
            
            // อัปเดตสถานะปุ่มกดบนหน้าจอแสดงผลหากเปิดทำงานอยู่
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
                
                // --- เพิ่มระบบส่งการแจ้งเตือนทาง Telegram อัตโนมัติ ---
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
                console.error(`[Butler IoT] สั่งงานอุปกรณ์ [${relay.name}] ล้มเหลว:`, err);
                return false;
            }
        }

        // ระบบจับเวลานาฬิกาเปรียบเทียบเบื้องหลังเพื่อดำเนินการควบคุมอัตโนมัติ
        startScheduler() {
            setInterval(() => {
                const now = new Date();
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                const currentTimeStr = `${hours}:${minutes}`;

                // นำข้อมูล วัน/เดือน/ปี มาร่วมสร้าง Key เพื่อระบุตัวตนการส่งคำสั่งของแต่ละวัน
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const date = String(now.getDate()).padStart(2, '0');
                const currentDateStr = `${year}-${month}-${date}`;
                const triggerKeyVal = `${currentDateStr} ${currentTimeStr}`; // เช่น "2026-08-04 12:34"

                const schedules = this.settingsManager.config.schedules;
                if (!schedules) return;

                for (const [id, sched] of Object.entries(schedules)) {
                    if (!sched.enabled) continue;

                    // ทำการสั่งเปิดเมื่อถึงเวลาที่กำหนด
                    const keyOn = `${id}-on`;
                    if (sched.onTime === currentTimeStr && this.lastTriggered[keyOn] !== triggerKeyVal) {
                        this.executeCommand(id, true);
                        this.lastTriggered[keyOn] = triggerKeyVal;
                        this.notifyScheduleTrigger(id, true);
                    }

                    // ทำการสั่งปิดเมื่อถึงเวลาที่กำหนด
                    const keyOff = `${id}-off`;
                    if (sched.offTime === currentTimeStr && this.lastTriggered[keyOff] !== triggerKeyVal) {
                        this.executeCommand(id, false);
                        this.lastTriggered[keyOff] = triggerKeyVal;
                        this.notifyScheduleTrigger(id, false);
                    }
                }
            }, 10000); // ทำงานตรวจเช็คอย่างสม่ำเสมอในทุก ๆ 10 วินาที
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
        // อัลกอริทึมวัดระยะห่างความต่างของสองข้อความ (Levenshtein Distance)
        static getLevenshteinDistance(a, b) {
            // จำกัดความยาวของอักขระที่ส่งเข้าเพื่อหลีกเลี่ยงกระบวนการคำนวณที่หนักหน่วงจนบราวเซอร์ค้าง (Main Thread Lock)
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
                            matrix[i - 1][j - 1] + 1, // แทนที่ตัวอักษร
                            matrix[i][j - 1] + 1,     // เพิ่มตัวอักษร
                            matrix[i - 1][j] + 1      // ลบตัวอักษร
                        );
                    }
                }
            }
            return matrix[cleanB.length][cleanA.length];
        }

        // แปลงผลระยะต่างเป็นเปอร์เซ็นต์ความคล้ายคลึงระหว่าง 0.0 ถึง 1.0
        static getSimilarity(a, b) {
            const maxLength = Math.max(a.length, b.length);
            if (maxLength === 0) return 1.0;
            return 1.0 - (this.getLevenshteinDistance(a, b) / maxLength);
        }

        // ค้นหาคำเป้าหมายแบบยืดหยุ่นในข้อความประโยคยาว ๆ (Sliding Window Fuzzy Matching)
        static fuzzyContains(text, target, baseThreshold = 0.65) {
            const cleanText = text.toLowerCase().trim();
            const cleanTarget = target.toLowerCase().trim();

            if (cleanText.includes(cleanTarget)) {
                return { match: true, score: 1.0 };
            }

            // คำสั่งสั้นมาก (เช่น <= 3 ตัวอักษร) จะปรับระดับความเข้มงวดป้องกันผลซ้ำซ้อน
            const threshold = cleanTarget.length <= 3 ? 0.82 : baseThreshold;

            let bestScore = 0;
            const targetLen = cleanTarget.length;
            if (targetLen === 0) return { match: false, score: 0 };

            // สแกนเปรียบเทียบขนาดคำช่วงสั้น +/- 1 ตัวอักษร
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

            // คลังกลุ่มคำคล้ายครอบคลุมสถานะเปิดและปิด เพื่อแก้ปัญหาระบบฟังคำสั่งคลาดเคลื่อน
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

            // คำสั่งลับพิเศษ: สั่ง "trojan" เพื่อทำลายความจำ (และคำสะกดเพี้ยนต่าง ๆ)
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

            // คำสั่งพิเศษ: สั่ง "ไปพัก" (Fuzzy-enabled)
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

            // คำสั่งพิเศษ: สั่ง "กลับมา" (Fuzzy-enabled)
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

            // คำสั่งพิเศษ: สั่ง "บัง" เพื่อปิดหน้าต่างการเชื่อมต่อ Telegram (Fuzzy-enabled)
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

            // คำสั่งพิเศษ: สั่ง "แสดงเทเลแกรม" (Fuzzy-enabled)
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

            // คำสั่งพิเศษ: แสดงเมนูการเพิ่ม/ตั้งค่าขนาดใหญ่ (Fuzzy-enabled)
            const settingWords = ["จะเพิ่ม", "เปิดตั้งค่า", "ตั้งค่า", "คอนฟิก", "เซ็ตติ้ง"];
            if (settingWords.some(w => FuzzyMatcher.fuzzyContains(cleanText, w, 0.7).match)) {
                if (window.MrChodButlerInstance) {
                    window.MrChodButlerInstance.openLargeSettings();
                }
                this.clearContext();
                return "กระผมดำเนินการเปิดหน้าตั้งค่าคอมฟิกเครือข่ายขนาดใหญ่ให้แล้วครับเจ้านาย สามารถกรอกรายละเอียดและตัวเลขได้ทันทีครับ";
            }

            // คำสั่งพิเศษ: พูดว่า "จะตั้งเวลา" เพื่อดึงแผงเวลาเปิด-ปิดอัตโนมัติ (Fuzzy-enabled)
            const scheduleWords = ["จะตั้งเวลา", "ตั้งเวลา", "เปิดตั้งเวลา", "ตารางเวลา", "สเกดดูล"];
            if (scheduleWords.some(w => FuzzyMatcher.fuzzyContains(cleanText, w, 0.7).match)) {
                if (window.MrChodButlerInstance) {
                    window.MrChodButlerInstance.openSchedulePanel();
                }
                this.clearContext();
                return "กระผมกางแผงตั้งเวลาการทำงานอัตโนมัติขยายขนาดใหญ่ให้แล้วครับเจ้านาย สามารถตั้งเวลาเปิดและปิดสำหรับอุปกรณ์แต่ละช่องได้สะดวกเลยครับ";
            }

            // คำสั่งพิเศษ: เปิดระบบทั้งหมด (Fuzzy-enabled)
            const openAllWords = ["เปิดทั้งหมด", "เปิดระบบทั้งหมด", "ออนทั้งหมด"];
            if (openAllWords.some(w => FuzzyMatcher.fuzzyContains(cleanText, w, 0.75).match)) {
                for (let i = 1; i <= 6; i++) {
                    this.iotController.executeCommand(i, true);
                }
                this.clearContext();
                return "กระผมสั่งเปิดอุปกรณ์รีเลย์ทั้งหมดในระบบให้เรียบร้อยแล้วครับเจ้านาย";
            }

            // คำสั่งพิเศษ: ปิดระบบทั้งหมด (Fuzzy-enabled)
            const closeAllWords = ["ปิดทั้งหมด", "ปิดระบบทั้งหมด", "ออฟทั้งหมด"];
            if (closeAllWords.some(w => FuzzyMatcher.fuzzyContains(cleanText, w, 0.75).match)) {
                for (let i = 1; i <= 6; i++) {
                    this.iotController.executeCommand(i, false);
                }
                this.clearContext();
                return "กระผมดำเนินการตัดการเชื่อมโยงและปิดระบบพลังงานทั้งหมดเรียบร้อยแล้วครับเจ้านาย";
            }

            // คำสั่งพิเศษ: สลับจอควบคุม (Fuzzy-enabled)
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

            // --------------------------------------------------------
            // ส่วนวิเคราะห์เปรียบเทียบชื่ออุปกรณ์ ด้วยโมเดล Fuzzy Matching
            // --------------------------------------------------------
            let matchedRelayId = null;
            let highestScore = 0;
            const relays = this.settingsManager.config.relays;

            for (const [id, info] of Object.entries(relays)) {
                // วิเคราะห์ระดับความคล้ายคลึงชื่ออุปกรณ์ในช่องสัญญาณต่างๆ (ใช้เกณฑ์ 0.6 สำหรับคำไทยยืดหยุ่น)
                const result = FuzzyMatcher.fuzzyContains(cleanText, info.name, 0.60);
                if (result.match && result.score > highestScore) {
                    highestScore = result.score;
                    matchedRelayId = parseInt(id);
                }
            }

            if (matchedRelayId) {
                // ค้นหาเจตนาสั่งการจากชุดคำพ้องเสียง/สะกดใกล้เคียงของ "เปิด" และ "ปิด"
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
                    // หากตรวจพบบทสนทนาระบุชื่อแต่อ่านเจตนาไม่ชัด จะส่งเข้าสู่ระบบยืนยัน
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
                /* สไตล์รองรับกรณีเปิดหน้าต่างตั้งค่าคอมฟิกหรือหน้าตารางตั้งเวลาขนาดใหญ่ */
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
                /* สไตล์ของแผงตั้งเวลาการทำงานอัตโนมัติ */
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

                /* ตกแต่งและปรับระดับเฟรมให้ยืดหยุ่นพอดีกับหน้าจอมือถือแนวตั้ง (เช่น 1080 x 1920 พิกเซล) */
                @media (max-width: 540px) {
                    .mr-chod-widget {
                        bottom: 16px !important;
                        right: 16px !important;
                        left: 16px !important;
                        width: calc(100% - 32px) !important; /* จัดแผงให้อยู่กึ่งกลางหน้าจอมือถือแนวตั้งอย่างสวยงาม */
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
                        grid-template-columns: 1fr; /* จัดวางสถานะของบอร์ดแบบแถวดิ่ง */
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
                        padding: 6px 14px; /* ขยายขนาดปุ่มเพื่อเพิ่มพื้นที่สำหรับการทัชสัมผัสบนสมาร์ทโฟน */
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

                    /* ดัดแปลงให้ช่องกรอกข้อมูลตั้งค่าของ GUI ซ้อนกันแนวดิ่งเพื่อให้กดพิมพ์ URL ได้สะดวกขึ้น */
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

                    /* ดัดแปลงให้ตารางตั้งเวลาซ้อนกันแนวดิ่งบนหน้าจอมือถือ */
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
                        <div id="tg-config-panel" style="margin-top: 10px; border-top: 1px solid rgba(56, 189, 248, 0.2); padding-top: 8px;">
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

            // ดึงข้อมูลอีลิเมนต์ตั้งเวลาเพิ่มเติม
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

            // ปรับปรุงให้กดปุ่มตั้งค่าเกียร์แล้วเปิดหน้าจอขยายใหญ่ (large) เพื่อให้ป้อน URL ได้สะดวกขึ้นทันที
            this.settingsBtn.addEventListener("click", () => {
                const currentDisplay = window.getComputedStyle(this.settingsPanel).display;
                if (currentDisplay === "none") {
                    this.widget.classList.add("large");
                    this.settingsPanel.style.display = "block";
                    this.schedulePanel.style.display = "none"; // ปิดหน้าต่างตารางเวลาไม่ให้ทับซ้อน
                } else {
                    this.closeSettings();
                }
            });

            this.keyboardBtn.addEventListener("click", () => {
                this.input.focus();
            });

            this.saveSettingsBtn.addEventListener("click", () => this.saveSettingsFromGUI());

            // บันทึกและยกเลิกของแผงตั้งเวลาเปิดปิดอัตโนมัติ
            this.saveScheduleBtn.addEventListener("click", () => this.saveScheduleFromGUI());
            this.closeScheduleBtn.addEventListener("click", () => this.closeSchedulePanel());
        }

        // ฟังก์ชันพิเศษสำหรับขยายหน้าต่างขนาดใหญ่ (รองรับการป้อนตัวเลขได้สะดวกขึ้น)
        openLargeSettings() {
            this.widget.classList.add("large");
            this.settingsPanel.style.display = "block";
            this.schedulePanel.style.display = "none";
        }

        // ฟังก์ชันพิเศษสำหรับเปิดแผงตารางตั้งเวลาเปิด-ปิดอัตโนมัติขยายขนาดใหญ่
        openSchedulePanel() {
            this.buildScheduleForm(); // สร้างฟอร์มเวลาขึ้นมาใหม่ดึงข้อมูลล่าสุด
            this.widget.classList.add("large");
            this.schedulePanel.style.display = "block";
            this.settingsPanel.style.display = "none";
        }

        // ฟังก์ชันย่อหน้าจอตารางตั้งเวลากลับสู่ขนาดดั้งเดิม
        closeSchedulePanel() {
            this.widget.classList.remove("large");
            this.schedulePanel.style.display = "none";
        }

        // ฟังก์ชันย่อหน้าจอกลับสู่ขนาดดั้งเดิมทั้งหมด
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

            // คัดเฉพาะคีย์ที่มีการลงทะเบียนไว้จาก Config
            for (const [id, info] of Object.entries(relays)) {
                const row = document.createElement("div");
                row.className = "device-row";
                const isActivated = states[id] || false;

                // กำหนดอิโมจิให้เข้ากับอุปกรณ์โดยอ้างอิงจากคีย์เวิร์ด
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

                // ดักจับเหตุการณ์คลิกเปิดปิดสวิตช์รีเลย์ผ่านหน้าจอโดยตรง
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

            // เรนเดอร์แผงข้อมูลการตั้งค่า Telegram
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

        // ฟังก์ชันสร้างหน้าตารางเวลาใน GUI แบบไดนามิก
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

            // บันทึกฟิลด์ข้อมูลการแจ้งเตือน Telegram
            newConfig.telegram = {
                enabled: document.getElementById("cfg-tg-enabled").checked,
                botToken: document.getElementById("cfg-tg-token").value.trim(),
                chatId: document.getElementById("cfg-tg-chatid").value.trim()
            };

            // อัปเดตตัวแปรระบบเดิมเพื่อรักษาระดับการทำงานร่วมกันแบบเดิม
            localStorage.setItem("MR_CHOD_TG_BOT_TOKEN", newConfig.telegram.botToken);
            localStorage.setItem("MR_CHOD_TG_CHAT_ID", newConfig.telegram.chatId);

            if (this.settingsManager.saveConfig(newConfig)) {
                this.closeSettings(); // เปลี่ยนกลับไปมีขนาดเดิมและซ่อนหน้าจอตั้งค่าสำเร็จ
                this.renderDeviceList();
                this.buildSettingsForm();
                
                const reply = "ปรับปรุงฐานข้อมูลคอมฟิกควบคุมอุปกรณ์และระบบ Telegram สำเร็จและย่อหน้าจอกลับสู่ขนาดเดิมแล้วครับเจ้านาย";
                this.appendLog(`AI : ${reply}`);
                this.speechEngine.speak(reply);
            } else {
                this.speechEngine.speak("เกิดข้อผิดพลาดในการบันทึกฐานข้อมูลครับเจ้านาย");
            }
        }

        // ฟังก์ชันประมวลผลการบันทึกข้อมูลตารางเวลาและคืนค่าหน้าต่างกลับขนาดปกติ
        saveScheduleFromGUI() {
            // ป้องกันปัญหาการบันทึกทับอ้างอิงตำแหน่งหน่วยความจำแบบ Shallow Copy
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
                this.closeSchedulePanel(); // คืนสภาพความกว้างและซ่อนแผงควบคุมตารางเวลา
                
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
                    // ปรับระดับสถานะ LED กระกริบแสดงคลื่นความถี่เสียง
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

        // ------------------------------------------------------------
        // เอนจินการลากแผงควบคุมอิสระ ปราศจากความขัดแย้งของ CSS Transition
        // ------------------------------------------------------------
        initDraggable() {
            const elmnt = this.widget;
            const header = document.getElementById("mrChodHeader");
            if (!elmnt || !header) return;

            let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
            let originalTransition = "";

            header.addEventListener('mousedown', dragMouseDown);
            header.addEventListener('touchstart', dragTouchStart, { passive: false });

            // ปรับปรุงแก้ไขบัก Draggable UI: ให้ข้ามและหลีกเลี่ยงเฉพาะปุ่มย่อหน้าต่างมินิเท่านั้น เพื่อให้ผู้ใช้สามารถคลิกลากตรงพาดหัวตัวหนังสือหรืออิโมจิได้สมบูรณ์
            function dragMouseDown(e) {
                if (e.target.id === 'mrChodMinBtn' || e.target.closest('#mrChodMinBtn')) return;
                
                e.preventDefault();

                // ปรับปรุง: ล็อคพิกัดสัมบูรณ์ของ UI ก่อนลาก ป้องกันอาการกระตุกดีดตัวในครั้งแรก
                const rect = elmnt.getBoundingClientRect();
                elmnt.style.top = rect.top + "px";
                elmnt.style.left = rect.left + "px";
                elmnt.style.bottom = "auto";
                elmnt.style.right = "auto";

                pos3 = e.clientX;
                pos4 = e.clientY;
                
                originalTransition = elmnt.style.transition;
                elmnt.style.transition = 'none'; // ปิดแอนิเมชันหน่วงชั่วคราวเพื่อให้ลากเมาส์ลื่นไหล

                document.addEventListener('mouseup', closeDragElement);
                document.addEventListener('mousemove', elementDrag);
            }

            function dragTouchStart(e) {
                if (e.target.id === 'mrChodMinBtn' || e.target.closest('#mrChodMinBtn')) return;

                // ปรับปรุง: ล็อคพิกัดสัมบูรณ์ของ UI สำหรับจอสัมผัส ป้องกันแผงดีดกระโดดข้ามจอ
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
                elmnt.style.transition = originalTransition; // คืนค่าแอนิเมชันหน่วงของเดิม
                document.removeEventListener('mouseup', closeDragElement);
                document.removeEventListener('mousemove', elementDrag);
                document.removeEventListener('touchend', closeDragElement);
                document.removeEventListener('touchmove', elementTouchDrag);
            }
        }
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
        
        console.log("🤖 [Mr. Chod Butler] แกนระบบควบคุมเครือข่ายและระบบยิงสัญญาณแจ้งเตือน Telegram สำเร็จแล้วครับเจ้านาย!");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bootstrap);
    } else {
        bootstrap();
    }
})();