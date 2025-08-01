// A list of encouraging messages for the notifications
const notificationMessages = [
    { title: 'Keep the Streak Going! 🔥', body: 'Recycle something today to maintain your daily streak.' },
    { title: 'Earn More Points! 🏆', body: 'Scan a new item to boost your score and level up.' },
    { title: 'Make an Impact! ♻️', body: 'Did you know recycling one can saves enough energy to run a TV for 3 hours?' },
    { title: 'Check Your Collection! 📚', body: 'You have a great collection going. Time to add to it!' },
    { title: 'CRV Alert! 💵', body: 'Remember to check for CRV items to get cash back for your recycling.' }
];

// Listen for the periodic sync event
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'recycle-reminder') {
        // When the sync event fires, call the function to show a notification
        event.waitUntil(showRandomNotification());
    }
});

// Function to select a random message and display the notification
function showRandomNotification() {
    const randomMessage = notificationMessages[Math.floor(Math.random() * notificationMessages.length)];
    const { title, body } = randomMessage;

    return self.registration.showNotification(title, {
        body: body,
        icon: './icons/icon-192.png', // Path to your app icon
        badge: './icons/icon-192.png' // Icon for the notification bar on Android
    });
}