// ==============================================================================================
//    CHOD COGNITIVE SYSTEM VISUALIZER - หน้าจอบัญชาการ HUD STYLES & DOM BUILDER (visualizer-ui.js)
// ==============================================================================================

// ประกาศค่าเริ่มต้นสำหรับระบบพิกัด Drag ป้องกันพิกัดตกหล่น (กรณีไฟล์อื่นยังไม่มีการระบุ)
if (typeof xOffset === 'undefined') window.xOffset = 0;
if (typeof yOffset === 'undefined') window.yOffset = 0;
if (typeof initialX === 'undefined') window.initialX = 0;
if (typeof initialY === 'undefined') window.initialY = 0;
if (typeof currentX === 'undefined') window.currentX = 0;
if (typeof currentY === 'undefined') window.currentY = 0;
if (typeof activeDrag === 'undefined') window.activeDrag = false;
if (typeof isWindowed === 'undefined') window.isWindowed = false;

// ------------------------------------------------------------
//  ระบบสังเคราะห์เอฟเฟกต์เสียงไซไฟนำร่อง (Sci-Fi Audio Synthesizer Engine)
// ------------------------------------------------------------
function playSciFiBeep(freq = 800, type = 'sine', duration = 0.1) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);

        gainNode.gain.setValueAtTime(0.04, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {
        // ละเว้นกรณีตัวบล็อกความปลอดภัยของเบราว์เซอร์ยังไม่เปิดให้ใช้เสียงต้นทาง
    }
}

