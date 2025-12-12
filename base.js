// ==================== PROTOTYPE CLASS SYSTEM ====================
const CLASSES = {
    warrior: {
        name: "Tank",
        hp: 110,
        attack: 13,
        defense: 5,
        description: "Tanky mf",
        skills: [
            { name: "Charged Hit", power: 22, type: "charged", cooldown: 3, duration: 0 },
            { name: "Battle Hardened", power: 2, type: "dmgDefBuff", cooldown: 4, duration: 3 }
        ]
    },
    wizard: {
        name: "Glass Cannon",
        hp: 90,
        attack: 15,
        defense: 3,
        description: "High attack, low defense",
        skills: [
            { name: "Fireball", power: 18, type: "attack", cooldown: 2, duration: 0 },
            { name: "Heal", power: 21, type: "heal", cooldown: 3, duration: 0 }
        ]
    }
};

const BIOMES = [
    {
        name: "Test Biome",
        description: "yeah.",
        enemies: ["Enemyone", "Enemytwo", "Enemythree"]
    }
];

// ==================== TWO EMOTIONS NOW ====================
const EMOTIONS = [
    {
        name: "Anger",
        description: "Halves cooldowns and boosts attack when taking damage",
        chargeType: "damage_taken",
        maxCharge: 6,
        cooldown: 4,
        duration: 3,
        effect: (player, enemy) => {
            player.halveAllCooldowns();
            player.applyBuff("attack", 5, 3);
            addLog("ANGER: Cooldowns halved and attack boosted!", 'emotion');
        }
    },
    {
        name: "Focus",
        description: "Deals massive damage based on enemy's missing HP",
        chargeType: "damage_dealt",
        maxCharge: 8,
        cooldown: 5,
        duration: 1,
        effect: (player, enemy) => {
            const missingHP = enemy.maxHealth - enemy.health;
            const damage = Math.floor(missingHP * 0.4) + 15;
            enemy.takeDamage(damage, player);
            addLog(`FOCUS: Dealt ${damage} damage based on enemy's wounds!`, 'emotion');
        }
    }
];

const ENEMIES = {
    Enemyone: {
        name: "Enemyone", level: 1, hp: 50, attack: 11, defense: 2, xp: 35,
        skills: [{ name: "Spear Throw", power: 10, type: "charged", cooldown: 2, duration: 0 }]
    },
    Enemytwo: {
        name: "Enemytwo", level: 1, hp: 55, attack: 9, defense: 3, xp: 35,
        skills: [{ name: "Frenzy", power: 4, type: "multiHit", cooldown: 4, duration: 3 }]
    },
    Enemythree: {
        name: "Enemythree", level: 1, hp: 45, attack: 10, defense: 1, xp: 35,
        skills: [{ name: "Clones", power: 4, type: "multiHit", cooldown: 4, duration: 4 }]
    }
};

const gameState = {
    player: null,
    enemy: null,
    emotionManager: null,
    currentBattle: 1,
    totalBattles: 5,  // EXTENDED TO 5 BATTLES
    currentBiome: null,
    currentBiomeIndex: 0,
    turn: 0,
    playerHealthAtTurnStart: 0,
    enemyHealthAtTurnStart: 0,
    playerDamageDealtThisTurn: 0
};

// ==================== CHARACTER CLASS ====================
class Character {
    constructor(name, hp, attack, defense) {
        this.name = name;
        this.maxHealth = hp;
        this.health = hp;
        this.attack = attack;
        this.defense = defense;
        this.buffs = { attack: 0, defense: 0 };
        this.debuffs = { attack: 0, defense: 0 };
        this.buffDurations = { attack: 0, defense: 0 };
        this.debuffDurations = { attack: 0, defense: 0 };
        this.skills = [];
        this.critChance = 0.1;
        this.chargeTurn = false;
    }

