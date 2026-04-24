const DIFFICULTY_CONFIG = {
    beginner: {
        name: '新手模式',
        rows: 4,
        cols: 5,
        timeLimit: 0,
        baseScore: 10,
        numberRange: [1, 5]
    },
    intermediate: {
        name: '进阶模式',
        rows: 5,
        cols: 6,
        timeLimit: 180,
        baseScore: 15,
        numberRange: [1, 7]
    },
    challenge: {
        name: '挑战模式',
        rows: 6,
        cols: 8,
        timeLimit: 240,
        baseScore: 20,
        numberRange: [1, 9]
    }
};

let gameState = {
    difficulty: 'beginner',
    level: 1,
    score: 0,
    combo: 0,
    maxCombo: 0,
    timeLeft: 0,
    timerInterval: null,
    selectedCard: null,
    board: [],
    eliminated: new Set(),
    isPaused: false,
    isAnimating: false,
    startTime: 0,
    elapsedTime: 0
};

let playerData = {
    totalPoints: 0,
    totalWins: 0,
    totalGames: 0,
    highScore: 0,
    highCombo: 0,
    items: {
        hint: 3,
        time: 2
    },
    recentGames: [],
    dailyMissions: {},
    lastLoginDate: null
};

function init() {
    loadPlayerData();
    checkDailyReset();
}

function loadPlayerData() {
    const saved = localStorage.getItem('numberDisappearData');
    if (saved) {
        playerData = { ...playerData, ...JSON.parse(saved) };
    }
}

function savePlayerData() {
    localStorage.setItem('numberDisappearData', JSON.stringify(playerData));
}

function checkDailyReset() {
    const today = new Date().toDateString();
    if (playerData.lastLoginDate !== today) {
        playerData.dailyMissions = generateDailyMissions();
        playerData.lastLoginDate = today;
        savePlayerData();
    }
}

function generateDailyMissions() {
    return [
        { id: 'win_3', name: '通关3局', target: 3, current: 0, reward: 100, type: 'win' },
        { id: 'score_500', name: '累计获得500积分', target: 500, current: 0, reward: 150, type: 'score' },
        { id: 'combo_5', name: '单局最高连击达到5', target: 5, current: 0, reward: 200, type: 'combo' }
    ];
}

function updateDailyMission(type, value) {
    playerData.dailyMissions.forEach(mission => {
        if (mission.type === type && mission.current < mission.target) {
            if (type === 'combo') {
                mission.current = Math.max(mission.current, value);
            } else {
                mission.current += value;
            }
        }
    });
    savePlayerData();
}

function startGame(difficulty) {
    gameState.difficulty = difficulty;
    gameState.level = 1;
    gameState.score = 0;
    gameState.combo = 0;
    gameState.maxCombo = 0;
    gameState.selectedCard = null;
    gameState.eliminated = new Set();
    gameState.isPaused = false;
    gameState.isAnimating = false;
    gameState.startTime = Date.now();
    gameState.elapsedTime = 0;
    
    const config = DIFFICULTY_CONFIG[difficulty];
    gameState.timeLeft = config.timeLimit;
    
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    
    updateGameDisplay();
    generateBoard();
    
    if (config.timeLimit > 0) {
        document.getElementById('timer-container').classList.remove('hidden');
        document.getElementById('timer-bar-container').classList.remove('hidden');
        document.getElementById('time-bonus-btn').classList.remove('hidden');
        startTimer();
    } else {
        document.getElementById('timer-container').classList.add('hidden');
        document.getElementById('timer-bar-container').classList.add('hidden');
        document.getElementById('time-bonus-btn').classList.add('hidden');
    }
}

function generateBoard() {
    const config = DIFFICULTY_CONFIG[gameState.difficulty];
    const rows = config.rows + Math.floor(gameState.level / 3);
    const cols = config.cols + Math.floor(gameState.level / 5);
    const totalCells = rows * cols;
    const pairs = Math.floor(totalCells / 2);
    
    const numbers = [];
    const [minNum, maxNum] = config.numberRange;
    
    for (let i = 0; i < pairs; i++) {
        const num = minNum + Math.floor(Math.random() * (maxNum - minNum + 1));
        numbers.push(num, num);
    }
    
    for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    
    gameState.board = [];
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
            const idx = r * cols + c;
            if (idx < numbers.length) {
                row.push(numbers[idx]);
            } else {
                row.push(0);
            }
        }
        gameState.board.push(row);
    }
    
    gameState.eliminated = new Set();
    renderBoard();
    updateRemainingCount();
}