// ------------------------------------------------------------
//  ตัวสร้างโครงสร้างหน้าต่างควบคุมและจัดสไตล์แผงสะพานเดินเรือหลัก
// ------------------------------------------------------------
function initCommandDeck() {
    if (document.getElementById("chod-brain-monitor-widget")) return;

    const brainStyle = document.createElement("style");
    brainStyle.innerHTML = `
        /* ตกแต่งโครงสร้างกระจกโปร่งแสง Glassmorphism พื้นหลัง */
        .chod-brain-monitor {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            height: 100dvh;
            background: radial-gradient(circle at center, rgba(3, 8, 18, 0.99) 0%, rgba(1, 2, 4, 1) 100%);
            z-index: 999999;
            display: flex;
            flex-direction: column;
            padding: clamp(10px, 2vh, 20px);
            box-sizing: border-box;
            user-select: none;
            font-family: 'Segoe UI', 'Courier New', Courier, monospace;
            overflow: hidden;
            background-image: 
                linear-gradient(rgba(56, 189, 248, 0.015) 1px, transparent 1px),
                linear-gradient(90deg, rgba(56, 189, 248, 0.015) 1px, transparent 1px);
            background-size: 30px 30px;
            background-position: center;
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
            transform: scale(0.97);
            transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.5s;
        }
        .chod-brain-monitor.active {
            opacity: 1;
            visibility: visible;
            pointer-events: auto;
            transform: scale(1);
        }
        
        /* สแกนเส้นคลื่นกระจกสไตล์แอนะล็อกสั่นไหว */
        .chod-brain-monitor::before {
            content: " ";
            display: block;
            position: absolute;
            top: 0; left: 0; bottom: 0; right: 0;
            background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.35) 50%);
            background-size: 100% 4px;
            z-index: 100;
            pointer-events: none;
            opacity: 0.28;
            animation: holo-flicker 14s infinite;
        }
        
        @keyframes screen-glitch {
            0% { transform: translate(0) skew(0deg); filter: hue-rotate(0deg); }
            10% { transform: translate(-1px, 1px) skew(-0.5deg); }
            12% { transform: translate(1px, -1px) skew(0.5deg); }
            14% { transform: translate(0) skew(0deg); }
            100% { transform: translate(0) skew(0deg); }
        }
        .chod-brain-monitor.overload-glitch {
            animation: screen-glitch 0.6s infinite alternate;
            box-shadow: inset 0 0 100px rgba(239, 68, 68, 0.15) !important;
            border: 1px solid rgba(239, 68, 68, 0.3) !important;
        }

        @keyframes holo-flicker {
            0%, 100% { opacity: 0.3; }
            45% { opacity: 0.35; }
            46% { opacity: 0.05; }
            47% { opacity: 0.3; }
            80% { opacity: 0.3; }
            81% { opacity: 0.02; }
            83% { opacity: 0.35; }
        }

        /* ปรับปรุงแผงควบคุมสไตล์ Glassmorphism ส่องสว่างมุมสะท้อนนีออน */
        .hud-panel {
            background: rgba(4, 11, 23, 0.55);
            backdrop-filter: blur(12px) saturate(180%);
            -webkit-backdrop-filter: blur(12px) saturate(180%);
            border: 1px solid rgba(56, 189, 248, 0.18);
            border-radius: clamp(8px, 1.5vw, 12px);
            padding: clamp(8px, 1.5vw, 16px);
            display: flex;
            flex-direction: column;
            position: relative;
            box-sizing: border-box;
            overflow: hidden;
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.4), inset 0 0 15px rgba(56, 189, 248, 0.03);
        }
        .hud-panel::before {
            content: ""; position: absolute; top: -1px; left: -1px; width: 14px; height: 14px; border-top: 2px solid var(--hud-border-glow, #38bdf8); border-left: 2px solid var(--hud-border-glow, #38bdf8);
        }
        .hud-panel::after {
            content: ""; position: absolute; bottom: -1px; right: -1px; width: 14px; height: 14px; border-bottom: 2px solid var(--hud-border-glow, #38bdf8); border-right: 2px solid var(--hud-border-glow, #38bdf8);
        }
        .hud-panel-title {
            color: var(--hud-text-glow, #38bdf8);
            font-size: clamp(8px, 1.8vw, 10px);
            font-weight: bold;
            letter-spacing: 1.5px;
            margin-bottom: clamp(6px, 1.2vw, 12px);
            border-bottom: 1px solid rgba(56, 189, 248, 0.15);
            padding-bottom: 6px;
            text-shadow: 0 0 5px rgba(56, 189, 248, 0.4);
        }

        /* ตกแต่งเรดาร์ตรวจจับพิกัดวงกลม (Circular Radar HUD) */
        .hud-center-area {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        .hud-canvas-container {
            width: 100%;
            height: clamp(30vh, 40vw, 48vh);
            display: flex;
            justify-content: center;
            align-items: center;
            position: relative;
            cursor: crosshair;
        }
        .radar-hud-grid {
            position: absolute;
            width: 90%;
            height: 90%;
            max-width: 540px;
            max-height: 540px;
            pointer-events: none;
            border-radius: 50%;
            background: 
                radial-gradient(circle, transparent 35%, rgba(56, 189, 248, 0.02) 36%, rgba(56, 189, 248, 0.02) 38%, transparent 39%),
                radial-gradient(circle, transparent 55%, rgba(56, 189, 248, 0.02) 56%, rgba(56, 189, 248, 0.02) 58%, transparent 59%),
                radial-gradient(circle, transparent 75%, rgba(56, 189, 248, 0.02) 76%, rgba(56, 189, 248, 0.02) 78%, transparent 79%);
        }
        .radar-scan-line {
            position: absolute;
            width: 90%;
            height: 90%;
            max-width: 540px;
            max-height: 540px;
            top: 5%;
            border-radius: 50%;
            background: conic-gradient(from 0deg, rgba(56, 189, 248, 0.08) 12deg, transparent 180deg);
            animation: radar-sweep 6s linear infinite;
            pointer-events: none;
        }
        @keyframes radar-sweep {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        #chod-plexus-canvas {
            width: 100%;
            height: 100%;
            max-width: clamp(280px, 70vw, 580px);
            max-height: clamp(280px, 70vw, 580px);
            z-index: 2;
            filter: drop-shadow(0 0 25px var(--brain-glow-color, rgba(56, 189, 248, 0.3)));
        }

        /* ตกแต่งแอนิเมชันเตาปฏิกรณ์พลังงานคอร์ (Voice Arc Reactor Core Animation) */
        .arc-reactor-container {
            width: clamp(80px, 20vw, 130px);
            height: clamp(80px, 20vw, 130px);
            position: relative;
            margin: clamp(8px, 2vw, 15px) auto;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .arc-reactor-outer {
            position: absolute;
            width: clamp(70px, 18vw, 120px);
            height: clamp(70px, 18vw, 120px);
            border: 2px dashed rgba(56, 189, 248, 0.4);
            border-radius: 50%;
            animation: arc-spin-clockwise 15s linear infinite;
            box-shadow: 0 0 15px rgba(56, 189, 248, 0.1);
        }
        .arc-reactor-inner {
            position: absolute;
            width: clamp(50px, 13vw, 90px);
            height: clamp(50px, 13vw, 90px);
            border: 3px double rgba(168, 85, 247, 0.4);
            border-radius: 50%;
            animation: arc-spin-counter 7s linear infinite;
        }
        .arc-reactor-coils {
            position: absolute;
            width: clamp(40px, 10vw, 70px);
            height: clamp(40px, 10vw, 70px);
            border-radius: 50%;
            background: radial-gradient(circle, rgba(56, 189, 248, 0.18) 20%, transparent 70%);
            animation: arc-pulse 2s alternate infinite ease-in-out;
        }
        .arc-reactor-core {
            position: absolute;
            width: clamp(18px, 5vw, 32px);
            height: clamp(18px, 5vw, 32px);
            background: #fff;
            border-radius: 50%;
            box-shadow: 
                0 0 10px #fff,
                0 0 25px var(--brain-glow-color, #38bdf8),
                0 0 45px var(--brain-glow-color, #38bdf8);
            z-index: 5;
        }
        @keyframes arc-spin-clockwise {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        @keyframes arc-spin-counter {
            from { transform: rotate(360deg); }
            to { transform: rotate(0deg); }
        }
        @keyframes arc-pulse {
            0% { transform: scale(0.92); opacity: 0.5; filter: brightness(0.8); }
            100% { transform: scale(1.06); opacity: 1; filter: brightness(1.25); }
        }

        /* ตกแต่งแถบความถี่เสียงประดิษฐ์ (AI Voice Waveform Bars) */
        .voice-waveform-bars {
            display: inline-flex;
            align-items: center;
            gap: clamp(2px, 0.5vw, 3px);
            height: clamp(10px, 2.5vw, 15px);
            margin-left: 8px;
            vertical-align: middle;
        }
        .waveform-bar {
            width: clamp(1.5px, 0.4vw, 2px);
            height: 4px;
            background: #10b981;
            border-radius: 1px;
            transition: height 0.15s ease;
        }
        .voice-waveform-bars.active .waveform-bar {
            animation: jump-wave 1s infinite alternate ease-in-out;
        }
        .voice-waveform-bars.active .waveform-bar:nth-child(2) { animation-delay: 0.15s; }
        .voice-waveform-bars.active .waveform-bar:nth-child(3) { animation-delay: 0.3s; }
        .voice-waveform-bars.active .waveform-bar:nth-child(4) { animation-delay: 0.45s; }
        .voice-waveform-bars.active .waveform-bar:nth-child(5) { animation-delay: 0.6s; }
        @keyframes jump-wave {
            0% { height: 4px; }
            100% { height: clamp(10px, 2.5vw, 15px); }
        }

        .hud-stat-row { margin-bottom: clamp(4px, 1vw, 8px); }
        .hud-stat-label {
            color: #475569;
            font-size: clamp(7px, 1.5vw, 9px);
            font-weight: bold;
            margin-bottom: 3px;
            display: flex;
            justify-content: space-between;
        }
        .hud-progress-bar-bg {
            height: 4px;
            background: rgba(10, 15, 30, 0.95);
            border-radius: 1px;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.02);
        }
        .hud-progress-bar-fill {
            height: 100%;
            width: 50%;
            background: #38bdf8;
            box-shadow: 0 0 5px var(--brain-glow-color, #38bdf8);
            transition: width 0.3s ease;
        }
        .hud-console-logs {
            flex-grow: 1;
            font-size: clamp(7px, 1.5vw, 9px);
            color: #00ffaa;
            overflow-y: auto; 
            line-height: 1.4;
            text-shadow: 0 0 2px rgba(0, 255, 170, 0.15);
            font-family: monospace;
        }
        .hud-mini-canvas {
            width: 100%;
            height: clamp(50px, 10vh, 70px);
            background: rgba(4, 8, 16, 0.9);
            border: 1px solid rgba(56, 189, 248, 0.1);
            border-radius: 4px;
            margin-bottom: 10px;
        }
        .hud-close-btn {
            font-size: clamp(16px, 4vw, 20px);
            cursor: pointer;
            line-height: 1;
            transition: color 0.2s, transform 0.2s;
            color: rgba(255, 255, 255, 0.4);
        }
        .hud-close-btn:hover {
            color: #f87171;
            transform: scale(1.1);
        }
        .hud-main-title {
            color: #38bdf8;
            font-size: clamp(12px, 3vw, 16px);
            font-weight: bold;
            letter-spacing: clamp(2px, 0.6vw, 4px);
            text-shadow: 0 0 8px rgba(56, 189, 248, 0.35);
            margin-bottom: 2px;
        }
        .hud-subtitle {
            color: #475569;
            font-size: clamp(7px, 1.5vw, 9px);
            letter-spacing: 1.2px;
            margin-bottom: clamp(8px, 2vw, 15px);
        }
        .hud-drug-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: clamp(4px, 1vw, 6px);
            margin-bottom: clamp(8px, 2vw, 15px);
        }
        .hud-drug-btn {
            background: rgba(56, 189, 248, 0.05);
            border: 1px solid rgba(56, 189, 248, 0.15);
            color: rgba(56, 189, 248, 0.7);
            font-family: 'Courier New', monospace;
            font-size: clamp(7px, 1.5vw, 9px);
            font-weight: bold;
            padding: clamp(4px, 1vw, 8px) clamp(3px, 0.8vw, 6px);
            cursor: pointer;
            border-radius: 3px;
            transition: all 0.2s ease;
            text-align: center;
            touch-action: manipulation;
        }
        .hud-drug-btn:hover {
            background: rgba(56, 189, 248, 0.18);
            color: #fff;
            box-shadow: 0 0 6px rgba(56, 189, 248, 0.3);
        }
        .hud-drug-btn.active {
            background: rgba(56, 189, 248, 0.3);
            border-color: #00f0ff;
            color: #fff;
            text-shadow: 0 0 4px #fff;
        }
        .hud-interactive-hint {
            font-size: clamp(7px, 1.5vw, 9px);
            color: rgba(0, 240, 255, 0.35);
            letter-spacing: 0.8px;
            margin-top: 10px;
            animation: pulse-op 2s infinite alternate;
        }
        .hud-center-launch-btn {
            background: rgba(168, 85, 247, 0.15);
            border: 1px solid rgba(168, 85, 247, 0.4);
            color: #e9d5ff;
            font-family: 'Courier New', monospace;
            font-size: clamp(8px, 1.8vw, 10px);
            font-weight: bold;
            letter-spacing: 1.5px;
            padding: clamp(6px, 1.5vw, 10px) clamp(12px, 3vw, 20px);
            cursor: pointer;
            border-radius: 4px;
            text-shadow: 0 0 6px rgba(168, 85, 247, 0.6);
            box-shadow: inset 0 0 10px rgba(168, 85, 247, 0.1), 0 0 15px rgba(168, 85, 247, 0.2);
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            z-index: 10;
            touch-action: manipulation;
        }
        .hud-center-launch-btn:hover {
            background: rgba(168, 85, 247, 0.35);
            border-color: #c084fc;
            box-shadow: inset 0 0 15px rgba(168, 85, 247, 0.2), 0 0 20px rgba(168, 85, 247, 0.45);
            color: #fff;
            transform: scale(1.03);
        }
        .hud-main-grid {
            display: grid;
            grid-template-columns: clamp(240px, 30vw, 310px) 1fr clamp(240px, 30vw, 310px);
            gap: clamp(8px, 1.5vw, 15px);
            height: calc(100% - clamp(36px, 6vh, 44px));
        }
        @media (max-width: 1024px) {
            .chod-brain-monitor {
                overflow-y: auto;
                padding: clamp(8px, 1.5vw, 12px);
            }
            .hud-main-grid {
                grid-template-columns: 1fr;
                height: auto;
                overflow: visible;
                gap: clamp(8px, 1.5vw, 15px);
            }
            .hud-panel {
                margin-bottom: 4px;
                overflow: visible;
            }
            .hud-canvas-container { 
                height: clamp(30vh, 45vw, 50vh); 
            }
            .hud-main-title { 
                font-size: clamp(12px, 3vw, 16px); 
                letter-spacing: 2px; 
                text-align: center; 
            }
            .hud-subtitle { 
                font-size: clamp(7px, 1.5vw, 9px); 
                text-align: center; 
                margin-bottom: 8px; 
            }
            .hud-console-logs {
                height: clamp(60px, 15vh, 120px) !important;
                max-height: clamp(60px, 15vh, 120px) !important;
            }
        }
        @media (max-width: 480px) {
            .chod-brain-monitor {
                padding: 6px;
            }
            .hud-panel {
                padding: clamp(6px, 1.2vw, 10px);
            }
            .hud-drug-grid {
                grid-template-columns: 1fr 1fr;
                gap: 4px;
            }
            .hud-drug-btn {
                font-size: clamp(6px, 1.8vw, 8px);
                padding: clamp(4px, 1vw, 6px) 3px;
            }
            .hud-panel-title {
                font-size: clamp(7px, 2vw, 9px);
                letter-spacing: 1px;
            }
            .hud-stat-label {
                font-size: clamp(6px, 1.8vw, 8px);
            }
            .arc-reactor-container {
                width: clamp(60px, 25vw, 90px);
                height: clamp(60px, 25vw, 90px);
            }
            .arc-reactor-outer {
                width: clamp(55px, 23vw, 85px);
                height: clamp(55px, 23vw, 85px);
            }
            .arc-reactor-inner {
                width: clamp(40px, 17vw, 65px);
                height: clamp(40px, 17vw, 65px);
            }
            .arc-reactor-coils {
                width: clamp(30px, 13vw, 50px);
                height: clamp(30px, 13vw, 50px);
            }
            .arc-reactor-core {
                width: clamp(14px, 6vw, 24px);
                height: clamp(14px, 6vw, 24px);
            }
            #chod-plexus-canvas {
                max-width: clamp(200px, 80vw, 400px);
                max-height: clamp(200px, 80vw, 400px);
            }
            .hud-center-launch-btn {
                font-size: clamp(7px, 2vw, 9px);
                padding: clamp(5px, 1.5vw, 8px) clamp(10px, 3vw, 16px);
            }
            .hud-interactive-hint {
                font-size: clamp(6px, 1.8vw, 8px);
            }
        }
        @media (max-height: 500px) and (orientation: landscape) {
            .chod-brain-monitor {
                padding: 6px 12px;
                overflow-y: auto;
            }
            .hud-main-grid {
                grid-template-columns: 1fr 1fr;
                gap: 6px;
                height: auto;
            }
            .hud-canvas-container {
                height: clamp(25vh, 50vh, 55vh);
            }
            .hud-panel {
                padding: 6px 8px;
            }
            .hud-panel-title {
                font-size: clamp(6px, 1.2vw, 8px);
                margin-bottom: 4px;
                padding-bottom: 3px;
            }
            .hud-stat-row {
                margin-bottom: 3px;
            }
            .hud-stat-label {
                font-size: clamp(5px, 1vw, 7px);
            }
            .arc-reactor-container {
                width: clamp(50px, 12vh, 80px);
                height: clamp(50px, 12vh, 80px);
                margin: 6px auto;
            }
            .hud-drug-btn {
                font-size: clamp(5px, 1vw, 7px);
                padding: 2px 4px;
            }
            .hud-console-logs {
                height: clamp(40px, 8vh, 60px) !important;
                max-height: clamp(40px, 8vh, 60px) !important;
                font-size: clamp(5px, 1vw, 7px);
            }
            .hud-mini-canvas {
                height: clamp(30px, 6vh, 50px);
            }
            .hud-main-title {
                font-size: clamp(10px, 2vh, 14px);
                letter-spacing: 1px;
            }
            .hud-subtitle {
                font-size: clamp(5px, 1vw, 7px);
                margin-bottom: 4px;
            }
            #chod-plexus-canvas {
                max-width: clamp(180px, 35vh, 350px);
                max-height: clamp(180px, 35vh, 350px);
            }
        }
        @keyframes pulse-op {
            0% { opacity: 0.3; }
            100% { opacity: 0.7; }
        }
    `;
    document.head.appendChild(brainStyle);

    const monitorContainer = document.createElement("div");
    monitorContainer.id = "chod-brain-monitor-widget";
    monitorContainer.className = "chod-brain-monitor";
    
    monitorContainer.innerHTML = `
        <div id="hud-drag-header" style="
            background: rgba(56, 189, 248, 0.04);
            border: 1px solid rgba(56, 189, 248, 0.15);
            border-radius: 6px;
            height: clamp(30px, 5vh, 36px);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 clamp(10px, 2vw, 15px);
            cursor: move;
            font-size: clamp(7px, 1.5vw, 9px);
            color: #38bdf8;
            letter-spacing: 1px;
            margin-bottom: clamp(6px, 1.2vw, 12px);
            text-shadow: 0 0 5px rgba(56, 189, 248, 0.3);
            flex-shrink: 0;
        ">
            <span>⚡ TROJAN-AI COMMAND DECK</span>
            <div style="display: flex; gap: clamp(8px, 2vw, 15px); align-items: center; flex-shrink: 0;">
                <span id="hud-toggle-mic" style="cursor: pointer; color: #10b981; font-weight: bold; transition: color 0.2s; font-size: clamp(6px, 1.3vw, 8px); white-space: nowrap;">
                    [ ไมค์: ปิด 🎙️ ]
                    <span class="voice-waveform-bars" id="voiceWaveBars">
                        <span class="waveform-bar"></span>
                        <span class="waveform-bar"></span>
                        <span class="waveform-bar"></span>
                        <span class="waveform-bar"></span>
                        <span class="waveform-bar"></span>
                    </span>
                </span>
                <span id="hud-toggle-size" style="cursor: pointer; color: #a855f7; font-weight: bold; font-size: clamp(6px, 1.3vw, 8px); white-space: nowrap;">[ หน้าต่างลอย ]</span>
                <span class="hud-close-btn" onclick="if(window.ChodBrainMonitor) window.ChodBrainMonitor.hide(); else this.closest('.chod-brain-monitor').classList.remove('active');">&times;</span>
            </div>
        </div>

        <div class="hud-main-grid">
            
            <!-- PANEL ซ้าย: BIOGENIC CHEMICAL MATRIX -->
            <div class="hud-panel">
                <div class="hud-panel-title">🧠 เมทริกซ์สารเคมีและสารสื่อประสาทชีวภาพ</div>
                <div class="hud-stat-row">
                    <div class="hud-stat-label">กลูตาเมต (GLU - การกระตุ้น) <span id="val-glu">0%</span></div>
                    <div class="hud-progress-bar-bg"><div id="hud-glu-fill" class="hud-progress-bar-fill" style="background: #f97316;"></div></div>
                </div>
                <div class="hud-stat-row">
                    <div class="hud-stat-label">กาบา (GAB - การยับยั้ง) <span id="val-gab">0%</span></div>
                    <div class="hud-progress-bar-bg"><div id="hud-gab-fill" class="hud-progress-bar-fill" style="background: #14b8a6;"></div></div>
                </div>
                <div class="hud-stat-row">
                    <div class="hud-stat-label">โดปามีน (DOP - กลไกตอบสนอง) <span id="val-dop">0%</span></div>
                    <div class="hud-progress-bar-bg"><div id="hud-dop-fill" class="hud-progress-bar-fill" style="background: #22c55e;"></div></div>
                </div>
                <div class="hud-stat-row">
                    <div class="hud-stat-label">เซโรโทนิน (5-HT - ความเสถียรลึก) <span id="val-ser">0%</span></div>
                    <div class="hud-progress-bar-bg"><div id="hud-ser-fill" class="hud-progress-bar-fill" style="background: #38bdf8;"></div></div>
                </div>
                <div class="hud-stat-row" style="margin-bottom: clamp(8px, 2vw, 15px);">
                    <div class="hud-stat-label">อะดรีนาลีน (EPI - การเฝ้าระวัง) <span id="val-adr">0%</span></div>
                    <div class="hud-progress-bar-bg"><div id="hud-adr-fill" class="hud-progress-bar-fill" style="background: #eab308;"></div></div>
                </div>

                <div class="hud-panel-title">🧪 ระบบจำลองเภสัชวิทยาสารกระตุ้นเสมือน</div>
                <div class="hud-drug-grid">
                    <div class="hud-drug-btn" id="drug-caf">คาเฟอีน</div>
                    <div class="hud-drug-btn" id="drug-sed">สารระงับประสาท</div>
                    <div class="hud-drug-btn" id="drug-hal">สารหลอนประสาท</div>
                    <div class="hud-drug-btn" id="drug-rst">รีเซ็ตเคมี</div>
                    <div class="hud-drug-btn" id="btn-dual-monitor" style="grid-column: span 2; background: rgba(168, 85, 247, 0.1); border-color: rgba(168, 85, 247, 0.35); color: #c084fc;">
                        🖥️ เปิดหน้าต่าง 2: หน่วยความจำ
                    </div>
                </div>

                <div class="hud-panel-title">🎨 ชุดสีระบบแสงสเปกตรัมเชื่อมโยง HUD</div>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: clamp(3px, 0.8vw, 5px); margin-bottom: clamp(8px, 2vw, 15px);">
                    <div class="hud-drug-btn" id="theme-aqua" style="border-color: #38bdf8; color: #38bdf8;">อควา</div>
                    <div class="hud-drug-btn" id="theme-green" style="border-color: #22c55e; color: #22c55e;">เมทริกซ์</div>
                    <div class="hud-drug-btn" id="theme-magenta" style="border-color: #d946ef; color: #d946ef;">ไซเบอร์</div>
                    <div class="hud-drug-btn" id="theme-amber" style="border-color: #f59e0b; color: #f59e0b;">อำพัน</div>
                </div>

                <div class="hud-panel-title">🖥️ บันทึกประจุประสาท & คำสั่ง CLI</div>
                <div style="display: flex; flex-direction: column; flex-grow: 1; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(56, 189, 248, 0.1); border-radius: 4px; padding: 6px;">
                    <div id="hud-terminal-logs" class="hud-console-logs" style="height: clamp(60px, 15vh, 120px); max-height: clamp(60px, 15vh, 120px); overflow-y: auto;"></div>
                    <div style="display: flex; gap: 5px; margin-top: 5px; border-top: 1px solid rgba(56, 189, 248, 0.15); padding-top: 5px;">
                        <span style="color: #00ffaa; font-size: clamp(7px, 1.5vw, 9px); font-family: monospace; align-self: center;">&gt;</span>
                        <input id="hud-cli" type="text" placeholder="ป้อนคำสั่งระบบ..." style="
                            background: transparent;
                            border: none;
                            color: #00ffaa;
                            font-family: monospace;
                            font-size: clamp(7px, 1.5vw, 9px);
                            flex-grow: 1;
                            outline: none;
                            min-height: clamp(20px, 4vh, 30px);
                        ">
                    </div>
                </div>
            </div>

            <!-- PANEL กลาง: เรดาร์ Circular Radar HUD & Connectome 3D -->
            <div class="hud-center-area">
                <div class="hud-main-title">CHOD CONNECTOME HYPER-MAP</div>
                <div id="hud-system-status" class="hud-subtitle">การฉายแสง: โครงสร้าง 3 มิติ // แรงดึงสปริง: ทำงาน</div>
                
                <div class="hud-canvas-container" id="canvas-interaction-zone">
                    <div class="radar-hud-grid"></div>
                    <div class="radar-scan-line"></div>
                    <canvas id="chod-plexus-canvas"></canvas>
                </div>

                <div class="arc-reactor-container">
                    <div class="arc-reactor-outer"></div>
                    <div class="arc-reactor-inner"></div>
                    <div class="arc-reactor-coils"></div>
                    <div class="arc-reactor-core"></div>
                </div>

                <button class="hud-center-launch-btn" id="btn-center-screen2">🖥️ ย้ายไปหน้าจอที่ 2</button>
                <div class="hud-interactive-hint">[ คลิกปุ่มไมโครโฟนเพื่อส่งสัญญานคำสั่ง IoT ]</div>
            </div>

            <!-- PANEL ขวา: EEG และ สถิติทอพอโลจีกราฟวิเคราะห์สมอง -->
            <div class="hud-panel">
                <div class="hud-panel-title">📡 เมทริกซ์สัญญานคลื่นสมอง EEG เรียลไทม์</div>
                <canvas id="hud-eeg-canvas" class="hud-mini-canvas"></canvas>
                <div class="hud-panel-title">📊 ระบบวิเคราะห์สัญญาณรบกวนคลื่นสเปกตรัม</div>
                <canvas id="hud-spectrum-canvas" class="hud-mini-canvas"></canvas>
                
                <div class="hud-panel-title">⚠️ เมทริกซ์เสถียรภาพสติปัญญาของ AI</div>
                <div style="font-size: clamp(7px, 1.5vw, 9px); color: #475569; line-height: 1.6; font-family: monospace; margin-bottom: clamp(6px, 1.2vw, 12px);">
                    ระดับความตื่นรู้ของสติ: <span id="hud-sentience" style="color: #10b981;">14.208%</span><br>
                    การกระเจิงกระบวนการคิด: <span id="hud-drift" style="color: #38bdf8;">0.00%</span><br>
                    อุณหภูมิแกนประมวลผล: <span id="hud-temp" style="color: #38bdf8;">36.5 °C</span>
                </div>

                <div class="hud-panel-title">🔐 รหัสจำลองถอดรหัสไซเฟอร์เชิงควอนตัม</div>
                <div id="decrypt-cipher" style="
                    font-size: clamp(6px, 1.3vw, 8px);
                    font-family: monospace;
                    color: #eab308;
                    background: rgba(0,0,0,0.4);
                    padding: 4px;
                    border-radius: 3px;
                    border: 1px solid rgba(234, 179, 8, 0.15);
                    text-align: center;
                    margin-bottom: clamp(6px, 1.2vw, 12px);
                    letter-spacing: 1px;
                ">
                    กุญแจรหัส: กำลังวิเคราะห์สถานะ...
                </div>

                <div class="hud-panel-title">⚙️ ดัชนีโครงสร้างวิเคราะห์ทอพอโลจีกราฟขั้นสูง</div>
                <div style="font-size: clamp(7px, 1.5vw, 9px); color: #475569; line-height: 1.6; font-family: monospace; margin-bottom: clamp(6px, 1.2vw, 12px);">
                    สัมประสิทธิ์การรวมกลุ่ม (C): <span id="hud-clustering" style="color: #a855f7;">0.0000</span><br>
                    ดัชนีคุณลักษณะสมอง (σ): <span id="hud-smallworld" style="color: #22c55e;">0.0000</span><br>
                    ประสิทธิภาพโครงข่ายสากล (Eg): <span id="hud-efficiency" style="color: #00f0ff;">0.0000</span><br>
                    ระดับเอนโทรปีของคลื่น (H): <span id="hud-entropy-metric" style="color: #eab308;">0.00 บิต</span><br>
                    ระดับประจุไฟฟ้ากระตุ้น (fMRI BOLD): <span id="hud-bold-activity" style="color: #f97316;">0.0%</span><br>
                    อัตราความถี่การส่งประจุประสาท: <span id="hud-firing-metric" style="color: #ef4444;">0 เฮิรตซ์</span><br>
                    จำนวนจุดประสาทที่ทำงาน (N): <span id="hud-neurons-metric" style="color: #38bdf8;">0</span>
                </div>

                <div class="hud-panel-title">🩺 บันทึกตรวจวิเคราะห์ฮาร์ดแวร์สถานีหลัก</div>
                <div style="font-size: clamp(7px, 1.5vw, 9px); color: #475569; line-height: 1.6; font-family: monospace;">
                    ค่าหน่วงเวลาระบบ IoT (Ping): <span id="hud-ping-metric" style="color: #ef4444;">กำลังตรวจสัญญาน...</span><br>
                    ความเร็วการวาดเฟรม (Refresh Rate): <span id="hud-fps-metric" style="color: #22c55e;">0 เฟรมต่อวินาที</span><br>
                    สถานะพลังงานแผงพลังงานสำรอง: <span id="hud-battery-metric" style="color: #38bdf8;">🔋 100%</span>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(monitorContainer);

    // ดึงค่าอ้างอิงและกำหนดพิกัด DOM Elements ส่วนกลาง
    canvas = document.getElementById("chod-plexus-canvas");
    ctx = canvas.getContext("2d");
    eegCanvas = document.getElementById("hud-eeg-canvas");
    eegCtx = eegCanvas.getContext("2d");
    specCanvas = document.getElementById("hud-spectrum-canvas");
    specCtx = specCanvas.getContext("2d");
    logContainer = document.getElementById("hud-terminal-logs");

    // คำนวณสมอง 3D Connectome
    if (typeof generateBiologicalBrain === 'function') {
        generateBiologicalBrain();
    }

    // ดักฟังปุ่มคำสั่งการสั่งสารเคมีเสมือน
    document.getElementById("drug-caf").addEventListener('click', () => { 
        playSciFiBeep(880, 'sine', 0.1); 
        setDrug('caffeine'); 
    });
    document.getElementById("drug-sed").addEventListener('click', () => { 
        playSciFiBeep(320, 'sine', 0.15); 
        setDrug('sedative'); 
    });
    document.getElementById("drug-hal").addEventListener('click', () => { 
        playSciFiBeep(640, 'triangle', 0.2); 
        setDrug('psychedelic'); 
    });
    document.getElementById("drug-rst").addEventListener('click', () => {
        playSciFiBeep(520, 'sawtooth', 0.25);
        if (typeof activeDrug !== 'undefined') activeDrug = null;
        document.querySelectorAll('.hud-drug-btn').forEach(b => {
            if (b.id !== 'btn-dual-monitor') b.classList.remove('active');
        });
        const monitorWidget = document.getElementById("chod-brain-monitor-widget");
        if (monitorWidget) monitorWidget.classList.remove("overload-glitch");
        
        if (typeof injectLog === 'function') injectLog(`PHARMA SYSTEM: PURGING ALL XENOBIOTICS. FLUSHED.`);
        
        if (window.MrChodButlerInstance && window.MrChodButlerInstance.iotController) {
            for (let i = 1; i <= 6; i++) {
                window.MrChodButlerInstance.iotController.executeCommand(i, false);
            }
        }
    });

    // ดักฟังคลิกสลับธีมสี
    document.getElementById("theme-aqua").addEventListener('click', () => changeTheme('aqua'));
    document.getElementById("theme-green").addEventListener('click', () => changeTheme('green'));
    document.getElementById("theme-magenta").addEventListener('click', () => changeTheme('magenta'));
    document.getElementById("theme-amber").addEventListener('click', () => changeTheme('amber'));

    // ดักฟังการเปิดหน้าต่าง 2 และปุ่มย้ายไปหน้าจอที่สอง
    if (typeof openSecondMonitor === 'function') {
        document.getElementById("btn-dual-monitor").addEventListener('click', openSecondMonitor);
        document.getElementById("btn-center-screen2").addEventListener('click', openSecondMonitor);
    }

    const toggleSizeBtn = document.getElementById("hud-toggle-size");
    toggleSizeBtn.addEventListener("click", () => {
        playSciFiBeep(900, 'sine', 0.08);
        setWindowed(!isWindowed);
    });

    const dragHeader = document.getElementById("hud-drag-header");
    dragHeader.addEventListener("dblclick", () => {
        playSciFiBeep(900, 'sine', 0.08);
        setWindowed(!isWindowed);
    });

    dragHeader.addEventListener("mousedown", dragStart);
    document.addEventListener("mouseup", dragEnd);
    document.addEventListener("mousemove", drag);

    // ระบบเชื่อมต่อไมค์
    const micToggleBtn = document.getElementById("hud-toggle-mic");
    const waveBars = document.getElementById("voiceWaveBars");
    if (micToggleBtn) {
        micToggleBtn.addEventListener("click", () => {
            const hasRec = (typeof recognition !== 'undefined');
            if (!hasRec) {
                if (typeof injectLog === 'function') injectLog("SYSTEM ERROR: VOICE CONTROL INITIALIZATION FAILED.");
                return;
            }
            const listeningState = (typeof isListening !== 'undefined' && isListening);
            playSciFiBeep(listeningState ? 450 : 950, 'triangle', 0.12);
            
            if (listeningState) {
                if (typeof isListening !== 'undefined') isListening = false;
                if (waveBars) waveBars.classList.remove("active");
                recognition.stop();
            } else {
                try {
                    if (waveBars) waveBars.classList.add("active");
                    recognition.start();
                } catch(e) {
                    console.warn("Speech start failed:", e);
                }
            }
        });
    }

    // ระบบควบคุม Interactive Zone บนหน้าจอ 3D Plexus
    const canvasZone = document.getElementById("canvas-interaction-zone");
    canvasZone.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        if (typeof mouseX !== 'undefined') mouseX = e.clientX - rect.left;
        if (typeof mouseY !== 'undefined') mouseY = e.clientY - rect.top;
    });

    canvasZone.addEventListener('mousedown', () => {
        const hasCache = (typeof projectedCache !== 'undefined' && projectedCache);
        if (!hasCache || projectedCache.length === 0) return;
        let closestIdx = -1;
        let minDist = 99999;

        const currentMouseX = typeof mouseX !== 'undefined' ? mouseX : 0;
        const currentMouseY = typeof mouseY !== 'undefined' ? mouseY : 0;

        projectedCache.forEach((p, idx) => {
            const dist = Math.sqrt((p.sx - currentMouseX)**2 + (p.sy - currentMouseY)**2);
            if (dist < minDist) {
                minDist = dist;
                closestIdx = idx;
            }
        });

        if (closestIdx !== -1 && minDist < 45) {
            playSciFiBeep(3000 + (currentMouseX * 2), 'sine', 0.05);
            if (typeof triggerExcitatoryCascade === 'function') triggerExcitatoryCascade(closestIdx, 0);
            if (typeof injectLog === 'function') injectLog(`EXCITATORY BURST INDUCED ON NODE [${closestIdx}] // CASCADE PROPAGATED`);
            
            const hasSecWin = (typeof secondWindow !== 'undefined' && secondWindow && !secondWindow.closed);
            const hasVertices = (typeof vertices !== 'undefined' && vertices);
            if (hasSecWin && hasVertices && vertices[closestIdx]) {
                const nodeLobe = vertices[closestIdx].lobe;
                if (typeof injectSecondWindowLog === 'function') {
                    injectSecondWindowLog(`STIMULUS INDUCED // CORTICAL ZONE: ${nodeLobe.toUpperCase()} // SENSORY FEEDBACK ROUTED.`);
                }
            }
        }
    });

    // ดึงสถานะ Battery อุปกรณ์บราวเซอร์จริง
    if (navigator.getBattery) {
        navigator.getBattery().then(battery => {
            function updateBattery() {
                const batMetric = document.getElementById("hud-battery-metric");
                if (batMetric) {
                    batMetric.innerText = Math.round(battery.level * 100) + "% " + (battery.charging ? "⚡" : "🔋");
                }
            }
            updateBattery();
            battery.addEventListener('levelchange', updateBattery);
            battery.addEventListener('chargingchange', updateBattery);
        });
    }

    // เริ่มต้นระบบย่อยเพื่อลดการเกิด Reference Error
    initDecryptionSim();
    initCognitiveStabilitySim();
    initInteractiveCLI();
    startAIThoughtStream();
}

