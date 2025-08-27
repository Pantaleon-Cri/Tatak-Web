// ================= validate_modal.js =================

// Declare modal element variables
let checklistModal, modalBody, cancelBtn, saveBtn, approveBtn;

let currentStudentID = null;
let currentDesigneeUserID = null;
let dbInstance = null;
let unsubscribeRequirementsListener = null;

// -------------------- Helper Functions --------------------

// Get current user's full name from localStorage or fallback to ID
function getCurrentUserFullName() {
  const currentUser = JSON.parse(localStorage.getItem("userData"));
  if (!currentUser) return null;

  const firstName = currentUser.firstName || "";
  const lastName = currentUser.lastName || "";
  const fullName = (firstName + " " + lastName).trim();

  return fullName || currentUser.id || null;
}

// Fetch current semester from semesterTable
async function getCurrentSemester() {
  if (!dbInstance) return null;
  const snapshot = await dbInstance.collection("semesterTable")
    .where("currentSemester", "==", true)
    .get();

  if (!snapshot.empty) {
    const semDoc = snapshot.docs[0].data();
    return semDoc.semester || null;
  }
  return null;
}

// Fetch student's year level
async function getStudentYearLevel(studentID) {
  if (!dbInstance) return null;
  const studentDoc = await dbInstance.collection("Students").doc(studentID).get();
  if (studentDoc.exists) {
    const data = studentDoc.data();
    return data.yearLevel || null;
  }
  return null;
}

// Fetch student officer status
async function isStudentOfficer(studentID) {
  if (!dbInstance) return false;
  const studentDoc = await dbInstance.collection("Students").doc(studentID).get();
  if (studentDoc.exists) {
    const data = studentDoc.data();
    return Array.isArray(data.officer) && data.officer.length > 0; // officer is now array
  }
  return false;
}

/**
 * Copy the latest ValidateRequirementsTable snapshot
 * into History/{studentID} under semesters[{semesterName}]
 * without overwriting other semesters.
 */
async function copyValidateToHistory(studentID, semesterName) {
  try {
    const validateRef = dbInstance.collection("ValidateRequirementsTable").doc(studentID);
    const validateDoc = await validateRef.get();
    if (!validateDoc.exists) return;

    const validateData = validateDoc.data() || {};
    let overallCleared = true;
    const offices = validateData.offices || {};
    Object.values(offices).forEach(arr => {
      if (Array.isArray(arr)) {
        arr.forEach(item => {
          if (!item?.status) overallCleared = false;
        });
      }
    });

    const historyRef = dbInstance.collection("History").doc(studentID);
    await historyRef.set({
      studentID,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
      semesters: {
        [semesterName]: {
          snapshot: validateData,
          overallStatus: overallCleared ? "Cleared" : "Pending",
          snapshotAt: firebase.firestore.FieldValue.serverTimestamp()
        }
      }
    }, { merge: true });

    console.log(`[History] Saved snapshot for ${studentID} @ ${semesterName}`);
  } catch (err) {
    console.error("[History] Failed to copy to History:", err);
  }
}

// -------------------- Firestore Sync --------------------

