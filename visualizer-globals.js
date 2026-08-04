// ==============================================================================================
//    CHOD COGNITIVE SYSTEM VISUALIZER - GLOBAL SHARED STATES & UTILITIES (visualizer-globals.js)
// ==============================================================================================

// 1. การตั้งค่าระบบเชื่อมต่อ TrojanAI IoT Relay
var TrojanAI_Config = {
    baseURL: "http://192.168.1.188",
    relays: {
        1: { name: "ไฟหลัก", on: "http://192.168.1.40/toggle", off: "http://192.168.1.40/toggle" },
        2: { name: "มอเตอร์ปั๊ม", on: "http://192.168.1.189/RELAY=ON", off: "http://192.168.1.189/RELAY=OFF" },
        3: { name: "ระบายอากาศ", on: "http://192.168.1.188/ON", off: "http://192.168.1.188/OFF" },
        4: { name: "อุปกรณ์เสริม", on: "http://192.168.1.188/ONVIDEO", off: "http://192.168.1.188/OFFVIDEO" },
        5: { name: "ไฟสวน", on: "http://192.168.1.188/ON", off: "http://192.168.1.188/OFF" },
        6: { name: "เครื่องกรองน้ำ", on: "http://192.168.1.188/ON", off: "http://192.168.1.188/OFF" }
    }
};

// 2. ตัวแปรควบคุมระบบขยับลากลอยตัว HUD
var isWindowed = false;
var activeDrag = false;
var currentX = 0;
var currentY = 0;
var initialX = 0;
var initialY = 0;
var xOffset = 0;
var yOffset = 0;

// 3. ตัวแปรเก็บสถานะการทำงานของระบบสั่งด้วยเสียงและจอเสริมจอที่ 2
var secondWindow = null;
var recognition = null;
var isListening = false;

// 4. แหล่งเก็บตัวแปรอ้างอิงถึง Canvases และ DOMs
var canvas = null;
var ctx = null;
var eegCanvas = null;
var eegCtx = null;
var specCanvas = null;
var specCtx = null;
var logContainer = null;

// 5. ตัวแปรจำลองสภาวะเคมีในสมองและแผงยาเสมือน
var activeDrug = null;
var drugGlutamateMod = 0.0;
var drugGabaMod = 0.0;
var drugDopamineMod = 0.0;
var drugAdrenalineMod = 0.0;
var drugSerotoninMod = 0.0;

// 6. ตัวเก็บโครงสร้างพิกเซลสมองจำลอง 3D
var vertices = [];
var edges = [];
var impulses = [];
var ambientParticles = [];
var maxImpulses = 75;
var lobeCenters = {};

// 7. ตัวประมวลผลความเคลื่อนไหว 3D และตัวแปรอัปเดตคลื่น EEG
var angleY = 0;
var angleX = 0.20;
var animationId = null;
var projectedCache = [];
var mouseX = 0;
var mouseY = 0;
var eegOffset = 0;

// 8. [NEW!] ข้อมูลระบบสลับชุดสีธีมแสดงผลส่วนหน้าจอหลัก
var themes = {
    aqua: { rgb: "56, 189, 248", hex: "#38bdf8", name: "Aqua Neon" },
    green: { rgb: "34, 197, 94", hex: "#22c55e", name: "Matrix Green" },
    magenta: { rgb: "217, 70, 239", hex: "#d946ef", name: "Cyberpunk" },
    amber: { rgb: "245, 158, 11", hex: "#f59e0b", name: "Amber Warning" }
};
var selectedTheme = localStorage.getItem("chod_selected_theme") || "aqua";

// 9. [NEW!] ตัวแปรสำหรับคำนวณสถิตินักวินิจฉัย (Diagnostics)
var times = [];
var fps = 0;
var lastPingLatency = "CHECKING...";

// 10. [NEW!] ฟังก์ชันส่งคลื่นสัญญานเสียงสังเคราะห์ Sci-Fi Beep (Web Audio API)
function playSciFiBeep(frequency = 800, type = 'sine', duration = 0.15) {
    if (!window.AudioContext && !window.webkitAudioContext) return;
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + duration);
    } catch(e) {
        // ถูกบล็อกด้วยเงื่อนไขความปลอดภัยเว็บบราวเซอร์กรณีที่ยังไม่มีการกดบนสกรีน
    }
}

// 11. [NEW!] ฟังก์ชันส่งคำสั่ง Ping IoT บอร์ดหลัก
function checkIotPing() {
    const start = Date.now();
    fetch("http://192.168.1.188/ping", { method: 'GET', mode: 'no-cors' })
        .then(() => {
            const latency = Date.now() - start;
            lastPingLatency = latency + "ms";
        })
        .catch(() => {
            lastPingLatency = "OFFLINE ⚠️";
        });
}
setInterval(checkIotPing, 10000); // วิ่งยิง Ping เช็คสถานะทางกายภาพของบอร์ด IOT ทุก 10 วินาที

