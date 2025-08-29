document.addEventListener("DOMContentLoaded", async () => {
  const studentId = localStorage.getItem("schoolID");
  if (!studentId) {
    alert("Session expired. Please log in again.");
    window.location.href = "../../login/student_login.html";
    return;
  }

  try {
    const requirementsContainer = document.querySelector(".student-main-content");
    requirementsContainer.innerHTML = "";

    // 🔹 Fetch student
    const studentDoc = await db.collection("Students").doc(studentId).get();
    if (!studentDoc.exists) throw new Error("Student not found");
    const student = studentDoc.data();
    const studentSemesterId = String(student.semester || "").trim();

    // 🔹 Match semesterTable with student.semester AND currentSemester == true
    const semesterSnap = await db.collection("semesterTable")
      .where("id", "==", studentSemesterId)
      .where("currentSemester", "==", true)
      .limit(1)
      .get();

    if (semesterSnap.empty) {
      requirementsContainer.innerHTML = `
        <div class="clearance-section-card">
          <div class="section-header">No Active Semester Found</div>
          <div class="notes-section">
            <p>No requirements available because your semester is not currently active.</p>
          </div>
        </div>
      `;
      return;
    }

    const semesterRecord = semesterSnap.docs[0].data();
    const currentSemesterName = semesterRecord.semester;
    console.log("📖 Active semester for student:", currentSemesterName);

    // 🔹 Fetch requirements from ValidateRequirementsTable
    const valDoc = await db.collection("ValidateRequirementsTable").doc(studentId).get();
    if (!valDoc.exists) {
      requirementsContainer.innerHTML = `
        <div class="clearance-section-card">
          <div class="section-header">No Requirements Found</div>
          
        </div>
      `;
      return;
    }

    const validationData = valDoc.data();
    const offices = validationData.offices || {};
    let anyRequirementsFound = false;

    // 🔹 Loop through each office requirements
    for (const officeKey in offices) {
      const officeReqs = offices[officeKey];
      if (!Array.isArray(officeReqs)) continue;

      // Filter only this semester’s requirements
      const filteredReqs = officeReqs.filter(req =>
        !req.semester || normalizeString(req.semester) === normalizeString(currentSemesterName)
      );

      if (filteredReqs.length === 0) continue;

      anyRequirementsFound = true;

      // 🔹 Resolve office header (human-readable name)
      let officeName = await resolveOfficeName(officeKey);
      if (!officeName) officeName = officeKey; // fallback

      // 🔹 Build requirements list
      let reqListHTML = "<ul class='requirements-list'>";
      for (const req of filteredReqs) {
        const safeId = req.requirement.replace(/\s+/g, "-").toLowerCase();
        const isChecked = req.status === true;

        reqListHTML += `
          <li class="requirement-item">
            <input type="checkbox" id="${safeId}" ${isChecked ? "checked" : ""} onclick="return false;">
            <label for="${safeId}">${req.requirement}</label>
          </li>
        `;
      }
      reqListHTML += "</ul>";

      // 🔹 Fetch notes for this office & semester
     // 🔹 Fetch notes for this officer & semester
const notesSnap = await db.collection("notesTable")
  .where("semester", "==", currentSemesterName)
  .where("addedBy", "==", officeKey) // <-- match officer's userID
  .get();

let notesHTML = `<p>No Notes Yet</p>`;
if (!notesSnap.empty) {
  notesHTML = "";
  notesSnap.forEach(doc => {
    const noteData = doc.data();
    if (noteData.note) notesHTML += `<p>${noteData.note}</p>`;
  });
}


      // 🔹 Render section
      const requirementSection = document.createElement("div");
      requirementSection.className = "clearance-section-card";
      requirementSection.innerHTML = `
        <div class="section-header">${officeName}</div>
        ${reqListHTML}
        <div class="notes-section">
          <h4>Notes</h4>
          ${notesHTML}
        </div>
      `;

      requirementsContainer.appendChild(requirementSection);
    }

    // 🔹 Fallback if no requirements matched
    if (!anyRequirementsFound) {
      requirementsContainer.innerHTML = `
        <div class="clearance-section-card">
          <div class="section-header">No Requirements Found</div>
          
        </div>
      `;
    }

  } catch (err) {
    console.error("Error loading student requirements:", err);
    alert("Unable to load your requirements. Please try again later.");
  }
});

// 🔹 Utility normalizer
function normalizeString(str) {
  return String(str || "").trim().toLowerCase();
}

// 🔹 Resolve officeName using userID field in Designees
// 🔹 Resolve officeName using userID field in Designees
async function resolveOfficeName(userId) {
  try {
    // 🔑 Always query by userID field (not docId)
    const snap = await db.collection("Designees")
      .where("userID", "==", String(userId))
      .limit(1)
      .get();

    if (snap.empty) {
      console.warn("⚠️ No Designee found for userID:", userId);
      return null;
    }

    const designee = snap.docs[0].data();

    // Case 1: Has category (priority: acadClub → lab → group)
    if (designee.category) {
      // acadClubTable → use .club
      let catDoc = await db.collection("acadClubTable").doc(designee.category).get();
      if (catDoc.exists && catDoc.data().club) return catDoc.data().club;

      // labTable → use .lab
      catDoc = await db.collection("labTable").doc(designee.category).get();
      if (catDoc.exists && catDoc.data().lab) return catDoc.data().lab;

      // groupTable → use .club
      catDoc = await db.collection("groupTable").doc(designee.category).get();
      if (catDoc.exists && catDoc.data().club) return catDoc.data().club;
    }

    // Case 2: Has department (+ maybe office)
    if (designee.department) {
      const depDoc = await db.collection("departmentTable").doc(designee.department).get();
      const depName = depDoc.exists ? depDoc.data().department : "";

      if (designee.office) {
        const officeDoc = await db.collection("officeTable").doc(designee.office).get();
        const officeName = officeDoc.exists ? officeDoc.data().office : "";
        return depName && officeName ? `${depName} - ${officeName}` : depName || officeName;
      }

      return depName;
    }

    // Case 3: Only office
    if (designee.office) {
      const officeDoc = await db.collection("officeTable").doc(designee.office).get();
      if (officeDoc.exists) return officeDoc.data().office;
    }

    // Case 4: Fallback → full name
    if (designee.firstName || designee.lastName) {
      return `${designee.firstName || ""} ${designee.lastName || ""}`.trim();
    }

    return null;
  } catch (err) {
    console.error("Error resolving office name:", err);
    return null;
  }
}

