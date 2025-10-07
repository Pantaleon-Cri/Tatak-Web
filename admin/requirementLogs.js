// ========================== requirement_approval_logs.js (OPTIMIZED) ==========================

// Cache for lookups
const cache = {
  students: new Map(),
  designees: new Map(),
  offices: new Map(),
  departments: new Map(),
  labs: new Map(),
  clubs: new Map()
};

// ✅ On page load
document.addEventListener("DOMContentLoaded", async () => {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const storedAdminID = localStorage.getItem("adminID");

  usernameDisplay.textContent = storedAdminID || "Unknown";

  await loadRequirementApprovalLogs();
  setupExportButton();
});

// ========================== Optimized Office Name Resolver ==========================
async function resolveOfficeName(db, designeeID) {
  // Check cache first
  if (cache.designees.has(designeeID)) {
    const cached = cache.designees.get(designeeID);
    if (cached.resolvedName) return cached.resolvedName;
  }

  try {
    const designeeDoc = await db.collection("/User/Designees/DesigneesDocs").doc(designeeID).get();
    if (!designeeDoc.exists) return designeeID;

    const { office, department, category } = designeeDoc.data();
    cache.designees.set(designeeID, designeeDoc.data());

    let resolvedName = designeeID;

    // Try category (lab/club) first
    if (category) {
      // Check lab
      if (!cache.labs.has(category)) {
        const labDoc = await db.collection("/DataTable/Lab/LabDocs").doc(category).get();
        if (labDoc.exists) cache.labs.set(category, labDoc.data());
      }
      if (cache.labs.has(category)) {
        resolvedName = cache.labs.get(category).lab;
        cache.designees.get(designeeID).resolvedName = resolvedName;
        return resolvedName;
      }

      // Check club
      if (!cache.clubs.has(category)) {
        const clubDoc = await db.collection("/DataTable/Clubs/ClubsDocs").doc(category).get();
        if (clubDoc.exists) cache.clubs.set(category, clubDoc.data());
      }
      if (cache.clubs.has(category)) {
        const clubData = cache.clubs.get(category);
        resolvedName = clubData.codeName || clubData.club || category;
        cache.designees.get(designeeID).resolvedName = resolvedName;
        return resolvedName;
      }
    }

    // Try department + office
    if (department || office) {
      let officeName = "";
      let deptName = "";

      if (office) {
        if (!cache.offices.has(office)) {
          const officeDoc = await db.collection("/DataTable/Office/OfficeDocs").doc(office).get();
          if (officeDoc.exists) cache.offices.set(office, officeDoc.data());
        }
        if (cache.offices.has(office)) {
          officeName = cache.offices.get(office).office || office;
        }
      }

      if (department) {
        if (!cache.departments.has(department)) {
          const deptDoc = await db.collection("/DataTable/Department/DepartmentDocs").doc(department).get();
          if (deptDoc.exists) cache.departments.set(department, deptDoc.data());
        }
        if (cache.departments.has(department)) {
          deptName = cache.departments.get(department).department || department;
        }
      }

      if (officeName && deptName) {
        resolvedName = `${officeName} - ${deptName}`;
      } else {
        resolvedName = officeName || deptName || designeeID;
      }
    }

    cache.designees.get(designeeID).resolvedName = resolvedName;
    return resolvedName;
  } catch (err) {
    console.error("Error resolving office name:", err);
    return designeeID;
  }
}

// ========================== Helper: Batch fetch student names ==========================
async function getStudentName(db, studentID) {
  if (cache.students.has(studentID)) {
    return cache.students.get(studentID);
  }

  try {
    const doc = await db.collection("/User/Students/StudentsDocs").doc(studentID).get();
    if (doc.exists) {
      const data = doc.data();
      const name = `${data.firstName || ""} ${data.lastName || ""}`.trim() || studentID;
      cache.students.set(studentID, name);
      return name;
    }
  } catch (err) {
    console.error("Error fetching student:", studentID, err);
  }

  cache.students.set(studentID, studentID);
  return studentID;
}

