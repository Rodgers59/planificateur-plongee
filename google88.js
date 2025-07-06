// google88.js
console.log("google88.js chargé avec succès.");

// Variables globales et constantes
let diveTableData = null;
let currentDiveInfo = {};
const fileInput = document.getElementById('data-file');
const calculateBtn = document.getElementById('calculate-btn');
const tooltip = document.getElementById('tooltip');
const svgElement = document.getElementById('dive-graph-svg');
const showMainCurveCheckbox = document.getElementById('show-main-curve');
const showSecurityCurveCheckbox = document.getElementById('show-security-curve');
const showIncidentCurveCheckbox = document.getElementById('show-incident-curve');
const savePlanBtn = document.getElementById('save-plan-btn');
const savedPlansContainer = document.getElementById('saved-plans-container');
const STORAGE_KEY = 'divePlanner_savedPlans';
const modalOverlay = document.getElementById('modal-overlay');
const modalText = document.getElementById('modal-text');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const tanks = {
    main: { wrapper: document.getElementById('main-tank-wrapper'), airLevel: document.getElementById('main-air-level'), pressureText: document.getElementById('main-pressure-text'), bgText: document.getElementById('main-pressure-text-bg'), clipRect: document.getElementById('main-text-clip-rect') },
    security: { wrapper: document.getElementById('security-tank-wrapper'), airLevel: document.getElementById('security-air-level'), pressureText: document.getElementById('security-pressure-text'), bgText: document.getElementById('security-pressure-text-bg'), clipRect: document.getElementById('security-text-clip-rect') },
    incident: { wrapper: document.getElementById('incident-tank-wrapper'), airLevel: document.getElementById('incident-air-level'), pressureText: document.getElementById('incident-pressure-text'), bgText: document.getElementById('incident-pressure-text-bg'), clipRect: document.getElementById('incident-text-clip-rect') }
};
const TANK_MAX_HEIGHT = 180;
const TANK_INITIAL_Y = 20;
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const VIEWBOX = { width: 800, height: 600 };
const MARGIN = { top: 40, right: 40, bottom: 50, left: 60 };
const GRAPH_WIDTH = VIEWBOX.width - MARGIN.left - MARGIN.right;
const GRAPH_HEIGHT = VIEWBOX.height - MARGIN.top - MARGIN.bottom;

// --- GESTION DU FICHIER ET DES DONNÉES ---
fileInput.addEventListener('change', (event) => {
    // ... (code de lecture du fichier inchangé)
    const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (e) => { const data = e.target.result; const workbook = XLSX.read(data, { type: 'binary' }); const sheetName = workbook.SheetNames[0]; const worksheet = workbook.Sheets[sheetName]; const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); processRawData(rawData); }; reader.readAsBinaryString(file);
});

function processRawData(rawData) {
    // ... (code de traitement des données inchangé)
    let deHeadersRow = null; const dataRows = []; rawData.forEach(row => { if (!Array.isArray(row) || row.length < 2) return; const firstCell = row[0]; if ((firstCell === null || firstCell === undefined || typeof firstCell === 'string' && firstCell.trim() === "") && !isNaN(parseInt(row[1]))) { deHeadersRow = row; } else if (!isNaN(parseInt(firstCell))) { dataRows.push(row); } }); if (!deHeadersRow || dataRows.length === 0) { console.error("Format de fichier non valide."); diveTableData = null; return; } const deHeaders = deHeadersRow.slice(1).map(de => parseInt(de)).filter(de => !isNaN(de)); const structuredData = { depths: [], des: deHeaders, table: {} }; dataRows.forEach(row => { const depth = parseInt(row[0]); structuredData.depths.push(depth); structuredData.table[depth] = {}; row.slice(1).forEach((dtr, index) => { const de = structuredData.des[index]; if (de !== undefined) { const dtrValue = dtr !== "" && dtr !== null ? parseInt(dtr) : null; if (dtrValue !== null && !isNaN(dtrValue)) { structuredData.table[depth][de] = dtrValue; } } }); }); diveTableData = structuredData; console.log("Données de plongée traitées et stockées:", diveTableData);
}

