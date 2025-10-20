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

  // 🔁 Dropdown toggle
  const dropdownToggle = document.getElementById("userDropdownToggle");
  const dropdownMenu = document.getElementById("dropdownMenu");

  if (dropdownToggle && dropdownMenu) {
    dropdownToggle.addEventListener("click", () => {
      dropdownMenu.style.display =
        dropdownMenu.style.display === "block" ? "none" : "block";
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (event) => {
      if (
        !dropdownToggle.contains(event.target) &&
        !dropdownMenu.contains(event.target)
      ) {
        dropdownMenu.style.display = "none";
      }
    });
  }

  // 🔁 Display Admin Username / ID
  const usernameDisplay = document.getElementById("usernameDisplay");
  const currentAdminIDSpan = document.getElementById("currentAdminID");
  let storedAdminID = localStorage.getItem("adminID");

  const updateAdminUI = (id) => {
    const displayID = id || "Unknown";
    if (usernameDisplay) usernameDisplay.textContent = displayID;
    if (currentAdminIDSpan) currentAdminIDSpan.textContent = displayID;
  };

  updateAdminUI(storedAdminID || "Unknown");

  // 🔁 Modal handling
  const openBtn = document.getElementById("openModalBtn");
  const modal = document.getElementById("modalOverlay");
  const cancelBtn = document.getElementById("cancelBtn");

  if (openBtn && modal && cancelBtn) {
    openBtn.addEventListener("click", () => (modal.style.display = "flex"));
    cancelBtn.addEventListener("click", () => (modal.style.display = "none"));
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.style.display = "none";
    });
  }

  // 🔁 Change Password (Firestore)
  const changePasswordBtn = document.getElementById("changePasswordBtn");
  if (changePasswordBtn) {
    changePasswordBtn.addEventListener("click", async () => {
      const currentPassword = document
        .getElementById("currentPassword")
        .value.trim();
      const newPassword = document.getElementById("newPassword").value.trim();
      const confirmPassword = document
        .getElementById("confirmPassword")
        .value.trim();

      if (!storedAdminID) {
        alert("No admin is logged in.");
        return;
      }
      if (!currentPassword || !newPassword || !confirmPassword) {
        alert("All fields are required.");
        return;
      }
      if (newPassword !== confirmPassword) {
        alert("New passwords do not match.");
        return;
      }
      if (newPassword.length < 6) {
        alert("New password must be at least 6 characters.");
        return;
      }

      try {
        // ✅ Firestore reference to Admin document
        const docRef = db.collection("User").doc("Admin");
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
          alert("Admin account not found.");
          return;
        }

        const data = docSnap.data();
        if (data.password !== currentPassword) {
          alert("Current password is incorrect.");
          return;
        }

        await docRef.update({ password: newPassword });
        alert("Password changed successfully!");

        // Clear input fields
        document.getElementById("currentPassword").value = "";
        document.getElementById("newPassword").value = "";
        document.getElementById("confirmPassword").value = "";

        // Close modal
        if (modal) modal.style.display = "none";

        // Refresh UI
        updateAdminUI(storedAdminID);
      } catch (error) {
        console.error("Error changing password:", error);
        alert(error.message || "Something went wrong.");
      }
    });
  }

  // 🔁 Change Admin ID (update field only, doc remains Admin)
  const changeAdminIDBtn = document.getElementById("changeAdminIDBtn");
  if (changeAdminIDBtn) {
    changeAdminIDBtn.addEventListener("click", async () => {
      const newAdminID = document.getElementById("newAdminID").value.trim();
      if (!newAdminID) {
        alert("Enter a new Admin ID.");
        return;
      }

      try {
        const docRef = db.collection("User").doc("Admin");
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
          alert("Admin account not found.");
          return;
        }

        const data = docSnap.data();
        data.adminID = newAdminID; // ✅ Update field only

        await docRef.update(data); // Keep document ID as "Admin"

        // Update localStorage + UI
        localStorage.setItem("adminID", newAdminID);
        storedAdminID = newAdminID;
        updateAdminUI(newAdminID);

        document.getElementById("newAdminID").value = "";

        alert("Admin ID updated successfully!");
      } catch (error) {
        console.error("Error changing Admin ID:", error);
        alert(error.message || "Something went wrong.");
      }
    });
  }

  // 🔁 Logout handling
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
        "adminID",
      ];

      keysToRemove.forEach((key) => localStorage.removeItem(key));

      window.location.href = "../../logout.html";
    });
  }
});
