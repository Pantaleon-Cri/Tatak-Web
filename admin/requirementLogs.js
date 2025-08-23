document.addEventListener("DOMContentLoaded", async () => {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const storedAdminID = localStorage.getItem("adminID");

  if (storedAdminID) {
    usernameDisplay.textContent = storedAdminID;  // show saved ID
  } else {
    usernameDisplay.textContent = "Unknown"; // fallback
  }

  await loadRequirementApprovalLogs();
  setupExportButton();
});

async function loadRequirementApprovalLogs() {
  const db = firebase.firestore();

  const fullLogTable = document.getElementById("fullCheckedByLog");
  if (fullLogTable) {
    fullLogTable.innerHTML = `<tr><td colspan="6">Loading requirement logs...</td></tr>`;
  }

  try {
    const snapshot = await db.collection("ValidateRequirementsTable").get();
    if (snapshot.empty) {
      if (fullLogTable) fullLogTable.innerHTML = `<tr><td colspan="6">No requirement approvals found.</td></tr>`;
      return;
    }

    const allLogs = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!data.offices) continue;

      for (const [userID, requirementsArr] of Object.entries(data.offices)) {
        if (!Array.isArray(requirementsArr)) continue;

        const officeName = await resolveOfficeName(db, userID);

        for (const req of requirementsArr) {
          if (!req.status || !req.checkedBy) continue; // only approved

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

    // Sort newest first
    allLogs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (fullLogTable) {
      fullLogTable.innerHTML = "";
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
        fullLogTable.appendChild(row);
      });
    }

  } catch (err) {
    console.error("Error loading requirement logs:", err);
    if (fullLogTable) fullLogTable.innerHTML = `<tr><td colspan="6">Error loading requirement logs.</td></tr>`;
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
      const tableRows = document.querySelectorAll("#fullCheckedByLog tr");
      const data = [["Office","Personnel","Action","Student Name","Requirement","Timestamp"]];

      tableRows.forEach(tr => {
        const row = Array.from(tr.children).map(td => td.textContent);
        if (row.length === 6) data.push(row);
      });

      // Get current semester
      const semesterSnap = await db.collection("semesterTable").where("currentSemester", "==", true).limit(1).get();
      let semesterName = "UnknownSemester";
      if (!semesterSnap.empty) {
        semesterName = semesterSnap.docs[0].data().semester.replace(/\s+/g, "_");
      }

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
