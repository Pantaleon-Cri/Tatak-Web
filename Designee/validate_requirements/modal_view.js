// ================= Helper Functions =================

// Collection paths configuration
const COLLECTIONS = {
  clubs: "DataTable/Clubs/ClubsDocs",
  lab: "DataTable/Lab/LabDocs",
  office: "DataTable/Office/OfficeDocs",
  department: "DataTable/Department/DepartmentDocs",
  designees: "User/Designees/DesigneesDocs",
  semester: "DataTable/Semester/SemesterDocs",
  students: "User/Students/StudentsDocs",
};

// ================= Global Caches =================
let officeCache = null;
let departmentCache = null;
let clubCache = null;
let labCache = null;

// Load all office/department/club data once and cache it
async function loadAllCaches(db) {
  if (officeCache) return; // Already loaded

  console.log("Loading cache data...");

  try {
    const [offices, departments, clubs, labs] = await Promise.all([
      db.collection(COLLECTIONS.office).get(),
      db.collection(COLLECTIONS.department).get(),
      db.collection(COLLECTIONS.clubs).get(),
      db.collection(COLLECTIONS.lab).get()
    ]);

    officeCache = {};
    offices.docs.forEach(doc => {
      officeCache[doc.id] = doc.data().office || doc.data().name;
    });

    departmentCache = {};
    departments.docs.forEach(doc => {
      departmentCache[doc.id] = doc.data().code || doc.data().name;
    });

    clubCache = {};
    clubs.docs.forEach(doc => {
      clubCache[doc.id] = doc.data().code || doc.data().name;
    });

    labCache = {};
    labs.docs.forEach(doc => {
      labCache[doc.id] = doc.data().lab || doc.data().name;
    });

    console.log("Cache loaded successfully");
  } catch (err) {
    console.error("Failed to load cache:", err);
  }
}

// Normalize strings for comparison
function normalizeString(str) {
  return String(str || "").trim().toLowerCase();
}

// Format ISO timestamp to "Month day, year, hh:mm AM/PM"
function formatTimestampTo12Hr(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);

  const options = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  };

  return date.toLocaleString("en-US", options);
}

// Resolve designee/office name and image using cached data (NO DATABASE CALLS)
function resolveOfficeNameWithImageCached(designeeId) {
  let officeName = null;
  let imageId = "default";

  try {
    if (/^\d+$/.test(designeeId)) {
      officeName = officeCache?.[designeeId] || designeeId;
      imageId = designeeId === "7" ? "001" : designeeId;
      if (designeeId === "12") imageId = "default";

    } else if (/^\d+-\d+$/.test(designeeId)) {
      const [firstNum, secondNum] = designeeId.split("-");
      const first = Number(firstNum);
      const second = Number(secondNum);

      if ([2, 3, 5, 6, 9, 10, 12].includes(first)) {
        officeName = officeCache?.[firstNum] || designeeId;
      } else if ([4, 7, 11].includes(first)) {
        const officeNamePart = officeCache?.[firstNum];
        const deptNamePart = departmentCache?.[secondNum];
        officeName = deptNamePart && officeNamePart
          ? `${officeNamePart} - ${deptNamePart}`
          : deptNamePart || officeNamePart || designeeId;
      } else if ([1, 13, 14, 15, 16].includes(first)) {
        officeName = clubCache?.[secondNum] || labCache?.[secondNum] || designeeId;
      } else if (first === 8) {
        officeName = labCache?.[secondNum] || designeeId;
      } else {
        officeName = designeeId;
      }

      if (first === 7) imageId = "001";
      else if (first === 12) imageId = "default";
      else imageId = `${firstNum}${secondNum}`;
    } else {
      officeName = designeeId;
      imageId = designeeId;
    }

    return { officeName: officeName || designeeId, imageId: imageId || "default" };
  } catch (err) {
    console.error("Error resolving office name:", err);
    return { officeName: designeeId, imageId: "default" };
  }
}

