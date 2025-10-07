// ================= validate_modal.js (OPTIMIZED) =================

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

    const hasOfficer = Array.isArray(studentData?.officers) && 
                       studentData.officers.includes(designeeID);
    const hasViolation = Array.isArray(studentData?.violations) && 
                         studentData.violations.includes(designeeID);
    const hasIncomplete = Array.isArray(studentData?.incompletes) && 
                          studentData.incompletes.includes(designeeID);

    // Use cached requirements
    const masterRequirements = cachedData.requirements || 
      (await dbInstance
        .collection("RequirementsAndNotes")
        .doc("RequirementsList")
        .collection(designeeID)
        .get()
      ).docs.map((doc) => doc.data());

    const studentYear = studentData?.yearLevel?.toString().trim().toLowerCase() || "";

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

    // ONLY WRITE IF CHANGED - this is critical for performance
    const hasChanges = JSON.stringify(mergedRequirements) !== 
                       JSON.stringify(existingRequirements);
    
    if (hasChanges || !valDoc.exists) {
      await valDocRef.set({
        studentID,
        semester: currentSemesterId,
        requirements: mergedRequirements,
      });
      return true; // Return true if updated
    }
    return false; // Return false if no changes
  } catch (err) {
    console.error("Error in autoValidateRequirements:", err);
    return false;
  }
}

// -------------------- Batch Processing --------------------

async function batchAutoValidate(students, designeeID) {
  if (!students.length) return;

  console.log(`Starting validation for ${students.length} students...`);

  // Fetch shared data once
  const currentSemesterData = await getCurrentSemester();
  if (!currentSemesterData) return;

  // Fetch all requirements once
  const reqSnapshot = await dbInstance
    .collection("RequirementsAndNotes")
    .doc("RequirementsList")
    .collection(designeeID)
    .get();
  const masterRequirements = reqSnapshot.docs.map((doc) => doc.data());

  // Build student data map
  const studentDataMap = {};
  for (const student of students) {
    studentDataMap[student.schoolID] = student;
  }

  // Prepare cached data
  const cachedData = {
    semester: currentSemesterData,
    requirements: masterRequirements,
    students: studentDataMap
  };

  // Process in parallel batches
  const batchSize = 10;
  let processed = 0;
  let updated = 0;

  for (let i = 0; i < students.length; i += batchSize) {
    const batch = students.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(student => 
        autoValidateRequirements(designeeID, student.schoolID, cachedData)
      )
    );
    
    processed += batch.length;
    updated += results.filter(r => r).length;
    console.log(`Progress: ${processed}/${students.length} students processed, ${updated} updated`);
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
    const userDataString = localStorage.getItem("userData");
    if (userDataString) {
      const userDataObj = JSON.parse(userDataString);
      office = userDataObj.office;
      currentCategory = userDataObj.category?.toLowerCase();
      currentDepartment = userDataObj.department;
    }

    let students = studentsSnapshot.docs.map(doc => ({ schoolID: doc.id, ...doc.data() }));

    // --- FILTERING LOGIC (matches loadStudents) ---
    if (currentCategory === "39" || currentCategory === "41") {
      students = students.filter(student => student.semester === currentSemesterId);
    } else {
      if (office === "1") {
        students = students.filter(student => currentCategory && 
          student.clubs?.map(c => c.toLowerCase()).includes(currentCategory) && 
          student.semester === currentSemesterId);
      } else if (["2","3","5","6","9","10","12"].includes(office)) {
        students = students.filter(student => student.semester === currentSemesterId);
      } else if (["4","7","11"].includes(office)) {
        students = students.filter(student => currentDepartment && 
          student.department === currentDepartment && 
          student.semester === currentSemesterId);
      } else if (["16","15","14","13","8"].includes(office)) {
        if (!currentCategory) {
          students = [];
        } else {
          const membershipRef = dbInstance.collection("Membership")
            .doc(currentCategory).collection("Members");
          const membershipSnapshot = await membershipRef
            .where("semester", "==", currentSemesterId).get();
          const allowedIDs = membershipSnapshot.docs.map(doc => doc.id);
          students = students.filter(student => allowedIDs.includes(student.schoolID));
        }
      } else {
        students = [];
      }
    }

    // ---------------- OPTIMIZED AUTO-VALIDATION ----------------
    // Run in background without blocking
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
    const hasOfficer = Array.isArray(studentData?.officers) && 
                       studentData.officers.includes(currentDesigneeID);
    const hasViolation = Array.isArray(studentData?.violations) && 
                         studentData.violations.includes(currentDesigneeID);
    const hasIncomplete = Array.isArray(studentData?.incompletes) && 
                          studentData.incompletes.includes(currentDesigneeID);

    // Auto-validate the selected student before rendering modal
    await autoValidateRequirements(currentDesigneeID, studentID);

    const currentSemesterData = await getCurrentSemester();
    if (!currentSemesterData) return;
    const currentSemesterId = currentSemesterData.id;

    const valDocRef = dbInstance
      .collection("Validation")
      .doc(currentDesigneeID)
      .collection(studentID)
      .doc(currentSemesterId);

    const valDoc = await valDocRef.get();
    let requirements = valDoc.exists ? valDoc.data().requirements || [] : [];

    const studentYear = studentData?.yearLevel?.toString().trim().toLowerCase() || "";

    // Filter based on officer/violation/incomplete roles and yearLevel
    requirements = requirements.filter((r) => {
      if (r.officer && !hasOfficer) return false;
      if (r.violation && !hasViolation) return false;
      if (r.incomplete && !hasIncomplete) return false;

      const reqYear = r.yearLevel ? r.yearLevel.toString().trim().toLowerCase() : "all";
      if (reqYear !== "all" && reqYear !== studentYear) return false;

      return true;
    });

    renderRequirementsChecklist(requirements, { autoRun });
  } catch (err) {
    console.error("Error loading validation requirements:", err);
    if (!autoRun) modalBody.innerHTML = "<p>Failed to load requirements.</p>";
  }
};

