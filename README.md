# RecycleRightCA ♻️

**Gamifying recycling to build a greener California, one scan at a time.**

RecycleRightCA is a progressive web app designed to make recycling simple, fun, and rewarding. By leveraging AI-powered image recognition, we help users instantly identify whether an item is recyclable, non-recyclable, or eligible for a California Redemption Value (CRV) refund.

**[Live Demo Link](https://unknowncode08.github.io/RecycleRightCA/mobile)** 🚀

-----

## 🏆 Competition Submission

This project is a submission for the **Congressional App Challenge** and the **Hack Club Congressional App Challenge Certification**.

## The Problem

Recycling rules can be confusing, and it's often difficult to know what can be recycled. This confusion leads to "wish-cycling," where non-recyclable items contaminate the recycling stream, or valuable recyclables end up in landfills. We wanted to create a tool that removes the guesswork and motivates people to build positive, long-term recycling habits.

## Our Solution

RecycleRightCA turns recycling into a game. Our app provides a user-friendly platform to:

  * **Scan & Identify:** Instantly learn how to dispose of an item using your phone's camera.
  * **Earn Rewards:** Collect points for every item you recycle correctly.
  * **Track Your Streak:** Build a recycling streak and stay motivated.
  * **Unlock Trophies:** Discover and scan special items to earn unique trophies.
  * **Find CRV Centers:** Easily locate nearby recycling centers to redeem your CRV items for cash.

Our goal is to educate users, encourage consistent recycling, and highlight the financial and environmental benefits of recycling right.

## ✨ Key Features

  * **AI-Powered Scanner:** Uses the Gemini AI API to identify items from a single photo.
  * **Instant Feedback:** Tells you immediately if an item is Recyclable, Non-Recyclable, or has CRV value.
  * **Gamified Experience:** An interactive system with points, streaks, and unlockable achievements to make recycling engaging.
  * **CRV Center Locator:** A built-in map to find the closest California Redemption Value recycling centers.
  * **User Authentication:** Secure sign-up and login to track personal progress and stats.
  * **Progressive Web App (PWA):** Installable on any device (iOS, Android, Desktop) directly from the browser for a native-app-like experience.

## 🛠️ Technology Stack

  * **Frontend:** HTML5, CSS3, JavaScript
  * **Backend & Database:** Google Firebase (Firestore for data, Firebase Authentication for users)
  * **AI / Machine Learning:** Google Gemini API
  * **Deployment:** GitHub Pages with GitHub Actions for CI/CD

## 🚀 Getting Started

To run this project locally, follow these steps:

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-github-username/RecycleRightCA.git
    ```

2.  **Navigate to the project directory:**

    ```bash
    cd RecycleRightCA/mobile
    ```

3.  **Create the configuration file:**
    The application requires API keys for Firebase and the Gemini API. Create a file named `config.js` inside the `/mobile` directory.

4.  **Add your API keys to `config.js`:**
    Copy the structure from `config.js.example` and add your secret keys. Your `config.js` file should look like this:

    ```javascript
    const firebaseConfig = {
      apiKey: "YOUR_FIREBASE_API_KEY",
      authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
      projectId: "YOUR_PROJECT_ID",
      storageBucket: "YOUR_PROJECT_ID.appspot.com",
      messagingSenderId: "YOUR_SENDER_ID",
      appId: "YOUR_APP_ID"
    };

    const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";
    ```

5.  **Run the application:**
    Simply open the `index.html` file in the `/mobile` directory in your web browser. For the best experience and to test all features (like camera access), you may need to serve the files from a local server.

## ✍️ Authors

  * **Omar Ahmad** - *Co-Project Lead & Developer* - [GitHub Profile](https://github.com/omarahmadsec)
  * **Preston Chang** - *Co-Project Lead & Designer*