// Async fallback version
async function resolveOfficeNameWithImage(db, designeeId) {
  if (officeCache) return resolveOfficeNameWithImageCached(designeeId);

  try {
    let officeName = null;
    let imageId = "default";

    if (/^\d+$/.test(designeeId)) {
      const officeDoc = await db.collection(COLLECTIONS.office).doc(designeeId).get();
      if (officeDoc.exists) officeName = officeDoc.data().office || officeDoc.data().name;
      imageId = designeeId === "7" ? "001" : designeeId;
      if (designeeId === "12") imageId = "default";

    } else if (/^\d+-\d+$/.test(designeeId)) {
      const [firstNum, secondNum] = designeeId.split("-").map(Number);

      if ([2, 3, 5, 6, 9, 10, 12].includes(firstNum)) {
        const officeDoc = await db.collection(COLLECTIONS.office).doc(String(firstNum)).get();
        officeName = officeDoc.exists ? officeDoc.data().office || officeDoc.data().name : designeeId;

      } else if ([4, 7, 11].includes(firstNum)) {
        const officeDoc = await db.collection(COLLECTIONS.office).doc(String(firstNum)).get();
        const deptDoc = await db.collection(COLLECTIONS.department).doc(String(secondNum)).get();
        const officeNamePart = officeDoc.exists ? officeDoc.data().office || officeDoc.data().name : null;
        const deptNamePart = deptDoc.exists ? deptDoc.data().code : null;
        officeName = deptNamePart && officeNamePart
          ? `${officeNamePart} - ${deptNamePart}`
          : deptNamePart || officeNamePart || designeeId;

      } else if ([1, 13, 14, 15, 16].includes(firstNum)) {
        const clubDoc = await db.collection(COLLECTIONS.clubs).doc(String(secondNum)).get();
        if (clubDoc.exists) officeName = clubDoc.data().code || clubDoc.data().name;
        else {
          const labDoc = await db.collection(COLLECTIONS.lab).doc(String(secondNum)).get();
          officeName = labDoc.exists ? labDoc.data().lab || labDoc.data().name : designeeId;
        }

      } else if (firstNum === 8) {
        const labDoc = await db.collection(COLLECTIONS.lab).doc(String(secondNum)).get();
        officeName = labDoc.exists ? labDoc.data().lab || labDoc.data().name : designeeId;
      } else {
        officeName = designeeId;
      }

      if (firstNum === 7) imageId = "001";
      else if (firstNum === 12) imageId = "default";
      else imageId = `${firstNum}${secondNum}`;
    } else {
      officeName = designeeId;
      imageId = designeeId;
    }

    return { officeName: officeName || designeeId, imageId: imageId || "default" };
  } catch (err) {
    console.error("Error resolving office name:", err);
    return { officeName: designeeId, imageId: "default" };
  }
}

// -------------------- Modal Handling --------------------
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("clearanceModal");
  const closeBtn = document.getElementById("closeClearanceBtn");

  if (closeBtn) closeBtn.addEventListener("click", () => modal.style.display = "none");
  window.addEventListener("click", (e) => { if (e.target === modal) modal.style.display = "none"; });

  if (window.db) loadAllCaches(window.db).catch(err => console.error("Cache initialization failed:", err));
});