// --- LOGIQUE DE CALCUL DE PLONGÉE ---
function performDiveCalculation(planData = null) {
    // ... (code de calcul inchangé)
    resetAllTanks(); if (!diveTableData) { alert("Veuillez d'abord charger un fichier de table de plongée."); return; } const profondeurSaisie = planData ? planData.profondeur : parseInt(document.getElementById('profondeur').value); const dtrSaisie = planData ? planData.dtr : parseInt(document.getElementById('dtr').value); const bloc = planData ? planData.bloc : document.getElementById('bloc').value; const reserve = planData ? planData.reserve : document.getElementById('reserve').value; const incidentTime = planData ? planData.panneAir : document.getElementById('panne-air').value; if (planData) { document.getElementById('profondeur').value = profondeurSaisie; document.getElementById('dtr').value = dtrSaisie; document.getElementById('bloc').value = bloc; document.getElementById('reserve').value = reserve; document.getElementById('panne-air').value = incidentTime; } if (isNaN(profondeurSaisie) || isNaN(dtrSaisie) || isNaN(parseInt(bloc)) || isNaN(parseInt(reserve))) { alert("Veuillez remplir tous les champs."); return; } if (dtrSaisie === 0) { alert("Pour une plongée sans palier (DTR=0), la procédure est une remontée à vitesse contrôlée avec un palier de sécurité de 3 minutes à 5 mètres. Aucun profil n'est généré pour ce cas."); currentDiveInfo = {}; drawAllGraphs(); return; } let profondeurFinale; const isExactDepth = diveTableData.depths.includes(profondeurSaisie); if (isExactDepth) { profondeurFinale = profondeurSaisie; } else { const { lower, upper } = findNeighboringDepths(profondeurSaisie); if (lower === null && upper === null) { alert(`La profondeur de ${profondeurSaisie}m est en dehors des limites de la table.`); return; } if (lower !== null && upper !== null) { if (!confirm(`Profondeur de ${profondeurSaisie}m non trouvée.\n\nOK pour utiliser ${upper}m (supérieure),\nou ANNULER pour utiliser ${lower}m (inférieure) ?`)) { profondeurFinale = lower; } else { profondeurFinale = upper; } } else if (upper !== null) { if (!confirm(`Profondeur non disponible. Utiliser ${upper}m ?`)) return; profondeurFinale = upper; } else { if (!confirm(`Profondeur non disponible. Utiliser ${lower}m ?`)) return; profondeurFinale = lower; } } document.getElementById('profondeur').value = profondeurFinale; let dtrFinale; const allDtrsForDepth = Object.values(diveTableData.table[profondeurFinale]); const isExactDtr = allDtrsForDepth.includes(dtrSaisie); if (isExactDtr) { dtrFinale = dtrSaisie; } else { const { lower, upper } = findNeighboringDtrs(profondeurFinale, dtrSaisie); if (lower === null && upper === null) { alert(`Aucune DTR disponible pour la profondeur de ${profondeurFinale}m. Vérifiez la table.`); return; } if (lower !== null && upper !== null) { if (!confirm(`DTR de ${dtrSaisie}min non trouvée pour ${profondeurFinale}m.\n\nOK pour utiliser ${upper}min (supérieure),\nou ANNULER pour utiliser ${lower}min (inférieure) ?`)) { dtrFinale = lower; } else { dtrFinale = upper; } } else if (upper !== null) { if (!confirm(`DTR de ${dtrSaisie}min non trouvée. Utiliser ${upper}min ?`)) return; dtrFinale = upper; } else { if (!confirm(`DTR de ${dtrSaisie}min non trouvée. Utiliser ${lower}min ?`)) return; dtrFinale = lower; } } document.getElementById('dtr').value = dtrFinale; const mainDiveResult = findDpFromDtr(profondeurFinale, dtrFinale); const { dtrFinale: validatedDtr, dpFinale: validatedDp } = mainDiveResult; currentDiveInfo.main = { plan: createPlan(profondeurFinale, validatedDp, validatedDtr), bloc: parseInt(bloc), dtrChoisie: dtrSaisie }; currentDiveInfo.security = findOptimizedPlan(profondeurFinale, parseInt(reserve), parseInt(bloc)); const finalIncidentTime = parseFloat(incidentTime); if (!isNaN(finalIncidentTime)) { if (currentDiveInfo.main) { const mainTotalTime = currentDiveInfo.main.plan.dpFinale + currentDiveInfo.main.plan.dtrFinale; if (finalIncidentTime <= mainTotalTime) { if (finalIncidentTime <= currentDiveInfo.main.plan.dpFinale) { currentDiveInfo.incident = createIncidentPlan(currentDiveInfo.main, finalIncidentTime); } else { currentDiveInfo.incident = { plan: { ...currentDiveInfo.main.plan }, bloc: parseInt(bloc), isIncident: true, incidentTime: finalIncidentTime }; } tanks.incident.wrapper.classList.remove('hidden'); } else { alert(`Le temps de l'incident (${finalIncidentTime} min) ne peut pas dépasser la durée totale de la plongée choisie (${mainTotalTime.toFixed(1)} min).`); currentDiveInfo.incident = null; tanks.incident.wrapper.classList.add('hidden'); } } } else { currentDiveInfo.incident = null; tanks.incident.wrapper.classList.add('hidden'); } drawAllGraphs();
    console.log("--- Débogage avant calcul des limites ---");
    console.log("Valeur de 'profondeurFinale':", profondeurFinale);
    console.log("Valeur de 'bloc':", bloc);
    console.log("Valeur de 'reserve':", reserve);

    const limits = calculateConsumptionLimits(profondeurFinale, parseInt(bloc), parseInt(reserve));
    currentDiveInfo.limits = limits; // On stocke pour l'impression
    displayConsumptionWarnings(limits, parseInt(reserve));

    console.log("--- Fin du débogage ---");
    // === BLOC À AJOUTER À LA FIN DE LA FONCTION ===
    const warningContainer = document.getElementById('consumption-warning-container');
    if (profondeurFinale && bloc) {
        const limits = calculateConsumptionLimits(profondeurFinale, parseInt(bloc), parseInt(reserve));
        currentDiveInfo.limits = limits; // On stocke pour l'impression
        displayConsumptionWarnings(limits, parseInt(reserve));
    } else {
        warningContainer.classList.add('hidden');
    }
    // ===========================================

}

calculateBtn.addEventListener('click', () => performDiveCalculation());
showMainCurveCheckbox.addEventListener('change', drawAllGraphs);
showSecurityCurveCheckbox.addEventListener('change', drawAllGraphs);
showIncidentCurveCheckbox.addEventListener('change', drawAllGraphs);

