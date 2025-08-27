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
      if (!dropdownToggle.contains(event.target) && !dropdownMenu.contains(event.target)) {
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

  if (storedAdminID) {
    updateAdminUI(storedAdminID);
  } else {
    updateAdminUI("Unknown");
  }

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

  // 🔁 Change Password (Firestore only)
  const changePasswordBtn = document.getElementById("changePasswordBtn");
  if (changePasswordBtn) {
    changePasswordBtn.addEventListener("click", async () => {
      const currentPassword = document.getElementById("currentPassword").value.trim();
      const newPassword = document.getElementById("newPassword").value.trim();
      const confirmPassword = document.getElementById("confirmPassword").value.trim();

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
        const docRef = db.collection("adminAccount").doc(storedAdminID);
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

        // ✅ Update Firestore password
        await docRef.update({ password: newPassword });
        alert("Password changed successfully!");

        // ✅ Clear fields
        document.getElementById("currentPassword").value = "";
        document.getElementById("newPassword").value = "";
        document.getElementById("confirmPassword").value = "";

        // ✅ Close modal (if open)
        if (modal) modal.style.display = "none";

        // ✅ Refresh UI so hidden password display is updated
        updateAdminUI(storedAdminID);

      } catch (error) {
        console.error("Error changing password:", error);
        alert(error.message || "Something went wrong.");
      }
    });
  }

  // 🔁 Change Admin ID (Firestore doc move)
const changeAdminIDBtn = document.getElementById("changeAdminIDBtn");
if (changeAdminIDBtn) {
  changeAdminIDBtn.addEventListener("click", async () => {
    const newAdminID = document.getElementById("newAdminID").value.trim();
    if (!newAdminID) {
      alert("Enter a new Admin ID.");
      return;
    }

    try {
      const oldDocRef = db.collection("adminAccount").doc(storedAdminID);
      const oldDocSnap = await oldDocRef.get();
      if (!oldDocSnap.exists) {
        alert("Admin account not found.");
        return;
      }

      const data = oldDocSnap.data();

      // ✅ Update the adminID field along with moving the doc
      data.adminID = newAdminID;

      // Create new doc with updated ID + preserve data
      await db.collection("adminAccount").doc(newAdminID).set(data);
      await oldDocRef.delete();

      // Update localStorage + UI
      localStorage.setItem("adminID", newAdminID);
      storedAdminID = newAdminID;
      updateAdminUI(newAdminID);

      // ✅ Clear field
      document.getElementById("newAdminID").value = "";

      alert("Admin ID changed successfully!");
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