// -------------------- Main Clearance Loader --------------------
window.openViewClearanceCard = async function(studentID, db, schoolId = studentID) {
  const modal = document.getElementById("clearanceModal");
  modal.style.display = "block";

  const containerEl = document.getElementById("officeSectionsGrid");
  const statusEl = document.getElementById("status");
  const container = document.querySelector(".clearance-container");

  containerEl.innerHTML = "";
  statusEl.textContent = "Loading...";
  document.getElementById("studentId").textContent = studentID;
  document.getElementById("studentName").textContent = "Loading...";
  document.getElementById("semesterText").textContent = "";

  try {
    await loadAllCaches(db);

    const [semesterSnap, studentDoc, designeesSnap] = await Promise.all([
      db.collection(COLLECTIONS.semester).where("currentSemester", "==", true).limit(1).get(),
      db.collection(COLLECTIONS.students).doc(studentID).get(),
      db.collection(COLLECTIONS.designees).get()
    ]);

    let currentSemesterId = null;
    let currentSemesterName = "Unknown Semester";

    if (!semesterSnap.empty) {
      const semesterDoc = semesterSnap.docs[0];
      currentSemesterId = semesterDoc.id;
      currentSemesterName = semesterDoc.data().semester || "Unknown Semester";
    }

    if (!studentDoc.exists) throw new Error("Student not found");

    const student = studentDoc.data();
    document.getElementById("studentName").textContent =
      [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ");
    document.getElementById("semesterText").textContent = currentSemesterName;

    const designeeIds = designeesSnap.docs.map(doc => doc.id);

    const officeStatusPromises = designeeIds.map(async (designeeId) => {
      const semDocRef = db.collection("Validation").doc(designeeId).collection(schoolId).doc(currentSemesterId);
      const semDoc = await semDocRef.get();
      if (!semDoc.exists) return null;

      const reqs = semDoc.data().requirements || [];
      const allCleared = reqs.length > 0 && reqs.every(r => r.status === true); // ✅ Updated logic

      const { officeName, imageId } = resolveOfficeNameWithImageCached(designeeId);
      return { officeName, imageId, cleared: allCleared, reqs };
    });

    const results = await Promise.all(officeStatusPromises);
    const officeStatusList = results.filter(r => r !== null);

    if (officeStatusList.length === 0) {
      containerEl.innerHTML = `<div class="section-item">
        <label class="section-header">No Offices Found</label>
        <p>No validation data available for this student.</p>
      </div>`;
      statusEl.innerHTML = `<span style="color:red">Pending</span>`;
      container.style.border = "5px solid red";
      return;
    }

    let overallCleared = true;

    for (const office of officeStatusList) {
      if (!office.cleared) overallCleared = false;

      const sectionGroupDiv = document.createElement("div");
      sectionGroupDiv.classList.add("section-group");

      const headerLabel = document.createElement("label");
      headerLabel.classList.add("section-header");
      headerLabel.textContent = office.officeName;
      sectionGroupDiv.appendChild(headerLabel);

      const approvalDiv = document.createElement("div");
      approvalDiv.classList.add("section-item");

      if (office.cleared) {
        const clearedReq = office.reqs.find(r => r.status === true) || {};
        const checkedBy = clearedReq.checkedBy || "No Requirements for this Office";
        const formattedTime = formatTimestampTo12Hr(clearedReq.checkedAt);

        approvalDiv.innerHTML = `
          <img src="../../logo/${office.imageId || "default"}.png" 
               alt="Approved Icon" 
               style="width:70px; height:70px;" 
               onerror="this.onerror=null;this.src='../../Tatak.png';" /><br />
          <label><i>Cleared</i></label><br />
          <small>Approved by: ${checkedBy}</small><br />
          <small>${formattedTime}</small>
          <hr />
        `;
      } else {
        approvalDiv.innerHTML = `<label><i>Pending</i><hr /></label>`;
      }

      sectionGroupDiv.appendChild(approvalDiv);
      containerEl.appendChild(sectionGroupDiv);
    }

    statusEl.innerHTML = overallCleared
      ? `<span style="color:green">All Offices Cleared</span>`
      : `<span style="color:red">Pending</span>`;
    container.style.border = overallCleared ? "5px solid #a6d96a" : "5px solid red";

  } catch (err) {
    console.error("Error loading clearance:", err);
    containerEl.innerHTML = "<p>Failed to load clearance. Student is not yet registered</p>";
    statusEl.innerHTML = `<span style="color:red">Pending</span>`;
    container.style.border = "5px solid red";
  }
};
