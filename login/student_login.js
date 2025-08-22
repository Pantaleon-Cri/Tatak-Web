// Firebase v8 setup
const firebaseConfig = {
  apiKey: "AIzaSyDdSSYjX1DHKskbjDOnnqq18yXwLpD3IpQ",
  authDomain: "tatak-mobile-web.firebaseapp.com",
  projectId: "tatak-mobile-web",
  storageBucket: "tatak-mobile-web.appspot.com",
  messagingSenderId: "771908675869",
  appId: "1:771908675869:web:88e68ca51ed7ed4da019f4",
  measurementId: "G-CENPP29LKQ"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

document.getElementById('registrationForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const schoolID = document.getElementById('schoolID').value.trim();
  const password = document.getElementById('password').value.trim();
  const messageBox = document.getElementById('messageBox');

  // Show loading
  messageBox.style.display = 'block';
  messageBox.style.color = 'black';
  messageBox.textContent = 'Logging in...';

  try {
    // Get student document from Firestore
    const doc = await db.collection('Students').doc(schoolID).get();

    if (!doc.exists) {
      messageBox.style.color = 'red';
      messageBox.textContent = 'Account not found.';
      return;
    }

    const studentData = doc.data();

    if (studentData.password === password) {
      // ✅ Save student ID to localStorage instead of sessionStorage
      localStorage.setItem('schoolID', schoolID);
      localStorage.setItem('studentName', `${studentData.firstName} ${studentData.lastName}`);

      // ✅ Redirect to student profile/dashboard
      window.location.href = '../students/student.html';
    } else {
      messageBox.style.color = 'red';
      messageBox.textContent = 'Incorrect password.';
    }

  } catch (error) {
    console.error("Login error:", error);
    messageBox.style.color = 'red';
    messageBox.textContent = 'An error occurred. Please try again.';
  }
});
