// ==============================================================================================
//    CHOD COGNITIVE SYSTEM VISUALIZER - เอนจินฟิสิกส์และการเรนเดอร์ 3 มิติ (visualizer-brain-physics.js)
// ==============================================================================================

// ------------------------------------------------------------
//  ส่วนการตั้งค่าความปลอดภัยของตัวแปรระบบส่วนกลาง (Defensive Globals Setup)
// ------------------------------------------------------------
if (typeof window.vertices === 'undefined') window.vertices = [];
if (typeof window.edges === 'undefined') window.edges = [];
if (typeof window.impulses === 'undefined') window.impulses = [];
if (typeof window.ambientParticles === 'undefined') window.ambientParticles = [];
if (typeof window.lobeCenters === 'undefined') window.lobeCenters = {};
if (typeof window.canvas === 'undefined') window.canvas = null;
if (typeof window.ctx === 'undefined') window.ctx = null;
if (typeof window.eegCanvas === 'undefined') window.eegCanvas = null;
if (typeof window.eegCtx === 'undefined') window.eegCtx = null;
if (typeof window.specCanvas === 'undefined') window.specCanvas = null;
if (typeof window.specCtx === 'undefined') window.specCtx = null;
if (typeof window.angleX === 'undefined') window.angleX = 0;
if (typeof window.angleY === 'undefined') window.angleY = 0;
if (typeof window.eegOffset === 'undefined') window.eegOffset = 0;
if (typeof window.maxImpulses === 'undefined') window.maxImpulses = 35;
if (typeof window.times === 'undefined') window.times = [];
if (typeof window.fps === 'undefined') window.fps = 0;
if (typeof window.animationId === 'undefined') window.animationId = null;
if (typeof window.secondWindow === 'undefined') window.secondWindow = null;
if (typeof window.recognition === 'undefined') window.recognition = null;
if (typeof window.isListening === 'undefined') window.isListening = false;

// ------------------------------------------------------------
//  ระบบสร้างรูปทรงสมองจำลอง 6 ส่วน และฟิสิกส์แรงสปริง (Spring Physics)
// ------------------------------------------------------------
function generateBiologicalBrain() {
    vertices = [];
    edges = [];
    impulses = [];
    ambientParticles = [];
    lobeCenters = {
        frontal: {x:0, y:0, z:0, count:0},
        parietal: {x:0, y:0, z:0, count:0},
        occipital: {x:0, y:0, z:0, count:0},
        temporal: {x:0, y:0, z:0, count:0},
        cerebellum: {x:0, y:0, z:0, count:0},
        brainstem: {x:0, y:0, z:0, count:0}
    };

    const totalPoints = 400; // จำนวนจุดประสาททั้งหมด

    for (let i = 0; i < totalPoints; i++) {
        let x = 0, y = 0, z = 0, lobe = '';

        const r = Math.random();
        if (r < 0.28) { 
            const theta = Math.random() * Math.PI;
            const phi = (Math.random() * 0.45 - 0.22) * Math.PI; 
            const rad = 11 + Math.random() * 4;
            x = rad * Math.sin(theta) * Math.cos(phi);
            y = 4 + rad * Math.cos(theta) + (Math.random() - 0.5) * 3;
            z = 9 + rad * Math.sin(theta) * Math.sin(phi);
            lobe = 'frontal';
        } else if (r < 0.48) {
            const theta = Math.random() * Math.PI * 0.65;
            const phi = (Math.random() * 0.35 + 0.3) * Math.PI; 
            const rad = 10 + Math.random() * 3.5;
            x = rad * Math.sin(theta) * Math.cos(phi);
            y = 7 + rad * Math.cos(theta);
            z = -3 + rad * Math.sin(theta) * Math.sin(phi);
            lobe = 'parietal';
        } else if (r < 0.63) {
            const theta = Math.random() * Math.PI * 0.55;
            const phi = (Math.random() * 0.25 + 0.88) * Math.PI;
            const rad = 8.5 + Math.random() * 2.5;
            x = rad * Math.sin(theta) * Math.cos(phi);
            y = 1.5 + rad * Math.cos(theta);
            z = -13 + rad * Math.sin(theta) * Math.sin(phi);
            lobe = 'occipital';
        } else if (r < 0.80) {
            const theta = Math.random() * Math.PI * 0.75;
            const phi = (Math.random() * 0.45 + 0.1) * Math.PI;
            const side = Math.random() < 0.5 ? -1 : 1;
            const rad = 9.5 + Math.random() * 3;
            x = (9 + rad * Math.sin(theta) * Math.cos(phi)) * side;
            y = -1.5 + rad * Math.cos(theta);
            z = 1.5 + rad * Math.sin(theta) * Math.sin(phi);
            lobe = 'temporal';
        } else if (r < 0.92) {
            const theta = Math.random() * Math.PI;
            const phi = Math.random() * Math.PI * 2;
            x = (7.5 + Math.random() * 2.5) * Math.sin(theta) * Math.cos(phi);
            y = -9 + (Math.cos(theta) * 3);
            z = -11 + (Math.sin(theta) * Math.sin(phi) * 7.5);
            lobe = 'cerebellum';
        } else {
            const vertY = -9 - Math.random() * 15;
            const taper = (28 + vertY) / 19; 
            const angle = Math.random() * Math.PI * 2;
            const radius = 3.2 * Math.max(0.12, taper);
            x = Math.cos(angle) * radius;
            y = vertY;
            z = -3.5 + Math.sin(angle) * radius;
            lobe = 'brainstem';
        }

        vertices.push({ 
            x, y, z, 
            lobe, 
            origX: x, origY: y, origZ: z,
            bold: 0.0,
            energy: 1.0
        });

        lobeCenters[lobe].x += x;
        lobeCenters[lobe].y += y;
        lobeCenters[lobe].z += z;
        lobeCenters[lobe].count++;
    }

    for (let lobe in lobeCenters) {
        if (lobeCenters[lobe].count > 0) {
            lobeCenters[lobe].x /= lobeCenters[lobe].count;
            lobeCenters[lobe].y /= lobeCenters[lobe].count;
            lobeCenters[lobe].z /= lobeCenters[lobe].count;
        }
    }

    for (let i = 0; i < vertices.length; i++) {
        for (let j = i + 1; j < vertices.length; j++) {
            const v1 = vertices[i];
            const v2 = vertices[j];
            const distSq = (v1.x - v2.x)**2 + (v1.y - v2.y)**2 + (v1.z - v2.z)**2;
            let threshold = 45; 
            
            if (v1.lobe === 'brainstem' || v1.lobe === 'cerebellum') {
                threshold = 32;
            }

            if (v1.lobe === v2.lobe && distSq < threshold) {
                if (Math.random() < 0.60) {
                    edges.push({ i, j, type: 'intra', weight: 0.1 + Math.random() * 0.35 });
                }
            }
        }
    }

    for (let i = 0; i < vertices.length; i++) {
        const v1 = vertices[i];
        if (v1.lobe === 'temporal' && v1.x < 0) {
            for (let j = 0; j < vertices.length; j++) {
                const v2 = vertices[j];
                if (v2.lobe === 'temporal' && v2.x > 0) {
                    const distSq = (v1.x - v2.x)**2 + (v1.y - v2.y)**2 + (v1.z - v2.z)**2;
                    if (distSq < 150 && Math.abs(v1.y - v2.y) < 4.5) {
                        if (Math.random() < 0.12) {
                            edges.push({ i, j, type: 'callosum', weight: 0.4 + Math.random() * 0.4 });
                        }
                    }
                }
            }
        }
    }

    for (let i = 0; i < 65; i++) {
        ambientParticles.push({
            x: (Math.random() - 0.5) * 28,
            y: (Math.random() - 0.5) * 28,
            z: (Math.random() - 0.5) * 28,
            size: 0.4 + Math.random() * 1.6,
            speed: 0.02 + Math.random() * 0.06,
            alpha: 0.2 + Math.random() * 0.5
        });
    }

    const nMetric = document.getElementById("hud-neurons-metric");
    if (nMetric) nMetric.innerText = vertices.length;

    // [ตรวจสอบความปลอดภัย] เรียกใช้งานระบบถอดรหัสเอ็นแกรมแบบป้องกันข้อผิดพลาดการอ้างอิงตำแหน่งหน่วยความจำ
    const engramCache = (typeof loadEngramFromLocal === 'function') ? loadEngramFromLocal() : null;
    if (engramCache && engramCache.chem) {
        if (window.ChodBrain && window.ChodBrain.neurotransmitters) {
            window.ChodBrain.neurotransmitters.dopamine = engramCache.chem.dopamine || 0.5;
            window.ChodBrain.neurotransmitters.serotonin = engramCache.chem.serotonin || 0.6;
            window.ChodBrain.neurotransmitters.adrenaline = engramCache.chem.adrenaline || 0.25;
        }
        if (engramCache.theme && typeof selectedTheme !== 'undefined') {
            selectedTheme = engramCache.theme;
        }
        setTimeout(() => {
            if (typeof injectLog === 'function') {
                const gluVal = engramCache.chem.glutamate !== undefined ? Math.round(engramCache.chem.glutamate * 100) : 0;
                const serVal = engramCache.chem.serotonin !== undefined ? Math.round(engramCache.chem.serotonin * 100) : 0;
                injectLog(`กู้คืนประจุสมองเอ็นแกรม (Engram) สำเร็จ: กลูตาเมต (GLU) ${gluVal}% // เซโรโทนิน (SER) ${serVal}%`);
            }
        }, 1500);
    }
}

