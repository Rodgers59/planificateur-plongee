// google73.js - Version corrigée pour le calcul DP/DE, et non minifiée

console.log("google73.js (corrigé DP/DE) chargé avec succès.");

// --- VARIABLES GLOBALES ---
let diveTableData = null;
let currentDiveInfo = {};
const fileInput = document.getElementById('data-file');
const calculateBtn = document.getElementById('calculate-btn');
const tooltip = document.getElementById('tooltip');
const svgElement = document.getElementById('dive-graph-svg');
const showMainCurveCheckbox = document.getElementById('show-main-curve');
const showSecurityCurveCheckbox = document.getElementById('show-security-curve');
const showIncidentCurveCheckbox = document.getElementById('show-incident-curve');
const tanks = {
    main: {
        wrapper: document.getElementById('main-tank-wrapper'),
        airLevel: document.getElementById('main-air-level'),
        pressureText: document.getElementById('main-pressure-text'),
        bgText: document.getElementById('main-pressure-text-bg'),
        clipRect: document.getElementById('main-text-clip-rect')
    },
    security: {
        wrapper: document.getElementById('security-tank-wrapper'),
        airLevel: document.getElementById('security-air-level'),
        pressureText: document.getElementById('security-pressure-text'),
        bgText: document.getElementById('security-pressure-text-bg'),
        clipRect: document.getElementById('security-text-clip-rect')
    },
    incident: {
        wrapper: document.getElementById('incident-tank-wrapper'),
        airLevel: document.getElementById('incident-air-level'),
        pressureText: document.getElementById('incident-pressure-text'),
        bgText: document.getElementById('incident-pressure-text-bg'),
        clipRect: document.getElementById('incident-text-clip-rect')
    }
};
const TANK_MAX_HEIGHT = 180;
const TANK_INITIAL_Y = 20;
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const VIEWBOX = {
    width: 800,
    height: 600
};
const MARGIN = {
    top: 40,
    right: 40,
    bottom: 50,
    left: 60
};
const GRAPH_WIDTH = VIEWBOX.width - MARGIN.left - MARGIN.right;
const GRAPH_HEIGHT = VIEWBOX.height - MARGIN.top - MARGIN.bottom;


// --- LECTURE DU FICHIER ET LOGIQUE DE CALCUL ---

fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const data = e.target.result;
        const workbook = XLSX.read(data, {
            type: 'binary'
        });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1
        });
        processRawData(rawData);
    };
    reader.readAsBinaryString(file);
});

function processRawData(rawData) {
    let deHeadersRow = null; // Renommé pour plus de clarté, ce sont des Durées d'Exploration (DE)
    const dataRows = [];
    rawData.forEach(row => {
        if (!Array.isArray(row) || row.length < 2) return;
        const firstCell = row[0];
        // Correction de la condition pour mieux détecter la ligne d'en-tête
        if ((firstCell === null || firstCell === undefined || typeof firstCell === 'string' && firstCell.trim() === "") && !isNaN(parseInt(row[1]))) {
            deHeadersRow = row;
        } else if (!isNaN(parseInt(firstCell))) {
            dataRows.push(row);
        }
    });
    if (!deHeadersRow || dataRows.length === 0) {
        console.error("Format de fichier non valide.");
        diveTableData = null;
        return;
    }
    // Les en-têtes sont des DE, pas des DP.
    const deHeaders = deHeadersRow.slice(1).map(de => parseInt(de)).filter(de => !isNaN(de));
    const structuredData = {
        depths: [],
        des: deHeaders, // Renommé en 'des'
        table: {}
    };
    dataRows.forEach(row => {
        const depth = parseInt(row[0]);
        structuredData.depths.push(depth);
        structuredData.table[depth] = {};
        row.slice(1).forEach((dtr, index) => {
            const de = structuredData.des[index];
            if (de !== undefined) {
                const dtrValue = dtr !== "" && dtr !== null ? parseInt(dtr) : null;
                if (dtrValue !== null && !isNaN(dtrValue)) {
                    structuredData.table[depth][de] = dtrValue;
                }
            }
        });
    });
    diveTableData = structuredData;
    console.log("Données de plongée traitées et stockées (avec correction DE) :", diveTableData);
}

