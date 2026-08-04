// ==================== CONFIGURATION ====================
const CUSTOM_ICON_URL = "https://od.lk/s/N18yODE1OTE2NTlf/cre.ico";
const VERSION = "3.1.0";
const RELAY_COUNT = 6;

// Relay Data (6 ช่อง)
const relays = [];
for (let i = 1; i <= RELAY_COUNT; i++) {
    relays.push({ id: i, name: `รีเลย์ ${i}`, state: false, label: `RELAY_0${i}`, pin: `D${i}`, icon: CUSTOM_ICON_URL, customName: `รีเลย์ ${i}`, delay: 0, pendingTimeout: null });
}

// ชื่อเริ่มต้นภาษาไทยระดับ System-wide เพื่อแก้บัคการลบชื่อแล้วชื่อฟอลต์หลักหายไป
const DEFAULT_THAI_NAMES = { 
    1: "ไฟหลัก", 
    2: "มอเตอร์ปั๊ม", 
    3: "ระบายอากาศ", 
    4: "อุปกรณ์เสริม", 
    5: "ไฟสวน", 
    6: "เครื่องกรองน้ำ" 
};

let customNames = { ...DEFAULT_THAI_NAMES };
let relayDelays = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
let currentEditingRelay = null;

// Auto-listening variables
let isAutoListening = false;  // เริ่มต้นไม่ฟังอัตโนมัติ รอผู้ใช้แตะเปิด
let recognition = null;
let errorCount = 0;

// HTTP URL Storage (6 ช่อง)
let httpRelayUrls = {
    1: { on: "http://192.168.1.40/toggle", off: "http://192.168.1.40/toggle" },
    2: { on: "http://192.168.1.189/RELAY=ON", off: "http://192.168.1.189/RELAY=OFF" },
    3: { on: "", off: "" },
    4: { on: "", off: "" },
    5: { on: "", off: "" },
    6: { on: "", off: "" }
};
let httpBaseURL = "http://192.168.1.188";

// ==================== UTILITY FUNCTIONS ====================
function safeLocalStorageSet(key, value) {
    try { localStorage.setItem(key, value); return true; } catch(e) { console.error("localStorage error:", e); showToastMessage("⚠️ พื้นที่เก็บข้อมูลเต็ม"); return false; }
}
function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
function showToastMessage(msg) { let toast = document.createElement('div'); toast.className = 'toast-message'; toast.innerText = msg; document.body.appendChild(toast); setTimeout(() => toast.remove(), 2000); }
function speakFeedback(text) { if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); let u = new SpeechSynthesisUtterance(text); u.lang = 'th-TH'; u.rate = 0.9; window.speechSynthesis.speak(u); } }

// อัปเดตการแสดงผลสถานะ LED ให้ถูกต้องตามความเป็นจริง
function updateConnectionStatus(connected, message) { 
    const led = document.getElementById('connection-led'); 
    const text = document.getElementById('connection-text'); 
    if (connected) { 
        led.classList.add('connected'); 
        text.innerText = message; 
    } else { 
        led.classList.remove('connected'); 
        text.innerText = message; 
    } 
}

// ==================== LOAD/SAVE SETTINGS ====================
function loadStoredSettings() {
    const storedNames = localStorage.getItem('relayCustomNames');
    if (storedNames) { 
        try { 
            const parsed = JSON.parse(storedNames); 
            // ผสมผสานค่าที่บันทึกเข้ากับชื่อดั้งเดิม
            customNames = { ...DEFAULT_THAI_NAMES, ...parsed }; 
            for (let i = 1; i <= RELAY_COUNT; i++) { 
                if (customNames[i]) { 
                    relays[i-1].name = customNames[i]; 
                    relays[i-1].customName = customNames[i]; 
                } 
            } 
        } catch(e) {} 
    }
    const storedDelays = localStorage.getItem('relayDelays');
    if (storedDelays) { try { const parsed = JSON.parse(storedDelays); relayDelays = parsed; for (let i = 1; i <= RELAY_COUNT; i++) { relays[i-1].delay = relayDelays[i] || 0; } } catch(e) {} }
    const storedUrls = localStorage.getItem('httpRelayUrls');
    const storedBase = localStorage.getItem('httpBaseURL');
    if (storedUrls) { try { const parsed = JSON.parse(storedUrls); for (let i = 1; i <= RELAY_COUNT; i++) { if (parsed[i]) httpRelayUrls[i] = { on: parsed[i].on || "", off: parsed[i].off || "" }; } } catch(e) {} }
    if (storedBase) httpBaseURL = storedBase;
    for (let i = 1; i <= RELAY_COUNT; i++) {
        const onInput = document.getElementById(`relay${i}-on`);
        const offInput = document.getElementById(`relay${i}-off`);
        const delayInput = document.getElementById(`relay${i}-delay`);
        if (onInput) onInput.value = httpRelayUrls[i].on;
        if (offInput) offInput.value = httpRelayUrls[i].off;
        if (delayInput) delayInput.value = relayDelays[i] || 0;
    }
    const baseInput = document.getElementById('http-base-url');
    if (baseInput) baseInput.value = httpBaseURL;
    console.log("Settings loaded - Version:", VERSION, `(${RELAY_COUNT} relays)`);
}

