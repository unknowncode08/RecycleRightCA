const firebaseConfig = {
    apiKey: "AIzaSyB9dQshTk_TtTHH3yi1Oj72TcinxuAYbEg", authDomain: "recyclerightca.firebaseapp.com", projectId: "recyclerightca", appId: "1:680884147195:web:b1e0036607dd514908b15e", storageBucket: "recyclerightca.firebasestorage.app", messagingSenderId: "680884147195"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();

const db = firebase.firestore();

let stream = null;

const tabs = document.querySelectorAll('.tab');

const pages = {
    main: 'page-main', map: 'page-map', profile: 'page-profile', settings: 'page-settings', collection: 'page-collection'
};

let map = null;
let mapReady = false;
const GEMINI_API_KEY = "AIzaSyCteI1RtEohJ7bMCNcJt3sUdROp_ZlVx4E";

let signupMode = false;
let capturedBase64;

let selectionMode = false;
let holdTimeout = null;
let longPressTimer;
let isMultiSelectMode = false;
const selectedItems = new Set();

/* ------------------------------  VERSION CONTROL ------------------------------ */
const LOCAL_APP_VERSION = "0.0.1.5"; // your current app version

function compareVersions(v1, v2) {
    const a = v1.split('.').map(Number);
    const b = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const num1 = a[i] || 0;
        const num2 = b[i] || 0;
        if (num1 > num2) return 1;
        if (num1 < num2) return -1;
    }
    return 0;
}

/* ---------------------------  PROFILE & COLLECTION  --------------------------- */
function logout() {
    auth.signOut().then(() => {
        console.log("User signed out successfully.");
        window.location.reload();  // Refresh the page to reset the profile UI
    }).catch((error) => {
        console.error("Sign out error:", error.message);
        alert("Failed to sign out: " + error.message);
    });
}

async function refreshProfile() {
    const profileContent = document.getElementById('profileContent');
    const user = auth.currentUser;
    if (user) {
        const streakData = await fetchStreak(user.uid);
        const points = streakData.pt;
        const {
            name: levelName, badge
        }
            = calculateLevel(points);
        let streakBadge = '';
        if (streakData.current >= 90) streakBadge = '🔥 90-Day Master';
        else if (streakData.current >= 30) streakBadge = '🏆 30-Day Legend';
        else if (streakData.current >= 7) streakBadge = '🥇 7-Day Champ';
        profileContent.innerHTML = `<div class="space-y-6 flex flex-col items-center"><div class="rounded-full bg-green-100 w-32 h-32 flex items-center justify-center text-5xl shadow-inner animate-bounce">${badge}</div><div class="text-muted text-center"><p class="text-2xl font-bold mb-2">${user.email}</p><p class="text-lg">Points: <span id="pointsCount" class="text-green-700 font-semibold">${points}</span></p><p class="text-lg">Level: <span class="text-blue-700 font-semibold">${levelName}</span></p><p class="text-lg">🔥 Current Streak: <span class="font-semibold">${streakData.current}</span> days</p><p class="text-lg">🏆 Longest Streak: <span class="font-semibold">${streakData.longest}</span> days</p><p class="text-lg">❄️ Streak Freeze: <span class="font-semibold">${streakData.freeze ? 'Available' : 'None'}</span></p>${streakBadge ? `<p class="mt-2 text-green-600 font-bold">${streakBadge
            }
     </p>` : ''}<div id="freezeSection" class="mt-4"></div></div><button onclick="logout()" class="px-6 py-2 bg-gray-300 rounded-md hover:bg-gray-400">Sign Out</button></div>`;
        if (!streakData.freeze) {
            document.getElementById('freezeSection').innerHTML = `<button onclick="buyStreakFreeze()" class="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">Buy Streak Freeze (50 pts)</button>`
        }

    }
    else {
        profileContent.innerHTML = `<div class="space-y-6 flex flex-col items-center"><p class="text-muted text-lg">You are currently signed out.</p><button onclick="openAuthPopup()" class="px-6 py-2 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-md hover:to-emerald-700">Sign In</button></div>`;

    }

}

