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
  semesters.sort();

  // Populate dropdown
  semesters.forEach((sem) => {
    const option = document.createElement("option");
    option.value = sem;
    option.textContent = sem;
    semesterSelect.appendChild(option);
  });

  // ---------------- Helper: Get readable office/club name with image ----------------
  async function getReadableNameWithImage(designeeId) {
    try {
      const designeeDoc = await db.collection("Designees").doc(designeeId).get();
      if (!designeeDoc.exists) return { officeName: designeeId, imageId: null };

      const designee = designeeDoc.data();
      let officeName = null;
      let imageId = designee.category || null;

      // Category tables first
      if (imageId) {
        const catTables = ["acadClubTable", "groupTable", "labTable"];
        for (const table of catTables) {
          const doc = await db.collection(table).doc(imageId).get();
          if (doc.exists) {
            const data = doc.data();
            officeName = data.club || data.lab || officeName;
            if (officeName) break;
          }
        }
      }

      // Fallback to office ID if no category image
      if (!officeName && designee.office) {
        const officeDoc = await db.collection("officeTable").doc(designee.office).get();
        if (officeDoc.exists) officeName = officeDoc.data().office;
        imageId = imageId || designee.office;
      }

      // Fallback to department + office
      if (!officeName && designee.department) {
        const depDoc = await db.collection("departmentTable").doc(designee.department).get();
        const depName = depDoc.exists ? depDoc.data().department : "";
        if (designee.office) {
          const offDoc = await db.collection("officeTable").doc(designee.office).get();
          const offName = offDoc.exists ? offDoc.data().office : "";
          officeName = depName && offName ? `${depName} - ${offName}` : depName || offName;
          imageId = imageId || designee.office;
        } else {
          officeName = depName;
        }
      }

      // Fallback to full name
      if (!officeName && (designee.firstName || designee.lastName)) {
        officeName = `${designee.firstName || ""} ${designee.lastName || ""}`.trim();
      }

      return { officeName, imageId };
    } catch (err) {
      console.error("Error fetching readable name:", err);
      return { officeName: designeeId, imageId: null };
    }
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
    statusSpan.style.color = overallStatus === "Pending" ? "red" :
                            overallStatus === "Cleared" ? "green" : "black";

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

      // Get readable name and image
      const { officeName, imageId } = await getReadableNameWithImage(officeId);

      // Build office section
      const officeDiv = document.createElement("div");
      officeDiv.classList.add("office-section");

      const officeHeader = document.createElement("h3");
      officeHeader.textContent = officeName || officeId;
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
              hour12: true
            })
          : "N/A";

        const imgSrc = `../../logo/${imageId || officeId || "default"}.png`;

        contentDiv.innerHTML = `
          <img src="${imgSrc}" 
               alt="Cleared" 
               style="width:50px; height:50px;" 
               onerror="this.onerror=null;this.src='../../Tatak.png';" /><br />
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
