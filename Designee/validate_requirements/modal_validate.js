// validate_modal.js

// Declare modal element variables
let checklistModal, modalBody, cancelBtn, saveBtn, approveBtn;

let currentStudentID = null;
let currentDesigneeUserID = null;
let dbInstance = null;

// Helper: get current user's full name from localStorage or fallback to ID
function getCurrentUserFullName() {
  const currentUser = JSON.parse(localStorage.getItem("userData"));
  if (!currentUser) return null;
  const firstName = currentUser.firstName || "";
  const lastName = currentUser.lastName || "";
  const fullName = (firstName + " " + lastName).trim();
  return fullName || currentUser.id || null;
}

// Wait for DOMContentLoaded and presence of window.validateRequirementsData
document.addEventListener("DOMContentLoaded", () => {
  if (!window.validateRequirementsData) {
    console.error("window.validateRequirementsData is undefined!");
    return;
  }
  ({ checklistModal, modalBody, cancelBtn, saveBtn, approveBtn } = window.validateRequirementsData);

  // Attach event listeners
  cancelBtn.addEventListener("click", closeModal);
  saveBtn.addEventListener("click", saveRequirements);

  checklistModal.addEventListener("click", (e) => {
    if (e.target === checklistModal) closeModal();
  });
});

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
      // Staff should always use createdByDesigneeID from localStorage
      linkedDesigneeId = currentUser.createdByDesigneeID || null;
      if (!linkedDesigneeId) {
        modalBody.innerHTML = "<p>No requirements assigned to you.</p>";
        return;
      }
    }

    // Set currentDesigneeUserID based on role
    currentDesigneeUserID = (currentUser.role === "staff") ? linkedDesigneeId : designeeUserID;

    // Fetch requirements only from the correct designee
    const snapshot = await dbInstance.collection("RequirementsTable")
      .where("addedByDesigneeId", "==", currentDesigneeUserID)
      .orderBy("createdAt", "desc")
      .get();

    if (snapshot.empty) {
      modalBody.innerHTML = "<p>No requirements found.</p>";
      return;
    }

    // Prepare master requirement list
    const masterRequirements = snapshot.docs.map(doc => ({
      requirement: doc.data().requirement,
      status: false,
      checkedBy: null,
      checkedAt: null
    }));

    // Load saved validation for this student
    const valDocRef = dbInstance.collection("ValidateRequirementsTable").doc(studentID);
    const valDoc = await valDocRef.get();
    let requirementsByOffice = {};
    if (valDoc.exists) {
      const savedData = valDoc.data();
      requirementsByOffice = savedData.offices || {};
    }

    const savedRequirementsForOffice = Array.isArray(requirementsByOffice[currentDesigneeUserID])
      ? requirementsByOffice[currentDesigneeUserID]
      : [];

    const mergedRequirements = masterRequirements.map(masterReq => {
      const savedReq = savedRequirementsForOffice.find(r => r.requirement === masterReq.requirement);
      return savedReq
        ? { ...masterReq, status: savedReq.status, checkedBy: savedReq.checkedBy || null, checkedAt: savedReq.checkedAt || null }
        : masterReq;
    });

    requirementsByOffice[currentDesigneeUserID] = mergedRequirements;

    await valDocRef.set({
      offices: requirementsByOffice,
      studentID: studentID
    }, { merge: true });

    renderRequirementsChecklist(mergedRequirements);

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

  const currentUser = JSON.parse(localStorage.getItem("userData"));
  const currentUserId = currentUser?.id || null;
  const currentUserFullName = getCurrentUserFullName();
  const currentTimestamp = new Date().toISOString();

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

      const existingReq = existingRequirements.find(r => r.requirement.toLowerCase() === requirementText.toLowerCase());
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
        checkedAt: newCheckedAt
      };
    }

    requirementsByOffice[currentDesigneeUserID] = updatedRequirements;

    await valDocRef.set({
      offices: requirementsByOffice,
      studentID: currentStudentID
    }, { merge: true });

    alert("Requirements saved successfully!");
    closeModal();
  } catch (error) {
    console.error("Failed to save requirements:", error);
    alert("Failed to save. Please try again.");
  }
}