function saveCustomNames() { safeLocalStorageSet('relayCustomNames', JSON.stringify(customNames)); }
function saveDelays() { safeLocalStorageSet('relayDelays', JSON.stringify(relayDelays)); }

function saveRelayUrls() {
    for (let i = 1; i <= RELAY_COUNT; i++) {
        httpRelayUrls[i] = { on: document.getElementById(`relay${i}-on`).value.trim(), off: document.getElementById(`relay${i}-off`).value.trim() };
        const delayInput = document.getElementById(`relay${i}-delay`);
        if (delayInput) {
            let delayVal = parseFloat(delayInput.value);
            if (isNaN(delayVal)) delayVal = 0;
            if (delayVal < 0) delayVal = 0;
            if (delayVal > 60) delayVal = 60;
            relayDelays[i] = delayVal;
            relays[i-1].delay = relayDelays[i];
            delayInput.value = delayVal;
        }
    }
    const baseInput = document.getElementById('http-base-url');
    if (baseInput && baseInput.value.trim()) httpBaseURL = baseInput.value.trim();
    safeLocalStorageSet('httpRelayUrls', JSON.stringify(httpRelayUrls));
    safeLocalStorageSet('httpBaseURL', httpBaseURL);
    saveDelays();
    
    renderRelays(); // อัปเดต UI ของการ์ดทันทีหลังกดเซฟในแผงควบคุมหลัก
    
    showToastMessage("✅ บันทึก URL และหน่วงเวลา 6 รีเลย์เรียบร้อย");
    document.getElementById('http-status').innerHTML = '✅ บันทึกการตั้งค่าเรียบร้อย';
}

// ==================== HTTP API FUNCTIONS ====================
function getHttpUrl(relayId, state) {
    const urls = httpRelayUrls[relayId];
    if (state && urls.on && urls.on !== "") return urls.on;
    if (!state && urls.off && urls.off !== "") return urls.off;
    if (urls.on === urls.off && urls.on !== "") return urls.on;
    return `${httpBaseURL}/${state ? "ON" : "OFF"}`;
}
function sendHttpCommand(relayId, state) {
    const url = getHttpUrl(relayId, state);
    if (url && url !== "") { fetch(url, { method: 'GET', mode: 'no-cors' }).catch(e => console.log("HTTP request sent:", url)); console.log(`HTTP ${state ? 'ON' : 'OFF'} -> ${url}`); return true; } 
    else { showToastMessage(`⚠️ ไม่มี URL สำหรับรีเลย์ ${relayId}`); return false; }
}

