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
  usernameDisplay.textContent = storedAdminID || "Unknown";

  // 🔁 Dropdown toggle
  const dropdownToggle = document.getElementById("userDropdownToggle");
  const dropdownMenu = document.getElementById("dropdownMenu");
  dropdownToggle.addEventListener("click", () => {
    dropdownMenu.style.display =
      dropdownMenu.style.display === "block" ? "none" : "block";
  });

  document.addEventListener("click", (event) => {
    if (!dropdownToggle.contains(event.target) && !dropdownMenu.contains(event.target)) {
      dropdownMenu.style.display = "none";
    }
  });

  const tbody = document.querySelector(".log-table tbody");
  if (!tbody) return console.error("Table body not found");

  try {
    // 🔁 Fetch designees
    const designeeSnap = await db.collection("Designees").get();
    const designeeList = designeeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 🔁 Fetch lookup tables
    const [clubsSnap, groupsSnap, departmentsSnap, officesSnap, labsSnap] = await Promise.all([
      db.collection("acadClubTable").get(),
      db.collection("groupTable").get(),
      db.collection("departmentTable").get(),
      db.collection("officeTable").get(),
      db.collection("labTable").get()
    ]);

    const clubsMap = {};
    clubsSnap.forEach(doc => clubsMap[doc.id] = doc.data().codeName || "");

    const groupsMap = {};
    groupsSnap.forEach(doc => groupsMap[doc.id] = doc.data().club || "");

    const departmentsMap = {};
    departmentsSnap.forEach(doc => departmentsMap[doc.id] = doc.data().department || "");

    const officesMap = {};
    officesSnap.forEach(doc => officesMap[doc.id] = doc.data().office || "");

    const labsMap = {};
    labsSnap.forEach(doc => labsMap[doc.id] = doc.data().lab || "");

    // 🔁 Function to color status cells
    function updateStatusCellColor(cell, status) {
      cell.textContent = status;
      cell.style.color = "#fff";
      cell.style.fontWeight = "600";
      if (status === "Approved") cell.style.backgroundColor = "#4CAF50"; // green
      else if (status === "Declined") cell.style.backgroundColor = "#f44336"; // red
      else cell.style.backgroundColor = "#9e9e9e"; // gray
    }

    // 🔁 Render designees
    tbody.innerHTML = "";
    designeeList.forEach(designee => {
      let categoryName = "";
      if (designee.category) {
        categoryName = clubsMap[designee.category] || groupsMap[designee.category] || labsMap[designee.category] || designee.category;
      }

      const deptName = departmentsMap[designee.department] || designee.department || "";
      const officeName = officesMap[designee.office] || designee.office || "";
      const labName = labsMap[designee.laboratory] || designee.laboratory || "";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${designee.userID || ""}</td>
        <td>${designee.firstName || ""}</td>
        <td>${designee.lastName || ""}</td>
        <td>${officeName || "N/A"}</td>
        <td>${deptName || "N/A"}</td>
        <td>${categoryName || "N/A"}</td>
        <td>${designee.institutionalEmail || ""}</td>
        <td class="status-cell">${designee.status || "Pending"}</td>
        <td>
          <button class="status-btn" data-id="${designee.id}" data-name="${designee.firstName} ${designee.lastName}">Change Status</button>
          <button class="action-btn delete" data-id="${designee.id}">
            <i class="fas fa-trash-alt"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);

      // Set initial status cell color
      const statusCell = tr.querySelector(".status-cell");
      updateStatusCellColor(statusCell, designee.status || "Pending");
    });

    // ✅ Delete Modal
    const deleteModal = document.getElementById("deleteModalOverlay");
    const deleteCancelBtn = document.getElementById("deleteCancelBtn");
    const deleteConfirmBtn = document.getElementById("deleteConfirmBtn");
    let currentDeleteId = null;

    document.querySelectorAll(".action-btn.delete").forEach(btn => {
      btn.addEventListener("click", () => {
        currentDeleteId = btn.dataset.id;
        deleteModal.style.display = "flex";
      });
    });

    deleteCancelBtn.addEventListener("click", () => {
      deleteModal.style.display = "none";
      currentDeleteId = null;
    });

    deleteConfirmBtn.addEventListener("click", async () => {
      if (!currentDeleteId) return;
      try {
        await db.collection("Designees").doc(currentDeleteId).delete();
        deleteModal.style.display = "none";
        location.reload();
      } catch (error) {
        console.error("Error deleting designee:", error);
      }
    });

    // ✅ Status Modal
    const statusModal = document.getElementById("statusModalOverlay");
    const statusCancelBtn = document.getElementById("statusCancelBtn");
    const statusConfirmBtn = document.getElementById("statusConfirmBtn");
    const statusSelect = document.getElementById("statusSelect");
    const statusModalName = document.getElementById("statusModalName");
    let currentStatusId = null;
    let currentStatusCell = null;

    document.querySelectorAll(".status-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        currentStatusId = btn.dataset.id;
        currentStatusCell = btn.closest("tr").querySelector(".status-cell");
        statusModalName.textContent = btn.dataset.name;
        statusSelect.value = currentStatusCell.textContent || "Pending";
        statusModal.style.display = "flex";
      });
    });

    statusCancelBtn.addEventListener("click", () => {
      statusModal.style.display = "none";
      currentStatusId = null;
      currentStatusCell = null;
    });

    statusConfirmBtn.addEventListener("click", async () => {
      if (!currentStatusId) return;
      const newStatus = statusSelect.value;
      try {
        await db.collection("Designees").doc(currentStatusId).update({ status: newStatus });
        updateStatusCellColor(currentStatusCell, newStatus);
        statusModal.style.display = "none";
      } catch (error) {
        console.error("Error updating status:", error);
      }
      currentStatusId = null;
      currentStatusCell = null;
    });

  } catch (error) {
    console.error("Error loading designees:", error);
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