// 12. [NEW!] ฟังก์ชันสำหรับควบคุมหน่วยความจำถาวร LocalStorage
function saveEngramToLocal(chem) {
    const dataToSave = {
        chem: chem,
        theme: selectedTheme,
        timestamp: Date.now()
    };
    localStorage.setItem("chod_engram_data", JSON.stringify(dataToSave));
}

function loadEngramFromLocal() {
    const saved = localStorage.getItem("chod_engram_data");
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            return parsed;
        } catch(e) {}
    }
    return null;
}

// ฟังก์ชันส่งสัญญานไปสั่งการ TrojanAI
function sendTrojanCommand(relayId, state) {
    const relay = TrojanAI_Config.relays[relayId];
    if (!relay) return;

    const url = state ? relay.on : relay.off;
    if (!url || url === "") return;

    injectLog(`📡 IOT OUTBOUND: [RELAY ${relayId} - ${relay.name}] → SENDING ${state ? "ON" : "OFF"}`);
    playSciFiBeep(state ? 1400 : 900, 'sine', 0.12); // ส่งเสียงเตือนเวลามี IoT Outbound
    
    if (secondWindow && !secondWindow.closed) {
        injectSecondWindowLog(`IOT LINK: ${relay.name.toUpperCase()} DISPATCHED → ${state ? 'ON' : 'OFF'}`);
    }

    fetch(url, { method: 'GET', mode: 'no-cors' })
        .then(() => {
            console.log(`Command sent to Relay ${relayId}: ${url}`);
        })
        .catch(err => {
            injectLog(`⚠️ NETWORK ERROR ON RELAY ${relayId}`);
        });
}

// ฟังก์ชันเรนเดอร์บันทึก Log หน้าจอหลัก
function injectLog(msg) {
    if (!logContainer) return;
    const line = document.createElement("div");
    line.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logContainer.appendChild(line);
    while (logContainer.children.length > 11) {
        logContainer.removeChild(logContainer.firstChild);
    }
}

// ฟังก์ชันเรนเดอร์บันทึก Log หน้าจอที่ 2
function injectSecondWindowLog(msg) {
    if (!secondWindow || secondWindow.closed) return;
    const secLogContainer = secondWindow.document.getElementById("m2-logs");
    if (!secLogContainer) return;
    const line = secondWindow.document.createElement("div");
    line.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    secLogContainer.appendChild(line);
    while (secLogContainer.children.length > 13) {
        secLogContainer.removeChild(secLogContainer.firstChild);
    }
}

