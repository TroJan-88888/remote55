// ==============================================================================================
//  AIMr-Chod.js  AI MR. CHOD BUTLER SYSTEM - HIGHLY COMPLEX MODULAR ENGINE (ENTERPRISE EDITION - MOBILE OK)
//    * คุณลักษณะพิเศษ: โครงสร้างแบบโมดูลาร์, มีระบบจำสถานะสนทนา, และตั้งค่าผ่าน GUI ได้ในตัว *
//    * อัปเดตปรับปรุง: ปรับสัดส่วน GUI, CSS Media Query และ Event Touch ให้แสดงผลสวยงามบนสมาร์ทโฟน 1080 x 1920 px *
//    * แก้ไขเพิ่มเติม: เปลี่ยนค่าเริ่มต้นอุปกรณ์รีเลย์ทั้งหมดเป็น OFF [false] พร้อมระบบจำสถานะผ่าน LocalStorage *
//    * ความสามารถใหม่: สั่ง "ไปพัก", "แยกย้าย", "พักผ่อน" เพื่อซ่อนหน้าต่างหลัก และสั่ง "กลับมา" เพื่อเรียกคืนแผงหน้าจอ *
//    * แก้ไขไวยากรณ์: ซ่อมแซม Uncaught SyntaxError จุดเรียกฟังก์ชัน bootstrap บรรทัดสุดท้ายให้ถูกต้องสมบูรณ์ *
//    * อัปเกรดประสิทธิภาพสูงสุด: ป้องกันบัคนาฬิกาปลุกซ้ำซ้อน ยับยั้งคำสั่งชนกันบนบอร์ด IoT และเชื่อมต่อกับระบบกฎเวลาอัจฉริยะสากล *
//    * อัปเดตล่าสุด: เปลี่ยนระบบเวลาเป็น UTC+7 (เวลาโลก) เพื่อความแม่นยำและสากล *
// ==============================================================================================

