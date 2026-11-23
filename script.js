const canvas = document.getElementById('ringCanvas');
const ctx = canvas.getContext('2d');

const pHpBar = document.getElementById('p-hp');
const pStamBar = document.getElementById('p-stamina');
const pHpText = document.getElementById('p-hp-text');
const pComboText = document.getElementById('p-combo');
const pAuraStatus = document.getElementById('p-aura-status');
const playerDisplayName = document.getElementById('player-display-name');

const eHpBar = document.getElementById('e-hp');
const eStamBar = document.getElementById('e-stamina');
const eHpText = document.getElementById('e-hp-text');
const eComboText = document.getElementById('e-combo');
const enemyDisplayName = document.getElementById('enemy-display-name');
const bossLevelText = document.getElementById('boss-level-text');

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySubtitle = document.getElementById('overlay-subtitle');

const nameInputSection = document.getElementById('name-input-section');
const mainMenuButtons = document.getElementById('main-menu-buttons');
const shopSection = document.getElementById('shop-section');

const fighterNameInput = document.getElementById('fighter-name-input');
const saveNameBtn = document.getElementById('save-name-btn');
const startFightBtn = document.getElementById('start-fight-btn');
const openShopBtn = document.getElementById('open-shop-btn');
const closeShopBtn = document.getElementById('close-shop-btn');
const changeNameBtn = document.getElementById('change-name-btn');
const buyPackBtn = document.getElementById('buy-pack-btn');

const playerMoneyText = document.getElementById('player-money');
const playerStageText = document.getElementById('player-stage');
const inventoryList = document.getElementById('inventory-list');

// Данные игрока
let playerData = {
    name: localStorage.getItem('neon_boxer_name') || '',
    money: parseInt(localStorage.getItem('neon_boxer_money')) || 100,
    stage: parseInt(localStorage.getItem('neon_boxer_stage')) || 1,
    inventory: JSON.parse(localStorage.getItem('neon_boxer_inv')) || [],
    equippedAura: null
};

// Список из 10 боссов + Главный босс HumJik
const bosses = [
    { name: "ЛОКО", hp: 80, strength: 1.0, color: '#ff2a5f' },
    { name: "АЛОХА", hp: 90, strength: 1.1, color: '#ff6b00' },
    { name: "ПАПАНЯ", hp: 100, strength: 1.2, color: '#eab308' },
    { name: "КОЧ", hp: 110, strength: 1.3, color: '#10b981' },
    { name: "ДАМИНАТОР", hp: 120, strength: 1.4, color: '#06b6d4' },
    { name: "НИГЕР", hp: 135, strength: 1.5, color: '#3b82f6' },
    { name: "КАМАЗ", hp: 150, strength: 1.6, color: '#8b5cf6' },
    { name: "ШУСТРИК", hp: 165, strength: 1.8, color: '#ec4899' },
    { name: "РАЧУЛЯ", hp: 185, strength: 2.0, color: '#f43f5e' },
    { name: "HumJik (ГЛАВНЫЙ БОСС)", hp: 250, strength: 2.5, color: '#a855f7' }
];

// АУРЫ
const aurasConfig = [
    { id: 'ice', name: '❄️ Лёд', chance: 0.50, desc: 'Замедляет стамину врага' },
    { id: 'fire', name: '🔥 Огонь', chance: 0.30, desc: '+30% к урону ударов' },
    { id: 'gold', name: '💰 Золото', chance: 0.15, desc: 'Двойные деньги за победы' },
    { id: 'cyber', name: '⚡ Кибер', chance: 0.05, desc: 'Регенерирует HP и стамину' }
];

let gameRunning = false;
let shakeTime = 0;
let particles = [];
let floatingTexts = [];
let currentBoss = null;
let keys = {};

// Инициализация имени
if (playerData.name) {
    nameInputSection.classList.add('hidden');
    mainMenuButtons.classList.remove('hidden');
    playerDisplayName.textContent = playerData.name;
    fighterNameInput.value = playerData.name;
} else {
    nameInputSection.classList.remove('hidden');
    mainMenuButtons.classList.add('hidden');
}