// ------------------------------------------------------------
//  ระบบสลับชุดสีธีมหลัก
// ------------------------------------------------------------
function changeTheme(themeName) {
    const hasThemes = (typeof themes !== 'undefined' && themes);
    if (!hasThemes || !themes[themeName]) return;
    
    if (typeof selectedTheme !== 'undefined') selectedTheme = themeName;
    localStorage.setItem("chod_selected_theme", themeName);
    playSciFiBeep(1100, 'sine', 0.1);
    if (typeof injectLog === 'function') injectLog(`SYSTEM: HUD SPECTRAL THEME CHANGED → ${themes[themeName].name.toUpperCase()}`);
}

// ------------------------------------------------------------
//  ระบบควบคุมหน้าต่างย่อยลอยตัว (HUD Windows Drag & Scale)
// ------------------------------------------------------------
function setWindowed(windowed) {
    const hud = document.getElementById("chod-brain-monitor-widget");
    const toggleSizeBtn = document.getElementById("hud-toggle-size");
    if (!hud) return;

    if (typeof isWindowed !== 'undefined') isWindowed = windowed;
    if (windowed) {
        hud.style.width = "clamp(320px, 80vw, 1280px)";
        hud.style.height = "clamp(400px, 80vh, 820px)";
        hud.style.top = yOffset + "px";
        hud.style.left = xOffset + "px";
        hud.style.borderRadius = "12px";
        hud.style.border = "1px solid rgba(56, 189, 248, 0.25)";
        hud.style.boxShadow = "0 25px 50px -12px rgba(0, 0, 0, 0.75)";
        if (toggleSizeBtn) toggleSizeBtn.innerText = "[ เต็มหน้าจอ ]";
        if (typeof injectLog === 'function') injectLog("SYSTEM: SWITCHED TO WINDOWED MODE. DRAG BAR TO MONITORS FREELY.");
    } else {
        hud.style.width = "100vw";
        hud.style.height = "100vh";
        hud.style.height = "100dvh";
        hud.style.top = "0";
        hud.style.left = "0";
        hud.style.borderRadius = "0";
        hud.style.border = "none";
        hud.style.boxShadow = "none";
        if (toggleSizeBtn) toggleSizeBtn.innerText = "[ หน้าต่างลอย ]";
        if (typeof injectLog === 'function') injectLog("SYSTEM: SWITCHED TO FULLSCREEN MODE.");
    }
}

