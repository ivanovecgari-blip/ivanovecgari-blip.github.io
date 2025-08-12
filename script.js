const tg = window.Telegram.WebApp;
tg.expand();

const LHV_DATA = { 
    wood: 14.2,
    plastic: 43,
    cellophane: 17.5,
    rubber: 33,
    rags: 24
};
const MJ_TO_KCAL = 239.006;
const THERMAL_POWER_MULTIPLIER = 2.87;

const inputs = {
    totalMass: document.getElementById('total-mass'),
    woodHumidity: document.getElementById('wood-humidity'),
    sliders: {
        wood: document.getElementById('wood'),
        plastic: document.getElementById('plastic'),
        cellophane: document.getElementById('cellophane'),
        rubber: document.getElementById('rubber'),
        rags: document.getElementById('rags'),
    },
    efficiencies: {
        gasifier: document.getElementById('eff-gasifier'),
        ice: document.getElementById('eff-ice'),
        electric: document.getElementById('eff-electric'),
    }
};

function calculateAndDisplay() {
    const totalMass = parseFloat(inputs.totalMass.value) || 0;
    let perc = {};
    for (const id in inputs.sliders) {
        perc[id] = parseFloat(inputs.sliders[id].value);
        document.getElementById(`${id}-val`).textContent = `${Math.round(perc[id])}%`;
        const mass = (perc[id] / 100) * totalMass;
        document.getElementById(`${id}-mass`).textContent = `(${mass.toFixed(1)} кг)`;
    }

    const woodHumidity = parseFloat(inputs.woodHumidity.value);
    let lhv_wood_effective;

    if (perc.wood > 0) {
        lhv_wood_effective = 21.375 - (0.2575 * woodHumidity);
        lhv_wood_effective = Math.max(8.5, Math.min(18.8, lhv_wood_effective));
    } else {
        lhv_wood_effective = LHV_DATA.wood;
    }
    
    const activeWarnings = [];
    if (perc.wood > 0 && woodHumidity > 25) {
        activeWarnings.push({type: 'info', text: `Влажность древесины > 25%, эффективность снижена.`});
    }
    if (perc.plastic + perc.rubber > 40) {
        activeWarnings.push({type: 'warning', text: 'Высокая доля пластика/резины может привести к смолообразованию.'});
    }
    if (perc.wood > 0 && perc.wood < 50) {
        activeWarnings.push({type: 'warning', text: 'Вероятность засорения установки (доля древесины < 50%).'});
    }
    if (perc.wood > 0 && perc.wood < 30) {
        activeWarnings.push({type: 'danger', text: 'внимание. вероятность что газ будет гореть движется к нулю'});
    }
    if (perc.plastic > 0 || perc.cellophane > 0) {
        activeWarnings.push({type: 'danger', text: 'Не используйте ПВХ и фторопласт (риск ядовитых газов).'});
    }

    const notificationsContainer = document.getElementById('notifications-container');
    notificationsContainer.innerHTML = '';
    
    if (activeWarnings.length > 0) {
        notificationsContainer.classList.add('visible');
        activeWarnings.forEach(warning => {
            const warningDiv = document.createElement('div');
            warningDiv.className = `notification-item ${warning.type}`;
            let icon = 'i';
            if(warning.type === 'danger') icon = '🔴';
            if(warning.type === 'warning') icon = '🟠';
            if(warning.type === 'info') icon = '🔵';
            warningDiv.innerHTML = `<span class="icon">${icon}</span> <span>${warning.text}</span>`;
            notificationsContainer.appendChild(warningDiv);
        });
    } else {
        notificationsContainer.classList.remove('visible');
    }

    const lhv_mix = ((perc.wood * lhv_wood_effective) + (perc.plastic * LHV_DATA.plastic) + (perc.cellophane * LHV_DATA.cellophane) + (perc.rubber * LHV_DATA.rubber) + (perc.rags * LHV_DATA.rags)) / 100;
    
    const eff_gasifier = parseFloat(inputs.efficiencies.gasifier.value) / 100;
    const eff_ice = parseFloat(inputs.efficiencies.ice.value) / 100;
    const eff_electric = parseFloat(inputs.efficiencies.electric.value) / 100;

    const fuelConsumption = totalMass; 
    const totalEnergyIn = (fuelConsumption * lhv_mix) / 3.6;
    const finalPowerEl = totalEnergyIn * eff_gasifier * eff_ice * eff_electric;
    const finalPowerTh = finalPowerEl * THERMAL_POWER_MULTIPLIER;
        
    document.getElementById('res-power-el').textContent = `${finalPowerEl.toFixed(1)} кВт`;
    document.getElementById('res-power-th').textContent = `${finalPowerTh.toFixed(1)} кВт`;

    document.getElementById('wood-humidity-block').classList.toggle('hidden', perc.wood <= 0);
}