async function addToCollection(userId, name, type, base64img) {
    const collectionRef = db.collection('users').doc(userId).collection('collection');

    // Get all items with the same name
    const snapshot = await collectionRef.where('name', '>=', name).where('name', '<=', name + '\uf8ff').get();

    let newName = name;
    let count = 1;
    const nameRegex = new RegExp(`^${name}( \\((\\d+)\\))?$`);

    snapshot.forEach(doc => {
        const existingName = doc.data().name;
        const match = existingName.match(nameRegex);
        if (match) {
            const number = parseInt(match[2]) || 1;
            if (number >= count) {
                count = number + 1;
            }
        }
    });

    if (count > 1) {
        newName = `${name} (${count})`;
    }

    await collectionRef.add({
        name: newName,
        type: type,
        image: 'data:image/jpeg;base64,' + capturedBase64,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function refreshCollection() {
    const collectionList = document.getElementById('collectionList');
    collectionList.innerHTML = '<p class="text-muted text-center w-full">Loading your collection...</p>';
    const user = auth.currentUser;
    if (!user) {
        collectionList.innerHTML = '<p class="text-muted text-center w-full">Sign in to view your collection.</p>';
        return;

    }
    const snapshot = await db.collection('users').doc(user.uid).collection('collection').orderBy('timestamp', 'desc').get();
    if (snapshot.empty) {
        collectionList.innerHTML = '<p class="text-muted text-center w-full">No items yet. Start scanning!</p>';
        return;

    }
    collectionList.innerHTML = '';
    snapshot.forEach(doc => {
        const data = doc.data();
        const emoji = data.type === 'rec' ? '♻️' : data.type === 'nrec' ? '❌' : '💵';
        const itemDiv = document.createElement('div');
        itemDiv.className = 'collection-item bg-card p-4 rounded-xl shadow flex items-center gap-4 cursor-pointer transition relative';
        itemDiv.dataset.docId = doc.id;
        
        const minusIcon = `<div class="minus-icon absolute top-0 right-0 m-2 hidden text-red-600 text-lg bg-white rounded-full w-6 h-6 flex items-center justify-center shadow">−</div>`;
        itemDiv.innerHTML = `
          ${minusIcon}
          <img src="${data.image}" alt="${data.name}" class="w-16 h-16 rounded object-cover shadow">
          <div>
            <p class="text-lg font-semibold">${data.name}</p>
            <p class="text-muted">${emoji} ${data.type.toUpperCase()}</p>
          </div>
        `;
        
        let longPressed = false;

        itemDiv.addEventListener('mousedown', () => {
          longPressed = false;
          longPressTimer = setTimeout(() => {
            longPressed = true;
            enterMultiSelectMode();
            selectItem(itemDiv);
          }, 2000); // 2 second long press
        });
        
        itemDiv.addEventListener('mouseup', () => {
          clearTimeout(longPressTimer);
        });
        
        itemDiv.addEventListener('mouseleave', () => {
          clearTimeout(longPressTimer);
        });
        
        // This stays below to decide what happens on click
        itemDiv.addEventListener('click', () => {
          if (longPressed) return; // Prevent click after long press
          if (isMultiSelectMode) {
            selectItem(itemDiv);
          } else {
            openCollectionPopup(data.name, data.image, data.type, doc.id);
          }
        });
        
        
        collectionList.appendChild(itemDiv);
        
    });

}
document.getElementById('page-collection').addEventListener('click', (e) => {
    if (!isMultiSelectMode) return;
    if (!e.target.closest('.collection-item')) {
      exitMultiSelectMode();
    }
  });

  
  function enterMultiSelectMode() {
    isMultiSelectMode = true;
    selectedItems.clear();
  
    document.querySelectorAll('.collection-item').forEach(item => {
      item.classList.add('shake');
      item.querySelector('.minus-icon').classList.remove('hidden');
    });
    document.getElementById('multiDeleteBtn').classList.remove('hidden');
  }
  
  function exitMultiSelectMode() {
    isMultiSelectMode = false;
    selectedItems.clear();
  
    document.querySelectorAll('.collection-item').forEach(item => {
      item.classList.remove('shake');
      item.querySelector('.minus-icon').classList.add('hidden');
      item.classList.remove('bg-blue-100');
    });
    document.getElementById('multiDeleteBtn').classList.add('hidden');
  }
  
  
  function selectItem(itemDiv) {
    const id = itemDiv.dataset.docId;
    if (selectedItems.has(id)) {
      selectedItems.delete(id);
      itemDiv.classList.remove('bg-blue-100');
      itemDiv.querySelector('.minus-icon').classList.remove('selected');
    } else {
      selectedItems.add(id);
      itemDiv.classList.add('bg-blue-100');
      itemDiv.querySelector('.minus-icon').classList.add('selected');
    }
  }
  

function openCollectionPopup(name, image, type, docId) {
    document.getElementById('popupImage').src = image;
    document.getElementById('popupName').textContent = name;
    document.getElementById('popupType').textContent = (type === 'rec' ? '♻️ Recyclable' : type === 'nrec' ? '❌ Non-Recyclable' : '💵 CRV Eligible');
    document.getElementById('deleteItemBtn').onclick = async () => {
        const user = auth.currentUser;
        if (!user) return;
        await db.collection('users').doc(user.uid).collection('collection').doc(docId).delete();
        document.getElementById('collectionPopup').classList.add('hidden');
        refreshCollection();

    };
    document.getElementById('collectionPopup').classList.remove('hidden');

}

document.getElementById('closeCollectionPopup').onclick = () => {
    document.getElementById('collectionPopup').classList.add('hidden');

};

/* ---------------------------  STREAKS & POINTS (unchanged) --------------------------- */
async function buyStreakFreeze() {
    const user = auth.currentUser;
    if (!user) return;
    const userRef = db.collection('users').doc(user.uid);
    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(userRef);
            if (!doc.exists) throw new Error("User doc missing");
            const data = doc.data();
            const points = data.points || 0;
            const freezeAvailable = data.streakFreezeAvailable || false;
            if (freezeAvailable) throw new Error("You already have a Streak Freeze.");
            if (points < 50) throw new Error("Not enough points!");
            transaction.update(userRef, {
                points: points - 50, streakFreezeAvailable: true
            }
            );

        }
        );
        const popup = document.createElement('div');
        popup.textContent = '❄️ Streak Freeze Purchased!';
        popup.className = 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-500 text-white font-bold py-4 px-6 rounded-xl shadow-xl animate-bounce z-50';
        document.body.appendChild(popup);
        setTimeout(() => {
            popup.remove();
            refreshProfile();

        }
            , 2000);

    }
    catch (e) {
        alert(e.message || "Error purchasing freeze");

    }

}

