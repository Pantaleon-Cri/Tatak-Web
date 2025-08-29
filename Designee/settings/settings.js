
// ✅ Initialize Firebase v8 (only once)
if (!firebase.apps.length) {
  firebase.initializeApp({
    apiKey: "AIzaSyDdSSYjX1DHKskbjDOnnqq18yXwLpD3IpQ",
    authDomain: "tatak-mobile-web.firebaseapp.com",
    projectId: "tatak-mobile-web",
    storageBucket: "tatak-mobile-web.appspot.com",
    messagingSenderId: "771908675869",
    appId: "1:771908675869:web:88e68ca51ed7ed4da019f4",
    measurementId: "G-CENPP29LKQ",
  });
}

document.addEventListener("DOMContentLoaded", function () {
  const db = firebase.firestore();

  // 🔽 Dropdown toggle
  const toggle = document.getElementById("userDropdownToggle");
  const menu = document.getElementById("dropdownMenu");

  if (toggle && menu) {
    toggle.addEventListener("click", () => {
      toggle.classList.toggle("active");
      menu.style.display = menu.style.display === "block" ? "none" : "block";
    });

    // Close dropdown if clicked outside
    document.addEventListener("click", (e) => {
      if (!toggle.contains(e.target) && !menu.contains(e.target)) {
        menu.style.display = "none";
        toggle.classList.remove("active");
      }
    });
  }

  // 🔽 Logout functionality
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function (e) {
      e.preventDefault();

      const keysToRemove = [
        "userData",
        "studentName",
        "schoolID",
        "studentID",
        "staffID",
        "designeeID",
        "category",
        "office",
        "department",
      ];
      keysToRemove.forEach((key) => localStorage.removeItem(key));

      window.location.href = "../../../logout.html";
    });
  } else {
    console.warn("logoutBtn not found");
  }

  // 🔽 Display username dynamically
 const usernameDisplay = document.getElementById("usernameDisplay");
let displayFullName = "";
let userRole = "";
let userDataObj = null;

const userDataString = localStorage.getItem("userData");
if (userDataString) {
  try {
    userDataObj = JSON.parse(userDataString);
    const firstName = userDataObj.firstName || "";
    const lastName = userDataObj.lastName || "";
    displayFullName = `${firstName} ${lastName}`.trim();
    userRole = userDataObj.role || "";
  } catch (err) {
    console.error("Error parsing userData:", err);
  }
}

if (usernameDisplay) {
  usernameDisplay.textContent = displayFullName;
} else {
  console.warn("usernameDisplay element not found");
}

  // 🔽 Change Password Logic
  const currentPasswordInput = document.getElementById("currentPassword");
  const newPasswordInput = document.getElementById("newPassword");
  const confirmPasswordInput = document.getElementById("confirmPassword");
  const changePasswordBtn = document.getElementById("changePasswordBtn");
  const passwordMessage = document.getElementById("passwordMessage");

  if (changePasswordBtn) {
    changePasswordBtn.addEventListener("click", async () => {
      passwordMessage.textContent = "";
      passwordMessage.style.color = "red";

      const currentPassword = currentPasswordInput.value.trim();
      const newPassword = newPasswordInput.value.trim();
      const confirmPassword = confirmPasswordInput.value.trim();

      if (!currentPassword || !newPassword || !confirmPassword) {
        passwordMessage.textContent = "Please fill in all fields.";
        return;
      }

      if (newPassword.length < 6) {
        passwordMessage.textContent =
          "New password must be at least 6 characters.";
        return;
      }

      if (newPassword !== confirmPassword) {
        passwordMessage.textContent =
          "New password and confirmation do not match.";
        return;
      }

      if (!userDataObj || !userRole) {
        passwordMessage.textContent = "Unable to identify user.";
        return;
      }

      try {
        // ✅ Select collection & ID field
        let collectionName = "";
        let fieldName = "";
        let docValue = "";

        if (userRole === "designee") {
          collectionName = "Designees";
          fieldName = "userID";
          docValue = userDataObj.userID;
        } else if (userRole === "staff") {
          collectionName = "staffTable";
          fieldName = "id";
          docValue = userDataObj.id;
        } else {
          passwordMessage.textContent = "Unknown user role.";
          return;
        }

        // ✅ Build query with multiple filters to avoid duplicate ID conflicts
        let queryRef = db.collection(collectionName).where(fieldName, "==", docValue);

        if (userDataObj.office) {
          queryRef = queryRef.where("office", "==", userDataObj.office);
        }
        if (userDataObj.category) {
          queryRef = queryRef.where("category", "==", userDataObj.category);
        }
        if (userDataObj.department) {
          queryRef = queryRef.where("department", "==", userDataObj.department);
        }

        const querySnapshot = await queryRef.limit(1).get();

        if (querySnapshot.empty) {
          passwordMessage.textContent = "User record not found.";
          return;
        }

        const userDoc = querySnapshot.docs[0];
        const userDocRef = userDoc.ref;
        const data = userDoc.data();

        if (data.password !== currentPassword) {
          passwordMessage.textContent = "Current password is incorrect.";
          return;
        }

        await userDocRef.update({ password: newPassword });

        passwordMessage.style.color = "green";
        passwordMessage.textContent = "Password changed successfully!";

        // Clear inputs
        currentPasswordInput.value = "";
        newPasswordInput.value = "";
        confirmPasswordInput.value = "";

        // ✅ Update localStorage copy
        userDataObj.password = newPassword;
        localStorage.setItem("userData", JSON.stringify(userDataObj));
      } catch (error) {
        console.error("Error updating password:", error);
        passwordMessage.textContent = "Error updating password. Try again.";
      }
    });
  }
});

