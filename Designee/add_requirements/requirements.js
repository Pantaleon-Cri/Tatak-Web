let currentEditingId = null;
let currentEditingInput = null;
let yearLevelOptions = []; // store dropdown options globally

function showModal(modal) { modal.style.display = "flex"; }
function closeModal(modal) { modal.style.display = "none"; }

// 🔹 Fetch yearLevel options once from Firestore
async function loadYearLevelOptions() {
  try {
    const snapshot = await db.collection("yearLevelTable").get();
    yearLevelOptions = snapshot.docs.map(doc => doc.data().yearLevel).filter(Boolean);

    // Always include "All" as the first option
    if (!yearLevelOptions.includes("All")) {
      yearLevelOptions.unshift("All");
    }

    console.log("Loaded year levels:", yearLevelOptions);
  } catch (err) {
    console.error("Failed to load yearLevel options:", err);
  }
}

function addRequirementToUI(requirementText, docId, semester, yearLevel) {
  const list = document.getElementById("requirementsList");

  // ✅ Prevent duplicates by checking if row already exists
  if (list.querySelector(`[data-id="${docId}"]`)) return;

  const row = document.createElement("div");
  row.classList.add("item-row");
  if (docId) row.setAttribute("data-id", docId);

  // Build dropdown HTML from yearLevelOptions
  const dropdownHtml = `
    <select class="yearlevel-dropdown">
      ${yearLevelOptions.map(opt => 
        `<option value="${opt}" ${opt === (yearLevel || "All") ? "selected" : ""}>${opt}</option>`
      ).join("")}
    </select>
  `;

  row.innerHTML = `
    <input type="text" value="${requirementText}" readonly>
    
    <div class="item-actions">
      ${dropdownHtml}
      <button class="edit-item-btn"><i class="fas fa-edit"></i></button>
      <button class="delete-item-btn"><i class="fas fa-trash-alt"></i></button>
    </div>
  `;
  list.prepend(row);

  // Dropdown change event -> update Firestore
  row.querySelector(".yearlevel-dropdown").addEventListener("change", async (e) => {
    const newYearLevel = e.target.value;
    try {
      await db.collection("RequirementsTable").doc(docId).update({ yearLevel: newYearLevel });
      console.log(`Year level updated to ${newYearLevel} for ${docId}`);
    } catch (err) {
      console.error("Failed to update year level:", err);
      alert("Failed to update year level.");
    }
  });

  // Edit button
  row.querySelector(".edit-item-btn").addEventListener("click", () => {
    currentEditingId = docId;
    currentEditingInput = row.querySelector("input");
    document.getElementById("editRequirementInput").value = currentEditingInput.value;
    showModal(document.getElementById("editModal"));
  });

  // Delete button
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

    console.log("Loading requirements for user:", userData.id, "role:", userData.role);
    console.log("CreatedByDesigneeID:", userData.createdByDesigneeID);

    // ✅ Clear list first to avoid duplicates
    document.getElementById("requirementsList").innerHTML = "";

    // Fetch current semester
    const semSnap = await db.collection("semesterTable").where("currentSemester", "==", true).get();
    let currentSemester = "N/A";
    if (!semSnap.empty) {
      currentSemester = semSnap.docs[0].data().semester || "N/A";
    }

    let query = db.collection("RequirementsTable");

    if (userData.role === "designee") {
      query = query.where("addedByDesigneeId", "==", userData.id);
    } else if (userData.role === "staff") {
      query = query.where("addedByDesigneeId", "==", userData.createdByDesigneeID);
    } else {
      console.warn("Unknown role, loading no requirements.");
      return;
    }

    const snapshot = await query.orderBy("createdAt", "desc").get();

    if (snapshot.empty) {
      console.log("No requirements found for this user/group.");
    }

    // Only add requirements matching the current semester
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.semester === currentSemester) {
        addRequirementToUI(data.requirement, doc.id, data.semester, data.yearLevel || "All");
      }
    });

  } catch (err) {
    console.error("Failed to load requirements:", err);
    alert("Failed to load requirements.");
  }
}

// 🔹 Add new requirement with yearLevel field
async function addRequirement(requirementText) {
  try {
    const userData = JSON.parse(localStorage.getItem("userData"));
    if (!userData) throw new Error("User data not found.");

    // Fetch current semester
    const semSnap = await db.collection("semesterTable").where("currentSemester", "==", true).get();
    let currentSemester = "N/A";
    if (!semSnap.empty) {
      currentSemester = semSnap.docs[0].data().semester || "N/A";
    }

    // ✅ Default yearLevel is always "All"
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

    addRequirementToUI(requirementText, docRef.id, currentSemester, defaultYearLevel);
  } catch (err) {
    console.error("Failed to add requirement:", err);
    alert("Failed to add requirement.");
  }
}

// 🔹 Save edited requirement text
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
  await loadYearLevelOptions(); // fetch dropdown options first
  await loadRequirements();
});
