// ✅ Toggle sub menu (for side navs with chevron)
function toggleSubMenu(id) {
  const submenu = document.getElementById(id);
  submenu.style.display = submenu.style.display === "block" ? "none" : "block";

  const chevron = document.getElementById("accountsChevron");
  if (chevron) chevron.classList.toggle("rotated");
}

function displayFirstName() {
  const usernameDisplay = document.getElementById("usernameDisplay");
  if (!usernameDisplay) return;

  const studentName = localStorage.getItem("studentName");
  if (!studentName) return;

  // Split by space and take the first word as first name
  const firstName = studentName.split(" ")[0] || "";
  usernameDisplay.textContent = firstName;
}
document.addEventListener("DOMContentLoaded", async () => {
  // ------------------ 🔹 Firebase Init ------------------ //
  const firebaseConfig = {
    apiKey: "AIzaSyDdSSYjX1DHKskbjDOnnqq18yXwLpD3IpQ",
    authDomain: "tatak-mobile-web.firebaseapp.com",
    projectId: "tatak-mobile-web",
    storageBucket: "tatak-mobile-web.firebasestorage.app",
    messagingSenderId: "771908675869",
    appId: "1:771908675869:web:88e68ca51ed7ed4da019f4",
    measurementId: "G-CENPP29LKQ",
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const db = firebase.firestore();
  displayFirstName();
  // ------------------ 🔹 Logout Logic ------------------ //
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
      window.location.href = "../../logout.html"; // ✅ two levels up
    });
  } else {
    console.warn("logoutBtn not found");
  }

  // ------------------ 🔹 User Dropdown ------------------ //
  const toggle = document.getElementById("userDropdownToggle");
  const menu = document.getElementById("dropdownMenu");

  if (toggle && menu) {
    toggle.addEventListener("click", () => {
      toggle.classList.toggle("active");
      menu.style.display = menu.style.display === "block" ? "none" : "block";
    });

    // Hide menu when clicking outside
    document.addEventListener("click", (e) => {
      if (!toggle.contains(e.target) && !menu.contains(e.target)) {
        menu.style.display = "none";
      }
    });
  }

  // ------------------ 🔹 Submenu Toggle ------------------ //
  document.querySelectorAll(".dropdown-toggle").forEach((toggle) => {
    toggle.addEventListener("click", function (e) {
      e.preventDefault();
      const parentLi = this.parentElement;
      parentLi.classList.toggle("open");
    });
  });

  // ------------------ 🔹 Clearance Logs Logic ------------------ //
  const studentId = localStorage.getItem("schoolID");
  if (!studentId) {
    alert("Session expired. Please log in again.");
    window.location.href = "../../login/student_login.html";
    return;
  }

  const semesterSelect = document.getElementById("semesterSelect");
  const semesterLabel = document.getElementById("semesterLabel");
  const officesContainer = document.getElementById("officesContainer");
  const studentNameSpan = document.getElementById("studentName");
  const studentIdSpan = document.getElementById("studentId");
  const statusSpan = document.getElementById("status");

  // Populate student basic info
  studentIdSpan.textContent = studentId;
  studentNameSpan.textContent = localStorage.getItem("studentName") || "Unknown";

  // 🔹 Step 1: Fetch from History collection
  const historyDoc = await db.collection("History").doc(studentId).get();
  if (!historyDoc.exists) {
    officesContainer.innerHTML = `<p>No history records found.</p>`;
    return;
  }

  const historyData = historyDoc.data();
  const semestersData = historyData.semesters || {};

  const semesters = Object.keys(semestersData);
  semesters.sort(); // optional

  // Populate dropdown
  semesters.forEach((sem) => {
    const option = document.createElement("option");
    option.value = sem;
    option.textContent = sem;
    semesterSelect.appendChild(option);
  });

  // 🔹 Step 2: Render clearance logs by semester
  function renderClearance(selectedSemester) {
    officesContainer.innerHTML = "";

    if (!selectedSemester || !semestersData[selectedSemester]) {
      semesterLabel.textContent = "Select a semester";
      statusSpan.textContent = "";
      return;
    }

    semesterLabel.textContent = selectedSemester;

    const semesterInfo = semestersData[selectedSemester];
    const snapshot = semesterInfo.snapshot || {};
    const offices = snapshot.offices || {};
    const overallStatus = semesterInfo.overallStatus || "Pending";

    statusSpan.textContent = overallStatus;

    Object.entries(offices).forEach(([officeName, requirementsArray]) => {
      if (!Array.isArray(requirementsArray)) return;

      // Determine if ALL requirements cleared
      const allOfficeCleared = requirementsArray.every((req) => req.status === true);

      // Get the latest approver (last checkedBy)
      let lastCheckedBy = "N/A";
      let lastCheckedAt = null;

      requirementsArray.forEach((req) => {
        if (req.checkedAt) {
          const time = new Date(req.checkedAt);
          if (!lastCheckedAt || time > lastCheckedAt) {
            lastCheckedAt = time;
            lastCheckedBy = req.checkedBy || "N/A";
          }
        }
      });

      // Build office section
      const officeDiv = document.createElement("div");
      officeDiv.classList.add("office-section");

      const officeHeader = document.createElement("h3");
      officeHeader.textContent = officeName;
      officeDiv.appendChild(officeHeader);

      const contentDiv = document.createElement("div");
      contentDiv.classList.add("office-status");

      if (allOfficeCleared) {
        contentDiv.innerHTML = `
          <img src="../../Tatak.png" alt="Cleared" class="tatak-img" style="width:50px; height:50px;" />
          <p>Approved By: ${lastCheckedBy}</p>
        `;
      } else {
        contentDiv.innerHTML = `
          <p>Status: ❌ Pending</p>
        `;
      }

      officeDiv.appendChild(contentDiv);
      officesContainer.appendChild(officeDiv);
    });
  }

  // 🔹 Step 3: Listen for semester change
  semesterSelect.addEventListener("change", (e) => {
    renderClearance(e.target.value);
  });
});
