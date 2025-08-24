// ✅ Initialize Firebase v8 (if not already initialized)
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

  // 🔁 Show logged in admin
  if (storedAdminID) {
    usernameDisplay.textContent = storedAdminID;
  } else {
    usernameDisplay.textContent = "Unknown";
  }

  // 🔁 Dropdown toggle
  const dropdownToggle = document.getElementById("userDropdownToggle");
  const dropdownMenu = document.getElementById("dropdownMenu");

  dropdownToggle.addEventListener("click", () => {
    dropdownMenu.style.display =
      dropdownMenu.style.display === "block" ? "none" : "block";
  });

  // 🔁 Hide dropdown when clicked outside
  document.addEventListener("click", (event) => {
    if (
      !dropdownToggle.contains(event.target) &&
      !dropdownMenu.contains(event.target)
    ) {
      dropdownMenu.style.display = "none";
    }
  });

  const tbody = document.querySelector(".log-table tbody");
  if (!tbody) return console.error("Table body not found");

  try {
    // 🔁 Fetch all designees
    const designeeSnap = await db.collection("Designees").get();
    const designeeList = designeeSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // 🔁 Fetch lookup tables
    const [clubsSnap, groupsSnap, departmentsSnap, officesSnap, labsSnap] =
      await Promise.all([
        db.collection("acadClubTable").get(),
        db.collection("groupTable").get(),
        db.collection("departmentTable").get(),
        db.collection("officeTable").get(),
        db.collection("labTable").get(), // ✅ Fetch labs
      ]);

    const clubsMap = {};
    clubsSnap.forEach((doc) => {
      const data = doc.data();
      clubsMap[doc.id] = data.codeName || "";
    });

    const groupsMap = {};
    groupsSnap.forEach((doc) => {
      const data = doc.data();
      groupsMap[doc.id] = data.club || "";
    });

    const departmentsMap = {};
    departmentsSnap.forEach((doc) => {
      const data = doc.data();
      departmentsMap[doc.id] = data.department || "";
    });

    const officesMap = {};
    officesSnap.forEach((doc) => {
      const data = doc.data();
      officesMap[doc.id] = data.office || "";
    });

    const labsMap = {};
    labsSnap.forEach((doc) => {
      const data = doc.data();
      labsMap[doc.id] = data.lab || "";
    });

    // 🔁 Render designees
    tbody.innerHTML = "";
    designeeList.forEach((designee) => {
      let categoryName = "";
      if (designee.category) {
        categoryName =
          clubsMap[designee.category] ||
          groupsMap[designee.category] ||
          labsMap[designee.category] || // ✅ Added lab check for category
          designee.category;
      }

      const deptName =
        departmentsMap[designee.department] || designee.department || "";
      const officeName = officesMap[designee.office] || designee.office || "";
      const labName = labsMap[designee.laboratory] || designee.laboratory || ""; // ✅ For separate lab column if present

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${designee.userID || ""}</td>
        <td>${designee.firstName || ""}</td>
        <td>${designee.lastName || ""}</td>
        <td>${officeName || "N/A"}</td>
        <td>${deptName || "N/A"}</td>
        <td>${categoryName || "N/A"}</td>
        <td>${labName || "N/A"}</td>
        <td>${designee.institutionalEmail || ""}</td>
        <td>
          <button class="action-btn delete" data-id="${designee.id}">
            <i class="fas fa-trash-alt"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // ✅ Delete Modal Elements
    const deleteModal = document.getElementById("deleteModalOverlay");
    const deleteCancelBtn = document.getElementById("deleteCancelBtn");
    const deleteConfirmBtn = document.getElementById("deleteConfirmBtn");

    let currentDeleteId = null;

    // 🔁 Delete button click
    document.querySelectorAll(".action-btn.delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentDeleteId = btn.dataset.id;
        deleteModal.style.display = "flex";
      });
    });

    // 🔁 Cancel delete
    deleteCancelBtn.addEventListener("click", () => {
      deleteModal.style.display = "none";
      currentDeleteId = null;
    });

    // 🔁 Confirm delete
    deleteConfirmBtn.addEventListener("click", async () => {
      if (!currentDeleteId) return;

      try {
        await db.collection("Designees").doc(currentDeleteId).delete();
        
        deleteModal.style.display = "none";
        location.reload(); // refresh to show changes
      } catch (error) {
        console.error("Error deleting designee:", error);
      }
    });
  } catch (error) {
    console.error("Error loading designees:", error);
  }
});

// ✅ Sidebar submenu toggle
function initSidebarDropdowns() {
  const dropdownToggles = document.querySelectorAll(".dropdown-toggle");
  dropdownToggles.forEach((toggle) => {
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