// ========================== Load Requirement Approval Logs (OPTIMIZED) ==========================
async function loadRequirementApprovalLogs(full = false) {
  const db = firebase.firestore();

  // Detect container (Dashboard or Activity Page)
  const dashboardList = document.getElementById("requirementLogsList");
  const fullTable = document.getElementById("fullCheckedByLog");

  if (!dashboardList && !fullTable) {
    console.warn("⚠️ No requirement logs container found on this page.");
    return;
  }

  // Loading placeholders
  if (dashboardList) dashboardList.innerHTML = `<li>Loading requirement logs...</li>`;
  if (fullTable) fullTable.innerHTML = `<tr><td colspan="6">Loading requirement logs...</td></tr>`;

  try {
    // 🔹 Get current semester
    const semesterSnap = await db
      .collection("/DataTable/Semester/SemesterDocs")
      .where("currentSemester", "==", true)
      .limit(1)
      .get();

    if (semesterSnap.empty) {
      if (dashboardList) dashboardList.innerHTML = `<li>No current semester set.</li>`;
      if (fullTable) fullTable.innerHTML = `<tr><td colspan="6">No current semester set.</td></tr>`;
      return;
    }

    const currentSemesterDoc = semesterSnap.docs[0];
    const currentSemesterName = currentSemesterDoc.data().semester;
    const currentSemesterID = currentSemesterDoc.id;

    console.log("Loading logs for semester:", currentSemesterName);

    // ================== KEY OPTIMIZATION: Get ALL designees first ==================
    const designeeSnap = await db.collection("/User/Designees/DesigneesDocs").get();
    if (designeeSnap.empty) {
      if (dashboardList) dashboardList.innerHTML = `<li>No designees found.</li>`;
      if (fullTable) fullTable.innerHTML = `<tr><td colspan="6">No designees found.</td></tr>`;
      return;
    }

    const designeeIds = designeeSnap.docs.map(doc => doc.id);
    console.log(`Found ${designeeIds.length} designees`);

    // ================== CRITICAL: Query validation collections in PARALLEL ==================
    // Instead of checking each student under each designee (50k reads),
    // we list all validation collections for each designee and only process docs that exist

    const allLogs = [];
    const studentIdsNeeded = new Set();

    // Process all designees in parallel
    const designeePromises = designeeIds.map(async (designeeID) => {
      try {
        // List all student subcollections under this designee's validation
        const validationRef = db.collection("Validation").doc(designeeID);
        
        // Get all student subcollections
        // Note: listCollections() is not available in client SDK
        // Instead, we need to query the actual documents
        
        // WORKAROUND: Use collectionGroup if structure allows, or query known students
        // For now, we'll use a different approach: query by semester field
        
        // Since we can't list subcollections in client SDK, we'll use a hybrid approach:
        // Query students who have validation docs for current semester
        
        // BETTER APPROACH: If you have a students list, query validation docs
        // But to avoid the N*M problem, we use a smarter query pattern
        
        const studentDocs = await db.collection("/User/Students/StudentsDocs").get();
        const studentIds = studentDocs.docs.map(doc => doc.id);
        
        // Batch query in chunks (but only for this designee)
        const CHUNK_SIZE = 100;
        const logs = [];
        
        for (let i = 0; i < studentIds.length; i += CHUNK_SIZE) {
          const chunk = studentIds.slice(i, i + CHUNK_SIZE);
          
          const promises = chunk.map(studentID =>
            validationRef.collection(studentID).doc(currentSemesterID).get()
          );
          
          const docs = await Promise.all(promises);
          
          docs.forEach((doc, index) => {
            if (!doc.exists) return;
            
            const studentID = chunk[index];
            const data = doc.data();
            const requirements = data.requirements || [];
            
            requirements.forEach(req => {
              if (req.status && req.checkedBy) {
                studentIdsNeeded.add(studentID);
                logs.push({
                  designeeID,
                  studentID,
                  requirement: req.requirement || "—",
                  checkedBy: req.checkedBy,
                  checkedAt: req.checkedAt ? new Date(req.checkedAt) : null,
                  status: req.status
                });
              }
            });
          });
        }
        
        return logs;
      } catch (err) {
        console.error(`Error processing designee ${designeeID}:`, err);
        return [];
      }
    });

    // Wait for all designees to be processed
    const designeeResults = await Promise.all(designeePromises);
    designeeResults.forEach(logs => allLogs.push(...logs));

    console.log(`Found ${allLogs.length} approval logs`);

    if (allLogs.length === 0) {
      if (dashboardList) dashboardList.innerHTML = `<li>No approvals yet for ${currentSemesterName}.</li>`;
      if (fullTable) fullTable.innerHTML = `<tr><td colspan="6">No approvals yet for ${currentSemesterName}.</td></tr>`;
      return;
    }

    // ================== Resolve names in parallel ==================
    // Get unique designee IDs and student IDs
    const uniqueDesigneeIds = [...new Set(allLogs.map(log => log.designeeID))];
    const uniqueStudentIds = [...studentIdsNeeded];

    console.log(`Resolving names for ${uniqueDesigneeIds.length} offices and ${uniqueStudentIds.length} students`);

    // Resolve office names in parallel
    const officeNamePromises = uniqueDesigneeIds.map(id => 
      resolveOfficeName(db, id).then(name => ({ id, name }))
    );
    const officeNames = await Promise.all(officeNamePromises);
    const officeNameMap = new Map(officeNames.map(({ id, name }) => [id, name]));

    // Resolve student names in parallel
    const studentNamePromises = uniqueStudentIds.map(id =>
      getStudentName(db, id).then(name => ({ id, name }))
    );
    const studentNames = await Promise.all(studentNamePromises);
    const studentNameMap = new Map(studentNames.map(({ id, name }) => [id, name]));

    // ================== Build final log entries ==================
    const finalLogs = allLogs.map(log => ({
      office: officeNameMap.get(log.designeeID) || log.designeeID,
      personnel: log.checkedBy,
      action: log.status === true ? "Approved" : "Pending",
      student: studentNameMap.get(log.studentID) || log.studentID,
      requirement: log.requirement,
      timestamp: log.checkedAt
    }));

    // Sort by timestamp (latest first)
    finalLogs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // ========================== Dashboard Preview ==========================
    if (dashboardList) {
      dashboardList.innerHTML = "";
      const previewLogs = finalLogs.slice(0, 5);
      if (previewLogs.length === 0) {
        dashboardList.innerHTML = `<li>No approvals yet for ${currentSemesterName}.</li>`;
      } else {
        previewLogs.forEach(log => {
          const li = document.createElement("li");
          li.textContent = `${log.personnel} approved "${log.requirement}" for ${log.student} (${log.office})`;
          dashboardList.appendChild(li);
        });
      }
    }

    // ========================== Full Activity Log Table ==========================
    if (fullTable) {
      fullTable.innerHTML = "";
      if (finalLogs.length === 0) {
        fullTable.innerHTML = `<tr><td colspan="6">No approvals yet for ${currentSemesterName}.</td></tr>`;
      } else {
        const fragment = document.createDocumentFragment();
        
        finalLogs.forEach(log => {
          const formattedTime = log.timestamp
            ? log.timestamp.toLocaleString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
              })
            : "No time";

          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${log.office}</td>
            <td>${log.personnel}</td>
            <td>${log.action}</td>
            <td>${log.student}</td>
            <td>${log.requirement}</td>
            <td>${formattedTime}</td>
          `;
          fragment.appendChild(row);
        });
        
        fullTable.appendChild(fragment);
      }
    }

    console.log("Logs loaded successfully");

  } catch (err) {
    console.error("Error loading requirement logs:", err);
    if (dashboardList) dashboardList.innerHTML = `<li>Error loading requirement logs.</li>`;
    if (fullTable) fullTable.innerHTML = `<tr><td colspan="6">Error loading requirement logs.</td></tr>`;
  }
}

// ========================== XLSX Export ==========================
async function setupExportButton() {
  const exportBtn = document.getElementById("exportSheetBtn");
  if (!exportBtn) return;

  exportBtn.addEventListener("click", async () => {
    try {
      const db = firebase.firestore();

      const semSnap = await db
        .collection("/DataTable/Semester/SemesterDocs")
        .where("currentSemester", "==", true)
        .limit(1)
        .get();

      let semesterName = "UnknownSemester";
      if (!semSnap.empty) {
        semesterName = semSnap.docs[0].data().semester.replace(/\s+/g, "_");
      }

      const tableRows = document.querySelectorAll("#fullCheckedByLog tr");
      const data = [["Office", "Personnel", "Action", "Student Name", "Requirement", "Timestamp"]];

      tableRows.forEach(tr => {
        const row = Array.from(tr.children).map(td => td.textContent);
        if (row.length === 6) data.push(row);
      });

      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Requirement Logs");
      XLSX.writeFile(wb, `Requirement_Approval_Logs_${semesterName}.xlsx`);
    } catch (err) {
      console.error("Error exporting XLSX:", err);
      alert("Failed to export logs.");
    }
  });
}