updateUIStats();

class Boxer {
    constructor(x, color, glowColor, facing) {
        this.startX = x;
        this.x = x;
        this.y = 310;
        this.color = color;
        this.glowColor = glowColor;
        this.facing = facing;
        this.maxHp = 100;
        this.hp = 100;
        this.stamina = 100;
        this.state = 'idle';
        this.stateTimer = 0;
        this.hitRegistered = false;
        this.combo = 0;
        this.bobPhase = Math.random() * Math.PI * 2;
        this.auraActive = false;
    }

    reset(customHp = 100) {
        this.x = this.startX;
        this.maxHp = customHp;
        this.hp = customHp;
        this.stamina = 100;
        this.state = 'idle';
        this.stateTimer = 0;
        this.combo = 0;
        this.auraActive = false;
    }

    attack(type) {
        // Защита: нельзя бить, если находишься в нокдауне (hurt) или выполняешь другое действие
        if (this.state === 'hurt' || (this.state !== 'idle' && this.state !== 'block')) return;
        
        let cost = type === 'jab' ? 10 : (type === 'hook' ? 22 : 30);
        if (this.stamina < cost) return;

        this.stamina -= cost;
        this.state = type;
        this.stateTimer = type === 'jab' ? 12 : (type === 'hook' ? 20 : 26);
        this.hitRegistered = false;
    }

    dash() {
        if (this.state === 'hurt' || this.state !== 'idle' || this.stamina < 15) return;
        this.stamina -= 15;
        this.state = 'dash';
        this.stateTimer = 12;
    }

    toggleAura() {
        if (playerData.equippedAura && this === player) {
            this.auraActive = !this.auraActive;
            pAuraStatus.textContent = this.auraActive ? `АУРА: ВКЛ` : `АУРА: ВЫКЛ`;
            pAuraStatus.style.color = this.auraActive ? '#00ffcc' : '#a0aec0';
        }
    }

    update(opponent) {
        this.bobPhase += 0.1;

        let regen = this.auraActive && playerData.equippedAura === 'cyber' ? 0.9 : 0.4;
        if (this.state === 'idle') {
            this.stamina = Math.min(100, this.stamina + regen);
            if (this.auraActive && playerData.equippedAura === 'cyber') {
                this.hp = Math.min(this.maxHp, this.hp + 0.08);
            }
        } else if (this.state === 'block') {
            this.stamina = Math.min(100, this.stamina + 0.15);
        }

        if (this.state === 'dash') {
            this.x -= this.facing * 7;
        }

        // Обработка таймера состояний (ударов, рывков, получения урона)
        if (this.stateTimer > 0) {
            this.stateTimer--;
            
            // Если это удар, проверяем попадание в нужный кадр
            if (this.state === 'jab' || this.state === 'hook' || this.state === 'uppercut') {
                const activeFrame = this.state === 'jab' ? 7 : (this.state === 'hook' ? 11 : 14);
                if (this.stateTimer === activeFrame && !this.hitRegistered) {
                    this.checkHit(opponent);
                    this.hitRegistered = true;
                }
            }

            // Когда таймер истекает, сбрасываем состояние в idle (это снимает зависание после урона!)
            if (this.stateTimer === 0) {
                this.state = 'idle';
            }
        }

        this.x = Math.max(90, Math.min(canvas.width - 90, this.x));
    }

