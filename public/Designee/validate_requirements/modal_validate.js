// ================= validate_modal.js (FULLY OPTIMIZED) =================

let checklistModal, modalBody, cancelBtn, saveBtn, approveBtn;
let currentStudentID = null;
let currentDesigneeID = null;
let dbInstance = null;

// -------------------- Helper Functions --------------------

function getCurrentUserFullName() {
  const currentUser = JSON.parse(localStorage.getItem("userData"));
  if (!currentUser) return null;
  const firstName = currentUser.firstName || "";
  const lastName = currentUser.lastName || "";
  return (firstName + " " + lastName).trim() || currentUser.id || null;
}

async function getCurrentSemester() {
  if (!dbInstance) return null;
  const snapshot = await dbInstance
    .collection("DataTable")
    .doc("Semester")
    .collection("SemesterDocs")
    .where("currentSemester", "==", true)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    const semDoc = snapshot.docs[0].data();
    return { id: snapshot.docs[0].id, semester: semDoc.semester };
  }
  return null;
}

async function getStudentData(studentID) {
  if (!dbInstance) return null;
  const doc = await dbInstance
    .collection("User")
    .doc("Students")
    .collection("StudentsDocs")
    .doc(studentID)
    .get();
  return doc.exists ? doc.data() : null;
}

// -------------------- Optimized Auto-Validation --------------------

async function autoValidateRequirements(designeeID, studentID, cachedData = {}) {
  if (!dbInstance || !designeeID) return;

  try {
    // Use cached data when available
    const currentSemesterData = cachedData.semester || await getCurrentSemester();
    if (!currentSemesterData) return;
    const currentSemesterId = currentSemesterData.id;

    const studentData = cachedData.students?.[studentID] || await getStudentData(studentID);
    if (!studentData) return;

    const hasOfficer = Array.isArray(studentData?.officers) && studentData.officers.includes(designeeID);
    const hasViolation = Array.isArray(studentData?.violations) && studentData.violations.includes(designeeID);
    const hasIncomplete = Array.isArray(studentData?.incompletes) && studentData.incompletes.includes(designeeID);

    // Use cached requirements if provided
    const masterRequirements = cachedData.requirements || (
      await dbInstance
        .collection("RequirementsAndNotes")
        .doc("RequirementsList")
        .collection(designeeID)
        .get()
    ).docs.map((doc) => doc.data());

    const studentYear = studentData?.yearLevel?.toString().trim().toLowerCase() || "";

    // Filter requirements by student attributes
    const filteredRequirements = masterRequirements
      .filter((d) => {
        if (d.semester && d.semester !== currentSemesterId) return false;
        if (d.officer && !hasOfficer) return false;
        if (d.violation && !hasViolation) return false;
        if (d.incomplete && !hasIncomplete) return false;

        const reqYear = d.yearLevel ? d.yearLevel.toString().trim().toLowerCase() : "all";
        if (reqYear !== "all" && reqYear !== studentYear) return false;

        return true;
      })
      .map((d) => ({
        requirement: d.requirement,
        status: false,
        checkedBy: null,
        checkedAt: null,
        semester: currentSemesterId,
        yearLevel: d.yearLevel || "All",
        officer: d.officer || false,
        violation: d.violation || false,
        incomplete: d.incomplete || false,
      }));

    const valDocRef = dbInstance
      .collection("Validation")
      .doc(designeeID)
      .collection(studentID)
      .doc(currentSemesterId);

    const valDoc = await valDocRef.get();
    const existingRequirements = valDoc.exists ? valDoc.data().requirements || [] : [];

    // Merge existing checked states
    const mergedRequirements = filteredRequirements.map((masterReq) => {
      const savedReq = existingRequirements.find(
        (r) => r.requirement?.toLowerCase() === masterReq.requirement?.toLowerCase()
      );
      return savedReq ? { ...masterReq, ...savedReq } : masterReq;
    });

    // Compare to avoid unnecessary writes
    const hasChanges = JSON.stringify(mergedRequirements) !== JSON.stringify(existingRequirements);

    if (hasChanges || !valDoc.exists) {
      await valDocRef.set({
        studentID,
        semester: currentSemesterId,
        requirements: mergedRequirements,
      });
      return { updated: true, requirements: mergedRequirements };
    }

    // Return existing data if no update needed
    return { updated: false, requirements: existingRequirements };
  } catch (err) {
    console.error("Error in autoValidateRequirements:", err);
    return { updated: false, requirements: [] };
  }
}

// -------------------- Batch Processing --------------------