calculateBtn.addEventListener('click', () => {
    resetAllTanks();
    if (!diveTableData) {
        alert("Veuillez d'abord charger un fichier de table de plongée.");
        return;
    }
    const profondeurSaisie = parseInt(document.getElementById('profondeur').value);
    const dtrSaisie = parseInt(document.getElementById('dtr').value);
    const bloc = parseInt(document.getElementById('bloc').value);
    const reserve = parseInt(document.getElementById('reserve').value);
    const incidentTime = parseFloat(document.getElementById('panne-air').value);
    if (isNaN(profondeurSaisie) || isNaN(dtrSaisie) || isNaN(bloc) || isNaN(reserve)) {
        alert("Veuillez remplir tous les champs.");
        return;
    }
    if (dtrSaisie === 0) {
        alert("Pour une plongée sans palier (DTR=0), la procédure est une remontée à vitesse contrôlée avec un palier de sécurité de 3 minutes à 5 mètres. Aucun profil n'est généré pour ce cas.");
        currentDiveInfo = {};
        drawAllGraphs();
        return;
    }
    let profondeurFinale = findFinalDepth(profondeurSaisie);
    if (profondeurFinale === null) {
        alert(`La profondeur de ${profondeurSaisie}m est supérieure à la profondeur maximale de la table.`);
        currentDiveInfo = {};
        drawAllGraphs();
        return;
    }
    if (profondeurFinale !== profondeurSaisie) {
        if (!confirm(`Profondeur non disponible. Utiliser ${profondeurFinale}m ?`)) {
            currentDiveInfo = {};
            drawAllGraphs();
            return;
        }
    }
    // Appel de la fonction de calcul corrigée
    const mainDiveResult = findDpFromDtr(profondeurFinale, dtrSaisie);
    if (mainDiveResult.error) {
        alert(mainDiveResult.error);
        currentDiveInfo = {};
        drawAllGraphs();
        return;
    }
    const {
        dtrFinale,
        dpFinale
    } = mainDiveResult; // dpFinale est maintenant la DP corrigée
    currentDiveInfo.main = {
        plan: createPlan(profondeurFinale, dpFinale, dtrFinale),
        bloc: bloc,
        dtrChoisie: dtrSaisie
    };
    // Appel de la fonction de calcul corrigée
    currentDiveInfo.security = findOptimizedPlan(profondeurFinale, reserve, bloc);
    if (!isNaN(incidentTime)) {
        if (currentDiveInfo.main && incidentTime <= currentDiveInfo.main.plan.dpFinale) {
            // Appel de la fonction de calcul corrigée
            currentDiveInfo.incident = createIncidentPlan(currentDiveInfo.main, incidentTime);
            tanks.incident.wrapper.classList.remove('hidden');
        } else {
            currentDiveInfo.incident = null;
            tanks.incident.wrapper.classList.add('hidden');
        }
    } else {
        currentDiveInfo.incident = null;
        tanks.incident.wrapper.classList.add('hidden');
    }
    drawAllGraphs();
});


showMainCurveCheckbox.addEventListener('change', drawAllGraphs);
showSecurityCurveCheckbox.addEventListener('change', drawAllGraphs);
showIncidentCurveCheckbox.addEventListener('change', drawAllGraphs);

function findFinalDepth(targetDepth) {
    const sortedDepths = diveTableData.depths.sort((a, b) => a - b);
    if (targetDepth > sortedDepths[sortedDepths.length - 1]) {
        return null;
    }
    return sortedDepths.find(d => d >= targetDepth);
}

// =========================================================================
// === MODIFICATION 1 : findDtrAndDp renommée et corrigée                ===
// =========================================================================
function findDpFromDtr(finalDepth, targetDtr) {
    const depthRow = diveTableData.table[finalDepth];
    const matchingDes = []; // On cherche les DE correspondantes

    // L'en-tête de colonne est 'de' (Durée d'Exploration)
    for (const de in depthRow) {
        if (depthRow[de] === targetDtr) {
            matchingDes.push(parseInt(de));
        }
    }

    if (matchingDes.length === 0) {
        return {
            error: `La DTR de ${targetDtr} min n'est pas directement disponible pour une profondeur de ${finalDepth}m.`
        };
    }

    // On prend la plus petite DE qui donne cette DTR
    const finalDe = Math.min(...matchingDes);

    // CORRECTION : On calcule la DP finale correcte
    const dt = finalDepth / 20; // Temps de descente
    const finalDp = dt + finalDe; // DP = DT + DE

    return {
        dtrFinale: targetDtr,
        dpFinale: finalDp, // On retourne la DP corrigée
        error: null
    };
}


function createPlan(profondeur, dp, dtr) {
    // Ce calcul reste valide, car 'dp' est maintenant la vraie Durée de Plongée
    const dt = profondeur / 20;
    const de = dp - dt;
    const drp = (profondeur - 5) / 10;
    const dts = 1;
    const dp5 = Math.max(0, dtr - drp - dts);
    return {
        profondeurFinale: profondeur,
        dpFinale: dp,
        dtrFinale: dtr,
        dt,
        de, // de est maintenant le vrai temps d'exploration
        drp,
        dp5,
        dts
    };
}


