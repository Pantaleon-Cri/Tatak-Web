// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDdSSYjX1DHKskbjDOnnqq18yXwLpD3IpQ",
  authDomain: "tatak-mobile-web.firebaseapp.com",
  projectId: "tatak-mobile-web",
  storageBucket: "tatak-mobile-web.firebasestorage.app",
  messagingSenderId: "771908675869",
  appId: "1:771908675869:web:88e68ca51ed7ed4da019f4",
  measurementId: "G-CENPP29LKQ"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

document.getElementById('registrationForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const userID = document.getElementById('userID').value.trim();
  const password = document.getElementById('password').value.trim();
  const messageBox = document.getElementById('messageBox');
  messageBox.style.display = 'none';

  if (!userID || !password) {
    showMessage("Please fill in both User ID and Password.", "error");
    return;
  }

  try {
    // 🔍 1. Check Designees collection (userID + password)
    const designeeSnapshot = await db.collection("Designees")
      .where("userID", "==", userID)
      .where("password", "==", password)
      .get();

    if (!designeeSnapshot.empty) {
      const designeeDoc = designeeSnapshot.docs[0];
      const designeeData = designeeDoc.data();

      localStorage.setItem("userData", JSON.stringify({
        id: designeeDoc.id,
        ...designeeData,
        role: "designee"
      }));

      window.location.href = "../Designee/designee.html";
      return;
    }

    // 🔍 2. Check staffTable collection (id + password)
    const staffSnapshot = await db.collection("staffTable")
      .where("id", "==", userID)
      .where("password", "==", password)
      .get();

    if (!staffSnapshot.empty) {
      const staffDoc = staffSnapshot.docs[0];
      const staffData = staffDoc.data();

      localStorage.setItem("userData", JSON.stringify({
        id: staffDoc.id,
        ...staffData,
        role: "staff"
      }));

      window.location.href = "../Designee/designee.html"; // ⬅️ Change this if your staff page is different
      return;
    }

    // ❌ Not found in either
    showMessage("Invalid User ID or Password.", "error");

  } catch (error) {
    console.error("Login error:", error);
    showMessage("An error occurred during login. Please try again.", "error");
  }
});

// Show feedback message
function showMessage(message, type) {
  const messageBox = document.getElementById('messageBox');
  messageBox.textContent = message;
  messageBox.style.color = type === 'error' ? 'red' : 'green';
  messageBox.style.display = 'block';
}
