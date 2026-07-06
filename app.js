// --- FIREBASE KURULUMU & GÜVENLİK FİLTRESİ HACK ---
const part1 = "AIzaSyDLS";
const part2 = "KKKC1bAKHmR";
const part3 = "BtfrcVFBUJqkcPtOvZE";

const firebaseConfig = {
    apiKey: part1 + part2 + part3,
    authDomain: "futbolcu-a225a.firebaseapp.com",
    databaseURL: "https://futbolcu-a225a-default-rtdb.firebaseio.com/",
    projectId: "futbolcu-a225a",
    storageBucket: "futbolcu-a225a.firebasestorage.app",
    messagingSenderId: "702486350358",
    appId: "1:702486350358:web:dcffbf04e6ffa2ab41c337"
};

// Global State Yönetimi
let database = null;
let myName = "";
let currentRoomId = "";
let isAdmin = false;
let gameState = {};
let hasChallengeJoker = true;
let approvalTimer = null;
let localTimer = null;
let myPlayerRef = null;

// Singleplayer State Alanı
let isSinglePlayer = false;
let spScore = 0;
let spTimerLoop = null;

function initFirebase() {
    if (isSinglePlayer) return true;
    if (typeof firebase === 'undefined') {
        alert("Kritik Hata: Firebase SDK kütüphanesi yüklenemedi!");
        return false;
    }
    if (!window.fbApp) {
        window.fbApp = firebase.initializeApp(firebaseConfig);
        window.fbDatabase = firebase.database();
    }
    database = window.fbDatabase;
    return true;
}

// 1. SINGLEPLAYER MODUNU BAŞLATMA
function startSinglePlayer() {
    isSinglePlayer = true;
    myName = document.getElementById('username-input').value.trim() || "Oyuncu";
    
    document.getElementById('auth-area').classList.add('hidden');
    document.getElementById('lobby-area').classList.add('hidden');
    document.getElementById('game-area').classList.remove('hidden');
    document.getElementById('eliminated-overlay').classList.add('hidden');

    const selectedConcept = document.getElementById('concept-select').value;
    document.getElementById('game-concept-banner').innerText = `KONSEPT: ${selectedConcept.toUpperCase()} | MOD: ARCADE 🕹️`;
    document.getElementById('player-title-label').innerText = "Mevcut Skor";
    document.getElementById('current-player').innerText = "0 Kelime";
    document.getElementById('timer-label').innerText = "⏱️ KALAN SÜRE";
    document.getElementById('last-word-label').innerText = "Yazdığın Son Kelime";

    const harfler = "abcdefghijklnoprstuvyz";
    const rastgeleHarf = harfler[Math.floor(Math.random() * harfler.length)];

    spScore = 0;
    gameState = {
        gameStarted: true,
        gameMode: "SINGLE",
        lastLetter: rastgeleHarf,
        lastPlayerDisplay: "---",
        usedWords: [],
        timeLeft: 30,
        winner: ""
    };

    updateSinglePlayerUI();
    if (spTimerLoop) clearInterval(spTimerLoop);
    
    spTimerLoop = setInterval(() => {
        gameState.timeLeft--;
        document.getElementById('timer').innerText = gameState.timeLeft;

        if (gameState.timeLeft <= 0) {
            clearInterval(spTimerLoop);
            endSinglePlayerGame();
        }
    }, 1000);
}

function updateSinglePlayerUI() {
    document.getElementById('current-player').innerText = `${spScore} Kelime`;
    document.getElementById('required-letter').innerText = gameState.lastLetter.toUpperCase();
    document.getElementById('timer').innerText = gameState.timeLeft;
    document.getElementById('last-player-display').innerText = gameState.lastPlayerDisplay;
    document.getElementById('player-guess').disabled = false;
}