function findNeighboringDepths(targetDepth) { /* ... (inchangé) ... */ if (!diveTableData || diveTableData.depths.length === 0) return { lower: null, upper: null }; const sortedDepths = [...diveTableData.depths].sort((a, b) => a - b); let lower = null; let upper = null; upper = sortedDepths.find(d => d >= targetDepth) || null; const reversedDepths = [...sortedDepths].reverse(); lower = reversedDepths.find(d => d <= targetDepth) || null; if (lower === targetDepth) lower = null; if (upper === targetDepth) upper = null; if (lower === targetDepth) { const lowerIndex = diveTableData.depths.indexOf(lower); if (lowerIndex > 0) { lower = diveTableData.depths[lowerIndex - 1]; } else { lower = null; } } return { lower, upper }; }
function findNeighboringDtrs(depth, targetDtr) { /* ... (inchangé) ... */ if (!diveTableData.table[depth]) return { lower: null, upper: null }; const allDtrs = Object.values(diveTableData.table[depth]); const uniqueSortedDtrs = [...new Set(allDtrs)].sort((a, b) => a - b); let lower = null; let upper = null; upper = uniqueSortedDtrs.find(dtr => dtr >= targetDtr) || null; const reversedDtrs = [...uniqueSortedDtrs].reverse(); lower = reversedDtrs.find(dtr => dtr <= targetDtr) || null; if (lower === targetDtr) lower = null; if (upper === targetDtr) upper = null; return { lower, upper }; }
function findDpFromDtr(finalDepth, targetDtr) { /* ... (inchangé) ... */ const depthRow = diveTableData.table[finalDepth]; const matchingDes = []; for (const de in depthRow) { if (depthRow[de] === targetDtr) { matchingDes.push(parseInt(de)); } } const finalDe = Math.min(...matchingDes); const dt = finalDepth / 20; const finalDp = dt + finalDe; return { dtrFinale: targetDtr, dpFinale: finalDp, error: null }; }
function createPlan(profondeur, dp, dtr) { /* ... (inchangé) ... */ const dt = profondeur / 20; const de = dp - dt; const drp = (profondeur - 5) / 10; const dts = 1; const dp5 = Math.max(0, dtr - drp - dts); return { profondeurFinale: profondeur, dpFinale: dp, dtrFinale: dtr, dt, de, drp, dp5, dts }; }
function findOptimizedPlan(profondeur, reserve, bloc) { /* ... (inchangé) ... */ if (!diveTableData || !diveTableData.table[profondeur]) { return null; } const coeffBeta = (bloc === 12) ? 4 : 3; const desInTable = Object.keys(diveTableData.table[profondeur]).map(Number).sort((a, b) => b - a); let bestValidPlan = null; let highestPressure = 0; for (const de of desInTable) { const dtr = diveTableData.table[profondeur][de]; if (dtr === undefined || dtr === 0) continue; const dt = profondeur / 20; const dp = dt + de; const pressionRemontee = dtr * coeffBeta; const pressionSecuriteFinale = Math.max(reserve, pressionRemontee); const pressionDecollage = pressionRemontee + pressionSecuriteFinale; const pMoyDescente = 1 + (profondeur / 2 / 10); const consoDescenteBar = (20 * pMoyDescente * dt) / bloc; const pFond = 1 + (profondeur / 10); const consoFondBar = (20 * pFond * de) / bloc; const consoAvantRemontee = consoDescenteBar + consoFondBar; const pressionRestanteAuDecollage = 200 - consoAvantRemontee; if (pressionRestanteAuDecollage >= pressionDecollage) { if (pressionDecollage > highestPressure) { highestPressure = pressionDecollage; bestValidPlan = { plan: createPlan(profondeur, dp, dtr), bloc: bloc, dtrChoisie: dtr, pressionDecollage: pressionDecollage }; } } } return bestValidPlan; }
function findFinalDepth(targetDepth) { /* ... (inchangé) ... */ if (!diveTableData || diveTableData.depths.length === 0) return null; const sortedDepths = [...diveTableData.depths].sort((a, b) => a - b); if (targetDepth > sortedDepths[sortedDepths.length - 1]) { return null; } return sortedDepths.find(d => d >= targetDepth); }
function createIncidentPlan(mainDiveInfo, incidentTime) { /* ... (inchangé) ... */ const { bloc, dtrChoisie } = mainDiveInfo; const depthAtIncident = getDepthAtTime(incidentTime, mainDiveInfo.plan); const profondeurTable = findFinalDepth(depthAtIncident); if (profondeurTable === null) { return { plan: createPlan(0, 0, 0), bloc: bloc, isIncident: true, incidentTime: incidentTime, dtrChoisie: dtrChoisie }; } const dpIncident = incidentTime; const deEquivalentIncident = dpIncident - (depthAtIncident / 20); const desInTable = Object.keys(diveTableData.table[profondeurTable] || {}).map(Number); let deForDtrLookup = 0; for (const de_table of desInTable) { if (de_table <= deEquivalentIncident && de_table > deForDtrLookup) { deForDtrLookup = de_table; } } let dtrIncidentTable = deForDtrLookup > 0 ? diveTableData.table[profondeurTable][deForDtrLookup] : 0; let incidentPlan = createPlan(depthAtIncident, dpIncident, dtrIncidentTable); if (!dtrIncidentTable || dtrIncidentTable === 0) { incidentPlan.dp5 = 3; incidentPlan.dtrFinale = incidentPlan.drp + incidentPlan.dp5 + incidentPlan.dts; } return { plan: incidentPlan, bloc: bloc, isIncident: true, incidentTime: incidentTime, dtrChoisie: dtrChoisie }; }