async function updateStreak(userId) {
    const userRef = db.collection('users').doc(userId);
    await db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        const today = new Date().toISOString().slice(0, 10);
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        if (!userDoc.exists) {
            transaction.set(userRef, {
                currentStreak: 1, longestStreak: 1, lastScanDate: today, streakFreezeAvailable: false
            }
            );
            showPlusOne();

        }
        else {
            const data = userDoc.data();
            const lastScanDate = data.lastScanDate || '';
            let currentStreak = data.currentStreak || 0;
            let longestStreak = data.longestStreak || 0;
            let freezeAvailable = data.streakFreezeAvailable || false;
            if (lastScanDate === today) {
                return;

            }
            else if (lastScanDate === yesterday) {
                currentStreak += 1;
                showPlusOne();

            }
            else {
                if (freezeAvailable) {
                    freezeAvailable = false;
                    showPlusOne();

                }
                else {
                    currentStreak = 1;
                    showPlusOne();

                }

            }
            if (currentStreak > longestStreak) {
                longestStreak = currentStreak;

            }
            transaction.update(userRef, {
                currentStreak, longestStreak, lastScanDate: today, streakFreezeAvailable: freezeAvailable
            }
            );

        }

    }
    );

}
async function fetchStreak(userId) {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
        const data = userDoc.data();
        return {
            current: data.currentStreak || 0, longest: data.longestStreak || 0, freeze: data.streakFreezeAvailable || false, pt: data.points || 0
        }

    }
    return {
        current: 0, longest: 0, freeze: false
    }

}
async function addPointsToUser(userId, amount = 5) {
    const userRef = db.collection('users').doc(userId);
    await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(userRef);
        if (!doc.exists) return;
        const currentPoints = doc.data().points || 0;
        transaction.update(userRef, {
            points: currentPoints + amount
        }
        );

    }
    );

}

function showPlusOne() {
    const plusOne = document.createElement('div');
    plusOne.textContent = '+1🔥';
    plusOne.className = 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl text-green-600 font-bold animate-bounce';
    document.body.appendChild(plusOne);
    setTimeout(() => plusOne.remove(), 1500);

}

function animateCount(elementId, endValue, duration = 800) {
    const el = document.getElementById(elementId);
    let start = 0;
    const increment = endValue / (duration / 16);
    const timer = setInterval(() => {
        start += increment;
        if (start >= endValue) {
            el.textContent = endValue;
            clearInterval(timer);
        } else {
            el.textContent = Math.floor(start);
        }
    }, 16);
}

function updateLevelProgress(points) {
    const progressBar = document.getElementById('levelProgress');
    const label = document.getElementById('levelLabel');
    const labelCount = document.getElementById('levelCountLabel');
    const perLabel = document.getElementById('percentLabel');

    let level = 0;
    let nextLevelPoints = 20;

    if (points >= 200) {
        level = 4;
        nextLevelPoints = 250;
    } else if (points >= 100) {
        level = 3;
        nextLevelPoints = 200;
    } else if (points >= 50) {
        level = 2;
        nextLevelPoints = 100;
    } else if (points >= 20) {
        level = 1;
        nextLevelPoints = 50;
    }

    const prevLevelPoints = [0, 20, 50, 100, 200][level];
    const progress = points - prevLevelPoints;
    const required = nextLevelPoints - prevLevelPoints;
    const percent = Math.min(100, Math.floor((progress / required) * 100));

    console.log('Prev: ' + prevLevelPoints + " | prog: " + progress + " | req: " + required + " | per: " + percent);

    if (perLabel) perLabel.textContent = `${percent}%`;
    if (labelCount) labelCount.textContent = `Level: ${level}`;
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (label) label.textContent = `${required} Points to Next Level`;
}