    takeDamage(amount, attacker) {
        if (attacker && Math.random() < 0.055) {
            addLog(`${this.name} missed!`, 'damage');
            showFloatingIndicator(this.name === gameState.player.name ? 'player' : 'enemy', 'MISS', 'damage');
            return 0;
        }

        const totalDefense = this.defense + this.buffs.defense - this.debuffs.defense;
        const reduced = Math.max(1, amount - totalDefense);

        this.health = Math.max(0, this.health - reduced);
        addLog(`${this.name} takes ${reduced} damage. (HP: ${this.health}/${this.maxHealth})`, 'damage');
        showFloatingIndicator(this.name === gameState.player.name ? 'player' : 'enemy', `-${reduced}`, 'damage');

        updateBattleUI();
        return reduced;
    }

    heal(amount) {
        const healed = Math.min(amount, this.maxHealth - this.health);
        this.health = Math.min(this.maxHealth, this.health + amount);
        addLog(`${this.name} heals for ${healed} HP. (HP: ${this.health}/${this.maxHealth})`, 'heal');
        showFloatingIndicator(this.name === gameState.player.name ? 'player' : 'enemy', `+${healed}`, 'heal');
        updateBattleUI();
    }

    performAttack(target) {
        const totalAttack = this.attack + this.buffs.attack - this.debuffs.attack;
        let damage = totalAttack + Math.floor(Math.random() * 5);

        if (Math.random() < this.critChance) {
            damage = Math.floor(damage * 1.5);
            addLog(`${this.name} lands a CRITICAL HIT!`, 'emotion');
            showFloatingIndicator(this.name === gameState.player.name ? 'player' : 'enemy', 'CRIT!', 'buff');
        }

        return target.takeDamage(damage, this);
    }

    applyBuff(type, amount, turns) {
        if (type === 'attack' || type === 'both') {
            this.buffs.attack += amount;
            this.buffDurations.attack = Math.max(this.buffDurations.attack, turns);
        }
        if (type === 'defense' || type === 'both') {
            this.buffs.defense += amount;
            this.buffDurations.defense = Math.max(this.buffDurations.defense, turns);
        }
        addLog(`${this.name} gains +${amount} ${type} for ${turns} turns`, 'heal');
        showFloatingIndicator(this.name === gameState.player.name ? 'player' : 'enemy',
            `+${amount} ${type.toUpperCase()}`, 'buff');
        updateBattleUI();
    }

    updateBuffs() {
        if (this.buffDurations.attack > 0) {
            this.buffDurations.attack--;
            if (this.buffDurations.attack === 0) {
                addLog(`${this.name}'s attack buff wore off!`);
                this.buffs.attack = 0;
            }
        }
        if (this.buffDurations.defense > 0) {
            this.buffDurations.defense--;
            if (this.buffDurations.defense === 0) {
                addLog(`${this.name}'s defense buff wore off!`);
                this.buffs.defense = 0;
            }
        }
    }

    useSkill(skillIndex, target) {
        const skill = this.skills[skillIndex];
        if (skill.currentCooldown > 0) return false;

        addLog(`${this.name} uses ${skill.name}!`, 'emotion');

        const type = skill.type;
        const base = skill.power;
        const totalAttack = this.attack + this.buffs.attack - this.debuffs.attack;

        switch (type) {
            case "attack":
                target.takeDamage(base + totalAttack + Math.floor(Math.random() * 5), this);
                break;
            case "heal":
                this.heal(base);
                break;
            case "dmgDefBuff":
                target.takeDamage(base + totalAttack + Math.floor(Math.random() * 5) + 10, this);
                this.applyBuff("defense", base, skill.duration);
                break;
            case "multiHit":
                for (let i = 0; i < (skill.duration || 3); i++) {
                    target.takeDamage(base + totalAttack + Math.floor(Math.random() * 5), this);
                }
                break;
        }

        skill.currentCooldown = skill.cooldown;
        updateBattleUI();
        return true;
    }
}

// ==================== PLAYER CLASS ====================
class Player extends Character {
    constructor(name, classData) {
        super(name, classData.hp, classData.attack, classData.defense);
        this.className = classData.name;
        this.level = 1;
        this.xp = 0;
        this.skills = classData.skills.map(s => ({ ...s, currentCooldown: 0 }));
    }

    reduceCooldowns() {
        this.skills.forEach(s => {
            if (s.currentCooldown > 0) s.currentCooldown--;
        });
    }

