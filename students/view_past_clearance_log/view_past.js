// ✅ Toggle sub menu (for side navs with chevron)
function toggleSubMenu(id) {
  const submenu = document.getElementById(id);
  submenu.style.display = submenu.style.display === "block" ? "none" : "block";

  const chevron = document.getElementById("accountsChevron");
  if (chevron) chevron.classList.toggle("rotated");
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
  const studentIdEl = document.getElementById("studentId");
  const studentNameEl = document.getElementById("studentName");
  const statusEl = document.getElementById("status");
  const officesContainer = document.getElementById("officesContainer");

  try {
    // 🔹 Fetch clearance log of this student
    const logDoc = await db.collection("StudentsClearanceLog").doc(studentId).get();
    if (!logDoc.exists) {
      semesterSelect.innerHTML = `<option>No past clearances found</option>`;
      return;
    }

    const logData = logDoc.data();

    // 🔹 Populate dropdown with available semesters
    semesterSelect.innerHTML = `<option value="">Select Semester</option>`;
    Object.keys(logData.clearances).forEach((semId) => {
      const sem = logData.clearances[semId];
      const opt = document.createElement("option");
      opt.value = semId;
      opt.textContent = sem.semesterName;
      semesterSelect.appendChild(opt);
    });

    // 🔹 Fill student info
    studentIdEl.textContent = logData.schoolID || studentId;
    studentNameEl.textContent = logData.fullName || "";

    // 🔹 Auto-load the first semester if exists
    const firstSemId = Object.keys(logData.clearances)[0];
    if (firstSemId) {
      semesterSelect.value = firstSemId;
      renderSemester(logData.clearances[firstSemId]);
    }

    // 🔹 Change event for dropdown
    semesterSelect.addEventListener("change", (e) => {
      const selectedSemId = e.target.value;
      if (!selectedSemId) {
        semesterLabel.textContent = "Select a semester";
        officesContainer.innerHTML = "";
        statusEl.textContent = "";
        return;
      }
      renderSemester(logData.clearances[selectedSemId]);
    });

    // 🔹 Render semester offices
    function renderSemester(sem) {
      semesterLabel.textContent = sem.semesterName;
      officesContainer.innerHTML = "";

      let overallCleared = true;

      for (const [officeName, officeData] of Object.entries(sem.offices)) {
        const div = document.createElement("div");
        div.classList.add("section-item");

        const statusCleared = officeData.status === "Cleared";
        if (!statusCleared) overallCleared = false;

        div.innerHTML = `
          <label>${officeName}</label>
          ${
            statusCleared
              ? `<img src="../../Tatak.png" style="width:40px;">
                 <label><i>approved by ${officeData.approvedBy || "Unknown"}</i></label>`
              : `<label><i>Not Cleared</i></label>`
          }
        `;
        officesContainer.appendChild(div);
      }

      statusEl.innerHTML = overallCleared
        ? `<span style="color:green">Completed</span>`
        : `<span style="color:red">Pending</span>`;
    }
  } catch (err) {
    console.error("Error loading past clearance:", err);
    semesterSelect.innerHTML = `<option>Error loading</option>`;
  }
});