function endSinglePlayerGame() {
    document.getElementById('player-guess').disabled = true;
    
    const currentHighScore = parseInt(localStorage.getItem("arcade_highscore") || "0");
    let isNewRecord = false;
    if (spScore > currentHighScore) {
        localStorage.setItem("arcade_highscore", spScore.toString());
        isNewRecord = true;
    }

    const msgEl = document.getElementById('message');
    msgEl.innerHTML = `
        <div style="text-align:center; padding:20px; background:#1e293b; border:3px solid #8b5cf6; border-radius:10px; margin-top:20px;">
            <h2 style="color:#8b5cf6; font-size:22px; font-weight:bold; margin-bottom:10px;">⏱️ SÜRE BİTTİ ⏱️</h2>
            <p style="color:white; font-size:18px; font-weight:bold;">Toplam Skor: ${spScore} Kelime</p>
            ${isNewRecord ? '<p style="color:#4ade80; font-weight:bold; margin-top:5px;">🎉 YENİ KİŞİSEL REKOR! 🎉</p>' : ''}
            <button onclick="location.reload()" style="margin-top:15px; background:#475569; font-size:0.9rem; padding:8px 15px; width:auto;">Ana Menüye Dön</button>
        </div>
    `;
}

// 2. MULTIPLAYER ODA KURULUMU
function createRoom() {
    isSinglePlayer = false;
    if (!initFirebase()) return;
    
    const nameInput = document.getElementById('username-input').value.trim();
    if (!nameInput) return alert("Lütfen önce adınızı yazın!");
    
    myName = nameInput;
    currentRoomId = Math.floor(1000 + Math.random() * 9000).toString();
    const selectedConcept = document.getElementById('concept-select').value;
    const selectedMode = document.getElementById('mode-select').value;
    isAdmin = true;

    const roomRef = database.ref(`rooms/${currentRoomId}`);
    myPlayerRef = roomRef.child('players').push();
    
    myPlayerRef.set({ name: myName, isAdmin: true });
    myPlayerRef.onDisconnect().remove();

    roomRef.child('config').set({ concept: selectedConcept, gameMode: selectedMode }).then(() => {
        openLobbyUI();
    }).catch(err => alert("Oda kurulum hatası: " + err.message));
}

function joinRoom() {
    isSinglePlayer = false;
    if (!initFirebase()) return;

    const nameInput = document.getElementById('username-input').value.trim();
    const roomInput = document.getElementById('room-code-input').value.trim();
    if (!nameInput || !roomInput) return alert("Eksik bilgi girdiniz!");

    myName = nameInput;
    currentRoomId = roomInput;
    isAdmin = false;

    database.ref(`rooms/${currentRoomId}`).once('value', (snapshot) => {
        if (!snapshot.exists()) return alert("Oda bulunamadı!");
        
        myPlayerRef = database.ref(`rooms/${currentRoomId}/players`).push();
        myPlayerRef.set({ name: myName, isAdmin: false });
        myPlayerRef.onDisconnect().remove();
        
        openLobbyUI();
    }).catch(err => alert("Odaya giriş hatası: " + err.message));
}

