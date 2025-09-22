// -------------------- Helper Functions --------------------

// Normalize strings for comparison
function normalizeString(str) {
  return String(str || "").trim().toLowerCase();
}

// Fetch readable category/club name from ID
async function getCategoryName(db, id) {
  if (!id || id.toLowerCase() === "n/a") return null;

  let doc = await db.collection("acadClubTable").doc(id).get();
  if (doc.exists) return doc.data().club || doc.data().clubName || doc.data().name || id;

  doc = await db.collection("groupTable").doc(id).get();
  if (doc.exists) return doc.data().club || doc.data().clubName || doc.data().name || id;

  return id;
}

// Fetch lab name from ID
async function getLabName(db, id) {
  if (!id || id.toLowerCase() === "n/a") return null;
  try {
    const doc = await db.collection("labTable").doc(id).get();
    return doc.exists ? doc.data().lab || doc.data().name || id : id;
  } catch (err) {
    console.error("Error fetching lab name:", err);
    return id;
  }
}

// Fetch office name from ID
async function getOfficeName(db, id) {
  if (!id || id.toLowerCase() === "n/a") return null;
  try {
    const doc = await db.collection("officeTable").doc(id).get();
    return doc.exists ? doc.data().office || doc.data().name || id : id;
  } catch (err) {
    console.error("Error fetching office name:", err);
    return id;
  }
}

// Fetch department name from ID
async function getDepartmentName(db, id) {
  if (!id || id.toLowerCase() === "n/a") return null;
  try {
    const doc = await db.collection("departmentTable").doc(id).get();
    return doc.exists ? doc.data().department || doc.data().name || id : id;
  } catch (err) {
    console.error("Error fetching department name:", err);
    return id;
  }
}

// Resolve designee/office name and image
async function resolveOfficeNameWithImage(db, designeeId) {
  try {
    const snap = await db.collection("Designees")
      .where("userID", "==", String(designeeId))
      .limit(1)
      .get();

    if (snap.empty) return { officeName: designeeId, imageId: "default" };

    const designee = snap.docs[0].data();
    let officeName = null;
    let imageId = designee.category || designee.office || "default";

    // ------------------ Try category via multiple tables ------------------
    if (designee.category) {
      const tables = ["acadClubTable", "labTable", "groupTable"];
      for (const table of tables) {
        const catDoc = await db.collection(table).doc(designee.category).get();
        if (catDoc.exists) {
          const data = catDoc.data();
          officeName = data.club || data.clubName || data.lab || data.name || data.title;
          if (officeName) break; // stop at first found name
        }
      }
    }

    // ------------------ If no name from category, try office ------------------
    if (!officeName && designee.office) {
      const officeDoc = await db.collection("officeTable").doc(designee.office).get();
      if (officeDoc.exists) officeName = officeDoc.data().office || officeDoc.data().name;
    }

    // ------------------ If still no name, fallback to department ------------------
    if (!officeName && designee.department) {
      const depDoc = await db.collection("departmentTable").doc(designee.department).get();
      const depName = depDoc.exists ? depDoc.data().department || depDoc.data().name : null;
      if (depName && designee.office) {
        const officeDoc = await db.collection("officeTable").doc(designee.office).get();
        const offName = officeDoc.exists ? officeDoc.data().office : null;
        officeName = offName ? `${depName} - ${offName}` : depName;
      } else {
        officeName = department || designee.firstName || designee.lastName || designeeId;
      }
    }

    // ------------------ Final fallback ------------------
    if (!officeName) officeName = designee.firstName || designee.lastName || designeeId;

    return { officeName, imageId };
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
window.openViewClearanceCard = async function(studentID, db) {
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

    const semesterSnap = await db.collection("semesterTable")
      .where("currentSemester", "==", true)
      .limit(1)
      .get();

    if (!semesterSnap.empty) {
      const semesterDoc = semesterSnap.docs[0];
      currentSemesterId = semesterDoc.id;
      currentSemesterName = semesterDoc.data().semester;
    }

    // ================= Fetch student =================
    const studentDoc = await db.collection("Students").doc(studentID).get();
    if (!studentDoc.exists) throw new Error("Student not found");
    const student = studentDoc.data();

    document.getElementById("studentName").textContent =
      [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ");
    document.getElementById("semesterText").textContent = currentSemesterName;

    // ================= Fetch validation data =================
    const valDoc = await db.collection("ValidateRequirementsTable").doc(studentID).get();
    const officesData = valDoc?.exists ? valDoc.data().offices || {} : {};

    // ------------------ Filter validation by semester ------------------
    for (const officeId in officesData) {
      officesData[officeId] = officesData[officeId].filter(item => {
        if (!item.semester) return true;
        return item.semester === currentSemesterId || item.semester === currentSemesterName;
      });
    }

    // ================= Render office cards =================
    let overallCleared = true;

    for (const designeeId in officesData) {
      const validations = officesData[designeeId];
      const allChecked = validations.length > 0 && validations.every(v => v.status === true);
      if (!allChecked) overallCleared = false;

      // Most recent approval
      const lastValidation = validations
        .filter(v => v.status === true && v.checkedBy)
        .sort((a, b) => b.checkedAt - a.checkedAt)[0] || {};

      const lastCheckedBy = lastValidation.checkedBy || "Unknown";
      const checkedAt = lastValidation.checkedAt
        ? new Date(lastValidation.checkedAt).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
          })
        : "N/A";

      // Resolve office/designee name and image
      const { officeName, imageId } = await resolveOfficeNameWithImage(db, designeeId);

      // Build UI card
      const sectionGroupDiv = document.createElement("div");
      sectionGroupDiv.classList.add("section-group");

      const headerLabel = document.createElement("label");
      headerLabel.classList.add("section-header");
      headerLabel.textContent = officeName || designeeId;
      sectionGroupDiv.appendChild(headerLabel);

      const approvalDiv = document.createElement("div");
      approvalDiv.classList.add("section-item");

      approvalDiv.innerHTML = allChecked
        ? `<img src="../../logo/${imageId || "default"}.png" 
                 alt="Approved Icon" 
                 style="width:50px; height:50px;" 
                 onerror="this.onerror=null;this.src='../../Tatak.png';" /><br />
           <label><i>Approved By: ${lastCheckedBy}<br />Checked At: ${checkedAt}</i><hr /></label>`
        : `<label><i>Not Cleared</i><hr /></label>`;

      sectionGroupDiv.appendChild(approvalDiv);
      containerEl.appendChild(sectionGroupDiv);
    }

    // ================= Status Display =================
    statusEl.innerHTML = overallCleared
      ? `<span style="color:green">Completed</span>`
      : `<span style="color:red">Pending</span>`;
    container.style.border = overallCleared ? "5px solid #a6d96a" : "5px solid red";

    if (Object.keys(officesData).length === 0) {
      containerEl.innerHTML = `<div class="section-item"><label class="section-header">No Offices Found</label><p>You currently have no offices in validation.</p></div>`;
      statusEl.innerHTML = `<span style="color:red">Pending</span>`;
    }

  } catch (err) {
    console.error("Error loading clearance:", err);
    containerEl.innerHTML = "<p>Failed to load clearance. Student is not yet registered</p>";
    statusEl.innerHTML = `<span style="color:red">Pending</span>`;
  }
};