function renderBoard() {
    const boardEl = document.getElementById('game-board');
    const rows = gameState.board.length;
    const cols = gameState.board[0].length;
    
    const cardSize = Math.min(60, Math.floor(Math.min(window.innerWidth - 40, window.innerHeight - 300) / Math.max(rows, cols)));
    
    boardEl.style.display = 'grid';
    boardEl.style.gridTemplateColumns = `repeat(${cols}, ${cardSize}px)`;
    boardEl.style.gridTemplateRows = `repeat(${rows}, ${cardSize}px)`;
    boardEl.style.gap = '8px';
    
    boardEl.innerHTML = '';
    
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const value = gameState.board[r][c];
            const key = `${r},${c}`;
            const isEliminated = gameState.eliminated.has(key);
            
            const card = document.createElement('div');
            card.className = `number-card rounded-lg flex items-center justify-center text-2xl font-bold cursor-pointer shadow-lg`;
            card.style.width = `${cardSize}px`;
            card.style.height = `${cardSize}px`;
            card.dataset.row = r;
            card.dataset.col = c;
            card.dataset.value = value;
            
            if (value === 0 || isEliminated) {
                card.style.visibility = 'hidden';
            } else {
                card.classList.add(`number-${value}`);
                card.textContent = value;
                card.addEventListener('click', () => handleCardClick(r, c));
            }
            
            boardEl.appendChild(card);
        }
    }
}

function handleCardClick(row, col) {
    if (gameState.isPaused || gameState.isAnimating) return;
    
    const key = `${row},${col}`;
    if (gameState.eliminated.has(key)) return;
    
    const cards = document.querySelectorAll('.number-card');
    const clickedCard = Array.from(cards).find(c => 
        parseInt(c.dataset.row) === row && parseInt(c.dataset.col) === col
    );
    
    if (gameState.selectedCard === null) {
        gameState.selectedCard = { row, col, value: gameState.board[row][col] };
        clickedCard.classList.add('selected');
        playSound('select');
    } else {
        const { row: r1, col: c1, value: v1 } = gameState.selectedCard;
        
        if (r1 === row && c1 === col) {
            const prevCard = Array.from(cards).find(c => 
                parseInt(c.dataset.row) === r1 && parseInt(c.dataset.col) === c1
            );
            prevCard.classList.remove('selected');
            gameState.selectedCard = null;
            return;
        }
        
        const v2 = gameState.board[row][col];
        
        if (v1 === v2 && canConnect(r1, c1, row, col)) {
            gameState.isAnimating = true;
            
            const path = findPath(r1, c1, row, col);
            showConnectionPath(path);
            
            gameState.eliminated.add(`${r1},${c1}`);
            gameState.eliminated.add(`${row},${col}`);
            
            setTimeout(() => {
                eliminateCards(r1, c1, row, col);
            }, 300);
            
            gameState.combo++;
            if (gameState.combo > gameState.maxCombo) {
                gameState.maxCombo = gameState.combo;
            }
            
            const config = DIFFICULTY_CONFIG[gameState.difficulty];
            const points = config.baseScore * gameState.combo;
            gameState.score += points;
            
            showScorePopup(row, col, points);
            
            if (gameState.combo >= 3) {
                triggerComboEffect(row, col);
            }
            
            updateGameDisplay();
            playSound('match');
            
            setTimeout(() => {
                checkWinCondition();
                gameState.isAnimating = false;
            }, 700);
            
        } else {
            gameState.combo = 0;
            updateGameDisplay();
            
            const prevCard = Array.from(cards).find(c => 
                parseInt(c.dataset.row) === r1 && parseInt(c.dataset.col) === c1
            );
            prevCard.classList.remove('selected');
            prevCard.classList.add('shake');
            clickedCard.classList.add('shake');
            
            setTimeout(() => {
                prevCard.classList.remove('shake');
                clickedCard.classList.remove('shake');
            }, 300);
            
            playSound('error');
        }
        
        gameState.selectedCard = null;
    }
}

function canConnect(r1, c1, r2, c2) {
    return findPath(r1, c1, r2, c2) !== null;
}

function findPath(r1, c1, r2, c2) {
    const rows = gameState.board.length;
    const cols = gameState.board[0].length;
    
    const path0 = checkStraightLine(r1, c1, r2, c2);
    if (path0) return path0;
    
    const path0d = checkDiagonalLine(r1, c1, r2, c2);
    if (path0d) return path0d;
    
    const path1 = checkOneCorner(r1, c1, r2, c2);
    if (path1) return path1;
    
    const path2 = checkTwoCorners(r1, c1, r2, c2);
    if (path2) return path2;
    
    return null;
}

