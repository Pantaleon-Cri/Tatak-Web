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

    // 🔹 Fetch student first
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
    const currentSemesterId = semesterRecord.id;            // e.g. "2"
    const currentSemesterName = semesterRecord.semester;    // e.g. "2nd Semester 2025-2026"
    console.log("📖 Student mapped to ACTIVE semester:", currentSemesterName);

    // 🔹 Clubs normalization
    const studentClubs = Array.isArray(student.clubs)
      ? student.clubs.map(c => String(c).trim())
      : typeof student.clubs === "string"
        ? student.clubs.split(",").map(c => c.trim())
        : [];

    // 🔹 Allowed collections (Org membership)
    const allowedSnap = await db.collection("allowedCollections").get();
    const allowedCollections = allowedSnap.docs.map(doc => doc.data().name).filter(Boolean);

    let matchedStudentData = null;
    let allowedCollectionMemberships = new Set();
    for (const collName of allowedCollections) {
      try {
        const doc = await db.collection(collName).doc(studentId).get();
        if (doc.exists) {
          matchedStudentData = doc.data();
          allowedCollectionMemberships.add(collName);
        }
      } catch (err) {
        console.error(`Failed to check allowed collection ${collName}:`, err);
      }
    }

    const studentCategory = matchedStudentData ? String(matchedStudentData.sourceCategory || "").trim() : String(student.sourceCategory || "").trim();
    const studentOffice = matchedStudentData ? String(matchedStudentData.sourceOffice || "").trim() : String(student.sourceOffice || "").trim();
    const studentDepartment = matchedStudentData ? String(matchedStudentData.department || "").trim() : String(student.department || "").trim();

    // 🔹 Fetch requirements only for student's active semester
    const reqSnap = await db.collection("RequirementsTable")
      .where("semester", "==", currentSemesterName)
      .get();

    const groupedReqs = {};
    let anyRequirementsFound = false;

    for (const reqDoc of reqSnap.docs) {
      const req = reqDoc.data();
      const reqCategory = String(req.category || "").trim();
      const reqOffice = String(req.office || "").trim();
      const reqDept = String(req.department || "").trim();
      const reqLab = String(req.lab || "").trim();

      const isDeptGlobal = normalizeString(reqDept) === "n/a" || reqDept === "";
      const isCategoryGlobal = normalizeString(reqCategory) === "n/a" || reqCategory === "";

      let showRequirement = false;

      // ========================= RULES =========================
      if (["302","303","304","305","306"].includes(reqOffice)) {
        showRequirement = true;
      } else if (["401","403"].includes(reqCategory)) {
        showRequirement = true;
      } else if (reqOffice === "309" && studentClubs.includes(reqCategory)) {
        showRequirement = true;
      } else if (reqOffice === "301") {
        if (["401", "403"].includes(reqCategory)) {
          showRequirement = true;
        } else {
          const categoryName = await getCategoryName(reqCategory);
          if (allowedCollectionMemberships.has(categoryName)) {
            showRequirement = true;
          }
        }
      } else if (["310","311","312","313"].includes(reqOffice)) {
        try {
          const groupSnap = await db.collection("groupTable").get();
          for (const doc of groupSnap.docs) {
            const collName = doc.data().club;
            if (!collName) continue;
            const categoryDoc = await db.collection(collName).doc(studentId).get();
            if (categoryDoc.exists) {
              showRequirement = true;
              break;
            }
          }
        } catch (err) {
          console.error(`Failed to check groupTable for office ${reqOffice}:`, err);
        }
      } else if (reqOffice === "314") {
        try {
          const labSnap = await db.collection("labTable").get();
          for (const doc of labSnap.docs) {
            const collName = doc.data().lab;
            if (!collName) continue;
            const labDoc = await db.collection(collName).doc(studentId).get();
            if (labDoc.exists) {
              showRequirement = true;
              break;
            }
          }
        } catch (err) {
          console.error("Failed to check labTable for office 314:", err);
        }
      } else if (["307","308"].includes(reqOffice) && !isDeptGlobal) {
        if (normalizeString(reqDept) === normalizeString(studentDepartment)) {
          showRequirement = true;
        }
      } else if (
        reqCategory && reqOffice &&
        normalizeString(reqCategory) === normalizeString(studentCategory) &&
        normalizeString(reqOffice) === normalizeString(studentOffice)
      ) {
        showRequirement = true;
      } else if (isDeptGlobal && isCategoryGlobal) {
        showRequirement = true;
      }
      // =========================================================

      if (!showRequirement) continue;
      anyRequirementsFound = true;

      const key = `${reqCategory}||${reqDept}||${reqOffice}||${reqLab}`;
      if (!groupedReqs[key]) {
        groupedReqs[key] = { category: reqCategory, department: reqDept, office: reqOffice, lab: reqLab, requirements: [] };
      }
      groupedReqs[key].requirements.push(req.requirement);
    }

    // 🔹 Fetch validation data (semester-consistent)
    let validationData = {};
    const validationDoc = await db.collection("ValidateRequirementsTable").doc(studentId).get();
    if (validationDoc.exists) {
      const data = validationDoc.data();
      // only keep offices/requirements tagged with this semester
      if (data.offices && typeof data.offices === "object") {
        const filteredOffices = {};
        for (const officeKey in data.offices) {
          const checkedArray = data.offices[officeKey];
          if (Array.isArray(checkedArray)) {
            filteredOffices[officeKey] = checkedArray.filter(
              item => !item.semester || normalizeString(item.semester) === normalizeString(currentSemesterName)
            );
          }
        }
        validationData.offices = filteredOffices;
      }
    }

    // 🔹 Fetch notes only for student's active semester
    const notesSnap = await db.collection("notesTable")
      .where("semester", "==", currentSemesterName)
      .get();

    const notesMap = {};
    notesSnap.forEach(doc => {
      const data = doc.data();
      const key = `${normalizeString(data.category)}||${normalizeString(data.department)}||${normalizeString(data.office)}||${normalizeString(data.lab)}`;
      if (!notesMap[key]) notesMap[key] = [];
      if (data.note) notesMap[key].push(data.note);
    });

    // 🔹 Render requirement cards
    for (const groupKey in groupedReqs) {
      const group = groupedReqs[groupKey];
      let headerTitle = "";
      const isDeptGlobal = normalizeString(group.department) === "n/a" || group.department === "";
      const isCategoryGlobal = normalizeString(group.category) === "n/a" || group.category === "";

      if (!isCategoryGlobal) {
        headerTitle = await getCategoryName(group.category) || group.category;
        if (/^\d+$/.test(headerTitle)) {
          const labName = await getLabName(group.category);
          if (labName) headerTitle = labName;
        }
      } else if (isCategoryGlobal && isDeptGlobal) {
        headerTitle = await getOfficeName(group.office) || group.office;
      } else if (isCategoryGlobal && !isDeptGlobal) {
        const officeName = await getOfficeName(group.office) || group.office;
        const deptName = await getDepartmentName(group.department) || group.department;
        headerTitle = `${officeName} - ${deptName}`;
      }

      if (group.lab) {
        const labName = await getLabName(group.lab);
        if (labName) headerTitle += ` - ${labName}`;
      }

      const requirementSection = document.createElement("div");
      requirementSection.className = "clearance-section-card";

      let reqListHTML = "<ul class='requirements-list'>";
      for (const reqText of group.requirements) {
        const safeId = reqText.replace(/\s+/g, "-").toLowerCase();
        let isChecked = false;

        if (validationData.offices && typeof validationData.offices === "object") {
          for (const officeKey in validationData.offices) {
            const checkedArray = validationData.offices[officeKey];
            if (Array.isArray(checkedArray)) {
              for (const item of checkedArray) {
                const sameRequirement = normalizeString(item.requirement) === normalizeString(reqText);
                const validStatus = item.status === true;
                if (sameRequirement && validStatus) {
                  isChecked = true;
                  break;
                }
              }
            }
            if (isChecked) break;
          }
        }

        reqListHTML += `
          <li class="requirement-item">
            <input type="checkbox" id="${safeId}" ${isChecked ? "checked" : ""} onclick="return false;">
            <label for="${safeId}">${reqText}</label>
          </li>
        `;
      }
      reqListHTML += "</ul>";

      let notesHTML = `<p>No Notes Yet</p>`;
      const notesKey = `${normalizeString(group.category)}||${normalizeString(group.department)}||${normalizeString(group.office)}||${normalizeString(group.lab)}`;
      if (notesMap[notesKey]) {
        notesHTML = "";
        notesMap[notesKey].forEach(note => { notesHTML += `<p>${note}</p>`; });
      }

      requirementSection.innerHTML = `
        <div class="section-header">${headerTitle}</div>
        ${reqListHTML}
        <div class="notes-section">
          <h4>Notes</h4>
          ${notesHTML}
        </div>
      `;
      requirementsContainer.appendChild(requirementSection);
    }

    // 🔹 Fallback if no requirements
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