    halveAllCooldowns() {
        addLog(`${this.name} halves all cooldowns!`, 'emotion');
        this.skills.forEach(s => {
            s.currentCooldown = Math.floor(s.currentCooldown / 2);
        });
    }

    gainXP(amount) {
        this.xp += amount;
        addLog(`Gained ${amount} XP!`, 'heal');

        while (this.xp >= this.level * 75) {
            this.xp -= this.level * 75;
            this.level++;
            this.maxHealth += 10;
            this.health += 10;
            this.attack += 2;
            addLog(`LEVEL UP! Now level ${this.level} (+10 HP, +2 ATK)`, 'emotion');
        }
    }
}

// ==================== EMOTION CARD CLASS ====================
class EmotionCard {
    constructor(data) {
        this.name = data.name;
        this.description = data.description;
        this.chargeType = data.chargeType;
        this.maxCharge = data.maxCharge;
        this.cooldown = data.cooldown;
        this.duration = data.duration;
        this.effect = data.effect;
        this.currentCharge = 0;
        this.currentCooldown = 0;
        this.unlocked = false;
        this.active = false;
        this.activeTurns = 0;
    }

    addCharge(amount) {
        if (this.currentCooldown === 0 && !this.active && this.unlocked) {
            this.currentCharge = Math.min(this.maxCharge, this.currentCharge + amount);
            if (this.currentCharge >= this.maxCharge) {
                addLog(`>>> ${this.name} is fully charged! <<<`, 'emotion');
            }
        }
    }

    activate(player, enemy) {
        if (this.currentCharge >= this.maxCharge && this.currentCooldown === 0 && this.unlocked) {
            this.active = true;
            this.activeTurns = this.duration;
            addLog(`\n*** ${this.name.toUpperCase()} ACTIVATED ***`, 'emotion');
            this.effect(player, enemy);
            this.currentCharge = 0;
            this.currentCooldown = this.cooldown;
        }
    }

    updateTurn() {
        if (this.active && this.activeTurns > 0) {
            this.activeTurns--;
            if (this.activeTurns === 0) {
                this.active = false;
                addLog(`(${this.name} effect ended)`, 'emotion');
            }
        }
        if (this.currentCooldown > 0) {
            this.currentCooldown--;
        }
    }
}

// ==================== EMOTION MANAGER CLASS ====================
class EmotionManager {
    constructor(player) {
        this.player = player;
        this.allEmotions = EMOTIONS.map(data => new EmotionCard(data));
        this.activeEmotions = [];
    }

    unlockNextEmotion() {
        for (let emotion of this.allEmotions) {
            if (!emotion.unlocked) {
                emotion.unlocked = true;
                addLog(`*** NEW EMOTION: ${emotion.name} ***`, 'emotion');
                addLog(emotion.description, 'emotion');
                return true;
            }
        }
        return false;
    }

    selectEmotionsForBattle() {
        this.activeEmotions = [];
        const unlocked = this.allEmotions.filter(e => e.unlocked);

        if (unlocked.length === 0) {
            addLog("No emotions available!", 'emotion');
            return;
        }

        this.activeEmotions = [...unlocked];

        const names = this.activeEmotions.map(e => e.name).join(", ");
        addLog(`Emotions: ${names}`, 'emotion');
    }

    onDamageTaken(damage) {
        this.chargeEmotion("damage_taken", 1);
    }

    onDamageDealt(damage) {
        this.chargeEmotion("damage_dealt", 1);
    }

    chargeEmotion(chargeType, amount) {
        for (let emotion of this.activeEmotions) {
            if (emotion.chargeType === chargeType) {
                emotion.addCharge(amount);
            }
        }
    }

    checkAndActivateEmotions(enemy) {
        for (let emotion of this.activeEmotions) {
            if (emotion.currentCharge >= emotion.maxCharge && emotion.currentCooldown === 0) {
                emotion.activate(this.player, enemy);
            }
        }
    }

    updateEmotions() {
        for (let emotion of this.activeEmotions) {
            emotion.updateTurn();
        }
    }