// ==================== RELAY CONTROL FUNCTIONS ====================
function renderRelays() {
    const grid = document.getElementById('relayGrid'); if (!grid) return;
    grid.innerHTML = '';
    relays.forEach((relay) => {
        const card = document.createElement('div'); card.className = `relay-card ${relay.state ? 'active' : ''}`; card.dataset.id = relay.id;
        const displayName = customNames[relay.id] || relay.name;
        const delayValue = relayDelays[relay.id] || 0;
        
        // แก้ไขความปลอดภัย XSS: ส่งเพียง ID ไปยังฟังก์ชัน openNameModal แล้วให้ JS ไปดึงค่าจากตัวแปรเอง
        card.innerHTML = `<button class="edit-name-btn" onclick="event.stopPropagation(); openNameModal(${relay.id})"><span>✏️</span> ตั้งชื่อ</button>
            <div class="relay-icon"><img src="${relay.icon}" alt="Relay ${relay.id}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ccircle cx=\'50\' cy=\'50\' r=\'45\' fill=\'%2300ffff\' stroke=\'%2300aaff\' stroke-width=\'3\'/%3E%3Ctext x=\'50\' y=\'67\' text-anchor=\'middle\' fill=\'%23000\' font-size=\'40\' font-weight=\'bold\'%3E${relay.id}%3C/text%3E%3C/svg%3E'"></div>
            <div class="relay-number">RELAY ${relay.id}</div><div class="relay-name">${escapeHtml(displayName)}</div>
            <div class="relay-label">${relay.label} (${relay.pin})</div>
            <div class="delay-control"><label>⏱</label><input type="number" id="delay-${relay.id}" min="0" max="60" step="0.5" value="${delayValue}" onchange="updateRelayDelay(${relay.id}, this.value)" onclick="event.stopPropagation()"><span>วินาที</span></div>
            <div class="relay-state ${relay.state ? 'state-on' : 'state-off'}">${relay.state ? 'ON' : 'OFF'}</div>`;
        card.onclick = (e) => { if (!e.target.classList.contains('edit-name-btn') && !e.target.closest('.edit-name-btn') && !e.target.closest('.delay-control')) toggleRelay(relay.id); };
        grid.appendChild(card);
    });
}
function updateRelayDelay(relayId, value) { let delay = parseFloat(value); if (isNaN(delay)) delay = 0; if (delay < 0) delay = 0; if (delay > 60) delay = 60; relayDelays[relayId] = delay; relays[relayId-1].delay = delay; saveDelays(); document.getElementById(`delay-${relayId}`).value = delay; showToastMessage(`ตั้งค่าหน่วงเวลา RELAY ${relayId} = ${delay} วินาที`); }
function toggleRelay(id) { const relay = relays.find(r => r.id === id); if (relay) updateRelayState(id, !relay.state); }
function updateRelayState(relayId, newState) {
    const relay = relays.find(r => r.id === relayId); if (!relay) return;
    if (relay.pendingTimeout) { clearTimeout(relay.pendingTimeout); relay.pendingTimeout = null; }
    const delay = relayDelays[relayId] || 0;
    const displayName = customNames[relayId] || relay.name;
    if (delay > 0) {
        showToastMessage(`⏱ ${displayName} จะ${newState ? 'เปิด' : 'ปิด'} ใน ${delay} วินาที`); speakFeedback(`หน่วงเวลา ${delay} วินาที ${displayName} จะ${newState ? 'เปิด' : 'ปิด'}`);
        const stateDiv = document.querySelector(`.relay-card[data-id='${relayId}'] .relay-state`);
        if (stateDiv) { stateDiv.classList.add('pending'); stateDiv.innerText = '⏱ PENDING'; setTimeout(() => { if (stateDiv && stateDiv.classList.contains('pending') && !relay.pendingTimeout) { stateDiv.classList.remove('pending'); stateDiv.innerText = relay.state ? 'ON' : 'OFF'; } }, delay * 1000); }
        relay.pendingTimeout = setTimeout(() => { executeRelayCommand(relayId, newState); relay.pendingTimeout = null; }, delay * 1000);
    } else executeRelayCommand(relayId, newState);
}
function executeRelayCommand(relayId, newState) {
    const relay = relays.find(r => r.id === relayId); if (!relay || relay.state === newState) return;
    const success = sendHttpCommand(relayId, newState);
    if (success) { relay.state = newState; renderRelays(); const displayName = customNames[relayId] || relay.name; const stateText = newState ? 'เปิด' : 'ปิด'; showToastMessage(`🔌 ${displayName} → ${stateText}`); speakFeedback(`${displayName} ${stateText} แล้ว`); }
}
function allRelaysOn() { relays.forEach(r => { if (!r.state) sendHttpCommand(r.id, true) && (r.state = true); }); renderRelays(); showToastMessage("⚡ เปิดรีเลย์ทั้งหมด 6 ช่อง"); speakFeedback("เปิดรีเลย์ทั้งหมด"); }
function allRelaysOff() { relays.forEach(r => { if (r.state) sendHttpCommand(r.id, false) && (r.state = false); }); renderRelays(); showToastMessage("🔻 ปิดรีเลย์ทั้งหมด"); speakFeedback("ปิดรีเลย์ทั้งหมด"); }
function syncStatus() { showToastMessage("🔄 SYNC - สถานะรีเลย์ตามล่าสุด (ไม่มีฟีดแบ็กจากอุปกรณ์)"); }

