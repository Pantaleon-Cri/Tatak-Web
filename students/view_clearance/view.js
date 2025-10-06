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
  const studentId = localStorage.getItem("schoolID");
  if (!studentId) {
    alert("Session expired. Please log in again.");
    window.location.href = "../../login/student_login.html";
    return;
  }

  const container = document.getElementById("officeSectionsGrid");
  const statusElement = document.getElementById("status");
  if (!container) {
    console.error("Container for office sections grid not found!");
    return;
  }

  container.innerHTML = "";
  statusElement.textContent = "Loading...";

  try {
    // ================= Fetch current semester =================
    let currentSemesterId = null;
    let currentSemesterName = "Unknown Semester";

    try {
      const semesterSnap = await db.collection(COLLECTIONS.semester)
        .where("currentSemester", "==", true)
        .limit(1)
        .get();

      if (!semesterSnap.empty) {
        const semesterDoc = semesterSnap.docs[0];
        currentSemesterId = semesterDoc.id;
        currentSemesterName = semesterDoc.data().semester || "Unknown Semester";

        const semesterDisplay = document.querySelector("p.sem");
        if (semesterDisplay) semesterDisplay.textContent = currentSemesterName;
      } else {
        console.warn("No current semester found in database.");
      }
    } catch (err) {
      console.error("Error fetching current semester:", err);
    }

    // ================= Fetch all designees =================
    const designeeSnap = await db.collection(COLLECTIONS.designees).get();
    const designeeIds = designeeSnap.docs.map(doc => doc.id);

    let overallCleared = true;
    const officeDataArray = []; // <-- store office info for this semester

    // ================= Process each designee/office =================
    for (const designeeId of designeeIds) {
      const semDocRef = db
        .collection("Validation")
        .doc(designeeId)
        .collection(studentId)
        .doc(currentSemesterId);

      const semDoc = await semDocRef.get();
      if (!semDoc.exists) continue;

      const reqs = semDoc.data().requirements || [];
      const allCleared = reqs.length > 0 && reqs.every(r => r.status === true);
      if (!allCleared) overallCleared = false;

      const lastValidation = reqs
        .filter(r => r.status === true && r.checkedBy)
        .sort((a, b) => b.checkedAt - a.checkedAt)[0] || null;

      const lastCheckedBy = lastValidation?.checkedBy || "Unknown";
      const checkedAt = lastValidation?.checkedAt
        ? new Date(lastValidation.checkedAt).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
          })
        : "Unknown";

      const { officeName, imageId } = await resolveOfficeNameWithImage(designeeId);

      // ---------------- Build UI ----------------
      const sectionGroupDiv = document.createElement("div");
      sectionGroupDiv.classList.add("section-group");

      const headerLabel = document.createElement("label");
      headerLabel.classList.add("section-header");
      headerLabel.textContent = officeName || designeeId;
      sectionGroupDiv.appendChild(headerLabel);

      const approvalDiv = document.createElement("div");
      approvalDiv.classList.add("section-item");

      approvalDiv.innerHTML = allCleared
        ? `<img src="../../logo/${imageId || "default"}.png" 
                alt="Approved Icon" 
                style="width:50px; height:50px;" 
                onerror="this.onerror=null;this.src='../../Tatak.png';" /><br />
           <label>
             <i>Approved by: ${lastCheckedBy}</i><br />
             <i>${checkedAt}</i>
             <hr />
           </label>`
        : `<label><i>Pending</i><hr /></label>`;

      sectionGroupDiv.appendChild(approvalDiv);
      container.appendChild(sectionGroupDiv);

      // ---------------- Store info for History ----------------
      officeDataArray.push({
        designeeId,
        officeName,
        imageId,
        allCleared,
        lastCheckedBy,
        checkedAt,
        requirements: reqs
      });
    }

    // ================= Status Display =================
    statusElement.innerHTML = overallCleared
      ? `<span style="color:green">All Offices Cleared</span>`
      : `<span style="color:red">Pending</span>`;

    if (designeeIds.length === 0) {
      container.innerHTML = `<div class="section-item"><label class="section-header">No Offices Found</label><p>No offices found for this student.</p></div>`;
      statusElement.innerHTML = `<span style="color:red">Pending</span>`;
    }

    // ================= Save to History =================
    if (currentSemesterId && studentId && officeDataArray.length > 0) {
      const historyRef = db.collection("History").doc(studentId);

      // Use Firestore's arrayUnion to append new semester info
      await historyRef.set({
        [currentSemesterId]: [
          {
            offices: officeDataArray,
            timestamp: Date.now()
          }
        ]
      }, { merge: true });

      console.log("History updated successfully for student:", studentId);
    }

  } catch (err) {
    console.error("Error loading offices:", err);
    container.innerHTML = `<div class="section-item"><label class="section-header">Error</label><p>Unable to load offices. Please try again later.</p></div>`;
    statusElement.innerHTML = `<span style="color:red">Pending</span>`;
  }
});

// ================= Utility Function =================
async function resolveOfficeNameWithImage(designeeId) {
  try {
    const snap = await db.collection(COLLECTIONS.designees).doc(designeeId).get();
    if (!snap.exists) return { officeName: designeeId, imageId: "default" };
    const designee = snap.data();

    let officeName = null;
    let imageId = designee.category || "default";

    if (imageId) {
      const clubDoc = await db.collection(COLLECTIONS.clubs).doc(imageId).get();
      if (clubDoc.exists && clubDoc.data().code) officeName = clubDoc.data().code;

      const labDoc = await db.collection(COLLECTIONS.lab).doc(imageId).get();
      if (labDoc.exists && labDoc.data().lab) officeName = labDoc.data().lab;
    }

    if (!officeName && designee.office) {
      const officeDoc = await db.collection(COLLECTIONS.office).doc(designee.office).get();
      if (officeDoc.exists) officeName = officeDoc.data().office;
    }

    if (!officeName && designee.department) {
      const depDoc = await db.collection(COLLECTIONS.department).doc(designee.department).get();
      const depName = depDoc.exists ? depDoc.data().code || depDoc.data().department : "";

      if (designee.office) {
        const officeDoc = await db.collection(COLLECTIONS.office).doc(designee.office).get();
        const offName = officeDoc.exists ? officeDoc.data().office : "";
        officeName = depName && offName ? `${depName} - ${offName}` : depName || offName;
      } else {
        officeName = depName;
      }
    }

    if (!officeName && (designee.firstName || designee.lastName)) {
      officeName = `${designee.firstName || ""} ${designee.lastName || ""}`.trim();
    }

    if (/^\d+$/.test(designeeId)) {
      imageId = designeeId === "7" ? "001" : designeeId;
    } else if (/^\d+-\d+$/.test(designeeId)) {
      const [firstNum, secondNum] = designeeId.split("-").map(Number);
      imageId = firstNum === 7 ? "001" : `${firstNum}${secondNum}`;
    }

    return { officeName: officeName || designeeId, imageId: imageId || "default" };

  } catch (err) {
    console.error("Error resolving office name:", err);
    return { officeName: designeeId, imageId: "default" };
  }
}