// Auto-sync requirements for a student+designee
async function autoValidateRequirements(designeeId, studentID) {
  if (!dbInstance) return;
  if (!designeeId || designeeId === "undefined") return;

  try {
    const currentSemester = await getCurrentSemester();
    const studentYearLevel = await getStudentYearLevel(studentID);

    // 🔹 Fetch student data
    const studentDoc = await dbInstance.collection("Students").doc(studentID).get();
    const studentData = studentDoc.exists ? studentDoc.data() : {};
    const studentOfficerRoles = Array.isArray(studentData.officer) ? studentData.officer : [];
    const studentViolations = Array.isArray(studentData.violation) ? studentData.violation : [];

    // 🔹 Fetch all requirements for this designee
    const reqSnapshot = await dbInstance.collection("RequirementsTable")
      .where("addedByDesigneeId", "==", designeeId)
      .orderBy("createdAt", "desc")
      .get();

    // 🔹 Map and filter requirements according to semester, yearLevel, officer, violation
    const masterRequirements = reqSnapshot.docs
      .map(doc => doc.data())
      .filter(d => !d.semester || d.semester === currentSemester)
      .filter(d => {
        const violationMatches =
          Array.isArray(d.violation) && d.violation.some(v => studentViolations.includes(v));

        const isOfficerRequirement = Array.isArray(d.officer) && d.officer.length > 0;
        const officerMatches =
          isOfficerRequirement &&
          studentOfficerRoles.some(role => d.officer.includes(role));

        const yearLevelMatches =
          d.yearLevel &&
          d.yearLevel.toLowerCase() !== "all" &&
          d.yearLevel === studentYearLevel;

        const allYearLevel = d.yearLevel && d.yearLevel.toLowerCase() === "all";

        // ✅ Include if:
        // 1. Officer requirement AND student is in that officer list
        if (officerMatches) return true;

        // 2. Violation requirement matches student
        if (violationMatches) return true;

        // 3. Year level requirement (not officer-specific or violation-specific)
        if (
          yearLevelMatches &&
          !isOfficerRequirement &&
          (!d.violation || d.violation.length === 0)
        )
          return true;

        // 4. "All" year level requirement (not officer-specific or violation-specific)
        if (
          allYearLevel &&
          !isOfficerRequirement &&
          (!d.violation || d.violation.length === 0)
        )
          return true;

        return false;
      })
      .map(d => ({
        requirement: d.requirement,
        status: false,
        checkedBy: null, // string/null
        checkedAt: null,
        semester: currentSemester,
        yearLevel: d.yearLevel || "All",
        violation: Array.isArray(d.violation) ? d.violation : [],
        officer: Array.isArray(d.officer) ? d.officer : [] // officer always as array
      }));

    // 🔹 Merge with saved requirements
    const valDocRef = dbInstance.collection("ValidateRequirementsTable").doc(studentID);
    const valDoc = await valDocRef.get();
    let requirementsByOffice = {};
    if (valDoc.exists) requirementsByOffice = valDoc.data().offices || {};

    const savedRequirementsForOffice = Array.isArray(requirementsByOffice[designeeId])
      ? requirementsByOffice[designeeId]
      : [];

    const mergedRequirements = masterRequirements.map(masterReq => {
      const savedReq = savedRequirementsForOffice.find(
        r =>
          r.requirement?.toLowerCase() === masterReq.requirement?.toLowerCase() &&
          r.semester === currentSemester
      );
      return savedReq ? { ...masterReq, ...savedReq } : masterReq;
    });

    requirementsByOffice[designeeId] = mergedRequirements;

    await valDocRef.set(
      {
        offices: requirementsByOffice,
        studentID: studentID
      },
      { merge: true }
    );

    await copyValidateToHistory(studentID, currentSemester);

    console.log(
      `Auto-validated requirements for student ${studentID}, office ${designeeId}, semester ${currentSemester}`
    );
  } catch (error) {
    console.error("Error in autoValidateRequirements:", error);
  }
}



// -------------------- Modal Initialization --------------------

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.validateRequirementsData) return;

  ({ checklistModal, modalBody, cancelBtn, saveBtn, approveBtn } = window.validateRequirementsData);

  cancelBtn.addEventListener("click", closeModal);
  saveBtn.addEventListener("click", saveRequirements);

  checklistModal.addEventListener("click", (e) => {
    if (e.target === checklistModal) closeModal();
  });

  try {
    const currentUser = JSON.parse(localStorage.getItem("userData"));
    if (!currentUser || !currentUser.id) throw new Error("User not logged in");

    dbInstance = firebase.firestore();

    let designeeIdToUse = currentUser.role === "staff"
      ? (currentUser.createdByDesigneeID && currentUser.createdByDesigneeID !== "undefined" ? currentUser.createdByDesigneeID : null)
      : currentUser.role === "designee" ? currentUser.id : null;

    if (!designeeIdToUse) return;

   const studentsSnapshot = await dbInstance.collection("Students").get();
for (const doc of studentsSnapshot.docs) {
  await autoValidateRequirements(designeeIdToUse, doc.id);
}

  } catch (err) {
    console.error("Auto-validation failed on load:", err);
  }
});

// -------------------- Modal Actions --------------------