/* ---------------------------  TAB ROUTER --------------------------- */
function switchTab(tab) {
    if (tab !== 'main') {
        document.getElementById('camera').classList.add('hidden');
        document.getElementById('floatingScanBtn').style.display = "none";
    } else {
        document.getElementById('floatingScanBtn').style.display = "flex";
    }

    if (stream && tab !== 'main') {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        const videoElement = document.getElementById('videoPreview');
        if (videoElement) videoElement.srcObject = null;

    }
    tabs.forEach(t => {
        const active = t.dataset.tab === tab;
        t.classList.toggle('text-green-600', active);
        t.classList.toggle('text-gray-500', !active);
        document.getElementById(pages[t.dataset.tab]).classList.toggle('hidden', !active);

    }
    );
    if (tab === 'map' && !mapReady) initMap();
    if (tab === 'profile') refreshProfile();
    if (tab === 'collection') {
        if (isMultiSelectMode) exitMultiSelectMode();
        refreshCollection();
    }    
}

document.getElementById('floatingScanBtn').addEventListener('click', () => {
    document.getElementById('scanBtn').click();
});

tabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));
switchTab('main');


/* ---------------------------  CAMERA & SCAN  --------------------------- */
document.getElementById('scanBtn').addEventListener('click', async () => {
    const video = document.getElementById('videoPreview');
    const snapBtn = document.getElementById('snapBtn');
    document.getElementById('camera').classList.remove('hidden');
    stream = await navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: 'environment'
        }

    }
    );
    video.srcObject = stream;
    snapBtn.onclick = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        document.getElementById('camera').classList.add('hidden');
        document.getElementById('loadingSpinner').classList.remove('hidden');
        const base64 = canvas.toDataURL('image/jpeg').split(',')[1];
        capturedBase64 = base64;
        sendToGemini(base64);

    };

}
);
document.getElementById('closeCamera').addEventListener('click', () => {
    const video = document.getElementById('videoPreview');
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;

    }
    video.srcObject = null;
    document.getElementById('camera').classList.add('hidden');

}
);

/* ---------------------------  GEMINI  --------------------------- */
async function sendToGemini(base64img) {
    const body = {
        generationConfig: {
            temperature: 0.2  // 👈 Makes AI output more stable
        },
        contents: {
            parts: [{
                inline_data: {
                    mime_type: 'image/jpeg', data: base64img
                }

            }
                , {
                text: `Analyze this item. Detect the item, detect whether it is recyclable or not.\nIf the item is recyclable, determine if it most likely is CRV. If it is, estimate return amount money.\nHere is a list of items usually listed as CRV:\n  - Glass Beer and other malt bottles\n  - Glass wine coolers\n  - Plastic Soda bottles and aluminum cans\n  - Plastic water bottles\n  - Plastic sports drinks bottles\n  - Tea and coffee drinks\n  - Juice cans and bottles (100% juice containers need to be less than 46 ounces)\n  - Vegetable juice (less than 16 ounces)\n\nPLEASE ONLY RESPOND WITH ONE OF THESE:\n[RECYCABLE, (ITEM NAME)]\n[NON-R, (ITEM NAME)]\n[CRV, (ESTIMATED-MONEY), (ITEM NAME)]\n\nExample:\n[RECYCABLE, Plastic Lid]\n[NON-R, Metal Water Bottle]\n[CRV, $0.20, Plastic Water Bottle]`
            }
            ]
        }

    };
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST', headers: {
                'Content-Type': 'application/json'
            }
            , body: JSON.stringify(body)
        }
        );
        const data = await res.json();
        const text = data.candidates[0]?.content?.parts[0]?.text.trim();
        showResult(text);

    }
    catch (err) {
        console.error('Gemini error:', err);
        const resultDiv = document.getElementById('result');
        resultDiv.innerHTML = '⚠️ Error analyzing image.';
        resultDiv.classList.remove('hidden');

    }
    finally {
        document.getElementById('loadingSpinner').classList.add('hidden');

    }

}