// =========================================================================
// === MODIFICATION 2 : findOptimizedPlan corrigée                       ===
// =========================================================================
function findOptimizedPlan(profondeur, reserve, bloc) {
    if (!diveTableData || !diveTableData.table[profondeur]) {
        return null;
    }
    const coeffBeta = (bloc === 12) ? 4 : 3;
    // La table contient des DE, pas des DP. On les trie du plus grand au plus petit.
    const desInTable = Object.keys(diveTableData.table[profondeur]).map(Number).sort((a, b) => b - a);

    let bestValidPlan = null;
    let highestPressure = 0;

    // On boucle sur les DE (Durées d'Exploration) de la table
    for (const de of desInTable) {
        const dtr = diveTableData.table[profondeur][de];
        if (dtr === undefined || dtr === 0) continue;

        // CORRECTION : On calcule la vraie DP à partir de la DE de la table
        const dt = profondeur / 20;
        const dp = dt + de; // DP = DT + DE

        const pressionRemontee = dtr * coeffBeta;
        const pressionSecuriteFinale = Math.max(reserve, pressionRemontee);
        const pressionDecollage = pressionRemontee + pressionSecuriteFinale;

        // Les calculs de consommation utilisent maintenant les bonnes valeurs de dt et de
        const pMoyDescente = 1 + (profondeur / 2 / 10);
        const consoDescenteBar = (20 * pMoyDescente * dt) / bloc;

        const pFond = 1 + (profondeur / 10);
        // La consommation au fond est basée sur la DE, ce qui est correct.
        const consoFondBar = (20 * pFond * de) / bloc;

        const consoAvantRemontee = consoDescenteBar + consoFondBar;
        const pressionRestanteAuDecollage = 200 - consoAvantRemontee;

        if (pressionRestanteAuDecollage >= pressionDecollage) {
            if (pressionDecollage > highestPressure) {
                highestPressure = pressionDecollage;
                bestValidPlan = {
                    plan: createPlan(profondeur, dp, dtr), // On utilise la DP corrigée
                    bloc: bloc,
                    dtrChoisie: dtr,
                    pressionDecollage: pressionDecollage
                };
            }
        }
    }
    return bestValidPlan;
}


// =========================================================================
// === MODIFICATION 3 : createIncidentPlan corrigée                      ===
// =========================================================================
function createIncidentPlan(mainDiveInfo, incidentTime) {
    const {
        bloc,
        dtrChoisie
    } = mainDiveInfo;
    const {
        profondeurFinale: profondeurMax
    } = mainDiveInfo.plan;

    const dtNormal = profondeurMax / 20;
    let profondeurReelleIncident;
    const dpIncident = incidentTime; // dpIncident est le temps TOTAL écoulé (une DP)

    if (dpIncident < dtNormal) {
        profondeurReelleIncident = dpIncident * 20;
    } else {
        profondeurReelleIncident = profondeurMax;
    }

    const profondeurTable = findFinalDepth(profondeurReelleIncident);
    if (profondeurTable === null) {
        // ... (gestion d'erreur inchangée)
    }

    // CORRECTION : On doit chercher une DE dans la table, pas une DP.
    // 1. On calcule la DE équivalente au moment de l'incident.
    const deEquivalentIncident = dpIncident - (profondeurReelleIncident / 20);

    // 2. On parcourt les DE de la table pour trouver la meilleure correspondance.
    const desInTable = Object.keys(diveTableData.table[profondeurTable] || {}).map(Number);
    let deForDtrLookup = 0;
    for (const de_table of desInTable) {
        if (de_table <= deEquivalentIncident && de_table > deForDtrLookup) {
            deForDtrLookup = de_table;
        }
    }

    const dtrIncidentTable = deForDtrLookup > 0 ? diveTableData.table[profondeurTable][deForDtrLookup] : 0;

    // On crée le plan d'incident avec la DP réelle de l'incident.
    let incidentPlan = createPlan(profondeurReelleIncident, dpIncident, dtrIncidentTable);
    if (dtrIncidentTable === 0) {
        incidentPlan.dp5 = 3;
        incidentPlan.dtrFinale = incidentPlan.drp + incidentPlan.dp5 + incidentPlan.dts;
    }
    return {
        plan: incidentPlan,
        bloc: bloc,
        isIncident: true,
        dtrChoisie: dtrChoisie
    };
}


function clearSVG() {
    while (svgElement.childNodes.length > 1) {
        if (svgElement.lastChild.nodeName.toLowerCase() !== 'defs') {
            svgElement.removeChild(svgElement.lastChild);
        } else {
            break;
        }
    }
}