// -------------------- Render & Save --------------------

function renderRequirementsChecklist(requirements, { autoRun = false } = {}) {
  modalBody.innerHTML = "";
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

    const updatedRequirements = [];
    checkboxes.forEach((checkbox, i) => {
      const span = checkbox.parentElement.querySelector("span");
      const requirementText = span.textContent.replace(/\s*\(checked by .*?\)$/, "");
      const isChecked = checkbox.checked;

      const existingReq = existingRequirements.find(
        (r) => r.requirement?.toLowerCase() === requirementText?.toLowerCase()
      );

      let newCheckedBy = null;
      let newCheckedAt = null;
      const normalizedCurrentUser = currentUserFullName?.trim().toLowerCase() || "";
      const normalizedCheckedBy = existingReq?.checkedBy?.trim().toLowerCase() || "";

      if (isChecked) {
        if (existingReq && existingReq.checkedBy && normalizedCheckedBy !== normalizedCurrentUser) {
          newCheckedBy = existingReq.checkedBy;
          newCheckedAt = existingReq.checkedAt || null;
        } else {
          newCheckedBy = currentUserFullName;
          newCheckedAt = currentTimestamp;
        }
      } else {
        if (existingReq) {
          newCheckedBy = normalizedCheckedBy === normalizedCurrentUser ? null : existingReq.checkedBy || null;
          newCheckedAt = normalizedCheckedBy === normalizedCurrentUser ? null : existingReq.checkedAt || null;
        }
      }

      updatedRequirements[i] = {
        requirement: requirementText,
        status: isChecked,
        checkedBy: newCheckedBy,
        checkedAt: newCheckedAt,
        semester: currentSemesterId,
        yearLevel: existingReq?.yearLevel?.toLowerCase() === "all" ? studentData.yearLevel : existingReq?.yearLevel || "All",
        officer: existingReq?.officer || false,
        violation: existingReq?.violation || false,
        incomplete: existingReq?.incomplete || false,
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