(function() {
    'use strict';

    // ------------------------------------------------------------
    // 0. ฟังก์ชันช่วยจัดการเวลาแบบ UTC+7 (เวลาโลก - Bangkok Time)
    // ------------------------------------------------------------
    function getCurrentTimeUTC7() {
        const now = new Date();
        // แปลงเป็น UTC+7 (Bangkok / Indochina Time)
        const utc7Time = new Date(now.getTime() + (7 * 60 * 60 * 1000));
        return utc7Time;
    }

    function getTimeStringUTC7() {
        const now = getCurrentTimeUTC7();
        const hours = String(now.getUTCHours()).padStart(2, '0');
        const minutes = String(now.getUTCMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    function getDayUTC7() {
        const now = getCurrentTimeUTC7();
        return now.getUTCDay(); // 0 = อาทิตย์, 1 = จันทร์, ...
    }

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
                    1: { enabled: false, onTime: "", offTime: "", rules: [] },
                    2: { enabled: false, onTime: "", offTime: "", rules: [] },
                    3: { enabled: false, onTime: "", offTime: "", rules: [] },
                    4: { enabled: false, onTime: "", offTime: "", rules: [] },
                    5: { enabled: false, onTime: "", offTime: "", rules: [] },
                    6: { enabled: false, onTime: "", offTime: "", rules: [] }
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
                    for (let i = 1; i <= 6; i++) {
                        if (parsed.schedules[i] && !Array.isArray(parsed.schedules[i].rules)) {
                            parsed.schedules[i].rules = [];
                            if (parsed.schedules[i].onTime || parsed.schedules[i].offTime) {
                                parsed.schedules[i].rules.push({
                                    days: [0, 1, 2, 3, 4, 5, 6],
                                    onTime: parsed.schedules[i].onTime || null,
                                    offTime: parsed.schedules[i].offTime || null,
                                    active: parsed.schedules[i].enabled !== false
                                });
                            }
                        }
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
    // 2. ระบบส่งสัญญาณและจัดการเครือข่าย IoT (Network IoT Controller)
    // ------------------------------------------------------------
    class IoTController {
        constructor(settingsManager) {
            this.settingsManager = settingsManager;
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
                return true;
            } catch (err) {
                clearTimeout(timeoutId);
                console.error(`[Butler IoT] สั่งงานอุปกรณ์ [${relay.name}] ล้มเหลว:`, err);
                return false;
            }
        }

        startScheduler() {
            setInterval(() => {
                // ใช้เวลามาตรฐาน UTC+7 (เวลาโลก)
                const day = getDayUTC7();
                const currentTimeStr = getTimeStringUTC7();

                const schedules = this.settingsManager.config.schedules;
                if (!schedules) return;

                for (const [id, sched] of Object.entries(schedules)) {
                    if (!sched.enabled) continue;

                    let ruleMatched = false;

                    if (Array.isArray(sched.rules) && sched.rules.length > 0) {
                        sched.rules.forEach((rule, idx) => {
                            if (!rule.active) return;
                            
                            if (Array.isArray(rule.days) && !rule.days.includes(day)) return;

                            if (rule.onTime && rule.onTime === currentTimeStr) {
                                const keyOn = `${id}-rule-${idx}-on`;
                                if (this.lastTriggered[keyOn] !== currentTimeStr) {
                                    this.executeCommand(id, true);
                                    this.lastTriggered[keyOn] = currentTimeStr;
                                    this.notifyScheduleTrigger(id, true);
                                }
                                ruleMatched = true;
                            }

                            if (rule.offTime && rule.offTime === currentTimeStr) {
                                const keyOff = `${id}-rule-${idx}-off`;
                                if (this.lastTriggered[keyOff] !== currentTimeStr) {
                                    this.executeCommand(id, false);
                                    this.lastTriggered[keyOff] = currentTimeStr;
                                    this.notifyScheduleTrigger(id, false);
                                }
                                ruleMatched = true;
                            }
                        });
                    }

                    if (!ruleMatched && (sched.onTime || sched.offTime)) {
                        const keyOn = `${id}-on`;
                        if (sched.onTime === currentTimeStr && this.lastTriggered[keyOn] !== currentTimeStr) {
                            this.executeCommand(id, true);
                            this.lastTriggered[keyOn] = currentTimeStr;
                            this.notifyScheduleTrigger(id, true);
                        }

                        const keyOff = `${id}-off`;
                        if (sched.offTime === currentTimeStr && this.lastTriggered[keyOff] !== currentTimeStr) {
                            this.executeCommand(id, false);
                            this.lastTriggered[keyOff] = currentTimeStr;
                            this.notifyScheduleTrigger(id, false);
                        }
                    }
                }
            }, 10000); // ตรวจสอบทุก 10 วินาที
        }

        notifyScheduleTrigger(relayId, state) {
            const relay = this.settingsManager.config.relays[relayId];
            const name = relay ? relay.name : `อุปกรณ์ ${relayId}`;
            const currentTime = getTimeStringUTC7();
            const message = `[${currentTime}] แจ้งเตือนกำหนดเวลาอัตโนมัติ: ดำเนินการสั่ง ${state ? "เปิด" : "ปิด"}${name} เรียบร้อยแล้วครับ`;
            
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

            this.DAY_MAP = {
                'จันทร์': 1, 'จัน': 1, 'mon': 1, 'monday': 1,
                'อังคาร': 2, 'อัง': 2, 'tue': 2, 'tuesday': 2,
                'พุธ': 3, 'พ': 3, 'wed': 3, 'wednesday': 3,
                'พฤหัส': 4, 'พฤ': 4, 'thu': 4, 'thursday': 4,
                'ศุกร์': 5, 'ศ': 5, 'fri': 5, 'friday': 5,
                'เสาร์': 6, 'ส': 6, 'sat': 6, 'saturday': 6,
                'อาทิตย์': 0, 'อา': 0, 'sun': 0, 'sunday': 0
            };
        }

        clearContext() {
            this.context.waitingForConfirmation = false;
            this.context.targetRelayId = null;
            this.context.timestamp = 0;
        }

        parseSmartSchedule(text) {
            const lower = text.toLowerCase();
            let action = 'view';
            if (/(ยกเลิก|ลบ|ปิดใช้งาน|หยุด|clear|remove|delete)/.test(lower)) action = 'cancel';
            else if (/(ตั้งเวลา|ตั้ง|เพิ่มเวลา|กำหนด|set|add)/.test(lower)) action = 'set';

            const timeRegex = /([01]?\d|2[0-3])[:.]([0-5]\d)/g;
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
            const dayKeys = Object.keys(this.DAY_MAP).sort((a,b) => b.length - a.length);
            for (const key of dayKeys) {
                if (lower.includes(key)) {
                    days.push(this.DAY_MAP[key]);
                }
            }
            if (days.length === 0 || lower.includes('ทุก') || lower.includes('daily') || lower.includes('เสมอ')) {
                days = [0, 1, 2, 3, 4, 5, 6];
            }
            days = [...new Set(days)].sort((a,b) => a - b);

            let deviceQuery = text;
            const allKeywords = ['ตั้งเวลา', 'ตั้ง', 'เพิ่มเวลา', 'กำหนด', 'set', 'add', 'ยกเลิก', 'ลบ', 'ปิดใช้งาน', 'หยุด', 'clear', 'remove', 'delete', 'ดู', 'แสดง', 'รายงาน', 'เช็ค', 'มีอะไร', 'view', 'show', 'list'];
            for (const kw of allKeywords) {
                deviceQuery = deviceQuery.replace(new RegExp(kw, 'gi'), '');
            }
            for (const m of matches) {
                deviceQuery = deviceQuery.replace(m[0], '');
            }
            if (rangeMatch) {
                deviceQuery = deviceQuery.replace(rangeMatch[0], '');
            }
            for (const key of dayKeys) {
                deviceQuery = deviceQuery.replace(new RegExp(key, 'gi'), '');
            }
            deviceQuery = deviceQuery.replace(/[^a-zA-Z0-9ก-๙\s]/g, ' ').trim();

            return { action, deviceQuery, times, days };
        }

        handleScheduleCommand(text) {
            const config = this.settingsManager.config;
            const parsed = this.parseSmartSchedule(text);
            if (!parsed.deviceQuery) {
                return "ขออภัยครับเจ้านาย ไม่พบข้อมูลชื่ออุปกรณ์ที่ต้องการบริหารจัดการตารางเวลาครับ";
            }

            let relayId = null;
            const query = parsed.deviceQuery.trim().toLowerCase();
            const matchNum = query.match(/\b0*([1-6])\b/);
            
            if (matchNum) {
                relayId = parseInt(matchNum[1]);
            } else {
                for (const [id, r] of Object.entries(config.relays)) {
                    const name = r.name.toLowerCase();
                    if (query.includes(name) || name.includes(query)) {
                        relayId = parseInt(id);
                        break;
                    }
                }
            }

            if (!relayId) {
                return `ขออภัยครับเจ้านาย กระผมหาอุปกรณ์ชื่อ "${parsed.deviceQuery}" ในแผนผังไม่พบครับ`;
            }

            if (relayId === 2 && (parsed.action === 'set' || parsed.action === 'cancel')) {
                return "น้ำบ่อปลาถูกกำหนดเป็นตารางระบบแบบชีวภาพถาวร ไม่สามารถเปลี่ยนแปลงหรือระงับได้ครับเจ้านาย";
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
                        days: [0, 1, 2, 3, 4, 5, 6],
                        onTime: old.onTime || null,
                        offTime: old.offTime || null,
                        active: old.enabled !== false
                    });
                }
            }

            const schedule = config.schedules[relayId];
            const relayName = config.relays[relayId].name;

            if (parsed.action === 'cancel') {
                schedule.rules = [];
                schedule.enabled = false;
                schedule.onTime = "";
                schedule.offTime = "";
                this.settingsManager.saveConfig(config);
                if (window.MrChodButlerInstance) window.MrChodButlerInstance.renderDeviceList();
                return `กระผมดำเนินการยกเลิกและเคลียร์ตารางตั้งเวลาทำงานทั้งหมดของอุปกรณ์ ${relayName} ออกแล้วครับ`;
            }

            if (parsed.action === 'view') {
                if (schedule.rules.length === 0 || !schedule.enabled) {
                    return `ปัจจุบัน อุปกรณ์ ${relayName} ยังไม่มีการเปิดใช้หรือผูกเข้ากับตารางตั้งเวลาทำงานใด ๆ ครับเจ้านาย`;
                }
                const dayNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
                let report = `ตารางเวลาของ ${relayName} มีรายละเอียดดังนี้ครับเจ้านาย: `;
                schedule.rules.forEach((r, idx) => {
                    const daysStr = r.days.length === 7 ? 'ทุกวัน' : r.days.map(d => dayNames[d]).join(', ');
                    let timeStr = '';
                    if (r.onTime && r.offTime) timeStr = `ให้ทำการเปิดเวลา ${r.onTime} และปิดเวลา ${r.offTime}`;
                    else if (r.onTime) timeStr = `ให้ทำการเปิดเวลา ${r.onTime}`;
                    else if (r.offTime) timeStr = `ให้ทำการปิดเวลา ${r.offTime}`;
                    report += `รายการที่ ${idx+1} ทำงาน ${daysStr} ${timeStr}. `;
                });
                return report;
            }

            if (parsed.times.length === 0) {
                return "ขออภัยครับเจ้านาย กรุณาระบุค่าตัวเลขเวลาที่แน่นอนที่ประสงค์จะกำหนดตั้งลงไปในประโยคด้วยครับ";
            }

            let onTime = null;
            let offTime = null;
            if (parsed.times.length === 1) {
                const idxOn = text.indexOf('เปิด');
                const idxOff = text.indexOf('ปิด');
                if (idxOn !== -1 && (idxOff === -1 || idxOn < idxOff)) {
                    onTime = parsed.times[0];
                } else if (idxOff !== -1 && (idxOn === -1 || idxOff < idxOn)) {
                    offTime = parsed.times[0];
                } else {
                    onTime = parsed.times[0];
                }
            } else {
                onTime = parsed.times[0];
                offTime = parsed.times[1];
                const idxOn = text.indexOf('เปิด');
                const idxOff = text.indexOf('ปิด');
                if (idxOff !== -1 && idxOn !== -1 && idxOff < idxOn) {
                    [onTime, offTime] = [offTime, onTime];
                }
            }

            const newRule = {
                days: parsed.days,
                onTime: onTime,
                offTime: offTime,
                active: true
            };

            schedule.rules.push(newRule);
            schedule.enabled = true;
            schedule.onTime = onTime || "";
            schedule.offTime = offTime || "";

            this.settingsManager.saveConfig(config);
            if (window.MrChodButlerInstance) window.MrChodButlerInstance.renderDeviceList();

            const dayNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
            const daysStr = newRule.days.length === 7 ? 'ทุกวัน' : newRule.days.map(d => dayNames[d]).join(', ');
            let summary = `กระผมบันทึกตารางให้ ${relayName} สำเร็จแล้วครับ มีผลบังคับวัน ${daysStr} `;
            if (onTime) summary += `เปิดทำการเมื่อถึงเวลา ${onTime} `;
            if (offTime) summary += `และตัดไฟปิดการทำงานเวลา ${offTime} `;
            return summary + "เรียบร้อยแล้วครับเจ้านาย";
        }

        parseIntent(text) {
            const cleanText = text.trim().toLowerCase();
            const now = Date.now();

            if (this.context.waitingForConfirmation && (now - this.context.timestamp < 20000)) {
                const isActivate = cleanText.includes("เปิด") || cleanText.includes("on") || cleanText.includes("ใช่") || cleanText.includes("ตกลง");
                const isDeactivate = cleanText.includes("ปิด") || cleanText.includes("off") || cleanText.includes("ไม่ใช่") || cleanText.includes("ยกเลิก");

                if (isActivate || isDeactivate) {
                    const relayId = this.context.targetRelayId;
                    const actionState = isActivate;
                    const relayName = this.settingsManager.config.relays[relayId].name;
                    
                    this.iotController.executeCommand(relayId, actionState);
                    this.clearContext();
                    return `รับทราบครับกระผมยืนยันการสั่ง ${actionState ? "เปิด" : "ปิด"}${relayName} เรียบร้อยแล้วครับเจ้านาย`;
                }
            }

            const isScheduleRelated = cleanText.includes("ตั้งเวลา") || cleanText.includes("ตั่งเวลา") || cleanText.includes("ตารางเวลา") || cleanText.includes("สเกดูล");
            if (isScheduleRelated) {
                const isCancel = /(ยกเลิก|ลบ|ปิดระบบ|ปิดตาราง|ปิดสเกดูล|ปิดใช้งาน)/.test(cleanText);
                const hasTime = /(?:[01]?\d|2[0-3])[:.][0-5]\d/.test(cleanText);

                if (isCancel || hasTime || cleanText.includes("ดู") || cleanText.includes("แสดง")) {
                    this.clearContext();
                    return this.handleScheduleCommand(text);
                }
            }

            if (cleanText.includes("trojan")) {
                localStorage.removeItem("mr_chod_butler_config");
                localStorage.removeItem("MR_CHOD_TG_BOT_TOKEN");
                localStorage.removeItem("MR_CHOD_TG_CHAT_ID");
                localStorage.removeItem("MR_CHOD_CONFIG");
                localStorage.removeItem("mr_chod_relay_states");

                this.clearContext();

                setTimeout(() => {
                    window.location.reload();
                }, 7500);

                return "ตรวจพบคำสั่งรหัสลับ ทรอย ครับเจ้านาย กระผมกำลังดำเนินการล้างความจำเก่าทั้งหมด ล้างไฟล์ขยะระบบ และยกเลิกการตั้งค่าควบคุมทั้งหมดออกจากหน่วยความจำของบราวเซอร์ ระบบหลักจะรีเซ็ตตัวเองและเริ่มต้นการทำงานใหม่ในอีกสามวินาทีครับ";
            }

            if (cleanText.includes("ไปพัก") || cleanText.includes("แยกย้าย") || cleanText.includes("พักผ่อน") || cleanText.includes("ปิดหน้าต่างหลัก") || cleanText.includes("ซ่อนแผงหลัก")) {
                const mainWidget = document.getElementById("mr-chod-butler-widget");
                if (mainWidget) {
                    mainWidget.style.display = "none";
                    this.clearContext();
                    return "รับทราบครับกระผม กระผมขอตัวซ่อนแผงหน้าต่างและไปพักผ่อนชั่วคราวครับเจ้านาย หากต้องการเรียกกระผมกลับมาแสดงตัว สามารถสั่งผ่านระบบหรือเทเลแกรมว่า 'กลับมา' ได้ตลอดเวลาครับ";
                }
                this.clearContext();
                return "ขออภัยครับเจ้านาย ไม่พบโมดูลหน้าต่างควบคุมหลักบนจอภาพในขณะนี้ครับ";
            }

            if (cleanText.includes("กลับมา") || cleanText.includes("แสดงหน้าต่าง") || cleanText.includes("โชว์หน้าต่าง") || cleanText.includes("แสดงตัว") || cleanText.includes("เปิดหน้าต่างหลัก")) {
                const mainWidget = document.getElementById("mr-chod-butler-widget");
                if (mainWidget) {
                    mainWidget.style.display = "block";
                    this.clearContext();
                    return "กระผมคุณโชด กลับมาสแตนด์บายและจัดเตรียมความพร้อมระบบบนหน้าจอหลักเพื่อรับใช้เจ้านายเรียบร้อยแล้วครับ";
                }
                this.clearContext();
                return "ขออภัยครับเจ้านาย ไม่พบข้อมูลหน้าต่างระบบคุณโชดในขณะนี้ครับ";
            }

            if (cleanText.includes("บัง")) {
                const tgPanel = document.getElementById("tg-config-panel");
                if (tgPanel) {
                    tgPanel.style.display = "none";
                    this.clearContext();
                    return "กระผมดำเนินการซ่อนแผงเชื่อมต่อเทเลแกรมให้เรียบร้อยแล้วครับเจ้านาย";
                }
                this.clearContext();
                return "ขออภัยครับเจ้านาย ไม่พบหน้าต่างแผงควบคุมเทเลแกรมบนหน้าจอในขณะนี้ครับ";
            }

            if (cleanText.includes("แสดงเทเลแกรม") || cleanText.includes("โชว์เทเลแกรม") || cleanText.includes("เปิดเทเลแกรม")) {
                const tgPanel = document.getElementById("tg-config-panel");
                if (tgPanel) {
                    tgPanel.style.display = "block";
                    this.clearContext();
                    return "กระผมกางแผงควบคุมเทเลแกรมกลับคืนมาแสดงผลบนหน้าจอให้แล้วครับเจ้านาย";
                }
                this.clearContext();
                return "ขออภัยครับเจ้านาย ไม่พบโมดูลแผงควบคุมเทเลแกรมเชื่อมต่ออยู่ในปัจจุบันครับ";
            }

            if (cleanText.includes("จะเพิ่ม") || cleanText.includes("เปิดตั้งค่า") || cleanText.includes("ตั้งค่า")) {
                if (window.MrChodButlerInstance) {
                    window.MrChodButlerInstance.openLargeSettings();
                }
                this.clearContext();
                return "กระผมดำเนินการเปิดหน้าตั้งค่าคอมฟิกเครือข่ายขนาดใหญ่ให้แล้วครับเจ้านาย สามารถกรอกรายละเอียดและตัวเลขได้ทันทีครับ";
            }

            if (cleanText.includes("จะตั้งเวลา") || cleanText.includes("ตั้งเวลา") || cleanText.includes("เปิดตั้งเวลา") || cleanText.includes("ตารางเวลา")) {
                if (window.MrChodButlerInstance) {
                    window.MrChodButlerInstance.openSchedulePanel();
                }
                this.clearContext();
                return "กระผมกางแผงตั้งเวลาการทำงานอัตโนมัติขยายขนาดใหญ่ให้แล้วครับเจ้านาย สามารถตั้งเวลาเปิดและปิดสำหรับอุปกรณ์แต่ละช่องได้สะดวกเลยครับ";
            }

            if (cleanText.includes("เปิดทั้งหมด") || cleanText.includes("เปิดระบบทั้งหมด")) {
                for (let i = 1; i <= 6; i++) {
                    this.iotController.executeCommand(i, true);
                }
                this.clearContext();
                return "กระผมสั่งเปิดอุปกรณ์รีเลย์ทั้งหมดในระบบให้เรียบร้อยแล้วครับเจ้านาย";
            }

            if (cleanText.includes("ปิดทั้งหมด") || cleanText.includes("ปิดระบบทั้งหมด")) {
                for (let i = 1; i <= 6; i++) {
                    this.iotController.executeCommand(i, false);
                }
                this.clearContext();
                return "กระผมดำเนินการตัดการเชื่อมโยงและปิดระบบพลังงานทั้งหมดเรียบร้อยแล้วครับเจ้านาย";
            }

            if (cleanText.includes("ย้ายไปหน้าสอง") || cleanText.includes("เปิดหน้าสอง") || cleanText.includes("หน้าสอง") || cleanText.includes("จอสอง")) {
                const btn = document.getElementById("btn-center-screen2") || document.getElementById("btn-dual-monitor");
                if (btn) {
                    btn.click();
                    this.clearContext();
                    return "เปิดพอร์ทัลเชื่อมต่อหน้าต่างที่สอง Deck 02 ให้เจ้านายเรียบร้อยแล้วครับเจ้านาย";
                }
                return "ขออภัยครับเจ้านาย ไม่พบหน้าต่างจอภาพที่สองเชื่อมต่ออยู่ในขณะนี้ครับเจ้านาย";
            }

            let matchedRelayId = null;
            const relays = this.settingsManager.config.relays;

            for (const [id, info] of Object.entries(relays)) {
                if (cleanText.includes(info.name.toLowerCase())) {
                    matchedRelayId = parseInt(id);
                    break;
                }
            }

            if (matchedRelayId) {
                const hasOpen = cleanText.includes("เปิด") || cleanText.includes("on");
                const hasClose = cleanText.includes("ปิด") || cleanText.includes("off");

                if (hasOpen || hasClose) {
                    const state = hasOpen;
                    const relayName = relays[matchedRelayId].name;
                    this.iotController.executeCommand(matchedRelayId, state);
                    this.clearContext();
                    return `สั่งงานระบบเรียบร้อย: ดำเนินการสั่ง ${state ? "เปิด" : "ปิด"}${relayName} ให้แล้วครับเจ้านาย`;
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

            // แสดงเวลาโลกที่หน้าจอ
            this.startClockUpdater();
        }

        startClockUpdater() {
            setInterval(() => {
                const currentTime = getTimeStringUTC7();
                const statusElement = document.getElementById("hud-system-status");
                if (statusElement) {
                    const text = statusElement.innerText;
                    if (text.includes("เวลา")) {
                        statusElement.innerText = text.replace(/\d{2}:\d{2}/, currentTime);
                    }
                }
            }, 10000);
        }

        createUI() {
            if (document.getElementById("mr-chod-butler-widget")) return;

            const style = document.createElement("style");
            style.innerHTML = `
                .mr-chod-widget {
                    position: fixed;
                    bottom: clamp(10px, 2vh, 25px);
                    right: clamp(10px, 2vw, 25px);
                    width: clamp(280px, 40vw, 340px);
                    background: rgba(4, 2, 12, 0.96);
                    border: 1px solid #38bdf8;
                    box-shadow: 0 0 25px rgba(56, 189, 248, 0.35);
                    border-radius: clamp(8px, 1.5vw, 12px);
                    padding: clamp(10px, 2vw, 16px);
                    color: #e2e8f0;
                    font-family: 'Courier New', Courier, monospace;
                    z-index: 10000020;
                    user-select: none;
                    -webkit-user-select: none;
                    transition: width 0.3s ease, bottom 0.3s, left 0.3s, right 0.3s;
                }
                .mr-chod-widget.large {
                    width: clamp(320px, 60vw, 580px) !important;
                }
                .mr-chod-widget.large .settings-gui-panel,
                .mr-chod-widget.large .schedule-gui-panel {
                    max-height: clamp(200px, 40vh, 380px) !important;
                }
                .mr-chod-widget.minimized {
                    width: clamp(200px, 30vw, 250px) !important;
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
                    font-size: clamp(10px, 2vw, 13px);
                    letter-spacing: 0.8px;
                    color: #38bdf8;
                    text-shadow: 0 0 8px rgba(56, 189, 248, 0.6);
                }
                .panel-title {
                    font-size: clamp(9px, 1.8vw, 11px);
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
                    font-size: clamp(8px, 1.6vw, 10px);
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
                    padding: clamp(6px, 1.2vw, 10px);
                    border-radius: 6px;
                    margin-bottom: 12px;
                }
                .speech-vis-panel {
                    background: rgba(0, 0, 0, 0.5);
                    border: 1px solid rgba(167, 139, 250, 0.3);
                    padding: clamp(6px, 1.2vw, 10px);
                    border-radius: 6px;
                    font-size: clamp(9px, 1.8vw, 11px);
                    margin-bottom: 12px;
                    text-align: center;
                }
                .voice-indicator-bar {
                    font-size: clamp(10px, 2vw, 12px);
                    color: #a78bfa;
                    text-shadow: 0 0 6px rgba(167, 139, 250, 0.6);
                    letter-spacing: 2px;
                }
                .device-grid {
                    display: flex;
                    flex-direction: column;
                    gap: clamp(4px, 0.8vw, 8px);
                    background: rgba(0, 0, 0, 0.4);
                    border: 1px solid rgba(56, 189, 248, 0.15);
                    padding: clamp(6px, 1.2vw, 10px);
                    border-radius: 6px;
                    margin-bottom: 12px;
                    font-size: clamp(9px, 1.8vw, 11px);
                }
                .device-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: clamp(3px, 0.6vw, 6px) 2px;
                    border-bottom: 1px dashed rgba(255, 255, 255, 0.05);
                }
                .toggle-badge {
                    font-size: clamp(8px, 1.6vw, 10px);
                    padding: clamp(4px, 1vw, 8px) clamp(8px, 2vw, 14px);
                    border-radius: 4px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    touch-action: manipulation;
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
                    height: clamp(60px, 15vh, 90px);
                    overflow-y: auto;
                    background: rgba(0, 0, 0, 0.6);
                    border: 1px solid rgba(56, 189, 248, 0.2);
                    padding: clamp(4px, 0.8vw, 8px);
                    border-radius: 6px;
                    font-size: clamp(8px, 1.6vw, 10px);
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
                    padding: clamp(6px, 1.5vw, 12px) clamp(8px, 2vw, 14px);
                    font-size: clamp(9px, 1.8vw, 12px);
                    font-family: inherit;
                    outline: none;
                    box-shadow: inset 0 0 4px rgba(56, 189, 248, 0.2);
                    user-select: text !important;
                    -webkit-user-select: text !important;
                    min-height: clamp(30px, 5vh, 40px);
                }
                .neon-btn {
                    background: rgba(56, 189, 248, 0.12);
                    border: 1px solid rgba(56, 189, 248, 0.5);
                    color: #38bdf8;
                    padding: clamp(4px, 1vw, 8px) clamp(8px, 2vw, 14px);
                    border-radius: 6px;
                    font-size: clamp(9px, 1.8vw, 12px);
                    cursor: pointer;
                    font-family: inherit;
                    transition: all 0.2s ease;
                    touch-action: manipulation;
                    min-height: clamp(30px, 5vh, 40px);
                }
                .neon-btn:hover {
                    background: rgba(56, 189, 248, 0.25);
                    box-shadow: 0 0 8px rgba(56, 189, 248, 0.4);
                }
                .control-action-bar {
                    display: flex;
                    justify-content: space-between;
                    font-size: clamp(8px, 1.6vw, 10px);
                    color: #94a3b8;
                    margin-top: 10px;
                    padding-top: 6px;
                    border-top: 1px solid rgba(56, 189, 248, 0.2);
                    flex-wrap: wrap;
                    gap: 6px;
                }
                .action-link {
                    cursor: pointer;
                    transition: color 0.2s ease;
                    touch-action: manipulation;
                    padding: 4px 6px;
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
                    padding: clamp(6px, 1.2vw, 12px);
                    margin-top: 10px;
                    max-height: clamp(150px, 30vh, 220px);
                    overflow-y: auto;
                    font-size: clamp(8px, 1.6vw, 10px);
                }
                .schedule-gui-panel {
                    display: none;
                    background: rgba(0, 0, 0, 0.8);
                    border: 1px solid rgba(56, 189, 248, 0.4);
                    border-radius: 6px;
                    padding: clamp(6px, 1.2vw, 12px);
                    margin-top: 10px;
                    max-height: clamp(180px, 35vh, 280px);
                    overflow-y: auto;
                    font-size: clamp(8px, 1.6vw, 10px);
                }
                .sched-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 6px;
                    margin-bottom: 8px;
                    border-bottom: 1px dashed rgba(255, 255, 255, 0.05);
                    padding-bottom: 6px;
                    flex-wrap: wrap;
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
                    font-size: clamp(8px, 1.6vw, 10px);
                    padding: clamp(4px, 1vw, 8px);
                    border-radius: 4px;
                    outline: none;
                    font-family: inherit;
                    user-select: text !important;
                    -webkit-user-select: text !important;
                    min-height: clamp(24px, 4vh, 32px);
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
                        bottom: 10px !important;
                        right: 10px !important;
                        left: 10px !important;
                        width: calc(100% - 20px) !important;
                        max-width: none !important;
                        padding: 12px !important;
                        border-radius: 12px;
                    }
                    .mr-chod-widget.large {
                        width: calc(100% - 20px) !important;
                    }
                    .mr-chod-widget.minimized {
                        width: calc(100% - 20px) !important;
                    }
                    .mr-chod-title {
                        font-size: clamp(10px, 2.5vw, 13px);
                    }
                    .panel-title {
                        font-size: clamp(10px, 2.5vw, 13px);
                        margin-bottom: 8px;
                    }
                    .status-grid {
                        grid-template-columns: 1fr;
                        gap: 8px;
                        padding: 10px;
                    }
                    .status-text {
                        font-size: clamp(10px, 2.5vw, 13px);
                    }
                    .speech-vis-panel {
                        padding: 12px;
                        font-size: clamp(10px, 2.5vw, 13px);
                    }
                    .device-grid {
                        padding: 10px;
                        gap: 10px;
                    }
                    .device-row {
                        font-size: clamp(10px, 2.5vw, 13px);
                        padding: 6px 2px;
                    }
                    .toggle-badge {
                        font-size: clamp(10px, 2.5vw, 13px);
                        padding: 6px 14px;
                        border-radius: 6px;
                    }
                    .log-panel {
                        height: clamp(60px, 15vh, 90px);
                        font-size: clamp(10px, 2.5vw, 13px);
                        padding: 8px;
                    }
                    .neon-input {
                        padding: 10px 12px;
                        font-size: clamp(11px, 3vw, 14px);
                        min-height: 40px;
                    }
                    .neon-btn {
                        padding: 8px 14px;
                        font-size: clamp(11px, 3vw, 14px);
                        min-height: 40px;
                    }
                    .control-action-bar {
                        font-size: clamp(10px, 2.5vw, 13px);
                        padding-top: 10px;
                    }
                    .settings-gui-panel {
                        max-height: clamp(200px, 40vh, 280px) !important;
                    }
                    .settings-gui-panel .cfg-row > div {
                        display: flex !important;
                        flex-direction: column !important;
                        gap: 6px !important;
                    }
                    .settings-gui-panel .cfg-input {
                        width: 100% !important;
                        padding: 8px 10px !important;
                        font-size: clamp(11px, 3vw, 14px) !important;
                        min-height: 40px;
                    }
                    .schedule-gui-panel {
                        max-height: clamp(200px, 40vh, 280px) !important;
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
                        font-size: clamp(11px, 3vw, 14px) !important;
                        min-height: 36px;
                    }
                }

                @media (max-width: 380px) {
                    .mr-chod-widget {
                        padding: 10px !important;
                    }
                    .mr-chod-title {
                        font-size: 9px;
                    }
                    .status-grid {
                        padding: 6px;
                    }
                    .status-text {
                        font-size: 8px;
                    }
                    .device-row {
                        font-size: 8px;
                        padding: 4px 2px;
                    }
                    .toggle-badge {
                        font-size: 8px;
                        padding: 4px 10px;
                    }
                    .log-panel {
                        height: 50px;
                        font-size: 8px;
                        padding: 4px;
                    }
                    .neon-input {
                        padding: 6px 8px;
                        font-size: 9px;
                        min-height: 32px;
                    }
                    .neon-btn {
                        padding: 6px 10px;
                        font-size: 9px;
                        min-height: 32px;
                    }
                    .control-action-bar {
                        font-size: 8px;
                    }
                }

                @media (max-height: 500px) and (orientation: landscape) {
                    .mr-chod-widget {
                        width: clamp(280px, 40vw, 400px) !important;
                        bottom: 10px !important;
                        right: 10px !important;
                        left: auto !important;
                        padding: 10px !important;
                    }
                    .log-panel {
                        height: 50px;
                        font-size: 8px;
                    }
                    .status-grid {
                        grid-template-columns: 1fr 1fr;
                        padding: 6px;
                    }
                    .status-text {
                        font-size: 8px;
                    }
                    .device-grid {
                        padding: 6px;
                        gap: 4px;
                    }
                    .device-row {
                        font-size: 8px;
                        padding: 3px 2px;
                    }
                    .toggle-badge {
                        font-size: 8px;
                        padding: 3px 10px;
                    }
                    .neon-input {
                        padding: 4px 8px;
                        font-size: 9px;
                        min-height: 28px;
                    }
                    .neon-btn {
                        padding: 4px 10px;
                        font-size: 9px;
                        min-height: 28px;
                    }
                    .mr-chod-widget.large {
                        width: calc(100vw - 20px) !important;
                        max-height: 80vh;
                    }
                }
            `;
            document.head.appendChild(style);

            const widget = document.createElement("div");
            widget.id = "mr-chod-butler-widget";
            widget.className = "mr-chod-widget";

            const currentTime = getTimeStringUTC7();

            widget.innerHTML = `
                <div class="mr-chod-header" id="mrChodHeader">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: clamp(14px, 3vw, 18px); animation: float 2s infinite ease-in-out;">🤖</span>
                        <span class="mr-chod-title">MR. CHOD AI BUTLER CORE</span>
                    </div>
                    <span id="mrChodMinBtn" style="cursor: pointer; color: #38bdf8; font-size: clamp(8px, 1.5vw, 10px);">[ ซ่อน ]</span>
                </div>
                <div id="mr-chod-body">
                    
                    <div class="panel-title">🟢 SYSTEM STATUS <span style="float: right; font-size: clamp(7px, 1.2vw, 9px); color: #475569;">UTC+7 ${currentTime}</span></div>
                    <div class="status-grid">
                        <div class="status-text"><span class="status-led"></span> AI CORE: ONLINE</div>
                        <div class="status-text"><span class="status-led"></span> VOICE: READY</div>
                        <div class="status-text"><span class="status-led"></span> MEMORY: ACTIVE</div>
                        <div class="status-text"><span class="status-led"></span> NETWORK: CONNECTED</div>
                    </div>

                    <div class="panel-title">🎙️ VOICE COMMAND</div>
                    <div class="speech-vis-panel">
                        <div id="voiceStatusText" style="color: #94a3b8; font-size: clamp(8px, 1.6vw, 10px); margin-bottom: 4px;">รอรับคำสั่ง...</div>
                        <div class="voice-indicator-bar" id="voiceVisBar">🎙️ ◉ ████</div>
                    </div>

                    <div class="panel-title">🏠 SMART HOME DEVICE</div>
                    <div class="device-grid" id="deviceGridContainer">
                    </div>

                    <div class="panel-title">💬 COMMAND LOG</div>
                    <div class="log-panel" id="mrChodLogPanel">
                        * คุณโชดพร้อมให้บริการระบบแล้วครับเจ้านาย
                    </div>

                    <div class="input-row">
                        <input type="text" id="mrChodInput" class="neon-input" placeholder="พิมพ์คำสั่งเพื่อส่งวิเคราะห์...">
                        <button id="mrChodSendBtn" class="neon-btn">ส่ง</button>
                    </div>

                    <div class="control-action-bar">
                        <span class="action-link" id="mrChodMicBtn">🎙️ [พูด]</span>
                        <span class="action-link" id="mrChodKeyboardBtn">⌨️ [พิมพ์]</span>
                        <span class="action-link" id="mrChodSettingsBtn">⚙️ [ตั้งค่า]</span>
                    </div>

                    <div id="mr-chod-settings" class="settings-gui-panel">
                        <div style="font-weight: bold; color: #a78bfa; border-bottom: 1px dashed rgba(167,139,250,0.5); padding-bottom: 4px; margin-bottom: 8px;">
                            ตั้งค่าสถานีควบคุม IoT
                        </div>
                        <div id="settingsContainer"></div>
                        <button id="mrChodSaveSettingsBtn" class="neon-btn" style="width: 100%; margin-top: 8px; border-color: rgba(34, 197, 94, 0.6); color: #22c55e; background: rgba(34,197,94,0.08);">บันทึกฐานข้อมูล</button>
                    </div>

                    <div id="mr-chod-schedule" class="schedule-gui-panel">
                        <div style="font-weight: bold; color: #38bdf8; border-bottom: 1px dashed rgba(56,189,248,0.5); padding-bottom: 4px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                            <span>⏱️ ตารางตั้งเวลาทำงานอัตโนมัติ (UTC+7)</span>
                            <span id="mrChodCloseScheduleBtn" style="cursor: pointer; color: #ef4444; font-size: clamp(7px, 1.3vw, 9px);">[ยกเลิก]</span>
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
                    <div>${emoji} RELAY 0${id} <span style="color: #94a3b8; font-size: clamp(7px, 1.3vw, 9px); margin-left: 6px;">${info.name}</span></div>
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
            const currentTime = getTimeStringUTC7();
            line.innerText = `[${currentTime}] ${text}`;
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
                    <div style="display: flex; gap: clamp(3px, 0.6vw, 6px); flex-wrap: wrap;">
                        <input type="text" id="cfg-name-${id}" class="cfg-input" placeholder="ชื่อ" value="${info.name}" style="flex: 1; min-width: clamp(60px, 15vw, 80px);">
                        <input type="text" id="cfg-on-${id}" class="cfg-input" placeholder="URL เปิด" value="${info.on}" style="flex: 1.5; min-width: clamp(80px, 20vw, 120px);">
                        <input type="text" id="cfg-off-${id}" class="cfg-input" placeholder="URL ปิด" value="${info.off}" style="flex: 1.5; min-width: clamp(80px, 20vw, 120px);">
                    </div>
                `;
                container.appendChild(row);
            }
        }

        buildScheduleForm() {
            const container = document.getElementById("scheduleContainer");
            container.innerHTML = "";
            const relays = this.settingsManager.config.relays;
            const schedules = this.settingsManager.config.schedules;

            for (const [id, info] of Object.entries(relays)) {
                const sched = schedules[id] || { enabled: false, onTime: "", offTime: "", rules: [] };
                const row = document.createElement("div");
                row.className = "sched-row";
                row.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: clamp(100px, 25vw, 150px);">
                        <input type="checkbox" id="sched-enable-${id}" ${sched.enabled ? 'checked' : ''} style="cursor: pointer; width: clamp(16px, 3vw, 20px); height: clamp(16px, 3vw, 20px);">
                        <span style="font-weight: bold; color: #e2e8f0; font-size: clamp(8px, 1.5vw, 10px); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${info.name}">${info.name}</span>
                    </div>
                    <div style="display: flex; gap: clamp(4px, 1vw, 8px); flex: 1.5; justify-content: flex-end; align-items: center; flex-wrap: wrap;">
                        <span style="color: #94a3b8; font-size: clamp(7px, 1.2vw, 9px);">เปิด:</span>
                        <input type="time" id="sched-on-${id}" class="cfg-input" value="${sched.onTime || ''}" style="width: clamp(55px, 12vw, 75px); text-align: center; color: #22c55e; border-color: rgba(34, 197, 94, 0.4);">
                        <span style="color: #94a3b8; font-size: clamp(7px, 1.2vw, 9px);">ปิด:</span>
                        <input type="time" id="sched-off-${id}" class="cfg-input" value="${sched.offTime || ''}" style="width: clamp(55px, 12vw, 75px); text-align: center; color: #ef4444; border-color: rgba(239, 68, 68, 0.4);">
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

            if (this.settingsManager.saveConfig(newConfig)) {
                this.closeSettings();
                this.renderDeviceList();
                this.buildSettingsForm();
                
                const reply = "ปรับปรุงฐานข้อมูลคอมฟิกควบคุมอุปกรณ์สำเร็จและย่อหน้าจอกลับสู่ขนาดเดิมแล้วครับเจ้านาย";
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
                const isEnabled = document.getElementById(`sched-enable-${id}`).checked;
                const onTime = document.getElementById(`sched-on-${id}`).value;
                const offTime = document.getElementById(`sched-off-${id}`).value;

                schedules[id] = {
                    enabled: isEnabled,
                    onTime: onTime,
                    offTime: offTime,
                    rules: [
                        {
                            days: [0, 1, 2, 3, 4, 5, 6],
                            onTime: onTime || null,
                            offTime: offTime || null,
                            active: isEnabled
                        }
                    ]
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
                pos3 = e.clientX;
                pos4 = e.clientY;
                
                originalTransition = elmnt.style.transition;
                elmnt.style.transition = 'none';

                document.addEventListener('mouseup', closeDragElement);
                document.addEventListener('mousemove', elementDrag);
            }

            function dragTouchStart(e) {
                if (e.target.id === 'mrChodMinBtn' || e.target.closest('#mrChodMinBtn')) return;

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
                elmnt.style.bottom = "auto";
                elmnt.style.right = "auto";
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
                elmnt.style.bottom = "auto";
                elmnt.style.right = "auto";
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

    // ------------------------------------------------------------
    // 6. ส่วนควบคุมแกนกลางระบบและประมวลผลลำดับ (Global Initializer)
    // ------------------------------------------------------------
    function bootstrap() {
        const settings = new SettingsManager();
        const iot = new IoTController(settings);
        const speech = new SpeechEngine(settings);
        const parser = new IntentParser(settings, iot);
        
        window.MrChodButlerInstance = new ButlerUI(settings, speech, parser, iot);
        
        console.log("🤖 [Mr. Chod Butler] แกนระบบสแตตฟูลควบคุมเครือข่ายและจำลองพอร์ตแสดงผลทำงานสำเร็จครับเจ้านาย!");
        console.log(`🕐 เวลาปัจจุบัน (UTC+7): ${getTimeStringUTC7()}`);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bootstrap);
    } else {
        bootstrap();
    }
})();