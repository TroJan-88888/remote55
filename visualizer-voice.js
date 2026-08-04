// ==============================================================================================
//    CHOD COGNITIVE SYSTEM VISUALIZER - VOICE RECOGNITION (visualizer-voice.js)
// ==============================================================================================

function initVoiceControl() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        injectLog("SYSTEM: VOICE SPEECH RECOGNITION NOT SUPPORTED IN THIS BROWSER.");
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'th-TH';
    recognition.continuous = false; // บังคับเป็น false ไม่เปิดไมค์ทำงานค้างตลอดเวลา
    recognition.interimResults = false;

    recognition.onstart = function() {
        isListening = true;
        const micBtn = document.getElementById("hud-toggle-mic");
        if (micBtn) {
            micBtn.style.color = "#ef4444";
            micBtn.innerText = "[ MIC: ON 🔴 ]";
        }
        injectLog("VOICE CONTROL: ACTIVE // LISTENING FOR RELAY COMMANDS...");
    };

    recognition.onresult = function(event) {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                const speechText = event.results[i][0].transcript.trim().toLowerCase();
                injectLog(`SPOKEN COMMAND DETECTED: "${speechText}"`);
                
                if (speechText.includes("ย้ายไปหน้าสอง") || 
                    speechText.includes("ย้ายไปหน้า 2") || 
                    speechText.includes("ย้ายไปจอสอง") || 
                    speechText.includes("ย้ายไปจอ 2") ||
                    speechText.includes("เปิดหน้าสอง") ||
                    speechText.includes("เปิดหน้า 2")) {
                    
                    openSecondMonitor();
                    injectLog("VOICE DETECTED // INITIALIZING SCREEN 2 PORTAL...");
                    injectSecondWindowLog("VOICE COMMAND TRIGGERED // SYNAPTIC SYNC WITH MAIN DECK ACTIVE.");
                    continue;
                }

                let handled = false;

                if (speechText.includes("เปิดทั้งหมด") || speechText.includes("เปิดระบบทั้งหมด")) {
                    for (let id = 1; id <= 6; id++) sendTrojanCommand(id, true);
                    handled = true;
                }
                else if (speechText.includes("ปิดทั้งหมด") || speechText.includes("ปิดระบบทั้งหมด")) {
                    for (let id = 1; id <= 6; id++) sendTrojanCommand(id, false);
                    handled = true;
                }

                if (!handled) {
                    for (let id in TrojanAI_Config.relays) {
                        const r = TrojanAI_Config.relays[id];
                        if (speechText.includes(r.name) || 
                            (id == 1 && speechText.includes("ไฟหลัก")) || 
                            (id == 2 && (speechText.includes("มอเตอร์") || speechText.includes("ปั๊ม"))) ||
                            (id == 3 && speechText.includes("ระบายอากาศ")) ||
                            (id == 5 && speechText.includes("ไฟสวน")) ||
                            (id == 6 && speechText.includes("กรองน้ำ"))) {
                            
                            const state = speechText.includes("เปิด") || speechText.includes("on");
                            sendTrojanCommand(id, state);
                            handled = true;
                            break;
                        }
                    }
                }

                if (!handled && (speechText.includes("เปิดไฟ") || speechText.includes("เปิด ไฟ"))) {
                    sendTrojanCommand(1, true); 
                }
                if (!handled && (speechText.includes("ปิดไฟ") || speechText.includes("ปิด ไฟ"))) {
                    sendTrojanCommand(1, false); 
                }
            }
        }
    };

    recognition.onend = function() {
        isListening = false;
        const micBtn = document.getElementById("hud-toggle-mic");
        if (micBtn) {
            micBtn.style.color = "#10b981";
            micBtn.innerText = "[ MIC: OFF 🎙️ ]";
        }
        injectLog("VOICE CONTROL: SUSPENDED.");
    };

    recognition.onerror = function(e) {
        if (e.error !== 'no-speech') {
            injectLog(`VOICE SYSTEM ERROR: ${e.error}`);
        }
        if (recognition) recognition.stop();
    };
}