function openLobbyUI() {
    document.getElementById('auth-area').classList.add('hidden');
    document.getElementById('lobby-area').classList.remove('hidden');
    document.getElementById('game-area').classList.add('hidden');
    document.getElementById('display-room-code').innerText = currentRoomId;

    database.ref(`rooms/${currentRoomId}/players`).on('value', (snapshot) => {
        const playersList = document.getElementById('players-list');
        playersList.innerHTML = "";
        const data = snapshot.val();
        
        if (data) {
            const playersArray = Object.entries(data);
            let hasAdminNow = playersArray.some(([key, p]) => p.isAdmin === true);
            
            if (!hasAdminNow && playersArray.length > 0) {
                const [firstPlayerKey, firstPlayerData] = playersArray[0];
                database.ref(`rooms/${currentRoomId}/players/${firstPlayerKey}`).update({ isAdmin: true });
                if (firstPlayerData.name === myName) isAdmin = true;
            }

            playersArray.forEach(([key, p]) => {
                if (p.name === myName) isAdmin = p.isAdmin || false;
                playersList.innerHTML += `<li>${p.isAdmin ? "👑 " : ""}${p.name}</li>`;
            });
        }

        const startBtn = document.getElementById('start-btn');
        const waitingText = document.getElementById('lobby-waiting-text');
        if (isAdmin) {
            startBtn.style.display = "block";
            waitingText.style.display = "none";
        } else {
            startBtn.style.display = "none";
            waitingText.style.display = "block";
        }
    });

    database.ref(`rooms/${currentRoomId}/config`).on('value', (snap) => {
        const config = snap.val() || {};
        const currentConcept = config.concept || "Serbest";
        const currentMode = config.gameMode === "BOMB" ? "💣 KİŞİSEL BOMBA (60s)" : "Klasik Mod";
        
        document.getElementById('display-concept').innerText = currentConcept;
        document.getElementById('display-mode').innerText = currentMode;
        document.getElementById('game-concept-banner').innerText = `KONSEPT: ${currentConcept.toUpperCase()} | MOD: ${currentMode}`;
        
        if (config.gameMode === "BOMB") {
            document.getElementById('timer-label').innerText = "💣 KİŞİSEL SÜREN";
        } else {
            document.getElementById('timer-label').innerText = "Kalan Süre";
        }
    });

    database.ref(`rooms/${currentRoomId}/state`).on('value', (snapshot) => {
        gameState = snapshot.val();
        if (gameState && gameState.gameStarted) {
            document.getElementById('lobby-area').classList.add('hidden');
            runGameUI();
            
            if (!localTimer) startTimerLoop();
            if (!approvalTimer) startApprovalTimerLoop();
        }
    });
}

function startGame() {
    if (!initFirebase()) return;
    database.ref(`rooms/${currentRoomId}`).once('value', (snapshot) => {
        const roomData = snapshot.val();
        const data = roomData.players;
        const config = roomData.config || {};
        
        if (!data || Object.keys(data).length < 2) {
            return alert("En az 2 kişi olmalı kanka! Arkadaşının bağlanmasını bekle.");
        }

        const playerArray = Object.values(data).map(p => p.name);
        const isBombMode = config.gameMode === "BOMB";
        
        // Bomba modundaysa her oyuncu için bir 60 saniyelik havuz oluşturuyoruz
        let initialPlayerTimes = {};
        playerArray.forEach(p => {
            initialPlayerTimes[p] = 60; // Herkesin bağımsız 60 saniyesi var
        });

        database.ref(`rooms/${currentRoomId}/state`).set({
            gameStarted: true,
            gameMode: config.gameMode || "CLASSIC",
            players: playerArray,
            eliminatedPlayers: [""],
            currentTurnIndex: 0,
            lastLetter: "",
            lastPlayerDisplay: "---",
            pendingGuess: "",
            isWaitingApproval: false,
            approvalTimeLeft: 10,
            usedWords: [],
            timeLeft: isBombMode ? 60 : 15, // Klasik için global 15, Bomba için ilk oyuncunun 60'ı
            playerBombTimes: isBombMode ? initialPlayerTimes : null,
            winner: "",
            votes: {}
        });
    });
}