// --- GESTION DU GRAPHIQUE SVG ---
function clearSVG() { /* ... (inchangé) ... */ while (svgElement.childNodes.length > 1) { if (svgElement.lastChild.nodeName.toLowerCase() !== 'defs') { svgElement.removeChild(svgElement.lastChild); } else { break; } } }
function drawGridAndAxes(maxDepth, maxTime) { /* ... (inchangé) ... */ const g = document.createElementNS(SVG_NAMESPACE, 'g'); const scaleX = time => MARGIN.left + (time / maxTime) * GRAPH_WIDTH; const scaleY = depth => MARGIN.top + (depth / maxDepth) * GRAPH_HEIGHT; const bgRect = document.createElementNS(SVG_NAMESPACE, 'rect'); bgRect.setAttribute('x', MARGIN.left); bgRect.setAttribute('y', MARGIN.top); bgRect.setAttribute('width', GRAPH_WIDTH); bgRect.setAttribute('height', GRAPH_HEIGHT); bgRect.setAttribute('class', 'water-background'); g.appendChild(bgRect); const backgroundImage = document.createElementNS(SVG_NAMESPACE, 'image'); backgroundImage.setAttribute('href', 'fond-raie-manta.jpg'); backgroundImage.setAttribute('x', MARGIN.left); backgroundImage.setAttribute('y', MARGIN.top); backgroundImage.setAttribute('width', GRAPH_WIDTH); backgroundImage.setAttribute('height', GRAPH_HEIGHT); backgroundImage.setAttribute('preserveAspectRatio', 'none'); backgroundImage.setAttribute('opacity', '0.3'); g.appendChild(backgroundImage); for (let d = 0; d <= maxDepth; d += 10) { const y = scaleY(d); const gridLine = document.createElementNS(SVG_NAMESPACE, 'line'); gridLine.setAttribute('x1', MARGIN.left); gridLine.setAttribute('y1', y); gridLine.setAttribute('x2', MARGIN.left + GRAPH_WIDTH); gridLine.setAttribute('y2', y); gridLine.setAttribute('class', 'grid-line'); g.appendChild(gridLine); } for (let t = 0; t <= maxTime; t++) { if (t % 5 === 0) { const x = scaleX(t); const gridLine = document.createElementNS(SVG_NAMESPACE, 'line'); gridLine.setAttribute('x1', x); gridLine.setAttribute('y1', MARGIN.top); gridLine.setAttribute('x2', x); gridLine.setAttribute('y2', MARGIN.top + GRAPH_HEIGHT); gridLine.setAttribute('class', 'grid-line'); g.appendChild(gridLine); } } const surfaceRect = document.createElementNS(SVG_NAMESPACE, 'rect'); surfaceRect.setAttribute('x', MARGIN.left); surfaceRect.setAttribute('y', MARGIN.top); surfaceRect.setAttribute('width', GRAPH_WIDTH); surfaceRect.setAttribute('height', '3'); surfaceRect.setAttribute('class', 'water-surface'); g.appendChild(surfaceRect); for (let d = 0; d <= maxDepth; d += 10) { const y = scaleY(d); const text = document.createElementNS(SVG_NAMESPACE, 'text'); text.setAttribute('x', MARGIN.left - 10); text.setAttribute('y', y + 5); text.setAttribute('class', 'axis-text'); text.style.textAnchor = 'end'; text.textContent = d; g.appendChild(text); } for (let t = 0; t <= maxTime; t++) { const x = scaleX(t); const isMajorTick = t % 5 === 0; const tick = document.createElementNS(SVG_NAMESPACE, 'line'); tick.setAttribute('x1', x); tick.setAttribute('y1', MARGIN.top + GRAPH_HEIGHT); tick.setAttribute('x2', x); tick.setAttribute('y2', MARGIN.top + GRAPH_HEIGHT + (isMajorTick ? 8 : 4)); tick.setAttribute('class', 'axis-tick'); g.appendChild(tick); if (isMajorTick) { const text = document.createElementNS(SVG_NAMESPACE, 'text'); text.setAttribute('x', x); text.setAttribute('y', MARGIN.top + GRAPH_HEIGHT + 25); text.setAttribute('class', 'axis-text'); text.style.textAnchor = 'middle'; text.textContent = t; g.appendChild(text); } } const boundary = document.createElementNS(SVG_NAMESPACE, 'rect'); boundary.setAttribute('x', MARGIN.left); boundary.setAttribute('y', MARGIN.top); boundary.setAttribute('width', GRAPH_WIDTH); boundary.setAttribute('height', GRAPH_HEIGHT); boundary.setAttribute('class', 'axis-boundary'); g.appendChild(boundary); return g; }
function drawAllGraphs() { /* ... (inchangé) ... */ clearSVG(); tooltip.classList.add('hidden'); const showMain = showMainCurveCheckbox.checked && currentDiveInfo.main; const showSecurity = showSecurityCurveCheckbox.checked && currentDiveInfo.security; const showIncident = showIncidentCurveCheckbox.checked && currentDiveInfo.incident; let maxDepth = 0; let maxTime = 0; if (showMain) { maxDepth = Math.max(maxDepth, currentDiveInfo.main.plan.profondeurFinale); maxTime = Math.max(maxTime, currentDiveInfo.main.plan.dpFinale + currentDiveInfo.main.plan.dtrFinale); } if (showSecurity) { maxDepth = Math.max(maxDepth, currentDiveInfo.security.plan.profondeurFinale); maxTime = Math.max(maxTime, currentDiveInfo.security.plan.dpFinale + currentDiveInfo.security.plan.dtrFinale); } if (showIncident) { maxDepth = Math.max(maxDepth, currentDiveInfo.incident.plan.profondeurFinale); maxTime = Math.max(maxTime, currentDiveInfo.incident.plan.dpFinale + currentDiveInfo.incident.plan.dtrFinale); } const finalMaxDepth = (showMain || showSecurity || showIncident) ? Math.ceil((maxDepth + 10) / 10) * 10 : 60; const finalMaxTime = (showMain || showSecurity || showIncident) ? Math.ceil(maxTime / 5) * 5 : 60; const g = drawGridAndAxes(finalMaxDepth, finalMaxTime); svgElement.appendChild(g); if (showMain || showSecurity || showIncident) { const curvesToDraw = []; if (showSecurity) curvesToDraw.push({ info: currentDiveInfo.security, title: "Courbe Sécurité", className: "security-curve" }); if (showMain) curvesToDraw.push({ info: currentDiveInfo.main, title: "DTR Choisie", className: "main-curve" }); if (showIncident) curvesToDraw.push({ info: currentDiveInfo.incident, title: "Panne d'air", className: "incident-curve" }); curvesToDraw.sort((a, b) => (b.info.plan.dpFinale + b.info.plan.dtrFinale) - (a.info.plan.dpFinale + a.info.plan.dtrFinale)); curvesToDraw.forEach(curve => { drawCurve(curve.info, curve.title, curve.className, finalMaxDepth, finalMaxTime, g); }); if (showIncident && currentDiveInfo.incident) { const { plan, incidentTime } = currentDiveInfo.incident; const depthAtIncident = getDepthAtTime(incidentTime, plan); const scaleX = time => MARGIN.left + (time / finalMaxTime) * GRAPH_WIDTH; const scaleY = depth => MARGIN.top + (depth / finalMaxDepth) * GRAPH_HEIGHT; const markerX = scaleX(incidentTime); const markerY = scaleY(depthAtIncident); const textContent = `Panne d'air à ${incidentTime.toFixed(1)} min`; const markerGroup = document.createElementNS(SVG_NAMESPACE, 'g'); markerGroup.setAttribute('transform', `translate(${markerX}, ${markerY})`); markerGroup.style.pointerEvents = 'none'; const FONT_SIZE = 8; const PADDING = 6; const tempText = document.createElementNS(SVG_NAMESPACE, 'text'); tempText.style.fontSize = `${FONT_SIZE}px`; tempText.style.fontFamily = 'Arial, sans-serif'; tempText.textContent = textContent; g.appendChild(tempText); const textWidth = tempText.getBBox().width; g.removeChild(tempText); const rectWidth = textWidth + PADDING; const rectHeight = FONT_SIZE + PADDING; const rect = document.createElementNS(SVG_NAMESPACE, 'rect'); rect.setAttribute('x', -rectWidth / 2); rect.setAttribute('y', -rectHeight - 5); rect.setAttribute('width', rectWidth); rect.setAttribute('height', rectHeight); rect.setAttribute('rx', 3); rect.setAttribute('fill', '#FF9800'); markerGroup.appendChild(rect); const arrow = document.createElementNS(SVG_NAMESPACE, 'path'); arrow.setAttribute('d', 'M 0 0 L -4 -8 L 4 -8 Z'); arrow.setAttribute('fill', '#FF9800'); markerGroup.appendChild(arrow); const text = document.createElementNS(SVG_NAMESPACE, 'text'); text.setAttribute('x', 0); text.setAttribute('y', -rectHeight / 2 - 4); text.setAttribute('text-anchor', 'middle'); text.setAttribute('alignment-baseline', 'middle'); text.style.fontSize = `${FONT_SIZE}px`; text.style.fontWeight = 'normal'; text.style.fontFamily = 'Arial, sans-serif'; text.style.fill = 'black'; text.textContent = textContent; markerGroup.appendChild(text); g.appendChild(markerGroup); } } }
function createPolylinePoints(plan, maxDepth, maxTime) { /* ... (inchangé) ... */ const scaleX = time => MARGIN.left + (time / maxTime) * GRAPH_WIDTH; const scaleY = depth => MARGIN.top + (depth / maxDepth) * GRAPH_HEIGHT; const points = []; let currentTime = 0; points.push(`${scaleX(currentTime)},${scaleY(0)}`); currentTime += plan.dt; points.push(`${scaleX(currentTime)},${scaleY(plan.profondeurFinale)}`); currentTime += plan.de; points.push(`${scaleX(currentTime)},${scaleY(plan.profondeurFinale)}`); currentTime += plan.drp; points.push(`${scaleX(currentTime)},${scaleY(5)}`); currentTime += plan.dp5; points.push(`${scaleX(currentTime)},${scaleY(5)}`); currentTime += plan.dts; points.push(`${scaleX(currentTime)},${scaleY(0)}`); return points.join(' '); }
function drawCurve(diveInfo, title, className, maxDepth, maxTime, group) { /* ... (inchangé) ... */ const pointsString = createPolylinePoints(diveInfo.plan, maxDepth, maxTime); const visiblePolyline = document.createElementNS(SVG_NAMESPACE, 'polyline'); visiblePolyline.setAttribute('points', pointsString); visiblePolyline.setAttribute('class', 'dive-profile ' + className); group.appendChild(visiblePolyline); const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0); if (isTouchDevice) { const touchHitbox = document.createElementNS(SVG_NAMESPACE, 'polyline'); touchHitbox.setAttribute('points', pointsString); touchHitbox.setAttribute('class', 'touch-hitbox'); group.appendChild(touchHitbox); attachTooltipToCurve(touchHitbox, diveInfo, title, maxDepth, maxTime); } else { attachTooltipToCurve(visiblePolyline, diveInfo, title, maxDepth, maxTime); } }