/* ---------------------------  RESULT UI --------------------------- */
async function showResult(text) {
    const resultDiv = document.getElementById('result');
    resultDiv.classList.remove('hidden');
    resultDiv.classList.add('fixed', 'inset-0', 'flex', 'flex-col', 'items-center', 'justify-center', 'text-white', 'text-center', 'p-6', 'z-50');
    resultDiv.classList.remove('bg-card');
    if (text.startsWith('[RECYCABLE')) {
        const material = text.split(',')[1].replace(']', '').trim();
        resultDiv.style.backgroundColor = '#16a34a';
        resultDiv.innerHTML = `<div class="text-7xl mb-6 animate-bounce">♻️</div><div class="text-3xl font-bold mb-2">Recyclable</div><div class="text-lg">Detected: <strong>${material}</strong></div><button onclick="askWhyExplanation('${material}','RECYCABLE')" class="mt-6 px-4 py-2 bg-yellow-400 text-white rounded-md hover:bg-yellow-500">Learn Why</button><button onclick="askHowToRecycle('${material}','RECYCABLE')" class="mt-3 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">How To</button><button onclick="closeResult()" class="mt-6 px-6 py-3 bg-white text-green-700 font-semibold rounded-xl">Close</button>`;
        const user = auth.currentUser;
        if (user) {
            await updateStreak(user.uid);
            await addPointsToUser(user.uid);
            await addToCollection(user.uid, material, 'rec', `data:image/jpeg;base64,${capturedBase64}`);

        }
        refreshProfile();

    }
    else if (text.startsWith('[NON-R')) {
        const item = text.split(',')[1].replace(']', '').trim();
        resultDiv.style.backgroundColor = '#dc2626';
        resultDiv.innerHTML = `<div class="text-7xl mb-6 animate-bounce">❌</div><div class="text-3xl font-bold mb-2">Not Recyclable</div><div class="text-lg">Detected: <strong>${item}</strong></div><button onclick="askWhyExplanation('${item}','NON-R')" class="px-4 py-2 bg-yellow-400 text-white rounded-md hover:bg-yellow-500">Learn Why</button><button onclick="closeResult()" class="mt-6 px-6 py-3 bg-white text-red-700 font-semibold rounded-xl">Close</button>`;
        const user = auth.currentUser;
        if (user) {
            await updateStreak(user.uid);
            await addToCollection(user.uid, item, 'nrec', `data:image/jpeg;base64,${capturedBase64}`);

        }
        refreshProfile();

    }
    else if (text.startsWith('[CRV')) {
        const refund = text.split(',')[1];
        const itemName = text.split(',')[2].replace(']', '').trim();
        resultDiv.style.backgroundColor = '#facc15';
        resultDiv.innerHTML = `<div class="text-7xl mb-6 animate-bounce">💵</div><div class="text-3xl font-bold mb-2">CRV Eligible</div><div class="text-lg">Refund: <strong>${refund}</strong></div><div class="text-lg">Detected: <strong>${itemName}</strong></div><button onclick="askWhyExplanation('${itemName}','CRV')" class="mt-6 px-4 py-2 bg-green-400 text-white rounded-md hover:bg-green-500">Learn Why</button><button onclick="askHowToRecycle('${itemName}','CRV')" class="mt-3 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">How To</button><button onclick="closeResult();switchTab('map');" class="mt-6 px-6 py-3 bg-white text-yellow-700 font-semibold rounded-xl">Find Nearest Center</button>`;
        const user = auth.currentUser;
        if (user) {
            await updateStreak(user.uid);
            await addPointsToUser(user.uid);
            await addToCollection(user.uid, itemName, 'crv', `data:image/jpeg;base64,${capturedBase64}`);

        }
        refreshProfile();

    }
    else {
        resultDiv.style.backgroundColor = '#6b7280';
        resultDiv.innerHTML = `<div class="text-7xl mb-6">❓</div><div class="text-3xl font-bold mb-2">Unknown</div><div class="text-lg">Could not recognize clearly.</div><button onclick="closeResult()" class="mt-6 px-6 py-3 bg-white text-gray-700 font-semibold rounded-xl">Close</button>`;

    }

}

function closeResult() {
    const resultDiv = document.getElementById('result');
    resultDiv.classList.add('hidden');
    resultDiv.classList.remove('fixed', 'inset-0', 'flex', 'flex-col', 'items-center', 'justify-center', 'text-white', 'z-50');
    resultDiv.style.backgroundColor = '';
    resultDiv.innerHTML = '';

}


/* ---------------------------  HOW & WHY POPUP  --------------------------- */
document.getElementById('closeWhy').onclick = () => {
    document.getElementById('whyPopup').classList.add('hidden');

};
document.getElementById('closeHowTo').onclick = () => {
    document.getElementById('howToPopup').classList.add('hidden');

};

async function askWhyExplanation(itemName, type) {

    let reason = (type === 'RECYCABLE') ? 'can be recyclable' : 'cannot be recyclable';
    if (type === 'CRV') {
        reason = 'can be recycled with CRV refund.';

    }
    const prompt = `Explain to the user: Explain in 3 short sentences of why ${itemName} ${reason}.\nAnswer in this format:\n\n[2 SENTENCE RESPONSE]`;

    const body = {
        contents: [{
            parts: [{
                text: prompt
            }
            ]
        }
        ]
    };
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST', headers: {
                'Content-Type': 'application/json'
            }
            , body: JSON.stringify(body)
        }
        );
        const data = await res.json();
        const explanation = data.candidates[0]?.content?.parts[0]?.text.trim() || 'Could not fetch explanation.';
        document.getElementById('whyText').textContent = explanation;
        document.getElementById('whyPopup').classList.remove('hidden');

    }
    catch (err) {
        document.getElementById('whyText').textContent = '⚠️ Failed to load explanation.';
        document.getElementById('whyPopup').classList.remove('hidden');

    }


}