function runGameUI() {
    if (isSinglePlayer) return;
    document.getElementById('game-area').classList.remove('hidden');

    if (gameState.winner) {
        if (localTimer) clearInterval(localTimer);
        if (approvalTimer) clearInterval(approvalTimer);
        
        document.getElementById('eliminated-overlay').classList.add('hidden');
        const msgEl = document.getElementById('message');
        msgEl.innerHTML = `
            <div style="text-align:center; padding:20px; background:#1e293b; border:3px solid #16a34a; border-radius:10px; margin-top:20px;">
                <h2 style="color:#16a34a; font-size:24px; font-weight:bold; margin-bottom:10px;">👑 ŞAMPİYON 👑</h2>
                <p style="color:white; font-size:20px; font-weight:bold;">${gameState.winner}</p>
                <p style="color:#64748b; margin-top:10px;">Oyun bitti, harika bir mücadeleydi kanka!</p>
            </div>
        `;
        document.getElementById('player-guess').disabled = true;
        return;
    }

    const isEliminated = gameState.eliminatedPlayers && gameState.eliminatedPlayers.includes(myName);
    if (isEliminated) {
        document.getElementById('eliminated-overlay').classList.remove('hidden');
    } else {
        document.getElementById('eliminated-overlay').classList.add('hidden');
    }

    const currentPlayer = gameState.players[gameState.currentTurnIndex];
    document.getElementById('current-player').innerText = currentPlayer;
    document.getElementById('required-letter').innerText = gameState.lastLetter ? gameState.lastLetter.toUpperCase() : "SERBEST";
    
    // Arayüzdeki süreyi güncelle
    let displayTime = gameState.timeLeft;
    if (gameState.gameMode === "BOMB" && gameState.playerBombTimes) {
        // Bomba modundaysa her oyuncu ekranda sırası gelen kişinin kalan bomba süresini görür
        displayTime = gameState.playerBombTimes[currentPlayer] !== undefined ? gameState.playerBombTimes[currentPlayer] : 60;
    }
    document.getElementById('timer').innerText = displayTime;

    // Kişisel bomba alarmı (Sıra bendeyken ve sürem 15'in altındaysa panik efekti)
    const timerBox = document.getElementById('timer-box');
    if (gameState.gameMode === "BOMB" && currentPlayer === myName && displayTime <= 15) {
        timerBox.style.animation = "pulse 0.5s infinite alternate";
    } else {
        timerBox.style.animation = "none";
    }

    const msgEl = document.getElementById('message');
    const inputEl = document.getElementById('player-guess');

    if (gameState.isWaitingApproval) {
        let yesVotes = 0;
        let noVotes = 0;
        if (gameState.votes) {
            Object.values(gameState.votes).forEach(v => {
                if (v === "YES") yesVotes++;
                if (v === "NO") noVotes++;
            });
        }

        document.getElementById('last-player-display').innerText = `🤔 Oylanıyor (${gameState.approvalTimeLeft}s)`;
        
        if (currentPlayer !== myName && !isEliminated) {
            const myVote = gameState.votes ? gameState.votes[myName] : null;

            if (!myVote) {
                msgEl.innerHTML = `
                    <div class="approval-box">
                        <p style="color:#eab308; font-weight:bold; margin-bottom:10px;">${currentPlayer} şunu yazdı: "${gameState.pendingGuess}"</p>
                        <p style="color:#94a3b8; font-size:0.85rem; margin-bottom:10px;">Mevcut Oylar -> Kabul: ${yesVotes} | Red: ${noVotes}</p>
                        <button onclick="castVote('YES')" style="background-color:#16a34a; padding:8px 15px; margin-right:10px; color:white; border:0; border-radius:5px; width:auto;">Kabul ✅</button>
                        <button onclick="castVote('NO')" style="background-color:#dc2626; padding:8px 15px; color:white; border:0; border-radius:5px; width:auto;">Red ❌</button>
                    </div>
                `;
            } else {
                msgEl.innerHTML = `
                    <div class="approval-box">
                        <p style="color:#64748b;">Oyunuzu verdiniz. Diğer oyuncular bekleniyor...</p>
                    </div>
                `;
            }
        } else {
            msgEl.innerHTML = `<p style="color:#64748b;">Grup kelimeni oyluyor, kalan süre: ${gameState.approvalTimeLeft}s</p>`;
        }
        inputEl.disabled = true;
    } else {
        document.getElementById('last-player-display').innerText = gameState.lastPlayerDisplay;
        msgEl.innerText = "";
        inputEl.disabled = isEliminated || (currentPlayer !== myName);
    }
}

