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

// Normalize strings for comparison
function normalizeString(str) {
  return String(str || "").trim().toLowerCase();
}

// Resolve designee/office name and image
async function resolveOfficeNameWithImage(db, designeeId) {
  try {
    let officeName = null;
    let imageId = "default";

    if (/^\d+$/.test(designeeId)) {
      // Single number → fetch OfficeDocs
      const officeDoc = await db.collection(COLLECTIONS.office).doc(designeeId).get();
      if (officeDoc.exists) officeName = officeDoc.data().office || officeDoc.data().name;

      // Special rule: 7 uses "001" as ImageID
      imageId = designeeId === "7" ? "001" : designeeId;
    } else if (/^\d+-\d+$/.test(designeeId)) {
      const [firstNum, secondNum] = designeeId.split("-").map(Number);

      if ([2, 3, 5, 6, 9, 10, 12].includes(firstNum)) {
        // Starts with 2,3,5,6,9,10,12 → Office only
        const officeDoc = await db.collection(COLLECTIONS.office).doc(String(firstNum)).get();
        officeName = officeDoc.exists ? officeDoc.data().office || officeDoc.data().name : designeeId;
      } else if ([4, 7, 11].includes(firstNum)) {
        // Starts with 4,7,11 → Office + Department
        const officeDoc = await db.collection(COLLECTIONS.office).doc(String(firstNum)).get();
        const deptDoc = await db.collection(COLLECTIONS.department).doc(String(secondNum)).get();
        const officeNamePart = officeDoc.exists ? officeDoc.data().office || officeDoc.data().name : null;
        const deptNamePart = deptDoc.exists ? deptDoc.data().code : null; // use "code" field
        officeName = deptNamePart && officeNamePart ? `${officeNamePart} - ${deptNamePart}` : deptNamePart || officeNamePart;
      } else if ([1, 8, 13, 14, 15, 16].includes(firstNum)) {
        // Starts with 1,8,13,14,15,16 → Clubs → fallback Lab
        let clubDoc = await db.collection(COLLECTIONS.clubs).doc(String(secondNum)).get();
        if (clubDoc.exists) {
          officeName = clubDoc.data().code || clubDoc.data().name; // use "code"
        } else {
          const labDoc = await db.collection(COLLECTIONS.lab).doc(String(secondNum)).get();
          officeName = labDoc.exists ? labDoc.data().lab || labDoc.data().name : designeeId;
        }
      } else {
        // fallback
        officeName = designeeId;
      }

      // Concatenate numbers for imageId, except if firstNum is 7
      imageId = firstNum === 7 ? "001" : `${firstNum}${secondNum}`;
    } else {
      // fallback if not a number or number-number format
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
    // ================= Fetch current semester =================
    let currentSemesterId = null;
    let currentSemesterName = "Unknown Semester";

    const semesterSnap = await db.collection(COLLECTIONS.semester)
      .where("currentSemester", "==", true)
      .limit(1)
      .get();

    if (!semesterSnap.empty) {
      const semesterDoc = semesterSnap.docs[0];
      currentSemesterId = semesterDoc.id;
      currentSemesterName = semesterDoc.data().semester || "Unknown Semester";
    }

    // ================= Fetch student =================
    const studentDoc = await db.collection(COLLECTIONS.students).doc(studentID).get();
    if (!studentDoc.exists) throw new Error("Student not found");

    const student = studentDoc.data();
    document.getElementById("studentName").textContent =
      [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ");
    document.getElementById("semesterText").textContent = currentSemesterName;

    // ================= Fetch all designees =================
    const designeesSnap = await db.collection(COLLECTIONS.designees).get();
    const designeeIds = designeesSnap.docs.map(doc => doc.id);

    const officeStatusList = [];

    // ================= Gather office validation status =================
    for (const designeeId of designeeIds) {
      const semDocRef = db
        .collection("Validation")
        .doc(designeeId)
        .collection(schoolId) // student ID
        .doc(currentSemesterId);

      const semDoc = await semDocRef.get();
      if (!semDoc.exists) continue;

      const reqs = semDoc.data().requirements || [];
      const allCleared = reqs.every(r => r.status === true); // all requirements cleared by this office

      const { officeName, imageId } = await resolveOfficeNameWithImage(db, designeeId);
      officeStatusList.push({ officeName, imageId, cleared: allCleared });
    }

    if (officeStatusList.length === 0) {
      containerEl.innerHTML = `<div class="section-item">
        <label class="section-header">No Offices Found</label>
        <p>No validation data available for this student.</p>
      </div>`;
      statusEl.innerHTML = `<span style="color:red">Pending</span>`;
      container.style.border = "5px solid red";
      return;
    }

    // ================= Render offices =================
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

      approvalDiv.innerHTML = office.cleared
        ? `<img src="../../logo/${office.imageId || "default"}.png" 
                 alt="Approved Icon" 
                 style="width:50px; height:50px;" 
                 onerror="this.onerror=null;this.src='../../Tatak.png';" /><br />
           <label><i>Cleared</i><hr /></label>`
        : `<label><i>Pending</i><hr /></label>`;

      sectionGroupDiv.appendChild(approvalDiv);
      containerEl.appendChild(sectionGroupDiv);
    }

    // ================= Overall Clearance Status =================
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


