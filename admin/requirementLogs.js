document.addEventListener("DOMContentLoaded", async () => {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const storedAdminID = localStorage.getItem("adminID");

  if (storedAdminID) {
    usernameDisplay.textContent = storedAdminID; // show saved ID
  } else {
    usernameDisplay.textContent = "Unknown"; // fallback
  }

  await loadRequirementApprovalLogs();
  setupExportButton();
});

async function loadRequirementApprovalLogs(full = false) {
  const db = firebase.firestore();

  // Detect which container exists
  const dashboardList = document.getElementById("requirementLogsList");
  const fullTable = document.getElementById("fullCheckedByLog");

  if (!dashboardList && !fullTable) {
    console.warn("⚠️ No requirement logs container found on this page.");
    return;
  }

  // Loading placeholder
  if (dashboardList) {
    dashboardList.innerHTML = `<li>Loading requirement logs...</li>`;
  }
  if (fullTable) {
    fullTable.innerHTML = `<tr><td colspan="6">Loading requirement logs...</td></tr>`;
  }

  try {
    // 🔹 Get current semester
    const semesterSnap = await db.collection("semesterTable").where("currentSemester", "==", true).limit(1).get();
    if (semesterSnap.empty) {
      console.warn("⚠️ No current semester found.");
      if (dashboardList) dashboardList.innerHTML = `<li>No current semester set.</li>`;
      if (fullTable) fullTable.innerHTML = `<tr><td colspan="6">No current semester set.</td></tr>`;
      return;
    }
    const currentSemester = semesterSnap.docs[0].data().semester;

    let query = db.collection("ValidateRequirementsTable");
    if (dashboardList) {
      // If we're on Dashboard → show only latest 5
      query = query.limit(5);
    }
    const snapshot = await query.get();

    const allLogs = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!data.offices) continue;

      for (const [userID, requirementsArr] of Object.entries(data.offices)) {
        if (!Array.isArray(requirementsArr)) continue;

        const officeName = await resolveOfficeName(db, userID);

        for (const req of requirementsArr) {
          // 🔹 Only include logs for current semester
          if (!req.status || !req.checkedBy || req.semester !== currentSemester) continue;

          const studentID = data.studentID || req.studentID;
          let studentName = studentID || "Unknown Student";

          if (studentID) {
            try {
              const studentDoc = await db.collection("Students").doc(studentID).get();
              if (studentDoc.exists) {
                const sData = studentDoc.data();
                studentName = `${sData.firstName || ""} ${sData.lastName || ""}`.trim();
              }
            } catch (err) {
              console.error("Error fetching student:", err);
            }
          }

          allLogs.push({
            office: officeName,
            personnel: req.checkedBy,
            action: "Approved",
            student: studentName,
            requirement: req.requirement || "—",
            timestamp: req.checkedAt ? new Date(req.checkedAt) : null
          });
        }
      }
    }

    // Sort by latest
    allLogs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Render for Dashboard
    if (dashboardList) {
      dashboardList.innerHTML = "";
      if (allLogs.length === 0) {
        dashboardList.innerHTML = `<li>No approvals yet for ${currentSemester}.</li>`;
      } else {
        allLogs.forEach(log => {
          const li = document.createElement("li");
          li.textContent = `${log.personnel} approved "${log.requirement}" for ${log.student} (${log.office})`;
          dashboardList.appendChild(li);
        });
      }
    }

    // Render for Full Logs page
    if (fullTable) {
      fullTable.innerHTML = "";
      if (allLogs.length === 0) {
        fullTable.innerHTML = `<tr><td colspan="6">No approvals yet for ${currentSemester}.</td></tr>`;
      } else {
        allLogs.forEach(log => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${log.office}</td>
            <td>${log.personnel}</td>
            <td>${log.action}</td>
            <td>${log.student}</td>
            <td>${log.requirement}</td>
            <td>${log.timestamp ? log.timestamp.toLocaleString() : "No time"}</td>
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

async function resolveOfficeName(db, userID) {
  try {
    const designeeDoc = await db.collection("Designees").doc(userID).get();
    if (!designeeDoc.exists) return userID;

    const { office, department, category } = designeeDoc.data();

    if (!category && !department) {
      const officeDoc = await db.collection("officeTable").doc(office).get();
      return officeDoc.exists ? officeDoc.data().office : office;
    }

    if (!category && department) {
      const officeDoc = await db.collection("officeTable").doc(office).get();
      const deptDoc = await db.collection("departmentTable").doc(department).get();
      const officeName = officeDoc.exists ? officeDoc.data().office : office;
      const deptName = deptDoc.exists ? deptDoc.data().department : department;
      return `${officeName} - ${deptName}`;
    }

    if (category) {
      const labDoc = await db.collection("labTable").doc(category).get();
      if (labDoc.exists) return labDoc.data().lab;

      const acadDoc = await db.collection("acadClubTable").doc(category).get();
      if (acadDoc.exists) return acadDoc.data().codeName;

      const groupDoc = await db.collection("groupTable").doc(category).get();
      if (groupDoc.exists) return groupDoc.data().club;

      return category;
    }

    return userID;
  } catch (err) {
    console.error("Error resolving office name:", err);
    return userID;
  }
}

// --------------------------
// XLSX Export
// --------------------------
async function setupExportButton() {
  const exportBtn = document.getElementById("exportSheetBtn");
  if (!exportBtn) return;

  exportBtn.addEventListener("click", async () => {
    try {
      const db = firebase.firestore();

      // Get current semester
      const semesterSnap = await db.collection("semesterTable").where("currentSemester", "==", true).limit(1).get();
      let semesterName = "UnknownSemester";
      if (!semesterSnap.empty) {
        semesterName = semesterSnap.docs[0].data().semester.replace(/\s+/g, "_");
      }

      const tableRows = document.querySelectorAll("#fullCheckedByLog tr");
      const data = [["Office","Personnel","Action","Student Name","Requirement","Timestamp"]];

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