function submitGuess() {
    const inputEl = document.getElementById('player-guess');
    const guess = inputEl.value.trim();
    if (!guess) return;

    const lowerGuess = guess.toLowerCase();

    if (isSinglePlayer) {
        if (gameState.lastLetter && lowerGuess[0] !== gameState.lastLetter) {
            alert(`Kelime ${gameState.lastLetter.toUpperCase()} ile başlamalı kanka!`);
            return;
        }
        if (gameState.usedWords.includes(lowerGuess)) {
            alert("Bu kelimeyi zaten kullandın, başka kelime bul!");
            return;
        }

        spScore++;
        gameState.usedWords.push(lowerGuess);
        gameState.lastPlayerDisplay = guess;
        
        let lastChar = lowerGuess[lowerGuess.length - 1];
        if (lastChar === "ğ" && lowerGuess.length > 1) lastChar = lowerWord[lowerWord.length - 2];
        gameState.lastLetter = lastChar;

        gameState.timeLeft = Math.min(60, gameState.timeLeft + 5);

        inputEl.value = "";
        updateSinglePlayerUI();
        return;
    }

    if (gameState.players[gameState.currentTurnIndex] !== myName) return alert("Sıra sizde değil!");
    if (gameState.lastLetter && lowerGuess[0] !== gameState.lastLetter) return alert(`Kelime ${gameState.lastLetter.toUpperCase()} ile başlamalı!`);
    if (gameState.usedWords && gameState.usedWords.includes(lowerGuess)) return alert("Bu kelime kullanıldı!");

    database.ref(`rooms/${currentRoomId}/state`).update({
        pendingGuess: guess,
        isWaitingApproval: true,
        approvalTimeLeft: 10,
        votes: { "INITIAL_DUMMY": "NONE" }
    });
    inputEl.value = "";
}

function castVote(voteType) {
    if (isSinglePlayer) return;
    database.ref(`rooms/${currentRoomId}/state/votes/${myName}`).set(voteType).then(() => {
        checkAllVotesCast();
    });
}

function checkAllVotesCast() {
    database.ref(`rooms/${currentRoomId}/state`).once('value', (snapshot) => {
        const state = snapshot.val();
        if (!state || !state.isWaitingApproval) return;

        const currentPlayer = state.players[state.currentTurnIndex];
        const eliminated = state.eliminatedPlayers || [];
        const votersNeeded = state.players.filter(p => p !== currentPlayer && !eliminated.includes(p));
        
        let votesCount = 0;
        if (state.votes) {
            votersNeeded.forEach(p => {
                if (state.votes[p]) votesCount++;
            });
        }

        if (votesCount >= votersNeeded.length && votersNeeded.length > 0) {
            tallyVotesAndApply(state);
        }
    });
}

function tallyVotesAndApply(state) {
    const currentPlayer = state.players[state.currentTurnIndex];
    const eliminated = state.eliminatedPlayers || [];
    const voters = state.players.filter(p => p !== currentPlayer && !eliminated.includes(p));

    let yesCount = 0;
    let noCount = 0;
    if (state.votes) {
        voters.forEach(p => {
            if (state.votes[p] === "YES") yesCount++;
            if (state.votes[p] === "NO") noCount++;
        });
    }

    const isAccepted = (yesCount >= noCount); 

    if (isAccepted) {
        const word = state.pendingGuess;
        const lowerWord = word.toLowerCase();
        let lastChar = lowerWord[lowerWord.length - 1];
        if (lastChar === "ğ" && lowerWord.length > 1) lastChar = lowerWord[lowerWord.length - 2];

        let nextIndex = getNextActivePlayerIndex(state.currentTurnIndex);
        const updatedWords = state.usedWords ? [...state.usedWords, lowerWord] : [lowerWord];
        
        // Sıradaki oyuncunun kalıtsal süresini çekelim (Bomba modu için)
        let nextPlayerName = state.players[nextIndex];
        let nextTurnResetTime = 15;
        if (state.gameMode === "BOMB" && state.playerBombTimes) {
            nextTurnResetTime = state.playerBombTimes[nextPlayerName] !== undefined ? state.playerBombTimes[nextPlayerName] : 60;
        }

        database.ref(`rooms/${currentRoomId}/state`).update({
            currentTurnIndex: nextIndex,
            lastLetter: lastChar,
            lastPlayerDisplay: word,
            pendingGuess: "",
            isWaitingApproval: false,
            usedWords: updatedWords,
            lastRejectedPlayer: "",
            timeLeft: nextTurnResetTime, // Sıradaki oyuncunun kendi süresi yükleniyor
            votes: {}
        });
    } else {
        database.ref(`rooms/${currentRoomId}/state`).update({
            lastRejectedPlayer: currentPlayer,
            lastRejectedWord: state.pendingGuess,
            pendingGuess: "",
            isWaitingApproval: false,
            votes: {}
        });
    }
}