// ==================== MODAL FUNCTIONS ====================
function openNameModal(relayId) { 
    currentEditingRelay = relayId; 
    const currentName = customNames[relayId] || relays[relayId-1].name;
    document.getElementById('nameModal').classList.add('active'); 
    document.getElementById('relayNameInput').value = currentName; 
    document.getElementById('modalTitle').innerHTML = `ตั้งชื่อ RELAY ${relayId}`; 
}
function saveRelayName() { const newName = document.getElementById('relayNameInput').value.trim(); if (!newName) { showToastMessage("⚠️ กรุณาใส่ชื่อ"); return; } customNames[currentEditingRelay] = newName; saveCustomNames(); const relay = relays.find(r => r.id === currentEditingRelay); if (relay) relay.name = newName; renderRelays(); closeModal(); speakFeedback(`ตั้งชื่อ RELAY ${currentEditingRelay} เป็น ${newName} เรียบร้อย`); showToastMessage(`✅ ตั้งชื่อ RELAY ${currentEditingRelay} เป็น "${newName}"`); }

// แก้ไขปัญหาลบชื่อเล่นแล้ว ดึงชื่อภาษาไทยดีฟอลต์มาใส่ให้
function deleteRelayName() { 
    delete customNames[currentEditingRelay]; 
    saveCustomNames(); 
    const relay = relays.find(r => r.id === currentEditingRelay); 
    if (relay) {
        const fallbackName = DEFAULT_THAI_NAMES[currentEditingRelay] || `รีเลย์ ${currentEditingRelay}`;
        relay.name = fallbackName;
        relay.customName = fallbackName;
    }
    renderRelays(); 
    closeModal(); 
    speakFeedback(`ลบชื่อ RELAY ${currentEditingRelay} กลับเป็นชื่อเดิม`); 
    showToastMessage(`🗑️ ลบชื่อเรียบร้อย`); 
}
function closeModal() { document.getElementById('nameModal').classList.remove('active'); currentEditingRelay = null; }

// ==================== VOICE COMMAND (รองรับ 6 รีเลย์) ====================
function processVoiceCommand(cmd) {
    if(!cmd) return; let text = cmd.toLowerCase().trim();
    const displayDiv = document.getElementById('voiceCommandDisplay'); if(displayDiv){ displayDiv.innerHTML = `🎤 คำสั่ง: "${cmd}"`; setTimeout(()=>{ if(displayDiv) displayDiv.innerHTML=''; },3000); }
    if(text.includes("เปิดทั้งหมด")){ allRelaysOn(); return; } if(text.includes("ปิดทั้งหมด")){ allRelaysOff(); return; }
    if(text.includes("กลางคืน")){ updateRelayState(1,true); updateRelayState(5,true); updateRelayState(2,false); updateRelayState(3,false); updateRelayState(4,false); updateRelayState(6,false); speakFeedback("เปิดโหมดกลางคืน (ไฟหลัก+ไฟสวน)"); return; }
    if(text.includes("ประหยัด")){ updateRelayState(1,true); for(let i=2;i<=6;i++) updateRelayState(i,false); speakFeedback("เปิดโหมดประหยัดพลังงาน"); return; }
    let relayId = null;
    for (let i = 1; i <= RELAY_COUNT; i++) { if(customNames[i] && text.includes(customNames[i].toLowerCase())){ relayId=i; break; } }
    if(!relayId){ const kw={1:["ไฟหลัก"],2:["มอเตอร์","ปั๊ม"],3:["ระบายอากาศ"],4:["อุปกรณ์เสริม"],5:["ไฟสวน","สวน"],6:["เครื่องกรอง","กรองน้ำ"]}; for(let i=1;i<=RELAY_COUNT;i++){ if(kw[i] && kw[i].some(k=>text.includes(k))){ relayId=i; break; } } }
    if(!relayId){ let match = text.match(/\b([1-6])\b/); if(match) relayId=parseInt(match[1]); }
    if(!relayId){ speakFeedback("ไม่พบอุปกรณ์"); return; }
    
    let isOn = text.includes("เปิด") || text.includes("turn on");
    let isOff = text.includes("ปิด") || text.includes("turn off");
    
    // บังคับให้ระบุคำสั่งเสียงให้ชัดเจน ป้องกันคำสั่งปิดโดยไม่ได้ตั้งใจ
    if (isOn) {
        updateRelayState(relayId, true);
    } else if (isOff) {
        updateRelayState(relayId, false);
    } else {
        speakFeedback("กรุณาระบุว่าต้องการเปิดหรือปิดอุปกรณ์ค่ะ");
    }
}
function setupAutoListening() { if(!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) { document.getElementById('voice-status-text').innerHTML='❌ เบราว์เซอร์ไม่รองรับการฟัง'; return; } navigator.mediaDevices.getUserMedia({ audio: true }).then(stream=>{ stream.getTracks().forEach(t=>t.stop()); startRecognition(); }).catch(err=>{ isAutoListening=false; document.getElementById('voice-status-text').innerHTML='🔇 กรุณาอนุญาตไมโครโฟน'; }); }
function startRecognition() { const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; recognition = new SpeechRecognition(); recognition.lang='th-TH'; recognition.interimResults=true; recognition.continuous=true; recognition.onstart=()=>{ document.getElementById('voiceBadge').classList.add('listening'); document.getElementById('voice-led').classList.add('listening'); document.getElementById('voice-status-text').innerHTML='🎧 กำลังฟัง...'; errorCount=0; }; recognition.onresult=(e)=>{ 
    errorCount = 0; // เคลียร์ข้อผิดพลาดสะสมเมื่อประมวลเสียงสำเร็จ ช่วยให้ฟังต่อเนื่องได้ราบรื่นขึ้น
    for(let i=e.resultIndex;i<e.results.length;i++){ if(e.results[i].isFinal) processVoiceCommand(e.results[i][0].transcript); else document.getElementById('voiceCommandDisplay').innerHTML=`🎤 กำลังฟัง: "${e.results[i][0].transcript}"`; } 
}; recognition.onerror=(e)=>{ errorCount++; if(e.error==='not-allowed'){ document.getElementById('voice-status-text').innerHTML='🔇 ไม่อนุญาตใช้ไมโครโฟน'; isAutoListening=false; } if(errorCount>10){ isAutoListening=false; document.getElementById('voice-status-text').innerHTML='⚠️ หยุดฟังอัตโนมัติ'; } }; recognition.onend=()=>{ document.getElementById('voiceBadge').classList.remove('listening'); document.getElementById('voice-led').classList.remove('listening'); if(isAutoListening && errorCount<10){ setTimeout(()=>{ try{ recognition.start(); }catch(e){} },1000); } else { document.getElementById('voice-status-text').innerHTML='🤖 AI พร้อมทำงาน (แตะปุ่มเพื่อเริ่มฟัง)'; } }; try{ recognition.start(); }catch(e){} }
function toggleAutoListen() { isAutoListening=!isAutoListening; if(isAutoListening){ if(recognition) try{ recognition.stop(); }catch(e){} startRecognition(); document.getElementById('voiceHint').innerHTML='🎤 กำลังฟังอัตโนมัติ... (แตะเพื่อปิด)'; speakFeedback("เปิดโหมดฟังอัตโนมัติ"); } else { if(recognition) recognition.stop(); document.getElementById('voiceHint').innerHTML='🎤 แตะเพื่อเปิดฟัง (ฟังตลอด)'; speakFeedback("ปิดโหมดฟังอัตโนมัติ"); } }

