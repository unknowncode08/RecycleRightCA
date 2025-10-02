// --- CONFIGURATION & INITIALIZATION ---

const firebaseConfig = FIREBASE_CONFIG;

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Global Variables
const API_KEY = GEMINI_API_KEY;
const LOCAL_APP_VERSION = "0.0.1.13";

const videoPreviewEl = document.getElementById('videoPreview'); // <-- ADD THIS LINE
let stream = null;
let map = null;
let mapReady = false;
let signupMode = false;
let capturedBase64;
let isMultiSelectMode = false;
let suppressNextClick = false;
const selectedItems = new Set();
const pages = { main: 'page-main', map: 'page-map', profile: 'page-profile', settings: 'page-settings', collection: 'page-collection' };

// This is your customizable list of special items.
// The "key" (e.g., "coca-cola") is what the script looks for in the AI's response.
// "name" is the official title of the trophy.
// "art" is the path to your custom image for the trophy.
const specialItems = {
    "coca-cola": { id: "coke_trophy", name: "Classic Cola", art: "images/trophies/coke.png" },
    "pepsi": { id: "pepsi_trophy", name: "The Challenger", art: "images/trophies/pepsi.png" },
    "starbucks": { id: "starbucks_trophy", name: "Morning Ritual", art: "images/trophies/starbucks.png" },
    "lay's": { id: "lays_trophy", name: "Chip Champion", art: "images/trophies/lays.png" },
    "arizona": { id: "arizona_trophy", name: "Green Tea Giant", art: "images/trophies/arizona.png" },
    "water bottle": { id: "water_bottle_trophy", name: "Hydration Hero", art: "images/trophies/waterbottle.png" },
    "milk jug": { id: "milk_jug_trophy", name: "Dairy Defender", art: "images/trophies/milk.png" },
    "wine bottle": { id: "wine_trophy", name: "Vineyard Valor", art: "images/trophies/wine.png" },
    "beer can": { id: "beer_can_trophy", name: "Brew Master", art: "images/trophies/beer.png" },
    "sprite": { id: "sprite_trophy", name: "Sparkling Spirit", art: "images/trophies/sprite.png" },
    "dr pepper": { id: "drpepper_trophy", name: "PhD in Flavor", art: "images/trophies/drpepper.png" },
    "mountain dew": { id: "mountaindew_trophy", name: "Dew Dropper", art: "images/trophies/mountaindew.png" },
    "gatorade": { id: "gatorade_trophy", name: "Electrolyte Enthusiast", art: "images/trophies/gatorade.png" },
    "tropicana": { id: "tropicana_trophy", name: "Citrus Collector", art: "images/trophies/tropicana.png" },
    "pringles": { id: "pringles_trophy", name: "Tube Treasure", art: "images/trophies/pringles.png" },
    "oreos": { id: "oreos_trophy", name: "Cookie Conqueror", art: "images/trophies/oreos.png" },
    "plastic bag": { id: "plastic_bag_trophy", name: "Bag Banisher", art: "images/trophies/plasticbag.png" },
    "cardboard box": { id: "cardboard_trophy", name: "Box Boss", art: "images/trophies/cardboard.png" },
    "newspaper": { id: "newspaper_trophy", name: "Print Protector", art: "images/trophies/newspaper.png" },
    "glass jar": { id: "glass_jar_trophy", name: "Jar Jackpot", art: "images/trophies/glassjar.png" },
    "aluminum foil": { id: "foil_trophy", name: "Foil Finder", art: "images/trophies/foil.png" },
};

// --- PRIMARY UI & NAVIGATION ---

/**
 * Switches the visible page and updates the active tab in the navigation bar.
 * @param {string} tabName - The identifier for the tab to switch to (e.g., 'main', 'map').
 */
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchTab(tabName);
        });
    });
});

function switchTab(tabName) {
    const mainContainer = document.getElementById('pages');
    const allTabs = document.querySelectorAll('.tab');
    const allPages = document.querySelectorAll('main > section');

    // Dynamically adjust padding for the map view
    if (tabName === 'map') {
        mainContainer.classList.remove('pb-20');
    } else {
        mainContainer.classList.add('pb-20');
    }

    // Update active tab styles
    allTabs.forEach(t => {
        const isActive = t.dataset.tab === tabName;
        t.classList.toggle('text-green-500', isActive);
        t.classList.toggle('text-muted', !isActive);
    });

    // Show the correct page
    allPages.forEach(p => {
        p.classList.toggle('hidden', p.id !== pages[tabName]);
    });

    // Show/hide the floating scan button
    document.getElementById('floatingScanBtn').style.display = (tabName === 'main') ? 'flex' : 'none';

    // Page-specific actions
    // Page-specific actions
    if (tabName === 'main') {
        loadDashboardStats();
        checkStreakReminder(); // <-- ADD THIS LINE
    }
    if (tabName === 'map' && !mapReady) initMap();
    if (tabName === 'profile') refreshProfile();
    if (tabName === 'collection') {
        // Default to the items tab view
        document.getElementById('itemsTab').click();
        refreshCollection();
    }
    if (isMultiSelectMode) exitMultiSelectMode();
}