function normalizeSliders(changedSliderId) {
    const sliders = Object.values(inputs.sliders); let lockedTotal = 0; let unlockedSliders = [];
    for (const slider of sliders) {
        const id = slider.id; const checkbox = document.querySelector(`.lock-checkbox[data-id="${id}"]`);
        if (checkbox.checked) { lockedTotal += parseFloat(slider.value); } else { unlockedSliders.push(slider); }
    }
    const targetForUnlocked = 100 - lockedTotal;
    if (targetForUnlocked < 0) {
        alert("Сумма заблокированных компонентов не может превышать 100%");
        const checkbox = document.querySelector(`.lock-checkbox[data-id="${changedSliderId}"]`);
        if (checkbox.checked) checkbox.checked = false; inputs.sliders[changedSliderId].disabled = false;
        normalizeSliders(changedSliderId); return;
    }
    let unlockedCurrentTotal = 0; unlockedSliders.forEach(s => unlockedCurrentTotal += parseFloat(s.value));
    let diff = unlockedCurrentTotal - targetForUnlocked;
    let adjustableSliders = unlockedSliders.filter(s => s.id !== changedSliderId);
    if (unlockedSliders.length === 1 && unlockedSliders[0].id === changedSliderId) { unlockedSliders[0].value = targetForUnlocked;
    } else {
        let adjustableTotal = 0; adjustableSliders.forEach(s => adjustableTotal += parseFloat(s.value));
        if (adjustableTotal > 0) {
            for (const slider of adjustableSliders) { const reduction = diff * (parseFloat(slider.value) / adjustableTotal); slider.value = Math.max(0, parseFloat(slider.value) - reduction); }
        } else if (adjustableSliders.length > 0) { const reduction = diff / adjustableSliders.length; adjustableSliders.forEach(s => s.value = Math.max(0, parseFloat(s.value) - reduction)); }
    }
    let finalTotal = 0; sliders.forEach(s => finalTotal += parseFloat(s.value));
    if (Math.round(finalTotal) !== 100) {
        const mainUnlockedSlider = unlockedSliders.find(s => s.id === changedSliderId) || unlockedSliders[0];
        if (mainUnlockedSlider) { mainUnlockedSlider.value = parseFloat(mainUnlockedSlider.value) + (100 - finalTotal); }
    }
    calculateAndDisplay();
}

function populateTooltips() {
    for (const id in LHV_DATA) {
        const eff_gasifier = parseFloat(inputs.efficiencies.gasifier.value) / 100;
        const eff_ice = parseFloat(inputs.efficiencies.ice.value) / 100;
        const eff_electric = parseFloat(inputs.efficiencies.electric.value) / 100;

        const lhv = LHV_DATA[id]; let kgFor1kWh_el;
        if (id === 'wood') { kgFor1kWh_el = 1.2; } else { kgFor1kWh_el = (1 / (eff_gasifier * eff_ice * eff_electric)) * 3.6 / lhv; }
        const kgFor1kWh_th = (1 / eff_gasifier) * 3.6 / lhv;
        const kcal = (lhv * MJ_TO_KCAL).toFixed(0);
        
        const tooltipElem = document.getElementById(`${id}-tooltip-text`);
        if(tooltipElem) {
          tooltipElem.innerHTML = `Теплотворность: <b>~${kcal} ккал/кг</b><hr>Для 1 кВт·ч электричества: <b>${kgFor1kWh_el.toFixed(2)} кг</b><br>Для 1 кВт·ч тепла (в сингазе): <b>${kgFor1kWh_th.toFixed(2)} кг</b>`;
        }
    }
}

inputs.totalMass.addEventListener('input', calculateAndDisplay);
inputs.woodHumidity.addEventListener('input', (e) => {
    document.getElementById('wood-humidity-val').textContent = `${e.target.value}%`; calculateAndDisplay();
});
for (const id in inputs.sliders) {
    inputs.sliders[id].addEventListener('input', () => normalizeSliders(id));
    const checkbox = document.querySelector(`.lock-checkbox[data-id="${id}"]`);
    checkbox.addEventListener('change', () => { inputs.sliders[id].disabled = checkbox.checked; normalizeSliders(id); });
}
for (const id in inputs.efficiencies) {
    inputs.efficiencies[id].addEventListener('input', (e) => {
        document.getElementById(`eff-${id}-val`).textContent = `${e.target.value}%`;
        calculateAndDisplay();
        populateTooltips();
    });
}

window.addEventListener('load', () => {
    populateTooltips(); 
    calculateAndDisplay();
    document.getElementById('wood-humidity-val').textContent = `${inputs.woodHumidity.value}%`;
    document.getElementById('eff-gasifier-val').textContent = `${inputs.efficiencies.gasifier.value}%`;
    document.getElementById('eff-ice-val').textContent = `${inputs.efficiencies.ice.value}%`;
    document.getElementById('eff-electric-val').textContent = `${inputs.efficiencies.electric.value}%`;
});