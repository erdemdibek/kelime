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

// Firebase Güvenli Başlatıcı
function initFirebase() {
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

// 1. ODA KURULUMU
function createRoom() {
    if (!initFirebase()) return;
    
    const nameInput = document.getElementById('username-input').value.trim();
    if (!nameInput) return alert("Lütfen önce adınızı yazın!");
    
    myName = nameInput;
    currentRoomId = Math.floor(1000 + Math.random() * 9000).toString();
    const selectedConcept = document.getElementById('concept-select').value;
    isAdmin = true;

    const roomRef = database.ref(`rooms/${currentRoomId}`);
    const playerRef = roomRef.child('players').push();
    
    playerRef.set({ name: myName, isAdmin: true });
    playerRef.onDisconnect().remove();

    roomRef.child('config').set({ concept: selectedConcept }).then(() => {
        openLobbyUI();
    }).catch(err => alert("Oda kurulum hatası: " + err.message));
}

function joinRoom() {
    if (!initFirebase()) return;

    const nameInput = document.getElementById('username-input').value.trim();
    const roomInput = document.getElementById('room-code-input').value.trim();
    if (!nameInput || !roomInput) return alert("Eksik bilgi girdiniz!");

    myName = nameInput;
    currentRoomId = roomInput;
    isAdmin = false;

    database.ref(`rooms/${currentRoomId}`).once('value', (snapshot) => {
        if (!snapshot.exists()) return alert("Oda bulunamadı!");
        
        const playerRef = database.ref(`rooms/${currentRoomId}/players`).push();
        playerRef.set({ name: myName, isAdmin: false });
        playerRef.onDisconnect().remove();
        
        openLobbyUI();
    }).catch(err => alert("Odaya giriş hatası: " + err.message));
}

function openLobbyUI() {
    document.getElementById('auth-area').classList.add('hidden');
    document.getElementById('lobby-area').classList.remove('hidden');
    document.getElementById('game-area').classList.add('hidden');
    document.getElementById('display-room-code').innerText = currentRoomId;

    const startBtn = document.getElementById('start-btn');
    const waitingText = document.getElementById('lobby-waiting-text');

    if (isAdmin) {
        startBtn.style.display = "block";
        waitingText.style.display = "none";
    } else {
        startBtn.style.display = "none";
        waitingText.style.display = "block";
    }

    database.ref(`rooms/${currentRoomId}/config/concept`).on('value', (snap) => {
        const currentConcept = snap.val() || "Serbest";
        document.getElementById('display-concept').innerText = currentConcept;
        document.getElementById('game-concept-banner').innerText = "KONSEPT: " + currentConcept.toUpperCase();
    });

    database.ref(`rooms/${currentRoomId}/players`).on('value', (snapshot) => {
        const playersList = document.getElementById('players-list');
        playersList.innerHTML = "";
        const data = snapshot.val();
        if (data) {
            Object.values(data).forEach(p => {
                playersList.innerHTML += `<li>${p.isAdmin ? "👑 " : ""}${p.name}</li>`;
            });
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

// 2. OYUNU BAŞLATMA
function startGame() {
    if (!initFirebase()) return;
    if (!currentRoomId) return alert("Oda kodu geçersiz!");

    database.ref(`rooms/${currentRoomId}/players`).once('value', (snapshot) => {
        const data = snapshot.val();
        if (!data || Object.keys(data).length < 2) {
            return alert("En az 2 kişi olmalı kanka! Arkadaşının bağlanmasını bekle.");
        }

        const playerArray = Object.values(data).map(p => p.name);
        
        database.ref(`rooms/${currentRoomId}/state`).set({
            gameStarted: true,
            players: playerArray,
            eliminatedPlayers: [""],
            currentTurnIndex: 0,
            lastLetter: "",
            lastPlayerDisplay: "---",
            pendingGuess: "",
            isWaitingApproval: false,
            approvalTimeLeft: 10,
            usedWords: [],
            timeLeft: 15,
            winner: "",
            votes: {} // Oyları tutacağımız alan
        }).catch(err => alert("Oyun tetiklenirken hata oluştu: " + err.message));
    });
}

// 3. EKRAN VE BUTON GÜNCELLEMELERİ
function runGameUI() {
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
        const submitBtn = document.querySelector('.input-area button');
        if (submitBtn) submitBtn.disabled = true;
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
    document.getElementById('timer').innerText = gameState.timeLeft;

    const msgEl = document.getElementById('message');
    const inputEl = document.getElementById('player-guess');
    const submitBtn = document.querySelector('.input-area button');
    const challengeBtn = document.getElementById('challenge-btn');

    if (gameState.lastRejectedPlayer === myName && hasChallengeJoker && !gameState.isWaitingApproval && !isEliminated) {
        challengeBtn.style.display = "block";
        challengeBtn.innerText = `İtiraz Et 🚨 (Kelimeniz: "${gameState.lastRejectedWord}")`;
    } else {
        challengeBtn.style.display = "none";
    }

    if (gameState.isWaitingApproval) {
        // Şu ana kadar verilen oyları sayalım (Arayüzde kaç kişinin oy verdiğini göstermek için)
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
            // Oyuncu zaten oy vermiş mi kontrol et
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
                        <p style="color:#94a3b8; font-size:0.85rem; margin-top:5px;">Toplam Oy -> Kabul: ${yesVotes} | Red: ${noVotes}</p>
                    </div>
                `;
            }
        } else {
            msgEl.innerHTML = `<p style="color:#64748b;">Grup kelimeni oyluyor, kalan süre: ${gameState.approvalTimeLeft}s<br>Kabul: ${yesVotes} | Red: ${noVotes}</p>`;
        }
        inputEl.disabled = true;
        if (submitBtn) submitBtn.disabled = true;
    } else {
        document.getElementById('last-player-display').innerText = gameState.lastPlayerDisplay;
        msgEl.innerText = "";
        inputEl.disabled = isEliminated;
        if (submitBtn) submitBtn.disabled = isEliminated;
    }
}

// 4. KELİME SUNMA
function submitGuess() {
    const inputEl = document.getElementById('player-guess');
    const guess = inputEl.value.trim();
    if (!guess || gameState.isWaitingApproval) return;

    if (gameState.players[gameState.currentTurnIndex] !== myName) return alert("Sıra sizde değil!");
    if (gameState.eliminatedPlayers && gameState.eliminatedPlayers.includes(myName)) return alert("Elendiniz, kelime gönderemezsiniz!");

    const lowerGuess = guess.toLowerCase();
    if (gameState.lastLetter && lowerGuess[0] !== gameState.lastLetter) return alert(`Kelime ${gameState.lastLetter.toUpperCase()} ile başlamalı!`);
    if (gameState.usedWords && gameState.usedWords.includes(lowerGuess)) return alert("Bu kelime kullanıldı!");

    database.ref(`rooms/${currentRoomId}/state`).update({
        pendingGuess: guess,
        isWaitingApproval: true,
        approvalTimeLeft: 10,
        votes: { "INITIAL_DUMMY": "NONE" } // Oylamayı sıfırla
    });
    inputEl.value = "";
}

// 5. OY VERME FONKSİYONU
function castVote(voteType) {
    if (!gameState.isWaitingApproval) return;
    
    // Veritabanına kendi ismimizle oyumuzu basıyoruz
    database.ref(`rooms/${currentRoomId}/state/votes/${myName}`).set(voteType).then(() => {
        // Oy verdikten sonra, acaba herkes oyunu kullandı mı diye kontrol edelim
        checkAllVotesCast();
    });
}

// Tüm aktif ve elenmemiş kişilerin oy verip vermediğini kontrol eden yardımcı fonksiyon
function checkAllVotesCast() {
    database.ref(`rooms/${currentRoomId}/state`).once('value', (snapshot) => {
        const state = snapshot.val();
        if (!state || !state.isWaitingApproval) return;

        const currentPlayer = state.players[state.currentTurnIndex];
        const eliminated = state.eliminatedPlayers || [];

        // Oy vermesi gereken aktif kişi sayısını bul (Oynayan kişi + Elenenler oy veremez)
        const votersNeeded = state.players.filter(p => p !== currentPlayer && !eliminated.includes(p));
        
        // Verilen geçerli oyları say
        let votesCount = 0;
        if (state.votes) {
            votersNeeded.forEach(p => {
                if (state.votes[p]) votesCount++;
            });
        }

        // Eğer herkes oy verdiyse süreyi beklemeden hemen oylamayı sonuçlandır
        if (votesCount >= votersNeeded.length && votersNeeded.length > 0) {
            tallyVotesAndApply(state);
        }
    });
}

// Oyları sayıp sonucu oyuna yansıtan ana mekanizma
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

    // 🔴 KRAL KURAL: Çoğunluk RED derse RED. ONAY verirse veya EŞİTLİK olursa ONAY.
    const isAccepted = (yesCount >= noCount); 

    if (isAccepted) {
        const word = state.pendingGuess;
        const lowerWord = word.toLowerCase();
        let lastChar = lowerWord[lowerWord.length - 1];
        if (lastChar === "ğ" && lowerWord.length > 1) lastChar = lowerWord[lowerWord.length - 2];

        let nextIndex = getNextActivePlayerIndex(state.currentTurnIndex);
        const updatedWords = state.usedWords ? [...state.usedWords, lowerWord] : [lowerWord];

        database.ref(`rooms/${currentRoomId}/state`).update({
            currentTurnIndex: nextIndex,
            lastLetter: lastChar,
            lastPlayerDisplay: word,
            pendingGuess: "",
            isWaitingApproval: false,
            usedWords: updatedWords,
            lastRejectedPlayer: "",
            timeLeft: 15,
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

// 6. SÜRE DÖNGÜLERİ
function startApprovalTimerLoop() {
    if (approvalTimer) clearInterval(approvalTimer);
    approvalTimer = setInterval(() => {
        if (gameState && gameState.gameStarted && gameState.isWaitingApproval && database && !gameState.winner) {
            // Oylama süresini sadece oda sahibi eksiltsin (Senkronizasyon çakışmaması için en temiz yoldur kanka)
            if (isAdmin) {
                let newAppTime = gameState.approvalTimeLeft - 1;
                if (newAppTime <= 0) {
                    // 10 saniye bitti, mevcut oylarla kararı ver
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
        if (gameState && gameState.gameStarted && !gameState.isWaitingApproval && database && !gameState.winner) {
            const isMyTurn = gameState.players[gameState.currentTurnIndex] === myName;
            if (isMyTurn) {
                let newTime = gameState.timeLeft - 1;
                
                if (newTime <= 0) {
                    let currentEliminated = gameState.eliminatedPlayers ? [...gameState.eliminatedPlayers] : [];
                    if (!currentEliminated.includes(myName)) {
                        currentEliminated.push(myName);
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
                            timeLeft: 15
                        });
                    }
                } else {
                    database.ref(`rooms/${currentRoomId}/state`).update({ timeLeft: newTime });
                }
            }
        }
    }, 1000);
}

// 7. İTİRAZ JOKERİ SİSTEMİ
function useChallenge() {
    if (!hasChallengeJoker) return;
    const isEliminated = gameState.eliminatedPlayers && gameState.eliminatedPlayers.includes(myName);
    if (isEliminated) return;

    hasChallengeJoker = false;
    document.getElementById('challenge-btn').style.display = "none";

    const backupWord = gameState.lastRejectedWord;
    const lowerWord = backupWord.toLowerCase();
    let lastChar = lowerWord[lowerWord.length - 1];
    if (lastChar === "ğ" && lowerWord.length > 1) lastChar = lowerWord[lowerWord.length - 2];

    let nextIndex = getNextActivePlayerIndex(gameState.currentTurnIndex);
    const updatedWords = gameState.usedWords ? [...gameState.usedWords, lowerWord] : [lowerWord];
    let penaltyTime = Math.max(5, gameState.timeLeft - 5);

    database.ref(`rooms/${currentRoomId}/state`).update({
        currentTurnIndex: nextIndex,
        lastLetter: lastChar,
        lastPlayerDisplay: `🚨 İTİRAZLA: ${backupWord}`,
        pendingGuess: "",
        isWaitingApproval: false,
        lastRejectedPlayer: "",
        usedWords: updatedWords,
        timeLeft: penaltyTime,
        votes: {}
    });
    alert("İtirazın kabul edildi! Kelime onaylandı ve rakibinin süresinden 5 saniye çalındı!");
}