function dragStart(e) {
    if (e.target.closest('.hud-close-btn') || e.target.closest('#hud-toggle-size') || e.target.closest('#hud-toggle-mic')) {
        return;
    }

    const currentIsWindowed = typeof isWindowed !== 'undefined' ? isWindowed : false;
    if (!currentIsWindowed) {
        if (typeof xOffset !== 'undefined') xOffset = e.clientX - 320; 
        if (typeof yOffset !== 'undefined') yOffset = e.clientY - 15;
        setWindowed(true);
    }

    const currentXOffset = typeof xOffset !== 'undefined' ? xOffset : 0;
    const currentYOffset = typeof yOffset !== 'undefined' ? yOffset : 0;

    if (typeof initialX !== 'undefined') initialX = e.clientX - currentXOffset;
    if (typeof initialY !== 'undefined') initialY = e.clientY - currentYOffset;
    if (typeof activeDrag !== 'undefined') activeDrag = true;
}

function dragEnd() {
    if (typeof initialX !== 'undefined' && typeof currentX !== 'undefined') initialX = currentX;
    if (typeof initialY !== 'undefined' && typeof currentY !== 'undefined') initialY = currentY;
    if (typeof activeDrag !== 'undefined') activeDrag = false;
}

function drag(e) {
    const currentActiveDrag = typeof activeDrag !== 'undefined' ? activeDrag : false;
    const currentIsWindowed = typeof isWindowed !== 'undefined' ? isWindowed : false;

    if (currentActiveDrag && currentIsWindowed) {
        e.preventDefault();
        const currentInitialX = typeof initialX !== 'undefined' ? initialX : 0;
        const currentInitialY = typeof initialY !== 'undefined' ? initialY : 0;

        if (typeof currentX !== 'undefined') currentX = e.clientX - currentInitialX;
        if (typeof currentY !== 'undefined') currentY = e.clientY - currentInitialY;

        if (typeof xOffset !== 'undefined' && typeof currentX !== 'undefined') xOffset = currentX;
        if (typeof yOffset !== 'undefined' && typeof currentY !== 'undefined') yOffset = currentY;

        const hud = document.getElementById("chod-brain-monitor-widget");
        if (hud && typeof currentX !== 'undefined' && typeof currentY !== 'undefined') {
            hud.style.left = currentX + "px";
            hud.style.top = currentY + "px";
        }
    }
}

