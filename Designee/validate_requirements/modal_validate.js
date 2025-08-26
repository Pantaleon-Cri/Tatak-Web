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

/**
 * Copy the latest ValidateRequirementsTable snapshot
 * into History/{studentID} under semesters[{semesterName}]
 * without overwriting other semesters.
 */
async function copyValidateToHistory(studentID, semesterName) {
  try {
    const validateRef = dbInstance.collection("ValidateRequirementsTable").doc(studentID);
    const validateDoc = await validateRef.get();
    if (!validateDoc.exists) {
      console.warn("[History] No ValidateRequirementsTable doc to copy for:", studentID);
      return;
    }

    const validateData = validateDoc.data() || {};

    // Optional: compute an overall cleared flag to store alongside snapshot
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
          // Full snapshot of validate table at the time of copy
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

  try {
    const currentSemester = await getCurrentSemester();
    const studentYearLevel = await getStudentYearLevel(studentID);

    // Fetch master requirements for this designee
    const reqSnapshot = await dbInstance.collection("RequirementsTable")
      .where("addedByDesigneeId", "==", designeeId)
      .orderBy("createdAt", "desc")
      .get();

    // Apply semester + yearLevel filtering
    const masterRequirements = reqSnapshot.docs
      .map(doc => doc.data())
      .filter(d => !d.semester || d.semester === currentSemester)
      .filter(d => {
        if (!d.yearLevel || d.yearLevel.toLowerCase() === "all") return true;
        return d.yearLevel === studentYearLevel;
      })
      .map(d => ({
        requirement: d.requirement,
        status: false,
        checkedBy: null,
        checkedAt: null,
        semester: currentSemester,
        yearLevel: d.yearLevel || "All"
      }));

    // Load student's existing validated requirements
    const valDocRef = dbInstance.collection("ValidateRequirementsTable").doc(studentID);
    const valDoc = await valDocRef.get();
    let requirementsByOffice = {};
    if (valDoc.exists) {
      requirementsByOffice = valDoc.data().offices || {};
    }

    const savedRequirementsForOffice = Array.isArray(requirementsByOffice[designeeId])
      ? requirementsByOffice[designeeId]
      : [];

    // Merge master (current sem only) and saved (filtering out old semesters)
    const mergedRequirements = masterRequirements.map(masterReq => {
      const savedReq = savedRequirementsForOffice.find(
        r =>
          r.requirement?.toLowerCase() === masterReq.requirement?.toLowerCase() &&
          r.semester === currentSemester
      );
      return savedReq ? { ...masterReq, ...savedReq } : masterReq;
    });

    requirementsByOffice[designeeId] = mergedRequirements;

    // Save merged back into Firestore
    await valDocRef.set({
      offices: requirementsByOffice,
      studentID: studentID
    }, { merge: true });

    console.log(`Auto-validated requirements for student ${studentID}, office ${designeeId}, semester ${currentSemester}, yearLevel ${studentYearLevel}`);

    // ✅ Also copy the entire ValidateRequirementsTable doc into History for this semester
    await copyValidateToHistory(studentID, currentSemester);
  } catch (error) {
    console.error("Error in autoValidateRequirements:", error);
  }
}

// -------------------- Modal Initialization --------------------

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.validateRequirementsData) {
    console.error("window.validateRequirementsData is undefined!");
    return;
  }

  ({ checklistModal, modalBody, cancelBtn, saveBtn, approveBtn } = window.validateRequirementsData);

  // Attach event listeners
  cancelBtn.addEventListener("click", closeModal);
  saveBtn.addEventListener("click", saveRequirements);

  // Allow clicking outside modal to close
  checklistModal.addEventListener("click", (e) => {
    if (e.target === checklistModal) closeModal();
  });

  // ⚡ AUTO VALIDATE ON PAGE LOAD ⚡
  try {
    const currentUser = JSON.parse(localStorage.getItem("userData"));
    if (!currentUser || !currentUser.id) throw new Error("User not logged in");

    dbInstance = firebase.firestore();

    let designeeIdToUse = null;
    if (currentUser.role === "staff") {
      designeeIdToUse = currentUser.createdByDesigneeID || null;
    } else {
      designeeIdToUse = currentUser.id; // if designee directly
    }

    if (!designeeIdToUse) {
      console.warn("No designee ID available for auto-validation");
      return;
    }

    // Fetch all students in ValidateRequirementsTable
    const studentsSnapshot = await dbInstance.collection("ValidateRequirementsTable").get();
    for (const doc of studentsSnapshot.docs) {
      const studentID = doc.id;
      await autoValidateRequirements(designeeIdToUse, studentID);
    }

    console.log("✅ Auto-validation completed for all students on load");
  } catch (err) {
    console.error("Auto-validation failed on load:", err);
  }
});

// -------------------- Modal Actions --------------------

// Open modal and load requirements for a given student and designee
window.openRequirementsModal = async function(studentID, designeeUserID, db) {
  currentStudentID = studentID;
  dbInstance = db;

  if (!modalBody || !checklistModal) {
    console.error("Modal elements are not initialized yet.");
    return;
  }

  modalBody.innerHTML = "<p>Loading requirements...</p>";
  checklistModal.classList.add("active");

  try {
    const currentUser = JSON.parse(localStorage.getItem("userData"));
    if (!currentUser || !currentUser.id) throw new Error("User not logged in");

    let linkedDesigneeId = null;
    if (currentUser.role === "staff") {
      linkedDesigneeId = currentUser.createdByDesigneeID || null;
      if (!linkedDesigneeId) {
        modalBody.innerHTML = "<p>No requirements assigned to you.</p>";
        return;
      }
    }

    currentDesigneeUserID = (currentUser.role === "staff") ? linkedDesigneeId : designeeUserID;

    // Run validation once before showing
    await autoValidateRequirements(currentDesigneeUserID, studentID);

    // Now load for modal
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

// Render checklist in modal body
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
        <span>${req.requirement}${checkerText}</span>
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

// Close modal
function closeModal() {
  checklistModal.classList.remove("active");
}

// Save checked statuses back to Firestore
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
        semester: currentSemester
      };
    }

    requirementsByOffice[currentDesigneeUserID] = updatedRequirements;

    await valDocRef.set({
      offices: requirementsByOffice,
      studentID: currentStudentID
    }, { merge: true });

    // ✅ Also refresh History after manual save so it stays in sync
    await copyValidateToHistory(currentStudentID, currentSemester);

    alert("Requirements saved successfully!");
    closeModal();
  } catch (error) {
    console.error("Failed to save requirements:", error);
    alert("Failed to save. Please try again.");
  }
}
