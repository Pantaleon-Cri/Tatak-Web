let currentEditingId = null;
let currentEditingInput = null;
let yearLevelOptions = []; // store year level options globally
const roleOptions = ["None", "Violation", "Officer"]; // dropdown for role

function showModal(modal) { modal.style.display = "flex"; }
function closeModal(modal) { modal.style.display = "none"; }

// 🔹 Fetch yearLevel options once from Firestore
async function loadYearLevelOptions() {
  try {
    const snapshot = await db.collection("yearLevelTable").get();
    yearLevelOptions = snapshot.docs.map(doc => doc.data().yearLevel).filter(Boolean);

    // Always include "All" as the first option
    if (!yearLevelOptions.includes("All")) yearLevelOptions.unshift("All");

    console.log("Loaded year levels:", yearLevelOptions);
  } catch (err) {
    console.error("Failed to load yearLevel options:", err);
  }
}

function addRequirementToUI(requirementText, docId, semester, yearLevel, roleField) {
  const list = document.getElementById("requirementsList");
  if (list.querySelector(`[data-id="${docId}"]`)) return; // prevent duplicates

  const row = document.createElement("div");
  row.classList.add("item-row");
  if (docId) row.setAttribute("data-id", docId);

  // YearLevel dropdown
  const yearLevelDropdownHtml = `
    <select class="yearlevel-dropdown">
      ${yearLevelOptions.map(opt => `<option value="${opt}" ${opt === (yearLevel || "All") ? "selected" : ""}>${opt}</option>`).join("")}
    </select>
  `;

  // Role dropdown
  const roleDropdownHtml = `
    <select class="role-dropdown">
      ${roleOptions.map(opt => {
        if (opt === "None" && !roleField) return `<option value="None" selected>None</option>`;
        if (opt === "Violation" && roleField?.violation) return `<option value="Violation" selected>Violation</option>`;
        if (opt === "Officer" && roleField?.officer) return `<option value="Officer" selected>Officer</option>`;
        return `<option value="${opt}">${opt}</option>`;
      }).join("")}
    </select>
  `;

  row.innerHTML = `
    <input type="text" value="${requirementText}" readonly>
    <div class="item-actions">
      ${yearLevelDropdownHtml}
      ${roleDropdownHtml}
      <button class="edit-item-btn"><i class="fas fa-edit"></i></button>
      <button class="delete-item-btn"><i class="fas fa-trash-alt"></i></button>
    </div>
  `;

  list.prepend(row);

  const yearDropdown = row.querySelector(".yearlevel-dropdown");
  const roleDropdown = row.querySelector(".role-dropdown");

  // 🔹 YearLevel change
  yearDropdown.addEventListener("change", async (e) => {
    const newYearLevel = e.target.value;
    try {
      await db.collection("RequirementsTable").doc(docId).update({ yearLevel: newYearLevel });
      console.log(`Year level updated for ${docId}: ${newYearLevel}`);
    } catch (err) {
      console.error("Failed to update year level:", err);
      alert("Failed to update year level.");
    }
  });

  // 🔹 Role change (updated for array logic)
  roleDropdown.addEventListener("change", async (e) => {
    const selectedRole = e.target.value;
    try {
      const userData = JSON.parse(localStorage.getItem("userData")) || {};
      const violationId = userData.role === "designee" ? userData.id : userData.createdByDesigneeID || null;
      const officerId = userData.id || null;

      let updateData = {};

      if (selectedRole === "Violation") {
        updateData.violation = violationId ? [violationId] : [];
        updateData.officer = firebase.firestore.FieldValue.delete();
      } else if (selectedRole === "Officer") {
        updateData.officer = officerId ? [officerId] : [];
        updateData.violation = firebase.firestore.FieldValue.delete();
      } else {
        updateData.officer = firebase.firestore.FieldValue.delete();
        updateData.violation = firebase.firestore.FieldValue.delete();
      }

      await db.collection("RequirementsTable").doc(docId).update(updateData);
      console.log(`Requirement role updated for ${docId}:`, updateData);
    } catch (err) {
      console.error("Failed to update requirement role:", err);
      alert("Failed to update requirement role.");
    }
  });

  // 🔹 Edit button
  row.querySelector(".edit-item-btn").addEventListener("click", () => {
    currentEditingId = docId;
    currentEditingInput = row.querySelector("input");
    document.getElementById("editRequirementInput").value = currentEditingInput.value;
    showModal(document.getElementById("editModal"));
  });

  // 🔹 Delete button
  row.querySelector(".delete-item-btn").addEventListener("click", () => {
    currentEditingId = docId;
    showModal(document.getElementById("deleteModal"));
  });
}

