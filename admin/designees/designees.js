// ✅ Initialize Firebase v8
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

// ✅ Helper: get designeeId from email link
const urlParams = new URLSearchParams(window.location.search);
const designeeLinkId = urlParams.get("designeeId");

// ✅ Approve designee if link clicked
async function approveDesigneeByLink() {
  if (!designeeLinkId) return;

  try {
    const pendingRef = db
      .collection("User")
      .doc("PendingDesignees")
      .collection("PendingDocs")
      .doc(designeeLinkId);

    const pendingSnap = await pendingRef.get();
    if (!pendingSnap.exists) {
      alert("Designee not found. Invalid link.");
      return;
    }

    const pendingData = pendingSnap.data();

    // Update pending status
    await pendingRef.update({
      status: "Approved",
      approvedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Move to DesigneesDocs
    await db.collection("User")
      .doc("Designees")
      .collection("DesigneesDocs")
      .doc(designeeLinkId)
      .set({
        ...pendingData,
        status: "Approved",
        approvedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

    // Save to localStorage
    localStorage.setItem("userData", JSON.stringify({
      id: designeeLinkId,
      ...pendingData,
      status: "Approved",
      role: "designee"
    }));

    alert(`Hi ${pendingData.firstName}, your account has been approved! Redirecting to dashboard...`);
    window.location.href = "../Designee/designee.html";

  } catch (error) {
    console.error("Error approving designee via link:", error);
    alert("Error approving your account. Please try again.");
  }
}

// ✅ Wait for DOM to load
document.addEventListener("DOMContentLoaded", async () => {
  await approveDesigneeByLink();

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const keysToRemove = [
        "userData", "studentName", "schoolID", "studentID", "staffID", "designeeID",
        "category", "office", "department", "adminID"
      ];
      keysToRemove.forEach(key => localStorage.removeItem(key));
      window.location.href = "../../../logout.html";
    });
  }

  const usernameDisplay = document.getElementById("usernameDisplay");
  usernameDisplay.textContent = localStorage.getItem("adminID") || "Unknown";

  // Dropdown toggle
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
    // 🔁 Fetch pending designees
    const pendingSnap = await db.collection("User")
      .doc("PendingDesignees")
      .collection("PendingDocs")
      .get();
    const designeeList = pendingSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 🔁 Fetch lookup tables
    const [officeSnap, deptSnap, clubSnap, labSnap] = await Promise.all([
      db.collection("/DataTable/Office/OfficeDocs").get(),
      db.collection("/DataTable/Department/DepartmentDocs").get(),
      db.collection("/DataTable/Clubs/ClubsDocs").get(),
      db.collection("/DataTable/Lab/LabDocs").get()
    ]);

    const officeMap = {};
    officeSnap.forEach(doc => officeMap[doc.id] = doc.data().office || doc.id);

    const deptMap = {};
    deptSnap.forEach(doc => deptMap[doc.id] = doc.data().department || doc.id);

    const clubMap = {};
    clubSnap.forEach(doc => clubMap[doc.id] = doc.data().code || doc.id);

    const labMap = {};
    labSnap.forEach(doc => labMap[doc.id] = doc.data().lab || doc.id);

    // 🔁 Function to get readable category
    function getCategoryName(categoryId, officeId) {
      if (officeId === "8") return labMap[categoryId] || categoryId;
      // Offices 1,15,13,14,16 use Clubs code
      const clubOffices = ["1","15","13","14","16"];
      if (clubOffices.includes(officeId)) return clubMap[categoryId] || categoryId;
      return categoryId; // Others just show raw ID
    }

    // 🔁 Function to color status cells
    function updateStatusCellColor(cell, status) {
      cell.textContent = status;
      cell.style.color = "#fff";
      cell.style.fontWeight = "600";
      if (status === "Approved") cell.style.backgroundColor = "#4CAF50";
      else if (status === "Declined") cell.style.backgroundColor = "#f44336";
      else cell.style.backgroundColor = "#9e9e9e";
    }

    // 🔁 Render pending designees
    tbody.innerHTML = "";
    designeeList.forEach(designee => {
      const tr = document.createElement("tr");
      const officeName = officeMap[designee.office] || designee.office || "N/A";
      const deptName = deptMap[designee.department] || designee.department || "N/A";
      const categoryName = getCategoryName(designee.category, designee.office);

      tr.innerHTML = `
        <td>${designee.userID || ""}</td>
        <td>${designee.firstName || ""}</td>
        <td>${designee.lastName || ""}</td>
        <td>${officeName}</td>
        <td>${deptName}</td>
        <td>${categoryName}</td>
        <td>${designee.institutionalEmail || ""}</td>
        <td class="status-cell">${designee.status || "Pending"}</td>
        <td>
          <button class="status-btn" data-id="${designee.id}" data-name="${designee.firstName} ${designee.lastName}" data-email="${designee.institutionalEmail}">
          <i class="fa-solid fa-paper-plane"></i>
          </button>
          <button class="action-btn delete" data-id="${designee.id}">
            <i class="fas fa-trash-alt"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
      updateStatusCellColor(tr.querySelector(".status-cell"), designee.status || "Pending");
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
        await db.collection("User").doc("PendingDesignees").collection("PendingDocs").doc(currentDeleteId).delete();
        deleteModal.style.display = "none";
        location.reload();
      } catch (error) {
        console.error("Error deleting pending designee:", error);
      }
    });

    // ✅ Send Approval Email button
    document.querySelectorAll(".status-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const email = btn.dataset.email;
        const name = btn.dataset.name;
        const designeeId = btn.dataset.id;

        sendApprovalEmail(email, name, designeeId);
        alert(`Approval email sent to ${email}. Designee will be approved after clicking the link.`);
      });
    });

  } catch (error) {
    console.error("Error loading pending designees:", error);
  }
});

// ✅ Function to call Firebase Cloud Function for sending approval email
function sendApprovalEmail(email, name, designeeId) {
  const cloudFunctionUrl = "http://127.0.0.1:5001/tatak-mobile-web/us-central1/sendApprovalEmail";

  fetch(cloudFunctionUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email,
      firstName: name,
      link: `http://127.0.0.1:5500/login/designee_login.html?designeeId=${designeeId}`
    })
  })
  .then(res => res.json())
  .then(data => console.log("Email sent (local):", data))
  .catch(err => console.error("Email send error (local):", err));
}

// ✅ Sidebar submenu toggle
function initSidebarDropdowns() {
  const dropdownToggles = document.querySelectorAll(".dropdown-toggle");
  dropdownToggles.forEach(toggle => {
    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      const submenu = toggle.parentElement.querySelector(".submenu");
      if (submenu.style.display === "block") {
        submenu.style.display = "none";
        toggle.querySelector(".arrow")?.classList.remove("rotated");
      } else {
        submenu.style.display = "block";
        toggle.querySelector(".arrow")?.classList.add("rotated");
      }
    });
  });
}
document.addEventListener("DOMContentLoaded", initSidebarDropdowns);