    checkHit(opponent) {
        if (opponent.state === 'dash') {
            addFloatingText(opponent.x, opponent.y - 80, 'УКЛОНЕНИЕ!', '#38bdf8');
            this.combo = 0;
            return;
        }

        let reach = this.state === 'hook' ? 105 : (this.state === 'uppercut' ? 90 : 95);
        const dist = Math.abs(this.x - opponent.x);

        if (dist <= reach) {
            let baseDmg = this.state === 'jab' ? 6 : (this.state === 'hook' ? 14 : 22);

            if (this === player && this.auraActive) {
                if (playerData.equippedAura === 'fire') baseDmg *= 1.3;
            }
            if (opponent === player && enemy.auraActive && enemy.equippedAura === 'ice') {
                player.stamina = Math.max(0, player.stamina - 5);
            }

            this.combo++;
            let comboBonus = 1 + (this.combo - 1) * 0.15;
            let dmg = Math.round(baseDmg * comboBonus);

            const hitX = opponent.x - opponent.facing * 15;
            const hitY = opponent.y - 75;

            if (opponent.state === 'block' && opponent.stamina > 10) {
                dmg = Math.ceil(dmg * 0.25);
                opponent.stamina = Math.max(0, opponent.stamina - 15);
                opponent.x += this.facing * 8;
                spawnParticles(hitX, hitY, '#eab308', 10);
                addFloatingText(hitX, hitY - 20, 'БЛОК', '#eab308');
                this.combo = 0;
            } else {
                opponent.hp = Math.max(0, opponent.hp - dmg);
                opponent.state = 'hurt';
                // Даем фиксированное время на анимацию/паузу от урона, после чего stateTimer сбросит state в 'idle'
                opponent.stateTimer = 16; 
                opponent.x += this.facing * (this.state === 'uppercut' ? 22 : 14);
                
                shakeTime = this.state === 'uppercut' ? 15 : (this.state === 'hook' ? 10 : 4);
                let color = this.state === 'uppercut' ? '#a855f7' : (this.state === 'hook' ? '#ff7b00' : '#ff2a5f');
                
                spawnParticles(hitX, hitY, color, 20);
                let text = this.combo > 1 ? `-${dmg} (x${this.combo})` : `-${dmg}`;
                addFloatingText(hitX, hitY - 25, text, '#ffd700');
            }
        } else {
            this.combo = 0;
        }
    }

    draw() {
        const bob = this.state === 'idle' ? Math.sin(this.bobPhase) * 4 : 0;
        const lean = this.state === 'hurt' ? -this.facing * 12 : (this.state === 'hook' || this.state === 'uppercut' ? this.facing * 10 : 0);

        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.auraActive) {
            ctx.shadowColor = this === player ? '#00ffcc' : '#ff0055';
            ctx.shadowBlur = 25;
        }

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.ellipse(0, 5, 34, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-12, -35); ctx.lineTo(-18, 0);
        ctx.moveTo(12, -35); ctx.lineTo(18, 0);
        ctx.stroke();

        ctx.fillStyle = this.color;
        ctx.fillRect(-20 + lean * 0.3, -52 + bob, 40, 22);

        ctx.fillStyle = '#f8fafc';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.roundRect(-18 + lean * 0.6, -92 + bob, 36, 42, 10);
        ctx.fill();

        ctx.fillStyle = this.state === 'hurt' ? '#ff7b7b' : '#ffe4c4';
        ctx.beginPath();
        ctx.arc(lean, -112 + bob, 17, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = this.color;
        ctx.fillRect(-16 + lean, -120 + bob, 32, 6);

        let gFrontX = this.facing * 24 + lean;
        let gFrontY = -80 + bob;
        let gBackX = this.facing * 10 + lean;
        let gBackY = -85 + bob;

        if (this.state === 'block') {
            gFrontX = this.facing * 18; gFrontY = -105 + bob;
            gBackX = this.facing * 12; gBackY = -108 + bob;
        } else if (this.state === 'jab') {
            gFrontX = this.facing * 75; gFrontY = -98 + bob;
        } else if (this.state === 'hook') {
            gBackX = this.facing * 85; gBackY = -95 + bob;
        } else if (this.state === 'uppercut') {
            gFrontX = this.facing * 45; gFrontY = -130 + bob;
        }

        this.drawGlove(gBackX, gBackY, 13, this.color);
        this.drawGlove(gFrontX, gFrontY, 15, this.color);

        ctx.restore();
    }

