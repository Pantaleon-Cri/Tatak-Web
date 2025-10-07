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

// ================= Cache =================
const cache = {
  designees: {},
  clubs: {},
  labs: {},
  offices: {},
  departments: {}
};

// ================= Optimized Office Name Resolver =================
async function resolveOfficeNameWithImage(designeeId, designeeData = null) {
  try {
    // Use cached or provided designee data
    let designee = designeeData || cache.designees[designeeId];
    
    if (!designee) {
      const snap = await db.collection(COLLECTIONS.designees).doc(designeeId).get();
      if (!snap.exists) return { officeName: designeeId, imageId: "default" };
      designee = snap.data();
      cache.designees[designeeId] = designee;
    }

    let officeName = null;
    let imageId = designee.category || "default";

    // Try category (club/lab) - with early return
    if (imageId) {
      // Check club
      if (!cache.clubs[imageId]) {
        const clubDoc = await db.collection(COLLECTIONS.clubs).doc(imageId).get();
        if (clubDoc.exists) cache.clubs[imageId] = clubDoc.data();
      }
      if (cache.clubs[imageId]?.code) {
        officeName = cache.clubs[imageId].code;
      }

      // Only check lab if club didn't match
      if (!officeName) {
        if (!cache.labs[imageId]) {
          const labDoc = await db.collection(COLLECTIONS.lab).doc(imageId).get();
          if (labDoc.exists) cache.labs[imageId] = labDoc.data();
        }
        if (cache.labs[imageId]?.lab) {
          officeName = cache.labs[imageId].lab;
        }
      }
    }

    // Try office
    if (!officeName && designee.office) {
      if (!cache.offices[designee.office]) {
        const officeDoc = await db.collection(COLLECTIONS.office).doc(designee.office).get();
        if (officeDoc.exists) cache.offices[designee.office] = officeDoc.data();
      }
      if (cache.offices[designee.office]) {
        officeName = cache.offices[designee.office].office;
      }
    }

    // Try department + office
    if (!officeName && designee.department) {
      if (!cache.departments[designee.department]) {
        const depDoc = await db.collection(COLLECTIONS.department).doc(designee.department).get();
        if (depDoc.exists) cache.departments[designee.department] = depDoc.data();
      }
      
      const depName = cache.departments[designee.department]?.code || 
                      cache.departments[designee.department]?.department || "";

      if (designee.office && cache.offices[designee.office]) {
        const offName = cache.offices[designee.office].office || "";
        officeName = depName && offName ? `${depName} - ${offName}` : depName || offName;
      } else {
        officeName = depName;
      }
    }

    // Fallback to name
    if (!officeName && (designee.firstName || designee.lastName)) {
      officeName = `${designee.firstName || ""} ${designee.lastName || ""}`.trim();
    }

    // Resolve imageId
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

    // ================= Fetch all designees and cache them =================
    const designeeSnap = await db.collection(COLLECTIONS.designees).get();
    designeeSnap.docs.forEach(doc => {
      cache.designees[doc.id] = doc.data();
    });
    const designeeIds = designeeSnap.docs.map(doc => doc.id);

    // ================= Fetch validation data in PARALLEL =================
    const validationPromises = designeeIds.map(async (designeeId) => {
      const semDocRef = db
        .collection("Validation")
        .doc(designeeId)
        .collection(studentId)
        .doc(currentSemesterId);

      const semDoc = await semDocRef.get();
      if (!semDoc.exists) return null;

      const reqs = semDoc.data().requirements || [];
      if (reqs.length === 0) return null;

      const allCleared = reqs.every(r => r.status === true);

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

      return {
        designeeId,
        reqs,
        allCleared,
        lastCheckedBy,
        checkedAt
      };
    });

    // Wait for all validation checks
    const validationResults = (await Promise.all(validationPromises))
      .filter(result => result !== null);

    console.log(`Found ${validationResults.length} offices with requirements`);

    if (validationResults.length === 0) {
      container.innerHTML = `<div class="section-item"><label class="section-header">No Offices Found</label><p>No offices found for this student.</p></div>`;
      statusElement.innerHTML = `<span style="color:red">Pending</span>`;
      return;
    }

    // ================= Resolve office names in PARALLEL =================
    const officeInfoPromises = validationResults.map(result => 
      resolveOfficeNameWithImage(result.designeeId, cache.designees[result.designeeId])
    );
    const officeInfos = await Promise.all(officeInfoPromises);

    // ================= Build all UI elements first, then append once =================
    let overallCleared = true;
    const officeDataArray = [];
    const fragment = document.createDocumentFragment();

    validationResults.forEach((result, index) => {
      const { officeName, imageId } = officeInfos[index];

      if (!result.allCleared) overallCleared = false;

      // Build UI
      const sectionGroupDiv = document.createElement("div");
      sectionGroupDiv.classList.add("section-group");

      const headerLabel = document.createElement("label");
      headerLabel.classList.add("section-header");
      headerLabel.textContent = officeName || result.designeeId;
      sectionGroupDiv.appendChild(headerLabel);

      const approvalDiv = document.createElement("div");
      approvalDiv.classList.add("section-item");

      approvalDiv.innerHTML = result.allCleared
        ? `<img src="../../logo/${imageId || "default"}.png" 
                alt="Approved Icon" 
                style="width:50px; height:50px;" 
                onerror="this.onerror=null;this.src='../../Tatak.png';" /><br />
           <label>
             <i>Approved by: ${result.lastCheckedBy}</i><br />
             <i>${result.checkedAt}</i>
             <hr />
           </label>`
        : `<label><i>Pending</i><hr /></label>`;

      sectionGroupDiv.appendChild(approvalDiv);
      fragment.appendChild(sectionGroupDiv);

      // Store for history
      officeDataArray.push({
        designeeId: result.designeeId,
        officeName,
        imageId,
        allCleared: result.allCleared,
        lastCheckedBy: result.lastCheckedBy,
        checkedAt: result.checkedAt,
        requirements: result.reqs
      });
    });

    // Single DOM append - much faster!
    container.appendChild(fragment);

    // ================= Status Display =================
    statusElement.innerHTML = overallCleared
      ? `<span style="color:green">All Offices Cleared</span>`
      : `<span style="color:red">Pending</span>`;

    // ================= Save to History (non-blocking) =================
    if (currentSemesterId && studentId && officeDataArray.length > 0) {
      // Don't await - let it run in background
      db.collection("History").doc(studentId).set({
        [currentSemesterId]: [
          {
            offices: officeDataArray,
            timestamp: Date.now()
          }
        ]
      }, { merge: true }).then(() => {
        console.log("History updated successfully for student:", studentId);
      }).catch(err => {
        console.error("Error updating history:", err);
      });
    }

  } catch (err) {
    console.error("Error loading offices:", err);
    container.innerHTML = `<div class="section-item"><label class="section-header">Error</label><p>Unable to load offices. Please try again later.</p></div>`;
    statusElement.innerHTML = `<span style="color:red">Pending</span>`;
  }
});