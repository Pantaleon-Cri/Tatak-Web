// validate_modal.js

// Declare modal element variables but do NOT destructure immediately
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
    if (e.target === checklistModal) {
      closeModal();
    }
  });
});

// Open modal and load requirements for given student and designee (office)
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
    if (!currentUser || !currentUser.id) {
      throw new Error("User not logged in");
    }
    const currentUserId = currentUser.id;

    let linkedDesigneeId = null;

    if (currentUser.role === "staff") {
      // Query staffTable by 'id' field since doc ID differs from staff ID
      const staffQuery = await dbInstance.collection("staffTable")
        .where("id", "==", currentUserId)
        .limit(1)
        .get();

      if (!staffQuery.empty) {
        const staffDoc = staffQuery.docs[0];
        linkedDesigneeId = staffDoc.data().createdByDesigneeID || null;
        console.log("linkedDesigneeId for staff (createdByDesigneeID):", linkedDesigneeId);
      }
    }

    // For staff users, override currentDesigneeUserID with linkedDesigneeId
    currentDesigneeUserID = (currentUser.role === "staff" && linkedDesigneeId) ? linkedDesigneeId : designeeUserID;

    // Prepare queries to fetch requirements
    const queries = [];

    // Always fetch requirements added by current user (staff or designee)
    queries.push(dbInstance.collection("RequirementsTable").where("addedBy", "==", currentUserId).get());

    // Fetch requirements added by the designee (using the shared designee ID)
    queries.push(dbInstance.collection("RequirementsTable").where("addedByDesigneeId", "==", currentDesigneeUserID).get());

    const snapshots = await Promise.all(queries);

    // Combine unique requirements by requirement text
    const combinedRequirementsMap = new Map();

    snapshots.forEach(snapshot => {
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.requirement) {
          combinedRequirementsMap.set(data.requirement, {
            requirement: data.requirement,
            status: false,
            checkedBy: null,  // default no one checked yet
            checkedAt: null   // default no timestamp
          });
        }
      });
    });

    const masterRequirements = Array.from(combinedRequirementsMap.values());

    // Load saved validation for this student
    const valDocRef = dbInstance.collection("ValidateRequirementsTable").doc(studentID);
    const valDoc = await valDocRef.get();

    let requirementsByOffice = {};
    if (valDoc.exists) {
      const savedData = valDoc.data();
      requirementsByOffice = savedData.offices || {};
    }

    // Get saved requirements for current designeeUserID office (shared key)
    const savedRequirementsForOffice = Array.isArray(requirementsByOffice[currentDesigneeUserID])
      ? requirementsByOffice[currentDesigneeUserID]
      : [];

    // Merge saved statuses with master list including checkedBy and timestamp
    const mergedRequirements = masterRequirements.map(masterReq => {
      const savedReq = savedRequirementsForOffice.find(r => r.requirement === masterReq.requirement);
      return savedReq 
        ? { ...masterReq, status: savedReq.status, checkedBy: savedReq.checkedBy || null, checkedAt: savedReq.checkedAt || null } 
        : masterReq;
    });

    // Update saved requirements in the offices map
    requirementsByOffice[currentDesigneeUserID] = mergedRequirements;

    // Save back merged requirements (keep studentID for reference)
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

// Render checklist in modal body with label wrapper and add checkbox change listener
function renderRequirementsChecklist(requirements) {
  modalBody.innerHTML = "";
  requirements.forEach((req, i) => {
    const checkedClass = req.status ? "checked" : "";
    const checkedAttr = req.status ? "checked" : "";

    // Display who checked (full name stored in checkedBy) and timestamp
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

  // Add change listeners to toggle .checked class on label when checkbox changes
  modalBody.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener("change", () => {
      const label = checkbox.closest('label.checkbox-item');
      if (checkbox.checked) {
        label.classList.add('checked');
      } else {
        label.classList.remove('checked');
      }
    });
  });
}

// Close modal function
function closeModal() {
  checklistModal.classList.remove("active");
}

// Save button handler to save checked statuses back to Firestore
async function saveRequirements() {
  const checkboxes = modalBody.querySelectorAll("input[type='checkbox']");
  const updatedRequirements = [];

  const currentUser = JSON.parse(localStorage.getItem("userData"));
  const currentUserId = currentUser?.id || null;
  const currentUserFullName = getCurrentUserFullName();
  const currentTimestamp = new Date().toISOString();

  console.log("Saving requirements as user:", currentUserFullName);

  try {
    const valDocRef = dbInstance.collection("ValidateRequirementsTable").doc(currentStudentID);

    // Fetch current data to avoid overwriting other offices' requirements
    const valDoc = await valDocRef.get();
    let requirementsByOffice = {};
    if (valDoc.exists) {
      const savedData = valDoc.data();
      requirementsByOffice = savedData.offices || {};
    }

    const existingRequirements = Array.isArray(requirementsByOffice[currentDesigneeUserID])
      ? requirementsByOffice[currentDesigneeUserID]
      : [];

    for (const checkbox of checkboxes) {
      const index = parseInt(checkbox.getAttribute("data-index"));

      // Use more reliable method to get requirement text from span sibling
      const span = checkbox.parentElement.querySelector("span");
      let requirementText = span.textContent.replace(/\s*\(checked by .*?\)$/, "");

      const isChecked = checkbox.checked;

      // Find existing saved requirement ignoring case
      const existingReq = existingRequirements.find(r => r.requirement.toLowerCase() === requirementText.toLowerCase());

      // Normalize strings for comparison with safety checks
      const normalizedCurrentUser = currentUserFullName?.trim().toLowerCase() || "";
      const normalizedCheckedBy = existingReq?.checkedBy?.trim().toLowerCase() || "";

      let newCheckedBy = null;
      let newCheckedAt = null;

      if (isChecked) {
        if (existingReq && existingReq.checkedBy && normalizedCheckedBy !== normalizedCurrentUser) {
          // Someone else checked it, keep their name and timestamp
          newCheckedBy = existingReq.checkedBy;
          newCheckedAt = existingReq.checkedAt || null;
        } else {
          // Current user checked it
          newCheckedBy = currentUserFullName;
          newCheckedAt = currentTimestamp;
        }
      } else {
        // Unchecked checkbox
        if (existingReq) {
          // Clear checkedBy and timestamp only if the current user was the one who checked it
          if (normalizedCheckedBy === normalizedCurrentUser) {
            newCheckedBy = null;
            newCheckedAt = null;
          } else {
            // Otherwise, keep the other user's checkedBy and timestamp intact
            newCheckedBy = existingReq.checkedBy || null;
            newCheckedAt = existingReq.checkedAt || null;
          }
        } else {
          newCheckedBy = null;
          newCheckedAt = null;
        }
      }

      updatedRequirements[index] = {
        requirement: requirementText,
        status: isChecked,
        checkedBy: newCheckedBy,
        checkedAt: newCheckedAt
      };
    }

    // Update only this office's requirements using shared designee ID key
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
