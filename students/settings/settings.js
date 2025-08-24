// 🔹 Toggle submenu function
function toggleSubMenu(id) {
  const submenu = document.getElementById(id);
  submenu.style.display = submenu.style.display === "block" ? "none" : "block";

  const chevron = document.getElementById("accountsChevron");
  if (chevron) chevron.classList.toggle("rotated");
}

// 🔹 Firebase v8 Configuration and Initialization
const firebaseConfig = {
  apiKey: "AIzaSyDdSSYjX1DHKskbjDOnnqq18yXwLpD3IpQ",
  authDomain: "tatak-mobile-web.firebaseapp.com",
  projectId: "tatak-mobile-web",
  storageBucket: "tatak-mobile-web.appspot.com",
  messagingSenderId: "771908675869",
  appId: "1:771908675869:web:88e68ca51ed7ed4da019f4",
  measurementId: "G-CENPP29LKQ"
};

// Initialize Firebase only once
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();

document.addEventListener("DOMContentLoaded", function () {
  // 🔹 Display first name dynamically in header
  const usernameDisplay = document.querySelector(".username");
  const studentName = localStorage.getItem("studentName");
  if (usernameDisplay && studentName) {
    usernameDisplay.textContent = studentName.split(" ")[0]; // first name only
  }

  // 🔹 User dropdown toggle
  const toggle = document.getElementById("userDropdownToggle");
  const menu = document.getElementById("dropdownMenu");

  if (toggle && menu) {
    toggle.addEventListener("click", () => {
      toggle.classList.toggle("active");
      menu.style.display = menu.style.display === "block" ? "none" : "block";
    });

    document.addEventListener("click", (e) => {
      if (!toggle.contains(e.target) && !menu.contains(e.target)) {
        menu.style.display = "none";
        toggle.classList.remove("active");
      }
    });
  }

  // 🔹 Logout functionality
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function (e) {
      e.preventDefault();
      const keysToRemove = ["userData", "studentName", "schoolID", "studentID"];
      keysToRemove.forEach(key => localStorage.removeItem(key));
      window.location.href = "../../logout.html"; // adjust path if needed
    });
  }

  // 🔹 Change Password
  const inputs = document.querySelectorAll(".change-password-subsection input");
  const currentPasswordInput = inputs[0];
  const newPasswordInput = inputs[1];
  const confirmPasswordInput = inputs[2];
  const changePasswordBtn = document.querySelector(".change-password-subsection .action-button");

  // Create a message div for feedback if it doesn't exist
  let passwordMessage = document.getElementById("passwordMessage");
  if (!passwordMessage) {
    passwordMessage = document.createElement("div");
    passwordMessage.id = "passwordMessage";
    passwordMessage.style.marginTop = "10px";
    passwordMessage.style.fontWeight = "bold";
    changePasswordBtn.parentNode.appendChild(passwordMessage);
  }

  changePasswordBtn.addEventListener("click", async () => {
    passwordMessage.textContent = "";
    passwordMessage.style.color = "red";

    const currentPassword = currentPasswordInput.value.trim();
    const newPassword = newPasswordInput.value.trim();
    const confirmPassword = confirmPasswordInput.value.trim();

    // 🔹 Basic validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      passwordMessage.textContent = "Please fill in all fields.";
      return;
    }

    if (newPassword.length < 6) {
      passwordMessage.textContent = "New password must be at least 6 characters.";
      return;
    }

    if (newPassword !== confirmPassword) {
      passwordMessage.textContent = "New password and confirmation do not match.";
      return;
    }

    const schoolID = localStorage.getItem("schoolID");
    if (!schoolID) {
      passwordMessage.textContent = "Unable to identify student.";
      return;
    }

    try {
      // 🔹 Reference the student document
      const studentDocRef = db.collection("Students").doc(schoolID);
      const docSnapshot = await studentDocRef.get();

      if (!docSnapshot.exists) {
        passwordMessage.textContent = "Student record not found.";
        return;
      }

      const data = docSnapshot.data();
      if (data.password !== currentPassword) {
        passwordMessage.textContent = "Current password is incorrect.";
        return;
      }

      // 🔹 Update password in Firestore
      await studentDocRef.update({ password: newPassword });

      // 🔹 Success message
      passwordMessage.style.color = "green";
      passwordMessage.textContent = "Password changed successfully!";

      // Clear input fields
      currentPasswordInput.value = "";
      newPasswordInput.value = "";
      confirmPasswordInput.value = "";

      // 🔹 Update localStorage if userData exists
      let userData = localStorage.getItem("userData");
      if (userData) {
        const userObj = JSON.parse(userData);
        userObj.password = newPassword;
        localStorage.setItem("userData", JSON.stringify(userObj));
      }

    } catch (error) {
      console.error("Error updating password:", error);
      passwordMessage.textContent = "Error updating password. Try again.";
    }
  });
});