function checkStraightLine(r1, c1, r2, c2) {
    if (r1 !== r2 && c1 !== c2) {
        return null;
    }
    
    if (isPathBetweenEmpty(r1, c1, r2, c2)) {
        return [[r1, c1], [r2, c2]];
    }
    
    return null;
}

function checkDiagonalLine(r1, c1, r2, c2) {
    if (Math.abs(r1 - r2) !== Math.abs(c1 - c2)) {
        return null;
    }
    
    if (isDiagonalPathEmpty(r1, c1, r2, c2)) {
        return [[r1, c1], [r2, c2]];
    }
    
    return null;
}

function checkOneCorner(r1, c1, r2, c2) {
    const rows = gameState.board.length;
    const cols = gameState.board[0].length;
    
    const corner1 = { r: r1, c: c2 };
    if (isCellPassable(corner1.r, corner1.c)) {
        if (isPathBetweenEmpty(r1, c1, corner1.r, corner1.c) &&
            isPathBetweenEmpty(corner1.r, corner1.c, r2, c2)) {
            return [[r1, c1], [corner1.r, corner1.c], [r2, c2]];
        }
    }
    
    const corner2 = { r: r2, c: c1 };
    if (isCellPassable(corner2.r, corner2.c)) {
        if (isPathBetweenEmpty(r1, c1, corner2.r, corner2.c) &&
            isPathBetweenEmpty(corner2.r, corner2.c, r2, c2)) {
            return [[r1, c1], [corner2.r, corner2.c], [r2, c2]];
        }
    }
    
    for (let c = -1; c <= cols; c++) {
        if (c === c1 && c === c2) continue;
        
        const point1 = { r: r1, c: c };
        const point2 = { r: r2, c: c };
        
        if (isCellPassable(point1.r, point1.c) && isCellPassable(point2.r, point2.c)) {
            if (isPathBetweenEmpty(r1, c1, point1.r, point1.c) &&
                isPathBetweenEmpty(point1.r, point1.c, point2.r, point2.c) &&
                isPathBetweenEmpty(point2.r, point2.c, r2, c2)) {
                return [[r1, c1], [point1.r, point1.c], [point2.r, point2.c], [r2, c2]];
            }
        }
    }
    
    for (let r = -1; r <= rows; r++) {
        if (r === r1 && r === r2) continue;
        
        const point1 = { r: r, c: c1 };
        const point2 = { r: r, c: c2 };
        
        if (isCellPassable(point1.r, point1.c) && isCellPassable(point2.r, point2.c)) {
            if (isPathBetweenEmpty(r1, c1, point1.r, point1.c) &&
                isPathBetweenEmpty(point1.r, point1.c, point2.r, point2.c) &&
                isPathBetweenEmpty(point2.r, point2.c, r2, c2)) {
                return [[r1, c1], [point1.r, point1.c], [point2.r, point2.c], [r2, c2]];
            }
        }
    }
    
    return null;
}

function checkTwoCorners(r1, c1, r2, c2) {
    const rows = gameState.board.length;
    const cols = gameState.board[0].length;
    
    for (let c = -1; c <= cols; c++) {
        const p1 = { r: r1, c: c };
        if (!isPathBetweenEmpty(r1, c1, p1.r, p1.c)) continue;
        if (!isCellPassable(p1.r, p1.c)) continue;
        
        for (let r = -1; r <= rows; r++) {
            const p2 = { r: r, c: c };
            const p3 = { r: r, c: c2 };
            
            if (isCellPassable(p2.r, p2.c) && isCellPassable(p3.r, p3.c)) {
                if (isPathBetweenEmpty(p1.r, p1.c, p2.r, p2.c) &&
                    isPathBetweenEmpty(p2.r, p2.c, p3.r, p3.c) &&
                    isPathBetweenEmpty(p3.r, p3.c, r2, c2)) {
                    return [[r1, c1], [p1.r, p1.c], [p2.r, p2.c], [p3.r, p3.c], [r2, c2]];
                }
            }
        }
    }
    
    for (let r = -1; r <= rows; r++) {
        const p1 = { r: r, c: c1 };
        if (!isPathBetweenEmpty(r1, c1, p1.r, p1.c)) continue;
        if (!isCellPassable(p1.r, p1.c)) continue;
        
        for (let c = -1; c <= cols; c++) {
            const p2 = { r: r, c: c };
            const p3 = { r: r2, c: c };
            
            if (isCellPassable(p2.r, p2.c) && isCellPassable(p3.r, p3.c)) {
                if (isPathBetweenEmpty(p1.r, p1.c, p2.r, p2.c) &&
                    isPathBetweenEmpty(p2.r, p2.c, p3.r, p3.c) &&
                    isPathBetweenEmpty(p3.r, p3.c, r2, c2)) {
                    return [[r1, c1], [p1.r, p1.c], [p2.r, p2.c], [p3.r, p3.c], [r2, c2]];
                }
            }
        }
    }
    
    return null;
}