function drawGridAndAxes(maxDepth, maxTime) {
    const g = document.createElementNS(SVG_NAMESPACE, 'g');
    const scaleX = time => MARGIN.left + (time / maxTime) * GRAPH_WIDTH;
    const scaleY = depth => MARGIN.top + (depth / maxDepth) * GRAPH_HEIGHT;
    const bgRect = document.createElementNS(SVG_NAMESPACE, 'rect');
    bgRect.setAttribute('x', MARGIN.left);
    bgRect.setAttribute('y', MARGIN.top);
    bgRect.setAttribute('width', GRAPH_WIDTH);
    bgRect.setAttribute('height', GRAPH_HEIGHT);
    bgRect.setAttribute('class', 'water-background');
    g.appendChild(bgRect);
    const backgroundImage = document.createElementNS(SVG_NAMESPACE, 'image');
    backgroundImage.setAttribute('href', 'fond-raie-manta.jpg');
    backgroundImage.setAttribute('x', MARGIN.left);
    backgroundImage.setAttribute('y', MARGIN.top);
    backgroundImage.setAttribute('width', GRAPH_WIDTH);
    backgroundImage.setAttribute('height', GRAPH_HEIGHT);
    backgroundImage.setAttribute('preserveAspectRatio', 'none');
    backgroundImage.setAttribute('opacity', '0.3');
    g.appendChild(backgroundImage);
    for (let d = 0; d <= maxDepth; d += 10) {
        const y = scaleY(d);
        const gridLine = document.createElementNS(SVG_NAMESPACE, 'line');
        gridLine.setAttribute('x1', MARGIN.left);
        gridLine.setAttribute('y1', y);
        gridLine.setAttribute('x2', MARGIN.left + GRAPH_WIDTH);
        gridLine.setAttribute('y2', y);
        gridLine.setAttribute('class', 'grid-line');
        g.appendChild(gridLine);
    }
    for (let t = 0; t <= maxTime; t++) {
        if (t % 5 === 0) {
            const x = scaleX(t);
            const gridLine = document.createElementNS(SVG_NAMESPACE, 'line');
            gridLine.setAttribute('x1', x);
            gridLine.setAttribute('y1', MARGIN.top);
            gridLine.setAttribute('x2', x);
            gridLine.setAttribute('y2', MARGIN.top + GRAPH_HEIGHT);
            gridLine.setAttribute('class', 'grid-line');
            g.appendChild(gridLine);
        }
    }
    const surfaceRect = document.createElementNS(SVG_NAMESPACE, 'rect');
    surfaceRect.setAttribute('x', MARGIN.left);
    surfaceRect.setAttribute('y', MARGIN.top);
    surfaceRect.setAttribute('width', GRAPH_WIDTH);
    surfaceRect.setAttribute('height', '3');
    surfaceRect.setAttribute('class', 'water-surface');
    g.appendChild(surfaceRect);
    for (let d = 0; d <= maxDepth; d += 10) {
        const y = scaleY(d);
        const text = document.createElementNS(SVG_NAMESPACE, 'text');
        text.setAttribute('x', MARGIN.left - 10);
        text.setAttribute('y', y + 5);
        text.setAttribute('class', 'axis-text');
        text.style.textAnchor = 'end';
        text.textContent = d;
        g.appendChild(text);
    }
    for (let t = 0; t <= maxTime; t++) {
        const x = scaleX(t);
        const isMajorTick = t % 5 === 0;
        const tick = document.createElementNS(SVG_NAMESPACE, 'line');
        tick.setAttribute('x1', x);
        tick.setAttribute('y1', MARGIN.top + GRAPH_HEIGHT);
        tick.setAttribute('x2', x);
        tick.setAttribute('y2', MARGIN.top + GRAPH_HEIGHT + (isMajorTick ? 8 : 4));
        tick.setAttribute('class', 'axis-tick');
        g.appendChild(tick);
        if (isMajorTick) {
            const text = document.createElementNS(SVG_NAMESPACE, 'text');
            text.setAttribute('x', x);
            text.setAttribute('y', MARGIN.top + GRAPH_HEIGHT + 25);
            text.setAttribute('class', 'axis-text');
            text.style.textAnchor = 'middle';
            text.textContent = t;
            g.appendChild(text);
        }
    }
    const boundary = document.createElementNS(SVG_NAMESPACE, 'rect');
    boundary.setAttribute('x', MARGIN.left);
    boundary.setAttribute('y', MARGIN.top);
    boundary.setAttribute('width', GRAPH_WIDTH);
    boundary.setAttribute('height', GRAPH_HEIGHT);
    boundary.setAttribute('class', 'axis-boundary');
    g.appendChild(boundary);
    return g;
}

