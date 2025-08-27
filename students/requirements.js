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
          <div class="notes-section">
            <p>You currently have no active requirements for this semester.</p>
          </div>
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

      // 🔹 Render each office as a section
      const requirementSection = document.createElement("div");
      requirementSection.className = "clearance-section-card";

      // Office header (human-readable if possible)
      let officeName = await getOfficeName(officeKey);
      if (!officeName) officeName = officeKey;

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
      const notesSnap = await db.collection("notesTable")
        .where("semester", "==", currentSemesterName)
        .where("office", "==", officeKey)
        .get();

      let notesHTML = `<p>No Notes Yet</p>`;
      if (!notesSnap.empty) {
        notesHTML = "";
        notesSnap.forEach(doc => {
          const noteData = doc.data();
          if (noteData.note) notesHTML += `<p>${noteData.note}</p>`;
        });
      }

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
          <div class="notes-section">
            <p>You currently have no active requirements for this semester.</p>
          </div>
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

// 🔹 Helpers (you should already have these in your project)
async function getOfficeName(officeId) {
  try {
    const doc = await db.collection("officesTable").doc(String(officeId)).get();
    return doc.exists ? doc.data().name : null;
  } catch (err) {
    console.error("Error fetching office name:", err);
    return null;
  }
}