// --- GESTION DE L'INTERACTIVITÉ (TOOLTIP, MANOMÈTRES) ---
function attachTooltipToCurve(interactiveElement, diveInfo, title, maxDepth, maxTime) { /* ... (inchangé) ... */ const unscaleX = pixelX => (pixelX - MARGIN.left) * maxTime / GRAPH_WIDTH; const plan = diveInfo.plan; const bloc = diveInfo.bloc; const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0); const pathPoints = []; if (isTouchDevice) { const polylinePoints = interactiveElement.points; for (let i = 0; i < polylinePoints.length; i++) { pathPoints.push({ x: polylinePoints[i].x, y: polylinePoints[i].y }); } } const updateTooltip = (clientX, clientY, pageX, pageY) => { const svgPoint = svgElement.createSVGPoint(); svgPoint.x = clientX; svgPoint.y = clientY; const pos = svgPoint.matrixTransform(svgElement.getScreenCTM().inverse()); const currentTime = unscaleX(pos.x); let tankType = 'main'; if (diveInfo.isIncident) { tankType = 'incident'; } else if (title === "Courbe Sécurité") { tankType = 'security'; } const tooltipData = calculateTooltipData(currentTime, plan, bloc, diveInfo); resetAllTanks(); updateSingleTank(tankType, tooltipData.pressionRestante); tooltip.classList.remove('hidden'); if (isTouchDevice) { tooltip.innerHTML = `<span style="font-weight:bold;">${title}</span>|Tps:<strong>${tooltipData.time.toFixed(1)}m</strong>|Prof:<strong>${tooltipData.depth.toFixed(1)}m</strong>|DTR:<strong>${tooltipData.dtrTable}</strong>|Conso:<strong>${tooltipData.consoCumul.toFixed(0)}b</strong>|P:<strong>${tooltipData.pressionRestante.toFixed(0)}b</strong>`; } else { tooltip.innerHTML = `<b>Profil : ${title}</b><br>Temps: ${tooltipData.time.toFixed(1)} min<br>Profondeur: ${tooltipData.depth.toFixed(1)} m<br>DTR (table): ${tooltipData.dtrTable}<br>Conso. inst.: ${tooltipData.consoInst.toFixed(2)} bar/min<br>Conso. cumulée: ${tooltipData.consoCumul.toFixed(0)} bar<br>Pression restante: ${tooltipData.pressionRestante.toFixed(0)} bar`; const tooltipWidth = tooltip.offsetWidth; const windowWidth = window.innerWidth; let leftPosition = pageX + 15; if (leftPosition + tooltipWidth > windowWidth) { leftPosition = pageX - tooltipWidth - 15; } tooltip.style.left = `${leftPosition}px`; tooltip.style.top = `${pageY + 15}px`; } }; const hideTooltip = () => { if (!tooltip.classList.contains('hidden')) { tooltip.classList.add('hidden'); resetAllTanks(); } }; if (!isTouchDevice) { interactiveElement.addEventListener('mousemove', (event) => updateTooltip(event.clientX, event.clientY, event.pageX, event.pageY)); interactiveElement.addEventListener('mouseleave', hideTooltip); } else { const handleTouch = (event) => { const touch = event.touches[0]; const clientX = touch.clientX; const clientY = touch.clientY; const svgPoint = svgElement.createSVGPoint(); svgPoint.x = clientX; svgPoint.y = clientY; const touchPos = svgPoint.matrixTransform(svgElement.getScreenCTM().inverse()); let minDistance = Infinity; for (let i = 0; i < pathPoints.length - 1; i++) { const p1 = pathPoints[i]; const p2 = pathPoints[i + 1]; const dx = p2.x - p1.x; const dy = p2.y - p1.y; if (dx === 0 && dy === 0) continue; const t = ((touchPos.x - p1.x) * dx + (touchPos.y - p1.y) * dy) / (dx * dx + dy * dy); const tClamped = Math.max(0, Math.min(1, t)); const closestPoint = { x: p1.x + tClamped * dx, y: p1.y + tClamped * dy }; const distance = Math.hypot(touchPos.x - closestPoint.x, touchPos.y - closestPoint.y); if (distance < minDistance) minDistance = distance; } const detectionThreshold = 20; if (minDistance < detectionThreshold) { event.preventDefault(); updateTooltip(touch.clientX, touch.clientY, touch.pageX, touch.pageY); } else { hideTooltip(); } }; interactiveElement.addEventListener('touchstart', handleTouch); interactiveElement.addEventListener('touchmove', handleTouch, { passive: false }); interactiveElement.addEventListener('touchend', hideTooltip); interactiveElement.addEventListener('touchcancel', hideTooltip); } interactiveElement.addEventListener('contextmenu', (event) => event.preventDefault()); }
function getDepthAtTime(time, plan) { /* ... (inchangé) ... */ const { dt, dpFinale, drp, dp5, dts, profondeurFinale } = plan; const epsilon = 0.0001; if (time < dt - epsilon) return dt > 0 ? profondeurFinale * (time / dt) : 0; if (time < dpFinale + epsilon) return profondeurFinale; if (time < dpFinale + drp - epsilon) return drp > 0 ? profondeurFinale - (profondeurFinale - 5) * ((time - dpFinale) / drp) : 5; if (time < dpFinale + drp + dp5 - epsilon) return 5; return dts > 0 ? 5 - 5 * ((time - dpFinale - drp - dp5) / dts) : 0; }
function updateSingleTank(type, currentPressure) { /* ... (inchangé) ... */ const tank = tanks[type]; if (!tank || !tank.airLevel) return; const pressure = currentPressure; const pressurePercentage = Math.max(0, pressure) / 200; const newHeight = TANK_MAX_HEIGHT * pressurePercentage; const newY = TANK_INITIAL_Y + (TANK_MAX_HEIGHT - newHeight); tank.airLevel.setAttribute('height', newHeight); tank.airLevel.setAttribute('y', newY); tank.clipRect.setAttribute('height', newHeight); tank.clipRect.setAttribute('y', newY); const pressureString = pressure.toFixed(0); tank.pressureText.textContent = pressureString; tank.bgText.textContent = pressureString; if (pressure <= 50) { tank.airLevel.setAttribute('fill', '#D32F2F'); } else if (pressure <= 80) { tank.airLevel.setAttribute('fill', '#FBC02D'); } else { tank.airLevel.setAttribute('fill', '#00C853'); } }
function resetAllTanks() { /* ... (inchangé) ... */ updateSingleTank('main', 200); updateSingleTank('security', 200); updateSingleTank('incident', 200); }
function calculateTooltipData(time, plan, bloc, diveInfo) { /* ... (inchangé) ... */ const isIncident = diveInfo.isIncident; const incidentTime = diveInfo.incidentTime; let consoCumulBar = 0; const timeStep = 0.1; const totalDuration = plan.dpFinale + plan.dtrFinale; const effectiveTime = Math.min(time, totalDuration); for (let t = 0; t <= effectiveTime; t += timeStep) { const t_current = Math.min(t, effectiveTime); const currentDepth = getDepthAtTime(t_current, plan); const pCurrent = 1 + (currentDepth / 10); const consoMultiplier = (isIncident && t_current >= incidentTime) ? 2 : 1; const consoStep = (20 * pCurrent * timeStep) / bloc * consoMultiplier; consoCumulBar += consoStep; } const depth = getDepthAtTime(time, plan); const pCurrent = 1 + (depth / 10); const finalConsoMultiplier = (isIncident && time >= incidentTime) ? 2 : 1; const consoInstBar = (20 * pCurrent) / bloc * finalConsoMultiplier; const pressionRestante = 200 - consoCumulBar; let dtrTable = "N/A"; const currentTimeRounded = parseFloat(time.toFixed(1)); const { dt, dpFinale } = plan; const dpFinaleRounded = parseFloat(dpFinale.toFixed(1)); if (currentTimeRounded <= dpFinaleRounded) { const deEquivalent = currentTimeRounded - dt; const depthTableRow = diveTableData.table[plan.profondeurFinale] || {}; const desInTable = Object.keys(depthTableRow).map(Number); let deToSearch = 0; for (const de_table of desInTable) { if (de_table <= deEquivalent && de_table > deToSearch) { deToSearch = de_table; } } if (deToSearch > 0) { dtrTable = depthTableRow[deToSearch]; } } const dtrDisplay = (typeof dtrTable === 'number') ? `${dtrTable} min` : dtrTable; return { time: time, depth: depth, dtrTable: dtrDisplay, consoInst: consoInstBar, consoCumul: consoCumulBar, pressionRestante: pressionRestante }; }