    resetAllCooldowns() {
        for (let emotion of this.allEmotions) {
            emotion.currentCooldown = 0;
        }
        addLog("All emotion cooldowns reset!", 'emotion');
    }
}

// ==================== GAME LOGIC ====================
function startGame() {
    const name = document.getElementById('playerName').value || "Hero";
    const selectedClass = document.querySelector('input[name="class"]:checked');

    if (!selectedClass) {
        alert("Please select a class!");
        return;
    }

    const classData = CLASSES[selectedClass.value];
    gameState.player = new Player(name, classData);
    gameState.emotionManager = new EmotionManager(gameState.player);
    gameState.currentBattle = 1;
    gameState.currentBiomeIndex = 0;
    gameState.currentBiome = BIOMES[0];

    gameState.emotionManager.unlockNextEmotion();

    showScreen('battleScreen');
    startBattle();
}

function startBattle() {
    document.getElementById('battleProgress').textContent =
        `Battle ${gameState.currentBattle} of ${gameState.totalBattles}`;
    const progress = (gameState.currentBattle / gameState.totalBattles) * 100;
    document.getElementById('progressFill').style.width = progress + '%';

    gameState.currentBiome = BIOMES[0];
    document.getElementById('biomeInfo').innerHTML =
        `<h3>${gameState.currentBiome.name}</h3><p>${gameState.currentBiome.description}</p>`;

    gameState.emotionManager.selectEmotionsForBattle();

    const enemyName = gameState.currentBiome.enemies[
        Math.floor(Math.random() * gameState.currentBiome.enemies.length)
        ];
    const enemyData = ENEMIES[enemyName] || ENEMIES.Enemyone;

    const scaledHP = Math.floor(enemyData.hp * (1 + gameState.player.level * 0.12));
    const scaledAtk = enemyData.attack + gameState.player.level;
    const scaledDef = enemyData.defense + Math.floor(gameState.player.level / 2);

    gameState.enemy = new Character(enemyData.name, scaledHP, scaledAtk, scaledDef);
    gameState.enemy.skills = enemyData.skills.map(s => ({ ...s, currentCooldown: 0 }));
    gameState.enemy.xp = enemyData.xp;

    gameState.player.heal(Math.floor(gameState.player.maxHealth * 0.5));

    gameState.turn = 0;
    gameState.playerHealthAtTurnStart = gameState.player.health;
    gameState.enemyHealthAtTurnStart = gameState.enemy.health;

    updateBattleUI();
    addLog(`A wild ${gameState.enemy.name} appears!`, 'emotion');
}

function normalAttack() {
    gameState.playerHealthAtTurnStart = gameState.player.health;
    gameState.enemyHealthAtTurnStart = gameState.enemy.health;

    const damageDealt = gameState.player.performAttack(gameState.enemy);
    gameState.playerDamageDealtThisTurn = damageDealt;

    // Charge damage_dealt emotions (Focus)
    if (damageDealt > 0) {
        gameState.emotionManager.onDamageDealt(damageDealt);
    }

    updateBattleUI();

    if (checkBattleEnd()) return;

    endPlayerTurn();
}

function showSkills() {
    document.getElementById('actionButtons').classList.add('hidden');
    document.getElementById('skillSelection').classList.remove('hidden');

    const skillList = document.getElementById('skillList');
    skillList.innerHTML = '';

    gameState.player.skills.forEach((skill, index) => {
        const btn = document.createElement('button');
        btn.className = 'skill-button';
        btn.style.cursor = 'pointer';
        btn.style.position = 'relative';
        btn.style.zIndex = '10';

        if (skill.currentCooldown === 0) {
            btn.classList.add('clickable');
            btn.style.pointerEvents = 'auto';
        } else {
            btn.classList.add('disabled');
            btn.style.pointerEvents = 'none';
        }

        btn.innerHTML = `
            <strong>${skill.name}</strong><br>
            ${skill.currentCooldown > 0 ?
            `Cooldown: ${skill.currentCooldown}` :
            `Power: ${skill.power} | Type: ${skill.type}`}
        `;

        if (skill.currentCooldown === 0) {
            const skillIdx = index;
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Skill clicked:', skillIdx);
                useSkill(skillIdx);
            });
        }

        skillList.appendChild(btn);
    });
}

