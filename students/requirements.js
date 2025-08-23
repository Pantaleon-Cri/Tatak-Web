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

    // Fetch student document from Students collection
    const studentDoc = await db.collection("Students").doc(studentId).get();
    if (!studentDoc.exists) throw new Error("Student not found");

    const student = studentDoc.data();
    const studentClubs = Array.isArray(student.clubs)
      ? student.clubs.map(c => String(c).trim())
      : typeof student.clubs === "string"
        ? student.clubs.split(",").map(c => c.trim())
        : [];

    // 1️⃣ Fetch allowed collections dynamically
    const allowedSnap = await db.collection("allowedCollections").get();
    const allowedCollections = allowedSnap.docs.map(doc => doc.data().name).filter(Boolean);

    // 2️⃣ Search each allowed collection for this student to get sourceCategory, sourceOffice, sourceDepartment
    let matchedStudentData = null;
    for (const collName of allowedCollections) {
      try {
        const doc = await db.collection(collName).doc(studentId).get();
        if (doc.exists) {
          matchedStudentData = doc.data();
          break; // stop at first match
        }
      } catch (err) {
        console.error(`Failed to check allowed collection ${collName}:`, err);
      }
    }

    // If not found in allowed collections, fallback to Students collection
    const studentCategory = matchedStudentData ? String(matchedStudentData.sourceCategory || "").trim() : String(student.sourceCategory || "").trim();
    const studentOffice = matchedStudentData ? String(matchedStudentData.sourceOffice || "").trim() : String(student.sourceOffice || "").trim();
    const studentDepartment = matchedStudentData ? String(matchedStudentData.sourceDepartment || "").trim() : String(student.sourceDepartment || "").trim();

    // Fetch all requirements
    const reqSnap = await db.collection("RequirementsTable").get();
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

      // 1️⃣ Offices 302–306 → show to all students
      if (["302","303","304","305","306"].includes(reqOffice)) {
        showRequirement = true;
      }

      // 2️⃣ Category 401 or 403 → global, show to all students
      else if (["401","403"].includes(reqCategory)) {
        showRequirement = true;
      }

      // 3️⃣ Office 309 → match if student’s clubs contain this category
      else if (reqOffice === "309" && studentClubs.includes(reqCategory)) {
        showRequirement = true;
      }

      // 4️⃣ Offices 301,310–313 → check groupTable.club collections
      else if (["301","310","311","312","313"].includes(reqOffice)) {
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
      }

      // 5️⃣ Office 314 → check labTable.lab collections
      else if (reqOffice === "314") {
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
      }

      // 6️⃣ Offices 307, 308 → match department
      else if (["307","308"].includes(reqOffice) && !isDeptGlobal) {
        if (normalizeString(reqDept) === normalizeString(studentDepartment)) {
          showRequirement = true;
        }
      }

      // 7️⃣ Strict match: only sourceCategory & sourceOffice from allowed collections
      else if (
        reqCategory && reqOffice &&
        normalizeString(reqCategory) === normalizeString(studentCategory) &&
        normalizeString(reqOffice) === normalizeString(studentOffice)
      ) {
        showRequirement = true;
      }

      // 8️⃣ Department-global fallback
      else if (isDeptGlobal && isCategoryGlobal) {
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

    // Fetch validation data
    const validationDoc = await db.collection("ValidateRequirementsTable").doc(studentId).get();
    const validationData = validationDoc.exists ? validationDoc.data() : {};

    // Fetch notes
    const notesSnap = await db.collection("notesTable").get();
    const notesMap = {};
    notesSnap.forEach(doc => {
      const data = doc.data();
      const key = `${normalizeString(data.category)}||${normalizeString(data.department)}||${normalizeString(data.office)}||${normalizeString(data.lab)}`;
      if (!notesMap[key]) notesMap[key] = [];
      if (data.note) notesMap[key].push(data.note);
    });

    // Render requirement cards
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
                if (normalizeString(item.requirement) === normalizeString(reqText) && item.status === true) {
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

    // Fallback if no requirements
    if (!anyRequirementsFound) {
      requirementsContainer.innerHTML = `
        <div class="clearance-section-card">
          <div class="section-header">No Requirements Found</div>
          <div class="notes-section">
            <p>You currently have no active requirements.</p>
          </div>
        </div>
      `;
    }

  } catch (err) {
    console.error("Error loading student requirements:", err);
    alert("Unable to load your requirements. Please try again later.");
  }
});