// --- GESTION DES PLANS SAUVEGARDÉS ---
function getSavedPlans() { /* ... (inchangé) ... */ return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
function savePlansToStorage(plans) { /* ... (inchangé) ... */ localStorage.setItem(STORAGE_KEY, JSON.stringify(plans)); }
function renderSavedPlans() { /* ... (inchangé) ... */ const plans = getSavedPlans(); savedPlansContainer.innerHTML = ''; if (plans.length === 0) { savedPlansContainer.innerHTML = '<p><i>Aucun plan sauvegardé.</i></p>'; return; } plans.forEach((plan, index) => { const planElement = document.createElement('div'); planElement.className = 'saved-plan-item'; planElement.innerHTML = `<button type="button" class="load-plan-btn" data-index="${index}">${plan.name} (${plan.profondeur}m / ${plan.dtr}min)</button><button type="button" class="delete-plan-btn" data-index="${index}">Supprimer</button>`; savedPlansContainer.appendChild(planElement); }); }
function saveCurrentPlan() { /* ... (inchangé) ... */ const profondeur = document.getElementById('profondeur').value; const dtr = document.getElementById('dtr').value; if (!profondeur || !dtr) { alert("Veuillez renseigner une profondeur et une DTR avant de sauvegarder."); return; } let planName = prompt("Donnez un nom à ce plan :", `Plongée à ${profondeur}m`); if (!planName) return; const newPlan = { name: planName, profondeur: parseInt(profondeur), dtr: parseInt(dtr), panneAir: document.getElementById('panne-air').value, reserve: document.getElementById('reserve').value, bloc: document.getElementById('bloc').value }; const plans = getSavedPlans(); plans.push(newPlan); savePlansToStorage(plans); renderSavedPlans(); }
function loadPlan(index) { /* ... (inchangé) ... */ if (!diveTableData) { alert("Veuillez d'abord charger un fichier de table de plongée."); return; } const plans = getSavedPlans(); const plan = plans[index]; if (plan) { performDiveCalculation(plan); } }
function deletePlan(index) { /* ... (inchangé) ... */ openConfirmModal("Êtes-vous sûr de vouloir supprimer ce plan ?", () => { let plans = getSavedPlans(); plans.splice(index, 1); savePlansToStorage(plans); renderSavedPlans(); }); }

savePlanBtn.addEventListener('click', saveCurrentPlan);
savedPlansContainer.addEventListener('click', event => {
    // ... (inchangé) ...
    const target = event.target; if (target.tagName === 'BUTTON' && target.dataset.index) { const index = parseInt(target.dataset.index); if (target.classList.contains('load-plan-btn')) { loadPlan(index); } else if (target.classList.contains('delete-plan-btn')) { deletePlan(index); } }
});

// =========================================================================
// === NOUVEAU SYSTÈME DE MODALE ET D'IMPRESSION ===
// =========================================================================

const modalInput = document.getElementById('modal-input');
let onConfirmCallback = null;

function closeConfirmModal() {
    modalOverlay.classList.add('hidden');
    modalInput.classList.add('hidden');
    modalInput.value = '';
    onConfirmCallback = null;
}

function openConfirmModal(message, callback) {
    modalText.textContent = message;
    onConfirmCallback = callback;
    modalInput.classList.add('hidden');
    modalOverlay.classList.remove('hidden');
}

function openInputModal(message, placeholder, callback) {
    modalText.textContent = message;
    onConfirmCallback = callback;
    modalInput.placeholder = placeholder;
    modalInput.value = ''; // Toujours commencer avec un champ vide pour que le placeholder soit visible
    modalInput.classList.remove('hidden');
    modalOverlay.classList.remove('hidden');
    modalInput.focus();
}

modalConfirmBtn.addEventListener('click', () => {
    // === MARQUEUR 1 ===
    console.log("1 - Bouton 'Confirmer' de la modale cliqué !");
    // === MARQUEUR 2 ===
        console.log("2 - Le callback est bien une fonction. On va l'exécuter.");

    if (typeof onConfirmCallback === 'function') {

        const inputValue = modalInput.classList.contains('hidden') ? null : modalInput.value;
        onConfirmCallback(inputValue);
    }
    closeConfirmModal();
});

modalCancelBtn.addEventListener('click', closeConfirmModal);
modalOverlay.addEventListener('click', (event) => {
    if (event.target === modalOverlay) { closeConfirmModal(); }
});

window.addEventListener('keydown', (event) => {
    if (!modalOverlay.classList.contains('hidden')) {
        if (event.key === 'Escape') { closeConfirmModal(); }
        if (event.key === 'Enter' && !modalInput.classList.contains('hidden')) { modalConfirmBtn.click(); }
    }
});

// --- GESTION DE L'IMPRESSION ---

const printBtn = document.getElementById('print-btn');
if (printBtn) {
    printBtn.addEventListener('click', () => {
        // === AJOUTEZ CETTE LIGNE DE DÉBOGAGE ICI ===
        console.log("Bouton 'Imprimer' cliqué sur le smartphone !");
        // ============================================
        if (!currentDiveInfo.main) {
            alert("Veuillez d'abord générer un profil de plongée.");
            return;
        }

        const profondeur = document.getElementById('profondeur').value || 'X';
        const dtr = document.getElementById('dtr').value || 'Y';
        const defaultTitle = `Plongée à ${profondeur}m - ${dtr}min`;

        openInputModal(
            "Saisir un titre pour l'impression :",
            defaultTitle,
            (title) => {
                // === MARQUEUR 3 ===
                console.log("3 - Le callback est déclenché. Titre reçu :", title);
                // Ce code est exécuté quand l'utilisateur clique sur "Confirmer"
                if (title === null) return; // Sécurité en cas d'appel inattendu
                populateAndPrint(title || defaultTitle); // Utilise le titre saisi, ou le défaut si vide
            }
        );
    });
}

// REMPLACEZ VOTRE ANCIENNE FONCTION populateAndPrint PAR CELLE-CI :

// REMPLACEZ LA FONCTION EXISTANTE PAR CETTE VERSION CORRIGÉE

function populateAndPrint(printTitle) {
    document.getElementById('print-title-header').textContent = printTitle;

    // --- REMPLISSAGE DE LA SECTION PRINCIPALE ---
    const mainPlan = currentDiveInfo.main.plan;
    const mainInfo = currentDiveInfo.main;
    // On utilise la même logique que le graph pour une cohérence parfaite
    const consoFinaleNormale = calculateTooltipData(mainPlan.dpFinale + mainPlan.dtrFinale, mainPlan, mainInfo.bloc, mainInfo).consoCumul;
    const reserveRestante = 200 - consoFinaleNormale;

    document.getElementById('print-profondeur').textContent = `${mainPlan.profondeurFinale} m`;
    document.getElementById('print-bloc').textContent = `${mainInfo.bloc} L`;
    document.getElementById('print-dtr').textContent = `${mainPlan.dtrFinale} min`;
    document.getElementById('print-reserve-initiale').textContent = `${document.getElementById('reserve').value} bar`;
    document.getElementById('print-dt').textContent = `${mainPlan.dt.toFixed(1)} min`;
    document.getElementById('print-de').textContent = `${mainPlan.de.toFixed(1)} min`;
    document.getElementById('print-dp').textContent = `${mainPlan.dpFinale.toFixed(1)} min`;
    document.getElementById('print-total-time').textContent = `${(mainPlan.dpFinale + mainPlan.dtrFinale).toFixed(1)} min`;
    document.getElementById('print-reserve-restante').textContent = `${reserveRestante.toFixed(0)} bar`;


    // --- REMPLISSAGE DE LA SECTION INCIDENT (AVEC LA CORRECTION) ---
    const incidentSection = document.getElementById('print-incident-section');
    if (currentDiveInfo.incident) {
        const incidentPlan = currentDiveInfo.incident.plan;
        const incidentInfo = currentDiveInfo.incident;
        const incidentTime = parseFloat(document.getElementById('panne-air').value);

        // CORRECTION : On supprime le calcul manuel et on utilise la fonction du graph
        const totalDurationIncident = incidentPlan.dpFinale + incidentPlan.dtrFinale;
        const incidentTooltipData = calculateTooltipData(totalDurationIncident, incidentPlan, incidentInfo.bloc, incidentInfo);

        // On récupère la pression restante directement, garantissant la cohérence
        const pressionFinaleIncident = incidentTooltipData.pressionRestante;
        
        document.getElementById('print-panne-air').textContent = `${incidentTime} min`;
        document.getElementById('print-incident-total-time').textContent = `${totalDurationIncident.toFixed(1)} min`;
        document.getElementById('print-incident-reserve').textContent = `${pressionFinaleIncident.toFixed(0)} bar`;
        
        incidentSection.classList.remove('hidden');
    } else {
        incidentSection.classList.add('hidden');
    }


    // --- REMPLISSAGE DES AVERTISSEMENTS (inchangé) ---
    const printWarningSection = document.getElementById('print-warning-section');
    const printReserveWarning = document.getElementById('print-reserve-warning');
    const printEmptyWarning = document.getElementById('print-empty-warning');
    const printBuddyWarning = document.getElementById('print-buddy-warning');
    if (currentDiveInfo.limits && (currentDiveInfo.limits.reserveDtr || currentDiveInfo.limits.emptyDtr || currentDiveInfo.limits.buddyEmptyDtr)) {
        printReserveWarning.textContent = '';
        printEmptyWarning.textContent = '';
        printBuddyWarning.textContent = '';
        if (currentDiveInfo.limits.reserveDtr) {
            const reserveValue = document.getElementById('reserve').value;
            printReserveWarning.textContent = `Réserve (${reserveValue}b) entamée dès ${currentDiveInfo.limits.reserveDtr} min de DTR.`;
        }
        if (currentDiveInfo.limits.emptyDtr) {
            printEmptyWarning.textContent = `Risque panne sèche (seul) dès ${currentDiveInfo.limits.emptyDtr} min de DTR.`;
        }
        if (currentDiveInfo.limits.buddyEmptyDtr) {
            printBuddyWarning.textContent = `Risque panne sèche (assistance) dès ${currentDiveInfo.limits.buddyEmptyDtr} min de DTR.`;
        }
        printWarningSection.classList.remove('hidden');
    } else {
        printWarningSection.classList.add('hidden');
    }


    // --- LANCEMENT DE L'IMPRESSION (inchangé) ---
    requestAnimationFrame(() => {
        setTimeout(() => {
            window.print();
        }, 300);
    });
}

// --- DÉMARRAGE DE L'APPLICATION ---
document.addEventListener('DOMContentLoaded', () => {
    drawAllGraphs();
    resetAllTanks();
    renderSavedPlans();
});

window.addEventListener('load', () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW enregistré:', reg))
            .catch(err => console.error('Échec SW:', err));
    }
});