/**
 * Attaches click listeners to all main navigation tabs.
 */
const tabWrapper = document.getElementById('tabWrapper');
const collectionTab = document.getElementById('itemsTab');
const museumTab = document.getElementById('museumTab');

collectionTab.addEventListener('click', () => {
    // Slide to show the Items tab (left side)
    tabWrapper.style.transform = 'translateX(0%)';

    // Update tab styles
    collectionTab.classList.add('bg-emerald-500', 'text-white');
    museumTab.classList.remove('bg-emerald-500', 'text-white');
});

museumTab.addEventListener('click', () => {
    // Slide to show the Museum tab (right side)
    tabWrapper.style.transform = 'translateX(-50%)';

    // Update tab styles
    museumTab.classList.add('bg-emerald-500', 'text-white');
    collectionTab.classList.remove('bg-emerald-500', 'text-white');

    refreshMuseum();
});


/**
 * Opens the device camera to scan an item.
 */
document.getElementById('floatingScanBtn').addEventListener('click', async () => {
    const cameraView = document.getElementById('camera');
    cameraView.classList.remove('hidden');
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        videoPreviewEl.srcObject = stream; // Use the new variable
    } catch (err) {
        console.error("Camera Error:", err);
        alert("Could not access the camera. Please check permissions.");
        cameraView.classList.add('hidden');
    }
});

/**
 * Captures a photo from the video stream and sends it for analysis.
 */
document.getElementById('snapBtn').onclick = () => {
    if (!stream) return; // Don't do anything if the camera isn't running

    const canvas = document.createElement('canvas');
    canvas.width = videoPreviewEl.videoWidth;  // Use the new variable
    canvas.height = videoPreviewEl.videoHeight; // Use the new variable
    canvas.getContext('2d').drawImage(videoPreviewEl, 0, 0);

    // Stop the camera stream
    stream.getTracks().forEach(track => track.stop());
    videoPreviewEl.srcObject = null;
    stream = null;

    // Hide camera and show loading spinner
    document.getElementById('camera').classList.add('hidden');
    document.getElementById('loadingSpinner').classList.remove('hidden');

    // Send image for analysis
    capturedBase64 = canvas.toDataURL('image/jpeg').split(',')[1];
    sendToGemini(capturedBase64);
};

/**
 * Closes the camera view.
 */
document.getElementById('closeCamera').onclick = () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null; // Clear the stream
    }
    document.getElementById('camera').classList.add('hidden');
};


// --- AUTHENTICATION ---

/**
 * Signs the current user out and reloads the page.
 */
function logout() {
    auth.signOut().then(() => {
        console.log("User signed out successfully.");
        window.location.reload();
    }).catch((error) => {
        console.error("Sign out error:", error);
        alert("Failed to sign out: " + error.message);
    });
}

/**
 * Fetches user data and populates the profile page.
 */
async function refreshProfile() {
    // This function from your file is correct, no changes needed here.
    const profileContent = document.getElementById('profileContent');
    const user = auth.currentUser;
    if (user) {
        const streakData = await fetchStreak(user.uid);
        const points = streakData.pt;
        const { name: levelName, badge } = calculateLevel(points);
        let streakBadge = '';
        if (streakData.current >= 90) streakBadge = '🔥 90-Day Master';
        else if (streakData.current >= 30) streakBadge = '🏆 30-Day Legend';
        else if (streakData.current >= 7) streakBadge = '🥇 7-Day Champ';
        profileContent.innerHTML = `
        <div class="w-full space-y-6 flex flex-col items-center">
            <div class="flex flex-col items-center text-center">
                <div class="rounded-full bg-emerald-100/30 w-28 h-28 flex items-center justify-center text-5xl shadow-inner mb-4">${badge}</div>
                <p class="text-2xl font-bold">${levelName}</p>
                <p class="text-sm text-muted">${user.email}</p>
                ${streakBadge ? `<p class="mt-2 text-sm font-semibold text-emerald-500">${streakBadge}</p>` : ''}
            </div>
            <div class="w-full grid grid-cols-2 gap-4 text-center">
                <div class="glass-card rounded-xl p-3"><p class="text-sm text-muted">Points</p><p class="text-2xl font-semibold text-blue-500">${points}</p></div>
                <div class="glass-card rounded-xl p-3"><p class="text-sm text-muted">Current Streak</p><p class="text-2xl font-semibold">${streakData.current} days</p></div>
                <div class="glass-card rounded-xl p-3"><p class="text-sm text-muted">Longest Streak</p><p class="text-2xl font-semibold">${streakData.longest} days</p></div>
                <div class="glass-card rounded-xl p-3"><p class="text-sm text-muted">Streak Freeze</p><p class="text-2xl font-semibold">${streakData.freeze ? '❄️' : 'None'}</p></div>
            </div>
            <div id="freezeSection" class="w-full pt-2"></div>
            <button onclick="logout()" class="w-full px-6 py-3 bg-red-500/10 dark:bg-red-500/20 text-red-500 font-semibold rounded-lg hover:bg-red-500/20 dark:hover:bg-red-500/30">Sign Out</button>
        </div>`;
        if (!streakData.freeze) {
            document.getElementById('freezeSection').innerHTML = `<button onclick="buyStreakFreeze()" class="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600">Buy Streak Freeze (50 pts)</button>`
        }
    } else {
        profileContent.innerHTML = `<div class="space-y-6 flex flex-col items-center"><p class="text-lg text-muted">You are currently signed out.</p><button onclick="openAuthPopup()" class="px-6 py-2 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-md hover:to-emerald-700">Sign In</button></div>`;
    }
}