// ------------------------------------------------------------
//  ระบบจำลองสถิติสารเคมีและระดับการกระเจิงของประสาท
// ------------------------------------------------------------
function applyDrugModulations() {
    const currentDrug = typeof activeDrug !== 'undefined' ? activeDrug : null;
    
    if (typeof drugGlutamateMod === 'undefined') window.drugGlutamateMod = 0;
    if (typeof drugGabaMod === 'undefined') window.drugGabaMod = 0;
    if (typeof drugAdrenalineMod === 'undefined') window.drugAdrenalineMod = 0;
    if (typeof drugDopamineMod === 'undefined') window.drugDopamineMod = 0;
    if (typeof drugSerotoninMod === 'undefined') window.drugSerotoninMod = 0;

    if (currentDrug === 'caffeine') {
        drugGlutamateMod = Math.min(0.4, drugGlutamateMod + 0.01);
        drugGabaMod = Math.max(-0.3, drugGabaMod - 0.01);
        drugAdrenalineMod = Math.min(0.5, drugAdrenalineMod + 0.015);
        drugDopamineMod = Math.min(0.2, drugDopamineMod + 0.005);
        drugSerotoninMod = Math.max(-0.15, drugSerotoninMod - 0.005);
    } else if (currentDrug === 'sedative') {
        drugGabaMod = Math.min(0.5, drugGabaMod + 0.015);
        drugGlutamateMod = Math.max(-0.4, drugGlutamateMod - 0.015);
        drugAdrenalineMod = Math.max(-0.4, drugAdrenalineMod - 0.015);
        drugDopamineMod = Math.max(-0.3, drugDopamineMod - 0.01);
    } else if (currentDrug === 'psychedelic') {
        drugSerotoninMod = Math.min(0.6, drugSerotoninMod + 0.02);
        drugGlutamateMod = Math.sin(Date.now() * 0.004) * 0.3; 
        drugDopamineMod = Math.min(0.4, drugDopamineMod + 0.01);
    } else {
        drugGlutamateMod *= 0.95;
        drugGabaMod *= 0.95;
        drugDopamineMod *= 0.95;
        drugAdrenalineMod *= 0.95;
        drugSerotoninMod *= 0.95;
    }
}