// ------------------------------------------------------------
//  ระบบประมวลผลโครงสร้างเครือข่ายประสาทและแรงยืดหยุ่นสปริง (Spring Force)
// ------------------------------------------------------------
let clusteringCoeff = 0.32;
let smallWorldIndex = 1.15;
let globalEfficiency = 0.58;
let totalBOLDActivity = 0.0;
let topologyFrameCounter = 0;

function updateNetworkTopology(avgWeight) {
    topologyFrameCounter++;
    if (topologyFrameCounter % 25 !== 0) return;

    let totalC = 0;
    const sampleSize = Math.min(30, vertices.length);
    
    for (let s = 0; s < sampleSize; s++) {
        const nodeIdx = Math.floor(Math.random() * Math.max(1, vertices.length));
        const neighbors = [];
        edges.forEach(e => {
            if (e.i === nodeIdx) neighbors.push(e.j);
            else if (e.j === nodeIdx) neighbors.push(e.i);
        });

        const k = neighbors.length;
        if (k < 2) {
            totalC += 0;
            continue;
        }

        let actualNeighborLinks = 0;
        for (let a = 0; a < k; a++) {
            for (let b = a + 1; b < k; b++) {
                const n1 = neighbors[a];
                const n2 = neighbors[b];
                const connected = edges.some(e => (e.i === n1 && e.j === n2) || (e.i === n2 && e.j === n1));
                if (connected) actualNeighborLinks++;
            }
        }
        const possibleNeighborLinks = (k * (k - 1)) / 2;
        totalC += (actualNeighborLinks / possibleNeighborLinks);
    }
    
    clusteringCoeff = totalC / sampleSize;
    const C_random = 0.12; 
    smallWorldIndex = clusteringCoeff / C_random;
    const density = edges.length / ((vertices.length * (vertices.length - 1)) / 2);
    globalEfficiency = (density * 10) + (avgWeight * 0.7);
    if (globalEfficiency > 1.0) globalEfficiency = 0.985;

    const cMetric = document.getElementById("hud-clustering");
    if (cMetric) cMetric.innerText = clusteringCoeff.toFixed(4);
    const swMetric = document.getElementById("hud-smallworld");
    if (swMetric) swMetric.innerText = smallWorldIndex.toFixed(4);
    const efMetric = document.getElementById("hud-efficiency");
    if (efMetric) efMetric.innerText = globalEfficiency.toFixed(4);
}

function simulateSpringPhysics() {
    edges.forEach(edge => {
        if (!vertices[edge.i] || !vertices[edge.j]) return; // ป้องกันข้อผิดพลาดกรณียังโหลดโหนดสมองไม่ครบ
        const v1 = vertices[edge.i];
        const v2 = vertices[edge.j];

        const dx = v2.x - v1.x;
        const dy = v2.y - v1.y;
        const dz = v2.z - v1.z;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 0.001;

        const restLength = 7.5; // ระยะห่างคงที่เป้าหมาย
        const springK = 0.0035 * edge.weight; // ค่าสัมประสิทธิ์ความยืดหยุ่นสปริง
        const force = (dist - restLength) * springK; // แรงยืดหดของสปริง

        v1.x += (dx / dist) * force;
        v1.y += (dy / dist) * force;
        v1.z += (dz / dist) * force;

        v2.x -= (dx / dist) * force;
        v2.y -= (dy / dist) * force;
        v2.z -= (dz / dist) * force;
    });

    vertices.forEach(v => {
        const dx = v.origX - v.x;
        const dy = v.origY - v.y;
        const dz = v.origZ - v.z;
        const restoringStrength = 0.015;

        v.x += dx * restoringStrength;
        v.y += dy * restoringStrength;
        v.z += dz * restoringStrength;
    });
}