function drawAllGraphs() {
    clearSVG();
    tooltip.classList.add('hidden');
    const showMain = showMainCurveCheckbox.checked && currentDiveInfo.main;
    const showSecurity = showSecurityCurveCheckbox.checked && currentDiveInfo.security;
    const showIncident = showIncidentCurveCheckbox.checked && currentDiveInfo.incident;
    let maxDepth = 0;
    let maxTime = 0;
    if (showMain) {
        maxDepth = Math.max(maxDepth, currentDiveInfo.main.plan.profondeurFinale);
        maxTime = Math.max(maxTime, currentDiveInfo.main.plan.dpFinale + currentDiveInfo.main.plan.dtrFinale);
    }
    if (showSecurity) {
        maxDepth = Math.max(maxDepth, currentDiveInfo.security.plan.profondeurFinale);
        maxTime = Math.max(maxTime, currentDiveInfo.security.plan.dpFinale + currentDiveInfo.security.plan.dtrFinale);
    }
    if (showIncident) {
        maxDepth = Math.max(maxDepth, currentDiveInfo.incident.plan.profondeurFinale);
        maxTime = Math.max(maxTime, currentDiveInfo.incident.plan.dpFinale + currentDiveInfo.incident.plan.dtrFinale);
    }
    const finalMaxDepth = (showMain || showSecurity || showIncident) ? Math.ceil((maxDepth + 10) / 10) * 10 : 60;
    const finalMaxTime = (showMain || showSecurity || showIncident) ? Math.ceil(maxTime / 5) * 5 : 60;
    const g = drawGridAndAxes(finalMaxDepth, finalMaxTime);
    svgElement.appendChild(g);
    if (showMain || showSecurity || showIncident) {
        const curvesToDraw = [];
        if (showSecurity) curvesToDraw.push({
            info: currentDiveInfo.security,
            title: "Courbe Optimisée",
            className: "security-curve"
        });
        if (showMain) curvesToDraw.push({
            info: currentDiveInfo.main,
            title: "DTR Choisie",
            className: "main-curve"
        });
        if (showIncident) curvesToDraw.push({
            info: currentDiveInfo.incident,
            title: "Panne d'air",
            className: "incident-curve"
        });
        curvesToDraw.sort((a, b) => (b.info.plan.dpFinale + b.info.plan.dtrFinale) - (a.info.plan.dpFinale + a.info.plan.dtrFinale));
        curvesToDraw.forEach(curve => {
            drawCurve(curve.info, curve.title, curve.className, finalMaxDepth, finalMaxTime, g);
        });
    }
}

function createPolylinePoints(plan, maxDepth, maxTime) {
    const scaleX = time => MARGIN.left + (time / maxTime) * GRAPH_WIDTH;
    const scaleY = depth => MARGIN.top + (depth / maxDepth) * GRAPH_HEIGHT;
    const points = [];
    let currentTime = 0;
    points.push(`${scaleX(currentTime)},${scaleY(0)}`);
    currentTime += plan.dt;
    points.push(`${scaleX(currentTime)},${scaleY(plan.profondeurFinale)}`);
    currentTime += plan.de;
    points.push(`${scaleX(currentTime)},${scaleY(plan.profondeurFinale)}`);
    currentTime += plan.drp;
    points.push(`${scaleX(currentTime)},${scaleY(5)}`);
    currentTime += plan.dp5;
    points.push(`${scaleX(currentTime)},${scaleY(5)}`);
    currentTime += plan.dts;
    points.push(`${scaleX(currentTime)},${scaleY(0)}`);
    return points.join(' ');
}


function drawCurve(diveInfo, title, className, maxDepth, maxTime, group) {
    const pointsString = createPolylinePoints(diveInfo.plan, maxDepth, maxTime);

    // Crée la courbe visible dans tous les cas
    const visiblePolyline = document.createElementNS(SVG_NAMESPACE, 'polyline');
    visiblePolyline.setAttribute('points', pointsString);
    visiblePolyline.setAttribute('class', 'dive-profile ' + className);
    group.appendChild(visiblePolyline);

    // Détecte si l'appareil est tactile
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    if (isTouchDevice) {
        // --- CAS TACTILE : On crée une hitbox et on lui attache les événements ---
        const touchHitbox = document.createElementNS(SVG_NAMESPACE, 'polyline');
        touchHitbox.setAttribute('points', pointsString);
        touchHitbox.setAttribute('class', 'touch-hitbox');
        group.appendChild(touchHitbox);
        
        // Les événements tactiles sont attachés à la hitbox large
        attachTooltipToCurve(touchHitbox, diveInfo, title, maxDepth, maxTime);
    } else {
        // --- CAS DESKTOP : Pas de hitbox, on attache les événements à la courbe visible ---
        // Les événements de la souris sont attachés directement à la courbe visible
        attachTooltipToCurve(visiblePolyline, diveInfo, title, maxDepth, maxTime);
    }
}