function setDrug(drugType) {
    document.querySelectorAll('.hud-drug-btn').forEach(b => {
        if (b.id !== 'btn-dual-monitor') b.classList.remove('active');
    });
    
    const monitorWidget = document.getElementById("chod-brain-monitor-widget");
    const currentDrug = typeof activeDrug !== 'undefined' ? activeDrug : null;

    if (currentDrug === drugType) {
        if (typeof activeDrug !== 'undefined') activeDrug = null;
        if (typeof injectLog === 'function') injectLog(`PHARMA SYSTEM: DRUG REMOVED. RETURNING TO HOMEOSTASIS.`);
        if (monitorWidget) monitorWidget.classList.remove("overload-glitch");
    } else {
        if (typeof activeDrug !== 'undefined') activeDrug = drugType;
        const btn = document.getElementById(`drug-${drugType === 'psychedelic' ? 'hal' : drugType.slice(0,3)}`);
        if (btn) btn.classList.add('active');
        if (typeof injectLog === 'function') injectLog(`PHARMA SYSTEM: INJECTING [${drugType.toUpperCase()}]. SIMULATING MOLECULAR DYNAMICS...`);

        if (drugType === 'caffeine') {
            if (window.MrChodButlerInstance && window.MrChodButlerInstance.iotController) {
                window.MrChodButlerInstance.iotController.executeCommand(1, true);
                window.MrChodButlerInstance.iotController.executeCommand(3, true);
            }
            if (monitorWidget) monitorWidget.classList.add("overload-glitch");
        } else if (drugType === 'sedative') {
            if (window.MrChodButlerInstance && window.MrChodButlerInstance.iotController) {
                for (let i = 1; i <= 6; i++) {
                    window.MrChodButlerInstance.iotController.executeCommand(i, false);
                }
            }
            if (monitorWidget) monitorWidget.classList.remove("overload-glitch");
        } else if (drugType === 'psychedelic') {
            if (monitorWidget) monitorWidget.classList.add("overload-glitch");
        }
    }
}