// ฟังก์ชันสำหรับเปิดหน้าต่างจอประสาทที่สอง (Memory Monitor 2)
function openSecondMonitor() {
    if (secondWindow && !secondWindow.closed) {
        secondWindow.focus();
        return;
    }

    playSciFiBeep(440, 'triangle', 0.25);

    secondWindow = window.open("", "ChodMemoryMonitor2", "width=850,height=600,menubar=no,status=no,toolbar=no");
    if (!secondWindow) {
        injectLog("SYSTEM WARNING: POPUP BLOCKED. PLEASE ALLOW POPUPS FOR DUAL MONITOR HUD.");
        return;
    }

    secondWindow.document.write(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <title>CHOD COGNITIVE MONITOR 2 - MEMORY & ENGRAM DECK</title>
            <style>
                body {
                    background: radial-gradient(circle at center, #07020d 0%, #010003 100%);
                    color: #c084fc;
                    font-family: 'Courier New', monospace;
                    margin: 0;
                    padding: 20px;
                    overflow: hidden;
                    user-select: none;
                    box-sizing: border-box;
                }
                body::before {
                    content: " ";
                    display: block;
                    position: absolute;
                    top: 0; left: 0; bottom: 0; right: 0;
                    background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.4) 50%);
                    background-size: 100% 4px;
                    z-index: 100;
                    pointer-events: none;
                    opacity: 0.3;
                }
                .monitor-container {
                    border: 1px solid rgba(168, 85, 247, 0.25);
                    background: rgba(10, 5, 20, 0.9);
                    padding: 20px;
                    height: 94vh;
                    display: flex;
                    flex-direction: column;
                    box-shadow: inset 0 0 30px rgba(168, 85, 247, 0.08);
                    position: relative;
                }
                .title {
                    font-size: 15px;
                    font-weight: bold;
                    letter-spacing: 3px;
                    color: #c084fc;
                    border-bottom: 1px solid rgba(168, 85, 247, 0.2);
                    padding-bottom: 10px;
                    margin-bottom: 15px;
                    text-shadow: 0 0 10px rgba(168, 85, 247, 0.5);
                }
                .grid {
                    display: grid;
                    grid-template-columns: 1.2fr 1fr;
                    gap: 15px;
                    flex-grow: 1;
                    height: 45%;
                }
                .sub-panel {
                    border: 1px solid rgba(168, 85, 247, 0.15);
                    background: rgba(4, 2, 8, 0.9);
                    padding: 15px;
                    display: flex;
                    flex-direction: column;
                    position: relative;
                }
                .sub-panel::before {
                    content: ""; position: absolute; top: -1px; left: -1px; width: 8px; height: 8px; border-top: 1.5px solid #a855f7; border-left: 1.5px solid #a855f7;
                }
                .sub-title {
                    font-size: 10px;
                    color: #e9d5ff;
                    font-weight: bold;
                    margin-bottom: 12px;
                    letter-spacing: 1.5px;
                    border-bottom: 1px solid rgba(168, 85, 247, 0.1);
                    padding-bottom: 4px;
                }
                .stat-row {
                    font-size: 9px;
                    margin-bottom: 8px;
                    color: #a78bfa;
                    display: flex;
                    justify-content: space-between;
                }
                .bar-bg {
                    height: 5px;
                    background: rgba(168, 85, 247, 0.05);
                    border-radius: 1px;
                    overflow: hidden;
                    border: 1px solid rgba(168, 85, 247, 0.1);
                    margin-bottom: 10px;
                }
                .bar-fill {
                    height: 100%;
                    width: 0%;
                    background: #a855f7;
                    box-shadow: 0 0 8px #a855f7;
                    transition: width 0.3s ease;
                }
                #memory-grid-canvas {
                    width: 100%;
                    height: 100%;
                    background: #030107;
                    border: 1px solid rgba(168, 85, 247, 0.1);
                }
                .logs-container {
                    margin-top: 15px;
                    height: 40%;
                    display: flex;
                    flex-direction: column;
                }
                .logs {
                    flex-grow: 1;
                    font-size: 8px;
                    color: #f3e8ff;
                    overflow-y: hidden;
                    line-height: 1.4;
                    background: #020104;
                    padding: 12px;
                    border: 1px solid rgba(168, 85, 247, 0.15);
                    font-family: monospace;
                    text-shadow: 0 0 2px rgba(168, 85, 247, 0.2);
                }
                .hint {
                    font-size: 8px;
                    color: rgba(168, 85, 247, 0.4);
                    text-align: center;
                    margin-top: 8px;
                    letter-spacing: 1px;
                }
            </style>
        </head>
        <body>
            <div class="monitor-container">
                <div class="title">🔮 CHOD COGNITIVE SYSTEM // DUAL DECK 02 [MEMORY & ENGRAM STORAGE]</div>
                
                <div class="grid">
                    <div class="sub-panel">
                        <div class="sub-title">🧬 SYNAPTIC PLASTICITY & TEMPORAL INTEGRITY</div>
                        
                        <div class="stat-row">TEMPORAL LOBE BOLD RESPONSE: <span id="m2-temporal-bold">0.0%</span></div>
                        <div class="bar-bg"><div id="m2-fill-bold" class="bar-fill" style="background: #a855f7;"></div></div>
                        
                        <div class="stat-row">LONG-TERM POTENTIATION (LTP) WEIGHT: <span id="m2-ltp-weight">0.00</span></div>
                        <div class="bar-bg"><div id="m2-fill-ltp" class="bar-fill" style="background: #e9d5ff;"></div></div>
                        
                        <div class="stat-row">SYNAPTIC PLASTICITY INDEX: <span id="m2-plasticity">0.0000</span></div>
                        <div class="bar-bg"><div id="m2-fill-plasticity" class="bar-fill" style="background: #c084fc;"></div></div>
                        
                        <div class="stat-row">ENGRAM CONSOLIDATION RATE: <span id="m2-engram-rate">0%</span></div>
                        <div class="bar-bg"><div id="m2-fill-engram" class="bar-fill" style="background: #38bdf8; box-shadow: 0 0 8px #38bdf8;"></div></div>

                        <div class="stat-row">HIPPOCAMPUS RETRIEVAL EFFICIENCY: <span id="m2-retrieval">0%</span></div>
                        <div class="bar-bg"><div id="m2-fill-retrieval" class="bar-fill" style="background: #22c55e; box-shadow: 0 0 8px #22c55e;"></div></div>
                    </div>

                    <div class="sub-panel" style="padding: 10px;">
                        <div class="sub-title">🗺️ ENGRAM MAP MATRIX DECK</div>
                        <canvas id="memory-grid-canvas"></canvas>
                    </div>
                </div>

                <div class="sub-panel logs-container">
                    <div class="sub-title">⚡ REALTIME ENGRAM CONSOLIDATION & RETRIEVAL LOGS</div>
                    <div id="m2-logs" class="logs"></div>
                </div>
                
                <div class="hint">[ DRAG THIS MONITOR TO SCREEN 2 FOR AN EXPANDED DOUBLE-DECK VISION EXPERIENCE ]</div>
            </div>
        </body>
        </html>
    `);
    secondWindow.document.close();
    injectLog("SYSTEM: LINK ESTABLISHED WITH MONITOR 2 (PORTAL ACTIVE).");
}