function isPathBetweenEmpty(r1, c1, r2, c2) {
    const rows = gameState.board.length;
    const cols = gameState.board[0].length;
    
    if (r1 === r2) {
        const minC = Math.min(c1, c2);
        const maxC = Math.max(c1, c2);
        
        for (let c = minC + 1; c < maxC; c++) {
            if (c >= 0 && c < cols && r1 >= 0 && r1 < rows) {
                const key = `${r1},${c}`;
                if (gameState.board[r1][c] !== 0 && !gameState.eliminated.has(key)) {
                    return false;
                }
            }
        }
        return true;
    }
    
    if (c1 === c2) {
        const minR = Math.min(r1, r2);
        const maxR = Math.max(r1, r2);
        
        for (let r = minR + 1; r < maxR; r++) {
            if (r >= 0 && r < rows && c1 >= 0 && c1 < cols) {
                const key = `${r},${c1}`;
                if (gameState.board[r][c1] !== 0 && !gameState.eliminated.has(key)) {
                    return false;
                }
            }
        }
        return true;
    }
    
    return false;
}

function isDiagonalPathEmpty(r1, c1, r2, c2) {
    if (Math.abs(r1 - r2) !== Math.abs(c1 - c2)) {
        return false;
    }
    
    const rows = gameState.board.length;
    const cols = gameState.board[0].length;
    
    const dr = r2 > r1 ? 1 : -1;
    const dc = c2 > c1 ? 1 : -1;
    
    let r = r1 + dr;
    let c = c1 + dc;
    
    while (r !== r2 && c !== c2) {
        if (r >= 0 && r < rows && c >= 0 && c < cols) {
            const key = `${r},${c}`;
            if (gameState.board[r][c] !== 0 && !gameState.eliminated.has(key)) {
                return false;
            }
        }
        r += dr;
        c += dc;
    }
    
    return true;
}

function isCellPassable(r, c) {
    const rows = gameState.board.length;
    const cols = gameState.board[0].length;
    
    if (r < 0 || r >= rows || c < 0 || c >= cols) {
        return true;
    }
    
    if (gameState.board[r][c] === 0) {
        return true;
    }
    
    if (gameState.eliminated.has(`${r},${c}`)) {
        return true;
    }
    
    return false;
}

function showConnectionPath(path) {
    if (!path) return;
    
    const boardEl = document.getElementById('game-board');
    const cards = boardEl.querySelectorAll('.number-card');
    
    path.forEach((point, index) => {
        if (index > 0) {
            const prevPoint = path[index - 1];
            const card1 = Array.from(cards).find(c => 
                parseInt(c.dataset.row) === prevPoint[0] && parseInt(c.dataset.col) === prevPoint[1]
            );
            const card2 = Array.from(cards).find(c => 
                parseInt(c.dataset.row) === point[0] && parseInt(c.dataset.col) === point[1]
            );
            
            if (card1 && card2) {
                const rect1 = card1.getBoundingClientRect();
                const rect2 = card2.getBoundingClientRect();
                const boardRect = boardEl.getBoundingClientRect();
                
                const line = document.createElement('div');
                line.className = 'path-line';
                
                const x1 = rect1.left + rect1.width / 2 - boardRect.left;
                const y1 = rect1.top + rect1.height / 2 - boardRect.top;
                const x2 = rect2.left + rect2.width / 2 - boardRect.left;
                const y2 = rect2.top + rect2.height / 2 - boardRect.top;
                
                const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
                const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
                
                line.style.width = `${length}px`;
                line.style.height = '4px';
                line.style.left = `${x1}px`;
                line.style.top = `${y1 - 2}px`;
                line.style.transform = `rotate(${angle}deg)`;
                line.style.transformOrigin = '0 50%';
                
                boardEl.appendChild(line);
                
                setTimeout(() => line.remove(), 500);
            }
        }
    });
}