function askHowToRecycle(itemName, type) {
    const style = (type === 'CRV') ? 'how to recycle AND get refund at centers' : 'how to properly recycle curbside or center';
    const prompt = `Explain to a normal user in 2 short sentences: How to recycle ${itemName} (${style}).`;
    const body = {
        contents: [{
            parts: [{
                text: prompt
            }
            ]
        }
        ]
    };
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: {
            'Content-Type': 'application/json'
        }
        , body: JSON.stringify(body)
    }
    ).then(res => res.json()).then(data => {
        const explanation = data.candidates[0]?.content?.parts[0]?.text.trim() || 'Could not load instructions.';
        document.getElementById('howToText').textContent = explanation;
        document.getElementById('howToPopup').classList.remove('hidden');

    }
    ).catch(err => {
        console.error('How To popup error:', err.message);
        document.getElementById('howToText').textContent = 'Failed to load instructions.';
        document.getElementById('howToPopup').classList.remove('hidden');

    }
    );

}


/* ---------------------------  MAP INIT & NEAREST --------------------------- */
function initMap() {
    return new Promise(resolve => {
        const mapContainer = document.getElementById('map');
        mapContainer.innerHTML = '<p class="text-center p-4">📍 Getting your location…</p>';
        if (!navigator.geolocation) {
            mapContainer.innerHTML = '<p class="text-center p-4 text-red-600">Geolocation not supported.</p>';
            resolve();
            return;

        }
        navigator.geolocation.getCurrentPosition(pos => {
            const {
                latitude: lat, longitude: lon
            }
                = pos.coords;
            mapContainer.innerHTML = '';
            const loadingMessage = document.createElement('div');
            loadingMessage.id = 'mapLoading';
            loadingMessage.className = 'absolute top-4 left-1/2 -translate-x-1/2 bg-white text-muted py-2 px-4 rounded-lg shadow-lg';
            loadingMessage.innerHTML = '🔄 Loading nearby centers...';
            mapContainer.appendChild(loadingMessage);
            map = L.map('map').setView([lat, lon], 11);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 19
            }).addTo(map);
            const userIcon = L.icon({
                iconUrl: 'https://cdn-icons-png.flaticon.com/512/727/727634.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32]
            }
            );
            L.marker([lat, lon], {
                icon: userIcon
            }
            ).addTo(map).bindPopup('You are here');
            fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`).then(res => res.json()).then(data => {
                const userCity = data.address.city || data.address.town || data.address.village || '';
                loadSitesFilteredByCity(userCity).then(() => {
                    resolve();

                }
                );

            }
            ).catch(() => {
                loadSitesFilteredByCity('').then(() => {
                    resolve();

                }
                );

            }
            );

        }
            , () => {
                mapContainer.innerHTML = '<p class="text-center p-4 text-red-600">Location error. Allow access and try again.</p>';
                resolve();

            }
        );
        mapReady = true;

    }
    );

}

function loadSitesFilteredByCity(userCity) {
    fetch('data/crv_centers_address_only.json').then(res => res.json()).then(data => {
        let matches = data.filter(site => site.city.toLowerCase() === userCity.toLowerCase());
        if (matches.length === 0 && userCity) {
            const grouped = data.reduce((acc, site) => {
                acc[site.city] = acc[site.city] || [];
                acc[site.city].push(site);
                return acc;

            }
                , {

                }
            );
            const fallbackCity = Object.keys(grouped).find(c => c.toLowerCase().includes(userCity.toLowerCase().slice(0, 3)));
            matches = grouped[fallbackCity] || [];

        }
        const recycleIcon = L.icon({
            iconUrl: 'https://cdn-icons-png.flaticon.com/512/1327/1327264.png', iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -28]
        }
        );
        matches.forEach(site => {
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(site.full_address)}`).then(res => res.json()).then(loc => {
                if (loc && loc.length > 0) {
                    const lat = parseFloat(loc[0].lat);
                    const lon = parseFloat(loc[0].lon);
                    const marker = L.marker([lat, lon], {
                        icon: recycleIcon
                    }
                    ).addTo(map);
                    marker.bindPopup(`<strong>${site.name}</strong><br>${site.address}<br><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.full_address)}" target="_blank">Open in Maps</a>`);
                    marker._icon.style.animation = "bounce 0.8s";

                }

            }
            );

        }
        );

    }
    );
    const loadingElement = document.getElementById('mapLoading');
    if (loadingElement) loadingElement.remove();

}