/**
 * Calcule la consommation totale pour un plan de plongée donné.
 * @param {object} plan - L'objet plan de plongée.
 * @param {number} bloc - La taille du bloc en litres.
 * @returns {number} La consommation totale en bars.
 */
function calculateTotalConsumption(plan, bloc) {
    const pMoyDescente = 1 + (plan.profondeurFinale / 2 / 10);
    const consoDescenteBar = (20 * pMoyDescente * plan.dt) / bloc;

    const pFond = 1 + (plan.profondeurFinale / 10);
    const consoFondBar = (20 * pFond * plan.de) / bloc;

    // Simplification pour la remontée : on prend une pression moyenne
    // C'est une approximation, mais suffisante pour cet avertissement.
    const consoRemontee = plan.dtrFinale * ((bloc === 12) ? 4 : 3);
    
    return consoDescenteBar + consoFondBar + consoRemontee;
}

/**
 * Trouve les DTR limites pour la réserve et la panne sèche.
 * @param {number} profondeur - La profondeur de la plongée.
 * @param {number} bloc - La taille du bloc.
 * @param {number} reserve - La réserve en bars.
 * @returns {object} Un objet avec { reserveDtr, emptyDtr }.
 */


// REMPLACEZ VOTRE FONCTION calculateConsumptionLimits PAR CETTE VERSION DE DÉBOGAGE