function eliminateCards(r1, c1, r2, c2) {
    const cards = document.querySelectorAll('.number-card');
    
    const card1 = Array.from(cards).find(c => 
        parseInt(c.dataset.row) === r1 && parseInt(c.dataset.col) === c1
    );
    const card2 = Array.from(cards).find(c => 
        parseInt(c.dataset.row) === r2 && parseInt(c.dataset.col) === c2
    );
    
    if (card1) {
        card1.classList.remove('selected');
        card1.classList.add('eliminated');
        createSparkles(card1);
    }
    if (card2) {
        card2.classList.add('eliminated');
        createSparkles(card2);
    }
    
    updateRemainingCount();
}

function createSparkles(card) {
    const container = document.getElementById('effects-container');
    const rect = card.getBoundingClientRect();
    
    for (let i = 0; i < 8; i++) {
        const sparkle = document.createElement('div');
        sparkle.className = 'sparkle';
        
        const angle = (i / 8) * Math.PI * 2;
        const distance = 30 + Math.random() * 20;
        const x = rect.left + rect.width / 2 + Math.cos(angle) * distance;
        const y = rect.top + rect.height / 2 + Math.sin(angle) * distance;
        
        sparkle.style.left = `${x}px`;
        sparkle.style.top = `${y}px`;
        
        container.appendChild(sparkle);
        
        setTimeout(() => sparkle.remove(), 1000);
    }
}

function showScorePopup(row, col, points) {
    const cards = document.querySelectorAll('.number-card');
    const card = Array.from(cards).find(c => 
        parseInt(c.dataset.row) === row && parseInt(c.dataset.col) === col
    );
    
    if (!card) return;
    
    const rect = card.getBoundingClientRect();
    const popup = document.createElement('div');
    popup.className = 'score-popup fixed text-2xl font-bold text-yellow-300 z-50';
    popup.style.left = `${rect.left + rect.width / 2}px`;
    popup.style.top = `${rect.top}px`;
    popup.textContent = `+${points}`;
    
    document.body.appendChild(popup);
    
    setTimeout(() => popup.remove(), 1000);
}

function triggerComboEffect(row, col) {
    const cards = document.querySelectorAll('.number-card');
    const card = Array.from(cards).find(c => 
        parseInt(c.dataset.row) === row && parseInt(c.dataset.col) === col
    );
    
    if (card) {
        card.classList.add('combo-effect');
    }
}

function checkWinCondition() {
    const rows = gameState.board.length;
    const cols = gameState.board[0].length;
    
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (gameState.board[r][c] !== 0 && !gameState.eliminated.has(`${r},${c}`)) {
                const hasMatch = findMatchingPair(r, c);
                if (hasMatch) {
                    return;
                }
            }
        }
    }
    
    const remaining = getRemainingCount();
    if (remaining === 0) {
        gameWin();
    } else {
        shuffleBoard();
    }
}

function findMatchingPair(r1, c1) {
    const rows = gameState.board.length;
    const cols = gameState.board[0].length;
    const value = gameState.board[r1][c1];
    
    for (let r2 = 0; r2 < rows; r2++) {
        for (let c2 = 0; c2 < cols; c2++) {
            if (r1 === r2 && c1 === c2) continue;
            if (gameState.board[r2][c2] === value && !gameState.eliminated.has(`${r2},${c2}`)) {
                if (canConnect(r1, c1, r2, c2)) {
                    return { r1, c1, r2, c2 };
                }
            }
        }
    }
    return null;
}

function shuffleBoard() {
    const rows = gameState.board.length;
    const cols = gameState.board[0].length;
    
    const activeCards = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (gameState.board[r][c] !== 0 && !gameState.eliminated.has(`${r},${c}`)) {
                activeCards.push({ r, c, value: gameState.board[r][c] });
            }
        }
    }
    
    const values = activeCards.map(c => c.value);
    for (let i = values.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [values[i], values[j]] = [values[j], values[i]];
    }
    
    activeCards.forEach((card, index) => {
        gameState.board[card.r][card.c] = values[index];
    });
    
    renderBoard();
    
    const notification = document.createElement('div');
    notification.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-yellow-500 text-white px-6 py-3 rounded-xl text-xl font-bold z-50';
    notification.textContent = '🔄 无法匹配，重新洗牌！';
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 2000);
    
    setTimeout(() => {
        checkWinCondition();
    }, 2500);
}