function hideSkills() {
    document.getElementById('actionButtons').classList.remove('hidden');
    document.getElementById('skillSelection').classList.add('hidden');
}

function useSkill(skillIndex) {
    if (skillIndex < 0 || skillIndex >= gameState.player.skills.length) {
        console.error("Invalid skill index");
        return;
    }

    const skill = gameState.player.skills[skillIndex];

    if (skill.currentCooldown > 0) {
        addLog(`Skill ${skill.name} is on cooldown!`, 'damage');
        return;
    }

    gameState.playerHealthAtTurnStart = gameState.player.health;
    gameState.enemyHealthAtTurnStart = gameState.enemy.health;

    // Handle charged skills
    if (skill.type === "charged") {
        if (!gameState.player.chargeTurn) {
            gameState.player.chargeTurn = true;
            skill.currentCooldown = skill.cooldown;
            addLog(`${gameState.player.name} is charging ${skill.name}!`, 'emotion');
            hideSkills();
            updateBattleUI();

            if (checkBattleEnd()) return;
            endPlayerTurn();
            return;
        } else {
            const totalAttack = gameState.player.attack + gameState.player.buffs.attack - gameState.player.debuffs.attack;
            const chargedDamage = Math.floor((skill.power + totalAttack + Math.floor(Math.random() * 5)) * 1.3);
            const damageDealt = gameState.enemy.takeDamage(chargedDamage, gameState.player);
            gameState.player.chargeTurn = false;
            gameState.playerDamageDealtThisTurn = damageDealt;
            addLog(`${gameState.player.name} releases charged ${skill.name}!`, 'emotion');

            // Charge damage_dealt emotions
            if (damageDealt > 0) {
                gameState.emotionManager.onDamageDealt(damageDealt);
            }
        }
    } else {
        if (gameState.player.useSkill(skillIndex, gameState.enemy)) {
            const damageDealt = Math.max(0, gameState.enemyHealthAtTurnStart - gameState.enemy.health);
            gameState.playerDamageDealtThisTurn = damageDealt;

            // Charge damage_dealt emotions
            if (damageDealt > 0) {
                gameState.emotionManager.onDamageDealt(damageDealt);
            }
        }
    }

    hideSkills();
    updateBattleUI();

    if (checkBattleEnd()) return;

    endPlayerTurn();
}

function endPlayerTurn() {
    setTimeout(enemyTurn, 1000);
}

function enemyTurn() {
    gameState.turn++;
    addLog(`\n=== Turn ${gameState.turn} ===`, 'emotion');

    const playerHealthBefore = gameState.player.health;

    const availableSkills = gameState.enemy.skills.filter(s => s.currentCooldown === 0);

    if (availableSkills.length > 0 && Math.random() > 0.4) {
        const skill = availableSkills[Math.floor(Math.random() * availableSkills.length)];
        const skillIndex = gameState.enemy.skills.indexOf(skill);
        gameState.enemy.useSkill(skillIndex, gameState.player);
    } else {
        addLog(`${gameState.enemy.name} uses basic attack!`, 'damage');
        gameState.enemy.performAttack(gameState.player);
    }

    const damageTaken = playerHealthBefore - gameState.player.health;
    if (damageTaken > 0) {
        gameState.emotionManager.onDamageTaken(damageTaken);
    }

    gameState.emotionManager.checkAndActivateEmotions(gameState.enemy);

    endEnemyTurn();
}

function endEnemyTurn() {
    gameState.enemy.skills.forEach(s => {
        if (s.currentCooldown > 0) s.currentCooldown--;
    });
    gameState.player.reduceCooldowns();

    gameState.player.updateBuffs();
    gameState.enemy.updateBuffs();

    gameState.emotionManager.updateEmotions();

    updateBattleUI();

    setTimeout(() => {
        if (!checkBattleEnd()) {
            updateEmotionDisplay();
        }
    }, 500);
}