window.openRequirementsModal = async function(studentID, designeeUserID, db) {
  currentStudentID = studentID;
  dbInstance = db;

  if (!modalBody || !checklistModal) return;

  modalBody.innerHTML = "<p>Loading requirements...</p>";
  checklistModal.classList.add("active");

  try {
    const currentUser = JSON.parse(localStorage.getItem("userData"));
    if (!currentUser || !currentUser.id) throw new Error("User not logged in");

    let linkedDesigneeId = currentUser.role === "staff"
      ? (currentUser.createdByDesigneeID && currentUser.createdByDesigneeID !== "undefined" ? currentUser.createdByDesigneeID : null)
      : currentUser.role === "designee" ? currentUser.id : designeeUserID;

    if (!linkedDesigneeId) {
      modalBody.innerHTML = "<p>No requirements assigned to you.</p>";
      return;
    }

    currentDesigneeUserID = linkedDesigneeId;

    await autoValidateRequirements(currentDesigneeUserID, studentID);

    const valDocRef = dbInstance.collection("ValidateRequirementsTable").doc(studentID);
    const valDoc = await valDocRef.get();
    const data = valDoc.data();
    const requirements = data?.offices?.[currentDesigneeUserID] || [];
    renderRequirementsChecklist(requirements);

  } catch (error) {
    console.error("Error loading validation requirements:", error);
    modalBody.innerHTML = "<p>Failed to load requirements.</p>";
  }
};

// -------------------- Render & Save --------------------

function renderRequirementsChecklist(requirements) {
  modalBody.innerHTML = "";

  requirements.forEach((req, i) => {
    const checkedClass = req.status ? "checked" : "";
    const checkedAttr = req.status ? "checked" : "";
    const checkerText = req.checkedBy
      ? ` (checked by ${req.checkedBy}${req.checkedAt ? " at " + new Date(req.checkedAt).toLocaleString() : ""})`
      : "";

    modalBody.insertAdjacentHTML("beforeend", `
      <label class="checkbox-item ${checkedClass}">
        <input type="checkbox" data-index="${i}" ${checkedAttr}>
        <i class="fa-solid fa-check-square checkbox-icon"></i>
        <span>${req.requirement || ""}${checkerText}</span>
      </label>
    `);
  });

  modalBody.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener("change", () => {
      const label = checkbox.closest('label.checkbox-item');
      if (checkbox.checked) label.classList.add('checked');
      else label.classList.remove('checked');
    });
  });
}

function closeModal() {
  checklistModal.classList.remove("active");
}

async function saveRequirements() {
  const checkboxes = modalBody.querySelectorAll("input[type='checkbox']");
  const updatedRequirements = [];

  const currentUserFullName = getCurrentUserFullName();
  const currentTimestamp = new Date().toISOString();
  const currentSemester = await getCurrentSemester();

  try {
    const valDocRef = dbInstance.collection("ValidateRequirementsTable").doc(currentStudentID);
    const valDoc = await valDocRef.get();
    let requirementsByOffice = {};
    if (valDoc.exists) requirementsByOffice = valDoc.data().offices || {};

    const existingRequirements = Array.isArray(requirementsByOffice[currentDesigneeUserID])
      ? requirementsByOffice[currentDesigneeUserID]
      : [];

    for (const checkbox of checkboxes) {
      const index = parseInt(checkbox.getAttribute("data-index"));
      const span = checkbox.parentElement.querySelector("span");
      let requirementText = span.textContent.replace(/\s*\(checked by .*?\)$/, "");
      const isChecked = checkbox.checked;

      const existingReq = existingRequirements.find(
        r => r.requirement?.toLowerCase() === requirementText?.toLowerCase() && r.semester === currentSemester
      );

      const normalizedCurrentUser = currentUserFullName?.trim().toLowerCase() || "";
      const normalizedCheckedBy = existingReq?.checkedBy?.trim().toLowerCase() || "";

      let newCheckedBy = null;
      let newCheckedAt = null;

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
          newCheckedBy = (normalizedCheckedBy === normalizedCurrentUser) ? null : existingReq.checkedBy || null;
          newCheckedAt = (normalizedCheckedBy === normalizedCurrentUser) ? null : existingReq.checkedAt || null;
        }
      }

      updatedRequirements[index] = {
        requirement: requirementText,
        status: isChecked,
        checkedBy: newCheckedBy,
        checkedAt: newCheckedAt,
        semester: currentSemester,
        yearLevel: existingReq?.yearLevel || "All",
        violation: Array.isArray(existingReq?.violation) ? existingReq.violation : [],
        officer: Array.isArray(existingReq?.officer) ? existingReq.officer : []  // now array
      };
    }

    requirementsByOffice[currentDesigneeUserID] = updatedRequirements;

    await valDocRef.set({
      offices: requirementsByOffice,
      studentID: currentStudentID
    }, { merge: true });

    await copyValidateToHistory(currentStudentID, currentSemester);

    alert("Requirements saved successfully!");
    closeModal();
  } catch (error) {
    console.error("Failed to save requirements:", error);
    alert("Failed to save. Please try again.");
  }
}