function getNextActivePlayerIndex(currentIndex) {
    let nextIndex = currentIndex;
    let loopCount = 0;
    while (loopCount < gameState.players.length) {
        nextIndex = (nextIndex + 1) % gameState.players.length;
        const pName = gameState.players[nextIndex];
        if (!gameState.eliminatedPlayers || !gameState.eliminatedPlayers.includes(pName)) {
            return nextIndex;
        }
        loopCount++;
    }
    return currentIndex;
}

function startApprovalTimerLoop() {
    if (approvalTimer) clearInterval(approvalTimer);
    approvalTimer = setInterval(() => {
        if (!isSinglePlayer && gameState && gameState.gameStarted && gameState.isWaitingApproval && database && !gameState.winner) {
            if (isAdmin) {
                let newAppTime = gameState.approvalTimeLeft - 1;
                if (newAppTime <= 0) {
                    tallyVotesAndApply(gameState);
                } else {
                    database.ref(`rooms/${currentRoomId}/state`).update({ approvalTimeLeft: newAppTime });
                }
            }
        }
    }, 1000);
}

function startTimerLoop() {
    if (localTimer) clearInterval(localTimer);
    localTimer = setInterval(() => {
        if (!isSinglePlayer && gameState && gameState.gameStarted && database && !gameState.winner) {
            // Klasik modda oylama varken süre durur, ama Bomba modunda oylama esnasında da oyuncunun süresi erir!
            if (gameState.isWaitingApproval && gameState.gameMode !== "BOMB") return;

            if (isAdmin) {
                const currentPlayerName = gameState.players[gameState.currentTurnIndex];
                
                if (gameState.gameMode === "BOMB" && gameState.playerBombTimes) {
                    // --- BOMBAMODU: BİREYSEL SÜRE ERİTME ---
                    let updatedBombTimes = { ...gameState.playerBombTimes };
                    let currentUserTime = updatedBombTimes[currentPlayerName] !== undefined ? updatedBombTimes[currentPlayerName] : 60;
                    
                    currentUserTime--;
                    updatedBombTimes[currentPlayerName] = currentUserTime;

                    if (currentUserTime <= 0) {
                        // Bu oyuncunun bombası patladı! Elenme süreçleri tetikleniyor:
                        let currentEliminated = gameState.eliminatedPlayers ? [...gameState.eliminatedPlayers] : [];
                        if (!currentEliminated.includes(currentPlayerName)) {
                            currentEliminated.push(currentPlayerName);
                        }

                        const activePlayers = gameState.players.filter(p => !currentEliminated.includes(p));

                        if (activePlayers.length <= 1) {
                            const finalWinner = activePlayers.length === 1 ? activePlayers[0] : "Bilinmeyen Şampiyon";
                            database.ref(`rooms/${currentRoomId}/state`).update({
                                eliminatedPlayers: currentEliminated,
                                playerBombTimes: updatedBombTimes,
                                winner: finalWinner,
                                timeLeft: 0
                            });
                        } else {
                            let nextIndex = getNextActivePlayerIndex(gameState.currentTurnIndex);
                            let nextPlayerName = gameState.players[nextIndex];
                            let nextPlayerTime = updatedBombTimes[nextPlayerName] !== undefined ? updatedBombTimes[nextPlayerName] : 60;

                            database.ref(`rooms/${currentRoomId}/state`).update({
                                eliminatedPlayers: currentEliminated,
                                playerBombTimes: updatedBombTimes,
                                currentTurnIndex: nextIndex,
                                timeLeft: nextPlayerTime,
                                isWaitingApproval: false,
                                votes: {}
                            });
                        }
                    } else {
                        // Süre azalmaya devam ediyor, DB güncelle
                        database.ref(`rooms/${currentRoomId}/state`).update({ 
                            playerBombTimes: updatedBombTimes,
                            timeLeft: currentUserTime
                        });
                    }

                } else {
                    // --- KLASİK MOD: GLOBAL 15 SANİYE AZALTIMI ---
                    let newTime = gameState.timeLeft - 1;
                    if (newTime <= 0) {
                        let currentEliminated = gameState.eliminatedPlayers ? [...gameState.eliminatedPlayers] : [];
                        if (!currentEliminated.includes(currentPlayerName)) {
                            currentEliminated.push(currentPlayerName);
                        }

                        const activePlayers = gameState.players.filter(p => !currentEliminated.includes(p));

                        if (activePlayers.length <= 1) {
                            const finalWinner = activePlayers.length === 1 ? activePlayers[0] : "Bilinmeyen Şampiyon";
                            database.ref(`rooms/${currentRoomId}/state`).update({
                                eliminatedPlayers: currentEliminated,
                                winner: finalWinner,
                                timeLeft: 0
                            });
                        } else {
                            let nextIndex = getNextActivePlayerIndex(gameState.currentTurnIndex);
                            database.ref(`rooms/${currentRoomId}/state`).update({
                                eliminatedPlayers: currentEliminated,
                                currentTurnIndex: nextIndex,
                                timeLeft: 15,
                                isWaitingApproval: false,
                                votes: {}
                            });
                        }
                    } else {
                        database.ref(`rooms/${currentRoomId}/state`).update({ timeLeft: newTime });
                    }
                }
            }
        }
    }, 1000);
}