function calculateConsumptionLimits(profondeur, bloc, reserve) {
    console.log(`--- Début du calcul des limites pour P=${profondeur}m, Bloc=${bloc}L, Réserve=${reserve}b ---`);

    if (!diveTableData || !diveTableData.table[profondeur]) {
        console.error("Pas de données pour cette profondeur dans la table.");
        return { reserveDtr: null, emptyDtr: null, buddyEmptyDtr: null };
    }

    const desInTable = Object.keys(diveTableData.table[profondeur]).map(Number).sort((a, b) => a - b);
    let reserveDtr = null;
    let emptyDtr = null;
    let buddyEmptyDtr = null;

    for (const de of desInTable) {
        const dtr = diveTableData.table[profondeur][de];
        if (dtr === undefined || dtr === 0) continue;

        const dt = profondeur / 20;
        const tempPlan = createPlan(profondeur, dt + de, dtr);

        const pMoyDescente = 1 + (tempPlan.profondeurFinale / 2 / 10);
        const consoDescente = (20 * pMoyDescente * tempPlan.dt) / bloc;
        const pFond = 1 + (tempPlan.profondeurFinale / 10);
        const consoFond = (20 * pFond * tempPlan.de) / bloc;
        const consoAvantRemontee = consoDescente + consoFond;
        
        const consoRemontee = tempPlan.dtrFinale * ((bloc == 12) ? 4 : 3);
        
        // --- Scénario d'assistance ---
        const totalBuddyConsumption = consoAvantRemontee + (consoRemontee * 2);
        const buddyRemainingPressure = 200 - totalBuddyConsumption;

        // === NOTRE CONSOLE.LOG CLÉ ===
        console.log(`Pour DE=${de}min / DTR=${dtr}min -> Conso Assistance: ${totalBuddyConsumption.toFixed(1)}b -> Pression Restante: ${buddyRemainingPressure.toFixed(1)}b`);

        if (buddyRemainingPressure < 0 && buddyEmptyDtr === null) {
            buddyEmptyDtr = dtr;
            console.log(`%cLIMITE TROUVÉE : Panne sèche en assistance à DTR=${dtr}min`, 'color: red; font-weight: bold;');
        }

        // On peut commenter le reste pour se concentrer sur le problème
        const totalConsumption = consoAvantRemontee + consoRemontee;
        const remainingPressure = 200 - totalConsumption;
        if (remainingPressure < reserve && reserveDtr === null) { reserveDtr = dtr; }
        if (remainingPressure < 0 && emptyDtr === null) { emptyDtr = dtr; }
        if (emptyDtr !== null && buddyEmptyDtr !== null) { break; }
    }
    
    console.log("--- Fin du calcul. Limites trouvées :", { reserveDtr, emptyDtr, buddyEmptyDtr });
    return { reserveDtr, emptyDtr, buddyEmptyDtr };
}



/**
 * Affiche les avertissements de consommation sur l'interface.
 * @param {object} limits - L'objet retourné par calculateConsumptionLimits.
 * @param {number} reserve - La réserve en bars.
 */

// REMPLACEZ la fonction displayConsumptionWarnings par celle-ci
function displayConsumptionWarnings(limits, reserve) {
    const container = document.getElementById('consumption-warning-container');
    if (!limits || (!limits.reserveDtr && !limits.emptyDtr && !limits.buddyEmptyDtr)) {
        container.classList.add('hidden');
        return;
    }

    let html = '';
    // Alerte pour la réserve (inchangée)
    if (limits.reserveDtr) {
        html += `<p><strong>Attention :</strong> Pour cette profondeur, la réserve de ${reserve} bars sera entamée à partir d'une <strong>DTR de ${limits.reserveDtr} min</strong>.</p>`;
    }
    // Alerte pour la panne sèche du plongeur seul (inchangée)
    if (limits.emptyDtr) {
        html += `<p><strong>DANGER :</strong> Un risque de panne sèche existe à partir d'une <strong>DTR de ${limits.emptyDtr} min</strong>.</p>`;
    }
    // NOUVELLE alerte pour le scénario d'assistance
    if (limits.buddyEmptyDtr) {
        html += `<p><strong>ASSISTANCE :</strong> En cas de panne d'air d'un coéquipier, le risque de panne sèche existe dès une <strong>DTR de ${limits.buddyEmptyDtr} min</strong>.</p>`;
    }
    
    container.innerHTML = html;
    container.classList.remove('hidden');
}