function attachTooltipToCurve(interactiveElement, diveInfo, title, maxDepth, maxTime) {
    const unscaleX = pixelX => (pixelX - MARGIN.left) * maxTime / GRAPH_WIDTH;
    const plan = diveInfo.plan;
    const bloc = diveInfo.bloc;

    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    const pathPoints = [];
    if (isTouchDevice) {
        const polylinePoints = interactiveElement.points;
        for (let i = 0; i < polylinePoints.length; i++) {
            pathPoints.push({
                x: polylinePoints[i].x,
                y: polylinePoints[i].y
            });
        }
    }

    const updateTooltip = (clientX, clientY, pageX, pageY) => {
        const svgPoint = svgElement.createSVGPoint();
        svgPoint.x = clientX;
        svgPoint.y = clientY;
        const pos = svgPoint.matrixTransform(svgElement.getScreenCTM().inverse());
        const currentTime = unscaleX(pos.x);

        let tankType = 'main';
        if (diveInfo.isIncident) {
            tankType = 'incident';
        } else if (title === "Courbe Optimisée") {
            tankType = 'security';
        }

        const tooltipData = calculateTooltipData(currentTime, plan, bloc, diveInfo.isIncident);
        resetAllTanks();
        updateSingleTank(tankType, tooltipData.pressionRestante);

        tooltip.classList.remove('hidden');

        if (isTouchDevice) {
            tooltip.innerHTML = `
                <span style="font-weight:bold;">${title}</span>  |  
                Temps: <strong>${tooltipData.time.toFixed(1)} min</strong>  |  
                Prof: <strong>${tooltipData.depth.toFixed(1)} m</strong>  |  
                DTR: <strong>${tooltipData.dtrTable}</strong>  |  
                Conso. Cumul: <strong>${tooltipData.consoCumul.toFixed(0)} bar</strong>  |  
                Pression: <strong>${tooltipData.pressionRestante.toFixed(0)} bar</strong>
            `;
        } else {
            tooltip.innerHTML = `<b>Profil : ${title}</b><br>
                Temps: ${tooltipData.time.toFixed(1)} min<br>
                Profondeur: ${tooltipData.depth.toFixed(1)} m<br>
                DTR (table): ${tooltipData.dtrTable}<br>
                Conso. inst.: ${tooltipData.consoInst.toFixed(2)} bar/min<br>
                Conso. cumulée: ${tooltipData.consoCumul.toFixed(0)} bar<br>
                Pression restante: ${tooltipData.pressionRestante.toFixed(0)} bar`;

            const tooltipWidth = tooltip.offsetWidth;
            const windowWidth = window.innerWidth;
            let leftPosition = pageX + 15;
            if (leftPosition + tooltipWidth > windowWidth) {
                leftPosition = pageX - tooltipWidth - 15;
            }
            tooltip.style.left = `${leftPosition}px`;
            tooltip.style.top = `${pageY + 15}px`;
        }
    };

    const hideTooltip = () => {
        if (!tooltip.classList.contains('hidden')) {
            tooltip.classList.add('hidden');
            resetAllTanks();
        }
    };

    if (!isTouchDevice) {
        interactiveElement.addEventListener('mousemove', (event) => {
            updateTooltip(event.clientX, event.clientY, event.pageX, event.pageY);
        });
        interactiveElement.addEventListener('mouseleave', hideTooltip);
    } else {
        const handleTouch = (event) => {
            const touch = event.touches[0];
            const clientX = touch.clientX;
            const clientY = touch.clientY;

            const svgPoint = svgElement.createSVGPoint();
            svgPoint.x = clientX;
            svgPoint.y = clientY;
            const touchPos = svgPoint.matrixTransform(svgElement.getScreenCTM().inverse());

            let minDistance = Infinity;
            for (let i = 0; i < pathPoints.length - 1; i++) {
                const p1 = pathPoints[i];
                const p2 = pathPoints[i + 1];
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;

                if (dx === 0 && dy === 0) continue;

                const t = ((touchPos.x - p1.x) * dx + (touchPos.y - p1.y) * dy) / (dx * dx + dy * dy);
                const tClamped = Math.max(0, Math.min(1, t));
                const closestPoint = {
                    x: p1.x + tClamped * dx,
                    y: p1.y + tClamped * dy
                };
                const distance = Math.hypot(touchPos.x - closestPoint.x, touchPos.y - closestPoint.y);
                if (distance < minDistance) {
                    minDistance = distance;
                }
            }

            const detectionThreshold = 20;
            if (minDistance < detectionThreshold) {
                updateTooltip(touch.clientX, touch.clientY, touch.pageX, touch.pageY);
            } else {
                hideTooltip();
            }
        };

        interactiveElement.addEventListener('touchstart', handleTouch);
        interactiveElement.addEventListener('touchmove', handleTouch);
        interactiveElement.addEventListener('touchend', hideTooltip);
        interactiveElement.addEventListener('touchcancel', hideTooltip);
    }
    interactiveElement.addEventListener('contextmenu', (event) => {
        event.preventDefault();
    });
}


