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
    // 🟦 Special rule: If starts with 11 and second part is 21–28 → use OfficeDocs/11
    if (designeeId.startsWith("11-")) {
      const parts = designeeId.split("-");
      const secondNum = parseInt(parts[1], 10);
      if (secondNum >= 21 && secondNum <= 28) {
        if (!cache.offices["11"]) {
          const officeDoc = await db.collection(COLLECTIONS.office).doc("11").get();
          if (officeDoc.exists) cache.offices["11"] = officeDoc.data();
        }
        const officeName = cache.offices["11"]?.office || "Office 11";
        return { officeName, imageId: designeeId };
      }
    }

    // Use cached or provided designee data
    let designee = designeeData || cache.designees[designeeId];
    
    if (!designee) {
      const snap = await db.collection(COLLECTIONS.designees).doc(designeeId).get();
      if (!snap.exists) return { officeName: designeeId, imageId: designeeId };
      designee = snap.data();
      cache.designees[designeeId] = designee;
    }

    let officeName = null;
    let imageId = designeeId; // ✅ Always same as designeeId

    // -------------------- Category: Club / Lab --------------------
    if (designee.category) {
      const categoryId = designee.category;

      // Check club
      if (!cache.clubs[categoryId]) {
        const clubDoc = await db.collection(COLLECTIONS.clubs).doc(categoryId).get();
        if (clubDoc.exists) cache.clubs[categoryId] = clubDoc.data();
      }
      if (cache.clubs[categoryId]?.code) {
        officeName = cache.clubs[categoryId].code;
      }

      // Only check lab if club didn't match or designeeId starts with 8
      if (!officeName || designeeId.startsWith("8")) {
        if (!cache.labs[categoryId]) {
          const labDoc = await db.collection(COLLECTIONS.lab).doc(categoryId).get();
          if (labDoc.exists) cache.labs[categoryId] = labDoc.data();
        }
        if (cache.labs[categoryId]?.lab) {
          officeName = cache.labs[categoryId].lab;
        }
      }
    }

    // -------------------- Office --------------------
    if (!officeName && designee.office) {
      if (!cache.offices[designee.office]) {
        const officeDoc = await db.collection(COLLECTIONS.office).doc(designee.office).get();
        if (officeDoc.exists) cache.offices[designee.office] = officeDoc.data();
      }
      if (cache.offices[designee.office]) {
        officeName = cache.offices[designee.office].office;
      }
    }

    // -------------------- Department + Office --------------------
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

    // -------------------- Fallback to Designee Name --------------------
    if (!officeName && (designee.firstName || designee.lastName)) {
      officeName = `${designee.firstName || ""} ${designee.lastName || ""}`.trim();
    }

    // ✅ Image ID rule simplified: always same as designeeId
    imageId = designeeId;

    return { officeName: officeName || designeeId, imageId };

  } catch (err) {
    console.error("Error resolving office name:", err);
    return { officeName: designeeId, imageId: designeeId };
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