function getRemainingCount() {
    const rows = gameState.board.length;
    const cols = gameState.board[0].length;
    let count = 0;
    
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (gameState.board[r][c] !== 0 && !gameState.eliminated.has(`${r},${c}`)) {
                count++;
            }
        }
    }
    
    return count;
}

function updateRemainingCount() {
    document.getElementById('remaining-count').textContent = getRemainingCount();
}

function gameWin() {
    stopTimer();
    gameState.elapsedTime = Math.floor((Date.now() - gameState.startTime) / 1000);
    
    playerData.totalGames++;
    playerData.totalWins++;
    playerData.totalPoints += gameState.score;
    
    if (gameState.score > playerData.highScore) {
        playerData.highScore = gameState.score;
    }
    if (gameState.maxCombo > playerData.highCombo) {
        playerData.highCombo = gameState.maxCombo;
    }
    
    playerData.recentGames.unshift({
        date: new Date().toLocaleString(),
        difficulty: DIFFICULTY_CONFIG[gameState.difficulty].name,
        score: gameState.score,
        combo: gameState.maxCombo,
        won: true
    });
    if (playerData.recentGames.length > 10) {
        playerData.recentGames.pop();
    }
    
    updateDailyMission('win', 1);
    updateDailyMission('score', gameState.score);
    updateDailyMission('combo', gameState.maxCombo);
    
    savePlayerData();
    
    document.getElementById('win-level').textContent = `第 ${gameState.level} 关`;
    document.getElementById('win-score').textContent = gameState.score;
    document.getElementById('win-combo').textContent = gameState.maxCombo;
    document.getElementById('win-time').textContent = formatTime(gameState.elapsedTime);
    
    document.getElementById('win-modal').classList.remove('hidden');
    
    playSound('win');
}

function gameLose() {
    stopTimer();
    gameState.elapsedTime = Math.floor((Date.now() - gameState.startTime) / 1000);
    
    playerData.totalGames++;
    
    if (gameState.score > playerData.highScore) {
        playerData.highScore = gameState.score;
    }
    if (gameState.maxCombo > playerData.highCombo) {
        playerData.highCombo = gameState.maxCombo;
    }
    
    playerData.recentGames.unshift({
        date: new Date().toLocaleString(),
        difficulty: DIFFICULTY_CONFIG[gameState.difficulty].name,
        score: gameState.score,
        combo: gameState.maxCombo,
        won: false
    });
    if (playerData.recentGames.length > 10) {
        playerData.recentGames.pop();
    }
    
    updateDailyMission('score', gameState.score);
    updateDailyMission('combo', gameState.maxCombo);
    
    savePlayerData();
    
    document.getElementById('lose-score').textContent = gameState.score;
    document.getElementById('lose-combo').textContent = gameState.maxCombo;
    
    document.getElementById('lose-modal').classList.remove('hidden');
    
    playSound('lose');
}

function nextLevel() {
    closeModal('win-modal');
    gameState.level++;
    gameState.score = 0;
    gameState.combo = 0;
    gameState.maxCombo = 0;
    gameState.selectedCard = null;
    gameState.eliminated = new Set();
    gameState.startTime = Date.now();
    
    const config = DIFFICULTY_CONFIG[gameState.difficulty];
    gameState.timeLeft = config.timeLimit;
    
    updateGameDisplay();
    generateBoard();
    
    if (config.timeLimit > 0) {
        startTimer();
    }
}

function startTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
    }
    
    gameState.timerInterval = setInterval(() => {
        if (gameState.isPaused) return;
        
        gameState.timeLeft--;
        updateTimerDisplay();
        
        if (gameState.timeLeft <= 0) {
            gameLose();
        }
    }, 1000);
}

function stopTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
}