    drawGlove(gx, gy, radius, color) {
        ctx.fillStyle = color;
        ctx.shadowColor = this.glowColor;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(gx, gy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
}

const player = new Boxer(230, '#00f0ff', '#00f0ff', 1);
const enemy = new Boxer(530, '#ff2a5f', '#ff2a5f', -1);

function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10 - 2,
            life: 25 + Math.random() * 15,
            color
        });
    }
}

function addFloatingText(x, y, text, color) {
    floatingTexts.push({ x, y, text, color, life: 35 });
}

function drawRing() {
    const grad = ctx.createRadialGradient(canvas.width / 2, 80, 20, canvas.width / 2, 200, 450);
    grad.addColorStop(0, '#1e294b');
    grad.addColorStop(1, '#090d16');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const ropeY = [185, 225, 265];
    ropeY.forEach((y, idx) => {
        ctx.strokeStyle = idx === 1 ? '#ff2a5f' : '#00f0ff';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.moveTo(40, y);
        ctx.lineTo(canvas.width - 40, y);
        ctx.stroke();
    });
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(35, 165, 12, 155);
    ctx.fillStyle = '#ff2a5f';
    ctx.fillRect(canvas.width - 47, 165, 12, 155);

    ctx.fillStyle = '#131b2e';
    ctx.beginPath();
    ctx.moveTo(20, 310);
    ctx.lineTo(canvas.width - 20, 310);
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(20, 310);
    ctx.lineTo(canvas.width - 20, 310);
    ctx.stroke();
}

function updateAI() {
    // Если бот получил удар (hurt), он не спамит действиями, но таймер его выведет из этого состояния
    if (enemy.state === 'hurt') return;

    const dist = enemy.x - player.x;
    const strength = currentBoss.strength;

    if ((player.state === 'hook' || player.state === 'uppercut') && dist < 120 && Math.random() < (0.2 * strength)) {
        enemy.dash();
        return;
    }

    if ((player.state === 'jab' || player.state === 'hook') && dist < 120 && Math.random() < 0.12 && enemy.stamina > 25) {
        enemy.state = 'block';
        enemy.stateTimer = 18;
        return;
    }

    if (enemy.state === 'block') return;

    if (enemy.stamina < 25 && dist < 160) {
        enemy.x += 2.5;
    } else if (dist > 85) {
        enemy.x -= 3.2 * strength;
    } else if (dist < 65) {
        enemy.x += 2;
    } else {
        if (Math.random() < (0.04 * strength)) {
            const rand = Math.random();
            if (rand < 0.35) enemy.attack('jab');
            else if (rand < 0.7) enemy.attack('hook');
            else enemy.attack('uppercut');
        }
    }
}

function handlePlayerInput() {
    // Если игрок получил удар, управлять им нельзя, пока не пройдет анимация урона
    if (player.state === 'hurt') return;

    if (keys['KeyS'] || keys['ArrowDown']) {
        if (player.state === 'idle' || player.state === 'block') {
            player.state = 'block';
            player.stateTimer = 2;
        }
    }

    if (player.state === 'idle' || player.state === 'block') {
        if (keys['KeyA'] || keys['ArrowLeft']) player.x -= 4;
        if (keys['KeyD'] || keys['ArrowRight']) {
            if (enemy.x - player.x > 55) player.x += 4;
        }
    }
}