// --- DATA & STATS ---

/**
 * Checks if the user's streak is at risk and shows a reminder card if needed.
 */
async function checkStreakReminder() {
    const user = auth.currentUser;
    const reminderCard = document.getElementById('streakReminderCard');
    if (!user || !reminderCard) {
        if (reminderCard) reminderCard.classList.add('hidden');
        return;
    }

    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists) return;

    const lastScanDate = userDoc.data().lastScanDate; // e.g., "2025-08-01"
    const currentStreak = userDoc.data().currentStreak || 0;

    if (!lastScanDate || currentStreak === 0) {
        reminderCard.classList.add('hidden');
        return;
    }

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const lastScan = new Date(lastScanDate);
    // Adjust for timezone differences by comparing just the date part
    const todayStr = today.toISOString().slice(0, 10);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    // Show the reminder only if the last scan was yesterday (meaning today is the deadline)
    if (lastScanDate === yesterdayStr && lastScanDate !== todayStr) {
        reminderCard.classList.remove('hidden');
    } else {
        reminderCard.classList.add('hidden');
    }
}

/**
 * Loads and displays the main dashboard statistics, including the last scanned item.
 */
async function loadDashboardStats() {
    const user = auth.currentUser;
    // Target dashboard elements
    const statPointsEl = document.getElementById('statPoints');
    const statTotalEl = document.getElementById('statTotal');
    const statCrvEl = document.getElementById('statCRV');
    const lastItemEl = document.getElementById('lastItem');

    // If user is not logged in, reset stats to default
    if (!user) {
        if (statPointsEl) statPointsEl.textContent = '--';
        if (statTotalEl) statTotalEl.textContent = '--';
        if (statCrvEl) statCrvEl.textContent = '--';
        if (lastItemEl) lastItemEl.innerHTML = '<span class="text-muted">None yet</span>';
        updateLevelProgress(0);
        return;
    }

    // --- Fetch all user data in parallel for speed ---
    const [streakData, collectionSnapshot] = await Promise.all([
        fetchStreak(user.uid),
        db.collection('users').doc(user.uid).collection('collection').get()
    ]);

    // --- Update Points and Level ---
    statPointsEl.textContent = streakData.pt;
    updateLevelProgress(streakData.pt);

    // --- Update Total Scanned and CRV Count ---
    let crvCount = 0;
    collectionSnapshot.forEach(doc => {
        if (doc.data().type === 'crv') crvCount++;
    });
    statTotalEl.textContent = collectionSnapshot.size;
    statCrvEl.textContent = crvCount;

    // --- Find and Display the Last Scanned Item ---
    // This is the restored logic
    const lastItemQuery = db.collection('users').doc(user.uid).collection('collection').orderBy('timestamp', 'desc').limit(1);
    const lastItemSnapshot = await lastItemQuery.get();

    if (!lastItemSnapshot.empty) {
        const lastItem = lastItemSnapshot.docs[0].data();
        lastItemEl.innerHTML = `
            <div class="flex items-center gap-3">
                <img src="${lastItem.image}" class="w-12 h-12 rounded-lg object-cover shadow-md" alt="${lastItem.name}">
                <div>
                    <p class="font-semibold">${lastItem.name}</p>
                    <p class="text-sm text-muted">${lastItem.type.toUpperCase()}</p>
                </div>
            </div>
        `;
    } else {
        lastItemEl.innerHTML = '<span class="text-muted">None yet</span>';
    }
}

/**
 * Updates the level progress bar and labels.
 * @param {number} points - The user's current point total.
 */