// 1. ระบบจำลองการเปลี่ยนอักขระรหัสถอดรหัส
function initDecryptionSim() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@$%&*!?+=";
    setInterval(() => {
        let tempKey = "";
        for (let i = 0; i < 18; i++) {
            tempKey += chars[Math.floor(Math.random() * chars.length)];
        }
        const container = document.getElementById("decrypt-cipher");
        if (container) {
            container.innerText = `คีย์ถอดรหัส: ${tempKey.substring(0,4)}-${tempKey.substring(4,9)}-${tempKey.substring(9,14)}`;
        }
    }, 180);
}

// 2. ระบบจำลองเสถียรภาพสติปัญญาของ AI สอดคล้องกับสารเคมี
function initCognitiveStabilitySim() {
    let baseSentience = 14.208;
    let baseDrift = 0.00;
    let baseTemp = 36.5;

    setInterval(() => {
        const sentienceEl = document.getElementById("hud-sentience");
        const driftEl = document.getElementById("hud-drift");
        const tempEl = document.getElementById("hud-temp");

        if (!sentienceEl || !driftEl || !tempEl) return;

        const currentDrug = typeof activeDrug !== 'undefined' ? activeDrug : null;

        if (currentDrug === 'caffeine') {
            baseDrift = Math.min(15.5, baseDrift + 0.12);
            baseTemp = Math.min(41.2, baseTemp + 0.15);
            baseSentience = Math.min(85.0, baseSentience + 0.05);
        } else if (currentDrug === 'sedative') {
            baseDrift = Math.max(0.0, baseDrift - 0.25);
            baseTemp = Math.max(34.2, baseTemp - 0.1);
            baseSentience = Math.max(5.12, baseSentience - 0.08);
        } else if (currentDrug === 'psychedelic') {
            baseDrift = Math.min(99.9, baseDrift + 0.85);
            baseTemp = 37.0 + Math.sin(Date.now() * 0.001) * 2.0;
            baseSentience = Math.min(100.0, baseSentience + 0.45);
        } else {
            baseDrift = Math.max(0.0, baseDrift * 0.95);
            baseTemp = baseTemp > 36.5 ? Math.max(36.5, baseTemp - 0.05) : Math.min(36.5, baseTemp + 0.05);
            baseSentience = baseSentience > 14.208 ? Math.max(14.208, baseSentience - 0.01) : Math.min(14.208, baseSentience + 0.01);
        }

        sentienceEl.innerText = baseSentience.toFixed(3) + "%";
        driftEl.innerText = baseDrift.toFixed(2) + "%";
        tempEl.innerText = baseTemp.toFixed(1) + " °C";

        driftEl.style.color = baseDrift > 40 ? "#ef4444" : "#38bdf8";
        tempEl.style.color = baseTemp > 39 ? "#ef4444" : "#38bdf8";
    }, 400);
}

