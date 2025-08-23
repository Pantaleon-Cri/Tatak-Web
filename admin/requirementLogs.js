document.addEventListener("DOMContentLoaded", async () => {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const storedAdminID = localStorage.getItem("adminID");

  if (storedAdminID) {
    usernameDisplay.textContent = storedAdminID;  // show saved ID
  } else {
    usernameDisplay.textContent = "Unknown"; // fallback
  }
  await loadRequirementApprovalLogs();
});

async function loadRequirementApprovalLogs() {
  const db = firebase.firestore();

  // Detect if we’re on dashboard or full-page log
  const logsList = document.getElementById("requirementLogsList");
  const fullLogTable = document.getElementById("fullCheckedByLog");

  if (logsList) {
    logsList.innerHTML = "<li>Loading requirement logs...</li>";
  }
  if (fullLogTable) {
    fullLogTable.innerHTML = `<tr><td colspan="6">Loading requirement logs...</td></tr>`;
  }

  try {
    const snapshot = await db.collection("ValidateRequirementsTable").get();

    if (snapshot.empty) {
      if (logsList) logsList.innerHTML = "<li>No requirement approvals found.</li>";
      if (fullLogTable) fullLogTable.innerHTML = `<tr><td colspan="6">No requirement approvals found.</td></tr>`;
      return;
    }

    const allLogs = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!data.offices) continue;
      const offices = data.offices;

      for (const [userID, requirementsArr] of Object.entries(offices)) {
        if (!Array.isArray(requirementsArr)) continue;

        // 🔍 Resolve readable office name based on Designee rules
        const officeName = await resolveOfficeName(db, userID);

        for (const req of requirementsArr) {
          if (!req.status || !req.checkedBy) continue; // only approved ones

          const studentID = data.studentID || req.studentID;
          let studentName = studentID || "Unknown Student";

          // fetch student info
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

          // push log entry
          allLogs.push({
            office: officeName,
            personnel: req.checkedBy,
            action: "Approved",
            student: studentName,
            requirement: req.requirement || "—",
            timestamp: req.checkedAt ? new Date(req.checkedAt) : null,
          });
        }
      }
    }

    // Sort logs newest first if timestamp exists
    allLogs.sort((a, b) => {
      if (!a.timestamp || !b.timestamp) return 0;
      return b.timestamp - a.timestamp;
    });

    // --------------------------
    // Dashboard Preview (last 5)
    // --------------------------
    if (logsList) {
      logsList.innerHTML = "";
      allLogs.slice(0, 10).forEach((log) => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${log.personnel}</strong> approved <em>${log.requirement}</em> for ${log.student} 
          <span style="color:#777; font-size:0.85em;">(${log.timestamp ? log.timestamp.toLocaleString() : "No time"})</span>`;
        logsList.appendChild(li);
      });
    }

    // --------------------------
    // Full Page Table (all logs)
    // --------------------------
    if (fullLogTable) {
      fullLogTable.innerHTML = "";
      allLogs.forEach((log) => {
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

  } catch (error) {
    console.error("Error loading requirement logs:", error);
    if (logsList) logsList.innerHTML = "<li>Error loading requirement logs.</li>";
    if (fullLogTable) fullLogTable.innerHTML = `<tr><td colspan="6">Error loading requirement logs.</td></tr>`;
  }
}

/**
 * Resolve human-readable office name using Designees + related tables.
 * @param {object} db Firestore instance
 * @param {string} userID The userID from ValidateRequirementsTable (points to Designees.doc)
 */
async function resolveOfficeName(db, userID) {
  try {
    const designeeDoc = await db.collection("Designees").doc(userID).get();
    if (!designeeDoc.exists) {
      return userID; // fallback: show raw userID
    }

    const designee = designeeDoc.data();
    const { office, department, category } = designee;

    // Case 1: No category & no department → use office
    if (!category && !department) {
      const officeDoc = await db.collection("officeTable").doc(office).get();
      return officeDoc.exists ? officeDoc.data().office : office;
    }

    // Case 2: Department only → office + department
    if (!category && department) {
      const officeDoc = await db.collection("officeTable").doc(office).get();
      const deptDoc = await db.collection("departmentTable").doc(department).get();

      const officeName = officeDoc.exists ? officeDoc.data().office : office;
      const deptName = deptDoc.exists ? deptDoc.data().department : department;

      return `${officeName} - ${deptName}`;
    }

    // Case 3: Category exists → check labTable first, then acadClubTable, then groupTable
    if (category) {
      // Check labTable
      const labDoc = await db.collection("labTable").doc(category).get();
      if (labDoc.exists) {
        return labDoc.data().lab;
      }

      // Check acadClubTable
      const acadClubDoc = await db.collection("acadClubTable").doc(category).get();
      if (acadClubDoc.exists) {
        return acadClubDoc.data().codeName;
      }

      // Check groupTable
      const groupDoc = await db.collection("groupTable").doc(category).get();
      if (groupDoc.exists) {
        return groupDoc.data().club;
      }

      return category; // fallback
    }

    return userID; // ultimate fallback
  } catch (err) {
    console.error("Error resolving office name:", err);
    return userID;
  }
}