function updateTimerDisplay() {
    const config = DIFFICULTY_CONFIG[gameState.difficulty];
    const totalTime = config.timeLimit;
    const percentage = (gameState.timeLeft / totalTime) * 100;
    
    document.getElementById('timer-display').textContent = formatTime(gameState.timeLeft);
    document.getElementById('timer-bar').style.width = `${percentage}%`;
    
    const timerBar = document.getElementById('timer-bar');
    if (percentage <= 20) {
        timerBar.className = 'progress-bar h-full bg-gradient-to-r from-red-400 to-red-500';
    } else if (percentage <= 50) {
        timerBar.className = 'progress-bar h-full bg-gradient-to-r from-yellow-400 to-yellow-500';
    } else {
        timerBar.className = 'progress-bar h-full bg-gradient-to-r from-green-400 to-green-500';
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateGameDisplay() {
    document.getElementById('level-display').textContent = `第 ${gameState.level} 关`;
    document.getElementById('difficulty-display').textContent = DIFFICULTY_CONFIG[gameState.difficulty].name;
    document.getElementById('score-display').textContent = gameState.score;
    document.getElementById('combo-display').textContent = gameState.combo;
    document.getElementById('hint-count').textContent = playerData.items.hint;
    document.getElementById('time-bonus-count').textContent = playerData.items.time;
}

function showPauseMenu() {
    gameState.isPaused = true;
    document.getElementById('pause-modal').classList.remove('hidden');
}

function resumeGame() {
    gameState.isPaused = false;
    closeModal('pause-modal');
}

function restartGame() {
    closeModal('pause-modal');
    closeModal('lose-modal');
    startGame(gameState.difficulty);
}

function quitGame() {
    stopTimer();
    closeModal('pause-modal');
    closeModal('win-modal');
    closeModal('lose-modal');
    
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function showMessage(icon, title, content) {
    document.getElementById('message-icon').textContent = icon;
    document.getElementById('message-title').textContent = title;
    document.getElementById('message-content').textContent = content;
    document.getElementById('message-modal').classList.remove('hidden');
}

function useHint() {
    if (playerData.items.hint <= 0) {
        showMessage('💡', '提示卡不足', '提示卡不足！可以去商店购买。');
        return;
    }
    
    const rows = gameState.board.length;
    const cols = gameState.board[0].length;
    
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (gameState.board[r][c] !== 0 && !gameState.eliminated.has(`${r},${c}`)) {
                const match = findMatchingPair(r, c);
                if (match) {
                    playerData.items.hint--;
                    savePlayerData();
                    updateGameDisplay();
                    
                    highlightHintPair(match.r1, match.c1, match.r2, match.c2);
                    return;
                }
            }
        }
    }
    
    showMessage('🤔', '暂无匹配', '暂时没有可匹配的数字！游戏将自动洗牌。');
}

function highlightHintPair(r1, c1, r2, c2) {
    const cards = document.querySelectorAll('.number-card');
    
    const card1 = Array.from(cards).find(c => 
        parseInt(c.dataset.row) === r1 && parseInt(c.dataset.col) === c1
    );
    const card2 = Array.from(cards).find(c => 
        parseInt(c.dataset.row) === r2 && parseInt(c.dataset.col) === c2
    );
    
    if (card1) card1.classList.add('hint-highlight');
    if (card2) card2.classList.add('hint-highlight');
    
    setTimeout(() => {
        if (card1) card1.classList.remove('hint-highlight');
        if (card2) card2.classList.remove('hint-highlight');
    }, 3000);
}

function useTimeBonus() {
    if (playerData.items.time <= 0) {
        showMessage('⏰', '时间卡不足', '时间卡不足！可以去商店购买。');
        return;
    }
    
    const config = DIFFICULTY_CONFIG[gameState.difficulty];
    if (config.timeLimit === 0) {
        showMessage('⏰', '无需使用', '当前模式无时间限制，无需使用时间卡！');
        return;
    }
    
    playerData.items.time--;
    gameState.timeLeft += 30;
    savePlayerData();
    updateGameDisplay();
    updateTimerDisplay();
    
    const notification = document.createElement('div');
    notification.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded-lg font-bold z-50';
    notification.textContent = '⏰ +30秒！';
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 2000);
}