async function highlightNearestRecycleCenter() {
    const res = await fetch('data/crv_centers_address_only.json');
    const centers = await res.json();
    navigator.geolocation.getCurrentPosition(async pos => {
        const userLat = pos.coords.latitude;
        const userLon = pos.coords.longitude;
        let nearest = null;
        let nearestDist = Infinity;
        for (const site of centers) {
            const geo = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(site.full_address)}`).then(r => r.json());
            if (geo.length > 0) {
                const lat = parseFloat(geo[0].lat);
                const lon = parseFloat(geo[0].lon);
                const dist = Math.sqrt((lat - userLat) ** 2 + (lon - userLon) ** 2);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearest = {
                        lat, lon, name: site.name, address: site.address, full_address: site.full_address
                    };

                }

            }

        }
        if (nearest) {
            const recycleIcon = L.icon({
                iconUrl: 'https://cdn-icons-png.flaticon.com/512/1327/1327264.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -28]
            }
            );
            const marker = L.marker([nearest.lat, nearest.lon], {
                icon: recycleIcon
            }
            ).addTo(map);
            map.setView([nearest.lat, nearest.lon], 15);
            marker.bindPopup(`<strong>${nearest.name}</strong><br>${nearest.address}<br><a href='https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nearest.full_address)}' target='_blank'>Open in Maps</a>`).openPopup();

        }

    }
    );

}


/* ---------------------------  AUTH POPUP --------------------------- */
function openAuthPopup() {
    signupMode = false;
    document.getElementById('authTitle').textContent = 'Sign In';
    document.getElementById('authMainBtn').textContent = 'Login';
    document.getElementById('switchAuthMode').textContent = 'Signup';
    document.getElementById('authPopup').classList.remove('hidden');

}

document.getElementById('closeAuth').onclick = () => {
    document.getElementById('authPopup').classList.add('hidden');

};
document.getElementById('switchAuthMode').onclick = () => {
    signupMode = !signupMode;
    document.getElementById('authTitle').textContent = signupMode ? 'Sign Up' : 'Sign In';
    document.getElementById('authMainBtn').textContent = signupMode ? 'Create Account' : 'Login';
    document.getElementById('switchAuthMode').textContent = signupMode ? 'Already have an account? Sign In' : 'Signup';
    document.getElementById('googleBtnText').textContent = signupMode ? 'Sign up with Google' : 'Sign in with Google';
};
document.getElementById('authMainBtn').onclick = () => {
    const email = document.getElementById('emailInput').value.trim();
    const password = document.getElementById('passwordInput').value.trim();
    if (signupMode) {
        auth.createUserWithEmailAndPassword(email, password).then(userCredential => {
            const user = userCredential.user;
            db.collection('users').doc(user.uid).set({
                currentStreak: 0, longestStreak: 0, lastScanDate: '', streakFreezeAvailable: false
            }
            );
            document.getElementById('authPopup').classList.add('hidden');
            scheduleDailyReminder();
            refreshProfile();
            loadDashboardStats();
        }
        ).catch(e => alert('Signup error: ' + e.message));

    }
    else {
        auth.signInWithEmailAndPassword(email, password).then(userCredential => {
            const user = userCredential.user;
            const userRef = db.collection('users').doc(user.uid);
            userRef.get().then(doc => {
                if (!doc.exists) {
                    userRef.set({
                        currentStreak: 0, longestStreak: 0, lastScanDate: '', streakFreezeAvailable: false
                    }
                    );

                }

            }
            );
            document.getElementById('authPopup').classList.add('hidden');
            scheduleDailyReminder();
            refreshProfile();
            loadDashboardStats();
        }
        ).catch(e => alert('Login error: ' + e.message));

    }

};
document.getElementById('googleBtn').onclick = async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
        document.getElementById('authPopup').classList.add('hidden');
        scheduleDailyReminder();
        refreshProfile();
        loadDashboardStats();
    }
    catch (error) {
        console.error('Google Sign-in error:', error.message);
        alert('Failed to login with Google: ' + error.message);

    }

};

/* ---------------------------  HELPERS --------------------------- */
function calculateLevel(points) {
    if (points >= 200) return {
        name: 'Master Recycler', badge: '🏆'
    };
    if (points >= 100) return {
        name: 'Expert Recycler', badge: '🥇'
    };
    if (points >= 50) return {
        name: 'Advanced Recycler', badge: '🥈'
    };
    if (points >= 20) return {
        name: 'Rookie Recycler', badge: '🥉'
    };
    return {
        name: 'Beginner', badge: '🎯'
    };

}

const darkModeToggle = document.getElementById('darkModeToggle');
if (localStorage.getItem('dark_mode') === 'true') {
    document.body.classList.add('dark');
    darkModeToggle.checked = true;

}
darkModeToggle.addEventListener('change', () => {
    const enabled = darkModeToggle.checked;
    document.body.classList.toggle('dark', enabled);
    localStorage.setItem('dark_mode', enabled);

}
);

function scheduleDailyReminder() {
    const now = new Date();
    const targetHour = 18; // 6:00 PM daily
    const targetMinute = 0;

    const target = new Date();
    target.setHours(targetHour, targetMinute, 0, 0);

    if (target < now) {
        target.setDate(target.getDate() + 1); // schedule for tomorrow if already past
    }

    const delay = target - now;
    console.log(`Next notification in ${(delay / 1000 / 60).toFixed(1)} minutes.`);

    setTimeout(() => {
        sendRecycleReminder();
        setInterval(sendRecycleReminder, 24 * 60 * 60 * 1000); // daily from then on
    }, delay);
}

function sendRecycleReminder() {
    if (Notification.permission === 'granted') {
        new Notification('♻️ Reminder', {
            body: 'Don’t forget to recycle something today!',
            icon: '../icons/icon-192.png'
        });
    }
}

window.addEventListener('load', async () => {
    if ('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                console.log('🔔 Notifications enabled!');
                scheduleDailyReminder();
            }
        });
    } else if (Notification.permission === 'granted') {
        scheduleDailyReminder(); // Already granted
    }

    const metaRef = firebase.firestore().collection('meta').doc('appVersion');
    const doc = await metaRef.get();
    let serverVersion = doc.exists ? doc.data().version : null;

    if (serverVersion) {
        const compare = compareVersions(LOCAL_APP_VERSION, serverVersion);

        if (compare < 0) {
            // 🔒 Client version is older → block use
            document.body.innerHTML = `
        <div class="min-h-screen flex items-center justify-center bg-gray-100 text-center px-4">
          <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold mb-4">Update Required</h2>
            <p class="mb-4">A newer version of the app is available. Please refresh or reinstall to continue.</p>
            <button onclick="location.reload()" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Refresh</button>
          </div>
        </div>
      `;
            return;
        }

        if (compare > 0) {
            // 🚀 Local version is newer → auto-update Firestore
            await metaRef.set({ version: LOCAL_APP_VERSION }, { merge: true });
        }
    } else {
        // 🔧 Firestore version doesn't exist → set initial
        await metaRef.set({ version: LOCAL_APP_VERSION });
    }

    document.getElementById('appVersionDisplay').textContent = LOCAL_APP_VERSION;
});

async function loadDashboardStats() {
    const user = auth.currentUser;
    if (!user) {
        document.getElementById('dashboardDiv').innerHTML = `
          <p class="text-center text-gray-500 col-span-2">🔒 Sign in to view your dashboard stats and earn points.</p>
        `;
        return;
    }
    if (!user) return;
    document.getElementById('dashboardDiv').innerHTML = `
          <div class="bg-card rounded-lg p-4 text-center shadow">
          <p class="text-sm text-muted">Total Scanned</p>
          <p class="text-2xl font-bold text-green-700" id="statTotal">--</p>
        </div>
        <div class="bg-card rounded-lg p-4 text-center shadow">
          <p class="text-sm text-muted">CRV Items</p>
          <p class="text-2xl font-bold text-yellow-500" id="statCRV">--</p>
        </div>
        <div class="bg-card rounded-lg p-4 text-center shadow col-span-2">
          <p class="text-sm text-muted">Points</p>
          <p class="text-2xl font-bold text-blue-600" id="statPoints">--</p>
        </div>
        <div class="col-span-2 bg-gray-200 h-3 rounded-full overflow-hidden shadow-inner">
          <div id="levelProgress" class="bg-green-500 h-full transition-all duration-500 ease-out" style="width: 100%">
          </div>
        </div>
        <div class="w-full flex justify-center col-span-2" style="margin-top: 2px; margin-bottom: 2px;">
          <p id="percentLabel" class="text-sm text-gray-500 text-center" style="margin-top: 2px; margin-bottom: 2px;">
          </p>
        </div>
        <div class="w-full flex justify-center">
          <p id="levelCountLabel" class="text-sm text-gray-500 mt-1 text-center font-bold"></p>
        </div>
        <div class="w-full flex justify-center">
          <p id="levelLabel" class="text-sm text-gray-500 mt-1 text-center"></p>
        </div>`;
    const snapshot = await db.collection('users').doc(user.uid).collection('collection').get();
    let crvCount = 0;
    let last = null;

    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.type === 'crv') crvCount++;
        if (!last || data.timestamp?.seconds > last.timestamp?.seconds) {
            last = data;
        }
    });

    animateCount('statTotal', snapshot.size);
    animateCount('statCRV', crvCount);
    const streakData = await fetchStreak(user.uid);
    animateCount('statPoints', streakData.pt);
    updateLevelProgress(streakData.pt);

    const lastDiv = document.getElementById('lastItem');
    if (last) {
        lastDiv.innerHTML = `
        <img src="${last.image}" class="w-12 h-12 rounded inline-block mr-2 object-cover">
        <span>${last.name} (${last.type.toUpperCase()})</span>
      `;
    }
}

document.querySelector('button[data-tab="main"]').addEventListener('click', () => {
    loadDashboardStats();
});

let loadFunc = setInterval(() => {
    if (document.getElementById('page-main') && !document.getElementById('page-main').classList.contains('hidden')) {
        loadDashboardStats();
        clearInterval(loadFunc);
    }
}, 2000); // refresh every 10 seconds while on main tab  
