// ✅ Initialize Firebase v8 (if not already initialized)
if (!firebase.apps.length) {
  firebase.initializeApp({
    apiKey: "AIzaSyDdSSYjX1DHKskbjDOnnqq18yXwLpD3IpQ",
    authDomain: "tatak-mobile-web.firebaseapp.com",
    projectId: "tatak-mobile-web",
    storageBucket: "tatak-mobile-web.appspot.com",
    messagingSenderId: "771908675869",
    appId: "1:771908675869:web:88e68ca51ed7ed4da019f4",
    measurementId: "G-CENPP29LKQ"
  });
}
const db = firebase.firestore();

// ✅ Wait for DOM to load
document.addEventListener("DOMContentLoaded", async () => {
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
        "adminID"
      ];

      keysToRemove.forEach(key => localStorage.removeItem(key));

      window.location.href = "../../../logout.html";
    });
  } else {
    console.warn("logoutBtn not found");
  }

  const usernameDisplay = document.getElementById("usernameDisplay");
  const storedAdminID = localStorage.getItem("adminID");

  // 🔁 Show logged in admin ID
  if (storedAdminID) {
    usernameDisplay.textContent = storedAdminID;
  } else {
    usernameDisplay.textContent = "Unknown";
  }

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

  // ✅ Table body reference
  const tbody = document.querySelector(".log-table tbody");
  if (!tbody) {
    console.error("❌ Table body not found!");
    return;
  }

  try {
    // 🔁 Fetch all staff
    const staffSnap = await db.collection("staffTable").get();
    const staffList = staffSnap.docs.map(doc => ({
      docId: doc.id,   // Firestore doc ID
      ...doc.data()
    }));

    // 🔁 Fetch lookup tables (parallel)
    const [clubsSnap, groupsSnap, departmentsSnap, officesSnap] = await Promise.all([
      db.collection("acadClubTable").get(),
      db.collection("groupTable").get(),
      db.collection("departmentTable").get(),
      db.collection("officeTable").get()
    ]);

    // 🔁 Create lookup maps
    const clubsMap = {};
    clubsSnap.forEach(doc => {
      const data = doc.data();
      clubsMap[doc.id] = data.codeName || "";
    });

    const groupsMap = {};
    groupsSnap.forEach(doc => {
      const data = doc.data();
      groupsMap[doc.id] = data.club || "";
    });

    const departmentsMap = {};
    departmentsSnap.forEach(doc => {
      const data = doc.data();
      departmentsMap[doc.id] = data.department || "";
    });

    const officesMap = {};
    officesSnap.forEach(doc => {
      const data = doc.data();
      officesMap[doc.id] = data.office || "";
    });

    // 🔁 Render staff list
    tbody.innerHTML = ""; // clear old rows
    staffList.forEach(staff => {
      let categoryName = "";
      if (staff.category) {
        categoryName =
          clubsMap[staff.category] ||
          groupsMap[staff.category] ||
          staff.category;
      }

      const deptName = departmentsMap[staff.department] || staff.department || "N/A";
      const officeName = officesMap[staff.office] || staff.office || "N/A";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${staff.id || ""}</td> <!-- manual staff ID -->
        <td>${staff.firstName || ""}</td>
        <td>${staff.lastName || ""}</td>
        <td>${officeName}</td>
        <td>${deptName}</td>
        <td>${categoryName || "N/A"}</td>
        <td>${staff.email || ""}</td>
        <td>
          <button class="action-btn delete" data-docid="${staff.docId}">
            <i class="fas fa-trash-alt"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // ✅ DELETE MODAL HANDLING
    const deleteModal = document.getElementById("deleteModalOverlay");
    const deleteCancelBtn = document.getElementById("deleteCancelBtn");
    const deleteConfirmBtn = document.getElementById("deleteConfirmBtn");

    let currentDeleteDocId = null;

    // 🔁 Attach delete button click events
    document.querySelectorAll(".action-btn.delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentDeleteDocId = btn.dataset.docid; // ✅ use Firestore doc ID
        deleteModal.style.display = "flex";
      });
    });

    // 🔁 Cancel delete
    deleteCancelBtn.addEventListener("click", () => {
      deleteModal.style.display = "none";
      currentDeleteDocId = null;
    });

    // 🔁 Confirm delete
    deleteConfirmBtn.addEventListener("click", async () => {
      if (!currentDeleteDocId) return;

      try {
        await db.collection("staffTable").doc(currentDeleteDocId).delete();
        alert("✅ Staff deleted successfully!");
        deleteModal.style.display = "none";
        location.reload(); // refresh to update table
      } catch (error) {
        console.error("❌ Error deleting staff:", error);
        alert("Error deleting staff.");
      }
    });

  } catch (error) {
    console.error("❌ Error loading staff:", error);
  }
});

// ✅ Sidebar submenu toggle
function initSidebarDropdowns() {
  const dropdownToggles = document.querySelectorAll(".dropdown-toggle");
  dropdownToggles.forEach(toggle => {
    toggle.addEventListener("click", function (e) {
      e.preventDefault();
      const parentLi = this.parentElement;
      const submenu = parentLi.querySelector(".submenu");

      if (submenu.style.display === "block") {
        submenu.style.display = "none";
        this.querySelector(".arrow")?.classList.remove("rotated");
      } else {
        submenu.style.display = "block";
        this.querySelector(".arrow")?.classList.add("rotated");
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", initSidebarDropdowns);