function showDailyMission() {
    checkDailyReset();
    
    const listEl = document.getElementById('daily-missions-list');
    listEl.innerHTML = '';
    
    let dailyTotal = 0;
    
    playerData.dailyMissions.forEach(mission => {
        const progress = Math.min(mission.current, mission.target);
        const percentage = (progress / mission.target) * 100;
        const isComplete = mission.current >= mission.target;
        
        if (isComplete) {
            dailyTotal += mission.reward;
        }
        
        const item = document.createElement('div');
        item.className = `bg-white/20 rounded-xl p-4 ${isComplete ? 'border-2 border-green-400' : ''}`;
        item.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <span class="font-bold">${mission.name}</span>
                <span class="text-sm ${isComplete ? 'text-green-300' : 'text-purple-200'}">
                    ${isComplete ? '✅ 已完成' : `${mission.current}/${mission.target}`}
                </span>
            </div>
            <div class="bg-white/20 rounded-full h-2 overflow-hidden mb-2">
                <div class="h-full ${isComplete ? 'bg-green-400' : 'bg-yellow-400'}" style="width: ${percentage}%"></div>
            </div>
            <div class="text-sm text-yellow-300">
                奖励: ${mission.reward} 积分
            </div>
        `;
        listEl.appendChild(item);
    });
    
    document.getElementById('daily-total-score').textContent = dailyTotal;
    document.getElementById('daily-modal').classList.remove('hidden');
}

function showHistory() {
    document.getElementById('history-games').textContent = playerData.totalGames;
    document.getElementById('history-high-score').textContent = playerData.highScore;
    document.getElementById('history-high-combo').textContent = playerData.highCombo;
    document.getElementById('history-wins').textContent = playerData.totalWins;
    
    const recentEl = document.getElementById('history-recent');
    recentEl.innerHTML = '';
    
    if (playerData.recentGames.length === 0) {
        recentEl.innerHTML = '<div class="text-center text-teal-200">暂无游戏记录</div>';
    } else {
        playerData.recentGames.forEach(game => {
            const item = document.createElement('div');
            item.className = `flex justify-between items-center p-2 rounded-lg ${game.won ? 'bg-green-500/30' : 'bg-red-500/30'}`;
            item.innerHTML = `
                <div>
                    <div class="font-bold">${game.difficulty}</div>
                    <div class="text-xs text-teal-200">${game.date}</div>
                </div>
                <div class="text-right">
                    <div class="font-bold">${game.won ? '🏆' : '😢'} ${game.score}分</div>
                    <div class="text-xs text-orange-300">最高连击: ${game.combo}</div>
                </div>
            `;
            recentEl.appendChild(item);
        });
    }
    
    document.getElementById('history-modal').classList.remove('hidden');
}

function showShop() {
    document.getElementById('shop-points').textContent = playerData.totalPoints;
    document.getElementById('shop-hint-count').textContent = playerData.items.hint;
    document.getElementById('shop-time-count').textContent = playerData.items.time;
    document.getElementById('shop-modal').classList.remove('hidden');
}

function buyItem(itemType) {
    const prices = { hint: 100, time: 150 };
    const price = prices[itemType];
    
    if (playerData.totalPoints < price) {
        showMessage('💰', '积分不足', `积分不足！需要 ${price} 积分才能购买。`);
        return;
    }
    
    playerData.totalPoints -= price;
    playerData.items[itemType]++;
    savePlayerData();
    
    showShop();
    
    const notification = document.createElement('div');
    notification.className = 'fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-lg font-bold z-50';
    notification.textContent = '购买成功！';
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 2000);
}

function showProfile() {
    document.getElementById('profile-total-points').textContent = playerData.totalPoints;
    document.getElementById('profile-total-wins').textContent = playerData.totalWins;
    document.getElementById('profile-hint-count').textContent = playerData.items.hint;
    document.getElementById('profile-time-count').textContent = playerData.items.time;
    document.getElementById('profile-modal').classList.remove('hidden');
}

function playSound(type) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        switch(type) {
            case 'select':
                oscillator.frequency.value = 440;
                oscillator.type = 'sine';
                gainNode.gain.value = 0.1;
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.1);
                break;
            case 'match':
                oscillator.frequency.value = 660;
                oscillator.type = 'sine';
                gainNode.gain.value = 0.15;
                oscillator.start();
                setTimeout(() => {
                    oscillator.frequency.value = 880;
                }, 50);
                oscillator.stop(audioContext.currentTime + 0.2);
                break;
            case 'error':
                oscillator.frequency.value = 200;
                oscillator.type = 'sawtooth';
                gainNode.gain.value = 0.1;
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.15);
                break;
            case 'win':
                oscillator.frequency.value = 523;
                oscillator.type = 'sine';
                gainNode.gain.value = 0.15;
                oscillator.start();
                setTimeout(() => oscillator.frequency.value = 659, 100);
                setTimeout(() => oscillator.frequency.value = 784, 200);
                setTimeout(() => oscillator.frequency.value = 1047, 300);
                oscillator.stop(audioContext.currentTime + 0.5);
                break;
            case 'lose':
                oscillator.frequency.value = 300;
                oscillator.type = 'sawtooth';
                gainNode.gain.value = 0.1;
                oscillator.start();
                setTimeout(() => oscillator.frequency.value = 200, 100);
                setTimeout(() => oscillator.frequency.value = 150, 200);
                oscillator.stop(audioContext.currentTime + 0.4);
                break;
        }
    } catch (e) {
    }
}

init();