function updateLevelProgress(points) {
    const progressBar = document.getElementById('levelProgress');
    const labelCount = document.getElementById('levelCountLabel');
    const perLabel = document.getElementById('percentLabel');
    if (!progressBar || !labelCount || !perLabel) return;

    let level = 0;
    let nextLevelPoints = 20;

    if (points >= 200) { level = 4; nextLevelPoints = Infinity; }
    else if (points >= 100) { level = 3; nextLevelPoints = 200; }
    else if (points >= 50) { level = 2; nextLevelPoints = 100; }
    else if (points >= 20) { level = 1; nextLevelPoints = 50; }

    const prevLevelPoints = [0, 20, 50, 100, 200][level];
    const progress = points - prevLevelPoints;
    const required = nextLevelPoints - prevLevelPoints;
    const percent = required > 0 && isFinite(required) ? Math.min(100, Math.floor((progress / required) * 100)) : 100;

    perLabel.textContent = `${percent}%`;
    labelCount.textContent = `Level: ${level}`;
    progressBar.style.width = `${percent}%`;
}

/**
 * Calculates user level and badge.
 * @param {number} points - The user's current point total.
 */
function calculateLevel(points) {
    if (points >= 200) return { name: 'Master Recycler', badge: '🏆' };
    if (points >= 100) return { name: 'Expert Recycler', badge: '🥇' };
    if (points >= 50) return { name: 'Advanced Recycler', badge: '🥈' };
    if (points >= 20) return { name: 'Rookie Recycler', badge: '🥉' };
    return { name: 'Beginner', badge: '🎯' };
}

// --- MUSEUM & ACHIEVEMENTS ---

/**
 * Checks if a scanned item is a special item and unlocks an achievement if so.
 * @param {string} itemName - The name of the item detected by the AI.
 */
async function checkForSpecialItem(itemName) {
    const user = auth.currentUser;
    if (!user) return;

    const lowerCaseItemName = itemName.toLowerCase();

    for (const key in specialItems) {
        if (lowerCaseItemName.includes(key)) {
            const trophy = specialItems[key];
            await unlockAchievement(user.uid, trophy);
            break; // Stop after finding the first match
        }
    }
}

/**
 * Saves a new trophy to the user's museum and shows the unlock popup.
 * @param {string} userId - The user's unique ID.
 * @param {object} trophy - The trophy object from the specialItems list.
 */
