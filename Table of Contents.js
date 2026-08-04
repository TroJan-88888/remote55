// ==============================================================================================
//    AI MR. CHOD BUTLER SYSTEM - TABLE OF CONTENTS MODULE (STANDALONE EXTENSION)
//    * คุณลักษณะพิเศษ: ไม่ยุ่งเกี่ยวกับโค้ดหลัก, รองรับคีย์ลัด 'T' เปิด/ปิด หน้าต่างสารบัญอัจฉริยะ *
//    * รุ่นปรับปรุงความเข้ากันได้: ถอด Optional Chaining (?.) ออกเพื่อรองรับบราวเซอร์ทุกเวอร์ชัน *
// ==============================================================================================

(function() {
    'use strict';

    const STYLE_ID = "mr-chod-toc-style";
    const MODAL_ID = "mr-chod-toc-modal";

    // CSS สำหรับหน้าต่างคู่มือสไตล์นีออนไซเบอร์พังก์
    function injectTOCStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            #${MODAL_ID} {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 720px;
                max-width: 92vw;
                height: 80vh;
                background: rgba(6, 3, 18, 0.98);
                border: 1px solid #a78bfa;
                box-shadow: 0 0 35px rgba(167, 139, 250, 0.45);
                border-radius: 12px;
                padding: 24px;
                color: #e2e8f0;
                font-family: 'Courier New', Courier, monospace;
                z-index: 10000099; /* สูงกว่าวิดเจ็ตอื่นๆ ทั้งหมดเพื่อแสดงผลทับอย่างปลอดภัย */
                box-sizing: border-box;
                display: none; /* เริ่มต้นซ่อนไว้ */
            }
            .toc-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 2px solid rgba(167, 139, 250, 0.4);
                padding-bottom: 12px;
                margin-bottom: 16px;
            }
            .toc-title {
                font-weight: bold;
                font-size: 14px;
                letter-spacing: 1px;
                color: #a78bfa;
                text-shadow: 0 0 8px rgba(167, 139, 250, 0.6);
            }
            .toc-close-btn {
                cursor: pointer;
                color: #ef4444;
                font-size: 11px;
                border: 1px solid rgba(239, 68, 68, 0.4);
                padding: 3px 8px;
                border-radius: 4px;
                background: rgba(239, 68, 68, 0.08);
                transition: all 0.2s ease;
            }
            .toc-close-btn:hover {
                background: rgba(239, 68, 68, 0.25);
                box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
            }
            .toc-body {
                height: calc(100% - 60px);
                overflow-y: auto;
                padding-right: 8px;
                font-size: 11px;
                line-height: 1.6;
            }
            .toc-body::-webkit-scrollbar {
                width: 6px;
            }
            .toc-body::-webkit-scrollbar-thumb {
                background: #a78bfa;
                border-radius: 3px;
            }
            .toc-body::-webkit-scrollbar-track {
                background: rgba(0, 0, 0, 0.3);
            }
            .toc-nav-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
                background: rgba(167, 139, 250, 0.04);
                border: 1px solid rgba(167, 139, 250, 0.15);
                padding: 12px;
                border-radius: 8px;
                margin-bottom: 20px;
            }
            .toc-nav-link {
                color: #38bdf8;
                text-decoration: none;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .toc-nav-link:hover {
                color: #a78bfa;
                text-shadow: 0 0 4px rgba(167, 139, 250, 0.4);
            }
            .toc-section {
                margin-bottom: 24px;
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.03);
                padding: 14px;
                border-radius: 8px;
            }
            .toc-section-title {
                font-size: 12px;
                color: #38bdf8;
                border-bottom: 1px solid rgba(56, 189, 248, 0.25);
                padding-bottom: 4px;
                margin-bottom: 10px;
                font-weight: bold;
                text-shadow: 0 0 4px rgba(56, 189, 248, 0.3);
            }
            .toc-code-block {
                background: #000;
                color: #22c55e;
                padding: 8px;
                border-radius: 4px;
                font-family: monospace;
                font-size: 10px;
                margin: 6px 0;
                border: 1px solid rgba(34, 197, 94, 0.2);
                overflow-x: auto;
            }
            .toc-badge {
                font-size: 9px;
                padding: 1px 5px;
                border-radius: 3px;
                font-weight: bold;
                margin-right: 4px;
            }
            .toc-badge-voice {
                background: rgba(167, 139, 250, 0.15);
                color: #a78bfa;
                border: 1px solid rgba(167, 139, 250, 0.3);
            }
            .toc-badge-key {
                background: rgba(234, 179, 8, 0.15);
                color: #eab308;
                border: 1px solid rgba(234, 179, 8, 0.3);
            }
        `;
        document.head.appendChild(style);
    }

    // ฟังก์ชันช่วยตรวจสอบค่า Config แบบดั้งเดิม (ES5 Safe Fallback) เพื่อไม่ใช้เครื่องหมาย ?.
    function getCoreConfig() {
        if (window.MrChodButlerInstance && window.MrChodButlerInstance.settingsManager) {
            return window.MrChodButlerInstance.settingsManager.config || null;
        }
        return null;
    }

    // ฟังก์ชันดึงตารางเวลาเปิด-ปิดอัตโนมัติที่ตั้งค่าไว้และสรุปเป็นข้อความรายงาน
    function getScheduleReport() {
        const config = getCoreConfig();
        if (!config || !config.schedules) {
            return "❌ ไม่พบข้อมูลตารางตั้งเวลาของระบบในขณะนี้ครับเจ้านาย";
        }

        let report = "⏱️ *รายงานตารางเวลาทำงานอัตโนมัติ* ⚡\n\n";
        let hasActiveSchedule = false;

        for (let i = 1; i <= 6; i++) {
            const relay = config.relays ? config.relays[i] : null;
            const sched = config.schedules ? config.schedules[i] : null;
            
            if (sched && sched.enabled) {
                hasActiveSchedule = true;
                const relayName = relay ? relay.name : `รีเลย์ ${i}`;
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

    // ฟังก์ชันสร้างและฝังโครงร่างแผงคู่มือเล่มใหญ่
    function createTOCModal() {
        injectTOCStyles();

        const modal = document.createElement("div");
        modal.id = MODAL_ID;

        modal.innerHTML = `
            <div class="toc-header">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 16px;">📖</span>
                    <span class="toc-title">AI MR. CHOD BUTLER - คู่มือสาระบรรณและแผนผังระบบ</span>
                </div>
                <span class="toc-close-btn" id="mrChodCloseTOC">[ปิดหน้าต่าง - คีย์ลัด T]</span>
            </div>
            
            <div class="toc-body">
                
                <!-- สารบัญแผนผังการเข้าถึงรวดเร็ว -->
                <div class="toc-section-title">📌 สารสารบัญสำหรับการเข้าถึงด่วน</div>
                <div class="toc-nav-grid">
                    <span class="toc-nav-link" onclick="document.getElementById('sec-overview').scrollIntoView({behavior:'smooth'})">1. ภาพรวมโครงสร้างระบบสแตตฟูล</span>
                    <span class="toc-nav-link" onclick="document.getElementById('sec-webgui').scrollIntoView({behavior:'smooth'})">2. การใช้แผงหน้าจอเบราว์เซอร์ (GUI)</span>
                    <span class="toc-nav-link" onclick="document.getElementById('sec-telegram').scrollIntoView({behavior:'smooth'})">3. ระบบเชื่อมต่อและบอท Telegram</span>
                    <span class="toc-nav-link" onclick="document.getElementById('sec-schedule').scrollIntoView({behavior:'smooth'})">4. ตารางตั้งเวลาและ Heuristic Parser</span>
                    <span class="toc-nav-link" onclick="document.getElementById('sec-voice').scrollIntoView({behavior:'smooth'})">5. พจนานุกรมคำสั่งเสียงอัจฉริยะทั้งหมด</span>
                    <span class="toc-nav-link" onclick="document.getElementById('sec-shortcuts').scrollIntoView({behavior:'smooth'})">6. คีย์ลัดด่วนแป้นพิมพ์ (Hotkeys)</span>
                </div>

                <!-- 1. ข้อมูลภาพรวมโครงสร้างระบบ -->
                <div class="toc-section" id="sec-overview">
                    <div class="toc-section-title">1. ภาพรวมโครงสร้างระบบสแตตฟูล</div>
                    ระบบควบคุมเครือข่ายนี้ถูกออกแบบให้เป็นระบบแบบมีสถานะ (Stateful AI Cognitive Controller) ผนวกชุดสัญญาณจำลอง IoT และชีวภาพ (ChodBrain 3D Map) ซึ่งประมวลผลคำสั่งแบบเรียลไทม์ผ่านโครงสร้างโมดูลาร์ย่อย 6 ส่วนหลัก:
                    <ul>
                        <li><b>SettingsManager</b>: จัดเก็บโครงข่าย URL, ตัวแปร Relays, และตารางเวลาอัตโนมัติลงบน LocalStorage ของบราวเซอร์อย่างถาวร</li>
                        <li><b>IoTController</b>: ควบคุมการส่งสัญญาณเครือข่ายไปยังบอร์ดรีเลย์ปลายทาง ผ่านการดึงสัญญานแบบ Asynchronous Fetch</li>
                        <li><b>SpeechEngine</b>: สังเคราะห์เสียงพูดภาษาไทยที่เสถียรและปิดกั้นการกระตุกของเสียงด้วยระบบคิวสัญญาน</li>
                        <li><b>IntentParser</b>: สมองแกนหลักที่แปลเจตจำนงของข้อความ สนับสนุนบริบทก่อนหน้า (Context-Aware)</li>
                        <li><b>ButlerUI</b>: หน้าต่างวิดเจ็ตแสดงสถานะ แผงจำลองอุปกรณ์ ปุ่มกด และระบบแสดงประวัติ Log</li>
                        <li><b>Telegram Module</b>: ปฏิบัติการรับคำสั่งระยะไกล, Polling ป้องกันชน และซิงค์สถานะปุ่มกดสวิตช์เรืองแสง</li>
                    </ul>
                </div>

                <!-- 2. วิธีใช้งานแผงหน้าต่างเบราว์เซอร์ -->
                <div class="toc-section" id="sec-webgui">
                    <div class="toc-section-title">2. การใช้แผงหน้าจอเบราว์เซอร์ (GUI)</div>
                    แผงควบคุมหลัก MR. CHOD AI BUTLER CORE ที่ฝังอยู่ด้านขวาล่างของบราวเซอร์ มีเครื่องมือตอบสนองที่สำคัญดังนี้:
                    <ul>
                        <li><b>แผงจำลองสถานะเครือข่าย (System Status)</b>: แสดงสัญญานการเชื่อมต่อ เครือข่าย และสมองชีวภาพจำลอง</li>
                        <li><b>แถบควบคุมด้วยเสียง (Voice Command)</b>: ดักจับคำสั่งเสียงและวิเคราะห์ผ่าน Web Speech API</li>
                        <li><b>กล่องแสดงการเปลี่ยนสถานะของสวิตช์บอร์ดจำลอง (Smart Home Device)</b>: 
                            <br>• แตะแถบป้ายสถานะ <span class="toc-badge toc-badge-key">[ ON ]</span> หรือ <span class="toc-badge toc-badge-key">[ OFF ]</span> เพื่อทำการสั่งสลับบอร์ดตรงตัวผ่าน HTTP URL ทันที
                        </li>
                        <li><b>กล่องกรอกข้อความคำสั่งและควบคุมด่วนด้านล่าง</b>:
                            <br>• <span class="action-link">🎙️ [พูด]</span> : เปิดใช้งานโหมดฟังคำสั่งเสียงของ AI
                            <br>• <span class="action-link">⌨️ [พิมพ์]</span> : โฟกัสเคอร์เซอร์ป้อนคำสั่งพิมพ์ด้วยมือ
                            <br>• <span class="action-link">⚙️ [ตั้งค่า]</span> : เปิดหน้าต่างแก้ URL ทั้ง 6 ช่อง โดยจะขยายขนาดจอใหญ่ (Large) ให้อัตโนมัติเพื่อให้กรอกลิงก์สะดวกขึ้น
                        </li>
                    </ul>
                </div>

                <!-- 3. ระบบบอท Telegram -->
                <div class="toc-section" id="sec-telegram">
                    <div class="toc-section-title">3. ระบบเชื่อมต่อและบอท Telegram</div>
                    หน้าต่างแผงลอย <b>🤖 Telegram Config</b> (ลากปรับตำแหน่งได้) ทำหน้าที่เปิดสะพานสั่งงานสำรองจากโทรศัพท์มือถือผ่านแอปพลิเคชัน Telegram:
                    <ul>
                        <li><b>ขั้นตอนการผูกระบบ</b>: นำ Bot Token (จาก @BotFather) และ Chat ID (จาก @userinfobot) มาป้อนใส่ช่องแล้วกด "บันทึกและเชื่อมต่อ"</li>
                        <li><b>การควบคุมระยะไกล (Control Panel Inline)</b>: บอทจะส่งแผงควบคุมสวิตช์ 6 ช่องแบบเรืองแสงเข้าแชท เมื่อปุ่มหน้าเว็บเปลี่ยนสี ปุ่มบน Telegram จะอัปเดตสีตามทันทีแบบสมบูรณ์</li>
                        <li><b>คำสั่งควบคุมทั่วไปในห้องแชท Telegram</b>:
                            <br>• พิมพ์ <span class="toc-code-block">/start</span> , <span class="toc-code-block">/menu</span> หรือ <span class="toc-code-block">/help</span> เพื่อเรียกแผงรีโมตควบคุมสวิตช์และดรัคเคมีจำลอง
                        </li>
                    </ul>
                </div>

                <!-- 4. ระบบวิเคราะห์เวลาและ IP Address -->
                <div class="toc-section" id="sec-schedule">
                    <div class="toc-section-title">4. ตารางตั้งเวลาและ Heuristic Parser</div>
                    ระบบรองรับการตั้งเวลาเปิดปิดอัตโนมัติอย่างมีคุณภาพผ่านการพิมพ์/พูดสั่งการในห้องแชท Telegram โดยมีรายละเอียดลอจิกดังนี้:
                    <ul>
                        <li><b>ระบบวิเคราะห์เวลาแบบ Heuristic (IP Address Protection)</b>: ตัวประมวลผลได้รับการออกแบบให้ใช้ Regex ตรวจพิกัดลอย `(?<!\\d)[0-2]?\\d[:.][0-5]\\d(?!\\d)` ป้องกันเวลาปลอมที่อาจสกัดมาจากพิกัดตัวเลขใน IP บอร์ด (เช่น บัคตรวจจับ `.1.18` จาก `.1.189` ปลอมเป็นเวลาเปิด)</li>
                        <li><b>โครงสร้างไพพ์ไลน์แยกคีย์เวิร์ด (Sanitization Pipeline)</b>: สคริปต์โทรเลขจะกรองล้างลิงก์ URL ออกไปโดยสมบูรณ์ ก่อนจะส่งคีย์เวิร์ดเข้าวิเคราะห์ ทำให้การสั่งอย่างไม่ตั้งใจไม่ทำให้ฐานข้อมูลอุปกรณ์พัง</li>
                        <li><b>ตัวอย่างประโยคการตั้งตารางเวลา</b>:
                            <div class="toc-code-block">"ตั้งเวลา น้ำบ่อปลา เปิด 09.30 ปิด 18.00.http://192.168.1.189/RELAY=OFF"</div>
                            <i>*ระบบสกัดเวลาได้ 09:30 (เปิด) และ 18:00 (ปิด) ลบลิงก์ URL ขยะพ่วงท้าย คัดแยกตัวแปรสำเร็จ ได้คีย์อุปกรณ์ "น้ำบ่อปลา" (Relay 02) อย่างสมบูรณ์*</i>
                        </li>
                        <li><b>ตัวอย่างคำสั่งสากลในการพิมพ์ตั้งเวลาเพิ่มเติม</b>:
                            <br>• เปิดและปิด: <span class="toc-code-block">ตั้งเวลา [ชื่ออุปกรณ์] เปิด [เวลา] ปิด [เวลา]</span>
                            <br>• เปิดระบบอย่างเดียว: <span class="toc-code-block">ตั้งเวลา [ชื่ออุปกรณ์] เปิด [เวลา]</span>
                            <br>• ปิดตารางเวลา: <span class="toc-code-block">ยกเลิกตั้งเวลา [ชื่ออุปกรณ์]</span>
                            <br>• ตรวจเช็คตารางปัจจุบัน: <span class="toc-code-block">ตรวจสอบตารางเวลา</span>
                        </li>
                    </ul>
                </div>

                <!-- 5. พจนานุกรมคำสั่งเสียงและการสนทนาทั้งหมด -->
                <div class="toc-section" id="sec-voice">
                    <div class="toc-section-title">5. พจนานุกรมคำสั่งเสียงอัจฉริยะทั้งหมด</div>
                    คุณสามารถป้อนคำสั่งผ่านแผงพิมพ์หน้าเว็บ หรือพูดไมโครโฟนภาษาไทย เพื่อกระตุ้น Intent Parser แกนหลักได้ดังนี้:
                    <ul>
                        <li><span class="toc-badge toc-badge-voice">[คำสั่งล้างความจำและขยะ]</span> <b>"Trojan"</b>
                            <br>• <u>ผลลัพธ์</u>: ทำลายประวัติตั้งค่าทั้งหมดใน LocalStorage ล้างโทเค็น Telegram แจ้งคำเตือน และประมวลผลสั่งรีบูตหน้าต่างบราวเซอร์ใหม่ในอีก 7.5 วินาที
                        </li>
                        <li><span class="toc-badge toc-badge-voice">[คำสั่งพรางตาแผงตั้งค่า]</span> <b>"บัง"</b>
                            <br>• <u>ผลลัพธ์</u>: ซ่อนหน้าต่างป้อนโทเค็น Telegram (tg-config-panel) ออกจากจออย่างมิดชิด
                        </li>
                        <li><span class="toc-badge toc-badge-voice">[คำสั่งเรียกแผงตั้งค่ากลับ]</span> <b>"แสดงเทเลแกรม"</b> / <b>"โชว์เทเลแกรม"</b>
                            <br>• <u>ผลลัพธ์</u>: คืนการแสดงผลหน้าต่างกรอกโทเค็น Telegram
                        </li>
                        <li><span class="toc-badge toc-badge-voice">[คำสั่งขยายหน้าต่างตั้งเวลาบอร์ด]</span> <b>"จะตั้งเวลา"</b> / <b>"ตารางเวลา"</b>
                            <br>• <u>ผลลัพธ์</u>: กางแผงควบคุมกำหนดเวลา 24 ชั่วโมงขนาดใหญ่ออกมาแสดงผลกึ่งกลางจอ
                        </li>
                        <li><span class="toc-badge toc-badge-voice">[คำสั่งเปิดหน้าต่างแก้ URL]</span> <b>"จะเพิ่ม"</b> / <b>"ตั้งค่า"</b> / <b>"เปิดตั้งค่า"</b>
                            <br>• <u>ผลลัพธ์</u>: เปิดบอร์ดกรอก URL บอร์ดรีเลย์ช่อง 1-6 พร้อมขยายขนาดความกว้างแบบจอใหญ่
                        </li>
                        <li><span class="toc-badge toc-badge-voice">[คำสั่งสลับหน้าเว็บไปจอสอง]</span> <b>"ย้ายไปหน้าสอง"</b> / <b>"เปิดหน้าสอง"</b>
                            <br>• <u>ผลลัพธ์</u>: จำลองการกดปุ่มเปลี่ยนจอ Deck 02 อัตโนมัติ
                        </li>
                        <li><span class="toc-badge toc-badge-voice">[คำสั่งเปิดสวิตช์ทั้งหมด]</span> <b>"เปิดทั้งหมด"</b> / <b>"เปิดระบบทั้งหมด"</b>
                            <br>• <u>ผลลัพธ์</u>: สั่งเปิด Relay 1-6 ทันทีพร้อมกัน
                        </li>
                        <li><span class="toc-badge toc-badge-voice">[คำสั่งปิดสวิตช์ทั้งหมด]</span> <b>"ปิดทั้งหมด"</b> / <b>"ปิดระบบทั้งหมด"</b>
                            <br>• <u>ผลลัพธ์</u>: สั่งปิดการเชื่อมต่อ Relay 1-6 ทั้งหมดทันที
                        </li>
                        <li><span class="toc-badge toc-badge-voice">[คำสั่งเจาะจงรายสวิตช์]</span> <b>"เปิด [ชื่ออุปกรณ์]"</b> / <b>"ปิด [ชื่ออุปกรณ์]"</b>
                            <br>• <u>ผลลัพธ์</u>: ควบคุมรายตัว เช่น <i>"เปิดน้ำบ่อปลา"</i>, <i>"ปิดไฟหน้าคอม"</i>
                        </li>
                        <li><span class="toc-badge toc-badge-voice">[คำสั่งระบบบริบทถามกลับ]</span> <b>"[ชื่ออุปกรณ์เฉยๆ]"</b> (เช่นพูดคำว่า <i>"ไฟหน้าคอม"</i>)
                            <br>• <u>ผลลัพธ์</u>: บัตเลอร์จะจำบริบท (Waiting Context) และถามกลับว่าต้องการให้เปิดหรือปิดภายในเวลา 20 วินาที ซึ่งสนับสนุนการตอบภาษาพูดว่า <i>"ใช่/ไม่ใช่/ตกลง/ยกเลิก"</i> ในคำตอบถัดไปด้วย
                        </li>
                    </ul>
                </div>

                <!-- 6. ตารางปุ่มคีย์ลัด Hotkeys -->
                <div class="toc-section" id="sec-shortcuts">
                    <div class="toc-section-title">6. คีย์ลัดด่วนแป้นพิมพ์ (Hotkeys)</div>
                    ระบบสนับสนุนคีย์ลัดด่วนเพื่อการควบคุมที่คล่องตัว:
                    <table style="width:100%; font-size:10px; border-collapse: collapse; margin-top:8px;">
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                            <th style="text-align:left; padding:4px; color:#a78bfa;">ปุ่มกด</th>
                            <th style="text-align:left; padding:4px; color:#a78bfa;">พฤติกรรมการทำงานของปุ่ม</th>
                        </tr>
                        <tr style="border-bottom: 1px dashed rgba(255,255,255,0.05);">
                            <td style="padding:4px;"><span class="toc-badge toc-badge-key">T</span> หรือ <span class="toc-badge toc-badge-key">t</span></td>
                            <td style="padding:4px;">สลับเปิด/ปิด หน้าต่างสารบัญและคู่มือการใช้งานระบบอย่างละเอียดเล่มนี้ (เมื่อไม่ได้พิมพ์อยู่ในอินพุต)</td>
                        </tr>
                    </table>
                </div>

            </div>
        `;

        document.body.appendChild(modal);

        // จัดการเหตุการณ์ปิดคู่มือทางปุ่ม
        document.getElementById("mrChodCloseTOC").addEventListener("click", () => {
            modal.style.display = "none";
        });
    }

    // ฟังก์ชันสั่งสลับโหมดเปิด/ปิดสารบัญ (Toggle Display)
    function toggleTOCModal() {
        const modal = document.getElementById(MODAL_ID);
        if (modal) {
            if (modal.style.display === "none") {
                modal.style.display = "block";
            } else {
                modal.style.display = "none";
            }
        } else {
            createTOCModal();
            document.getElementById(MODAL_ID).style.display = "block";
        }
    }

    // ดักจับสัญญาณแป้นพิมพ์คีย์ลัด T
    document.addEventListener("keydown", (e) => {
        const activeEl = document.activeElement;
        
        // ข้ามเหตุการณ์และละเว้นหากผู้ใช้กำลังพิมพ์ข้อความอยู่ในกล่องอินพุต เพื่อไม่ให้คู่มือเด้งตัดอารมณ์ขณะพิมพ์
        if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
            return;
        }

        if (e.key === "T" || e.key === "t") {
            e.preventDefault();
            toggleTOCModal();
        }
    });

    console.log("📖 [Mr. Chod TOC Extension] ติดตั้งระฆังคู่มือสารสารบัญพร้อมสแตนด์บายผ่านคีย์ลัด [T] สำเร็จแล้วครับเจ้านาย!");
})();