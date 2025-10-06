// ========================== requirement_approval_logs.js ==========================

// ✅ On page load
document.addEventListener("DOMContentLoaded", async () => {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const storedAdminID = localStorage.getItem("adminID");

  usernameDisplay.textContent = storedAdminID || "Unknown";

  await loadRequirementApprovalLogs();
  setupExportButton();
});

// ========================== Load Requirement Approval Logs ==========================
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
    // 🔹 Get current semester document
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

    const allLogs = [];

    // 🔹 Loop through all Designees
    const designeeSnap = await db.collection("/User/Designees/DesigneesDocs").get();
    for (const designeeDoc of designeeSnap.docs) {
      const designeeID = designeeDoc.id;

      // 🔹 Loop through all students
      const studentSnap = await db.collection("/User/Students/StudentsDocs").get();
      for (const studentDoc of studentSnap.docs) {
        const studentID = studentDoc.id;

        // 🔹 Check if this student has validation data under this designee
        const semesterDocRef = await db
          .collection(`/Validation/${designeeID}/${studentID}`)
          .doc(currentSemesterID)
          .get();

        if (!semesterDocRef.exists) continue;

        const semData = semesterDocRef.data();
        const requirements = semData.requirements || [];

        // 🔹 Student name
        let studentName = `${studentDoc.data().firstName || ""} ${studentDoc.data().lastName || ""}`.trim();

        for (const req of requirements) {
          if (!req.status || !req.checkedBy) continue;

          // 🔹 Resolve office/department/club from designee
          const officeName = await resolveOfficeName(db, designeeID);

          allLogs.push({
            office: officeName,
            personnel: req.checkedBy,
            action: req.status === true ? "Approved" : "Pending",
            student: studentName,
            requirement: req.requirement || "—",
            timestamp: req.checkedAt ? new Date(req.checkedAt) : null,
          });
        }
      }
    }

    // Sort by timestamp (latest first)
    allLogs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // ========================== Dashboard Preview ==========================
    if (dashboardList) {
      dashboardList.innerHTML = "";
      const previewLogs = allLogs.slice(0, 5); // latest 5
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
      if (allLogs.length === 0) {
        fullTable.innerHTML = `<tr><td colspan="6">No approvals yet for ${currentSemesterName}.</td></tr>`;
      } else {
        allLogs.forEach(log => {
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
          fullTable.appendChild(row);
        });
      }
    }
  } catch (err) {
    console.error("Error loading requirement logs:", err);
    if (dashboardList) dashboardList.innerHTML = `<li>Error loading requirement logs.</li>`;
    if (fullTable) fullTable.innerHTML = `<tr><td colspan="6">Error loading requirement logs.</td></tr>`;
  }
}

// ========================== Resolve Office Name ==========================
async function resolveOfficeName(db, designeeID) {
  try {
    const designeeDoc = await db.collection("/User/Designees/DesigneesDocs").doc(designeeID).get();
    if (!designeeDoc.exists) return designeeID;

    const { office, department, category } = designeeDoc.data();

    // Office only
    if (!category && !department) {
      const officeDoc = await db.collection("/DataTable/Office/OfficeDocs").doc(office).get();
      return officeDoc.exists ? officeDoc.data().office : office;
    }

    // Office + Department
    if (!category && department) {
      const officeDoc = await db.collection("/DataTable/Office/OfficeDocs").doc(office).get();
      const deptDoc = await db.collection("/DataTable/Department/DepartmentDocs").doc(department).get();
      const officeName = officeDoc.exists ? officeDoc.data().office : office;
      const deptName = deptDoc.exists ? deptDoc.data().department : department;
      return `${officeName} - ${deptName}`;
    }

    // Academic Club / Group / Lab
    if (category) {
      const labDoc = await db.collection("/DataTable/Lab/LabDocs").doc(category).get();
      if (labDoc.exists) return labDoc.data().lab;

      const clubDoc = await db.collection("/DataTable/Clubs/ClubsDocs").doc(category).get();
      if (clubDoc.exists) return clubDoc.data().codeName || clubDoc.data().club;

      return category;
    }

    return designeeID;
  } catch (err) {
    console.error("Error resolving office name:", err);
    return designeeID;
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