function checkBattleEnd() {
    if (gameState.enemy.health <= 0) {
        addLog('Victory!', 'emotion');
        gameState.player.gainXP(gameState.enemy.xp || 35);

        gameState.currentBattle++;

        if (gameState.currentBattle > gameState.totalBattles) {
            setTimeout(() => showVictoryScreen(), 1500);
            return true;
        }

        // UNLOCK FOCUS AFTER BATTLE 2
        if (gameState.currentBattle === 3) {
            setTimeout(() => {
                gameState.emotionManager.unlockNextEmotion();
                updateBattleUI();
            }, 500);
        }

        setTimeout(() => showPostBattle(), 1500);
        return true;
    }

    if (gameState.player.health <= 0) {
        addLog('Defeat...', 'damage');
        setTimeout(() => showGameOver(), 1500);
        return true;
    }

    return false;
}

function showPostBattle() {
    showScreen('postBattleScreen');

    document.getElementById('rewardInfo').innerHTML = `
        <p>Battle ${gameState.currentBattle - 1} Complete!</p>
        <p>Current HP: ${gameState.player.health}/${gameState.player.maxHealth}</p>
        <p>Level: ${gameState.player.level} | XP: ${gameState.player.xp}</p>
    `;

    const REWARDS = [
        { name: "Quick Rest", description: "Restore 40% HP", effect: "heal40" },
        { name: "Skill Enhancement", description: "Increase random skill power by 15%", effect: "skillEnhance" },
        { name: "Battle Trance", description: "Gain +3 attack for next battle", effect: "battleTrance" }
    ];

    const rewardChoices = document.getElementById('rewardChoices');
    rewardChoices.innerHTML = '';

    REWARDS.forEach((reward) => {
        const card = document.createElement('div');
        card.className = 'choice-card';
        card.innerHTML = `
            <h3>${reward.name}</h3>
            <p>${reward.description}</p>
        `;
        card.onclick = () => selectReward(reward);
        rewardChoices.appendChild(card);
    });
}

function selectReward(reward) {
    switch (reward.effect) {
        case "heal40":
            gameState.player.heal(Math.floor(gameState.player.maxHealth * 0.4));
            break;
        case "skillEnhance":
            const skills = gameState.player.skills;
            if (skills.length > 0) {
                const skill = skills[Math.floor(Math.random() * skills.length)];
                const oldPower = skill.power;
                skill.power = Math.floor(skill.power * 1.15);
                addLog(`${skill.name} upgraded from ${oldPower} to ${skill.power}!`, 'emotion');
            }
            break;
        case "battleTrance":
            gameState.player.applyBuff("attack", 3, 999);
            break;
    }

    startBattle();
    showScreen('battleScreen');
}

function showGameOver() {
    showScreen('gameOverScreen');
    document.getElementById('gameOverInfo').innerHTML = `
        <h2>You were defeated...</h2>
        <p>Battles: ${gameState.currentBattle - 1} / ${gameState.totalBattles}</p>
        <p>Level: ${gameState.player.level}</p>
    `;
}

function showVictoryScreen() {
    showScreen('victoryScreen');
    document.getElementById('victoryInfo').innerHTML = `
        <h2>You completed the prototype!</h2>
        <p>All ${gameState.totalBattles} battles won</p>
        <p>Final Level: ${gameState.player.level}</p>
        <p>Final HP: ${gameState.player.health}/${gameState.player.maxHealth}</p>
        <p style="margin-top: 20px;color: #ffd700">Core mechanics tested successfully! ✓</p>
    `;
}