async function unlockAchievement(userId, trophy) {
    const museumRef = db.collection('users').doc(userId).collection('museum');

    playSound('sounds/trophy_success.mp3');
    triggerHaptic();

    const trophyDoc = await museumRef.doc(trophy.id).get();

    // Only unlock it if the user doesn't already have it
    if (!trophyDoc.exists) {
        await museumRef.doc(trophy.id).set({
            name: trophy.name,
            art: trophy.art,
            unlockedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Show the "Trophy Unlocked!" popup
        document.getElementById('trophyArt').src = trophy.art;
        document.getElementById('trophyName').textContent = trophy.name;
        const popup = document.getElementById('trophyPopup');
        popup.classList.remove('hidden');

        // Hide the popup after a few seconds
        setTimeout(() => {
            popup.classList.add('hidden');
        }, 3500);
    }
}

/**
 * Fetches and displays all possible trophies, showing which are unlocked and which are locked.
 * Unlocked trophies are displayed first. Uses a fallback image if custom art is missing.
 */
async function refreshMuseum() {
    const museumGrid = document.getElementById('museumGrid');
    museumGrid.innerHTML = '<p class="text-muted text-center col-span-full">Loading your museum...</p>';
    const user = auth.currentUser;
    if (!user) {
        museumGrid.innerHTML = '<p class="text-muted text-center col-span-full">Sign in to view your museum.</p>';
        return;
    }

    // 1. Get a list of all trophy IDs the user has unlocked.
    const unlockedSnapshot = await db.collection('users').doc(user.uid).collection('museum').get();
    const unlockedTrophyIds = new Set(unlockedSnapshot.docs.map(doc => doc.id));

    // 2. Prepare two separate arrays for sorting.
    const unlockedHtml = [];
    const lockedHtml = [];

    // 3. Loop through ALL possible trophies defined in the `specialItems` list.
    for (const key in specialItems) {
        const trophy = specialItems[key];
        const fallbackImage = "'images/trophies/lock.png'"; // Define the fallback image path

        // 4. Check if the user has unlocked the current trophy.
        if (unlockedTrophyIds.has(trophy.id)) {
            // If UNLOCKED, create the normal, full-color card.
            unlockedHtml.push(`
                <div class="glass-card rounded-2xl p-6 text-center space-y-2">
                    <img src="${trophy.art}" onerror="this.src=${fallbackImage}" class="w-full h-32 object-cover rounded-lg shadow-md" alt="${trophy.name}">
                    <p class="font-semibold text-slate-800 dark:text-white text-sm">${trophy.name}</p>
                </div>
            `);
        } else {
            // If LOCKED, create the blacked-out card with "???".
            lockedHtml.push(`
                <div class="glass-card rounded-2xl p-6 text-center space-y-2 opacity-60">
                    <img src="${trophy.art}" onerror="this.src=${fallbackImage}" class="w-full h-32 object-cover rounded-lg shadow-md trophy-locked" alt="Locked Trophy">
                    <p class="font-semibold text-slate-500 dark:text-gray-400 text-sm">???</p>
                </div>
            `);
        }
    }

    // 5. Combine the arrays (unlocked first) and display them.
    const finalHtml = unlockedHtml.join('') + lockedHtml.join('');

    if (finalHtml) {
        museumGrid.innerHTML = finalHtml;
    } else {
        // This message will show if your specialItems list is empty.
        museumGrid.innerHTML = '<p class="text-muted text-center col-span-full">No trophies have been defined in the app yet.</p>';
    }
}

async function addToCollection(userId, name, type, base64img) {
    const collectionRef = db.collection('users').doc(userId).collection('collection');
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
        itemDiv.className = 'collection-item select-none glass-card p-4 rounded-xl shadow flex items-center gap-4 cursor-pointer transition relative';
        itemDiv.dataset.docId = doc.id;
        // Add the item name to a data attribute for easy searching
        itemDiv.dataset.name = data.name.toLowerCase();

        const minusIcon = `<div class="minus-icon absolute top-0 right-0 m-2 hidden text-red-600 text-lg bg-white rounded-full w-6 h-6 flex items-center justify-center shadow">−</div>`;
        itemDiv.innerHTML = `
          ${minusIcon}
          <img src="${data.image}" alt="${data.name}" class="w-16 h-16 rounded object-cover shadow">
          <div>
            <p class="text-lg font-semibold">${data.name}</p>
            <p class="text-muted">${emoji} ${data.type.toUpperCase()}</p>
          </div>
        `;

        let longPressTimer;
        let longPressed = false;

        itemDiv.addEventListener('mousedown', () => {
            longPressed = false;
            longPressTimer = setTimeout(() => {
                longPressed = true;
                enterMultiSelectMode();
                selectItem(itemDiv);
            }, 2000);
        });

        itemDiv.addEventListener('mouseup', () => {
            clearTimeout(longPressTimer);
        });

        itemDiv.addEventListener('mouseleave', () => {
            clearTimeout(longPressTimer);
        });

        itemDiv.addEventListener('touchstart', () => {
            longPressed = false;
            longPressTimer = setTimeout(() => {
                longPressed = true;
                suppressNextClick = true;
                if (navigator.vibrate) navigator.vibrate(500, 0.8);
                enterMultiSelectMode();
                selectItem(itemDiv);
            }, 800);
        }, { passive: true });

        itemDiv.addEventListener('touchend', () => {
            clearTimeout(longPressTimer);
            setTimeout(() => suppressNextClick = false, 100);
        });

        itemDiv.addEventListener('touchcancel', () => {
            clearTimeout(longPressTimer);
        });

        itemDiv.addEventListener('click', () => {
            if (suppressNextClick) return;
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

document.getElementById('multiDeleteBtn').onclick = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const batch = db.batch();
    const collectionRef = db.collection('users').doc(user.uid).collection('collection');

    for (const docId of selectedItems) {
        const docRef = collectionRef.doc(docId);
        batch.delete(docRef);
    }

    try {
        await batch.commit();
        selectedItems.clear();
        exitMultiSelectMode();
        refreshCollection();
        console.log("Selected items deleted successfully.");
    } catch (e) {
        console.error("Error deleting selected items:", e.message);
        alert("Failed to delete items: " + e.message);
    }
};

/**
 * Handles real-time searching in the collection list.
 */
document.getElementById('collectionSearchInput').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    const allItems = document.querySelectorAll('#collectionList .collection-item');

    allItems.forEach(item => {
        const itemName = item.dataset.name || '';
        if (itemName.includes(searchTerm)) {
            // Use 'grid' for grid items instead of 'flex'
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
});

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

// --- SETTINGS PAGE LOGIC ---

// --- Simple Toggles & Links ---
document.getElementById('soundEffectsToggle').addEventListener('change', (e) => {
    localStorage.setItem('soundEffectsEnabled', e.target.checked);
});

// Initialize toggles from localStorage
document.getElementById('soundEffectsToggle').checked = localStorage.getItem('soundEffectsEnabled') === 'true';

document.getElementById('aboutBtn').addEventListener('click', () => {
    document.getElementById('aboutPopup').classList.remove('hidden');
});
document.getElementById('closeAboutPopup').addEventListener('click', () => {
    document.getElementById('aboutPopup').classList.add('hidden');
});
document.getElementById('feedbackBtn').addEventListener('click', () => {
    window.location.href = "mailto:youremail@example.com?subject=RecycleRight CA Feedback";
});

// --- Confirmation Modal Logic ---
const confirmPopup = document.getElementById('confirmPopup');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');
const confirmActionBtn = document.getElementById('confirmActionBtn');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');

function showConfirmation(title, message, onConfirm) {
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmPopup.classList.remove('hidden');

    // Clone and replace the button to remove old event listeners
    const newActionBtn = confirmActionBtn.cloneNode(true);
    confirmActionBtn.parentNode.replaceChild(newActionBtn, confirmActionBtn);

    newActionBtn.addEventListener('click', () => {
        onConfirm();
        confirmPopup.classList.add('hidden');
    });
}
confirmCancelBtn.addEventListener('click', () => confirmPopup.classList.add('hidden'));

// --- Data Management Functions ---

// Clear Collection History
document.getElementById('clearCollectionBtn').addEventListener('click', () => {
    showConfirmation("Clear History?", "This will permanently delete all your scanned items. This action cannot be undone.", async () => {
        const user = auth.currentUser;
        if (!user) return;
        const collectionRef = db.collection('users').doc(user.uid).collection('collection');
        const snapshot = await collectionRef.get();
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        alert("Collection history cleared.");
        if (document.getElementById('page-collection').offsetParent !== null) {
            refreshCollection();
        }
    });
});

// Export Data
document.getElementById('exportDataBtn').addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) {
        alert("Please sign in to export your data.");
        return;
    }
    const snapshot = await db.collection('users').doc(user.uid).collection('collection').orderBy('timestamp', 'desc').get();
    if (snapshot.empty) {
        alert("No items to export.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Name,Type,ScannedAt\r\n"; // CSV Header

    snapshot.forEach(doc => {
        const item = doc.data();
        const date = item.timestamp ? item.timestamp.toDate().toLocaleString() : "N/A";
        csvContent += `"${item.name}","${item.type}","${date}"\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "my_collection.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// Delete Account
document.getElementById('deleteAccountBtn').addEventListener('click', () => {
    showConfirmation(
        "DELETE ACCOUNT?",
        "This is permanent. All your data, points, and streaks will be erased forever.",
        () => {
            // This now calls our new, detailed client-side function
            deleteUserAccountClientSide();
        }
    );
});

/**
 * Handles the full client-side deletion of a user's account and all their data.
 * This is a complex, multi-step process.
 */
async function deleteUserAccountClientSide() {
    const user = auth.currentUser;
    if (!user) {
        alert("No user is currently signed in.");
        return;
    }

    try {
        console.log("Starting account deletion process for user:", user.uid);
        // Step 1: Delete all sub-collections (e.g., 'collection' and 'museum')
        const collectionRef = db.collection('users').doc(user.uid).collection('collection');
        const museumRef = db.collection('users').doc(user.uid).collection('museum');

        // Delete documents in batches for efficiency
        const deleteCollectionBatch = async (querySnapshot) => {
            const batch = db.batch();
            querySnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
        };

        const collectionSnapshot = await collectionRef.get();
        if (!collectionSnapshot.empty) {
            console.log(`Deleting ${collectionSnapshot.size} items from collection...`);
            await deleteCollectionBatch(collectionSnapshot);
        }

        const museumSnapshot = await museumRef.get();
        if (!museumSnapshot.empty) {
            console.log(`Deleting ${museumSnapshot.size} items from museum...`);
            await deleteCollectionBatch(museumSnapshot);
        }

        // Step 2: Delete the main user document
        console.log("Deleting user document from Firestore...");
        await db.collection('users').doc(user.uid).delete();

        // Step 3: Delete the user from Firebase Authentication
        console.log("Deleting user from Firebase Auth...");
        await user.delete();

        alert("Your account and all associated data have been permanently deleted.");
        console.log("Account deletion successful.");
        logout();

    } catch (error) {
        console.error("Error deleting account:", error);
        if (error.code === 'auth/requires-recent-login') {
            alert("This is a sensitive operation and requires you to have logged in recently. Please sign out and sign back in to delete your account.");
        } else {
            alert("An error occurred while deleting your account. Please check the console for details.");
        }
    }
}
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


// --- NOTIFICATIONS & APP VERSION ---



/**
 * Compares local app version with the one on the server.
 */
async function checkAppVersion() {
    const metaRef = db.collection('meta').doc('appVersion');
    try {
        const doc = await metaRef.get();
        if (doc.exists) {
            const serverVersion = doc.data().version;
            // Assumes compareVersions function exists
            if (compareVersions(LOCAL_APP_VERSION, serverVersion) < 0) {
                document.body.innerHTML = `<div style="padding: 20px; text-align: center;"><h2>Update Required</h2><p>A newer version is available. Please refresh.</p><button onclick="location.reload()" class="px-6 py-2 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-md hover:to-emerald-700">Refresh</button></div>`;
                return false; // Stop app initialization
            }
        }
    } catch (e) {
        console.error("Could not verify app version:", e);
    }
    return true; // OK to proceed
}

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

// --- APP INITIALIZATION ---

/**
 * This is the main entry point for the app, running after the page loads.
 */
window.addEventListener('load', async () => {
    // Set the app version in the UI immediately.
    const versionDisplay = document.getElementById('appVersionDisplay');
    if (versionDisplay) {
        versionDisplay.textContent = LOCAL_APP_VERSION;
    }

    versionDisplay.textContent = LOCAL_APP_VERSION;

    // Set up Dark Mode toggle
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (localStorage.getItem('dark_mode') === 'true') {
        document.documentElement.classList.add('dark');
        darkModeToggle.checked = true;
    }
    darkModeToggle.addEventListener('change', () => {
        document.documentElement.classList.toggle('dark', darkModeToggle.checked);
        localStorage.setItem('dark_mode', darkModeToggle.checked.toString());
    });

    // Check for app updates. If an update is required, stop loading the rest.
    const proceed = await checkAppVersion();
    if (!proceed) return;

    // Register the Service Worker for background notifications
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('./sw.js');
            console.log('Service Worker registered.');
        } catch (e) {
            console.error('Service Worker registration failed:', e);
        }
    }

    // Set the initial tab to 'main' and load initial data
    switchTab('main');
});

// NOTE: All your other functions like initMap, sendToGemini, popup handlers, etc.,
// need to be in this file. I have omitted them for clarity, but they are required
// for the app to fully function. Please ensure they are copied over.

/* ---------------------------  GEMINI  --------------------------- */
/**
 * Sends the captured image to the Gemini API for analysis.
 * @param {string} base64img - The base64-encoded image string.
 */
async function sendToGemini(base64img) {
    const body = {
        generationConfig: {
            temperature: 0.2
        },
        contents: {
            parts: [{
                inline_data: {
                    mime_type: 'image/jpeg',
                    data: base64img
                }
            }, {
                text: `Analyze this item. Detect the item and whether it is recyclable or not.

When identifying the item, be as specific as possible. Include brand names (e.g., 'Coca-Cola', 'Starbucks', 'Pepsi') and the material/type of object (e.g., 'Aluminum Can', 'Plastic Cup', 'Glass Bottle') if you can identify them.

If the item is recyclable, determine if it is a CRV item. If it is, estimate the return amount.

PLEASE ONLY RESPOND WITH ONE OF THESE THREE FORMATS:
[RECYCABLE, (BRAND AND ITEM NAME)]
[NON-R, (BRAND AND ITEM NAME)]
[CRV, (ESTIMATED-MONEY), (BRAND AND ITEM NAME)]

Examples:
[RECYCABLE, Starbucks Plastic Lid]
[NON-R, Chipped Ceramic Mug]
[CRV, $0.05, Coca-Cola Can]`
            }]
        }
    };

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        const text = data.candidates[0]?.content?.parts[0]?.text.trim();
        showResult(text);
    } catch (err) {
        console.error('Gemini error:', err);
        showResult('ERROR'); // Let showResult handle the error display
    } finally {
        document.getElementById('loadingSpinner').classList.add('hidden');
    }
}


/* ---------------------------  RESULT UI --------------------------- */
/**
 * Displays the analysis result in a modern "bottom sheet" popup.
 * @param {string} text - The response text from the Gemini API.
 */
async function showResult(text) {
    const resultDiv = document.getElementById('result');

    playSound('sounds/success_effect.mp3');
    triggerHaptic();

    let icon = '❓';
    let title = 'Unknown';
    let subtitle = 'Could not recognize the item clearly.';
    let titleColor = 'text-gray-800 dark:text-gray-200'; // Default text color
    let item = 'Unknown Item';
    let type = 'unknown';
    let buttons = '';

    // Parse the API response text
    if (text.startsWith('[RECYCABLE')) {
        item = text.split(',')[1].replace(']', '').trim();
        type = 'rec';
        icon = '♻️';
        title = 'Recyclable';
        subtitle = `Detected: <strong>${item}</strong>`;
        titleColor = 'text-emerald-500';
        buttons = `<button onclick="askHowToRecycle('${item}','RECYCABLE')" class="w-full mt-4 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold">How To Recycle</button>`;
    } else if (text.startsWith('[NON-R')) {
        item = text.split(',')[1].replace(']', '').trim();
        type = 'nrec';
        icon = '❌';
        title = 'Not Recyclable';
        subtitle = `Detected: <strong>${item}</strong>`;
        titleColor = 'text-red-500';
        buttons = `<button onclick="askWhyExplanation('${item}','NON-R')" class="w-full mt-4 px-4 py-3 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 font-semibold">Learn Why</button>`;
    } else if (text.startsWith('[CRV')) {
        const refund = text.split(',')[1].trim();
        item = text.split(',')[2].replace(']', '').trim();
        type = 'crv';
        icon = '💵';
        title = 'CRV Eligible';
        subtitle = `Refund: <strong>${refund}</strong> — Detected: <strong>${item}</strong>`;
        titleColor = 'text-yellow-500';
        buttons = `<button onclick="switchTab('map'); closeResult();" class="w-full mt-4 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-semibold">Find Nearest Center</button>`;
    }

    // Set the classes directly to create the overlay and bottom sheet
    resultDiv.className = 'fixed inset-0 z-[1000] bg-black/50 backdrop-blur-sm flex items-end';
    resultDiv.style.animation = 'fade-in 0.3s ease-out';

    // Construct the new result screen HTML
    resultDiv.innerHTML = `
        <div class="glass-card w-full p-6 pb-8 rounded-t-3xl shadow-2xl flex flex-col items-center text-center" style="animation: slide-up 0.4s ease-out;">
            <div class="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full mb-4"></div>
            <div class="text-6xl mb-2">${icon}</div>
            <h2 class="text-3xl font-bold ${titleColor}">${title}</h2>
            <p class="text-lg text-muted mt-1">${subtitle}</p>
            <div class="w-full max-w-xs pt-4">
                ${buttons}
                <button onclick="closeResult()" class="w-full mt-3 px-4 py-2 text-muted hover:bg-black/5 dark:hover:bg-white/10 rounded-lg">Close</button>
            </div>
        </div>
    `;

    // Handle user data updates after showing the result
    await checkForSpecialItem(item); // <-- ADD THIS LINE
    const user = auth.currentUser;
    if (user && type !== 'unknown') {
        try {
            await updateStreak(user.uid);
            await addPointsToUser(user.uid, type === 'crv' ? 10 : 5);
            await addToCollection(user.uid, item, type, capturedBase64);
            if (document.getElementById('page-main').offsetParent !== null) {
                loadDashboardStats();
            }
        } catch (e) {
            console.error("Error updating user data:", e);
        }
    }
}

/**
 * Closes the result overlay.
 */
function closeResult() {
    const resultDiv = document.getElementById('result');
    resultDiv.className = 'hidden'; // Simply hide the div
    resultDiv.innerHTML = '';
}

// --- HELPERS ---

/**
 * Plays a sound effect if sounds are enabled in settings.
 * @param {string} soundFile - The path to the sound file to play.
 */
function playSound(soundFile) {
    if (localStorage.getItem('soundEffectsEnabled') === 'true') {
        const audio = new Audio(soundFile);
        audio.play();
    }
}

/**
 * Triggers haptic feedback (vibration) if enabled in settings.
 */
function triggerHaptic() {
    if (localStorage.getItem('hapticsEnabled') === 'true' && navigator.vibrate) {
        navigator.vibrate(50); // Vibrate for 50 milliseconds
    }
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

    // 👇 Show loading indicator before fetching
    const popup = document.getElementById('whyPopup');
    const whyText = document.getElementById('whyText');
    whyText.textContent = '⏳ Loading explanation...';
    popup.classList.remove('hidden');

    const body = {
        contents: [{ parts: [{ text: prompt }] }]
    };

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await res.json();
        const explanation = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Could not fetch explanation.';
        whyText.textContent = explanation;

    } catch (err) {
        whyText.textContent = '⚠️ Failed to load explanation.';
        console.error('AskWhy error:', err);
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
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash?key=${API_KEY}`, {
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
    return fetch('data/crv_centers_address_only.json')
        .then(res => res.json())
        .then(data => {
            let matches = data.filter(site => site.city.toLowerCase() === userCity.toLowerCase());
            if (matches.length === 0 && userCity) {
                const grouped = data.reduce((acc, site) => {
                    acc[site.city] = acc[site.city] || [];
                    acc[site.city].push(site);
                    return acc;
                }, {});
                const fallbackCity = Object.keys(grouped).find(c => c.toLowerCase().includes(userCity.toLowerCase().slice(0, 3)));
                matches = grouped[fallbackCity] || [];
            }

            const recycleIcon = L.icon({
                iconUrl: 'https://cdn-icons-png.flaticon.com/512/1327/1327264.png',
                iconSize: [28, 28],
                iconAnchor: [14, 28],
                popupAnchor: [0, -28]
            });

            const markerPromises = matches.map(site => {
                return fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(site.full_address)}`)
                    .then(res => res.json())
                    .then(loc => {
                        if (loc && loc.length > 0) {
                            const lat = parseFloat(loc[0].lat);
                            const lon = parseFloat(loc[0].lon);
                            const marker = L.marker([lat, lon], { icon: recycleIcon }).addTo(map);
                            marker.bindPopup(`<strong>${site.name}</strong><br>${site.address}<br><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.full_address)}" target="_blank">Open in Maps</a>`);
                            marker._icon.style.animation = "bounce 0.8s";
                        }
                    });
            });

            return Promise.all(markerPromises);
        })
        .finally(() => {
            const loadingElement = document.getElementById('mapLoading');
            if (loadingElement) loadingElement.remove();
        });
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
        refreshProfile();
        loadDashboardStats();
    }
    catch (error) {
        console.error('Google Sign-in error:', error.message);
        alert('Failed to login with Google: ' + error.message);

    }

};

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