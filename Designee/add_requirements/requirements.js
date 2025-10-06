let currentEditingId = null;
let currentEditingInput = null;
let yearLevelOptions = []; // store year level options globally as { id, name }
const roleOptions = ["None", "Violation", "Officer"]; // dropdown for role

function showModal(modal) { modal.style.display = "flex"; }
function closeModal(modal) { modal.style.display = "none"; }

// 🔹 Fetch yearLevel options once from Firestore (store as objects with id & name)
async function loadYearLevelOptions() {
  try {
    const snapshot = await db.collection("DataTable").doc("YearLevel").collection("YearLevelDocs").get();
    yearLevelOptions = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().yearLevel })).filter(Boolean);

    // Add "All" option with a special ID of "all"
    if (!yearLevelOptions.some(opt => opt.name === "All")) {
      yearLevelOptions.unshift({ id: "all", name: "All" });
    }

    console.log("Loaded year levels:", yearLevelOptions);
  } catch (err) {
    console.error("Failed to load yearLevel options:", err);
  }
}

// 🔹 Get current semester document (id + name)
async function getCurrentSemester() {
  try {
    const snapshot = await db.collection("DataTable").doc("Semester").collection("SemesterDocs")
      .where("currentSemester", "==", true)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const semDoc = snapshot.docs[0];
    return { id: semDoc.id, semester: semDoc.data().semester };
  } catch (err) {
    console.error("Failed to get current semester:", err);
    return null;
  }
}

// 🔹 Add requirement to UI
function addRequirementToUI(requirementText, docId, semesterId, yearLevelId, roleField, userData) {
  const list = document.getElementById("requirementsList");
  if (list.querySelector(`[data-id="${docId}"]`)) return;

  const row = document.createElement("div");
  row.classList.add("item-row");
  if (docId) row.setAttribute("data-id", docId);

  const yearLevelDropdownHtml = `
    <select class="yearlevel-dropdown">
      ${yearLevelOptions.map(opt => `<option value="${opt.id}" ${opt.id === (yearLevelId || "all") ? "selected" : ""}>${opt.name}</option>`).join("")}
    </select>
  `;

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
    const newYearLevelId = e.target.value;
    try {
      const designeeId = userData.role === "designee" ? userData.id : userData.createdByDesigneeID;
      await db.collection("RequirementsAndNotes")
        .doc("RequirementsList")
        .collection(designeeId)
        .doc(docId)
        .update({ yearLevel: newYearLevelId });
      console.log(`Year level updated for ${docId}: ${newYearLevelId}`);
    } catch (err) {
      console.error("Failed to update year level:", err);
      alert("Failed to update year level.");
    }
  });

  // 🔹 Role change
  roleDropdown.addEventListener("change", async (e) => {
    const selectedRole = e.target.value;
    try {
      const designeeId = userData.role === "designee" ? userData.id : userData.createdByDesigneeID;
      let updateData = {};
      if (selectedRole === "Violation") {
        updateData.violation = true;
        updateData.officer = false;
      } else if (selectedRole === "Officer") {
        updateData.officer = true;
        updateData.violation = false;
      } else {
        updateData.officer = false;
        updateData.violation = false;
      }
      await db.collection("RequirementsAndNotes")
        .doc("RequirementsList")
        .collection(designeeId)
        .doc(docId)
        .update(updateData);
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

    const currentSemesterData = await getCurrentSemester();
    if (!currentSemesterData) return;
    const { id: semesterId } = currentSemesterData;

    const designeeId = userData.role === "designee" ? userData.id : userData.createdByDesigneeID;

    const snapshot = await db.collection("RequirementsAndNotes")
      .doc("RequirementsList")
      .collection(designeeId)
      .orderBy("createdAt", "asc")
      .get();

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.semester === semesterId) {
        addRequirementToUI(data.requirement, doc.id, semesterId, data.yearLevel || "all", {
          violation: !!data.violation,
          officer: !!data.officer
        }, userData);
      }
    });
  } catch (err) {
    console.error("Failed to load requirements:", err);
    alert("Failed to load requirements.");
  }
}

// 🔹 Get next numeric ID based on designee collection
async function getNextRequirementId(designeeId) {
  const snapshot = await db.collection("RequirementsAndNotes")
    .doc("RequirementsList")
    .collection(designeeId)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();
  if (snapshot.empty) return "1";
  return (parseInt(snapshot.docs[0].id, 10) + 1).toString();
}

// 🔹 Add new requirement
async function addRequirement(requirementText) {
  try {
    const userData = JSON.parse(localStorage.getItem("userData"));
    const designeeId = userData.role === "designee" ? userData.id : userData.createdByDesigneeID;

    const currentSemesterData = await getCurrentSemester();
    if (!currentSemesterData) return;
    const { id: semesterId } = currentSemesterData;

    const defaultYearLevel = "all"; // store as ID
    const newId = await getNextRequirementId(designeeId);

    const addData = {
      requirement: requirementText,
      addedBy: userData.id,
      addedByRole: userData.role,
      addedByDesigneeId: designeeId,
      office: userData.office || "N/A",
      category: userData.category || "N/A",
      department: userData.department || "N/A",
      semester: semesterId, // store as semester ID
      yearLevel: defaultYearLevel,
      violation: false,
      officer: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection("RequirementsAndNotes")
      .doc("RequirementsList")
      .collection(designeeId)
      .doc(newId)
      .set(addData);

    addRequirementToUI(requirementText, newId, semesterId, defaultYearLevel, null, userData);
  } catch (err) {
    console.error("Failed to add requirement:", err);
    alert("Failed to add requirement.");
  }
}

// 🔹 Save edited requirement
async function saveEditedRequirement(newText) {
  try {
    const userData = JSON.parse(localStorage.getItem("userData"));
    const designeeId = userData.role === "designee" ? userData.id : userData.createdByDesigneeID;

    await db.collection("RequirementsAndNotes")
      .doc("RequirementsList")
      .collection(designeeId)
      .doc(currentEditingId)
      .update({ requirement: newText });

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
    const userData = JSON.parse(localStorage.getItem("userData"));
    const designeeId = userData.role === "designee" ? userData.id : userData.createdByDesigneeID;

    await db.collection("RequirementsAndNotes")
      .doc("RequirementsList")
      .collection(designeeId)
      .doc(currentEditingId)
      .delete();

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