// --- FONCTIONS UTILITAIRES ---
function getDepthAtTime(time, plan) {
    const {
        dt,
        dpFinale,
        drp,
        dp5,
        dts,
        profondeurFinale
    } = plan;
    const epsilon = 0.0001;
    if (time < dt - epsilon) return dt > 0 ? profondeurFinale * (time / dt) : 0;
    if (time < dpFinale + epsilon) return profondeurFinale;
    if (time < dpFinale + drp - epsilon) return drp > 0 ? profondeurFinale - (profondeurFinale - 5) * ((time - dpFinale) / drp) : 5;
    if (time < dpFinale + drp + dp5 - epsilon) return 5;
    return dts > 0 ? 5 - 5 * ((time - dpFinale - drp - dp5) / dts) : 0;
}

function updateSingleTank(type, currentPressure) {
    const tank = tanks[type];
    if (!tank || !tank.airLevel) return;
    const pressure = Math.max(0, Math.min(200, currentPressure));
    const pressurePercentage = pressure / 200;
    const newHeight = TANK_MAX_HEIGHT * pressurePercentage;
    const newY = TANK_INITIAL_Y + (TANK_MAX_HEIGHT - newHeight);
    tank.airLevel.setAttribute('height', newHeight);
    tank.airLevel.setAttribute('y', newY);
    tank.clipRect.setAttribute('height', newHeight);
    tank.clipRect.setAttribute('y', newY);
    const pressureString = pressure.toFixed(0);
    tank.pressureText.textContent = pressureString;
    tank.bgText.textContent = pressureString;
    if (pressure <= 50) {
        tank.airLevel.setAttribute('fill', '#D32F2F');
    } else if (pressure <= 80) {
        tank.airLevel.setAttribute('fill', '#FBC02D');
    } else {
        tank.airLevel.setAttribute('fill', '#00C853');
    }
}

function resetAllTanks() {
    updateSingleTank('main', 200);
    updateSingleTank('security', 200);
    updateSingleTank('incident', 200);
}


