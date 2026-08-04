// ==============================================================================================
//    AI MR. CHOD BUTLER SYSTEM - ADVANCED VOICE COMMANDS ENGINE (SEPARATE MODULE)
//    * INTEGRATED WITH WINDOW.CHODBRAIN COGNITIVE SYSTEM *
//    * อัปเดตแก้ไขบัค: ระบบวิเคราะห์สารสื่อประสาทภาษาธรรมชาติ และระบบตรวจการหน้าจอ Deck 02 เรียลไทม์ *
// ==============================================================================================

(function() {
    'use strict';

    // แมปปิ้งชื่อสารสื่อประสาท ภาษาไทย -> ภาษาอังกฤษ เพื่อซิงค์กับ ChodBrain
    const sarMap = {
        "โดพามีน": "dopamine",
        "เซโรโทนิน": "serotonin",
        "อะดรีนาลีน": "adrenaline"
    };

    // สถานะล็อกสมดุลสารสื่อประสาท (Override) เพื่อไม่ให้โดน setInterval ของเว็บเขียนทับ
    const overrides = {
        dopamine: null,
        serotonin: null,
        adrenaline: null
    };

    const advancedState = {
        get neurotransmitters() {
            if (window.ChodBrain && window.ChodBrain.neurotransmitters) {
                return {
                    "โดพามีน": window.ChodBrain.neurotransmitters.dopamine,
                    "เซโรโทนิน": window.ChodBrain.neurotransmitters.serotonin,
                    "อะดรีนาลีน": window.ChodBrain.neurotransmitters.adrenaline
                };
            }
            return {
                "โดพามีน": overrides.dopamine !== null ? overrides.dopamine : 0.5,
                "เซโรโทนิน": overrides.serotonin !== null ? overrides.serotonin : 0.6,
                "อะดรีนาลีน": overrides.adrenaline !== null ? overrides.adrenaline : 0.3
            };
        },
        temporalLobeWeight: 1.0,
        secondWindow: null
    };

    // เชื่อมต่อสะพานรับส่งค่าเข้ากับ ChodBrain ของเว็บ เพื่อให้สถิติด้านฟิสิกส์แปรผันตามคำสั่งเจ้านายโดยตรง
    function setupChodBrainBridge() {
        if (!window.ChodBrain || !window.ChodBrain.neurotransmitters) {
            setTimeout(setupChodBrainBridge, 100);
            return;
        }

        const nt = window.ChodBrain.neurotransmitters;

        // สำรองตัวแปรเพื่อเก็บค่าวัดธรรมชาติของหน้าเว็บ
        let rawDopamine = nt.dopamine || 0.5;
        let rawSerotonin = nt.serotonin || 0.6;
        let rawAdrenaline = nt.adrenaline || 0.3;

        // กำหนดกลไก Interceptor ป้องกันค่าหลอนขณะรันลูปในเว็บหลัก
        Object.defineProperty(nt, 'dopamine', {
            get: () => (overrides.dopamine !== null ? overrides.dopamine : rawDopamine),
            set: (val) => { rawDopamine = val; },
            configurable: true,
            enumerable: true
        });

        Object.defineProperty(nt, 'serotonin', {
            get: () => (overrides.serotonin !== null ? overrides.serotonin : rawSerotonin),
            set: (val) => { rawSerotonin = val; },
            configurable: true,
            enumerable: true
        });

        Object.defineProperty(nt, 'adrenaline', {
            get: () => (overrides.adrenaline !== null ? overrides.adrenaline : rawAdrenaline),
            set: (val) => { rawAdrenaline = val; },
            configurable: true,
            enumerable: true
        });
    }

    // ฟังก์ชันซิงโครไนซ์รายงานสัญญานทางเคมีจำลองขึ้นจอ Deck 02
    function updateSecondWindowTelemetry() {
        if (advancedState.secondWindow && !advancedState.secondWindow.closed) {
            const doc = advancedState.secondWindow.document;
            const d = doc.getElementById("tel-dopamine");
            const s = doc.getElementById("tel-serotonin");
            const a = doc.getElementById("tel-adrenaline");
            const l = doc.getElementById("tel-ltp");
            
            const nts = advancedState.neurotransmitters;
            if (d) d.innerText = nts["โดพามีน"].toFixed(2);
            if (s) s.innerText = nts["เซโรโทนิน"].toFixed(2);
            if (a) a.innerText = nts["อะดรีนาลีน"].toFixed(2);
            if (l) l.innerText = advancedState.temporalLobeWeight.toFixed(2);
        }
    }

    // วิเคราะห์และแปลเจตจำนงคำสั่งประสาทระดับสูง
    function handleAdvancedIntent(text) {
        const cleanText = text.trim().toLowerCase();

        // 1. เพิ่มความจำระยะยาว (กระตุ้น Synapse LTP)
        if (cleanText === "เพิ่มความจำระยะยาว" || cleanText.includes("กระตุ้นกลีบขมับ")) {
            advancedState.temporalLobeWeight = parseFloat((advancedState.temporalLobeWeight + 0.15).toFixed(2));
            updateSecondWindowTelemetry();
            if (window.MrChodButlerInstance) {
                window.MrChodButlerInstance.appendLog(`SYS : [กลีบขมับ] กระตุ้น LTP... ประสิทธิภาพเพิ่มเป็น ${advancedState.temporalLobeWeight}`);
            }
            return `กระผมกระตุ้นกระบวนการกระชับรอยหยักและเสริมประสิทธิภาพสารไซแนปส์ส่วนความจำระยะยาวขึ้นมาอยู่ที่ระดับ ${advancedState.temporalLobeWeight} เรียบร้อยแล้วครับเจ้านาย`;
        }

        // 2. ปรับสมดุลเคมีแบบ Heuristic ป้องกันช่องโหว่คำศัพท์พ่วง (ปรับสมดุล / ปรับ [สาร] เพิ่ม/ลด/เป็น [ค่า])
        const balanceMatch = cleanText.match(/ปรับ(?:สมดุล)?\s*(โดพามีน|เซโรโทนิน|อะดรีนาลีน)\s*(เพิ่ม|ลด|เป็น)\s*([0-9.]+)/);
        if (balanceMatch) {
            const sar = balanceMatch[1];
            const action = balanceMatch[2];
            const val = parseFloat(balanceMatch[3]);
            const engKey = sarMap[sar];
            
            const current = advancedState.neurotransmitters[sar];
            let updated = current;

            if (action === "เพิ่ม") {
                updated = Math.min(1.0, Math.max(0.0, parseFloat((current + val).toFixed(2))));
            } else if (action === "ลด") {
                updated = Math.min(1.0, Math.max(0.0, parseFloat((current - val).toFixed(2))));
            } else if (action === "เป็น") {
                updated = Math.min(1.0, Math.max(0.0, val));
            }

            overrides[engKey] = updated;
            updateSecondWindowTelemetry();

            if (window.MrChodButlerInstance) {
                window.MrChodButlerInstance.appendLog(`SYS : [ปรับสมดุล] ${sar} ${action} ${val} -> ล็อกสมดุลที่: ${updated}`);
            }

            const confirmActionText = action === "เพิ่ม" ? "เพิ่มขึ้น" : action === "ลด" ? "ลดลง" : "ไปอยู่ที่ระดับเป้าหมายเป็น";
            return `ดำเนินการประสานและปรับระดับสารสื่อประสาท ${sar} ${confirmActionText} ${val} โดยล็อกระดับคงที่ไว้ที่ ${updated} เรียบร้อยแล้วครับเจ้านาย`;
        }

        // 3. บันทึกเอ็นแกรมความทรงจำกระแสสมอง
        if (cleanText.startsWith("บันทึกเอ็นแกรม") || cleanText.startsWith("บันทึก เอ็นแกรม")) {
            const name = text.replace(/^(บันทึกเอ็นแกรม|บันทึก\s*เอ็นแกรม)\s*/i, "").trim();
            if (name) {
                const engram = {
                    neurotransmitters: { ...advancedState.neurotransmitters },
                    temporalLobeWeight: advancedState.temporalLobeWeight,
                    timestamp: Date.now()
                };
                localStorage.setItem(`mr_chod_engram_${name.toLowerCase()}`, JSON.stringify(engram));
                if (window.MrChodButlerInstance) {
                    window.MrChodButlerInstance.appendLog(`SYS : [คลังสมอง] บันทึกเอ็นแกรม "${name}" สำเร็จ`);
                }
                return `กระผมทำการคัดลอกสถานะกระแสสมองและบันทึกเอ็นแกรมไว้ในสล็อตความจำหัวข้อ "${name}" สำเร็จแล้วครับเจ้านาย`;
            }
        }

        // 4. เรียกคืนเอ็นแกรมความทรงจำกระแสสมอง
        if (cleanText.startsWith("เรียกคืนเอ็นแกรม") || cleanText.startsWith("เรียกคืน เอ็นแกรม") || cleanText.startsWith("โหลดเอ็นแกรม")) {
            const name = text.replace(/^(เรียกคืนเอ็นแกรม|เรียกคืน\s*เอ็นแกรม|โหลดเอ็นแกรม)\s*/i, "").trim();
            if (name) {
                const saved = localStorage.getItem(`mr_chod_engram_${name.toLowerCase()}`);
                if (saved) {
                    try {
                        const engram = JSON.parse(saved);
                        
                        // คืนค่าการล็อก (overrides) จากที่เซฟไว้
                        overrides.dopamine = engram.neurotransmitters["โดพามีน"];
                        overrides.serotonin = engram.neurotransmitters["เซโรโทนิน"];
                        overrides.adrenaline = engram.neurotransmitters["อะดรีนาลีน"];
                        
                        advancedState.temporalLobeWeight = engram.temporalLobeWeight;
                        updateSecondWindowTelemetry();
                        if (window.MrChodButlerInstance) {
                            window.MrChodButlerInstance.appendLog(`SYS : [คลังสมอง] โหลดเอ็นแกรม "${name}" เรียบร้อย`);
                        }
                        return `กระผมทำการถอดรหัสรอยจำและโหลดเอ็นแกรมความทรงจำหัวข้อ "${name}" กลับเข้าสู่โครงสร้างระบบประสาทเรียบร้อยแล้วครับเจ้านาย`;
                    } catch (e) {
                        return `เกิดปัญหาในการแกะรหัสโครงสร้างเอ็นแกรมหัวข้อ "${name}" ครับเจ้านาย`;
                    }
                } else {
                    return `ขอประทานอภัยครับเจ้านาย ไม่พบประวัติเอ็นแกรมความจำในรหัสหัวข้อ "${name}" ในคลังเลยครับ`;
                }
            }
        }

        // 5. เปิดจอภาพตรวจการสำรองดวงที่สอง (Deck 02)
        const isOpenSecondMonitor = /^(เปิดจอภาพที่สอง|เปิดจอภาพที\s*2|เปิดจอสอง|เปิดจอภาพทีสอง|เปิดจอภาพที่\s*2)$/.test(cleanText);
        if (isOpenSecondMonitor) {
            if (!advancedState.secondWindow || advancedState.secondWindow.closed) {
                advancedState.secondWindow = window.open("", "MrChodSecondMonitor", "width=800,height=600,menubar=no,status=no,toolbar=no");
                const doc = advancedState.secondWindow.document;
                doc.write(`
                    <html>
                    <head>
                        <title>MR. CHOD DUAL MONITOR - DECK 02</title>
                        <style>
                            body {
                                background: #04020c;
                                color: #38bdf8;
                                font-family: 'Courier New', monospace;
                                padding: 20px;
                                margin: 0;
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: center;
                                height: 100vh;
                                box-sizing: border-box;
                            }
                            .container {
                                border: 2px solid #38bdf8;
                                box-shadow: 0 0 20px rgba(56, 189, 248, 0.4);
                                padding: 30px;
                                border-radius: 10px;
                                text-align: center;
                                background: rgba(0,0,0,0.8);
                            }
                            h1 { font-size: 24px; text-shadow: 0 0 10px #38bdf8; margin-bottom: 20px; }
                            .status { font-size: 14px; color: #a78bfa; margin-bottom: 30px; }
                            .telemetry { display: grid; grid-template-columns: 1fr; gap: 15px; text-align: left; max-width: 400px; margin: 0 auto; font-size: 16px; }
                            .telemetry div { border-bottom: 1px dashed rgba(56,189,248,0.3); padding-bottom: 8px; display: flex; justify-content: space-between; gap: 30px; }
                            .value { color: #22c55e; font-weight: bold; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>📺 MR. CHOD DECK 02 ACTIVE</h1>
                            <p class="status">สถานีตรวจการณ์และวิเคราะห์ข้อมูลระบบชีวภาพและกายภาพ</p>
                            <div class="telemetry">
                                <div><span>โดพามีน (Dopamine):</span> <span class="value" id="tel-dopamine">0.50</span></div>
                                <div><span>เซโรโทนิน (Serotonin):</span> <span class="value" id="tel-serotonin">0.60</span></div>
                                <div><span>อะดรีนาลีน (Adrenaline):</span> <span class="value" id="tel-adrenaline">0.30</span></div>
                                <div><span>น้ำหนักไซแนปส์ (Synapse LTP):</span> <span class="value" id="tel-ltp">1.00</span></div>
                            </div>
                        </div>
                    </body>
                    </html>
                `);
                doc.close();
                setTimeout(updateSecondWindowTelemetry, 150);
                if (window.MrChodButlerInstance) {
                    window.MrChodButlerInstance.appendLog(`SYS : [จอสอง] พอร์ทัลเชื่อมต่อสำเร็จ`);
                }
                return "เชื่อมต่อและเปิดอินเตอร์เฟสสถานีตรวจการณ์จอภาพที่สอง Deck 02 เรียบร้อยแล้วครับเจ้านาย";
            } else {
                return "ขออภัยครับเจ้านาย หน้าต่างตรวจการณ์จอที่สองถูกเชื่อมโยงเอาไว้เรียบร้อยแล้วครับ";
            }
        }

        // 6. ปิดจอภาพตรวจการสำรองดวงที่สอง
        const isCloseSecondMonitor = /^(ปิดจอภาพที่สอง|ปิดจอภาพที\s*2|ปิดจอสอง|ปิดจอภาพทีสอง|ปิดจอภาพที่\s*2)$/.test(cleanText);
        if (isCloseSecondMonitor) {
            if (advancedState.secondWindow && !advancedState.secondWindow.closed) {
                advancedState.secondWindow.close();
                advancedState.secondWindow = null;
                if (window.MrChodButlerInstance) {
                    window.MrChodButlerInstance.appendLog(`SYS : [จอสอง] ปิดพอร์ทัลเชื่อมต่อแล้ว`);
                }
                return "ดำเนินการตัดสัญญาณและปิดพอร์ทัลจอภาพที่สอง Deck 02 เรียบร้อยแล้วครับเจ้านาย กระผมพร้อมน้อมรับคำสั่งและเฝ้าระวังระบบอย่างใกล้ชิดครับ";
            } else {
                return "ขออภัยครับเจ้านาย สัญญาณตรวจการณ์จอภาพที่สองปิดการตอบสนองอยู่ก่อนแล้วครับ กระผมพร้อมน้อมรับคำสั่งและเฝ้าระวังระบบอย่างใกล้ชิดครับ";
            }
        }

        // 7. รีเซ็ตระบบ (ปลดการล็อกสารทางสมอง เพื่อให้เคมีไหลตามธรรมชาติของบราวเซอร์)
        if (cleanText === "รีเซ็ตระบบ") {
            overrides.dopamine = null;
            overrides.serotonin = null;
            overrides.adrenaline = null;
            advancedState.temporalLobeWeight = 1.0;
            updateSecondWindowTelemetry();
            if (window.MrChodButlerInstance) {
                window.MrChodButlerInstance.appendLog(`SYS : [สมองส่วนกลาง] ปลดการล็อกสาร ปล่อยสมดุลไหลตามระบบชีวภาพ`);
            }
            return "กระผมเคลียร์ประจุล็อกระบบประสาท คืนระดับสารสื่อประสาทกลับสู่คลื่นการเคลื่อนไหวตามธรรมชาติของหน้าเว็บแล้วครับเจ้านาย";
        }

        // 8. แสดงความช่วยเหลือสำหรับคำสั่งระดับลึก
        if (cleanText === "ช่วยเหลือ" || cleanText === "คำสั่งขั้นสูง" || cleanText === "help") {
            const commandsList = [
                "----------------------------------------",
                "📌 [คำสั่งขั้นสูงที่พร้อมใช้งานสำหรับคุณโชด]:",
                "1. 'เพิ่มความจำระยะยาว' - เพิ่มสัญญาณไซแนปส์กลีบขมับ",
                "2. 'ปรับสมดุล [สาร] เป็น [ค่า 0.0-1.0]'",
                "   * เจ้านายสั่งแบบสั้นได้ เช่น 'ปรับโดพามีนเพิ่ม 0.1'",
                "3. 'ปรับสมดุล [สาร] เพิ่ม [ค่า]'",
                "4. 'ปรับสมดุล [สาร] ลด [ค่า]'",
                "   * สารสื่อประสาท: โดพามีน, เซโรโทนิน, อะดรีนาลีน",
                "5. 'เปิดจอภาพที่สอง' / 'ปิดจอภาพที่สอง'",
                "6. 'บันทึกเอ็นแกรม [ชื่อ]' - บันทึกค่าสถานะปัจจุบัน",
                "7. 'เรียกคืนเอ็นแกรม [ชื่อ]' - คืนค่าเอ็นแกรมจำลอง",
                "8. 'รีเซ็ตระบบ' - เคลียร์ล็อกสารคืนการไหลธรรมชาติ",
                "----------------------------------------"
            ];
            if (window.MrChodButlerInstance) {
                commandsList.forEach(cmd => window.MrChodButlerInstance.appendLog(cmd));
            }
            return "ถ่ายโอนรายงานโครงสร้างและคำสั่งปฏิบัติการพิเศษระดับสูงลงบนแผง Log สำเร็จแล้วครับเจ้านาย";
        }

        return null;
    }

    // ทำการเชื่อมโยงระบบเข้ากับ IntentParser หลัก
    function injectAdvancedPatch() {
        if (!window.MrChodButlerInstance || !window.MrChodButlerInstance.intentParser) {
            setTimeout(injectAdvancedPatch, 100);
            return;
        }

        const originalParseIntent = window.MrChodButlerInstance.intentParser.parseIntent;

        window.MrChodButlerInstance.intentParser.parseIntent = function(text) {
            const advancedReply = handleAdvancedIntent(text);
            if (advancedReply !== null) {
                return advancedReply;
            }
            return originalParseIntent.call(this, text);
        };

        // เริ่มเชื่อมต่อซิงค์เข้ากับ window.ChodBrain โดยตรง
        setupChodBrainBridge();

        // ตั้งเวลาตรวจสอบข้อมูลตรวจการณ์และสถิติส่งขึ้นหน้าจอตรวจการณ์ดวงที่สองอย่างสม่ำเสมอทุกๆ 1 วินาที (ป้องกันข้อมูลนิ่งค้าง)
        setInterval(updateSecondWindowTelemetry, 1000);

        if (window.MrChodButlerInstance) {
            window.MrChodButlerInstance.appendLog("🤖 [Mr. Chod Extension] ซิงค์เชื่อมต่อกับโครงข่ายประสาท ChodBrain เรียบร้อย!");
        }
        console.log("🤖 [Mr. Chod Advanced Modules] แพตช์ระบบประสาทและพอร์ตจอภาพ Deck 02 เชื่อมต่อเข้ากับ ChodBrain สำเร็จ!");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", injectAdvancedPatch);
    } else {
        injectAdvancedPatch();
    }
})();