// 🔹 Load requirements
async function loadRequirements() {
  try {
    const userData = JSON.parse(localStorage.getItem("userData"));
    if (!userData) throw new Error("User data not found in localStorage.");

    document.getElementById("requirementsList").innerHTML = "";

    // Fetch current semester
    const semSnap = await db.collection("semesterTable").where("currentSemester", "==", true).get();
    let currentSemester = "N/A";
    if (!semSnap.empty) currentSemester = semSnap.docs[0].data().semester || "N/A";

    let query = db.collection("RequirementsTable");
    if (userData.role === "designee") query = query.where("addedByDesigneeId", "==", userData.id);
    else if (userData.role === "staff") query = query.where("addedByDesigneeId", "==", userData.createdByDesigneeID);
    else return;

    const snapshot = await query.orderBy("createdAt", "desc").get();
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.semester === currentSemester) {
        addRequirementToUI(data.requirement, doc.id, data.semester, data.yearLevel || "All", {
          violation: Array.isArray(data.violation) && data.violation.length > 0,
          officer: Array.isArray(data.officer) && data.officer.length > 0
        });
      }
    });
  } catch (err) {
    console.error("Failed to load requirements:", err);
    alert("Failed to load requirements.");
  }
}

// 🔹 Add new requirement
async function addRequirement(requirementText) {
  try {
    const userData = JSON.parse(localStorage.getItem("userData"));
    if (!userData) throw new Error("User data not found.");

    const semSnap = await db.collection("semesterTable").where("currentSemester", "==", true).get();
    let currentSemester = "N/A";
    if (!semSnap.empty) currentSemester = semSnap.docs[0].data().semester || "N/A";

    const defaultYearLevel = "All";

    const docRef = await db.collection("RequirementsTable").add({
      requirement: requirementText,
      addedBy: userData.id,
      addedByRole: userData.role,
      addedByDesigneeId: userData.role === "designee" ? userData.id : userData.createdByDesigneeID,
      office: userData.office || "N/A",
      category: userData.category || "N/A",
      department: userData.department || "N/A",
      semester: currentSemester,
      yearLevel: defaultYearLevel,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    addRequirementToUI(requirementText, docRef.id, currentSemester, defaultYearLevel, null);
  } catch (err) {
    console.error("Failed to add requirement:", err);
    alert("Failed to add requirement.");
  }
}

// 🔹 Save edited requirement
async function saveEditedRequirement(newText) {
  try {
    await db.collection("RequirementsTable").doc(currentEditingId).update({ requirement: newText });
    currentEditingInput.value = newText;
    closeModal(document.getElementById("editModal"));
    alert("Requirement updated.");
  } catch (err) {
    console.error("Failed to update requirement:", err);
    alert("Failed to update.");
  }
}

// 🔹 Delete requirement
async function deleteRequirement() {
  try {
    await db.collection("RequirementsTable").doc(currentEditingId).delete();
    document.querySelector(`[data-id="${currentEditingId}"]`)?.remove();
    closeModal(document.getElementById("deleteModal"));
    alert("Requirement deleted.");
  } catch (err) {
    console.error("Failed to delete requirement:", err);
    alert("Failed to delete.");
  }
}

// 🔹 On page load
document.addEventListener("DOMContentLoaded", async () => {
  await loadYearLevelOptions();
  await loadRequirements();
});