// ==================== HTTP TEST ====================
function testHTTPConnection() { 
    const baseInput = document.getElementById('http-base-url'); 
    if(baseInput && baseInput.value.trim()) httpBaseURL = baseInput.value.trim(); 
    fetch(httpBaseURL, { method:'HEAD', mode:'no-cors' }).then(()=>{ 
        updateConnectionStatus(true, 'HTTP พร้อม'); 
        document.getElementById('http-status').innerHTML='✅ ฐานพร้อมใช้งาน'; 
    }).catch(()=>{ 
        // เปลี่ยนกลับเป็น false เมื่อเชื่อมต่อไม่สำเร็จ
        updateConnectionStatus(false, 'เชื่อมต่อล้มเหลว'); 
        document.getElementById('http-status').innerHTML='⚠️ ไม่สามารถเข้าถึง Base URL (หน้าเว็บนี้อาจติดนโยบาย Mixed Content ของ Cloud)'; 
    }); 
}

// ==================== INITIALIZATION ====================
document.getElementById('allOnBtn').addEventListener('click', allRelaysOn);
document.getElementById('allOffBtn').addEventListener('click', allRelaysOff);
document.getElementById('syncBtn').addEventListener('click', syncStatus);
function updateTimestamp() { document.getElementById('timestamp').innerHTML = `⏱️ ${new Date().toLocaleTimeString('th-TH')}`; }

// เรียกใช้งานการตั้งค่าเริ่มต้น
loadStoredSettings(); 
renderRelays(); 
updateTimestamp(); 
setInterval(updateTimestamp, 1000);

console.log(`✅ TrojanAI (BP) v${VERSION} - ระบบควบคุม 6 รีเลย์ (HTTP + Voice) พร้อมทำงาน`);
console.log("✅ รองรับ HTTP API + Voice Command 6 ช่อง");