async function batchAutoValidate(students, designeeID) {
  if (!students.length) return;

  console.log(`Starting validation for ${students.length} students...`);

  const currentSemesterData = await getCurrentSemester();
  if (!currentSemesterData) return;

  const reqSnapshot = await dbInstance
    .collection("RequirementsAndNotes")
    .doc("RequirementsList")
    .collection(designeeID)
    .get();
  const masterRequirements = reqSnapshot.docs.map((doc) => doc.data());

  const studentDataMap = {};
  for (const student of students) {
    studentDataMap[student.schoolID] = student;
  }

  const cachedData = {
    semester: currentSemesterData,
    requirements: masterRequirements,
    students: studentDataMap
  };

  const batchSize = 10;
  let processed = 0, updated = 0;

  for (let i = 0; i < students.length; i += batchSize) {
    const batch = students.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(student => autoValidateRequirements(designeeID, student.schoolID, cachedData))
    );

    processed += batch.length;
    updated += results.filter(r => r.updated).length;
    console.log(`Progress: ${processed}/${students.length}, ${updated} updated`);
  }

  console.log(`Validation complete: ${updated} students updated out of ${students.length}`);
}

// -------------------- Modal Initialization --------------------

document.addEventListener("DOMContentLoaded", async () => {
  checklistModal = document.getElementById("checklistModal");
  modalBody = checklistModal?.querySelector(".modal-body");
  cancelBtn = document.getElementById("cancelBtn");
  saveBtn = document.getElementById("saveBtn");
  approveBtn = document.getElementById("approveBtn");

  if (!checklistModal || !modalBody || !cancelBtn || !saveBtn) {
    console.error("Modal elements not found!");
    return;
  }

  cancelBtn.addEventListener("click", closeModal);
  saveBtn.addEventListener("click", saveRequirements);
  checklistModal.addEventListener("click", (e) => {
    if (e.target === checklistModal) closeModal();
  });

  try {
    const currentUser = JSON.parse(localStorage.getItem("userData"));
    if (!currentUser || !currentUser.id) throw new Error("User not logged in");

    dbInstance = firebase.firestore();

    currentDesigneeID =
      currentUser.role === "staff"
        ? currentUser.createdByDesigneeID || currentUser.id
        : currentUser.role === "designee"
        ? currentUser.id
        : null;

    if (!currentDesigneeID) return;

    const studentsSnapshot = await dbInstance
      .collection("User")
      .doc("Students")
      .collection("StudentsDocs")
      .get();

    const currentSemesterData = await getCurrentSemester();
    if (!currentSemesterData) return;
    const currentSemesterId = currentSemesterData.id;

    let office, currentCategory, currentDepartment;
    const userData = JSON.parse(localStorage.getItem("userData"));
    office = userData.office;
    currentCategory = userData.category?.toLowerCase();
    currentDepartment = userData.department;

    let students = studentsSnapshot.docs.map(doc => ({ schoolID: doc.id, ...doc.data() }));

    // --- FILTERING LOGIC ---
    if (currentCategory === "39" || currentCategory === "41") {
      students = students.filter(s => s.semester === currentSemesterId);
    } else if (office === "1") {
      students = students.filter(s =>
        currentCategory && s.clubs?.map(c => c.toLowerCase()).includes(currentCategory) &&
        s.semester === currentSemesterId
      );
    } else if (["2","3","5","6","9","10","12"].includes(office)) {
      students = students.filter(s => s.semester === currentSemesterId);
    } else if (["4","7","11"].includes(office)) {
      students = students.filter(s =>
        currentDepartment && s.department === currentDepartment &&
        s.semester === currentSemesterId
      );
    } else if (["16","15","14","13","8"].includes(office)) {
      if (currentCategory) {
        const membershipSnapshot = await dbInstance
          .collection("Membership").doc(currentCategory)
          .collection("Members")
          .where("semester", "==", currentSemesterId).get();
        const allowedIDs = membershipSnapshot.docs.map(doc => doc.id);
        students = students.filter(s => allowedIDs.includes(s.schoolID));
      } else {
        students = [];
      }
    } else {
      students = [];
    }

    if (students.length > 0) {
      batchAutoValidate(students, currentDesigneeID).catch(err => {
        console.error("Background validation failed:", err);
      });
    }
  } catch (err) {
    console.error("Initialization failed:", err);
  }
});

// -------------------- Modal Actions --------------------