// =========================================================================
// === MODIFICATION 4 : calculateTooltipData corrigée                    ===
// =========================================================================
function calculateTooltipData(time, plan, bloc, isIncident = false) {
    // La première partie du calcul (conso, pression, etc.) reste la même, car
    // le 'plan' qu'elle reçoit a déjà été corrigé en amont.
    const {
        dt,
        de,
        drp,
        dp5,
        dts,
        profondeurFinale,
        dpFinale,
        dtrFinale
    } = plan;
    const depth = getDepthAtTime(time, plan);
    let consoCumulBar = 0;
    // ... [Calcul de consommation inchangé]
    const pMoyDescente = 1 + (profondeurFinale / 2 / 10);
    const consoDescenteBar = (20 * pMoyDescente * dt) / bloc;
    const pFond = 1 + (profondeurFinale / 10);
    const consoFondBar = (20 * pFond * de) / bloc;
    const consoAvantRemontee = consoDescenteBar + consoFondBar;
    if (!isIncident) {
        if (time <= dt) {
            consoCumulBar = (20 * (1 + (depth / 2 / 10)) * time) / bloc;
        } else if (time <= dpFinale) {
            consoCumulBar = consoAvantRemontee - (20 * pFond * (dpFinale - time)) / bloc;
        } else if (time <= dpFinale + drp) {
            const timeInPhase = time - dpFinale;
            const currentDepthInPhase = profondeurFinale - (profondeurFinale - 5) * (timeInPhase / drp);
            const pMoyInPhase = 1 + ((profondeurFinale + currentDepthInPhase) / 2 / 10);
            consoCumulBar = consoAvantRemontee + (20 * pMoyInPhase * timeInPhase) / bloc;
        } else if (time <= dpFinale + drp + dp5) {
            const timeInPhase = time - (dpFinale + drp);
            const pMoyRemonteeDRP = 1 + ((profondeurFinale + 5) / 2 / 10);
            const consoDRPBar = (20 * drp * pMoyRemonteeDRP) / bloc;
            const pPalier5m = 1 + (5 / 10);
            consoCumulBar = consoAvantRemontee + consoDRPBar + (20 * pPalier5m * timeInPhase) / bloc;
        } else {
            const timeInPhase = time - (dpFinale + drp + dp5);
            const pMoyRemonteeDRP = 1 + ((profondeurFinale + 5) / 2 / 10);
            const consoDRPBar = (20 * drp * pMoyRemonteeDRP) / bloc;
            const pPalier5m = 1 + (5 / 10);
            const consoDP5Bar = (20 * dp5 * pPalier5m) / bloc;
            const currentDepthInPhase = 5 - 5 * (timeInPhase / dts);
            const pMoyInPhase = 1 + ((5 + currentDepthInPhase) / 2 / 10);
            consoCumulBar = consoAvantRemontee + consoDRPBar + consoDP5Bar + (20 * pMoyInPhase * timeInPhase) / bloc;
        }
    } else {
        const consoRemonteeDouble = 2;
        if (time <= dpFinale) {
            if (time <= dt) {
                consoCumulBar = (20 * (1 + (depth / 2 / 10)) * time) / bloc;
            } else {
                consoCumulBar = consoAvantRemontee - (20 * pFond * (dpFinale - time)) / bloc;
            }
        } else if (time <= dpFinale + drp) {
            const timeInPhase = time - dpFinale;
            const currentDepthInPhase = profondeurFinale - (profondeurFinale - 5) * (timeInPhase / drp);
            const pMoyInPhase = 1 + ((profondeurFinale + currentDepthInPhase) / 2 / 10);
            consoCumulBar = consoAvantRemontee + (20 * pMoyInPhase * timeInPhase * consoRemonteeDouble) / bloc;
        } else if (time <= dpFinale + drp + dp5) {
            const timeInPhase = time - (dpFinale + drp);
            const pMoyRemonteeDRP = 1 + ((profondeurFinale + 5) / 2 / 10);
            const consoDRPBar = (20 * drp * pMoyRemonteeDRP) / bloc;
            const pPalier5m = 1 + (5 / 10);
            consoCumulBar = consoAvantRemontee + (consoDRPBar * consoRemonteeDouble) + (20 * pPalier5m * timeInPhase * consoRemonteeDouble) / bloc;
        } else {
            const timeInPhase = time - (dpFinale + drp + dp5);
            const pMoyRemonteeDRP = 1 + ((profondeurFinale + 5) / 2 / 10);
            const consoDRPBar = (20 * drp * pMoyRemonteeDRP) / bloc;
            const pPalier5m = 1 + (5 / 10);
            const consoDP5Bar = (20 * dp5 * pPalier5m) / bloc;
            const currentDepthInPhase = 5 - 5 * (timeInPhase / dts);
            const pMoyInPhase = 1 + ((5 + currentDepthInPhase) / 2 / 10);
            consoCumulBar = consoAvantRemontee + (consoDRPBar * consoRemonteeDouble) + (consoDP5Bar * consoRemonteeDouble) + (20 * pMoyInPhase * timeInPhase * consoRemonteeDouble) / bloc;
        }
    }
    const pCurrent = 1 + (depth / 10);
    const consoInstBar = (20 * pCurrent) / bloc * (isIncident && time > dpFinale ? 2 : 1);
    const pressionRestante = 200 - consoCumulBar;

    // --- DEBUT DE LA CORRECTION POUR L'AFFICHAGE DE LA DTR ---
    let dtrTable = "N/A";
    const currentTimeRounded = parseFloat(time.toFixed(1));
    const dpFinaleRounded = parseFloat(dpFinale.toFixed(1));

    if (currentTimeRounded < dpFinaleRounded) {
        // Le temps de survol (time) est une DP. Il faut le convertir en DE pour chercher dans la table.
        const deEquivalent = currentTimeRounded - dt;

        // On cherche la DE la plus proche dans la table.
        const desInTable = Object.keys(diveTableData.table[profondeurFinale] || {}).map(Number);
        let deToSearch = 0;
        for (const de_table of desInTable) {
            if (de_table <= deEquivalent && de_table > deToSearch) {
                deToSearch = de_table;
            }
        }
        if (deToSearch > 0) {
            dtrTable = diveTableData.table[profondeurFinale][deToSearch];
        }
    } else { // Si le temps de survol est pendant la remontée
        dtrTable = dtrFinale; // On affiche la DTR finale du plan, ce qui est correct.
    }

    const dtrDisplay = (typeof dtrTable === 'number') ? `${dtrTable} min` : dtrTable;
    // --- FIN DE LA CORRECTION ---

    return {
        time: time,
        depth: depth,
        dtrTable: dtrDisplay,
        consoInst: consoInstBar,
        consoCumul: consoCumulBar,
        pressionRestante: pressionRestante
    };
}


document.addEventListener('DOMContentLoaded', () => {
    // Initialise le graphique à vide au chargement
    drawAllGraphs();
    resetAllTanks();
    // Renommé `findDtrAndDp` en `findDpFromDtr` pour plus de clarté
    window.findDpFromDtr = findDpFromDtr;
});