function updateHUD() {
    pHpBar.style.width = `${(player.hp / player.maxHp) * 100}%`;
    pStamBar.style.width = `${player.stamina}%`;
    pHpText.textContent = `${Math.round((player.hp / player.maxHp) * 100)}%`;
    pComboText.textContent = `КОМБО: x${player.combo}`;

    eHpBar.style.width = `${(enemy.hp / currentBoss.hp) * 100}%`;
    eStamBar.style.width = `${enemy.stamina}%`;
    eHpText.textContent = `${Math.round((enemy.hp / currentBoss.hp) * 100)}%`;
    eComboText.textContent = `КОМБО: x${enemy.combo}`;

    if (player.hp <= 0 || enemy.hp <= 0) {
        gameRunning = false;
        const won = enemy.hp <= 0;

        if (won) {
            let reward = 40 + playerData.stage * 15;
            if (playerData.equippedAura === 'gold') reward *= 2;
            playerData.money += reward;
            
            if (playerData.stage < 10) {
                playerData.stage++;
                overlayTitle.textContent = `ПОБЕДА НАД ${currentBoss.name}!`;
                overlaySubtitle.textContent = `Вы заработали $${reward}! Переход к следующему боссу.`;
            } else {
                overlayTitle.textContent = `🏆 ТЫ СТАЛ ЧЕМПИОНОМ ВСЕХ БОССОВ!`;
                overlaySubtitle.textContent = `Легендарный кубок твой! HumJik повержен! Награды: $500`;
                playerData.money += 500;
                playerData.stage = 1;
            }
        } else {
            overlayTitle.textContent = 'ВЫ В НОКАУТЕ!';
            overlaySubtitle.textContent = `Босс ${currentBoss.name} оказался сильнее. Попробуй еще раз!`;
        }

        saveData();
        updateUIStats();
        startFightBtn.textContent = 'СЛЕДУЮЩИЙ БОЙ';
        overlay.classList.remove('hidden');
    }
}

function updateUIStats() {
    playerMoneyText.textContent = `$${playerData.money}`;
    playerStageText.textContent = `${playerData.stage} / 10`;
    bossLevelText.textContent = `БОСС ${playerData.stage} / 10`;
    
    if (playerData.inventory.length === 0) {
        inventoryList.textContent = 'Пусто (покупай паки в магазине)';
    } else {
        inventoryList.innerHTML = playerData.inventory.map(id => {
            const a = aurasConfig.find(item => item.id === id);
            const isEq = playerData.equippedAura === id ? ' [ЭКИПИРОВАНО]' : '';
            return `<button onclick="equipAura('${id}')" style="margin:2px; padding:3px 6px; background:#1e293b; color:#00ffcc; border:1px solid #00ffcc; border-radius:4px; cursor:pointer;">${a.name}${isEq}</button>`;
        }).join(' ');
    }
}

window.equipAura = function(id) {
    playerData.equippedAura = id;
    saveData();
    updateUIStats();
};

function saveData() {
    localStorage.setItem('neon_boxer_name', playerData.name);
    localStorage.setItem('neon_boxer_money', playerData.money);
    localStorage.setItem('neon_boxer_stage', playerData.stage);
    localStorage.setItem('neon_boxer_inv', JSON.stringify(playerData.inventory));
}

// События ввода имени
saveNameBtn.addEventListener('click', () => {
    let name = fighterNameInput.value.trim();
    if (!name) name = "Чемпион";
    playerData.name = name;
    saveData();
    playerDisplayName.textContent = name;
    nameInputSection.classList.add('hidden');
    mainMenuButtons.classList.remove('hidden');
});

changeNameBtn.addEventListener('click', () => {
    mainMenuButtons.classList.add('hidden');
    nameInputSection.classList.remove('hidden');
});

// Магазин паков
openShopBtn.addEventListener('click', () => {
    mainMenuButtons.classList.add('hidden');
    shopSection.classList.remove('hidden');
    updateUIStats();
});

closeShopBtn.addEventListener('click', () => {
    shopSection.classList.add('hidden');
    mainMenuButtons.classList.remove('hidden');
});

buyPackBtn.addEventListener('click', () => {
    if (playerData.money < 50) {
        alert('Недостаточно денег! Побеждайте боссов.');
        return;
    }
    playerData.money -= 50;

    let rand = Math.random();
    let cumulative = 0;
    let wonAura = aurasConfig[0];

    for (let a of aurasConfig) {
        cumulative += a.chance;
        if (rand <= cumulative) {
            wonAura = a;
            break;
        }
    }

    if (!playerData.inventory.includes(wonAura.id)) {
        playerData.inventory.push(wonAura.id);
        if (!playerData.equippedAura) playerData.equippedAura = wonAura.id;
        alert(`Поздравляем! Вам выпала аура: ${wonAura.name}`);
    } else {
        playerData.money += 20;
        alert(`Вам выпала повторная аура ${wonAura.name}. Возврат компенсации: $20`);
    }

    saveData();
    updateUIStats();
});

