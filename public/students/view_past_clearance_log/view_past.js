// ================= Firestore Collections =================
const COLLECTIONS = {
  semester: "/DataTable/Semester/SemesterDocs",
  clubs: "/DataTable/Clubs/ClubsDocs",
  office: "/DataTable/Office/OfficeDocs",
  department: "/DataTable/Department/DepartmentDocs",
  lab: "/DataTable/Lab/LabDocs",
  course: "/DataTable/Course/CourseDocs",
  yearLevel: "/DataTable/YearLevel/YearLevelDocs",
  designees: "/User/Designees/DesigneesDocs",
  students: "/User/Students/StudentsDocs"
};

// ================= DOMContentLoaded =================
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

  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();

  // ------------------ 🔹 Display Student Name ------------------ //
  const usernameDisplay = document.getElementById("usernameDisplay");
  const studentName = localStorage.getItem("studentName") || "Unknown";
  if (usernameDisplay) usernameDisplay.textContent = studentName;

  // ------------------ 🔹 Logout ------------------ //
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", e => {
      e.preventDefault();
      [
        "userData","studentName","schoolID","studentID","staffID",
        "designeeID","category","office","department"
      ].forEach(key => localStorage.removeItem(key));
      window.location.href = "../../logout.html";
    });
  }

  // ------------------ 🔹 User Dropdown ------------------ //
  const toggle = document.getElementById("userDropdownToggle");
  const menu = document.getElementById("dropdownMenu");
  if (toggle && menu) {
    toggle.addEventListener("click", () => {
      toggle.classList.toggle("active");
      menu.style.display = menu.style.display === "block" ? "none" : "block";
    });
    document.addEventListener("click", e => {
      if (!toggle.contains(e.target) && !menu.contains(e.target)) menu.style.display = "none";
    });
  }

  // ------------------ 🔹 Submenu Toggle ------------------ //
  document.querySelectorAll(".dropdown-toggle").forEach(tg => {
    tg.addEventListener("click", e => {
      e.preventDefault();
      tg.parentElement.classList.toggle("open");
    });
  });

  // ------------------ 🔹 Clearance Logs ------------------ //
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

  studentIdSpan.textContent = studentId;
  studentNameSpan.textContent = studentName;

  // ------------------ 🔹 Step 1: Populate Semesters ------------------ //
  const semesterDocsSnap = await db.collection(COLLECTIONS.semester).get();
  const semestersMap = {};
  semesterDocsSnap.forEach(doc => {
    const data = doc.data();
    if (data.semester) semestersMap[doc.id] = data.semester;
  });

  if (semesterSelect) {
    semesterSelect.innerHTML = "";
    Object.entries(semestersMap).forEach(([id, name]) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = name;
      semesterSelect.appendChild(option);
    });
  }

  // ------------------ 🔹 Step 2: Fetch Student History ------------------ //
  const historyDoc = await db.collection("/History").doc(studentId).get();
  if (!historyDoc.exists) {
    officesContainer.innerHTML = "<p>No history records found.</p>";
    statusSpan.textContent = "Pending";
    return;
  }
  const semestersData = historyDoc.data();

  // ------------------ 🔹 Helper: Get Office Display Name & Image ------------------ //
  async function getOfficeDisplay(designeeId, fallbackName) {
    let officeName = fallbackName || designeeId;
    let imageId = null;

    try {
      const designeeDoc = await db.collection(COLLECTIONS.designees).doc(designeeId).get();
      if (designeeDoc.exists) {
        const designee = designeeDoc.data();
        imageId = designee.category || designee.office;

        const catCollections = [
          COLLECTIONS.clubs,
          COLLECTIONS.lab,
          COLLECTIONS.office,
          COLLECTIONS.department
        ];
        for (const col of catCollections) {
          if (!imageId) break;
          const doc = await db.collection(col).doc(imageId).get();
          if (doc.exists) {
            const data = doc.data();
            officeName = data.club || data.lab || data.office || data.department || officeName;
            break;
          }
        }
      }
    } catch (e) {
      console.error("Error fetching office info:", e);
    }

    return { officeName, imageId };
  }

  // ------------------ 🔹 Step 3: Render Clearance Cards ------------------ //
  // ------------------ Render Clearance Cards ------------------ //
async function renderClearance(semesterId) {
  officesContainer.innerHTML = "";
  semesterLabel.textContent = semestersMap[semesterId] || "Select Semester";

  const semesterInfoArray = semestersData[semesterId];
  if (!semesterInfoArray || !semesterInfoArray.length) return;

  const semesterInfo = semesterInfoArray[0];
  const offices = semesterInfo.offices || [];
  let allCleared = true;

  for (const office of offices) {
    const officeCleared = office.allCleared || false;
    if (!officeCleared) allCleared = false;

    const officeDiv = document.createElement("div");
    officeDiv.classList.add("office-section");

    // Office Name (always displayed)
    const officeHeader = document.createElement("h3");
    officeHeader.textContent = office.officeName || office.designeeId;
    officeDiv.appendChild(officeHeader);

    // Status / Details
    const contentDiv = document.createElement("div");
    contentDiv.classList.add("office-status");

    if (officeCleared) {
      const lastReq = office.requirements?.length
        ? office.requirements[office.requirements.length - 1]
        : null;
      const lastCheckedBy = lastReq?.checkedBy || office.lastCheckedBy || "N/A";
      const lastCheckedAtRaw = lastReq?.checkedAt || office.checkedAt || null;
      const lastCheckedAt = lastCheckedAtRaw
        ? new Date(lastCheckedAtRaw).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "numeric",
            hour12: true
          })
        : "Unknown";

      // Image
      if (office.imageId) {
        const img = document.createElement("img");
        img.src = `../../logo/${office.imageId}.png`;
        img.alt = office.officeName;
        img.style.width = "50px";
        img.style.height = "50px";
        img.onerror = function() { this.src = "../../Tatak.png"; };
        contentDiv.appendChild(img);
      }

      // Last Checked By
      const checkedByLabel = document.createElement("p");
      checkedByLabel.textContent = `Approved By:${lastCheckedBy}`;
      contentDiv.appendChild(checkedByLabel);

      // Checked At
      const checkedAtLabel = document.createElement("p");
      checkedAtLabel.textContent = `${lastCheckedAt}`;
      contentDiv.appendChild(checkedAtLabel);
    } else {
      contentDiv.innerHTML = `<span style="color:red">Pending</span>`;
    }

    officeDiv.appendChild(contentDiv);
    officesContainer.appendChild(officeDiv);
  }

  statusSpan.textContent = allCleared ? "All Offices Cleared" : "Pending";
  statusSpan.style.color = allCleared ? "green" : "red";
}




  // ------------------ 🔹 Step 4: Initial Render ------------------ //
  const firstSemesterId = semesterSelect.value || Object.keys(semestersMap)[0];
  if (firstSemesterId) await renderClearance(firstSemesterId);

  semesterSelect.addEventListener("change", e => {
    renderClearance(e.target.value);
  });
});