function triggerExcitatoryCascade(nodeIdx, depth) {
    if (depth > 5) return; // ป้องกันการสะท้อนกลับวนลูปเกินพิกัด
    if (!vertices[nodeIdx]) return; // [ตรวจสอบความปลอดภัย] ป้องกันข้อผิดพลาดกรณีดัชนีโหนดไม่อยู่ในระบบ

    const connectedEdges = edges.filter(e => e.i === nodeIdx || e.j === nodeIdx);
    connectedEdges.forEach(edge => {
        if (!vertices[edge.i] || !vertices[edge.j]) return;

        impulses.push({
            edge,
            progress: 0,
            speed: 0.025 + Math.random() * 0.035,
            isCascade: true
        });

        vertices[edge.i].bold = Math.min(1.0, vertices[edge.i].bold + 0.35);
        vertices[edge.j].bold = Math.min(1.0, vertices[edge.j].bold + 0.35);
        edge.weight = Math.min(1.0, edge.weight + 0.15);

        const nextNode = edge.i === nodeIdx ? edge.j : edge.i;
        if (Math.random() < 0.45 && vertices[nextNode]) {
            setTimeout(() => triggerExcitatoryCascade(nextNode, depth + 1), 70);
        }
    });
}

// ------------------------------------------------------------
//  ระบบวาดคลื่นสมอง (EEG) บนผืนผ้าใบดิจิทัล (Canvas)
// ------------------------------------------------------------
function drawEEGBands(colorHex, chem, frustration) {
    if (!eegCtx || !eegCanvas) return;
    eegCtx.clearRect(0, 0, eegCanvas.width, eegCanvas.height);
    eegOffset += 0.045;

    function drawWave(ctx, freq, amp, color, offset) {
        ctx.strokeStyle = color;
        ctx.beginPath();
        for (let x = 0; x < eegCanvas.width; x++) {
            const y = eegCanvas.height / 2 + Math.sin(x * freq - offset) * amp;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    const isSedated = (typeof activeDrug !== 'undefined' && activeDrug === 'sedative'); // ตรวจสอบสถานะระงับประสาท
    const deltaAmp = isSedated ? 20 : 3;
    drawWave(eegCtx, 0.015, deltaAmp, "rgba(71, 85, 105, 0.3)", eegOffset * 0.35);

    const alphaAmp = chem.serotonin * 10;
    drawWave(eegCtx, 0.08, alphaAmp, "rgba(56, 189, 248, 0.3)", eegOffset * 1.5);

    const betaAmp = (chem.adrenaline * 8) + (frustration * 8);
    if (betaAmp > 1) {
        drawWave(eegCtx, 0.24, betaAmp, "rgba(239, 68, 68, 0.25)", eegOffset * 4.5);
    }

    const gammaAmp = (chem.glutamate * 6) + (chem.dopamine * 4);
    if (gammaAmp > 1) {
        drawWave(eegCtx, 0.5, gammaAmp, "rgba(168, 85, 247, 0.25)", eegOffset * 8.0);
    }

    eegCtx.lineWidth = 1.3;
    eegCtx.strokeStyle = colorHex;
    eegCtx.beginPath();
    for (let x = 0; x < eegCanvas.width; x++) {
        const rawY = eegCanvas.height / 2 + 
                     Math.sin(x * 0.035 - eegOffset * 1.6) * 5 + 
                     Math.sin(x * 0.12 + eegOffset * 3.0) * (betaAmp > 1 ? betaAmp * 0.28 : 1.2) +
                     Math.sin(x * 0.4 - eegOffset * 7.5) * (gammaAmp * 0.3) +
                     (Math.random() - 0.5) * 1.5;
        if (x === 0) eegCtx.moveTo(x, rawY);
        else eegCtx.lineTo(x, rawY);
    }
    eegCtx.stroke();
}

function drawSpectrum(colorHex, adrenaline, glutamate) {
    if (!specCtx || !specCanvas) return;
    specCtx.clearRect(0, 0, specCanvas.width, specCanvas.height);
    specCtx.fillStyle = colorHex;
    const numBars = 32;
    const barWidth = specCanvas.width / numBars;

    for (let i = 0; i < numBars; i++) {
        const baseWave = Math.sin(i * 0.3 + eegOffset * 2.8) * 16 + 22;
        const barHeight = Math.max(4, baseWave * (0.3 + adrenaline * 0.7 + glutamate * 0.4));
        specCtx.fillRect(i * barWidth + 1, specCanvas.height - barHeight, barWidth - 1.5, barHeight);
    }
}

// ------------------------------------------------------------
//  ระบบส่งและสลับข้อมูลการเรนเดอร์ไปยังจอแสดงผลเสริมแผงควบคุมที่ 2 (แก้ไขจุดเสี่ยงพังแล้ว)
// ------------------------------------------------------------
function renderSecondWindowData(chem, avgTemporalBOLD, avgTemporalWeight) {
    if (!secondWindow || secondWindow.closed) return;

    try {
        const sDoc = secondWindow.document;

        // ฟังก์ชันช่วยเขียนข้อมูลแบบปลอดภัยเพื่อป้องกันข้อผิดพลาดกรณีหน้าต่างเสริมโหลดไม่เสร็จสมบูรณ์
        const updateText = (id, value) => {
            const el = sDoc.getElementById(id);
            if (el) el.innerText = value;
        };

        const updateWidth = (id, percent) => {
            const el = sDoc.getElementById(id);
            if (el) el.style.width = percent + "%";
        };

        updateText("m2-temporal-bold", (avgTemporalBOLD * 100).toFixed(1) + "%");
        updateText("m2-ltp-weight", avgTemporalWeight.toFixed(4));

        const plasticityIndex = avgTemporalWeight * (1.2 + chem.glutamate * 0.5);
        updateText("m2-plasticity", plasticityIndex.toFixed(4));

        const engramRate = Math.min(100, (avgTemporalBOLD * 45) + (chem.serotonin * 40) + (chem.dopamine * 15));
        updateWidth("m2-fill-engram", engramRate.toFixed(0));

        const retrievalEff = Math.max(10, Math.min(100, (chem.dopamine * 60) + (chem.glutamate * 40) - (chem.gaba * 15)));
        updateText("m2-retrieval", retrievalEff.toFixed(0) + "%");

        updateWidth("m2-fill-bold", (avgTemporalBOLD * 100).toFixed(0));
        updateWidth("m2-fill-ltp", Math.min(100, avgTemporalWeight * 100).toFixed(0));
        updateWidth("m2-fill-plasticity", Math.min(100, plasticityIndex * 100).toFixed(0));
        updateWidth("m2-fill-retrieval", retrievalEff.toFixed(0));

        const sCanvas = sDoc.getElementById("memory-grid-canvas");
        if (sCanvas) {
            if (sCanvas.width !== sCanvas.clientWidth || sCanvas.height !== sCanvas.clientHeight) {
                sCanvas.width = sCanvas.clientWidth;
                sCanvas.height = sCanvas.clientHeight;
            }

            const sCtx = sCanvas.getContext("2d");
            if (sCtx) {
                sCtx.clearRect(0, 0, sCanvas.width, sCanvas.height);
                memoryMeshPhase += 0.015;

                const gridRows = 6;
                const gridCols = 8;
                const cellW = sCanvas.width / gridCols;
                const cellH = sCanvas.height / gridRows;

                for (let r = 0; r < gridRows; r++) {
                    for (let c = 0; c < gridCols; c++) {
                        const cellX = c * cellW + cellW / 2;
                        const cellY = r * cellH + cellH / 2;

                        const byteValue = Math.sin((r * 0.5) + (c * 0.8) + memoryMeshPhase) * 0.5 + 0.5;
                        const isFiring = (byteValue > 0.7 && Math.random() < 0.2 * chem.glutamate);

                        sCtx.fillStyle = isFiring 
                            ? "rgba(239, 68, 68, 0.7)" 
                            : `rgba(168, 85, 247, ${0.1 + byteValue * 0.35})`;

                        sCtx.beginPath();
                        sCtx.arc(cellX, cellY, 2 + byteValue * 4.5, 0, Math.PI * 2);
                        sCtx.fill();

                        if (c < gridCols - 1) {
                            sCtx.strokeStyle = `rgba(168, 85, 247, ${0.03 + byteValue * 0.1})`;
                            sCtx.lineWidth = 0.5;
                            sCtx.beginPath();
                            sCtx.moveTo(cellX, cellY);
                            sCtx.lineTo(cellX + cellW, cellY);
                            sCtx.stroke();
                        }
                        if (r < gridRows - 1) {
                            sCtx.strokeStyle = `rgba(168, 85, 247, ${0.03 + byteValue * 0.1})`;
                            sCtx.lineWidth = 0.5;
                            sCtx.beginPath();
                            sCtx.moveTo(cellX, cellY);
                            sCtx.lineTo(cellX, cellY + cellH);
                            sCtx.stroke();
                        }
                    }
                }
            }
        }
    } catch (err) {
        // ละเว้นข้อผิดพลาดเพื่อป้องกันระบบตัดการเชื่อมต่อจากหน้าต่างที่ 2 ขณะพยายามรอข้อมูลพร้อมแสดงผล
    }
}

// ------------------------------------------------------------
//  ระบบวาดวงแหวนพิกัดนำสายตา 3 มิติ (3D Coordinate Rings)
// ------------------------------------------------------------
function draw3DCoordinateRing(y, radius, colorHex, dashed = false) {
    if (!ctx || !canvas) return;
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 0.55;
    if (dashed) {
        ctx.setLineDash([4, 6]);
    } else {
        ctx.setLineDash([]);
    }

    const scale = Math.min(canvas.width / 2, canvas.height / 2) * (window.innerWidth <= 600 ? 5.5 : 7.5);
    const distance = 145;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.08) {
        const rx = radius * Math.cos(a);
        const rz = radius * Math.sin(a);

        const x1 = rx * Math.cos(angleY) - rz * Math.sin(angleY);
        const z1 = rx * Math.sin(angleY) + rz * Math.cos(angleY);
        const y2 = y * Math.cos(angleX) - z1 * Math.sin(angleX);
        const z2 = y * Math.sin(angleX) + z1 * Math.cos(angleX);

        const fovScale = scale / (distance + z2);
        const sx = centerX + x1 * fovScale;
        const sy = centerY - y2 * fovScale;

        if (a === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.setLineDash([]); 
}

// ------------------------------------------------------------
//  [ระบบใหม่] ระบบวาดกรงขอบเขตวิเคราะห์พิกัดหมุน 3 มิติ (3D Bounding Cage)
// ------------------------------------------------------------
function draw3DBoundingCage(centerX, centerY, scale, distance, colorRGB) {
    if (!ctx) return;
    ctx.strokeStyle = `rgba(${colorRGB}, 0.12)`;
    ctx.lineWidth = 0.5;

    // กำหนดมุมขอบเขตกรงล้อมรอบสมอง [-16 ถึง 16]
    const xMin = -16, xMax = 16;
    const yMin = -26, yMax = 15;
    const zMin = -16, zMax = 16;

    const corners = [
        {x: xMin, y: yMin, z: zMin}, {x: xMax, y: yMin, z: zMin},
        {x: xMax, y: yMax, z: zMin}, {x: xMin, y: yMax, z: zMin},
        {x: xMin, y: yMin, z: zMax}, {x: xMax, y: yMin, z: zMax},
        {x: xMax, y: yMax, z: zMax}, {x: xMin, y: yMax, z: zMax}
    ];

    const projected = corners.map(c => {
        const x1 = c.x * Math.cos(angleY) - c.z * Math.sin(angleY);
        const z1 = c.x * Math.sin(angleY) + c.z * Math.cos(angleY);
        const y2 = c.y * Math.cos(angleX) - z1 * Math.sin(angleX);
        const z2 = c.y * Math.sin(angleX) + z1 * Math.cos(angleX);
        const fovScale = scale / (distance + z2);
        return {
            x: centerX + x1 * fovScale,
            y: centerY - y2 * fovScale
        };
    });

    const drawLine = (i, j) => {
        ctx.beginPath();
        ctx.moveTo(projected[i].x, projected[i].y);
        ctx.lineTo(projected[j].x, projected[j].y);
        ctx.stroke();
    };

    // ลากโยงโครงกล่อง
    drawLine(0, 1); drawLine(1, 2); drawLine(2, 3); drawLine(3, 0);
    drawLine(4, 5); drawLine(5, 6); drawLine(6, 7); drawLine(7, 4);
    drawLine(0, 4); drawLine(1, 5); drawLine(2, 6); drawLine(3, 7);

    // วาดเหลี่ยมขอบมุมนีออนกระชับรายละเอียด HUD
    ctx.fillStyle = `rgba(${colorRGB}, 0.5)`;
    projected.forEach(p => {
        ctx.fillRect(p.x - 3, p.y - 3, 6, 1);
        ctx.fillRect(p.x - 3, p.y - 3, 1, 6);
        ctx.fillRect(p.x + 3, p.y + 3, -6, 1);
        ctx.fillRect(p.x + 3, p.y + 3, -1, -6);
    });
}

// ------------------------------------------------------------
//  [ระบบใหม่] ระบบระบุพิกัดและวาดระบบล็อกเป้าประจุประสาทพลังงานสูง (Target Tracking Reticle)
// ------------------------------------------------------------
function drawTargetLock(sx, sy, idx, colorHex, boldVal, colorRGB) {
    if (!ctx) return;
    const time = Date.now() * 0.003;
    const size = 15 + Math.sin(time) * 3;

    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 1;

    // วาดเหลี่ยมวงเล็บเป้าหมาย [ ]
    ctx.beginPath();
    ctx.moveTo(sx - size, sy - size + 5); ctx.lineTo(sx - size, sy - size); ctx.lineTo(sx - size + 5, sy - size);
    ctx.moveTo(sx + size, sy - size + 5); ctx.lineTo(sx + size, sy - size); ctx.lineTo(sx + size - 5, sy - size);
    ctx.moveTo(sx - size, sy + size - 5); ctx.lineTo(sx - size, sy + size); ctx.lineTo(sx - size + 5, sy + size);
    ctx.moveTo(sx + size, sy + size - 5); ctx.lineTo(sx + size, sy + size); ctx.lineTo(sx + size - 5, sy + size);
    ctx.stroke();

    // ตัวอักษรและเลขเวกเตอร์แสดงสถานะ
    ctx.fillStyle = `rgba(${colorRGB}, 0.85)`;
    ctx.font = 'bold 6.5px monospace';
    ctx.fillText(`ล็อกเป้าหมายผิดปกติ: โหนด_${idx}`, sx + size + 5, sy - 6);
    ctx.fillText(`ความแรงประจุ: ${(boldVal * 100).toFixed(0)}%`, sx + size + 5, sy + 2);
    ctx.fillText(`พิกัดเวกเตอร์: [${sx.toFixed(0)},${sy.toFixed(0)}]`, sx + size + 5, sy + 10);

    // ไฟสีแดงกะพริบแจ้งเตือนเมื่อเกิดคลื่นประสาทพุ่งสูงผิดปกติ
    if (Math.floor(time * 3) % 2 === 0) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(sx - size - 6, sy - size + 1, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ------------------------------------------------------------
//  ระบบลูปประมวลผลภาพเคลื่อนไหวหลักของหน้าจอแสดงสถานะ (Main Animation HUD Loop)
// ------------------------------------------------------------
function renderHUD() {
    if (!ctx || !canvas) return;
    const brain = window.ChodBrain;

    // ผูกสีเร่งสีนีออนให้แผง HUD วาดสอดคล้องกับธีมที่ตกลงไว้
    let colorRGB = "56, 189, 248";
    let colorHex = "#38bdf8";
    let frustration = 0.0;

    const hasThemes = (typeof themes !== 'undefined' && typeof selectedTheme !== 'undefined' && themes[selectedTheme]);
    if (hasThemes) {
        colorRGB = themes[selectedTheme].rgb;
        colorHex = themes[selectedTheme].hex;
    }

    let chem = {
        glutamate: 0.4,
        gaba: 0.35,
        dopamine: 0.5,
        serotonin: 0.6,
        adrenaline: 0.25
    };

    if (brain && brain.neurotransmitters) {
        const rawChem = brain.neurotransmitters;
        frustration = brain.frustrationScore || 0.0;
        chem.dopamine = rawChem.dopamine !== undefined ? rawChem.dopamine : chem.dopamine;
        chem.serotonin = rawChem.serotonin !== undefined ? rawChem.serotonin : chem.serotonin;
        chem.adrenaline = rawChem.adrenaline !== undefined ? rawChem.adrenaline : chem.adrenaline;
        chem.glutamate = 0.4 + (chem.adrenaline * 0.3) - (chem.serotonin * 0.1);
        chem.gaba = 0.35 + (chem.serotonin * 0.4) - (chem.adrenaline * 0.2);
    }

    if (typeof applyDrugModulations === 'function') {
        applyDrugModulations();
    }

    if (typeof drugGlutamateMod !== 'undefined') {
        chem.glutamate = Math.max(0.01, Math.min(1.0, chem.glutamate + drugGlutamateMod));
        chem.gaba = Math.max(0.01, Math.min(1.0, chem.gaba + drugGabaMod));
        chem.dopamine = Math.max(0.01, Math.min(1.0, chem.dopamine + drugDopamineMod));
        chem.adrenaline = Math.max(0.01, Math.min(1.0, chem.adrenaline + drugAdrenalineMod));
        chem.serotonin = Math.max(0.01, Math.min(1.0, chem.serotonin + drugSerotoninMod));
    }

    // บันทึกประจุความจำเคมีปัจจุบันลงหน่วยความจำแบบสุ่ม (ถนอมสิทธิ์เขียนข้อมูล)
    if (Math.random() < 0.01 && typeof saveEngramToLocal === 'function') {
        saveEngramToLocal(chem);
    }

    const currentDrug = typeof activeDrug !== 'undefined' ? activeDrug : null;

    // ปรับเปลี่ยนสีสมองฉุกเฉินเฉพาะสภาวะตื่นตัวหรืออารมณ์สั่นคลอน
    if (frustration > 0.6) {
        colorRGB = "239, 68, 68"; colorHex = "#ef4444"; 
    } else if (currentDrug === 'psychedelic') {
        colorRGB = "168, 85, 247"; colorHex = "#a855f7"; 
    } else if (chem.glutamate > 0.75) {
        colorRGB = "249, 115, 22"; colorHex = "#f97316"; 
    } else if (currentDrug === 'sedative') {
        colorRGB = "20, 184, 166"; colorHex = "#14b8a6"; 
    }

    // อัปเดตสีของส่วนประกอบอื่น ๆ บน HUD
    const mWidget = document.getElementById("chod-brain-monitor-widget");
    if (mWidget) {
        mWidget.style.setProperty("--brain-glow-color", `rgba(${colorRGB}, 0.5)`);
        mWidget.style.setProperty("--hud-border-glow", colorHex);
        mWidget.style.setProperty("--hud-text-glow", colorHex);
    }

    // ตรวจสอบขนาดภาพ
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
    }
    if (eegCanvas && eegCanvas.width !== eegCanvas.clientWidth) {
        eegCanvas.width = eegCanvas.clientWidth;
        eegCanvas.height = eegCanvas.clientHeight;
    }
    if (specCanvas && specCanvas.width !== specCanvas.clientWidth) {
        specCanvas.width = specCanvas.clientWidth;
        specCanvas.height = specCanvas.clientHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let glitchOffsetX = 0;
    if (Math.random() < 0.015) {
        glitchOffsetX = (Math.random() - 0.5) * 7.5; 
    }
    ctx.save();
    ctx.translate(glitchOffsetX, 0);

    const spin = 0.002 + (chem.adrenaline * 0.015);
    angleY += spin;
    angleX = 0.15 + Math.sin(angleY * 0.25) * 0.07;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const scale = Math.min(centerX, centerY) * (window.innerWidth <= 600 ? 5.5 : 7.5);
    const distance = 145;

    // ร่างกรวยไฟโฮโลแกรมพุ่งตรงจาก Emitter ใต้ฐานสมอง
    const lightPulse = 0.1 + Math.sin(Date.now() * 0.01) * 0.03;
    const coneGradient = ctx.createLinearGradient(centerX, canvas.height, centerX, centerY);
    coneGradient.addColorStop(0, `rgba(${colorRGB}, ${0.28 + lightPulse})`);
    coneGradient.addColorStop(0.2, `rgba(${colorRGB}, 0.08)`);
    coneGradient.addColorStop(1, `rgba(${colorRGB}, 0)`);
    
    ctx.fillStyle = coneGradient;
    ctx.beginPath();
    ctx.moveTo(centerX - 85, canvas.height - 15);
    ctx.lineTo(centerX + 85, canvas.height - 15);
    ctx.lineTo(centerX + 180, centerY - 110);
    ctx.lineTo(centerX - 180, centerY - 110);
    ctx.closePath();
    ctx.fill();

    simulateSpringPhysics();

    vertices.forEach(v => {
        v.bold = Math.max(0.0, v.bold - 0.015);
    });

    const projectedCache = vertices.map(v => {
        const x1 = v.x * Math.cos(angleY) - v.z * Math.sin(angleY);
        const z1 = v.x * Math.sin(angleY) + v.z * Math.cos(angleY);
        const y2 = v.y * Math.cos(angleX) - z1 * Math.sin(angleX);
        const z2 = v.y * Math.sin(angleX) + z1 * Math.cos(angleX);

        const fovScale = scale / (distance + z2);
        return {
            sx: centerX + x1 * fovScale,
            sy: centerY - y2 * fovScale,
            sz: z2,
            vRef: v
        };
    });

    ambientParticles.forEach(p => {
        p.y += p.speed;
        if (p.y > 22) p.y = -22; 

        const rotS = 0.0035;
        const originalX = p.x;
        p.x = p.x * Math.cos(rotS) - p.z * Math.sin(rotS);
        p.z = originalX * Math.sin(rotS) + p.z * Math.cos(rotS);

        const x1 = p.x * Math.cos(angleY) - p.z * Math.sin(angleY);
        const z1 = p.x * Math.sin(angleY) + p.z * Math.cos(angleY);
        const y2 = p.y * Math.cos(angleX) - z1 * Math.sin(angleX);
        const z2 = p.y * Math.sin(angleX) + z1 * Math.cos(angleX);

        const fovScale = scale / (distance + z2);
        const sx = centerX + x1 * fovScale;
        const sy = centerY - y2 * fovScale;

        if (z2 > -40) {
            const particleAlpha = p.alpha * Math.max(0.1, Math.min(1.0, 0.5 + (z2 / 45)));
            ctx.fillStyle = `rgba(${colorRGB}, ${particleAlpha.toFixed(2)})`;
            ctx.beginPath();
            ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    edges.forEach(edge => {
        edge.weight = Math.max(0.05, edge.weight - 0.0002 * (1.0 - chem.serotonin));
    });

    ctx.globalCompositeOperation = 'lighter';

    // วาดกรงกักขังพิกัด 3D Bounding Cage ครอบโครงสร้างสมอง
    draw3DBoundingCage(centerX, centerY, scale, distance, colorRGB);

    draw3DCoordinateRing(-13, 21, `rgba(${colorRGB}, 0.15)`, false); 
    draw3DCoordinateRing(13, 21, `rgba(${colorRGB}, 0.15)`, false);  
    draw3DCoordinateRing(0, 16.5, `rgba(${colorRGB}, 0.08)`, true);   

    let scanPlaneY = Math.sin(Date.now() * 0.0011) * 16.5;
    draw3DCoordinateRing(scanPlaneY, 15.2, `rgba(${colorRGB}, 0.35)`, true);
    draw3DCoordinateRing(scanPlaneY, 15.4, `rgba(${colorRGB}, 0.65)`, false);

    edges.forEach(edge => {
        const p1 = projectedCache[edge.i];
        const p2 = projectedCache[edge.j];
        if (!p1 || !p2) return; // ข้ามการวาดหากเกิดข้อผิดพลาดด้านอาเรย์พิกัด

        const depth = (p1.sz + p2.sz) / 2;
        const zAlpha = Math.max(0.05, Math.min(0.85, 0.45 + (depth / 45)));

        ctx.lineWidth = 0.2 + edge.weight * 1.6;
        ctx.strokeStyle = edge.type === 'callosum'
            ? `rgba(255, 230, 0, ${zAlpha * 0.25})`
            : `rgba(${colorRGB}, ${zAlpha * edge.weight * 0.42})`;

        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.stroke();
    });

    const fireProb = 0.15 + (chem.glutamate * 0.5) - (chem.gaba * 0.35);
    if (impulses.length < maxImpulses && edges.length > 0 && Math.random() < Math.max(0.02, fireProb)) {
        const randomEdge = edges[Math.floor(Math.random() * edges.length)];
        impulses.push({
            edge: randomEdge,
            progress: 0,
            speed: 0.015 + Math.random() * 0.025,
            isCascade: false
        });
    }

    totalBOLDActivity = 0.0;

    // [แก้ไขเสร็จสมบูรณ์] เปลี่ยนมาใช้ลูปย้อนกลับ (Backward loop) ป้องกันบัคลำดับข้ามอนิเมชันเมื่อมีการย่ออาร์เรย์
    for (let i = impulses.length - 1; i >= 0; i--) {
        const imp = impulses[i];
        const p1 = projectedCache[imp.edge.i];
        const p2 = projectedCache[imp.edge.j];
        
        if (!p1 || !p2) continue;

        imp.progress += imp.speed * (1.0 + chem.glutamate * 1.5);

        if (imp.progress >= 1) {
            imp.edge.weight = Math.min(1.0, imp.edge.weight + 0.1 * chem.glutamate);
            if (vertices[imp.edge.j]) {
                vertices[imp.edge.j].bold = Math.min(1.0, vertices[imp.edge.j].bold + 0.2);
            }
            impulses.splice(i, 1);
            continue;
        }

        const currX = p1.sx + (p2.sx - p1.sx) * imp.progress;
        const currY = p1.sy + (p2.sy - p1.sy) * imp.progress;
        const currZ = p1.sz + (p2.sz - p1.sz) * imp.progress;
        const depthFactor = Math.max(0.1, Math.min(1.0, 0.5 + (currZ / 50)));

        ctx.fillStyle = imp.isCascade ? `rgba(255, 230, 0, ${depthFactor})` : `rgba(255, 255, 255, ${depthFactor})`;
        ctx.beginPath();
        ctx.arc(currX, currY, imp.isCascade ? 2.5 : 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // สแกนหาโหนดที่มีกระแส BOLD สูงสุดเพื่อล็อกเป้าวิเคราะห์เรดาร์
    let maxBoldIdx = -1;
    let maxBoldVal = -1;

    projectedCache.forEach((p, idx) => {
        const depthFactor = Math.max(0.1, Math.min(1.0, 0.5 + (p.sz / 45)));
        totalBOLDActivity += p.vRef.bold;

        // จัดอันดับโหนดประจุไฟฟ้าสูงสุด
        if (p.vRef.bold > maxBoldVal) {
            maxBoldVal = p.vRef.bold;
            maxBoldIdx = idx;
        }

        const isIntersected = Math.abs(p.vRef.y - scanPlaneY) < 1.35;
        if (isIntersected) {
            p.vRef.bold = Math.min(1.0, p.vRef.bold + 0.08); 
            
            ctx.strokeStyle = `rgba(255, 255, 255, 0.52)`;
            ctx.lineWidth = 0.65;
            ctx.beginPath();
            ctx.arc(p.sx, p.sy, 6.5, 0, Math.PI * 2);
            ctx.stroke();

            ctx.font = 'bold 5px monospace';
            ctx.fillStyle = `rgba(255, 255, 255, 0.72)`;
            ctx.fillText(`พิกัด_${idx}`, p.sx + 8, p.sy - 3);

            // ลากเส้นโยงตัดพิกัดระบุตำแหน่ง (Tracking Crosshair Guides)
            ctx.strokeStyle = `rgba(${colorRGB}, 0.25)`;
            ctx.lineWidth = 0.4;
            ctx.beginPath();
            ctx.moveTo(p.sx, p.sy);
            ctx.lineTo(centerX + 110, p.sy);
            ctx.stroke();
        }

        // เอฟเฟกต์ประจุส่องสว่างสีส้ม
        if (p.vRef.bold > 0.1) {
            ctx.shadowColor = "rgba(249, 115, 22, " + (p.vRef.bold * 0.7) + ")";
            ctx.shadowBlur = p.vRef.bold * 14;
            ctx.fillStyle = `rgba(249, 115, 22, ${p.vRef.bold.toFixed(2)})`;
            ctx.beginPath();
            ctx.arc(p.sx, p.sy, 1.3 + p.vRef.bold * 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0; 

            // [ระบบใหม่] สัญญาณรบกวนคลื่นสมอง (Glitch Spikes) ปรากฏขึ้นเมื่อมีความตื่นตัวสูง
            if (p.vRef.bold > 0.45 && Math.random() < 0.25) {
                ctx.strokeStyle = `rgba(239, 68, 68, ${p.vRef.bold * 0.65})`;
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(p.sx, p.sy);
                const glitchOffset = (Math.random() - 0.5) * 40 * p.vRef.bold;
                ctx.lineTo(p.sx + glitchOffset, p.sy);
                ctx.stroke();

                if (p.vRef.bold > 0.75 && Math.random() < 0.06) {
                    ctx.font = '5px monospace';
                    ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
                    ctx.fillText(`คลื่นแทรกผิดปกติ_${idx}`, p.sx + glitchOffset + 2, p.sy + 2);
                }
            }
        }

        // [ระบบใหม่] สัญญาณอักขระฐาน 16 (HEX Rain) ลอยขึ้นบริเวณแกนสมอง (Brainstem)
        if (p.vRef.lobe === 'brainstem' && Math.random() < 0.06) {
            ctx.fillStyle = `rgba(${colorRGB}, 0.35)`;
            ctx.font = '4.5px monospace';
            const hexChar = "0123456789ABCDEF"[Math.floor(Math.random()*16)] + "x";
            ctx.fillText(hexChar, p.sx - 10, p.sy);
        }

        const pulse = 0.35 + Math.sin(Date.now() * 0.003 + idx) * 0.2;
        ctx.fillStyle = `rgba(${colorRGB}, ${(pulse * depthFactor).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, 1.2, 0, Math.PI * 2);
        ctx.fill();
    });

    // วาดล็อกเป้าวิเคราะห์พิกัดแบบเล็งจุด (Target Lock-on HUD)
    if (maxBoldIdx !== -1 && maxBoldVal > 0.35) {
        const targetNode = projectedCache[maxBoldIdx];
        if (targetNode) {
            drawTargetLock(targetNode.sx, targetNode.sy, maxBoldIdx, colorHex, maxBoldVal, colorRGB);
        }
    }

    ctx.strokeStyle = `rgba(${colorRGB}, 0.095)`;
    ctx.lineWidth = 0.52;
    for (let i = 0; i < 4; i++) {
        const targetIndex = Math.floor(Math.abs(Math.sin(Date.now() * 0.00075 + i * 200)) * (vertices.length - 1));
        const targetNode = projectedCache[targetIndex];
        if (targetNode) {
            ctx.beginPath();
            ctx.moveTo(centerX + (i - 1.5) * 12, canvas.height - 15);
            ctx.lineTo(targetNode.sx, targetNode.sy);
            ctx.stroke();
        }
    }

    ctx.globalCompositeOperation = 'source-over'; 

    for (let lobe in lobeCenters) {
        const c = lobeCenters[lobe];
        const x1 = c.x * Math.cos(angleY) - c.z * Math.sin(angleY);
        const z1 = c.x * Math.sin(angleY) + c.z * Math.cos(angleY);
        const y2 = c.y * Math.cos(angleX) - z1 * Math.sin(angleX);
        const z2 = c.y * Math.sin(angleX) + z1 * Math.cos(angleX);
        const fovScale = scale / (distance + z2);
        const labelX = centerX + x1 * fovScale;
        const labelY = centerY - y2 * fovScale;

        if (z2 > -25) { 
            ctx.font = 'bold 7px monospace';
            ctx.fillStyle = `rgba(${colorRGB}, 0.32)`;
            ctx.fillText(`// เปลือกสมองส่วน_${lobe.toUpperCase()}`, labelX + 8, labelY);
            
            ctx.strokeStyle = `rgba(${colorRGB}, 0.12)`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(labelX, labelY);
            ctx.lineTo(labelX + 6, labelY);
            ctx.stroke();
        }
    }

    const temporalNodes = vertices.filter(v => v.lobe === 'temporal');
    const avgTemporalBOLD = temporalNodes.reduce((acc, curr) => acc + curr.bold, 0) / (temporalNodes.length || 1);
    const temporalEdges = edges.filter(e => vertices[e.i].lobe === 'temporal' || vertices[e.j].lobe === 'temporal');
    const avgTemporalWeight = temporalEdges.reduce((acc, curr) => acc + curr.weight, 0) / (temporalEdges.length || 1);
    const totalWeight = edges.reduce((acc, curr) => acc + curr.weight, 0);
    const avgWeight = totalWeight / (edges.length || 1);
    const impulseCount = impulses.length;
    const shannonEntropy = -1 * (impulseCount / maxImpulses) * Math.log2((impulseCount + 1) / (maxImpulses + 2));
    
    const hMetric = document.getElementById("hud-entropy-metric");
    if (hMetric) hMetric.innerText = `${shannonEntropy.toFixed(3)} บิต`;

    const bPercent = (totalBOLDActivity / vertices.length) * 100;
    const boldMetric = document.getElementById("hud-bold-activity");
    if (boldMetric) boldMetric.innerText = `${bPercent.toFixed(1)}%`;

    const fMetric = document.getElementById("hud-firing-metric");
    if (fMetric) {
        const firingRate = Math.round(impulseCount * (1.2 + chem.adrenaline * 4.0 + chem.glutamate * 2.0));
        fMetric.innerText = `${firingRate} เฮิรตซ์`;
    }

    updateNetworkTopology(avgWeight);
    drawEEGBands(colorHex, chem, frustration);
    drawSpectrum(colorHex, chem.adrenaline, chem.glutamate);
    renderSecondWindowData(chem, avgTemporalBOLD, avgTemporalWeight);

    // คำนวณความล่าช้าจำลองและวิเคราะห์ความเสถียร
    const pingMetric = document.getElementById("hud-ping-metric");
    if (pingMetric && typeof lastPingLatency !== 'undefined') {
        pingMetric.innerText = lastPingLatency;
        pingMetric.style.color = lastPingLatency.includes("OFFLINE") ? "#ef4444" : "#22c55e";
    }

    let now = performance.now();
    while (times.length > 0 && times[0] <= now - 1000) {
        times.shift();
    }
    times.push(now);
    fps = times.length;
    const fpsMetric = document.getElementById("hud-fps-metric");
    if (fpsMetric) fpsMetric.innerText = fps + " เฟรมต่อวินาที";

    ctx.restore(); 
    animationId = requestAnimationFrame(renderHUD);
}

// ------------------------------------------------------------
//  [ระบบใหม่] ระบบควบคุมการลากและวางองค์ประกอบอิสระ (Draggable Engine)
// ------------------------------------------------------------
function enableDraggableWidget(elementId) {
    const elmnt = document.getElementById(elementId);
    if (!elmnt) return;

    // ตรวจสอบและตั้งค่า CSS position ให้อยู่ในรูปแบบที่ขยับตำแหน่งได้โดยอัตโนมัติ
    const style = window.getComputedStyle(elmnt);
    if (style.position !== 'absolute' && style.position !== 'fixed') {
        elmnt.style.position = 'absolute';
    }
    elmnt.style.userSelect = 'none'; // ป้องกันการคลุมดำคลุมข้อความขณะลาก

    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    let originalTransition = ""; // ตัวแปรเก็บค่าแอนิเมชันความหน่วงเดิม

    elmnt.addEventListener('mousedown', dragMouseDown);
    elmnt.addEventListener('touchstart', dragTouchStart, { passive: false });

    function dragMouseDown(e) {
        // หากคลิกปุ่มหรือลิ้งก์ใด ๆ ภายในแผงควบคุม จะทำงานคลิกตามปกติ ไม่ลากย้าย
        if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.tagName === 'A') {
            return;
        }
        
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        
        // ปิด transition ชั่วคราวเพื่อให้ตำแหน่งการลากเคลื่อนไหวตามเมาส์ทันที ไม่กระตุกหรือหน่วงช้า
        originalTransition = elmnt.style.transition;
        elmnt.style.transition = 'none';

        document.addEventListener('mouseup', closeDragElement);
        document.addEventListener('mousemove', elementDrag);
    }

    function dragTouchStart(e) {
        if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.tagName === 'A') {
            return;
        }

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
        // คืนค่าแอนิเมชันความหน่วงเดิมกลับคืนเมื่อผู้ใช้งานปล่อยเมาส์
        elmnt.style.transition = originalTransition;

        document.removeEventListener('mouseup', closeDragElement);
        document.removeEventListener('mousemove', elementDrag);
        document.removeEventListener('touchend', closeDragElement);
        document.removeEventListener('touchmove', elementTouchDrag);
    }
}

// ------------------------------------------------------------
//  ระบบเปิดปิดแผงสวิตช์วิเคราะห์ข้อมูลกลาง (Central APIs)
// ------------------------------------------------------------
window.ChodBrainMonitor = {
    show: function() {
        if (window.ChodBodyMonitor && typeof window.ChodBodyMonitor.hide === "function") {
            window.ChodBodyMonitor.hide();
        }

        const el = document.getElementById("chod-brain-monitor-widget");
        if (el) {
            el.classList.add("active");
            
            // ยืนยันการผูกระบบลากวางอีกครั้งเพื่อป้องกันกรณีหน้าต่างถูกตัดหรือโหลดใน DOM ล่าช้า
            enableDraggableWidget("chod-brain-monitor-widget");

            if (!animationId) {
                renderHUD();
            }

            if (!recognition && typeof initVoiceControl === 'function') {
                initVoiceControl();
            }
        }
    },
    hide: function() {
        const el = document.getElementById("chod-brain-monitor-widget");
        if (el) {
            el.classList.remove("active");
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
            if (secondWindow && !secondWindow.closed) {
                secondWindow.close();
                secondWindow = null;
            }
            if (typeof recognition !== 'undefined' && recognition && isListening) {
                isListening = false;
                try { recognition.stop(); } catch(e) {}
                if (typeof injectLog === 'function') injectLog("ระบบควบคุมด้วยเสียง: ระงับการทำงานชั่วคราว");
            }
        }
    },
    toggle: function() {
        const el = document.getElementById("chod-brain-monitor-widget");
        if (el) {
            if (el.classList.contains("active")) this.hide();
            else this.show();
        }
    }
};

// ------------------------------------------------------------
//  ระบบตรวจจับแป้นพิมพ์ควบคุม (กดเลข "5" เพื่อเปิด/ปิดส่วนแสดงผล)
// ------------------------------------------------------------
document.addEventListener("keydown", function(event) {
    if (event.key === "5") {
        if (window.ChodBrainMonitor) {
            window.ChodBrainMonitor.toggle();
        }
    }
});

// ------------------------------------------------------------
//  ส่วนเริ่มการทำงานของหน้าแผงควบคุมระบบ (เมื่อโหลดหน้าจอสำเร็จ)
// ------------------------------------------------------------
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        initCommandDeck();
        
        // ผูกฟังก์ชันการลากวางให้กับตัว Widget หน้าต่างสมองหลัก
        enableDraggableWidget("chod-brain-monitor-widget");
        
        // สั่งซ่อนการแสดงผลตั้งแต่แรกเริ่มต้นระบบ รอการเปิดใช้งานด้วยปุ่มกดเลข 5
        if (window.ChodBrainMonitor) {
            window.ChodBrainMonitor.hide();
        }
    });
} else {
    initCommandDeck();
    
    // ผูกฟังก์ชันการลากวางให้กับตัว Widget หน้าต่างสมองหลัก
    enableDraggableWidget("chod-brain-monitor-widget");
    
    if (window.ChodBrainMonitor) {
        window.ChodBrainMonitor.hide();
    }
}