// Запуск боя с текущим боссом
startFightBtn.addEventListener('click', () => {
    currentBoss = bosses[playerData.stage - 1];
    enemyDisplayName.textContent = currentBoss.name;
    enemy.color = currentBoss.color;
    enemy.glowColor = currentBoss.color;

    player.reset(100);
    enemy.reset(currentBoss.hp);

    particles = [];
    floatingTexts = [];
    gameRunning = true;
    overlay.classList.add('hidden');
});

// Управление клавиатурой
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (!gameRunning) return;
    if (e.code === 'KeyJ' || e.code === 'KeyZ') player.attack('jab');
    if (e.code === 'KeyK' || e.code === 'KeyX') player.attack('hook');
    if (e.code === 'KeyU' || e.code === 'KeyC') player.attack('uppercut');
    if (e.code === 'KeyE') player.toggleAura();
    if (e.code === 'Space') player.dash();
});

window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Кнопки интерфейса
document.getElementById('btn-jab').addEventListener('click', () => { if(gameRunning) player.attack('jab'); });
document.getElementById('btn-hook').addEventListener('click', () => { if(gameRunning) player.attack('hook'); });
document.getElementById('btn-upper').addEventListener('click', () => { if(gameRunning) player.attack('uppercut'); });
document.getElementById('btn-dash').addEventListener('click', () => { if(gameRunning) player.dash(); });
document.getElementById('btn-aura').addEventListener('click', () => { if(gameRunning) player.toggleAura(); });

const blockBtn = document.getElementById('btn-block');
blockBtn.addEventListener('mousedown', () => { keys['KeyS'] = true; });
blockBtn.addEventListener('mouseup', () => { keys['KeyS'] = false; });
blockBtn.addEventListener('touchstart', () => { keys['KeyS'] = true; });
blockBtn.addEventListener('touchend', () => { keys['KeyS'] = false; });

const leftBtn = document.getElementById('btn-left');
leftBtn.addEventListener('mousedown', () => { keys['KeyA'] = true; });
leftBtn.addEventListener('mouseup', () => { keys['KeyA'] = false; });
leftBtn.addEventListener('touchstart', () => { keys['KeyA'] = true; });
leftBtn.addEventListener('touchend', () => { keys['KeyA'] = false; });

const rightBtn = document.getElementById('btn-right');
rightBtn.addEventListener('mousedown', () => { keys['KeyD'] = true; });
rightBtn.addEventListener('mouseup', () => { keys['KeyD'] = false; });
rightBtn.addEventListener('touchstart', () => { keys['KeyD'] = true; });
rightBtn.addEventListener('touchend', () => { keys['KeyD'] = false; });

window.addEventListener('blur', () => {
    keys = {};
});

// Главный игровой цикл
function gameLoop() {
    ctx.save();

    if (shakeTime > 0) {
        shakeTime--;
        const dx = (Math.random() - 0.5) * 10;
        const dy = (Math.random() - 0.5) * 10;
        ctx.translate(dx, dy);
    }

    drawRing();

    if (gameRunning) {
        handlePlayerInput();
        updateAI();
        player.update(enemy);
        enemy.update(player);
        updateHUD();
    }

    player.draw();
    enemy.draw();

    particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.3;
        p.life--;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life / 35);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        if (p.life <= 0) particles.splice(i, 1);
    });
    ctx.globalAlpha = 1;

    floatingTexts.forEach((ft, i) => {
        ft.y -= 1.2;
        ft.life--;
        ctx.font = 'bold 18px Orbitron, sans-serif';
        ctx.fillStyle = ft.color;
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        if (ft.life <= 0) floatingTexts.splice(i, 1);
    });

    ctx.restore();
    requestAnimationFrame(gameLoop);
}

gameLoop();