window.openRequirementsModal = async function (studentID, designeeIDParam, db, options = {}) {
  const { autoRun = false } = options;
  currentStudentID = studentID;
  dbInstance = db;

  if (!modalBody || !checklistModal) return;

  if (!autoRun) {
    modalBody.innerHTML = "<p>Loading requirements...</p>";
    checklistModal.classList.add("active");
  }

  try {
    const currentUser = JSON.parse(localStorage.getItem("userData"));
    if (!currentUser || !currentUser.id) throw new Error("User not logged in");

    const linkedDesigneeID =
      currentUser.role === "staff"
        ? currentUser.createdByDesigneeID || currentUser.id
        : currentUser.role === "designee"
        ? currentUser.id
        : designeeIDParam;

    if (!linkedDesigneeID) {
      if (!autoRun) modalBody.innerHTML = "<p>No requirements assigned to you.</p>";
      return;
    }

    currentDesigneeID = linkedDesigneeID;

    const studentData = await getStudentData(studentID);
    const hasOfficer = Array.isArray(studentData?.officers) && studentData.officers.includes(currentDesigneeID);
    const hasViolation = Array.isArray(studentData?.violations) && studentData.violations.includes(currentDesigneeID);
    const hasIncomplete = Array.isArray(studentData?.incompletes) && studentData.incompletes.includes(currentDesigneeID);

    // Run auto-validation (no re-render, just ensure data)
    const { requirements } = await autoValidateRequirements(currentDesigneeID, studentID);

    // Even if no changes, still fetch and show
    const currentSemesterData = await getCurrentSemester();
    if (!currentSemesterData) return;
    const currentSemesterId = currentSemesterData.id;

    const valDocRef = dbInstance
      .collection("Validation")
      .doc(currentDesigneeID)
      .collection(studentID)
      .doc(currentSemesterId);

    const valDoc = await valDocRef.get();
    let finalReqs = valDoc.exists ? valDoc.data().requirements || [] : requirements || [];

    const studentYear = studentData?.yearLevel?.toString().trim().toLowerCase() || "";

    finalReqs = finalReqs.filter((r) => {
      if (r.officer && !hasOfficer) return false;
      if (r.violation && !hasViolation) return false;
      if (r.incomplete && !hasIncomplete) return false;
      const reqYear = r.yearLevel ? r.yearLevel.toString().trim().toLowerCase() : "all";
      if (reqYear !== "all" && reqYear !== studentYear) return false;
      return true;
    });

    renderRequirementsChecklist(finalReqs, { autoRun });
  } catch (err) {
    console.error("Error loading validation requirements:", err);
    if (!autoRun) modalBody.innerHTML = "<p>Failed to load requirements.</p>";
  }
};

// -------------------- Render & Save --------------------

function renderRequirementsChecklist(requirements, { autoRun = false } = {}) {
  modalBody.innerHTML = "";
  if (!requirements.length) {
    modalBody.innerHTML = "<p>No requirements found for this student.</p>";
    return;
  }

  requirements.forEach((req, i) => {
    const checkedClass = req.status ? "checked" : "";
    const checkedAttr = req.status ? "checked" : "";
    const checkerText = req.checkedBy
      ? ` (checked by ${req.checkedBy}${req.checkedAt ? " at " + new Date(req.checkedAt).toLocaleString() : ""})`
      : "";

    modalBody.insertAdjacentHTML(
      "beforeend",
      `
      <label class="checkbox-item ${checkedClass}">
        <input type="checkbox" data-index="${i}" ${checkedAttr}>
        <i class="fa-solid fa-check-square checkbox-icon"></i>
        <span>${req.requirement || ""}${checkerText}</span>
      </label>
    `
    );
  });

  if (!autoRun) {
    modalBody.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const label = checkbox.closest("label.checkbox-item");
        label.classList.toggle("checked", checkbox.checked);
      });
    });
  }
}

function closeModal() {
  checklistModal.classList.remove("active");
}

async function saveRequirements() {
  const checkboxes = modalBody.querySelectorAll("input[type='checkbox']");
  const currentUserFullName = getCurrentUserFullName();
  const currentTimestamp = new Date().toISOString();
  const currentSemesterData = await getCurrentSemester();
  if (!currentSemesterData) return;
  const currentSemesterId = currentSemesterData.id;

  try {
    const valDocRef = dbInstance
      .collection("Validation")
      .doc(currentDesigneeID)
      .collection(currentStudentID)
      .doc(currentSemesterId);

    const valDoc = await valDocRef.get();
    const existingRequirements = valDoc.exists ? valDoc.data().requirements || [] : [];

    const studentData = await getStudentData(currentStudentID);

    const updatedRequirements = Array.from(checkboxes).map((checkbox) => {
      const span = checkbox.parentElement.querySelector("span");
      const reqText = span.textContent.replace(/\s*\(checked by .*?\)$/, "");
      const isChecked = checkbox.checked;

      const existing = existingRequirements.find(
        (r) => r.requirement?.toLowerCase() === reqText?.toLowerCase()
      );

      let checkedBy = existing?.checkedBy || null;
      let checkedAt = existing?.checkedAt || null;

      if (isChecked) {
        checkedBy = currentUserFullName;
        checkedAt = currentTimestamp;
      } else if (existing?.checkedBy === currentUserFullName) {
        checkedBy = null;
        checkedAt = null;
      }

      return {
        requirement: reqText,
        status: isChecked,
        checkedBy,
        checkedAt,
        semester: currentSemesterId,
        yearLevel:
          existing?.yearLevel?.toLowerCase() === "all"
            ? studentData.yearLevel
            : existing?.yearLevel || "All",
        officer: existing?.officer || false,
        violation: existing?.violation || false,
        incomplete: existing?.incomplete || false,
      };
    });

    await valDocRef.set({
      studentID: currentStudentID,
      semester: currentSemesterId,
      requirements: updatedRequirements,
    });

    alert("Requirements saved successfully!");
    closeModal();
  } catch (err) {
    console.error("Failed to save requirements:", err);
    alert("Failed to save. Please try again.");
  }
}
