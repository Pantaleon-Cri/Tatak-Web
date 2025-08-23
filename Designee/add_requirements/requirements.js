let currentEditingId = null;
let currentEditingInput = null;

function showModal(modal) { modal.style.display = "flex"; }
function closeModal(modal) { modal.style.display = "none"; }

function addRequirementToUI(requirementText, docId, semester) {
  const list = document.getElementById("requirementsList");
  const row = document.createElement("div");
  row.classList.add("item-row");
  if (docId) row.setAttribute("data-id", docId);

  row.innerHTML = `
    <input type="text" value="${requirementText}" readonly>
    
    <div class="item-actions">
      <button class="edit-item-btn"><i class="fas fa-edit"></i></button>
      <button class="delete-item-btn"><i class="fas fa-trash-alt"></i></button>
    </div>
  `;
  list.prepend(row);

  row.querySelector(".edit-item-btn").addEventListener("click", () => {
    currentEditingId = docId;
    currentEditingInput = row.querySelector("input");
    document.getElementById("editRequirementInput").value = currentEditingInput.value;
    showModal(document.getElementById("editModal"));
  });

  row.querySelector(".delete-item-btn").addEventListener("click", () => {
    currentEditingId = docId;
    showModal(document.getElementById("deleteModal"));
  });
}

// Load requirements based on userData from localStorage
async function loadRequirements() {
  try {
    const userData = JSON.parse(localStorage.getItem("userData"));
    if (!userData) throw new Error("User data not found in localStorage.");

    console.log("Loading requirements for user:", userData.id, "role:", userData.role);
    console.log("CreatedByDesigneeID:", userData.createdByDesigneeID);

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
        addRequirementToUI(data.requirement, doc.id, data.semester);
      }
    });

  } catch (err) {
    console.error("Failed to load requirements:", err);
    alert("Failed to load requirements.");
  }
}


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

    const docRef = await db.collection("RequirementsTable").add({
      requirement: requirementText,
      addedBy: userData.id,
      addedByRole: userData.role,
      addedByDesigneeId: userData.role === "designee" ? userData.id : userData.createdByDesigneeID,
      office: userData.office || "N/A",
      category: userData.category || "N/A",
      department: userData.department || "N/A",
      semester: currentSemester,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    addRequirementToUI(requirementText, docRef.id, currentSemester);
  } catch (err) {
    console.error("Failed to add requirement:", err);
    alert("Failed to add requirement.");
  }
}

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