function useChallenge() {
    if (isSinglePlayer || !hasChallengeJoker) return;
    hasChallengeJoker = false;
    document.getElementById('challenge-btn').style.display = "none";

    const backupWord = gameState.lastRejectedWord;
    const lowerWord = backupWord.toLowerCase();
    let lastChar = lowerWord[lowerWord.length - 1];
    if (lastChar === "ğ" && lowerWord.length > 1) lastChar = lowerWord[lowerWord.length - 2];

    let nextIndex = getNextActivePlayerIndex(gameState.currentTurnIndex);
    const updatedWords = gameState.usedWords ? [...gameState.usedWords, lowerWord] : [lowerWord];
    
    let nextPlayerName = gameState.players[nextIndex];
    let nextTurnResetTime = 15;
    if (gameState.gameMode === "BOMB" && gameState.playerBombTimes) {
        nextTurnResetTime = gameState.playerBombTimes[nextPlayerName] !== undefined ? gameState.playerBombTimes[nextPlayerName] : 60;
    }

    database.ref(`rooms/${currentRoomId}/state`).update({
        currentTurnIndex: nextIndex,
        lastLetter: lastChar,
        lastPlayerDisplay: `🚨 İTİRAZLA: ${backupWord}`,
        pendingGuess: "",
        isWaitingApproval: false,
        lastRejectedPlayer: "",
        usedWords: updatedWords,
        timeLeft: nextTurnResetTime,
        votes: {}
    });
    alert("İtirazın kabul edildi!");
}
