// ✅ Toggle sub menu (for side navs with chevron)
function toggleSubMenu(id) {
  const submenu = document.getElementById(id);
  submenu.style.display = submenu.style.display === "block" ? "none" : "block";

  const chevron = document.getElementById("accountsChevron");
  if (chevron) chevron.classList.toggle("rotated");
}

function displayFullName() {
  const usernameDisplay = document.getElementById("usernameDisplay");
  if (!usernameDisplay) return;

  const studentName = localStorage.getItem("studentName");
  if (!studentName) return;

  // Display full name
  usernameDisplay.textContent = studentName;
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
  displayFullName();

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

  // ---------------- Helper: Get readable office/club name ----------------
  async function getReadableName(designeeId) {
    const designeeDoc = await db.collection("Designees").doc(designeeId).get();
    if (!designeeDoc.exists) return designeeId;

    const designee = designeeDoc.data();
    const { category, department, office } = designee;

    // If category exists → check in club/lab/group tables
    if (category) {
      let nameDoc =
        (await db.collection("acadClubTable").doc(category).get()).data() ||
        (await db.collection("groupTable").doc(category).get()).data() ||
        (await db.collection("labTable").doc(category).get()).data();

      if (nameDoc) {
        return nameDoc.club || nameDoc.lab || category;
      }
    }

    // If department exists → combine office + department
    if (department) {
      const officeNameDoc = await db.collection("officeTable").doc(office).get();
      const departmentNameDoc = await db.collection("departmentTable").doc(department).get();
      const officeName = officeNameDoc.exists ? officeNameDoc.data().office : office;
      const deptName = departmentNameDoc.exists ? departmentNameDoc.data().department : department;
      return `${officeName} - ${deptName}`;
    }

    // If only office exists
    if (office) {
      const officeNameDoc = await db.collection("officeTable").doc(office).get();
      return officeNameDoc.exists ? officeNameDoc.data().office : office;
    }

    return designeeId;
  }

  // 🔹 Step 2: Render clearance logs by semester
  async function renderClearance(selectedSemester) {
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

    
if (overallStatus === "Pending") {
  statusSpan.style.color = "red";
} else if (overallStatus === "Cleared") {
  statusSpan.style.color = "green";
} else {
  statusSpan.style.color = "black"; // fallback/default
}

    for (const [officeId, requirementsArray] of Object.entries(offices)) {
      if (!Array.isArray(requirementsArray)) continue;

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

      // Get readable name
      const readableName = await getReadableName(officeId);

      // Build office section
      const officeDiv = document.createElement("div");
      officeDiv.classList.add("office-section");

      const officeHeader = document.createElement("h3");
      officeHeader.textContent = readableName;
      officeDiv.appendChild(officeHeader);

      const contentDiv = document.createElement("div");
      contentDiv.classList.add("office-status");

      
if (allOfficeCleared) {
 const checkedDateStr = lastCheckedAt
  ? new Date(lastCheckedAt).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true // 12-hour format
    })
  : "N/A";

  contentDiv.innerHTML = `
    <img src="../../Tatak.png" alt="Cleared" class="tatak-img" style="width:50px; height:50px;" /><br />
    <i>Approved By: ${lastCheckedBy}<br />
    ${checkedDateStr}<hr /></i>
  `;
} else {
  contentDiv.innerHTML = `
    <p>Not Cleared <hr /></p>
  `;
}

      officeDiv.appendChild(contentDiv);
      officesContainer.appendChild(officeDiv);
    }
  }

  // 🔹 Step 3: Listen for semester change
  semesterSelect.addEventListener("change", (e) => {
    renderClearance(e.target.value);
  });
});