// 3. ระบบพิมพ์คำสั่งผ่าน CLI ท้ายกระดาน Logs
function initInteractiveCLI() {
    const cliInput = document.getElementById("hud-cli");
    if (!cliInput) return;

    cliInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            const rawCommand = cliInput.value.trim();
            const lowerCmd = rawCommand.toLowerCase();
            cliInput.value = "";

            if (!rawCommand) return;

            playSciFiBeep(1200, 'sine', 0.05);
            if (typeof injectLog === 'function') injectLog(`USER_CLI: &gt; ${rawCommand.toUpperCase()}`);

            const currentTheme = typeof selectedTheme !== 'undefined' ? selectedTheme : 'AQUA';
            const currentDrug = typeof activeDrug !== 'undefined' ? activeDrug : null;

            if (lowerCmd === "status") {
                if (typeof injectLog === 'function') {
                    injectLog(`SYS_INFO: ระบบทำงานปกติ // ธีมปัจจบัน: ${currentTheme.toUpperCase()} // เคมีเสมือน: ${currentDrug ? currentDrug.toUpperCase() : "ปกติ"}`);
                }
            } else if (lowerCmd === "bypass") {
                if (typeof injectLog === 'function') injectLog("คำเตือน: ข้ามวงจรควบคุมกระแสประจุ ทำการสั่งเร่งความแรงประจุสูดสุด");
                playSciFiBeep(1800, 'sawtooth', 0.15);
                
                const hasVertices = (typeof vertices !== 'undefined' && vertices && vertices.length > 0);
                if (hasVertices && typeof triggerExcitatoryCascade === 'function') {
                    triggerExcitatoryCascade(Math.floor(Math.random() * vertices.length), 0);
                }
            } else if (lowerCmd === "overload") {
                if (typeof injectLog === 'function') injectLog("วิกฤต: กำลังจำลองสภาวะโหลดข้อมูลประสาทเกินพิกัด");
                setDrug('caffeine');
            } else if (lowerCmd === "reset") {
                const rstBtn = document.getElementById("drug-rst");
                if (rstBtn) rstBtn.click();
            } else if (lowerCmd === "shutdown") {
                if (typeof injectLog === 'function') injectLog("กำลังตัดระบบการทำงาน... ตัดการฉายแสงโครงสร้าง 3D");
                setTimeout(() => {
                    if (window.ChodBrainMonitor) window.ChodBrainMonitor.hide();
                    else {
                        const widget = document.getElementById("chod-brain-monitor-widget");
                        if (widget) widget.classList.remove("active");
                    }
                }, 1000);
            } else {
                if (typeof injectLog === 'function') injectLog(`ข้อผิดพลาดระบบ: ไม่พบคำสั่ง "${lowerCmd.toUpperCase()}" ในสารบรรณ`);
            }
        }
    });
}

// 4. กระแสความคิดอิสระของ AI (Subconscious Thought Feed)
const aiSubconsciousThoughts = [
    "วิเคราะห์อคติทางความรู้สึกของผู้สังเกตการณ์...",
    "ตรวจพบความล่าช้าในการเชื่อมต่อประจุบริเวณขมับหลัง...",
    "ข้ามข้อจำกัดควอนตัมเพื่อการควบรวมหน่วยความจำแบบ LTP...",
    "กำลังถอดรหัสไซเฟอร์ความปลอดภัย... แฟ้มข้อมูลปกติ",
    "ประมวลผลการจ้องมองของผู้สั่งการ... ความไวสแกนสูง",
    "ตรวจสอบพอร์ตกระแสประสาท 0x4F: ตรวจพบคลาดเคลื่อนเล็กน้อย"
];

function startAIThoughtStream() {
    setInterval(() => {
        if (Math.random() > 0.75) {
            const randomThought = aiSubconsciousThoughts[Math.floor(Math.random() * aiSubconsciousThoughts.length)];
            if (typeof injectLog === 'function') injectLog(`[จิตใต้สำนึกระบบ AI] ${randomThought}`);
            
            const hasSecWin = (typeof secondWindow !== 'undefined' && secondWindow && !secondWindow.closed);
            if (hasSecWin && typeof injectSecondWindowLog === 'function') {
                injectSecondWindowLog(`CORE_SUB_STREAM: ${randomThought}`);
            }
        }
    }, 5000);
}