// ==================== UI FUNCTIONS ====================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function updateBattleUI() {
    document.getElementById('playerStats').innerHTML = `
        <div class="stat-box">
            <div class="stat-label">Level ${gameState.player.level}</div>
            <div class="stat-value">${gameState.player.name}</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">Attack</div>
            <div class="stat-value">${gameState.player.attack + gameState.player.buffs.attack}</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">Defense</div>
            <div class="stat-value">${gameState.player.defense + gameState.player.buffs.defense}</div>
        </div>
    `;

    const playerHPPercent = (gameState.player.health / gameState.player.maxHealth) * 100;
    document.getElementById('playerHPFill').style.width = playerHPPercent + '%';
    document.getElementById('playerHPText').textContent =
        `${gameState.player.health}/${gameState.player.maxHealth}`;

    let playerStatusHTML = '';
    if (gameState.player.buffs.attack > 0) {
        playerStatusHTML += `<span class="status-effect buff">ATK+${gameState.player.buffs.attack}(${gameState.player.buffDurations.attack})</span>`;
    }
    if (gameState.player.buffs.defense > 0) {
        playerStatusHTML += `<span class="status-effect buff">DEF+${gameState.player.buffs.defense}(${gameState.player.buffDurations.defense})</span>`;
    }
    document.getElementById('playerStatuses').innerHTML = playerStatusHTML;

    document.getElementById('enemyStats').innerHTML = `
        <div class="stat-box">
            <div class="stat-label">Enemy</div>
            <div class="stat-value">${gameState.enemy.name}</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">Attack</div>
            <div class="stat-value">${gameState.enemy.attack}</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">Defense</div>
            <div class="stat-value">${gameState.enemy.defense}</div>
        </div>
    `;

    const enemyHPPercent = (gameState.enemy.health / gameState.enemy.maxHealth) * 100;
    document.getElementById('enemyHPFill').style.width = enemyHPPercent + '%';
    document.getElementById('enemyHPText').textContent =
        `${gameState.enemy.health}/${gameState.enemy.maxHealth}`;

    let enemyStatusHTML = '';
    if (gameState.enemy.buffs.attack > 0) {
        enemyStatusHTML += `<span class="status-effect buff">ATK+${gameState.enemy.buffs.attack}</span>`;
    }
    document.getElementById('enemyStatuses').innerHTML = enemyStatusHTML;

    updateEmotionDisplay();
}

const ANGER_IMAGES = {
    0: 'https://i.ibb.co/ZzyN2ykh/Untitled665-20251130152427.png',
    1: 'https://i.ibb.co/LDzmwD5y/pic.png',
    2: 'https://i.ibb.co/kg1128Wm/pic2.png',
    3: 'https://i.ibb.co/CsVDK0HB/pic3.png',
    4: 'https://i.ibb.co/b597PpRy/pic4.png',
    5: 'https://i.ibb.co/pkR87wm/pic5.png',
    active: 'https://i.ibb.co/290CrS7/pic6.png',
}

function updateEmotionDisplay() {
    const emotionDiv = document.getElementById('emotionDisplay');

    if (!gameState.emotionManager || gameState.emotionManager.activeEmotions.length === 0) {
        emotionDiv.innerHTML = '<p style="color: #a0aec0">No emotions equipped</p>';
        return;
    }

    emotionDiv.innerHTML = '';

    gameState.emotionManager.activeEmotions.forEach(emotion => {
        if (!emotion.unlocked) return;

        const card = document.createElement('div');
        let className = 'emotion-card';

        if (emotion.active) {
            className += ' active';
        } else if (emotion.currentCooldown > 0) {
            className += ' cooldown';
        } else if (emotion.currentCharge >= emotion.maxCharge) {
            className += ' charged';
        }

        card.className = className;

        let statusText = '';
        if (emotion.active) {
            statusText = `[ACTIVE: ${emotion.activeTurns} turns]`;
        } else if (emotion.currentCooldown > 0) {
            statusText = `[CD: ${emotion.currentCooldown}]`;
        } else {
            statusText = `[${emotion.currentCharge}/${emotion.maxCharge}]`;
        }

        let visualHTML = '';
        if (emotion.name === "Anger") {
            let imageUrl;
            if (emotion.active) {
                imageUrl = ANGER_IMAGES.active;
            } else {
                imageUrl = ANGER_IMAGES[emotion.currentCharge] || ANGER_IMAGES[0];
            }

            visualHTML = `
                <div class="emotion-visual">
                    <img src="${imageUrl}" alt="Anger ${emotion.currentCharge}/${emotion.maxCharge}">
                </div>
            `;
        } else if (emotion.name === "Focus") {
            // Different visual for Focus emotion
            const focusColor = emotion.active ? '#50cdff' : emotion.currentCharge >= emotion.maxCharge ? '#ffcd50' : '#667eea';
            visualHTML = `
                <div class="emotion-visual" style="display: flex; align-items: center; justify-content: center; width: 70px; height: 70px; background: linear-gradient(135deg, ${focusColor}22, ${focusColor}44); border-radius: 12px; border: 3px solid ${focusColor};">
                    <span style="font-size: 2em;">🎯</span>
                </div>
            `;
        }

        card.innerHTML = `
            ${visualHTML}
            <strong style="margin-top: 10px">${emotion.name}</strong> ${statusText}<br>
            <small>${emotion.description}</small>
        `;

        if (emotion.currentCharge >= emotion.maxCharge && emotion.currentCooldown === 0 && !emotion.active) {
            card.onclick = () => {
                emotion.activate(gameState.player, gameState.enemy);
                updateBattleUI();
            };
        }

        emotionDiv.appendChild(card);
    });
}

function addLog(message, type = '') {
    const logDiv = document.getElementById('battleLog');
    const entry = document.createElement('div');
    entry.className = 'log-entry ' + type;
    entry.textContent = message;
    logDiv.appendChild(entry);
    logDiv.scrollTop = logDiv.scrollHeight;

    while (logDiv.children.length > 30) {
        logDiv.removeChild(logDiv.firstChild);
    }
}

function showFloatingIndicator(target, text, type) {
    const section = document.getElementById(target === 'player' ? 'playerSection' : 'enemySection');
    if (!section) return;

    const indicator = document.createElement('div');
    indicator.className = `floating-indicator ${type}`;
    indicator.textContent = text;

    indicator.style.position = 'absolute';
    indicator.style.left = `${Math.random() * 60 + 20}%`;
    indicator.style.top = '40%';
    indicator.style.zIndex = '1000';

    section.style.position = 'relative';
    section.appendChild(indicator);

    setTimeout(() => {
        if (indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
        }
    }, 1500);
}

// ==================== INITIALIZATION ====================
function skipIntro() {
    const intro = document.getElementById('introScreen');
    intro.style.animation = 'introFadeOut 0.5s ease-in-out forwards';
    setTimeout(() => {
        intro.style.display = 'none';
        showScreen('startScreen');
    }, 500);
}

var textArray = ["Sup",
    "Bazinga",
    "Wonder if elephants can fly...",
    "Insert Text Here",
    "Testing core mechanics: Combat • Emotions • Leveling",
    "Hi im the text",
    "NOW WITH 5 BATTLES AND 2 EMOTIONS!",
    "Skills actually work now!"];

function randomText() {
    var randomIndex = Math.floor(Math.random() * textArray.length);
    var textElement = document.getElementById('randomText');
    if (textElement) {
        textElement.textContent = textArray[randomIndex];
    }
}

randomText();

function showStory() {
    document.getElementById('storyModal').style.display = 'flex';
}

function closeStory() {
    document.getElementById('storyModal').style.display = 'none';
}

function initializeClassSelection() {
    const classDiv = document.getElementById('classSelection');
    classDiv.innerHTML = '';

    Object.keys(CLASSES).forEach(key => {
        const classData = CLASSES[key];
        const label = document.createElement('label');
        label.className = 'class-card';
        label.innerHTML = `
            <input type="radio" name="class" value="${key}">
            <div class="class-name">${classData.name}</div>
            <div class="class-desc">${classData.description}</div>
            <div class="class-stats">
                <span>HP: ${classData.hp}</span>
                <span>ATK: ${classData.attack}</span>
                <span>DEF: ${classData.defense}</span>
            </div>
        `;

        label.addEventListener('click', function () {
            document.querySelectorAll('.class-card').forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            this.querySelector('input[type="radio"]').checked = true;
        });

        classDiv.appendChild(label);
    });

    const firstCard = classDiv.querySelector('.class-card');
    if (firstCard) {
        firstCard.classList.add('selected');
        firstCard.querySelector('input[type="radio"]').checked = true;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    randomText();
    initializeClassSelection();

    setTimeout(() => {
        const intro = document.getElementById('introScreen');
        if (intro) {
            intro.style.display = 'none';
        }
        showScreen('startScreen');
    }, 9000);
});
